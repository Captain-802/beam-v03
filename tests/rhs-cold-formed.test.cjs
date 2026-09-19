const { test } = require('node:test');
const assert = require('node:assert/strict');
const { app } = require('./harness.cjs');
const c = app();
const run = x => c.run(x);

test('cold-formed RHS switch selects RHS_CF, sets boxType CF and the EC3 flat-width convention', () => {
  c.reset({ family: 'rhs', rhsType: 'CF', rhsKey: '100 x 50 x 3.0', code: 'EC3', L: 3 });
  const s = run('activeSection()');
  assert.equal(s.boxType, 'CF');
  assert.equal(s.key, '100 x 50 x 3.0');
  // P363: c = h - 3t on the EC3 path (table stores h - 5t for BS 5950)
  const row = run("RHS_CFmap['100 x 50 x 3.0']");
  assert.ok(Math.abs(s.dt - (row.D - 3 * row.t) / row.t) < 1e-9, `dt ${s.dt}`);
  assert.ok(Math.abs(s.bT - (row.B - 3 * row.t) / row.t) < 1e-9, `bT ${s.bT}`);
  assert.equal(s.tp, null, 'no P385 hot-finished row may be borrowed for a cold-formed RHS');
  // BS path keeps the stored h - 5t ratios
  c.reset({ family: 'rhs', rhsType: 'CF', rhsKey: '100 x 50 x 3.0', code: 'BS5950', L: 3 });
  const b = run('activeSection()');
  assert.ok(Math.abs(b.dt - row.dt) < 1e-9 && Math.abs(b.bT - row.bT) < 1e-9);
  // strut curves: EC3 curve c, BS 5950 Robertson 5.5 both axes
  assert.equal(run("strutCurveEC3(activeSection(),'y').curve"), 'c');
  const rob = run("defaultRobertson('rhs','CF',3)");
  assert.equal(rob.x, 5.5); assert.equal(rob.y, 5.5);
});

test('hot-finished RHS is unchanged by the new switch (default HF) and a full design runs on a CF RHS', () => {
  c.reset({ family: 'rhs', rhsKey: '200 x 100 x 8.0', code: 'EC3', L: 6 });
  const s = run('activeSection()');
  assert.equal(s.boxType, 'HF');
  assert.ok(s.tp && s.tp.Wt > 0, 'hot-finished P385 row still found');
  c.reset({ family: 'rhs', rhsType: 'CF', rhsKey: '200 x 100 x 5.0', code: 'EC3', L: 5, restraint: 'ltb',
    loads: [{ type: 'udl', x1: 0, x2: 5, w: 6, case: 'G' }, { type: 'udl', x1: 0, x2: 5, w: 4, case: 'Q' }] });
  const r = run('checks(analyse())');
  assert.ok(r.utils.every(u => Number.isFinite(u.val)), 'finite utilisations');
  assert.ok(r.utils.some(u => /Bending|LTB/.test(u.name)));
});
