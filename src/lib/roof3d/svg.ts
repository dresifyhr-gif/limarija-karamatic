/**
 * SVG izlaz za engine — koristi se SAMO pri buildu (frontmatter RoofModels.astro):
 * statični gotov model za no-JS, reduced-motion i prvi kadar prije JS-a.
 *
 * Kompaktno: cijele jedinice viewBoxa, relativni odsječci (val crijepa se ponavlja → gzip),
 * uzastopni potezi istog stila spojeni u jedan <path> (redoslijed slikanja ostaje isti).
 */
import type { Out } from './engine';

const R = Math.round;
const op = (a: number) => String(R(a * 100) / 100).replace(/^0\./, '.');
/** polilinija: apsolutni M, zatim relativni l (iz zaokruženih točaka — bez nakupljanja greške) */
function d(xy: number[], n: number, close?: boolean) {
  let x = R(xy[0]),
    y = R(xy[1]);
  let s = `M${x} ${y}`;
  let rel = '';
  for (let j = 1; j < n; j++) {
    const nx = R(xy[2 * j]),
      ny = R(xy[2 * j + 1]);
    const dx = nx - x,
      dy = ny - y;
    if (!dx && !dy) continue;
    rel += (dx < 0 || !rel ? '' : ' ') + dx + (dy < 0 ? '' : ' ') + dy;
    x = nx;
    y = ny;
  }
  if (!rel) return '';
  return s + 'l' + rel + (close ? 'z' : '');
}
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

export function svgOut(): Out & { html(): string } {
  const parts: string[] = [];
  let key = '',
    acc = '';
  const flush = () => {
    if (acc) parts.push(`<path d="${acc}" ${key}/>`);
    acc = '';
    key = '';
  };
  return {
    fill(xy, n, rgb, a) {
      if (a < 0.01) return;
      const k = `fill="rgb(${rgb})"${a < 0.995 ? ` fill-opacity="${op(a)}"` : ''}`;
      const p = d(xy, n, true);
      if (!p) return;
      if (k !== key) flush();
      key = k;
      acc += p;
    },
    stroke(xy, n, rgb, a, w, dash, close) {
      if (a < 0.01 || n < 2) return;
      const p = d(xy, n, close);
      if (!p) return;
      const k = `fill="none" stroke="rgb(${rgb})" stroke-opacity="${op(a)}"${w !== 1 ? ` stroke-width="${w}"` : ''}${dash ? ' stroke-dasharray="3 4"' : ''}`;
      if (k !== key) flush();
      key = k;
      acc += p;
    },
    text(x, y, s, rgb, a, ang, align, size, knock) {
      if (a < 0.01) return;
      flush();
      const anchor = align === 1 ? 'middle' : align === 2 ? 'end' : 'start';
      const deg = R((ang * 180) / Math.PI);
      const tr = deg ? ` transform="rotate(${deg} ${R(x)} ${R(y)})"` : '';
      const w = s.length * size * 0.72;
      const bg = knock
        ? `<rect x="${R(x - w / 2 - size * 0.4)}" y="${R(y - size * 0.75)}" width="${R(w + size * 0.8)}" height="${R(size * 1.5)}" fill="#0E1013"${tr}/>`
        : '';
      parts.push(
        `${bg}<text x="${R(x)}" y="${R(y)}" dy=".35em" font-size="${R(size)}"${anchor !== 'start' ? ` text-anchor="${anchor}"` : ''} fill="rgb(${rgb})"${
          a < 0.995 ? ` fill-opacity="${op(a)}"` : ''
        }${tr}>${esc(s)}</text>`,
      );
    },
    group(name) {
      flush();
      parts.push(name ? `<g class="${name}">` : '</g>');
    },
    html: () => (flush(), parts.join('').replace(/<g class="([\w-]+)"><\/g>/g, '').replace(/<\/g><g class="rm-dim">/g, '')),
  };
}
