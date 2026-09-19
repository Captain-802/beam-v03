// 19 Sep 2026 gap closure, group G3 (docs/COVERAGE_MATRIX.md section 5, P2 items
// 5, 6, 7, 8, 9, 10, 12, 15): minor-axis classification of I/H, A_eff of a
// Class-4 web in uniform compression, cl 6.2.10 M-V-N, k_c floor, Table B.1 RHS
// row, channel torsional-flexural buckling, high-shear M_v,Rd for every family,
// restraint design forces. Expected values are hand derived from the section
// tables and the code expressions ([hand-derived] in the comments); where the
// FE solver supplies a station force (V, M) the chain is recomputed from that
// station value and the raw table, never from the engine's intermediate result.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { app } = require('./harness.cjs');
const c = app();
const run = x => c.run(x);
function near(actual, expected, rel = 1e-6, what = '') { assert.ok(Math.abs(actual - expected) <= rel * Math.max(1, Math.abs(expected)), `${what} ${actual} != ${expected}`); }
const SS = (L, loads, extra = {}) => Object.assign({ L, supports: [{ pos: 0, type: 'pinned' }, { pos: L, type: 'pinned' }], loads }, extra);
const full = () => run(`(()=>{ const a=analyse(); const ch=checks(a); return {a:{Mmax:a.Mmax, sec:a.sec, fy:a.py, E:a.E, L:a.L}, c:ch}; })()`);
const util = (ch, re) => { const u = ch.utils.find(u => re.test(u.name)); return u ? u.val : null; };
const brief = () => run(`(()=>{ const a=analyse(); const ch=checks(a); return renderMasterSeriesBrief(a,ch,a.sec); })()`);
const report = () => run(`(()=>{ const el={innerHTML:'',style:{}}; document.getElementById=()=>el; render(); return el.innerHTML; })()`);
const ROW = /<div class="ms-row[^"]*"><div class="ms-l">(.*?)<\/div><div class="ms-v[^"]*">(.*?)<\/div><div class="ms-r">(.*?)<\/div><div class="ms-t">(.*?)<\/div><\/div>/g;
const rows = html => [...html.matchAll(ROW)].map(m => ({ label: m[1], vals: m[2], res: m[3], tag: m[4] }));
const row = (html, re) => rows(html).find(r => re.test(r.label)) || null;
const num = s => parseFloat(String(s).replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ''));
const chiStrut = (lam, alpha) => { const Phi = 0.5 * (1 + alpha * (lam - 0.2) + lam * lam); return Math.min(1 / (Phi + Math.sqrt(Phi * Phi - lam * lam)), 1); };

// ---- item 5: minor-axis classification of I/H ----
test('[hand-derived] item 5: a UB with M_z keeps its y-y web class (Class 1), the flange outstand stresses are printed, and the biaxial check is evaluated instead of blocked', () => {
  c.reset({ Mz: 60 });    // 457x191x82 S275 demo, 8 m, restrained; M_y,Ed = 459.0 kN.m
  const { a, c: ch } = full();
  assert.equal(ch.cl.cls, 1); assert.equal(ch.cl.webCase, 'bending'); assert.equal(ch.cl.mzFlange, 'outstand');
  assert.equal(JSON.stringify(ch.cl.wlim), '[72,83,124]');
  assert.ok(!ch.unsupported.some(m => /Class 4/.test(m)), 'not blocked as Class 4 any more');
  // sigma_My = 459.0e6/1610e3 = 285.1; sigma_Mz,tip = 60e6/196e3 = 306.1; y_root = 9.9/2 + 10.2 = 15.15, y_tip = 95.65 -> sigma_Mz,root = 48.5
  const ms = ch.cl.mzStress;
  near(ms.sMy, Math.abs(a.Mmax) * 1e6 / (a.sec.Zx * 1e3), 1e-9); near(ms.sMzTip, 60e6 / (a.sec.Zy * 1e3), 1e-9);
  near(ms.yRoot, 15.15, 1e-9); near(ms.sMzRoot, ms.sMzTip * 15.15 / 95.65, 1e-9);
  near(ms.compRoot, ms.sMy + ms.sMzRoot, 1e-9); near(ms.compTip, ms.sMy + ms.sMzTip, 1e-9);   // both compressive -> alpha = 1
  assert.equal(ms.compAlpha, 1); assert.equal(ms.relState, 'tip in tension');                 // 285.1 - 306.1 < 0 on the opposite outstand
  // the cross-section biaxial check runs: (459.0/503.25)^2 + (60/83.6)^1 = 0.832 + 0.718 = 1.550 -> FAIL, a real verdict
  const bi = util(ch, /Biaxial bending/);
  near(bi, Math.pow(Math.abs(a.Mmax) / (a.sec.Sx * 1e3 * a.fy / 1e6), 2) + 60 / (a.sec.Sy * 1e3 * a.fy / 1e6), 1e-9, 'biaxial');
  assert.ok(bi > 1 && !ch.pass);
  // with M_z = 10 kN.m the same beam passes: 0.832 + 10/83.6 = 0.951
  c.reset({ Mz: 10 });
  const p = full().c; near(util(p, /Biaxial bending/), 0.8319 + 10 / 83.6, 2e-3); assert.ok(p.pass, JSON.stringify(p.unsupported));
  // brief: web row names the M_z basis, flange-outstand row present with the stresses; no "uniform-compression web bound" advisory for an I/H
  c.reset({ Mz: 60 });
  const h = brief();
  const web = row(h, /^Web classified for$/); assert.ok(web && /y-y bending: limits 72&epsilon;/.test(web.vals) && /does not stress the web/.test(web.vals));
  const fl = row(h, /^Flange outstands under/); assert.ok(fl && fl.tag === 'Table 5.2 sheet 2' && /tip in tension/.test(fl.vals));
  near(num(fl.vals.match(/tip ([\d.]+) N/)[1]), ms.compTip, 1e-3);
  assert.ok(!/uniform-compression limits/.test(h), 'I/H prints no uniform-compression advisory');
  const rep = report(); assert.ok(/Flange outstands under M<sub>y<\/sub> \+ M<sub>z<\/sub>/.test(rep) && /does not stress the web of an I\/H section/.test(rep), 'report rows');
  // hollow sections keep the conservative bound (Class 4 -> blocked)
  c.reset({ family: 'rhs', rhsKey: '400 x 200 x 8.0', Mz: 5 });
  const b = full().c; assert.equal(b.cl.cls, 4); assert.equal(b.cl.webCase, 'biaxial: uniform-compression web bound'); assert.ok(b.unsupported.some(m => /Class 4/.test(m)));
});

// ---- item 6: A_eff of a Class-4 web in uniform compression ----
test('[hand-derived] item 6: 1016x305x249 with N = 3000 kN evaluates with A_eff < A (EN 1993-1-5 4.4) in N_c,Rd, N_b,Rd and the Table 6.7 Class-4 column', () => {
  c.reset(SS(12, [{ type: 'udl', x1: 0, x2: 12, w: 19.7, case: 'G' }, { type: 'udl', x1: 0, x2: 12, w: 19.8, case: 'Q' }], { ubKey: '1016 x 305 x 249', axial: 3000 }));
  const { a, c: ch } = full();
  assert.ok(!ch.unsupported.length, 'no block: ' + ch.unsupported.join(' | '));
  // t_f = 26 -> f_y = 265, eps = sqrt(235/265) = 0.9417; d/t = 52.6 > 42 eps = 39.55 -> Class 4 in uniform compression
  // lambda_p = 52.6/(28.4 x 0.9417 x 2) = 0.9834; rho = (0.9834 - 0.22)/0.9834^2 = 0.7894; b_ineff = 0.2106 x 868.1 = 182.8 mm
  // A_eff = 31700 - 182.8 x 16.5 = 28683 mm2 (0.905 A)
  const eps = Math.sqrt(235 / 265); assert.equal(a.fy, 265);
  const lamP = 52.6 / (28.4 * eps * 2), rho = (lamP - 0.22) / (lamP * lamP), Aeff = 31700 - (1 - rho) * 868.1 * 16.5;
  const ae = ch.aeff; assert.ok(ae.active); near(ae.lamP, lamP, 1e-9); near(ae.rho, rho, 1e-9); near(ae.Aeff, Aeff, 1e-9); near(Aeff, 28683, 1e-4); assert.ok(ae.Aeff < ae.A);
  assert.equal(ch.cl.cls, 3, 'Class 3 under the combined N + M stress distribution (as before)');
  // N_c,Rd = A_eff f_y = 28683 x 265/1000 = 7601 kN; N_Ed/N_c,Rd = 0.3947
  near(ch.ax.NcRd, Aeff * 265 / 1000, 1e-9); near(ch.ax.nUtil, 3000 / (Aeff * 265 / 1000), 1e-9);
  assert.equal(ch.utils.find(u => /^Compression/.test(u.name)).name, 'Compression  N_Ed/N_c,Rd (A_eff)');
  // lambda-bar carries sqrt(A_eff/A): lambda_y = (12000/390)/lambda_1 x sqrt(0.9048), lambda_1 = pi sqrt(210000/265) = 88.45
  const B = ch.buck, lam1 = Math.PI * Math.sqrt(210000 / 265), af = Math.sqrt(Aeff / 31700);
  near(B.lamY, 12000 / 390 / lam1 * af, 1e-9); near(B.lamZ, 12000 / 60.9 / lam1 * af, 1e-9);
  near(B.NbY, chiStrut(B.lamY, 0.21) * Aeff * 265 / 1000, 1e-9); near(B.NbZ, chiStrut(B.lamZ, 0.34) * Aeff * 265 / 1000, 1e-9);   // UB t_f <= 40: a / b
  assert.equal(B.c12, false, 'Class 3/4 k_ij rows'); near(B.wFac, 1, 1e-12, 'W_eff,y = W_el,y already (Class 3)');
  near(B.u1, B.ny + B.kyy * Math.abs(a.Mmax) / B.MbRdEff, 1e-9);
  // brief and report print the assumption
  const h = brief();
  const ar = row(h, /^A<sub>eff<\/sub> = A/); assert.ok(ar && ar.tag === 'EN 1993-1-5 4.4'); near(num(ar.res), Aeff / 100, 1e-3);
  assert.ok(row(h, /^N<sub>c\.Rd<\/sub> = A<sub>eff<\/sub>/) && row(h, /^N<sub>Ed<\/sub>\/N<sub>c\.Rd<\/sub>$/) && row(h, /^Table 6\.7 Class-4 column$/) && row(h, /^&lambda;&#772;<sub>y<\/sub> = &radic;A<sub>eff<\/sub>/));
  assert.ok(/\(Axial: Slender web\)/.test(h));
  const rep = report(); assert.ok(/A<sub>eff<\/sub> &mdash; web Class 4 in uniform compression/.test(rep) && /Table 6.7 Class-4 column/.test(rep));
  // a Class-2-under-combined UB (457x191x82, N = 800 kN) also takes A_eff for the compression terms and W_el,y/W_pl,y in the interaction
  c.reset({ axial: 800 });
  const r2 = full().c; assert.ok(!r2.unsupported.length && r2.aeff.active && r2.cl.cls === 2);
  near(r2.buck.wFac, 1610 / 1830, 1e-9); assert.equal(r2.buck.c12, false); near(r2.buck.MbRdEff, r2.McRd * 1610 / 1830, 1e-9);
  near(r2.aeff.Aeff, 10065.6, 1e-4);   // lambda_p = 41.2/(28.4 x 0.9244 x 2) = 0.7847, rho = 0.9171, 10400 - 0.0829 x 407.6 x 9.9
});

// ---- items 7 and 12: cl 6.2.10 M-V-N sweep and the family M_v,Rd forms ----
test('[hand-derived] items 7/12: rolled I/H Class 1/2 with high shear and N: (1 - rho) f_y on A_v gives N_V,Rd, M_v,Rd, a_V and the 6.2.9.1 chain at the worst station; uniaxial = plain ratio', () => {
  const lay = SS(2, [{ type: 'point', pos: 0.3, P: 400, case: 'Q' }]);
  // N = 500: waiver (N <= 0.25 N_V,Rd = 675 and <= 0.5 h_w t_w (1 - rho) f_y = 511 kN), Class 1; N = 600: no waiver, Class 2 under the combined stress (alpha = 0.770, 396 eps/(13 alpha - 1) = 40.6 < 41.2 < 456 eps/9.01 = 46.8)
  for (const [N, waiverExp] of [[500, true], [600, false]]) {
    c.reset(Object.assign({}, lay, { axial: N }));
    const { a, c: ch } = full();
    assert.ok(!ch.unsupported.some(m => /6\.2\.10|High shear/.test(m)), 'no 6.2.10 block');
    assert.ok(ch.cl.cls <= 2, 'N = ' + N + ': Class ' + ch.cl.cls);   // N = 500: alpha = 0.725 -> 43.4 > 41.2 Class 1; N = 600: Class 2
    const m = ch.mvn; assert.ok(m && !m.biax && m.plastic && m.N === N, JSON.stringify(m));
    const sec = a.sec, fy = a.fy, A = sec.A * 100, Av = ch.Av, Vpl = ch.VcRd;
    // chain from the station's own V (engine) and the raw table
    const rho = Math.pow(2 * m.V / Vpl - 1, 2); near(m.rho, rho, 1e-9); assert.ok(rho > 0);
    const NV = (A - rho * Av) * fy / 1000, MvY = (sec.Sx * 1e3 - rho * Av * Av / (4 * sec.tw)) * fy / 1e6;
    near(m.NV, NV, 1e-9); near(m.MvY, MvY, 1e-9);
    const aV = Math.min(((A - 2 * sec.B * sec.tf) - rho * Av) / (A - rho * Av), 0.5); near(m.aV, aV, 1e-9);
    const hw = sec.D - 2 * sec.tf, nV = N / NV; near(m.nV, nV, 1e-9);
    const waiver = N <= 0.25 * NV && N * 1000 <= 0.5 * hw * sec.tw * (1 - rho) * fy;
    assert.equal(m.waiver, waiverExp); assert.equal(waiver, waiverExp);
    const MNVy = waiver ? MvY : Math.min(MvY * (1 - nV) / (1 - 0.5 * aV), MvY); near(m.MNVy, MNVy, 1e-9);
    near(m.u, m.M / MNVy, 1e-9, 'uniaxial: plain ratio, no exponent');
    near(util(ch, /6\.2\.10/), m.u, 1e-12);
    assert.equal(ch.utils.find(u => /6\.2\.10/.test(u.name)).name, 'Bending+shear+axial (6.2.10)');
  }
  // biaxial: M_z = 20 -> power form with alpha = 2, beta = max(5 n_V, 1); M_N,V,z per 6.2.9.1(5)
  c.reset(Object.assign({}, lay, { axial: 500, Mz: 20 }));
  const { a, c: ch } = full(); const m = ch.mvn, sec = a.sec, fy = a.fy;
  assert.ok(m.biax && m.alpha === 2); near(m.beta, Math.max(5 * m.nV, 1), 1e-12);
  const MvZ = (sec.Sy * 1e3 - m.rho * ch.Av * sec.tw / 4) * fy / 1e6; near(m.MvZ, MvZ, 1e-9);
  const MNVz = m.nV <= m.aV ? MvZ : MvZ * (1 - Math.pow((m.nV - m.aV) / (1 - m.aV), 2)); near(m.MNVz, MNVz, 1e-9);
  near(m.u, Math.pow(m.M / m.MNVy, 2) + Math.pow(20 / MNVz, m.beta), 1e-9);
  assert.equal(ch.utils.find(u => /6\.2\.10/.test(u.name)).name, 'Bending+shear+axial+biaxial (6.2.10)');
  assert.ok(!ch.unsupported.some(s => /minor-axis\/biaxial bending requires/.test(s)), 'M_z + high shear no longer blocked');
  // brief and report rows
  const h = brief(); const r = row(h, /M<sub>N\.V\.y\.Rd<\/sub>\)<sup>&alpha;<\/sup>/); assert.ok(r && /6\.2\.10/.test(r.tag)); near(num(r.res), m.u, 1e-3);
  assert.ok(/M-V-N/.test(h), 'unity cell');
  assert.ok(/cl 6\.2\.10\)/.test(report()));
});

test('[hand-derived] item 12: M_v,Rd forms for a Class 3 I/H (elastic web), a channel and an RHS, and the peak-station reduction for every family', () => {
  // Class 3 I/H: 203x133x25 S460 (c/t_f = 7.2 > 10 eps = 7.15, < 14 eps): M_v = (W_el,y - rho I_web/(h/2)) f_y
  c.reset(SS(1.5, [{ type: 'point', pos: 0.2, P: 200, case: 'Q' }], { ubKey: '203 x 133 x 25', grade: 'S460' }));
  let { a, c: ch } = full(); assert.equal(ch.cl.cls, 3); assert.ok(ch.coex && !ch.coex.pureShearFail, JSON.stringify(ch.coex));
  let sec = a.sec, fy = a.fy, hw = sec.D - 2 * sec.tf, Iweb = sec.tw * Math.pow(hw, 3) / 12;
  near(ch.coex.MvRd, Math.min((sec.Zx * 1e3 - ch.coex.rho * Iweb / (sec.D / 2)) * fy / 1e6, ch.McRd), 1e-9);
  assert.ok(/elastic, conservative/.test(ch.coex.form));
  assert.ok(!ch.unsupported.some(s => /shear/i.test(s)), 'Class 3 I/H high shear no longer blocked');
  // channel: 180x75x20 PFC: M_v = (W_pl,y - rho t_w h_w^2/4) f_y (Class 1)
  c.reset(SS(1.5, [{ type: 'point', pos: 0.2, P: 90, case: 'Q' }], { family: 'pfc', sectionKey: '180x75x20' }));
  ({ a, c: ch } = full()); sec = a.sec; fy = a.fy; hw = sec.D - 2 * sec.tf;
  assert.ok(ch.coex && ch.coex.rho > 0 && ch.cl.cls <= 2);
  near(ch.coex.MvRd, Math.min((sec.Sx * 1e3 - ch.coex.rho * sec.tw * hw * hw / 4) * fy / 1e6, ch.McRd), 1e-9);
  assert.ok(!ch.unsupported.some(s => /shear/i.test(s)));
  // RHS 200x100x8: two webs, M_v = (W_pl,y - rho t (h - 2t)^2/2) f_y; with N: a_V and a_f,V of the reduced section, Eq 6.39/6.40 form
  c.reset(SS(1.5, [{ type: 'point', pos: 0.2, P: 300, case: 'Q' }], { family: 'rhs', axial: 300 }));
  ({ a, c: ch } = full()); sec = a.sec; fy = a.fy;
  const m = ch.mvn; assert.ok(m && m.plastic && /6\.39/.test(m.form));
  const t = sec.tf, hi = sec.D - 2 * t, A = sec.A * 100;
  near(m.MvY, Math.min((sec.Sx * 1e3 - m.rho * t * hi * hi / 2) * fy / 1e6, sec.Sx * 1e3 * fy / 1e6), 1e-9);
  near(m.NV, (A - m.rho * ch.Av) * fy / 1000, 1e-9);
  near(m.afV, Math.min((A - 2 * sec.D * t) / (A - m.rho * ch.Av), 0.5), 1e-9);
  near(m.MNVy, Math.min(m.MvY * (1 - m.nV) / (1 - 0.5 * m.aV), m.MvY), 1e-9);
  assert.ok(!ch.unsupported.some(s => /shear/i.test(s)));
  // peak-station reduction (cl 6.2.8(3) at the point of maximum moment) now applies to a channel: 430x100x64 cantilever 1 m, tip 300 kN Q:
  // root V = 450 kN > 0.5 V_pl = 0.5 x 4904 x 265/sqrt(3) = 375 kN at the root moment -> M_c,Rd printed as M_v,Rd with the channel form
  c.reset({ L: 1, supports: [{ pos: 0, type: 'fixed' }], loads: [{ type: 'point', pos: 1, P: 300, case: 'Q' }], family: 'pfc', sectionKey: '430x100x64', autoPattern: false });
  ({ a, c: ch } = full());
  assert.ok(!ch.lowShearAtM && ch.mvForm && /t<sub>w<\/sub>h<sub>w<\/sub>&sup2;\/4/.test(ch.mvForm), ch.hsNote);
  assert.ok(!ch.unsupported.some(s => /6\.2\.8 reduced moment resistance/.test(s)));
  const h = brief(); const mv = row(h, /^M<sub>v\.y\.Rd<\/sub> = /); assert.ok(mv && /h<sub>w<\/sub>&sup2;/.test(mv.label) && mv.tag === '6.2.8');
});

// ---- item 8: k_c floor ----
test('[hand-derived] item 8: k_c = 1/sqrt(C1) is floored at 1/sqrt(2.76) = 0.602 on both Mcr routes; the SCI end-moment curve at psi = -1 (C1 = 2.756) is not floored', () => {
  near(run('KC_FLOOR'), 1 / Math.sqrt(2.76), 1e-12); assert.deepEqual(run('JSON.stringify(kcFromC1(5))'), JSON.stringify({ kc: 1 / Math.sqrt(2.76), kcRaw: 1 / Math.sqrt(5), floored: true }));
  // Gerber layout of the coverage-matrix appendix: whole-member eigen C1 ~ 5.0 -> k_c 0.447 -> floored 0.602
  c.reset({ restraint: 'ltb', L: 12, supports: [{ pos: 0, type: 'fixed' }, { pos: 8, type: 'pinned' }, { pos: 12, type: 'pinned' }], hinges: [{ pos: 4 }],
    loads: [{ type: 'udl', x1: 0, x2: 12, w: 19.7, case: 'G' }, { type: 'udl', x1: 0, x2: 12, w: 19.8, case: 'Q' }], autoPattern: false });
  const e = full().c.ltb; assert.ok(e.C1 > 2.76 && e.kcFloored); near(e.kc, 1 / Math.sqrt(2.76), 1e-12); near(e.kcRaw, 1 / Math.sqrt(e.C1), 1e-12);
  assert.ok(e.warn.some(w => /floored at 1\/&radic;2\.76/.test(w)));
  // standard route, three-span trapezoid (Serna C1 = 4.09): f = 1 - 0.5(1 - 0.602)[1 - 2(0.949 - 0.8)^2] = 0.810, M_b,Rd = 416.7 kN.m
  c.reset({ L: 12, restraint: 'ltb', mcrMethod: 'standard', supports: [{ pos: 0, type: 'pinned' }, { pos: 4, type: 'pinned' }, { pos: 8, type: 'pinned' }, { pos: 12, type: 'pinned' }],
    loads: [{ type: 'trap', x1: 0, x2: 12, w1: 5, w2: 15, case: 'Q' }], autoPattern: false });
  const { a, c: s } = full(); const L = s.ltb;
  assert.ok(s.C1 > 2.76 && L.kcFloored); near(L.kc, 1 / Math.sqrt(2.76), 1e-12);
  const lam = Math.sqrt(a.sec.Sx * 1e3 * a.fy / (L.Mcr * 1e6));
  near(L.fM, Math.min(1 - 0.5 * (1 - 1 / Math.sqrt(2.76)) * (1 - 2 * Math.pow(lam - 0.8, 2)), 1), 1e-9);
  near(L.MbRd, Math.min(L.chiM / L.fM * a.sec.Sx * 1e3 * a.fy / 1e6, s.McRd), 1e-9); near(L.MbRd, 416.68, 2e-4);
  const h = brief(); assert.ok(/k<sub>c<\/sub> floored at 0\.60 \(Table 6\.6\)/.test(row(h, /^&chi;<sub>LT\.mod<\/sub> = Fn/).tag));
  assert.ok(/floored at 1\/&radic;2\.76/.test(report()));
  // psi = -1 end moments: C1 = (1.33 + 0.33)^2 = 2.756 < 2.76 -> raw k_c = 0.6024 kept
  c.reset(SS(8, [{ type: 'moment', pos: 0, M: 200, case: 'Q' }, { type: 'moment', pos: 8, M: 200, case: 'Q' }], { restraint: 'ltb', mcrMethod: 'standard' }));
  const p = full().c; near(p.C1, 2.7556, 1e-4); assert.equal(p.ltb.kcFloored, false); near(p.ltb.kc, 1 / Math.sqrt(p.C1), 1e-12);
});

// ---- item 9: Table B.1 RHS row ----
test('[hand-derived] item 9: SHS/RHS Class 1/2 use k_zz = C_mz(1 + (lambda_z - 0.2) n_z) <= C_mz(1 + 0.8 n_z) and k_yz = k_zz', () => {
  c.reset(SS(6, [{ type: 'udl', x1: 0, x2: 6, w: 5, case: 'Q' }], { family: 'shs', shsKey: '150x150x6.3', restraint: 'ltb', axial: 200, Mz: 5 }));
  const B = full().c.buck; assert.ok(B.c12 && B.rhsRow && B.useB1);
  // lambda_z = 1.181, n_z = 0.375: 1 + (1.181 - 0.2) x 0.375 = 1.368 > cap 1 + 0.8 x 0.375 = 1.300 -> k_zz = 1.300; k_yz = k_zz
  near(B.kzz, Math.min(B.Cmz * (1 + (B.lamZ - 0.2) * B.nz), B.Cmz * (1 + 0.8 * B.nz)), 1e-12); near(B.kzz, 1 + 0.8 * B.nz, 1e-12);
  near(B.kyz, B.kzz, 1e-12); near(B.kzy, 0.6 * B.kyy, 1e-12);
  const h = brief(); assert.equal(row(h, /^k<sub>zz<\/sub> = C<sub>mz<\/sub>\{1\+\(&lambda;&#772;<sub>z<\/sub>&minus;0\.2\)/).tag, 'Table B.1 (RHS)');
  assert.equal(row(h, /^k<sub>yz<\/sub> = k<sub>zz<\/sub>$/).tag, 'Table B.1 (RHS)');
  assert.ok(/Table B\.1 RHS row/.test(report()));
  // I-section row unchanged: 457x191x133 with N (Class 1): k_zz = C_mz(1 + (2 lambda_z - 0.6) n_z) <= C_mz(1 + 1.4 n_z), k_yz = 0.6 k_zz
  c.reset(SS(6, [{ type: 'udl', x1: 0, x2: 6, w: 15, case: 'Q' }], { ubKey: '457 x 191 x 133', grade: 'S355', restraint: 'ltb', axial: 140, Mz: 5 }));
  const I = full().c.buck; assert.ok(I.c12 && !I.rhsRow);
  near(I.kzz, Math.min(I.Cmz * (1 + (2 * I.lamZ - 0.6) * I.nz), I.Cmz * (1 + 1.4 * I.nz)), 1e-12); near(I.kyz, 0.6 * I.kzz, 1e-12);
});

// ---- item 10: channel torsional / torsional-flexural buckling ----
test('[hand-derived] item 10: PFC 180x75x20 under N = 50 kN: N_cr,T = 858.1 kN, N_cr,TF = 715.2 kN (coupled with the y-y mode), chi_T = 0.541 on curve c, N_b,T,Rd = 385.4 kN; min chi feeds 6.61/6.62; L_T override', () => {
  const lay = SS(4, [{ type: 'udl', x1: 0, x2: 4, w: 5, case: 'Q' }], { family: 'pfc', sectionKey: '180x75x20', axial: 50 });
  c.reset(lay);
  const { a, c: ch } = full();
  assert.ok(!ch.unsupported.length, ch.unsupported.join(' | '));
  const t = ch.buck.tfb; assert.ok(t.ok);
  // i_y = 72.7, i_z = 23.8, y0 = e_sc = 49.6 (P385 Table A.3): i0^2 = 5285.3 + 566.4 + 2460.2 = 8311.9 mm2
  near(t.y0, 49.6, 1e-12); near(t.i0sq, 72.7 * 72.7 + 23.8 * 23.8 + 49.6 * 49.6, 1e-9);
  // N_cr,T = (81000 x 7.6e4 + pi^2 x 210000 x 7.54e9/4000^2)/8311.9 = (6.156e9 + 9.767e8)/8311.9 = 858.1 kN (L_T = L_cr,z = 4 m)
  const NcrT = (81000 * 7.6e4 + Math.PI ** 2 * 210000 * 7.54e9 / 4000 ** 2) / 8311.89 / 1000; near(t.NcrT, NcrT, 1e-4); near(NcrT, 858.1, 2e-4); assert.equal(t.LTSrc, 'L<sub>cr,z</sub>');
  // N_cr,y = pi^2 x 210000 x 1370e4/4000^2 = 1774.7 kN; beta = 1 - 49.6^2/8311.9 = 0.7040
  const NcrY = Math.PI ** 2 * 210000 * 1370e4 / 4000 ** 2 / 1000; near(t.NcrY, NcrY, 1e-9); near(NcrY, 1774.7, 1e-4);
  const beta = 1 - 49.6 * 49.6 / 8311.89; near(t.beta, beta, 1e-6);
  // N_cr,TF = (1774.7 + 858.1)/(2 x 0.704) [1 - sqrt(1 - 4 x 0.704 x 1774.7 x 858.1/2632.8^2)] = 1869.9 x 0.3825 = 715.2 kN
  const NcrTF = (NcrY + NcrT) / (2 * beta) * (1 - Math.sqrt(1 - 4 * beta * NcrY * NcrT / (NcrY + NcrT) ** 2)); near(t.NcrTF, NcrTF, 1e-6); near(NcrTF, 715.2, 2e-4);
  assert.equal(t.mode, 'TF'); near(t.Ncr, NcrTF, 1e-6);
  // lambda_T = sqrt(2590 x 275/715224) = 0.998; curve c (Table 6.2, U-sections): Phi = 1.193, chi = 0.541; N_b,T,Rd = 0.541 x 2590 x 275 = 385.4 kN
  const lamT = Math.sqrt(2590 * 275 / (NcrTF * 1000)); near(t.lamT, lamT, 1e-6); near(lamT, 0.998, 1e-3);
  assert.equal(t.cvT.curve, 'c'); near(t.chiT, chiStrut(lamT, 0.49), 1e-6); near(t.NbT, chiStrut(lamT, 0.49) * 2590 * 275 / 1000, 1e-6); near(t.NbT, 385.4, 2e-4);
  near(t.util, 50 / t.NbT, 1e-12); near(util(ch, /6\.3\.1\.4/), t.util, 1e-12);
  // the lower of chi_T and the flexural chi feeds both axial terms: N_b,y,Rd = 545.0 > N_b,T,Rd -> U_N.y uses 385.4; N_b,z,Rd = 147.7 < 385.4 keeps chi_z
  const B = ch.buck; near(B.NbYeff, Math.min(B.NbY, t.NbT), 1e-12); near(B.NbZeff, Math.min(B.NbZ, t.NbT), 1e-12);
  near(B.ny, 50 / B.NbYeff, 1e-12); near(B.nz, 50 / B.NbZeff, 1e-12); assert.ok(B.NbY > t.NbT && B.NbZ < t.NbT);
  // user L_T = 2 m: N_cr,T = (6.156e9 + 3.907e9)/8311.9 = 1210.7 kN
  c.reset(Object.assign({}, lay, { LT: 2 }));
  const t2 = full().c.buck.tfb; near(t2.NcrT, (81000 * 7.6e4 + Math.PI ** 2 * 210000 * 7.54e9 / 2000 ** 2) / 8311.89 / 1000, 1e-4); assert.equal(t2.LTSrc, 'user L<sub>T</sub>');
  c.reset(Object.assign({}, lay, { LT: -1 })); assert.throws(() => run('analyse()'), /L_T/);
  // both unrestrained routes carry the entry; brief and report rows
  for (const m of ['eigen', 'standard']) { c.reset(Object.assign({}, lay, { restraint: 'ltb', mcrMethod: m })); const u = full().c; assert.ok(util(u, /6\.3\.1\.4/) != null && !u.unsupported.some(s => /6\.3\.1\.4/.test(s)), m); }
  c.reset(lay);
  const h = brief();
  ['i<sub>0</sub>&sup2; = ', 'N<sub>cr\\.T</sub> = ', 'N<sub>cr\\.TF</sub> = ', '&lambda;&#772;<sub>T</sub> = ', 'N<sub>b\\.T\\.Rd</sub> = ', 'N<sub>Ed</sub>/N<sub>b\\.T\\.Rd</sub>'].forEach(l => assert.ok(row(h, new RegExp('^' + l)), 'brief row ' + l));
  assert.ok(/P385 Table A\.3/.test(row(h, /^i<sub>0<\/sub>&sup2;/).vals), 'y0 source printed'); assert.ok(/N_b\.T/.test(h), 'unity cell');
  assert.ok(/Torsional \/ torsional-flexural buckling \(cl 6\.3\.1\.4\)/.test(report()));
});

// ---- item 15: restraint design forces ----
test('[hand-derived] item 15: 2.5 % of N_f,Ed = M_Ed/h at every lateral restraint and support (advisory), in the brief table and the report', () => {
  // two-span 12 m (supports 0, 7, 12), restraint at 3.5 m, UDL 15 Q: h = 460 mm
  c.reset({ restraint: 'ltb', L: 12, supports: [{ pos: 0, type: 'pinned' }, { pos: 7, type: 'pinned' }, { pos: 12, type: 'pinned' }], ltbRestraints: [{ pos: 3.5 }], loads: [{ type: 'udl', x1: 0, x2: 12, w: 15, case: 'Q' }] });
  const { a, c: ch } = full(); const R = ch.restraintForces; assert.ok(R && R.h === 460);
  assert.equal(JSON.stringify(R.rows.map(r => [r.x, r.kind])), JSON.stringify([[0, 'support'], [3500, 'lateral'], [7000, 'support'], [12000, 'support']]));
  R.rows.forEach(r => {
    // M_Ed = largest |M| at the station over the analysed combinations (patterns included); N_f = M/h; F = 0.025 N_f
    const M = Math.max(...run(`analyse().ulsResults.map(res=>Math.abs(interpAt(res.fb.xs,res.fb.M,${r.x}))/1e6)`)); near(r.MEd, M, 1e-4, 'M at ' + r.x);   // engine reads a fraction inside the station
    near(r.NfEd, r.MEd * 1000 / 460, 1e-12); near(r.F, 0.025 * r.NfEd, 1e-12);
  });
  assert.ok(R.rows[0].F < 1e-6 && R.rows[2].F > 0 && R.rows[1].F > 0, 'end support M = 0, interior support and restraint carry a force');
  assert.ok(!ch.utils.some(u => /restraint/i.test(u.name)), 'advisory only: not in the verdict');
  const h = brief(); const i = h.indexOf('<table class="ms-combos ms-restraint">'); assert.ok(i > h.indexOf('Lateral Restraint Portions (span by span, fork ends)'), 'table inside the portions block');
  assert.equal((h.match(/restraint design force, advisory/g) || []).length, 4);
  assert.ok(/Restraint Design Forces \(EN 1993-1-1 5\.3\.3/.test(report()));
  // fully restrained: no discrete restraints, nothing printed
  c.reset({}); assert.equal(full().c.restraintForces, null);
  // simply supported unrestrained demo: two support rows with M_Ed = 0 in a block headed "(restraint design forces)"
  c.reset({ restraint: 'ltb' }); const h2 = brief(); assert.ok(/Lateral Restraint Portions \(restraint design forces\)/.test(h2) && (h2.match(/restraint design force, advisory/g) || []).length === 2);
});

// ---- the campaign-visible blocks removed by G3 are gone, the verdicts stay consistent ----
test('G3: the blocks replaced by checks no longer appear (web Class 4 in uniform compression, 6.2.10, high shear for non-I families / Class 3, PFC 6.3.1.4, M_z + high shear); Class 4 under the combined stress still blocks', () => {
  const src = run('checksEC3Restrained.toString()');
  ['Effective-area compression buckling resistance is not implemented', 'combined cl 6.2.10 reduction is not implemented', 'span-wise cl 6.2.8 interaction for this section family/class is not implemented',
   'torsional and torsional-flexural buckling (cl 6.3.1.4) are not implemented', 'minor-axis/biaxial bending requires a combined resistance check', 'reduced moment resistance for this section family/class is not implemented']
    .forEach(s => assert.ok(!src.includes(s), 'block text still present: ' + s));
  // 1016x305x249 S275 with N = 6000 kN: web Class 4 under the combined stress gradient -> still blocked (effective section with e_N not implemented)
  c.reset(SS(6, [{ type: 'udl', x1: 0, x2: 6, w: 10, case: 'Q' }], { ubKey: '1016 x 305 x 249', axial: 6000 }));
  const b = full().c; assert.equal(b.cl.cls, 4); assert.ok(b.unsupported.some(m => /combined bending \+ compression/.test(m)));
  // demo beam untouched
  c.reset({}); const d = full().c; near(util(d, /^Shear/), 0.303499, 1e-5); near(util(d, /^Bending  M_Ed/), 0.912166, 1e-5); assert.ok(d.pass);
});
