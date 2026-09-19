'use strict';
/* ===========================================================================
   Single-span verification library (19 Sep 2026 scope: ONE span, End 1 at
   x = 0 to End 2 at x = L, seven restraint flags per end)
   ---------------------------------------------------------------------------
   Each case is {id, title, overrides, expect, tags[, pair][, expectError]}:
     overrides   - the fields tests/harness.cjs reset() merges over DEMO
                   (js/03-state-ui.js): code, family, ubKey/ucKey/sectionKey/
                   shsKey/rhsKey, shsType, grade, L (m), ends {e1, e2} (the
                   seven DOF flags ux/uy/uz/rx/ry/rz/warp + holdDown, ss, stiff
                   of each end, built with SS() / FIXFIX() / PROPPED() / CANT()
                   / GF() / PG() / ENDS(preset, {e1, e2})), hinges [{pos}],
                   loads (point/udl/trap/moment, case G/Q/W/E, optional e mm,
                   zg mm, ss mm, stiff), combos, axial (kN, +compression), Mz
                   (kN.m), leFactor (blank = strut lengths from the end
                   fixities), destab, za (mm), restraint 'full'|'ltb', eccOn,
                   mcrMethod, ltbRestraints [{pos,v,phi,vp,phip}], LT, divisor.
     expect      - trigger ids from docs/EC3_BEAM_TRIGGER_LIST.md the case is
                   designed to exercise (derived from the inputs + tags).
     pair        - {base, relation: 'ge', why}: the runner asserts that the
                   eigen M_cr of this case is >= that of the base case (same
                   section, length and loads; only the end flags differ).
     expectError - a string the thrown message (HTML stripped) must contain:
                   the runner asserts that analyse() throws (group ERR).
   Every LTB case (restraint 'ltb') is run by tests/batch/run-batch.cjs with
   BOTH mcrMethod values; mcrMethod in overrides is only the case default.
   Loads are sized so that the governing utilisation of the eigen run lies
   mostly in the 0.5-0.95 band; the cases tagged 'heavy' are deliberately
   overloaded so that FAIL verdicts and the blocking messages are exercised.
   Units in this file: m, kN, kN/m, kN.m, mm for e / zg / za / ss.

   Groups (ids):
     UB, UC, PFC, SHS, RHS  every preset (SS, fixed-fixed, fixed-pinned,
                            cantilever, guided-fixed, pinned-guided) per
                            family x the load types
     ECC  eccentric loads (torsion) on PFC and UB under the presets
     ZG   load height +/- D/2 under the presets
     AX   axial compression / tension, U_x at one end and at both, the
          end-fixity strut lengths of every preset
     MZ   minor-axis moment (biaxial) under the presets
     RES  intermediate lateral restraints under the presets
     HNG  internal hinges (fixed-hinge-pinned, fixed-hinge-fixed, guided)
     CUS  custom end flag sets (R_z both ends, warping both ends, End 2
          twist-free, lateral cantilever, mixed in-plane / LTB types)
     WEB, UPL, TFB, HSV, TOR, AEF, BIX  the 19 Sep 2026 gap-closure groups
          (each check decides the verdict both ways; the ids and inputs of
          the cases pinned by tests/campaign.test.cjs are unchanged)
     ERR  invalid layouts that must throw (mechanisms, torque with no twist
          restraint, N_Ed with U_x free at both ends, ...)
   =========================================================================== */

// ---- load builders ----
const P    = (pos, P, cs = 'Q', x = {}) => Object.assign({ type: 'point', pos, P, case: cs }, x);
const UDL  = (x1, x2, w, cs = 'Q', x = {}) => Object.assign({ type: 'udl', x1, x2, w, case: cs }, x);
const TRAP = (x1, x2, w1, w2, cs = 'Q', x = {}) => Object.assign({ type: 'trap', x1, x2, w1, w2, case: cs }, x);
const MOM  = (pos, M, cs = 'Q') => ({ type: 'moment', pos, M, case: cs });

// ---- end builders (the app's own presets through the harness: js/03-state-ui.js endsPreset) ----
const { app } = require('../harness.cjs');
const ctxEnds = app();
const ENDS    = (preset, overrides) => ctxEnds.ends(preset, overrides);
const SS      = (o) => ENDS('ss', o);
const FIXFIX  = (o) => ENDS('fixed-fixed', o);
const PROPPED = (o) => ENDS('fixed-pinned', o);   // End 1 fixed, End 2 pinned
const CANT    = (o) => ENDS('cantilever', o);     // End 1 fixed (warping restrained), End 2 free
const GF      = (o) => ENDS('guided-fixed', o);   // End 1 fixed, End 2 guided (R_y held, U_z free)
const PG      = (o) => ENDS('pinned-guided', o);  // End 1 pinned, End 2 guided

// ---- intermediate lateral restraints (v and phi held, v' and phi' free) ----
const R = (...pos) => pos.map(p => ({ pos: p, v: true, phi: true, vp: false, phip: false }));

// ---- combinations ----
const ULS = (id, label, G, Q, W = 0, E = 0) => ({ id, label, factors: { G, Q, W, E }, sls: false, on: true });
const SLS = (id, label, G, Q, W = 0, E = 0) => ({ id, label, factors: { G, Q, W, E }, sls: true, on: true });
const GQ = () => [ULS('c1', 'ULS: 1.35G + 1.5Q (Eq 6.10)', 1.35, 1.5), SLS('s1', 'SLS: Variable actions only (NA 2.23)', 0, 1.0)];
// wind as an additional / leading action; the W load itself is negative (uplift)
const GQW = () => [
  ULS('c1', 'ULS: 1.35G + 1.5Q', 1.35, 1.5),
  ULS('c2', 'ULS: 1.35G + 1.05Q + 1.5W', 1.35, 1.05, 1.5),
  ULS('c3', 'ULS: 1.0G + 1.5W (uplift)', 1.0, 0, 1.5),
  SLS('s1', 'SLS: Q', 0, 1.0), SLS('s2', 'SLS: W', 0, 0, 1.0)];
// reversing wind through a NEGATIVE factor on a positive (downward) W load
const GQWneg = () => [
  ULS('c1', 'ULS: 1.35G + 1.5Q', 1.35, 1.5),
  ULS('c2', 'ULS: 1.0G - 1.5W (reversed wind)', 1.0, 0, -1.5),
  SLS('s1', 'SLS: Q', 0, 1.0), SLS('s2', 'SLS: -W', 0, 0, -1.0)];

// ---- section pickers ----
const UB  = k => ({ family: 'ub', ubKey: k });
const UC  = k => ({ family: 'uc', ucKey: k });
const PFC = k => ({ family: 'pfc', sectionKey: k });
const SHS = (k, t = 'HF') => ({ family: 'shs', shsType: t, shsKey: k });
const RHS = k => ({ family: 'rhs', rhsKey: k });

// ---- expected-trigger derivation (docs/EC3_BEAM_TRIGGER_LIST.md ids) ----
function deriveTriggers(o, tags) {
  const t = new Set(['1.3', '1.9', '2.1', '2.3', '2.16', '3.19']);
  const e1 = (o.ends || {}).e1 || {}, e2 = (o.ends || {}).e2 || {}, loads = o.loads || [], hinges = o.hinges || [];
  const isCant = !!(e1.uz && e1.ry && !e2.uz && !e2.ry);
  const anyFixed = !!(e1.ry || e2.ry);
  const box = o.family === 'shs' || o.family === 'rhs';
  if (isCant || hinges.length || loads.some(l => l.type === 'moment')) t.add('1.2');
  if (hinges.length) t.add('1.4');
  if (loads.some(l => l.type === 'point') || hinges.length || anyFixed) t.add('2.10');
  const ax = +o.axial || 0;
  if (ax > 0) { t.add('2.11'); t.add('3.9'); t.add('3.12'); if (o.family === 'pfc') { t.add('3.10'); t.add('2.15'); } }
  if (ax < 0) { t.add('2.11'); t.add('2.25'); }
  const mz = Math.abs(+o.Mz || 0) > 0;
  if (mz) { t.add('2.12'); t.add('3.20'); if (o.restraint === 'ltb') t.add('3.12'); }
  const ecc = !!o.eccOn && (loads.some(l => Math.abs(+l.e || 0) > 0) || o.family === 'pfc');
  if (ecc) { ['1.1', '2.6', '2.7', '2.8', '3.21'].forEach(x => t.add(x)); if (o.restraint === 'ltb' && !box) t.add('3.8'); }
  if (!!o.eccOn && (Math.abs(+o.za || 0) > 0 || loads.some(l => Math.abs(+l.zg || 0) > 0))) t.add('1.1');
  if (Math.abs(+o.za || 0) > 0) t.add('1.1');
  if (o.restraint === 'ltb') {
    ['3.1', '3.2', '3.3', '3.6'].forEach(x => t.add(x));
    if (o.family === 'ub' || o.family === 'uc') t.add('3.5'); else t.add('3.4');
    if ((o.ltbRestraints || []).length) t.add('3.17');
  } else t.add('3.1');
  if (o.shsType === 'CF' && o.family === 'shs') t.add('3.27');
  (tags || []).forEach(x => { if (/^\d+\.\d+$/.test(x)) t.add(x); });
  // a tag '-id' removes a derived id: the case is designed to exercise a BLOCK that
  // stops the check from running (e.g. the Class-4 stress-gradient block keeps 3.9 / 3.12 out)
  (tags || []).forEach(x => { if (/^-\d+\.\d+$/.test(x)) t.delete(x.slice(1)); });
  return [...t].sort((a, b) => { const [a1, a2] = a.split('.').map(Number), [b1, b2] = b.split('.').map(Number); return a1 - b1 || a2 - b2; });
}

const cases = [];
// Stiff bearing length declared at every vertically held library end unless the
// case sets its own (19 Sep 2026 review: the engine no longer assumes a seating -
// a blank s_s is the lower bound 0 and a station failing there is NOT VERIFIED -
// so the library states a typical 100 mm seating explicitly; the point loads keep
// s_s = 0).
const LIB_SS = 100;
function mk(id, title, sec, ov, tags = [], extra = {}) {
  const overrides = Object.assign({ code: 'EC3', grade: 'S275', restraint: 'ltb', mcrMethod: 'eigen', hinges: [], combos: GQ() }, sec, ov);
  if (!overrides.ends) throw new Error(id + ': ends missing');
  if (!overrides.loads) throw new Error(id + ': loads missing');
  ['e1', 'e2'].forEach(k => { const e = overrides.ends[k]; if (e.uz && e.ss == null) e.ss = LIB_SS; });
  cases.push(Object.assign({ id, title, overrides, expect: deriveTriggers(overrides, tags), tags }, extra));
}
/* An invalid layout: analyse() must throw a message containing `expectError`
   (HTML stripped). Run once by the runner (the throw precedes any Mcr method). */
function mkErr(id, title, sec, ov, expectError, tags = []) {
  const overrides = Object.assign({ code: 'EC3', grade: 'S275', restraint: 'ltb', mcrMethod: 'eigen', hinges: [], combos: GQ() }, sec, ov);
  if (!overrides.ends) throw new Error(id + ': ends missing');
  if (!overrides.loads) throw new Error(id + ': loads missing');
  ['e1', 'e2'].forEach(k => { const e = overrides.ends[k]; if (e.uz && e.ss == null) e.ss = LIB_SS; });
  cases.push({ id, title, overrides, expect: [], tags: ['expect-error'].concat(tags), expectError });
}

/* =========================================================================
   UB - universal beams: the six presets x the load types
   ========================================================================= */
// ---- simply supported (fork ends) ----
mk('UB-01', 'UB 457x191x82, 8 m SS, full UDL G+Q (demo), fully restrained', UB('457 x 191 x 82'),
  { L: 8, ends: SS(), loads: [UDL(0, 8, 19.7, 'G'), UDL(0, 8, 19.8, 'Q')], restraint: 'full' }, ['demo']);
mk('UB-02', 'UB 457x191x82, 8 m SS, full UDL G+Q (demo), unrestrained (deliberately heavy)', UB('457 x 191 x 82'),
  { L: 8, ends: SS(), loads: [UDL(0, 8, 19.7, 'G'), UDL(0, 8, 19.8, 'Q')] }, ['demo', 'heavy']);
mk('UB-03', 'UB 305x165x40, 6 m SS, full UDL, unrestrained, load at shear centre (base of the CUS-01 / CUS-02 pairs)', UB('305 x 165 x 40'),
  { L: 6, ends: SS(), loads: [UDL(0, 6, 5, 'G'), UDL(0, 6, 6, 'Q')] });
mk('UB-04', 'UB 305x165x40, 6 m SS, full UDL, top-flange loading zg = +D/2', UB('305 x 165 x 40'),
  { L: 6, ends: SS(), eccOn: true, za: 152, loads: [UDL(0, 6, 5, 'G', { e: 0, zg: 152 }), UDL(0, 6, 6, 'Q', { e: 0, zg: 152 })] }, ['zg-top']);
mk('UB-05', 'UB 305x165x40, 6 m SS, full UDL, bottom-flange loading zg = -D/2', UB('305 x 165 x 40'),
  { L: 6, ends: SS(), eccOn: true, za: -152, loads: [UDL(0, 6, 6, 'G', { e: 0, zg: -152 }), UDL(0, 6, 8, 'Q', { e: 0, zg: -152 })] }, ['zg-bottom']);
mk('UB-06', 'UB 406x178x54, 7 m SS, central point load with a lateral restraint at the load', UB('406 x 178 x 54'),
  { L: 7, ends: SS(), loads: [P(3.5, 20, 'G'), P(3.5, 60, 'Q')], ltbRestraints: R(3.5) });
mk('UB-07', 'UB 406x178x54, 7 m SS, central point load, unrestrained (base of the CUS-03 / CUS-04 pairs)', UB('406 x 178 x 54'),
  { L: 7, ends: SS(), loads: [P(3.5, 12, 'G'), P(3.5, 32, 'Q')] });
mk('UB-08', 'UB 533x210x92, 10 m SS, two point loads at 3 and 7 m + UDL, restraints at third points', UB('533 x 210 x 92'),
  { L: 10, ends: SS(), loads: [UDL(0, 10, 5, 'G'), P(3, 20, 'G'), P(7, 20, 'G'), P(3, 50, 'Q'), P(7, 50, 'Q')], ltbRestraints: R(10 / 3, 20 / 3) });
mk('UB-09', 'UB 254x146x31, 5 m SS, partial UDL 1-4 m + full G', UB('254 x 146 x 31'),
  { L: 5, ends: SS(), loads: [UDL(0, 5, 3, 'G'), UDL(1, 4, 11, 'Q')] });
mk('UB-10', 'UB 356x171x45, 7 m SS, triangular load rising 0 -> 11 kN/m', UB('356 x 171 x 45'),
  { L: 7, ends: SS(), loads: [UDL(0, 7, 3, 'G'), TRAP(0, 7, 0, 11, 'Q')] });
mk('UB-11', 'UB 356x171x45, 7 m SS, triangular load falling 26 -> 0 kN/m, fully restrained', UB('356 x 171 x 45'),
  { L: 7, ends: SS(), restraint: 'full', loads: [UDL(0, 7, 6, 'G'), TRAP(0, 7, 26, 0, 'Q')] });
mk('UB-12', 'UB 457x152x52, 6 m SS, trapezoidal 6 -> 16 kN/m', UB('457 x 152 x 52'),
  { L: 6, ends: SS(), loads: [UDL(0, 6, 4, 'G'), TRAP(0, 6, 6, 16, 'Q')] });
mk('UB-13', 'UB 610x229x125, 12 m SS, full UDL, restraints at third points', UB('610 x 229 x 125'),
  { L: 12, ends: SS(), loads: [UDL(0, 12, 10, 'G'), UDL(0, 12, 14, 'Q')], ltbRestraints: R(4, 8) });
mk('UB-16', 'UB 914x305x224, 16 m SS deep beam, full UDL, fully restrained', UB('914 x 305 x 224'),
  { L: 16, ends: SS(), restraint: 'full', loads: [UDL(0, 16, 20, 'G'), UDL(0, 16, 25, 'Q')] });
mk('UB-22', 'UB 610x178x82, 9 m SS, full UDL (h/b > 3.1, curve d), deliberately heavy', UB('610 x 178 x 82'),
  { L: 9, ends: SS(), loads: [UDL(0, 9, 8, 'G'), UDL(0, 9, 8, 'Q')] }, ['heavy']);
mk('UB-25', 'UB 356x127x33, 6 m SS, equal end couples (uniform moment, psi = +1)', UB('356 x 127 x 33'),
  { L: 6, ends: SS(), loads: [MOM(0, 24, 'Q'), MOM(6, -24, 'Q')] });
mk('UB-26', 'UB 356x127x33, 6 m SS, single end couple (linear gradient, psi = 0); End 2 lifts at ULS without a hold-down', UB('356 x 127 x 33'),
  { L: 6, ends: SS(), loads: [MOM(0, 40, 'Q')] }, ['uplift']);
mk('UB-27', 'UB 457x191x82, 8 m SS, UDL + in-span couple at 4 m + point load at 2 m (mixed)', UB('457 x 191 x 82'),
  { L: 8, ends: SS(), loads: [UDL(0, 8, 6, 'G'), UDL(0, 8, 6, 'Q'), MOM(4, 72, 'Q'), P(2, 18, 'Q')] });
mk('UB-28', 'UB 406x178x74, 6 m SS, full UDL + axial compression 400 kN (~0.15 Npl), U_x at End 1 only', UB('406 x 178 x 74'),
  { L: 6, ends: SS(), axial: 400, loads: [UDL(0, 6, 6, 'G'), UDL(0, 6, 8, 'Q')] });
mk('UB-29', 'UB 305x165x40, 5 m SS, full UDL + axial tension 300 kN, fully restrained', UB('305 x 165 x 40'),
  { L: 5, ends: SS(), restraint: 'full', axial: -300, loads: [UDL(0, 5, 14, 'G'), UDL(0, 5, 18, 'Q')] });
mk('UB-30', 'UB 254x146x31, 5 m SS, full UDL + minor-axis moment Mz = 8 kN.m, fully restrained', UB('254 x 146 x 31'),
  { L: 5, ends: SS(), restraint: 'full', Mz: 8, loads: [UDL(0, 5, 4.5, 'G'), UDL(0, 5, 6, 'Q')] });
mk('UB-31', 'UB 254x146x31, 5 m SS, full UDL + Mz = 8 kN.m, unrestrained (biaxial + LTB)', UB('254 x 146 x 31'),
  { L: 5, ends: SS(), Mz: 8, loads: [UDL(0, 5, 3.5, 'G'), UDL(0, 5, 4.5, 'Q')] });
mk('UB-32', 'UB 457x191x82, 8 m SS, full UDL at e = 95 mm (flange half-width), unrestrained', UB('457 x 191 x 82'),
  { L: 8, ends: SS(), eccOn: true, loads: [UDL(0, 8, 4, 'G', { e: 95, zg: 0 }), UDL(0, 8, 5, 'Q', { e: 95, zg: 0 })] }, ['ecc-large']);
mk('UB-33', 'UB 457x191x82, 8 m SS, full UDL at e = 20 mm (small), fully restrained', UB('457 x 191 x 82'),
  { L: 8, ends: SS(), restraint: 'full', eccOn: true, loads: [UDL(0, 8, 16, 'G', { e: 20 }), UDL(0, 8, 19, 'Q', { e: 20 })] }, ['ecc-small']);
mk('UB-34', 'UB 203x102x23, 4 m SS, two point loads near the ends (0.3 and 3.7 m)', UB('203 x 102 x 23'),
  { L: 4, ends: SS(), loads: [P(0.3, 64, 'Q'), P(3.7, 64, 'Q')] });
mk('UB-35', 'UB 914x419x388, 3 m SS, central 3000 kN point load (high shear at the maximum moment), restrained', UB('914 x 419 x 388'),
  { L: 3, ends: SS(), restraint: 'full', loads: [P(1.5, 3000, 'Q')] }, ['2.10']);
mk('UB-36', 'UB 178x102x19, 4 m SS, UDL G+Q with upward wind W (uplift combinations, no hold-down)', UB('178 x 102 x 19'),
  { L: 4, ends: SS(), combos: GQW(), loads: [UDL(0, 4, 2.5, 'G'), UDL(0, 4, 5.5, 'Q'), UDL(0, 4, -8, 'W')] }, ['uplift']);
mk('UB-37', 'UB 152x89x16, 3.5 m SS, UDL G+Q with wind reversed through a negative factor', UB('152 x 89 x 16'),
  { L: 3.5, ends: SS(), combos: GQWneg(), loads: [UDL(0, 3.5, 2.5, 'G'), UDL(0, 3.5, 5.5, 'Q'), UDL(0, 3.5, 6, 'W')] }, ['uplift']);
mk('UB-38', 'UB 127x76x13, 3 m SS, central point load, fully restrained (smallest UB)', UB('127 x 76 x 13'),
  { L: 3, ends: SS(), restraint: 'full', loads: [P(1.5, 12.5, 'Q')] });
mk('UB-39', 'UB 838x292x176, 14 m SS, full UDL, quarter-point restraints, top-flange loading', UB('838 x 292 x 176'),
  { L: 14, ends: SS(), eccOn: true, za: 417, loads: [UDL(0, 14, 20, 'G', { e: 0, zg: 417 }), UDL(0, 14, 25, 'Q', { e: 0, zg: 417 })], ltbRestraints: R(3.5, 7, 10.5) }, ['zg-top']);
mk('UB-40', 'UB 533x210x92, 8 m SS, full UDL, LE factor 1.2 + destabilising switch with every z_g = 0 (contradictory input: the eigen route blocks PASS since the 19 Sep 2026 campaign, the closed form applies L_E x 1.2)', UB('533 x 210 x 92'),
  { L: 8, ends: SS(), leFactor: 1.2, destab: true, loads: [UDL(0, 8, 9, 'G'), UDL(0, 8, 11, 'Q')] });
mk('UB-42', 'UB 356x171x45, 8 m SS, full UDL, grade S355', UB('356 x 171 x 45'),
  { L: 8, ends: SS(), grade: 'S355', loads: [UDL(0, 8, 2.5, 'G'), UDL(0, 8, 3.2, 'Q')] });
mk('UB-44', 'UB 406x178x54, 7 m SS, point load at 0.35L, top-flange loading zg = +D/2 (no published C2: standard route blocked)', UB('406 x 178 x 54'),
  { L: 7, ends: SS(), eccOn: true, za: 201, loads: [P(2.45, 10, 'G', { e: 0, zg: 201 }), P(2.45, 28, 'Q', { e: 0, zg: 201 })] }, ['zg-top']);
mk('UB-52', 'UB 533x210x92, 8 m SS, full UDL on the top flange z_g = +D/2 with the LE factor 1.2 + destabilising switch also ticked (UB-40 with the load height entered) - design intent: eigen FAIL 1.06 (load height carried by z_g); standard route counts the height twice (C2 z_g and x1.2 L_E, advisory)', UB('533 x 210 x 92'),
  { L: 8, ends: SS(), leFactor: 1.2, destab: true, eccOn: true, za: 266, loads: [UDL(0, 8, 9, 'G', { e: 0, zg: 266 }), UDL(0, 8, 11, 'Q', { e: 0, zg: 266 })] }, ['zg-top', 'destab']);
// ---- fixed-fixed (U_z + R_y + U_y + R_x + R_z both ends: laterally clamped, warping free) ----
mk('UB-21', 'UB 406x140x39, 8 m fixed-fixed, full UDL (h/b > 2, curve c)', UB('406 x 140 x 39'),
  { L: 8, ends: FIXFIX(), loads: [UDL(0, 8, 5, 'G'), UDL(0, 8, 6, 'Q')] });
mk('UB-43', 'UB 406x140x39, 8 m fixed-fixed, full UDL, top-flange loading zg = +D/2 (SN003a fixed-ended row, C2 = 1.554)', UB('406 x 140 x 39'),
  { L: 8, ends: FIXFIX(), eccOn: true, za: 203, loads: [UDL(0, 8, 2.4, 'G', { e: 0, zg: 203 }), UDL(0, 8, 2.9, 'Q', { e: 0, zg: 203 })] }, ['zg-top']);
mk('UB-53', 'UB 457x191x82, 8 m fixed-fixed, central point load (closed forms PL/8, PL^3/192EI)', UB('457 x 191 x 82'),
  { L: 8, ends: FIXFIX(), loads: [P(4, 60, 'G'), P(4, 150, 'Q')] });
mk('UB-54', 'UB 533x210x92, 10 m fixed-fixed, trapezoidal 8 -> 20 kN/m + G', UB('533 x 210 x 92'),
  { L: 10, ends: FIXFIX(), loads: [UDL(0, 10, 8, 'G'), TRAP(0, 10, 8, 20, 'Q')] });
mk('UB-55', 'UB 356x171x45, 7 m fixed-fixed, triangular load rising 0 -> 20 kN/m', UB('356 x 171 x 45'),
  { L: 7, ends: FIXFIX(), loads: [UDL(0, 7, 4, 'G'), TRAP(0, 7, 0, 20, 'Q')] });
mk('UB-56', 'UB 305x165x40, 6 m fixed-fixed, two point loads near the ends (0.5 and 5.5 m)', UB('305 x 165 x 40'),
  { L: 6, ends: FIXFIX(), loads: [P(0.5, 90, 'Q'), P(5.5, 90, 'Q')] });
mk('UB-57', 'UB 254x146x31, 5 m fixed-fixed, in-span couple 40 kN.m at 2 m + UDL', UB('254 x 146 x 31'),
  { L: 5, ends: FIXFIX(), loads: [UDL(0, 5, 4, 'G'), UDL(0, 5, 6, 'Q'), MOM(2, 40, 'Q')] });
mk('UB-58', 'UB 610x229x125, 12 m fixed-fixed, full UDL, fully restrained (bending / deflection only)', UB('610 x 229 x 125'),
  { L: 12, ends: FIXFIX(), restraint: 'full', loads: [UDL(0, 12, 20, 'G'), UDL(0, 12, 28, 'Q')] });
mk('UB-59', 'UB 406x178x54, 7 m fixed-fixed, partial UDL 2-5 m + full G', UB('406 x 178 x 54'),
  { L: 7, ends: FIXFIX(), loads: [UDL(0, 7, 5, 'G'), UDL(2, 5, 30, 'Q')] });
// ---- fixed-pinned (propped cantilever: End 1 fixed, End 2 pinned fork) ----
mk('UB-20', 'UB 305x127x37, 6 m propped cantilever, full UDL', UB('305 x 127 x 37'),
  { L: 6, ends: PROPPED(), loads: [UDL(0, 6, 6, 'G'), UDL(0, 6, 7, 'Q')] });
mk('UB-60', 'UB 457x191x82, 8 m propped cantilever, central point load (closed forms 3PL/16 at the fixed end)', UB('457 x 191 x 82'),
  { L: 8, ends: PROPPED(), loads: [P(4, 40, 'G'), P(4, 110, 'Q')] });
mk('UB-61', 'UB 356x127x33, 6 m propped cantilever, triangular load falling 18 -> 0 kN/m (peak at the fixed end)', UB('356 x 127 x 33'),
  { L: 6, ends: PROPPED(), loads: [UDL(0, 6, 3, 'G'), TRAP(0, 6, 18, 0, 'Q')] });
mk('UB-62', 'UB 533x210x92, 9 m propped cantilever, full UDL + point load at 6 m, fully restrained', UB('533 x 210 x 92'),
  { L: 9, ends: PROPPED(), restraint: 'full', loads: [UDL(0, 9, 12, 'G'), UDL(0, 9, 16, 'Q'), P(6, 80, 'Q')] });
mk('UB-63', 'UB 254x146x31, 5 m propped cantilever, hogging couple 30 kN.m at the pinned End 2 + light UDL', UB('254 x 146 x 31'),
  { L: 5, ends: PROPPED(), loads: [UDL(0, 5, 3, 'G'), UDL(0, 5, 3, 'Q'), MOM(5, 30, 'Q')] });
// ---- cantilever (End 1 fixed in every DOF incl. warping, End 2 free) ----
mk('UB-18', 'UB 203x133x25, 4 m cantilever, UDL + tip point load, warping free at root', UB('203 x 133 x 25'),
  { L: 4, ends: CANT({ e1: { warp: false } }), divisor: 180, loads: [UDL(0, 4, 1, 'G'), UDL(0, 4, 1.5, 'Q'), P(4, 2, 'Q')] });   // root warping unticked (the cantilever preset restrains it)
mk('UB-19', 'UB 254x102x22, 3 m cantilever, tip point load, root warping restrained', UB('254 x 102 x 22'),
  { L: 3, ends: CANT(), divisor: 180, loads: [P(3, 10, 'Q')] });   // the cantilever preset restrains the root warping (seventh flag)
mk('UB-49', 'UB 457x191x82, 4 m cantilever, tip point load at e = 80 mm, unrestrained (cantilever torsion: warping FE with the root warping fixed, G4 item 11)', UB('457 x 191 x 82'),
  { L: 4, ends: CANT(), eccOn: true, loads: [P(4, 20, 'Q', { e: 80 })] }, ['torsion-fe', 'ecc-small']);
mk('UB-64', 'UB 305x165x40, 3 m cantilever, full UDL only (closed forms wL^2/2, wL^4/8EI; SN006a Table 3.1)', UB('305 x 165 x 40'),
  { L: 3, ends: CANT(), loads: [UDL(0, 3, 6, 'G'), UDL(0, 3, 9, 'Q')] });
mk('UB-65', 'UB 406x178x54, 4 m cantilever, tip point load + partial UDL 0-2 m (loading outside SN006a: standard route blocked)', UB('406 x 178 x 54'),
  { L: 4, ends: CANT(), loads: [P(4, 25, 'Q'), UDL(0, 2, 10, 'Q')] });
mk('UB-66', 'UB 457x191x82, 5 m cantilever, external couple 120 kN.m at the free end (SN006a Table 3.3)', UB('457 x 191 x 82'),
  { L: 5, ends: CANT(), loads: [MOM(5, 120, 'Q')] });
mk('UB-67', 'UB 356x171x45, 3.5 m cantilever, triangular load 20 -> 0 kN/m from the root (not an SN006a case)', UB('356 x 171 x 45'),
  { L: 3.5, ends: CANT(), loads: [UDL(0, 3.5, 2, 'G'), TRAP(0, 3.5, 20, 0, 'Q')] });
mk('UB-68', 'UB 254x146x31, 3 m cantilever, tip point load on the top flange zg = +D/2 (SN006a eta = +1)', UB('254 x 146 x 31'),
  { L: 3, ends: CANT(), eccOn: true, za: 126, loads: [P(3, 12, 'Q', { e: 0, zg: 126 })] }, ['zg-top']);
mk('UB-69', 'UB 203x133x25, 3 m cantilever, full UDL, fully restrained (bending / deflection L/180)', UB('203 x 133 x 25'),
  { L: 3, ends: CANT(), restraint: 'full', loads: [UDL(0, 3, 4, 'G'), UDL(0, 3, 6, 'Q')] });
mk('UB-70', 'UB 533x210x92, 6 m cantilever, full UDL + tip load, fully restrained, deliberately heavy (tip deflection)', UB('533 x 210 x 92'),
  { L: 6, ends: CANT(), restraint: 'full', loads: [UDL(0, 6, 10, 'G'), UDL(0, 6, 12, 'Q'), P(6, 40, 'Q')] }, ['heavy']);
// ---- guided-fixed (End 1 fixed, End 2 sliding: R_y held, U_z free, laterally clamped fork) ----
mk('UB-71', 'UB 305x165x40, 6 m guided-fixed, full UDL (closed forms wL^2/3 at the fixed end, wL^2/6 at the guided end, wL^4/24EI)', UB('305 x 165 x 40'),
  { L: 6, ends: GF(), loads: [UDL(0, 6, 3, 'G'), UDL(0, 6, 4, 'Q')] });
mk('UB-72', 'UB 406x178x54, 6 m guided-fixed, point load at the guided end (closed forms PL/2, PL^3/12EI)', UB('406 x 178 x 54'),
  { L: 6, ends: GF(), loads: [P(6, 15, 'G'), P(6, 40, 'Q')] });
mk('UB-73', 'UB 457x191x82, 8 m guided-fixed, full UDL, fully restrained', UB('457 x 191 x 82'),
  { L: 8, ends: GF(), restraint: 'full', loads: [UDL(0, 8, 7, 'G'), UDL(0, 8, 9, 'Q')] });
mk('UB-74', 'UB 356x171x45, 5 m guided-fixed, full G + partial UDL 2-5 m', UB('356 x 171 x 45'),
  { L: 5, ends: GF(), loads: [UDL(0, 5, 3, 'G'), UDL(2, 5, 12, 'Q')] });
mk('UB-75', 'UB 254x146x31, 4 m guided-fixed, trapezoidal 4 -> 10 kN/m', UB('254 x 146 x 31'),
  { L: 4, ends: GF(), loads: [UDL(0, 4, 2, 'G'), TRAP(0, 4, 4, 10, 'Q')] });
// ---- pinned-guided (End 1 pinned fork, End 2 sliding: R_y held, U_z free) ----
mk('UB-76', 'UB 305x165x40, 4 m pinned-guided, full UDL (closed forms wL^2/2 at the guided end, 5wL^4/24EI)', UB('305 x 165 x 40'),
  { L: 4, ends: PG(), loads: [UDL(0, 4, 3, 'G'), UDL(0, 4, 4, 'Q')] });
mk('UB-77', 'UB 406x178x54, 5 m pinned-guided, point load at the guided end (closed forms PL, PL^3/3EI)', UB('406 x 178 x 54'),
  { L: 5, ends: PG(), loads: [P(5, 8, 'G'), P(5, 20, 'Q')] });
mk('UB-78', 'UB 457x191x82, 6 m pinned-guided, full UDL, fully restrained', UB('457 x 191 x 82'),
  { L: 6, ends: PG(), restraint: 'full', loads: [UDL(0, 6, 7, 'G'), UDL(0, 6, 9, 'Q')] });
mk('UB-79', 'UB 356x127x33, 4 m pinned-guided, triangular load rising 0 -> 10 kN/m', UB('356 x 127 x 33'),
  { L: 4, ends: PG(), loads: [UDL(0, 4, 2, 'G'), TRAP(0, 4, 0, 10, 'Q')] });

/* =========================================================================
   UC - universal columns used as beams
   ========================================================================= */
mk('UC-01', 'UC 203x203x46, 5 m SS, full UDL, fully restrained', UC('203 x 203 x 46'),
  { L: 5, ends: SS(), restraint: 'full', loads: [UDL(0, 5, 8, 'G'), UDL(0, 5, 14, 'Q')] });
mk('UC-02', 'UC 203x203x46, 5 m SS, full UDL, unrestrained', UC('203 x 203 x 46'),
  { L: 5, ends: SS(), loads: [UDL(0, 5, 8, 'G'), UDL(0, 5, 13, 'Q')] });
mk('UC-03', 'UC 152x152x23, 4 m SS, central point load, top-flange loading', UC('152 x 152 x 23'),
  { L: 4, ends: SS(), eccOn: true, za: 76, loads: [P(2, 18.5, 'Q', { e: 0, zg: 76 })] }, ['zg-top']);
mk('UC-04', 'UC 152x152x30, 3 m cantilever, full UDL', UC('152 x 152 x 30'),
  { L: 3, ends: CANT(), divisor: 180, loads: [UDL(0, 3, 3.5, 'G'), UDL(0, 3, 4.7, 'Q')] });
mk('UC-05', 'UC 254x254x73, 6 m SS, full UDL + axial compression 700 kN (~0.27 Npl)', UC('254 x 254 x 73'),
  { L: 6, ends: SS(), axial: 700, loads: [UDL(0, 6, 7, 'G'), UDL(0, 6, 11, 'Q')] });
mk('UC-06', 'UC 254x254x89, 7 m SS, full UDL + Mz = 20 kN.m', UC('254 x 254 x 89'),
  { L: 7, ends: SS(), Mz: 20, loads: [UDL(0, 7, 10, 'G'), UDL(0, 7, 12, 'Q')] });
mk('UC-08', 'UC 305x305x118, 9 m SS, full UDL, restraints at third points', UC('305 x 305 x 118'),
  { L: 9, ends: SS(), loads: [UDL(0, 9, 11, 'G'), UDL(0, 9, 14, 'Q')], ltbRestraints: R(3, 6) });
mk('UC-09', 'UC 356x368x129, 10 m SS, triangular load 0 -> 30 kN/m + G', UC('356 x 368 x 129'),
  { L: 10, ends: SS(), loads: [UDL(0, 10, 10, 'G'), TRAP(0, 10, 0, 30, 'Q')] });
mk('UC-10', 'UC 356x406x235, 8 m SS, three 125 kN point loads + UDL, restrained (stocky)', UC('356 x 406 x 235'),
  { L: 8, ends: SS(), restraint: 'full', loads: [UDL(0, 8, 12, 'G'), P(2, 125, 'Q'), P(4, 125, 'Q'), P(6, 125, 'Q')] });
mk('UC-11', 'UC 203x203x60, 6 m propped cantilever, full UDL + axial tension 200 kN', UC('203 x 203 x 60'),
  { L: 6, ends: PROPPED(), axial: -200, loads: [UDL(0, 6, 10, 'G'), UDL(0, 6, 13, 'Q')] });
mk('UC-12', 'UC 203x203x86, 6 m fixed-fixed, central point load + axial compression 800 kN (~0.27 Npl, L_cr = 0.7 L from the fixities)', UC('203 x 203 x 86'),
  { L: 6, ends: FIXFIX(), axial: 800, loads: [P(3, 66, 'Q')] });
mk('UC-13', 'UC 152x152x37, 5 m SS, equal and opposite end couples (double curvature, psi = -1)', UC('152 x 152 x 37'),
  { L: 5, ends: SS(), loads: [MOM(0, 48, 'Q'), MOM(5, 48, 'Q')] });
mk('UC-14', 'UC 203x203x46, 4 m guided-fixed, full UDL', UC('203 x 203 x 46'),
  { L: 4, ends: GF(), loads: [UDL(0, 4, 6, 'G'), UDL(0, 4, 9, 'Q')] });
mk('UC-15', 'UC 254x254x73, 5 m pinned-guided, full UDL', UC('254 x 254 x 73'),
  { L: 5, ends: PG(), loads: [UDL(0, 5, 4, 'G'), UDL(0, 5, 5, 'Q')] });
mk('UC-16', 'UC 152x152x30, 3 m fixed-fixed, central point load', UC('152 x 152 x 30'),
  { L: 3, ends: FIXFIX(), loads: [P(1.5, 30, 'G'), P(1.5, 70, 'Q')] });
mk('UC-17', 'UC 305x305x118, 8 m cantilever, full UDL, fully restrained (tip deflection L/180)', UC('305 x 305 x 118'),
  { L: 8, ends: CANT(), restraint: 'full', loads: [UDL(0, 8, 3, 'G'), UDL(0, 8, 3, 'Q')] });
mk('UC-18', 'UC 203x203x60, 5 m propped cantilever, triangular load rising 0 -> 30 kN/m towards the pinned end', UC('203 x 203 x 60'),
  { L: 5, ends: PROPPED(), loads: [UDL(0, 5, 4, 'G'), TRAP(0, 5, 0, 30, 'Q')] });

/* =========================================================================
   PFC - parallel flange channels, with and without eccentricity
   ========================================================================= */
mk('PFC-01', 'PFC 180x75x20, 4 m SS, full UDL through the shear centre, fully restrained', PFC('180x75x20'),
  { L: 4, ends: SS(), restraint: 'full', loads: [UDL(0, 4, 5, 'G'), UDL(0, 4, 8, 'Q')] });
mk('PFC-02', 'PFC 180x75x20, 4 m SS, full UDL through the shear centre, unrestrained', PFC('180x75x20'),
  { L: 4, ends: SS(), loads: [UDL(0, 4, 3, 'G'), UDL(0, 4, 5, 'Q')] });
mk('PFC-03', 'PFC 200x90x30, 4 m SS, full UDL e = 0 with eccentricity ON (self-weight offset only)', PFC('200x90x30'),
  { L: 4, ends: SS(), eccOn: true, loads: [UDL(0, 4, 2, 'G', { e: 0 }), UDL(0, 4, 3, 'Q', { e: 0 })] }, ['ecc-zero']);
mk('PFC-04', 'PFC 200x90x30, 4 m SS, full UDL at e = 20 mm (small)', PFC('200x90x30'),
  { L: 4, ends: SS(), eccOn: true, loads: [UDL(0, 4, 2, 'G', { e: 20 }), UDL(0, 4, 3, 'Q', { e: 20 })] }, ['ecc-small']);
mk('PFC-05', 'PFC 200x90x30, 4 m SS, full UDL at e = 45 mm (flange half-width)', PFC('200x90x30'),
  { L: 4, ends: SS(), eccOn: true, loads: [UDL(0, 4, 2, 'G', { e: 45 }), UDL(0, 4, 3, 'Q', { e: 45 })] }, ['ecc-large']);
mk('PFC-06', 'PFC 230x90x32, 6 m SS, central point load at e = 45 mm, fully restrained', PFC('230x90x32'),
  { L: 6, ends: SS(), restraint: 'full', eccOn: true, loads: [P(3, 25, 'Q', { e: 45 })] }, ['ecc-large']);
mk('PFC-07', 'PFC 260x90x35, 4 m SS, full UDL at e = 30 mm and top-flange height zg = +D/2', PFC('260x90x35'),
  { L: 4, ends: SS(), eccOn: true, za: 130, loads: [UDL(0, 4, 3, 'G', { e: 30, zg: 130 }), UDL(0, 4, 4, 'Q', { e: 30, zg: 130 })] }, ['zg-top']);
mk('PFC-08', 'PFC 300x100x46, 5 m SS, triangular load 0 -> 10 kN/m at e = 50 mm + G', PFC('300x100x46'),
  { L: 5, ends: SS(), eccOn: true, loads: [UDL(0, 5, 3, 'G', { e: 50 }), TRAP(0, 5, 0, 10, 'Q', { e: 50 })] }, ['ecc-large']);
mk('PFC-09', 'PFC 300x90x41, 3.5 m cantilever, full UDL through the shear centre', PFC('300x90x41'),
  { L: 3.5, ends: CANT(), divisor: 180, loads: [UDL(0, 3.5, 4, 'G'), UDL(0, 3.5, 6, 'Q')] });
mk('PFC-11', 'PFC 430x100x64, 4 m SS, full UDL + axial compression 150 kN, restrained (torsional buckling, cl 6.3.1.4)', PFC('430x100x64'),
  { L: 4, ends: SS(), restraint: 'full', axial: 150, loads: [UDL(0, 4, 6, 'G'), UDL(0, 4, 8, 'Q')] });
mk('PFC-12', 'PFC 150x75x18, 3 m SS, central point load at e = 37 mm (flange half-width)', PFC('150x75x18'),
  { L: 3, ends: SS(), eccOn: true, loads: [P(1.5, 12, 'Q', { e: 37 })] }, ['ecc-large']);
mk('PFC-13', 'PFC 125x65x15, 3 m SS, full UDL + Mz = 1.5 kN.m', PFC('125x65x15'),
  { L: 3, ends: SS(), Mz: 1.5, loads: [UDL(0, 3, 1, 'G'), UDL(0, 3, 4, 'Q')] });
mk('PFC-14', 'PFC 260x75x28, 4 m SS, full UDL + point load at 1.5 m, all at e = 25 mm', PFC('260x75x28'),
  { L: 4, ends: SS(), eccOn: true, loads: [UDL(0, 4, 2, 'G', { e: 25 }), UDL(0, 4, 3, 'Q', { e: 25 }), P(1.5, 8, 'Q', { e: 25 })] }, ['ecc-small']);
mk('PFC-15', 'PFC 100x50x10, 2.5 m SS, full UDL, fully restrained (smallest PFC)', PFC('100x50x10'),
  { L: 2.5, ends: SS(), restraint: 'full', loads: [UDL(0, 2.5, 1.5, 'G'), UDL(0, 2.5, 5, 'Q')] });
mk('PFC-16', 'PFC 230x75x26, 5 m propped cantilever, full UDL at e = 30 mm (fork-fork torsion with in-plane fixity)', PFC('230x75x26'),
  { L: 5, ends: PROPPED(), eccOn: true, loads: [UDL(0, 5, 4, 'G', { e: 30 }), UDL(0, 5, 6, 'Q', { e: 30 })] }, ['ecc-small']);
mk('PFC-17', 'PFC 150x90x24, 4 m SS, partial UDL 1-3 m at e = 30 mm (partial-span torque: warping FE)', PFC('150x90x24'),
  { L: 4, ends: SS(), eccOn: true, loads: [UDL(1, 3, 10, 'Q', { e: 30 })] }, ['ecc-small']);
mk('PFC-18', 'PFC 180x90x26, 5 m SS, full UDL, restraints at third points', PFC('180x90x26'),
  { L: 5, ends: SS(), loads: [UDL(0, 5, 3, 'G'), UDL(0, 5, 5, 'Q')], ltbRestraints: R(5 / 3, 10 / 3) });
mk('PFC-20', 'PFC 180x75x20, 4 m SS, full UDL + axial compression 50 kN, unrestrained (torsional-flexural buckling cl 6.3.1.4, G3 item 10)', PFC('180x75x20'),
  { L: 4, ends: SS(), axial: 50, loads: [UDL(0, 4, 1, 'G'), UDL(0, 4, 2, 'Q')] }, ['tfb']);
mk('PFC-22', 'PFC 200x90x30, 4 m fixed-fixed, full UDL through the shear centre', PFC('200x90x30'),
  { L: 4, ends: FIXFIX(), loads: [UDL(0, 4, 8, 'G'), UDL(0, 4, 14, 'Q')] });
mk('PFC-23', 'PFC 260x90x35, 5 m fixed-fixed, full UDL at e = 30 mm (fork torsion with in-plane fixity at both ends)', PFC('260x90x35'),
  { L: 5, ends: FIXFIX(), eccOn: true, loads: [UDL(0, 5, 6, 'G', { e: 30 }), UDL(0, 5, 9, 'Q', { e: 30 })] }, ['ecc-small']);
mk('PFC-24', 'PFC 230x90x32, 4 m guided-fixed, full UDL through the shear centre', PFC('230x90x32'),
  { L: 4, ends: GF(), loads: [UDL(0, 4, 2, 'G'), UDL(0, 4, 4, 'Q')] });
mk('PFC-25', 'PFC 180x75x20, 3 m pinned-guided, full UDL through the shear centre', PFC('180x75x20'),
  { L: 3, ends: PG(), loads: [UDL(0, 3, 1.5, 'G'), UDL(0, 3, 2.5, 'Q')] });
mk('PFC-26', 'PFC 300x100x46, 3 m cantilever, tip point load at e = 50 mm (channel cantilever: warping FE, kappa chain on the standard route)', PFC('300x100x46'),
  { L: 3, ends: CANT(), eccOn: true, loads: [P(3, 12, 'Q', { e: 50 })] }, ['torsion-fe', 'ecc-large']);
mk('PFC-27', 'PFC 150x75x18, 3 m propped cantilever, full UDL', PFC('150x75x18'),
  { L: 3, ends: PROPPED(), loads: [UDL(0, 3, 3, 'G'), UDL(0, 3, 6, 'Q')] });
mk('PFC-28', 'PFC 430x100x64, 6 m fixed-fixed, two point loads at 2 and 4 m, fully restrained', PFC('430x100x64'),
  { L: 6, ends: FIXFIX(), restraint: 'full', loads: [UDL(0, 6, 4, 'G'), P(2, 70, 'Q'), P(4, 70, 'Q')] });

/* =========================================================================
   SHS - square hollow sections (hot-finished and cold-formed)
   ========================================================================= */
mk('SHS-01', 'SHS 100x100x5.0 HF, 3 m SS, full UDL, fully restrained', SHS('100x100x5.0'),
  { L: 3, ends: SS(), restraint: 'full', loads: [UDL(0, 3, 2, 'G'), UDL(0, 3, 4, 'Q')] });
mk('SHS-02', 'SHS 100x100x5.0 HF, 3 m SS, full UDL, unrestrained (LTB exempt by slenderness)', SHS('100x100x5.0'),
  { L: 3, ends: SS(), loads: [UDL(0, 3, 2, 'G'), UDL(0, 3, 4, 'Q')] });
mk('SHS-03', 'SHS 150x150x6.3 HF, 5 m SS, central point load, unrestrained', SHS('150x150x6.3'),
  { L: 5, ends: SS(), loads: [P(2.5, 11.5, 'Q')] });
mk('SHS-04', 'SHS 200x200x8.0 HF, 6 m SS, full UDL + axial compression 450 kN (~0.27 Npl)', SHS('200x200x8.0'),
  { L: 6, ends: SS(), axial: 450, loads: [UDL(0, 6, 3.5, 'G'), UDL(0, 6, 6, 'Q')] });
mk('SHS-06', 'SHS 300x300x10.0 HF, 4 m cantilever, tip point load + UDL', SHS('300x300x10.0'),
  { L: 4, ends: CANT(), divisor: 180, loads: [UDL(0, 4, 3.5, 'G'), P(4, 30, 'Q')] });
mk('SHS-07', 'SHS 100x100x4.0 CF, 3 m SS, full UDL at e = 40 mm (cold-formed torsion constants)', SHS('100x100x4.0', 'CF'),
  { L: 3, ends: SS(), eccOn: true, loads: [UDL(0, 3, 0.6, 'G', { e: 40 }), UDL(0, 3, 3.2, 'Q', { e: 40 })] }, ['ecc-large']);
mk('SHS-08', 'SHS 150x150x5.0 CF, 4 m SS, full UDL, fully restrained', SHS('150x150x5.0', 'CF'),
  { L: 4, ends: SS(), restraint: 'full', loads: [UDL(0, 4, 1.5, 'G'), UDL(0, 4, 5.8, 'Q')] });
mk('SHS-09', 'SHS 200x200x6.0 CF, 6 m SS, two point loads + Mz = 4 kN.m, fully restrained', SHS('200x200x6.0', 'CF'),
  { L: 6, ends: SS(), restraint: 'full', Mz: 4, loads: [P(2, 11, 'Q'), P(4, 11, 'Q')] });
mk('SHS-10', 'SHS 120x120x5.0 HF, 4 m SS, full UDL + axial tension 100 kN', SHS('120x120x5.0'),
  { L: 4, ends: SS(), axial: -100, loads: [UDL(0, 4, 1, 'G'), UDL(0, 4, 3, 'Q')] });
mk('SHS-11', 'SHS 80x80x5.0 HF, 2.5 m SS, full UDL at e = 40 mm (half width), fully restrained', SHS('80x80x5.0'),
  { L: 2.5, ends: SS(), restraint: 'full', eccOn: true, loads: [UDL(0, 2.5, 0.8, 'G', { e: 40 }), UDL(0, 2.5, 3.4, 'Q', { e: 40 })] }, ['ecc-large']);
mk('SHS-12', 'SHS 150x150x6.3 HF, 5 m fixed-fixed, full UDL', SHS('150x150x6.3'),
  { L: 5, ends: FIXFIX(), loads: [UDL(0, 5, 5, 'G'), UDL(0, 5, 9, 'Q')] });
mk('SHS-13', 'SHS 200x200x8.0 HF, 6 m propped cantilever, central point load', SHS('200x200x8.0'),
  { L: 6, ends: PROPPED(), loads: [P(3, 20, 'G'), P(3, 45, 'Q')] });
mk('SHS-14', 'SHS 100x100x5.0 HF, 3 m guided-fixed, full UDL', SHS('100x100x5.0'),
  { L: 3, ends: GF(), loads: [UDL(0, 3, 1, 'G'), UDL(0, 3, 2.2, 'Q')] });
mk('SHS-15', 'SHS 120x120x5.0 HF, 3 m pinned-guided, point load at the guided end', SHS('120x120x5.0'),
  { L: 3, ends: PG(), loads: [P(3, 1, 'G'), P(3, 1.8, 'Q')] });
mk('SHS-16', 'SHS 300x300x10.0 HF, 4 m cantilever, full UDL, fully restrained', SHS('300x300x10.0'),
  { L: 4, ends: CANT(), restraint: 'full', loads: [UDL(0, 4, 8, 'G'), UDL(0, 4, 14, 'Q')] });

/* =========================================================================
   RHS - rectangular hollow sections, including slender h/b
   ========================================================================= */
mk('RHS-01', 'RHS 200x100x8.0, 5 m SS, full UDL, fully restrained', RHS('200 x 100 x 8.0'),
  { L: 5, ends: SS(), restraint: 'full', loads: [UDL(0, 5, 4, 'G'), UDL(0, 5, 7, 'Q')] });
mk('RHS-02', 'RHS 200x100x8.0, 5 m SS, full UDL, unrestrained', RHS('200 x 100 x 8.0'),
  { L: 5, ends: SS(), loads: [UDL(0, 5, 4, 'G'), UDL(0, 5, 7, 'Q')] });
mk('RHS-03', 'RHS 300x100x10.0 (h/b = 3), 8 m SS, full UDL, unrestrained', RHS('300 x 100 x 10.0'),
  { L: 8, ends: SS(), loads: [UDL(0, 8, 3.5, 'G'), UDL(0, 8, 5.7, 'Q')] });
mk('RHS-04', 'RHS 500x200x12.5 (h/b = 2.5), 12 m SS, full UDL, unrestrained', RHS('500 x 200 x 12.5'),
  { L: 12, ends: SS(), loads: [UDL(0, 12, 9, 'G'), UDL(0, 12, 11, 'Q')] });
mk('RHS-05', 'RHS 250x100x8.0, 7 m SS, central point load + G UDL', RHS('250 x 100 x 8.0'),
  { L: 7, ends: SS(), loads: [UDL(0, 7, 2.3, 'G'), P(3.5, 19, 'Q')] });
mk('RHS-06', 'RHS 150x100x6.3, 4 m SS, full UDL + axial compression 200 kN (~0.25 Npl)', RHS('150 x 100 x 6.3'),
  { L: 4, ends: SS(), axial: 200, loads: [UDL(0, 4, 1.3, 'G'), UDL(0, 4, 5.4, 'Q')] });
mk('RHS-07', 'RHS 160x80x5.0, 3 m cantilever, UDL + tip point load', RHS('160 x 80 x 5.0'),
  { L: 3, ends: CANT(), divisor: 180, loads: [UDL(0, 3, 1, 'G'), UDL(0, 3, 1.0, 'Q'), P(3, 1.5, 'Q')] });
mk('RHS-10', 'RHS 300x200x8.0, 7 m SS, triangular load 0 -> 20 kN/m + Mz = 15 kN.m', RHS('300 x 200 x 8.0'),
  { L: 7, ends: SS(), Mz: 15, loads: [UDL(0, 7, 5, 'G'), TRAP(0, 7, 0, 20, 'Q')] });
mk('RHS-11', 'RHS 100x50x4.0, 2.5 m SS, full UDL at e = 25 mm, fully restrained (box torsion)', RHS('100 x 50 x 4.0'),
  { L: 2.5, ends: SS(), restraint: 'full', eccOn: true, loads: [UDL(0, 2.5, 1, 'G', { e: 25 }), UDL(0, 2.5, 4, 'Q', { e: 25 })] }, ['ecc-large']);
mk('RHS-12', 'RHS 120x60x5.0, 3 m SS, central point load at e = 30 mm, unrestrained', RHS('120 x 60 x 5.0'),
  { L: 3, ends: SS(), eccOn: true, loads: [P(1.5, 7.9, 'Q', { e: 30 })] }, ['ecc-large']);
mk('RHS-13', 'RHS 450x250x12.5, 10 m fixed-fixed, full UDL', RHS('450 x 250 x 12.5'),
  { L: 10, ends: FIXFIX(), loads: [UDL(0, 10, 20, 'G'), UDL(0, 10, 27, 'Q')] });
mk('RHS-14', 'RHS 500x300x16.0, 14 m SS, full UDL, restraints at third points', RHS('500 x 300 x 16.0'),
  { L: 14, ends: SS(), loads: [UDL(0, 14, 8.5, 'G'), UDL(0, 14, 11.4, 'Q')], ltbRestraints: R(14 / 3, 28 / 3) });
mk('RHS-15', 'RHS 200x120x6.3, 6 m propped cantilever, full UDL', RHS('200 x 120 x 6.3'),
  { L: 6, ends: PROPPED(), loads: [UDL(0, 6, 4, 'G'), UDL(0, 6, 6, 'Q')] });
mk('RHS-16', 'RHS 250x150x8.0, 8 m SS, UDL G+Q with upward wind (uplift combinations, no hold-down)', RHS('250 x 150 x 8.0'),
  { L: 8, ends: SS(), combos: GQW(), loads: [UDL(0, 8, 2.4, 'G'), UDL(0, 8, 3.4, 'Q'), UDL(0, 8, -3.8, 'W')] }, ['uplift']);
mk('RHS-17', 'RHS 200x100x8.0, 5 m guided-fixed, full UDL', RHS('200 x 100 x 8.0'),
  { L: 5, ends: GF(), loads: [UDL(0, 5, 2, 'G'), UDL(0, 5, 3.5, 'Q')] });
mk('RHS-18', 'RHS 300x100x10.0, 5 m pinned-guided, full UDL', RHS('300 x 100 x 10.0'),
  { L: 5, ends: PG(), loads: [UDL(0, 5, 2, 'G'), UDL(0, 5, 3.5, 'Q')] });
mk('RHS-19', 'RHS 250x150x8.0, 4 m cantilever, tip point load, fully restrained', RHS('250 x 150 x 8.0'),
  { L: 4, ends: CANT(), restraint: 'full', loads: [P(4, 5, 'G'), P(4, 12, 'Q')] });
mk('RHS-20', 'RHS 300x200x8.0, 8 m fixed-fixed, trapezoidal 6 -> 14 kN/m + G', RHS('300 x 200 x 8.0'),
  { L: 8, ends: FIXFIX(), loads: [UDL(0, 8, 5, 'G'), TRAP(0, 8, 6, 14, 'Q')] });
mk('RHS-21', 'RHS 150x100x6.3, 4 m propped cantilever, full UDL + point load at 2 m', RHS('150 x 100 x 6.3'),
  { L: 4, ends: PROPPED(), loads: [UDL(0, 4, 2, 'G'), UDL(0, 4, 3, 'Q'), P(2, 10, 'Q')] });

/* =========================================================================
   ECC - eccentric loads (torsion) on PFC and UB under the presets
   ========================================================================= */
mk('ECC-01', 'UB 457x191x82, 8 m fixed-fixed, full UDL at e = 95 mm (fork torsion, P385 closed forms with in-plane fixity)', UB('457 x 191 x 82'),
  { L: 8, ends: FIXFIX(), eccOn: true, loads: [UDL(0, 8, 6, 'G', { e: 95 }), UDL(0, 8, 8, 'Q', { e: 95 })] }, ['ecc-large']);
mk('ECC-02', 'PFC 200x90x30, 4 m fixed-fixed, full UDL at e = 45 mm (flange half-width)', PFC('200x90x30'),
  { L: 4, ends: FIXFIX(), eccOn: true, loads: [UDL(0, 4, 6, 'G', { e: 45 }), UDL(0, 4, 9, 'Q', { e: 45 })] }, ['ecc-large']);
mk('ECC-03', 'UB 406x178x54, 5 m propped cantilever, central point load at e = 60 mm', UB('406 x 178 x 54'),
  { L: 5, ends: PROPPED(), eccOn: true, loads: [P(2.5, 30, 'G', { e: 60 }), P(2.5, 60, 'Q', { e: 60 })] }, ['ecc-small']);
mk('ECC-04', 'PFC 230x90x32, 4 m guided-fixed, full UDL at e = 45 mm (fork ends for torsion, in-plane guided)', PFC('230x90x32'),
  { L: 4, ends: GF(), eccOn: true, loads: [UDL(0, 4, 3, 'G', { e: 45 }), UDL(0, 4, 5, 'Q', { e: 45 })] }, ['ecc-large']);
mk('ECC-05', 'UB 305x165x40, 3 m cantilever, tip point load at e = 80 mm, fully restrained (torsion cantilever FE, bending restrained)', UB('305 x 165 x 40'),
  { L: 3, ends: CANT(), restraint: 'full', eccOn: true, loads: [P(3, 18, 'Q', { e: 80 })] }, ['torsion-fe', 'ecc-small']);
mk('ECC-06', 'PFC 260x90x35, 5 m pinned-guided, full UDL at e = 30 mm', PFC('260x90x35'),
  { L: 5, ends: PG(), eccOn: true, loads: [UDL(0, 5, 1.5, 'G', { e: 30 }), UDL(0, 5, 2, 'Q', { e: 30 })] }, ['ecc-small']);
mk('ECC-07', 'UB 533x210x92, 8 m SS, full UDL at e = 100 mm with End 1 warping fixed only (asymmetric: warping FE)', UB('533 x 210 x 92'),
  { L: 8, ends: SS({ e1: { warp: true } }), eccOn: true, loads: [UDL(0, 8, 6, 'G', { e: 100 }), UDL(0, 8, 9, 'Q', { e: 100 })] }, ['torsion-fe', 'ecc-large', 'warpFix']);
mk('ECC-08', 'PFC 180x75x20, 3 m SS, point load at 1 m at e = -37 mm (load on the web side)', PFC('180x75x20'),
  { L: 3, ends: SS(), eccOn: true, loads: [P(1, 14, 'Q', { e: -37 })] }, ['ecc-large']);
mk('ECC-09', 'PFC 300x100x46, 6 m SS, central point load at e = -50 mm (load on the web side)', PFC('300x100x46'),
  { L: 6, ends: SS(), eccOn: true, loads: [P(3, 21, 'Q', { e: -50 })] }, ['ecc-large']);
mk('ECC-10', 'UB 457x191x82, 8 m SS, partial UDL 2-6 m at e = 100 mm, unrestrained (partial-span torque: warping FE, G4 item 11)', UB('457 x 191 x 82'),
  { L: 8, ends: SS(), eccOn: true, loads: [UDL(2, 6, 10, 'Q', { e: 100 })] }, ['torsion-fe', 'ecc-large']);
mk('UB-51', 'UB 457x191x82, 8 m SS, full UDL at e = 100 mm with both supports warping-restrained, unrestrained (warping-fixed ends: warping FE, G4 item 11)', UB('457 x 191 x 82'),
  { L: 8, ends: SS({ e1: { warp: true }, e2: { warp: true } }), eccOn: true, loads: [UDL(0, 8, 5, 'G', { e: 100 }), UDL(0, 8, 8, 'Q', { e: 100 })] }, ['torsion-fe', 'ecc-large', 'warpFix']);

/* =========================================================================
   ZG - load height +/- D/2 under the presets
   ========================================================================= */
mk('ZG-01', 'UB 356x171x45, 7 m fixed-fixed, full UDL hung from the bottom flange zg = -D/2 (SN003a fixed-ended row, stabilising)', UB('356 x 171 x 45'),
  { L: 7, ends: FIXFIX(), eccOn: true, za: -176, loads: [UDL(0, 7, 5, 'G', { e: 0, zg: -176 }), UDL(0, 7, 8, 'Q', { e: 0, zg: -176 })] }, ['zg-bottom']);
mk('ZG-02', 'UB 406x178x54, 6 m propped cantilever, full UDL on the top flange zg = +D/2 (C2 unpublished: standard route blocked)', UB('406 x 178 x 54'),
  { L: 6, ends: PROPPED(), eccOn: true, za: 201, loads: [UDL(0, 6, 6, 'G', { e: 0, zg: 201 }), UDL(0, 6, 9, 'Q', { e: 0, zg: 201 })] }, ['zg-top']);
mk('UB-45', 'UC 203x203x60, 6 m fixed-fixed, central point load, top-flange loading zg = +D/2 (SN003a fixed-ended row, C2 = 1.645)', UC('203 x 203 x 60'),
  { L: 6, ends: FIXFIX(), eccOn: true, za: 105, loads: [P(3, 30, 'G', { e: 0, zg: 105 }), P(3, 80, 'Q', { e: 0, zg: 105 })] }, ['zg-top']);
mk('ZG-03', 'UC 203x203x46, 5 m fixed-fixed, central point load hung from the bottom flange zg = -D/2', UC('203 x 203 x 46'),
  { L: 5, ends: FIXFIX(), eccOn: true, za: -102, loads: [P(2.5, 25, 'G', { e: 0, zg: -102 }), P(2.5, 60, 'Q', { e: 0, zg: -102 })] }, ['zg-bottom']);
mk('ZG-04', 'UB 305x165x40, 3 m cantilever, full UDL on the top flange zg = +D/2 (SN006a eta = +1)', UB('305 x 165 x 40'),
  { L: 3, ends: CANT(), eccOn: true, za: 152, loads: [UDL(0, 3, 5, 'G', { e: 0, zg: 152 }), UDL(0, 3, 8, 'Q', { e: 0, zg: 152 })] }, ['zg-top']);
mk('ZG-05', 'UB 305x165x40, 3 m cantilever, full UDL hung from the bottom flange zg = -D/2 (SN006a eta = -1)', UB('305 x 165 x 40'),
  { L: 3, ends: CANT(), eccOn: true, za: -152, loads: [UDL(0, 3, 6, 'G', { e: 0, zg: -152 }), UDL(0, 3, 10, 'Q', { e: 0, zg: -152 })] }, ['zg-bottom']);
mk('ZG-06', 'UB 457x191x82, 8 m guided-fixed, full UDL on the top flange zg = +D/2 (C2 unpublished: standard route blocked)', UB('457 x 191 x 82'),
  { L: 8, ends: GF(), eccOn: true, za: 229, loads: [UDL(0, 8, 4, 'G', { e: 0, zg: 229 }), UDL(0, 8, 6, 'Q', { e: 0, zg: 229 })] }, ['zg-top']);
mk('ZG-07', 'UB 254x146x31, 5 m SS, central point load on the top flange zg = +D/2 (SN003a C2 = 0.630)', UB('254 x 146 x 31'),
  { L: 5, ends: SS(), eccOn: true, za: 126, loads: [P(2.5, 8, 'G', { e: 0, zg: 126 }), P(2.5, 20, 'Q', { e: 0, zg: 126 })] }, ['zg-top']);
mk('ZG-08', 'PFC 300x100x46, 5 m SS, full UDL hung from the bottom flange zg = -D/2 (channel: kappa chain ignores z_g)', PFC('300x100x46'),
  { L: 5, ends: SS(), eccOn: true, za: -150, loads: [UDL(0, 5, 4, 'G', { e: 0, zg: -150 }), UDL(0, 5, 6, 'Q', { e: 0, zg: -150 })] }, ['zg-bottom']);
mk('ZG-09', 'UB 457x152x52, 7 m SS, UDL hung from the bottom flange + point load on the top flange (per-load zg)', UB('457 x 152 x 52'),
  { L: 7, ends: SS(), eccOn: true, za: 0, loads: [UDL(0, 7, 3, 'G', { e: 0, zg: -225 }), UDL(0, 7, 2.5, 'Q', { e: 0, zg: -225 }), P(3.5, 8, 'Q', { e: 0, zg: 225 })] }, ['zg-mixed']);

/* =========================================================================
   AX - axial force: U_x at one end (determinate) and at both (indeterminate),
   the end-fixity strut lengths of every preset, tension
   ========================================================================= */
mk('AX-01', 'UB 406x178x74, 6 m fixed-fixed, full UDL + N = 500 kN (L_cr = 0.7 L both axes from the fixities)', UB('406 x 178 x 74'),
  { L: 6, ends: FIXFIX(), axial: 500, loads: [UDL(0, 6, 8, 'G'), UDL(0, 6, 12, 'Q')] });
mk('AX-02', 'UC 203x203x60, 5 m propped cantilever, full UDL + N = 400 kN (L_cr = 0.85 L)', UC('203 x 203 x 60'),
  { L: 5, ends: PROPPED(), axial: 400, loads: [UDL(0, 5, 6, 'G'), UDL(0, 5, 9, 'Q')] });
mk('AX-03', 'UB 305x165x40, 3 m cantilever, full UDL + N = 100 kN (L_cr = 2.0 L both axes)', UB('305 x 165 x 40'),
  { L: 3, ends: CANT(), axial: 100, loads: [UDL(0, 3, 4, 'G'), UDL(0, 3, 6, 'Q')] });
mk('AX-04', 'UC 254x254x73, 6 m guided-fixed, full UDL + N = 300 kN (y-y 1.2 L sway-permitted guided end, z-z 0.7 L)', UC('254 x 254 x 73'),
  { L: 6, ends: GF(), axial: 300, loads: [UDL(0, 6, 3, 'G'), UDL(0, 6, 4, 'Q')] });
mk('AX-05', 'UB 356x171x45, 5 m pinned-guided, full UDL + N = 150 kN (y-y 2.0 L theoretical, z-z 0.85 L)', UB('356 x 171 x 45'),
  { L: 5, ends: PG(), axial: 150, loads: [UDL(0, 5, 2, 'G'), UDL(0, 5, 3, 'Q')] });
mk('AX-06', 'SHS 200x200x8.0 HF, 6 m fixed-fixed, full UDL + N = 500 kN with U_x at both ends (axial statically indeterminate: N taken as applied)', SHS('200x200x8.0'),
  { L: 6, ends: FIXFIX({ e2: { ux: true } }), axial: 500, loads: [UDL(0, 6, 5, 'G'), UDL(0, 6, 8, 'Q')] }, ['ux-both']);
mk('AX-07', 'UB 406x178x74, 6 m SS, full UDL + N = 300 kN with U_x at both ends (indeterminate note; base UB-28 layout)', UB('406 x 178 x 74'),
  { L: 6, ends: SS({ e2: { ux: true } }), axial: 300, loads: [UDL(0, 6, 6, 'G'), UDL(0, 6, 8, 'Q')] }, ['ux-both']);
mk('AX-08', 'RHS 200x100x8.0, 5 m propped cantilever, full UDL + axial tension 150 kN', RHS('200 x 100 x 8.0'),
  { L: 5, ends: PROPPED(), axial: -150, loads: [UDL(0, 5, 4, 'G'), UDL(0, 5, 7, 'Q')] });
mk('AX-09', 'UC 203x203x46, 4 m fixed-fixed, full UDL + axial tension 250 kN, fully restrained', UC('203 x 203 x 46'),
  { L: 4, ends: FIXFIX(), restraint: 'full', axial: -250, loads: [UDL(0, 4, 12, 'G'), UDL(0, 4, 20, 'Q')] });
mk('AX-10', 'PFC 200x90x30, 4 m fixed-fixed, full UDL + N = 80 kN (channel torsional-flexural buckling, L_T = L between the twist-restrained ends)', PFC('200x90x30'),
  { L: 4, ends: FIXFIX(), axial: 160, loads: [UDL(0, 4, 3, 'G'), UDL(0, 4, 5, 'Q')] }, ['tfb']);
mk('AX-11', 'UB 305x165x40, 6 m SS laterally clamped (R_z both ends) + N = 200 kN, L_E/L = 1.0 entered (the override replaces the 0.7 L z-z default)', UB('305 x 165 x 40'),
  { L: 6, ends: SS({ e1: { rz: true }, e2: { rz: true } }), axial: 200, leFactor: 1.0, loads: [UDL(0, 6, 3, 'G'), UDL(0, 6, 4, 'Q')] });
mk('AX-12', 'UB 457x191x82, 8 m fixed-fixed, central point load + N = 800 kN, fully restrained (Eq 6.61 with C_my from the fixed-ended diagram)', UB('457 x 191 x 82'),
  { L: 8, ends: FIXFIX(), restraint: 'full', axial: 800, loads: [P(4, 40, 'G'), P(4, 100, 'Q')] });
mk('AX-13', 'UB 254x146x31, 4 m cantilever, tip point load + N = 60 kN, unrestrained (strut 2.0 L, no k_c f-factor on a cantilever)', UB('254 x 146 x 31'),
  { L: 4, ends: CANT(), axial: 60, loads: [P(4, 6, 'Q')] });

/* =========================================================================
   MZ - minor-axis moment (biaxial) under the presets
   ========================================================================= */
mk('MZ-01', 'UB 254x146x31, 5 m fixed-fixed, full UDL + Mz = 8 kN.m, fully restrained', UB('254 x 146 x 31'),
  { L: 5, ends: FIXFIX(), restraint: 'full', Mz: 8, loads: [UDL(0, 5, 7, 'G'), UDL(0, 5, 9, 'Q')] });
mk('MZ-02', 'UC 254x254x89, 7 m propped cantilever, full UDL + Mz = 20 kN.m', UC('254 x 254 x 89'),
  { L: 7, ends: PROPPED(), Mz: 20, loads: [UDL(0, 7, 12, 'G'), UDL(0, 7, 16, 'Q')] });
mk('MZ-03', 'UB 305x165x40, 3 m cantilever, full UDL + Mz = 4 kN.m, fully restrained', UB('305 x 165 x 40'),
  { L: 3, ends: CANT(), restraint: 'full', Mz: 4, loads: [UDL(0, 3, 6, 'G'), UDL(0, 3, 9, 'Q')] });
mk('MZ-04', 'RHS 300x200x8.0, 7 m guided-fixed, triangular load 0 -> 10 kN/m + Mz = 8 kN.m', RHS('300 x 200 x 8.0'),
  { L: 7, ends: GF(), Mz: 8, loads: [UDL(0, 7, 3, 'G'), TRAP(0, 7, 0, 10, 'Q')] });
mk('MZ-05', 'UC 203x203x60, 5 m fixed-fixed, full UDL + N = 300 kN + Mz = 10 kN.m (biaxial beam-column, L_cr = 0.7 L)', UC('203 x 203 x 60'),
  { L: 5, ends: FIXFIX(), axial: 300, Mz: 10, loads: [UDL(0, 5, 6, 'G'), UDL(0, 5, 8, 'Q')] });
mk('MZ-06', 'SHS 200x200x6.0 CF, 5 m pinned-guided, point load at the guided end + Mz = 4 kN.m, fully restrained', SHS('200x200x6.0', 'CF'),
  { L: 5, ends: PG(), restraint: 'full', Mz: 4, loads: [P(5, 2, 'G'), P(5, 3.5, 'Q')] });
mk('MZ-07', 'UC 254x254x73, 6 m SS, full UDL + N = 500 kN + Mz = 15 kN.m (biaxial beam-column, fork ends)', UC('254 x 254 x 73'),
  { L: 6, ends: SS(), axial: 500, Mz: 15, loads: [UDL(0, 6, 6.5, 'G'), UDL(0, 6, 8, 'Q')] });

/* =========================================================================
   RES - intermediate lateral restraints under the presets
   ========================================================================= */
mk('RES-01', 'UB 533x210x92, 10 m fixed-fixed, full UDL, restraints at third points (bay by bay inside laterally clamped ends)', UB('533 x 210 x 92'),
  { L: 10, ends: FIXFIX(), loads: [UDL(0, 10, 12, 'G'), UDL(0, 10, 18, 'Q')], ltbRestraints: R(10 / 3, 20 / 3) });
mk('RES-02', 'UB 406x178x54, 8 m propped cantilever, three point loads restrained at each load, top-flange loading', UB('406 x 178 x 54'),
  { L: 8, ends: PROPPED(), eccOn: true, za: 201, loads: [P(2, 35, 'Q', { e: 0, zg: 201 }), P(4, 35, 'Q', { e: 0, zg: 201 }), P(6, 35, 'Q', { e: 0, zg: 201 })], ltbRestraints: R(2, 4, 6) }, ['zg-top']);
mk('RES-03', 'UB 457x191x82, 6 m cantilever, full UDL with a lateral restraint (v, phi) at mid-length', UB('457 x 191 x 82'),
  { L: 6, ends: CANT(), loads: [UDL(0, 6, 6, 'G'), UDL(0, 6, 9, 'Q')], ltbRestraints: R(3) });
mk('RES-04', 'UB 610x229x125, 12 m guided-fixed, full UDL, restraints at 4 and 8 m', UB('610 x 229 x 125'),
  { L: 12, ends: GF(), loads: [UDL(0, 12, 4, 'G'), UDL(0, 12, 6, 'Q')], ltbRestraints: R(4, 8) });
mk('RES-05', 'UC 305x305x118, 7 m pinned-guided, full UDL, restraints at third points', UC('305 x 305 x 118'),
  { L: 7, ends: PG(), loads: [UDL(0, 7, 3, 'G'), UDL(0, 7, 4, 'Q')], ltbRestraints: R(7 / 3, 14 / 3) });
mk('RES-06', 'UB 356x171x45, 7 m SS, full UDL, one mid-span restraint holding v only (twist free)', UB('356 x 171 x 45'),
  { L: 7, ends: SS(), loads: [UDL(0, 7, 5, 'G'), UDL(0, 7, 8, 'Q')], ltbRestraints: [{ pos: 3.5, v: true, phi: false, vp: false, phip: false }] });
mk('RES-07', 'PFC 180x90x26, 5 m fixed-fixed, full UDL, restraints at third points', PFC('180x90x26'),
  { L: 5, ends: FIXFIX(), loads: [UDL(0, 5, 5, 'G'), UDL(0, 5, 8, 'Q')], ltbRestraints: R(5 / 3, 10 / 3) });
mk('RES-08', 'UB 686x254x140, 10 m SS, equal hogging end couples + full UDL, restraints at quarter points', UB('686 x 254 x 140'),
  { L: 10, ends: SS(), loads: [MOM(0, 500, 'Q'), MOM(10, -500, 'Q'), UDL(0, 10, 20, 'G'), UDL(0, 10, 20, 'Q')], ltbRestraints: R(2.5, 5, 7.5) });

/* =========================================================================
   HNG - internal hinges (in-plane moment release; lateral / twist continuity kept)
   ========================================================================= */
mk('HNG-01', 'UB 533x210x92, 12 m fixed-hinge-pinned (Gerber-type single span, hinge at 4 m), full UDL', UB('533 x 210 x 92'),
  { L: 12, ends: PROPPED(), hinges: [{ pos: 4 }], loads: [UDL(0, 12, 6, 'G'), UDL(0, 12, 8, 'Q')] });
mk('HNG-02', 'UB 254x146x31, 6 m fixed-hinge-pinned (hinge at 3 m), full UDL', UB('254 x 146 x 31'),
  { L: 6, ends: PROPPED(), hinges: [{ pos: 3 }], loads: [UDL(0, 6, 2.8, 'G'), UDL(0, 6, 4.1, 'Q')] });
mk('HNG-03', 'UB 457x191x82, 10 m fixed-hinge-fixed (hinge at 5 m), full UDL', UB('457 x 191 x 82'),
  { L: 10, ends: FIXFIX(), hinges: [{ pos: 5 }], loads: [UDL(0, 10, 8, 'G'), UDL(0, 10, 12, 'Q')] });
mk('HNG-04', 'UB 406x178x54, 8 m fixed-hinge-fixed (hinge at 2 m), central point load + G', UB('406 x 178 x 54'),
  { L: 8, ends: FIXFIX(), hinges: [{ pos: 2 }], loads: [UDL(0, 8, 3, 'G'), P(4, 40, 'Q')] });
mk('HNG-05', 'UC 203x203x60, 6 m fixed-hinge-fixed (hinge at 3 m), full UDL, fully restrained', UC('203 x 203 x 60'),
  { L: 6, ends: FIXFIX(), restraint: 'full', hinges: [{ pos: 3 }], loads: [UDL(0, 6, 10, 'G'), UDL(0, 6, 16, 'Q')] });
mk('HNG-06', 'RHS 300x200x8.0, 8 m fixed-hinge-pinned (hinge at 3 m), full UDL', RHS('300 x 200 x 8.0'),
  { L: 8, ends: PROPPED(), hinges: [{ pos: 3 }], loads: [UDL(0, 8, 5, 'G'), UDL(0, 8, 8, 'Q')] });
mk('HNG-07', 'UB 305x165x40, 6 m fixed-hinge-guided (hinge at 2 m: a 2 m cantilever carrying a pinned-guided 4 m tail), full UDL', UB('305 x 165 x 40'),
  { L: 6, ends: GF(), hinges: [{ pos: 2 }], loads: [UDL(0, 6, 2, 'G'), UDL(0, 6, 3, 'Q')] });

/* =========================================================================
   CUS - custom end flag sets. Pairs: the runner asserts M_cr,eigen(case) >=
   M_cr,eigen(base) for the same section, length and loads.
   ========================================================================= */
mk('CUS-01', 'UB 305x165x40, 6 m SS in plane, laterally clamped (R_z restrained at both ends): M_cr >= the fork-ended UB-03 (SN003a k = 0.5)', UB('305 x 165 x 40'),
  { L: 6, ends: SS({ e1: { rz: true }, e2: { rz: true } }), loads: [UDL(0, 6, 5, 'G'), UDL(0, 6, 6, 'Q')] }, ['clamped'],
  { pair: { base: 'UB-03', relation: 'ge', why: 'R_z restrained at both ends (v\' = 0) against fork ends; SN003a k = 0.5' } });
mk('CUS-02', 'UB 305x165x40, 6 m SS, warping fixed at both ends (phi\' = 0): M_cr >= the warping-free UB-03', UB('305 x 165 x 40'),
  { L: 6, ends: SS({ e1: { warp: true }, e2: { warp: true } }), loads: [UDL(0, 6, 5, 'G'), UDL(0, 6, 6, 'Q')] }, ['warpFix'],
  { pair: { base: 'UB-03', relation: 'ge', why: 'warping fixed at both ends against warping free; SN003a k_w = 0.5' } });
mk('CUS-03', 'UB 406x178x54, 7 m SS, central point load, laterally clamped (R_z both ends): M_cr >= UB-07', UB('406 x 178 x 54'),
  { L: 7, ends: SS({ e1: { rz: true }, e2: { rz: true } }), loads: [P(3.5, 12, 'G'), P(3.5, 32, 'Q')] }, ['clamped'],
  { pair: { base: 'UB-07', relation: 'ge', why: 'R_z restrained at both ends against fork ends; SN003a k = 0.5, central point load' } });
mk('CUS-04', 'UB 406x178x54, 7 m SS, central point load, warping fixed at both ends: M_cr >= UB-07', UB('406 x 178 x 54'),
  { L: 7, ends: SS({ e1: { warp: true }, e2: { warp: true } }), loads: [P(3.5, 12, 'G'), P(3.5, 32, 'Q')] }, ['warpFix'],
  { pair: { base: 'UB-07', relation: 'ge', why: 'warping fixed at both ends against warping free, central point load' } });
mk('CUS-05', 'UB 305x165x40, 6 m SS, End 2 twist-free (R_x released, U_y held) with no torque: the twist mode is held at End 1 only', UB('305 x 165 x 40'),
  { L: 6, ends: SS({ e2: { rx: false } }), loads: [UDL(0, 6, 3, 'G'), UDL(0, 6, 4, 'Q')] }, ['twist-free-end']);
mk('CUS-06', 'UB 305x165x40, 6 m SS in plane, lateral cantilever (End 2 U_y and R_x free; End 1 holds U_y, R_z, R_x, warping free)', UB('305 x 165 x 40'),
  { L: 6, ends: SS({ e1: { rz: true }, e2: { uy: false, rx: false } }), loads: [UDL(0, 6, 3, 'G'), UDL(0, 6, 4, 'Q')] }, ['lateral-cantilever']);
mk('CUS-07', 'UB 305x165x40, 6 m lateral cantilever with the root warping fixed: M_cr >= CUS-06', UB('305 x 165 x 40'),
  { L: 6, ends: SS({ e1: { rz: true, warp: true }, e2: { uy: false, rx: false } }), loads: [UDL(0, 6, 3, 'G'), UDL(0, 6, 4, 'Q')] }, ['lateral-cantilever', 'warpFix'],
  { pair: { base: 'CUS-06', relation: 'ge', why: 'root warping fixed against free on a lateral cantilever' } });
mk('CUS-08', 'UB 457x191x82, 8 m SS, R_z restrained at End 1 only (one clamped end, one fork): M_cr >= the fork-ended UB-32 layout at e = 0', UB('457 x 191 x 82'),
  { L: 8, ends: SS({ e1: { rz: true } }), loads: [UDL(0, 8, 8, 'G'), UDL(0, 8, 10, 'Q')] }, ['clamped-one']);
mk('CUS-09', 'UB 457x191x82, 8 m fixed-fixed in plane with FORK ends for LTB (R_z released at both ends): the SN003a fixed-ended row with k = 1', UB('457 x 191 x 82'),
  { L: 8, ends: FIXFIX({ e1: { rz: false }, e2: { rz: false } }), loads: [UDL(0, 8, 14, 'G'), UDL(0, 8, 18, 'Q')] }, ['fixed-fork']);
mk('CUS-10', 'UB 305x165x40, 6 m SS in plane, laterally clamped AND warping fixed at both ends: M_cr >= CUS-01', UB('305 x 165 x 40'),
  { L: 6, ends: SS({ e1: { rz: true, warp: true }, e2: { rz: true, warp: true } }), loads: [UDL(0, 6, 5, 'G'), UDL(0, 6, 6, 'Q')] }, ['clamped', 'warpFix'],
  { pair: { base: 'CUS-01', relation: 'ge', why: 'warping fixed added to laterally clamped ends' } });
mk('CUS-11', 'UB 406x178x54, 6 m guided-fixed with the guided End 2 twist-free (R_x released): full UDL', UB('406 x 178 x 54'),
  { L: 6, ends: GF({ e2: { rx: false } }), loads: [UDL(0, 6, 3, 'G'), UDL(0, 6, 4, 'Q')] }, ['twist-free-end']);
mk('CUS-12', 'UB 356x171x45, 6 m fixed-pinned in plane, End 2 laterally free (U_y, R_x released): propped in plane, lateral cantilever for LTB', UB('356 x 171 x 45'),
  { L: 6, ends: PROPPED({ e2: { uy: false, rx: false } }), loads: [UDL(0, 6, 3, 'G'), UDL(0, 6, 4, 'Q')] }, ['lateral-cantilever']);
mk('CUS-13', 'PFC 200x90x30, 4 m SS, End 2 warping fixed only, load through the shear centre (asymmetric LTB boundary conditions on a channel)', PFC('200x90x30'),
  { L: 4, ends: SS({ e2: { warp: true } }), loads: [UDL(0, 4, 3, 'G'), UDL(0, 4, 5, 'Q')] }, ['warpFix']);
mk('CUS-14', 'SHS 150x150x6.3 HF, 4 m SS, laterally clamped (R_z both ends): closed section, LTB exempt by slenderness either way', SHS('150x150x6.3'),
  { L: 4, ends: SS({ e1: { rz: true }, e2: { rz: true } }), loads: [UDL(0, 4, 3, 'G'), UDL(0, 4, 6, 'Q')] }, ['clamped']);
mk('CUS-15', 'UB 457x191x82, 8 m SS, warping fixed at both ends, hogging end couples psi = +1 (uniform moment): M_cr >= the fork-ended UB-25 layout', UB('457 x 191 x 82'),
  { L: 8, ends: SS({ e1: { warp: true }, e2: { warp: true } }), loads: [MOM(0, 120, 'Q'), MOM(8, -120, 'Q')] }, ['warpFix']);
mk('CUS-16', 'UB 305x165x40, 6 m SS, U_x restrained at both ends without an axial force (no note, no error)', UB('305 x 165 x 40'),
  { L: 6, ends: SS({ e2: { ux: true } }), loads: [UDL(0, 6, 5, 'G'), UDL(0, 6, 6, 'Q')] }, ['ux-both']);

/* =========================================================================
   19 Sep 2026 gap-closure groups - every check exercised in both directions
   (a PASS and a FAIL / BLOCK per group). Loads are sized from probe runs so
   that the check under test governs the verdict where the title says so;
   "design intent" states the expected verdict of the eigen run. The ids and
   inputs pinned by tests/campaign.test.cjs are unchanged. WEB (G2 web
   transverse forces), UPL (G1 uplift / hold-down), TFB (G3 channel
   torsional-flexural buckling), HSV (G3 high-shear M_v,Rd / cl 6.2.10), TOR
   (G4 warping-torsion FE), AEF (G3 A_eff of a Class-4 web under N), BIX (G3
   I/H with M_z).
   ========================================================================= */
// ---- WEB: EN 1993-1-5 clause 6 / 7.2 (G2) ----
mk('WEB-01', 'UB 610x229x101 (t_w 10.5), 3 m SS, 600 kN central point load on the bare web (s_s = 0), restrained - design intent: FAIL F_Ed/F_Rd type (a), bending 0.85', UB('610 x 229 x 101'),
  { L: 3, ends: SS(), restraint: 'full', loads: [P(1.5, 600, 'Q')] }, ['web', '2.16', '2.18']);
mk('WEB-02', 'UB 610x229x101, 3 m SS, 600 kN central point load with s_s = 150 mm and a bearing stiffener declared, 150 mm seatings - design intent: PASS (stiffener advisory, supports still checked with a = 1.5 m panels: end reactions 452 kN vs F_Rd 502 kN at s_s = 150; 416 kN at the library 100 mm would fail)', UB('610 x 229 x 101'),
  { L: 3, ends: SS({ e1: { ss: 150 }, e2: { ss: 150 } }), restraint: 'full', loads: [P(1.5, 600, 'Q', { ss: 150, stiff: true })] }, ['web', 'stiffener', '2.16', '2.18']);
mk('WEB-03', 'UB 457x152x52 (t_w 7.6), 4 m SS, 180 kN central point load, s_s = 0 - design intent: FAIL on the 7.2 interaction only (F_Ed/F_Rd 0.82, bending 0.90)', UB('457 x 152 x 52'),
  { L: 4, ends: SS(), restraint: 'full', loads: [P(2, 180, 'Q')] }, ['web', '2.16', '2.18']);
mk('WEB-04', 'UB 533x210x92, 6 m SS, UDL 30 G + 40 Q, end reactions on short seatings s_s = 40 mm - design intent: FAIL type (c) end reaction (1.01), bending 0.71', UB('533 x 210 x 92'),
  { L: 6, ends: SS({ e1: { ss: 40 }, e2: { ss: 40 } }), restraint: 'full', loads: [UDL(0, 6, 30, 'G'), UDL(0, 6, 40, 'Q')] }, ['web', '2.16', '2.18']);
mk('WEB-05', 'UB 533x210x92, 6 m SS, UDL 30 G + 40 Q, end reactions on s_s = 100 mm - design intent: PASS type (c) 0.73 (WEB-04 with the actual seating)', UB('533 x 210 x 92'),
  { L: 6, ends: SS({ e1: { ss: 100 }, e2: { ss: 100 } }), restraint: 'full', loads: [UDL(0, 6, 30, 'G'), UDL(0, 6, 40, 'Q')] }, ['web', '2.16', '2.18']);
mk('WEB-06', 'RHS 250x150x6.3, 3 m SS, 80 kN central point load at e = 40 mm, s_s = 60 mm, restrained - design intent: PASS (two webs, lever-rule share 0.78 to the near web, box torsion)', RHS('250 x 150 x 6.3'),
  { L: 3, ends: SS(), restraint: 'full', eccOn: true, loads: [P(1.5, 80, 'Q', { ss: 60, e: 40 })] }, ['web', 'ecc-small', '2.16', '2.18']);
mk('WEB-07', 'UB 305x165x40, 3 m SS, 300 kN point load directly over End 2 (s_s = 100) - design intent: FAIL type (b) load through the web at the end with the type (c) end zone alongside, F_Ed = max(P, R) = R', UB('305 x 165 x 40'),
  { L: 3, ends: SS(), restraint: 'full', loads: [UDL(0, 3, 5, 'G'), P(3, 300, 'Q', { ss: 100 })] }, ['web', '2.16', '2.18']);
mk('WEB-08', 'PFC 200x90x30, 3 m SS, 60 kN central point load, s_s = 0, restrained - design intent: PASS (channel: one-sided flange b_f <= t_w + 15 eps t_f)', PFC('200x90x30'),
  { L: 3, ends: SS(), restraint: 'full', loads: [P(1.5, 60, 'Q')] }, ['web', '2.16', '2.18']);
mk('WEB-09', 'UB 533x210x92, 6 m fixed-fixed, UDL 30 G + 40 Q, end reactions on s_s = 40 mm (WEB-04 with fixed ends) - design intent: FAIL type (c) at a fixed end reaction (1.01) with the hogging end moment wL^2/12 in the 7.2 interaction (eta_1 = 0.47 at both ends; the End 2 station read the closing grid value M = 0 before the 19 Sep 2026 review fix F-A, hand-checks.md HC-17)', UB('533 x 210 x 92'),
  { L: 6, ends: FIXFIX({ e1: { ss: 40 }, e2: { ss: 40 } }), restraint: 'full', loads: [UDL(0, 6, 30, 'G'), UDL(0, 6, 40, 'Q')] }, ['web', 'fixed-end', '2.16', '2.18']);
mk('WEB-10', 'UB 406x178x54, 5 m guided-fixed, 60 kN point load at the guided end (no vertical reaction there: one web station at the fixed End 1 plus the load station), restrained - design intent: PASS', UB('406 x 178 x 54'),
  { L: 5, ends: GF(), restraint: 'full', loads: [UDL(0, 5, 4, 'G'), P(5, 60, 'Q', { ss: 100 })] }, ['web', 'guided', '2.16', '2.18']);
// ---- UPL: uplift / hold-down (G1) ----
mk('UPL-01', 'UB 406x178x54, 4 m SS, light G 3 kN/m + clockwise couple 60 kN.m (Q) at End 2 lifting End 1, no hold-down - design intent: NOT VERIFIED (ULS uplift R1 = 0.9G + 1.5Q = -16.1 kN blocks)', UB('406 x 178 x 54'),
  { L: 4, ends: SS(), loads: [UDL(0, 4, 3, 'G'), MOM(4, -60, 'Q')] }, ['uplift', '1.2']);
mk('UPL-02', 'UB 406x178x54, 4 m SS, light G + clockwise couple 60 kN.m (Q) at End 2, hold-down provided at End 1 - design intent: PASS with the hold-down design force advisory', UB('406 x 178 x 54'),
  { L: 4, ends: SS({ e1: { holdDown: true } }), loads: [UDL(0, 4, 3, 'G'), MOM(4, -60, 'Q')] }, ['uplift', 'hold-down', '1.2']);
mk('UPL-03', 'UB 254x146x31, 4 m SS, UDL 6 G + clockwise couple 30 kN.m (Q) at End 2 - design intent: PASS; End 1 lifts only in the Q-only SLS combination (advisory; the gamma_G,inf companions hold it down)', UB('254 x 146 x 31'),
  { L: 4, ends: SS(), loads: [UDL(0, 4, 6, 'G'), MOM(4, -30, 'Q')] }, ['uplift-sls', '1.2']);
mk('UPL-04', 'UB 203x133x25, 5 m SS, UDL G + Q with upward wind 6 kN/m, hold-downs provided at both ends - design intent: PASS; 1.0G + 1.5W lifts both ends (-18.1 kN) with the advisory', UB('203 x 133 x 25'),
  { L: 5, ends: SS({ e1: { holdDown: true }, e2: { holdDown: true } }), combos: GQW(), loads: [UDL(0, 5, 1.5, 'G'), UDL(0, 5, 3, 'Q'), UDL(0, 5, -6, 'W')] }, ['uplift', 'hold-down', '1.2']);
mk('UPL-05', 'RHS 250x150x8.0, 3 m SS, G 2 kN/m + clockwise couple 30 kN.m (Q) at End 2, restrained, no hold-down - design intent: NOT VERIFIED (ULS uplift on the restrained path)', RHS('250 x 150 x 8.0'),
  { L: 3, ends: SS(), restraint: 'full', loads: [UDL(0, 3, 2, 'G'), MOM(3, -30, 'Q')] }, ['uplift', '1.2']);
mk('UPL-06', 'UB 305x165x40, 6 m fixed-fixed, light G + upward wind 8 kN/m, hold-downs provided at both fixed ends - design intent: PASS; 1.0G + 1.5W lifts both ends with the advisory (uplift at fixed ends)', UB('305 x 165 x 40'),
  { L: 6, ends: FIXFIX({ e1: { holdDown: true }, e2: { holdDown: true } }), combos: GQW(), loads: [UDL(0, 6, 1.5, 'G'), UDL(0, 6, 6, 'Q'), UDL(0, 6, -8, 'W')] }, ['uplift', 'hold-down', '1.2']);
mk('UPL-07', 'UB 356x171x45, 6 m propped cantilever, light G + hogging couple 80 kN.m (Q) at the pinned End 2 lifting it, no hold-down - design intent: NOT VERIFIED (the pinned end of a propped member lifts at ULS)', UB('356 x 171 x 45'),
  { L: 6, ends: PROPPED(), loads: [UDL(0, 6, 2, 'G'), MOM(6, 80, 'Q')] }, ['uplift', '1.2']);
// ---- TFB: channel torsional / torsional-flexural buckling (G3 item 10) ----
mk('TFB-01', 'PFC 200x90x30, 4 m SS, UDL + N = 80 kN, unrestrained - design intent: PASS (N_cr,TF 1274 kN, chi_T 0.60, N_Ed/N_b,T,Rd 0.13; Eq 6.62 governs)', PFC('200x90x30'),
  { L: 4, ends: SS(), axial: 80, loads: [UDL(0, 4, 2, 'G'), UDL(0, 4, 3, 'Q')] }, ['tfb']);
mk('TFB-02', 'PFC 260x90x35, 5 m SS, UDL + N = 120 kN, restrained, user L_T = 2.5 m - design intent: PASS (N_cr,T with the entered torsional length)', PFC('260x90x35'),
  { L: 5, ends: SS(), restraint: 'full', axial: 120, LT: 2.5, loads: [UDL(0, 5, 4, 'G'), UDL(0, 5, 6, 'Q')] }, ['tfb', 'LT']);
mk('TFB-03', 'PFC 150x75x18, 6 m SS, lateral restraints at 1.5 m centres (L_cr,z = 1.5 m) but L_T = 6 m, N = 250 kN - design intent: FAIL on N_Ed/N_b,T,Rd (1.04): the torsional-flexural mode governs over flexural buckling', PFC('150x75x18'),
  { L: 6, ends: SS(), axial: 250, LT: 6, ltbRestraints: R(1.5, 3, 4.5), loads: [UDL(0, 6, 1, 'G'), UDL(0, 6, 1, 'Q')] }, ['tfb', 'LT', 'heavy']);
mk('TFB-04', 'PFC 300x100x46, 4 m SS, eccentric UDL e = 50 mm + N = 100 kN, restrained - design intent: NOT VERIFIED (combined torsion with N_Ed is blocked; 6.3.1.4 itself evaluates at 0.10)', PFC('300x100x46'),
  { L: 4, ends: SS(), restraint: 'full', axial: 100, eccOn: true, loads: [UDL(0, 4, 3, 'G', { e: 50 }), UDL(0, 4, 5, 'Q', { e: 50 })] }, ['tfb', 'ecc-large', 'torsion+N']);
// ---- HSV: high-shear M_v,Rd for every family and cl 6.2.10 (G3 items 7 / 12) ----
mk('HSV-01', 'UB 457x191x82, 2 m SS, 350 kN at 0.3 m (s_s = 100) + N = 1200 kN, 150 mm seatings, restrained - design intent: PASS; web Class 3 under N + M so the elastic M_v,y,Rd form and the linear 6.2.10 sum apply (0.73); end reaction 447 kN vs F_Rd 539 kN at s_s = 150 (437 kN at the library 100 mm would fail)', UB('457 x 191 x 82'),
  { L: 2, ends: SS({ e1: { ss: 150 }, e2: { ss: 150 } }), restraint: 'full', axial: 1200, loads: [P(0.3, 350, 'Q', { ss: 100 })] }, ['mvn', 'class3', '2.13']);
mk('HSV-02', 'PFC 300x100x46, 2 m SS, 250 kN at 0.3 m (s_s = 100), restrained - design intent: PASS; channel M_v,y,Rd = (W_pl,y - rho t_w h_w^2/4) f_y with rho = 0.19 (coexistent 0.59)', PFC('300x100x46'),
  { L: 2, ends: SS(), restraint: 'full', loads: [P(0.3, 250, 'Q', { ss: 100 })] }, ['mv-channel', '2.10']);
mk('HSV-03', 'PFC 300x100x46, 2 m SS, 345 kN at 0.3 m with a stiffener at the load and s_s = 200 at the supports, restrained - design intent: FAIL on the coexistent M-V check (rho = 0.98, 1.03) with V/V_pl 0.99', PFC('300x100x46'),
  { L: 2, ends: SS({ e1: { ss: 200 }, e2: { ss: 200 } }), restraint: 'full', loads: [P(0.3, 345, 'Q', { ss: 100, stiff: true })] }, ['mv-channel', 'heavy', '2.10']);
mk('HSV-04', 'RHS 300x100x10 (h/b = 3), 2 m SS, 470 kN at 0.3 m (s_s = 150), restrained - design intent: FAIL on the coexistent M-V check with the two-web form (W_pl - rho t (h - 2t)^2/2) f_y (1.06), bending 0.98', RHS('300 x 100 x 10.0'),
  { L: 2, ends: SS(), restraint: 'full', loads: [P(0.3, 470, 'Q', { ss: 150 })] }, ['mv-rhs', 'heavy', '2.10']);
mk('HSV-05', 'RHS 300x100x10, 2 m SS, 460 kN at 0.3 m (stiffener at the load) + N = 250 kN, restrained - design intent: FAIL cl 6.2.10 (1.02) with Eq 6.39 on the reduced-yield section (a_w,V = 0.5 cap)', RHS('300 x 100 x 10.0'),
  { L: 2, ends: SS(), restraint: 'full', axial: 250, loads: [P(0.3, 460, 'Q', { ss: 100, stiff: true })] }, ['mvn', 'mv-rhs', 'heavy', '2.13']);
mk('HSV-06', 'SHS 200x200x8.0 HF, 2 m SS, 280 kN at 0.3 m (s_s = 100) + M_z = 10 kN.m, restrained - design intent: PASS; cl 6.2.10 biaxial with alpha = beta = 1.66 on the reduced section (0.96)', SHS('200x200x8.0'),
  { L: 2, ends: SS(), restraint: 'full', Mz: 10, loads: [P(0.3, 280, 'Q', { ss: 100 })] }, ['mvn', 'biaxial', '2.13']);
mk('HSV-07', 'UB 610x229x101 S355, 3 m SS, 700 kN at 0.4 m (stiffener at the load) + N = 1500 kN, restrained - design intent: FAIL on the end-reaction web check (1.26) while the Class-3 6.2.10 sum passes (0.76)', UB('610 x 229 x 101'),
  { grade: 'S355', L: 3, ends: SS(), restraint: 'full', axial: 1500, loads: [P(0.4, 700, 'Q', { ss: 150, stiff: true })] }, ['mvn', 'class3', 'heavy', '2.13']);
mk('HSV-08', 'UB 457x191x82, 2 m fixed-fixed, 400 kN point load at 0.3 m from End 1 + N = 600 kN, fully restrained (high shear with N at a fixed end: cl 6.2.10 at the end station)', UB('457 x 191 x 82'),
  { L: 2, ends: FIXFIX({ e1: { ss: 150 }, e2: { ss: 150 } }), restraint: 'full', axial: 600, loads: [P(0.3, 400, 'Q', { ss: 100 })] }, ['mvn', '2.13']);
mk('HSV-09', 'UB 305x165x40, 6 m SS, 120 kN point load at 0.25 m from End 1 (high shear) + G UDL', UB('305 x 165 x 40'),
  { L: 6, ends: SS(), loads: [UDL(0, 6, 5, 'G'), P(0.25, 120, 'Q')] }, ['2.10']);
// ---- TOR: general warping-torsion FE (G4 item 11) ----
mk('TOR-01', 'PFC 200x90x30, 2.5 m cantilever, 13 kN tip load at e = 45 mm (flange half-width) + self-weight at e_sc, unrestrained - design intent: PASS since the cantilever preset restrains the root warping (Annex A 1.09 with the root warping free)', PFC('200x90x30'),
  { L: 2.5, ends: CANT(), eccOn: true, loads: [P(2.5, 13, 'Q', { e: 45 })] }, ['torsion-fe', 'ecc-large']);
mk('TOR-03', 'UB 533x210x92, 10 m SS, G UDL through the shear centre + partial UDL 3-7 m at e = 100 mm, unrestrained - design intent: PASS (Annex A 0.96); partial-span torque routed to the FE', UB('533 x 210 x 92'),
  { L: 10, ends: SS(), eccOn: true, loads: [UDL(0, 10, 4, 'G', { e: 0 }), UDL(3, 7, 6, 'Q', { e: 100 })] }, ['torsion-fe', 'ecc-large']);
mk('TOR-04', 'UC 203x203x60, 6 m SS, 25 kN central point load at e = 100 mm with both supports warping-restrained, unrestrained - design intent: PASS (Annex A 0.60 against 0.64 with fork ends; twist 0.056 vs 0.096 rad)', UC('203 x 203 x 60'),
  { L: 6, ends: SS({ e1: { warp: true }, e2: { warp: true } }), eccOn: true, loads: [P(3, 25, 'Q', { e: 100 })] }, ['torsion-fe', 'ecc-large', 'warpFix']);
mk('TOR-05', 'UB 305x165x40, 3 m cantilever, full UDL at e = 80 mm, unrestrained - design intent: PASS (Annex A 0.68); cantilever with a distributed torque: FE with the root warping fixed, SN006a on the standard route', UB('305 x 165 x 40'),
  { L: 3, ends: CANT(), eccOn: true, loads: [UDL(0, 3, 3, 'G', { e: 80 }), UDL(0, 3, 5, 'Q', { e: 80 })] }, ['torsion-fe', 'ecc-small']);
mk('TOR-07', 'UB 457x191x82, 4 m cantilever with the root warping FREE, tip point load at e = 80 mm (UB-49 with the seventh flag unticked: the closed form phi = TL/GI_T of a St Venant cantilever)', UB('457 x 191 x 82'),
  { L: 4, ends: CANT({ e1: { warp: false } }), eccOn: true, loads: [P(4, 20, 'Q', { e: 80 })] }, ['torsion-fe', 'ecc-small']);
mk('TOR-08', 'UB 406x178x54, 6 m fixed-fixed, UDL at e = 90 mm with both ends warping fixed (warping-fixed torsion inside a laterally clamped member)', UB('406 x 178 x 54'),
  { L: 6, ends: FIXFIX({ e1: { warp: true }, e2: { warp: true } }), eccOn: true, loads: [UDL(0, 6, 5, 'G', { e: 90 }), UDL(0, 6, 8, 'Q', { e: 90 })] }, ['torsion-fe', 'ecc-small', 'warpFix']);
// ---- AEF: A_eff of a Class-4 web in uniform compression (G3 item 6) ----
mk('AEF-01', 'UB 1016x305x222 (d/t_w 54.3), 8 m SS, UDL + N = 1500 kN, restrained - design intent: PASS; A_eff = 0.888 A in N_c,Rd, N_b,Rd and the Table 6.7 Class-4 column (Eq 6.62 0.82)', UB('1016 x 305 x 222'),
  { L: 8, ends: SS(), restraint: 'full', axial: 1500, loads: [UDL(0, 8, 20, 'G'), UDL(0, 8, 25, 'Q')] }, ['aeff', '1.9']);
mk('AEF-02', 'UB 914x305x201 (d/t_w 54.6), 6 m SS, UDL + N = 3300 kN, unrestrained - design intent: FAIL Eq 6.62 with A_eff = 0.887 A (N_Ed/N_c,Rd 0.55)', UB('914 x 305 x 201'),
  { L: 6, ends: SS(), axial: 3300, loads: [UDL(0, 6, 10, 'G'), UDL(0, 6, 12, 'Q')] }, ['aeff', 'heavy', '1.9']);
mk('AEF-03', 'UB 610x229x101 S355 (d/t_w 52.2 > 42 eps = 34.2), 5 m SS, UDL + N = 900 kN, unrestrained - design intent: PASS; grade S355 makes the web Class 4 in compression (rho 0.71, A_eff 0.872 A)', UB('610 x 229 x 101'),
  { grade: 'S355', L: 5, ends: SS(), axial: 900, loads: [UDL(0, 5, 8, 'G'), UDL(0, 5, 10, 'Q')] }, ['aeff', '1.9']);
mk('AEF-04', 'UB 1016x305x249, 12 m SS, UDL + N = 6000 kN, restrained - design intent: NOT VERIFIED (web Class 4 under the combined N + M stress gradient: the e_N shift is not implemented, blocked)', UB('1016 x 305 x 249'),
  { L: 12, ends: SS(), restraint: 'full', axial: 6000, loads: [UDL(0, 12, 19.7, 'G'), UDL(0, 12, 19.8, 'Q')] }, ['aeff', 'class4-gradient', '1.9', '-2.11', '-3.9', '-3.12']);
mk('AEF-05', 'UB 762x267x134 (d/t_w 54.1), 10 m SS, UDL + N = 1200 kN, mid-span lateral restraint (L_cr,z = 5 m) - design intent: PASS (Eq 6.62 0.87 with A_eff = 0.871 A and the shortened L_cr,z)', UB('762 x 267 x 134'),
  { L: 10, ends: SS(), axial: 1200, ltbRestraints: R(5), loads: [UDL(0, 10, 8, 'G'), UDL(0, 10, 10, 'Q')] }, ['aeff', '1.9']);
mk('AEF-06', 'UB 1016x305x222, 8 m fixed-fixed, UDL + N = 2200 kN, restrained (A_eff with L_cr = 0.7 L from the fixities)', UB('1016 x 305 x 222'),
  { L: 8, ends: FIXFIX(), restraint: 'full', axial: 2200, loads: [UDL(0, 8, 20, 'G'), UDL(0, 8, 25, 'Q')] }, ['aeff', '1.9']);
// ---- BIX: I/H with M_z (G3 item 5, minor-axis classification) ----
mk('BIX-01', 'UB 457x191x82, 8 m SS, demo UDL + M_z = 10 kN.m, restrained - design intent: PASS; Class 1 with the flange-outstand classification, plastic biaxial (M_y/M_N,y)^2 + M_z/M_N,z = 0.95', UB('457 x 191 x 82'),
  { L: 8, ends: SS(), restraint: 'full', Mz: 10, loads: [UDL(0, 8, 19.7, 'G'), UDL(0, 8, 19.8, 'Q')] }, ['biaxial', '2.12']);
mk('BIX-02', 'UB 457x191x82, 8 m SS, demo UDL + M_z = 60 kN.m, restrained - design intent: FAIL biaxial cross-section 1.55 (was NOT VERIFIED under the former uniform-compression web bound)', UB('457 x 191 x 82'),
  { L: 8, ends: SS(), restraint: 'full', Mz: 60, loads: [UDL(0, 8, 19.7, 'G'), UDL(0, 8, 19.8, 'Q')] }, ['biaxial', 'heavy', '2.12']);
mk('BIX-03', 'UB 533x210x92, 8 m SS, UDL + M_z = 15 kN.m, unrestrained - design intent: PASS (Eq 6.62 0.92 with k_zz = 1 and the LTB M_b,Rd)', UB('533 x 210 x 92'),
  { L: 8, ends: SS(), Mz: 15, loads: [UDL(0, 8, 8, 'G'), UDL(0, 8, 10, 'Q')] }, ['biaxial', '2.12']);
mk('BIX-04', 'UB 305x165x40, 5 m SS, UDL + N = 150 kN + M_z = 5 kN.m, unrestrained - design intent: PASS (Eq 6.62 0.95); beam-column with A_eff (d/t_w 44.2 > 42 eps) and Class 2 under the combined stress', UB('305 x 165 x 40'),
  { L: 5, ends: SS(), axial: 150, Mz: 5, loads: [UDL(0, 5, 4, 'G'), UDL(0, 5, 5, 'Q')] }, ['biaxial', 'aeff', '2.12']);
mk('BIX-05', 'UB 406x178x74, 6 m SS, central point loads + M_z = 25 kN.m, unrestrained - design intent: FAIL Eq 6.62 (1.08) with the plastic biaxial cross-section at 0.57', UB('406 x 178 x 74'),
  { L: 6, ends: SS(), Mz: 25, loads: [P(3, 40, 'G'), P(3, 50, 'Q')] }, ['biaxial', 'heavy', '2.12']);
// ---- G3 items 6 / 7 (A_eff, cl 6.2.10) on simply supported spans ----
mk('UB-46', 'UB 1016x305x249, 12 m SS, full UDL + axial compression 3000 kN, fully restrained (web Class 4 in uniform compression: A_eff, G3 item 6)', UB('1016 x 305 x 249'),
  { L: 12, ends: SS(), restraint: 'full', axial: 3000, loads: [UDL(0, 12, 19.7, 'G'), UDL(0, 12, 19.8, 'Q')] }, ['aeff']);
mk('UB-47', 'UB 457x191x82, 6 m SS, full UDL + axial compression 600 kN, unrestrained (Class 2 under N + M, A_eff for the compression terms, G3 item 6)', UB('457 x 191 x 82'),
  { L: 6, ends: SS(), axial: 600, loads: [UDL(0, 6, 5, 'G'), UDL(0, 6, 6, 'Q')] }, ['aeff']);
mk('UB-48', 'UB 457x191x82, 2 m SS, 400 kN point load 0.3 m from the support + axial compression 600 kN, fully restrained (high shear with N: cl 6.2.10, G3 item 7)', UB('457 x 191 x 82'),
  { L: 2, ends: SS(), restraint: 'full', axial: 600, loads: [P(0.3, 400, 'Q')] }, ['mvn']);

/* =========================================================================
   ERR - invalid layouts: analyse() must throw the named message
   ========================================================================= */
mkErr('ERR-01', 'SS with U_z released at End 2 (rigid-body rotation about End 1)', UB('305 x 165 x 40'),
  { L: 6, ends: SS({ e2: { uz: false } }), loads: [UDL(0, 6, 5, 'Q')] }, 'End 2 has no vertical restraint and End 1 does not restrain rotation: mechanism');
mkErr('ERR-02', 'U_z released at both ends (rigid-body vertical translation)', UB('305 x 165 x 40'),
  { L: 6, ends: SS({ e1: { uz: false }, e2: { uz: false } }), loads: [UDL(0, 6, 5, 'Q')] }, 'Neither end restrains vertical translation');
mkErr('ERR-03', 'SS with an internal hinge at mid-span (three-pin mechanism)', UB('305 x 165 x 40'),
  { L: 6, ends: SS(), hinges: [{ pos: 3 }], loads: [UDL(0, 6, 5, 'Q')] }, 'internal hinge');
mkErr('ERR-04', 'Cantilever rooted at End 2 (End 1 free): must be mirrored', UB('305 x 165 x 40'),
  { L: 6, ends: ENDS('ss', { e1: { uz: false, uy: false, rx: false, ux: false }, e2: { ux: true, ry: true, rz: true, warp: true } }), loads: [UDL(0, 6, 5, 'Q')] }, 'root at End 1');
mkErr('ERR-05', 'Eccentric load (torque) with twist R_x released at both ends (torsional mechanism)', UB('305 x 165 x 40'),
  { L: 6, ends: SS({ e1: { rx: false }, e2: { rx: false } }), restraint: 'full', eccOn: true, loads: [UDL(0, 6, 5, 'Q', { e: 50 })] }, 'torque but neither end restrains twist');
mkErr('ERR-06', 'Axial force with U_x released at both ends (no axial load path)', UB('305 x 165 x 40'),
  { L: 6, ends: SS({ e1: { ux: false } }), axial: 100, loads: [UDL(0, 6, 5, 'Q')] }, 'neither end restrains axial translation');
mkErr('ERR-07', 'LTB with lateral translation U_y released at both ends (singular lateral stiffness)', UB('305 x 165 x 40'),
  { L: 6, ends: SS({ e1: { uy: false }, e2: { uy: false } }), loads: [UDL(0, 6, 5, 'Q')] }, 'neither end restrains lateral translation');
mkErr('ERR-08', 'LTB with twist R_x released at both ends while U_y is held (no fork end)', UB('305 x 165 x 40'),
  { L: 6, ends: SS({ e1: { rx: false }, e2: { rx: false } }), loads: [UDL(0, 6, 5, 'Q')] }, 'no end restrains both');
mkErr('ERR-09', 'Lateral cantilever without R_z at the held end (End 2 U_y free, End 1 fork only)', UB('305 x 165 x 40'),
  { L: 6, ends: SS({ e2: { uy: false } }), loads: [UDL(0, 6, 5, 'Q')] }, 'lateral cantilever; that end must also restrain');
mkErr('ERR-10', 'Axial compression with a z-z sway mechanism (U_y at End 1 only, R_z nowhere), bending restrained', UB('305 x 165 x 40'),
  { L: 6, ends: SS({ e2: { uy: false } }), restraint: 'full', axial: 100, loads: [UDL(0, 6, 5, 'Q')] }, 'Strut buckling z-z');
mkErr('ERR-11', 'Guided at both ends (R_y only, no vertical restraint anywhere)', UB('305 x 165 x 40'),
  { L: 6, ends: ENDS('guided-fixed', { e1: { uz: false } }), loads: [UDL(0, 6, 5, 'Q')] }, 'Neither end restrains vertical translation');
mkErr('ERR-12', 'Fixed-pinned with two internal hinges (one hinge too many)', UB('305 x 165 x 40'),
  { L: 6, ends: PROPPED(), hinges: [{ pos: 2 }, { pos: 4 }], loads: [UDL(0, 6, 5, 'Q')] }, 'internal hinge');
mkErr('ERR-13', 'Internal hinge placed at an end (not inside the span)', UB('305 x 165 x 40'),
  { L: 6, ends: PROPPED(), hinges: [{ pos: 0 }], loads: [UDL(0, 6, 5, 'Q')] }, 'must be inside the span');
mkErr('ERR-14', 'Guided-fixed in plane with twist R_x released at both ends (U_y held at both: no fork end for the twist mode)', UB('305 x 165 x 40'),
  { L: 6, ends: GF({ e1: { rx: false }, e2: { rx: false } }), loads: [UDL(0, 6, 5, 'Q')] }, 'no end restrains both');

// ---- sanity: unique ids, pair bases exist ----
{
  const seen = new Set();
  cases.forEach(c => { if (seen.has(c.id)) throw new Error('duplicate case id ' + c.id); seen.add(c.id); });
  cases.forEach(c => { if (c.pair && !seen.has(c.pair.base)) throw new Error(c.id + ': pair base ' + c.pair.base + ' is not a case'); });
}

module.exports = { cases, helpers: { P, UDL, TRAP, MOM, SS, FIXFIX, PROPPED, CANT, GF, PG, ENDS, R, GQ, GQW, GQWneg, UB, UC, PFC, SHS, RHS, deriveTriggers } };
