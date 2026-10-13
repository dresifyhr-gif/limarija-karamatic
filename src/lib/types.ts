/**
 * Zajednički tipovi i konstante za admin, API, PDF ponuda i build (bez ovisnosti — sigurno i u pregledniku).
 * Ugovor: docs/ADMIN-SPEC.md
 */
import type { DesignSettings } from './fonts';

/** Izgled javne stranice: fontovi naslova i teksta (admin → Izgled). Popis pisama i tokeni: src/lib/fonts.ts. */
export type { DesignSettings };

/* ── Fotografije ─────────────────────────────────────────────────────────── */

/** Fotografija iz repozitorija: key je putanja relativno na src/assets (npr. 'projects/falcani-krov-zid.jpg'). */
export type AssetImageRef = { key: string; alt?: string };
/** Fotografija na Vercel Blobu (učitana u adminu). */
export type BlobImageRef = { url: string; pathname: string; width: number; height: number; alt?: string };
export type ImageRef = AssetImageRef | BlobImageRef;

export const isBlobRef = (r: unknown): r is BlobImageRef =>
  !!r && typeof r === 'object' && typeof (r as BlobImageRef).url === 'string';
export const isAssetRef = (r: unknown): r is AssetImageRef =>
  !!r && typeof r === 'object' && typeof (r as AssetImageRef).key === 'string';

/** URL-ovi Blob fotografija iz bilo kakvog popisa ImageRef-ova (lokalne se preskaču). */
export const blobUrlsOf = (refs: readonly (ImageRef | null | undefined)[]): string[] =>
  refs.flatMap((r) => (isBlobRef(r) ? [r.url] : []));

/** Odgovor POST /api/admin/upload */
export type UploadedImage = BlobImageRef & { size: number; contentType: string };

/* ── Upiti ───────────────────────────────────────────────────────────────── */

export const LEAD_STATUSES = ['novo', 'u_obradi', 'ponuda_poslana', 'zatvoreno'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  novo: 'Novo',
  u_obradi: 'U obradi',
  ponuda_poslana: 'Ponuda poslana',
  zatvoreno: 'Zatvoreno',
};

/* ── Ponude ──────────────────────────────────────────────────────────────── */

export const QUOTE_STATUSES = ['nacrt', 'poslana', 'prihvacena', 'odbijena'] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];
export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  nacrt: 'Nacrt',
  poslana: 'Poslana',
  prihvacena: 'Prihvaćena',
  odbijena: 'Odbijena',
};

/** Jedinice mjere koje nudi admin (slobodan tekst je također dopušten, max 12 znakova). */
export const QUOTE_UNITS = ['m²', 'm', 'kom', 'sat', 'paušal', 'kg', 'set'] as const;

/** Stavka ponude. 'section' je naslov skupine (bez cijene). Cijene su NETO u EUR. */
export type QuoteItem =
  | {
      id: string;
      type: 'item';
      title: string;
      description: string;
      unit: string;
      qty: number;
      unitPrice: number;
      /** popust na stavku u % (0–100); izostavljeno ili 0 = bez popusta */
      discount?: number;
    }
  | { id: string; type: 'section'; title: string };

export type QuoteTotals = {
  /** iznos po stavci (id → EUR), samo za type 'item' */
  lines: Record<string, number>;
  subtotal: number;
  pdvAmount: number;
  total: number;
};

/** Zakonska napomena kad obveznik nije u sustavu PDV-a (ide na PDF i javnu stranicu ponude). */
export const PDV_EXEMPT_NOTE = 'Obveznik nije u sustavu PDV-a (čl. 90. st. 1. Zakona o PDV-u)';

/* ── Postavke (tablica settings) ─────────────────────────────────────────── */

export type ContactSettings = {
  name: string;
  tagline: string;
  phoneDisplay: string;
  phoneE164: string;
  /** isti broj bez '+', za wa.me */
  whatsapp: string;
  email: string;
  city: string;
  area: string;
  areaLine: string;
  hours: string;
  hoursShort: string;
  responseTime: string;
  googleReviewsUrl: string;
};

/** Podaci tvrtke za ponude (NE prikazuju se na javnoj stranici). Prazno polje = ne ispisuje se. */
export type CompanySettings = {
  naziv: string;
  oib: string;
  adresa: string;
  iban: string;
  banka: string;
  email: string;
  telefon: string;
  web: string;
};

export type QuoteSettings = {
  /** true = "u sustavu PDV-a" (PDV po pdvRate); false = ispisuje PDV_EXEMPT_NOTE */
  pdvEnabled: boolean;
  pdvRate: number;
  validDays: number;
  paymentTerms: string;
  /** zadane napomene na novoj ponudi */
  notes: string;
  /** kratki tekst u podnožju PDF-a (opcionalno) */
  footer: string;
};

export type StatSetting = {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  label: string;
};

/* ── Naslovnica i natpisi gumba (settings.homepage / settings.labels) ───── */

/** Zaglavlje sekcije naslovnice. */
export type HomeHead = { eyebrow: string; title: string; lead: string };
export type HomeStep = { title: string; text: string };

/** Tekstovi naslovnice, POTPUNO razriješeni (zadano + izmjene iz admina). Ugovor: docs/ADMIN-SPEC.md §12. */
export type HomepageContent = {
  /** title: "\n" = prijelom retka. eyebrow = oznaka iznad naslova (komponenta iza nje dodaje " · <contact.area>"). */
  hero: { eyebrow: string; title: string; lead: string; trust: [string, string, string] };
  services: HomeHead;
  projects: HomeHead;
  /** steps: točno 5 */
  process: HomeHead & { steps: HomeStep[] };
  reviews: HomeHead;
  managers: HomeHead & { points: [string, string, string]; cta: string };
  faq: { eyebrow: string; title: string };
  finalCta: HomeHead;
};

/**
 * Što je spremljeno u settings.homepage: samo izmjene. Sve je opcionalno;
 * izostavljeno ili prazno ('') = zadani tekst. trust/points imaju točno 3, steps točno 5 stavki (prazna stavka = zadano).
 */
export type HomepageSettings = {
  hero?: { eyebrow?: string; title?: string; lead?: string; trust?: [string, string, string] };
  services?: Partial<HomeHead>;
  projects?: Partial<HomeHead>;
  process?: Partial<HomeHead> & { steps?: HomeStep[] };
  reviews?: Partial<HomeHead>;
  managers?: Partial<HomeHead> & { points?: [string, string, string]; cta?: string };
  faq?: { eyebrow?: string; title?: string };
  finalCta?: Partial<HomeHead>;
};
export const HOMEPAGE_SECTIONS = ['hero', 'services', 'projects', 'process', 'reviews', 'managers', 'faq', 'finalCta'] as const;
export type HomepageSection = (typeof HOMEPAGE_SECTIONS)[number];

/** Natpisi gumba na cijeloj javnoj stranici. getSettings() ih vraća razriješene (prazno → zadano). */
export type LabelsSettings = {
  /** glavni gumb: zaglavlje, mobilni dock, izbornik, hero, podstranice, završna forma */
  cta: string;
  /** poziv telefonom */
  ctaPhone: string;
  /** WhatsApp gumb */
  ctaWhatsapp: string;
};

export type SettingsMap = {
  contact: ContactSettings;
  company: CompanySettings;
  quote: QuoteSettings;
  stats: StatSetting[];
  /** SAMO izmjene. Razriješeno: getContent().homepage ili resolveHomepage() iz @/lib/defaults */
  homepage: HomepageSettings;
  labels: LabelsSettings;
  /** fontovi javne stranice; getSettings() vraća razriješeno (nepoznat id → izvorno) */
  design: DesignSettings;
};
export type SettingsKey = keyof SettingsMap;
export const SETTINGS_KEYS = ['contact', 'company', 'quote', 'stats', 'homepage', 'labels', 'design'] as const satisfies readonly SettingsKey[];
