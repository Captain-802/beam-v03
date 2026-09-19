# Hand checks - single-span verification library (19 Sep 2026 scope)

Independent recomputation of 59 quantities over 24 cases of `cases.cjs`,
written out step by step from the section table rows quoted from
`js/sections/*.js` and the case inputs; no engine function is used for the hand
value. `node tests/batch/hand-checks.cjs` reproduces every number below and
prints the comparison table (exit code 1 when a difference above 1 % is not one
of the two expected findings). Constants: E = 210 000 N/mm², G = 81 000 N/mm²
(SN003a / P385), γ<sub>M0</sub> = γ<sub>M1</sub> = 1.0, self-weight = mass × 9.81/1000
rounded to 4 decimals as the engine stores it.

Result (2026-09-19, Node 24): 56 of 59 comparisons agree to better than 0.01 %
(the propped-cantilever deflection maximum to 0.008 %, a sampling effect of the
120-element grid against the exact station). Three differences above 1 % are
expected and explained: HC-17c is an **engine finding** (the web-bearing
station at a fixed End 2 reads M<sub>Ed</sub> = 0), HC-23b / HC-23c are a
**method difference** (the SN003a k = 0.5 column against the eigenvalue of the
laterally clamped member, 1.8 % on the ratio).

## A. Statics and deflections of the presets

### HC-01  UB-71  UB 305x165x40, 6 m guided-fixed, UDL 3 G + 4 Q

End 1 fixed (U<sub>z</sub> + R<sub>y</sub>), End 2 sliding (R<sub>y</sub> held, U<sub>z</sub>
free). By symmetry the member is one half of a fixed-fixed beam of span 2L:
M<sub>fixed</sub> = wL²/3, M<sub>guided</sub> = wL²/6 (sagging), R<sub>1</sub> = wL,
R<sub>2</sub> = 0, tip deflection w(2L)⁴/(384EI) = wL⁴/(24EI). Row: mass 40.3 kg/m,
I<sub>x</sub> = 8500 cm⁴.

- w<sub>ULS</sub> = 1.35 (3 + 0.3953) + 1.5 × 4 = 10.5837 kN/m
- M<sub>1</sub> = 10.5837 × 36/3 = **127.004 kN·m**, M<sub>2</sub> = 10.5837 × 36/6 = **63.502 kN·m**, R<sub>1</sub> = 10.5837 × 6 = **63.502 kN**
- δ<sub>tip</sub> (SLS, Q only, w = 4 N/mm) = 4 × 6000⁴/(24 × 210 000 × 8500 × 10⁴) = **12.101 mm**

Engine: 127.004 / 63.502 kN·m, R<sub>1</sub> 63.502 kN, R<sub>2</sub> 0.000 kN, δ 12.101 mm (0.000 %).

### HC-02  UB-72  UB 406x178x54, 6 m guided-fixed, point load 15 G + 40 Q at the guided end

A tip load P on the guided end is the central load 2P of the fixed-fixed beam
of span 2L: M<sub>fixed</sub> = M<sub>guided</sub> = 2P(2L)/8 = PL/2, δ<sub>tip</sub> =
2P(2L)³/(192EI) = PL³/(12EI). Self-weight (0.7164 kN/m × 1.35) adds wL²/3 and
wL²/6. Row: mass 54.1, I<sub>x</sub> = 18 700 cm⁴.

- P<sub>ULS</sub> = 1.35 × 15 + 1.5 × 40 = 80.25 kN; w<sub>sw</sub> = 1.35 × 0.5307 = 0.7164 kN/m
- M<sub>1</sub> = 80.25 × 3 + 0.7164 × 12 = **249.347 kN·m**; M<sub>2</sub> = 240.75 + 0.7164 × 6 = **245.049 kN·m**
- δ<sub>tip</sub> = 40 000 × 6000³/(12 × 210 000 × 18 700 × 10⁴) = **18.335 mm**

Engine: 249.347 / 245.049 kN·m, 18.335 mm (0.000 %).

### HC-03  UB-21  UB 406x140x39, 8 m fixed-fixed, UDL 5 G + 6 Q

M<sub>end</sub> = wL²/12, R = wL/2, δ<sub>mid</sub> = wL⁴/(384EI). Row: mass 39.0, I<sub>x</sub> = 12 500 cm⁴.

- w<sub>ULS</sub> = 1.35 (5 + 0.3826) + 9 = 16.2665 kN/m; M<sub>end</sub> = 16.2665 × 64/12 = **86.755 kN·m**; R = **65.066 kN**
- δ<sub>mid</sub> (SLS w = 6) = 6 × 8000⁴/(384 × 210 000 × 12 500 × 10⁴) = **2.438 mm**

Engine: 86.755 kN·m at both ends, 65.066 kN, 2.438 mm (0.000 %).

### HC-04  UB-53  UB 457x191x82, 8 m fixed-fixed, central point load 60 G + 150 Q

M<sub>end</sub> = PL/8 + w<sub>sw</sub>L²/12, δ<sub>mid</sub> = PL³/(192EI). Row: mass 82.0, I<sub>x</sub> = 37 100 cm⁴.

- P<sub>ULS</sub> = 81 + 225 = 306 kN; w<sub>sw</sub> = 1.35 × 0.8044 = 1.0859 kN/m
- M<sub>end</sub> = 306 × 8/8 + 1.0859 × 64/12 = **311.792 kN·m**
- δ<sub>mid</sub> (SLS P = 150 kN) = 150 000 × 8000³/(192 × 210 000 × 37 100 × 10⁴) = **5.134 mm**

Engine: 311.792 kN·m, 5.134 mm (0.000 %).

### HC-05  UB-64 / UB-19  cantilevers

UB-64: UB 305x165x40, 3 m, UDL 6 G + 9 Q: M<sub>root</sub> = wL²/2, δ<sub>tip</sub> = wL⁴/(8EI).
w<sub>ULS</sub> = 1.35 (6 + 0.3953) + 13.5 = 22.1337 kN/m → M = 22.1337 × 9/2 = **99.601 kN·m**;
δ = 9 × 3000⁴/(8 × 210 000 × 8500 × 10⁴) = **5.105 mm** (limit L/180 = 16.67 mm).

UB-19: UB 254x102x22, 3 m, tip load 10 Q: M<sub>root</sub> = PL + w<sub>sw</sub>L²/2 =
15 × 3 + 0.2913 × 4.5 = **46.311 kN·m**; δ = 10 000 × 3000³/(3 × 210 000 × 2840 × 10⁴) = **15.091 mm**.

Engine: 99.601 / 5.105, 46.311 / 15.091 (0.000 %).

### HC-06  UB-76 / UB-77  pinned-guided

One half of a simply supported beam of span 2L: M<sub>guided</sub> = wL²/2 (+ PL for a
tip load), R<sub>1</sub> = wL (+ P), δ<sub>tip</sub> = 5wL⁴/(24EI) (+ PL³/(3EI)).

UB-76 (UB 305x165x40, 4 m, UDL 3 G + 4 Q): w<sub>ULS</sub> = 10.5837 → M<sub>2</sub> = 10.5837 × 16/2 =
**84.669 kN·m**, R<sub>1</sub> = **42.335 kN**, δ = 5 × 4 × 4000⁴/(24 × 210 000 × 8500 × 10⁴) = **11.951 mm**.

UB-77 (UB 406x178x54, 5 m, tip load 8 G + 20 Q): P<sub>ULS</sub> = 40.80 kN → M<sub>2</sub> =
40.8 × 5 + 0.7164 × 12.5 = **212.956 kN·m**; δ = 20 000 × 5000³/(3 × 210 000 × 18 700 × 10⁴) = **21.221 mm**.

Engine: all five values to 0.000 %.

### HC-07  UB-20  UB 305x127x37, 6 m propped cantilever (End 1 fixed, End 2 pinned), UDL 6 G + 7 Q

M<sub>fixed</sub> = wL²/8, R<sub>pinned</sub> = 3wL/8, R<sub>fixed</sub> = 5wL/8. Deflection curve
with ξ from the pinned end: y = wξ(L³ − 3Lξ² + 2ξ³)/(48EI); dy/dξ = 0 gives
1 − 9t² + 8t³ = 0, t = ξ/L = 0.42154, so y<sub>max</sub> = 0.005416 wL⁴/EI
(= wL⁴/184.6EI; the textbook "wL⁴/185EI"). Row: mass 37.0, I<sub>x</sub> = 7170 cm⁴.

- w<sub>ULS</sub> = 1.35 (6 + 0.363) + 10.5 = 19.0900 kN/m → M<sub>1</sub> = **85.905 kN·m**, R<sub>2</sub> = **42.953 kN**, R<sub>1</sub> = 71.588 kN
- δ<sub>max</sub> (SLS w = 7) = 7 × 2529.2 × (6000³ − 3 × 6000 × 2529.2² + 2 × 2529.2³)/(48 × 210 000 × 7170 × 10⁴) = **3.263 mm** at 3.471 m from End 1

Engine: 85.905 kN·m, 42.953 kN, 3.263 mm at x = 3.45 m (−0.008 %: the engine reports its 120-element node nearest the exact station).

## B. Strut effective lengths from the end fixities

### HC-08  AX-04  UC 254x254x73, 6 m guided-fixed, N = 300 kN

`lcrDefaults()` (P360 Table 6.2 / BS 5950 Table 22 style [verify]): y-y from
U<sub>z</sub>/R<sub>y</sub> - held in position and direction at End 1, held in direction
only at End 2 (sway permitted, guided) - L<sub>cr,y</sub> = 1.2 L = 7.2 m; z-z from
U<sub>y</sub>/R<sub>z</sub> - held in position and direction at both ends - L<sub>cr,z</sub> = 0.7 L = 4.2 m.
EN 1993-1-1 6.3.1.2 with λ<sub>1</sub> = π√(E/f<sub>y</sub>) = 86.815 (f<sub>y</sub> = 275, t<sub>f</sub> 14.2), Table 6.2 rolled
H (h/b ≤ 1.2, t<sub>f</sub> ≤ 100): y-y curve b (α 0.34), z-z curve c (α 0.49). Row: A 93.1 cm², i<sub>y</sub> 11.1 cm, i<sub>z</sub> 6.48 cm
(Blue Book radii of gyration, as the engine reads them).

- λ̄<sub>y</sub> = 7200/111/86.815 = 0.7472 → Φ = 0.5[1 + 0.34(0.5472) + 0.5583] = 0.8722 → χ<sub>y</sub> = 0.7564 → N<sub>b,y,Rd</sub> = 0.7564 × 9310 × 275 = **1936.6 kN**
- λ̄<sub>z</sub> = 4200/64.8/86.815 = 0.7466 → Φ = 0.5[1 + 0.49(0.5466) + 0.5574] = 0.9126 → χ<sub>z</sub> = 0.6957 → N<sub>b,z,Rd</sub> = **1781.1 kN**

Engine: L<sub>cr,y</sub> 7200, L<sub>cr,z</sub> 4200 mm, N<sub>b,y,Rd</sub> 1936.63, N<sub>b,z,Rd</sub> 1781.09 kN (0.000 %).

## C. Web transverse forces (EN 1993-1-5 clause 6)

### HC-09  WEB-01  UB 610x229x101, 3 m SS, 600 kN (Q) at mid-span, s<sub>s</sub> = 0, type (a)

Row: D 602.6, B 227.6, t<sub>w</sub> 10.5, t<sub>f</sub> 14.8 (< 16 → f<sub>y</sub> = 275).

- h<sub>w</sub> = 573.0; b<sub>f</sub> = min(227.6, t<sub>w</sub> + 30εt<sub>f</sub> = 421.0) = 227.6; m<sub>1</sub> = 21.676; m<sub>2</sub> = 0.02 (573/14.8)² = 29.979
- k<sub>F</sub> = 6 + 2(h<sub>w</sub>/a)² with a = L = 3000 (no stiffener) = 6.0730; F<sub>cr</sub> = 0.9 × 6.073 × 210 000 × 10.5³/573 = 2318.9 kN
- l<sub>y</sub> = s<sub>s</sub> + 2t<sub>f</sub>(1 + √(m<sub>1</sub> + m<sub>2</sub>)) = 242.34 mm; λ̄<sub>F</sub> = √(242.34 × 10.5 × 275/2 318 900) = 0.5493 (> 0.5, m<sub>2</sub> retained)
- χ<sub>F</sub> = 0.5/0.5493 = 0.9102; L<sub>eff</sub> = 220.58 mm; F<sub>Rd</sub> = 275 × 220.58 × 10.5/1000 = **636.9 kN**; F<sub>Ed</sub> = 900 kN → 1.413

Engine: 636.914 kN (0.000 %).

### HC-10  WEB-04  UB 533x210x92, 6 m SS, UDL 30 G + 40 Q, end reaction on s<sub>s</sub> = 40, type (c)

Row: D 533.1, B 209.3, t<sub>w</sub> 10.1, t<sub>f</sub> 15.6, mass 92.1. h<sub>w</sub> = 501.9, m<sub>1</sub> = 20.723,
m<sub>2</sub> = 20.702; end station c = 0, s<sub>s</sub> + c = 40 < 2h<sub>w</sub>/3 = 334.6 → end zone, types (c) and (a) both evaluated.

- type (c): k<sub>F</sub> = 2 + 6(40/501.9) = 2.4782; F<sub>cr</sub> = 961.5 kN; l<sub>e</sub> = min(k<sub>F</sub>Et<sub>w</sub>²/(2f<sub>y</sub>h<sub>w</sub>) = 192.4, s<sub>s</sub> + c = 40) = 40;
  l<sub>y</sub> = min(l<sub>e</sub> + t<sub>f</sub>√(m<sub>1</sub>/2 + (l<sub>e</sub>/t<sub>f</sub>)² + m<sub>2</sub>), l<sub>e</sub> + t<sub>f</sub>√(m<sub>1</sub> + m<sub>2</sub>)) = 135.71; λ̄<sub>F</sub> = 0.6261; F<sub>Rd</sub> = **301.0 kN**
- type (a) alongside: 663.9 kN → (c) governs
- R = wL/2 with w = 1.35 (30 + 0.9035) + 60 = 101.720 kN/m → **305.16 kN**; F<sub>Ed</sub>/F<sub>Rd</sub> = 1.014

Engine: 301.001 kN, 305.159 kN (0.000 %).

### HC-11  WEB-07  UB 305x165x40, 3 m SS, 300 kN (Q) directly over End 2, s<sub>s</sub> = 100

Load through the web at the end station: type (b) with the end-zone type (c)
alongside (s<sub>s</sub> + c = 100 < 2h<sub>w</sub>/3 = 188.7), lower governs;
F<sub>Ed</sub> = max(P, R) = R<sub>2</sub>. Row: D 303.4, B 165.0, t<sub>w</sub> 6.0, t<sub>f</sub> 10.2, mass 40.3.

- type (b): k<sub>F</sub> = 3.5 + 2(283/3000)² = 3.5178, F<sub>cr</sub> = 507.5 kN, l<sub>y</sub> = 254.01, λ̄<sub>F</sub> = 0.9088, χ<sub>F</sub> = 0.5502, F<sub>Rd</sub> = 230.6 kN
- type (c): k<sub>F</sub> = 4.1201, F<sub>cr</sub> = 594.3 kN, l<sub>y</sub> = 166.80, λ̄<sub>F</sub> = 0.6805, χ<sub>F</sub> = 0.7348, F<sub>Rd</sub> = **202.2 kN** (governs)
- R<sub>2</sub> = 1.35 (5 + 0.3953) × 3/2 + 1.5 × 300 = **460.93 kN**; F<sub>Ed</sub>/F<sub>Rd</sub> = 2.279

Engine: 202.226 kN (type c), 460.925 kN (0.000 %).

### HC-12  WEB-06  RHS 250x150x6.3, 3 m SS, 80 kN (Q) at mid-span at e = 40 mm, s<sub>s</sub> = 60

Two webs of thickness t with the tabulated flat depth h<sub>w</sub> = d/t × t = 36.7 × 6.3 =
231.21; flange share per web b<sub>f</sub> = min(B/2 = 75, t + 15εt = 93.66) = 75; m<sub>1</sub> = 11.905,
m<sub>2</sub> = 26.94; k<sub>F</sub> = 6.0119, F<sub>cr</sub> = 1228.8 kN; first pass λ̄<sub>F</sub> ≤ 0.5 so m<sub>2</sub> = 0:
l<sub>y</sub> = 116.07, λ̄<sub>F</sub> = 0.4045, χ<sub>F</sub> = 1.0, F<sub>Rd</sub> per web = 201.1 kN; lever-rule share of the
eccentric load to the near web 0.5 + 40/(150 − 6.3) = 0.7784 → F<sub>Rd</sub> = 201.1/0.7784 = **258.4 kN**.

Engine: 258.362 kN, share 0.778 (0.000 %).

### HC-17  WEB-09  UB 533x210x92, 6 m fixed-fixed, UDL 30 G + 40 Q, end reactions on s<sub>s</sub> = 40 (WEB-04 with fixed ends)

F<sub>Rd</sub> (type c, 301.0 kN) and R = wL/2 (305.16 kN) are those of HC-10; what changes
at a fixed end is the 7.2 interaction, η<sub>2</sub> + 0.8η<sub>1</sub> ≤ 1.4, with
η<sub>1</sub> = M<sub>Ed</sub>/M<sub>c,Rd</sub> at the station taken from the hogging end moment:

- η<sub>2</sub> = 305.16/301.0 = 1.0138; M<sub>end</sub> = wL²/12 = 101.720 × 36/12 = 305.16 kN·m; M<sub>c,Rd</sub> = W<sub>pl</sub>f<sub>y</sub> = 2360 × 10³ × 275 = 649.0 kN·m → η<sub>1</sub> = 0.4702
- (η<sub>2</sub> + 0.8η<sub>1</sub>)/1.4 = **0.9928 at both ends** (the loading and the ends are symmetric)

Engine: End 1 station M<sub>Ed</sub> = 305.16 kN·m = the reaction moment, 0.9928 (0.000 %).
**End 2 station: M<sub>Ed</sub> = 0.00, η<sub>1</sub> = 0, 0.7242 (−27 %): engine finding.**
`webTransverseCheck()` samples the combination diagram with `interpAt(fb.xs, fb.M, s.x)`
exactly at the station; at x = L the grid closes to zero beyond the end reaction
moment (the last two grid values are −305.16 at 5999.9999 and 0 at 6000), so the
End 2 station of any member with R<sub>y</sub> held at End 2 loses its η<sub>1</sub>.
At End 1 the first grid value already carries the reaction moment, so End 1 is
right. The symmetric library cases still get the correct governing station from
End 1; an asymmetric member whose larger hogging moment is at End 2 is
under-checked on the 7.2 interaction. Fix: read the station moment a fraction
inside the member (`s.x >= L - tol ? s.x - 1e-4 : s.x`), as `analyse()` already
does for M<sub>Lend</sub>. Batch cross-check viii-Mend flags it on 71 runs.

## D. Elastic critical moment

### HC-13  UB-04 (standard route)  UB 305x165x40, 6 m SS, UDL 5 G + 6 Q, z<sub>g</sub> = +152 mm

SN003a Table 3.2, simply supported + UDL: C<sub>1</sub> = 1.127, C<sub>2</sub> = 0.454, k = k<sub>w</sub> = 1.
Row: I<sub>z</sub> 764 cm⁴, I<sub>T</sub> 14.7 cm⁴, I<sub>w</sub> 0.164 dm⁶.

- π²EI<sub>z</sub>/L² = 439 855 N; I<sub>w</sub>/I<sub>z</sub> = 21 466 mm²; GI<sub>T</sub>/(π²EI<sub>z</sub>/L²) = 27 070 mm²; C<sub>2</sub>z<sub>g</sub> = 69.008 mm
- M<sub>cr</sub> = 1.127 × 439 855 × [√(21 466 + 27 070 + 69.008²) − 69.008] = **80.23 kN·m** (109.21 kN·m at the shear centre: the load height costs 26.5 %)

Engine: 80.2349 kN·m, C<sub>1</sub> 1.127, C<sub>2</sub> 0.454, z<sub>g</sub> +152 applied (0.000 %).

### HC-14  UB-45 / UB-43 (standard route)  fixed-ended rows of SN003a Table 3.2

UB-45: UC 203x203x60, 6 m fixed-fixed, central point load, z<sub>g</sub> = +105: C<sub>1</sub> = 1.683,
C<sub>2</sub> = 1.645 (I<sub>z</sub> 2060, I<sub>T</sub> 47.2 cm⁴, I<sub>w</sub> 0.197 dm⁶) → **189.46 kN·m**.
UB-43: UB 406x140x39, 8 m fixed-fixed, UDL, z<sub>g</sub> = +203: C<sub>1</sub> = 2.578, C<sub>2</sub> = 1.554
(I<sub>z</sub> 410, I<sub>T</sub> 10.7 cm⁴, I<sub>w</sub> 0.155 dm⁶) → **46.09 kN·m**.

Engine: 189.461 and 46.0888 kN·m (0.000 %).

### HC-15  UB-19 (standard route)  UB 254x102x22, 3 m cantilever, 10 kN tip load, root warping restrained

NCCI SN006a: M<sub>cr</sub> = C × M<sub>cr0</sub>, M<sub>cr0</sub> = (π/L)√(EI<sub>z</sub>GI<sub>T</sub>), κ<sub>wt</sub> = √(EI<sub>w</sub>/GI<sub>T</sub>)/L,
η = z<sub>g</sub>/(h<sub>s</sub>/2) = 0. Row: I<sub>z</sub> 119, I<sub>T</sub> 4.15 cm⁴, I<sub>w</sub> 0.0182 dm⁶, mass 22.0.
Tables (js/01-computation-engine.js SN006, 'restr', η = 0, κ<sub>wt</sub> rows 0.3 / 0.4): F 2.35 / 2.72, q 4.57 / 5.45.

- M<sub>cr0</sub> = **30.351 kN·m**; κ<sub>wt</sub> = 0.3554 → C<sub>F</sub> = 2.5551, C<sub>q</sub> = 5.0578
- factored self-weight moment M<sub>q</sub> = 1.35 × 0.2158 × 4.5 = 1.311 kN·m = 2.8 % of the total (> 2 % de-minimis) → Eq (7): C = (1.311 + 45)/(1.311/5.058 + 45/2.555) = 2.5914
- M<sub>cr</sub> = 2.5914 × 30.351 = **78.65 kN·m**

Engine: 78.6527 kN·m, C 2.5914 (0.000 %). The eigen route gives 79.20 kN·m (ratio 1.007, recorded in results.md, table "Cantilevers (xvii)").

### HC-23  CUS-01 vs UB-03  UB 305x165x40, 6 m SS, UDL 5 G + 6 Q: laterally clamped ends against the SN003a k = 0.5 factor

SN003a Eq (3): M<sub>cr</sub> = C<sub>1</sub>π²EI<sub>z</sub>/(kL)² √[(k/k<sub>w</sub>)² I<sub>w</sub>/I<sub>z</sub> + (kL)²GI<sub>T</sub>/(π²EI<sub>z</sub>)].
Fork ends k = 1, C<sub>1</sub> = 1.127; R<sub>z</sub> restrained at both ends (v′ = 0) k = 0.5, C<sub>1</sub> = 0.972
(Table 3.2, k = 0.5 column), k<sub>w</sub> = 1 (warping free at both ends).

- fork: **109.21 kN·m**; clamped: 0.972 × 4 × 439 855 × √(21 466 + 27 070/4)/10⁶ = **188.38 kN·m**; ratio **1.7249**
- eigen (whole member, actual UDL diagram): fork 109.62 (+0.38 %), clamped 192.44 (+2.16 %); ratio 1.7555 (+1.77 %)

The fork-ended eigenvalue agrees with the closed form to 0.4 %. The 2.2 % on
the clamped member (1.8 % on the ratio) is a method difference: the k = 0.5
column of SN003a Table 3.2 is a tabulated approximation of the v′ = 0 boundary
condition, the eigenvalue is the exact solution of the same equations with that
boundary condition on the same diagram; the closed form is on the conservative
side. Not an engine defect; the batch pair check xvi-McrPair (results.md,
"End-restraint bounds") records the two ratios beside each other for every pair.

## E. Channel torsional-flexural buckling, high shear, A<sub>eff</sub>

### HC-18  TFB-01  PFC 200x90x30, 4 m SS, N = 80 kN, L<sub>T</sub> = L<sub>cr,z</sub> = 4 m

EN 1993-1-1 6.3.1.4. Row: A 37.9 cm², I<sub>y</sub> 2520 cm⁴, i<sub>y</sub> 8.16, i<sub>z</sub> 2.88 cm; P385 Table: I<sub>T</sub> 19.1 cm⁴,
I<sub>w</sub> 0.0197 dm⁶, e<sub>sc</sub> = y<sub>0</sub> = 63.7 mm.

- i<sub>0</sub>² = 81.6² + 28.8² + 63.7² = 11 545.7 mm²; N<sub>cr,T</sub> = (GI<sub>T</sub> + π²EI<sub>w</sub>/L<sub>T</sub>²)/i<sub>0</sub>² = (1.5471 × 10¹⁰ + 2.5519 × 10⁹)/11 545.7 = **1561.0 kN**
- N<sub>cr,y</sub> = π²EI<sub>y</sub>/L² = 3264.4 kN; β = 1 − (y<sub>0</sub>/i<sub>0</sub>)² = 0.6486; N<sub>cr,TF</sub> = (N<sub>cr,y</sub> + N<sub>cr,T</sub>)/(2β) [1 − √(1 − 4βN<sub>cr,y</sub>N<sub>cr,T</sub>/(N<sub>cr,y</sub> + N<sub>cr,T</sub>)²)] = **1274.3 kN**
- λ̄<sub>T</sub> = √(3790 × 275/1 274 260) = 0.9044; curve c: Φ = 1.0815, χ<sub>T</sub> = 0.5971; N<sub>b,T,Rd</sub> = **622.4 kN**; N<sub>Ed</sub>/N<sub>b,T,Rd</sub> = 0.128

Engine: 1561.01, 1274.26, 622.363 kN (0.000 %).

### HC-19  HSV-04  RHS 300x100x10, 2 m SS, 470 kN (Q) at 0.3 m: high-shear M<sub>v,y,Rd</sub>

Row: A 74.9 cm², W<sub>pl,y</sub> 666 cm³, mass 58.8. A<sub>v</sub> = A h/(b + h) = 5617.5 mm²,
V<sub>pl,Rd</sub> = **891.9 kN**. At x = 0.3 m (support side): R<sub>1</sub> = 705 × 1.7/2 + w<sub>sw</sub> = 600.03 kN,
V = 599.80 kN, M = 179.97 kN·m; ρ = (2 × 599.8/891.9 − 1)² = 0.1190;
M<sub>v,y,Rd</sub> = (666 000 − 0.1190 × 10 × 280²/2) × 275 = **170.32 kN·m** (two webs); M/M<sub>v</sub> = **1.0567**.

Engine: 170.320 kN·m, 891.898 kN, 1.05668 (0.000 %).

### HC-20  AEF-01  UB 1016x305x222, S275 (t<sub>f</sub> 21.1 → 265 N/mm²), N = 1500 kN

EN 1993-1-5 4.4, ψ = 1, k<sub>σ</sub> = 4: ε = 0.9417, 42ε = 39.55 < d/t = 54.3 → Class 4;
λ̄<sub>p</sub> = 54.3/(28.4 × 0.9417 × 2) = 1.0152; ρ = (1.0152 − 0.22)/1.0152² = 0.7716;
A<sub>eff</sub> = 28 300 − 0.2284 × 868.1 × 16 = **25 127 mm²** (0.888 A); N<sub>c,Rd</sub> = 6658.7 kN; N<sub>Ed</sub>/N<sub>c,Rd</sub> = **0.2253**.

Engine: 25 127.3 mm², 0.225268 (0.000 %).

## F. Warping torsion (Vlasov closed forms)

### HC-21  UB-49 / TOR-07  UB 457x191x82, 4 m cantilever, 20 kN (Q) at the tip at e = 80 mm

T = 1.5 × 20 × 80 = 2400 kN·mm. P385 Table: I<sub>T</sub> 69.2 cm⁴, I<sub>w</sub> 0.922 dm⁶ → GI<sub>T</sub> = 5.6052 × 10¹⁰ N·mm²,
EI<sub>w</sub> = 1.9362 × 10¹⁷ N·mm⁴, a = √(EI<sub>w</sub>/GI<sub>T</sub>) = 1858.6 mm (P385: 1.86 m), L/a = 2.1522, tanh = 0.97334.

- root warping fixed (UB-49): φ(L) = (T/GI<sub>T</sub>)[L − a tanh(L/a)] = 4.2817 × 10⁻⁵ × (4000 − 1809.0) = **0.09381 rad**; B(0) = T a tanh(L/a) = **4.3417 kN·m²**
- root warping free (TOR-07): the solution of EI<sub>w</sub>φ⁗ − GI<sub>T</sub>φ″ = 0 with φ(0) = 0, φ″(0) = 0 (natural), φ″(L) = 0, torque T at L is linear, φ = Tx/GI<sub>T</sub>: pure St Venant, **φ(L) = TL/GI<sub>T</sub> = 0.17127 rad**, B ≡ 0

Engine: 0.0938118 rad, 4.34166 kN·m² (UB-49); 0.171270 rad, B<sub>max</sub> 6.7 × 10⁻⁸ kN·m² (noise), root St Venant torque 2.400 kN·m = T (TOR-07), 0.000 %.
**TOR-07 finding:** the engine's mesh measure reports 43 % and blocks PASS ("mesh has not converged"):
`warpingTorsionFE()` takes the largest relative change of max|φ|, max|φ′| and max|B|
between the 120- and 240-element meshes, and with B being round-off (10⁻⁸ against a
physical scale T·a ≈ 4.5 kN·m²) the relative change of B is meaningless. Fix: normalise
the bimoment part by a physical scale (e.g. max(T<sub>max</sub>·a, max|B|)) or drop it when
max|B| is below 10⁻⁶ of that scale. Every other warping-free case in the library carries
a distributed torque or a mid-span torque, where B is real and the measure converges.

### HC-22  TOR-05 / UB-51  distributed torques

TOR-05: UB 305x165x40, 3 m cantilever, UDL 3 G + 5 Q at e = 80 mm: uniform torque
m = (1.35 × 3 + 1.5 × 5) × 80 = 924 N·mm/mm; root warping fixed, tip free. Solving
EI<sub>w</sub>φ⁗ − GI<sub>T</sub>φ″ = m with φ(0) = φ′(0) = 0, B(L) = 0, T(L) = 0: the particular
solution is −mx²/(2GI<sub>T</sub>); with the homogeneous part A + Bx + C cosh(x/a) + D sinh(x/a)
the four conditions give φ(L) = (m/GI<sub>T</sub>)[L²/2 + a²(1 − sech(L/a)) − aL tanh(L/a)].
a = 1700.7 mm, L/a = 1.7640 → **φ(L) = 0.12559 rad** (St Venant alone 0.3492 rad);
root torque mL = **2.772 kN·m**.

UB-51: UB 457x191x82, 8 m SS, UDL 5 G + 8 Q at e = 100 mm, both ends warping fixed:
t = 1875 N·mm/mm, φ = φ′ = 0 at both ends: φ(L/2) = (t/GI<sub>T</sub>)[L²/8 − (La/2) tanh(L/4a)],
L/(4a) = 1.0761 → **0.07071 rad** (fork ends would give 0.1786 rad).

Engine: 0.125587 rad, 2.772 kN·m, 0.0707132 rad (0.000 %).

## Comparison table

| # | Case / quantity | Hand value | Engine value | Diff % |
|---|---|---|---|---|
| HC-01 | UB-71 guided-fixed: M at the fixed End 1 = wL²/3 | 127.004 kN·m | 127.004 kN·m | +0.000 |
| HC-01b | UB-71 guided-fixed: M at the guided End 2 = wL²/6 | 63.5019 kN·m | 63.5019 kN·m | +0.000 |
| HC-01c | UB-71 guided-fixed: R<sub>1</sub> = wL | 63.5019 kN | 63.5019 kN | +0.000 |
| HC-01d | UB-71 guided-fixed: tip deflection wL⁴/24EI (SLS Q) | 12.1008 mm | 12.1008 mm | +0.000 |
| HC-02 | UB-72 guided-fixed tip load: M<sub>1</sub> = PL/2 + wL²/3 | 249.347 kN·m | 249.347 kN·m | +0.000 |
| HC-02b | UB-72 guided-fixed tip load: M<sub>2</sub> = PL/2 + wL²/6 | 245.049 kN·m | 245.049 kN·m | +0.000 |
| HC-02c | UB-72 guided-fixed tip load: deflection PL³/12EI | 18.3346 mm | 18.3346 mm | +0.000 |
| HC-03 | UB-21 fixed-fixed UDL: M<sub>end</sub> = wL²/12 (End 1) | 86.7547 kN·m | 86.7547 kN·m | −0.000 |
| HC-03b | UB-21 fixed-fixed UDL: R = wL/2 | 65.0660 kN | 65.0660 kN | −0.000 |
| HC-03c | UB-21 fixed-fixed UDL: d<sub>mid</sub> = wL⁴/384EI | 2.43810 mm | 2.43810 mm | −0.000 |
| HC-04 | UB-53 fixed-fixed central P: M<sub>end</sub> = PL/8 + wL²/12 | 311.792 kN·m | 311.792 kN·m | +0.000 |
| HC-04b | UB-53 fixed-fixed central P: d<sub>mid</sub> = PL³/192EI | 5.13413 mm | 5.13413 mm | +0.000 |
| HC-05 | UB-64 cantilever UDL: M<sub>root</sub> = wL²/2 | 99.6014 kN·m | 99.6014 kN·m | +0.000 |
| HC-05b | UB-64 cantilever UDL: d<sub>tip</sub> = wL⁴/8EI | 5.10504 mm | 5.10504 mm | +0.000 |
| HC-05c | UB-19 cantilever tip load: M<sub>root</sub> = PL + wL²/2 | 46.3110 kN·m | 46.3110 kN·m | +0.000 |
| HC-05d | UB-19 cantilever tip load: d<sub>tip</sub> = PL³/3EI | 15.0905 mm | 15.0905 mm | +0.000 |
| HC-06 | UB-76 pinned-guided UDL: M<sub>2</sub> = wL²/2 | 84.6692 kN·m | 84.6692 kN·m | −0.000 |
| HC-06b | UB-76 pinned-guided UDL: R<sub>1</sub> = wL | 42.3346 kN | 42.3346 kN | −0.000 |
| HC-06c | UB-76 pinned-guided UDL: d<sub>tip</sub> = 5wL⁴/24EI | 11.9514 mm | 11.9514 mm | −0.000 |
| HC-06d | UB-77 pinned-guided tip load: M<sub>2</sub> = PL + wL²/2 | 212.956 kN·m | 212.956 kN·m | −0.000 |
| HC-06e | UB-77 pinned-guided tip load: d<sub>tip</sub> = PL³/3EI | 21.2206 mm | 21.2206 mm | −0.000 |
| HC-07 | UB-20 propped UDL: M<sub>fixed</sub> = wL²/8 | 85.9052 kN·m | 85.9052 kN·m | +0.000 |
| HC-07b | UB-20 propped UDL: R<sub>pinned</sub> = 3wL/8 | 42.9526 kN | 42.9526 kN | +0.000 |
| HC-07c | UB-20 propped UDL: d<sub>max</sub> = 0.005416 wL⁴/EI at 0.4215 L from the pin | 3.26327 mm | 3.26302 mm | −0.008 |
| HC-08 | AX-04 guided-fixed: L<sub>cr,y</sub> = 1.2 L | 7200.00 mm | 7200.00 mm | +0.000 |
| HC-08b | AX-04 guided-fixed: L<sub>cr,z</sub> = 0.7 L | 4200.00 mm | 4200.00 mm | +0.000 |
| HC-08c | AX-04 N<sub>b,y,Rd</sub> (curve b, 1.2 L) | 1936.63 kN | 1936.63 kN | +0.000 |
| HC-08d | AX-04 N<sub>b,z,Rd</sub> (curve c, 0.7 L) | 1781.09 kN | 1781.09 kN | +0.000 |
| HC-09 | WEB-01 F<sub>Rd</sub> type (a) mid-span point load, s<sub>s</sub> = 0 | 636.914 kN | 636.914 kN | +0.000 |
| HC-10 | WEB-04 F<sub>Rd</sub> type (c) end reaction, s<sub>s</sub> = 40 | 301.001 kN | 301.001 kN | +0.000 |
| HC-10b | WEB-04 end reaction F<sub>Ed</sub> (statics) | 305.159 kN | 305.159 kN | −0.000 |
| HC-11 | WEB-07 F<sub>Rd</sub> at the end station, load through the web over End 2 (lower of (b) and (c)) | 202.226 kN | 202.226 kN | +0.000 |
| HC-11b | WEB-07 F<sub>Ed</sub> = R<sub>2</sub> (simply supported statics) | 460.926 kN | 460.925 kN | −0.000 |
| HC-12 | WEB-06 RHS two-web F<sub>Rd</sub> with the lever-rule share | 258.362 kN | 258.362 kN | +0.000 |
| HC-17 | WEB-09 F<sub>Rd</sub> type (c) at the fixed end, s<sub>s</sub> = 40 | 301.001 kN | 301.001 kN | +0.000 |
| HC-17b | WEB-09 7.2 interaction (η<sub>2</sub> + 0.8η<sub>1</sub>)/1.4 at End 1 with M<sub>Ed</sub> = wL²/12 | 0.992839 | 0.992839 | −0.000 |
| HC-17c | WEB-09 7.2 interaction at End 2 (engine finding: the station reads M = 0) | 0.992839 | 0.724154 | −27.062 (FINDING) |
| HC-13 | UB-04 standard M<sub>cr</sub>, SS UDL, C<sub>1</sub> 1.127 / C<sub>2</sub> 0.454, z<sub>g</sub> +152 | 80.2349 kN·m | 80.2349 kN·m | +0.000 |
| HC-14 | UB-45 standard M<sub>cr</sub>, fixed-ended central point load, C<sub>1</sub> 1.683 / C<sub>2</sub> 1.645, z<sub>g</sub> +105 | 189.461 kN·m | 189.461 kN·m | +0.000 |
| HC-14b | UB-43 standard M<sub>cr</sub>, fixed-ended UDL, C<sub>1</sub> 2.578 / C<sub>2</sub> 1.554, z<sub>g</sub> +203 | 46.0888 kN·m | 46.0888 kN·m | +0.000 |
| HC-15 | UB-19 SN006a M<sub>cr</sub> = C M<sub>cr0</sub>, tip load + self-weight, warping restrained | 78.6527 kN·m | 78.6527 kN·m | +0.000 |
| HC-15b | UB-19 M<sub>cr0</sub> = (π/L)√(EI<sub>z</sub>GI<sub>T</sub>) | 30.3514 kN·m | 30.3514 kN·m | +0.000 |
| HC-23 | UB-03 fork-ended eigen M<sub>cr</sub> against the SN003a k = 1 closed form | 109.211 kN·m | 109.623 kN·m | +0.377 |
| HC-23b | CUS-01 laterally clamped eigen M<sub>cr</sub> against the SN003a k = 0.5 closed form | 188.382 kN·m | 192.445 kN·m | +2.157 (method difference) |
| HC-23c | ratio M<sub>cr</sub>(clamped)/M<sub>cr</sub>(fork): SN003a k = 0.5 factor against the eigen ratio | 1.72493 | 1.75551 | +1.773 (method difference) |
| HC-18 | TFB-01 N<sub>cr,T</sub> | 1561.01 kN | 1561.01 kN | +0.000 |
| HC-18b | TFB-01 N<sub>cr,TF</sub> (coupled with the y-y mode) | 1274.26 kN | 1274.26 kN | +0.000 |
| HC-18c | TFB-01 N<sub>b,T,Rd</sub> (curve c) | 622.363 kN | 622.363 kN | −0.000 |
| HC-19 | HSV-04 M<sub>v,y,Rd</sub> (RHS two-web form) at x = 0.3 m | 170.320 kN·m | 170.320 kN·m | +0.000 |
| HC-19b | HSV-04 V<sub>pl,Rd</sub> (A<sub>v</sub> = A h/(b + h)) | 891.898 kN | 891.898 kN | +0.000 |
| HC-19c | HSV-04 M/M<sub>v,y,Rd</sub> | 1.05668 | 1.05668 | −0.000 |
| HC-20 | AEF-01 A<sub>eff</sub> (EN 1993-1-5 4.4) | 25127.3 mm² | 25127.3 mm² | +0.000 |
| HC-20b | AEF-01 N<sub>Ed</sub>/N<sub>c,Rd</sub> with A<sub>eff</sub> | 0.225268 | 0.225268 | +0.000 |
| HC-21 | UB-49 cantilever tip twist φ(L), tip torque, root warping fixed | 0.0938118 rad | 0.0938118 rad | +0.000 |
| HC-21b | UB-49 root bimoment B(0) = T a tanh(L/a) | 4.34166 kN·m² | 4.34166 kN·m² | +0.000 |
| HC-21c | TOR-07 cantilever tip twist, root warping FREE: φ(L) = TL/GI<sub>T</sub> | 0.171270 rad | 0.171270 rad | +0.000 |
| HC-22 | TOR-05 cantilever tip twist, uniform torque | 0.125587 rad | 0.125587 rad | +0.000 |
| HC-22b | TOR-05 root torque mL | 2.77200 kN·m | 2.77200 kN·m | +0.000 |
| HC-22c | UB-51 mid-span twist, warping-fixed ends | 0.0707132 rad | 0.0707132 rad | −0.000 |

59 comparisons, 3 above 1 % (0 unexpected: HC-17c is the End 2 station finding, HC-23b / HC-23c the SN003a k = 0.5 method difference).
