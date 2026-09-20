// MasterSeries-format design brief (js/06-brief-masterseries.js): rendered
// through the same vm harness as the checks, for the five reference beams of
// the task in both Mcr methods. Every assertion reads the brief HTML back
// against the check object it was rendered from (docs/BRIEF_MAPPING.md).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { app } = require('./harness.cjs');
const c = app();
const run = x => c.run(x);
const E = (p, o) => c.ends(p, o);   // ends preset of the single-span model

const CASES = {
  demo:   {},                                                     // 457 x 191 x 82 S275, 8 m, 19.7 G + 19.8 Q, fully restrained
  demoLtb:{restraint:'ltb'},
  ubAxMz: {ubKey:'457 x 191 x 133', grade:'S355', restraint:'ltb', axial:140, Mz:5, L:6,
           ends:E('ss'),
           loads:[{type:'udl',x1:0,x2:6,w:15,case:'G'},{type:'udl',x1:0,x2:6,w:20,case:'Q'},{type:'point',pos:3,P:40,case:'Q'}]},
  pfcEcc: {family:'pfc', sectionKey:'180x75x20', restraint:'ltb', eccOn:true, L:4,
           ends:E('ss'), loads:[{type:'udl',x1:0,x2:4,w:5,case:'Q',e:30}]},
  cant:   {restraint:'ltb', L:3, ends:E('cantilever'), loads:[{type:'point',pos:3,P:20,case:'Q'}]},
  shs:    {family:'shs', shsKey:'150x150x6.3', restraint:'ltb', L:4,
           ends:E('ss'), loads:[{type:'udl',x1:0,x2:4,w:10,case:'Q'}]},
  threeBay:{restraint:'ltb', L:12, ends:E('ss'),   // single 12 m span with lateral restraints at 3.5 and 7 m: three bays
           ltbRestraints:[{pos:3.5},{pos:7}], loads:[{type:'udl',x1:0,x2:12,w:15,case:'Q'}]},
  class4: {family:'rhs', rhsKey:'400 x 200 x 8.0', restraint:'ltb', Mz:5},   // RHS wall d/t = 47 > 42 eps under the uniform-compression bound kept for hollow sections with M_z -> Class 4, blocked (the UB 82 case of the earlier suite is Class 1 since G3 item 5)
};
function render(over, method) {
  c.reset(Object.assign({}, over, method ? {mcrMethod: method} : {}));
  return run(`(()=>{ const a=analyse(); const ch=checks(a); const html=renderMasterSeriesBrief(a,ch,a.sec);
    return {html, utils:ch.utils, unsupported:ch.unsupported, McRd:ch.McRd, ltbUtil:ch.ltbUtil, momUtil:ch.momUtil, pass:ch.pass,
            ax:!!ch.ax, axVplZ:ch.ax? ch.ax.VplZ : null, axMcz:ch.ax? ch.ax.Mcz : null, buck:ch.buck? {Fc:ch.buck.Fc, biax:ch.buck.biax, MzEd:ch.buck.MzEd, MzImp:ch.buck.MzImp, MzTwist:ch.buck.MzTwist, Mcz:ch.buck.Mcz, mzTerm:ch.buck.mzTerm, Cmz:ch.buck.Cmz, u2:ch.buck.u2} : null, tor:!!ch.tor, mcrMethod:ch.mcrMethod, eigen:!!(ch.ltb&&ch.ltb.eigen),
            // 20 Sep 2026 torsion + N/Mz: the engine fields the new brief rows print (c.tor.elastic / MzImp / MzTot / MzTwistMax / cross / superposition / combinedBasis, c.annex)
            torE:ch.tor? {elastic:ch.tor.elastic||null, MzImp:ch.tor.MzImp, MzTot:ch.tor.MzTot, MzTwistMax:ch.tor.MzTwistMax, MzMax:ch.tor.MzMax, cross:ch.tor.cross||null, superposition:ch.tor.superposition||null, combinedBasis:ch.tor.combinedBasis||null, combinedActive:!!ch.tor.combinedActive} : null,
            annex:ch.annex||null, advisory:ch.advisory||[], info:ch.info||[],   // 20 Sep 2026 review: c.info carries the informational (6.1) value
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
const ORDER = [/^Member Loading and Member Forces$/, /^Classification and Effective Area \(EN 1993: 2006\)$/,
  /^Shear Capacity Check$/,   // 20 Sep 2026 single-brief task: the MasterSeries shear block (max V_Ed / V_pl.y.Rd) before Local Capacity
  /^(Local Capacity Check|Moment Capacity Check M\.c\.y\.Rd)/,
  /^Web Transverse Forces \(EN 1993-1-5 cl 6\)$/,   // [beam-v03 addition, 19 Sep 2026 gap closure G2] after Local Capacity
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
  // 20 Sep 2026: the SLS default became 1.0G + 1.0Q (was Q only): the demo beam deflects 27.59 mm > 8000/360 = 22.22 mm under
  // 19.7 G + 19.8 Q + 0.8044 self-weight, so its brief title carries the FAIL suffix and the deflection row a Warning
  assert.ok(html.includes('Beam &amp; Beam-Portion (Member) (FAIL)</div>'), 'brief type');
  assert.ok(html.includes('Member 457 x 191 x 82 UB [S275]'), 'member line from the section');
  assert.ok(html.includes('Between 0 and 8 m, in Load Case 1 (ULS: 1.35G + 1.5Q (Eq 6.10))'), 'portion + load case');
  assert.ok(hs.includes('Moment Capacity Check M.c.y.Rd - Fully Restrained Beam'));
  assert.ok(!hs.some(h => /Equivalent Uniform/.test(h)), 'no C1 block when fully restrained');
  const fr = row(html, /^M<sub>b\.Rd<\/sub> = M<sub>c\.y\.Rd<\/sub>$/);
  assert.equal(fr.vals, 'Fully Restrained'); near3(fr.res, r.McRd, 'Mb.Rd = Mc.y.Rd');
  assert.deepEqual(u.names, ['MA/Mc', 'M_(y.Ed)/M_(b.Rd)', 'Deflection', 'V/Vpl', 'F/F_Rd', 'Web 7.2', 'Max']);   // F/F_Rd, Web 7.2: web transverse forces at the two support reactions (G2)
  near3(u.vals[0], r.momUtil, 'MA/Mc'); near3(u.vals[1], r.momUtil, 'Mb = Mc cell');
  // 20 Sep 2026 single-brief task: MasterSeries prints "Vy.Ed/Vpl.y.Rd" twice - the maximum shear in the Shear Capacity Check block
  // (OK / Warning) and the shear coincident with the maximum moment in the Moment Capacity block (Low / High Shear)
  const vRows = rows(html).filter(r => /^V<sub>y\.Ed<\/sub>\/V<sub>pl\.y\.Rd<\/sub>( \(at max M\))?$/.test(r.label));
  assert.equal(vRows.length, 2, 'two V_y.Ed/V_pl.y.Rd rows');
  assert.equal(vRows[0].tag, 'OK'); near3(vRows[0].res, r.utils[0].val, 'max shear ratio in the Shear Capacity block'); assert.ok(!/at max M/.test(vRows[0].label));
  // 20 Sep 2026 review: "(at max M)" sits in the label, as MasterSeries prints "Vy.Ed/Vpl.y.Rd (at max M) = 3.407/763.881 = 0.004 Low Shear" (was appended after the "=" of the values cell)
  assert.equal(vRows[1].tag, 'Low Shear'); assert.ok(/\(at max M\)$/.test(vRows[1].label) && / =$/.test(vRows[1].vals) && !/at max M/.test(vRows[1].vals));
  assert.ok(hs.indexOf('Shear Capacity Check') === hs.indexOf('Classification and Effective Area (EN 1993: 2006)') + 1, 'Shear Capacity Check right after Classification');
  assert.equal(row(html, /^In-span &delta; &le; Span\/360$/).tag, '<span class="ms-warn">Warning</span>');   // 20 Sep 2026: the SLS default became 1.0G + 1.0Q (deflection 1.242, was OK at 0.610 with Q only; msbWarn)
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
    assert.deepEqual(hs, ['Member Loading and Member Forces', 'Classification and Effective Area (EN 1993: 2006)', 'Shear Capacity Check', 'Local Capacity Check',
      'Web Transverse Forces (EN 1993-1-5 cl 6)', 'Compression Resistance N.b.Rd', 'Equivalent Uniform Moment Factors C1, C.mLT, C.mz, and C.my', 'Lateral Buckling Check M.b.Rd',
      // 20 Sep 2026 single-brief task: no 'Lateral Restraint Portions (restraint design forces)' block here - the two support torsional restraints of a
      // simply supported beam carry M_Ed = 0 (force 0), and MasterSeries prints no portion without an intermediate restraint (G3 item 15 rows print when a force exists)
      'Buckling Resistance', 'Deflection Check - Load Case 1 (SLS: 1.0G + 1.0Q)']);   // default SLS combination since 20 Sep 2026 (was 'SLS: Variable actions only (NA 2.23)', G = 0)
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
     'V<sub>pl\\.T\\.Rd</sub> = \\[', 'V<sub>Ed</sub>/V<sub>pl\\.T\\.Rd</sub>', 'k = k<sub>w</sub>\\.k<sub>zw</sub>\\.k<sub>&alpha;</sub>', 'M<sub>y</sub>/M<sub>b\\.Rd</sub> \\+ C<sub>mz</sub>', 'End torques',
     'Torq in Case \\d+ @ [\\d.]+ m: &theta;<sub>max</sub> &le; 2\\.00&deg;']   // 20 Sep 2026: the SLS twist prints in the Deflection block, MasterSeries "Torq in Case n" form (was the theta_ser row of the Torsion block)
      .forEach(l => assert.ok(row(html, new RegExp('^' + l)), m + ': missing torsion line ' + l));
    ['Torsion', 'V+T', 'LTB+T'].forEach(n => assert.ok(u.names.includes(n), m + ': unity cell ' + n));
    // 20 Sep 2026: torsion title line, the Torsion Shear Design sub-block and the twist line placed in the Deflection block
    assert.ok(html.includes('<div>Includes Design for Torsion with Span Warping, Ends Free to Warp</div>'), m + ': torsion title line');
    assert.ok(html.includes('<div class="ms-sub">Torsion Shear Design @ ') && html.includes('<div class="ms-sub">Torsion Bending Design @ '), m + ': torsion sub-blocks');
    const iTw = html.search(/Torq in Case \d+ @/), iDef = html.indexOf('Deflection Check - Load Case');
    assert.ok(iTw > iDef, m + ': twist line inside the Deflection block');
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
      // 20 Sep 2026: the MasterSeries SN006a form "C1 = fn(M, Zg, kwt) ... Ncci-sn006" (was 'C = fn(M1, M2, Mo, psi, mu) -> SN006a C' tagged Cantilever)
      const c1c = row(html, /^C<sub>1<\/sub> = fn\(M, Z<sub>g<\/sub>, &kappa;<sub>wt<\/sub>\)$/);
      assert.ok(c1c && c1c.tag === 'Ncci-sn006' && /"Cantilever end warping (free|fixed)"/.test(c1c.vals) && /&kappa;<sub>wt<\/sub> = \d\.\d{3}/.test(c1c.vals), m + ': SN006a C1 line ' + JSON.stringify(c1c));
      assert.equal(row(html, /^&chi;<sub>LT\.mod<\/sub>/).tag, 'f = 1 (cantilever)');
    } else {
      assert.ok(/End 1 v, v&prime;, &phi;, &phi;&prime; = 0; End 2 free/.test(row(html, /^L<sub>e<\/sub> = portion/).vals), 'cantilever root: all four LTB DOFs held (warping restrained by the preset), tip free');
      assert.equal(row(html, /^&chi;<sub>LT\.mod<\/sub>/).tag, 'f = 1 (cantilever)');
    }
  }
});

test('SHS: closed section not susceptible to LTB on both routes (the eigen route keeps its solved Mcr and lambda as information); C1 printed on both, as MasterSeries', () => {
  const s = render(CASES.shs, 'standard');
  const {html: hs2, hs: heads} = checkCommon(s, 'shs/standard');
  const na = row(hs2, /^M<sub>b\.Rd<\/sub> = M<sub>c\.y\.Rd<\/sub>$/);
  assert.ok(na && na.vals.includes('not susceptible to LTB') && na.tag === '6.3.2.1(2)');
  // 20 Sep 2026 review: MasterSeries SHS-L2 prints "C1 = ... -> 1.127 Uniform" for the box, so the C1 block is printed on both routes (was suppressed on the standard route only)
  assert.ok(heads.includes('Equivalent Uniform Moment Factor C1'), 'C1 block for the closed-form box');
  const c1s = row(hs2, /^C<sub>1<\/sub> = fn\(M<sub>1<\/sub>/); assert.ok(c1s && c1s.tag === 'Uniform' && c1s.res === '1.127', 'standard C1 row ' + JSON.stringify(c1s));
  assert.ok(hs2.includes('150 x 150 x 6.3 SHS [Hot-finished] [S275] D=150 B=150 t=6.3'), 'box section line');
  const e = render(CASES.shs, 'eigen');
  const {html: he, hs: headsE} = checkCommon(e, 'shs/eigen');
  assert.ok(row(he, /^M<sub>cr<\/sub> = FE eigenvalue/) && row(he, /^&lambda;&#772;<sub>LT<\/sub> = &radic;W/), 'FE Mcr and lambda rows kept as information');
  const naE = row(he, /^M<sub>b\.Rd<\/sub> = M<sub>c\.y\.Rd<\/sub>$/);   // 20 Sep 2026 review: the same "not susceptible" row as the standard route (was the chi_LT = 1 / chi_LT.mod pair)
  assert.ok(naE && naE.vals.includes('not susceptible to LTB') && naE.tag === '6.3.2.1(2)' && naE.vals === na.vals, 'eigen box row ' + JSON.stringify(naE));
  assert.equal(row(he, /^&chi;<sub>LT\.mod<\/sub>/), null, 'no chi_LT.mod row for the exempt box');
  assert.equal(row(he, /^&lambda;&#772;<sub>LT<\/sub> &le; &lambda;&#772;<sub>LT,0<\/sub>$/), null);
  assert.ok(headsE.includes('Equivalent Uniform Moment Factor C1') && row(he, /^C<sub>1<\/sub> = M<sub>cr<\/sub>\/M<sub>cr,uniform<\/sub>/), 'eigen C1 row');
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

test('single span with two intermediate restraints renders a three-row portion table (bay by bay) after the LTB block', () => {
  const r = render(CASES.threeBay, 'eigen');
  const {html, hs} = checkCommon(r, 'threeBay');
  assert.ok(hs.indexOf('Lateral Restraint Portions (bay by bay, fork ends)') === hs.indexOf('Lateral Buckling Check M.b.Rd') + 1);
  const tbl = html.match(/<table class="ms-combos"><thead><tr><th>Portion<\/th>.*?<\/table>/s)[0];
  assert.equal([...tbl.matchAll(/<tr><td class="num">\d<\/td>/g)].length, 3);
  assert.ok(/0 &ndash; 3\.5.*3\.5 &ndash; 7.*7 &ndash; 12/s.test(tbl));
  assert.ok(row(html, /^L<sub>e<\/sub> = portion/).vals.includes('End 1 v, &phi; = 0; End 2 v, &phi; = 0; lateral restraint points at x = 0, 3.5, 7, 12 m'), row(html, /^L<sub>e<\/sub> = portion/).vals);
  assert.ok(html.includes('<div class="ms-ends">End conditions: End 1: U<sub>x</sub> U<sub>y</sub> U<sub>z</sub> R<sub>x</sub> restrained (pinned in plane; LTB fork); End 2: U<sub>y</sub> U<sub>z</sub> R<sub>x</sub> restrained (pinned in plane; LTB fork) &mdash; simply supported</div>'), 'End conditions line under the title');
  assert.ok(row(html, /^C<sub>1<\/sub> = M<sub>cr<\/sub>\/M<sub>cr,uniform<\/sub>/), 'C1 line (bay or whole-member ratio for k_c)');
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
  assert.ok(Math.abs(run('msbKc(5)') - 1 / Math.sqrt(2.76)) < 1e-12, 'k_c floored at 1/sqrt(2.76) (G3 item 8)');
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
  const over = {family:'rhs', rhsKey:'300 x 100 x 8.0', restraint:'ltb', L:14, ends:E('ss'),
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
  const s = render({restraint:'ltb', eccOn:true, za:201, L:7, ends:E('ss'),
    loads:[{type:'point',pos:2.45,P:12,case:'G'},{type:'point',pos:2.45,P:32,case:'Q'}]}, 'standard');
  const {html} = checkCommon(s, 'offcentre-zg/standard');
  const mcr = row(html, /^M<sub>cr<\/sub> = Fn\(C<sub>1<\/sub>, L<sub>e<\/sub>/);
  assert.ok(/z<sub>g<\/sub> = \+201 mm entered &mdash; NOT applied/.test(mcr.vals), 'zg printed as not applied: ' + mcr.vals);
  assert.ok(mcr.tag.includes('BLOCKED'));
  assert.ok(s.unsupported.some(m => /C<sub>2<\/sub> only for the simply supported and fixed-ended/.test(m)) && !s.pass);
  assert.ok(html.includes('(NOT VERIFIED)') || html.includes('(FAIL)'));
});

// ---- UI half of the 19 Sep 2026 scope change: every preset and a custom guided case render in both Mcr methods ----
// reads the End 1 / End 2 rows of the Member Forces table: the last two cells are the reaction R and M
function forceRows(html) {
  const tbl = html.match(/<table class="ms-forces">.*?<\/table>/s)[0];
  return [...tbl.matchAll(/<tr>((?:<td class="num">.*?<\/td>)+)<\/tr>/g)].map(m => [...m[1].matchAll(/<td class="num">(.*?)<\/td>/g)].map(x => x[1]));
}
test('End conditions: the six presets and a custom guided case render in both Mcr methods with the End conditions line, the reaction cells per end type and no undefined/NaN', () => {
  const udl = L => [{type:'udl', x1:0, x2:L, w:10, case:'Q'}];
  const Q15 = [{id:'c1', label:'ULS: 1.5Q', factors:{G:0,Q:1.5,W:0,E:0}, sls:false, on:true}, {id:'s1', label:'SLS: Q', factors:{G:0,Q:1,W:0,E:0}, sls:true, on:true}];
  const isNum = s => /^-?\d+\.\d\d$/.test(s);
  const cases = [
    {p:'ss',            line:'End 1: U<sub>x</sub> U<sub>y</sub> U<sub>z</sub> R<sub>x</sub> restrained (pinned in plane; LTB fork); End 2: U<sub>y</sub> U<sub>z</sub> R<sub>x</sub> restrained (pinned in plane; LTB fork) &mdash; simply supported',
                        r1:[isNum, s => s === '&mdash;'], r2:[isNum, s => s === '&mdash;']},
    {p:'fixed-fixed',   line:'&mdash; fixed-fixed', r1:[isNum, isNum], r2:[isNum, isNum]},
    {p:'fixed-pinned',  line:'&mdash; fixed-pinned (propped cantilever)', r1:[isNum, isNum], r2:[isNum, s => s === '&mdash;']},
    {p:'cantilever',    line:'End 1: U<sub>x</sub> U<sub>y</sub> U<sub>z</sub> R<sub>x</sub> R<sub>y</sub> R<sub>z</sub> W restrained (fixed in plane; LTB laterally clamped, warping fixed); End 2: free (free in plane; LTB free) &mdash; cantilever',
                        r1:[isNum, isNum], r2:[s => s === 'free: none', s => s === '&mdash;']},
    {p:'guided-fixed',  line:'End 2: U<sub>y</sub> R<sub>x</sub> R<sub>y</sub> R<sub>z</sub> restrained (guided (R<sub>y</sub> held, U<sub>z</sub> free) in plane; LTB laterally clamped) &mdash; guided-fixed',
                        r1:[isNum, isNum], r2:[s => s === 'guided: M only', isNum]},
    {p:'pinned-guided', line:'&mdash; pinned-guided', r1:[isNum, s => s === '&mdash;'], r2:[s => s === 'guided: M only', isNum]},
    // custom: End 1 pinned but laterally clamped and warping-fixed, End 2 guided with U_x held too (axial path indeterminate)
    {p:'custom', ends:E('pinned-guided', {e1:{rz:true, warp:true}, e2:{ux:true}}),
                        line:'End 1: U<sub>x</sub> U<sub>y</sub> U<sub>z</sub> R<sub>x</sub> R<sub>z</sub> W restrained (pinned in plane; LTB laterally clamped, warping fixed); End 2: U<sub>x</sub> U<sub>y</sub> R<sub>x</sub> R<sub>y</sub> R<sub>z</sub> restrained (guided (R<sub>y</sub> held, U<sub>z</sub> free) in plane; LTB laterally clamped) &mdash; custom end conditions',
                        r1:[isNum, s => s === '&mdash;'], r2:[s => s === 'guided: M only', isNum]},
  ];
  for (const cs of cases) for (const m of ['eigen', 'standard']) {
    const tag = cs.p + '/' + m;
    const r = render({restraint:'ltb', L:6, ends: cs.ends || E(cs.p), loads:udl(6), combos:Q15}, m);
    const {html} = checkCommon(r, tag);   // no undefined/NaN, block order, unity bar, NOT VERIFIED rows
    const ends = html.match(/<div class="ms-ends">End conditions: (.*?)<\/div>/);
    assert.ok(ends && ends[1].includes(cs.line), tag + ': End conditions line: ' + (ends && ends[1]));
    const rows = forceRows(html);
    assert.equal(rows.length, 2, tag + ': two end rows');
    assert.ok(/^End 1, x = 0$/.test(rows[0][1]) && /^End 2, x = 6$/.test(rows[1][1]), tag + ': end labels ' + rows[0][1] + ' / ' + rows[1][1]);
    const c1 = rows[0].slice(-2), c2 = rows[1].slice(-2);
    assert.ok(cs.r1[0](c1[0]) && cs.r1[1](c1[1]), tag + ': End 1 reaction cells ' + JSON.stringify(c1));
    assert.ok(cs.r2[0](c2[0]) && cs.r2[1](c2[1]), tag + ': End 2 reaction cells ' + JSON.stringify(c2));
    // [hand-derived] fixed-fixed: M = -wL^2/12 = -1.5 x 10 x 36/12 = -45 at both ends (hogging negative at End 2 too);
    // guided-fixed: M_1 = -wL^2/3 = -180, M_2 = +wL^2/6 = +90 (sagging); pinned-guided: M_2 = +wL^2/2 = +270, R_1 = wL = 90
    if (cs.p === 'fixed-fixed') { assert.equal(c1[1], '-45.00'); assert.equal(c2[1], '-45.00'); assert.equal(c1[0], '45.00'); }
    if (cs.p === 'guided-fixed') { assert.equal(c1[1], '-180.00'); assert.equal(c2[1], '90.00'); assert.equal(c1[0], '90.00'); }
    if (cs.p === 'pinned-guided') { assert.equal(c1[0], '90.00'); assert.equal(c2[1], '270.00'); }
    if (cs.p === 'cantilever') { assert.equal(c1[0], '90.00'); assert.equal(c1[1], '-270.00'); }
  }
});

// ---- 20 Sep 2026 single-brief task (owner: "I see two briefs; it shall be one brief") ----
// render() on the EC3 path prints the verdict banner and the MasterSeries brief only; BS 5950 keeps the long report
const report = () => run(`(()=>{ const el={innerHTML:'',style:{}}; document.getElementById=()=>el; render(); return el.innerHTML; })()`);
test('EC3 report = banner + ONE brief: exactly one "Member Loading and Member Forces" heading, no "Detailed derivation", no second (CED) report', () => {
  for (const over of [{}, {restraint:'ltb'}, {restraint:'ltb', axial:300}, CASES.pfcEcc]) {
    c.reset(over);
    const h = report();
    assert.equal((h.match(/Member Loading and Member Forces/g) || []).length, 1, 'one Member Loading heading: ' + JSON.stringify(over));
    assert.ok(!/Detailed derivation|ms-detail|brief-title|report-head|diagcard|calcs-start|section-title/.test(h), 'no second report / details wrapper: ' + JSON.stringify(over));
    assert.ok(/<div class="banner /.test(h) && h.indexOf('class="banner') < h.indexOf('<div class="ms-brief'), 'banner above the brief');
    assert.equal((h.match(/<div class="ms-brief/g) || []).length, 1, 'one brief panel');
    assert.ok(!/undefined|NaN/.test(h));
  }
});
test('Compression Resistance N.b.Rd appears with axial compression only; the C_m factors heading follows the member-buckling interaction', () => {
  const withN = render({restraint:'ltb', axial:300}, 'standard'), noN = render({restraint:'ltb'}, 'standard'), tens = render({restraint:'ltb', axial:-300}, 'standard');
  assert.ok(headings(withN.html).includes('Compression Resistance N.b.Rd'), 'axial 300: block present');
  assert.ok(!headings(noN.html).includes('Compression Resistance N.b.Rd'), 'no axial: block absent');
  assert.ok(!headings(tens.html).includes('Compression Resistance N.b.Rd'), 'tension: block absent');
  // MasterSeries lines beam-v03 has no value for print the label with "n/a - not evaluated by beam-v03" (N_b.T.Rd of an I section), N.Ed/N.b.Rd is the lower flexural resistance
  const nbT = row(withN.html, /^L<sub>et<\/sub> = K<sub>t<\/sub>/); assert.ok(nbT && /n\/a - not evaluated by beam-v03/.test(nbT.vals) && nbT.tag === 'not evaluated');
  const nb = row(withN.html, /^N<sub>Ed<\/sub>\/N<sub>b\.Rd<\/sub>$/); assert.ok(nb, 'N.Ed/N.b.Rd line');
  near3(nb.res, Math.max(num(row(withN.html, /^U<sub>N\.y<\/sub>/).res), num(row(withN.html, /^U<sub>N\.z<\/sub>/).res)), 'N.Ed/N.b.Rd = max(U_N.y, U_N.z)');
  assert.ok(headings(withN.html).includes('Equivalent Uniform Moment Factors C1, C.mLT, C.mz, and C.my') && headings(noN.html).includes('Equivalent Uniform Moment Factor C1'));
  assert.ok(row(withN.html, /^k<sub>zy<\/sub> method$/), 'kzy method line');
  // tension: Axial with Moments brief, Buckling Resistance block states that cl 6.3.3 is not required
  assert.ok(tens.html.includes('Axial with Moments (Member)') && headings(tens.html).includes('Buckling Resistance') && /n\/a - not evaluated by beam-v03 \(N<sub>Ed<\/sub> is tensile/.test(tens.html));
  assert.ok(!row(noN.html, /^V<sub>z\.Ed<\/sub>/) && !row(withN.html, /^V<sub>z\.Ed<\/sub>/), 'no V_z / M_c.z lines without M_z');
});
test('torsion blocks and the torsion diagram (data-name="T") appear with eccentric loads only; the four / five diagrams carry data-xs and the hover names', () => {
  const tor = render(CASES.pfcEcc, 'standard'), plain = render({restraint:'ltb'}, 'standard'), box = render({family:'shs', shsKey:'150x150x6.3', restraint:'ltb', eccOn:true, L:4, ends:E('ss'), loads:[{type:'udl',x1:0,x2:4,w:10,case:'Q',e:40}]}, 'standard');
  const names = h => [...h.matchAll(/<svg class="diag diag-hover"[^>]*data-name="([^"]*)"/g)].map(m => m[1]);
  assert.deepEqual(names(tor.html), ['V', 'M', '\u03b4', 'T'], 'four hover diagrams with torsion');
  assert.deepEqual(names(plain.html), ['V', 'M', '\u03b4'], 'three hover diagrams without torsion');
  assert.equal((plain.html.match(/data-name="T"/g) || []).length, 0);
  assert.ok(tor.html.includes('Torsional moment T (kN.m, ') && !plain.html.includes('Torsional moment T'), 'torsion caption');
  assert.ok(headings(tor.html).includes('Torsion Design') && !headings(plain.html).includes('Torsion Design'));
  assert.ok(!/Includes Design for Torsion/.test(plain.html) && /Torq in Case/.test(tor.html) && !/Torq in Case/.test(plain.html));
  // every value diagram carries the sample arrays and the hidden hover group; the loading sketch precedes them inside the Member Loading block
  for (const h of [tor.html, plain.html, box.html]) {
    const svgs = [...h.matchAll(/<svg class="diag diag-hover"[^>]*>/g)].map(m => m[0]);
    assert.ok(svgs.length >= 3 && svgs.every(s => /data-xs="\[/.test(s) && /data-ys="\[/.test(s) && /data-unit="/.test(s)), 'data-xs on every diagram');
    assert.equal((h.match(/<g class="hover" style="display:none"/g) || []).length, svgs.length, 'one hover group per diagram');
    const iPanel = h.indexOf('<div class="ms-diagrams">'), iTable = h.indexOf('<table class="ms-forces">'), iCls = h.indexOf('Classification and Effective Area');
    assert.ok(iTable > 0 && iPanel > iTable && iPanel < iCls, 'diagram panel after the forces table, inside the Member Loading block');
    assert.ok(/<div class="ms-diag-full"><div class="ms-dt">Loading<\/div><svg class="diag"/.test(h), 'loading sketch full width first');
    assert.ok(h.indexOf('<div class="ms-diag-grid">') > iPanel && /hover over a diagram for the value at any point/.test(h), 'grid + italic note');
    assert.ok(!/on[a-z]+=|javascript:/.test(h), 'CSP-safe');
  }
  // hollow section: "Includes Design for Torsion" (no warping line), the box torsion form with its sub-blocks
  assert.ok(box.html.includes('<div>Includes Design for Torsion</div>') && !/Span Warping/.test(box.html), 'box title line');
  assert.ok(row(box.html, /^W<sub>t<\/sub> \(= C\)$/) && row(box.html, /^&tau;<sub>t\.Ed<\/sub> = T<sub>Ed<\/sub>\/W<sub>t<\/sub>$/) && /Modified Local Capacity/.test(box.html) && box.html.includes('<div class="ms-sub">Torsion Shear Design @ '), 'box torsion lines');
  assert.ok(row(box.html, /^M<sub>b\.Rd<\/sub> = M<sub>c\.y\.Rd<\/sub>$/), 'box: not susceptible line kept');
});
test('BS 5950 still renders its long report (no brief) and the EC3 hollow / restrained variants keep their blocks', () => {
  c.reset({code:'BS5950'});
  const h = report();
  assert.ok(/Classification and Properties \(BS 5950-1:2000\)/.test(h) && /Local Capacity Check \(Cl\. 4\.2\)/.test(h) && /Simplified Buckling Approach/.test(h) && /Deflection Check \(SLS/.test(h), 'BS 5950 report blocks');
  assert.ok(!/ms-brief|Member Forces in Load Case/.test(h), 'no MasterSeries brief on the BS 5950 path');
  assert.ok(h.includes('<h2>Member Loading and Member Forces</h2>') && /Shear force \(kN\)/.test(h), 'BS 5950 report head and diagrams');
  assert.ok(!/undefined|NaN/.test(h));
});

// ---- 20 Sep 2026 review fixes of the single-brief task ----
test('review fixes: eigen-route LTB notes are advisory rows of the LTB block, the buckled mode shape sits there too, the deflection caption names the combination once, the torque column is the total end torque', () => {
  const w = render({restraint:'ltb', leFactor:1.2}, 'eigen');
  const adv = rows(w.html).filter(r => r.label === 'Advisory');
  assert.ok(adv.length >= 1 && adv.every(r => r.tag === 'advisory'), 'advisory rows');
  assert.ok(adv.some(r => /L<sub>E<\/sub> factor does not affect EC3 LTB on the eigen route/.test(r.vals)), 'L_E factor note (LT.warn) printed');
  const iAdv = w.html.indexOf('ms-advrow');
  assert.ok(iAdv > w.html.indexOf('Lateral Buckling Check M.b.Rd') && iAdv < w.html.indexOf('Deflection Check'), 'inside the LTB block');
  const iMode = w.html.indexOf('<div class="ms-diag-full ms-mode">');
  assert.ok(iMode > w.html.indexOf('Lateral Buckling Check M.b.Rd') && iMode < w.html.indexOf('Deflection Check') && /Buckled mode shape/.test(w.html), 'mode shape in the LTB block');
  assert.ok(!/diag-hover/.test(w.html.slice(iMode, w.html.indexOf('</svg>', iMode))), 'the mode shape is not a hover diagram');
  const s = render({restraint:'ltb', leFactor:1.2}, 'standard');
  assert.ok(!/ms-mode/.test(s.html), 'no mode shape on the standard route');
  const rc = render({family:'rhs', rhsKey:'160 x 80 x 5.0', restraint:'ltb', L:3, ends:E('cantilever'), loads:[{type:'point',pos:3,P:5,case:'Q'}]}, 'eigen');
  assert.ok(rows(rc.html).some(r => r.label === 'Advisory' && /Warping flag at End 1 not applied/.test(r.vals)), 'warping-flag note of a closed section');
  assert.ok(w.html.includes('Deflection &delta; (mm, SLS: 1.0G + 1.0Q)') && !/SLS combination SLS:/.test(w.html), 'caption without the doubled SLS');
  // Torque Moment column = the total end torque T = GI_T phi' - EI_w phi''' (T.TEnds), signed, as MasterSeries prints the torque reaction
  c.reset(Object.assign({}, CASES.pfcEcc, {mcrMethod:'standard'}));
  const tq = run(`(()=>{ const a=analyse(); const ch=checks(a); return {html:renderMasterSeriesBrief(a,ch,a.sec), TEnds:ch.tor.TEnds, TtEnds:ch.tor.TtEnds}; })()`);
  const fr = forceRows(tq.html);
  assert.equal(fr[0][3], tq.TEnds[0].toFixed(2)); assert.equal(fr[1][3], tq.TEnds[1].toFixed(2));
  assert.ok(Math.abs(tq.TEnds[0]) > Math.abs(tq.TtEnds[0]) + 0.01, 'the total exceeds the St Venant part here: ' + tq.TEnds[0] + ' vs ' + tq.TtEnds[0]);
});
test('review fixes: unity-bar cells carry what the block rows print (N_c.Rd label with A_eff, UMyz = the U_M.y row, em dashes for the cl 6.3.3 cells of a tension brief); channel cantilever C1 printed as not used with the P362 basis', () => {
  const ae = render({restraint:'ltb', axial:300, Mz:30}, 'standard');
  const {u} = checkCommon(ae, 'aeff');
  assert.equal(u.names[0], 'N_Ed/N_(c.Rd)');
  near3(u.vals[0], num(row(ae.html, /^N<sub>Ed<\/sub>\/N<sub>c\.Rd<\/sub>$/).res), 'N_Ed/N_c.Rd cell = the block row');
  near3(u.vals[u.names.indexOf('UMyz')], Math.max(num(row(ae.html, /^U<sub>M\.y<\/sub>/).res), num(row(ae.html, /^U<sub>M\.z<\/sub>/).res)), 'UMyz = max(U_M.y, U_M.z) as printed');
  assert.ok(/W<sub>el\.y<\/sub>\/W<sub>pl\.y<\/sub> = /.test(row(ae.html, /^U<sub>M\.y<\/sub>/).vals), 'A_eff route active in this case');
  const pl = render({family:'uc', ucKey:'203 x 203 x 60', restraint:'ltb', axial:100}, 'standard');   // stocky web (d/t = 17): no A_eff
  assert.equal(unity(pl.html).names[0], 'N_Ed/N_(pl.Rd)', 'no A_eff: the N_pl.Rd label');
  assert.ok(row(pl.html, /^n = N<sub>Ed<\/sub>\/N<sub>pl\.Rd<\/sub>$/) && !row(pl.html, /^N<sub>Ed<\/sub>\/N<sub>c\.Rd<\/sub>$/));
  const tens = render({restraint:'ltb', axial:-200}, 'standard');
  const ut = unity(tens.html);
  ['UNyz', 'Ax+M_6.61', 'Ax+M_6.62'].forEach(n => assert.equal(ut.vals[ut.names.indexOf(n)], '&mdash;', n + ' not evaluated in tension'));
  near3(ut.vals[ut.names.indexOf('UMyz')], tens.ltbUtil, 'UMyz = LTB utilisation in tension');
  // PFC cantilever on the standard route: the P362 kappa chain uses no C1
  const pc = render({family:'pfc', sectionKey:'200x75x23', restraint:'ltb', L:3, ends:E('cantilever'), loads:[{type:'point',pos:3,P:20,case:'Q'}]}, 'standard');
  const c1 = row(pc.html, /^C<sub>1<\/sub> = fn\(M<sub>1<\/sub>/);
  assert.ok(c1 && c1.res === '&mdash;' && c1.tag === 'not used' && /P362 &kappa; chain/.test(c1.vals) && /channel cantilever/.test(c1.vals), JSON.stringify(c1));
  assert.equal(row(pc.html, /^C<sub>1<\/sub> basis$/).tag, 'P362');
  assert.equal(row(pc.html, /^&lambda;&#772;<sub>LT<\/sub> = \(L<sub>e<\/sub>\/i<sub>z<\/sub>\)\/&kappa;$/).tag, 'P362 channel');
  // a fork-ended PFC without torsion offers the shear-centre Mcr route, which does use C1: value and SN003a basis kept
  const pf = render({family:'pfc', sectionKey:'200x75x23', restraint:'ltb', L:4, ends:E('ss'), loads:[{type:'udl',x1:0,x2:4,w:5,case:'Q'}]}, 'standard');
  const c1f = row(pf.html, /^C<sub>1<\/sub> = fn\(M<sub>1<\/sub>/);
  assert.ok(c1f && c1f.res === '1.127' && c1f.tag === 'Uniform' && row(pf.html, /^M<sub>cr<\/sub> route \(load through the shear centre\)/), JSON.stringify(c1f));
  assert.equal(row(pf.html, /^C<sub>1<\/sub> basis$/).tag, 'SN003a');
});

// ---- 20 Sep 2026 torsion + N/Mz: combined torsion with N_Ed and an imposed M_z, verified as Eurocode advises ----
// The engine (js/checks/eurocode-checks.js) replaced the "Combined torsion with direct axial force or imposed minor-axis
// bending is not implemented as one interaction" block by the EN 1993-1-1 6.2.7(5) elastic yield criterion (6.1) at every
// torsion station (tor.elastic), Eq 6.61/6.62 and EN 1993-6 (A.1) with M_z,Ed = M_z + phi.M_y, the basis text
// tor.combinedBasis and the information-only superposition tor.superposition. The brief prints them in MasterSeries
// block order; every printed number below is read back against the check object.
const TORS_COMBOS = [
  { id: 'c1', label: 'ULS 1.35G+1.5Q', factors: { G: 1.35, Q: 1.5, W: 0, E: 0 }, sls: false, on: true },
  { id: 's1', label: 'SLS 1.0G+1.0Q', factors: { G: 1, Q: 1, W: 0, E: 0 }, sls: true, on: true }];
// UB 457x191x82 S275, 6 m, G 10 + Q 8 kN/m and Q 30 kN at 2 m, all at e = 40 mm (the UB6-L2 owner case of tests/torsion-axial-mz.test.cjs)
const UB6 = (extra) => Object.assign({ family: 'ub', ubKey: '457 x 191 x 82', grade: 'S275', L: 6, restraint: 'ltb', combos: TORS_COMBOS, eccOn: true, ends: E('ss'),
  loads: [{ type: 'udl', x1: 0, x2: 6, w: 10, case: 'G', e: 40, zg: 0 }, { type: 'udl', x1: 0, x2: 6, w: 8, case: 'Q', e: 40, zg: 0 }, { type: 'point', pos: 2, P: 30, case: 'Q', e: 40, zg: 0 }] }, extra || {});
const f2 = v => (Math.abs(v) < 5e-7 ? 0 : v).toFixed(2), f3 = v => (Math.abs(v) < 5e-7 ? 0 : v).toFixed(3);
const EL_ROW = /^Elastic yield criterion with torsion \(cl 6\.2\.7\(5\), Eq 6\.1\) @ /;
const SUP_LABEL = 'superposition of Eq 6.62 and (A.1) - not a Eurocode expression, information only';
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test('torsion + N_Ed + imposed M_z (e = 40, N = 300, M_z = 30): the (6.1) row with its stress build-up, the M_z,tot row, C_mz = 1.000 with its reason, the basis note, the information-only superposition row, no blocking text; both methods', () => {
  for (const m of ['standard', 'eigen']) {
    const r = render(UB6({axial: 300, Mz: 30}), m);
    const {html, hs, u} = checkCommon(r, 'ubTorNMz/' + m);
    const el = r.torE.elastic, T = r.torE, AN = r.annex, B = r.buck;
    assert.ok(el && T.combinedActive && T.superposition && AN && B && B.Fc > 0, m + ': engine fields present');
    // the old block is gone: no NOT VERIFIED / NOT COVERED anywhere, the title carries (FAIL) from the utilisations and the torsion line
    // (the web-bearing note's generic sentence "one failing at 0 is NOT VERIFIED until s_s is entered" is explanatory text, not a row or verdict)
    assert.ok(!/not implemented as one interaction/.test(html) && !/ms-nv|\(NOT VERIFIED\)|>NOT VERIFIED<|NOT COVERED/.test(html), m + ': no blocking row, title suffix, verdict or footer');
    assert.ok(/<div class="ms-verdict ms-failv">FAIL /.test(html), m + ': verdict FAIL (utilisations), not NOT VERIFIED');
    assert.equal(r.unsupported.length, 0);
    assert.ok(html.includes('<div>Axial with Moments (Member) (FAIL)</div><div>Includes Design for Torsion with Span Warping, Ends Free to Warp</div>'), m + ': title lines');
    assert.ok(hs.includes('Local Capacity Check') && hs.includes('Buckling Resistance') && hs.includes('Torsion Design'));
    // (6.1) row in the Local Capacity block after the plastic N-M-Mz interaction row, before Web Transverse Forces
    const rw = rows(html), iEl = rw.findIndex(x => EL_ROW.test(x.label)), iPl = rw.findIndex(x => /^\(M<sub>y\.Ed<\/sub>\/M<sub>N\.y\.Rd<\/sub>\)<sup>&alpha;<\/sup>/.test(x.label));
    assert.ok(iEl > iPl && iPl >= 0, m + ': (6.1) row after the 6.2.9 interaction row');
    assert.ok(html.indexOf('Elastic yield criterion with torsion') < html.indexOf('Web Transverse Forces (EN 1993-1-5 cl 6)'), m + ': (6.1) row inside the Local Capacity block');
    const e1 = rw[iEl];
    assert.equal(el.point, 'P1 flange tip');
    assert.ok(e1.label.endsWith(' m, ' + el.point) && e1.label.includes('@ ' + run('msbM(' + el.x / 1000 + ')') + ' m'), m + ': governing station / point in the label: ' + e1.label);
    near3(e1.res, el.u, m + ': (6.1) value = c.tor.elastic.u'); assert.ok(/Warning/.test(e1.tag) && /6\.2\.7\(5\)/.test(e1.tag), m + ': tag ' + e1.tag);
    assert.ok(e1.vals.includes('M<sub>z,tot</sub> = M<sub>z.Ed</sub> + &phi;M<sub>y</sub> = ' + f3(el.MzImp) + ' + ' + f3(el.MzTwist) + ' = ' + f3(el.MzTot) + ' kN.m'), m + ': M_z,tot at the station: ' + e1.vals);
    assert.ok(e1.vals.includes('&sigma;<sub>x</sub> = N/A + M<sub>y</sub>/W<sub>el.y</sub> + M<sub>z,tot</sub>/W<sub>el.z</sub> + EW<sub>n0</sub>&phi;&Prime; = ' + f2(el.sigmaN) + ' + ' + f2(el.sigmaMy) + ' + ' + f2(el.sigmaMz) + ' + ' + f2(el.sigmaW) + ' = ' + f2(el.sigmaX) + ' N/mm&sup2;'), m + ': sigma build-up: ' + e1.vals);
    assert.ok(e1.vals.includes('&tau; = Gt<sub>f</sub>&phi;&prime; = ' + f2(el.tau) + ' N/mm&sup2;; (' + f2(el.sigmaX) + '/' + el.fy + ')&sup2; + 3(' + f2(el.tau) + '/' + el.fy + ')&sup2; ='), m + ': tau and the (6.1) expression: ' + e1.vals);
    assert.ok(e1.vals.includes('&phi;&Prime; = ' + Math.abs(el.p2).toExponential(3) + ' rad/mm&sup2;'), m + ': phi\'\' printed for the hand check');
    // hand check of the printed governing point from the engine's own components (sigma_x = sum, (6.1) = (sigma/fy)^2 + 3(tau/fy)^2)
    assert.ok(Math.abs(el.sigmaN + el.sigmaMy + el.sigmaMz + el.sigmaW - el.sigmaX) < 1e-9 && Math.abs(Math.pow(el.sigmaX / el.fy, 2) + 3 * Math.pow(el.tau / el.fy, 2) - el.u) < 1e-12);
    // the indented points row: all four points, the engine's sums and values, the governing one marked
    const pr = rw[iEl + 1];
    assert.ok(/^&sigma;<sub>x<\/sub>, &tau;, \(6\.1\) at the 4 section points$/.test(pr.label) && html.includes('<div class="ms-row ms-pts">'), m + ': points row');
    el.points.forEach(p => assert.ok(pr.vals.includes(p.point + ': &sigma;<sub>x</sub> = ') && pr.vals.includes('= ' + f2(p.sigmaX) + ', &tau; = ') && pr.vals.includes(' &rarr; ' + f3(p.u)), m + ': point ' + p.point + ' in ' + pr.vals));
    assert.ok(pr.vals.includes(' &rarr; ' + f3(el.u) + ' (governs)'));
    // Torsion Design block: M_z,tot row = imposed + max coincident phi.M_y, the 3.1.2 row with M_z,tot, C_mz = 1.000 and its reason, (A.1) with M_z,tot
    const mz = row(html, /^M<sub>z,tot<\/sub> = M<sub>z\.Ed<\/sub> \+ &phi;\.M<sub>y\.Ed<\/sub>$/);
    assert.ok(mz && mz.vals.startsWith(f3(T.MzImp) + ' + ') && mz.vals.includes(' = ' + f3(T.MzImp) + ' + ' + f3(T.MzMax) + ' (imposed constant'), m + ': M_z,tot row: ' + (mz && mz.vals));
    near3(mz.res, T.MzTot, m + ': M_z,tot = c.tor.MzTot'); assert.equal(mz.tag, 'P385 3.1.2');
    assert.equal(row(html, /^M<sub>z\.Ed<\/sub> = &phi;\.M<sub>y\.Ed<\/sub>$/), null, m + ': the plain phi.M_y row is replaced');
    const cr = row(html, /^\(M<sub>y<\/sub>\/M<sub>pl\.y<\/sub>\)&sup2; \+ M<sub>w<\/sub>\/M<sub>pl\.f<\/sub> \+ M<sub>z,tot<\/sub>\/M<sub>pl\.z<\/sub>$/);
    assert.ok(cr && cr.vals.includes(f3(T.cross.MzTot) + ' kN.m (M<sub>z,tot</sub> = ' + f3(T.cross.MzImp) + ' + ' + f3(T.cross.Mz) + ')'), m + ': 3.1.2 row carries M_z,tot: ' + (cr && cr.vals));
    near3(cr.res, T.cross.u, m + ': 3.1.2 value');
    const cmz = row(html, /^C<sub>mz<\/sub> \(EN 1993-6 A\.1\)$/);
    assert.ok(cmz && cmz.res === '1.000' && cmz.vals === AN.CmzBasis && /constant diagram/.test(cmz.vals) && cmz.tag === 'Table B.3', m + ': C_mz reason row: ' + JSON.stringify(cmz));
    const an = row(html, /^M<sub>y<\/sub>\/M<sub>b\.Rd<\/sub> \+ C<sub>mz<\/sub>M<sub>z,tot<\/sub>\/M<sub>z\.Rk<\/sub>/);
    const anMz = '(M<sub>z,tot</sub> = ' + f3(AN.MzImp) + ' imposed + ' + f3(AN.MzTwist) + ' twist';
    assert.ok(an && an.vals.includes('1.000x' + f3(AN.Mz) + '/' + f3(AN.MzR)) && an.vals.includes(anMz), m + ': (A.1) row with M_z,tot: ' + (an && an.vals));
    near3(an.res, AN.u, m + ': (A.1) value');
    assert.ok(row(html, /^k = k<sub>w<\/sub>/).vals.includes('k<sub>zw</sub> = 1 &minus; M<sub>z,tot</sub>/M<sub>z.Rk</sub> = 1 &minus; ' + f3(AN.MzTot) + '/' + f3(AN.MzR)), m + ': k_zw with M_z,tot');
    // basis note (engine text) and the information-only superposition row labelled as the engine labels it, class ms-advrow, no OK / Warning
    const bs = row(html, /^Basis with N<sub>Ed<\/sub> \/ M<sub>z\.Ed<\/sub>$/);
    assert.ok(bs && bs.vals === T.combinedBasis && /No expression in EN 1993-1-1 or EN 1993-6 combines N_Ed with warping torsion at member level/.test(bs.vals), m + ': basis note');
    const sp = row(html, new RegExp('^' + esc(SUP_LABEL) + '$'));
    assert.ok(sp, m + ': superposition row'); assert.equal(T.superposition.label, SUP_LABEL);
    near3(sp.res, T.superposition.u, m + ': superposition value'); assert.equal(sp.tag, 'information only');
    assert.ok(sp.vals.includes(' = ' + f3(T.superposition.u62) + ' (Eq 6.62 with M<sub>z,tot</sub> = ' + f3(B.MzEd) + ') + ' + f3(T.superposition.uw) + ' (warping term of (A.1)'), m + ': superposition parts: ' + sp.vals);
    assert.ok(new RegExp('<div class="ms-row ms-advrow"><div class="ms-l">' + esc(SUP_LABEL)).test(html), m + ': ms-advrow class');
    assert.ok(!/OK|Warning/.test(sp.tag), m + ': no verdict tag on the advisory');
    assert.ok(!r.utils.some(x => /superposition/i.test(x.name)), m + ': the superposition is not a utilisation');
    assert.ok(html.includes('<b>ADVISORY:</b> superposition of Eq 6.62 and (A.1)') && !html.includes('<b>ADVISORY:</b> ADVISORY - '), m + ': footer advisory once, not prefixed twice');
    // Buckling Resistance: U_M.z and C_mz print M_z,Ed as imposed + twist = total
    const umz = row(html, /^U<sub>M\.z<\/sub> = /);
    assert.ok(umz && umz.vals === '(' + f3(B.MzImp) + ' imposed + ' + f3(B.MzTwist) + ' twist &phi;.M<sub>y</sub> = ' + f3(B.MzEd) + ') / ' + f3(B.Mcz), m + ': U_M.z row: ' + (umz && umz.vals));
    near3(umz.res, B.mzTerm, m + ': U_M.z');
    assert.ok(Math.abs(B.MzEd - (B.MzImp + B.MzTwist)) < 1e-9 && B.MzImp === 30 && B.MzTwist > 0);
    const cm = row(html, /^C<sub>mz<\/sub> = Max/);
    // 20 Sep 2026 review: psi = 1 is stated for the imposed constant part only; the twist part is taken at the Table B.3 upper bound
    assert.equal(cm.vals, 'M<sub>z.Ed</sub> = ' + f3(B.MzImp) + ' imposed + ' + f3(B.MzTwist) + ' twist &phi;.M<sub>y</sub> = ' + f3(B.MzEd) + '; &psi; = 1 for the imposed constant M<sub>z</sub>, the twist part taken at C<sub>mz</sub> = 1.0 (Table B.3 upper bound, conservative)'); assert.equal(cm.res, '1.000');
    // 20 Sep 2026 review: the (6.1) check binds the verdict here (open Class 1 section with N_Ed) and its basis row says so
    assert.equal(el.binding, true);
    const eb = row(html, /^Elastic verification \(6\.1\): verdict-binding$/);
    assert.ok(eb && eb.vals === el.bindingBasis && /N_Ed/.test(eb.vals) && eb.tag === '6.2.7(5)', m + ': binding basis row: ' + JSON.stringify(eb));
    assert.ok(r.info.length === 0, m + ': nothing informational');
    // unity bar: the "Yield 6.1" cell = the (6.1) utilisation, which governs here (Max)
    assert.ok(u.names.includes('Yield 6.1'), m + ': Yield 6.1 cell');
    near3(u.vals[u.names.indexOf('Yield 6.1')], r.utils.find(x => /^Elastic yield criterion \(6\.1\)/.test(x.name)).val, m + ': Yield 6.1 value');
    assert.ok(u.names.indexOf('Yield 6.1') === u.names.indexOf('Torsion') + 1 && u.names.indexOf('V+T') === u.names.indexOf('Yield 6.1') + 1, m + ': cell order Torsion, Yield 6.1, V+T');
    assert.ok(/governing Elastic yield criterion \(6\.1\) with torsion, cl 6\.2\.7\(5\) = /.test(html), m + ': governing check named in the verdict');
  }
});

test('torsion only (e = 40, N = 0, M_z = 0): the (6.1) row prints for INFORMATION (Class 1, N = 0: the 6.2.7(6) plastic route governs, 20 Sep 2026 review) with M_z = phi.M_y, no "imposed" wording, no basis / superposition rows, every other torsion row unchanged; both methods', () => {
  for (const m of ['standard', 'eigen']) {
    const r = render(UB6(), m);
    const {html, u} = checkCommon(r, 'ubTor0/' + m);
    const el = r.torE.elastic, T = r.torE;
    assert.ok(el && !T.combinedActive && T.superposition == null && T.MzImp === 0, m + ': engine fields');
    assert.ok(r.pass && html.includes('<div>Beam &amp; Beam-Portion (Member)</div><div>Includes Design for Torsion with Span Warping, Ends Free to Warp</div>'), m + ': passing torsion-only brief');
    const e1 = row(html, EL_ROW);
    assert.ok(e1, m + ': (6.1) row present with N = 0 and M_z = 0'); near3(e1.res, el.u, m + ': (6.1) value'); assert.equal(e1.tag, '&le; 1 information 6.2.7(5)');
    assert.equal(el.binding, false); assert.ok(!r.utils.some(x => /^Elastic yield criterion/.test(x.name)) && r.info.some(x => /^Elastic yield criterion/.test(x.name)), m + ': (6.1) in c.info, not c.utils');
    const eb = row(html, /^Elastic verification \(6\.1\): information only$/);
    assert.ok(eb && eb.vals === el.bindingBasis && /6\.2\.7\(6\)/.test(eb.vals) && eb.tag === '6.2.7(5)-(6)', m + ': information basis row: ' + JSON.stringify(eb));
    assert.ok(e1.vals.includes('M<sub>z</sub> = &phi;M<sub>y</sub> = ' + f3(el.MzTwist) + ' kN.m') && e1.vals.includes('&sigma;<sub>x</sub> = N/A + M<sub>y</sub>/W<sub>el.y</sub> + M<sub>z</sub>/W<sub>el.z</sub> + EW<sub>n0</sub>&phi;&Prime; = 0.00 + ' + f2(el.sigmaMy) + ' + ' + f2(el.sigmaMz) + ' + ' + f2(el.sigmaW) + ' = ' + f2(el.sigmaX)), m + ': build-up with N/A = 0: ' + e1.vals);
    assert.ok(row(html, /^&sigma;<sub>x<\/sub>, &tau;, \(6\.1\) at the 4 section points$/), m + ': points row');
    assert.ok(!/imposed/.test(html), m + ': no "imposed" wording');
    assert.equal(row(html, /^Basis with N<sub>Ed<\/sub>/), null, m + ': no basis row'); assert.equal(row(html, /superposition of Eq 6\.62/), null, m + ': no superposition row');
    assert.ok(!/ms-advrow"><div class="ms-l">superposition/.test(html) && !/M<sub>z,tot<\/sub>/.test(html), m + ': no M_z,tot wording');
    assert.equal(row(html, /^C<sub>mz<\/sub> \(EN 1993-6 A\.1\)$/), null, m + ': no C_mz reason row without an imposed M_z');
    // the pre-existing torsion rows print as before (values = the engine's, unchanged since c2e9fba per tests/torsion-axial-mz.test.cjs)
    const mz = row(html, /^M<sub>z\.Ed<\/sub> = &phi;\.M<sub>y\.Ed<\/sub>$/);
    assert.ok(mz && mz.vals === 'max coincident', m + ': phi.M_y row unchanged'); near3(mz.res, T.MzMax, m + ': phi.M_y max');
    const cr = row(html, /^\(M<sub>y<\/sub>\/M<sub>pl\.y<\/sub>\)&sup2; \+ M<sub>w<\/sub>\/M<sub>pl\.f<\/sub> \+ M<sub>z<\/sub>\/M<sub>pl\.z<\/sub>$/);
    assert.ok(cr && cr.vals.includes(f3(T.cross.Mz) + ' kN.m; M<sub>pl.y</sub>'), m + ': 3.1.2 row unchanged: ' + (cr && cr.vals)); near3(cr.res, T.cross.u, m + ': 3.1.2 value');
    const an = row(html, /^M<sub>y<\/sub>\/M<sub>b\.Rd<\/sub> \+ C<sub>mz<\/sub>M<sub>z<\/sub>\/M<sub>z\.Rk<\/sub>/);
    assert.ok(an && !/imposed|z,tot/.test(an.vals), m + ': (A.1) row unchanged'); near3(an.res, r.annex.u, m + ': (A.1) value');
    assert.ok(!/k<sub>zw<\/sub> = 1 &minus;/.test(row(html, /^k = k<sub>w<\/sub>/).vals), m + ': k_zw note only with an imposed M_z');
    assert.ok(u.names.includes('Yield 6.1 (info)') && !u.names.includes('Yield 6.1') && !html.includes('Buckling Resistance'), m + ': Yield 6.1 (info) cell; no Buckling block without N / M_z');
    near3(u.vals[u.names.indexOf('Yield 6.1 (info)')], el.u, m + ': Yield 6.1 (info) value');
    assert.ok(!/governing Elastic yield criterion/.test(html), m + ': an informational value never governs');
    if (m === 'standard') { assert.equal(e1.res, '0.710'); near3(u.vals[u.vals.length - 1], 0.897, 'Max = Annex A 0.897 (UB6-L2 owner case; 0.890 before the 20 Sep 2026 M_f,Rd = t_f b^2 f_y/4 correction)'); }
  }
});

test('torsion + N_Ed without M_z, fully restrained, and a hollow section: basis row and superposition (k_alpha = 1 with no LTB check) print; the SHS prints the corner / web / flange points, M_z,tot and the basis, no superposition', () => {
  // N only: U_M.z prints "0.000 imposed + twist", the superposition row exists (N_Ed > 0), no C_mz reason row (nothing imposed)
  const n = render(UB6({axial: 300}), 'standard');
  const {html: hn} = checkCommon(n, 'ubTorN');
  assert.ok(row(hn, EL_ROW) && row(hn, /^Basis with N<sub>Ed<\/sub>/) && row(hn, /superposition of Eq 6\.62/), 'N only: (6.1), basis, superposition rows');
  assert.equal(row(hn, /^C<sub>mz<\/sub> \(EN 1993-6 A\.1\)$/), null, 'N only: no C_mz reason row');
  assert.ok(row(hn, /^U<sub>M\.z<\/sub> = /).vals.startsWith('(0.000 imposed + ' + f3(n.buck.MzTwist) + ' twist'), 'N only: U_M.z split');
  assert.ok(row(hn, /^M<sub>z\.Ed<\/sub> = &phi;\.M<sub>y\.Ed<\/sub>$/), 'N only: plain phi.M_y row (nothing imposed)');
  // fully restrained with N and M_z: no Annex A, superposition with k_alpha = 1 flagged, (6.1) row and basis present
  const f = render(UB6({axial: 300, Mz: 30, restraint: 'full'}), 'standard');
  const {html: hf, u: uf} = checkCommon(f, 'ubTorFull');
  assert.ok(row(hf, EL_ROW) && row(hf, /^Basis with N<sub>Ed<\/sub>/), 'full: (6.1) and basis rows');
  const spf = row(hf, /superposition of Eq 6\.62/);
  assert.ok(spf && /k<sub>&alpha;<\/sub> = 1\.000 \(no LTB check: M<sub>cr<\/sub> unbounded\)/.test(spf.vals) && spf.tag === 'information only', 'full: superposition with k_alpha = 1: ' + (spf && spf.vals));
  near3(spf.res, f.torE.superposition.u, 'full: superposition value'); assert.equal(f.annex, null);
  assert.ok(uf.names.includes('Yield 6.1') && !uf.names.includes('LTB+T'), 'full: cells'); assert.equal(f.torE.elastic.binding, true);
  assert.ok(/6\.61\/6\.62/.test(f.torE.combinedBasis) && /\(A\.1\) is not evaluated for a fully restrained member/.test(f.torE.combinedBasis) && row(hf, /^Basis with N<sub>Ed<\/sub>/).vals === f.torE.combinedBasis, 'full: basis row = the restrained-path text');
  // SHS with N and M_z: three points, tau_t = T_Ed/W_t, M_z,tot row of the St Venant twist, basis row, no superposition (open sections only)
  const s = render({family: 'shs', shsKey: '150x150x6.3', restraint: 'ltb', eccOn: true, L: 4, axial: 200, Mz: 5, ends: E('ss'), loads: [{type: 'udl', x1: 0, x2: 4, w: 10, case: 'Q', e: 40}]}, 'standard');
  const {html: hs} = checkCommon(s, 'shsTorNMz');
  const es = s.torE.elastic, e1 = row(hs, EL_ROW);
  assert.ok(es && es.box && e1 && e1.label.endsWith(', ' + es.point), 'SHS: (6.1) row: ' + (e1 && e1.label)); near3(e1.res, es.u, 'SHS: (6.1) value');
  // 20 Sep 2026 review: the corner carries the closed-section shear flow V Q_c/(I_y t) (Eq 6.20); the Q_c / Q_m values print with the points row
  assert.ok(/&sigma;<sub>x<\/sub> = N\/A \+ M<sub>y<\/sub>\/W<sub>el\.y<\/sub> \+ M<sub>z,tot<\/sub>\/W<sub>el\.z<\/sub> = /.test(e1.vals) && /&tau; = T<sub>Ed<\/sub>\/W<sub>t<\/sub> \+ VQ<sub>c<\/sub>\/\(I<sub>y<\/sub>t\) = /.test(e1.vals), 'SHS: corner build-up: ' + e1.vals);
  assert.equal(es.binding, false); assert.equal(e1.tag, es.u > 1.0001 ? '<span class="ms-warn">&gt; 1</span> information 6.2.7(5)' : '&le; 1 information 6.2.7(5)');
  assert.ok(row(hs, /^Elastic verification \(6\.1\): information only$/).vals === es.bindingBasis && /hollow section/.test(es.bindingBasis), 'SHS: information basis row');
  assert.ok(s.info.some(x => /^Elastic yield criterion/.test(x.name)) && !s.utils.some(x => /^Elastic yield criterion/.test(x.name)), 'SHS: (6.1) in c.info');
  const us = unity(hs); assert.ok(us.names.includes('Yield 6.1 (info)') && !us.names.includes('Yield 6.1'), 'SHS: Yield 6.1 (info) cell'); near3(us.vals[us.names.indexOf('Yield 6.1 (info)')], es.u, 'SHS: info cell value');
  const ps = row(hs, /^&sigma;<sub>x<\/sub>, &tau;, \(6\.1\) at the 3 section points$/);
  assert.ok(ps && /corner: /.test(ps.vals) && /web mid-depth: /.test(ps.vals) && /flange mid-width: /.test(ps.vals) && /Q<sub>c<\/sub> = 32\.5, Q<sub>m<\/sub> = 48\.8 cm&sup3;/.test(ps.vals), 'SHS: three points with Q_c / Q_m: ' + (ps && ps.vals));
  const mzs = row(hs, /^M<sub>z,tot<\/sub> = M<sub>z\.Ed<\/sub> \+ &phi;\.M<sub>y\.Ed<\/sub>$/);
  assert.ok(mzs && mzs.vals.startsWith('5.000 + ' + f3(s.torE.MzTwistMax)) && mzs.tag === 'P385 3.1.2 / 5.2.1(3)', 'SHS: M_z,tot row (20 Sep 2026 review: phi.M_y is the P385 second-order term, not a 6.2.7(5) quantity): ' + (mzs && mzs.vals + ' | ' + mzs.tag)); near3(mzs.res, s.torE.MzTot, 'SHS: M_z,tot');
  assert.ok(row(hs, /^Basis with N<sub>Ed<\/sub>/) && !row(hs, /superposition of Eq 6\.62/) && s.torE.superposition == null, 'SHS: basis, no superposition');
  assert.ok(/6\.2\.8\(4\) &rho; in 6\.2\.9\.1\/6\.2\.10 checks are the verdict basis; the elastic \(6\.1\) check is printed for information/.test(row(hs, /^Modified Local Capacity/).vals), 'SHS: modified-local-capacity note names the plastic route and the informational (6.1): ' + row(hs, /^Modified Local Capacity/).vals);
  assert.ok(/^EN 1993-1-1 6\.2\.7\(7\): warping neglected/.test(s.torE.combinedBasis) && /does not apply to a closed section/.test(s.torE.combinedBasis) && row(hs, /^Basis with N<sub>Ed<\/sub>/).vals === s.torE.combinedBasis, 'SHS: hollow-section basis text (no warping / (A.1) wording): ' + s.torE.combinedBasis);
  assert.ok(row(hs, /^U<sub>M\.z<\/sub> = /).vals.startsWith('(5.000 imposed + '), 'SHS: U_M.z split');
});

test('msbElasticTerms / msbElasticSum: the printed formula terms are exactly the engine components of each point (I/H, channel, box)', () => {
  const t = (p, el) => run('(()=>{ const t=msbElasticTerms(' + JSON.stringify(p) + ',' + JSON.stringify(el) + '); return JSON.stringify({s:t.sig.map(q=>q.k), a:t.tau.map(q=>q.k)}); })()');
  const ih = {box: false, MzImp: 0, geom: {chan: false}}, ch = {box: false, MzImp: 1, geom: {chan: true}}, bx = {box: true, MzImp: 0, geom: {}};
  assert.equal(t({point: 'P1 flange tip'}, ih), '{"s":["sigmaN","sigmaMy","sigmaMz","sigmaW"],"a":["tauT"]}');
  assert.equal(t({point: 'P2 web-flange junction, flange'}, ih), '{"s":["sigmaN","sigmaMy","sigmaMz"],"a":["tauV","tauT","tauW"]}');   // W_n2 = 0 for I/H: no sigma_w term printed; V S_f/(2 I_y t_f) flange shear flow (20 Sep 2026 review)
  assert.equal(t({point: 'P3 web-flange junction, web'}, ih), '{"s":["sigmaN","sigmaMy","sigmaMz"],"a":["tauV","tauT"]}');
  assert.equal(t({point: 'P4 web mid-depth'}, ih), '{"s":["sigmaN","sigmaMz"],"a":["tauV","tauT"]}');
  assert.equal(t({point: 'P2 web-flange junction, flange'}, ch), '{"s":["sigmaN","sigmaMy","sigmaMz","sigmaW"],"a":["tauV","tauT","tauW"]}');   // channel: W_n2, S_w2, S_w3 terms, V S_f/(I_y t_f)
  assert.equal(t({point: 'P1b flange at W_n = 0'}, ch), '{"s":["sigmaN","sigmaMy","sigmaMz"],"a":["tauV","tauT","tauW"]}');   // channel P1b: S_w1, no sigma_w (20 Sep 2026 review)
  assert.ok(/ES<sub>w2<\/sub>/.test(run('msbElasticTerms({point:"P2 web-flange junction, flange"},{box:false,MzImp:0,geom:{chan:true}}).tau[2].l')) && /ES<sub>w1<\/sub>/.test(run('msbElasticTerms({point:"P2 web-flange junction, flange"},{box:false,MzImp:0,geom:{chan:false}}).tau[2].l')), 'P2 tau_w label: S_w2 channel, S_w1 I/H');
  assert.ok(/VS<sub>f<\/sub>\/\(2I<sub>y<\/sub>t<sub>f<\/sub>\)/.test(run('msbElasticTerms({point:"P2 web-flange junction, flange"},{box:false,MzImp:0,geom:{chan:false}}).tau[0].l')) && /VS<sub>f<\/sub>\/\(I<sub>y<\/sub>t<sub>f<\/sub>\)/.test(run('msbElasticTerms({point:"P2 web-flange junction, flange"},{box:false,MzImp:0,geom:{chan:true}}).tau[0].l')), 'P2 tau_V label: half flange I/H, whole flange channel');
  assert.equal(t({point: 'P3 web-flange junction, web'}, ch), '{"s":["sigmaN","sigmaMy","sigmaMz","sigmaW"],"a":["tauV","tauT","tauW"]}');
  assert.equal(t({point: 'P4 web mid-depth'}, ch), '{"s":["sigmaN","sigmaMz"],"a":["tauV","tauT","tauW"]}');
  assert.equal(t({point: 'corner'}, bx), '{"s":["sigmaN","sigmaMy","sigmaMz"],"a":["tauT","tauV"]}');   // V Q_c/(I_y t) (20 Sep 2026 review)
  assert.equal(t({point: 'web mid-depth'}, bx), '{"s":["sigmaN","sigmaMz"],"a":["tauT","tauV"]}');
  assert.ok(/VQ<sub>c<\/sub>/.test(run('msbElasticTerms({point:"corner"},{box:true,MzImp:0,geom:{}}).tau[1].l')) && /VQ<sub>m<\/sub>/.test(run('msbElasticTerms({point:"web mid-depth"},{box:true,MzImp:0,geom:{}}).tau[1].l')), 'box shear-flow labels');
  assert.equal(t({point: 'flange mid-width'}, bx), '{"s":["sigmaN","sigmaMy"],"a":["tauT"]}');
  assert.ok(/M<sub>z,tot<\/sub>/.test(run('msbElasticTerms({point:"P1 flange tip"},{box:false,MzImp:1,geom:{chan:false}}).sig[2].l')) && /^M<sub>z<\/sub>\//.test(run('msbElasticTerms({point:"P1 flange tip"},{box:false,MzImp:0,geom:{chan:false}}).sig[2].l')), 'M_z,tot label only with an imposed M_z');
  assert.equal(run('msbElasticSum({sigmaN:1.234,sigmaMy:2.5},[{l:"N/A",k:"sigmaN"},{l:"M/W",k:"sigmaMy"}],3.734)'), 'N/A + M/W = 1.23 + 2.50 = 3.73');
  assert.equal(run('msbElasticSum({tauT:12.341},[{l:"Gt&phi;&prime;",k:"tauT"}],12.341)'), 'Gt&phi;&prime; = 12.34');
});
