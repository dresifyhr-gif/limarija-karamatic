/**
 * roof3d — mali 3D renderer za Canvas 2D (i SVG pri buildu). Bez ovisnosti.
 *
 * Model je podatak (plohe, linije, kote u metrima); draw() za zadano vrijeme montaže
 * i kameru izračuna projekciju, sjenčanje i redoslijed (slikarski, po slojevima) i šalje
 * primitive u "Out" (canvas u pregledniku, SVG string u Nodeu). Isti kod → statični
 * SVG iz builda i animirani canvas izgledaju jednako.
 *
 * Koordinate: x udesno, y gore, z prema promatraču. Kamera kruži oko osi y (yaw) i
 * gleda odozgo (pitch).
 */
export type V3 = [number, number, number];

/** detalj na plohi (prozor, šav, red crijepa…) — crta se samo kad je ploha vidljiva */
export interface Det {
  p: V3[];
  /** boja: indeks u COL */
  c: number;
  w?: number;
  a?: number;
  /** vlastita faza (inače prati ispunu plohe) */
  ph?: number;
  i?: number;
  /** zatvorena linija */
  z?: boolean;
}
export interface FaceDef {
  p: V3[];
  /** vrsta: 0 zid · 1 skica krova · 2 lim · 3 svijetli lim · 4 staklo · 5 tamno · 6 čelik */
  k: number;
  /** sloj: 0 tlo · 1 tijelo · 2 skica krova · 3 lim/oluci · 4 na krovu · 5 opšav */
  L: number;
  /** faza montaže */
  ph: number;
  /** položaj u fazi 0..1 (stagger) */
  i?: number;
  /** normala gleda OD ove točke */
  o?: V3;
  /** normala gleda U ovom smjeru */
  up?: V3;
  /** pomak trake pri polaganju (svjetski, m) */
  s?: V3;
  d?: Det[];
  /** rubovi (default: zid/skica/svijetli lim/čelik) */
  e?: boolean;
  /** pomak dubine (crta se kasnije) */
  b?: number;
  /** vidljivost: normale zida na kojem element visi — crta se samo kad je bar jedna okrenuta kameri */
  v?: V3[];
}
export interface LineDef {
  p: V3[];
  /** normale susjednih ploha: linija se crta samo kad je bar jedna okrenuta kameri */
  n?: V3[];
  c: number;
  L: number;
  ph: number;
  i?: number;
  w?: number;
  a?: number;
  /** kotna oznaka (luk nagiba) — ide s kotama */
  an?: boolean;
}
export interface DimDef {
  a: V3;
  b: V3;
  /** odmak kotne linije od mjerenih točaka */
  o: V3;
  t: string;
  /** stvarna točka za pomoćnu liniju kraja b (npr. vrh zabata), ako b nije na modelu */
  x?: V3;
}
export interface TagDef {
  p: V3;
  t: string;
  /** strana oznake: 1 desno, -1 lijevo */
  sx?: number;
  /** boja (COL) */
  c?: number;
}
export interface ModelDef {
  name: string;
  /** nagib kamere (rad) */
  pitch: number;
  faces: FaceDef[];
  lines: LineDef[];
  dims: DimDef[];
  /** glavna oznaka modela */
  tag: V3;
  /** male oznake (npr. nagib) */
  tags?: TagDef[];
}

interface Face extends FaceDef {
  n: V3;
  c: V3;
  i: number;
  /** visina 0..1 (redoslijed rastavljanja) */
  h: number;
}
interface Edge {
  a: V3;
  b: V3;
  f: number[];
  ph: number;
  i: number;
  st: boolean;
  h: number;
}
interface Line extends LineDef {
  h: number;
  m: V3;
}
export interface Model {
  name: string;
  pitch: number;
  faces: Face[];
  edges: Edge[];
  lines: Line[];
  dims: DimDef[];
  tag: V3;
  tags: TagDef[];
  D: number;
  /** obuhvat projekcije (f = 1) preko cijelog raspona okretanja: x0, x1, y0, y1 — s kotama */
  ext: number[];
  /** isto, bez kota */
  ex0: number[];
}

export interface Cam {
  yaw: number;
  pitch: number;
  f: number;
  D: number;
  cx: number;
  cy: number;
  /** px jedinica (canvas 1, SVG viewBox) */
  u: number;
  /** odsjaj: -1 nema, inače 0..1 preko okvira modela */
  g: number;
  /** okvir modela na ekranu (lijevo, gore, širina) */
  bx: number;
  by: number;
  bs: number;
  /** granice natpisa: lijevo, desno, gore */
  lx: number;
  rx: number;
  ty: number;
  /** bez kota (premalo mjesta) */
  nd: boolean;
  /** prozirnost natpisa i kota (0..1) */
  an: number;
}

export interface Out {
  fill(xy: number[], n: number, rgb: string, a: number, metal: boolean): void;
  stroke(xy: number[], n: number, rgb: string, a: number, w: number, dash: boolean, close?: boolean): void;
  text(x: number, y: number, s: string, rgb: string, a: number, ang: number, align: number, size: number, knock: boolean): void;
  /** skupina (samo SVG): ime klase ili null za kraj */
  group?(name: string | null): void;
}

/* ── boje ───────────────────────────────────────────────────── */
/** 0 linija · 1 čelik · 2 crvena (logo) · 3 redline · 4 svijetli lim · 5 grafit · 6 bijela */
export const COL = ['213,219,223', '138,147,155', '215,20,26', '255,59,63', '182,190,196', '9,11,13', '255,255,255'];
// osnovne boje ispune po vrsti plohe i njihova prozirnost
const KB = [
  [29, 33, 38],
  [19, 22, 25],
  [60, 66, 71],
  [82, 89, 95],
  [44, 56, 68],
  [9, 10, 12],
  [118, 126, 133],
];
const KA = [0.93, 0.8, 1, 1, 0.94, 1, 1];

/* ── vremenska crta montaže (s) ─────────────────────────────── */
// [početak, prozor, trajanje elementa]
// 0 crtež · 1 ispuna zidova · 2 polaganje lima · 3 opšavi/oluci/crvena · 4 kote i oznaka
export const PH = [
  [0, 1.55, 0.72],
  [0.95, 0.9, 0.8],
  [1.6, 2.0, 0.44],
  [3.4, 0.9, 0.55],
  [4.1, 1.15, 0.7],
];
/** gotov model (statični kadar) */
export const T_DONE = 5.3;
/** kraj zadržavanja (počinje rastavljanje) */
export const T_HOLD = 7;
/** sljedeći model kreće (preklapanje s rastavljanjem) */
export const T_NEXT = T_HOLD + 0.25;
/** kraj rastavljanja */
export const T_END = T_HOLD + 1.45;
/** kraj polaganja lima (skica ispod više ne treba) */
const T_LAID = PH[2][0] + PH[2][1] + 0.4;

export type Ease = (x: number) => number;
const cl = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
let eDraft: Ease = (x) => x * x * (3 - 2 * x);
let ePress: Ease = (x) => 1 - Math.pow(1 - x, 4);
/** u pregledniku: GSAP krivulje "draft" i "press" */
export function setEases(draft: Ease, press: Ease) {
  eDraft = draft;
  ePress = press;
}
const pg = (ph: number, i: number, t: number) => {
  const q = PH[ph];
  return cl((t - q[0] - i * (q[1] - q[2])) / q[2]);
};
/* rastavljanje odozgo prema dolje: najprije natpisi, pa ispune, pa linije */
const outA = (t: number) => (t < T_HOLD ? 1 : 1 - eDraft(cl((t - T_HOLD) / 0.35)));
const outF = (h: number, t: number) => (t < T_HOLD ? 1 : 1 - eDraft(cl((t - T_HOLD - (1 - h) * 0.3) / 0.4)));
const outL = (h: number, t: number) => (t < T_HOLD ? 1 : 1 - eDraft(cl((t - T_HOLD - 0.15 - (1 - h) * 0.5) / 0.8)));
/** pri rastavljanju linija se malo uvuče (prema donjem kraju) i izblijedi — bez "krhotina" */
const shr = (o: number) => 0.55 + 0.45 * o;

/* ── vektori ────────────────────────────────────────────────── */
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const nrm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const mid = (p: V3[]): V3 => {
  const c: V3 = [0, 0, 0];
  for (const q of p) for (let k = 0; k < 3; k++) c[k] += q[k] / p.length;
  return c;
};

/* ── priprema modela ───────────────────────────────────────── */
export function compile(def: ModelDef): Model {
  // središte = sredina obuhvata
  const mn = [1e9, 1e9, 1e9],
    mx = [-1e9, -1e9, -1e9];
  for (const f of def.faces)
    for (const p of f.p)
      for (let k = 0; k < 3; k++) {
        mn[k] = Math.min(mn[k], p[k]);
        mx[k] = Math.max(mx[k], p[k]);
      }
  const C: V3 = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
  const mv = (p: V3): V3 => [p[0] - C[0], p[1] - C[1], p[2] - C[2]];
  const hy = (y: number) => cl((y + C[1] - mn[1]) / (mx[1] - mn[1] || 1));
  let R = 0;
  const faces: Face[] = def.faces.map((f) => {
    const p = f.p.map(mv);
    // Newellova normala
    let nx = 0,
      ny = 0,
      nz = 0;
    for (let j = 0; j < p.length; j++) {
      const a = p[j],
        b = p[(j + 1) % p.length];
      nx += (a[1] - b[1]) * (a[2] + b[2]);
      ny += (a[2] - b[2]) * (a[0] + b[0]);
      nz += (a[0] - b[0]) * (a[1] + b[1]);
      R = Math.max(R, Math.hypot(a[0], a[1], a[2]));
    }
    const c = mid(p);
    let n = nrm([nx, ny, nz]);
    if (f.o && dot(n, sub(c, mv(f.o))) < 0) n = [-n[0], -n[1], -n[2]];
    if (f.up && dot(n, f.up) < 0) n = [-n[0], -n[1], -n[2]];
    return {
      ...f,
      p,
      n,
      c,
      i: f.i ?? 0,
      h: hy(c[1]),
      d: f.d?.map((d) => ({ ...d, p: d.p.map(mv) })),
    };
  });
  // rubovi iz ploha (dijeljeni rub = jedan rub s dvije plohe)
  const map = new Map<string, Edge>();
  const key = (p: V3) => p.map((v) => v.toFixed(2)).join(',');
  faces.forEach((f, fi) => {
    const st = f.k < 2;
    if (!(f.e ?? (st || f.k === 3 || f.k === 6))) return;
    const ph = st ? 0 : f.ph;
    for (let j = 0; j < f.p.length; j++) {
      let a = f.p[j],
        b = f.p[(j + 1) % f.p.length];
      // linija raste odozdo prema gore (vodoravne slijeva nadesno)
      if (a[1] - b[1] > 1e-6 || (Math.abs(a[1] - b[1]) <= 1e-6 && a[0] + a[2] > b[0] + b[2])) [a, b] = [b, a];
      const ka = key(a),
        kb = key(b);
      const k = ka + '|' + kb + ph;
      const e = map.get(k);
      if (e) e.f.push(fi);
      else map.set(k, { a, b, f: [fi], ph, i: f.i, st, h: hy((a[1] + b[1]) / 2) });
    }
  });
  const edges = [...map.values()];
  // konstrukcija raste odozdo prema gore
  const cons = edges.filter((e) => e.ph === 0);
  cons
    .map((e) => ({ e, s: Math.min(e.a[1], e.b[1]) * 10 + (e.a[0] + e.b[0]) * 0.2 }))
    .sort((a, b) => a.s - b.s)
    .forEach((o, j, arr) => (o.e.i = arr.length > 1 ? (j / (arr.length - 1)) * 0.9 : 0));
  const lines: Line[] = def.lines.map((l) => {
    const p = l.p.map(mv);
    const m = mid(p);
    return { ...l, p, m, h: hy(m[1]) };
  });
  const dims = def.dims.map((d) => ({ ...d, a: mv(d.a), b: mv(d.b), x: d.x && mv(d.x) }));
  const D = R * 3.1;
  // obuhvat preko raspona okretanja (+ kote)
  const pts: V3[] = [];
  faces.forEach((f) => pts.push(...f.p));
  const nf = pts.length;
  dims.forEach((d) => pts.push([d.a[0] + d.o[0], d.a[1] + d.o[1], d.a[2] + d.o[2]], [d.b[0] + d.o[0], d.b[1] + d.o[1], d.b[2] + d.o[2]]));
  const ext = [1e9, -1e9, 1e9, -1e9],
    ex0 = [1e9, -1e9, 1e9, -1e9];
  for (let s = 0; s <= 8; s++) {
    const yaw = YAW0 - AMP + (2 * AMP * s) / 8;
    for (const dp of [-PAMP, PAMP]) {
      setCam({ yaw, pitch: def.pitch + dp, f: 1, D, cx: 0, cy: 0 } as Cam);
      pts.forEach((p, j) => {
        proj(p);
        for (const e of j < nf ? [ext, ex0] : [ext]) {
          e[0] = Math.min(e[0], PX);
          e[1] = Math.max(e[1], PX);
          e[2] = Math.min(e[2], PY);
          e[3] = Math.max(e[3], PY);
        }
      });
    }
  }
  return { name: def.name, pitch: def.pitch, faces, edges, lines, dims, tag: mv(def.tag), tags: (def.tags || []).map((t) => ({ ...t, p: mv(t.p) })), D, ext, ex0 };
}

/* ── kamera ─────────────────────────────────────────────────── */
/** osnovni kut (model okrenut lijevim zabatom prema tekstu) i amplituda okretanja: ~17°…54° */
export const YAW0 = 0.62;
export const AMP = 0.32;
export const PAMP = 0.035;

let cY = 1,
  sY = 0,
  cP = 1,
  sP = 0,
  CD = 10,
  CF = 1,
  CX = 0,
  CY = 0;
let PX = 0,
  PY = 0;
function setCam(c: Cam) {
  cY = Math.cos(c.yaw);
  sY = Math.sin(c.yaw);
  cP = Math.cos(c.pitch);
  sP = Math.sin(c.pitch);
  CD = c.D;
  CF = c.f;
  CX = c.cx;
  CY = c.cy;
}
/** projicira točku u PX/PY; vraća dubinu (veće = dalje) */
function proj(p: V3): number {
  const x1 = p[0] * cY + p[2] * sY;
  const z1 = -p[0] * sY + p[2] * cY;
  const y2 = p[1] * cP - z1 * sP;
  const z2 = p[1] * sP + z1 * cP;
  const d = CD - z2;
  const s = CF / d;
  PX = CX + x1 * s;
  PY = CY - y2 * s;
  return d;
}
const depth = (p: V3) => CD - (p[1] * sP + (-p[0] * sY + p[2] * cY) * cP);

/**
 * Kamera za model u kvadratnom okviru (središte cx, cy; stranica S).
 * clock = vrijeme okretanja (s), amp = 0..1 udio amplitude, nd = bez kota.
 */
export function camFor(M: Model, clock: number, amp: number, cx: number, cy: number, S: number, u = 1, nd = false): Cam {
  const e = nd ? M.ex0 : M.ext;
  const w = e[1] - e[0],
    h = e[3] - e[2];
  const f = Math.min((S * 0.98) / w, (S * 0.84) / h);
  return {
    yaw: YAW0 + AMP * amp * Math.sin((clock * Math.PI * 2) / 26),
    pitch: M.pitch + PAMP * amp * Math.sin((clock * Math.PI * 2) / 34 + 1),
    f,
    D: M.D,
    // središte obuhvata u sredinu okvira, malo niže (gore je oznaka)
    cx: cx - ((e[0] + e[1]) / 2) * f,
    cy: cy - ((e[2] + e[3]) / 2) * f + S * 0.05,
    u,
    g: -1,
    bx: cx - S / 2,
    by: cy - S / 2,
    bs: S,
    lx: cx - S / 2,
    rx: cx + S / 2,
    ty: cy - S / 2 + 22 * u,
    nd,
    an: 1,
  };
}

/* ── crtanje ───────────────────────────────────────────────── */
const LIGHT = nrm([-0.55, 0.74, 0.4]);
const XY: number[] = [];

/** djelomična polilinija (napredak p po duljini) u XY; vraća broj točaka */
function partial(n: number, p: number): number {
  if (p >= 1) return n;
  let len = 0;
  for (let j = 1; j < n; j++) len += Math.hypot(XY[2 * j] - XY[2 * j - 2], XY[2 * j + 1] - XY[2 * j - 1]);
  let rem = len * p;
  for (let j = 1; j < n; j++) {
    const dx = XY[2 * j] - XY[2 * j - 2],
      dy = XY[2 * j + 1] - XY[2 * j - 1];
    const l = Math.hypot(dx, dy);
    if (rem <= l) {
      const k = l ? rem / l : 0;
      XY[2 * j] = XY[2 * j - 2] + dx * k;
      XY[2 * j + 1] = XY[2 * j - 1] + dy * k;
      return j + 1;
    }
    rem -= l;
  }
  return n;
}
function load(p: V3[], off?: V3 | null): number {
  for (let j = 0; j < p.length; j++) {
    const q = p[j];
    if (off) proj([q[0] + off[0], q[1] + off[1], q[2] + off[2]]);
    else proj(q);
    XY[2 * j] = PX;
    XY[2 * j + 1] = PY;
  }
  return p.length;
}
const line2 = (a: V3, b: V3) => {
  proj(a);
  XY[0] = PX;
  XY[1] = PY;
  proj(b);
  XY[2] = PX;
  XY[3] = PY;
};

type Item = { L: number; z: number; j: number };
const items: Item[] = [];
// međuspremnici po plohi (rastu po potrebi, bez alokacije po kadru)
let FR = new Uint8Array(0),
  FA = new Float32Array(0),
  POS = new Int32Array(0);
const OFF: (V3 | null)[] = [];
const OWN: Edge[][] = [];
const HID: Edge[] = [];

/**
 * Nacrtaj model u trenutku t (s od početka montaže) kamerom C.
 */
export function draw(M: Model, t: number, C: Cam, O: Out) {
  setCam(C);
  const F = M.faces,
    nF = F.length;
  if (FR.length < nF) {
    FR = new Uint8Array(nF);
    FA = new Float32Array(nF);
    POS = new Int32Array(nF);
  }
  // kamera u svijetu
  const Cw: V3 = [-C.D * cP * sY, C.D * sP, C.D * cP * cY];
  const sees = (n: V3, p: V3) => n[0] * (Cw[0] - p[0]) + n[1] * (Cw[1] - p[1]) + n[2] * (Cw[2] - p[2]) > 0;
  items.length = 0;

  for (let j = 0; j < nF; j++) {
    const f = F[j];
    OFF[j] = null;
    OWN[j] = [];
    POS[j] = -1;
    const front = (f.k === 4 || sees(f.n, f.c)) && (!f.v || f.v.some((q) => sees(q, f.c)));
    FR[j] = front ? 1 : 0;
    if (!front) continue;
    let a: number;
    if (f.ph === 0) a = eDraft(pg(1, f.i, t));
    else if (f.ph === 2) {
      const p = pg(2, f.i, t);
      a = cl(p * 2.6);
      if (f.s && p < 1) {
        const k = 1 - ePress(p);
        OFF[j] = [f.s[0] * k, f.s[1] * k, f.s[2] * k];
      }
    } else a = eDraft(pg(f.ph, f.i, t));
    // skica krova pod položenim limom više se ne vidi (manje crtanja, manji SVG)
    FA[j] = f.k === 1 && t > T_LAID ? 0 : a * outF(f.h, t);
    items.push({ L: f.L, z: depth(f.c) - (f.b || 0), j });
  }
  M.lines.forEach((l, k) => {
    if (l.an && C.nd) return;
    if (l.n && !l.n.some((q) => sees(q, l.m))) return;
    items.push({ L: l.L, z: depth(l.m), j: -1 - k });
  });
  items.sort((a, b) => a.L - b.L || b.z - a.z);

  // vlasnik ruba = najkasnije crtana vidljiva ploha
  items.forEach((it, k) => it.j >= 0 && (POS[it.j] = k));
  HID.length = 0;
  for (const e of M.edges) {
    let best = -1,
      bp = -1;
    for (const fi of e.f)
      if (FR[fi] && POS[fi] > bp) {
        bp = POS[fi];
        best = fi;
      }
    if (best >= 0) OWN[best].push(e);
    else if (e.st) HID.push(e);
  }

  const edge = (e: Edge, dash: boolean) => {
    const o = outL(e.h, t);
    const p = eDraft(pg(e.ph, e.i, t)) * shr(o);
    if (p <= 0.001 || o <= 0.003) return;
    load([e.a, e.b]);
    const n = partial(2, p);
    const k = o;
    if (dash) O.stroke(XY, n, COL[0], 0.15 * k, 1, true);
    else if (e.st) O.stroke(XY, n, COL[0], 0.64 * k, 1, false);
    else O.stroke(XY, n, COL[4], 0.78 * k, 1, false);
  };

  const aA = outA(t) * C.an;
  let hiddenDone = false;
  for (const it of items) {
    if (!hiddenDone && it.L >= 2) {
      hiddenDone = true;
      for (const e of HID) edge(e, true);
    }
    if (it.j < 0) {
      const l = M.lines[-1 - it.j];
      const o = l.an ? aA : outL(l.h, t);
      const p = eDraft(pg(l.ph, l.i || 0, t)) * (l.an ? 1 : shr(o));
      if (p <= 0.001 || o <= 0.003) continue;
      const n = partial(load(l.p), p);
      if (l.an) O.group?.('rm-dim');
      O.stroke(XY, n, COL[l.c], (l.a ?? 0.8) * o, l.w ?? 1, false);
      if (l.an) O.group?.(null);
      continue;
    }
    const j = it.j,
      f = F[j],
      a = FA[j];
    if (a > 0.003) {
      const n = load(f.p, OFF[j]);
      const base = KB[f.k];
      let b = 1;
      // sjenčanje: difuzno + odsjaj (Blinn) + prolaz odsjaja
      const nl = Math.max(0, dot(f.n, LIGHT));
      if (f.k === 2 || f.k === 3 || f.k === 6 || f.k === 4) {
        const v = nrm(sub(Cw, f.c));
        const h = nrm([LIGHT[0] + v[0], LIGHT[1] + v[1], LIGHT[2] + v[2]]);
        const sp = Math.pow(Math.max(0, dot(f.n, h)), 22);
        if (f.k === 4) b = 0.85 + 0.9 * sp + 0.25 * nl;
        else {
          b = 0.5 + 0.62 * nl + 0.6 * sp;
          if (C.g > -1 && f.k === 2) {
            proj(f.c);
            const gx = (PX - C.bx) / C.bs - C.g;
            b += 0.32 * Math.exp(-(gx * gx) / 0.006);
          }
        }
      } else if (f.k === 0) b = 0.72 + 0.55 * nl;
      else if (f.k === 1) b = 0.85;
      const rgb = `${Math.min(255, base[0] * b) | 0},${Math.min(255, base[1] * b) | 0},${Math.min(255, base[2] * b) | 0}`;
      O.fill(XY, n, rgb, a * KA[f.k], f.k === 2 || f.k === 3);
    }
    if (f.d && !(f.k === 1 && t > T_LAID)) {
      const fo = outF(f.h, t);
      for (const d of f.d) {
        const da = d.ph != null ? eDraft(pg(d.ph, d.i || 0, t)) * fo : a;
        if (da <= 0.003) continue;
        const n = load(d.p, OFF[j]);
        if (d.ph === 0 || d.ph === 3) {
          // crtež se iscrtava, pri rastavljanju blijedi
          const db = eDraft(pg(d.ph, d.i || 0, t));
          O.stroke(XY, partial(n, db), COL[d.c], (d.a ?? 0.6) * fo, d.w ?? 1, false, d.z && db >= 1);
        } else O.stroke(XY, n, COL[d.c], (d.a ?? 0.6) * da, d.w ?? 1, false, d.z);
      }
    }
    for (const e of OWN[j]) edge(e, false);
  }
  if (!hiddenDone) for (const e of HID) edge(e, true);

  if (aA <= 0.001) return;
  const u = C.u;
  /* kote */
  if (!C.nd) {
    O.group?.('rm-dim');
    M.dims.forEach((d, k) => {
      const i = k / Math.max(1, M.dims.length - 1);
      const p = eDraft(pg(4, i, t));
      if (p <= 0.001) return;
      const A: V3 = [d.a[0] + d.o[0], d.a[1] + d.o[1], d.a[2] + d.o[2]];
      const B: V3 = [d.b[0] + d.o[0], d.b[1] + d.o[1], d.b[2] + d.o[2]];
      const dA = proj(A);
      const ax = PX,
        ay = PY;
      const dB = proj(B);
      const bx = PX,
        by = PY;
      const L = Math.hypot(bx - ax, by - ay) || 1;
      // skraćena kota (gleda se uzduž nje) blijedi — inače izgleda kao druga mjera
      const ratio = L / ((Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]) * C.f * 2) / (dA + dB));
      const al = aA * cl((ratio - 0.5) / 0.15);
      if (al <= 0.003) return;
      // pomoćne (produžne) linije: od točke na modelu (s razmakom) do malo preko kotne linije
      for (const [s, E] of [
        [d.a, A],
        [d.x || d.b, B],
      ] as [V3, V3][]) {
        const v = sub(E, s);
        const lv = Math.hypot(v[0], v[1], v[2]) || 1;
        const g0 = Math.min(0.2, lv * 0.14) / lv,
          g1 = 1 + 0.25 / lv;
        line2([s[0] + v[0] * g0, s[1] + v[1] * g0, s[2] + v[2] * g0], [s[0] + v[0] * g1, s[1] + v[1] * g1, s[2] + v[2] * g1]);
        O.stroke(XY, partial(2, p), COL[3], 0.42 * al, 0.8, false);
      }
      const mx = (ax + bx) / 2,
        my = (ay + by) / 2;
      XY[0] = mx + (ax - mx) * p;
      XY[1] = my + (ay - my) * p;
      XY[2] = mx + (bx - mx) * p;
      XY[3] = my + (by - my) * p;
      O.stroke(XY, 2, COL[3], 0.95 * al, 1, false);
      const ux = (bx - ax) / L,
        uy = (by - ay) / L;
      // kosi zarezi na krajevima (45°)
      const tx = (ux - uy) * 4.6 * u,
        ty = (uy + ux) * 4.6 * u;
      const ta = cl((p - 0.75) * 4) * al;
      if (ta > 0)
        for (const [x, y] of [
          [ax, ay],
          [bx, by],
        ]) {
          XY[0] = x - tx;
          XY[1] = y - ty;
          XY[2] = x + tx;
          XY[3] = y + ty;
          O.stroke(XY, 2, COL[3], ta, 1.3, false);
        }
      // natpis čitljiv odozdo ili slijeva; skoro okomite kote uvijek odozdo prema gore (bez prevrtanja)
      let ang = Math.atan2(uy, ux);
      const lo = -Math.PI / 2 - 0.21;
      while (ang < lo) ang += Math.PI;
      while (ang >= lo + Math.PI) ang -= Math.PI;
      // ako je kota kraća od natpisa, natpis ide uz liniju
      const room = L > d.t.length * 8.2 * u + 16 * u;
      const nx = Math.sin(ang),
        ny = -Math.cos(ang);
      const sh = room ? 0 : 9 * u;
      O.text(mx + nx * sh, my + ny * sh, d.t, COL[3], cl((p - 0.45) * 2.2) * al, ang, 1, 11 * u, room);
    });
    /* male oznake (nagib) */
    for (const g of M.tags) {
      const p = eDraft(pg(4, 0.5, t)) * aA;
      if (p <= 0.001) continue;
      proj(g.p);
      O.text(PX, PY, g.t, COL[g.c ?? 1], p * 0.95, 0, g.sx === -1 ? 2 : g.sx === 1 ? 0 : 1, 10.5 * u, false);
    }
    O.group?.(null);
  }

  /* glavna oznaka: odvodna linija od točke na modelu, tekst iznad vodoravne crte */
  const p = eDraft(pg(4, 0.35, t));
  if (p > 0.001) {
    O.group?.('rm-tag');
    proj(M.tag);
    const x0 = PX,
      y0 = PY;
    const sz = 10.5 * u;
    const tw = M.name.length * sz * 0.72;
    // crta natpisa: iznad modela, nikad iznad granice C.ty; tekst uvijek unutar [C.lx, C.rx]
    const ly = Math.max(C.ty, Math.min(y0 - 34 * u, C.by + 22 * u));
    const kx0 = x0 + Math.abs(y0 - ly) * 0.55;
    const tx = Math.max(C.lx, Math.min(kx0 - 3 * u, C.rx - tw));
    const kx = Math.max(tx, Math.min(kx0, tx + tw));
    XY[0] = x0;
    XY[1] = y0;
    XY[2] = kx;
    XY[3] = ly;
    O.stroke(XY, partial(2, cl(p * 1.6)), COL[0], 0.5 * aA, 1, false);
    const q = cl(p * 1.6 - 0.6);
    if (q > 0) {
      XY[0] = kx - (kx - tx + 3 * u) * q;
      XY[1] = ly;
      XY[2] = kx + (tx + tw + 3 * u - kx) * q;
      XY[3] = ly;
      O.stroke(XY, 2, COL[0], 0.5 * aA, 1, false);
    }
    // točka na modelu
    const r = 1.6 * u;
    XY.splice(0, 8, x0 - r, y0 - r, x0 + r, y0 - r, x0 + r, y0 + r, x0 - r, y0 + r);
    O.fill(XY, 4, COL[0], p * 0.9 * aA, false);
    O.text(tx, ly - 8 * u, M.name, COL[0], cl((p - 0.55) * 2.4) * aA, 0, 0, sz, false);
    O.group?.(null);
  }
}
