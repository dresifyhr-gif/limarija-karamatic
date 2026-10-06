/** POST /api/admin/quotes/:id/duplicate → 201 Quote (kopija, novi broj, 'nacrt') */
import { json, route, parseId } from '@/lib/server/http';
import { duplicateQuote } from '@/lib/server/repo/quotes';

export const prerender = false;

export const POST = route(async ({ params }) => json(await duplicateQuote(parseId(params.id)), 201));
