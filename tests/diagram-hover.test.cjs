// Diagram hover readouts (js/05-diagrams.js, 20 Sep 2026): plot() carries the
// sample arrays and the data->viewBox mapping as data-* attributes plus a
// hidden <g class="hover">; installDiagramHover() drives them through one
// delegated listener set. The vm harness has no DOM, so the SVG string, the
// pure helpers (diagHoverData / diagHoverReadout) and the listener plumbing
// are exercised through fake root / svg objects; the browser path (screen
// CTM, real events) is covered by the ratio fallback the fakes take.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { app } = require('./harness.cjs');
const c = app();
c.reset({});
const run = x => { const v = c.run(x); return (v && typeof v === 'object') ? JSON.parse(JSON.stringify(v)) : v; };
const a = run('a = analyse(); a');   // demo beam, in-context `a` for the plot calls below (a.L is mm; S.L is the span in m)
const Lm = run('S.L');
const svgV = c.run(`plot(a.diag.xs,a.diag.V,{color:'#1d4ed8',fill:'#bcd0f7',unit:'kN',fmt:v=>f1(v,2)})`);
const svgM = c.run(`plot(a.diag.xs,a.diag.M,{color:'#b91c1c',fill:'#f3c2c2',unit:'kN m',flip:true,fmt:v=>f1(v,2)})`);
const svgD = c.run(`plot(a.diag.dx,a.diag.dw,{color:'#166534',fill:'#bfe3cb',unit:'mm',fmt:v=>f1(v,2)})`);
const svgT = c.run(`plot(a.diag.xs,a.diag.M,{color:'#7a4',fill:'#dcebc4',unit:'kN&middot;m',name:'T',caption:'Torsion',dp:3,fmt:v=>f1(v,2)})`);
const attrsOf = svg => { const o = {}; const tag = svg.slice(0, svg.indexOf('>') + 1); tag.replace(/([a-zA-Z-]+)="([^"]*)"/g, (m, k, v) => { o[k] = v; }); return o; };
const sig4 = v => +Number(v).toPrecision(7);   // 20 Sep 2026 review: samples stored at 7 s.f. (was 4: the 2-dp readout disagreed with the peak label above ~1000 kN.m); the name is kept for the diff

test('plot() keeps its SVG output and adds the hover data attributes and the hidden hover group', () => {
  const at = attrsOf(svgV);
  assert.equal(at.class, 'diag diag-hover');
  assert.equal(at.viewBox, '0 0 540 150');
  // arrays: same length as the samples, 7 significant figures, x in m
  const xs = JSON.parse(at['data-xs']), ys = JSON.parse(at['data-ys']);
  assert.equal(xs.length, a.diag.xs.length); assert.equal(ys.length, a.diag.V.length);
  assert.deepEqual(xs.slice(0, 4), a.diag.xs.slice(0, 4).map(sig4));
  assert.deepEqual(ys.slice(-3), a.diag.V.slice(-3).map(sig4));
  assert.ok(xs.every(x => /^-?\d+(\.\d+)?(e-?\d+)?$/.test(String(x)) && String(sig4(x)) === String(x)), 'xs stored at 7 s.f.');
  assert.equal(xs[xs.length - 1], sig4(Lm));
  // the mapping numbers, straight from plot()'s own constants
  assert.deepEqual([at['data-padl'], at['data-padr'], at['data-padt'], at['data-padb']], ['46', '16', '16', '24']);
  assert.equal(at['data-xmax'], String(sig4(Lm)));
  assert.equal(at['data-ymax'], String(sig4(Math.max(...a.diag.V.map(Math.abs)))));
  assert.equal(at['data-flip'], '0'); assert.equal(at['data-midy'], '71'); assert.equal(at['data-amp'], '51');
  assert.deepEqual([at['data-unit'], at['data-fmt-dp'], at['data-xlabel'], at['data-name'], at['data-caption']], ['kN', '2', 'x', 'V', '']);
  // the hidden group: guide line, marker, haloed readout, painted last
  const g = svgV.slice(svgV.indexOf('<g class="hover"'));
  assert.ok(/^<g class="hover" style="display:none" pointer-events="none">/.test(g), 'hidden group');
  assert.ok(/<line class="hover-x"/.test(g) && /<circle class="hover-pt"[^>]*fill="#1d4ed8"/.test(g), 'guide line + marker in the plot colour');
  assert.ok(/<text class="hover-txt"[^>]*paint-order="stroke"[^>]*><\/text>/.test(g) && /stroke="#fffdf8"/.test(g), 'readout with the paper halo');
  assert.ok(g.endsWith('</g></svg>'));
  // the existing drawing is untouched: axis, fill, curve, peak label still there, before the group
  const body = svgV.slice(0, svgV.indexOf('<g class="hover"'));
  assert.ok(/<path d="M [\d.]+ [\d.]+ L/.test(body) && /font-weight="700" fill="#1d4ed8" text-anchor="middle">[-\d.]+ kN<\/text>/.test(body));
});

test('names default from the unit (kN -> V, mm -> delta, flipped moment -> M), callers may pass name / caption / dp', () => {
  assert.equal(attrsOf(svgM)['data-name'], 'M'); assert.equal(attrsOf(svgM)['data-flip'], '1');
  assert.equal(attrsOf(svgD)['data-name'], 'δ');
  const t = attrsOf(svgT);
  assert.deepEqual([t['data-name'], t['data-caption'], t['data-fmt-dp'], t['data-unit'], t['data-flip']], ['T', 'Torsion', '3', 'kN&middot;m', '0']);
  // an un-flipped moment plot without a name stays blank rather than guessing (torsion vs bending)
  const anon = c.run(`plot(a.diag.xs,a.diag.M,{color:'#7a4',fill:'#dcebc4',unit:'kN&middot;m',fmt:v=>f1(v,2)})`);
  assert.equal(attrsOf(anon)['data-name'], '');
});

test('no inline handlers or javascript: URLs anywhere in the diagram strings; beamDiagram() still renders and is not a hover diagram', () => {
  const bd = c.run('beamDiagram(a)');
  for (const s of [svgV, svgM, svgD, svgT, bd]) {
    assert.ok(!/\son[a-z]+\s*=/i.test(s), 'no on*= handler');
    assert.ok(!/javascript:/i.test(s), 'no javascript: URL');
  }
  assert.ok(bd.startsWith('<svg class="diag" viewBox="0 0 540 '), 'loading sketch unchanged');
  assert.ok(!/diag-hover|class="hover"/.test(bd), 'loading sketch has no hover group');
  assert.ok(/L = /.test(bd));
});

// a fake svg element: getAttribute from the string, the ratio fallback for the
// pointer (no getScreenCTM), a hover group whose children record setAttribute
function fakeSvg(svg, rect) {
  const at = attrsOf(svg);
  const mk = () => ({ attrs: {}, textContent: '', setAttribute(k, v) { this.attrs[k] = String(v); } });
  const grp = { style: { display: 'none' }, parts: { '.hover-x': mk(), '.hover-pt': mk(), '.hover-txt': mk() }, querySelector(q) { return this.parts[q] || null; } };
  const el = { grp, getAttribute: k => (k in at ? at[k] : null), getBoundingClientRect: () => rect, querySelector: q => (q === '.hover' ? grp : null), closest(sel) { return sel === 'svg.diag-hover' ? el : null; } };
  return el;
}

test('diagHoverReadout(): exact sample values at the samples, linear in between, marker on the curve, anchor flips at the right edge, no "-0.00"', () => {
  const svgEl = fakeSvg(svgV, { left: 0, top: 0, width: 540, height: 150 });
  c.fakeSvg = svgEl;
  const d = run('diagHoverData(fakeSvg)');
  assert.equal(d.xs.length, a.diag.xs.length); assert.equal(d.W, 540); assert.equal(d.H, 150); assert.equal(d.name, 'V');
  const X = x => 46 + x / d.xmax * (540 - 46 - 16);
  // at a sample: the stored (7 s.f.) value, marker exactly at Y(v)
  const k = 300;
  c.vx = X(d.xs[k]);
  const r = run('diagHoverReadout(diagHoverData(fakeSvg), vx)');
  assert.ok(Math.abs(r.y - d.ys[k]) < 1e-9 * Math.max(1, Math.abs(d.ys[k])), 'sample value');
  assert.ok(Math.abs(r.cy - (71 - d.ys[k] / d.ymax * 51)) < 1e-9, 'marker on the curve');
  assert.ok(Math.abs(r.cx - c.vx) < 1e-9);
  assert.equal(r.anchor, 'start'); assert.equal(r.tx, r.cx + 8);
  assert.equal(r.text, `x = ${d.xs[k].toFixed(2)} m V = ${d.ys[k].toFixed(2)} kN`);
  // 20 Sep 2026 review: at the peak sample the readout prints exactly the peak label of the drawing (opt.fmt(peak) = f1(peak, 2)),
  // for a large moment too (914 x 305 x 289, 12 m, 60 G + 40 Q kN/m: M_max = 2606.92 kN.m, stored at 4 s.f. it read 2607.00)
  const big = (() => { c.reset({ ubKey: '914 x 305 x 289', L: 12, ends: c.ends('ss'), loads: [{ type: 'udl', x1: 0, x2: 12, w: 60, case: 'G' }, { type: 'udl', x1: 0, x2: 12, w: 40, case: 'Q' }] });
    const svg = c.run(`(()=>{ const ab=analyse(); return plot(ab.diag.xs,ab.diag.M,{color:'#b91c1c',fill:'#f3c2c2',unit:'kN.m',name:'M',flip:true,fmt:v=>f1(v,2)}); })()`);
    c.reset({}); c.run('a = analyse()'); return svg; })();
  const lbl = big.match(/font-weight="700" fill="#b91c1c" text-anchor="middle">([-\d.]+) kN\.m<\/text>/)[1];
  c.fakeSvg = fakeSvg(big, { left: 0, top: 0, width: 540, height: 150 });
  const dbig = run('diagHoverData(fakeSvg)');
  let kp = 0; dbig.ys.forEach((v, i) => { if (Math.abs(v) > Math.abs(dbig.ys[kp])) kp = i; });
  c.vx = 46 + dbig.xs[kp] / dbig.xmax * (540 - 62);
  const rp = run('diagHoverReadout(diagHoverData(fakeSvg), vx)');
  assert.ok(+lbl > 2000 && /^\d+\.\d\d$/.test(lbl), 'large peak label ' + lbl);
  assert.equal(rp.text, `x = ${dbig.xs[kp].toFixed(2)} m M = ${lbl} kN.m`, 'readout at the peak = the peak label');
  c.fakeSvg = svgEl;
  // halfway between two samples: the mean of their values
  c.vx = X((d.xs[k] + d.xs[k + 1]) / 2);
  const rm = run('diagHoverReadout(diagHoverData(fakeSvg), vx)');
  assert.ok(Math.abs(rm.y - (d.ys[k] + d.ys[k + 1]) / 2) < 1e-9, 'linear interpolation');
  // beyond the ends: clamped to the first / last sample; near the right edge the anchor flips
  c.vx = -50; assert.equal(run('diagHoverReadout(diagHoverData(fakeSvg), vx).x'), d.xs[0]);
  c.vx = 9999;
  const re = run('diagHoverReadout(diagHoverData(fakeSvg), vx)');
  assert.equal(re.x, d.xs[d.xs.length - 1]); assert.equal(re.anchor, 'end'); assert.equal(re.tx, re.cx - 8);
  assert.ok(re.ty === 71 - 12 || re.ty === 71 + 20, 'readout baseline on the empty side of the axis, inside the viewBox');
  // the flipped moment plot: sagging drawn below the axis, the readout sits in the empty band above the axis (never on the peak label below)
  c.fakeSvg = fakeSvg(svgM, { left: 0, top: 0, width: 540, height: 150 });
  const dm = run('diagHoverData(fakeSvg)');
  c.vx = X(dm.xmax / 2);
  const rM = run('diagHoverReadout(diagHoverData(fakeSvg), vx)');
  assert.ok(rM.y > 0 && rM.cy > 71, 'sagging moment plotted under the axis');
  assert.ok(/^x = \d+\.\d\d m M = \d+\.\d\d kN m$/.test(rM.text), rM.text);
  assert.equal(rM.ty, 71 - 12);
  // a point above the axis puts the readout below it
  c.fakeSvg = fakeSvg(svgV, { left: 0, top: 0, width: 540, height: 150 }); c.vx = X(0.1);
  const rV = run('diagHoverReadout(diagHoverData(fakeSvg), vx)');
  assert.ok(rV.cy < 71 && rV.ty === 71 + 20, 'shear near the left support: curve above the axis, readout below');
  // a flat zero diagram never prints "-0.00"; a caption prefixes the readout; dp is honoured
  c.fakeSvg = fakeSvg(c.run(`plot([0,1,2],[0,-1e-13,0],{color:'#000',fill:'#eee',unit:'kN',caption:'Axial',dp:3,fmt:v=>f1(v,2)})`), { left: 0, top: 0, width: 540, height: 150 });
  c.vx = 46 + 0.5 / 2 * (540 - 62);   // x = 0.5 m of a 2 m plot
  const r0 = run('diagHoverReadout(diagHoverData(fakeSvg), vx)');
  assert.equal(r0.text, 'Axial: x = 0.50 m V = 0.000 kN');
});

test('installDiagramHover(): returns early on the harness stub document, is idempotent per root, and drives the hover group through delegated listeners', () => {
  assert.equal(run('installDiagramHover()'), false, 'stub document has no addEventListener');
  assert.equal(run('installDiagramHover(null)'), false);
  const calls = [], handlers = {};
  const root = { addEventListener(type, fn, opts) { calls.push([type, opts]); handlers[type] = fn; } };
  c.fakeRoot = root;
  assert.equal(run('installDiagramHover(fakeRoot)'), true);
  assert.equal(run('installDiagramHover(fakeRoot)'), false, 'second install on the same root is a no-op');
  assert.deepEqual(calls.map(x => x[0]), ['mousemove', 'mouseleave', 'touchmove', 'touchend', 'touchcancel']);
  assert.equal(calls[1][1].capture, true, 'mouseleave delegated through the capture phase');
  assert.ok(calls.every(x => x[1].passive === true));
  // a pointer over the shear diagram (ratio fallback: the svg is laid out at 2x) shows the group on the curve
  const svgEl = fakeSvg(svgV, { left: 100, top: 50, width: 1080, height: 300 });
  c.fakeRootSvg = svgEl;
  const dd = run('diagHoverData(fakeRootSvg)');
  const midX = 100 + (46 + dd.xmax / 2 / dd.xmax * (540 - 62)) * 2;   // client x of midspan
  handlers.mousemove({ target: svgEl, clientX: midX, clientY: 200 });
  assert.equal(svgEl.grp.style.display, '', 'group shown');
  const txt = svgEl.grp.parts['.hover-txt'], pt = svgEl.grp.parts['.hover-pt'], ln = svgEl.grp.parts['.hover-x'];
  assert.ok(new RegExp(`^x = ${(dd.xmax / 2).toFixed(2)} m V = -?\\d+\\.\\d\\d kN$`).test(txt.textContent), txt.textContent);
  assert.ok(Math.abs(+pt.attrs.cx - 285) < 1e-6 && ln.attrs.x1 === ln.attrs.x2 && ln.attrs.x1 === pt.attrs.cx, 'guide and marker at midspan (viewBox x = 46 + 478/2)');
  const want = run('diagHoverReadout(diagHoverData(fakeRootSvg), 285)');
  assert.ok(Math.abs(+pt.attrs.cy - want.cy) < 1e-6 && txt.textContent === want.text, 'marker on the curve, same readout as the pure helper');
  // moving off any diagram hides it; leaving the svg hides it; touch end hides it
  handlers.mousemove({ target: { closest: () => null }, clientX: 0, clientY: 0 });
  assert.equal(svgEl.grp.style.display, 'none', 'hidden when the pointer leaves the diagrams');
  handlers.touchmove({ target: svgEl, touches: [{ target: svgEl, clientX: midX + 100, clientY: 200 }] });
  assert.equal(svgEl.grp.style.display, '');
  handlers.touchend({});
  assert.equal(svgEl.grp.style.display, 'none');
  handlers.mousemove({ target: svgEl, clientX: midX, clientY: 200 });
  handlers.mouseleave({ target: svgEl });
  assert.equal(svgEl.grp.style.display, 'none', 'mouseleave hides');
  // a re-rendered svg (new element, same markup) is picked up with no registration
  const fresh = fakeSvg(svgM, { left: 0, top: 0, width: 540, height: 150 });
  handlers.mousemove({ target: fresh, clientX: 270, clientY: 75 });
  assert.equal(fresh.grp.style.display, '');
  assert.ok(/M = /.test(fresh.grp.parts['.hover-txt'].textContent));
  assert.equal(svgEl.grp.style.display, 'none', 'the previous diagram stays hidden');
});
