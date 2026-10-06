/**
 * Neon Postgres (HTTP driver) — lijeni klijent, bez Proxyja.
 *
 *   import { db } from '@/lib/server/db';
 *   const rows = await db()`SELECT * FROM faq WHERE id = ${id}`;          // tagged template, parametri su sigurni
 *   const rows = await db().query('SELECT * FROM faq WHERE id = $1', [id]); // ručni SQL s $1…
 *   await db().transaction((sql) => [sql`UPDATE …`, sql`INSERT …`]);        // ne-interaktivna transakcija
 *
 * Tipovi koje vraća driver: integer → number, numeric → string (pretvori s Number()),
 * timestamptz → Date, date → string 'YYYY-MM-DD', jsonb → objekt.
 */
import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import { env } from './env';

let client: NeonQueryFunction<false, false> | null = null;

export function hasDatabase(): boolean {
  return !!env('DATABASE_URL');
}

export function db(): NeonQueryFunction<false, false> {
  if (!client) {
    const url = env('DATABASE_URL');
    if (!url) throw new Error('Baza nije konfigurirana (nedostaje DATABASE_URL)');
    client = neon(url);
  }
  return client;
}

/** Prvi red ili null. */
export async function one<T = Record<string, unknown>>(rows: Promise<unknown[]> | unknown[]): Promise<T | null> {
  const r = (await rows) as T[];
  return r[0] ?? null;
}

/** numeric/bigint string → number (null ostaje null) */
export const num = (v: unknown): number => (v == null ? 0 : Number(v));
