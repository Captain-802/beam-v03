'use strict';
/* ===========================================================================
   Independent hand checks - single-span verification library (19 Sep 2026
   scope: one span, End 1 / End 2 degree-of-freedom flags)
   ---------------------------------------------------------------------------
   Every value below is recomputed from first principles or from published
   tables with the arithmetic written out, using ONLY the section table rows
   quoted from js/sections/*.js (typed in here as constants) and the case
   inputs of tests/batch/cases.cjs. No engine function is called for the hand
   value; the engine is run through tests/harness.cjs only to obtain the value
   it prints, for the comparison column. tests/batch/hand-checks.md documents
   the same steps in prose.

   Usage:  node tests/batch/hand-checks.cjs        (prints the table)
   A difference above 1 % is a finding (printed as such, exit code 1). Two
   findings are expected and explained in hand-checks.md: HC-17c (the web
   station at a fixed End 2 reads M = 0: engine finding) and HC-23 (the
   eigenvalue against the SN003a k = 0.5 factor, a method difference).
   =========================================================================== */
const { app } = require('../harness.cjs');
const { cases } = require('./cases.cjs');
const ctx = app();
const E = 210000, G = 81000, PI = Math.PI;
const rows = [];
const log = (...s) => console.log(...s);
const pct = (h, e) => 100 * (e - h) / h;
function record(id, what, hand, eng, unit, note, expectedFinding) {
  const d = pct(hand, eng);
  rows.push({ id, what, hand, eng, unit, d, note: note || '', expectedFinding: !!expectedFinding });
  log(`  => hand ${hand.toPrecision(6)} ${unit} | engine ${eng.toPrecision(6)} ${unit} | diff ${d.toFixed(3)} %${Math.abs(d) > 1 ? (expectedFinding ? '   <-- FINDING (> 1 %, expected: see hand-checks.md)' : '   <-- FINDING (> 1 %)') : ''}`);
}
function engine(id, method, code) {
  const cs = cases.find(c => c.id === id);
  if (!cs) throw new Error('case ' + id + ' not in cases.cjs');
  const o = JSON.parse(JSON.stringify(cs.overrides)); o.mcrMethod = method || 'eigen';
  ctx.reset(o);
  return ctx.run(`(()=>{ const a=analyse(); const c=checks(a); return (${code})(a,c); })()`);
}
const swOf = mass => +(mass * 9.81 / 1000).toFixed(4);   // the engine's 4-decimal self-weight, kN/m

/* ===========================================================================
   A. Statics and deflections of the presets (closed forms, self-weight included)
   =========================================================================== */

/* ---------------------------------------------------------------------------
   HC-01  UB-71  UB 305x165x40, 6 m GUIDED-FIXED (End 1 fixed, End 2 sliding: rotation held, vertical free), UDL 3 G + 4 Q
   Half of a fixed-fixed beam of span 2L by symmetry: M_fixed = wL^2/3, M_guided = wL^2/6 (sagging), R_1 = wL, R_2 = 0,
   tip deflection = w(2L)^4/(384EI) = wL^4/(24EI).  row: mass 40.3, Ix 8500 cm4
   --------------------------------------------------------------------------- */
log('\nHC-01  UB-71  guided-fixed UDL: end moments, reactions, tip deflection');
{
  const L = 6, Ix = 8500e4, mass = 40.3;
  const w = 1.35 * (3 + swOf(mass)) + 1.5 * 4, wS = 4;                       // ULS kN/m, SLS kN/m (Q only)
  const M1 = w * L * L / 3, M2 = w * L * L / 6, R1 = w * L;
  const d = wS * Math.pow(L * 1000, 4) / (24 * E * Ix);
  log(`  w_ULS = 1.35(3 + ${swOf(mass)}) + 1.5 x 4 = ${w.toFixed(4)} kN/m: M_1 = wL^2/3 = ${M1.toFixed(3)}, M_2 = wL^2/6 = ${M2.toFixed(3)} kN.m, R_1 = wL = ${R1.toFixed(3)} kN; d_tip = 4 x 6000^4/(24 x 210000 x 8500e4) = ${d.toFixed(3)} mm`);
  const e = engine('UB-71', 'eigen', '(a,c)=>({M1:Math.abs(a.reactions[0].M)/1e6, M2:Math.abs(a.reactions[1].M)/1e6, R1:a.reactions[0].V/1000, R2:a.reactions[1].V/1000, d:Math.abs(a.dmax), Mmax:Math.abs(a.Mmax)})');
  record('HC-01', 'UB-71 guided-fixed: M at the fixed End 1 = wL^2/3', M1, e.M1, 'kN.m');
  record('HC-01b', 'UB-71 guided-fixed: M at the guided End 2 = wL^2/6', M2, e.M2, 'kN.m', 'R_2 = ' + e.R2.toFixed(4) + ' kN (no vertical reaction at a guided end)');
  record('HC-01c', 'UB-71 guided-fixed: R_1 = wL', R1, e.R1, 'kN');
  record('HC-01d', 'UB-71 guided-fixed: tip deflection wL^4/24EI (SLS Q)', d, e.d, 'mm');
}

/* ---------------------------------------------------------------------------
   HC-02  UB-72  UB 406x178x54, 6 m GUIDED-FIXED, point load 15 G + 40 Q at the guided end (+ self-weight)
   Point load P at the guided end = central load 2P on the fixed-fixed beam of span 2L: M_fixed = M_guided = PL/2,
   tip deflection = 2P(2L)^3/(192EI) = PL^3/(12EI); self-weight adds wL^2/3 and wL^2/6.  row: mass 54.1, Ix 18700 cm4
   --------------------------------------------------------------------------- */
log('\nHC-02  UB-72  guided-fixed tip point load: PL/2 at both ends, PL^3/12EI');
{
  const L = 6, Ix = 18700e4, mass = 54.1;
  const P = 1.35 * 15 + 1.5 * 40, w = 1.35 * swOf(mass), PS = 40;
  const M1 = P * L / 2 + w * L * L / 3, M2 = P * L / 2 + w * L * L / 6;
  const d = PS * 1000 * Math.pow(L * 1000, 3) / (12 * E * Ix);
  log(`  P_ULS = ${P.toFixed(2)} kN, self-weight w = ${w.toFixed(4)} kN/m: M_1 = PL/2 + wL^2/3 = ${M1.toFixed(3)}, M_2 = PL/2 + wL^2/6 = ${M2.toFixed(3)} kN.m; d_tip = 40e3 x 6000^3/(12 x 210000 x 18700e4) = ${d.toFixed(3)} mm`);
  const e = engine('UB-72', 'eigen', '(a,c)=>({M1:Math.abs(a.reactions[0].M)/1e6, M2:Math.abs(a.reactions[1].M)/1e6, d:Math.abs(a.dmax)})');
  record('HC-02', 'UB-72 guided-fixed tip load: M_1 = PL/2 + wL^2/3', M1, e.M1, 'kN.m');
  record('HC-02b', 'UB-72 guided-fixed tip load: M_2 = PL/2 + wL^2/6', M2, e.M2, 'kN.m');
  record('HC-02c', 'UB-72 guided-fixed tip load: deflection PL^3/12EI', d, e.d, 'mm');
}

/* ---------------------------------------------------------------------------
   HC-03  UB-21  UB 406x140x39, 8 m FIXED-FIXED, UDL 5 G + 6 Q
   M_end = wL^2/12 (hogging, both ends), M_mid = wL^2/24, R = wL/2, d_mid = wL^4/(384EI).  row: mass 39.0, Ix 12500 cm4
   --------------------------------------------------------------------------- */
log('\nHC-03  UB-21  fixed-fixed UDL: end moments and mid-span deflection');
{
  const L = 8, Ix = 12500e4, mass = 39.0;
  const w = 1.35 * (5 + swOf(mass)) + 1.5 * 6, wS = 6;
  const Mend = w * L * L / 12, R = w * L / 2, d = wS * Math.pow(L * 1000, 4) / (384 * E * Ix);
  log(`  w_ULS = ${w.toFixed(4)} kN/m: M_end = wL^2/12 = ${Mend.toFixed(3)} kN.m, R = wL/2 = ${R.toFixed(3)} kN; d_mid = 6 x 8000^4/(384 x 210000 x 12500e4) = ${d.toFixed(3)} mm`);
  const e = engine('UB-21', 'eigen', '(a,c)=>({M1:Math.abs(a.reactions[0].M)/1e6, M2:Math.abs(a.reactions[1].M)/1e6, R1:a.reactions[0].V/1000, d:Math.abs(a.dmax)})');
  record('HC-03', 'UB-21 fixed-fixed UDL: M_end = wL^2/12 (End 1)', Mend, e.M1, 'kN.m', 'End 2 ' + e.M2.toFixed(3));
  record('HC-03b', 'UB-21 fixed-fixed UDL: R = wL/2', R, e.R1, 'kN');
  record('HC-03c', 'UB-21 fixed-fixed UDL: d_mid = wL^4/384EI', d, e.d, 'mm');
}

/* ---------------------------------------------------------------------------
   HC-04  UB-53  UB 457x191x82, 8 m FIXED-FIXED, central point load 60 G + 150 Q (+ self-weight)
   M_end = PL/8 + wL^2/12, d_mid = PL^3/(192EI) (SLS Q only).  row: mass 82.0, Ix 37100 cm4
   --------------------------------------------------------------------------- */
log('\nHC-04  UB-53  fixed-fixed central point load: PL/8 and PL^3/192EI');
{
  const L = 8, Ix = 37100e4, mass = 82.0;
  const P = 1.35 * 60 + 1.5 * 150, w = 1.35 * swOf(mass), PS = 150;
  const Mend = P * L / 8 + w * L * L / 12, d = PS * 1000 * Math.pow(L * 1000, 3) / (192 * E * Ix);
  log(`  P_ULS = ${P} kN, w_sw = ${w.toFixed(4)} kN/m: M_end = PL/8 + wL^2/12 = ${Mend.toFixed(3)} kN.m; d_mid = 150e3 x 8000^3/(192 x 210000 x 37100e4) = ${d.toFixed(3)} mm`);
  const e = engine('UB-53', 'eigen', '(a,c)=>({M1:Math.abs(a.reactions[0].M)/1e6, d:Math.abs(a.dmax)})');
  record('HC-04', 'UB-53 fixed-fixed central P: M_end = PL/8 + wL^2/12', Mend, e.M1, 'kN.m');
  record('HC-04b', 'UB-53 fixed-fixed central P: d_mid = PL^3/192EI', d, e.d, 'mm');
}

/* ---------------------------------------------------------------------------
   HC-05  UB-64 / UB-19  CANTILEVERS: UB 305x165x40, 3 m, UDL 6 G + 9 Q; UB 254x102x22, 3 m, tip load 10 Q
   M_root = wL^2/2 (+ PL), d_tip = wL^4/(8EI) (+ PL^3/(3EI)).  rows: 305x165x40 mass 40.3 Ix 8500; 254x102x22 mass 22.0 Ix 2840
   --------------------------------------------------------------------------- */
log('\nHC-05  UB-64 / UB-19  cantilever root moment and tip deflection');
{
  const L = 3, Ix = 8500e4, mass = 40.3;
  const w = 1.35 * (6 + swOf(mass)) + 1.5 * 9, wS = 9;
  const M = w * L * L / 2, d = wS * Math.pow(L * 1000, 4) / (8 * E * Ix);
  log(`  UB-64: w_ULS = ${w.toFixed(4)} kN/m: M_root = wL^2/2 = ${M.toFixed(3)} kN.m; d_tip = 9 x 3000^4/(8 x 210000 x 8500e4) = ${d.toFixed(3)} mm`);
  const e = engine('UB-64', 'eigen', '(a,c)=>({M:Math.abs(a.reactions[0].M)/1e6, d:Math.abs(a.dmax), lim:c.dlimit})');
  record('HC-05', 'UB-64 cantilever UDL: M_root = wL^2/2', M, e.M, 'kN.m');
  record('HC-05b', 'UB-64 cantilever UDL: d_tip = wL^4/8EI', d, e.d, 'mm', 'limit L/180 = ' + e.lim.toFixed(2) + ' mm');
  const Ix2 = 2840e4, mass2 = 22.0, w2 = 1.35 * swOf(mass2), P = 1.5 * 10, PS = 10;
  const M2 = P * L + w2 * L * L / 2, d2 = PS * 1000 * Math.pow(L * 1000, 3) / (3 * E * Ix2);
  log(`  UB-19: P_ULS = 15 kN, w_sw = ${w2.toFixed(4)} kN/m: M_root = PL + wL^2/2 = ${M2.toFixed(3)} kN.m; d_tip = 10e3 x 3000^3/(3 x 210000 x 2840e4) = ${d2.toFixed(3)} mm`);
  const e2 = engine('UB-19', 'eigen', '(a,c)=>({M:Math.abs(a.reactions[0].M)/1e6, d:Math.abs(a.dmax)})');
  record('HC-05c', 'UB-19 cantilever tip load: M_root = PL + wL^2/2', M2, e2.M, 'kN.m');
  record('HC-05d', 'UB-19 cantilever tip load: d_tip = PL^3/3EI', d2, e2.d, 'mm');
}

/* ---------------------------------------------------------------------------
   HC-06  UB-76 / UB-77  PINNED-GUIDED: UB 305x165x40, 4 m, UDL 3 G + 4 Q; UB 406x178x54, 5 m, tip load 8 G + 20 Q
   Half of a simply supported beam of span 2L: M_guided = wL^2/2 (+ PL), R_1 = wL (+ P), d_tip = 5wL^4/(24EI) (+ PL^3/(3EI)).
   --------------------------------------------------------------------------- */
log('\nHC-06  UB-76 / UB-77  pinned-guided: moment at the guided end, R_1, tip deflection');
{
  const L = 4, Ix = 8500e4, mass = 40.3;
  const w = 1.35 * (3 + swOf(mass)) + 1.5 * 4, wS = 4;
  const M2 = w * L * L / 2, R1 = w * L, d = 5 * wS * Math.pow(L * 1000, 4) / (24 * E * Ix);
  log(`  UB-76: w_ULS = ${w.toFixed(4)} kN/m: M_2 = wL^2/2 = ${M2.toFixed(3)} kN.m, R_1 = wL = ${R1.toFixed(3)} kN; d_tip = 5 x 4 x 4000^4/(24 x 210000 x 8500e4) = ${d.toFixed(3)} mm`);
  const e = engine('UB-76', 'eigen', '(a,c)=>({M2:Math.abs(a.reactions[1].M)/1e6, R1:a.reactions[0].V/1000, d:Math.abs(a.dmax)})');
  record('HC-06', 'UB-76 pinned-guided UDL: M_2 = wL^2/2', M2, e.M2, 'kN.m');
  record('HC-06b', 'UB-76 pinned-guided UDL: R_1 = wL', R1, e.R1, 'kN');
  record('HC-06c', 'UB-76 pinned-guided UDL: d_tip = 5wL^4/24EI', d, e.d, 'mm');
  const L2 = 5, Ix2 = 18700e4, mass2 = 54.1, P = 1.35 * 8 + 1.5 * 20, w2 = 1.35 * swOf(mass2), PS = 20;
  const M22 = P * L2 + w2 * L2 * L2 / 2, d2 = PS * 1000 * Math.pow(L2 * 1000, 3) / (3 * E * Ix2);
  log(`  UB-77: P_ULS = ${P.toFixed(2)} kN, w_sw = ${w2.toFixed(4)} kN/m: M_2 = PL + wL^2/2 = ${M22.toFixed(3)} kN.m; d_tip = 20e3 x 5000^3/(3 x 210000 x 18700e4) = ${d2.toFixed(3)} mm`);
  const e2 = engine('UB-77', 'eigen', '(a,c)=>({M2:Math.abs(a.reactions[1].M)/1e6, d:Math.abs(a.dmax)})');
  record('HC-06d', 'UB-77 pinned-guided tip load: M_2 = PL + wL^2/2', M22, e2.M2, 'kN.m');
  record('HC-06e', 'UB-77 pinned-guided tip load: d_tip = PL^3/3EI', d2, e2.d, 'mm');
}

/* ---------------------------------------------------------------------------
   HC-07  UB-20  UB 305x127x37, 6 m PROPPED CANTILEVER (End 1 fixed, End 2 pinned), UDL 6 G + 7 Q
   M_fixed = wL^2/8, R_pinned = 3wL/8, R_fixed = 5wL/8; d_max = w xi (L^3 - 3L xi^2 + 2 xi^3)/(48EI) at xi = 0.4215 L from the
   pinned end (dy/dxi = 0: 1 - 9t^2 + 8t^3 = 0), i.e. 0.005416 wL^4/EI = wL^4/(184.6 EI).  row: mass 37.0, Ix 7170 cm4
   --------------------------------------------------------------------------- */
log('\nHC-07  UB-20  propped cantilever UDL: fixed-end moment, reactions, d_max');
{
  const L = 6, Ix = 7170e4, mass = 37.0;
  const w = 1.35 * (6 + swOf(mass)) + 1.5 * 7, wS = 7;
  const M1 = w * L * L / 8, R2 = 3 * w * L / 8, R1 = 5 * w * L / 8;
  let t = 0.42; for (let i = 0; i < 50; i++) t = t - (1 - 9 * t * t + 8 * t * t * t) / (-18 * t + 24 * t * t);   // Newton on 1 - 9t^2 + 8t^3 = 0
  const Lmm = L * 1000, xi = t * Lmm, d = wS * xi * (Lmm ** 3 - 3 * Lmm * xi * xi + 2 * xi ** 3) / (48 * E * Ix);
  log(`  w_ULS = ${w.toFixed(4)} kN/m: M_1 = wL^2/8 = ${M1.toFixed(3)} kN.m, R_2 = 3wL/8 = ${R2.toFixed(3)}, R_1 = 5wL/8 = ${R1.toFixed(3)} kN; t = ${t.toFixed(5)}, d_max = ${d.toFixed(3)} mm = ${(d * E * Ix / (wS * Lmm ** 4)).toFixed(6)} wL^4/EI`);
  const e = engine('UB-20', 'eigen', '(a,c)=>({M1:Math.abs(a.reactions[0].M)/1e6, R1:a.reactions[0].V/1000, R2:a.reactions[1].V/1000, d:Math.abs(a.dmax), dpos:a.dpos})');
  record('HC-07', 'UB-20 propped UDL: M_fixed = wL^2/8', M1, e.M1, 'kN.m');
  record('HC-07b', 'UB-20 propped UDL: R_pinned = 3wL/8', R2, e.R2, 'kN', 'R_fixed ' + e.R1.toFixed(3) + ' vs 5wL/8 = ' + R1.toFixed(3));
  record('HC-07c', 'UB-20 propped UDL: d_max = 0.005416 wL^4/EI at 0.4215 L from the pin', d, e.d, 'mm', 'engine d at x = ' + e.dpos.toFixed(3) + ' m from End 1 (hand ' + ((1 - t) * L).toFixed(3) + ')');
}

/* ===========================================================================
   B. Strut effective lengths from the end fixities
   =========================================================================== */

/* ---------------------------------------------------------------------------
   HC-08  AX-04  UC 254x254x73, 6 m GUIDED-FIXED, N = 300 kN: L_cr,y = 1.2 L (fixed end, guided far end: sway permitted),
   L_cr,z = 0.7 L (U_y + R_z at both ends). EN 1993-1-1 6.3.1.2: lambda = (L_cr/i)/lambda_1, lambda_1 = pi sqrt(E/f_y) = 86.81
   (f_y = 275, t_f 14.2), Table 6.2 rolled H (h/b <= 1.2, t_f <= 100): y-y curve b (0.34), z-z curve c (0.49);
   Phi = 0.5[1 + alpha(lambda - 0.2) + lambda^2], chi = 1/(Phi + sqrt(Phi^2 - lambda^2)), N_b,Rd = chi A f_y.
   row: A 93.1 cm2, rx 11.1 cm, ry 6.48 cm (Blue Book radii of gyration, as the engine reads them)
   --------------------------------------------------------------------------- */
log('\nHC-08  AX-04  guided-fixed strut lengths 1.2 L / 0.7 L and N_b,Rd');
{
  const L = 6000, A = 93.1e2, rx = 111, ry = 64.8, fy = 275;
  const lam1 = PI * Math.sqrt(E / fy);
  const LcrY = 1.2 * L, LcrZ = 0.7 * L;
  const chi = (lam, al) => { const Phi = 0.5 * (1 + al * (lam - 0.2) + lam * lam); return Math.min(1 / (Phi + Math.sqrt(Phi * Phi - lam * lam)), 1); };
  const lamY = LcrY / rx / lam1, lamZ = LcrZ / ry / lam1, chiY = chi(lamY, 0.34), chiZ = chi(lamZ, 0.49);
  const NbY = chiY * A * fy / 1000, NbZ = chiZ * A * fy / 1000;
  log(`  lambda_1 = ${lam1.toFixed(3)}; L_cr,y = 1.2 x 6 = 7.2 m -> lambda_y = ${lamY.toFixed(4)}, chi_y (b) = ${chiY.toFixed(4)}, N_b,y,Rd = ${NbY.toFixed(1)} kN; L_cr,z = 0.7 x 6 = 4.2 m -> lambda_z = ${lamZ.toFixed(4)}, chi_z (c) = ${chiZ.toFixed(4)}, N_b,z,Rd = ${NbZ.toFixed(1)} kN`);
  const e = engine('AX-04', 'eigen', '(a,c)=>({LcrY:c.buck.LcrY, LcrZ:c.buck.LcrZ, NbY:c.buck.NbY, NbZ:c.buck.NbZ})');
  record('HC-08', 'AX-04 guided-fixed: L_cr,y = 1.2 L', LcrY, e.LcrY, 'mm');
  record('HC-08b', 'AX-04 guided-fixed: L_cr,z = 0.7 L', LcrZ, e.LcrZ, 'mm');
  record('HC-08c', 'AX-04 N_b,y,Rd (curve b, 1.2 L)', NbY, e.NbY, 'kN');
  record('HC-08d', 'AX-04 N_b,z,Rd (curve c, 0.7 L)', NbZ, e.NbZ, 'kN');
}

/* ===========================================================================
   C. Web transverse forces (EN 1993-1-5 clause 6)
   =========================================================================== */

/* ---------------------------------------------------------------------------
   HC-09  WEB-01  UB 610x229x101, 3 m SS, 600 kN (Q) at mid-span, s_s = 0, S275
   EN 1993-1-5 clause 6, load type (a). row: ["610 x 229 x 101",101.2,602.6,227.6,10.5,14.8,12.7,547.6,...]  (D, B, tw, tf, r, d)
   --------------------------------------------------------------------------- */
log('\nHC-09  WEB-01  F_Rd type (a), UB 610x229x101, s_s = 0');
{
  const D = 602.6, B = 227.6, tw = 10.5, tf = 14.8, L = 3000, fy = 275;   // tf < 16 -> fy = 275
  const eps = Math.sqrt(235 / fy);
  const hw = D - 2 * tf;                                   // 573.0
  const bf = Math.min(B, tw + 30 * eps * tf);              // 30 eps tf = 410.5 -> 421.0 > B -> bf = 227.6
  const m1 = bf / tw;                                      // 21.676
  const m2 = 0.02 * Math.pow(hw / tf, 2);                  // 0.02 x 38.72^2 = 29.98
  const kF = 6 + 2 * Math.pow(hw / L, 2);                  // a = L (no stiffener): 6 + 2 x 0.191^2 = 6.0730
  const Fcr = 0.9 * kF * E * Math.pow(tw, 3) / hw;         // N
  const ss = 0;
  let ly = Math.min(ss + 2 * tf * (1 + Math.sqrt(m1 + m2)), L);
  let lam = Math.sqrt(ly * tw * fy / Fcr);
  log(`  hw = ${hw}, bf = ${bf}, m1 = ${m1.toFixed(3)}, m2 = ${m2.toFixed(3)}, kF = ${kF.toFixed(4)}, Fcr = ${(Fcr / 1000).toFixed(1)} kN, ly = ${ly.toFixed(2)} mm, lambda_F = ${lam.toFixed(4)} (> 0.5 so m2 stays)`);
  const chi = Math.min(0.5 / lam, 1);
  const FRd = fy * chi * ly * tw / 1000;
  const FEd = 1.5 * 600;
  log(`  chi_F = ${chi.toFixed(4)}, L_eff = ${(chi * ly).toFixed(2)} mm, F_Rd = ${FRd.toFixed(1)} kN, F_Ed = ${FEd} kN, F_Ed/F_Rd = ${(FEd / FRd).toFixed(3)}`);
  const e = engine('WEB-01', 'eigen', '(a,c)=>({FRd:c.web.gov2.FRdTot,u:c.web.util2})');
  record('HC-09', 'WEB-01 F_Rd type (a) mid-span point load, s_s = 0', FRd, e.FRd, 'kN', 'lambda_F > 0.5, m2 retained');
}

/* ---------------------------------------------------------------------------
   HC-10  WEB-04  UB 533x210x92, 6 m SS, UDL 30 G + 40 Q, end reaction, s_s = 40
   load type (c) with type (a) alongside in the end zone; lower governs.
   row: ["533 x 210 x 92",92.1,533.1,209.3,10.1,15.6,12.7,476.5,...]
   --------------------------------------------------------------------------- */
function webEndFRd(D, B, tw, tf, L, fy, ss) {
  const eps = Math.sqrt(235 / fy), hw = D - 2 * tf;
  const bf = Math.min(B, tw + 30 * eps * tf), m1 = bf / tw, m2 = 0.02 * Math.pow(hw / tf, 2);
  const d = 0, c = Math.max(d - ss / 2, 0);                      // end station: c = 0
  const endZone = (ss + c) < 2 * hw / 3;
  const kFc = Math.min(2 + 6 * (ss + c) / hw, 6);
  const Fcrc = 0.9 * kFc * E * Math.pow(tw, 3) / hw;
  const le = Math.min(kFc * E * tw * tw / (2 * fy * hw), ss + c);
  const lyc = (m2v) => Math.min(le + tf * Math.sqrt(m1 / 2 + Math.pow(le / tf, 2) + m2v), le + tf * Math.sqrt(m1 + m2v));
  let ly = lyc(m2), lam = Math.sqrt(ly * tw * fy / Fcrc);
  if (lam <= 0.5) { ly = lyc(0); lam = Math.sqrt(ly * tw * fy / Fcrc); }
  const FRdc = fy * Math.min(0.5 / lam, 1) * ly * tw / 1000;
  const kFa = 6 + 2 * Math.pow(hw / L, 2), Fcra = 0.9 * kFa * E * Math.pow(tw, 3) / hw;
  let lya = Math.min(ss + 2 * tf * (1 + Math.sqrt(m1 + m2)), L), lama = Math.sqrt(lya * tw * fy / Fcra);
  if (lama <= 0.5) { lya = Math.min(ss + 2 * tf * (1 + Math.sqrt(m1)), L); lama = Math.sqrt(lya * tw * fy / Fcra); }
  const FRda = fy * Math.min(0.5 / lama, 1) * lya * tw / 1000;
  return { hw, m1, m2, endZone, kFc, Fcrc, le, ly, lam, FRdc, FRda, FRd: endZone ? Math.min(FRdc, FRda) : FRda };
}
log('\nHC-10  WEB-04  F_Rd type (c) end reaction, UB 533x210x92, s_s = 40');
{
  const D = 533.1, B = 209.3, tw = 10.1, tf = 15.6, L = 6000, fy = 275, mass = 92.1;
  const r = webEndFRd(D, B, tw, tf, L, fy, 40);
  const sw = mass * 9.81 / 1000, w = 1.35 * (30 + sw) + 1.5 * 40, R = w * 6 / 2;
  log(`  hw = ${r.hw.toFixed(1)}, m1 = ${r.m1.toFixed(3)}, m2 = ${r.m2.toFixed(3)}, end zone ${r.endZone}; type (c): kF = ${r.kFc.toFixed(4)}, Fcr = ${(r.Fcrc / 1000).toFixed(1)} kN, le = ${r.le.toFixed(1)}, ly = ${r.ly.toFixed(2)}, lambda_F = ${r.lam.toFixed(4)}, F_Rd = ${r.FRdc.toFixed(1)} kN; type (a): F_Rd = ${r.FRda.toFixed(1)} kN`);
  log(`  R = w L/2 with w = 1.35(30 + ${sw.toFixed(4)}) + 1.5 x 40 = ${w.toFixed(3)} kN/m -> ${R.toFixed(2)} kN; F_Ed/F_Rd = ${(R / r.FRd).toFixed(3)}`);
  const e = engine('WEB-04', 'eigen', '(a,c)=>({FRd:c.web.gov2.FRdTot,F:c.web.gov2.F})');
  record('HC-10', 'WEB-04 F_Rd type (c) end reaction, s_s = 40', r.FRd, e.FRd, 'kN', '(c) governs over (a) ' + r.FRda.toFixed(1));
  record('HC-10b', 'WEB-04 end reaction F_Ed (statics)', R, e.F, 'kN');
}

/* ---------------------------------------------------------------------------
   HC-11  WEB-07  UB 305x165x40, 3 m SS, 300 kN (Q) directly over End 2, s_s = 100
   load type (b) (load through the web) at the end station, with the end-zone
   type (c) evaluated alongside (d = 0 -> c = 0, s_s + c = 100 < 2 h_w/3 = 188.7)
   and the lower F_Rd governing; F_Ed = max(P, R) = R_2 (1.35 G + 1.5 Q).
   row: ["305 x 165 x 40",40.3,303.4,165.0,6.0,10.2,8.9,265.2,...]
   --------------------------------------------------------------------------- */
log('\nHC-11  WEB-07  F_Rd types (b) and (c) at the end, point load over End 2, UB 305x165x40');
{
  const D = 303.4, B = 165.0, tw = 6.0, tf = 10.2, L = 3000, fy = 275, mass = 40.3;
  const eps = Math.sqrt(235 / fy), hw = D - 2 * tf;                        // 283.0
  const bf = Math.min(B, tw + 30 * eps * tf), m1 = bf / tw, m2 = 0.02 * Math.pow(hw / tf, 2);
  const ss = 100, cc = 0;
  const FRdOf = (type) => {
    const kF = type === 'b' ? 3.5 + 2 * Math.pow(hw / L, 2) : Math.min(2 + 6 * (ss + cc) / hw, 6);
    const Fcr = 0.9 * kF * E * Math.pow(tw, 3) / hw;
    const le = type === 'c' ? Math.min(kF * E * tw * tw / (2 * fy * hw), ss + cc) : null;
    const ly = (m2v) => type === 'c' ? Math.min(le + tf * Math.sqrt(m1 / 2 + Math.pow(le / tf, 2) + m2v), le + tf * Math.sqrt(m1 + m2v)) : Math.min(ss + 2 * tf * (1 + Math.sqrt(m1 + m2v)), L);
    let l = ly(m2), lam = Math.sqrt(l * tw * fy / Fcr);
    if (lam <= 0.5) { l = ly(0); lam = Math.sqrt(l * tw * fy / Fcr); }
    const chi = Math.min(0.5 / lam, 1);
    log(`  type (${type}): kF = ${kF.toFixed(4)}, Fcr = ${(Fcr / 1000).toFixed(1)} kN, ly = ${l.toFixed(2)}, lambda_F = ${lam.toFixed(4)}, chi_F = ${chi.toFixed(4)}, F_Rd = ${(fy * chi * l * tw / 1000).toFixed(1)} kN`);
    return { FRd: fy * chi * l * tw / 1000, type };
  };
  const b = FRdOf('b'), c2 = FRdOf('c');
  const gov = b.FRd <= c2.FRd ? b : c2;
  const sw = mass * 9.81 / 1000, w = 1.35 * (5 + sw), R2 = w * 3 / 2 + 450;
  log(`  hw = ${hw}, bf = ${bf}, m1 = ${m1.toFixed(3)}, m2 = ${m2.toFixed(3)}; governing type (${gov.type}) F_Rd = ${gov.FRd.toFixed(1)} kN`);
  log(`  R2 = ${w.toFixed(4)} x 3/2 + 450 = ${R2.toFixed(2)} kN = F_Ed; F_Ed/F_Rd = ${(R2 / gov.FRd).toFixed(3)}`);
  const e = engine('WEB-07', 'eigen', '(a,c)=>({FRd:c.web.gov2.FRdTot,F:c.web.gov2.F,type:c.web.gov2.type})');
  record('HC-11', 'WEB-07 F_Rd at the end station, load through the web over End 2 (lower of types (b) and (c))', gov.FRd, e.FRd, 'kN', 'hand type (' + gov.type + '), engine type (' + e.type + ')');
  record('HC-11b', 'WEB-07 F_Ed = R2 (simply supported statics)', R2, e.F, 'kN');
}

/* ---------------------------------------------------------------------------
   HC-12  WEB-06  RHS 250x150x6.3, 3 m SS, 80 kN (Q) at mid-span at e = 40 mm, s_s = 60
   two webs of thickness t with the tabulated flat depth d = dt x t, flange share
   B/2 per web <= t + 15 eps t, lever-rule share 0.5 + e/(B - t) to the near web.
   row: ["250 x 150 x 6.3",38.0,250.0,150.0,6.3,48.4,20.8,36.7,...]  (D, B, t, A, bT, dt)
   --------------------------------------------------------------------------- */
log('\nHC-12  WEB-06  F_Rd two webs + lever rule, RHS 250x150x6.3, e = 40, s_s = 60');
{
  const D = 250, B = 150, t = 6.3, dt = 36.7, L = 3000, fy = 275;
  const eps = Math.sqrt(235 / fy), hw = dt * t;                             // 231.21
  const bf = Math.min(B / 2, t + 15 * eps * t), m1 = bf / t, m2 = 0.02 * Math.pow(hw / t, 2);
  const ss = 60, kF = 6 + 2 * Math.pow(hw / L, 2), Fcr = 0.9 * kF * E * Math.pow(t, 3) / hw;
  let ly = Math.min(ss + 2 * t * (1 + Math.sqrt(m1 + m2)), L), lam = Math.sqrt(ly * t * fy / Fcr), second = false;
  if (lam <= 0.5) { ly = Math.min(ss + 2 * t * (1 + Math.sqrt(m1)), L); lam = Math.sqrt(ly * t * fy / Fcr); second = true; }
  const chi = Math.min(0.5 / lam, 1), FRdWeb = fy * chi * ly * t / 1000;
  const share = Math.min(1, 0.5 + 40 / (B - t)), FRd = FRdWeb / share;
  log(`  hw = ${hw.toFixed(2)}, bf = min(75, ${(t + 15 * eps * t).toFixed(2)}) = ${bf.toFixed(2)}, m1 = ${m1.toFixed(3)}, m2 = ${m2.toFixed(2)}, kF = ${kF.toFixed(4)}, Fcr = ${(Fcr / 1000).toFixed(1)} kN, ly = ${ly.toFixed(2)}${second ? ' (second pass, m2 = 0)' : ''}, lambda_F = ${lam.toFixed(4)}, chi_F = ${chi.toFixed(3)}, F_Rd per web = ${FRdWeb.toFixed(1)} kN, share = ${share.toFixed(4)}, F_Rd = ${FRd.toFixed(1)} kN`);
  const e = engine('WEB-06', 'eigen', '(a,c)=>({FRd:c.web.gov2.FRdTot,share:c.web.gov2.share})');
  record('HC-12', 'WEB-06 RHS two-web F_Rd with the lever-rule share', FRd, e.FRd, 'kN', 'share ' + share.toFixed(3) + ' vs engine ' + e.share.toFixed(3));
}

/* ---------------------------------------------------------------------------
   HC-17  WEB-09  UB 533x210x92, 6 m FIXED-FIXED, UDL 30 G + 40 Q, end reactions on s_s = 40 (WEB-04 with fixed ends)
   F_Rd is the same type (c) value as HC-10 (301.0 kN) and R = wL/2 is the same (305.16 kN); what changes is the 7.2
   interaction: eta_1 = M_Ed/M_c,Rd at the station with M_Ed = the hogging end moment wL^2/12, M_c,Rd = W_pl f_y
   (S_x 2360 cm3, t_f 15.6 -> 275): (eta_2 + 0.8 eta_1)/1.4 at BOTH ends. Engine finding: the End 2 station samples the
   diagram exactly at x = L where the grid closes to zero beyond the end reaction moment, so eta_1(End 2) = 0.
   --------------------------------------------------------------------------- */
log('\nHC-17  WEB-09  web bearing at a FIXED end reaction: F_Rd, R and the 7.2 interaction at both ends');
{
  const D = 533.1, B = 209.3, tw = 10.1, tf = 15.6, L = 6000, fy = 275, mass = 92.1, Sx = 2360e3;
  const r = webEndFRd(D, B, tw, tf, L, fy, 40);
  const sw = mass * 9.81 / 1000, w = 1.35 * (30 + sw) + 1.5 * 40, R = w * 6 / 2, Mend = w * 36 / 12, McRd = Sx * fy / 1e6;
  const eta2 = R / r.FRd, eta1 = Mend / McRd, u72 = (eta2 + 0.8 * eta1) / 1.4;
  log(`  F_Rd type (c) = ${r.FRd.toFixed(1)} kN (HC-10), R = wL/2 = ${R.toFixed(2)} kN -> eta_2 = ${eta2.toFixed(4)}; M_end = wL^2/12 = ${Mend.toFixed(2)} kN.m, M_c,Rd = ${McRd.toFixed(1)} kN.m -> eta_1 = ${eta1.toFixed(4)}; (eta_2 + 0.8 eta_1)/1.4 = ${u72.toFixed(4)} at both ends`);
  const e = engine('WEB-09', 'eigen', '(a,c)=>{ const s1=c.web.stations.find(s=>s.n===1), s2=c.web.stations.find(s=>s.n===2); const k1=s1.cases[s1.g72], k2=s2.cases[s2.g72]; return {FRd:s1.FRdTot,F:s1.F,u1:s1.u72,u2:s2.u72,M1:k1.M,M2:k2.M,eta1a:k1.eta1,eta1b:k2.eta1,Mr1:Math.abs(a.reactions[0].M)/1e6,Mr2:Math.abs(a.reactions[1].M)/1e6}; }');
  record('HC-17', 'WEB-09 F_Rd type (c) at the fixed end, s_s = 40', r.FRd, e.FRd, 'kN');
  record('HC-17b', 'WEB-09 7.2 interaction (eta_2 + 0.8 eta_1)/1.4 at End 1 with M_Ed = wL^2/12', u72, e.u1, '-', 'engine M_Ed at the End 1 station ' + e.M1.toFixed(2) + ' = reaction moment ' + e.Mr1.toFixed(2));
  record('HC-17c', 'WEB-09 7.2 interaction at End 2 (engine finding: the station reads M = 0)', u72, e.u2, '-', 'engine M_Ed at the End 2 station ' + e.M2.toFixed(2) + ' vs the reaction moment ' + e.Mr2.toFixed(2) + ' kN.m', true);
}

/* ===========================================================================
   D. Elastic critical moment: SN003a with C2 z_g, SN006a, the k = 0.5 factor
   =========================================================================== */

/* ---------------------------------------------------------------------------
   HC-13  UB-04 (standard route)  UB 305x165x40, 6 m SS, UDL 5 G + 6 Q, z_g = +152 mm
   SN003a Table 3.2: simply supported + UDL, C1 = 1.127, C2 = 0.454, k = kw = 1
   Mcr = C1 (pi^2 E Iz/L^2) { sqrt[ Iw/Iz + L^2 G It/(pi^2 E Iz) + (C2 zg)^2 ] - C2 zg }
   row: Iy 764 cm4, J 14.7 cm4, Iw 0.164 dm6
   --------------------------------------------------------------------------- */
log('\nHC-13  UB-04 standard Mcr with C2 zg (SS + UDL, top-flange load)');
{
  const Iz = 764e4, It = 14.7e4, Iw = 0.164e12, L = 6000, C1 = 1.127, C2 = 0.454, zg = 152;
  const T1 = PI * PI * E * Iz / (L * L);
  const IwIz = Iw / Iz, GItT1 = G * It / T1, cz = C2 * zg;
  const Mcr = C1 * T1 * (Math.sqrt(IwIz + GItT1 + cz * cz) - cz) / 1e6;
  log(`  pi^2 E Iz/L^2 = ${T1.toFixed(1)} N; Iw/Iz = ${IwIz.toFixed(1)} mm2; G It/T1 = ${GItT1.toFixed(1)} mm2; C2 zg = ${cz.toFixed(3)} mm; Mcr = ${Mcr.toFixed(2)} kN.m`);
  const Mcr0 = C1 * T1 * Math.sqrt(IwIz + GItT1) / 1e6;
  log(`  (with the load at the shear centre Mcr = ${Mcr0.toFixed(2)} kN.m: the load height costs ${(100 * (1 - Mcr / Mcr0)).toFixed(1)} %)`);
  const e = engine('UB-04', 'standard', '(a,c)=>({Mcr:c.ltb.Mcr, C1:c.C1, C2:c.ltb.C2, zg:c.ltb.zg, used:c.ltb.zgUsed})');
  record('HC-13', 'UB-04 standard Mcr, SS UDL, C1 1.127 / C2 0.454, zg +152', Mcr, e.Mcr, 'kN.m', `engine C1 ${e.C1}, C2 ${e.C2}, zg ${e.zg} applied ${e.used}`);
}

/* ---------------------------------------------------------------------------
   HC-14  UB-45 / UB-43 (standard route)  fixed-ended rows of SN003a Table 3.2
   UB-45: UC 203x203x60, 6 m fixed-fixed, central point load, z_g = +105: C1 = 1.683, C2 = 1.645 (Iy 2060, J 47.2, Iw 0.197)
   UB-43: UB 406x140x39, 8 m fixed-fixed, UDL, z_g = +203: C1 = 2.578, C2 = 1.554 (Iy 410, J 10.7, Iw 0.155)
   --------------------------------------------------------------------------- */
log('\nHC-14  UB-45 / UB-43 standard Mcr with C2 zg (fixed-ended rows)');
{
  const cf = (Iz, It, Iw, L, C1, C2, zg) => { const T1 = PI * PI * E * Iz / (L * L), cz = C2 * zg; return C1 * T1 * (Math.sqrt(Iw / Iz + G * It / T1 + cz * cz) - cz) / 1e6; };
  const M45 = cf(2060e4, 47.2e4, 0.197e12, 6000, 1.683, 1.645, 105), M43 = cf(410e4, 10.7e4, 0.155e12, 8000, 2.578, 1.554, 203);
  log(`  UB-45: Mcr = ${M45.toFixed(2)} kN.m; UB-43: Mcr = ${M43.toFixed(2)} kN.m`);
  const e45 = engine('UB-45', 'standard', '(a,c)=>({Mcr:c.ltb.Mcr, C1:c.C1, C2:c.ltb.C2, used:c.ltb.zgUsed})');
  const e43 = engine('UB-43', 'standard', '(a,c)=>({Mcr:c.ltb.Mcr, C1:c.C1, C2:c.ltb.C2, used:c.ltb.zgUsed})');
  record('HC-14', 'UB-45 standard Mcr, fixed-ended central point load, C1 1.683 / C2 1.645, zg +105', M45, e45.Mcr, 'kN.m', `engine C1 ${e45.C1}, C2 ${e45.C2}, applied ${e45.used}`);
  record('HC-14b', 'UB-43 standard Mcr, fixed-ended UDL, C1 2.578 / C2 1.554, zg +203', M43, e43.Mcr, 'kN.m', `engine C1 ${e43.C1}, C2 ${e43.C2}, applied ${e43.used}`);
}

/* ---------------------------------------------------------------------------
   HC-15  UB-19 (standard route)  UB 254x102x22, 3 m cantilever, 10 kN tip load, root warping restrained, z_g = 0
   NCCI SN006a: Mcr = C x Mcr0, Mcr0 = (pi/L) sqrt(E Iz G It), kwt = sqrt(E Iw/(G It))/L,
   eta = zg/(hs/2) = 0. The factored self-weight (1.35 x 0.2158 kN/m) gives a root moment
   Mq = 1.311 kN.m = 2.8 % of the total (> the 2 % de-minimis), so the engine combines the
   Table 3.1 (q) and Table 3.2 (F) factors by SN006a Eq (7): C = (Mq + MF)/(Mq/Cq + MF/CF).
   row: ["254 x 102 x 22",...,Iy 119 cm4, J 4.15 cm4, Iw 0.0182 dm6, mass 22.0]
   Tables (js/01-computation-engine.js SN006, 'restr', eta = 0 column, kwt rows 0.3 and 0.4):
     F.restr: kwt 0.3 -> 2.35, kwt 0.4 -> 2.72;   q.restr: kwt 0.3 -> 4.57, kwt 0.4 -> 5.45
   --------------------------------------------------------------------------- */
log('\nHC-15  UB-19 SN006a cantilever Mcr (tip point load + self-weight, root warping restrained, eta = 0)');
{
  const Iz = 119e4, It = 4.15e4, Iw = 0.0182e12, L = 3000, mass = 22.0;
  const Mcr0 = PI / L * Math.sqrt(E * Iz * G * It) / 1e6;
  const kwt = Math.sqrt(E * Iw / (G * It)) / L;
  if (!(kwt >= 0.3 && kwt <= 0.4)) throw new Error('HC-15: kwt outside the quoted table rows');
  const f = (kwt - 0.3) / 0.1;
  const CF = 2.35 + (2.72 - 2.35) * f, Cq = 4.57 + (5.45 - 4.57) * f;
  const Mq = 1.35 * mass * 9.81 / 1000 * 3 * 3 / 2, MF = 1.5 * 10 * 3;
  const C = (Mq + MF) / (Mq / Cq + MF / CF);
  const Mcr = C * Mcr0;
  log(`  Mcr0 = (pi/L) sqrt(E Iz G It) = ${Mcr0.toFixed(3)} kN.m; kwt = ${kwt.toFixed(4)}; CF = 2.35 + 0.37 x ${f.toFixed(4)} = ${CF.toFixed(4)}; Cq = 4.57 + 0.88 x ${f.toFixed(4)} = ${Cq.toFixed(4)}`);
  log(`  Mq = ${Mq.toFixed(3)} kN.m (self-weight), MF = ${MF.toFixed(1)} kN.m; Eq (7): C = (${Mq.toFixed(3)} + 45)/(${Mq.toFixed(3)}/${Cq.toFixed(3)} + 45/${CF.toFixed(3)}) = ${C.toFixed(4)}; Mcr = ${Mcr.toFixed(2)} kN.m`);
  const e = engine('UB-19', 'standard', '(a,c)=>({Mcr:c.ltb.Mcr, C:c.ltb.C, kwt:c.ltb.kwt, eta:c.ltb.eta, Mcr0:c.ltb.Mcr0, Cq:c.ltb.Cq, CF:c.ltb.CF})');
  record('HC-15', 'UB-19 SN006a Mcr = C Mcr0, tip load + self-weight, warping restrained', Mcr, e.Mcr, 'kN.m', `engine C ${e.C.toFixed(4)} (Cq ${e.Cq.toFixed(3)}, CF ${e.CF.toFixed(3)}), kwt ${e.kwt.toFixed(4)}, eta ${e.eta}`);
  record('HC-15b', 'UB-19 Mcr0 = (pi/L) sqrt(E Iz G It)', Mcr0, e.Mcr0, 'kN.m');
  const eg = engine('UB-19', 'eigen', '(a,c)=>({Mcr:c.ltb.McrEigen, ratio:c.ltb.McrRatio})');
  log(`  eigen route: Mcr = ${eg.Mcr.toFixed(2)} kN.m, ratio eigen / SN006a = ${eg.ratio.toFixed(4)} (recorded, not a hand value)`);
}

/* ---------------------------------------------------------------------------
   HC-23  CUS-01 / UB-03  UB 305x165x40, 6 m SS, UDL 5 G + 6 Q: laterally clamped (R_z at both ends) against fork ends
   SN003a Eq (3) with the effective-length factors: Mcr = C1 pi^2 E Iz/(kL)^2 sqrt[(k/kw)^2 Iw/Iz + (kL)^2 G It/(pi^2 E Iz)]
   fork ends k = 1, C1 = 1.127 (Table 3.2, UDL); lateral bending v' = 0 at both ends k = 0.5, C1 = 0.972 (Table 3.2, k = 0.5
   column), kw = 1 (warping free). The hand value is the closed-form RATIO Mcr(k = 0.5)/Mcr(k = 1); the engine value is the
   ratio of the two eigenvalues. A difference of a few per cent is expected: the k = 0.5 column of SN003a is itself an
   approximation of the clamped boundary condition, so this is a METHOD difference, not an engine defect (both eigenvalues
   are also compared with their own closed forms below).
   --------------------------------------------------------------------------- */
log('\nHC-23  CUS-01 vs UB-03  laterally clamped ends against the SN003a k = 0.5 factor');
{
  const Iz = 764e4, It = 14.7e4, Iw = 0.164e12, L = 6000;
  const cf = (k, kw, C1) => C1 * PI * PI * E * Iz / Math.pow(k * L, 2) * Math.sqrt(Math.pow(k / kw, 2) * Iw / Iz + Math.pow(k * L, 2) * G * It / (PI * PI * E * Iz)) / 1e6;
  const Mfork = cf(1, 1, 1.127), Mclamp = cf(0.5, 1, 0.972), ratio = Mclamp / Mfork;
  log(`  fork ends (k = 1, C1 1.127): Mcr = ${Mfork.toFixed(2)} kN.m; clamped (k = 0.5, C1 0.972, kw = 1): Mcr = ${Mclamp.toFixed(2)} kN.m; ratio = ${ratio.toFixed(4)}`);
  const ef = engine('UB-03', 'eigen', '(a,c)=>c.ltb.Mcr'), ec = engine('CUS-01', 'eigen', '(a,c)=>c.ltb.Mcr');
  log(`  eigen: fork ${ef.toFixed(2)}, clamped ${ec.toFixed(2)} kN.m, ratio ${(ec / ef).toFixed(4)}`);
  record('HC-23', 'UB-03 fork-ended eigen Mcr against the SN003a k = 1 closed form', Mfork, ef, 'kN.m');
  record('HC-23b', 'CUS-01 laterally clamped eigen Mcr against the SN003a k = 0.5 closed form (method difference expected)', Mclamp, ec, 'kN.m', 'SN003a k = 0.5 column is an approximation of v\' = 0 at both ends', true);
  record('HC-23c', 'ratio Mcr(clamped)/Mcr(fork): SN003a k = 0.5 factor against the eigen ratio', ratio, ec / ef, '-', 'method difference, expected within a few per cent', true);
}

/* ===========================================================================
   E. Channel torsional-flexural buckling, high shear, A_eff
   =========================================================================== */

/* ---------------------------------------------------------------------------
   HC-18  TFB-01  PFC 200x90x30, 4 m SS, N = 80 kN, L_T = L_cr,z = 4 m
   EN 1993-1-1 6.3.1.4: i0^2 = iy^2 + iz^2 + y0^2; N_cr,T = (G I_T + pi^2 E I_w/L_T^2)/i0^2;
   N_cr,TF = (N_cr,y + N_cr,T)/(2 beta) [1 - sqrt(1 - 4 beta N_cr,y N_cr,T/(N_cr,y + N_cr,T)^2)], beta = 1 - (y0/i0)^2;
   lambda_T = sqrt(A fy/N_cr), curve c (alpha 0.49), N_b,T,Rd = chi A fy.
   row: ["200x90x30",...,Ix 2520, Iy 314, rx 8.16, ry 2.88 cm, ..., A 37.9 cm2]; TP385_PFC "200x90x30":[IT 19.1 cm4, a, Iw 0.0197 dm6, ..., e0 36, esc 63.7]
   --------------------------------------------------------------------------- */
log('\nHC-18  TFB-01  PFC 200x90x30 N_cr,T / N_cr,TF / N_b,T,Rd');
{
  const A = 37.9e2, Ix = 2520e4, iy = 81.6, iz = 28.8, y0 = 63.7, IT = 19.1e4, Iw = 0.0197e12, LT = 4000, Lcr = 4000, fy = 275;
  const i0sq = iy * iy + iz * iz + y0 * y0;
  const NcrT = (G * IT + PI * PI * E * Iw / (LT * LT)) / i0sq;
  const NcrY = PI * PI * E * Ix / (Lcr * Lcr);
  const beta = 1 - y0 * y0 / i0sq;
  const NcrTF = (NcrY + NcrT) / (2 * beta) * (1 - Math.sqrt(1 - 4 * beta * NcrY * NcrT / Math.pow(NcrY + NcrT, 2)));
  const Ncr = Math.min(NcrT, NcrTF), lamT = Math.sqrt(A * fy / Ncr);
  const Phi = 0.5 * (1 + 0.49 * (lamT - 0.2) + lamT * lamT), chiT = Math.min(1 / (Phi + Math.sqrt(Phi * Phi - lamT * lamT)), 1);
  const NbT = chiT * A * fy / 1000;
  log(`  i0^2 = ${iy}^2 + ${iz}^2 + ${y0}^2 = ${i0sq.toFixed(1)} mm2; G I_T = ${(G * IT).toExponential(4)}, pi^2 E I_w/L_T^2 = ${(PI * PI * E * Iw / (LT * LT)).toExponential(4)} N.mm2`);
  log(`  N_cr,T = ${(NcrT / 1000).toFixed(1)} kN; N_cr,y = ${(NcrY / 1000).toFixed(1)} kN; beta = ${beta.toFixed(4)}; N_cr,TF = ${(NcrTF / 1000).toFixed(1)} kN; lambda_T = ${lamT.toFixed(4)}; Phi = ${Phi.toFixed(4)}; chi_T = ${chiT.toFixed(4)}; N_b,T,Rd = ${NbT.toFixed(1)} kN; N_Ed/N_b,T,Rd = ${(80 / NbT).toFixed(4)}`);
  const e = engine('TFB-01', 'eigen', '(a,c)=>({NcrT:c.buck.tfb.NcrT, NcrTF:c.buck.tfb.NcrTF, NbT:c.buck.tfb.NbT, chiT:c.buck.tfb.chiT})');
  record('HC-18', 'TFB-01 N_cr,T', NcrT / 1000, e.NcrT, 'kN');
  record('HC-18b', 'TFB-01 N_cr,TF (coupled with the y-y mode)', NcrTF / 1000, e.NcrTF, 'kN');
  record('HC-18c', 'TFB-01 N_b,T,Rd (curve c)', NbT, e.NbT, 'kN', 'chi_T ' + chiT.toFixed(4) + ' vs ' + e.chiT.toFixed(4));
}

/* ---------------------------------------------------------------------------
   HC-19  HSV-04  RHS 300x100x10, 2 m SS, 470 kN (Q) at 0.3 m, high-shear M_v,Rd at the load
   V_pl,Rd = A_v fy/sqrt3 with A_v = A h/(b + h) (6.2.6(3)); at x = 0.3 m: V = 1.5 x 470 x 1.7/2 + self-weight part,
   M = 1.5 x 470 x 0.3 x 1.7/2 + self-weight part; rho = (2V/V_pl - 1)^2;
   M_v,y,Rd = (W_pl,y - rho t (h - 2t)^2/2) fy  (two webs).
   row: ["300 x 100 x 10.0",58.8,300,100,10,A 74.9,...,Sx 666 cm3, ...]
   --------------------------------------------------------------------------- */
log('\nHC-19  HSV-04  RHS 300x100x10 high-shear M_v,y,Rd at x = 0.3 m');
{
  const h = 300, b = 100, t = 10, A = 74.9e2, Sx = 666e3, fy = 275, mass = 58.8, L = 2, P = 1.5 * 470, xp = 0.3;
  const Av = A * h / (b + h), Vpl = Av * fy / Math.sqrt(3) / 1000;
  const sw = 1.35 * mass * 9.81 / 1000;
  const R1 = P * (L - xp) / L + sw * L / 2, V = R1 - sw * xp, M = R1 * xp - sw * xp * xp / 2;
  const rho = Math.pow(2 * V / Vpl - 1, 2);
  const Mv = (Sx - rho * t * Math.pow(h - 2 * t, 2) / 2) * fy / 1e6, Mc = Sx * fy / 1e6;
  log(`  A_v = A h/(b + h) = ${Av.toFixed(1)} mm2, V_pl,Rd = ${Vpl.toFixed(1)} kN; R1 = ${R1.toFixed(2)} kN, V(0.3) = ${V.toFixed(2)} kN, M(0.3) = ${M.toFixed(2)} kN.m; rho = (2 x ${V.toFixed(1)}/${Vpl.toFixed(1)} - 1)^2 = ${rho.toFixed(4)}`);
  log(`  M_c,Rd = ${Mc.toFixed(2)}; M_v,y,Rd = (${Sx} - ${rho.toFixed(4)} x 10 x 280^2/2) x 275 = ${Mv.toFixed(2)} kN.m; M/M_v = ${(M / Mv).toFixed(4)}`);
  const e = engine('HSV-04', 'eigen', '(a,c)=>({MvRd:c.coex.MvRd, V:c.coex.V, M:c.coex.M, rho:c.coex.rho, u:c.coex.u, Vpl:c.VcRd})');
  record('HC-19', 'HSV-04 M_v,y,Rd (RHS two-web form) at x = 0.3 m', Mv, e.MvRd, 'kN.m', `V ${V.toFixed(1)} vs ${e.V.toFixed(1)}, rho ${rho.toFixed(4)} vs ${e.rho.toFixed(4)}`);
  record('HC-19b', 'HSV-04 V_pl,Rd (A_v = A h/(b + h))', Vpl, e.Vpl, 'kN');
  record('HC-19c', 'HSV-04 M/M_v,y,Rd', M / Mv, e.u, '-');
}

/* ---------------------------------------------------------------------------
   HC-20  AEF-01  UB 1016x305x222, S275 (tf 21.1 -> fy 265), N = 1500 kN
   EN 1993-1-5 4.4, internal element psi = 1, k_sigma = 4:
   lambda_p = (d/t)/(28.4 eps x 2), rho = (lambda_p - 0.22)/lambda_p^2, A_eff = A - (1 - rho) d tw
   row: ["1016 x 305 x 222",222.0,970.3,300.0,16.0,21.1,30.0,868.1,5.31,54.3,...,A 283 cm2]
   --------------------------------------------------------------------------- */
log('\nHC-20  AEF-01  A_eff of the Class-4 web, UB 1016x305x222');
{
  const d = 868.1, tw = 16.0, dt = 54.3, A = 283e2, fy = 265;
  const eps = Math.sqrt(235 / fy);
  const lamP = dt / (28.4 * eps * 2), rho = (lamP - 0.055 * 4) / (lamP * lamP);
  const Aeff = A - (1 - rho) * d * tw;
  log(`  eps = ${eps.toFixed(4)}, 42 eps = ${(42 * eps).toFixed(2)} < d/t ${dt}; lambda_p = ${dt}/(28.4 x ${eps.toFixed(4)} x 2) = ${lamP.toFixed(4)}; rho = (${lamP.toFixed(4)} - 0.22)/${lamP.toFixed(4)}^2 = ${rho.toFixed(4)}; A_eff = ${A} - ${(1 - rho).toFixed(4)} x ${d} x ${tw} = ${Aeff.toFixed(1)} mm2 (${(Aeff / A).toFixed(4)} A); N_c,Rd = ${(Aeff * fy / 1000).toFixed(1)} kN`);
  const e = engine('AEF-01', 'eigen', '(a,c)=>({Aeff:c.aeff.Aeff, rho:c.aeff.rho, NcRd:c.utils.find(u=>/^Compression/.test(u.name)).val})');
  record('HC-20', 'AEF-01 A_eff (EN 1993-1-5 4.4)', Aeff, e.Aeff, 'mm2', 'rho ' + rho.toFixed(4) + ' vs ' + e.rho.toFixed(4));
  record('HC-20b', 'AEF-01 N_Ed/N_c,Rd with A_eff', 1500 / (Aeff * fy / 1000), e.NcRd, '-');
}

/* ===========================================================================
   F. Warping torsion (Vlasov closed forms)
   =========================================================================== */

/* ---------------------------------------------------------------------------
   HC-21  UB-49 / TOR-07  UB 457x191x82, 4 m cantilever, 20 kN (Q) at the tip at e = 80 mm, tip torque T = 1.5 x 20 x 80 = 2400 kN.mm
   root warping fixed (UB-49): phi(L) = (T/G I_T)[L - a tanh(L/a)], a = sqrt(E I_w/G I_T); B(0) = T a tanh(L/a)
   root warping free (TOR-07): the Vlasov solution is pure St Venant, phi(L) = TL/(G I_T), B = 0 everywhere
   TP385_UB "457 x 191 x 82":[IT 69.2 cm4, a 1.86 m, Iw 0.922 dm6, ...]
   --------------------------------------------------------------------------- */
log('\nHC-21  UB-49 / TOR-07  warping-torsion cantilever: tip twist and root bimoment, warping fixed and free');
{
  const IT = 69.2e4, Iw = 0.922e12, L = 4000, T = 1.5 * 20 * 1000 * 80;
  const GIt = G * IT, EIw = E * Iw, a = Math.sqrt(EIw / GIt);
  const phi = T / GIt * (L - a * Math.tanh(L / a)), B0 = T * a * Math.tanh(L / a), phiFree = T * L / GIt;
  log(`  G I_T = ${GIt.toExponential(4)} N.mm2, E I_w = ${EIw.toExponential(4)} N.mm4, a = ${a.toFixed(2)} mm (P385 Table: 1.86 m), L/a = ${(L / a).toFixed(4)}, tanh = ${Math.tanh(L / a).toFixed(5)}`);
  log(`  warping fixed: phi(L) = ${(T / GIt).toExponential(4)} x (4000 - ${(a * Math.tanh(L / a)).toFixed(2)}) = ${phi.toFixed(5)} rad; B(0) = ${(B0 / 1e9).toFixed(4)} kN.m2; warping free: phi(L) = TL/GI_T = ${phiFree.toFixed(5)} rad`);
  const e = engine('UB-49', 'eigen', '(a,c)=>({phi:c.tor.phiUmax, B:c.tor.BMax, mesh:c.tor.meshError})');
  record('HC-21', 'UB-49 cantilever tip twist phi(L), tip torque, root warping fixed', phi, e.phi, 'rad', 'mesh error ' + e.mesh.toExponential(2));
  record('HC-21b', 'UB-49 root bimoment B(0) = T a tanh(L/a)', B0 / 1e9, e.B, 'kN.m2');
  const f = engine('TOR-07', 'eigen', '(a,c)=>({phi:c.tor.phiUmax, B:c.tor.BMax, mesh:c.tor.meshError, Tt:c.tor.TtEnds[0], blocked:c.unsupported.some(m=>/mesh has not converged/.test(m))})');
  record('HC-21c', 'TOR-07 cantilever tip twist, root warping FREE: phi(L) = TL/GI_T (St Venant)', phiFree, f.phi, 'rad', `B_max ${f.B.toExponential(2)} kN.m2 (noise), root T_t ${f.Tt.toFixed(4)} kN.m = T; engine mesh measure ${(f.mesh * 100).toFixed(1)} % blocks PASS: ${f.blocked} (finding: the relative change of a vanishing bimoment)`);
}

/* ---------------------------------------------------------------------------
   HC-22  TOR-05 / UB-51  distributed torques
   TOR-05: UB 305x165x40, 3 m cantilever, UDL 3 G + 5 Q at e = 80 mm, uniform torque m = (1.35 x 3 + 1.5 x 5) x 80 = 924 N.mm/mm;
   root warping fixed, tip free: solving E I_w phi'''' - G I_T phi'' = m with phi(0) = phi'(0) = 0, B(L) = 0, T(L) = 0 gives
   phi(L) = (m/G I_T)[L^2/2 + a^2 (1 - sech(L/a)) - a L tanh(L/a)]  (derivation in hand-checks.md)  TP385_UB "305 x 165 x 40":[IT 14.7, a 1.7 m, Iw 0.164]
   UB-51: UB 457x191x82, 8 m SS, UDL 5 G + 8 Q at e = 100 mm, both ends warping-fixed, t = (1.35 x 5 + 1.5 x 8) x 100 = 1875 N.mm/mm:
   phi(L/2) = (t/G I_T)[L^2/8 - (L a/2) tanh(L/(4a))]
   --------------------------------------------------------------------------- */
log('\nHC-22  TOR-05 / UB-51  cantilever under a uniform torque; warping-fixed ends under a uniform torque');
{
  const IT = 14.7e4, Iw = 0.164e12, L = 3000, m = (1.35 * 3 + 1.5 * 5) * 80;
  const GIt = G * IT, a = Math.sqrt(E * Iw / GIt), X = L / a;
  const phi = m / GIt * (L * L / 2 + a * a * (1 - 1 / Math.cosh(X)) - a * L * Math.tanh(X));
  log(`  TOR-05: m = ${m} N.mm/mm; G I_T = ${GIt.toExponential(4)}; a = ${a.toFixed(2)} mm; L/a = ${X.toFixed(4)}; phi(L) = ${phi.toFixed(5)} rad (St Venant only: ${(m / GIt * L * L / 2).toFixed(4)} rad)`);
  const e = engine('TOR-05', 'eigen', '(a,c)=>({phi:c.tor.phiUmax, mesh:c.tor.meshError, T0:c.tor.TEnds[0]})');
  record('HC-22', 'TOR-05 cantilever tip twist, uniform torque', phi, e.phi, 'rad', 'mesh error ' + e.mesh.toExponential(2));
  record('HC-22b', 'TOR-05 root torque m L', m * L / 1e6, Math.abs(e.T0), 'kN.m');
  const IT2 = 69.2e4, Iw2 = 0.922e12, L2 = 8000, t = (1.35 * 5 + 1.5 * 8) * 100;
  const GIt2 = G * IT2, a2 = Math.sqrt(E * Iw2 / GIt2);
  const phi2 = t / GIt2 * (L2 * L2 / 8 - L2 * a2 / 2 * Math.tanh(L2 / (4 * a2)));
  const phiFork = t * a2 * a2 / GIt2 * (L2 * L2 / (8 * a2 * a2) + 1 / Math.cosh(L2 / (2 * a2)) - 1);
  log(`  UB-51: t = ${t} N.mm/mm; a = ${a2.toFixed(2)} mm; L/(4a) = ${(L2 / (4 * a2)).toFixed(4)}; phi(L/2) = ${phi2.toFixed(5)} rad (fork ends: ${phiFork.toFixed(4)} rad)`);
  const e2 = engine('UB-51', 'eigen', '(a,c)=>({phi:c.tor.phiUmax, mesh:c.tor.meshError})');
  record('HC-22c', 'UB-51 mid-span twist, warping-fixed ends', phi2, e2.phi, 'rad', 'mesh error ' + e2.mesh.toExponential(2));
}

// ---------------------------------------------------------------------------
log('\n\n| # | Case / quantity | Hand value | Engine value | Diff % |');
log('|---|---|---|---|---|');
rows.forEach(r => log(`| ${r.id} | ${r.what} | ${r.hand.toPrecision(6)} ${r.unit} | ${r.eng.toPrecision(6)} ${r.unit} | ${r.d >= 0 ? '+' : ''}${r.d.toFixed(3)}${Math.abs(r.d) > 1 ? (r.expectedFinding ? ' (FINDING, expected)' : ' (FINDING)') : ''} |`));
const findings = rows.filter(r => Math.abs(r.d) > 1);
const unexpected = findings.filter(r => !r.expectedFinding);
log(`\n${rows.length} comparisons, ${findings.length} above 1 % (${unexpected.length} unexpected, ${findings.length - unexpected.length} expected and explained in hand-checks.md)`);
process.exitCode = unexpected.length ? 1 : 0;
