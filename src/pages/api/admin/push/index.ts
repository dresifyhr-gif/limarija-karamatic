/**
 * GET  /api/admin/push → { publicKey, configured, items: PushDevice[] }
 * POST /api/admin/push  JSON { subscription: { endpoint, keys: { p256dh, auth } }, label?, prefs?, replaces? }
 *      → 201 PushDevice (upsert po endpointu; postojećem uređaju se naziv/postavke ne mijenjaju ako nisu poslani)
 * Sesija i ista domena: middleware.
 */
import { json, readJson, route, HttpError } from '@/lib/server/http';
import { listDevices, upsertDevice, vapidPublicKey, isPushConfigured, type SubscribeInput } from '@/lib/server/push';

export const prerender = false;

export const GET = route(async () => json({ publicKey: vapidPublicKey(), configured: isPushConfigured(), items: await listDevices() }));

export const POST = route(async ({ request }) => {
  if (!isPushConfigured()) throw new HttpError(503, 'Obavijesti nisu postavljene na poslužitelju (VAPID ključevi).');
  const body = await readJson<Partial<SubscribeInput>>(request, 10_000);
  if (!body || typeof body !== 'object' || !body.subscription) throw new HttpError(400, 'Nedostaje pretplata.');
  const device = await upsertDevice({
    subscription: body.subscription,
    label: typeof body.label === 'string' ? body.label : undefined,
    prefs: body.prefs && typeof body.prefs === 'object' ? body.prefs : undefined,
    replaces: typeof body.replaces === 'string' ? body.replaces : undefined,
    userAgent: request.headers.get('user-agent') ?? '',
  });
  return json(device, 201);
});
