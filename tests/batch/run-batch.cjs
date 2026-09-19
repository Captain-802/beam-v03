'use strict';
/* ===========================================================================
   Headless batch runner - 100-beam verification campaign
   ---------------------------------------------------------------------------
   Loads the app through tests/harness.cjs (Node vm, no DOM), runs analyse()
   and checks() for every case in tests/batch/cases.cjs - both Mcr methods
   ('eigen' and 'standard') when restraint === 'ltb' - and writes
     tests/batch/results.json   full records
     tests/batch/results.md     one row per run + summary tables
   Thrown errors are caught and reported as verdict ERROR.

   Independent cross-checks (computed here from the section data and the
   inputs, never from the check engine's own intermediate values):
     (i)   simply supported / cantilever single-load closed forms for Mmax and
           dmax (full-span UDL, central or tip point load; self-weight included)
     (ii)  vertical equilibrium  sum(R) + sum(applied) = 0  for every case
     (iii) standard closed-form Mcr recomputed for doubly symmetric sections
           (I/H and box: SN003a with G = 81000, Iw = 0 for a box; cantilever:
           SN006a C*Mcr0) with C1, C2, z_g and LE derived HERE from the case
           inputs (load list, support types, za / per-load zg, LE factor and
           destabilising switch) and the analysis moment diagram - never from
           the engine's own C1 / C2 / zgUsed / LE; also checks that a
           destabilising z_g on a non-tabulated diagram is BLOCKED
     (iv)  eigen / standard Mcr ratio, flagged outside 0.85-1.25 (an outlier,
           not necessarily an error)
     (v)   Mb,Rd <= Mc,Rd
     (vi)  the reported governing utilisation equals the maximum of the
           printed utilisations
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
     LE     - leFactor x (destab ? 1.2 : 1) x segment length
   Returns {C1, C2, zg, zgApplied, LE, route, blockExpected}. */
/* Effective load list of a combination, applied independently of the engine:
   a pattern combination (mask = {case, segs:[{a,b} mm]}) keeps only the parts
   of its patterned-case loads that lie inside the masked segments (distributed
   loads clipped with the trapezoid interpolated at the cut, point loads and
   couples assigned to the first segment containing them). Other cases and
   unmasked combinations return the case's own list. */
function maskedLoads(o, mask) {
  if (!mask) return o.loads;
  const segs = mask.segs.map(s => [s.a / 1000, s.b / 1000]);
  const segIdx = x => { for (let i = 0; i < segs.length; i++) if (x >= segs[i][0] - 1e-9 && x <= segs[i][1] + 1e-9) return i; return -1; };
  const out = [];
  for (const ld of o.loads) {
    if (ld.case !== mask.case) { out.push(ld); continue; }
    if (ld.type === 'point' || ld.type === 'moment') { if (segIdx(ld.pos) >= 0) out.push(ld); continue; }
    for (const [a, b] of segs) {
      const x1 = Math.max(ld.x1, a), x2 = Math.min(ld.x2, b);
      if (x2 - x1 <= 1e-9) continue;
      const wAt = x => ld.type === 'udl' ? ld.w : ld.w1 + (ld.w2 - ld.w1) * (x - ld.x1) / (ld.x2 - ld.x1);
      out.push(ld.type === 'udl' ? Object.assign({}, ld, { x1, x2 }) : Object.assign({}, ld, { x1, x2, w1: wAt(x1), w2: wAt(x2) }));
    }
  }
  return out;
}
function stdInputsIndependent(o, fac, fb, xa, xb, mask) {
  const L = o.L, Lmm = L * 1000, whole = xa <= 1e-6 && Math.abs(xb - Lmm) <= 1e-6;
  const loads = maskedLoads(o, mask);
  const sup = o.supports;
  const supAt = x => sup.find(sp => Math.abs(sp.pos * 1000 - x) < 1e-6);
  const sA = supAt(xa), sB = supAt(xb);
  const endSupported = !!(sA && sB), endFixed = !!(sA && sB && sA.type === 'fixed' && sB.type === 'fixed');
  const interior = sup.some(sp => sp.pos * 1000 > xa + 1e-6 && sp.pos * 1000 < xb - 1e-6) || (o.hinges || []).some(h => h.pos * 1000 > xa + 1e-6 && h.pos * 1000 < xb - 1e-6);
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
  let Mm = 0; fb.xs.forEach((x, i) => { if (x >= xa - 1e-6 && x <= xb + 1e-6) Mm = Math.max(Mm, Math.abs(fb.M[i]) / 1e6); });
  const Ls = xb - xa, M0 = Mat(xa + 1e-4), ML = Mat(xb - 1e-4);
  const endLevel = Mm > 1e-9 ? Math.max(Math.abs(M0), Math.abs(ML)) / Mm : 0;
  const r = Mm > 1e-9 ? (Math.abs(Mat(xa + Ls / 4)) + Math.abs(Mat(xa + 3 * Ls / 4))) / (2 * Mm) : 0;
  let C1, C2 = null, route;
  const notLoaded = nUdl + nPoint + nOther === 0;
  const isLinear = fb.xs.every((x, i) => x < xa + 1e-4 || x > xb - 1e-4 || Math.abs(fb.M[i] / 1e6 - (M0 + (ML - M0) * (x - xa) / Ls)) <= 0.05 * Mm);
  const isCant = sup.length === 1 && sup[0].type === 'fixed';
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
    const M2 = Mat(xa + Ls / 4), M3 = Mat(xa + Ls / 2), M4 = Mat(xa + 3 * Ls / 4);
    const d = Mm * Mm + 9 * M2 * M2 + 16 * M3 * M3 + 9 * M4 * M4;
    C1 = d > 0 ? Math.sqrt(35 * Mm * Mm / d) : 1; route = 'serna';
  }
  const LE = (o.leFactor != null ? o.leFactor : 1) * (o.destab ? 1.2 : 1) * Ls;
  const zgApplied = Math.abs(zg) > 1e-9 && C2 != null && C2 > 0;
  return { C1, C2, zg, zgApplied, LE, route, blockExpected: zg > 0 && !(C2 > 0) && !o.destab };
}

/* Applicability of the single-load closed forms (i). Returns null or
   {kind:'ss'|'cant', udl: sum of full-span w by case, point: sum of P by case}. */
function closedFormLayout(o) {
  const sup = o.supports, L = o.L, loads = o.loads;
  if ((o.hinges || []).length) return null;
  const isSS = sup.length === 2 && sup.every(s => s.type === 'pinned') && sup.some(s => s.pos === 0) && sup.some(s => Math.abs(s.pos - L) < 1e-9);
  const isCant = sup.length === 1 && sup[0].type === 'fixed' && sup[0].pos === 0;
  if (!isSS && !isCant) return null;
  const udl = {}, point = {};
  let nPoint = 0;
  for (const ld of loads) {
    if (ld.type === 'udl' && ld.x1 === 0 && Math.abs(ld.x2 - L) < 1e-9) udl[ld.case] = (udl[ld.case] || 0) + ld.w;
    else if (ld.type === 'point' && Math.abs(ld.pos - (isSS ? L / 2 : L)) < 1e-9) { point[ld.case] = (point[ld.case] || 0) + ld.P; nPoint++; }
    else return null;
  }
  if (isSS && nPoint > 1) return null;   // one central point load only (UDLs may accompany it)
  return { kind: isSS ? 'ss' : 'cant', udl, point };
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
  if ((c.unsupported || []).some(s => /torsional-flexural/i.test(s))) t.add('3.10');
  if (c.ltb) { ['3.1', '3.2', '3.3', '3.6'].forEach(x => t.add(x)); if (o.family === 'ub' || o.family === 'uc') t.add('3.5'); else t.add('3.4'); }
  else t.add('3.1');
  if ((o.ltbRestraints || []).length) t.add('3.17');
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
        gM:a.governM.combo.factors, gD:a.governD.combo.factors, gMask:a.governM.combo.mask||null, gLabel:a.governM.combo.label};
    })()`);
  } catch (e) {
    rec.verdict = 'ERROR';
    rec.error = stripHtml(e && e.message ? e.message : e);
    rec.ms = Number(process.hrtime.bigint() - t0) / 1e6;
    return rec;
  }
  rec.ms = Number(process.hrtime.bigint() - t0) / 1e6;
  const { a, c, gl, sec, sw, E, py, za, gM, gD, gMask, gLabel } = out;
  rec.nCombos = a.ulsResults.length;
  rec.patterns = a.patterns ? { active: !!a.patterns.active, nUls: a.patterns.nUls, nSls: a.patterns.nSls } : null;
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

  // (i) closed forms
  const cf = closedFormLayout(cs.overrides);
  if (cf) {
    const Lmm = cs.overrides.L * 1000, I = sec.Ix * 1e4;
    const tot = fac => {
      let w = sw * (fac.G || 0), Pt = 0;
      for (const k in cf.udl) w += cf.udl[k] * (fac[k] || 0);
      for (const k in cf.point) Pt += cf.point[k] * (fac[k] || 0);
      return { w, Pt };   // kN/m (= N/mm), kN
    };
    const m = tot(gM), d = tot(gD);
    const Mexp = cf.kind === 'ss' ? (m.w * cs.overrides.L ** 2 / 8 + m.Pt * cs.overrides.L / 4) : (m.w * cs.overrides.L ** 2 / 2 + m.Pt * cs.overrides.L);
    const dexp = cf.kind === 'ss' ? (5 * d.w * Lmm ** 4 / 384 + d.Pt * 1000 * Lmm ** 3 / 48) / (E * I) : (d.w * Lmm ** 4 / 8 + d.Pt * 1000 * Lmm ** 3 / 3) / (E * I);
    const okM = rel(Math.abs(a.Mmax), Math.abs(Mexp)) <= TOL;
    const okD = rel(Math.abs(a.dmax), Math.abs(dexp)) <= TOL;
    add('i-Mmax', okM, `${cf.kind}: closed form ${fmt(Math.abs(Mexp), 2)} vs engine ${fmt(Math.abs(a.Mmax), 2)} kN.m`);
    add('i-dmax', okD, `${cf.kind}: closed form ${fmt(Math.abs(dexp), 3)} vs engine ${fmt(Math.abs(a.dmax), 3)} mm`);
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
        // whole member, governing-moment combination (a generated pattern where one governs): every input from the case
        const ind = stdInputsIndependent(cs.overrides, gM, a.governM.fb, 0, cs.overrides.L * 1000, gMask);
        const exp = mcrClosedFormIndependent(sec, E, ind.LE, ind.C1, ind.C2, ind.zg, ind.zgApplied);
        add('iii-McrStd', rel(exp, L.Mcr) <= TOL, `SN003a (independent ${ind.route}${gMask ? ', pattern ' + gLabel : ''}): C1 ${fmt(ind.C1, 3)}, C2 ${ind.C2 == null ? '-' : fmt(ind.C2, 3)}, zg ${fmt(ind.zg, 0)} mm${ind.zgApplied ? ' applied' : ''}, LE ${fmt(ind.LE / 1000, 2)} m -> ${fmt(exp, 2)} vs engine ${fmt(L.Mcr, 2)} kN.m (engine route ${L.c1route || '-'})`);
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
        // the comparison describes the LTB-governing combination (label printed by the engine, possibly a
        // generated pattern) over its segment; its factors and mask come from the analysed list
        const govRes = L.governCombo ? a.ulsResults.find(r => r.combo.label === L.governCombo) : null;
        const gov = govRes ? govRes.combo : null;
        if (gov && govRes) {
          const ind = stdInputsIndependent(cs.overrides, gov.factors, govRes.fb, s.seg.xa, s.seg.xb, gov.mask || null);
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
  //       engine for that support, and every reported lifting support must carry a hold-down message
  {
    const negGov = a.reactions.map((r, i) => ({ i: i + 1, V: r.V })).filter(r => r.V < -1);
    const reported = new Set((a.uplift ? a.uplift.supports : []).map(u => u.n));
    const okA = negGov.every(r => reported.has(r.i));
    const msgs = (c.unsupported || []).concat(c.advisory || []).filter(m => /^Hold-down/.test(m));
    // a support lifting in the governing (ULS) combination must be BLOCKING unless its hold-down box is ticked
    const okC = negGov.every(r => { const sp = cs.overrides.supports[r.i - 1]; return sp && sp.holdDown ? true : (c.unsupported || []).some(m => new RegExp('^Hold-down required: .*at support ' + r.i + ' ').test(m)); });
    const okB = (a.uplift && a.uplift.supports.length) ? a.uplift.supports.every(u => msgs.some(m => new RegExp('at support ' + u.n + ' ').test(m))) : msgs.length === 0;
    add('vii-uplift', okA && okB && okC, negGov.length ? `governing combination lifts support(s) ${negGov.map(r => r.i + ' (' + fmt(r.V / 1000, 2) + ' kN)').join(', ')}; engine reports ${[...reported].join(', ') || 'none'}` : `no uplift in the governing combination; engine reports ${[...reported].join(', ') || 'none'} (${msgs.length} hold-down message(s))`);
  }

  // (iv) eigen / standard ratio (same segment) - outlier flag, not an error
  if (method === 'eigen' && L && !L.failed && L.McrRatio != null) {
    const r = L.McrRatio;
    add('iv-McrRatio', r >= RATIO_LO && r <= RATIO_HI, `Mcr eigen / standard = ${fmt(r, 3)} (${fmt(rec.Mcr, 1)} / ${fmt(L.McrStandard, 1)} kN.m, route ${L.c1route || '-'})`, 'flag');
  }

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
  const methods = cs.overrides.restraint === 'ltb' ? ['eigen', 'standard'] : ['n/a'];
  for (const m of methods) {
    const rec = runOne(cs, m === 'n/a' ? 'eigen' : m);
    if (m === 'n/a') rec.method = 'n/a (restrained)';
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

// ---------------------------------------------------------------------------
// summaries
// ---------------------------------------------------------------------------
const VERDICTS = ['PASS', 'FAIL', 'NOT VERIFIED', 'ERROR'];
const FAMS = ['ub', 'uc', 'pfc', 'shs', 'rhs'];
const count = (list, key) => { const o = {}; list.forEach(r => { o[key(r)] = (o[key(r)] || 0) + 1; }); return o; };
const tableFam = {}, tableMethod = {};
FAMS.forEach(f => { tableFam[f] = {}; VERDICTS.forEach(v => tableFam[f][v] = runs.filter(r => r.family === f && r.verdict === v).length); tableFam[f].runs = runs.filter(r => r.family === f).length; tableFam[f].cases = selected.filter(c => c.overrides.family === f).length; });
['eigen', 'standard', 'n/a (restrained)'].forEach(m => { tableMethod[m] = {}; VERDICTS.forEach(v => tableMethod[m][v] = runs.filter(r => r.method === m && r.verdict === v).length); tableMethod[m].runs = runs.filter(r => r.method === m).length; });
const checkFails = runs.filter(r => r.checkFailures && r.checkFailures.length);
const outliers = runs.filter(r => r.outlier);
const outliersRuns = runs.filter(r => r.McrRatioRuns != null && (r.McrRatioRuns < RATIO_LO || r.McrRatioRuns > RATIO_HI));
const errors = runs.filter(r => r.verdict === 'ERROR');
const checkTotals = {};
runs.forEach(r => (r.checks || []).forEach(k => { const t = checkTotals[k.id] = checkTotals[k.id] || { run: 0, ok: 0, fail: 0 }; t.run++; if (k.ok) t.ok++; else t.fail++; }));
const triggerMismatches = runs.filter(r => r.triggerMismatch && (r.triggerMismatch.missing.length || r.triggerMismatch.extra.length));

const summary = {
  generated: new Date().toISOString(), node: process.version, cases: selected.length, runs: runs.length,
  verdicts: count(runs, r => r.verdict), byFamily: tableFam, byMethod: tableMethod,
  checkTotals, checkFailures: checkFails.map(r => ({ id: r.id, method: r.method, failed: r.checkFailures })),
  ratioOutliersSameSegment: outliers.map(r => ({ id: r.id, ratio: r.McrRatio, route: r.c1route })),
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
md.push('Verdicts: ' + VERDICTS.map(v => `${v} ${summary.verdicts[v] || 0}`).join(' | ') + `. Cross-check failures: ${checkFails.length} runs. Eigen/standard Mcr ratio outliers (outside ${RATIO_LO}-${RATIO_HI}, same segment): ${outliers.length}; across the two runs (whole-member standard vs design eigen): ${outliersRuns.length}.`);
md.push('');
md.push('## Verdict counts per section family');
md.push('');
md.push('| Family | Cases | Runs | PASS | FAIL | NOT VERIFIED | ERROR |');
md.push('|---|---|---|---|---|---|---|');
FAMS.forEach(f => md.push(`| ${f.toUpperCase()} | ${tableFam[f].cases} | ${tableFam[f].runs} | ${tableFam[f].PASS} | ${tableFam[f].FAIL} | ${tableFam[f]['NOT VERIFIED']} | ${tableFam[f].ERROR} |`));
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
if (outliers.length) {
  md.push('## Eigen / standard Mcr outliers (same segment, from the eigen run)');
  md.push('');
  md.push('| Case | Ratio | Standard route | Mcr eigen | Mcr standard | Note |');
  md.push('|---|---|---|---|---|---|');
  outliers.forEach(r => md.push(`| ${r.id} | ${fmt(r.McrRatio, 3)} | ${r.c1route || '-'} | ${fmt(r.Mcr, 1)} | ${fmt(r.McrStd, 1)} | ${mdEsc(r.title)} |`));
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
runs.forEach(r => {
  const msgs = r.verdict === 'ERROR' ? r.error : (r.unsupported || []).map(s => s.slice(0, 120)).join(' / ');
  md.push(`| ${r.id} | ${mdEsc(r.title)} | ${r.section} | ${r.method} | ${r.verdict}${r.checkFailures && r.checkFailures.length ? ' (check: ' + r.checkFailures.join(',') + ')' : ''}${r.outlier ? ' (ratio outlier)' : ''} | ${r.gov ? mdEsc(r.gov.name) + ' (' + fmt(r.gov.val, 3) + ')' : '-'} | ${r.nCombos != null ? r.nCombos + (r.patterns && r.patterns.active ? ' (' + r.patterns.nUls + ' patt.)' : '') : '-'} | ${fmt(r.Mcr, 1)} | ${fmt(r.C1, 3)} | ${fmt(r.lamLT, 3)} | ${fmt(r.chiLT, 3)} | ${fmt(r.MbRd, 1)} | ${fmt(r.McRd, 1)} | ${fmt(r.VplRd, 1)} | ${fmt(r.deflRatio, 3)} | ${mdEsc(msgs || '-')} | ${fmt(r.ms, 0)} |`);
});
md.push('');
fs.writeFileSync(path.join(outDir, 'results.md'), md.join('\n'));

console.log('');
console.log(`cases ${summary.cases}, runs ${summary.runs}: ` + VERDICTS.map(v => `${v} ${summary.verdicts[v] || 0}`).join(', '));
console.log(`cross-check failures: ${checkFails.length}; ratio outliers: ${outliers.length} (same segment), ${outliersRuns.length} (across runs); errors: ${errors.length}; trigger mismatches: ${triggerMismatches.length}; ${(summary.totalMs / 1000).toFixed(1)} s`);
console.log('written: ' + path.join(outDir, 'results.json') + ', ' + path.join(outDir, 'results.md'));
process.exitCode = errors.length ? 1 : 0;
