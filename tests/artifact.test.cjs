const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const read = f => fs.readFileSync(path.join(root,f),'utf8').replace(/\r\n/g,'\n');
test('single-file distribution contains the exact current source and CSS',()=>{
  const index=read('index.html'),dist=read('dist/beam-design-single.html');
  const sources=[...index.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]);
  const bundle=sources.map(f=>read(f).trim()).join('\n\n');
  assert.ok(dist.includes('<script>\n'+bundle+'\n</script>'),'Rebuild dist with build-single-html.ps1');
  assert.ok(dist.includes('<style>\n'+read('css/beam-design.css').trim()+'\n</style>'));
  assert.ok(!dist.includes('<script src="js/'));
});
