/* ===========================================================================
   6. REPORT RENDER
   render(): verdict banner, then (EC3, since 20 Sep 2026) the MasterSeries
   brief of js/06-brief-masterseries.js alone, or (BS 5950) the long CED
   report built here.
   =========================================================================== */
const f1=(v,d=1)=>{ if(!isFinite(v))return" "; const n=Math.abs(v)<5e-7?0:v; return n.toFixed(d); };
  const g=(v,d=2)=>{ if(!isFinite(v))return" "; const s=(Math.abs(v)<5e-7?0:v).toFixed(d); return s.includes('.') ? s.replace(/(\.\d*?)0+$/,'$1').replace(/\.$/,'') : s; };
const sname=k=>sectionDisplayName(k);   // "200 x 75 x 23" for every family (js/03-state-ui.js; 20 Sep 2026: the old /x/g -> ' ' printed "200 75 23")
function st(ok,t,fl){ return `<div class="status ${ok?'ok':'fail'}">${ok?t:(fl||'FAIL')}</div>`; }

function render(){
  const rep=$("report");
  let a,c;
  try{ a=analyse(); c=checks(a); }
  catch(err){ rep.innerHTML=`<div class="err">Could not analyse: ${err}</div>`; return; }
  const sec=a.sec;
  const sci = S.code==='EC3' && (S.restraint||'full')==='full';
  const sciU = S.code==='EC3' && !sci;
  // EC3 unrestrained Mcr method actually used by the check engine (c.mcrMethod is
  // set by both routes; 'standard' = closed form, 'eigen' = FE eigensolver)
  const mcrStd = sciU && c.mcrMethod==='standard';
  const famLabel = sec.isBox? (S.family==='rhs'? `RHS [${sec.boxType==='CF'?'Cold-formed':'Hot-finished'}]` : `SHS [${sec.boxType==='CF'?'Cold-formed':'Hot-finished'}]`) : S.family==='ub'? 'UB' : S.family==='uc'? 'UC' : 'PFC';
  const gradeTxt=`${S.grade} (p<sub>y</sub> = ${g(a.py,0)} N/mm )`;
  // load summary lines
  const swE=selfWeightEccentricity(sec);
  const swOff=(S.eccOn && Math.abs(swE)>1e-9)?`  [e=${g(swE,1)} mm, z_g=0 mm]`:'';
  const swPl = typeof plateGeom==='function'? plateGeom(sec) : null;
  const autoSwLine=`Self-weight  ${g(selfWeightValue(sec),4)} kN/m ?  0 ${g(S.L)} m  [Dead (G)]${swOff}  [automatic${swPl? ', incl. '+g(swPl.w,0)+'&times;'+g(swPl.t,0)+' '+(swPl.side==='top'?'top':'bottom')+' plate':''}]`;
  const userLoadLines=S.loads.filter(ld=>!ld.isSelfWeight).map(ld=>{
    const sw = ld.isSelfWeight? '  [self-weight]' : '';
    const cs = `  [${CASE_LABELS[ld.case]||ld.case}]`;
    const off = (S.eccOn && ld.type!=='moment') ? `  [e=${g(ld.e||0,0)} mm${loadHeightPerLoadOn()?`, z_g=${g(loadZgValue(ld),0)} mm`:''}]` : '';
    if(ld.type==='point') return `Point  ${g(ld.P)} kN ?  @ ${g(ld.pos)} m${cs}${off}${sw}`;
    if(ld.type==='moment') return `Moment ${g(ld.M)} kN m ?  @ ${g(ld.pos)} m${cs}${sw}`;
    if(ld.type==='udl') return `UDL    ${g(ld.w)} kN/m ?  ${g(ld.x1)} ${g(ld.x2)} m${cs}${off}${sw}`;
    if(ld.type==='trap') return `Trap   ${g(ld.w1)}?${g(ld.w2)} kN/m ?  ${g(ld.x1)} ${g(ld.x2)} m${cs}${off}${sw}`;
    return "";
  });
  const loadLines=[autoSwLine,...userLoadLines].join("<br>");
  const sectionView = typeof sectionLoadLineView === 'function' ? sectionLoadLineView(sec) : '';
  // End 1 / End 2 reactions of the governing-moment combination: R (upward positive) and the
  // end moment in the diagram convention as the end type carries them; "guided: M only"
  const reactLine=endsList().map(e=>{
    const r=a.reactions.find(q=>q.end===e.n);
    if(!r) return `End ${e.n} (x = ${g(e.x)} m): free end, no reaction`;
    if(r.type==='guided') return `End ${e.n} (x = ${g(e.x)} m): guided: M only, M = ${f1(reactionEndMomentKNm(r),2)} kN m`;
    return `End ${e.n} (x = ${g(e.x)} m): R = ${f1(r.V/1000,2)} kN`+(r.type==='fixed'? `, M = ${f1(reactionEndMomentKNm(r),2)} kN m` : ' (pinned: no M)');
  }).join(" &nbsp; | &nbsp; ");
  // End conditions line (19 Sep 2026 scope): the seven DOF flags of each end, the derived end types, the preset and the hinges
  const endsLine=`<div class="note" style="margin-left:0">End conditions: ${endsConditionsLine(S)}.</div>`;
  // uplift / hold-down rows (every combination's reactions; item 1.2)
  const HD=c.holdDown||null;
  const upliftLines=(HD&&HD.rows&&HD.rows.length)
    ? HD.rows.map(u=>{
        if(u.level==='sls') return `<div class="note" style="margin-left:0"><b>Uplift at SLS only, End ${u.n} (x = ${g(u.pos/1000,2)} m):</b> R = &minus;${f1(Math.abs(u.RSls),2)} kN (SLS combination ${u.comboSls}); no ULS combination lifts this end, including the &gamma;<sub>G,inf</sub> companions with G at 1.0 (STR set B) and 0.9 (EQU set A) (advisory).</div>`;
        return `<div class="note" style="margin-left:0;color:${u.holdDown?'#374151':'#b91c1c'}"><b>Hold-down ${u.holdDown?'provided':'required'} at End ${u.n} (x = ${g(u.pos/1000,2)} m):</b> R = &minus;${f1(Math.abs(u.RUls),2)} kN (combination ${u.comboUls})${u.RSls!=null? `; SLS uplift &minus;${f1(Math.abs(u.RSls),2)} kN (${u.comboSls})`:''}; ${u.nCombos} combination(s) lift this end${u.holdDown? ' &mdash; design the hold-down connection for this force (advisory)' : ' &mdash; NOT VERIFIED until "hold-down provided" is ticked for this end'}.</div>`; }).join('')
    : (a.uplift? `<div class="note" style="margin-left:0">Uplift: no end lifts in any of the ${a.uplift.nCombos!=null? a.uplift.nCombos : a.ulsResults.length+a.slsResults.length} combinations (all reactions &ge; 0${(a.ulsCompanions&&a.ulsCompanions.length)? '; incl. the '+a.ulsCompanions.length+' &gamma;<sub>G,inf</sub> companions with G at 1.0 and 0.9' : ''}).</div>` : '');
  // gamma_G,inf companions (reactions only)
  const patternBlock=a.companionNote? `<div class="note" style="margin-left:0">${a.companionNote}</div>` : '';

  // load combination results table   one row per enabled combo, flagging which one governs
  const comboRows = a.ulsResults.map(res=>{
    const isVgov = res===a.governV, isMgov = res===a.governM;
    const flags = [isVgov?'governs shear':null, isMgov?'governs moment':null].filter(Boolean).join(', ');
    return `<tr><td>${res.combo.label}</td><td class="num">${f1(res.Vmax/1000,2)}</td><td class="num">${f1(res.Mmax/1e6,2)} @ ${g(res.Mpos/1000,2)}</td><td style="font-weight:${flags?'700':'400'};color:${flags?'#166534':'#666'}">${flags||' '}</td></tr>`;
  }).join('');
  const slsRows = a.slsResults.map(res=>{
    const isDgov = res===a.governD;
    return `<tr><td>${res.combo.label}</td><td class="num">${f1(res.dmax,2)}</td><td style="font-weight:${isDgov?'700':'400'};color:${isDgov?'#166534':'#666'}">${isDgov?'governs deflection':' '}</td></tr>`;
  }).join('');
  const combosBlock = `
  <div class="section-title smallgap">Load Combinations Considered</div>
  ${patternBlock}
  <table class="force-table" style="font-size:13px">
    <thead><tr><th>ULS combination</th><th>Max F<sub>v</sub> (kN)</th><th>Max M<sub>x</sub> (kN m @ m)</th><th>Governs</th></tr></thead>
    <tbody>${comboRows}</tbody>
  </table>
  <table class="force-table" style="font-size:13px;margin-top:4px">
    <thead><tr><th>SLS combination</th><th>Deflection (mm)</th><th>Governs</th></tr></thead>
    <tbody>${slsRows}</tbody>
  </table>`;

  const verdict=c.pass?"PASS":c.utils.some(u=>!Number.isFinite(u.val)||u.val>1.0001)?"FAIL":"NOT VERIFIED";
  const verdictCombo=c.gov.combo || (c.gov.name==='Deflection'?a.governD.combo.label:
    c.gov.name.startsWith('Shear')?a.governV.combo.label:
    c.gov.name.startsWith('Member buckling')&&c.buck?c.buck.combo||a.governM.combo.label:
    c.gov.name.startsWith('LTB ')&&c.ltb?c.ltb.governCombo||'':'');
  const codeLabel = S.code==='EC3'? (sci? 'EN 1993-1-1 (UK NA) &mdash; fully restrained beam' : (c.ltb&&c.ltb.na? 'EN 1993-1-1 (UK NA) &mdash; closed section beam' : 'EN 1993-1-1 (UK NA) &mdash; unrestrained beam (LTB, M<sub>cr</sub> '+(mcrStd?'standard closed form':'FE eigenvalue')+')')) : 'BS 5950-1:2000';
  const banner=`<div class="banner ${c.pass?'pass':'failb'}">
    <div><div class="verdict">${verdict}</div><div style="font-size:12px;color:#374151;font-family:Arial">${codeLabel} member check   ${sname(sec.key)} ${famLabel}   ${S.grade}</div></div>
    <div class="util">Governing: <b>${c.gov.name} = ${g(c.gov.val,3)}</b>${verdictCombo?' ('+verdictCombo+')':''}<br>
      ${sci
        ? `Shear ${g(c.utils[0].val,2)} &bull; Bending ${g(c.utils[1].val,2)} &bull; Defl ${g(c.utils[2].val,2)}`
        : sciU && c.ltb && c.ltb.na
        ? `Shear ${g(c.utils[0].val,2)} &bull; Bending ${g(c.utils[1].val,2)} &bull; Defl ${g(c.utils[2].val,2)}`
        : sciU
        ? `Shear ${g(c.utils[0].val,2)} &bull; Bending ${g(c.utils[1].val,2)} &bull; LTB ${g(c.utils[2].val,2)} &bull; Defl ${g(c.utils[3].val,2)}`
        : `Shear ${g(c.utils[0].val,2)}   Bending ${g(c.utils[1].val,2)}   ${sec.isBox?'M/Mcx':'LTB'} ${g(c.utils[2].val,2)}   Defl ${g(c.utils[5].val,2)}`}
      ${c.unsupported&&c.unsupported.length?`<br><b>Unsupported exact check(s): ${c.unsupported.length}</b>`:''}</div></div>`;
  // 20 Sep 2026 Beam in Wall (wall.html, js/wall/04-wall-report.js): an optional block between the banner and the brief / report when the page defines reportPrefixHtml(a, c, sec); index.html defines none, so this is '' there
  const prefix=(typeof reportPrefixHtml==='function')? reportPrefixHtml(a,c,sec) : '';

  // 20 Sep 2026 (owner: "I see two briefs; it shall be one brief to avoid
  // confusion"): on the EC3 path the report is the verdict banner followed by
  // the MasterSeries-format brief of js/06-brief-masterseries.js and nothing
  // else - the load list, the member-forces table, the hover diagrams (loading,
  // shear, moment, deflection, torsion) and every check block live inside the
  // brief in MasterSeries order. The long CED report built below is the
  // BS 5950 output only; its former EC3 branches (SCI restrained /
  // unrestrained blocks, torsion cards, Annex B interaction, EC3 notes, the
  // "Detailed derivation" wrapper) were removed with this change.
  if(S.code==='EC3'){
    let brief;
    if(typeof renderMasterSeriesBrief!=='function') brief='<div class="err">Design brief renderer not loaded (js/06-brief-masterseries.js).</div>';
    else { try{ brief=renderMasterSeriesBrief(a,c,sec); } catch(err){ brief=`<div class="err">Design brief could not be rendered: ${err}</div>`; } }
    rep.innerHTML=`
  ${banner}
  ${prefix}
  ${brief}
  <div class="note" style="margin-top:8px;color:#9a8f78">Analysis: 2-node Euler Bernoulli beam elements (direct stiffness); reactions exact, shear/moment by statics, deflection at nodes exact. Section data: SCI P363 Blue Book. This is a design aid   results to be verified by a competent engineer.</div>`;
    // the section load-line card inside the brief zooms on click / Enter: listeners bound here (no inline handlers in the markup)
    if(typeof sectionViewBindZoom==='function') sectionViewBindZoom(rep);
    return;
  }

  // m-factor formula strings (BS 5950 report)
  const mfRow = sec.isBox
    ? `<div>m<sub>LT</sub></div><div class="formula">SHS   no LTB possible, so m<sub>LT</sub> is not used</div><div class="value">1.000</div><div class="status">cl 4.3.6.1</div>`
    : c.isCant
    ? `<div>m<sub>LT</sub></div><div class="formula">Cantilever ? Table 18</div><div class="value">${g(c.mLT,3)}</div><div class="status">Table 18</div>`
    : `<div>m<sub>LT</sub></div><div class="formula">0.2+(0.15 ${f1(a.Mq,1)}+0.5 ${f1(a.Mh,1)}+0.15 ${f1(a.Mq3,1)})/${f1(Math.abs(a.Mmax),1)}</div><div class="value">${g(c.mLT,3)}</div><div class="status">Table 18</div>`;
  const mxRow = `<div>m<sub>x</sub></div><div class="formula">0.2+(0.1 ${f1(a.Mq,1)}+0.6 ${f1(a.Mh,1)}+0.1 ${f1(a.Mq3,1)})/${f1(Math.abs(a.Mmax),1)} = 0.8 ${f1(a.M24,1)}/${f1(Math.abs(a.Mmax),1)}</div><div class="value">${g(c.mx,3)}</div><div class="status">Table 26</div>`;

  // notes
  const notes=[];
  notes.push('PASS applies only to the implemented member checks and the enabled load combinations. Support bearing, connections and the complete structural system require separate verification.');
  if(S.combos.some(cb=>cb.id!=='c1'&&!cb.sls&&cb.on)) notes.push('Custom ULS factors are used as entered; confirm the complete combination set and favourable/unfavourable actions for the selected standard.');
  if(c.combinationChecks&&c.combinationChecks.length>1) notes.push('BS 5950 m-factors are evaluated separately for every ULS combination. The verdict uses the worst utilisation; the detailed envelope calculation below may have a different governing diagram.');
  if(c.unsupported&&c.unsupported.length) c.unsupported.forEach(n=>notes.push(`<b>NOT COVERED:</b> ${n}`));
  if(c.advisory&&c.advisory.length) c.advisory.forEach(n=>notes.push(`<b>ADVISORY (does not block PASS):</b> ${n}`));
  // BS 5950 notes (the EC3 path returned above with its brief, 20 Sep 2026)
  if(c.shearBuckle) notes.push("d/t &gt; 70e   shear buckling must be checked (cl 4.2.3 / 4.4.5); not covered here (none of the tabulated sections normally reach this limit).");
  if(c.hsNote) notes.push(c.hsNote+".");
  if(c.n>0.1 && !sec.isBox && sec.kind==='I') notes.push(`Significant axial load   the reduced plastic modulus S<sub>rx</sub> uses the standard web-area formula for an equal-flanged I/H section.`);
  if(sec.isBox && S.family==='shs') notes.push(`Closed square section: the BS box-section LTB calculation gives ?<sub>LT</sub> 0 and p<sub>b</sub>=p<sub>y</sub>, so M<sub>b</sub> is governed by M<sub>cx</sub>.`);
  if(sec.isBox && S.family==='rhs') notes.push(`RHS lateral torsional buckling now uses the BS box-section ?<sub>LT</sub>=2.25v(F<sub>b</sub>? <sub>w</sub>) calculation rather than the previous rough Table 15 screen.`);
  if(sec.isBox && S.family==='shs') notes.push(`Strut curve: ${sec.boxType==='CF'?'cold-formed ? curve c (a=5.5)':'hot-finished ? curve a (a=2.0)'} per Table 23, both axes (r<sub>x</sub>=r<sub>y</sub> for a square section). Override in "Robertson const." if a different curve applies.`);
  if(sec.isBox && S.family==='rhs') notes.push(`Strut curve: ${sec.boxType==='CF'?'cold-formed box section ? curve c (a=5.5)':'hot-finished box section ? curve a (a=2.0)'} per Table 23, both axes. Note r<sub>x</sub>?r<sub>y</sub> for a true RHS, so P<sub>c</sub> and P<sub>cy</sub> genuinely differ even though the curve is the same both ways. Override in "Robertson const." if a different curve applies.`);
  if(S.family==='ub') notes.push(`Strut curve (Table 23, rolled I-section): x-x curve ${sec.tf<=40?'a (a=2.0)':'b (a=3.5)'}, y-y curve ${sec.tf<=40?'b (a=3.5)':'c (a=5.5)'} for flange thickness ${sec.tf<=40?'=':'>'}40&nbsp;mm. Override per-axis in "Robertson const." if a different curve applies.`);
  if(S.family==='uc') notes.push(`Strut curve (Table 23, rolled H-section): x-x curve ${sec.tf<=40?'b (a=3.5)':'c (a=5.5)'}, y-y curve ${sec.tf<=40?'c (a=5.5)':'d (a=8.0)'} for flange thickness ${sec.tf<=40?'=':'>'}40&nbsp;mm   one curve lower than a rolled I-section at the same thickness. Override per-axis in "Robertson const." if a different curve applies.`);
  if(sec.kind==='channel') notes.push(`Strut curve: BS&nbsp;5950 directs channel struts to Table 25 (a distinct method from the generic curve a d system). PFC compression is blocked from PASS unless verified Table&nbsp;25/Blue Book data is implemented.`);
  notes.push("Minor-axis bending M<sub>y</sub> = 0 in this single-plane solver, so m<sub>y</sub> = m<sub>yx</sub> = 1.");

  function classBlockBSfn(){ return sec.isBox ? `
  <div class="section-title">Classification and Properties (BS 5950-1:2000)</div>
  <div class="props">
    <div>Section (${g(sec.mass,1)} kg/m)</div><div>${sname(sec.key)} ${famLabel} [${S.grade}]  D=${g(sec.D,0)} B=${g(sec.B,0)} t=${g(sec.tf,1)} mm</div><div></div><div></div>
    <div>e = v(275/p<sub>y</sub>)</div><div>v(275/${g(a.py,0)})</div><div class="right">${g(c.eps,3)}</div><div></div>
    <div>Flange  b/t = ${g(sec.bT,2)}</div><div>limit ${g(c.cl.flim[0],0)}e=${g(c.cl.flim[0]*c.eps,1)} (Cl.1) / ${g(c.cl.flim[1],0)}e / ${g(c.cl.flim[2],0)}e</div><div class="right">Class ${c.cl.fc}</div><div class="right">${["","Plastic","Compact","Semi-comp","Slender"][c.cl.fc]}</div>
    <div>Web  d/t = ${g(sec.dt,2)}</div><div>limit ${g(c.cl.wlim[0],0)}e=${g(c.cl.wlim[0]*c.eps,1)} (Cl.1) / ${g(c.cl.wlim[1],0)}e / ${g(c.cl.wlim[2],0)}e</div><div class="right">Class ${c.cl.wc}</div><div class="right">${["","Plastic","Compact","Semi-comp","Slender"][c.cl.wc]}</div>
    <div>Class = Fn(b/t,d/t,p<sub>y</sub>,F,M<sub>x</sub>)   Table 12</div><div>${g(sec.bT,2)}, ${g(sec.dt,2)}, ${g(a.py,0)}, ${f1(c.F,1)}, ${f1(a.Mmax,1)}</div><div class="right"></div><div class="right"><b>${c.clsName}</b></div>
  </div>` : `
  <div class="section-title">Classification and Properties (BS 5950-1:2000)</div>
  <div class="props">
    <div>Section (${g(sec.mass,1)} kg/m)</div><div>${sname(sec.key)} ${famLabel} [${S.grade}]</div><div></div><div></div>
    <div>e = v(275/p<sub>y</sub>)</div><div>v(275/${g(a.py,0)})</div><div class="right">${g(c.eps,3)}</div><div></div>
    <div>Flange  b/T = ${g(c.bTBS!=null?c.bTBS:sec.bT,2)}</div><div>b = ${sec.kind==='channel'? 'B (full flange, Figure 5)':'B/2 (rolled I/H, Figure 5)'}; limit 9e = ${g(9*c.eps,1)} (Cl.1) / 10e / 15e</div><div class="right">Class ${c.cl.fc}</div><div class="right">${["","Plastic","Compact","Semi-comp","Slender"][c.cl.fc]}</div>
    ${sec.kind==='channel'
      ? `<div>Web (channel)  d/t = ${g(sec.dt,2)}</div><div>limit 40e = ${g(40*c.eps,1)} (Table 11   flat limit, all classes)</div><div class="right">Class ${c.cl.wc}</div><div class="right">${c.cl.wc<=3?'='+g(40*c.eps,1)+' OK':'Slender'}</div>`
      : `<div>Web (I/H section)  d/t = ${g(sec.dt,2)}</div><div>${c.cl.webCase==='bending+compression'
        ? `bending + compression (Table 11, cl 3.5.5): r<sub>1</sub> = ${g(c.cl.r1,3)}, r<sub>2</sub> = ${g(c.cl.r2,3)}; limits ${g(c.cl.wlim[0],1)}e / ${g(c.cl.wlim[1],1)}e / ${g(c.cl.wlim[2],1)}e`
        : `limit 80e = ${g(80*c.eps,0)} / 100e / 120e`}</div><div class="right">Class ${c.cl.wc}</div><div class="right">${["","Plastic","Compact","Semi-comp","Slender"][c.cl.wc]}</div>`}
    <div>Class = Fn(b/T,d/t,p<sub>y</sub>,F,M<sub>x</sub>,M<sub>y</sub>)</div><div>${g(c.bTBS!=null?c.bTBS:sec.bT,2)}, ${g(sec.dt,2)}, ${g(a.py,0)}, ${f1(c.F,1)}, ${f1(a.Mmax,1)}, 0</div><div class="right"></div><div class="right"><b>${c.clsName}</b></div>
  </div>`; }
  const classBlock = classBlockBSfn();

  function ltbBlockBSfn(){ return sec.isBox ? `
  <div class="section-title smallgap">Lateral Torsional Buckling (Cl. 4.3.6.1${S.family==='rhs'?' / Table 15':''})</div>
  <div class="calc-block">
    <div>L<sub>E</sub> = ${g(c.leK,2)} L</div><div class="formula">${g(c.leK,2)} ${g(S.L,3)} m: ${c.leBasis||''}; end flags ${endsConditionsLine(S)}${c.leMsg? ' &mdash; <b>NOT VERIFIED</b> (no tabulated row: enter L<sub>E</sub>/L)' : ''}</div><div class="value">${g(c.LE/1000,3)} m</div><div class="status">${c.leRow==='user'? 'entered' : c.leMsg? 'blocked' : 'Table 13/14 [verify]'}</div>
    <div>? = L<sub>E</sub>/r<sub>y</sub></div><div class="formula">${f1(c.LE,0)} / ${g(sec.ry*10,1)}</div><div class="value">${f1(c.lam,2)}</div><div></div>
    <div>F<sub>b</sub> = v(S<sub>x</sub> ?'/(AJ))</div><div class="formula">?'=(1-I<sub>y</sub>/I<sub>x</sub>)(1-J/(2.6I<sub>x</sub>))</div><div class="value">${f1(c.phiB,3)}</div><div></div>
    <div> <sub>w</sub></div><div class="formula">${c.cl.cls<=2?'Class 1/2 ? 1.0':'Z<sub>x</sub>/S<sub>x</sub>'}</div><div class="value">${g(c.betaW,3)}</div><div></div>
    <div>?<sub>LT</sub> = 2.25v(F<sub>b</sub>? <sub>w</sub>)</div><div class="formula">2.25v(${f1(c.phiB,3)} ${f1(c.lam,2)} ${g(c.betaW,3)})</div><div class="value">${f1(c.lamLT,2)}</div><div></div>
    <div>p<sub>b</sub> = Fn(p<sub>y</sub>, ?<sub>LT</sub>)</div><div class="formula">?<sub>L0</sub> = ${f1(c.lamL0,1)}</div><div class="value">${f1(c.pb,1)} N/mm </div><div class="status">Annex B</div>
    <div>M<sub>b</sub> = ${c.cl.cls<=2?'S':'Z'}<sub>x</sub> p<sub>b</sub> = M<sub>cx</sub></div><div class="formula">${g(c.cl.cls<=2?sec.Sx:sec.Zx,1)} ${f1(c.pb,1)}</div><div class="value">${f1(c.Mb,2)} kN m</div>${st(c.ltbUtil<=1,'OK')}
  </div>` : `
  <div class="section-title smallgap">Lateral Torsional Buckling   M<sub>b</sub> (Cl. 4.3 / Annex B)</div>
  <div class="calc-block">
    <div>L<sub>E</sub> = ${g(c.leK,2)} L</div><div class="formula">${g(c.leK,2)} ${g(S.L,3)} m: ${c.leBasis||''}; end flags ${endsConditionsLine(S)}${c.leMsg? ' &mdash; <b>NOT VERIFIED</b> (no tabulated row: enter L<sub>E</sub>/L)' : ''}; strut lengths L<sub>cr,x</sub> = ${g(c.LcrX/1000,3)} m, L<sub>cr,y</sub> = ${g(c.LcrY/1000,3)} m (${c.lcrBasis||''})</div><div class="value">${g(c.LE/1000,3)} m</div><div class="status">${c.leRow==='user'? 'entered' : c.leMsg? 'blocked' : 'Table 13/14 [verify]'}</div>
    <div>? = L<sub>E</sub> / r<sub>y</sub></div><div class="formula">${f1(c.LE,0)} / ${g(sec.ry*10,1)}</div><div class="value">${f1(c.lam,2)}</div><div></div>
    <div>v = 1/[1+0.05(?/x) ]<sup> </sup></div><div class="formula">x = ${g(sec.x,1)} (torsional index)</div><div class="value">${g(c.v,3)}</div><div class="status">N=0.5</div>
    <div> <sub>w</sub></div><div class="formula">${c.cl.cls<=2?'Class 1/2 ? 1.0':'Z<sub>x</sub>/S<sub>x</sub>'}</div><div class="value">${g(c.betaW,3)}</div><div></div>
    <div>?<sub>LT</sub> = u v ? v <sub>w</sub></div><div class="formula">${g(sec.u,3)} ${g(c.v,3)} ${f1(c.lam,2)} v${g(c.betaW,2)}</div><div class="value">${f1(c.lamLT,2)}</div><div></div>
    <div>p<sub>b</sub> = Fn(p<sub>y</sub>, ?<sub>LT</sub>)</div><div class="formula">?<sub>L0</sub> = ${f1(c.lamL0,1)} ${c.lamLT<=c.lamL0?'(?<sub>LT</sub>=?<sub>L0</sub> ? p<sub>b</sub>=p<sub>y</sub>)':'(Perry, Annex B.2)'}</div><div class="value">${f1(c.pb,1)} N/mm </div><div class="status">Annex B</div>
    <div>M<sub>b</sub> = ${c.cl.cls<=2?'S':'Z'}<sub>x</sub> p<sub>b</sub> = M<sub>cx</sub></div><div class="formula">${g(c.cl.cls<=2?sec.Sx:sec.Zx,1)} ${f1(c.pb,1)}</div><div class="value">${f1(c.Mb,2)} kN m</div><div></div>
    <div>m<sub>LT</sub>M<sub>x</sub> = M<sub>b</sub> (cl 4.3.6.2)</div><div class="formula">${g(c.mLT,3)} ${f1(c.Mx,1)} / ${f1(c.Mb,2)}</div><div class="value">${g(c.ltbUtil,3)}</div>${st(c.ltbUtil<=1,'OK')}
  </div>`; }
  const ltbBlock = ltbBlockBSfn();

  const pvFormula = sec.isBox? (sec.D===sec.B? 'P<sub>v</sub>=0.6 p<sub>y</sub> A D/(D+B)=0.6 p<sub>y</sub> A/2' : 'P<sub>v</sub>=0.6 p<sub>y</sub> A D/(D+B)') : 'P<sub>v</sub>=0.6 p<sub>y</sub> t D';

  rep.innerHTML = `
  ${banner}
  ${prefix}
  <div class="report-head">
    <div>
      <h2>Member Loading and Member Forces</h2>
      <div class="meta">${sname(sec.key)} ${famLabel} &nbsp; &nbsp; ${gradeTxt} &nbsp; &nbsp; L = ${g(S.L)} m</div>
      ${endsLine}
      <div class="loadlist">${loadLines}</div>
    </div>
    ${sectionView}
  </div>

  <div class="diagcard">
    <div class="dt">Loading</div>
    ${beamDiagram(a)}
    <div class="note" style="margin-left:0">Reactions (governing-moment combo, ${a.governM.combo.label}; R upward positive, M sagging positive): ${reactLine}</div>
    ${upliftLines}
  </div>

  ${combosBlock}

  <table class="force-table">
    <thead>
      <tr><th class="table-title" colspan="4">Member Force Envelope   ULS combinations&nbsp;&nbsp;|&nbsp;&nbsp;Deflection   SLS combinations</th></tr>
      <tr><th>Axial Force (kN)</th><th>Max Shear F<sub>v</sub> (kN)</th><th>Max Moment M<sub>x</sub> (kN m @ m)</th><th>Max Deflection (mm @ m)</th></tr>
    </thead>
    <tbody><tr>
      <td class="num">${f1(c.F,3)} ${c.F>=0?'C':'T'}</td>
      <td class="num">${f1(a.Vmax,2)}</td>
      <td class="num">${f1(a.Mmax,2)} @ ${g(a.Mpos,2)}</td>
      <td class="num">${f1(a.dmax,2)} @ ${g(a.dpos,2)}</td>
    </tr></tbody>
  </table>

  <div class="diagcard">
    <div class="diagrow">
      <div><div class="dt">Shear force (kN)</div>${plot(a.diag.xs,a.diag.V,{color:'#1d4ed8',fill:'#bcd0f7',unit:'kN',fmt:v=>f1(v,2)})}</div>
      <div><div class="dt">Bending moment (kN m)</div>${plot(a.diag.xs,a.diag.M,{color:'#b91c1c',fill:'#f3c2c2',unit:'kN m',flip:true,fmt:v=>f1(v,2)})}</div>
    </div>
    <div class="diagrow" style="margin-top:6px">
      <div><div class="dt">Deflection (mm, SLS)</div>${plot(a.diag.dx,a.diag.dw,{color:'#166534',fill:'#bfe3cb',unit:'mm',fmt:v=>f1(v,2)})}</div>
      <div style="display:flex;align-items:center;padding:8px 4px"><div class="note" style="margin:0">Bending-moment diagram plotted on the tension (sagging-down) side. Shear and deflection plotted to true sign (down = below the axis).</div></div>
    </div>
  </div>

  <div class="calcs-start"></div>
  ${classBlock}

  <div class="section-title smallgap">Local Capacity Check (Cl. 4.2)</div>
  <div class="calc-block">
    <div>F<sub>vx</sub> / P<sub>vx</sub></div><div class="formula">${f1(c.Fv,2)} / ${f1(c.Pv,1)} &nbsp;(${pvFormula})</div><div class="value">${g(c.Fv/c.Pv,3)}</div>${st(c.lowShear,'Low Shear','High Shear')}
    <div>M<sub>cx</sub> = p<sub>y</sub> S<sub>x</sub> = 1.2 p<sub>y</sub> Z<sub>x</sub></div><div class="formula">${g(a.py,0)} ${g(sec.Sx,1)} = 1.2 ${g(a.py,0)} ${g(sec.Zx,1)}</div><div class="value">${f1(c.Mcx,2)} kN m</div><div></div>
    <div>A<sub>e</sub> = K<sub>e</sub> A<sub>net</sub> = A<sub>g</sub></div><div class="formula">${g(c.Ke,2)} ${g(c.Anet/1e2,1)} = ${g(c.Ag/1e2,1)}</div><div class="value">${g(c.Ae/1e2,1)} cm </div><div></div>
    <div>P<sub>z</sub> = A<sub>e</sub> p<sub>y</sub></div><div class="formula">${g(c.Ae/1e2,1)} ${g(a.py,0)}</div><div class="value">${f1(c.Pz,1)} kN</div><div></div>
    <div>n = F / P<sub>z</sub></div><div class="formula">${f1(c.F,2)} / ${f1(c.Pz,1)}</div><div class="value">${g(c.n,3)}</div>${st(c.n<=1,'OK')}
    <div>S<sub>rx</sub> = Fn(S<sub>x</sub>, n)</div><div class="formula">${g(sec.Sx,1)}${c.n>0.02?` reduced for n`:`, n 0`}</div><div class="value">${g(c.Srx/1e3,1)} cm </div><div></div>
    <div>M<sub>rx</sub> = min(M<sub>cx</sub>, axial-reduced resistance)</div><div class="formula">including the applicable shear reduction and elastic cap</div><div class="value">${f1(c.Mrx,2)} kN m</div><div></div>
    <div>(M<sub>x</sub>/M<sub>rx</sub>) + (M<sub>y</sub>/M<sub>ry</sub>)</div><div class="formula">(${f1(c.Mx,2)}/${f1(c.Mrx,2)}) + 0</div><div class="value">${g(c.localUtil,3)}</div>${st(c.localUtil<=1,'OK')}
  </div>

  <div class="section-title smallgap">Equivalent Uniform Moment Factors</div>
  <div class="calc-block">
    ${mfRow}
    ${mxRow}
    <div>m<sub>y</sub>, m<sub>yx</sub></div><div class="formula">M<sub>y</sub> = 0 (single-plane bending)</div><div class="value">1.000</div><div class="status">Table 26</div>
  </div>

  ${ltbBlock}

  <div class="section-title smallgap">Simplified Buckling Approach (Cl. 4.8.3.3.1)</div>
  <div class="calc-block">
    <div>p<sub>y</sub> Z<sub>x</sub></div><div class="formula">${g(a.py,0)} ${g(sec.Zx,1)}</div><div class="value">${f1(c.pyZx,2)} kN m</div><div></div>
    <div>F/P<sub>c</sub> + m<sub>x</sub> M<sub>x</sub>/(p<sub>y</sub>Z<sub>x</sub>)</div><div class="formula">${f1(c.Fc,1)}/${f1(c.Pc,0)} + ${g(c.mx,3)} ${f1(c.Mx,2)}/${f1(c.pyZx,2)}</div><div class="value">${g(c.u1,3)}</div>${st(c.u1<=1,'OK')}
    <div>F/P<sub>cy</sub> + m<sub>LT</sub> M<sub>LT</sub>/M<sub>b</sub></div><div class="formula">${f1(c.Fc,1)}/${f1(c.Pcy,0)} + ${g(c.mLT,3)} ${f1(c.Mx,2)}/${f1(c.Mb,2)}</div><div class="value">${g(c.u2,3)}</div>${st(c.u2<=1,'OK')}
  </div>

  <div class="section-title smallgap">Deflection Check (SLS &mdash; ${a.governD.combo.label})</div>
  <div class="calc-block">
    <div>${c.deflCant? 'Tip deflection (vertically free end, relative to the held end)' : 'w (governing span utilisation)'}</div><div class="formula">@ x = ${g(a.deflection?a.deflection.dpos/1000:a.dpos,2)} m</div><div class="value">${f1(c.dmax,1)} mm</div><div></div>
    <div>Limit = ${c.deflCant? 'L/' : 'span/'}${g(c.divisor,0)}${a.deflection&&a.deflection.abs!=null? ', capped at '+f1(a.deflection.abs,1)+' mm (absolute)' : ''}</div><div class="formula">${g(c.span,0)}/${g(c.divisor,0)} = ${f1(a.deflection?a.deflection.limSpan:c.dlimit,1)} mm${c.deflAbsGoverns? ' &gt; absolute limit '+f1(a.deflection.abs,1)+' mm, which governs' : ''}${c.deflCant? ' (vertically free end: L/'+g(c.divisor,0)+' per UK NA to EN 1993-1-1 Table NA.2 [verify], cantilever row)' : ''}</div><div class="value">${f1(c.dmax,1)} ${c.defOk?'&lt;':'&gt;'} ${f1(c.dlimit,1)} mm</div>${st(c.defOk,'OK')}
  </div>

  <div class="note">${notes.map(n=>'  '+n).join('<br>')}</div>
  <div class="note" style="margin-top:8px;color:#9a8f78">Analysis: 2-node Euler Bernoulli beam elements (direct stiffness); reactions exact, shear/moment by statics, deflection at nodes exact. Section data: SCI P363 Blue Book. This is a design aid   results to be verified by a competent engineer.</div>`;
  // the section load-line card zooms on click / Enter: listeners bound here
  // (no inline handlers in the markup)
  if(typeof sectionViewBindZoom==='function') sectionViewBindZoom(rep);
}
