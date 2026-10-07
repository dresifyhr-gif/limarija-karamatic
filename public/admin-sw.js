/*
 * Service worker ADMINA (Karamatić — Admin, PWA). Registrira ga samo admin (src/components/admin/PwaHead.astro)
 * s opsegom /admin — javna stranica ga nikad ne registrira i nije pod njegovom kontrolom.
 *
 *  - push              → obavijest (naslov, tekst, ikona, značka, tag, data.url); bez podataka → općenita obavijest
 *  - notificationclick → fokusira postojeći prozor admina i otvara data.url (samo /admin/** na našoj domeni), inače novi prozor
 *  - fetch             → SAMO navigacije (GET) unutar /admin: mreža prvo; bez mreže → ugrađena stranica "Nema veze".
 *                        Ništa se ne sprema u Cache Storage: ni API odgovori ni HTML admina nikad nisu dostupni offline.
 *  - pushsubscriptionchange → nova pretplata se (ako je sesija još valjana) prijavi serveru umjesto stare
 */
const SW_VERSION = 'kr-admin-sw-2';
const SCOPE_PATH = '/admin';
const ICON = '/pwa/icon-192.png';
const BADGE = '/pwa/badge-96.png';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // stari keševi (ako ih je ikad bilo) — admin ne drži ništa offline
      const keys = await caches.keys().catch(() => []);
      await Promise.all(keys.map((k) => caches.delete(k)));
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable().catch(() => {});
      await self.clients.claim();
    })(),
  );
});

/* ── offline ─────────────────────────────────────────────────────────────── */

const OFFLINE_HTML = `<!doctype html>
<html lang="hr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex"><meta name="theme-color" content="#0e1013"><title>Nema veze · Karamatić</title>
<style>
*{box-sizing:border-box}html,body{margin:0;min-height:100%}
body{min-height:100dvh;display:grid;place-items:center;padding:24px 16px;background:#eeece7;color:#15181b;
font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{width:100%;max-width:26rem;background:#fff;border:1px solid rgb(21 24 27/.12);border-radius:3px;padding:28px 22px}
svg{display:block;width:44px;height:auto;margin-bottom:18px}
h1{font-size:1.375rem;line-height:1.2;margin:0 0 .5rem;font-weight:800;letter-spacing:-.01em}
p{margin:0 0 1.25rem;color:rgb(21 24 27/.72)}
button{appearance:none;border:0;border-radius:3px;background:#d7141a;color:#fff;font:inherit;font-weight:650;
height:52px;width:100%;cursor:pointer}button:active{background:#b80f15}
</style></head><body><main>
<svg viewBox="0 -10 954 698" aria-hidden="true"><path d="M8 688 477-10 946 688H661L477 236 293 688Z" fill="#0e1013"/><path d="M353 688 477 383 601 688Z" fill="#d7141a"/></svg>
<h1>Nema veze — pokušajte ponovno</h1>
<p>Uređaj trenutno nije spojen na internet. Provjerite mobilne podatke ili Wi-Fi pa pokušajte ponovno.</p>
<button type="button" onclick="location.reload()">Pokušaj ponovno</button>
</main><script>addEventListener('online',function(){location.reload()})</script></body></html>`;

function offlineResponse() {
  return new Response(OFFLINE_HTML, {
    status: 503,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' },
  });
}

function inScope(url) {
  return url.origin === self.location.origin && (url.pathname === SCOPE_PATH || url.pathname.startsWith(SCOPE_PATH + '/'));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // samo navigacije (otvaranje stranice) unutar admina; API, slike, skripte… idu ravno na mrežu bez SW-a
  if (req.mode !== 'navigate' || req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!inScope(url)) return;
  event.respondWith(
    (async () => {
      try {
        const preloaded = await event.preloadResponse;
        if (preloaded) return preloaded;
        return await fetch(req);
      } catch {
        return offlineResponse();
      }
    })(),
  );
});

/* ── push ────────────────────────────────────────────────────────────────── */

/** Samo putanje admina na našoj domeni (obavijest nikad ne vodi na tuđu adresu). */
function safeUrl(raw) {
  try {
    const u = new URL(typeof raw === 'string' && raw ? raw : SCOPE_PATH, self.location.origin);
    return inScope(u) ? u.pathname + u.search + u.hash : SCOPE_PATH;
  } catch {
    return SCOPE_PATH;
  }
}

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = typeof data.title === 'string' && data.title ? data.title.slice(0, 120) : 'Karamatić — nova obavijest';
  const tag = typeof data.tag === 'string' && data.tag ? data.tag.slice(0, 64) : undefined;
  const options = {
    body: typeof data.body === 'string' ? data.body.slice(0, 240) : '',
    icon: ICON,
    badge: BADGE,
    lang: 'hr',
    dir: 'ltr',
    tag,
    renotify: !!(tag && data.renotify),
    timestamp: typeof data.ts === 'number' ? data.ts : Date.now(),
    data: { url: safeUrl(data.url), event: typeof data.event === 'string' ? data.event : '' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

/** Fokusiraj otvoreni prozor admina i otvori putanju; bez prozora → novi prozor (aplikacija). */
async function openAdminUrl(target) {
  const path = safeUrl(target);
  const abs = new URL(path, self.location.origin).href;
  const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const admin = wins.find((c) => inScope(new URL(c.url))) || null;
  if (admin) {
    try {
      const c = (await admin.focus()) || admin;
      if (c.url !== abs) {
        // navigate() radi samo za prozore pod kontrolom ovog SW-a; inače prozor sam prijeđe (poruka kr:navigate)
        const nav = 'navigate' in c ? await c.navigate(abs).catch(() => null) : null;
        if (!nav) c.postMessage({ type: 'kr:navigate', url: path });
      }
      return 'focused';
    } catch {
      /* prozor se ne može fokusirati → novi */
    }
  }
  await self.clients.openWindow(abs);
  return 'opened';
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(openAdminUrl(event.notification.data && event.notification.data.url));
});

/* ── promjena pretplate (preglednik je obnovio ključeve) ─────────────────── */

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      const old = event.oldSubscription;
      let sub = event.newSubscription;
      if (!sub && old && old.options && old.options.applicationServerKey) {
        sub = await self.registration.pushManager
          .subscribe({ userVisibleOnly: true, applicationServerKey: old.options.applicationServerKey })
          .catch(() => null);
      }
      if (!sub) return;
      await fetch('/api/admin/push', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON(), replaces: old ? old.endpoint : undefined }),
      }).catch(() => {});
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'kr:version' && event.ports && event.ports[0]) event.ports[0].postMessage(SW_VERSION);
});
