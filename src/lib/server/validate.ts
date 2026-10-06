/**
 * Mali validator ulaza (bez ovisnosti). Poruke su na hrvatskom i vraćaju se po polju.
 *
 *   const Faq = v.object({ q: v.string({ min: 3, max: 300 }), a: v.text(), onHome: v.optional(v.bool()) });
 *   const input = parse(Faq, await readJson(request));          // baca HttpError 400 { error, fields }
 *   const patch = parse(v.partial(Faq), body);                  // sva polja opcionalna (PATCH/PUT)
 *   type FaqInput = Infer<typeof Faq>;
 *
 * Stringovi se trimaju; prazan string je dopušten osim ako je zadan min ≥ 1.
 */
import { HttpError } from './http';
import type { BlobImageRef, ImageRef, QuoteItem } from '@/lib/types';

type Errors = Record<string, string>;
export type Validator<T> = { _t?: T; run: (input: unknown, path: string, errors: Errors) => T };
export type Infer<V> = V extends Validator<infer T> ? T : never;

const mk = <T>(run: Validator<T>['run']): Validator<T> => ({ run });
const fail = (errors: Errors, path: string, msg: string) => {
  if (!errors[path || '_']) errors[path || '_'] = msg;
  return undefined as never;
};
const join = (path: string, key: string | number) => (path ? `${path}.${key}` : String(key));

const BLOB_HOST = /^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/i;

export const v = {
  string(opts: { min?: number; max?: number; trim?: boolean; pattern?: RegExp; patternMsg?: string } = {}) {
    const { min = 0, max = 2000, trim = true, pattern, patternMsg } = opts;
    return mk<string>((input, path, errors) => {
      if (input == null) input = '';
      if (typeof input === 'number') input = String(input);
      if (typeof input !== 'string') return fail(errors, path, 'Mora biti tekst.');
      const s = trim ? input.trim() : input;
      if (s.length < min) return fail(errors, path, min === 1 ? 'Obavezno polje.' : `Najmanje ${min} znakova.`);
      if (s.length > max) return fail(errors, path, `Najviše ${max} znakova.`);
      if (pattern && s && !pattern.test(s)) return fail(errors, path, patternMsg ?? 'Neispravan format.');
      return s;
    });
  },
  /** dulji tekst (do 20 000 znakova), čuva nove retke */
  text(opts: { min?: number; max?: number } = {}) {
    return v.string({ max: 20_000, ...opts });
  },
  /** 'mala-slova-i-crtice' */
  slug() {
    return v.string({ min: 1, max: 120, pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/, patternMsg: 'Samo mala slova, brojke i crtice (npr. ravni-krov-sesvete).' });
  },
  email() {
    return v.string({ max: 200, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, patternMsg: 'Neispravna e-mail adresa.' });
  },
  /** https URL (prazno dopušteno) */
  url() {
    return v.string({ max: 1000, pattern: /^https:\/\/[^\s]+$/i, patternMsg: 'Adresa mora počinjati s https://' });
  },
  int(opts: { min?: number; max?: number } = {}) {
    const { min = -2_147_483_648, max = 2_147_483_647 } = opts;
    return mk<number>((input, path, errors) => {
      const n = typeof input === 'string' && input.trim() !== '' ? Number(input) : input;
      if (typeof n !== 'number' || !Number.isInteger(n)) return fail(errors, path, 'Mora biti cijeli broj.');
      if (n < min || n > max) return fail(errors, path, `Dopušteno ${min}–${max}.`);
      return n;
    });
  },
  /** broj; prihvaća i '12,5' (decimalni zarez) */
  number(opts: { min?: number; max?: number } = {}) {
    const { min = -1e12, max = 1e12 } = opts;
    return mk<number>((input, path, errors) => {
      const n = typeof input === 'string' && input.trim() !== '' ? Number(input.trim().replace(/\s/g, '').replace(',', '.')) : input;
      if (typeof n !== 'number' || !Number.isFinite(n)) return fail(errors, path, 'Mora biti broj.');
      if (n < min || n > max) return fail(errors, path, `Dopušteno ${min}–${max}.`);
      return n;
    });
  },
  bool() {
    return mk<boolean>((input, path, errors) => {
      if (typeof input === 'boolean') return input;
      if (input === 'true' || input === 'on' || input === '1') return true;
      if (input === 'false' || input === '0' || input === '') return false;
      return fail(errors, path, 'Mora biti da/ne.');
    });
  },
  enum<const T extends readonly string[]>(values: T) {
    return mk<T[number]>((input, path, errors) => {
      if (typeof input !== 'string' || !values.includes(input)) return fail(errors, path, 'Neispravan odabir.');
      return input as T[number];
    });
  },
  /** 'YYYY-MM-DD' */
  date() {
    return mk<string>((input, path, errors) => {
      if (typeof input !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input) || Number.isNaN(Date.parse(input)))
        return fail(errors, path, 'Neispravan datum.');
      return input;
    });
  },
  array<T>(item: Validator<T>, opts: { min?: number; max?: number } = {}) {
    const { min = 0, max = 500 } = opts;
    return mk<T[]>((input, path, errors) => {
      if (!Array.isArray(input)) return fail(errors, path, 'Mora biti popis.');
      if (input.length < min) return fail(errors, path, `Najmanje ${min}.`);
      if (input.length > max) return fail(errors, path, `Najviše ${max}.`);
      return input.map((x, i) => item.run(x, join(path, i), errors));
    });
  },
  object<S extends Record<string, Validator<unknown>>>(shape: S) {
    const run = (input: unknown, path: string, errors: Errors) => {
      if (!input || typeof input !== 'object' || Array.isArray(input)) return fail(errors, path, 'Neispravan unos.');
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(shape)) {
        const r = val.run((input as Record<string, unknown>)[k], join(path, k), errors);
        if (r !== undefined) out[k] = r;
      }
      return out as { [K in keyof S]: Infer<S[K]> };
    };
    return Object.assign(mk(run), { shape });
  },
  /** sva polja objekta postaju opcionalna (za djelomično ažuriranje) */
  partial<S extends Record<string, Validator<unknown>>>(obj: { shape: S }) {
    const shape = Object.fromEntries(Object.entries(obj.shape).map(([k, val]) => [k, v.optional(val)])) as {
      [K in keyof S]: Validator<Infer<S[K]> | undefined>;
    };
    return v.object(shape);
  },
  /** undefined → undefined (polje izostavljeno) */
  optional<T>(inner: Validator<T>) {
    return mk<T | undefined>((input, path, errors) => (input === undefined ? undefined : inner.run(input, path, errors)));
  },
  /** null → null */
  nullable<T>(inner: Validator<T>) {
    return mk<T | null>((input, path, errors) => (input === null ? null : inner.run(input, path, errors)));
  },
  /** fotografija s Vercel Bloba (iz odgovora /api/admin/upload) */
  blobImage() {
    return mk<BlobImageRef>((input, path, errors) => {
      const o = input as Partial<BlobImageRef> | null;
      if (!o || typeof o !== 'object') return fail(errors, path, 'Neispravna fotografija.');
      let host = '';
      try {
        host = new URL(String(o.url)).hostname;
      } catch {}
      if (!BLOB_HOST.test(host)) return fail(errors, path, 'Fotografija nije s našeg spremišta.');
      const width = Number(o.width);
      const height = Number(o.height);
      if (!(width > 0 && height > 0)) return fail(errors, path, 'Nedostaju dimenzije fotografije.');
      const alt = typeof o.alt === 'string' ? o.alt.trim().slice(0, 300) : '';
      return { url: String(o.url), pathname: String(o.pathname ?? new URL(String(o.url)).pathname.slice(1)), width, height, alt };
    });
  },
  /** fotografija iz repozitorija ({key}) ili s Bloba ({url,…}) */
  imageRef() {
    const blob = v.blobImage();
    return mk<ImageRef>((input, path, errors) => {
      const o = input as Record<string, unknown> | null;
      if (o && typeof o === 'object' && typeof o.key === 'string') {
        if (!/^[\w-]+(?:\/[\w.-]+)+\.(?:jpe?g|png|webp|avif)$/i.test(o.key) || o.key.includes('..'))
          return fail(errors, path, 'Neispravna fotografija.');
        const alt = typeof o.alt === 'string' ? o.alt.trim().slice(0, 300) : '';
        return { key: o.key, alt };
      }
      return blob.run(input, path, errors);
    });
  },
  /** stavka ponude */
  quoteItem() {
    return mk<QuoteItem>((input, path, errors) => {
      const o = input as Record<string, unknown> | null;
      if (!o || typeof o !== 'object') return fail(errors, path, 'Neispravna stavka.');
      const id = typeof o.id === 'string' && /^[\w-]{1,40}$/.test(o.id) ? o.id : crypto.randomUUID().slice(0, 8);
      const title = v.string({ max: 300 }).run(o.title, join(path, 'title'), errors);
      if (o.type === 'section') return { id, type: 'section', title };
      return {
        id,
        type: 'item',
        title,
        description: v.text({ max: 4000 }).run(o.description, join(path, 'description'), errors),
        unit: v.string({ max: 12 }).run(o.unit, join(path, 'unit'), errors),
        qty: v.number({ min: 0, max: 1e7 }).run(o.qty ?? 0, join(path, 'qty'), errors),
        unitPrice: v.number({ min: -1e9, max: 1e9 }).run(o.unitPrice ?? 0, join(path, 'unitPrice'), errors),
        // popust u % (opcionalno; 0 ili prazno = bez popusta)
        ...(o.discount != null && o.discount !== '' && Number(String(o.discount).replace(',', '.')) !== 0
          ? { discount: v.number({ min: 0, max: 100 }).run(o.discount, join(path, 'discount'), errors) }
          : {}),
      };
    });
  },
};

/** Provjeri ulaz; baca HttpError(400) s porukama po poljima. */
export function parse<T>(schema: Validator<T>, input: unknown): T {
  const errors: Errors = {};
  const value = schema.run(input, '', errors);
  if (Object.keys(errors).length) {
    throw new HttpError(400, errors._ ?? 'Provjerite označena polja.', errors);
  }
  return value;
}
