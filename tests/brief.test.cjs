// MasterSeries-format design brief (js/06-brief-masterseries.js): rendered
// through the same vm harness as the checks, for the five reference beams of
// the task in both Mcr methods. Every assertion reads the brief HTML back
// against the check object it was rendered from (docs/BRIEF_MAPPING.md).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { app } = require('./harness.cjs');
const c = app();
const run = x => c.run(x);

const CASES = {
  demo:   {},                                                     // 457 x 191 x 82 S275, 8 m, 19.7 G + 19.8 Q, fully restrained
  demoLtb:{restraint:'ltb'},
  ubAxMz: {ubKey:'457 x 191 x 133', grade:'S355', restraint:'ltb', axial:140, Mz:5, L:6,
           supports:[{pos:0,type:'pinned'},{pos:6,type:'pinned'}],
           loads:[{type:'udl',x1:0,x2:6,w:15,case:'G'},{type:'udl',x1:0,x2:6,w:20,case:'Q'},{type:'point',pos:3,P:40,case:'Q'}]},
  pfcEcc: {family:'pfc', sectionKey:'180x75x20', restraint:'ltb', eccOn:true, L:4,
           supports:[{pos:0,type:'pinned'},{pos:4,type:'pinned'}], loads:[{type:'udl',x1:0,x2:4,w:5,case:'Q',e:30}]},
  cant:   {restraint:'ltb', L:3, supports:[{pos:0,type:'fixed'}], loads:[{type:'point',pos:3,P:20,case:'Q'}]},
  shs:    {family:'shs', shsKey:'150x150x6.3', restraint:'ltb', L:4,
           supports:[{pos:0,type:'pinned'},{pos:4,type:'pinned'}], loads:[{type:'udl',x1:0,x2:4,w:10,case:'Q'}]},
  twoSpan:{restraint:'ltb', L:12, supports:[{pos:0,type:'pinned'},{pos:7,type:'pinned'},{pos:12,type:'pinned'}],
           ltbRestraints:[{pos:3.5}], loads:[{type:'udl',x1:0,x2:12,w:15,case:'Q'}]},
  class4: {restraint:'ltb', Mz:5},                                // UB 82 web is Class 4 under the uniform-compression bound -> blocked
};
function render(over, method) {
  c.reset(Object.assign({}, over, method ? {mcrMethod: method} : {}));
  return run(`(()=>{ const a=analyse(); const ch=checks(a); const html=renderMasterSeriesBrief(a,ch,a.sec);
    return {html, utils:ch.utils, unsupported:ch.unsupported, McRd:ch.McRd, ltbUtil:ch.ltbUtil, momUtil:ch.momUtil, pass:ch.pass,
            ax:!!ch.ax, axVplZ:ch.ax? ch.ax.VplZ : null, axMcz:ch.ax? ch.ax.Mcz : null, buck:ch.buck? {Fc:ch.buck.Fc, biax:ch.buck.biax} : null, tor:!!ch.tor, mcrMethod:ch.mcrMethod, eigen:!!(ch.ltb&&ch.ltb.eigen),
            ltbMbRd:ch.ltb? ch.ltb.MbRd : null, ltbMbMcr:ch.ltb? ch.ltb.MbMcr : null, ltbMbSimp:ch.ltb? ch.ltb.MbSimp : null}; })()`);
}
// ---- HTML readers ----
const ROW = /<div class="ms-row[^"]*"><div class="ms-l">(.*?)<\/div><div class="ms-v[^"]*">(.*?)<\/div><div class="ms-r">(.*?)<\/div><div class="ms-t">(.*?)<\/div><\/div>/g;
function rows(html) { return [...html.matchAll(ROW)].map(m => ({label:m[1], vals:m[2], res:m[3], tag:m[4]})); }
function row(html, re) { return rows(html).find(r => re.test(r.label)) || null; }
function headings(html) { return [...html.matchAll(/<div class="ms-h">(.*?)<\/div>/g)].map(m => m[1]); }
function unity(html) {
  const i0 = html.indexOf('<div class="ms-unity-head">'), i1 = html.indexOf('<div class="ms-unity-vals">', i0), i2 = html.indexOf('</div></div>', i1);
  assert.ok(i0 > 0 && i1 > i0 && i2 > i1, 'unity bar present');
  const cells = s => [...s.matchAll(/<div[^>]*>(.*?)<\/div>/g)].map(x => x[1]);
  return {names: cells(html.slice(i0 + 27, i1)), vals: cells(html.slice(i1 + 27, i2 + 6))};
}
const num = s => parseFloat(String(s).replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ''));
const near3 = (s, v, what) => assert.equal(num(s).toFixed(3), (+v).toFixed(3), what + ': printed ' + s + ' vs ' + v);
// MasterSeries block order (docs/EC3_BEAM_TRIGGER_LIST.md section 4); only the blocks a variant prints are present
const ORDER = [/^Member Loading and Member Forces$/, /^Classification and Effective Area \(EN 1993: 2006\)$/, /^(Local Capacity Check|Moment Capacity Check M\.c\.y\.Rd)/,
  /^Compression Resistance N\.b\.Rd$/, /^Equivalent Uniform Moment Factors? C1/, /^Lateral Buckling Check M\.b\.Rd$/, /^Lateral Restraint Portions/,
  /^Buckling Resistance$/, /^Torsion Design$/, /^Deflection Check - Load Case /];
function checkCommon(r, tag) {
  const html = r.html;
  assert.ok(!/undefined|NaN/.test(html), tag + ': brief contains undefined/NaN');
  // headings in MasterSeries order, no unknown heading
  const hs = headings(html), idx = hs.map(h => ORDER.findIndex(re => re.test(h)));
  assert.ok(idx.every(i => i >= 0), tag + ': unknown heading ' + hs[idx.indexOf(-1)]);
  for (let i = 1; i < idx.length; i++) assert.ok(idx[i] > idx[i-1], tag + ': heading out of order: ' + hs.join(' | '));
  assert.ok(/^Member Loading/.test(hs[0]) && /^Deflection Check/.test(hs[hs.length-1]), tag + ': first/last block');
  // unity bar Max = max of the non-deflection utilisations
  const u = unity(html);
  assert.equal(u.names[u.names.length-1], 'Max');
  const maxU = Math.max(...r.utils.filter(x => x.name !== 'Deflection').map(x => x.val));
  near3(u.vals[u.vals.length-1], maxU, tag + ': unity Max');
  assert.ok(u.names.includes('Deflection'), tag + ': Deflection cell');
  near3(u.vals[u.names.indexOf('Deflection')], r.utils.find(x => x.name === 'Deflection').val, tag + ': Deflection cell value');
  // every blocking message appears (as a NOT VERIFIED row and in the footer)
  r.unsupported.forEach(m => {
    assert.ok(html.includes(m), tag + ': missing unsupported message: ' + m);
    assert.ok(new RegExp('ms-nv-msg">' + m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(html), tag + ': message not printed as a NOT VERIFIED row: ' + m);
  });
  // title verdict suffix exactly as MasterSeries carries (FAIL)
  const failed = r.utils.some(x => !Number.isFinite(x.val) || x.val > 1.0001);
  const title = html.match(/<div class="ms-title"><div>(.*?)<\/div>/)[1];
  if (r.pass) assert.ok(!/\((FAIL|NOT VERIFIED)\)/.test(title), tag + ': passing brief must not carry a fail suffix');
  else assert.ok(title.endsWith(failed ? '(FAIL)' : '(NOT VERIFIED)'), tag + ': title suffix: ' + title);
  assert.ok(html.includes(r.pass ? 'ms-brief"' : 'ms-brief ms-fail"'), tag + ': fail panel colour');
  // Mc.y.Rd line = c.McRd; My.Ed/Mb.Rd line = c.ltbUtil (when LTB is checked)
  const mc = row(html, /^M<sub>(c|v)\.y\.Rd<\/sub> = /);
  assert.ok(mc, tag + ': Mc.y.Rd line missing');
  near3(mc.res, r.McRd, tag + ': Mc.y.Rd');
  const mom = row(html, /^M<sub>y\.Ed<\/sub>\/M<sub>c\.y\.Rd<\/sub>$/);
  near3(mom.res, r.momUtil, tag + ': My.Ed/Mc.y.Rd');
  const mb = row(html, /^M<sub>y\.Ed<\/sub>\/M<sub>b\.Rd<\/sub>$/);
  if (r.ltbUtil != null && isFinite(r.ltbUtil)) { assert.ok(mb, tag + ': My.Ed/Mb.Rd line missing'); near3(mb.res, r.ltbUtil, tag + ': My.Ed/Mb.Rd'); }
  else assert.equal(mb, null, tag + ': no LTB ratio expected');
  return {html, hs, u};
}

test('demo beam, fully restrained: Beam-Portion brief with the Fully Restrained line and no C1 block', () => {
  const r = render(CASES.demo);
  const {html, hs, u} = checkCommon(r, 'demo');
  assert.ok(html.includes('Beam &amp; Beam-Portion (Member)</div>'), 'brief type');
  assert.ok(html.includes('Member 457 x 191 x 82 UB [S275]'), 'member line from the section');
  assert.ok(html.includes('Between 0 and 8 m, in Load Case 1 (ULS: 1.35G + 1.5Q (Eq 6.10))'), 'portion + load case');
  assert.ok(hs.includes('Moment Capacity Check M.c.y.Rd - Fully Restrained Beam'));
  assert.ok(!hs.some(h => /Equivalent Uniform/.test(h)), 'no C1 block when fully restrained');
  const fr = row(html, /^M<sub>b\.Rd<\/sub> = M<sub>c\.y\.Rd<\/sub>$/);
  assert.equal(fr.vals, 'Fully Restrained'); near3(fr.res, r.McRd, 'Mb.Rd = Mc.y.Rd');
  assert.deepEqual(u.names, ['MA/Mc', 'M_(y.Ed)/M_(b.Rd)', 'Deflection', 'V/Vpl', 'Max']);
  near3(u.vals[0], r.momUtil, 'MA/Mc'); near3(u.vals[1], r.momUtil, 'Mb = Mc cell');
  assert.ok(row(html, /^V<sub>y\.Ed<\/sub>\/V<sub>pl\.y\.Rd<\/sub>$/).tag === 'Low Shear');
  assert.ok(row(html, /Deflection|In-span/) && row(html, /^In-span &delta; &le; Span\/360$/).tag === 'OK');
  assert.ok(/Class = Fn\(c\/t, d\/t/.test(html) && html.includes('(Axial: Non-Slender)') && html.includes('>Class 1<'), 'classification line');
  assert.ok(html.includes('Member Forces in Load Case 1 (ULS') && html.includes('Maximum Deflection from Load Case 1 (SLS'), 'forces table heading');
});

test('demo beam, not fully restrained: FE lines in eigen mode, fn(M1, M2, Mo, psi, mu) with tag Uniform in standard mode', () => {
  const e = render(CASES.demoLtb, 'eigen');
  const {html: he, hs: hse} = checkCommon(e, 'demoLtb/eigen');
  assert.ok(e.eigen && hse.includes('Equivalent Uniform Moment Factor C1') && hse.includes('Lateral Buckling Check M.b.Rd'));
  assert.ok(row(he, /^C<sub>1<\/sub> = M<sub>cr<\/sub>\/M<sub>cr,uniform<\/sub>$/), 'eigen C1 line');
  assert.ok(row(he, /^M<sub>cr<\/sub> = FE eigenvalue/).tag === 'converged', 'FE Mcr line');
  assert.ok(row(he, /^&chi;<sub>LT<\/sub> = Fn/).tag === 'Curve c', 'curve tag');
  assert.ok(row(he, /^&chi;<sub>LT\.mod<\/sub> = Fn/).tag === '6.3.2.3');
  assert.ok(he.includes('(FAIL)') && he.includes('ms-brief ms-fail"'), 'failing LTB brief is flagged');
  assert.ok(row(he, /^M<sub>y\.Ed<\/sub>\/M<sub>b\.Rd<\/sub>$/).tag.includes('Warning'), 'red Warning tag');
  const s = render(CASES.demoLtb, 'standard');
  const {html: hs2} = checkCommon(s, 'demoLtb/standard');
  assert.equal(s.mcrMethod, 'standard');
  const c1 = row(hs2, /^C<sub>1<\/sub> = fn\(M<sub>1<\/sub>, M<sub>2<\/sub>, M<sub>o<\/sub>, &psi;, &mu;\)$/);
  assert.ok(c1, 'standard C1 line'); assert.equal(c1.tag, 'Uniform'); assert.equal(c1.res, '1.127');
  assert.equal(c1.vals, '0.0, 0.0, 459.0, 1.000, 300.000');
  const mcr = row(hs2, /^M<sub>cr<\/sub> = Fn\(C<sub>1<\/sub>, L<sub>e<\/sub>, I<sub>z<\/sub>, I<sub>t<\/sub>, I<sub>w<\/sub>, E\)$/);
  assert.equal(mcr.vals, '1.127, 8.000, 1870, 69.2, 0.922, 210000; z<sub>g</sub> = 0 (load through the shear centre)'); assert.equal(mcr.tag, 'SN003a');
  assert.ok(row(hs2, /^L<sub>e<\/sub> = 1 L$/).res === '8 m');
  // the Mcr route is the design basis: the printed Mb.Rd is the SN003a-chain value and the
  // ratio line equals c.ltbUtil (checked by checkCommon); the P362 6.55 route is a comparison row
  const mbS = row(hs2, /^M<sub>b\.Rd<\/sub> = &chi;/);
  near3(mbS.res, s.ltbMbMcr, 'Mb.Rd printed = MbMcr'); near3(mbS.res, s.ltbMbRd, 'Mb.Rd printed = design MbRd');
  const cmp = row(hs2, /P362 6\.55 simplified\) ; M<sub>b\.Rd<\/sub> \(comparison only\)/);
  assert.ok(cmp && cmp.tag === 'P362 6.55 comparison', 'simplified route printed as a comparison row');
  near3(cmp.res, s.ltbMbSimp, 'comparison row prints MbSimp');
  assert.equal(row(hs2, /^M<sub>b\.Rd<\/sub> \(design basis\)$/), null, 'no separate design-basis line: the chain above IS the basis');
  assert.ok(/z<sub>g<\/sub> = 0 \(load through the shear centre\)/.test(mcr.vals), 'load height always printed on the Mcr line');
});

test('UB with axial compression and Mz: Axial with Moments brief with every block, both methods', () => {
  for (const m of ['eigen', 'standard']) {
    const r = render(CASES.ubAxMz, m);
    const {html, hs, u} = checkCommon(r, 'ubAxMz/' + m);
    assert.ok(r.ax && r.buck && r.buck.Fc > 0);
    assert.ok(html.includes('Axial with Moments (Member)'));
    assert.deepEqual(hs, ['Member Loading and Member Forces', 'Classification and Effective Area (EN 1993: 2006)', 'Local Capacity Check',
      'Compression Resistance N.b.Rd', 'Equivalent Uniform Moment Factors C1, C.mLT, C.mz, and C.my', 'Lateral Buckling Check M.b.Rd',
      'Buckling Resistance', 'Deflection Check - Load Case 1 (SLS: Variable actions only (NA 2.23))']);
    ['V<sub>z\\.Ed</sub>/V<sub>pl\\.z\\.Rd</sub>', 'M<sub>c\\.z\\.Rd</sub> = ', 'N<sub>pl\\.Rd</sub> = A<sub>g</sub>', 'n = N<sub>Ed</sub>/N<sub>pl\\.Rd</sub>',
     'W<sub>pl\\.N\\.y</sub> = Fn', 'M<sub>N\\.y\\.Rd</sub> = ', 'W<sub>pl\\.N\\.z</sub> = Fn', 'M<sub>N\\.z\\.Rd</sub> = ',
     '\\(M<sub>y\\.Ed</sub>/M<sub>N\\.y\\.Rd</sub>\\)<sup>&alpha;</sup>', 'L<sub>ey</sub> = K<sub>y</sub>', '&lambda;&#772;<sub>y</sub> = ', 'N<sub>b\\.y\\.Rd</sub> = Area',
     'L<sub>ez</sub> = K<sub>z</sub>', 'N<sub>b\\.z\\.Rd</sub> = Area', 'C<sub>mLT</sub> = ', 'C<sub>mz</sub> = Max', 'C<sub>my</sub> = ',
     'U<sub>N\\.y</sub> = ', 'U<sub>N\\.z</sub> = ', 'U<sub>M\\.y</sub> = ', 'U<sub>M\\.z</sub> = ', 'k<sub>yy</sub> = ', 'k<sub>zz</sub> = ', 'k<sub>yz</sub> = ', 'k<sub>zy</sub> = ',
     'U<sub>Ny</sub>\\+k<sub>yy</sub>', 'U<sub>Nz</sub>\\+k<sub>zy</sub>'].forEach(l => assert.ok(row(html, new RegExp('^' + l)), m + ': missing line ' + l));
    assert.ok(/Curve [a-d]/.test(row(html, /^N<sub>b\.y\.Rd<\/sub>/).tag) && /Curve [a-d]/.test(row(html, /^N<sub>b\.z\.Rd<\/sub>/).tag));
    assert.equal(row(html, /^C<sub>mz<\/sub>/).tag, 'Table B.3');
    assert.ok(/Table B\.[12]/.test(row(html, /^k<sub>zy<\/sub>/).tag));
    assert.ok(html.includes('(No bearing / block tearing design)'));
    // V_pl.z.Rd and M_c.z.Rd are the engine's c.ax values (nothing recomputed in the brief)
    near3(row(html, /^V<sub>z\.Ed<\/sub>\/V<sub>pl\.z\.Rd<\/sub>$/).vals.replace(/^0 \/ /, ''), r.axVplZ, m + ': V_pl.z.Rd from c.ax');
    near3(row(html, /^M<sub>c\.z\.Rd<\/sub> = /).res, r.axMcz, m + ': M_c.z.Rd from c.ax');
    assert.deepEqual(u.names.slice(0, 7), ['N_Ed/N_(pl.Rd)', 'Local', 'UNyz', 'UMyz', 'Ax+M_6.61', 'Ax+M_6.62', 'Deflection']);
    near3(u.vals[4], r.utils.find(x => /6\.61/.test(x.name)).val, 'Ax+M_6.61'); near3(u.vals[5], r.utils.find(x => /6\.62/.test(x.name)).val, 'Ax+M_6.62');
    near3(u.vals[1], r.utils.find(x => /Biaxial/.test(x.name)).val, 'Local = biaxial interaction');
    if (m === 'standard') assert.equal(row(html, /^C<sub>1<\/sub> = fn/).tag, 'Serna');
  }
});

test('PFC with an eccentric load: Torsion Design block with the P385 lines, Annex A interaction and V+T cells, both methods', () => {
  for (const m of ['eigen', 'standard']) {
    const r = render(CASES.pfcEcc, m);
    const {html, hs, u} = checkCommon(r, 'pfcEcc/' + m);
    assert.ok(r.tor && hs.includes('Torsion Design') && hs.indexOf('Torsion Design') > hs.indexOf('Lateral Buckling Check M.b.Rd'));
    assert.ok(row(html, /^J, H, a, Q<sub>f<\/sub>, Q<sub>w<\/sub>$/).tag === 'P385 App A');
    assert.ok(/W<sub>n2<\/sub>/.test(row(html, /^W<sub>n0<\/sub>, S<sub>w1<\/sub>$/).vals), 'PFC extra torsion constants');
    assert.ok(html.includes('Torsion Bending Design @ '));
    ['T<sub>Ed</sub> \\(max\\)', '&phi;<sub>max</sub> \\(ULS\\)', 'M<sub>w\\.Ed</sub> = ', 'M<sub>z\\.Ed</sub> = &phi;', '\\(M<sub>y</sub>/M<sub>pl\\.y</sub>\\)&sup2;',
     'V<sub>pl\\.T\\.Rd</sub> = \\[', 'V<sub>Ed</sub>/V<sub>pl\\.T\\.Rd</sub>', 'M<sub>y</sub>/M<sub>b\\.Rd</sub> \\+ C<sub>mz</sub>', 'End torques', '&theta;<sub>ser</sub>']
      .forEach(l => assert.ok(row(html, new RegExp('^' + l)), m + ': missing torsion line ' + l));
    ['Torsion', 'V+T', 'LTB+T'].forEach(n => assert.ok(u.names.includes(n), m + ': unity cell ' + n));
    near3(u.vals[u.names.indexOf('LTB+T')], r.utils.find(x => /Annex A/.test(x.name)).val, 'LTB+T cell');
    if (m === 'standard') {
      assert.ok(row(html, /^&lambda;&#772;<sub>LT<\/sub> = \(L<sub>e<\/sub>\/i<sub>z<\/sub>\)\/&kappa;$/).tag === 'P362 channel');
      assert.equal(row(html, /^&chi;<sub>LT<\/sub> = Fn/).tag, 'Curve d');
      assert.ok(row(html, /^M<sub>cr<\/sub> \(back-calculated\)/));
    } else assert.equal(row(html, /^&chi;<sub>LT<\/sub> = Fn/).tag, 'Curve d');
  }
});

test('cantilever: Cantilever title line, SN006a chain in standard mode, f = 1 in both', () => {
  for (const m of ['eigen', 'standard']) {
    const r = render(CASES.cant, m);
    const {html} = checkCommon(r, 'cant/' + m);
    assert.ok(html.includes('Cantilever 0 to 3 m, in Load Case 1'), m + ': title');
    // cantilever segment: L/S.divisorCant (default 180, UK NA Table NA.2 [verify]) instead of the span divisor
    const tip = row(html, /^Tip &delta; &le; L\/180$/);
    assert.ok(tip, m + ': tip deflection label'); assert.ok(/Table NA\.2 \[verify\]/.test(tip.vals), m + ': cantilever limit basis printed');
    if (m === 'standard') {
      assert.equal(row(html, /^M<sub>cr0<\/sub> = /).tag, 'SN006a');
      const C = row(html, /^C = Fn\(&kappa;<sub>wt<\/sub>, &eta;, warping\)$/);
      assert.ok(C && /Eq \(7\)/.test(C.vals) && C.tag === 'Tables 3.1&ndash;3.3');
      assert.ok(row(html, /^M<sub>cr<\/sub> = C&middot;M<sub>cr0<\/sub>$/));
      assert.equal(row(html, /^C = fn\(M<sub>1<\/sub>/).tag, 'Cantilever');
      assert.equal(row(html, /^&chi;<sub>LT\.mod<\/sub>/).tag, 'f = 1 (cantilever)');
    } else {
      assert.ok(/root at x = 0 \(fixed\), tip free; root warping free/.test(row(html, /^L<sub>e<\/sub> = portion/).vals));
      assert.equal(row(html, /^&chi;<sub>LT\.mod<\/sub>/).tag, 'f = 1 (cantilever)');
    }
  }
});

test('SHS: closed section not susceptible to LTB in standard mode; the eigen route prints a solved Mcr with lambda below 0.4', () => {
  const s = render(CASES.shs, 'standard');
  const {html: hs2, hs: heads} = checkCommon(s, 'shs/standard');
  const na = row(hs2, /^M<sub>b\.Rd<\/sub> = M<sub>c\.y\.Rd<\/sub>$/);
  assert.ok(na && na.vals.includes('not susceptible to LTB') && na.tag === '6.3.2.1(2)');
  assert.ok(!heads.some(h => /Equivalent Uniform/.test(h)), 'no C1 line for the closed-form box');
  assert.ok(hs2.includes('150 x 150 x 6.3 SHS [Hot-finished] [S275] D=150 B=150 t=6.3'), 'box section line');
  const e = render(CASES.shs, 'eigen');
  const {html: he} = checkCommon(e, 'shs/eigen');
  assert.ok(row(he, /^M<sub>cr<\/sub> = FE eigenvalue/) && row(he, /^&lambda;&#772;<sub>LT<\/sub> &le; &lambda;&#772;<sub>LT,0<\/sub>$/).tag === '6.3.2.2(4)');
  assert.ok(row(he, /^Tip|^In-span/).tag.includes('Warning'), 'deflection fails on this span');
  assert.ok(he.includes('(FAIL)'));
});

test('blocking messages print as NOT VERIFIED rows in their block and the title reads (NOT VERIFIED)', () => {
  for (const m of ['eigen', 'standard']) {
    const r = render(CASES.class4, m);
    const {html} = checkCommon(r, 'class4/' + m);
    assert.ok(r.unsupported.length >= 1 && !r.pass);
    assert.ok(html.includes('Beam &amp; Beam-Portion (Member) (NOT VERIFIED)') || html.includes('(FAIL)'), 'title suffix');
    const nvRows = [...html.matchAll(/<div class="ms-row ms-nv">/g)].length;
    assert.equal(nvRows, r.unsupported.length, 'one NOT VERIFIED row per blocking message');
    // the Class 4 message sits in the Classification block (before the Moment Capacity heading)
    const iCls = html.indexOf('Classification and Effective Area'), iMom = html.indexOf('Moment Capacity Check'), iNV = html.indexOf('ms-nv-msg">EC3 Class 4');
    assert.ok(iCls < iNV && iNV < iMom, 'Class 4 row placed in the Classification block');
    assert.ok(html.includes('>BLOCKED</span>'), 'Class 4 tag');
    assert.ok(html.includes('NOT COVERED:</span> EC3 Class 4'), 'footer entry');
  }
});

test('two-span member with an intermediate restraint renders a three-row portion table after the LTB block', () => {
  const r = render(CASES.twoSpan, 'eigen');
  const {html, hs} = checkCommon(r, 'twoSpan');
  assert.ok(hs.indexOf('Lateral Restraint Portions (span by span, fork ends)') === hs.indexOf('Lateral Buckling Check M.b.Rd') + 1);
  const tbl = html.match(/<table class="ms-combos"><thead><tr><th>Portion<\/th>.*?<\/table>/s)[0];
  assert.equal([...tbl.matchAll(/<tr><td class="num">\d<\/td>/g)].length, 3);
  assert.ok(/0 &ndash; 3\.5.*3\.5 &ndash; 7.*7 &ndash; 12/s.test(tbl));
  assert.ok(row(html, /^L<sub>e<\/sub> = portion/).vals.includes('restraints at x = 0, 3.5, 7, 12 m (fork)'));
  assert.ok(row(html, /critical bay/), 'bay C1 line');
  assert.ok(/\[segment [\d.]+&ndash;[\d.]+ m\]/.test(row(html, /standard, comparison/).vals), 'comparison C1 names its segment');
});

test('multiple ULS combinations: case indices, summary table and combination labels', () => {
  c.reset({restraint:'ltb', combos:[
    {id:'c1', label:'ULS: 1.35G + 1.5Q (Eq 6.10)', factors:{G:1.35,Q:1.5,W:0,E:0}, sls:false, on:true},
    {id:'c2', label:'ULS: 1.0G + 1.5Q', factors:{G:1.0,Q:1.5,W:0,E:0}, sls:false, on:true},
    {id:'s1', label:'SLS: Q only', factors:{G:0,Q:1,W:0,E:0}, sls:true, on:true}]});
  const r = run(`(()=>{ const a=analyse(); const ch=checks(a); return {html:renderMasterSeriesBrief(a,ch,a.sec), utils:ch.utils, unsupported:ch.unsupported, McRd:ch.McRd, ltbUtil:ch.ltbUtil, momUtil:ch.momUtil, pass:ch.pass}; })()`);
  const {html} = checkCommon(r, 'multi');
  assert.ok(html.includes('in Load Case 1 (ULS: 1.35G + 1.5Q (Eq 6.10))') && html.includes('(governing moment; 2 ULS cases enabled)'));
  assert.ok(html.includes('<table class="ms-combos">') && html.includes('(governs M)') && html.includes('(governs &delta;)'));
  assert.ok(row(html, /^Auto Design Load Cases$/).vals === '1-2; SLS 1');
});

test('pure helpers: case ranges, unity max, minor-axis shear area, W_pl.N back-substitution, portion moments, Table B.3 forms', () => {
  assert.equal(run('msbCaseRanges([1,2,4,5,6,9])'), '1-2, 4-6, 9');
  assert.equal(run('msbCaseRanges([])'), '');
  assert.equal(run('msbMaxExclDeflection([{name:"Deflection",val:5},{name:"a",val:0.4},{name:"b",val:0.9}])'), 0.9);
  assert.equal(run('typeof msbVplZ'), 'undefined', 'no V_pl.z.Rd recomputation in the brief');
  assert.equal(run('typeof msbMcz'), 'undefined', 'no M_c.z.Rd recomputation in the brief');
  // the engine's c.ax carries V_pl.z.Rd (cl 6.2.6(3)(f): A - hw tw) and M_c.z.Rd (class-consistent W_z fy)
  c.reset({axial:100});
  const ax = run('(()=>{ const a=analyse(); const ch=checks(a); return {ax:ch.ax, A:a.sec.A, tw:a.sec.tw, D:a.sec.D, tf:a.sec.tf, Sy:a.sec.Sy, fy:ch.fy, cls:ch.cl.cls}; })()');
  const AvzExp = ax.A * 100 - (ax.D - 2 * ax.tf) * ax.tw;
  assert.ok(Math.abs(ax.ax.Avz - AvzExp) < 1e-9 && Math.abs(ax.ax.VplZ - AvzExp * ax.fy / Math.sqrt(3) / 1000) < 1e-9, 'c.ax.VplZ');
  assert.ok(ax.cls <= 2 && Math.abs(ax.ax.Mcz - ax.Sy * 1e3 * ax.fy / 1e6) < 1e-9, 'c.ax.Mcz = W_pl.z fy');
  c.reset({family:'shs', shsKey:'150x150x6.3', axial:50});
  const bx = run('(()=>{ const a=analyse(); const ch=checks(a); return {Avz:ch.ax.Avz, A:a.sec.A, B:a.sec.B, D:a.sec.D}; })()');
  assert.ok(Math.abs(bx.Avz - bx.A * 100 * bx.B / (bx.D + bx.B)) < 1e-9, 'box A_v,z = A b/(b+h)');
  assert.ok(Math.abs(run('msbWplN(503.25,275)') - 1830) < 1e-9);
  assert.ok(Math.abs(run('msbNcr(210000,1870,8000)') - Math.PI ** 2 * 210000 * 1870e4 / 8000 ** 2 / 1000) < 1e-9);
  assert.ok(Math.abs(run('msbKc(1.127)') - 1 / Math.sqrt(1.127)) < 1e-12 && run('msbKc(0.5)') === 1);
  const pm = run('msbPortionMoments({xs:[0,1000,2000,3000,4000],M:[0,30e6,40e6,30e6,0],V:[0,0,0,0,0]},0,4000)');
  assert.ok(Math.abs(pm.Mo - 40) < 0.05 && pm.mu === 300 && Math.abs(pm.Mmax - 40) < 1e-9 && pm.xmax === 2000);
  assert.equal(run('msbCmB3Form("uniform load diagram, &alpha;<sub>h</sub> = 0.000, M<sub>h</sub> = 0.0")'), '0.95+0.05&alpha;<sub>h</sub>');
  assert.equal(run('msbCmB3Form("linear end-moment diagram, &psi; = 0.50")'), 'Max(0.6+0.4&psi;, 0.4)');
  assert.equal(run('msbC1Tag("simply supported + central point load (SN003a Table 3.2)","point")'), 'Point');
  assert.equal(run('msbC1Tag("linear end-moment gradient, &psi; = 0.50","end-moment")'), 'Not Loaded');
  assert.equal(run('msbBlockFor("EC3 Class 4 (slender) section: effective-section properties")'), 'class');
  assert.equal(run('msbBlockFor("Torsion on this open section is NOT COVERED")'), 'torsion');
  assert.equal(run('msbBlockFor("Elastic critical moment: mesh convergence error is 1 %")'), 'ltb');
});

test('a blocking message that no block claims is still printed as a NOT VERIFIED row (before the deflection block)', () => {
  c.reset({restraint:'ltb', mcrMethod:'standard'});
  const r = run(`(()=>{ const a=analyse(); const ch=checks(a);
    const msg='Custom limitation recorded by a future check; PASS is blocked.';
    assert_block: { if(msbBlockFor(msg)!=='general') throw new Error('test message must be unclassifiable: '+msbBlockFor(msg)); }
    ch.unsupported=ch.unsupported.concat([msg]); ch.pass=false;
    return {html:renderMasterSeriesBrief(a,ch,a.sec), utils:ch.utils, unsupported:ch.unsupported, McRd:ch.McRd, ltbUtil:ch.ltbUtil, momUtil:ch.momUtil, pass:ch.pass, msg}; })()`);
  const {html} = checkCommon(r, 'general-nv');   // asserts every unsupported message has an ms-nv-msg row
  const iRow = html.indexOf('ms-nv-msg">' + r.msg), iDef = html.indexOf('Deflection Check - Load Case'), iTor = html.indexOf('Torsion Design');
  assert.ok(iRow > 0 && iRow < iDef, 'general row sits before the deflection block');
  assert.ok(iTor < 0 || iRow > iTor, 'general row sits after the torsion block when present');
  assert.equal([...html.matchAll(/<div class="ms-row ms-nv">/g)].length, r.unsupported.length, 'one NOT VERIFIED row per message');
});

test('standard route, closed section on a long span: the brief prints the real chi_LT chain and curve, not the 6.3.2.1(2) exemption', () => {
  const over = {family:'rhs', rhsKey:'300 x 100 x 8.0', restraint:'ltb', L:14, supports:[{pos:0,type:'pinned'},{pos:14,type:'pinned'}],
                loads:[{type:'udl',x1:0,x2:14,w:1,case:'G'},{type:'udl',x1:0,x2:14,w:1.5,case:'Q'}]};
  const s = render(over, 'standard');
  const {html} = checkCommon(s, 'rhs-long/standard');
  assert.equal(row(html, /^M<sub>b\.Rd<\/sub> = M<sub>c\.y\.Rd<\/sub>$/), null, 'no exemption line when lambda_LT > 0.4');
  assert.ok(row(html, /^M<sub>cr<\/sub> = Fn\(C<sub>1<\/sub>, L<sub>e<\/sub>, I<sub>z<\/sub>, I<sub>t<\/sub>, I<sub>w<\/sub> = 0, E\)$/), 'SN003a line with Iw = 0');
  assert.equal(row(html, /^&chi;<sub>LT<\/sub> = Fn/).tag, 'Curve c', 'hot-finished RHS h/b = 3 -> curve c (NA Table NA.1), same as the eigen route');
  assert.equal(row(html, /^&chi;<sub>LT\.mod<\/sub> = Fn/).tag, '6.3.2.3 / NA Table NA.1');
  near3(row(html, /^M<sub>b\.Rd<\/sub> = &chi;/).res, s.ltbMbRd, 'Mb.Rd printed = engine value');
  assert.ok(s.ltbMbRd < s.McRd, 'a real reduction is printed');
  const e = render(over, 'eigen');
  assert.equal(row(e.html, /^&chi;<sub>LT<\/sub> = Fn/).tag, 'Curve c', 'eigen route: same curve');
  assert.ok(Math.abs(e.ltbMbRd - s.ltbMbRd) / s.ltbMbRd < 0.01, 'both routes agree within 1% for this box');
});

test('standard route: the entered load height is always printed, and a destabilising height on a non-tabulated diagram is BLOCKED', () => {
  // off-centre point load, top-flange load height: Serna C1, no published C2
  const s = render({restraint:'ltb', eccOn:true, za:201, L:7, supports:[{pos:0,type:'pinned'},{pos:7,type:'pinned'}],
    loads:[{type:'point',pos:2.45,P:12,case:'G'},{type:'point',pos:2.45,P:32,case:'Q'}]}, 'standard');
  const {html} = checkCommon(s, 'offcentre-zg/standard');
  const mcr = row(html, /^M<sub>cr<\/sub> = Fn\(C<sub>1<\/sub>, L<sub>e<\/sub>/);
  assert.ok(/z<sub>g<\/sub> = \+201 mm entered &mdash; NOT applied/.test(mcr.vals), 'zg printed as not applied: ' + mcr.vals);
  assert.ok(mcr.tag.includes('BLOCKED'));
  assert.ok(s.unsupported.some(m => /C<sub>2<\/sub> only for the simply supported and fixed-ended/.test(m)) && !s.pass);
  assert.ok(html.includes('(NOT VERIFIED)') || html.includes('(FAIL)'));
});
