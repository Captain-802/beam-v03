// Beam in Wall - pure geometry and load derivation (js/wall/01-wall-state.js,
// js/wall/02-wall-geometry.js), 20 Sep 2026. Every expected number is derived
// by hand in the comments. Coordinates: x_w (mm) from the EXTERNAL face of the
// outer leaf inward; beam +x = +x_w; e_beamv03 = x_w,load - x_w,sc; z_g + =
// above the shear centre. beam-v03 modules are loaded unchanged (the wall
// harness adds js/05-section-view.js for sectionViewGeometry / ShearCentre).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { app } = require('./harness-wall.cjs');
const c = app();
const run = x => { const v = c.run(x); return (v && typeof v === 'object') ? JSON.parse(JSON.stringify(v)) : v; };
const near = (a, b, msg, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, (msg || '') + ': ' + a + ' vs ' + b);
const place = () => run('placeBeam(WALL, activeSection(), S)');
const derive = () => run('wallToLoads(WALL, activeSection(), S)');
const has = (list, re) => list.some(s => re.test(s));

// The demo wall of WALL_DEMO: brick 102.5 | cavity 100 | aerated block 100, W = 302.5.
//   outer leaf [0, 102.5], centre 51.25; cavity [102.5, 202.5]; inner leaf [202.5, 302.5], centre 252.5.
const DEMO_WALL = { t1: 102.5, c: 100, t2: 100, recess: 10, placement: 'flush-inside', ledgers: { outer: [], inner: [], beam: [], other: [] } };
const UB = { family: 'ub', ubKey: '457 x 191 x 82' };   // B = 191.3, D = 460 (js/sections/ub-section-data.js)

test('wallLayout: leaf extents, leaf centres, solid wall drops the cavity', () => {
  c.resetWall(DEMO_WALL);
  const lay = run('wallLayout(WALL)');
  assert.deepEqual([lay.t1, lay.c, lay.t2, lay.W, lay.solid], [102.5, 100, 100, 302.5, false]);
  assert.deepEqual([lay.outer.x1, lay.outer.x2, lay.outer.centre], [0, 102.5, 51.25]);
  assert.deepEqual([lay.cavity.x1, lay.cavity.x2, lay.cavity.w], [102.5, 202.5, 100]);
  assert.deepEqual([lay.inner.x1, lay.inner.x2, lay.inner.centre], [202.5, 302.5, 252.5]);
  assert.equal(run('leafLoadX(WALL, "outer")'), 51.25);
  assert.equal(run('leafLoadX(WALL, "inner")'), 252.5);
  assert.equal(run('leafLoadX(WALL, "beam")'), null);
  // solid: t2 = 0 -> one leaf of t1, a typed c is ignored and flagged
  c.resetWall(Object.assign({}, DEMO_WALL, { t1: 215, c: 100, t2: 0 }));
  const sol = run('wallLayout(WALL)');
  assert.deepEqual([sol.solid, sol.W, sol.c, sol.cIgnored, sol.inner, sol.cavity, sol.leaves.length], [true, 215, 0, true, null, null, 1]);
  assert.equal(run('leafLoadX(WALL, "inner")'), null);
  assert.equal(run('wallLedgerEnabled(WALL, "inner")'), false);
  assert.equal(run('wallLedgerEnabled(WALL, "outer")'), true);
});

test('(1) UB 457x191x82 in the 102.5/100/100 wall: flush inside, flush outside, cavity centre, wall centre, custom', () => {
  c.reset(UB);
  // flush-inside, r = 10: innermost fibre at W - r = 292.5; B/2 = 95.65
  //   x_w,c = 292.5 - 95.65 = 196.85 = x_w,sc (doubly symmetric); outer fibre 196.85 - 95.65 = 101.2
  //   top flange 101.2 .. 292.5: overlaps the outer leaf [0, 102.5] by 1.3 mm and the inner leaf [202.5, 302.5] by 90 mm
  c.resetWall(DEMO_WALL);
  let P = place();
  near(P.xc, 196.85, 'centroid'); near(P.xsc, 196.85, 'shear centre = centroid');
  near(P.xmin, 101.2, 'outer fibre'); near(P.xmax, 292.5, 'inner fibre at W - r');
  near(P.clearances.outer, 101.2, 'clearance to the external face'); near(P.clearances.inner, 10, 'clearance to the internal face = r');
  assert.equal(P.underOuter, true); assert.equal(P.underInner, true);
  near(P.under.outer.width, 1.3, 'bearing on the outer leaf'); near(P.under.inner.width, 90, 'bearing on the inner leaf');
  near(P.B, 191.3); near(P.width, 191.3); near(P.available, 282.5, 'W - 2r');
  assert.deepEqual([P.errors, P.warnings], [[], []]);
  assert.equal(P.ok, true);
  // the outer / inner leaf load eccentricities: e = x_w,load - x_w,sc
  //   outer: 51.25 - 196.85 = -145.6;  inner: 252.5 - 196.85 = +55.65
  near(run('leafLoadX(WALL,"outer")') - P.xsc, -145.6, 'outer leaf e');
  near(run('leafLoadX(WALL,"inner")') - P.xsc, 55.65, 'inner leaf e');
  // flush-outside: outermost fibre at r = 10 -> x_w,c = 10 + 95.65 = 105.65; inner fibre 201.3 (touches nothing: cavity face at 202.5)
  c.resetWall(Object.assign({}, DEMO_WALL, { placement: 'flush-outside' }));
  P = place();
  near(P.xc, 105.65); near(P.xmin, 10); near(P.xmax, 201.3);
  assert.equal(P.underOuter, true); near(P.under.outer.width, 92.5, '102.5 - 10');
  assert.equal(P.underInner, false, '201.3 < 202.5: not under the inner leaf');
  assert.deepEqual(P.errors, []);
  // cavity-centre: x_w,c = t1 + c/2 = 102.5 + 50 = 152.5; fibres 56.85 / 248.15 -> under both leaves (45.65 and 45.65 mm)
  c.resetWall(Object.assign({}, DEMO_WALL, { placement: 'cavity-centre' }));
  P = place();
  near(P.xc, 152.5); near(P.xmin, 56.85); near(P.xmax, 248.15);
  assert.equal(P.underOuter && P.underInner, true);
  near(P.under.outer.width, 45.65); near(P.under.inner.width, 45.65);
  assert.deepEqual(P.errors, []);
  // wall-centre: W/2 = 151.25
  c.resetWall(Object.assign({}, DEMO_WALL, { placement: 'wall-centre' }));
  near(place().xc, 151.25);
  // custom: typed 180 -> fibres 84.35 / 275.65, no error; typed 210 -> inner fibre 305.65 > W - r = 292.5 -> error
  c.resetWall(Object.assign({}, DEMO_WALL, { placement: 'custom', xcCustom: 180 }));
  P = place(); near(P.xc, 180); near(P.xmin, 84.35); near(P.xmax, 275.65); assert.deepEqual(P.errors, []);
  c.resetWall(Object.assign({}, DEMO_WALL, { placement: 'custom', xcCustom: 210 }));
  P = place(); assert.ok(has(P.errors, /inner extreme fibre at x_w = 305\.65 mm is outside the recess limits \[r, W - r\] = \[10, 292\.5\] mm/), P.errors.join(' | '));
  c.resetWall(Object.assign({}, DEMO_WALL, { placement: 'custom', xcCustom: null }));
  assert.ok(has(place().errors, /Custom placement: type the centroid/));
});

test('(2) SHS 100x100 in the 102.5/100/100 wall: cavity centre touches both leaf faces and is under neither; c = 120 gives 10 mm each side; flush inside obeys the 10 mm rule', () => {
  c.reset({ family: 'shs', shsType: 'HF', shsKey: '100x100x5.0' });   // B = D = 100
  // cavity-centre, c = 100: x_w,c = 152.5, fibres 102.5 / 202.5 = the two leaf faces: overlap 0 with each leaf -> under neither (touching is not bearing)
  c.resetWall(Object.assign({}, DEMO_WALL, { placement: 'cavity-centre' }));
  let P = place();
  near(P.xc, 152.5); near(P.xmin, 102.5); near(P.xmax, 202.5);
  assert.equal(P.underOuter, false); assert.equal(P.underInner, false);
  near(P.under.outer.width, 0); near(P.under.inner.width, 0);
  assert.ok(has(P.warnings, /sits under neither leaf/), P.warnings.join(' | '));
  assert.deepEqual(P.errors, [], 'a warning, not an error');
  assert.equal(P.cavity.whole, true); near(P.cavity.clearance, 0, 'zero clearance to the leaf faces');
  near(P.cavity.needed, 120, 'B + 2r = 100 + 20: the cavity that holds it with the recess each side');
  // c = 120: W = 322.5, x_w,c = 102.5 + 60 = 162.5, fibres 112.5 / 212.5 -> 10 mm to each leaf face
  c.resetWall(Object.assign({}, DEMO_WALL, { c: 120, placement: 'cavity-centre' }));
  P = place();
  near(P.xc, 162.5); near(P.xmin, 112.5); near(P.xmax, 212.5); near(P.cavity.clearance, 10);
  assert.deepEqual(P.errors, []);
  // flush-inside, r = 10, c = 100: x_w,max = 292.5, x_w,c = 242.5, x_w,min = 192.5: 90 mm under the inner leaf [202.5, 302.5], not under the outer
  c.resetWall(Object.assign({}, DEMO_WALL, { placement: 'flush-inside' }));
  P = place();
  near(P.xc, 242.5); near(P.xmin, 192.5); near(P.xmax, 292.5); near(P.clearances.inner, 10);
  assert.equal(P.underInner, true); near(P.under.inner.width, 90); assert.equal(P.underOuter, false);
  assert.deepEqual([P.errors, P.warnings], [[], []]);
  // r = 9 breaks the 10 mm rule (error) even though the section would fit
  c.resetWall(Object.assign({}, DEMO_WALL, { placement: 'flush-inside', recess: 9 }));
  assert.ok(has(place().errors, /Recess r = 9 mm is below the 10 mm minimum/));
});

test('(3) PFC 300x100x46: web faces inside -> pfcMirror true, shear centre from sectionViewShearCentre, outline from the Blue Book c_y; leaf load eccentricities by hand', () => {
  // PFC 300x100x46: B = 100, D = 300, tw = 9, esc = 62.7 mm (TP385_PFC, shear centre to centroid), e0 = 36.7 mm
  // (shear centre to the web centreline). Blue Book c_y = esc - e0 + tw/2 = 62.7 - 36.7 + 4.5 = 30.5 mm (3.05 cm;
  // rectangles + fillets by hand 30.52). beam-v03's sectionViewGeometry() draws the web back at -sec.x = -17.0
  // (its table's x is the TORSIONAL index) - flagged 20 Sep 2026, and since the 21 Sep 2026 review the wall module
  // builds the channel outline itself (wallChannelOutline): unmirrored minX = -30.5, maxX = +69.5.
  c.reset({ family: 'pfc', sectionKey: '300x100x46' });
  assert.equal(run('activeSection().tp.esc'), 62.7); assert.equal(run('activeSection().tp.e0'), 36.7);
  const cy = run('wallChannelCy(activeSection())');
  near(cy.cy, 30.5, 'c_y'); assert.match(cy.source, /e_sc - e_0 \+ t_w\/2 = 62\.7 - 36\.7 \+ 4\.5 = 30\.5 mm \(P385 Table A\.3 \/ Blue Book c_y\)/);
  const v03 = run('wallWithMirror(S, false, ()=>sectionViewGeometry(activeSection()))');
  near(v03.minX, -17, 'beam-v03 still draws the web back at -x = -17 (unchanged)');
  const outl = run('wallChannelOutline(activeSection(), false)');
  near(outl.minX, -30.5); near(outl.maxX, 69.5); assert.equal(outl.rects.length, 3); near(outl.rects[0].x1, -30.5); near(outl.rects[0].x2, -21.5, 'web 9 thick');
  const outlM = run('wallChannelOutline(activeSection(), true)');
  near(outlM.minX, -69.5); near(outlM.maxX, 30.5);
  // -- web faces inside: S.pfcMirror true for the placement -> outline mirrored: minX = -69.5, maxX = +30.5;
  //    sectionViewShearCentre gives sc.x = +esc = +62.7 (web at +x, shear centre beyond the web, further inside)
  c.resetWall(Object.assign({}, DEMO_WALL, { pfcWebFaces: 'inside' }));
  const scMirrored = run('wallWithMirror(S, true, ()=>sectionViewShearCentre(activeSection()).x)');
  assert.equal(scMirrored, 62.7);
  const extM = run('wallWithMirror(S, true, ()=>beamExtremes(activeSection(), S))');
  near(extM.minX, -69.5); near(extM.maxX, 30.5); near(extM.outline.cy, 30.5); near(extM.outline.delta, 13.5); assert.equal(extM.outline.differs, true);
  let P = place();
  assert.equal(P.mirror, true);
  // flush-inside r = 10: x_w,max = 292.5 -> x_w,c = 292.5 - 30.5 = 262.0; x_w,min = 262 - 69.5 = 192.5
  //   x_w,sc = 262 + 62.7 = 324.7 (outside the wall: a channel's shear centre lies beyond its web)
  near(P.xc, 262); near(P.xmin, 192.5); near(P.xmax, 292.5); near(P.xsc, 324.7);
  assert.ok(has(P.notes, /shear centre at x_w = 324\.7 mm .* outside the wall thickness/), P.notes.join(' | '));
  assert.ok(has(P.notes, /Channel outline: web back at c_y = 30\.5 mm from the centroid .* beam-v03's own section card and 3D view draw it at 17 mm .* 13\.5 mm off/), P.notes.join(' | '));
  assert.deepEqual(P.errors, []);
  assert.equal(run('S.pfcMirror'), false, 'placeBeam restores S.pfcMirror (no side effect)');
  //   outer leaf e = 51.25 - 324.7 = -273.45;  inner leaf e = 252.5 - 324.7 = -72.2
  c.resetWall(Object.assign({}, DEMO_WALL, { pfcWebFaces: 'inside', ledgers: { outer: [{ type: 'udl', w: 8, case: 'G', label: 'outer' }], inner: [{ type: 'udl', w: 12, case: 'G', label: 'inner' }], beam: [], other: [] } }));
  let R = derive();
  assert.equal(R.pfcMirror, true);
  assert.equal(R.loads[0].e, -273.45); assert.equal(R.loads[1].e, -72.2);
  assert.equal(R.loads[0].wall.xwLoad, 51.25); assert.equal(R.loads[1].wall.xwLoad, 252.5);
  near(R.loads[0].wall.xwSc, 324.7);
  // -- web faces outside (unmirrored): minX = -30.5, maxX = +69.5, sc.x = -62.7
  c.resetWall(Object.assign({}, DEMO_WALL, { pfcWebFaces: 'outside' }));
  assert.equal(run('wallWithMirror(S, false, ()=>sectionViewShearCentre(activeSection()).x)'), -62.7);
  P = place();
  assert.equal(P.mirror, false);
  // flush-inside: x_w,c = 292.5 - 69.5 = 223.0; x_w,min = 223 - 30.5 = 192.5; x_w,sc = 223 - 62.7 = 160.3 (in the cavity)
  near(P.xc, 223); near(P.xmin, 192.5); near(P.xmax, 292.5); near(P.xsc, 160.3);
  //   outer e = 51.25 - 160.3 = -109.05;  inner e = 252.5 - 160.3 = +92.2
  c.resetWall(Object.assign({}, DEMO_WALL, { pfcWebFaces: 'outside', ledgers: { outer: [{ type: 'udl', w: 8, case: 'G' }], inner: [{ type: 'udl', w: 12, case: 'G' }], beam: [], other: [] } }));
  R = derive();
  assert.equal(R.pfcMirror, false);
  assert.equal(R.loads[0].e, -109.05); assert.equal(R.loads[1].e, 92.2);
  // z_g for a 300 deep channel: top flange +150, bottom -150
  assert.equal(R.loads[0].zg, 150);
  // the whole PFC table: c_y against the Blue Book for three sections, and flush outside puts the WEB BACK (not a
  // shifted outline) at r = 10 for every channel: x_w,min = 10 and the drawn web rect starts there
  const cys = {};
  run('PFC.map(s=>s.key)').forEach(k => {
    c.reset({ family: 'pfc', sectionKey: k }); c.resetWall(Object.assign({}, DEMO_WALL, { t1: 215, c: 100, t2: 215, placement: 'flush-outside' }));
    const p = place(); cys[k] = p.ext.outline.cy;
    near(p.xmin, 10, k + ' flush outside'); near(p.xc + p.ext.geom.rects[0].x1, 10, k + ' web back at r');
    near(p.xc - p.ext.outline.cy, 10, k + ' centroid = r + c_y');
    assert.deepEqual(p.errors, [], k);
  });
  near(cys['430x100x64'], 26.2, 'Blue Book 2.62 cm'); near(cys['100x50x10'], 17.3, 'Blue Book 1.73 cm'); near(cys['180x75x20'], 24.1, '49.6 - 28.5 + 3');
});

test('(4) welded bottom plate outL 0 / outR 150 (inside) extends the inner extreme fibre: flush inside puts the plate edge at W - r', () => {
  // UB 457x191x82 with the plate: plateGeom x1 = -95.65 - 0 = -95.65, x2 = 95.65 + 150 = 245.65, total width 341.3
  c.reset(Object.assign({}, UB, { plate: { on: true, side: 'bottom', t: 10, outL: 0, outR: 150 } }));
  const ext = run('beamExtremes(activeSection(), S)');
  near(ext.minX, -95.65); near(ext.maxX, 245.65); near(ext.width, 341.3);
  near(ext.topMinX, -95.65); near(ext.topMaxX, 95.65, 'a bottom plate is no bearing surface');
  // in the 302.5 wall: 341.3 > W - 2r = 282.5 -> error (beam wider than the wall)
  c.resetWall(DEMO_WALL);
  let P = place();
  assert.ok(has(P.errors, /Beam wider than the wall: total width 341\.3 mm \(B = 191\.3 \+ plate outstands 0 \/ 150\) > W - 2r = 282\.5 mm/), P.errors.join(' | '));
  // in a 102.5 / 150 / 215 wall (W = 467.5): flush-inside -> x_w,max = 457.5 = the plate edge, x_w,c = 457.5 - 245.65 = 211.85,
  //   x_w,min = 211.85 - 95.65 = 116.2; top flange 116.2 .. 307.5: not under the outer leaf [0, 102.5], under the inner leaf [252.5, 467.5] over 55 mm
  c.resetWall(Object.assign({}, DEMO_WALL, { c: 150, t2: 215 }));
  P = place();
  near(P.xmax, 457.5, 'plate edge at W - r'); near(P.xc, 211.85); near(P.xmin, 116.2);
  near(P.xTopMax, 307.5); assert.equal(P.underOuter, false); assert.equal(P.underInner, true); near(P.under.inner.width, 55);
  // the bottom plate 116.2 .. 457.5 also lies under the inner leaf [252.5, 467.5] over 205 mm, 150 of them beyond the flange
  near(P.plateX.x1, 116.2); near(P.plateX.x2, 457.5);
  assert.deepEqual([P.under.inner.flange.on, P.under.inner.plate.on], [true, true]);
  near(P.under.inner.plate.width, 205); near(P.under.inner.plate.outstand, 150);
  assert.equal(P.under.inner.text, 'top flange under it over 55 mm + bottom-plate outstand over 150 mm (plate not designed here)');
  assert.equal(P.under.outer.plate.on, false, 'plate starts at 116.2 > t1 = 102.5');
  assert.deepEqual(P.errors, []);
  // the plate underside as a load height: -D/2 - t = -230 - 10 = -240
  assert.equal(run('zgFor("plate", activeSection())'), -240);
  // plate off: 'plate' falls back to the bottom flange
  c.reset(UB);
  assert.equal(run('zgFor("plate", activeSection())'), -230);
});

test('(5) errors and warnings: recess below 10 mm; beam wider than a 215 solid wall; a fibre inside a leaf declared not chased is a warning only', () => {
  c.reset(UB);
  // r = 5 -> error
  c.resetWall(Object.assign({}, DEMO_WALL, { recess: 5 }));
  let P = place();
  assert.ok(has(P.errors, /Recess r = 5 mm is below the 10 mm minimum/), P.errors.join(' | '));
  assert.equal(P.ok, false);
  // r = 9.99 is refused AND printed as 9.99 (21 Sep 2026 review: it used to read "r = 10 mm is below the 10 mm minimum")
  c.resetWall(Object.assign({}, DEMO_WALL, { recess: 9.99 }));
  assert.ok(has(place().errors, /Recess r = 9\.99 mm is below the 10 mm minimum/), place().errors.join(' | '));
  c.resetWall(Object.assign({}, DEMO_WALL, { recess: 10 }));
  assert.deepEqual(place().errors, []);
  // 215 solid wall, r = 10: W - 2r = 195 >= B = 191.3 -> the UB 457x191 FITS (the task brief's "215 < 191.3 + 20"
  // is an arithmetic slip: 191.3 + 20 = 211.3 < 215); it is wider than the wall at r = 15 (185 < 191.3) and the
  // UC 203x203x60 (B = 205.8) is wider at r = 10 (205.8 > 195)
  c.resetWall(Object.assign({}, DEMO_WALL, { t1: 215, c: 0, t2: 0 }));
  P = place();
  assert.deepEqual(P.errors, []); near(P.xc, 205 - 95.65); near(P.xmin, 13.7);
  c.resetWall(Object.assign({}, DEMO_WALL, { t1: 215, c: 0, t2: 0, recess: 15 }));
  assert.ok(has(place().errors, /Beam wider than the wall: total width 191\.3 mm \(B = 191\.3\) > W - 2r = 185 mm/));
  c.reset({ family: 'uc', ucKey: '203 x 203 x 60' });
  c.resetWall(Object.assign({}, DEMO_WALL, { t1: 215, c: 0, t2: 0 }));
  P = place();
  assert.ok(has(P.errors, /Beam wider than the wall: total width 205\.8 mm \(B = 205\.8\) > W - 2r = 195 mm/), P.errors.join(' | '));
  assert.equal(P.ok, false);
  // cavity-centre UB 457 in the demo wall: outer fibre 56.85 inside the outer leaf [0, 102.5] by 45.65 mm
  //   outer leaf not chased -> WARNING only, no error; chased (default) -> nothing
  c.reset(UB);
  c.resetWall(Object.assign({}, DEMO_WALL, { placement: 'cavity-centre', chased1: false }));
  P = place();
  assert.deepEqual(P.errors, []);
  assert.ok(has(P.warnings, /lies 45\.65 mm inside the outer leaf \(0 to 102\.5 mm\), which is declared not chased/), P.warnings.join(' | '));
  assert.equal(P.inLeaf.outer, true); assert.equal(P.inLeaf.inner, true);
  c.resetWall(Object.assign({}, DEMO_WALL, { placement: 'cavity-centre', chased1: true, chased2: false }));
  P = place();
  assert.ok(has(P.warnings, /inside the inner leaf \(202\.5 to 302\.5 mm\), which is declared not chased/));
  assert.equal(P.warnings.length, 1);
  c.resetWall(Object.assign({}, DEMO_WALL, { placement: 'cavity-centre' }));
  assert.deepEqual(place().warnings, []);
  // the report is blocked by errors: wallToLoads still returns the loads but ok = false
  c.resetWall(Object.assign({}, DEMO_WALL, { recess: 5 }));
  const R = derive();
  assert.equal(R.ok, false); assert.ok(R.errors.length >= 1);
});

test('(6) wallToLoads: outer UDL, inner point (bottom flange), beam point, other UDL with typed e / z_g -> beam-v03 loads; eccOn', () => {
  c.reset(Object.assign({}, UB, { L: 4 }));
  c.resetWall(Object.assign({}, DEMO_WALL, { ledgers: {
    outer: [{ type: 'udl', w: 8, case: 'G', height: 'top', label: 'roof' }],
    inner: [{ type: 'point', P: 30, pos: 2, case: 'Q', height: 'bottom', label: 'floor beam B2', ss: 80 },
            { type: 'moment', M: 5, pos: 3, case: 'Q', label: 'end moment' }],
    beam:  [{ type: 'point', P: 10, pos: 1, case: 'Q', label: 'hanger' }],
    other: [{ type: 'udl', w: 5, case: 'G', e: -20, height: 'custom', zgCustom: 100, label: 'cladding rail' }]
  } }));
  const R = derive();
  assert.equal(R.eccOn, true); assert.equal(R.ok, true); assert.equal(R.pfcMirror, false);
  assert.equal(R.loads.length, 5);
  const [o, i, m, b, x] = R.loads;
  // outer: x_w = 51.25, x_w,sc = 196.85 -> e = -145.6; top flange z_g = +D/2 = +230; full span 0-4
  assert.deepEqual([o.type, o.x1, o.x2, o.w, o.case, o.e, o.zg, o.label], ['udl', 0, 4, 8, 'G', -145.6, 230, 'roof']);
  assert.equal(o.wall.ledger, 'outer'); assert.equal(o.wall.xwLoad, 51.25);
  assert.equal(o.wall.text, 'Outer leaf: roof UDL 8 kN/m 0-4 m at x_w = 51.25 mm (outer leaf centre t1/2), e = -145.6 mm, z_g = +230 mm (top flange (+D/2 = +230 mm))');
  // inner point: x_w = 252.5 -> e = +55.65; bottom flange z_g = -230; stiff bearing passed through
  assert.deepEqual([i.type, i.pos, i.P, i.case, i.e, i.zg, i.ss, i.label], ['point', 2, 30, 'Q', 55.65, -230, 80, 'floor beam B2']);
  assert.equal(i.stiff, undefined);
  assert.equal(i.wall.text, 'Inner leaf: floor beam B2 P 30 kN @ 2 m at x_w = 252.5 mm (inner leaf centre t1 + c + t2/2), e = +55.65 mm, z_g = -230 mm (bottom flange (-D/2 = -230 mm))');
  // moment: no e / z_g keys at all
  assert.deepEqual([m.type, m.pos, m.M, m.case], ['moment', 3, 5, 'Q']);
  assert.equal('e' in m, false); assert.equal('zg' in m, false);
  assert.equal(m.wall.text, 'Inner leaf: end moment M 5 kN.m @ 3 m (a moment carries no e / z_g)');
  // beam: through the shear centre -> e = 0, default height top flange -> z_g = +230
  assert.deepEqual([b.type, b.pos, b.P, b.case, b.e, b.zg], ['point', 1, 10, 'Q', 0, 230]);
  assert.equal(b.wall.eSource, 'through the shear centre'); assert.equal(b.wall.xwLoad, 196.85);
  // other: typed e = -20 and z_g = +100 verbatim; x_w of the line = 196.85 - 20 = 176.85 (derived for the sketch)
  assert.deepEqual([x.type, x.x1, x.x2, x.w, x.case, x.e, x.zg], ['udl', 0, 4, 5, 'G', -20, 100]);
  near(x.wall.xwLoad, 176.85); assert.equal(x.wall.eSource, 'typed e');
  // a 'beam' row with a typed x_w = 252.5 (the inner leaf centre) gives the inner-leaf e; a partial UDL typed beyond L = 4
  // is clamped for the sketch / table but REFUSED with its row tag (21 Sep 2026 review: no silent clamp)
  c.resetWall(Object.assign({}, DEMO_WALL, { ledgers: { outer: [], inner: [], beam: [{ type: 'pudl', w: 4, x1: 1, x2: 9, xw: 252.5, case: 'W', height: 'sc' }], other: [] } }));
  let R2 = derive();
  assert.deepEqual([R2.loads[0].type, R2.loads[0].x1, R2.loads[0].x2, R2.loads[0].w, R2.loads[0].e, R2.loads[0].zg, R2.loads[0].case], ['udl', 1, 4, 4, 55.65, 0, 'W']);
  assert.equal(R2.loads[0].wall.eSource, 'typed x_w');
  assert.equal(R2.eccOn, true, 'e = 55.65');
  assert.deepEqual(R2.errors, ['B1 (partial UDL): x1 = 1 m, x2 = 9 m must satisfy 0 <= x1 < x2 <= L = 4 m.']);
  assert.deepEqual(R2.rowErrors, [{ ledger: 'beam', i: 0, keys: ['x1', 'x2'], msg: R2.errors[0] }]);
  assert.equal(R2.ok, false, 'row errors block the report as placement errors do');
  c.resetWall(Object.assign({}, DEMO_WALL, { ledgers: { outer: [], inner: [], beam: [{ type: 'pudl', w: 4, x1: 1, x2: 3, xw: 252.5, case: 'W', height: 'sc' }], other: [] } }));
  R2 = derive(); assert.deepEqual(R2.errors, []); assert.equal(R2.ok, true);
  // the derivation table: one row per load with the seven columns
  const D = run('formatDerivation(wallToLoads(WALL, activeSection(), S), activeSection())');
  assert.equal(D.rows.length, 1);
  assert.deepEqual([D.rows[0].leaf, D.rows[0].xwLoad, D.rows[0].xwSc, D.rows[0].e, D.rows[0].zg], ['On the beam', 252.5, 196.85, 55.65, 0]);
  assert.equal(D.rows[0].beamLoad, 'W UDL 4 kN/m 1-3 m e = +55.65 mm z_g = 0 mm');
  assert.ok(D.placement.some(s => /Centroid x_w,c = 196\.85 mm; shear centre x_w,sc = 196\.85 mm \(= centroid\)/.test(s)), D.placement.join('\n'));
  assert.ok(D.placement.some(s => /outer leaf: top flange under it over 1\.3 mm; inner leaf: top flange under it over 90 mm/.test(s)), D.placement.join('\n'));
});

test('(6b) eccOn: only a symmetric beam load through the shear centre -> false (plain beam-v03 path); the top-flange default alone turns it on', () => {
  c.reset(Object.assign({}, UB, { L: 4 }));
  c.resetWall(Object.assign({}, DEMO_WALL, { ledgers: { outer: [], inner: [], beam: [{ type: 'point', P: 10, pos: 2, case: 'Q', height: 'sc' }], other: [] } }));
  let R = derive();
  assert.equal(R.eccOn, false);
  assert.deepEqual([R.loads[0].e, R.loads[0].zg], [0, 0]);
  // same load at the top flange (the default height): z_g = +230 != 0 -> eccOn true (load height matters for LTB)
  c.resetWall(Object.assign({}, DEMO_WALL, { ledgers: { outer: [], inner: [], beam: [{ type: 'point', P: 10, pos: 2, case: 'Q' }], other: [] } }));
  R = derive();
  assert.equal(R.eccOn, true); assert.equal(R.loads[0].zg, 230);
  // a moment alone never turns it on; no rows -> no loads, eccOn false
  c.resetWall(Object.assign({}, DEMO_WALL, { ledgers: { outer: [], inner: [{ type: 'moment', M: 3, pos: 1, case: 'G' }], beam: [], other: [] } }));
  R = derive(); assert.equal(R.eccOn, false); assert.equal(R.loads.length, 1);
  c.resetWall(DEMO_WALL);
  R = derive(); assert.deepEqual([R.loads.length, R.eccOn, R.swE], [0, false, 0]);
  // a CHANNEL with the same shear-centre beam load: its automatic self-weight is eccentric (e_sw = -/+ e_sc = 62.7 mm for
  // 300x100x46) and beam-v03 adds that torque only when S.eccOn is on (js/04-checks.js anySelfWeightEcc), so eccOn = true
  // with a note (21 Sep 2026 review: the plain path silently dropped 0.151 kN.m of self-weight torque at 8 m)
  c.reset({ family: 'pfc', sectionKey: '300x100x46', L: 4 });
  c.resetWall(Object.assign({}, DEMO_WALL, { ledgers: { outer: [], inner: [], beam: [{ type: 'point', P: 10, pos: 2, case: 'Q', height: 'sc' }], other: [] } }));
  R = derive();
  // beam-v03's selfWeightEccentricity() = centroid from the shear centre: web outside (unmirrored) the shear centre sits
  // at -62.7 from the centroid, so e_sw = +62.7 (toward the inside); web inside the reverse, -62.7
  assert.equal(R.eccOn, true); assert.equal(R.swE, 62.7, 'web outside: e_sw = +e_sc');
  assert.ok(has(R.notes, /Self-weight eccentric: .* e_sw = \+62\.7 mm from the shear centre, so S\.eccOn = true although no ledger load is eccentric/), R.notes.join(' | '));
  c.resetWall(Object.assign({}, DEMO_WALL, { pfcWebFaces: 'inside', ledgers: { outer: [], inner: [], beam: [], other: [] } }));
  R = derive(); assert.deepEqual([R.loads.length, R.eccOn, R.swE], [0, true, -62.7]);
  c.run('(()=>{ const R=wallToLoads(WALL, activeSection(), S); S.loads=R.loads; S.eccOn=R.eccOn; S.pfcMirror=R.pfcMirror; })()');
  const a = run('(()=>{ const a=analyse(); return {tors:!!a.tors, Tmax:a.tors? a.tors.Tmax : null}; })()');
  assert.equal(a.tors, true, 'beam-v03 runs its torsion path on the self-weight alone');
  // T at the support = 1.35 x 0.446355 kN/m x 0.0627 m x L/2 = 1.35 x 0.446355 x 0.0627 x 2 = 0.07556 kN.m
  near(a.Tmax, 1.35 * 0.446355 * 0.0627 * 2, 'self-weight torque at the support', 2e-4);
});

test('(7) solid wall c = 0, t2 = 0: inner ledger disabled and ignored with a note, outer load at t1/2, every placement mode works', () => {
  c.reset(Object.assign({}, UB, { L: 4 }));
  const SOLID = Object.assign({}, DEMO_WALL, { t1: 215, c: 0, t2: 0, ledgers: {
    outer: [{ type: 'udl', w: 9, case: 'G', label: 'wall above' }],
    inner: [{ type: 'udl', w: 99, case: 'G', label: 'should be ignored' }], beam: [], other: [] } });
  // flush-inside r = 10 in W = 215: x_w,max = 205, x_w,c = 205 - 95.65 = 109.35, x_w,min = 13.7; outer load at t1/2 = 107.5 -> e = 107.5 - 109.35 = -1.85
  c.resetWall(SOLID);
  let R = derive();
  assert.equal(run('wallLedgerEnabled(WALL, "inner")'), false);
  assert.equal(R.loads.length, 1, 'inner row not applied');
  assert.deepEqual([R.loads[0].wall.xwLoad, R.loads[0].e, R.loads[0].label], [107.5, -1.85, 'wall above']);
  assert.ok(has(R.notes, /Inner leaf ledger ignored: solid wall \(1 row not applied\)/), R.notes.join(' | '));
  near(R.placement.xc, 109.35); near(R.placement.xmin, 13.7); near(R.placement.xmax, 205);
  assert.equal(R.placement.underOuter, true); near(R.placement.under.outer.width, 191.3, 'whole flange under the single leaf');
  assert.equal(R.placement.underInner, false); assert.equal(R.placement.cavity, null);
  assert.deepEqual([R.errors, R.warnings], [[], []]);
  // flush-outside: x_w,c = 10 + 95.65 = 105.65 -> e = 107.5 - 105.65 = +1.85
  c.resetWall(Object.assign({}, SOLID, { placement: 'flush-outside' }));
  R = derive(); near(R.placement.xc, 105.65); assert.equal(R.loads[0].e, 1.85);
  // cavity-centre on a solid wall falls back to W/2 = 107.5 with a note; wall-centre = 107.5; custom 107.5 -> e = 0 (eccOn stays on through z_g = +230)
  c.resetWall(Object.assign({}, SOLID, { placement: 'cavity-centre' }));
  R = derive(); near(R.placement.xc, 107.5); assert.equal(R.loads[0].e, 0);
  assert.ok(has(R.notes, /Solid wall has no cavity: "cavity centre" places the centroid at the wall centre W\/2 = 107\.5 mm/), R.notes.join(' | '));
  c.resetWall(Object.assign({}, SOLID, { placement: 'wall-centre' }));
  R = derive(); near(R.placement.xc, 107.5); assert.equal(R.loads[0].e, 0); assert.equal(R.eccOn, true);
  c.resetWall(Object.assign({}, SOLID, { placement: 'custom', xcCustom: 107.5 }));
  R = derive(); near(R.placement.xc, 107.5); assert.deepEqual(R.errors, []);
  // a typed cavity with t2 = 0 is dropped (W = t1) and said so
  c.resetWall(Object.assign({}, SOLID, { c: 100 }));
  R = derive(); assert.equal(R.placement.layout.W, 215); assert.ok(has(R.notes, /the typed cavity c = 100 mm is ignored/));
});

test('load heights: zgFor for every choice; unknown choice = top flange; custom text', () => {
  c.reset(UB);   // D = 460
  assert.deepEqual(['top', 'bottom', 'sc', 'custom', 'plate', 'zzz'].map(k => run(`zgFor(${JSON.stringify(k)}, activeSection(), 75)`)), [230, -230, 0, 75, -230, 230]);
  assert.equal(run('zgFor("custom", activeSection(), "abc")'), 0, 'non-numeric custom -> 0');
  assert.equal(run('zgChoiceText("custom", activeSection(), -12.5)'), 'custom (-12.5 mm)');
  assert.equal(run('zgChoiceText("top", activeSection())'), 'top flange (+D/2 = +230 mm)');
  // the plate on top raises the 'plate' height to +D/2 + t
  c.reset(Object.assign({}, UB, { plate: { on: true, side: 'top', t: 12, outL: 20, outR: 20 } }));
  assert.equal(run('zgFor("plate", activeSection())'), 242);
  const ext = run('beamExtremes(activeSection(), S)');
  near(ext.topMinX, -115.65, 'a top plate widens the bearing'); near(ext.topMaxX, 115.65);
});

test('state helpers: wallNewRow defaults per ledger, materials and placement lists, WALL_DEMO integrity', () => {
  const r = run('wallNewRow("inner", "point", 6, {label:"x"})');
  assert.deepEqual([r.type, r.pos, r.x2, r.height, r.case, r.label, r.xw, r.e, r.ss, r.stiff], ['point', 3, 6, 'top', 'G', 'x', null, 0, null, false]);
  assert.equal(run('wallNewRow("other", "udl", 4).height'), 'top', 'the other ledger defaults to the top flange too (owner: "defaulting to top flange"; its typed value is e)');
  assert.equal(run('WALL_DEMO_SPAN'), 4); assert.deepEqual(run('WALL_DEMO_PLATE'), { on: true, side: 'bottom', t: 10, outL: 90, outR: 0 });
  assert.equal(run('wallNewRow("beam","udl","nope").x2'), 4, 'non-numeric span -> 4 m default');
  assert.ok(/^w\d+$/.test(r.id));
  assert.equal(run('WALL_MATERIALS.length'), 11);
  assert.deepEqual(run('WALL_MATERIALS.map(m=>m.label)'), ['Brick 102.5', 'Dense block 100', 'Dense block 140', 'Dense block 215', 'Aerated block 100', 'Aerated block 140', 'Aerated block 215', 'Stone', 'Concrete', 'Timber frame', 'Custom']);
  assert.equal(run('wallMaterial("brick").t'), 102.5); assert.equal(run('wallMaterial("nope").key'), 'custom');
  assert.deepEqual(run('WALL_PLACEMENTS.map(p=>p.key)'), ['flush-inside', 'flush-outside', 'cavity-centre', 'wall-centre', 'custom']);
  assert.deepEqual(run('WALL_HEIGHTS.map(h=>h.key)'), ['top', 'bottom', 'sc', 'plate', 'custom']);
  assert.deepEqual(run('WALL_LEDGERS.map(l=>l.key)'), ['outer', 'inner', 'beam', 'other']);
  assert.equal(run('WALL_RECESS_MIN'), 10);
  // the demo wall runs clean with the DEMO UB 457x191x82 (the worked example of test 1)
  c.reset({}); c.resetWall({});
  const R = derive();
  // (plate off, as beam-v03's DEMO: the outer-leaf load line at 51.25 lies outside the steel 101.2 .. 292.5 -> a warning, not an error)
  assert.deepEqual([R.ok, R.errors, R.loads.length, R.eccOn], [true, [], 3, true]);
  assert.deepEqual(R.warnings, ['O1: load line at x_w = 51.25 mm lies outside the steel (101.2 to 292.5 mm): needs a plate outstand / bearing detail to reach the beam (not designed here).']);
  assert.deepEqual(R.loads.map(l => l.e), [-145.6, 55.65, 55.65]);
});

test('(8) the generated loads run through beam-v03 unchanged: analyse() + checks() + the brief, with the hand moment; the page demo (span 4 m + 90 mm plate outstand) passes', () => {
  // demo wall + DEMO UB 457x191x82, L = 4 m, LTB unrestrained so z_g matters: loads 6 G (outer) + 19.7 G + 19.8 Q (inner)
  //   (the owner's demo rows, 20 Sep 2026); self-weight 82 kg/m x 9.81 / 1000 = 0.8044 kN/m (automatic);
  //   ULS 1.35 (25.7 + 0.8044) + 1.5 x 19.8 = 35.78094 + 29.7 = 65.48094 kN/m
  //   M_max = w L^2 / 8 = 65.48094 x 16 / 8 = 130.96188 kN.m
  c.reset(Object.assign({}, UB, { L: 4, restraint: 'ltb' }));
  c.resetWall({});
  c.run('(()=>{ const R=wallToLoads(WALL, activeSection(), S); S.loads=R.loads; S.eccOn=R.eccOn; S.pfcMirror=R.pfcMirror; })()');
  const out = run('(()=>{ const a=analyse(); const ch=checks(a); return {Mmax:a.Mmax, tors:!!a.tors, n:S.loads.length, ecc:S.eccOn, brief:renderMasterSeriesBrief(a,ch,activeSection())}; })()');
  near(out.Mmax, 130.96188, 'M_max kN.m', 0.002);
  assert.equal(out.tors, true, 'e != 0: beam-v03 runs its torsion path');
  assert.deepEqual([out.n, out.ecc], [3, true]);
  // the page demo: WALL_DEMO_SPAN = 4 m and WALL_DEMO_PLATE (bottom 10 x outL 90 / outR 0) as wallApplyDemoBeam() writes them
  //   plate x1 = -95.65 - 90 = -185.65, x2 = +95.65: width 281.3 <= W - 2r = 282.5; flush inside x_w,c = 196.85 (unchanged),
  //   x_w,min = 196.85 - 185.65 = 11.2 >= r; plate 11.2 .. 292.5 under the outer leaf [0, 102.5] over 91.3 mm, 90 beyond the
  //   flange (101.2 .. 102.5 = 1.3 mm); the outer load line at 51.25 is on the outstand (note, no warning)
  //   plate mass 281.3 x 10 x 7.85e-3 = 22.08 kg/m -> SW = (82 + 22.08) x 9.81 / 1000 = 1.0210 kN/m; plate centroid
  //   cx = (-185.65 + 95.65)/2 = -45 -> e_sw = 22.08 x (-45) / 104.08 = -9.55 mm (beam-v03's selfWeightEccentricity)
  //   ULS w = 1.35 (25.7 + 1.021) + 29.7 = 65.7734 -> M = 131.5467 kN.m
  ['full', 'ltb'].forEach(rs => {
    c.reset(Object.assign({}, UB, { L: 4, restraint: rs, plate: JSON.parse(JSON.stringify(run('WALL_DEMO_PLATE'))) }));
    c.resetWall({});
    const R = derive();
    near(R.placement.xmin, 11.2); near(R.placement.xmax, 292.5); near(R.placement.width, 281.3);
    assert.deepEqual([R.ok, R.errors, R.warnings], [true, [], []]);
    near(R.placement.under.outer.plate.outstand, 90); near(R.placement.under.outer.width, 1.3);
    assert.equal(R.placement.under.outer.text, 'top flange under it over 1.3 mm + bottom-plate outstand over 90 mm (plate not designed here)');
    assert.ok(has(R.notes, /O1: load line at x_w = 51\.25 mm is carried by the bottom-plate outstand \(top flange 101\.2 to 292\.5 mm/), R.notes.join(' | '));
    c.run('(()=>{ const R=wallToLoads(WALL, activeSection(), S); S.loads=R.loads; S.eccOn=R.eccOn; S.pfcMirror=R.pfcMirror; })()');
    const o = run('(()=>{ const a=analyse(); const ch=checks(a); return {Mmax:a.Mmax, sw:selfWeightValue(activeSection()), swE:selfWeightEccentricity(activeSection()), gov:ch.gov.name, val:ch.gov.val, worst:Math.max.apply(null, ch.utils.map(u=>u.val))}; })()');
    near(o.sw, 1.021, 'self-weight with the plate', 5e-4); near(o.swE, -9.55, 'combined self-weight eccentricity', 0.02);
    near(o.Mmax, 131.5467, 'M_max with the plate', 0.003);
    assert.ok(o.worst < 1, rs + ': the demo passes every check, worst ' + o.worst.toFixed(3) + ' (' + o.gov + ')');
  });
  // the brief's load list prints the wall loads in beam-v03's own words (e to the mm, z_g)
  assert.ok(/G UDL 6\.000 0&ndash;4 m e = -146 mm z<sub>g<\/sub> = 230 mm \( kN\/m \)/.test(out.brief), 'outer leaf line');
  assert.ok(/G UDL 19\.700 0&ndash;4 m e = 56 mm z<sub>g<\/sub> = 230 mm/.test(out.brief), 'inner leaf line');
  assert.ok(/G SW 0\.8044 kN\/m 0&ndash;4 m \( automatic \)/.test(out.brief), 'self-weight stays automatic');
  assert.ok(/Section load lines/.test(out.brief), 'the section load-line figure is drawn (eccOn)');
});

test('(9) load heights with the plate: options by plate side, rows left at "plate" normalised when the plate goes off (21 Sep 2026 review)', () => {
  // UB 457x191x82, D = 460: bottom plate t = 10 -> 'plate' = -240 (underside); top plate t = 12 -> +242 (its top)
  c.reset(Object.assign({}, UB, { plate: { on: true, side: 'bottom', t: 10, outL: 0, outR: 150 } }));
  assert.deepEqual(run('wallHeightOptions(activeSection()).map(h=>h.key+":"+h.label)'), ['top:top flange (+D/2)', 'bottom:bottom flange (-D/2)', 'sc:shear centre (0)', 'plate:plate underside (-D/2 - t)', 'custom:custom (mm, + above the shear centre)']);
  assert.equal(run('zgChoiceText("plate", activeSection())'), 'plate underside (-D/2 - t = -240 mm)');
  c.reset(Object.assign({}, UB, { plate: { on: true, side: 'top', t: 12, outL: 20, outR: 20 } }));
  assert.equal(run('wallHeightOptions(activeSection()).find(h=>h.key==="plate").label'), 'plate top (+D/2 + t)');
  assert.equal(run('zgChoiceText("plate", activeSection())'), 'plate top (+D/2 + t = +242 mm)');
  assert.equal(run('zgFor("plate", activeSection())'), 242);
  // plate on: rows keep 'plate'; plate off: they go to the flange the plate sat against (S.plate.side survives the switch-off)
  c.resetWall(Object.assign({}, DEMO_WALL, { ledgers: { outer: [{ type: 'point', P: 5, pos: 2, height: 'plate' }], inner: [{ type: 'udl', w: 5, height: 'plate' }, { type: 'udl', w: 5, height: 'top' }], beam: [], other: [] } }));
  assert.equal(run('wallNormaliseHeights(WALL, activeSection(), S)'), 0);
  assert.equal(run('WALL.ledgers.outer[0].height'), 'plate');
  c.reset(Object.assign({}, UB, { plate: { on: false, side: 'top', t: 12, outL: 20, outR: 20 } }));
  assert.equal(run('wallHeightOptions(activeSection()).some(h=>h.key==="plate")'), false, 'no plate option while the plate is off');
  assert.equal(run('wallNormaliseHeights(WALL, activeSection(), S)'), 2);
  assert.deepEqual(run('[WALL.ledgers.outer[0].height, WALL.ledgers.inner[0].height, WALL.ledgers.inner[1].height]'), ['top', 'top', 'top'], 'a top plate off -> top flange');
  c.resetWall(Object.assign({}, DEMO_WALL, { ledgers: { outer: [{ type: 'point', P: 5, pos: 2, height: 'plate' }], inner: [], beam: [], other: [] } }));
  c.reset(Object.assign({}, UB, { plate: { on: false, side: 'bottom', t: 10, outL: 0, outR: 150 } }));
  assert.equal(run('wallNormaliseHeights(WALL, activeSection(), S)'), 1);
  assert.equal(run('WALL.ledgers.outer[0].height'), 'bottom', 'a bottom plate off -> bottom flange, the z_g the select now shows (-230)');
  assert.equal(derive().loads[0].zg, -230);
});

test('(10) ledger row validation: partial UDL beyond the span or x1 >= x2, a position outside [0, L], blank magnitudes - errors with the row tag and the input keys; the load is still generated (clamped) for the sketch', () => {
  c.reset(Object.assign({}, UB, { L: 8 }));
  c.resetWall(Object.assign({}, DEMO_WALL, { ledgers: {
    outer: [{ type: 'udl', w: 5 }, { type: 'pudl', w: 5, x1: 9, x2: 9.5 }, { type: 'pudl', w: 5, x1: 3, x2: 3 }],
    inner: [{ type: 'point', P: 5, pos: 9 }, { type: 'moment', M: 5, pos: -1 }, { type: 'trap', w1: 0, w2: 5, x1: NaN, x2: 3 }],
    beam: [{ type: 'point', P: NaN, pos: 2 }],
    other: [{ type: 'udl', w: '', e: 'abc', height: 'custom', zgCustom: 'x' }] } }));
  const R = derive();
  assert.deepEqual(R.errors, [
    'O2 (partial UDL): x1 = 9 m, x2 = 9.5 m must satisfy 0 <= x1 < x2 <= L = 8 m.',
    'O3 (partial UDL): x1 = 3 m, x2 = 3 m must satisfy 0 <= x1 < x2 <= L = 8 m.',
    'I1 (point load): position 9 m must lie within 0 to L = 8 m.',
    'I2 (applied moment): position -1 m must lie within 0 to L = 8 m.',
    'I3 (trapezoidal load): x1 and x2 must be numbers (m).',
    'B1 (point load): P is not a number.',
    'X1 (UDL): w is not a number.',
    'X1: e is not a number (mm).',
    'X1: custom z_g is not a number (mm).'
  ]);
  assert.deepEqual(R.rowErrors.map(e => [e.ledger, e.i, e.keys.join('+')]), [['outer', 1, 'x1+x2'], ['outer', 2, 'x1+x2'], ['inner', 0, 'pos'], ['inner', 1, 'pos'], ['inner', 2, 'x1+x2'], ['beam', 0, 'P'], ['other', 0, 'w'], ['other', 0, 'e'], ['other', 0, 'zgCustom']]);
  assert.equal(R.ok, false); assert.equal(R.placement.ok, true, 'the placement itself is fine');
  assert.equal(R.loads.length, 8, 'every row still yields a (clamped) load for the sketch and the table');
  assert.deepEqual([R.loads[1].x1, R.loads[1].x2, R.loads[3].pos, R.loads[4].pos], [8, 8, 8, 0], 'clamped to [0, L]');
  // clean rows: no errors, ok
  c.resetWall(Object.assign({}, DEMO_WALL, { ledgers: { outer: [{ type: 'pudl', w: 5, x1: 0, x2: 8 }], inner: [{ type: 'point', P: 5, pos: 8 }, { type: 'moment', M: 5, pos: 0 }], beam: [], other: [{ type: 'udl', w: 2, e: -20, height: 'custom', zgCustom: 100 }] } }));
  const R2 = derive(); assert.deepEqual([R2.errors, R2.rowErrors, R2.ok], [[], [], true]);
});

test('(11) load-line plausibility: a leaf / typed-x_w beam load outside the steel is warned, on a bottom-plate outstand noted, other loads never judged (21 Sep 2026 review)', () => {
  // the reviewer's browser case: PFC 300x100x46 web inside, bottom plate 10 x (0 / 120), cavity centre in 102.5 / 180 / 100 (W = 382.5)
  //   outline mirrored -69.5 .. +30.5, plate x1 = -69.5, x2 = 150.5; x_w,c = 102.5 + 90 = 192.5 -> steel 123 .. 343, top flange 123 .. 223
  //   inner leaf [282.5, 382.5]: top flange NOT under it, plate under it over 343 - 282.5 = 60.5 mm (all outstand)
  //   outer leaf [0, 102.5]: nothing (123 > 102.5); inner load line 332.5 on the outstand (note); outer load line 51.25 outside (warning)
  c.reset({ family: 'pfc', sectionKey: '300x100x46', plate: { on: true, side: 'bottom', t: 10, outL: 0, outR: 120 } });
  c.resetWall(Object.assign({}, DEMO_WALL, { c: 180, placement: 'cavity-centre', pfcWebFaces: 'inside', ledgers: {
    outer: [{ type: 'udl', w: 4, case: 'G' }], inner: [{ type: 'udl', w: 9, case: 'G' }], beam: [{ type: 'point', P: 5, pos: 2, xw: 360 }, { type: 'point', P: 5, pos: 2 }],
    other: [{ type: 'point', P: 3, pos: 1, e: 500 }] } }));
  const R = derive(), P = R.placement;
  near(P.xc, 192.5); near(P.xmin, 123); near(P.xmax, 343); near(P.xTopMin, 123); near(P.xTopMax, 223);
  near(P.ext.plate.x1, -69.5, 'plate rebuilt on the corrected outline'); near(P.ext.plate.x2, 150.5);
  assert.deepEqual([P.underOuter, P.underInner, P.under.inner.flange.on, P.under.inner.plate.on], [false, true, false, true]);
  near(P.under.inner.plate.outstand, 60.5);
  assert.equal(P.under.inner.text, 'bottom-plate outstand under it over 60.5 mm, no top flange under it (plate not designed here)');
  assert.ok(!has(P.warnings, /sits under neither leaf/), 'the plate outstand IS a bearing: ' + P.warnings.join(' | '));
  assert.deepEqual(R.errors, []);
  assert.deepEqual(R.warnings, [
    'O1: load line at x_w = 51.25 mm lies outside the steel (123 to 343 mm): needs a plate outstand / bearing detail to reach the beam (not designed here).',
    'B1: load line at x_w = 360 mm lies outside the steel (123 to 343 mm): needs a plate outstand / bearing detail to reach the beam (not designed here).'
  ]);
  assert.ok(has(R.notes, /^I1: load line at x_w = 332\.5 mm is carried by the bottom-plate outstand \(top flange 123 to 223 mm; plate outstand bending \/ weld not designed here\)\.$/), R.notes.join(' | '));
  assert.ok(!R.warnings.concat(R.notes).some(t => /^X1|^B2/.test(t)), 'the shear-centre beam load and the other load are not judged');
  // the derivation table lists the placement note on the channel outline and the self-weight note is absent (the loads are eccentric)
  const D = run('formatDerivation(wallToLoads(WALL, activeSection(), S), activeSection())');
  assert.ok(D.placement.some(s => /inner leaf: bottom-plate outstand under it over 60\.5 mm, no top flange under it/.test(s)), D.placement.join('\n'));
  assert.ok(D.placement.some(s => /Bearing \(top flange x_w 123 to 223 mm, bottom plate 123 to 343 mm\)/.test(s)), D.placement.join('\n'));
  assert.deepEqual(D.warnings, R.warnings); assert.deepEqual(D.errors, []);
});
