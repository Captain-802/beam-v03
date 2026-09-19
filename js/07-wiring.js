/* ===========================================================================
   7. WIRING
   =========================================================================== */
/* render() is synchronous and an eccentric eigen case with several ULS
   combinations can take seconds (every combination is an eigen + FE torsion
   solve), so the recompute is debounced: rapid input events collapse into one
   render after RECOMPUTE_DEBOUNCE_MS of quiet (19 Sep 2026 review). */
const RECOMPUTE_DEBOUNCE_MS=250;
let raf=null;
function recompute(){ if(raf) clearTimeout(raf); raf=setTimeout(()=>{ raf=null; render(); },RECOMPUTE_DEBOUNCE_MS); }
function printReport(){
  try{
    if(raf) clearTimeout(raf);
    raf=null;
    render();
    window.focus();
    window.print();
  } catch(err){
    alert("Print failed in this browser. Use Ctrl+P after the report is visible.");
  }
}

function readScalarInputs(){
  setDesignCode($("code").value);
  S.restraint=$("restraint").value;
  if($("mcrMethod")) S.mcrMethod=$("mcrMethod").value;
  S.eccOn=$("eccOn").checked;
  S.za=parseFloat($("za").value);
  S.family=$("family").value;
  S.sectionKey=$("pfcSelect").value;
  S.shsType=$("shsType").value;
  S.shsKey=$("shsSelect").value;
  S.ubKey=$("ubSelect").value;
  S.ucKey=$("ucSelect").value;
  S.rhsKey=$("rhsSelect").value;
  S.grade=$("grade").value;
  const sec=activeSection();
  const pyv=parseFloat($("py").value);
  const autoPy=pyFromGrade(S.grade,sec.tf);
  S.py = (isFinite(pyv)&&Math.abs(pyv-autoPy)>1e-6)? pyv : null;
  const an=parseFloat($("anet").value); S.anet=isFinite(an)?an:null;
  S.L=parseFloat($("length").value);
  S.axial=parseFloat($("axial").value);
  S.Mz=parseFloat($("Mz").value);
  { const le=parseFloat($("leFactor").value); S.leFactor=isFinite(le)? le : null; }   // blank = strut lengths from the end fixities
  S.destab=$("destab").checked;
  const mlt=parseFloat($("mLTo").value); S.mLTo=isFinite(mlt)?mlt:null;
  const mxo=parseFloat($("mxo").value); S.mxo=isFinite(mxo)?mxo:null;
  const c1o=parseFloat($("C1o").value); S.C1o=isFinite(c1o)?c1o:null;
  if($("LT")){ const lt=parseFloat($("LT").value); S.LT=isFinite(lt)?lt:null; }
  S.divisor=parseFloat($("divisor").value);
  if($("divisorCant")){ const dc=parseFloat($("divisorCant").value); S.divisorCant=isFinite(dc)?dc:180; }
  if($("deflAbs")){ const da=parseFloat($("deflAbs").value); S.deflAbs=isFinite(da)?da:null; }
  S.E=parseFloat($("E").value);
  const ke=parseFloat($("Ke").value); S.Ke=isFinite(ke)?ke:null;
  const autoRob=defaultRobertson(S.family,sec.boxType,sec.tf);
  const rvx=parseFloat($("robertsonX").value);
  const rvy=parseFloat($("robertsonY").value);
  S.robX = (isFinite(rvx)&&Math.abs(rvx-autoRob.x)>1e-6)? rvx : null;
  S.robY = (isFinite(rvy)&&Math.abs(rvy-autoRob.y)>1e-6)? rvy : null;
  syncSelfWeightLoads();
}
function wirePlate(){
  if(!$("platePanel")) return;
  $("plateOn").addEventListener("change",()=>{
    plateState().on=$("plateOn").checked; updatePlateUI(); recompute(); });
  $("plateSide").addEventListener("change",()=>{
    plateState().side=$("plateSide").value; updatePlateUI(); recompute(); });
  [["plateT","t"],["plateOutL","outL"],["plateOutR","outR"]].forEach(([id,key])=>{
    $(id).addEventListener("input",()=>{
      plateState()[key]=parseFloat($(id).value)||0; updatePlateUI(); recompute(); });
  });
}

function wire(){
  ["grade","py","anet","length","axial","Mz","leFactor","LT","mLTo","mxo","C1o","divisor","divisorCant","deflAbs","E","Ke","robertsonX","robertsonY"]
    .forEach(id=>{ if($(id)) $(id).addEventListener("input",()=>{ readScalarInputs(); recompute(); }); });
  $("za").addEventListener("input",()=>{ readScalarInputs(); renderLoadList(); recompute(); });
  $("destab").addEventListener("change",()=>{ readScalarInputs(); recompute(); });
  $("eccOn").addEventListener("change",()=>{ readScalarInputs(); renderLoadList(); recompute(); });
  function refreshAutoFields(){
    const sec=activeSection();
    $("py").value=pyFromGrade(S.grade,sec.tf); S.py=null;
    const autoRob=defaultRobertson(S.family,sec.boxType,sec.tf);
    $("robertsonX").value=autoRob.x; $("robertsonY").value=autoRob.y; S.robX=null; S.robY=null;
    if(typeof syncLoadHeightHint === 'function') syncLoadHeightHint(sec, S.code==='EC3' && (S.restraint||'full')!=='full');
    syncSelfWeightLoads(); renderLoadList();
  }
  $("grade").addEventListener("change",()=>{ S.grade=$("grade").value; refreshAutoFields(); recompute(); });
  $("pfcSelect").addEventListener("change",()=>{
    S.sectionKey=$("pfcSelect").value; refreshAutoFields(); recompute(); });
  $("shsSelect").addEventListener("change",()=>{
    S.shsKey=$("shsSelect").value; refreshAutoFields(); recompute(); });
  $("ubSelect").addEventListener("change",()=>{
    S.ubKey=$("ubSelect").value; refreshAutoFields(); recompute(); });
  $("ucSelect").addEventListener("change",()=>{
    S.ucKey=$("ucSelect").value; refreshAutoFields(); recompute(); });
  $("rhsSelect").addEventListener("change",()=>{
    S.rhsKey=$("rhsSelect").value; refreshAutoFields(); recompute(); });
  $("family").addEventListener("change",()=>{
    S.family=$("family").value; syncInputs(); refreshAutoFields(); recompute(); });
  $("code").addEventListener("change",()=>{
    setDesignCode($("code").value);
    syncInputs(); recompute(); });
  $("restraint").addEventListener("change",()=>{
    S.restraint=$("restraint").value; syncInputs(); recompute(); });
  if($("mcrMethod")) $("mcrMethod").addEventListener("change",()=>{
    S.mcrMethod=$("mcrMethod").value; syncInputs(); recompute(); });
  $("shsType").addEventListener("change",()=>{
    S.shsType=$("shsType").value; syncInputs(); refreshAutoFields(); recompute(); });
  $("length").addEventListener("change",()=>{ // the End 2 label (x = L) and full-span loads follow the new length
    readScalarInputs(); syncSelfWeightLoads(); renderEndsPanel(); renderHingeList(); renderLoadList(); recompute(); });
  // End conditions: the preset drop-list and the quick buttons (data-preset = an
  // END_PRESETS key) apply a preset through applyEndPreset() (the seating /
  // hold-down / stiffener entries of the ends are kept, the hinges cleared);
  // 'custom' on the drop-list only names the current flags
  function choosePreset(p){
    if(p==='custom'){ S.endPreset='custom'; renderEndsPanel(); return; }
    applyEndPreset(S,p); renderEndsPanel(); renderHingeList(); recompute();
  }
  if($("endPreset")) $("endPreset").addEventListener("change",()=>choosePreset($("endPreset").value));
  document.querySelectorAll("[data-preset]").forEach(b=>b.addEventListener("click",()=>choosePreset(b.dataset.preset)));
  $("addHinge").addEventListener("click",()=>{ if(!S.hinges) S.hinges=[]; S.hinges.push({pos:+(S.L/2).toFixed(2)}); renderHingeList(); recompute(); });
  document.querySelectorAll("[data-add]").forEach(b=>b.addEventListener("click",()=>{
    const L=S.L, t=b.dataset.add;
    S.loads.push({point:{type:'point',pos:+(L/2).toFixed(3),P:10,case:'Q',e:0,zg:(+S.za||0)},
      udl:{type:'udl',x1:0,x2:L,w:9,case:'Q',e:0,zg:(+S.za||0)},
      trap:{type:'trap',x1:0,x2:L,w1:0,w2:12,case:'Q',e:0,zg:(+S.za||0)},
      moment:{type:'moment',pos:+(L/2).toFixed(3),M:10,case:'Q'}}[t]);
    renderLoadList(); recompute();
  }));
  $("addSelfWeight").addEventListener("click",()=>{
    syncSelfWeightLoads();
    renderLoadList(); recompute();
  });
  $("addCombo").addEventListener("click",()=>{
    S.combos.push({id:'custom'+Date.now(),label:'Custom combination',factors:{G:1,Q:1,W:1,E:1},sls:false,on:true});
    renderComboList(); recompute();
  });
  $("printBtn").addEventListener("click",printReport);
  $("view3dBtn").addEventListener("click",()=>{ readScalarInputs(); open3DView(); });
  $("resetBtn").addEventListener("click",()=>{ S=JSON.parse(JSON.stringify(DEMO)); syncInputs(); recompute(); });
  if($("pfcMirror")) $("pfcMirror").addEventListener("change",()=>{
    S.pfcMirror=$("pfcMirror").checked; updatePlateUI(); recompute(); });
  wirePlate();
}
