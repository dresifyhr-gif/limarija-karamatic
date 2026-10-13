import { db } from '../db';
import { touchContent } from '../meta';
import { parse } from '../validate';
import { HttpError } from '../http';
import { SETTINGS_SCHEMAS } from '../schemas';
import { defaultSettings, resolveLabels } from '@/lib/defaults';
import { resolveDesign } from '@/lib/fonts';
import type { SettingsKey, SettingsMap } from '@/lib/types';

/** Ključevi čija promjena utječe na javnu stranicu (→ touchContent). company/quote su samo za ponude. */
const PUBLIC_KEYS: SettingsKey[] = ['contact', 'stats', 'homepage', 'labels', 'design'];

/**
 * Sve postavke, spojene preko zadanih (site.ts) — uvijek potpun objekt.
 * Iznimke: `homepage` su SAMO izmjene (razrješava ih resolveHomepage / getContent), `labels` su razriješeni (prazno → zadano).
 */
export async function getSettings(): Promise<SettingsMap> {
  const defaults = defaultSettings();
  const rows = await db()`SELECT key, value FROM settings`;
  const out = { ...defaults } as Record<string, unknown>;
  for (const r of rows) {
    const key = r.key as SettingsKey;
    if (!(key in defaults)) continue;
    const def = defaults[key];
    if (Array.isArray(def)) out[key] = Array.isArray(r.value) ? r.value : def;
    else out[key] = { ...(def as object), ...(r.value && typeof r.value === 'object' ? (r.value as object) : {}) };
  }
  out.labels = resolveLabels(out.labels as SettingsMap['labels']);
  out.design = resolveDesign(out.design);
  return out as SettingsMap;
}

export async function getSetting<K extends SettingsKey>(key: K): Promise<SettingsMap[K]> {
  return (await getSettings())[key];
}

/** Provjeri (sheme iz schemas.ts) i spremi jednu postavku. Vraća spremljenu vrijednost. */
export async function saveSetting<K extends SettingsKey>(key: K, value: unknown): Promise<SettingsMap[K]> {
  const schema = SETTINGS_SCHEMAS[key];
  const clean = parse(schema as never, value) as SettingsMap[K];
  await db()`INSERT INTO settings (key, value, updated_at) VALUES (${key}, ${JSON.stringify(clean)}::jsonb, now())
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
  if (PUBLIC_KEYS.includes(key)) await touchContent();
  return key === 'labels' ? (resolveLabels(clean as SettingsMap['labels']) as SettingsMap[K]) : clean;
}

/**
 * Više postavki odjednom (admin → Naslovnica: homepage + labels): najprije se provjere SVE,
 * pa se spreme jednim upitom — ili sve ili ništa. Greške polja imaju prefiks ključa ("labels.cta", "homepage.hero.title").
 */
export async function saveSettings(values: Partial<Record<SettingsKey, unknown>>): Promise<Partial<SettingsMap>> {
  const keys = Object.keys(values) as SettingsKey[];
  const clean: Record<string, unknown> = {};
  const fields: Record<string, string> = {};
  for (const key of keys) {
    try {
      clean[key] = parse(SETTINGS_SCHEMAS[key] as never, values[key]);
    } catch (e) {
      if (!(e instanceof HttpError)) throw e;
      for (const [path, msg] of Object.entries(e.fields ?? { _: e.message })) fields[path === '_' ? key : `${key}.${path}`] ??= msg;
    }
  }
  if (Object.keys(fields).length) throw new HttpError(400, 'Provjerite označena polja.', fields);
  if (!keys.length) return {};
  await db()`INSERT INTO settings (key, value, updated_at)
             SELECT e.key, e.value, now() FROM jsonb_each(${JSON.stringify(clean)}::jsonb) AS e
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
  if (keys.some((k) => PUBLIC_KEYS.includes(k))) await touchContent();
  if ('labels' in clean) clean.labels = resolveLabels(clean.labels as SettingsMap['labels']);
  return clean as Partial<SettingsMap>;
}

/** Sirova spremljena vrijednost (bez spajanja sa zadanim) ili null — npr. da admin zna koja su polja izmijenjena. */
export async function getStoredSetting(key: SettingsKey): Promise<unknown> {
  const rows = await db()`SELECT value FROM settings WHERE key = ${key}`;
  return rows.length ? rows[0].value : null;
}
