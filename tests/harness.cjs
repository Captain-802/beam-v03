const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function app(root = path.resolve(__dirname, '..')) {
  const ctx = vm.createContext({ console, document: { getElementById: () => null } });
  ctx.window = ctx;
  const files = [
    '01-computation-engine.js', ...['pfc','shs','rhs','ub','uc'].map(s => `sections/${s}-section-data.js`),
    '02-section-data.js', '03-state-ui.js', '04-checks.js',
    'checks/bs5950-checks.js', 'checks/eurocode-checks.js', 'checks/torsion-fe.js', '05-diagrams.js', '06-render.js', '06-brief-masterseries.js', '08-mcr-eigen-patch.js'
  ];
  files.forEach(f => vm.runInContext(fs.readFileSync(path.join(root, 'js', f), 'utf8'), ctx, { filename: f }));
  ctx.run = code => vm.runInContext(code, ctx);
  ctx.reset = overrides => {
    ctx.overrides = overrides || {};
    ctx.run('S = Object.assign(JSON.parse(JSON.stringify(DEMO)), overrides)');
  };
  return ctx;
}
module.exports = { app };
