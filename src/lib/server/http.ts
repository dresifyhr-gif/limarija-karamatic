/**
 * Pomoćnici za API rute (JSON odgovori, čitanje tijela, hvatanje grešaka).
 *
 * Konvencija odgovora:
 *   uspjeh: 200/201 + JSON podatak (objekt ili { items: [...] })
 *   greška: { error: string (hrvatska poruka za korisnika), fields?: Record<polje, poruka> }
 *           400 neispravan unos · 401 nije prijavljen · 403 CSRF · 404 ne postoji · 409 sukob
 *           413 prevelika datoteka · 415 nepodržan format · 429 previše pokušaja · 500 greška servera
 */
import type { APIContext, APIRoute } from 'astro';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

const baseHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
};

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...baseHeaders, ...headers } });
}

export function jsonError(status: number, error: string, fields?: Record<string, string>): Response {
  return json(fields ? { error, fields } : { error }, status);
}

/** Pročitaj JSON tijelo (max 1 MB). Baca HttpError 400/413/415. */
export async function readJson<T = unknown>(request: Request, maxBytes = 1_000_000): Promise<T> {
  const ct = request.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) throw new HttpError(415, 'Očekivan je JSON (content-type: application/json).');
  // najprije deklarirana veličina (ne čitamo cijelo tijelo ako je unaprijed prevelika), zatim čitanje uz prekid na limitu
  if (Number(request.headers.get('content-length') ?? 0) > maxBytes) throw new HttpError(413, 'Zahtjev je prevelik.');
  const text = await readLimited(request, maxBytes);
  if (text.length > maxBytes) throw new HttpError(413, 'Zahtjev je prevelik.');
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(400, 'Neispravan JSON.');
  }
}

/** Pročitaj tijelo kao tekst, ali prekini čim prijeđe maxBytes (chunked zahtjevi bez content-length). */
async function readLimited(request: Request, maxBytes: number): Promise<string> {
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new HttpError(413, 'Zahtjev je prevelik.');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/** '12' → 12; sve ostalo → HttpError 404 */
export function parseId(v: string | undefined): number {
  const n = Number(v);
  if (!v || !Number.isInteger(n) || n <= 0 || n > 2_147_483_647) throw new HttpError(404, 'Ne postoji.');
  return n;
}

export function notFound(what = 'Zapis'): never {
  throw new HttpError(404, `${what} ne postoji.`);
}

/**
 * Omotač za rutu: hvata HttpError (→ JSON s porukom) i neočekivane greške (→ 500, bez detalja van).
 *   export const GET = route(async (ctx) => json(await listFaq()));
 */
export function route(handler: (ctx: APIContext) => Promise<Response> | Response): APIRoute {
  return async (ctx) => {
    try {
      return await handler(ctx);
    } catch (e) {
      if (e instanceof HttpError) return jsonError(e.status, e.message, e.fields);
      // Postgres: unique violation / FK / check → razumljive poruke
      const code = (e as { code?: string })?.code;
      if (code === '23505') return jsonError(409, 'Već postoji zapis s istom vrijednošću (npr. isti slug).');
      if (code === '23503') return jsonError(409, 'Zapis je povezan s drugim podacima.');
      if (code === '23514') return jsonError(400, 'Neispravna vrijednost polja.');
      console.error(`[api] ${ctx.request.method} ${ctx.url.pathname}:`, (e as Error)?.message ?? e);
      return jsonError(500, 'Greška na serveru. Pokušajte ponovno.');
    }
  };
}
