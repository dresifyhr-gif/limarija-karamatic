/**
 * GET /api/admin/services/:slug → AdminService
 * PUT /api/admin/services/:slug  JSON ServicePatch (djelomično; null = vrati na zadano) → AdminService
 */
import { json, readJson, route, notFound } from '@/lib/server/http';
import { getService, updateService } from '@/lib/server/repo/services';
import { parse } from '@/lib/server/validate';
import { ServicePatchSchema } from '@/lib/server/schemas';

export const prerender = false;

export const GET = route(async ({ params }) => json((await getService(params.slug ?? '')) ?? notFound('Usluga')));

export const PUT = route(async ({ params, request }) => {
  const patch = parse(ServicePatchSchema, await readJson(request));
  return json(await updateService(params.slug ?? '', patch));
});
export const PATCH = PUT;
