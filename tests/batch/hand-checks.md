# Independent hand checks - 19 Sep 2026 verification campaign

Every quantity below is recomputed from first principles or from published tables,
step by step, using only the section table rows quoted from `js/sections/*.js`
(and the SCI P385 torsion constants stored beside them), the case inputs of
`tests/batch/cases.cjs`, E = 210 000 N/mm², G = 81 000 N/mm² (SN003a / P385), the
UK NA partial factors γ<sub>M0</sub> = γ<sub>M1</sub> = 1.0 and the combination
1.35G + 1.5Q. The engine value is what the check object prints for the same case
(read through `tests/harness.cjs`). The arithmetic is reproduced by
`node tests/batch/hand-checks.cjs`, which prints the same steps and the table at
the end; `tests/campaign.test.cjs` pins the figures as regression values.

Anything above 1 % is a finding. Result: **29 comparisons, none above 0.001 %**
(pre-change campaign). **19 Sep 2026 single-span scope:** HC-05 / HC-06 (the
two- and three-span pattern moments, PAT-01 / PAT-03) left with the multi-span
scope and HC-03 was re-derived for the rewritten WEB-07 (3 m simply supported,
300 kN directly over End 2: the end station evaluates type (b) with the end-zone
type (c) alongside, c = 0, s<sub>s</sub> + c = 100 < 2h<sub>w</sub>/3 = 188.7,
the lower F<sub>Rd</sub> = 202.226 kN (type (c)) governs; F<sub>Ed</sub> =
R<sub>2</sub> = 1.35(5 + 0.3953) &times; 3/2 + 450 = 460.926 kN); `node
tests/batch/hand-checks.cjs` now prints **24 comparisons, none above 0.001 %**,
the other entries unchanged.
The one difference met on the way (HC-13b, a factor 1000 on the bimoment) was a
unit slip in the first draft of the hand calculation (1 kN·m² = 10⁹ N·mm², not
10⁶), corrected here; the engine value was right.

## Summary table

| # | Case / quantity | Hand value | Engine value | Diff % |
|---|---|---|---|---|
| HC-01 | WEB-01 F<sub>Rd</sub> type (a), mid-span point load, s<sub>s</sub> = 0 | 636.914 kN | 636.914 kN | +0.000 |
| HC-02 | WEB-04 F<sub>Rd</sub> type (c) end reaction, s<sub>s</sub> = 40 | 301.001 kN | 301.001 kN | +0.000 |
| HC-02b | WEB-04 end reaction F<sub>Ed</sub> (statics) | 305.159 kN | 305.159 kN | 0.000 |
| HC-03 | WEB-07 F<sub>Rd</sub> type (b), load through the web over support 2 | 230.150 kN | 230.150 kN | +0.000 |
| HC-03b | WEB-07 F<sub>Ed</sub> = R<sub>2</sub> (two-span statics) | 477.314 kN | 477.314 kN | 0.000 |
| HC-04 | WEB-06 RHS two-web F<sub>Rd</sub> with the lever-rule share | 258.362 kN | 258.362 kN | +0.000 |
| HC-05 | PAT-01 M<sub>B</sub> hogging, Q on span 1 only | −133.137 kN·m | −133.137 kN·m | 0.000 |
| HC-05b | PAT-01 M<sub>max</sub> sagging, Q on span 1 only | 139.590 kN·m | 139.589 kN·m | −0.001 |
| HC-05c | PAT-01 R<sub>C</sub> (far end), Q on span 1 only | 21.568 kN | 21.568 kN | 0.000 |
| HC-06 | PAT-03 M<sub>C</sub> hogging, Q on spans 2+3 only | −152.924 kN·m | −152.924 kN·m | 0.000 |
| HC-06b | PAT-03 M<sub>B</sub> hogging, Q on spans 2+3 only | −74.799 kN·m | −74.799 kN·m | 0.000 |
| HC-07 | UB-04 standard M<sub>cr</sub>, SS UDL, C<sub>1</sub> 1.127 / C<sub>2</sub> 0.454, z<sub>g</sub> +152 | 80.235 kN·m | 80.235 kN·m | +0.000 |
| HC-08 | UB-45 standard M<sub>cr</sub>, fixed-ended central point load, C<sub>1</sub> 1.683 / C<sub>2</sub> 1.645, z<sub>g</sub> +105 | 189.461 kN·m | 189.461 kN·m | +0.000 |
| HC-16 | UB-43 standard M<sub>cr</sub>, fixed-ended UDL, C<sub>1</sub> 2.578 / C<sub>2</sub> 1.554, z<sub>g</sub> +203 | 46.089 kN·m | 46.089 kN·m | +0.000 |
| HC-09 | UB-19 SN006a M<sub>cr</sub> = C M<sub>cr0</sub>, tip load + self-weight, warping restrained | 78.653 kN·m | 78.653 kN·m | +0.000 |
| HC-09b | UB-19 M<sub>cr0</sub> = (π/L)√(EI<sub>z</sub>GI<sub>t</sub>) | 30.351 kN·m | 30.351 kN·m | +0.000 |
| HC-10 | TFB-01 N<sub>cr,T</sub> | 1561.01 kN | 1561.01 kN | +0.000 |
| HC-10b | TFB-01 N<sub>cr,TF</sub> (coupled with the y-y mode) | 1274.26 kN | 1274.26 kN | +0.000 |
| HC-10c | TFB-01 N<sub>b,T,Rd</sub> (curve c) | 622.363 kN | 622.363 kN | 0.000 |
| HC-11 | HSV-04 M<sub>v,y,Rd</sub> (RHS two-web form) at x = 0.3 m | 170.320 kN·m | 170.320 kN·m | +0.000 |
| HC-11b | HSV-04 V<sub>pl,Rd</sub> (A<sub>v</sub> = A h/(b + h)) | 891.898 kN | 891.898 kN | +0.000 |
| HC-11c | HSV-04 M/M<sub>v,y,Rd</sub> | 1.05668 | 1.05668 | 0.000 |
| HC-12 | AEF-01 A<sub>eff</sub> (EN 1993-1-5 4.4) | 25127.3 mm² | 25127.3 mm² | +0.000 |
| HC-12b | AEF-01 N<sub>Ed</sub>/N<sub>c,Rd</sub> with A<sub>eff</sub> | 0.22527 | 0.22527 | +0.000 |
| HC-13 | UB-49 cantilever tip twist φ(L), tip torque | 0.093812 rad | 0.093812 rad | +0.000 |
| HC-13b | UB-49 root bimoment B(0) = T a tanh(L/a) | 4.3417 kN·m² | 4.3417 kN·m² | 0.000 |
| HC-14 | TOR-05 cantilever tip twist, uniform torque | 0.125587 rad | 0.125587 rad | +0.000 |
| HC-14b | TOR-05 root torque m L | 2.772 kN·m | 2.772 kN·m | +0.000 |
| HC-15 | UB-51 mid-span twist, warping-fixed ends | 0.070713 rad | 0.070713 rad | 0.000 |

## HC-01  WEB-01: F<sub>Rd</sub> of an interior point load, type (a), s<sub>s</sub> = 0

UB 610x229x101, S275, 3 m simply supported, 600 kN (Q) at mid-span, no stiff bearing.
Row: `["610 x 229 x 101",101.2,602.6,227.6,10.5,14.8,12.7,547.6,...]` → h = 602.6, b = 227.6,
t<sub>w</sub> = 10.5, t<sub>f</sub> = 14.8 (< 16 mm → f<sub>y</sub> = 275, ε = √(235/275) = 0.9244).

1. h<sub>w</sub> = h − 2t<sub>f</sub> = 602.6 − 29.6 = 573.0 mm.
2. Flange width contributing to m<sub>1</sub> (6.5(1), 15εt<sub>f</sub> each side): b<sub>f</sub> = min(227.6, 10.5 + 30 × 0.9244 × 14.8 = 421.0) = 227.6 mm.
3. m<sub>1</sub> = f<sub>yf</sub>b<sub>f</sub>/(f<sub>yw</sub>t<sub>w</sub>) = 227.6/10.5 = 21.676; m<sub>2</sub> = 0.02(h<sub>w</sub>/t<sub>f</sub>)² = 0.02 × 38.72² = 29.979 (kept if λ̄<sub>F</sub> > 0.5).
4. Type (a), no stiffener → a = L = 3000: k<sub>F</sub> = 6 + 2(h<sub>w</sub>/a)² = 6 + 2 × 0.191² = 6.0730.
5. F<sub>cr</sub> = 0.9 k<sub>F</sub> E t<sub>w</sub>³/h<sub>w</sub> = 0.9 × 6.0730 × 210000 × 1157.6/573.0 = 2 318 900 N = 2318.9 kN.
6. l<sub>y</sub> = s<sub>s</sub> + 2t<sub>f</sub>(1 + √(m<sub>1</sub> + m<sub>2</sub>)) = 0 + 29.6 × (1 + √51.655) = 29.6 × 8.187 = 242.34 mm (≤ a).
7. λ̄<sub>F</sub> = √(l<sub>y</sub>t<sub>w</sub>f<sub>yw</sub>/F<sub>cr</sub>) = √(242.34 × 10.5 × 275/2 318 900) = 0.5493 > 0.5 → m<sub>2</sub> stays.
8. χ<sub>F</sub> = 0.5/0.5493 = 0.9102; L<sub>eff</sub> = 0.9102 × 242.34 = 220.58 mm.
9. **F<sub>Rd</sub> = f<sub>yw</sub>L<sub>eff</sub>t<sub>w</sub>/γ<sub>M1</sub> = 275 × 220.58 × 10.5/1000 = 636.9 kN.** F<sub>Ed</sub> = 1.5 × 600 = 900 kN → 1.413 (FAIL, as designed). Engine 636.914 kN.

## HC-02  WEB-04: F<sub>Rd</sub> of an end reaction, type (c) with (a) alongside, s<sub>s</sub> = 40

UB 533x210x92, 6 m SS, UDL 30 G + 40 Q, s<sub>s</sub> = 40 mm at both supports.
Row: `["533 x 210 x 92",92.1,533.1,209.3,10.1,15.6,12.7,476.5,...]`, f<sub>y</sub> = 275.

1. h<sub>w</sub> = 533.1 − 31.2 = 501.9; b<sub>f</sub> = min(209.3, 10.1 + 30 × 0.9244 × 15.6 = 442.7) = 209.3; m<sub>1</sub> = 209.3/10.1 = 20.723; m<sub>2</sub> = 0.02 × (501.9/15.6)² = 20.702.
2. End station: d = 0, c = max(d − s<sub>s</sub>/2, 0) = 0; s<sub>s</sub> + c = 40 < 2h<sub>w</sub>/3 = 334.6 → end zone, types (c) and (a) both evaluated, lower governs.
3. Type (c): k<sub>F</sub> = 2 + 6(s<sub>s</sub> + c)/h<sub>w</sub> = 2 + 6 × 40/501.9 = 2.4782 (≤ 6); F<sub>cr</sub> = 0.9 × 2.4782 × 210000 × 10.1³/501.9 = 961.5 kN.
4. l<sub>e</sub> = k<sub>F</sub>Et<sub>w</sub>²/(2f<sub>yw</sub>h<sub>w</sub>) = 2.4782 × 210000 × 102.01/(2 × 275 × 501.9) = 192.4 → ≤ s<sub>s</sub> + c = 40 → l<sub>e</sub> = 40.
5. l<sub>y</sub> = min[ l<sub>e</sub> + t<sub>f</sub>√(m<sub>1</sub>/2 + (l<sub>e</sub>/t<sub>f</sub>)² + m<sub>2</sub>), l<sub>e</sub> + t<sub>f</sub>√(m<sub>1</sub> + m<sub>2</sub>) ] = min[40 + 15.6√(10.36 + 6.57 + 20.70) = 135.71, 40 + 15.6√41.43 = 140.41] = 135.71 mm.
6. λ̄<sub>F</sub> = √(135.71 × 10.1 × 275/961 500) = 0.6261 > 0.5; χ<sub>F</sub> = 0.5/0.6261 = 0.7986; F<sub>Rd,c</sub> = 275 × 0.7986 × 135.71 × 10.1/1000 = 301.0 kN.
7. Type (a) alongside (k<sub>F</sub> = 6.014, l<sub>y</sub> = 40 + 31.2(1 + √41.43) = 271.8): F<sub>Rd,a</sub> = 663.9 kN. **F<sub>Rd</sub> = min = 301.0 kN.** Engine 301.001 kN.
8. Reaction: w = 1.35(30 + 92.1 × 9.81/1000 = 0.9035) + 1.5 × 40 = 101.720 kN/m; R = wL/2 = 305.16 kN (engine 305.159); F<sub>Ed</sub>/F<sub>Rd</sub> = 1.014 (FAIL by 1.4 %, as designed; WEB-05 with s<sub>s</sub> = 100 gives F<sub>Rd</sub> = 415.4 kN, 0.735).

## HC-03  WEB-07: F<sub>Rd</sub> of a point load over the interior support, type (b)

UB 305x165x40, 2 × 3 m continuous, G 5 kN/m, 300 kN (Q) at x = 3 m directly over support 2, s<sub>s</sub> = 100.
Row: `["305 x 165 x 40",40.3,303.4,165.0,6.0,10.2,8.9,265.2,...]`.

1. h<sub>w</sub> = 303.4 − 20.4 = 283.0; b<sub>f</sub> = min(165, 6 + 30 × 0.9244 × 10.2 = 288.9) = 165; m<sub>1</sub> = 165/6 = 27.50; m<sub>2</sub> = 0.02 × (283/10.2)² = 15.396.
2. Interior station (d = 3000, not an end zone). Type (b): k<sub>F</sub> = 3.5 + 2(h<sub>w</sub>/a)² with a = L = 6000: 3.5 + 2 × 0.04717² = 3.5044; F<sub>cr</sub> = 0.9 × 3.5044 × 210000 × 216/283 = 505.5 kN.
3. l<sub>y</sub> = 100 + 2 × 10.2 × (1 + √42.896) = 100 + 20.4 × 7.5495 = 254.01 mm.
4. λ̄<sub>F</sub> = √(254.01 × 6 × 275/505 500) = 0.9105; χ<sub>F</sub> = 0.5491; **F<sub>Rd</sub> = 275 × 0.5491 × 254.01 × 6/1000 = 230.2 kN.** Engine 230.150 kN.
5. F<sub>Ed</sub> = max(P, R<sub>2</sub>): two equal spans under w = 1.35(5 + 0.3953) = 7.2837 kN/m give R<sub>2</sub> = 2 × (5/8)wL = 27.31 kN, plus the 1.5 × 300 = 450 kN applied at the support → R<sub>2</sub> = 477.31 kN (engine 477.314). F<sub>Ed</sub>/F<sub>Rd</sub> = 2.074 (FAIL, as designed).

## HC-04  WEB-06: RHS with two webs and the lever-rule load share

RHS 250x150x6.3, 3 m SS, 80 kN (Q) at mid-span at e = 40 mm from the shear centre, s<sub>s</sub> = 60.
Row: `["250 x 150 x 6.3",38.0,250.0,150.0,6.3,48.4,20.8,36.7,...]` → h = 250, b = 150, t = 6.3, flat web depth d = (d/t) × t = 36.7 × 6.3 = 231.21 mm.

1. Per web: t<sub>w</sub> = t<sub>f</sub> = 6.3, h<sub>w</sub> = 231.21; b<sub>f</sub> = min(b/2 = 75, t + 15εt = 6.3 + 87.36 = 93.66) = 75; m<sub>1</sub> = 75/6.3 = 11.905; m<sub>2</sub> = 0.02 × (231.21/6.3)² = 26.94.
2. Type (a), k<sub>F</sub> = 6 + 2(231.21/3000)² = 6.0119; F<sub>cr</sub> = 0.9 × 6.0119 × 210000 × 250.05/231.21 = 1228.8 kN.
3. First pass l<sub>y</sub> = 60 + 12.6(1 + √38.85) = 151.1 → λ̄<sub>F</sub> = √(151.1 × 6.3 × 275/1 228 800) = 0.4615 ≤ 0.5 → m<sub>2</sub> = 0, second pass l<sub>y</sub> = 60 + 12.6(1 + √11.905) = 116.07, λ̄<sub>F</sub> = 0.4045, χ<sub>F</sub> = 1.
4. F<sub>Rd</sub> per web = 275 × 116.07 × 6.3/1000 = 201.1 kN.
5. Lever rule: the near web carries 0.5 + e/(b − t) = 0.5 + 40/143.7 = 0.7784 of the load, so the station resistance is F<sub>Rd</sub> = 201.1/0.7784 = **258.4 kN**. Engine 258.362 kN, share 0.778.

## HC-05  PAT-01: two-span pattern "Q on span 1 only" (Clapeyron)

UB 457x191x82, 2 × 6 m, UDL 10 G + 20 Q, self-weight 82.0 × 9.81/1000 = 0.80442 kN/m on both spans at γ<sub>G</sub>.

1. w<sub>1</sub> = 1.35(10 + 0.80442) + 1.5 × 20 = 44.586 kN/m; w<sub>2</sub> = 14.586 kN/m.
2. Three-moment equation at B (M<sub>A</sub> = M<sub>C</sub> = 0): 2M<sub>B</sub>(2L) = −(w<sub>1</sub> + w<sub>2</sub>)L³/4 → M<sub>B</sub> = −(w<sub>1</sub> + w<sub>2</sub>)L²/16 = −59.172 × 36/16 = **−133.137 kN·m** (engine −133.137).
3. R<sub>A</sub> = w<sub>1</sub>L/2 + M<sub>B</sub>/L = 133.758 − 22.190 = 111.568 kN; x<sub>max</sub> = R<sub>A</sub>/w<sub>1</sub> = 2.502 m; M<sub>max</sub> = R<sub>A</sub>²/(2w<sub>1</sub>) = **139.590 kN·m** (engine 139.589, the grid station nearest 2.502 m).
4. R<sub>C</sub> = w<sub>2</sub>L/2 + M<sub>B</sub>/L = 43.758 − 22.190 = **21.568 kN** (engine 21.568); the Q-only SLS pattern lifts it by −wL/16 = −7.5 kN (engine −7.50, advisory).

## HC-06  PAT-03: three-span pattern "Q on spans 2+3 only"

UB 533x210x92, 3 × 5 m, UDL 12 G + 25 Q. w<sub>G</sub> = 1.35(12 + 0.9035) = 17.420 kN/m on every span, w<sub>Q</sub> = 37.5 kN/m on spans 2 and 3.

1. Clapeyron at B and C (M<sub>A</sub> = M<sub>D</sub> = 0, equal spans): 4M<sub>B</sub> + M<sub>C</sub> = −(w<sub>1</sub> + w<sub>2</sub>)L²/4 = −(17.420 + 54.920) × 6.25 = −452.122; M<sub>B</sub> + 4M<sub>C</sub> = −(w<sub>2</sub> + w<sub>3</sub>)L²/4 = −109.840 × 6.25 = −686.497.
2. Determinant 15: M<sub>B</sub> = (4 × (−452.122) + 686.497)/15 = **−74.799 kN·m**; M<sub>C</sub> = (4 × (−686.497) + 452.122)/15 = **−152.924 kN·m** (engine −74.799 / −152.924).
3. Coefficient check: G on all spans 0.100 w<sub>G</sub>L² = 43.549 plus Q on two adjacent spans 0.11667 w<sub>Q</sub>L² = 109.375 at C → 152.92 ✓ (Steel Designers' Manual continuous-beam coefficients).

## HC-07  UB-04: standard M<sub>cr</sub> with the C<sub>2</sub>z<sub>g</sub> term, simply supported UDL

UB 305x165x40, 6 m SS, UDL, load on the top flange z<sub>g</sub> = +152 mm. Row: I<sub>z</sub> = 764 cm⁴, I<sub>t</sub> = 14.7 cm⁴, I<sub>w</sub> = 0.164 dm⁶. SN003a Table 3.2 (k = k<sub>w</sub> = 1): C<sub>1</sub> = 1.127, C<sub>2</sub> = 0.454.

1. π²EI<sub>z</sub>/L² = π² × 210000 × 7.64 × 10⁶/6000² = 439 855 N.
2. I<sub>w</sub>/I<sub>z</sub> = 1.64 × 10¹¹/7.64 × 10⁶ = 21 466 mm²; GI<sub>t</sub>/(π²EI<sub>z</sub>/L²) = 81000 × 1.47 × 10⁵/439 855 = 27 070 mm²; C<sub>2</sub>z<sub>g</sub> = 0.454 × 152 = 69.01 mm.
3. M<sub>cr</sub> = C<sub>1</sub>(π²EI<sub>z</sub>/L²){√(21466 + 27070 + 69.01²) − 69.01} = 1.127 × 439 855 × (√53298 − 69.01) = 1.127 × 439 855 × (230.86 − 69.01) = **80.23 kN·m** (engine 80.235). At the shear centre the same chain gives 109.21 kN·m: the load height costs 26.5 %.

## HC-08  UB-45: standard M<sub>cr</sub> with C<sub>2</sub>z<sub>g</sub>, fixed-ended central point load

UC 203x203x60, 6 m fixed-fixed, central point load on the top flange z<sub>g</sub> = +105 mm. Row `["203 x 203 x 60",...]`: I<sub>z</sub> = 2060 cm⁴, I<sub>t</sub> = 47.2 cm⁴, I<sub>w</sub> = 0.197 dm⁶. SN003a Table 3.2 fixed-ended + central point load: C<sub>1</sub> = 1.683, C<sub>2</sub> = 1.645.

π²EI<sub>z</sub>/L² = 1 185 998 N; I<sub>w</sub>/I<sub>z</sub> = 9563 mm²; GI<sub>t</sub>/T<sub>1</sub> = 32 236 mm²; C<sub>2</sub>z<sub>g</sub> = 172.73 mm;
M<sub>cr</sub> = 1.683 × 1 185 998 × (√(9563 + 32236 + 29834) − 172.73) = 1.683 × 1 185 998 × (267.64 − 172.73) = **189.46 kN·m** (engine 189.461).

## HC-16  UB-43: standard M<sub>cr</sub> with C<sub>2</sub>z<sub>g</sub>, fixed-ended UDL

UB 406x140x39, 8 m fixed-fixed, UDL on the top flange z<sub>g</sub> = +203. Row `["406 x 140 x 39",39.0,398.0,141.8,6.4,8.6,10.2,360.4,6.69,56.3,12500.0,410.0,...,10.7,49.7,0.155]`: I<sub>z</sub> = 410 cm⁴, I<sub>t</sub> = 10.7 cm⁴, I<sub>w</sub> = 0.155 dm⁶; C<sub>1</sub> = 2.578, C<sub>2</sub> = 1.554.

π²EI<sub>z</sub>/L² = 132 777 N; I<sub>w</sub>/I<sub>z</sub> = 37 805; GI<sub>t</sub>/T<sub>1</sub> = 65 275; C<sub>2</sub>z<sub>g</sub> = 315.46 mm; M<sub>cr</sub> = 2.578 × 132 777 × (√(37805 + 65275 + 99515) − 315.46) = 2.578 × 132 777 × (450.11 − 315.46) = **46.09 kN·m** (engine 46.089).

## HC-09  UB-19: NCCI SN006a cantilever, tip point load, root warping restrained

UB 254x102x22, 3 m cantilever, 10 kN (Q) at the tip, z<sub>g</sub> = 0. Row `["254 x 102 x 22",...]`: I<sub>z</sub> = 119 cm⁴, I<sub>t</sub> = 4.15 cm⁴, I<sub>w</sub> = 0.0182 dm⁶, mass 22.0 kg/m.

1. M<sub>cr0</sub> = (π/L)√(EI<sub>z</sub>GI<sub>t</sub>) = (π/3000)√(210000 × 1.19 × 10⁶ × 81000 × 4.15 × 10⁴) = 30.351 kN·m.
2. κ<sub>wt</sub> = √(EI<sub>w</sub>/(GI<sub>t</sub>))/L = √(3.822 × 10¹⁵/3.3615 × 10⁹)/3000 = 1066.3/3000 = 0.3554; η = z<sub>g</sub>/(h<sub>s</sub>/2) = 0.
3. Table 3.2 (F, warping restrained), η = 0 column, rows κ<sub>wt</sub> = 0.3 → 2.35 and 0.4 → 2.72 (`SN006.F.restr` in js/01-computation-engine.js): C<sub>F</sub> = 2.35 + 0.37 × 0.554 = 2.5551. Table 3.1 (q, restrained): 4.57 / 5.45 → C<sub>q</sub> = 5.0578.
4. The factored self-weight is a uniform load on the cantilever: M<sub>q</sub> = 1.35 × 0.2158 × 3²/2 = 1.311 kN·m against M<sub>F</sub> = 1.5 × 10 × 3 = 45 kN·m (2.8 % of the total, above the engine's 2 % de-minimis), so SN006a Eq (7) combines them: C = (M<sub>q</sub> + M<sub>F</sub>)/(M<sub>q</sub>/C<sub>q</sub> + M<sub>F</sub>/C<sub>F</sub>) = 46.311/(0.2592 + 17.612) = 2.5914.
5. **M<sub>cr</sub> = 2.5914 × 30.351 = 78.65 kN·m** (engine 78.653, C 2.5914).

## HC-10  TFB-01: channel torsional and torsional-flexural buckling (cl 6.3.1.4)

PFC 200x90x30, 4 m SS, N = 80 kN, L<sub>T</sub> = L<sub>cr,z</sub> = L<sub>cr,y</sub> = 4 m. Row `["200x90x30",29.7,200,90,7,14,12,148,...,Ix 2520,Iy 314,rx 8.16,ry 2.88,...,A 37.9]`; `TP385_PFC["200x90x30"] = [IT 19.1 cm⁴, a 0.508, Iw 0.0197 dm⁶, ..., e0 36, esc 63.7]` → y<sub>0</sub> = e<sub>sc</sub> = 63.7 mm.

1. i<sub>0</sub>² = i<sub>y</sub>² + i<sub>z</sub>² + y<sub>0</sub>² = 81.6² + 28.8² + 63.7² = 11 545.7 mm².
2. N<sub>cr,T</sub> = (GI<sub>T</sub> + π²EI<sub>w</sub>/L<sub>T</sub>²)/i<sub>0</sub>² = (1.5471 × 10¹⁰ + 2.5519 × 10⁹)/11 545.7 = 1 561 010 N = **1561.0 kN**.
3. N<sub>cr,y</sub> = π²EI<sub>y</sub>/L² = π² × 210000 × 2.52 × 10⁷/4000² = 3264.4 kN; β = 1 − y<sub>0</sub>²/i<sub>0</sub>² = 0.6486.
4. N<sub>cr,TF</sub> = (N<sub>cr,y</sub> + N<sub>cr,T</sub>)/(2β) [1 − √(1 − 4βN<sub>cr,y</sub>N<sub>cr,T</sub>/(N<sub>cr,y</sub> + N<sub>cr,T</sub>)²)] = 3719.8 × [1 − √(1 − 0.5679)] = 3719.8 × 0.34257 = **1274.3 kN** (governs over N<sub>cr,T</sub>).
5. λ̄<sub>T</sub> = √(Af<sub>y</sub>/N<sub>cr,TF</sub>) = √(3790 × 275/1 274 260) = 0.9044; curve c (α = 0.49): Φ = 0.5[1 + 0.49(0.9044 − 0.2) + 0.9044²] = 1.0815; χ<sub>T</sub> = 1/(1.0815 + √(1.0815² − 0.9044²)) = 0.5971.
6. **N<sub>b,T,Rd</sub> = 0.5971 × 3790 × 275/1000 = 622.4 kN**; N<sub>Ed</sub>/N<sub>b,T,Rd</sub> = 0.1285 (engine 622.363, 0.129).

## HC-11  HSV-04: RHS high-shear M<sub>v,y,Rd</sub> at the point load

RHS 300x100x10, 2 m SS, 470 kN (Q) at x = 0.3 m. Row `["300 x 100 x 10.0",58.8,300,100,10,A 74.9,...,Sx 666 cm³,...]`.

1. A<sub>v</sub> = Ah/(b + h) = 7490 × 300/400 = 5617.5 mm²; V<sub>pl,Rd</sub> = A<sub>v</sub>f<sub>y</sub>/√3 = 891.9 kN.
2. Self-weight 1.35 × 0.5768 = 0.7787 kN/m; R<sub>1</sub> = 705 × 1.7/2 + 0.7787 = 600.03 kN; V(0.3⁻) = 600.03 − 0.7787 × 0.3 = 599.80 kN; M(0.3) = 600.03 × 0.3 − 0.7787 × 0.045 = 179.97 kN·m.
3. ρ = (2V/V<sub>pl,Rd</sub> − 1)² = (1.3450 − 1)² = 0.1190.
4. **M<sub>v,y,Rd</sub> = (W<sub>pl,y</sub> − ρt(h − 2t)²/2)f<sub>y</sub> = (666 000 − 0.1190 × 10 × 280²/2) × 275 = 170.32 kN·m** (M<sub>c,Rd</sub> = 183.15); M/M<sub>v,y,Rd</sub> = 1.0567 → FAIL as designed (engine 170.320, 1.0567).

## HC-12  AEF-01: effective area of a Class-4 web in uniform compression

UB 1016x305x222, S275, t<sub>f</sub> = 21.1 mm → f<sub>y</sub> = 265, ε = 0.9417. Row `["1016 x 305 x 222",222.0,970.3,300.0,16.0,21.1,30.0,868.1,5.31,54.3,...,A 283]`.

1. d/t<sub>w</sub> = 54.3 > 42ε = 39.55 → Class 4 in uniform compression.
2. λ̄<sub>p</sub> = (b̄/t)/(28.4ε√k<sub>σ</sub>) = 54.3/(28.4 × 0.9417 × 2) = 1.0152.
3. ρ = (λ̄<sub>p</sub> − 0.055(3 + ψ))/λ̄<sub>p</sub>² = (1.0152 − 0.22)/1.0306 = 0.7716.
4. **A<sub>eff</sub> = A − (1 − ρ)b̄t<sub>w</sub> = 28 300 − 0.2284 × 868.1 × 16 = 25 127 mm² (0.888A)**; N<sub>c,Rd</sub> = 6658.7 kN; N<sub>Ed</sub>/N<sub>c,Rd</sub> = 1500/6658.7 = 0.2253 (engine 25127.3, 0.2253).

## HC-13  UB-49: warping-torsion cantilever, tip torque (Vlasov closed form)

UB 457x191x82, 4 m cantilever, 20 kN (Q) at the tip at e = 80 mm → T = 1.5 × 20 × 80 = 2400 kN·mm = 2.4 × 10⁶ N·mm. `TP385_UB["457 x 191 x 82"] = [IT 69.2 cm⁴, a 1.86 m, Iw 0.922 dm⁶, ...]`.

1. GI<sub>T</sub> = 81000 × 6.92 × 10⁵ = 5.6052 × 10¹⁰ N·mm²; EI<sub>w</sub> = 210000 × 9.22 × 10¹¹ = 1.9362 × 10¹⁷ N·mm⁴; a = √(EI<sub>w</sub>/GI<sub>T</sub>) = 1858.6 mm (P385 table 1.86 m).
2. Root warping fixed, tip free: φ(L) = (T/GI<sub>T</sub>)[L − a tanh(L/a)] = 4.2817 × 10⁻⁵ × (4000 − 1858.6 × 0.97334) = 4.2817 × 10⁻⁵ × 2190.97 = **0.09381 rad** (engine 0.093812, mesh error 7 × 10⁻⁸).
3. Root bimoment B(0) = T a tanh(L/a) = 2.4 × 10⁶ × 1809.0 = 4.3417 × 10⁹ N·mm² = **4.342 kN·m²** (engine 4.3417).

## HC-14  TOR-05: warping-torsion cantilever under a uniform torque

UB 305x165x40, 3 m cantilever, UDL 3 G + 5 Q at e = 80 mm → m = (1.35 × 3 + 1.5 × 5) × 80 = 924 N·mm/mm. `TP385_UB["305 x 165 x 40"] = [IT 14.7, a 1.7, Iw 0.164, ...]` → GI<sub>T</sub> = 1.1907 × 10¹⁰, a = 1700.7 mm.

Derivation (root warping fixed, tip free): the general solution of EI<sub>w</sub>φ⁗ − GI<sub>T</sub>φ″ = m is φ = C<sub>1</sub> + C<sub>2</sub>x + C<sub>3</sub>cosh(x/a) + C<sub>4</sub>sinh(x/a) − mx²/(2GI<sub>T</sub>). The total torque T(x) = GI<sub>T</sub>φ′ − EI<sub>w</sub>φ‴ reduces to GI<sub>T</sub>C<sub>2</sub> − mx (the hyperbolic parts cancel because EI<sub>w</sub>/a² = GI<sub>T</sub>), so T(L) = 0 gives C<sub>2</sub> = mL/GI<sub>T</sub> (T(0) = mL, the statics of the root). φ′(0) = 0 gives C<sub>4</sub> = −aC<sub>2</sub>; B(L) = EI<sub>w</sub>φ″(L) = 0 gives C<sub>3</sub> = (ma²/GI<sub>T</sub>)[1 + (L/a)sinh(L/a)]/cosh(L/a); φ(0) = 0 gives C<sub>1</sub> = −C<sub>3</sub>. Substituting at x = L:

φ(L) = (m/GI<sub>T</sub>)[L²/2 + a²(1 − sech(L/a)) − aL tanh(L/a)]

(a → 0 recovers the St Venant value mL²/2GI<sub>T</sub>). With L/a = 1.7640, sech = 0.33295, tanh = 0.94294:
φ(L) = 7.7601 × 10⁻⁸ × [4.5000 × 10⁶ + 1.9294 × 10⁶ − 4.8110 × 10⁶] = **0.12559 rad** (St Venant alone 0.3492 rad; engine 0.125587, mesh error 1.5 × 10⁻⁵). The root torque mL = 2.772 kN·m is printed as the total end torque (engine 2.772). This closed form is also used by the batch cross-check (xiii) for TOR-05.

## HC-15  UB-51: warping-fixed ends, uniform torque

UB 457x191x82, 8 m, UDL 5 G + 8 Q at e = 100 mm → t = (6.75 + 12) × 100 = 1875 N·mm/mm; both supports φ = 0 and φ′ = 0.
φ(L/2) = (t/GI<sub>T</sub>)[L²/8 − (La/2)tanh(L/4a)] = 3.3451 × 10⁻⁸ × [8.000 × 10⁶ − 5.8861 × 10⁶] = **0.07071 rad** (fork ends would give 0.1786 rad; engine 0.070713).

## Conclusions

- Every hand value agrees with the engine to better than 0.001 % (the engine's grid station nearest x<sub>max</sub> accounts for the −0.001 % of HC-05b).
- No hand-check difference above 1 % → no adjustment was made to any case or engine value on account of the hand checks. The one engine change of this campaign (the two-sided moment sample at a jump on the standard C<sub>1</sub> route) came from the M<sub>cr</sub> method comparison, see `tests/batch/mcr-method-comparison.md`.
- Still due (unchanged from the G2 audit): a digit-for-digit comparison of the clause-6 chain against a published SCI P363/P364 or MasterSeries worked example; the values above are first-principles arithmetic, not a published benchmark.
