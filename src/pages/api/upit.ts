/**
 * POST /api/upit — javna forma "Upit za procjenu" (src/components/form/RadniNalog.astro).
 *
 * S JS-om (src/lib/form.ts): JSON
 *   { vrsta, varijanta, mjesto | adresa, upravitelj?, ulazi?, velicina?, napomena?, ime, mobitel, email?, termin?, stranica?, web (zamka),
 *     fotografije: [{ url, pathname, width, height, sig }] }   ← fotografije su već učitane preko /api/upit/foto
 *   → 201 { ok: true, number: '0017' }  ·  400 { error, fields: { <ime polja forme>: poruka } }  ·  429
 *
 * Bez JS-a: multipart (ista imena polja + datoteke 'fotografije', najviše 6) → 303 /hvala?upit=…&posao=…&slike=…
 *
 * Zaštita: zamka 'web' (botovi dobiju lažni uspjeh), ograničenje 5 upita na sat po IP-u (HMAC hash, nikad sirova IP),
 * ista domena, provjera potpisa fotografija, validacija na serveru. Osobni podaci nikad ne idu u URL.
 * Redoslijed: 1) provjera polja (bez ikakvih zapisa) → 2) atomsko ograničenje (hit) → 3) tek onda učitavanje
 * fotografija (bez JS-a) → 4) spremanje; ako spremanje ne uspije, učitane fotografije se brišu s Bloba.
 */
import type { APIContext } from 'astro';
import { json, readJson, route, HttpError } from '@/lib/server/http';
import { parse } from '@/lib/server/validate';
import { LeadCreateSchema } from '@/lib/server/schemas';
import { createLead } from '@/lib/server/repo/leads';
import { uploadImage, deleteBlobs } from '@/lib/server/blob';
import { clientKey, hit } from '@/lib/server/rate-limit';
import { verifyPhotoSig, sameSite } from '@/lib/quotes/server';
import { leadNumber } from '@/lib/quotes/shared';
import { isKnownJob } from '@/lib/quotes/labels';
import type { BlobImageRef } from '@/lib/types';
import { getContent } from '@/lib/content';

export const prerender = false;

const BUCKET = 'upit';
const LIMIT = 5;
const WINDOW = 3600;
const MAX_PHOTOS = 6;
const CALL_TIMES = ['Ujutro', 'Popodne', 'Svejedno'];

type Raw = Record<string, unknown>;
const str = (v: unknown, max = 4000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** imena polja sheme → imena polja forme (za poruke uz polja) */
const FIELD_MAP: Record<string, string> = {
  jobType: 'vrsta',
  location: 'mjesto',
  size: 'velicina',
  note: 'napomena',
  name: 'ime',
  phone: 'mobitel',
  email: 'email',
};

/** Znamenke broja: 8–15 (hrvatski ili strani broj). */
const phoneOk = (p: string) => {
  const d = p.replace(/\D/g, '');
  return /^[+\d\s\-/().]{6,40}$/.test(p) && d.length >= 8 && d.length <= 15;
};

function toLeadInput(raw: Raw, photos: BlobImageRef[], ctx: APIContext) {
  const variant = raw.varijanta === 'zgrada' ? 'zgrada' : 'standard';
  const fields: Record<string, string> = {};
  const jobType = str(raw.vrsta, 60);
  if (!jobType || !isKnownJob(jobType)) fields.vrsta = 'Odaberite što treba.';
  const location = variant === 'zgrada' ? str(raw.adresa, 200) : str(raw.mjesto, 200);
  if (location.length < 2) fields[variant === 'zgrada' ? 'adresa' : 'mjesto'] = variant === 'zgrada' ? 'Upišite adresu zgrade.' : 'Upišite mjesto ili kvart.';
  const name = str(raw.ime, 120);
  if (name.length < 2) fields.ime = 'Upišite ime.';
  const phone = str(raw.mobitel, 40);
  if (!phoneOk(phone)) fields.mobitel = 'Provjerite broj — npr. 091 234 5678.';
  const email = str(raw.email, 200);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) fields.email = 'Provjerite e-poštu.';
  if (Object.keys(fields).length) throw new HttpError(400, 'Provjerite označena polja.', fields);

  // zgrada: upravitelj i broj ulaza idu u napomenu (stupci upita su zajednički za obje varijante)
  const extra: string[] = [];
  if (variant === 'zgrada') {
    const mgr = str(raw.upravitelj, 160);
    const entries = str(raw.ulazi, 20);
    if (mgr) extra.push(`Upravitelj / tvrtka: ${mgr}`);
    if (entries) extra.push(`Broj ulaza: ${entries}`);
  }
  const userNote = str(raw.napomena, 3500);
  const note = [userNote, extra.join('\n')].filter(Boolean).join('\n\n');
  const termin = str(raw.termin, 40);
  let sourcePage = str(raw.stranica, 200);
  if (!sourcePage) {
    try {
      sourcePage = new URL(ctx.request.headers.get('referer') ?? '').pathname.slice(0, 200);
    } catch {
      sourcePage = '';
    }
  }
  return {
    jobType,
    variant,
    location,
    size: str(raw.velicina, 60),
    note,
    photos,
    name,
    phone,
    email,
    callTime: CALL_TIMES.includes(termin) ? termin : '',
    sourcePage: /^\/[\w\-/]*$/.test(sourcePage) ? sourcePage : '',
  };
}

/** Atomsko ograničenje: zabilježi pokušaj i odbij kad je prekoračeno (paralelni zahtjevi se ne mogu provući). */
async function guard(ctx: APIContext): Promise<void> {
  const r = await hit(BUCKET, clientKey(ctx), WINDOW, LIMIT);
  if (!r.ok) throw new HttpError(429, `Već smo primili nekoliko upita s ove veze. Pokušajte za ${r.retryMin} min ili nas nazovite.`);
}

/** Provjera polja bez fotografija (bez ikakvih zapisa) — baca HttpError 400 s porukama uz polja. */
function validate(ctx: APIContext, raw: Raw) {
  return parse(LeadCreateSchema, toLeadInput(raw, [], ctx));
}

async function save(ctx: APIContext, raw: Raw, photos: BlobImageRef[]) {
  const input = parse(LeadCreateSchema, toLeadInput(raw, photos, ctx));
  const lead = await createLead(input);
  return { number: leadNumber(lead.id), job: input.jobType, photos: photos.length };
}

/** imena polja sheme → imena polja forme */
function mapFieldErrors(e: unknown): unknown {
  if (e instanceof HttpError && e.fields) {
    const fields = Object.fromEntries(Object.entries(e.fields).map(([k, v]) => [FIELD_MAP[k.split('.')[0]] ?? k, v]));
    return new HttpError(e.status, e.message, fields);
  }
  return e;
}

/** zamka za botove: lažni broj, ništa se ne sprema */
const fakeNumber = () => String(1000 + Math.floor(Math.random() * 9000));

/* ── JSON (s JS-om) ───────────────────────────────────────────────────── */
async function handleJson(ctx: APIContext): Promise<Response> {
  if (!sameSite(ctx)) throw new HttpError(403, 'Zahtjev odbijen.');
  const raw = await readJson<Raw>(ctx.request, 50_000);
  if (!raw || typeof raw !== 'object') throw new HttpError(400, 'Neispravan upit.');
  if (str(raw.web)) return json({ ok: true, number: fakeNumber() }, 201);
  try {
    validate(ctx, raw);
  } catch (e) {
    throw mapFieldErrors(e);
  }
  await guard(ctx);

  const list = Array.isArray(raw.fotografije) ? raw.fotografije.slice(0, MAX_PHOTOS) : [];
  const photos: BlobImageRef[] = [];
  for (const p of list as Raw[]) {
    const url = str(p?.url, 1000);
    const pathname = str(p?.pathname, 300);
    // samo fotografije koje je učitala /api/upit/foto (potpis) i samo iz foldera 'leads'
    if (!url || !pathname.startsWith('leads/') || !verifyPhotoSig(url, p?.sig)) continue;
    photos.push({ url, pathname, width: Number(p.width), height: Number(p.height), alt: '' });
  }

  try {
    const r = await save(ctx, raw, photos);
    return json({ ok: true, number: r.number }, 201);
  } catch (e) {
    throw mapFieldErrors(e);
  }
}

/* ── obična forma (bez JS-a) ──────────────────────────────────────────── */
const esc = (t: string) => t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

async function htmlMessage(status: number, title: string, text: string): Promise<Response> {
  let phoneDisplay = '098 958 8171';
  let telHref = 'tel:+385989588171';
  try {
    const c = await getContent();
    phoneDisplay = c.contact.phoneDisplay || phoneDisplay;
    telHref = c.telHref || telHref;
  } catch {}
  title = esc(title);
  text = esc(text);
  const body = `<!doctype html><html lang="hr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title>
<style>body{font:16px/1.5 system-ui,sans-serif;background:#eeece7;color:#15181b;margin:0;padding:12vh 20px}main{max-width:32rem;margin:auto;background:#fff;padding:28px;border:1px solid rgb(21 24 27/.12)}a{color:#b80f15}</style></head>
<body><main><h1 style="font-size:1.4rem;margin:0 0 .5rem">${title}</h1><p>${text}</p><p><a href="javascript:history.back()">← Natrag na formu</a> · <a href="${esc(telHref)}">Nazovite ${esc(phoneDisplay)}</a></p></main></body></html>`;
  return new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
}

async function handleForm(ctx: APIContext): Promise<Response> {
  let form: FormData;
  try {
    form = await ctx.request.formData();
  } catch {
    return await htmlMessage(400, 'Upit nije poslan', 'Forma nije stigla cijela (možda su fotografije prevelike). Pokušajte s manje fotografija ili nas nazovite.');
  }
  const raw: Raw = {};
  for (const [k, v] of form.entries()) if (typeof v === 'string') raw[k] = v;
  if (str(raw.web)) return ctx.redirect(`/hvala?upit=${fakeNumber()}`, 303);
  const photos: BlobImageRef[] = [];
  try {
    validate(ctx, raw); // 1) polja — ništa se ne učitava ako forma nije ispravna
    await guard(ctx); // 2) atomsko ograničenje
    const files = form.getAll('fotografije').filter((f): f is File => f instanceof File && f.size > 0).slice(0, MAX_PHOTOS);
    for (const f of files) {
      try {
        const img = await uploadImage(new Uint8Array(await f.arrayBuffer()), 'leads');
        photos.push({ url: img.url, pathname: img.pathname, width: img.width, height: img.height, alt: '' });
      } catch {
        /* nepodržan format (npr. HEIC) — upit ide bez te fotografije */
      }
    }
    const r = await save(ctx, raw, photos);
    const q = new URLSearchParams({ upit: r.number, posao: r.job, slike: String(r.photos) });
    return ctx.redirect(`/hvala?${q}`, 303);
  } catch (e) {
    // upit nije spremljen → ne ostavljaj fotografije na Blobu
    if (photos.length) await deleteBlobs(photos.map((p) => p.url)).catch(() => {});
    if (e instanceof HttpError) {
      const detail = e.fields ? Object.values(e.fields).join(' ') : e.message;
      return await htmlMessage(e.status, e.status === 429 ? 'Previše upita' : 'Provjerite upit', detail);
    }
    console.error('[upit]', (e as Error)?.message ?? e);
    return await htmlMessage(500, 'Upit nije poslan', 'Došlo je do greške na našoj strani. Pokušajte ponovno ili nas nazovite.');
  }
}

export const POST = route(async (ctx) => {
  const ct = ctx.request.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) return handleJson(ctx);
  if (ct.includes('multipart/form-data') || ct.includes('application/x-www-form-urlencoded')) return handleForm(ctx);
  throw new HttpError(415, 'Nepodržan format zahtjeva.');
});
