/**
 * Fotografije na Vercel Blobu (javni store, fra1).
 *
 * - validateImage(buf): prepoznaje JPEG/PNG/WebP po potpisu (ne vjeruje imenu ni content-typeu),
 *   odbija HEIC/GIF/ostalo (415) i > 12 MB (413), čita širinu/visinu iz zaglavlja.
 * - JPEG: uklanja EXIF/XMP/IPTC (GPS lokacija kuće klijenta!) — orijentacija se čuva kao minimalni EXIF.
 * - uploadImage(): sprema pod nepogodivom putanjom `<folder>/<yyyy>/<24 znaka base64url>.<ext>`.
 * - deleteBlobs(): briše samo URL-ove s našeg Blob hosta.
 * - deleteBlobsIfUnused(): briše samo ono na što se više ništa u bazi ne referira.
 *
 * Admin preglednik prije slanja SAM smanji fotografiju (max 2560 px, JPEG ~0,85 — vidi src/lib/admin/upload.ts),
 * jer Vercel funkcije primaju najviše ~4,5 MB tijela zahtjeva.
 */
import { put, del } from '@vercel/blob';
import { randomBytes } from 'node:crypto';
import { requireEnv, env } from './env';
import { db } from './db';
import { HttpError } from './http';
import type { UploadedImage } from '@/lib/types';

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
export const UPLOAD_FOLDERS = ['media', 'leads', 'quotes'] as const;
export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];

type Kind = 'jpeg' | 'png' | 'webp';
const MIME: Record<Kind, string> = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const EXT: Record<Kind, string> = { jpeg: 'jpg', png: 'png', webp: 'webp' };

/**
 * Točan host NAŠEG Blob storea: "<storeId>.public.blob.vercel-storage.com".
 * storeId je javni dio tokena (vercel_blob_rw_<storeId>_<tajna>) — isti se vidi u svakom javnom URL-u fotografije.
 * BLOB_PUBLIC_HOST (neobavezno) ga može zadati izravno.
 */
let ourHost: string | null | undefined;
export function blobHost(): string | null {
  if (ourHost !== undefined) return ourHost;
  const explicit = env('BLOB_PUBLIC_HOST');
  const id = /^vercel_blob_rw_([A-Za-z0-9]+)_/.exec(env('BLOB_READ_WRITE_TOKEN') ?? '')?.[1];
  ourHost = explicit ? explicit.toLowerCase() : id ? `${id.toLowerCase()}.public.blob.vercel-storage.com` : null;
  return ourHost;
}

/** Je li URL s NAŠEG Blob storea (ne bilo kojeg *.public.blob.vercel-storage.com). */
export function isOurBlobUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = blobHost();
    return u.protocol === 'https:' && !!host && u.hostname.toLowerCase() === host;
  } catch {
    return false;
  }
}

/* ── prepoznavanje formata i dimenzije ───────────────────────────────────── */

function sniff(b: Uint8Array): Kind | 'heic' | 'gif' | null {
  if (b.length < 16) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  const ascii = (o: number, n: number) => String.fromCharCode(...b.subarray(o, o + n));
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return 'webp';
  if (ascii(0, 3) === 'GIF') return 'gif';
  if (ascii(4, 4) === 'ftyp' && /^(heic|heix|hevc|heim|heis|mif1|msf1|avif)/.test(ascii(8, 4))) return 'heic';
  return null;
}

const u16be = (b: Uint8Array, o: number) => (b[o] << 8) | b[o + 1];
const u32be = (b: Uint8Array, o: number) => ((b[o] << 24) >>> 0) + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3];
const u16le = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const u24le = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);

/** EXIF orijentacija iz APP1 segmenta (1 ako je nema). */
function exifOrientation(seg: Uint8Array): number {
  // seg = sadržaj APP1 bez markera i duljine: "Exif\0\0" + TIFF
  if (String.fromCharCode(...seg.subarray(0, 4)) !== 'Exif') return 1;
  const t = seg.subarray(6);
  const le = t[0] === 0x49;
  const r16 = (o: number) => (le ? t[o] | (t[o + 1] << 8) : (t[o] << 8) | t[o + 1]);
  const r32 = (o: number) => (le ? (t[o] | (t[o + 1] << 8) | (t[o + 2] << 16)) + t[o + 3] * 2 ** 24 : u32be(t, o));
  const ifd = r32(4);
  if (ifd + 2 > t.length) return 1;
  const n = r16(ifd);
  for (let i = 0; i < n; i++) {
    const e = ifd + 2 + i * 12;
    if (e + 12 > t.length) break;
    if (r16(e) === 0x0112) return r16(e + 8) || 1;
  }
  return 1;
}

/** Minimalni APP1 EXIF samo s orijentacijom (big-endian TIFF). */
function minimalExif(orientation: number): Uint8Array {
  const body = new Uint8Array([
    0x45, 0x78, 0x69, 0x66, 0, 0, // "Exif\0\0"
    0x4d, 0x4d, 0, 0x2a, 0, 0, 0, 8, // TIFF "MM", 42, IFD0 @ 8
    0, 1, // 1 zapis
    0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, orientation, 0, 0, // Orientation SHORT = n
    0, 0, 0, 0, // nema sljedećeg IFD-a
  ]);
  const seg = new Uint8Array(4 + body.length);
  seg.set([0xff, 0xe1, (body.length + 2) >> 8, (body.length + 2) & 0xff]);
  seg.set(body, 4);
  return seg;
}

/** JPEG: makni APP1 (EXIF/XMP), APP13 (IPTC) i komentare; vrati i dimenzije + orijentaciju. */
function processJpeg(b: Uint8Array): { out: Uint8Array; width: number; height: number; orientation: number } {
  const keep: Uint8Array[] = [b.subarray(0, 2)];
  let o = 2;
  let width = 0, height = 0, orientation = 1;
  while (o + 4 <= b.length) {
    if (b[o] !== 0xff) throw new HttpError(415, 'Oštećena JPEG datoteka.');
    const marker = b[o + 1];
    if (marker === 0xff) { o++; continue; } // padding
    if (marker === 0xda) { keep.push(b.subarray(o)); break; } // početak slike: ostatak kopiramo
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { keep.push(b.subarray(o, o + 2)); o += 2; continue; }
    const len = u16be(b, o + 2);
    if (len < 2 || o + 2 + len > b.length) throw new HttpError(415, 'Oštećena JPEG datoteka.');
    const seg = b.subarray(o, o + 2 + len);
    const content = b.subarray(o + 4, o + 2 + len);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      height = u16be(b, o + 5);
      width = u16be(b, o + 7);
    }
    if (marker === 0xe1) {
      const ori = exifOrientation(content);
      if (ori !== 1) orientation = ori;
    } else if (marker !== 0xed && marker !== 0xfe) {
      keep.push(seg);
    }
    o += 2 + len;
  }
  if (!width || !height) throw new HttpError(415, 'Ne mogu pročitati dimenzije fotografije.');
  if (orientation > 1 && orientation <= 8) keep.splice(1, 0, minimalExif(orientation));
  const total = keep.reduce((s, x) => s + x.length, 0);
  const out = new Uint8Array(total);
  let p = 0;
  for (const k of keep) { out.set(k, p); p += k.length; }
  // orijentacija 5–8 = zakrenuto za 90°: prikazane dimenzije su zamijenjene
  if (orientation >= 5 && orientation <= 8) [width, height] = [height, width];
  return { out, width, height, orientation };
}

function pngSize(b: Uint8Array) {
  return { width: u32be(b, 16), height: u32be(b, 20) };
}

function webpSize(b: Uint8Array) {
  const chunk = String.fromCharCode(...b.subarray(12, 16));
  if (chunk === 'VP8X') return { width: 1 + u24le(b, 24), height: 1 + u24le(b, 27) };
  if (chunk === 'VP8L') {
    const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
  }
  if (chunk === 'VP8 ') return { width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
  throw new HttpError(415, 'Nepoznat WebP format.');
}

export type ValidatedImage = { bytes: Uint8Array; kind: Kind; contentType: string; width: number; height: number };

/** Provjeri i pripremi fotografiju za spremanje. Baca HttpError 413/415. */
export function validateImage(input: Uint8Array): ValidatedImage {
  if (input.length > MAX_UPLOAD_BYTES) throw new HttpError(413, 'Fotografija je veća od 12 MB.');
  const kind = sniff(input);
  if (kind === 'heic')
    throw new HttpError(415, 'HEIC/AVIF format nije podržan. Na iPhoneu: Postavke → Kamera → Formati → "Najkompatibilnije", ili pošaljite JPEG.');
  if (kind === 'gif' || !kind) throw new HttpError(415, 'Podržani su samo JPEG, PNG i WebP.');
  let bytes = input;
  let size: { width: number; height: number };
  if (kind === 'jpeg') {
    const r = processJpeg(input);
    bytes = r.out;
    size = { width: r.width, height: r.height };
  } else if (kind === 'png') size = pngSize(input);
  else size = webpSize(input);
  if (!(size.width > 0 && size.height > 0) || size.width > 20000 || size.height > 20000)
    throw new HttpError(415, 'Neispravne dimenzije fotografije.');
  return { bytes, kind, contentType: MIME[kind], ...size };
}

/* ── spremanje / brisanje ────────────────────────────────────────────────── */

export async function uploadImage(input: Uint8Array, folder: UploadFolder = 'media', alt = ''): Promise<UploadedImage> {
  const img = validateImage(input);
  const pathname = `${folder}/${new Date().getUTCFullYear()}/${randomBytes(18).toString('base64url')}.${EXT[img.kind]}`;
  const res = await put(pathname, Buffer.from(img.bytes), {
    access: 'public',
    contentType: img.contentType,
    addRandomSuffix: false,
    cacheControlMaxAge: 60 * 60 * 24 * 365,
    token: requireEnv('BLOB_READ_WRITE_TOKEN'),
  });
  return {
    url: res.url,
    pathname: res.pathname,
    width: img.width,
    height: img.height,
    alt,
    size: img.bytes.length,
    contentType: img.contentType,
  };
}

/** Obriši s Bloba (samo naši URL-ovi; ostali se tiho preskaču). Vraća obrisane. */
export async function deleteBlobs(urls: string[]): Promise<string[]> {
  const ours = [...new Set(urls.filter(isOurBlobUrl))];
  if (ours.length) await del(ours, { token: requireEnv('BLOB_READ_WRITE_TOKEN') });
  return ours;
}

/** Koristi li ijedan zapis u bazi ovaj URL (radovi, usluge, upiti, postavke)? */
export async function isBlobReferenced(url: string): Promise<boolean> {
  const probe = JSON.stringify([{ url }]);
  const rows = await db()`SELECT
      EXISTS (SELECT 1 FROM project_images WHERE url = ${url})
   OR EXISTS (SELECT 1 FROM services WHERE cover->>'url' = ${url} OR gallery @> ${probe}::jsonb)
   OR EXISTS (SELECT 1 FROM leads WHERE photos @> ${probe}::jsonb)
   OR EXISTS (SELECT 1 FROM settings WHERE position(${url} in value::text) > 0) AS used`;
  return !!rows[0]?.used;
}

/** Obriši one URL-ove na koje se više ništa ne referira. Greške Bloba samo logira (ne ruši spremanje). */
export async function deleteBlobsIfUnused(urls: string[]): Promise<string[]> {
  const candidates = [...new Set(urls.filter(isOurBlobUrl))];
  const unused: string[] = [];
  for (const u of candidates) if (!(await isBlobReferenced(u))) unused.push(u);
  if (!unused.length) return [];
  try {
    return await deleteBlobs(unused);
  } catch (e) {
    console.error('[blob] brisanje nije uspjelo:', (e as Error).message);
    return [];
  }
}
