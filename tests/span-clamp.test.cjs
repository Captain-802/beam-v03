// 20 Sep 2026 owner requests (js/03-state-ui.js, UI / defaults only - the
// engine is untouched): the span clamp that keeps the loads, hinges and
// intermediate LTB restraints inside the member when L changes
// (clampLoadsToSpan, called by the length handlers of js/07-wiring.js), the
// section display names ("D x B x t" for every family) and the default
// combinations (ULS 1.35G + 1.5Q, SLS 1.0G + 1.0Q). Exercised through the vm
// harness (no DOM), so everything under test is a pure state function.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { app } = require('./harness.cjs');
const c = app();
const run = x => { const v = c.run(x); return (v && typeof v === 'object') ? JSON.parse(JSON.stringify(v)) : v; };   // plain objects of this realm for deepEqual
const E = (p, o) => c.ends(p, o);
const clamp = (Lold, Lnew) => run(`(()=>{ clampLoadsToSpan(S, ${Lold}, ${Lnew}); return {loads:S.loads, hinges:S.hinges, ltb:S.ltbRestraints, L:S.L}; })()`);

test('span clamp: a full-span UDL / trapezoid follows the span, longer or shorter; a partial UDL inside the new span is untouched', () => {
  c.reset({ L: 8, ends: E('ss'), loads: [
    { type: 'udl', x1: 0, x2: 8, w: 19.7, case: 'G' },      // full span: follows
    { type: 'trap', x1: 2, x2: 8, w1: 0, w2: 12, case: 'Q' }, // runs to End 2: its end follows, its start stays
    { type: 'udl', x1: 1, x2: 3, w: 5, case: 'Q' } ] });     // inside: untouched
  let s = clamp(8, 12);
  assert.deepEqual(s.loads.map(l => [l.x1, l.x2]), [[0, 12], [2, 12], [1, 3]], 'longer span');
  s = clamp(12, 6);
  assert.deepEqual(s.loads.map(l => [l.x1, l.x2]), [[0, 6], [2, 6], [1, 3]], 'shorter span');
  assert.deepEqual(s.loads.map(l => [l.type, l.case, l.w ?? l.w2]), [['udl', 'G', 19.7], ['trap', 'Q', 12], ['udl', 'Q', 5]], 'intensities and cases kept');
  // the mutated state is the one the handlers read; S.L itself is set by readScalarInputs() afterwards, not by the clamp
  assert.equal(s.L, 8);
});

test('span clamp: an off-span point load / moment is clamped to the new length; a partial UDL past the end is cut, one wholly outside slides inwards keeping its length', () => {
  c.reset({ L: 8, ends: E('ss'), loads: [
    { type: 'point', pos: 6, P: 10, case: 'Q' },
    { type: 'moment', pos: 7.5, M: 10, case: 'Q' },
    { type: 'point', pos: 2, P: 10, case: 'Q' },
    { type: 'udl', x1: 3, x2: 7, w: 5, case: 'Q' },          // straddles the new end: x2 cut to 5
    { type: 'trap', x1: 6, x2: 7.5, w1: 1, w2: 2, case: 'Q' } ] });   // wholly beyond 5 m: x1 = x2 = 5 -> slid to 3.5-5 (its 1.5 m kept; 20 Sep 2026 review: was x1 = 0, a silent full-span load)
  const s = clamp(8, 5);
  assert.deepEqual(s.loads.map(l => l.type === 'point' || l.type === 'moment' ? l.pos : [l.x1, l.x2]), [5, 5, 2, [3, 5], [3.5, 5]]);
  assert.deepEqual(s.loads.map(l => l.P ?? l.M ?? l.w ?? l.w2), [10, 10, 10, 5, 2], 'values kept');
  // a strip longer than the new member becomes the full member; a strip running to the old End 2 keeps its length too
  c.reset({ L: 8, ends: E('ss'), loads: [{ type: 'udl', x1: 5, x2: 6, w: 10, case: 'Q' }, { type: 'trap', x1: 6, x2: 8, w1: 1, w2: 2, case: 'Q' }] });
  assert.deepEqual(clamp(8, 0.5).loads.map(l => [l.x1, l.x2]), [[0, 0.5], [0, 0.5]]);
  c.reset({ L: 8, ends: E('ss'), loads: [{ type: 'udl', x1: 5, x2: 6, w: 10, case: 'Q' }, { type: 'trap', x1: 6, x2: 8, w1: 1, w2: 2, case: 'Q' }] });
  assert.deepEqual(clamp(8, 5).loads.map(l => [l.x1, l.x2]), [[4, 5], [3, 5]]);
});

test('span clamp: a hinge beyond the span keeps its fraction of the span (strictly inside: analyse() runs), an intermediate LTB restraint is clamped, one inside is kept; a restraint position stays the string the editor stores', () => {
  c.reset({ L: 8, ends: E('fixed-fixed'), hinges: [{ pos: 2 }, { pos: 7 }], ltbRestraints: [{ pos: '3.000', v: true, phi: true, vp: false, phip: false }, { pos: 6.5, v: true, phi: true, vp: false, phip: false }], loads: [] });
  const s = clamp(8, 4);
  assert.deepEqual(s.hinges.map(h => h.pos), [2, 3.5]);   // 20 Sep 2026 review: 7 x 4/8 = 3.5, not the end (validateInputs refuses a hinge at x = L)
  assert.deepEqual(s.ltb.map(r => r.pos), ['3.000', 4]);
  assert.deepEqual(s.ltb.map(r => typeof r.pos), ['string', 'number']);
  assert.deepEqual(s.ltb.map(r => [r.v, r.phi, r.vp, r.phip]), [[true, true, false, false], [true, true, false, false]], 'flags kept');
  // the clamped state analyses without an error (the owner's "I shall not see error"): hinge at 7 of 8 m, restraint at 7.5 m, span cut to 5 m
  c.reset({ L: 8, ends: E('fixed-fixed'), restraint: 'ltb', hinges: [{ pos: 7 }], ltbRestraints: [{ pos: '7.5', v: true, phi: true, vp: false, phip: false }], loads: [{ type: 'udl', x1: 0, x2: 8, w: 10, case: 'Q' }] });
  assert.deepEqual(clamp(8, 5).hinges.map(h => h.pos), [4.375]);
  assert.equal(run('(()=>{ S.L = 5; const a = analyse(); return a.L; })()'), 5000, 'analyse() runs after the clamp');
  assert.equal(run('S.ltbRestraints[0].pos'), '5');
  // Lold unknown (NaN) or the hinge already on / beyond the old end: 0.9 L_new, never the end
  c.reset({ L: 8, ends: E('fixed-fixed'), hinges: [{ pos: 7 }, { pos: 8.5 }], loads: [] });
  assert.deepEqual(clamp('NaN', 5).hinges.map(h => h.pos), [4.5, 4.5]);
  c.reset({ L: 8, ends: E('fixed-fixed'), hinges: [{ pos: 8 }], loads: [] });
  assert.deepEqual(clamp(8, 5).hinges.map(h => h.pos), [4.5]);
  c.reset({ L: 8, ends: E('fixed-fixed'), hinges: [{ pos: 3 }], loads: [] });
  assert.deepEqual(clamp(8, 5).hinges.map(h => h.pos), [3], 'a hinge inside the new span is untouched');
});

test('span clamp: a non-finite or non-positive new length leaves the state alone; a state without hinges / restraints is tolerated', () => {
  c.reset({ L: 8, ends: E('ss'), loads: [{ type: 'udl', x1: 0, x2: 8, w: 1, case: 'Q' }, { type: 'point', pos: 8, P: 1, case: 'Q' }] });
  run('delete S.hinges; delete S.ltbRestraints');
  for (const bad of ['NaN', '0', '-2', 'undefined']) {
    const s = clamp(8, bad);
    assert.deepEqual(s.loads.map(l => l.pos ?? [l.x1, l.x2]), [[0, 8], 8], 'ignored: ' + bad);
  }
  assert.equal(run('clampLoadsToSpan(S, 8, 3) === S'), true, 'returns the state');
  assert.deepEqual(run('S.loads.map(l => l.pos ?? [l.x1, l.x2])'), [[0, 3], 3]);
});

test('section names: every family prints "D x B x t" with a spaced x (drop-list text, report / brief head); the option value stays the raw key', () => {
  assert.equal(run('sectionDisplayName("200x75x23")'), '200 x 75 x 23');
  assert.equal(run('sectionDisplayName("150x150x6.3")'), '150 x 150 x 6.3');
  assert.equal(run('sectionDisplayName("457 x 191 x 82")'), '457 x 191 x 82');
  assert.equal(run('sectionDisplayName("200 x 100 x 8.0")'), '200 x 100 x 8.0');
  assert.equal(run('sectionDisplayName(null)'), '');
  assert.equal(run('sectionOptionText(PFCmap["200x75x23"], "PFC")'), '200 x 75 x 23 PFC (23.4 kg/m)');
  assert.equal(run('sectionOptionText(SHS_HFmap["150x150x6.3"], "SHS")'), '150 x 150 x 6.3 SHS (28.1 kg/m)');
  assert.equal(run('sectionOptionText(UBmap["457 x 191 x 82"], "UB")'), '457 x 191 x 82 UB (82 kg/m)');
  assert.equal(run('sectionOptionText(UCmap["203 x 203 x 60"], "UC")'), '203 x 203 x 60 UC (60 kg/m)');
  assert.equal(run('sectionOptionText(RHSmap["200 x 100 x 8.0"], "RHS")'), '200 x 100 x 8.0 RHS (35.1 kg/m)');
  // no library key is left with an unspaced x in any family's option text
  const bad = run('[["PFC",PFC],["SHS",SHS_HF],["SHS",SHS_CF],["UB",UB],["UC",UC],["RHS",RHS],["RHS",RHS_CF]].flatMap(([f,arr]) => arr.map(s => sectionOptionText(s,f)).filter(t => /\\dx\\d|\\d  \\d/.test(t)))');
  assert.deepEqual(bad, []);
  // the report head helper and the brief helper agree with it
  assert.equal(run('sname("200x75x23")'), '200 x 75 x 23');
  assert.equal(run('msbSecName("200x75x23")'), '200 x 75 x 23');
});

test('default combinations: ULS 1.35G + 1.5Q (Eq 6.10) and SLS 1.0G + 1.0Q, both on; the demo carries a copy', () => {
  assert.deepEqual(run('DEFAULT_COMBOS.map(c => [c.id, c.label, c.factors.G, c.factors.Q, c.factors.W, c.factors.E, c.sls, c.on])'),
    [['c1', 'ULS: 1.35G + 1.5Q (Eq 6.10)', 1.35, 1.5, 0, 0, false, true], ['s1', 'SLS: 1.0G + 1.0Q', 1.0, 1.0, 0, 0, true, true]]);
  assert.deepEqual(run('DEMO.combos'), run('DEFAULT_COMBOS'));
  assert.equal(run('DEMO.combos === DEFAULT_COMBOS'), false, 'a copy, not the same object');
  assert.equal(run('comboLabelFromFactors(DEFAULT_COMBOS[1])'), 'SLS: 1G + 1Q');
});
