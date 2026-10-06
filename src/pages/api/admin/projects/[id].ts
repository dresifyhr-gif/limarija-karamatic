/**
 * GET    /api/admin/projects/:id → AdminProject
 * PUT    /api/admin/projects/:id  JSON Partial<ProjectInput> → AdminProject
 * DELETE /api/admin/projects/:id → { ok: true } (briše i Blob fotografije koje više ništa ne koristi)
 */
import { json, readJson, route, parseId, notFound } from '@/lib/server/http';
import { getProject, updateProject, deleteProject } from '@/lib/server/repo/projects';
import { parse, v } from '@/lib/server/validate';
import { ProjectSchema } from '@/lib/server/schemas';

export const prerender = false;

export const GET = route(async ({ params }) => json((await getProject(parseId(params.id))) ?? notFound('Rad')));

export const PUT = route(async ({ params, request }) => {
  const id = parseId(params.id);
  return json(await updateProject(id, parse(v.partial(ProjectSchema), await readJson(request))));
});
export const PATCH = PUT;

export const DELETE = route(async ({ params }) => {
  await deleteProject(parseId(params.id));
  return json({ ok: true });
});
