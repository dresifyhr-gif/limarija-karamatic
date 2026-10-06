/**
 * PDF ponude (A4) — pdf-lib + @pdf-lib/fontkit, fontovi su ugrađeni (Archivo + IBM Plex Mono, OFL; Č Ć Đ Š Ž).
 *
 *   const bytes = await renderQuotePdf(quote, settings);   // Uint8Array
 *
 * Izgled: zaglavlje s vektorskim KARAMATIĆ znakom (crveni Λ), "sastavnica" (blok kao na tehničkom crtežu:
 * broj, datum, rok, iznos), naručitelj / gradilište / izvođač, tablica stavki (zaglavlje tablice se ponavlja
 * na svakoj stranici), zbroj (osnovica, PDV, ukupno), napomene, uvjeti, potpisi. Podnožje: tvrtka + "Stranica x / n".
 * Crvena je samo u znaku (Λ). Prazni podaci tvrtke se ne ispisuju.
 *
 * Fontovi su uvezeni kao base64 (Vite `?inline`), pa rade i u Vercel funkciji bez čitanja datoteka.
 */
import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { computeTotals } from '@/lib/quote-math';
import { PDV_EXEMPT_NOTE, type SettingsMap } from '@/lib/types';
import type { Quote } from '@/lib/server/repo/quotes';
import { formatDay, formatEur, formatMoment, formatPercent, formatQty, formatIban, groupItems, validUntil } from './shared';

import archivoRegular from './fonts/Archivo-Regular.ttf?inline';
import archivoSemi from './fonts/Archivo-SemiBold.ttf?inline';
import archivoXBold from './fonts/Archivo-ExpandedBold.ttf?inline';
import archivoXBlack from './fonts/Archivo-ExpandedBlack.ttf?inline';
import plexRegular from './fonts/IBMPlexMono-Regular.ttf?inline';
import plexMedium from './fonts/IBMPlexMono-Medium.ttf?inline';

/* ── fontovi ─────────────────────────────────────────────────────────────── */

const fontCache = new Map<string, Uint8Array>();
function bytesOf(dataUrl: string): Uint8Array {
  let b = fontCache.get(dataUrl);
  if (!b) {
    b = new Uint8Array(Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64'));
    fontCache.set(dataUrl, b);
  }
  return b;
}

type Fonts = { reg: PDFFont; semi: PDFFont; xbold: PDFFont; black: PDFFont; mono: PDFFont; monoMed: PDFFont };

/* ── mjere i boje ────────────────────────────────────────────────────────── */

const W = 595.28;
const H = 841.89;
const ML = 50;
const MR = 50;
const CW = W - ML - MR; // širina sadržaja
const TOP = 48;
const FOOT = 58; // rezervirano dolje za podnožje
const BOTTOM = FOOT + 10;

const hex = (h: string): RGB => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const C = {
  ink: hex('#15181B'),
  ink2: hex('#383E42'),
  muted: hex('#5E666C'),
  faint: hex('#8A939B'),
  line: hex('#D5DBDF'),
  rule: hex('#15181B'),
  band: hex('#F2F1EC'),
  red: hex('#D7141A'),
};

/* Λ iz loga (Logo.astro): jedinice fonta, 1000 upm; y = 688 je pismovna linija, vrh je 10 jedinica iznad verzala */
const LAMBDA = 'M8 688 477-10 946 688H661L477 236 293 688Z';

/* ── tekst ───────────────────────────────────────────────────────────────── */

/** Ukloni znakove koje font nema (inače bi PDF prikazao prazan kvadratić). */
function clean(font: PDFFont, s: string): string {
  const set = charSets.get(font) ?? new Set(font.getCharacterSet());
  charSets.set(font, set);
  let out = '';
  for (const ch of s.normalize('NFC').replace(/[   ]/g, ' ').replace(/\t/g, '  ')) {
    const cp = ch.codePointAt(0)!;
    if (cp < 32) continue;
    out += set.has(cp) ? ch : ch === '−' ? '-' : '?';
  }
  return out;
}
const charSets = new Map<PDFFont, Set<number>>();

/** Prelomi tekst u retke zadane širine (poštuje nove retke; predugačke riječi lomi po znakovima). */
function wrap(font: PDFFont, size: number, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.replace(/\r\n?/g, '\n').split('\n').map((p) => clean(font, p))) {
    const words = para.split(/ +/);
    let line = '';
    for (let w of words) {
      const tryLine = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(tryLine, size) <= maxW) {
        line = tryLine;
        continue;
      }
      if (line) out.push(line);
      // riječ duža od retka
      while (font.widthOfTextAtSize(w, size) > maxW && w.length > 1) {
        let i = w.length - 1;
        while (i > 1 && font.widthOfTextAtSize(w.slice(0, i), size) > maxW) i--;
        out.push(w.slice(0, i));
        w = w.slice(i);
      }
      line = w;
    }
    out.push(line);
  }
  // bez praznih redaka na kraju
  while (out.length > 1 && out[out.length - 1] === '') out.pop();
  return out;
}

/** Tekst s razmakom između slova (tracking u em). */
function drawTracked(page: PDFPage, text: string, x: number, y: number, font: PDFFont, size: number, tracking: number, color: RGB) {
  let cx = x;
  for (const ch of clean(font, text)) {
    page.drawText(ch, { x: cx, y, size, font, color });
    cx += font.widthOfTextAtSize(ch, size) + tracking * size;
  }
  return cx - tracking * size - x;
}
function trackedWidth(text: string, font: PDFFont, size: number, tracking: number) {
  const t = clean(font, text);
  return font.widthOfTextAtSize(t, size) + Math.max(0, [...t].length - 1) * tracking * size;
}

/* ── znak KARAMATIĆ ──────────────────────────────────────────────────────── */

/** Puni znak: "LIMARIJA" između suženih linija + KARΛMATIĆ. (x, y) = lijevo, pismovna linija riječi. Vraća širinu. */
function drawWordmark(page: PDFPage, f: Fonts, x: number, baseline: number, size: number): { width: number; top: number } {
  const kar = 'KAR';
  const mat = 'MATIĆ';
  const wKar = f.black.widthOfTextAtSize(kar, size);
  const wLam = 0.954 * size;
  const wMat = f.black.widthOfTextAtSize(mat, size);
  const width = wKar + wLam + wMat;
  page.drawText(kar, { x, y: baseline, size, font: f.black, color: C.ink });
  page.drawSvgPath(LAMBDA, { x: x + wKar, y: baseline + 0.688 * size, scale: size / 1000, color: C.red });
  page.drawText(mat, { x: x + wKar + wLam, y: baseline, size, font: f.black, color: C.ink });

  // gornji red: sužene linije + LIMARIJA (kao Logo.astro: 0,355 em, razmak slova 0,46 em, razmak 0,3 em)
  const sub = 0.355 * size;
  const rowBase = baseline + 0.688 * size + 0.25 * size; // pismovna linija gornjeg reda (iznad kvačice na Ć)
  const subW = trackedWidth('LIMARIJA', f.xbold, sub, 0.46);
  const left = x + 0.074 * size;
  const right = x + width - 0.045 * size;
  const gap = 0.3 * size;
  const ruleW = (right - left - subW - 2 * gap) / 2;
  const mid = rowBase + 0.688 * sub * 0.5;
  const th = Math.max(0.075 * size, 1.1) / 2;
  if (ruleW > 4) {
    // lijeva: šiljak lijevo; desna: šiljak desno
    page.drawSvgPath(`M0 0 L${ruleW} ${-th} L${ruleW} ${th} Z`, { x: left, y: mid, color: C.ink });
    page.drawSvgPath(`M0 ${-th} L${ruleW} 0 L0 ${th} Z`, { x: right - ruleW, y: mid, color: C.ink });
  }
  drawTracked(page, 'LIMARIJA', left + ruleW + gap, rowBase, f.xbold, sub, 0.46, C.ink);
  return { width, top: rowBase + 0.688 * sub };
}

/* ── izgled stranice ─────────────────────────────────────────────────────── */

type Ctx = {
  pdf: PDFDocument;
  f: Fonts;
  q: Quote;
  s: SettingsMap;
  page: PDFPage;
  y: number; // trenutna visina (odozgo prema dolje: y se smanjuje)
  pages: PDFPage[];
  tableCols: Col[] | null; // kad je tablica u tijeku: zaglavlje se ponavlja na novoj stranici
};

type Col = { key: string; label: string; w: number; align: 'left' | 'right' };

function hline(page: PDFPage, x1: number, x2: number, y: number, thickness = 0.5, color: RGB = C.line) {
  page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color });
}
function vline(page: PDFPage, x: number, y1: number, y2: number, thickness = 0.5, color: RGB = C.line) {
  page.drawLine({ start: { x, y: y1 }, end: { x, y: y2 }, thickness, color });
}

function text(page: PDFPage, s: string, x: number, y: number, font: PDFFont, size: number, color: RGB = C.ink, align: 'left' | 'right' = 'left', w = 0) {
  const t = clean(font, s);
  const dx = align === 'right' ? w - font.widthOfTextAtSize(t, size) : 0;
  page.drawText(t, { x: x + dx, y, size, font, color });
}

/** Mono oznaka velikim slovima (kao .eyebrow na stranici). */
function label(page: PDFPage, f: Fonts, s: string, x: number, y: number, color: RGB = C.muted, size = 6.4) {
  drawTracked(page, s.toUpperCase(), x, y, f.monoMed, size, 0.08, color);
}

function companyContact(s: SettingsMap) {
  const co = s.company;
  const phone = co.telefon || s.contact.phoneDisplay;
  const email = co.email || s.contact.email;
  return { name: co.naziv || s.contact.name, phone, email, web: co.web };
}

/** Prva stranica: znak + kontakt desno. */
function drawLetterhead(c: Ctx) {
  const { page, f, s } = c;
  const size = 21;
  const baseline = H - TOP - 26;
  drawWordmark(page, f, ML, baseline, size);
  const k = companyContact(s);
  const lines = [k.phone, k.email, k.web].filter(Boolean);
  let y = H - TOP - 6;
  for (const l of lines) {
    text(page, l, ML, y, f.mono, 7.6, C.ink2, 'right', CW);
    y -= 11;
  }
  const ruleY = baseline - 16;
  hline(page, ML, W - MR, ruleY, 0.9, C.rule);
  c.y = ruleY - 22;
}

/** Nastavak (stranica 2+): mali znak, broj ponude, crta. */
function drawContinuationHead(c: Ctx) {
  const { page, f, q } = c;
  const baseline = H - TOP - 10;
  drawWordmark(page, f, ML, baseline, 11);
  text(page, `Ponuda ${q.number}`, ML, baseline + 0.5, f.monoMed, 7.6, C.ink2, 'right', CW);
  const ruleY = baseline - 12;
  hline(page, ML, W - MR, ruleY, 0.9, C.rule);
  c.y = ruleY - 18;
}

function newPage(c: Ctx) {
  c.page = c.pdf.addPage([W, H]);
  c.pages.push(c.page);
  drawContinuationHead(c);
  if (c.tableCols) drawTableHead(c, c.tableCols);
}

/** Osiguraj prostor; inače nova stranica. */
function ensure(c: Ctx, h: number) {
  if (c.y - h < BOTTOM) newPage(c);
}

/* ── sastavnica (blok kao na nacrtu) ─────────────────────────────────────── */

function drawTitleBlock(c: Ctx, totals: { total: number }) {
  const { page, f, q } = c;
  const top = c.y;
  const leftW = CW * 0.52;
  const title = q.title.trim() || 'Ponuda za limarske radove';
  let tl = wrap(f.xbold, 14.5, title, leftW - 24);
  if (tl.length > 3) {
    tl = tl.slice(0, 3);
    let last = tl[2];
    while (last.length > 1 && f.xbold.widthOfTextAtSize(last + '…', 14.5) > leftW - 24) last = last.slice(0, -1).trimEnd();
    tl[2] = last + '…';
  }
  const hasLoc = !!q.location.trim();
  const h = Math.max(86, 30 + tl.length * 17.5 + (hasLoc ? 30 : 12));
  const cellW = (CW - leftW) / 2;
  const x0 = ML;
  const y0 = top - h;
  // okvir
  page.drawRectangle({ x: x0, y: y0, width: CW, height: h, borderColor: C.rule, borderWidth: 0.9 });
  vline(page, x0 + leftW, y0, top, 0.9, C.rule);
  vline(page, x0 + leftW + cellW, y0, top, 0.5, C.line);
  hline(page, x0 + leftW, x0 + CW, y0 + h / 2, 0.5, C.line);

  // lijevo: PONUDA + predmet
  label(page, f, 'Ponuda', x0 + 12, top - 17);
  let ty = top - 38;
  for (const l of tl) {
    text(page, l, x0 + 12, ty, f.xbold, 14.5, C.ink);
    ty -= 17.5;
  }
  if (hasLoc) {
    // gradilište u dnu lijevog polja (jedan redak)
    label(page, f, 'Gradilište', x0 + 12, y0 + 13.5);
    const lx = x0 + 12 + trackedWidth('GRADILIŠTE', f.monoMed, 6.4, 0.08) + 10;
    let loc = clean(f.reg, q.location.trim().replace(/\s+/g, ' '));
    const maxW = x0 + leftW - 12 - lx;
    while (loc.length > 4 && f.reg.widthOfTextAtSize(loc, 8.8) > maxW) loc = loc.slice(0, -2).trimEnd() + '…';
    text(page, loc, lx, y0 + 13, f.reg, 8.8, C.ink2);
  }

  // desno: 2 × 2 polja
  const cells: [string, string, boolean][] = [
    ['Broj', q.number, false],
    ['Datum', formatDay(q.issueDate), false],
    ['Vrijedi do', formatDay(validUntil(q.issueDate, q.validDays)), false],
    [q.pdvEnabled ? 'Ukupno s PDV-om' : 'Ukupno', formatEur(totals.total), true],
  ];
  cells.forEach(([lab, val, strong], i) => {
    const cx = x0 + leftW + (i % 2) * cellW + 10;
    const cy = top - (i < 2 ? 0 : h / 2);
    label(page, f, lab, cx, cy - 15);
    text(page, val, cx, cy - 32, strong ? f.monoMed : f.mono, strong ? 10.2 : 9.6, C.ink);
  });
  c.y = y0 - 22;
}

/* ── naručitelj / gradilište / izvođač ───────────────────────────────────── */

function drawParties(c: Ctx) {
  const { page, f, q, s } = c;
  const co = s.company;
  const k = companyContact(s);
  const cols: { label: string; head: string; lines: string[] }[] = [];
  const client = [q.clientAddress, q.clientOib && `OIB: ${q.clientOib}`, q.clientPhone, q.clientEmail].filter(Boolean) as string[];
  cols.push({ label: 'Naručitelj', head: q.clientName.trim() || '—', lines: client });
  const contractor = [
    co.adresa,
    co.oib && `OIB: ${co.oib}`,
    co.iban && `IBAN: ${formatIban(co.iban)}`,
    co.banka,
    !co.naziv && k.phone,
  ].filter(Boolean) as string[];
  cols.push({ label: 'Izvođač', head: k.name, lines: contractor });

  const gap = 40;
  const colW = (CW - gap * (cols.length - 1)) / cols.length;
  let maxH = 0;
  const startY = c.y;
  cols.forEach((col, i) => {
    const x = ML + i * (colW + gap);
    let y = startY;
    label(page, f, col.label, x, y);
    y -= 15;
    if (col.head) {
      for (const l of wrap(f.semi, 9.8, col.head, colW)) {
        text(page, l, x, y, f.semi, 9.8, C.ink);
        y -= 12.5;
      }
    }
    for (const line of col.lines) {
      for (const l of wrap(f.reg, 8.6, line, colW)) {
        text(page, l, x, y, f.reg, 8.6, C.ink2);
        y -= 11.6;
      }
    }
    maxH = Math.max(maxH, startY - y);
  });
  c.y = startY - maxH - 12;
}

/* ── uvod ────────────────────────────────────────────────────────────────── */

function drawParagraphs(c: Ctx, body: string, opts: { size?: number; lead?: number; color?: RGB; font?: PDFFont; width?: number; x?: number } = {}) {
  const { size = 9.2, lead = 13.6, color = C.ink2, font = c.f.reg, width = CW, x = ML } = opts;
  for (const l of wrap(font, size, body, width)) {
    ensure(c, lead);
    text(c.page, l, x, c.y, font, size, color);
    c.y -= lead;
  }
}

/* ── tablica stavki ──────────────────────────────────────────────────────── */

function drawTableHead(c: Ctx, cols: Col[]) {
  const { page, f } = c;
  const hgt = 20;
  const top = c.y;
  page.drawRectangle({ x: ML, y: top - hgt, width: CW, height: hgt, color: C.band });
  hline(page, ML, W - MR, top - hgt, 0.9, C.rule);
  let x = ML;
  for (const col of cols) {
    const lw = trackedWidth(col.label.toUpperCase(), f.monoMed, 6.2, 0.08);
    const lx = col.align === 'right' ? x + col.w - 6 - lw : x + 6;
    label(page, f, col.label, lx, top - 13.2, C.ink2, 6.2);
    x += col.w;
  }
  c.y = top - hgt;
}

function drawItems(c: Ctx) {
  const { f, q } = c;
  const { groups, hasSections, hasDiscount } = groupItems(q.items, q.pdvEnabled, q.pdvRate);
  if (!groups.length) return;
  const fixed: Col[] = [
    { key: 'n', label: 'Rb.', w: 26, align: 'left' },
    { key: 'desc', label: 'Opis', w: 0, align: 'left' },
    { key: 'qty', label: 'Količina', w: 66, align: 'right' },
    { key: 'price', label: 'Jed. cijena', w: 70, align: 'right' },
    ...(hasDiscount ? [{ key: 'disc', label: 'Popust', w: 44, align: 'right' as const }] : []),
    { key: 'amount', label: 'Iznos', w: 76, align: 'right' },
  ];
  const descW = CW - fixed.reduce((s, x) => s + x.w, 0);
  fixed[1].w = descW;
  const cols = fixed;
  const colX: Record<string, number> = {};
  let acc = ML;
  for (const col of cols) {
    colX[col.key] = acc;
    acc += col.w;
  }
  const pad = 6;
  const titleSize = 9.2;
  const descSize = 8.2;
  const numSize = 8.4;

  ensure(c, 20 + 40);
  c.tableCols = cols;
  drawTableHead(c, cols);

  for (const g of groups) {
    if (g.title !== null) {
      ensure(c, 26 + 30);
      c.y -= 17;
      drawTracked(c.page, g.title.toUpperCase(), ML + pad, c.y, f.xbold, 7.6, 0.06, C.ink);
      c.y -= 7;
      hline(c.page, ML, W - MR, c.y, 0.6, C.ink2);
    }
    for (const r of g.rows) {
      const titleLines = wrap(f.semi, titleSize, r.title.trim() || 'Stavka', descW - 2 * pad);
      const descLines = r.description.trim() ? wrap(f.reg, descSize, r.description.trim(), descW - 2 * pad) : [];
      const rowH = 8 + titleLines.length * 11.6 + (descLines.length ? 2 + descLines.length * 10.4 : 0) + 7;
      // red ne lomimo preko stranice, osim kad je dulji od cijele stranice
      const fresh = H - TOP - 40 - 20 - BOTTOM;
      if (c.y - rowH < BOTTOM && rowH <= fresh) newPage(c);
      const top = c.y;
      let y = top - 8 - 8.2;
      // brojke u prvom retku
      text(c.page, String(r.n).padStart(2, '0'), colX.n + pad, y, f.mono, numSize, C.faint);
      text(c.page, `${formatQty(r.qty)} ${r.unit}`.trim(), colX.qty, y, f.mono, numSize, C.ink, 'right', cols[2].w - pad);
      text(c.page, formatEur(r.unitPrice), colX.price, y, f.mono, numSize, C.ink, 'right', cols[3].w - pad);
      if (hasDiscount) text(c.page, r.discount ? formatPercent(r.discount) : '', colX.disc, y, f.mono, numSize, C.ink2, 'right', 44 - pad);
      text(c.page, formatEur(r.amount), colX.amount, y, f.monoMed, numSize, C.ink, 'right', cols[cols.length - 1].w - pad);
      for (const l of titleLines) {
        text(c.page, l, colX.desc + pad, y, f.semi, titleSize, C.ink);
        y -= 11.6;
      }
      if (descLines.length) y -= 2;
      for (const l of descLines) {
        if (y < BOTTOM) {
          // vrlo dug opis: nastavak na sljedećoj stranici
          newPage(c);
          y = c.y - 8 - 8.2;
        }
        text(c.page, l, colX.desc + pad, y + 1.2, f.reg, descSize, C.muted);
        y -= 10.4;
      }
      c.y = y + 8.2 - 7 - 1;
      hline(c.page, ML, W - MR, c.y, 0.45, C.line);
    }
    if (hasSections && g.title !== null && groups.length > 1) {
      ensure(c, 22);
      c.y -= 14.5;
      const lab = `Međuzbroj: ${g.title.trim()}`;
      const amountW = cols[cols.length - 1].w - pad;
      const ax = colX.amount;
      text(c.page, clean(f.reg, lab), ML, c.y, f.reg, 8.4, C.muted, 'right', ax - ML - 4);
      text(c.page, formatEur(g.subtotal), ax, c.y, f.monoMed, numSize, C.ink, 'right', amountW);
      c.y -= 8;
    }
  }
  c.tableCols = null;
}

/* ── zbroj ───────────────────────────────────────────────────────────────── */

function drawTotals(c: Ctx) {
  const { f, q } = c;
  const t = computeTotals(q.items, q.pdvEnabled, q.pdvRate);
  const boxW = 236;
  const x = W - MR - boxW;
  const rows: [string, string][] = [['Osnovica', formatEur(t.subtotal)]];
  if (q.pdvEnabled) rows.push([`PDV ${formatPercent(q.pdvRate)}`, formatEur(t.pdvAmount)]);
  const need = 18 + rows.length * 17 + 34 + (q.pdvEnabled ? 0 : 26);
  ensure(c, need);
  c.y -= 18;
  for (const [l, v] of rows) {
    text(c.page, l, x, c.y, f.reg, 9, C.ink2);
    text(c.page, v, x, c.y, f.mono, 9, C.ink, 'right', boxW);
    c.y -= 17;
  }
  c.y += 5;
  hline(c.page, x, W - MR, c.y, 1.4, C.rule);
  c.y -= 19;
  drawTracked(c.page, q.pdvEnabled ? 'UKUPNO' : 'UKUPNO', x, c.y, f.xbold, 10.5, 0.04, C.ink);
  text(c.page, formatEur(t.total), x, c.y - 0.5, f.monoMed, 13, C.ink, 'right', boxW);
  c.y -= 12;
  if (!q.pdvEnabled) {
    c.y -= 4;
    for (const l of wrap(f.reg, 7.8, PDV_EXEMPT_NOTE, boxW)) {
      text(c.page, l, x, c.y, f.reg, 7.8, C.muted, 'right', boxW);
      c.y -= 10.5;
    }
  } else {
    text(c.page, 'Iznosi su u eurima.', x, c.y, f.reg, 7.6, C.faint, 'right', boxW);
    c.y -= 10;
  }
}

/* ── napomene, uvjeti, potpis ────────────────────────────────────────────── */

function drawBlock(c: Ctx, title: string, body: string) {
  if (!body.trim()) return;
  ensure(c, 14 + 14 * 2);
  label(c.page, c.f, title, ML, c.y);
  c.y -= 14;
  drawParagraphs(c, body.trim(), { size: 8.8, lead: 12.8 });
  c.y -= 10;
}

function drawSignatures(c: Ctx) {
  const { f, q, s } = c;
  ensure(c, 70);
  c.y -= 12;
  if (q.acceptedAt) {
    hline(c.page, ML, W - MR, c.y, 0.5, C.line);
    c.y -= 16;
    text(c.page, `Ponudu je naručitelj prihvatio online ${formatMoment(q.acceptedAt)}.`, ML, c.y, f.reg, 8.8, C.ink2);
    c.y -= 14;
    return;
  }
  const colW = (CW - 40) / 2;
  const lineY = c.y - 34;
  const k = companyContact(s);
  const cols = [`Za izvođača — ${k.name}`, 'Naručitelj — potpis i datum'];
  cols.forEach((lab, i) => {
    const x = ML + i * (colW + 40);
    hline(c.page, x, x + colW, lineY, 0.6, C.ink2);
    text(c.page, lab, x, lineY - 11, f.reg, 7.8, C.muted);
  });
  c.y = lineY - 22;
}

/* ── podnožje ────────────────────────────────────────────────────────────── */

function drawFooters(c: Ctx) {
  const { f, q, s } = c;
  const co = s.company;
  const k = companyContact(s);
  const legal = [co.naziv || k.name, co.adresa, co.oib && `OIB ${co.oib}`, co.iban && `IBAN ${formatIban(co.iban)}`].filter(Boolean).join(' · ');
  const custom = s.quote.footer.trim();
  const n = c.pages.length;
  c.pages.forEach((page, i) => {
    const y = FOOT - 22;
    hline(page, ML, W - MR, y + 12, 0.5, C.line);
    const right = `${q.number}  ·  Stranica ${i + 1} / ${n}`;
    const rw = f.mono.widthOfTextAtSize(clean(f.mono, right), 6.8);
    const maxLeft = CW - rw - 16;
    const leftLines = [custom, legal].filter(Boolean).flatMap((t) => wrap(f.reg, 6.8, t, maxLeft)).slice(0, 2);
    leftLines.forEach((l, j) => text(page, l, ML, y - j * 9, f.reg, 6.8, C.muted));
    text(page, right, ML, y, f.mono, 6.8, C.muted, 'right', CW);
  });
}

/* ── glavno ──────────────────────────────────────────────────────────────── */

export async function renderQuotePdf(q: Quote, s: SettingsMap): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const embed = (d: string) => pdf.embedFont(bytesOf(d), { subset: true });
  const [reg, semi, xbold, black, mono, monoMed] = await Promise.all([
    embed(archivoRegular),
    embed(archivoSemi),
    embed(archivoXBold),
    embed(archivoXBlack),
    embed(plexRegular),
    embed(plexMedium),
  ]);
  const f: Fonts = { reg, semi, xbold, black, mono, monoMed };
  const k = companyContact(s);

  pdf.setTitle(`Ponuda ${q.number}${q.title.trim() ? ` — ${q.title.trim()}` : ''}`);
  pdf.setAuthor(k.name);
  pdf.setSubject(q.title.trim() || 'Ponuda');
  pdf.setCreator(k.name);
  pdf.setProducer('Limarija Karamatić — ponude');
  pdf.setLanguage('hr-HR');
  pdf.setCreationDate(new Date(q.createdAt));
  pdf.setModificationDate(new Date(q.updatedAt));

  const page = pdf.addPage([W, H]);
  const c: Ctx = { pdf, f, q, s, page, y: H - TOP, pages: [page], tableCols: null };
  const totals = computeTotals(q.items, q.pdvEnabled, q.pdvRate);

  drawLetterhead(c);
  drawTitleBlock(c, totals);
  drawParties(c);
  // naslov dulji od 3 retka u sastavnici je skraćen ("…") — ovdje se ispisuje cijeli
  const fullTitle = q.title.trim();
  if (fullTitle && wrap(f.xbold, 14.5, fullTitle, CW * 0.52 - 24).length > 3) {
    c.y -= 4;
    drawBlock(c, 'Predmet ponude', fullTitle);
  }
  if (q.intro.trim()) {
    c.y -= 4;
    drawParagraphs(c, q.intro.trim(), { size: 9.4, lead: 14 });
    c.y -= 12;
  } else c.y -= 4;
  drawItems(c);
  drawTotals(c);
  c.y -= 18;
  const days = `${q.validDays} ${q.validDays % 10 === 1 && q.validDays % 100 !== 11 ? 'dan' : 'dana'}`;
  const blocks: [string, string][] = [
    ['Napomene', q.notes],
    ['Uvjeti plaćanja', q.paymentTerms],
    ['Rok valjanosti', `Ponuda vrijedi ${days} od datuma izdavanja, do ${formatDay(validUntil(q.issueDate, q.validDays))}`],
  ];
  // svaki blok ostaje cijeli (ako stane na stranicu), a ZADNJI blok ide zajedno s potpisima —
  // ne seli se cijeli niz uvjeta na novu stranicu kad na trenutnoj ima mjesta
  const visible = blocks.filter(([, b]) => b.trim());
  const sigH = q.acceptedAt ? 46 : 72;
  visible.forEach(([title, body], i) => {
    const h = 24 + wrap(f.reg, 8.8, body.trim(), CW).length * 12.8 + (i === visible.length - 1 ? sigH : 0);
    if (c.y - h < BOTTOM && h < H - TOP - 40 - BOTTOM) newPage(c);
    drawBlock(c, title, body);
  });
  drawSignatures(c);
  drawFooters(c);

  return pdf.save();
}

/** Ime datoteke: 'Ponuda-KR-2026-001.pdf' */
export const pdfFileName = (q: Pick<Quote, 'number'>) => `Ponuda-${q.number}.pdf`;
