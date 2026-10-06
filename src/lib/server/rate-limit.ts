/**
 * Ograničavanje učestalosti preko tablice rate_events (radi na više serverless instanci).
 * Ključ je uvijek HMAC hash (nikad sirova IP adresa).
 *
 *   const key = clientKey(ctx);                                   // HMAC(SESSION_SECRET, ip ili IPv6 /64)
 *   const r = await hit('upit', key, 3600, 5);                    // ATOMSKI: zabilježi pa prebroji
 *   if (!r.ok) throw new HttpError(429, `… za ${r.retryMin} min`);
 *
 * Zašto atomski: "prebroji pa zabilježi" propušta paralelne zahtjeve (25 istodobnih pokušaja svi vide 0).
 * hit() u jednoj transakciji uzme savjetodavni zaključ (pg_advisory_xact_lock) za par bucket+ključ,
 * upiše događaj i tek onda broji → istodobni zahtjevi se poredaju i svaki vidi prethodne.
 */
import { createHmac } from 'node:crypto';
import type { APIContext } from 'astro';
import { db } from './db';
import { requireEnv } from './env';

/** IPv6 → prefiks /64 (jedna osoba obično ima cijeli /64 blok); IPv4-mapped → IPv4. */
export function normalizeIp(raw: string): string {
  let ip = raw.trim().replace(/^\[|\]$/g, '').split('%')[0];
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped) return mapped[1];
  if (!ip.includes(':')) return ip;
  // proširi "::" i uzmi prva 4 hekstata
  const [head, tail = ''] = ip.toLowerCase().split('::');
  const h = head ? head.split(':') : [];
  const t = ip.includes('::') && tail ? tail.split(':') : [];
  const groups = ip.includes('::') ? [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t] : h;
  return groups.slice(0, 4).map((g) => (g || '0').replace(/^0+(?=.)/, '')).join(':') + '::/64';
}

/**
 * IP klijenta → HMAC hash (32 hex).
 * Zaglavljima x-real-ip / x-forwarded-for vjerujemo SAMO na Vercelu (tamo ih postavlja Vercelov proxy);
 * drugdje (lokalno, drugi hosting) klijent ih može lažirati, pa se koristi adresa veze (clientAddress).
 */
export function clientKey(ctx: Pick<APIContext, 'request' | 'clientAddress'>): string {
  const h = ctx.request.headers;
  let ip = '';
  if (process.env.VERCEL) ip = h.get('x-real-ip') || h.get('x-forwarded-for')?.split(',')[0]?.trim() || '';
  if (!ip) {
    try {
      ip = ctx.clientAddress;
    } catch {
      ip = 'unknown';
    }
  }
  return createHmac('sha256', requireEnv('SESSION_SECRET')).update(`ip:${normalizeIp(ip || 'unknown')}`).digest('hex').slice(0, 32);
}

export type HitResult = { ok: boolean; count: number; retryMin: number };

/**
 * Atomski zabilježi događaj i provjeri ograničenje.
 * ok=false kad je s ovim događajem prekoračeno `limit` događaja u zadnjih `windowSec` sekundi.
 * (Odbijeni pokušaji se također broje — tko nastavi slati, ostaje blokiran.)
 */
export async function hit(bucket: string, keyHash: string, windowSec: number, limit: number): Promise<HitResult> {
  const lockKey = `${bucket}:${keyHash}`;
  const res = await db().transaction((sql) => [
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`,
    sql`INSERT INTO rate_events (bucket, key_hash) VALUES (${bucket}, ${keyHash})`,
    sql`SELECT count(*)::int AS n,
               GREATEST(1, EXTRACT(EPOCH FROM (min(ts) + make_interval(secs => ${windowSec}) - now())))::int AS s
          FROM rate_events
         WHERE bucket = ${bucket} AND key_hash = ${keyHash} AND ts > now() - make_interval(secs => ${windowSec})`,
  ]);
  const row = (res[2] as Array<{ n: number; s: number }>)[0] ?? { n: 1, s: windowSec };
  // povremeno čišćenje starih zapisa (~5 % poziva)
  if (Math.random() < 0.05) await db()`DELETE FROM rate_events WHERE ts < now() - interval '2 days'`;
  const count = Number(row.n) || 1;
  return { ok: count <= limit, count, retryMin: Math.max(1, Math.ceil((Number(row.s) || windowSec) / 60)) };
}

/** Koliko je događaja u prozoru (samo za prikaz/provjeru — za ograničavanje koristi hit()). */
export async function countRecent(bucket: string, keyHash: string, windowSec: number): Promise<number> {
  const rows = await db()`SELECT count(*)::int AS n FROM rate_events
    WHERE bucket = ${bucket} AND key_hash = ${keyHash} AND ts > now() - make_interval(secs => ${windowSec})`;
  return Number(rows[0]?.n ?? 0);
}

export async function clearEvents(bucket: string, keyHash: string): Promise<void> {
  await db()`DELETE FROM rate_events WHERE bucket = ${bucket} AND key_hash = ${keyHash}`;
}

/** Ukloni jedan (najnoviji) događaj — npr. kad se pokušaj pokaže valjanim i ne treba se brojati. */
export async function forgetOne(bucket: string, keyHash: string): Promise<void> {
  await db()`DELETE FROM rate_events WHERE id = (
    SELECT id FROM rate_events WHERE bucket = ${bucket} AND key_hash = ${keyHash} ORDER BY ts DESC LIMIT 1)`;
}
