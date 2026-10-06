/**
 * Serverski pomoćnici za upite i ponude (samo za API rute i SSR stranice — ne uvoziti u <script>).
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { APIContext } from 'astro';
import { db, num } from '@/lib/server/db';
import { requireEnv } from '@/lib/server/env';
import type { QuoteStatus } from '@/lib/types';

/* ── potpis fotografija javne forme ──────────────────────────────────────── */

/**
 * Javna forma najprije učita fotografije (/api/upit/foto), a zatim pošalje upit (/api/upit) s popisom fotografija.
 * Potpis dokazuje da je fotografiju učitala naša ruta (ne može se podmetnuti tuđi ili adminov Blob URL).
 */
export function photoSig(url: string): string {
  return createHmac('sha256', requireEnv('SESSION_SECRET')).update(`lead-photo:${url}`).digest('base64url').slice(0, 32);
}
export function verifyPhotoSig(url: string, sig: unknown): boolean {
  if (typeof sig !== 'string' || sig.length !== 32) return false;
  const a = Buffer.from(photoSig(url));
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}

/* ── zaglavlja javnih ruta ───────────────────────────────────────────────── */

/** Zaglavlja za javne on-demand stranice/rute s tokenom u URL-u (noindex, bez keša, bez referera). */
export const PRIVATE_HEADERS: Record<string, string> = {
  'x-robots-tag': 'noindex, nofollow, noarchive',
  'cache-control': 'private, no-store',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
};

export function applyPrivateHeaders(headers: Headers): void {
  for (const [k, v] of Object.entries(PRIVATE_HEADERS)) headers.set(k, v);
}

/** Je li zahtjev s iste domene (Origin/Referer) — za JSON POST na javnim rutama. */
export function sameSite(ctx: Pick<APIContext, 'request' | 'url'>): boolean {
  const h = ctx.request.headers;
  if (h.get('sec-fetch-site') === 'cross-site') return false;
  let origin = h.get('origin');
  if (!origin) {
    try {
      origin = h.get('referer') ? new URL(h.get('referer')!).origin : null;
    } catch {
      return false; // neispravan Referer → odbij (403), ne 500
    }
  }
  if (!origin) return false;
  return origin === ctx.url.origin;
}

/* ── upiti ↔ ponude ──────────────────────────────────────────────────────── */

export type LeadQuote = { id: number; number: string; status: QuoteStatus; total: number; issueDate: string; title: string };

/** Ponude vezane uz upit (novije prvo). */
export async function quotesForLead(leadId: number): Promise<LeadQuote[]> {
  const rows = await db()`SELECT id, number, status, total, issue_date, title FROM quotes WHERE lead_id = ${leadId} ORDER BY year DESC, seq DESC`;
  return rows.map((r) => ({
    id: r.id as number,
    number: r.number as string,
    status: r.status as QuoteStatus,
    total: num(r.total),
    issueDate:
      r.issue_date instanceof Date
        ? `${r.issue_date.getFullYear()}-${String(r.issue_date.getMonth() + 1).padStart(2, '0')}-${String(r.issue_date.getDate()).padStart(2, '0')}`
        : String(r.issue_date).slice(0, 10),
    title: r.title as string,
  }));
}

/** Zbroj iznosa i broj ponuda po statusu (za popis ponuda). */
export async function quoteSums(): Promise<Record<QuoteStatus, { n: number; total: number }>> {
  const rows = await db()`SELECT status, count(*)::int AS n, coalesce(sum(total), 0) AS total FROM quotes GROUP BY status`;
  const out: Record<QuoteStatus, { n: number; total: number }> = {
    nacrt: { n: 0, total: 0 },
    poslana: { n: 0, total: 0 },
    prihvacena: { n: 0, total: 0 },
    odbijena: { n: 0, total: 0 },
  };
  for (const r of rows) out[r.status as QuoteStatus] = { n: r.n as number, total: num(r.total) };
  return out;
}
