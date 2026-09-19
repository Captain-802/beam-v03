# Beam Design Modular Source

The September 2026 structural audit, corrections, reference basis and remaining limitations are documented in [AUDIT.md](AUDIT.md).

Run the regression suite with `node --test tests/*.test.cjs` (Node 22+). After editing source, run `./build-single-html.ps1` in PowerShell to regenerate `dist/beam-design-single.html`, then rerun the tests. The single-file distribution must match the modular source.

**Elastic critical moment M<sub>cr</sub> (EC3, not fully restrained):** the `M<sub>cr</sub> method` select under *Axial & lateral-torsional buckling* sets `S.mcrMethod` to `eigen` (default) or `standard`. `eigen` solves M<sub>cr</sub> by the finite-element eigenvalue method in `js/08-mcr-eigen-patch.js` for the actual moment diagram, per-load heights z<sub>g</sub>, lateral restraints, support conditions and internal hinges (span by span for continuous beams). `standard` delegates to the closed-form implementation `checksEC3UnrestrainedSCI()` in `js/checks/eurocode-checks.js` (kept alive by the patch as `window.checksEC3UnrestrainedStandard`): C<sub>1</sub> from the NCCI SN003a tables (simply supported UDL / central point load), the SCI end-moment curve for a linear gradient or the Serna quarter-point expression for a general diagram, M<sub>cr</sub> = C<sub>1</sub>(&pi;&sup2;EI<sub>z</sub>/L<sub>E</sub>&sup2;)&radic;[I<sub>w</sub>/I<sub>z</sub> + L<sub>E</sub>&sup2;GI<sub>t</sub>/(&pi;&sup2;EI<sub>z</sub>)] with G = 81000 N/mm&sup2; and the C<sub>2</sub>z<sub>g</sub> term where published, NCCI SN006a for cantilevers and the P385/P362 channel chain, with L<sub>E</sub> = L<sub>E</sub>-factor &times; L over the whole member - the route MasterSeries-type software prints; the eigensolver is not run. Both routes expose `ltb.McrStandard`, `ltb.McrEigen` (null in standard mode) and the MasterSeries-style C<sub>1</sub> inputs `ltb.c1in = {M1, M2, Mo, psi, mu}` (segment end moments, M<sub>2</sub> the larger; mid-segment moment above the chord; &psi; = M<sub>1</sub>/M<sub>2</sub>; &mu; = M<sub>o</sub>/M<sub>2</sub> capped at 300), and the report names the method in its heading, prints the `C1 = fn(M1, M2, Mo, psi, mu)` line in standard mode and the ratio M<sub>cr,eigen</sub>/M<sub>cr,standard</sub> in eigen mode.

This folder is a behavior-preserving split of `9 JULY BEAM DESIGN.html`.

Edit these smaller files instead of uploading the full HTML:

- `css/beam-design.css` - all visual styles.
- `js/01-computation-engine.js` - stiffness solver and old helper formulas.
- `js/sections/pfc-section-data.js` - PFC channel Blue Book table and P385 torsion properties.
- `js/sections/shs-section-data.js` - SHS Blue Book tables and P385 torsion properties.
- `js/sections/rhs-section-data.js` - RHS Blue Book table and P385 torsion properties.
- `js/sections/ub-section-data.js` - UB Blue Book table and P385 torsion properties.
- `js/sections/uc-section-data.js` - UC Blue Book table and P385 torsion properties.
- `js/02-section-data.js` - shared section helpers, active section normalisation, grades, self-weight, P385 solver helpers.
- `js/03-state-ui.js` - app state, support/load/combo UI builders, input syncing.
- `js/04-checks.js` - shared analysis orchestration and standards dispatcher.
- `js/checks/bs5950-checks.js` - BS 5950 design check engine.
- `js/checks/eurocode-checks.js` - Eurocode 3 design check engine.
- `js/05-diagrams.js` - inline SVG diagram helpers.
- `js/05-section-view.js` - cross-section load-line/eccentricity SVG engine.
- `js/06-render.js` - report rendering.
- `js/07-wiring.js` - event listeners and recompute wiring.
- `js/08-mcr-eigen-patch.js` - FE Mcr eigensolver patch; keeps the closed-form route as `checksEC3UnrestrainedStandard` and dispatches on `S.mcrMethod`.
- `js/09-startup.js` - startup calls: syncInputs(), wire(), render().
