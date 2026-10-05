/**
 * Globalni "reveal" sustav, uključen jednom u Base layoutu.
 *
 *  data-reveal                → lagano podizanje + fade (draft), jednom
 *  data-reveal-delay="0.1"    → dodatno kašnjenje u sekundama
 *  data-reveal-group          → na roditelju: djeca s data-reveal ulaze u nizu (stagger 0.06)
 *  data-scan                  → otkrivanje slike odozgo prema dolje sa "scan" linijom
 *                               (jedini stil otkrivanja fotografija na cijeloj stranici)
 *
 * Kad animacija završi, element dobiva atribut data-revealed i CSS ga više ne skriva.
 * Scan: čeka da se slika dekodira, skenovi koji uđu zajedno idu jedan za drugim,
 * a samo prvi u nizu ima crvenu liniju (jedna crvena stvar u pokretu po ekranu).
 */
import { gsap, ScrollTrigger, motionOn, markMotionReady } from './motion';

const SCAN_DURATION = 0.9;
const SCAN_STAGGER = 0.22;

function imageReady(el: HTMLElement): Promise<void> {
  const img = el.querySelector('img');
  if (!img || (img.complete && img.naturalWidth > 0)) return Promise.resolve();
  if (img.loading === 'lazy') img.loading = 'eager';
  const decoded = new Promise<void>((resolve) => {
    img.addEventListener('load', () => resolve(), { once: true });
    img.addEventListener('error', () => resolve(), { once: true });
  });
  return Promise.race([decoded, new Promise<void>((r) => setTimeout(r, 1500))]);
}

function playScan(el: HTMLElement, red: boolean) {
  let line = el.querySelector<HTMLElement>(':scope > .scanline');
  if (!line) {
    line = document.createElement('span');
    line.className = 'scanline';
    line.setAttribute('aria-hidden', 'true');
    el.appendChild(line);
  }
  line.classList.toggle('is-neutral', !red);
  gsap
    .timeline()
    .set(line, { opacity: 1, y: 0 })
    .to(el, { clipPath: 'inset(0 0 0% 0)', duration: SCAN_DURATION, ease: 'draft' }, 0)
    .to(line, { y: () => el.offsetHeight, duration: SCAN_DURATION, ease: 'draft' }, 0)
    .to(line, { opacity: 0, duration: 0.2 }, SCAN_DURATION - 0.05)
    .add(() => el.setAttribute('data-revealed', ''))
    .set(el, { clearProps: 'clipPath' });
}

function initReveal() {
  if (!motionOn()) return;

  const groups = new Set<Element>();
  document.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
    const group = el.closest('[data-reveal-group]');
    if (group) {
      groups.add(group);
      return;
    }
    const delay = parseFloat(el.dataset.revealDelay ?? '0') || 0;
    gsap.to(el, {
      opacity: 1,
      y: 0,
      duration: 0.7,
      delay,
      ease: 'draft',
      clearProps: 'transform',
      onComplete: () => el.setAttribute('data-revealed', ''),
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    });
  });

  groups.forEach((group) => {
    const items = group.querySelectorAll<HTMLElement>('[data-reveal]');
    gsap.to(items, {
      opacity: 1,
      y: 0,
      duration: 0.6,
      ease: 'draft',
      stagger: {
        each: 0.06,
        onComplete() {
          (this.targets()[0] as HTMLElement).setAttribute('data-revealed', '');
        },
      },
      clearProps: 'transform',
      scrollTrigger: { trigger: group, start: 'top 85%', once: true },
    });
  });

  const scans = gsap.utils.toArray<HTMLElement>('[data-scan]');
  if (scans.length) {
    ScrollTrigger.batch(scans, {
      start: 'top 85%',
      once: true,
      onEnter: (batch) => {
        // Nakon skoka na sidro batch sadrži i sve preskočene slike: one koje nisu
        // na ekranu otkrij odmah, a animiraj samo vidljive (prva ima crvenu liniju).
        const visible: HTMLElement[] = [];
        (batch as HTMLElement[]).forEach((el) => {
          const r = el.getBoundingClientRect();
          const off = r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth;
          if (off) {
            gsap.set(el, { clearProps: 'clipPath' });
            el.setAttribute('data-revealed', '');
          } else {
            visible.push(el);
          }
        });
        visible.forEach((el, i) => {
          imageReady(el).then(() => {
            gsap.delayedCall(i * SCAN_STAGGER, () => playScan(el, i === 0));
          });
        });
      },
    });
  }

  ScrollTrigger.refresh();
}

markMotionReady();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initReveal, { once: true });
} else {
  initReveal();
}
