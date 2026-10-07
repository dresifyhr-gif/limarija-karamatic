/**
 * POST /api/admin/push/test  JSON { id? } → { sent, failed, removed, total }
 * Probna obavijest uređaju `id` (ili svim uređajima), bez obzira na postavke događaja. Čeka isporuku (admin želi rezultat).
 */
import { json, readJson, route, HttpError } from '@/lib/server/http';
import { sendTestPush, isPushConfigured } from '@/lib/server/push';
import { clientKey, hit } from '@/lib/server/rate-limit';

export const prerender = false;

export const POST = route(async (ctx) => {
  if (!isPushConfigured()) throw new HttpError(503, 'Obavijesti nisu postavljene na poslužitelju (VAPID ključevi).');
  if (!(await hit('push-test', clientKey(ctx), 600, 20)).ok) throw new HttpError(429, 'Previše probnih obavijesti. Pokušajte za nekoliko minuta.');
  const body = await readJson<{ id?: unknown }>(ctx.request, 2_000).catch(() => ({}) as { id?: unknown });
  const id = body.id === undefined || body.id === null ? undefined : Number(body.id);
  if (id !== undefined && (!Number.isInteger(id) || id <= 0)) throw new HttpError(400, 'Neispravan uređaj.');
  const r = await sendTestPush(id);
  if (id && r.removed) throw new HttpError(410, 'Ovaj uređaj više ne prima obavijesti (pretplata je istekla). Uključite ih ponovno.');
  if (id && r.failed) throw new HttpError(502, 'Push servis nije prihvatio obavijest. Pokušajte ponovno za minutu.');
  return json(r);
});
