/**
 * POST /api/admin/logout → 200 {ok:true} (form POST: 303 na /admin/login)
 *   Odjava s ovog uređaja: kolačić se briše i sesija se poništava i na serveru (kopija kolačića više ne vrijedi).
 *   `sve=1` (polje forme) ili { everywhere: true } (JSON): odjava sa SVIH uređaja (nova epoha sesija).
 */
import type { APIRoute } from 'astro';
import { clearSession, logoutEverywhere } from '@/lib/server/auth';
import { json } from '@/lib/server/http';

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const ct = ctx.request.headers.get('content-type') ?? '';
  const isForm = ct.includes('form');
  let everywhere = false;
  try {
    if (isForm) everywhere = (await ctx.request.formData()).get('sve') === '1';
    else if (ct.includes('application/json')) everywhere = ((await ctx.request.json()) as { everywhere?: unknown })?.everywhere === true;
  } catch {
    /* prazno tijelo = obična odjava */
  }
  try {
    if (everywhere) await logoutEverywhere(ctx.cookies, ctx.url);
    else await clearSession(ctx.cookies, ctx.url);
  } catch (e) {
    console.error('[logout]', (e as Error)?.message);
    await clearSession(ctx.cookies, ctx.url);
  }
  if (isForm) return ctx.redirect(`/admin/login?odjava=${everywhere ? 'sve' : '1'}`, 303);
  return json({ ok: true });
};
