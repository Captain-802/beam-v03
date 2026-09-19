// 19 Sep 2026 gap closure, group G1 (docs/COVERAGE_MATRIX.md items 1.3, 1.2,
// 3.9(b), 3.19): automatic pattern loading, uplift / hold-down, cantilever
// strut length, per-segment deflection limits. Expected values are hand
// computed (standard continuous-beam tables, statics) or are the pre-change
// engine figures recorded from commit 0a2b016 for the "pattern off" parity.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { app } = require('./harness.cjs');
const c = app();
const run = x => c.run(x);
const same = (a, b, what = '') => assert.equal(JSON.stringify(a), JSON.stringify(b), what);   // vm-context arrays are not prototype-identical to the host's
function near(actual, expected, rel = 1e-5, what = '') { assert.ok(Math.abs(actual - expected) <= rel * Math.max(1, Math.abs(expected)), `${what} ${actual} != ${expected}`); }
const Q15 = () => [{id:'c1', label:'ULS: 1.5Q', factors:{G:0,Q:1.5,W:0,E:0}, sls:false, on:true},
                   {id:'s1', label:'SLS: Q', factors:{G:0,Q:1,W:0,E:0}, sls:true, on:true}];
const analyseAll = () => run(`(()=>{ const a=analyse(); const ch=checks(a); return {a:{n:a.ulsResults.length, nS:a.slsResults.length,
  labels:a.ulsResults.map(r=>r.combo.label), M:a.ulsResults.map(r=>r.Mmax/1e6), Mpos:a.ulsResults.map(r=>r.Mpos), xs:a.ulsResults.map(r=>r.fb.xs.length),
  Mmax:a.Mmax, Vmax:a.Vmax, dmax:a.dmax, R:a.reactions.map(r=>r.V), gov:a.governM.combo.label, uplift:a.uplift, patterns:a.patterns, deflection:a.deflection, segs:a.deflSegments,
  torsN:a.tors? a.tors.uls.length : null, torsOMethod:a.torsO? a.torsO.method : null, torsON:a.torsO&&a.torsO.sols? a.torsO.sols.length : null},
  c:{utils:ch.utils.map(u=>u.val), names:ch.utils.map(u=>u.name), unsupported:ch.unsupported, advisory:ch.advisory||[], pass:ch.pass, dlimit:ch.dlimit, divisor:ch.divisor, deflCant:ch.deflCant,
     deflAbsGoverns:ch.deflAbsGoverns, holdDown:ch.holdDown, buck:ch.buck? {Ky:ch.buck.Ky, Kz:ch.buck.Kz, LcrY:ch.buck.LcrY, LcrZ:ch.buck.LcrZ, lamY:ch.buck.lamY, lamZ:ch.buck.lamZ, basis:ch.buck.lcrBasis, cantStrut:ch.buck.cantStrut, leOverride:ch.buck.leOverride, aeffOn:ch.buck.aeffOn, Aeff:ch.buck.Aeff} : null,
     ltb:ch.ltb? {Mcr:ch.ltb.Mcr, MbRd:ch.ltb.MbRd, nCombos:ch.ltb.nCombos, governCombo:ch.ltb.governCombo} : null}}; })()`);

// ---- 1. automatic pattern loading (item 1.3) ----
test('pattern loading: two-span 2 x 4 m UDL Q gives wL2/8 hogging (both spans) and 0.0957wL2 sagging (one span) within 0.5 %', () => {
  c.reset({L:8, supports:[{pos:0,type:'pinned'},{pos:4,type:'pinned'},{pos:8,type:'pinned'}], loads:[{type:'udl',x1:0,x2:8,w:20,case:'Q'}], combos:Q15()});
  const {a} = analyseAll();
  const w = 1.5 * 20, L = 4;
  same(a.labels, ['ULS: 1.5Q', 'ULS: 1.5Q (Q on span 1 only)', 'ULS: 1.5Q (Q on span 2 only)']);   // pair = parent, alternates = singles: de-duplicated
  assert.equal(a.nS, 3, 'SLS combination patterned too');
  near(a.M[0], -w * L * L / 8, 0.005, 'hogging both loaded');
  near(Math.abs(a.M[1]), 0.0957 * w * L * L, 0.005, 'sagging span 1 only');
  near(Math.abs(a.M[2]), 0.0957 * w * L * L, 0.005, 'sagging span 2 only');
  assert.ok(a.Mpos[1] < 4000 && a.Mpos[2] > 4000);
  assert.ok(a.xs.every(n => n === a.xs[0]), 'identical x-grid across combinations');
  assert.equal(a.gov, 'ULS: 1.5Q');
  // one span loaded: far reaction = -wL/16 (uplift), recorded for both the ULS and the SLS pattern
  const far = a.uplift.supports.find(u => u.n === 3);
  near(far.RUls, -w * L / 16, 0.005, 'ULS uplift'); near(far.RSls, -20 * L / 16, 0.005, 'SLS uplift');
  assert.equal(far.comboUls, 'ULS: 1.5Q (Q on span 1 only)');
  assert.ok(a.patterns.active && a.patterns.nUls === 2 && a.patterns.nSls === 2 && /gamma;<sub>G,inf<\/sub> = 1\.0 on relieving spans .* NOT generated/.test(a.patterns.note));
});
test('pattern loading: three-span alternate and adjacent-pair patterns reproduce the continuous-beam tables', () => {
  c.reset({L:15, supports:[{pos:0,type:'pinned'},{pos:5,type:'pinned'},{pos:10,type:'pinned'},{pos:15,type:'pinned'}], loads:[{type:'udl',x1:0,x2:15,w:12,case:'Q'}], combos:Q15()});
  const {a} = analyseAll();
  const w = 18, L = 5;
  same(a.labels, ['ULS: 1.5Q', 'ULS: 1.5Q (Q on span 1 only)', 'ULS: 1.5Q (Q on span 2 only)', 'ULS: 1.5Q (Q on span 3 only)',
    'ULS: 1.5Q (Q on spans 1+2 only)', 'ULS: 1.5Q (Q on spans 2+3 only)', 'ULS: 1.5Q (Q on odd spans only)']);   // even = span 2 only (duplicate, dropped)
  near(a.M[0], -0.100 * w * L * L, 0.005, 'all spans: support moment 0.100wL2');
  near(a.M[6], 0.1013 * w * L * L, 0.005, 'odd spans loaded: 0.1013wL2 sagging');
  near(a.M[4], -0.1167 * w * L * L, 0.005, 'spans 1+2 loaded: 0.1167wL2 hogging at support 2');
  near(a.Mpos[4], 5000, 1e-9);
  near(Math.abs(a.M[2]), 0.075 * w * L * L, 0.005, 'span 2 only: 0.075wL2 sagging');
});
test('pattern loading: cantilever with a back span produces the back-span-unloaded pattern and the tip-load uplift', () => {
  c.reset({L:8, supports:[{pos:0,type:'pinned'},{pos:6,type:'pinned'}], loads:[{type:'udl',x1:0,x2:8,w:10,case:'Q'},{type:'point',pos:8,P:30,case:'Q'}], combos:Q15()});
  const {a, c: ch} = analyseAll();
  same(a.labels, ['ULS: 1.5Q', 'ULS: 1.5Q (Q on span 1 only)', 'ULS: 1.5Q (Q on span 2 only)']);
  assert.ok(/span 2: 6&ndash;8 m \(cantilever\)/.test(a.patterns.segText));
  // overhang only loaded: R1 = -(15 x 2 x 1 + 45 x 2)/6 = -20 kN (statics about support 2)
  const u = a.uplift.supports.find(x => x.n === 1);
  near(u.RUls, -20, 1e-6, 'R1'); assert.equal(u.comboUls, 'ULS: 1.5Q (Q on span 2 only)');
  near(u.RSls, -(10 * 2 * 1 + 30 * 2) / 6, 1e-6, 'SLS R1');
  assert.ok(a.M[2] < 0 && Math.abs(a.M[2] + (15 * 2 * 1 + 45 * 2)) < 1e-6, 'hogging at support 2 from the overhang loads only');
  assert.ok(ch.ltb === null || ch.ltb.nCombos === 3);
});
test('pattern loading: masked pieces of a straddling distributed load are clipped, trapezoids interpolated, point loads assigned by position', () => {
  c.reset({L:10, supports:[{pos:0,type:'pinned'},{pos:4,type:'pinned'},{pos:10,type:'pinned'}],
    loads:[{type:'trap',x1:2,x2:8,w1:0,w2:12,case:'Q'},{type:'point',pos:4,P:5,case:'Q'},{type:'point',pos:7,P:5,case:'Q'},{type:'udl',x1:0,x2:10,w:3,case:'G'}],
    combos:[{id:'c1',label:'ULS: 1.35G + 1.5Q',factors:{G:1.35,Q:1.5,W:0,E:0},sls:false,on:true},{id:'s1',label:'SLS: Q',factors:{G:0,Q:1,W:0,E:0},sls:true,on:true}]});
  const p = run(`(()=>{ const a=analyse(); const m=a.ulsResults.map(r=>({label:r.combo.label,pieces:comboLoadPieces(r.combo).map(p=>({t:p.type,i:p.i,f:p.factor,x1:p.x1,x2:p.x2,w1:p.w1,w2:p.w2,pos:p.pos,masked:p.masked}))})); return m; })()`);
  const s1 = p.find(x => /span 1 only/.test(x.label)).pieces, s2 = p.find(x => /span 2 only/.test(x.label)).pieces, full = p[0].pieces;
  // trapezoid 2-8 m split at the support x = 4 m: w(4) = 12 x (4-2)/6 = 4 kN/m
  const t1 = full.filter(q => q.t === 'trap');
  assert.equal(t1.length, 2); near(t1[0].x2, 4000, 1e-9); near(t1[0].w2, 4, 1e-9); near(t1[1].w1, 4, 1e-9); near(t1[1].x1, 4000, 1e-9);
  assert.ok(t1.every(q => q.f === 1.5 && !q.masked), 'parent combination keeps every piece');
  same(s1.filter(q => q.t === 'trap').map(q => q.f), [1.5, 0]); same(s2.filter(q => q.t === 'trap').map(q => q.f), [0, 1.5]);
  // point load exactly at the interior support belongs to the first segment containing it; the 7 m load to span 2
  same(s1.filter(q => q.t === 'point').map(q => q.f), [1.5, 0]); same(s2.filter(q => q.t === 'point').map(q => q.f), [0, 1.5]);
  // G load is not split and never masked
  assert.equal(full.filter(q => q.t === 'udl').length, 1); assert.ok(s1.concat(s2).filter(q => q.t === 'udl').every(q => q.f === 1.35 && !q.masked && q.x1 === 0 && q.x2 === 10000));
});
test('pattern loading off reproduces the previous engine figures exactly (two-span, overhang with LTB, three-span standard route)', () => {
  // reference values from commit 0a2b016 (before pattern loading existed); divisorCant = 360 restores the old single divisor
  const ref = {
    twoSpan:      {over:{L:8,supports:[{pos:0,type:'pinned'},{pos:4,type:'pinned'},{pos:8,type:'pinned'}],loads:[{type:'udl',x1:0,x2:8,w:20,case:'Q'},{type:'udl',x1:0,x2:8,w:6,case:'G'}]},
                   Mmax:-78.3718800180531, Vmax:97.9648500004858, dmax:-0.35587649153549783, utils:[0.12953865816464513,0.1557315052519684,0.032028884238194805], R:[58778.90999548673,195929.70000499906,58778.91000776529]},
    overhangLtb:  {over:{L:8,restraint:'ltb',supports:[{pos:0,type:'pinned'},{pos:6,type:'pinned'}],loads:[{type:'udl',x1:0,x2:8,w:15,case:'Q'},{type:'point',pos:8,P:20,case:'Q'}]},
                   Mmax:-107.17188008608848, Vmax:-88.61979765575408, dmax:-1.2847092739990043, utils:[0.11718172053641507,0.212959523270916,0.2259872551046497,0.21563342335626468], R:[52895.83998565192,165791.6800113414], Mcr:833.5938959425747, MbRd:474.2386026878354},
    threeSpanStd: {over:{L:12,restraint:'ltb',mcrMethod:'standard',supports:[{pos:0,type:'pinned'},{pos:4,type:'pinned'},{pos:8,type:'pinned'},{pos:12,type:'pinned'}],loads:[{type:'trap',x1:0,x2:12,w1:5,w2:15,case:'Q'}],eccOn:true,za:0},
                   // LTB util / MbRd re-baselined 19 Sep 2026 (G3 item 8): the Serna C1 = 4.09 of this diagram now floors k_c at 1/sqrt(2.76) = 0.602 (Table 6.6), f = 0.810, chi_mod = 0.828, MbRd = 416.68 (was 0.07283 / 444.92 with the unbounded k_c = 0.494); Mcr, forces and reactions unchanged
                   Mmax:-32.404166948376066, Vmax:48.606254141162886, dmax:-0.31315338210286303, utils:[0.06427191936520846,0.0643898001954815,0.07776827074164548,0.028183804389257675], R:[15737.504000043244,55778.13600018919,85778.13599952446,35737.50399959248], Mcr:558.9358761558486, MbRd:416.6759353056232},
  };
  for (const [k, r] of Object.entries(ref)) {
    c.reset(Object.assign({}, r.over, {autoPattern:false, divisorCant:360}));
    const {a, c: ch} = analyseAll();
    assert.equal(a.n, 1, k + ': no generated combination'); assert.equal(a.patterns.active, false);
    near(a.Mmax, r.Mmax, 1e-12, k + ' Mmax'); near(a.Vmax, r.Vmax, 1e-12, k + ' Vmax'); near(a.dmax, r.dmax, 1e-12, k + ' dmax');
    r.R.forEach((v, i) => near(a.R[i], v, 1e-12, k + ' R' + i));
    r.utils.forEach((v, i) => near(ch.utils[i], v, 1e-12, k + ' util ' + i));
    if (r.Mcr != null) { near(ch.ltb.Mcr, r.Mcr, 1e-12, k + ' Mcr'); near(ch.ltb.MbRd, r.MbRd, 1e-12, k + ' MbRd'); }
    assert.ok(ch.advisory.some(m => /pattern loading is OFF/.test(m)), k + ': OFF limitation printed');
    // the same case with the pattern switch on carries the generated combinations and never a lower envelope
    c.reset(Object.assign({}, r.over, {divisorCant:360}));
    const on = analyseAll();
    assert.ok(on.a.n > 1 && on.a.patterns.active);
    assert.ok(Math.abs(on.a.Mmax) >= Math.abs(r.Mmax) - 1e-9 && Math.abs(on.a.Vmax) >= Math.abs(r.Vmax) - 1e-9, k + ': envelope with patterns is never smaller');
    r.utils.forEach((v, i) => assert.ok(on.c.utils[i] >= v - 1e-9, k + ': utilisation ' + i + ' never lower with patterns on'));   // the pre-G2 utilisations (web transverse-force entries follow them)
  }
  // single-span member: no segment boundary, nothing generated, nothing split (demo figures of AUDIT.md unchanged)
  c.reset({});
  const d = analyseAll(); assert.equal(d.a.n, 1); assert.equal(d.a.patterns.active, false); assert.equal(d.a.patterns.note, null);
  near(d.c.utils[0], 0.303499, 1e-5); near(d.c.utils[1], 0.912166, 1e-5); near(d.c.utils[2], 0.609935, 1e-5);
});
test('pattern loading: every downstream consumer sees the generated combinations (eigen LTB per combination, torsion FE, envelopes, standard-route load list)', () => {
  // two-span with an eccentric Q load: the St Venant torsion FE and the eigen LTB run once per generated combination
  c.reset({L:8, restraint:'ltb', eccOn:true, supports:[{pos:0,type:'pinned'},{pos:4,type:'pinned'},{pos:8,type:'pinned'}],
    loads:[{type:'udl',x1:0,x2:8,w:20,case:'Q',e:20,zg:0},{type:'udl',x1:0,x2:8,w:6,case:'G',e:0,zg:0}]});
  const {a, c: ch} = analyseAll();
  assert.equal(a.n, 3); assert.equal(a.torsN, 3); assert.equal(ch.ltb.nCombos, 3);
  // G4 (19 Sep 2026): the two-span member is no longer blocked - the warping-torsion FE runs once per generated combination
  assert.ok(!ch.unsupported.some(m => /partial-span eccentric distributed load|multi-span layouts|multi-span \/ overhang/.test(m)), 'two-span member evaluated by the warping-torsion FE (G4)');
  assert.equal(a.torsOMethod, 'fe'); assert.equal(a.torsON, 3);
  // standard route: the closed-form load height / shape of a pattern combination reads that pattern's loads only
  c.reset({L:8, restraint:'ltb', mcrMethod:'standard', eccOn:true, za:0, supports:[{pos:0,type:'pinned'},{pos:4,type:'pinned'},{pos:8,type:'pinned'}],
    loads:[{type:'udl',x1:0,x2:4,w:20,case:'Q',e:0,zg:200},{type:'udl',x1:4,x2:8,w:20,case:'Q',e:0,zg:-200}], combos:Q15()});
  const z = run(`(()=>{ const a=analyse(); return a.ulsResults.map(r=>({l:r.combo.label, zg:stdZgFor(r.combo).zg, shape:stdLoadShape(r.combo)})); })()`);
  assert.equal(z[0].zg, 200); assert.equal(z.find(x => /span 2 only/.test(x.l)).zg, -200, 'span-2 pattern sees only the bottom-flange load');
  assert.equal(z.find(x => /span 1 only/.test(x.l)).zg, 200);
  assert.equal(z.find(x => /span 2 only/.test(x.l)).shape.nOther, 1);
});

// ---- 2. uplift / hold-down (item 1.2) ----
test('hold-down: a lifting support blocks PASS with the design force and combination; "hold-down provided" turns it into an advisory; BS 5950 path included', () => {
  const lay = {L:8, supports:[{pos:0,type:'pinned'},{pos:6,type:'pinned'}], loads:[{type:'udl',x1:0,x2:8,w:10,case:'Q'},{type:'point',pos:8,P:30,case:'Q'}], combos:Q15()};
  c.reset(lay);
  const b = analyseAll();
  assert.equal(b.c.pass, false);
  const msg = b.c.unsupported.find(m => /^Hold-down required/.test(m));
  assert.ok(msg && /R = &minus;20\.00 kN at support 1 \(x = 0 m\) \(combination ULS: 1\.5Q \(Q on span 2 only\)\)/.test(msg), msg);
  assert.ok(/SLS uplift &minus;13\.33 kN/.test(msg));
  assert.equal(b.c.holdDown.rows.length, 1); assert.equal(b.c.holdDown.unsupported.length, 1); assert.equal(b.c.holdDown.advisory.length, 0);
  c.reset(Object.assign({}, lay, {supports:[{pos:0,type:'pinned',holdDown:true},{pos:6,type:'pinned'}]}));
  const p = analyseAll();
  assert.equal(p.c.pass, true);
  assert.ok(!p.c.unsupported.some(m => /Hold-down/.test(m)));
  assert.ok(p.c.advisory.some(m => /^Hold-down provided at support 1 .*R = &minus;20\.00 kN/.test(m)));
  // an SLS-only uplift (the Q-only deflection case has no G, so it is not an equilibrium state) is reported
  // as an advisory naming the combination and the force, never as a block
  c.reset({L:8, supports:[{pos:0,type:'pinned'},{pos:6,type:'pinned'}], loads:[{type:'udl',x1:0,x2:8,w:10,case:'G'},{type:'point',pos:8,P:30,case:'Q'}],
    combos:[{id:'c1',label:'ULS: 1.35G + 1.5Q',factors:{G:1.35,Q:1.5,W:0,E:0},sls:false,on:true},{id:'s1',label:'SLS: Q',factors:{G:0,Q:1,W:0,E:0},sls:true,on:true}]});
  const s = analyseAll();
  const u = s.a.uplift.supports.find(x => x.n === 1);
  assert.ok(u && u.RUls === null && u.RSls < 0, 'G on the back span suppresses the ULS uplift; the Q-only SLS case lifts');
  near(u.RSls, -30 * 2 / 6, 1e-6, 'SLS-only R1');
  assert.ok(!s.c.unsupported.some(m => /Hold-down/.test(m)), 'SLS-only uplift does not block');
  assert.ok(s.c.advisory.some(m => /^Hold-down check \(SLS only\) at support 1 .*R = &minus;10\.00 kN; no ULS combination lifts it/.test(m)));
  assert.equal(s.c.holdDown.rows[0].level, 'sls'); assert.equal(s.c.holdDown.rows[0].blocking, false);
  assert.ok(s.c.pass || !s.c.unsupported.length);
  // no uplift anywhere: nothing reported
  c.reset({}); const d = analyseAll(); assert.equal(d.a.uplift.any, false); assert.equal(d.c.holdDown.rows.length, 0);
  // BS 5950 dispatcher carries the same blocking message
  c.reset(Object.assign({}, lay, {code:'BS5950'}));
  const bs = analyseAll(); assert.equal(bs.c.pass, false); assert.ok(bs.c.unsupported.some(m => /^Hold-down required: R = &minus;20\.00 kN at support 1/.test(m)));
});

// ---- 3. cantilever strut length (item 3.9 b) ----
test('cantilever strut: L_cr defaults to 2.0 L about both axes with N_Ed > 0 (lambda-bar doubles), a user L_E factor is kept', () => {
  const lay = {L:4, supports:[{pos:0,type:'fixed'}], axial:300, loads:[{type:'point',pos:4,P:10,case:'Q'}]};
  c.reset(Object.assign({}, lay, {leFactor:1.0}));
  const d = analyseAll().c.buck;
  assert.equal(d.Ky, 2); near(d.LcrY, 8000, 1e-12); near(d.LcrZ, 8000, 1e-12); assert.ok(d.cantStrut && !d.leOverride);
  assert.match(d.basis, /2\.0 L about both axes by default/);
  const sec = run('activeSection()'), fy = run('checks(analyse()).fy'), lam1 = Math.PI * Math.sqrt(210000 / fy);
  // 19 Sep 2026 (G3 item 6): the 457x191x82 web is Class 4 in uniform compression (d/t = 41.2 > 42 eps = 38.8), so lambda-bar
  // carries sqrt(A_eff/A) (6.3.1.3(1)); lambda_p = 41.2/(28.4 x 0.9244 x 2) = 0.7847, rho = (0.7847 - 0.22)/0.7847^2 = 0.9171,
  // A_eff = 10400 - (1 - 0.9171) x 407.6 x 9.9 = 10065.6 mm2, sqrt(A_eff/A) = 0.9838 [hand-derived]
  assert.ok(d.aeffOn && Math.abs(d.Aeff - 10065.6) < 1, 'A_eff ' + d.Aeff);
  const af = Math.sqrt(d.Aeff / (sec.A * 100));
  near(d.lamY, 8000 / (sec.rx * 10) / lam1 * af, 1e-9); near(d.lamZ, 8000 / (sec.ry * 10) / lam1 * af, 1e-9);   // = 2 x the previous L_cr = L value
  c.reset(Object.assign({}, lay, {leFactor:1.5}));
  const o = analyseAll().c.buck;
  assert.equal(o.Ky, 1.5); near(o.LcrY, 6000, 1e-12); assert.ok(o.leOverride); assert.match(o.basis, /user L<sub>E<\/sub>\/L factor 1\.5 kept/);
  near(o.lamY, d.lamY * 0.75, 1e-9);
  // a simply supported strut is untouched (K = L_E factor as entered)
  c.reset({axial:300, leFactor:1.0}); const ss = analyseAll().c.buck; assert.equal(ss.Ky, 1); assert.ok(!ss.cantStrut); near(ss.LcrY, 8000, 1e-12);
  // unrestrained cantilever (eigen and standard) takes the same default
  for (const m of ['eigen', 'standard']) { c.reset(Object.assign({}, lay, {restraint:'ltb', mcrMethod:m})); const u = analyseAll().c.buck; assert.equal(u.Ky, 2, m); near(u.LcrZ, 8000, 1e-12, m); }
});

// ---- 4. per-segment deflection limits (item 3.19) ----
test('deflection limits: cantilever segments use L/divisorCant (default 180), the absolute limit caps every segment, limits are per segment', () => {
  c.reset({L:4, supports:[{pos:0,type:'fixed'}], loads:[{type:'point',pos:4,P:10,case:'Q'}]});
  let r = analyseAll();
  near(r.c.dlimit, 4000 / 180, 1e-12); assert.equal(r.c.divisor, 180); assert.equal(r.c.deflCant, true); assert.equal(r.a.deflection.cant, true);
  near(r.a.deflection.dpos, 4000, 1e-9, 'tip');
  const sec = run('activeSection()'); near(Math.abs(r.a.dmax), 10 * 1000 * 4000 ** 3 / (3 * 210000 * sec.Ix * 1e4), 1e-6, 'tip deflection relative to the root');
  c.reset({L:4, supports:[{pos:0,type:'fixed'}], divisorCant:250, deflAbs:5, loads:[{type:'point',pos:4,P:10,case:'Q'}]});
  r = analyseAll();
  assert.equal(r.c.divisor, 250); near(r.a.deflection.limSpan, 16, 1e-12); near(r.c.dlimit, 5, 1e-12); assert.equal(r.c.deflAbsGoverns, true);
  near(r.c.utils.find((v, i) => r.c.names[i] === 'Deflection'), Math.abs(r.a.dmax) / 5, 1e-12);
  // overhang beam: span segment vs cantilever segment, each with its own divisor and the worst SLS pattern
  c.reset({L:8, supports:[{pos:0,type:'pinned'},{pos:6,type:'pinned'}], loads:[{type:'udl',x1:0,x2:8,w:10,case:'Q'},{type:'point',pos:8,P:30,case:'Q'}], combos:Q15()});
  r = analyseAll();
  assert.equal(r.a.segs.length, 2);
  same(r.a.segs.map(s => [s.no, s.cant, s.divisor]), [[1, false, 360], [2, true, 180]]);
  near(r.a.segs[0].limit, 6000 / 360, 1e-12); near(r.a.segs[1].limit, 2000 / 180, 1e-12);
  assert.equal(r.a.segs[1].combo, 'SLS: Q (Q on span 2 only)'); assert.equal(r.a.deflection.no, 2);
  // absolute limit smaller than both: governs both segments
  c.reset({L:8, supports:[{pos:0,type:'pinned'},{pos:6,type:'pinned'}], deflAbs:3, loads:[{type:'udl',x1:0,x2:8,w:10,case:'Q'},{type:'point',pos:8,P:30,case:'Q'}], combos:Q15()});
  r = analyseAll(); assert.ok(r.a.segs.every(s => s.absGoverns && s.limit === 3));
  // validation
  c.reset({divisorCant:0}); assert.throws(() => run('analyse()'), /Cantilever deflection divisor/);
  c.reset({deflAbs:-2}); assert.throws(() => run('analyse()'), /Absolute deflection limit/);
  // blank absolute limit = none
  c.reset({deflAbs:''}); r = analyseAll(); assert.equal(r.a.deflection.abs, null);
});

// ---- brief and report placement ----
test('brief: pattern combinations in the loading list, hold-down row in Member Forces, per-segment deflection rows, cantilever strut tag', () => {
  const ROW = /<div class="ms-row[^"]*"><div class="ms-l">(.*?)<\/div><div class="ms-v[^"]*">(.*?)<\/div><div class="ms-r">(.*?)<\/div><div class="ms-t">(.*?)<\/div><\/div>/g;
  const rows = html => [...html.matchAll(ROW)].map(m => ({label:m[1], vals:m[2], res:m[3], tag:m[4]}));
  const brief = () => run(`(()=>{ const a=analyse(); const ch=checks(a); return {html:renderMasterSeriesBrief(a,ch,a.sec), unsupported:ch.unsupported, pass:ch.pass}; })()`);
  c.reset({L:8, supports:[{pos:0,type:'pinned'},{pos:6,type:'pinned'}], loads:[{type:'udl',x1:0,x2:8,w:10,case:'Q'},{type:'point',pos:8,P:30,case:'Q'}], combos:Q15()});
  let r = brief(), h = r.html;
  assert.ok(!/undefined|NaN/.test(h));
  const iLoad = h.indexOf('Member Loading and Member Forces'), iCls = h.indexOf('Classification and Effective Area'), iHd = h.indexOf('ms-nv-msg">Hold-down required');
  assert.ok(iLoad < iHd && iHd < iCls, 'hold-down NOT VERIFIED row sits in the Member Forces block');
  assert.equal([...h.matchAll(/<div class="ms-row ms-nv">/g)].length, r.unsupported.length, 'one NOT VERIFIED row per blocking message');
  assert.ok(/<b>Pattern loading<\/b> \(span 1: 0&ndash;6 m; span 2: 6&ndash;8 m \(cantilever\)\): 2 ULS \+ 2 SLS combinations generated/.test(h), 'pattern line in the load list');
  assert.ok(h.indexOf('ULS 3: ULS: 1.5Q (Q on span 2 only)') > iLoad && h.indexOf('ULS 3: ULS: 1.5Q (Q on span 2 only)') < iCls);
  assert.ok(/NOT generated/.test(h.slice(iLoad, iCls)), 'gamma_G,inf limitation printed with the loads');
  assert.ok(rows(h).find(x => /^Auto Design Load Cases$/.test(x.label)).vals === '1-3; SLS 1-3 (incl. 2 + 2 automatic patterns)');
  assert.ok(h.includes('in Load Case 1 (ULS: 1.5Q)') && h.includes('Maximum Deflection from Load Case 3 (SLS: Q (Q on span 2 only))'), 'case numbers index the expanded lists');
  const defl = rows(h).filter(x => /^(Span|Cantilever) \d/.test(x.label));
  assert.equal(defl.length, 2); assert.match(defl[0].label, /^Span 1 \(0&ndash;6 m\): &delta; &le; Span\/360$/); assert.match(defl[1].label, /^Cantilever 2 \(6&ndash;8 m\): tip &delta; &le; L\/180$/);
  assert.ok(/SLS: Q \(Q on span 2 only\)/.test(defl[1].vals));
  const gov = rows(h).find(x => /^Tip &delta; &le; L\/180$/.test(x.label)); assert.ok(gov && /segment 6&ndash;8 m, cantilever/.test(gov.vals) && /Table NA\.2 \[verify\]/.test(gov.vals));
  // hold-down provided: advisory row with the force in the Member Forces block, no NOT VERIFIED row
  c.reset({L:8, supports:[{pos:0,type:'pinned',holdDown:true},{pos:6,type:'pinned'}], loads:[{type:'udl',x1:0,x2:8,w:10,case:'Q'},{type:'point',pos:8,P:30,case:'Q'}], combos:Q15()});
  r = brief(); h = r.html;
  const hd = rows(h).find(x => /^Hold-down provided at support 1/.test(x.label));
  assert.ok(hd && hd.res === 'R = &minus;20.00 kN' && hd.tag === 'hold-down' && /combination ULS: 1\.5Q \(Q on span 2 only\)/.test(hd.vals));
  assert.ok(!/ms-nv-msg">Hold-down/.test(h) && r.pass);
  // no uplift: the OK line
  c.reset({}); h = brief().html; assert.ok(rows(h).find(x => x.label === 'Uplift' && x.tag === 'OK'));
  // absolute limit in the deflection label
  c.reset({deflAbs:10}); h = brief().html; assert.ok(rows(h).find(x => /^In-span &delta; &le; Span\/360 \(&le; 10\.00 mm\)$/.test(x.label)));
  // cantilever strut: K = 2 on the L_ey / L_ez lines
  c.reset({L:4, supports:[{pos:0,type:'fixed'}], axial:300, loads:[{type:'point',pos:4,P:10,case:'Q'}]});
  h = brief().html;
  const ley = rows(h).find(x => /^L<sub>ey<\/sub>/.test(x.label)), lez = rows(h).find(x => /^L<sub>ez<\/sub>/.test(x.label));
  assert.ok(ley && /^2 x 4 =/.test(ley.vals) && ley.res === '8 m' && ley.tag === 'cantilever 2.0L', JSON.stringify(ley));
  assert.ok(lez && lez.res === '8 m' && lez.tag === 'cantilever 2.0L');
});
