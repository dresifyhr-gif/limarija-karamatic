/** POST /api/admin/services/reorder  JSON { slugs: string[] } → { ok: true } */
import { json, readJson, route } from '@/lib/server/http';
import { reorderServices } from '@/lib/server/repo/services';
import { parse, v } from '@/lib/server/validate';

export const prerender = false;

export const POST = route(async ({ request }) => {
  const { slugs } = parse(v.object({ slugs: v.array(v.slug(), { min: 1, max: 50 }) }), await readJson(request));
  await reorderServices(slugs);
  return json({ ok: true });
});
