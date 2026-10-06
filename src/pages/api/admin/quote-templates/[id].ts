/**
 * GET    /api/admin/quote-templates/:id → zapis
 * PUT    /api/admin/quote-templates/:id  JSON Partial<TemplateSchema> → zapis
 * DELETE /api/admin/quote-templates/:id → { ok: true }
 */
import { json, readJson, route, parseId, notFound } from '@/lib/server/http';
import { getTemplate, updateTemplate, deleteTemplate } from '@/lib/server/repo/templates';
import { parse, v } from '@/lib/server/validate';
import { TemplateSchema } from '@/lib/server/schemas';

export const prerender = false;

export const GET = route(async ({ params }) => json((await getTemplate(parseId(params.id))) ?? notFound('Predložak')));

export const PUT = route(async ({ params, request }) =>
  json(await updateTemplate(parseId(params.id), parse(v.partial(TemplateSchema), await readJson(request)))),
);
export const PATCH = PUT;

export const DELETE = route(async ({ params }) => {
  await deleteTemplate(parseId(params.id));
  return json({ ok: true });
});
