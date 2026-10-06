/**
 * GET    /api/admin/leads/:id → Lead
 * PUT    /api/admin/leads/:id  JSON { status?, adminNote? } → Lead
 * DELETE /api/admin/leads/:id → { ok: true } (briše i fotografije s Bloba)
 */
import { json, readJson, route, parseId, notFound } from '@/lib/server/http';
import { getLead, updateLead, deleteLead } from '@/lib/server/repo/leads';
import { parse } from '@/lib/server/validate';
import { LeadPatchSchema } from '@/lib/server/schemas';

export const prerender = false;

export const GET = route(async ({ params }) => json((await getLead(parseId(params.id))) ?? notFound('Upit')));

export const PUT = route(async ({ params, request }) =>
  json(await updateLead(parseId(params.id), parse(LeadPatchSchema, await readJson(request)))),
);
export const PATCH = PUT;

export const DELETE = route(async ({ params }) => {
  await deleteLead(parseId(params.id));
  return json({ ok: true });
});
