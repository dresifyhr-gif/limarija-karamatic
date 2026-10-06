/**
 * Slanje fotografija iz admina (preglednik).
 *
 *   import { uploadImage } from '@/lib/admin/upload';
 *   const img = await uploadImage(file, { folder: 'media', onProgress: (p) => … });   // → UploadedImage
 *
 * Prije slanja fotografija se u pregledniku:
 *  - okrene prema EXIF orijentaciji, smanji na najviše 2560 px (dulja stranica) i spremi kao JPEG (~0,85)
 *  - time nestaju EXIF/GPS podaci, a datoteka je redovno 0,4–1,5 MB (Vercel prima najviše ~4,5 MB po zahtjevu)
 * HEIC s iPhonea: Safari ga sam dekodira; ako preglednik ne može, korisnik dobije jasnu poruku.
 */
import type { UploadedImage } from '@/lib/types';

export const MAX_EDGE = 2560;
const MAX_SEND_BYTES = 4 * 1024 * 1024;
const ACCEPT = /^image\/(jpeg|png|webp|heic|heif)$/i;

export class UploadError extends Error {}

async function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new UploadError('Pretvorba nije uspjela.'))), 'image/jpeg', quality));
}

/** Smanji i pretvori u JPEG. Ako preglednik ne može dekodirati, vrati original (ako je JPEG/PNG/WebP i dovoljno malen). */
export async function prepareImage(file: File, maxEdge = MAX_EDGE): Promise<Blob> {
  const isHeic = /hei[cf]/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
  if (file.type && !ACCEPT.test(file.type) && !isHeic) throw new UploadError('Podržane su samo fotografije (JPEG, PNG, WebP, HEIC).');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    if (isHeic) throw new UploadError('Ovaj preglednik ne može otvoriti HEIC fotografiju. Pošaljite je s iPhonea (Safari) ili kao JPEG.');
    if (file.size <= MAX_SEND_BYTES) return file;
    throw new UploadError('Fotografiju nije moguće pripremiti za slanje.');
  }
  let edge = maxEdge;
  for (let attempt = 0; attempt < 4; attempt++) {
    const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = await toBlob(canvas, attempt === 0 ? 0.85 : 0.78);
    if (blob.size <= MAX_SEND_BYTES) {
      bitmap.close();
      return blob;
    }
    edge = Math.round(edge * 0.8);
  }
  bitmap.close();
  throw new UploadError('Fotografija je prevelika.');
}

/** Pošalji na POST /api/admin/upload (XHR zbog napretka). */
export async function uploadImage(
  file: File,
  opts: { folder?: 'media' | 'leads' | 'quotes'; alt?: string; onProgress?: (fraction: number) => void; maxEdge?: number } = {},
): Promise<UploadedImage> {
  const blob = await prepareImage(file, opts.maxEdge ?? MAX_EDGE);
  const fd = new FormData();
  const name = file.name.replace(/\.[^.]+$/, '') + (blob.type === 'image/jpeg' ? '.jpg' : '');
  fd.append('file', blob, name || 'fotografija.jpg');
  fd.append('folder', opts.folder ?? 'media');
  if (opts.alt) fd.append('alt', opts.alt);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/admin/upload');
    xhr.responseType = 'json';
    xhr.upload.onprogress = (e) => e.lengthComputable && opts.onProgress?.(e.loaded / e.total);
    xhr.onerror = () => reject(new UploadError('Slanje nije uspjelo. Provjerite internet.'));
    xhr.onload = () => {
      if (xhr.status === 401) {
        location.href = `/admin/login?next=${encodeURIComponent(location.pathname)}`;
        return reject(new UploadError('Prijava je istekla.'));
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response as UploadedImage);
      else reject(new UploadError((xhr.response as { error?: string } | null)?.error ?? `Greška pri slanju (${xhr.status}).`));
    };
    xhr.send(fd);
  });
}

/** Obriši tek učitane (još nespremljene) fotografije s Bloba. Ono što se još negdje koristi server preskače. */
export async function discardUploads(urls: string[]): Promise<void> {
  if (!urls.length) return;
  await fetch('/api/admin/upload', {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ urls }),
    keepalive: true,
  }).catch(() => {});
}
