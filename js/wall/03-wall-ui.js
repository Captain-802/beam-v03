/* ===========================================================================
   W3. BEAM IN WALL - PANELS, LEDGERS, LIVE SKETCH AND THE SYNC INTO beam-v03
   (js/wall/03-wall-ui.js, 20 Sep 2026; review fixes 21 Sep 2026)
   The only wall module that touches the DOM. Nothing runs at load time (the
   test harness loads it beside the pure modules); wall.html's startup
   (js/wall/09-wall-startup.js) calls wireWall(), fillWallPanels() and
   syncWall() after beam-v03's own syncInputs() / wire().
   Data flow (one direction, owner rule "the engine stays beam-v03's"):
     panels + ledgers -> WALL (js/wall/01-wall-state.js)
     syncWall(): wallToLoads(WALL, activeSection(), S) (js/wall/02-wall-geometry.js)
                 -> S.loads (labelled "Outer leaf: ..."), S.eccOn, S.pfcMirror
                 -> the #eccOn / #pfcMirror boxes of the hidden beam-v03 panels
                    (readScalarInputs() reads them back on every scalar edit)
                 -> the derived box + live sketch -> recompute() (beam-v03)
   beam-v03's generic load editor is hidden on wall.html but kept in the
   DOM so js/07-wiring.js binds unchanged; it never writes S.loads on this
   page (its buttons are unreachable). The beam-v03 events that can change
   the loads or the placement (span, section, plate, reset) are followed by
   listeners registered AFTER wire(), so the ledgers always have the last
   word: a span change re-syncs the ledgers (clamped like beam-v03's own
   clampLoadsToSpan), never the other way round.
   Hard placement errors (recess < 10 mm, beam outside [r, W - r], ...) and
   ledger row errors (a partial UDL beyond the span, x1 >= x2, a blank
   magnitude) are shown in red in the derived box, the offending inputs get
   the class wall-bad, AND they block the report through the same
   validateInputs() wrapper pattern js/08-mcr-eigen-patch.js uses (render()
   prints "Could not analyse: Beam in wall: ..."); the wall check runs before
   beam-v03's own so the message names the ledger row (I3), not "Load 4".
   On this page every load height comes from its ledger row, so beam-v03's
   "Default z_g" (S.za, applied to every load when S.eccOn is false) is held
   at 0 and its input hidden (21 Sep 2026 review).
   =========================================================================== */

/* ---- pure helpers (no DOM) ---- */
/* The ledger rows follow a span change from Lold to Lnew exactly as beam-v03's
   loads do (clampLoadsToSpan, js/03-state-ui.js, applied to a proxy load per
   row): a full-span UDL row always spans 0-L; a partial UDL / trapezoidal
   row whose end sat at Lold follows, one beyond Lnew is clamped or slid
   inwards keeping its length; a point / moment position beyond Lnew is
   clamped. Mutates w and returns it; an invalid Lnew leaves the rows alone. */
function wallClampRowsToSpan(w, Lold, Lnew){
  Lnew=+Lnew; if(!(Number.isFinite(Lnew)&&Lnew>0)) return w;
  WALL_LEDGERS.forEach(lg=>{
    ((w.ledgers&&w.ledgers[lg.key])||[]).forEach(row=>{
      const t=row.type||'udl';
      if(t==='udl'){ row.x1=0; row.x2=Lnew; return; }
      const proxy=(t==='point'||t==='moment')? {type:t, pos:+row.pos} : {type:(t==='pudl'? 'udl' : 'trap'), x1:+row.x1, x2:+row.x2};
      clampLoadsToSpan({loads:[proxy]}, Lold, Lnew);
      if(proxy.pos!=null) row.pos=proxy.pos; else { row.x1=proxy.x1; row.x2=proxy.x2; }
    });
  });
  return w;
}
/* The generated loads get their origin as the label the brief prints after
   its own magnitude / e / z_g: "Outer leaf: outer leaf masonry, x_w = 51.25 mm"
   (the x_w the e was derived from; a moment has no load line). Pure. */
function wallDecorateLoads(loads){
  loads.forEach(ld=>{ if(ld.wall) ld.label=ld.wall.ledgerLabel+(ld.label? ': '+ld.label : '')+(ld.type==='moment'? '' : ', x_w = '+wallNum(ld.wall.xwLoad)+' mm'); });
  return loads;
}
/* The demo span (WALL_DEMO_SPAN, js/wall/01-wall-state.js) and the demo plate
   (WALL_DEMO_PLATE) written into beam-v03's S and its inputs at startup and
   on Reset: beam-v03's own DEMO (L = 8 m, no plate) belongs to index.html. */
function wallApplyDemoBeam(){
  const L=(typeof WALL_DEMO_SPAN!=='undefined')? +WALL_DEMO_SPAN : NaN;
  if(Number.isFinite(L) && L>0){ S.L=L; const el=wallEl('length'); if(el) el.value=L; wallLastL=L; }
  if(typeof WALL_DEMO_PLATE!=='undefined' && WALL_DEMO_PLATE){ S.plate=JSON.parse(JSON.stringify(WALL_DEMO_PLATE)); if(typeof updatePlateUI==='function' && wallEl('platePanel')) updatePlateUI(); }
}
function wallEl(id){ return (typeof document!=='undefined' && document && document.getElementById)? document.getElementById(id) : null; }
const WALL_LEDGER_IDS={outer:'wallLedgerOuter', inner:'wallLedgerInner', beam:'wallLedgerBeam', other:'wallLedgerOther'};
let wallLastL=null;          // span the ledgers were last generated for (the Lold of a span edit without a focus event)
let wallSpanEdit=null;       // snapshot of the ledgers taken when the span field is entered (as beam-v03's spanEdited)
let wallSolidMemo=null;      // {c, t2} remembered when the solid-wall box is ticked, restored when unticked

/* ---- panels: WALL -> DOM ---- */
function wallFillMaterialSelects(){
  ['wallMat1','wallMat2'].forEach(id=>{
    const sel=wallEl(id); if(!sel || sel.options.length) return;
    WALL_MATERIALS.forEach(m=>{ const o=document.createElement('option'); o.value=m.key; o.textContent=m.label; sel.appendChild(o); });
  });
}
function fillWallPanels(){
  wallFillMaterialSelects();
  const setV=(id,v)=>{ const el=wallEl(id); if(el && document.activeElement!==el) el.value=(v==null? '' : v); };
  const setC=(id,v)=>{ const el=wallEl(id); if(el) el.checked=!!v; };
  const solid=wallIsSolid(WALL);
  setV('wallMat1',WALL.mat1||'custom'); setV('wallT1',WALL.t1); setC('wallChased1',WALL.chased1!==false);
  setV('wallC',WALL.c); setV('wallIns',WALL.insulation||'');
  setV('wallMat2',WALL.mat2||'custom'); setV('wallT2',WALL.t2); setC('wallChased2',WALL.chased2!==false);
  setC('wallSolid',solid);
  ['wallCavityRow','wallInnerRow'].forEach(id=>{ const el=wallEl(id); if(el) el.classList.toggle('wall-dim',solid); });
  setV('wallRecess',WALL.recess); setV('wallXc',WALL.xcCustom);
  const xcRow=wallEl('wallXcRow'); if(xcRow) xcRow.style.display=(WALL.placement==='custom')? '' : 'none';
  document.querySelectorAll('[data-wmode]').forEach(b=>b.classList.toggle('on',b.dataset.wmode===(WALL.placement||'flush-inside')));
  setV('wallPfcWeb',WALL.pfcWebFaces||'outside');
  const pfcRow=wallEl('wallPfcRow'); if(pfcRow) pfcRow.style.display=(S.family==='pfc')? '' : 'none';
  const innerNote=wallEl('wallInnerLedgerNote'); if(innerNote) innerNote.style.display=solid? '' : 'none';
  renderWallLedgers();
}
/* ---- panels: DOM -> WALL (scalars; the ledgers write through their own listeners) ---- */
function readWallScalars(){
  const num=(id)=>{ const el=wallEl(id); if(!el) return null; const v=parseFloat(el.value); return Number.isFinite(v)? v : null; };
  const str=(id)=>{ const el=wallEl(id); return el? el.value : ''; };
  const chk=(id)=>{ const el=wallEl(id); return el? el.checked : true; };
  WALL.mat1=str('wallMat1')||'custom'; WALL.t1=num('wallT1')??0; WALL.chased1=chk('wallChased1');
  WALL.mat2=str('wallMat2')||'custom'; WALL.chased2=chk('wallChased2');
  WALL.insulation=str('wallIns');
  if(chk('wallSolid')){ WALL.c=0; WALL.t2=0; }
  else { WALL.c=num('wallC')??0; WALL.t2=num('wallT2')??0; }
  const r=wallEl('wallRecess'); WALL.recess= r&&r.value!==''? parseFloat(r.value) : NaN;   // blank = invalid (placeBeam reports it)
  const xc=wallEl('wallXc'); WALL.xcCustom= xc&&xc.value!==''? parseFloat(xc.value) : null;
  WALL.pfcWebFaces=str('wallPfcWeb')==='inside'? 'inside' : 'outside';
}

/* ---- ledgers ---- */
function wallRowHtml(row, ledger, i){
  const L=Number.isFinite(+S.L)? +S.L : 0, t=row.type||'udl', isMoment=t==='moment';
  const A=(k)=>' data-wl="'+ledger+'" data-wi="'+i+'" data-wk="'+k+'"';
  const num=(label,k,val,step,ph)=>'<div class="fld"><span>'+label+'</span><input type="number" step="'+(step||0.01)+'" value="'+(val==null? '' : val)+'"'+(ph? ' placeholder="'+ph+'"' : '')+A(k)+'></div>';
  const sel=(label,k,val,opts)=>'<div class="fld"><span>'+label+'</span><select'+A(k)+'>'+opts.map(o=>'<option value="'+o.key+'"'+(o.key===val? ' selected' : '')+'>'+o.label+'</option>').join('')+'</select></div>';
  const head='<div class="rowhead"><select data-wlt="'+ledger+'" data-wi="'+i+'">'+WALL_ROW_TYPES.map(o=>'<option value="'+o.key+'"'+(o.key===t? ' selected' : '')+'>'+o.label+'</option>').join('')+'</select>'
    +'<span class="wall-tag">'+({outer:'O',inner:'I',beam:'B',other:'X'}[ledger]||'L')+(i+1)+'</span><button type="button" class="del" data-wdel="'+ledger+'" data-wi="'+i+'">remove</button></div>';
  const caseSel=sel('Case','case',row.case||'G',Object.entries(CASE_LABELS).map(([k,v])=>({key:k,label:v})));
  let mags='';
  if(t==='udl') mags='<div class="grid2">'+num('w, kN/m (full span 0&ndash;'+L+' m)','w',row.w)+caseSel+'</div>';
  else if(t==='pudl') mags='<div class="grid3">'+num('Start x1, m','x1',row.x1)+num('End x2, m','x2',row.x2)+num('w, kN/m','w',row.w)+'</div><div class="grid2">'+caseSel+'<div></div></div>';
  else if(t==='trap') mags='<div class="grid2">'+num('Start x1, m','x1',row.x1)+num('End x2, m','x2',row.x2)+'</div><div class="grid3">'+num('w1, kN/m','w1',row.w1)+num('w2, kN/m','w2',row.w2)+caseSel+'</div>';
  else if(t==='point') mags='<div class="grid3">'+num('Position, m','pos',row.pos)+num('P, kN','P',row.P)+caseSel+'</div>';
  else mags='<div class="grid3">'+num('Position, m','pos',row.pos)+num('M, kN&middot;m','M',row.M)+caseSel+'</div>';
  const heightOpts=wallHeightOptions(activeSection());   // 'plate' offered only while the plate is on, labelled by its side
  const height=isMoment? '' : '<div class="grid2">'+sel('Load height (z<sub>g</sub>)','height',row.height||'top',heightOpts)
    +((row.height||'top')==='custom'? num('z<sub>g</sub> custom, mm (+ above SC)','zgCustom',row.zgCustom,1) : '<div></div>')+'</div>';
  const extra= isMoment? '' : ledger==='beam'? '<div class="grid2">'+num('x<sub>w</sub> of the load line, mm','xw',row.xw,0.5,'blank = shear centre')+'<div></div></div>'
    : ledger==='other'? '<div class="grid2">'+num('e, mm from the shear centre (+ inward)','e',row.e,1)+'<div></div></div>' : '';
  const bearing=(t==='point' && S.code==='EC3')? '<div class="grid2">'+num('Stiff bearing s<sub>s</sub>, mm','ss',row.ss,1,'blank = 0')
    +'<label class="checkline" style="align-self:end"><input type="checkbox" data-wlc="stiff" data-wl="'+ledger+'" data-wi="'+i+'"'+(row.stiff? ' checked' : '')+'> <span>bearing stiffener provided</span></label></div>' : '';
  const label='<div class="fld wall-label"><span>Label (printed in the brief and the derivation table)</span><input type="text" value="'+wallEsc(row.label||'')+'" placeholder="e.g. floor joists, roof, beam B2"'+A('label')+'></div>';
  return head+mags+height+extra+bearing+label;
}
function renderWallLedger(ledger){
  const c=wallEl(WALL_LEDGER_IDS[ledger]); if(!c) return;
  const rows=(WALL.ledgers&&WALL.ledgers[ledger])||[];
  c.innerHTML='';
  if(!rows.length){ c.innerHTML='<div class="wall-empty">No loads in this ledger &mdash; add one below.</div>'; return; }
  rows.forEach((row,i)=>{ const div=document.createElement('div'); div.className='row wall-row'; div.innerHTML=wallRowHtml(row,ledger,i); c.appendChild(div); });
}
function renderWallLedgers(){ WALL_LEDGERS.forEach(lg=>renderWallLedger(lg.key)); }
/* One ledger row edit from its input element (data-wl / data-wi / data-wk). */
function wallRowEdit(el){
  const ledger=el.dataset.wl, i=+el.dataset.wi, k=el.dataset.wk;
  const row=WALL.ledgers[ledger]&&WALL.ledgers[ledger][i]; if(!row) return false;
  if(k==='label'||k==='case'||k==='height') row[k]=el.value;
  else if(k==='xw'||k==='ss') row[k]= el.value===''? null : parseFloat(el.value);
  else row[k]=parseFloat(el.value);
  return k==='height';   // the custom z_g field appears / disappears
}

/* ---- the derived box and the live sketch ---- */
function updateWallDerived(res, sec){
  const P=res.placement, box=wallEl('wallDerived'), sk=wallEl('wallSketch');
  const n=(v,d)=>wallNum(v,d==null? 2 : d);
  if(box){
    const kv=(k,v)=>'<div class="wall-kv"><span>'+k+'</span><b>'+v+'</b></div>';
    const lay=P.layout;
    let h='';
    h+=kv('Wall W','<span>'+n(lay.W,1)+' mm'+(lay.solid? ' (solid)' : ' = '+n(lay.t1,1)+' + '+n(lay.c,1)+' + '+n(lay.t2,1))+'</span>');
    h+=kv('Centroid x<sub>w,c</sub>',n(P.xc)+' mm');
    h+=kv('Shear centre x<sub>w,sc</sub>',n(P.xsc)+' mm'+(Math.abs(P.ext.scX)>1e-6? ' (centroid '+wallSigned(P.ext.scX,1)+')' : ' (= centroid)'));
    h+=kv('Extreme fibres x<sub>w</sub>',n(P.xmin)+' / '+n(P.xmax)+' mm'+(P.ext.plate? ' (plate incl.)' : ''));
    h+=kv('Clearance to faces',n(P.clearances.outer,1)+' / '+n(P.clearances.inner,1)+' mm (r = '+n(P.r,1)+')');
    h+=kv('Width vs W &minus; 2r',n(P.width,1)+' vs '+n(P.available,1)+' mm');
    const bearing=u=>u.on? 'yes: '+wallEsc(u.text) : '<span class="wall-no">no</span>';   // top flange and / or bottom-plate outstand (plate not designed here)
    h+=kv('Bearing under outer leaf',bearing(P.under.outer));
    if(lay.inner) h+=kv('Bearing under inner leaf',bearing(P.under.inner));
    if(P.cavity&&P.cavity.whole) h+=kv('In the cavity',n(P.cavity.clearance,1)+' mm to the nearer leaf');
    const list=(arr,cls)=>arr.length? '<div class="'+cls+'">'+arr.map(t=>'<div>'+wallEsc(t)+'</div>').join('')+'</div>' : '';
    h+=list(res.errors,'wall-errs')+list(res.warnings,'wall-warns')+list(res.notes,'wall-notes');   // placement + row errors, placement + load-line warnings
    h+='<div class="wall-sub">'+res.loads.length+' load'+(res.loads.length===1? '' : 's')+' generated; S.eccOn = '+res.eccOn+(sec&&sec.kind==='channel'? '; S.pfcMirror = '+res.pfcMirror : '')+'</div>';
    box.innerHTML=h;
  }
  if(sk){ try{ sk.innerHTML=wallSectionSvg(P, res, {compact:true, idPrefix:'wsk'}); } catch(err){ sk.innerHTML='<div class="wall-errs">Sketch: '+wallEsc(err&&err.message||err)+'</div>'; } }
  // the inputs of a refused row are marked (class wall-bad; css/beam-in-wall.css)
  if(typeof document!=='undefined' && document.querySelectorAll){
    document.querySelectorAll('.wall-ledger .wall-bad').forEach(el=>el.classList.remove('wall-bad'));
    (res.rowErrors||[]).forEach(e=>e.keys.forEach(k=>{
      const el=document.querySelector('.wall-ledger [data-wl="'+e.ledger+'"][data-wi="'+e.i+'"][data-wk="'+k+'"]'); if(el) el.classList.add('wall-bad');
    }));
  }
  const hint=wallEl('wallLayoutHint');
  if(hint){ const lay=P.layout; hint.innerHTML='x<sub>w</sub> from the external face: outer leaf 0&ndash;'+n(lay.t1,1)+(lay.cavity? ' | cavity '+n(lay.cavity.x1,1)+'&ndash;'+n(lay.cavity.x2,1)+' | inner leaf '+n(lay.inner.x1,1)+'&ndash;'+n(lay.W,1) : ' (solid wall)')+' mm; W = '+n(lay.W,1)+' mm.'; }
}

/* ---- the sync: WALL -> S ---- */
function syncWall(opts){
  opts=opts||{};
  const sec=activeSection();
  if(wallNormaliseHeights(WALL, sec, S)>0) renderWallLedgers();   // rows left at 'plate' after the plate went off (safety net; the plate handler normalises first)
  const res=wallToLoads(WALL, sec, S);
  S.loads=wallDecorateLoads(res.loads);
  S.eccOn=res.eccOn;
  S.pfcMirror=res.pfcMirror;
  S.za=0;                                                          // every z_g is per load here; beam-v03's default z_g must not apply when S.eccOn is false
  const ecc=wallEl('eccOn'); if(ecc) ecc.checked=res.eccOn;        // readScalarInputs() reads these back
  const mir=wallEl('pfcMirror'); if(mir) mir.checked=res.pfcMirror;
  const za=wallEl('za'); if(za) za.value=0;
  if(typeof updatePlateUI==='function' && wallEl('platePanel')) updatePlateUI();   // the plate hint follows S.pfcMirror
  wallLastL=Number.isFinite(+S.L)? +S.L : wallLastL;
  updateWallDerived(res, sec);
  if(opts.immediate){ if(typeof render==='function') render(); }
  else if(typeof recompute==='function') recompute();
  return res;
}

/* ---- listeners (once, after beam-v03's wire()) ---- */
function wireWall(){
  const on=(id,ev,fn)=>{ const el=wallEl(id); if(el) el.addEventListener(ev,fn); };
  // wall construction
  ['wallT1','wallC','wallT2','wallIns','wallRecess','wallXc'].forEach(id=>on(id,'input',()=>{ readWallScalars(); syncWall(); }));
  ['wallChased1','wallChased2','wallPfcWeb'].forEach(id=>on(id,'change',()=>{ readWallScalars(); syncWall(); }));
  [['wallMat1','wallT1'],['wallMat2','wallT2']].forEach(([mid,tid])=>on(mid,'change',()=>{
    const m=wallMaterial(wallEl(mid).value);
    if(m.t!=null && wallEl(tid)) wallEl(tid).value=m.t;   // the material's usual thickness (Brick 102.5 -> 102.5); Custom / Stone / Concrete / Timber keep what is typed
    readWallScalars(); syncWall();
  }));
  on('wallSolid','change',()=>{
    const box=wallEl('wallSolid');
    if(box.checked){ wallSolidMemo={c:WALL.c, t2:WALL.t2}; if(wallEl('wallC')) wallEl('wallC').value=0; if(wallEl('wallT2')) wallEl('wallT2').value=0; }
    else { const m=wallSolidMemo||{c:100,t2:100}; if(wallEl('wallC')) wallEl('wallC').value=m.c>0? m.c : 100; if(wallEl('wallT2')) wallEl('wallT2').value=m.t2>0? m.t2 : 100; }
    readWallScalars(); fillWallPanels(); syncWall();
  });
  // placement
  document.querySelectorAll('[data-wmode]').forEach(b=>b.addEventListener('click',()=>{
    WALL.placement=b.dataset.wmode;
    document.querySelectorAll('[data-wmode]').forEach(q=>q.classList.toggle('on',q===b));
    const xcRow=wallEl('wallXcRow'); if(xcRow) xcRow.style.display=(WALL.placement==='custom')? '' : 'none';
    readWallScalars(); syncWall();
  }));
  // ledgers: delegated listeners per container (rows are re-rendered freely)
  WALL_LEDGERS.forEach(lg=>{
    const c=wallEl(WALL_LEDGER_IDS[lg.key]); if(!c) return;
    c.addEventListener('input',e=>{ const el=e.target; if(el.dataset&&el.dataset.wk&&el.tagName!=='SELECT'){ wallRowEdit(el); syncWall(); } });
    c.addEventListener('change',e=>{
      const el=e.target; if(!el.dataset) return;
      if(el.dataset.wk && el.tagName==='SELECT'){ const rerender=wallRowEdit(el); if(rerender) renderWallLedger(lg.key); syncWall(); }
      else if(el.dataset.wlc){ const row=WALL.ledgers[lg.key][+el.dataset.wi]; if(row) row[el.dataset.wlc]=el.checked; syncWall(); }
      else if(el.dataset.wlt){   // row type change: new defaults for the type, the label / case / height / e / x_w kept
        const i=+el.dataset.wi, old=WALL.ledgers[lg.key][i]; if(!old) return;
        WALL.ledgers[lg.key][i]=wallNewRow(lg.key, el.value, S.L, {label:old.label, case:old.case, height:old.height, zgCustom:old.zgCustom, e:old.e, xw:old.xw, ss:old.ss, stiff:old.stiff});
        renderWallLedger(lg.key); syncWall();
      }
    });
    c.addEventListener('click',e=>{
      const b=e.target.closest? e.target.closest('[data-wdel]') : null; if(!b) return;
      WALL.ledgers[lg.key].splice(+b.dataset.wi,1); renderWallLedger(lg.key); syncWall();
    });
  });
  document.querySelectorAll('[data-wadd]').forEach(b=>b.addEventListener('click',()=>{
    const lg=b.dataset.wadd; if(!WALL.ledgers[lg]) WALL.ledgers[lg]=[];
    WALL.ledgers[lg].push(wallNewRow(lg, b.dataset.wtype||'udl', S.L)); renderWallLedger(lg); syncWall();
  }));
  // beam-v03 events after which the placement / z_g / loads must be regenerated
  // (these listeners run after beam-v03's own, registered first by wire())
  ['family','pfcSelect','shsSelect','rhsSelect','ubSelect','ucSelect','shsType','rhsType','grade','code','restraint'].forEach(id=>on(id,'change',()=>{ fillWallPanels(); syncWall(); }));
  ['plateOn','plateSide'].forEach(id=>on(id,'change',()=>{ wallNormaliseHeights(WALL, activeSection(), S); fillWallPanels(); syncWall(); }));   // plate off: 'plate' rows -> the flange, BEFORE the ledgers re-render
  ['plateT','plateOutL','plateOutR'].forEach(id=>on(id,'input',()=>{ renderWallLedgers(); syncWall(); }));
  // span: beam-v03's spanEdited() restores S.loads from ITS snapshot and clamps them; the ledgers then regenerate S.loads
  // from their own snapshot clamped from the same Lold, so the last word is the ledgers' (positions follow the span)
  on('length','focus',()=>{ wallSpanEdit={L0:Number.isFinite(+S.L)? +S.L : wallLastL, ledgers:JSON.parse(JSON.stringify(WALL.ledgers))}; });
  const spanEdited=(commit)=>{
    if(!wallSpanEdit) wallSpanEdit={L0:wallLastL, ledgers:JSON.parse(JSON.stringify(WALL.ledgers))};   // spinner / programmatic edit: S.L is already the new value, wallLastL the old
    WALL.ledgers=JSON.parse(JSON.stringify(wallSpanEdit.ledgers));
    wallClampRowsToSpan(WALL, wallSpanEdit.L0, parseFloat(wallEl('length').value));
    renderWallLedgers();
    if(commit) wallSpanEdit=null;
    syncWall();
  };
  on('length','input',()=>spanEdited(false));
  on('length','change',()=>spanEdited(true));
  on('length','blur',()=>{ wallSpanEdit=null; });
  // reset: beam-v03 restored S = DEMO (its generic demo loads); the wall demo takes over
  on('resetBtn','click',()=>{ WALL=JSON.parse(JSON.stringify(WALL_DEMO)); wallSolidMemo=null; wallApplyDemoBeam(); fillWallPanels(); syncWall(); });
  // hard placement errors block the report (same wrapper pattern as js/08-mcr-eigen-patch.js)
  if(typeof window!=='undefined' && typeof window.validateInputs==='function' && !window.validateInputs.wallWrapped){
    const _v=window.validateInputs;
    const wrapped=function(){ const R=wallToLoads(WALL, activeSection(), S); if(R.errors.length) throw 'Beam in wall: '+R.errors.join(' '); _v.apply(this,arguments); };   // wall check first, so the message names the ledger row (I3) rather than beam-v03's "Load 4" 
    wrapped.wallWrapped=true;
    window.validateInputs=wrapped;
  }
}
