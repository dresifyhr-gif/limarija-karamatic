/** POST /api/admin/password {current, next} → 200 {ok:true}. Ostale sesije prestaju vrijediti. */
import { changePassword } from '@/lib/server/auth';
import { json, readJson, route } from '@/lib/server/http';
import { parse } from '@/lib/server/validate';
import { PasswordSchema } from '@/lib/server/schemas';

export const prerender = false;

export const POST = route(async (ctx) => {
  const { current, next } = parse(PasswordSchema, await readJson(ctx.request));
  await changePassword(ctx, current, next);
  return json({ ok: true });
});
