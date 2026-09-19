// 19 Sep 2026 review of the single-span end-condition model (AUDIT.md
// "19 Sep 2026 review fixes: end conditions of the closed-form routes"):
// the standard closed-form Mcr route refuses ends that are not forks and
// cantilevers outside NCCI SN006a (finding F-C), the BS 5950 path validates
// the lateral flags and takes L_E from Table 13 / 14 (or blocks), the eigen
// mesh puts a node at every applied couple (F-D), the Reset state carries the
// eigen-patch fields, and the section card has no inline handlers. Expected
// values are hand derived ([hand-derived] in the comments) or are the
// engine's own eigen / closed-form values whose RELATION the finding fixes.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { app } = require('./harness.cjs');
const c = app();
const run = x => c.run(x);
const ENDS = (p, o) => c.ends(p, o);
function near(actual, expected, rel = 1e-6, what = '') { assert.ok(Math.abs(actual - expected) <= rel * Math.max(1, Math.abs(expected)), `${what} ${actual} != ${expected}`); }
const strip = s => String(s).replace(/<[^>]+>/g, '');
const LTB = () => run(`(()=>{ const a=analyse(); const ch=checks(a); return {Mcr:ch.ltb.Mcr, McrStd:ch.ltb.McrStandard, McrEigen:ch.ltb.McrEigen, route:ch.ltb.c1route, u:ch.ltbUtil, pass:ch.pass,
  verdict: ch.pass?'PASS':(ch.utils.some(u=>!Number.isFinite(u.val)||u.val>1.0001)?'FAIL':'NOT VERIFIED'),
  uns:ch.unsupported.map(m=>m.replace(/<[^>]+>/g,'')), adv:(ch.advisory||[]).map(m=>m.replace(/<[^>]+>/g,'')), basis:String(ch.ltbBasis||'').replace(/<[^>]+>/g,''),
  stdLabel: ch.ltb.std? String(ch.ltb.std.label||'').replace(/<[^>]+>/g,'') : null, endsOk: ch.ltb.endsOk, mesh: ch.ltb.meshError, LE: ch.LE}; })()`);
const brief = () => run(`(()=>{ const a=analyse(); const ch=checks(a); return renderMasterSeriesBrief(a,ch,a.sec); })()`);
const UB82 = { family: 'ub', ubKey: '457 x 191 x 82', L: 6, restraint: 'ltb', loads: [{ type: 'udl', x1: 0, x2: 6, w: 10, case: 'G' }, { type: 'udl', x1: 0, x2: 6, w: 12, case: 'Q' }] };
const UB40 = { family: 'ub', ubKey: '305 x 165 x 40', L: 3, restraint: 'ltb', loads: [{ type: 'udl', x1: 0, x2: 3, w: 10, case: 'G' }, { type: 'udl', x1: 0, x2: 3, w: 12, case: 'Q' }] };

// ---- F-C: the closed form needs fork ends ----
test('F-C: the standard route refuses an end that releases R_x or U_y (fork ends U_y + R_x needed at both ends), prints the fork-ended chain as NOT VERIFIED, and the eigen route models the flags (UB 457x191x82, 6 m)', () => {
  // End 2 R_x free: the closed form gave the fork-fork SN003a value 386.3 kN.m (util 0.51 PASS) against the eigen 180.5 (0.88)
  c.reset(Object.assign({}, UB82, { mcrMethod: 'standard', ends: ENDS('ss', { e2: { rx: 0 } }) }));
  const s = LTB();
  assert.equal(s.verdict, 'NOT VERIFIED'); assert.equal(s.endsOk, false);
  assert.ok(s.uns.some(m => /fork ends/.test(m) && /End 2 releases Rx/.test(m) && /FE eigenvalue/.test(m)), s.uns.join(' | '));
  assert.ok(/NOT VERIFIED: the closed form assumes fork ends/.test(s.basis), s.basis);
  near(s.Mcr, 386.307, 1e-4, 'the fork-ended chain is still printed');
  c.reset(Object.assign({}, UB82, { mcrMethod: 'eigen', ends: ENDS('ss', { e2: { rx: 0 } }) }));
  const e = LTB();
  assert.equal(e.verdict, 'PASS'); assert.ok(e.Mcr < 0.5 * s.Mcr, 'eigen M_cr with a twist-free end ' + e.Mcr + ' is well below the fork value ' + s.Mcr);
  assert.equal(e.McrStd, null, 'no closed-form comparison value for these ends'); assert.equal(e.route, 'unsupported');
  assert.match(e.stdLabel, /not applicable to these end conditions \(End 2 releases Rx/);
  // lateral cantilever (End 2 U_y + R_x free on a propped span): refused on the standard route, modelled on the eigen route
  c.reset(Object.assign({}, UB82, { mcrMethod: 'standard', ends: ENDS('fixed-pinned', { e2: { uy: 0, rx: 0 } }) }));
  const lc = LTB();
  assert.equal(lc.verdict, 'NOT VERIFIED'); assert.ok(lc.uns.some(m => /End 2 releases Uy and Rx/.test(m)));
  c.reset(Object.assign({}, UB82, { mcrMethod: 'eigen', ends: ENDS('fixed-pinned', { e2: { uy: 0, rx: 0 } }) }));
  const lce = LTB();
  assert.equal(lce.verdict, 'PASS'); assert.ok(lce.Mcr < 0.5 * lc.Mcr, lce.Mcr + ' vs ' + lc.Mcr);
  // the brief prints the refusal as a NOT VERIFIED row in the Lateral Buckling block
  c.reset(Object.assign({}, UB82, { mcrMethod: 'standard', ends: ENDS('ss', { e2: { rx: 0 } }) }));
  const h = brief();
  const i = h.indexOf('Lateral Buckling Check'), j = h.indexOf('NOT VERIFIED', i);
  assert.ok(i > 0 && j > i && /fork ends/.test(strip(h.slice(j, j + 600))), 'refusal row inside the LTB block');
});

test('F-C: fork ends at both ends keep the closed form (PASS, no message); laterally clamped ends (R_z both) are taken as forks with the conservative note, the eigen route giving the higher M_cr (UB 457x191x82, 6 m SS)', () => {
  c.reset(Object.assign({}, UB82, { mcrMethod: 'standard', ends: ENDS('ss') }));
  const f = LTB();
  assert.equal(f.verdict, 'PASS'); assert.equal(f.endsOk, true); assert.ok(!f.uns.length && !f.adv.some(m => /taken as fork/.test(m)));
  c.reset(Object.assign({}, UB82, { mcrMethod: 'standard', ends: ENDS('ss', { e1: { rz: 1 }, e2: { rz: 1 } }) }));
  const cl = LTB();
  assert.equal(cl.verdict, 'PASS'); near(cl.Mcr, f.Mcr, 1e-9, 'clamped ends: the same fork value (k = k_w = 1)');
  assert.ok(cl.adv.some(m => /laterally clamped ends \(Rz held at End 1 and End 2\) taken as fork ends/.test(m)), cl.adv.join(' | '));
  assert.ok(/Clamped \/ warping-fixed end\(s\) taken as fork ends/.test(cl.basis), cl.basis);
  c.reset(Object.assign({}, UB82, { mcrMethod: 'eigen', ends: ENDS('ss', { e1: { rz: 1 }, e2: { rz: 1 } }) }));
  const ce = LTB();
  assert.ok(ce.Mcr > 1.5 * f.Mcr, 'eigen with v\' = 0 at both ends: ' + ce.Mcr + ' vs fork ' + f.Mcr);
  assert.match(ce.stdLabel, /clamped \/ warping-fixed end\(s\) taken as forks/);
});

// ---- SN006a gating ----
test('SN006a is used only for the true cantilever (root U_y + R_z + R_x, free tip): a tip fork or a twist-free root is NOT VERIFIED on the standard route and modelled on the eigen route; isSn006aCantilever() is the pure gate', () => {
  const gate = (p, o) => { c.reset({ ends: ENDS(p, o) }); return run('isSn006aCantilever(S)'); };
  assert.equal(gate('cantilever'), true); assert.equal(gate('cantilever', { e1: { warp: 0 } }), true, 'the root warping flag selects the SN006a column, it is not a gate');
  assert.equal(gate('cantilever', { e2: { uy: 1, rx: 1 } }), false); assert.equal(gate('cantilever', { e2: { rx: 1 } }), false); assert.equal(gate('cantilever', { e2: { warp: 1 } }), false);
  assert.equal(gate('cantilever', { e1: { rx: 0 }, e2: { uy: 1, rx: 1 } }), false); assert.equal(gate('ss'), false); assert.equal(gate('fixed-pinned'), false);
  // UB 457x191x82, 6 m cantilever with a tip fork: SN006a 1143.7 kN.m was printed as "cantilever SN006a" against the eigen 2830 (the tip restraint raises M_cr)
  c.reset(Object.assign({}, UB82, { mcrMethod: 'standard', ends: ENDS('cantilever', { e2: { uy: 1, rx: 1 } }) }));
  const tf = LTB();
  assert.ok(tf.uns.some(m => /Cantilever LTB on the standard route: NCCI SN006a/.test(m) && /End 2 \(tip\) restrains Uy, Rx/.test(m)), tf.uns.join(' | '));
  assert.notEqual(tf.route, 'sn006a'); assert.equal(tf.endsOk, false);
  c.reset(Object.assign({}, UB82, { mcrMethod: 'eigen', ends: ENDS('cantilever', { e2: { uy: 1, rx: 1 } }) }));
  const te = LTB();
  assert.equal(te.McrStd, null); assert.equal(te.route, 'unsupported'); assert.match(te.stdLabel, /End 2 \(tip\) restrains Uy, Rx; SN006a needs/);
  // UB 305x165x40, 3 m in-plane cantilever, End 1 R_x free (twist held at the tip fork only): SN006a was applied with a root it takes as twist-held
  c.reset(Object.assign({}, UB40, { mcrMethod: 'standard', ends: ENDS('cantilever', { e1: { rx: 0, warp: 0 }, e2: { uy: 1, rx: 1 } }) }));
  const rf = LTB();
  assert.ok(rf.uns.some(m => /End 1 \(root\) releases Rx/.test(m)), rf.uns.join(' | ')); assert.notEqual(rf.route, 'sn006a');
  // the true cantilever keeps SN006a on both routes
  c.reset(Object.assign({}, UB82, { mcrMethod: 'standard', ends: ENDS('cantilever') }));
  const t = LTB(); assert.equal(t.route, 'sn006a'); assert.equal(t.endsOk, true); assert.ok(!t.uns.some(m => /SN006a/.test(m) && /standard route/.test(m)));
  c.reset(Object.assign({}, UB82, { mcrMethod: 'eigen', ends: ENDS('cantilever') }));
  const te2 = LTB(); assert.equal(te2.route, 'sn006a'); near(te2.McrStd, t.Mcr, 1e-9);
});

// ---- BS 5950: lateral flags validated, L_E from Table 13 / 14 ----
test('BS 5950: releasing U_y or R_x at both ends is refused (mechanism) as on the EC3 route; a lateral cantilever has no Table 13 / 14 row and is NOT VERIFIED until L_E/L is entered (UB 305x165x40, 4 m, 5 G + 5 Q)', () => {
  const base = { code: 'BS5950', family: 'ub', ubKey: '305 x 165 x 40', L: 4, loads: [{ type: 'udl', x1: 0, x2: 4, w: 5, case: 'G' }, { type: 'udl', x1: 0, x2: 4, w: 5, case: 'Q' }] };
  const bs = o => { c.reset(Object.assign({}, base, o)); return run(`(()=>{ const a=analyse(); const ch=checks(a); return {LE:ch.LE, K:ch.leK, row:ch.leRow, u:ch.ltbUtil, Mb:ch.Mb, pass:ch.pass, uns:ch.unsupported.map(m=>m.replace(/<[^>]+>/g,'')), basis:String(ch.leBasis).replace(/<[^>]+>/g,'')}; })()`); };
  const throwsWith = (o, re) => { c.reset(Object.assign({}, base, o)); assert.throws(() => run('analyse()'), e => re.test(strip(e && e.message ? e.message : e)), 'expected ' + re); };
  throwsWith({ ends: ENDS('ss', { e1: { rx: 0 }, e2: { rx: 0 } }) }, /no end restrains both Uy and Rx/);
  throwsWith({ ends: ENDS('ss', { e1: { uy: 0 }, e2: { uy: 0 } }) }, /neither end restrains lateral translation Uy; the member has no lateral support/);
  throwsWith({ ends: ENDS('ss', { e2: { uy: 0, rx: 0 } }) }, /lateral cantilever; that end must also restrain Rz/);
  // lateral cantilever with R_z at the held end: valid layout, no tabulated L_E row -> blocked at 1.0 L; an entered factor is accepted
  const lc = bs({ ends: ENDS('ss', { e1: { rz: 1 }, e2: { uy: 0, rx: 0 } }) });
  assert.equal(lc.pass, false); assert.equal(lc.row, 'none'); assert.ok(lc.uns.some(m => /no Table 13 \/ Table 14 row - End 2 releases Uy and Rx/.test(m)), lc.uns.join(' | '));
  const lc2 = bs({ leFactor: 2.0, ends: ENDS('ss', { e1: { rz: 1 }, e2: { uy: 0, rx: 0 } }) });
  assert.equal(lc2.pass, true); assert.equal(lc2.row, 'user'); near(lc2.LE, 8000, 1e-9); assert.match(lc2.basis, /entered LE\/L = 2.00/);
});

test('[hand-derived] BS 5950 L_E from the end flags: Table 13 1.0 L / 1.2 L fork ends, 0.7 L / 0.85 L with R_z at both ends; Table 14 (d) cantilever 0.8 L / 1.4 L, tip R_x 0.6 L, tip U_y + R_x 0.5 L; M_b follows (UB 305x165x40, 4 m)', () => {
  const base = { code: 'BS5950', family: 'ub', ubKey: '305 x 165 x 40', L: 4, loads: [{ type: 'udl', x1: 0, x2: 4, w: 5, case: 'G' }, { type: 'udl', x1: 0, x2: 4, w: 5, case: 'Q' }] };
  const bs = o => { c.reset(Object.assign({}, base, o)); return run(`(()=>{ const a=analyse(); const ch=checks(a); return {LE:ch.LE, K:ch.leK, row:String(ch.leRow).replace(/<[^>]+>/g,''), Mb:ch.Mb, lamLT:ch.lamLT, pb:ch.pb, uns:ch.unsupported.length, basis:String(ch.leBasis).replace(/<[^>]+>/g,'')}; })()`); };
  // [hand-derived] UB 305x165x40: r_y = 3.86 cm, x = 31.0, u = 0.889, S_x = 623 cm3, t_f = 10.2 -> p_y = 275 (S275)
  // fork ends, L_E = 1.0 x 4000: lambda = 4000/38.6 = 103.63; v = 1/[1 + 0.05 (103.63/31.0)^2]^0.25 = 0.8879; lambda_LT = 0.889 x 0.8879 x 103.63 = 81.80
  const ss = bs({ ends: ENDS('ss') });
  near(ss.K, 1.0, 1e-12); near(ss.LE, 4000, 1e-9); assert.match(ss.row, /Table 13: both flanges free to rotate on plan/); assert.equal(ss.uns, 0);
  const lam = 4000 / 38.6, v = 1 / Math.pow(1 + 0.05 * Math.pow(lam / 31.0, 2), 0.25), lamLT = 0.889 * v * lam;
  near(ss.lamLT, lamLT, 2e-3, 'lambda_LT from the table constants');
  near(bs({ destab: true, ends: ENDS('ss') }).K, 1.2, 1e-12, 'destabilising column 1.2 L');
  const ff = bs({ ends: ENDS('fixed-fixed') });
  near(ff.K, 0.7, 1e-12); near(ff.LE, 2800, 1e-9); assert.match(ff.row, /both flanges fully restrained against rotation on plan/); assert.ok(ff.Mb > ss.Mb, 'shorter L_E, higher M_b');
  near(bs({ destab: true, ends: ENDS('fixed-fixed') }).K, 0.85, 1e-12, 'Table 13 destabilising 0.85 L');
  const pr = bs({ ends: ENDS('fixed-pinned') });
  near(pr.K, 1.0, 1e-12); assert.match(pr.row, /Rz held at one end only: no one-end row/);
  const ca = bs({ ends: ENDS('cantilever') });
  near(ca.K, 0.8, 1e-12); near(ca.LE, 3200, 1e-9); assert.match(ca.row, /Table 14 \(d\).*tip free/); assert.match(ca.basis, /root warping flag is not distinguished/);
  near(bs({ destab: true, ends: ENDS('cantilever') }).K, 1.4, 1e-12, 'Table 14 (d) destabilising 1.4 L');
  near(bs({ ends: ENDS('cantilever', { e2: { rx: 1 } }) }).K, 0.6, 1e-12, 'tip torsional restraint 0.6 L');
  const c4 = bs({ ends: ENDS('cantilever', { e2: { uy: 1, rx: 1 } }) });
  near(c4.K, 0.5, 1e-12, 'tip lateral + torsional restraint 0.5 L'); assert.match(c4.row, /Table 14 \(d\)/, 'a cantilever never takes the Table 13 beam row');
  near(bs({ ends: ENDS('cantilever', { e2: { uy: 1 } }) }).K, 0.8, 1e-12, 'a tip holding U_y only is taken as free (conservative)');
  const user = bs({ leFactor: 1.0, ends: ENDS('fixed-fixed') });
  near(user.K, 1.0, 1e-12); assert.match(user.basis, /entered LE\/L = 1.00 \(the end fixities would give: 0.70 L/);
});

// ---- F-D: mesh nodes at applied couples ----
test('F-D: an in-span couple off a mesh node no longer inflates the Richardson mesh error (UB 254x146x31, 5 m fixed-fixed, 40 kN.m at 2 m + UDL): converged and PASS; the couple positions are part of the eigen cache key', () => {
  const { cases } = require('./batch/cases.cjs');
  const cs = cases.find(x => x.id === 'UB-57');
  c.reset(Object.assign(JSON.parse(JSON.stringify(cs.overrides)), { mcrMethod: 'eigen' }));
  const r = LTB();
  assert.ok(r.mesh < 1e-4, 'mesh error ' + r.mesh + ' (was 2.3 %)'); assert.equal(r.verdict, 'PASS'); assert.ok(!r.uns.some(m => /mesh convergence error/.test(m)));
  // the unit-load extraction reports the couple position and the solve is served from the cache on a repeat
  const ul = run(`(()=>{ const a=analyse(); return {n:a.ulsResults.length}; })()`);
  assert.equal(ul.n, 1);
  const m = run(`(()=>{ const a=analyse(); const ch=checks(a); return {solves:ch.ltb.nSolves, cached:ch.ltb.nCached}; })()`);
  assert.ok(m.solves + m.cached >= 2, 'solve bookkeeping present: ' + JSON.stringify(m));
});

// ---- Reset state and the section card ----
test('DEMO carries the eigen-patch fields (ltbRestraints, zj, Cmzo) so a Reset (S = copy of DEMO) keeps "+ Add lateral restraint" working; the section card is bound without inline handlers', () => {
  const d = run('JSON.stringify({lr:Array.isArray(DEMO.ltbRestraints), n:DEMO.ltbRestraints.length, zj:DEMO.zj, cmz:DEMO.Cmzo})');
  assert.equal(d, JSON.stringify({ lr: true, n: 0, zj: 0, cmz: null }));
  c.reset({});
  const after = run('(()=>{ S=JSON.parse(JSON.stringify(DEMO)); S.ltbRestraints.push({pos:"4.000",v:true,phi:true,vp:false,phip:false}); return S.ltbRestraints.length; })()');
  assert.equal(after, 1);
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', '05-section-view.js'), 'utf8');
  assert.ok(!/on(click|keydown)="/.test(src), 'no inline handler attributes');
  // the section view registers a document keydown listener at load, so it is run in its own context with that stub
  const vm = require('node:vm');
  const ctx2 = vm.createContext({ console, document: { getElementById: () => null, addEventListener: () => {} } });
  ctx2.window = ctx2;
  ['01-computation-engine.js', 'sections/pfc-section-data.js', 'sections/shs-section-data.js', 'sections/rhs-section-data.js', 'sections/ub-section-data.js', 'sections/uc-section-data.js', '02-section-data.js', '03-state-ui.js', '05-section-view.js']
    .forEach(f => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx2, { filename: f }));
  const card = vm.runInContext(`(()=>{ S.eccOn=true; return sectionLoadLineView(activeSection()); })()`, ctx2);
  assert.match(card, /data-section-zoom="1"/); assert.ok(!/onclick|onkeydown/.test(card));
  assert.equal(vm.runInContext('typeof sectionViewBindZoom', ctx2), 'function');
  const bound = vm.runInContext(`JSON.stringify((()=>{ const els=[]; const root={querySelectorAll:()=>[{addEventListener:(t)=>els.push(t)}]}; sectionViewBindZoom(root); return els; })())`, ctx2);
  assert.equal(bound, JSON.stringify(['click', 'keydown']));
  const all = ['03-state-ui.js', '04-checks.js', '06-render.js', '06-brief-masterseries.js', '07-wiring.js', '08-mcr-eigen-patch.js', 'checks/eurocode-checks.js', 'checks/bs5950-checks.js', 'checks/torsion-fe.js']
    .map(f => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8')).join('\n') + fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.ok(!/ on(click|keydown|change|input|load)="/.test(all), 'no inline handlers anywhere');
});

test('the cantilever-root rule is stated where the user meets it: the End conditions hint and the preset list name End 1 as the root, and a root at End 2 is still refused with "mirror the member"', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(html, /the root must be End 1 \(x = 0\): a cantilever rooted at End 2 .* is refused with .*mirror the member/);
  assert.match(html, /<option value="cantilever">Cantilever \(root at End 1, tip at End 2\)<\/option>/);
  c.reset({ ends: ENDS('ss', { e1: { uz: 0, uy: 0, rx: 0 }, e2: { ry: 1, rz: 1, ux: 1 } }) });
  assert.throws(() => run('analyse()'), e => /mirror the member/.test(strip(e && e.message ? e.message : e)));
});
