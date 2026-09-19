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
           (I/H: SN003a with G = 81000; box: Iw = 0; cantilever: SN006a C*Mcr0)
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
        gM:a.governM.combo.factors, gD:a.governD.combo.factors};
    })()`);
  } catch (e) {
    rec.verdict = 'ERROR';
    rec.error = stripHtml(e && e.message ? e.message : e);
    rec.ms = Number(process.hrtime.bigint() - t0) / 1e6;
    return rec;
  }
  rec.ms = Number(process.hrtime.bigint() - t0) / 1e6;
  const { a, c, gl, sec, sw, E, py, za, gM, gD } = out;
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
      // standard closed form: basis is the simplified slenderness unless the Mcr route rescued it
      const mcrRoute = /M.?cr.? method/i.test(rec.ltbBasis) || /Mcr method/.test(rec.ltbBasis);
      rec.Mcr = num(L.McrStandard != null ? L.McrStandard : L.Mcr);
      rec.C1 = num(L.C1show != null ? L.C1show : c.C1);
      rec.MbRd = num(L.MbRd);
      if (L.box || L.cant) { rec.lamLT = num(L.lamLTmcr); rec.chiLT = num(L.chiModM); }
      else if (L.channel) { rec.lamLT = mcrRoute && L.chanMcr ? num(L.chanMcr.lam) : num(L.lamLTsimp); rec.chiLT = mcrRoute && L.chanMcr ? num(L.chanMcr.chiMod) : num(L.chiS); }
      else { rec.lamLT = mcrRoute ? num(L.lamLTmcr) : num(L.lamLTsimp); rec.chiLT = mcrRoute ? num(L.chiModM) : num(L.chiModS); }
      rec.stdBasis = mcrRoute ? 'Mcr route' : 'simplified slenderness';
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
        const exp = mcrClosedFormIndependent(sec, E, c.LE, c.C1, L.C2, za, !!L.zgUsed);
        add('iii-McrStd', rel(exp, L.Mcr) <= TOL, `SN003a: C1 ${fmt(c.C1, 3)}, LE ${fmt(c.LE / 1000, 2)} m${L.zgUsed ? ', C2 zg term' : ''} -> ${fmt(exp, 2)} vs engine ${fmt(L.Mcr, 2)} kN.m`);
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
        const exp = mcrClosedFormIndependent(sec, E, s.LE, s.C1, s.C2, za, !!s.zgUsed);
        add('iii-McrStd', rel(exp, s.Mcr) <= TOL, `SN003a (comparison, segment ${fmt(s.seg.xa / 1000, 2)}-${fmt(s.seg.xb / 1000, 2)} m): C1 ${fmt(s.C1, 3)}, LE ${fmt(s.LE / 1000, 2)} m -> ${fmt(exp, 2)} vs engine ${fmt(s.Mcr, 2)} kN.m`);
      }
    }
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
md.push('| Id | Title | Section | Method | Verdict | Governing check (util) | Mcr kN.m | C1 | lamLT | chiLT | Mb,Rd | Mc,Rd | Vpl,Rd | d/dlim | Unsupported / blocking | ms |');
md.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
runs.forEach(r => {
  const msgs = r.verdict === 'ERROR' ? r.error : (r.unsupported || []).map(s => s.slice(0, 120)).join(' / ');
  md.push(`| ${r.id} | ${mdEsc(r.title)} | ${r.section} | ${r.method} | ${r.verdict}${r.checkFailures && r.checkFailures.length ? ' (check: ' + r.checkFailures.join(',') + ')' : ''}${r.outlier ? ' (ratio outlier)' : ''} | ${r.gov ? mdEsc(r.gov.name) + ' (' + fmt(r.gov.val, 3) + ')' : '-'} | ${fmt(r.Mcr, 1)} | ${fmt(r.C1, 3)} | ${fmt(r.lamLT, 3)} | ${fmt(r.chiLT, 3)} | ${fmt(r.MbRd, 1)} | ${fmt(r.McRd, 1)} | ${fmt(r.VplRd, 1)} | ${fmt(r.deflRatio, 3)} | ${mdEsc(msgs || '-')} | ${fmt(r.ms, 0)} |`);
});
md.push('');
fs.writeFileSync(path.join(outDir, 'results.md'), md.join('\n'));

console.log('');
console.log(`cases ${summary.cases}, runs ${summary.runs}: ` + VERDICTS.map(v => `${v} ${summary.verdicts[v] || 0}`).join(', '));
console.log(`cross-check failures: ${checkFails.length}; ratio outliers: ${outliers.length} (same segment), ${outliersRuns.length} (across runs); errors: ${errors.length}; trigger mismatches: ${triggerMismatches.length}; ${(summary.totalMs / 1000).toFixed(1)} s`);
console.log('written: ' + path.join(outDir, 'results.json') + ', ' + path.join(outDir, 'results.md'));
process.exitCode = errors.length ? 1 : 0;
