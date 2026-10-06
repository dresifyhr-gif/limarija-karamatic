/** POST /api/admin/quotes/:id/status  JSON { status: 'nacrt'|'poslana'|'prihvacena'|'odbijena' } → Quote */
import { json, readJson, route, parseId } from '@/lib/server/http';
import { setQuoteStatus } from '@/lib/server/repo/quotes';
import { parse } from '@/lib/server/validate';
import { QuoteStatusSchema } from '@/lib/server/schemas';

export const prerender = false;

export const POST = route(async ({ params, request }) => {
  const { status } = parse(QuoteStatusSchema, await readJson(request));
  return json(await setQuoteStatus(parseId(params.id), status));
});
