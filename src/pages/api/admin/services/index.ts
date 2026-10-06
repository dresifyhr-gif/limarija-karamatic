/** GET /api/admin/services → { items: AdminService[] } */
import { json, route } from '@/lib/server/http';
import { listServices } from '@/lib/server/repo/services';

export const prerender = false;

export const GET = route(async () => json({ items: await listServices() }));
