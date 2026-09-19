# 100-beam verification campaign - headless batch runner

Runs the EC3 beam checker over a library of 170 distinct beams without a
browser, records every printed design quantity, and cross-checks the engine
against independent closed forms computed in the runner. LTB cases are run
with BOTH Mcr methods (`eigen` FE eigensolver and `standard` closed form), so
the 170 cases give 296 runs. The 19 Sep 2026 verification campaign added 48
cases that exercise every gap-closure check (G1-G4) in both directions, the
independent hand checks of `hand-checks.md` / `hand-checks.cjs` and the
eigen-vs-standard outlier analysis of `mcr-method-comparison.md`.

## Files

| File | Purpose |
|---|---|
| `cases.cjs` | Case library: array of `{id, title, overrides, expect, tags}`. `overrides` is what `tests/harness.cjs` `reset()` merges over `DEMO` (see `js/03-state-ui.js`). `expect` is the list of trigger ids from `docs/EC3_BEAM_TRIGGER_LIST.md` the case is designed to exercise. |
| `run-batch.cjs` | The runner. Loads the app through `tests/harness.cjs` (Node vm, no DOM), runs `analyse()` + `checks()` per case and method, applies the cross-checks, writes the two result files. |
| `results.json` | Full record of the last run: `summary` (verdict tables, cross-check totals, outliers, errors, trigger mismatches) and `runs` (one object per run with every extracted quantity, all cross-check details and the observed triggers). |
| `results.md` | Human-readable version: summary tables, outlier / mismatch / error tables, then one row per run (id, title, section, method, verdict, governing check and utilisation, Mcr, C1, lambda_LT, chi_LT, Mb,Rd, Mc,Rd, Vpl,Rd, deflection ratio, unsupported / blocking messages, runtime ms). |
| `hand-checks.cjs` / `hand-checks.md` | 19 Sep 2026 campaign: 16 cases (29 quantities) recomputed by hand from the section table rows and the case inputs with every step written out (web bearing F_Rd types (a)/(b)/(c) and RHS, two-span and three-span pattern moments by Clapeyron, standard Mcr with C2 zg, SN006a cantilever with Eq (7), PFC N_cr,T / N_cr,TF, RHS high-shear M_v,Rd, A_eff, warping-torsion cantilever and warping-fixed twists); `node tests/batch/hand-checks.cjs` prints the table, exit code 1 above 1 %. |
| `mcr-method-comparison.md` | 19 Sep 2026 campaign: engineering reasons for every eigen / standard Mcr ratio outlier and whether the closed form is unconservative; two findings led to engine changes (UB-27, UB-40), one recommendation is open (overhangs on the closed-form route). |

## How to run

From the repo root (Node 24):

```
node tests/batch/run-batch.cjs              # whole campaign (~1-4 min, eigen solves dominate)
node tests/batch/run-batch.cjs PFC MIX-0    # only cases whose id contains one of the substrings
```

The runner prints one line per run as it goes, then a one-line summary, and
rewrites `results.json` / `results.md`. Exit code is 1 only when a run threw
(verdict `ERROR`); FAIL verdicts and cross-check mismatches are reported, not
fatal, because a FAIL is a legitimate design verdict.

The regular suite (`node --test tests/*.test.cjs`) does not run the campaign;
it is a separate, longer job.

## Verdicts

| Verdict | Meaning |
|---|---|
| PASS | `checks(a).pass` is true: every printed utilisation <= 1 and nothing blocking. |
| FAIL | at least one printed utilisation > 1 (a 99.000 utilisation is the engine's sentinel for an unbounded check, e.g. the Annex A amplifier when M_Ed >= Mcr). |
| NOT VERIFIED | all utilisations <= 1 but the engine declared part of the design not covered (e.g. torsional-flexural buckling of a channel under axial load, cold-formed torsion constants, partial-span torque on an open section). |
| ERROR | `analyse()` or `checks()` threw; the message is recorded. Zero in the current library - invalid inputs are fixed in the case, not skipped. |

## Cross-checks (computed independently in the runner)

All from the raw section table values and the case inputs, never from the
engine's intermediate results. Tolerance 0.5 % relative unless stated.

| Id | Check | Applies to |
|---|---|---|
| i-Mmax, i-dmax | Simply supported or cantilever single-load closed forms (full-span UDL incl. self-weight, central / tip point load) for Mmax and dmax, using the governing ULS / SLS combination factors | SS and cantilever cases without hinges or other load shapes (115 runs) |
| ii-equilibrium | sum of reactions + sum of applied vertical loads = 0 for the governing-moment combination (1 N floor for moment-only loading) | every run |
| iii-McrStd | Standard closed-form Mcr recomputed: SN003a with G = 81000 N/mm2 for I / H and box sections (Iw = 0 for a box), SN006a C x Mcr0 for I/H cantilevers. C1 / C2 are derived in the runner from the case's load list and support types (SN003a Table 3.2 rows 1.127/0.454, 1.348/0.630, 2.578/1.554, 1.683/1.645; the SCI end-moment curve for couples only; Serna's quarter-point expression otherwise), z_g from the case's `za` / per-load `zg` (most destabilising active load, sign reversed for an upward load) and LE from the LE factor, the destabilising switch and the segment length - never from the engine's own C1 / C2 / zgUsed / LE. In eigen runs the engine's comparison value (`ltb.McrStandard`, same segment and same LTB-governing combination) is checked; in standard runs the design value | doubly symmetric sections (158 runs) |
| iii-zgBlock | A destabilising z_g on a diagram without a published C2 must be BLOCKED by the standard route (unless the destabilising L_E switch carries it); the runner derives the expectation from the case and looks for the engine's blocking message | standard runs of I / H and box sections (76 runs) |
| iv-McrRatio | Mcr,eigen / Mcr,standard for the same segment, flagged when outside 0.85-1.25. An outlier is interesting output, not necessarily an error | eigen runs with a closed-form comparison (94 runs) |
| v-MbRd<=McRd | Mb,Rd <= Mc,Rd | every LTB run that produced an Mb,Rd |
| vi-governing | the reported governing utilisation equals the max of the printed utilisations | every run |
| vii-uplift | every support whose reaction is negative in the governing-moment combination is reported by the engine's uplift record and, unless the case declares `holdDown` for it, carries a blocking "Hold-down required" message; every reported lifting support has a hold-down message | every run |
| viii-FRd | Web transverse-force resistance (EN 1993-1-5 clause 6, G2): F_Rd at the engine's governing station recomputed from the raw section table (h_w = h - 2t_f, t_w, t_f, b_f <= t_w + 30 eps t_f, m1, m2 with the m2 = 0 second pass, k_F of type (a) with a = L or type (c) with c = max(d - s_s/2, 0), the (a)/(c) pair in the end zone), s_s from the case (support default = B, load default = 0); the printed utilisation must equal the largest station ratio and a stiffened station must never govern. 19 Sep 2026 campaign: extended to a point load over a support ('both' station, type (b) k_F = 3.5 + 2(h_w/a)^2 with (c) alongside in the end zone, F_Ed = max(P, R) verified against the engine's own P and R), to PFC (one-sided flange b_f <= t_w + 15 eps t_f) and to RHS/SHS (two webs of thickness t with the tabulated flat depth, flange share B/2 per web <= t + 15 eps t, lever-rule share 0.5 + e/(B - t) of the load) | every run with a checked station and no declared stiffener (292 runs) |
| ix-Aeff | Effective area of a Class-4 web in uniform compression (EN 1993-1-5 4.4, G3): lambda_p = (d/t)/(28.4 eps x 2), rho = (lambda_p - 0.22)/lambda_p^2, A_eff = A - n_webs (1 - rho) d t_w from the raw table; must equal the engine's A_eff, feed the "Compression N_Ed/N_c,Rd (A_eff)" entry and the strut block | runs with N > 0 and d/t > 42 eps (UB-46, UB-47, UB-48) |
| x-NbT | Channel torsional-flexural buckling (cl 6.3.1.4, G3): i_0^2, N_cr,T (P385 I_T, I_w, y0 = e_sc, L_T = L_cr,z or the case L_T), N_cr,TF coupled with the y-y mode, lambda_T, chi_T on curve c, N_b,T,Rd recomputed from the raw PFC table; the verdict entry must equal N_Ed/N_b,T,Rd and the 6.61/6.62 axial terms must not be below N_Ed/N_b,y,Rd, N_Ed/N_b,z,Rd | PFC runs with N > 0 (PFC-20, both routes) |
| xi-kcFloor | k_c floor (G3): the printed k_c must equal max(1/sqrt(C1), 1/sqrt(2.76)) on both routes and be flagged floored exactly when C1 > 2.76 | I/H LTB runs with a trusted C1 and no user override (74 runs) |
| xii-MVN | cl 6.2.10 (G3): at the engine's worst high-shear station of a uniaxial case with N, rho, N_V,Rd, M_v,y,Rd, a_V, the 6.2.9.1(4) waiver and M_N,V,y,Rd recomputed from the station V, M, N and the raw table; the utilisation must equal the engine's value and the verdict entry. 19 Sep 2026 campaign: rolled I/H Class 1/2 (plastic 6.2.9.1), rolled I/H Class 3 (linear n_V + M/M_v,y,Rd with the elastic web deduction) and RHS/SHS Class 1/2 (Eq 6.39 with a_w,V <= 0.5, no waiver) | UB-48, HSV-01, HSV-05, HSV-07 |
| xiii-torsionFE | Warping-torsion FE (G4): the engine's peak twist on the FE route recomputed from the classical closed forms of E I_w phi'''' - G I_T phi'' = m_t with the raw P385 constants (I_T, I_w, a = sqrt(E I_w/G I_T)): a cantilever with a single tip point torque, phi_tip = (T/GI_T)[L - a tanh(L/a)] with T_t = 0 at the root and total torque T at the tip (UB-49); a cantilever under a full-span uniform torque m, phi_tip = (m/GI_T)[L^2/2 + a^2(1 - sech(L/a)) - aL tanh(L/a)] with the root total torque mL and zero tip torque (TOR-05; derivation in hand-checks.md HC-14); a fork-fork span with both ends warping-fixed under a full-span uniform torque, phi_mid = (t/GI_T)[L^2/8 - (La/2) tanh(L/4a)] with T_t = 0 at both ends (UB-51); tolerance 1e-4, the printed mesh error must be <= 1e-3 and converged | rolled I/H runs on the FE route with those layouts (6 runs) |
| xiv-pattern | Pattern loading (G1): for a pinned continuous beam with supports at both ends, no hinges and loads that are all UDLs aligned with span boundaries, the interior support moments and every reaction of EVERY analysed ULS combination (patterns included) recomputed from the three-moment (Clapeyron) equation with each combination's own span loads - the case's Q loads clipped to the pattern's spans independently of the engine, self-weight on every span at the G factor; tolerance 0.5 % (1 kN.m floor) | UB-14, UB-15, UC-07, PFC-10, SHS-05, RHS-08, RHS-09, PAT-01/02/03/06, UPL-03, TOR-02 (32 runs) |
| xv-MvRd | High-shear M_v,Rd for every family (G3 item 12): at the engine's worst coexistent M-V station, rho from the station V and V_pl(,T),Rd and M_v,y,Rd by family and class (I/H Class 1/2 W_pl - rho A_v^2/4t_w; I/H Class 3 W_el - rho I_web/(h/2); channel W_y - rho t_w h_w^2/4; RHS/SHS W_y - rho t (h - 2t)^2/2) recomputed from the raw table; M/M_v,Rd must equal the engine's value | every run with a reduced coexistent station that is not a pure shear failure (8 runs) |

Cross-check (iii) samples the quarter-point and mid-span ordinates of a diagram
with a jump (applied in-span couple) on the larger side, the envelope convention
the engine adopted in the 19 Sep 2026 campaign (`mAtStation()`; finding F1 of
`mcr-method-comparison.md`).

Since the 19 Sep 2026 gap closure the analysed combination list of a multi-span,
overhang or Gerber case includes the automatic Q patterns (`a.patterns`, column
"Combos" in the runs table). Cross-check (iii) re-derives the closed-form inputs
from the pattern's own load set: `maskedLoads()` clips the case's Q loads to the
governing pattern's segments independently of the engine (`comboLoadPieces`),
and the LTB-governing combination of an eigen run is looked up in the analysed
list (it may be a generated pattern).

The runner also compares the case's `expect` triggers with the triggers it can
observe from the check output (axial / biaxial / tension / torsion / Annex A /
flexural buckling / interaction / torsional-flexural gap / restraints / shear
buckling) and lists the differences.

## Case coverage (170 cases, 296 runs)

| Family | Cases | LTB (x2 runs) | Fully restrained | Notes |
|---|---|---|---|---|
| UB | 91 | 69 | 22 | 127x76x13 to 1016x305x272, incl. curve-c / curve-d shapes, deep 914 and 1016 sections, S355; G3: 1016x305x249 + 3000 kN (A_eff), 457x191x82 + 600 kN unrestrained (A_eff, Class 2 combined), 457x191x82 2 m point load 0.3 m + 600 kN (6.2.10); G4: 457x191x82 cantilever with an eccentric tip load, partial-span eccentric UDL, full UDL with both supports warping-restrained (warping-torsion FE); campaign: WEB-01..05/07, PAT-01..07, UPL-01..04, HSV-01/07, TOR-02/03/05/06, AEF-01..05, BIX-01..05, UB-52 |
| UC | 16 | 14 | 2 | 152x152x23 to 356x406x235; campaign: TOR-04 (203x203x60, warping-fixed ends) |
| PFC | 29 | 22 | 7 | 100x50x10 to 430x100x64, e = 0 / small / flange half-width, web-side e < 0; G3: 180x75x20 + 50 kN (torsional-flexural buckling); G4: 180x75x20 two-span at e = 20 mm; campaign: WEB-08, TFB-01..04 (incl. user L_T and the torsion + N block), HSV-02/03, TOR-01 (cantilever) |
| SHS | 12 | 7 | 5 | hot-finished and cold-formed; campaign: HSV-06 (200x200x8 + M_z, 6.2.10 biaxial) |
| RHS | 22 | 16 | 6 | h/b up to 3 (300x100), 500x300, 450x250; campaign: WEB-06 (two webs, lever rule), UPL-05 (overhang), HSV-04/05 (high shear, 6.2.10 Eq 6.39) |

Supports: 121 simply supported (2 with both supports warping-restrained for
torsion, `warpFix`; 3 with s_s entered at the ends), 16 two-span, 5 three-span,
10 cantilevers, 4 propped cantilevers (+1 with an internal hinge), 7
fixed-fixed (+1 fixed - pinned - fixed), 6 overhang beams, 2 Gerber beams.
Loads: full UDL, partial UDL, trapezoidal / triangular, single and multiple
point loads incl. loads at 0.25-0.4 m from a support and directly over a
support, applied end and in-span couples incl. psi = +1, 0 and -1, mixed
UDL + UVL + point + couple, uplift through an upward W load (GQW combos),
through a negative W factor (GQWneg) and through an overhang with a light back
span, unbalanced Q patterns over 2 and 3 spans (on and off).
Eccentricity / load height: eccOn in 38 cases (open-section torsion on the P385
closed forms or the warping-torsion FE, box torsion), zg = +D/2 and -D/2
through `za` and per-load `zg`, a per-load mixed top / bottom case (MIX-08),
the destabilising switch with and without a load height (UB-40 / UB-52).
Axial: compression in 20 cases up to ~0.55 N_c,Rd(A_eff), tension in 3; Mz in
13 cases; intermediate lateral restraints at third points, quarter points, at
the point loads and at 1.5 m centres with a separate L_T in 13 cases; LE
factor + destabilising switch (UB-40, UB-52); root warping restrained (UB-19).
Web bearing inputs: per-support and per-load s_s (40, 50, 60, 100, 150, 200
mm) and declared bearing stiffeners (WEB-02, HSV-03, HSV-05, HSV-07).

### 19 Sep 2026 campaign groups (cases.cjs, "verification campaign" block)

Every group has at least one PASS and one FAIL / BLOCK so that each new check
is seen deciding the verdict in both directions; the eigen-run verdicts are:

| Group | Check exercised | Cases (eigen verdict) |
|---|---|---|
| WEB | EN 1993-1-5 cl 6 / 7.2 (G2) | WEB-01 FAIL (type (a), s_s = 0, 1.41), WEB-02 PASS (same with a stiffener declared), WEB-03 FAIL (7.2 interaction alone, 1.10), WEB-04 FAIL (type (c) end reaction s_s = 40, 1.01), WEB-05 PASS (s_s = 100, 0.73), WEB-06 PASS (RHS two webs, lever rule), WEB-07 FAIL (type (b) over the interior support, 2.07), WEB-08 PASS (PFC) |
| PAT | automatic pattern loading (G1) | PAT-01 PASS (2 x 6 m, 3 ULS combinations) vs PAT-02 (off, 1), PAT-03 PASS (3 x 5 m, 7 combinations) vs PAT-06 (off), PAT-04 PASS (back span + overhang, tip deflection under the "Q on the overhang only" pattern), PAT-05 PASS (point-load patterns), PAT-07 PASS (fixed - pinned - fixed) |
| UPL | uplift / hold-down (G1) | UPL-01 NOT VERIFIED (ULS uplift, no hold-down), UPL-02 PASS (hold-down provided, advisory), UPL-03 PASS (SLS-only uplift advisory), UPL-04 PASS (wind uplift with hold-downs), UPL-05 NOT VERIFIED (RHS overhang, restrained path) |
| TFB | channel torsional-flexural buckling (G3) | TFB-01 PASS (0.13), TFB-02 PASS (user L_T = 2.5 m), TFB-03 FAIL on N_Ed/N_b,T,Rd (1.04, L_cr,z = 1.5 m but L_T = 6 m), TFB-04 NOT VERIFIED (torsion + N block) |
| HSV | high-shear M_v,Rd and cl 6.2.10 (G3) | HSV-01 PASS (I/H Class 3 linear 6.2.10, 0.73), HSV-02 PASS (channel, rho 0.19), HSV-03 FAIL (channel coexistent M-V 1.03 at rho 0.98), HSV-04 FAIL (RHS coexistent 1.06), HSV-05 FAIL (RHS 6.2.10 Eq 6.39 1.02), HSV-06 PASS (SHS biaxial 6.2.10 0.96), HSV-07 FAIL on the end-reaction web check with the Class-3 6.2.10 at 0.76 |
| TOR | warping-torsion FE (G4) | TOR-01 FAIL (PFC cantilever, Annex A 1.09), TOR-02 PASS (two-span UB at e = 60), TOR-03 PASS (partial-span UDL, 0.96), TOR-04 PASS (UC, warping-fixed ends), TOR-05 PASS (UB cantilever, uniform torque, closed form reproduced), TOR-06 PASS (overhang with an eccentric tip load, 0.97) |
| AEF | A_eff of a Class-4 web under N (G3) | AEF-01 PASS (1016x305x222, 0.888 A), AEF-02 FAIL (914x305x201 + 3300 kN, Eq 6.62 1.07), AEF-03 PASS (S355 610x229x101), AEF-04 NOT VERIFIED (Class-4 stress-gradient block), AEF-05 PASS (762x267x134 with a mid-span restraint) |
| BIX | I/H with M_z (G3) | BIX-01 PASS (0.95), BIX-02 FAIL (1.55), BIX-03 PASS (unrestrained, Eq 6.62 0.92), BIX-04 PASS (beam-column with A_eff), BIX-05 FAIL (Eq 6.62 1.08) |
| LTB | destabilising switch (campaign finding F2) | UB-52 FAIL (top-flange z_g entered, 1.06) beside UB-40 (z_g = 0: eigen NOT VERIFIED, standard FAIL on L_E x 1.2) |

A tag `-id` in `cases.cjs` removes a derived trigger id from `expect` when the
case is designed to exercise a block that keeps a check from running (AEF-04).

## Results of the current run (2026-09-19, Node v24.14.1, verification campaign)

Verdicts: PASS 205 | FAIL 71 | NOT VERIFIED 20 | ERROR 0 (170 cases, 296 runs).
Cross-check mismatches: 0 runs (viii-FRd 292/292, ix-Aeff 16/16, x-NbT 9/9,
xi-kcFloor 99/99, xii-MVN 4/4, xiii-torsionFE 6/6, xiv-pattern 32/32,
xv-MvRd 8/8, iii-McrStd 212/212, iii-zgBlock 101/101, i-Mmax / i-dmax
161/161, ii-equilibrium, vi-governing and vii-uplift 296/296). Trigger
mismatches: 0. Every case executes (ERROR 0).

Changes against the post-G4 run (PASS 161 | FAIL 47 | NOT VERIFIED 14, 122
cases / 222 runs): 48 cases added (the campaign groups above and UB-52).
Of the 222 original runs, 219 print exactly the same rows; three moved through
the two campaign findings of `mcr-method-comparison.md`: UB-27 standard (in-span
couple at mid-span: the quarter-point sample now takes the larger side of the
jump, C1 1.676 -> 1.206, M_cr 382.3 -> 275.0 kN.m, LTB 0.743 -> 0.982, still
PASS, no longer an eigen / standard outlier), MIX-01 standard (couple at 3L/4:
M_cr 273.3 -> 257.3, LTB 0.810 -> 0.851, PASS) and UB-40 eigen (destabilising
switch with every z_g = 0: PASS 0.843 -> NOT VERIFIED, contradictory input
blocked; UB-52 with the load height entered FAILs at 1.06 on both routes).

Hand checks (`hand-checks.md`): 29 quantities over 16 cases, every difference
below 0.001 %. Eigen / standard ratio outliers: 12 same-segment (UB-23, UB-40,
UB-44, PFC-09, SHS-06, RHS-07, MIX-06, PAT-04, UPL-01/02, TOR-06, UB-52), 52
across the two runs - all explained in `mcr-method-comparison.md`; after the
UB-27 fix the only closed-form value on the unconservative side is UB-44
(printed M_cr 47 % above the eigenvalue with PASS refused).

### Per section family

| Family | Cases | Runs | PASS | FAIL | NOT VERIFIED | ERROR |
|---|---|---|---|---|---|---|
| UB | 91 | 160 | 105 | 43 | 12 | 0 |
| UC | 16 | 30 | 26 | 2 | 2 | 0 |
| PFC | 29 | 49 | 32 | 16 | 1 | 0 |
| SHS | 12 | 19 | 15 | 2 | 2 | 0 |
| RHS | 22 | 38 | 27 | 8 | 3 | 0 |

### Per Mcr method

| Method | Runs | PASS | FAIL | NOT VERIFIED | ERROR |
|---|---|---|---|---|---|
| eigen | 126 | 101 | 17 | 8 | 0 |
| standard | 126 | 76 | 41 | 9 | 0 |
| n/a (restrained) | 44 | 28 | 13 | 3 | 0 |

### Cross-check totals

| Check | Runs | OK | Mismatch |
|---|---|---|---|
| i-Mmax | 161 | 161 | 0 |
| i-dmax | 161 | 161 | 0 |
| ii-equilibrium | 296 | 296 | 0 |
| iii-McrStd | 212 | 212 | 0 |
| iii-zgBlock | 101 | 101 | 0 |
| iv-McrRatio | 126 | 114 | 12 flagged |
| v-MbRd<=McRd | 252 | 252 | 0 |
| vi-governing | 296 | 296 | 0 |
| vii-uplift | 296 | 296 | 0 |
| viii-FRd | 292 | 292 | 0 |
| ix-Aeff | 16 | 16 | 0 |
| x-NbT | 9 | 9 | 0 |
| xi-kcFloor | 99 | 99 | 0 |
| xii-MVN | 4 | 4 | 0 |
| xiii-torsionFE | 6 | 6 | 0 |
| xiv-pattern | 32 | 32 | 0 |
| xv-MvRd | 8 | 8 | 0 |

### Eigen / standard Mcr outliers

Same segment (the engine's own comparison inside the eigen run, 12 of 126):
UB-23 1.362 and TOR-06 1.362 (7 m + 2 m overhang), PAT-04 1.527 and
UPL-01/02 2.529 (back span + overhang), UB-40 1.657 and UB-52 1.573 (L_E x 1.2
device on the closed form), UB-44 0.679 (C2 not published, standard route
blocked), PFC-09 1.996 (channel cantilever), SHS-06 1.397 and RHS-07 1.690
(box cantilevers, C1 = 1), MIX-06 1.724 (internal hinge). Across the two runs
(design eigen / design standard): 52 of 126 - every multi-span or
intermediately restrained member, every channel on the kappa chain, the
overhangs and the single-span limitations above. The ratio is M_cr,eigen /
M_cr,standard: below 1 the closed form is the higher (unconservative) value,
which after the UB-27 fix happens only for UB-44 where PASS is refused anyway.
The engineering reasons, case by case, are in `mcr-method-comparison.md`.

### Known gaps surfaced

- Campaign findings (19 Sep 2026, `mcr-method-comparison.md`): F1 quarter-point
  sampling at a moment jump (fixed, `mAtStation()`); F2 destabilising switch
  with z_g = 0 on the eigen route (fixed, blocking message); F3 the SN003a
  closed form applied with fork ends to overhang layouts (open recommendation:
  block or treat the back span as the segment; conservative in the five library
  cases); F4 UB-44 prints an unconservative closed-form M_cr with PASS refused.

- Web transverse forces (G2): outside the WEB / HSV campaign cases the
  supports carry no `ss`, so the section flange width B is used as a typical
  seating length [verify], and the point loads carry no `ss` (0 mm). Add `ss`
  (mm) and `stiff: true` to a support or point load object in `cases.cjs` to
  model the actual bearing or a declared stiffener (WEB-02..05, HSV-03/05/07
  do); the G2 verdict changes follow from these defaults.

- Wind-uplift and end-couple cases (UB-26, UB-36, UB-37, UC-13, RHS-16):
  a support lifts at ULS and no hold-down is declared in the case -> NOT
  VERIFIED with the hold-down force printed (item 1.2 now implemented; add
  `holdDown: true` to the support to turn it into an advisory).

- Open-section torsion outside the P385 closed forms (G4): PFC-17, UB-49/50/51
  and PFC-21 now run the warping-torsion FE (`c.tor.fe`, column
  `torsionMethod` = `fe` in results.json with the mesh error `torsionMesh`);
  every support is a fork unless the case sets `warpFix: true` on it, a
  cantilever root is warping-fixed automatically. The 0.5 % mesh block never
  triggers in the library (largest mesh error 3.1e-4, PFC-21).
- Channel + axial compression: evaluated since G3 (cl 6.3.1.4, PFC-11, PFC-20,
  TFB-01..03); a channel with an eccentric load AND N_Ed (TFB-04) is still
  blocked by the "combined torsion with direct axial force" message.
- SHS-07 (cold-formed SHS with eccentric load): torsion constants use
  hot-finished corner geometry -> NOT VERIFIED.
- PFC-16 and MIX-10 in standard mode: M_y,Ed reaches Mcr so the EN 1993-6
  Annex A amplifier is unbounded (utilisation printed as the 99.000 sentinel).

## Adding cases

Use the builders in `cases.cjs` (`P`, `UDL`, `TRAP`, `MOM`, `SS`, `CANT`,
`PROPPED`, `FIXFIX`, `PINS`, `R`, `GQ`, `GQW`, `GQWneg`, `UB`, `UC`, `PFC`,
`SHS`, `RHS`) and `mk(id, title, section, overrides, tags)`. Section keys must
exist in `js/sections/*.js` (UB / UC / RHS keys carry spaces, e.g.
`'457 x 191 x 82'`; PFC and SHS keys do not, e.g. `'200x90x30'`,
`'100x100x5.0'`). `expect` is derived automatically from the inputs; add extra
trigger ids through `tags`. Ids must be unique - the module throws otherwise.
