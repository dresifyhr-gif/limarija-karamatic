#!/usr/bin/env node
/**
 * Početni sadržaj baze iz src/data/site.ts:  node scripts/db-seed.mjs  [--dry]
 *
 * SIGURNO ZA PONOVNO POKRETANJE: upisuje SAMO ono čega još nema
 *  - settings / admin_meta: INSERT … ON CONFLICT DO NOTHING (postojeće postavke se ne diraju)
 *  - services: red po slugu, ON CONFLICT DO NOTHING
 *  - projects: po slugu, ON CONFLICT DO NOTHING (+ njihove fotografije samo za novi rad)
 *  - faq: samo ako je tablica prazna
 *  - reviews: ništa (recenzije se ne izmišljaju)
 *
 * Lokalne fotografije se NE uploadaju: zapisuju se kao asset_key ('projects/ime.jpg',
 * relativno na src/assets). Traži Node ≥ 22.18 (učitava .ts preko type-strippinga).
 */
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { Client } from '@neondatabase/serverless';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const f of ['.env.local', '.env']) {
  const p = path.join(root, f);
  if (existsSync(p)) {
    try {
      process.loadEnvFile(p);
    } catch {}
  }
}
const dry = process.argv.includes('--dry');

/* ── site.ts učitavamo izravno: '@/assets/…' slike postaju string ključ ─── */
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('@/assets/')) {
      return { url: 'kr-asset:' + specifier.slice('@/assets/'.length), shortCircuit: true };
    }
    if (specifier.startsWith('@/')) {
      return next(pathToFileURL(path.join(root, 'src', specifier.slice(2))).href, context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith('kr-asset:')) {
      return { format: 'module', source: `export default ${JSON.stringify(url.slice(9))};`, shortCircuit: true };
    }
    return next(url, context);
  },
});
const site = await import(pathToFileURL(path.join(root, 'src/data/site.ts')).href);

/* ── alt tekstovi po fotografiji (ista logika kao src/pages/usluge/_parts/media.ts) ── */
const extraAlt = {
  'krov-crijep-lim-spoj-radnik': 'Spoj dvije plohe krova od crijep-lima, limari u radu u pozadini',
  'atika-opsav-kut-ljestve': 'Kapa atike na kutu ravnog krova, uz susjedni krov od crijepa',
  'atika-opsav-alat': 'Kapa atike uz rub ravnog krova sa šljunkom',
  'atika-opsav-alat-siroko': 'Opšav atike oko ravnog krova sa šljunkom',
};
function altFor(key, fallback) {
  const p = site.projects.find((x) => x.image === key);
  if (p) return p.alt;
  const s = site.services.find((x) => x.image === key);
  if (s) return s.imageAlt;
  const base = key.split('/').pop().replace(/\.\w+$/, '');
  return extraAlt[base] ?? fallback;
}
const assetRef = (key, fallbackAlt) => ({ key, alt: altFor(key, fallbackAlt) });

/* ── postavke ─────────────────────────────────────────────────────────── */
const s = site.site;
const settings = {
  contact: {
    name: s.name,
    tagline: s.tagline,
    phoneDisplay: s.phoneDisplay,
    phoneE164: s.phoneE164,
    whatsapp: s.whatsapp,
    email: s.email,
    city: s.city,
    area: s.area,
    areaLine: s.areaLine,
    hours: s.hours,
    hoursShort: s.hoursShort,
    responseTime: s.responseTime,
    googleReviewsUrl: s.googleReviewsUrl,
  },
  company: { naziv: '', oib: '', adresa: '', iban: '', banka: '', email: '', telefon: '', web: '' },
  quote: {
    pdvEnabled: true,
    pdvRate: 25,
    validDays: 30,
    paymentTerms: '',
    notes: '',
    footer: '',
  },
  stats: site.stats.map(({ value, decimals, prefix, suffix, label }) => ({
    value,
    ...(decimals != null ? { decimals } : {}),
    ...(prefix ? { prefix } : {}),
    ...(suffix ? { suffix } : {}),
    label,
  })),
};

const client = new Client({ connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL });
if (!dry) await client.connect();
const q = async (text, params = []) => (dry ? { rows: [], rowCount: 0 } : client.query(text, params));
const counts = {};
const bump = (k, n) => (counts[k] = (counts[k] ?? 0) + n);

try {
  if (!dry) await client.query('BEGIN');

  for (const [key, value] of Object.entries(settings)) {
    const r = await q('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING', [key, JSON.stringify(value)]);
    bump('settings', r.rowCount);
  }
  // stanje kao da je zadnja objava = trenutni sadržaj (javna stranica je već izgrađena iz site.ts)
  const nowIso = new Date().toISOString();
  for (const [key, value] of Object.entries({ session_epoch: 1, content_updated_at: nowIso, last_publish_at: nowIso })) {
    const r = await q('INSERT INTO admin_meta (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING', [key, JSON.stringify(value)]);
    bump('admin_meta', r.rowCount);
  }

  for (const [i, sv] of site.services.entries()) {
    const r = await q(
      `INSERT INTO services (slug, sort, title, chip, short, intro, includes, cover, gallery, faq, h1, lead,
         seo_title, seo_description, includes_title, gallery_title, gallery_lead, related_title, faq_title)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       ON CONFLICT (slug) DO NOTHING`,
      [
        sv.slug,
        i,
        sv.title,
        sv.chip,
        sv.short,
        sv.intro,
        JSON.stringify(sv.includes),
        JSON.stringify({ key: sv.image, alt: sv.imageAlt }),
        JSON.stringify(sv.gallery.map((k) => assetRef(k, sv.imageAlt))),
        JSON.stringify(sv.faq),
        sv.h1,
        sv.lead ?? null,
        sv.seoTitle,
        sv.seoDescription,
        sv.includesTitle ?? null,
        sv.galleryTitle ?? null,
        sv.galleryLead ?? null,
        sv.relatedTitle ?? null,
        sv.faqTitle ?? null,
      ],
    );
    bump('services', r.rowCount);
  }

  for (const [i, p] of site.projects.entries()) {
    const r = await q(
      `INSERT INTO projects (slug, title, hero_title, kind, service_slug, location, material, year, alt, note, scope, featured, published, sort)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true,$13)
       ON CONFLICT (slug) DO NOTHING RETURNING id`,
      [p.slug, p.title, p.heroTitle ?? null, p.kind, p.service, p.location, p.material, p.year, p.alt, p.note, JSON.stringify(p.scope), !!p.featured, i],
    );
    bump('projects', r.rowCount);
    const id = r.rows[0]?.id;
    if (!id) continue;
    // naslovna = gallery[0] (u site.ts je uvijek ista kao image); osiguraj da je prva
    const keys = [p.image, ...p.gallery.filter((k) => k !== p.image)];
    for (const [j, key] of keys.entries()) {
      await q('INSERT INTO project_images (project_id, asset_key, alt, sort) VALUES ($1,$2,$3,$4)', [
        id,
        key,
        j === 0 ? p.alt : altFor(key, p.alt),
        j,
      ]);
      bump('project_images', 1);
    }
  }

  const faqCount = dry ? 0 : Number((await client.query('SELECT count(*)::int AS n FROM faq')).rows[0].n);
  if (faqCount === 0) {
    const home = new Set([
      'Koliko košta limeni krov po m²?',
      'Je li procjena stvarno besplatna?',
      'Koliko traje izrada novog krova?',
      'Dajete li jamstvo?',
      'Radite li po kiši i zimi?',
    ]);
    for (const [i, f] of site.faq.entries()) {
      await q('INSERT INTO faq (q, a, on_home, sort) VALUES ($1,$2,$3,$4)', [f.q, f.a, home.has(f.q), i]);
      bump('faq', 1);
    }
  }

  if (!dry) await client.query('COMMIT');
  console.log(dry ? '(dry run) ' : '', 'upisano:', counts);
} catch (e) {
  if (!dry) await client.query('ROLLBACK');
  throw e;
} finally {
  if (!dry) await client.end();
}
