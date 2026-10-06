/** POST /api/admin/reviews/reorder  JSON { ids: number[] } → { ok: true } */
import { json, readJson, route } from '@/lib/server/http';
import { reorderReviews } from '@/lib/server/repo/reviews';
import { parse } from '@/lib/server/validate';
import { ReorderSchema } from '@/lib/server/schemas';

export const prerender = false;

export const POST = route(async ({ request }) => {
  await reorderReviews(parse(ReorderSchema, await readJson(request)).ids);
  return json({ ok: true });
});
