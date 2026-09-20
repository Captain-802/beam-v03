// Beam in Wall - the page, the report prefix and the single-file build
// (wall.html, js/wall/03-wall-ui.js, js/wall/04-wall-report.js,
// js/wall/09-wall-startup.js, build-wall-single.ps1), 20 Sep 2026.
// The report prefix and the render hook run through the wall vm harness
// (no DOM: #report is a captured stub object); the page and the dist file
// are checked as text. Expected numbers are the hand-derived ones of
// tests/wall/geometry.test.cjs (DEMO wall: e = -145.6 / +55.65 mm, z_g = +230).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { app } = require('./harness-wall.cjs');
const root = path.resolve(__dirname, '..', '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8').replace(/\r\n/g, '\n');
const run = (c, x) => { const v = c.run(x); return (v && typeof v === 'object') ? JSON.parse(JSON.stringify(v)) : v; };   // vm-realm arrays -> plain
const scripts = html => [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
const INLINE_HANDLER = /\son(click|dblclick|change|input|load|unload|keydown|keyup|keypress|mouse\w+|focus|blur|submit|error)\s*=/i;

test('wall.html: beam-v03 modules in index.html order, then js/wall/01..04 and the wall startup', () => {
  const idx = scripts(read('index.html')), wall = scripts(read('wall.html'));
  const beamPart = idx.filter(f => f !== 'js/09-startup.js');
  assert.deepEqual(wall, [...beamPart, 'js/wall/01-wall-state.js', 'js/wall/02-wall-geometry.js', 'js/wall/03-wall-ui.js', 'js/wall/04-wall-report.js', 'js/wall/09-wall-startup.js']);
  assert.ok(!wall.includes('js/09-startup.js'), 'the wall startup replaces js/09-startup.js (the generic demo loads are never rendered)');
  wall.forEach(f => assert.ok(fs.existsSync(path.join(root, f)), f + ' exists'));
});

test('wall.html: every beam-v03 element id is kept (07-wiring binds unchanged), the generic Loads panel is hidden, the wall panels and ledgers exist', () => {
  const idx = read('index.html'), wall = read('wall.html');
  const ids = html => new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
  const idxIds = ids(idx), wallIds = ids(wall);
  [...idxIds].forEach(id => assert.ok(wallIds.has(id), 'beam-v03 id kept: ' + id));
  // the generic load editor: hidden (display:none through .wall-hidden) but present with its elements
  assert.match(wall, /<details open class="wall-hidden" id="loadsPanel">\s*<summary>Loads<\/summary>/);
  ['id="loadList"', 'data-add="point"', 'data-add="udl"', 'data-add="trap"', 'data-add="moment"', 'id="addSelfWeight"', 'id="eccOn"'].forEach(s => assert.ok(wall.includes(s), s));
  assert.match(read('css/beam-in-wall.css'), /\.wall-hidden\{display:none !important;\}/);
  assert.ok(wall.includes('<link rel="stylesheet" href="css/beam-design.css">') && wall.includes('<link rel="stylesheet" href="css/beam-in-wall.css">'));
  // the wall panels, in order: construction, placement, four ledgers, then the hidden Loads panel
  const order = ['id="wallPanel"', 'id="wallPlacePanel"', 'id="wallLedgerOuterPanel"', 'id="wallLedgerInnerPanel"', 'id="wallLedgerBeamPanel"', 'id="wallLedgerOtherPanel"', 'id="loadsPanel"', 'id="comboList"'];
  const pos = order.map(s => wall.indexOf(s));
  pos.forEach((p, i) => assert.ok(p > 0, order[i]));
  assert.deepEqual(pos, [...pos].sort((a, b) => a - b), 'panel order');
  ['wallMat1', 'wallT1', 'wallChased1', 'wallC', 'wallIns', 'wallMat2', 'wallT2', 'wallChased2', 'wallSolid', 'wallRecess', 'wallXc', 'wallXcRow', 'wallPfcWeb', 'wallPfcRow', 'wallSketch', 'wallDerived', 'wallLayoutHint',
   'wallLedgerOuter', 'wallLedgerInner', 'wallLedgerBeam', 'wallLedgerOther', 'wallInnerLedgerNote'].forEach(id => assert.ok(wallIds.has(id), 'wall id: ' + id));
  ['flush-inside', 'flush-outside', 'cavity-centre', 'wall-centre', 'custom'].forEach(m => assert.ok(wall.includes('data-wmode="' + m + '"'), m));
  ['outer', 'inner', 'beam', 'other'].forEach(lg => ['udl', 'pudl', 'point', 'moment'].forEach(t => assert.ok(wall.includes('data-wadd="' + lg + '" data-wtype="' + t + '"'), lg + '/' + t)));
  assert.ok(!INLINE_HANDLER.test(wall), 'no inline handlers in wall.html');
  assert.ok(!/https?:\/\/[^"']*\.(js|css)/i.test(wall), 'no CDN');
  // 21 Sep 2026 review: no stale beam-v03 wording, the default z_g row hidden (S.za held at 0 by syncWall), the recess step
  assert.ok(!wall.includes('in Loads') && !wall.includes('which then Solves'), 'stale index.html wording removed');
  assert.ok(wall.includes('<label id="zaRow" class="wall-hidden">'), 'Default z_g input hidden on the wall page');
  assert.ok(wall.includes('A leaf sitting on the outstand is entered in its leaf ledger') && wall.includes('follows <b>Channel web faces</b>'));
  assert.ok(wall.includes('<input id="wallRecess" type="number" step="0.5" min="10">'));
  assert.match(read('css/beam-in-wall.css'), /\.wall-row input\.wall-bad\{/);
});

test('the wall startup runs beam-v03 startup steps plus the wall ones; the wall modules never touch the DOM at load', () => {
  const st = read('js/wall/09-wall-startup.js').replace(/\/\*[\s\S]*?\*\//g, '');   // code only (the header comment names the same calls)
  ['syncInputs();', 'wire();', 'wireWall();', 'wallApplyDemoBeam();', 'fillWallPanels();', 'syncWall({immediate:true});', 'installDiagramHover();'].forEach(s => assert.ok(st.includes(s), s));
  assert.ok(st.indexOf('wire();') < st.indexOf('wireWall();') && st.indexOf('wireWall();') < st.indexOf('wallApplyDemoBeam();') && st.indexOf('wallApplyDemoBeam();') < st.indexOf('syncWall('), 'wall listeners registered after beam-v03 wire(); the demo span / plate written before the first sync');
  // the harness loads 01..04 with a document stub whose getElementById returns null: loading must not throw (done in app())
  const c = app();
  assert.equal(c.run('typeof reportPrefixHtml'), 'function');
  assert.equal(c.run('typeof syncWall'), 'function');
  assert.equal(c.run('typeof wallClampRowsToSpan'), 'function');
});

test('reportPrefixHtml: the DEMO wall derivation table (e = -145.6 outer, +55.65 inner, z_g = +230) with the sketch and the placement lines', () => {
  const c = app();
  c.reset({}); c.resetWall({});
  const out = c.run(`(()=>{ const a=analyse(); const ch=checks(a); return {html:reportPrefixHtml(a,ch,a.sec)}; })()`);
  const h = out.html;
  assert.ok(h.startsWith('<div class="wall-block"><div class="wall-h">Wall model and load derivation</div>'));
  assert.ok(h.includes('<svg class="wall-svg"') && h.includes('url(#wrp-brick)') && h.includes('url(#wrp-aac)'), 'sketch with brick / aerated hatches');
  assert.ok(h.includes('Wall W = 302.5 mm: outer leaf Brick 102.5 t1 = 102.5 mm [0, 102.5], cavity c = 100 mm [102.5, 202.5], inner leaf Aerated block 100 t2 = 100 mm [202.5, 302.5].'));
  assert.ok(h.includes('Centroid x_w,c = 196.85 mm; shear centre x_w,sc = 196.85 mm (= centroid); extreme fibres x_w = 101.2 / 292.5 mm; clearance to the external / internal face 101.2 / 10 mm (r = 10).'));
  const rows = [...h.matchAll(/<tr><td class="num">(O\d|I\d|B\d|X\d)<\/td>(.*?)<\/tr>/g)].map(m => [m[1], m[2].replace(/<[^>]+>/g, '|')]);
  assert.equal(rows.length, 3);
  assert.equal(rows[0][0], 'O1'); assert.ok(rows[0][1].includes('outer leaf masonry - UDL 6 kN/m 0-8 m [G]') && rows[0][1].includes('|Outer leaf|') && rows[0][1].includes('51.25 mm') && rows[0][1].includes('|196.85 mm|') && rows[0][1].includes('|-145.6 mm|') && rows[0][1].includes('+230 mm') && rows[0][1].includes('G UDL 6 kN/m 0-8 m e = -145.6 mm z_g = +230 mm'), rows[0][1]);
  assert.equal(rows[1][0], 'I1'); assert.ok(rows[1][1].includes('inner leaf + floor - UDL 19.7 kN/m 0-8 m [G]') && rows[1][1].includes('|Inner leaf|') && rows[1][1].includes('252.5 mm') && rows[1][1].includes('|+55.65 mm|') && rows[1][1].includes('G UDL 19.7 kN/m 0-8 m e = +55.65 mm z_g = +230 mm'), rows[1][1]);
  assert.equal(rows[2][0], 'I2'); assert.ok(rows[2][1].includes('floor imposed - UDL 19.8 kN/m 0-8 m [Q]') && rows[2][1].includes('|+55.65 mm|') && rows[2][1].includes('Q UDL 19.8 kN/m 0-8 m e = +55.65 mm z_g = +230 mm'), rows[2][1]);
  assert.ok(h.includes('S.eccOn = true (every load carries its own e and z<sub>g</sub>)'));
  assert.ok(h.includes('O1: load line at x_w = 51.25 mm lies outside the steel (101.2 to 292.5 mm)'), 'the load-line warning is in the block (plate off in the harness DEMO)');
  assert.ok(h.includes('fully restrained here: printed for traceability, not applied'), 'z_g applicability note on the restrained path');
  assert.ok(!INLINE_HANDLER.test(h), 'no inline handlers in the block');
  // a moment row prints no e / z_g; the beam ledger through the shear centre prints e = 0; a typed label is escaped
  c.resetWall({ ledgers: { outer: [], inner: [{ type: 'moment', M: 5, pos: 3, case: 'Q', label: 'end <b>moment</b>' }], beam: [{ type: 'point', P: 12, pos: 2, case: 'Q', height: 'sc', label: 'hanger' }], other: [] } });
  const h2 = c.run(`(()=>{ const a=analyse(); const ch=checks(a); return reportPrefixHtml(a,ch,a.sec); })()`);
  assert.ok(h2.includes('end &lt;b&gt;moment&lt;/b&gt; - M 5 kN.m @ 3 m [Q]') && !h2.includes('<b>moment</b>'), 'label escaped');
  assert.ok(/<td class="num">I1<\/td>(?:<td[^>]*>[^<]*<\/td>){2}<td class="num">-<\/td><td class="num">-<\/td><td class="num">-<\/td><td class="num">-<\/td>/.test(h2), 'moment: dashes for x_w / e / z_g');
  assert.ok(h2.includes('hanger - P 12 kN @ 2 m [Q]') && h2.includes('|B1|'.replace(/\|/g, '')) && h2.includes('Q P 12 kN @ 2 m e = 0 mm z_g = 0 mm'));
  assert.ok(h2.includes('S.eccOn = false (every load through the shear centre at z<sub>g</sub> = 0, S.za = 0 on this page: the plain beam-v03 path)'), 'shear-centre beam load + moment only: the plain beam-v03 path');
  // a channel: the self-weight eccentricity switches S.eccOn on and the block says so; the outline note is printed
  c.reset({ family: 'pfc', sectionKey: '300x100x46' });
  c.resetWall({ ledgers: { outer: [], inner: [], beam: [{ type: 'point', P: 12, pos: 2, case: 'Q', height: 'sc' }], other: [] } });
  const h3 = c.run(`(()=>{ const a=analyse(); const ch=checks(a); return reportPrefixHtml(a,ch,a.sec); })()`);
  assert.ok(h3.includes('S.eccOn = true (every load carries its own e and z<sub>g</sub>; switched on by the eccentric self-weight of the channel, e<sub>sw</sub> = +62.7 mm)'), h3.slice(h3.indexOf('beam-v03 inputs written'), h3.indexOf('beam-v03 inputs written') + 260));
  assert.ok(h3.includes('Channel outline: web back at c_y = 30.5 mm from the centroid'));
  // row errors are printed in red in the block (and block the report through the validateInputs wrapper on the page)
  c.reset({}); c.resetWall({ ledgers: { outer: [], inner: [{ type: 'pudl', w: 5, x1: 9, x2: 9.5 }], beam: [], other: [] } });
  const h4 = c.run(`reportPrefixHtml(null, null, activeSection())`);
  assert.ok(h4.includes('<div class="wall-errs"><div>I1 (partial UDL): x1 = 9 m, x2 = 9.5 m must satisfy 0 &lt;= x1 &lt; x2 &lt;= L = 8 m.</div></div>'), h4.slice(h4.indexOf('wall-errs') - 20, h4.indexOf('wall-errs') + 200));
});

test('render() hook (js/06-render.js): the wall block sits between the verdict banner and the brief on the EC3 path and before the report head on the BS 5950 path; the brief load list carries the ledger labels', () => {
  const c = app();
  // a captured #report (the harness document stub returns null otherwise); sectionViewBindZoom needs querySelectorAll
  c.run('var __rep={innerHTML:"", querySelectorAll:()=>[]}; document.getElementById=id=> id==="report"? __rep : null;');
  c.reset({}); c.resetWall({});
  // what syncWall() does on the page, without the DOM: S.loads from the ledgers, labelled with their origin
  c.run('(()=>{ const res=wallToLoads(WALL, activeSection(), S); S.loads=wallDecorateLoads(res.loads); S.eccOn=res.eccOn; S.pfcMirror=res.pfcMirror; })()');
  assert.deepEqual(run(c, 'S.loads.map(l=>l.label)'), ['Outer leaf: outer leaf masonry, x_w = 51.25 mm', 'Inner leaf: inner leaf + floor, x_w = 252.5 mm', 'Inner leaf: floor imposed, x_w = 252.5 mm']);
  c.run('render()');
  const html = c.run('__rep.innerHTML');
  const iBanner = html.indexOf('<div class="banner'), iWall = html.indexOf('<div class="wall-block">'), iBrief = html.indexOf('<div class="ms-brief');
  assert.ok(iBanner >= 0 && iWall > iBanner && iBrief > iWall, 'banner < wall block < brief: ' + [iBanner, iWall, iBrief]);
  assert.ok(html.includes('G UDL 6.000 0&ndash;8 m e = -146 mm ( kN/m ) &mdash; Outer leaf: outer leaf masonry, x_w = 51.25 mm'), 'brief load line with the label and the x_w the e came from');
  assert.ok(html.includes('Q UDL 19.800 0&ndash;8 m e = 56 mm ( kN/m ) &mdash; Inner leaf: floor imposed, x_w = 252.5 mm'));
  // a moment row carries no x_w in its label
  c.run('(()=>{ WALL.ledgers.inner.push({type:"moment", M:3, pos:2, case:"G", label:"end M"}); const res=wallToLoads(WALL, activeSection(), S); S.loads=wallDecorateLoads(res.loads); WALL.ledgers.inner.pop(); })()');
  assert.equal(run(c, 'S.loads[3].label'), 'Inner leaf: end M');
  c.run('(()=>{ const res=wallToLoads(WALL, activeSection(), S); S.loads=wallDecorateLoads(res.loads); })()');
  // BS 5950 path: the block precedes the report head
  c.run('setDesignCode("BS5950"); render()');
  const bs = c.run('__rep.innerHTML');
  const jWall = bs.indexOf('<div class="wall-block">'), jHead = bs.indexOf('<div class="report-head">');
  assert.ok(jWall > 0 && jHead > jWall, 'BS 5950: wall block before the report head');
  // index.html (no reportPrefixHtml): the hook contributes nothing - simulated by removing the function
  c.run('setDesignCode("EC3"); const __keep=reportPrefixHtml; reportPrefixHtml=undefined; render(); __rep.plain=__rep.innerHTML; reportPrefixHtml=__keep;');
  assert.ok(!c.run('__rep.plain').includes('wall-block'));
});

test('wallClampRowsToSpan follows beam-v03 clampLoadsToSpan: full-span rows follow L, partial rows at the old end follow, positions beyond L are clamped, strips slide keeping their length', () => {
  const c = app();
  c.resetWall({ ledgers: {
    outer: [{ type: 'udl', w: 5, x1: 0, x2: 8 }, { type: 'pudl', w: 5, x1: 2, x2: 8 }, { type: 'pudl', w: 5, x1: 6, x2: 7 }],
    inner: [{ type: 'point', P: 5, pos: 7 }, { type: 'moment', M: 5, pos: 4 }, { type: 'trap', w1: 0, w2: 5, x1: 1, x2: 3 }],
    beam: [], other: [] } });
  const w = JSON.parse(JSON.stringify(c.run('wallClampRowsToSpan(WALL, 8, 5)')));
  assert.deepEqual(w.ledgers.outer.map(r => [r.x1, r.x2]), [[0, 5], [2, 5], [4, 5]], 'full-span 0-5; 2-8 at the old end -> 2-5; 6-7 wholly beyond -> slid to 4-5 (1 m kept)');
  assert.deepEqual(w.ledgers.inner.map(r => r.type === 'trap' ? [r.x1, r.x2] : r.pos), [5, 4, [1, 3]], 'point 7 -> 5, moment 4 kept, trap 1-3 untouched');
  // longer span: the full-span row and the row ending at the old end follow; nothing else moves
  const w2 = JSON.parse(JSON.stringify(c.run('wallClampRowsToSpan(WALL, 5, 9)')));
  assert.deepEqual(w2.ledgers.outer.map(r => [r.x1, r.x2]), [[0, 9], [2, 9], [4, 9]]);
  assert.deepEqual(w2.ledgers.inner.map(r => r.type === 'trap' ? [r.x1, r.x2] : r.pos), [5, 4, [1, 3]]);
  // an invalid span leaves the rows alone
  const w3 = JSON.parse(JSON.stringify(c.run('wallClampRowsToSpan(WALL, 9, NaN)')));
  assert.deepEqual(w3.ledgers.outer.map(r => [r.x1, r.x2]), [[0, 9], [2, 9], [4, 9]]);
  // the generated beam-v03 loads of the clamped rows lie inside the span
  c.reset({ L: 5 }); c.run('wallClampRowsToSpan(WALL, 9, 5)');
  const R = JSON.parse(JSON.stringify(c.run('wallToLoads(WALL, activeSection(), S)')));
  R.loads.forEach(ld => { if (ld.type === 'udl' || ld.type === 'trap') assert.ok(ld.x1 >= 0 && ld.x2 <= 5 && ld.x2 > ld.x1, JSON.stringify(ld)); else assert.ok(ld.pos >= 0 && ld.pos <= 5); });
});

test('wallSectionSvg: one load line per (x_w, z_g) group tagged O/I/B/X, the recess dimension, hatches by material, compact variant for the sidebar', () => {
  const c = app();
  c.reset({}); c.resetWall({});
  const svg = c.run('(()=>{ const res=wallToLoads(WALL, activeSection(), S); return wallSectionSvg(res.placement, res, {compact:false, idPrefix:"t"}); })()');
  assert.ok(svg.startsWith('<svg class="wall-svg" viewBox="0 0 560 '));
  assert.ok(svg.includes('>O1</text>') && svg.includes('>I1+I2</text>'), 'the two inner loads share x_w = 252.5 / z_g = +230 and one line');
  assert.ok(svg.includes('r = 10</text>') && svg.includes('>101.2</text>') && svg.includes('W = 302.5</text>'), 'recess, outer clearance and W dimensions');
  assert.ok(svg.includes('url(#t-brick)') && svg.includes('url(#t-aac)') && svg.includes('Brick 102.5</text>') && svg.includes('Aerated block 100</text>'));
  assert.ok(svg.includes('OUTSIDE</text>') && svg.includes('INSIDE</text>'));
  const compact = c.run('(()=>{ const res=wallToLoads(WALL, activeSection(), S); return wallSectionSvg(res.placement, res, {compact:true, idPrefix:"k"}); })()');
  assert.ok(compact.length < svg.length && !compact.includes('Brick 102.5</text>') && compact.includes('>O1</text>'), 'compact: no material labels, same load tags');
  assert.ok(!INLINE_HANDLER.test(svg));
  // a mirrored channel with a plate: the shear centre is marked apart from the centroid and the plate is drawn
  c.reset({ family: 'pfc', sectionKey: '300x100x46', plate: { on: true, side: 'bottom', t: 10, outL: 0, outR: 120 } });
  c.resetWall({ placement: 'cavity-centre', c: 180, pfcWebFaces: 'inside', insulation: '50 PIR' });
  const pfc = c.run('(()=>{ const res=wallToLoads(WALL, activeSection(), S); return wallSectionSvg(res.placement, res, {idPrefix:"p"}); })()');
  assert.ok(pfc.includes('>SC</text>') && pfc.includes('fill="#6b7280" stroke="#111"') && pfc.includes('cavity - 50 PIR</text>') && pfc.includes('url(#p-ins)'));
});

test('dist/beam-in-wall-single.html: built from wall.html with both stylesheets and every wall.html script inlined in order, no external refs, no inline handlers', () => {
  const distPath = path.join(root, 'dist', 'beam-in-wall-single.html');
  assert.ok(fs.existsSync(distPath), 'run pwsh -File build-wall-single.ps1');
  const dist = read('dist/beam-in-wall-single.html'), wall = read('wall.html');
  const bundle = scripts(wall).map(f => read(f).trim()).join('\n\n');
  assert.ok(dist.includes('<script>\n' + bundle + '\n</script>'), 'Rebuild dist with build-wall-single.ps1');
  assert.ok(dist.includes('<style>\n' + read('css/beam-design.css').trim() + '\n</style>'));
  assert.ok(dist.includes('<style>\n' + read('css/beam-in-wall.css').trim() + '\n</style>'));
  assert.ok(!dist.includes('<script src=') && !dist.includes('<link rel="stylesheet"'));
  assert.ok(!INLINE_HANDLER.test(dist), 'no inline handlers');
  assert.ok(!/<script[^>]*src="https?:/i.test(dist) && !/https?:\/\/[^"'\s]*\.(js|css)\b/i.test(dist), 'no CDN');
  assert.ok(dist.includes('id="wallLedgerOuter"') && dist.includes('class="wall-hidden" id="loadsPanel"'));
  // the beam-v03 dist is untouched by this page apart from the hook lines (tests/artifact.test.cjs checks its parity)
  const beamDist = read('dist/beam-design-single.html');
  assert.ok(beamDist.includes("const prefix=(typeof reportPrefixHtml==='function')? reportPrefixHtml(a,c,sec) : '';") && !beamDist.includes('wall-block'));
});
