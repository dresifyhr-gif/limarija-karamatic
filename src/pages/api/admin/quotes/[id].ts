/**
 * GET    /api/admin/quotes/:id → Quote
 * PUT    /api/admin/quotes/:id  JSON Partial<QuoteInput> → Quote (iznosi se računaju na serveru)
 * DELETE /api/admin/quotes/:id → { ok: true }
 */
import { json, readJson, route, parseId, notFound } from '@/lib/server/http';
import { getQuote, updateQuote, deleteQuote } from '@/lib/server/repo/quotes';
import { parse, v } from '@/lib/server/validate';
import { QuoteSchema } from '@/lib/server/schemas';

export const prerender = false;

export const GET = route(async ({ params }) => json((await getQuote(parseId(params.id))) ?? notFound('Ponuda')));

export const PUT = route(async ({ params, request }) =>
  json(await updateQuote(parseId(params.id), parse(v.partial(QuoteSchema), await readJson(request)))),
);
export const PATCH = PUT;

export const DELETE = route(async ({ params }) => {
  await deleteQuote(parseId(params.id));
  return json({ ok: true });
});
