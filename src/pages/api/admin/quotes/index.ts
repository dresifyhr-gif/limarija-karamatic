/**
 * GET  /api/admin/quotes?status=&q=&limit=&offset= → { items: QuoteListItem[] }  (novije prvo)
 * POST /api/admin/quotes  JSON Partial<QuoteInput> (može i {} ili { leadId }) → 201 Quote (broj dodijeljen, status 'nacrt')
 */
import { json, readJson, route } from '@/lib/server/http';
import { listQuotes, createQuote } from '@/lib/server/repo/quotes';
import { parse, v } from '@/lib/server/validate';
import { QuoteSchema } from '@/lib/server/schemas';
import { QUOTE_STATUSES, type QuoteStatus } from '@/lib/types';

export const prerender = false;

export const GET = route(async ({ url }) => {
  const s = url.searchParams.get('status');
  const status = s && (QUOTE_STATUSES as readonly string[]).includes(s) ? (s as QuoteStatus) : undefined;
  return json({
    items: await listQuotes({
      status,
      q: url.searchParams.get('q') ?? undefined,
      limit: Number(url.searchParams.get('limit') ?? 50) || 50,
      offset: Number(url.searchParams.get('offset') ?? 0) || 0,
    }),
  });
});

export const POST = route(async ({ request }) => {
  const input = parse(v.partial(QuoteSchema), await readJson(request));
  return json(await createQuote(input), 201);
});
