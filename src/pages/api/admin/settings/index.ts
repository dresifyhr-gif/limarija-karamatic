/** GET /api/admin/settings → SettingsMap { contact, company, quote, stats } (baza preko zadanih) */
import { json, route } from '@/lib/server/http';
import { getSettings } from '@/lib/server/repo/settings';

export const prerender = false;

export const GET = route(async () => json(await getSettings()));
