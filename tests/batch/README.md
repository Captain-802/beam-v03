# 100-beam verification campaign - headless batch runner

Runs the EC3 beam checker over a library of 118 distinct beams without a
browser, records every printed design quantity, and cross-checks the engine
against independent closed forms computed in the runner. LTB cases are run
with BOTH Mcr methods (`eigen` FE eigensolver and `standard` closed form), so
the 118 cases give 214 runs.

## Files

| File | Purpose |
|---|---|
| `cases.cjs` | Case library: array of `{id, title, overrides, expect, tags}`. `overrides` is what `tests/harness.cjs` `reset()` merges over `DEMO` (see `js/03-state-ui.js`). `expect` is the list of trigger ids from `docs/EC3_BEAM_TRIGGER_LIST.md` the case is designed to exercise. |
| `run-batch.cjs` | The runner. Loads the app through `tests/harness.cjs` (Node vm, no DOM), runs `analyse()` + `checks()` per case and method, applies the cross-checks, writes the two result files. |
| `results.json` | Full record of the last run: `summary` (verdict tables, cross-check totals, outliers, errors, trigger mismatches) and `runs` (one object per run with every extracted quantity, all cross-check details and the observed triggers). |
| `results.md` | Human-readable version: summary tables, outlier / mismatch / error tables, then one row per run (id, title, section, method, verdict, governing check and utilisation, Mcr, C1, lambda_LT, chi_LT, Mb,Rd, Mc,Rd, Vpl,Rd, deflection ratio, unsupported / blocking messages, runtime ms). |

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
| viii-FRd | Web transverse-force resistance (EN 1993-1-5 clause 6, G2): F_Rd at the engine's governing station recomputed from the raw section table (h_w = h - 2t_f, t_w, t_f, b_f <= t_w + 30 eps t_f, m1, m2 with the m2 = 0 second pass, k_F of type (a) with a = L or type (c) with c = max(d - s_s/2, 0), the (a)/(c) pair in the end zone), s_s from the case (support default = B, load default = 0); the printed utilisation must equal the largest station ratio and a stiffened station must never govern | rolled I/H runs without a declared stiffener (122 runs) |
| ix-Aeff | Effective area of a Class-4 web in uniform compression (EN 1993-1-5 4.4, G3): lambda_p = (d/t)/(28.4 eps x 2), rho = (lambda_p - 0.22)/lambda_p^2, A_eff = A - n_webs (1 - rho) d t_w from the raw table; must equal the engine's A_eff, feed the "Compression N_Ed/N_c,Rd (A_eff)" entry and the strut block | runs with N > 0 and d/t > 42 eps (UB-46, UB-47, UB-48) |
| x-NbT | Channel torsional-flexural buckling (cl 6.3.1.4, G3): i_0^2, N_cr,T (P385 I_T, I_w, y0 = e_sc, L_T = L_cr,z or the case L_T), N_cr,TF coupled with the y-y mode, lambda_T, chi_T on curve c, N_b,T,Rd recomputed from the raw PFC table; the verdict entry must equal N_Ed/N_b,T,Rd and the 6.61/6.62 axial terms must not be below N_Ed/N_b,y,Rd, N_Ed/N_b,z,Rd | PFC runs with N > 0 (PFC-20, both routes) |
| xi-kcFloor | k_c floor (G3): the printed k_c must equal max(1/sqrt(C1), 1/sqrt(2.76)) on both routes and be flagged floored exactly when C1 > 2.76 | I/H LTB runs with a trusted C1 and no user override (74 runs) |
| xii-MVN | cl 6.2.10 (G3): at the engine's worst high-shear station of a rolled I/H Class 1/2 uniaxial case, rho, N_V,Rd, M_v,Rd, a_V, the 6.2.9.1(4) waiver and M_N,V,Rd recomputed from the station V, M, N and the raw table; M/M_N,V,Rd must equal the engine's value and the verdict entry | UB-48 |

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

## Case coverage (118 cases, 214 runs)

| Family | Cases | LTB (x2 runs) | Fully restrained | Notes |
|---|---|---|---|---|
| UB | 54 | 44 | 10 | 127x76x13 to 1016x305x272, incl. curve-c / curve-d shapes, deep 914 and 1016 sections, S355; G3: 1016x305x249 + 3000 kN (A_eff), 457x191x82 + 600 kN unrestrained (A_eff, Class 2 combined), 457x191x82 2 m point load 0.3 m + 600 kN (6.2.10) |
| UC | 15 | 13 | 2 | 152x152x23 to 356x406x235 |
| PFC | 20 | 16 | 4 | 100x50x10 to 430x100x64, e = 0 / small / flange half-width, web-side e < 0; G3: 180x75x20 + 50 kN (torsional-flexural buckling) |
| SHS | 11 | 7 | 4 | hot-finished and cold-formed |
| RHS | 18 | 16 | 2 | h/b up to 3 (300x100), 500x300, 450x250 |

Supports: 84 simply supported, 7 two-span, 2 three-span, 6 cantilevers, 4
propped cantilevers (+1 with an internal hinge), 6 fixed-fixed, 2 overhang
beams, 2 Gerber beams (one and two hinges).
Loads: full UDL (92), partial UDL (5), trapezoidal / triangular rising and
falling (7), single and multiple point loads incl. loads at 0.25-0.3 m from a
support (29 / 8), applied end and in-span couples incl. psi = +1, 0 and -1 (6),
mixed UDL + UVL + point + couple, uplift through an upward W load (GQW combos)
and through a negative W factor (GQWneg), unbalanced Q patterns over 2 and 3
spans.
Eccentricity / load height: eccOn in 26 cases (16 with e > 0 up to the flange
half-width, on PFC, UB, SHS and RHS), zg = +D/2 and -D/2 through `za` and
per-load `zg` (10, incl. the fixed-ended UDL and central-point rows of SN003a
Table 3.2 with C2 = 1.554 / 1.645 in UB-43 / UB-45 and an off-centre point
load with no published C2 in UB-44, which the standard route must block), a
per-load mixed top / bottom case (MIX-08).
Axial: compression in 8 cases up to ~0.27 Npl, tension in 3; Mz in 7 cases;
intermediate lateral restraints at third points, quarter points and at the
point loads in 9 cases; LE factor + destabilising switch (UB-40); root
warping restrained (UB-19).

Loads are sized so the governing eigen utilisation mostly lies in 0.6-0.95.
Deliberately heavy cases (tag `heavy`: UB-02 demo unrestrained, UB-22 curve d)
exercise the FAIL path.

## Results of the current run (2026-09-19, Node v24.14.1, after the G3 gap closure)

Verdicts: PASS 155 | FAIL 44 | NOT VERIFIED 15 | ERROR 0 (118 cases, 214 runs).
Cross-check mismatches: 0 runs (viii-FRd 126/126, ix-Aeff 4/4, x-NbT 3/3,
xi-kcFloor 75/75, xii-MVN 1/1). Trigger mismatches: 1 case (PFC-17, see
below). Changes against the post-G2 run (PASS 149 | FAIL 43 | NOT VERIFIED
16): UB-31 (254x146x31 with Mz = 8 kN.m, unrestrained) is Class 1 instead of
Class 3 under the former uniform-compression web bound and PASSes Eq 6.62 at
0.88 (was FAIL 1.08); UB-30 (same, restrained) keeps PASS with the plastic
biaxial form 0.51 (was the elastic 0.98); PFC-11 (430x100x64 + 150 kN) is
PASS instead of NOT VERIFIED, the cl 6.3.1.4 torsional-flexural check giving
N_Ed/N_b,T,Rd = 0.07; UB-24 standard (Gerber, Serna C1 > 2.76) and MIX-09
standard move with the k_c floor 0.60 (LTB 1.232 -> 1.292 FAIL, 0.621 ->
0.634 PASS). New cases: UB-46 (1016x305x249 + 3000 kN, 12 m restrained:
evaluates with A_eff = 0.905 A, FAIL Eq 6.62 = 2.43 about z-z), UB-47
(457x191x82 + 600 kN, unrestrained: PASS 0.99 with A_eff and the Class-4
column), UB-48 (2 m, 400 kN at 0.3 m + 600 kN: cl 6.2.10 = 0.32 at x = 0.3 m,
FAIL on the web transverse force as UB-35-type cases), PFC-20 (180x75x20 +
50 kN: N_b,T,Rd = 385.4 kN, PASS eigen 0.69, FAIL standard 1.03 on the
conservative channel kappa chain). Every other verdict is unchanged.

Changes of the post-G2 run against the post-G1 run (PASS 154 | FAIL 38 | NOT VERIFIED 16): five
runs now FAIL the new web transverse-force check (EN 1993-1-5 clause 6 / 7.2),
all with the default s_s = B [verify] at the supports and s_s = 0 at the point
loads: UB-35 (914x419x388, 3 m, central 4500 kN ULS point load on an
unstiffened web: F_Ed/F_Rd = 4500/2255 = 1.995, type (a), s_s = 0), UB-17
(1016x305x272 two-span, interior reaction 2302 kN vs F_Rd 2100 kN, 7.2 with
the hogging moment 1.132), UB-24 and MIX-02 (Gerber beams, interior reaction
under the "Q on spans 2+3 only" pattern with the coincident hogging moment:
7.2 = 1.053 / 1.024 while F_Ed/F_Rd = 0.946 / 0.896). Twelve runs are now
governed by a web entry (UB-14, UB-15, UB-17, UB-24, UB-35, UB-41, UC-07,
MIX-02, MIX-05): heavy interior reactions of continuous beams. Every other
verdict is unchanged.

Changes of the post-G1 run against the pre-G1 run (PASS 168 | FAIL 34 | NOT VERIFIED 6): the
wind-uplift cases UB-36, UB-37, RHS-16 and the end-couple cases UB-26, UC-13
lift a support at ULS and are now NOT VERIFIED ("Hold-down required", the
trigger 1.2 they were written for); the overhang cases UB-23 (LTB 0.85 -> 1.16
with Q on the back span only) and RHS-17 (tip deflection 0.6 -> 18.6 mm with Q
on the overhang only, L/180) and the Gerber case UB-24 (standard route) FAIL
under the generated patterns; MIX-02 moves within PASS. The Q-only SLS
combination lifts a support of most continuous beams (UB-14/15/17/24/41, UC-07,
PFC-10, SHS-05, RHS-08/09, MIX-01/02, RHS-16 W-only): reported as an advisory,
not blocking (see AUDIT.md).

### Per section family

| Family | Cases | Runs | PASS | FAIL | NOT VERIFIED | ERROR |
|---|---|---|---|---|---|---|
| UB | 54 | 98 | 66 | 24 | 8 | 0 |
| UC | 15 | 28 | 24 | 2 | 2 | 0 |
| PFC | 20 | 36 | 25 | 10 | 1 | 0 |
| SHS | 11 | 18 | 14 | 2 | 2 | 0 |
| RHS | 18 | 34 | 26 | 6 | 2 | 0 |

### Per Mcr method

| Method | Runs | PASS | FAIL | NOT VERIFIED | ERROR |
|---|---|---|---|---|---|
| eigen | 96 | 78 | 11 | 7 | 0 |
| standard | 96 | 59 | 29 | 8 | 0 |
| n/a (restrained) | 22 | 18 | 4 | 0 | 0 |

### Cross-check totals

| Check | Runs | OK | Mismatch |
|---|---|---|---|
| i-Mmax | 120 | 120 | 0 |
| i-dmax | 120 | 120 | 0 |
| ii-equilibrium | 214 | 214 | 0 |
| iii-McrStd | 160 | 160 | 0 |
| iii-zgBlock | 77 | 77 | 0 |
| iv-McrRatio | 96 | 88 | 8 flagged |
| v-MbRd<=McRd | 192 | 192 | 0 |
| vi-governing | 214 | 214 | 0 |
| vii-uplift | 214 | 214 | 0 |
| ix-Aeff | 4 | 4 | 0 |
| x-NbT | 3 | 3 | 0 |
| xi-kcFloor | 75 | 75 | 0 |
| xii-MVN | 1 | 1 | 0 |
| viii-FRd | 126 | 126 | 0 |

### Eigen / standard Mcr outliers

Same segment (the engine's own comparison inside the eigen run, 8 of 94):

| Case | Ratio | Standard route | Layout |
|---|---|---|---|
| UB-23 | 1.362 | Serna | 7 m span + 2 m overhang, UDL + tip load (governing pattern: Q on the back span only) |
| UB-27 | 0.830 | Serna | SS, UDL + in-span couple + point load |
| UB-40 | 1.657 | uniform | SS UDL with LE factor 1.2 + destabilising (closed form uses LE = 1.2 x 1.2 x 8 = 11.52 m, the eigensolver solves the 8 m member) |
| UB-44 | 0.679 | Serna | SS, point load at 0.35L with top-flange z_g: the closed form has no C2 for this diagram (blocked on the standard route), the eigen value carries the load height |
| PFC-09 | 1.996 | channel | 3.5 m cantilever, UDL |
| SHS-06 | 1.397 | cantilever (C1 = 1) | 4 m cantilever, tip load + UDL |
| RHS-07 | 1.690 | cantilever (C1 = 1) | 3 m cantilever, UDL + tip load |
| MIX-06 | 1.724 | Serna | fixed - hinge - pinned, UDL |

Across the two runs (design Mcr of the eigen run / design Mcr of the standard
run): 37 of 94. The standard run always treats the member as one segment with
LE = k x L, so every multi-span beam and every beam with intermediate
restraints lands here (UB-06/08/13/14/15/17/24/39/41, UC-07/08, PFC-10/18,
SHS-05, RHS-08/09/14, MIX-02/04 ...) together with the channel cases, where
the standard route's P385/P362 kappa chain (not the closed-form Mcr) is the
design basis. These drive the 26 standard-method FAILs: the closed form is the
conservative whole-member answer and is expected to fail where the eigen
span-by-span check passes. (Since the Sep 2026 review fixes the standard route
of I/H sections uses the SN003a Mcr chain as its design basis; the P362
Expn 6.55 simplified slenderness is printed for comparison only.)

### Known gaps surfaced

- Web transverse forces (G2): the campaign's supports carry no `ss`, so the
  section flange width B is used as a typical seating length [verify], and its
  point loads carry no `ss` (0 mm). Add `ss` (mm) and `stiff: true` to a
  support or point load object in `cases.cjs` to model the actual bearing or a
  declared stiffener; the verdict changes listed above follow from these
  defaults.

- Wind-uplift and end-couple cases (UB-26, UB-36, UB-37, UC-13, RHS-16):
  a support lifts at ULS and no hold-down is declared in the case -> NOT
  VERIFIED with the hold-down force printed (item 1.2 now implemented; add
  `holdDown: true` to the support to turn it into an advisory).

- PFC-17 (partial-span eccentric UDL on a channel): trigger 3.8 (LTB with
  torsion interaction) is expected but the engine reports the partial-span
  torque as NOT COVERED, so the run is NOT VERIFIED (eigen) / FAIL (standard,
  whole-member LTB) without an Annex A check. This is a real engine gap, not
  a case error.
- PFC-11 (channel + axial compression): torsional / torsional-flexural
  buckling (cl 6.3.1.4) not covered -> NOT VERIFIED.
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
