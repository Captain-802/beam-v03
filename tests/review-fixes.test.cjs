// 19 Sep 2026 review findings on branch ms-brief-standard-mcr (AUDIT.md
// "19 Sep 2026 gap closure, review fixes"): PFC torsional buckling length from the TWIST
// restraints, the gamma_G,inf = 1.0 companion combinations for uplift / hold-down
// and web bearing, the stiff-bearing default s_s = 0 lower bound at supports,
// the interior-support reaction pattern for n >= 4 spans, and the solve caches.
// Expected values are hand derived ([hand-derived] in the comments) from the
// section tables, the three-moment equation and the code expressions.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { app } = require('./harness.cjs');
const c = app();
const run = x => c.run(x);
function near(actual, expected, rel = 1e-6, what = '') { assert.ok(Math.abs(actual - expected) <= rel * Math.max(1, Math.abs(expected)), `${what} ${actual} != ${expected}`); }
const full = () => run(`(()=>{ const a=analyse(); const ch=checks(a); return {a:{Mmax:a.Mmax, sec:a.sec, fy:a.py, E:a.E, L:a.L, ulsLabels:a.ulsResults.map(r=>r.combo.label), reacs:a.ulsResults.map(r=>({label:r.combo.label, R:r.r.reactions.map(x=>x.V/1000)})), comp:(a.ulsCompanions||[]).map(r=>({label:r.combo.label, parent:r.combo.parent&&r.combo.parent.label, R:r.r.reactions.map(x=>x.V/1000)})), uplift:a.uplift, patterns:a.patterns&&{nUls:a.patterns.nUls,nSls:a.patterns.nSls,nComp:a.patterns.nComp,note:a.patterns.note}}, c:ch}; })()`);
const util = (ch, re) => { const u = ch.utils.find(u => re.test(u.name)); return u ? u.val : null; };
const brief = () => run(`(()=>{ const a=analyse(); const ch=checks(a); return renderMasterSeriesBrief(a,ch,a.sec); })()`);
const report = () => run(`(()=>{ const el={innerHTML:'',style:{}}; document.getElementById=()=>el; render(); return el.innerHTML; })()`);
const ROW = /<div class="ms-row[^"]*"><div class="ms-l">(.*?)<\/div><div class="ms-v[^"]*">(.*?)<\/div><div class="ms-r">(.*?)<\/div><div class="ms-t">(.*?)<\/div><\/div>/g;
const rows = html => [...html.matchAll(ROW)].map(m => ({ label: m[1], vals: m[2], res: m[3], tag: m[4] }));
const row = (html, re) => rows(html).find(r => re.test(r.label)) || null;
const chiStrut = (lam, alpha) => { const Phi = 0.5 * (1 + alpha * (lam - 0.2) + lam * lam); return Math.min(1 / (Phi + Math.sqrt(Phi * Phi - lam * lam)), 1); };
const R = (phi, ...pos) => pos.map(p => ({ pos: p, v: true, phi, vp: false, phip: false }));

// ---- finding 1: PFC L_T from the twist restraints, never the v-only L_cr,z ----
test('[hand-derived] F1: PFC 150x75x18, 6 m, N = 250 kN, restraints at 1.5 m centres: lateral-only restraints leave L_T = 6 m (N_b,T,Rd = 240.2 kN, FAIL 1.041); v + phi restraints give L_T = 1.5 m (265.2 kN, 0.943); the user L_T still overrides', () => {
  // PFC 150x75x18 (SCI P363 / P385 Table A.3): A = 22.8 cm2, i_y = 61.5, i_z = 24.0, I_y = 861 cm4, I_T = 6.31 cm4, I_w = 0.00467 dm6, e_sc = 52.8 mm
  // i0^2 = 61.5^2 + 24.0^2 + 52.8^2 = 3782.25 + 576 + 2787.84 = 7146.09 mm2; beta = 1 - 52.8^2/7146.09 = 0.60988
  // N_cr,y = pi^2 x 210000 x 861e4/6000^2 = 495.70 kN (L_cr,y = 6 m)
  // L_T = 6000: N_cr,T = (81000 x 6.31e4 + pi^2 x 210000 x 4.67e9/6000^2)/7146.09 = (5.1111e9 + 2.6887e8)/7146.09 = 752.85 kN
  //   N_cr,TF = (495.70 + 752.85)/(2 x 0.60988) [1 - sqrt(1 - 4 x 0.60988 x 495.70 x 752.85/1248.55^2)] = 1023.6 x 0.35503 = 363.41 kN
  //   lambda_T = sqrt(2280 x 275/363407) = 1.3135; curve c: Phi = 1.6355, chi = 0.38316; N_b,T,Rd = 0.38316 x 2280 x 275 = 240.24 kN; 250/240.24 = 1.0406
  // L_T = 1500: N_cr,T = (5.1111e9 + 4.3019e9)/7146.09 = 1317.21 kN; N_cr,TF = 419.31 kN; lambda_T = 1.2228; chi = 0.42302; N_b,T,Rd = 265.23 kN; 0.9426
  const lay = { family: 'pfc', sectionKey: '150x75x18', L: 6, supports: [{ pos: 0, type: 'pinned', ss: 100 }, { pos: 6, type: 'pinned', ss: 100 }], axial: 250, restraint: 'ltb', mcrMethod: 'standard',
    loads: [{ type: 'udl', x1: 0, x2: 6, w: 1, case: 'G' }, { type: 'udl', x1: 0, x2: 6, w: 1, case: 'Q' }] };
  const G = 81000, E = 210000, A = 2280, IT = 6.31e4, Iw = 4.67e9, i0sq = 61.5 ** 2 + 24.0 ** 2 + 52.8 ** 2, beta = 1 - 52.8 ** 2 / i0sq, NcrY = Math.PI ** 2 * E * 861e4 / 6000 ** 2;
  const chain = LT => { const NcrT = (G * IT + Math.PI ** 2 * E * Iw / (LT * LT)) / i0sq; const NcrTF = (NcrY + NcrT) / (2 * beta) * (1 - Math.sqrt(1 - 4 * beta * NcrY * NcrT / (NcrY + NcrT) ** 2)); const lam = Math.sqrt(A * 275 / Math.min(NcrT, NcrTF)); const chi = chiStrut(lam, 0.49); return { NcrT: NcrT / 1000, NcrTF: NcrTF / 1000, lam, chi, NbT: chi * A * 275 / 1000 }; };
  const h6 = chain(6000), h15 = chain(1500);
  near(h6.NcrT, 752.85, 2e-5); near(h6.NcrTF, 363.41, 2e-5); near(h6.NbT, 240.24, 2e-5); near(h15.NcrT, 1317.21, 2e-5); near(h15.NbT, 265.23, 2e-5);
  // (a) lateral-only restraints (phi = false): they shorten L_cr,z to 1.5 m but do not bound the torsional mode -> L_T = the support spacing 6 m
  c.reset(Object.assign({}, lay, { ltbRestraints: R(false, 1.5, 3, 4.5) }));
  let t = full().c; let f = t.buck.tfb;
  near(t.buck.LcrZ, 1500, 1e-12); near(t.buck.LcrY, 6000, 1e-12);
  near(f.LT, 6000, 1e-12); assert.ok(/L<sub>cr,y<\/sub> \(no intermediate twist restraint\)/.test(f.LTSrc), f.LTSrc);
  near(f.NcrT, h6.NcrT, 1e-6); near(f.NcrTF, h6.NcrTF, 1e-6); near(f.NbT, h6.NbT, 1e-6); near(util(t, /6\.3\.1\.4/), 250 / h6.NbT, 1e-9); assert.ok(util(t, /6\.3\.1\.4/) > 1);
  // (b) the same restraints holding twist (phi = true): L_T = 1.5 m
  c.reset(Object.assign({}, lay, { ltbRestraints: R(true, 1.5, 3, 4.5) }));
  t = full().c; f = t.buck.tfb;
  near(f.LT, 1500, 1e-12); assert.ok(/spacing of twist restraints/.test(f.LTSrc), f.LTSrc);
  near(f.NcrT, h15.NcrT, 1e-6); near(f.NbT, h15.NbT, 1e-6); near(util(t, /6\.3\.1\.4/), 250 / h15.NbT, 1e-9); assert.ok(util(t, /6\.3\.1\.4/) < 1);
  // (c) twist restraints at 1.5 and 4.5 m only: the largest twist segment is 3 m (1.5-4.5), L_cr,z = 1.5 m if v is held everywhere
  c.reset(Object.assign({}, lay, { ltbRestraints: R(true, 1.5, 4.5).concat(R(false, 3)) }));
  t = full().c; f = t.buck.tfb; near(f.LT, 3000, 1e-12); near(t.buck.LcrZ, 1500, 1e-12);
  // (d) the user L_T overrides both
  c.reset(Object.assign({}, lay, { ltbRestraints: R(true, 1.5, 3, 4.5), LT: 6 }));
  f = full().c.buck.tfb; near(f.LT, 6000, 1e-12); assert.equal(f.LTSrc, 'user L<sub>T</sub>'); near(f.NbT, h6.NbT, 1e-6);
  // (e) the brief and the report name the source
  c.reset(Object.assign({}, lay, { ltbRestraints: R(false, 1.5, 3, 4.5) }));
  const r = row(brief(), /^N<sub>cr\.T<\/sub>/); assert.ok(r && /L<sub>T<\/sub> = 6 m = L<sub>cr,y<\/sub> \(no intermediate twist restraint\)/.test(r.vals), JSON.stringify(r));
  assert.ok(/L<sub>T<\/sub> = 6 m \(L<sub>cr,y<\/sub> \(no intermediate twist restraint\)\)/.test(report()));
});

// ---- finding 2: gamma_G,inf companions for uplift / hold-down and web bearing ----
test('[hand-derived] F2: overhang 457x191x82, supports 0 and 4 m, L = 6 m, G 3 kN/m + self-weight, 30 kN Q at the tip: the hold-down force is the EQU companion 0.9G + 1.5Q = -17.36 kN (STR set B -16.79, entered 1.35G -14.80); with G = 12 kN/m the support holds at 1.35G but lifts at 1.0G / 0.9G and is blocked without a hold-down', () => {
  // self-weight 82.0 kg/m -> 0.8044 kN/m; R_1 of a UDL w over 0-6 m on supports at 0 and 4 m: moments about x = 4: R_1 x 4 = 6w x (4 - 3) -> R_1 = 1.5 w
  // G = 3 + 0.8044 = 3.8044 kN/m -> R_1,G = 5.7066 kN; tip 30 kN at 6 m: R_1,Q = -30 x 2/4 = -15 kN
  //   1.35G + 1.5Q: 7.7039 - 22.5 = -14.796 kN;  1.0G + 1.5Q: 5.7066 - 22.5 = -16.793 kN;  0.9G + 1.5Q: 5.1359 - 22.5 = -17.364 kN
  // G = 12 + 0.8044 = 12.8044 -> R_1,G = 19.207: 1.35G: +3.429 (no uplift); 1.0G: -3.293; 0.9G: -5.214 kN
  const lay = { L: 6, supports: [{ pos: 0, type: 'pinned', holdDown: true, ss: 100 }, { pos: 4, type: 'pinned', ss: 100 }], restraint: 'full',
    loads: [{ type: 'udl', x1: 0, x2: 6, w: 3, case: 'G' }, { type: 'point', pos: 6, P: 30, case: 'Q' }] };
  c.reset(lay);
  let { a, c: ch } = full();
  const RG = 1.5 * (3 + 0.8044), RQ = -15;
  near(a.reacs[0].R[0], 1.35 * RG + 1.5 * RQ, 1e-6, '1.35G reaction'); near(1.35 * RG + 1.5 * RQ, -14.796, 1e-4);
  assert.equal(a.comp.length, 2); assert.ok(/\[&gamma;<sub>G,inf<\/sub> = 1\.0, STR set B\]$/.test(a.comp[0].label) && /= 0\.9, EQU set A\]$/.test(a.comp[1].label), a.comp.map(x => x.label).join(' | '));
  near(a.comp[0].R[0], 1.0 * RG + 1.5 * RQ, 1e-6, '1.0G companion'); near(a.comp[0].R[0], -16.793, 1e-4);
  near(a.comp[1].R[0], 0.9 * RG + 1.5 * RQ, 1e-6, '0.9G companion'); near(a.comp[1].R[0], -17.364, 1e-4);
  // the hold-down design force is the 0.9G EQU value and names the companion
  const u = a.uplift.supports[0]; near(u.RUls, 0.9 * RG + 1.5 * RQ, 1e-6); near(u.gInfUls, 0.9, 1e-12); assert.ok(/EQU set A\]$/.test(u.comboUls)); assert.equal(u.nCombos, 4);
  const hd = ch.holdDown.rows[0]; assert.ok(/design the hold-down for R = &minus;17\.36 kN \(combination .*EQU set A\]\)/.test(hd.msg), hd.msg); assert.ok(ch.pass, ch.unsupported.join(' | '));
  // the web-bearing sweep sees the STR set-B companion (not the EQU one): the lifting support bears nothing there
  const st0 = ch.web.stations.find(s => s.x === 0); assert.equal(st0.cases.length, 2); assert.ok(/STR set B\]$/.test(st0.cases[1].combo)); near(st0.cases[1].R, 0, 1e-12); near(st0.cases[1].F, 0, 1e-12);
  const st4 = ch.web.stations.find(s => s.x === 4000); near(st4.cases[1].R, 6 * (3 + 0.8044) + 45 - (1.0 * RG + 1.5 * RQ), 1e-6, 'support 2 reaction in the 1.0G companion');
  // brief: the companions are listed with the loads and the hold-down row carries the EQU force; report: the same
  let h = brief();
  assert.ok(/&gamma;<sub>G,inf<\/sub> companions<\/b> \(reactions only\): 2/.test(h) && /ULS C2: ULS: 1\.35G \+ 1\.5Q \(Eq 6\.10\) \[&gamma;<sub>G,inf<\/sub> = 0\.9, EQU set A\]/.test(h), 'companions listed');
  const hr = row(h, /^Hold-down provided at support 1/); assert.ok(hr && /R = &minus;17\.36 kN \(combination .*EQU set A\]\)/.test(hr.vals) && /R = &minus;17\.36 kN/.test(hr.res), JSON.stringify(hr));
  assert.ok(/Hold-down provided at support 1 \(x = 0 m\):<\/b> R = &minus;17\.36 kN/.test(report()));
  // G = 12 kN/m: no uplift at 1.35G, uplift in both companions -> ULS-level "Hold-down required" (blocking) without the box; 5.21 kN with it
  c.reset(Object.assign({}, lay, { supports: [{ pos: 0, type: 'pinned', ss: 100 }, { pos: 4, type: 'pinned', ss: 100 }], loads: [{ type: 'udl', x1: 0, x2: 6, w: 12, case: 'G' }, { type: 'point', pos: 6, P: 30, case: 'Q' }] }));
  ({ a, c: ch } = full());
  const RG12 = 1.5 * (12 + 0.8044);
  assert.ok(a.reacs[0].R[0] > 0, 'no uplift at 1.35G'); near(a.reacs[0].R[0], 1.35 * RG12 + 1.5 * RQ, 1e-6); near(a.comp[1].R[0], 0.9 * RG12 + 1.5 * RQ, 1e-6); near(0.9 * RG12 + 1.5 * RQ, -5.214, 1e-3);
  assert.equal(ch.pass, false); assert.ok(ch.unsupported.some(m => /^Hold-down required: R = &minus;5\.21 kN at support 1 .*EQU set A\]\)/.test(m)), ch.unsupported.join(' | '));
  assert.equal(ch.holdDown.rows[0].level, 'uls');
  // a member whose companions do not lift any support prints the count including them
  c.reset({});
  ({ a, c: ch } = full()); assert.equal(a.comp.length, 2); assert.ok(!a.uplift.any); assert.equal(a.uplift.nCombos, 4);
  h = brief(); const ur = row(h, /^Uplift$/); assert.ok(ur && /any of the 4 combinations/.test(ur.vals) && /incl\. the 2 &gamma;<sub>G,inf<\/sub> companions/.test(ur.vals), JSON.stringify(ur));
  // a ULS combination with G at 1.0 gets no companion
  c.reset({ combos: [{ id: 'c1', label: 'ULS: 1.0G + 1.5Q', factors: { G: 1.0, Q: 1.5, W: 0, E: 0 }, sls: false, on: true }, { id: 's1', label: 'SLS', factors: { G: 0, Q: 1, W: 0, E: 0 }, sls: true, on: true }] });
  ({ a } = full()); assert.equal(a.comp.length, 0); assert.ok(/none generated/.test(a.patterns.note || '') || a.patterns.nComp === 0);
});

// ---- finding 4: influence-line pattern for the maximum reaction at an interior support (n >= 4 spans) ----
test('[hand-derived] F4: four equal 5 m spans, Q = 10 kN/m: the set "spans 1+2+4" gives R_2 = 1.22321 wL = 61.161 kN against 1.19643 wL = 59.821 kN for the pair 1+2 (+2.2 %); the sets are generated for every interior support, de-duplicated, and feed the web-bearing F_Ed', () => {
  // three-moment equation, equal spans L, w on spans 1, 2, 4 (u = wL^2): 4M2 + M3 = -u/2; M2 + 4M3 + M4 = -u/4; M3 + 4M4 = -u/4
  //   -> M3 = -u/56, M2 = -27u/224, M4 = -13u/224; R2 = wL - (2M2 - M1 - M3)/L = wL (1 + 50/224) = 1.223214 wL
  // pair 1+2: 4M2 + M3 = -u/2; M2 + 4M3 + M4 = -u/4; M3 + 4M4 = 0 -> M3 = -u/28, M2 = -13u/112; R2 = wL (1 + 22/112) = 1.196429 wL
  const lay = { L: 20, supports: [0, 5, 10, 15, 20].map(p => ({ pos: p, type: 'pinned', ss: 100 })), restraint: 'full',
    combos: [{ id: 'c1', label: 'ULS: 1.0Q', factors: { G: 0, Q: 1.0, W: 0, E: 0 }, sls: false, on: true }, { id: 's1', label: 'SLS', factors: { G: 0, Q: 1, W: 0, E: 0 }, sls: true, on: true }],
    loads: [{ type: 'udl', x1: 0, x2: 20, w: 10, case: 'Q' }] };
  c.reset(lay);
  const { a, c: ch } = full();
  const wL = 10 * 5;
  const find = re => a.reacs.find(r => re.test(r.label));
  const s124 = find(/Q on spans 1\+2\+4 only \(max reaction at x = 5 m\)/), s134 = find(/Q on spans 1\+3\+4 only \(max reaction at x = 15 m\)/), p12 = find(/Q on spans 1\+2 only\)/);
  assert.ok(s124 && s134 && p12, a.ulsLabels.join(' | '));
  near(s124.R[1], (1 + 50 / 224) * wL, 1e-6, 'R2 (1+2+4)'); near((1 + 50 / 224) * wL, 61.161, 1e-4);
  near(p12.R[1], (1 + 22 / 112) * wL, 1e-6, 'R2 (1+2)'); near((1 + 22 / 112) * wL, 59.821, 1e-4);
  assert.ok(s124.R[1] > p12.R[1] && s124.R[1] > Math.max(...a.reacs.filter(r => r !== s124).map(r => r.R[1])), 'the reaction set governs R2');
  near(s134.R[3], s124.R[1], 1e-9, 'mirror set at x = 15 m');
  // the middle support's set {2, 3} equals the pair 2+3 and is dropped; 12 ULS combinations in all
  assert.equal(a.ulsLabels.filter(l => /max reaction/.test(l)).length, 2); assert.equal(a.ulsLabels.length, 12);
  // web bearing at x = 5 m takes F_Ed from that pattern
  const st = ch.web.stations.find(s => Math.abs(s.x - 5000) < 1); near(st.F, s124.R[1], 1e-6); assert.ok(/max reaction at x = 5 m/.test(st.combo), st.combo);
  // three spans: no reaction set (the pair already covers it); the note names the set
  c.reset(Object.assign({}, lay, { L: 15, supports: [0, 5, 10, 15].map(p => ({ pos: p, type: 'pinned', ss: 100 })), loads: [{ type: 'udl', x1: 0, x2: 15, w: 10, case: 'Q' }] }));
  const t = full().a; assert.equal(t.ulsLabels.filter(l => /max reaction/.test(l)).length, 0);
  c.reset(lay); assert.ok(/maximum reaction at each interior support/.test(full().a.patterns.note));
});

// ---- findings 3 + 7: stiff bearing default and the support-row label ----
test('[hand-derived] F3/F7: a blank support s_s is the lower bound 0 (demo reaction 229.5 kN vs F_Rd 135.4 kN -> NOT VERIFIED, not FAIL); the demo state carries s_s = 100 (F_Rd 437.3 kN, PASS); the support-row label no longer prints the section flange width, so a section change cannot leave a stale default', () => {
  // demo 457x191x82, 8 m, 57.38 kN/m at ULS -> R = 229.5 kN; s_s = 0 type (c): k_F = 2, F_cr = 856.9 kN, l_e = 0, second pass l_y = 16 sqrt(19.3232/2) = 49.73,
  // lambda_F = sqrt(49.73 x 9.9 x 275/856946) = 0.3975, chi_F = 1 -> F_Rd = 275 x 49.73 x 9.9 = 135.4 kN (web-transverse.test.cjs); s_s = 100: F_Rd = 437.3 kN
  c.reset({});
  let r = full(); assert.equal(r.c.web.stations.filter(s => s.support).every(s => s.ss === 100 && !s.ssDefault), true); assert.ok(r.c.pass); near(r.c.web.gov2.FRdTot, 437.34, 1e-4);
  assert.equal(run('JSON.stringify(DEMO.supports.map(s=>s.ss))'), '[100,100]');
  c.reset({ supports: [{ pos: 0, type: 'pinned' }, { pos: 8, type: 'pinned' }] });
  r = full(); const W = r.c.web;
  assert.ok(W.stations.every(s => s.ss === 0 && s.ssDefault && s.nv), 'lower bound, NOT VERIFIED'); near(W.stations[0].FRdTot, 135.39, 1e-4); near(W.stations[0].eta2, 229.5 / 135.39, 1e-3);
  assert.equal(r.c.pass, false); assert.ok(!r.c.utils.some(u => u.val > 1.0001), 'no failing entry: NOT VERIFIED'); assert.equal(r.c.unsupported.filter(m => /^Web transverse force at x/.test(m)).length, 2);
  assert.equal(W.show, W.stations[1]); assert.equal(W.gov2, null); assert.equal(W.checked, false);
  // a lighter beam passes at the lower bound and is verified for any seating: 203x133x25, 4 m, 5 + 5 kN/m -> R = 34.9 kN
  c.reset({ family: 'ub', ubKey: '203 x 133 x 25', L: 4, supports: [{ pos: 0, type: 'pinned' }, { pos: 4, type: 'pinned' }], loads: [{ type: 'udl', x1: 0, x2: 4, w: 5, case: 'G' }, { type: 'udl', x1: 0, x2: 4, w: 5, case: 'Q' }] });
  r = full(); assert.ok(r.c.web.stations.every(s => s.ssDefault && s.ss === 0 && !s.nv) && r.c.web.checked && r.c.pass, r.c.unsupported.join(' | '));
  // F7: the support row label is section-independent (no "blank = B = ..." text); switching the section changes nothing in it
  const labelFor = key => run(`(()=>{ S.family='ub'; S.ubKey=${JSON.stringify(key)}; const rows=[]; const fake={innerHTML:'', appendChild:r=>rows.push(r.innerHTML), querySelectorAll:()=>[]};
    document.getElementById=()=>fake; document.createElement=()=>({className:'',innerHTML:''}); renderSupportList(); return rows.map(h=>{ const i=h.indexOf('Stiff bearing'); return i<0? '' : h.slice(i, h.indexOf('</span>', i)); }); })()`);
  const l1 = labelFor('457 x 191 x 82'), l2 = labelFor('610 x 229 x 101');
  assert.ok(l1.length === 2 && l1[0] && /lower bound 0/.test(l1[0]) && !/B =/.test(l1[0]), JSON.stringify(l1));
  assert.equal(JSON.stringify(l1), JSON.stringify(l2), 'label identical after a section change');
  run("document.getElementById=()=>null; delete document.createElement;");
});

// ---- finding 6: solve caches (eigen and warping-torsion FE) ----
test('F6: a re-render with unchanged loads / layout is served from the eigen and FE-torsion caches (0 new solves, identical results); a changed load solves again; the brief prints the solve counts', () => {
  const lay = { L: 8, supports: [{ pos: 0, type: 'pinned', holdDown: true, ss: 100 }, { pos: 6, type: 'pinned', ss: 100 }], restraint: 'ltb', mcrMethod: 'eigen', eccOn: true,
    loads: [{ type: 'udl', x1: 0, x2: 8, w: 10, case: 'G', e: 40 }, { type: 'udl', x1: 0, x2: 8, w: 15, case: 'Q', e: 40 }, { type: 'point', pos: 8, P: 20, case: 'Q', e: 60 }] };
  const probe = () => run(`(()=>{ const a=analyse(); const ch=checks(a); return {Mcr:ch.ltb.Mcr, phi:ch.tor.BMax, nCombos:ch.ltb.nCombos, ltbSolved:ch.ltb.nSolves, ltbCached:ch.ltb.nCached, feSolved:ch.tor.nSolves, feCached:ch.tor.nCached, nUls:a.ulsResults.length}; })()`);
  c.reset(lay);
  const r1 = probe();
  assert.ok(r1.nUls === 3 && r1.nCombos === 3 && r1.feSolved === 6 && r1.feCached === 0, JSON.stringify(r1));    // 3 ULS + 3 SLS FE solves on a fresh cache (the harness loads the app once per file: an earlier test may have warmed it)
  assert.ok(r1.ltbSolved + r1.ltbCached === 7, 'actual + shape-only per combination + one uniform reference: ' + JSON.stringify(r1));
  // unrelated input changed (deflection divisor): everything comes from the caches, results identical
  run('S.divisor=250');
  const r2 = probe();
  assert.equal(r2.ltbSolved, 0); assert.equal(r2.ltbCached, 7); assert.equal(r2.feSolved, 0); assert.equal(r2.feCached, 6);
  near(r2.Mcr, r1.Mcr, 1e-12); near(r2.phi, r1.phi, 1e-12);
  // a changed load re-solves
  run('S.loads[1].w=16');
  const r3 = probe(); assert.ok(r3.ltbSolved > 0 && r3.feSolved > 0 && r3.Mcr !== r1.Mcr, JSON.stringify(r3));
  // brief rows carry the counts
  const h = brief();
  const fe = row(h, /^M<sub>cr<\/sub> = FE eigenvalue/); assert.ok(fe && /3 combination\(s\), 0 solve\(s\) \+ 7 cached/.test(fe.vals), JSON.stringify(fe));
  const ta = row(h, /^Torsion analysis$/); assert.ok(ta && /0 FE solve\(s\) \+ 6 cached/.test(ta.vals), JSON.stringify(ta));
});
