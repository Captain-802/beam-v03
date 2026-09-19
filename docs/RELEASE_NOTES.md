# Release notes: branch `ms-brief-standard-mcr` → `main`

Pull request summary for `Captain-802/beam-v03`. Branch base: `54070b8` (the audited v03, "Correct structural verdicts, combinations and serviceability checks (#1)", 16 Sep 2026). Head: `ce8dc0d` plus this documentation commit; 22 engineering and documentation commits, all dated 19 Sep 2026. Every commit was gated by `node --test tests/*.test.cjs`, `node tests/batch/run-batch.cjs` with `ERROR 0`, `pwsh ./build-single-html.ps1` and the dist parity test; the numerical evidence of every change is in `AUDIT.md` under the 19 Sep 2026 headings and the engineer-facing summary is `docs/VERIFICATION_REPORT.md` (section 7 for the single-span scope).

## What this branch delivers

- A **MasterSeries-format EC3 design brief** printed above the detailed derivation, specified line by line in `docs/BRIEF_MAPPING.md` and numerically at parity with the MasterSeries worked examples (M<sub>cr</sub> within 0.15 %, M<sub>b,Rd</sub> within 0.05 %; the residue is section-table rounding).
- The **standard closed-form M<sub>cr</sub> method** (SN003a / SCI end-moment curve / Serna / SN006a / channel κ chain) as a user option beside the FE eigenvalue default, with the closed-form chain as its design basis and every unpublished case blocked rather than approximated.
- **Gap closure** of the EC3 trigger list: uplift / hold-down, web transverse forces (EN 1993-1-5 clause 6 + 7.2), minor-axis classification, A<sub>eff</sub> of a Class-4 web, cl 6.2.10 M-V-N, the k<sub>c</sub> floor, the Table B.1 RHS row, PFC torsional-flexural buckling, high-shear M<sub>v,Rd</sub> for every family, restraint design forces, a general warping-torsion FE for open sections. 15 of the 18 ranked P1 / P2 items of `docs/COVERAGE_MATRIX.md` are implemented; shear buckling, flange holes and restraint height remain open.
- **Single-span scope** (owner's decision of 19 Sep 2026): one member from End 1 to End 2, six degrees of freedom plus warping per end, each restrained or free; a new *Geometry & end conditions* panel; the in-plane, LTB, torsion, axial and BS 5950 engines all driven by the same end flags; every mechanism refused before a solve.
- **Complete section tables** (UB / UC / SHS / RHS from the MasterSeries 2025 UK library, cold-formed RHS wired with its own curves) and a **verification campaign** of 279 cases / 479 runs with independent closed-form cross-checks, 59 hand checks and a documented eigen-vs-closed-form comparison; 141 regression tests (31 at the base).

## Breaking changes

1. **Single span only.** Intermediate supports, overhangs, multi-span continuity, Gerber layouts and the automatic span pattern loading are removed from the code (not hidden): `spanSegments()`, `expandPatternCombos()`, `patternInfo`, the pattern masks of `comboLoadPieces()`, the max-reaction pattern sets, the per-segment deflection rows, the "span by span (support to support)" LTB isolation, the "+ Add support" / "Automatic pattern loading" / "Root warping" controls. A layout that needs them is refused by `endsStability()` with a message; the tool no longer accepts more than two support points. Cantilevers are rooted at End 1 (a root at End 2 is refused: mirror the member).
2. **State key `S.ends` replaces `S.supports`.** `S.ends = {e1: {ux, uy, uz, rx, ry, rz, warp, holdDown, ss, stiff}, e2: {…}}` (true = restrained), `S.endPreset` names the drop-list selection; `S.rootWarp`, `S.fixedLateral`, `S.autoPattern` and the per-support `vp` / `phip` / `warpFix` boxes are gone (their meaning is the end flags). Any saved state, bookmark, harness override or batch case that carries `supports` must be rewritten as `ends` (the presets are `endsPreset('ss' | 'fixed-fixed' | 'fixed-pinned' | 'cantilever' | 'guided-fixed' | 'pinned-guided', overrides)`; `tests/harness.cjs` exposes `ends(preset, overrides)`). `S.leFactor` is blank by default (the strut lengths come from the end fixities); an entered 1.0 is now an override, not "default".
3. **Deliberate behaviour changes of the scope change** (AUDIT.md "19 Sep 2026 scope change"): the cantilever preset restrains the root warping, so a cantilever's M<sub>cr</sub> rises against the former "root warping free" default (untick the End 1 warping box for the old value); one warping flag per end drives both the LTB φ′ = 0 and the torsion FE (the two separate boxes are merged); fixed-ended and propped struts take 0.7 L / 0.85 L by default instead of the entered 1.0 L; a fixed end is laterally clamped for LTB (R<sub>z</sub> ticked by the fixed presets - untick it if the connection does not restrain the flanges' lateral rotation); the reaction moment is printed in the diagram convention at both ends (the old note flipped the sign at End 2).
4. **Verdict changes on existing inputs** (each one printed with its reason): the standard (closed-form) M<sub>cr</sub> route is NOT VERIFIED for any end set that is not fork-fork (U<sub>y</sub> + R<sub>x</sub> at both ends) or the SN006a cantilever (root U<sub>y</sub> + R<sub>z</sub> + R<sub>x</sub>, free tip) and for cantilever loadings outside SN006a Tables 3.1-3.3; a destabilising z<sub>g</sub> without a published C<sub>2</sub> blocks the standard route; the eigen route blocks the destabilising switch when every z<sub>g</sub> = 0; the BS 5950 path validates the lateral end flags and refuses L<sub>E</sub> = 1.0 L for a released end until a factor is entered; a blank stiff bearing length is the lower bound 0 (NOT VERIFIED where a station fails at 0); uplift at an end blocks PASS unless "hold-down provided" is ticked; a Class-4 web in uniform compression is evaluated with A<sub>eff</sub> instead of blocked.
5. **Renderer contract:** `renderMasterSeriesBrief(a, c, sec)` is a new pure function; `render()` prints it before the detailed report for `S.code === 'EC3'`; the report's support rows are replaced by the End conditions line and the per-end reactions. `checksEC3UnrestrainedSCI` is reachable again as `window.checksEC3UnrestrainedStandard` (dispatch on `S.mcrMethod`).

Nothing changes for the deployment shape: one `index.html` with `css/` and `js/`, one built `dist/beam-design-single.html`, no external dependency, no inline handler, no eval.

## Commits (oldest first)

| Commit | Change |
|---|---|
| `e7b8f8e` | docs: MasterSeries 2025 steel-beam logic extract with 11 evidence crops; EC3 beam trigger list (65 checks) |
| `5f5f9cc` | docs: `BRIEF_MAPPING.md`, the line-by-line specification of the MasterSeries-format brief |
| `e00b27e` | docs: `COVERAGE_MATRIX.md` - every trigger against the code with file:line evidence, the MasterSeries interaction comparison, the ranked P1 / P2 gaps |
| `711b80b` | Standard closed-form M<sub>cr</sub> method as a user option (`S.mcrMethod`) beside the FE eigensolver |
| `ec9dfff` | Headless batch runner and the first 111-case library |
| `6f650b9` | MasterSeries-format EC3 design brief (`js/06-brief-masterseries.js`) above the detailed report |
| `0a2b016` | Standard route as the design basis (M<sub>cr</sub> chain, per-load z<sub>g</sub>, unpublished C<sub>2</sub> blocked, one shared LTB curve); the brief prints engine values only |
| `c3adfbe` | Gap closure G1: automatic pattern loading, uplift / hold-down, cantilever strut length, per-segment deflection limits (the pattern and per-segment parts later removed by the single-span scope) |
| `e2fcd00` | Gap closure G2: web transverse forces at every point load and support, EN 1993-1-5 clause 6 + 7.2 |
| `b1dc961` | Gap closure G3: I/H minor-axis classification, A<sub>eff</sub> of a Class-4 web, cl 6.2.10, k<sub>c</sub> floor, RHS k<sub>ij</sub> row, PFC torsional-flexural buckling, high-shear M<sub>v,Rd</sub> for every family, restraint forces |
| `78ee2a8` | Gap closure G4: general warping-torsion FE for open sections (`js/checks/torsion-fe.js`) |
| `fa631fa` | Verification campaign: 170-case library, hand checks, M<sub>cr</sub> method comparison; F1 (closed-form C<sub>1</sub> sample at a moment jump) and F2 (destabilising switch without a load height) fixed |
| `42565d7` | Review fixes F1-F7: one-sided bimoment at interior warping-fixed nodes, PFC L<sub>T</sub> from twist restraints, γ<sub>G,inf</sub> companions, max-reaction pattern set (later removed), s<sub>s</sub> lower bound, solve caches |
| `371ca97` | docs: `VERIFICATION_REPORT.md` sections 1-6 for the owning engineer |
| `18d9401` | **Single-span scope, engine half**: `S.ends`, presets, the `guided` support type, `endsStability()`, `lcrDefaults()`; intermediate supports, overhangs and pattern loading removed |
| `65a4395` | **Single-span scope, UI half**: the End conditions panel; End conditions line and per-end reactions in the brief and the report; superseded controls removed |
| `ce09a9e` | Single-span verification library: 279 cases, closed forms of the six presets, pair bounds, cantilever SN006a record, 14 expected-error layouts, 59 hand checks; findings F-A .. F-E recorded |
| `6819738` | Complete UB / UC / SHS / RHS tables from the MasterSeries 2025 UK library (`docs/SECTION_LIBRARY.md`) |
| `cc6f340` | Review fixes F-A .. F-D (End 2 web-bearing station, torsion-FE mesh measure, closed-form route refusing non-fork ends, couples as eigen mesh nodes); BS 5950 lateral flags and Table 13 / 14 L<sub>E</sub>; Reset state; no inline handlers |
| `f4f7adc` | Consolidated AUDIT section for the single-span scope; F-E closed (warping flag not a boundary condition of an I<sub>w</sub> = 0 box) |
| `18fc9d9` | Merge `section-library-masterseries` |
| `ce8dc0d` | Cold-formed RHS table wired: `rhsType` selector, CF strut curves and EC3 flat widths |
| (this commit) | docs: `VERIFICATION_REPORT.md` section 7, coverage-matrix N/A rows, README feature list and how-to-run, these release notes |

## Verification status at the head of the branch

- `node --test tests/*.test.cjs`: **141 tests pass** in 13 files (every test carries hand-derived expected values).
- `node tests/batch/run-batch.cjs`: **279 cases / 479 runs, PASS 349 / FAIL 82 / NOT VERIFIED 34 / ERROR 0**; the 14 invalid layouts throw their declared message; 0 cross-check mismatches against the runner's independent closed forms (i-Mmax / i-dmax / i-Rend 352/352, i-Mend 243/243, viii-Mend 268/268, iii-McrStd 327/327, ...); 0 trigger mismatches; end-restraint pair bounds 6/6; the eigen M<sub>cr</sub> within 0.99-1.02 of NCCI SN006a for every covered cantilever.
- `node tests/batch/hand-checks.cjs`: 59 comparisons over 24 cases, 57 within 0.01 %, the two above 1 % the expected SN003a k = 0.5 method difference.
- Eigen against standard: 200 paired runs, 155 identical verdicts, 45 different, every difference the standard route being stricter; no case the closed form passes that the eigenvalue fails or refuses.
- `pwsh ./build-single-html.ps1` reproduces `dist/beam-design-single.html` byte for byte; `tests/artifact.test.cjs` (parity) passes; the GitHub Actions workflow `.github/workflows/structural-regression.yml` runs the suite, the build and `git diff --exit-code -- dist/beam-design-single.html` on every push and pull request.
- The demo beam's figures are unchanged since the original audit (0.3035 / 0.9122 / 0.6099, web 0.5248).

## Open items carried into `main` (all printed where they apply)

- Strut effective lengths from the end fixities and the BS 5950 Table 13 / 14 mapping are engineering interpretations printed [verify]; the SN003a k = 0.5 / k<sub>w</sub> = 0.5 rows are not applied on the standard route (clamped / warping-fixed ends taken as forks, conservative by 30-190 %).
- Standard route: Serna's C<sub>1</sub> on a segment carrying an applied couple over-reads the eigenvalue (UB-57: 34 % on M<sub>cr</sub>, 2.5 % on M<sub>b,Rd</sub> through the k<sub>c</sub> floor, both PASS) - finding F-F of `docs/VERIFICATION_REPORT.md` 7.5; internal-hinge layouts are evaluated with fork ends over the whole member (conservative).
- Eigen route: the back-calculated C<sub>1</sub> gives k<sub>c</sub> ≈ 1 on a laterally clamped member, so a fixed-ended member can print a lower M<sub>b,Rd</sub> than its fork-ended twin (conservative).
- Still BLOCKING (NOT VERIFIED with the reason): Class 4 under the combined N + M stress gradient, Class-4 flanges, shear buckling of slender webs, torsion combined with N<sub>Ed</sub> or M<sub>z</sub>, cold-formed SHS torsion constants. Still MISSING: flange holes in bending, restraint height, Annex BB stable lengths, vibration.
- UI: the preset drop-list stays on Custom after a hand edit; `S.memberName` has no input; a channel or box cantilever has no closed-form M<sub>cr</sub> route (eigen only).

## How the Google Sites page picks up the change

The CED Google Sites page embeds `https://captain-802.github.io/beam-v03/` (AUDIT.md). That is the project Pages site of `Captain-802/beam-v03`: the URL has no branch or folder segment and `index.html` sits at the repository root, so Pages is serving the root folder of the branch chosen under repository Settings → Pages - `main` (confirm there before merging if in doubt). The embedded page is the modular `index.html` with its `css/` and `js/` folders; `dist/beam-design-single.html` is served beside it at `/beam-v03/dist/beam-design-single.html` for anyone who wants the one-file copy.

1. Open the pull request from `ms-brief-standard-mcr` into `main`; the Actions workflow must be green (tests, build, dist parity).
2. Merge (a merge commit or a squash, either is fine - the history above is recorded here and in `AUDIT.md`). Do not rebase or rewrite the branch history before merging: the commit hashes are referenced throughout the documentation.
3. GitHub Pages rebuilds `main` automatically after the merge (usually within a couple of minutes; the Pages deployment appears under the repository's Actions / Deployments). No build step is needed on the Pages side: the repository already contains the built files.
4. The Google Sites embed is an iframe of the Pages URL, so it shows the new page on the next load; if a browser shows the old panel layout (no *Geometry & end conditions* panel), hard-refresh the Sites page (Ctrl+F5) to drop the cached `index.html` and `js/` files. Nothing has to change in the Google Sites editor.
5. After the deployment, load the Pages URL once and confirm: the End conditions panel with the preset drop-list, the demo beam (UB 457×191×82, 8 m simply supported) printing 0.3035 / 0.9122 / 0.6099 in the verdict banner, the "Design Brief" above the "Detailed derivation", and no console errors.

If the Pages source is ever switched to a `gh-pages` branch or to `/docs`, the deployment shape stays the same (root `index.html` + `css/` + `js/`); only the branch or folder that Pages reads changes.
