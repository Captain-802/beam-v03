# Single-span verification campaign - headless batch runner

Runs the EC3 beam checker over a library of 279 single-span cases without a
browser, records every printed design quantity, and cross-checks the engine
against independent closed forms computed in the runner. 265 cases are valid
members (LTB cases run with BOTH M<sub>cr</sub> methods, `eigen` FE eigensolver
and `standard` closed form, so they give 465 runs); 14 cases are deliberately
invalid layouts that must throw (group ERR, run once each). 479 runs in all.

**Scope (19 Sep 2026):** one span from End 1 (x = 0) to End 2 (x = L), each
end carrying the six DOF flags U<sub>x</sub>, U<sub>y</sub>, U<sub>z</sub>, R<sub>x</sub>, R<sub>y</sub>,
R<sub>z</sub> plus warping (`ends: SS() | FIXFIX() | PROPPED() | CANT() | GF() | PG()
| ENDS(preset, {e1, e2})` in `cases.cjs`, built from the app's own
`endsPreset()`), internal hinges, intermediate lateral restraints. The library
was rebuilt for this scope on 19 Sep 2026: every preset (simply supported,
fixed-fixed, fixed-pinned, cantilever, guided-fixed, pinned-guided) is run in
every section family under the load types, and the feature groups exercise
the flags one by one (custom end sets, torsion, load height, axial force,
minor-axis moment, restraints, hinges, the gap-closure checks, the invalid
layouts). The ids and inputs of the cases pinned by `tests/campaign.test.cjs`
(WEB, UPL, TFB, HSV, TOR, AEF, BIX, UB-04/19/27/40/43/45/49/51/52) are
unchanged from the 19 Sep 2026 campaign.

**Current run (2026-09-19, Node v24.14.1, 73 s, after the review fixes and the
F-E closure of the same day; identical counts at `ce8dc0d`):** PASS 349 | FAIL 82 |
NOT VERIFIED 34 | ERROR 0 (465 member runs);
the 14 ERR layouts threw the declared message (0 failed). Cross-check
mismatches: **0** - i-Mmax / i-dmax / i-Rend 352/352 each, i-Mend 243/243,
viii-Mend 268/268 (was 71 mismatches: finding F-A, corrected), ii-equilibrium,
vi-governing and vii-uplift 465/465, viii-FRd 461/461, iii-McrStd 327/327
(the closed form is no longer evaluated for the six refused end sets),
iii-zgBlock 152/152, v-MbRd&le;McRd 400/400, ix-Aeff 25/25, x-NbT 11/11,
xi-kcFloor 150/150, xii-MVN 5/5, xiii-torsionFE 11/11, xv-MvRd 8/8,
xvi-McrPair 6/6, xvii-cantSN006a 16 recorded, err-throws 14/14. iv-McrRatio:
46 same-segment outliers flagged (was 54: the released-end cases no longer
carry a closed-form value), each with its reason in `results.md`; none of them
has the closed form on the unconservative side of a PASS (finding F-C,
corrected: those runs are NOT VERIFIED on the standard route). Verdict changes
against the first run of this library: UB-57 (eigen) and TOR-07 (both routes)
NOT VERIFIED -> PASS (F-D, F-B corrected); CUS-05/06/07/11/12, PFC-26 and
RHS-07 standard PASS -> NOT VERIFIED (F-C: an end releasing U<sub>y</sub> or
R<sub>x</sub>, a channel / box cantilever); RHS-07 eigen NOT VERIFIED -> PASS
(F-E closed: the warping flag is not applied to an I<sub>w</sub> = 0 box, mesh
measure 5.1e-3 -> 4.2e-7). Trigger mismatches 0. Hand checks
(`hand-checks.md`): 59 quantities over 24 cases, 57 within 0.01 %, the two
above 1 % expected and explained (the SN003a k = 0.5 method difference).

## Files

| File | Purpose |
|---|---|
| `cases.cjs` | Case library: array of `{id, title, overrides, expect, tags[, pair][, expectError]}`. `overrides` is what `tests/harness.cjs` `reset()` merges over `DEMO` (see `js/03-state-ui.js`). `expect` is the list of trigger ids from `docs/EC3_BEAM_TRIGGER_LIST.md` the case is designed to exercise. `pair = {base, relation: 'ge', why}` declares an end-restraint bound the runner asserts (cross-check xvi). `expectError` (a string) declares an invalid layout whose thrown message must contain it. |
| `run-batch.cjs` | The runner. Loads the app through `tests/harness.cjs` (Node vm, no DOM), runs `analyse()` + `checks()` per case and method, applies the cross-checks, writes the two result files. |
| `results.json` | Full record of the last run: `summary` (verdict tables per family, per method and per group, cross-check totals, outliers with reasons, pairs, cantilever SN006a ratios, expected-error results, trigger mismatches) and `runs` (one object per run with every extracted quantity, all cross-check details and the observed triggers). |
| `results.md` | Human-readable version: summary tables (group, family, method, cross-check totals), the expected-error table, the end-restraint pair table, the cantilever eigen-vs-SN006a table, the outlier table with reasons, mismatch and error tables, then one row per run (id, title, section, method, verdict, governing check and utilisation, M<sub>cr</sub>, C<sub>1</sub>, &lambda;<sub>LT</sub>, &chi;<sub>LT</sub>, M<sub>b,Rd</sub>, M<sub>c,Rd</sub>, V<sub>pl,Rd</sub>, deflection ratio, unsupported / blocking messages, runtime ms). |
| `hand-checks.cjs` / `hand-checks.md` | 24 cases (59 quantities) recomputed by hand from the section table rows and the case inputs with every step written out: the preset closed forms (guided-fixed wL&sup2;/3 and wL&sup2;/6, fixed-fixed UDL and point load, cantilever tip and UDL, pinned-guided, propped cantilever), the strut lengths 1.2 L / 0.7 L of a guided-fixed strut, web bearing types (a)/(b)/(c) and RHS incl. a fixed-end reaction with the 7.2 interaction, standard M<sub>cr</sub> with C<sub>2</sub>z<sub>g</sub> (SS and fixed-ended rows), SN006a with Eq (7), the laterally clamped member against the SN003a k = 0.5 factor, PFC N<sub>cr,T</sub> / N<sub>cr,TF</sub>, RHS high-shear M<sub>v,Rd</sub>, A<sub>eff</sub>, the warping-torsion cantilever (root warping fixed and free), uniform torques; `node tests/batch/hand-checks.cjs` prints the table, exit code 1 above 1 % unless the difference is one of the two expected findings. |
| `mcr-method-comparison.md` | Engineering reasons for the eigen / standard M<sub>cr</sub> outlier families of the single-span library and whether the closed form is unconservative; the findings of this campaign and of the earlier one (F1, F2 fixed; F-A .. F-E open). |

## How to run

From the repo root (Node 24):

```
node tests/batch/run-batch.cjs              # whole campaign (~55 s, eigen solves dominate)
node tests/batch/run-batch.cjs PFC CUS-0    # only cases whose id contains one of the substrings
node tests/batch/hand-checks.cjs            # the 59 hand comparisons
```

The runner prints one line per run as it goes, then a two-line summary, and
rewrites `results.json` / `results.md`. Exit code is 1 when a valid case threw
(verdict `ERROR`) or an ERR case did not throw the declared message; FAIL
verdicts and cross-check mismatches are reported, not fatal, because a FAIL is
a legitimate design verdict and a mismatch is a finding to be read.

The regular suite (`node --test tests/*.test.cjs`) does not run the campaign;
`tests/campaign.test.cjs` pins the hand-check figures, the pair bounds, the
cantilever ratios, the expected-error group and the verdict directions of the
gap-closure groups.

## Verdicts

| Verdict | Meaning |
|---|---|
| PASS | `checks(a).pass` is true: every printed utilisation <= 1 and nothing blocking. |
| FAIL | at least one printed utilisation > 1 (a 99.000 utilisation is the engine's sentinel for an unbounded check, e.g. the Annex A amplifier when M_Ed >= Mcr). |
| NOT VERIFIED | all utilisations <= 1 but the engine declared part of the design not covered (uplift without a declared hold-down, a destabilising z_g without a published C2 on the standard route, a mesh error above the limit, torsion with N_Ed on a channel, cold-formed torsion constants, ...). |
| ERROR | `analyse()` or `checks()` threw for a case that should run; the message is recorded. Zero in the current library. |
| THROWS | an ERR case threw a message containing the declared text (the intended outcome). WRONG THROW / NO THROW count as failures. |

## Cross-checks (computed independently in the runner)

All from the raw section table values and the case inputs, never from the
engine's intermediate results. Tolerance 0.5 % relative unless stated. The
end conditions are read from the case's `ends` flags by the runner's own
`endTypeOf()` / `endSupports()` / `endOf()` helpers (U<sub>z</sub> + R<sub>y</sub> = fixed,
U<sub>z</sub> = pinned, R<sub>y</sub> = guided, neither = free; twist restraints from
R<sub>x</sub>, warping from `warp`), never from the engine's shim.

| Id | Check | Applies to |
|---|---|---|
| i-Mmax, i-dmax, i-Mend, i-Rend | Closed forms of the six presets under a full-span UDL (self-weight included) plus one point load at mid-span (SS, fixed-fixed, fixed-pinned) or at the End 2 tip (cantilever, guided-fixed, pinned-guided): M<sub>max</sub> (wL&sup2;/8 + PL/4; wL&sup2;/12 + PL/8; wL&sup2;/8 + 3PL/16; wL&sup2;/2 + PL; wL&sup2;/3 + PL/2; wL&sup2;/2 + PL), the end reaction moments of the fixed / guided ends (incl. wL&sup2;/6 + PL/2 at a guided end), the End 1 reaction (5wL/8 + 11P/16 for the propped case), and d<sub>max</sub> as the sampled maximum (2001 stations) of the summed textbook deflection curves (the propped-cantilever curves with x from the pinned end; the guided cases as halves of a fixed-fixed / simply supported beam of span 2L), using the governing ULS / SLS combination factors. Absolute values, so an uplift combination governing a case is compared as well | every case without hinges, couples or partial loads; several point loads at the one position (G and Q) are summed (352 runs: 185 SS, 52 fixed-fixed, 28 propped, 43 cantilever, 24 guided-fixed, 20 pinned-guided) |
| ii-equilibrium | sum of reactions + sum of applied vertical loads = 0 for the governing-moment combination (1 N floor for moment-only loading) | every run |
| iii-McrStd | Standard closed-form Mcr recomputed: SN003a with G = 81000 N/mm2 for I / H and box sections (Iw = 0 for a box), SN006a C x Mcr0 for I/H cantilevers. C1 / C2 are derived in the runner from the case's load list and end flags (SN003a Table 3.2 rows 1.127/0.454, 1.348/0.630, 2.578/1.554, 1.683/1.645 - the fixed-ended rows need U_z + R_y at both ends, the simply supported rows U_z at both ends with R_y free; the SCI end-moment curve for couples only; Serna's quarter-point expression otherwise, which is what a guided end, a hinge or a clamped end gets), z_g from the case's `za` / per-load `zg` (most destabilising active load, sign reversed for an upward load) and LE from the LE factor, the destabilising switch and the segment length - never from the engine's own C1 / C2 / zgUsed / LE. In eigen runs the engine's comparison value (`ltb.McrStandard`, same segment and same LTB-governing combination) is checked; in standard runs the design value | doubly symmetric sections (333 runs) |
| iii-zgBlock | A destabilising z_g on a diagram without a published C2 must be BLOCKED by the standard route (unless the destabilising L_E switch carries it); the runner derives the expectation from the case and looks for the engine's blocking message | standard runs of I / H and box sections (152 runs) |
| iv-McrRatio | Mcr,eigen / Mcr,standard for the same segment, flagged when outside 0.85-1.25. An outlier is interesting output, not necessarily an error; `results.md` tabulates the reason next to each one (cantilever, destabilising device, C2 unpublished, hinge, clamped / warping-fixed ends, guided end, an end with U_y or R_x released, restraints, channel) | eigen runs with a closed-form comparison (197 runs) |
| v-MbRd<=McRd | Mb,Rd <= Mc,Rd | every LTB run that produced an Mb,Rd |
| vi-governing | the reported governing utilisation equals the max of the printed utilisations | every run |
| vii-uplift | every end whose reaction is negative in the governing-moment combination is reported by the engine's uplift record and, unless the case declares `holdDown` for it, carries a blocking "Hold-down required" message; every reported lifting end has a hold-down message; a guided end (no vertical reaction) is excluded | every run |
| viii-FRd | Web transverse-force resistance (EN 1993-1-5 clause 6, G2): F_Rd at the engine's governing station recomputed from the raw section table (h_w = h - 2t_f, t_w, t_f, b_f <= t_w + 30 eps t_f, m1, m2 with the m2 = 0 second pass, k_F of type (a) with a = L or type (c) with c = max(d - s_s/2, 0), the (a)/(c) pair in the end zone, type (b) with (c) alongside for a load over an end, PFC one-sided flange, RHS/SHS two webs with the lever-rule share), s_s from the case (a blank end entry = the lower bound 0; the library declares 100 mm seatings, `LIB_SS`; load default = 0); the printed utilisation must equal the largest station ratio of the verified stations and a stiffened station must never govern | every run with a checked station and no declared stiffener (461 runs) |
| viii-Mend | **New.** At an end station whose end carries a reaction moment (fixed, guided) the station moment M_Ed the 7.2 interaction uses must equal the end reaction moment of the same combination (governing-moment combination, from the solver's reaction list) | every fixed / guided end station (268 stations; 197 agree, the 71 End 2 fixed-end stations do not: finding F-A) |
| ix-Aeff | Effective area of a Class-4 web in uniform compression (EN 1993-1-5 4.4, G3) from the raw table; must equal the engine's A_eff and feed the "Compression N_Ed/N_c,Rd (A_eff)" entry and the strut block | runs with N > 0 and d/t > 42 eps (25 runs) |
| x-NbT | Channel torsional-flexural buckling (cl 6.3.1.4, G3): i_0^2, N_cr,T (P385 I_T, I_w, y0 = e_sc, L_T = the case L_T, else the largest spacing of the TWIST restraints - ends with R_x held plus restraints with phi !== false - capped at L_cr,y), N_cr,TF, lambda_T, chi_T on curve c, N_b,T,Rd recomputed from the raw PFC table; the verdict entry must equal N_Ed/N_b,T,Rd | PFC runs with N > 0 (11 runs, both routes) |
| xi-kcFloor | k_c floor (G3): the printed k_c must equal max(1/sqrt(C1), 1/sqrt(2.76)) on both routes and be flagged floored exactly when C1 > 2.76 | I/H LTB runs with a trusted C1 and no user override (150 runs) |
| xii-MVN | cl 6.2.10 (G3): at the engine's worst high-shear station of a uniaxial case with N, the whole chain recomputed (rolled I/H Class 1/2 plastic 6.2.9.1, Class 3 linear, RHS Eq 6.39) | UB-48, HSV-01, HSV-05, HSV-07, HSV-08 |
| xiii-torsionFE | Warping-torsion FE (G4) against the Vlasov closed forms from the raw P385 constants: cantilever with a tip torque and the root warping fixed (phi_tip = (T/GI_T)[L - a tanh(L/a)], UB-49), **cantilever with a tip torque and the root warping FREE (pure St Venant: phi_tip = TL/GI_T, root torque = T, B = 0, TOR-07; the engine's mesh measure is not required there, finding F-B)**, cantilever under a full-span uniform torque (TOR-05), fork-fork span with both ends warping-fixed under a uniform torque (UB-51, TOR-08); tolerance 1e-4 | rolled I/H runs on the FE route with those layouts (11 runs) |
| xv-MvRd | High-shear M_v,Rd for every family (G3 item 12) recomputed at the engine's worst coexistent M-V station | every run with a reduced coexistent station that is not a pure shear failure (8 runs) |
| xvi-McrPair | **New.** End-restraint bounds: a case declaring `pair` must give an eigen M_cr >= that of its base case (same section, length, loads; only the end flags differ): R_z restrained at both ends (laterally clamped) against fork ends, warping fixed at both ends against warping free, both together against clamped only, a lateral cantilever with the root warping fixed against free. For the two tabulated diagrams (full-span UDL, central point load) the SN003a ratio with k = 0.5 (C1 0.972 / 1.05 against 1.127 / 1.348) or k_w = 0.5 is computed from the raw table and recorded beside the eigen ratio | CUS-01/02/03/04/07/10 (6 pairs, all satisfied: eigen ratios 1.756, 1.657, 1.598, 1.654, 1.414, 1.490; SN003a k = 0.5 gives 1.725 for CUS-01 and 1.558 for CUS-03, k_w = 0.5 gives 1.525 for CUS-02 and 1.552 for CUS-04 - the tabulated factors sit on the conservative side of the eigenvalue in every case) |
| xvii-cantSN006a | **New.** Cantilevers (I/H, root warping condition from the End 1 flag): the ratio M_cr,eigen / M_cr,SN006a is recorded with C, kappa_wt, eta and the SN006a case (or the reason SN006a does not cover the loading) | 16 cantilever eigen runs: 12 covered cases within 0.99-1.02 (UB-18 with the root warping free 1.020, UB-68 with eta = +1 1.001), RES-03 3.95 (a mid-length lateral restraint SN006a cannot see), UB-65/66/67 not covered (partial UDL + tip load, tip couple with self-weight, triangular load) |
| err-throws | **New.** The ERR group: analyse() must throw a message containing the declared text | 14 cases, 14 threw as declared |

The runner also compares the case's `expect` triggers with the triggers it can
observe from the check output (axial / biaxial / tension / torsion / Annex A /
flexural buckling / interaction / torsional-flexural gap / restraints / shear
buckling) and lists the differences (0).

## Case coverage (279 cases, 479 runs)

| Group | Cases | Content |
|---|---|---|
| UB | 72 | 127x76x13 to 1016x305x249: simply supported (34 cases: UDL full / partial, triangular rising and falling, trapezoidal, single / two / three point loads incl. 0.3 m from the ends, end couples psi = +1 / 0, an in-span couple, uplift through an upward W and through a negative W factor, S355, top- and bottom-flange z_g, restraints, the destabilising-switch pair UB-40 / UB-52, axial, M_z, eccentric loads), fixed-fixed (8: UDL, central point load, trapezoidal, triangular, loads near the ends, in-span couple, restrained deep beam, partial UDL), fixed-pinned (5: UDL, central point load, falling triangular, UDL + point restrained, hogging couple at the pin), cantilever (11: UDL, tip load, tip load at e, UDL + tip load with the root warping free, partial UDL + tip load, tip couple, triangular, top-flange tip load, restrained, heavy), guided-fixed (5), pinned-guided (4) |
| UC | 17 | 152x152x23 to 356x406x235 under every preset (SS incl. couples psi = -1 and restraints; cantilever; propped with tension and a triangular load; fixed-fixed with N and a central point load; guided-fixed; pinned-guided) |
| PFC | 25 | 100x50x10 to 430x100x64: shear-centre and eccentric loads (e = 0 / small / flange half-width / web side), z_g, restraints, N (6.3.1.4), under SS, fixed-fixed, propped, cantilever (tip load at e), guided-fixed, pinned-guided |
| SHS / RHS | 15 / 19 | hot-finished and cold-formed SHS, RHS up to h/b = 3 and 500x300: every preset, box torsion, N, M_z, uplift, restraints |
| ECC | 10 | torsion under the presets: UB and PFC fixed-fixed at e (P385 closed forms with in-plane fixity), propped point load at e, guided-fixed and pinned-guided channels at e, a restrained torsion cantilever (FE), one end warping-fixed (FE), partial-span torque (FE), loads on the web side of a channel, both ends warping-fixed (UB-51) |
| ZG | 9 | load height +/- D/2: fixed-ended SN003a rows top and bottom (UB-43, UB-45, ZG-01, ZG-03), propped and guided-fixed top-flange loads (C2 unpublished: standard route blocked), cantilever eta = +1 / -1, SS central point load C2 = 0.630, a channel with a bottom-flange load, a per-load mixed top / bottom case |
| AX | 13 | N_Ed under every preset with the end-fixity strut lengths (0.7 / 0.85 / 2.0 / 1.2 / 2.0 L), U_x at both ends (indeterminate note) on SS and fixed-fixed, tension on propped and fixed-fixed, a channel (L_T = L), the L_E override on a clamped member, a fixed-fixed beam-column with C_my from the fixed-ended diagram, a cantilever strut |
| MZ | 7 | M_z under fixed-fixed (restrained and as a beam-column), propped, cantilever, guided-fixed (RHS), pinned-guided (CF SHS), SS beam-column |
| RES | 8 | intermediate lateral restraints under fixed-fixed, propped (three point loads with z_g), cantilever (mid-length restraint), guided-fixed, pinned-guided, a v-only restraint, a fixed-fixed channel, end couples with quarter-point restraints |
| HNG | 7 | fixed-hinge-pinned (12 m and 6 m), fixed-hinge-fixed (hinge at mid-span and at 2 m with a central point load), restrained UC, RHS, fixed-hinge-guided |
| CUS | 16 | custom flag sets: R_z both ends (paired with the fork base), warping both ends (paired), both together (paired), R_z at one end, End 2 twist-free with no torque, lateral cantilever with the root warping free and fixed (paired), fixed-fixed in plane with fork LTB ends, propped in plane with a laterally free End 2, a channel warping-fixed at one end, a laterally clamped box, warping-fixed ends under uniform moment, U_x at both ends without N |
| WEB / UPL / TFB / HSV / TOR / AEF / BIX | 10 / 7 / 4 / 9 / 6 / 6 / 5 | the 19 Sep 2026 gap-closure groups, each check deciding the verdict both ways (unchanged pinned cases), plus WEB-09 (fixed-end reaction: finding F-A), WEB-10 (guided end: one web station), UPL-06 (uplift at fixed ends with hold-downs), UPL-07 (a propped member's pin lifting), HSV-08 (high shear with N at a fixed end), HSV-09 (high shear near an end), TOR-07 (root warping free: finding F-B), TOR-08 (warping-fixed torsion inside a laterally clamped member), AEF-06 (A_eff with 0.7 L) |
| ERR | 14 | invalid layouts that must throw: U_z released at one end (rigid-body rotation) or both, SS with a mid-span hinge, a cantilever rooted at End 2, torque with R_x free at both ends, N_Ed with U_x free at both ends, U_y free at both ends, R_x free at both ends (no fork), a lateral cantilever without R_z, an N_Ed strut with a z-z sway mechanism, guided at both ends, two hinges in a propped member, a hinge at an end, a guided-fixed member with R_x free at both ends |

Web bearing inputs: every vertically held library end declares a 100 mm
seating (`LIB_SS` in cases.cjs, applied by `mk()` to ends without their own
`ss`; a blank s_s is the engine's lower bound 0, NOT VERIFIED where it fails);
cases with their own s_s (40, 60, 100, 150, 200 mm) and declared bearing
stiffeners (WEB-02, HSV-03, HSV-05, HSV-07).

### Verdict counts per Mcr method

| Method | Runs | PASS | FAIL | NOT VERIFIED | ERROR |
|---|---|---|---|---|---|
| eigen | 200 | 176 | 15 | 9 | 0 |
| standard | 200 | 132 | 46 | 22 | 0 |
| n/a (restrained) | 65 | 41 | 21 | 3 | 0 |
| n/a (invalid, ERR group) | 14 | - | - | - | 14 THROWS |

(Counts after the review fixes and the F-E closure; the first run of this
library was eigen 173 / 15 / 12 and standard 138 / 46 / 16.) The standard route
fails 31 runs more than the eigen route: the whole-member
closed form with fork ends (intermediate restraints not applied, k = 1 for
clamped ends, k<sub>w</sub> = 1 for warping-fixed ends, SN006a blocked outside
its tables, the channel &kappa; chain) is the conservative MasterSeries-type
answer; the per-group and per-family tables are in `results.md`.

## Findings of this campaign (engine; F-A .. F-D corrected by the 19 Sep 2026 review fixes, AUDIT.md "19 Sep 2026 review fixes: end conditions of the closed-form routes"; F-E open)

- **F-A (viii-Mend, HC-17c; unconservative at End 2) - corrected:** the end
  stations now read the diagram at x = 1e-4 / L - 1e-4 mm (grid points of
  `sfdBmd`), viii-Mend 268/268. As found: `webTransverseCheck()`
  (js/checks/eurocode-checks.js) reads the station moment of every combination
  with `interpAt(res.fb.xs, res.fb.M, s.x)` exactly at the station. At x = L
  the diagram grid closes to zero beyond the end reaction moment (the last two
  grid values of WEB-09 are -305.16 kN.m at 5999.9999 and 0 at 6000), so the
  End 2 station of any member with R<sub>y</sub> held at End 2 gets
  &eta;<sub>1</sub> = 0 in the EN 1993-1-5 7.2 interaction (0.724 printed where
  0.993 is right for WEB-09). End 1 is correct (the first grid value carries the
  reaction moment). In the symmetric library cases the governing station is
  still found at End 1; an asymmetric member whose larger hogging moment is at
  End 2 is under-checked. Fix: sample a fraction inside the member at the ends
  (`s.x >= L - tol ? s.x - 1e-4 : s.x`), as `analyse()` does for M<sub>Lend</sub>.
  71 runs flagged (every fixed-fixed member on both routes, HSV-08, WEB-09,
  the fixed-fixed AX / MZ / RES / ZG / HNG / TOR-08 cases, CUS-09).
- **F-B (TOR-07, HC-21c; blocks a valid PASS) - corrected:** each part of the
  mesh measure is normalised by max(its fine-mesh peak, 1e-3 x its physical
  scale from the peak torque); TOR-07 converges (6.5e-6) and PASSes. As found:
  `warpingTorsionFE()`
  (js/checks/torsion-fe.js) takes the mesh error as the largest relative change
  of max|&phi;|, max|&phi;&prime;| and max|B| between the 120- and 240-element
  meshes. A cantilever with the root warping FREE under a tip torque is pure
  St Venant (B &equiv; 0, &phi; = Tx/GI<sub>T</sub>: the engine reproduces it
  to 1e-6), so max|B| is round-off (7e-8 kN.m&sup2; against T&middot;a &asymp;
  4.5) and its relative change (43 %) blocks PASS as "mesh has not converged".
  Fix: normalise the bimoment part by a physical scale (max(T<sub>max</sub>&middot;a,
  max|B|)) or ignore it when max|B| is below 1e-6 of that scale.
- **F-C (iv-McrRatio; standard route unconservative for non-fork end flags) -
  corrected:** `stdMcrEndsStatus()` refuses (NOT VERIFIED, message naming the
  released flag, the fork-ended chain still printed) every end set that is not
  fork-fork or the SN006a cantilever (`isSn006aCantilever`: root U<sub>y</sub> +
  R<sub>z</sub> + R<sub>x</sub>, free tip; square hollow sections exempt);
  clamped / warping-fixed ends are taken as forks with the conservative note;
  the eigen comparison prints "not applicable" instead of a ratio. As found:
  the closed-form route evaluated the SN003a form with k = k<sub>w</sub> = 1
  (fork ends at both ends) for any end flag set. For an end that releases
  R<sub>x</sub> (CUS-05) or U<sub>y</sub> + R<sub>x</sub> (the lateral
  cantilevers CUS-06, CUS-07, CUS-12) the eigenvalue is 0.41-0.68 of the
  closed form and the standard run PASSes at 0.50 where the eigen run gives
  0.90 (CUS-05). The closed-form route should refuse (NOT VERIFIED) members
  whose ends do not both restrain U<sub>y</sub> and R<sub>x</sub>, as it refuses
  an unpublished C<sub>2</sub>; the eigen route covers them. (Clamped and
  warping-fixed ends are on the conservative side of the closed form: ratios
  1.3-2.9, F-C does not concern them.)
- **F-D (UB-57; eigen mesh error 2.3 % at an in-span couple) - corrected:** the
  couple positions are forced mesh nodes (and part of the eigen cache key);
  UB-57 converges (2.6e-6) and PASSes. As found: `mcrOnce()`
  (js/08-mcr-eigen-patch.js) forces mesh nodes at the restraints, the point
  loads and the ends of the distributed loads but not at an applied couple, so
  a couple that does not fall on a node (2 m of 5 m with 32 elements) puts the
  moment jump inside an element and the Richardson error rises to 2.3 %
  (PASS blocked). UB-27 (couple at 4 m of 8 m) happens to sit on a node. Fix:
  add the moment-load positions to the forced node list.
- **F-E (RHS-07, SHS-06; box cantilever eigen mesh error 0.42-0.51 %) -
  closed (AUDIT.md "19 Sep 2026 single-span scope, end-condition DOFs"):** the
  "mesh error" was the root warping flag imposed as &phi;&prime; = 0 on an
  I<sub>w</sub> = 0 model, a spurious constraint whose effect faded only with
  the mesh; the flag is now printed as not applied on a box section (EN 1993-1-1
  6.2.7(7)) and RHS-07 converges to 4.2e-7 (PASS), SHS-06 to 1.8e-7. As found:
  the hollow-section cantilever appeared to converge slowly in the cubic Hermite
  twist field, RHS-07 at 0.51 %, just above the 0.5 % block.
- **F-F (UB-57; Serna C<sub>1</sub> on a diagram with an in-span couple) -
  open, recorded by docs/VERIFICATION_REPORT.md 7.5:** the closed form gives
  214.5 kN.m against the clamped eigenvalue 165.9 (ratio 0.774) and against the
  fork-ended eigenvalue 160.3 (Serna C<sub>1</sub> 3.16 vs the eigen 2.36, +34 %
  on M<sub>cr</sub>); the k<sub>c</sub> floor holds M<sub>b,Rd</sub> to +2.5 %
  and both verdicts PASS. An applied couple inside the segment should block the
  Serna route or cap C<sub>1</sub> at the smooth-diagram value.
- **Observations, not defects:** the SN006a route does not cover a tip couple
  combined with the self-weight moment above the 2 % de-minimis (UB-66), a
  partial UDL + tip load (UB-65) or a triangular load (UB-67): the standard
  route is NOT VERIFIED there while the eigen route runs (the ratio table
  records the eigenvalue). The k = 0.5 factor of SN003a Table 3.2 is 1.8 %
  below the eigen ratio for the clamped UDL case (HC-23, method difference).

## Adding cases

Use the builders in `cases.cjs` (`P`, `UDL`, `TRAP`, `MOM`, `SS`, `FIXFIX`,
`PROPPED`, `CANT`, `GF`, `PG`, `ENDS`, `R`, `GQ`, `GQW`, `GQWneg`, `UB`,
`UC`, `PFC`, `SHS`, `RHS`) and `mk(id, title, section, overrides, tags,
extra)` (`extra.pair` for an end-restraint bound) or `mkErr(id, title,
section, overrides, expectedMessageText)` for an invalid layout. Section keys
must exist in `js/sections/*.js` (UB / UC / RHS keys carry spaces, e.g.
`'457 x 191 x 82'`; PFC and SHS keys do not, e.g. `'200x90x30'`,
`'100x100x5.0'`). `expect` is derived automatically from the inputs; add extra
trigger ids through `tags`. Ids must be unique and a pair's base must exist -
the module throws otherwise.
