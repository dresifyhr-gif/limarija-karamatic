import { db } from '../db';
import { touchContent } from '../meta';
import { deleteBlobsIfUnused } from '../blob';
import { HttpError } from '../http';
import type { ProjectInput } from '../schemas';
import { blobUrlsOf, isBlobRef, type ImageRef } from '@/lib/types';

/** Fotografija rada kako je vraća API. */
export type ProjectImage = ImageRef & { id: number; sort: number };

export type AdminProject = {
  id: number;
  slug: string;
  title: string;
  heroTitle: string | null;
  kind: ProjectInput['kind'];
  serviceSlug: string;
  location: string;
  material: string;
  year: number | null;
  alt: string;
  note: string;
  scope: string[];
  featured: boolean;
  published: boolean;
  sort: number;
  createdAt: string;
  updatedAt: string;
  /** redom; [0] = naslovna */
  images: ProjectImage[];
};

type Row = Record<string, unknown>;
const iso = (d: unknown) => (d ? new Date(d as string).toISOString() : '');

function mapImage(r: Row): ProjectImage {
  const base = { id: r.id as number, sort: r.sort as number, alt: (r.alt as string) ?? '' };
  return r.url
    ? { ...base, url: r.url as string, pathname: (r.pathname as string) ?? '', width: r.width as number, height: r.height as number }
    : { ...base, key: r.asset_key as string };
}

function mapProject(r: Row, images: ProjectImage[]): AdminProject {
  return {
    id: r.id as number,
    slug: r.slug as string,
    title: r.title as string,
    heroTitle: (r.hero_title as string) ?? null,
    kind: r.kind as AdminProject['kind'],
    serviceSlug: r.service_slug as string,
    location: r.location as string,
    material: r.material as string,
    year: (r.year as number) ?? null,
    alt: r.alt as string,
    note: r.note as string,
    scope: (r.scope as string[]) ?? [],
    featured: !!r.featured,
    published: !!r.published,
    sort: r.sort as number,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
    images,
  };
}

async function imagesFor(ids: number[]): Promise<Map<number, ProjectImage[]>> {
  const map = new Map<number, ProjectImage[]>();
  if (!ids.length) return map;
  const rows = await db()`SELECT * FROM project_images WHERE project_id = ANY(${ids}) ORDER BY sort, id`;
  for (const r of rows) {
    const pid = r.project_id as number;
    if (!map.has(pid)) map.set(pid, []);
    map.get(pid)!.push(mapImage(r));
  }
  return map;
}

export async function listProjects(opts: { publishedOnly?: boolean } = {}): Promise<AdminProject[]> {
  const rows = opts.publishedOnly
    ? await db()`SELECT * FROM projects WHERE published ORDER BY sort, id`
    : await db()`SELECT * FROM projects ORDER BY sort, id`;
  const imgs = await imagesFor(rows.map((r) => r.id as number));
  return rows.map((r) => mapProject(r, imgs.get(r.id as number) ?? []));
}

export async function getProject(id: number): Promise<AdminProject | null> {
  const rows = await db()`SELECT * FROM projects WHERE id = ${id}`;
  if (!rows.length) return null;
  const imgs = await imagesFor([id]);
  return mapProject(rows[0], imgs.get(id) ?? []);
}

export async function createProject(input: ProjectInput): Promise<AdminProject> {
  const rows = await db()`INSERT INTO projects
      (slug, title, hero_title, kind, service_slug, location, material, year, alt, note, scope, featured, published, sort)
    VALUES (${input.slug}, ${input.title}, ${input.heroTitle ?? null}, ${input.kind}, ${input.serviceSlug}, ${input.location},
      ${input.material}, ${input.year ?? null}, ${input.alt}, ${input.note}, ${JSON.stringify(input.scope)}::jsonb,
      ${input.featured}, ${input.published}, (SELECT coalesce(min(sort), 0) - 1 FROM projects))
    RETURNING id`;
  await touchContent();
  return (await getProject(rows[0].id as number))!;
}

const PCOLS: Record<string, string> = {
  slug: 'slug', title: 'title', heroTitle: 'hero_title', kind: 'kind', serviceSlug: 'service_slug', location: 'location',
  material: 'material', year: 'year', alt: 'alt', note: 'note', scope: 'scope', featured: 'featured', published: 'published',
};

export async function updateProject(id: number, patch: Partial<ProjectInput>): Promise<AdminProject> {
  const sets: string[] = [];
  const params: unknown[] = [id];
  for (const [k, val] of Object.entries(patch)) {
    if (val === undefined || !PCOLS[k]) continue;
    params.push(k === 'scope' ? JSON.stringify(val) : val);
    sets.push(`${PCOLS[k]} = $${params.length}${k === 'scope' ? '::jsonb' : ''}`);
  }
  if (sets.length) {
    const r = await db().query(`UPDATE projects SET ${sets.join(', ')}, updated_at = now() WHERE id = $1 RETURNING id`, params);
    if (!r.length) throw new HttpError(404, 'Rad ne postoji.');
    await touchContent();
  }
  const p = await getProject(id);
  if (!p) throw new HttpError(404, 'Rad ne postoji.');
  return p;
}

/** Briše rad, njegove fotografije (CASCADE) i Blob datoteke koje više nitko ne koristi. */
export async function deleteProject(id: number): Promise<void> {
  const p = await getProject(id);
  if (!p) throw new HttpError(404, 'Rad ne postoji.');
  await db()`DELETE FROM projects WHERE id = ${id}`;
  await touchContent();
  await deleteBlobsIfUnused(blobUrlsOf(p.images));
}

/**
 * Zamijeni cijeli popis fotografija rada (redoslijed = poredak u nizu, prva = naslovna).
 * Stavka s `id` zadržava postojeći red (mijenja se alt/sort); bez `id` = nova fotografija.
 * Fotografije koje nisu u popisu brišu se (i s Bloba ako ih ništa drugo ne koristi).
 */
export async function setProjectImages(id: number, images: { id?: number; image: ImageRef }[]): Promise<ProjectImage[]> {
  const p = await getProject(id);
  if (!p) throw new HttpError(404, 'Rad ne postoji.');
  const keepIds = new Set(images.map((i) => i.id).filter((x): x is number => !!x && p.images.some((e) => e.id === x)));
  const removed = p.images.filter((e) => !keepIds.has(e.id));
  await db().transaction((sql) => [
    sql`DELETE FROM project_images WHERE project_id = ${id} AND NOT (id = ANY(${[...keepIds]}))`,
    ...images.map(({ id: imgId, image }, sort) => {
      if (imgId && keepIds.has(imgId)) {
        return sql`UPDATE project_images SET sort = ${sort}, alt = ${image.alt ?? ''} WHERE id = ${imgId} AND project_id = ${id}`;
      }
      return isBlobRef(image)
        ? sql`INSERT INTO project_images (project_id, url, pathname, width, height, alt, sort)
              VALUES (${id}, ${image.url}, ${image.pathname}, ${image.width}, ${image.height}, ${image.alt ?? ''}, ${sort})`
        : sql`INSERT INTO project_images (project_id, asset_key, alt, sort) VALUES (${id}, ${image.key}, ${image.alt ?? ''}, ${sort})`;
    }),
    sql`UPDATE projects SET updated_at = now() WHERE id = ${id}`,
  ]);
  await touchContent();
  await deleteBlobsIfUnused(blobUrlsOf(removed));
  return (await getProject(id))!.images;
}

/** Novi redoslijed radova (svi id-jevi redom). */
export async function reorderProjects(ids: number[]): Promise<void> {
  await db().transaction((sql) => ids.map((pid, i) => sql`UPDATE projects SET sort = ${i} WHERE id = ${pid}`));
  await touchContent();
}
