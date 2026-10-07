/**
 * POST /api/ponuda/:token/prihvat — klijent prihvaća ponudu (javna stranica /ponuda/:token).
 *   JSON (s JS-om) → 200 { ok: true, acceptedAt }   ·  forma (bez JS-a) → 303 /ponuda/:token?prihvaceno=1
 *   409 kad ponuda nije poslana (nacrt/odbijena) ili joj je istekao rok · 404 nepostojeći token · 429 previše pokušaja
 * Bilježi se samo vrijeme prihvaćanja (accepted_at); ponovljeni zahtjev ne mijenja ništa.
 */
import type { APIContext } from 'astro';
import { json, route, HttpError } from '@/lib/server/http';
import { getQuoteByToken, acceptQuoteByClient, markQuoteFirstViewed } from '@/lib/server/repo/quotes';
import { clientKey, hit } from '@/lib/server/rate-limit';
import { PRIVATE_HEADERS, sameSite } from '@/lib/quotes/server';
import { formatDay, isExpired, validUntil } from '@/lib/quotes/shared';
import { notifyQuoteAccepted } from '@/lib/server/push';

export const prerender = false;

const BUCKET = 'ponuda-prihvat';

async function accept(ctx: APIContext): Promise<{ acceptedAt: string; token: string }> {
  const token = ctx.params.token ?? '';
  if (!(await hit(BUCKET, clientKey(ctx), 3600, 20)).ok) throw new HttpError(429, 'Previše pokušaja. Pokušajte kasnije ili nas nazovite.');
  const q = await getQuoteByToken(token);
  if (!q) throw new HttpError(404, 'Ponuda ne postoji.');
  if (q.status === 'prihvacena' && q.acceptedAt) return { acceptedAt: q.acceptedAt, token };
  // prihvatiti se može samo POSLANA ponuda (nacrt još nije gotov, odbijena nije aktivna)
  if (q.status !== 'poslana') throw new HttpError(409, 'Ova ponuda trenutno nije aktivna. Javite nam se za novu ponudu.');
  if (isExpired(q.issueDate, q.validDays))
    throw new HttpError(409, `Rok valjanosti ponude istekao je ${formatDay(validUntil(q.issueDate, q.validDays))}. Javite nam se za ažuriranu ponudu.`);
  const u = await acceptQuoteByClient(q.id);
  if (!u) throw new HttpError(409, 'Ova ponuda trenutno nije aktivna. Javite nam se za novu ponudu.');
  // samo stvarni prijelaz poslana → prihvaćena (uvjet u UPDATE-u) šalje obavijest; ponovljeni zahtjev ne
  notifyQuoteAccepted(u);
  // prihvaćanje znači i otvaranje (npr. bez JS-a beacon nije javio) — bilježi se tiho, bez zasebne obavijesti
  if (!q.viewedAt) await markQuoteFirstViewed(q.id).catch(() => false);
  return { acceptedAt: u.acceptedAt ?? new Date().toISOString(), token };
}

export const POST = route(async (ctx) => {
  const ct = ctx.request.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    if (!sameSite(ctx)) throw new HttpError(403, 'Zahtjev odbijen.');
    const r = await accept(ctx);
    return json({ ok: true, acceptedAt: r.acceptedAt }, 200, PRIVATE_HEADERS);
  }
  // obična forma (Astro checkOrigin već odbija tuđe domene)
  const token = encodeURIComponent(ctx.params.token ?? '');
  try {
    await accept(ctx);
    return ctx.redirect(`/ponuda/${token}?prihvaceno=1`, 303);
  } catch (e) {
    // u URL ide samo kod greške (stranica sama ispisuje poruku)
    if (e instanceof HttpError && e.status !== 404) {
      const code = e.status === 429 ? 'limit' : /istekao/.test(e.message) ? 'istekla' : 'neaktivna';
      return ctx.redirect(`/ponuda/${token}?greska=${code}`, 303);
    }
    throw e;
  }
});
