/**
 * Klijentski pomoćnici za push obavijesti admina (samo preglednik — uvoziti iz <script> u .astro).
 *
 *   const env = detectEnv();                 // platforma, instalirano (standalone), podrška, dozvola
 *   const reg = await adminRegistration();   // registracija /admin-sw.js (opseg /admin)
 *   const sub = await reg?.pushManager.getSubscription();
 *   await subscribeThisDevice(reg, publicKey, label)   // poziva se IZRAVNO iz dodira (traži dozvolu)
 *   await endpointHash(sub.endpoint)          // = PushDevice.endpointHash sa servera
 */
import { api } from './ui';

export type PushPrefs = { lead: boolean; accepted: boolean; opened: boolean };
export type PushDevice = {
  id: number;
  label: string;
  platform: string;
  prefs: PushPrefs;
  createdAt: string;
  lastSuccessAt: string | null;
  failureCount: number;
  endpointHash: string;
};
export type PushState = {
  publicKey: string | null;
  configured: boolean;
  items: PushDevice[];
  /** popis uređaja je stvarno učitan iz baze (false = greška; tada ne zaključujemo da server ne zna ovaj uređaj) */
  ok?: boolean;
};

export type Platform = 'ios' | 'android' | 'desktop';
export type PushEnv = {
  platform: Platform;
  /** npr. 17.4; null kad nije iOS ili se ne može očitati */
  iosVersion: number | null;
  /** otvoreno kao instalirana aplikacija (s početnog zaslona) */
  standalone: boolean;
  /** preglednik ima service worker + Push API + Notification */
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  isSafari: boolean;
  /** ugrađeni preglednik aplikacije (WhatsApp, Facebook, Instagram…) */
  inApp: boolean;
};

export function detectEnv(): PushEnv {
  const ua = navigator.userAgent;
  const iPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  const ios = /iPhone|iPad|iPod/.test(ua) || iPadOS;
  const platform: Platform = ios ? 'ios' : /Android/.test(ua) ? 'android' : 'desktop';
  let iosVersion: number | null = null;
  const m = /OS (\d+)[_.](\d+)/.exec(ua) || (iPadOS ? /Version\/(\d+)\.(\d+)/.exec(ua) : null);
  if (ios && m) iosVersion = Number(m[1]) + Number(m[2]) / 100;
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && window.isSecureContext;
  return {
    platform,
    iosVersion,
    standalone,
    supported,
    permission: 'Notification' in window ? Notification.permission : 'unsupported',
    isSafari: /Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS|Chrome\//.test(ua),
    inApp: /FBAN|FBAV|Instagram|WhatsApp|Line\/|; wv\)/.test(ua),
  };
}

/** Prijedlog naziva uređaja. */
export function suggestLabel(env = detectEnv()): string {
  const ua = navigator.userAgent;
  if (env.platform === 'ios') return /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'iPad' : 'iPhone';
  if (env.platform === 'android') return 'Android mobitel';
  if (/Mac OS X|Macintosh/.test(ua)) return 'Mac računalo';
  if (/Windows/.test(ua)) return 'Windows računalo';
  return 'Računalo';
}

/** Registracija admin service workera (registrira ga ako još nije). null kad preglednik nema SW. */
export async function adminRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg =
      (await navigator.serviceWorker.getRegistration('/admin')) ??
      (await navigator.serviceWorker.register('/admin-sw.js', { scope: '/admin', updateViaCache: 'none' }));
    if (!reg.active) {
      // pričekaj aktivaciju (prvi posjet)
      await Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(r, 5000))]);
    }
    return reg;
  } catch {
    return null;
  }
}

export async function endpointHash(endpoint: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Uključi obavijesti na ovom uređaju. MORA se pozvati izravno iz dodira/klika (prije bilo kakvog drugog await-a),
 * jer pushManager.subscribe() tada traži dozvolu za obavijesti (iOS to inače odbije).
 */
export async function subscribeThisDevice(
  reg: ServiceWorkerRegistration,
  publicKey: string,
  label: string,
  /** pretplata pročitana pri učitavanju stranice (da prvi await u dodiru bude subscribe) */
  existing: PushSubscription | null,
): Promise<PushDevice> {
  let sub = existing;
  if (sub) {
    // stara pretplata s drugim ključem → nova
    const k = sub.options?.applicationServerKey;
    if (k && btoaKey(k) !== publicKey.replace(/=+$/, '')) {
      await sub.unsubscribe().catch(() => {});
      sub = null;
    }
  }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
  return api<PushDevice>('/api/admin/push', { method: 'POST', body: { subscription: sub.toJSON(), label } });
}

function btoaKey(buf: ArrayBuffer): string {
  let s = '';
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Isključi na ovom uređaju: odjava kod push servisa + brisanje na serveru. */
export async function unsubscribeThisDevice(reg: ServiceWorkerRegistration | null, deviceId: number | null): Promise<void> {
  const sub = await reg?.pushManager.getSubscription();
  if (deviceId) await api(`/api/admin/push/${deviceId}`, { method: 'DELETE' });
  await sub?.unsubscribe().catch(() => {});
}

/** Je li ovaj uređaj prijavljen (lokalna pretplata postoji I server je ima). */
export async function thisDevice(state: PushState, reg: ServiceWorkerRegistration | null): Promise<{ sub: PushSubscription | null; device: PushDevice | null }> {
  const sub = (await reg?.pushManager.getSubscription().catch(() => null)) ?? null;
  if (!sub) return { sub: null, device: null };
  const h = await endpointHash(sub.endpoint);
  return { sub, device: state.items.find((d) => d.endpointHash === h) ?? null };
}
