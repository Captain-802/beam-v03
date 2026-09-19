# How MasterSeries 2025 designs steel beams: logic, codes and formulas

Date: 2026-09-19. Compiled by Claude Code for CED (fayaz.ahmad@cedengineers.com).

## 0. Provenance and limits (read first)

Everything below comes from MasterSeries' own documentation, not from its program code:

| Source | Location | What it gave |
|---|---|---|
| Online manual "Integrated Analysis Design and BIM 2023" (496 topics, 1963 images) | https://files.masterseries.com/manuals/combined/ , mirrored to `sources/manual_txt`, `manual_html`, `manual_images` | MasterKey Steel Design topics 1940-2230, screenshots of live design output |
| Installed tutorials | `C:\Program Files\MasterSeries 2025\Doc\Tutorials\T01-1, T01-3, T04-1` (text + page PNGs in `sources/tutorials_*`) | Full calculation printouts with numbers (EC3 UK NA path) |
| Technical notes | https://files.masterseries.com/documents/ (`sources/technotes`) | In-span vs nodal deflection, cantilevers, torsion loading |
| Section library | `C:\Program Files\MasterSeries 2025\OPENLIBUK0.db` (SQLite, schema in `sources/openlib_schema.txt`) | Stored section properties and grade/thickness tables |
| Release notes | `Doc\WhatsNew.pdf` (2024 edition shipped with 2025) | Merged Axial+Moment/Annex-BB brief, 9-portion limit removed |

The binaries (`Msprogwd.exe`, `MSProgDLL2022.dll`, `MsProgFEDll2022.dll`) were **not** decompiled. Licence clause 3 forbids decompiling except as permitted by CDPA 1988 s50B. So this document describes what MasterSeries *documents and prints*. Where a printed line shows only "Fn(...)" the underlying formula is marked **[INFERRED]** and, where possible, was verified by recomputing the printed number from the code formula (section 12).

Screenshots in the manual/tutorials are from versions 2018.15 to 2020.01. The 2024/2025 releases merged the "Axial + Moment" and "Appendix-G/Annex-BB" briefs into one check and removed the 9-restraint-portion limit (WhatsNew items 19, 20); the individual checks and formulas are otherwise as documented here.

---

## 1. Modules and code paths

| Item | Documented fact | Source |
|---|---|---|
| Modules that design steel beams | **MasterKey Steel Design** (integrated with MasterFrame analysis) and **MasterBeam Steel Beam Designer** (stand-alone continuous beam / sub-frame, up to 16 spans). Both use the same design engine window ("MasterSteel Beam Design to EN 1993-1-1: 2005"). Composite beams go to the separate MasterBeam Composite module. | 2020, 2130, T04-1 p003/p015 |
| Codes | **BS 5950-1**, **BS EN 1993-1-1 (EC3)** with UK or user-defined National Annex, **SABS 0162 / SANS 10162-1:2005** (licence dependent) | 1940, 2020, 1730 |
| Code selection | MasterFrame: Design > Design Code > British / South African / EuroCode + NA drop list. Sets load-combination factors. Can be switched inside the steel module (uses existing analysis results; re-analysis recommended). | 1940, 1730, T01-1 p20 |
| Classification block heading | "Classification and Effective Area (EN 1993: 2006)" | all EC3 printouts |
| Class labels | EC path prints "Class 1..4"; BS path prints "Plastic / Compact / ..." (tutorial: switching code "changes from Plastic to Class 1") | T01-1 txt 445 |
| Partial factors printed | γM0 = 1, γM1 = 1 (printed as "/1") — UK NA values | all printouts |

---

## 2. Section types covered

| Family | Evidence |
|---|---|
| Open sections: UB, UC, RSJ, UBP, IPE, HE, HL, HD, IPN, W | Manual 2020; DB table `AllISection` (197 rows, `SectionType`/`No` ranges 1-4) |
| Tees cut from UB/UC | `AllISection.TeeName` column |
| Castellated | `AllISection.CastName` column (design method not documented) |
| Equal / unequal angles | `AllEqAngle` (61), `AllUnEqAngle` (48); brief options "Long Leg in Compression/Tension", single-leg bolted angle inputs (EC3-1-8 cl 3.10.3 per status bar) |
| Channels / PFC | `AllChannel` (33); "Top Flange in Tension / Web in Tension" options |
| Hot-finished CHS, SHS, RHS and cold-formed CF CHS/SHS/RHS (incl. 235 grade series), LCHS/JCHS/JSHS/JRHS | `AllCHS` (884), `AllSHSRHS` (1060), `AllSections` list |
| Compound sections (bottom/top plate, width or projection, central or offset) | 2070, 2490 |
| Double members (two sections at a gap "Spacing", connected at "Lv") | 2070, 2080 |
| Cellular beams (profile-cut and re-welded; Do and S in mm or as ratios of depth; cut gap; filled cells; clear end lengths) | 2490 |
| Beams with web openings (circular, rectangular, elongated, end notches, with edge stiffeners) to SCI P355 / P068 | 2160, 2170 |
| Asymmetric Slimfloor Beams (ASB) | 2490 (composite module only) |

Section properties stored per I-section (from the DB schema): D, B, tw, T, d (between fillets), Mass, Area, Ix, Iy, Sx, Sy (plastic), J, H (warping constant), u, x (BS 5950 buckling parameters), r1, r2, surface, plus Kx1..Kx4/nx, Ky1..Ky4/ny (curve-fit coefficients, purpose not documented). Elastic moduli Zx, Zy and Av are **not** stored and are derived.

Yield strength by thickness is stored per grade (`AllGrades`): e.g. S 275 → 275/265/255/245/235/225/215/205 N/mm² for t ≤ 16/40/63/80/100/150/200/250 mm; S 355 → 355/345/335/325/315/295/285/275. **Verified in printouts:** 457x191 UB 89 S355 (T = 17.7 mm) is designed with fy = 345; 305x165 UB 40 S275 (T = 10.2) with fy = 275.

---

## 3. Design briefs (what set of checks a member gets)

A *design brief* is a set of code checks attached to a member. Briefs are applied manually (Integrated Design menu), by "Add Multi-Storey Continuous/Simple Construction (current view)", or via Steel Member Design Groups (Pro).

| Brief | Checks performed | Ignores | Typical use |
|---|---|---|---|
| **Beam and Beam-Portion** | local moment capacity, lateral-torsional buckling, shear, deflection, slenderness ratio; optional torsion | axial force, minor-axis bending (both noted in the output title) | simply supported / continuous beams |
| **Axial with Moments** (general) | everything above plus axial capacity, flexural buckling y-y and z-z, biaxial interaction (EC3 6.61/6.62), bolt-hole deductions, sway deflection | nothing | beams, columns, rafters; auto-applied to a single simply-supported member |
| **Axial with Moments + Appendix-G / Annex BB** (merged into one brief from 2024) | as above plus stability of the unrestrained compression flange between torsional restraints (BS 5950 Annex G / EC3 Annex BB.3) | | rafters, beams with one flange restrained |
| Columns in Simple Construction | axial + nominal moments from beam reactions at 100 mm eccentricity | analysis moments | pinned columns |
| Discontinuous Strut and Tie | axial tension / compression, buckling, slenderness | bending | bracing, truss internals |

Option "AutoChange Beam Check to C&M when more critical" switches a Beam-Portion brief to Axial with Moments automatically. "Beam to C&M" icon does it manually.

---

## 4. Design flow (order the software follows)

1. **Model and analyse** in MasterFrame (elastic, optionally P-delta or plastic) or in MasterBeam (continuous beam sub-frame). Loads are unfactored and assigned to load groups (D0-D9 dead, L1-L9 live, S wind/snow, N notional, UT = loads that always carry factor 1.0, used with torque eccentricities).
2. **Load cases are generated from the selected code**: EC path prints e.g. `1 UT + 1.35 D1 + 1.5 L1`, `1 UT + 1.25 D1 + 1.5 L1 + 0.75 S3` (EN 1990 6.10b with UK ξ = 0.925 → 1.25), `+ 1 N1` (notional/EHF); SLS cases `1.0 D1 + 1.0 L1`, "Live only". BS path regenerates combinations to BS factors.
3. **Attach a brief**; the software auto-detects which cases are ultimate ("Auto Design Load Cases 1-2, 4-7, ...") and which are serviceability; with AutoCase on it takes the most critical of each.
4. **Member forces** are taken from the analysis of the design case: axial (T/C), torque, shear y-y/z-z at each end, end moments, maximum moment and its position, maximum **in-span** deflection from the governing SLS case.
5. **Portions**: the member is split at lateral restraints (Portion 1..n lengths, up to three "Start at" groups; "Auto Restrain at Connected Members" places them at incoming beams). Each portion is checked separately with its own moment diagram; the design output shows one portion at a time.
6. **Checks** (section 5 below) in printed order: classification → local capacity → (compression resistance) → equivalent uniform moment factors → lateral buckling → (buckling interaction) → (torsion) → deflection.
7. **Unity bar** summarises: `N_Ed/N_pl.Rd | Local | UNyz | UMyz | Ax+M_6.61 | Ax+M_6.62 | Deflection | Max` (Axial with Moments) or `MA/Mc | M_y.Ed/M_b.Rd | Deflection | Max` (Beam-Portion). Values > 1 are red, panel background blue = fail. **Max excludes the deflection ratio** (UB 40 example: Max 1.109 while Deflection 1.246).
8. **AutoSize**: trial of all sections of the chosen type from the smallest (sorted by depth or by weight) until every check of the brief passes; variants: current member, all visible members independently, all visible members same section. AutoSize does not consider web-opening dimensional/stress failures.
9. **Colour check of a whole model** (Auto Check): red = locally overstressed, cyan = needs more lateral restraint, black = passes, grey = not checked.

---

## 5. Checks and formulas: EC3 path (as printed by the software)

Notation is MasterSeries' own. "Printed" = transcribed from screenshots; "Code" = EN 1993-1-1 clause given for orientation where the software does not print it.

### 5.1 Classification
```
Section (89.3 kg/m)              457x191 UB 89 [S 355]
Class = Fn(b/T, d/t, fy, N, My, Mz)   5.42, 38.82, 345, 0, 258.45, 0   (Axial: Non-Slender)   Class 1
Auto Design Load Cases           1-2, 4-7, 10-11, ...
```
* b/T = (B/2)/T of the outstand flange; d/t = depth between fillets / web thickness (verified: 191.9/2/17.7 = 5.42; 407.6/10.5 = 38.82).
* Class depends on N, My, Mz → web classified under combined compression and bending (Table 5.2). Class-limit values are not printed. "Axial: Non-Slender" = no effective-area reduction for compression.

### 5.2 Local capacity (cross-section)
```
Vy.Ed/Vpl.y.Rd                  140.233 / 1509.13 =                     0.093   Low Shear
Mc.y.Rd = fy.Wpl.y/γM0          345 x 3069.8/1                    1059.081 kN.m
My.Ed/Mc.y.Rd                   428.055 / 1059.081 =                    0.404   OK
```
Axial with Moments adds:
```
Vz.Ed/Vpl.z.Rd                  0.136 / 2541.93 =                       0       Low Shear
Mc.z.Rd = fy.Wpl.z/γM0          345 x 671.8/1                       231.771 kN.m
Npl.Rd = Ag.fy/γM0              205.54 x 345/1 =                   7091.13 kN   (No bearing / block tearing design)
n = NEd/Npl.Rd                  140.623 / 7091.13 =                     0.020   OK
Wpl.N.y = Fn(Wpl.y, Avy, n)     3778.4, 90.212, 0.02                3778.4 cm3
MN.y.Rd = Wpl.N.y.fy/γM0        3778.4 x 345/1                     1303.548 kN.m
Wpl.N.z = Fn(Wpl.z, Avz, n)     671.8, 127.616, 0.02                 671.8 cm3
MN.z.Rd = Wpl.N.z.fy/γM0        671.8 x 345/1                       231.771 kN.m
(My.Ed/MN.y.Rd)^α + (Mz.Ed/MN.z.Rd)^β   (432.173/1303.548)^2 + (0.297/231.771)^1 =   0.111   OK
```
* Vpl.Rd = Av fy /(√3 γM0) **[INFERRED, verified]**: for 305x165 UB 40, Av = A − 2bT + (tw + 2r)T = 2007 mm² gives 318.8 kN, printed 318.775.
* "Low Shear": no moment reduction for shear; threshold not printed (EC3 6.2.8: VEd ≤ 0.5 Vpl.Rd).
* Wpl.N = reduced plastic modulus for axial load (6.2.9.1, n = NEd/Npl.Rd, using the shear area as the web-area parameter) — formula not printed; with n ≈ 0 it returns Wpl.
* Exponents α = 2, β = 5n ≥ 1 (6.2.9.1(6)), printed as 2 and 1 in all examples.
* Beam-Portion brief prints only the three-line version and titles it "Moment Capacity Check M.c.y.Rd" (suffix "- Fully Restrained Beam" when effective length = Full Rest).
* Bolt holes: F-Holes/F-Diameter, W-Holes/W-Diameter, bolts-in-row/pitch/edge distance deduct area (tutorial: 22 mm hole = 20 mm bolt + 2 mm clearance "deducts a 22 mm hole from the plate in tension"). Net-section formula not printed.

### 5.3 Compression resistance (Axial with Moments only)
```
Ley = Ky.Ly                      1 x 9 =                                  9
λy = √A.fy/Ncr                   √205.54x345/20413.61                    0.589
Nb.y.Rd = Area.χ.fy/γM1          205.54x0.894x345/10/1 =            6339.182 kN   Curve a
Lez = Kz.Lz                      1 x 9 =                                  9
λz = √A.fy/Ncrz                  √205.54x345/1087.59                     2.552
Nb.z.Rd = Area.χ.fy/γM1          205.54x0.134x345/10/1 =             953.540 kN   Curve b
```
* Ncr = π²EI/Le² (verified: 457x191 UB 161, Iy = 79800 cm⁴, Le = 9 m → 20419 kN). χ from 6.3.1.2 curves (verified: λ̄ = 0.589 curve a → 0.894; λ̄ = 2.552 curve b → 0.134). Curve selection per Table 6.2 (h/b, T).
* Lx, Ly = 0 → full member length; Kx, Ky factors default 1.0.

### 5.4 Equivalent uniform moment factors
```
C1 = fn(M1, M2, Mo, ψ, μ)        0.2, 189.0, 42.8, 0.001, 0.226        1.351   Uniform
C1 = fn(M1, M2, Mo, ψ, μ)        0.1, 0.1, 258.3, 0.985, 300.000       1.127   Uniform
C1 = fn(M1, M2, ψ)               0.1, 427.9, 0.000                     1.750   Not Loaded
CmLT = 0.95+0.05αh               Mh = 0.18, Ms = 319.24, ψ = 0.989, αs = 0.001   0.95   Table B.3
Cmz = Max(0.6+0.4ψ, 0.4)         M = 0, ψ = 1.000                      1       Table B.3
Cmy = 0.95+0.05αh                Mh = 0, Ms = 319.24, ψ = 1.000, αs = 0.000     0.95   Table B.3
```
* C1 is computed automatically per portion from the end moments M1, M2, the mid-portion moment above the chord Mo, ψ = M1/M2 and μ = Mo/M2 (capped at 300) **[INFERRED from the printed numbers]**. The values 1.127 (UDL, pinned) and 1.75 (ψ = 0 end moments, "Not Loaded" = no in-span load) match NCCI SN003 tables **[INFERRED]**. User may override C1, C2, C3 (0 = automatic).
* Cmy, Cmz, CmLT from Table B.3 (Annex B, Method 2) using αh = Mh/Ms, αs; printed with the "Table B.3" tag.

### 5.5 Lateral-torsional buckling
```
Le = 1.00 L                      1 x 7.5 =                                7.5 m
Mcr = Fn(C1, Le, Iz, It, Iw, E)  1.127, 7.500, 2092, 90.71, 1.035, 210000   330.292 kN.m
λLT = √W.fy/Mcr                  √2013.6 x 345 / 330.292                1.450
χLT = Fn(λLT, λLT5950)           1.450, 1.520                           0.409   Curve c
χLT.mod = Fn(χLT, λLT, kc, f)    0.409, 1.450, 0.942, 0.996             0.410   6.3.2.3
Mb.Rd = χWpl.y.fy ≤ Mc.y.Rd      0.410 x 2014 x 345 ≤ 694.692 =       285.104 kN.m
My.Ed/Mb.Rd                      258.446 / 285.104                      0.906   OK
```
* Le = k × portion length; k from the drop list (Full Rest, 0.5L … 10L, 0.7L, 0.85L?, 0.9L, 0.95L, 1.0L, 1.2L, and 1.0L+2D, 1.2L+2D, 1.4L+2D for destabilising/cantilever cases per BS 5950 Table 13/14 style). Different factors may be set at End 1 and End 2 ("As End1" copies); with different settings **the average of the two is used**.
* Mcr **[INFERRED, verified]** = C1 π²EIz/Le² √(Iw/Iz + Le²GIt/(π²EIz)) with G = E/2.6: gives 330.26 (printed 330.292), 3865.7 (3864.757), 128.93 (128.931), 1884.3 (1884.332). zg (load height above shear centre, mm, +ve above) enters when non-zero; C2, C3 are then used.
* χLT **[verified]** = 6.3.2.3 rolled-section method with UK NA λ̄LT,0 = 0.4, β = 0.75, curve b (h/b ≤ 2) or c (h/b > 2): λ̄ = 1.450 curve c → 0.4087. The second argument "λLT5950" (1.520) is the BS 5950-1 equivalent slenderness, computed in parallel (see §6).
* χLT,mod = χLT/f, f = 1 − 0.5(1 − kc)[1 − 2(λ̄LT − 0.8)²] ≤ 1, kc from Table 6.6 **[verified]**: 0.409/0.9955 = 0.4105.
* Mb.Rd capped at Mc.y.Rd (printed "≤"). Unity shown as M_(y.Ed)/M_(b.Rd).
* "Full Rest" skips this block and prints "Mb.Rd = Mc.y.Rd  Fully Restrained".

### 5.6 Buckling interaction (Axial with Moments, EC3 6.61 / 6.62, Annex B)
```
UN.y = NEd/(χy.NRk/γM1)          0.086 / 1762.575                       0.000   OK
UN.z = NEd/(χz.NRk/γM1)          0.086 / 1762.575                       0.000   OK
UM.y = My.Ed/(χLT.My.Rk/γM1)     25.816 / 256.914                       0.100   OK
UM.z = Mz.Ed/(Mz.Rk/γM1)         0 / 32.234                             0.000   OK
kyy = Cmy{1+(λy−0.2)UN.y}                                               0.400
kzz = Cmz{1+(2λz−0.6)UN.z}                                              1.000
kyz = 0.6kzz                                                            0.600
kzy = 0.6kyy                                                            0.240
UNy + kyy.UM.y + kyz.UM.z        0.000+0.400x0.100+0.600x0.000          0.040   OK
UNz + kzy.UM.y + kzz.UM.z        0.000+0.240x0.100+1.000x0.000          0.024   OK
```
* Interaction factors are Annex B Table B.1 (members not susceptible to torsional deformation, Class 1/2) — the printed kzy = 0.6 kyy form. The caps (1 + 0.8 UN.y etc.) are not printed. For LTB-susceptible members Table B.2 kzy applies **[not shown in any screenshot]**.
* Option "Print both Simplified & More Exact" (ticked by default) prints two variants; the Annex-BB brief shows a "MoreExact" unity column.
* Unity bar columns "Ax+M_6.61" and "Ax+M_6.62" are these two lines.

### 5.7 Annex BB.3 / Appendix G stability of unrestrained compression flange
```
Tension Side Lateral Restraint Spacing Check, Lm
Lm = fn(NEd, A, C1, Wpl.y, IT)   129.7, 231.1, 1.75, 5030.3, 373.4      4.621 m
Lm < s                           4.621 < 7.032 - Effect of tension side lateral restraints ignored
Compression Resistance N.b.Rd
λz = √A.fy/Ncrz                  √231.14x345/5309.11                     1.226
Nb.z.Rd = Area.χ.fy/γM1          231.14x0.464x345/10/1 =            3703.654 kN   Curve b
is = Fn(iy, iz, a)               230.9, 74.0, 330.4                    242.5 mm
NcrT = Fn(E, Iz, It, Iw, Lt, a, is)   210, 12667, 373, 8.760, 7032, 0, 242    11375.9 kN
λT = √A.fy/NcrT                  √231.14x345/10/11375.89                 0.837
Nb.T.Rd = Area.χ.fy/γM1          231.14x0.701x345/10/1 =            5591.647 kN   Curve b
Lateral Buckling Resistance Moment Mb
Mcr0 = fn(Lt, E, Iz, IT, Iw)     7.032, 210, 12667, 373.4, 8.76       1884.332 kN.m
Mcr = C1·Mcr0                    1.750 · 1884.3                        3297.566 kN.m
λLT = √W.fy/Mcr                  √5030.3 x 345 / 2056.722               0.725
χLT = Fn(λLT, φLT, β)            0.725, 0.904, 0.750                    0.835   Curve a
χLT.mod = Fn(χLT, λLT, kc, f)    0.835, 0.725, 0.756, 0.881             0.835   6.3.2.3
Mb.Rd = χWpl.y.fy                0.835 x 5030 x 345                   1449.912 kN.m
Combined Axial and Bending 6.62   ... unity "MoreExact" 0.430
```
* Lm = BB.3.1.1 eq (BB.5) stable length between tension-flange restraints (arguments match: NEd, A, C1, Wpl.y, IT). If Lm < actual spacing s, tension-side restraints are ignored.
* is² = iy² + iz² + a² (BB.8), NcrT (BB.9) with a = distance from centroid to restraint axis (user input "a"), Lt = spacing of torsional restraints (Torsional Restraints tab, up to 9 portions in 3 groups); Nb.T.Rd on curve b; Mcr0 and Mcr = C1·Mcr0 (BB.3.3.2-style); χLT with φLT and β printed; option "Check to Point of Contraflexure".
* **[UNCERTAIN]** the mapping of the printed χLT = 0.835 with λ̄ = 0.725, "φLT" = 0.904, β = 0.75 does not reproduce from 6.3.2.3 curve a (which gives 0.904); the 0.904 appears to be the unmodified χLT and 0.835 a further reduction whose rule is not documented. Note the λLT line divides by 2056.722, not by Mcr = 3297.566 — also unexplained.
* Options: elastic or plastic stability analysis (AutoSelect follows the analysis type), restraint position relative to the member β angle, λLT table selection (BS method), top flange in tension/compression.

### 5.8 Torsion (optional, default "Ignore Torsion")
```
Torsion Design
J, H, a, Qf, Qw                  90.71 cm4, 1.035 dm6, 1723 mm, 357.8 cm3, 1018 cm3
Wn0, Sw1                         213.8 cm2, 1816 cm4
Torsion Bending Design @ 3.750   (checks at the critical position follow; cut off in screenshot)
```
* Method: SCI P385 (EC) / P057 symbols: a = √(EH/GJ) torsional bending constant (verified 1722 mm), Qf, Qw statical moments, Wn0 normalised warping function, Sw1 warping statical moment. Warping stiffness is included in the design even though the frame analysis only used St Venant stiffness (manual note).
* Inputs: end warping restraint drop list (e.g. "No End Warping"), Kt effective-length factor for torsion (0 = actual length), **Theta Limit default 2° (SCI recommendation)**, "Check Torsion (Global Key)" switch. Torque is applied in MasterFrame via "torq eccentricity" from the shear centre; loads on angles/channels are assumed through the shear centre unless offset.

### 5.9 Slenderness limit
* "Lambda Limit" input (default 180 in Axial with Moments; 250 in the MasterBeam Beam-Portion screenshot). A BS 5950:1990 check retained by choice; can be globally ignored via Options > Ignore Slenderness limits. Formula (L/r vs limit) not printed.

### 5.10 Deflection
```
Deflection Check - Load Case 3
In-span δ ≤ Span/360             15.57 ≤ 4500 / 360                    15.57 mm   Warning
```
* Uses the **in-span deflection** = displacement relative to the straight line joining the displaced end nodes (technical note 17/03/2022), from the worst SLS case (AutoCase). Nodal displacements (sway, apex drop) are not part of this check; from 2022 an optional "Def Limit Sway" for lateral sway at column heads exists.
* Def Limit default 360. Entering 1-30 selects a row of the Deflection Limits table (patterns: separate span/x for Live, Super+Live, Dead+Super+Live, Dead; optional absolute mm limit e.g. "360; 10").
* Cantilevers: software tests whether a member is a cantilever and switches the "Non-Cantilever" drop list; user must verify (technical note 06/12/2018). Cantilever deflection only updates after re-analysis because it includes support rotation.
* Unity = δ / (Span/limit); shown in the bar but excluded from "Max".

---

## 6. BS 5950-1 path: what is documented

No BS 5950 calculation printout appears in the manual or tutorials. Documented BS-specific behaviour:

| Item | Documented statement | Source |
|---|---|---|
| Moment capacity | "Mc = Py·S ≤ 1.2 py" check uses the **FL/UL** input (ratio factored/unfactored load, default 1.2) — i.e. Mc = py S ≤ (FL/UL) py Z [cl 4.2.5.1 with the average load factor replacing 1.2 for orientation]. Not used in EC design. | 2070, 2080, 2100 |
| λLT tables | Drop list "AutoSelect" picks the appropriate BS 5950-1 table for λLT (n, u, v, x method); user may force a table. The EC printout also computes λLT5950 in parallel. | 2070, 2080, 2090 |
| Effective lengths | Same drop list as EC incl. 1.0L+2D, 1.2L+2D, 1.4L+2D (Table 14 cantilever/destabilising forms). | T01-3 p54 |
| Slenderness limit | Originally BS 5950 cl 4.7.3.2 style limit; kept as "Lambda Limit". | 2070 |
| Classification labels | Plastic / Compact / Semi-compact / Slender. | T01-1 p20 text |
| Load combinations | Regenerated to BS factors on switching code; re-analysis required. | T01-1 txt 428-436 |
| Torsion | SCI P057 (BS) / P385 (EC). | technote, 2070 |
| Web openings | SCI P068 (BS, old) / P068 revised / P355. | 2170 |
| Section data | u, x, H (warping), J stored per section for the BS LTB method. | DB schema |

Everything else on the BS path (pb from Table 16/17, Mb = pb Sx, mLT, shear Pv = 0.6 py Av, deflection) is **not documented**; expect the standard BS 5950-1:2000 formulas but confirm by running the software.

---

## 7. Inputs, options and defaults (steel briefs)

| Input | Default | Effect | Source |
|---|---|---|---|
| C1, C2, C3 | 0 (= automatic) | override EC LTB moment-distribution factors | 2070 |
| zg (mm) | 0 (load at shear centre) | destabilising (+) / stabilising (−) load height in Mcr | 2070 |
| Effective length End 1 / End 2 | Full Rest / As End1 | LTB effective length factor; average if different | 2070 |
| λLT table | AutoSelect | BS 5950 table choice | 2070 |
| Top flange / web in tension (or long leg for angles) | as analysed | non-doubly-symmetric handling | 2070 |
| Lateral restraints Portion 1-9, Start at ×3, Increment, Auto Restrain at Connected Members | 0 | portion lengths; Portion 1 alone = equal spacing | 2070 |
| Kt-factor | 0 (= actual length) | torsion effective length | 2080 |
| Lx, Ly | 0 (= full length) | flexural buckling lengths | 2080 |
| Kx, Ky | 1.0 | effective length coefficients | 2080, T01-3 |
| Theta Limit | 0 when torsion ignored; 2° when active | rotation limit | 2070 |
| Lambda Limit | 180 (Axial+M), 250 (MasterBeam Beam-Portion) | slenderness | screenshots |
| Spacing (mm), Lv (m) | 0 | double members: gap and connector spacing | 2070 |
| FL/UL | 1.2 | BS Mc cap | 2070 |
| Def Limit | 360 | span/limit or pattern row 1-30 | 2070 |
| Def Limit Sway | — | column head sway (2022+) | 2080 |
| Non-Cantilever / Cantilever | auto-detected | effective length & deflection treatment | 2080 |
| F/W holes and diameters, bolts in row, pitch P1, edge distance | 0 | net section (angles per EC3-1-8 3.10.3) | 2080, 2110 |
| Additional loads | off | extra loads on the brief | screenshot |
| Print both Simplified & More Exact | on | two interaction variants printed | screenshot |
| AutoChange Beam to C&M | on/off | switch to Axial with Moments when more critical | 2070, 1950 |
| Torsion drop list | Ignore Torsion | warping restraint condition | 2070 |
| Global options | — | Check Torsion (global), Use Column Nominal Moments as minimum, Ignore Slenderness limits, Check to Point of Contraflexure, Reverse BM display, Braced Frame (SANS 13.8.2), New Plastic Analysis | 1950 |
| H.min / H.max | 0 | depth bounds for AutoSize | T04-1 |
| Compound plate: thickness, width or projection, offset | — | compound section | 2490 |
| Cellular: Do, S (mm or ratio of D), top distance, cut gap, filled cells, clear ends | central | new depth printed at start of calcs | 2490 |
| Web openings: X, diameter/width/depth, top distance, elongation flag, stiffener area and offset | — | P355/P068 checks; colours red (stress fail), blue (dimensional fail), green (critical, full calc), white (summary) | 2160 |

---

## 8. Stated assumptions and limitations

* Beam-Portion brief ignores axial force and minor-axis moment; engineer must choose the right brief.
* Lateral restraints restrain the minor axis only; a portion is checked "assuming a lateral restraint" at its ends.
* Frame analysis includes torsional (St Venant) stiffness but not warping stiffness; design includes warping (SCI P385).
* Deflection check = in-span deflection only; nodal/sway limits must be checked separately.
* Pure encastré cantilevers "rarely exist" — model the back span; cantilever detection can fail with high free-end shear.
* AutoSize ignores opening failures; stiffener plate/weld sizes suggested for openings are for the engineer to check.
* Switching design code inside the module reuses the existing analysis; re-analyse.
* "Columns in Simple Construction" ignores analysis moments.

---

## 9. Test vectors (EC3, UK NA) for re-implementation checks

| Case | Section / grade | L or portion | Loads / forces | Printed results |
|---|---|---|---|---|
| T04-1 initial | 305x165 UB 40, S275, fy 275 | 4.5 m simply supported, Full Rest | D 16 + self-wt 0.400, L 20 kN/m; PY D 20 @2.1, D 14 @3.6; PDLY D10/L5 1-2 m; PTRY D 12→20 kN/m 3.6-4.3; ULS 1.35D+1.5L | R = 151.25/165.41 kN; My.Ed 190.043 kN.m @2.1; Vy.Ed 20.751, Vpl 318.775 (0.065); Mc.y.Rd 171.353; MA/Mc 1.109 FAIL; δ 15.57 mm vs 12.5 (1.246) |
| T04-1 final | 305x165 UB 54, S275 | portion 0-2.25 m, Le = 1.0L = 2.25 m | as above (self-wt 0.536) | My.Ed 190.504; Vpl 421.543; Mc.y.Rd 232.678; C1 = 1.351 (M1 0.2, M2 189.0, Mo 42.8); unity 0.819 / 0.819; δ 11.35 mm (0.908) |
| T01-1 | 457x152 UB 52, S275 | 6 m, Le = 1.0L | D 15 + L 20 kN/m UDL, L PY 40 @3.0, ULS 1.35D+1.5L, density 77.01 kN/m³ | N 0.914T; V 182.828; My.Ed 319.243 @3.0; δ 11.529; Vpl 579.02; Mc 301.4; Npl 1832.6; local 1.122 FAIL; C1 1.127, CmLT 0.95, Cmz 1, Cmy 0.95; Mcr(1.127, 6, 647.8, 21.37, 0.3097, 210000) = 128.931 kN.m; unity bar 0.000/1.122/0.000/2.800/2.660/2.800/0.692, Max 2.800 |
| Manual 2070 | 457x191 UB 89, S355 (fy 345), with torsion | 7.5 m, Le = 1.0L | 1 UT + 1.25 D1 + 1.5 L1 + 0.75 S3; D 14.13 + L 12 kN/m | V 137.84; My.Ed 258.446 @3.75; δ 12.91; Vpl 1021.758; Mc 694.692 (0.372); C1 1.127; Mcr 330.292; λLT 1.450 (λLT5950 1.520); χLT 0.409 c; χmod 0.410 (kc 0.942, f 0.996); Mb.Rd 285.104; 0.906 OK; J 90.71 cm⁴, H 1.035 dm⁶, a 1723 mm; unity 0.372/0.906/0.620 |
| Manual 2070 (primary) | 457x191 UB 133, S355 | portion 0-3.0 m of 4.5 m, Le 1.0L | 1 UT + 1.25 D1 + 1.5 L1 + 1 N1; point loads from secondaries | V 145.14; My.Ed 428.055 @4.44; Vpl 1509.13; Mc 1059.081 (0.404); C1 1.750 "Not Loaded"; Mcr 3864.757; λLT 0.523 (BS 0.683); χLT 0.930 c; χmod 1.000 (kc 0.756, f 0.897); Mb.Rd = Mc 1059.081; 0.404 OK |
| Manual 2080 | 457x191 UB 161, S355 | 9 m, Full Rest, Kx = Ky = 1 | N 140.62C/191.42C; My 432.70 @4.5; Mz −0.41; δ 16.41 | Vpl.y 1796.895, Vpl.z 2541.93; Mc.y 1303.548, Mc.z 231.771; Npl 7091.13; n 0.020; biaxial 0.111; λy 0.589 → χ 0.894 (a) Nb.y 6339.182; λz 2.552 → χ 0.134 (b) Nb.z 953.540; unity 0.020/0.111/0.201/0.667/0.672/0.820/0.656, Max 0.820 |
| Manual 2090 | 533x312 UB 182, S355 | 0-7.032 m, Annex BB | 1 UT + 1.25 D0 + 1.25 D1 + 1.5 L1 + 0.75 S4 + 1 N1; N 129.67C; M −1199.23 / 618.90 | Lm 4.621 m; λz 1.226 χ 0.464 b Nb.z 3703.654; is 242.5; NcrT 11375.9; λT 0.837 χ 0.701 Nb.T 5591.647; Mcr0 1884.332, Mcr 3297.566; λLT 0.725; χLT 0.835 a; Mb.Rd 1449.912; MoreExact 0.430 |
| T01-3 column | 203x203 UC ~ (A 49.65 cm², Wpl 723.7), S355 | Full Rest | N 5.206C, My 25.816 | n 0.003; MN.y 256.914; biaxial 0.01; λy 0.124 Nb.y 1762.575 a; kyy 0.4, kzz 1.0, kyz 0.6, kzy 0.24; 6.61 = 0.040, 6.62 = 0.024; Max 0.100 |

---

## 10. Not documented (confirm by running the software)

1. BS 5950-1 and SANS calculation lines (pb, Mb, mLT, Pv, Table 16/17 selection logic).
2. The class-limit values and the exact web classification under N + M.
3. Wpl.N reduction formula and the net-section deduction formula for bolt holes.
4. C1 function: the ψ/μ table it interpolates (looks like NCCI SN003) and the C2, C3 usage with zg ≠ 0.
5. Annex BB χLT reduction (0.904 → 0.835) and the 2056.722 divisor in the λLT line.
6. Annex B Table B.2 (torsionally susceptible) kzy form, and the caps on kyy/kzz.
7. Torsion check lines beyond the section constants (P385 stress and rotation checks).
8. Slenderness-limit line, web-opening calculation lines (P355), cellular-beam Vierendeel/web-post checks, compound and double-member property build-up.
9. Angle and channel LTB treatment (whether EC3 general method or BS 5950 Annex B/4.3.6 style).
10. What the DB coefficients Kx1..Kx4, nx, Ky1..Ky4, ny represent.
11. The 2024 merged Axial+Moment/Annex-BB brief layout and the new restraint editor (post-2020 screenshots not available offline).

---

## 11. How to get the missing items

Run MasterKey Steel Design on the tutorial models (Tutor01-1, Tutor01-3, Tutor04-1) with the design code set to British, print "Print Selected Checks" to PDF for one Beam-Portion, one Axial with Moments (with torsion on and zg ≠ 0), one Annex-BB brief, one angle, one channel and one RHS, then add the printouts to `sources/` and extend sections 5-6 from them.

---

## 12. Numerical verification performed (script, 2026-09-19)

| Quantity | Formula used | Computed | Printed |
|---|---|---|---|
| Mcr UB 89 | C1 π²EIz/L² √(Iw/Iz + L²GIt/π²EIz), G = E/2.6 | 330.26 | 330.292 |
| Mcr UB 133 | same | 3865.7 | 3864.757 |
| Mcr UB 52 | same | 128.93 | 128.931 |
| Mcr0 UB 182 | same, C1 = 1 | 1884.3 | 1884.332 |
| χLT UB 89 | 6.3.2.3, λ̄0 0.4, β 0.75, α 0.49 | 0.4087 | 0.409 |
| χLT,mod UB 89 | χ/f, kc 0.942 | 0.4105 | 0.410 |
| χy, χz UB 161 | 6.3.1.2 curves a, b | 0.894, 0.134 | 0.894, 0.134 |
| Ncr,y UB 161 | π²EIy/L², Iy 79800 cm⁴, L 9 m | 20419 kN | 20413.61 |
| Vpl.y.Rd UB 40 | Av fy/√3, Av = A − 2bT + (tw+2r)T | 318.8 kN | 318.775 |
| a (torsion) UB 89 | √(EH/GJ) | 1722 mm | 1723 |
| b/T, d/t UB 89 | (B/2)/T, d/tw | 5.42, 38.82 | 5.42, 38.82 |
| fy UB 89 S355 | grade table, T 17.7 > 16 mm | 345 | 345 |
