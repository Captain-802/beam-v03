/* ===========================================================================
   3. STATE + INPUT UI
   =========================================================================== */
const CASE_LABELS={G:'Dead (G)',Q:'Imposed (Q)',W:'Wind (W)',E:'Other (E)'};
const DEFAULT_COMBOS=[
  {id:'c1', label:'ULS: 1.35G + 1.5Q (Eq 6.10)',          factors:{G:1.35,Q:1.5,W:0,E:0},   sls:false, on:true},
  {id:'s1', label:'SLS: Variable actions only (NA 2.23)',  factors:{G:0,  Q:1.0,W:0,E:0},    sls:true,  on:true},
];
/* ---------------------------------------------------------------------------
   Member ends (19 Sep 2026 scope change: the tool handles ONE span, x = 0 =
   End 1 to x = L = End 2). Each end carries six degrees of freedom plus
   warping, each RESTRAINED (true) or FREE (false):
     ux   axial translation                -> axial load path of N_Ed
     uy   lateral translation (minor axis) -> LTB eigen v = 0; minor-axis strut
     uz   vertical translation             -> in-plane solver (vertical support)
     rx   twist about the member axis      -> LTB eigen phi = 0; torsion FE phi = 0
     ry   rotation about the major axis    -> in-plane solver (rotational fixity)
     rz   rotation about the minor axis    -> LTB eigen v' = 0; minor-axis strut
     warp warping (phi' = 0)               -> LTB eigen phi' = 0; torsion FE phi' = 0
   plus, for an end that carries a vertical reaction (uz): holdDown (uplift
   resisted by a designed connection), ss (stiff bearing length, mm; blank =
   the lower bound 0) and stiff (bearing stiffener provided). Internal hinges
   (S.hinges) stay: an in-plane moment release at x, lateral / twist
   continuity kept. Intermediate supports, overhangs and multi-span logic are
   out of scope.
   In-plane mapping (endInPlaneType): uz + ry = 'fixed', uz only = 'pinned',
   ry only = 'guided' (sliding end: rotation held, vertical free), neither =
   'none' (free end, absent from the solver's support list).
   --------------------------------------------------------------------------- */
const END_DOFS=['ux','uy','uz','rx','ry','rz','warp'];
/* Long labels (title / tooltip) and the short labels of the End conditions panel. */
const END_DOF_LABELS={ux:'U<sub>x</sub> axial translation (axial load path of N<sub>Ed</sub>)',uy:'U<sub>y</sub> lateral translation (LTB v = 0; minor-axis strut)',uz:'U<sub>z</sub> vertical translation (vertical support)',rx:'R<sub>x</sub> twist about the member axis (LTB / torsion &phi; = 0)',ry:'R<sub>y</sub> rotation about the major axis (in-plane fixity)',rz:'R<sub>z</sub> rotation about the minor axis (LTB v&prime; = 0: laterally clamped; minor-axis strut)',warp:'warping &phi;&prime; = 0 (LTB eigen and torsion FE)'};
const END_DOF_SHORT={ux:'U<sub>x</sub> axial',uy:'U<sub>y</sub> lateral',uz:'U<sub>z</sub> vertical',rx:'R<sub>x</sub> twist',ry:'R<sub>y</sub> major rotation',rz:'R<sub>z</sub> minor rotation',warp:'Warping &phi;&prime;'};
/* Presets (pure): every preset restrains U_x at End 1 only, so the axial load
   path is statically determinate; tick U_x at End 2 for a fully built-in far
   end (printed as "axial statically indeterminate: N taken as applied").
   Warping is restrained only at a cantilever root (the seventh flag of the
   scope note); every other preset leaves warping free (fork ends).
   `label` is the End conditions drop-list text, `name` the short name printed
   on the End conditions line of the brief and the report. */
const END_PRESETS={
  'ss':           {label:'Simply supported', name:'simply supported', e1:{ux:1,uy:1,uz:1,rx:1}, e2:{uy:1,uz:1,rx:1}},
  'fixed-fixed':  {label:'Fixed-fixed', name:'fixed-fixed', e1:{ux:1,uy:1,uz:1,rx:1,ry:1,rz:1}, e2:{uy:1,uz:1,rx:1,ry:1,rz:1}},
  'fixed-pinned': {label:'Fixed-pinned (propped cantilever)', name:'fixed-pinned (propped cantilever)', e1:{ux:1,uy:1,uz:1,rx:1,ry:1,rz:1}, e2:{uy:1,uz:1,rx:1}},
  'cantilever':   {label:'Cantilever (End 1 fixed, End 2 free)', name:'cantilever', e1:{ux:1,uy:1,uz:1,rx:1,ry:1,rz:1,warp:1}, e2:{}},
  'guided-fixed': {label:'Guided-fixed (End 1 fixed, End 2 sliding: rotation held, vertical free)', name:'guided-fixed', e1:{ux:1,uy:1,uz:1,rx:1,ry:1,rz:1}, e2:{uy:1,rx:1,ry:1,rz:1}},
  'pinned-guided':{label:'Pinned-guided (End 1 pinned, End 2 sliding: rotation held, vertical free)', name:'pinned-guided', e1:{ux:1,uy:1,uz:1,rx:1}, e2:{uy:1,rx:1,ry:1,rz:1}}
};
END_PRESETS['fixed-guided']=END_PRESETS['guided-fixed'];   // alias: End 1 fixed, End 2 guided
/* Normalised flag set of one end (pure; tolerant of a partial object). */
function endFlags(o){
  const e={};
  END_DOFS.forEach(k=>{ e[k]=!!(o&&o[k]); });
  e.holdDown=!!(o&&o.holdDown);
  e.ss=(o&&o.ss!=null&&o.ss!==''&&Number.isFinite(+o.ss))? +o.ss : null;
  e.stiff=!!(o&&o.stiff);
  return e;
}
/* Ends object of a preset with optional per-end overrides {e1:{...}, e2:{...}} (pure). */
function endsPreset(name,overrides){
  const p=END_PRESETS[name];
  if(!p) throw new Error('Unknown end preset "'+name+'" (ss | fixed-fixed | fixed-pinned | cantilever | guided-fixed | pinned-guided)');
  const ov=overrides||{};
  return {e1:endFlags(Object.assign({},p.e1,ov.e1||{})), e2:endFlags(Object.assign({},p.e2,ov.e2||{}))};
}
/* Name of the preset the ends match on the seven DOF flags, else null (pure). */
function endsPresetName(ends){
  const cur=[ends&&ends.e1,ends&&ends.e2].map(endFlags);
  for(const k of Object.keys(END_PRESETS)){
    if(k==='fixed-guided') continue;
    const p=endsPreset(k);
    if([p.e1,p.e2].every((e,i)=>END_DOFS.every(d=>e[d]===cur[i][d]))) return k;
  }
  return null;
}
/* The two ends as a list [{key, n, x (m), ...flags}] (pure; reads S.L). */
function endsList(st){
  st=st||S;
  const E=st.ends||{};
  return [Object.assign({key:'e1',n:1,x:0},endFlags(E.e1)), Object.assign({key:'e2',n:2,x:+st.L},endFlags(E.e2))];
}
function endInPlaneType(e){ return e.uz&&e.ry? 'fixed' : e.uz? 'pinned' : e.ry? 'guided' : 'none'; }
/* In-plane support list the solver and the checks expect: [{end, pos (m),
   type 'pinned'|'fixed'|'guided', holdDown, ss, stiff}]; a free end is absent. */
function endsToSupports(st){
  return endsList(st).map(e=>{ const type=endInPlaneType(e); return type==='none'? null : {end:e.n,pos:e.x,type,holdDown:e.holdDown,ss:e.ss,stiff:e.stiff}; }).filter(Boolean);
}
/* Vertically held ends (a reaction is possible) with their solver-reaction index. */
function verticalEnds(st){ return endsToSupports(st).map((sp,i)=>Object.assign({i},sp)).filter(sp=>sp.type!=='guided'); }
/* In-plane cantilever: End 1 fixed (U_z + R_y), End 2 free of both. */
function isCantilever(st){ const [e1,e2]=endsList(st); return !!(e1.uz&&e1.ry&&!e2.uz&&!e2.ry); }
/* An end that is free vertically (cantilever tip, guided tip): the deflection
   limit is L/divisorCant instead of span/divisor. */
function hasFreeVerticalEnd(st){ const [e1,e2]=endsList(st); return !(e1.uz&&e2.uz); }
/* LTB boundary conditions of the two ends for the eigen model: v from U_y,
   v' from R_z, phi from R_x, phi' from warping; an end restraining none of
   them (free end) contributes nothing. Positions in mm. */
function ltbEndRestraints(st){
  return endsList(st).filter(e=>e.uy||e.rz||e.rx||e.warp).map(e=>({x:e.x*1000,v:e.uy?1:0,vp:e.rz?1:0,phi:e.rx?1:0,phip:e.warp?1:0,end:e.n}));
}
/* Twist-restrained ends for the torsion models: phi = 0 from R_x, phi' = 0
   from warping. Positions in mm. */
function twistEnds(st){ return endsList(st).filter(e=>e.rx).map(e=>({end:e.n,pos:e.x*1000,warpFix:!!e.warp})); }
/* LTB / BS 5950 effective-length factor: the entered L_E/L, else 1.0 (the
   closed forms take k = k_w = 1 fork ends over the member length). */
function ltbLeFactor(st){ st=st||S; return (st.leFactor!=null&&st.leFactor!==''&&Number.isFinite(+st.leFactor))? +st.leFactor : 1.0; }
/* Strut effective-length factor of one buckling plane from the end fixities
   (SCI P360 Table 6.2 / BS 5950-1 Table 22 style; pure). t1, r1 = translation
   / rotation held at End 1 in that plane, t2, r2 at End 2. */
function lcrAxisFactor(t1,r1,t2,r2){
  const held=(t1?1:0)+(t2?1:0);
  if(held===2){
    const nr=(r1?1:0)+(r2?1:0);
    if(nr===2) return {K:0.7, text:'held in position at both ends and in direction at both ends: 0.7 L'};
    if(nr===1) return {K:0.85, text:'held in position at both ends, in direction at one end: 0.85 L'};
    return {K:1.0, text:'held in position at both ends, in direction at neither: 1.0 L'};
  }
  if(held===1){
    const heldR= t1? r1 : r2, freeR= t1? r2 : r1;
    if(heldR&&!freeR) return {K:2.0, text:'held in position and direction at one end, the other end free: 2.0 L'};
    if(heldR&&freeR) return {K:1.2, text:'held in position and direction at one end, the other end held in direction but not in position (sway permitted, guided): 1.2 L'};
    if(!heldR&&freeR) return {K:2.0, text:'pinned at the held end, the other end guided (rotation held, sway permitted): 2.0 L (theoretical value; not a P360 Table 6.2 row)'};
    return {K:null, mechanism:true, text:'held in position at one end only and in direction at neither end: sway mechanism'};
  }
  return {K:null, mechanism:true, text:'held in position at neither end: mechanism'};
}
/* Strut effective lengths of both axes from the end fixities (pure): y-y
   (major-axis buckling, in-plane) from U_z / R_y, z-z (minor-axis buckling)
   from U_y / R_z. The entered L_E/L factor overrides both. Returns {Ky, Kz,
   basisY, basisZ, basis, mechanismY, mechanismZ, override, defaultKy,
   defaultKz}; the basis texts carry [verify]. */
function lcrDefaults(st){
  st=st||S;
  const [e1,e2]=endsList(st);
  const y=lcrAxisFactor(e1.uz,e1.ry,e2.uz,e2.ry), z=lcrAxisFactor(e1.uy,e1.rz,e2.uy,e2.rz);
  const override=(st.leFactor!=null&&st.leFactor!==''&&Number.isFinite(+st.leFactor));
  const out={defaultKy:y.K, defaultKz:z.K, mechanismY:!!y.mechanism, mechanismZ:!!z.mechanism, override,
    basisY:'y-y: '+y.text, basisZ:'z-z: '+z.text};
  if(override){
    out.Ky=+st.leFactor; out.Kz=+st.leFactor;
    out.basis='user L<sub>E</sub>/L factor '+(+st.leFactor).toFixed(2)+' on both axes (the end fixities would give '+(y.K!=null? 'y-y '+y.K.toFixed(2) : 'y-y mechanism')+', '+(z.K!=null? 'z-z '+z.K.toFixed(2) : 'z-z mechanism')+') [verify]';
  } else {
    out.Ky=y.K; out.Kz=z.K;
    out.basis='from the end fixities (P360 Table 6.2 / BS 5950 Table 22 style) &mdash; '+out.basisY+'; '+out.basisZ+' [verify]';
  }
  return out;
}
/* ---- End conditions panel state (UI half of the 19 Sep 2026 scope change) ----
   st.endPreset is the drop-list selection: a preset key or 'custom'. The DOF
   flags are the truth; the selection only names them. */
/* Apply a preset to the state: the seven flags of both ends from the preset,
   the seating / hold-down / stiffener entries kept, the hinges cleared (a
   preset can leave an existing hinge as a mechanism). Returns st. */
function applyEndPreset(st,name){
  st=st||S;
  if(name==='fixed-guided') name='guided-fixed';
  const keep=k=>{ const e=(st.ends&&st.ends[k])||{}; return {holdDown:e.holdDown, ss:e.ss, stiff:e.stiff}; };
  st.ends=endsPreset(name,{e1:keep('e1'),e2:keep('e2')});   // throws for an unknown name
  st.endPreset=name;
  st.hinges=[];
  return st;
}
/* Set one DOF flag of one end; the selection becomes 'custom'. Returns st. */
function setEndDof(st,key,dof,on){
  st=st||S;
  if(key!=='e1'&&key!=='e2') throw new Error('setEndDof: end must be e1 or e2, got "'+key+'"');
  if(END_DOFS.indexOf(dof)<0) throw new Error('setEndDof: unknown degree of freedom "'+dof+'" (ux uy uz rx ry rz warp)');
  if(!st.ends) st.ends=endsPreset('ss');
  st.ends[key][dof]=!!on;
  st.endPreset='custom';
  return st;
}
/* Drop-list value for the state (pure): 'custom' when the flags were edited by
   hand, else the preset the flags match, else 'custom'. A stored preset whose
   flags no longer match (a fixture built from endsPreset() alone) is never
   shown: the flags are the truth. */
function endPresetSelection(st){
  st=st||S;
  if(st.endPreset==='custom') return 'custom';
  return endsPresetName(st.ends)||'custom';
}
/* Derived end types (pure): in plane from U_z / R_y, LTB from U_y / R_z / R_x / warping. */
function endInPlaneLabel(t){ return t==='fixed'? 'fixed' : t==='pinned'? 'pinned' : t==='guided'? 'guided (R<sub>y</sub> held, U<sub>z</sub> free)' : 'free'; }
function endLtbType(e){
  if(!(e.uy||e.rx||e.rz||e.warp)) return 'free';
  if(e.uy&&e.rx) return (e.rz? 'laterally clamped' : 'fork')+(e.warp? ', warping fixed' : '');
  const held=[]; if(e.uy) held.push('v'); if(e.rz) held.push('v&prime;'); if(e.rx) held.push('&phi;'); if(e.warp) held.push('&phi;&prime;');
  return 'partial ('+held.join(', ')+' = 0)';
}
/* "End conditions" line of the brief title and the report (pure): the seven
   flags of each end as symbols (W = warping), the derived in-plane and LTB end
   types, the preset name when the flags match one, and the internal hinges. */
function endsConditionsLine(st){
  st=st||S;
  const sym={ux:'U<sub>x</sub>',uy:'U<sub>y</sub>',uz:'U<sub>z</sub>',rx:'R<sub>x</sub>',ry:'R<sub>y</sub>',rz:'R<sub>z</sub>',warp:'W'};
  const parts=endsList(st).map(e=>{
    const held=END_DOFS.filter(k=>e[k]).map(k=>sym[k]);
    return 'End '+e.n+': '+(held.length? held.join(' ')+' restrained' : 'free')+' ('+endInPlaneLabel(endInPlaneType(e))+' in plane; LTB '+endLtbType(e)+')';
  });
  const name=endsPresetName(st.ends);
  const hinges=(st.hinges||[]).length? '; internal hinge'+(st.hinges.length>1? 's' : '')+' at '+st.hinges.map(h=>g(+h.pos,2)+' m').join(', ')+' (in-plane moment release, lateral / twist continuity kept)' : '';
  return parts.join('; ')+' &mdash; '+(name? END_PRESETS[name].name : 'custom end conditions')+hinges;
}
/* Glyph of one end condition for the End conditions panel (pure string
   builder, no DOM): the in-plane symbol (fixed wall, pin or roller, guided
   slider, free end) on a beam stub, the in-plane type above it and the LTB end
   type under it. e = one entry of endsList(); the support sits on the left for
   End 1 and on the right for End 2. */
function endGlyphSvg(e){
  const W=120,H=64, yB=30, sgn=e.n===2? 1 : -1, x0=e.n===2? 88 : 32, xFar=e.n===2? 12 : 108;
  const t=endInPlaneType(e);
  let s='<line x1="'+x0+'" y1="'+yB+'" x2="'+xFar+'" y2="'+yB+'" stroke="#111" stroke-width="3"/>';
  const hatch=(x,y1,y2)=>{ let h=''; for(let y=y1;y<y2;y+=6) h+='<line x1="'+x+'" y1="'+y+'" x2="'+(x+sgn*6)+'" y2="'+(y+6)+'" stroke="#111" stroke-width="1"/>'; return h; };
  if(t==='fixed'){
    s+='<line x1="'+x0+'" y1="'+(yB-16)+'" x2="'+x0+'" y2="'+(yB+16)+'" stroke="#111" stroke-width="2.4"/>'+hatch(x0,yB-16,yB+16);
  } else if(t==='pinned'){
    s+='<polygon points="'+x0+','+yB+' '+(x0-7)+','+(yB+13)+' '+(x0+7)+','+(yB+13)+'" fill="none" stroke="#111" stroke-width="1.6"/>';
    if(e.ux){
      s+='<line x1="'+(x0-11)+'" y1="'+(yB+14)+'" x2="'+(x0+11)+'" y2="'+(yB+14)+'" stroke="#111" stroke-width="1.4"/>';
      for(let x=x0-9;x<=x0+9;x+=6) s+='<line x1="'+x+'" y1="'+(yB+14)+'" x2="'+(x-4)+'" y2="'+(yB+19)+'" stroke="#111" stroke-width="1"/>';
    } else s+='<circle cx="'+(x0-4)+'" cy="'+(yB+16)+'" r="2.2" fill="none" stroke="#111" stroke-width="1.2"/><circle cx="'+(x0+4)+'" cy="'+(yB+16)+'" r="2.2" fill="none" stroke="#111" stroke-width="1.2"/><line x1="'+(x0-11)+'" y1="'+(yB+19)+'" x2="'+(x0+11)+'" y2="'+(yB+19)+'" stroke="#111" stroke-width="1.4"/>';
  } else if(t==='guided'){
    s+='<rect x="'+(x0-3)+'" y="'+(yB-12)+'" width="6" height="24" fill="none" stroke="#111" stroke-width="1.6"/>'+
       '<line x1="'+(x0+sgn*8)+'" y1="'+(yB-16)+'" x2="'+(x0+sgn*8)+'" y2="'+(yB+16)+'" stroke="#111" stroke-width="2.4"/>'+hatch(x0+sgn*8,yB-16,yB+16);
  } else {
    s+='<circle cx="'+x0+'" cy="'+yB+'" r="2.5" fill="#fff" stroke="#111" stroke-width="1.2"/>';
  }
  const top= t==='pinned'? (e.ux? 'pin' : 'roller') : t==='none'? 'free' : t;
  s+='<text x="'+(W/2)+'" y="10" font-family="Arial" font-size="9" fill="#374151" text-anchor="middle">'+top+' in plane</text>';
  const ltb= !(e.uy||e.rx||e.rz||e.warp)? 'free' : (e.uy&&e.rx)? (e.rz? 'clamped' : 'fork')+(e.warp? ' + warping' : '') : 'partial';   // short form of endLtbType() for the glyph width
  s+='<text x="'+(W/2)+'" y="'+(H-4)+'" font-family="Arial" font-size="8.5" fill="#6b7280" text-anchor="middle">LTB: '+ltb+'</text>';
  return '<svg class="end-glyph" viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="End '+e.n+' condition">'+s+'</svg>';
}



const DEMO={
  code:"EC3",
  family:"ub", sectionKey:"180x75x20", shsType:"HF", shsKey:"150x150x6.3", ubKey:"457 x 191 x 82", ucKey:"203 x 203 x 60", rhsKey:"200 x 100 x 8.0",
  grade:"S275", py:null, anet:null,
  L:8.0,
  ends:endsPreset('ss',{e1:{ss:100},e2:{ss:100}}),   // End 1 (x = 0) / End 2 (x = L) degree-of-freedom flags; ss: stiff bearing length of the seating (mm along the member); blank = lower bound 0
  endPreset:'ss',      // End conditions drop-list: a preset key or 'custom' (the flags above are the truth; endPresetSelection())
  hinges:[],
  loads:[{type:'udl',x1:0,x2:8.0,w:19.7,case:'G'},{type:'udl',x1:0,x2:8.0,w:19.8,case:'Q'}],
  combos:JSON.parse(JSON.stringify(DEFAULT_COMBOS)),
  axial:0, Mz:0, leFactor:null, destab:false, mLTo:null, mxo:null, C1o:null,   // leFactor: blank = strut lengths from the end fixities (lcrDefaults), LTB L_E = L; a number overrides both axes
  LT:null,             // torsional buckling length L_T (m) for a channel under N (cl 6.3.1.4); blank = spacing of the twist restraints (ends with R_x held + restraints with phi held), capped at L_cr,y
  divisor:360, divisorCant:180, deflAbs:null,   // span/360 between two vertically held ends; L/180 when an end is vertically free (cantilever / guided tip, UK NA Table NA.2 [verify]); absolute mm cap (null = none)
  E:210000, Ke:null, robX:null, robY:null,
  restraint:'full',
  mcrMethod:'eigen',   // EC3 unrestrained Mcr: 'eigen' (FE eigensolver, default) | 'standard' (closed form, SN003a/SN006a)
  eccOn:false, za:0,
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

/* HTML of the End conditions panel (pure string builder): two columns, End 1
   (x = 0) and End 2 (x = L), each with its glyph, the seven DOF boxes (checked
   = restrained) and, for an end that holds U_z, the hold-down box and (EC3)
   the stiff bearing length s_s and the bearing-stiffener box. */
function endsPanelHtml(st){
  st=st||S;
  const webBearingOn = st.code==='EC3';
  return endsList(st).map(e=>{
    const dof=k=>`<label class="checkline" title="${END_DOF_LABELS[k].replace(/<[^>]+>/g,'').replace(/"/g,'&quot;')}"><input type="checkbox" data-end="${e.key}" data-dof="${k}"${e[k]?' checked':''}> <span>${END_DOF_SHORT[k]}</span></label>`;
    const extra= e.uz
      ? `<div class="end-extra"><label class="checkline"><input type="checkbox" data-end="${e.key}" data-opt="holdDown"${e.holdDown?' checked':''}> <span>hold-down provided</span></label>${webBearingOn? `
        <div class="fld"><span>Stiff bearing s<sub>s</sub>, mm</span><input type="number" step="1" min="0" placeholder="blank = lower bound 0" value="${e.ss!=null? e.ss : ''}" data-end="${e.key}" data-ss="1" title="Stiff bearing length of the seating along the member (blank = lower bound 0: a station failing at 0 is NOT VERIFIED until the seating length is entered)"></div>
        <label class="checkline"><input type="checkbox" data-end="${e.key}" data-opt="stiff"${e.stiff?' checked':''}> <span>bearing stiffener provided</span></label>` : ''}</div>`
      : `<div class="end-extra end-none">no vertical reaction (U<sub>z</sub> free)</div>`;
    return `<div class="end-col" data-endcol="${e.key}"><div class="end-head">End ${e.n} (x = ${e.n===1? '0' : 'L = '+e.x} m)</div>${endGlyphSvg(e)}
      <div class="end-dofs">${END_DOFS.map(dof).join('')}</div>${extra}</div>`;
  }).join('');
}
function renderEndsPanel(){
  const c=$("endsPanel"); if(!c) return;
  c.innerHTML=endsPanelHtml(S);
  const sel=$("endPreset"); if(sel) sel.value=endPresetSelection(S);
  c.querySelectorAll("[data-dof]").forEach(el=>el.addEventListener("change",e=>{
    setEndDof(S,e.target.dataset.end,e.target.dataset.dof,e.target.checked); renderEndsPanel(); recompute();
  }));
  c.querySelectorAll("[data-opt]").forEach(el=>el.addEventListener("change",e=>{
    S.ends[e.target.dataset.end][e.target.dataset.opt]=e.target.checked; recompute();
  }));
  c.querySelectorAll("[data-ss]").forEach(el=>el.addEventListener("input",e=>{
    // ss: blank = lower bound 0 (NOT VERIFIED if the station fails); a number is kept as entered
    S.ends[e.target.dataset.end].ss = e.target.value===''? null : parseFloat(e.target.value); recompute();
  }));
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
/* EN 1993-1-5 clause 6 inputs (EC3 path): per point load and per end a
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
  $("zaRow").style.display = (S.code==='EC3' && !sciMode)? '' : 'none';
  syncLoadHeightHint(sec, S.code==='EC3' && !sciMode);
  if($("mcrMethod")){
    $("mcrMethod").value = S.mcrMethod==='standard'? 'standard' : 'eigen';
    $("mcrMethodRow").style.display = (S.code==='EC3' && !sciMode)? '' : 'none';
  }
  $("destabRow").style.display = sciMode? 'none' : '';
  $("robRow").style.display = S.code==='EC3'? 'none' : '';

  $("grade").value=S.grade;
  $("py").value = S.py!=null? S.py : pyFromGrade(S.grade,sec.tf);
  $("anet").value = S.anet!=null? S.anet : "";
  $("length").value=S.L; $("axial").value=S.axial; if($("Mz")) $("Mz").value=S.Mz;
  $("leFactor").value=S.leFactor??"";
  $("destab").checked=S.destab; $("mLTo").value=S.mLTo??""; $("mxo").value=S.mxo??"";
  $("C1o").value=S.C1o??"";
  if($("LT")){ $("LT").value=S.LT??""; $("LTRow").style.display=(S.code==='EC3' && S.family==='pfc')? '' : 'none'; }
  $("divisor").value=S.divisor; $("E").value=S.E; $("Ke").value=S.Ke??"";
  if($("divisorCant")) $("divisorCant").value=S.divisorCant??180;
  if($("deflAbs")) $("deflAbs").value=S.deflAbs??"";
  const autoRob=defaultRobertson(S.family,sec.boxType,sec.tf);
  $("robertsonX").value = S.robX!=null? S.robX : autoRob.x;
  $("robertsonY").value = S.robY!=null? S.robY : autoRob.y;
  renderEndsPanel(); renderHingeList(); renderLoadList(); renderComboList();
  updatePlateUI();
}
