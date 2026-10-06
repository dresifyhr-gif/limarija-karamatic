/**
 * GET  /api/admin/quote-templates → { items: [...] }
 * POST /api/admin/quote-templates  JSON TemplateSchema → 201 zapis
 */
import { json, readJson, route } from '@/lib/server/http';
import { listTemplates, createTemplate } from '@/lib/server/repo/templates';
import { parse } from '@/lib/server/validate';
import { TemplateSchema } from '@/lib/server/schemas';

export const prerender = false;

export const GET = route(async () => json({ items: await listTemplates() }));

export const POST = route(async ({ request }) => json(await createTemplate(parse(TemplateSchema, await readJson(request))), 201));
