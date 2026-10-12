/**
 * GET /api/admin/settings → SettingsMap { contact, company, quote, stats, homepage (samo izmjene), labels } (baza preko zadanih)
 * PUT /api/admin/settings  JSON { values: { homepage?, labels?, … } } → spremljene vrijednosti.
 *     Ili sve ili ništa: najprije se provjere sve postavke, tek onda se spremaju (jednim upitom).
 *     Greške polja imaju prefiks ključa: { fields: { "labels.cta": "…", "homepage.hero.title": "…" } }.
 */
import { json, readJson, route, HttpError } from '@/lib/server/http';
import { getSettings, saveSettings } from '@/lib/server/repo/settings';
import { SETTINGS_KEYS, type SettingsKey } from '@/lib/types';

export const prerender = false;

export const GET = route(async () => json(await getSettings()));

export const PUT = route(async ({ request }) => {
  const body = await readJson<{ values?: unknown }>(request);
  const values = body && typeof body === 'object' ? body.values : undefined;
  if (!values || typeof values !== 'object' || Array.isArray(values)) throw new HttpError(400, 'Nedostaje "values".');
  for (const k of Object.keys(values)) {
    if (!(SETTINGS_KEYS as readonly string[]).includes(k)) throw new HttpError(404, 'Nepoznata postavka.');
  }
  return json(await saveSettings(values as Partial<Record<SettingsKey, unknown>>));
});
