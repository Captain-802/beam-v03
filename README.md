# Beam Design Modular Source

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
- `js/08-mcr-eigen-patch.js` - FE Mcr eigensolver patch.
- `js/09-startup.js` - startup calls: syncInputs(), wire(), render().
