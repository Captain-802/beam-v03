# EC3 steel beam: complete check and trigger list

Compiled 19 Sep 2026 from a clause-by-clause scan of EN 1993-1-1:2005 sections 2-7 and Annexes A, B, BB, plus EN 1993-1-5 headings. Clause numbers refer to EN 1993-1-1 unless prefixed. UK NA applies (γM0 = γM1 = 1.0, γM2 = 1.10 for fracture; λ̄LT,0 = 0.4, β = 0.75 for rolled sections; Annex A or B allowed).

Status vocabulary for the coverage matrix: IMPLEMENTED (computed and in the verdict), BLOCKING (detected and PASS refused with a NOT VERIFIED message), ADVISORY (noted, not in the verdict), MISSING (trigger not detected at all), N/A (cannot occur in this tool).

## 1. Modelling, analysis and classification (section 5)

| # | Check or decision | Clause | Triggered by |
|---|---|---|---|
| 1.1 | Load position relative to shear centre and centroid; convert offsets to torque, load height, biaxial components | 6.2.7(3), 6.3.2.2(2) | every load on channels, angles, tees, or any load off the web plane or off the shear-centre level |
| 1.2 | Static equilibrium EQU: uplift at back spans, overturning of cantilevers, hold-down | 2.4.4 | cantilevers, hinges, unbalanced patterns |
| 1.3 | Combinations and patterns for ULS and SLS envelopes; applied moments and settlement as actions | EN 1990 | always; adverse and relieving spans, cantilever with back span unloaded |
| 1.4 | Structure not a mechanism after releases; equilibrium of released DOF; hinge rotation demand | 5.1, 5.4 | internal hinges, moment releases |
| 1.5 | Second-order effects, αcr ≥ 10 test, P-Δ from sway frames into the member end moments | 5.2.1, 5.2.2, 6.3.3(3) | axial compression, sway systems |
| 1.6 | Imperfections: global sway, member bow, LTB imperfection k·e0,d when second-order LTB analysis is used | 5.3.2, 5.3.4 | second-order analysis instead of buckling curves |
| 1.7 | Bracing-system forces: qd from NEd = MEd/h, splice forces αm NEd/100, plastic-hinge forces Qm | 5.3.3, 6.3.5.2(5) | every lateral restraint the LTB check relies on |
| 1.8 | Plastic global analysis conditions: Class 1 at hinges, stiffener within h/2 if transverse force > 10 % Vpl, web and flange rules for 2d each side, holes rule | 5.6 | plastic hinges, moment redistribution |
| 1.9 | Classification of every compression part under the actual stress distribution of each case (web with α or ψ under M + N, tee stem, angle legs); Class 4 → effective widths; effective Class 2 web; flanges-only design; Class 4 as Class 3 with reduced ε for section checks only | 5.5.2, 6.2.2.4, 6.2.2.5, EN 1993-1-5 §4 | always; class changes between hogging and sagging and with N |
| 1.10 | Shear lag effective width in analysis and resistance | 6.2.2.3, EN 1993-1-5 §2.2, §3 | wide flanges, b0 > Le/50, plated or box sections |
| 1.11 | Material: ductility, fracture toughness thickness limit for service temperature, through-thickness (Z) quality for thick welded flanges, durability | 3.2.2, 3.2.3, 3.2.4, 4, EN 1993-1-10 | thick plates, welded built-up sections, external or cold service |

## 2. Cross-section resistance at every critical section (section 6.2, EN 1993-1-5)

| # | Check | Clause | Triggered by |
|---|---|---|---|
| 2.1 | Bending about each principal axis, Mc,Rd by class (Wpl, Wel,min, Weff,min); principal axes for angles | 6.2.5 | always |
| 2.2 | Holes: tension-flange criterion Af,net 0.9fu/γM2 ≥ Af fy/γM0, staggered-hole net area, angles with holes in both legs | 6.2.5(4-6), 6.2.2.2 | bolted connections and splices in the span |
| 2.3 | Shear, each axis, Vpl,Rd = Av fy/√3, Av by section type (I, channel, tee, welded, RHS, CHS) | 6.2.6(2-3) | always |
| 2.4 | Elastic shear verification τEd = VS/It where Vpl,Rd cannot be used | 6.2.6(4-5) | non-standard, tapered or perforated sections |
| 2.5 | Shear buckling of unstiffened web when hw/tw > 72ε/η; contribution of flanges, rigid or non-rigid end post | 6.2.6(6), EN 1993-1-5 §5 | slender webs, plate girders, deep cellular tees |
| 2.6 | Torsion TEd ≤ TRd: split into St Venant and warping by elastic analysis of the member and its end warping conditions; stresses τt, σw, τw; bimoment BEd | 6.2.7(1-6), SCI P385 | any torque |
| 2.7 | Torsion simplifications: hollow sections neglect warping, open sections may neglect St Venant; hollow-section TRd from plate shear strength | 6.2.7(7-8) | by section type |
| 2.8 | Shear reduced for torsion Vpl,T,Rd (separate formulae for I, channel, hollow) | 6.2.7(9), 6.2.6(8) | torque with shear |
| 2.9 | Cross-section distortion excluded from 6.2.7; distortional check required otherwise | 6.2.7(1), EN 1993-1-3 | thin-walled boxes, cold-formed, slender open sections |
| 2.10 | Bending with shear: no reduction if VEd ≤ 0.5 Vpl,Rd; else ρ = (2VEd/Vpl,Rd − 1)² on fy of the shear area; ρ with Vpl,T,Rd when torsion present; My,V,Rd alternative | 6.2.8 | point loads, hinges, continuous supports, notched ends |
| 2.11 | Bending with axial: MN,Rd (I, H, RHS, box, solid); no-reduction limits 6.33 to 6.35; Class 3 stress check; Class 4 with eN shift moments | 6.2.9.1-3 | any axial force |
| 2.12 | Biaxial bending (My/MN,y)^α + (Mz/MN,z)^β ≤ 1, exponents by section type, only for the biaxial case | 6.2.9.1(6) | inclined, horizontal or minor-axis loads |
| 2.13 | Bending, shear and axial together: reduced fy when VEd > 0.5 Vpl,Rd | 6.2.10 | all three present |
| 2.14 | Elastic yield criterion σx, σz, τ at a critical point (von Mises) | 6.2.1(5) | torsion plus bending, transverse loads, Class 3 and 4, anywhere resultants cannot be combined |
| 2.15 | Linear summation N/NRd + My/My,Rd + Mz/Mz,Rd ≤ 1 as the conservative fallback | 6.2.1(7) | any combination |
| 2.16 | Transverse forces on the web: Fy, ly, χF, load types a, b, c, length of stiff bearing ss; bearing stiffener if it fails | EN 1993-1-5 §6, 9.4 | every point load, reaction, prop, hanger |
| 2.17 | Interaction of shear, moment and axial in plated webs (η̄3 > 0.5 rule) | EN 1993-1-5 §7.1 | slender webs with high V and M |
| 2.18 | Interaction of transverse force with moment and axial (η2 + 0.8η1 ≤ 1.4) | EN 1993-1-5 §7.2 | point load at a section with high M |
| 2.19 | Flange-induced web buckling hw/tw limit | EN 1993-1-5 §8 | deep webs, curved or heavily flanged plate girders |
| 2.20 | Stiffeners: transverse and bearing stiffeners as columns, minimum stiffness, torsional buckling of stiffener outstands, cut-outs, welds; longitudinal stiffeners | EN 1993-1-5 §9 | any stiffener the checks above rely on |
| 2.21 | Reduced-stress method as the alternative for plated or non-uniform sections | EN 1993-1-5 §10, §2.5 | tapered, haunched, built-up |
| 2.22 | Web openings: Vierendeel, web-post buckling and shear, tee classification, local stiffening | SCI P355 | any opening, cellular or castellated beams |
| 2.23 | Notched or coped ends: reduced section bending and shear, block tearing, local LTB of the notched flange | SCI P358, EN 1993-1-8 3.10.2 | notched connections |
| 2.24 | Built-up and double members: interconnection spacing, battens or packs, welds between plate and flange | 6.4.4, 6.4.3 | compound, plated or paired sections |
| 2.25 | Net-section tension, angles through one leg, category C connections | 6.2.3, EN 1993-1-8 3.10.3 | axial tension, bracing-type members |
| 2.26 | Local flange bending and web yielding under a load hung from or bearing on one flange | SCI P385, connection rules | hangers, cranes, brackets |

## 3. Member stability and serviceability (sections 6.3, 6.4, 7, Annex BB)

| # | Check | Clause | Triggered by |
|---|---|---|---|
| 3.1 | LTB exemption tests: restrained compression flange; SHS, CHS, square box; λ̄LT ≤ λ̄LT,0 or MEd/Mcr ≤ λ̄LT,0² | 6.3.2.1(2), 6.3.2.2(4) | decide before any LTB calculation |
| 3.2 | Segment definition between restraints and supports; hinges are not restraints | 6.3.2.2(2) | always |
| 3.3 | Mcr for each segment from the real moment shape, load height, end restraint and section symmetry: closed form with C1, C2, C3 for doubly symmetric I; Wagner term for monosymmetric; channels only with load at shear centre; cantilevers from cantilever solutions or eigensolution; otherwise numerical | 6.3.2.2(2), NCCI SN003, P362 | every unrestrained segment; closed forms invalid for UVL, mixed loads, back-span moments, bottom-flange loads on cantilevers |
| 3.4 | χLT general case, curves a to d by Table 6.4, "other cross-sections" curve d | 6.3.2.2 | channels, tees, angles, monosymmetric, welded |
| 3.5 | χLT rolled-section method with λ̄LT,0, β, curves Table 6.5, f and kc modification, NA limits on scope | 6.3.2.3 | rolled or equivalent welded I and H only |
| 3.6 | Mb,Rd = χLT Wy fy/γM1 ≤ Mc,Rd, Wy by class; end holes ignored | 6.3.2.1(3-4) | always after 3.3 |
| 3.7 | Simplified compression-flange method λ̄f = kc Lc/(if,z λ1) ≤ λ̄c0 Mc,Rd/My,Ed, or Mb,Rd = kfl χ Mc,Rd | 6.3.2.4 | beams with discrete restraints in buildings; alternative to 3.3-3.6 |
| 3.8 | LTB with torsion interaction (Lindner criterion / EN 1993-6 Annex A) | SCI P385 §6 | any torque on an unrestrained segment |
| 3.9 | Flexural buckling y and z, curves Table 6.2 | 6.3.1.1-3 | axial compression |
| 3.10 | Torsional and torsional-flexural buckling, Ncr,T, Ncr,TF | 6.3.1.4 | axial compression in open sections: tees, angles, channels, cruciforms, thin I |
| 3.11 | Non-symmetric Class 4 under compression: additional moment from eN, then 6.3.3 or 6.3.4 | 6.3.1.1(2) | slender unsymmetric sections |
| 3.12 | Interaction 6.61 and 6.62 with kij from Annex A or B, Table 6.7 for Class 4 ΔM, χLT = 1 if not torsionally susceptible; scope limited to doubly symmetric, non-distortional sections; end cross-sections to 6.2 | 6.3.3 | bending with axial compression |
| 3.13 | General method: αult,k and αcr,op from analysis or FE, χop from λ̄op | 6.3.4 | tapered, haunched, complex supports, non-standard loading, monosymmetric with axial, anything outside 6.3.1-6.3.3 scope |
| 3.14 | Plastic-hinge LTB: restraint at rotated hinges (both flanges or slab), 2.5 % Nf,Ed connection force, restraint within h/2, stable length Lstable = 35εiz or (60 − 40ψ)εiz, haunch rule | 6.3.5 | plastic analysis or plastic hinges |
| 3.15 | Stable lengths with tension-flange restraints: Lm (BB.5), Lk (BB.6), Ls (BB.7, BB.8) with Cm, Cn for non-linear moment; haunched and tapered members | Annex BB.3 | purlin- or sheeting-restrained rafters and beams, hogging regions |
| 3.16 | Continuous lateral restraint by sheeting: shear stiffness S criterion (BB.2); continuous torsional restraint Cθ,k criterion (BB.3) including connection and distortional stiffness | Annex BB.2 | when claiming the roof or floor as restraint |
| 3.17 | Restraint force and stiffness for every discrete restraint (from 1.7) and torsional restraint at supports | 5.3.3, 6.3.5.2 | prerequisite of 3.3 to 3.7 |
| 3.18 | Built-up compression members: laced, battened, closely spaced, e0 = L/500 | 6.4 | double members with axial load |
| 3.19 | Vertical deflection per span and cantilever, including back-span rotation and precamber, limits per EN 1990 A1.4 and NA; effects of plastic redistribution at SLS | 7.2.1, 7.1(4) | always |
| 3.20 | Horizontal deflection | 7.2.2 | minor-axis or inclined loads |
| 3.21 | Twist under torsion, rotation limit | SCI P385, EN 1990 | any torque |
| 3.22 | Vibration and dynamic response | 7.2.3, EN 1990 A1.4.4 | floors, footbridges, machinery, cranes |
| 3.23 | Construction and erection stage: unbraced before slab or purlins, wet concrete, temporary loads | EN 1991-1-6 | always for composite or roof beams |
| 3.24 | Fatigue | EN 1993-1-9 | moving or cyclic loads |
| 3.25 | Fire | EN 1993-1-2 | project fire strategy |
| 3.26 | Connections and robustness: tying, end plates, bolts, welds, capacity design at hinges | EN 1993-1-8, EN 1991-1-7, 6.2.3(3) | always |
| 3.27 | Cold-formed members: distortional buckling and reduced properties | EN 1993-1-3 | CF hollow or thin sections |
| 3.28 | Class 4 circular hollow sections | EN 1993-1-6 | thin CHS |

## 4. MasterSeries printed order (the target brief layout)

From docs/MASTERSERIES_STEEL_BEAM_LOGIC.md section 5, the Axial-with-Moments brief prints, in this order:

1. Title: brief type, member, load case; "Member Loading and Member Forces" (combination string, itemised loads, moment sketch); "Member Forces in Load Case n and Maximum Deflection from Load Case m" table (axial, torque, shear y/z at each end, end moments y/z, max moment @ x, max deflection @ x).
2. "Classification and Effective Area (EN 1993: 2006)": section line with mass, `Class = Fn(b/T, d/t, fy, N, My, Mz)` with values, "(Axial: Non-Slender)", Class n; "Auto Design Load Cases".
3. "Local Capacity Check": `Vy.Ed/Vpl.y.Rd` (Low Shear tag), `Mc.y.Rd = fy.Wpl.y/γM0`, `Vz.Ed/Vpl.z.Rd`, `Mc.z.Rd`, `Npl.Rd = Ag.fy/γM0`, `n = NEd/Npl.Rd`, `Wpl.N.y = Fn(Wpl.y, Avy, n)`, `MN.y.Rd`, `Wpl.N.z`, `MN.z.Rd`, `(My.Ed/MN.y.Rd)^α + (Mz.Ed/MN.z.Rd)^β` with the substituted numbers, result and OK/Warning.
4. "Compression Resistance N.b.Rd": `Ley = Ky.Ly`, `λy = √A.fy/Ncr`, `Nb.y.Rd = Area.χ.fy/γM1` with "Curve a"; same for z.
5. "Equivalent Uniform Moment Factors C1, C.mLT, C.mz, and C.my": `C1 = fn(M1, M2, Mo, ψ, μ)` values → C1 with label (Uniform / Not Loaded); `CmLT = 0.95+0.05αh` etc. with Mh, Ms, ψ, αs and "Table B.3".
6. "Lateral Buckling Check M.b.Rd": `Le = k L`, `Mcr = Fn(C1, Le, Iz, It, Iw, E)`, `λLT = √W.fy/Mcr`, `χLT = Fn(λLT, λLT5950)` + curve letter, `χLT.mod = Fn(χLT, λLT, kc, f)` + "6.3.2.3", `Mb.Rd = χ Wpl.y fy ≤ Mc.y.Rd`, `My.Ed/Mb.Rd` OK/Warning. When fully restrained: `Mb.Rd = Mc.y.Rd  Fully Restrained`.
7. "Buckling Resistance": `UN.y = NEd/(χy NRk/γM1)`, `UN.z`, `UM.y = My.Ed/(χLT My.Rk/γM1)`, `UM.z`, `kyy = Cmy{1+(λy−0.2)UN.y}`, `kzz = Cmz{1+(2λz−0.6)UN.z}`, `kyz = 0.6kzz`, `kzy = 0.6kyy` (Table B.1) or the Table B.2 form, `UNy + kyy.UM.y + kyz.UM.z` and `UNz + kzy.UM.y + kzz.UM.z` with substituted numbers, OK.
8. "Torsion Design" (when torsion active): `J, H, a, Qf, Qw`, `Wn0, Sw1`, then "Torsion Bending Design @ x".
9. "Deflection Check - Load Case m": `In-span δ ≤ Span/360 : value ≤ span/360 → value mm OK/Warning`.
10. Unity bar: `N_Ed/N_pl.Rd | Local | UNyz | UMyz | Ax+M_6.61 | Ax+M_6.62 | Deflection | Max` (Max excludes deflection). Beam-Portion brief bar: `MA/Mc | M_y.Ed/M_b.Rd | Deflection | Max`.

Every line has three columns: symbolic formula, substituted values, result with unit, plus a right-hand tag (OK / Warning / Low Shear / Curve x / clause).
