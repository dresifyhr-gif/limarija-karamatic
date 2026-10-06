/**
 * Izračun ponude — JEDINI izvor istine za iznose (server ga koristi pri spremanju, admin UI za prikaz,
 * PDF i javna stranica za ispis). Bez ovisnosti, radi i u pregledniku.
 *
 * Pravila: iznos stavke = round2(qty × unitPrice × (1 − popust/100)); osnovica = zbroj stavki;
 * PDV = round2(osnovica × stopa / 100) (0 kad pdvEnabled=false); ukupno = osnovica + PDV.
 * Zaokruživanje: na cent, polovica od nule (kao HR računi).
 */
import type { QuoteItem, QuoteTotals } from './types';

/**
 * Na cent, polovica od nule. Množenje s 100 u binarnom zarezu daje npr. 7561,499999999999 umjesto 7561,5
 * (302,46 × 0,25) — zato se umnožak prvo svede na 15 značajnih znamenki (uklanja grešku zapisa), pa tek onda zaokružuje.
 */
export function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const cents = Number((Math.abs(n) * 100).toPrecision(15));
  return ((Math.sign(n) || 1) * Math.round(cents)) / 100;
}

export function computeTotals(items: QuoteItem[], pdvEnabled: boolean, pdvRate: number): QuoteTotals {
  const lines: Record<string, number> = {};
  let subtotal = 0;
  for (const it of items) {
    if (it.type !== 'item') continue;
    const d = it.discount && it.discount > 0 ? Math.min(it.discount, 100) : 0;
    const amount = round2((it.qty * it.unitPrice * (100 - d)) / 100);
    lines[it.id] = amount;
    subtotal += amount;
  }
  subtotal = round2(subtotal);
  const pdvAmount = pdvEnabled ? round2((subtotal * pdvRate) / 100) : 0;
  return { lines, subtotal, pdvAmount, total: round2(subtotal + pdvAmount) };
}

const eur = new Intl.NumberFormat('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qtyFmt = new Intl.NumberFormat('hr-HR', { maximumFractionDigits: 3 });

/** '1.234,50 €' (hrvatski format; točka kao razdjelnik tisućica) */
export function formatEur(n: number): string {
  return `${eur.format(n)} €`;
}
/** '12,5' */
export function formatQty(n: number): string {
  return qtyFmt.format(n);
}
/** 'KR-2026-007' */
export function formatQuoteNumber(year: number, seq: number): string {
  return `KR-${year}-${String(seq).padStart(3, '0')}`;
}
