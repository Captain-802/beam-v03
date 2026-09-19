/* ===========================================================================
   4. ORCHESTRATION   run analysis + shared checks dispatcher
   =========================================================================== */
/* ---------------------------------------------------------------------------
   Span segments and automatic pattern loading (19 Sep 2026 gap closure, item 1.3)
   ---------------------------------------------------------------------------
   spanSegments(): the member split at its supports, in mm - one segment per
   interval between consecutive supports plus an end overhang (cantilever)
   beyond the outer supports; a single fixed support gives one cantilever
   segment 0..L. Internal hinges do NOT split segments. Used by the pattern
   generator and by the per-segment deflection check.
   --------------------------------------------------------------------------- */
const PATTERN_CASE='Q';   // the variable action that is patterned (EN 1990 6.10 as entered)
function spanSegments(){
  const L=(+S.L)*1000;
  if(!(L>0)) return [];
  const pts=[...new Set(S.supports.map(s=>(+s.pos)*1000).filter(x=>Number.isFinite(x)&&x>=-1e-6&&x<=L+1e-6))].sort((p,q)=>p-q);
  if(!pts.length) return [];
  const segs=[];
  if(pts[0]>1e-6) segs.push({a:0,b:pts[0],cant:true});
  for(let i=0;i<pts.length-1;i++) if(pts[i+1]-pts[i]>1e-6) segs.push({a:pts[i],b:pts[i+1],cant:false});
  if(L-pts[pts.length-1]>1e-6) segs.push({a:pts[pts.length-1],b:L,cant:true});
  return segs.map((s,i)=>Object.assign(s,{no:i+1}));
}
function segIndexOf(segs,x){
  for(let i=0;i<segs.length;i++) if(x>=segs[i].a-1e-6 && x<=segs[i].b+1e-6) return i;
  return -1;
}
function patternLoadingActive(){
  const on = S.autoPattern==null ? true : !!S.autoPattern;
  return on && spanSegments().length>1;
}
/* Effective user loads of ONE combination (pure; reads S.loads, S.L, S.supports).
   Returns one "piece" per load or per load part: {i, ld, type, case, e, zg,
   factor, masked, pos (mm) | x1,x2 (mm) with w1,w2 (kN/m, unfactored), P (kN),
   M (kN.m)}. Every load is present (factor 0 when its case is not in the
   combination) so that the solver's x-grid is identical across combinations.
   Pattern combinations carry combo.mask = {case, segIdx, segs}: a Q load (or
   part of one) outside the masked segments gets factor 0 (masked = true).
   When automatic pattern loading is active, distributed Q loads are split at
   the interior segment boundaries for EVERY combination of the analysis (the
   boundaries are support positions, so the grid stays identical); with
   pattern loading off nothing is split and the list equals the previous one. */
function comboLoadPieces(combo){
  const active=patternLoadingActive();
  const segs=active? spanSegments() : null;
  const mask=(combo&&combo.mask)||null;
  const fac=(combo&&combo.factors)||{};
  const out=[];
  S.loads.forEach((ld,i)=>{
    if(ld.isSelfWeight) return;
    const f=fac[ld.case] ?? 0;
    const base={i,ld,type:ld.type,case:ld.case,e:+(ld.e||0),zg:ld.zg};
    if(ld.type==='point'||ld.type==='moment'){
      const pos=(+ld.pos)*1000;
      let factor=f, masked=false;
      if(mask && ld.case===mask.case && segs){ if(!mask.segIdx.includes(segIndexOf(segs,pos))){ factor=0; masked=true; } }
      out.push(Object.assign(base,{pos,P:+(ld.P||0),M:+(ld.M||0),factor,masked}));
      return;
    }
    const x1=(+ld.x1)*1000, x2=(+ld.x2)*1000;
    const w1= ld.type==='udl'? +(ld.w||0) : +(ld.w1||0), w2= ld.type==='udl'? +(ld.w||0) : +(ld.w2||0);
    if(!(active && ld.case===PATTERN_CASE)){ out.push(Object.assign(base,{x1,x2,w1,w2,factor:f,masked:false})); return; }
    const cuts=[x1].concat(segs.slice(1).map(s=>s.a).filter(b=>b>x1+1e-6 && b<x2-1e-6)).concat([x2]);
    const wAt=x=>(x2-x1<1e-9)? w1 : w1+(w2-w1)*(x-x1)/(x2-x1);
    for(let k=0;k<cuts.length-1;k++){
      const p=cuts[k], q=cuts[k+1];
      const inMask=!mask || ld.case!==mask.case || mask.segIdx.includes(segIndexOf(segs,(p+q)/2));
      out.push(Object.assign({},base,{x1:p,x2:q,w1:wAt(p),w2:wAt(q),factor:inMask? f : 0,masked:!inMask}));
    }
  });
  return out;
}
/* Canonical key of the Q loads a mask keeps (for de-duplicating patterns). */
function patternKey(mask){
  return comboLoadPieces({factors:{[PATTERN_CASE]:1},mask}).filter(p=>p.case===PATTERN_CASE && p.factor!==0)
    .map(p=> p.type==='point'||p.type==='moment' ? p.i+'@'+p.pos.toFixed(3) : p.i+':'+p.x1.toFixed(3)+'-'+p.x2.toFixed(3)).join('|');
}
/* Expand the enabled user combinations with the automatic span-wise patterns.
   For every combination with a non-zero Q factor: Q on each single segment,
   on each pair of adjacent segments and on the alternate (odd / even) segments,
   G (and W, E) at their entered factors on every span. Patterns whose Q load
   set is empty, equals the parent's or repeats an earlier pattern are dropped.
   Each generated combination is a shallow copy of its parent with a new id,
   the label suffixed "(Q on span 2 only)" etc., mask and parent fields. The
   limitation gamma_G,inf = 1.0 on relieving spans (EN 1990 Table A1.2(B)) is
   NOT generated; it is stated in the printed note (patternInfo). */
function expandPatternCombos(userCombos){
  if(!patternLoadingActive()) return userCombos.slice();
  const segs=spanSegments(), n=segs.length;
  const sets=[];
  for(let i=0;i<n;i++) sets.push({idx:[i],label:'Q on span '+(i+1)+' only',kind:'single'});
  for(let i=0;i<n-1;i++) sets.push({idx:[i,i+1],label:'Q on spans '+(i+1)+'+'+(i+2)+' only',kind:'pair'});
  if(n>=3){
    sets.push({idx:segs.map((s,i)=>i).filter(i=>i%2===0),label:'Q on odd spans only',kind:'odd'});
    sets.push({idx:segs.map((s,i)=>i).filter(i=>i%2===1),label:'Q on even spans only',kind:'even'});
  }
  const fullKey=patternKey({case:PATTERN_CASE,segIdx:segs.map((s,i)=>i),segs});
  const out=[];
  userCombos.forEach(cb=>{
    out.push(cb);
    if(!(Math.abs(cb.factors[PATTERN_CASE]??0)>1e-12)) return;
    const seen=new Set();
    sets.forEach((st,k)=>{
      const mask={case:PATTERN_CASE,segIdx:st.idx,segs:st.idx.map(i=>segs[i]),kind:st.kind,label:st.label};
      const key=patternKey(mask);
      if(!key || key===fullKey || seen.has(key)) return;
      seen.add(key);
      out.push(Object.assign({},cb,{id:(cb.id||'combo')+'#p'+(k+1),label:cb.label+' ('+st.label+')',mask,parent:cb,pattern:true}));
    });
  });
  return out;
}
/* Printed description of the pattern set (pure). */
function patternInfo(ulsCombos,slsCombos){
  const segs=spanSegments();
  const on = S.autoPattern==null ? true : !!S.autoPattern;
  const nU=ulsCombos.filter(c=>c.pattern).length, nS=slsCombos.filter(c=>c.pattern).length;
  const segText=segs.map(s=>'span '+s.no+': '+(s.a/1000).toFixed(2).replace(/\.?0+$/,'')+'&ndash;'+(s.b/1000).toFixed(2).replace(/\.?0+$/,'')+' m'+(s.cant? ' (cantilever)':'')).join('; ');
  const limitation='&gamma;<sub>G,inf</sub> = 1.0 on relieving spans (EN 1990 Table A1.2(B)) is NOT generated: G acts at its entered factor on every span; add a reduced-G combination by hand where a relieving permanent action could govern (uplift, cantilever back spans).';
  let note=null;
  if(segs.length>1 && on) note='Automatic pattern loading: '+nU+' ULS and '+nS+' SLS combinations generated from the support layout ('+segText+'): Q on each span, on each pair of adjacent spans and on alternate spans, with G, W and E at their entered factors on every span (EN 1990 6.10 as entered). '+limitation;
  else if(segs.length>1) note='Automatic pattern loading is OFF: only the entered combinations are analysed ('+segText+'). Adverse / relieving span patterns of the variable action must be entered by hand, and '+limitation;
  return {on, active:on&&segs.length>1, segs, nUls:nU, nSls:nS, note, limitation, segText};
}

function comboLoads(combo){
  // Always include every load (factor 0 if its case isn't in this combo) so that
  // load/support positions   and therefore the solver's x-grid   are identical
  // across every combination. That's what makes the envelope comparison below valid.
  // Pattern combinations (combo.mask) get their Q loads through comboLoadPieces().
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
  if(!(finite(S.leFactor) && S.leFactor>0)) errs.push("Effective length factor must be greater than 0.");
  ['axial','Mz','za'].forEach(k=>{ if(!finite(S[k])) errs.push(`${k} must be a finite number.`); });
  const area=activeSection().A;
  if(S.anet!=null && !(finite(S.anet)&&S.anet>0&&S.anet<=area)) errs.push('Net area must be greater than zero and no greater than the gross area.');
  ['Ke','robX','robY','C1o'].forEach(k=>{ if(S[k]!=null && !(finite(S[k])&&S[k]>0)) errs.push(`${k} override must be greater than zero.`); });
  if(S.mcrMethod!=null && S.mcrMethod!=='eigen' && S.mcrMethod!=='standard') errs.push(`Unknown Mcr method "${S.mcrMethod}": use "eigen" (FE eigensolver) or "standard" (closed form).`);
  [['mLTo',0.44],['mxo',0.4]].forEach(([k,min])=>{ if(S[k]!=null && !(finite(S[k])&&S[k]>=min&&S[k]<=1)) errs.push(`${k} override must be between ${min} and 1.`); });
  if(S.mLTo!=null && (S.destab || (S.supports.length===1&&S.supports[0].type==='fixed')) && S.mLTo!==1) errs.push('mLT must be 1 for cantilevers and destabilising loading.');
  const seenSupports=new Set();
  S.supports.forEach((sp,i)=>{
    if(!['pinned','fixed'].includes(sp.type)) errs.push(`Support ${i+1} has an unknown restraint type.`);
    if(!inSpan(sp.pos)) errs.push(`Support ${i+1} position must be within 0 to ${S.L} m.`);
    const key=(+sp.pos).toFixed(6);
    if(seenSupports.has(key)) errs.push(`Duplicate supports at ${g(+sp.pos,3)} m are not allowed; combine them into one support.`);
    seenSupports.add(key);
  });
  (S.hinges||[]).forEach((h,i)=>{
    if(!inSpan(h.pos)) errs.push(`Internal hinge ${i+1} position must be within 0 to ${S.L} m.`);
    else if(+h.pos<=1e-6 || +h.pos>=S.L-1e-6) errs.push(`Internal hinge ${i+1} must be inside the span, not at an end.`);
    if(S.supports.some(sp=>Math.abs(+sp.pos-(+h.pos))<1e-6)) errs.push(`Internal hinge ${i+1} coincides with a support; this combined release is not supported. A pinned support does not release the internal moment of a continuous beam.`);
  });
  S.loads.forEach((ld,i)=>{
    const tag=`Load ${i+1}`;
    ['e','zg'].forEach(k=>{ if(ld[k]!=null&&!finite(ld[k])) errs.push(`${tag} ${k} must be a finite number.`); });
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
  if(errs.length) throw errs.join(" ");
}
function analyse(){
  const sec=activeSection();
  syncSelfWeightLoads();
  const L=S.L*1000;
  const py = S.py!=null? S.py : pyFromGrade(S.grade,sec.tf);
  const E=S.E;
  const Ix=sec.Ix*1e4, EI=E*Ix;
  if(S.supports.length===0) throw "Add at least one support.";
  const npin=S.supports.filter(s=>s.type==='pinned').length;
  const nfix=S.supports.filter(s=>s.type==='fixed').length;
  const distinct=new Set(S.supports.map(s=>+(+s.pos).toFixed(4))).size;
  if(!((npin+nfix>=1) && (nfix>=1 || distinct>=2)))
    throw "Under-restrained layout (mechanism). Use a Fixed support, or at least two supports at different positions.";
  // Internal hinges release moment; each needs one extra restraint unit. Necessary
  // stability condition: restraint units (pin=1 vertical, fixed=2 vertical+moment)
  // >= 2 (rigid-body vertical + rotation) + one per interior hinge.
  const nHinge=(S.hinges||[]).filter(h=> +h.pos>1e-6 && +h.pos<S.L-1e-6 && !S.supports.some(sp=>Math.abs(+sp.pos-(+h.pos))<1e-6)).length;
  const Rcount=npin+2*nfix;
  if(Rcount < 2+nHinge)
    throw `Under-restrained layout (mechanism): ${nHinge} internal hinge(s) release moment, so at least ${2+nHinge} restraint units are needed (pin = 1, fixed = 2) but only ${Rcount} are provided. Add a support or make one Fixed (e.g. a propped / Gerber layout).`;
  const supportsMM=S.supports.map(s=>({pos:(+s.pos)*1000,type:s.type}));
  const hingesMM=(S.hinges||[]).map(h=>(+h.pos)*1000).filter(x=>x>1e-6 && x<L-1e-6);

  const ulsUser=S.combos.filter(c=>c.on && !c.sls);
  const slsUser=S.combos.filter(c=>c.on && c.sls);
  if(ulsUser.length===0) throw 'Enable at least one ULS load combination (see "Load Combinations").';
  if(slsUser.length===0) throw 'Enable at least one SLS (deflection) load combination (see "Load Combinations").';
  validateInputs(py,E,ulsUser,slsUser);
  // Automatic pattern loading: each enabled user combination is followed by its
  // generated span-wise patterns (comboLoadPieces applies the mask); every
  // consumer below sees them exactly like user combinations.
  const ulsCombos=expandPatternCombos(ulsUser);
  const slsCombos=expandPatternCombos(slsUser);
  const patterns=patternInfo(ulsCombos,slsCombos);

  // Run every enabled ULS combination; the same load/support geometry means every
  // combo's result lands on an identical x-grid, so elementwise envelopes are valid.
  const ulsResults=ulsCombos.map(combo=>{
    const loads=comboLoads(combo);
    const r=solveBeam(L,EI,supportsMM,loads,120,hingesMM);
    if(!r.w.every(Number.isFinite)) throw hingesMM.length? "Under-restrained layout (mechanism): an internal hinge has left part of the beam unrestrained. Add another support (e.g. a propped/Gerber layout) or remove the hinge." : "Under-restrained layout (mechanism). Add a support, or make a support Fixed to prevent rigid-body motion.";
    const fb=sfdBmd(L,supportsMM,loads,r.reactions);
    let Vmax=0; fb.V.forEach(v=>{ if(Math.abs(v)>Math.abs(Vmax)) Vmax=v; });
    let Mmax=0,Mpos=0; fb.xs.forEach((x,i)=>{ if(Math.abs(fb.M[i])>Math.abs(Mmax)){Mmax=fb.M[i];Mpos=x;} });
    return {combo,r,fb,Vmax,Mmax,Mpos};
  });
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

  // SLS deflection: worst of every enabled SLS combination, checked segment by
  // segment (support to support, and each cantilever / end overhang) against
  // its own length: span/S.divisor between supports, L/S.divisorCant for a
  // cantilever segment (UK NA to EN 1993-1-1 Table NA.2 cantilever row, default
  // 180 [verify]), each capped by the optional absolute limit S.deflAbs (mm).
  // A cantilever segment's value is the tip deflection relative to its support
  // (support nodes have w = 0; the root rotation is inside the solver).
  const deflSegs=spanSegments();
  const divisorCant=(S.divisorCant!=null && Number.isFinite(+S.divisorCant) && +S.divisorCant>0)? +S.divisorCant : 180;
  const deflAbs=(S.deflAbs!=null && S.deflAbs!=='' && Number.isFinite(+S.deflAbs) && +S.deflAbs>0)? +S.deflAbs : null;
  const slsResults=slsCombos.map(combo=>{
    const loads=comboLoads(combo);
    const r=solveBeam(L,EI,supportsMM,loads,120,hingesMM);
    if(!r.w.every(Number.isFinite)) throw hingesMM.length? "Under-restrained layout (mechanism): an internal hinge has left part of the beam unrestrained. Add another support (e.g. a propped/Gerber layout) or remove the hinge." : "Under-restrained layout (mechanism). Add a support, or make a support Fixed to prevent rigid-body motion.";
    let dmax=0,dpos=0; r.nodes.forEach((x,i)=>{ if(Math.abs(r.w[i])>Math.abs(dmax)){dmax=r.w[i];dpos=x;} });
    let deflection=null;
    const segs=deflSegs.map(sg=>{
      const start=sg.a,end=sg.b,span=end-start;
      let dm=0,dp=start;
      r.nodes.forEach((x,i)=>{ if(x>=start&&x<=end&&Math.abs(r.w[i])>Math.abs(dm)){dm=r.w[i];dp=x;} });
      const divisor= sg.cant? divisorCant : S.divisor;
      const limSpan=span/divisor;
      const absGoverns= deflAbs!=null && deflAbs<limSpan;
      const limit= absGoverns? deflAbs : limSpan;
      const util=Math.abs(dm)/limit;
      const rec={no:sg.no,start,end,span,cant:!!sg.cant,dmax:dm,dpos:dp,limit,util,divisor,limSpan,abs:deflAbs,absGoverns,combo:combo.label};
      if(!deflection||util>deflection.util) deflection=rec;
      return rec;
    });
    return {combo,r,dmax,dpos,deflection,segs};
  });
  let governD=slsResults[0]; slsResults.forEach(r=>{ if(r.deflection.util>governD.deflection.util) governD=r; });
  const dmax=governD.dmax, dpos=governD.dpos;
  // per-segment deflection table: the worst SLS combination of every segment
  const deflSegments=deflSegs.map((sg,j)=>{
    let worst=null; slsResults.forEach(res=>{ const s=res.segs[j]; if(!worst||s.util>worst.util) worst=s; });
    return worst;
  });

  // ---- uplift / hold-down (EN 1990 2.4.4 EQU): every combination's reactions ----
  // A negative vertical reaction (up = positive) means the support must hold
  // the beam down. Recorded per combination; the worst per support is kept
  // (design force = the worst ULS value, SLS uplift listed separately).
  const uplift=[];
  ulsResults.forEach(res=>res.r.reactions.forEach((re,i)=>{ if(re.V< -1) uplift.push({n:i+1,pos:re.pos,R:re.V/1000,combo:res.combo.label,sls:false}); }));
  slsResults.forEach(res=>res.r.reactions.forEach((re,i)=>{ if(re.V< -1) uplift.push({n:i+1,pos:re.pos,R:re.V/1000,combo:res.combo.label,sls:true}); }));
  const upliftSupports=S.supports.map((sp,i)=>{
    const rows=uplift.filter(u=>u.n===i+1);
    if(!rows.length) return null;
    const worst=rows.reduce((p,u)=>u.R<p.R?u:p);
    const ulsRows=rows.filter(u=>!u.sls), slsRows=rows.filter(u=>u.sls);
    const worstUls=ulsRows.length? ulsRows.reduce((p,u)=>u.R<p.R?u:p) : null;
    const worstSls=slsRows.length? slsRows.reduce((p,u)=>u.R<p.R?u:p) : null;
    return {n:i+1,pos:worst.pos,type:sp.type,holdDown:!!sp.holdDown,R:worst.R,combo:worst.combo,sls:worst.sls,
      RUls:worstUls? worstUls.R : null, comboUls:worstUls? worstUls.combo : null,
      RSls:worstSls? worstSls.R : null, comboSls:worstSls? worstSls.combo : null, nCombos:rows.length};
  }).filter(Boolean);

  // ---- torsion from load eccentricity (loads at e from the shear centre) ----
  // Torque loads mirror the transverse loads: q_T(x) = w(x)*e, point torques P*e.
  // Every support is a fork support (twist prevented): GIt*phi'' = -q_T with phi=0
  // at supports, solved by 1-dof linear elements (nodal phi exact for this ODE);
  // the torque diagram T(x) then follows by statics, reusing sfdBmd (its V output).
  let tors=null;
  const swE=selfWeightEccentricity(sec);
  const anyUserEcc = S.eccOn && S.loads.some(ld=>!ld.isSelfWeight && ld.type!=='moment' && Math.abs(ld.e||0)>1e-9);
  const anySelfWeightEcc = S.eccOn && Math.abs(swE)>1e-9 && selfWeightValue(sec)>0 &&
    [...ulsCombos,...slsCombos].some(cb=>Math.abs(cb.factors.G??0)>1e-12);
  const anyEcc = anyUserEcc || anySelfWeightEcc;
  const torsErr = (anyEcc && !(sec.J>0))? "the section torsional constant I_T is zero or undefined in the section data" : null;
  if(anyEcc && !torsErr){
    const GIt=81000*sec.J*1e4; // N.mm2 (G = 81000 N/mm2 per SN003a / P385)
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
    const solveT=(tq)=>{
      const nodes=buildNodes(L,supportsMM,tq,120);
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
      const fixed=new Set(); S.supports.forEach(s=>{ const i=idx.get(+(((+s.pos)*1000)).toFixed(6)); if(i!=null) fixed.add(i); });
      const free=[]; for(let d2=0;d2<n;d2++) if(!fixed.has(d2)) free.push(d2);
      const phi=new Array(n).fill(0);
      if(free.length){ const Kff=free.map(r=>free.map(cc=>K[r][cc])), Ff=free.map(r=>F[r]);
        const df=linsolve(Kff,Ff); free.forEach((dof,j)=>phi[dof]=df[j]); }
      const R=new Array(n).fill(0);
      for(let i=0;i<n;i++){ let s2=0; for(let j=0;j<n;j++) s2+=K[i][j]*phi[j]; R[i]=s2-F[i]; }
      const reactions=S.supports.map(s=>({pos:(+s.pos)*1000,type:'pinned',V:R[idx.get(+(((+s.pos)*1000)).toFixed(6))]}));
      const fb=sfdBmd(L,supportsMM,tq,reactions);
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

  // ---- P385 open-section torsion (Method B closed forms) ----
  let torsO=null;
  if(anyEcc && torsErr && !sec.isBox){ torsO={ok:false,reason:torsErr}; }
  if(anyEcc && !torsErr && !sec.isBox){
    const tp=sec.tp;
    const IT=((tp&&tp.IT)? tp.IT : sec.J)*1e4;                     // mm4, P385 App A preferred
    const IwO=(((tp&&tp.Iw!=null)? tp.Iw : sec.Iw)||0)*1e12;       // mm6
    const GItO=81000*IT;
    const aa=IwO>0? Math.sqrt(E*IwO/GItO) : 0; // use the same E as the bending analysis
    const endsOK = S.supports.length===2 &&
      Math.min(...S.supports.map(s=>+s.pos))<=1e-6 &&
      Math.abs(Math.max(...S.supports.map(s=>+s.pos))-S.L)<=1e-6;
    const mk385=(combo)=>{
      const list=[];
      for(const p of comboLoadPieces(combo)){
        if(p.type==='moment') continue;
        const f=p.factor, le=p.e;
        if(!f||Math.abs(le)<1e-9) continue;
        if(p.type==='point'){ list.push({kind:'point',alpha:p.pos/L,T:p.P*f*1000*le}); }
        else {
          const x1=p.x1, x2=p.x2;
          if(x1>1e-6 || Math.abs(x2-L)>1e-6) return {ok:false,reason:'partial-span eccentric distributed load on an open section: the P385 fork-fork closed forms (Cases 3/4/10) cover full-span distributed torque only'};
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
    if(!(IT>0)) torsO={ok:false,reason:'the torsional constant I_T is zero or undefined'};
    else if(!(IwO>0)||!(aa>0)||!isFinite(aa)) torsO={ok:false,reason:'no warping constant available for this section'};
    else if(!endsOK) torsO={ok:false,reason:'open-section torsion per P385 requires a single span with fork supports at both ends (Cases 3/4/10); cantilevers and multi-span layouts are not covered'};
    else {
      let bad=null;
      const sols=[];
      for(const res of ulsResults){
        const m=mk385(res.combo);
        if(!m.ok){ bad=m.reason; break; }
        sols.push({combo:res.combo, fb:res.fb, sol:p385Solve(L,aa,GItO,m.list)});
      }
      let slsSol=null;
      if(!bad){
        for(const cb of slsCombos){
          const m=mk385(cb);
          if(!m.ok){ bad=m.reason; break; }
          const s2=p385Solve(L,aa,GItO,m.list);
          let pm=0,pp=0; s2.phi.forEach((v,i)=>{ if(Math.abs(v)>Math.abs(pm)){pm=v;pp=s2.xs[i];} });
          if(!slsSol||Math.abs(pm)>Math.abs(slsSol.phiMax)) slsSol={combo:cb,phiMax:pm,phiPos:pp};
        }
      }
      torsO= bad? {ok:false,reason:bad} : {ok:true,aa,X:L/aa,IT,Iw:IwO,GIt:GItO,sols,sls:slsSol};
    }
  }
  return {sec,py,E,L,Ix,tors,torsO,torsErr,swPerM:sec.mass*9.81/1000,ulsResults,
    Vmax:Vmax/1000, Mmax:Mmax/1e6, Mpos:Mpos/1000,
    Mq:Mq/1e6, Mh:Mh/1e6, Mq3:Mq3/1e6, M24:M24/1e6, M0end:M0end/1e6, MLend:MLend/1e6,
    dmax, dpos:dpos/1000, deflection:governD.deflection, deflSegments, divisorCant, deflAbs,
    diag:{xs:xs.map(x=>x/1000), V:Venv.map(v=>v/1000), M:Menv.map(m=>m/1e6),
          dx:governD.r.nodes.map(x=>x/1000), dw:governD.r.w},
    reactions, ulsResults, slsResults, governV, governM, governD,
    patterns, ulsCombos, slsCombos, uplift:{list:uplift, supports:upliftSupports, any:upliftSupports.length>0}};
}

/* ---- Hold-down check (19 Sep 2026 gap closure, item 1.2), pure ----
   One row per support that lifts in any combination. A support lifting in a
   ULS combination is blocking (unsupported) unless its "hold-down provided"
   box is ticked, in which case it is an advisory carrying the design force.
   A support that lifts ONLY in SLS combinations (the default NA 2.23
   "variable actions only" deflection case has no G, so its reaction is not an
   equilibrium state) is reported as an advisory naming the combination and
   the force, with the reminder that the EQU set-A combination (gamma_G,inf =
   0.9, Table A1.2(A)) is not generated and must be verified by hand.
   Returns {rows, unsupported, advisory}; rows = [{n, pos (mm), R (kN,
   negative), combo, sls, RUls, comboUls, RSls, comboSls, holdDown, level:
   'uls'|'sls', blocking, msg}]. */
function holdDownCheck(a){
  const out={rows:[],unsupported:[],advisory:[]};
  const up=a.uplift&&a.uplift.supports||[];
  up.forEach(u=>{
    const kN=v=>(Math.abs(v)).toFixed(2);
    const where='at support '+u.n+' (x = '+(u.pos/1000).toFixed(2).replace(/\.?0+$/,'')+' m)';
    let msg, blocking=false, level;
    if(u.RUls!=null){
      level='uls';
      const force=(withWhere)=>'R = &minus;'+kN(u.RUls)+' kN'+(withWhere? ' '+where : '')+' (combination '+u.comboUls+')'+(u.RSls!=null? '; SLS uplift &minus;'+kN(u.RSls)+' kN ('+u.comboSls+')' : '');
      if(u.holdDown) msg='Hold-down provided '+where+': design the hold-down for '+force(false)+'. Reaction taken as tension at the support; the connection and the supporting structure are not designed here.';
      else { blocking=true; msg='Hold-down required: '+force(true)+'. The support cannot resist uplift as modelled; tick "hold-down provided" for this support once a holding-down connection is designed for this force, or revise the layout / loading (EN 1990 2.4.4 EQU; the '+PATTERN_CASE+' patterns and any relieving-G combination must be included).'; }
    } else {
      level='sls';
      msg='Hold-down check (SLS only) '+where+': the variable-action-only combination '+u.comboSls+' lifts this support by R = &minus;'+kN(u.RSls)+' kN; no ULS combination lifts it (G holds it down at ULS)'+(u.holdDown? '; hold-down provided' : '')+'. A deflection combination without G is not an equilibrium state, so this does not block PASS, but the EQU set-A combination with &gamma;<sub>G,inf</sub> = 0.9 (EN 1990 Table A1.2(A)) is NOT generated: verify it by hand where the permanent action is small relative to the variable action.';
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
  if(a.patterns&&a.patterns.note) c.advisory.push(a.patterns.note);
  c.gov=c.utils.reduce((p,u)=>u.val>p.val?u:p);
  c.pass=c.unsupported.length===0&&c.utils.every(u=>Number.isFinite(u.val)&&u.val>=0&&u.val<=1.0001);
  c.combinationChecks=results.map(r=>({combo:r.res.combo.label,utils:r.c.utils}));
  return c;
}

