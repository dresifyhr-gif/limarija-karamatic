/**
 * Četiri krova (metri). Svaki model: zidovi (crtež) → lim u trakama → opšavi, oluci,
 * crvena streha → kote + oznaka. Faze i slojevi: vidi engine.ts.
 */
import type { V3, FaceDef, LineDef, DimDef, ModelDef, Det } from './engine';

type P2 = [number, number];
const W = 0,
  G = 1,
  M = 2,
  LM = 3,
  X = 4,
  DK = 5,
  ST = 6;
const RED = 2;
const deg = Math.PI / 180;

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const nrm = (a: V3): V3 => mul(a, 1 / Math.hypot(a[0], a[1], a[2]));
const crs = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const mm = (n: number) =>
  Math.round(n * 1000)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/* ── 2D pomoćnici za plohu krova (u uzduž strehe, v uz pad) ─── */
function clipU(poly: P2[], u0: number, u1: number): P2[] {
  const half = (pts: P2[], k: number, s: number) => {
    const out: P2[] = [];
    for (let j = 0; j < pts.length; j++) {
      const a = pts[j],
        b = pts[(j + 1) % pts.length];
      const da = (a[0] - k) * s,
        db = (b[0] - k) * s;
      if (da >= 0) out.push(a);
      if (da * db < 0) {
        const t = da / (da - db);
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
    return out;
  };
  return half(half(poly, u0, 1), u1, -1);
}
/** presjek pravca (os 0: u = k → raspon v; os 1: v = k → raspon u) s konveksnim poligonom */
function span(poly: P2[], ax: 0 | 1, k: number): P2 | null {
  let lo = 1e9,
    hi = -1e9;
  const o = 1 - ax;
  for (let j = 0; j < poly.length; j++) {
    const a = poly[j],
      b = poly[(j + 1) % poly.length];
    if ((a[ax] - k) * (b[ax] - k) <= 0 && a[ax] !== b[ax]) {
      const t = (k - a[ax]) / (b[ax] - a[ax]);
      const x = a[o] + (b[o] - a[o]) * t;
      lo = Math.min(lo, x);
      hi = Math.max(hi, x);
    }
  }
  return hi > lo ? [lo, hi] : null;
}

interface Plane {
  O: V3;
  U: V3;
  V: V3;
  poly: P2[];
  /** širina trake */
  w: number;
  pat: 'tile' | 'seam' | 'panel' | 'trap';
  i0: number;
  i1: number;
}
/** lim u trakama (od strehe do sljemena) s uzorkom profila */
function sheets(o: Plane, out: FaceDef[]) {
  const { O, U, V, poly, w } = o;
  let N = nrm(crs(U, V));
  if (N[1] < 0) N = mul(N, -1);
  const at = (u: number, v: number, h = 0): V3 => add(add(O, add(mul(U, u), mul(V, v))), mul(N, h));
  const us = poly.map((p) => p[0]);
  const umin = Math.min(...us),
    umax = Math.max(...us);
  const vmax = Math.max(...poly.map((p) => p[1]));
  const n = Math.ceil((umax - umin) / w - 0.02);
  for (let k = 0; k < n; k++) {
    const u0 = umin + k * w,
      u1 = Math.min(umax, u0 + w);
    const cp = clipU(poly, u0, u1);
    if (cp.length < 3) continue;
    const d: Det[] = [];
    if (o.pat === 'tile') {
      // crijep-lim: redovi s valom (luk između valova) svakih 0,36 m
      const per = 0.3;
      for (let v = 0.36; v < vmax - 0.15; v += 0.36) {
        const s = span(cp, 1, v);
        if (!s) continue;
        const p: V3[] = [];
        for (let u = s[0]; u <= s[1] + 1e-6; u += per / 6) {
          const uu = Math.min(u, s[1]);
          p.push(at(uu, v - 0.075 * Math.abs(Math.sin((Math.PI * uu) / per)), 0.012));
        }
        d.push({ p, c: 0, a: 0.3, w: 0.8 });
      }
      // dolovi vala niz krov
      for (let u = Math.ceil(u0 / per) * per; u < u1 - 0.02; u += per) {
        const s = span(cp, 0, u);
        if (s) d.push({ p: [at(u, s[0], 0.01), at(u, s[1], 0.01)], c: 5, a: 0.4, w: 0.8 });
      }
    } else {
      // šavovi / rebra uzduž pada
      const ribs = o.pat === 'trap' ? [0.125, 0.375, 0.625, 0.875].map((r) => u0 + (u1 - u0) * r) : k ? [u0] : [];
      for (const u of ribs) {
        const s = span(cp, 0, u + 1e-4);
        if (!s) continue;
        if (o.pat === 'panel') d.push({ p: [at(u, s[0], 0.01), at(u, s[1], 0.01)], c: 0, a: 0.26, w: 0.8 });
        else {
          const hgt = o.pat === 'seam' ? 0.05 : 0.04;
          d.push({ p: [at(u + 0.04, s[0], 0.01), at(u + 0.04, s[1], 0.01)], c: 5, a: 0.55, w: 1 });
          d.push({ p: [at(u, s[0], hgt), at(u, s[1], hgt)], c: 4, a: o.pat === 'seam' ? 0.72 : 0.42, w: o.pat === 'seam' ? 1.1 : 0.9 });
        }
      }
    }
    out.push({
      p: cp.map(([u, v]) => at(u, v)),
      k: M,
      L: 3,
      ph: 2,
      i: o.i0 + ((o.i1 - o.i0) * k) / Math.max(1, n - 1),
      up: N,
      s: add(mul(V, 0.55), mul(N, 0.22)),
      d,
    });
  }
}

/** letve na skici krova (prije lima) — vodoravno uz strehu svakih 0,35 m; lim ih poslije prekrije */
function battens(o: Plane): Det[] {
  const { O, U, V, poly } = o;
  let N = nrm(crs(U, V));
  if (N[1] < 0) N = mul(N, -1);
  const at = (u: number, v: number): V3 => add(add(O, add(mul(U, u), mul(V, v))), mul(N, 0.006));
  const vmax = Math.max(...poly.map((p) => p[1]));
  const d: Det[] = [];
  for (let v = 0.3; v < vmax - 0.05; v += 0.35) {
    const s = span(poly, 1, v);
    if (s) d.push({ p: [at(s[0], v), at(s[1], v)], c: 0, a: 0.2, w: 0.8, ph: 0, i: 0.86 + (0.14 * v) / vmax });
  }
  return d;
}

/** kvadar (bez zadanih strana: f b l r t d) */
function box(a: V3, b: V3, k: number, L: number, ph: number, i = 0, skip = '', d?: Partial<Record<string, Det[]>>): FaceDef[] {
  const [x0, y0, z0] = a,
    [x1, y1, z1] = b;
  const o: V3 = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
  const S: Record<string, V3[]> = {
    f: [
      [x0, y0, z1],
      [x1, y0, z1],
      [x1, y1, z1],
      [x0, y1, z1],
    ],
    b: [
      [x1, y0, z0],
      [x0, y0, z0],
      [x0, y1, z0],
      [x1, y1, z0],
    ],
    l: [
      [x0, y0, z0],
      [x0, y0, z1],
      [x0, y1, z1],
      [x0, y1, z0],
    ],
    r: [
      [x1, y0, z1],
      [x1, y0, z0],
      [x1, y1, z0],
      [x1, y1, z1],
    ],
    t: [
      [x0, y1, z1],
      [x1, y1, z1],
      [x1, y1, z0],
      [x0, y1, z0],
    ],
    d: [
      [x0, y0, z0],
      [x1, y0, z0],
      [x1, y0, z1],
      [x0, y0, z1],
    ],
  };
  return Object.keys(S)
    .filter((s) => !skip.includes(s))
    .map((s) => ({ p: S[s], k, L, ph, i, o, d: d?.[s] }));
}

/** cijev kvadratnog presjeka po točkama (vertikala oluka) */
function pipe(path: V3[], r: number, L: number, ph: number, i: number, out: FaceDef[], v?: V3[]) {
  for (let j = 1; j < path.length; j++) {
    const a = path[j - 1],
      b = path[j];
    const dv = nrm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
    const ref: V3 = Math.abs(dv[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1];
    const e1 = mul(nrm(crs(dv, ref)), r),
      e2 = mul(nrm(crs(dv, e1)), r);
    const A = add(a, mul(dv, -r * 0.6)),
      B = add(b, mul(dv, r * 0.6));
    const c = (p: V3, s1: number, s2: number) => add(p, add(mul(e1, s1), mul(e2, s2)));
    const sides: [number, number, number, number][] = [
      [1, 1, 1, -1],
      [1, -1, -1, -1],
      [-1, -1, -1, 1],
      [-1, 1, 1, 1],
    ];
    const o: V3 = mul(add(a, b), 0.5);
    for (const [p, q, s, t] of sides) out.push({ p: [c(A, p, q), c(B, p, q), c(B, s, t), c(A, s, t)], k: LM, L, ph, i, o, v });
  }
}

/** prozor na zidu: okvir, prečka, klupčica + staklo */
function win(P: (a: number, b: number) => V3, nOut: V3, a: number, b: number, w: number, h: number, i: number, cols = 2, rows = 1): { d: Det[]; g: FaceDef } {
  const d: Det[] = [];
  const ph = 0;
  d.push({ p: [P(a, b), P(a + w, b), P(a + w, b + h), P(a, b + h)], c: 0, a: 0.62, z: true, ph, i });
  for (let c = 1; c < cols; c++) d.push({ p: [P(a + (w * c) / cols, b), P(a + (w * c) / cols, b + h)], c: 0, a: 0.42, ph, i });
  for (let r = 1; r < rows; r++) d.push({ p: [P(a, b + (h * r) / rows), P(a + w, b + (h * r) / rows)], c: 0, a: 0.42, ph, i });
  d.push({ p: [P(a - 0.08, b - 0.06), P(a + w + 0.08, b - 0.06)], c: 0, a: 0.5, ph, i });
  const g: FaceDef = {
    p: [P(a, b), P(a + w, b), P(a + w, b + h), P(a, b + h)],
    k: X,
    L: 1,
    ph: 1,
    i,
    up: nOut,
    b: 0.4,
    e: false,
    // odraz neba na staklu
    d: [
      { p: [P(a + w * 0.15, b + h * 0.08), P(a + w * 0.55, b + h * 0.92)], c: 6, a: 0.07, w: 1 },
      { p: [P(a + w * 0.42, b + h * 0.08), P(a + w * 0.82, b + h * 0.92)], c: 6, a: 0.045, w: 1 },
    ],
  };
  return { d, g };
}

const tagName = (n: number, s: string) => `0${n} / 04 · ${s}`;

/** kut nagiba: luk u vertikalnoj ravnini (c = vrh kuta, h = vodoravni smjer, v = gore) + natpis */
function arc(c: V3, h: V3, ang: number, r: number, lines: LineDef[]): V3 {
  const p: V3[] = [];
  const P = (a: number, rr: number): V3 => add(c, add(mul(h, rr * Math.cos(a)), [0, rr * Math.sin(a), 0]));
  for (let k = 0; k <= 12; k++) p.push(P((ang * k) / 12, r));
  lines.push({ p: [c, P(0, r * 1.2)], c: 3, L: 6, ph: 4, i: 0.3, a: 0.5, w: 0.8, an: true });
  lines.push({ p: [c, P(ang, r * 1.2)], c: 3, L: 6, ph: 4, i: 0.3, a: 0.5, w: 0.8, an: true });
  lines.push({ p, c: 3, L: 6, ph: 4, i: 0.4, a: 0.9, an: true });
  return P(ang / 2, r + 0.6);
}

/* ══ 01 · DVOSTREŠNI KROV · CRIJEP-LIM ═══════════════════════ */
function m1(): ModelDef {
  const faces: FaceDef[] = [],
    lines: LineDef[] = [];
  const L = 11,
    D = 8,
    H = 5.4,
    tn = Math.tan(35 * deg);
  const hx = L / 2,
    hz = D / 2;
  const Hr = H + hz * tn;
  const e = 0.6,
    g = 0.42;
  const ex = hx + g,
    ez = hz + e,
    He = H - e * tn;
  const ctr: V3 = [0, H / 2, 0];

  // zidovi s prozorima
  const front = (a: number, b: number): V3 => [a, b, hz];
  const left = (a: number, b: number): V3 => [-hx, b, a];
  const fw: Det[] = [],
    lw: Det[] = [];
  const glass = (r: { d: Det[]; g: FaceDef }, into: Det[]) => {
    into.push(...r.d);
    faces.push(r.g);
  };
  glass(win(front, [0, 0, 1], -4.1, 1.0, 1.5, 1.45, 0.82), fw);
  glass(win(front, [0, 0, 1], -0.55, 0, 1.1, 2.25, 0.84, 1), fw);
  glass(win(front, [0, 0, 1], 2.4, 1.0, 1.9, 1.45, 0.86, 3), fw);
  glass(win(front, [0, 0, 1], -4.0, 3.55, 1.3, 1.25, 0.9), fw);
  glass(win(front, [0, 0, 1], -0.65, 3.55, 1.3, 1.25, 0.92), fw);
  glass(win(front, [0, 0, 1], 2.6, 3.55, 1.5, 1.25, 0.94), fw);
  glass(win(left, [-1, 0, 0], 1.0, 1.0, 1.4, 1.45, 0.84), lw);
  glass(win(left, [-1, 0, 0], -2.4, 1.0, 1.4, 1.45, 0.86), lw);
  glass(win(left, [-1, 0, 0], -0.6, 3.55, 1.2, 1.25, 0.9), lw);
  glass(win(left, [-1, 0, 0], -0.4, 6.15, 0.8, 0.8, 0.95), lw);
  // sokl
  fw.push({ p: [front(-hx, 0.45), front(hx, 0.45)], c: 0, a: 0.28, ph: 0, i: 0.3 });
  lw.push({ p: [left(hz, 0.45), left(-hz, 0.45)], c: 0, a: 0.28, ph: 0, i: 0.3 });

  faces.push(
    { p: [[-hx, 0, hz], [hx, 0, hz], [hx, H, hz], [-hx, H, hz]], k: W, L: 1, ph: 0, o: ctr, d: fw },
    { p: [[hx, 0, -hz], [-hx, 0, -hz], [-hx, H, -hz], [hx, H, -hz]], k: W, L: 1, ph: 0, o: ctr },
    { p: [[-hx, 0, -hz], [-hx, 0, hz], [-hx, H, hz], [-hx, Hr, 0], [-hx, H, -hz]], k: W, L: 1, ph: 0, o: ctr, d: lw },
    { p: [[hx, 0, hz], [hx, 0, -hz], [hx, H, -hz], [hx, Hr, 0], [hx, H, hz]], k: W, L: 1, ph: 0, o: ctr },
  );
  // skica krovnih ploha (s letvama) + lim (crijep-lim)
  const up: V3 = [0, 1, 0];
  const sl = Math.hypot(Hr - He, ez);
  const poly: P2[] = [
    [0, 0],
    [2 * ex, 0],
    [2 * ex, sl],
    [0, sl],
  ];
  const pf: Plane = { O: [-ex, He, ez], U: [1, 0, 0], V: nrm([0, Hr - He, -ez]), poly, w: (2 * ex) / 10, pat: 'tile', i0: 0, i1: 0.62 };
  const pb: Plane = { O: [ex, He, -ez], U: [-1, 0, 0], V: nrm([0, Hr - He, ez]), poly, w: (2 * ex) / 10, pat: 'tile', i0: 0.38, i1: 1 };
  faces.push(
    { p: [[-ex, He, ez], [ex, He, ez], [ex, Hr, 0], [-ex, Hr, 0]], k: G, L: 2, ph: 0, up, d: battens(pf) },
    { p: [[ex, He, -ez], [-ex, He, -ez], [-ex, Hr, 0], [ex, Hr, 0]], k: G, L: 2, ph: 0, up, d: battens(pb) },
  );
  sheets(pf, faces);
  sheets(pb, faces);

  // čeone daske / opšav (crvena linija strehe i zabata)
  const th = 0.2;
  const fas = (p: V3[], o: V3, i: number) => faces.push({ p, k: LM, L: 3, ph: 3, i, o, d: [{ p: [p[0], p[1]], c: RED, w: 2.2, a: 1, ph: 3, i }] });
  fas([[-ex, He, ez], [ex, He, ez], [ex, He - th, ez], [-ex, He - th, ez]], [0, He, 0], 0.1);
  fas([[ex, He, -ez], [-ex, He, -ez], [-ex, He - th, -ez], [ex, He - th, -ez]], [0, He, 0], 0.1);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) fas([[sx * ex, He, sz * ez], [sx * ex, Hr, 0], [sx * ex, Hr - th, 0], [sx * ex, He - th, sz * ez]], [0, He, 0], 0.3);
  // sljemenjak
  lines.push({ p: [[-ex, Hr + 0.05, 0], [ex, Hr + 0.05, 0]], c: 4, L: 4, ph: 3, i: 0.45, w: 2, a: 0.9 });

  // oluci (prednji i stražnji) + vertikale
  for (const sz of [1, -1]) {
    const z0 = sz > 0 ? ez : -ez - 0.2,
      z1 = sz > 0 ? ez + 0.2 : -ez;
    // stražnji oluk vidi se samo kad je stražnji zid okrenut kameri (inače bi se nacrtao preko zabata)
    const v: V3[] | undefined = sz < 0 ? [[0, 0, -1]] : undefined;
    faces.push(...box([-ex, He - th - 0.17, z0], [ex, He - th, z1], LM, 3, 3, 0.2, sz > 0 ? 'bt' : 'ft').map((f) => ({ ...f, v })));
    faces.push({
      p: [[-ex, He - th, z0], [ex, He - th, z0], [ex, He - th, z1], [-ex, He - th, z1]],
      k: DK,
      L: 3,
      ph: 3,
      i: 0.2,
      up,
      v,
    });
  }
  for (const [x, sz] of [
    [-hx + 0.35, 1],
    [hx - 0.35, 1],
    [-hx + 0.35, -1],
  ])
    pipe(
      [
        [x, He - th - 0.17, sz * (ez + 0.1)],
        [x, He - th - 0.5, sz * (ez + 0.1)],
        [x, He - th - 0.95, sz * (hz + 0.1)],
        [x, 0.35, sz * (hz + 0.1)],
        [x, 0.08, sz * (hz + 0.32)],
      ],
      0.055,
      1,
      3,
      0.35,
      faces,
      sz < 0 ? [[0, 0, -1]] : undefined,
    );

  // dimnjak na prednjoj plohi (dno prati nagib)
  const yAt = (z: number) => Hr - z * tn;
  const cx0 = 2.3,
    cx1 = 3.05,
    cz0 = 0.55,
    cz1 = 1.3,
    yt = Hr + 0.95;
  const cO: V3 = [(cx0 + cx1) / 2, yt - 0.5, (cz0 + cz1) / 2];
  const ch: FaceDef[] = [
    { p: [[cx0, yAt(cz1), cz1], [cx1, yAt(cz1), cz1], [cx1, yt, cz1], [cx0, yt, cz1]], k: M, L: 4, ph: 3, i: 0.3, o: cO, e: true },
    { p: [[cx1, yAt(cz0), cz0], [cx0, yAt(cz0), cz0], [cx0, yt, cz0], [cx1, yt, cz0]], k: M, L: 4, ph: 3, i: 0.3, o: cO, e: true },
    { p: [[cx0, yAt(cz0), cz0], [cx0, yAt(cz1), cz1], [cx0, yt, cz1], [cx0, yt, cz0]], k: M, L: 4, ph: 3, i: 0.3, o: cO, e: true },
    { p: [[cx1, yAt(cz1), cz1], [cx1, yAt(cz0), cz0], [cx1, yt, cz0], [cx1, yt, cz1]], k: M, L: 4, ph: 3, i: 0.3, o: cO, e: true },
    { p: [[cx0, yt, cz1], [cx1, yt, cz1], [cx1, yt, cz0], [cx0, yt, cz0]], k: DK, L: 4, ph: 3, i: 0.3, o: cO, e: true },
  ];
  // opšav dimnjaka (traka uz krov)
  ch[0].d = [{ p: [[cx0, yAt(cz1) + 0.22, cz1], [cx1, yAt(cz1) + 0.22, cz1]], c: 4, a: 0.6, w: 1 }];
  ch[2].d = [{ p: [[cx0, yAt(cz0) + 0.22, cz0], [cx0, yAt(cz1) + 0.22, cz1]], c: 4, a: 0.6, w: 1 }];
  ch[3].d = [{ p: [[cx1, yAt(cz1) + 0.22, cz1], [cx1, yAt(cz0) + 0.22, cz0]], c: 4, a: 0.6, w: 1 }];
  faces.push(...ch);
  // kapa dimnjaka na nožicama
  faces.push(...box([cx0 - 0.12, yt + 0.24, cz0 - 0.12], [cx1 + 0.12, yt + 0.32, cz1 + 0.12], LM, 4, 3, 0.5).map((f) => ({ ...f, b: -0.5 })));
  for (const [x, z] of [
    [cx0 + 0.04, cz1 - 0.04],
    [cx1 - 0.04, cz1 - 0.04],
    [cx0 + 0.04, cz0 + 0.04],
    [cx1 - 0.04, cz0 + 0.04],
  ])
    lines.push({ p: [[x, yt, z], [x, yt + 0.24, z]], c: 4, L: 4, ph: 3, i: 0.45, a: 0.7 });

  // snjegobrani: dvije cijevi + nosači na svakom spoju traka
  const V = nrm([0, Hr - He, -ez]),
    N = nrm(crs([1, 0, 0], V));
  const P = (u: number, v: number, h: number): V3 => add(add([-ex + u, He, ez], mul(V, v)), mul(N, h));
  for (const h of [0.13, 0.22]) lines.push({ p: [P(0.25, 0.95, h), P(2 * ex - 0.25, 0.95, h)], c: 4, L: 4, ph: 3, i: 0.55, w: 1.2, a: 0.85 });
  for (let k = 1; k < 10; k++) {
    const u = (2 * ex * k) / 10;
    lines.push({ p: [P(u, 0.82, 0.02), P(u, 0.95, 0.26)], c: 4, L: 4, ph: 3, i: 0.6, a: 0.7 });
  }

  // tlo: tlocrtna crta oko kuće
  lines.push({ p: [[-hx - 1.2, 0, hz + 1.2], [hx + 1.2, 0, hz + 1.2]], c: 0, L: 0, ph: 0, i: 0, a: 0.14 });

  const dims: DimDef[] = [
    { a: [-hx, 0, hz], b: [hx, 0, hz], o: [0, 0, 1.6], t: mm(L) },
    // visina sljemena uz stražnji lijevi ugao (obris), pomoćna linija od vrha zabata
    { a: [-hx, 0, -hz], b: [-hx, Hr, -hz], x: [-hx, Hr, 0], o: [-1.7, 0, -0.5], t: mm(Math.round(Hr * 100) / 100) },
  ];
  const at1 = arc([-ex - 0.02, He, ez], [0, 0, -1], 35 * deg, 1.5, lines);
  return {
    name: tagName(1, 'DVOSTREŠNI KROV · CRIJEP-LIM'),
    pitch: 17 * deg,
    faces,
    lines,
    dims,
    tag: [cx0 + 0.35, yt + 0.32, (cz0 + cz1) / 2],
    tags: [{ p: at1, t: "35°", c: 3 }],
  };
}

/* ══ 02 · ČETVEROSTREŠNI KROV · OLUCI ════════════════════════ */
function m2(): ModelDef {
  const faces: FaceDef[] = [],
    lines: LineDef[] = [];
  const L = 11,
    D = 9,
    H = 3.5,
    tn = Math.tan(31 * deg);
  const hx = L / 2,
    hz = D / 2,
    e = 0.55;
  const ex = hx + e,
    ez = hz + e,
    He = H - e * tn;
  const Hr = He + ez * tn,
    rx = ex - ez;
  const ctr: V3 = [0, H / 2, 0];
  const front = (a: number, b: number): V3 => [a, b, hz];
  const left = (a: number, b: number): V3 => [-hx, b, a];
  const fw: Det[] = [],
    lw: Det[] = [];
  const glass = (r: { d: Det[]; g: FaceDef }, into: Det[]) => {
    into.push(...r.d);
    faces.push(r.g);
  };
  glass(win(front, [0, 0, 1], -4.3, 0.95, 1.5, 1.4, 0.8), fw);
  glass(win(front, [0, 0, 1], -1.9, 0.95, 1.5, 1.4, 0.83), fw);
  glass(win(front, [0, 0, 1], 0.6, 0, 1.1, 2.2, 0.86, 1), fw);
  glass(win(front, [0, 0, 1], 2.6, 0.5, 2.2, 1.85, 0.9, 3), fw);
  glass(win(left, [-1, 0, 0], 1.6, 0.95, 1.4, 1.4, 0.86), lw);
  glass(win(left, [-1, 0, 0], -2.6, 0.95, 1.4, 1.4, 0.9), lw);
  fw.push({ p: [front(-hx, 0.4), front(hx, 0.4)], c: 0, a: 0.28, ph: 0, i: 0.3 });
  lw.push({ p: [left(hz, 0.4), left(-hz, 0.4)], c: 0, a: 0.28, ph: 0, i: 0.3 });
  faces.push(...box([-hx, 0, -hz], [hx, H, hz], W, 1, 0, 0, 'td', { f: fw, l: lw }).map((f) => ({ ...f, o: ctr })));

  const up: V3 = [0, 1, 0];
  const c00: V3 = [-ex, He, ez],
    c10: V3 = [ex, He, ez],
    c11: V3 = [ex, He, -ez],
    c01: V3 = [-ex, He, -ez];
  const r0: V3 = [-rx, Hr, 0],
    r1: V3 = [rx, Hr, 0];
  const sl = Math.hypot(Hr - He, ez);
  const trap: P2[] = [
    [0, 0],
    [2 * ex, 0],
    [ex + rx, sl],
    [ex - rx, sl],
  ];
  const tri: P2[] = [
    [0, 0],
    [2 * ez, 0],
    [ez, sl],
  ];
  const w = 0.92;
  const pl: Plane[] = [
    { O: c00, U: [1, 0, 0], V: nrm([0, Hr - He, -ez]), poly: trap, w, pat: 'panel', i0: 0, i1: 0.45 },
    { O: c11, U: [-1, 0, 0], V: nrm([0, Hr - He, ez]), poly: trap, w, pat: 'panel', i0: 0.62, i1: 1 },
    { O: c01, U: [0, 0, 1], V: nrm([ez, Hr - He, 0]), poly: tri, w, pat: 'panel', i0: 0.42, i1: 0.7 },
    { O: c10, U: [0, 0, -1], V: nrm([-ez, Hr - He, 0]), poly: tri, w, pat: 'panel', i0: 0.7, i1: 1 },
  ];
  faces.push(
    { p: [c00, c10, r1, r0], k: G, L: 2, ph: 0, up, d: battens(pl[0]) },
    { p: [c11, c01, r0, r1], k: G, L: 2, ph: 0, up, d: battens(pl[1]) },
    { p: [c01, c00, r0], k: G, L: 2, ph: 0, up, d: battens(pl[2]) },
    { p: [c10, c11, r1], k: G, L: 2, ph: 0, up, d: battens(pl[3]) },
  );
  pl.forEach((q) => sheets(q, faces));

  // opšav strehe s crvenom linijom
  const th = 0.18;
  const ring: V3[] = [c00, c10, c11, c01];
  for (let j = 0; j < 4; j++) {
    const a = ring[j],
      b = ring[(j + 1) % 4];
    faces.push({
      p: [a, b, [b[0], b[1] - th, b[2]], [a[0], a[1] - th, a[2]]],
      k: LM,
      L: 3,
      ph: 3,
      i: 0.1,
      o: [0, He, 0],
      d: [{ p: [a, b], c: RED, w: 2.2, a: 1, ph: 3, i: 0.1 }],
    });
  }
  // grebeni i sljeme (crtaju se samo kad je bar jedna susjedna ploha vidljiva)
  ([
    [c00, r0],
    [c10, r1],
    [c11, r1],
    [c01, r0],
    [r0, r1],
  ] as [V3, V3][]).forEach(([a, b], k) => {
    const sn = Math.sin(31 * deg), cs = Math.cos(31 * deg);
    const F: V3 = [0, cs, sn], B: V3 = [0, cs, -sn], Lf: V3 = [-sn, cs, 0], R: V3 = [sn, cs, 0];
    const n = [[F, Lf], [F, R], [B, R], [B, Lf], [F, B]][k];
    lines.push({ p: [[a[0], a[1] + 0.04, a[2]], [b[0], b[1] + 0.05, b[2]]], c: 4, L: 4, ph: 3, i: 0.4, w: 1.8, a: 0.85, n });
  });

  // oluci na sve četiri strehe
  const gy0 = He - th - 0.18,
    gy1 = He - th,
    gw = 0.2;
  // stražnji i desni oluk crtaju se samo kad je njihov zid okrenut kameri
  const gut = (a: V3, b: V3, s: string, v?: V3[]) => {
    faces.push(...box(a, b, LM, 3, 3, 0.25, s).map((f) => ({ ...f, v })));
    faces.push({ p: [[a[0], gy1, a[2]], [b[0], gy1, a[2]], [b[0], gy1, b[2]], [a[0], gy1, b[2]]], k: DK, L: 3, ph: 3, i: 0.25, up, v });
  };
  gut([-ex - gw, gy0, ez], [ex + gw, gy1, ez + gw], 'bt');
  gut([-ex - gw, gy0, -ez - gw], [ex + gw, gy1, -ez], 'ft', [[0, 0, -1]]);
  gut([-ex - gw, gy0, -ez], [-ex, gy1, ez], 'rt');
  gut([ex, gy0, -ez], [ex + gw, gy1, ez], 'lt', [[1, 0, 0]]);
  // vertikale na uglovima
  for (const [sx, sz] of [
    [-1, 1],
    [1, 1],
    [-1, -1],
    [1, -1],
  ])
    pipe(
      [
        [sx * (ex + 0.1), gy0, sz * (hz - 0.35)],
        [sx * (ex + 0.1), gy0 - 0.3, sz * (hz - 0.35)],
        [sx * (hx + 0.1), gy0 - 0.75, sz * (hz - 0.35)],
        [sx * (hx + 0.1), 0.35, sz * (hz - 0.35)],
        [sx * (hx + 0.3), 0.08, sz * (hz - 0.35)],
      ],
      0.055,
      1,
      3,
      0.35,
      faces,
      sx > 0 ? [[1, 0, 0]] : undefined,
    );
  lines.push({ p: [[-hx - 1.2, 0, hz + 1.2], [hx + 1.2, 0, hz + 1.2]], c: 0, L: 0, ph: 0, a: 0.14 });

  return {
    name: tagName(2, 'ČETVEROSTREŠNI KROV · OLUCI'),
    pitch: 19 * deg,
    faces,
    lines,
    dims: [
      { a: [-hx, 0, hz], b: [hx, 0, hz], o: [0, 0, 1.7], t: mm(L) },
      { a: [-hx, 0, -hz], b: [-hx, 0, hz], o: [-1.6, 0, 0], t: mm(D) },
      { a: [hx, 0, hz], b: [hx, H, hz], o: [1.5, 0, 0.7], t: mm(H) },
    ],
    tag: [-rx * 0.4, Hr + 0.05, 0],
  };
}

/* ══ 03 · FALCANI KROV · MODERNA KUĆA ════════════════════════ */
function m3(): ModelDef {
  const faces: FaceDef[] = [],
    lines: LineDef[] = [];
  const L = 12,
    D = 8.4,
    Hb = 6.7,
    Hf = 4.3;
  const hx = L / 2,
    hz = D / 2;
  const sl = (Hb - Hf) / D;
  const yAt = (z: number) => Hf + (hz - z) * sl;
  const g = 0.3;
  const ex = hx + g,
    ezf = hz + 0.4,
    ezb = hz + 0.3;
  const yF = yAt(ezf),
    yB = yAt(-ezb);
  const ctr: V3 = [0, 2, 0];
  const front = (a: number, b: number): V3 => [a, b, hz];
  const left = (a: number, b: number): V3 => [-hx, b, a];
  const fw: Det[] = [],
    lw: Det[] = [];
  const glass = (r: { d: Det[]; g: FaceDef }, into: Det[]) => {
    into.push(...r.d);
    faces.push(r.g);
  };
  // velika staklena stijena + ulaz
  glass(win(front, [0, 0, 1], -5.0, 0.25, 5.6, 3.35, 0.82, 4), fw);
  glass(win(front, [0, 0, 1], 1.6, 0, 1.15, 2.45, 0.86, 1), fw);
  glass(win(front, [0, 0, 1], 3.6, 1.2, 1.7, 1.2, 0.9, 1), fw);
  // ugaoni prozor i visoka traka na zabatu
  glass(win(left, [-1, 0, 0], 0.9, 0.25, 2.6, 3.35, 0.84, 2), lw);
  // okomita obloga (letvice) na stražnjem dijelu zabata
  for (let z = -hz + 0.18; z < 0.5; z += 0.2) lw.push({ p: [left(z, 0.25), left(z, yAt(z) - 0.02)], c: 0, a: 0.16, w: 0.8, ph: 0, i: 0.95 });
  fw.push({ p: [front(-hx, 0.22), front(hx, 0.22)], c: 0, a: 0.22, ph: 0, i: 0.3 });
  faces.push(
    { p: [[-hx, 0, hz], [hx, 0, hz], [hx, Hf, hz], [-hx, Hf, hz]], k: W, L: 1, ph: 0, o: ctr, d: fw },
    { p: [[hx, 0, -hz], [-hx, 0, -hz], [-hx, Hb, -hz], [hx, Hb, -hz]], k: W, L: 1, ph: 0, o: ctr },
    { p: [[-hx, 0, -hz], [-hx, 0, hz], [-hx, Hf, hz], [-hx, Hb, -hz]], k: W, L: 1, ph: 0, o: ctr, d: lw },
    { p: [[hx, 0, hz], [hx, 0, -hz], [hx, Hb, -hz], [hx, Hf, hz]], k: W, L: 1, ph: 0, o: ctr },
  );
  const up: V3 = [0, 1, 0];
  const a0: V3 = [-ex, yF, ezf],
    a1: V3 = [ex, yF, ezf],
    b1: V3 = [ex, yB, -ezb],
    b0: V3 = [-ex, yB, -ezb];
  const len = Math.hypot(yB - yF, ezf + ezb);
  const p3: Plane = {
    O: a0,
    U: [1, 0, 0],
    V: nrm([0, yB - yF, -(ezf + ezb)]),
    poly: [
      [0, 0],
      [2 * ex, 0],
      [2 * ex, len],
      [0, len],
    ],
    w: (2 * ex) / 22,
    pat: 'seam',
    i0: 0,
    i1: 1,
  };
  faces.push({ p: [a0, a1, b1, b0], k: G, L: 2, ph: 0, up, d: battens(p3) });
  sheets(p3, faces);
  // debeli opšav ruba (moderni "nož") — crvena linija uz prednju strehu i bočne rubove
  const th = 0.34;
  const ring: V3[] = [a0, a1, b1, b0];
  for (let j = 0; j < 4; j++) {
    const a = ring[j],
      b = ring[(j + 1) % 4];
    faces.push({
      p: [a, b, [b[0], b[1] - th, b[2]], [a[0], a[1] - th, a[2]]],
      k: LM,
      L: 3,
      ph: 3,
      i: 0.1,
      o: [0, 4, 0],
      d: [{ p: [a, b], c: RED, w: 2.2, a: 1, ph: 3, i: 0.1 }],
    });
  }
  // skriveni oluk + jedna vertikala
  pipe(
    [
      [hx - 0.4, yF - th, hz + 0.2],
      [hx - 0.4, yF - th - 0.35, hz + 0.08],
      [hx - 0.4, 0.3, hz + 0.08],
      [hx - 0.4, 0.06, hz + 0.28],
    ],
    0.055,
    1,
    3,
    0.3,
    faces,
  );
  // niže krilo (garaža) s ravnim krovom i debelim opšavom
  const wx0 = hx,
    wx1 = hx + 4.4,
    wz0 = -1.2,
    wz1 = hz,
    wh = 3.1,
    wt = 3.42;
  const gd: Det[] = [];
  const gP = (a: number, b: number): V3 => [a, b, wz1 + 0.01];
  gd.push({ p: [gP(wx0 + 0.7, 0), gP(wx0 + 0.7, 2.35), gP(wx1 - 0.7, 2.35), gP(wx1 - 0.7, 0)], c: 0, a: 0.6, ph: 0, i: 0.9 });
  for (let k = 1; k < 5; k++) gd.push({ p: [gP(wx0 + 0.7, (2.35 * k) / 5), gP(wx1 - 0.7, (2.35 * k) / 5)], c: 0, a: 0.28, ph: 0, i: 0.92 });
  const wo: V3 = [(wx0 + wx1) / 2, 1.5, (wz0 + wz1) / 2];
  faces.push(...box([wx0, 0, wz0], [wx1, wh, wz1], W, 1, 0, 0, 'ltd', { f: gd }).map((f) => ({ ...f, o: wo })));
  const wc = 0.22;
  faces.push(
    // opšav garaže je lim (sloj 3) — skrivene crtkane linije ne smiju preko njega
    ...box([wx0, wh, wz0 - wc], [wx1 + wc, wt, wz1 + wc], LM, 3, 3, 0.2, 'ld', {
      f: [{ p: [[wx0, wt, wz1 + wc], [wx1 + wc, wt, wz1 + wc]], c: RED, w: 2.2, a: 1, ph: 3, i: 0.2 }],
      r: [{ p: [[wx1 + wc, wt, wz1 + wc], [wx1 + wc, wt, wz0 - wc]], c: RED, w: 2.2, a: 1, ph: 3, i: 0.2 }],
    }).map((f) => ({ ...f, o: [wo[0], wh, wo[2]] as V3 })),
  );
  // nagib na stražnjem (višem) desnom uglu krova — u zraku iznad krova, ne u kutu ispod strehe
  const at3 = arc([ex + 0.02, yB, -ezb], [0, 0, -1], Math.atan(sl), 2.2, lines);
  lines.push({ p: [[-hx - 1.2, 0, hz + 1.2], [hx + 1.2, 0, hz + 1.2]], c: 0, L: 0, ph: 0, a: 0.14 });
  return {
    name: tagName(3, 'FALCANI KROV · MODERNA KUĆA'),
    pitch: 21 * deg,
    faces,
    lines,
    dims: [
      { a: [-hx, 0, hz], b: [hx, 0, hz], o: [0, 0, 1.6], t: mm(L) },
      { a: [-hx, 0, -hz], b: [-hx, Hb, -hz], o: [-1.5, 0, -0.3], t: mm(Hb) },
    ],
    tag: [-ex * 0.35, yB - 0.4, -ezb + 1.2],
    tags: [{ p: at3, t: `${Math.round(Math.atan(sl) / deg)}°`, c: 3 }],
  };
}

/* ══ 04 · RAVNI KROV · OPŠAV ATIKE ═══════════════════════════ */
function m4(): ModelDef {
  const faces: FaceDef[] = [],
    lines: LineDef[] = [];
  const L = 13,
    D = 9,
    H = 3.6,
    Ht = 4.25,
    tp = 0.32;
  const hx = L / 2,
    hz = D / 2;
  const ctr: V3 = [0, 2, 0];
  const front = (a: number, b: number): V3 => [a, b, hz];
  const left = (a: number, b: number): V3 => [-hx, b, a];
  const fw: Det[] = [],
    lw: Det[] = [];
  const glass = (r: { d: Det[]; g: FaceDef }, into: Det[]) => {
    into.push(...r.d);
    faces.push(r.g);
  };
  // trakasti prozor + ulaz
  glass(win(front, [0, 0, 1], -5.6, 1.05, 7.2, 1.45, 0.82, 6), fw);
  glass(win(front, [0, 0, 1], 2.6, 0, 1.6, 2.5, 0.86, 2), fw);
  glass(win(front, [0, 0, 1], 5.0, 1.05, 0.9, 1.45, 0.88, 1), fw);
  glass(win(left, [-1, 0, 0], 0.5, 1.05, 3.2, 1.45, 0.86, 2), lw);
  glass(win(left, [-1, 0, 0], -3.6, 1.05, 1.4, 1.45, 0.9, 1), lw);
  fw.push({ p: [front(-hx, H), front(hx, H)], c: 0, a: 0.22, ph: 0, i: 0.5 });
  lw.push({ p: [left(hz, H), left(-hz, H)], c: 0, a: 0.22, ph: 0, i: 0.5 });
  faces.push(...box([-hx, 0, -hz], [hx, Ht, hz], W, 1, 0, 0, 'td', { f: fw, l: lw }).map((f) => ({ ...f, o: ctr })));
  // ploča krova i unutarnje strane atike
  const ix = hx - tp,
    iz = hz - tp;
  const up: V3 = [0, 1, 0];

  const inner: [V3[], V3][] = [
    [[[-ix, H, iz], [ix, H, iz], [ix, Ht, iz], [-ix, Ht, iz]], [0, 0, -1]],
    [[[ix, H, -iz], [-ix, H, -iz], [-ix, Ht, -iz], [ix, Ht, -iz]], [0, 0, 1]],
    [[[-ix, H, -iz], [-ix, H, iz], [-ix, Ht, iz], [-ix, Ht, -iz]], [1, 0, 0]],
    [[[ix, H, iz], [ix, H, -iz], [ix, Ht, -iz], [ix, Ht, iz]], [-1, 0, 0]],
  ];
  for (const [p, n] of inner) faces.push({ p, k: W, L: 4, ph: 0, up: n });
  // trapezni lim u trakama (uzduž kuće), ispod podrožnice
  const p4: Plane = {
    O: [-ix, H + 0.02, iz],
    U: [0, 0, -1],
    V: [1, 0, 0],
    poly: [
      [0, 0],
      [2 * iz, 0],
      [2 * iz, 2 * ix],
      [0, 2 * ix],
    ],
    w: (2 * iz) / 8,
    pat: 'trap',
    i0: 0,
    i1: 1,
  };
  faces.push({ p: [[-ix, H, iz], [ix, H, iz], [ix, H, -iz], [-ix, H, -iz]], k: G, L: 2, ph: 0, up, d: battens(p4) });
  sheets(p4, faces);
  // opšav atike: U-kapa (gornja ploha + vanjski i unutarnji krak), crvena okapnica
  const c = 0.06,
    ty = Ht + 0.05;
  const O = [hx + c, hz + c],
    I = [ix - c, iz - c];
  const oc: [number, number][] = [
    [-1, 1],
    [1, 1],
    [1, -1],
    [-1, -1],
  ];
  for (let j = 0; j < 4; j++) {
    const [sa, ta] = oc[j],
      [sb, tb] = oc[(j + 1) % 4];
    const oa: V3 = [sa * O[0], ty, ta * O[1]],
      ob: V3 = [sb * O[0], ty, tb * O[1]];
    const ia: V3 = [sa * I[0], ty, ta * I[1]],
      ib: V3 = [sb * I[0], ty, tb * I[1]];
    const i = 0.05 + j * 0.12;
    faces.push({ p: [oa, ob, ib, ia], k: LM, L: 5, ph: 3, i, up });
    const ol = 0.17,
      il = 0.1;
    faces.push({
      p: [oa, ob, [ob[0], ty - ol, ob[2]], [oa[0], ty - ol, oa[2]]],
      k: LM,
      L: 5,
      ph: 3,
      i,
      o: [0, ty, 0],
      d: [{ p: [[oa[0], ty - ol, oa[2]], [ob[0], ty - ol, ob[2]]], c: RED, w: 2.2, a: 1, ph: 3, i }],
    });
    faces.push({ p: [ia, ib, [ib[0], ty - il, ib[2]], [ia[0], ty - il, ia[2]]], k: LM, L: 5, ph: 3, i, up: [-sa * (j % 2 ? 1 : 0), 0, -ta * (j % 2 ? 0 : 1)] as V3 });
  }
  // klima jedinica na nosačima
  const ax0 = 1.6,
    ax1 = 2.9,
    az0 = -2.6,
    az1 = -1.75,
    ay0 = H + 0.22,
    ay1 = H + 1.05;
  const acx = (ax0 + ax1) / 2,
    acz = (az0 + az1) / 2;
  const fan: V3[] = [],
    fan2: V3[] = [];
  for (let k = 0; k <= 28; k++) {
    const a = (k / 28) * Math.PI * 2;
    fan.push([acx + 0.33 * Math.cos(a), ay1 + 0.01, acz + 0.33 * Math.sin(a)]);
    fan2.push([acx + 0.12 * Math.cos(a), ay1 + 0.01, acz + 0.12 * Math.sin(a)]);
  }
  const grille: Det[] = [];
  for (let k = 1; k < 7; k++) {
    const y = ay0 + ((ay1 - ay0) * k) / 7;
    grille.push({ p: [[ax0 + 0.08, y, az1 + 0.01], [ax1 - 0.08, y, az1 + 0.01]], c: 0, a: 0.3, w: 0.8 });
  }
  faces.push(
    ...box([ax0, ay0, az0], [ax1, ay1, az1], ST, 4, 3, 0.7, 'd', {
      t: [
        { p: fan, c: 5, a: 0.75, w: 1.1 },
        { p: fan2, c: 5, a: 0.6, w: 1 },
        { p: [[acx - 0.33, ay1 + 0.01, acz], [acx + 0.33, ay1 + 0.01, acz]], c: 5, a: 0.5 },
        { p: [[acx, ay1 + 0.01, acz - 0.33], [acx, ay1 + 0.01, acz + 0.33]], c: 5, a: 0.5 },
      ],
      f: grille,
    }),
  );
  for (const z of [az0 + 0.12, az1 - 0.12]) lines.push({ p: [[ax0 - 0.15, H + 0.08, z], [ax1 + 0.15, H + 0.08, z], [ax1 + 0.15, ay0, z]], c: 4, L: 4, ph: 3, i: 0.65, a: 0.7 });
  // izljev kroz atiku + vertikala na bočnom zidu, između prozora
  const pz = -0.85;
  faces.push(...box([-hx - 0.2, H - 0.05, pz - 0.12], [-hx, H + 0.12, pz + 0.13], LM, 1, 3, 0.4));
  pipe(
    [
      [-hx - 0.14, H - 0.05, pz],
      [-hx - 0.14, 0.32, pz],
      [-hx - 0.34, 0.08, pz],
    ],
    0.055,
    1,
    3,
    0.45,
    faces,
  );
  lines.push({ p: [[-hx - 1.2, 0, hz + 1.2], [hx + 1.2, 0, hz + 1.2]], c: 0, L: 0, ph: 0, a: 0.14 });
  return {
    name: tagName(4, 'RAVNI KROV · OPŠAV ATIKE'),
    pitch: 25 * deg,
    faces,
    lines,
    dims: [
      { a: [-hx, 0, hz], b: [hx, 0, hz], o: [0, 0, 1.6], t: mm(L) },
      { a: [-hx, 0, -hz], b: [-hx, 0, hz], o: [-1.6, 0, 0], t: mm(D) },
      { a: [hx, 0, hz], b: [hx, Ht, hz], o: [1.5, 0, 0.7], t: mm(Ht) },
    ],
    tag: [acx, ay1 + 0.02, acz],
  };
}

/** tvornice modela (grade se tek kad zatrebaju) */
export const MODELS: (() => ModelDef)[] = [m1, m2, m3, m4];
/** kratki nazivi za kontrole (aria-label) */
export const NAMES = ['dvostrešni krov', 'četverostrešni krov', 'falcani krov', 'ravni krov s opšavom atike'];
