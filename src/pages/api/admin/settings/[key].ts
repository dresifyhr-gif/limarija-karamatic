/**
 * GET /api/admin/settings/:key → vrijednost
 * PUT /api/admin/settings/:key  JSON { value } → spremljena vrijednost (cijeli objekt/niz, ne djelomično)
 * key ∈ contact | company | quote | stats
 */
import { json, readJson, route, HttpError } from '@/lib/server/http';
import { getSetting, saveSetting } from '@/lib/server/repo/settings';
import { SETTINGS_KEYS, type SettingsKey } from '@/lib/types';

export const prerender = false;

const keyOf = (k: string | undefined): SettingsKey => {
  if (!k || !(SETTINGS_KEYS as readonly string[]).includes(k)) throw new HttpError(404, 'Nepoznata postavka.');
  return k as SettingsKey;
};

export const GET = route(async ({ params }) => json(await getSetting(keyOf(params.key))));

export const PUT = route(async ({ params, request }) => {
  const key = keyOf(params.key);
  const body = await readJson<{ value?: unknown }>(request);
  if (!body || typeof body !== 'object' || !('value' in body)) throw new HttpError(400, 'Nedostaje "value".');
  return json(await saveSetting(key, body.value));
});
