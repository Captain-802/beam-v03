/* ===========================================================================
   3. STATE + INPUT UI
   =========================================================================== */
const CASE_LABELS={G:'Dead (G)',Q:'Imposed (Q)',W:'Wind (W)',E:'Other (E)'};
const DEFAULT_COMBOS=[
  {id:'c1', label:'ULS: 1.35G + 1.5Q (Eq 6.10)',          factors:{G:1.35,Q:1.5,W:0,E:0},   sls:false, on:true},
  {id:'s1', label:'SLS: Variable actions only (NA 2.23)',  factors:{G:0,  Q:1.0,W:0,E:0},    sls:true,  on:true},
];
const DEMO={
  code:"EC3",
  family:"ub", sectionKey:"180x75x20", shsType:"HF", shsKey:"150x150x6.3", ubKey:"457 x 191 x 82", ucKey:"203 x 203 x 60", rhsKey:"200 x 100 x 8.0",
  grade:"S275", py:null, anet:null,
  L:8.0,
  supports:[{pos:0,type:'pinned'},{pos:8.0,type:'pinned'}],
  hinges:[],
  loads:[{type:'udl',x1:0,x2:8.0,w:19.7,case:'G'},{type:'udl',x1:0,x2:8.0,w:19.8,case:'Q'}],
  combos:JSON.parse(JSON.stringify(DEFAULT_COMBOS)),
  axial:0, Mz:0, leFactor:1.0, destab:false, mLTo:null, mxo:null, C1o:null,
  LT:null,             // torsional buckling length L_T (m) for a channel under N (cl 6.3.1.4); blank = L_cr,z
  divisor:360, divisorCant:180, deflAbs:null,   // span/360 between supports; L/180 for cantilever segments (UK NA Table NA.2 [verify]); absolute mm cap (null = none)
  autoPattern:true,                             // automatic span-wise Q patterns for multi-span / cantilevered members (expandPatternCombos)
  E:210000, Ke:null, robX:null, robY:null,
  restraint:'full',
  mcrMethod:'eigen',   // EC3 unrestrained Mcr: 'eigen' (FE eigensolver, default) | 'standard' (closed form, SN003a/SN006a)
  eccOn:false, za:0, rootWarp:'free',
  pfcMirror:false,
  plate:{on:false, side:'bottom', t:10, outL:0, outR:150}
};
let S=JSON.parse(JSON.stringify(DEMO));
function setDesignCode(code){
  const from=S.code;
  if(from===code) return;
  const old=from==='EC3'? [1.35,1.5] : [1.4,1.6];
  const next=code==='EC3'? [1.35,1.5] : [1.4,1.6];
  S.combos.forEach(c=>{
    if(c.id==='c1'&&!c.sls&&c.factors.G===old[0]&&c.factors.Q===old[1]&&c.factors.W===0&&c.factors.E===0){
      c.factors.G=next[0];c.factors.Q=next[1];
      c.label=`ULS: ${next[0]}G + ${next[1]}Q (${code==='EC3'?'Eq 6.10':'BS 5950'})`;
    }
  });
  S.code=code;
  if(S.E===205000||S.E===210000) S.E=code==='EC3'?210000:205000;
}
const $=id=>document.getElementById(id);

/* ---- welded bottom plate UI (modelling + self-weight only) ---- */
function plateState(){ if(!S.plate) S.plate=JSON.parse(JSON.stringify(DEMO.plate)); return S.plate; }
function updatePlateUI(){
  const p=plateState();
  if(!$("platePanel")) return;
  const setV=(id,v)=>{ const el=$(id); if(el && document.activeElement!==el) el.value=v; };
  $("plateOn").checked=!!p.on;
  $("plateFields").style.display=p.on?'':'none';
  if(!p.on) return;
  setV("plateSide",p.side||'bottom');
  setV("plateT",p.t); setV("plateOutL",p.outL); setV("plateOutR",p.outR);
  const sec=activeSection(), pl=plateGeom(sec), h=$("plateHint");
  if(!pl){ h.style.display='none'; return; }
  const sides = pl.oL>0&&pl.oR>0? 'both flange edges' : pl.oL>0? 'the left flange edge' : pl.oR>0? 'the right flange edge' : 'the flange, flush';
  const eSw=selfWeightEccentricity(sec);
  h.innerHTML='<b>Plate '+fmtMM(pl.w)+' &times; '+fmtMM(pl.t)+' mm ('+(pl.side==='top'?'top':'bottom')+')</b> ('+pl.massPerM+' kg/m = '
    +(pl.massPerM*9.81/1000).toFixed(3)+' kN/m), extended past '+sides+'.'
    +' Total self-weight now '+selfWeightValue(sec)+' kN/m'
    +(Math.abs(eSw)>0.5? '; combined self-weight centroid e = '+eSw+' mm from the shear centre.':'.');
  h.style.display='';
}

function fmtMM(v){
  if(!isFinite(v)) return " ";
  const s=(Math.abs(v)<5e-7?0:v).toFixed(1);
  return s.replace(/(\.\d*?)0+$/,'$1').replace(/\.$/,'');
}
function loadHeightReference(sec){
  const depth=+sec.D || 0;
  const wallOrFlange=+sec.tf || 0;
  return {
    topSurface: depth/2,
    topLine: Math.max(depth/2 - wallOrFlange/2, 0),
    bottomSurface: -depth/2
  };
}
function loadHeightReferenceText(sec){
  const ref=loadHeightReference(sec);
  return "Refs from shear centre: top +" + fmtMM(ref.topSurface) + " mm; bottom " +
    fmtMM(ref.bottomSurface) + " mm. Positive z<sub>g</sub> = destabilising.";
}
function loadHeightPerLoadOn(){
  return S.code==='EC3' && (S.restraint||'full')!=='full';
}
function loadZgValue(ld){
  return S.eccOn && ld && ld.zg!=null && isFinite(+ld.zg) ? +ld.zg : (+S.za||0);
}
function syncLoadHeightHint(sec, show){
  const el=$("zaHint");
  if(!el) return;
  el.innerHTML=loadHeightReferenceText(sec);
  el.style.display=show ? '' : 'none';
}

function renderSupportList(){
  const c=$("supportList"); c.innerHTML="";
  // In EC3 unrestrained mode every vertical support is a fork (v = phi = 0);
  // these per-support checkboxes ADD lateral-bending (v') and warping (phi')
  // fixity to the LTB model only - the SCI Mcr tool's dU = F / dtheta = F -
  // without touching the vertical bending model (unlike a Fixed support).
  const ltbBCOn = S.code==='EC3' && (S.restraint||'full')!=='full';
  const webBearingOn = webBearingInputsOn(), secWB = activeSection();
  S.supports.forEach((sp,i)=>{
    const row=document.createElement("div"); row.className="row";
    row.innerHTML=`<div class="rowhead"><b style="font-size:12px">Support ${i+1}</b>
      <button class="del" data-si="${i}">remove</button></div>
      <div class="grid2">
        <div class="fld"><span>Position, m</span><input type="number" step="0.01" value="${sp.pos}" data-sp="pos" data-i="${i}"></div>
        <div class="fld"><span>Type</span><select data-sp="type" data-i="${i}">
          <option value="pinned"${sp.type==='pinned'?' selected':''}>Pinned</option>
          <option value="fixed"${sp.type==='fixed'?' selected':''}>Fixed</option></select></div>
      </div>
      ${webBearingOn? `<div class="grid2" style="margin-top:4px">
        <div class="fld"><span>Stiff bearing s<sub>s</sub>, mm (blank = B = ${fmtMM(secWB.B)} [verify])</span><input type="number" step="1" min="0" placeholder="${fmtMM(secWB.B)}" value="${sp.ss!=null&&sp.ss!==''&&isFinite(+sp.ss)? sp.ss : ''}" data-sp="ss" data-i="${i}"></div>
        <label class="checkline" style="align-self:end"><input type="checkbox" data-spc="stiff" data-i="${i}"${sp.stiff?' checked':''}> <span>bearing stiffener provided (EN 1993-1-5 9.4)</span></label>
      </div>` : ''}
      <div class="ltb-checks" style="margin-top:4px">
        <label class="checkline"><input type="checkbox" data-spc="holdDown" data-i="${i}"${sp.holdDown?' checked':''}> <span>hold-down provided (uplift resisted)</span></label>${ltbBCOn? `
        <label class="checkline"><input type="checkbox" data-spc="vp" data-i="${i}"${sp.vp?' checked':''}> <span>lat. bending v&prime; fixed (LTB)</span></label>
        <label class="checkline"><input type="checkbox" data-spc="phip" data-i="${i}"${sp.phip?' checked':''}> <span>warping &phi;&prime; fixed (LTB)</span></label>`:''}
      </div>`;
    c.appendChild(row);
  });
  c.querySelectorAll("[data-sp]").forEach(el=>el.addEventListener("input",e=>{
    const i=+e.target.dataset.i, k=e.target.dataset.sp;
    // ss: blank = default (section flange width B); a number is kept as entered
    S.supports[i][k]= k==='pos'? parseFloat(e.target.value) : k==='ss'? (e.target.value===''? null : parseFloat(e.target.value)) : e.target.value; recompute();
  }));
  c.querySelectorAll("[data-spc]").forEach(el=>el.addEventListener("change",e=>{
    const i=+e.target.dataset.i, k=e.target.dataset.spc;
    S.supports[i][k]=e.target.checked; recompute();
  }));
  c.querySelectorAll(".del").forEach(b=>b.addEventListener("click",e=>{
    S.supports.splice(+e.target.dataset.si,1); renderSupportList(); recompute(); }));
}
function renderHingeList(){
  const c=$("hingeList"); if(!c) return; c.innerHTML="";
  if(!S.hinges) S.hinges=[];
  S.hinges.forEach((h,i)=>{
    const row=document.createElement("div"); row.className="row";
    row.innerHTML=`<div class="rowhead"><b style="font-size:12px">Internal hinge ${i+1}</b>
      <button class="del" data-hi="${i}">remove</button></div>
      <div class="grid2">
        <div class="fld"><span>Position, m</span><input type="number" step="0.01" value="${h.pos}" data-hp="${i}"></div>
        <div class="fld"><span>Release</span><span style="font-size:11px;color:#6b7280;padding-top:8px">Bending moment M = 0 (in-plane)</span></div>
      </div>`;
    c.appendChild(row);
  });
  c.querySelectorAll("[data-hp]").forEach(el=>el.addEventListener("input",e=>{
    S.hinges[+e.target.dataset.hp].pos=parseFloat(e.target.value); recompute(); }));
  c.querySelectorAll(".del").forEach(b=>b.addEventListener("click",e=>{
    S.hinges.splice(+e.target.dataset.hi,1); renderHingeList(); recompute(); }));
}
function loadFields(ld,i){
  const f=(label,key,val)=>`<div class="fld"><span>${label}</span><input type="number" step="0.01" value="${val}" data-ld="${key}" data-i="${i}"></div>`;
  const caseSel=`<div class="fld"><span>Case</span><select data-ld="case" data-i="${i}">${Object.entries(CASE_LABELS).map(([k,v])=>`<option value="${k}"${ld.case===k?' selected':''}>${v}</option>`).join("")}</select></div>`;
  if(ld.type==='point') return `<div class="grid3">${f("Position, m","pos",ld.pos)}${f("P, kN (?)","P",ld.P)}${caseSel}</div>`;
  if(ld.type==='moment') return `<div class="grid3">${f("Position, m","pos",ld.pos)}${f("M, kN m (?)","M",ld.M)}${caseSel}</div>`;
  if(ld.type==='udl') return `<div class="grid2">${f("Start x1, m","x1",ld.x1)}${f("End x2, m","x2",ld.x2)}</div><div class="grid2" style="margin-top:6px">${f("w, kN/m (?)","w",ld.w)}${caseSel}</div>`;
  if(ld.type==='trap') return `<div class="grid2">${f("Start x1, m","x1",ld.x1)}${f("End x2, m","x2",ld.x2)}</div><div class="grid3" style="margin-top:6px">${f("w1, kN/m","w1",ld.w1)}${f("w2, kN/m","w2",ld.w2)}${caseSel}</div>`;
  return "";
}
/* EN 1993-1-5 clause 6 inputs (EC3 path): per point load and per support a
   stiff bearing length s_s and a "bearing stiffener provided" switch. */
function webBearingInputsOn(){ return S.code==='EC3'; }
function loadBearingFields(ld,i){
  if(!webBearingInputsOn() || ld.type!=='point' || ld.isSelfWeight) return '';
  const ssVal = (ld.ss!=null && ld.ss!=='' && isFinite(+ld.ss))? ld.ss : '';
  return `<div class="grid2" style="margin-top:6px"><div class="fld"><span>Stiff bearing s<sub>s</sub>, mm (blank = 0)</span><input type="number" step="1" min="0" placeholder="0" value="${ssVal}" data-ld="ss" data-i="${i}"></div>
    <label class="checkline" style="align-self:end"><input type="checkbox" data-ldc="stiff" data-i="${i}"${ld.stiff?' checked':''}> <span>bearing stiffener provided (EN 1993-1-5 9.4)</span></label></div>`;
}
function loadOffsetFields(ld,i){
  if(!S.eccOn || ld.type==='moment' || ld.isSelfWeight) return '';
  const eVal = ld.e??0;
  const zgFld = loadHeightPerLoadOn()
    ? `<div class="fld"><span>z<sub>g</sub>, mm (0 = shear centre, + above)</span><input type="number" step="1" value="${loadZgValue(ld)}" data-ld="zg" data-i="${i}"></div>`
    : `<div></div>`;
  return `<div class="grid2" style="margin-top:6px"><div class="fld"><span>e, mm (shear-centre offset; 0 = through shear centre)</span><input type="number" step="1" value="${eVal}" data-ld="e" data-i="${i}"></div>${zgFld}</div>`;
}
function renderLoadList(){
  const c=$("loadList"); c.innerHTML="";
  if(S.loads.length===0) c.innerHTML='<div style="font-size:11px;color:#6b7280;margin:2px 0 6px;">No loads yet &mdash; add one below.</div>';
  S.loads.forEach((ld,i)=>{
    const row=document.createElement("div"); row.className="row";
    const types={point:"Point load",udl:"UDL / partial UDL",trap:"Trapezoidal",moment:"Applied moment"};
    const tag = ld.isSelfWeight? ` <span style="font-size:10px;font-weight:700;color:#7a4;border:1px solid #bcd9a0;background:#f2f8ec;border-radius:4px;padding:1px 5px;">self-weight</span>` : '';
    row.innerHTML=`<div class="rowhead">
      <select data-lt="${i}">${Object.entries(types).map(([k,v])=>`<option value="${k}"${ld.type===k?' selected':''}>${v}</option>`).join("")}</select>${tag}
      <button class="del" data-li="${i}">remove</button></div>${loadFields(ld,i)}${loadOffsetFields(ld,i)}${loadBearingFields(ld,i)}`;
    c.appendChild(row);
  });
  c.querySelectorAll("[data-ld]").forEach(el=>el.addEventListener(el.tagName==='SELECT'?"change":"input",e=>{
    const i=+e.target.dataset.i,k=e.target.dataset.ld;
    // ss: blank = default (0 mm at a point load); a number is kept as entered
    S.loads[i][k]= k==='case'? e.target.value : k==='ss'? (e.target.value===''? null : parseFloat(e.target.value)) : parseFloat(e.target.value);
    recompute();
  }));
  c.querySelectorAll("[data-ldc]").forEach(el=>el.addEventListener("change",e=>{
    const i=+e.target.dataset.i,k=e.target.dataset.ldc;
    S.loads[i][k]=e.target.checked; recompute();
  }));
  c.querySelectorAll("[data-lt]").forEach(sel=>sel.addEventListener("change",e=>{
    const i=+e.target.dataset.lt, t=e.target.value, L=S.L, cs=S.loads[i].case||'Q';
    const old=S.loads[i];
    const base={point:{type:'point',pos:+(L/2).toFixed(3),P:10,case:cs},
                udl:{type:'udl',x1:0,x2:L,w:9,case:cs},
                trap:{type:'trap',x1:0,x2:L,w1:0,w2:12,case:cs},
                moment:{type:'moment',pos:+(L/2).toFixed(3),M:10,case:cs}}[t];
    if(t!=='moment'){ base.e=old.e??0; base.zg=old.zg??(+S.za||0); }
    S.loads[i]=base; renderLoadList(); recompute();
  }));
  c.querySelectorAll(".del").forEach(b=>b.addEventListener("click",e=>{
    S.loads.splice(+e.target.dataset.li,1); renderLoadList(); recompute(); }));
}
function comboLabelFromFactors(combo){
  const parts=['G','Q','W','E'].filter(k=>Math.abs(+combo.factors[k]||0)>1e-9).map(k=>(+combo.factors[k])+k);
  return (combo.sls?'SLS: ':'ULS: ')+(parts.length? parts.join(' + '):'no actions');
}
function renderComboList(){
  const c=$("comboList"); c.innerHTML="";
  S.combos.forEach((combo,i)=>{
    const row=document.createElement("div"); row.className="row";
    const cases=['G','Q','W','E'];
    const factorFlds=cases.map(cs=>`<div class="fld"><span>${cs}</span><input type="number" step="0.05" value="${combo.factors[cs]??0}" data-cf="${cs}" data-ci="${i}"></div>`).join("");
    row.innerHTML=`<div class="rowhead">
      <label style="display:flex;align-items:center;gap:6px;flex:1;font-size:12px;font-weight:700;margin:0">
        <input type="checkbox" style="width:auto" data-con="${i}" ${combo.on?'checked':''}>
        <input type="text" data-clabel="${i}" value="${combo.label}" style="border:none;background:transparent;font-weight:700;padding:2px 0;width:100%">
      </label>
      <span style="font-size:10px;font-weight:700;color:${combo.sls?'#166534':'#1e40af'};border:1px solid ${combo.sls?'#bcd9a0':'#b9c6e6'};background:${combo.sls?'#f2f8ec':'#eef2fb'};border-radius:4px;padding:1px 5px;white-space:nowrap">${combo.sls?'SLS':'ULS'}</span>
      <button class="del" data-cdel="${i}">remove</button></div>
      <div class="grid3" style="grid-template-columns:repeat(4,1fr)">${factorFlds}</div>`;
    c.appendChild(row);
  });
  c.querySelectorAll("[data-con]").forEach(el=>el.addEventListener("change",e=>{
    S.combos[+e.target.dataset.con].on=e.target.checked; recompute(); }));
  c.querySelectorAll("[data-clabel]").forEach(el=>el.addEventListener("input",e=>{
    S.combos[+e.target.dataset.clabel].label=e.target.value; recompute(); }));
  c.querySelectorAll("[data-cf]").forEach(el=>el.addEventListener("input",e=>{
    const i=+e.target.dataset.ci, cs=e.target.dataset.cf;
    S.combos[i].factors[cs]=parseFloat(e.target.value);
    // the combination name always reflects the live factors; editing a factor
    // regenerates it (a hand-typed name lasts until the next factor edit)
    S.combos[i].label=comboLabelFromFactors(S.combos[i]);
    const lab=c.querySelector('[data-clabel="'+i+'"]'); if(lab) lab.value=S.combos[i].label;
    recompute(); }));
  c.querySelectorAll("[data-cdel]").forEach(b=>b.addEventListener("click",e=>{
    S.combos.splice(+e.target.dataset.cdel,1); renderComboList(); recompute(); }));
}
function syncInputs(){
  const pfcSel=$("pfcSelect"); pfcSel.innerHTML="";
  PFC.forEach(s=>{ const o=document.createElement("option"); o.value=s.key;
    o.textContent=`${s.key.replace(/x/g,'   ')} PFC  (${s.mass} kg/m)`; pfcSel.appendChild(o); });
  pfcSel.value=S.sectionKey;

  const shsSel=$("shsSelect"); shsSel.innerHTML="";
  const shsArr = S.shsType==='CF'? SHS_CF : SHS_HF;
  shsArr.forEach(s=>{ const o=document.createElement("option"); o.value=s.key;
    o.textContent=`${s.key.replace(/x/g,'   ')} SHS  (${s.mass} kg/m)`; shsSel.appendChild(o); });
  if(!(S.shsKey in (S.shsType==='CF'? SHS_CFmap : SHS_HFmap))) S.shsKey = shsArr[0].key;
  shsSel.value=S.shsKey;

  const ubSel=$("ubSelect"); ubSel.innerHTML="";
  UB.forEach(s=>{ const o=document.createElement("option"); o.value=s.key;
    o.textContent=`${s.key} UB  (${s.mass} kg/m)`; ubSel.appendChild(o); });
  if(!(S.ubKey in UBmap)) S.ubKey = UB[0].key;
  ubSel.value=S.ubKey;

  const ucSel=$("ucSelect"); ucSel.innerHTML="";
  UC.forEach(s=>{ const o=document.createElement("option"); o.value=s.key;
    o.textContent=`${s.key} UC  (${s.mass} kg/m)`; ucSel.appendChild(o); });
  if(!(S.ucKey in UCmap)) S.ucKey = UC[0].key;
  ucSel.value=S.ucKey;

  const rhsSel=$("rhsSelect"); rhsSel.innerHTML="";
  RHS.forEach(s=>{ const o=document.createElement("option"); o.value=s.key;
    o.textContent=`${s.key} RHS  (${s.mass} kg/m)`; rhsSel.appendChild(o); });
  if(!(S.rhsKey in RHSmap)) S.rhsKey = RHS[0].key;
  rhsSel.value=S.rhsKey;

  $("code").value=S.code;
  $("family").value=S.family;
  $("shsType").value=S.shsType;
  $("pfcRow").style.display = S.family==='pfc'? '' : 'none';
  if($("pfcMirror")) $("pfcMirror").checked = !!S.pfcMirror;
  $("shsRow").style.display = S.family==='shs'? '' : 'none';
  $("shsTypeRow").style.display = S.family==='shs'? '' : 'none';
  $("ubRow").style.display = S.family==='ub'? '' : 'none';
  $("ucRow").style.display = S.family==='uc'? '' : 'none';
  $("rhsRow").style.display = S.family==='rhs'? '' : 'none';
  $("restraint").value = S.restraint||'full';
  $("eccOn").checked = !!S.eccOn;
  const sciMode = S.code==='EC3' && (S.restraint||'full')==='full';
  const sec=activeSection();
  $("restraintRow").style.display = S.code==='EC3'? '' : 'none';
  $("bsFactorsRow").style.display = S.code==='EC3'? 'none' : '';
  $("ec3FactorsRow").style.display = (S.code==='EC3' && !sciMode)? '' : 'none';
  $("leRow").style.display = sciMode? 'none' : '';
  $("za").value = S.za||0;
  $("rootWarp").value = S.rootWarp||'free';
  $("zaRow").style.display = (S.code==='EC3' && !sciMode)? '' : 'none';
  syncLoadHeightHint(sec, S.code==='EC3' && !sciMode);
  $("warpRow").style.display = (S.code==='EC3' && !sciMode)? '' : 'none';
  if($("mcrMethod")){
    $("mcrMethod").value = S.mcrMethod==='standard'? 'standard' : 'eigen';
    $("mcrMethodRow").style.display = (S.code==='EC3' && !sciMode)? '' : 'none';
  }
  $("destabRow").style.display = sciMode? 'none' : '';
  $("robRow").style.display = S.code==='EC3'? 'none' : '';

  $("grade").value=S.grade;
  $("py").value = S.py!=null? S.py : pyFromGrade(S.grade,sec.tf);
  $("anet").value = S.anet!=null? S.anet : "";
  $("length").value=S.L; $("axial").value=S.axial; if($("Mz")) $("Mz").value=S.Mz; $("leFactor").value=S.leFactor;
  $("destab").checked=S.destab; $("mLTo").value=S.mLTo??""; $("mxo").value=S.mxo??"";
  $("C1o").value=S.C1o??"";
  if($("LT")){ $("LT").value=S.LT??""; $("LTRow").style.display=(S.code==='EC3' && S.family==='pfc')? '' : 'none'; }
  $("divisor").value=S.divisor; $("E").value=S.E; $("Ke").value=S.Ke??"";
  if($("divisorCant")) $("divisorCant").value=S.divisorCant??180;
  if($("deflAbs")) $("deflAbs").value=S.deflAbs??"";
  if($("autoPattern")) $("autoPattern").checked = S.autoPattern==null? true : !!S.autoPattern;
  const autoRob=defaultRobertson(S.family,sec.boxType,sec.tf);
  $("robertsonX").value = S.robX!=null? S.robX : autoRob.x;
  $("robertsonY").value = S.robY!=null? S.robY : autoRob.y;
  renderSupportList(); renderHingeList(); renderLoadList(); renderComboList();
  updatePlateUI();
}
