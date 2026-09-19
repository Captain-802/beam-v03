# Eigen vs standard M<sub>cr</sub>: outlier analysis (single-span library, 19 Sep 2026)

## Definitions

- **Ratio** = M<sub>cr,eigen</sub> / M<sub>cr,standard</sub> exactly as the engine prints it (`ltb.McrRatio`) and the
  batch flags it (cross-check iv, band 0.85 to 1.25). *Same segment* means the closed form is evaluated for the
  segment and the combination of the eigen design value (the governing bay between lateral restraints, else the whole
  member); *across the two runs* compares the eigen design value with the standard run's own design value (the whole
  member, one segment L<sub>E</sub> = k L).
- **Direction of conservatism.** Ratio > 1 means the closed form gives the **lower** M<sub>cr</sub> (conservative);
  **ratio < 1 means the closed form gives the higher M<sub>cr</sub>, i.e. the standard method is unconservative there**.
- The batch (`results.md`, 279 cases / 479 runs) flags 54 same-segment outliers and 84 across-run outliers. The runner
  tabulates a reason beside every same-segment outlier (`outlierReason()` in `run-batch.cjs`: cantilever, destabilising
  device, C<sub>2</sub> unpublished, hinge, clamped or warping-fixed ends, guided end, an end with U<sub>y</sub> or
  R<sub>x</sub> released, intermediate restraints, channel); the families are explained here.

## 1. Same-segment outlier families (eigen run's own comparison)

| Family | Cases (ratio) | Engineering reason | Closed form unconservative? |
|---|---|---|---|
| Laterally clamped ends (R<sub>z</sub> restrained at both ends: the fixed-fixed, guided-fixed and pinned-guided presets, CUS-01/03/08/10/14, AX-11) | UB-56 (2.89), UB-57 (0.79, see F-D), UB-71/74/75 (1.81-1.85), UB-72/77 (1.76, 2.09), UB-76/79 (1.83, 1.88), UC-14/15 (1.85, 1.83), PFC-24/25 (1.87, 1.82), SHS-14/15 (1.74, 1.79), RHS-17/18 (1.74, 1.67), ECC-04/06 (1.87, 1.81), ZG-01 (1.28), AX-04/05/11 (1.85, 1.83, 1.76), MZ-04 (1.73), CUS-01 (1.76), CUS-03 (1.60), CUS-08 (1.42, one end), CUS-10 (2.63, + warping), CUS-14 (1.68), TOR-08 (2.20, + warping) | The SN003a form keeps k = 1 (fork ends) whatever the end flags; v&prime; = 0 at both ends is worth k = 0.5 (SN003a Table 3.2 gives 1.725 for the UDL case against the eigen 1.756, hand check HC-23). The guided presets add the Serna C<sub>1</sub> of a whole-member diagram with a hogging end. The fixed-ended SN003a rows (UB-21, UB-43, UB-45, ZG-01/03, CUS-09) already carry the clamped ends in their C<sub>1</sub>, so most of them stay in band. | No (conservative by 30-190 %). The pair check xvi confirms the direction on CUS-01/03/10. |
| Warping-fixed ends (both ends: CUS-02/04/10/15, UB-51, TOR-04, TOR-08; one end: ECC-07) | CUS-02 (1.66), CUS-04 (1.66), CUS-15 (1.68), UB-51 (1.56), TOR-04 (1.38), ECC-07 (1.31) | k<sub>w</sub> = 1 in the closed form; SN003a k<sub>w</sub> = 0.5 gives 1.525 for the CUS-02 UDL case (eigen 1.657: the tabulated factor is the conservative side of the exact boundary condition). | No (conservative). Pair check xvi on CUS-02/04/10. |
| An end with U<sub>y</sub> or R<sub>x</sub> released while the closed form keeps fork ends at both | CUS-05 End 2 twist-free (0.483), CUS-06 lateral cantilever (0.483), CUS-07 lateral cantilever with the root warping fixed (0.683), CUS-12 propped in plane, laterally free End 2 (0.409) | The twist (or the whole lateral) mode is held at one end only; the eigenvalue halves (a mathematical identity makes CUS-05 and CUS-06 coincide: with M = 0 at both ends and v&Prime; natural, the v boundary conditions drop out of the &phi; equation, so only the &phi; conditions count). The closed form has no such case and silently keeps k = k<sub>w</sub> = 1. | **Yes (factor 1.5-2.4)** - the standard run of CUS-05 PASSes at 0.50 where the eigen run gives 0.90. Finding **F-C**: the closed-form route should refuse these end flag sets. |
| Cantilevers | UB-18/19/49/64/68, UC-04, ZG-04/05, AX-03/13, TOR-05/07: 0.99-1.02 (in band); PFC-09 (3.19), PFC-26 (1.77), TOR-01 (1.72), SHS-06 (1.40), RHS-07 (1.75), RES-03 (3.95) | I/H cantilevers: SN006a (C from Tables 3.1-3.3 with the root warping condition and &eta;) agrees with the eigenvalue to 2 % - table "Cantilevers (xvii)" in results.md. Channel cantilevers: the printed comparison is the doubly-symmetric form with C<sub>1</sub> = 1 over L (the design basis is the &kappa; chain, lower again). Box cantilevers: C<sub>1</sub> = 1 with fork ends (no published C for hollow sections), both LTB-exempt on both routes. RES-03: a mid-length lateral restraint SN006a cannot see. UB-65/66/67: SN006a does not cover the loading (standard NOT VERIFIED, no ratio). | No (conservative). |
| Destabilising device / C<sub>2</sub> unpublished | UB-40 (1.66), UB-52 (1.57), UB-44 (0.68), ZG-02 (0.57) | UB-40/52: the closed form applies the BS 5950-style &times;1.2 L<sub>E</sub>; the eigenvalue carries z<sub>g</sub> exactly (F2 of the earlier campaign keeps the eigen route from accepting the switch with z<sub>g</sub> = 0). UB-44 (point load at 0.35 L on the top flange), ZG-02 (propped, top-flange UDL): SN003a publishes C<sub>2</sub> only for the four Table 3.2 rows, so the closed form can only be evaluated with the load at the shear centre while the eigenvalue carries the destabilising height. | UB-44 and ZG-02 on the printed value only (32 % and 43 % high): the standard route refuses PASS for these inputs (NOT VERIFIED, iii-zgBlock 152/152). ZG-06 (guided-fixed, top flange) is blocked the same way with a ratio of 1.16. |
| Internal hinges | HNG-02 (1.72), HNG-03 (2.05), HNG-04 (1.29), HNG-07 (1.77) | SN003a has no row for a member with an internal hinge; Serna's quarter-point expression sees M = 0 at the hinge and a fixed-end hogging peak, C<sub>1</sub> large (k<sub>c</sub> floored). The eigenvalue of the actual layout (the hinge is not a lateral restraint, the clamped ends act for LTB) is higher. HNG-01 (fixed-hinge-pinned, 12 m) and HNG-05/06 stay in band. | No (conservative). |
| Channel &kappa; chain and in-band members | every other LTB run: 143 of 197 comparisons inside 0.85-1.25; the fork-ended SS library (UB-03: 1.004, UB-07: 1.004 ...) agrees with the closed form to 1 % | - | - |

## 2. Across-run outliers (eigen design value vs the standard run's whole-member design value)

84 of 200 eigen runs. Beyond the families above, the standard run's **design** value differs from its own comparison value where:

| Family | Reason | Closed form unconservative? |
|---|---|---|
| Intermediately restrained members (RES group, UB-06/08/13/39, UC-08, PFC-18, RHS-14, AEF-05, TFB-03, RES-08: ratios 2.7 to 14) | The standard route treats the member as ONE segment L<sub>E</sub> = k L with C<sub>1</sub> from the whole-member diagram (advisory printed); the eigen design value is the governing bay. The same-segment ratios of these runs are in band (0.96-1.08). The whole-member value drives most of the standard-route FAILs (RES-02/04, UB-06/08/13/39, PFC-18, AEF-05 ...). | No. To get the bay-by-bay check on the closed-form route the engineer enters each bay separately. |
| Channel &kappa; chain as the design basis (PFC-02..08/12/14/16/17/22..27, ECC-02/04/06/08/09, TOR-01, MIX-type channels: ratios 1.6 to 6.4) | The channel's design M<sub>cr</sub> on the standard route is the value back-calculated from the &kappa;-chain slenderness (L/i<sub>z</sub>)/&kappa;, a lower bound independent of the moment shape and the end flags; the printed same-segment comparison (doubly-symmetric form) is in band. | No (conservative; 11 channel FAILs on the standard route against 3 on the eigen route). |
| The single-span limitations of section 1 | see above | UB-44, ZG-02 on the printed number (PASS refused); F-C for the released ends. |

## 3. Findings and recommendations

- **F1 (fixed, 19 Sep 2026 campaign):** quarter-point / mid-span sampling of the closed-form C<sub>1</sub> at a moment
  jump took the far-side ordinate (`mAtStation()` now takes the larger side; UB-27 pinned in `tests/campaign.test.cjs`).
- **F2 (fixed, 19 Sep 2026 campaign):** the destabilising switch with every z<sub>g</sub> = 0 produced an eigen PASS with
  the load at the shear centre; the eigen route now blocks that input (UB-40 / UB-52).
- **F3 (closed by the scope change):** overhang layouts on the closed-form route left with the multi-span scope.
- **F4 (open, information):** UB-44 and ZG-02 print a closed-form M<sub>cr</sub> 32-43 % above the eigenvalue when
  C<sub>2</sub> is not published; the verdict is blocked, the printed number should be read with the block.
- **F-A, F-B, F-D (corrected by the 19 Sep 2026 review fixes), F-E (open):** see tests/batch/README.md "Findings":
  the End 2 web-bearing station moment (viii-Mend, 71 runs -> 0), the vanishing-bimoment mesh measure (TOR-07 PASS),
  the in-span couple off a mesh node (UB-57 PASS); the box-cantilever mesh error at the 0.5 % limit (RHS-07) stays open.
- **F-C (corrected by the 19 Sep 2026 review fixes):** the standard (closed-form) route evaluated SN003a with fork ends
  for any end flag set. For an end releasing R<sub>x</sub> or U<sub>y</sub> (CUS-05/06/07/11/12) the closed form is
  1.5-2.4 times the eigenvalue and the standard verdict was PASS at 0.50 where the eigen verdict is 0.90. The route now
  requires U<sub>y</sub> + R<sub>x</sub> at both ends (or the SN006a cantilever: root U<sub>y</sub> + R<sub>z</sub> +
  R<sub>x</sub>, free tip; a square hollow section is exempt by cl 6.3.2.1(2)) and otherwise prints NOT VERIFIED with a
  message naming the released flag (the fork-ended chain still printed), as it does for an unpublished C<sub>2</sub>;
  the eigen route's comparison value is "not applicable" for those ends (no ratio); clamped and warping-fixed ends keep
  k = k<sub>w</sub> = 1 (conservative, stated in the basis and as an advisory; the SN003a 0.5 factors are 1.8 % below the
  eigen ratio, HC-23). The standard runs of CUS-05/06/07/11/12, PFC-26 and RHS-07 (channel / box cantilevers) are now
  NOT VERIFIED; a cantilever with a laterally / torsionally restrained tip or a twist-free root is refused on the
  SN006a route too (`isSn006aCantilever`).
