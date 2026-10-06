/**
 * GET  /api/admin/faq → { items: [...] }
 * POST /api/admin/faq  JSON FaqSchema → 201 zapis
 */
import { json, readJson, route } from '@/lib/server/http';
import { listFaq, createFaq } from '@/lib/server/repo/faq';
import { parse } from '@/lib/server/validate';
import { FaqSchema } from '@/lib/server/schemas';

export const prerender = false;

export const GET = route(async () => json({ items: await listFaq() }));

export const POST = route(async ({ request }) => json(await createFaq(parse(FaqSchema, await readJson(request))), 201));
