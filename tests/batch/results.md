# Batch verification results

Generated 2026-09-19T05:15:45.172Z with Node v24.14.1; 114 cases, 208 runs (LTB cases run with both Mcr methods), 191.2 s.

Verdicts: PASS 168 | FAIL 34 | NOT VERIFIED 6 | ERROR 0. Cross-check failures: 0 runs. Eigen/standard Mcr ratio outliers (outside 0.85-1.25, same segment): 8; across the two runs (whole-member standard vs design eigen): 37.

## Verdict counts per section family

| Family | Cases | Runs | PASS | FAIL | NOT VERIFIED | ERROR |
|---|---|---|---|---|---|---|
| UB | 51 | 94 | 75 | 17 | 2 | 0 |
| UC | 15 | 28 | 26 | 2 | 0 | 0 |
| PFC | 19 | 34 | 23 | 9 | 2 | 0 |
| SHS | 11 | 18 | 14 | 2 | 2 | 0 |
| RHS | 18 | 34 | 30 | 4 | 0 | 0 |

## Verdict counts per Mcr method

| Method | Runs | PASS | FAIL | NOT VERIFIED | ERROR |
|---|---|---|---|---|---|
| eigen | 94 | 85 | 7 | 2 | 0 |
| standard | 94 | 65 | 26 | 3 | 0 |
| n/a (restrained) | 20 | 18 | 1 | 1 | 0 |

## Cross-check totals

| Check | Runs | OK | Mismatch |
|---|---|---|---|
| i-Mmax | 115 | 115 | 0 |
| i-dmax | 115 | 115 | 0 |
| ii-equilibrium | 208 | 208 | 0 |
| vi-governing | 208 | 208 | 0 |
| iii-McrStd | 158 | 158 | 0 |
| iv-McrRatio | 94 | 86 | 8 |
| v-MbRd<=McRd | 188 | 188 | 0 |
| iii-zgBlock | 76 | 76 | 0 |

## Eigen / standard Mcr outliers (same segment, from the eigen run)

| Case | Ratio | Standard route | Mcr eigen | Mcr standard | Note |
|---|---|---|---|---|---|
| UB-23 | 1.446 | serna | 247.0 | 170.8 | UB 457x191x67, 7 m span + 2 m overhang, UDL + tip point load |
| UB-27 | 0.830 | serna | 317.5 | 382.3 | UB 457x191x82, 8 m SS, UDL + in-span couple at 4 m + point load at 2 m (mixed) |
| UB-40 | 1.657 | uniform | 335.1 | 202.3 | UB 533x210x92, 8 m SS, full UDL, LE factor 1.2 + destabilising switch |
| UB-44 | 0.679 | serna | 120.5 | 177.4 | UB 406x178x54, 7 m SS, point load at 0.35L, top-flange loading zg = +D/2 (no published C2: standard route blocked) |
| PFC-09 | 1.996 | channel | 300.6 | 150.5 | PFC 300x90x41, 3.5 m cantilever, full UDL through the shear centre |
| SHS-06 | 1.397 | cantilever | 28510.8 | 20404.6 | SHS 300x300x10.0 HF, 4 m cantilever, tip point load + UDL |
| RHS-07 | 1.690 | cantilever | 892.1 | 527.9 | RHS 160x80x5.0, 3 m cantilever, UDL + tip point load |
| MIX-06 | 1.724 | serna | 345.8 | 200.6 | UB 254x146x31, 6 m fixed-hinge-pinned (hinge at 3 m), full UDL |

## Expected-vs-observed trigger mismatches (comparable subset)

| Case | Method | Expected but not observed | Observed but not expected |
|---|---|---|---|
| PFC-17 | eigen | 3.8 | - |
| PFC-17 | standard | 3.8 | - |

## Runs

| Id | Title | Section | Method | Verdict | Governing check (util) | Mcr kN.m | C1 | lamLT | chiLT | Mb,Rd | Mc,Rd | Vpl,Rd | d/dlim | Unsupported / blocking | ms |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| UB-01 | UB 457x191x82, 8 m SS, full UDL G+Q (demo), fully restrained | UB 457x191x82 | n/a (restrained) | PASS | Bending  M_Ed/M_c,Rd (0.912) | - | - | - | - | - | 503.3 | 756.3 | 0.610 | - | 129 |
| UB-02 | UB 457x191x82, 8 m SS, full UDL G+Q (demo), unrestrained (deliberately heavy) | UB 457x191x82 | eigen | FAIL | LTB  M_Ed/M_b,Rd (2.099) | 258.0 | 1.131 | 1.397 | 0.435 | 218.7 | 503.3 | 756.3 | 0.610 | - | 1333 |
| UB-02 | UB 457x191x82, 8 m SS, full UDL G+Q (demo), unrestrained (deliberately heavy) | UB 457x191x82 | standard | FAIL | LTB  M_Ed/M_b,Rd (2.105) | 257.1 | 1.127 | 1.399 | 0.433 | 218.1 | 503.3 | 756.3 | 0.610 | - | 130 |
| UB-03 | UB 305x165x40, 6 m SS, full UDL, unrestrained, load at shear centre | UB 305x165x40 | eigen | PASS | LTB  M_Ed/M_b,Rd (0.763) | 109.6 | 1.131 | 1.250 | 0.561 | 96.1 | 171.3 | 318.6 | 0.340 | - | 1171 |
| UB-03 | UB 305x165x40, 6 m SS, full UDL, unrestrained, load at shear centre | UB 305x165x40 | standard | PASS | LTB  M_Ed/M_b,Rd (0.765) | 109.2 | 1.127 | 1.252 | 0.559 | 95.8 | 171.3 | 318.6 | 0.340 | - | 126 |
| UB-04 | UB 305x165x40, 6 m SS, full UDL, top-flange loading zg = +D/2 | UB 305x165x40 | eigen | PASS | LTB  M_Ed/M_b,Rd (0.951) | 81.1 | 1.131 | 1.453 | 0.450 | 77.1 | 171.3 | 318.6 | 0.340 | - | 1467 |
| UB-04 | UB 305x165x40, 6 m SS, full UDL, top-flange loading zg = +D/2 | UB 305x165x40 | standard | PASS | LTB  M_Ed/M_b,Rd (0.959) | 80.2 | 1.127 | 1.461 | 0.446 | 76.4 | 171.3 | 318.6 | 0.340 | - | 182 |
| UB-05 | UB 305x165x40, 6 m SS, full UDL, bottom-flange loading zg = -D/2 | UB 305x165x40 | eigen | PASS | LTB  M_Ed/M_b,Rd (0.808) | 148.3 | 1.131 | 1.075 | 0.671 | 115.0 | 171.3 | 318.6 | 0.454 | - | 1524 |
| UB-05 | UB 305x165x40, 6 m SS, full UDL, bottom-flange loading zg = -D/2 | UB 305x165x40 | standard | PASS | LTB  M_Ed/M_b,Rd (0.807) | 148.7 | 1.127 | 1.074 | 0.671 | 115.0 | 171.3 | 318.6 | 0.454 | - | 110 |
| UB-06 | UB 406x178x54, 7 m SS, central point load with a lateral restraint at the load | UB 406x178x54 | eigen | PASS | LTB  M_Ed/M_b,Rd (0.841) | 703.6 | 1.837 | 0.641 | 0.862 | 248.8 | 288.8 | 529.1 | 0.561 | - | 2959 |
| UB-06 | UB 406x178x54, 7 m SS, central point load with a lateral restraint at the load | UB 406x178x54 | standard | FAIL | LTB  M_Ed/M_b,Rd (1.503) | 166.3 | 1.348 | 1.318 | 0.482 | 139.1 | 288.8 | 529.1 | 0.561 | - | 157 |
| UB-07 | UB 406x178x54, 7 m SS, central point load, unrestrained | UB 406x178x54 | eigen | PASS | LTB  M_Ed/M_b,Rd (0.837) | 166.9 | 1.352 | 1.315 | 0.483 | 139.5 | 288.8 | 529.1 | 0.299 | - | 1348 |
| UB-07 | UB 406x178x54, 7 m SS, central point load, unrestrained | UB 406x178x54 | standard | PASS | LTB  M_Ed/M_b,Rd (0.839) | 166.3 | 1.348 | 1.318 | 0.482 | 139.1 | 288.8 | 529.1 | 0.299 | - | 161 |
| UB-08 | UB 533x210x92, 10 m SS, two point loads at 3 and 7 m + UDL, restraints at third points | UB 533x210x92 | eigen | PASS | LTB  M_Ed/M_b,Rd (0.765) | 1271.4 | 1.004 | 0.714 | 0.817 | 530.1 | 649.0 | 908.7 | 0.512 | - | 3290 |
| UB-08 | UB 533x210x92, 10 m SS, two point loads at 3 and 7 m + UDL, restraints at third points | UB 533x210x92 | standard | FAIL | LTB  M_Ed/M_b,Rd (1.855) | 238.1 | 1.101 | 1.651 | 0.337 | 218.6 | 649.0 | 908.7 | 0.512 | - | 161 |
| UB-09 | UB 254x146x31, 5 m SS, partial UDL 1-4 m + full G | UB 254x146x31 | eigen | PASS | LTB  M_Ed/M_b,Rd (0.873) | 78.0 | 1.149 | 1.177 | 0.607 | 65.6 | 108.1 | 260.3 | 0.566 | - | 1363 |
| UB-09 | UB 254x146x31, 5 m SS, partial UDL 1-4 m + full G | UB 254x146x31 | standard | PASS | LTB  M_Ed/M_b,Rd (0.869) | 78.5 | 1.156 | 1.174 | 0.610 | 65.9 | 108.1 | 260.3 | 0.566 | - | 76 |
| UB-10 | UB 356x171x45, 7 m SS, triangular load rising 0 -> 11 kN/m | UB 356x171x45 | eigen | PASS | LTB  M_Ed/M_b,Rd (0.915) | 101.0 | 1.141 | 1.453 | 0.409 | 87.3 | 213.1 | 424.9 | 0.349 | - | 1417 |
| UB-10 | UB 356x171x45, 7 m SS, triangular load rising 0 -> 11 kN/m | UB 356x171x45 | standard | PASS | LTB  M_Ed/M_b,Rd (0.912) | 101.4 | 1.146 | 1.450 | 0.411 | 87.5 | 213.1 | 424.9 | 0.349 | - | 86 |
| UB-11 | UB 356x171x45, 7 m SS, triangular load falling 26 -> 0 kN/m, fully restrained | UB 356x171x45 | n/a (restrained) | PASS | Deflection (0.824) | - | - | - | - | - | 213.1 | 424.9 | 0.824 | - | 94 |
| UB-12 | UB 457x152x52, 6 m SS, trapezoidal 6 -> 16 kN/m | UB 457x152x52 | eigen | PASS | LTB  M_Ed/M_b,Rd (0.889) | 129.7 | 1.134 | 1.527 | 0.379 | 114.7 | 302.5 | 578.4 | 0.248 | - | 1345 |
| UB-12 | UB 457x152x52, 6 m SS, trapezoidal 6 -> 16 kN/m | UB 457x152x52 | standard | PASS | LTB  M_Ed/M_b,Rd (0.887) | 130.2 | 1.139 | 1.524 | 0.380 | 115.0 | 302.5 | 578.4 | 0.248 | - | 83 |
| UB-13 | UB 610x229x125, 12 m SS, full UDL, restraints at third points | UB 610x229x125 | eigen | PASS | LTB  M_Ed/M_b,Rd (0.840) | 1730.8 | 1.015 | 0.751 | 0.795 | 774.8 | 975.2 | 1171.1 | 0.548 | - | 2948 |
| UB-13 | UB 610x229x125, 12 m SS, full UDL, restraints at third points | UB 610x229x125 | standard | FAIL | LTB  M_Ed/M_b,Rd (1.998) | 354.0 | 1.127 | 1.660 | 0.334 | 325.8 | 975.2 | 1171.1 | 0.548 | - | 132 |
| UB-14 | UB 686x254x140, 2 x 6 m continuous, full UDL | UB 686x254x140 | eigen | PASS | LTB  M_Ed/M_b,Rd (0.675) | 2665.8 | 2.261 | 0.673 | 0.842 | 1017.5 | 1208.4 | 1372.8 | 0.088 | - | 2886 |
| UB-14 | UB 686x254x140, 2 x 6 m continuous, full UDL | UB 686x254x140 | standard | FAIL | LTB  M_Ed/M_b,Rd (1.504) | 515.8 | 1.276 | 1.531 | 0.378 | 456.5 | 1208.4 | 1372.8 | 0.088 | - | 86 |
| UB-15 | UB 762x267x147, 3 x 5 m continuous, G full + Q on outer spans (unbalanced pattern) | UB 762x267x147 | eigen | PASS | LTB  M_Ed/M_b,Rd (0.456) | 2181.7 | 1.190 | 0.792 | 0.769 | 1051.4 | 1367.4 | 1563.6 | 0.113 | - | 3999 |
| UB-15 | UB 762x267x147, 3 x 5 m continuous, G full + Q on outer spans (unbalanced pattern) | UB 762x267x147 | standard | PASS | LTB  M_Ed/M_b,Rd (0.711) | 761.9 | 2.421 | 1.340 | 0.493 | 673.9 | 1367.4 | 1563.6 | 0.113 | - | 113 |
| UB-16 | UB 914x305x224, 16 m SS deep beam, full UDL, fully restrained | UB 914x305x224 | n/a (restrained) | PASS | Bending  M_Ed/M_c,Rd (0.855) | - | - | - | - | - | 2525.4 | 2349.6 | 0.608 | - | 107 |
| UB-17 | UB 1016x305x272, 2 x 9 m continuous, full UDL, restraints at 3 m centres | UB 1016x305x272 | eigen | PASS | Bending  M_Ed/M_c,Rd (0.611) | 42466.1 | 1.421 | 0.283 | 1.000 | 3392.0 | 3392.0 | 2826.1 | 0.098 | - | 9370 |
| UB-17 | UB 1016x305x272, 2 x 9 m continuous, full UDL, restraints at 3 m centres | UB 1016x305x272 | standard | FAIL | LTB  M_Ed/M_b,Rd (2.221) | 1134.2 | 1.276 | 1.729 | 0.275 | 932.8 | 3392.0 | 2826.1 | 0.098 | - | 83 |
| UB-18 | UB 203x133x25, 4 m cantilever, UDL + tip point load, warping free at root | UB 203x133x25 | eigen | PASS | Deflection (0.830) | 92.3 | 4.023 | 0.877 | 0.774 | 54.9 | 71.0 | 204.0 | 0.830 | - | 1355 |
| UB-18 | UB 203x133x25, 4 m cantilever, UDL + tip point load, warping free at root | UB 203x133x25 | standard | PASS | Deflection (0.830) | 90.4 | 2.061 | 0.886 | 0.768 | 54.5 | 71.0 | 204.0 | 0.830 | - | 107 |
| UB-19 | UB 254x102x22, 3 m cantilever, tip point load, root warping restrained | UB 254x102x22 | eigen | PASS | LTB  M_Ed/M_b,Rd (0.969) | 79.2 | 3.475 | 0.948 | 0.671 | 47.8 | 71.2 | 247.7 | 0.905 | - | 1426 |
| UB-19 | UB 254x102x22, 3 m cantilever, tip point load, root warping restrained | UB 254x102x22 | standard | PASS | LTB  M_Ed/M_b,Rd (0.972) | 78.7 | 2.591 | 0.952 | 0.669 | 47.6 | 71.2 | 247.7 | 0.905 | - | 125 |
| UB-20 | UB 305x127x37, 6 m propped cantilever, full UDL | UB 305x127x37 | eigen | PASS | LTB  M_Ed/M_b,Rd (0.855) | 136.5 | 1.615 | 1.042 | 0.677 | 100.4 | 148.2 | 372.4 | 0.196 | - | 1447 |
| UB-20 | UB 305x127x37, 6 m propped cantilever, full UDL | UB 305x127x37 | standard | PASS | LTB  M_Ed/M_b,Rd (0.864) | 122.9 | 2.197 | 1.098 | 0.671 | 99.4 | 148.2 | 372.4 | 0.196 | - | 113 |
| UB-21 | UB 406x140x39, 8 m fixed-fixed, full UDL (h/b > 2, curve c) | UB 406x140x39 | eigen | PASS | LTB  M_Ed/M_b,Rd (0.828) | 129.1 | 1.360 | 1.242 | 0.526 | 104.7 | 199.1 | 438.5 | 0.110 | - | 1247 |
| UB-21 | UB 406x140x39, 8 m fixed-fixed, full UDL (h/b > 2, curve c) | UB 406x140x39 | standard | PASS | LTB  M_Ed/M_b,Rd (0.888) | 109.9 | 2.578 | 1.346 | 0.491 | 97.7 | 199.1 | 438.5 | 0.110 | - | 83 |
| UB-22 | UB 610x178x82, 9 m SS, full UDL (h/b > 3.1, curve d), deliberately heavy | UB 610x178x82 | eigen | FAIL | LTB  M_Ed/M_b,Rd (1.728) | 161.9 | 1.131 | 1.929 | 0.232 | 139.9 | 602.3 | 1000.1 | 0.233 | - | 1315 |
| UB-22 | UB 610x178x82, 9 m SS, full UDL (h/b > 3.1, curve d), deliberately heavy | UB 610x178x82 | standard | FAIL | LTB  M_Ed/M_b,Rd (1.733) | 161.3 | 1.127 | 1.932 | 0.232 | 139.5 | 602.3 | 1000.1 | 0.233 | - | 79 |
| UB-23 | UB 457x191x67, 7 m span + 2 m overhang, UDL + tip point load | UB 457x191x67 | eigen | PASS (ratio outlier) | LTB  M_Ed/M_b,Rd (0.852) | 247.0 | 1.234 | 1.279 | 0.498 | 201.3 | 404.3 | 649.9 | 0.191 | - | 1402 |
| UB-23 | UB 457x191x67, 7 m span + 2 m overhang, UDL + tip point load | UB 457x191x67 | standard | FAIL | LTB  M_Ed/M_b,Rd (1.132) | 170.8 | 1.279 | 1.538 | 0.375 | 151.6 | 404.3 | 649.9 | 0.191 | - | 92 |
| UB-24 | UB 533x165x66, 3 x 4 m Gerber beam, internal hinge at 6 m, full UDL | UB 533x165x66 | eigen | PASS | LTB  M_Ed/M_b,Rd (0.754) | 753.4 | 2.261 | 0.755 | 0.720 | 308.8 | 429.0 | 793.3 | 0.122 | - | 4280 |
| UB-24 | UB 533x165x66, 3 x 4 m Gerber beam, internal hinge at 6 m, full UDL | UB 533x165x66 | standard | PASS | LTB  M_Ed/M_b,Rd (0.765) | 383.9 | 5.916 | 1.057 | 0.709 | 304.1 | 429.0 | 793.3 | 0.122 | - | 181 |
| UB-25 | UB 356x127x33, 6 m SS, equal end couples (uniform moment, psi = 1) | UB 356x127x33 | eigen | PASS | LTB  M_Ed/M_b,Rd (0.825) | 45.8 | 1.050 | 1.806 | 0.292 | 43.6 | 149.3 | 365.6 | 0.374 | - | 1316 |
| UB-25 | UB 356x127x33, 6 m SS, equal end couples (uniform moment, psi = 1) | UB 356x127x33 | standard | PASS | LTB  M_Ed/M_b,Rd (0.858) | 43.6 | 1.000 | 1.851 | 0.281 | 42.0 | 149.3 | 365.6 | 0.374 | - | 92 |
| UB-26 | UB 356x127x33, 6 m SS, single end couple (linear gradient, psi = 0) | UB 356x127x33 | eigen | PASS | LTB  M_Ed/M_b,Rd (0.823) | 83.9 | 1.926 | 1.334 | 0.488 | 72.9 | 149.3 | 365.6 | 0.320 | - | 1350 |
| UB-26 | UB 356x127x33, 6 m SS, single end couple (linear gradient, psi = 0) | UB 356x127x33 | standard | PASS | LTB  M_Ed/M_b,Rd (0.894) | 77.1 | 1.769 | 1.392 | 0.450 | 67.1 | 149.3 | 365.6 | 0.320 | - | 105 |
| UB-27 | UB 457x191x82, 8 m SS, UDL + in-span couple at 4 m + point load at 2 m (mixed) | UB 457x191x82 | eigen | PASS (ratio outlier) | LTB  M_Ed/M_b,Rd (0.870) | 317.5 | 1.392 | 1.259 | 0.517 | 260.4 | 503.3 | 756.3 | 0.270 | - | 1339 |
| UB-27 | UB 457x191x82, 8 m SS, UDL + in-span couple at 4 m + point load at 2 m (mixed) | UB 457x191x82 | standard | PASS | LTB  M_Ed/M_b,Rd (0.743) | 382.3 | 1.676 | 1.147 | 0.606 | 304.8 | 503.3 | 756.3 | 0.270 | - | 101 |
| UB-28 | UB 406x178x74, 6 m SS, full UDL + axial compression 400 kN (~0.15 Npl) | UB 406x178x74 | eigen | PASS | Member buckling z-z (Eq 6.62) (0.933) | 313.1 | 1.131 | 1.148 | 0.566 | 233.5 | 412.5 | 664.4 | 0.141 | - | 1280 |
| UB-28 | UB 406x178x74, 6 m SS, full UDL + axial compression 400 kN (~0.15 Npl) | UB 406x178x74 | standard | PASS | Member buckling z-z (Eq 6.62) (0.934) | 312.0 | 1.127 | 1.150 | 0.564 | 232.8 | 412.5 | 664.4 | 0.141 | - | 89 |
| UB-29 | UB 305x165x40, 5 m SS, full UDL + axial tension 300 kN, fully restrained | UB 305x165x40 | n/a (restrained) | PASS | Bending  M_Ed/M_c,Rd (0.847) | - | - | - | - | - | 171.3 | 318.6 | 0.591 | - | 91 |
| UB-30 | UB 254x146x31, 5 m SS, full UDL + minor-axis moment Mz = 8 kN.m, fully restrained | UB 254x146x31 | n/a (restrained) | PASS | Biaxial bending (6.2.9.1) (0.976) | - | - | - | - | - | 96.5 | 260.3 | 0.380 | - | 64 |
| UB-31 | UB 254x146x31, 5 m SS, full UDL + Mz = 8 kN.m, unrestrained (biaxial + LTB) | UB 254x146x31 | eigen | FAIL | Member buckling z-z (Eq 6.62) (1.075) | 76.8 | 1.131 | 1.121 | 0.641 | 61.9 | 96.5 | 260.3 | 0.285 | - | 1273 |
| UB-31 | UB 254x146x31, 5 m SS, full UDL + Mz = 8 kN.m, unrestrained (biaxial + LTB) | UB 254x146x31 | standard | FAIL | Member buckling z-z (Eq 6.62) (1.077) | 76.5 | 1.127 | 1.123 | 0.639 | 61.7 | 96.5 | 260.3 | 0.285 | - | 96 |
| UB-32 | UB 457x191x82, 8 m SS, full UDL at e = 95 mm (flange half-width), unrestrained | UB 457x191x82 | eigen | PASS | LTB+torsion (EN 1993-6 Annex A) (0.846) | 258.0 | 1.131 | 1.397 | 0.435 | 218.7 | 503.3 | 756.3 | 0.154 | - | 1498 |
| UB-32 | UB 457x191x82, 8 m SS, full UDL at e = 95 mm (flange half-width), unrestrained | UB 457x191x82 | standard | PASS | LTB+torsion (EN 1993-6 Annex A) (0.840) | 257.1 | 1.127 | 1.399 | 0.433 | 218.1 | 503.3 | 756.3 | 0.154 | - | 178 |
| UB-33 | UB 457x191x82, 8 m SS, full UDL at e = 20 mm (small), fully restrained | UB 457x191x82 | n/a (restrained) | FAIL | Bending+torsion cross-section (P385 3.1.2) (1.273) | - | - | - | - | - | 503.3 | 756.3 | 0.585 | - | 166 |
| UB-34 | UB 203x102x23, 4 m SS, two point loads near the supports (0.3 and 3.7 m) | UB 203x102x23 | eigen | PASS | LTB  M_Ed/M_b,Rd (0.837) | 40.5 | 1.004 | 1.260 | 0.546 | 35.1 | 64.3 | 196.6 | 0.778 | - | 1254 |
| UB-34 | UB 203x102x23, 4 m SS, two point loads near the supports (0.3 and 3.7 m) | UB 203x102x23 | standard | PASS | LTB  M_Ed/M_b,Rd (0.838) | 40.5 | 1.003 | 1.260 | 0.545 | 35.1 | 64.3 | 196.6 | 0.778 | - | 70 |
| UB-35 | UB 914x419x388, 3 m SS, central 3000 kN point load (high shear at the maximum moment), restrained | UB 914x419x388 | n/a (restrained) | PASS | Bending  M_Ed/M_c,Rd (0.755) | - | - | - | - | - | 4480.0 | 3238.5 | 0.134 | - | 69 |
| UB-36 | UB 178x102x19, 4 m SS, UDL G+Q with upward wind W (uplift combinations) | UB 178x102x19 | eigen | PASS | LTB  M_Ed/M_b,Rd (0.846) | 33.2 | 1.131 | 1.190 | 0.597 | 28.1 | 47.0 | 157.0 | 0.840 | - | 2993 |
| UB-36 | UB 178x102x19, 4 m SS, UDL G+Q with upward wind W (uplift combinations) | UB 178x102x19 | standard | PASS | LTB  M_Ed/M_b,Rd (0.848) | 33.1 | 1.127 | 1.192 | 0.596 | 28.0 | 47.0 | 157.0 | 0.840 | - | 338 |
| UB-37 | UB 152x89x16, 3.5 m SS, UDL G+Q with wind reversed through a negative factor | UB 152x89x16 | eigen | PASS | LTB  M_Ed/M_b,Rd (0.839) | 26.7 | 1.130 | 1.125 | 0.638 | 21.6 | 33.8 | 129.5 | 0.689 | - | 2215 |
| UB-37 | UB 152x89x16, 3.5 m SS, UDL G+Q with wind reversed through a negative factor | UB 152x89x16 | standard | PASS | LTB  M_Ed/M_b,Rd (0.841) | 26.6 | 1.127 | 1.127 | 0.637 | 21.5 | 33.8 | 129.5 | 0.689 | - | 187 |
| UB-38 | UB 127x76x13, 3 m SS, central point load, fully restrained (smallest UB) | UB 127x76x13 | n/a (restrained) | PASS | Deflection (0.849) | - | - | - | - | - | 23.2 | 101.7 | 0.849 | - | 78 |
| UB-39 | UB 838x292x176, 14 m SS, full UDL, quarter-point restraints, top-flange loading | UB 838x292x176 | eigen | PASS | LTB  M_Ed/M_b,Rd (0.994) | 5866.1 | 1.074 | 0.555 | 0.912 | 1646.6 | 1804.7 | 1891.8 | 0.622 | - | 4026 |
| UB-39 | UB 838x292x176, 14 m SS, full UDL, quarter-point restraints, top-flange loading | UB 838x292x176 | standard | FAIL | LTB  M_Ed/M_b,Rd (3.846) | 426.1 | 1.127 | 2.058 | 0.236 | 425.7 | 1804.7 | 1891.8 | 0.622 | - | 185 |
| UB-40 | UB 533x210x92, 8 m SS, full UDL, LE factor 1.2 + destabilising switch | UB 533x210x92 | eigen | PASS (ratio outlier) | LTB  M_Ed/M_b,Rd (0.843) | 335.1 | 1.131 | 1.392 | 0.437 | 283.6 | 649.0 | 908.7 | 0.228 | - | 1316 |
| UB-40 | UB 533x210x92, 8 m SS, full UDL, LE factor 1.2 + destabilising switch | UB 533x210x92 | standard | FAIL | LTB  M_Ed/M_b,Rd (1.243) | 202.3 | 1.127 | 1.791 | 0.296 | 192.3 | 649.0 | 908.7 | 0.228 | - | 74 |
| UB-41 | UB 610x229x125, 2 x 5 m continuous, Q on span 1 only, warping-restrained ends | UB 610x229x125 | eigen | PASS | LTB  M_Ed/M_b,Rd (0.595) | 1399.9 | 1.210 | 0.835 | 0.742 | 723.6 | 975.2 | 1171.1 | 0.179 | - | 2661 |
| UB-41 | UB 610x229x125, 2 x 5 m continuous, Q on span 1 only, warping-restrained ends | UB 610x229x125 | standard | FAIL | LTB  M_Ed/M_b,Rd (1.031) | 487.5 | 1.219 | 1.414 | 0.428 | 417.7 | 975.2 | 1171.1 | 0.179 | - | 92 |
| UB-42 | UB 356x171x45, 8 m SS, full UDL, grade S355 | UB 356x171x45 | eigen | PASS | LTB  M_Ed/M_b,Rd (0.884) | 82.9 | 1.131 | 1.821 | 0.288 | 79.4 | 275.1 | 548.6 | 0.302 | - | 1342 |
| UB-42 | UB 356x171x45, 8 m SS, full UDL, grade S355 | UB 356x171x45 | standard | PASS | LTB  M_Ed/M_b,Rd (0.887) | 82.6 | 1.127 | 1.825 | 0.288 | 79.1 | 275.1 | 548.6 | 0.302 | - | 90 |
| UB-43 | UB 406x140x39, 8 m fixed-fixed, full UDL, top-flange loading zg = +D/2 (SN003a fixed-ended row, C2 = 1.554) | UB 406x140x39 | eigen | PASS | LTB  M_Ed/M_b,Rd (0.870) | 50.3 | 1.360 | 1.990 | 0.249 | 49.7 | 199.1 | 438.5 | 0.053 | - | 1384 |
| UB-43 | UB 406x140x39, 8 m fixed-fixed, full UDL, top-flange loading zg = +D/2 (SN003a fixed-ended row, C2 = 1.554) | UB 406x140x39 | standard | PASS | LTB  M_Ed/M_b,Rd (0.938) | 46.1 | 2.578 | 2.078 | 0.231 | 46.1 | 199.1 | 438.5 | 0.053 | - | 81 |
| UB-44 | UB 406x178x54, 7 m SS, point load at 0.35L, top-flange loading zg = +D/2 (no published C2: standard route blocked) | UB 406x178x54 | eigen | PASS (ratio outlier) | LTB  M_Ed/M_b,Rd (0.861) | 120.5 | 1.382 | 1.548 | 0.371 | 107.2 | 288.8 | 529.1 | 0.232 | - | 1237 |
| UB-44 | UB 406x178x54, 7 m SS, point load at 0.35L, top-flange loading zg = +D/2 (no published C2: standard route blocked) | UB 406x178x54 | standard | NOT VERIFIED | LTB  M_Ed/M_b,Rd (0.628) | 177.4 | 1.437 | 1.276 | 0.509 | 147.1 | 288.8 | 529.1 | 0.232 | Standard (closed-form) Mcr: a destabilising load height zg = +201 mm is entered, but SN003a publishes C2 only for the si | 78 |
| UB-45 | UC 203x203x60, 6 m fixed-fixed, central point load, top-flange loading zg = +D/2 (SN003a fixed-ended row, C2 = 1.645) | UC 203x203x60 | eigen | PASS | LTB  M_Ed/M_b,Rd (0.898) | 220.6 | 0.874 | 0.904 | 0.757 | 136.6 | 180.4 | 352.2 | 0.420 | - | 1416 |
| UB-45 | UC 203x203x60, 6 m fixed-fixed, central point load, top-flange loading zg = +D/2 (SN003a fixed-ended row, C2 = 1.645) | UC 203x203x60 | standard | PASS | LTB  M_Ed/M_b,Rd (0.850) | 189.5 | 1.683 | 0.976 | 0.800 | 144.4 | 180.4 | 352.2 | 0.420 | - | 172 |
| UC-01 | UC 203x203x46, 5 m SS, full UDL, fully restrained | UC 203x203x46 | n/a (restrained) | PASS | Deflection (0.855) | - | - | - | - | - | 136.7 | 269.0 | 0.855 | - | 136 |
| UC-02 | UC 203x203x46, 5 m SS, full UDL, unrestrained | UC 203x203x46 | eigen | PASS | LTB  M_Ed/M_b,Rd (0.831) | 221.5 | 1.131 | 0.786 | 0.850 | 116.2 | 136.7 | 269.0 | 0.794 | - | 1439 |
| UC-02 | UC 203x203x46, 5 m SS, full UDL, unrestrained | UC 203x203x46 | standard | PASS | LTB  M_Ed/M_b,Rd (0.833) | 220.7 | 1.127 | 0.787 | 0.849 | 116.0 | 136.7 | 269.0 | 0.794 | - | 107 |
| UC-03 | UC 152x152x23, 4 m SS, central point load, top-flange loading | UC 152x152x23 | eigen | PASS | Deflection (0.846) | 54.4 | 1.356 | 0.910 | 0.810 | 36.5 | 45.1 | 157.6 | 0.846 | - | 1343 |
| UC-03 | UC 152x152x23, 4 m SS, central point load, top-flange loading | UC 152x152x23 | standard | PASS | Deflection (0.846) | 51.5 | 1.348 | 0.936 | 0.791 | 35.7 | 45.1 | 157.6 | 0.846 | - | 88 |
| UC-04 | UC 152x152x30, 3 m cantilever, full UDL | UC 152x152x30 | eigen | PASS | LTB  M_Ed/M_b,Rd (0.840) | 261.5 | 4.770 | 0.511 | 0.956 | 65.2 | 68.2 | 184.1 | 0.777 | - | 1398 |
| UC-04 | UC 152x152x30, 3 m cantilever, full UDL | UC 152x152x30 | standard | PASS | LTB  M_Ed/M_b,Rd (0.841) | 260.2 | 2.485 | 0.512 | 0.955 | 65.1 | 68.2 | 184.1 | 0.777 | - | 90 |
| UC-05 | UC 254x254x73, 6 m SS, full UDL + axial compression 700 kN (~0.27 Npl) | UC 254x254x73 | eigen | FAIL | Member buckling z-z (Eq 6.62) (1.017) | 478.2 | 1.131 | 0.755 | 0.867 | 236.5 | 272.8 | 406.8 | 0.465 | - | 1315 |
| UC-05 | UC 254x254x73, 6 m SS, full UDL + axial compression 700 kN (~0.27 Npl) | UC 254x254x73 | standard | FAIL | Member buckling z-z (Eq 6.62) (1.018) | 475.3 | 1.127 | 0.758 | 0.865 | 236.0 | 272.8 | 406.8 | 0.465 | - | 88 |
| UC-06 | UC 254x254x89, 7 m SS, full UDL + Mz = 20 kN.m | UC 254x254x89 | eigen | PASS | Member buckling z-z (Eq 6.62) (0.852) | 544.8 | 1.131 | 0.770 | 0.859 | 277.6 | 323.3 | 466.6 | 0.642 | - | 1337 |
| UC-06 | UC 254x254x89, 7 m SS, full UDL + Mz = 20 kN.m | UC 254x254x89 | standard | PASS | Member buckling z-z (Eq 6.62) (0.853) | 543.1 | 1.127 | 0.772 | 0.857 | 277.2 | 323.3 | 466.6 | 0.642 | - | 80 |
| UC-07 | UC 305x305x97, 2 x 4 m continuous, full UDL | UC 305x305x97 | eigen | PASS | Bending  M_Ed/M_c,Rd (0.846) | 3654.2 | 2.261 | 0.346 | 1.000 | 410.7 | 410.7 | 558.5 | 0.187 | - | 2818 |
| UC-07 | UC 305x305x97, 2 x 4 m continuous, full UDL | UC 305x305x97 | standard | PASS | LTB  M_Ed/M_b,Rd (0.914) | 692.4 | 1.276 | 0.795 | 0.870 | 380.4 | 410.7 | 558.5 | 0.187 | - | 167 |
| UC-08 | UC 305x305x118, 9 m SS, full UDL, restraints at third points | UC 305x305x118 | eigen | PASS | Deflection (0.822) | 3548.8 | 1.015 | 0.383 | 1.000 | 519.4 | 519.4 | 657.3 | 0.822 | - | 2971 |
| UC-08 | UC 305x305x118, 9 m SS, full UDL, restraints at third points | UC 305x305x118 | standard | PASS | LTB  M_Ed/M_b,Rd (0.893) | 730.2 | 1.127 | 0.843 | 0.816 | 424.1 | 519.4 | 657.3 | 0.822 | - | 98 |
| UC-09 | UC 356x368x129, 10 m SS, triangular load 0 -> 30 kN/m + G | UC 356x368x129 | eigen | PASS | LTB  M_Ed/M_b,Rd (0.889) | 909.2 | 1.140 | 0.850 | 0.815 | 535.4 | 657.2 | 644.6 | 0.834 | - | 1313 |
| UC-09 | UC 356x368x129, 10 m SS, triangular load 0 -> 30 kN/m + G | UC 356x368x129 | standard | PASS | LTB  M_Ed/M_b,Rd (0.887) | 913.5 | 1.144 | 0.848 | 0.817 | 536.7 | 657.2 | 644.6 | 0.834 | - | 93 |
| UC-10 | UC 356x406x235, 8 m SS, three 125 kN point loads + UDL, restrained (stocky) | UC 356x406x235 | n/a (restrained) | PASS | Deflection (0.858) | - | - | - | - | - | 1242.8 | 1151.7 | 0.858 | - | 84 |
| UC-11 | UC 203x203x60, 6 m propped cantilever, full UDL + axial tension 200 kN | UC 203x203x60 | eigen | PASS | Bending  M_Ed/M_c,Rd (0.843) | 592.0 | 1.619 | 0.552 | 1.000 | 180.4 | 180.4 | 352.2 | 0.426 | - | 1255 |
| UC-11 | UC 203x203x60, 6 m propped cantilever, full UDL + axial tension 200 kN | UC 203x203x60 | standard | PASS | Bending  M_Ed/M_c,Rd (0.843) | 532.8 | 2.197 | 0.582 | 1.000 | 180.4 | 180.4 | 352.2 | 0.426 | - | 91 |
| UC-12 | UC 203x203x86, 6 m fixed-fixed, central point load + axial compression 800 kN (~0.27 Npl) | UC 203x203x86 | eigen | PASS | Member buckling z-z (Eq 6.62) (0.971) | 933.9 | 0.894 | 0.527 | 0.949 | 245.7 | 258.9 | 475.1 | 0.224 | - | 1343 |
| UC-12 | UC 203x203x86, 6 m fixed-fixed, central point load + axial compression 800 kN (~0.27 Npl) | UC 203x203x86 | standard | PASS | Member buckling z-z (Eq 6.62) (0.898) | 812.3 | 1.683 | 0.565 | 1.000 | 258.9 | 258.9 | 475.1 | 0.224 | - | 91 |
| UC-13 | UC 152x152x37, 5 m SS, equal and opposite end couples (double curvature, psi = -1) | UC 152x152x37 | eigen | PASS | Bending  M_Ed/M_c,Rd (0.847) | 281.0 | 2.674 | 0.550 | 1.000 | 85.0 | 85.0 | 226.3 | 0.299 | - | 1504 |
| UC-13 | UC 152x152x37, 5 m SS, equal and opposite end couples (double curvature, psi = -1) | UC 152x152x37 | standard | PASS | Bending  M_Ed/M_c,Rd (0.847) | 289.6 | 2.756 | 0.542 | 1.000 | 85.0 | 85.0 | 226.3 | 0.299 | - | 109 |
| PFC-01 | PFC 180x75x20, 4 m SS, full UDL through the shear centre, fully restrained | PFC 180x75x20 | n/a (restrained) | PASS | Deflection (0.834) | - | - | - | - | - | 48.4 | 191.2 | 0.834 | - | 109 |
| PFC-02 | PFC 180x75x20, 4 m SS, full UDL through the shear centre, unrestrained | PFC 180x75x20 | eigen | PASS | LTB  M_Ed/M_b,Rd (0.924) | 41.5 | 1.130 | 1.080 | 0.528 | 25.6 | 48.4 | 191.2 | 0.521 | - | 1286 |
| PFC-02 | PFC 180x75x20, 4 m SS, full UDL through the shear centre, unrestrained | PFC 180x75x20 | standard | PASS | LTB  M_Ed/M_b,Rd (0.934) | 40.8 | 1.127 | 1.089 | 0.523 | 25.3 | 48.4 | 191.2 | 0.521 | - | 83 |
| PFC-03 | PFC 200x90x30, 4 m SS, full UDL e = 0 with eccentricity ON (self-weight offset only) | PFC 200x90x30 | eigen | PASS | LTB+torsion (EN 1993-6 Annex A) (0.314) | 96.7 | 1.130 | 0.910 | 0.633 | 50.7 | 80.0 | 243.9 | 0.170 | - | 1392 |
| PFC-03 | PFC 200x90x30, 4 m SS, full UDL e = 0 with eccentricity ON (self-weight offset only) | PFC 200x90x30 | standard | PASS | LTB+torsion (EN 1993-6 Annex A) (0.539) | 38.2 | 1.127 | 1.447 | 0.356 | 28.5 | 80.0 | 243.9 | 0.170 | - | 136 |
| PFC-04 | PFC 200x90x30, 4 m SS, full UDL at e = 20 mm (small) | PFC 200x90x30 | eigen | PASS | LTB+torsion (EN 1993-6 Annex A) (0.344) | 96.7 | 1.130 | 0.910 | 0.633 | 50.7 | 80.0 | 243.9 | 0.170 | - | 1372 |
| PFC-04 | PFC 200x90x30, 4 m SS, full UDL at e = 20 mm (small) | PFC 200x90x30 | standard | PASS | LTB+torsion (EN 1993-6 Annex A) (0.577) | 38.2 | 1.127 | 1.447 | 0.356 | 28.5 | 80.0 | 243.9 | 0.170 | - | 172 |
| PFC-05 | PFC 200x90x30, 4 m SS, full UDL at e = 45 mm (flange half-width) | PFC 200x90x30 | eigen | PASS | LTB+torsion (EN 1993-6 Annex A) (0.381) | 96.7 | 1.130 | 0.910 | 0.633 | 50.7 | 80.0 | 243.9 | 0.170 | - | 1368 |
| PFC-05 | PFC 200x90x30, 4 m SS, full UDL at e = 45 mm (flange half-width) | PFC 200x90x30 | standard | PASS | LTB+torsion (EN 1993-6 Annex A) (0.623) | 38.2 | 1.127 | 1.447 | 0.356 | 28.5 | 80.0 | 243.9 | 0.170 | - | 137 |
| PFC-06 | PFC 230x90x32, 6 m SS, central point load at e = 45 mm, fully restrained | PFC 230x90x32 | n/a (restrained) | PASS | Bending+torsion cross-section (P385 3.1.2) (0.941) | - | - | - | - | - | 97.6 | 294.2 | 0.913 | - | 156 |
| PFC-07 | PFC 260x90x35, 4 m SS, full UDL at e = 30 mm and top-flange height zg = +D/2 | PFC 260x90x35 | eigen | PASS | LTB+torsion (EN 1993-6 Annex A) (0.460) | 88.4 | 1.130 | 1.150 | 0.490 | 57.3 | 116.9 | 349.3 | 0.121 | - | 1459 |
| PFC-07 | PFC 260x90x35, 4 m SS, full UDL at e = 30 mm and top-flange height zg = +D/2 | PFC 260x90x35 | standard | PASS | LTB+torsion (EN 1993-6 Annex A) (0.619) | 53.5 | 1.127 | 1.478 | 0.346 | 40.4 | 116.9 | 349.3 | 0.121 | - | 158 |
| PFC-08 | PFC 300x100x46, 5 m SS, triangular load 0 -> 10 kN/m at e = 50 mm + G | PFC 300x100x46 | eigen | PASS | LTB+torsion (EN 1993-6 Annex A) (0.571) | 152.0 | 1.139 | 1.057 | 0.542 | 92.1 | 169.9 | 443.1 | 0.170 | - | 1411 |
| PFC-08 | PFC 300x100x46, 5 m SS, triangular load 0 -> 10 kN/m at e = 50 mm + G | PFC 300x100x46 | standard | FAIL | LTB+torsion (EN 1993-6 Annex A) (1.010) | 61.3 | 1.145 | 1.664 | 0.291 | 49.5 | 169.9 | 443.1 | 0.170 | - | 142 |
| PFC-09 | PFC 300x90x41, 3.5 m cantilever, full UDL through the shear centre | PFC 300x90x41 | eigen | PASS (ratio outlier) | LTB  M_Ed/M_b,Rd (0.788) | 300.6 | 4.528 | 0.721 | 0.744 | 116.3 | 156.2 | 445.4 | 0.382 | - | 1242 |
| PFC-09 | PFC 300x90x41, 3.5 m cantilever, full UDL through the shear centre | PFC 300x90x41 | standard | FAIL | LTB  M_Ed/M_b,Rd (1.447) | 90.2 | 1.000 | 1.316 | 0.405 | 63.3 | 156.2 | 445.4 | 0.382 | - | 66 |
| PFC-10 | PFC 380x100x54, 2 x 4 m continuous, full UDL through the shear centre | PFC 380x100x54 | eigen | PASS | LTB  M_Ed/M_b,Rd (0.779) | 494.8 | 2.252 | 0.707 | 0.755 | 186.6 | 247.2 | 581.2 | 0.119 | - | 2929 |
| PFC-10 | PFC 380x100x54, 2 x 4 m continuous, full UDL through the shear centre | PFC 380x100x54 | standard | FAIL | LTB  M_Ed/M_b,Rd (4.468) | 33.3 | 1.276 | 2.723 | 0.132 | 32.6 | 247.2 | 581.2 | 0.119 | - | 70 |
| PFC-11 | PFC 430x100x64, 4 m SS, full UDL + axial compression 150 kN, restrained (torsional buckling gap) | PFC 430x100x64 | n/a (restrained) | NOT VERIFIED | Member buckling z-z (Eq 6.62) (0.324) | - | - | - | - | - | 323.3 | 750.3 | 0.052 | PFC under axial compression: torsional and torsional-flexural buckling (cl 6.3.1.4) are not implemented. Flexural buckli | 70 |
| PFC-12 | PFC 150x75x18, 3 m SS, central point load at e = 37 mm (flange half-width) | PFC 150x75x18 | eigen | PASS | LTB+torsion (EN 1993-6 Annex A) (0.834) | 58.5 | 1.354 | 0.788 | 0.749 | 27.2 | 36.3 | 151.6 | 0.448 | - | 1249 |
| PFC-12 | PFC 150x75x18, 3 m SS, central point load at e = 37 mm (flange half-width) | PFC 150x75x18 | standard | FAIL | LTB+torsion (EN 1993-6 Annex A) (1.448) | 21.4 | 1.348 | 1.302 | 0.411 | 14.9 | 36.3 | 151.6 | 0.448 | - | 109 |
| PFC-13 | PFC 125x65x15, 3 m SS, full UDL + Mz = 1.5 kN.m | PFC 125x65x15 | eigen | PASS | Member buckling z-z (Eq 6.62) (0.814) | 32.2 | 1.129 | 0.876 | 0.655 | 16.2 | 24.7 | 128.8 | 0.499 | - | 1311 |
| PFC-13 | PFC 125x65x15, 3 m SS, full UDL + Mz = 1.5 kN.m | PFC 125x65x15 | standard | PASS | Member buckling z-z (Eq 6.62) (0.819) | 31.6 | 1.127 | 0.884 | 0.650 | 16.1 | 24.7 | 128.8 | 0.499 | - | 80 |
| PFC-14 | PFC 260x75x28, 4 m SS, full UDL + point load at 1.5 m, all at e = 25 mm | PFC 260x75x28 | eigen | PASS | LTB+torsion (EN 1993-6 Annex A) (0.829) | 65.1 | 1.189 | 1.177 | 0.481 | 43.3 | 90.2 | 307.7 | 0.234 | - | 1428 |
| PFC-14 | PFC 260x75x28, 4 m SS, full UDL + point load at 1.5 m, all at e = 25 mm | PFC 260x75x28 | standard | FAIL | LTB+torsion (EN 1993-6 Annex A) (2.416) | 27.5 | 1.212 | 1.812 | 0.256 | 23.1 | 90.2 | 307.7 | 0.234 | - | 178 |
| PFC-15 | PFC 100x50x10, 2.5 m SS, full UDL, fully restrained (smallest PFC) | PFC 100x50x10 | n/a (restrained) | PASS | Deflection (0.838) | - | - | - | - | - | 13.4 | 90.3 | 0.838 | - | 76 |
| PFC-16 | PFC 230x75x26, 5 m propped cantilever, full UDL at e = 30 mm (fork-fork torsion with in-plane fixity) | PFC 230x75x26 | eigen | PASS | LTB+torsion (EN 1993-6 Annex A) (0.946) | 99.9 | 1.643 | 0.875 | 0.715 | 54.7 | 76.5 | 258.2 | 0.253 | - | 1377 |
| PFC-16 | PFC 230x75x26, 5 m propped cantilever, full UDL at e = 30 mm (fork-fork torsion with in-plane fixity) | PFC 230x75x26 | standard | FAIL | LTB+torsion (EN 1993-6 Annex A) (99.000) | 15.6 | 2.197 | 2.216 | 0.186 | 14.2 | 76.5 | 258.2 | 0.253 | M_y,Ed reaches the elastic critical moment M_cr: the Annex A amplifier k_alpha is unbounded; the member is inadequate as | 146 |
| PFC-17 | PFC 150x90x24, 4 m SS, partial UDL 1-3 m at e = 30 mm (partial-span torque, not covered) | PFC 150x90x24 | eigen | NOT VERIFIED | Deflection (0.877) | 70.1 | 1.166 | 0.838 | 0.687 | 33.8 | 49.2 | 175.0 | 0.877 | Torsion on this open section is NOT COVERED: partial-span eccentric distributed load on an open section: the P385 fork-f / Channel with eccentric load: the LTB check is valid (zj = 0, Iw about the shear centre), but the primary torque from e0  | 1323 |
| PFC-17 | PFC 150x90x24, 4 m SS, partial UDL 1-3 m at e = 30 mm (partial-span torque, not covered) | PFC 150x90x24 | standard | FAIL | LTB  M_Ed/M_b,Rd (1.312) | 23.7 | 1.182 | 1.442 | 0.358 | 17.6 | 49.2 | 175.0 | 0.877 | Torsion on this open section is NOT COVERED: partial-span eccentric distributed load on an open section: the P385 fork-f | 102 |
| PFC-18 | PFC 180x90x26, 5 m SS, full UDL, restraints at third points | PFC 180x90x26 | eigen | PASS | Deflection (0.767) | 214.9 | 1.015 | 0.545 | 0.880 | 56.1 | 63.8 | 206.6 | 0.767 | - | 3109 |
| PFC-18 | PFC 180x90x26, 5 m SS, full UDL, restraints at third points | PFC 180x90x26 | standard | FAIL | LTB  M_Ed/M_b,Rd (2.256) | 59.0 | 1.127 | 1.802 | 0.258 | 16.5 | 63.8 | 206.6 | 0.767 | - | 83 |
| SHS-01 | SHS 100x100x5.0 HF, 3 m SS, full UDL, fully restrained | SHS 100x100x5.0 HF | n/a (restrained) | PASS | Deflection (0.864) | - | - | - | - | - | 18.3 | 148.5 | 0.864 | - | 76 |
| SHS-02 | SHS 100x100x5.0 HF, 3 m SS, full UDL, unrestrained (LTB exempt by slenderness) | SHS 100x100x5.0 HF | eigen | PASS | Deflection (0.864) | 538.5 | 1.127 | 0.184 | 1.000 | 18.3 | 18.3 | 148.5 | 0.864 | - | 1365 |
| SHS-02 | SHS 100x100x5.0 HF, 3 m SS, full UDL, unrestrained (LTB exempt by slenderness) | SHS 100x100x5.0 HF | standard | PASS | Deflection (0.864) | 538.7 | 1.127 | 0.184 | 1.000 | 18.3 | 18.3 | 148.5 | 0.864 | - | 72 |
| SHS-03 | SHS 150x150x6.3 HF, 5 m SS, central point load, unrestrained | SHS 150x150x6.3 HF | eigen | PASS | Deflection (0.842) | 1670.1 | 1.335 | 0.178 | 1.000 | 52.8 | 52.8 | 284.2 | 0.842 | - | 1329 |
| SHS-03 | SHS 150x150x6.3 HF, 5 m SS, central point load, unrestrained | SHS 150x150x6.3 HF | standard | PASS | Deflection (0.842) | 1686.2 | 1.348 | 0.177 | 1.000 | 52.8 | 52.8 | 284.2 | 0.842 | - | 75 |
| SHS-04 | SHS 200x200x8.0 HF, 6 m SS, full UDL + axial compression 450 kN (~0.27 Npl) | SHS 200x200x8.0 HF | eigen | FAIL | Member buckling y-y (Eq 6.61) (1.001) | 3562.7 | 1.127 | 0.183 | 1.000 | 119.9 | 119.9 | 482.7 | 0.780 | - | 1267 |
| SHS-04 | SHS 200x200x8.0 HF, 6 m SS, full UDL + axial compression 450 kN (~0.27 Npl) | SHS 200x200x8.0 HF | standard | FAIL | Member buckling y-y (Eq 6.61) (1.001) | 3563.9 | 1.127 | 0.183 | 1.000 | 119.9 | 119.9 | 482.7 | 0.780 | - | 86 |
| SHS-05 | SHS 250x250x10.0 HF, 2 x 4 m continuous, full UDL | SHS 250x250x10.0 HF | eigen | PASS | Bending  M_Ed/M_c,Rd (0.810) | 25670.0 | 2.217 | 0.095 | 1.000 | 234.0 | 234.0 | 753.4 | 0.262 | - | 3545 |
| SHS-05 | SHS 250x250x10.0 HF, 2 x 4 m continuous, full UDL | SHS 250x250x10.0 HF | standard | PASS | Bending  M_Ed/M_c,Rd (0.810) | 7385.9 | 1.276 | 0.178 | 1.000 | 234.0 | 234.0 | 753.4 | 0.262 | - | 66 |
| SHS-06 | SHS 300x300x10.0 HF, 4 m cantilever, tip point load + UDL | SHS 300x300x10.0 HF | eigen | PASS (ratio outlier) | Deflection (0.857) | 28510.8 | 2.795 | 0.110 | 1.000 | 343.8 | 343.8 | 912.9 | 0.857 | - | 1280 |
| SHS-06 | SHS 300x300x10.0 HF, 4 m cantilever, tip point load + UDL | SHS 300x300x10.0 HF | standard | PASS | Deflection (0.857) | 20404.6 | 1.000 | 0.130 | 1.000 | 343.8 | 343.8 | 912.9 | 0.857 | - | 69 |
| SHS-07 | SHS 100x100x4.0 CF, 3 m SS, full UDL at e = 40 mm (cold-formed torsion constants) | SHS 100x100x4.0 CF | eigen | NOT VERIFIED | Deflection (0.853) | 440.1 | 1.127 | 0.182 | 1.000 | 14.7 | 14.7 | 118.3 | 0.853 | Torsional constants are computed with hot-finished (EN 10210-2) corner geometry; cold-formed (EN 10219-2) corners differ | 1479 |
| SHS-07 | SHS 100x100x4.0 CF, 3 m SS, full UDL at e = 40 mm (cold-formed torsion constants) | SHS 100x100x4.0 CF | standard | NOT VERIFIED | Deflection (0.853) | 440.3 | 1.127 | 0.182 | 1.000 | 14.7 | 14.7 | 118.3 | 0.853 | Torsional constants are computed with hot-finished (EN 10210-2) corner geometry; cold-formed (EN 10219-2) corners differ | 124 |
| SHS-08 | SHS 150x150x5.0 CF, 4 m SS, full UDL, fully restrained | SHS 150x150x5.0 CF | n/a (restrained) | PASS | Deflection (0.844) | - | - | - | - | - | 42.1 | 225.5 | 0.844 | - | 70 |
| SHS-09 | SHS 200x200x6.0 CF, 6 m SS, two point loads + Mz = 4 kN.m, fully restrained | SHS 200x200x6.0 CF | n/a (restrained) | PASS | Deflection (0.851) | - | - | - | - | - | 90.8 | 362.0 | 0.851 | - | 65 |
| SHS-10 | SHS 120x120x5.0 HF, 4 m SS, full UDL + axial tension 100 kN | SHS 120x120x5.0 HF | eigen | PASS | Deflection (0.861) | 717.9 | 1.127 | 0.193 | 1.000 | 26.8 | 26.8 | 180.2 | 0.861 | - | 1336 |
| SHS-10 | SHS 120x120x5.0 HF, 4 m SS, full UDL + axial tension 100 kN | SHS 120x120x5.0 HF | standard | PASS | Deflection (0.861) | 718.1 | 1.127 | 0.193 | 1.000 | 26.8 | 26.8 | 180.2 | 0.861 | - | 68 |
| SHS-11 | SHS 80x80x5.0 HF, 2.5 m SS, full UDL at e = 40 mm (half width), fully restrained | SHS 80x80x5.0 HF | n/a (restrained) | PASS | Deflection (0.866) | - | - | - | - | - | 11.3 | 116.7 | 0.866 | - | 107 |
| RHS-01 | RHS 200x100x8.0, 5 m SS, full UDL, fully restrained | RHS 200x100x8.0 | n/a (restrained) | PASS | Deflection (0.876) | - | - | - | - | - | 77.5 | 474.2 | 0.876 | - | 73 |
| RHS-02 | RHS 200x100x8.0, 5 m SS, full UDL, unrestrained | RHS 200x100x8.0 | eigen | PASS | Deflection (0.876) | 1064.8 | 1.127 | 0.270 | 1.000 | 77.5 | 77.5 | 474.2 | 0.876 | - | 1373 |
| RHS-02 | RHS 200x100x8.0, 5 m SS, full UDL, unrestrained | RHS 200x100x8.0 | standard | PASS | Deflection (0.876) | 1065.2 | 1.127 | 0.270 | 1.000 | 77.5 | 77.5 | 474.2 | 0.876 | - | 70 |
| RHS-03 | RHS 300x100x10.0 (h/b = 3), 8 m SS, full UDL, unrestrained | RHS 300x100x10.0 | eigen | PASS | Deflection (0.856) | 1252.3 | 1.127 | 0.382 | 1.000 | 183.2 | 183.2 | 891.9 | 0.856 | - | 1384 |
| RHS-03 | RHS 300x100x10.0 (h/b = 3), 8 m SS, full UDL, unrestrained | RHS 300x100x10.0 | standard | PASS | Deflection (0.856) | 1252.8 | 1.127 | 0.382 | 1.000 | 183.2 | 183.2 | 891.9 | 0.856 | - | 84 |
| RHS-04 | RHS 500x200x12.5 (h/b = 2.5), 12 m SS, full UDL, unrestrained | RHS 500x200x12.5 | eigen | PASS | Deflection (0.832) | 7447.8 | 1.127 | 0.309 | 1.000 | 712.3 | 712.3 | 1893.9 | 0.832 | - | 1431 |
| RHS-04 | RHS 500x200x12.5 (h/b = 2.5), 12 m SS, full UDL, unrestrained | RHS 500x200x12.5 | standard | PASS | Deflection (0.832) | 7450.3 | 1.127 | 0.309 | 1.000 | 712.3 | 712.3 | 1893.9 | 0.832 | - | 92 |
| RHS-05 | RHS 250x100x8.0, 7 m SS, central point load + G UDL | RHS 250x100x8.0 | eigen | PASS | Deflection (0.844) | 1107.7 | 1.273 | 0.317 | 1.000 | 111.1 | 111.1 | 598.8 | 0.844 | - | 1339 |
| RHS-05 | RHS 250x100x8.0, 7 m SS, central point load + G UDL | RHS 250x100x8.0 | standard | PASS | Deflection (0.844) | 1073.1 | 1.234 | 0.322 | 1.000 | 111.1 | 111.1 | 598.8 | 0.844 | - | 88 |
| RHS-06 | RHS 150x100x6.3, 4 m SS, full UDL + axial compression 200 kN (~0.25 Npl) | RHS 150x100x6.3 | eigen | PASS | Member buckling y-y (Eq 6.61) (0.892) | 788.9 | 1.127 | 0.226 | 1.000 | 40.4 | 40.4 | 281.0 | 0.859 | - | 1505 |
| RHS-06 | RHS 150x100x6.3, 4 m SS, full UDL + axial compression 200 kN (~0.25 Npl) | RHS 150x100x6.3 | standard | PASS | Member buckling y-y (Eq 6.61) (0.892) | 789.2 | 1.127 | 0.226 | 1.000 | 40.4 | 40.4 | 281.0 | 0.859 | - | 90 |
| RHS-07 | RHS 160x80x5.0, 3 m cantilever, UDL + tip point load | RHS 160x80x5.0 | eigen | FAIL (ratio outlier) | Deflection (1.339) | 892.1 | 3.380 | 0.189 | 1.000 | 31.9 | 31.9 | 240.3 | 1.339 | - | 1259 |
| RHS-07 | RHS 160x80x5.0, 3 m cantilever, UDL + tip point load | RHS 160x80x5.0 | standard | FAIL | Deflection (1.339) | 527.9 | 1.000 | 0.246 | 1.000 | 31.9 | 31.9 | 240.3 | 1.339 | - | 65 |
| RHS-08 | RHS 400x200x10.0, 2 x 6 m continuous, full UDL | RHS 400x200x10.0 | eigen | PASS | Bending  M_Ed/M_c,Rd (0.821) | 18908.0 | 2.217 | 0.147 | 1.000 | 407.0 | 407.0 | 1217.2 | 0.235 | - | 3621 |
| RHS-08 | RHS 400x200x10.0, 2 x 6 m continuous, full UDL | RHS 400x200x10.0 | standard | PASS | Bending  M_Ed/M_c,Rd (0.821) | 5440.3 | 1.276 | 0.274 | 1.000 | 407.0 | 407.0 | 1217.2 | 0.235 | - | 74 |
| RHS-09 | RHS 350x150x10.0, 3 x 3 m continuous, G full + Q on outer spans | RHS 350x150x10.0 | eigen | PASS | Bending  M_Ed/M_c,Rd (0.682) | 10360.5 | 1.264 | 0.166 | 1.000 | 286.0 | 286.0 | 1054.7 | 0.321 | - | 4779 |
| RHS-09 | RHS 350x150x10.0, 3 x 3 m continuous, G full + Q on outer spans | RHS 350x150x10.0 | standard | PASS | Bending  M_Ed/M_c,Rd (0.682) | 6699.3 | 2.452 | 0.207 | 1.000 | 286.0 | 286.0 | 1054.7 | 0.321 | - | 112 |
| RHS-10 | RHS 300x200x8.0, 7 m SS, triangular load 0 -> 20 kN/m + Mz = 15 kN.m | RHS 300x200x8.0 | eigen | PASS | Deflection (0.789) | 4927.0 | 1.136 | 0.209 | 1.000 | 214.2 | 214.2 | 731.6 | 0.789 | - | 1393 |
| RHS-10 | RHS 300x200x8.0, 7 m SS, triangular load 0 -> 20 kN/m + Mz = 15 kN.m | RHS 300x200x8.0 | standard | PASS | Deflection (0.789) | 4972.4 | 1.146 | 0.208 | 1.000 | 214.2 | 214.2 | 731.6 | 0.789 | - | 78 |
| RHS-11 | RHS 100x50x4.0, 2.5 m SS, full UDL at e = 25 mm, fully restrained (box torsion) | RHS 100x50x4.0 | n/a (restrained) | PASS | Deflection (0.996) | - | - | - | - | - | 9.7 | 118.5 | 0.996 | - | 117 |
| RHS-12 | RHS 120x60x5.0, 3 m SS, central point load at e = 30 mm, unrestrained | RHS 120x60x5.0 | eigen | PASS | Deflection (0.849) | 283.5 | 1.342 | 0.247 | 1.000 | 17.4 | 17.4 | 176.8 | 0.849 | - | 1507 |
| RHS-12 | RHS 120x60x5.0, 3 m SS, central point load at e = 30 mm, unrestrained | RHS 120x60x5.0 | standard | PASS | Deflection (0.849) | 284.7 | 1.348 | 0.247 | 1.000 | 17.4 | 17.4 | 176.8 | 0.849 | - | 123 |
| RHS-13 | RHS 450x250x12.5, 10 m fixed-fixed, full UDL | RHS 450x250x12.5 | eigen | PASS | Bending  M_Ed/M_c,Rd (0.853) | 33051.6 | 1.490 | 0.143 | 1.000 | 676.5 | 676.5 | 1704.5 | 0.268 | - | 1542 |
| RHS-13 | RHS 450x250x12.5, 10 m fixed-fixed, full UDL | RHS 450x250x12.5 | standard | PASS | Bending  M_Ed/M_c,Rd (0.853) | 28590.3 | 2.578 | 0.154 | 1.000 | 676.5 | 676.5 | 1704.5 | 0.268 | - | 67 |
| RHS-14 | RHS 500x300x16.0, 14 m SS, full UDL, restraints at third points | RHS 500x300x16.0 | eigen | PASS | Deflection (0.854) | 48420.9 | 1.253 | 0.151 | 1.000 | 1100.0 | 1100.0 | 2411.3 | 0.854 | - | 3112 |
| RHS-14 | RHS 500x300x16.0, 14 m SS, full UDL, restraints at third points | RHS 500x300x16.0 | standard | PASS | Deflection (0.854) | 17930.0 | 1.127 | 0.248 | 1.000 | 1100.0 | 1100.0 | 2411.3 | 0.854 | - | 65 |
| RHS-15 | RHS 200x120x6.3, 6 m propped cantilever, full UDL | RHS 200x120x6.3 | eigen | PASS | Bending  M_Ed/M_c,Rd (0.957) | 2255.2 | 1.681 | 0.176 | 1.000 | 69.6 | 69.6 | 380.1 | 0.584 | - | 1346 |
| RHS-15 | RHS 200x120x6.3, 6 m propped cantilever, full UDL | RHS 200x120x6.3 | standard | PASS | Bending  M_Ed/M_c,Rd (0.957) | 2060.5 | 2.197 | 0.184 | 1.000 | 69.6 | 69.6 | 380.1 | 0.584 | - | 78 |
| RHS-16 | RHS 250x150x8.0, 8 m SS, UDL G+Q with upward wind (uplift combinations) | RHS 250x150x8.0 | eigen | PASS | Deflection (0.850) | 1960.7 | 1.127 | 0.265 | 1.000 | 137.8 | 137.8 | 603.3 | 0.850 | - | 3252 |
| RHS-16 | RHS 250x150x8.0, 8 m SS, UDL G+Q with upward wind (uplift combinations) | RHS 250x150x8.0 | standard | PASS | Deflection (0.850) | 1961.3 | 1.127 | 0.265 | 1.000 | 137.8 | 137.8 | 603.3 | 0.850 | - | 210 |
| RHS-17 | RHS 350x250x10.0, 7 m span + 2 m overhang, UDL + tip point load | RHS 350x250x10.0 | eigen | PASS | Bending  M_Ed/M_c,Rd (0.832) | 11593.4 | 1.186 | 0.181 | 1.000 | 379.5 | 379.5 | 1065.1 | 0.538 | - | 1444 |
| RHS-17 | RHS 350x250x10.0, 7 m span + 2 m overhang, UDL + tip point load | RHS 350x250x10.0 | standard | PASS | Bending  M_Ed/M_c,Rd (0.832) | 9803.3 | 1.290 | 0.197 | 1.000 | 379.5 | 379.5 | 1065.1 | 0.538 | - | 69 |
| MIX-01 | UB 457x191x82, 8 m SS, UDL + rising UVL + point + in-span couple + upward wind | UB 457x191x82 | eigen | PASS | LTB  M_Ed/M_b,Rd (0.847) | 258.6 | 1.134 | 1.395 | 0.435 | 219.1 | 503.3 | 756.3 | 0.279 | - | 3168 |
| MIX-01 | UB 457x191x82, 8 m SS, UDL + rising UVL + point + in-span couple + upward wind | UB 457x191x82 | standard | PASS | LTB  M_Ed/M_b,Rd (0.810) | 273.3 | 1.198 | 1.357 | 0.456 | 229.3 | 503.3 | 756.3 | 0.279 | - | 196 |
| MIX-02 | UB 533x210x92, 12 m Gerber beam on four supports, hinges at 2.5 and 9.5 m, full UDL | UB 533x210x92 | eigen | PASS | LTB  M_Ed/M_b,Rd (0.736) | 2102.2 | 2.304 | 0.556 | 0.912 | 591.8 | 649.0 | 908.7 | 0.328 | - | 3318 |
| MIX-02 | UB 533x210x92, 12 m Gerber beam on four supports, hinges at 2.5 and 9.5 m, full UDL | UB 533x210x92 | standard | PASS | LTB  M_Ed/M_b,Rd (0.993) | 510.1 | 2.995 | 1.128 | 0.676 | 438.8 | 649.0 | 908.7 | 0.328 | - | 96 |
| MIX-03 | UC 254x254x73, 6 m SS, full UDL + axial compression 500 kN + Mz = 15 kN.m (biaxial beam-column) | UC 254x254x73 | eigen | PASS | Member buckling z-z (Eq 6.62) (0.961) | 478.2 | 1.131 | 0.755 | 0.867 | 236.5 | 272.8 | 406.8 | 0.338 | - | 1327 |
| MIX-03 | UC 254x254x73, 6 m SS, full UDL + axial compression 500 kN + Mz = 15 kN.m (biaxial beam-column) | UC 254x254x73 | standard | PASS | Member buckling z-z (Eq 6.62) (0.962) | 475.3 | 1.127 | 0.758 | 0.865 | 236.0 | 272.8 | 406.8 | 0.338 | - | 72 |
| MIX-04 | UB 406x178x54, 8 m SS, three point loads restrained at each load, top-flange loading | UB 406x178x54 | eigen | PASS | Deflection (0.871) | 1233.0 | 1.139 | 0.484 | 0.953 | 275.2 | 288.8 | 529.1 | 0.871 | - | 3659 |
| MIX-04 | UB 406x178x54, 8 m SS, three point loads restrained at each load, top-flange loading | UB 406x178x54 | standard | FAIL | LTB  M_Ed/M_b,Rd (1.785) | 115.7 | 1.136 | 1.580 | 0.360 | 104.0 | 288.8 | 529.1 | 0.871 | Standard (closed-form) Mcr: a destabilising load height zg = +201 mm is entered, but SN003a publishes C2 only for the si | 113 |
| MIX-05 | UB 305x165x40, 6 m SS, 120 kN point load at 0.25 m from a support (high shear) + G UDL | UB 305x165x40 | eigen | PASS | LTB  M_Ed/M_b,Rd (0.614) | 109.9 | 1.135 | 1.248 | 0.562 | 96.3 | 171.3 | 318.6 | 0.232 | - | 1294 |
| MIX-05 | UB 305x165x40, 6 m SS, 120 kN point load at 0.25 m from a support (high shear) + G UDL | UB 305x165x40 | standard | PASS | LTB  M_Ed/M_b,Rd (0.613) | 110.2 | 1.138 | 1.247 | 0.563 | 96.5 | 171.3 | 318.6 | 0.232 | - | 86 |
| MIX-06 | UB 254x146x31, 6 m fixed-hinge-pinned (hinge at 3 m), full UDL | UB 254x146x31 | eigen | PASS (ratio outlier) | Bending  M_Ed/M_c,Rd (0.861) | 345.8 | 4.309 | 0.559 | 1.000 | 108.1 | 108.1 | 260.3 | 0.628 | - | 1323 |
| MIX-06 | UB 254x146x31, 6 m fixed-hinge-pinned (hinge at 3 m), full UDL | UB 254x146x31 | standard | PASS | Bending  M_Ed/M_c,Rd (0.861) | 200.6 | 3.814 | 0.734 | 1.000 | 108.1 | 108.1 | 260.3 | 0.628 | - | 87 |
| MIX-07 | RHS 200x100x8.0, 6 m fixed-fixed, two point loads + axial compression 300 kN | RHS 200x100x8.0 | eigen | FAIL | Member buckling z-z (Eq 6.62) (1.106) | 2063.7 | 1.310 | 0.194 | 1.000 | 77.5 | 77.5 | 474.2 | 0.299 | - | 1570 |
| MIX-07 | RHS 200x100x8.0, 6 m fixed-fixed, two point loads + axial compression 300 kN | RHS 200x100x8.0 | standard | FAIL | Member buckling z-z (Eq 6.62) (1.106) | 2027.6 | 2.574 | 0.196 | 1.000 | 77.5 | 77.5 | 474.2 | 0.299 | - | 90 |
| MIX-08 | UB 457x152x52, 7 m SS, UDL hung from the bottom flange + point load on the top flange (per-load zg) | UB 457x152x52 | eigen | PASS | LTB  M_Ed/M_b,Rd (0.667) | 122.0 | 1.191 | 1.575 | 0.362 | 109.5 | 302.5 | 578.4 | 0.155 | - | 1295 |
| MIX-08 | UB 457x152x52, 7 m SS, UDL hung from the bottom flange + point load on the top flange (per-load zg) | UB 457x152x52 | standard | NOT VERIFIED | LTB  M_Ed/M_b,Rd (0.735) | 107.3 | 1.177 | 1.679 | 0.328 | 99.3 | 302.5 | 578.4 | 0.155 | Standard (closed-form) Mcr: a destabilising load height zg = +225 mm is entered, but SN003a publishes C2 only for the si | 86 |
| MIX-09 | UB 686x254x140, 10 m SS, equal hogging end couples + full UDL (end moment + transverse load) | UB 686x254x140 | eigen | PASS | Bending  M_Ed/M_c,Rd (0.621) | 2389.0 | 4.562 | 0.711 | 1.000 | 1208.4 | 1208.4 | 1372.8 | 0.460 | - | 1424 |
| MIX-09 | UB 686x254x140, 10 m SS, equal hogging end couples + full UDL (end moment + transverse load) | UB 686x254x140 | standard | PASS | Bending  M_Ed/M_c,Rd (0.621) | 2059.4 | 3.932 | 0.766 | 1.000 | 1208.4 | 1208.4 | 1372.8 | 0.460 | - | 82 |
| MIX-10 | PFC 300x100x46, 6 m SS, central point load at e = -50 mm (load on the web side) | PFC 300x100x46 | eigen | PASS | LTB+torsion (EN 1993-6 Annex A) (0.810) | 145.3 | 1.343 | 1.081 | 0.546 | 92.8 | 169.9 | 443.1 | 0.328 | - | 1376 |
| MIX-10 | PFC 300x100x46, 6 m SS, central point load at e = -50 mm (load on the web side) | PFC 300x100x46 | standard | FAIL | LTB+torsion (EN 1993-6 Annex A) (99.000) | 42.6 | 1.348 | 1.997 | 0.220 | 37.4 | 169.9 | 443.1 | 0.328 | M_y,Ed reaches the elastic critical moment M_cr: the Annex A amplifier k_alpha is unbounded; the member is inadequate as | 140 |
