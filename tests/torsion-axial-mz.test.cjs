// 20 Sep 2026 torsion + N/Mz: combined torsion with direct axial force and an
// imposed minor-axis moment, verified as Eurocode advises (js/checks/eurocode-checks.js,
// comment block above checksEC3Restrained):
//   (1) EN 1993-1-1 6.2.7(5) with the yield criterion 6.2.1(5) Eq (6.1) at every
//       torsion station and section point (tor.elastic, utilisation "Elastic yield
//       criterion (6.1) with torsion, cl 6.2.7(5)");
//   (2) EN 1993-6 (A.1) with M_z,Ed = M_z,tot = M_z + phi.M_y, C_mz = 1.0 with an imposed M_z;
//   (3) Eq 6.61/6.62 with M_z,Ed = M_z + max|phi.M_y| (annexB2);
//   (4) the "not implemented as one interaction" block is gone; tor.combinedBasis printed;
//       the superposition of Eq 6.62 and (A.1) is an advisory, not a utilisation.
// 20 Sep 2026 review (reviewer findings): (6.1) is verdict-binding (c.utils) only where the
//   code gives no plastic route - Class 3, or an open Class 1/2 section with N_Ed - and is
//   information (c.info, advisory when > 1) for Class 1/2 sections with N_Ed = 0 and for
//   Class 1/2 hollow sections (6.2.7(5) "may be applied", 6.2.7(6) plastic route); the
//   closed-section shear flow V Q_c/(I t) at the corner and V Q_m/(I t) at the web mid-depth
//   (Eq 6.20); the flange shear flow at P2; the channel points P1b (S_w1 at W_n = 0) and P2
//   (S_w2 at the junction); the basis text per path.
// (a) REGRESSION: every existing number of the N = 0, M_z = 0 torsion case equals the
//     value computed at commit c2e9fba (hard-coded below, obtained before the change).
// (b) HAND CHECK: the (6.1) stresses recomputed here from sol.phi/p1/p2/p3, the force
//     diagram and the section table, independently of the engine.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { app } = require('./harness.cjs');
const c = app();
const run = x => c.run(x);
const near = (a, e, rel = 1e-6, what = '') => assert.ok(Math.abs(a - e) <= rel * Math.max(1, Math.abs(e)), `${what}: ${a} != ${e}`);
const same = (a, e, what = '') => assert.equal(a, e, `${what}: ${a} != ${e} (must be digit for digit)`);
// linear interpolation with the same rule as interpAt (first bracketing interval)
const lin = (xs, ys, xq) => {
  if (xq <= xs[0]) return ys[0];
  if (xq >= xs[xs.length - 1]) return ys[ys.length - 1];
  for (let i = 0; i < xs.length - 1; i++) if (xq >= xs[i] && xq <= xs[i + 1]) { const t = xs[i + 1] === xs[i] ? 0 : (xq - xs[i]) / (xs[i + 1] - xs[i]); return ys[i] + (ys[i + 1] - ys[i]) * t; }
  return ys[ys.length - 1];
};
const combos = [
  { id: 'c1', label: 'ULS 1.35G+1.5Q', factors: { G: 1.35, Q: 1.5, W: 0, E: 0 }, sls: false, on: true },
  { id: 's1', label: 'SLS 1.0G+1.0Q', factors: { G: 1, Q: 1, W: 0, E: 0 }, sls: true, on: true }];
// the DEMO-like torsion case: UB 457x191x82 S275, L = 6 m, G 10 + Q 8 kN/m UDL and Q 30 kN at 2 m, all at e = +40 mm
const UB = (extra, method) => Object.assign({ family: 'ub', ubKey: '457 x 191 x 82', grade: 'S275', L: 6, code: 'EC3', restraint: 'ltb', mcrMethod: method || 'standard', combos, eccOn: true,
  loads: [{ type: 'udl', x1: 0, x2: 6, w: 10, case: 'G', e: 40, zg: 0 }, { type: 'udl', x1: 0, x2: 6, w: 8, case: 'Q', e: 40, zg: 0 }, { type: 'point', pos: 2, P: 30, case: 'Q', e: 40, zg: 0 }] }, extra || {});
const SHS = { family: 'shs', shsType: 'HF', shsKey: '150x150x6.3', grade: 'S275', L: 4, code: 'EC3', restraint: 'ltb', mcrMethod: 'standard', combos, eccOn: true, axial: 200,
  loads: [{ type: 'udl', x1: 0, x2: 4, w: 3, case: 'G', e: 40, zg: 0 }, { type: 'udl', x1: 0, x2: 4, w: 3, case: 'Q', e: 40, zg: 0 }, { type: 'point', pos: 2, P: 8, case: 'Q', e: 40, zg: 0 }] };
const PFC = { family: 'pfc', sectionKey: '300x100x46', grade: 'S275', L: 5, code: 'EC3', restraint: 'ltb', mcrMethod: 'standard', combos, eccOn: true, axial: 100,
  loads: [{ type: 'udl', x1: 0, x2: 5, w: 5, case: 'G', e: 40, zg: 0 }, { type: 'udl', x1: 0, x2: 5, w: 4, case: 'Q', e: 40, zg: 0 }, { type: 'point', pos: 2, P: 10, case: 'Q', e: 40, zg: 0 }] };
const ELASTIC = 'Elastic yield criterion (6.1) with torsion, cl 6.2.7(5)';
// everything a hand check needs: section table, the P385 solution of every ULS combination with its force diagram, the check object
function full(over) {
  c.reset(over);
  return JSON.parse(run(`(()=>{ const a=analyse(); const cc=checks(a); const sec=a.sec; const T=cc.tor||null;
    const sols=(a.torsO&&a.torsO.ok)? a.torsO.sols.map(se=>({combo:se.combo.label, xs:se.sol.xs, phi:se.sol.phi, p1:se.sol.p1, p2:se.sol.p2, p3:se.sol.p3, fxs:se.fb.xs, fM:se.fb.M, fV:se.fb.V})) : null;
    const box=(a.tors&&a.tors.uls)? a.tors.uls.map(u=>({combo:u.combo.label, xs:u.r.xs, T:u.r.T, nodes:u.r.nodes, phi:u.r.phi})) : null;
    const uls=a.ulsResults.map(r=>({combo:r.combo.label, xs:r.fb.xs, M:r.fb.M, V:r.fb.V}));
    return JSON.stringify({E:a.E, fy:cc.fy, sec:{A:sec.A,Ix:sec.Ix,Iy:sec.Iy,Zx:sec.Zx,Zy:sec.Zy,Sx:sec.Sx,Sy:sec.Sy,D:sec.D,B:sec.B,tw:sec.tw,tf:sec.tf,kind:sec.kind,isBox:!!sec.isBox,tp:sec.tp||null},
      sols, box, uls, tor:T, annex:cc.annex||null, buck:cc.buck||null, ltb:cc.ltb? {MbRd:cc.ltb.MbRd} : null, utils:cc.utils, info:cc.info||[], pass:cc.pass, unsupported:cc.unsupported, advisory:cc.advisory||[], cls:cc.cl.cls}); })()`));
}
// the section points of the open-section (6.1) check at one station, from the raw solution (independent of the engine):
// I/H: P1, P2, P3, P4; channel: P1, P1b, P2, P3, P4 (comment block of js/checks/eurocode-checks.js, item (1))
function openPoints(r, sol, i, NEd, MzImp) {
  const s = r.sec, E = r.E, G = 81000, fyd = r.fy / 1.0, chan = s.kind === 'channel', tp = s.tp;
  const A = s.A * 100, Iy = s.Ix * 1e4, Iz = s.Iy * 1e4, Wely = s.Zx * 1e3, Welz = s.Zy * 1e3;
  const x = sol.xs[i], My = Math.abs(lin(sol.fxs, sol.fM, x)), V = Math.abs(lin(sol.fxs, sol.fV, x));
  const phi = sol.phi[i], p1 = Math.abs(sol.p1[i]), p2 = Math.abs(sol.p2[i]), p3 = Math.abs(sol.p3[i]);
  const MzTot = MzImp * 1e6 + Math.abs(phi * My);
  const Wn0 = tp.Wn0 * 100, Wn2 = chan ? tp.Wn2 * 100 : 0;
  const Sw1 = tp.Sw1 * 1e4, Sw2 = chan ? tp.Sw2 * 1e4 : 0, Sw3 = chan ? tp.Sw3 * 1e4 : 0, SwJ = chan ? Sw2 : Sw1;
  const Sf = s.B * s.tf * (s.D - s.tf) / 2, Smax = Sf + s.tw * Math.pow(s.D / 2 - s.tf, 2) / 2, SfF = chan ? Sf : Sf / 2;
  const yWeb = chan ? s.B - Iz / Welz : s.tw / 2;
  const Bf = s.B - s.tw / 2, s1 = chan ? Bf * Wn0 / (Wn0 + Wn2) : 0, yToe = Iz / Welz, y1b = Math.abs(yToe - s1);
  const sN = Math.abs(NEd) * 1e3 / A;
  const u61 = (sx, tau) => Math.pow(sx / fyd, 2) + 3 * Math.pow(tau / fyd, 2);
  const mk = (o) => { const sigmaX = o.sigmaN + o.sigmaMy + o.sigmaMz + o.sigmaW, tau = o.tauV + o.tauT + o.tauW; return Object.assign(o, { sigmaX, tau, u: u61(sigmaX, tau) }); };
  const pts = [mk({ point: 'P1 flange tip', sigmaN: sN, sigmaMy: My / Wely, sigmaMz: MzTot / Welz, sigmaW: E * Wn0 * p2, tauV: 0, tauT: G * s.tf * p1, tauW: 0 })];
  if (chan) pts.push(mk({ point: 'P1b flange at W_n = 0', sigmaN: sN, sigmaMy: My * (s.D / 2 - s.tf / 2) / Iy, sigmaMz: MzTot * y1b / Iz, sigmaW: 0, tauV: V * s1 * s.tf * (s.D - s.tf) / 2 / (Iy * s.tf), tauT: G * s.tf * p1, tauW: E * Sw1 * p3 / s.tf }));
  pts.push(
    mk({ point: 'P2 web-flange junction, flange', sigmaN: sN, sigmaMy: My * (s.D / 2 - s.tf / 2) / Iy, sigmaMz: MzTot * yWeb / Iz, sigmaW: E * Wn2 * p2, tauV: V * SfF / (Iy * s.tf), tauT: G * s.tf * p1, tauW: E * SwJ * p3 / s.tf }),
    mk({ point: 'P3 web-flange junction, web', sigmaN: sN, sigmaMy: My * (s.D / 2 - s.tf) / Iy, sigmaMz: MzTot * yWeb / Iz, sigmaW: E * Wn2 * p2, tauV: V * Sf / (Iy * s.tw), tauT: G * s.tw * p1, tauW: chan ? E * Sw2 * p3 / s.tw : 0 }),
    mk({ point: 'P4 web mid-depth', sigmaN: sN, sigmaMy: 0, sigmaMz: MzTot * yWeb / Iz, sigmaW: 0, tauV: V * Smax / (Iy * s.tw), tauT: G * s.tw * p1, tauW: chan ? E * Sw3 * p3 / s.tw : 0 }));
  return { x, My, V, phi, MzTot, s1, y1b, pts };
}
const COMPONENTS = ['sigmaN', 'sigmaMy', 'sigmaMz', 'sigmaW', 'sigmaX', 'tauV', 'tauT', 'tauW', 'tau', 'u'];
const hasUtil = r => r.utils.some(u => u.name === ELASTIC), hasInfo = r => r.info.some(u => u.name === ELASTIC);

test('(a) regression: UB 457x191x82 6 m torsion case with N = 0 and M_z = 0 reproduces the commit-c2e9fba numbers digit for digit (standard and eigen); the (6.1) value is information (Class 1, N = 0: 6.2.7(6) plastic route), not a utilisation, so the verdict is unchanged too', () => {
  // reference values computed at commit c2e9fba before any change (docs/owner-cases/masterseries UB6-L2 [standard])
  // 20 Sep 2026 accuracy (after the c2e9fba snapshot): M_f,Rd is now the flange plastic moment t_f b^2 f_y/4 = 40.255 kN.m
  // (SCI P385 3.1.2; MasterSeries prints 40.255) instead of M_pl,z/2 = 41.80, so the P385 3.1.2 value moved 0.40773 -> 0.41455,
  // k_w 0.66458 -> 0.66322 (MasterSeries 0.663) and (A.1) 0.89048 -> 0.89701 (standard) / 0.89671 -> 0.90330 (eigen); every
  // other number below is the c2e9fba value unchanged.
  const r = full(UB());
  same(r.tor.cross.x, 2340.249, 'cross.x'); same(r.tor.cross.My, 168.74692652514673, 'cross.My'); same(r.tor.cross.phi, 0.058280788342441534, 'cross.phi');
  same(r.tor.cross.Mw, 7.425917673443597, 'cross.Mw'); same(r.tor.cross.Mz, 9.83470390824961, 'cross.Mz'); same(r.tor.cross.u, 0.41454643179663503, 'cross.u');
  same(r.tor.vtUtil, 0.15624063226790916, 'vtUtil'); same(r.tor.VplTRd, 702.4921648085124, 'VplTRd');
  same(r.tor.MwMax, 7.735731593207449, 'MwMax'); same(r.tor.MzMax, 10.129371360928966, 'MzMax'); same(r.tor.tauT, 27.217033041183278, 'tauT'); same(r.tor.phiUmax, 0.06053953977493273, 'phiUmax');
  same(r.annex.u, 0.8970076450250333, 'annex.u'); same(r.annex.kAlpha, 1.7357838548120148, 'kAlpha'); same(r.annex.kw, 0.6632211780571463, 'kw'); same(r.annex.kzw, 0.8818963954209422, 'kzw');
  same(r.annex.x, 2365.1452, 'annex.x'); same(r.annex.My, 168.8018712464713, 'annex.My'); same(r.annex.Mz, 9.873461342809234, 'annex.Mz'); same(r.annex.Mw, 7.40270501512229, 'annex.Mw');
  same(r.annex.MbA, 285.0390390813504, 'MbA'); same(r.annex.McrA, 398.3755294713009, 'McrA'); same(r.annex.Cmz, 1, 'Cmz');
  same(r.ltb.MbRd, 293.4324867594356, 'MbRd');
  const REF = [['Shear  V_Ed/V_c,Rd', 0.1451324707269072], ['Bending  M_Ed/M_c,Rd', 0.33555546825169946], ['LTB  M_Ed/M_b,Rd', 0.5754928203846456], ['Deflection', 0.33315166620045805],
    ['LTB+torsion (EN 1993-6 Annex A)', 0.8970076450250333], ['Web transverse force  F_Ed/F_Rd (EN 1993-1-5 6.2)', 0.250966624182756], ['Web transverse force + bending (EN 1993-1-5 7.2)', 0.25725631339612975],
    ['Bending+torsion cross-section (P385 3.1.2)', 0.41454643179663503], ['Shear+torsion  V_Ed/V_pl,T,Rd', 0.15624063226790916]];
  // utils are EXACTLY the c2e9fba list (the (6.1) value is c.info here, so the verdict basis of an N = 0 / M_z = 0 input is untouched)
  assert.deepEqual(r.utils.map(u => u.name), REF.map(x => x[0]), 'utils names and order');
  REF.forEach(([n, v], i) => same(r.utils[i].val, v, n));
  assert.equal(r.pass, true); assert.deepEqual(r.unsupported, []);
  assert.equal(r.cls, 1); assert.ok(!hasUtil(r) && hasInfo(r), 'Class 1, N = 0: the (6.1) value is information, not a utilisation');
  const el = r.info.find(u => u.name === ELASTIC); assert.ok(el.val > 0 && el.val < 1, 'the (6.1) entry is present');
  near(el.val, r.tor.elastic.u, 1e-15, '(6.1) info = tor.elastic.u'); assert.equal(r.tor.elastic.binding, false); assert.ok(/6\.2\.7\(6\)/.test(r.tor.elastic.bindingBasis) && el.note === r.tor.elastic.bindingBasis);
  assert.ok(!r.advisory.some(s => /elastic yield criterion/.test(s)), 'no advisory while (6.1) <= 1');
  assert.ok(/^No expression in EN 1993-1-1 or EN 1993-6/.test(r.tor.combinedBasis) && /information only/.test(r.tor.combinedBasis) && /\(A\.1\) with M_z,Ed/.test(r.tor.combinedBasis) && !/6\.61\/6\.62/.test(r.tor.combinedBasis), 'basis text of the N = 0 unrestrained path: ' + r.tor.combinedBasis);
  // M_z,tot bookkeeping with no imposed M_z: identical to the twist part
  same(r.tor.MzImp, 0, 'MzImp'); same(r.tor.MzTot, r.tor.MzMax, 'MzTot = MzMax'); same(r.tor.cross.MzTot, r.tor.cross.Mz, 'cross.MzTot');
  same(r.annex.MzTot, r.annex.Mz, 'annex.MzTot'); same(r.annex.MzImp, 0, 'annex.MzImp');
  // eigen route: same regression (reference values of the same commit)
  const e = full(UB({}, 'eigen'));
  same(e.tor.cross.u, 0.41454643179663503, 'eigen cross.u'); same(e.tor.vtUtil, 0.15624063226790916, 'eigen vtUtil');
  same(e.annex.u, 0.9033036756804487, 'eigen annex.u'); same(e.annex.kAlpha, 1.7530698990711375, 'eigen kAlpha'); same(e.annex.McrA, 393.107389067589, 'eigen McrA');
  same(e.ltb.MbRd, 290.42139396061475, 'eigen MbRd'); same(e.utils.find(u => /^LTB  /.test(u.name)).val, 0.5814595374491202, 'eigen LTB util');
  same(e.tor.elastic.u, r.tor.elastic.u, 'the (6.1) value is a cross-section quantity: identical on both routes');
  assert.equal(e.pass, true); assert.ok(!hasUtil(e) && hasInfo(e));
});

test('(b) hand check: UB 457x191x82 with N = 300 kN and M_z = 30 kN.m - the (6.1) stresses at every station and point recomputed from sol.phi/p1/p2/p3, the force diagram and the section table; binding (open section with N_Ed); M_z,tot in (A.1) and Eq 6.62; block gone; pass consistent', () => {
  const NEd = 300, MzImp = 30;
  const r = full(UB({ axial: NEd, Mz: MzImp }));
  assert.ok(r.sols && r.sols.length === 1, 'one ULS combination');
  const sol = r.sols[0];
  // independent sweep over every station and the four points
  let best = { u: -1 }, MzTwistMax = 0;
  sol.xs.forEach((x, i) => {
    const st = openPoints(r, sol, i, NEd, MzImp);
    MzTwistMax = Math.max(MzTwistMax, Math.abs(st.phi * st.My) / 1e6);
    st.pts.forEach((p, k) => { if (p.u > best.u) best = { u: p.u, i, k, st, p }; });
  });
  const el = r.tor.elastic;
  near(el.u, best.u, 1e-6, '(6.1) governing value'); assert.equal(el.x, sol.xs[best.i], 'governing station');
  assert.equal(el.point, best.p.point, 'governing point'); assert.equal(el.combo, sol.combo);
  // every component at the governing point, and all four points at that station
  COMPONENTS.forEach(k => near(el[k], best.p[k], 1e-6, 'governing ' + k));
  assert.equal(el.points.length, 4); assert.deepEqual(el.points.map(p => p.point), ['P1 flange tip', 'P2 web-flange junction, flange', 'P3 web-flange junction, web', 'P4 web mid-depth']);
  best.st.pts.forEach((p, k) => COMPONENTS.forEach(q => near(el.points[k][q], p[q], 1e-6, `point ${k} ${q}`)));
  near(el.sigmaN, NEd * 1e3 / (r.sec.A * 100), 1e-12, 'sigma_N = N/A'); near(el.MzTot, MzImp + Math.abs(best.st.phi * best.st.My) / 1e6, 1e-9, 'M_z,tot at the station');
  near(el.fy, r.fy, 1e-12); assert.equal(el.box, false);
  // P2 carries the flange shear flow V (S_f/2)/(I_y t_f) (half flange, one side of the web) - 20 Sep 2026 review
  const s = r.sec, Sf = s.B * s.tf * (s.D - s.tf) / 2;
  near(el.points[1].tauV, best.st.V * (Sf / 2) / (s.Ix * 1e4 * s.tf), 1e-9, 'P2 tau_V = V S_f/(2 I_y t_f)'); assert.ok(el.points[1].tauV > 0);
  near(el.geom.SfF, Sf / 2, 1e-12); near(el.geom.Sf, Sf, 1e-12);
  // hand values of the governing point (flange tip, x = 2290.46 mm): sigma_N 28.85, sigma_My 104.71, sigma_Mz 202.80, sigma_w 76.28, tau_t 12.34 N/mm2 -> (6.1) = 2.258 (fails: M_z = 30 kN.m is 0.56 M_el,z alone)
  assert.equal(el.point, 'P1 flange tip'); near(el.sigmaN, 28.8462, 1e-4); near(el.sigmaMy, 104.713, 1e-4); near(el.sigmaMz, 202.801, 1e-4); near(el.sigmaW, 76.2832, 1e-4); near(el.tauT, 12.3415, 1e-4); near(el.u, 2.25761, 1e-4);
  // binding: an open Class 1 section with N_Ed has no plastic N + bimoment route
  assert.equal(r.cls, 1); assert.equal(el.binding, true); assert.ok(/N_Ed/.test(el.bindingBasis) && /verdict-binding/.test(el.bindingBasis));
  assert.ok(hasUtil(r) && !hasInfo(r), '(6.1) in utils, not in info');
  // (2) Annex A: M_z,tot = 30 + |phi.M_y| at the governing station, in both terms, C_mz = 1.0
  const A = r.annex, ia = sol.xs.indexOf(A.x); assert.ok(ia >= 0, 'annex station is a torsion station');
  const MyA = Math.abs(lin(sol.fxs, sol.fM, A.x)) / 1e6, MzTwA = Math.abs(sol.phi[ia] * MyA);
  near(A.MzTot, MzImp + MzTwA, 1e-9, 'annex.MzTot = 30 + |phi My|'); near(A.MzTwist, MzTwA, 1e-9); same(A.MzImp, MzImp); same(A.Cmz, 1, 'C_mz = 1.0 with an imposed M_z');
  near(A.kzw, 1 - A.MzTot / A.MzR, 1e-12, 'k_zw with M_z,tot');
  near(A.u, A.My / A.MbA + A.Cmz * A.MzTot / A.MzR + A.kw * A.kzw * A.kAlpha * A.Mw / A.MfR, 1e-12, '(A.1) with M_z,tot');
  assert.ok(/C_mz = 1\.0/.test(A.CmzBasis));
  // (3) Eq 6.61/6.62: M_z,Ed = 30 + max over the member of |phi.M_y|
  near(r.buck.MzEd, MzImp + MzTwistMax, 1e-9, 'buck.MzEd = 30 + max|phi My|'); same(r.buck.MzImp, MzImp); near(r.buck.MzTwist, MzTwistMax, 1e-9);
  near(r.buck.mzTerm, r.buck.MzEd / r.buck.Mcz, 1e-12); same(r.buck.Cmz, 1);
  near(r.buck.u2, r.buck.nz + r.buck.kzy * r.buck.Mx / r.buck.MbRdEff + r.buck.kzz * r.buck.mzTerm, 1e-12, 'Eq 6.62');
  // P385 3.1.2 with M_z,tot (Class 1): (My/Mpl,y)^2 + Mw/Mpl,f + M_z,tot/Mpl,z
  near(r.tor.cross.u, Math.pow(r.tor.cross.My / r.tor.Mply, 2) + r.tor.cross.Mw / r.tor.Mplf + r.tor.cross.MzTot / r.tor.Mplz, 1e-12, 'P385 3.1.2 with M_z,tot');
  near(r.tor.cross.MzTot, MzImp + r.tor.cross.Mz, 1e-12);
  // (4) the block is gone; verdict is a boolean consistent with the utilisations; basis and advisory present
  assert.ok(!r.unsupported.some(s => /not implemented as one interaction/.test(s)), 'old block message gone'); assert.deepEqual(r.unsupported, []);
  assert.equal(typeof r.pass, 'boolean'); assert.equal(r.pass, r.utils.every(u => Number.isFinite(u.val) && u.val <= 1.0001)); assert.equal(r.pass, false);
  assert.ok(r.tor.combinedBasis.startsWith('No expression in EN 1993-1-1 or EN 1993-6 combines N_Ed with warping torsion at member level'));
  assert.ok(/6\.61\/6\.62/.test(r.tor.combinedBasis) && /\(A\.1\) with M_z,Ed = M_z \+ phi\.M_y/.test(r.tor.combinedBasis) && !/information only/.test(r.tor.combinedBasis), 'basis names 6.61/6.62 and (A.1), no "information only" (binding): ' + r.tor.combinedBasis);
  assert.ok(r.utils.some(u => u.name === ELASTIC && u.val === r.tor.elastic.u));
  const sup = r.tor.superposition; assert.ok(sup && sup.label === 'superposition of Eq 6.62 and (A.1) - not a Eurocode expression, information only');
  near(sup.u, r.buck.u2 + sup.uw, 1e-12); assert.ok(!r.utils.some(u => /superposition/i.test(u.name)), 'the superposition is not a utilisation');
  assert.ok(r.advisory.some(s => /superposition of Eq 6\.62 and \(A\.1\) - not a Eurocode expression, information only/.test(s)), 'printed as an advisory');
  // eigen route carries the same cross-section quantities and its own (A.1) with M_z,tot
  const e = full(UB({ axial: NEd, Mz: MzImp }, 'eigen'));
  near(e.tor.elastic.u, r.tor.elastic.u, 1e-12); same(e.annex.Cmz, 1); near(e.annex.MzTot, e.annex.MzImp + e.annex.MzTwist, 1e-12); assert.deepEqual(e.unsupported, []);
  assert.ok(hasUtil(e) && !hasInfo(e)); assert.ok(e.advisory.some(s => /superposition/.test(s)));
  assert.ok(/6\.61\/6\.62/.test(e.tor.combinedBasis) && /\(A\.1\) with M_z,Ed/.test(e.tor.combinedBasis), 'eigen basis');
});

test('(c) hollow section: SHS 150x150x6.3 4 m, e = 40 mm, N = 200 kN - (6.1) with tau_t = T/W_t, the closed-section shear flow V Q_c/(I t) at the corner and V Q_m/(I t) at the web mid-depth (Eq 6.20), N/A; information for the Class 1 box (plastic route 6.2.7(7)/(9), 6.2.8(4), 6.2.9.1); twist-induced phi.M_y enters Eq 6.62', () => {
  const r = full(SHS);
  const el = r.tor.elastic; assert.ok(el && el.box, 'box elastic check present');
  const Wt = r.sec.tp.Wt * 1e3; same(r.tor.Wt, Wt, 'W_t from the P385 table');
  const bx = r.box[0], ul = r.uls[0];
  const T = Math.abs(lin(bx.xs, bx.T, el.x)), My = Math.abs(lin(ul.xs, ul.M, el.x)), V = Math.abs(lin(ul.xs, ul.V, el.x)), phi = lin(bx.nodes, bx.phi, el.x);
  const s = r.sec, t = s.tf, Iy = s.Ix * 1e4, sN = 200e3 / (s.A * 100), MzTot = Math.abs(phi * My);
  // mid-line shear flow of the closed section, cut at the flange mid-width (q = 0 by symmetry): Q_c at the corner, Q_m at the web mid-depth
  const Qc = ((s.B - t) / 2) * t * ((s.D - t) / 2), Qm = Qc + t * Math.pow(s.D - t, 2) / 8;
  near(Qc, 32523.26, 1e-5, 'Q_c = 71.85 x 6.3 x 71.85 mm3 (hand)'); near(Qm, 48784.89, 1e-5, 'Q_m = Q_c + 6.3 x 143.7^2/8 (hand)');
  near(el.geom.Qc, Qc, 1e-12); near(el.geom.Qm, Qm, 1e-12);
  near(el.tauT, T / Wt, 1e-9, 'tau_t = T/W_t'); near(el.sigmaN, sN, 1e-12);
  const pts = el.points; assert.deepEqual(pts.map(p => p.point), ['corner', 'web mid-depth', 'flange mid-width']);
  near(pts[0].sigmaMy, My / (s.Zx * 1e3), 1e-9); near(pts[0].sigmaMz, MzTot / (s.Zy * 1e3), 1e-9); near(pts[0].tauV, V * Qc / (Iy * t), 1e-9, 'corner tau_V = V Q_c/(I_y t)'); near(pts[0].tau, T / Wt + V * Qc / (Iy * t), 1e-9);
  near(pts[1].tauV, V * Qm / (Iy * t), 1e-9, 'web mid-depth tau_V = V Q_m/(I_y t)'); near(pts[1].tau, T / Wt + V * Qm / (Iy * t), 1e-9); near(pts[1].sigmaX, sN + MzTot / (s.Zy * 1e3), 1e-9);
  near(pts[2].sigmaX, sN + My / (s.Zx * 1e3), 1e-9); near(pts[2].tau, T / Wt, 1e-9);
  const fyd = r.fy; pts.forEach(p => near(p.u, Math.pow(p.sigmaX / fyd, 2) + 3 * Math.pow(p.tau / fyd, 2), 1e-12, p.point));
  near(el.u, Math.max(...pts.map(p => p.u)), 1e-12);
  // hand: corner at x = 2.0 m: sigma_N 55.87 + sigma_My 183.09 = 239.1 N/mm2, tau_t = 0.24e6/240e3 = 1.0, tau_V = 6000 x 32523/(12.2e6 x 6.3) = 2.539 -> (239.1/275)^2 + 3(3.539/275)^2 = 0.7564
  assert.equal(el.point, 'corner'); near(el.sigmaN, 55.8659, 1e-4); near(el.sigmaMy, 183.094, 1e-4); near(el.tauT, 1.0, 1e-9); near(el.tauV, 2.5389, 1e-4); near(el.u, 0.756436, 1e-5);
  // Class 1 hollow section: information, not a utilisation; the code's plastic route is the verdict basis
  assert.equal(r.cls, 1); assert.equal(el.binding, false); assert.ok(/hollow section/.test(el.bindingBasis) && /6\.2\.8\(4\)/.test(el.bindingBasis) && /6\.2\.9\.1/.test(el.bindingBasis));
  assert.ok(!hasUtil(r) && hasInfo(r) && r.info.find(u => u.name === ELASTIC).val === el.u);
  assert.ok(r.utils.some(u => /^Torsion  T_Ed\/T_Rd/.test(u.name)) && r.utils.some(u => /Shear\+torsion/.test(u.name)) && r.utils.some(u => /Eq 6\.62/.test(u.name)));
  // Eq 6.62 carries the (tiny) twist-induced minor moment; no block; the P385 open-section items are absent; the basis names the hollow-section route only
  assert.ok(r.buck.MzTwist > 0 && r.buck.MzTwist < 0.1); same(r.buck.MzImp, 0); near(r.buck.MzEd, r.buck.MzTwist, 1e-12);
  assert.deepEqual(r.unsupported, []); assert.equal(r.annex, null); assert.ok(!r.tor.superposition, 'no warping term for a hollow section');
  assert.ok(/^EN 1993-1-1 6\.2\.7\(7\): warping neglected/.test(r.tor.combinedBasis) && /does not apply to a closed section/.test(r.tor.combinedBasis) && /6\.61\/6\.62/.test(r.tor.combinedBasis) && !/warping torsion at member level/.test(r.tor.combinedBasis), 'box basis: ' + r.tor.combinedBasis);
  // pushed past first yield (M_z = 5 kN.m): the informational value exceeds 1 -> advisory, verdict untouched by it
  const r2 = full(Object.assign({}, SHS, { Mz: 5, loads: [{ type: 'udl', x1: 0, x2: 4, w: 10, case: 'Q', e: 40 }] }));
  assert.ok(r2.tor.elastic.u > 1 && !hasUtil(r2) && hasInfo(r2), '(6.1) > 1 as information');
  assert.ok(r2.advisory.some(s => /^ADVISORY - elastic yield criterion \(6\.1\) with torsion, cl 6\.2\.7\(5\) = 1\.\d{3} at x = /.test(s) && /information only, not a utilisation/.test(s)), 'advisory printed: ' + JSON.stringify(r2.advisory));
  assert.equal(r2.pass, r2.unsupported.length === 0 && r2.utils.every(u => u.val <= 1.0001));
});

test('(d) channel: PFC 300x100x46 5 m, e = 40 mm, N = 100 kN - five points: P1 toe (W_n0), P1b flange at W_n = 0 (S_w1, s_1 = B\' W_n0/(W_n0 + W_n2) from the toe), P2/P3 junction (W_n2, S_w2 flange and web side, the whole-flange shear flow), P4 web mid-depth (S_w3); the web M_z stress at c_y = B - I_z/W_el,z; binding (N_Ed)', () => {
  const r = full(PFC);
  const el = r.tor.elastic, sol = r.sols[0], i = sol.xs.indexOf(el.x); assert.ok(i >= 0);
  const st = openPoints(r, sol, i, 100, 0);
  assert.deepEqual(el.points.map(p => p.point), ['P1 flange tip', 'P1b flange at W_n = 0', 'P2 web-flange junction, flange', 'P3 web-flange junction, web', 'P4 web mid-depth']);
  st.pts.forEach((p, k) => COMPONENTS.forEach(q => near(el.points[k][q], p[q], 1e-6, `PFC point ${k} ${q}`)));
  const s = r.sec, tp = s.tp, E = r.E, p2 = Math.abs(sol.p2[i]), p3 = Math.abs(sol.p3[i]);
  // P1b position: omega is linear along the flange with W_n0 (toe) and W_n2 (web line) of opposite sign, so s_1 = B' W_n0/(W_n0 + W_n2) = B' - e_0
  const Bf = s.B - s.tw / 2, s1 = Bf * tp.Wn0 / (tp.Wn0 + tp.Wn2);
  near(el.geom.s1, s1, 1e-12, 's_1'); near(s1, Bf - tp.e0, 5e-3, 's_1 = B\' - e_0 (P385 Table A.3 e_0 = 36.7 mm)'); near(s1, 58.75, 2e-3);
  near(el.geom.y1b, Math.abs(s.Iy * 1e4 / (s.Zy * 1e3) - s1), 1e-12, 'y_1 = |y_toe - s_1|');
  near(el.points[1].sigmaW, 0, 1e-12, 'sigma_w = 0 at W_n = 0'); near(el.points[1].tauW, E * tp.Sw1 * 1e4 * p3 / s.tf, 1e-9, 'tau_w(S_w1) at P1b');
  near(el.points[1].tauV, st.V * s1 * s.tf * (s.D - s.tf) / 2 / (s.Ix * 1e4 * s.tf), 1e-9, 'flange shear flow at P1b');
  near(el.points[2].sigmaW, E * tp.Wn2 * 100 * p2, 1e-9, 'sigma_w(W_n2) at the junction'); near(el.points[3].sigmaW, E * tp.Wn2 * 100 * p2, 1e-9);
  near(el.points[2].tauW, E * tp.Sw2 * 1e4 * p3 / s.tf, 1e-9, 'tau_w flange side of the junction: S_w2 (20 Sep 2026 review: not max(S_w1,S_w2,S_w3))');
  near(el.points[2].tauV, st.V * (s.B * s.tf * (s.D - s.tf) / 2) / (s.Ix * 1e4 * s.tf), 1e-9, 'P2 tau_V = V S_f/(I_y t_f), the whole flange on one side of the web');
  near(el.points[3].tauW, E * tp.Sw2 * 1e4 * p3 / s.tw, 1e-9, 'tau_w web side, S_w2'); near(el.points[4].tauW, E * tp.Sw3 * 1e4 * p3 / s.tw, 1e-9, 'tau_w web mid-depth, S_w3');
  near(el.points[0].sigmaW, E * tp.Wn0 * 100 * p2, 1e-9, 'sigma_w(W_n0) at the toe');
  const cy = s.B - s.Iy * 1e4 / (s.Zy * 1e3); near(cy, 30.48, 2e-3, 'c_y of the 300x100x46 (Blue Book 3.05 cm)');
  near(el.points[2].sigmaMz, el.MzTot * 1e6 * cy / (s.Iy * 1e4), 1e-9, 'M_z stress on the web back'); near(el.points[0].sigmaMz, el.MzTot * 1e6 / (s.Zy * 1e3), 1e-9, 'M_z stress at the toe');
  assert.ok(el.points[2].sigmaW > 0 && el.points[3].tauW > 0 && el.points[4].tauW > 0 && el.points[1].tauW > el.points[2].tauW, 'channel warping terms are non-zero; S_w1 > S_w2');
  // hand: toe at x = 2.0 m (point load): 17.24 + 105.75 + 42.65 + 50.87 = 216.5 N/mm2, tau_t = 13.43 -> 0.675 (f_y = 265, t_f = 16.5 mm)
  assert.equal(el.point, 'P1 flange tip'); assert.equal(r.fy, 265); near(el.sigmaN, 17.2414, 1e-4); near(el.sigmaMy, 105.752, 1e-4); near(el.sigmaMz, 42.6528, 1e-4); near(el.sigmaW, 50.8654, 1e-4); near(el.tauT, 13.4251, 1e-4); near(el.u, 0.67523, 1e-4);
  // hand: P1b at the same station: tau_w = 210000 x 427e4 x phi'''/16.5 = 1.023, P2 tau_w = 0.623 (S_w2 = 260 cm4)
  near(el.points[1].tauW, 1.0232, 2e-4); near(el.points[2].tauW, 0.6230, 2e-4);
  assert.deepEqual(r.unsupported, []); assert.equal(el.binding, true); assert.ok(hasUtil(r) && !hasInfo(r));
  near(r.buck.MzEd, r.tor.MzTwistMax, 1e-12, 'Eq 6.62 M_z,Ed = max|phi My| (no imposed M_z)'); same(r.annex.Cmz, 1);
  assert.ok(r.tor.superposition && r.advisory.some(s => /superposition/.test(s)));
});

test('binding policy: Class 1/2 open with N = 0 and an imposed M_z -> information (P385 3.1.2 under 6.2.7(6) governs, verdict PASS with (6.1) > 1 as an advisory); tension N -> binding; Class 3 open -> binding without N', () => {
  // fully restrained UB with M_z = 30 and no N: the plastic biaxial 6.2.9.1 and P385 3.1.2 pass, the elastic tip stress is far past first yield
  const m = full(UB({ Mz: 30, restraint: 'full' }));
  assert.equal(m.cls, 1); assert.equal(m.tor.elastic.binding, false); assert.ok(!hasUtil(m) && hasInfo(m));
  assert.ok(m.tor.elastic.u > 1.5 && m.pass === true, '(6.1) ' + m.tor.elastic.u + ' as information, verdict from the plastic route: ' + m.pass);
  assert.ok(m.advisory.some(s => /^ADVISORY - elastic yield criterion \(6\.1\)/.test(s) && /6\.2\.7\(6\)/.test(s)));
  assert.ok(/does not apply to a fully restrained member without axial compression/.test(m.tor.combinedBasis) && /\(A\.1\) is not evaluated for a fully restrained member/.test(m.tor.combinedBasis) && /information only/.test(m.tor.combinedBasis), 'restrained N = 0 basis: ' + m.tor.combinedBasis);
  assert.ok(!m.utils.some(u => /Eq 6\.6[12]/.test(u.name)), 'no 6.61/6.62 utilisation for a fully restrained member without N (buck evaluated for the brief only)');
  // tension: |N|/A enters (6.1) (yield is symmetric), binding; 6.61/6.62 not evaluated and the basis says so
  const t = full(UB({ axial: -300 }));
  assert.equal(t.tor.elastic.binding, true); assert.ok(hasUtil(t) && !hasInfo(t)); near(t.tor.elastic.sigmaN, 300e3 / (t.sec.A * 100), 1e-12);
  assert.equal(t.buck, null); assert.ok(/not evaluated for axial tension/.test(t.tor.combinedBasis) && /\(A\.1\) with M_z,Ed/.test(t.tor.combinedBasis), 'tension basis: ' + t.tor.combinedBasis);
  // Class 3 open section (UB 457x191x82 S460: flange c/t 5.0 < 9 eps... use a slender-flanged UC 152x152x23 S460 - Class 3 in bending) with torsion and no N: binding
  const c3 = full({ family: 'uc', ucKey: '152 x 152 x 23', grade: 'S460', L: 4, code: 'EC3', restraint: 'ltb', mcrMethod: 'standard', combos, eccOn: true,
    loads: [{ type: 'udl', x1: 0, x2: 4, w: 2, case: 'G', e: 40, zg: 0 }, { type: 'point', pos: 2, P: 6, case: 'Q', e: 40, zg: 0 }] });
  assert.ok(c3.cls === 3, 'UC 152x152x23 S460 is Class 3 (got ' + c3.cls + ')');
  assert.equal(c3.tor.elastic.binding, true); assert.ok(hasUtil(c3) && !hasInfo(c3)); assert.ok(/^Class 3 section/.test(c3.tor.elastic.bindingBasis));
  assert.equal(c3.tor.cls12, false, 'the P385 3.1.2 elastic form runs alongside');
});

test('no torsion: an axial case without eccentricity is untouched (M_z twist part zero, no elastic entry, no info, no basis text)', () => {
  const r = full(UB({ axial: 300, eccOn: false, loads: [{ type: 'udl', x1: 0, x2: 6, w: 10, case: 'G' }, { type: 'udl', x1: 0, x2: 6, w: 8, case: 'Q' }, { type: 'point', pos: 2, P: 30, case: 'Q' }] }));
  assert.equal(r.tor, null); same(r.buck.MzTwist, 0); same(r.buck.MzEd, 0); same(r.buck.mzTerm, 0);
  assert.ok(!hasUtil(r) && !hasInfo(r)); assert.deepEqual(r.info, []); assert.ok(!r.advisory.some(s => /superposition|elastic yield/.test(s)));
  // reference (commit c2e9fba, UB6-L3 standard): Eq 6.61 / 6.62 unchanged
  same(r.buck.u1, r.buck.ny + r.buck.kyy * r.buck.Mx / r.buck.MbRdEff, 'Eq 6.61 without M_z');
});

test('fully restrained torsion + N: (6.1) binding and the basis present (6.61/6.62 named, (A.1) not evaluated), the advisory superposition uses k_alpha = 1 (no LTB check)', () => {
  const r = full(UB({ restraint: 'full', axial: 300 }));
  assert.ok(r.tor.elastic && r.tor.elastic.binding && hasUtil(r)); assert.equal(r.annex, null);
  const sup = r.tor.superposition; assert.ok(sup); same(sup.kAlpha, 1); near(sup.u, r.buck.u2 + sup.uw, 1e-12);
  assert.ok(r.advisory.some(s => /superposition/.test(s) && /no LTB check/.test(s)));
  assert.ok(/6\.61\/6\.62/.test(r.tor.combinedBasis) && /\(A\.1\) is not evaluated for a fully restrained member/.test(r.tor.combinedBasis), 'restrained N basis: ' + r.tor.combinedBasis);
  assert.deepEqual(r.unsupported, []); assert.equal(typeof r.pass, 'boolean');
});
