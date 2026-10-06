/**
 * POST   /api/admin/upload   multipart: file (obavezno), folder? ('media'|'leads'|'quotes', zadano 'media'), alt?
 *        → 201 UploadedImage { url, pathname, width, height, alt, size, contentType }
 * DELETE /api/admin/upload   JSON { urls: string[], force?: boolean }
 *        → 200 { deleted: string[], skipped: string[] }  (skipped = još se koristi negdje; force=true briše svejedno)
 */
import { json, readJson, route, HttpError } from '@/lib/server/http';
import { uploadImage, deleteBlobs, isBlobReferenced, isOurBlobUrl, MAX_UPLOAD_BYTES, UPLOAD_FOLDERS, type UploadFolder } from '@/lib/server/blob';
import { parse, v } from '@/lib/server/validate';

export const prerender = false;

export const POST = route(async ({ request }) => {
  const len = Number(request.headers.get('content-length') ?? 0);
  if (len > MAX_UPLOAD_BYTES + 64 * 1024) throw new HttpError(413, 'Fotografija je veća od 12 MB.');
  const ct = request.headers.get('content-type') ?? '';
  if (!ct.includes('multipart/form-data')) throw new HttpError(415, 'Očekivan je multipart/form-data.');
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) throw new HttpError(400, 'Nije odabrana fotografija.', { file: 'Obavezno.' });
  if (file.size > MAX_UPLOAD_BYTES) throw new HttpError(413, 'Fotografija je veća od 12 MB.');
  const folderRaw = String(form.get('folder') ?? 'media');
  const folder = (UPLOAD_FOLDERS as readonly string[]).includes(folderRaw) ? (folderRaw as UploadFolder) : 'media';
  const alt = String(form.get('alt') ?? '').trim().slice(0, 300);
  const img = await uploadImage(new Uint8Array(await file.arrayBuffer()), folder, alt);
  return json(img, 201);
});

const DeleteSchema = v.object({ urls: v.array(v.string({ min: 1, max: 1000 }), { min: 1, max: 50 }), force: v.optional(v.bool()) });

export const DELETE = route(async ({ request }) => {
  const { urls, force } = parse(DeleteSchema, await readJson(request));
  const ours = urls.filter(isOurBlobUrl);
  const toDelete: string[] = [];
  const skipped: string[] = urls.filter((u) => !isOurBlobUrl(u));
  for (const u of ours) {
    if (!force && (await isBlobReferenced(u))) skipped.push(u);
    else toDelete.push(u);
  }
  const deleted = toDelete.length ? await deleteBlobs(toDelete) : [];
  return json({ deleted, skipped });
});
