// 19 Sep 2026 gap closure, group G4 (docs/COVERAGE_MATRIX.md section 5, P2 item
// 11 / trigger 2.6): general warping-torsion FE for open sections,
// E I_w phi'''' - G I_T phi'' = m_t(x), js/checks/torsion-fe.js. Expected values
// are hand derived from the section constants and the classical closed forms
// ([hand-derived] in the comments); the P385 Appendix C forms of p385Solve are
// used as the independent reference for the fork-fork cases.
//
// 457x191x82 (SCI P385 Table A.1): I_T = 69.2 cm4, I_w = 0.922 dm6, E = 210000,
// G = 81000: G I_T = 81000 x 69.2e4 = 5.6052e10 N.mm2, E I_w = 1.9362e17 N.mm4,
// a = sqrt(E I_w / G I_T) = 1858.57 mm.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { app } = require('./harness.cjs');
const c = app();
const run = x => c.run(x);
function near(actual, expected, rel = 1e-6, what = '') { assert.ok(Math.abs(actual - expected) <= rel * Math.max(1e-300, Math.abs(expected)), `${what} ${actual} != ${expected} (rel ${Math.abs(actual - expected) / Math.abs(expected)})`); }
const MX = 'const mx=a=>Math.max(...a.map(Math.abs));';
const UB = `${MX} S.family='ub'; S.ubKey='457 x 191 x 82'; const sec=activeSection(); const IT=sec.tp.IT*1e4, Iw=sec.tp.Iw*1e12, GIt=81000*IT, EIw=210000*Iw, aa=Math.sqrt(EIw/GIt);`;
const full = () => run(`(()=>{ const a=analyse(); const ch=checks(a); return {a:{torsO:a.torsO&&{ok:a.torsO.ok,method:a.torsO.method,methodLabel:a.torsO.methodLabel,nElem:a.torsO.nElem,meshError:a.torsO.meshError,converged:a.torsO.converged,feReasons:a.torsO.feReasons,bcText:a.torsO.bcText,reason:a.torsO.reason,nSols:a.torsO.sols&&a.torsO.sols.length,X:a.torsO.X}, torsTmax:a.tors&&a.tors.Tmax}, c:ch}; })()`);
const util = (ch, re) => { const u = ch.utils.find(u => re.test(u.name)); return u ? u.val : null; };
const brief = () => run(`(()=>{ const a=analyse(); const ch=checks(a); return renderMasterSeriesBrief(a,ch,a.sec); })()`);
const report = () => run(`(()=>{ const el={innerHTML:'',style:{}}; document.getElementById=()=>el; render(); return el.innerHTML; })()`);
const ROW = /<div class="ms-row[^"]*"><div class="ms-l">(.*?)<\/div><div class="ms-v[^"]*">(.*?)<\/div><div class="ms-r">(.*?)<\/div><div class="ms-t">(.*?)<\/div><\/div>/g;
const rows = html => [...html.matchAll(ROW)].map(m => ({ label: m[1], vals: m[2], res: m[3], tag: m[4] }));
const row = (html, re) => rows(html).find(r => re.test(r.label)) || null;

test('[hand-derived] element matrices and consistent load vector match the Hermite forms (kBend / kTors of the eigen patch, 7-3-3-7 load integrals)', () => {
  const r = run(`(()=>{ const kb=torsionFeKBend(2e9,100), kt=torsionFeKTors(3e6,100), f=torsionFeLoadVector(5,5,100), g=torsionFeLoadVector(2,8,100); return {kb,kt,f,g}; })()`);
  // kBend: 12EI/L^3, 6EI/L^2, 4EI/L, 2EI/L with EI = 2e9, L = 100
  near(r.kb[0][0], 12 * 2e9 / 1e6); near(r.kb[0][1], 6 * 2e9 / 1e4); near(r.kb[1][1], 4 * 2e9 / 100); near(r.kb[1][3], 2 * 2e9 / 100); near(r.kb[0][2], -12 * 2e9 / 1e6);
  // kTors: GJ/(30L) x [36, 3L, -36, 3L; 3L, 4L^2, -3L, -L^2; ...] with GJ = 3e6, L = 100
  near(r.kt[0][0], 3e6 / 3000 * 36); near(r.kt[0][1], 3e6 / 3000 * 300); near(r.kt[1][1], 3e6 / 3000 * 4e4); near(r.kt[1][3], -3e6 / 3000 * 1e4); near(r.kt[0][2], -3e6 / 3000 * 36);
  // symmetry
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { near(r.kb[i][j], r.kb[j][i]); near(r.kt[i][j], r.kt[j][i]); }
  // uniform m = 5 over L = 100: [mL/2, mL^2/12, mL/2, -mL^2/12] = [250, 4166.67, 250, -4166.67]
  near(r.f[0], 250); near(r.f[1], 5 * 1e4 / 12); near(r.f[2], 250); near(r.f[3], -5 * 1e4 / 12);
  // linear 2 -> 8: [L(7a+3b)/20, L^2(3a+2b)/60, L(3a+7b)/20, -L^2(2a+3b)/60] = [190, 3666.67, 310, -4666.67]; total = 500 = mean x L
  near(r.g[0], 190); near(r.g[1], 1e4 * 22 / 60); near(r.g[2], 310); near(r.g[3], -1e4 * 28 / 60); near(r.g[0] + r.g[2], 500);
});

test('[validation 1] fork-fork uniform torque reproduces the P385 Case 4 closed form (p385Solve) for phi, phi\', phi\'\' and phi\'\'\' within 0.5 % (actual < 1e-4)', () => {
  const r = run(`(()=>{ ${UB}
    const L=8000, T=20e6;   // 20 kN.m total uniform torque, t = 2500 N.mm/mm
    const cf=p385Solve(L,aa,GIt,[{kind:'ud',T}]);
    const fe=warpingTorsionFE({L,EIw,GIt,supports:[{pos:0,type:'pinned'},{pos:L,type:'pinned'}],torques:[{type:'udl',x1:0,x2:L,w1:T/L,w2:T/L}]});
    const at=(s,k,x)=>interpAt(s.xs,s[k],x);
    return {aa, GIt, cf:{phi:mx(cf.phi),p1:mx(cf.p1),p2:mx(cf.p2),p3:mx(cf.p3)}, fe:{phi:mx(fe.phi),p1:mx(fe.p1),p2:mx(fe.p2),p3:mx(fe.p3)},
      q:[2000,4000,6000].map(x=>({cf:[at(cf,'phi',x),at(cf,'p1',x),at(cf,'p2',x)], fe:[at(fe,'phi',x),at(fe,'p1',x),at(fe,'p2',x)]})),
      phiMid:at(fe,'phi',4000), meshError:fe.meshError, nElem:fe.nElem, method:fe.method, label:fe.methodLabel, X:fe.X, Tends:[fe.T[0],fe.T[fe.T.length-1]], Bends:[fe.B[0],fe.B[fe.B.length-1]], reac:fe.reactions.map(q=>q.T)}; })()`);
  // a = sqrt(210000 x 0.922e12 / (81000 x 69.2e4)) = 1858.57 mm; L/a = 4.3044
  near(r.aa, 1858.57, 1e-4); near(r.X, 8000 / 1858.57, 1e-4);
  ['phi', 'p1', 'p2', 'p3'].forEach(k => near(r.fe[k], r.cf[k], 5e-3, 'max ' + k));
  ['phi', 'p1', 'p2'].forEach(k => near(r.fe[k], r.cf[k], 1e-4, 'max ' + k + ' (actual agreement)'));
  r.q.forEach((s, i) => { near(s.fe[0], s.cf[0], 5e-3, 'phi at quarter ' + i); near(s.fe[2], s.cf[2], 5e-3, 'phi\'\' at quarter ' + i); if (Math.abs(s.cf[1]) > 1e-12) near(s.fe[1], s.cf[1], 5e-3, 'phi\' at quarter ' + i); });
  // [hand-derived] phi(L/2) = (t a^2/GI_T)[L^2/(8a^2) + 1/cosh(L/2a) - 1] = 0.15407 x [2.3159 + 0.22944 - 1] = 0.2381 rad
  const t = 20e6 / 8000, H = 4000 / r.aa;
  near(r.phiMid, (t * r.aa * r.aa / r.GIt) * (8000 * 8000 / (8 * r.aa * r.aa) + 1 / Math.cosh(H) - 1), 2e-4, 'phi mid closed form');
  near(r.phiMid, 0.2381, 1e-3);
  // natural conditions at the fork ends: B = 0 exactly; total torque T = +-10 kN.m (half the applied torque each end); reactions sum to -20 kN.m
  assert.ok(Math.abs(r.Bends[0]) < 1e-3 && Math.abs(r.Bends[1]) < 1e-3, 'B = 0 at fork ends');
  near(r.Tends[0], 10e6, 1e-6); near(r.Tends[1], -10e6, 1e-6); near(r.reac[0] + r.reac[1], -20e6, 1e-6);
  assert.equal(r.method, 'fe'); assert.equal(r.nElem, 240); assert.equal(r.label, 'warping-torsion FE (240 elements)');
  assert.ok(r.meshError < 1e-6, 'mesh error ' + r.meshError);
});

test('[validation 1b] fork-fork point torque at 0.3L (Case 3) and rising linear torque (Case 10) reproduce p385Solve within 0.5 %', () => {
  const r = run(`(()=>{ ${UB}
    const L=6000, T=8e6;
    const c3=p385Solve(L,aa,GIt,[{kind:'point',alpha:0.3,T}]);
    const f3=warpingTorsionFE({L,EIw,GIt,supports:[{pos:0},{pos:L}],torques:[{type:'point',pos:1800,P:T}]});
    const c10=p385Solve(L,aa,GIt,[{kind:'lin',T,mirror:false}]);
    const f10=warpingTorsionFE({L,EIw,GIt,supports:[{pos:0},{pos:L}],torques:[{type:'udl',x1:0,x2:L,w1:0,w2:2*T/L}]});
    const cmp=(a,b)=>['phi','p1','p2','p3'].map(k=>[mx(a[k]),mx(b[k])]);
    const jump=(s)=>[interpAt(s.xs,s.p3,1799.99),interpAt(s.xs,s.p3,1800.01)];
    return {c3:cmp(c3,f3), c10:cmp(c10,f10), j3:[jump(c3),jump(f3)]}; })()`);
  r.c3.forEach((p, i) => near(p[1], p[0], 5e-3, 'Case 3 ' + i));
  r.c10.forEach((p, i) => near(p[1], p[0], 5e-3, 'Case 10 ' + i));
  // phi''' jumps across the point torque by T/(E I_w): both sides reproduced
  near(r.j3[1][0], r.j3[0][0], 5e-3, 'phi\'\'\' left of the torque'); near(r.j3[1][1], r.j3[0][1], 5e-3, 'phi\'\'\' right of the torque');
});

test('[validation 2, hand-derived] cantilever tip torque: phi(L) = (T/GI_T)[L - a tanh(L/a)], root bimoment B(0) = T a tanh(L/a), free tip T = B = 0', () => {
  const r = run(`(()=>{ ${UB}
    const L=4000, T=10e6;
    const fe=warpingTorsionFE({L,EIw,GIt,supports:[{pos:0,type:'fixed'}],torques:[{type:'point',pos:L,P:T}]});
    const n=fe.xs.length;
    return {aa,GIt,EIw, phiL:fe.phi[n-1], p1root:fe.p1[0], phi0:fe.phi[0], Broot:fe.reactions[0].B, B0:fe.B[0], Ttip:fe.T[n-1], Btip:fe.B[n-1], Troot:fe.reactions[0].T, bc:fe.bc, mesh:fe.meshError, bcText:torsionFeBcText([{pos:0,type:'fixed'}],L)}; })()`);
  // [hand-derived] T/GI_T = 1e7/5.6052e10 = 1.7841e-4 rad/mm; a tanh(L/a) = 1858.57 x tanh(2.1522) = 1858.57 x 0.97331 = 1808.96 mm;
  // phi(L) = 1.7841e-4 x (4000 - 1808.96) = 0.39090 rad
  const cf = (10e6 / r.GIt) * (4000 - r.aa * Math.tanh(4000 / r.aa));
  near(r.phiL, cf, 1e-6, 'phi(L)'); near(r.phiL, 0.3909, 3e-4);
  assert.equal(r.phi0, 0); assert.equal(r.p1root, 0);                              // root phi = 0, phi' = 0
  // B(0) = E I_w phi''(0) = T a tanh(L/a) = 1e7 x 1808.96 = 1.80896e10 N.mm2 (reaction bimoment of the warping-fixed root)
  near(Math.abs(r.Broot), 10e6 * r.aa * Math.tanh(4000 / r.aa), 1e-6, 'root bimoment'); near(Math.abs(r.B0), 1.80896e10, 1e-4);
  // free tip: the tip torque is the internal torque just inside the tip (T = P), B = 0; root reaction = -T
  near(r.Ttip, 10e6, 1e-6); assert.ok(Math.abs(r.Btip) < 1, 'B = 0 at the free tip'); near(r.Troot, -10e6, 1e-6);
  assert.equal(JSON.stringify(r.bc), JSON.stringify([{ pos: 0, warpFix: true, root: true }]));
  assert.ok(/cantilever: root at x = 0 m with &phi; = 0 and &phi;&prime; = 0 \(warping fixed\), free tip/.test(r.bcText), r.bcText);
  assert.ok(r.mesh < 1e-6);
});

test('[validation 3, hand-derived] warping-fixed ends reduce phi_max: fixed-fixed uniform torque phi(L/2) = (t/GI_T)[L^2/8 - (La/2) tanh(L/4a)] = 0.0943 rad against 0.2381 fork-fork; phi\' = 0 at the fixed ends', () => {
  const r = run(`(()=>{ ${UB}
    const L=8000, T=20e6, tq=[{type:'udl',x1:0,x2:L,w1:T/L,w2:T/L}];
    const free=warpingTorsionFE({L,EIw,GIt,supports:[{pos:0},{pos:L}],torques:tq});
    const fix=warpingTorsionFE({L,EIw,GIt,supports:[{pos:0,warpFix:true},{pos:L,warpFix:true}],torques:tq});
    const one=warpingTorsionFE({L,EIw,GIt,supports:[{pos:0,warpFix:true},{pos:L}],torques:tq});
    const n=fix.xs.length;
    return {aa,GIt, phiFree:mx(free.phi), phiFix:mx(fix.phi), phiOne:mx(one.phi), p1ends:[fix.p1[0],fix.p1[n-1]], Breac:fix.reactions.map(q=>q.B), Bends:[fix.B[0],fix.B[n-1]], phiMid:interpAt(fix.xs,fix.phi,L/2), mesh:fix.meshError,
      bcText:torsionFeBcText([{pos:0,warpFix:true},{pos:L}],L)}; })()`);
  // [hand-derived] t/GI_T = 4.4602e-8; L^2/8 = 8e6; (La/2) tanh(H/2) with H/2 = 1.0761: 7.4343e6 x 0.79180 = 5.8865e6; phi = 4.4602e-8 x 2.1135e6 = 0.09427
  const t = 20e6 / 8000, H2 = 8000 / (4 * r.aa);
  near(r.phiMid, (t / r.GIt) * (8000 * 8000 / 8 - 8000 * r.aa / 2 * Math.tanh(H2)), 1e-5, 'fixed-fixed closed form'); near(r.phiMid, 0.09427, 2e-4);
  near(r.phiFix, r.phiMid, 1e-9); near(r.phiFree, 0.2381, 1e-3);
  assert.ok(r.phiFix < 0.5 * r.phiFree && r.phiOne < r.phiFree && r.phiOne > r.phiFix, 'warping fixity reduces the twist: ' + [r.phiFree, r.phiOne, r.phiFix]);
  assert.equal(r.p1ends[0], 0); assert.equal(r.p1ends[1], 0);
  // the reaction bimoments at the fixed ends equal the recovered end bimoments and are antisymmetric
  near(Math.abs(r.Bends[0]), Math.abs(r.Breac[0]), 1e-6); near(r.Breac[0], -r.Breac[1], 1e-6);
  assert.ok(/x = 0 m \(&phi; = 0, &phi;&prime; = 0: warping fixed\), x = 8 m \(fork, &phi; = 0, warping free\)/.test(r.bcText), r.bcText);
  assert.ok(r.mesh < 1e-4);
});

test('[validation 4] mesh convergence: the error against the Case 3 closed form at the torque station falls monotonically (O(h^4) nodal superconvergence), the reported doubling error is below 1e-3 at the default mesh and above the 0.5 % block on a 5-element mesh', () => {
  const r = run(`(()=>{ ${UB}
    const L=8000, T=8e6, sup=[{pos:0},{pos:L}], tq=[{type:'point',pos:2400,P:T}];
    const cf=p385Solve(L,aa,GIt,[{kind:'point',alpha:0.3,T}]);
    const at=(s,k,x)=>interpAt(s.xs,s[k],x);
    const err=(fe)=>Math.max(...['phi','p1','p2'].map(k=>Math.abs(at(fe,k,2400)-at(cf,k,2400))/Math.abs(at(cf,k,2400))));
    const out=[4,8,16,120].map(n=>{ const fe=warpingTorsionFE({L,EIw,GIt,supports:sup,torques:tq,nSub:n}); return {n, nElem:fe.nElem, nElemCoarse:fe.nElemCoarse, mesh:fe.meshError, vsClosed:err(fe), maxPhi:Math.abs(mx(fe.phi)-mx(cf.phi))/mx(cf.phi)}; });
    const single=[2,4,8,16].map(n=>{ const fe=warpingTorsionFE({L,EIw,GIt,supports:sup,torques:tq,nSub:n,refine:false}); return {nElem:fe.nElem, vsClosed:err(fe)}; });
    return {out, single, block:TORSION_FE_MESH_BLOCK, nsub:TORSION_FE_NSUB}; })()`);
  assert.equal(r.block, 0.005); assert.equal(r.nsub, 120);
  r.out.forEach(o => assert.ok(o.nElem >= 2 * o.nElemCoarse - 2 && o.nElem > o.nElemCoarse, 'mesh doubled: ' + JSON.stringify(o)));
  // single meshes of 3, 5, 9, 17 elements (elements of 2700 to 470 mm against a = 1859 mm): worst error over phi, phi', phi'' at the torque
  // station 3.0e-3, 8.4e-4, 4.2e-5, 2.3e-6 - every refinement gains at least a factor 3, an order of magnitude once the element is shorter than a
  for (let i = 1; i < r.single.length; i++) assert.ok(r.single[i].vsClosed < 0.34 * r.single[i - 1].vsClosed, 'monotonic decrease: ' + JSON.stringify(r.single));
  for (let i = 2; i < r.single.length; i++) assert.ok(r.single[i].vsClosed < 0.1 * r.single[i - 1].vsClosed, 'O(h^4) once h < a: ' + JSON.stringify(r.single));
  assert.ok(r.single[0].vsClosed < 5e-3 && r.single[3].vsClosed < 1e-5, JSON.stringify(r.single));
  // the reported doubling error: a 5 -> 9 element mesh is refused (6.9 % change of the sampled peak twist), the default 120 -> 240 mesh is far inside the limit
  assert.ok(r.out[0].mesh > r.block, 'coarsest mesh would be blocked: ' + r.out[0].mesh);
  assert.ok(r.out[3].mesh < 1e-3 && r.out[3].vsClosed < 1e-6 && r.out[3].maxPhi < 5e-3, 'default mesh converged: ' + JSON.stringify(r.out[3]));
  assert.ok(r.out[3].vsClosed < r.out[0].vsClosed / 100, 'default mesh two orders more accurate than the coarsest');
});

test('[hand-derived] partial-span eccentric UDL on a UB (matrix probe 457x191x82, 8 m, 2-6 m, e = 100 mm) is evaluated by the FE, cross-checked against the superposition of 400 P385 Case 3 point torques, and no longer blocked', () => {
  c.reset({ restraint: 'ltb', eccOn: true, L: 8, supports: [{ pos: 0, type: 'pinned' }, { pos: 8, type: 'pinned' }], loads: [{ type: 'udl', x1: 2, x2: 6, w: 10, case: 'Q', e: 100 }] });
  const { a, c: ch } = full();
  assert.ok(a.torsO && a.torsO.ok && a.torsO.method === 'fe', JSON.stringify(a.torsO));
  assert.ok(!ch.unsupported.some(m => /partial-span|multi-span|not covered/i.test(m)), ch.unsupported.join(' | '));
  assert.ok(/partial-span eccentric distributed load/.test(a.torsO.feReasons.join()), 'reason printed');
  assert.ok(ch.tor && ch.tor.p385 && ch.tor.fe && ch.tor.method === 'fe' && ch.tor.meshConverged);
  assert.ok(util(ch, /P385 3\.1\.2/) != null && util(ch, /Annex A/) != null && util(ch, /V_pl,T,Rd/) != null, 'P385 3.1.2, Annex A and V_pl,T,Rd entries present');
  assert.ok(ch.pass, ch.unsupported.join(' | '));
  // independent reference: the partial uniform torque t = 1.5 x 10 kN/m x 100 mm = 1500 N.mm/mm over 2-6 m as 400 Case 3 point torques (midpoint rule)
  const ref = run(`(()=>{ ${MX} const a=analyse(); const O=a.torsO; const g=O.sols[0].sol; const L=a.L;
    const n=400, t=1.5*10*100, dx=4000/n, list=[]; for(let i=0;i<n;i++) list.push({kind:'point',alpha:(2000+dx*(i+0.5))/L,T:t*dx});
    const cf=p385Solve(L,O.aa,O.GIt,list);
    const at=(s,k,x)=>interpAt(s.xs,s[k],x);
    return {phi:[mx(g.phi),mx(cf.phi)], p2:[mx(g.p2),mx(cf.p2)], p1:[mx(g.p1),mx(cf.p1)], phiQ:[at(g,'phi',3000),at(cf,'phi',3000)], p2Q:[at(g,'p2',4000),at(cf,'p2',4000)], phiUmax:mx(g.phi)}; })()`);
  near(ref.phi[0], ref.phi[1], 5e-3, 'phi max vs superposed Case 3'); near(ref.p1[0], ref.p1[1], 5e-3, 'phi\' max'); near(ref.p2[0], ref.p2[1], 5e-3, 'phi\'\' max');
  near(ref.phiQ[0], ref.phiQ[1], 5e-3); near(ref.p2Q[0], ref.p2Q[1], 5e-3);
  near(ch.tor.phiUmax, ref.phiUmax, 1e-9, 'brief phi_max is the FE peak');
  // brief: Torsion analysis row (FE tag with the mesh error), phi_max, B_Ed, T_t ends with the total torque; report: method line
  const h = brief();
  const ta = row(h, /^Torsion analysis$/); assert.ok(ta && /warping-torsion FE \(240 elements\)/.test(ta.vals) && /closed forms not applicable: partial-span/.test(ta.vals) && /^mesh error [\d.]+ %$/.test(ta.res) && /^FE \(&le; 0\.5 %\)$/.test(ta.tag), JSON.stringify(ta));
  assert.ok(row(h, /^&phi;<sub>max<\/sub> \(ULS\)$/) && /warping-torsion FE/.test(row(h, /^&phi;<sub>max<\/sub> \(ULS\)$/).vals));
  const bb = row(h, /^B<sub>Ed<\/sub> = EI<sub>w<\/sub>&phi;&Prime; \(max\)$/); assert.ok(bb && /kN\.m&sup2;$/.test(bb.res), JSON.stringify(bb));
  const te = row(h, /^End torques T<sub>t<\/sub>$/); assert.ok(te && /total T = /.test(te.vals), JSON.stringify(te));
  const rep = report(); assert.ok(/Torsion Analysis &mdash; SCI P385 Method B \(elastic; warping-torsion FE\)/.test(rep) && /closed forms not applicable: partial-span/.test(rep) && /Bimoment B<sub>Ed<\/sub>/.test(rep) && /mesh converged/.test(rep), 'report method block');
});

test('cantilever with an eccentric tip load: FE with the root warping fixed, free tip T_t = 0, total root torque = P e, evaluated on both Mcr routes', () => {
  for (const m of ['eigen', 'standard']) {
    c.reset({ mcrMethod: m, restraint: 'ltb', eccOn: true, L: 4, supports: [{ pos: 0, type: 'fixed' }], loads: [{ type: 'point', pos: 4, P: 20, case: 'Q', e: 80 }] });
    const { a, c: ch } = full();
    assert.equal(a.torsO.method, 'fe'); assert.equal(JSON.stringify(a.torsO.feReasons), JSON.stringify(['cantilever']));
    assert.ok(/cantilever: root at x = 0 m with &phi; = 0 and &phi;&prime; = 0/.test(a.torsO.bcText));
    assert.ok(!ch.unsupported.some(m2 => /cantilever|multi-span|not covered/i.test(m2)), m + ': ' + ch.unsupported.join(' | '));
    assert.ok(util(ch, /Annex A/) != null && util(ch, /P385 3\.1\.2/) != null, m + ': torsion checks present');
    // ULS torque 1.5 x 20 kN x 80 mm = 2.4 kN.m: total torque at the root (the tip torque itself); St Venant part at the root = 0 (phi' = 0) and at the
    // free tip GI_T phi'(L) = T[1 - 1/cosh(L/a)] = 2.4 x (1 - 1/cosh(4000/1858.57)) = 2.4 x (1 - 0.22944) = 1.849 kN.m (the rest, T/cosh(L/a), is warping torque)
    near(Math.abs(ch.tor.TEnds[0]), 2.4, 1e-6, m + ': total root torque'); near(Math.abs(ch.tor.TEnds[1]), 2.4, 1e-6, m + ': total torque just inside the tip');
    assert.ok(Math.abs(ch.tor.TtEnds[0]) < 1e-9, m + ': St Venant torque zero at the warping-fixed root');
    near(Math.abs(ch.tor.TtEnds[1]), 2.4 * (1 - 1 / Math.cosh(4000 / 1858.57)), 2e-4, m + ': St Venant torque at the free tip'); near(Math.abs(ch.tor.TtEnds[1]), 1.849, 1e-3);
    near(a.torsTmax, 2.4, 1e-6);
    assert.ok(ch.pass, m + ': ' + ch.unsupported.join(' | '));
  }
});

test('two-span PFC with a full-length eccentric UDL: FE per generated pattern combination, Annex A runs on both routes (no channel torsion gap), hold-down aside', () => {
  for (const m of ['eigen', 'standard']) {
    c.reset({ mcrMethod: m, family: 'pfc', sectionKey: '180x75x20', restraint: 'ltb', eccOn: true, L: 8, supports: [{ pos: 0, type: 'pinned', holdDown: true }, { pos: 4, type: 'pinned' }, { pos: 8, type: 'pinned', holdDown: true }], loads: [{ type: 'udl', x1: 0, x2: 8, w: 4, case: 'Q', e: 20 }] });
    const { a, c: ch } = full();
    assert.equal(a.torsO.method, 'fe'); assert.equal(JSON.stringify(a.torsO.feReasons), JSON.stringify(['3 supports (multi-span / overhang layout)'])); assert.equal(a.torsO.nSols, 3);
    assert.ok(!ch.unsupported.some(m2 => /multi-span|Channel with eccentric load|not covered/i.test(m2)), m + ': ' + ch.unsupported.join(' | '));
    assert.ok(ch.annex && Number.isFinite(ch.annex.u), m + ': Annex A evaluated');
    assert.ok(a.torsO.converged && a.torsO.meshError < 1e-3);
  }
});

test('closed forms stay the default where they apply (fork-fork full-span UDL + point torque on a PFC): method "closed", and the FE with the same torque list agrees within 0.5 % on the cross-section utilisation', () => {
  c.reset({ family: 'pfc', sectionKey: '180x75x20', restraint: 'ltb', eccOn: true, L: 4, supports: [{ pos: 0, type: 'pinned' }, { pos: 4, type: 'pinned' }], loads: [{ type: 'udl', x1: 0, x2: 4, w: 5, case: 'Q', e: 20 }, { type: 'point', pos: 1.5, P: 6, case: 'Q', e: 20 }] });
  const { a, c: ch } = full();
  assert.equal(a.torsO.method, 'closed'); assert.equal(JSON.stringify(a.torsO.feReasons), '[]'); assert.equal(a.torsO.methodLabel, 'SCI P385 App C closed forms (Cases 3/4/10)');
  assert.ok(ch.tor && !ch.tor.fe && ch.tor.meshError === null && ch.tor.meshConverged);
  const h = brief(); const ta = row(h, /^Torsion analysis$/); assert.ok(ta && /^SCI P385 App C closed forms/.test(ta.vals) && /^L\/a = /.test(ta.res) && ta.tag === 'P385 App C', JSON.stringify(ta));
  assert.ok(/fork ends, warping free \(P385 Cases 3\/4\/10\)/.test(row(h, /^&phi;<sub>max<\/sub> \(ULS\)$/).vals));
  const rep = report(); assert.ok(/Torsion Analysis &mdash; SCI P385 Method B \(elastic; fork ends, warping free\)/.test(rep) && /Cases 3\/4\/10 closed forms, superposed per combination/.test(rep));
  // same torques through the FE: the ULS solution (torque list rebuilt from the combination) matches the closed forms
  const cmp = run(`(()=>{ ${MX} const a=analyse(); const O=a.torsO; const g=O.sols[0].sol; const L=a.L; const f=1.5, e=20;
    const sw=selfWeightValue(a.sec), swE=selfWeightEccentricity(a.sec);
    const tq=[{type:'udl',x1:0,x2:L,w1:5*f*e,w2:5*f*e},{type:'point',pos:1500,P:6*f*1000*e},{type:'udl',x1:0,x2:L,w1:sw*1.35*swE,w2:sw*1.35*swE}];
    const fe=warpingTorsionFE({L,EIw:a.E*O.Iw,GIt:O.GIt,supports:[{pos:0},{pos:L}],torques:tq});
    return ['phi','p1','p2','p3'].map(k=>[mx(g[k]),mx(fe[k])]); })()`);
  cmp.forEach((p, i) => near(p[1], p[0], 5e-3, 'closed vs FE ' + i));
});

test('per-support "warping restrained for torsion" option: both ends fixed on a fork-fork UB routes to the FE, lowers phi_max and M_w changes, prints the BCs; the option is exposed on the EC3 path with torsion active on open sections', () => {
  const lay = { restraint: 'ltb', eccOn: true, L: 8, supports: [{ pos: 0, type: 'pinned' }, { pos: 8, type: 'pinned' }], loads: [{ type: 'udl', x1: 0, x2: 8, w: 10, case: 'Q', e: 100 }] };
  c.reset(lay); const free = full();
  assert.equal(free.a.torsO.method, 'closed');
  c.reset(Object.assign({}, lay, { supports: [{ pos: 0, type: 'pinned', warpFix: true }, { pos: 8, type: 'pinned', warpFix: true }] })); const fix = full();
  assert.equal(fix.a.torsO.method, 'fe'); assert.equal(JSON.stringify(fix.a.torsO.feReasons), JSON.stringify(['warping-fixed support']));
  assert.ok(fix.c.tor.phiUmax < 0.5 * free.c.tor.phiUmax, 'twist reduced: ' + [free.c.tor.phiUmax, fix.c.tor.phiUmax]);
  assert.ok(Math.abs(fix.c.tor.TtEnds[0]) < 1e-9 && Math.abs(fix.c.tor.TtEnds[1]) < 1e-9, 'St Venant torque zero at warping-fixed ends (all torque carried by warping there)');
  near(Math.abs(fix.c.tor.TEnds[0]), Math.abs(free.c.tor.TEnds[0]), 1e-6, 'total end torque unchanged (symmetric layout: half the applied torque each end)');
  const h = brief(); const ta = row(h, /^Torsion analysis$/); assert.ok(ta && /x = 0 m \(&phi; = 0, &phi;&prime; = 0: warping fixed\)/.test(ta.vals) && /warping-fixed support/.test(ta.vals), JSON.stringify(ta));
  assert.equal(run('torsionWarpInputsOn()'), true);
  c.reset(Object.assign({}, lay, { eccOn: false })); assert.equal(run('torsionWarpInputsOn()'), false);
  c.reset(Object.assign({}, lay, { family: 'rhs' })); assert.equal(run('torsionWarpInputsOn()'), false);
  c.reset(Object.assign({}, lay, { code: 'BS5950' })); assert.equal(run('torsionWarpInputsOn()'), false);
});

test('mesh-convergence guard: an unconverged FE solution blocks PASS with the printed error, the brief prints BLOCKED on the method row and the NOT VERIFIED row in the Torsion Design block', () => {
  c.reset({ restraint: 'ltb', eccOn: true, L: 8, supports: [{ pos: 0, type: 'pinned' }, { pos: 8, type: 'pinned' }], loads: [{ type: 'udl', x1: 2, x2: 6, w: 10, case: 'Q', e: 100 }] });
  const r = run(`(()=>{ const a=analyse(); a.torsO.converged=false; a.torsO.meshError=0.012; const ch=checks(a); const h=renderMasterSeriesBrief(a,ch,a.sec); return {pass:ch.pass, uns:ch.unsupported, conv:ch.tor.meshConverged, html:h}; })()`);
  assert.equal(r.pass, false); assert.equal(r.conv, false);
  const msg = r.uns.find(m => /Warping-torsion FE mesh has not converged/.test(m)); assert.ok(msg && /120 to 240 elements/.test(msg) && /1\.20 %/.test(msg) && /limit 0\.5 %/.test(msg), r.uns.join(' | '));
  assert.equal(run(`msbBlockFor(${JSON.stringify(msg)})`), 'torsion');
  const ta = row(r.html, /^Torsion analysis$/); assert.ok(ta && /BLOCKED/.test(ta.tag) && /mesh error 1\.200 %/.test(ta.res), JSON.stringify(ta));
  const iTor = r.html.indexOf('Torsion Design'), iMsg = r.html.indexOf('ms-nv-msg">' + msg), iDef = r.html.indexOf('Deflection Check');
  assert.ok(iTor > 0 && iMsg > iTor && iMsg < iDef, 'NOT VERIFIED row inside the Torsion Design block');
});

// 19 Sep 2026 review finding (high): the bimoment was AVERAGED across an interior
// warping-fixed node, where the reaction bimoment makes B jump, so the peak B_Ed
// was under-reported, printed at the wrong x and the mesh-convergence measure
// crept with the mesh instead of converging (blocking PASS at 4.4 % on the
// default mesh). The one-sided element values are now kept at such a node.
test('[hand-derived] interior warping-fixed support: B jumps by the reaction bimoment; single fixed support at mid-member with opposite tip torques gives B(root-) = +T a tanh(l/a), B(root+) = -T a tanh(l/a), max|B| at the root, mesh error <= 0.5 %', () => {
  // 8 m member, single (root) support at x = 4 m -> warping fixed automatically; tip torques +T at x = 0 and -T at x = 8 m:
  // each half is the validation-2 cantilever, B(root) = T a tanh(l/a) with opposite signs on the two sides -> the average is 0
  const r = run(`(()=>{ ${UB}
    const L=8000, T=10e6;
    const fe=warpingTorsionFE({L,EIw,GIt,supports:[{pos:4000,type:'fixed'}],torques:[{type:'point',pos:0,P:T},{type:'point',pos:L,P:-T}]});
    const i=fe.xs.findIndex(x=>Math.abs(x-4000)<1e-9);
    let bm=0,bp=0; fe.B.forEach((b,k)=>{ if(Math.abs(b)>bm){bm=Math.abs(b);bp=fe.xs[k];} });
    return {aa,GIt, xs:fe.xs.slice(i-1,i+2), B:fe.B.slice(i-1,i+2), Bmax:bm, Bpos:bp, mesh:fe.meshError, parts:fe.meshErrorParts, Breac:fe.reactions[0].B, phiTip:[fe.phi[0],fe.phi[fe.phi.length-1]]}; })()`);
  // [hand-derived] a tanh(l/a) = 1858.57 x tanh(4000/1858.57) = 1808.96 mm; T a tanh = 1e7 x 1808.96 = 1.80896e10 N.mm2
  const Bcf = 10e6 * r.aa * Math.tanh(4000 / r.aa);
  near(Bcf, 1.80896e10, 1e-4);
  near(r.xs[0], 3999.99, 1e-9); near(r.xs[1], 4000, 1e-9); near(r.xs[2], 4000.01, 1e-9);
  near(Math.abs(r.B[0]), Bcf, 1e-4, 'B(root-)'); near(Math.abs(r.B[2]), Bcf, 1e-4, 'B(root+)');
  assert.ok(r.B[0] * r.B[2] < 0, 'opposite signs either side of the root: ' + r.B.join(', '));
  near(Math.abs(r.B[1]), Bcf, 1e-4, 'B at the root = the larger side, not the average (which is 0)');
  near(r.Bmax, Bcf, 1e-4, 'max|B|'); near(r.Bpos, 4000, 1e-9, 'max|B| at the root');
  near(Math.abs(r.Breac), 2 * Bcf, 1e-4, 'reaction bimoment = the jump');
  assert.ok(r.mesh <= 1e-3, 'mesh error converged: ' + JSON.stringify(r.parts));
  // tip twists +-(T/GI_T)[l - a tanh(l/a)] = 0.39090 rad (validation 2)
  near(Math.abs(r.phiTip[0]), (10e6 / r.GIt) * (4000 - r.aa * Math.tanh(4000 / r.aa)), 1e-6); assert.ok(r.phiTip[0] * r.phiTip[1] < 0);
});

test('[hand-derived] overhang with the interior support warping-fixed (review layout): the back span stays untwisted, B(support+) = T a tanh(l/a) of the 4 m cantilever, reported at x = 6 m; mesh converged and PASS not blocked through analyse()/checks()', () => {
  // 457x191x82, 10 m, supports at 0 (fork, hold-down) and 6 m (warping restrained), 20 kN Q at the tip with e = 100 mm:
  // ULS torque T = 1.5 x 20 x 100 = 3000 kN.mm; the overhang is a cantilever rooted at x = 6 m (phi = phi' = 0), l = 4000 mm
  const lay = { restraint: 'ltb', mcrMethod: 'eigen', eccOn: true, L: 10, supports: [{ pos: 0, type: 'pinned', holdDown: true, ss: 100 }, { pos: 6, type: 'pinned', warpFix: true, ss: 100 }],
    loads: [{ type: 'point', pos: 10, P: 20, case: 'Q', e: 100 }] };
  c.reset(lay);
  const r = run(`(()=>{ ${MX} const a=analyse(); const ch=checks(a); const O=a.torsO; const g=O.sols[0].sol;
    const i=g.xs.findIndex(x=>Math.abs(x-6000)<1e-9);
    return {method:O.method, mesh:O.meshError, conv:O.converged, aa:O.aa, GIt:O.GIt, B:g.B.slice(i-1,i+2), xs:g.xs.slice(i-1,i+2), Bmax:mx(g.B), BMax:ch.tor.BMax, BMaxPos:ch.tor.BMaxPos,
      phiBack:mx(g.phi.filter((v,k)=>g.xs[k]<=6000)), phiTip:g.phi[g.phi.length-1], pass:ch.pass, uns:ch.unsupported, label:O.sols[0].combo.label}; })()`);
  assert.equal(r.method, 'fe'); assert.ok(r.conv && r.mesh <= 1e-3, 'mesh error ' + r.mesh);
  assert.ok(!r.uns.some(m => /mesh has not converged/.test(m)), r.uns.join(' | '));
  // [hand-derived] B = 3.0e6 N.mm x 1858.57 x tanh(2.1522) = 3.0e6 x 1808.96 = 5.4269e9 N.mm2 = 5.427 kN.m2; back span B = 0 (no torque, phi = 0 at both ends and phi' = 0 at x = 6 m)
  const Bcf = 3.0e6 * r.aa * Math.tanh(4000 / r.aa);
  near(Bcf, 5.4269e9, 1e-4);
  assert.ok(Math.abs(r.B[0]) < 1e-3 * Bcf, 'B(support-) = 0 on the untwisted back span: ' + r.B[0]);
  near(Math.abs(r.B[2]), Bcf, 1e-4, 'B(support+)'); near(Math.abs(r.B[1]), Bcf, 1e-4, 'B at the support = the cantilever side');
  near(r.Bmax, Bcf, 1e-4, 'max|B|'); near(r.BMax, Bcf / 1e9, 1e-4, 'ch.tor.BMax kN.m2'); near(r.BMaxPos, 6000, 1e-9, 'B_Ed printed at the support (mm)');
  assert.ok(r.phiBack < 1e-9, 'back span untwisted');
  // tip twist (T/GI_T)[l - a tanh(l/a)] = 3.0e6/5.6052e10 x 2191.04 = 0.11727 rad
  near(Math.abs(r.phiTip), (3.0e6 / r.GIt) * (4000 - r.aa * Math.tanh(4000 / r.aa)), 1e-6);
  assert.ok(r.pass, r.uns.join(' | '));
});
