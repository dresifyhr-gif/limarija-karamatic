/**
 * Pomoćnici za upite i ponude koji rade i u pregledniku i na serveru (bez ovisnosti o Node-u).
 * Koriste ih admin (uređivač ponude, upiti), javna stranica ponude (/ponuda/[token]) i PDF.
 */
import { computeTotals, formatEur, formatQty } from '@/lib/quote-math';
import type { QuoteItem } from '@/lib/types';

/* ── jedinice ────────────────────────────────────────────────────────────── */

/** Jedinice koje admin nudi u padajućem popisu (slobodan tekst do 12 znakova je također dopušten). */
export const UNIT_OPTIONS = ['m²', "m'", 'kom', 'paušal', 'h', 'm', 'kg', 'set'] as const;
export const UNIT_HINT: Record<string, string> = {
  'm²': 'četvorni metar',
  "m'": 'dužni metar',
  kom: 'komad',
  'paušal': 'ukupno',
  h: 'sat rada',
};
/** Prijedlozi naslova odjeljaka. */
export const SECTION_PRESETS = ['Materijal', 'Rad'] as const;

/* ── upiti ───────────────────────────────────────────────────────────────── */

/** Broj upita kakav vidi klijent na /hvala i u WhatsApp poruci ('0017' → "#U-0017"; ponude imaju "KR-2026-001"). */
export const leadNumber = (id: number) => String(id).padStart(4, '0');

/* ── datumi ──────────────────────────────────────────────────────────────── */

const pad2 = (n: number) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' → '6. 10. 2026.' (bez vremenske zone; datum je kalendarski) */
export function formatDay(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return '';
  return `${d}. ${m}. ${y}.`;
}

/** 'YYYY-MM-DD' + n dana → 'YYYY-MM-DD' */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())}`;
}

/** Danas po zagrebačkom vremenu, 'YYYY-MM-DD'. */
export function todayZagreb(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zagreb' }).format(new Date());
}

/** Ponuda vrijedi do (uključivo). */
export const validUntil = (issueDate: string, validDays: number) => addDays(issueDate, validDays);
/** Je li rok valjanosti prošao (zagrebački datum). */
export const isExpired = (issueDate: string, validDays: number, today = todayZagreb()) => validUntil(issueDate, validDays) < today;

/** ISO vrijeme → '6. 10. 2026. u 14:05' (Europe/Zagreb) */
export function formatMoment(iso: string | null | undefined): string {
  if (!iso) return '';
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('hr-HR', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Europe/Zagreb',
    })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return `${Number(p.day)}. ${Number(p.month)}. ${p.year}. u ${p.hour}:${p.minute}`;
}

/* ── stavke po odjeljcima ────────────────────────────────────────────────── */

export type ItemRow = Extract<QuoteItem, { type: 'item' }> & { n: number; amount: number };
export type ItemGroup = { title: string | null; rows: ItemRow[]; subtotal: number };

/**
 * Stavke grupirane po odjeljcima (naslov null = stavke prije prvog odjeljka).
 * Redni broj stavke (n) teče kroz cijelu ponudu. Prazni odjeljci se preskaču.
 */
export function groupItems(items: QuoteItem[], pdvEnabled = false, pdvRate = 0): { groups: ItemGroup[]; hasSections: boolean; hasDiscount: boolean } {
  const { lines } = computeTotals(items, pdvEnabled, pdvRate);
  const groups: ItemGroup[] = [];
  let cur: ItemGroup = { title: null, rows: [], subtotal: 0 };
  let n = 0;
  let hasDiscount = false;
  for (const it of items) {
    if (it.type === 'section') {
      if (cur.rows.length || cur.title !== null) groups.push(cur);
      cur = { title: it.title.trim() || 'Odjeljak', rows: [], subtotal: 0 };
      continue;
    }
    n++;
    const amount = lines[it.id] ?? 0;
    if (it.discount && it.discount > 0) hasDiscount = true;
    cur.rows.push({ ...it, n, amount });
    cur.subtotal += amount;
  }
  groups.push(cur);
  const out = groups
    .filter((g) => g.rows.length > 0)
    .map((g) => ({ ...g, subtotal: Math.round(g.subtotal * 100) / 100 }));
  return { groups: out, hasSections: out.some((g) => g.title !== null), hasDiscount };
}

/** '12,5 m²' */
export const qtyWithUnit = (qty: number, unit: string) => `${formatQty(qty)}${unit ? ` ${unit}` : ''}`;
/** '25 %' (hrvatski: razmak prije %) */
export const formatPercent = (n: number) => `${formatQty(n)} %`;
export { formatEur, formatQty };

/* ── WhatsApp ────────────────────────────────────────────────────────────── */

/**
 * Broj za wa.me (samo znamenke, s pozivnim brojem). Hrvatski brojevi bez pozivnog dobivaju 385:
 * '091 234 5678' → '385912345678', '+385 98 958 8171' → '385989588171', '0049…' → '49…'. Prazno ako nema broja.
 */
export function waNumber(phone: string | null | undefined): string {
  let d = String(phone ?? '').replace(/[^\d+]/g, '');
  if (!d) return '';
  if (d.startsWith('+')) d = d.slice(1);
  else if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = '385' + d.slice(1);
  d = d.replace(/\D/g, '');
  return d.length >= 8 && d.length <= 15 ? d : '';
}

/** https://wa.me/<broj>?text=… (bez broja: korisnik sam bira kontakt) */
export function waLink(phone: string | null | undefined, text: string): string {
  const n = waNumber(phone);
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}

/** Poruka uz ponudu za WhatsApp (formalno, kratko; poveznica na javnu stranicu ponude). */
export function quoteWhatsAppText(q: { number: string; clientName: string; title: string; total: number }, link: string, company = 'Limarija Karamatić'): string {
  const name = q.clientName.trim();
  const greet = name ? `Poštovani/a ${name},` : 'Poštovani,';
  const what = q.title.trim() ? ` za ${q.title.trim().replace(/[.\s]+$/, '')}` : '';
  return [
    greet,
    '',
    `šaljemo Vam ponudu ${q.number}${what}.`,
    `Ponudu možete pregledati, preuzeti kao PDF i potvrditi na poveznici:`,
    link,
    '',
    `Za sva pitanja slobodno se javite.`,
    `Lijep pozdrav,`,
    company,
  ].join('\n');
}

/** Poruka klijentu iz upita (prvi kontakt). */
export function leadWhatsAppText(name: string, no: string, company = 'Limarija Karamatić'): string {
  const n = name.trim();
  return `${n ? `Poštovani/a ${n}, ` : 'Poštovani, '}javljamo se iz tvrtke ${company} vezano uz Vaš upit #U-${no}.`;
}

/* ── podaci tvrtke ───────────────────────────────────────────────────────── */

/** Zbroj iznosa (npr. za popise). */
export const sumTotals = (rows: { total: number }[]) => Math.round(rows.reduce((s, r) => s + (Number(r.total) || 0), 0) * 100) / 100;

/** IBAN u skupinama po 4 ('HR1234567890…' → 'HR12 3456 7890 …'). */
export const formatIban = (iban: string) => iban.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();

/** Hrvatska množina: pluralHr(1,'ponuda','ponude','ponuda') → 'ponuda', 3 → 'ponude', 5 → 'ponuda'. */
export function pluralHr(n: number, one: string, few: string, many: string): string {
  const d = n % 10;
  const h = n % 100;
  if (d === 1 && h !== 11) return one;
  if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return few;
  return many;
}
