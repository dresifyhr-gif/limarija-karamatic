/**
 * admin_meta: interni ključevi admina (lozinka, epoha sesija, stanje objave).
 *
 *   password_hash       string  "scrypt:N:r:p:salt:hash" — ima prednost pred ADMIN_PASSWORD_HASH iz okruženja
 *   session_epoch       number  povećava se pri promjeni lozinke → sve stare sesije prestaju vrijediti
 *   last_publish_at     ISO     kad je zadnji put pokrenut deploy hook
 *   content_updated_at  ISO     zadnja promjena JAVNOG sadržaja (settings/services/projects/reviews/faq)
 */
import { db } from './db';

export async function getMeta<T = unknown>(key: string): Promise<T | null> {
  const rows = await db()`SELECT value FROM admin_meta WHERE key = ${key}`;
  return rows.length ? (rows[0].value as T) : null;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db()`INSERT INTO admin_meta (key, value, updated_at) VALUES (${key}, ${JSON.stringify(value)}::jsonb, now())
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
}

/**
 * Označi da se javni sadržaj promijenio (gumb "Objavi na stranicu" postaje aktivan).
 * Pozovi nakon SVAKE uspješne promjene settings/services/projects/project_images/reviews/faq.
 * (Upiti i ponude nisu javni sadržaj — ne pozivati.)
 */
export async function touchContent(): Promise<void> {
  await setMeta('content_updated_at', new Date().toISOString());
}

export type PublishState = {
  lastPublishAt: string | null;
  contentUpdatedAt: string | null;
  /** true = postoje promjene koje još nisu na javnoj stranici */
  dirty: boolean;
};

export async function getPublishState(): Promise<PublishState> {
  const rows = await db()`SELECT key, value FROM admin_meta WHERE key IN ('last_publish_at', 'content_updated_at')`;
  const m = Object.fromEntries(rows.map((r) => [r.key, r.value as string]));
  const lastPublishAt = m.last_publish_at ?? null;
  const contentUpdatedAt = m.content_updated_at ?? null;
  const dirty = !!contentUpdatedAt && (!lastPublishAt || Date.parse(contentUpdatedAt) > Date.parse(lastPublishAt));
  return { lastPublishAt, contentUpdatedAt, dirty };
}
