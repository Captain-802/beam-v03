/* ===========================================================================
   4. ORCHESTRATION   run analysis + shared checks dispatcher
   =========================================================================== */
/* Effective user loads of ONE combination (pure; reads S.loads). Returns one
   "piece" per load: {i, ld, type, case, e, zg, factor, pos (mm) | x1, x2 (mm)
   with w1, w2 (kN/m, unfactored), P (kN), M (kN.m)}. Every load is present
   (factor 0 when its case is not in the combination) so that the solver's
   x-grid is identical across combinations. The single-span model has no
   pattern combinations (19 Sep 2026 scope change): the companion
   combinations of gammaInfCompanions() are the only generated ones. */
function comboLoadPieces(combo){
  const fac=(combo&&combo.factors)||{};
  const out=[];
  S.loads.forEach((ld,i)=>{
    if(ld.isSelfWeight) return;
    const f=fac[ld.case] ?? 0;
    const base={i,ld,type:ld.type,case:ld.case,e:+(ld.e||0),zg:ld.zg,factor:f};
    if(ld.type==='point'||ld.type==='moment'){ out.push(Object.assign(base,{pos:(+ld.pos)*1000,P:+(ld.P||0),M:+(ld.M||0)})); return; }
    const x1=(+ld.x1)*1000, x2=(+ld.x2)*1000;
    const w1= ld.type==='udl'? +(ld.w||0) : +(ld.w1||0), w2= ld.type==='udl'? +(ld.w||0) : +(ld.w2||0);
    out.push(Object.assign(base,{x1,x2,w1,w2}));
  });
  return out;
}
/* gamma_G,inf companion combinations (19 Sep 2026 review finding): EN 1990
   6.4.3.1(4) - where a permanent action is favourable (a back span holding
   down an overhang, an end span holding down a lifting support) gamma_G,inf
   applies: 1.0 in the STR set B (Table A1.2(B)) and 0.9 in the EQU set A
   (Table A1.2(A)); the single-source rule (6.4.3.1(4) note, A1.3.1(1)) means
   one gamma_G over the whole member, not span by span. For every analysed
   ULS combination whose G factor exceeds 1.0 two
   companions are formed with factors.G replaced by 1.0 and 0.9 (the variable
   factors unchanged). They are solved for their REACTIONS (uplift / hold-down
   design force and the web-bearing reactions); the moment / shear envelopes
   are not extended (printed limitation). Pure. */
function gammaInfCompanions(ulsCombos){
  const out=[];
  ulsCombos.forEach(cb=>{
    const gF=cb.factors.G??0;
    if(!(gF>1+1e-9)) return;
    [[1.0,'B','STR set B','EN 1990 Table A1.2(B)'],[0.9,'A','EQU set A','EN 1990 Table A1.2(A)']].forEach(([gInf,set,setName,ref])=>{
      out.push(Object.assign({},cb,{id:(cb.id||'combo')+'#gInf'+set,label:cb.label+' [&gamma;<sub>G,inf</sub> = '+gInf.toFixed(1)+', '+setName+']',
        factors:Object.assign({},cb.factors,{G:gInf}),parent:cb,gInf,gInfSet:set,gInfRef:ref,companion:true}));
    });
  });
  return out;
}

function comboLoads(combo){
  // Always include every load (factor 0 if its case isn't in this combo) so that
  // load/support positions   and therefore the solver's x-grid   are identical
  // across every combination. That's what makes the envelope comparison below valid.
  const loads = comboLoadPieces(combo).map(p=>{
    if(p.type==='point') return {type:'point',pos:p.pos,P:-p.P*p.factor*1000};
    if(p.type==='moment') return {type:'moment',pos:p.pos,M:p.M*p.factor*1e6};
    return {type:'udl',x1:p.x1,x2:p.x2,w1:-p.w1*p.factor,w2:-p.w2*p.factor};
  });
  const sw=selfWeightValue(activeSection()), gFactor=combo.factors.G ?? 0;
  if(gFactor!==0){
    loads.push({type:'udl',x1:0,x2:S.L*1000,w1:-sw*gFactor,w2:-sw*gFactor,isAutoSelfWeight:true});
  }
  return loads;
}
function comboHasServiceLoad(combo){
  const eps=1e-12;
  for(const ld of S.loads.filter(ld=>!ld.isSelfWeight)){
    const factor=Math.abs(combo.factors[ld.case] ?? 0);
    if(factor<eps) continue;
    if(ld.type==='point' && Math.abs(ld.P||0)>eps) return true;
    if(ld.type==='moment' && Math.abs(ld.M||0)>eps) return true;
    if(ld.type==='udl' && Math.abs(ld.w||0)>eps) return true;
    if(ld.type==='trap' && (Math.abs(ld.w1||0)>eps || Math.abs(ld.w2||0)>eps)) return true;
  }
  return Math.abs(combo.factors.G ?? 0)>eps && selfWeightValue(activeSection())>eps;
}
/* ---------------------------------------------------------------------------
   Stability of the end-restraint model (pure; reads S.ends, S.hinges, S.L,
   S.axial, S.eccOn, the LTB mode). Every unknown combination throws here with
   a clear message - nothing downstream may return NaN.
   In-plane: the solver's own restraint-rank test (beamRestraintRank) on the
   U_z / R_y flags plus the hinges. Out-of-plane (LTB eigen): at least one end
   with U_y and R_x held; when only one end holds U_y the member is a lateral
   cantilever, allowed only when that end also holds R_z and R_x (its warping
   condition is stated in the report). Torsion: any torque needs R_x at one
   end at least. Axial: N_Ed != 0 needs U_x at one end; both ends held is
   allowed and printed as statically indeterminate. Strut lengths: an axis
   whose fixities form a sway mechanism cannot carry N_Ed.
   Returns {errors:[...], notes:[...]} (notes are printed, not blocking).
   --------------------------------------------------------------------------- */
function endsStability(st){
  st=st||S;
  const errs=[], notes=[];
  const [e1,e2]=endsList(st);
  const L=+st.L;
  const hinges=(st.hinges||[]).map(h=>(+h.pos)*1000).filter(x=>Number.isFinite(x)&&x>1e-6&&x<L*1000-1e-6);
  const sup=endsToSupports(st).map(sp=>({pos:sp.pos*1000,type:sp.type}));
  // in-plane
  if(!e1.uz && !e2.uz) errs.push('Neither end restrains vertical translation U<sub>z</sub>: mechanism (rigid-body vertical translation). Restrain U<sub>z</sub> at one end at least.');
  else if(!(e1.uz&&e2.uz) && !e1.ry && !e2.ry){
    const held=e1.uz? 1 : 2, free=e1.uz? 2 : 1;
    errs.push('End '+free+' has no vertical restraint and End '+held+' does not restrain rotation: mechanism (rigid-body rotation about End '+held+'). Restrain R<sub>y</sub> at End '+held+' (cantilever / propped layout) or U<sub>z</sub> at End '+free+'.');
  }
  if(!errs.length && !beamRestraintRank(L*1000,sup,hinges).ok){
    errs.push(hinges.length
      ? 'Under-restrained layout (mechanism): the '+hinges.length+' internal hinge(s) release the in-plane moment and the end restraints U<sub>z</sub> / R<sub>y</sub> do not hold every segment they separate (each hinge needs one more restraint unit: '+(2+hinges.length)+' are needed, U<sub>z</sub> and R<sub>y</sub> counting one each; e.g. one hinge in a fixed - pinned, fixed - guided or fixed - fixed member, two hinges in a fixed - fixed member). Restrain R<sub>y</sub> at an end or remove a hinge.'
      : 'Under-restrained layout (mechanism): the end restraints U<sub>z</sub> / R<sub>y</sub> do not hold the member in its plane.');
  }
  if(e2.uz&&e2.ry&&!e1.uz&&!e1.ry) errs.push('A cantilever must have its root at End 1 (x = 0) and its free tip at End 2 (x = L): mirror the member.');
  // out-of-plane (LTB eigen / standard route): only when LTB is checked
  const ltbOn = st.code==='EC3' && (st.restraint||'full')!=='full';
  if(ltbOn){
    const forks=[e1,e2].filter(e=>e.uy&&e.rx);
    const lateral=[e1,e2].filter(e=>e.uy);
    if(!lateral.length) errs.push('Lateral-torsional buckling: neither end restrains lateral translation U<sub>y</sub>; the lateral stiffness matrix is singular. Restrain U<sub>y</sub> (and R<sub>x</sub>) at one end at least, or set the member fully restrained.');
    else if(!forks.length) errs.push('Lateral-torsional buckling: no end restrains both U<sub>y</sub> and R<sub>x</sub> (a fork / torsional restraint); the twist mode is unrestrained. Restrain R<sub>x</sub> at an end that holds U<sub>y</sub>.');
    else if(lateral.length===1){
      const e=lateral[0];
      if(!(e.rz&&e.rx)) errs.push('Lateral-torsional buckling: only End '+e.n+' restrains lateral translation U<sub>y</sub>, so the member is a lateral cantilever; that end must also restrain R<sub>z</sub> (lateral bending) and R<sub>x</sub> (twist), or the lateral stiffness matrix is singular.');
      else notes.push('Lateral cantilever: End '+e.n+' is the only end holding U<sub>y</sub>; it restrains R<sub>z</sub> and R<sub>x</sub> and its warping is '+(e.warp? 'restrained (&phi;&prime; = 0)' : 'free')+'; the other end is laterally free.');
    }
    if(!(e1.rx||e2.rx)) errs.push('Lateral-torsional buckling: neither end restrains twist R<sub>x</sub>: torsional mechanism.');
  }
  // torsion: any torque needs a twist restraint
  const anyTorque = !!st.eccOn && (st.loads.some(ld=>!ld.isSelfWeight && ld.type!=='moment' && Math.abs(ld.e||0)>1e-9) || (typeof selfWeightEccentricity==='function' && Math.abs(selfWeightEccentricity(activeSection()))>1e-9));
  if(anyTorque && !(e1.rx||e2.rx)) errs.push('Torsion: the loads apply a torque but neither end restrains twist R<sub>x</sub>: torsional mechanism. Restrain R<sub>x</sub> at one end at least.');
  // axial
  const N=+st.axial||0;
  if(Math.abs(N)>1e-9){
    if(!(e1.ux||e2.ux)) errs.push('Axial force N<sub>Ed</sub> = '+N+' kN is entered but neither end restrains axial translation U<sub>x</sub>: no axial load path (mechanism). Restrain U<sub>x</sub> at one end.');
    else if(e1.ux&&e2.ux) notes.push('Axial: both ends restrain U<sub>x</sub> - axial statically indeterminate: N taken as applied (N<sub>Ed</sub> = '+N+' kN over the whole member).');
    const lcr=lcrDefaults(st);
    if(N>0 && !lcr.override){
      if(lcr.mechanismY) errs.push('Strut buckling y-y: the U<sub>z</sub> / R<sub>y</sub> fixities form a mechanism ('+lcr.basisY+'); N<sub>Ed</sub> cannot be carried.');
      if(lcr.mechanismZ) errs.push('Strut buckling z-z: the U<sub>y</sub> / R<sub>z</sub> fixities form a sway mechanism ('+lcr.basisZ+'); restrain U<sub>y</sub> at the other end or R<sub>z</sub> at the held end, or enter an L<sub>E</sub>/L factor.');
    }
  }
  return {errors:errs, notes};
}
function validateInputs(py,E,ulsCombos,slsCombos){
  const errs=[];
  const finite=(v)=>v!==null && v!=='' && Number.isFinite(+v);
  const inSpan=(x)=>finite(x) && +x>=-1e-9 && +x<=S.L+1e-9;
  if(!(finite(S.L) && S.L>0)) errs.push("Member length L must be greater than 0.");
  if(!(finite(py) && py>0)) errs.push("Design strength must be greater than 0.");
  if(!(finite(E) && E>0)) errs.push("E must be greater than 0.");
  if(!(finite(S.divisor) && S.divisor>0)) errs.push("Deflection divisor must be greater than 0.");
  if(S.divisorCant!=null && !(finite(S.divisorCant) && S.divisorCant>0)) errs.push("Cantilever deflection divisor must be greater than 0.");
  if(S.deflAbs!=null && S.deflAbs!=='' && !(finite(S.deflAbs) && S.deflAbs>0)) errs.push("Absolute deflection limit must be blank or greater than 0 mm.");
  if(S.leFactor!=null && S.leFactor!=='' && !(finite(S.leFactor) && S.leFactor>0)) errs.push("Effective length factor must be blank (from the end fixities) or greater than 0.");
  ['axial','Mz','za'].forEach(k=>{ if(!finite(S[k])) errs.push(`${k} must be a finite number.`); });
  const area=activeSection().A;
  if(S.anet!=null && !(finite(S.anet)&&S.anet>0&&S.anet<=area)) errs.push('Net area must be greater than zero and no greater than the gross area.');
  ['Ke','robX','robY','C1o'].forEach(k=>{ if(S[k]!=null && !(finite(S[k])&&S[k]>0)) errs.push(`${k} override must be greater than zero.`); });
  if(S.LT!=null && S.LT!=='' && !(finite(S.LT) && +S.LT>0)) errs.push('Torsional buckling length L_T must be blank (= spacing of the twist restraints) or greater than 0 m.');
  if(S.mcrMethod!=null && S.mcrMethod!=='eigen' && S.mcrMethod!=='standard') errs.push(`Unknown Mcr method "${S.mcrMethod}": use "eigen" (FE eigensolver) or "standard" (closed form).`);
  [['mLTo',0.44],['mxo',0.4]].forEach(([k,min])=>{ if(S[k]!=null && !(finite(S[k])&&S[k]>=min&&S[k]<=1)) errs.push(`${k} override must be between ${min} and 1.`); });
  if(S.mLTo!=null && (S.destab || isCantilever(S)) && S.mLTo!==1) errs.push('mLT must be 1 for cantilevers and destabilising loading.');
  if(!S.ends || !S.ends.e1 || !S.ends.e2) errs.push('The member needs its two ends (S.ends.e1 / S.ends.e2): use a preset (endsPreset) or set the degree-of-freedom flags.');
  else {
    endsList().forEach(e=>{
      END_DOFS.forEach(k=>{ const v=(S.ends[e.key]||{})[k]; if(v!=null && typeof v!=='boolean' && v!==0 && v!==1) errs.push(`End ${e.n} ${k} must be true (restrained) or false (free).`); });
      if(e.ss!=null && !(finite(e.ss) && +e.ss>=0)) errs.push(`End ${e.n} stiff bearing length s_s must be blank (default) or a number >= 0 mm.`);
      const raw=(S.ends[e.key]||{}).ss; if(raw!=null && raw!=='' && !Number.isFinite(+raw)) errs.push(`End ${e.n} stiff bearing length s_s must be blank (default) or a number >= 0 mm.`);
    });
  }
  (S.hinges||[]).forEach((h,i)=>{
    if(!inSpan(h.pos)) errs.push(`Internal hinge ${i+1} position must be within 0 to ${S.L} m.`);
    else if(+h.pos<=1e-6 || +h.pos>=S.L-1e-6) errs.push(`Internal hinge ${i+1} must be inside the span, not at an end (release the end rotation R_y instead).`);
  });
  S.loads.forEach((ld,i)=>{
    const tag=`Load ${i+1}`;
    ['e','zg'].forEach(k=>{ if(ld[k]!=null&&!finite(ld[k])) errs.push(`${tag} ${k} must be a finite number.`); });
    if(ld.ss!=null && ld.ss!=='' && !(finite(ld.ss) && +ld.ss>=0)) errs.push(`${tag} stiff bearing length s_s must be blank (default 0) or a number >= 0 mm.`);
    if(!CASE_LABELS[ld.case]) errs.push(`${tag} has an unknown load case.`);
    if(ld.type==='point'){
      if(!inSpan(ld.pos)) errs.push(`${tag} point-load position must be within 0 to ${S.L} m.`);
      if(!finite(ld.P)) errs.push(`${tag} point load must be numeric.`);
    } else if(ld.type==='moment'){
      if(!inSpan(ld.pos)) errs.push(`${tag} moment position must be within 0 to ${S.L} m.`);
      if(!finite(ld.M)) errs.push(`${tag} moment must be numeric.`);
    } else if(ld.type==='udl' || ld.type==='trap'){
      if(!inSpan(ld.x1) || !inSpan(ld.x2)) errs.push(`${tag} load extents must be within 0 to ${S.L} m.`);
      if(!(finite(ld.x1) && finite(ld.x2) && +ld.x2>+ld.x1)) errs.push(`${tag} must have x2 greater than x1.`);
      if(ld.type==='udl' && !finite(ld.w)) errs.push(`${tag} UDL intensity must be numeric.`);
      if(ld.type==='trap' && (!finite(ld.w1) || !finite(ld.w2))) errs.push(`${tag} trapezoidal intensities must be numeric.`);
    } else errs.push(`${tag} has an unknown load type.`);
  });
  [...ulsCombos,...slsCombos].forEach(combo=>{
    ['G','Q','W','E'].forEach(cs=>{
      if(!finite(combo.factors[cs])) errs.push(`Combination "${combo.label}" has a non-numeric ${cs} factor.`);
    });
  });
  S.loads.filter(ld=>!ld.isSelfWeight).forEach((ld,i)=>{
    const active=ld.type==='point'?Math.abs(ld.P)>0:ld.type==='moment'?Math.abs(ld.M)>0:ld.type==='udl'?Math.abs(ld.w)>0:Math.abs(ld.w1)>0||Math.abs(ld.w2)>0;
    if(active&&!ulsCombos.some(cb=>Math.abs(cb.factors[ld.case])>1e-12)) errs.push(`Load ${i+1} (${ld.case}) is omitted from every enabled ULS combination.`);
  });
  if(!slsCombos.some(comboHasServiceLoad)){
    errs.push("No SLS loads applied: every enabled SLS combination has zero factors for the active load cases. Enable a non-zero SLS factor for a load case that is present, or add a serviceability load.");
  }
  if(!errs.length && S.ends && S.ends.e1 && S.ends.e2) errs.push(...endsStability(S).errors);
  if(errs.length) throw errs.join(" ");
}
/* Memo of warping-torsion FE solves (19 Sep 2026 review, performance): keyed
   by the full input of warpingTorsionFE (L, E I_w, G I_T, support list with
   the warping flags, torque list), bounded; a re-render after an unrelated
   input, or a pattern / companion whose torque list repeats, is served from
   the cache. Pure function results are immutable here (never mutated). */
const TORSION_FE_CACHE=new Map(), TORSION_FE_CACHE_MAX=64;
function warpingTorsionFEMemo(opts,stats){
  const key=JSON.stringify([opts.L,opts.EIw,opts.GIt,opts.supports,opts.torques]);
  const hit=TORSION_FE_CACHE.get(key);
  if(hit){ TORSION_FE_CACHE.delete(key); TORSION_FE_CACHE.set(key,hit); if(stats) stats.cached++; return hit; }
  const sol=warpingTorsionFE(opts);
  if(stats) stats.solved++;
  TORSION_FE_CACHE.set(key,sol);
  if(TORSION_FE_CACHE.size>TORSION_FE_CACHE_MAX) TORSION_FE_CACHE.delete(TORSION_FE_CACHE.keys().next().value);
  return sol;
}
function analyse(){
  const sec=activeSection();
  syncSelfWeightLoads();
  const L=S.L*1000;
  const py = S.py!=null? S.py : pyFromGrade(S.grade,sec.tf);
  const E=S.E;
  const Ix=sec.Ix*1e4, EI=E*Ix;
  const ulsUser=S.combos.filter(c=>c.on && !c.sls);
  const slsUser=S.combos.filter(c=>c.on && c.sls);
  if(ulsUser.length===0) throw 'Enable at least one ULS load combination (see "Load Combinations").';
  if(slsUser.length===0) throw 'Enable at least one SLS (deflection) load combination (see "Load Combinations").';
  validateInputs(py,E,ulsUser,slsUser);
  // In-plane support list of the two ends (compatibility shim of the ends model:
  // uz + ry = fixed, uz = pinned, ry = guided, neither = free / absent)
  const supportsMM=endsToSupports(S).map(s=>({pos:(+s.pos)*1000,type:s.type,end:s.end}));
  const hingesMM=(S.hinges||[]).map(h=>(+h.pos)*1000).filter(x=>x>1e-6 && x<L-1e-6);
  const stability=endsStability(S);
  const ends=endsList(S);
  const cant=isCantilever(S);
  const ulsCombos=ulsUser.slice();
  const slsCombos=slsUser.slice();
  const companionCombos=gammaInfCompanions(ulsCombos);
  const companionNote= companionCombos.length
    ? '&gamma;<sub>G,inf</sub> companions: '+companionCombos.length+' ULS combination(s) re-solved with G at 1.0 (STR set B, EN 1990 6.4.3.1(4) / Table A1.2(B)) and at 0.9 (EQU set A, Table A1.2(A)) over the whole member (single-source permanent action) for the END REACTIONS only - uplift / hold-down forces and the web-bearing reactions; the moment and shear envelopes keep the entered &gamma;<sub>G</sub>, so add a reduced-G combination by hand where a relieving permanent action could increase a moment.'
    : '&gamma;<sub>G,inf</sub> companions: none generated (no enabled ULS combination has a G factor above 1.0; a relieving-G case must be entered by hand where a permanent action is favourable).';

  // Run every enabled ULS combination; the same load/support geometry means every
  // combo's result lands on an identical x-grid, so elementwise envelopes are valid.
  const mechanismMsg=()=> hingesMM.length? "Under-restrained layout (mechanism): an internal hinge has left part of the member unrestrained. Restrain R_y at both ends or remove the hinge." : "Under-restrained layout (mechanism): the end restraints U_z / R_y do not hold the member in its plane.";
  const solveUls=combo=>{
    const loads=comboLoads(combo);
    const r=solveBeam(L,EI,supportsMM,loads,120,hingesMM);
    if(!r.w.every(Number.isFinite)) throw mechanismMsg();
    const fb=sfdBmd(L,supportsMM,loads,r.reactions);
    let Vmax=0; fb.V.forEach(v=>{ if(Math.abs(v)>Math.abs(Vmax)) Vmax=v; });
    let Mmax=0,Mpos=0; fb.xs.forEach((x,i)=>{ if(Math.abs(fb.M[i])>Math.abs(Mmax)){Mmax=fb.M[i];Mpos=x;} });
    return {combo,r,fb,Vmax,Mmax,Mpos};
  };
  const ulsResults=ulsCombos.map(solveUls);
  // gamma_G,inf companions (1.0 STR set B and 0.9 EQU set A of every ULS
  // combination with G > 1.0): reactions for uplift / hold-down and web bearing
  const ulsCompanions=companionCombos.map(solveUls);
  const xs=ulsResults[0].fb.xs;
  const Venv=xs.map((_,i)=>{ let best=0; ulsResults.forEach(res=>{ if(Math.abs(res.fb.V[i])>Math.abs(best)) best=res.fb.V[i]; }); return best; });
  const Menv=xs.map((_,i)=>{ let best=0; ulsResults.forEach(res=>{ if(Math.abs(res.fb.M[i])>Math.abs(best)) best=res.fb.M[i]; }); return best; });
  let governV=ulsResults[0]; ulsResults.forEach(r=>{ if(Math.abs(r.Vmax)>Math.abs(governV.Vmax)) governV=r; });
  let governM=ulsResults[0]; ulsResults.forEach(r=>{ if(Math.abs(r.Mmax)>Math.abs(governM.Mmax)) governM=r; });
  const Vmax=governV.Vmax, Mmax=governM.Mmax, Mpos=governM.Mpos;
  // m-factor inputs (quarter-point moments) must come from ONE moment-diagram shape  
  // the governing-moment combo's own BMD   not a mix of different combos' diagrams.
  const gfb=governM.fb;
  const Mq=interpAt(gfb.xs,gfb.M,L*0.25), Mh=interpAt(gfb.xs,gfb.M,L*0.5), Mq3=interpAt(gfb.xs,gfb.M,L*0.75);
  let M24=0; gfb.xs.forEach((x,i)=>{ if(x>=L*0.25-1&&x<=L*0.75+1) M24=Math.max(M24,Math.abs(gfb.M[i])); });
  // end moments read a fraction inside the member (as analysisForCombination does):
  // the grid closes to zero at x = L beyond an end couple, and a fixed-end sample
  // exactly at the support is the far side of the reaction jump
  const M0end=interpAt(gfb.xs,gfb.M,1e-4), MLend=interpAt(gfb.xs,gfb.M,L-1e-4);
  const reactions=governM.r.reactions;

  // SLS deflection: worst of every enabled SLS combination, over the one span
  // against its limit: span/S.divisor when both ends are held vertically,
  // L/S.divisorCant when an end is vertically free (cantilever tip, guided
  // tip; UK NA to EN 1993-1-1 Table NA.2 cantilever row, default 180
  // [verify]), capped by the optional absolute limit S.deflAbs (mm). A held
  // end has w = 0, so a tip value is the deflection relative to the root.
  const deflCant=hasFreeVerticalEnd(S);
  const divisorCant=(S.divisorCant!=null && Number.isFinite(+S.divisorCant) && +S.divisorCant>0)? +S.divisorCant : 180;
  const deflAbs=(S.deflAbs!=null && S.deflAbs!=='' && Number.isFinite(+S.deflAbs) && +S.deflAbs>0)? +S.deflAbs : null;
  const slsResults=slsCombos.map(combo=>{
    const loads=comboLoads(combo);
    const r=solveBeam(L,EI,supportsMM,loads,120,hingesMM);
    if(!r.w.every(Number.isFinite)) throw mechanismMsg();
    let dmax=0,dpos=0; r.nodes.forEach((x,i)=>{ if(Math.abs(r.w[i])>Math.abs(dmax)){dmax=r.w[i];dpos=x;} });
    const divisor= deflCant? divisorCant : S.divisor;
    const limSpan=L/divisor;
    const absGoverns= deflAbs!=null && deflAbs<limSpan;
    const limit= absGoverns? deflAbs : limSpan;
    const util=Math.abs(dmax)/limit;
    const deflection={no:1,start:0,end:L,span:L,cant:deflCant,dmax,dpos,limit,util,divisor,limSpan,abs:deflAbs,absGoverns,combo:combo.label};
    return {combo,r,dmax,dpos,deflection,segs:[deflection]};
  });
  let governD=slsResults[0]; slsResults.forEach(r=>{ if(r.deflection.util>governD.deflection.util) governD=r; });
  const dmax=governD.dmax, dpos=governD.dpos;
  const deflSegments=[governD.deflection];

  // ---- uplift / hold-down (EN 1990 2.4.4 EQU): every combination's reactions ----
  // A negative vertical reaction (up = positive) means the end must hold the
  // member down. Recorded per combination for every vertically held end; the
  // worst per end is kept (design force = the worst ULS value incl. the
  // gamma_G,inf companions, SLS uplift listed separately). n = end number.
  const vEnds=verticalEnds(S);
  const uplift=[];
  ulsResults.concat(ulsCompanions).forEach(res=>vEnds.forEach(ve=>{ const re=res.r.reactions[ve.i]; if(re.V< -1) uplift.push({n:ve.end,pos:re.pos,R:re.V/1000,combo:res.combo.label,sls:false,gInf:res.combo.gInf||null}); }));
  slsResults.forEach(res=>vEnds.forEach(ve=>{ const re=res.r.reactions[ve.i]; if(re.V< -1) uplift.push({n:ve.end,pos:re.pos,R:re.V/1000,combo:res.combo.label,sls:true}); }));
  const upliftSupports=vEnds.map(ve=>{
    const rows=uplift.filter(u=>u.n===ve.end);
    if(!rows.length) return null;
    const worst=rows.reduce((p,u)=>u.R<p.R?u:p);
    const ulsRows=rows.filter(u=>!u.sls), slsRows=rows.filter(u=>u.sls);
    const worstUls=ulsRows.length? ulsRows.reduce((p,u)=>u.R<p.R?u:p) : null;
    const worstSls=slsRows.length? slsRows.reduce((p,u)=>u.R<p.R?u:p) : null;
    return {n:ve.end,pos:worst.pos,type:ve.type,holdDown:!!ve.holdDown,R:worst.R,combo:worst.combo,sls:worst.sls,
      RUls:worstUls? worstUls.R : null, comboUls:worstUls? worstUls.combo : null, gInfUls:worstUls? worstUls.gInf : null,
      RSls:worstSls? worstSls.R : null, comboSls:worstSls? worstSls.combo : null, nCombos:rows.length};
  }).filter(Boolean);

  // ---- torsion from load eccentricity (loads at e from the shear centre) ----
  // Torque loads mirror the transverse loads: q_T(x) = w(x)*e, point torques P*e.
  // Twist is prevented at every end whose R_x is restrained: GIt*phi'' = -q_T
  // with phi = 0 there (one such end = torsion cantilever), solved by 1-dof
  // linear elements (nodal phi exact for this ODE); the torque diagram T(x)
  // then follows by statics, reusing sfdBmd (its V output).
  const twistMM=twistEnds(S);
  const twistSupportsMM=twistMM.map(t=>({pos:t.pos,type:'pinned',end:t.end}));
  let tors=null;
  const swE=selfWeightEccentricity(sec);
  const anyUserEcc = S.eccOn && S.loads.some(ld=>!ld.isSelfWeight && ld.type!=='moment' && Math.abs(ld.e||0)>1e-9);
  const anySelfWeightEcc = S.eccOn && Math.abs(swE)>1e-9 && selfWeightValue(sec)>0 &&
    [...ulsCombos,...slsCombos].some(cb=>Math.abs(cb.factors.G??0)>1e-12);
  const anyEcc = anyUserEcc || anySelfWeightEcc;
  const torsErr = (anyEcc && !(sec.J>0))? "the section torsional constant I_T is zero or undefined in the section data" : null;
  // Torque list of ONE combination (pattern-aware through comboLoadPieces):
  // point torques P*e [N.mm] and distributed torques w*e [N.mm/mm]; applied
  // moments carry no torque; the per-load z_g is a load height, not a torque.
  // Shared by the St Venant FE (torque diagram) and the warping-torsion FE.
  const mkT=(combo)=>{ const out=[]; comboLoadPieces(combo).forEach(p=>{
      const f=p.factor;
      const le=p.e; // this load's own shear-centre offset, mm
      if(p.type==='point') out.push({type:'point',pos:p.pos,P:p.P*f*1000*le}); // kN -> N, x e mm -> N.mm
      else if(p.type==='udl'||p.type==='trap') out.push({type:'udl',x1:p.x1,x2:p.x2,w1:p.w1*f*le,w2:p.w2*f*le});
    });
      const gF=combo.factors.G??0, sw=selfWeightValue(sec);
      if(Math.abs(gF)>1e-12 && Math.abs(swE)>1e-9 && sw>0){
        out.push({type:'udl',x1:0,x2:S.L*1000,w1:sw*gF*swE,w2:sw*gF*swE,isAutoSelfWeight:true});
      }
      return out; };
  if(anyEcc && !torsErr){
    const GIt=81000*sec.J*1e4; // N.mm2 (G = 81000 N/mm2 per SN003a / P385)
    const solveT=(tq)=>{
      const nodes=buildNodes(L,twistSupportsMM,tq,120);
      const n=nodes.length;
      const K=Array.from({length:n},()=>new Array(n).fill(0));
      const F=new Array(n).fill(0);
      for(let el=0;el<n-1;el++){ const Le=nodes[el+1]-nodes[el], k=GIt/Le;
        K[el][el]+=k; K[el][el+1]-=k; K[el+1][el]-=k; K[el+1][el+1]+=k; }
      const idx=new Map(nodes.map((x,i)=>[+x.toFixed(6),i]));
      tq.forEach(ld=>{ if(ld.type==='point'){ const i=idx.get(+(+ld.pos).toFixed(6)); if(i!=null) F[i]+=ld.P; }
        else if(ld.type==='udl'){ for(let el=0;el<n-1;el++){ const xa=nodes[el],xb=nodes[el+1];
          if(xb<=ld.x1+1e-9||xa>=ld.x2-1e-9) continue; const Le=xb-xa;
          const tv=x=>{ if(ld.x2===ld.x1) return ld.w1; const s=(x-ld.x1)/(ld.x2-ld.x1); return ld.w1+(ld.w2-ld.w1)*s; };
          const ta=tv(xa),tb=tv(xb);
          F[el]+=Le*(2*ta+tb)/6; F[el+1]+=Le*(ta+2*tb)/6; } } });
      const fixed=new Set(); twistSupportsMM.forEach(s=>{ const i=idx.get(+(+s.pos).toFixed(6)); if(i!=null) fixed.add(i); });
      if(!fixed.size) throw 'Torsion: no end restrains twist R_x (torsional mechanism).';
      const free=[]; for(let d2=0;d2<n;d2++) if(!fixed.has(d2)) free.push(d2);
      const phi=new Array(n).fill(0);
      if(free.length){ const Kff=free.map(r=>free.map(cc=>K[r][cc])), Ff=free.map(r=>F[r]);
        const df=linsolve(Kff,Ff); free.forEach((dof,j)=>phi[dof]=df[j]); }
      const R=new Array(n).fill(0);
      for(let i=0;i<n;i++){ let s2=0; for(let j=0;j<n;j++) s2+=K[i][j]*phi[j]; R[i]=s2-F[i]; }
      const reactions=twistSupportsMM.map(s=>({pos:s.pos,type:'pinned',V:R[idx.get(+(+s.pos).toFixed(6))]}));
      const fb=sfdBmd(L,twistSupportsMM,tq,reactions);
      let Tm=0,Tp=0; fb.V.forEach((v,i)=>{ if(Math.abs(v)>Math.abs(Tm)){Tm=v;Tp=fb.xs[i];} });
      let pm=0,pp=0; phi.forEach((v,i)=>{ if(Math.abs(v)>Math.abs(pm)){pm=v;pp=nodes[i];} });
      return {nodes,phi,xs:fb.xs,T:fb.V,Tmax:Tm,Tpos:Tp,phiMax:pm,phiPos:pp};
    };
    const uls=ulsCombos.map(cb=>({combo:cb,r:solveT(mkT(cb))}));
    let gT=uls[0]; uls.forEach(u=>{ if(Math.abs(u.r.Tmax)>Math.abs(gT.r.Tmax)) gT=u; });
    const sls=slsCombos.map(cb=>({combo:cb,r:solveT(mkT(cb))}));
    let gW=sls[0]; sls.forEach(u=>{ if(Math.abs(u.r.phiMax)>Math.abs(gW.r.phiMax)) gW=u; });
    tors={on:true, GIt,
      Tmax:Math.abs(gT.r.Tmax)/1e6, Tpos:gT.r.Tpos/1000, governT:gT.combo.label,
      diag:{xs:gT.r.xs.map(x=>x/1000), T:gT.r.T.map(t=>t/1e6)},
      uls,
      TmaxSLS:Math.abs(gW.r.Tmax)/1e6, phiMax:Math.abs(gW.r.phiMax), phiPos:gW.r.phiPos/1000, governTw:gW.combo.label};
  }

  // ---- P385 open-section torsion: Method B closed forms where they apply
  //      (single fork-fork span, full-span distributed and/or point torques,
  //      warping free at both ends), otherwise the general warping-torsion FE
  //      of js/checks/torsion-fe.js (19 Sep 2026 gap closure, group G4) ----
  let torsO=null;
  if(anyEcc && torsErr && !sec.isBox){ torsO={ok:false,reason:torsErr}; }
  if(anyEcc && !torsErr && !sec.isBox){
    const tp=sec.tp;
    const IT=((tp&&tp.IT)? tp.IT : sec.J)*1e4;                     // mm4, P385 App A preferred
    const IwO=(((tp&&tp.Iw!=null)? tp.Iw : sec.Iw)||0)*1e12;       // mm6
    const GItO=81000*IT;
    const aa=IwO>0? Math.sqrt(E*IwO/GItO) : 0; // use the same E as the bending analysis
    // P385 Appendix C: fork ends at both ends of the span - lateral translation
    // U_y and twist R_x held at BOTH ends, warping free at both
    const forkBoth = ends.every(e=>e.uy&&e.rx);
    const warpAny = ends.some(e=>e.rx&&e.warp);
    const mk385=(combo)=>{
      const list=[];
      for(const p of comboLoadPieces(combo)){
        if(p.type==='moment') continue;
        const f=p.factor, le=p.e;
        if(!f||Math.abs(le)<1e-9) continue;
        if(p.type==='point'){ list.push({kind:'point',alpha:p.pos/L,T:p.P*f*1000*le}); }
        else {
          const x1=p.x1, x2=p.x2;
          if(x1>1e-6 || Math.abs(x2-L)>1e-6) return {ok:false,reason:'partial-span eccentric distributed load (the P385 closed forms Cases 3/4/10 cover full-span distributed torque only)'};
          const w1=p.w1, w2=p.w2;
          const wu=Math.min(w1,w2), dv=w2-w1;
          if(Math.abs(wu)>1e-12) list.push({kind:'ud',T:wu*f*le*L});
          if(Math.abs(dv)>1e-12) list.push({kind:'lin',T:Math.abs(dv)/2*f*le*L*Math.sign(dv*1), mirror:dv<0});
        }
      }
      const gF=combo.factors.G??0, sw=selfWeightValue(sec);
      if(Math.abs(gF)>1e-12 && Math.abs(swE)>1e-9 && sw>0){
        list.push({kind:'ud',T:sw*gF*swE*L});
      }
      return {ok:true,list};
    };
    // Why the closed forms cannot be used (empty = they can): layout, a
    // warping-fixed support, or a partial-span distributed torque in any
    // analysed combination.
    const feReasons=[];
    if(!forkBoth) feReasons.push(twistMM.length===1? 'twist restrained at End '+twistMM[0].end+' only (torsion cantilever)' : 'the ends are not both fork ends (U_y + R_x at both ends)');
    if(warpAny) feReasons.push('warping-fixed end');
    if(!feReasons.length){
      for(const cb of [...ulsCombos,...slsCombos]){ const m=mk385(cb); if(!m.ok){ feReasons.push(m.reason); break; } }
    }
    if(!(IT>0)) torsO={ok:false,reason:'the torsional constant I_T is zero or undefined'};
    else if(!(IwO>0)||!(aa>0)||!isFinite(aa)) torsO={ok:false,reason:'no warping constant available for this section'};
    else if(!feReasons.length){
      // SCI P385 Appendix C closed forms, superposed per combination
      const sols=ulsResults.map(res=>({combo:res.combo, fb:res.fb, sol:p385Solve(L,aa,GItO,mk385(res.combo).list)}));
      let slsSol=null;
      for(const cb of slsCombos){
        const s2=p385Solve(L,aa,GItO,mk385(cb).list);
        let pm=0,pp=0; s2.phi.forEach((v,i)=>{ if(Math.abs(v)>Math.abs(pm)){pm=v;pp=s2.xs[i];} });
        if(!slsSol||Math.abs(pm)>Math.abs(slsSol.phiMax)) slsSol={combo:cb,phiMax:pm,phiPos:pp};
      }
      torsO={ok:true,method:'closed',methodLabel:'SCI P385 App C closed forms (Cases 3/4/10)',
        bcText:'fork ends at x = 0 and x = L (&phi; = 0, warping free)',feReasons:[],
        aa,X:L/aa,IT,Iw:IwO,GIt:GItO,sols,sls:slsSol};
    } else {
      // General warping-torsion FE: E I_w phi'''' - G I_T phi'' = m_t(x), phi = 0
      // at every end with R_x held, phi' = 0 where warping is restrained, a free
      // end natural; mesh doubled once for the error.
      const feSup=twistMM.map(t=>({pos:t.pos,warpFix:t.warpFix,end:t.end}));
      const EIwO=E*IwO;
      const feStats={solved:0,cached:0};
      const feSolve=(cb)=>warpingTorsionFEMemo({L,EIw:EIwO,GIt:GItO,supports:feSup,torques:mkT(cb)},feStats);
      const sols=ulsResults.map(res=>({combo:res.combo, fb:res.fb, sol:feSolve(res.combo)}));
      let slsSol=null, meshError=0, nElem=0, nElemCoarse=0;
      sols.forEach(se=>{ meshError=Math.max(meshError,se.sol.meshError); nElem=Math.max(nElem,se.sol.nElem); nElemCoarse=Math.max(nElemCoarse,se.sol.nElemCoarse); });
      for(const cb of slsCombos){
        const s2=feSolve(cb);
        meshError=Math.max(meshError,s2.meshError); nElem=Math.max(nElem,s2.nElem); nElemCoarse=Math.max(nElemCoarse,s2.nElemCoarse);
        let pm=0,pp=0; s2.phi.forEach((v,i)=>{ if(Math.abs(v)>Math.abs(pm)){pm=v;pp=s2.xs[i];} });
        if(!slsSol||Math.abs(pm)>Math.abs(slsSol.phiMax)) slsSol={combo:cb,phiMax:pm,phiPos:pp};
      }
      torsO={ok:true,method:'fe',methodLabel:'warping-torsion FE ('+nElem+' elements)',nElem,nElemCoarse,meshError,
        converged:meshError<=TORSION_FE_MESH_BLOCK,meshBlock:TORSION_FE_MESH_BLOCK,nSolves:feStats.solved,nCached:feStats.cached,
        bcText:torsionFeBcText(feSup,L),feReasons,
        aa,X:L/aa,IT,Iw:IwO,GIt:GItO,sols,sls:slsSol};
    }
  }
  return {sec,py,E,L,Ix,tors,torsO,torsErr,swPerM:sec.mass*9.81/1000,ulsResults,
    Vmax:Vmax/1000, Mmax:Mmax/1e6, Mpos:Mpos/1000,
    Mq:Mq/1e6, Mh:Mh/1e6, Mq3:Mq3/1e6, M24:M24/1e6, M0end:M0end/1e6, MLend:MLend/1e6,
    dmax, dpos:dpos/1000, deflection:governD.deflection, deflSegments, divisorCant, deflAbs,
    diag:{xs:xs.map(x=>x/1000), V:Venv.map(v=>v/1000), M:Menv.map(m=>m/1e6),
          dx:governD.r.nodes.map(x=>x/1000), dw:governD.r.w},
    reactions, ulsResults, ulsCompanions, slsResults, governV, governM, governD,
    ends, supports:endsToSupports(S), cant, stability, companionNote, ulsCombos, slsCombos, companionCombos,
    uplift:{list:uplift, supports:upliftSupports, any:upliftSupports.length>0, nCombos:ulsResults.length+ulsCompanions.length+slsResults.length}};
}

/* ---- Hold-down check (19 Sep 2026 gap closure, item 1.2), pure ----
   One row per end that lifts in any combination (n = end number). An end
   lifting in a ULS combination (the gamma_G,inf companions included) is
   blocking (unsupported) unless its "hold-down provided" box is ticked, in
   which case it is an advisory carrying the design force. An end that lifts
   ONLY in SLS combinations (the default NA 2.23 "variable actions only"
   deflection case has no G, so its reaction is not an equilibrium state) is
   reported as an advisory naming the combination and the force.
   Returns {rows, unsupported, advisory}; rows = [{n, pos (mm), R (kN,
   negative), combo, sls, RUls, comboUls, RSls, comboSls, holdDown, level:
   'uls'|'sls', blocking, msg}]. */
function holdDownCheck(a){
  const out={rows:[],unsupported:[],advisory:[]};
  const up=a.uplift&&a.uplift.supports||[];
  up.forEach(u=>{
    const kN=v=>(Math.abs(v)).toFixed(2);
    const where='at End '+u.n+' (x = '+(u.pos/1000).toFixed(2).replace(/\.?0+$/,'')+' m)';
    let msg, blocking=false, level;
    if(u.RUls!=null){
      level='uls';
      const force=(withWhere)=>'R = &minus;'+kN(u.RUls)+' kN'+(withWhere? ' '+where : '')+' (combination '+u.comboUls+')'+(u.RSls!=null? '; SLS uplift &minus;'+kN(u.RSls)+' kN ('+u.comboSls+')' : '');
      if(u.holdDown) msg='Hold-down provided '+where+': design the hold-down for '+force(false)+'. Reaction taken as tension at the support; the connection and the supporting structure are not designed here.';
      else { blocking=true; msg='Hold-down required: '+force(true)+'. The end cannot resist uplift as modelled; tick "hold-down provided" for this end once a holding-down connection is designed for this force, or revise the restraints / loading (EN 1990 2.4.4 EQU; the &gamma;<sub>G,inf</sub> companions - G at 1.0 (STR set B) and 0.9 (EQU set A) with the entered variable factors - are included).'; }
    } else {
      level='sls';
      msg='Hold-down check (SLS only) '+where+': the variable-action-only combination '+u.comboSls+' lifts this support by R = &minus;'+kN(u.RSls)+' kN; no ULS combination lifts it, including the &gamma;<sub>G,inf</sub> companions with G at 1.0 (STR set B) and 0.9 (EQU set A, EN 1990 Table A1.2(A)) and the entered variable factors'+(u.holdDown? '; hold-down provided' : '')+'. A deflection combination without G is not an equilibrium state, so this does not block PASS.';
    }
    const row=Object.assign({},u,{msg,level,blocking});
    out.rows.push(row);
    if(blocking) out.unsupported.push(msg); else out.advisory.push(msg);
  });
  return out;
}

/* Standard-specific check engines live in js/checks/. */
function analysisForCombination(a,res){
  const fb=res.fb, L=a.L;
  let M24=0; fb.xs.forEach((x,i)=>{ if(x>=L/4&&x<=3*L/4) M24=Math.max(M24,Math.abs(fb.M[i])); });
  return Object.assign({},a,{ulsResults:[res],governM:res,governV:res,
    Mmax:res.Mmax/1e6,Vmax:res.Vmax/1000,Mpos:res.Mpos/1000,
    Mq:interpAt(fb.xs,fb.M,L/4)/1e6,Mh:interpAt(fb.xs,fb.M,L/2)/1e6,
    Mq3:interpAt(fb.xs,fb.M,3*L/4)/1e6,M24:M24/1e6,
    M0end:interpAt(fb.xs,fb.M,1e-4)/1e6,MLend:interpAt(fb.xs,fb.M,L-1e-4)/1e6});
}
function checks(a){
  if(S.code==='EC3') return (S.restraint||'full')==='full'? checksEC3Restrained(a) : checksEC3UnrestrainedSCI(a);
  // mLT and mx depend on each diagram; a lower peak moment can govern.
  const results=a.ulsResults.map(res=>({res,c:checksBS5950(analysisForCombination(a,res))}));
  const c=checksBS5950(a); // retain envelope quantities for the detailed report
  c.utils=c.utils.map((u,i)=>{
    const combo=u.name==='Deflection'?a.governD.combo.label:u.name.startsWith('Shear')?a.governV.combo.label:a.ulsResults.length===1?a.governM.combo.label:'envelope';
    let worst={...u,combo};
    results.forEach(r=>{ const v=r.c.utils[i]; if(v&&v.val>worst.val) worst={...v,combo:r.res.combo.label}; });
    return worst;
  });
  c.unsupported=[...new Set(c.unsupported.concat(...results.map(r=>r.c.unsupported)))];
  // shared analysis-level checks (uplift / hold-down, pattern-loading note)
  const hd=holdDownCheck(a);
  c.holdDown=hd;
  c.unsupported=c.unsupported.concat(hd.unsupported);
  c.advisory=(c.advisory||[]).concat(hd.advisory);
  if(a.stability&&a.stability.notes) c.advisory.push(...a.stability.notes);
  if(a.companionNote) c.advisory.push(a.companionNote);
  c.gov=c.utils.reduce((p,u)=>u.val>p.val?u:p);
  c.pass=c.unsupported.length===0&&c.utils.every(u=>Number.isFinite(u.val)&&u.val>=0&&u.val<=1.0001);
  c.combinationChecks=results.map(r=>({combo:r.res.combo.label,utils:r.c.utils}));
  return c;
}

