/**
 * Zadane vrijednosti iz src/data/site.ts u obliku baze (ImageRef umjesto ImageMetadata).
 * Koriste ih: content.ts (kad baze nema), admin (prikaz zadanog za usluge), repo/settings (spajanje).
 */
import { site, stats, services, projects, type Service } from '@/data/site';
import { keyOfAsset } from '@/lib/assets';
import type { AssetImageRef, ImageRef, SettingsMap } from '@/lib/types';
import type { ImageMetadata } from 'astro';

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
