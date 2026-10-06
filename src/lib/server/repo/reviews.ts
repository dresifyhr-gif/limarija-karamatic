import { db } from '../db';
import { touchContent } from '../meta';
import { HttpError } from '../http';
import type { ReviewInput } from '../schemas';

export type AdminReview = ReviewInput & { id: number; sort: number; reviewDate: string | null; createdAt: string; updatedAt: string };

/** Neon driver vraća stupac date kao Date (lokalna ponoć) → 'YYYY-MM-DD' (lokalni getteri, neovisno o TZ poslužitelja). */
const ymd = (d: unknown): string | null => {
  if (!d) return null;
  if (typeof d === 'string') return d.slice(0, 10);
  const x = d as Date;
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

const map = (r: Record<string, unknown>): AdminReview => ({
  id: r.id as number,
  name: r.name as string,
  place: r.place as string,
  text: r.text as string,
  stars: r.stars as number,
  source: r.source as string,
  reviewDate: ymd(r.review_date),
  published: !!r.published,
  sort: r.sort as number,
  createdAt: new Date(r.created_at as string).toISOString(),
  updatedAt: new Date(r.updated_at as string).toISOString(),
});

export async function listReviews(opts: { publishedOnly?: boolean } = {}): Promise<AdminReview[]> {
  const rows = opts.publishedOnly
    ? await db()`SELECT * FROM reviews WHERE published ORDER BY sort, id`
    : await db()`SELECT * FROM reviews ORDER BY sort, id`;
  return rows.map(map);
}

export async function getReview(id: number): Promise<AdminReview | null> {
  const rows = await db()`SELECT * FROM reviews WHERE id = ${id}`;
  return rows[0] ? map(rows[0]) : null;
}

export async function createReview(i: ReviewInput): Promise<AdminReview> {
  const rows = await db()`INSERT INTO reviews (name, place, text, stars, source, review_date, published, sort)
    VALUES (${i.name}, ${i.place}, ${i.text}, ${i.stars}, ${i.source}, ${i.reviewDate ?? null}, ${i.published},
      (SELECT coalesce(max(sort), -1) + 1 FROM reviews)) RETURNING *`;
  await touchContent();
  return map(rows[0]);
}

export async function updateReview(id: number, p: Partial<ReviewInput>): Promise<AdminReview> {
  const cur = await getReview(id);
  if (!cur) throw new HttpError(404, 'Recenzija ne postoji.');
  const n = { ...cur, ...Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined)) } as AdminReview;
  const rows = await db()`UPDATE reviews SET name = ${n.name}, place = ${n.place}, text = ${n.text}, stars = ${n.stars},
      source = ${n.source}, review_date = ${n.reviewDate ?? null}, published = ${n.published}, updated_at = now()
    WHERE id = ${id} RETURNING *`;
  await touchContent();
  return map(rows[0]);
}

export async function deleteReview(id: number): Promise<void> {
  const rows = await db()`DELETE FROM reviews WHERE id = ${id} RETURNING id`;
  if (!rows.length) throw new HttpError(404, 'Recenzija ne postoji.');
  await touchContent();
}

export async function reorderReviews(ids: number[]): Promise<void> {
  await db().transaction((sql) => ids.map((id, i) => sql`UPDATE reviews SET sort = ${i} WHERE id = ${id}`));
  await touchContent();
}
