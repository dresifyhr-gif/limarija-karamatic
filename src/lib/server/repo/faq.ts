import { db } from '../db';
import { touchContent } from '../meta';
import { HttpError } from '../http';
import type { FaqInput } from '../schemas';

/** Najviše pitanja s oznakom "na naslovnici" (naslovnica prikazuje 5). */
export const FAQ_HOME_MAX = 5;

async function assertHomeRoom(excludeId: number | null): Promise<void> {
  const rows = await db()`SELECT count(*)::int AS n FROM faq WHERE on_home AND id <> ${excludeId ?? 0}`;
  if (Number(rows[0]?.n ?? 0) >= FAQ_HOME_MAX) {
    const msg = `Na naslovnici može biti najviše ${FAQ_HOME_MAX} pitanja. Prvo maknite jedno.`;
    throw new HttpError(400, msg, { onHome: msg });
  }
}

export type AdminFaq = FaqInput & { id: number; sort: number; createdAt: string; updatedAt: string };

const map = (r: Record<string, unknown>): AdminFaq => ({
  id: r.id as number,
  q: r.q as string,
  a: r.a as string,
  onHome: !!r.on_home,
  published: !!r.published,
  sort: r.sort as number,
  createdAt: new Date(r.created_at as string).toISOString(),
  updatedAt: new Date(r.updated_at as string).toISOString(),
});

export async function listFaq(opts: { publishedOnly?: boolean } = {}): Promise<AdminFaq[]> {
  const rows = opts.publishedOnly
    ? await db()`SELECT * FROM faq WHERE published ORDER BY sort, id`
    : await db()`SELECT * FROM faq ORDER BY sort, id`;
  return rows.map(map);
}

export async function getFaq(id: number): Promise<AdminFaq | null> {
  const rows = await db()`SELECT * FROM faq WHERE id = ${id}`;
  return rows[0] ? map(rows[0]) : null;
}

export async function createFaq(i: FaqInput): Promise<AdminFaq> {
  if (i.onHome) await assertHomeRoom(null);
  const rows = await db()`INSERT INTO faq (q, a, on_home, published, sort)
    VALUES (${i.q}, ${i.a}, ${i.onHome}, ${i.published}, (SELECT coalesce(max(sort), -1) + 1 FROM faq)) RETURNING *`;
  await touchContent();
  return map(rows[0]);
}

export async function updateFaq(id: number, p: Partial<FaqInput>): Promise<AdminFaq> {
  const cur = await getFaq(id);
  if (!cur) throw new HttpError(404, 'Pitanje ne postoji.');
  if (p.onHome && !cur.onHome) await assertHomeRoom(id);
  const n = { ...cur, ...Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined)) } as AdminFaq;
  const rows = await db()`UPDATE faq SET q = ${n.q}, a = ${n.a}, on_home = ${n.onHome}, published = ${n.published}, updated_at = now()
    WHERE id = ${id} RETURNING *`;
  await touchContent();
  return map(rows[0]);
}

export async function deleteFaq(id: number): Promise<void> {
  const rows = await db()`DELETE FROM faq WHERE id = ${id} RETURNING id`;
  if (!rows.length) throw new HttpError(404, 'Pitanje ne postoji.');
  await touchContent();
}

export async function reorderFaq(ids: number[]): Promise<void> {
  await db().transaction((sql) => ids.map((id, i) => sql`UPDATE faq SET sort = ${i} WHERE id = ${id}`));
  await touchContent();
}
