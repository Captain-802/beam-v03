const { test } = require('node:test');
const assert = require('node:assert/strict');
const { app } = require('./harness.cjs');
const c = app();
const run = x => c.run(x);
const ENDS = (p, o) => c.ends(p, o);   // ends preset of the single-span model (js/03-state-ui.js endsPreset)
function reset(x={}) { c.reset({L:1, ends:ENDS('ss'), loads:[{type:'udl',x1:0,x2:1,w:0.1,case:'Q'}], ...x}); }
function near(actual, expected, rel=1e-5) { assert.ok(Math.abs(actual-expected)<=rel*Math.max(1,Math.abs(expected)), `${actual} != ${expected}`); }

test('simply supported UDL: equilibrium, moment and deflection', () => {
  const r=run(`(()=>{ const L=6000,EI=210000*8e7, supports=[{pos:0,type:'pinned'},{pos:L,type:'pinned'}],loads=[{type:'udl',x1:0,x2:L,w1:-10,w2:-10}]; const r=solveBeam(L,EI,supports,loads); const f=sfdBmd(L,supports,loads,r.reactions); return {R:r.reactions,M:Math.max(...f.M),d:Math.min(...r.w),close:f.M.at(-1)}; })()`);
  near(r.R[0].V,30000); near(r.R[1].V,30000); near(r.M,45e6); near(r.d,-5*10*6000**4/(384*210000*8e7)); near(r.close,0,0.1);
});
test('cantilever tip load: moment and displacement', () => {
  const r=run(`solveBeam(3000,210000*8e7,[{pos:0,type:'fixed'}],[{type:'point',pos:3000,P:-10000}])`);
  near(r.reactions[0].V,10000); near(r.reactions[0].M,30e6); near(r.w.at(-1),-10000*3000**3/(3*210000*8e7));
});
test('singular hinge layout must not return apparently finite design actions', () => {
  // pinned - pinned with an internal hinge: the rank test refuses it before the solve
  assert.throws(()=>run(`solveBeam(3000,210000*8e7,[{pos:0,type:'pinned'},{pos:3000,type:'pinned'}],[{type:'point',pos:1500,P:-1000}],120,[2000])`), /mechanism|singular|unstable/i);
  assert.equal(run(`beamRestraintRank(3000,[{pos:0,type:'pinned'},{pos:3000,type:'pinned'}],[2000]).ok`), false);
  assert.equal(run(`beamRestraintRank(3000,[{pos:0,type:'fixed'},{pos:3000,type:'pinned'}],[2000]).ok`), true);
  assert.equal(run(`beamRestraintRank(3000,[{pos:0,type:'pinned'},{pos:3000,type:'guided'}],[]).ok`), true);
  assert.equal(run(`beamRestraintRank(3000,[{pos:0,type:'guided'},{pos:3000,type:'guided'}],[]).ok`), false);
  assert.throws(()=>run(`solveBeam(3000,210000*8e7,[{pos:0,type:'roller'}],[])`), /unknown support type/);
});
test('guided end (rotation held, vertical free): fixed - guided UDL gives M_fixed = wL2/3, M_guided = wL2/6 (sagging), no vertical reaction at the guided end [hand-derived: half of a fixed-fixed beam of span 2L]', () => {
  const r=run(`(()=>{ const L=6000,EI=210000*3.71e8, sup=[{pos:0,type:'fixed',end:1},{pos:L,type:'guided',end:2}], loads=[{type:'udl',x1:0,x2:L,w1:-10,w2:-10}];
    const r=solveBeam(L,EI,sup,loads); const f=sfdBmd(L,sup,loads,r.reactions);
    return {R:r.reactions, M0:interpAt(f.xs,f.M,1e-4), ML:interpAt(f.xs,f.M,L-1e-4), Mmid:interpAt(f.xs,f.M,L/2), wL:r.w.at(-1), Vend:interpAt(f.xs,f.V,L-1e-4)}; })()`);
  const w=10, L=6000;
  near(r.R[0].V, w*L); near(r.R[0].type==='fixed'?1:0, 1); near(r.R[1].V, 0, 1e-9); assert.equal(r.R[1].type,'guided'); assert.equal(r.R[1].end,2);
  near(r.M0, -w*L*L/3, 1e-6);             // hogging at the fixed end
  near(r.ML, +w*L*L/6, 1e-6);             // sagging at the guided end
  near(r.Mmid, -w*L*L/3 + w*L*L/2 - w*L*L/8, 1e-6);
  assert.ok(Math.abs(r.Vend)<1e-2, 'shear vanishes at the guided end: '+r.Vend);
  near(r.wL, -w*Math.pow(L,4)/(24*210000*3.71e8), 1e-6);   // = midspan deflection of the 2L fixed-fixed beam
  // the same member through analyse(): the End 2 reaction row carries the moment only
  reset({L:6, ends:ENDS('guided-fixed'), loads:[{type:'udl',x1:0,x2:6,w:10,case:'Q'}], combos:[{id:'c1',label:'ULS: 1.5Q',factors:{G:0,Q:1.5,W:0,E:0},sls:false,on:true},{id:'s1',label:'SLS: Q',factors:{G:0,Q:1,W:0,E:0},sls:true,on:true}]});
  const a=run('analyse()'); near(a.Mmax, -15*36/3, 1e-6); near(a.MLend, 15*36/6, 1e-6); near(a.reactions[1].V, 0, 1e-9); near(-a.reactions[1].M/1e6, -90, 1e-6);
  assert.equal(a.deflection.cant, true); near(a.deflection.limit, 6000/180, 1e-9);   // a vertically free end takes the L/180 limit
  // pinned - guided: statics R_1 = wL, M_guided = wL2/2
  reset({L:6, ends:ENDS('pinned-guided'), loads:[{type:'udl',x1:0,x2:6,w:10,case:'Q'}], combos:[{id:'c1',label:'ULS: 1.5Q',factors:{G:0,Q:1.5,W:0,E:0},sls:false,on:true},{id:'s1',label:'SLS: Q',factors:{G:0,Q:1,W:0,E:0},sls:true,on:true}]});
  const b=run('analyse()'); near(b.reactions[0].V, 15*6000, 1e-6); near(b.MLend, 15*36/2, 1e-6);
});
test('end presets produce the expected in-plane support lists and LTB / torsion boundary conditions', () => {
  const sup=(p)=>JSON.parse(run(`(()=>{ S.L=5; S.ends=endsPreset('${p}'); return JSON.stringify(endsToSupports(S).map(s=>[s.end,s.pos,s.type])); })()`));
  assert.deepEqual(sup('ss'), [[1,0,'pinned'],[2,5,'pinned']]);
  assert.deepEqual(sup('fixed-fixed'), [[1,0,'fixed'],[2,5,'fixed']]);
  assert.deepEqual(sup('fixed-pinned'), [[1,0,'fixed'],[2,5,'pinned']]);
  assert.deepEqual(sup('cantilever'), [[1,0,'fixed']]);
  assert.deepEqual(sup('guided-fixed'), [[1,0,'fixed'],[2,5,'guided']]);
  assert.deepEqual(sup('fixed-guided'), [[1,0,'fixed'],[2,5,'guided']]);
  assert.deepEqual(sup('pinned-guided'), [[1,0,'pinned'],[2,5,'guided']]);
  assert.throws(()=>run(`endsPreset('bogus')`), /Unknown end preset/);
  // cantilever: seven flags at the root, none at the tip; LTB restraint at x = 0 only; twist restrained at End 1 with warping fixed
  const cant=JSON.parse(run(`(()=>{ S.L=4; S.ends=endsPreset('cantilever'); return JSON.stringify({e1:S.ends.e1,e2:S.ends.e2,ltb:ltbEndRestraints(S),tw:twistEnds(S),cant:isCantilever(S),free:hasFreeVerticalEnd(S),name:endsPresetName(S.ends)}); })()`));
  assert.ok(['ux','uy','uz','rx','ry','rz','warp'].every(k=>cant.e1[k]===true && cant.e2[k]===false));
  assert.deepEqual(cant.ltb, [{x:0,v:1,vp:1,phi:1,phip:1,end:1}]); assert.deepEqual(cant.tw, [{end:1,pos:0,warpFix:true}]);
  assert.ok(cant.cant && cant.free && cant.name==='cantilever');
  // simply supported: fork ends (v, phi) with v' and phi' free; a custom set has no preset name
  const ss=JSON.parse(run(`(()=>{ S.L=4; S.ends=endsPreset('ss',{e2:{ss:120}}); return JSON.stringify({ltb:ltbEndRestraints(S),tw:twistEnds(S),ss2:S.ends.e2.ss,cant:isCantilever(S),name:endsPresetName(S.ends),custom:endsPresetName(endsPreset('ss',{e1:{rz:true}}))}); })()`));
  assert.deepEqual(ss.ltb, [{x:0,v:1,vp:0,phi:1,phip:0,end:1},{x:4000,v:1,vp:0,phi:1,phip:0,end:2}]);
  assert.deepEqual(ss.tw, [{end:1,pos:0,warpFix:false},{end:2,pos:4000,warpFix:false}]); assert.equal(ss.ss2,120); assert.equal(ss.cant,false); assert.equal(ss.name,'ss'); assert.equal(ss.custom,null);
});
test('strut effective-length defaults from the end fixities (P360 Table 6.2 / BS 5950 Table 22 style [verify]); the L_E input overrides both axes', () => {
  const k=(p,ov,le)=>JSON.parse(run(`(()=>{ S.L=4; S.ends=endsPreset('${p}',${JSON.stringify(ov||{})}); S.leFactor=${le==null? "null" : le}; const d=lcrDefaults(S); return JSON.stringify([d.Ky,d.Kz,d.mechanismY,d.mechanismZ,d.override]); })()`));
  assert.deepEqual(k('ss'), [1,1,false,false,false]);
  assert.deepEqual(k('fixed-fixed'), [0.7,0.7,false,false,false]);
  assert.deepEqual(k('fixed-pinned'), [0.85,0.85,false,false,false]);
  assert.deepEqual(k('cantilever'), [2,2,false,false,false]);
  assert.deepEqual(k('guided-fixed'), [1.2,0.7,false,false,false]);        // y-y: fixed + guided (sway) 1.2 L; z-z: R_z held both ends 0.7 L
  assert.deepEqual(k('pinned-guided'), [2,0.85,false,false,false]);       // y-y: pinned + guided 2.0 L (theoretical); z-z: R_z at End 2 only 0.85 L
  assert.deepEqual(k('ss',{},1.5), [1.5,1.5,false,false,true]);
  assert.deepEqual(k('ss',{e2:{uy:false}}), [1,null,false,true,false]);   // z-z: U_y at one end only, R_z nowhere: sway mechanism
  assert.deepEqual(k('ss',{e1:{uz:false},e2:{uz:false}}), [null,1,true,false,false]);
});
test('validation of the end model: mechanisms, lateral cantilever, torsion and axial load path throw clear messages, never NaN', () => {
  const Q=[{id:'c1',label:'ULS: 1.5Q',factors:{G:0,Q:1.5,W:0,E:0},sls:false,on:true},{id:'s1',label:'SLS: Q',factors:{G:0,Q:1,W:0,E:0},sls:true,on:true}];
  const thr=(over,re)=>{ reset(Object.assign({L:4,loads:[{type:'udl',x1:0,x2:4,w:5,case:'Q'}],combos:Q},over)); assert.throws(()=>run('analyse()'), re); };
  thr({ends:ENDS('ss',{e2:{uz:false}})}, /End 2 has no vertical restraint and End 1 does not restrain rotation: mechanism/);
  thr({ends:ENDS('ss',{e1:{uz:false}})}, /End 1 has no vertical restraint and End 2 does not restrain rotation: mechanism/);
  thr({ends:ENDS('ss',{e1:{uz:false},e2:{uz:false}})}, /Neither end restrains vertical translation/);
  thr({ends:ENDS('ss'), hinges:[{pos:2}]}, /mechanism.*internal hinge/);
  thr({ends:ENDS('ss',{e1:{uz:false},e2:{ry:true}})}, /root at End 1/);
  thr({restraint:'ltb', ends:ENDS('ss',{e1:{uy:false},e2:{uy:false}})}, /neither end restrains lateral translation/);
  thr({restraint:'ltb', ends:ENDS('ss',{e1:{rx:false},e2:{rx:false}})}, /no end restrains both U<sub>y<\/sub> and R<sub>x<\/sub>/);
  thr({restraint:'ltb', ends:ENDS('ss',{e2:{uy:false}})}, /lateral cantilever; that end must also restrain R<sub>z<\/sub>/);
  thr({eccOn:true, ends:ENDS('ss',{e1:{rx:false},e2:{rx:false}}), loads:[{type:'udl',x1:0,x2:4,w:5,case:'Q',e:50}]}, /torque but neither end restrains twist/);
  thr({axial:100, ends:ENDS('ss',{e1:{ux:false}})}, /neither end restrains axial translation/);
  thr({axial:100, ends:ENDS('ss',{e2:{uy:false}})}, /Strut buckling z-z.*sway mechanism/);
  thr({leFactor:-1}, /Effective length factor/);
  thr({ends:null}, /needs its two ends/);
  // both ends U_x: allowed, printed as statically indeterminate
  reset({L:4,axial:100,ends:ENDS('ss',{e2:{ux:true}}),loads:[{type:'udl',x1:0,x2:4,w:5,case:'Q'}],combos:Q});
  const c1=run('checks(analyse())'); assert.ok(c1.advisory.some(m=>/axial statically indeterminate: N taken as applied/.test(m)));
  // a lateral cantilever (U_y at End 1 only with R_z + R_x) is allowed and its warping condition is stated
  reset({L:4,restraint:'ltb',ends:ENDS('ss',{e1:{rz:true},e2:{uy:false,rx:false}}),loads:[{type:'udl',x1:0,x2:4,w:5,case:'Q'}],combos:Q});
  const c2=run('checks(analyse())'); assert.ok(c2.advisory.some(m=>/Lateral cantilever: End 1 is the only end holding U<sub>y<\/sub>.*warping is free/.test(m))); assert.ok(c2.ltb.Mcr>0 && isFinite(c2.ltb.Mcr));
  // a single hinge in a propped member is stable (fixed + hinge + pin)
  reset({L:4,ends:ENDS('fixed-pinned'),hinges:[{pos:2}],loads:[{type:'udl',x1:0,x2:4,w:5,case:'Q'}],combos:Q});
  const Mh=run('(()=>{ const a=analyse(); return interpAt(a.governM.fb.xs,a.governM.fb.M,2000); })()'); assert.ok(Math.abs(Mh)<1e-3*1e6, 'hinge moment '+Mh);
});
test('BS high shear resistance participates in the verdict', () => {
  reset({code:'BS5950'});
  const r=run(`(()=>{ const a=analyse(); Object.assign(a,{Mmax:420,Vmax:0.95*0.6*a.py*a.sec.tw*a.sec.D/1000,Mq:420,Mh:420,Mq3:420,M24:420}); return checks(a); })()`);
  assert.ok(r.Mcx<420); assert.equal(r.pass,false); assert.ok(r.utils.some(u=>u.val>1));
});
test('BS minor-axis input cannot be silently ignored', () => {
  reset({code:'BS5950',Mz:10000}); assert.equal(run('checks(analyse()).pass'),false);
});
test('invalid axial, area and override inputs are rejected', () => {
  for(const x of [{axial:NaN},{Mz:Infinity},{anet:-1},{anet:1e8},{mLTo:-1},{mxo:0},{C1o:-1},{Ke:0}]) {
    reset(x); assert.throws(()=>run('analyse()'), undefined, JSON.stringify(x));
  }
});
test('signed dead factor applies to automatic self weight', () => {
  reset(); const r=run(`comboLoads({factors:{G:-1,Q:0,W:0,E:0}})`);
  assert.ok(r.some(l=>l.isAutoSelfWeight&&l.w1>0));
});
test('EC channel compression evaluates torsional-flexural buckling (cl 6.3.1.4) instead of blocking (19 Sep 2026, G3 item 10)', () => {
  reset({family:'pfc',axial:1});
  const r=run('(()=>{ const c=checks(analyse()); return {pass:c.pass, uns:c.unsupported, tfb:c.buck&&c.buck.tfb, names:c.utils.map(u=>u.name)}; })()');
  assert.ok(!r.uns.some(s=>/torsional-flexural/i.test(s)), 'no 6.3.1.4 block'); assert.ok(r.tfb && r.tfb.ok && r.tfb.NbT>0);
  assert.ok(r.names.some(n=>/6\.3\.1\.4/.test(n)), 'verdict entry');
});
test('EC high shear plus axial force away from peak moment enters the verdict through cl 6.2.10 (19 Sep 2026, G3 item 7)', () => {
  reset({axial:1});
  const r=run(`(()=>{ const a=analyse(), res=a.ulsResults[0]; res.fb={xs:[0,500,1000],V:[0,500000,0],M:[10e6,5e6,0]}; res.Mpos=0; res.Mmax=10e6; a.Mmax=10;a.Mpos=0;a.Vmax=500; return checks(a); })()`);
  assert.ok(!r.unsupported.some(s=>/6.2.10/.test(s)), 'no 6.2.10 block'); assert.ok(r.mvn && r.mvn.x===500 && r.mvn.rho>0);
  assert.ok(r.utils.some(u=>/6\.2\.10/.test(u.name)), 'verdict entry');
});
test('EC hollow high shear away from peak moment is checked with the two-web M_v,Rd (19 Sep 2026, G3 item 12)', () => {
  reset({family:'rhs'});
  const r=run(`(()=>{ const a=analyse(), v=avEC3(a.sec)*a.py/Math.sqrt(3); const res=a.ulsResults[0]; res.fb={xs:[0,500,1000],V:[0,0.8*v,0],M:[1e6,0.95e6,0]}; res.Mpos=0;res.Mmax=1e6;a.Mmax=1;a.Mpos=0;a.Vmax=0.8*v/1000;const c=checks(a); return {c,sec:a.sec,fy:a.py}; })()`);
  const c2=r.c, sec=r.sec;
  assert.ok(!c2.unsupported.some(s=>/shear/i.test(s)), 'no high-shear block'); assert.ok(c2.coex && c2.coex.x===500 && /two webs/.test(c2.coex.form), JSON.stringify(c2.coex));
  // rho = (2 x 0.8 - 1)^2 = 0.36; M_v,Rd = (W_pl,y - rho t (h - 2t)^2/2) f_y [hand-derived, RHS 200 x 100 x 8]
  near(c2.coex.rho,0.36,1e-9); near(c2.coex.MvRd,(sec.Sx*1e3-0.36*sec.tf*Math.pow(sec.D-2*sec.tf,2)/2)*r.fy/1e6,1e-9);
});
test('EC imposed minor bending is combined with torsion or explicitly blocked', () => {
  reset({eccOn:true,Mz:0.1,loads:[{type:'udl',x1:0,x2:1,w:0.1,case:'Q',e:10}]});
  const r=run('checks(analyse())'); assert.equal(r.pass,false); assert.ok(r.unsupported.some(s=>/torsion/i.test(s)));
});
test('code switch changes untouched defaults but preserves custom combinations', () => {
  reset(); run(`setDesignCode('BS5950')`); near(run('S.combos[0].factors.G'),1.4); near(run('S.combos[0].factors.Q'),1.6); near(run('S.E'),205000);
  run(`setDesignCode('EC3')`); near(run('S.combos[0].factors.G'),1.35); near(run('S.combos[0].factors.Q'),1.5);
  run(`S.combos[0].factors.G=1.1;setDesignCode('BS5950')`); near(run('S.combos[0].factors.G'),1.1);
});
test('cold-formed SHS EC classification uses h-3t, BS retains its own ratio', () => {
  reset({family:'shs',shsType:'CF',shsKey:'150x150x4.0'});
  const r=run('activeSection()'); near(r.dt,(r.D-3*r.tf)/r.tf);
  run(`S.code='BS5950'`); near(run('activeSection().dt'),r.D/r.tf-5,0.005);
});
test('SHS torsional resistance never borrows a thicker section', () => {
  reset({family:'shs',shsKey:'40x40x3.0',eccOn:true});
  assert.equal(run('activeSection().tp'),null);
  near(run('ctBoxEN10210(activeSection()).Ct'),7100,0.01);
});
test('deflection limit follows the end conditions: span/360 between two held ends, L/180 with a vertically free end; the governing SLS case is the worst utilisation', () => {
  reset({L:8,ends:ENDS('ss'),loads:[{type:'udl',x1:0,x2:8,w:20,case:'Q'}]});
  const r=run('checks(analyse())'); near(r.span,8000); near(r.dlimit,8000/360); assert.equal(r.deflCant,false);
  reset({L:4,ends:ENDS('cantilever'),loads:[{type:'point',pos:4,P:10,case:'Q'}]});
  const k=run('checks(analyse())'); near(k.span,4000); near(k.dlimit,4000/180); assert.equal(k.deflCant,true);
  reset({L:4,ends:ENDS('ss'),loads:[{type:'udl',x1:0,x2:4,w:1,case:'Q'},{type:'point',pos:2,P:10,case:'W'}],combos:[{label:'ULS',on:true,sls:false,factors:{G:0,Q:1,W:1,E:0}},{label:'udl',on:true,sls:true,factors:{G:0,Q:1,W:0,E:0}},{label:'point',on:true,sls:true,factors:{G:0,Q:0,W:1,E:0}}]});
  const s=run('analyse()'); assert.equal(s.governD.combo.label,'point'); assert.ok(Math.abs(s.slsResults[1].dmax)>Math.abs(s.slsResults[0].dmax));
});
test('active loads omitted by every ULS combination are rejected', () => {
  reset({loads:[{type:'udl',x1:0,x2:1,w:1,case:'Q'},{type:'point',pos:0.5,P:1000,case:'W'}]});
  assert.throws(()=>run('analyse()'),/omitted/);
});
test('arbitrary reversing diagram is not classified as linear from its midpoint', () => {
  reset({loads:[{type:'point',pos:0.25,P:10,case:'Q'},{type:'point',pos:0.75,P:-10,case:'Q'}]}); const r=run(`(()=>{const a=analyse();a.Mmax=10;a.governM.fb={xs:[0,250,500,750,1000],M:[0,10e6,0,-10e6,0]};return cmTableB3(a)})()`);
  near(r.Cm,1);
});
test('biaxial web classification: uniform-compression bound kept for hollow sections, I/H web unstressed by M_z (19 Sep 2026, G3 item 5)', () => {
  const r=run(`classifyEC3({isBox:true,bT:20,dt:50},1,{minorBending:true})`); assert.equal(r.cls,4);
  const i=run(`classifyEC3({kind:'I',bT:5,dt:50},1,{minorBending:true})`); assert.equal(i.cls,1); assert.equal(i.mzFlange,'outstand'); assert.equal(i.webCase,'bending');
});
test('section tables satisfy mass, elastic modulus and radius identities', () => {
  const rows=run('[...UB,...UC,...PFC,...RHS]');
  for(const s of rows){ near(s.mass,s.A*0.785,0.03);near(s.Zx,s.Ix*20/s.D,0.03);near(s.rx,Math.sqrt(s.Ix/s.A),0.03);near(s.ry,Math.sqrt(s.Iy/s.A),0.03); }
});
test('stable Gerber beam: hinge zero moment and total equilibrium', () => {
  const r=run(`(()=>{const sp=[{pos:0,type:'fixed'},{pos:6000,type:'pinned'}],ld=[{type:'udl',x1:0,x2:6000,w1:-10,w2:-10}],r=solveBeam(6000,210000*8e7,sp,ld,120,[3000]);const f=sfdBmd(6000,sp,ld,r.reactions);return {r,f,Mh:interpAt(f.xs,f.M,3000)};})()`);
  near(r.Mh,0,10);near(r.r.reactions.reduce((s,r)=>s+r.V,0),60000);near(r.r.reactions[1].V,15000);
});
test('uniform-moment Mcr agrees with the closed form for fork supports', () => {
  const r=run(`LTB_EIGEN.mcrEigen({E:210000,G:81000,Iz:1870e4,It:69.2e4,Iw:0.922e12,L:6000,restraints:[{x:0},{x:6000}],moment:()=>1e6,nElem:16,refine:true})`);
  const t=Math.PI**2*210000*1870e4/6000**2;
  near(r.Mcr,t*Math.sqrt(0.922e12/(1870e4)+81000*69.2e4/t),1e-5);
  assert.ok(r.converged); near(r.McrRev,r.Mcr,1e-5);
});
test('LTB eigen: R_z restrained at both ends (laterally clamped) raises Mcr against fork ends by the SN003a k = 0.5 factor within 10 % (UDL C1 1.127 -> 0.972, central point load 1.348 -> 1.05, k_w = 1)', () => {
  const Q=[{id:'c1',label:'ULS: 1.5Q',factors:{G:0,Q:1.5,W:0,E:0},sls:false,on:true},{id:'s1',label:'SLS: Q',factors:{G:0,Q:1,W:0,E:0},sls:true,on:true}];
  const mcr=(ends,loads)=>{ reset({restraint:'ltb',L:8,ends,loads,combos:Q}); return run('checks(analyse()).ltb.Mcr'); };
  const sec=run('activeSection()'), E=210000, G=81000, Iz=sec.Iy*1e4, It=sec.J*1e4, Iw=sec.Iw*1e12, L=8000;
  // SN003a: Mcr = C1 pi^2 E Iz/(kL)^2 sqrt[(k/kw)^2 Iw/Iz + (kL)^2 G It/(pi^2 E Iz)], k = 1 fork ends, k = 0.5 lateral bending v' held at both ends
  const cf=(k,kw,C1)=>C1*Math.PI**2*E*Iz/(k*L)**2*Math.sqrt((k/kw)**2*Iw/Iz+(k*L)**2*G*It/(Math.PI**2*E*Iz))/1e6;
  for (const [name,loads,C1k1,C1k05] of [['UDL',[{type:'udl',x1:0,x2:8,w:20,case:'Q'}],1.127,0.972],['central point load',[{type:'point',pos:4,P:60,case:'Q'}],1.348,1.05]]) {
    const fork=mcr(ENDS('ss'),loads), clamped=mcr(ENDS('ss',{e1:{rz:true},e2:{rz:true}}),loads);
    assert.ok(clamped>fork*1.3, name+': clamped ends raise Mcr: '+fork+' -> '+clamped);
    const rEigen=clamped/fork, rClosed=cf(0.5,1,C1k05)/cf(1,1,C1k1);
    assert.ok(Math.abs(rEigen/rClosed-1)<0.10, name+': eigen ratio '+rEigen.toFixed(3)+' vs SN003a k = 0.5 ratio '+rClosed.toFixed(3));
    assert.ok(Math.abs(rEigen/rClosed-1)<0.03, name+': actually within 3 %');
  }
  // one end clamped only: between the two
  const one=mcr(ENDS('ss',{e1:{rz:true}}),[{type:'udl',x1:0,x2:8,w:20,case:'Q'}]);
  const fork=mcr(ENDS('ss'),[{type:'udl',x1:0,x2:8,w:20,case:'Q'}]), both=mcr(ENDS('ss',{e1:{rz:true},e2:{rz:true}}),[{type:'udl',x1:0,x2:8,w:20,case:'Q'}]);
  assert.ok(one>fork && one<both, 'one clamped end lies between fork and both: '+[fork,one,both]);
  // warping restrained at both ends raises Mcr further (phi' = 0)
  const warp=mcr(ENDS('ss',{e1:{warp:true},e2:{warp:true}}),[{type:'udl',x1:0,x2:8,w:20,case:'Q'}]);
  assert.ok(warp>fork*1.1, 'warping-fixed ends: '+fork+' -> '+warp);
});
test('LTB result is independent of arbitrary reference moment magnitude', () => {
  const results=run(`[1e6,7e6].map(m=>LTB_EIGEN.mcrEigen({E:210000,G:81000,Iz:1870e4,It:69.2e4,Iw:0.922e12,L:6000,restraints:[{x:0},{x:6000}],moment:()=>m,nElem:16,refine:true}).Mcr)`);
  near(results[0],results[1],1e-5);
});
test('applied point couple: reaction signs and moment jump close', () => {
  const r=run(`(()=>{const sp=[{pos:0,type:'pinned'},{pos:6000,type:'pinned'}],ld=[{type:'moment',pos:3000,M:12e6}],r=solveBeam(6000,210000*8e7,sp,ld);return {r,f:sfdBmd(6000,sp,ld,r.reactions)};})()`);
  near(r.r.reactions[0].V,2000); near(r.r.reactions[1].V,-2000); near(r.f.M.at(-1),0,10);
});
test('fixed-fixed UDL gives wL2/12 support moments and wL4/384EI displacement', () => {
  const r=run(`solveBeam(6000,210000*8e7,[{pos:0,type:'fixed'},{pos:6000,type:'fixed'}],[{type:'udl',x1:0,x2:6000,w1:-10,w2:-10}])`);
  near(r.reactions[0].V,30000);near(r.reactions[0].M,30e6);near(r.reactions[1].M,-30e6);near(Math.min(...r.w),-10*6000**4/(384*210000*8e7));
});
test('triangular loading gives wL/6 and wL/3 support reactions', () => {
  const r=run(`solveBeam(6000,210000*8e7,[{pos:0,type:'pinned'},{pos:6000,type:'pinned'}],[{type:'udl',x1:0,x2:6000,w1:0,w2:-10}])`);
  near(r.reactions[0].V,10000);near(r.reactions[1].V,20000);
});
test('BS checks each moment diagram for mLT, including the lower peak', () => {
  reset({code:'BS5950',leFactor:6});
  const r=run(`(()=>{const a=analyse(),factors={G:0,Q:1,W:0,E:0}; const make=(label,mm)=>({combo:{label,factors},fb:{xs:[0,250,500,750,999.9999,1000],M:mm,V:[0,0,0,0,0,0]},Mmax:Math.max(...mm),Mpos:0,Vmax:0});const high=make('high peak',[400e6,300e6,200e6,100e6,0,0]);const uniform=make('lower uniform',[300e6,300e6,300e6,300e6,300e6,0]);a.ulsResults=[high,uniform];a.governM=high;Object.assign(a,analysisForCombination(a,high));a.ulsResults=[high,uniform];return checks(a);})()`);
  assert.equal(r.utils[2].combo,'lower uniform');
  near(r.utils[2].val,Math.max(...r.combinationChecks.map(r=>r.utils[2].val)));
});
test('EC member interaction checks every combination', () => {
  reset({axial:100});
  const r=run(`(()=>{const a=analyse(),factors={G:0,Q:1,W:0,E:0};const make=(label,m)=>({combo:{label,factors},fb:{xs:[0,250,500,750,999.9999,1000],M:m,V:[0,0,0,0,0,0]},Mmax:Math.max(...m),Mpos:0,Vmax:0});const high=make('high peak',[400e6,300e6,200e6,100e6,0,0]),flat=make('lower uniform',[300e6,300e6,300e6,300e6,300e6,0]);a.ulsResults=[high,flat];a.governM=high;a.Mmax=400;const cl=classifyEC3(a.sec,epsEC3(a.py),{NEd:100000,fy:a.py});const all=annexB2(a,a.sec,a.py,cl,500,true,false);const singles=a.ulsResults.map(res=>annexB2(analysisForCombination(a,res),a.sec,a.py,cl,500,true,false));return {all,singles};})()`);
  near(Math.max(r.all.u1,r.all.u2),Math.max(...r.singles.flatMap(s=>[s.u1,s.u2])));
});
test('warping torsion consistently uses the entered elastic modulus', () => {
  reset({eccOn:true,loads:[{type:'udl',x1:0,x2:1,w:0.1,case:'Q',e:10}]});
  const a=run('analyse()');run('S.E=105000');const b=run('analyse()');
  near(b.torsO.aa/a.torsO.aa,Math.sqrt(0.5));assert.ok(b.torsO.sls.phiMax>a.torsO.sls.phiMax);
});
test('hot-finished RHS selects the UK NA LTB curve by aspect ratio', () => {
  reset({family:'rhs',restraint:'ltb'});assert.equal(run('checks(analyse()).ltb.curve.curve'),'b');
});

// ---- Mcr method switch: 'eigen' (FE eigensolver, default) | 'standard' (closed form) ----
test('Mcr method defaults to eigen and the demo results are unchanged', () => {
  assert.equal(run('DEMO.mcrMethod'),'eigen');
  reset({L:8,ends:ENDS('ss'),loads:[{type:'udl',x1:0,x2:8,w:19.7,case:'G'},{type:'udl',x1:0,x2:8,w:19.8,case:'Q'}]});
  assert.equal(run('S.mcrMethod'),'eigen');
  const full=run('checks(analyse()).utils.map(u=>u.val)');     // restrained demo (AUDIT.md figures)
  near(full[0],0.303499,1e-5); near(full[1],0.912166,1e-5);
  near(full[2],1.241569,1e-5);   // 20 Sep 2026: the SLS default became 1.0G + 1.0Q (was Q only, 0.609935): x (19.7 + 19.8 + 0.8044 self-weight)/19.8 = 2.03558 [hand-derived]
  run("S.restraint='ltb'");
  const c=run('checks(analyse())');                             // unrestrained demo, eigen figures before the switch existed
  assert.equal(c.mcrMethod,'eigen'); assert.equal(c.ltb.eigen,true); assert.equal(c.ltb.mcrMethod,'eigen');
  near(c.ltb.Mcr,257.9741062880164,1e-6); near(c.ltb.MbRd,218.6910610529012,1e-6); near(c.ltbUtil,2.099068512326227,1e-6);
  near(c.ltb.McrEigen,c.ltb.Mcr,1e-9); near(c.ltb.McrStandard,257.0619060555597,1e-6); near(c.ltb.McrRatio,c.ltb.Mcr/257.0619060555597,1e-9);
  assert.equal(JSON.stringify([c.ltb.c1in.M1,c.ltb.c1in.M2,c.ltb.c1in.psi,c.ltb.c1in.mu]),'[0,0,1,300]'); near(c.ltb.c1in.Mo,Math.abs(c.Mx),1e-6);
});
test('standard Mcr method: demo UB 457x191x82 8 m UDL gives C1 = 1.127 and the SN003a closed form', () => {
  reset({L:8,restraint:'ltb',mcrMethod:'standard',ends:ENDS('ss'),loads:[{type:'udl',x1:0,x2:8,w:19.7,case:'G'},{type:'udl',x1:0,x2:8,w:19.8,case:'Q'}]});
  const c=run('checks(analyse())'), sec=run('activeSection()');
  assert.equal(c.mcrMethod,'standard'); assert.equal(c.ltb.mcrMethod,'standard'); assert.ok(!c.ltb.eigen);
  near(c.C1,1.127,1e-9); assert.match(c.c1label,/simply supported \+ uniformly distributed load/); assert.equal(c.ltb.c1route,'uniform');
  const E=210000,G=81000,L=8000,Iz=sec.Iy*1e4,It=sec.J*1e4,Iw=sec.Iw*1e12;
  const expected=1.127*Math.PI**2*E*Iz/L**2*Math.sqrt(Iw/Iz+L**2*G*It/(Math.PI**2*E*Iz))/1e6;   // kN.m
  near(c.ltb.Mcr,expected,1e-9); near(c.ltb.McrStandard,expected,1e-9); assert.equal(c.ltb.McrEigen,null); assert.equal(c.ltb.McrRatio,undefined);
  near(c.ltb.lamLTmcr,Math.sqrt(sec.Sx*1e3*c.fy/(expected*1e6)),1e-9);
  assert.equal(JSON.stringify([c.ltb.c1in.M1,c.ltb.c1in.M2,c.ltb.c1in.psi,c.ltb.c1in.mu]),'[0,0,1,300]'); near(c.ltb.c1in.Mo,Math.abs(c.Mx),1e-6);
  assert.equal(JSON.stringify(c.ltb.c1seg),JSON.stringify({xa:0,xb:8000,whole:true}));
});
test('standard and eigen Mcr agree within 1% for a uniform moment (two equal end moments)', () => {
  const fix={L:6,restraint:'ltb',ends:ENDS('ss'),
    loads:[{type:'moment',pos:0,M:100,case:'Q'},{type:'moment',pos:6,M:-100,case:'Q'}],
    combos:[{id:'c1',label:'ULS: 1.5Q',factors:{G:0,Q:1.5,W:0,E:0},sls:false,on:true},{id:'s1',label:'SLS',factors:{G:0,Q:1,W:0,E:0},sls:true,on:true}]};
  reset({...fix,mcrMethod:'standard'}); const s=run('checks(analyse())');
  reset({...fix,mcrMethod:'eigen'});    const e=run('checks(analyse())');
  assert.equal(s.ltb.c1route,'end-moment'); near(s.C1,1.0,1e-6); near(s.ltb.c1in.psi,1,1e-6); near(s.ltb.c1in.M2,-150,1e-6);
  near(s.ltb.Mcr,e.ltb.Mcr,0.01); near(e.ltb.McrStandard,s.ltb.Mcr,1e-9); near(e.ltb.McrRatio,1,0.01);
  const t=Math.PI**2*210000*1870e4/6000**2;                     // closed form, uniform moment, C1 = 1
  near(s.ltb.Mcr,t*Math.sqrt(0.922e12/1870e4+81000*69.2e4/t)/1e6,1e-6);
});
test('standard Mcr method: cantilever with a tip load takes the SN006a route', () => {
  reset({L:3,restraint:'ltb',mcrMethod:'standard',ends:ENDS('cantilever'),loads:[{type:'point',pos:3,P:20,case:'Q'}]});
  const c=run('checks(analyse())');
  assert.equal(c.ltb.cant,true); assert.equal(c.ltb.c1route,'sn006a'); assert.ok(c.ltb.C>1); assert.ok(c.ltb.Mcr>0);
  near(c.ltb.Mcr,c.ltb.C*c.ltb.Mcr0,1e-9); assert.equal(c.ltb.McrEigen,null); near(c.ltb.McrStandard,c.ltb.Mcr,1e-9);
  assert.match(c.ltb.c1label,/cantilever SN006a/); near(c.ltb.c1in.M1,0,1e-6); assert.ok(c.ltb.c1in.M2<0);
  reset({L:3,restraint:'ltb',mcrMethod:'eigen',ends:ENDS('cantilever'),loads:[{type:'point',pos:3,P:20,case:'Q'}]});
  const e=run('checks(analyse())'); assert.equal(e.ltb.eigen,true); near(e.ltb.McrStandard,c.ltb.Mcr,1e-9); assert.ok(Math.abs(e.ltb.McrRatio-1)<0.05);
});
test('mcrMethod survives a code switch and an unknown value is rejected', () => {
  reset({mcrMethod:'standard'}); run("setDesignCode('BS5950')"); assert.equal(run('S.mcrMethod'),'standard');
  run("setDesignCode('EC3')"); assert.equal(run('S.mcrMethod'),'standard');
  reset({restraint:'ltb',mcrMethod:'bogus'}); assert.throws(()=>run('analyse()'),/Unknown Mcr method/);
  reset({restraint:'ltb',mcrMethod:'standard'}); assert.equal(run('checks(analyse()).mcrMethod'),'standard');
  reset({restraint:'ltb'}); run('delete S.mcrMethod'); assert.equal(run('checks(analyse()).mcrMethod'),'eigen');   // absent = default
});
test('standard C1 recognises the tabulated shapes only on a simply supported segment', () => {
  reset({L:8,restraint:'ltb',mcrMethod:'standard',ends:ENDS('ss'),ltbRestraints:[{pos:4,v:true,phi:true}],loads:[{type:'point',pos:2,P:10,case:'Q'},{type:'point',pos:6,P:10,case:'Q'}]});
  const c=run('checks(analyse())');                             // quarter-point loads: not a tabulated row; the mid-span restraint makes the member two bays, advisory printed
  assert.equal(c.ltb.c1route,'serna'); assert.ok(c.C1>1&&c.C1<1.348); assert.ok(c.advisory.some(s=>/ONE segment/.test(s)));
  reset({L:6,restraint:'ltb',mcrMethod:'standard',ends:ENDS('fixed-pinned'),loads:[{type:'udl',x1:0,x2:6,w:15,case:'Q'}]});
  const p=run('checks(analyse())');                             // propped cantilever under UDL is not a linear end-moment diagram
  assert.equal(p.ltb.c1route,'serna'); near(p.ltb.c1in.psi,0,1e-6); near(p.ltb.c1in.mu,-1,1e-3);
});

// ---- Review fixes, Sep 2026: the standard route honours its label ----
test('standard route: the SN003a Mcr chain is the design basis, MbRd = MbMcr feeds Eq 6.62 and agrees with the eigen run (MIX-03)', () => {
  const fix={family:'uc',ucKey:'254 x 254 x 73',restraint:'ltb',L:6,axial:500,Mz:15,ends:ENDS('ss'),
    loads:[{type:'udl',x1:0,x2:6,w:6.5,case:'G'},{type:'udl',x1:0,x2:6,w:8,case:'Q'}]};
  reset({...fix,mcrMethod:'standard'}); const s=run('checks(analyse())');
  reset({...fix,mcrMethod:'eigen'});    const e=run('checks(analyse())');
  near(s.ltb.MbRd,s.ltb.MbMcr,1e-12);                              // Mcr route IS the design value
  assert.ok(s.ltb.MbSimp<s.ltb.MbMcr, 'P362 simplified value kept only as a comparison');
  near(s.ltbUtil,s.Mx/s.ltb.MbMcr,1e-12);
  assert.match(s.ltbBasis,/^M<sub>cr<\/sub> method \(SN003a closed form/);
  near(s.buck.MbRdI,s.ltb.MbMcr,1e-12);                             // annexB2 receives the Mcr-route value
  const ratio=e.ltb.Mcr/s.ltb.Mcr;                                  // 478.2 / 475.3
  assert.ok(Math.abs(ratio-1)<0.01);
  assert.ok(Math.abs(s.buck.u2-e.buck.u2)<0.01*e.buck.u2, `Eq 6.62 standard ${s.buck.u2} vs eigen ${e.buck.u2}`);
  assert.equal(s.pass,true); assert.equal(e.pass,true);
  const u2s=s.utils.find(u=>/6\.62/.test(u.name)).val; assert.ok(u2s<1);
});
test('standard route: Mb,Rd is capped at the shear-reduced Mc,Rd on both routes (UB-35 with LTB)', () => {
  const fix={ubKey:'914 x 419 x 388',restraint:'ltb',L:3,ends:ENDS('ss'),loads:[{type:'point',pos:1.5,P:3000,case:'Q'}]};
  reset({...fix,mcrMethod:'standard'}); const s=run('checks(analyse())');
  reset({...fix,mcrMethod:'eigen'});    const e=run('checks(analyse())');
  assert.ok(s.McRd<s.Wy*s.fy/1e6, 'moment resistance is shear-reduced (cl 6.2.8(3))');
  near(s.ltb.MbRd,s.McRd,1e-9); near(s.ltb.MbMcr,s.McRd,1e-9); near(s.ltb.MbSimp,s.McRd,1e-9);
  near(e.ltb.MbRd,s.McRd,1e-9); near(s.ltbUtil,e.ltbUtil,1e-9);
});
test('standard route: per-load z_g is the closed-form load height (UB-04 with za = 0)', () => {
  const fix={ubKey:'305 x 165 x 40',restraint:'ltb',L:6,eccOn:true,za:0,ends:ENDS('ss'),
    loads:[{type:'udl',x1:0,x2:6,w:5,case:'G',e:0,zg:152},{type:'udl',x1:0,x2:6,w:6,case:'Q',e:0,zg:152}]};
  reset({...fix,mcrMethod:'standard'}); const s=run('checks(analyse())');
  near(s.ltb.zg,152,1e-9); assert.equal(s.ltb.zgUsed,true); assert.equal(s.ltb.zgSource,'loads'); near(s.C1,1.127,1e-9); near(s.ltb.C2,0.454,1e-9);
  const sec=run('activeSection()'), E=210000,G=81000,L=6000,Iz=sec.Iy*1e4,It=sec.J*1e4,Iw=sec.Iw*1e12,T1=Math.PI**2*E*Iz/L**2,t=0.454*152;
  near(s.ltb.Mcr,1.127*T1*(Math.sqrt(Iw/Iz+G*It/T1+t*t)-t)/1e6,1e-9);
  reset({...fix,mcrMethod:'standard',za:152}); const s2=run('checks(analyse())'); near(s2.ltb.Mcr,s.ltb.Mcr,1e-12);   // same as the global za
  reset({...fix,mcrMethod:'eigen'}); const e=run('checks(analyse())');
  assert.ok(Math.abs(e.ltb.Mcr/s.ltb.Mcr-1)<0.02, `eigen ${e.ltb.Mcr} vs standard ${s.ltb.Mcr}`);
  near(e.ltb.McrStandard,s.ltb.Mcr,1e-9);
  // an upward load hung below the shear centre is destabilising: its height enters with the sign reversed
  reset({...fix,mcrMethod:'standard',loads:[{type:'udl',x1:0,x2:6,w:-5,case:'G',e:0,zg:-152},{type:'udl',x1:0,x2:6,w:-6,case:'Q',e:0,zg:-152}]});
  near(run('checks(analyse()).ltb.zg'),152,1e-9);
});
test('standard route: a destabilising load height on a non-tabulated diagram blocks PASS, is conservative when stabilising, and the fixed-ended SN003a rows carry C2', () => {
  const off={ubKey:'406 x 178 x 54',restraint:'ltb',mcrMethod:'standard',L:7,eccOn:true,ends:ENDS('ss'),
    loads:[{type:'point',pos:2.45,P:12,case:'G'},{type:'point',pos:2.45,P:32,case:'Q'}]};
  reset({...off,za:201}); const b=run('checks(analyse())');           // off-centre point load, top flange: Serna, no C2
  assert.equal(b.ltb.c1route,'serna'); assert.equal(b.ltb.C2,null); assert.equal(b.ltb.zgUsed,false); assert.equal(b.ltb.zgBlocked,true);
  assert.ok(b.unsupported.some(m=>/C<sub>2<\/sub> only for the simply supported and fixed-ended/.test(m))); assert.equal(b.pass,false);
  assert.match(b.ltb.zgNote,/NOT applied/);
  reset({...off,za:-201}); const st=run('checks(analyse())');         // bottom flange: ignored, conservative, no block
  assert.equal(st.ltb.zgBlocked,false); assert.match(st.ltb.zgNote,/stabilising/); near(st.ltb.Mcr,b.ltb.Mcr,1e-12);
  reset({...off,za:201,destab:true}); const d=run('checks(analyse())'); // BS-style x1.2 carries the height instead
  assert.equal(d.ltb.zgBlocked,false); assert.ok(d.advisory.some(m=>/represented by the destabilising/.test(m))); near(d.LE,1.2*7000,1e-9);
  // fixed-ended UDL and central point load: SN003a Table 3.2 rows 3 and 4 with C2 published
  const ff={ubKey:'406 x 140 x 39',restraint:'ltb',mcrMethod:'standard',L:8,eccOn:true,za:203,ends:ENDS('fixed-fixed')};
  reset({...ff,loads:[{type:'udl',x1:0,x2:8,w:5,case:'G'},{type:'udl',x1:0,x2:8,w:6,case:'Q'}]}); const fu=run('checks(analyse())');
  assert.equal(fu.ltb.c1route,'fixed-uniform'); near(fu.C1,2.578,1e-9); near(fu.ltb.C2,1.554,1e-9); assert.equal(fu.ltb.zgUsed,true); assert.equal(fu.unsupported.length,0);
  reset({...ff,mcrMethod:'eigen',loads:[{type:'udl',x1:0,x2:8,w:5,case:'G'},{type:'udl',x1:0,x2:8,w:6,case:'Q'}]}); const fe=run('checks(analyse())');
  assert.ok(fe.ltb.Mcr/fu.ltb.Mcr>0.95 && fe.ltb.Mcr/fu.ltb.Mcr<1.15, `fixed-fixed UDL top flange: eigen ${fe.ltb.Mcr} vs SN003a ${fu.ltb.Mcr}`);
  reset({...ff,loads:[{type:'point',pos:4,P:40,case:'Q'}]}); const fp=run('checks(analyse())');
  assert.equal(fp.ltb.c1route,'fixed-point'); near(fp.C1,1.683,1e-9); near(fp.ltb.C2,1.645,1e-9); assert.equal(fp.ltb.zgUsed,true);
  // the SN003a C2 term and the x1.2 switch together: applied, with an overlap advisory
  reset({ubKey:'533 x 210 x 92',restraint:'ltb',mcrMethod:'standard',L:8,leFactor:1.2,destab:true,eccOn:true,za:266,ends:ENDS('ss'),
    loads:[{type:'udl',x1:0,x2:8,w:9,case:'G'},{type:'udl',x1:0,x2:8,w:11,case:'Q'}]});
  const ov=run('checks(analyse())'); assert.equal(ov.ltb.zgUsed,true); near(ov.LE,1.2*1.2*8000,1e-9); assert.ok(ov.advisory.some(m=>/counted twice/.test(m)));
});
test('SN003a rows are recognised from the load list: a triangular load and quarter-point loads take the Serna route', () => {
  reset({ubKey:'356 x 171 x 45',restraint:'ltb',mcrMethod:'standard',L:7,ends:ENDS('ss'),
    loads:[{type:'udl',x1:0,x2:7,w:3,case:'G'},{type:'trap',x1:0,x2:7,w1:0,w2:11,case:'Q'}]});
  const t=run('checks(analyse())'); assert.equal(t.ltb.c1route,'serna'); assert.ok(t.C1>1.127 && t.C1<1.2); assert.equal(t.ltb.C2,null);
  reset({ubKey:'406 x 178 x 54',restraint:'ltb',mcrMethod:'standard',L:8,ends:ENDS('ss'),
    loads:[{type:'point',pos:2,P:30,case:'Q'},{type:'point',pos:4,P:30,case:'Q'},{type:'point',pos:6,P:30,case:'Q'}]});
  const q=run('checks(analyse())'); assert.equal(q.ltb.c1route,'serna'); assert.equal(q.ltb.C2,null);
  reset({ubKey:'406 x 178 x 54',restraint:'ltb',mcrMethod:'standard',L:7,ends:ENDS('ss'),loads:[{type:'point',pos:3.5,P:32,case:'Q'}]});
  assert.equal(run('checks(analyse()).ltb.c1route'),'point');
  // UDL + in-span couple is not the UDL row
  reset({restraint:'ltb',mcrMethod:'standard',L:8,ends:ENDS('ss'),loads:[{type:'udl',x1:0,x2:8,w:6,case:'Q'},{type:'moment',pos:4,M:72,case:'Q'}]});
  assert.equal(run('checks(analyse()).ltb.c1route'),'serna');
});
test('"Not Loaded" is decided from the loads: equal end couples with self-weight take the end-moment route with psi = 1 (UB-25)', () => {
  reset({ubKey:'356 x 127 x 33',restraint:'ltb',mcrMethod:'standard',L:6,ends:ENDS('ss'),loads:[{type:'moment',pos:0,M:24,case:'Q'},{type:'moment',pos:6,M:-24,case:'Q'}]});
  const c=run('checks(analyse())');
  assert.equal(c.ltb.c1route,'end-moment'); near(c.C1,1.0,1e-6); near(c.ltb.c1in.psi,1,1e-6); assert.match(c.c1label,/not loaded/);
  assert.ok(Math.abs(c.ltb.c1in.Mo)>0.05*Math.abs(c.ltb.c1in.M2), 'self-weight curvature exceeds the 5% chord band');
});
test('eigen route: the standard comparison describes the LTB-governing combination (reversing wind), sign-consistent C1 inputs', () => {
  reset({L:8,restraint:'ltb',mcrMethod:'eigen',eccOn:true,za:0,ends:ENDS('ss'),
    loads:[{type:'udl',x1:0,x2:8,w:19.7,case:'G'},{type:'udl',x1:0,x2:8,w:19.8,case:'Q'},{type:'udl',x1:0,x2:8,w:-45,case:'W',e:0,zg:-230}],
    combos:[{id:'c1',label:'ULS: 1.35G + 1.5Q',factors:{G:1.35,Q:1.5,W:0,E:0},sls:false,on:true},{id:'c2',label:'ULS: 1.0G + 1.5W',factors:{G:1.0,Q:0,W:1.5,E:0},sls:false,on:true},{id:'s1',label:'SLS',factors:{G:0,Q:1,W:0,E:0},sls:true,on:true}]});
  const c=run('checks(analyse())');
  assert.equal(c.ltb.governCombo,'ULS: 1.0G + 1.5W'); assert.ok(c.ltb.MxGov<400 && c.ltb.MxGov>350);
  assert.ok(c.ltb.c1in.Mo<0, 'Mo has the sign of the hogging governing diagram'); near(Math.abs(c.ltb.c1in.Mo),c.ltb.MxGov,1e-3);
  near(c.ltb.c1in.mu,-300,1e-9);
  assert.equal(c.ltb.std.route,'uniform'); near(c.ltb.std.zg,230,1e-9); assert.equal(c.ltb.std.zgUsed,true);   // upward load below the shear centre: destabilising
  assert.ok(c.ltb.McrRatio>0.85 && c.ltb.McrRatio<1.0, 'ratio ' + c.ltb.McrRatio);
  // the standard run of the same input describes the governing-MOMENT combination (1.35G + 1.5Q, sagging)
  run("S.mcrMethod='standard'"); const s=run('checks(analyse())'); assert.ok(s.ltb.c1in.Mo>0); near(s.ltb.zg,0,1e-9);
});
test('closed hollow section: one LTB curve allocation for both Mcr methods, exemption tagged only when lambda_LT <= 0.4', () => {
  const fix={family:'rhs',rhsKey:'300 x 100 x 8.0',restraint:'ltb',L:14,ends:ENDS('ss'),loads:[{type:'udl',x1:0,x2:14,w:1,case:'G'},{type:'udl',x1:0,x2:14,w:1.5,case:'Q'}]};
  reset({...fix,mcrMethod:'standard'}); const s=run('checks(analyse())');
  reset({...fix,mcrMethod:'eigen'});    const e=run('checks(analyse())');
  assert.equal(s.ltb.curve.curve,'c'); assert.equal(e.ltb.curve.curve,'c'); assert.equal(run('ltbCurveNA(activeSection()).curve'),'c');
  assert.equal(s.ltb.na,false); assert.equal(s.ltb.box,true); assert.ok(s.ltb.lamLTmcr>0.4 && s.ltb.MbRd<s.McRd);
  assert.match(s.ltbBasis,/curve c/); assert.ok(!/6\.3\.2\.1\(2\)/.test(s.ltbBasis));
  assert.ok(Math.abs(e.ltb.MbRd-s.ltb.MbRd)/s.ltb.MbRd<0.01);
  reset({family:'shs',shsKey:'150x150x6.3',restraint:'ltb',mcrMethod:'standard',L:4,ends:ENDS('ss'),loads:[{type:'udl',x1:0,x2:4,w:10,case:'Q'}]});
  const q=run('checks(analyse())'); assert.equal(q.ltb.na,true); near(q.ltb.MbRd,q.McRd,1e-9); assert.match(q.ltbBasis,/6\.3\.2\.2\(4\)/); assert.match(q.ltbBasis,/6\.3\.2\.1\(2\)/);
});
