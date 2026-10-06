/**
 * GET /api/ponuda/:token/pdf — PDF ponude (javno, uz tajni token iz poveznice).
 *   zadano: preuzimanje (Content-Disposition: attachment)   ?prikaz=1 → otvori u pregledniku (inline)
 * noindex, bez keša, bez referera. Nepostojeći token → 404. Najviše 60 PDF-ova na sat po IP-u (izrada troši procesor).
 */
import type { APIRoute } from 'astro';
import { getQuoteByToken } from '@/lib/server/repo/quotes';
import { getSettings } from '@/lib/server/repo/settings';
import { renderQuotePdf, pdfFileName } from '@/lib/quotes/pdf';
import { PRIVATE_HEADERS } from '@/lib/quotes/server';
import { clientKey, hit } from '@/lib/server/rate-limit';

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const { params, url } = ctx;
  try {
    const q = await getQuoteByToken(params.token ?? '');
    if (!q) return new Response('Ponuda ne postoji.', { status: 404, headers: { ...PRIVATE_HEADERS, 'content-type': 'text/plain; charset=utf-8' } });
    if (!(await hit('ponuda-pdf', clientKey(ctx), 3600, 60)).ok)
      return new Response('Previše zahtjeva. Pokušajte ponovno za nekoliko minuta.', {
        status: 429,
        headers: { ...PRIVATE_HEADERS, 'content-type': 'text/plain; charset=utf-8' },
      });
    const bytes = await renderQuotePdf(q, await getSettings());
    const name = pdfFileName(q);
    const disposition = url.searchParams.has('prikaz') ? 'inline' : 'attachment';
    return new Response(bytes as unknown as BodyInit, {
      status: 200,
      headers: {
        ...PRIVATE_HEADERS,
        'content-type': 'application/pdf',
        'content-length': String(bytes.length),
        'content-disposition': `${disposition}; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      },
    });
  } catch (e) {
    console.error('[ponuda/pdf]', (e as Error)?.message ?? e);
    const detail = import.meta.env.DEV ? `\n\n[dev] ${(e as Error)?.stack ?? e}` : '';
    return new Response('PDF trenutno nije moguće izraditi. Pokušajte ponovno.' + detail, {
      status: 500,
      headers: { ...PRIVATE_HEADERS, 'content-type': 'text/plain; charset=utf-8' },
    });
  }
};
