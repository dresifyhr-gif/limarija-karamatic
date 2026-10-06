/** POST /api/admin/login — JSON {username,password} → 200 {ok:true} | 401 | 429.
 *  Bez JS-a (form POST): 303 na `next` ili /admin/login?greska=<kod> (samo kodovi s popisa — stranica sama ispisuje poruku) */
import type { APIRoute } from 'astro';
import { login } from '@/lib/server/auth';
import { HttpError, json, jsonError } from '@/lib/server/http';
import { hasDatabase } from '@/lib/server/db';

export const prerender = false;

const safeNext = (n: unknown) => (typeof n === 'string' && /^\/admin(\/|$|\?)/.test(n) && !n.startsWith('//') ? n : '/admin');

/** status → kod poruke (vidi LOGIN_ERRORS u src/pages/admin/login.astro) */
const errorCode = (status: number, msg: string) =>
  status === 401 ? 'podaci' : status === 429 ? (/zaključana/.test(msg) ? 'zakljucano' : 'limit') : status === 400 ? 'prazno' : status === 503 ? 'baza' : 'greska';

export const POST: APIRoute = async (ctx) => {
  const ct = ctx.request.headers.get('content-type') ?? '';
  const isForm = ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data');
  let username = '', password = '', next = '/admin';
  try {
    if (isForm) {
      const f = await ctx.request.formData();
      username = String(f.get('username') ?? '');
      password = String(f.get('password') ?? '');
      next = safeNext(f.get('next'));
    } else {
      const b = (await ctx.request.json().catch(() => {
        throw new HttpError(400, 'Neispravan zahtjev.');
      })) as Record<string, unknown>;
      username = String(b?.username ?? '');
      password = String(b?.password ?? '');
      next = safeNext(b?.next);
    }
    if (!username || !password || username.length > 100 || password.length > 200) {
      throw new HttpError(400, 'Upišite korisničko ime i lozinku.');
    }
    if (!hasDatabase()) throw new HttpError(503, 'Baza nije dostupna.');
    await login(ctx, username, password);
    return isForm ? ctx.redirect(next, 303) : json({ ok: true, next });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    const msg = e instanceof HttpError ? e.message : 'Prijava trenutno nije moguća. Pokušajte ponovno.';
    if (!(e instanceof HttpError)) console.error('[login]', (e as Error)?.message);
    if (isForm) return ctx.redirect(`/admin/login?greska=${errorCode(status, msg)}&next=${encodeURIComponent(next)}`, 303);
    return jsonError(status, msg);
  }
};
