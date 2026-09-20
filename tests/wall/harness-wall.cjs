// Beam-in-Wall vm harness (20 Sep 2026): tests/harness.cjs's approach - the
// same beam-v03 module list (unchanged files) plus js/05-section-view.js
// (sectionViewGeometry / sectionViewShearCentre, which the wall placement
// relies on; it binds a document keydown listener at load, hence the stub)
// and the wall modules js/wall/01-wall-state.js, 02-wall-geometry.js and,
// when present, 03-wall-ui.js (pure helpers only) and 04-wall-report.js
// (pure report strings). No DOM: document
// stubs return null / do nothing, so everything under test must be pure.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function app(root = path.resolve(__dirname, '..', '..')) {
  const ctx = vm.createContext({ console, document: { getElementById: () => null, addEventListener: () => {}, querySelectorAll: () => [] } });
  ctx.window = ctx;
  const files = [
    '01-computation-engine.js', ...['pfc','shs','rhs','ub','uc'].map(s => `sections/${s}-section-data.js`),
    '02-section-data.js', '03-state-ui.js', '04-checks.js',
    'checks/bs5950-checks.js', 'checks/eurocode-checks.js', 'checks/torsion-fe.js', '05-diagrams.js', '05-section-view.js', '06-render.js', '06-brief-masterseries.js', '08-mcr-eigen-patch.js',
    'wall/01-wall-state.js', 'wall/02-wall-geometry.js'
  ];
  // 03-wall-ui.js defines only functions at load (no DOM touched until wireWall()); its pure helpers
  // (wallClampRowsToSpan, wallDecorateLoads) and 04-wall-report.js (reportPrefixHtml, the sketch) load when present
  ['wall/03-wall-ui.js', 'wall/04-wall-report.js'].forEach(f => { if (fs.existsSync(path.join(root, 'js', f))) files.push(f); });
  files.forEach(f => vm.runInContext(fs.readFileSync(path.join(root, 'js', f), 'utf8'), ctx, { filename: f }));
  ctx.run = code => vm.runInContext(code, ctx);
  ctx.reset = overrides => {   // beam-v03 state S = DEMO + overrides (deep copies, as tests/harness.cjs)
    ctx.overrides = overrides || {};
    ctx.run('S = Object.assign(JSON.parse(JSON.stringify(DEMO)), JSON.parse(JSON.stringify(overrides)))');
  };
  ctx.resetWall = overrides => {   // wall state WALL = WALL_DEMO + overrides (ledgers replaced whole when given)
    ctx.wallOverrides = overrides || {};
    ctx.run('WALL = Object.assign(JSON.parse(JSON.stringify(WALL_DEMO)), JSON.parse(JSON.stringify(wallOverrides)))');
  };
  ctx.ends = (preset, overrides) => {
    ctx.endsArgs = { preset, overrides: overrides || {} };
    return JSON.parse(JSON.stringify(ctx.run('endsPreset(endsArgs.preset, endsArgs.overrides)')));
  };
  return ctx;
}
module.exports = { app };
