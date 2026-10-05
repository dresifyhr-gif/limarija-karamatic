#!/usr/bin/env node
/**
 * Screenshot pomoćnik (koristi instalirani Google Chrome preko playwright-core).
 *
 *   node scripts/shot.mjs <putanja|url> <izlaz.png> [opcije]
 *
 * Opcije:
 *   --mobile            390×844 @2x, touch, mobilni UA
 *   --w=1440 --h=900    veličina prozora (desktop default 1440×900)
 *   --full              cijela stranica (prije toga polako skrola do dna da okine reveal animacije)
 *   --selector=CSS      snimi samo taj element (npr. --selector="#usluge")
 *   --wait=MS           pričekaj nakon učitavanja (default 600)
 *   --scroll=PX         skrolaj na poziciju prije snimanja
 *   --reduced           emulira prefers-reduced-motion: reduce
 *   --tiles             skrola stranicu ekran po ekran i snima svaki (ime-01.png, ime-02.png…)
 *   --frames=0,800,1600 snimi više kadrova u zadanim ms od učitavanja (izlaz: ime-0.png, ime-800.png…)
 *   --base=URL          default http://localhost:4321
 * Ispisuje greške iz konzole i neuspjele zahtjeve.
 */
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const pos = args.filter((a) => !a.startsWith('--'));
const opt = Object.fromEntries(
  args
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const [k, ...v] = a.slice(2).split('=');
      return [k, v.length ? v.join('=') : true];
    }),
);
if (pos.length < 2) {
  console.error('Upotreba: node scripts/shot.mjs <putanja|url> <izlaz.png> [--mobile] [--full] [--selector=…]');
  process.exit(1);
}
const base = opt.base || 'http://localhost:4321';
const url = /^https?:/.test(pos[0]) ? pos[0] : base + (pos[0].startsWith('/') ? pos[0] : '/' + pos[0]);
const out = pos[1];
const mobile = !!opt.mobile;
const wait = Number(opt.wait ?? 600);

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({
  viewport: mobile ? { width: 390, height: 844 } : { width: Number(opt.w || 1440), height: Number(opt.h || 900) },
  // cijela stranica na mobitelu @1x — Chrome ne može snimiti više od 16 384 px
  deviceScaleFactor: mobile && !opt.full ? 2 : 1,
  isMobile: mobile,
  hasTouch: mobile,
  userAgent: mobile
    ? 'Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36'
    : undefined,
  reducedMotion: opt.reduced ? 'reduce' : 'no-preference',
  locale: 'hr-HR',
});
const page = await context.newPage();
const problems = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') problems.push(`[console.${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message}`));
page.on('requestfailed', (r) => problems.push(`[requestfailed] ${r.url()} ${r.failure()?.errorText}`));
page.on('response', (r) => {
  if (r.status() >= 400) problems.push(`[http ${r.status()}] ${r.url()}`);
});

const t0 = Date.now();
await page.goto(url, { waitUntil: 'load', timeout: 60000 });

if (opt.frames) {
  const frames = String(opt.frames)
    .split(',')
    .map(Number)
    .sort((a, b) => a - b);
  for (const f of frames) {
    const dt = f - (Date.now() - t0);
    if (dt > 0) await page.waitForTimeout(dt);
    const file = out.replace(/\.png$/, `-${f}.png`);
    if (opt.selector) await page.locator(String(opt.selector)).first().screenshot({ path: file });
    else await page.screenshot({ path: file });
    console.log('saved', file);
  }
} else {
  await page.waitForTimeout(wait);
  if (opt.full) {
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    const step = mobile ? 500 : 700;
    for (let y = 0; y < h; y += step) {
      await page.evaluate((yy) => window.scrollTo(0, yy), y);
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(900);
    // lijene slike: učitaj i dekodiraj sve prije snimke cijele stranice
    await page.evaluate(async () => {
      const imgs = [...document.images];
      imgs.forEach((i) => (i.loading = 'eager'));
      await Promise.all(imgs.map((i) => (i.complete ? i.decode().catch(() => {}) : new Promise((r) => { i.onload = i.onerror = r; }).then(() => i.decode().catch(() => {})))));
    });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);
  }
  if (opt.scroll) {
    await page.evaluate((yy) => window.scrollTo(0, yy), Number(opt.scroll));
    await page.waitForTimeout(Math.max(900, wait));
  }
  if (opt.tiles) {
    // nakon prolaza kroz stranicu: snimke veličine ekrana redom (ime-01.png, ime-02.png…)
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    const vh = page.viewportSize().height;
    let i = 1;
    for (let y = 0; y < h; y += vh - 60) {
      await page.evaluate((yy) => window.scrollTo(0, yy), y);
      await page.waitForTimeout(1300);
      const file = out.replace(/\.png$/, `-${String(i++).padStart(2, '0')}.png`);
      await page.screenshot({ path: file });
      console.log('saved', file);
    }
  } else if (opt.selector) {
    const loc = page.locator(String(opt.selector)).first();
    await loc.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1400);
    await loc.screenshot({ path: out });
  } else {
    await page.screenshot({ path: out, fullPage: !!opt.full });
  }
  console.log('saved', out);
}

if (problems.length) {
  console.log('--- problemi ---');
  for (const p of [...new Set(problems)]) console.log(p);
} else {
  console.log('bez grešaka u konzoli');
}
await browser.close();
