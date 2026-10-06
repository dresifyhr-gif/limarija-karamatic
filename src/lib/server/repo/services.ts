import { db } from '../db';
import { touchContent } from '../meta';
import { deleteBlobsIfUnused } from '../blob';
import { HttpError } from '../http';
import type { ServicePatch } from '../schemas';
import { serviceDefaults, SERVICE_SLUGS, type ServiceFields } from '@/lib/defaults';
import { isBlobRef, type ImageRef } from '@/lib/types';

export type AdminService = ServiceFields & {
  slug: string;
  sort: number;
  /** polja koja su promijenjena u bazi (ostala su zadana iz site.ts) */
  overridden: (keyof ServiceFields)[];
  defaults: ServiceFields;
  updatedAt: string | null;
};

const COLS: Record<keyof ServiceFields, string> = {
  title: 'title',
  chip: 'chip',
  short: 'short',
  intro: 'intro',
  includes: 'includes',
  cover: 'cover',
  gallery: 'gallery',
  faq: 'faq',
  h1: 'h1',
  lead: 'lead',
  seoTitle: 'seo_title',
  seoDescription: 'seo_description',
  includesTitle: 'includes_title',
  galleryTitle: 'gallery_title',
  galleryLead: 'gallery_lead',
  relatedTitle: 'related_title',
  faqTitle: 'faq_title',
};
const JSON_COLS = new Set(['includes', 'cover', 'gallery', 'faq']);

/** JSON s poredanim ključevima (jsonb ne čuva redoslijed ključeva). */
const stable = (x: unknown): string =>
  JSON.stringify(x, (_k, val) =>
    val && typeof val === 'object' && !Array.isArray(val)
      ? Object.fromEntries(Object.entries(val).sort(([a], [b]) => a.localeCompare(b)))
      : val,
  );

function merge(slug: string, row: Record<string, unknown> | undefined, index: number): AdminService {
  const defaults = serviceDefaults(slug)!;
  const merged = { ...defaults } as Record<string, unknown>;
  const overridden: (keyof ServiceFields)[] = [];
  for (const [field, col] of Object.entries(COLS) as [keyof ServiceFields, string][]) {
    const val = row?.[col];
    if (val !== null && val !== undefined) {
      merged[field] = val;
      if (stable(val) !== stable(defaults[field])) overridden.push(field);
    }
  }
  return {
    ...(merged as ServiceFields),
    slug,
    sort: (row?.sort as number) ?? index,
    overridden,
    defaults,
    updatedAt: row?.updated_at ? new Date(row.updated_at as string).toISOString() : null,
  };
}

/** Sve usluge (fiksni skup iz site.ts), vrijednosti baza-preko-zadanih, poredane po sort. */
export async function listServices(): Promise<AdminService[]> {
  const rows = await db()`SELECT * FROM services`;
  const bySlug = new Map(rows.map((r) => [r.slug as string, r]));
  return SERVICE_SLUGS.map((slug, i) => merge(slug, bySlug.get(slug), i)).sort((a, b) => a.sort - b.sort);
}

export async function getService(slug: string): Promise<AdminService | null> {
  if (!SERVICE_SLUGS.includes(slug)) return null;
  const rows = await db()`SELECT * FROM services WHERE slug = ${slug}`;
  return merge(slug, rows[0], SERVICE_SLUGS.indexOf(slug));
}

const blobUrls = (refs: (ImageRef | null | undefined)[]) => refs.filter(isBlobRef).map((r) => r.url);

/** Djelomično ažuriranje; null vraća polje na zadano. Briše s Bloba fotografije koje više ničemu ne trebaju. */
export async function updateService(slug: string, patch: ServicePatch): Promise<AdminService> {
  const before = await getService(slug);
  if (!before) throw new HttpError(404, 'Usluga ne postoji.');
  const sets: string[] = [];
  const params: unknown[] = [slug];
  for (const [field, val] of Object.entries(patch)) {
    if (val === undefined) continue;
    const col = COLS[field as keyof ServiceFields];
    if (!col) continue;
    params.push(val === null ? null : JSON_COLS.has(col) ? JSON.stringify(val) : val);
    sets.push(`${col} = $${params.length}${JSON_COLS.has(col) ? '::jsonb' : ''}`);
  }
  if (sets.length) {
    await db().query(
      `INSERT INTO services (slug, sort) VALUES ($1, ${SERVICE_SLUGS.indexOf(slug)}) ON CONFLICT (slug) DO NOTHING`,
      [slug],
    );
    await db().query(`UPDATE services SET ${sets.join(', ')}, updated_at = now() WHERE slug = $1`, params);
    await touchContent();
  }
  const after = (await getService(slug))!;
  const removed = blobUrls([before.cover, ...before.gallery]).filter(
    (u) => !blobUrls([after.cover, ...after.gallery]).includes(u),
  );
  if (removed.length) await deleteBlobsIfUnused(removed);
  return after;
}

/** Redoslijed usluga (popis slugova). */
export async function reorderServices(slugs: string[]): Promise<void> {
  const valid = slugs.filter((s) => SERVICE_SLUGS.includes(s));
  await db().transaction((sql) =>
    valid.map(
      (slug, i) => sql`INSERT INTO services (slug, sort) VALUES (${slug}, ${i})
                       ON CONFLICT (slug) DO UPDATE SET sort = EXCLUDED.sort, updated_at = now()`,
    ),
  );
  await touchContent();
}
