/**
 * Autentikacija jedinog admin računa.
 *
 * - Lozinka: scrypt ("scrypt:N:r:p:<saltB64>:<hashB64>", keylen 64). Hash iz admin_meta.password_hash
 *   ima prednost pred ADMIN_PASSWORD_HASH (okruženje). Provjera je timing-safe.
 * - Sesija: kolačić `kr_admin` = base64url(JSON {u,iat,exp,ep,lt,sid}) + "." + HMAC-SHA256(SESSION_SECRET).
 *   httpOnly, SameSite=Lax, Secure na https, 14 dana; obnavlja se (klizno) nakon 24 h, ali najdulje
 *   30 dana od prijave (`lt`) — ukradeni kolačić ne vrijedi zauvijek.
 *   `ep`  = session_epoch iz admin_meta; promjena lozinke i "Odjava sa svih uređaja" ga povećavaju → stare sesije ne vrijede.
 *   `sid` = slučajni id sesije; odjava ga upisuje u admin_meta.revoked_sessions → kopija kolačića više ne vrijedi.
 *   (Stanje epohe/odjava se kešira 30 s po instanci.)
 * - Prijava: najviše 5 neuspjelih pokušaja / 15 min po IP hashu (bucket 'login-fail') i najviše 50 neuspjelih
 *   na sat ukupno sa svih adresa (bucket 'login-fail-all'). Brojanje je atomsko (rate-limit.ts → hit()).
 * - CSRF: sameOrigin() za sve POST/PUT/PATCH/DELETE (middleware) + SameSite kolačić.
 */
import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import type { APIContext, AstroCookies } from 'astro';
import { requireEnv, env } from './env';
import { getMeta, setMeta } from './meta';
import { HttpError } from './http';
import { db } from './db';
import { clientKey, hit, clearEvents, forgetOne } from './rate-limit';

export const SESSION_COOKIE = 'kr_admin';
const SESSION_DAYS = 14;
const SESSION_MAX_DAYS = 30;
const RENEW_AFTER_SEC = 24 * 3600;
export const LOGIN_MAX_FAILS = 5;
export const LOGIN_WINDOW_SEC = 15 * 60;
export const LOGIN_GLOBAL_MAX_FAILS = 50;
const LOGIN_GLOBAL_WINDOW_SEC = 3600;

export type AdminSession = { username: string; issuedAt: number; expiresAt: number };

/* ── scrypt ──────────────────────────────────────────────────────────────── */

function scrypt(password: string, salt: Buffer, keylen: number, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCb(password, salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

type ParsedHash = { N: number; r: number; p: number; salt: Buffer; hash: Buffer };
function parseHash(stored: string): ParsedHash | null {
  const parts = stored.trim().split(':');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return null;
  const [N, r, p] = parts.slice(1, 4).map(Number);
  if (![N, r, p].every((x) => Number.isInteger(x) && x > 0)) return null;
  return { N, r, p, salt: Buffer.from(parts[4], 'base64'), hash: Buffer.from(parts[5], 'base64') };
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const h = parseHash(stored);
  if (!h || !h.hash.length) return false;
  const key = await scrypt(password, h.salt, h.hash.length, { N: h.N, r: h.r, p: h.p, maxmem: 256 * h.N * h.r + 1024 * 1024 });
  return key.length === h.hash.length && timingSafeEqual(key, h.hash);
}

export async function hashPassword(password: string): Promise<string> {
  const N = 16384, r = 8, p = 1;
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64, { N, r, p });
  return `scrypt:${N}:${r}:${p}:${salt.toString('base64')}:${key.toString('base64')}`;
}

async function currentPasswordHash(): Promise<string> {
  const override = await getMeta<string>('password_hash');
  return override || requireEnv('ADMIN_PASSWORD_HASH');
}

function safeEqualStr(a: string, b: string): boolean {
  // jednaka duljina preko HMAC-a → timingSafeEqual ne curi duljinu
  const k = 'kr-cmp';
  return timingSafeEqual(createHmac('sha256', k).update(a).digest(), createHmac('sha256', k).update(b).digest());
}

/* ── sesija ──────────────────────────────────────────────────────────────── */

const b64u = (s: string | Buffer) => Buffer.from(s).toString('base64url');
function sign(payload: string): string {
  return createHmac('sha256', requireEnv('SESSION_SECRET')).update(payload).digest('base64url');
}

type SessionState = { epoch: number; revoked: Record<string, number> };
let stateCache: { value: SessionState; at: number } | null = null;

/** Epoha sesija + popis odjavljenih sesija (keš 30 s po instanci). */
async function sessionState(): Promise<SessionState> {
  if (stateCache && Date.now() - stateCache.at < 30_000) return stateCache.value;
  const rows = await db()`SELECT key, value FROM admin_meta WHERE key IN ('session_epoch', 'revoked_sessions')`;
  const m = Object.fromEntries(rows.map((r) => [r.key as string, r.value]));
  const revoked = m.revoked_sessions && typeof m.revoked_sessions === 'object' ? (m.revoked_sessions as Record<string, number>) : {};
  const value: SessionState = { epoch: Number(m.session_epoch ?? 1) || 1, revoked };
  stateCache = { value, at: Date.now() };
  return value;
}
async function sessionEpoch(): Promise<number> {
  return (await sessionState()).epoch;
}

function cookieOptions(url: URL, maxAge: number) {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: url.protocol === 'https:',
    maxAge,
  };
}

type SessionPayload = { u?: string; iat?: number; exp?: number; ep?: number; lt?: number; sid?: string };

const newSid = () => randomBytes(12).toString('base64url');

/** Izdaj (ili obnovi) kolačić. Kod obnove se `lt` i `sid` prenose — rok od 30 dana od prijave se ne pomiče. */
async function issueSession(cookies: AstroCookies, url: URL, username: string, keep?: { lt: number; sid: string }): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const lt = keep?.lt ?? now;
  const sid = keep?.sid ?? newSid();
  const exp = Math.min(now + SESSION_DAYS * 86400, lt + SESSION_MAX_DAYS * 86400);
  const payload = b64u(JSON.stringify({ u: username, iat: now, exp, ep: await sessionEpoch(), lt, sid }));
  cookies.set(SESSION_COOKIE, `${payload}.${sign(payload)}`, cookieOptions(url, Math.max(60, exp - now)));
}

/** Provjeri potpis i dekodiraj kolačić (bez provjere roka/epohe). */
function decodeSession(raw: string | undefined): SessionPayload | null {
  if (!raw || raw.length > 1000) return null;
  const dot = raw.lastIndexOf('.');
  if (dot < 1) return null;
  const payload = raw.slice(0, dot);
  const sig = Buffer.from(raw.slice(dot + 1));
  const expected = Buffer.from(sign(payload));
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return null;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

const deleteCookie = (cookies: AstroCookies, url: URL) =>
  cookies.delete(SESSION_COOKIE, { path: '/', httpOnly: true, sameSite: 'lax', secure: url.protocol === 'https:' });

/** Odjava s ovog uređaja: briše kolačić i poništava ovu sesiju na serveru (kopija kolačića više ne vrijedi). */
export async function clearSession(cookies: AstroCookies, url: URL): Promise<void> {
  const data = decodeSession(cookies.get(SESSION_COOKIE)?.value);
  deleteCookie(cookies, url);
  if (!data?.sid || !data.exp) return;
  try {
    const now = Math.floor(Date.now() / 1000);
    stateCache = null;
    const { revoked } = await sessionState();
    const next: Record<string, number> = { [data.sid]: data.exp };
    // samo sesije koje još nisu istekle (popis ostaje malen)
    for (const [k, v] of Object.entries(revoked)) if (Number(v) > now) next[k] = Number(v);
    await setMeta('revoked_sessions', next);
  } catch (e) {
    console.error('[logout]', (e as Error)?.message);
  } finally {
    stateCache = null;
  }
}

/** Odjava sa svih uređaja: povećaj epohu → svi postojeći kolačići (i ovaj) prestaju vrijediti. */
export async function logoutEverywhere(cookies: AstroCookies, url: URL): Promise<void> {
  stateCache = null;
  await setMeta('session_epoch', (await sessionEpoch()) + 1);
  await setMeta('revoked_sessions', {});
  stateCache = null;
  deleteCookie(cookies, url);
}

/** Važeća sesija ili null. Klizno obnavlja kolačić kad je stariji od 24 h (najdulje 30 dana od prijave). */
export async function readSession(ctx: Pick<APIContext, 'cookies' | 'url'>): Promise<AdminSession | null> {
  const data = decodeSession(ctx.cookies.get(SESSION_COOKIE)?.value);
  if (!data) return null;
  const now = Math.floor(Date.now() / 1000);
  if (!data.u || !data.exp || !data.iat || data.exp <= now) return null;
  const lt = data.lt ?? data.iat;
  if (now - lt > SESSION_MAX_DAYS * 86400) return null;
  try {
    const st = await sessionState();
    if (data.ep !== st.epoch) return null;
    if (data.sid && st.revoked[data.sid]) return null;
  } catch {
    return null; // baza nedostupna → ne vjerujemo kolačiću
  }
  if (now - data.iat > RENEW_AFTER_SEC) await issueSession(ctx.cookies, ctx.url, data.u, { lt, sid: data.sid ?? newSid() });
  return { username: data.u, issuedAt: data.iat * 1000, expiresAt: data.exp * 1000 };
}

/* ── prijava / odjava / lozinka ──────────────────────────────────────────── */

/**
 * Provjeri korisničko ime i lozinku uz ograničenje pokušaja; kod uspjeha postavlja kolačić.
 * Svaki pokušaj se UNAPRIJED (atomski) broji kao neuspjeli; uspješna prijava ga briše.
 * Baca HttpError 429 (previše pokušaja) ili 401 (pogrešni podaci).
 */
export async function login(ctx: APIContext, username: string, password: string): Promise<void> {
  const key = clientKey(ctx);
  const ipHit = await hit('login-fail', key, LOGIN_WINDOW_SEC, LOGIN_MAX_FAILS);
  if (!ipHit.ok) throw new HttpError(429, `Previše neuspjelih pokušaja. Pokušajte ponovno za ${ipHit.retryMin} min.`);
  const allHit = await hit('login-fail-all', 'global', LOGIN_GLOBAL_WINDOW_SEC, LOGIN_GLOBAL_MAX_FAILS);
  if (!allHit.ok) {
    await forgetOne('login-fail-all', 'global'); // odbijeni pokušaji ne produljuju globalnu blokadu
    throw new HttpError(429, `Prijava je privremeno zaključana zbog mnogo neuspjelih pokušaja. Pokušajte za ${allHit.retryMin} min.`);
  }
  const expectedUser = requireEnv('ADMIN_USERNAME');
  const userOk = safeEqualStr(username.trim().toLowerCase(), expectedUser.toLowerCase());
  // lozinku provjeravamo uvijek (isto vrijeme odgovora bez obzira na korisničko ime)
  const passOk = await verifyPassword(password, await currentPasswordHash());
  if (!userOk || !passOk) throw new HttpError(401, 'Pogrešno korisničko ime ili lozinka.');
  await clearEvents('login-fail', key);
  await forgetOne('login-fail-all', 'global');
  await issueSession(ctx.cookies, ctx.url, expectedUser);
}

/** Promjena lozinke: provjeri trenutnu, spremi novi hash u bazu, poništi ostale sesije, izdaj novu. */
export async function changePassword(ctx: APIContext, current: string, next: string): Promise<void> {
  const key = clientKey(ctx);
  const ipHit = await hit('login-fail', key, LOGIN_WINDOW_SEC, LOGIN_MAX_FAILS);
  if (!ipHit.ok) throw new HttpError(429, `Previše neuspjelih pokušaja. Pokušajte ponovno za ${ipHit.retryMin} min.`);
  if (!(await verifyPassword(current, await currentPasswordHash()))) {
    throw new HttpError(400, 'Trenutna lozinka nije točna.', { current: 'Trenutna lozinka nije točna.' });
  }
  await clearEvents('login-fail', key);
  if (next.length < 10) throw new HttpError(400, 'Nova lozinka mora imati barem 10 znakova.', { next: 'Barem 10 znakova.' });
  if (next.length > 200) throw new HttpError(400, 'Nova lozinka je predugačka.', { next: 'Najviše 200 znakova.' });
  await setMeta('password_hash', await hashPassword(next));
  stateCache = null;
  await setMeta('session_epoch', (await sessionEpoch()) + 1);
  await setMeta('revoked_sessions', {});
  stateCache = null;
  await issueSession(ctx.cookies, ctx.url, requireEnv('ADMIN_USERNAME'));
}

/* ── CSRF ────────────────────────────────────────────────────────────────── */

/** true ako zahtjev dolazi s iste domene (Origin, pa Referer; Sec-Fetch-Site ne smije biti cross-site). */
export function sameOrigin(request: Request, url: URL): boolean {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false;
  const origin = request.headers.get('origin');
  if (origin) return origin === url.origin;
  const referer = request.headers.get('referer');
  if (referer) {
    try {
      return new URL(referer).origin === url.origin;
    } catch {
      return false;
    }
  }
  return false;
}

/** Treba li ruta zaštitu: true za sve metode koje mijenjaju stanje. */
export const isMutating = (method: string) => !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());

/** Je li deploy hook postavljen (samo produkcija). */
export const hasDeployHook = () => !!env('DEPLOY_HOOK_URL');
