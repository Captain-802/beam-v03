'use strict';
/* ===========================================================================
   Owner comparison matrix (20 Sep 2026) - docs/owner-cases-2026-09-20.txt
   ---------------------------------------------------------------------------
   Realises the owner's Notepad case list for FIVE sections so that every run
   can be repeated in MasterSeries and the two figures compared side by side
   (docs/owner-cases/index.md, "Comparison" column left blank for the
   MasterSeries values). Same case shape as tests/batch/cases.cjs
   ({id, title, overrides, tags, owner, refuse}); run by
   tests/batch/run-owner-cases.cjs, which also renders the MasterSeries brief
   of every run (docs/owner-cases/briefs/<id>-<method>.html).

   Common basis (owner's list + task of 20 Sep 2026):
     S275, ONE span L = 6.0 m, simply supported fork ends (U_x U_y U_z R_x at
     End 1, U_y U_z R_x at End 2; warping free; 100 mm seatings), EC3 (EN
     1993-1-1 + UK NA), unrestrained between the ends (restraint 'ltb') unless
     the variant says fully restrained, ULS 1.35G + 1.5Q, SLS 1.0Q.
     Base loading: G UDL 10 kN/m + Q UDL 8 kN/m over the full span + Q point
     load 30 kN at 2.0 m (self-weight added automatically by the tool).
   Sections: UB 457 x 191 x 82, UC 203 x 203 x 60, RHS 200 x 100 x 8.0 (hot
     finished), SHS 150 x 150 x 6.3 (hot finished), PFC 200 x 75 x 23.
   Load variants L1..L7 (every section) and restraint variants R1..R11 (UB and
   PFC on the L2 loading) - see the OWNER table below for the owner's wording.
   Units: m, kN, kN/m, kN.m; mm for e (horizontal offset of the load line from
   the shear centre, + towards the flange tips of a channel) and z_g (height of
   the load above the shear centre, + = destabilising). Loads in the load list
   are characteristic values factored by the combinations; the axial force
   (S.axial = N_Ed) and the constant minor-axis moment (S.Mz = M_z,Ed) are ULS
   DESIGN values the tool takes as entered (not factored).
   Every LTB case (restraint 'ltb') is run in BOTH M_cr methods ('eigen' FE
   eigenvalue, 'standard' SN003a / P385 closed forms); 'full' cases once; a
   case with `refuse` is not run at all - it is a documented refusal (the
   owner's wording names something the tool does not model) and the runner
   records REFUSED with the reason.
   =========================================================================== */

const { app } = require('../harness.cjs');
const ctx = app();

// ---- load builders (same shape as tests/batch/cases.cjs) ----
const P   = (pos, P, cs = 'Q', x = {}) => Object.assign({ type: 'point', pos, P, case: cs }, x);
const UDL = (x1, x2, w, cs = 'Q', x = {}) => Object.assign({ type: 'udl', x1, x2, w, case: cs }, x);
const MOM = (pos, M, cs = 'Q') => ({ type: 'moment', pos, M, case: cs });
const ULS = (id, label, G, Q) => ({ id, label, factors: { G, Q, W: 0, E: 0 }, sls: false, on: true });
const SLS = (id, label, G, Q) => ({ id, label, factors: { G, Q, W: 0, E: 0 }, sls: true, on: true });
const COMBOS = () => [ULS('c1', 'ULS: 1.35G + 1.5Q', 1.35, 1.5), SLS('s1', 'SLS: 1.0Q', 0, 1.0)];
// simply supported fork ends through the app's own preset (js/03-state-ui.js endsPreset), 100 mm seatings
const SS = (o) => ctx.ends('ss', Object.assign({ e1: { ss: 100 }, e2: { ss: 100 } }, o || {}));
const SS_WARP = () => SS({ e1: { ss: 100, warp: true }, e2: { ss: 100, warp: true } });
const R = (...pos) => pos.map(p => ({ pos: p, v: true, phi: true, vp: false, phip: false }));

// ---- the five sections (keys of js/sections/*.js) with the tool's own D and shear-centre offsets ----
const SECTIONS = [
  { tag: 'UB',  label: 'UB 457 x 191 x 82',         pick: { family: 'ub',  ubKey: '457 x 191 x 82' } },
  { tag: 'UC',  label: 'UC 203 x 203 x 60',         pick: { family: 'uc',  ucKey: '203 x 203 x 60' } },
  { tag: 'RHS', label: 'RHS 200 x 100 x 8.0 (HF)',  pick: { family: 'rhs', rhsType: 'HF', rhsKey: '200 x 100 x 8.0' } },
  { tag: 'SHS', label: 'SHS 150 x 150 x 6.3 (HF)',  pick: { family: 'shs', shsType: 'HF', shsKey: '150x150x6.3' } },
  { tag: 'PFC', label: 'PFC 200 x 75 x 23',         pick: { family: 'pfc', sectionKey: '200x75x23' } },
];
SECTIONS.forEach(s => {
  ctx.reset(s.pick);
  const g = ctx.run('(()=>{const s=activeSection(); return {D:s.D, e0:s.tp&&s.tp.e0!=null? +s.tp.e0 : null, esc:s.tp&&s.tp.esc!=null? +s.tp.esc : null};})()');
  s.D = g.D; s.h2 = +(g.D / 2).toFixed(1);        // z_g of a top-flange load: +D/2 above the shear centre (the tool's own reference)
  s.e0 = g.e0; s.esc = g.esc;                     // PFC: P385 Table A.3 e_0 (shear centre to the web line) and e_sc (shear centre to the centroid)
});

// ---- the owner's wording (docs/owner-cases-2026-09-20.txt, verbatim incl. spelling) ----
const OWNER = {
  L1: 'vertical loads resulting in no torsion',
  L2: 'udl point vertical loads acting at horizontal eccentricity from shear center',
  L3: 'udl point vertical loads acting at vertical + - eccentricity from shear center',
  L4: 'udl point vertical loads acting at vertical horizontal eccentricity from shear center',
  L5: 'udl point vertical loads acting at vertical horizontal eccentricity from shear center, and axial load on beam',
  L6: '... and axial load on beam, load applied at angle on beam',
  L7: '... load applied at angle on beam AND EXTERNAL BENDING MOMENT AT ANY POINT ON BEAM, ON SHEAR CENTER AND ABOVE OR BELOW SHEAR CENTER',
  R1: 'FULLY RESTRAINED',
  R2: '(reference) unrestrained between fork ends - the base of the restraint variants',
  R3: 'RESTRAINED AT SOME POINTS',
  R4: 'WARPING RESTRAINED',
  R5: 'WARPING FREE',
  R6: 'DESTABLIZING LOADS (switch only, every z_g = 0)',
  R7: 'STABILIZING LOADS',
  R8: 'EFFECTIVE LENGTHS OVERRIDE',
  R9: 'TOP FLANGE RESTRAINED',
  R10: 'BOTTOM FLANGE RESTREAINED',
  R11: 'PARTIALLY RESTRAINED',
};

// ---- loading ----
const E_H = 40;                                        // mm, horizontal eccentricity of the owner's L2 / L4.. loads
const INC_DEG = 20, INC_P = 30, INC_X = 2.0, L = 6.0;  // L6: 30 kN at 20 deg from the vertical at 2.0 m
const INC_V = +(INC_P * Math.cos(INC_DEG * Math.PI / 180)).toFixed(3);          // 28.191 kN vertical component
const INC_H = +(INC_P * Math.sin(INC_DEG * Math.PI / 180)).toFixed(3);          // 10.261 kN horizontal component
const INC_MZ = +(INC_H * INC_X * (L - INC_X) / L).toFixed(3);                   // 13.681 kN.m = H a b / L, the SS minor-axis moment at 2.0 m (characteristic, Q)
// The tool's M_z input is M_z,Ed, a ULS DESIGN value entered directly and NOT run through the load
// combinations (index.html "Minor-axis moment M_z,Ed"; js/checks/eurocode-checks.js MzEd = |S.Mz|),
// so the Q-case moment is entered factored: gamma_Q x 13.681 (20 Sep 2026 review correction - the
// first build entered the characteristic 13.681 kN.m as the design value).
const GAMMA_Q = 1.5;
const INC_MZ_ED = +(GAMMA_Q * INC_MZ).toFixed(3);                                 // 20.521 kN.m = 1.5 x 13.681, the ULS design M_z,Ed
const COUPLE = 40, COUPLE_X = 4.0;                    // L7: external couple 40 kN.m at 4.0 m (Q, factored by the combination)
// L5..L7: axial compression, U_x at End 1 (the preset). The tool's axial input is N_Ed, a ULS DESIGN
// value entered directly and NOT run through the load combinations (index.html "Axial F, kN ... entered
// directly as the governing ULS design value"), so 150 kN is the design force: in MasterSeries enter an
// axial load whose factored value is 150 kN (e.g. 100 kN in the imposed case, 1.5 x 100 = 150).
const N_AX = 150;

/* Base loads with the given per-load e / z_g (mm). */
function baseLoads(e, zg) {
  const x = (e || zg) ? { e: e || 0, zg: zg || 0 } : {};
  return [UDL(0, L, 10, 'G', x), UDL(0, L, 8, 'Q', x), P(2.0, 30, 'Q', x)];
}
const cases = [];
function mk(id, variant, sec, title, ov, extra = {}) {
  const overrides = Object.assign({
    code: 'EC3', grade: 'S275', L, ends: SS(), hinges: [], combos: COMBOS(),
    restraint: 'ltb', mcrMethod: 'eigen', eccOn: false, za: 0, axial: 0, Mz: 0, leFactor: null, destab: false, ltbRestraints: [],
    memberName: id + ' ' + sec.label,
  }, sec.pick, ov);
  cases.push(Object.assign({ id, variant, sectionTag: sec.tag, section: sec.label, owner: OWNER[variant], title, overrides }, extra));
}

/* =========================================================================
   Load variants L1..L7, every section
   ========================================================================= */
for (const s of SECTIONS) {
  const T = s.tag, h2 = s.h2, hs = '+' + h2;
  const ecc = (e, zg) => ({ eccOn: true, za: zg || 0, loads: baseLoads(e, zg) });
  // L1 - no torsion: e = 0, z_g = 0, eccentricity inputs off (loads through the shear centre)
  mk(T + '-L1', 'L1', s, s.label + ', 6 m SS fork ends, unrestrained; L1 "vertical loads resulting in no torsion": G 10 + Q 8 kN/m + Q 30 kN at 2.0 m through the shear centre (e = 0, z_g = 0)',
    { eccOn: false, loads: baseLoads(0, 0) });
  // L2 - horizontal eccentricity e = +40 mm on the UDLs and the point load
  mk(T + '-L2', 'L2', s, s.label + ', 6 m SS, unrestrained; L2 "horizontal eccentricity from shear center": all loads at e = +40 mm (torque), z_g = 0',
    ecc(E_H, 0));
  if (T === 'PFC') {
    // the channel twin: the load line through the WEB, i.e. e = P385 e_0 (shear centre to the web line) on the flange side of the shear centre
    mk(T + '-L2w', 'L2', s, s.label + ', 6 m SS, unrestrained; L2 twin "load through the web line": e = +' + s.e0 + ' mm = P385 Table A.3 e_0 (shear centre to the web line; the centroid is at e_sc = ' + s.esc + ' mm), z_g = 0',
      ecc(s.e0, 0));
  }
  // L3 - vertical eccentricity: top flange (destabilising) and the bottom-flange twin (stabilising), e = 0
  mk(T + '-L3t', 'L3', s, s.label + ', 6 m SS, unrestrained; L3 "vertical + eccentricity from shear center": all loads on the top flange z_g = ' + hs + ' mm (D/2, destabilising), e = 0',
    ecc(0, h2));
  mk(T + '-L3b', 'L3', s, s.label + ', 6 m SS, unrestrained; L3 twin "vertical - eccentricity from shear center": all loads hung from the bottom flange z_g = -' + h2 + ' mm (-D/2, stabilising), e = 0',
    ecc(0, -h2));
  // L4 - both: e = +40 and z_g = +D/2
  mk(T + '-L4', 'L4', s, s.label + ', 6 m SS, unrestrained; L4 "vertical horizontal eccentricity": all loads at e = +40 mm and z_g = ' + hs + ' mm (top flange)',
    ecc(E_H, h2));
  // L5 - L4 + axial compression N = 150 kN (U_x at End 1)
  const N_TXT = 'N_Ed = ' + N_AX + ' kN compression (U_x at End 1; the ULS DESIGN value entered directly, not factored by the combination - in MasterSeries an axial load whose factored value is ' + N_AX + ' kN, e.g. ' + (N_AX / GAMMA_Q) + ' kN imposed)';
  const MZ_TXT = 'an entered CONSTANT M_z,Ed = ' + INC_MZ_ED + ' kN.m (= ' + GAMMA_Q + ' x ' + INC_MZ + ', the ULS design value of the Q-case moment H a b / L = ' + INC_H + ' x 2 x 4 / 6 = ' + INC_MZ + ' kN.m, the simply supported minor-axis moment at 2.0 m; the tool\'s M_z input is a design value not run through the combinations)';
  mk(T + '-L5', 'L5', s, s.label + ', 6 m SS, unrestrained; L5 = L4 + "axial load on beam": ' + N_TXT + ', all loads at e = +40 mm, z_g = ' + hs + ' mm',
    Object.assign(ecc(E_H, h2), { axial: N_AX }));
  // L6 - L5 + an inclined point load (APPROXIMATION: vertical component + a constant M_z,Ed)
  mk(T + '-L6', 'L6', s, s.label + ', 6 m SS, unrestrained; L6 = L5 + "load applied at angle on beam": a further 30 kN (Q) point load at 2.0 m inclined ' + INC_DEG + ' deg from the vertical - APPROXIMATION: modelled as its vertical component ' + INC_V + ' kN (Q, e = +40, z_g = ' + hs + ', factored by the combination) plus ' + MZ_TXT + '; the tool has no lateral load, so the minor-axis moment is applied as a constant along the member (C_mz = 1.0), not as the true triangular diagram, and the torque of the horizontal component acting at z_g (H x z_g = ' + INC_H + ' x ' + (h2 / 1000).toFixed(3) + ' = ' + (INC_H * h2 / 1000).toFixed(2) + ' kN.m characteristic) is not modelled',
    Object.assign(ecc(E_H, h2), { axial: N_AX, Mz: INC_MZ_ED, loads: baseLoads(E_H, h2).concat([P(INC_X, INC_V, 'Q', { e: E_H, zg: h2 })]) }));
  // L7 - L6 + an external couple 40 kN.m at 4.0 m
  mk(T + '-L7', 'L7', s, s.label + ', 6 m SS, unrestrained; L7 = L6 + "EXTERNAL BENDING MOMENT AT ANY POINT ON BEAM": couple ' + COUPLE + ' kN.m (Q, factored by the combination) at ' + COUPLE_X + ' m, applied as a pure M_y in the diagram - the "on / above / below the shear centre" variant is NOT a distinct case for a member tool: a couple has no line of action, so it produces no torque (P.e) and no load-height term (C2 z_g); only forces with a lever arm do',
    Object.assign(ecc(E_H, h2), { axial: N_AX, Mz: INC_MZ_ED, loads: baseLoads(E_H, h2).concat([P(INC_X, INC_V, 'Q', { e: E_H, zg: h2 }), MOM(COUPLE_X, COUPLE, 'Q')]) }));
}

/* =========================================================================
   Restraint variants R1..R11 on the L2 loading (e = +40 mm, z_g = 0), UB and PFC
   ========================================================================= */
for (const s of SECTIONS.filter(x => x.tag === 'UB' || x.tag === 'PFC')) {
  const T = s.tag, h2 = s.h2;
  const L2 = () => ({ eccOn: true, za: 0, loads: baseLoads(E_H, 0) });
  const base = s.label + ', 6 m SS, L2 loading (all loads at e = +40 mm, z_g = 0); ';
  mk(T + '-R1', 'R1', s, base + 'R1 "FULLY RESTRAINED": compression flange held throughout (restraint = full, M_b.Rd = M_c.y.Rd)',
    Object.assign(L2(), { restraint: 'full' }));
  mk(T + '-R2', 'R2', s, base + 'R2 unrestrained between fork ends (U_y + R_x held at both ends, warping free) - the reference for R3..R11',
    L2());
  mk(T + '-R3', 'R3', s, base + 'R3 "RESTRAINED AT SOME POINTS": lateral restraints (v and phi held) at 2.0 and 4.0 m; the eigen route solves bay by bay, the standard route keeps one segment L_E = L (advisory)',
    Object.assign(L2(), { ltbRestraints: R(2.0, 4.0) }));
  mk(T + '-R4', 'R4', s, base + 'R4 "WARPING RESTRAINED": warping (phi\' = 0) held at both ends (ends warp flags; LTB eigen k_w = 0.5 type and warping-torsion FE)',
    Object.assign(L2(), { ends: SS_WARP() }));
  mk(T + '-R5', 'R5', s, base + 'R5 "WARPING FREE": warping free at both ends (the default fork end; identical input to R2, kept under the owner\'s heading)',
    L2());
  mk(T + '-R6', 'R6', s, base + 'R6 "DESTABLIZING LOADS" as the switch alone with every z_g = 0: the eigen route BLOCKS this contradictory input (load height is carried by z_g), the standard route applies L_E = 1.2 L (BS 5950 practice) - kept to record the refusal; the modelled destabilising case is L3t / L4 (z_g = +D/2)',
    Object.assign(L2(), { destab: true }));
  mk(T + '-R7', 'R7', s, base + 'R7 "STABILIZING LOADS": all loads hung from the bottom flange z_g = -' + h2 + ' mm (-D/2) with e = +40 mm',
    { eccOn: true, za: -h2, loads: baseLoads(E_H, -h2) });
  mk(T + '-R8', 'R8', s, base + 'R8 "EFFECTIVE LENGTHS OVERRIDE": L_E = 0.85 L entered (S.leFactor 0.85) - applied by the standard (closed-form) route; the eigen route derives its own buckling length from the end flags and does not use the factor for M_cr (shown for comparison)',
    Object.assign(L2(), { leFactor: 0.85, mcrMethod: 'standard' }));
  mk(T + '-R9', 'R9', s, base + 'R9 "TOP FLANGE RESTRAINED": for a sagging simply supported beam the top flange IS the compression flange, so this is the fully restrained case (restraint = full); the tool has no flange-level restraint input',
    Object.assign(L2(), { restraint: 'full' }));
  mk(T + '-R10', 'R10', s, base + 'R10 "BOTTOM FLANGE RESTREAINED" = tension-flange restraint only: NOT MODELLED by the tool (documented refusal)',
    L2(), { refuse: 'Tension-flange (bottom flange of a sagging beam) restraint is not modelled: the tool\'s restraints (end flags U_y / R_x / R_z / warping and the intermediate lateral restraints v, v\', phi, phi\') act at the shear centre and have no height in the cross-section, so a restraint that holds the tension flange laterally while the compression flange is free cannot be described; it needs a restraint-height term in the LTB eigen model (lateral constraint at z = -h/2, which couples v and phi) or the tension-flange-restraint method of BS 5950-1 Annex G / SCI P093. Treating it as unrestrained (R2) is the conservative bound; treating it as fully restrained (R9) is unsafe.' });
  mk(T + '-R11', 'R11', s, base + 'R11 "PARTIALLY RESTRAINED" = elastic (spring) restraint: NOT MODELLED by the tool (documented refusal)',
    L2(), { refuse: 'Elastic (partial) restraint is not modelled: every restraint in the tool is rigid or absent (each of v, v\', phi, phi\' is held or free), so a lateral or torsional spring of finite stiffness (a purlin, a sheeting rail, a slab with a stiffness) cannot be entered; it needs lateral / rotational spring stiffness terms added to the LTB eigen element matrices (and to the warping-torsion FE) with a stiffness input per restraint and per end, plus the EN 1993-1-1 BB.2 minimum-stiffness test to decide whether a spring counts as a full restraint. The bounds are R2 (no restraint) and R3 (rigid restraints at the same positions).' });
}

// ---- sanity: unique ids ----
{
  const seen = new Set();
  cases.forEach(c => { if (seen.has(c.id)) throw new Error('duplicate case id ' + c.id); seen.add(c.id); });
}

module.exports = { cases, SECTIONS, OWNER, constants: { E_H, INC_DEG, INC_P, INC_X, INC_V, INC_H, INC_MZ, INC_MZ_ED, GAMMA_Q, COUPLE, COUPLE_X, N_AX, L } };
