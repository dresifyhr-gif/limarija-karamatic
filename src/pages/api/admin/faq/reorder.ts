/** POST /api/admin/faq/reorder  JSON { ids: number[] } → { ok: true } */
import { json, readJson, route } from '@/lib/server/http';
import { reorderFaq } from '@/lib/server/repo/faq';
import { parse } from '@/lib/server/validate';
import { ReorderSchema } from '@/lib/server/schemas';

export const prerender = false;

export const POST = route(async ({ request }) => {
  await reorderFaq(parse(ReorderSchema, await readJson(request)).ids);
  return json({ ok: true });
});
