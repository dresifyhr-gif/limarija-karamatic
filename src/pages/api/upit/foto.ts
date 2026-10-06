/**
 * POST /api/upit/foto — javna ruta za fotografije uz upit (forma "Upit za procjenu").
 *   multipart: file (JPEG/PNG/WebP; preglednik ga prije slanja smanji na ≤ 2048 px JPEG)
 *   → 201 { url, pathname, width, height, sig }   sig = potpis koji /api/upit provjerava
 * Zaštita: ista domena, ograničenje učestalosti po IP-u (hash), provjera formata po potpisu datoteke, EXIF/GPS se briše.
 * Fotografije idu u Blob folder 'leads'. Admin ih briše zajedno s upitom.
 */
import { json, route, HttpError } from '@/lib/server/http';
import { uploadImage, MAX_UPLOAD_BYTES } from '@/lib/server/blob';
import { clientKey, hit } from '@/lib/server/rate-limit';
import { photoSig, sameSite, PRIVATE_HEADERS } from '@/lib/quotes/server';

export const prerender = false;

/** najviše 30 fotografija na sat po IP-u (5 upita × 6 fotografija) */
const BUCKET = 'upit-foto';
const LIMIT = 30;
const WINDOW = 3600;

export const POST = route(async (ctx) => {
  const { request } = ctx;
  if (!sameSite(ctx)) throw new HttpError(403, 'Zahtjev odbijen.');
  const len = Number(request.headers.get('content-length') ?? 0);
  if (len > MAX_UPLOAD_BYTES + 64 * 1024) throw new HttpError(413, 'Fotografija je veća od 12 MB.');
  if (!(request.headers.get('content-type') ?? '').includes('multipart/form-data')) throw new HttpError(415, 'Očekivana je fotografija.');

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) throw new HttpError(400, 'Nije odabrana fotografija.');
  if (file.size > MAX_UPLOAD_BYTES) throw new HttpError(413, 'Fotografija je veća od 12 MB.');

  // atomski: zabilježi pa prebroji (paralelni zahtjevi se ne mogu provući ispod ograničenja)
  const r = await hit(BUCKET, clientKey(ctx), WINDOW, LIMIT);
  if (!r.ok) throw new HttpError(429, `Previše fotografija u kratkom vremenu. Pokušajte za ${r.retryMin} min ili ih pošaljite na WhatsApp.`);
  const img = await uploadImage(new Uint8Array(await file.arrayBuffer()), 'leads');
  return json(
    { url: img.url, pathname: img.pathname, width: img.width, height: img.height, sig: photoSig(img.url) },
    201,
    { 'cache-control': 'no-store', 'x-robots-tag': PRIVATE_HEADERS['x-robots-tag'] },
  );
});
