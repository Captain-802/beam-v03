'use strict';
/* ===========================================================================
   Headless batch runner - single-span verification campaign
   ---------------------------------------------------------------------------
   Loads the app through tests/harness.cjs (Node vm, no DOM), runs analyse()
   and checks() for every case in tests/batch/cases.cjs (single span, End 1 /
   End 2 degree-of-freedom flags, 19 Sep 2026 scope) - both Mcr methods
   ('eigen' and 'standard') when restraint === 'ltb' - and writes
     tests/batch/results.json   full records
     tests/batch/results.md     one row per run + summary tables
   Thrown errors are caught and reported as verdict ERROR, except for the
   cases that declare `expectError`: those must throw a message containing
   the declared text (verdict THROWS when they do; a case that runs, or throws
   something else, is a failure that sets the exit code).

   Independent cross-checks (computed here from the section data and the
   inputs, never from the check engine's own intermediate values):
     (i)   closed forms of the six presets for Mmax, dmax, the end moments and
           the End 1 reaction (full-span UDL incl. self-weight, one central
           point load, or a point load at the free / guided tip): simply
           supported, fixed-fixed, fixed-pinned, cantilever, guided-fixed,
           pinned-guided; dmax from the sampled sum of the deflection curves
     (ii)  vertical equilibrium  sum(R) + sum(applied) = 0  for every case
     (iii) standard closed-form Mcr recomputed for doubly symmetric sections
           (I/H and box: SN003a with G = 81000, Iw = 0 for a box; cantilever:
           SN006a C*Mcr0) with C1, C2, z_g and LE derived HERE from the case
           inputs (load list, end flags, za / per-load zg, LE factor and
           destabilising switch) and the analysis moment diagram - never from
           the engine's own C1 / C2 / zgUsed / LE; also checks that a
           destabilising z_g on a non-tabulated diagram is BLOCKED
     (iv)  eigen / standard Mcr ratio, flagged outside 0.85-1.25 (an outlier,
           not necessarily an error; the reason is tabulated)
     (v)   Mb,Rd <= Mc,Rd
     (vi)  the reported governing utilisation equals the maximum of the
           printed utilisations
     (vii)-(xv) uplift, web bearing (F_Rd and the station moment at a fixed
           end), A_eff, channel N_b,T,Rd, k_c floor, cl 6.2.10, warping-
           torsion FE closed forms, high-shear M_v,Rd
     (xvi) end-restraint bounds: a case declaring `pair` must give an eigen
           Mcr >= that of its base case (R_z both ends, warping fixed both
           ends, root warping on a lateral cantilever); the SN003a k = 0.5 /
           k_w = 0.5 ratio is recorded beside the eigen ratio
     (xvii) cantilevers: the ratio Mcr,eigen / Mcr,SN006a is recorded
   Mismatches beyond 0.5 % are flagged as check failures.

   Usage:  node tests/batch/run-batch.cjs [id-substring ...]
   =========================================================================== */
const fs = require('node:fs');
const path = require('node:path');
const { app } = require('../harness.cjs');
const { cases } = require('./cases.cjs');

const TOL = 0.005;                       // 0.5 % relative tolerance for the cross-checks
const RATIO_LO = 0.85, RATIO_HI = 1.25;  // eigen / standard Mcr band
const G_STEEL = 81000;                   // N/mm2 (SN003a / P385)

const filter = process.argv.slice(2).filter(a => !a.startsWith('--'));
const selected = filter.length ? cases.filter(c => filter.some(f => c.id.includes(f))) : cases;

const ctx = app();

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
const num = v => (typeof v === 'number' && Number.isFinite(v)) ? v : null;
const rel = (a, b) => Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1e-9);
const stripHtml = s => String(s).replace(/<[^>]+>/g, '').replace(/&[a-z]+;|&#\d+;/g, m => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&ndash;': '-', '&mdash;': '-', '&times;': 'x', '&middot;': '.', '&plusmn;': '+/-', '&deg;': 'deg', '&psi;': 'psi', '&mu;': 'mu', '&lambda;': 'lambda', '&chi;': 'chi', '&alpha;': 'alpha', '&Phi;': 'Phi', '&radic;': 'sqrt', '&sup2;': '^2', '&sup3;': '^3', '&prime;': "'", '&le;': '<=', '&ge;': '>=', '&minus;': '-', '&bull;': '*', '&rsquo;': "'", '&#772;': '' }[m] || ''));
const fmt = (v, d = 3) => (v == null || !Number.isFinite(v)) ? '-' : (Math.abs(v) >= 1e5 ? v.toExponential(2) : (+v).toFixed(d));
const mdEsc = s => String(s).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

function sectionLabel(o) {
  if (o.family === 'ub') return 'UB ' + o.ubKey.replace(/ /g, '');
  if (o.family === 'uc') return 'UC ' + o.ucKey.replace(/ /g, '');
  if (o.family === 'pfc') return 'PFC ' + o.sectionKey;
  if (o.family === 'shs') return 'SHS ' + o.shsKey + ' ' + (o.shsType || 'HF');
  if (o.family === 'rhs') return 'RHS ' + o.rhsKey.replace(/ /g, '');
  return o.family;
}

/* SN003a closed form, doubly symmetric, k = kw = 1, G = 81000 - computed here
   from the raw section table values so it is independent of the engine. */
function mcrClosedFormIndependent(sec, E, LE, C1, C2, zg, zgUsed) {
  const Iz = sec.Iy * 1e4, It = sec.J * 1e4, Iw = (sec.Iw || 0) * 1e12;
  const T1 = Math.PI * Math.PI * E * Iz / (LE * LE);
  const zgTerm = (zgUsed && C2 != null && C2 > 0) ? C2 * zg : 0;
  return C1 * T1 * (Math.sqrt(Math.max(Iw / Iz + G_STEEL * It / T1 + zgTerm * zgTerm, 0)) - zgTerm) / 1e6; // kN.m
}
/* In-plane support list of a case's ends, derived here from the DOF flags
   (U_z + R_y = fixed, U_z = pinned, R_y = guided, neither = absent) so the
   cross-checks stay independent of the engine's own endsToSupports(). */
function endSupports(o) {
  return [['e1', 0, 1], ['e2', o.L, 2]].map(([k, x, n]) => {
    const e = (o.ends || {})[k] || {};
    const type = e.uz && e.ry ? 'fixed' : e.uz ? 'pinned' : e.ry ? 'guided' : null;
    return type ? { end: n, pos: x, type, ss: e.ss, stiff: !!e.stiff, holdDown: !!e.holdDown, warpFix: !!e.warp, rx: !!e.rx, uy: !!e.uy } : null;
  }).filter(Boolean);
}
const endOf = (o, n) => ((o.ends || {})['e' + n] || {});
const isCantCase = o => { const e1 = endOf(o, 1), e2 = endOf(o, 2); return !!(e1.uz && e1.ry && !e2.uz && !e2.ry); };
const interp = (xs, ys, xq) => {
  if (xq <= xs[0]) return ys[0];
  if (xq >= xs[xs.length - 1]) return ys[ys.length - 1];
  for (let i = 0; i < xs.length - 1; i++) if (xq >= xs[i] && xq <= xs[i + 1]) { const t = xs[i + 1] === xs[i] ? 0 : (xq - xs[i]) / (xs[i + 1] - xs[i]); return ys[i] + (ys[i + 1] - ys[i]) * t; }
  return ys[ys.length - 1];
};
/* Closed-form inputs derived from the CASE and the analysis diagram of one
   combination (factors fac, diagram fb over [xa, xb] mm), independently of the
   check engine:
     shape  - from the case's load list: only applied couples -> 'end-moment'
              (SCI curve C1 = (1.33 - 0.33 psi)^2, psi = smaller/larger end
              moment); full-span UDL family only / central point load(s) only,
              no applied couples, on a simply supported (end moments < 2 % of
              Mmax) or fixed-ended whole member -> SN003a Table 3.2 rows
              (1.127/0.454, 1.348/0.630, 2.578/1.554, 1.683/1.645); otherwise
              Serna's quarter-point expression, C2 unpublished
     zg     - most destabilising signed height of the loads active in the
              combination: per-load zg when eccOn (else za), sign reversed for
              an upward load; za when no transverse load is active
     LE     - leFactor (blank = 1) x (destab ? 1.2 : 1) x segment length
   Returns {C1, C2, zg, zgApplied, LE, route, blockExpected}. */
function stdInputsIndependent(o, fac, fb, xa, xb) {
  const L = o.L, Lmm = L * 1000, whole = xa <= 1e-6 && Math.abs(xb - Lmm) <= 1e-6;
  const loads = o.loads;
  const e1 = endOf(o, 1), e2 = endOf(o, 2);
  const endSupported = !!(e1.uz && e2.uz), endFixed = !!(e1.uz && e2.uz && e1.ry && e2.ry);
  const interior = (o.hinges || []).some(h => h.pos * 1000 > xa + 1e-6 && h.pos * 1000 < xb - 1e-6);
  let nUdl = 0, nPoint = 0, nCentral = 0, nOther = 0, nMom = 0, zgBest = null;
  for (const ld of loads) {
    const f = fac[ld.case] || 0; if (!f) continue;
    if (ld.type === 'moment') { if (ld.M) nMom++; continue; }
    const mag = ld.type === 'point' ? ld.P : ld.type === 'trap' ? (ld.w1 + ld.w2) / 2 : ld.w;
    if (!mag) continue;
    const z0 = (o.eccOn && ld.zg != null) ? ld.zg : (o.za || 0);
    const zg = mag * f < 0 ? -z0 : z0;
    if (zgBest == null || zg > zgBest) zgBest = zg;
    if (ld.type === 'point') { nPoint++; if (Math.abs(ld.pos - L / 2) <= 0.01 * L) nCentral++; }
    else if ((ld.type === 'udl' || (ld.type === 'trap' && ld.w1 === ld.w2)) && ld.x1 === 0 && Math.abs(ld.x2 - L) < 1e-9) nUdl++;
    else nOther++;
  }
  const zg = zgBest == null ? (o.za || 0) : zgBest;
  const Mat = x => interp(fb.xs, fb.M, x) / 1e6;
  // interior stations (quarter points, mid-span) on a diagram with a jump (in-span couple): the larger side ordinate,
  // the envelope convention of the closed-form C1 expressions (19 Sep 2026 campaign finding, UB-27)
  const Mst = x => { const l = interp(fb.xs, fb.M, Math.max(x - 1e-3, xa)) / 1e6, rr = interp(fb.xs, fb.M, Math.min(x + 1e-3, xb)) / 1e6; return Math.abs(l) >= Math.abs(rr) ? l : rr; };
  let Mm = 0; fb.xs.forEach((x, i) => { if (x >= xa - 1e-6 && x <= xb + 1e-6) Mm = Math.max(Mm, Math.abs(fb.M[i]) / 1e6); });
  const Ls = xb - xa, M0 = Mat(xa + 1e-4), ML = Mat(xb - 1e-4);
  const endLevel = Mm > 1e-9 ? Math.max(Math.abs(M0), Math.abs(ML)) / Mm : 0;
  const r = Mm > 1e-9 ? (Math.abs(Mst(xa + Ls / 4)) + Math.abs(Mst(xa + 3 * Ls / 4))) / (2 * Mm) : 0;
  let C1, C2 = null, route;
  const notLoaded = nUdl + nPoint + nOther === 0;
  const isLinear = fb.xs.every((x, i) => x < xa + 1e-4 || x > xb - 1e-4 || Math.abs(fb.M[i] / 1e6 - (M0 + (ML - M0) * (x - xa) / Ls)) <= 0.05 * Mm);
  const isCant = isCantCase(o);
  if (o.C1o != null) { C1 = o.C1o; route = 'override'; }
  else if (isCant) { C1 = 1; route = 'cantilever'; }   // box cantilever: the closed form keeps C1 = 1 (I/H cantilevers take SN006a, checked above)
  else if (Mm < 1e-9) { C1 = 1; C2 = 0; route = 'negligible'; }
  else if (endLevel > 0.98 && (notLoaded || isLinear)) {
    const [Mlo, Mhi] = Math.abs(ML) >= Math.abs(M0) ? [M0, ML] : [ML, M0];
    const psi = Math.abs(Mhi) > 1e-9 ? Math.max(-1, Math.min(1, Mlo / Mhi)) : 1;
    C1 = Math.pow(1.33 - 0.33 * psi, 2); C2 = 0; route = 'end-moment';
  }
  else if (whole && endSupported && !interior && !endFixed && endLevel < 0.02 && nMom === 0 && nUdl > 0 && nPoint === 0 && nOther === 0 && Math.abs(r - 0.75) <= 0.02) { C1 = 1.127; C2 = 0.454; route = 'uniform'; }
  else if (whole && endSupported && !interior && !endFixed && endLevel < 0.02 && nMom === 0 && nPoint > 0 && nCentral === nPoint && nUdl === 0 && nOther === 0 && Math.abs(r - 0.50) <= 0.02) { C1 = 1.348; C2 = 0.630; route = 'point'; }
  else if (whole && endFixed && !interior && nMom === 0 && nUdl > 0 && nPoint === 0 && nOther === 0) { C1 = 2.578; C2 = 1.554; route = 'fixed-uniform'; }
  else if (whole && endFixed && !interior && nMom === 0 && nPoint > 0 && nCentral === nPoint && nUdl === 0 && nOther === 0) { C1 = 1.683; C2 = 1.645; route = 'fixed-point'; }
  else {
    const M2 = Mst(xa + Ls / 4), M3 = Mst(xa + Ls / 2), M4 = Mst(xa + 3 * Ls / 4);
    const d = Mm * Mm + 9 * M2 * M2 + 16 * M3 * M3 + 9 * M4 * M4;
    C1 = d > 0 ? Math.sqrt(35 * Mm * Mm / d) : 1; route = 'serna';
  }
  const LE = (o.leFactor != null ? o.leFactor : 1) * (o.destab ? 1.2 : 1) * Ls;
  const zgApplied = Math.abs(zg) > 1e-9 && C2 != null && C2 > 0;
  return { C1, C2, zg, zgApplied, LE, route, blockExpected: zg > 0 && !(C2 > 0) && !o.destab };
}

/* In-plane type of one end from its flags (runner's own reading). */
const endTypeOf = e => e.uz && e.ry ? 'fixed' : e.uz ? 'pinned' : e.ry ? 'guided' : 'free';
/* Applicability of the preset closed forms (i). Returns null or {kind, udl:
   sum of full-span w by case, point: sum of P by case, xP}: kind is one of
   'ss' | 'fixfix' | 'propped' (End 1 fixed, End 2 pinned) | 'cant' |
   'guided-fixed' (End 1 fixed, End 2 guided) | 'pinned-guided'; the point
   loads sit at mid-span (ss, fixfix, propped) or at the End 2 tip (cant,
   guided-fixed, pinned-guided); no hinges, no couples, no partial loads. */
function closedFormLayout(o) {
  const L = o.L, loads = o.loads;
  if ((o.hinges || []).length) return null;
  const t1 = endTypeOf(endOf(o, 1)), t2 = endTypeOf(endOf(o, 2));
  const kind = t1 === 'pinned' && t2 === 'pinned' ? 'ss' : t1 === 'fixed' && t2 === 'fixed' ? 'fixfix' : t1 === 'fixed' && t2 === 'pinned' ? 'propped'
    : t1 === 'fixed' && t2 === 'free' ? 'cant' : t1 === 'fixed' && t2 === 'guided' ? 'guided-fixed' : t1 === 'pinned' && t2 === 'guided' ? 'pinned-guided' : null;
  if (!kind) return null;
  const tip = kind === 'cant' || kind === 'guided-fixed' || kind === 'pinned-guided';
  const xP = tip ? L : L / 2;
  const udl = {}, point = {};
  for (const ld of loads) {
    if (ld.type === 'udl' && ld.x1 === 0 && Math.abs(ld.x2 - L) < 1e-9) udl[ld.case] = (udl[ld.case] || 0) + ld.w;
    else if (ld.type === 'point' && Math.abs(ld.pos - xP) < 1e-9) point[ld.case] = (point[ld.case] || 0) + ld.P;   // several loads (G, Q) at the one position are summed
    else return null;
  }
  return { kind, udl, point, xP };
}
/* Closed-form maximum moment (kN.m), end moments [M1, M2] (kN.m, absolute),
   End 1 reaction (kN) and the deflection maximum (mm) of one preset under a
   full-span UDL w (kN/m = N/mm) plus a point load P (kN) at mid-span / the
   tip. L in m for the moments, Lmm / EI (N.mm2) for the deflections. Standard
   textbook forms (Roark / SCI P363 / AISC): the guided cases are the halves
   of a fixed-fixed or simply supported beam of span 2L by symmetry, the
   propped-cantilever curves are quoted with x from the pinned end; dmax is
   the sampled maximum of the summed curves (2001 stations). */
function closedFormsFor(kind, w, Pk, L, Lmm, EI) {
  const P = Pk * 1000;   // N
  const M = { ss: w * L * L / 8 + Pk * L / 4, fixfix: w * L * L / 12 + Pk * L / 8, propped: w * L * L / 8 + 3 * Pk * L / 16,
    cant: w * L * L / 2 + Pk * L, 'guided-fixed': w * L * L / 3 + Pk * L / 2, 'pinned-guided': w * L * L / 2 + Pk * L }[kind];
  const Mend = { ss: [0, 0], fixfix: [w * L * L / 12 + Pk * L / 8, w * L * L / 12 + Pk * L / 8], propped: [w * L * L / 8 + 3 * Pk * L / 16, 0],
    cant: [w * L * L / 2 + Pk * L, 0], 'guided-fixed': [w * L * L / 3 + Pk * L / 2, w * L * L / 6 + Pk * L / 2], 'pinned-guided': [0, w * L * L / 2 + Pk * L] }[kind];
  const R1 = { ss: w * L / 2 + Pk / 2, fixfix: w * L / 2 + Pk / 2, propped: 5 * w * L / 8 + 11 * Pk / 16, cant: w * L + Pk, 'guided-fixed': w * L + Pk, 'pinned-guided': w * L + Pk }[kind];
  const d = x => {
    const Lm = Lmm, xm = Math.min(x, Lm - x);
    switch (kind) {
      case 'ss': return (w * x * (Lm ** 3 - 2 * Lm * x * x + x ** 3) / 24 + P * xm * (3 * Lm * Lm - 4 * xm * xm) / 48) / EI;
      case 'fixfix': return (w * x * x * (Lm - x) ** 2 / 24 + P * xm * xm * (3 * Lm - 4 * xm) / 48) / EI;
      case 'propped': { const xi = Lm - x; const dP = xi <= Lm / 2 ? P * xi * (3 * Lm * Lm - 5 * xi * xi) / 96 : P * (xi - Lm) ** 2 * (11 * xi - 2 * Lm) / 96;
        return (w * xi * (Lm ** 3 - 3 * Lm * xi * xi + 2 * xi ** 3) / 48 + dP) / EI; }
      case 'cant': return (w * x * x * (6 * Lm * Lm - 4 * Lm * x + x * x) / 24 + P * x * x * (3 * Lm - x) / 6) / EI;
      case 'guided-fixed': return (w * x * x * (2 * Lm - x) ** 2 / 24 + P * x * x * (3 * Lm - 2 * x) / 12) / EI;
      case 'pinned-guided': return (w * x * (8 * Lm ** 3 - 4 * Lm * x * x + x ** 3) / 24 + P * x * (3 * Lm * Lm - x * x) / 6) / EI;
    }
    return 0;
  };
  let dmax = 0; for (let i = 0; i <= 2000; i++) dmax = Math.max(dmax, Math.abs(d(Lmm * i / 2000)));
  return { M, Mend, R1, dmax };
}
/* Why an eigen / standard Mcr ratio can legitimately leave the 0.85-1.25
   band (tabulated beside every outlier). */
function outlierReason(rec, o) {
  const e1 = endOf(o, 1), e2 = endOf(o, 2), r = [];
  if (isCantCase(o)) r.push(o.family === 'ub' || o.family === 'uc' ? 'cantilever: SN006a (C x Mcr0 with the root warping condition and eta) against the eigenvalue of the actual root DOFs' : 'cantilever of a box / channel: closed form with C1 = 1 (kappa chain for a channel) against the eigenvalue');
  if (o.destab) r.push('destabilising L_E x 1.2 device on the closed form (the eigenvalue carries z_g exactly)');
  if (rec.zgStdBlocked) r.push('C2 unpublished for this diagram: closed form at the shear centre, PASS refused on the standard route');
  if ((o.hinges || []).length) r.push('internal hinge: closed form takes the whole member as one fork-ended segment (Serna C1 on the released diagram)');
  if ((e1.rz && e1.uy) || (e2.rz && e2.uy)) r.push('laterally clamped end(s) (R_z held): closed form keeps k = 1');
  if (e1.warp || e2.warp) r.push(o.family === 'shs' || o.family === 'rhs' ? 'warping flag on a box (I_w = 0): not a boundary condition, not applied by either route (F-E)' : 'warping-fixed end(s): closed form keeps k_w = 1');
  if ((e1.ry && !e1.uz) || (e2.ry && !e2.uz)) r.push('guided end: closed form on the whole member (Serna C1) with fork ends');
  if (!isCantCase(o) && ((e1.uy && !e1.rx) || (e2.uy && !e2.rx) || !e1.uy || !e2.uy)) r.push('an end with U_y or R_x released: the closed form assumes fork ends at both ends (unconservative side) - refused on the standard route (NOT VERIFIED) since the 19 Sep 2026 review fix F-C; the printed fork-ended value is the comparison');
  if ((o.ltbRestraints || []).length) r.push('intermediate restraints: the comparison isolates the governing bay with fork ends');
  if (o.family === 'pfc') r.push('channel kappa chain (L/i_z)/kappa against the shear-centre eigenvalue');
  return r.length ? r.join('; ') : 'see mcr-method-comparison.md';
}

/* Observed triggers derived from the check output (checkable subset only). */
function observedTriggers(a, c, o) {
  const t = new Set(['1.3', '1.9', '2.1', '2.3', '2.16', '3.19']);
  if (a.tors && a.tors.on) ['1.1', '2.6', '2.7', '2.8', '3.21'].forEach(x => t.add(x));
  // c.ax also exists for an Mz-only case (cross-section biaxial block); 2.11 needs an axial force
  if (c.ax && Math.abs(c.F || 0) > 1e-9) t.add('2.11');
  if (c.ax && c.ax.biax) { t.add('2.12'); t.add('3.20'); }
  if (c.ax && c.ax.tension) t.add('2.25');
  if (c.annex) t.add('3.8');
  if (c.buck && c.buck.Fc > 1e-9) t.add('3.9');
  if ((c.utils || []).some(u => /Member buckling/.test(u.name))) t.add('3.12');
  if ((c.unsupported || []).some(s => /torsional-flexural/i.test(s)) || (c.buck && c.buck.tfb && c.buck.tfb.ok)) t.add('3.10');   // G3: evaluated (cl 6.3.1.4) or blocked
  if (c.ltb) { ['3.1', '3.2', '3.3', '3.6'].forEach(x => t.add(x)); if (o.family === 'ub' || o.family === 'uc') t.add('3.5'); else t.add('3.4'); }
  else t.add('3.1');
  if ((o.ltbRestraints || []).length) t.add('3.17');
  if (c.web && c.web.checked) t.add('2.18');
  if (c.coex || c.hsNote) t.add('2.10');
  if (c.sbOk === false) t.add('2.5');
  return [...t];
}
const COMPARABLE = new Set(['2.6', '2.11', '2.12', '2.25', '3.8', '3.9', '3.12', '3.10', '3.6', '3.17', '2.5']);

// ---------------------------------------------------------------------------
// one run = one case x one Mcr method
// ---------------------------------------------------------------------------
function runOne(cs, method) {
  const o = JSON.parse(JSON.stringify(cs.overrides));
  o.mcrMethod = method;
  ctx.reset(o);
  const t0 = process.hrtime.bigint();
  const rec = { id: cs.id, title: cs.title, section: sectionLabel(o), family: o.family, restraint: o.restraint, method, expect: cs.expect, tags: cs.tags };
  let out;
  try {
    out = ctx.run(`(()=>{
      const a=analyse(); const c=checks(a);
      const gl=comboLoads(a.governM.combo);
      return {a,c,gl,sec:a.sec,sw:selfWeightValue(a.sec),E:a.E,py:a.py,za:(+S.za||0),
        gM:a.governM.combo.factors, gD:a.governD.combo.factors, gLabel:a.governM.combo.label};
    })()`);
  } catch (e) {
    rec.error = stripHtml(e && e.message ? e.message : e);
    rec.ms = Number(process.hrtime.bigint() - t0) / 1e6;
    if (cs.expectError) {
      // ERR group: the layout must throw a message containing the declared text
      rec.expectError = cs.expectError;
      rec.throwOk = rec.error.includes(cs.expectError);
      rec.verdict = rec.throwOk ? 'THROWS' : 'WRONG THROW';
      rec.checks = [{ id: 'err-throws', ok: rec.throwOk, kind: 'check', detail: `expected "${cs.expectError}", got "${rec.error.slice(0, 160)}"` }];
      rec.checkFailures = rec.throwOk ? [] : ['err-throws'];
    } else rec.verdict = 'ERROR';
    return rec;
  }
  if (cs.expectError) {
    // the layout was expected to throw but analysed: a failure of the validation
    rec.verdict = 'NO THROW';
    rec.expectError = cs.expectError;
    rec.throwOk = false;
    rec.error = 'expected the message "' + cs.expectError + '" but analyse() returned';
    rec.checks = [{ id: 'err-throws', ok: false, kind: 'check', detail: rec.error }];
    rec.checkFailures = ['err-throws'];
    return rec;
  }
  rec.ms = Number(process.hrtime.bigint() - t0) / 1e6;
  const { a, c, gl, sec, sw, E, py, za, gM, gD, gLabel } = out;
  rec.nCombos = a.ulsResults.length;
  rec.governCombo = gLabel;
  rec.uplift = a.uplift ? a.uplift.supports.map(u => ({ n: u.n, R: num(u.R), combo: u.combo })) : [];
  const utils = c.utils || [];
  rec.verdict = c.pass ? 'PASS' : utils.some(u => !Number.isFinite(u.val) || u.val > 1.0001) ? 'FAIL' : 'NOT VERIFIED';
  rec.gov = { name: stripHtml(c.gov.name), val: num(c.gov.val) };
  rec.utils = utils.map(u => ({ name: stripHtml(u.name), val: num(u.val) }));
  rec.cls = c.clsName || null;
  rec.Mmax = num(a.Mmax); rec.Vmax = num(a.Vmax); rec.dmax = num(a.dmax);
  rec.McRd = num(c.McRd); rec.VplRd = num(c.VcRd);
  rec.deflRatio = (c.dlimit > 0) ? c.dmax / c.dlimit : null;
  rec.unsupported = (c.unsupported || []).map(stripHtml);
  rec.advisory = (c.advisory || []).map(stripHtml);
  rec.warn = (c.ltb && c.ltb.warn) ? c.ltb.warn.map(stripHtml) : [];
  rec.mcrMethodReported = c.mcrMethod || null;
  // G4: open-section torsion route ('closed' = P385 App C forms, 'fe' = warping-torsion FE) and its mesh error
  rec.torsionMethod = (c.tor && c.tor.p385) ? c.tor.method : (c.tor && c.tor.box ? 'box' : null);
  rec.torsionMesh = (c.tor && c.tor.fe) ? num(c.tor.meshError) : null;

  // ---- LTB quantities (design values, i.e. those behind the printed utilisation) ----
  const L = c.ltb || null;
  rec.Mcr = null; rec.McrStd = null; rec.McrRatio = null; rec.C1 = null; rec.lamLT = null; rec.chiLT = null; rec.MbRd = null; rec.c1route = null; rec.ltbBasis = null;
  if (L) {
    rec.ltbBasis = stripHtml(c.ltbBasis || '');
    rec.c1route = L.c1route || null;
    rec.c1in = L.c1in ? { M1: num(L.c1in.M1), M2: num(L.c1in.M2), Mo: num(L.c1in.Mo), psi: num(L.c1in.psi), mu: num(L.c1in.mu) } : null;
    rec.McrStd = num(L.McrStandard);
    if (L.failed) {
      rec.Mcr = null; rec.MbRd = 0; rec.ltbFailed = L.err;
    } else if (method === 'eigen' && L.eigen) {
      const sg = L.spanGoverns ? L.spanGov : null;
      rec.Mcr = num(sg ? sg.Mcr : L.Mcr);
      rec.McrWhole = num(L.Mcr);
      rec.C1 = num(L.C1);
      rec.lamLT = num(sg ? sg.lam : L.lamLT);
      rec.chiLT = num(sg ? sg.chi : L.chiMod);
      rec.MbRd = num(sg ? sg.Mb : L.MbRd);
      rec.McrRatio = num(L.McrRatio);
      rec.spanGoverns = !!L.spanGoverns;
      rec.zg = num(L.zg);
    } else {
      // standard closed form: the Mcr route is the design basis (the channel kappa chain is
      // its own route, rescued by the shear-centre Mcr route when that one passes)
      const mcrRoute = /M.?cr.? method/i.test(rec.ltbBasis) || /Mcr method/.test(rec.ltbBasis);
      rec.Mcr = num(L.McrStandard != null ? L.McrStandard : L.Mcr);
      rec.C1 = num(L.C1show != null ? L.C1show : c.C1);
      rec.MbRd = num(L.MbRd);
      if (L.box || L.cant) { rec.lamLT = num(L.lamLTmcr); rec.chiLT = num(L.chiModM); }
      else if (L.channel) { rec.lamLT = mcrRoute && L.chanMcr ? num(L.chanMcr.lam) : num(L.lamLTsimp); rec.chiLT = mcrRoute && L.chanMcr ? num(L.chanMcr.chiMod) : num(L.chiS); }
      else { rec.lamLT = mcrRoute ? num(L.lamLTmcr) : num(L.lamLTsimp); rec.chiLT = mcrRoute ? num(L.chiModM) : num(L.chiModS); }
      rec.stdBasis = mcrRoute ? 'Mcr route' : (L.channel ? 'channel kappa chain' : 'Mcr route');
      rec.zg = num(L.zg); rec.zgUsed = !!L.zgUsed; rec.zgBlocked = !!L.zgBlocked;
    }
  }

  // ---- independent cross-checks ----
  const checks = [];
  const add = (id, ok, detail, kind = 'check') => checks.push({ id, ok, kind, detail });

  // (i) closed forms of the six presets: Mmax, dmax, the end moments and the End 1 reaction
  const cf = closedFormLayout(cs.overrides);
  rec.closedForm = cf ? cf.kind : null;
  if (cf) {
    const Lmm = cs.overrides.L * 1000, I = sec.Ix * 1e4, Lm = cs.overrides.L;
    const tot = fac => {
      let w = sw * (fac.G || 0), Pt = 0;
      for (const k in cf.udl) w += cf.udl[k] * (fac[k] || 0);
      for (const k in cf.point) Pt += cf.point[k] * (fac[k] || 0);
      return { w, Pt };   // kN/m (= N/mm), kN
    };
    const m = tot(gM), d = tot(gD);
    const cfM = closedFormsFor(cf.kind, m.w, m.Pt, Lm, Lmm, E * I), cfD = closedFormsFor(cf.kind, d.w, d.Pt, Lm, Lmm, E * I);
    // absolute values: an uplift combination (net upward w) governs some cases
    add('i-Mmax', rel(Math.abs(a.Mmax), Math.abs(cfM.M)) <= TOL, `${cf.kind}: closed form ${fmt(Math.abs(cfM.M), 2)} vs engine ${fmt(Math.abs(a.Mmax), 2)} kN.m`);
    add('i-dmax', rel(Math.abs(a.dmax), Math.abs(cfD.dmax)) <= TOL, `${cf.kind}: closed form ${fmt(Math.abs(cfD.dmax), 3)} vs engine ${fmt(Math.abs(a.dmax), 3)} mm`);
    // end moments as the solver reports them (reaction M of a fixed / guided end, N.mm)
    const rEnd = n => a.reactions.find(r => r.end === n) || null;
    [1, 2].forEach((n, i) => {
      const r = rEnd(n), exp = Math.abs(cfM.Mend[i]);
      if (exp > 1e-9 && r) add('i-Mend', rel(Math.abs(r.M) / 1e6, exp) <= TOL, `${cf.kind}: End ${n} (${r.type}) moment closed form ${fmt(exp, 2)} vs engine ${fmt(Math.abs(r.M) / 1e6, 2)} kN.m`);
    });
    const r1 = rEnd(1);
    if (r1 && r1.type !== 'guided') add('i-Rend', rel(Math.abs(r1.V) / 1000, Math.abs(cfM.R1)) <= TOL, `${cf.kind}: End 1 reaction closed form ${fmt(Math.abs(cfM.R1), 2)} vs engine ${fmt(Math.abs(r1.V) / 1000, 2)} kN`);
  }

  // (ii) equilibrium of the governing-moment combination
  {
    let sumF = 0;
    for (const ld of gl) {
      if (ld.type === 'point') sumF += ld.P;
      else if (ld.type === 'udl') sumF += (ld.w1 + ld.w2) / 2 * (ld.x2 - ld.x1);
    }
    const sumR = a.reactions.reduce((s, r) => s + r.V, 0);
    const resid = Math.abs(sumR + sumF);
    const ok = resid <= Math.max(TOL * Math.max(Math.abs(sumR), Math.abs(sumF)), 1);   // 1 N floor for moment-only loading
    add('ii-equilibrium', ok, `sum R = ${fmt(sumR / 1000, 3)} kN, sum loads = ${fmt(sumF / 1000, 3)} kN, residual ${fmt(resid / 1000, 4)} kN`);
  }

  // (iii) standard closed-form Mcr recomputed (doubly symmetric: I/H and box)
  if (L && !L.failed && (sec.kind === 'I' || sec.isBox)) {
    if (method === 'standard') {
      if (L.cant) {
        if (L.C > 0 && L.Mcr > 0) {
          const Mcr0 = Math.PI / (cs.overrides.L * 1000) * Math.sqrt(E * sec.Iy * 1e4 * G_STEEL * sec.J * 1e4) / 1e6;
          const exp = L.C * Mcr0;
          add('iii-McrStd', rel(exp, L.Mcr) <= TOL, `SN006a: C*Mcr0 = ${fmt(L.C, 3)} x ${fmt(Mcr0, 2)} = ${fmt(exp, 2)} vs engine ${fmt(L.Mcr, 2)} kN.m`);
        } else add('iii-McrStd', true, 'SN006a not covered for this loading (blocked by the engine)', 'info');
      } else {
        // whole member, governing-moment combination: every input from the case
        const ind = stdInputsIndependent(cs.overrides, gM, a.governM.fb, 0, cs.overrides.L * 1000);
        const exp = mcrClosedFormIndependent(sec, E, ind.LE, ind.C1, ind.C2, ind.zg, ind.zgApplied);
        add('iii-McrStd', rel(exp, L.Mcr) <= TOL, `SN003a (independent ${ind.route}): C1 ${fmt(ind.C1, 3)}, C2 ${ind.C2 == null ? '-' : fmt(ind.C2, 3)}, zg ${fmt(ind.zg, 0)} mm${ind.zgApplied ? ' applied' : ''}, LE ${fmt(ind.LE / 1000, 2)} m -> ${fmt(exp, 2)} vs engine ${fmt(L.Mcr, 2)} kN.m (engine route ${L.c1route || '-'})`);
        const blocked = (c.unsupported || []).some(m => /C<sub>2<\/sub> only for the simply supported and fixed-ended/.test(m));
        add('iii-zgBlock', blocked === ind.blockExpected, `destabilising zg on a non-tabulated diagram: block expected ${ind.blockExpected}, engine blocked ${blocked}`);
      }
    } else if (L.std && L.std.Mcr != null) {
      const s = L.std;
      if (s.route === 'sn006a') {
        if (s.sn006 && s.sn006.C != null) {
          const exp = s.sn006.C * s.sn006.Mcr0 / 1e6;
          const Mcr0i = Math.PI / (cs.overrides.L * 1000) * Math.sqrt(E * sec.Iy * 1e4 * G_STEEL * sec.J * 1e4) / 1e6;
          add('iii-McrStd', rel(exp, s.Mcr) <= TOL && rel(Mcr0i, s.sn006.Mcr0 / 1e6) <= TOL, `SN006a (comparison): C ${fmt(s.sn006.C, 3)} x Mcr0 ${fmt(Mcr0i, 2)} = ${fmt(s.sn006.C * Mcr0i, 2)} vs engine ${fmt(s.Mcr, 2)} kN.m`);
        }
      } else {
        // the comparison describes the LTB-governing combination (label printed by the engine) over its
        // segment; its factors come from the analysed list
        const govRes = L.governCombo ? a.ulsResults.find(r => r.combo.label === L.governCombo) : null;
        const gov = govRes ? govRes.combo : null;
        if (gov && govRes) {
          const ind = stdInputsIndependent(cs.overrides, gov.factors, govRes.fb, s.seg.xa, s.seg.xb);
          const exp = mcrClosedFormIndependent(sec, E, ind.LE, ind.C1, ind.C2, ind.zg, ind.zgApplied);
          add('iii-McrStd', rel(exp, s.Mcr) <= TOL, `SN003a (comparison, independent ${ind.route}, segment ${fmt(s.seg.xa / 1000, 2)}-${fmt(s.seg.xb / 1000, 2)} m, ${gov.label}): C1 ${fmt(ind.C1, 3)}, C2 ${ind.C2 == null ? '-' : fmt(ind.C2, 3)}, zg ${fmt(ind.zg, 0)} mm${ind.zgApplied ? ' applied' : ''}, LE ${fmt(ind.LE / 1000, 2)} m -> ${fmt(exp, 2)} vs engine ${fmt(s.Mcr, 2)} kN.m`);
        } else {
          const exp = mcrClosedFormIndependent(sec, E, s.LE, s.C1, s.C2, s.zg, !!s.zgUsed);
          add('iii-McrStd(arith)', rel(exp, s.Mcr) <= TOL, `SN003a (comparison, arithmetic only): C1 ${fmt(s.C1, 3)}, LE ${fmt(s.LE / 1000, 2)} m -> ${fmt(exp, 2)} vs engine ${fmt(s.Mcr, 2)} kN.m`);
        }
      }
    }
  }

  // (vii) uplift: a negative reaction of the governing-moment combination must be reported by the
  //       engine for that end, and every reported lifting end must carry a hold-down message
  {
    const negGov = a.reactions.map(r => ({ i: r.end, V: r.V, type: r.type })).filter(r => r.type !== 'guided' && r.V < -1);
    const reported = new Set((a.uplift ? a.uplift.supports : []).map(u => u.n));
    const okA = negGov.every(r => reported.has(r.i));
    const msgs = (c.unsupported || []).concat(c.advisory || []).filter(m => /^Hold-down/.test(m));
    // an end lifting in the governing (ULS) combination must be BLOCKING unless its hold-down box is ticked
    const okC = negGov.every(r => endOf(cs.overrides, r.i).holdDown ? true : (c.unsupported || []).some(m => new RegExp('^Hold-down required: .*at End ' + r.i + ' ').test(m)));
    const okB = (a.uplift && a.uplift.supports.length) ? a.uplift.supports.every(u => msgs.some(m => new RegExp('at End ' + u.n + ' ').test(m))) : msgs.length === 0;
    add('vii-uplift', okA && okB && okC, negGov.length ? `governing combination lifts End ${negGov.map(r => r.i + ' (' + fmt(r.V / 1000, 2) + ' kN)').join(', ')}; engine reports ${[...reported].join(', ') || 'none'}` : `no uplift in the governing combination; engine reports ${[...reported].join(', ') || 'none'} (${msgs.length} hold-down message(s))`);
  }

  // (viii) web transverse forces (EN 1993-1-5 clause 6, G2): F_Rd at the governing station recomputed
  //        independently from the raw section table for rolled I/H sections (end reaction type (c) with
  //        c = 0, interior point load type (a); the (a)/(c) pair in the end zone is evaluated and the
  //        lower taken), s_s from the case (support blank = lower bound 0, load default = 0), a = L when no
  //        stiffener is declared; util2 must equal the largest station ratio; a stiffened station never governs
  //        19 Sep 2026 campaign: extended to a point load over a support ('both' station: type (b) with (c) alongside in the
  //        end zone, F_Ed = max(P, R)), to PFC (one-sided flange b_f <= t_w + 15 eps t_f) and to RHS/SHS (two webs of
  //        thickness t with the tabulated flat depth, flange share B/2 per web <= t + 15 eps t, lever-rule share of the load)
  if (c.web && c.web.checked) {
    const W = c.web, s = W.gov2;
    const isBox = !!sec.isBox, chan = sec.kind === 'channel';
    const eps = Math.sqrt(235 / py), hw = isBox ? sec.d : sec.D - 2 * sec.tf, tw = sec.tw, tf = sec.tf, Lmm = a.L;
    const bfRaw = isBox ? sec.B / 2 : sec.B, bfLim = (isBox || chan) ? tw + 15 * eps * tf : tw + 30 * eps * tf;
    const bf = Math.min(bfRaw, bfLim), m1 = bf / tw, m2f = 0.02 * Math.pow(hw / tf, 2);
    const noStiff = !endSupports(o).some(sp => sp.stiff) && !(o.loads || []).some(ld => ld.stiff);
    const d = Math.min(s.x, Lmm - s.x);
    const ssSup = s.n ? (endOf(o, s.n).ss != null ? +endOf(o, s.n).ss : 0) : null;   // blank = lower bound 0 (19 Sep 2026 review)
    const ssLoad = (s.loadIdx && s.loadIdx.length) ? Math.min(...s.loadIdx.map(i => (o.loads[i - 1] || {}).ss != null ? +o.loads[i - 1].ss : 0)) : null;
    const ssIn = s.kind === 'support' ? ssSup : s.kind === 'load' ? ssLoad : s.kind === 'both' ? Math.min(ssSup, ssLoad) : null;
    if (ssIn != null && noStiff) {
      const ss = Math.min(ssIn, hw), cc = Math.max(d - ss / 2, 0), endZone = (ss + cc) < 2 * hw / 3;
      const FRdOf = (type) => {
        const kF = type === 'a' ? 6 + 2 * Math.pow(hw / Lmm, 2) : type === 'b' ? 3.5 + 2 * Math.pow(hw / Lmm, 2) : Math.min(2 + 6 * (ss + cc) / hw, 6);
        const Fcr = 0.9 * kF * E * Math.pow(tw, 3) / hw;
        const le = type === 'c' ? Math.min(kF * E * tw * tw / (2 * py * hw), ss + cc) : null;
        const ly = (m2) => type === 'c' ? Math.min(le + tf * Math.sqrt(m1 / 2 + Math.pow(le / tf, 2) + m2), le + tf * Math.sqrt(m1 + m2)) : Math.min(ss + 2 * tf * (1 + Math.sqrt(m1 + m2)), Lmm);
        let l = ly(m2f), lam = Math.sqrt(l * tw * py / Fcr);
        if (lam <= 0.5) { l = ly(0); lam = Math.sqrt(l * tw * py / Fcr); }
        return py * Math.min(0.5 / lam, 1) * l * tw / 1000;
      };
      const types = s.kind === 'both' ? ['b'].concat(endZone ? ['c'] : []) : (endZone ? ['a', 'c'] : ['a']);
      const FRdWeb = Math.min(...types.map(FRdOf));
      // box: lever-rule share of the load to the nearer web from the largest eccentricity at the station (0.5 at e = 0)
      const eMax = (s.loadIdx && s.loadIdx.length && o.eccOn) ? Math.max(...s.loadIdx.map(i => Math.abs(+(o.loads[i - 1] || {}).e || 0))) : 0;
      const share = isBox ? Math.min(1, 0.5 + eMax / Math.max(sec.B - tw, 1e-9)) : 1;
      const exp = FRdWeb / share;
      // F_Ed of a 'both' station = max(P, R) of the governing combination (checked against the engine's own P and R)
      const gCase = s.cases ? s.cases[s.g2] : null;
      const okF = s.kind !== 'both' || (gCase && Math.abs(gCase.F - Math.max(Math.abs(gCase.P), gCase.R)) <= 1e-9);
      const maxEta = Math.max(...W.stations.filter(x => !x.stiff && !x.nv).map(x => x.eta2));   // a NOT VERIFIED (blank s_s, fails at 0) station is excluded from the verdict entry
      add('viii-FRd', rel(exp, s.FRdTot) <= TOL && Math.abs(W.util2 - maxEta) <= 1e-9 && !s.stiff && okF,
        `station x = ${fmt(s.x / 1000, 2)} m (${s.label}, type (${s.type}), s_s ${fmt(ss, 1)} mm${isBox ? ', two webs, share ' + fmt(share, 3) : chan ? ', channel' : ''}): independent F_Rd ${fmt(exp, 1)} vs engine ${fmt(s.FRdTot, 1)} kN; F_Ed ${fmt(s.F, 1)} kN (${s.combo}${s.kind === 'both' ? ', = max(P, R)' : ''}); util ${fmt(W.util2, 3)} = max station ratio ${fmt(maxEta, 3)}`);
    }
  }
  // (viii-Mend) the 7.2 interaction at an end station reads M_Ed at the station: at a fixed or guided end that must be the
  //   end reaction moment of the same combination (the diagram closes to zero beyond the end, so a sample taken exactly on
  //   the closing grid value would drop eta_1). Checked on the governing-moment combination against the solver's reaction M.
  if (c.web && c.web.stations) {
    c.web.stations.filter(st => st.kind !== 'load' && !st.stiff && st.cases).forEach(st => {
      const r = a.reactions.find(x => x.end === st.n); if (!r || !(Math.abs(r.M) > 1e-6)) return;
      const cse = st.cases.find(k => k.combo === gLabel); if (!cse) return;
      add('viii-Mend', rel(cse.M, Math.abs(r.M) / 1e6) <= TOL, `End ${st.n} (${r.type}) web station M_Ed ${fmt(cse.M, 2)} vs the end reaction moment ${fmt(Math.abs(r.M) / 1e6, 2)} kN.m (${gLabel}); eta_1 ${fmt(cse.eta1, 3)}`);
    });
  }
  // (xv) G3 item 12: coexistent shear and moment at the engine's worst high-shear station (cl 6.2.8): rho from the station V
  //      and V_pl(,T),Rd, M_v,y,Rd by family and class recomputed from the raw table, M/M_v,Rd vs the engine's value
  if (c.coex && c.coex.red && !c.coex.pureShearFail && c.coex.MvRd != null) {
    const x = c.coex, Vpl = (c.tor && c.tor.VplTRd != null) ? c.tor.VplTRd : c.VcRd, Av = c.Av;
    const rho = Math.min(Math.pow(2 * x.V / Vpl - 1, 2), 1), cls12 = c.cl && c.cl.cls <= 2, hw = sec.D - 2 * sec.tf;
    const Wy = (cls12 ? sec.Sx : sec.Zx) * 1e3, Mc = Wy * py / 1e6;
    let dW, form;
    if (sec.kind === 'I') { if (cls12) { dW = rho * Av * Av / (4 * sec.tw); form = 'I/H Class 1/2 (W_pl - rho A_v^2/4t_w)'; } else { dW = rho * sec.tw * Math.pow(hw, 3) / 12 / (sec.D / 2); form = 'I/H Class 3 (W_el - rho I_web/(h/2))'; } }
    else if (sec.kind === 'channel') { dW = rho * sec.tw * hw * hw / 4; form = 'channel (W_y - rho t_w h_w^2/4)'; }
    else { const t = sec.tf, hi = sec.D - 2 * t; dW = rho * t * hi * hi / 2; form = 'RHS/SHS (W_y - rho t (h - 2t)^2/2)'; }
    const MvY = Math.min(Math.max((Wy - dW) * py / 1e6, 0), Mc), MvRd = Math.min(MvY, c.McRd), u = x.M / MvRd;
    add('xv-MvRd', rel(MvRd, x.MvRd) <= 1e-9 && rel(u, x.u) <= 1e-9 && x.V > 0.5 * Vpl && rho <= 1,
      `x = ${fmt(x.x / 1000, 2)} m, ${form}: V ${fmt(x.V, 1)} kN / V_pl ${fmt(Vpl, 1)} -> rho ${fmt(rho, 4)}, M_v,Rd ${fmt(MvRd, 1)} vs engine ${fmt(x.MvRd, 1)} kN.m; M ${fmt(x.M, 1)}: ${fmt(u, 4)} vs engine ${fmt(x.u, 4)}`);
  }

  // (ix) G3 item 6: A_eff of a Class-4 web in uniform compression recomputed from the raw table (EN 1993-1-5 4.4, psi = 1, k_sigma = 4)
  if (c.aeff && c.aeff.active) {
    const eps = Math.sqrt(235 / py), nW = sec.isBox ? 2 : 1;
    const lamP = sec.dt / (28.4 * eps * 2), rho = lamP <= 0.673 ? 1 : Math.min((lamP - 0.22) / (lamP * lamP), 1);
    const Aeff = sec.A * 100 - nW * (1 - rho) * sec.d * sec.tw;
    const nName = utils.find(u => /^Compression/.test(u.name));
    // a Class-4 block (web Class 4 under the combined N + M stress gradient, e_N shift not implemented) leaves no verdict
    // entry to check: the A_eff value itself is still compared and the run is recorded as info
    const class4Block = !nName && (c.unsupported || []).some(m => /Class 4/.test(m));
    add('ix-Aeff', rel(Aeff, c.aeff.Aeff) <= 1e-9 && sec.dt > 42 * eps && (class4Block || (!!nName && /A_eff/.test(nName.name) && (!c.buck || rel(c.buck.Aeff, Aeff) <= 1e-9))),
      `d/t ${fmt(sec.dt, 2)} > 42 eps ${fmt(42 * eps, 2)}: lambda_p ${fmt(lamP, 4)}, rho ${fmt(rho, 4)}, A_eff ${fmt(Aeff, 1)} vs engine ${fmt(c.aeff.Aeff, 1)} mm2 (${fmt(c.aeff.ratio, 4)} A)${class4Block ? '; Class-4 stress-gradient block, no verdict entry (A_eff value only)' : ''}`, class4Block ? 'info' : 'check');
  }
  // (x) G3 item 10: channel torsional-flexural buckling N_b,T,Rd recomputed from the raw PFC table and P385 constants
  if (c.buck && c.buck.tfb && c.buck.tfb.ok) {
    const tp = sec.tp, G = 81000, Ag = sec.A * 100;
    const IT = (tp && tp.IT ? tp.IT : sec.J) * 1e4, Iw = ((tp && tp.Iw != null ? tp.Iw : sec.Iw) || 0) * 1e12, y0 = tp.esc;
    const iy = sec.rx * 10, iz = sec.ry * 10, i0sq = iy * iy + iz * iz + y0 * y0;
    // L_T (19 Sep 2026 review): the case's L_T, else the largest spacing of the TWIST restraints (ends with R_x held
    // and restraints with phi !== false) capped at L_cr,y - never the lateral-only spacing L_cr,z
    const LcrY = c.buck.LcrY;
    const twistEndPts = [[1, 0], [2, o.L]].filter(([n]) => endOf(o, n).rx).map(([, x]) => x * 1000);
    const twistPts = [...new Set(twistEndPts.concat((o.ltbRestraints || []).filter(r => r.phi !== false).map(r => +r.pos * 1000)).map(x => +x.toFixed(3)))].sort((p, q) => p - q);
    let LTsp = 0; for (let i = 1; i < twistPts.length; i++) LTsp = Math.max(LTsp, twistPts[i] - twistPts[i - 1]);
    const LT = (cs.overrides.LT > 0) ? cs.overrides.LT * 1000 : ((o.ltbRestraints || []).some(r => r.phi !== false) && twistEndPts.length >= 2 && LTsp > 0) ? Math.min(LTsp, LcrY) : LcrY;
    const NcrT = (G * IT + Math.PI ** 2 * E * Iw / (LT * LT)) / i0sq, NcrY = Math.PI ** 2 * E * sec.Ix * 1e4 / (LcrY * LcrY);
    const beta = 1 - y0 * y0 / i0sq;
    const NcrTF = (NcrY + NcrT) / (2 * beta) * (1 - Math.sqrt(1 - 4 * beta * NcrY * NcrT / (NcrY + NcrT) ** 2));
    const lamT = Math.sqrt(Ag * py / Math.min(NcrT, NcrTF));
    const Phi = 0.5 * (1 + 0.49 * (lamT - 0.2) + lamT * lamT), chiT = Math.min(1 / (Phi + Math.sqrt(Phi * Phi - lamT * lamT)), 1);
    const NbT = chiT * Ag * py / 1000, uT = utils.find(u => /6\.3\.1\.4/.test(u.name));
    add('x-NbT', rel(NbT, c.buck.tfb.NbT) <= 1e-6 && !!uT && Math.abs(uT.val - (c.buck.Fc / NbT)) <= 1e-6 && c.buck.ny >= c.buck.Fc / Math.max(c.buck.NbY, 1e-9) - 1e-12 && c.buck.nz >= c.buck.Fc / Math.max(c.buck.NbZ, 1e-9) - 1e-12,
      `y0 ${fmt(y0, 1)} mm, N_cr,T ${fmt(NcrT / 1000, 1)}, N_cr,TF ${fmt(NcrTF / 1000, 1)} kN, lambda_T ${fmt(lamT, 3)}, curve c chi ${fmt(chiT, 3)}: N_b,T,Rd ${fmt(NbT, 1)} vs engine ${fmt(c.buck.tfb.NbT, 1)} kN; verdict entry ${uT ? fmt(uT.val, 3) : 'missing'}`);
  }
  // (xii) G3 item 7: cl 6.2.10 at the engine's worst high-shear station, uniaxial (N only): chain recomputed from the station V, M, N and the raw table
  //   rolled I/H Class 1/2 : plastic 6.2.9.1 with (1 - rho) f_y on A_v, the (4) waiver, M_N,V,y,Rd = M_v,y,Rd (1 - n_V)/(1 - 0.5 a_V) <= M_v,y,Rd, u = M/M_N,V,y,Rd
  //   rolled I/H Class 3   : elastic linear sum n_V + M/M_v,y,Rd with M_v,y,Rd = (W_el,y - rho I_web/(h/2)) f_y
  //   RHS/SHS Class 1/2    : Eq 6.39 with a_w,V = ((A - 2bt) - rho A_v)/(A - rho A_v) <= 0.5 (no waiver), M_v,y,Rd = (W_pl,y - rho t (h - 2t)^2/2) f_y
  if (c.mvn && !c.mvn.biax && c.mvn.N > 0 && (sec.kind === 'I' || sec.isBox)) {
    const m = c.mvn, A = sec.A * 100, Av = c.Av, Vpl = (c.tor && c.tor.VplTRd != null) ? c.tor.VplTRd : c.VcRd;
    const rho = Math.pow(2 * m.V / Vpl - 1, 2), NV = (A - rho * Av) * py / 1000, hw = sec.D - 2 * sec.tf, nV = m.N / NV;
    const cls12 = !!m.plastic;
    let MvY, MNVy, u, form;
    if (sec.kind === 'I' && cls12) {
      MvY = Math.min((sec.Sx * 1e3 - rho * Av * Av / (4 * sec.tw)) * py / 1e6, sec.Sx * 1e3 * py / 1e6);
      const aV = Math.min(Math.max(((A - 2 * sec.B * sec.tf) - rho * Av) / (A - rho * Av), 0), 0.5);
      const waiver = m.N <= 0.25 * NV && m.N * 1000 <= 0.5 * hw * sec.tw * (1 - rho) * py;
      MNVy = waiver ? MvY : Math.min(MvY * (1 - nV) / (1 - 0.5 * aV), MvY); u = m.M / MNVy;
      form = `I/H Class 1/2, a_V ${fmt(aV, 3)}${waiver ? ', 6.2.9.1(4) waiver' : ''}`;
    } else if (sec.kind === 'I') {
      const Iweb = sec.tw * Math.pow(hw, 3) / 12;
      MvY = Math.min((sec.Zx * 1e3 - rho * Iweb / (sec.D / 2)) * py / 1e6, sec.Zx * 1e3 * py / 1e6);
      MNVy = MvY; u = nV + m.M / MvY;
      form = 'I/H Class 3, linear n_V + M/M_v,y,Rd';
    } else if (cls12) {
      const t = sec.tf, hi = sec.D - 2 * t;
      MvY = Math.min((sec.Sx * 1e3 - rho * t * hi * hi / 2) * py / 1e6, sec.Sx * 1e3 * py / 1e6);
      const aw = Math.min(Math.max(((A - 2 * sec.B * t) - rho * Av) / (A - rho * Av), 0), 0.5);
      MNVy = Math.min(MvY * (1 - nV) / (1 - 0.5 * aw), MvY); u = m.M / MNVy;
      form = `RHS Class 1/2, Eq 6.39 with a_w,V ${fmt(aw, 3)}`;
    }
    if (u != null) {
      const uE = utils.find(x => /6\.2\.10/.test(x.name));
      add('xii-MVN', rel(u, m.u) <= 1e-9 && !!uE && Math.abs(uE.val - m.u) <= 1e-12 && m.V > 0.5 * Vpl,
        `x = ${fmt(m.x / 1000, 2)} m (${form}): V ${fmt(m.V, 1)} kN, rho ${fmt(rho, 4)}, N_V,Rd ${fmt(NV, 1)}, M_v,y,Rd ${fmt(MvY, 1)}, M_N,V,y,Rd ${fmt(MNVy, 1)} kN.m: utilisation ${fmt(u, 4)} vs engine ${fmt(m.u, 4)}`);
    }
  }
  // (xiii) G4 item 11: warping-torsion FE against the classical closed forms of the Vlasov equation, from the raw P385 constants
  //   cantilever with a single tip point torque and no other torque: phi_tip = (T/GI_T)[L - a tanh(L/a)], root T_t = 0, tip total torque = T
  //   fork-fork, both ends warping fixed, full-span uniform torque only: phi_mid = (t/GI_T)[L^2/8 - (La/2) tanh(L/4a)], T_t = 0 at both ends
  if (c.tor && c.tor.p385 && c.tor.fe && sec.kind === 'I') {
    const tp = sec.tp, G = 81000, Lmm = o.L * 1000;
    const IT = (tp && tp.IT ? tp.IT : sec.J) * 1e4, Iw = ((tp && tp.Iw != null ? tp.Iw : sec.Iw) || 0) * 1e12;
    const GIt = G * IT, aa = Math.sqrt(E * Iw / GIt);
    const sup = endSupports(o), loads = o.loads.filter(l => l.type !== 'moment' && Math.abs(+l.e || 0) > 0);
    const isCantAny = isCantCase(o), isCant = isCantAny && !!endOf(o, 1).warp;   // the closed forms below take a warping-fixed root
    // root warping FREE (phi'' = 0 at the root, natural at the tip): the Vlasov solution is pure St Venant, phi_tip = TL/GI_T, B = 0
    const tipFree = isCantAny && !endOf(o, 1).warp && loads.length && loads.every(l => l.type === 'point' && Math.abs(l.pos - o.L) < 1e-9) && o.loads.every(l => l.type !== 'udl' && l.type !== 'trap' || Math.abs(+l.e || 0) === 0);
    const tipOnly = isCant && loads.length && loads.every(l => l.type === 'point' && Math.abs(l.pos - o.L) < 1e-9) && o.loads.every(l => l.type !== 'udl' && l.type !== 'trap' || Math.abs(+l.e || 0) === 0);
    // cantilever with full-span uniform torque only (root warping fixed, tip free): phi_tip = (m/GI_T)[L^2/2 + a^2(1 - sech(L/a)) - a L tanh(L/a)]
    // (solution of E I_w phi'''' - G I_T phi'' = m with phi(0) = phi'(0) = 0, B(L) = 0, T(L) = 0; hand-derived, tests/batch/hand-checks.md)
    const udlOnly = isCant && loads.length && loads.every(l => l.type === 'udl' && l.x1 === 0 && Math.abs(l.x2 - o.L) < 1e-9) && o.loads.every(l => l.type === 'udl' || Math.abs(+l.e || 0) === 0);
    const bothFix = sup.length === 2 && sup.every(s => s.warpFix && s.rx) && loads.length && loads.every(l => l.type === 'udl' && l.x1 === 0 && l.x2 === o.L) && o.loads.every(l => l.type === 'udl' || Math.abs(+l.e || 0) === 0);
    if (tipOnly || udlOnly || bothFix || tipFree) {
      const fac = gM;   // governing-moment combination = the only ULS combination of these single-segment layouts
      let T = 0, t = 0;
      loads.forEach(l => { const f = fac[l.case] || 0; if (l.type === 'point') T += f * l.P * 1000 * l.e; else t += f * l.w * l.e; });
      let phiExp, label, ttZero;
      if (tipFree) { phiExp = T * Lmm / GIt; label = `cantilever with the root warping free, tip torque T = ${fmt(T / 1e6, 3)} kN.m: phi_tip = TL/GI_T = ${fmt(phiExp, 5)} rad (St Venant only, B = 0)`; ttZero = Math.abs(Math.abs(c.tor.TtEnds[0]) - T / 1e6) <= 1e-6 + T / 1e6 * 1e-6 && Math.abs(c.tor.BMax) <= 1e-6 * Math.max(T * Lmm / 1e9, 1e-9); }
      else if (tipOnly) { phiExp = (T / GIt) * (Lmm - aa * Math.tanh(Lmm / aa)); label = `cantilever tip torque T = ${fmt(T / 1e6, 3)} kN.m: phi_tip = (T/GI_T)[L - a tanh(L/a)] = ${fmt(phiExp, 5)} rad`; ttZero = Math.abs(c.tor.TtEnds[0]) <= 1e-9 && Math.abs(Math.abs(c.tor.TEnds[1]) - T / 1e6) <= 1e-6; }
      else if (udlOnly) { const X = Lmm / aa; phiExp = (t / GIt) * (Lmm * Lmm / 2 + aa * aa * (1 - 1 / Math.cosh(X)) - aa * Lmm * Math.tanh(X)); label = `cantilever uniform torque m = ${fmt(t, 1)} N.mm/mm: phi_tip = (m/GI_T)[L^2/2 + a^2(1 - sech(L/a)) - aL tanh(L/a)] = ${fmt(phiExp, 5)} rad`; ttZero = Math.abs(c.tor.TtEnds[0]) <= 1e-9 && Math.abs(Math.abs(c.tor.TEnds[0]) - t * Lmm / 1e6) <= 1e-6 + Math.abs(c.tor.TEnds[0]) * 1e-6 && Math.abs(c.tor.TEnds[1]) <= 1e-6; }
      else { phiExp = (t / GIt) * (Lmm * Lmm / 8 - Lmm * aa / 2 * Math.tanh(Lmm / (4 * aa))); label = `warping-fixed ends, uniform torque t = ${fmt(t, 1)} N.mm/mm: phi_mid = (t/GI_T)[L^2/8 - (La/2) tanh(L/4a)] = ${fmt(phiExp, 5)} rad`; ttZero = Math.abs(c.tor.TtEnds[0]) <= 1e-9 && Math.abs(c.tor.TtEnds[1]) <= 1e-9; }
      const meshOk = tipFree ? true : (c.tor.meshConverged && c.tor.meshError <= 1e-3);   // pure St Venant: B is numerical noise and the engine's relative bimoment measure is meaningless (finding, README)
      add('xiii-torsionFE', rel(phiExp, c.tor.phiUmax) <= 1e-4 && ttZero && meshOk,
        `${label} vs engine phi_max ${fmt(c.tor.phiUmax, 5)} rad (${c.tor.methodLabel}, mesh error ${(c.tor.meshError * 100).toExponential(2)} %${tipFree ? ' - the relative change of a vanishing bimoment, not a convergence measure' : ''}); ${tipFree ? 'root St Venant torque = T and B = 0' : 'St Venant torque zero at the warping-fixed end(s)'}: ${ttZero}`);
    }
  }
  // (xi) G3 item 8: k_c floor - printed k_c = max(1/sqrt(C1), 1/sqrt(2.76)) on both routes
  if (L && !L.failed && L.kc != null && L.C1 != null && !L.cant && !L.channel && (method === 'standard' ? true : L.c1Trusted !== false) && cs.overrides.C1o == null) {
    const C1 = method === 'standard' ? c.C1 : L.C1, kcExp = Math.max(Math.min(1 / Math.sqrt(C1), 1), 1 / Math.sqrt(2.76));
    add('xi-kcFloor', Math.abs(kcExp - L.kc) <= 1e-9 && (!!L.kcFloored === (C1 > 2.76 + 1e-9)), `C1 ${fmt(C1, 3)}: k_c ${fmt(kcExp, 4)} vs engine ${fmt(L.kc, 4)}${L.kcFloored ? ' (floored at 0.602)' : ''}`);
  }

  // (iv) eigen / standard ratio (same segment) - outlier flag, not an error
  if (method === 'eigen' && L && !L.failed && L.McrRatio != null) {
    const r = L.McrRatio;
    add('iv-McrRatio', r >= RATIO_LO && r <= RATIO_HI, `Mcr eigen / standard = ${fmt(r, 3)} (${fmt(rec.Mcr, 1)} / ${fmt(L.McrStandard, 1)} kN.m, route ${L.c1route || '-'})`, 'flag');
  }

  // (xvii) cantilever: the ratio Mcr,eigen / Mcr,SN006a recorded (I/H, root warping condition from the flag)
  if (method === 'eigen' && L && !L.failed && isCantCase(cs.overrides) && L.std && L.std.route === 'sn006a') {
    rec.cantSN006a = L.std.Mcr != null ? { ratio: L.McrRatio, McrEigen: L.McrEigen, McrSN006a: L.std.Mcr, C: L.std.sn006 && L.std.sn006.C, kwt: L.std.sn006 && L.std.sn006.kwt, eta: L.std.sn006 && L.std.sn006.eta, warp: L.std.sn006 && L.std.sn006.warp, caseLbl: L.std.sn006 && L.std.sn006.caseLbl } : { ratio: null, McrEigen: L.McrEigen, McrSN006a: null, reason: L.std.sn006 && L.std.sn006.reason ? stripHtml(L.std.sn006.reason) : 'not covered' };
    add('xvii-cantSN006a', true, rec.cantSN006a.ratio != null ? `Mcr eigen ${fmt(L.McrEigen, 1)} / SN006a ${fmt(L.std.Mcr, 1)} = ${fmt(L.McrRatio, 3)} (C ${fmt(rec.cantSN006a.C, 3)}, kwt ${fmt(rec.cantSN006a.kwt, 3)}, eta ${fmt(rec.cantSN006a.eta, 2)}, root warping ${rec.cantSN006a.warp}, ${rec.cantSN006a.caseLbl})` : `SN006a not covered: ${rec.cantSN006a.reason}; Mcr eigen ${fmt(L.McrEigen, 1)}`, 'info');
  }
  rec.zgStdBlocked = !!(L && L.std && L.std.zgBlocked);

  // (v) Mb,Rd <= Mc,Rd
  if (L && !L.failed && rec.MbRd != null && rec.McRd != null) {
    add('v-MbRd<=McRd', rec.MbRd <= rec.McRd * (1 + 1e-9), `Mb,Rd ${fmt(rec.MbRd, 2)} <= Mc,Rd ${fmt(rec.McRd, 2)} kN.m`);
  }

  // (vi) governing utilisation = max of the printed utilisations
  {
    const mx = Math.max(...utils.map(u => Number.isFinite(u.val) ? u.val : Infinity));
    add('vi-governing', Number.isFinite(c.gov.val) && Number.isFinite(mx) && Math.abs(c.gov.val - mx) <= 1e-9 * Math.max(1, mx), `gov ${stripHtml(c.gov.name)} = ${fmt(c.gov.val, 4)}, max(utils) = ${fmt(mx, 4)}`);
  }

  rec.checks = checks;
  rec.checkFailures = checks.filter(k => !k.ok && k.kind === 'check').map(k => k.id);
  rec.outlier = checks.some(k => !k.ok && k.kind === 'flag');

  // ---- expected vs observed triggers (comparable subset) ----
  rec.observed = observedTriggers(a, c, cs.overrides);
  const exp = new Set(cs.expect.filter(x => COMPARABLE.has(x))), obs = new Set(rec.observed.filter(x => COMPARABLE.has(x)));
  rec.triggerMismatch = { missing: [...exp].filter(x => !obs.has(x)), extra: [...obs].filter(x => !exp.has(x)) };
  return rec;
}

// ---------------------------------------------------------------------------
// campaign
// ---------------------------------------------------------------------------
const runs = [];
const t00 = Date.now();
for (const cs of selected) {
  const methods = cs.expectError ? ['err'] : cs.overrides.restraint === 'ltb' ? ['eigen', 'standard'] : ['n/a'];
  for (const m of methods) {
    const rec = runOne(cs, m === 'n/a' || m === 'err' ? 'eigen' : m);
    if (m === 'n/a') rec.method = 'n/a (restrained)';
    if (m === 'err') rec.method = 'n/a (invalid)';
    runs.push(rec);
    process.stdout.write(`${rec.id.padEnd(8)} ${rec.method.padEnd(16)} ${rec.verdict.padEnd(13)} ${rec.gov ? (rec.gov.name + ' = ' + fmt(rec.gov.val, 3)).padEnd(52) : (rec.error || '').slice(0, 52).padEnd(52)} ${fmt(rec.ms, 0).padStart(6)} ms${rec.checkFailures && rec.checkFailures.length ? '  CHECK FAIL: ' + rec.checkFailures.join(',') : ''}${rec.outlier ? '  [ratio outlier]' : ''}\n`);
  }
}
// cross-run eigen vs standard ratio (design Mcr of each run; the standard run
// uses the whole member, so this can differ from the same-segment ratio)
const byId = {};
runs.forEach(r => { (byId[r.id] = byId[r.id] || {})[r.method] = r; });
runs.forEach(r => {
  if (r.method === 'eigen' && byId[r.id].standard && r.Mcr > 0 && byId[r.id].standard.Mcr > 0) r.McrRatioRuns = r.Mcr / byId[r.id].standard.Mcr;
});
// (xvi) end-restraint bounds: eigen Mcr of a `pair` case >= that of its base case (whole-member design values);
//   beside it the SN003a k = 0.5 (R_z both ends) or k_w = 0.5 (warping both ends) closed-form ratio computed here
//   from the raw section table for the two tabulated diagrams (UDL C1 1.127 -> 0.972, central point load 1.348 -> 1.05)
const pairRows = [];
selected.filter(cs => cs.pair).forEach(cs => {
  const me = byId[cs.id] && byId[cs.id].eigen, base = byId[cs.pair.base] && byId[cs.pair.base].eigen;
  if (!me || !base) return;
  const ok = me.Mcr > 0 && base.Mcr > 0 && me.Mcr >= base.Mcr * (1 - 1e-6);
  const o = cs.overrides, e1 = endOf(o, 1), e2 = endOf(o, 2), bo = cases.find(x => x.id === cs.pair.base).overrides, b1 = endOf(bo, 1), b2 = endOf(bo, 2);
  let closed = null;
  const shape = closedFormLayout(o), sec = ctx.run(`(()=>{ S.family=${JSON.stringify(o.family)}; S.ubKey=${JSON.stringify(o.ubKey || 'x')}; S.ucKey=${JSON.stringify(o.ucKey || 'x')}; return activeSection(); })()`);
  if (shape && shape.kind === 'ss' && (o.family === 'ub' || o.family === 'uc')) {
    const E = 210000, Iz = sec.Iy * 1e4, It = sec.J * 1e4, Iw = (sec.Iw || 0) * 1e12, Lmm = o.L * 1000;
    const cfk = (k, kw, C1) => C1 * Math.PI ** 2 * E * Iz / (k * Lmm) ** 2 * Math.sqrt((k / kw) ** 2 * Iw / Iz + (k * Lmm) ** 2 * G_STEEL * It / (Math.PI ** 2 * E * Iz));
    const isUdl = Object.keys(shape.point).length === 0, isPt = Object.keys(shape.udl).length === 0 && Object.keys(shape.point).length > 0;
    const C1k1 = isUdl ? 1.127 : isPt ? 1.348 : null, C1k05 = isUdl ? 0.972 : isPt ? 1.05 : null;
    const clampBoth = e1.rz && e2.rz && !(b1.rz || b2.rz), warpBoth = e1.warp && e2.warp && !(b1.warp || b2.warp);
    if (C1k1 && clampBoth && !warpBoth) closed = { label: 'SN003a k = 0.5, k_w = 1 (C1 ' + C1k05 + ' / ' + C1k1 + ')', ratio: cfk(0.5, 1, C1k05) / cfk(1, 1, C1k1) };
    else if (C1k1 && warpBoth && !clampBoth) closed = { label: 'SN003a k = 1, k_w = 0.5 (C1 ' + C1k1 + ')', ratio: cfk(1, 0.5, C1k1) / cfk(1, 1, C1k1) };
  }
  const row = { id: cs.id, base: cs.pair.base, why: cs.pair.why, Mcr: me.Mcr, McrBase: base.Mcr, ratio: me.Mcr / base.Mcr, closed, ok };
  pairRows.push(row);
  me.checks.push({ id: 'xvi-McrPair', ok, kind: 'check', detail: `Mcr ${fmt(me.Mcr, 1)} (${cs.id}) vs ${fmt(base.Mcr, 1)} (${cs.pair.base}): ratio ${fmt(row.ratio, 3)}${closed ? ', closed-form ' + closed.label + ' ratio ' + fmt(closed.ratio, 3) : ''} - ${cs.pair.why}` });
  if (!ok) me.checkFailures.push('xvi-McrPair');
});

// ---------------------------------------------------------------------------
// summaries
// ---------------------------------------------------------------------------
const VERDICTS = ['PASS', 'FAIL', 'NOT VERIFIED', 'ERROR', 'THROWS', 'WRONG THROW', 'NO THROW'];
const VERDICTS_MAIN = ['PASS', 'FAIL', 'NOT VERIFIED', 'ERROR'];
const groupOf = id => id.replace(/-.*$/, '');
const FAMS = ['ub', 'uc', 'pfc', 'shs', 'rhs'];
const count = (list, key) => { const o = {}; list.forEach(r => { o[key(r)] = (o[key(r)] || 0) + 1; }); return o; };
const tableFam = {}, tableMethod = {};
FAMS.forEach(f => { tableFam[f] = {}; VERDICTS.forEach(v => tableFam[f][v] = runs.filter(r => r.family === f && r.verdict === v && !r.expectError).length); tableFam[f].runs = runs.filter(r => r.family === f && !r.expectError).length; tableFam[f].cases = selected.filter(c => c.overrides.family === f && !c.expectError).length; });
['eigen', 'standard', 'n/a (restrained)', 'n/a (invalid)'].forEach(m => { tableMethod[m] = {}; VERDICTS.forEach(v => tableMethod[m][v] = runs.filter(r => r.method === m && r.verdict === v).length); tableMethod[m].runs = runs.filter(r => r.method === m).length; });
const checkFails = runs.filter(r => r.checkFailures && r.checkFailures.length);
const outliers = runs.filter(r => r.outlier);
const outliersRuns = runs.filter(r => r.McrRatioRuns != null && (r.McrRatioRuns < RATIO_LO || r.McrRatioRuns > RATIO_HI));
const errors = runs.filter(r => r.verdict === 'ERROR');
const throwsOk = runs.filter(r => r.verdict === 'THROWS'), throwsBad = runs.filter(r => r.verdict === 'WRONG THROW' || r.verdict === 'NO THROW');
const GROUPS = [...new Set(selected.map(c => groupOf(c.id)))];
const tableGroup = {};
GROUPS.forEach(g => { tableGroup[g] = {}; VERDICTS.forEach(v => tableGroup[g][v] = runs.filter(r => groupOf(r.id) === g && r.verdict === v).length); tableGroup[g].runs = runs.filter(r => groupOf(r.id) === g).length; tableGroup[g].cases = selected.filter(c => groupOf(c.id) === g).length; });
const cantRows = runs.filter(r => r.cantSN006a);
const checkTotals = {};
runs.forEach(r => (r.checks || []).forEach(k => { const t = checkTotals[k.id] = checkTotals[k.id] || { run: 0, ok: 0, fail: 0 }; t.run++; if (k.ok) t.ok++; else t.fail++; }));
const triggerMismatches = runs.filter(r => r.triggerMismatch && (r.triggerMismatch.missing.length || r.triggerMismatch.extra.length));
const checkFailsAll = runs.filter(r => r.checkFailures && r.checkFailures.length);

const summary = {
  generated: new Date().toISOString(), node: process.version, cases: selected.length, runs: runs.length,
  verdicts: count(runs, r => r.verdict), byFamily: tableFam, byMethod: tableMethod, byGroup: tableGroup,
  expectedErrors: { ok: throwsOk.length, failed: throwsBad.map(r => ({ id: r.id, verdict: r.verdict, error: r.error })) },
  pairs: pairRows, cantileverSN006a: cantRows.map(r => Object.assign({ id: r.id }, r.cantSN006a)),
  checkTotals, checkFailures: checkFails.map(r => ({ id: r.id, method: r.method, failed: r.checkFailures })),
  ratioOutliersSameSegment: outliers.map(r => ({ id: r.id, ratio: r.McrRatio, route: r.c1route, reason: outlierReason(r, cases.find(c => c.id === r.id).overrides) })),
  ratioOutliersAcrossRuns: outliersRuns.map(r => ({ id: r.id, ratio: r.McrRatioRuns })),
  errors: errors.map(r => ({ id: r.id, method: r.method, error: r.error })),
  triggerMismatches: triggerMismatches.map(r => ({ id: r.id, method: r.method, missing: r.triggerMismatch.missing, extra: r.triggerMismatch.extra })),
  totalMs: Date.now() - t00
};

const outDir = __dirname;
fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify({ summary, runs }, null, 1));

// ---------------------------------------------------------------------------
// markdown
// ---------------------------------------------------------------------------
const md = [];
md.push('# Batch verification results');
md.push('');
md.push(`Generated ${summary.generated} with Node ${process.version}; ${summary.cases} cases, ${summary.runs} runs (LTB cases run with both Mcr methods), ${(summary.totalMs / 1000).toFixed(1)} s.`);
md.push('');
md.push('Verdicts: ' + VERDICTS_MAIN.map(v => `${v} ${summary.verdicts[v] || 0}`).join(' | ') + `. Expected-error group: ${throwsOk.length} THROWS as declared, ${throwsBad.length} failed. Cross-check failures: ${checkFails.length} runs (${checkFails.filter(r => r.checkFailures.every(k => k === 'viii-Mend')).length} of them only viii-Mend - the End 2 web-bearing station moment, finding F-A corrected by the 19 Sep 2026 review fixes; ${checkFails.filter(r => !r.checkFailures.every(k => k === 'viii-Mend')).length} other). Eigen/standard Mcr ratio outliers (outside ${RATIO_LO}-${RATIO_HI}, same segment): ${outliers.length}; across the two runs (whole-member standard vs design eigen): ${outliersRuns.length}.`);
md.push('');
md.push('## Verdict counts per group');
md.push('');
md.push('| Group | Cases | Runs | PASS | FAIL | NOT VERIFIED | ERROR | THROWS | failed throw |');
md.push('|---|---|---|---|---|---|---|---|---|');
GROUPS.forEach(g => md.push(`| ${g} | ${tableGroup[g].cases} | ${tableGroup[g].runs} | ${tableGroup[g].PASS} | ${tableGroup[g].FAIL} | ${tableGroup[g]['NOT VERIFIED']} | ${tableGroup[g].ERROR} | ${tableGroup[g].THROWS} | ${tableGroup[g]['WRONG THROW'] + tableGroup[g]['NO THROW']} |`));
md.push('');
md.push('## Verdict counts per section family');
md.push('');
md.push('| Family | Cases | Runs | PASS | FAIL | NOT VERIFIED | ERROR |');
md.push('|---|---|---|---|---|---|---|');
FAMS.forEach(f => md.push(`| ${f.toUpperCase()} | ${tableFam[f].cases} | ${tableFam[f].runs} | ${tableFam[f].PASS} | ${tableFam[f].FAIL} | ${tableFam[f]['NOT VERIFIED']} | ${tableFam[f].ERROR} |`));
md.push('');
md.push('(The family counts exclude the ERR group: ' + throwsOk.length + ' invalid layouts threw the declared message' + (throwsBad.length ? ', ' + throwsBad.length + ' did not' : '') + '.)');
md.push('');
md.push('## Verdict counts per Mcr method');
md.push('');
md.push('| Method | Runs | PASS | FAIL | NOT VERIFIED | ERROR |');
md.push('|---|---|---|---|---|---|');
Object.keys(tableMethod).forEach(m => md.push(`| ${m} | ${tableMethod[m].runs} | ${tableMethod[m].PASS} | ${tableMethod[m].FAIL} | ${tableMethod[m]['NOT VERIFIED']} | ${tableMethod[m].ERROR} |`));
md.push('');
md.push('## Cross-check totals');
md.push('');
md.push('| Check | Runs | OK | Mismatch |');
md.push('|---|---|---|---|');
Object.keys(checkTotals).forEach(k => md.push(`| ${k} | ${checkTotals[k].run} | ${checkTotals[k].ok} | ${checkTotals[k].fail} |`));
md.push('');
md.push('## Expected-error group (invalid layouts)');
md.push('');
md.push('| Case | Layout | Expected message contains | Verdict | Thrown message |');
md.push('|---|---|---|---|---|');
runs.filter(r => r.expectError).forEach(r => md.push(`| ${r.id} | ${mdEsc(r.title)} | ${mdEsc(r.expectError)} | ${r.verdict} | ${mdEsc((r.error || '').slice(0, 160))} |`));
md.push('');
if (pairRows.length) {
  md.push('## End-restraint bounds (xvi): eigen Mcr of the case against its base');
  md.push('');
  md.push('| Case | Base | Mcr case | Mcr base | Eigen ratio | Closed-form ratio | OK | Why |');
  md.push('|---|---|---|---|---|---|---|---|');
  pairRows.forEach(r => md.push(`| ${r.id} | ${r.base} | ${fmt(r.Mcr, 1)} | ${fmt(r.McrBase, 1)} | ${fmt(r.ratio, 3)} | ${r.closed ? fmt(r.closed.ratio, 3) + ' (' + r.closed.label + ')' : '-'} | ${r.ok ? 'yes' : 'NO'} | ${mdEsc(r.why)} |`));
  md.push('');
}
if (cantRows.length) {
  md.push('## Cantilevers (xvii): Mcr eigen against NCCI SN006a');
  md.push('');
  md.push('| Case | Root warping | SN006a case | C | kwt | eta | Mcr SN006a | Mcr eigen | Ratio | Title |');
  md.push('|---|---|---|---|---|---|---|---|---|---|');
  cantRows.forEach(r => { const k = r.cantSN006a; md.push(`| ${r.id} | ${k.warp || '-'} | ${mdEsc(k.caseLbl || k.reason || '-')} | ${fmt(k.C, 3)} | ${fmt(k.kwt, 3)} | ${fmt(k.eta, 2)} | ${fmt(k.McrSN006a, 1)} | ${fmt(k.McrEigen, 1)} | ${fmt(k.ratio, 3)} | ${mdEsc(r.title)} |`); });
  md.push('');
}
if (outliers.length) {
  md.push('## Eigen / standard Mcr outliers (same segment, from the eigen run)');
  md.push('');
  md.push('| Case | Ratio | Standard route | Mcr eigen | Mcr standard | Reason | Title |');
  md.push('|---|---|---|---|---|---|---|');
  outliers.forEach(r => md.push(`| ${r.id} | ${fmt(r.McrRatio, 3)} | ${r.c1route || '-'} | ${fmt(r.Mcr, 1)} | ${fmt(r.McrStd, 1)} | ${mdEsc(outlierReason(r, cases.find(c => c.id === r.id).overrides))} | ${mdEsc(r.title)} |`));
  md.push('');
}
if (checkFails.length) {
  md.push('## Cross-check mismatches (> 0.5 %)');
  md.push('');
  md.push('| Case | Method | Check | Detail |');
  md.push('|---|---|---|---|');
  checkFails.forEach(r => r.checks.filter(k => !k.ok && k.kind === 'check').forEach(k => md.push(`| ${r.id} | ${r.method} | ${k.id} | ${mdEsc(k.detail)} |`)));
  md.push('');
}
if (errors.length) {
  md.push('## Errors');
  md.push('');
  errors.forEach(r => md.push(`- ${r.id} (${r.method}): ${mdEsc(r.error)}`));
  md.push('');
}
if (triggerMismatches.length) {
  md.push('## Expected-vs-observed trigger mismatches (comparable subset)');
  md.push('');
  md.push('| Case | Method | Expected but not observed | Observed but not expected |');
  md.push('|---|---|---|---|');
  triggerMismatches.forEach(r => md.push(`| ${r.id} | ${r.method} | ${r.triggerMismatch.missing.join(', ') || '-'} | ${r.triggerMismatch.extra.join(', ') || '-'} |`));
  md.push('');
}
md.push('## Runs');
md.push('');
md.push('| Id | Title | Section | Method | Verdict | Governing check (util) | Combos | Mcr kN.m | C1 | lamLT | chiLT | Mb,Rd | Mc,Rd | Vpl,Rd | d/dlim | Unsupported / blocking | ms |');
md.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
runs.filter(r => !r.expectError).forEach(r => {
  const msgs = r.verdict === 'ERROR' ? r.error : (r.unsupported || []).map(s => s.slice(0, 120)).join(' / ');
  md.push(`| ${r.id} | ${mdEsc(r.title)} | ${r.section} | ${r.method} | ${r.verdict}${r.checkFailures && r.checkFailures.length ? ' (check: ' + r.checkFailures.join(',') + ')' : ''}${r.outlier ? ' (ratio outlier)' : ''} | ${r.gov ? mdEsc(r.gov.name) + ' (' + fmt(r.gov.val, 3) + ')' : '-'} | ${r.nCombos != null ? r.nCombos + (r.patterns && r.patterns.active ? ' (' + r.patterns.nUls + ' patt.)' : '') : '-'} | ${fmt(r.Mcr, 1)} | ${fmt(r.C1, 3)} | ${fmt(r.lamLT, 3)} | ${fmt(r.chiLT, 3)} | ${fmt(r.MbRd, 1)} | ${fmt(r.McRd, 1)} | ${fmt(r.VplRd, 1)} | ${fmt(r.deflRatio, 3)} | ${mdEsc(msgs || '-')} | ${fmt(r.ms, 0)} |`);
});
md.push('');
fs.writeFileSync(path.join(outDir, 'results.md'), md.join('\n'));

console.log('');
console.log(`cases ${summary.cases}, runs ${summary.runs}: ` + VERDICTS_MAIN.map(v => `${v} ${summary.verdicts[v] || 0}`).join(', ') + `; expected-error group: ${throwsOk.length} threw as declared, ${throwsBad.length} failed`);
const mendOnly = checkFails.filter(r => r.checkFailures.every(k => k === 'viii-Mend')).length;
console.log(`cross-check failures: ${checkFails.length} (${mendOnly} are viii-Mend only (End 2 station moment, corrected finding F-A), ${checkFails.length - mendOnly} other); pair bounds: ${pairRows.filter(r => !r.ok).length} violated of ${pairRows.length}; ratio outliers: ${outliers.length} (same segment), ${outliersRuns.length} (across runs); errors: ${errors.length}; trigger mismatches: ${triggerMismatches.length}; ${(summary.totalMs / 1000).toFixed(1)} s`);
console.log('written: ' + path.join(outDir, 'results.json') + ', ' + path.join(outDir, 'results.md'));
process.exitCode = (errors.length || throwsBad.length) ? 1 : 0;
