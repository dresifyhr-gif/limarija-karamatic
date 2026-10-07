/** GET /api/admin/push/key → { publicKey } (javni VAPID ključ za pushManager.subscribe; null ako nije postavljen) */
import { json, route } from '@/lib/server/http';
import { vapidPublicKey } from '@/lib/server/push';

export const prerender = false;

export const GET = route(async () => json({ publicKey: vapidPublicKey() }));
