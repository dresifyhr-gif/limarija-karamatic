/**
 * Web Push obavijesti na mobitele vlasnika (PWA admina).
 *
 *   await sendPush('lead', { title, body, url, tag })   // svim uređajima koji imaju uključen taj događaj
 *   notifyNewLead(lead) / notifyQuoteAccepted(q) / notifyQuoteOpened(q)   // gotove poruke, šalju se U POZADINI (waitUntil)
 *
 * - VAPID ključevi: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT (okruženje). Privatni ključ se nikad ne ispisuje.
 * - Slanje: paralelno, timeout 6 s po uređaju, TTL 1 dan, urgency high za upite i prihvaćene ponude.
 * - 404/410 od push servisa = pretplata više ne postoji → brišemo je. Ostale greške povećavaju failure_count.
 * - Sadržaj obavijesti vidi se na zaključanom zaslonu: NIKAD telefon ni e-pošta (scrub() ih uklanja i iz slobodnog teksta).
 * - Endpoint smije biti samo adresa poznatog push servisa (https) — server ne šalje zahtjeve na proizvoljne adrese.
 */
import { createHash } from 'node:crypto';
import { parse as legacyParse } from 'node:url';
import webpush, { type WebPushError } from 'web-push';
import { db } from './db';
import { env, isLocal } from './env';
import { HttpError } from './http';
import { background } from './background';
import { hit } from './rate-limit';
import { leadNumber } from '@/lib/quotes/shared';
import { jobLabel } from '@/lib/quotes/labels';
import { formatEur } from '@/lib/quote-math';

export type PushEvent = 'lead' | 'accepted' | 'opened';
export const PUSH_EVENTS: PushEvent[] = ['lead', 'accepted', 'opened'];
export type PushPrefs = Record<PushEvent, boolean>;
export const DEFAULT_PREFS: PushPrefs = { lead: true, accepted: true, opened: true };
export const MAX_DEVICES = 20;

export type PushPayload = {
  title: string;
  body: string;
  /** putanja u adminu (/admin/...) koja se otvara dodirom na obavijest */
  url: string;
  /** ista oznaka zamjenjuje prethodnu obavijest (npr. isti upit) */
  tag?: string;
  /** ponovno zvoni/vibrira i kad zamjenjuje obavijest s istom oznakom */
  renotify?: boolean;
};

export type PushDevice = {
  id: number;
  label: string;
  platform: string;
  prefs: PushPrefs;
  createdAt: string;
  lastSuccessAt: string | null;
  failureCount: number;
  /** sha256(endpoint) — preglednik izračuna isto i tako prepozna "ovaj uređaj" (endpoint ne izlazi iz baze) */
  endpointHash: string;
};

export type SendSummary = { sent: number; failed: number; removed: number; total: number };

/* ── konfiguracija ───────────────────────────────────────────────────────── */

export function vapidPublicKey(): string | null {
  return env('VAPID_PUBLIC_KEY') ?? null;
}

function vapid(): { subject: string; publicKey: string; privateKey: string } | null {
  const publicKey = env('VAPID_PUBLIC_KEY');
  const privateKey = env('VAPID_PRIVATE_KEY');
  const subject = env('VAPID_SUBJECT');
  if (!publicKey || !privateKey || !subject) return null;
  return { subject, publicKey, privateKey };
}

export const isPushConfigured = () => !!vapid();

/* ── pomoćnici ───────────────────────────────────────────────────────────── */

export const endpointHash = (endpoint: string) => createHash('sha256').update(endpoint).digest('hex').slice(0, 32);

/** Poznati push servisi (Chrome/Android/Edge/Samsung → FCM, Safari/iOS → Apple, Firefox → Mozilla, stari Edge → WNS). */
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)notify\.windows\.com$/];

/** Samo obični DNS nazivi (slova, brojke, crtica, točke) — bez ';', '%', Unicode točaka i sl. */
const PLAIN_HOST = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;

/**
 * Smije li server slati na ovu adresu. Stroga provjera jer web-push adresu ponovno parsira Nodeovim starim
 * url.parse(): oba parsera (WHATWG URL i url.parse) moraju vidjeti ISTI host, a adresa mora biti kanonska
 * (https://<host>/…, bez korisnika, porta i neobičnih znakova). Inače npr. "https://127.0.0.1;x.push.apple.com/"
 * prođe popis, a zahtjev ode na 127.0.0.1.
 */
export function isAllowedEndpoint(endpoint: string): boolean {
  try {
    if (typeof endpoint !== 'string' || endpoint.length > 1000 || /[\s\\]/.test(endpoint)) return false;
    const u = new URL(endpoint);
    if (u.protocol !== 'https:' || u.username || u.password || u.port !== '') return false;
    const host = u.hostname;
    if (!PLAIN_HOST.test(host) || !PUSH_HOSTS.some((r) => r.test(host))) return false;
    if (u.href !== endpoint || !endpoint.startsWith(`https://${host}/`)) return false;
    const legacy = legacyParse(endpoint);
    return legacy.hostname === host && legacy.protocol === 'https:' && !legacy.auth && !legacy.port;
  } catch {
    return false;
  }
}

const b64uLen = (s: string) => {
  if (!/^[A-Za-z0-9_-]+={0,2}$/.test(s)) return -1;
  return Buffer.from(s.replace(/=+$/, ''), 'base64url').length;
};

/** Kratki opis uređaja iz User-Agenta (za popis uređaja). */
export function platformOf(ua: string): string {
  const os = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua) || (/Macintosh/.test(ua) && /Mobile\//.test(ua))
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /Mac OS X|Macintosh/.test(ua)
          ? 'Mac'
          : /Windows/.test(ua)
            ? 'Windows'
            : /Linux/.test(ua)
              ? 'Linux'
              : 'Uređaj';
  const br = /EdgA?\//.test(ua)
    ? 'Edge'
    : /SamsungBrowser/.test(ua)
      ? 'Samsung Internet'
      : /Firefox|FxiOS/.test(ua)
        ? 'Firefox'
        : /CriOS|Chrome\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : '';
  return br ? `${os} · ${br}` : os;
}

/**
 * Iz teksta za zaključani zaslon makni e-poštu, brojeve telefona i poveznice/domene (slobodni tekst javne forme
 * ne smije postati "poruka" na zaključanom zaslonu, npr. lažna poveznica za plaćanje); skrati.
 */
export function scrub(text: string, max = 90): string {
  let t = String(text ?? '')
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '…')
    .replace(/[^\s@]+\s*[([]\s*(?:at|et|@)\s*[)\]]\s*\S+/gi, '…')
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, '…')
    .replace(/\b[\w-]+(?:\.[\w-]+)*\.(?:com|hr|net|org|io|eu|info|biz|xyz|online|site|top|shop|app|link|ly|ru|de|si|ba|rs)\b\S*/gi, '…')
    .replace(/\+?\d[\d\s\-/().]{5,}\d/g, (m) => (m.replace(/\D/g, '').length >= 7 ? '…' : m))
    .replace(/…(?:\s*…)+/g, '…')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length > max) t = t.slice(0, max - 1).trimEnd() + '…';
  return t;
}

function normPrefs(v: unknown): PushPrefs {
  const o = v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  return { lead: o.lead !== false, accepted: o.accepted !== false, opened: o.opened !== false };
}

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v ? new Date(String(v)).toISOString() : null);

function mapDevice(r: Record<string, unknown>): PushDevice {
  return {
    id: r.id as number,
    label: (r.label as string) || '',
    platform: platformOf((r.user_agent as string) || ''),
    prefs: normPrefs(r.prefs),
    createdAt: iso(r.created_at) ?? '',
    lastSuccessAt: iso(r.last_success_at),
    failureCount: Number(r.failure_count ?? 0),
    endpointHash: endpointHash(r.endpoint as string),
  };
}

/* ── pretplate (repo) ────────────────────────────────────────────────────── */

export async function listDevices(): Promise<PushDevice[]> {
  const rows = await db()`SELECT * FROM push_subscriptions ORDER BY created_at ASC, id ASC`;
  return rows.map(mapDevice);
}

export async function countDevices(): Promise<number> {
  const rows = await db()`SELECT count(*)::int AS n FROM push_subscriptions`;
  return Number(rows[0]?.n ?? 0);
}

export type SubscribeInput = {
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
  label?: string;
  prefs?: Partial<PushPrefs>;
  userAgent?: string;
  /** stari endpoint istog uređaja (pushsubscriptionchange) — briše se */
  replaces?: string;
};

/** Upiši ili osvježi pretplatu (ključ je endpoint). Postojećoj se zadržavaju naziv i postavke ako nisu poslani. */
export async function upsertDevice(input: SubscribeInput): Promise<PushDevice> {
  const { endpoint, keys } = input.subscription ?? ({} as SubscribeInput['subscription']);
  if (typeof endpoint !== 'string' || !isAllowedEndpoint(endpoint)) {
    throw new HttpError(400, 'Preglednik je vratio nepoznatu adresu za obavijesti.', { subscription: 'Nepodržan push servis.' });
  }
  if (!keys || typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string' || b64uLen(keys.p256dh) !== 65 || b64uLen(keys.auth) !== 16) {
    throw new HttpError(400, 'Neispravni ključevi pretplate.', { subscription: 'Neispravni ključevi.' });
  }
  let label = typeof input.label === 'string' ? input.label.trim().slice(0, 60) : null;
  const ua = (input.userAgent ?? '').slice(0, 400);
  let prefs: PushPrefs | null = input.prefs ? { ...DEFAULT_PREFS, ...pickPrefs(input.prefs) } : null;

  const existing = await db()`SELECT id FROM push_subscriptions WHERE endpoint = ${endpoint}`;
  // pushsubscriptionchange: preglednik je obnovio pretplatu → nova nasljeđuje naziv i postavke stare
  // (inače bi npr. isključena "otvorena ponuda" tiho opet bila uključena)
  const replaced =
    input.replaces && input.replaces !== endpoint
      ? ((await db()`SELECT label, prefs FROM push_subscriptions WHERE endpoint = ${input.replaces}`)[0] as { label: string; prefs: unknown } | undefined)
      : undefined;
  if (replaced && !existing.length) {
    if (!label && replaced.label) label = replaced.label;
    if (!prefs) prefs = normPrefs(replaced.prefs);
  }
  if (!existing.length && !replaced && (await countDevices()) >= MAX_DEVICES) {
    throw new HttpError(409, `Već je prijavljeno ${MAX_DEVICES} uređaja. Uklonite neki stari uređaj pa pokušajte ponovno.`);
  }
  const rows = await db()`INSERT INTO push_subscriptions (endpoint, p256dh, auth, label, user_agent, prefs)
      VALUES (${endpoint}, ${keys.p256dh}, ${keys.auth}, ${label ?? ''}, ${ua}, ${JSON.stringify(prefs ?? DEFAULT_PREFS)}::jsonb)
    ON CONFLICT (endpoint) DO UPDATE SET
      p256dh = EXCLUDED.p256dh,
      auth = EXCLUDED.auth,
      label = CASE WHEN ${!!label}::boolean THEN EXCLUDED.label ELSE push_subscriptions.label END,
      user_agent = CASE WHEN EXCLUDED.user_agent = '' THEN push_subscriptions.user_agent ELSE EXCLUDED.user_agent END,
      prefs = CASE WHEN ${!!prefs}::boolean THEN EXCLUDED.prefs ELSE push_subscriptions.prefs END,
      failure_count = 0,
      updated_at = now()
    RETURNING *`;
  if (input.replaces && input.replaces !== endpoint) {
    await db()`DELETE FROM push_subscriptions WHERE endpoint = ${input.replaces}`;
  }
  return mapDevice(rows[0] as Record<string, unknown>);
}

function pickPrefs(p: Partial<PushPrefs>): Partial<PushPrefs> {
  const out: Partial<PushPrefs> = {};
  for (const k of PUSH_EVENTS) if (typeof p[k] === 'boolean') out[k] = p[k];
  return out;
}

export async function updateDevice(id: number, patch: { label?: string; prefs?: Partial<PushPrefs> }): Promise<PushDevice> {
  const rows = await db()`SELECT * FROM push_subscriptions WHERE id = ${id}`;
  if (!rows.length) throw new HttpError(404, 'Uređaj više nije prijavljen za obavijesti.');
  const cur = rows[0] as Record<string, unknown>;
  const label = typeof patch.label === 'string' ? patch.label.trim().slice(0, 60) : (cur.label as string);
  const prefs = { ...normPrefs(cur.prefs), ...pickPrefs(patch.prefs ?? {}) };
  const out = await db()`UPDATE push_subscriptions SET label = ${label}, prefs = ${JSON.stringify(prefs)}::jsonb, updated_at = now()
    WHERE id = ${id} RETURNING *`;
  if (!out.length) throw new HttpError(404, 'Uređaj više nije prijavljen za obavijesti.');
  return mapDevice(out[0] as Record<string, unknown>);
}

export async function deleteDevice(id: number): Promise<boolean> {
  const rows = await db()`DELETE FROM push_subscriptions WHERE id = ${id} RETURNING id`;
  return rows.length > 0;
}

/* ── slanje ──────────────────────────────────────────────────────────────── */

type SubRow = { id: number; endpoint: string; p256dh: string; auth: string };

const TTL_SEC = 24 * 3600;
const TIMEOUT_MS = 6000;

/** Topic (zamjena neisporučene obavijesti na push servisu): base64url, najviše 32 znaka. */
const topicOf = (tag?: string) => (tag ? createHash('sha256').update(tag).digest('base64url').slice(0, 32) : undefined);

async function deliver(rows: SubRow[], payload: PushPayload & { event: string }, urgency: 'normal' | 'high'): Promise<SendSummary> {
  const keys = vapid();
  const summary: SendSummary = { sent: 0, failed: 0, removed: 0, total: rows.length };
  if (!keys || !rows.length) {
    if (!keys && rows.length) console.warn('[push] VAPID ključevi nisu postavljeni — obavijest nije poslana');
    summary.failed = keys ? 0 : rows.length;
    return summary;
  }
  const body = JSON.stringify({ ...payload, ts: Date.now() });
  const ok: number[] = [];
  const gone: number[] = [];
  const bad: number[] = [];
  // adresa se provjerava i prije SVAKOG slanja (i retci koji su u bazu ušli prije strože provjere) — nedopuštene se brišu
  await Promise.all(
    rows.map(async (s) => {
      if (!isAllowedEndpoint(s.endpoint)) {
        console.warn(`[push] uređaj #${s.id}: nedopuštena adresa push servisa — uklanjam`);
        gone.push(s.id);
        return;
      }
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, {
          TTL: TTL_SEC,
          urgency,
          topic: topicOf(payload.tag),
          timeout: TIMEOUT_MS,
          vapidDetails: keys,
        });
        ok.push(s.id);
      } catch (e) {
        const status = (e as WebPushError)?.statusCode;
        if (status === 404 || status === 410) gone.push(s.id);
        else {
          bad.push(s.id);
          // bez endpointa i ključeva u logu
          console.warn(`[push] uređaj #${s.id}: ${status ?? ''} ${(e as Error)?.message?.slice(0, 120) ?? ''}`.trim());
        }
      }
    }),
  );
  if (ok.length) await db()`UPDATE push_subscriptions SET last_success_at = now(), failure_count = 0 WHERE id = ANY(${ok}::int[])`;
  if (gone.length) await db()`DELETE FROM push_subscriptions WHERE id = ANY(${gone}::int[])`;
  if (bad.length) await db()`UPDATE push_subscriptions SET failure_count = failure_count + 1 WHERE id = ANY(${bad}::int[])`;
  summary.sent = ok.length;
  summary.removed = gone.length;
  summary.failed = bad.length;
  return summary;
}

/** Pošalji obavijest svim uređajima koji imaju uključen `event`. Vraća sažetak (ne baca zbog pojedinog uređaja). */
export async function sendPush(event: PushEvent, payload: PushPayload): Promise<SendSummary> {
  const rows = (await db()`SELECT id, endpoint, p256dh, auth FROM push_subscriptions
    WHERE coalesce((prefs ->> ${event})::boolean, true)`) as SubRow[];
  return deliver(rows, { ...payload, event }, event === 'opened' ? 'normal' : 'high');
}

/** Probna obavijest jednom uređaju (ili svima kad id nije zadan) — bez obzira na postavke. */
export async function sendTestPush(id?: number): Promise<SendSummary> {
  const rows = (id
    ? await db()`SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE id = ${id}`
    : await db()`SELECT id, endpoint, p256dh, auth FROM push_subscriptions`) as SubRow[];
  if (id && !rows.length) throw new HttpError(404, 'Uređaj više nije prijavljen za obavijesti.');
  const time = new Intl.DateTimeFormat('hr-HR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zagreb' }).format(new Date());
  return deliver(
    rows,
    { event: 'test', title: 'Probna obavijest', body: `Obavijesti rade na ovom uređaju (${time}).`, url: '/admin/postavke/obavijesti', tag: 'test', renotify: true },
    'high',
  );
}

/* ── okidači (pozivaju javne rute; slanje ide u pozadinu) ────────────────── */

function fire(event: PushEvent, payload: PushPayload, prepare?: (p: PushPayload) => Promise<PushPayload>): void {
  if (!isPushConfigured()) {
    if (isLocal()) console.info(`[push:dev] ${event} ${JSON.stringify(payload)}`);
    return;
  }
  background(
    (async () => {
      const p = prepare ? await prepare(payload).catch(() => payload) : payload;
      // lokalno (astro dev) zapiši pripremljenu obavijest u log — za provjeru okidača; na Vercelu se sadržaj ne logira
      if (isLocal()) console.info(`[push:dev] ${event} ${JSON.stringify(p)}`);
      const r = await sendPush(event, p);
      if (r.total) console.info(`[push] ${event}: poslano ${r.sent}/${r.total}${r.removed ? `, uklonjeno ${r.removed}` : ''}${r.failed ? `, greške ${r.failed}` : ''}`);
    })(),
    'push',
  );
}

/**
 * Zaštita od poplave obavijesti preko javne forme (netko mijenja IP-ove): nakon LEAD_BURST upita u 10 min
 * svaki sljedeći upit samo tiho ZAMIJENI jednu zbirnu obavijest ("N novih upita") — bez ponovnog zvonjenja.
 */
const LEAD_BURST = 5;
const LEAD_WINDOW_SEC = 600;
async function throttleLead(p: PushPayload): Promise<PushPayload> {
  const r = await hit('push-lead', 'sve', LEAD_WINDOW_SEC, LEAD_BURST);
  if (r.ok) return p;
  return {
    title: 'Više novih upita s web stranice',
    body: `${r.count} upita u zadnjih 10 minuta — otvorite popis upita.`,
    url: '/admin/upiti',
    tag: 'lead-burst',
    renotify: false,
  };
}

export function leadPushPayload(lead: { id: number; jobType: string; location: string }): PushPayload {
  const no = leadNumber(lead.id);
  const parts = [scrub(jobLabel(lead.jobType), 50), scrub(lead.location, 60)].filter(Boolean);
  return { title: `Novi upit #U-${no}`, body: parts.join(' · ') || 'Upit s web stranice', url: `/admin/upiti/${lead.id}`, tag: `lead-${lead.id}`, renotify: true };
}

/** Ime klijenta za obavijest: samo prvo ime (ili naslov ponude). */
const firstNameOrTitle = (q: { clientName: string; title: string }) => {
  const first = scrub(q.clientName ?? '', 40).split(/\s+/)[0] ?? '';
  return first && first !== '…' ? first : scrub(q.title ?? '', 50);
};

export function acceptedPushPayload(q: { id: number; number: string; clientName: string; title: string; total: number }): PushPayload {
  const who = firstNameOrTitle(q);
  return {
    title: `Ponuda ${q.number} prihvaćena`,
    body: [who, formatEur(q.total)].filter(Boolean).join(' · '),
    url: `/admin/ponude/${q.id}`,
    tag: `quote-${q.id}-accepted`,
    renotify: true,
  };
}

export function openedPushPayload(q: { id: number; number: string; clientName: string; title: string; total: number }): PushPayload {
  const who = firstNameOrTitle(q);
  return {
    title: `Klijent je otvorio ponudu ${q.number}`,
    body: [who, formatEur(q.total)].filter(Boolean).join(' · '),
    url: `/admin/ponude/${q.id}`,
    tag: `quote-${q.id}-opened`,
  };
}

export const notifyNewLead = (lead: Parameters<typeof leadPushPayload>[0]) => fire('lead', leadPushPayload(lead), throttleLead);
export const notifyQuoteAccepted = (q: Parameters<typeof acceptedPushPayload>[0]) => fire('accepted', acceptedPushPayload(q));
export const notifyQuoteOpened = (q: Parameters<typeof openedPushPayload>[0]) => fire('opened', openedPushPayload(q));
