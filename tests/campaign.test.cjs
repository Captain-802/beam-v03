'use strict';
/* ===========================================================================
   19 Sep 2026 verification campaign - regression tests
   ---------------------------------------------------------------------------
   Expected values are the [hand-derived] figures of tests/batch/hand-checks.md
   (computed step by step in tests/batch/hand-checks.cjs from the section table
   rows and the case inputs) and the campaign finding on the standard-route
   C1 sampling at a moment jump (tests/batch/mcr-method-comparison.md).
   Single-span library since 19 Sep 2026 (the pattern-loading cases left with
   the multi-span scope); the closed forms of the six end presets, the strut
   lengths from the end fixities, the end-restraint M_cr bounds and the
   expected-error group were added with the rebuilt library (hand-checks.md
   HC-01 .. HC-08, HC-21c, HC-23; tests/batch/README.md).
   =========================================================================== */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { app } = require('./harness.cjs');
const { cases } = require('./batch/cases.cjs');

const ctx = app();
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol * Math.max(Math.abs(b), 1e-12), `${msg}: ${a} vs ${b}`);
function runCase(id, method, code) {
  const cs = cases.find(c => c.id === id);
  const o = JSON.parse(JSON.stringify(cs.overrides)); o.mcrMethod = method;
  ctx.reset(o);
  return ctx.run(`(()=>{ const a=analyse(); const c=checks(a); return (${code})(a,c); })()`);
}

test('[hand-derived] web transverse forces (EN 1993-1-5 cl 6): F_Rd of the campaign cases WEB-01 (a), WEB-04 (c), WEB-07 (load over End 2: (b) with (c) alongside) and WEB-06 (RHS, lever rule)', () => {
  // hand-checks.md HC-01 .. HC-04
  const w1 = runCase('WEB-01', 'eigen', '(a,c)=>({FRd:c.web.gov2.FRdTot,type:c.web.gov2.type,u:c.web.util2,pass:c.pass})');
  near(w1.FRd, 636.914, 1e-4, 'WEB-01 F_Rd'); assert.equal(w1.type, 'a'); near(w1.u, 900 / 636.914, 1e-4, 'WEB-01 F_Ed/F_Rd'); assert.equal(w1.pass, false);
  const w4 = runCase('WEB-04', 'eigen', '(a,c)=>({FRd:c.web.gov2.FRdTot,type:c.web.gov2.type,F:c.web.gov2.F,pass:c.pass})');
  near(w4.FRd, 301.001, 1e-4, 'WEB-04 F_Rd'); assert.equal(w4.type, 'c'); near(w4.F, 305.159, 1e-4, 'WEB-04 reaction'); assert.equal(w4.pass, false);
  const w5 = runCase('WEB-05', 'eigen', '(a,c)=>({FRd:c.web.gov2.FRdTot,pass:c.pass})');
  assert.ok(w5.FRd > w4.FRd && w5.pass, 'WEB-05: s_s = 100 restores PASS');
  const w7 = runCase('WEB-07', 'eigen', '(a,c)=>({FRd:c.web.gov2.FRdTot,type:c.web.gov2.type,F:c.web.gov2.F,label:c.web.gov2.label,kind:c.web.gov2.kind,types:c.web.gov2.types})');
  near(w7.FRd, 202.226, 1e-4, 'WEB-07 F_Rd'); assert.equal(w7.kind, 'both'); assert.deepEqual([...w7.types], ['b', 'c']); assert.equal(w7.type, 'c'); near(w7.F, 460.925, 1e-4, 'WEB-07 F_Ed = R2'); assert.match(w7.label, /over End 2/);
  const w6 = runCase('WEB-06', 'eigen', '(a,c)=>({FRd:c.web.gov2.FRdTot,share:c.web.gov2.share})');
  near(w6.FRd, 258.362, 1e-4, 'WEB-06 F_Rd'); near(w6.share, 0.5 + 40 / (150 - 6.3), 1e-9, 'WEB-06 lever-rule share');
});

test('[hand-derived] uplift of the single-span library: UPL-01 End 1 lifts by 0.9G + 1.5Q = -16.14 kN (couple -60 kN.m at End 2 on 4 m: R_1,Q = -15 kN; hand statics), UPL-03 lifts at SLS only', () => {
  // UPL-01: UB 406x178x54 (54.1 kg/m -> 0.5307 kN/m, the engine's 4-decimal self-weight), 4 m SS, G 3 kN/m: R_1,G = 2 x 3.5307 = 7.0614 kN;
  //   couple -60 kN.m at End 2: R_1,Q = -60/4 = -15 kN; 0.9G + 1.5Q = 6.3553 - 22.5 = -16.145 kN (EQU set A companion governs the hold-down force)
  const u1 = runCase('UPL-01', 'eigen', '(a,c)=>({R:a.uplift.supports[0].RUls, g:a.uplift.supports[0].gInfUls, pass:c.pass, msg:c.unsupported.find(m=>/^Hold-down required/.test(m))||null})');
  const RG = 2 * (3 + 0.5307), RQ = -60 / 4;
  near(u1.R, 0.9 * RG + 1.5 * RQ, 1e-6, 'UPL-01 R_1 in the EQU companion'); near(u1.R, -16.145, 1e-3, 'UPL-01 R_1'); assert.equal(u1.g, 0.9); assert.equal(u1.pass, false); assert.match(u1.msg, /at End 1 /);
  const u3 = runCase('UPL-03', 'eigen', '(a,c)=>({u:a.uplift.supports[0], pass:c.pass, adv:c.advisory.some(m=>/^Hold-down check \\(SLS only\\) at End 1/.test(m))})');
  assert.equal(u3.u.RUls, null); near(u3.u.RSls, -30 / 4, 1e-6, 'UPL-03 SLS-only uplift'); assert.ok(u3.pass && u3.adv);
});

test('[hand-derived] standard closed-form Mcr with the SN003a C2 zg term (UB-04, UB-45, UB-43) and the SN006a cantilever with the Eq (7) interaction (UB-19)', () => {
  // hand-checks.md HC-07, HC-08, HC-16, HC-09
  near(runCase('UB-04', 'standard', '(a,c)=>c.ltb.Mcr'), 80.2349, 1e-4, 'UB-04 Mcr');
  near(runCase('UB-45', 'standard', '(a,c)=>c.ltb.Mcr'), 189.461, 1e-4, 'UB-45 Mcr');
  near(runCase('UB-43', 'standard', '(a,c)=>c.ltb.Mcr'), 46.0888, 1e-4, 'UB-43 Mcr');
  const u19 = runCase('UB-19', 'standard', '(a,c)=>({Mcr:c.ltb.Mcr,C:c.ltb.C,Mcr0:c.ltb.Mcr0})');
  near(u19.Mcr0, 30.3514, 1e-4, 'UB-19 Mcr0'); near(u19.C, 2.5914, 1e-3, 'UB-19 C (Eq 7)'); near(u19.Mcr, 78.6527, 1e-4, 'UB-19 Mcr');
});

test('[hand-derived] channel torsional-flexural buckling (TFB-01), RHS high-shear M_v,Rd (HSV-04), A_eff (AEF-01)', () => {
  // hand-checks.md HC-10, HC-11, HC-12
  const t = runCase('TFB-01', 'eigen', '(a,c)=>({NcrT:c.buck.tfb.NcrT,NcrTF:c.buck.tfb.NcrTF,NbT:c.buck.tfb.NbT})');
  near(t.NcrT, 1561.01, 1e-4, 'N_cr,T'); near(t.NcrTF, 1274.26, 1e-4, 'N_cr,TF'); near(t.NbT, 622.363, 1e-4, 'N_b,T,Rd');
  const h = runCase('HSV-04', 'eigen', '(a,c)=>({MvRd:c.coex.MvRd,Vpl:c.VcRd,u:c.coex.u,pass:c.pass})');
  near(h.MvRd, 170.320, 1e-4, 'M_v,y,Rd'); near(h.Vpl, 891.898, 1e-4, 'V_pl,Rd'); near(h.u, 1.05668, 1e-4, 'M/M_v'); assert.equal(h.pass, false);
  const e = runCase('AEF-01', 'eigen', '(a,c)=>({Aeff:c.aeff.Aeff,u:c.utils.find(x=>/^Compression/.test(x.name)).val})');
  near(e.Aeff, 25127.3, 1e-4, 'A_eff'); near(e.u, 0.225268, 1e-4, 'N_Ed/N_c,Rd');
});

test('[hand-derived] warping-torsion FE against the Vlasov closed forms: tip torque (UB-49), uniform torque on a cantilever (TOR-05), warping-fixed ends (UB-51)', () => {
  // hand-checks.md HC-13, HC-14, HC-15; the cantilever uniform-torque form phi(L) = (m/GI_T)[L^2/2 + a^2(1 - sech(L/a)) - aL tanh(L/a)]
  near(runCase('UB-49', 'eigen', '(a,c)=>c.tor.phiUmax'), 0.0938118, 1e-4, 'UB-49 phi(L)');
  near(runCase('UB-49', 'eigen', '(a,c)=>c.tor.BMax'), 4.34166, 1e-4, 'UB-49 B(0) kN.m2');
  const t5 = runCase('TOR-05', 'eigen', '(a,c)=>({phi:c.tor.phiUmax,T0:Math.abs(c.tor.TEnds[0]),mesh:c.tor.meshError,method:c.tor.method})');
  assert.equal(t5.method, 'fe'); near(t5.phi, 0.125587, 1e-4, 'TOR-05 phi(L)'); near(t5.T0, 2.772, 1e-6, 'TOR-05 root torque m L'); assert.ok(t5.mesh < 1e-4);
  near(runCase('UB-51', 'eigen', '(a,c)=>c.tor.phiUmax'), 0.0707132, 1e-4, 'UB-51 phi(L/2)');
});

test('standard route C1 at a moment jump: the quarter-point / mid-span sample takes the larger side of an in-span couple (campaign finding, UB-27)', () => {
  // UB-27: 457x191x82, 8 m SS, UDL + 72 kN.m couple at 4 m + 18 kN at 2 m. The couple makes M jump at mid-span
  // (226.5 kN.m left, 118.5 right). Serna C1 = sqrt(35 Mmax^2/(Mmax^2 + 9 M2^2 + 16 M3^2 + 9 M4^2)) with the
  // envelope ordinates (M3 = the larger side = Mmax) is 1.206; the far-side sample gave 1.676 and a standard Mcr
  // 20 % above the eigenvalue (unconservative).
  const r = runCase('UB-27', 'standard', `(a,c)=>{ const fb=a.governM.fb; const M=x=>interpAt(fb.xs,fb.M,x)/1e6;
    const side=x=>{ const l=M(x-1e-3), rr=M(x+1e-3); return Math.abs(l)>=Math.abs(rr)? l : rr; };
    return {C1:c.C1, route:c.ltb.c1route, Mmax:Math.abs(a.Mmax), M2:side(2000), M3:side(4000), M4:side(6000), M3far:Math.min(Math.abs(M(3999.9)),Math.abs(M(4000.1))), Mcr:c.ltb.Mcr, McrEigen:null}; }`);
  assert.equal(r.route, 'serna');
  const d = r.Mmax ** 2 + 9 * r.M2 ** 2 + 16 * r.M3 ** 2 + 9 * r.M4 ** 2;
  const C1hand = Math.sqrt(35 * r.Mmax ** 2 / d);
  near(r.C1, C1hand, 1e-9, 'Serna C1 from the two-sided ordinates');
  near(r.M3, r.Mmax, 1e-5, 'mid-span sample = the larger side of the jump');
  assert.ok(r.M3far < r.Mmax * 0.6, 'the far side of the jump is much smaller');
  assert.ok(r.C1 < 1.25 && r.C1 > 1.15, 'C1 = 1.206 (was 1.676)');
  const eig = runCase('UB-27', 'eigen', '(a,c)=>({Mcr:c.ltb.McrEigen, std:c.ltb.McrStandard, ratio:c.ltb.McrRatio})');
  near(eig.std, r.Mcr, 1e-9, 'the eigen run prints the same standard comparison value');
  assert.ok(eig.ratio > 1, 'the closed form is now on the conservative side of the eigenvalue: ' + eig.ratio);
});

test('eigen route: the destabilising switch with every z_g = 0 is a contradictory input and blocks PASS; the entered load height carries the effect (campaign finding, UB-40 / UB-52)', () => {
  const u40 = runCase('UB-40', 'eigen', "(a,c)=>({pass:c.pass, msg:c.unsupported.find(m=>/Destabilising loading is ticked/.test(m))||null, Mcr:c.ltb.Mcr})");
  assert.equal(u40.pass, false); assert.ok(u40.msg, 'blocking message printed');
  const u40s = runCase('UB-40', 'standard', "(a,c)=>({blocked:c.unsupported.some(m=>/Destabilising loading is ticked/.test(m)), LE:c.ltb.LE})");
  assert.equal(u40s.blocked, false, 'the closed-form route applies L_E x 1.2 instead');
  const u52 = runCase('UB-52', 'eigen', "(a,c)=>({pass:c.pass, blocked:c.unsupported.some(m=>/Destabilising loading is ticked/.test(m)), Mcr:c.ltb.Mcr, u:c.utils.find(x=>/^LTB/.test(x.name)).val})");
  assert.equal(u52.blocked, false); assert.ok(u52.Mcr < u40.Mcr, 'the top-flange z_g lowers the eigenvalue M_cr: ' + u52.Mcr + ' < ' + u40.Mcr);
  assert.ok(u52.u > 1 && !u52.pass, 'UB-52 fails LTB with the load height entered (' + u52.u + ')');
  const plain = runCase('UB-52', 'eigen', "(a,c)=>c.ltb.Mcr");
  assert.ok(plain < 260 && plain > 240, 'M_cr with z_g = +266: ' + plain);
});

test('verdict directions of the campaign groups (eigen route)', () => {
  const v = id => runCase(id, 'eigen', "(a,c)=>c.pass?'PASS':(c.utils.some(u=>!Number.isFinite(u.val)||u.val>1.0001)?'FAIL':'NOT VERIFIED')");
  assert.deepEqual(['WEB-01', 'WEB-02', 'WEB-03', 'WEB-07'].map(v), ['FAIL', 'PASS', 'FAIL', 'FAIL']);
  assert.deepEqual(['UPL-01', 'UPL-02', 'UPL-03', 'UPL-04', 'UPL-05'].map(v), ['NOT VERIFIED', 'PASS', 'PASS', 'PASS', 'NOT VERIFIED']);
  assert.deepEqual(['TFB-01', 'TFB-03', 'TFB-04'].map(v), ['PASS', 'FAIL', 'PASS']);   // TFB-04: PASS since 20 Sep 2026 torsion + N/Mz (the 'not implemented as one interaction' block is gone; (6.1) 0.14, Eq 6.62 0.35 with M_z,Ed = phi.M_y = 0.73 kN.m)
  assert.deepEqual(['HSV-01', 'HSV-03', 'HSV-05', 'HSV-06'].map(v), ['PASS', 'FAIL', 'FAIL', 'PASS']);
  // TOR-01 / TOR-05 (cantilevers, root warping fixed): PASS - the elastic yield criterion (6.1) exceeds 1 at the root flange tip (sigma_My + sigma_w
  // = 198 + 114 = 313 and 97 + 196 = 294 N/mm2 > 275: (6.1) = 1.29 / 1.14) but these are Class 1 sections with N_Ed = 0, for which EN 1993-1-1
  // 6.2.7(6) permits the plastic resistance (P385 3.1.2: 0.72 / 0.57; Annex A 0.98 / 0.62); (6.1) is printed as information with an advisory
  // (20 Sep 2026 review, elasticBindingPolicy). TOR-01 is PASS since the cantilever preset restrains the root warping (FAIL on Annex A with it free).
  assert.deepEqual(['TOR-01', 'TOR-03', 'TOR-04', 'TOR-05'].map(v), ['PASS', 'PASS', 'PASS', 'PASS']);
  assert.deepEqual(['AEF-01', 'AEF-02', 'AEF-04'].map(v), ['PASS', 'FAIL', 'NOT VERIFIED']);
  assert.deepEqual(['BIX-01', 'BIX-02', 'BIX-05'].map(v), ['PASS', 'FAIL', 'FAIL']);
});

test('[hand-derived] closed forms of the presets: guided-fixed (UB-71 wL^2/3, wL^2/6, wL^4/24EI; UB-72 PL/2, PL^3/12EI), fixed-fixed (UB-21, UB-53), cantilever (UB-64, UB-19), pinned-guided (UB-76, UB-77), propped (UB-20)', () => {
  // hand-checks.md HC-01 .. HC-07
  const r = (id, code) => runCase(id, 'eigen', code);
  const ends = '(a,c)=>({M1:Math.abs(a.reactions[0].M)/1e6, M2:a.reactions[1]?Math.abs(a.reactions[1].M)/1e6:null, R1:a.reactions[0].V/1000, R2:a.reactions[1]?a.reactions[1].V/1000:null, d:Math.abs(a.dmax), t2:a.reactions[1]?a.reactions[1].type:null})';
  const g = r('UB-71', ends); near(g.M1, 127.004, 1e-4, 'UB-71 M_1 = wL^2/3'); near(g.M2, 63.5019, 1e-4, 'UB-71 M_2 = wL^2/6'); near(g.R1, 63.5019, 1e-4, 'UB-71 R_1 = wL'); assert.ok(Math.abs(g.R2) < 1e-9 && g.t2 === 'guided', 'no vertical reaction at the guided end'); near(g.d, 12.1008, 1e-4, 'UB-71 wL^4/24EI');
  const g2 = r('UB-72', ends); near(g2.M1, 249.347, 1e-4, 'UB-72 PL/2 + wL^2/3'); near(g2.M2, 245.049, 1e-4, 'UB-72 PL/2 + wL^2/6'); near(g2.d, 18.3346, 1e-4, 'UB-72 PL^3/12EI');
  const f = r('UB-21', ends); near(f.M1, 86.7547, 1e-4, 'UB-21 wL^2/12'); near(f.M2, 86.7547, 1e-4, 'UB-21 wL^2/12 at End 2'); near(f.R1, 65.0660, 1e-4, 'UB-21 wL/2'); near(f.d, 2.43810, 1e-4, 'UB-21 wL^4/384EI');
  const f2 = r('UB-53', ends); near(f2.M1, 311.792, 1e-4, 'UB-53 PL/8 + wL^2/12'); near(f2.d, 5.13413, 1e-4, 'UB-53 PL^3/192EI');
  const k = r('UB-64', ends); near(k.M1, 99.6014, 1e-4, 'UB-64 wL^2/2'); near(k.d, 5.10504, 1e-4, 'UB-64 wL^4/8EI'); assert.equal(k.M2, null, 'a free end has no reaction');
  const k2 = r('UB-19', ends); near(k2.M1, 46.3110, 1e-4, 'UB-19 PL + wL^2/2'); near(k2.d, 15.0905, 1e-4, 'UB-19 PL^3/3EI');
  const pg = r('UB-76', ends); near(pg.M2, 84.6692, 1e-4, 'UB-76 wL^2/2 at the guided end'); near(pg.R1, 42.3346, 1e-4, 'UB-76 R_1 = wL'); near(pg.d, 11.9514, 1e-4, 'UB-76 5wL^4/24EI'); assert.ok(Math.abs(pg.M1) < 1e-9, 'pinned End 1 carries no moment');
  const pg2 = r('UB-77', ends); near(pg2.M2, 212.956, 1e-4, 'UB-77 PL + wL^2/2'); near(pg2.d, 21.2206, 1e-4, 'UB-77 PL^3/3EI');
  const pr = r('UB-20', ends); near(pr.M1, 85.9052, 1e-4, 'UB-20 wL^2/8'); near(pr.R2, 42.9526, 1e-4, 'UB-20 3wL/8'); near(pr.d, 3.26327, 1e-3, 'UB-20 0.005416 wL^4/EI (grid station)');
});

test('[hand-derived] strut lengths from the end fixities: AX-04 guided-fixed L_cr,y = 1.2 L, L_cr,z = 0.7 L, N_b,y,Rd 1936.6 (curve b), N_b,z,Rd 1781.1 kN (curve c); the L_E input overrides both (AX-11)', () => {
  // hand-checks.md HC-08
  const b = runCase('AX-04', 'eigen', '(a,c)=>({LcrY:c.buck.LcrY, LcrZ:c.buck.LcrZ, NbY:c.buck.NbY, NbZ:c.buck.NbZ, pass:c.pass})');
  near(b.LcrY, 7200, 1e-9, 'L_cr,y'); near(b.LcrZ, 4200, 1e-9, 'L_cr,z'); near(b.NbY, 1936.63, 1e-4, 'N_b,y,Rd'); near(b.NbZ, 1781.09, 1e-4, 'N_b,z,Rd'); assert.ok(b.pass);
  const o = runCase('AX-11', 'eigen', '(a,c)=>({LcrY:c.buck.LcrY, LcrZ:c.buck.LcrZ})');
  near(o.LcrY, 6000, 1e-9, 'AX-11 L_E/L = 1.0 entered: y-y'); near(o.LcrZ, 6000, 1e-9, 'AX-11 L_E/L = 1.0 entered overrides the 0.7 L z-z default');
});

test('end-restraint bounds (batch cross-check xvi): laterally clamped ends (CUS-01, CUS-03) and warping-fixed ends (CUS-02, CUS-04) raise the eigen M_cr above the fork-ended base; the clamped ratio is within 3 % of the SN003a k = 0.5 factor (HC-23)', () => {
  const mcr = id => runCase(id, 'eigen', '(a,c)=>c.ltb.Mcr');
  const fork = mcr('UB-03'), clamped = mcr('CUS-01'), warp = mcr('CUS-02'), both = mcr('CUS-10');
  assert.ok(clamped > fork && warp > fork && both > clamped, 'bounds: ' + [fork, clamped, warp, both].map(v => v.toFixed(1)).join(' / '));
  near(fork, 109.211, 5e-3, 'fork-ended eigen vs SN003a k = 1 (109.21)');
  near(clamped / fork, 1.72493, 0.03, 'clamped / fork against the SN003a k = 0.5 factor 1.7249');
  const fork7 = mcr('UB-07'), c3 = mcr('CUS-03'), c4 = mcr('CUS-04');
  assert.ok(c3 > fork7 && c4 > fork7, 'central point load pairs: ' + [fork7, c3, c4].map(v => v.toFixed(1)).join(' / '));
  const lc = mcr('CUS-06'), lcw = mcr('CUS-07');
  assert.ok(lcw > lc, 'lateral cantilever: root warping fixed raises M_cr ' + lc.toFixed(1) + ' -> ' + lcw.toFixed(1));
});

test('cantilever M_cr: the eigen route reproduces NCCI SN006a within 2.1 % for every covered library cantilever (UB-18/19/49/64/68, UC-04, ZG-04/05, AX-03/13, TOR-05/07)', () => {
  for (const id of ['UB-18', 'UB-19', 'UB-49', 'UB-64', 'UB-68', 'UC-04', 'ZG-04', 'ZG-05', 'AX-03', 'AX-13', 'TOR-05', 'TOR-07']) {
    const r = runCase(id, 'eigen', '(a,c)=>({ratio:c.ltb.McrRatio, route:c.ltb.c1route})');
    assert.equal(r.route, 'sn006a', id + ' route');
    assert.ok(r.ratio > 0.99 && r.ratio < 1.021, id + ': eigen / SN006a = ' + r.ratio.toFixed(4));
  }
});

test('[hand-derived] warping-free cantilever with a tip torque is pure St Venant: TOR-07 phi(L) = TL/GI_T = 0.17127 rad, B = 0 (HC-21c); the mesh measure no longer blocks it on the round-off bimoment (review finding F-B corrected)', () => {
  const t = runCase('TOR-07', 'eigen', '(a,c)=>({phi:c.tor.phiUmax, B:c.tor.BMax, Tt:c.tor.TtEnds[0], mesh:c.tor.meshError, blocked:c.unsupported.some(m=>/mesh has not converged/.test(m)), pass:c.pass})');
  near(t.phi, 0.171270, 1e-4, 'TOR-07 phi(L)'); assert.ok(Math.abs(t.B) < 1e-5, 'B is round-off: ' + t.B); near(t.Tt, 2.4, 1e-6, 'root St Venant torque = T');
  assert.equal(t.blocked, false, 'the bimoment part is normalised by max(|B|max, 1e-3 T_max min(a, L)), so a vanishing bimoment cannot block');
  assert.ok(t.mesh < 1e-4 && t.pass, 'converged (' + t.mesh + ') and PASS');
});

test('[hand-derived] web station at a fixed End 2 reads the hogging end moment (review finding F-A corrected): WEB-09 gives the same 7.2 interaction at both ends, and a mirrored point load gives mirrored stations', () => {
  // hand-checks.md HC-17b / HC-17c: UB 533x210x92, 6 m fixed-fixed, 30 G + 40 Q, s_s = 40 at both ends
  const w9 = runCase('WEB-09', 'eigen', '(a,c)=>{ const s1=c.web.stations.find(s=>s.n===1), s2=c.web.stations.find(s=>s.n===2); return {u1:s1.u72,u2:s2.u72,M1:s1.cases[s1.g72].M,M2:s2.cases[s2.g72].M,Mr1:Math.abs(a.reactions[0].M)/1e6,Mr2:Math.abs(a.reactions[1].M)/1e6}; }');
  near(w9.M1, w9.Mr1, 1e-6, 'End 1 station M_Ed = reaction moment'); near(w9.M2, w9.Mr2, 1e-6, 'End 2 station M_Ed = reaction moment');
  near(w9.u2, w9.u1, 1e-6, 'symmetric member: the same 7.2 value at both ends');
  // UB 457x191x82, 6 m fixed-fixed, s_s = 50 both ends, 300 kN Q at 1.5 m and its mirror at 4.5 m: identical physics, mirrored stations
  const mirror = pos => { ctx.reset({ family: 'ub', ubKey: '457 x 191 x 82', L: 6, restraint: 'full', ends: ctx.ends('fixed-fixed', { e1: { ss: 50 }, e2: { ss: 50 } }), loads: [{ type: 'point', pos, P: 300, case: 'Q' }] });
    return ctx.run('(()=>{ const a=analyse(); const c=checks(a); const st=n=>c.web.stations.find(s=>s.n===n); return {u1:st(1).u72,u2:st(2).u72,eta1a:st(1).cases[st(1).g72].eta1,eta1b:st(2).cases[st(2).g72].eta1,util72:c.web.util72}; })()'); };
  const a = mirror(1.5), b = mirror(4.5);
  near(a.u1, b.u2, 1e-6, 'End 1 of the load at 1.5 m = End 2 of the load at 4.5 m'); near(a.u2, b.u1, 1e-6, 'and vice versa');
  near(a.util72, b.util72, 1e-6, 'the verdict entry is the same for both'); assert.ok(b.eta1b > 0.7 && a.u1 > 1.2, 'the hogging end moment enters eta_1 at End 2 (' + b.eta1b.toFixed(3) + ')');
});

test('expected-error group: every ERR case of the library throws the declared message (mechanisms, torque without a twist restraint, N_Ed with U_x free at both ends, lateral cantilever without R_z, hinge at an end)', () => {
  const errs = cases.filter(c => c.expectError);
  assert.ok(errs.length >= 6, 'at least six invalid layouts: ' + errs.length);
  for (const cs of errs) {
    ctx.reset(JSON.parse(JSON.stringify(cs.overrides)));
    assert.throws(() => ctx.run('analyse()'), e => String(e && e.message ? e.message : e).replace(/<[^>]+>/g, '').includes(cs.expectError), cs.id + ' must throw "' + cs.expectError + '"');
  }
});
