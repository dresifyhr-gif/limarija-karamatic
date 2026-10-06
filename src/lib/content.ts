/**
 * Javni sadržaj za BUILD (prerender): baza preko zadanih vrijednosti iz src/data/site.ts.
 *
 *   ---
 *   import { getContent, imageAlt } from '@/lib/content';
 *   const { contact, services, projects, faq, homeFaq, stats, reviews } = await getContent();
 *   ---
 *
 * - Ako DATABASE_URL nema ili baza padne → vraća site.ts (+ console.warn). Build NIKAD ne pada zbog baze.
 * - Fotografije su `SiteImage`: lokalni ImageMetadata (iz repozitorija) ILI RemoteImage {src,width,height,remote:true}
 *   (Vercel Blob; Astro ih u buildu skine i optimizira jer je host u image.remotePatterns).
 * - Ista fotografija = isti objekt (identitet radi u Set/===), i za lokalne i za udaljene.
 * - Rezultat se pamti za cijeli build (u devu 3 s, da se izmjene iz admina vide nakon osvježavanja).
 */
import type { ImageMetadata } from 'astro';
import {
  site,
  stats as defaultStats,
  services as defaultServices,
  projects as defaultProjects,
  reviews as defaultReviews,
  faq as defaultFaq,
  type Service,
  type Project,
  type Review,
  type Stat,
} from '@/data/site';
import { assetByKey } from '@/lib/assets';
import { isBlobRef, type ContactSettings, type ImageRef } from '@/lib/types';
import { defaultSettings } from '@/lib/defaults';
import { hasDatabase } from '@/lib/server/db';

/* ── tipovi ──────────────────────────────────────────────────────────────── */

export type RemoteImage = { src: string; width: number; height: number; remote: true };
export type SiteImage = ImageMetadata | RemoteImage;
export const isRemoteImage = (img: SiteImage): img is RemoteImage => (img as RemoteImage).remote === true;

export type ContentService = Omit<Service, 'image' | 'gallery'> & { image: SiteImage; gallery: SiteImage[] };
export type ContentProject = Omit<Project, 'image' | 'gallery'> & { image: SiteImage; gallery: SiteImage[] };
export type ContentReview = Review & { source?: string; date?: string | null };
export type FaqItem = { q: string; a: string };

export type SiteContent = {
  /** odakle je sadržaj došao (za dijagnostiku) */
  source: 'db' | 'defaults';
  contact: ContactSettings;
  /** tel: link i WhatsApp link (prema kontaktu iz baze) */
  telHref: string;
  waHref: (text?: string) => string;
  stats: Stat[];
  services: ContentService[];
  /** samo objavljeni, poredani */
  projects: ContentProject[];
  reviews: ContentReview[];
  faq: FaqItem[];
  /** pitanja s oznakom "na naslovnici" (on_home), poredana */
  homeFaq: FaqItem[];
};

/* ── alt tekstovi po fotografiji ─────────────────────────────────────────── */

const alts = new Map<SiteImage, string>();
/** Opis fotografije (iz baze / site.ts) ili fallback. */
export function imageAlt(img: SiteImage, fallback = ''): string {
  return alts.get(img) || fallback;
}

/* ── pretvorba ImageRef → SiteImage ──────────────────────────────────────── */

const remoteCache = new Map<string, RemoteImage>();
function toImage(ref: ImageRef | null | undefined): SiteImage | null {
  if (!ref) return null;
  let img: SiteImage | undefined;
  if (isBlobRef(ref)) {
    img = remoteCache.get(ref.url);
    if (!img) {
      img = { src: ref.url, width: ref.width, height: ref.height, remote: true };
      remoteCache.set(ref.url, img);
    }
  } else {
    img = assetByKey(ref.key);
    if (!img) console.warn(`[content] lokalna fotografija ne postoji: ${ref.key}`);
  }
  if (img && ref.alt && !alts.has(img)) alts.set(img, ref.alt);
  return img ?? null;
}

const links = (c: ContactSettings) => ({
  telHref: `tel:${c.phoneE164}`,
  waHref: (text = 'Pozdrav, trebam procjenu krova. Lokacija: ') => `https://wa.me/${c.whatsapp}?text=${encodeURIComponent(text)}`,
});

const HOME_FAQ = [
  'Koliko košta limeni krov po m²?',
  'Je li procjena stvarno besplatna?',
  'Koliko traje izrada novog krova?',
  'Dajete li jamstvo?',
  'Radite li po kiši i zimi?',
];

/* ── zadano (site.ts) ────────────────────────────────────────────────────── */

function fromDefaults(): SiteContent {
  const contact = defaultSettings().contact;
  for (const p of defaultProjects) if (!alts.has(p.image)) alts.set(p.image, p.alt);
  for (const s of defaultServices) if (!alts.has(s.image)) alts.set(s.image, s.imageAlt);
  return {
    source: 'defaults',
    contact,
    ...links(contact),
    stats: defaultStats,
    services: defaultServices,
    projects: defaultProjects,
    reviews: defaultReviews,
    faq: defaultFaq.map(({ q, a }) => ({ q, a })),
    homeFaq: HOME_FAQ.map((q) => defaultFaq.find((f) => f.q === q)).filter((f): f is FaqItem => !!f),
  };
}

/* ── baza ────────────────────────────────────────────────────────────────── */

async function fromDb(): Promise<SiteContent> {
  // dinamički uvoz: bez baze se server kod uopće ne učitava
  const [{ getSettings }, { listServices }, { listProjects }, { listReviews }, { listFaq }] = await Promise.all([
    import('@/lib/server/repo/settings'),
    import('@/lib/server/repo/services'),
    import('@/lib/server/repo/projects'),
    import('@/lib/server/repo/reviews'),
    import('@/lib/server/repo/faq'),
  ]);
  const [settings, svc, prj, rev, faqRows] = await Promise.all([
    getSettings(),
    listServices(),
    listProjects({ publishedOnly: true }),
    listReviews({ publishedOnly: true }),
    listFaq({ publishedOnly: true }),
  ]);

  const services: ContentService[] = svc.map((s) => {
    const base = defaultServices.find((d) => d.slug === s.slug)!;
    const image = toImage(s.cover) ?? base.image;
    const gallery = s.gallery.map(toImage).filter((x): x is SiteImage => !!x);
    return {
      ...base,
      title: s.title,
      chip: s.chip,
      short: s.short,
      intro: s.intro,
      includes: s.includes,
      image,
      imageAlt: s.cover?.alt || base.imageAlt,
      gallery: gallery.length ? gallery : [image],
      faq: s.faq,
      h1: s.h1,
      lead: s.lead ?? undefined,
      seoTitle: s.seoTitle,
      seoDescription: s.seoDescription,
      includesTitle: s.includesTitle ?? undefined,
      galleryTitle: s.galleryTitle ?? undefined,
      galleryLead: s.galleryLead ?? undefined,
      relatedTitle: s.relatedTitle ?? undefined,
      faqTitle: s.faqTitle ?? undefined,
    };
  });

  const projects: ContentProject[] = [];
  for (const p of prj) {
    const gallery = p.images.map(toImage).filter((x): x is SiteImage => !!x);
    if (!gallery.length) {
      console.warn(`[content] rad "${p.slug}" nema fotografija — preskačem ga na javnoj stranici`);
      continue;
    }
    if (p.alt && !alts.has(gallery[0])) alts.set(gallery[0], p.alt);
    projects.push({
      slug: p.slug,
      title: p.title,
      kind: p.kind,
      service: p.serviceSlug,
      location: p.location,
      material: p.material,
      year: p.year ?? new Date(p.createdAt).getFullYear(),
      image: gallery[0],
      alt: p.alt || p.title,
      gallery,
      featured: p.featured,
      heroTitle: p.heroTitle ?? undefined,
      note: p.note,
      scope: p.scope,
    });
  }

  const faq = faqRows.map(({ q, a }) => ({ q, a }));
  return {
    source: 'db',
    contact: settings.contact,
    ...links(settings.contact),
    stats: settings.stats.map((s) => ({ ...s, confirmed: true })),
    services,
    projects,
    reviews: rev.map((r) => ({ name: r.name, place: r.place, text: r.text, stars: r.stars, source: r.source, date: r.reviewDate })),
    faq,
    homeFaq: faqRows.filter((f) => f.onHome).map(({ q, a }) => ({ q, a })),
  };
}

/* ── javni API ───────────────────────────────────────────────────────────── */

let cache: { at: number; value: Promise<SiteContent> } | null = null;
const TTL = import.meta.env.DEV ? 3000 : Infinity;

export function getContent(): Promise<SiteContent> {
  if (cache && Date.now() - cache.at < TTL) return cache.value;
  const value = (async () => {
    if (!hasDatabase()) {
      console.warn('[content] DATABASE_URL nije postavljen — koristim sadržaj iz src/data/site.ts');
      return fromDefaults();
    }
    try {
      return await fromDb();
    } catch (e) {
      console.warn('[content] baza nedostupna — koristim sadržaj iz src/data/site.ts:', (e as Error)?.message ?? e);
      return fromDefaults();
    }
  })();
  cache = { at: Date.now(), value };
  return value;
}

/** Usluga po slugu iz zadanog sadržaja (za getStaticPaths — slugovi usluga su fiksni). */
export const SERVICE_SLUGS_STATIC = defaultServices.map((s) => s.slug);
export { site as defaultSite };
