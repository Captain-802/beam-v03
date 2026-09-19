/* ===========================================================================
   7. WIRING
   =========================================================================== */
let raf=null;
function recompute(){ if(raf) cancelAnimationFrame(raf); raf=requestAnimationFrame(render); }
function printReport(){
  try{
    if(raf) cancelAnimationFrame(raf);
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
  S.rootWarp=$("rootWarp").value;
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
  S.leFactor=parseFloat($("leFactor").value);
  S.destab=$("destab").checked;
  const mlt=parseFloat($("mLTo").value); S.mLTo=isFinite(mlt)?mlt:null;
  const mxo=parseFloat($("mxo").value); S.mxo=isFinite(mxo)?mxo:null;
  const c1o=parseFloat($("C1o").value); S.C1o=isFinite(c1o)?c1o:null;
  S.divisor=parseFloat($("divisor").value);
  if($("divisorCant")){ const dc=parseFloat($("divisorCant").value); S.divisorCant=isFinite(dc)?dc:180; }
  if($("deflAbs")){ const da=parseFloat($("deflAbs").value); S.deflAbs=isFinite(da)?da:null; }
  if($("autoPattern")) S.autoPattern=$("autoPattern").checked;
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
  ["grade","py","anet","length","axial","Mz","leFactor","mLTo","mxo","C1o","divisor","divisorCant","deflAbs","E","Ke","robertsonX","robertsonY"]
    .forEach(id=>{ if($(id)) $(id).addEventListener("input",()=>{ readScalarInputs(); recompute(); }); });
  $("za").addEventListener("input",()=>{ readScalarInputs(); renderLoadList(); recompute(); });
  $("destab").addEventListener("change",()=>{ readScalarInputs(); recompute(); });
  if($("autoPattern")) $("autoPattern").addEventListener("change",()=>{ readScalarInputs(); recompute(); });
  $("eccOn").addEventListener("change",()=>{ readScalarInputs(); renderLoadList(); recompute(); });
  $("rootWarp").addEventListener("change",()=>{ readScalarInputs(); recompute(); });
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
  $("length").addEventListener("change",()=>{ // stretch full-span loads/supports that sat at old end
    readScalarInputs(); syncSelfWeightLoads(); renderSupportList(); renderHingeList(); renderLoadList(); recompute(); });
  document.querySelectorAll("[data-preset]").forEach(b=>b.addEventListener("click",()=>{
    const L=S.L, p=b.dataset.preset;
    S.supports = p==='cant'? [{pos:0,type:'fixed'}]
      : p==='ss'? [{pos:0,type:'pinned'},{pos:L,type:'pinned'}]
      : p==='propped'? [{pos:0,type:'fixed'},{pos:L,type:'pinned'}]
      : [{pos:0,type:'fixed'},{pos:L,type:'fixed'}];
    S.hinges=[];   // a preset can leave an existing hinge as a mechanism
    if(p==='cant'){ S.leFactor=1.0; } $("leFactor").value=S.leFactor;
    renderSupportList(); renderHingeList(); recompute();
  }));
  $("addSupport").addEventListener("click",()=>{ S.supports.push({pos:+(S.L).toFixed(2),type:'pinned'}); renderSupportList(); recompute(); });
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
