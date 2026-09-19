'use strict';
/* ===========================================================================
   19 Sep 2026 verification campaign - regression tests
   ---------------------------------------------------------------------------
   Expected values are the [hand-derived] figures of tests/batch/hand-checks.md
   (computed step by step in tests/batch/hand-checks.cjs from the section table
   rows and the case inputs) and the campaign finding on the standard-route
   C1 sampling at a moment jump (tests/batch/mcr-method-comparison.md).
   Single-span library since 19 Sep 2026 (the pattern-loading cases left with
   the multi-span scope).
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
  assert.deepEqual(['TFB-01', 'TFB-03', 'TFB-04'].map(v), ['PASS', 'FAIL', 'NOT VERIFIED']);
  assert.deepEqual(['HSV-01', 'HSV-03', 'HSV-05', 'HSV-06'].map(v), ['PASS', 'FAIL', 'FAIL', 'PASS']);
  assert.deepEqual(['TOR-01', 'TOR-03', 'TOR-04', 'TOR-05'].map(v), ['PASS', 'PASS', 'PASS', 'PASS']);   // TOR-01 (PFC cantilever): PASS since the cantilever preset restrains the root warping (was FAIL with the root warping free)
  assert.deepEqual(['AEF-01', 'AEF-02', 'AEF-04'].map(v), ['PASS', 'FAIL', 'NOT VERIFIED']);
  assert.deepEqual(['BIX-01', 'BIX-02', 'BIX-05'].map(v), ['PASS', 'FAIL', 'FAIL']);
});
