/**
 * PATCH  /api/admin/push/:id  JSON { label?, prefs?: { lead?, accepted?, opened? } } → PushDevice   (PUT je alias)
 * DELETE /api/admin/push/:id → { ok: true }   (uređaj više ne prima obavijesti)
 */
import { json, readJson, route, parseId, HttpError } from '@/lib/server/http';
import { updateDevice, deleteDevice, type PushPrefs } from '@/lib/server/push';

export const prerender = false;

export const PATCH = route(async ({ params, request }) => {
  const id = parseId(params.id);
  const body = await readJson<{ label?: unknown; prefs?: unknown }>(request, 5_000);
  const fields: Record<string, string> = {};
  if (body.label !== undefined && (typeof body.label !== 'string' || body.label.trim().length > 60)) fields.label = 'Najviše 60 znakova.';
  if (body.prefs !== undefined && (typeof body.prefs !== 'object' || body.prefs === null)) fields.prefs = 'Neispravne postavke.';
  if (Object.keys(fields).length) throw new HttpError(400, 'Provjerite označena polja.', fields);
  return json(await updateDevice(id, { label: body.label as string | undefined, prefs: body.prefs as Partial<PushPrefs> | undefined }));
});
export const PUT = PATCH;

export const DELETE = route(async ({ params }) => {
  await deleteDevice(parseId(params.id));
  return json({ ok: true });
});
