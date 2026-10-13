/**
 * Samo za astro.config.mjs (Node): Astro Fonts API obitelji iz `FONT_FAMILIES` (src/lib/fonts.ts).
 *
 * Datoteke su iz npm paketa @fontsource… (lokalni provider — nema mrežnog dohvaćanja ni u buildu ni u pregledniku).
 * Iz CSS-a paketa uzimaju se samo @font-face blokovi za latin i latin-ext, s istim unicode-range, debljinom i
 * širinom (font-stretch) kao fontsource.
 * Redoslijed varijanti: po CSS datoteci (debljini), u svakoj [latin, latin-ext]. Latin mora biti prvi: Astro iz PRVE
 * datoteke obitelji računa metrike zamjenskog fonta (size-adjust…), a latin-ext nema slova a–z. `fontData[cssVar]`
 * zadržava redoslijed (na tome se temelji preload u Base.astro). Preklapanje unicode-range (samo kombinirajući
 * znakovi U+0304/0308/0329) za hrvatski tekst nije bitno.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { FONT_FAMILIES, type FontFamilyDef } from './fonts.ts';

type Variant = {
  src: [string];
  weight: string;
  style: 'normal';
  stretch?: string;
  unicodeRange: [string, ...string[]];
  display: 'swap';
};

const SUBSETS = ['latin', 'latin-ext'] as const;

function variantsFor(f: FontFamilyDef, root: string): Variant[] {
  const require = createRequire(join(root, 'package.json'));
  const pkgDir = dirname(require.resolve(`${f.pkg}/package.json`));
  const out: Variant[] = [];
  for (const file of f.css) {
    const css = readFileSync(join(pkgDir, file), 'utf8');
    const faces = [...css.matchAll(/@font-face\s*{([^}]*)}/g)].map((m) => m[1]);
    for (const subset of SUBSETS) {
      const face = faces.find((b) => new RegExp(`files/[\\w-]+?-${subset}-(?:wght|wdth|\\d{3})-normal\\.woff2`).test(b));
      if (!face) throw new Error(`[fonts] ${f.pkg}/${file}: nema ${subset} podskupa`);
      const prop = (name: string) => new RegExp(`${name}:\\s*([^;]+);`).exec(face)?.[1].trim();
      const woff2 = /url\(\.\/(files\/[^)]+\.woff2)\)/.exec(face)?.[1];
      const range = prop('unicode-range');
      const weight = prop('font-weight');
      if (!woff2 || !range || !weight) throw new Error(`[fonts] ${f.pkg}/${file}: neispravan @font-face (${subset})`);
      const stretch = prop('font-stretch');
      out.push({
        src: [`${f.pkg}/${woff2}`],
        weight,
        style: 'normal',
        ...(stretch ? { stretch } : {}),
        unicodeRange: range.split(',').map((r) => r.trim()) as [string, ...string[]],
        display: 'swap',
      });
    }
  }
  return out;
}

/** Vrijednost za `fonts` u astro.config.mjs. `local` = fontProviders.local (prosljeđuje se da ovaj modul ne uvozi astro/config). */
export function fontFamiliesConfig<P>(local: () => P, root: string = process.cwd()) {
  return Object.values(FONT_FAMILIES).map((f) => ({
    provider: local(),
    name: f.name,
    cssVariable: f.cssVar,
    fallbacks: ['sans-serif'],
    optimizedFallbacks: true,
    options: { variants: variantsFor(f, root) as [Variant, ...Variant[]] },
  }));
}
