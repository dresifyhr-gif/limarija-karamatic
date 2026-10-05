/**
 * Hero "NACRT → LIM" — vremenska animacija lista 01 (nije vezana uz skrol, nema pina).
 * Samo crtež, bez fotografije: uvod završava na GOTOVOM CRTEŽU.
 *
 *  0,0–0,8  crtež se iscrta (DrawSVG, draft), crvene kote se odbroje
 *  0,8–1,2  UDARAC PREŠE: greda s crvenim Λ padne (0,16 s, press), ravni lim se
 *           savije u Λ opšav (MorphSVG, 0,22 s), bljesak uz sljeme
 *  1,2–1,9  trake stojećeg falca polažu se slijeva nadesno, bljesak na svakom šavu
 *  1,9–2,4  crvena linija strehe, oluk i vertikala, kapa dimnjaka, snjegobrani
 *  2,4–2,8  jedan odsjaj preko lima, pečat "IZVEDENO" — kraj
 *
 * HTML je uvijek u ZAVRŠNOM stanju (gotov crtež). JS ga vrati na prazan list samo kad je
 * motionOn(), a nakon kraja (ili preskakanja) vrati sve inline stilove — ostaje čisti CSS.
 * Skrol / kotačić / dodir / tipka / fokus na CTA → odmah na kraj. Jednom po sesiji.
 */
import { gsap, motionOn } from '@/lib/motion';

export type IntroMode = 'full' | 'short' | 'none';

const KEY = 'kr-hero-played';
const PHASES = ['01 · Nacrt', '02 · Savijanje', '03 · Polaganje lima', '04 · Opšav i oluk', '05 · Izvedeno'];

const fmt = (v: number, suffix = '') =>
  Math.round(v)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + suffix;

/**
 * Gradi uvodnu animaciju (pauziranu). 'full' ≈ 2,9 s (desktop), 'short' ≈ 2,2 s (mobitel),
 * 'none' = ništa (HTML je već završni kadar). Pozivati unutar gsap.context-a.
 */
export function buildIntro(root: HTMLElement, mode: IntroMode): gsap.core.Timeline | null {
  if (mode === 'none') return null;
  const short = mode === 'short';
  const k = short ? 0.75 : 1;
  const at = (t: number) => +(t * k).toFixed(3);
  const $ = <T extends Element = Element>(s: string) => gsap.utils.toArray<T>(s, root);
  const one = <T extends Element = Element>(s: string) => root.querySelector<T>(s)!;

  const phase = one<HTMLElement>('[data-hx-phase]');
  const progress = one<HTMLElement>('[data-hx-progress]');
  const bar = one<SVGPathElement>('.hx-bar');
  const beam = one('.hx-beam');
  const flash = one('.hx-flash');
  const glint = one('.hx-glint');
  const stamp = one('.hx-stamp-in');
  const strips = $<SVGPathElement>('.hx-strip');
  const seams = $<SVGPathElement>('.hx-seam');
  const seamFlash = $<SVGPathElement>('.hx-sf');
  const guards = $('.hx-guard');
  const nums = $<SVGTSpanElement>('.hx-num');

  /* ── prazan list ─────────────────────────────────────────── */
  gsap.set($('.hx-l'), { drawSVG: '0%' });
  gsap.set($('.hx-dl'), { drawSVG: '0%' });
  gsap.set([one('.hx-hatch'), one('.hx-dot'), ...$('.hx-dt'), one('.hx-ruler'), one('.hx-dash')], { opacity: 0 });
  gsap.set(bar, { attr: { d: bar.dataset.flat! }, opacity: 0 });
  gsap.set([...strips, ...seams, one('.hx-wingroof'), one('.hx-wingband'), one('.hx-wingseams'), one('.hx-chimfill')], {
    opacity: 0,
  });
  gsap.set(seamFlash, { opacity: 0 });
  gsap.set([one('.hx-eave'), one('.hx-red2')], { drawSVG: '0%' });
  gsap.set(one('.hx-gutter'), { scaleX: 0, transformOrigin: '0% 50%' });
  gsap.set(one('.hx-pipe'), { scaleY: 0, transformOrigin: '50% 0%' });
  gsap.set(one('.hx-cap'), { y: -20, opacity: 0 });
  gsap.set(guards, { opacity: 0, scale: 0.4, transformOrigin: '50% 100%' });
  gsap.set(beam, { autoAlpha: 1, y: -340 });
  gsap.set(flash, { opacity: 0, drawSVG: '50% 50%' });
  gsap.set(glint, { x: -160 });
  gsap.set(stamp, { opacity: 0, scale: 1.15, transformOrigin: '50% 50%' });
  gsap.set(progress, { scaleX: 0, transformOrigin: '0% 50%' });
  nums.forEach((el) => (el.textContent = fmt(0, el.dataset.suffix)));
  phase.textContent = PHASES[0];

  const tl = gsap.timeline({ paused: true, defaults: { ease: 'draft' } });
  const setPhase = (i: number, t: number) => tl.call(() => void (phase.textContent = PHASES[i]), undefined, t);

  /* ── 1 · nacrt ───────────────────────────────────────────── */
  tl.to([one('.hx-dash'), one('.hx-ruler')], { opacity: 1, duration: at(0.5) }, 0);
  tl.to($('.hx-l'), { drawSVG: '100%', duration: at(0.74), stagger: { amount: at(0.1) } }, at(0.02));
  tl.to(one('.hx-hatch'), { opacity: 1, duration: at(0.3) }, at(0.45));
  tl.to($('.hx-dl'), { drawSVG: '100%', duration: at(0.56), stagger: at(0.05) }, at(0.14));
  tl.to([one('.hx-dot'), ...$('.hx-dt')], { opacity: 1, duration: at(0.2), stagger: at(0.04) }, at(0.22));
  nums.forEach((el) => {
    const to = Number(el.dataset.to);
    const o = { v: 0 };
    tl.to(
      o,
      { v: to, duration: at(0.56), onUpdate: () => void (el.textContent = fmt(o.v, el.dataset.suffix)) },
      at(0.22),
    );
  });
  tl.to(bar, { opacity: 1, duration: 0.16 }, at(0.62));

  /* ── 2 · udarac preše ────────────────────────────────────── */
  // greda dodirne ravni lim (iznad sljemena), pa ga potisne do vrha zabata
  const contact = Number(bar.dataset.gap ?? 14);
  const dropAt = at(0.84);
  const bendAt = dropAt + 0.16;
  // greda se digne čim je lim savijen — prije prve trake (jedna crvena stvar u pokretu)
  const liftAt = bendAt + 0.2;
  setPhase(1, at(0.8));
  tl.to(beam, { y: -contact, duration: 0.16, ease: 'press' }, dropAt);
  tl.to(beam, { y: 0, duration: 0.22, ease: 'press' }, bendAt);
  tl.to(bar, { morphSVG: { shape: bar.dataset.band!, type: 'linear' }, duration: 0.22, ease: 'press' }, bendAt);
  tl.to(flash, { opacity: 1, duration: 0.04 }, bendAt + 0.15);
  tl.to(flash, { drawSVG: '0% 100%', duration: 0.24 }, bendAt + 0.15);
  tl.to(flash, { opacity: 0, duration: 0.22 }, bendAt + 0.3);
  tl.to(beam, { y: -340, duration: 0.2, ease: 'power3.in' }, liftAt);
  tl.set(beam, { autoAlpha: 0 }, liftAt + 0.2);

  /* ── 3 · polaganje traka ─────────────────────────────────── */
  const layAt = Math.max(at(1.24), liftAt + 0.12);
  setPhase(2, layAt);
  tl.to(one('.hx-chimfill'), { opacity: 1, duration: 0.2 }, layAt);
  const step = short ? 2 : 1;
  const gap = short ? 0.085 : 0.066;
  let landEnd = layAt;
  for (let i = 0, g = 0; i < strips.length; i += step, g++) {
    const t = layAt + g * gap;
    const group = strips.slice(i, i + step);
    tl.fromTo(group, { opacity: 0, y: -12 }, { opacity: 1, y: 0, duration: 0.22, ease: 'press' }, t);
    // šav lijevo od trake "sjedne" s njom i bljesne
    const seamIdx = [];
    for (let j = i; j < i + step; j++) if (j > 0) seamIdx.push(j - 1);
    const s = seamIdx.map((j) => seams[j]).filter(Boolean);
    const f = seamIdx.map((j) => seamFlash[j]).filter(Boolean);
    if (s.length) tl.to(s, { opacity: 1, duration: 0.12 }, t + 0.1);
    if (f.length) {
      tl.to(f, { opacity: 0.95, duration: 0.05 }, t + 0.14);
      tl.to(f, { opacity: 0, duration: 0.26 }, t + 0.2);
    }
    landEnd = t + 0.22;
  }
  tl.fromTo(
    [one('.hx-wingband'), one('.hx-wingroof'), one('.hx-wingseams')],
    { opacity: 0, y: -8 },
    { opacity: 1, y: 0, duration: 0.22, ease: 'press' },
    landEnd - 0.12,
  );

  /* ── 4 · opšav, oluk, dimnjak, snjegobrani ───────────────── */
  const trimAt = Math.max(at(1.94), landEnd + 0.02);
  setPhase(3, trimAt);
  tl.to([one('.hx-eave'), one('.hx-red2')], { drawSVG: '100%', duration: short ? 0.36 : 0.46 }, trimAt);
  tl.to(one('.hx-gutter'), { scaleX: 1, duration: 0.24, ease: 'press' }, trimAt + 0.06);
  tl.to(one('.hx-cap'), { y: 0, opacity: 1, duration: 0.2, ease: 'press' }, trimAt + 0.12);
  tl.to(one('.hx-pipe'), { scaleY: 1, duration: 0.2, ease: 'press' }, trimAt + 0.2);
  tl.to(
    guards,
    { opacity: 1, scale: 1, duration: 0.18, ease: 'press', stagger: short ? 0 : 0.024 },
    trimAt + (short ? 0.22 : 0.26),
  );

  /* ── 5 · odsjaj + pečat ──────────────────────────────────── */
  const doneAt = Math.max(at(2.44), trimAt + (short ? 0.38 : 0.48));
  setPhase(4, doneAt);
  if (!short) tl.to(glint, { x: 900, duration: 0.42 }, doneAt);
  const stampAt = doneAt + (short ? 0.02 : 0.18);
  tl.to(stamp, { opacity: 1, scale: 1, duration: 0.22, ease: 'press' }, stampAt);

  tl.to(progress, { scaleX: 1, duration: tl.duration(), ease: 'none' }, 0);
  return tl;
}

/* ── kontroler: jednom po sesiji, preskakanje, "Ponovi", matchMedia ─── */
function initHero(root: HTMLElement) {
  if (root.dataset.hxInit) return;
  root.dataset.hxInit = '1';
  if (!motionOn()) return;

  const sheet = root.querySelector<HTMLElement>('[data-hx-sheet]');
  const replay = root.querySelector<HTMLButtonElement>('[data-hx-replay]');
  const ctas = root.querySelector<HTMLElement>('[data-hx-ctas]');
  if (!sheet) return;
  const sheetEl = sheet;

  let played = document.documentElement.classList.contains('hx-played');
  try {
    played ||= sessionStorage.getItem(KEY) === '1';
  } catch {}

  let ctx: gsap.Context | null = null;
  let tl: gsap.core.Timeline | null = null;
  let done = true;

  const restoreText = () => {
    root.querySelectorAll<SVGTSpanElement>('.hx-num').forEach((el) => {
      el.textContent = fmt(Number(el.dataset.to), el.dataset.suffix);
    });
    const ph = root.querySelector<HTMLElement>('[data-hx-phase]');
    if (ph) ph.textContent = ph.dataset.final ?? '';
  };

  const onSkip = () => skip();
  const skipEvents = ['wheel', 'touchstart', 'keydown', 'scroll'] as const;
  const addSkip = () => {
    skipEvents.forEach((e) => window.addEventListener(e, onSkip, { passive: true }));
    ctas?.addEventListener('focusin', onSkip);
  };
  const removeSkip = () => {
    skipEvents.forEach((e) => window.removeEventListener(e, onSkip));
    ctas?.removeEventListener('focusin', onSkip);
  };

  function stop() {
    removeSkip();
    tl?.kill();
    tl = null;
    ctx?.revert();
    ctx = null;
    done = true;
    restoreText();
  }

  function finish() {
    if (done) return;
    done = true;
    removeSkip();
    const mine = ctx;
    // kraj = HTML završno stanje (gotov crtež): makni sve inline stilove
    requestAnimationFrame(() => {
      if (ctx !== mine || !mine) return;
      tl?.kill();
      tl = null;
      mine.revert();
      ctx = null;
      restoreText();
    });
  }

  function skip() {
    if (done || !tl) return;
    tl.progress(1);
    restoreText();
    finish();
  }

  function start(mode: IntroMode) {
    stop();
    sheetEl.classList.add('is-live');
    // tko je već skrolao niz stranicu, ne treba mu uvod
    if (mode === 'none' || window.scrollY > root.offsetHeight * 0.5) return;
    try {
      sessionStorage.setItem(KEY, '1');
    } catch {}
    done = false;
    ctx = gsap.context(() => {
      tl = buildIntro(root, mode);
    }, root);
    if (!tl) {
      done = true;
      return;
    }
    (tl as gsap.core.Timeline).eventCallback('onComplete', finish);
    addSkip();
    (tl as gsap.core.Timeline).play(0);
    // samo dev: ?hx-t=1.1 zamrzne animaciju u toj sekundi (za provjeru kadrova)
    if (import.meta.env.DEV) {
      const t = new URLSearchParams(location.search).get('hx-t');
      root.dataset.hxDur = (tl as gsap.core.Timeline).duration().toFixed(2);
      if (t !== null) {
        removeSkip();
        const frozen = tl as gsap.core.Timeline;
        frozen.pause();
        frozen.seek(Number(t), false);
      }
    }
  }

  const desk = '(min-width: 1024px)';
  const mm = gsap.matchMedia();
  mm.add({ isDesk: desk, isMob: '(max-width: 1023.98px)' }, (c) => {
    const { isDesk } = c.conditions as { isDesk: boolean };
    start(played ? 'none' : isDesk ? 'full' : 'short');
    played = true;
    return () => stop();
  });

  if (replay) {
    replay.hidden = false;
    replay.addEventListener('click', () => {
      start(window.matchMedia(desk).matches ? 'full' : 'short');
    });
  }
}

export function initHeroes() {
  document.querySelectorAll<HTMLElement>('[data-hero]').forEach(initHero);
}
