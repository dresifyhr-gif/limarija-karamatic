/**
 * Zadane vrijednosti iz src/data/site.ts u obliku baze (ImageRef umjesto ImageMetadata).
 * Koriste ih: content.ts (kad baze nema), admin (prikaz zadanog za usluge), repo/settings (spajanje).
 */
import { site, stats, services, projects, steps, labels as siteLabels, homepage as siteHomepage, type Service } from '@/data/site';
import { keyOfAsset } from '@/lib/assets';
import type { AssetImageRef, HomepageContent, HomepageSettings, ImageRef, LabelsSettings, SettingsMap } from '@/lib/types';
import type { ImageMetadata } from 'astro';
import { DEFAULT_DESIGN } from '@/lib/fonts';

export function defaultSettings(): SettingsMap {
  return {
    contact: {
      name: site.name,
      tagline: site.tagline,
      phoneDisplay: site.phoneDisplay,
      phoneE164: site.phoneE164,
      whatsapp: site.whatsapp,
      email: site.email,
      city: site.city,
      area: site.area,
      areaLine: site.areaLine,
      hours: site.hours,
      hoursShort: site.hoursShort,
      responseTime: site.responseTime,
      googleReviewsUrl: site.googleReviewsUrl,
    },
    company: { naziv: '', oib: '', adresa: '', iban: '', banka: '', email: '', telefon: '', web: '' },
    quote: { pdvEnabled: true, pdvRate: 25, validDays: 30, paymentTerms: '', notes: '', footer: '' },
    stats: stats.map(({ value, decimals, prefix, suffix, label }) => ({ value, decimals, prefix, suffix, label })),
    /** samo izmjene; zadani tekstovi su u defaultHomepage() */
    homepage: {},
    labels: defaultLabels(),
    design: { ...DEFAULT_DESIGN },
  };
}

/** Opisni alt za fotografije galerije koje nisu naslovne (isto kao src/pages/usluge/_parts/media.ts). */
const extraAlt: Record<string, string> = {
  'krov-crijep-lim-spoj-radnik': 'Spoj dvije plohe krova od crijep-lima, limari u radu u pozadini',
  'atika-opsav-kut-ljestve': 'Kapa atike na kutu ravnog krova, uz susjedni krov od crijepa',
  'atika-opsav-alat': 'Kapa atike uz rub ravnog krova sa šljunkom',
  'atika-opsav-alat-siroko': 'Opšav atike oko ravnog krova sa šljunkom',
};
/** Zadani alt za lokalnu fotografiju: naslovna rada → alt rada; naslovna usluge → imageAlt; inače extraAlt. */
export function defaultAltFor(img: ImageMetadata, fallback = ''): string {
  const p = projects.find((x) => x.image === img);
  if (p) return p.alt;
  const sv = services.find((x) => x.image === img);
  if (sv) return sv.imageAlt;
  const key = Object.keys(extraAlt).find((k) => img.src.includes(`/${k}.`));
  return key ? extraAlt[key] : fallback;
}

const ref = (img: ImageMetadata, alt?: string): AssetImageRef => ({ key: keyOfAsset(img) ?? '', alt: alt ?? defaultAltFor(img) });

/** Polja usluge koja admin može mijenjati (camelCase), sa zadanim vrijednostima iz site.ts. */
export type ServiceFields = {
  title: string;
  chip: string;
  short: string;
  intro: string;
  includes: string[];
  cover: ImageRef;
  gallery: ImageRef[];
  faq: { q: string; a: string }[];
  h1: string;
  lead: string | null;
  seoTitle: string;
  seoDescription: string;
  includesTitle: string | null;
  galleryTitle: string | null;
  galleryLead: string | null;
  relatedTitle: string | null;
  faqTitle: string | null;
};

export const SERVICE_SLUGS = services.map((s) => s.slug);

export function serviceDefaults(slug: string): ServiceFields | null {
  const s: Service | undefined = services.find((x) => x.slug === slug);
  if (!s) return null;
  return {
    title: s.title,
    chip: s.chip,
    short: s.short,
    intro: s.intro,
    includes: [...s.includes],
    cover: ref(s.image, s.imageAlt),
    gallery: s.gallery.map((g) => ref(g, defaultAltFor(g, s.imageAlt))),
    faq: s.faq.map((f) => ({ ...f })),
    h1: s.h1,
    lead: s.lead ?? null,
    seoTitle: s.seoTitle,
    seoDescription: s.seoDescription,
    includesTitle: s.includesTitle ?? null,
    galleryTitle: s.galleryTitle ?? null,
    galleryLead: s.galleryLead ?? null,
    relatedTitle: s.relatedTitle ?? null,
    faqTitle: s.faqTitle ?? null,
  };
}

/* ── Naslovnica i natpisi gumba ──────────────────────────────────────────── */

/** Zadani natpisi gumba (site.ts → labels). */
export function defaultLabels(): LabelsSettings {
  return { cta: siteLabels.cta, ctaPhone: siteLabels.ctaPhone, ctaWhatsapp: siteLabels.ctaWhatsapp };
}

/** Natpisi iz baze preko zadanih: prazno ili izostavljeno → zadano. */
export function resolveLabels(stored: Partial<LabelsSettings> | null | undefined): LabelsSettings {
  const d = defaultLabels();
  const s = stored ?? {};
  return { cta: pick(s.cta, d.cta), ctaPhone: pick(s.ctaPhone, d.ctaPhone), ctaWhatsapp: pick(s.ctaWhatsapp, d.ctaWhatsapp) };
}

/** Kontekst o kojem ovise neke zadane vrijednosti naslovnice. */
export type HomepageContext = {
  /** treća "jamstva" stavka u heru = contact.responseTime */
  responseTime?: string;
  /** postoje li objavljene recenzije ili Google poveznica → zaglavlje "Recenzije", inače "U brojkama" */
  hasReviews?: boolean;
  /** natpis glavnog gumba (labels.cta) → zadana oznaka završne forme, kao na ostalim stranicama */
  cta?: string;
};

/** Zadani tekstovi naslovnice (site.ts → homepage, steps), potpun oblik. */
export function defaultHomepage(ctx: HomepageContext = {}): HomepageContent {
  const h = siteHomepage;
  const responseTime = ctx.responseTime || site.responseTime;
  return {
    hero: { eyebrow: h.hero.eyebrow, title: h.hero.title, lead: h.hero.lead, trust: [h.hero.trust[0], h.hero.trust[1], responseTime] },
    services: { ...h.services },
    projects: { ...h.projects },
    process: { ...h.process, steps: steps.map(({ title, text }) => ({ title, text })) },
    reviews: { ...(ctx.hasReviews ? h.reviews : h.reviewsStatsOnly) },
    managers: { eyebrow: h.managers.eyebrow, title: h.managers.title, lead: h.managers.lead, points: [h.managers.points[0], h.managers.points[1], h.managers.points[2]], cta: h.managers.cta },
    faq: { ...h.faq },
    finalCta: { ...h.finalCta, eyebrow: ctx.cta?.trim() || h.finalCta.eyebrow },
  };
}

const pick = (v: unknown, d: string): string => (typeof v === 'string' && v.trim() ? v : d);
const head = <T extends Record<string, string>>(d: T, s: Partial<Record<keyof T, unknown>> | undefined): T =>
  Object.fromEntries(Object.entries(d).map(([k, dv]) => [k, pick(s?.[k as keyof T], dv)])) as T;
const list = (d: readonly string[], s: unknown): string[] => d.map((dv, i) => pick(Array.isArray(s) ? s[i] : undefined, dv));

/**
 * Izmjene iz admina (settings.homepage) preko zadanih → potpuni tekstovi naslovnice.
 * Prazno ('') ili izostavljeno polje = zadano; i pojedine stavke trust/points/steps.
 */
export function resolveHomepage(stored: HomepageSettings | null | undefined, ctx: HomepageContext = {}): HomepageContent {
  const d = defaultHomepage(ctx);
  const s = stored ?? {};
  const st = Array.isArray(s.process?.steps) ? s.process!.steps : [];
  const { trust: dTrust, ...dHero } = d.hero;
  const { steps: dSteps, ...dProc } = d.process;
  const { points: dPoints, cta: dCta, ...dMgr } = d.managers;
  return {
    hero: { ...head(dHero, s.hero), trust: list(dTrust, s.hero?.trust) as [string, string, string] },
    services: head(d.services, s.services),
    projects: head(d.projects, s.projects),
    process: { ...head(dProc, s.process), steps: dSteps.map((ds, i) => head(ds, st[i])) },
    reviews: head(d.reviews, s.reviews),
    managers: { ...head(dMgr, s.managers), points: list(dPoints, s.managers?.points) as [string, string, string], cta: pick(s.managers?.cta, dCta) },
    faq: head(d.faq, s.faq),
    finalCta: head(d.finalCta, s.finalCta),
  };
}
