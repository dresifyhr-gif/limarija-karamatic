/**
 * Zajednički GSAP setup. Svaka komponenta uvozi odavde — ne registrirati
 * pluginove ponovno u komponentama.
 *
 * Pravilo pokreta: "lim se savija, ne skakuće".
 *  - ease "draft"  → linije, crteži, kote (power2.inOut, 0.6–0.9 s)
 *  - ease "press"  → savijanje, polaganje traka, pečati (brz ulaz, tvrdi stop, ~2 % povrat, 0.18–0.3 s)
 *  - mali UI pokreti 150–200 ms
 *  - nikad elastic/bounce, nikad scroll-jacking
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CustomEase } from 'gsap/CustomEase';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin';

gsap.registerPlugin(ScrollTrigger, CustomEase, DrawSVGPlugin, MorphSVGPlugin);

CustomEase.create('draft', '0.45,0,0.55,1');
// brzo do cilja, tvrdi stop s ~2 % prebačaja i povratom
CustomEase.create('press', 'M0,0 C0.12,0.62 0.24,1.02 0.38,1.02 0.55,1.02 0.7,0.998 1,1');

declare global {
  interface Window {
    __krMotion?: boolean;
  }
}

/** true kad animacije smiju raditi (postavlja inline skripta u <head>). */
export function motionOn(): boolean {
  return document.documentElement.classList.contains('motion');
}

/** Javi da je JS za pokret učitan — sprječava fallback koji otkriva sve elemente. */
export function markMotionReady(): void {
  window.__krMotion = true;
}

/** Korisnički prekidač "Animacije isključene" (sprema se u localStorage). */
export function setMotionPreference(off: boolean): void {
  try {
    localStorage.setItem('kr-motion', off ? 'off' : 'on');
  } catch {}
  const d = document.documentElement;
  // Uključivanje se primjenjuje od sljedećeg učitavanja: dodavanje .motion sada
  // bi sakrilo sav sadržaj koji reveal.ts nije ni pripremio.
  d.classList.toggle('motion-off', off);
  if (off) {
    d.classList.remove('motion');
    gsap.globalTimeline.getChildren(true, true, true).forEach((t) => t.progress(1));
    ScrollTrigger.getAll().forEach((st) => st.kill(false));
    document.querySelectorAll<HTMLElement>('[data-reveal],[data-scan]').forEach((el) => {
      el.style.opacity = '';
      el.style.transform = '';
      el.style.clipPath = '';
    });
  }
}

export { gsap, ScrollTrigger, CustomEase, DrawSVGPlugin, MorphSVGPlugin };
