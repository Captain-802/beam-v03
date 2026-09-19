// End conditions panel state (js/03-state-ui.js, UI half of the 19 Sep 2026
// scope change): the preset mutators, the drop-list selection, the pure panel
// / glyph string builders and the End conditions line, exercised through the
// vm harness (no DOM: document.getElementById returns null, so every builder
// under test must be a pure string function).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { app } = require('./harness.cjs');
const c = app();
const run = x => { const v = c.run(x); return (v && typeof v === 'object') ? JSON.parse(JSON.stringify(v)) : v; };   // plain objects of this realm for deepEqual
const E = (p, o) => c.ends(p, o);
const flags = e => ['ux','uy','uz','rx','ry','rz','warp'].map(k => (e[k] ? 1 : 0)).join('');
const PRESETS = ['ss', 'fixed-fixed', 'fixed-pinned', 'cantilever', 'guided-fixed', 'pinned-guided'];
const EXPECT = {   // seven flags ux uy uz rx ry rz warp per end, from the scope note
  'ss':            ['1111000', '0111000'],
  'fixed-fixed':   ['1111110', '0111110'],
  'fixed-pinned':  ['1111110', '0111000'],
  'cantilever':    ['1111111', '0000000'],
  'guided-fixed':  ['1111110', '0101110'],
  'pinned-guided': ['1111000', '0101110'],
};

test('presets set the seven flags of both ends, keep the seating / hold-down / stiffener entries, clear the hinges and name the selection', () => {
  c.reset({ hinges: [{pos: 3}], ends: E('ss', {e1: {ss: 100, holdDown: true}, e2: {ss: 80, stiff: true}}) });
  for (const p of PRESETS) {
    const s = run(`(()=>{ applyEndPreset(S, ${JSON.stringify(p)}); return {e1:S.ends.e1, e2:S.ends.e2, sel:S.endPreset, shown:endPresetSelection(S), hinges:S.hinges.length, name:endsPresetName(S.ends)}; })()`);
    assert.deepEqual([flags(s.e1), flags(s.e2)], EXPECT[p], p + ': flags');
    assert.equal(s.sel, p); assert.equal(s.shown, p); assert.equal(s.name, p);
    assert.equal(s.hinges, 0, p + ': hinges cleared');
    assert.deepEqual([s.e1.ss, s.e1.holdDown, s.e2.ss, s.e2.stiff], [100, true, 80, true], p + ': per-end entries kept');
  }
  // the alias is canonicalised; an unknown preset throws before touching the state
  assert.equal(run(`(()=>{ applyEndPreset(S, 'fixed-guided'); return S.endPreset; })()`), 'guided-fixed');
  assert.throws(() => run(`applyEndPreset(S, 'two-span')`), /Unknown end preset/);
  assert.equal(run('S.endPreset'), 'guided-fixed', 'state untouched by the refused preset');
  // the in-plane support list the solver receives (uz + ry fixed, uz pinned, ry guided, neither omitted)
  const types = run(`(()=>{ const o={}; ${JSON.stringify(PRESETS)}.forEach(p=>{ applyEndPreset(S,p); o[p]=endsToSupports(S).map(s=>s.end+':'+s.type).join(' '); }); return o; })()`);
  assert.deepEqual(types, {'ss':'1:pinned 2:pinned', 'fixed-fixed':'1:fixed 2:fixed', 'fixed-pinned':'1:fixed 2:pinned', 'cantilever':'1:fixed', 'guided-fixed':'1:fixed 2:guided', 'pinned-guided':'1:pinned 2:guided'});
});

test('a flag change sets the selection to custom; the flags stay the truth for a stored preset that no longer matches', () => {
  c.reset({});
  assert.equal(run('endPresetSelection(S)'), 'ss', 'demo state is simply supported');
  const s = run(`(()=>{ setEndDof(S, 'e2', 'ry', true); return {sel:S.endPreset, shown:endPresetSelection(S), ry:S.ends.e2.ry, type:endsToSupports(S)[1].type}; })()`);
  assert.deepEqual(s, {sel:'custom', shown:'custom', ry:true, type:'fixed'});
  // unticking it again restores the simply supported flags, but the selection stays custom until a preset is chosen
  assert.equal(run(`(()=>{ setEndDof(S, 'e2', 'ry', false); return endsPresetName(S.ends) + '|' + endPresetSelection(S); })()`), 'ss|custom');
  assert.equal(run(`(()=>{ applyEndPreset(S, 'ss'); return endPresetSelection(S); })()`), 'ss');
  // bad arguments throw and leave the selection alone
  assert.throws(() => run(`setEndDof(S, 'e3', 'uz', true)`), /end must be e1 or e2/);
  assert.throws(() => run(`setEndDof(S, 'e1', 'uw', true)`), /unknown degree of freedom/);
  assert.equal(run('S.endPreset'), 'ss');
  // a fixture built from endsPreset() alone (harness reset) carries the demo's endPreset 'ss': the drop-list shows the flags' preset
  c.reset({ ends: E('cantilever') });
  assert.equal(run('S.endPreset + "|" + endPresetSelection(S)'), 'ss|cantilever');
  c.reset({ ends: E('cantilever', {e2: {uz: true}}) });
  assert.equal(run('endPresetSelection(S)'), 'custom', 'flags matching no preset show custom');
});

test('End conditions panel HTML and glyphs are pure string builders: two columns, seven boxes each, seating fields only at a vertically held end on the EC3 path', () => {
  c.reset({ ends: E('cantilever', {e1: {ss: 100, holdDown: true}}) });
  const html = run('endsPanelHtml(S)');
  const cols = html.split('<div class="end-col"').slice(1);
  assert.equal(cols.length, 2);
  assert.ok(/End 1 \(x = 0 m\)/.test(cols[0]) && /End 2 \(x = L = 8 m\)/.test(cols[1]), 'column headings');
  const boxes = col => [...col.matchAll(/data-end="(e[12])" data-dof="(\w+)"( checked)?/g)].map(m => m[2] + (m[3] ? '*' : ''));
  assert.deepEqual(boxes(cols[0]), ['ux*', 'uy*', 'uz*', 'rx*', 'ry*', 'rz*', 'warp*'], 'End 1: all seven restrained');
  assert.deepEqual(boxes(cols[1]), ['ux', 'uy', 'uz', 'rx', 'ry', 'rz', 'warp'], 'End 2: all seven free');
  assert.ok(/data-opt="holdDown" checked/.test(cols[0]) && /data-ss="1"/.test(cols[0]) && /value="100"/.test(cols[0]) && /data-opt="stiff"/.test(cols[0]), 'End 1 seating entries');
  assert.ok(!/data-ss/.test(cols[1]) && /no vertical reaction \(U<sub>z<\/sub> free\)/.test(cols[1]), 'free tip: no seating entries');
  assert.ok(/<svg class="end-glyph"/.test(cols[0]) && /<svg class="end-glyph"/.test(cols[1]), 'one glyph per column');
  assert.ok(!/undefined|NaN/.test(html));
  // BS 5950 path: hold-down stays, the EN 1993-1-5 seating fields go
  c.reset({ code: 'BS5950' });
  const bs = run('endsPanelHtml(S)');
  assert.ok(/data-opt="holdDown"/.test(bs) && !/data-ss/.test(bs) && !/data-opt="stiff"/.test(bs));
  // glyphs: in-plane symbol and the LTB type text per end type; a pin with U_x free is drawn as a roller
  const glyph = (p, o) => run(`(()=>{ S.ends=endsPreset(${JSON.stringify(p)}, ${JSON.stringify(o || {})}); return endsList(S).map(endGlyphSvg); })()`);
  const [g1, g2] = glyph('ss');
  assert.ok(g1.startsWith('<svg') && /pin in plane/.test(g1) && /LTB: fork/.test(g1) && /<polygon/.test(g1), 'End 1 pin');
  assert.ok(/roller in plane/.test(g2) && /<circle/.test(g2), 'End 2 roller (U_x free)');
  const [f1, f2] = glyph('guided-fixed');
  assert.ok(/fixed in plane/.test(f1) && /LTB: clamped/.test(f1) && /guided in plane/.test(f2) && /<rect/.test(f2), 'fixed wall and guided slider');
  const [, t2] = glyph('cantilever');
  assert.ok(/free in plane/.test(t2) && /LTB: free/.test(t2) && !/<polygon|<rect/.test(t2), 'free tip');
  assert.ok(/LTB: clamped \+ warping/.test(glyph('cantilever')[0]), 'root warping named');
  assert.ok(!/<sub>|<[^>]*&/.test(g1), 'glyph text carries no HTML markup');
});

test('End conditions line and the end-moment helper: flags, derived types, preset name, hinges; fixed-fixed prints the hogging moment at both ends', () => {
  c.reset({ L: 6, hinges: [{pos: 2}] });
  assert.equal(run('endsConditionsLine(S)'),
    'End 1: U<sub>x</sub> U<sub>y</sub> U<sub>z</sub> R<sub>x</sub> restrained (pinned in plane; LTB fork); End 2: U<sub>y</sub> U<sub>z</sub> R<sub>x</sub> restrained (pinned in plane; LTB fork) &mdash; simply supported; internal hinge at 2 m (in-plane moment release, lateral / twist continuity kept)');
  c.reset({ ends: E('ss', {e1: {uy: false, rz: true}}) });
  assert.ok(/End 1: U<sub>x<\/sub> U<sub>z<\/sub> R<sub>x<\/sub> R<sub>z<\/sub> restrained \(pinned in plane; LTB partial \(v&prime;, &phi; = 0\)\)/.test(run('endsConditionsLine(S)')) && /&mdash; custom end conditions$/.test(run('endsConditionsLine(S)')));
  // [hand-derived] reactionEndMomentKNm: fixed-fixed 6 m, 1.5 x 10 kN/m: -wL^2/12 = -45 kN.m at BOTH ends (the nodal
  // reaction is anticlockwise-positive, so its sign flips between the ends); fixed - guided: -180 at End 1, +90 at End 2
  const Q15 = [{id:'c1', label:'ULS: 1.5Q', factors:{G:0,Q:1.5,W:0,E:0}, sls:false, on:true}, {id:'s1', label:'SLS: Q', factors:{G:0,Q:1,W:0,E:0}, sls:true, on:true}];
  const ends = p => { c.reset({ L: 6, ends: E(p), combos: Q15, loads: [{type:'udl', x1:0, x2:6, w:10, case:'Q'}] }); return run('analyse().reactions.map(r=>[r.end, r.type, +reactionEndMomentKNm(r).toFixed(6)])'); };
  assert.deepEqual(ends('fixed-fixed'), [[1, 'fixed', -45], [2, 'fixed', -45]]);
  assert.deepEqual(ends('guided-fixed'), [[1, 'fixed', -180], [2, 'guided', 90]]);
  assert.deepEqual(ends('ss'), [[1, 'pinned', 0], [2, 'pinned', 0]]);
});
