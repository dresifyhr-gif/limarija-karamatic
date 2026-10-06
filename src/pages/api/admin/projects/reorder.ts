/** POST /api/admin/projects/reorder  JSON { ids: number[] } → { ok: true } */
import { json, readJson, route } from '@/lib/server/http';
import { reorderProjects } from '@/lib/server/repo/projects';
import { parse } from '@/lib/server/validate';
import { ReorderSchema } from '@/lib/server/schemas';

export const prerender = false;

export const POST = route(async ({ request }) => {
  await reorderProjects(parse(ReorderSchema, await readJson(request)).ids);
  return json({ ok: true });
});
