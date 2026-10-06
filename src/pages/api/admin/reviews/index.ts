/**
 * GET  /api/admin/reviews → { items: [...] }
 * POST /api/admin/reviews  JSON ReviewSchema → 201 zapis
 */
import { json, readJson, route } from '@/lib/server/http';
import { listReviews, createReview } from '@/lib/server/repo/reviews';
import { parse } from '@/lib/server/validate';
import { ReviewSchema } from '@/lib/server/schemas';

export const prerender = false;

export const GET = route(async () => json({ items: await listReviews() }));

export const POST = route(async ({ request }) => json(await createReview(parse(ReviewSchema, await readJson(request))), 201));
