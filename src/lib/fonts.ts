/**
 * Fontovi javne stranice (admin → Izgled): popis pisama koja vlasnik smije odabrati i tokeni po pismu.
 * Radi i u pregledniku (bez Node uvoza). Oblik spremljene postavke: `DesignSettings` u `@/lib/types` (settings.design).
 *
 * - Sva pisma su SAMOSTALNO posluživana (npm paketi @fontsource…, Astro Fonts API, `astro.config.mjs` → `fonts`), bez Google Fonts CDN-a.
 *   Svako ima latin + latin-ext podskup (Č Ć Ž Š Đ č ć ž š đ, provjereno u datotekama) i potrebne debljine.
 * - Na javnoj stranici učitavaju se SAMO odabrana pisma (+ Archivo za logo i golemi KARAMATIĆ u podnožju — znak tvrtke).
 * - IBM Plex Mono (tehničke oznake), natpisi na 3D modelima u heru i PDF ponude ostaju isti.
 * - `DEFAULT_DESIGN` = izvorni izgled (Archivo široki 800 + Archivo) — s njim je stranica ista kao prije ove mogućnosti.
 * - Nakon izmjene ove datoteke (ili font-config.ts) dev server treba ponovno pokrenuti (astro.config je uvozi).
 */

/* ── obitelji (datoteke) ─────────────────────────────────────────────────── */

export type FontFamilyId = 'archivo' | 'manrope' | 'sora' | 'plus-jakarta-sans' | 'dm-sans' | 'montserrat' | 'unbounded' | 'inter' | 'ibm-plex-sans';

export type FontFamilyDef = {
  id: FontFamilyId;
  /** ime obitelji za Fonts API (u CSS-u postaje "<ime>-<hash>") */
  name: string;
  /** CSS varijabla koju puni <Font cssVariable=…/> (vrijednost: obitelj + zamjenski font s prilagođenim metrikama) */
  cssVar: `--kr-ff-${string}`;
  /** npm paket i CSS datoteke iz kojih se čitaju @font-face blokovi (samo latin i latin-ext) */
  pkg: string;
  css: string[];
  /** najmanja i najveća debljina koju pismo ima */
  weights: [number, number];
};

const fam = (id: FontFamilyId, name: string, pkg: string, css: string[], weights: [number, number]): FontFamilyDef => ({
  id,
  name,
  cssVar: `--kr-ff-${id}`,
  pkg,
  css,
  weights,
});

/** Sve obitelji su varijabilna pisma (jedna datoteka po podskupu za sve debljine). */
export const FONT_FAMILIES: Record<FontFamilyId, FontFamilyDef> = {
  // wdth.css = osi širine (62–125 %) i debljine — potrebno za logo, golemi KARAMATIĆ i "široki" naslov
  archivo: fam('archivo', 'Archivo', '@fontsource-variable/archivo', ['wdth.css'], [100, 900]),
  manrope: fam('manrope', 'Manrope', '@fontsource-variable/manrope', ['wght.css'], [200, 800]),
  sora: fam('sora', 'Sora', '@fontsource-variable/sora', ['wght.css'], [100, 800]),
  'plus-jakarta-sans': fam('plus-jakarta-sans', 'Plus Jakarta Sans', '@fontsource-variable/plus-jakarta-sans', ['wght.css'], [200, 800]),
  'dm-sans': fam('dm-sans', 'DM Sans', '@fontsource-variable/dm-sans', ['wght.css'], [100, 1000]),
  montserrat: fam('montserrat', 'Montserrat', '@fontsource-variable/montserrat', ['wght.css'], [100, 900]),
  unbounded: fam('unbounded', 'Unbounded', '@fontsource-variable/unbounded', ['wght.css'], [200, 900]),
  inter: fam('inter', 'Inter', '@fontsource-variable/inter', ['wght.css'], [100, 900]),
  'ibm-plex-sans': fam('ibm-plex-sans', 'IBM Plex Sans', '@fontsource-variable/ibm-plex-sans', ['wght.css'], [100, 700]),
};

/** Znak tvrtke (logo, golemi KARAMATIĆ) je uvijek Archivo, neovisno o odabiru. */
export const BRAND_FAMILY: FontFamilyId = 'archivo';

/* ── izbor za naslove i tekst ────────────────────────────────────────────── */

export const DISPLAY_WEIGHTS = [600, 700, 800, 900] as const;
export type DisplayWeight = (typeof DISPLAY_WEIGHTS)[number];
export const DISPLAY_WEIGHT_LABEL: Record<DisplayWeight, string> = { 600: 'Normalno', 700: 'Jako', 800: 'Vrlo jako', 900: 'Najjače' };

export type DisplayFontDef = {
  id: string;
  label: string;
  /** kratak opis za admin */
  note: string;
  family: FontFamilyId;
  /** font-stretch naslova (samo Archivo ima os širine) */
  stretch: string;
  /** razmak slova naslova (em) */
  tracking: number;
  /** prored naslova */
  leading: number;
  /** prostor iznad naslova za kvačice Č Ć Š Ž (em) kad je tekst maskiran */
  pad: number;
  /** najveća debljina koju pismo ima ili koju dopuštamo (jača se svodi na nju) */
  maxWeight: DisplayWeight;
  /**
   * Povećanje naslova sekcija (i gornja granica za H1 naslovnice) za pisma uža od izvornog: uži rez s istom
   * veličinom slova izgleda sitno. Izvorno = 1. Koristi se kao `zoom` (utility `type-grow`) i u `heroTitleFit`.
   */
  scale: number;
  /**
   * Širina tipičnih naslova (hrvatski tekst, s ovim razmakom slova) u odnosu na Archivo široki 800 = 1.
   * Izmjereno u Chromeu; koristi se za smanjivanje dugih naslova u heru (H1 naslovnice, PageHero) i mota u podnožju.
   */
  width: Record<DisplayWeight, number>;
};

/*
 * Popis je namjerno kratak (8): svako pismo izgleda drukčije. Izbačeni nakon pregleda: Plus Jakarta Sans
 * (točka i uskličnik "odvojeni" od riječi u velikim naslovima; ostaje za tekst), Barlow (gotovo isto kao
 * Archivo uski, a veće datoteke), Space Grotesk (nema debljinu 800/900).
 */
export const DISPLAY_FONTS: DisplayFontDef[] = [
  {
    id: 'archivo-expanded',
    label: 'Archivo široki',
    note: 'Izvorni izgled: širok i težak, kao znak KARAMATIĆ.',
    family: 'archivo',
    stretch: '125%',
    tracking: -0.015,
    leading: 0.95,
    pad: 0.06,
    maxWeight: 900,
    scale: 1,
    width: { 600: 0.951, 700: 0.971, 800: 1, 900: 1.041 },
  },
  {
    id: 'archivo',
    label: 'Archivo',
    note: 'Isto pismo, normalne širine. Mirnije, u redak stane više riječi.',
    family: 'archivo',
    stretch: '100%',
    tracking: -0.01,
    leading: 0.95,
    pad: 0.06,
    maxWeight: 900,
    scale: 1.06,
    width: { 600: 0.743, 700: 0.771, 800: 0.813, 900: 0.871 },
  },
  {
    id: 'archivo-condensed',
    label: 'Archivo uski',
    note: 'Usko i visoko, industrijski karakter.',
    family: 'archivo',
    stretch: '80%',
    tracking: -0.01,
    leading: 0.95,
    pad: 0.06,
    maxWeight: 900,
    scale: 1.2,
    width: { 600: 0.621, 700: 0.64, 800: 0.667, 900: 0.706 },
  },
  {
    id: 'montserrat',
    label: 'Montserrat',
    note: 'Klasično geometrijsko pismo širokih slova.',
    family: 'montserrat',
    stretch: '100%',
    tracking: -0.025,
    leading: 0.98,
    pad: 0.07,
    maxWeight: 900,
    scale: 1.04,
    width: { 600: 0.816, 700: 0.832, 800: 0.85, 900: 0.869 },
  },
  {
    id: 'unbounded',
    label: 'Unbounded',
    note: 'Vrlo široko i upečatljivo. Najbolje za kratke naslove.',
    family: 'unbounded',
    stretch: '100%',
    tracking: -0.025,
    leading: 1.02,
    pad: 0.1,
    // 900 je preširok za "Karamatić" na mobitelu i za moto u podnožju → najviše 800
    maxWeight: 800,
    scale: 1,
    // izmjereno 1,03 (800); s rezervom jer široka velika slova (K, M) troše više od prosjeka
    width: { 600: 1.0, 700: 1.02, 800: 1.06, 900: 1.06 },
  },
  {
    id: 'sora',
    label: 'Sora',
    note: 'Tehničko i geometrijsko, otvorenih oblika.',
    family: 'sora',
    stretch: '100%',
    tracking: -0.025,
    leading: 1.02,
    pad: 0.12,
    maxWeight: 800,
    scale: 1.06,
    width: { 600: 0.814, 700: 0.822, 800: 0.829, 900: 0.829 },
  },
  {
    id: 'manrope',
    label: 'Manrope',
    note: 'Moderno i čisto, blago zaobljeno.',
    family: 'manrope',
    stretch: '100%',
    tracking: -0.03,
    leading: 1.02,
    pad: 0.1,
    maxWeight: 800,
    scale: 1.08,
    width: { 600: 0.733, 700: 0.747, 800: 0.762, 900: 0.762 },
  },
  {
    id: 'dm-sans',
    label: 'DM Sans',
    note: 'Jednostavno i vrlo čitljivo.',
    family: 'dm-sans',
    stretch: '100%',
    tracking: -0.035,
    leading: 1,
    pad: 0.12,
    maxWeight: 900,
    scale: 1.08,
    width: { 600: 0.739, 700: 0.752, 800: 0.756, 900: 0.765 },
  },
];

export type BodyFontDef = { id: string; label: string; note: string; family: FontFamilyId };

export const BODY_FONTS: BodyFontDef[] = [
  { id: 'archivo', label: 'Archivo', note: 'Izvorni tekst stranice, isto pismo kao znak.', family: 'archivo' },
  { id: 'inter', label: 'Inter', note: 'Najčitljiviji za dulje tekstove na mobitelu.', family: 'inter' },
  { id: 'dm-sans', label: 'DM Sans', note: 'Jednostavan i prozračan.', family: 'dm-sans' },
  { id: 'manrope', label: 'Manrope', note: 'Moderan, blago zaobljen.', family: 'manrope' },
  { id: 'plus-jakarta-sans', label: 'Plus Jakarta Sans', note: 'Prijateljski, malo širi.', family: 'plus-jakarta-sans' },
  { id: 'ibm-plex-sans', label: 'IBM Plex Sans', note: 'Tehnički, u paru s mono oznakama i kotama.', family: 'ibm-plex-sans' },
];

export const DISPLAY_FONT_IDS = DISPLAY_FONTS.map((f) => f.id);
export const BODY_FONT_IDS = BODY_FONTS.map((f) => f.id);

/* ── postavka ────────────────────────────────────────────────────────────── */

export type DesignSettings = { fontDisplay: string; fontBody: string; displayWeight: DisplayWeight };

/** Izvorni izgled (prije ove mogućnosti). */
export const DEFAULT_DESIGN: DesignSettings = { fontDisplay: 'archivo-expanded', fontBody: 'archivo', displayWeight: 800 };

const isWeight = (w: unknown): w is DisplayWeight => (DISPLAY_WEIGHTS as readonly unknown[]).includes(w);

export const displayFont = (id: string): DisplayFontDef => DISPLAY_FONTS.find((f) => f.id === id) ?? DISPLAY_FONTS[0];
export const bodyFont = (id: string): BodyFontDef => BODY_FONTS.find((f) => f.id === id) ?? BODY_FONTS[0];

/** Debljina koja se stvarno koristi (pismo bez 900 → 800). */
export const effectiveWeight = (d: DisplayFontDef, w: DisplayWeight): DisplayWeight => (w > d.maxWeight ? d.maxWeight : w);

/** Spremljeno (može biti null/nepotpuno/zastarjelo) → uvijek valjan odabir; nepoznat id = izvorno, debljina ≤ najveće za pismo. */
export function resolveDesign(stored: unknown): DesignSettings {
  const s = (stored && typeof stored === 'object' ? stored : {}) as Partial<Record<keyof DesignSettings, unknown>>;
  const fontDisplay = typeof s.fontDisplay === 'string' && DISPLAY_FONT_IDS.includes(s.fontDisplay) ? s.fontDisplay : DEFAULT_DESIGN.fontDisplay;
  return {
    fontDisplay,
    fontBody: typeof s.fontBody === 'string' && BODY_FONT_IDS.includes(s.fontBody) ? s.fontBody : DEFAULT_DESIGN.fontBody,
    displayWeight: effectiveWeight(displayFont(fontDisplay), isWeight(s.displayWeight) ? s.displayWeight : DEFAULT_DESIGN.displayWeight),
  };
}

const num = (n: number, digits = 4) => String(+n.toFixed(digits));

export type ResolvedDesign = {
  design: DesignSettings;
  display: DisplayFontDef;
  body: BodyFontDef;
  weight: DisplayWeight;
  /** širina naslova u odnosu na izvorni izgled (1 = izvorno); za smanjivanje dugih naslova */
  widthFactor: number;
  /** obitelji koje stranica treba (naslovi, tekst, znak), bez ponavljanja */
  families: FontFamilyDef[];
  /** CSS varijable za :root (fontovi + tokeni naslova) */
  vars: Record<string, string>;
};

/** Sve što javna stranica treba za odabrani izgled. */
export function designFor(input: unknown): ResolvedDesign {
  const design = resolveDesign(input);
  const display = displayFont(design.fontDisplay);
  const body = bodyFont(design.fontBody);
  const weight = effectiveWeight(display, design.displayWeight);
  const ids = [...new Set<FontFamilyId>([display.family, body.family, BRAND_FAMILY])];
  const expanded = display.stretch === '125%';
  const vars: Record<string, string> = {
    '--font-sans': `var(${FONT_FAMILIES[body.family].cssVar})`,
    '--font-display': `var(${FONT_FAMILIES[display.family].cssVar})`,
    '--font-brand': `var(${FONT_FAMILIES[BRAND_FAMILY].cssVar})`,
    '--display-weight': String(weight),
    '--display-stretch': display.stretch,
    '--display-tracking': `${num(display.tracking)}em`,
    '--display-leading': num(display.leading),
    '--display-pad': `${num(display.pad)}em`,
    // naslovi sekcija: uža pisma malo veća (utility type-grow → zoom)
    '--display-scale': num(display.scale),
    // H1 naslovnice: malo gušće od ostalih naslova (izvorno -0,02em / 0,94)
    '--hx-tracking': `${num(display.tracking - 0.005)}em`,
    '--hx-leading': num(display.leading - 0.01),
    // podnaslovi u Archivu blago prošireni (106–118 %) samo uz široke naslove; inače normalna širina (utility sub-wide)
    '--sub-wide': expanded ? '1' : '0',
  };
  return {
    design,
    display,
    body,
    weight,
    widthFactor: display.width[weight],
    families: ids.map((id) => FONT_FAMILIES[id]),
    vars,
  };
}

/**
 * Veličina H1 naslovnice (množitelj, 1 = izvorno), isto u home/Hero.astro i u pregledu (admin → Izgled).
 * Dulji naslov iz admina se smanjuje (najdulji redak ≈ 20 znakova i ukupno ≈ 40 znakova pri punoj veličini).
 * Drugo pismo: veličina se dijeli širinom pisma, pa naslov zauzme otprilike istu širinu kao u izvornom izgledu —
 * šira pisma se smanje, uža povećaju (najviše do `scale` pisma). Izvorni izgled: isto kao prije (širina 1).
 */
export function heroTitleFit(lines: string[], look: Pick<ResolvedDesign, 'widthFactor' | 'display'>): number {
  const longest = Math.max(...lines.map((l) => l.length), 1);
  const total = lines.join(' ').length;
  const base = Math.min(1, Math.sqrt(20 / longest), Math.sqrt(40 / total));
  const cap = Math.max(1, look.display.scale);
  return +Math.max(0.55, Math.min(cap, base / look.widthFactor)).toFixed(2);
}

/**
 * Moto u podnožju ("Sedam puta mjerimo. / Jednom savijemo.") se ne lomi; za pisma šira od izvornog smanji se
 * (2 % rezerve), da na 360 px stane u stupac. Izvorno i uža pisma: 1.
 */
export const mottoScale = (widthFactor: number): number => (widthFactor > 1 ? +(0.98 / widthFactor).toFixed(3) : 1);

/** `{ '--a': 'x' }` → `--a:x;` */
export const cssVars = (vars: Record<string, string>) =>
  Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(';');
