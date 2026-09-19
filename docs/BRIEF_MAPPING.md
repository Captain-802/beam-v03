# BRIEF_MAPPING: MasterSeries-format design brief for the beam-v03 EC3 path

Date: 2026-09-19. Branch `ms-brief-standard-mcr`. Specification only; no source file is changed by this document.

This is the line-by-line contract for a new renderer, `renderBriefMS(a, c)`, that prints the EN 1993-1-1 (UK NA) results of beam-v03 in the order, wording and layout of a MasterSeries 2025 "MasterSteel Beam Design to EN 1993-1-1" printout. It maps every printed value to the field that already exists in beam-v03's result objects, or says exactly what the renderer must derive, or says why the value cannot be printed.

Sources imitated: `docs/MASTERSERIES_STEEL_BEAM_LOGIC.md` sections 5 and 9, the printouts in `docs/masterseries-evidence/*.png`, and the printed-order summary in `docs/EC3_BEAM_TRIGGER_LIST.md` section 4. Fields were confirmed by loading the modular source through `tests/harness.cjs` and dumping `analyse()` and `checks()` for a restrained beam, an unrestrained beam, an axial + M<sub>z</sub> beam, a two-span beam with an intermediate restraint, a cantilever, an eccentric-load (P385) beam, an RHS and a tension case.

---

## 0. How to read this document

### 0.1 Source notation

| Prefix | Object | Produced by |
|---|---|---|
| `S.` | app state | `js/03-state-ui.js` (`S`), filled by `js/07-wiring.js` |
| `a.` | analysis result | `analyse()` in `js/04-checks.js` |
| `sec.` | `a.sec`, the normalised active section | `activeSection()` in `js/02-section-data.js`; `sec.tp` = SCI P385 Appendix A record or `null` |
| `c.` | check result | `checks(a)` in `js/04-checks.js`, which returns `checksEC3Restrained(a)` when `S.restraint === 'full'` and `checksEC3UnrestrainedSCI(a)` otherwise |
| `LT.` | `c.ltb` | FE eigensolver version from `js/08-mcr-eigen-patch.js` (it reassigns `window.checksEC3UnrestrainedSCI`, so today the closed-form object in `js/checks/eurocode-checks.js` is never produced); closed-form field names are given for the standard option that will be added |
| `AX.` | `c.ax` | cross-section axial + bending block of `checksEC3Restrained` (`null` when `S.axial = 0` and `S.Mz = 0`) |
| `B.` | `c.buck` | `annexB2(...)` (`null` unless `c.ax` exists and `N_Ed` is not tensile) |
| `T.` | `c.tor` | torsion block (`null` unless `S.eccOn` and some load has `e != 0`) |
| `AN.` | `c.annex` | EN 1993-6 Annex A LTB + torsion interaction (unrestrained path only) |

Units inside the objects are the app's own: `a.L`, `c.LE`, `B.LcrY`, `LT.vPoints` etc. in **mm**; `a.Vmax`, `c.VcRd` in **kN**; `a.Mmax`, `c.McRd`, `LT.Mcr` in **kN.m**; `a.dmax`, `c.dmax`, `c.dlimit` in **mm**; `c.Av`, `c.Wy`, `c.Zx`, `c.Sx` in **mm<sup>2</sup>/mm<sup>3</sup>**; `sec.A` cm<sup>2</sup>, `sec.Sx`, `sec.Zx`, `sec.Sy`, `sec.Zy` cm<sup>3</sup>, `sec.Ix`, `sec.Iy`, `sec.J` cm<sup>4</sup>, `sec.Iw` dm<sup>6</sup>; `LT.Iz`, `LT.It` mm<sup>4</sup>, `LT.Iw` mm<sup>6</sup>; `a.reactions[].V` in **N**, `.M` in **N.mm**; `a.ulsResults[i].fb.V` in N, `.fb.M` in N.mm, `.fb.xs` in mm. Axis naming: beam-v03 keeps the BS 5950 letters in the section tables, so `sec.Ix`, `sec.Zx`, `sec.Sx`, `sec.rx` are the **major** axis (EC3 y-y) and `sec.Iy`, `sec.Zy`, `sec.Sy`, `sec.ry` are the **minor** axis (EC3 z-z).

### 0.2 Source-column vocabulary

* `field` : print the field as is (with the unit conversion stated).
* `DERIVE: <formula>` : the renderer computes it from existing fields. Derivations are formatting-grade only (ratios, unit changes, re-evaluating a value the check already used); none of them changes a verdict.
* `NOT AVAILABLE (reason)` : the value does not exist in beam-v03; print an em dash or omit the line as stated.

### 0.3 House rules that shape the brief

Every row prints label, symbolic formula, substituted values, result with unit and a right-hand tag (OK / Warning / Low Shear / Curve x / clause). A check that enters beam-v03's verdict (`c.utils`) must appear in the brief even when MasterSeries prints no such line; these additions are marked **[beam-v03 addition]**. No clause number or coefficient is printed that is not already in the check code or in EN 1993-1-1 / UK NA / the NCCI cited by that code. The renderer is a pure function of `(a, c, S)` returning an HTML string, so `tests/harness.cjs` can exercise it without a DOM.

---

## 1. What the evidence shows (and three details that matter for fidelity)

The eleven PNGs give five complete or near-complete briefs: Beam & Beam-Portion (UB 133, `manual2070_beam_portion_UB133.png`, with title, loading, forces table, four check blocks), Beam-Portion with torsion (UB 89, `manual2070_EC3_beam_portion_LTB_UB89.png` and `manual2070_torsion_constants_UB89.png`, with the Beam-Portion unity bar), Axial with Moments (UB 161 top and bottom; UB 52 `T01-1_p17`; UC `T01-3_p58` with the interaction lines, Fully Restrained LTB line, and the full unity bar), and Appendix-BB (UB 182, not in scope for beam-v03, but it shows the "Mcr0 / Mcr = C1.Mcr0 / χLT = Fn(λLT, φLT, β)" wording used below for the closed-form line).

Three details that a naive mapping would get wrong:

1. **`Vy.Ed` in "Local Capacity Check" is the shear coincident with the maximum moment, not the maximum shear.** Evidence: UB 89 prints `0.005 / 1021.758 = 0` for a simply supported UDL beam whose end shear is 137.84 kN (moment is maximum at mid-span, where V = 0); UB 52 prints `30.005 / 579.02` = exactly half of the 1.5 × 40 kN mid-span point load, again at the point of maximum moment; UB 40 prints `20.751` at x = 2.1 m although the reactions are 151/165 kN. This is beam-v03's `c.VatM`, the value the cl 6.2.8 low-shear test is made with. The maximum shear only appears in the member-forces table. beam-v03 also verifies `c.Fv / c.VcRd` in the verdict, so one **[beam-v03 addition]** line is needed (section 5.3).
2. **The "Local" cell of the Axial-with-Moments unity bar is the biaxial interaction value**, not `My.Ed/Mc.y.Rd`: UB 52 prints Local = 1.122 = (319.239/301.4)<sup>2</sup>; UB 161 prints 0.111 while My.Ed/Mc.y.Rd would be 0.332. Map it to `AX.mUtil`.
3. **"UMyz" is `My.Ed / Mb.Rd` with the LTB-reduced resistance, and "UNyz" uses the larger end axial force.** UB 161: UNyz = 0.201 = 191.42/953.54 (End 2 force), UMyz = 0.667 = 432.70/648.6, so the UB 161 example was *not* fully restrained for LTB (the bottom crop simply ends before the LTB block); Ax+M_6.62 = 0.820 = 0.201 + 0.928 × 0.667. The implied k<sub>zy</sub> = 0.928 equals 1 − 0.1 λ̄<sub>z</sub> n<sub>z</sub>/(C<sub>mLT</sub> − 0.25) with λ̄<sub>z</sub> = 2.552 *uncapped*; Table B.2 caps this from below at 1 − 0.1 n<sub>z</sub>/(C<sub>mLT</sub> − 0.25) = 0.971, which is what beam-v03's `annexB2` (`lz = min(lamZ, 1)`) produces. Expect beam-v03 to print a slightly higher k<sub>zy</sub> than MasterSeries on very slender minor axes; this is a code-conformant difference, not a bug to hide.

Also visible: "Curve a/b/c" tags on the N<sub>b</sub> and χ<sub>LT</sub> lines, "Low Shear" on the shear ratio, "Table B.3" on C<sub>m</sub> lines, "6.3.2.3" on χ<sub>LT,mod</sub>, "(Axial: Non-Slender)" as an inline tag before "Class 1", red **Warning** for any ratio > 1, a light-blue panel background on a failing brief (UB 52) and white on passing briefs, three-line centred blue title, and the moment sketch beside the load list.

---

## 2. Renderer architecture and variant selection

### 2.1 Proposed pieces (not yet written)

| Item | Proposal |
|---|---|
| File | `js/06b-brief-ms.js`, concatenated by `build-single-html.ps1` after `06-render.js` and before `07-wiring.js`; added to the `files` list in `tests/harness.cjs` |
| Entry point | `function renderBriefMS(a, c){ ... return html; }` pure, no DOM; `render()` in `06-render.js` inserts it when `S.briefFormat === 'ms'` |
| New state | `S.briefFormat` = `'detailed'` (default, today's report) or `'ms'`; `S.mcrMethod` = `'fe'` (default, eigensolver) or `'sn003a'` (standard closed form); optional `S.memberName` (free text, default empty) for the title line |
| Method detection at render time | `LT.eigen === true` : FE variant; `LT.eigen` undefined and `LT.lamLTsimp !== undefined` : closed-form variant (the object returned by the original `checksEC3UnrestrainedSCI` in `js/checks/eurocode-checks.js`); `LT.cant`, `LT.channel`, `LT.na`/`LT.box` select the sub-variants |
| Formatting helpers | reuse `f1(v, d)` (fixed decimals) and `g(v, d)` (trimmed) from `06-render.js`; add the wrappers in section 3 |

The "standard version" option must produce the closed-form `ltb` object described in section 5.6 D; the mapping below names its fields (`LT.lamLTmcr`, `LT.chiM`, `LT.fM`, `LT.chiModM`, `LT.MbMcr`, `LT.T1`, `LT.IwIz`, `LT.GIt`, `LT.zgUsed`, `LT.C2`, `c.C1`, `c.c1label`, `c.LE`) exactly as that function already returns them today, so no renaming is needed when the reassignment in `08-mcr-eigen-patch.js` is made conditional on `S.mcrMethod`.

### 2.2 Which brief to print

| Condition (all from `S`/`c`) | Brief title | Blocks printed |
|---|---|---|
| `c.ax === null` (`S.axial = 0` and `S.Mz = 0`) | **Beam & Beam-Portion (Member)** | Title; Member Loading and Member Forces; Classification and Effective Area; **Moment Capacity Check M.c.y.Rd** (+ " - Fully Restrained Beam" when `S.restraint === 'full'`); Equivalent Uniform Moment Factor C1 (unrestrained only); Lateral Buckling Check M.b.Rd; Torsion Design (if `c.tor`); Deflection Check; Beam-Portion unity bar |
| `c.ax !== null` | **Axial with Moments (Member)** | Title; Member Loading and Member Forces; Classification and Effective Area; **Local Capacity Check** (full form); Compression Resistance N.b.Rd (if `B` and `B.Fc > 0`); Equivalent Uniform Moment Factors C1, C.mLT, C.mz, and C.my; Lateral Buckling Check M.b.Rd; Buckling Resistance (if `B` and (`B.Fc > 0` or `B.biax`)); Torsion Design (if `c.tor`); Deflection Check; Axial-with-Moments unity bar |
| `S.restraint === 'full'` (either brief) | as above | Lateral Buckling block collapses to the single line `Mb.Rd = Mc.y.Rd  Fully Restrained` (section 5.6 A); no C1 line |
| `AX.tension === true` | Axial with Moments | Compression Resistance and Buckling Resistance blocks are omitted (`B === null`); `Npl.Rd` line is followed by `Nt.Rd` (section 5.3) |

MasterSeries' "AutoChange Beam Check to C&M" is not reproduced: beam-v03 decides by the presence of axial force or M<sub>z</sub> in the inputs.

---

## 3. Numeric formats

MasterSeries prints 3 decimals on ratios and on kN.m, 2 on mm and on classification ratios, integers on f<sub>y</sub> and E, and trims lengths ("7.5 m", "9"). Its kN and cm<sup>3</sup> columns are not perfectly consistent (1509.13, 1021.758, 579.02, 1832.6), so beam-v03 adopts one rule per quantity:

| Quantity | Format | Helper | Example |
|---|---|---|---|
| Utilisation / ratio / χ / k factors / n | 3 dp fixed | `fmtR = v => f1(v,3)` | 0.906 |
| Moment kN.m | 3 dp fixed | `fmtKNm = v => f1(v,3)` | 285.104 |
| Force kN | 3 dp fixed | `fmtKN = v => f1(v,3)` | 1021.758 |
| Deflection mm | 2 dp fixed | `fmtMM = v => f1(v,2)` | 15.57 |
| Length m (results) | trimmed to 3 dp | `g(v,3)` | 7.5 |
| Length m (in substituted values of Mcr line) | 3 dp fixed | `f1(v,3)` | 7.500 |
| Area cm<sup>2</sup>, modulus cm<sup>3</sup> | 1 dp fixed | `f1(v,1)` | 2013.6 |
| I<sub>z</sub>, I<sub>t</sub> cm<sup>4</sup> | trimmed to 2 dp | `g(v,2)` | 90.71 |
| I<sub>w</sub> dm<sup>6</sup> | trimmed to 4 dp | `g(v,4)` | 1.035 |
| f<sub>y</sub>, E N/mm<sup>2</sup> | integer | `g(v,0)` | 345 |
| b/T, d/t, h/b | 2 dp fixed | `f1(v,2)` | 38.82 |
| λ̄ (any), C<sub>1</sub>, k<sub>c</sub>, f, Φ | 3 dp fixed | `f1(v,3)` | 1.450 |
| ψ, μ, α<sub>h</sub>, α<sub>s</sub> | 3 dp fixed; μ capped at 300 | `f1(v,3)` | 300.000 |
| α, β exponents | trimmed to 2 dp | `g(v,2)` | 2, 1 |
| Percent (mesh error) | 3 dp fixed | `f1(v*100,3)` % | 0.000 % |
| Angle | 2 dp fixed + "°" | `f1(v,2)` | 4.42° |

Negative zero and |v| < 5e-7 print as 0 (already handled by `f1`/`g`). Signs: forces and moments in the member-forces table keep their sign (hogging negative, as MasterSeries prints −1199.23); check lines print magnitudes.

---

## 4. Visual style

| Element | Specification |
|---|---|
| Panel | `div.ms-brief`, white background, 1 px grey border, Arial/Helvetica 13 px, black text. When `c.pass === false` the panel background is light blue `#dbe6f5` (MasterSeries fail colour). Print CSS: `break-inside: avoid` on every row, `break-after: avoid` on headings |
| Title | three centred lines, bold, dark blue `#1a237e`, 15 px: brief type; member line; extent + load case line |
| Block headings | bold, dark blue `#1a237e`, 16 px, left-aligned, e.g. `Classification and Effective Area (EN 1993: 2006)` |
| Rows | CSS grid, four columns `minmax(190px,32%) 1fr minmax(120px,16%) minmax(90px,12%)`; column 1 label (symbolic formula, `<sub>`/`<sup>` only), column 2 substituted values, column 3 result with unit right-aligned, column 4 tag. No inline event handlers, no external assets |
| Tags | plain black for OK / Low Shear / Curve x / clause / Table B.3; **Warning** in red `#c00000` bold; "High Shear" plain; "BLOCKED" red bold for a `NOT COVERED` state |
| Inline tag before a result | the Classification line prints `(Axial: Non-Slender)` in column 2 right-aligned, then `Class n` in column 4 |
| Loading sketch | reuse `beamDiagram(a)` from `05-diagrams.js` (loads and supports) beside the load list, and the moment diagram `plot(a.diag.xs, a.diag.M, {flip:true})` under it, both inline SVG |
| Member forces table | bordered `table.ms-forces`, centred heading row, two header rows (group / axis), one body row per end (End 1 = x of the first support or 0, End 2 = last support or L) |
| Unity bar | bordered box below the last block; first row column names in 11 px, second row values in 13 px; any value > 1.0001 in red bold; **Max** at the far right; `Max` excludes Deflection |
| Verdict footer | **[beam-v03 addition]** one line "PASS / FAIL / NOT VERIFIED" from `c.pass` and `c.unsupported`, followed by each `c.unsupported[]` entry prefixed "NOT COVERED:" in red and each `c.advisory[]` entry prefixed "ADVISORY:" in black. MasterSeries has no equivalent; the house rule requires it |

---

## 5. Block-by-block specification

Row notation in the tables below: **Label** | **Formula (HTML)** | **Substituted values** | **Result** | **Tag** | **Source**. Where the formula column is the same as the label it is written once.

### 5.0 Title

| Line | Text | Source |
|---|---|---|
| 1 | `Beam & Beam-Portion (Member)` or `Axial with Moments (Member)` | section 2.2 |
| 2 | `Member <name>` | `S.memberName` if non-empty, else DERIVE: `<sname(sec.key)> <famLabel> [<S.grade>]`, e.g. "457 x 191 x 89 UB [S355]" (`sname`, `famLabel` as built in `render()`) |
| 3 | `Between <xa> and <xb> m, in Load Case <n>` | `xa`, `xb` = governing portion from section 7 (single span: 0 and `S.L`); `n` = DERIVE: 1-based index of `a.governM.combo` in the enabled ULS list, followed by the label in brackets, e.g. `Load Case 1 (ULS: 1.35G + 1.5Q (Eq 6.10))` |

Member identity (MasterSeries "SB A\2-3L1 Id 26 @ Level 1") is NOT AVAILABLE unless `S.memberName` is added; the section string is the fallback.

### 5.1 Member Loading and Member Forces

Heading `Member Loading and Member Forces`.

| Line | Values | Source |
|---|---|---|
| `Loading Combination : <label>` | `a.governM.combo.label`; when `a.ulsResults.length > 1` append " (governing moment; n ULS cases enabled)" | `a.governM.combo.label`, `a.ulsResults.length` |
| Load list, one line per load, MasterSeries style `D1 UDLY -004.314 ( kN/m )` | beam-v03 form: `<case> <type> <value> <extent> ( unit )`. Case letter from `CASE_LABELS[ld.case]` (G, Q, W, E); types `UDL`, `TRAP w1→w2`, `PY P @ x`, `M @ x`; extent `x1–x2 m` or `@ x m`; append ` e = <ld.e> mm` and ` zg = <loadZgValue(ld)> mm` when `S.eccOn` | `S.loads[]` (`ld.type, ld.w, ld.w1, ld.w2, ld.P, ld.M, ld.pos, ld.x1, ld.x2, ld.case, ld.e, ld.zg`) |
| Self-weight line `G  SW  <w> kN/m  0–L ( automatic )` | `selfWeightValue(sec)`; `selfWeightEccentricity(sec)` when `S.eccOn` | `js/02-section-data.js` |
| Sketch | `beamDiagram(a)` + `plot(a.diag.xs, a.diag.M, ...)` | `a.diag` |

**Member forces table** heading: `Member Forces in Load Case <n> and Maximum Deflection from Load Case <m>` with `m` = DERIVE index/label of `a.governD.combo`.

| Column | End 1 | End 2 | Source |
|---|---|---|---|
| Mem ber No. | 1 | | NOT AVAILABLE (single member); print `1` |
| Node End1 / End2 | `x = 0` | `x = L` | DERIVE: positions `0` and `S.L` m (no node numbers exist); for the governing portion print `xa`, `xb` |
| Axial Force (kN) | `N` with suffix `C` (compression, `S.axial > 0`) or `T` (tension) | same | `S.axial` (constant along the member; sign convention: positive = compression, as `render()` prints `c.F >= 0 ? 'C' : 'T'`) |
| Torque Moment (kN.m) | `T` at x = 0 | at x = L | `T.p385 ? T.TtEnds[0] : 0`, `T.TtEnds[1]`; boxes: DERIVE `interpAt(a.tors.diag.xs, a.tors.diag.T, 0)` and at `S.L`; `0.00` when `a.tors` is null |
| Shear Force y-y (kN) | DERIVE `interpAt(fb.xs, fb.V, 1e-4)/1000` | DERIVE `interpAt(fb.xs, fb.V, a.L−1e-4)/1000` | `fb = a.governM.fb` (governing combination's own diagram, not the envelope) |
| Shear Force z-z (kN) | 0.00 | 0.00 | NOT AVAILABLE (single-plane solver; M<sub>z</sub> is an applied constant moment with no shear) |
| Bending Moment y-y (kN.m) | `a.M0end` | `a.MLend` | signed, hogging negative |
| Bending Moment z-z (kN.m) | `S.Mz` | `S.Mz` | constant applied value |
| Maximum Moment y-y (kN.m @ m) | `a.Mmax @ a.Mpos` | | signed |
| Maximum Moment z-z | `S.Mz @ —` | | position NOT AVAILABLE (uniform) |
| Maximum Deflection (mm @ m) | `a.deflection.dmax @ a.deflection.dpos/1000` | | governing span segment of the governing SLS case (`a.governD`); beam-v03 stores nodal deflection, which equals the in-span value between supports because support nodes have w = 0; for a cantilever it is the tip deflection |

**[beam-v03 addition, 19 Sep 2026]** the load list ends with the automatic pattern-loading lines (`a.patterns`: segments, generated ULS/SLS cases numbered by the expanded lists, the gamma_G,inf limitation), and the reactions line is followed by the uplift rows (`c.holdDown.rows`: "Hold-down required" as a NOT VERIFIED row, "Hold-down provided" as an advisory row with the design force, or "Uplift ... OK"). Case numbers (`msbCaseIndex(combo, sls, a)`) index the analysed lists `a.ulsResults` / `a.slsResults`, so a generated pattern is "Load Case 3 (ULS: 1.35G + 1.5Q (Q on span 2 only))".

**[beam-v03 addition]** a reactions line under the table: `R @ x m = V kN (, M kN.m)` from `a.reactions[]` (`V/1000`, `−M/1e6`), and a one-row-per-combination summary (`a.ulsResults[i].combo.label`, `Vmax/1000`, `Mmax/1e6 @ Mpos/1000`; `a.slsResults[i].combo.label`, `dmax`) when more than one combination is enabled, because MasterSeries' "Auto Design Load Cases" list has no beam-v03 equivalent other than this.

### 5.2 Classification and Effective Area (EN 1993: 2006)

| Label | Substituted values | Result | Tag | Source |
|---|---|---|---|---|
| `Section (<mass> kg/m)` | `<sname(sec.key)> <famLabel> [<S.grade>]`; boxes add ` D=<D> B=<B> t=<tf>` | | | `sec.mass` (1 dp), `sec.key`, `S.family`, `S.grade`, `sec.D`, `sec.B`, `sec.tf` |
| `Class = Fn(b/T, d/t, f<sub>y</sub>, N, M<sub>y</sub>, M<sub>z</sub>)` | `<c/t>, <d/t>, <fy>, <N>, <My>, <Mz>` | `(Axial: Non-Slender)` in column 2 right, then `Class n` | `Class n` | `sec.bT` (2 dp; this is EN 1993-1-1 Table 5.2 **c/t<sub>f</sub>** = (B − t<sub>w</sub> − 2r)/2/t<sub>f</sub>, e.g. 4.55 for UB 89, whereas MasterSeries prints the BS 5950 (B/2)/T = 5.42; to print the MasterSeries figure use DERIVE `sec.B/2/sec.tf`; recommended: print c/t and label the column header "c/t"), `sec.dt` (2 dp), `c.fy`, `Math.abs(S.axial)` (kN, 2 dp), `c.Mx` (2 dp), `Math.abs(S.Mz)` (2 dp), `c.clsName`. Axial tag DERIVE: `(S.axial > 0 && sec.dt > 42*c.eps) ? '(Axial: Slender web)' : '(Axial: Non-Slender)'`, the condition `checksEC3Restrained` uses to block a Class 4 web in compression |
| `Web classified for` **[beam-v03 addition, only when `c.cl.webCase !== 'bending'`]** | `bending + compression: α = <alphaW>, ψ = <psiW>; limits <wlim[0]>ε / <wlim[1]>ε / <wlim[2]>ε` or `biaxial: uniform-compression web bound` | `Class <c.cl.wc>` | `Table 5.2` | `c.cl.webCase`, `c.cl.alphaW`, `c.cl.psiW`, `c.cl.wlim`, `c.cl.fc`, `c.cl.wc` |
| `Auto Design Load Cases` | `1-2` style list | | | DERIVE: 1-based indices of `S.combos.filter(cb => cb.on && !cb.sls)` collapsed into ranges; SLS cases listed after a semicolon |

Class 4 (`c.cl.cls >= 4`) is printed as `Class 4` with tag **BLOCKED** and the corresponding `c.unsupported` entry goes to the footer; no effective-area line is printed because none is computed.

### 5.3 Local Capacity Check (Axial with Moments) / Moment Capacity Check M.c.y.Rd (Beam-Portion)

Heading: `Local Capacity Check` when `AX` exists; otherwise `Moment Capacity Check M.c.y.Rd` with the suffix ` - Fully Restrained Beam` when `S.restraint === 'full'`.

Lines common to both briefs:

| Label / formula | Substituted values | Result | Tag | Source |
|---|---|---|---|---|
| `V<sub>y.Ed</sub>/V<sub>pl.y.Rd</sub>` | `<VatM> / <VcRd> =` | ratio | `Low Shear` if `c.lowShearAtM`, else `High Shear` | `c.VatM` (shear coincident with the maximum moment, swept over every enabled ULS combination), `c.VcRd`; ratio DERIVE `c.VatM / c.VcRd` |
| `V<sub>y.Ed,max</sub>/V<sub>pl.y.Rd</sub>` **[beam-v03 addition: pure shear resistance, cl 6.2.6, in the verdict]** | `<Fv> / <VcRd> =` | `c.shearUtil` | OK / Warning | `c.Fv`, `c.VcRd`, `c.shearUtil` |
| `V<sub>pl.y.Rd</sub> = A<sub>v</sub>f<sub>y</sub>/(√3γ<sub>M0</sub>)` **[beam-v03 addition: basis of the resistance, house rule]** | `<Av> mm² x <fy>/(√3 x 1)` (+ `A<sub>v</sub> ≥ ηh<sub>w</sub>t<sub>w</sub> = <avFloor>` when `c.avFloor != null`) | `c.VcRd` kN | `6.2.6` | `c.Av`, `c.AvRaw`, `c.avFloor`, `c.hw`, `c.eta`, `c.fy` |
| `ρ = (2V<sub>y.Ed</sub>/V<sub>pl.y.Rd</sub> − 1)²` (only when `!c.lowShearAtM` and `c.hsNote` reports a reduction) | `(2 x <VatM>/<VcRd> − 1)²` | ρ | `6.2.8(3)` | DERIVE `Math.min(Math.pow(2*c.VatM/VplMoment − 1, 2), 1)` with `VplMoment = T && T.VplTRd != null ? T.VplTRd : c.VcRd` (the same expression `checksEC3Restrained` uses) |
| `M<sub>c.y.Rd</sub> = f<sub>y</sub>.W<sub>pl.y</sub>/γ<sub>M0</sub>` (Class 1/2) or `f<sub>y</sub>.W<sub>el.y</sub>/γ<sub>M0</sub>` (Class 3); label becomes `M<sub>v.y.Rd</sub> = (W<sub>pl.y</sub> − ρA<sub>v</sub>²/4t<sub>w</sub>)f<sub>y</sub>/γ<sub>M0</sub>` when the ρ line printed | `<fy> x <Wy cm³>/1` | `c.McRd` kN.m | (blank) or `6.2.8` | `c.fy`, `c.Wy/1e3` (cm<sup>3</sup>), `c.cl.cls`, `c.McRd` (already the reduced value when high shear applies), `c.hsNote` |
| `M<sub>y.Ed</sub>/M<sub>c.y.Rd</sub>` | `<Mx> / <McRd> =` | `c.momUtil` | OK / Warning | `c.Mx`, `c.McRd`, `c.momUtil`. This is the Beam-Portion "MA/Mc" bar value |
| `M<sub>y.Ed</sub>/M<sub>v.y.Rd</sub> @ x` **[beam-v03 addition, only when `c.coex`]** | `@ x = <coex.x/1000> m: M = <coex.M>, V = <coex.V> > 0.5V<sub>pl.Rd</sub>; M<sub>v.y.Rd</sub> = <coex.MvRd>` (or "V<sub>Ed</sub> > V<sub>pl.Rd</sub>: pure shear governs" when `coex.pureShearFail`) | `c.coex.u` | OK / Warning | `c.coex.{x, M, V, MvRd, VplRd, u, pureShearFail, combo}` (span-wise cl 6.2.8 sweep, rolled I/H Class 1/2 only) |

Additional lines when `AX` exists (Axial with Moments). MasterSeries' Axial-with-Moments block has no `My.Ed/Mc.y.Rd` line (the moment check is carried by the biaxial line printed last); beam-v03 keeps `My.Ed/Mc.y.Rd` directly after `Mc.y.Rd` in this variant too **[beam-v03 addition]**, because `c.momUtil` is a separate verdict entry. The lines below follow it, in MasterSeries order:

| Label / formula | Substituted values | Result | Tag | Source |
|---|---|---|---|---|
| `V<sub>z.Ed</sub>/V<sub>pl.z.Rd</sub>` | `0 / <VplZ> =` | `0` | `Low Shear` | V<sub>z.Ed</sub> NOT AVAILABLE (no minor-axis shear in the model; print 0 with the note "no minor-axis shear in the single-plane model"). V<sub>pl.z.Rd</sub> = `AX.VplZ` with `AX.Avz`, computed by `checksEC3Restrained` per EN 1993-1-1 6.2.6(3): (f) rolled I, H and channel sections, load parallel to the flanges, `Av,z = A − hw tw` (UB 161: 2568.7 kN vs MasterSeries 2541.93); (h) hollow sections `Av,z = A b/(b + h)`. Nothing is recomputed in the brief (Sep 2026 review) |
| `M<sub>c.z.Rd</sub> = f<sub>y</sub>.W<sub>pl.z</sub>/γ<sub>M0</sub>` (or `W<sub>el.z</sub>`) | `<fy> x <Sy or Zy>/1` | kN.m | | `AX.Mcz` (engine value, class-consistent W<sub>z</sub> f<sub>y</sub>/γ<sub>M0</sub>); `B.Mcz` is the value inside Eq 6.61/6.62 and is printed on the U<sub>M.z</sub> line |
| `N<sub>pl.Rd</sub> = A<sub>g</sub>.f<sub>y</sub>/γ<sub>M0</sub>` | `<A cm²> x <fy>/1 = (No bearing / block tearing design)` | `AX.NplRd` kN | | `sec.A`, `c.fy`, `AX.NplRd`; the bracket text is MasterSeries' own and is true of beam-v03 too |
| `N<sub>u.Rd</sub> = 0.9A<sub>net</sub>f<sub>u</sub>/γ<sub>M2</sub>` (only when `AX.tension` and `S.anet != null`) | `0.9 x <anet> x <fu>/1.10` | `AX.NuRd` kN | `γ<sub>M2</sub> = 1.10 (UK NA)` | `S.anet`, `fuFromGrade(S.grade)`, `AX.NuRd`, `AX.NtRd` |
| `n = N<sub>Ed</sub>/N<sub>pl.Rd</sub>` | `<N> / <NplRd> =` (tension: `/ <NtRd>`) | `AX.n` (tension: `AX.nUtil`) | OK / Warning on `AX.nUtil ≤ 1` | `S.axial`, `AX.n`, `AX.nUtil`, `AX.tension`, `AX.NtRd` |
| `W<sub>pl.N.y</sub> = Fn(W<sub>pl.y</sub>, A<sub>vy</sub>, n)` | `<Sx>, <Av cm²>, <n>` | cm<sup>3</sup> | | DERIVE `AX.MN*1e3/c.fy` (reduced plastic modulus back-calculated from `AX.MN`; `A<sub>vy</sub>` printed as `c.Av/100`, which is the parameter MasterSeries prints: UB 52 shows 36.469 cm<sup>2</sup> = the P363 shear area). Class 3 (`AX.cls3`): label `W<sub>el.y</sub>`, value `sec.Zx` |
| `M<sub>N.y.Rd</sub> = W<sub>pl.N.y</sub>.f<sub>y</sub>/γ<sub>M0</sub>` | `<WplN> x <fy>/1` | `AX.MN` kN.m | tag `6.2.9.1(4)` when `AX.mnLbl` contains "small axial" (waiver) | `AX.MN`, `AX.mnLbl` |
| `W<sub>pl.N.z</sub> = Fn(W<sub>pl.z</sub>, A<sub>vz</sub>, n)` (only when `AX.biax`) | `<Sy>, <Avz cm²>, <n>` | cm<sup>3</sup> | | DERIVE `AX.MNz*1e3/c.fy`; `A<sub>vz</sub>` = DERIVE `Av,z/100` from the V<sub>pl.z.Rd</sub> line |
| `M<sub>N.z.Rd</sub> = W<sub>pl.N.z</sub>.f<sub>y</sub>/γ<sub>M0</sub>` (only when `AX.biax`) | `<WplNz> x <fy>/1` | `AX.MNz` kN.m | | `AX.MNz` |
| `(M<sub>y.Ed</sub>/M<sub>N.y.Rd</sub>)<sup>α</sup>+(M<sub>z.Ed</sub>/M<sub>N.z.Rd</sub>)<sup>β</sup>` | `(<Mx>/<MN>)<sup><α></sup>+(<Mz>/<MNz>)<sup><β></sup>=` (print `(0)<sup>1</sup>` when not biaxial, as MasterSeries does) | `AX.mUtil` | OK / Warning | `c.Mx`, `AX.MN`, `AX.alpha`, `AX.beta`, `AX.Mz`, `AX.MNz`, `AX.mUtil`, `AX.biax`. Variants: `AX.cls3` prints `N<sub>Ed</sub>/N<sub>pl.Rd</sub> + M<sub>y.Ed</sub>/M<sub>el.y.Rd</sub> + M<sub>z.Ed</sub>/M<sub>el.z.Rd</sub>` (cl 6.2.9.2) with `AX.n + Mx/AX.MN + Mz/AX.MNz`; `AX.chan` prints the linear form `n + M<sub>y.Ed</sub>/M<sub>c.y.Rd</sub> + M<sub>z.Ed</sub>/M<sub>c.z.Rd</sub>` (cl 6.2.1(7)); boxes print the same power form with `AX.alpha = AX.beta` from 6.2.9.1(6) |

**[beam-v03 addition, 19 Sep 2026 gap closure G3]** Classification block: for an I/H with M<sub>z</sub> the "Web classified for" row states the y-y basis ("M<sub>z</sub> does not stress the web") and a row `Flange outstands under M<sub>y</sub> + M<sub>z</sub> (+N)` prints the root/tip stresses of both outstands from `c.cl.mzStress` (tag Table 5.2 sheet 2). When `c.aeff.active` (Class-4 web in uniform compression, N > 0) a row `A<sub>eff</sub> = A − (1 − ρ)b̄t<sub>w</sub>` prints λ̄<sub>p</sub>, ρ, b<sub>eff</sub> and A<sub>eff</sub> (tag EN 1993-1-5 4.4) and the classification line carries `(Axial: Slender web)`. Local Capacity: rows `N<sub>c.Rd</sub> = A<sub>eff</sub>.f<sub>y</sub>/γ<sub>M0</sub>` and `N<sub>Ed</sub>/N<sub>c.Rd</sub>` follow N<sub>pl.Rd</sub> when A<sub>eff</sub> applies (`AX.NcRd`, `AX.nUtil`); the `M<sub>v.y.Rd</sub> = …` label prints the family form `c.mvForm` with ρ; after the coexistent M-V row a `cl 6.2.10` row (`c.mvn`: `(M<sub>y.Ed</sub>/M<sub>N.V.y.Rd</sub>)<sup>α</sup>+(M<sub>z.Ed</sub>/M<sub>N.V.z.Rd</sub>)<sup>β</sup> @ x`, `M<sub>y.Ed</sub>/M<sub>N.V.y.Rd</sub> @ x` or the linear form) with N<sub>V.Rd</sub>, n<sub>V</sub>, M<sub>v.y.Rd</sub>, M<sub>v.z.Rd</sub>, a<sub>V</sub>, the waiver and M<sub>N.V.Rd</sub> (tag `OK 6.2.10`). Compression Resistance: `A<sub>eff</sub>` row and the λ̄/N<sub>b.Rd</sub> lines written with A<sub>eff</sub>; for a channel the rows `i<sub>0</sub>² = …`, `N<sub>cr.T</sub> = …`, `N<sub>cr.TF</sub> = …`, `λ̄<sub>T</sub> = …`, `N<sub>b.T.Rd</sub> = Area.χ<sub>T</sub>.f<sub>y</sub>/γ<sub>M1</sub>` (tag Curve c) and `N<sub>Ed</sub>/N<sub>b.T.Rd</sub>` from `B.tfb`. Lateral Buckling: the χ<sub>LT.mod</sub> tag adds `k<sub>c</sub> floored at 0.60 (Table 6.6)` when `LT.kcFloored`. Lateral Restraint Portions: printed on every LTB path (heading "(span by span, fork ends)" with the portion table when `LT.segments` exist, "(restraint design forces)" otherwise) with the table `x | Restraint | M<sub>Ed</sub> | Load case | N<sub>f.Ed</sub> = M<sub>Ed</sub>/h | 2.5 % N<sub>f.Ed</sub>` from `c.restraintForces.rows`, every row tagged "restraint design force, advisory". Buckling Resistance: `Table 6.7 Class-4 column` row when `B.aeffOn` (N<sub>Rk</sub> = A<sub>eff</sub>f<sub>y</sub>, W<sub>eff.y</sub> = W<sub>el.y</sub>), U<sub>N.y</sub>/U<sub>N.z</sub> print the minimum with N<sub>b.T.Rd</sub> (`B.NbYeff`, `B.NbZeff`), U<sub>M.y</sub> uses `B.MbRdEff`, and for RHS/SHS Class 1/2 the rows `k<sub>zz</sub> = C<sub>mz</sub>{1+(λ̄<sub>z</sub>−0.2)U<sub>N.z</sub>}` and `k<sub>yz</sub> = k<sub>zz</sub>` carry the tag `Table B.1 (RHS)`. Unity bar: cells `M-V-N` (6.2.10) and `N_b.T` (6.3.1.4) when present in `c.utils`.

### 5.3a Web Transverse Forces (EN 1993-1-5 cl 6) **[beam-v03 addition, 19 Sep 2026 gap closure G2]**

Printed directly after the Local Capacity / Moment Capacity block, before Compression Resistance (MasterSeries prints its web bearing / buckling rows in the local-capacity area). Rendered by `msbWebBlock(a, c, sec, nv.web)`; every number is a field of `c.web` (`webTransverseCheck`, EN 1993-1-5 clause 6 + 7.2), nothing is recomputed.

| Label / formula | Substituted values | Result | Tag | Source |
|---|---|---|---|---|
| `Web h<sub>w</sub>, t<sub>w</sub>, t<sub>f</sub>, b<sub>f</sub>` | `<hw>, <tw>, <tf>, <bf> mm (B [or B/2] = <bfRaw> ≤ t<sub>w</sub> + 30εt<sub>f</sub> [15ε for PFC / box] = <bfLim>); f<sub>yw</sub> = f<sub>yf</sub> = <fy>; n web(s)` | | `Fig 5.1` | `c.web.hw/tw/tf/bf/bfRaw/bfLim/fyw/nWebs/isBox/chan` |
| `m<sub>1</sub> = f<sub>yf</sub>.b<sub>f</sub>/(f<sub>yw</sub>.t<sub>w</sub>) ; m<sub>2</sub> = 0.02(h<sub>w</sub>/t<sub>f</sub>)²` | substituted, `if λ̄<sub>F</sub> > 0.5, else 0` | | `6.5(1)` | `c.web.m1`, `c.web.m2full` |
| `a = distance between transverse stiffeners` | `c.web.aBasis` (full member length when none declared) | | `6.4(1)` | |
| sub-heading `Governing station x = … m: <label>, load type (a/b/c) …` | | | | `c.web.gov2` (worst F<sub>Ed</sub>/F<sub>Rd</sub>) |
| `s<sub>s</sub>, c ; k<sub>F</sub>` | `s<sub>s</sub> = … (entered / default 0 / default B [verify]) [capped at h<sub>w</sub>]; c = … (d = … to the member end) ; k<sub>F</sub> = …` | k<sub>F</sub> | `Fig 6.1(a/b/c)` | station `ss, ssIn, ssDefault, ssCap, c, d, a`, `gov.kF` |
| `F<sub>cr</sub> = 0.9k<sub>F</sub>.E.t<sub>w</sub>³/h<sub>w</sub>` | substituted | kN | `6.4(1)` | `gov.Fcr` |
| `l<sub>e</sub> = k<sub>F</sub>.E.t<sub>w</sub>²/(2f<sub>yw</sub>.h<sub>w</sub>) ≤ s<sub>s</sub> + c` (type c only) | substituted | mm | `6.5(4)` | `gov.leRaw`, `gov.le` |
| `l<sub>y</sub> = …` (6.5(3) form for a/b, min of the two 6.5(4) expressions for c) | `m<sub>2</sub> = … (first pass λ̄<sub>F</sub> = … ≤ 0.5, so m<sub>2</sub> = 0)`; substituted | mm | `6.5(3)` / `6.5(4)` | `gov.m2, iter, lam1, l1, l2, ly, capA` |
| `λ̄<sub>F</sub> = √(l<sub>y</sub>.t<sub>w</sub>.f<sub>yw</sub>/F<sub>cr</sub>)` | substituted | λ̄<sub>F</sub> | `6.4(1)` | `gov.lam` |
| `χ<sub>F</sub> = 0.5/λ̄<sub>F</sub> ≤ 1 ; L<sub>eff</sub> = χ<sub>F</sub>.l<sub>y</sub>` | substituted | mm | `6.4(1)` | `gov.chiRaw, chi, Leff` |
| `F<sub>Rd</sub> = f<sub>yw</sub>.L<sub>eff</sub>.t<sub>w</sub>/γ<sub>M1</sub>` | substituted (box: `per web; load share to this web = …; F<sub>Rd</sub> for the load = …`) | kN | `6.2(1)` | `gov.FRd`, station `share, eMax, FRdTot` |
| `F<sub>Ed</sub>/F<sub>Rd</sub>` | `[P = …, R = …:] F<sub>Ed</sub> = … kN (<combination>; on the top/bottom flange, in compression/tension) / <FRdTot> =` | ratio | OK / Warning | station `cases[g2]` |
| `η<sub>2</sub> + 0.8η<sub>1</sub> ≤ 1.4` | `<η2> + 0.8 x (M<sub>Ed</sub>/M<sub>c.y.Rd</sub> = …/… [+ N<sub>Ed</sub>/N<sub>pl.Rd</sub>] = <η1>) = … ≤ 1.4 (<combination>[; loaded flange in tension: 7.2(2) refers to 6.2.1(5), expression applied as a screen [verify]])` | ratio/1.4 | `OK 7.2` / `Warning 7.2` | station `cases[g72]`, `c.web.McRd0`, `c.web.NEd`, `c.web.NplRd` |
| table, one row per station | x, station, type, s<sub>s</sub> (asterisk = default B), k<sub>F</sub>, l<sub>y</sub>, λ̄<sub>F</sub>, χ<sub>F</sub>, F<sub>Rd</sub>, F<sub>Ed</sub>, load case, F<sub>Ed</sub>/F<sub>Rd</sub>, (η<sub>2</sub>+0.8η<sub>1</sub>)/1.4, status (`governs` / `OK` / `Warning`); a stiffened station prints `stiffener declared - design stiffener separately (EN 1993-1-5 9.4)` with tag `advisory` | | | | `c.web.stations[]` |
| note (`ms-note`) | assumptions: flanges loaded, s<sub>s</sub> ≤ h<sub>w</sub>, end-zone rule, type (b) rule, η<sub>1</sub> basis [verify], what is not evaluated | | | |

Unity bar: cells `F/F_Rd` and `Web 7.2` after `M-V` (when the check ran). Blocking messages that mention web transverse forces / bearing stiffeners route to this block (`msbBlockFor` → `'web'`).

### 5.4 Compression Resistance N.b.Rd

Printed only when `B !== null` and `B.Fc > 1e-9` (axial compression). MasterSeries prints `Ley = Ky.Ly` / `λy` / `Nb.y.Rd` then the z-z trio.

| Label / formula | Substituted values | Result | Tag | Source |
|---|---|---|---|---|
| `L<sub>ey</sub> = K<sub>y</sub>.L<sub>y</sub>` | `<S.leFactor> x <S.L> =` | `B.LcrY/1000` (m, trimmed) | | `S.leFactor`, `S.L`, `B.LcrY` |
| `λ<sub>y</sub> = √A.f<sub>y</sub>/N<sub>cr</sub>` (bar over λ) | `√<A cm²>x<fy>/<Ncr,y>` | `B.lamY` | | `sec.A`, `c.fy`; N<sub>cr,y</sub> DERIVE `Math.PI**2*a.E*sec.Ix*1e4/B.LcrY**2/1000` kN (`sec.Ix` is the major axis); `B.lamY` is computed as `(LcrY/rx)/λ1`, which is the same number |
| `N<sub>b.y.Rd</sub> = Area.χ.f<sub>y</sub>/γ<sub>M1</sub>` | `<A>x<chiY>x<fy>/10/1 =` | `B.NbY` kN | `Curve <B.cvY.curve>` | `B.chiY`, `B.NbY`, `B.cvY` |
| `L<sub>ez</sub> = K<sub>z</sub>.L<sub>z</sub>` | `<S.leFactor> x <S.L> =` or, when `B.lczFromRestraints`, `largest lateral-restraint spacing =` | `B.LcrZ/1000` m | `P360 6.2` when from restraints | `B.LcrZ`, `B.lczFromRestraints` |
| `λ<sub>z</sub> = √A.f<sub>y</sub>/N<sub>crz</sub>` | `√<A>x<fy>/<Ncr,z>` | `B.lamZ` | | N<sub>cr,z</sub> DERIVE `Math.PI**2*a.E*sec.Iy*1e4/B.LcrZ**2/1000` kN |
| `N<sub>b.z.Rd</sub> = Area.χ.f<sub>y</sub>/γ<sub>M1</sub>` | `<A>x<chiZ>x<fy>/10/1 =` | `B.NbZ` kN | `Curve <B.cvZ.curve>` | `B.chiZ`, `B.NbZ`, `B.cvZ` |

`λ<sub>1</sub> = π√(E/f<sub>y</sub>)` is available as `B.lam1` if a house-rule basis line is wanted. Cantilever strut note: `annexB2` uses `LcrY = S.leFactor*a.L` for a cantilever too (a classical 2L is the user's `leFactor` choice); print the value as stored.

### 5.5 Equivalent Uniform Moment Factors C1, C.mLT, C.mz, and C.my

Heading: `Equivalent Uniform Moment Factor C1` (Beam-Portion) or `Equivalent Uniform Moment Factors C1, C.mLT, C.mz, and C.my` (Axial with Moments). The C1 line prints only when LTB is checked (`S.restraint !== 'full'` and not `LT.na`); the C<sub>m</sub> lines print only when `B` exists. If neither applies the block is omitted (the fully restrained UC printout in `T01-3_p58` has no such block).

**C1 line, FE eigensolver method** (`LT.eigen === true`):

| Label / formula | Substituted values | Result | Tag | Source |
|---|---|---|---|---|
| `C<sub>1</sub> = M<sub>cr</sub>/M<sub>cr,uniform</sub>` | `<McrShape> / <McrUniform>` kN.m (shape-only eigenvalue with z<sub>g</sub> = z<sub>j</sub> = 0 over the uniform-moment eigenvalue with the same restraints) | `LT.C1` | `k<sub>c</sub> only` (C1 is used solely for k<sub>c</sub>, NA 2.18; M<sub>cr</sub> comes from the eigenvalue) | `LT.McrShape`, `LT.McrUniform`, `LT.C1`, `LT.c1Trusted` (if false: tag `not converged: k<sub>c</sub> = 1`) |
| Bay override (when `LT.c1label` contains `critical bay`) | `critical bay <a>–<b> m; whole-member ratio <McrShape/McrUniform>` | `LT.C1` (the bay value) | `NA 2.18` | the bay's own M<sub>cr</sub> numbers are NOT AVAILABLE (`bayC1For` in `08-mcr-eigen-patch.js` keeps only the ratio); print the bay extents parsed from the whole-member `LT.vPoints` and `LT.modePeakX` (DERIVE: the interval of `LT.vPoints` containing `LT.modePeakX`) and the whole-member ratio for reference |
| User override (`S.C1o != null`) | `user override (eigen value <eigen>)` | `S.C1o` | `User` | `S.C1o`, the eigen value is embedded in `LT.c1label` text only; NOT AVAILABLE as a number unless the patch stores it (recommend adding `LT.C1eigen`) |

**C1 line, standard closed-form method** (`S.mcrMethod === 'sn003a'`, object from `sn003aC1()` via `c.C1`, `c.c1label`):

| Label / formula | Substituted values | Result | Tag | Source |
|---|---|---|---|---|
| `C<sub>1</sub> = fn(M<sub>1</sub>, M<sub>2</sub>, M<sub>o</sub>, ψ, μ)` | `<M1>, <M2>, <Mo>, <ψ>, <μ>` | `c.C1` | `Uniform` / `Not Loaded` / `Point` / `Serna` / `User` | `c.C1`; M<sub>1</sub>, M<sub>2</sub>, M<sub>o</sub>, ψ, μ DERIVE from the governing portion (section 8, `portionMoments`): M<sub>1</sub> = M(x<sub>a</sub>), M<sub>2</sub> = M(x<sub>b</sub>) ordered so that |M<sub>2</sub>| ≥ |M<sub>1</sub>|, M<sub>o</sub> = M(x<sub>mid</sub>) − (M<sub>1</sub>+M<sub>2</sub>)/2 (mid-portion moment above the chord), ψ = M<sub>1</sub>/M<sub>2</sub>, μ = min(M<sub>o</sub>/M<sub>2</sub>, 300), all from `a.governM.fb`, printed 1 dp / 1 dp / 1 dp / 3 dp / 3 dp as MasterSeries does. MasterSeries' 0.1 kN.m floor on M<sub>1</sub>, M<sub>2</sub> is not reproduced. Tag DERIVE from `c.c1label`: contains `uniformly distributed` → `Uniform`; `central point load` → `Point`; `linear end-moment gradient` → `Not Loaded`; `Serna` → `Serna`; `cantilever` → `Cantilever`; `user override` → `User` |
| Basis note (small line under the block) | `C1 basis: <c.c1label>` with the NCCI reference: SN003a Table 3.2 for the two tabulated shapes, SCI curve (1.33 − 0.33ψ)² for end moments, Serna et al. quarter-point expression (SCI NSC Nov 2013) otherwise | | `SN003a` | `c.c1label` (already carries the table reference and the quarter-point moments) |

**C<sub>m</sub> lines** (when `B` exists; source of all three is `annexB2` → `cmTableB3(a)`):

| Label / formula | Substituted values | Result | Tag | Source |
|---|---|---|---|---|
| `C<sub>mLT</sub> = <form>` | `M<sub>h</sub> = <Mh>, M<sub>s</sub> = <Ms>, ψ = <ψ>, α<sub>s</sub> = <αs>` (or `α<sub>h</sub> = <αh>`) | `B.CmLT` | `Table B.3` | `B.CmLT`; `<form>` and the parameters DERIVE (section 8, `cmB3Params`) by re-reading `a.governM.fb` exactly as `cmTableB3` does: M<sub>h</sub> = larger |end moment| (`a.M0end`, `a.MLend`), M<sub>s</sub> = `a.Mh` (mid-span moment), ψ = M<sub>o</sub>/M<sub>h</sub> (smaller end over larger end), α<sub>s</sub> = M<sub>s</sub>/M<sub>h</sub>, α<sub>h</sub> = M<sub>h</sub>/M<sub>s</sub>. `<form>` from `B.cmLabel` prefix: `linear end-moment diagram` → `Max(0.6+0.4ψ, 0.4)`; `uniform load diagram` with `α<sub>h</sub>` → `0.95+0.05α<sub>h</sub>`; `concentrated load diagram` with `α<sub>h</sub>` → `0.90+0.10α<sub>h</sub>`; with `α<sub>s</sub>` → `0.2+0.8α<sub>s</sub>` (α<sub>s</sub> ≥ 0) or the negative-α<sub>s</sub> rows of Table B.3; `C_m = 1: arbitrary or mixed` → `1.0 (diagram outside Table B.3)`; `negligible moment` → `1.0`; `mixed loading` → `max(uniform, concentrated)`. `B.swayNote` true → append ` ≥ 0.9 (sway mode)` |
| `C<sub>mz</sub> = Max(0.6+0.4ψ, 0.4)` | `M = <Mz>, ψ = 1.000` | `B.Cmz` (always 1.0: M<sub>z</sub> is constant, ψ = 1) | `Table B.3` | `B.Cmz`, `S.Mz` |
| `C<sub>my</sub> = <form>` | same parameters as C<sub>mLT</sub> | `B.Cmy` | `Table B.3` | `B.Cmy` (equal to `B.CmLT` in `annexB2`) |

### 5.6 Lateral Buckling Check M.b.Rd

Heading `Lateral Buckling Check M.b.Rd`. Five variants.

**A. Fully restrained** (`S.restraint === 'full'`, `c.sci === true`):

| Label | Values | Result | Tag | Source |
|---|---|---|---|---|
| `M<sub>b.Rd</sub> = M<sub>c.y.Rd</sub>` | `Fully Restrained` | `c.McRd` kN.m | | `c.McRd` |

**B. Closed section exempt** (closed-form object with `LT.na === true`; in the FE version boxes are solved, see C):

| Label | Values | Result | Tag | Source |
|---|---|---|---|---|
| `M<sub>b.Rd</sub> = M<sub>c.y.Rd</sub>` | `closed hollow section` | `LT.MbRd` kN.m | `6.3.2.1(2)` | `LT.MbRd`, `LT.na` |

**C. FE eigensolver** (`LT.eigen === true`; MasterSeries' `Le`, `Mcr = Fn(...)` lines are replaced as the task requires):

| Label / formula | Substituted values | Result | Tag | Source |
|---|---|---|---|---|
| `L<sub>e</sub> = portion between restraints` | `restraints at x = <vPoints/1000 joined> m (fork)`; cantilever adds `root warping <S.rootWarp>` | governing portion length `(xb − xa)/1000` m | `FE` | `LT.vPoints`, `LT.modePeakX`, `S.rootWarp`, `S.supports[].vp/.phip`, `S.fixedLateral` (extra fixities listed as in `ltbEigenReport`) |
| `M<sub>cr</sub> = FE eigenvalue (n<sub>Elem</sub>, mesh error)` | `<nElem> elements, <meshError %> %` + (`LT.nCombos > 1` ? `; governing: <governCombo>` : ``) + (`LT.zg != 0` ? `; z<sub>g</sub> = <zg> mm` (or the `LT.zgValues` list) : ``) | `LT.Mcr` kN.m | `converged` / `BLOCKED` (`LT.mcrConverged` false or `LT.meshError > 0.005`) | `LT.nElem`, `LT.meshError`, `LT.Mcr`, `LT.nCombos`, `LT.governCombo`, `LT.zg`, `LT.zgValues`, `LT.zgUniform`, `LT.mcrConverged`; `LT.McrRev` (load reversed) may be shown as a second value when `LT.zg != 0` |
| `λ<sub>LT</sub> = √W.f<sub>y</sub>/M<sub>cr</sub>` | `√ <Wy cm³> x <fy> / <Mcr>` | `LT.lamLT` | | `c.Wy/1e3`, `c.fy`, `LT.Mcr`, `LT.lamLT` |
| `λ<sub>LT</sub> ≤ λ<sub>LT,0</sub>` (only when `LT.ign`) | `<lamLT> ≤ 0.4` | `χ<sub>LT</sub> = 1.000` | `6.3.2.2(4)` | `LT.ign` |
| `χ<sub>LT</sub> = Fn(λ<sub>LT</sub>, Φ<sub>LT</sub>, α<sub>LT</sub>)` | `<lamLT>, <Phi>, <alphaLT>` | `LT.chi` | `Curve <LT.curve.curve>` | `LT.lamLT`, `LT.Phi`, `LT.curve.alphaLT`, `LT.chi`. MasterSeries prints `Fn(λLT, λLT5950)`; λ<sub>LT5950</sub> is NOT AVAILABLE on the EC3 path (BS 5950-1 equivalent slenderness u v λ √β<sub>w</sub>, computed only by `checksBS5950` under `S.code = 'BS5950'`); Φ<sub>LT</sub> is printed instead, matching the Annex-BB wording `Fn(λLT, φLT, β)` |
| `χ<sub>LT.mod</sub> = Fn(χ<sub>LT</sub>, λ<sub>LT</sub>, k<sub>c</sub>, f)` | `<chi>, <lamLT>, <kc>, <f>` | `LT.chiMod` | `6.3.2.3` (cantilever: `f = 1 (cantilever)`) | `LT.chi`, `LT.lamLT`, `LT.kc`, `LT.f`, `LT.chiMod`, `LT.cant` |
| `M<sub>b.Rd</sub> = χW<sub>pl.y</sub>.f<sub>y</sub> ≤ M<sub>c.y.Rd</sub>` (`W<sub>el.y</sub>` for Class 3) | `<chiMod> x <Wy cm³> x <fy> ≤ <McRd> =` | `LT.MbRd` kN.m | | `LT.chiMod`, `c.Wy`, `c.fy`, `c.McRd`, `LT.MbRd` |
| `M<sub>y.Ed</sub>/M<sub>b.Rd</sub>` | `<MxLTB> / <MbLTB>` | `c.ltbUtil` | OK / Warning | `MxLTB = LT.spanGoverns ? LT.spanGov.Ms : LT.MxGov`, `MbLTB = LT.spanGoverns ? LT.spanGov.Mb : LT.MbRd` (the same choice `ltbEigenReport` makes); `c.ltbUtil` |

When `LT.spanGoverns` is true the block is preceded by the span line of section 7 and the χ printed is the span's `LT.spanGov.chi` (no f-factor) with `LT.spanGov.lam`, `LT.spanGov.Mcr`, `LT.spanGov.Mb`.

Channel in FE mode (`LT.channel`): same lines, tag `Curve d`, plus `LT.chanTorsionGap` → footer entry. Box in FE mode (`LT.box`): same lines; `LT.ign` normally true (λ̄ far below 0.4).

**D. Standard closed form, SN003a** (`S.mcrMethod === 'sn003a'`, I/H section, not a cantilever; object from the original `checksEC3UnrestrainedSCI`):

| Label / formula | Substituted values | Result | Tag | Source |
|---|---|---|---|---|
| `L<sub>e</sub> = <k> L` | `<k> x <S.L> =` | `c.LE/1000` m | | `k = S.leFactor*(S.destab ? 1.2 : 1)`, `c.LE` |
| `M<sub>cr</sub> = Fn(C<sub>1</sub>, L<sub>e</sub>, I<sub>z</sub>, I<sub>t</sub>, I<sub>w</sub>, E)` | `<C1>, <Le m 3dp>, <Iz cm⁴>, <It cm⁴>, <Iw dm⁶>, <E>` (+ `, C<sub>2</sub>z<sub>g</sub> = <C2*zg> mm` when `LT.zgUsed`) | `LT.Mcr` kN.m | `SN003a` | `c.C1`, `c.LE`, `sec.Iy` (minor axis, printed as I<sub>z</sub>), `sec.J`, `sec.Iw`, `a.E`, `LT.Mcr`, `LT.zgUsed`, `LT.C2`, `LT.zg`. Basis values `LT.T1` (π²EI<sub>z</sub>/L², kN), `LT.IwIz` (cm²), `LT.GIt` (kN.m²) exist for a house-rule basis line; G = 81000 N/mm² is the value in the code |
| `λ<sub>LT</sub> = √W.f<sub>y</sub>/M<sub>cr</sub>` | `√ <Wy> x <fy> / <Mcr>` | `LT.lamLTmcr` | | `LT.lamLTmcr` |
| `λ<sub>LT</sub> ≤ 0.4` line when `LT.ignM` | as C | | `6.3.2.2(4)` | `LT.ignM` |
| `χ<sub>LT</sub> = Fn(λ<sub>LT</sub>, Φ<sub>LT</sub>, α<sub>LT</sub>)` | `<lamLTmcr>, <PhiM>, <alphaLT>` | `LT.chiM` | `Curve <LT.curve.curve>` | `LT.PhiM`, `LT.chiM`, `LT.curve` |
| `χ<sub>LT.mod</sub> = Fn(χ<sub>LT</sub>, λ<sub>LT</sub>, k<sub>c</sub>, f)` | `<chiM>, <lamLTmcr>, <kc>, <fM>` | `LT.chiModM` | `6.3.2.3` | `LT.kc` (= `LT.invSqrtC1`), `LT.fM`, `LT.chiModM` |
| `M<sub>b.Rd</sub> = χW<sub>pl.y</sub>.f<sub>y</sub> ≤ M<sub>c.y.Rd</sub>` | `<chiModM> x <Wy> x <fy> ≤ <McRd> =` | `LT.MbMcr` kN.m | | `LT.MbMcr` |
| `M<sub>y.Ed</sub>/M<sub>b.Rd</sub>` | `<Mx> / <MbRd>` | `c.ltbUtil` | OK / Warning | Decision 1 taken (Sep 2026 review): the standard route's design basis is the M<sub>cr</sub> chain, `LT.MbRd = LT.MbMcr` = min(χ<sub>LT,mod</sub> W<sub>y</sub> f<sub>y</sub>/γ<sub>M1</sub>, M<sub>c,Rd</sub>), so `c.ltbUtil` equals the printed ratio and the same value feeds Eq 6.61/6.62. A **[beam-v03 addition]** comparison line `λ<sub>LT</sub> (P362 6.55 simplified) ; M<sub>b.Rd</sub> (comparison only)` prints `LT.lamLTsimp`, `LT.chiModS`, `LT.MbSimp` and `c.Mx/LT.MbSimp` with the tag `P362 6.55 comparison`. The M<sub>cr</sub> line always ends with the load-height status `LT.zgNote` (entered z<sub>g</sub>, applied / not applied / blocked) and carries the tag `BLOCKED` when `LT.zgBlocked` |

**D′. Standard closed form, cantilever (SN006a)** (`LT.cant` in the closed-form object):

| Label / formula | Substituted values | Result | Tag | Source |
|---|---|---|---|---|
| `M<sub>cr0</sub> = (π/L)√(EI<sub>z</sub>GI<sub>t</sub>)` | `<S.L>, <E>, <Iz>, <It>` | `LT.Mcr0` kN.m | `SN006a` | `LT.Mcr0` |
| `C = Fn(κ<sub>wt</sub>, η, warping)` | `<kwt>, <eta>, <warp: free/restrained>; <caseLbl>` (+ `C<sub>q</sub> = <Cq>, C<sub>F</sub> = <CF>, Eq (7)` when both) | `LT.C` | `Table 3.1/3.2/3.3` | `LT.kwt`, `LT.eta`, `LT.warp`, `LT.caseLbl`, `LT.C`, `LT.Cq`, `LT.CF`; `LT.C === 0` → tag **BLOCKED** (outside the tables) |
| `M<sub>cr</sub> = C·M<sub>cr0</sub>` | `<C> · <Mcr0>` | `LT.Mcr` | | `LT.Mcr` |
| λ<sub>LT</sub>, χ<sub>LT</sub> (Curve `LT.curve.curve`), M<sub>b.Rd</sub>, ratio | as D with `LT.lamLTmcr`, `LT.PhiM`, `LT.chiM`, `f = 1`, `LT.MbRd` | | | no k<sub>c</sub>/f for cantilevers (code comment: no published k<sub>c</sub>) |

**D″. Standard closed form, channel (P362/P385 κ chain)** (`LT.channel`):

| Label / formula | Substituted values | Result | Tag | Source |
|---|---|---|---|---|
| `λ<sub>LT</sub> = (L<sub>e</sub>/i<sub>z</sub>)/κ` | `(<c.LE>/<LT.ry>)/<LT.kappa> (<S.grade>)` | `LT.lamLTmcr` | `P362 channel` | `LT.ry` (mm), `LT.kappa` (96/85/74 by grade), `LT.lamLTmcr` |
| `χ<sub>LT</sub> = Fn(λ<sub>LT</sub>, Φ<sub>LT</sub>, α<sub>LT</sub>)` | `<lamLTmcr>, <PhiM>, 0.76` | `LT.chiM` | `Curve d` | no f-factor on this chain |
| `M<sub>b.Rd</sub> = χW<sub>pl.y</sub>.f<sub>y</sub>` | | `LT.MbRd` | | |
| `M<sub>cr</sub> (back-calculated) = W.f<sub>y</sub>/λ<sub>LT</sub>²` | | `LT.McrBack` | | used by Annex A only |
| optional M<sub>cr</sub> route (`LT.chanMcr`, load through the shear centre only) | `<chanMcr.Mcr>, λ = <lam>, χ = <chi>, f = <f>, χ<sub>mod</sub> = <chiMod>` | `LT.chanMcr.Mb` | `SN003a (z<sub>j</sub> = 0)` | `LT.chanMcr.{Mcr, lam, Phi, chi, f, chiMod, ign, Mb, T1}` |

### 5.7 Buckling Resistance

Printed when `B !== null` and (`B.Fc > 1e-9` or `B.biax`). All values from `annexB2`.

| Label / formula | Substituted values | Result | Tag | Source |
|---|---|---|---|---|
| `U<sub>N.y</sub> = N<sub>Ed</sub>/(χ<sub>y</sub>.N<sub>Rk</sub>/γ<sub>M1</sub>)` | `<Fc> / <NbY>` | `B.ny` | OK / Warning | `B.Fc`, `B.NbY`, `B.ny`; N<sub>Rk</sub> = A f<sub>y</sub> DERIVE `sec.A*100*c.fy/1000` kN if a basis value is wanted (equals `AX.NplRd` with γ<sub>M0</sub> = 1) |
| `U<sub>N.z</sub> = N<sub>Ed</sub>/(χ<sub>z</sub>.N<sub>Rk</sub>/γ<sub>M1</sub>)` | `<Fc> / <NbZ>` | `B.nz` | OK / Warning | `B.NbZ`, `B.nz` |
| `U<sub>M.y</sub> = M<sub>y.Ed</sub>/(χ<sub>LT</sub>.M<sub>y.Rk</sub>/γ<sub>M1</sub>)` | `<B.Mx> / <B.MbRdI>` | DERIVE `B.Mx/B.MbRdI` | OK / Warning | `B.Mx` (governing combination's own M<sub>y.Ed</sub>; `annexB2` sweeps every combination and keeps the worst), `B.MbRdI` (= `c.McRd` when fully restrained, else the LTB resistance handed in: `memberMb` = min over combinations and spans in the FE version, `LT.MbRd` in the closed form). M<sub>y.Rk</sub> = W<sub>y</sub> f<sub>y</sub> DERIVE `c.Wy*c.fy/1e6` kN.m |
| `U<sub>M.z</sub> = M<sub>z.Ed</sub>/(M<sub>z.Rk</sub>/γ<sub>M1</sub>)` | `<MzEd> / <Mcz>` | `B.mzTerm` | OK / Warning | `B.MzEd`, `B.Mcz`, `B.mzTerm` |
| `k<sub>yy</sub> = C<sub>my</sub>{1+(λ<sub>y</sub>−0.2)U<sub>N.y</sub>}` (Class 1/2, `B.c12`) or `C<sub>my</sub>{1+0.6λ<sub>y</sub>U<sub>N.y</sub>}` (Class 3) | `<Cmy>{1+(<lamY>−0.2)x<ny>} ≤ <Cmy>(1+0.8x<ny>)` | `B.kyy` | `Table B.1` / `B.2` (shared) | `B.Cmy`, `B.lamY`, `B.ny`, `B.kyy`, `B.c12` (MasterSeries leaves the values column blank; beam-v03 prints the substitution and the cap, house rule) |
| `k<sub>zz</sub> = C<sub>mz</sub>{1+(2λ<sub>z</sub>−0.6)U<sub>N.z</sub>}` (or `1+0.6λ<sub>z</sub>U<sub>N.z</sub>`) | `<Cmz>{1+(2x<lamZ>−0.6)x<nz>} ≤ <Cmz>(1+1.4x<nz>)` | `B.kzz` | | `B.Cmz`, `B.lamZ`, `B.nz`, `B.kzz` |
| `k<sub>yz</sub> = 0.6k<sub>zz</sub>` (Class 1/2) or `k<sub>yz</sub> = k<sub>zz</sub>` (Class 3) | | `B.kyz` | | `B.kyz` |
| `k<sub>zy</sub> = 0.6k<sub>yy</sub>` (Table B.1, `B.useB1`, Class 1/2; `0.8k<sub>yy</sub>` Class 3) or `k<sub>zy</sub> = 1 − 0.1λ<sub>z</sub>U<sub>N.z</sub>/(C<sub>mLT</sub>−0.25)` (Table B.2, with `min(λ<sub>z</sub>,1)` and the λ<sub>z</sub> < 0.4 form) | `B.kzyLbl` already holds the HTML of the form used | `B.kzy` | `Table B.1` / `Table B.2` | `B.useB1`, `B.kzyLbl`, `B.kzy`, `B.CmLT` |
| `U<sub>Ny</sub>+k<sub>yy</sub>.U<sub>M.y</sub>+k<sub>yz</sub>.U<sub>M.z</sub>` | `<ny>+<kyy>x<UMy>+<kyz>x<UMz>` | `B.u1` | OK / Warning (`B.Fc = 0`: tag `N<sub>Ed</sub> = 0`) | `B.u1` (Eq 6.61) |
| `U<sub>Nz</sub>+k<sub>zy</sub>.U<sub>M.y</sub>+k<sub>zz</sub>.U<sub>M.z</sub>` | `<nz>+<kzy>x<UMy>+<kzz>x<UMz>` | `B.u2` | OK / Warning | `B.u2` (Eq 6.62) |

MasterSeries' "Print both Simplified & More Exact" second variant is NOT AVAILABLE (beam-v03 implements Annex B Method 2 only; Annex A is not coded).

### 5.8 Torsion Design

Printed when `c.tor !== null`. MasterSeries prints two constant lines and then a "Torsion Bending Design @ x" heading whose content is not documented (cut off in every screenshot; `MASTERSERIES_STEEL_BEAM_LOGIC.md` section 10 item 7). The lines after the heading are therefore beam-v03's own P385 results, laid out in the same three-column style.

| Label / formula | Substituted values | Result | Tag | Source |
|---|---|---|---|---|
| `J, H, a, Q<sub>f</sub>, Q<sub>w</sub>` | `<J> cm⁴, <H> dm⁶, <a> mm, —, —` | | `P385 App A` | J = `sec.tp ? sec.tp.IT : sec.J` (cm<sup>4</sup>; P385 value includes the Appendix B junction correction), H = warping constant `sec.tp && sec.tp.Iw != null ? sec.tp.Iw : sec.Iw` (dm<sup>6</sup>), a = `T.aa` mm (computed with the entered E; `sec.tp.a` × 1000 is the tabulated value). Q<sub>f</sub>, Q<sub>w</sub> NOT AVAILABLE (BS 5950 / P057 statical moments; not in the P385 tables carried by beam-v03); print em dashes |
| `W<sub>n0</sub>, S<sub>w1</sub>` | `<Wn0> cm², <Sw1> cm⁴` | | `P385 App A` | `sec.tp.Wn0`, `sec.tp.Sw1` for UB/UC/PFC (`TP385_*` tables); PFC also has `Wn2`, `Sw2`, `Sw3`, `e0`, `esc`; hollow sections: NOT AVAILABLE (`tp` holds `IT`, `Wt` only) → print `—` and add the `W<sub>t</sub>` line below |
| sub-heading `Torsion Bending Design @ <x>` | | | | `x = T.p385 ? T.cross.x/1000 : a.tors.Tpos` m |
| `T<sub>Ed</sub> (max)` | `combination <governT>` | `T.TEd` kN.m | | `T.TEd`, `T.governT` |
| Open sections (`T.p385`): `Torsion analysis` **[beam-v03 addition, 19 Sep 2026 G4]** | closed forms: `SCI P385 App C closed forms (Cases 3/4/10); fork supports at x = 0 and x = L (φ = 0, warping free)`; FE: `EI<sub>w</sub>φ⁗ − GI<sub>T</sub>φ″ = m<sub>t</sub>(x): warping-torsion FE (<n> elements); <bcText>; closed forms not applicable: <feReasons>` | closed: `L/a = <T.X>`; FE: `mesh error <T.meshError×100> %` | `P385 App C` / `FE (≤ 0.5 %)` / **BLOCKED** (`T.meshConverged` false) | `T.method` ('closed' \| 'fe'), `T.fe`, `T.methodLabel`, `T.bcText`, `T.feReasons`, `T.nElem`, `T.meshError`, `T.meshBlock`, `T.meshConverged` (js/checks/torsion-fe.js) |
| `φ<sub>max</sub> (ULS)` | closed: `L/a = <T.X>; fork ends, warping free (P385 Cases 3/4/10)`; FE: `warping-torsion FE, <bcText>` | `T.phiUmax` rad, ° | | `T.phiUmax`, `T.X` |
| `B<sub>Ed</sub> = EI<sub>w</sub>φ″ (max)` **[beam-v03 addition, G4]** | `@ x = <T.BMaxPos/1000> m` | `T.BMax` kN.m² | | `T.BMax`, `T.BMaxPos` (bimoment, both routes) |
| `M<sub>w.Ed</sub> = EI<sub>w</sub>φ″/(h−t<sub>f</sub>)` | `max over span` | `T.MwMax` kN.m | | `T.MwMax` |
| `M<sub>z.Ed</sub> = φ.M<sub>y.Ed</sub>` | `max coincident` | `T.MzMax` kN.m | | `T.MzMax` |
| `(M<sub>y</sub>/M<sub>pl.y</sub>)² + M<sub>w</sub>/M<sub>pl.f</sub> + M<sub>z</sub>/M<sub>pl.z</sub>` (Class 1/2, `T.cls12`) or `M<sub>y</sub>/M<sub>el.y</sub> + M<sub>z</sub>/M<sub>el.z</sub> + M<sub>w</sub>/M<sub>f.Rd</sub>` (Class 3) | `@ x = <cross.x/1000> m: <My>, <Mw>, <Mz> kN.m; M<sub>pl.y</sub> = <Mply>, M<sub>pl.f</sub> = <Mplf>, M<sub>pl.z</sub> = <Mplz>` | `T.cross.u` | OK / Warning | `T.cross.{x, My, Mw, Mz, u, combo}`, `T.Mply`, `T.Mplz`, `T.Mplf`, `T.Mely`, `T.Melz`, `T.Melf` (P385 3.1.2) |
| `V<sub>pl.T.Rd</sub> = √(1 − τ<sub>t</sub>/(1.25f<sub>y</sub>/√3)).V<sub>pl.Rd</sub>` (channel: the Eq 6.27 form with τ<sub>w</sub>) | `@ x = <vt.x/1000> m: τ<sub>t</sub> = <vt.tauT> (τ<sub>w</sub> = <vt.tauW>) N/mm²` | `T.VplTRd` kN | `6.2.7(9)` | `T.vt.{x, V, T, tauT, tauW, VplTRd, combo}`, `T.VplTRd`, `T.chan` |
| `V<sub>Ed</sub>/V<sub>pl.T.Rd</sub>` | `<vt.V> / <vt.VplTRd>` | `T.vtUtil` | OK / Warning (`∞` when `T.vtZeroCapacity`) | `T.vtUtil`, `T.vtZeroCapacity` |
| `M<sub>y</sub>/M<sub>b.Rd</sub> + C<sub>mz</sub>M<sub>z</sub>/M<sub>z.Rk</sub> + k<sub>w</sub>k<sub>zw</sub>k<sub>α</sub>M<sub>w</sub>/M<sub>f.Rk</sub>` (only when `AN`, unrestrained path) | `@ x = <AN.x/1000> m: <My>/<MbA> + <Cmz>x<Mz>/<MzR> + <kw>x<kzw>x<kAlpha>x<Mw>/<MfR>` | `AN.u` | OK / Warning (`BLOCKED` when `AN.kAlpha` is infinite) | `AN.{u, x, My, Mz, Mw, kw, kzw, kAlpha, Cmz, MbA, McrA, MzR, MfR, combo}` (EN 1993-6 Annex A / P385 6.2) |
| `End torques T<sub>t</sub>` | `St Venant part GI<sub>T</sub>φ′ at x = 0 / x = L; total T = GI<sub>T</sub>φ′ − EI<sub>w</sub>φ‴ = <|TEnds[0]|> / <|TEnds[1]|> kN.m` | `|T.TtEnds[0]| / |T.TtEnds[1]|` kN.m | | `T.TtEnds` (St Venant part), `T.TEnds` (total torque, G4) |
| `θ<sub>ser</sub> ≤ θ<sub>limit</sub>` (SLS twist) | `@ x = <phiSerPos> m, <governTw>; limit 2° (P385 guidance)` | `T.phiSerDeg` ° | `OK` / `review` (advisory; does not enter the verdict) | `T.phiSer`, `T.phiSerDeg`, `T.phiSerPos`, `T.governTw`. MasterSeries' "Theta Limit" input default 2° corresponds to the fixed 2° guideline in `checksEC3Restrained` |
| Hollow sections (`T.box`): `W<sub>t</sub>` | `<WtSrc>; I<sub>t</sub> = <ItShow/1e4> cm⁴` | `T.Wt/1e3` cm³ | | `T.Wt`, `T.WtSrc`, `T.ItShow` |
| `T<sub>Rd</sub> = f<sub>y</sub>W<sub>t</sub>/(√3γ<sub>M0</sub>)` | `<fy> x <Wt>/(√3 x 1)` | `T.TRd` kN.m | `6.2.7(7)` | `T.TRd` |
| `T<sub>Ed</sub>/T<sub>Rd</sub>` | `<TEd> / <TRd>` | `T.torUtil` | OK / Warning | `T.torUtil` |
| `V<sub>pl.T.Rd</sub>` and `V<sub>Ed</sub>/V<sub>pl.T.Rd</sub>` (box form, Eq 6.28) | `τ<sub>t</sub> = <vt.tau>` | `T.VplTRd`, `T.vtUtil` | | `T.vt.tau`, `T.VplTRd`, `T.vtUtil` |
| `θ (SLS)` (box) | `T<sub>Ed,SLS</sub> = <TmaxSLS>; @ x = <phiPos> m` | `T.phiDeg` ° | advisory | `T.TmaxSLS`, `T.phiMax`, `T.phiDeg`, `T.phiPos` |
| Not covered (`T` exists but neither `T.p385` nor `T.box`) | `T.TEd`, `T.tp` constants if any | | **BLOCKED** | the matching `c.unsupported` entry gives the reason (`a.torsO.reason`) |

### 5.9 Deflection Check - Load Case m

Heading `Deflection Check - Load Case <m>` with `m` = index/label of `a.governD.combo`.

| Label / formula | Substituted values | Result | Tag | Source |
|---|---|---|---|---|
| `In-span δ ≤ Span/<divisor>` | `<dmax> ≤ <span mm> / <divisor>` (+ `@ x = <dpos> m` and, for multi-span, `segment <start>–<end> m`) | `c.dmax` mm | OK / Warning | `c.dmax`, `c.span`, `c.divisor`, `c.dlimit`, `c.defOk`, `a.deflection.{start, end, dpos}`. Cantilever: label `Tip δ ≤ L/<divisor>` |

Beam-v03 checks every support-to-support span and each overhang with its own length (`analyse()` keeps the worst in `a.deflection`). Since the 19 Sep 2026 gap closure the limit is per segment: span/`S.divisor` between supports, L/`S.divisorCant` (default 180, UK NA Table NA.2 cantilever row [verify]) for a cantilever segment, capped by the optional absolute limit `S.deflAbs`; the governing row prints the limit used (label `Tip &delta; &le; L/180` for a cantilever segment, `(&le; x mm)` when an absolute limit is entered) and a multi-segment member adds one row per segment (`a.deflSegments`, worst SLS combination named). MasterSeries' Def Limit pattern rows are covered by the automatic pattern combinations of the SLS set.

### 5.10 Unity bar

**Beam-Portion bar** (`AX === null`):

| Cell | Value | Source |
|---|---|---|
| `MA/Mc` | `c.momUtil` | |
| `M_(y.Ed)/M_(b.Rd)` | `c.ltbUtil` (unrestrained); fully restrained: `c.momUtil` (M<sub>b.Rd</sub> = M<sub>c.y.Rd</sub>); closed-form box: `c.ltbUtil` | |
| `Deflection` | `c.dmax/c.dlimit` | (the `Deflection` entry of `c.utils`) |
| extra cells **[beam-v03 addition]** appended only when present in `c.utils`: `V/Vpl` (`c.shearUtil`, always), `M-V` (`c.coex.u`), `Torsion` (`T.cross.u` or `T.torUtil`), `V+T` (`T.vtUtil`), `LTB+T` (`AN.u`) | | `c.utils[].name/val` |
| `Max` | DERIVE `max(c.utils.filter(u => u.name !== 'Deflection').map(u => u.val))`; equals `c.gov.val` unless deflection governs | `c.gov` |

**Axial-with-Moments bar** (`AX !== null`):

| Cell | Value | Source |
|---|---|---|
| `N_Ed/N_(pl.Rd)` | `AX.nUtil` | |
| `Local` | `AX.mUtil` (biaxial / M<sub>N</sub> interaction, see section 1 item 2) | |
| `UNyz` | DERIVE `max(B.ny, B.nz)`; `0.000` when `B === null` (tension) | |
| `UMyz` | DERIVE `max(B.Mx/B.MbRdI, B.mzTerm)`; tension: `c.ltbUtil` (unrestrained) or `c.momUtil` | |
| `Ax+M_6.61` | `B.u1`; tension: `0.000` | |
| `Ax+M_6.62` | `B.u2`; tension: `0.000` | |
| `Deflection` | `c.dmax/c.dlimit` | |
| extra cells as above (`V/Vpl`, `MA/Mc` = `c.momUtil`, `LTB` = `c.ltbUtil`, `M-V`, `Torsion`, `V+T`, `LTB+T`) **[beam-v03 addition]** | | `c.utils` |
| `Max` | as above, excluding Deflection | |

Rendering: any cell > 1.0001 in red bold; the bar is followed by the verdict footer of section 4.

---

## 6. Line inventory by variant

| Line | Beam-Portion, full restraint | Beam-Portion, LTB (FE) | Beam-Portion, LTB (SN003a) | Axial with Moments, full restraint | Axial with Moments, LTB |
|---|---|---|---|---|---|
| Title, loading, forces table | yes | yes | yes | yes | yes |
| Classification (3 lines) | yes | yes | yes | yes | yes |
| Vy.Ed/Vpl.y.Rd, Vy.Ed,max/Vpl, Vpl basis, Mc.y.Rd, My.Ed/Mc.y.Rd | yes | yes | yes | yes | yes |
| ρ / Mv.y.Rd, coexistent M-V | when triggered | when triggered | when triggered | when triggered | when triggered |
| Vz, Mc.z.Rd, Npl.Rd, n, Wpl.N.y, MN.y.Rd, (Wpl.N.z, MN.z.Rd), biaxial line | no | no | no | yes | yes |
| Compression Resistance | no | no | no | if compression | if compression |
| C1 line | no | eigen form | fn(M1,M2,Mo,ψ,μ) form | no | eigen or fn form |
| CmLT, Cmz, Cmy | no | no | no | if `B` | if `B` |
| Lateral Buckling block | `Mb.Rd = Mc.y.Rd Fully Restrained` | FE chain | SN003a chain (SN006a cantilever, κ chain channel) | `Mb.Rd = Mc.y.Rd Fully Restrained` | FE / SN003a chain |
| Buckling Resistance | no | no | no | if `B` and (`Fc>0` or biax) | same |
| Torsion Design | if `c.tor` | if `c.tor` | if `c.tor` | if `c.tor` | if `c.tor` |
| Deflection | yes | yes | yes | yes | yes |
| Unity bar | Beam-Portion | Beam-Portion | Beam-Portion | Axial with Moments | Axial with Moments |
| Verdict footer, NOT COVERED, ADVISORY | yes | yes | yes | yes | yes |

---

## 7. Multi-span members and portions

MasterSeries splits a member at lateral restraints and prints one portion at a time, each with its own moment diagram, C1 and M<sub>cr</sub>. beam-v03 has no portion selector: the FE method solves the whole member (all supports as forks plus `S.ltbRestraints`) and, when there are three or more lateral points (`LT.vPoints.length >= 3`), also solves each bay in isolation (`LT.segments[]`, fork ends, own share of loads and moment) and lets the worst isolated span govern when its utilisation exceeds the whole-member value (`LT.spanGoverns`, `LT.spanGov`). The brief maps this as follows.

### 7.1 Governing portion (printed in full)

| Item | Rule | Source |
|---|---|---|
| Portion extents `xa`, `xb` | `LT.spanGoverns ? [LT.spanGov.a, LT.spanGov.b]` : the interval of `LT.vPoints` that contains `LT.modePeakX` (the bay the eigenmode localises in); single span: `[0, a.L]`; cantilever: `[0, a.L]` | `LT.spanGov`, `LT.vPoints`, `LT.modePeakX` |
| Title line 3 | `Between <xa/1000> and <xb/1000> m, in Load Case <n>` | |
| Forces table end values | shear and moment at `xa`, `xb` DERIVE `interpAt(a.governM.fb.xs, ..., xa ± 1e-4)` (End 1 = `xa`, End 2 = `xb`); max moment within the portion DERIVE max |M| over `fb.xs` in `[xa, xb]` and its x (equals `LT.spanGov.Ms` when the span governs) | `a.governM.fb` |
| Deflection | the governing span segment `a.deflection` regardless of the LTB portion (MasterSeries also takes the member-wide worst in-span value); print its `start`–`end` in the values column when it differs from `[xa, xb]` | `a.deflection` |
| LTB block | whole-member lines of 5.6 C; when `LT.spanGoverns`, print an extra first line `Governing span <a>–<b> m (isolated, fork ends)` with `LT.spanGov.{Ms, Mcr, lam, chi, Mb, util}` and use them in the ratio line; the whole-member `LT.Mcr` stays on the M<sub>cr</sub> line tagged `whole member` | `LT.spanGov`, `LT.Mcr` |
| C1 for the SN003a variant | `portionMoments(fb, xa, xb)` of section 8 gives M<sub>1</sub>, M<sub>2</sub>, M<sub>o</sub>, ψ, μ for the printed portion. Note: today's `sn003aC1` evaluates the whole member (`a.M0end`, `a.MLend`, `a.Mq`, `a.Mh`, `a.Mq3`), so on a multi-span member its C1 is a whole-member figure; the standard option should evaluate C1 per portion before this brief can claim MasterSeries parity on continuous beams (section 11) | `sn003aC1` |

### 7.2 Portion summary table (printed after the Lateral Buckling block when `LT.segments` exists)

Heading `Lateral Restraint Portions (span by span, fork ends)`.

| Column | Source |
|---|---|
| Portion no. | index + 1 |
| From – To (m) | `seg.a/1000`, `seg.b/1000` |
| L<sub>e</sub> (m) | DERIVE `(seg.b − seg.a)/1000` |
| M<sub>y.Ed</sub> (kN.m) | `seg.Ms` |
| M<sub>cr</sub> (kN.m) | `seg.Mcr` |
| λ<sub>LT</sub> | `seg.lam` |
| χ<sub>LT</sub> | `seg.chi` (no f-factor; note under the table) |
| M<sub>b.Rd</sub> (kN.m) | `seg.Mb` |
| M<sub>y.Ed</sub>/M<sub>b.Rd</sub> | `seg.util` |
| Tag | `governs` on the worst `seg.util` when `LT.spanGoverns`; `worst segment` otherwise; `not solved: <seg.err>` when `!seg.ok` |

C1 per portion is NOT AVAILABLE in `LT.segments` (only Ms, Mcr, λ, χ, Mb, util are stored); if wanted, the patch should store `seg.C1 = seg.Mcr / uniformMcr(bay)`.

Under the table print the whole-member M<sub>cr</sub> and the sentence already composed in `c.ltbBasis` (it states whether the span-by-span or the whole-member value is the design basis).

### 7.3 Other layouts

* Cantilever (`S.supports.length === 1`, fixed): one portion `0–L`; title `Cantilever 0 to L m`; C1 line prints `eigen` (FE) or `Cantilever` (SN006a); `f = 1`.
* Internal hinges (`S.hinges`) shape the BMD only; they are not restraints and do not create portions.
* Several ULS combinations: the LTB block prints the governing combination for LTB (`LT.governCombo`) which may differ from the title's `a.governM.combo`; the FE M<sub>cr</sub> line carries that label.
* Different restraint stiffness at End 1 / End 2 (MasterSeries "As End1", averaged k) is NOT AVAILABLE; beam-v03 models end conditions explicitly through the per-support `vp`/`phip` flags, which are listed on the L<sub>e</sub> line.

---

## 8. DERIVE helper catalogue (to be implemented in the renderer, pure functions)

| Helper | Formula | Used by |
|---|---|---|
| `endShear(fb, x)` | `interpAt(fb.xs, fb.V, x)/1000` kN with `x = 1e-4` or `a.L − 1e-4` (or `xa + 1e-4`, `xb − 1e-4`) | 5.1 table |
| `portionMoments(fb, xa, xb)` | `Ma = interpAt(fb.xs, fb.M, xa+1e-4)/1e6`, `Mb = interpAt(..., xb−1e-4)/1e6`; `[M1, M2] = |Mb| ≥ |Ma| ? [Ma, Mb] : [Mb, Ma]`; `Mmid = interpAt(fb.xs, fb.M, (xa+xb)/2)/1e6`; `Mo = Mmid − (M1+M2)/2`; `psi = |M2| > 1e-9 ? M1/M2 : 0`; `mu = |M2| > 1e-9 ? min(Mo/M2, 300) : 300`; `Mmax` = max |M| on the grid inside `[xa, xb]` and its x | 5.5 (SN003a), 7.1 |
| `cmB3Params(a)` | `M0 = a.M0end`, `ML = a.MLend`, `Mh = |M0| ≥ |ML| ? M0 : ML`, `Mo = the other`, `Ms = a.Mh`, `psi = clamp(Mo/Mh, −1, 1)` (1 when `|Mh| < 1e-9`), `alphaS = Ms/Mh` when `|Ms| ≤ |Mh|`, else `alphaH = Mh/Ms`; the same quantities `cmTableB3` computes internally | 5.5 (C<sub>m</sub> lines) |
| `cmB3Form(label)` | maps `B.cmLabel` prefixes to the Table B.3 expression text (table in 5.5) | 5.5 |
| `c1Tag(label)` | maps `c.c1label` to `Uniform` / `Point` / `Not Loaded` / `Serna` / `Cantilever` / `User` | 5.5 |
| `ncr(E, I_cm4, L_mm)` | `Math.PI**2*E*I_cm4*1e4/L_mm**2/1000` kN | 5.4 |
| `vplZ(sec, fy, hw)` | I/H: `(sec.A*100 − hw*sec.tw)*fy/Math.sqrt(3)/1000`; box: `sec.A*100*sec.B/(sec.D+sec.B)*fy/Math.sqrt(3)/1000`; channel: `null` | 5.3 |
| `rhoShear(V, Vpl)` | `Math.min(Math.pow(2*V/Vpl − 1, 2), 1)` | 5.3 |
| `wplN(MN_kNm, fy)` | `MN_kNm*1e3/fy` cm<sup>3</sup> | 5.3 |
| `mcrSpanOf(LT)` | interval of `LT.vPoints` containing `LT.modePeakX` (fallback `[0, a.L]`) | 5.6 C, 7.1 |
| `caseIndex(combo)` | 1-based index of `combo` among `S.combos.filter(cb => cb.on && !cb.sls)` (ULS) or `... && cb.sls` (SLS) | 5.0, 5.1, 5.9 |
| `caseRanges(list)` | collapses `[1,2,4,5,6]` to `1-2, 4-6` | 5.2 |
| `axialTag(S, sec, eps)` | `(S.axial > 0 && sec.dt > 42*eps) ? '(Axial: Slender web)' : '(Axial: Non-Slender)'` | 5.2 |
| `maxExclDeflection(utils)` | `Math.max(...utils.filter(u => u.name !== 'Deflection').map(u => u.val))` | 5.10 |
| `famLabel(S, sec)`, `sname(key)` | as in `render()` (`06-render.js`) | 5.0, 5.2 |

None of these re-implements a resistance; each re-expresses a number the check functions already used, or converts units.

---

## 9. NOT AVAILABLE register

| Printed item in MasterSeries | Status in beam-v03 | Action in the brief |
|---|---|---|
| Member name / node numbers / Member No. | no such inputs | `S.memberName` (optional new input) or the section string; nodes printed as x positions; Member No. 1 |
| Auto Design Load Cases list | no auto-detection; user enables combinations | print the enabled ULS indices; SLS after a semicolon |
| `Vz.Ed` (minor-axis shear) | single-plane solver | print 0 with the note |
| `λLT5950` in `χLT = Fn(λLT, λLT5950)` | BS 5950-1 quantity, EC3 path does not compute it | print Φ<sub>LT</sub> and α<sub>LT</sub> instead |
| C1 of an isolated bay (values behind `LT.C1` when the critical-bay rule applies) and C1 per `LT.segments[]` entry | ratios only / not stored | print bay extents and whole-member ratio; recommend storing `LT.C1bay = {Mcr, McrUniform}` and `seg.C1` in the patch |
| Eigen C1 value when `S.C1o` overrides | embedded in `LT.c1label` text only | recommend `LT.C1eigen` |
| Torsion constants Q<sub>f</sub>, Q<sub>w</sub> | not in the P385 Appendix A tables carried (`TP385_UB/UC/PFC`: IT, a, Iw, Wn0, Sw1, (+Wn2, Sw2, Sw3, e0, esc for PFC)) | em dashes |
| W<sub>n0</sub>, S<sub>w1</sub> for SHS/RHS | `tp` = {IT, Wt} only | em dashes; print W<sub>t</sub> |
| Contents of "Torsion Bending Design @ x" | not documented by MasterSeries | beam-v03 P385 lines (5.8) |
| "Print both Simplified & More Exact" (Annex A interaction) | Annex B Method 2 only | omitted |
| Def Limit pattern rows, Def Limit Sway, Lambda Limit (L/r slenderness limit) | not implemented (slenderness limit is a BS 5950 retention in MasterSeries) | omitted; `S.divisor` only |
| End-1 / End-2 different effective-length factors (averaged) | explicit per-support LTB flags instead | list the flags |
| Bolt-hole deductions (F-Holes, W-Holes, bolts in row) | only `S.anet` for N<sub>u.Rd</sub> | N<sub>u.Rd</sub> line when tension and `S.anet` |
| Effective area for Class 4 | not computed (blocked) | `Class 4` + BLOCKED |
| Annex BB.3 (Lm, NcrT, Nb.T.Rd, Mcr0) | not implemented | not printed (out of scope) |
| Cantilever detection drop list, FL/UL, BS λLT table choice | BS 5950 items | not printed |

---

## 10. Cross-check vectors and acceptance tests

The three MasterSeries cases that can be modelled in beam-v03 were run through `tests/harness.cjs` (2026-09-19, FE method). They give the tolerances the renderer tests should assert; the residuals are section-table rounding (P363 vs MasterSeries `OPENLIBUK0.db`), not method differences.

| Case (harness overrides) | Quantity | MasterSeries printed | beam-v03 field | beam-v03 value |
|---|---|---|---|---|
| Manual 2070 UB 89: `{family:'ub', ubKey:'457 x 191 x 89', grade:'S355', L:7.5, restraint:'ltb', loads:[udl 14.13 G, udl 12 Q], combos: ULS 1.25G+1.5Q, SLS 1.0G+1.0Q}` | V<sub>y.Ed</sub> (end) | 137.84 | `a.Vmax` | 137.841 |
| | M<sub>y.Ed</sub> @ x | 258.446 @ 3.75 | `a.Mmax`, `a.Mpos` | 258.451 @ 3.75 |
| | δ | 12.91 | `a.dmax` | 12.92 |
| | V<sub>pl.y.Rd</sub> | 1021.758 | `c.VcRd` | 1026.538 |
| | V<sub>y.Ed</sub>/V<sub>pl.y.Rd</sub> (at max M) | 0 | `c.VatM/c.VcRd` | 0.000 |
| | M<sub>c.y.Rd</sub> | 694.692 | `c.McRd` | 693.450 |
| | M<sub>y.Ed</sub>/M<sub>c.y.Rd</sub> | 0.372 | `c.momUtil` | 0.373 |
| | C<sub>1</sub> | 1.127 (Uniform) | `LT.C1` | 1.131 (eigen ratio) |
| | M<sub>cr</sub> | 330.292 | `LT.Mcr` | 331.837 |
| | λ<sub>LT</sub> | 1.450 | `LT.lamLT` | 1.446 |
| | χ<sub>LT</sub> (Curve c) | 0.409 | `LT.chi`, `LT.curve.curve` | 0.410, c |
| | k<sub>c</sub>, f | 0.942, 0.996 | `LT.kc`, `LT.f` | 0.940, 0.995 |
| | χ<sub>LT.mod</sub> | 0.410 | `LT.chiMod` | 0.413 |
| | M<sub>b.Rd</sub> | 285.104 | `LT.MbRd` | 286.049 |
| | M<sub>y.Ed</sub>/M<sub>b.Rd</sub> | 0.906 | `c.ltbUtil` | 0.904 |
| | Deflection ratio | 0.620 | `c.dmax/c.dlimit` | 0.620 |
| | J, H, a | 90.71, 1.035, 1723 | `sec.tp.IT`, `sec.tp.Iw`, `T.aa` | 90.7, 1.04, 1724 |
| | W<sub>n0</sub>, S<sub>w1</sub> | 213.8, 1816 | `sec.tp.Wn0`, `sec.tp.Sw1` | 214, 1820 |
| T01-1 UB 52: `{ubKey:'457 x 152 x 52', grade:'S275', L:6, restraint:'ltb', axial:-0.914, loads:[udl 15 G, udl 20 Q, point 40 Q @ 3], ULS 1.35G+1.5Q}` | V, M<sub>y.Ed</sub> @ x, δ | 182.828, 319.243 @ 3.0, 11.529 | `a.Vmax`, `a.Mmax`, `a.dmax` | 182.828, 319.242 @ 3, 11.515 |
| | V<sub>y.Ed</sub> at max M | 30.005 | `c.VatM` | 30.0 |
| | V<sub>pl</sub>, M<sub>c</sub>, N<sub>pl.Rd</sub> | 579.02, 301.4, 1832.6 | `c.VcRd`, `c.McRd`, `AX.NplRd` | 578.38, 302.5, 1831.5 |
| | Local (biaxial line) | 1.122 | `AX.mUtil` | 1.114 |
| | M<sub>cr</sub> | 128.931 (C1 = 1.127) | `LT.Mcr` | 136.136 (eigen C1 1.190: MasterSeries used the UDL table value for a mixed UDL + point-load diagram; the eigenvalue is the exact figure) |
| | UMyz | 2.800 | `c.ltbUtil` | 2.682 |
| T04-1 UB 40: `{ubKey:'305 x 165 x 40', grade:'S275', L:4.5, restraint:'full', loads: 16 G + 20 Q UDL, PY 20 G @2.1, 14 G @3.6, PDL 10 G + 5 Q 1–2 m, TRAP 12→20 G 3.6–4.3, ULS 1.35G+1.5Q, SLS 1.0G+1.0Q}` | R<sub>1</sub>, R<sub>2</sub> | 151.25, 165.41 | `a.reactions[].V/1000` | 151.23, 165.39 |
| | M<sub>y.Ed</sub> @ x | 190.043 @ 2.1 | `a.Mmax`, `a.Mpos` | 190.030 @ 2.1 |
| | V<sub>pl</sub>, M<sub>c</sub> | 318.775, 171.353 | `c.VcRd`, `c.McRd` | 318.616, 171.325 |
| | MA/Mc | 1.109 (FAIL) | `c.momUtil` | 1.109 |
| | δ vs limit, ratio | 15.57 vs 12.5, 1.246 | `c.dmax`, `c.dlimit` | 15.58, 12.50, 1.247 |
| | Max (excl. deflection) | 1.109 | `maxExclDeflection(c.utils)` | 1.109 |
| Manual 2080 UB 161 (resistances only; loads not documented): `{ubKey:'457 x 191 x 161', grade:'S355', L:9, axial:140.62, Mz:0.41}` | V<sub>pl.y</sub>, M<sub>c.y</sub>, M<sub>c.z</sub>, N<sub>pl</sub> | 1796.895, 1303.548, 231.771, 7091.13 | `c.VcRd`, `AX.MN`, `B.Mcz`, `AX.NplRd` | 1806.058, 1304.1, 231.84, 7107 (P363 A = 206 vs 205.54 cm<sup>2</sup>, S<sub>x</sub> 3780 vs 3778.4) |
| | V<sub>pl.z.Rd</sub> | 2541.93 | DERIVE `vplZ` (6.2.6(3)(c)) | 2568.7 |
| | λ<sub>y</sub>, χ<sub>y</sub>, N<sub>b.y.Rd</sub> (a) | 0.589, 0.894, 6339.182 | `B.lamY`, `B.chiY`, `B.NbY`, `B.cvY.curve` | 0.589, 0.894, 6353.4, a |
| | λ<sub>z</sub>, χ<sub>z</sub>, N<sub>b.z.Rd</sub> (b) | 2.552, 0.134, 953.540 | `B.lamZ`, `B.chiZ`, `B.NbZ`, `B.cvZ.curve` | 2.552, 0.134, 955.7, b |
| | C<sub>my</sub>, C<sub>mz</sub>, C<sub>mLT</sub> | 0.95, 1, 0.95 (UB 52 case) | `B.Cmy`, `B.Cmz`, `B.CmLT` | 0.95, 1, 0.95 |

Acceptance tests to add in `tests/brief.test.cjs` once the renderer exists: (1) for each row above, the brief string contains the formatted beam-v03 value on the line whose label matches (regex on the label HTML); (2) every `c.utils[].name` maps to a printed line or bar cell (no verdict entry is silent); (3) `c.unsupported[]` entries all appear in the footer; (4) the DEMO state (457 x 191 x 82 S275, 8 m, 19.7 G + 19.8 Q, full restraint) renders the Beam-Portion brief with the `Fully Restrained` line and no C1 line; (5) `{restraint:'ltb'}` on the DEMO renders the FE lines `FE eigenvalue` and `M<sub>cr</sub>/M<sub>cr,uniform</sub>`; (6) with `S.mcrMethod = 'sn003a'` the same state renders `fn(M<sub>1</sub>, M<sub>2</sub>, M<sub>o</sub>, ψ, μ)` with tag `Uniform`; (7) the two-span harness case (`L:12`, supports 0/7/12, restraint at 3.5) renders a three-row portion table; (8) the parity test `tests/artifact.test.cjs` still passes after `pwsh ./build-single-html.ps1`.

---

## 11. Open decisions before implementation

1. **Design basis of the standard option.** DONE (Sep 2026 review): `checksEC3UnrestrainedSCI` sets `LT.MbRd = LT.MbMcr` (capped at M<sub>c,Rd</sub>) and `c.ltbUtil = c.Mx/LT.MbMcr`; the simplified route is an informational comparison line. Hollow sections print the real χ<sub>LT</sub> chain (curve from the shared `ltbCurveNA()`) when λ̄<sub>LT</sub> > 0.4 and the 6.3.2.1(2) / 6.3.2.2(4) exemption line only when λ̄<sub>LT</sub> ≤ 0.4.
2. **C1 per portion for the standard option.** `sn003aC1` reads whole-member quantities; on continuous beams the printed `fn(M1, M2, Mo, ψ, μ)` values will be portion values while C1 itself is whole-member. Either evaluate `sn003aC1` on `analysisForCombination`-style portion slices, or print the whole-member M<sub>1</sub>/M<sub>2</sub>/M<sub>o</sub> with the portion extents noted.
3. **c/t versus (B/2)/T on the Class line.** Recommended: print the Table 5.2 c/t<sub>f</sub> (`sec.bT`) with the header text "c/t" so that the number matches the classification actually performed; the MasterSeries (B/2)/T figure can be added in brackets if parity of appearance is preferred.
4. **k<sub>zy</sub> Table B.2 floor.** beam-v03 applies the code floor (min(λ̄<sub>z</sub>, 1)); MasterSeries appears not to (section 1 item 3). Keep beam-v03's value; document the expected difference in the brief note.
5. **Patch additions for full fidelity (optional):** `LT.C1eigen`, `LT.C1bay = {a, b, Mcr, McrUniform}`, `seg.C1` in `LT.segments`, and `S.memberName`; all are additive and do not change any check.
6. **Where the brief lives in the UI:** a "Report format" select (`Detailed` / `MasterSeries brief`) next to the print button, wired in `07-wiring.js`; the print stylesheet must hide the other format.
