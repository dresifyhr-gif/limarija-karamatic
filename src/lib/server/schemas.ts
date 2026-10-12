/**
 * Sheme ulaza za API (validate.ts). Imena polja su camelCase — isto kao u JSON odgovorima.
 * Za djelomično ažuriranje koristi v.partial(Shema).
 */
import { v, type Infer, type Validator } from './validate';
import { LEAD_STATUSES, QUOTE_STATUSES } from '@/lib/types';
import { SERVICE_SLUGS } from '@/lib/defaults';

const PROJECT_KINDS = ['krov', 'falc', 'atika', 'ravni', 'dimnjak', 'snjegobrani'] as const;
const faqItem = v.object({ q: v.string({ min: 1, max: 300 }), a: v.text({ min: 1, max: 4000 }) });

/* ── postavke ──────────────────────────────────────────────────────────── */
export const ContactSchema = v.object({
  name: v.string({ min: 1, max: 120 }),
  tagline: v.string({ max: 200 }),
  phoneDisplay: v.string({ min: 1, max: 40 }),
  phoneE164: v.string({ min: 1, max: 20, pattern: /^\+\d{8,15}$/, patternMsg: 'Format +385981234567' }),
  whatsapp: v.string({ max: 20, pattern: /^\d{8,15}$/, patternMsg: 'Samo znamenke, bez + (npr. 385981234567)' }),
  email: v.email(),
  city: v.string({ max: 80 }),
  area: v.string({ max: 120 }),
  areaLine: v.string({ max: 300 }),
  hours: v.string({ max: 120 }),
  hoursShort: v.string({ max: 60 }),
  responseTime: v.string({ max: 120 }),
  googleReviewsUrl: v.url(),
});
export const CompanySchema = v.object({
  naziv: v.string({ max: 200 }),
  oib: v.string({ max: 11, pattern: /^\d{11}$/, patternMsg: 'OIB ima 11 znamenki.' }),
  adresa: v.string({ max: 300 }),
  iban: v.string({ max: 40, pattern: /^[A-Z]{2}\d{2}[A-Z0-9 ]{10,32}$/i, patternMsg: 'Neispravan IBAN (npr. HR12 3456 7890 1234 5678 9).' }),
  banka: v.string({ max: 120 }),
  email: v.email(),
  telefon: v.string({ max: 40 }),
  web: v.string({ max: 200 }),
});
export const QuoteSettingsSchema = v.object({
  pdvEnabled: v.bool(),
  pdvRate: v.number({ min: 0, max: 100 }),
  validDays: v.int({ min: 1, max: 365 }),
  paymentTerms: v.text({ max: 2000 }),
  notes: v.text({ max: 4000 }),
  footer: v.string({ max: 300 }),
});
export const StatsSchema = v.array(
  v.object({
    value: v.number({ min: 0, max: 1e9 }),
    decimals: v.optional(v.int({ min: 0, max: 3 })),
    prefix: v.optional(v.string({ max: 10, trim: false })),
    suffix: v.optional(v.string({ max: 16, trim: false })),
    label: v.string({ min: 1, max: 80 }),
  }),
  { max: 8 },
);

/* ── naslovnica i natpisi gumba (settings.homepage / settings.labels) ───── */

/** Najveće duljine tekstova naslovnice (dijeli ih i admin za brojač znakova). */
export const HOMEPAGE_LIMITS = {
  eyebrow: 60,
  title: 120,
  lead: 320,
  trust: 70,
  stepTitle: 60,
  stepText: 300,
  point: 80,
  cta: 50,
  label: 40,
} as const;

/** kontrolni znakovi (osim \n), znakovi nulte širine, U+2028/2029 i BOM → razmak */
const CONTROL_CHARS = new RegExp('[\\u0000-\\u0009\\u000b-\\u001f\\u007f\\u200b-\\u200d\\u2028\\u2029\\ufeff]', 'g');

/**
 * Jedan redak teksta: trim, bez kontrolnih znakova, razmaci sažeti.
 * breaks > 0 dopušta toliko prijeloma retka ("\n"); višak redaka spaja se razmakom.
 */
function line(max: number, breaks = 0): Validator<string> {
  const inner = v.string({ max });
  return {
    run(input, path, errors) {
      // null = prazno (vrati zadano); broj, objekt, popis… se odbijaju (v.string bi broj pretvorio u tekst)
      if (input != null && typeof input !== 'string') {
        errors[path || '_'] ??= 'Mora biti tekst.';
        return undefined as never;
      }
      if (typeof input === 'string') {
        const lines = input
          .replace(/\r\n?/g, '\n')
          .replace(CONTROL_CHARS, ' ')
          .split('\n')
          .map((l) => l.replace(/\s+/g, ' ').trim())
          .filter(Boolean);
        input = breaks > 0 ? [...lines.slice(0, breaks), lines.slice(breaks).join(' ')].filter(Boolean).join('\n') : lines.join(' ');
      }
      return inner.run(input, path, errors);
    },
  };
}
const opt = <T>(x: Validator<T>) => v.optional(x);
const exactly = <T>(item: Validator<T>, n: number): Validator<T[]> => {
  const arr = v.array(item, { min: n, max: n });
  return {
    run(input, path, errors) {
      if (Array.isArray(input) && input.length !== n) {
        errors[path || '_'] ??= `Točno ${n} ${n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'stavke' : 'stavki'}.`;
        return undefined as never;
      }
      return arr.run(input, path, errors);
    },
  };
};
const L = HOMEPAGE_LIMITS;
const homeHead = () => ({ eyebrow: opt(line(L.eyebrow)), title: opt(line(L.title)), lead: opt(line(L.lead)) });

/** Makni prazne tekstove, prazne popise (sve stavke prazne) i prazne sekcije → u bazu ide samo ono što je izmijenjeno. */
function prune(x: unknown): unknown {
  if (typeof x === 'string') return x === '' ? undefined : x;
  if (Array.isArray(x)) {
    const empty = (e: unknown): boolean => (typeof e === 'string' ? e === '' : !!e && typeof e === 'object' && Object.values(e).every(empty));
    return x.every(empty) ? undefined : x;
  }
  if (x && typeof x === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(x)) {
      const p = prune(val);
      if (p !== undefined) out[k] = p;
    }
    return Object.keys(out).length ? out : undefined;
  }
  return x;
}
const pruned = <T>(inner: Validator<T>): Validator<T> => ({
  run(input, path, errors) {
    const r = inner.run(input, path, errors);
    return (r === undefined ? r : (prune(r) ?? {})) as T;
  },
});

export const HomepageSchema = pruned(
  v.object({
    hero: opt(
      v.object({
        eyebrow: opt(line(L.eyebrow)),
        title: opt(line(L.title, 2)),
        lead: opt(line(L.lead)),
        trust: opt(exactly(line(L.trust), 3)),
      }),
    ),
    services: opt(v.object(homeHead())),
    projects: opt(v.object(homeHead())),
    process: opt(
      v.object({
        ...homeHead(),
        steps: opt(exactly(v.object({ title: line(L.stepTitle), text: line(L.stepText) }), 5)),
      }),
    ),
    reviews: opt(v.object(homeHead())),
    managers: opt(
      v.object({
        ...homeHead(),
        points: opt(exactly(line(L.point), 3)),
        cta: opt(line(L.cta)),
      }),
    ),
    faq: opt(v.object({ eyebrow: opt(line(L.eyebrow)), title: opt(line(L.title)) })),
    finalCta: opt(v.object(homeHead())),
  }),
);

export const LabelsSchema = pruned(
  v.object({
    cta: opt(line(L.label)),
    ctaPhone: opt(line(L.label)),
    ctaWhatsapp: opt(line(L.label)),
  }),
);

export const SETTINGS_SCHEMAS = {
  contact: ContactSchema,
  company: CompanySchema,
  quote: QuoteSettingsSchema,
  stats: StatsSchema,
  homepage: HomepageSchema,
  labels: LabelsSchema,
} as const;

/* ── usluge (null = vrati na zadano iz site.ts) ────────────────────────── */
const nstr = (max: number, min = 0) => v.optional(v.nullable(v.string({ max, min })));
export const ServicePatchSchema = v.object({
  title: nstr(120, 1),
  chip: nstr(40, 1),
  short: nstr(400, 1),
  intro: v.optional(v.nullable(v.text({ min: 1, max: 4000 }))),
  includes: v.optional(v.nullable(v.array(v.string({ min: 1, max: 300 }), { max: 20 }))),
  cover: v.optional(v.nullable(v.imageRef())),
  gallery: v.optional(v.nullable(v.array(v.imageRef(), { max: 24 }))),
  faq: v.optional(v.nullable(v.array(faqItem, { max: 20 }))),
  h1: nstr(120, 1),
  lead: nstr(400),
  seoTitle: nstr(120, 1),
  seoDescription: nstr(300, 1),
  includesTitle: nstr(160),
  galleryTitle: nstr(160),
  galleryLead: nstr(300),
  relatedTitle: nstr(160),
  faqTitle: nstr(160),
});
export type ServicePatch = Infer<typeof ServicePatchSchema>;

/* ── radovi ────────────────────────────────────────────────────────────── */
export const ProjectSchema = v.object({
  slug: v.slug(),
  title: v.string({ min: 1, max: 160 }),
  heroTitle: v.optional(v.nullable(v.string({ max: 120 }))),
  kind: v.enum(PROJECT_KINDS),
  serviceSlug: v.enum(SERVICE_SLUGS),
  location: v.string({ max: 120 }),
  material: v.string({ max: 160 }),
  year: v.optional(v.nullable(v.int({ min: 1990, max: 2100 }))),
  alt: v.string({ max: 300 }),
  note: v.text({ max: 4000 }),
  scope: v.array(v.string({ min: 1, max: 200 }), { max: 20 }),
  featured: v.bool(),
  published: v.bool(),
});
export type ProjectInput = Infer<typeof ProjectSchema>;
/** cijeli popis fotografija rada, redom (prva = naslovna). id = postojeća fotografija (zadržava se). */
export const ProjectImagesSchema = v.object({
  images: v.array(
    v.object({ id: v.optional(v.int({ min: 1 })), image: v.imageRef() }),
    { max: 40 },
  ),
});
export const ReorderSchema = v.object({ ids: v.array(v.int({ min: 1 }), { min: 1, max: 1000 }) });

/* ── recenzije / pitanja / predlošci ───────────────────────────────────── */
export const ReviewSchema = v.object({
  name: v.string({ min: 1, max: 120 }),
  place: v.string({ max: 120 }),
  text: v.text({ min: 1, max: 3000 }),
  stars: v.int({ min: 1, max: 5 }),
  source: v.string({ max: 60 }),
  reviewDate: v.optional(v.nullable(v.date())),
  published: v.bool(),
});
export type ReviewInput = Infer<typeof ReviewSchema>;

export const FaqSchema = v.object({
  q: v.string({ min: 1, max: 300 }),
  a: v.text({ min: 1, max: 4000 }),
  onHome: v.bool(),
  published: v.bool(),
});
export type FaqInput = Infer<typeof FaqSchema>;

export const TemplateSchema = v.object({
  name: v.string({ min: 1, max: 200 }),
  description: v.text({ max: 4000 }),
  unit: v.string({ min: 1, max: 12 }),
  unitPrice: v.number({ min: -1e9, max: 1e9 }),
  category: v.string({ max: 80 }),
});
export type TemplateInput = Infer<typeof TemplateSchema>;

/* ── upiti ─────────────────────────────────────────────────────────────── */
export const LeadCreateSchema = v.object({
  jobType: v.string({ max: 60 }),
  variant: v.optional(v.enum(['standard', 'zgrada'] as const)),
  location: v.string({ max: 200 }),
  size: v.string({ max: 60 }),
  note: v.text({ max: 4000 }),
  photos: v.optional(v.array(v.blobImage(), { max: 6 })),
  name: v.string({ min: 1, max: 120 }),
  phone: v.string({ min: 6, max: 40 }),
  email: v.optional(v.string({ max: 200 })),
  callTime: v.optional(v.string({ max: 80 })),
  sourcePage: v.optional(v.string({ max: 200 })),
});
export type LeadCreateInput = Infer<typeof LeadCreateSchema>;
export const LeadPatchSchema = v.object({
  status: v.optional(v.enum(LEAD_STATUSES)),
  adminNote: v.optional(v.text({ max: 4000 })),
});

/* ── ponude ────────────────────────────────────────────────────────────── */
export const QuoteSchema = v.object({
  issueDate: v.optional(v.date()),
  clientName: v.string({ max: 200 }),
  clientPhone: v.string({ max: 40 }),
  clientEmail: v.string({ max: 200 }),
  clientAddress: v.string({ max: 300 }),
  clientOib: v.string({ max: 11, pattern: /^\d{11}$/, patternMsg: 'OIB ima 11 znamenki.' }),
  location: v.string({ max: 300 }),
  title: v.string({ max: 200 }),
  intro: v.text({ max: 4000 }),
  items: v.array(v.quoteItem(), { max: 200 }),
  notes: v.text({ max: 6000 }),
  paymentTerms: v.text({ max: 2000 }),
  validDays: v.int({ min: 1, max: 365 }),
  pdvEnabled: v.bool(),
  pdvRate: v.number({ min: 0, max: 100 }),
  leadId: v.optional(v.nullable(v.int({ min: 1 }))),
});
export type QuoteInput = Infer<typeof QuoteSchema>;
export const QuoteStatusSchema = v.object({ status: v.enum(QUOTE_STATUSES) });

export const PasswordSchema = v.object({
  current: v.string({ min: 1, max: 200, trim: false }),
  next: v.string({ min: 10, max: 200, trim: false }),
});
export const LoginSchema = v.object({
  username: v.string({ min: 1, max: 100 }),
  password: v.string({ min: 1, max: 200, trim: false }),
});
