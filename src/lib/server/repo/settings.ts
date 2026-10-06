import { db } from '../db';
import { touchContent } from '../meta';
import { parse } from '../validate';
import { SETTINGS_SCHEMAS } from '../schemas';
import { defaultSettings } from '@/lib/defaults';
import type { SettingsKey, SettingsMap } from '@/lib/types';

/** Ključevi čija promjena utječe na javnu stranicu (→ touchContent). company/quote su samo za ponude. */
const PUBLIC_KEYS: SettingsKey[] = ['contact', 'stats'];

/** Sve postavke, spojene preko zadanih (site.ts) — uvijek potpun objekt. */
export async function getSettings(): Promise<SettingsMap> {
  const defaults = defaultSettings();
  const rows = await db()`SELECT key, value FROM settings`;
  const out = { ...defaults } as Record<string, unknown>;
  for (const r of rows) {
    const key = r.key as SettingsKey;
    if (!(key in defaults)) continue;
    const def = defaults[key];
    out[key] = Array.isArray(def) ? r.value : { ...(def as object), ...(r.value as object) };
  }
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
  return clean;
}
