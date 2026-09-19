// 19 Sep 2026 gap closure, group G1 (docs/COVERAGE_MATRIX.md items 1.2,
// 3.9(b), 3.19): uplift / hold-down, strut lengths from the end fixities
// (cantilever 2.0 L), the vertically-free-end deflection limit. Automatic
// pattern loading (item 1.3) left with the multi-span scope on 19 Sep 2026
// (single-span model: js/03-state-ui.js ends). Expected values are hand
// computed (statics, the code expressions).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { app } = require('./harness.cjs');
const c = app();
const run = x => c.run(x);
const E = (p, o) => c.ends(p, o);   // ends preset of the single-span model
const same = (a, b, what = '') => assert.equal(JSON.stringify(a), JSON.stringify(b), what);   // vm-context arrays are not prototype-identical to the host's
function near(actual, expected, rel = 1e-5, what = '') { assert.ok(Math.abs(actual - expected) <= rel * Math.max(1, Math.abs(expected)), `${what} ${actual} != ${expected}`); }
const Q15 = () => [{id:'c1', label:'ULS: 1.5Q', factors:{G:0,Q:1.5,W:0,E:0}, sls:false, on:true},
                   {id:'s1', label:'SLS: Q', factors:{G:0,Q:1,W:0,E:0}, sls:true, on:true}];
const analyseAll = () => run(`(()=>{ const a=analyse(); const ch=checks(a); return {a:{n:a.ulsResults.length, nS:a.slsResults.length,
  labels:a.ulsResults.map(r=>r.combo.label), M:a.ulsResults.map(r=>r.Mmax/1e6), Mpos:a.ulsResults.map(r=>r.Mpos), xs:a.ulsResults.map(r=>r.fb.xs.length),
  Mmax:a.Mmax, Vmax:a.Vmax, dmax:a.dmax, R:a.reactions.map(r=>r.V), gov:a.governM.combo.label, uplift:a.uplift, deflection:a.deflection, segs:a.deflSegments, companionNote:a.companionNote,
  torsN:a.tors? a.tors.uls.length : null, torsOMethod:a.torsO? a.torsO.method : null, torsON:a.torsO&&a.torsO.sols? a.torsO.sols.length : null},
  c:{utils:ch.utils.map(u=>u.val), names:ch.utils.map(u=>u.name), unsupported:ch.unsupported, advisory:ch.advisory||[], pass:ch.pass, dlimit:ch.dlimit, divisor:ch.divisor, deflCant:ch.deflCant,
     deflAbsGoverns:ch.deflAbsGoverns, holdDown:ch.holdDown, buck:ch.buck? {Ky:ch.buck.Ky, Kz:ch.buck.Kz, LcrY:ch.buck.LcrY, LcrZ:ch.buck.LcrZ, lamY:ch.buck.lamY, lamZ:ch.buck.lamZ, basis:ch.buck.lcrBasis, cantStrut:ch.buck.cantStrut, leOverride:ch.buck.leOverride, aeffOn:ch.buck.aeffOn, Aeff:ch.buck.Aeff} : null,
     ltb:ch.ltb? {Mcr:ch.ltb.Mcr, MbRd:ch.ltb.MbRd, nCombos:ch.ltb.nCombos, governCombo:ch.ltb.governCombo} : null}}; })()`);

// ---- 1. single-span model: the demo figures of AUDIT.md and no generated combinations ----
test('single-span model: the demo reproduces the audit figures, no combination is generated beyond the gamma_G,inf companions', () => {
  c.reset({});
  const d = analyseAll(); assert.equal(d.a.n, 1); assert.equal(d.a.nS, 1);
  near(d.c.utils[0], 0.303499, 1e-5); near(d.c.utils[1], 0.912166, 1e-5); near(d.c.utils[2], 0.609935, 1e-5);
  assert.ok(/companions: 2 ULS combination\(s\)/.test(d.a.companionNote) && d.c.advisory.some(m => /gamma;<sub>G,inf<\/sub> companions: 2/.test(m)));
  // the state carries no support list, pattern switch or root-warping select any more
  assert.equal(run('S.supports'), undefined); assert.equal(run('S.autoPattern'), undefined); assert.equal(run('S.rootWarp'), undefined); assert.equal(run('S.fixedLateral'), undefined);
  assert.equal(run('typeof expandPatternCombos'), 'undefined'); assert.equal(run('typeof spanSegments'), 'undefined');
});

// ---- 2. uplift / hold-down (item 1.2) ----
test('hold-down: a lifting end blocks PASS with the design force and combination; "hold-down provided" turns it into an advisory; BS 5950 path included', () => {
  // simply supported 6 m span, clockwise couple 90 kN.m (Q) at End 2: R_1 = -M/L = -15 kN (SLS), -22.5 kN at 1.5Q [hand-derived statics]
  const lay = {L:6, ends:E('ss'), loads:[{type:'moment',pos:6,M:-90,case:'Q'}], combos:Q15()};
  c.reset(lay);
  const b = analyseAll();
  assert.equal(b.c.pass, false);
  const msg = b.c.unsupported.find(m => /^Hold-down required/.test(m));
  assert.ok(msg && /R = &minus;22\.50 kN at End 1 \(x = 0 m\) \(combination ULS: 1\.5Q\)/.test(msg), msg);
  assert.ok(/SLS uplift &minus;15\.00 kN/.test(msg));
  assert.equal(b.c.holdDown.rows.length, 1); assert.equal(b.c.holdDown.unsupported.length, 1); assert.equal(b.c.holdDown.advisory.length, 0);
  c.reset(Object.assign({}, lay, {ends:E('ss',{e1:{holdDown:true}})}));
  const p = analyseAll();
  assert.equal(p.c.pass, true);
  assert.ok(!p.c.unsupported.some(m => /Hold-down/.test(m)));
  assert.ok(p.c.advisory.some(m => /^Hold-down provided at End 1 .*R = &minus;22\.50 kN/.test(m)));
  // an SLS-only uplift (the Q-only deflection case has no G, so it is not an equilibrium state) is reported
  // as an advisory naming the combination and the force, never as a block: G 10 kN/m holds End 1 down at
  // 1.35G, 1.0G and 0.9G (R_1,G = 3 x 10.8044 = 32.4 kN > 22.5)
  c.reset({L:6, ends:E('ss'), loads:[{type:'udl',x1:0,x2:6,w:10,case:'G'},{type:'moment',pos:6,M:-90,case:'Q'}],
    combos:[{id:'c1',label:'ULS: 1.35G + 1.5Q',factors:{G:1.35,Q:1.5,W:0,E:0},sls:false,on:true},{id:'s1',label:'SLS: Q',factors:{G:0,Q:1,W:0,E:0},sls:true,on:true}]});
  const s = analyseAll();
  const u = s.a.uplift.supports.find(x => x.n === 1);
  assert.ok(u && u.RUls === null && u.RSls < 0, 'G holds the end down in every ULS case incl. the companions; the Q-only SLS case lifts');
  near(u.RSls, -15, 1e-6, 'SLS-only R1');
  assert.ok(!s.c.unsupported.some(m => /Hold-down/.test(m)), 'SLS-only uplift does not block');
  assert.ok(s.c.advisory.some(m => /^Hold-down check \(SLS only\) at End 1 .*R = &minus;15\.00 kN; no ULS combination lifts it/.test(m)));
  assert.equal(s.c.holdDown.rows[0].level, 'sls'); assert.equal(s.c.holdDown.rows[0].blocking, false);
  assert.ok(s.c.pass || !s.c.unsupported.length);
  // no uplift anywhere: nothing reported
  c.reset({}); const d = analyseAll(); assert.equal(d.a.uplift.any, false); assert.equal(d.c.holdDown.rows.length, 0);
  // a guided end has no vertical reaction and never appears in the uplift record
  c.reset({L:6, ends:E('guided-fixed'), loads:[{type:'moment',pos:6,M:-90,case:'Q'}], combos:Q15()});
  const g = analyseAll(); assert.equal(g.a.uplift.supports.length, 0);
  // BS 5950 dispatcher carries the same blocking message
  c.reset(Object.assign({}, lay, {code:'BS5950'}));
  const bs = analyseAll(); assert.equal(bs.c.pass, false); assert.ok(bs.c.unsupported.some(m => /^Hold-down required: R = &minus;22\.50 kN at End 1/.test(m)));
});

// ---- 3. strut lengths from the end fixities (item 3.9 b) ----
test('cantilever strut: L_cr defaults to 2.0 L about both axes from the end fixities (lambda-bar doubles); the L_E factor overrides both axes; the other presets take their Table 22 factors', () => {
  const lay = {L:4, ends:E('cantilever'), axial:300, loads:[{type:'point',pos:4,P:10,case:'Q'}]};
  c.reset(lay);
  const d = analyseAll().c.buck;
  assert.equal(d.Ky, 2); assert.equal(d.Kz, 2); near(d.LcrY, 8000, 1e-12); near(d.LcrZ, 8000, 1e-12); assert.ok(d.cantStrut && !d.leOverride);
  assert.match(d.basis, /from the end fixities/); assert.match(d.basis, /held in position and direction at one end, the other end free: 2\.0 L/); assert.match(d.basis, /\[verify\]/);
  const sec = run('activeSection()'), fy = run('checks(analyse()).fy'), lam1 = Math.PI * Math.sqrt(210000 / fy);
  // 19 Sep 2026 (G3 item 6): the 457x191x82 web is Class 4 in uniform compression (d/t = 41.2 > 42 eps = 38.8), so lambda-bar
  // carries sqrt(A_eff/A) (6.3.1.3(1)); lambda_p = 41.2/(28.4 x 0.9244 x 2) = 0.7847, rho = (0.7847 - 0.22)/0.7847^2 = 0.9171,
  // A_eff = 10400 - (1 - 0.9171) x 407.6 x 9.9 = 10065.6 mm2, sqrt(A_eff/A) = 0.9838 [hand-derived]
  assert.ok(d.aeffOn && Math.abs(d.Aeff - 10065.6) < 1, 'A_eff ' + d.Aeff);
  const af = Math.sqrt(d.Aeff / (sec.A * 100));
  near(d.lamY, 8000 / (sec.rx * 10) / lam1 * af, 1e-9); near(d.lamZ, 8000 / (sec.ry * 10) / lam1 * af, 1e-9);   // = 2 x the L_cr = L value
  c.reset(Object.assign({}, lay, {leFactor:1.5}));
  const o = analyseAll().c.buck;
  assert.equal(o.Ky, 1.5); assert.equal(o.Kz, 1.5); near(o.LcrY, 6000, 1e-12); assert.ok(o.leOverride); assert.match(o.basis, /user L<sub>E<\/sub>\/L factor 1\.50 on both axes \(the end fixities would give y-y 2\.00, z-z 2\.00\)/);
  near(o.lamY, d.lamY * 0.75, 1e-9);
  // an entered factor of 1.0 is an override too (no cantilever heuristic on the value 1.0)
  c.reset(Object.assign({}, lay, {leFactor:1.0}));
  const o1 = analyseAll().c.buck; assert.equal(o1.Ky, 1); assert.ok(o1.leOverride); near(o1.LcrY, 4000, 1e-12);
  // simply supported strut: K = 1.0 from the fixities; fixed - fixed 0.7; propped 0.85; fixed - guided y-y 1.2 (sway), z-z 0.7
  c.reset({axial:300}); const ss = analyseAll().c.buck; assert.equal(ss.Ky, 1); assert.equal(ss.Kz, 1); assert.ok(!ss.cantStrut && !ss.leOverride); near(ss.LcrY, 8000, 1e-12);
  c.reset({axial:300, ends:E('fixed-fixed')}); const ff = analyseAll().c.buck; assert.equal(ff.Ky, 0.7); assert.equal(ff.Kz, 0.7); near(ff.LcrY, 5600, 1e-12);
  c.reset({axial:300, ends:E('fixed-pinned')}); const fp = analyseAll().c.buck; assert.equal(fp.Ky, 0.85); assert.equal(fp.Kz, 0.85);
  c.reset({axial:300, ends:E('guided-fixed')}); const fg = analyseAll().c.buck; assert.equal(fg.Ky, 1.2); assert.equal(fg.Kz, 0.7); assert.match(fg.basis, /sway permitted, guided\): 1\.2 L/);
  // unrestrained cantilever (eigen and standard) takes the same default
  for (const m of ['eigen', 'standard']) { c.reset(Object.assign({}, lay, {restraint:'ltb', mcrMethod:m})); const u = analyseAll().c.buck; assert.equal(u.Ky, 2, m); near(u.LcrZ, 8000, 1e-12, m); }
  // intermediate lateral restraints still shorten L_cr,z (never below the restraint spacing), the end fixity sets the cap
  c.reset({axial:300, restraint:'ltb', ltbRestraints:[{pos:4}]}); const lr = analyseAll().c.buck; near(lr.LcrZ, 4000, 1e-9); near(lr.LcrY, 8000, 1e-9);
});

// ---- 4. deflection limit of a vertically free end (item 3.19) ----
test('deflection limits: a vertically free end (cantilever tip, guided tip) uses L/divisorCant (default 180), the absolute limit caps it, validation of the inputs', () => {
  c.reset({L:4, ends:E('cantilever'), loads:[{type:'point',pos:4,P:10,case:'Q'}]});
  let r = analyseAll();
  near(r.c.dlimit, 4000 / 180, 1e-12); assert.equal(r.c.divisor, 180); assert.equal(r.c.deflCant, true); assert.equal(r.a.deflection.cant, true);
  near(r.a.deflection.dpos, 4000, 1e-9, 'tip');
  const sec = run('activeSection()'); near(Math.abs(r.a.dmax), 10 * 1000 * 4000 ** 3 / (3 * 210000 * sec.Ix * 1e4), 1e-6, 'tip deflection relative to the root');
  c.reset({L:4, ends:E('cantilever'), divisorCant:250, deflAbs:5, loads:[{type:'point',pos:4,P:10,case:'Q'}]});
  r = analyseAll();
  assert.equal(r.c.divisor, 250); near(r.a.deflection.limSpan, 16, 1e-12); near(r.c.dlimit, 5, 1e-12); assert.equal(r.c.deflAbsGoverns, true);
  near(r.c.utils.find((v, i) => r.c.names[i] === 'Deflection'), Math.abs(r.a.dmax) / 5, 1e-12);
  // pinned - guided: the guided end is vertically free, so the tip value is checked against L/180 (= the 2L simply supported beam's L/360 at mid-span)
  c.reset({L:4, ends:E('pinned-guided'), loads:[{type:'udl',x1:0,x2:4,w:10,case:'Q'}], combos:Q15()});
  r = analyseAll(); assert.equal(r.a.deflection.cant, true); near(r.a.deflection.limit, 4000 / 180, 1e-12); near(r.a.deflection.dpos, 4000, 1e-9);
  near(Math.abs(r.a.dmax), 5 * 10 * 8000 ** 4 / (384 * 210000 * sec.Ix * 1e4), 1e-6, 'mid-span deflection of the 2L simply supported beam');
  // two held ends: span/360, one segment
  c.reset({}); r = analyseAll(); assert.equal(r.a.segs.length, 1); assert.equal(r.a.deflection.cant, false); near(r.a.deflection.limit, 8000 / 360, 1e-12);
  // validation
  c.reset({divisorCant:0}); assert.throws(() => run('analyse()'), /Cantilever deflection divisor/);
  c.reset({deflAbs:-2}); assert.throws(() => run('analyse()'), /Absolute deflection limit/);
  // blank absolute limit = none
  c.reset({deflAbs:''}); r = analyseAll(); assert.equal(r.a.deflection.abs, null);
});

// ---- brief and report placement ----
test('brief: end restraints in the loading list, hold-down row in Member Forces, the deflection row of a vertically free end, strut tags from the end fixities', () => {
  const ROW = /<div class="ms-row[^"]*"><div class="ms-l">(.*?)<\/div><div class="ms-v[^"]*">(.*?)<\/div><div class="ms-r">(.*?)<\/div><div class="ms-t">(.*?)<\/div><\/div>/g;
  const rows = html => [...html.matchAll(ROW)].map(m => ({label:m[1], vals:m[2], res:m[3], tag:m[4]}));
  const brief = () => run(`(()=>{ const a=analyse(); const ch=checks(a); return {html:renderMasterSeriesBrief(a,ch,a.sec), unsupported:ch.unsupported, pass:ch.pass}; })()`);
  c.reset({L:6, ends:E('ss'), loads:[{type:'moment',pos:6,M:-90,case:'Q'}], combos:Q15()});
  let r = brief(), h = r.html;
  assert.ok(!/undefined|NaN/.test(h));
  const iLoad = h.indexOf('Member Loading and Member Forces'), iCls = h.indexOf('Classification and Effective Area'), iHd = h.indexOf('ms-nv-msg">Hold-down required');
  assert.ok(iLoad < iHd && iHd < iCls, 'hold-down NOT VERIFIED row sits in the Member Forces block');
  assert.equal([...h.matchAll(/<div class="ms-row ms-nv">/g)].length, r.unsupported.length, 'one NOT VERIFIED row per blocking message');
  assert.ok(/<b>End restraints<\/b>: End 1 \(x = 0 m\): U<sub>x<\/sub>, U<sub>y<\/sub>, U<sub>z<\/sub>, R<sub>x<\/sub> restrained; End 2 \(x = 6 m\): U<sub>y<\/sub>, U<sub>z<\/sub>, R<sub>x<\/sub> restrained/.test(h.slice(iLoad, iCls)), 'end restraint line in the load list');
  assert.ok(/&gamma;<sub>G,inf<\/sub> companions: none generated/.test(h.slice(iLoad, iCls)), 'gamma_G,inf companion note printed with the loads');
  assert.ok(rows(h).find(x => /^Auto Design Load Cases$/.test(x.label)).vals === '1; SLS 1');
  // hold-down provided: advisory row with the force in the Member Forces block, no NOT VERIFIED row
  c.reset({L:6, ends:E('ss',{e1:{holdDown:true}}), loads:[{type:'moment',pos:6,M:-90,case:'Q'}], combos:Q15()});
  r = brief(); h = r.html;
  const hd = rows(h).find(x => /^Hold-down provided at End 1/.test(x.label));
  assert.ok(hd && hd.res === 'R = &minus;22.50 kN' && hd.tag === 'hold-down' && /combination ULS: 1\.5Q/.test(hd.vals), JSON.stringify(hd));
  assert.ok(!/ms-nv-msg">Hold-down/.test(h) && r.pass);
  // no uplift: the OK line
  c.reset({}); h = brief().html; assert.ok(rows(h).find(x => x.label === 'Uplift' && x.tag === 'OK'));
  // absolute limit in the deflection label
  c.reset({deflAbs:10}); h = brief().html; assert.ok(rows(h).find(x => /^In-span &delta; &le; Span\/360 \(&le; 10\.00 mm\)$/.test(x.label)));
  // cantilever: tip row with the NA.2 basis; strut K = 2 on the L_ey / L_ez lines tagged from the end fixities
  c.reset({L:4, ends:E('cantilever'), axial:300, loads:[{type:'point',pos:4,P:10,case:'Q'}]});
  h = brief().html;
  const tip = rows(h).find(x => /^Tip &delta; &le; L\/180$/.test(x.label)); assert.ok(tip && /vertically free end/.test(tip.vals) && /Table NA\.2 \[verify\]/.test(tip.vals));
  const ley = rows(h).find(x => /^L<sub>ey<\/sub>/.test(x.label)), lez = rows(h).find(x => /^L<sub>ez<\/sub>/.test(x.label));
  assert.ok(ley && /^2 x 4 = \(y-y: held in position and direction at one end, the other end free: 2\.0 L\)/.test(ley.vals) && ley.res === '8 m' && ley.tag === 'cantilever 2.0L', JSON.stringify(ley));
  assert.ok(lez && lez.res === '8 m' && lez.tag === 'cantilever 2.0L', JSON.stringify(lez));
  // user L_E: tagged as such
  c.reset({L:4, ends:E('cantilever'), axial:300, leFactor:1.5, loads:[{type:'point',pos:4,P:10,case:'Q'}]});
  h = brief().html; const leyU = rows(h).find(x => /^L<sub>ey<\/sub>/.test(x.label)); assert.ok(leyU && leyU.res === '6 m' && leyU.tag === 'user L<sub>E</sub>', JSON.stringify(leyU));
});
