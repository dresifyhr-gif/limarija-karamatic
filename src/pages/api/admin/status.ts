/** GET /api/admin/status → brojevi za Pregled + stanje objave */
import { json, route } from '@/lib/server/http';
import { getDashboard } from '@/lib/server/dashboard';

export const prerender = false;

export const GET = route(async () => json(await getDashboard()));
