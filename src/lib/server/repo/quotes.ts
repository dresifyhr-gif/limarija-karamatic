import { randomBytes } from 'node:crypto';
import { db, num } from '../db';
import { HttpError } from '../http';
import type { QuoteInput } from '../schemas';
import { getSetting } from './settings';
import { getLead } from './leads';
import { computeTotals } from '@/lib/quote-math';
import type { QuoteItem, QuoteStatus } from '@/lib/types';

export type Quote = {
  id: number;
  number: string;
  year: number;
  seq: number;
  status: QuoteStatus;
  issueDate: string; // 'YYYY-MM-DD'
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  clientAddress: string;
  clientOib: string;
  location: string;
  title: string;
  intro: string;
  items: QuoteItem[];
  notes: string;
  paymentTerms: string;
  validDays: number;
  pdvEnabled: boolean;
  pdvRate: number;
  subtotal: number;
  pdvAmount: number;
  total: number;
  publicToken: string;
  leadId: number | null;
  sentAt: string | null;
  viewedAt: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
export type QuoteListItem = Pick<
  Quote,
  'id' | 'number' | 'status' | 'issueDate' | 'clientName' | 'location' | 'title' | 'total' | 'leadId' | 'createdAt' | 'updatedAt'
>;

const isoOrNull = (d: unknown) => (d ? new Date(d as string).toISOString() : null);
/** Neon driver vraća stupac tipa date kao Date (lokalna ponoć) — natrag u 'YYYY-MM-DD'. */
const dateOnly = (d: unknown): string =>
  d instanceof Date
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    : String(d).slice(0, 10);

const map = (r: Record<string, unknown>): Quote => ({
  id: r.id as number,
  number: r.number as string,
  year: r.year as number,
  seq: r.seq as number,
  status: r.status as QuoteStatus,
  issueDate: dateOnly(r.issue_date),
  clientName: r.client_name as string,
  clientPhone: r.client_phone as string,
  clientEmail: r.client_email as string,
  clientAddress: r.client_address as string,
  clientOib: r.client_oib as string,
  location: r.location as string,
  title: r.title as string,
  intro: r.intro as string,
  items: (r.items as QuoteItem[]) ?? [],
  notes: r.notes as string,
  paymentTerms: r.payment_terms as string,
  validDays: r.valid_days as number,
  pdvEnabled: !!r.pdv_enabled,
  pdvRate: num(r.pdv_rate),
  subtotal: num(r.subtotal),
  pdvAmount: num(r.pdv_amount),
  total: num(r.total),
  publicToken: r.public_token as string,
  leadId: (r.lead_id as number) ?? null,
  sentAt: isoOrNull(r.sent_at),
  viewedAt: isoOrNull(r.viewed_at),
  acceptedAt: isoOrNull(r.accepted_at),
  rejectedAt: isoOrNull(r.rejected_at),
  createdAt: isoOrNull(r.created_at)!,
  updatedAt: isoOrNull(r.updated_at)!,
});

/** Današnji datum i godina po zagrebačkom vremenu. */
function todayZagreb(): { date: string; year: number } {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zagreb' }).format(new Date()); // YYYY-MM-DD
  return { date, year: Number(date.slice(0, 4)) };
}

export async function listQuotes(opts: { status?: QuoteStatus; q?: string; limit?: number; offset?: number } = {}): Promise<QuoteListItem[]> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  const q = opts.q?.trim() ? `%${opts.q.trim().replace(/[%_\\]/g, (m) => '\\' + m)}%` : null;
  const rows = await db()`SELECT id, number, status, issue_date, client_name, location, title, total, lead_id, created_at, updated_at
    FROM quotes
    WHERE (${opts.status ?? null}::text IS NULL OR status = ${opts.status ?? null})
      AND (${q}::text IS NULL OR number ILIKE ${q} OR client_name ILIKE ${q} OR location ILIKE ${q} OR title ILIKE ${q})
    ORDER BY year DESC, seq DESC LIMIT ${limit} OFFSET ${offset}`;
  return rows.map((r) => {
    const m = map({ ...r, items: [] });
    return {
      id: m.id, number: m.number, status: m.status, issueDate: m.issueDate, clientName: m.clientName, location: m.location,
      title: m.title, total: m.total, leadId: m.leadId, createdAt: m.createdAt, updatedAt: m.updatedAt,
    };
  });
}

export async function countQuotesByStatus(): Promise<Record<QuoteStatus, number>> {
  const rows = await db()`SELECT status, count(*)::int AS n FROM quotes GROUP BY status`;
  const out: Record<QuoteStatus, number> = { nacrt: 0, poslana: 0, prihvacena: 0, odbijena: 0 };
  for (const r of rows) out[r.status as QuoteStatus] = r.n as number;
  return out;
}

export async function getQuote(id: number): Promise<Quote | null> {
  const rows = await db()`SELECT * FROM quotes WHERE id = ${id}`;
  return rows[0] ? map(rows[0]) : null;
}

/** Za javnu stranicu ponude (/ponuda/[token]). Token je 24 znaka base64url. */
export async function getQuoteByToken(token: string): Promise<Quote | null> {
  if (!/^[\w-]{24,64}$/.test(token)) return null;
  const rows = await db()`SELECT * FROM quotes WHERE public_token = ${token}`;
  return rows[0] ? map(rows[0]) : null;
}

/** Zabilježi prvo otvaranje javne stranice ponude. */
export async function markQuoteViewed(id: number): Promise<void> {
  await db()`UPDATE quotes SET viewed_at = now() WHERE id = ${id} AND viewed_at IS NULL`;
}

/**
 * Kao markQuoteViewed, ali vraća true SAMO prvi put (atomski: uvjet viewed_at IS NULL u istom UPDATE-u),
 * pa istodobna otvaranja ne mogu dvaput poslati obavijest "Klijent je otvorio ponudu".
 * viewed_at je trenutak PRVOG otvaranja (kasnija otvaranja ga ne mijenjaju).
 */
export async function markQuoteFirstViewed(id: number): Promise<boolean> {
  const rows = await db()`UPDATE quotes SET viewed_at = now() WHERE id = ${id} AND viewed_at IS NULL RETURNING id`;
  return rows.length > 0;
}

/** Prazne stavke (bez naziva, opisa i cijene) se ne spremaju — inače se ispišu kao "Stavka 0,00 €". */
export function dropEmptyItems(items: QuoteItem[]): QuoteItem[] {
  return items.filter((it) => it.type !== 'item' || !!it.title.trim() || !!it.description.trim() || !!it.unitPrice);
}

/** Poruka kad se pokuša mijenjati prihvaćena ponuda. */
export const LOCKED_MSG = 'Klijent je prihvatio ovu ponudu pa se više ne može mijenjati. Za izmjene napravite kopiju (Dupliciraj).';

/**
 * Nova ponuda (status 'nacrt'). Broj 'KR-YYYY-NNN' dodjeljuje se atomski (quote_counters, jedna SQL naredba).
 * Prazna polja popunjava iz postavki 'quote' (PDV, rok valjanosti, uvjeti plaćanja, napomene)
 * i, ako je zadan leadId, iz upita (ime, telefon, lokacija).
 */
export async function createQuote(input: Partial<QuoteInput> = {}): Promise<Quote> {
  const qs = await getSetting('quote');
  const lead = input.leadId ? await getLead(input.leadId) : null;
  if (input.leadId && !lead) throw new HttpError(400, 'Upit ne postoji.', { leadId: 'Upit ne postoji.' });
  const { date, year } = todayZagreb();
  const items = dropEmptyItems(input.items ?? []);
  const pdvEnabled = input.pdvEnabled ?? qs.pdvEnabled;
  const pdvRate = input.pdvRate ?? qs.pdvRate;
  const t = computeTotals(items, pdvEnabled, pdvRate);
  const token = randomBytes(18).toString('base64url'); // 24 znaka
  const rows = await db()`
    WITH c AS (
      INSERT INTO quote_counters (year, last_seq) VALUES (${year}, 1)
      ON CONFLICT (year) DO UPDATE SET last_seq = quote_counters.last_seq + 1
      RETURNING last_seq
    )
    INSERT INTO quotes (number, year, seq, status, issue_date, client_name, client_phone, client_email, client_address, client_oib,
      location, title, intro, items, notes, payment_terms, valid_days, pdv_enabled, pdv_rate, subtotal, pdv_amount, total,
      public_token, lead_id)
    SELECT 'KR-' || ${year}::int || '-' || lpad(c.last_seq::text, 3, '0'), ${year}, c.last_seq, 'nacrt', ${input.issueDate ?? date},
      ${input.clientName ?? lead?.name ?? ''}, ${input.clientPhone ?? lead?.phone ?? ''}, ${input.clientEmail ?? lead?.email ?? ''},
      ${input.clientAddress ?? ''}, ${input.clientOib ?? ''}, ${input.location ?? lead?.location ?? ''}, ${input.title ?? ''},
      ${input.intro ?? ''}, ${JSON.stringify(items)}::jsonb, ${input.notes ?? qs.notes}, ${input.paymentTerms ?? qs.paymentTerms},
      ${input.validDays ?? qs.validDays}, ${pdvEnabled}, ${pdvRate}, ${t.subtotal}, ${t.pdvAmount}, ${t.total},
      ${token}, ${input.leadId ?? null}
    FROM c RETURNING *`;
  return map(rows[0]);
}

const QCOLS: Record<string, string> = {
  issueDate: 'issue_date', clientName: 'client_name', clientPhone: 'client_phone', clientEmail: 'client_email',
  clientAddress: 'client_address', clientOib: 'client_oib', location: 'location', title: 'title', intro: 'intro',
  items: 'items', notes: 'notes', paymentTerms: 'payment_terms', validDays: 'valid_days', pdvEnabled: 'pdv_enabled',
  pdvRate: 'pdv_rate', leadId: 'lead_id',
};

/**
 * Djelomično ažuriranje; iznosi (subtotal/pdv/total) se UVIJEK ponovno računaju na serveru.
 * Prihvaćena ponuda je zaključana (409) — klijent je prihvatio točno te stavke i iznose.
 */
export async function updateQuote(id: number, patch: Partial<QuoteInput>): Promise<Quote> {
  const cur = await getQuote(id);
  if (!cur) throw new HttpError(404, 'Ponuda ne postoji.');
  if (cur.status === 'prihvacena') throw new HttpError(409, LOCKED_MSG);
  if (patch.items) patch = { ...patch, items: dropEmptyItems(patch.items) };
  const items = patch.items ?? cur.items;
  const pdvEnabled = patch.pdvEnabled ?? cur.pdvEnabled;
  const pdvRate = patch.pdvRate ?? cur.pdvRate;
  const t = computeTotals(items, pdvEnabled, pdvRate);
  const sets: string[] = [];
  const params: unknown[] = [id];
  for (const [k, val] of Object.entries(patch)) {
    if (val === undefined || !QCOLS[k]) continue;
    params.push(k === 'items' ? JSON.stringify(val) : val);
    sets.push(`${QCOLS[k]} = $${params.length}${k === 'items' ? '::jsonb' : ''}`);
  }
  params.push(t.subtotal, t.pdvAmount, t.total);
  sets.push(`subtotal = $${params.length - 2}`, `pdv_amount = $${params.length - 1}`, `total = $${params.length}`);
  // uvjet i u samom UPDATE-u: klijent je možda prihvatio ponudu između čitanja i spremanja
  const rows = await db().query(`UPDATE quotes SET ${sets.join(', ')}, updated_at = now() WHERE id = $1 AND status <> 'prihvacena' RETURNING *`, params);
  if (!rows.length) throw new HttpError(409, LOCKED_MSG);
  return map(rows[0] as Record<string, unknown>);
}

/**
 * Promjena statusa s vremenskim oznakama: poslana → sent_at (prvi put), prihvacena → accepted_at,
 * odbijena → rejected_at. Vraćanje na nacrt/poslana briše accepted_at (ponuda se ponovno može mijenjati i prihvatiti). Kad je ponuda poslana, povezani upit prelazi u 'ponuda_poslana' (ako je bio novo/u_obradi).
 */
export async function setQuoteStatus(id: number, status: QuoteStatus): Promise<Quote> {
  const rows = await db()`UPDATE quotes SET status = ${status},
      sent_at = CASE WHEN ${status} IN ('poslana','prihvacena','odbijena') THEN coalesce(sent_at, now()) ELSE sent_at END,
      accepted_at = CASE WHEN ${status} = 'prihvacena' THEN coalesce(accepted_at, now()) ELSE NULL END,
      rejected_at = CASE WHEN ${status} = 'odbijena' THEN now() WHEN ${status} = 'prihvacena' THEN NULL ELSE rejected_at END,
      updated_at = now()
    WHERE id = ${id} RETURNING *`;
  if (!rows.length) throw new HttpError(404, 'Ponuda ne postoji.');
  const q = map(rows[0]);
  if (status === 'poslana' && q.leadId) {
    await db()`UPDATE leads SET status = 'ponuda_poslana', updated_at = now() WHERE id = ${q.leadId} AND status IN ('novo','u_obradi')`;
  }
  return q;
}

/**
 * Klijent prihvaća ponudu s javne stranice. Uspijeva SAMO ako je ponuda u statusu 'poslana'
 * (uvjet je u samom UPDATE-u, pa istodobna izmjena/promjena statusa ne može proći). null = nije prihvaćena.
 */
export async function acceptQuoteByClient(id: number): Promise<Quote | null> {
  const rows = await db()`UPDATE quotes SET status = 'prihvacena', accepted_at = now(), rejected_at = NULL,
      sent_at = coalesce(sent_at, now()), updated_at = now()
    WHERE id = ${id} AND status = 'poslana' RETURNING *`;
  return rows[0] ? map(rows[0]) : null;
}

/** Kopija ponude s novim brojem, kao nacrt. */
export async function duplicateQuote(id: number): Promise<Quote> {
  const c = await getQuote(id);
  if (!c) throw new HttpError(404, 'Ponuda ne postoji.');
  return createQuote({
    clientName: c.clientName, clientPhone: c.clientPhone, clientEmail: c.clientEmail, clientAddress: c.clientAddress,
    clientOib: c.clientOib, location: c.location, title: c.title, intro: c.intro,
    items: c.items.map((it) => ({ ...it, id: randomBytes(4).toString('hex') })),
    notes: c.notes, paymentTerms: c.paymentTerms, validDays: c.validDays, pdvEnabled: c.pdvEnabled, pdvRate: c.pdvRate,
    leadId: c.leadId,
  });
}

/**
 * Briše ponudu. Ako je bila ZADNJA u godini i nikad nije poslana, brojač se vraća
 * (sljedeća ponuda dobiva isti broj — nema rupe zbog obrisanog nacrta).
 */
export async function deleteQuote(id: number): Promise<void> {
  const rows = await db()`DELETE FROM quotes WHERE id = ${id} RETURNING year, seq, sent_at`;
  if (!rows.length) throw new HttpError(404, 'Ponuda ne postoji.');
  const { year, seq, sent_at } = rows[0] as { year: number; seq: number; sent_at: unknown };
  if (!sent_at) {
    await db()`UPDATE quote_counters SET last_seq = (SELECT coalesce(max(seq), 0) FROM quotes WHERE year = ${year})
      WHERE year = ${year} AND last_seq = ${seq}`;
  }
}
