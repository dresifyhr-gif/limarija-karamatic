/** GET /api/admin/me → { username, expiresAt } */
import { json, route } from '@/lib/server/http';

export const prerender = false;

export const GET = route(async ({ locals }) => json({ username: locals.admin!.username, expiresAt: new Date(locals.admin!.expiresAt).toISOString() }));
