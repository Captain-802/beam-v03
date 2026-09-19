# 100-beam verification campaign - headless batch runner

Runs the EC3 beam checker over a library of 111 distinct beams without a
browser, records every printed design quantity, and cross-checks the engine
against independent closed forms computed in the runner. LTB cases are run
with BOTH Mcr methods (`eigen` FE eigensolver and `standard` closed form), so
the 111 cases give 202 runs.

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
| iii-McrStd | Standard closed-form Mcr recomputed: SN003a with G = 81000 N/mm2 for I / H and box sections, SN006a C x Mcr0 for cantilevers. In eigen runs the engine's comparison value (`ltb.McrStandard`, same segment) is checked; in standard runs the design value | doubly symmetric sections (152 runs) |
| iv-McrRatio | Mcr,eigen / Mcr,standard for the same segment, flagged when outside 0.85-1.25. An outlier is interesting output, not necessarily an error | eigen runs with a closed-form comparison (91 runs) |
| v-MbRd<=McRd | Mb,Rd <= Mc,Rd | every LTB run that produced an Mb,Rd |
| vi-governing | the reported governing utilisation equals the max of the printed utilisations | every run |

The runner also compares the case's `expect` triggers with the triggers it can
observe from the check output (axial / biaxial / tension / torsion / Annex A /
flexural buckling / interaction / torsional-flexural gap / restraints / shear
buckling) and lists the differences.

## Case coverage (111 cases, 202 runs)

| Family | Cases | LTB (x2 runs) | Fully restrained | Notes |
|---|---|---|---|---|
| UB | 49 | 41 | 8 | 127x76x13 to 1016x305x272, incl. curve-c / curve-d shapes, deep 914 and 1016 sections, S355 |
| UC | 14 | 12 | 2 | 152x152x23 to 356x406x235 |
| PFC | 19 | 15 | 4 | 100x50x10 to 430x100x64, e = 0 / small / flange half-width, web-side e < 0 |
| SHS | 11 | 7 | 4 | hot-finished and cold-formed |
| RHS | 18 | 16 | 2 | h/b up to 3 (300x100), 500x300, 450x250 |

Supports: 83 simply supported, 7 two-span, 2 three-span, 6 cantilevers, 4
propped cantilevers (+1 with an internal hinge), 4 fixed-fixed, 2 overhang
beams, 2 Gerber beams (one and two hinges).
Loads: full UDL (92), partial UDL (5), trapezoidal / triangular rising and
falling (7), single and multiple point loads incl. loads at 0.25-0.3 m from a
support (29 / 8), applied end and in-span couples incl. psi = +1, 0 and -1 (6),
mixed UDL + UVL + point + couple, uplift through an upward W load (GQW combos)
and through a negative W factor (GQWneg), unbalanced Q patterns over 2 and 3
spans.
Eccentricity / load height: eccOn in 23 cases (16 with e > 0 up to the flange
half-width, on PFC, UB, SHS and RHS), zg = +D/2 and -D/2 through `za` and
per-load `zg` (7), a per-load mixed top / bottom case (MIX-08).
Axial: compression in 8 cases up to ~0.27 Npl, tension in 3; Mz in 7 cases;
intermediate lateral restraints at third points, quarter points and at the
point loads in 9 cases; LE factor + destabilising switch (UB-40); root
warping restrained (UB-19).

Loads are sized so the governing eigen utilisation mostly lies in 0.6-0.95.
Deliberately heavy cases (tag `heavy`: UB-02 demo unrestrained, UB-22 curve d)
exercise the FAIL path.

## Results of the current run (2026-09-19, Node v24.14.1)

Verdicts: PASS 160 | FAIL 38 | NOT VERIFIED 4 | ERROR 0. Cross-check
mismatches: 0 runs. Trigger mismatches: 1 case (PFC-17, see below).

### Per section family

| Family | Cases | Runs | PASS | FAIL | NOT VERIFIED | ERROR |
|---|---|---|---|---|---|---|
| UB | 49 | 90 | 72 | 18 | 0 | 0 |
| UC | 14 | 26 | 21 | 5 | 0 | 0 |
| PFC | 19 | 34 | 23 | 9 | 2 | 0 |
| SHS | 11 | 18 | 14 | 2 | 2 | 0 |
| RHS | 18 | 34 | 30 | 4 | 0 | 0 |

### Per Mcr method

| Method | Runs | PASS | FAIL | NOT VERIFIED | ERROR |
|---|---|---|---|---|---|
| eigen | 91 | 82 | 7 | 2 | 0 |
| standard | 91 | 60 | 30 | 1 | 0 |
| n/a (restrained) | 20 | 18 | 1 | 1 | 0 |

### Cross-check totals

| Check | Runs | OK | Mismatch |
|---|---|---|---|
| i-Mmax | 115 | 115 | 0 |
| i-dmax | 115 | 115 | 0 |
| ii-equilibrium | 202 | 202 | 0 |
| iii-McrStd | 152 | 152 | 0 |
| iv-McrRatio | 91 | 83 | 8 flagged |
| v-MbRd<=McRd | 182 | 182 | 0 |
| vi-governing | 202 | 202 | 0 |

### Eigen / standard Mcr outliers

Same segment (the engine's own comparison inside the eigen run, 8 of 91):

| Case | Ratio | Standard route | Layout |
|---|---|---|---|
| UB-23 | 1.446 | Serna | 7 m span + 2 m overhang, UDL + tip load |
| UB-27 | 0.830 | Serna | SS, UDL + in-span couple + point load |
| UB-40 | 1.657 | uniform | SS UDL with LE factor 1.2 + destabilising (closed form uses LE = 1.2 x 1.2 x 8 = 11.52 m, the eigensolver solves the 8 m member) |
| UC-12 | 1.321 | Serna | fixed-fixed, central point load |
| PFC-09 | 1.996 | channel | 3.5 m cantilever, UDL |
| SHS-06 | 1.397 | box | 4 m cantilever, tip load + UDL |
| RHS-07 | 1.690 | box | 3 m cantilever, UDL + tip load |
| MIX-06 | 1.724 | Serna | fixed - hinge - pinned, UDL |

Across the two runs (design Mcr of the eigen run / design Mcr of the standard
run): 37 of 91. The standard run always treats the member as one segment with
LE = k x L, so every multi-span beam and every beam with intermediate
restraints lands here (UB-06/08/13/14/15/17/24/39/41, UC-07/08, PFC-10/18,
SHS-05, RHS-08/09/14, MIX-02/04 ...) together with the channel cases, where
the standard route's P362 simplified slenderness governs rather than the
closed-form Mcr. These drive the 30 standard-method FAILs: the closed form is
the conservative whole-member answer and is expected to fail where the eigen
span-by-span check passes.

### Known gaps surfaced

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
