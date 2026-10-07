/**
 * POST /api/ponuda/:token/otvoreno — javna stranica ponude javlja da ju je klijent stvarno otvorio (beacon iz JS-a).
 *   → 204 uvijek kad je zahtjev ispravan (i kad se ništa ne bilježi) · 403 tuđa domena · 429 previše zahtjeva
 * Bilježi viewed_at SAMO prvi put (atomski) i tada u pozadini šalje push "Klijent je otvorio ponudu".
 * Ne broji se: prijavljeni admin, roboti (User-Agent), prefetch, nacrt (još nije poslan) i nepostojeća ponuda.
 */
import { route, HttpError } from '@/lib/server/http';
import { getQuoteByToken, markQuoteFirstViewed } from '@/lib/server/repo/quotes';
import { clientKey, hit } from '@/lib/server/rate-limit';
import { PRIVATE_HEADERS, sameSite } from '@/lib/quotes/server';
import { readSession } from '@/lib/server/auth';
import { isBotUserAgent, isPrefetch } from '@/lib/server/bots';
import { notifyQuoteOpened } from '@/lib/server/push';

export const prerender = false;

const done = () => new Response(null, { status: 204, headers: PRIVATE_HEADERS });

export const POST = route(async (ctx) => {
  if (!sameSite(ctx)) throw new HttpError(403, 'Zahtjev odbijen.');
  if (!(await hit('ponuda-otvoreno', clientKey(ctx), 3600, 30)).ok) throw new HttpError(429, 'Previše zahtjeva.');
  if (isBotUserAgent(ctx.request.headers.get('user-agent')) || isPrefetch(ctx.request)) return done();
  if (await readSession(ctx).catch(() => null)) return done();
  const q = await getQuoteByToken(ctx.params.token ?? '');
  if (!q || q.viewedAt || q.status === 'nacrt') return done();
  // prvo otvaranje (atomski, samo jednom po ponudi) → push vlasniku u pozadini
  if (await markQuoteFirstViewed(q.id)) notifyQuoteOpened(q);
  return done();
});
