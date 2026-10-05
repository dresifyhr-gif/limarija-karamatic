/**
 * Geometrija hero crteža ("LIST 01"). Računa se jednom pri buildu i ide u HTML
 * kao statični, zaokruženi SVG — u pregledniku nema nikakvog računanja.
 *
 * Kuća je u blagoj 2,5D perspektivi kao u logu: zabat je u pravoj veličini
 * (nagib 35° je stvarno 35° na crtežu), dubina bježi prema točki nestajanja
 * desno na visini tla, pa je tlo vodoravno, a sljeme i streha padaju udesno.
 *
 * viewBox 0 0 800 600, jedinice = px crteža.
 */
type P = [number, number];

const VB = { w: 800, h: 600 } as const;
const VP: P = [1950, 470]; // točka nestajanja (visina oka ≈ tlo)
const KB = 0.18; // dubina kuće (udio puta do VP)
const TAN = Math.tan((35 * Math.PI) / 180);

const n = (v: number) => {
  const r = Math.round(v * 10) / 10;
  return Object.is(r, -0) ? '0' : String(r);
};
const p = (a: P) => `${n(a[0])} ${n(a[1])}`;
const lerp = (a: P, b: P, t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const back = (a: P, k = KB): P => lerp(a, VP, k);
const add = (a: P, dx: number, dy: number): P => [a[0] + dx, a[1] + dy];
const path = (pts: P[], close = false) => 'M' + pts.map(p).join('L') + (close ? 'Z' : '');
/** perspektivno skraćenje: jednak korak u stvarnosti → sve manji na crtežu */
const persp = (u: number, a = 0.35) => (KB * (u * (1 + a))) / (1 + a * u);

/* ── glavni zabat ─────────────────────────────────────────── */
const CX = 250;
const EY = 300; // vanjski rub strehe
const HW = 200;
const GY = 470; // tlo
const BT = 11; // debljina opšava (okomito)
const EL: P = [CX - HW, EY];
const ER: P = [CX + HW, EY];
const A: P = [CX, EY - HW * TAN]; // vrh zabata
const rakeY = (x: number, off = 0) => A[1] + off + Math.abs(x - CX) * TAN;
const WX0 = 76;
const WX1 = 424;

const A2 = back(A); // stražnji kraj sljemena
const ER2 = back(ER); // stražnji kraj strehe

/* ── trake (stojeći falc) na desnoj plohi ─────────────────── */
const N = 8;
const ks = Array.from({ length: N + 1 }, (_, i) => persp(i / N));
const ridge = (k: number) => back(A, k);
const eave = (k: number) => back(ER, k);
const strips = ks.slice(0, N).map((k0, i) => {
  const k1 = ks[i + 1];
  return path([ridge(k0), ridge(k1), eave(k1), eave(k0)], true);
});
/** šavovi: linija sljeme→streha na granici traka (i = 1..N-1) */
const seams = ks.slice(1, N).map((k) => path([ridge(k), eave(k)]));
/** snjegobrani: jedan red na 78 % kosine */
const guardAt = (k: number) => lerp(ridge(k), eave(k), 0.8);
const guards = ks.slice(0, N).map((k0, i) => {
  const k1 = ks[i + 1];
  const a = guardAt(k0 + (k1 - k0) * 0.22);
  const b = guardAt(k0 + (k1 - k0) * 0.78);
  return path([a, b, add(b, -2, -5.5), add(a, -2, -5.5)], true);
});

/* ── krila (drugi zabat iza, desno) ───────────────────────── */
const B: P = [630, 202];
const WHW = 92;
const WEw: P = [B[0] + WHW, B[1] + WHW * TAN];
// presjek lijeve kosine krila (pada ulijevo) sa stražnjom kosinom glavnog krova
const backRakeY = (x: number) => A2[1] + (x - A2[0]) * TAN;
const meetX = (off: number) => (B[1] + off + B[0] * TAN - A2[1] + A2[0] * TAN) / (2 * TAN);
const J0: P = [meetX(0), backRakeY(meetX(0))];
const J1: P = [meetX(BT - 1), backRakeY(meetX(BT - 1))];
const WB: P = add(B, 0, BT - 1);
const WEi: P = add(WEw, 0, BT - 1);
const wingBand = path([J0, B, WEw, WEi, WB, J1], true);
const B2 = back(B, 0.045);
const WE2 = back(WEw, 0.045);
const wingRoof = path([B, B2, WE2, WEw], true);
const wingSeams = [0.33, 0.66].map((t) => path([lerp(B, B2, t), lerp(WEw, WE2, t)])).join('');
const JR: P = [meetX(15), backRakeY(meetX(15))];
const wingRed = path([JR, add(B, 0, 15), [WEw[0] - 5, rakeYw(WEw[0] - 5) + 15]]);
function rakeYw(x: number) {
  return B[1] + (x - B[0]) * TAN;
}

/* ── opšav (traka koja se savija) ─────────────────────────── */
const bandPts: P[] = [EL, A, ER, add(ER, 0, BT), add(A, 0, BT), add(EL, 0, BT)];
const band = path(bandPts, true);
// ravni lim prije savijanja — isti broj točaka, leži iznad sljemena
const FLAT_GAP = 46; // koliko ravni lim leži iznad vrha zabata
const FY = A[1] - FLAT_GAP;
const flat = path(
  [
    [CX - 228, FY],
    [CX, FY],
    [CX + 228, FY],
    [CX + 228, FY + 8],
    [CX, FY + 8],
    [CX - 228, FY + 8],
  ],
  true,
);

/* crvena linija strehe (kao u logu): ispod opšava zabata pa uz bočnu strehu */
const RS = 14;
const redStart: P = [58, rakeY(58, RS)];
const redEnd: P = [442, rakeY(442, RS)];
const redSide = back([442, EY + RS + 1]);
const eaveRed = path([redStart, [CX, A[1] + RS], redEnd, add(redSide, -6, -1)]);

/* ── olučni sustav ────────────────────────────────────────── */
const G0: P = [446, EY + 1];
const G1 = back(G0);
const gutterBody = path([G0, G1, add(back([446, EY + 12]), 0, 0), [446, EY + 12]], true);
const gutterLip = path([add(G0, 12, 0), add(G1, 10, 0)]);
const gutterEnd = `M440 ${n(EY + 1)}A6 6 0 0 0 452 ${n(EY + 1)}`;
const PX = G1[0] - 6; // vertikala ispod stražnjeg kraja oluka
const pipeTop = G1[1] + 8;
const pipe = `M${n(PX - 4.5)} ${n(pipeTop)}H${n(PX + 4.5)}V${GY - 16}L${n(PX + 13)} ${GY - 7}V${GY - 1}H${n(PX + 5)}L${n(PX - 4.5)} ${GY - 10}Z`;
const pipeClamps = `M${n(PX - 7)} ${n(pipeTop + 40)}H${n(PX + 7)}M${n(PX - 7)} ${n(pipeTop + 88)}H${n(PX + 7)}`;

/* ── dimnjak (na lijevoj plohi, iza kosine) ───────────────── */
const C0 = 118;
const C1 = 162;
const CT = 140;
const cd = back([C1, CT], 0.012);
const cOff = [cd[0] - C1, cd[1] - CT];
const chimney =
  `M${C0} ${n(rakeY(C0))}V${CT}H${C1}V${n(rakeY(C1))}` +
  `M${C1} ${CT}L${n(C1 + cOff[0])} ${n(CT + cOff[1])}V${n(rakeY(C1 + cOff[0]))}`;
const chimneyFill = path(
  [
    [C0, rakeY(C0)],
    [C0, CT],
    [C1 + cOff[0], CT + cOff[1]],
    [C1 + cOff[0], rakeY(C1 + cOff[0])],
  ],
  true,
);
const chimneyCourses = `M${C0} ${CT + 14}H${C1}`;
const cap = path(
  [
    [C0 - 7, CT - 8],
    [C1 + 7, CT - 8],
    [C1 + 7 + cOff[0], CT - 8 + cOff[1]],
    [C1 + 7 + cOff[0], CT + cOff[1]],
    [C1 + 7, CT],
    [C0 - 7, CT],
  ],
  true,
);

/* ── zidovi, prozor, tlo ──────────────────────────────────── */
const wallTop = (x: number) => rakeY(x, RS + 3);
const sideTop: P = [WX1, EY + RS + 2];
const sideTop2 = back(sideTop);
const sideBot2 = back([WX1, GY]);
const walls =
  `M${WX0} ${GY}V${n(wallTop(WX0))}M${WX1} ${n(wallTop(WX1))}V${GY}` +
  `M${p(sideTop)}L${p(sideTop2)}V${GY}`;
const win = { x: 216, y: 326, s: 68 };
const window_ =
  `M${win.x} ${win.y}h${win.s}v${win.s}h-${win.s}Z` +
  `M${win.x + 5} ${win.y + 5}h${win.s - 10}v${win.s - 10}h-${win.s - 10}Z` +
  `M${win.x + win.s / 2} ${win.y + 5}v${win.s - 10}M${win.x + 5} ${win.y + win.s / 2}h${win.s - 10}` +
  `M${win.x - 6} ${win.y + win.s + 4}h${win.s + 12}`;
const ground = `M20 ${GY}H780`;

/* rubovi krova (obris) */
const roofOutline =
  path([EL, A, ER]) +
  path([add(EL, 0, BT), add(A, 0, BT), add(ER, 0, BT)]) +
  `M${p(EL)}v${BT}M${p(ER)}v${BT}` +
  path([A, A2, ER2, ER]);
const wingOutline = path([J0, B, WEw]) + path([J1, WB, WEi]) + `M${p(WEw)}v${BT - 1}` + path([B, B2, WE2, WEw]);
const wingWall = `M${n(WEw[0] - 4)} ${n(WEi[1])}V${n(backRakeY(WEw[0] - 4))}`;

/* ── konstrukcijske linije (crtkane) ──────────────────────── */
const rayTo = (a: P, x: number): P => [x, a[1] + ((VP[1] - a[1]) / (VP[0] - a[0])) * (x - a[0])];
const guides =
  `M${CX} 128V528` + // os zabata
  `M20 ${EY}H790` + // visina strehe
  path([A2, rayTo(A2, 790)]) +
  path([ER2, rayTo(ER2, 790)]);

/* ravnalo uz rub lista: kratke crtice svakih 50, duže svakih 100 */
const ruler = (() => {
  let d = '';
  for (let x = 50; x < VB.w; x += 50) d += `M${x} 0v${x % 100 ? 5 : 10}`;
  for (let y = 50; y < VB.h; y += 50) d += `M0 ${y}h${y % 100 ? 5 : 10}`;
  return d;
})();
const rulerLabels = [
  ...[100, 200, 300, 400, 500, 600, 700].map((x) => ({ x: x + 4, y: 17, t: String(x) })),
];

/* ── kote (crveno) ────────────────────────────────────────── */
const DY = 512;
const dims = {
  // širina zabata
  width:
    `M${WX0} ${GY + 8}V${DY + 8}M${WX1} ${GY + 8}V${DY + 8}` +
    `M${WX0 - 8} ${DY}H${WX1 + 8}` +
    `M${WX0 - 5} ${DY + 5}l10 -10M${WX1 - 5} ${DY + 5}l10 -10`,
  widthLabel: { x: CX, y: DY - 8 },
  // visina strehe
  height: `M26 ${EY - 8}V${GY + 8}M21 ${EY + 5}l10 -10M21 ${GY + 5}l10 -10`,
  heightLabel: { x: 18, y: (EY + GY) / 2 },
  // nagib: luk oko lijevog kraja strehe
  pitch: (() => {
    const r = 62;
    const a = (35 * Math.PI) / 180;
    const s: P = [EL[0] + r, EY];
    const e: P = [EL[0] + r * Math.cos(a), EY - r * Math.sin(a)];
    return `M${p(s)}A${r} ${r} 0 0 0 ${p(e)}`;
  })(),
  pitchLabel: { x: EL[0] + 70, y: EY - 13 },
  // oznaka materijala: točka na limu → oznaka gore desno
  ral: (() => {
    const k = (ks[2] + ks[3]) / 2;
    const at = lerp(ridge(k), eave(k), 0.36);
    const knee: P = [at[0] + 64, 120];
    return { d: path([at, knee, [knee[0] + 128, 120]]), dot: at, label: { x: knee[0] + 6, y: 112 } };
  })(),
};

/* ── pečat ────────────────────────────────────────────────── */
const stamp = { x: 562, y: 414, r: -6 };

/* ── prozor na fotografiju: SAMO krov (zidovi ostaju nacrtani) + odredište na rubu ──
 * Obris krova: donji rub opšava zabata → kosine → sljeme (glavni krov, spoj, krilo)
 * → stražnja streha krila → stražnji kraj strehe → prednja streha. Svaka točka ima
 * svoju ciljnu točku na rubu ploče (udjeli širine/visine), redom u smjeru kazaljke,
 * pa se prozor u obliku krova samo "rastvori" do punog okvira. */
const windowPoly: { v: P; t: P }[] = [
  { v: add(EL, 0, BT), t: [0, 1] },
  { v: EL, t: [0, 0.42] },
  { v: A, t: [0, 0] },
  { v: A2, t: [0.56, 0] },
  { v: J0, t: [0.66, 0] },
  { v: B, t: [0.78, 0] },
  { v: B2, t: [1, 0] },
  { v: WE2, t: [1, 0.34] },
  { v: ER2, t: [1, 1] },
  { v: add(ER, 0, BT), t: [0.56, 1] },
];

/* ── glint: maska za odsjaj (ploha glavnog krova + krila) ─── */
const roofClip = path([A, A2, ER2, ER], true) + wingRoof;

export const drawing = {
  vb: `0 0 ${VB.w} ${VB.h}`,
  A,
  band,
  flat,
  flatGap: FLAT_GAP,
  strips,
  seams,
  guards,
  wingBand,
  wingRoof,
  wingSeams,
  wingRed,
  wingWall,
  eaveRed,
  gutterBody,
  gutterLip,
  gutterEnd,
  pipe,
  pipeClamps,
  chimney,
  chimneyFill,
  chimneyCourses,
  cap,
  walls,
  window: window_,
  ground,
  groundHatch: { x: 40, y: GY, w: 700, h: 9 },
  roofOutline,
  wingOutline,
  guides,
  ruler,
  rulerLabels,
  dims,
  stamp,
  roofClip,
  metal: { x1: n(ridge(KB / 2)[0]), y1: n(ridge(KB / 2)[1]), x2: n(eave(KB / 2)[0]), y2: n(eave(KB / 2)[1]) },
  beam: (() => {
    // greda abkanta: donji rub ima urez Λ istog nagiba kao krov (vrh u A)
    const hw = 78;
    const nh = 46; // pola širine ureza
    const by = A[1] + nh * TAN;
    return {
      body: `M${CX - hw} ${n(by - 82)}H${CX + hw}V${n(by)}H${CX + nh}L${CX} ${n(A[1])}L${CX - nh} ${n(by)}H${CX - hw}Z`,
      lambda: `M${CX - nh} ${n(by)}L${CX} ${n(A[1])}L${CX + nh} ${n(by)}`,
      ram: `M${CX - 13} -300H${CX + 13}V${n(by - 82)}H${CX - 13}Z`,
      lines: `M${CX - hw + 8} ${n(by - 70)}H${CX + hw - 8}M${CX - hw + 8} ${n(by - 12)}H${CX - nh - 6}M${CX + nh + 6} ${n(by - 12)}H${CX + hw - 8}`,
    };
  })(),
  windowPoly: windowPoly.map((w) => [Math.round(w.v[0]), Math.round(w.v[1]), w.t[0], w.t[1]]),
};
