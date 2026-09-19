// 19 Sep 2026 gap closure, group G2 (docs/COVERAGE_MATRIX.md items 2.16 + 2.18):
// resistance of the web to transverse forces, EN 1993-1-5 clause 6, with the
// clause 7.2 interaction, at every point load and every support reaction.
// Expected values are hand derived step by step in the comments below
// ([hand-derived]; no published worked example with these inputs was at hand
// in-session, so the arithmetic is written out so that it can be checked
// against SCI P363 / P364 or a MasterSeries printout). Section data from
// js/sections/*.js (SCI P363): UB 457 x 191 x 82: h = 460.0, b = 191.3,
// t_w = 9.9, t_f = 16.0, W_pl,y = 1830 cm3; RHS 200 x 100 x 8.0: t = 8,
// flat web depth d = 22.0 x 8 = 176 (h - 3t, EN 10210 corners).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { app } = require('./harness.cjs');
const c = app();
const run = x => c.run(x);
function near(actual, expected, rel = 1e-5, what = '') { assert.ok(Math.abs(actual - expected) <= rel * Math.max(1, Math.abs(expected)), `${what} ${actual} != ${expected}`); }
const same = (a, b, what = '') => assert.equal(JSON.stringify(a), JSON.stringify(b), what);   // vm-context arrays are not prototype-identical to the host's
const num = s => parseFloat(String(s).replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/g, ''));
const Q15 = () => [{id:'c1', label:'ULS: 1.5Q', factors:{G:0,Q:1.5,W:0,E:0}, sls:false, on:true},
                   {id:'s1', label:'SLS: Q', factors:{G:0,Q:1,W:0,E:0}, sls:true, on:true}];
const probe = () => run(`(()=>{ const a=analyse(); const ch=checks(a); return {
  n:a.ulsResults.length, web:ch.web, utils:ch.utils.map(u=>({name:u.name,val:u.val})), pass:ch.pass, unsupported:ch.unsupported, advisory:ch.advisory||[], McRd:ch.McRd}; })()`);
const util = (r, re) => { const u = r.utils.find(u => re.test(u.name)); return u ? u.val : null; };
const U2 = /^Web transverse force  F_Ed\/F_Rd/, U72 = /^Web transverse force \+ bending/;

// ---------------------------------------------------------------------------
// [hand-derived] UB 457 x 191 x 82 S275 (f_y = 275, t_f = 16 <= 16 mm), simply
// supported L = 6 m, one point load P = 200 kN (Q) at mid-span, s_s = 100 mm at
// the load and at both supports, ULS 1.5Q (no G, so no self-weight):
//   F_Ed = 300 kN at mid-span, R = 150 kN at each end, M_Ed(mid) = PL/4 = 450 kN.m
//   eps = sqrt(235/275) = 0.92442; h_w = 460 - 2 x 16 = 428.0; t_w = 9.9; t_f = 16
//   b_f = 191.3 <= t_w + 30 eps t_f = 9.9 + 443.7 = 453.6 -> 191.3
//   m1 = 275 x 191.3/(275 x 9.9) = 19.3232
//   m2 = 0.02 (428/16)^2 = 0.02 x 715.5625 = 14.3113 (if lambda_F > 0.5)
//   a = L = 6000 (no stiffeners)
// Mid-span, type (a):
//   k_F = 6 + 2 (428/6000)^2 = 6.010178
//   F_cr = 0.9 x 6.010178 x 210000 x 9.9^3 / 428 = 0.9 x 6.010178 x 210000 x 970.299/428
//        = 2,575,192 N = 2575.2 kN
//   l_y = 100 + 2 x 16 (1 + sqrt(19.3232 + 14.3113)) = 100 + 32 x 6.79953 = 317.585 mm (<= a)
//   lambda_F = sqrt(317.585 x 9.9 x 275 / 2,575,192) = sqrt(0.335752) = 0.57944 (> 0.5, m2 stands)
//   chi_F = 0.5/0.57944 = 0.86290; L_eff = 0.86290 x 317.585 = 274.04 mm
//   F_Rd = 275 x 274.04 x 9.9 / 1.0 = 746,073 N = 746.1 kN
//   eta_2 = 300/746.07 = 0.4021
//   M_c,Rd = 1830 x 275 / 1e3 = 503.25 kN.m; eta_1 = 450/503.25 = 0.8942
//   eta_2 + 0.8 eta_1 = 0.4021 + 0.7154 = 1.1175 <= 1.4 -> ratio 1.1175/1.4 = 0.7982
// End support x = 0, d = 0 -> c = 0, s_s + c = 100 < 2 h_w/3 = 285.3 -> type (c)
// (type (a) is evaluated too: same F_Rd = 746.1 kN as mid-span, so (c) governs):
//   k_F = 2 + 6 x 100/428 = 3.40187 (<= 6)
//   F_cr = 0.9 x 3.40187 x 210000 x 970.299/428 = 1,457,608 N = 1457.6 kN
//   l_e = k_F E t_w^2/(2 f_yw h_w) = 3.40187 x 210000 x 98.01/(2 x 275 x 428) = 297.4 > s_s + c -> l_e = 100
//   l_y = min[100 + 16 sqrt(19.3232/2 + (100/16)^2 + 14.3113), 100 + 16 sqrt(19.3232 + 14.3113)]
//       = min[100 + 16 x 7.93948, 100 + 16 x 5.79953] = min[227.03, 192.79] = 192.79 mm
//   lambda_F = sqrt(192.79 x 9.9 x 275/1,457,608) = sqrt(0.360091) = 0.60008; chi_F = 0.83322
//   L_eff = 160.64 mm; F_Rd = 275 x 160.64 x 9.9 = 437,342 N = 437.3 kN
//   eta_2 = 150/437.34 = 0.3430; M = 0 -> 7.2 ratio = 0.3430/1.4 = 0.2450
// ---------------------------------------------------------------------------
test('[hand-derived] UB 457x191x82: type (a) at the mid-span load and type (c) at the end reactions reproduce the clause 6 chain', () => {
  c.reset({L:6, supports:[{pos:0,type:'pinned',ss:100},{pos:6,type:'pinned',ss:100}], loads:[{type:'point',pos:3,P:200,case:'Q',ss:100}], combos:Q15()});
  const r = probe(), W = r.web;
  assert.ok(W && W.checked && W.nWebs === 1 && !W.isBox);
  near(W.hw, 428, 1e-12); near(W.bf, 191.3, 1e-12); near(W.bfLim, 9.9 + 30 * Math.sqrt(235 / 275) * 16, 1e-9);
  near(W.m1, 19.3232, 1e-4); near(W.m2full, 14.3113, 1e-4);
  assert.match(W.aBasis, /a = L = 6000 mm/);
  assert.equal(W.stations.length, 3);
  const [s0, sm, sL] = W.stations;
  // mid-span: type (a) only (not in the end zone)
  assert.equal(sm.kind, 'load'); same(sm.types, ['a']); assert.equal(sm.type, 'a'); assert.equal(sm.endZone, false);
  const ta = sm.gov;
  near(ta.kF, 6.010178, 1e-6); near(ta.Fcr, 2575.2, 2e-4); near(ta.ly, 317.585, 1e-5); near(ta.lam, 0.57944, 2e-5); assert.equal(ta.iter, false);
  near(ta.chi, 0.86290, 2e-5); near(ta.Leff, 274.04, 1e-4); near(ta.FRd, 746.07, 1e-4); near(sm.FRdTot, 746.07, 1e-4);
  near(sm.F, 300, 1e-9); near(sm.eta2, 0.4021, 2e-4); near(sm.cases[sm.g2].M, 450, 1e-6); near(sm.cases[sm.g72].eta1, 450 / 503.25, 1e-6);
  near(sm.cases[sm.g72].u72raw, 1.1175, 2e-4); near(sm.u72, 0.7982, 2e-4);
  assert.equal(sm.cases[0].flange, 'top'); assert.equal(sm.cases[0].flangeComp, true); assert.equal(sm.cases[0].flangeState, 'in compression');
  // end support: type (c) governs over type (a)
  for (const s of [s0, sL]) {
    assert.equal(s.kind, 'support'); same(s.types, ['a', 'c']); assert.equal(s.type, 'c'); assert.equal(s.endZone, true);
    near(s.c, 0, 1e-12); near(s.ss, 100, 1e-12); assert.equal(s.ssDefault, false);
    const tc = s.sols.find(t => t.type === 'c'), taE = s.sols.find(t => t.type === 'a');
    near(tc.kF, 3.40187, 2e-6); near(tc.Fcr, 1457.6, 2e-4); near(tc.leRaw, 297.4, 2e-4); near(tc.le, 100, 1e-12);
    near(tc.l1, 227.03, 1e-4); near(tc.l2, 192.79, 1e-4); near(tc.ly, 192.79, 1e-4);
    near(tc.lam, 0.60008, 2e-5); near(tc.chi, 0.83322, 2e-5); near(tc.Leff, 160.64, 1e-4); near(tc.FRd, 437.34, 1e-4);
    near(taE.FRd, 746.07, 1e-4);
    near(s.FRdTot, 437.34, 1e-4); near(s.F, 150, 1e-9); near(s.eta2, 0.3430, 3e-4); near(s.u72, 0.2450, 3e-4);
    assert.equal(s.cases[0].flange, 'bottom'); assert.equal(s.cases[0].flangeState, 'no coincident moment'); assert.equal(s.cases[0].flangeComp, true);
  }
  // verdict entries: worst station of each
  assert.equal(W.gov2, sm); assert.equal(W.gov72, sm);
  near(util(r, U2), 0.4021, 2e-4); near(util(r, U72), 0.7982, 2e-4);
  assert.ok(r.pass, 'every utilisation <= 1');
  // the previous unconditional "outside scope" advisory is gone; the scope advisory names what is not evaluated
  assert.ok(!r.advisory.some(m => /outside this calculator's scope - verify separately wherever a point load/.test(m)));
  assert.ok(r.advisory.some(m => /^Web transverse forces \(EN 1993-1-5 clause 6\) are checked at every point load and support/.test(m)));
});

// ---------------------------------------------------------------------------
// [hand-derived] default s_s at a support = B = 191.3 mm [verify]; end reaction
// of the demo beam (457 x 191 x 82, 8 m, 1.35 x 19.7 + 1.5 x 19.8 + 1.35 x 0.8044
// self-weight = 57.38 kN/m -> R = 229.5 kN):
//   s_s + c = 191.3 < 285.3 -> type (c): k_F = 2 + 6 x 191.3/428 = 4.68178
//   F_cr = 0.9 x 4.68178 x 210000 x 970.299/428 = 2,006,000 N = 2006.0 kN
//   l_e = 4.68178 x 210000 x 98.01/235,400 = 409.35 > 191.3 -> l_e = 191.3
//   l_y = min[191.3 + 16 sqrt(9.6616 + 142.952 + 14.3113), 191.3 + 16 x 5.79953] = min[398.0, 284.09] = 284.09
//   lambda_F = sqrt(284.09 x 9.9 x 275/2,006,000) = 0.62094; chi_F = 0.80523; L_eff = 228.76
//   F_Rd = 275 x 228.76 x 9.9 = 622,799 N = 622.8 kN
//   (type (a) at the same station with a = L = 8000: k_F = 6 + 2 (428/8000)^2 = 6.005724, F_cr = 2573.3 kN,
//    l_y = 191.3 + 217.585 = 408.885, lambda_F = sqrt(408.885 x 9.9 x 275/2,573,283) = 0.65772, chi_F = 0.76021,
//    L_eff = 310.84, F_Rd = 275 x 310.84 x 9.9 = 846.3 kN -> (c) governs)
// ---------------------------------------------------------------------------
test('[hand-derived] support s_s defaults to the flange width B [verify], capped at h_w; a point load defaults to s_s = 0 with the m2 = 0 second pass', () => {
  c.reset({});
  let r = probe(), W = r.web;
  assert.equal(W.stations.length, 2);
  W.stations.forEach(s => { assert.equal(s.ssDefault, true); near(s.ss, 191.3, 1e-12); assert.equal(s.type, 'c'); });
  const tc = W.stations[0].gov, ta = W.stations[0].sols.find(t => t.type === 'a');
  near(tc.kF, 4.68178, 2e-6); near(tc.Fcr, 2006.0, 2e-4); near(tc.le, 191.3, 1e-12); near(tc.ly, 284.09, 1e-4); near(tc.lam, 0.62094, 2e-5); near(tc.FRd, 622.80, 1e-4); near(ta.kF, 6.005724, 1e-6); near(ta.FRd, 846.3, 2e-4);
  assert.equal(W.anyDefaultSs, true);
  near(W.stations[0].F, 229.5, 1e-3); near(util(r, U2), 229.5 / 622.8, 1e-3);
  // demo utilisations of AUDIT.md are unchanged by the new entries
  near(r.utils[0].val, 0.303499, 1e-5); near(r.utils[1].val, 0.912166, 1e-5); near(r.utils[2].val, 0.609935, 1e-5);
  // s_s larger than h_w is capped (6.3(1))
  c.reset({supports:[{pos:0,type:'pinned',ss:1000},{pos:8,type:'pinned'}]});
  r = probe(); assert.equal(r.web.stations[0].ssCap, true); near(r.web.stations[0].ss, 428, 1e-12); near(r.web.stations[0].ssIn, 1000, 1e-12);
  // point load with s_s = 0 (default): first pass lambda_F = 0.480 <= 0.5, so m2 = 0:
  //   l_y = 2 x 16 (1 + sqrt(19.3232)) = 172.666; lambda_F = sqrt(172.666 x 9.9 x 275/2,575,192) = 0.42725
  //   chi_F = 1.170 -> 1.0; F_Rd = 275 x 172.666 x 9.9 = 470,083 N = 470.1 kN
  c.reset({L:6, supports:[{pos:0,type:'pinned'},{pos:6,type:'pinned'}], loads:[{type:'point',pos:3,P:100,case:'Q'}], combos:Q15()});
  r = probe(); const sm = r.web.stations[1], t = sm.gov;
  assert.equal(sm.ssIn, 0); assert.equal(sm.ssDefault, false); assert.equal(t.iter, true); near(t.lam1, 0.47962, 2e-5); near(t.m2, 0, 1e-12);
  near(t.ly, 172.666, 1e-5); near(t.lam, 0.42725, 2e-5); near(t.chiRaw, 1.1703, 2e-4); assert.equal(t.chi, 1); near(t.FRd, 470.08, 1e-4);
});

// ---------------------------------------------------------------------------
// [hand-derived] point load over a support: type (b) with F_Ed = max(P, R).
// UB 457 x 191 x 82, L = 6 m, P1 = 200 kN (Q) at mid-span (s_s 100), P2 = 100 kN
// (Q) at x = 0 (s_s 60) over support 1 (s_s 100): 1.5Q -> R1 = 150 + 150 = 300 kN,
// P2 = 150 kN -> F_Ed = 300 kN; s_s = min(60, 100) = 60, c = 0, end zone.
// Type (b): k_F = 3.5 + 2 (428/6000)^2 = 3.510178; F_cr = 0.9 x 3.510178 x 210000 x 970.299/428
//   = 1,504,000 N; l_y = 60 + 32 x 6.79953 = 277.585; lambda_F = sqrt(277.585 x 9.9 x 275/1,504,000)
//   = 0.70886; chi_F = 0.70536; L_eff = 195.80; F_Rd = 275 x 195.80 x 9.9 = 533.1 kN
// Type (c): k_F = 2 + 6 x 60/428 = 2.841121; F_cr = 1,217,345 N; l_e = 248.4 -> 60;
//   l_y = min[60 + 16 sqrt(9.6616 + 14.0625 + 14.3113), 60 + 92.79] = min[158.68, 152.79] = 152.79
//   lambda_F = sqrt(152.79 x 9.9 x 275/1,217,345) = 0.58455; chi_F = 0.85536; L_eff = 130.69
//   F_Rd = 275 x 130.69 x 9.9 = 355.8 kN -> governs; eta_2 = 300/355.8 = 0.8432
// ---------------------------------------------------------------------------
test('[hand-derived] a point load over a support is a type (b) station with F_Ed = max(P, R); the end type (c) is evaluated alongside and the lower F_Rd governs', () => {
  c.reset({L:6, supports:[{pos:0,type:'pinned',ss:100},{pos:6,type:'pinned',ss:100}],
    loads:[{type:'point',pos:3,P:200,case:'Q',ss:100},{type:'point',pos:0,P:100,case:'Q',ss:60}], combos:Q15()});
  const r = probe(), s = r.web.stations[0];
  assert.equal(s.kind, 'both'); assert.equal(s.label, 'point load 2 over support 1'); same(s.types, ['b', 'c']);
  near(s.ss, 60, 1e-12); near(s.c, 0, 1e-12);
  const tb = s.sols.find(t => t.type === 'b'), tc = s.sols.find(t => t.type === 'c');
  near(tb.kF, 3.510178, 1e-6); near(tb.Fcr, 1504.0, 2e-4); near(tb.ly, 277.585, 1e-5); near(tb.lam, 0.70886, 2e-5); near(tb.FRd, 533.1, 2e-4);
  near(tc.kF, 2.841121, 1e-6); near(tc.ly, 152.79, 1e-4); near(tc.lam, 0.58455, 2e-5); near(tc.FRd, 355.8, 2e-4);
  assert.equal(s.type, 'c'); near(s.FRdTot, 355.8, 2e-4);
  const cs = s.cases[s.g2]; near(cs.P, 150, 1e-9); near(cs.R, 300, 1e-6); near(cs.F, 300, 1e-6); assert.equal(cs.flangeComp, true); assert.equal(cs.flangeState, 'load through the web');
  near(s.eta2, 0.8432, 2e-4);
  assert.equal(r.web.gov2, s); near(util(r, U2), 0.8432, 2e-4);
});

// ---------------------------------------------------------------------------
// [hand-derived] RHS 200 x 100 x 8.0 (HF, S275), L = 3 m, P = 100 kN (Q) at
// mid-span, s_s = 50 mm everywhere, 1.5Q: F_Ed = 150 kN shared 75 kN per web.
//   h_w = 176 (flat depth), t_w = t_f = 8; b_f per web = min(B/2 = 50, t + 15 eps t = 118.9) = 50
//   m1 = 50/8 = 6.25; m2 = 0.02 (176/8)^2 = 9.68 (first pass)
// Mid-span type (a): k_F = 6 + 2 (176/3000)^2 = 6.006884; F_cr = 0.9 x 6.006884 x 210000 x 512/176
//   = 3,302,694 N; pass 1: l_y = 50 + 16 (1 + sqrt(15.93)) = 129.86, lambda_F = 0.2941 <= 0.5 -> m2 = 0:
//   l_y = 50 + 16 x 3.5 = 106.0; lambda_F = sqrt(106 x 8 x 275/3,302,694) = 0.26572; chi_F = 1.0
//   F_Rd,web = 275 x 106 x 8 = 233.2 kN; for the load (share 0.5) 466.4 kN; eta_2 = 75/233.2 = 0.3216
// End support type (c): k_F = 2 + 6 x 50/176 = 3.70455; F_cr = 2,036,829 N; l_e = 514.3 -> 50;
//   pass 1 (m2 = 9.68): l_y = min[107.6, 81.93] = 81.93, lambda_F = 0.2975 <= 0.5 -> m2 = 0:
//   l_y = min[50 + 8 sqrt(3.125 + 39.0625), 50 + 8 x 2.5] = min[101.96, 70] = 70; lambda_F = 0.27497
//   chi_F = 1.0; F_Rd,web = 275 x 70 x 8 = 154.0 kN; for the reaction 308.0 kN; eta_2 = 37.5/154 = 0.2435
// M_c,Rd = 282 x 275/1e3 = 77.55 kN.m < M_Ed = 112.5 -> the RHS fails in bending; 7.2 at mid-span
//   = (0.3216 + 0.8 x 112.5/77.55)/1.4 = (0.3216 + 1.1606)/1.4 = 1.0587
// ---------------------------------------------------------------------------
test('[hand-derived] RHS: two webs, flat web depth, flange share B/2 per web, load shared by the lever rule of its eccentricity', () => {
  const lay = {family:'rhs', rhsKey:'200 x 100 x 8.0', L:3, supports:[{pos:0,type:'pinned',ss:50},{pos:3,type:'pinned',ss:50}], loads:[{type:'point',pos:1.5,P:100,case:'Q',ss:50}], combos:Q15()};
  c.reset(lay);
  let r = probe(), W = r.web;
  assert.ok(W.isBox && W.nWebs === 2); near(W.hw, 176, 1e-12); near(W.bfRaw, 50, 1e-12); near(W.bf, 50, 1e-12); near(W.m1, 6.25, 1e-12); near(W.m2full, 9.68, 1e-9);
  const sm = W.stations[1], t = sm.gov;
  near(t.kF, 6.006884, 1e-6); near(t.Fcr, 3302.7, 2e-4); assert.equal(t.iter, true); near(t.lam1, 0.2941, 3e-4); near(t.ly, 106, 1e-9); near(t.lam, 0.26572, 2e-5); assert.equal(t.chi, 1);
  near(t.FRd, 233.2, 1e-9); near(sm.share, 0.5, 1e-12); near(sm.FRdTot, 466.4, 1e-9); near(sm.cases[sm.g2].Fweb, 75, 1e-9); near(sm.eta2, 0.3216, 3e-4);
  const s0 = W.stations[0], tc = s0.gov;
  assert.equal(tc.type, 'c'); near(tc.kF, 3.70455, 2e-6); near(tc.Fcr, 2036.8, 2e-4); near(tc.le, 50, 1e-12); near(tc.ly, 70, 1e-9); near(tc.lam, 0.27497, 2e-5); near(tc.FRd, 154, 1e-9); near(s0.FRdTot, 308, 1e-9); near(s0.eta2, 0.2435, 3e-4);
  near(util(r, U72), 1.0587, 3e-4); assert.equal(r.pass, false);
  // eccentric load: share = 0.5 + e/(B - t) = 0.5 + 30/92 = 0.8261 to the near web
  c.reset(Object.assign({}, lay, {eccOn:true, loads:[{type:'point',pos:1.5,P:100,case:'Q',ss:50,e:30,zg:0}]}));
  r = probe(); const se = r.web.stations[1];
  near(se.share, 0.5 + 30 / 92, 1e-9); near(se.eMax, 30, 1e-12); near(se.FRdTot, 233.2 / (0.5 + 30 / 92), 1e-9); near(se.eta2, 150 * (0.5 + 30 / 92) / 233.2, 1e-9);
});

// ---------------------------------------------------------------------------
// channel: one web, one-sided flange (b_f <= t_w + 15 eps t_f); SHS same as RHS
// ---------------------------------------------------------------------------
test('PFC and SHS: web geometry and flange limit per family; the axial term enters eta_1', () => {
  c.reset({family:'pfc', sectionKey:'180x75x20', L:4, axial:50, supports:[{pos:0,type:'pinned'},{pos:4,type:'pinned'}], loads:[{type:'point',pos:2,P:30,case:'Q'}]});
  let r = probe(), W = r.web;
  assert.ok(W.chan && W.nWebs === 1); near(W.hw, 180 - 2 * 10.5, 1e-12); near(W.bfRaw, 75, 1e-12); near(W.bfLim, 6 + 15 * Math.sqrt(235 / 275) * 10.5, 1e-9); near(W.bf, 75, 1e-12);
  const sm = W.stations[1], cs = sm.cases[sm.g72];
  near(W.NEd, 50, 1e-12); near(W.NplRd, 25.9 * 100 * 275 / 1000, 1e-9);
  near(cs.eta1, cs.M / W.McRd0 + 50 / W.NplRd, 1e-9);
  c.reset({family:'shs', shsKey:'150x150x6.3', L:4, supports:[{pos:0,type:'pinned'},{pos:4,type:'pinned'}], loads:[{type:'point',pos:2,P:30,case:'Q'}]});
  r = probe(); W = r.web;
  assert.ok(W.isBox && W.nWebs === 2); near(W.hw, 150 - 3 * 6.3, 1e-9); near(W.bfRaw, 75, 1e-12);   // EC3 flat depth h - 3t (SCI P363), not the BS table ratio
  assert.ok(util(r, U2) > 0 && util(r, U72) > 0);
});

// ---------------------------------------------------------------------------
// bearing stiffener declared, panel length a, uplift, pattern combinations
// ---------------------------------------------------------------------------
test('stiffener declared: the station prints the 9.4 advisory instead of a check, leaves the verdict, and bounds the panel length a of the other stations', () => {
  // 8 m member, supports at 0 and 6 (overhang), stiffener declared at support 2 (x = 6 m): the 3 m load's panel is 0-6 m -> a = 6000, not 8000
  c.reset({L:8, supports:[{pos:0,type:'pinned',ss:100},{pos:6,type:'pinned',stiff:true}], loads:[{type:'udl',x1:0,x2:8,w:10,case:'Q'},{type:'point',pos:3,P:100,case:'Q',ss:50}], combos:Q15()});
  let r = probe(), W = r.web;
  const st = W.stations.find(s => Math.abs(s.x - 6000) < 1e-6), sl = W.stations.find(s => Math.abs(s.x - 3000) < 1e-6);
  assert.equal(st.stiff, true); assert.equal(st.msg, 'stiffener declared - design stiffener separately (EN 1993-1-5 9.4)');
  assert.ok(r.advisory.some(m => /^Web transverse forces at x = 6 m \(support 2\): stiffener declared - design stiffener separately \(EN 1993-1-5 9\.4\)\./.test(m)));
  assert.ok(st.gov === undefined && st.eta2 === undefined, 'no resistance evaluated at a stiffened station');
  near(sl.a, 6000, 1e-9); near(sl.gov.kF, 6 + 2 * Math.pow(428 / 6000, 2), 1e-9); assert.match(W.aBasis, /declared bearing stiffeners/);
  assert.ok(W.gov2 !== st && W.gov72 !== st);
  // every station stiffened: nothing enters the verdict
  c.reset({L:6, supports:[{pos:0,type:'pinned',stiff:true},{pos:6,type:'pinned',stiff:true}], loads:[{type:'point',pos:3,P:100,case:'Q',stiff:true}], combos:Q15()});
  r = probe(); assert.equal(r.web.checked, false); assert.equal(util(r, U2), null); assert.equal(r.web.stations.length, 3); assert.ok(r.web.stations.every(s => s.stiff));
  assert.equal(r.advisory.filter(m => /stiffener declared/.test(m)).length, 3);
});
test('pattern combinations and uplift: a masked load contributes F_Ed = 0 in its pattern, a lifting support bears nothing, every ULS combination is swept', () => {
  // 6 m back span + 2 m overhang, UDL Q and a 30 kN point load on the overhang at x = 7 m (hogging there: top flange in tension)
  c.reset({L:8, supports:[{pos:0,type:'pinned',ss:100},{pos:6,type:'pinned',ss:100}], loads:[{type:'udl',x1:0,x2:8,w:10,case:'Q'},{type:'point',pos:7,P:30,case:'Q',ss:40}], combos:Q15()});
  const r = probe(), W = r.web;
  assert.equal(r.n, 3);
  const tip = W.stations.find(s => Math.abs(s.x - 7000) < 1e-6), s1 = W.stations.find(s => s.x === 0);
  assert.equal(tip.cases.length, 3);
  const masked = tip.cases.find(x => /Q on span 1 only/.test(x.combo)), full = tip.cases.find(x => x.combo === 'ULS: 1.5Q');
  near(masked.F, 0, 1e-12); near(full.F, 45, 1e-9); assert.equal(tip.type, 'a'); assert.equal(tip.endZone, false); assert.equal(tip.combo, 'ULS: 1.5Q');   // d = 1000, s_s + c = 1020 > 2h_w/3
  assert.equal(full.flange, 'top'); assert.equal(full.flangeComp, false, 'overhang load on the hogging (tension) top flange'); assert.equal(full.flangeState, 'in tension');
  assert.ok(full.Ms < 0 && full.M > 1e-6);
  // support 1 lifts in the "Q on span 2 only" pattern (R1 = -20 kN): F_Ed = 0 there; its worst case is the fully loaded one
  const lift = s1.cases.find(x => /Q on span 2 only/.test(x.combo)); near(lift.R, 0, 1e-12); near(lift.F, 0, 1e-12);
  assert.equal(s1.combo, 'ULS: 1.5Q (Q on span 1 only)');   // 8 m UDL with the overhang unloaded gives the larger R1 than the full case
  assert.ok(s1.cases.find(x => x.combo === s1.combo).F > s1.cases.find(x => x.combo === 'ULS: 1.5Q').F);
  assert.ok(W.anyTension, 'a loaded flange in tension is flagged for the 7.2(2) note');
});

// ---------------------------------------------------------------------------
// verdict, validation, BS path
// ---------------------------------------------------------------------------
test('verdict: F_Ed > F_Rd fails the member with a "bearing stiffener required" advisory; declaring the stiffener restores PASS; BS 5950 path untouched', () => {
  // 457 x 191 x 82, 2 m, 500 kN (Q) at mid-span with s_s = 0: F_Ed = 750 kN > F_Rd = 470.1 kN (eta_2 = 1.595); M = 375 < 503, V = 375 < 0.5 V_pl
  const lay = {L:2, supports:[{pos:0,type:'pinned'},{pos:2,type:'pinned'}], loads:[{type:'point',pos:1,P:500,case:'Q'}], combos:Q15()};
  c.reset(lay);
  let r = probe();
  assert.equal(r.pass, false); near(util(r, U2), 750 / 470.083, 1e-4); assert.equal(r.unsupported.length, 0, 'a failing resistance is FAIL, not NOT VERIFIED');
  assert.ok(r.advisory.some(m => /^Bearing stiffener required at x = 1 m \(point load 1\): F<sub>Ed<\/sub> = 750 kN exceeds F<sub>Rd<\/sub> = 470\.1 kN \(EN 1993-1-5 6\.2, type \(a\)\)/.test(m)));
  assert.ok(r.utils.filter(u => u.val > 1).every(u => U2.test(u.name) || U72.test(u.name)), 'only the web entries fail');
  for (const m of ['eigen', 'standard']) { c.reset(Object.assign({}, lay, {restraint:'ltb', mcrMethod:m})); const u = probe(); assert.equal(u.pass, false); near(util(u, U2), 750 / 470.083, 1e-4, m); }
  c.reset(Object.assign({}, lay, {loads:[{type:'point',pos:1,P:500,case:'Q',stiff:true}]}));
  r = probe(); assert.equal(r.pass, true); near(util(r, U2), 375 / 622.80, 1e-3, 'end reactions govern once the load is stiffened');
  // validation of the new inputs
  c.reset(Object.assign({}, lay, {loads:[{type:'point',pos:1,P:500,case:'Q',ss:-5}]})); assert.throws(() => run('analyse()'), /Load 1 stiff bearing length s_s/);
  c.reset(Object.assign({}, lay, {supports:[{pos:0,type:'pinned',ss:'abc'},{pos:2,type:'pinned'}]})); assert.throws(() => run('analyse()'), /Support 1 stiff bearing length s_s/);
  c.reset(Object.assign({}, lay, {supports:[{pos:0,type:'pinned',ss:''},{pos:2,type:'pinned',ss:null}]})); r = probe(); assert.ok(r.web.stations[0].ssDefault && r.web.stations[2].ssDefault);
  // BS 5950 dispatcher: no EN 1993-1-5 entries, its own cl 4.5 advisory remains
  c.reset(Object.assign({}, lay, {code:'BS5950'}));
  r = probe(); assert.equal(r.web, undefined); assert.equal(util(r, U2), null); assert.ok(r.advisory.some(m => /cl 4\.5\.2 \/ 4\.5\.3/.test(m)));
});

// ---------------------------------------------------------------------------
// brief and report placement
// ---------------------------------------------------------------------------
test('brief: "Web Transverse Forces (EN 1993-1-5 cl 6)" block directly after Local Capacity with the governing derivation, one table row per station, stiffener rows and the unity cells', () => {
  const ROW = /<div class="ms-row[^"]*"><div class="ms-l">(.*?)<\/div><div class="ms-v[^"]*">(.*?)<\/div><div class="ms-r">(.*?)<\/div><div class="ms-t">(.*?)<\/div><\/div>/g;
  const rows = html => [...html.matchAll(ROW)].map(m => ({label:m[1], vals:m[2], res:m[3], tag:m[4]}));
  const heads = html => [...html.matchAll(/<div class="ms-h">(.*?)<\/div>/g)].map(m => m[1]);
  const brief = () => run(`(()=>{ const a=analyse(); const ch=checks(a); return {html:renderMasterSeriesBrief(a,ch,a.sec), web:ch.web, utils:ch.utils.map(u=>({name:u.name,val:u.val})), pass:ch.pass}; })()`);
  c.reset({L:6, supports:[{pos:0,type:'pinned',ss:100},{pos:6,type:'pinned',stiff:true}], loads:[{type:'point',pos:3,P:200,case:'Q',ss:100}], combos:Q15()});
  let r = brief(), h = r.html;
  assert.ok(!/undefined|NaN/.test(h));
  const hs = heads(h), iW = hs.indexOf('Web Transverse Forces (EN 1993-1-5 cl 6)');
  assert.ok(iW > 0 && /^Moment Capacity Check/.test(hs[iW - 1]), 'block follows the Local Capacity / Moment Capacity block: ' + hs.join(' | '));
  const block = h.slice(h.indexOf('Web Transverse Forces (EN 1993-1-5 cl 6)'), h.indexOf('<div class="ms-h">', h.indexOf('Web Transverse Forces (EN 1993-1-5 cl 6)') + 10));
  const rw = rows(block);
  assert.ok(rw.find(x => /^Web h<sub>w<\/sub>, t<sub>w<\/sub>, t<sub>f<\/sub>, b<sub>f<\/sub>$/.test(x.label) && /^428\.00, 9\.90, 16\.00, 191\.30 mm/.test(x.vals) && x.tag === 'Fig 5.1'));
  assert.ok(rw.find(x => /^m<sub>1<\/sub> = / .test(x.label) && /= 19\.323 ; 0\.02 x \(428\.00\/16\.00\)&sup2; = 14\.311/.test(x.vals) && x.tag === '6.5(1)'));
  assert.ok(/Governing station x = 3 m: point load 1, load type \(a\) Fig 6\.1\(a\) interior/.test(block));
  const kf = rw.find(x => /^s<sub>s<\/sub>, c ; k<sub>F<\/sub>$/.test(x.label)); assert.ok(kf && kf.res === '6.010' && kf.tag === 'Fig 6.1(a)' && /s<sub>s<\/sub> = 100\.00 mm \(entered\)/.test(kf.vals));
  const fcr = rw.find(x => /^F<sub>cr<\/sub> = 0\.9k<sub>F<\/sub>/.test(x.label)); assert.ok(fcr && fcr.tag === '6.4(1)'); near(num(fcr.res), 2575.2, 2e-4);
  const ly = rw.find(x => /^l<sub>y<\/sub> = s<sub>s<\/sub> \+ 2t<sub>f<\/sub>/.test(x.label)); assert.ok(ly && ly.res === '317.58 mm' && ly.tag === '6.5(3)');
  const lam = rw.find(x => /^&lambda;&#772;<sub>F<\/sub> = &radic;/.test(x.label)); assert.ok(lam && lam.res === '0.579');
  const frd = rw.find(x => /^F<sub>Rd<\/sub> = f<sub>yw<\/sub>\.L<sub>eff<\/sub>/.test(x.label)); assert.ok(frd && frd.tag === '6.2(1)' && frd.vals === '275 x 274.04 x 9.90/1.0'); near(num(frd.res), 746.08, 1e-4); near(num(frd.res), r.web.gov2.FRdTot, 1e-6);
  const fe = rw.find(x => x.label === 'F<sub>Ed</sub>/F<sub>Rd</sub>'); assert.ok(fe && fe.res === '0.402' && fe.tag === 'OK' && /F<sub>Ed<\/sub> = 300\.000 kN \(ULS: 1\.5Q; on the top flange, in compression\) \/ 746\.0\d\d =/.test(fe.vals));
  const i72 = rw.find(x => /^&eta;<sub>2<\/sub> \+ 0\.8&eta;<sub>1<\/sub> &le; 1\.4$/.test(x.label)); assert.ok(i72 && i72.res === '0.798' && i72.tag === 'OK 7.2' && /0\.402 \+ 0\.8 x \(M<sub>Ed<\/sub>\/M<sub>c\.y\.Rd<\/sub> = 450\.000\/503\.250 = 0\.894\) = 1\.117 &le; 1\.4/.test(i72.vals));
  // station table: three rows, the stiffened support as an advisory row
  const trs = [...block.matchAll(/<tr>(.*?)<\/tr>/g)].map(m => m[1]).filter(x => !/<th/.test(x));
  assert.equal(trs.length, 3);
  assert.ok(/<td class="num">0<\/td><td>support 1<\/td><td>\(c\)<\/td><td class="num">100\.00<\/td>/.test(trs[0]) && /<td>OK<\/td>$/.test(trs[0]));
  assert.ok(/<td>point load 1<\/td><td>\(a\)<\/td>/.test(trs[1]) && /<td>governs<\/td>$/.test(trs[1]));
  assert.ok(/<td>support 2<\/td><td colspan="11">stiffener declared - design stiffener separately \(EN 1993-1-5 9\.4\)<\/td><td>advisory<\/td>/.test(trs[2]));
  assert.ok(/\[verify: EN 1993-1-5 4\.6 writes &eta;<sub>1<\/sub> with W<sub>eff<\/sub>\]/.test(block), 'eta_1 basis flagged');
  // unity bar cells carry the two utilisations
  const u0 = h.indexOf('<div class="ms-unity-head">'), u1 = h.indexOf('<div class="ms-unity-vals">', u0);
  const names = [...h.slice(u0, u1).matchAll(/<div[^>]*>(.*?)<\/div>/g)].map(x => x[1]);
  assert.ok(names.includes('F/F_Rd') && names.includes('Web 7.2') && names[names.length - 1] === 'Max');
  // default s_s: the [verify] tag on the governing row and the asterisk note
  c.reset({}); h = brief().html;
  assert.ok(/s<sub>s<\/sub> = 191\.30 mm \(default B \[verify\]\)/.test(h) && /\* s<sub>s<\/sub> = section flange width B taken as a typical seating length \[verify/.test(h));
  // failing station: Warning tag and the FAIL title
  c.reset({L:2, supports:[{pos:0,type:'pinned'},{pos:2,type:'pinned'}], loads:[{type:'point',pos:1,P:500,case:'Q'}], combos:Q15()});
  r = brief(); h = r.html;
  assert.ok(/\(FAIL\)/.test(h.slice(0, 400)) && rows(h).find(x => x.label === 'F<sub>Ed</sub>/F<sub>Rd</sub>').tag === '<span class="ms-warn">Warning</span>');
  // detailed report: the block, the station table and the note, for the restrained and the unrestrained routes
  for (const over of [{}, {restraint:'ltb'}]) {
    c.reset(Object.assign({L:6, supports:[{pos:0,type:'pinned',ss:100},{pos:6,type:'pinned',stiff:true}], loads:[{type:'point',pos:3,P:200,case:'Q',ss:100}], combos:Q15()}, over));
    run(`document.getElementById=()=>({set innerHTML(v){ globalThis.__rep=v; }}); render();`);
    const rep = run('globalThis.__rep');
    const i = rep.indexOf('Web Transverse Forces (EN 1993-1-5 Cl. 6, interaction Cl. 7.2)');
    assert.ok(i > 0 && i > rep.indexOf('Moment Resistance (Cl. 6.2.5)'), 'report block after Moment Resistance');
    assert.ok(/Governing station x = 3 m: point load 1/.test(rep) && /<td>support 2<\/td><td colspan="11">stiffener declared - design stiffener separately/.test(rep));
    assert.ok(/Web transverse forces \(EN 1993-1-5 clause 6\): F<sub>Rd<\/sub> = f<sub>yw<\/sub>L<sub>eff<\/sub>t<sub>w<\/sub>\/&gamma;<sub>M1<\/sub> at every point load and every support reaction/.test(rep), 'report note');
    assert.ok(!/undefined|NaN/.test(rep.slice(i, i + 6000)));
  }
});
