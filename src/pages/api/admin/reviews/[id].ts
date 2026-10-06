/**
 * GET    /api/admin/reviews/:id → zapis
 * PUT    /api/admin/reviews/:id  JSON Partial<ReviewSchema> → zapis
 * DELETE /api/admin/reviews/:id → { ok: true }
 */
import { json, readJson, route, parseId, notFound } from '@/lib/server/http';
import { getReview, updateReview, deleteReview } from '@/lib/server/repo/reviews';
import { parse, v } from '@/lib/server/validate';
import { ReviewSchema } from '@/lib/server/schemas';

export const prerender = false;

export const GET = route(async ({ params }) => json((await getReview(parseId(params.id))) ?? notFound('Recenzija')));

export const PUT = route(async ({ params, request }) =>
  json(await updateReview(parseId(params.id), parse(v.partial(ReviewSchema), await readJson(request)))),
);
export const PATCH = PUT;

export const DELETE = route(async ({ params }) => {
  await deleteReview(parseId(params.id));
  return json({ ok: true });
});
