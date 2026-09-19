# Section library: MasterSeries 2025 UK completion of the UB, UC, SHS and RHS tables

Branch `section-library-masterseries`, 19 September 2026. Source: MasterSeries 2025 UK section library export
(`MASTERSERIES_BEAM_DESIGN_EXTRACT/section_library/csv/_merged_clean/AllISection.csv` and `AllSHSRHS.csv`,
`Library = UK`; column dictionary and units in that folder's `README.md`: mm, kg/m, cm2, cm4, cm3, H = Iw in dm6).
Only `js/sections/{ub,uc,shs,rhs}-section-data.js` changed; `tests/sections-library.test.cjs` guards the result.

## 1. Counts per family

| Table (file) | Before | Added | After | Notes |
|---|---:|---:|---:|---|
| `UB` (ub-section-data.js) | 107 | 6 | 113 | MS UK has 113 UB; all 107 app rows are in the export |
| `TP385_UB` | 95 | 18 | 113 | P385 row now exists for every UB key: 12 derived for existing rows + 6 for the imported rows, see 4.2 |
| `UC` (uc-section-data.js) | 46 | 1 | 47 | MS UK has 47 UC |
| `TP385_UC` | 36 | 11 | 47 | 10 derived for existing rows + 1 for the imported row |
| `SHS_HF` (shs-section-data.js) | 96 | 159 | 255 | MS `SHS` = 254 hot-finished sizes; app keeps `260x260x6.3`, which MS does not list |
| `SHS_CF` (shs-section-data.js) | 86 | 13 | 99 | MS `CF SHS` (S355) = 99 |
| `RHS` (rhs-section-data.js) | 161 | 200 | 361 | MS `RHS` = 350 hot-finished; app keeps 11 rows MS lacks (`90 x 50 x 10.0` and the 17.5 mm series) |
| `RHS_CF` (rhs-section-data.js, NEW) | 0 | 142 | 142 | MS `CF RHS` (S355) = 142. Data only, see 6 |
| `TP385_SHS`, `TP385_RHS`, `PFC`, `TP385_PFC` | - | 0 | - | untouched: P385 Tables A.7/A.8 list only the Blue Book sizes; hollow rows without a P385 entry fall back to `ctBoxEN10210()` |

Every imported row carries a trailing `// MS` comment (`// MS derived` for hollow sections, whose section properties are
computed from the geometry; `; check availability` mirrors the MasterSeries `CheckAvailability` flag for non-preferred sizes).
Existing rows are byte-for-byte unchanged (test "Blue Book values kept from before are unchanged by the import").

Key conventions kept: UB/UC `"457 x 191 x 82"` (MasterSeries `457x191 UB 82`), SHS `"150x150x6.3"` (thickness always
one decimal: `"40x40x3.0"`), RHS `"200 x 100 x 8.0"`. The imperial 3 in x 2 in RHS range is keyed by its real size,
`"76.2 x 50.8 x 3.0"`. Sort order kept: UB/UC by serial depth, width and mass descending; hollows ascending by D, B, t.

## 2. Cross-check of the rows that exist in both the app and the export (Step 1)

Compared columns: D, B, tw, tf, A, Ix, Iy, Sx, Sy, J, Iw (and mass, d, r, u, x for information) for I-sections; D, B, t and mass
for hollow sections (MasterSeries stores no derived properties for hollows). Percentage = |app - MS| / MS.

| Family | App rows | MS rows | Common | Only in app | Only in MS |
|---|---:|---:|---:|---|---:|
| UB | 107 | 113 | 107 | - | 6 |
| UC | 46 | 47 | 46 | - | 1 |
| SHS_HF | 96 | 254 | 95 | 260x260x6.3 | 159 |
| SHS_CF | 86 | 99 | 86 | - | 13 |
| RHS | 161 | 350 | 150 | 90 x 50 x 10.0, 250 x 150 x 17.5, 300 x 100 x 17.5, 300 x 200 x 17.5, 350 x 150 x 17.5, 350 x 250 x 17.5, 400 x 200 x 17.5, 400 x 300 x 17.5, 450 x 250 x 17.5, 500 x 200 x 17.5, 500 x 300 x 17.5 | 200 |

Maximum difference per column over the common rows (row, app value, MS value):

| Family | Column | Max % | Row | App | MS |
|---|---|---:|---|---:|---:|
| UB | A | 0.46 | 457 x 191 x 82 | 104 | 104.48 |
| UB | Ix | 0.36 | 533 x 312 x 151 | 101000 | 100633 |
| UB | Iy | 2.17 | 1016 x 305 x 222 | 9550 | 9761.8 |
| UB | Sx | 0.44 | 1016 x 305 x 249 | 11300 | 11350 |
| UB | Sy | 0.38 | 1016 x 305 x 249 | 1240 | 1244.7 |
| UB | J | 3.64 | 254 x 102 x 22 | 4.15 | 4.30676 |
| UB | Iw | 1.28 | 1016 x 305 x 438 | 56 | 55.2934 |
| UB | mass | 0.61 | 305 x 102 x 33 | 32.8 | 33 |
| UB | u | 0.69 | 1016 x 305 x 249 | 0.86 | 0.865965 |
| UB | x | 2.88 | 1016 x 305 x 222 | 45.7 | 44.4201 |
| UB | r | 1.04 | 914 x 305 x 521 | 19 | 19.2 |
| UC | A | 0.36 | 305 x 305 x 97 | 123 | 123.44 |
| UC | Ix | 0.36 | 356 x 406 x 340 | 123000 | 122557 |
| UC | Iy | 0.59 | 356 x 406 x 235 | 31000 | 30819.6 |
| UC | Sx | 0.35 | 356 x 406 x 677 | 15400 | 15346.1 |
| UC | Sy | 0.36 | 152 x 152 x 30 | 112 | 111.6 |
| UC | J | 3.70 | 152 x 152 x 23 | 4.63 | 4.80811 |
| UC | Iw | 0.84 | 152 x 152 x 23 | 0.021 | 0.021177 |
| UC | mass | 0.22 | 356 x 406 x 900 | 900 | 902.01 |
| UC | r | 3.45 | 356 x 406 x 1086 | 15 | 14.5 |
| UC | u | 0.24 | 152 x 152 x 30 | 0.847 | 0.849018 |
| UC | x | 1.52 | 152 x 152 x 23 | 20.6 | 20.2916 |
| SHS_HF | mass | 1.64 | 260x260x16.0 | 120 | 122 |
| SHS_CF | mass | 0.55 | 300x300x6.0 | 54.7 | 54.4 |
| RHS | mass | 2.91 | 50 x 30 x 6.3 | 6.33 | 6.52 |

D, B, tw, tf, d, Ix, Sx, Sy and A agree within 0.5 % on every common row (max 0.46 % = 3-significant-figure rounding).
177 row/column pairs differ by more than 0.5 %; all are listed below. **No existing app value was changed**: none of
them is an evident transcription error. Evidence:

* **Iy** (20 rows, up to 2.3 %): an independent geometric calculation (two flanges + web + four root-fillet areas of
  (1 - pi/4) r^2 with their own inertia, the same corner algebra as section 5.1) reproduces
  the app value within 0.4 % on every row while the MasterSeries value is 0.5-2.3 % high (e.g. 1016 x 305 x 222: app 9550,
  hand 9546, MS 9762 cm4). The app values are the correct Blue Book figures.
* **J** (51 rows, up to 3.7 %): the app values match the SCI P385 Appendix B fillet formula
  (J = sum(b t^3/3) + 2 alpha D1^4 - 0.42 tf^4) within 0.3 % on every row; MasterSeries evidently uses a different
  fillet allowance (its J is 3 % high on the thin sections and 2-3 % low on the 1016 x 305 x 272/314). Kept.
* **Iw** (19 rows, up to 1.3 %), **u** (6 rows, up to 0.7 %) and **x** (31 rows, up to 2.9 %): follow from the J and Iy
  differences above (x = 0.566 h_s sqrt(A/J), u depends on Iy and Iw). Kept.
* **r** (root radius; 8 rows of the 914 x 305 series app 19.0 vs MS 19.1/19.2, and 7 of the 356 x 406 jumbo UC rows
  app 15.0/15.4 vs MS 14.5-15.3): catalogue-edition differences for the newer (EN 10365 / Advance) sizes. r only enters the
  EC3 flat-outstand ratio and the shear area, where 0.2 mm is immaterial. Kept; the engineer may want to confirm the 356 x 406
  x 1299/1202 radii (app 15.4) against the current British Steel brochure.
* **mass** (2 UB rows, 0.6 %; 33 hollow rows up to 2.9 %): the two UB rows are 3-s.f. rounding (457 x 152 x 52 app 52.3 vs
  MS 52.0; 305 x 102 x 33 app 32.8 vs 33.0). The hollow rows (14.2 / 16 mm SHS, thick-walled small RHS) are catalogue masses:
  the app values equal A x 7.85 with the EN 10210-2 Annex A corner geometry (e.g. 200x200x12.5 SHS: 92.07 cm2 -> 72.3 kg/m),
  the MasterSeries values (73.0) come from a manufacturer list computed with a different corner allowance. Kept.

Three largest discrepancies: UC 152 x 152 x 23 J 4.63 vs 4.81 cm4 (3.70 %), UB 254 x 102 x 22 J 4.15 vs 4.31 cm4 (3.64 %),
UC 356 x 406 x 1086 / 900 r 15.0 vs 14.5 mm (3.45 %).

### 2.1 Full list of rows differing by more than 0.5 %

| Family | Row | Column | App | MS | % |
|---|---|---|---:|---:|---:|
| UB | 1016 x 305 x 438 | Iw | 56 | 55.2934 | 1.28 |
| UB | 1016 x 305 x 393 | Iy | 20500 | 20712 | 1.02 |
| UB | 1016 x 305 x 393 | J | 2330 | 2308.53 | 0.93 |
| UB | 1016 x 305 x 393 | Iw | 48.4 | 48.0843 | 0.66 |
| UB | 1016 x 305 x 350 | Iw | 43.3 | 43.015 | 0.66 |
| UB | 1016 x 305 x 314 | Iy | 16200 | 16447.7 | 1.51 |
| UB | 1016 x 305 x 314 | J | 1260 | 1239.29 | 1.67 |
| UB | 1016 x 305 x 314 | u | 0.87 | 0.8754 | 0.62 |
| UB | 1016 x 305 x 272 | Iy | 14000 | 14220.4 | 1.55 |
| UB | 1016 x 305 x 272 | J | 835 | 814.148 | 2.56 |
| UB | 1016 x 305 x 272 | u | 0.871 | 0.8766 | 0.64 |
| UB | 1016 x 305 x 249 | Iy | 11800 | 11970.4 | 1.42 |
| UB | 1016 x 305 x 249 | J | 582 | 578.859 | 0.54 |
| UB | 1016 x 305 x 249 | Iw | 26.8 | 26.6321 | 0.63 |
| UB | 1016 x 305 x 249 | u | 0.86 | 0.866 | 0.69 |
| UB | 1016 x 305 x 249 | x | 39.8 | 39.5047 | 0.75 |
| UB | 1016 x 305 x 222 | Iy | 9550 | 9761.8 | 2.17 |
| UB | 1016 x 305 x 222 | J | 390 | 402.406 | 3.08 |
| UB | 1016 x 305 x 222 | Iw | 21.5 | 21.387 | 0.53 |
| UB | 1016 x 305 x 222 | u | 0.85 | 0.8555 | 0.65 |
| UB | 1016 x 305 x 222 | x | 45.7 | 44.4201 | 2.88 |
| UB | 914 x 305 x 576 | r | 19 | 19.1 | 0.52 |
| UB | 914 x 305 x 521 | r | 19 | 19.2 | 1.04 |
| UB | 914 x 305 x 425 | r | 19 | 19.1 | 0.52 |
| UB | 914 x 305 x 381 | r | 19 | 19.2 | 1.04 |
| UB | 914 x 305 x 345 | r | 19 | 19.2 | 1.04 |
| UB | 914 x 305 x 313 | r | 19 | 19.1 | 0.52 |
| UB | 914 x 305 x 271 | r | 19 | 19.1 | 0.52 |
| UB | 914 x 305 x 238 | r | 19 | 19.2 | 1.04 |
| UB | 914 x 305 x 224 | Iy | 11200 | 11271.5 | 0.63 |
| UB | 914 x 305 x 224 | x | 41.4 | 41.1248 | 0.67 |
| UB | 914 x 305 x 201 | J | 291 | 294.82 | 1.30 |
| UB | 914 x 305 x 201 | Iw | 18.4 | 18.3013 | 0.54 |
| UB | 914 x 305 x 201 | x | 46.9 | 46.3923 | 1.09 |
| UB | 838 x 292 x 176 | J | 221 | 223.839 | 1.27 |
| UB | 838 x 292 x 176 | x | 46.5 | 46.0664 | 0.94 |
| UB | 762 x 267 x 147 | J | 159 | 160.533 | 0.96 |
| UB | 762 x 267 x 147 | x | 45.2 | 44.8692 | 0.74 |
| UB | 762 x 267 x 134 | J | 119 | 120.985 | 1.64 |
| UB | 762 x 267 x 134 | x | 49.8 | 49.1964 | 1.23 |
| UB | 610 x 305 x 179 | J | 340 | 337.798 | 0.65 |
| UB | 610 x 305 x 179 | Iw | 10.2 | 10.1369 | 0.62 |
| UB | 610 x 305 x 149 | J | 200 | 198.176 | 0.92 |
| UB | 610 x 229 x 101 | x | 43.1 | 42.8599 | 0.56 |
| UB | 610 x 178 x 82 | Iw | 1.04 | 1.0304 | 0.93 |
| UB | 533 x 210 x 82 | J | 51.5 | 51.9909 | 0.94 |
| UB | 533 x 210 x 82 | x | 41.5 | 41.2527 | 0.60 |
| UB | 457 x 191 x 161 | Iw | 2.25 | 2.2368 | 0.59 |
| UB | 457 x 191 x 161 | x | 16.5 | 16.4051 | 0.58 |
| UB | 457 x 191 x 133 | Iw | 1.73 | 1.7212 | 0.51 |
| UB | 457 x 191 x 106 | Iw | 1.27 | 1.2612 | 0.70 |
| UB | 457 x 191 x 106 | x | 24.5 | 24.3732 | 0.52 |
| UB | 457 x 191 x 98 | Iw | 1.18 | 1.1726 | 0.63 |
| UB | 457 x 152 x 82 | Iy | 1180 | 1187.4 | 0.62 |
| UB | 457 x 152 x 82 | J | 89.2 | 88.684 | 0.58 |
| UB | 457 x 152 x 82 | u | 0.87 | 0.8748 | 0.55 |
| UB | 457 x 152 x 74 | J | 65.9 | 65.4655 | 0.66 |
| UB | 457 x 152 x 67 | J | 47.7 | 47.434 | 0.56 |
| UB | 457 x 152 x 52 | mass | 52.3 | 52 | 0.58 |
| UB | 406 x 178 x 74 | J | 62.8 | 62.4101 | 0.62 |
| UB | 406 x 178 x 67 | Iy | 1360 | 1367.8 | 0.57 |
| UB | 406 x 178 x 60 | J | 33.3 | 33.125 | 0.53 |
| UB | 406 x 178 x 54 | J | 23.1 | 23.2495 | 0.64 |
| UB | 406 x 178 x 54 | x | 38.3 | 38.0915 | 0.55 |
| UB | 406 x 140 x 46 | Iy | 538 | 540.9 | 0.54 |
| UB | 406 x 140 x 46 | J | 19 | 18.8722 | 0.68 |
| UB | 406 x 140 x 39 | Iy | 410 | 412.7 | 0.65 |
| UB | 406 x 140 x 39 | J | 10.7 | 10.8789 | 1.64 |
| UB | 406 x 140 x 39 | x | 47.4 | 46.8544 | 1.16 |
| UB | 356 x 171 x 67 | J | 55.7 | 55.2854 | 0.75 |
| UB | 356 x 171 x 57 | J | 33.4 | 33.2316 | 0.51 |
| UB | 356 x 171 x 45 | J | 15.8 | 15.9954 | 1.22 |
| UB | 356 x 171 x 45 | x | 36.8 | 36.5165 | 0.78 |
| UB | 356 x 127 x 39 | Iy | 358 | 360.7 | 0.75 |
| UB | 356 x 127 x 39 | J | 15.1 | 14.9969 | 0.69 |
| UB | 356 x 127 x 33 | Iy | 280 | 283.1 | 1.10 |
| UB | 356 x 127 x 33 | J | 8.79 | 8.8849 | 1.07 |
| UB | 356 x 127 x 33 | x | 42.1 | 41.6881 | 0.99 |
| UB | 305 x 165 x 54 | J | 34.8 | 34.5119 | 0.83 |
| UB | 305 x 165 x 46 | J | 22.2 | 21.9525 | 1.13 |
| UB | 305 x 165 x 46 | x | 27.1 | 27.2552 | 0.57 |
| UB | 305 x 165 x 40 | J | 14.7 | 14.5739 | 0.87 |
| UB | 305 x 127 x 48 | Iw | 0.102 | 0.1012 | 0.77 |
| UB | 305 x 127 x 37 | Iy | 336 | 337.8 | 0.53 |
| UB | 305 x 102 x 33 | Iy | 194 | 195 | 0.51 |
| UB | 305 x 102 x 33 | J | 12.2 | 12.1 | 0.83 |
| UB | 305 x 102 x 33 | mass | 32.8 | 33 | 0.61 |
| UB | 305 x 102 x 28 | Iy | 155 | 156.3 | 0.83 |
| UB | 305 x 102 x 28 | x | 37.4 | 37.0977 | 0.81 |
| UB | 305 x 102 x 25 | Iy | 123 | 123.8 | 0.65 |
| UB | 305 x 102 x 25 | J | 4.77 | 4.9283 | 3.21 |
| UB | 305 x 102 x 25 | Iw | 0.027 | 0.0272 | 0.67 |
| UB | 305 x 102 x 25 | x | 43.1 | 42.4745 | 1.47 |
| UB | 254 x 146 x 43 | J | 23.9 | 23.6998 | 0.84 |
| UB | 254 x 146 x 43 | x | 21.1 | 21.2156 | 0.55 |
| UB | 254 x 146 x 37 | J | 15.3 | 15.1973 | 0.68 |
| UB | 254 x 102 x 25 | J | 6.42 | 6.4921 | 1.11 |
| UB | 254 x 102 x 25 | x | 31.4 | 31.1253 | 0.88 |
| UB | 254 x 102 x 22 | Iy | 119 | 120.2 | 1.00 |
| UB | 254 x 102 x 22 | J | 4.15 | 4.3068 | 3.64 |
| UB | 254 x 102 x 22 | x | 36.3 | 35.4824 | 2.30 |
| UB | 203 x 133 x 25 | J | 5.96 | 6.0325 | 1.20 |
| UB | 203 x 133 x 25 | x | 25.6 | 25.4037 | 0.77 |
| UB | 203 x 102 x 23 | J | 7.02 | 6.9495 | 1.01 |
| UB | 178 x 102 x 19 | J | 4.41 | 4.3706 | 0.90 |
| UB | 178 x 102 x 19 | Iw | 0.0099 | 0.0098 | 0.53 |
| UB | 152 x 89 x 16 | Iy | 89.8 | 90.6 | 0.88 |
| UB | 152 x 89 x 16 | J | 3.56 | 3.5113 | 1.39 |
| UB | 127 x 76 x 13 | Iy | 55.7 | 56.6 | 1.59 |
| UB | 127 x 76 x 13 | J | 2.85 | 2.7689 | 2.93 |
| UB | 127 x 76 x 13 | Iw | 0.002 | 0.002 | 0.92 |
| UB | 127 x 76 x 13 | u | 0.894 | 0.8993 | 0.59 |
| UC | 356 x 406 x 1299 | r | 15.4 | 15 | 2.67 |
| UC | 356 x 406 x 1202 | r | 15.4 | 15 | 2.67 |
| UC | 356 x 406 x 1086 | r | 15 | 14.5 | 3.45 |
| UC | 356 x 406 x 900 | r | 15 | 14.5 | 3.45 |
| UC | 356 x 406 x 744 | r | 15 | 15.1 | 0.66 |
| UC | 356 x 406 x 634 | J | 13700 | 13845.1 | 1.05 |
| UC | 356 x 406 x 634 | x | 5.46 | 5.4262 | 0.62 |
| UC | 356 x 406 x 592 | r | 15 | 15.2 | 1.32 |
| UC | 356 x 406 x 551 | J | 9240 | 9304.49 | 0.69 |
| UC | 356 x 406 x 509 | r | 15 | 15.3 | 1.96 |
| UC | 356 x 406 x 235 | Iy | 31000 | 30819.6 | 0.59 |
| UC | 356 x 406 x 235 | J | 812 | 806.966 | 0.62 |
| UC | 356 x 406 x 235 | Iw | 9.54 | 9.4712 | 0.73 |
| UC | 356 x 406 x 235 | x | 12 | 12.0781 | 0.65 |
| UC | 356 x 368 x 202 | J | 558 | 555.088 | 0.52 |
| UC | 356 x 368 x 202 | x | 13.3 | 13.3845 | 0.63 |
| UC | 356 x 368 x 153 | J | 251 | 248.374 | 1.06 |
| UC | 356 x 368 x 153 | x | 17 | 17.0975 | 0.57 |
| UC | 356 x 368 x 129 | J | 153 | 151.001 | 1.32 |
| UC | 356 x 368 x 129 | x | 19.8 | 19.9503 | 0.75 |
| UC | 305 x 305 x 283 | J | 2030 | 2040.25 | 0.50 |
| UC | 305 x 305 x 158 | x | 12.4 | 12.4756 | 0.61 |
| UC | 254 x 254 x 73 | J | 57.6 | 57.1079 | 0.86 |
| UC | 254 x 254 x 73 | x | 17.2 | 17.3173 | 0.68 |
| UC | 203 x 203 x 71 | J | 80.2 | 79.7347 | 0.58 |
| UC | 203 x 203 x 52 | J | 31.8 | 31.6242 | 0.56 |
| UC | 152 x 152 x 30 | J | 10.5 | 10.5606 | 0.57 |
| UC | 152 x 152 x 30 | Iw | 0.031 | 0.0307 | 0.82 |
| UC | 152 x 152 x 30 | x | 16.1 | 15.9462 | 0.96 |
| UC | 152 x 152 x 23 | J | 4.63 | 4.8081 | 3.70 |
| UC | 152 x 152 x 23 | Iw | 0.021 | 0.0212 | 0.84 |
| UC | 152 x 152 x 23 | x | 20.6 | 20.2916 | 1.52 |
| SHS_HF | 160x160x14.2 | mass | 63.3 | 64.2 | 1.40 |
| SHS_HF | 180x180x14.2 | mass | 72.2 | 73.2 | 1.37 |
| SHS_HF | 200x200x12.5 | mass | 72.3 | 73 | 0.96 |
| SHS_HF | 200x200x14.2 | mass | 81.1 | 82.1 | 1.22 |
| SHS_HF | 250x250x14.2 | mass | 103 | 104 | 0.96 |
| SHS_HF | 260x260x10.0 | mass | 77.7 | 78.1 | 0.51 |
| SHS_HF | 260x260x12.5 | mass | 95.8 | 96.6 | 0.83 |
| SHS_HF | 260x260x14.2 | mass | 108 | 109 | 0.92 |
| SHS_HF | 260x260x16.0 | mass | 120 | 122 | 1.64 |
| SHS_HF | 300x300x14.2 | mass | 126 | 127 | 0.79 |
| SHS_HF | 350x350x14.2 | mass | 148 | 149 | 0.67 |
| SHS_HF | 400x400x14.2 | mass | 170 | 171 | 0.58 |
| SHS_CF | 300x300x6.0 | mass | 54.7 | 54.4 | 0.55 |
| RHS | 50 x 30 x 6.3 | mass | 6.33 | 6.52 | 2.91 |
| RHS | 60 x 40 x 8.0 | mass | 10 | 10.3 | 2.91 |
| RHS | 100 x 60 x 10.0 | mass | 21.1 | 21.6 | 2.31 |
| RHS | 120 x 60 x 10.0 | mass | 24.3 | 24.7 | 1.62 |
| RHS | 200 x 100 x 4.0 | mass | 18.2 | 18.3 | 0.55 |
| RHS | 200 x 100 x 14.2 | mass | 58.9 | 59.8 | 1.51 |
| RHS | 200 x 120 x 14.2 | mass | 63.3 | 64.2 | 1.40 |
| RHS | 200 x 120 x 16.0 | mass | 70.2 | 71.4 | 1.68 |
| RHS | 200 x 150 x 14.2 | mass | 70 | 70.9 | 1.27 |
| RHS | 250 x 100 x 14.2 | mass | 70 | 70.9 | 1.27 |
| RHS | 250 x 150 x 14.2 | mass | 81.1 | 82.1 | 1.22 |
| RHS | 300 x 100 x 14.2 | mass | 81.1 | 82.1 | 1.22 |
| RHS | 300 x 200 x 14.2 | mass | 103 | 104 | 0.96 |
| RHS | 350 x 150 x 14.2 | mass | 103 | 104 | 0.96 |
| RHS | 350 x 250 x 14.2 | mass | 126 | 127 | 0.79 |
| RHS | 400 x 200 x 14.2 | mass | 126 | 127 | 0.79 |
| RHS | 400 x 300 x 14.2 | mass | 148 | 149 | 0.67 |
| RHS | 450 x 250 x 14.2 | mass | 148 | 149 | 0.67 |
| RHS | 500 x 200 x 14.2 | mass | 148 | 149 | 0.67 |
| RHS | 500 x 300 x 14.2 | mass | 170 | 171 | 0.58 |

## 3. Imported I-sections (UB, UC)

| Key | MasterSeries name | Note |
|---|---|---|
| 1016 x 305 x 487 | 1016x305 UB 487 | EN 10365 size (D 1036.1, B 308.5, tw 30, tf 54.1); distinct from the BS 4 1016 x 305 x 494 |
| 1016 x 305 x 437 | 1016x305 UB 437 | EN 10365 size (D 1025.9, B 305.4); distinct from 1016 x 305 x 438 |
| 1016 x 305 x 349 | 1016x305 UB 349 | EN 10365 size (D 1008.1); distinct from 1016 x 305 x 350 |
| 533 x 312 x 272 | 533x312 UB 272 | EN 10365 designation, geometry identical to 533 x 312 x 273 (MS flags the 273 row `Additional`) |
| 533 x 312 x 150 | 533x312 UB 150 | idem, identical to 533 x 312 x 151 |
| 533 x 165 x 74 | 533x165 UB 74 | idem, identical to 533 x 165 x 75 |
| 356 x 406 x 477 | 356x406 UC 477 | D 427, B 424.4, tw 48, tf 53.2 (MS row is hand-entered: J = 5700, u = 0.816) |

Row layout kept: `key, mass, D, B, tw, tf, r, d, bT, dt, Ix, Iy, rx, ry, Zx, Zy, Sx, Sy, u, x, J, A, Iw`. Taken from the
export (4 significant figures): mass, D, B, tw, tf (`T`), r (`r1`), d (`d-f`), Ix, Iy, Sx, Sy, u, x, J, A (`Area`), Iw (`H`).
Derived: `Zx = Ix/(D/2)`, `Zy = Iy/(B/2)`, `rx = sqrt(Ix/A)`, `ry = sqrt(Iy/A)`, `dt = d/tw`, and
`bT = (B - tw - 2r)/(2 tf)` - **not** `(B/2)/tf`: the existing UB/UC rows store the EC3 Table 5.2 flat outstand `c/tf`
(check: 457 x 191 x 82 -> (191.3 - 9.9 - 20.4)/32 = 5.03 as tabulated, whereas (B/2)/tf = 5.98), because `classifyEC3()` compares
`sec.bT` directly with 9/10/14 epsilon and `bs5950-checks.js` recomputes its own `(B/2)/tf`. The brief's `(B/2)/tf` would have
mis-classified the new rows; the file convention was followed.

J note: the app tables carry SCI (P385 Appendix B) J values; the seven imported rows carry the MasterSeries J. The P385-B
formula gives 4299 / 3185 / 1718 / 1288 / 216.2 / 47.9 / 5705 cm4 for the seven rows (MS 4282 / 3162 / 1690 / 1288 / 216.2 /
47.94 / 5700; max difference 1.6 % on 1016 x 305 x 349). The alias rows agree exactly with their BS 4 twins.

## 4. P385 torsion rows (`TP385_UB`, `TP385_UC`)

Row layout `[IT cm4, a m, Iw dm6, Wn0 cm2, Sw1 cm4]` as consumed by `tp385For()`.

### 4.1 Formula validation against the tabulated P385 rows

The brief's formulas were checked against all 95 UB and 36 UC rows already in the tables before use:

| Quantity | Formula | Max deviation UB | Max deviation UC |
|---|---|---:|---:|
| a | sqrt(E Iw / (G IT)), E = 210000, G = 81000 N/mm2 | 0.84 % (152 x 89 x 16: 0.585 vs 0.59, i.e. 2-s.f. rounding) | 0.51 % |
| Wn0 | (D - tf) B / 4 | 0.36 % | 0.46 % |
| Sw1 | (D - tf) B^2 tf / 16 | 0.46 % | 0.25 % |

All within the 2 % acceptance, so the brief's convention is the one the existing rows use (Wn0 and Sw1 are the sectorial
coordinate and warping statical moment of the flange tip for a doubly-symmetric I-section, P385 Appendix A.1). The tabulated
P385 IT includes the Appendix B junction correction and differs from the table J by up to 1.0 % (533 x 210 x 82: IT 51.5 vs
J 52.0); for the derived rows IT = J is used, as the brief instructs.

### 4.2 Rows added

* 22 existing sections had no P385 row (the 1016 x 305 x 584/494/415, the nine newer 914 x 305 sizes and the ten 356 x 406
  jumbo UC from 1299 to 509 are not in P385 Appendix A). Rows derived from the table J and Iw, tagged `// derived from table row`.
* 7 imported sections: rows derived from the imported J and Iw, tagged `// MS, derived`.

## 5. Hollow sections (SHS_HF, SHS_CF, RHS, RHS_CF)

MasterSeries stores only D, B, t, mass and surface for hollow sections; everything else is derived from the geometry.

### 5.1 Derivation

Corner radii (design values used by the product standards for section properties):

* hot finished, EN 10210-2:2006 Annex A: r_o = 1.5 t, r_i = 1.0 t;
* cold formed, EN 10219-2:2006 Annex B: r_o = 2.0 t (t <= 6 mm), 2.5 t (6 < t <= 10 mm), 3.0 t (t > 10 mm); r_i = r_o - t.

The section is the difference of two rounded rectangles (outer B x D radius r_o, inner (B - 2t) x (D - 2t) radius r_i). For a
rounded rectangle b x h with corner radius r, each missing corner piece has area a_c = (1 - pi/4) r^2, centroid at
x_c = r / (6 (1 - pi/4)) = 0.7766 r from the quarter-circle centre and second moment about its own centroid
I_c = r^4 (1/3 - pi/16) - a_c x_c^2, so

    A  = b h - 4 a_c
    I  = b h^3/12 - 4 [ I_c + a_c (h/2 - r + x_c)^2 ]          (axis parallel to b)
    Q  = b h^2/8  - 2 a_c (h/2 - r + x_c)                        (first moment of the half section)

and for the hollow section A = A_o - A_i, I_x = I_o - I_i (same for I_y with b and h swapped), Z_x = I_x/(D/2),
Z_y = I_y/(B/2), S_x = 2 (Q_o - Q_i), S_y likewise, r_x = sqrt(I_x/A), r_y = sqrt(I_y/A). This is algebraically the
EN 10210-2 Annex A / EN 10219-2 Annex B expression written with the corner pieces made explicit.

Torsion follows the convention already used by `ctBoxEN10210()` in `js/02-section-data.js` (EN 10210-2 Annex A with the mean
corner radius R_c = (r_o + r_i)/2, i.e. 1.25 t hot finished, 1.5 t / 2.0 t / 2.5 t cold formed):

    h_p = 2 [(D - t) + (B - t)] - 2 R_c (4 - pi)
    A_h = (D - t)(B - t) - R_c^2 (4 - pi)
    K   = 2 A_h t / h_p
    J   = t^3 h_p / 3 + 2 K A_h
    C   = J / (t + K/t)

Mass is the export value (kg/m) exactly, as instructed. Flat-width ratios follow each file: `SHS_HF` and `RHS` store the
BS 5950 Table 11 hot-finished ratios `dt = (D - 3t)/t`, `bT = (B - 3t)/t`; `SHS_CF` and `RHS_CF` store the cold-formed
`(D - 5t)/t`, `(B - 5t)/t` (the EC3 path in `activeSectionBase()` converts SHS_CF to `(D - 3t)/t` per P363 at run time).

### 5.2 Validation of the derived properties against the Blue Book rows kept from before

Every existing hollow row (96 SHS_HF, 86 SHS_CF, 161 RHS) was recomputed from its D, B, t with the formulas above.
Maximum deviation from the tabulated Blue Book value:

| Property | SHS_HF (96 rows) | SHS_CF (86 rows) | RHS (161 rows) |
|---|---:|---:|---:|
| A | 0.36 % | 0.48 % | 0.42 % |
| I (Ix) | 0.45 % | 0.38 % | 0.37 % |
| Iy | - | - | 0.40 % |
| Z (Zx) | 0.48 % | 0.52 % | 0.43 % |
| Zy | - | - | 0.47 % |
| S (Sx) | 0.41 % | 0.35 % | 0.47 % |
| Sy | - | - | 0.39 % |
| r (rx) | 0.38 % | 0.38 % | 0.45 % |
| ry | - | - | 0.47 % |
| J | 0.44 % | 0.41 % | 0.37 % |
| C | 0.48 % | 0.30 % | - |
| A x 7.85 vs tabulated mass | 0.43 % | 0.40 % | 0.43 % |

All under the 1 % acceptance (the residue is 3-s.f. rounding of the Blue Book), for both corner conventions, so the formulas
and the cold-formed radius bands are right. `tests/sections-library.test.cjs` repeats this sweep over all 343 rows on every run.

### 5.3 MasterSeries mass versus the Annex A / Annex B area

For the imported rows the stored mass is the export value; the derived A is consistent with the product-standard geometry.
For a minority of sizes the two disagree by more than 1 %, which shows that MasterSeries took those masses from a manufacturer
list computed with a different corner allowance (not a transcription problem: the size name embeds the mass, e.g.
`350x350x25 SHS 242`). The engineer should be aware that self-weight (mass) and axial capacity (A) of those rows are
therefore not perfectly consistent; the worst case is 3.2 %.

| Table | Imported rows | > 1 % | > 2 % | > 3 % | Worst rows (key: MS mass vs A x 7.85) |
|---|---:|---:|---:|---:|---|
| SHS_HF | 159 | 70 | 28 | 4 | 350x350x25.0: 242 vs 249.86 (-3.1 %); 550x550x40.0: 608 vs 627.08 (-3.0 %); 500x500x36.0: 498 vs 513.59 (-3.0 %); 450x450x32.0: 399 vs 411.38 (-3.0 %) |
| SHS_CF | 13 | 2 | 2 | 0 | 60x60x6.0: 9.2 vs 9.45 (-2.6 %); 70x70x6.0: 11.1 vs 11.33 (-2.0 %); 350x350x6.0: 63.8 vs 64.08 (-0.4 %); 120x120x3.0: 10.8 vs 10.84 (-0.4 %) |
| RHS | 200 | 53 | 5 | 0 | 60 x 40 x 7.1: 9.37 vs 9.14 (+2.5 %); 50 x 30 x 5.6: 5.93 vs 5.78 (+2.5 %); 90 x 50 x 8.8: 16.6 vs 16.26 (+2.1 %); 100 x 50 x 8.8: 18 vs 17.64 (+2.0 %) |
| RHS_CF | 142 | 1 | 0 | 0 | 100 x 80 x 6.0: 14.9 vs 15.1 (-1.3 %); 400 x 200 x 6.0: 54.4 vs 54.66 (-0.5 %); 450 x 250 x 6.0: 63.8 vs 64.08 (-0.4 %); 450 x 250 x 12.0: 123 vs 122.51 (+0.4 %) |

Pattern: the 5.6 / 7.1 / 8.8 / 11 / 14.2 mm walls and the 350 mm and larger hot-finished SHS are about 0.6 x t^2 (small thick
sections, mass high) to 3 x t^2 (large sections, mass low) away from the 1.25 t^2 corner deduction of Annex A.

## 6. Not imported, and what is data-only

* **Cold-formed S235 series** (`CF SHS 235`: 48 sizes, `CF RHS 235`: 47 sizes) - not imported. The app has one global grade
  (`S.grade`, S275/S355/S460 only, `pyFromGrade()`); it cannot carry a per-section default grade, so an S235 row would be
  designed at the wrong strength. The sizes are the same as the S355 series (25x25x2 to 150x150x5 SHS, 50x25x2 to 200x100x5 RHS).
* **JSHS / JRHS jumbo ranges** (87 + 33 sizes, 350x350x19 to 800x800x60, 500x300x19 to 1400x75x15) - excluded by the brief.
* **RSJ (19), UBP (17), UB1 (1), CHS, channels and angles** - outside the four families requested.
* **`RHS_CF` is data only.** `activeSectionBase()` normalises the RHS family as `boxType: "HF"` with no cold-formed switch,
  and the brief allowed no edits outside `js/sections/*.js`. The 142 rows sit in `RHS_CF` / `RHS_CFmap` (same layout as
  `RHS`, cold-formed flat widths) and are tested directly; wiring needs an `rhsType` selector mirroring `shsType` in
  `js/02-section-data.js`, `js/03-state-ui.js`, `js/07-wiring.js` and `index.html`, with `boxType: "CF"` (BS 5950 strut
  curve c, EC3 `c = h - 3t` conversion as done for SHS_CF, and `ctBoxEN10210()` would need the cold-formed mean radius).
* **Hollow P385 rows**: `TP385_SHS` / `TP385_RHS` were not extended; sizes absent from P385 Tables A.7/A.8 use the
  `ctBoxEN10210()` formula (identical to the derived J and C for hot-finished sizes).

## 7. Tests

`tests/sections-library.test.cjs` (Node test runner, `tests/harness.cjs`): every key of every family resolves through
`activeSectionBase()` / `activeSection()` with finite positive properties (RHS_CF through its map); the 7 imported I-sections
reproduce Zx, Zy, rx, ry, bT, dt and, together with the 22 tp-derived rows, a, Wn0, Sw1 plus literal hand values; an independent implementation of the
hollow derivation matches the 343 Blue Book rows within 1 % and the 514 imported rows within 0.2 %, with mass within 3.5 %
of A x 7.85; P385 rows exist for every UB/UC; no duplicate keys; constant row length per file (23 / 23 / 12 / 17 / 24); the
family counts and sort orders above; and spot values of the pre-import tables are unchanged. The full suite
(`node --test tests/*.test.cjs`, 38 tests including the dist parity check after `build-single-html.ps1`) passes.

