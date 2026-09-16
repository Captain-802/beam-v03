# Beam Designer v03 — structural calculation audit

Audit date: 16 September 2026. Source reviewed: `Captain-802/beam-v03`, starting commit `6c9fcfcadb9464db6c8bf2e0ab2df4a305be487d`.

The Google Sites page embeds `https://captain-802.github.io/beam-v03/`. This audit therefore addresses that repository, including the modular application and `dist/beam-design-single.html`.

## Result

Confirmed defects were found in the original verdict logic, load handling, classification, member interaction and serviceability checks. The branch corrects implemented calculations and prevents PASS where a required combined-action check is missing. It does **not** implement every missing design procedure or certify the calculator for unrestricted structural design.

The adopted basis remains the first-generation EN 1993-1-1 with UK National Annex, and the separate BS 5950-1:2000 option. This is not a conversion to second-generation Eurocodes.

## Findings and corrections

| Finding | Consequence in the original application | Correction |
|---|---|---|
| BS high-shear resistance calculated but bypassed | `Mcx` was reduced for shear, while the verdict used an unreduced `Mrx` | Limit `Mrx` by the applicable shear-reduced `Mcx`; block unimplemented high-shear/axial interaction |
| BS minor-axis moment ignored | Entering a very large `Mz` could leave PASS unchanged | Any nonzero BS minor-axis moment explicitly blocks PASS until the biaxial procedure is implemented |
| No independent BS axial section utilisation | Axial section adequacy depended on indirect bending checks | Add an explicit tensile/compressive section utilisation, retaining member buckling checks |
| Code switch retained EC default ULS factors | Selecting BS retained 1.35G + 1.5Q | Untouched default combination changes to 1.4G + 1.6Q for BS; returning to EC restores its default. Custom combinations are preserved |
| Incomplete moment-diagram combination sweep | The largest peak moment need not govern an equivalent-moment buckling check | BS m-factors and EC member interactions now evaluate every enabled ULS diagram. EC unrestrained interaction uses the minimum computed resistance as a conservative bound |
| Arbitrary diagram treated as linear from one midpoint | Reversing or partial loading could receive an unjustified beneficial EC `Cm` | Test the whole sampled diagram for linearity; use `Cm = 1` for arbitrary/mixed loading outside recognised cases. Read end moments inside the member |
| Finite numbers from an internal-hinge mechanism | Counting restraints did not prove stability; floating-point elimination could return finite displacements | Check the rank of the piecewise-rigid displacement constraints; use scaled Cholesky for the restrained stiffness systems |
| Full member length used for multi-span deflection limit | Two 4 m spans were checked against 8 m/divisor | Check each support interval and end overhang against its own length/divisor; select the governing SLS combination by utilisation |
| EC cold-formed SHS used a BS flat-width ratio | Local buckling slenderness could be understated | EC uses `(h − 3t)/t`; BS retains its separate stored ratio |
| Major-axis classification reused without a biaxial web check | A web/wall in compression from minor-axis bending could retain pure major-axis bending limits | Use a documented conservative uniform-compression web bound for biaxial design; block gross-area compression buckling for a Class 4 compression web |
| EC channel compression missing buckling modes | An advisory allowed PASS without torsional/torsional-flexural compression buckling | Missing clause 6.3.1.4 checks now block PASS |
| EC combined high-shear checks only screened at peak moment | High shear elsewhere could escape the axial or unsupported-family interaction screen | Screen all ULS stations; block missing clause 6.2.10, minor-axis/high-shear, and non-I/Class 1–2 span-wise checks |
| Torsion checked separately from direct axial/minor bending | Separate passing checks do not establish the combined resistance | Direct axial force or imposed minor-axis moment combined with active torsion now blocks PASS pending a unified check |
| SHS torsional table aliases borrowed thicker walls | For example, 40×40×3.0 used the 3.2 mm P385 constants | Remove 3.0/3.5/6.0 mm aliases at lookup; use actual hot-finished geometry when no exact entry is available. Do not use the hot-finished table for CF SHS |
| Hollow-section LTB curve always set to d | Some hollow-section capacities were unnecessarily reduced | Apply the UK NA aspect-ratio allocation, including the separate cold-formed case |
| Warping torsion ignored an entered E | Bending and warping calculations could use different elastic moduli | Use the same entered E in warping stiffness and stresses |
| Invalid or omitted actions accepted silently | Blank input became zero, invalid length reverted to an old value, or active W/E loads were omitted from every ULS combination | Preserve invalid required entries for validation; reject invalid areas/overrides and active load cases absent from all ULS combinations |
| Signed self-weight factor treated inconsistently | A negative G factor applied to user dead loads but omitted automatic self-weight | Apply the signed factor consistently in bending and LTB load construction |
| Report concealed the distinction between failure and incomplete verification | Unsupported cases were simply labelled FAIL; the banner always named the peak-moment combination | Show NOT VERIFIED where checks are missing and no calculated limit is exceeded; identify the governing combination when known |

Some corrections deliberately restrict the calculator's accepted scope. They are not substitutes for the missing structural checks. The uniform-compression classification and minimum-resistance interaction bound are conservative choices, identified as such in the code/report.

## Numerical evidence

The automated suite separates calculation-unit fixtures from complete beam analyses.

- **BS high-shear check fixture:** S275 UB 457×191×82, `M = 420 kNm`, `V = 0.95 Pv`. The original engine calculated `Mcx = 386.594 kNm` but used `Mrx = 503.250 kNm`, permitting PASS in that check fixture. The corrected `Mrx = 386.594 kNm` gives utilisation **1.0864, FAIL**. This fixture isolates resistance/verdict logic; it is not a prescribed physical loading arrangement.
- **Ignored BS minor moment:** a lightly loaded 1 m member with `Mz = 10,000 kNm` previously passed because the action was unused. It is now NOT VERIFIED on the BS path.
- **Two equal spans:** an 8 m continuous member with supports at 0, 4 and 8 m now uses **4000/360 = 11.111 mm**, rather than 8000/360 = 22.222 mm.
- **Hinge mechanism:** fixed support at 0 m, a pin at 1 m and an internal hinge at 2 m on a 3 m member leaves the final segment free to rotate. This now produces an instability error. A stable fixed–hinge–pin Gerber example remains valid, with zero moment at its hinge and correct equilibrium.
- **Elastic buckling benchmark:** `E = 210000 N/mm²`, `G = 81000 N/mm²`, `Iz = 18.7×10⁶ mm⁴`, `It = 692000 mm⁴`, `Iw = 0.922×10¹² mm⁶`, `L = 6000 mm`, fork supports, uniform moment. The eigenvalue result is **Mcr = 342.775 kNm**, agreeing with the closed-form solution within the test tolerance of 0.001%.
- **Original EC demo preserved:** shear utilisation 0.303499, bending 0.912166, deflection 0.609935; PASS for the implemented checks.

## Validation and reproduction

Run from the repository root with Node.js 22 or newer:

```text
node --test tests/*.test.cjs
```

**31 tests passed** at completion: 30 structural/behaviour regressions and one distribution-parity check. The suite includes simply supported UDL, cantilever tip load, fixed-fixed UDL, triangular load, applied couple, stable/unstable hinges, equilibrium, displacement, elastic Mcr, load-combination selection, classification, data identities, invalid inputs and the identified verdict gaps.

The section-data test checks mass/area, major elastic modulus and both radii of gyration for the PFC/UB/UC/RHS tables. These consistency identities are **not** an independent transcription check of every property or torsional constant.

Build the single-file application in PowerShell:

```text
./build-single-html.ps1
node --test tests/*.test.cjs
```

The distribution test requires exact source/CSS parity after newline normalisation. The build uses a literal replacement callback so JavaScript dollar sequences cannot be interpreted as regular-expression substitutions. GitHub Actions repeats the tests and verifies a reproducible build.

Browser checks covered the modular and standalone applications, the default EC report, the switch to BS factors, an unrestrained EC report and rejection of zero length. The default standalone report reproduced the modular numerical results.

## Design scope that remains

- PASS concerns only implemented member checks and the combinations explicitly enabled by the user. The application does not generate a complete project-specific action envelope, including pattern loading, uplift, leading-variable alternatives or accidental cases.
- Support bearing, web patch loading, connections, welds, global frame stability, fire, fatigue, vibration, lateral deflection and project-specific serviceability criteria require separate consideration. A welded plate remains a geometry/self-weight feature, not a designed composite section or weld connection.
- The bending solver is linear Euler–Bernoulli with constant EI and ideal supports. It does not include shear deformation, support settlement or general geometric/material nonlinearity. Peaks are sampled on the analysis grids.
- The entered effective lengths and lateral/torsional restraints must represent the actual structure. The LTB solver assumes the stated ideal fork/clamp conditions and retained lateral/warping continuity at in-plane hinges.
- Existing torsion coverage is limited to its implemented section/support/loading arrangements. Second-order growth of load eccentricity and general nonlinear torsion are not solved. CF torsion and the newly identified combined-action gaps remain blocked.
- Class 4 effective-section design and web shear-buckling resistance remain unimplemented and blocked where identified. Biaxial classification and member-interaction bounds may be conservative.
- The audit does not exhaustively validate every section, every restraint arrangement, every code provision or the legacy helper functions superseded by the active eigenvalue patch. A project-specific independent engineering check remains necessary.

## Reference basis

- [SCI P362, Steel Building Design: Concise Eurocodes](https://www.steelconstruction.info/images/6/6a/SCI_P362.pdf): classification/member resistance, UK NA LTB curve allocation in Table 6.6, and span-based serviceability guidance in Table 7.1.
- [SCI P363, Steel Building Design: Design Data](https://www.steelconstruction.info/images/b/b7/SCI_P363.pdf): hollow-section local-buckling dimensions and section-property reference.
- [SCI P385, Design of Steel Beams in Torsion](https://www.steelconstruction.info/images/6/6f/Sci_p385.pdf): covered torsion procedures and Appendix A section constants; Table A.7 identifies actual wall thicknesses.
- [SCI P351, The Bare Steel Design of Multi-storey Frames](https://www.steelconstruction.info/images/a/a5/SCI_P351.pdf): BS 5950 worked examples using 1.4G + 1.6Q.
- [SCI member-design guidance](https://steelconstruction.info/topics/design/member-design): scope of cross-section resistance, buckling and combined-action verification.

The normative clause references in the implementation remain subject to the selected standard edition and National Annex. This audit records engineering/software corrections, not professional certification or approval of a specific structure.
