const { test } = require('node:test');
const assert = require('node:assert/strict');
const { app } = require('./harness.cjs');
const c = app();
const run = x => c.run(x);
function reset(x={}) { c.reset({L:1, supports:[{pos:0,type:'pinned'},{pos:1,type:'pinned'}], loads:[{type:'udl',x1:0,x2:1,w:0.1,case:'Q'}], ...x}); }
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
  assert.throws(()=>run(`solveBeam(3000,210000*8e7,[{pos:0,type:'fixed'},{pos:1000,type:'pinned'}],[{type:'point',pos:3000,P:-1000}],120,[2000])`), /mechanism|singular|unstable/i);
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
test('EC channel compression cannot pass with unverified torsional buckling', () => {
  reset({family:'pfc',axial:1}); assert.equal(run('checks(analyse()).pass'),false);
});
test('EC high shear plus axial force away from peak moment is not omitted', () => {
  reset({axial:1});
  const r=run(`(()=>{ const a=analyse(), res=a.ulsResults[0]; res.fb={xs:[0,500,1000],V:[0,500000,0],M:[10e6,5e6,0]}; res.Mpos=0; res.Mmax=10e6; a.Mmax=10;a.Mpos=0;a.Vmax=500; return checks(a); })()`);
  assert.equal(r.pass,false); assert.ok(r.unsupported.some(s=>/6.2.10/.test(s)));
});
test('EC hollow high shear away from peak moment needs a covered interaction', () => {
  reset({family:'rhs'});
  const r=run(`(()=>{ const a=analyse(), v=avEC3(a.sec)*a.py/Math.sqrt(3); const res=a.ulsResults[0]; res.fb={xs:[0,500,1000],V:[0,0.8*v,0],M:[1e6,0.5e6,0]}; res.Mpos=0;res.Mmax=1e6;a.Mmax=1;a.Mpos=0;a.Vmax=0.8*v/1000;return checks(a); })()`);
  assert.equal(r.pass,false); assert.ok(r.unsupported.some(s=>/shear/i.test(s)));
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
test('two equal spans use the individual span for serviceability', () => {
  reset({L:8,supports:[{pos:0,type:'pinned'},{pos:4,type:'pinned'},{pos:8,type:'pinned'}],loads:[{type:'udl',x1:0,x2:8,w:20,case:'Q'}]});
  const r=run('checks(analyse())'); near(r.span,4000); near(r.dlimit,4000/360);
});
test('SLS selection is by local-span utilisation, not global displacement', () => {
  reset({L:10,supports:[{pos:0,type:'pinned'},{pos:2,type:'fixed'},{pos:10,type:'pinned'}],loads:[{type:'udl',x1:0,x2:2,w:1200,case:'Q'},{type:'udl',x1:2,x2:10,w:6,case:'W'}],combos:[{label:'ULS',on:true,sls:false,factors:{G:0,Q:1,W:1,E:0}},{label:'short',on:true,sls:true,factors:{G:0,Q:1,W:0,E:0}},{label:'long',on:true,sls:true,factors:{G:0,Q:0,W:1,E:0}}]});
  const r=run('analyse()'); assert.equal(r.governD.combo.label,'short'); assert.ok(Math.abs(r.slsResults[1].dmax)>Math.abs(r.slsResults[0].dmax)); near(r.deflection.span,2000);
});
test('active loads omitted by every ULS combination are rejected', () => {
  reset({loads:[{type:'udl',x1:0,x2:1,w:1,case:'Q'},{type:'point',pos:0.5,P:1000,case:'W'}]});
  assert.throws(()=>run('analyse()'),/omitted/);
});
test('arbitrary reversing diagram is not classified as linear from its midpoint', () => {
  reset({loads:[{type:'point',pos:0.25,P:10,case:'Q'},{type:'point',pos:0.75,P:-10,case:'Q'}]}); const r=run(`(()=>{const a=analyse();a.Mmax=10;a.governM.fb={xs:[0,250,500,750,1000],M:[0,10e6,0,-10e6,0]};return cmTableB3(a)})()`);
  near(r.Cm,1);
});
test('biaxial web classification does not use pure major-axis bending limits', () => {
  const r=run(`classifyEC3({isBox:true,bT:20,dt:50},1,{minorBending:true})`); assert.equal(r.cls,4);
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
