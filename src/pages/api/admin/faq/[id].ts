/**
 * GET    /api/admin/faq/:id → zapis
 * PUT    /api/admin/faq/:id  JSON Partial<FaqSchema> → zapis
 * DELETE /api/admin/faq/:id → { ok: true }
 */
import { json, readJson, route, parseId, notFound } from '@/lib/server/http';
import { getFaq, updateFaq, deleteFaq } from '@/lib/server/repo/faq';
import { parse, v } from '@/lib/server/validate';
import { FaqSchema } from '@/lib/server/schemas';

export const prerender = false;

export const GET = route(async ({ params }) => json((await getFaq(parseId(params.id))) ?? notFound('Pitanje')));

export const PUT = route(async ({ params, request }) =>
  json(await updateFaq(parseId(params.id), parse(v.partial(FaqSchema), await readJson(request)))),
);
export const PATCH = PUT;

export const DELETE = route(async ({ params }) => {
  await deleteFaq(parseId(params.id));
  return json({ ok: true });
});
