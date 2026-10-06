/** POST /api/admin/publish → { mode: 'deploy'|'noop', message, state } */
import { json, route } from '@/lib/server/http';
import { publishSite } from '@/lib/server/publish';

export const prerender = false;

export const POST = route(async () => json(await publishSite()));
