/**
 * Zaštita admina.
 *  - /admin/** (osim /admin/login) i /api/admin/** (osim /api/admin/login) traže valjanu sesiju:
 *    stranice → 303 na /admin/login?next=…, API → 401 JSON
 *  - svi POST/PUT/PATCH/DELETE na te putanje moraju biti s iste domene (Origin/Referer) → inače 403
 *  - odgovori admina: noindex, no-store, bez iframea, nosniff, Content-Security-Policy (vidi ADMIN_CSP)
 * Prerenderirane (javne) stranice prolaze bez ikakvog rada.
 */
import { defineMiddleware } from 'astro:middleware';
import { readSession, sameOrigin, isMutating } from '@/lib/server/auth';

const PUBLIC = new Set(['/admin/login', '/api/admin/login']);

/**
 * CSP admina: skripte/stilovi samo s naše domene (+ inline, jer Astro male skripte i stilove umeće u stranicu),
 * fotografije s naše domene, data:/blob: (pregled prije učitavanja) i Vercel Bloba; bez tuđih fetch/iframe/form ciljeva.
 * U razvoju (astro dev) Vite treba i websocket za osvježavanje.
 */
const ADMIN_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com",
  "font-src 'self' data:",
  `connect-src 'self'${import.meta.env.DEV ? ' ws: wss:' : ''}`,
  "frame-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

function normalize(p: string): string {
  let s = p;
  try {
    s = decodeURIComponent(p);
  } catch {}
  s = s.replace(/\/{2,}/g, '/').toLowerCase();
  return s.length > 1 ? s.replace(/\/+$/, '') : s;
}
const under = (p: string, base: string) => p === base || p.startsWith(base + '/');

export const onRequest = defineMiddleware(async (ctx, next) => {
  if (ctx.isPrerendered) return next();

  const path = normalize(ctx.url.pathname);
  const pattern = (ctx.routePattern || '').toLowerCase();
  const isApi = under(path, '/api/admin') || under(pattern, '/api/admin');
  const isPage = !isApi && (under(path, '/admin') || under(pattern, '/admin'));
  if (!isApi && !isPage) return next();

  const secure = (res: Response) => {
    try {
      res.headers.set('x-robots-tag', 'noindex, nofollow');
      res.headers.set('x-frame-options', 'DENY');
      res.headers.set('x-content-type-options', 'nosniff');
      res.headers.set('referrer-policy', 'same-origin');
      res.headers.set('content-security-policy', ADMIN_CSP);
      if (!res.headers.has('cache-control')) res.headers.set('cache-control', 'no-store');
    } catch {
      /* nepromjenjiva zaglavlja (npr. redirect) */
    }
    return res;
  };
  const deny = (status: number, error: string) =>
    secure(new Response(JSON.stringify({ error }), { status, headers: { 'content-type': 'application/json; charset=utf-8' } }));

  if (isMutating(ctx.request.method) && !sameOrigin(ctx.request, ctx.url)) {
    return deny(403, 'Zahtjev odbijen (druga domena).');
  }

  if (!PUBLIC.has(path)) {
    const session = await readSession(ctx);
    if (!session) {
      if (isApi) return deny(401, 'Niste prijavljeni.');
      const nextUrl = ctx.url.pathname + ctx.url.search;
      return secure(ctx.redirect(`/admin/login?next=${encodeURIComponent(nextUrl)}`, 303));
    }
    ctx.locals.admin = session;
  }

  return secure(await next());
});
