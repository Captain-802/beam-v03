'use strict';
/* ===========================================================================
   100-beam verification campaign - case library
   ---------------------------------------------------------------------------
   Each case is {id, title, overrides, expect, tags}:
     overrides - the fields tests/harness.cjs reset() merges over DEMO
                 (js/03-state-ui.js): code, family, ubKey/ucKey/sectionKey/
                 shsKey/rhsKey, shsType, grade, L (m), supports [{pos,type}],
                 hinges [{pos}], loads (point/udl/trap/moment, case G/Q/W/E,
                 optional e mm and zg mm), combos, axial (kN, +compression),
                 Mz (kN.m), leFactor, destab, za (mm), rootWarp, restraint
                 'full'|'ltb', eccOn, mcrMethod, ltbRestraints [{pos,v,phi,vp,phip}],
                 divisor.
     expect    - trigger ids from docs/EC3_BEAM_TRIGGER_LIST.md that the case
                 is designed to exercise (derived from the inputs + tags).
   Every LTB case (restraint 'ltb') is run by tests/batch/run-batch.cjs with
   BOTH mcrMethod values; mcrMethod in overrides is only the case default.
   Loads are sized so that the governing utilisation of the eigen run lies
   mostly in the 0.6-0.95 band; a few cases are deliberately heavy (the demo
   beam, the long curve-d UB, eccentric channels) so that FAIL verdicts and
   the blocking messages are exercised too.
   Units in this file: m, kN, kN/m, kN.m, mm for e / zg / za.
   =========================================================================== */

// ---- load builders ----
const P    = (pos, P, cs = 'Q', x = {}) => Object.assign({ type: 'point', pos, P, case: cs }, x);
const UDL  = (x1, x2, w, cs = 'Q', x = {}) => Object.assign({ type: 'udl', x1, x2, w, case: cs }, x);
const TRAP = (x1, x2, w1, w2, cs = 'Q', x = {}) => Object.assign({ type: 'trap', x1, x2, w1, w2, case: cs }, x);
const MOM  = (pos, M, cs = 'Q') => ({ type: 'moment', pos, M, case: cs });

// ---- support builders ----
const SS      = L => [{ pos: 0, type: 'pinned' }, { pos: L, type: 'pinned' }];
const CANT    = () => [{ pos: 0, type: 'fixed' }];
const PROPPED = L => [{ pos: 0, type: 'fixed' }, { pos: L, type: 'pinned' }];
const FIXFIX  = L => [{ pos: 0, type: 'fixed' }, { pos: L, type: 'fixed' }];
const PINS    = (...pos) => pos.map(p => ({ pos: p, type: 'pinned' }));

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
  const sup = o.supports || [], loads = o.loads || [], hinges = o.hinges || [];
  const isCant = sup.length === 1 && sup[0].type === 'fixed';
  const maxSup = Math.max(...sup.map(s => s.pos));
  const overhang = !isCant && maxSup < o.L - 1e-9;
  const multi = sup.length >= 3;
  const anyFixed = sup.some(s => s.type === 'fixed');
  const box = o.family === 'shs' || o.family === 'rhs';
  if (isCant || overhang || hinges.length) t.add('1.2');
  if (hinges.length) t.add('1.4');
  if (loads.some(l => l.type === 'point') || multi || hinges.length || anyFixed) t.add('2.10');
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
  return [...t].sort((a, b) => { const [a1, a2] = a.split('.').map(Number), [b1, b2] = b.split('.').map(Number); return a1 - b1 || a2 - b2; });
}

const cases = [];
function mk(id, title, sec, ov, tags = []) {
  const overrides = Object.assign({ code: 'EC3', grade: 'S275', restraint: 'ltb', mcrMethod: 'eigen', hinges: [], combos: GQ() }, sec, ov);
  if (!overrides.supports) throw new Error(id + ': supports missing');
  if (!overrides.loads) throw new Error(id + ': loads missing');
  cases.push({ id, title, overrides, expect: deriveTriggers(overrides, tags), tags });
}

/* =========================================================================
   UB - universal beams (deep, stocky, narrow, small)
   ========================================================================= */
mk('UB-01', 'UB 457x191x82, 8 m SS, full UDL G+Q (demo), fully restrained', UB('457 x 191 x 82'),
  { L: 8, supports: SS(8), loads: [UDL(0, 8, 19.7, 'G'), UDL(0, 8, 19.8, 'Q')], restraint: 'full' }, ['demo']);
mk('UB-02', 'UB 457x191x82, 8 m SS, full UDL G+Q (demo), unrestrained (deliberately heavy)', UB('457 x 191 x 82'),
  { L: 8, supports: SS(8), loads: [UDL(0, 8, 19.7, 'G'), UDL(0, 8, 19.8, 'Q')] }, ['demo', 'heavy']);
mk('UB-03', 'UB 305x165x40, 6 m SS, full UDL, unrestrained, load at shear centre', UB('305 x 165 x 40'),
  { L: 6, supports: SS(6), loads: [UDL(0, 6, 5, 'G'), UDL(0, 6, 6, 'Q')] });
mk('UB-04', 'UB 305x165x40, 6 m SS, full UDL, top-flange loading zg = +D/2', UB('305 x 165 x 40'),
  { L: 6, supports: SS(6), eccOn: true, za: 152, loads: [UDL(0, 6, 5, 'G', { e: 0, zg: 152 }), UDL(0, 6, 6, 'Q', { e: 0, zg: 152 })] }, ['zg-top']);
mk('UB-05', 'UB 305x165x40, 6 m SS, full UDL, bottom-flange loading zg = -D/2', UB('305 x 165 x 40'),
  { L: 6, supports: SS(6), eccOn: true, za: -152, loads: [UDL(0, 6, 6, 'G', { e: 0, zg: -152 }), UDL(0, 6, 8, 'Q', { e: 0, zg: -152 })] }, ['zg-bottom']);
mk('UB-06', 'UB 406x178x54, 7 m SS, central point load with a lateral restraint at the load', UB('406 x 178 x 54'),
  { L: 7, supports: SS(7), loads: [P(3.5, 20, 'G'), P(3.5, 60, 'Q')], ltbRestraints: R(3.5) });
mk('UB-07', 'UB 406x178x54, 7 m SS, central point load, unrestrained', UB('406 x 178 x 54'),
  { L: 7, supports: SS(7), loads: [P(3.5, 12, 'G'), P(3.5, 32, 'Q')] });
mk('UB-08', 'UB 533x210x92, 10 m SS, two point loads at 3 and 7 m + UDL, restraints at third points', UB('533 x 210 x 92'),
  { L: 10, supports: SS(10), loads: [UDL(0, 10, 5, 'G'), P(3, 20, 'G'), P(7, 20, 'G'), P(3, 50, 'Q'), P(7, 50, 'Q')], ltbRestraints: R(10 / 3, 20 / 3) });
mk('UB-09', 'UB 254x146x31, 5 m SS, partial UDL 1-4 m + full G', UB('254 x 146 x 31'),
  { L: 5, supports: SS(5), loads: [UDL(0, 5, 3, 'G'), UDL(1, 4, 11, 'Q')] });
mk('UB-10', 'UB 356x171x45, 7 m SS, triangular load rising 0 -> 11 kN/m', UB('356 x 171 x 45'),
  { L: 7, supports: SS(7), loads: [UDL(0, 7, 3, 'G'), TRAP(0, 7, 0, 11, 'Q')] });
mk('UB-11', 'UB 356x171x45, 7 m SS, triangular load falling 26 -> 0 kN/m, fully restrained', UB('356 x 171 x 45'),
  { L: 7, supports: SS(7), restraint: 'full', loads: [UDL(0, 7, 6, 'G'), TRAP(0, 7, 26, 0, 'Q')] });
mk('UB-12', 'UB 457x152x52, 6 m SS, trapezoidal 6 -> 16 kN/m', UB('457 x 152 x 52'),
  { L: 6, supports: SS(6), loads: [UDL(0, 6, 4, 'G'), TRAP(0, 6, 6, 16, 'Q')] });
mk('UB-13', 'UB 610x229x125, 12 m SS, full UDL, restraints at third points', UB('610 x 229 x 125'),
  { L: 12, supports: SS(12), loads: [UDL(0, 12, 10, 'G'), UDL(0, 12, 14, 'Q')], ltbRestraints: R(4, 8) });
mk('UB-14', 'UB 686x254x140, 2 x 6 m continuous, full UDL', UB('686 x 254 x 140'),
  { L: 12, supports: PINS(0, 6, 12), loads: [UDL(0, 12, 45, 'G'), UDL(0, 12, 60, 'Q')] });
mk('UB-15', 'UB 762x267x147, 3 x 5 m continuous, G full + Q on outer spans (unbalanced pattern)', UB('762 x 267 x 147'),
  { L: 15, supports: PINS(0, 5, 10, 15), loads: [UDL(0, 15, 50, 'G'), UDL(0, 5, 90, 'Q'), UDL(10, 15, 90, 'Q')] }, ['1.2']);
mk('UB-16', 'UB 914x305x224, 16 m SS deep beam, full UDL, fully restrained', UB('914 x 305 x 224'),
  { L: 16, supports: SS(16), restraint: 'full', loads: [UDL(0, 16, 20, 'G'), UDL(0, 16, 25, 'Q')] });
mk('UB-17', 'UB 1016x305x272, 2 x 9 m continuous, full UDL, restraints at 3 m centres', UB('1016 x 305 x 272'),
  { L: 18, supports: PINS(0, 9, 18), loads: [UDL(0, 18, 60, 'G'), UDL(0, 18, 80, 'Q')], ltbRestraints: R(3, 6, 12, 15) });
mk('UB-18', 'UB 203x133x25, 4 m cantilever, UDL + tip point load, warping free at root', UB('203 x 133 x 25'),
  { L: 4, supports: CANT(), divisor: 180, loads: [UDL(0, 4, 1, 'G'), UDL(0, 4, 1.5, 'Q'), P(4, 2, 'Q')] });
mk('UB-19', 'UB 254x102x22, 3 m cantilever, tip point load, root warping restrained', UB('254 x 102 x 22'),
  { L: 3, supports: CANT(), divisor: 180, rootWarp: 'restrained', loads: [P(3, 10, 'Q')] });
mk('UB-20', 'UB 305x127x37, 6 m propped cantilever, full UDL', UB('305 x 127 x 37'),
  { L: 6, supports: PROPPED(6), loads: [UDL(0, 6, 6, 'G'), UDL(0, 6, 7, 'Q')] });
mk('UB-21', 'UB 406x140x39, 8 m fixed-fixed, full UDL (h/b > 2, curve c)', UB('406 x 140 x 39'),
  { L: 8, supports: FIXFIX(8), loads: [UDL(0, 8, 5, 'G'), UDL(0, 8, 6, 'Q')] });
mk('UB-22', 'UB 610x178x82, 9 m SS, full UDL (h/b > 3.1, curve d), deliberately heavy', UB('610 x 178 x 82'),
  { L: 9, supports: SS(9), loads: [UDL(0, 9, 8, 'G'), UDL(0, 9, 8, 'Q')] }, ['heavy']);
mk('UB-23', 'UB 457x191x67, 7 m span + 2 m overhang, UDL + tip point load', UB('457 x 191 x 67'),
  { L: 9, supports: PINS(0, 7), loads: [UDL(0, 9, 12, 'G'), UDL(0, 9, 15, 'Q'), P(9, 25, 'Q')] });
mk('UB-24', 'UB 533x165x66, 3 x 4 m Gerber beam, internal hinge at 6 m, full UDL', UB('533 x 165 x 66'),
  { L: 12, supports: PINS(0, 4, 8, 12), hinges: [{ pos: 6 }], loads: [UDL(0, 12, 30, 'G'), UDL(0, 12, 50, 'Q')] });
mk('UB-25', 'UB 356x127x33, 6 m SS, equal end couples (uniform moment, psi = 1)', UB('356 x 127 x 33'),
  { L: 6, supports: SS(6), loads: [MOM(0, 24, 'Q'), MOM(6, -24, 'Q')] });
mk('UB-26', 'UB 356x127x33, 6 m SS, single end couple (linear gradient, psi = 0)', UB('356 x 127 x 33'),
  { L: 6, supports: SS(6), loads: [MOM(0, 40, 'Q')] });
mk('UB-27', 'UB 457x191x82, 8 m SS, UDL + in-span couple at 4 m + point load at 2 m (mixed)', UB('457 x 191 x 82'),
  { L: 8, supports: SS(8), loads: [UDL(0, 8, 6, 'G'), UDL(0, 8, 6, 'Q'), MOM(4, 72, 'Q'), P(2, 18, 'Q')] });
mk('UB-28', 'UB 406x178x74, 6 m SS, full UDL + axial compression 400 kN (~0.15 Npl)', UB('406 x 178 x 74'),
  { L: 6, supports: SS(6), axial: 400, loads: [UDL(0, 6, 6, 'G'), UDL(0, 6, 8, 'Q')] });
mk('UB-29', 'UB 305x165x40, 5 m SS, full UDL + axial tension 300 kN, fully restrained', UB('305 x 165 x 40'),
  { L: 5, supports: SS(5), restraint: 'full', axial: -300, loads: [UDL(0, 5, 14, 'G'), UDL(0, 5, 18, 'Q')] });
mk('UB-30', 'UB 254x146x31, 5 m SS, full UDL + minor-axis moment Mz = 8 kN.m, fully restrained', UB('254 x 146 x 31'),
  { L: 5, supports: SS(5), restraint: 'full', Mz: 8, loads: [UDL(0, 5, 4.5, 'G'), UDL(0, 5, 6, 'Q')] });
mk('UB-31', 'UB 254x146x31, 5 m SS, full UDL + Mz = 8 kN.m, unrestrained (biaxial + LTB)', UB('254 x 146 x 31'),
  { L: 5, supports: SS(5), Mz: 8, loads: [UDL(0, 5, 3.5, 'G'), UDL(0, 5, 4.5, 'Q')] });
mk('UB-32', 'UB 457x191x82, 8 m SS, full UDL at e = 95 mm (flange half-width), unrestrained', UB('457 x 191 x 82'),
  { L: 8, supports: SS(8), eccOn: true, loads: [UDL(0, 8, 4, 'G', { e: 95, zg: 0 }), UDL(0, 8, 5, 'Q', { e: 95, zg: 0 })] }, ['ecc-large']);
mk('UB-33', 'UB 457x191x82, 8 m SS, full UDL at e = 20 mm (small), fully restrained', UB('457 x 191 x 82'),
  { L: 8, supports: SS(8), restraint: 'full', eccOn: true, loads: [UDL(0, 8, 16, 'G', { e: 20 }), UDL(0, 8, 19, 'Q', { e: 20 })] }, ['ecc-small']);
mk('UB-34', 'UB 203x102x23, 4 m SS, two point loads near the supports (0.3 and 3.7 m)', UB('203 x 102 x 23'),
  { L: 4, supports: SS(4), loads: [P(0.3, 64, 'Q'), P(3.7, 64, 'Q')] });
mk('UB-35', 'UB 914x419x388, 3 m SS, central 3000 kN point load (high shear at the maximum moment), restrained', UB('914 x 419 x 388'),
  { L: 3, supports: SS(3), restraint: 'full', loads: [P(1.5, 3000, 'Q')] }, ['2.10']);
mk('UB-36', 'UB 178x102x19, 4 m SS, UDL G+Q with upward wind W (uplift combinations)', UB('178 x 102 x 19'),
  { L: 4, supports: SS(4), combos: GQW(), loads: [UDL(0, 4, 2.5, 'G'), UDL(0, 4, 5.5, 'Q'), UDL(0, 4, -8, 'W')] }, ['uplift']);
mk('UB-37', 'UB 152x89x16, 3.5 m SS, UDL G+Q with wind reversed through a negative factor', UB('152 x 89 x 16'),
  { L: 3.5, supports: SS(3.5), combos: GQWneg(), loads: [UDL(0, 3.5, 2.5, 'G'), UDL(0, 3.5, 5.5, 'Q'), UDL(0, 3.5, 6, 'W')] }, ['uplift']);
mk('UB-38', 'UB 127x76x13, 3 m SS, central point load, fully restrained (smallest UB)', UB('127 x 76 x 13'),
  { L: 3, supports: SS(3), restraint: 'full', loads: [P(1.5, 12.5, 'Q')] });
mk('UB-39', 'UB 838x292x176, 14 m SS, full UDL, quarter-point restraints, top-flange loading', UB('838 x 292 x 176'),
  { L: 14, supports: SS(14), eccOn: true, za: 417, loads: [UDL(0, 14, 20, 'G', { e: 0, zg: 417 }), UDL(0, 14, 25, 'Q', { e: 0, zg: 417 })], ltbRestraints: R(3.5, 7, 10.5) }, ['zg-top']);
mk('UB-40', 'UB 533x210x92, 8 m SS, full UDL, LE factor 1.2 + destabilising switch', UB('533 x 210 x 92'),
  { L: 8, supports: SS(8), leFactor: 1.2, destab: true, loads: [UDL(0, 8, 9, 'G'), UDL(0, 8, 11, 'Q')] });
mk('UB-41', 'UB 610x229x125, 2 x 5 m continuous, Q on span 1 only, warping-restrained ends', UB('610 x 229 x 125'),
  { L: 10, supports: [{ pos: 0, type: 'pinned', phip: true }, { pos: 5, type: 'pinned' }, { pos: 10, type: 'pinned', phip: true }], loads: [UDL(0, 10, 45, 'G'), UDL(0, 5, 90, 'Q')] }, ['1.2']);
mk('UB-42', 'UB 356x171x45, 8 m SS, full UDL, grade S355', UB('356 x 171 x 45'),
  { L: 8, supports: SS(8), grade: 'S355', loads: [UDL(0, 8, 2.5, 'G'), UDL(0, 8, 3.2, 'Q')] });

/* =========================================================================
   UC - universal columns used as beams
   ========================================================================= */
mk('UC-01', 'UC 203x203x46, 5 m SS, full UDL, fully restrained', UC('203 x 203 x 46'),
  { L: 5, supports: SS(5), restraint: 'full', loads: [UDL(0, 5, 8, 'G'), UDL(0, 5, 14, 'Q')] });
mk('UC-02', 'UC 203x203x46, 5 m SS, full UDL, unrestrained', UC('203 x 203 x 46'),
  { L: 5, supports: SS(5), loads: [UDL(0, 5, 8, 'G'), UDL(0, 5, 13, 'Q')] });
mk('UC-03', 'UC 152x152x23, 4 m SS, central point load, top-flange loading', UC('152 x 152 x 23'),
  { L: 4, supports: SS(4), eccOn: true, za: 76, loads: [P(2, 18.5, 'Q', { e: 0, zg: 76 })] }, ['zg-top']);
mk('UC-04', 'UC 152x152x30, 3 m cantilever, full UDL', UC('152 x 152 x 30'),
  { L: 3, supports: CANT(), divisor: 180, loads: [UDL(0, 3, 3.5, 'G'), UDL(0, 3, 4.7, 'Q')] });
mk('UC-05', 'UC 254x254x73, 6 m SS, full UDL + axial compression 700 kN (~0.27 Npl)', UC('254 x 254 x 73'),
  { L: 6, supports: SS(6), axial: 700, loads: [UDL(0, 6, 7, 'G'), UDL(0, 6, 11, 'Q')] });
mk('UC-06', 'UC 254x254x89, 7 m SS, full UDL + Mz = 20 kN.m', UC('254 x 254 x 89'),
  { L: 7, supports: SS(7), Mz: 20, loads: [UDL(0, 7, 10, 'G'), UDL(0, 7, 12, 'Q')] });
mk('UC-07', 'UC 305x305x97, 2 x 4 m continuous, full UDL', UC('305 x 305 x 97'),
  { L: 8, supports: PINS(0, 4, 8), loads: [UDL(0, 8, 50, 'G'), UDL(0, 8, 70, 'Q')] });
mk('UC-08', 'UC 305x305x118, 9 m SS, full UDL, restraints at third points', UC('305 x 305 x 118'),
  { L: 9, supports: SS(9), loads: [UDL(0, 9, 11, 'G'), UDL(0, 9, 14, 'Q')], ltbRestraints: R(3, 6) });
mk('UC-09', 'UC 356x368x129, 10 m SS, triangular load 0 -> 30 kN/m + G', UC('356 x 368 x 129'),
  { L: 10, supports: SS(10), loads: [UDL(0, 10, 10, 'G'), TRAP(0, 10, 0, 30, 'Q')] });
mk('UC-10', 'UC 356x406x235, 8 m SS, three 125 kN point loads + UDL, restrained (stocky)', UC('356 x 406 x 235'),
  { L: 8, supports: SS(8), restraint: 'full', loads: [UDL(0, 8, 12, 'G'), P(2, 125, 'Q'), P(4, 125, 'Q'), P(6, 125, 'Q')] });
mk('UC-11', 'UC 203x203x60, 6 m propped cantilever, full UDL + axial tension 200 kN', UC('203 x 203 x 60'),
  { L: 6, supports: PROPPED(6), axial: -200, loads: [UDL(0, 6, 10, 'G'), UDL(0, 6, 13, 'Q')] });
mk('UC-12', 'UC 203x203x86, 6 m fixed-fixed, central point load + axial compression 800 kN (~0.27 Npl)', UC('203 x 203 x 86'),
  { L: 6, supports: FIXFIX(6), axial: 800, loads: [P(3, 66, 'Q')] });
mk('UC-13', 'UC 152x152x37, 5 m SS, equal and opposite end couples (double curvature, psi = -1)', UC('152 x 152 x 37'),
  { L: 5, supports: SS(5), loads: [MOM(0, 48, 'Q'), MOM(5, 48, 'Q')] });

/* =========================================================================
   PFC - parallel flange channels, with and without eccentricity
   ========================================================================= */
mk('PFC-01', 'PFC 180x75x20, 4 m SS, full UDL through the shear centre, fully restrained', PFC('180x75x20'),
  { L: 4, supports: SS(4), restraint: 'full', loads: [UDL(0, 4, 5, 'G'), UDL(0, 4, 8, 'Q')] });
mk('PFC-02', 'PFC 180x75x20, 4 m SS, full UDL through the shear centre, unrestrained', PFC('180x75x20'),
  { L: 4, supports: SS(4), loads: [UDL(0, 4, 3, 'G'), UDL(0, 4, 5, 'Q')] });
mk('PFC-03', 'PFC 200x90x30, 4 m SS, full UDL e = 0 with eccentricity ON (self-weight offset only)', PFC('200x90x30'),
  { L: 4, supports: SS(4), eccOn: true, loads: [UDL(0, 4, 2, 'G', { e: 0 }), UDL(0, 4, 3, 'Q', { e: 0 })] }, ['ecc-zero']);
mk('PFC-04', 'PFC 200x90x30, 4 m SS, full UDL at e = 20 mm (small)', PFC('200x90x30'),
  { L: 4, supports: SS(4), eccOn: true, loads: [UDL(0, 4, 2, 'G', { e: 20 }), UDL(0, 4, 3, 'Q', { e: 20 })] }, ['ecc-small']);
mk('PFC-05', 'PFC 200x90x30, 4 m SS, full UDL at e = 45 mm (flange half-width)', PFC('200x90x30'),
  { L: 4, supports: SS(4), eccOn: true, loads: [UDL(0, 4, 2, 'G', { e: 45 }), UDL(0, 4, 3, 'Q', { e: 45 })] }, ['ecc-large']);
mk('PFC-06', 'PFC 230x90x32, 6 m SS, central point load at e = 45 mm, fully restrained', PFC('230x90x32'),
  { L: 6, supports: SS(6), restraint: 'full', eccOn: true, loads: [P(3, 25, 'Q', { e: 45 })] }, ['ecc-large']);
mk('PFC-07', 'PFC 260x90x35, 4 m SS, full UDL at e = 30 mm and top-flange height zg = +D/2', PFC('260x90x35'),
  { L: 4, supports: SS(4), eccOn: true, za: 130, loads: [UDL(0, 4, 3, 'G', { e: 30, zg: 130 }), UDL(0, 4, 4, 'Q', { e: 30, zg: 130 })] }, ['zg-top']);
mk('PFC-08', 'PFC 300x100x46, 5 m SS, triangular load 0 -> 10 kN/m at e = 50 mm + G', PFC('300x100x46'),
  { L: 5, supports: SS(5), eccOn: true, loads: [UDL(0, 5, 3, 'G', { e: 50 }), TRAP(0, 5, 0, 10, 'Q', { e: 50 })] }, ['ecc-large']);
mk('PFC-09', 'PFC 300x90x41, 3.5 m cantilever, full UDL through the shear centre', PFC('300x90x41'),
  { L: 3.5, supports: CANT(), divisor: 180, loads: [UDL(0, 3.5, 4, 'G'), UDL(0, 3.5, 6, 'Q')] });
mk('PFC-10', 'PFC 380x100x54, 2 x 4 m continuous, full UDL through the shear centre', PFC('380x100x54'),
  { L: 8, supports: PINS(0, 4, 8), loads: [UDL(0, 8, 20, 'G'), UDL(0, 8, 30, 'Q')] });
mk('PFC-11', 'PFC 430x100x64, 4 m SS, full UDL + axial compression 150 kN, restrained (torsional buckling gap)', PFC('430x100x64'),
  { L: 4, supports: SS(4), restraint: 'full', axial: 150, loads: [UDL(0, 4, 6, 'G'), UDL(0, 4, 8, 'Q')] });
mk('PFC-12', 'PFC 150x75x18, 3 m SS, central point load at e = 37 mm (flange half-width)', PFC('150x75x18'),
  { L: 3, supports: SS(3), eccOn: true, loads: [P(1.5, 12, 'Q', { e: 37 })] }, ['ecc-large']);
mk('PFC-13', 'PFC 125x65x15, 3 m SS, full UDL + Mz = 1.5 kN.m', PFC('125x65x15'),
  { L: 3, supports: SS(3), Mz: 1.5, loads: [UDL(0, 3, 1, 'G'), UDL(0, 3, 4, 'Q')] });
mk('PFC-14', 'PFC 260x75x28, 4 m SS, full UDL + point load at 1.5 m, all at e = 25 mm', PFC('260x75x28'),
  { L: 4, supports: SS(4), eccOn: true, loads: [UDL(0, 4, 2, 'G', { e: 25 }), UDL(0, 4, 3, 'Q', { e: 25 }), P(1.5, 8, 'Q', { e: 25 })] }, ['ecc-small']);
mk('PFC-15', 'PFC 100x50x10, 2.5 m SS, full UDL, fully restrained (smallest PFC)', PFC('100x50x10'),
  { L: 2.5, supports: SS(2.5), restraint: 'full', loads: [UDL(0, 2.5, 1.5, 'G'), UDL(0, 2.5, 5, 'Q')] });
mk('PFC-16', 'PFC 230x75x26, 5 m propped cantilever, full UDL at e = 30 mm (fork-fork torsion with in-plane fixity)', PFC('230x75x26'),
  { L: 5, supports: PROPPED(5), eccOn: true, loads: [UDL(0, 5, 4, 'G', { e: 30 }), UDL(0, 5, 6, 'Q', { e: 30 })] }, ['ecc-small']);
mk('PFC-17', 'PFC 150x90x24, 4 m SS, partial UDL 1-3 m at e = 30 mm (partial-span torque, not covered)', PFC('150x90x24'),
  { L: 4, supports: SS(4), eccOn: true, loads: [UDL(1, 3, 10, 'Q', { e: 30 })] }, ['ecc-small']);
mk('PFC-18', 'PFC 180x90x26, 5 m SS, full UDL, restraints at third points', PFC('180x90x26'),
  { L: 5, supports: SS(5), loads: [UDL(0, 5, 3, 'G'), UDL(0, 5, 5, 'Q')], ltbRestraints: R(5 / 3, 10 / 3) });

/* =========================================================================
   SHS - square hollow sections (hot-finished and cold-formed)
   ========================================================================= */
mk('SHS-01', 'SHS 100x100x5.0 HF, 3 m SS, full UDL, fully restrained', SHS('100x100x5.0'),
  { L: 3, supports: SS(3), restraint: 'full', loads: [UDL(0, 3, 2, 'G'), UDL(0, 3, 4, 'Q')] });
mk('SHS-02', 'SHS 100x100x5.0 HF, 3 m SS, full UDL, unrestrained (LTB exempt by slenderness)', SHS('100x100x5.0'),
  { L: 3, supports: SS(3), loads: [UDL(0, 3, 2, 'G'), UDL(0, 3, 4, 'Q')] });
mk('SHS-03', 'SHS 150x150x6.3 HF, 5 m SS, central point load, unrestrained', SHS('150x150x6.3'),
  { L: 5, supports: SS(5), loads: [P(2.5, 11.5, 'Q')] });
mk('SHS-04', 'SHS 200x200x8.0 HF, 6 m SS, full UDL + axial compression 450 kN (~0.27 Npl)', SHS('200x200x8.0'),
  { L: 6, supports: SS(6), axial: 450, loads: [UDL(0, 6, 3.5, 'G'), UDL(0, 6, 6, 'Q')] });
mk('SHS-05', 'SHS 250x250x10.0 HF, 2 x 4 m continuous, full UDL', SHS('250x250x10.0'),
  { L: 8, supports: PINS(0, 4, 8), loads: [UDL(0, 8, 25, 'G'), UDL(0, 8, 40, 'Q')] });
mk('SHS-06', 'SHS 300x300x10.0 HF, 4 m cantilever, tip point load + UDL', SHS('300x300x10.0'),
  { L: 4, supports: CANT(), divisor: 180, loads: [UDL(0, 4, 3.5, 'G'), P(4, 30, 'Q')] });
mk('SHS-07', 'SHS 100x100x4.0 CF, 3 m SS, full UDL at e = 40 mm (cold-formed torsion constants)', SHS('100x100x4.0', 'CF'),
  { L: 3, supports: SS(3), eccOn: true, loads: [UDL(0, 3, 0.6, 'G', { e: 40 }), UDL(0, 3, 3.2, 'Q', { e: 40 })] }, ['ecc-large']);
mk('SHS-08', 'SHS 150x150x5.0 CF, 4 m SS, full UDL, fully restrained', SHS('150x150x5.0', 'CF'),
  { L: 4, supports: SS(4), restraint: 'full', loads: [UDL(0, 4, 1.5, 'G'), UDL(0, 4, 5.8, 'Q')] });
mk('SHS-09', 'SHS 200x200x6.0 CF, 6 m SS, two point loads + Mz = 4 kN.m, fully restrained', SHS('200x200x6.0', 'CF'),
  { L: 6, supports: SS(6), restraint: 'full', Mz: 4, loads: [P(2, 11, 'Q'), P(4, 11, 'Q')] });
mk('SHS-10', 'SHS 120x120x5.0 HF, 4 m SS, full UDL + axial tension 100 kN', SHS('120x120x5.0'),
  { L: 4, supports: SS(4), axial: -100, loads: [UDL(0, 4, 1, 'G'), UDL(0, 4, 3, 'Q')] });
mk('SHS-11', 'SHS 80x80x5.0 HF, 2.5 m SS, full UDL at e = 40 mm (half width), fully restrained', SHS('80x80x5.0'),
  { L: 2.5, supports: SS(2.5), restraint: 'full', eccOn: true, loads: [UDL(0, 2.5, 0.8, 'G', { e: 40 }), UDL(0, 2.5, 3.4, 'Q', { e: 40 })] }, ['ecc-large']);

/* =========================================================================
   RHS - rectangular hollow sections, including slender h/b
   ========================================================================= */
mk('RHS-01', 'RHS 200x100x8.0, 5 m SS, full UDL, fully restrained', RHS('200 x 100 x 8.0'),
  { L: 5, supports: SS(5), restraint: 'full', loads: [UDL(0, 5, 4, 'G'), UDL(0, 5, 7, 'Q')] });
mk('RHS-02', 'RHS 200x100x8.0, 5 m SS, full UDL, unrestrained', RHS('200 x 100 x 8.0'),
  { L: 5, supports: SS(5), loads: [UDL(0, 5, 4, 'G'), UDL(0, 5, 7, 'Q')] });
mk('RHS-03', 'RHS 300x100x10.0 (h/b = 3), 8 m SS, full UDL, unrestrained', RHS('300 x 100 x 10.0'),
  { L: 8, supports: SS(8), loads: [UDL(0, 8, 3.5, 'G'), UDL(0, 8, 5.7, 'Q')] });
mk('RHS-04', 'RHS 500x200x12.5 (h/b = 2.5), 12 m SS, full UDL, unrestrained', RHS('500 x 200 x 12.5'),
  { L: 12, supports: SS(12), loads: [UDL(0, 12, 9, 'G'), UDL(0, 12, 11, 'Q')] });
mk('RHS-05', 'RHS 250x100x8.0, 7 m SS, central point load + G UDL', RHS('250 x 100 x 8.0'),
  { L: 7, supports: SS(7), loads: [UDL(0, 7, 2.3, 'G'), P(3.5, 19, 'Q')] });
mk('RHS-06', 'RHS 150x100x6.3, 4 m SS, full UDL + axial compression 200 kN (~0.25 Npl)', RHS('150 x 100 x 6.3'),
  { L: 4, supports: SS(4), axial: 200, loads: [UDL(0, 4, 1.3, 'G'), UDL(0, 4, 5.4, 'Q')] });
mk('RHS-07', 'RHS 160x80x5.0, 3 m cantilever, UDL + tip point load', RHS('160 x 80 x 5.0'),
  { L: 3, supports: CANT(), divisor: 180, loads: [UDL(0, 3, 1, 'G'), UDL(0, 3, 1.4, 'Q'), P(3, 2.3, 'Q')] });
mk('RHS-08', 'RHS 400x200x10.0, 2 x 6 m continuous, full UDL', RHS('400 x 200 x 10.0'),
  { L: 12, supports: PINS(0, 6, 12), loads: [UDL(0, 12, 23, 'G'), UDL(0, 12, 28, 'Q')] });
mk('RHS-09', 'RHS 350x150x10.0, 3 x 3 m continuous, G full + Q on outer spans', RHS('350 x 150 x 10.0'),
  { L: 9, supports: PINS(0, 3, 6, 9), loads: [UDL(0, 9, 60, 'G'), UDL(0, 3, 100, 'Q'), UDL(6, 9, 100, 'Q')] }, ['1.2']);
mk('RHS-10', 'RHS 300x200x8.0, 7 m SS, triangular load 0 -> 20 kN/m + Mz = 15 kN.m', RHS('300 x 200 x 8.0'),
  { L: 7, supports: SS(7), Mz: 15, loads: [UDL(0, 7, 5, 'G'), TRAP(0, 7, 0, 20, 'Q')] });
mk('RHS-11', 'RHS 100x50x4.0, 2.5 m SS, full UDL at e = 25 mm, fully restrained (box torsion)', RHS('100 x 50 x 4.0'),
  { L: 2.5, supports: SS(2.5), restraint: 'full', eccOn: true, loads: [UDL(0, 2.5, 1, 'G', { e: 25 }), UDL(0, 2.5, 4, 'Q', { e: 25 })] }, ['ecc-large']);
mk('RHS-12', 'RHS 120x60x5.0, 3 m SS, central point load at e = 30 mm, unrestrained', RHS('120 x 60 x 5.0'),
  { L: 3, supports: SS(3), eccOn: true, loads: [P(1.5, 7.9, 'Q', { e: 30 })] }, ['ecc-large']);
mk('RHS-13', 'RHS 450x250x12.5, 10 m fixed-fixed, full UDL', RHS('450 x 250 x 12.5'),
  { L: 10, supports: FIXFIX(10), loads: [UDL(0, 10, 20, 'G'), UDL(0, 10, 27, 'Q')] });
mk('RHS-14', 'RHS 500x300x16.0, 14 m SS, full UDL, restraints at third points', RHS('500 x 300 x 16.0'),
  { L: 14, supports: SS(14), loads: [UDL(0, 14, 8.5, 'G'), UDL(0, 14, 11.4, 'Q')], ltbRestraints: R(14 / 3, 28 / 3) });
mk('RHS-15', 'RHS 200x120x6.3, 6 m propped cantilever, full UDL', RHS('200 x 120 x 6.3'),
  { L: 6, supports: PROPPED(6), loads: [UDL(0, 6, 4, 'G'), UDL(0, 6, 6, 'Q')] });
mk('RHS-16', 'RHS 250x150x8.0, 8 m SS, UDL G+Q with upward wind (uplift combinations)', RHS('250 x 150 x 8.0'),
  { L: 8, supports: SS(8), combos: GQW(), loads: [UDL(0, 8, 2.4, 'G'), UDL(0, 8, 3.4, 'Q'), UDL(0, 8, -3.8, 'W')] }, ['uplift']);
mk('RHS-17', 'RHS 350x250x10.0, 7 m span + 2 m overhang, UDL + tip point load', RHS('350 x 250 x 10.0'),
  { L: 9, supports: PINS(0, 7), loads: [UDL(0, 9, 22, 'G'), UDL(0, 9, 27, 'Q'), P(9, 40, 'Q')] });

/* =========================================================================
   MIX - combined actions, patterns, hinges, per-load heights
   ========================================================================= */
mk('MIX-01', 'UB 457x191x82, 8 m SS, UDL + rising UVL + point + in-span couple + upward wind', UB('457 x 191 x 82'),
  { L: 8, supports: SS(8), combos: GQW(), loads: [UDL(0, 8, 6, 'G'), TRAP(0, 8, 0, 7.7, 'Q'), P(3, 19, 'Q'), MOM(6, 31, 'Q'), UDL(0, 8, -3.9, 'W')] }, ['uplift']);
mk('MIX-02', 'UB 533x210x92, 12 m Gerber beam on four supports, hinges at 2.5 and 9.5 m, full UDL', UB('533 x 210 x 92'),
  { L: 12, supports: PINS(0, 4, 8, 12), hinges: [{ pos: 2.5 }, { pos: 9.5 }], loads: [UDL(0, 12, 40, 'G'), UDL(0, 12, 60, 'Q')] });
mk('MIX-03', 'UC 254x254x73, 6 m SS, full UDL + axial compression 500 kN + Mz = 15 kN.m (biaxial beam-column)', UC('254 x 254 x 73'),
  { L: 6, supports: SS(6), axial: 500, Mz: 15, loads: [UDL(0, 6, 6.5, 'G'), UDL(0, 6, 8, 'Q')] });
mk('MIX-04', 'UB 406x178x54, 8 m SS, three point loads restrained at each load, top-flange loading', UB('406 x 178 x 54'),
  { L: 8, supports: SS(8), eccOn: true, za: 201, loads: [P(2, 30, 'Q', { e: 0, zg: 201 }), P(4, 30, 'Q', { e: 0, zg: 201 }), P(6, 30, 'Q', { e: 0, zg: 201 })], ltbRestraints: R(2, 4, 6) }, ['zg-top']);
mk('MIX-05', 'UB 305x165x40, 6 m SS, 120 kN point load at 0.25 m from a support (high shear) + G UDL', UB('305 x 165 x 40'),
  { L: 6, supports: SS(6), loads: [UDL(0, 6, 5, 'G'), P(0.25, 120, 'Q')] }, ['2.10']);
mk('MIX-06', 'UB 254x146x31, 6 m fixed-hinge-pinned (hinge at 3 m), full UDL', UB('254 x 146 x 31'),
  { L: 6, supports: PROPPED(6), hinges: [{ pos: 3 }], loads: [UDL(0, 6, 2.8, 'G'), UDL(0, 6, 4.1, 'Q')] });
mk('MIX-07', 'RHS 200x100x8.0, 6 m fixed-fixed, two point loads + axial compression 300 kN', RHS('200 x 100 x 8.0'),
  { L: 6, supports: FIXFIX(6), axial: 300, loads: [P(2, 14, 'Q'), P(4, 14, 'Q')] });
mk('MIX-08', 'UB 457x152x52, 7 m SS, UDL hung from the bottom flange + point load on the top flange (per-load zg)', UB('457 x 152 x 52'),
  { L: 7, supports: SS(7), eccOn: true, za: 0, loads: [UDL(0, 7, 3, 'G', { e: 0, zg: -225 }), UDL(0, 7, 2.5, 'Q', { e: 0, zg: -225 }), P(3.5, 8, 'Q', { e: 0, zg: 225 })] }, ['zg-mixed']);
mk('MIX-09', 'UB 686x254x140, 10 m SS, equal hogging end couples + full UDL (end moment + transverse load)', UB('686 x 254 x 140'),
  { L: 10, supports: SS(10), loads: [MOM(0, 500, 'Q'), MOM(10, -500, 'Q'), UDL(0, 10, 20, 'G'), UDL(0, 10, 20, 'Q')] });
mk('MIX-10', 'PFC 300x100x46, 6 m SS, central point load at e = -50 mm (load on the web side)', PFC('300x100x46'),
  { L: 6, supports: SS(6), eccOn: true, loads: [P(3, 21, 'Q', { e: -50 })] }, ['ecc-large']);

// ---- sanity: unique ids ----
{
  const seen = new Set();
  cases.forEach(c => { if (seen.has(c.id)) throw new Error('duplicate case id ' + c.id); seen.add(c.id); });
}

module.exports = { cases, helpers: { P, UDL, TRAP, MOM, SS, CANT, PROPPED, FIXFIX, PINS, R, GQ, GQW, GQWneg, UB, UC, PFC, SHS, RHS, deriveTriggers } };
