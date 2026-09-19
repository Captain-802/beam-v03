/* ===========================================================================
   6. REPORT RENDER
   =========================================================================== */
const f1=(v,d=1)=>{ if(!isFinite(v))return" "; const n=Math.abs(v)<5e-7?0:v; return n.toFixed(d); };
  const g=(v,d=2)=>{ if(!isFinite(v))return" "; const s=(Math.abs(v)<5e-7?0:v).toFixed(d); return s.includes('.') ? s.replace(/(\.\d*?)0+$/,'$1').replace(/\.$/,'') : s; };
const sname=k=>k.replace(/x/g,' ');
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
  const mcrMethodLabel = mcrStd? 'standard closed-form method (NCCI SN003a / SN006a, C<sub>1</sub> tables)' : 'FE eigenvalue method';
  const famLabel = sec.isBox? (S.family==='rhs'? 'RHS [Hot-finished]' : `SHS [${sec.boxType==='CF'?'Cold-formed':'Hot-finished'}]`) : S.family==='ub'? 'UB' : S.family==='uc'? 'UC' : 'PFC';
  const gradeTxt=`${S.grade} (p<sub>y</sub> = ${g(a.py,0)} N/mm )`;
  const vt=c.tor&&c.tor.vt ? c.tor.vt : null;
  const vtX=vt ? vt.x/1000 : 0;
  const vtCombo=vt&&vt.combo ? ' ('+vt.combo+')' : '';
  const vtV=vt ? vt.V : c.Fv;
  const vtT=vt ? vt.T : (c.tor&&c.tor.TEd)||0;
  const vtTau=vt ? vt.tau : (c.tor&&c.tor.tau)||0;
  const vtTauT=vt ? vt.tauT : (c.tor&&c.tor.tauT)||0;
  const vtTauW=vt ? vt.tauW : (c.tor&&c.tor.tauW)||0;
  const vtVpl=vt ? vt.VplTRd : (c.tor&&c.tor.VplTRd)||0;
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
  const reactLine=a.reactions.map(r=>`R@${g(r.pos/1000)}m = ${f1(r.V/1000,2)} kN`+(r.type==='fixed'?`, M = ${f1(-r.M/1e6,2)} kN m`:'')).join("   ");

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

  // m-factor formula strings (BS5950 only; EC3 uses its own C1/Cmy block built below)
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
  if(a.deflection&&a.deflection.span<a.L-1e-6) notes.push('Deflection is checked for each support-to-support span and each end overhang using its own length and the entered divisor. Governing segment: '+g(a.deflection.start/1000,2)+' to '+g(a.deflection.end/1000,2)+' m.');
  if(c.unsupported&&c.unsupported.length) c.unsupported.forEach(n=>notes.push(`<b>NOT COVERED:</b> ${n}`));
  if(c.advisory&&c.advisory.length) c.advisory.forEach(n=>notes.push(`<b>ADVISORY (does not block PASS):</b> ${n}`));
  if((sci||sciU)&&c.tor&&c.tor.p385) notes.push("Open-section torsion per SCI P385: elastic Method B with fork ends and free warping, using Appendix C Cases 3/4/10. The rotation-induced minor moment is included. Plastic redistribution and growth of eccentricity as the section twists are not iterated. The EC3 destabilising switch does not add this second-order torsional effect.");
  if((sci||sciU)&&c.tor) notes.push("Torsion: each applied load acts at its own offset e from the shear centre; loads with e = 0 and applied moments generate no torque. Automatic self-weight acts through the centroid, so it has e = 0 for doubly symmetric sections but e = e<sub>sc</sub> for PFC channels. The verification conservatively assumes maximum shear, bending and torsion are coincident (SCI example note). All supports are assumed to prevent twist &mdash; fork supports; friction-grip connections or similar may be required. Torsion is evaluated on the EC3 code path only.");
  if((sci||sciU)&&c.coex&&c.coex.pureShearFail) notes.push("Coexistent M&ndash;V: V<sub>Ed</sub> exceeds V<sub>pl,Rd</sub> at the reported section, so the cl 6.2.8 reduced moment formula is bypassed; the section has already failed in pure shear.");
  if(sci){
    if(c.hsNote) notes.push(c.hsNote+".");
    if(c.ax) notes.push(c.ax.tension
      ? "Tension + bending: cross-section by cl 6.2.9; member buckling per cl 6.3.3 is not required because N<sub>Ed</sub> is tensile."
      : "Axial compression + bending: cross-section by cl 6.2.9; member buckling by cl 6.3.3 / Annex B Method 2, Table B.1 (fully restrained &mdash; not susceptible to torsional deformation, &chi;<sub>LT</sub> = 1, M<sub>b,Rd</sub> = M<sub>c,Rd</sub>); C<sub>m</sub> per Table B.3. Strut length L<sub>cr</sub> = L<sub>E</sub>-factor &times; L (edit under Axial &amp; LTB; note a cantilever strut classically takes L<sub>cr</sub> = 2L).");
    notes.push("Fully restrained beam: design follows the SCI worked-example procedure to BS EN 1993-1-1 (UK NA) &mdash; classification (Table 5.2), shear resistance (cl 6.2.6), shear-buckling screen (cl 6.2.6(6)), moment resistance (cl 6.2.5, with the cl 6.2.8 shear check made at the point of maximum bending moment), and vertical deflection. &gamma;<sub>M0</sub> = 1.0 (UK NA); &eta; = 1.0 taken conservatively.");
    notes.push("Vertical deflection is checked against span/"+g(c.divisor,0)+" under the enabled SLS combination(s). NA 2.23 applies the limit to deflection due to <b>variable actions only</b>, so the default SLS combination carries Q only (edit under Load Combinations if a different criterion is required).");
  } else if(sciU){
    if(c.hsNote) notes.push(c.hsNote+".");
    if(c.ltb&&c.ltb.na){
      notes.push("Closed hollow section: lateral-torsional buckling is not required by EN 1993-1-1 cl 6.3.2.1(2); M<sub>b,Rd</sub> is taken as M<sub>c,Rd</sub>"+(mcrStd? " (standard closed-form route; the SN003a M<sub>cr</sub> with I<sub>w</sub> = 0 is printed for information)." : " and the FE M<sub>cr</sub> eigensolver is skipped."));
    } else if(mcrStd){
      const ci=c.ltb.c1in;
      notes.push("Unrestrained beam: design follows BS EN 1993-1-1 (UK NA) with <b>M<sub>cr</sub> by the STANDARD closed-form method</b> (user selection): C<sub>1</sub> from the moment diagram &mdash; "+(c.ltb.c1label||c.c1label)+" &mdash; then "+(c.ltb.cant? "NCCI SN006a M<sub>cr</sub> = C&middot;M<sub>cr,0</sub> for the cantilever" : c.ltb.channel? "the P385/P362 channel &kappa; chain with the doubly symmetric M<sub>cr</sub> route where valid" : "M<sub>cr</sub> = C<sub>1</sub>(&pi;&sup2;EI<sub>z</sub>/L<sub>E</sub>&sup2;)&radic;[I<sub>w</sub>/I<sub>z</sub> + L<sub>E</sub>&sup2;GI<sub>t</sub>/(&pi;&sup2;EI<sub>z</sub>)] (NCCI SN003a, k = k<sub>w</sub> = 1, G = 81000 N/mm&sup2;"+(c.ltb.zgUsed? ", C<sub>2</sub>z<sub>g</sub> load-height term applied":"")+") with L<sub>E</sub> = "+g(S.leFactor*(S.destab?1.2:1),2)+"&times;L = "+g(c.LE/1000,2)+" m")+". This is the route MasterSeries-type software prints; the FE eigensolver was not run (M<sub>cr,eigen</sub> = n/a). Select the FE eigenvalue method under Axial &amp; LTB to compare.");
      if(ci) notes.push("C<sub>1</sub> inputs (MasterSeries convention, "+(c.ltb.c1seg&&c.ltb.c1seg.whole===false? 'segment '+g(c.ltb.c1seg.xa/1000,2)+'&ndash;'+g(c.ltb.c1seg.xb/1000,2)+' m' : 'whole member')+"): M<sub>1</sub>, M<sub>2</sub> = segment end moments (M<sub>2</sub> the larger), M<sub>o</sub> = mid-segment moment above the chord, &psi; = M<sub>1</sub>/M<sub>2</sub>, &mu; = M<sub>o</sub>/M<sub>2</sub> (capped at 300): "+f1(ci.M1,1)+", "+f1(ci.M2,1)+", "+f1(ci.Mo,1)+" kN&middot;m, "+f1(ci.psi,3)+", "+f1(ci.mu,3)+".");
      notes.push("Design basis for the LTB verdict: "+c.ltbBasis+".");
    } else {
      notes.push("Unrestrained beam: design follows BS EN 1993-1-1 (UK NA) with <b>M<sub>cr</sub> by the FE eigenvalue method</b> solved directly over the governing moment diagram. Load height z<sub>g</sub>, mono-symmetry z<sub>j</sub>, lateral restraints, and cantilever root warping are included in M<sub>cr</sub>; no SN003a/SN006a C-table or P362 simplified slenderness route is used for the verdict.");
      if(c.ltb&&c.ltb.McrStandard!=null) notes.push("Comparison with the standard closed-form method for the same segment ("+(c.ltb.c1seg&&c.ltb.c1seg.whole===false? g(c.ltb.c1seg.xa/1000,2)+'&ndash;'+g(c.ltb.c1seg.xb/1000,2)+' m' : 'whole member')+"): M<sub>cr,standard</sub> = "+f1(c.ltb.McrStandard,1)+" kN&middot;m ("+(c.ltb.std&&c.ltb.std.route==='sn006a'? 'SN006a, C = ' : 'C<sub>1</sub> = ')+g(c.ltb.std?c.ltb.std.C1:0,3)+", "+(c.ltb.std?c.ltb.std.label:'')+(c.ltb.std&&c.ltb.std.LE? ", L<sub>E</sub> = "+g(c.ltb.std.LE/1000,2)+" m":"")+"); <b>M<sub>cr,eigen</sub> / M<sub>cr,standard</sub> = "+f1(c.ltb.McrRatio,2)+"</b>. The eigen value is the design basis; the ratio shows what the closed form would give with its tabulated C<sub>1</sub>, whole-segment L<sub>E</sub> and single z<sub>g</sub>.");
      else if(c.ltb&&c.ltb.std) notes.push("The standard closed-form M<sub>cr</sub> is not available for this arrangement ("+(c.ltb.std.label||'')+"), so no eigen/standard ratio is printed.");
      notes.push("Design basis for the LTB verdict: "+c.ltbBasis+".");
    }
    if(c.ax) notes.push("Axial + bending per EN 1993-1-1: cross-section by cl 6.2.9 ("+(c.ax.cls3?'elastic, Class 3':'plastic M<sub>N,Rd</sub>, Class 1/2')+"); "+(c.ax.tension
      ? "member buckling per cl 6.3.3 is not required because N<sub>Ed</sub> is tensile. Tension: N<sub>t,Rd</sub> = min(N<sub>pl,Rd</sub>, 0.9A<sub>net</sub>f<sub>u</sub>/&gamma;<sub>M2</sub>); the beneficial effect of tension on LTB is conservatively ignored"
      : "member buckling by cl 6.3.3 with Annex B Method 2 interaction factors (Table "+(c.buck&&c.buck.useB1?'B.1 &mdash; not susceptible to torsional deformation':'B.2 &mdash; susceptible')+", C<sub>m</sub> per Table B.3 from the governing moment diagram). Strut lengths: L<sub>cr,y</sub> = L<sub>E</sub>-factor &times; L"+(c.buck&&c.buck.lczFromRestraints?"; L<sub>cr,z</sub> = largest lateral-restraint spacing (SCI P360 6.2)":"; L<sub>cr,z</sub> = L<sub>E</sub>-factor &times; L")+". The destabilising &times;1.2 switch is an LTB concept and is NOT applied to strut buckling")+". N<sub>Ed</sub> is the direct design value (not run through the combinations). Validated against an independent commercial-software SHS beam-column worked example (C<sub>m</sub> 0.4, k<sub>zy</sub> 0.24, Eq 6.61 0.184, Eq 6.62 0.110).");
    if(c.coex&&!c.coex.pureShearFail) notes.push("Coexistent bending and shear are verified at every section along the span per cl 6.2.8(3) (rolled I/H, Class 1/2): where V<sub>Ed</sub> &gt; 0.5V<sub>pl"+((c.tor&&c.tor.VplTRd!=null)?",T":"")+",Rd</sub>, the moment is checked against the reduced M<sub>v,Rd</sub> = (W<sub>pl,y</sub> &minus; &rho;A<sub>v</sub>&sup2;/4t<sub>w</sub>)f<sub>y</sub>.");
    if(!(c.ltb&&c.ltb.na)) notes.push("&chi;<sub>LT</sub> uses &lambda;&#772;<sub>LT,0</sub>=0.4, &beta;=0.75 and buckling curve per NA 2.17 (Table 6.3: h/b&le;2 &rarr; b; 2&lt;h/b&le;3.1 &rarr; c; h/b&gt;3.1 &rarr; d); &chi;<sub>LT,mod</sub>=&chi;<sub>LT</sub>/f with k<sub>c</sub>=1/&radic;C<sub>1</sub> (NA 2.18), where C<sub>1</sub> is "+(mcrStd? "the tabulated/derived value used for M<sub>cr</sub>" : "back-calculated from the shape-only eigen result for k<sub>c</sub> only")+". The design strength f<sub>y</sub> from the flange thickness is used consistently in every expression, including Eq 6.56.");
  } else if(S.code==='BS5950'){
  if(c.shearBuckle) notes.push("d/t &gt; 70e   shear buckling must be checked (cl 4.2.3 / 4.4.5); not covered here (none of the tabulated sections normally reach this limit).");
  if(c.hsNote) notes.push(c.hsNote+".");
  if(c.n>0.1 && !sec.isBox && sec.kind==='I') notes.push(`Significant axial load   the reduced plastic modulus S<sub>rx</sub> uses the standard web-area formula for an equal-flanged I/H section.`);
  if(sec.isBox && S.family==='shs') notes.push(`Closed square section: the BS box-section LTB calculation gives ?<sub>LT</sub> 0 and p<sub>b</sub>=p<sub>y</sub>, so M<sub>b</sub> is governed by M<sub>cx</sub>.`);
  if(sec.isBox && S.family==='rhs') notes.push(`RHS lateral torsional buckling now uses the BS box-section ?<sub>LT</sub>=2.25v(F<sub>b</sub>? <sub>w</sub>) calculation rather than the previous rough Table 15 screen.`);
  if(sec.isBox && S.family==='shs') notes.push(`Strut curve: ${sec.boxType==='CF'?'cold-formed ? curve c (a=5.5)':'hot-finished ? curve a (a=2.0)'} per Table 23, both axes (r<sub>x</sub>=r<sub>y</sub> for a square section). Override in "Robertson const." if a different curve applies.`);
  if(sec.isBox && S.family==='rhs') notes.push(`Strut curve: hot-finished box section ? curve a (a=2.0) per Table 23, both axes. Note r<sub>x</sub>?r<sub>y</sub> for a true RHS, so P<sub>c</sub> and P<sub>cy</sub> genuinely differ even though the curve is the same both ways. Override in "Robertson const." if a different curve applies.`);
  if(S.family==='ub') notes.push(`Strut curve (Table 23, rolled I-section): x-x curve ${sec.tf<=40?'a (a=2.0)':'b (a=3.5)'}, y-y curve ${sec.tf<=40?'b (a=3.5)':'c (a=5.5)'} for flange thickness ${sec.tf<=40?'=':'>'}40&nbsp;mm. Override per-axis in "Robertson const." if a different curve applies.`);
  if(S.family==='uc') notes.push(`Strut curve (Table 23, rolled H-section): x-x curve ${sec.tf<=40?'b (a=3.5)':'c (a=5.5)'}, y-y curve ${sec.tf<=40?'c (a=5.5)':'d (a=8.0)'} for flange thickness ${sec.tf<=40?'=':'>'}40&nbsp;mm   one curve lower than a rolled I-section at the same thickness. Override per-axis in "Robertson const." if a different curve applies.`);
  if(sec.kind==='channel') notes.push(`Strut curve: BS&nbsp;5950 directs channel struts to Table 25 (a distinct method from the generic curve a d system). PFC compression is blocked from PASS unless verified Table&nbsp;25/Blue Book data is implemented.`);
  notes.push("Minor-axis bending M<sub>y</sub> = 0 in this single-plane solver, so m<sub>y</sub> = m<sub>yx</sub> = 1.");
  } else {
    // EC3 notes
    if(c.hsNote) notes.push(c.hsNote+".");
    if(c.shearBuckle) notes.push("h<sub>w</sub>/t &gt; 72e/?   web shear-buckling resistance should be checked per EN&nbsp;1993-1-5; not covered here.");
    if(c.awNote) notes.push("Significant axial load   M<sub>N,Rd</sub> uses the EC3 cl&nbsp;6.2.9.1 reduction for covered I/H/box section families.");
    if(sec.isBox) notes.push(`Box sections are not susceptible to lateral torsional buckling (cl&nbsp;6.3.2.1(2), doubly symmetric closed section)   M<sub>b,Rd</sub> is taken as the full M<sub>c,Rd</sub>.`);
    if(!sec.isBox) notes.push(`Buckling curve ${c.curveInfo.curve} (a<sub>LT</sub>=${c.curveInfo.alphaLT}) per Table&nbsp;6.5 (cl&nbsp;6.3.2.3, rolled/equivalent-welded method)${sec.kind==='channel'?'   channels are not explicitly listed in Table 6.5, so curve d (the default for unlisted sections) is used':''}.`);
    if(!sec.isBox) notes.push(`C<sub>1</sub>: ${c.c1method}.`);
    if(sec.kind==='channel') notes.push(`PFC warping constant I<sub>w</sub> is now the tabulated Blue Book value, but EC3 PFC LTB is still blocked because the M<sub>cr</sub> expression must include channel shear-centre/load-position terms to be design-grade.`);
    notes.push(`Member-buckling interaction (cl&nbsp;6.3.3) uses Annex&nbsp;B, Method&nbsp;2. C<sub>my</sub>=C<sub>mz</sub>=C<sub>mLT</sub> use ${c.cmMethod}; minor-axis bending M<sub>z</sub>=0 in this single-plane solver.`);
  }

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

  function classBlockEC3fn(){ return sec.isBox ? `
  <div class="section-title">Classification (EN 1993-1-1 Table 5.2)</div>
  <div class="props">
    <div>Section (${g(sec.mass,1)} kg/m)</div><div>${sname(sec.key)} ${famLabel} [${S.grade}]  D=${g(sec.D,0)} B=${g(sec.B,0)} t=${g(sec.tf,1)} mm</div><div></div><div></div>
    <div>e = v(235/f<sub>y</sub>)</div><div>v(235/${g(a.py,0)})</div><div class="right">${g(c.eps,3)}</div><div></div>
    <div>Flange (internal, compression) b/t = ${g(sec.bT,2)}</div><div>limit ${g(c.cl.flim[0],0)}e=${g(c.cl.flim[0]*c.eps,1)} (Cl.1) / ${g(c.cl.flim[1],0)}e / ${g(c.cl.flim[2],0)}e</div><div class="right">Class ${c.cl.fc}</div><div class="right">Class ${c.cl.fc}</div>
    <div>Web (internal, bending) d/t = ${g(sec.dt,2)}</div><div>limit ${g(c.cl.wlim[0],0)}e=${g(c.cl.wlim[0]*c.eps,1)} (Cl.1) / ${g(c.cl.wlim[1],0)}e / ${g(c.cl.wlim[2],0)}e</div><div class="right">Class ${c.cl.wc}</div><div class="right">Class ${c.cl.wc}</div>
    <div>Class = max(flange, web)   Table 5.2</div><div>${g(sec.bT,2)}, ${g(sec.dt,2)}, f<sub>y</sub>=${g(a.py,0)}</div><div class="right"></div><div class="right"><b>${c.clsName}</b></div>
  </div>` : `
  <div class="section-title">Classification (EN 1993-1-1 Table 5.2)</div>
  <div class="props">
    <div>Section (${g(sec.mass,1)} kg/m)</div><div>${sname(sec.key)} ${famLabel} [${S.grade}]</div><div></div><div></div>
    <div>e = v(235/f<sub>y</sub>)</div><div>v(235/${g(a.py,0)})</div><div class="right">${g(c.eps,3)}</div><div></div>
    <div>Outstand flange b/t = ${g(sec.bT,2)}</div><div>limit 9e=${g(9*c.eps,1)} (Cl.1) / 10e / 14e</div><div class="right">Class ${c.cl.fc}</div><div class="right">Class ${c.cl.fc}</div>
    <div>Internal web (bending) d/t = ${g(sec.dt,2)}</div><div>limit 72e=${g(72*c.eps,1)} (Cl.1) / 83e / 124e</div><div class="right">Class ${c.cl.wc}</div><div class="right">Class ${c.cl.wc}</div>
    <div>Class = max(flange, web)   Table 5.2</div><div>${g(sec.bT,2)}, ${g(sec.dt,2)}, f<sub>y</sub>=${g(a.py,0)}</div><div class="right"></div><div class="right"><b>${c.clsName}</b></div>
  </div>`; }
  function classBlockSCIfn(){ if(sec.isBox) return classBlockEC3fn(); return `
  <div class="section-title">Classification of Cross-Section (EN 1993-1-1 Table 5.2)</div>
  <div class="props">
    <div>Section (${g(sec.mass,1)} kg/m)</div><div>${sname(sec.key)} ${famLabel} [${S.grade}]&nbsp; h=${g(sec.D,1)}, b=${g(sec.B,1)}, t<sub>w</sub>=${g(sec.tw,1)}, t<sub>f</sub>=${g(sec.tf,1)}, r=${g(sec.r,1)} mm</div><div></div><div></div>
    <div>Nominal yield strength f<sub>y</sub> (Table 5.1 / BS EN 10025-2)</div><div>t<sub>f</sub> = ${g(sec.tf,1)} mm ${sec.tf<=16?'(t &le; 16)':sec.tf<=40?'(16 &lt; t &le; 40)':'(t &gt; 40 &mdash; consult the Standard)'}</div><div class="right">${g(a.py,0)} N/mm&sup2;</div><div class="right">f<sub>u</sub> = ${g(fuFromGrade(S.grade),0)}</div>
    <div>&epsilon; = &radic;(235/f<sub>y</sub>)</div><div>&radic;(235/${g(a.py,0)})</div><div class="right">${g(c.eps,2)}</div><div></div>
    ${c.cOut!=null? `<div>Outstand flange: c = (b &minus; t<sub>w</sub> &minus; 2r)/2</div><div>(${g(sec.B,1)} &minus; ${g(sec.tw,1)} &minus; 2&times;${g(sec.r,1)})/2</div><div class="right">${g(c.cOut,1)} mm</div><div></div>`:''}
    <div>c/t<sub>f</sub> = ${g(sec.bT,2)}</div><div>Class 1 limit: 9&epsilon; = 9&times;${g(c.eps,2)} = ${g(9*c.eps,2)}</div><div class="right">${g(sec.bT,2)} ${sec.bT<=9*c.eps?'&lt;':'&gt;'} ${g(9*c.eps,2)}</div><div class="right">Class ${c.cl.fc}</div>
    <div>Web: c = d = ${g(sec.d,1)} mm; c/t<sub>w</sub> = ${g(sec.dt,2)}</div><div>${c.cl.webCase==='bending+compression'
      ? `bending + compression (Table 5.2): &alpha; = ${g(c.cl.alphaW,3)}, &psi; = ${g(c.cl.psiW,2)}; limits ${g(c.cl.wlim[0],1)}&epsilon; / ${g(c.cl.wlim[1],1)}&epsilon; / ${g(c.cl.wlim[2],1)}&epsilon;`
      : `Class 1 limit: 72&epsilon; = 72&times;${g(c.eps,2)} = ${g(72*c.eps,2)}`}</div><div class="right">${g(sec.dt,2)} ${sec.dt<=c.cl.wlim[0]*c.eps?'&lt;':'&gt;'} ${g(c.cl.wlim[0]*c.eps,2)}</div><div class="right">Class ${c.cl.wc}</div>
    <div>Section class under pure bending</div><div>max(flange, web)</div><div class="right"></div><div class="right"><b>${c.clsName}</b></div>
  </div>`; }
  const classBlock = (sci||sciU)? classBlockSCIfn() : S.code==='EC3'? classBlockEC3fn() : classBlockBSfn();

  function ltbBlockBSfn(){ return sec.isBox ? `
  <div class="section-title smallgap">Lateral Torsional Buckling (Cl. 4.3.6.1${S.family==='rhs'?' / Table 15':''})</div>
  <div class="calc-block">
    <div>? = L<sub>E</sub>/r<sub>y</sub></div><div class="formula">${f1(c.LE,0)} / ${g(sec.ry*10,1)}</div><div class="value">${f1(c.lam,2)}</div><div></div>
    <div>F<sub>b</sub> = v(S<sub>x</sub> ?'/(AJ))</div><div class="formula">?'=(1-I<sub>y</sub>/I<sub>x</sub>)(1-J/(2.6I<sub>x</sub>))</div><div class="value">${f1(c.phiB,3)}</div><div></div>
    <div> <sub>w</sub></div><div class="formula">${c.cl.cls<=2?'Class 1/2 ? 1.0':'Z<sub>x</sub>/S<sub>x</sub>'}</div><div class="value">${g(c.betaW,3)}</div><div></div>
    <div>?<sub>LT</sub> = 2.25v(F<sub>b</sub>? <sub>w</sub>)</div><div class="formula">2.25v(${f1(c.phiB,3)} ${f1(c.lam,2)} ${g(c.betaW,3)})</div><div class="value">${f1(c.lamLT,2)}</div><div></div>
    <div>p<sub>b</sub> = Fn(p<sub>y</sub>, ?<sub>LT</sub>)</div><div class="formula">?<sub>L0</sub> = ${f1(c.lamL0,1)}</div><div class="value">${f1(c.pb,1)} N/mm </div><div class="status">Annex B</div>
    <div>M<sub>b</sub> = ${c.cl.cls<=2?'S':'Z'}<sub>x</sub> p<sub>b</sub> = M<sub>cx</sub></div><div class="formula">${g(c.cl.cls<=2?sec.Sx:sec.Zx,1)} ${f1(c.pb,1)}</div><div class="value">${f1(c.Mb,2)} kN m</div>${st(c.ltbUtil<=1,'OK')}
  </div>` : `
  <div class="section-title smallgap">Lateral Torsional Buckling   M<sub>b</sub> (Cl. 4.3 / Annex B)</div>
  <div class="calc-block">
    <div>L<sub>E</sub> = ${g(S.leFactor,2)}${S.destab?'   1.2':''} L</div><div class="formula">${g(S.leFactor,2)}${S.destab?' 1.2':''} ${g(S.L,3)} m</div><div class="value">${g(c.LE/1000,3)} m</div><div></div>
    <div>? = L<sub>E</sub> / r<sub>y</sub></div><div class="formula">${f1(c.LE,0)} / ${g(sec.ry*10,1)}</div><div class="value">${f1(c.lam,2)}</div><div></div>
    <div>v = 1/[1+0.05(?/x) ]<sup> </sup></div><div class="formula">x = ${g(sec.x,1)} (torsional index)</div><div class="value">${g(c.v,3)}</div><div class="status">N=0.5</div>
    <div> <sub>w</sub></div><div class="formula">${c.cl.cls<=2?'Class 1/2 ? 1.0':'Z<sub>x</sub>/S<sub>x</sub>'}</div><div class="value">${g(c.betaW,3)}</div><div></div>
    <div>?<sub>LT</sub> = u v ? v <sub>w</sub></div><div class="formula">${g(sec.u,3)} ${g(c.v,3)} ${f1(c.lam,2)} v${g(c.betaW,2)}</div><div class="value">${f1(c.lamLT,2)}</div><div></div>
    <div>p<sub>b</sub> = Fn(p<sub>y</sub>, ?<sub>LT</sub>)</div><div class="formula">?<sub>L0</sub> = ${f1(c.lamL0,1)} ${c.lamLT<=c.lamL0?'(?<sub>LT</sub>=?<sub>L0</sub> ? p<sub>b</sub>=p<sub>y</sub>)':'(Perry, Annex B.2)'}</div><div class="value">${f1(c.pb,1)} N/mm </div><div class="status">Annex B</div>
    <div>M<sub>b</sub> = ${c.cl.cls<=2?'S':'Z'}<sub>x</sub> p<sub>b</sub> = M<sub>cx</sub></div><div class="formula">${g(c.cl.cls<=2?sec.Sx:sec.Zx,1)} ${f1(c.pb,1)}</div><div class="value">${f1(c.Mb,2)} kN m</div><div></div>
    <div>m<sub>LT</sub>M<sub>x</sub> = M<sub>b</sub> (cl 4.3.6.2)</div><div class="formula">${g(c.mLT,3)} ${f1(c.Mx,1)} / ${f1(c.Mb,2)}</div><div class="value">${g(c.ltbUtil,3)}</div>${st(c.ltbUtil<=1,'OK')}
  </div>`; }

  function ltbBlockEC3fn(){ return sec.isBox ? `
  <div class="section-title smallgap">Lateral Torsional Buckling (Cl. 6.3.2.1(2))</div>
  <div class="calc-block">
    <div>LTB check</div><div class="formula">Doubly symmetric closed section   not susceptible to LTB</div><div class="value"> </div><div class="status">cl 6.3.2.1(2)</div>
    <div>M<sub>b,Rd</sub> = M<sub>c,Rd</sub></div><div class="formula">Full moment resistance used directly</div><div class="value">${f1(c.MbRd,2)} kN m</div>${st(c.ltbUtil<=1,'OK')}
  </div>` : `
  <div class="section-title smallgap">Lateral Torsional Buckling   M<sub>b,Rd</sub> (Cl. 6.3.2.2/6.3.2.3)</div>
  <div class="calc-block">
    <div>L<sub>cr</sub> = ${g(S.leFactor,2)}${S.destab?'   1.2':''} L</div><div class="formula">${g(S.leFactor,2)}${S.destab?' 1.2':''} ${g(S.L,3)} m</div><div class="value">${g(c.LE/1000,3)} m</div><div></div>
    <div>C<sub>1</sub></div><div class="formula" style="font-size:12.5px">${c.c1method}</div><div class="value">${g(c.C1,3)}</div><div class="status">NCCI SN003</div>
    <div>M<sub>cr</sub> = C<sub>1</sub>(p EI<sub>z</sub>/L )v[I<sub>w</sub>/I<sub>z</sub>+L GI<sub>t</sub>/(p EI<sub>z</sub>)]</div><div class="formula">I<sub>z</sub>=${g(sec.Iy,0)} cm4, I<sub>t</sub>=${g(sec.J,2)} cm4, I<sub>w</sub>=${g(sec.Iw,4)} dm6</div><div class="value">${f1(c.Mcr,2)} kN m</div><div></div>
    <div>?<sub>LT</sub> = v(W<sub>y</sub>f<sub>y</sub>/M<sub>cr</sub>)</div><div class="formula">v(${g(c.cl.cls<=2?sec.Sx:sec.Zx,1)} ${g(a.py,0)}/${f1(c.Mcr,2)})</div><div class="value">${f1(c.lamLT,3)}</div><div></div>
    <div>Buckling curve (Table 6.5)</div><div class="formula">${sec.kind==='I'?`rolled I-section, h/B=${(sec.D/sec.B).toFixed(2)}`:'not listed in Table 6.5 ? curve d'}</div><div class="value">curve ${c.curveInfo.curve} (a<sub>LT</sub>=${c.curveInfo.alphaLT})</div><div></div>
    <div>?<sub>LT</sub> = 1/(F+v(F - ?<sub>LT</sub> ))</div><div class="formula">UK NA: ?<sub>LT,0</sub>=0.4,  =0.75</div><div class="value">${f1(c.chiLT,3)}</div><div></div>
    <div>k<sub>c</sub>=1/vC<sub>1</sub>; f=1-0.5(1-k<sub>c</sub>)[1-2(?<sub>LT</sub>-0.8) ]</div><div class="formula">k<sub>c</sub>=${f1(c.kc,3)}</div><div class="value">f=${f1(c.fmod,3)}</div><div class="status">cl 6.3.2.3</div>
    <div>?<sub>LT,mod</sub> = ?<sub>LT</sub>/f = 1.0</div><div class="formula">${f1(c.chiLT,3)}/${f1(c.fmod,3)}</div><div class="value">${f1(c.chiLTmod,3)}</div><div></div>
    <div>M<sub>b,Rd</sub> = ?<sub>LT,mod</sub>W<sub>y</sub>f<sub>y</sub>/?<sub>M1</sub> = M<sub>c,Rd</sub></div><div class="formula">${f1(c.chiLTmod,3)} ${g(c.cl.cls<=2?sec.Sx:sec.Zx,1)} ${g(a.py,0)}</div><div class="value">${f1(c.MbRd,2)} kN m</div>${st(c.ltbUtil<=1,'OK')}
  </div>`; }
  const LT=c.ltb||{};
  // MasterSeries-style C1 line for the standard method:
  //   C1 = fn(M1, M2, Mo, psi, mu) | M1, M2, Mo, psi, mu - derivation | C1 | route tag
  const C1_ROUTE_TAG={uniform:'uniform load',point:'central point load','end-moment':'end-moment gradient',serna:'Serna general',sn006a:'cantilever SN006a',channel:'channel',box:'closed section',override:'user override',negligible:'negligible M',cantilever:'cantilever'};
  const c1LineStd=()=>{ const ci=LT.c1in; if(!ci) return '';
    const isC=!!LT.cant, sym=isC?'C':'C<sub>1</sub>';
    const segTxt=(LT.c1seg&&LT.c1seg.whole===false)? ' [segment '+g(LT.c1seg.xa/1000,2)+'&ndash;'+g(LT.c1seg.xb/1000,2)+' m]' : '';
    return `<div>${sym} = fn(M<sub>1</sub>, M<sub>2</sub>, M<sub>o</sub>, &psi;, &mu;)${isC?' &rarr; SN006a C = fn(&kappa;<sub>wt</sub>, &eta;)':''}</div><div class="formula">${f1(ci.M1,1)}, ${f1(ci.M2,1)}, ${f1(ci.Mo,1)}, ${f1(ci.psi,3)}, ${f1(ci.mu,3)}${segTxt} &mdash; ${LT.c1label||c.c1label}</div><div class="value">${sym} = ${g(LT.C1show!=null?LT.C1show:c.C1,3)}</div><div class="status">${C1_ROUTE_TAG[LT.c1route]||LT.c1route||''}</div>`; };
  const stdHead='M<sub>cr</sub> method: STANDARD closed form';
  const sciUltbBlocks = !sciU? '' : LT.na? `
  <div class="section-title smallgap">Equivalent Uniform Moment Factor C<sub>1</sub> (${stdHead})</div>
  <div class="calc-block">${c1LineStd()}</div>
  <div class="section-title smallgap">Buckling Resistance (Cl. 6.3.2, SN003a &mdash; warping neglected for a closed section; ${stdHead})</div>
  <div class="calc-block">
    <div>&pi;&sup2;EI<sub>z</sub>/L&sup2;</div><div class="formula">&pi;&sup2;&times;${g(a.E,0)}&times;${g(sec.Iy,0)}&times;10<sup>4</sup>/${g(c.LE,0)}&sup2;</div><div class="value">${f1(LT.T1,0)} kN</div><div></div>
    <div>M<sub>cr</sub> = C<sub>1</sub>(&pi;&sup2;EI<sub>z</sub>/L&sup2;)&radic;[L&sup2;GI<sub>t</sub>/(&pi;&sup2;EI<sub>z</sub>)]</div><div class="formula">C<sub>1</sub> = ${g(c.C1,3)}; G = 81000; I<sub>t</sub> = ${g(sec.J,0)} cm<sup>4</sup></div><div class="value">${f1(LT.Mcr,0)} kN&middot;m</div><div></div>
    <div>&lambda;&#772;<sub>LT</sub> = &radic;(W<sub>y</sub>f<sub>y</sub>/M<sub>cr</sub>)</div><div class="formula">&radic;(${g(c.cl.cls<=2?sec.Sx:sec.Zx,0)}&times;10&sup3;&times;${g(a.py,0)}/${f1(LT.Mcr,0)}&times;10<sup>6</sup>)</div><div class="value">${f1(LT.lamLTmcr,2)}</div><div></div>
    ${LT.ignM? `<div>&lambda;&#772;<sub>LT</sub> &lt; &lambda;&#772;<sub>LT,0</sub> = 0.4 (NA 2.17)</div><div class="formula">${f1(LT.lamLTmcr,2)} &lt; 0.4 &mdash; lateral&ndash;torsional buckling effects may be ignored (cl 6.3.2.2(4))</div><div class="value">&chi;<sub>LT,mod</sub> = 1.000</div><div class="status ok">Ignored</div>` : `<div>&Phi;<sub>LT</sub>; &chi;<sub>LT</sub>; f; &chi;<sub>LT,mod</sub> (curve d)</div><div class="formula">&Phi;=${g(LT.PhiM,3)}; &chi;<sub>LT</sub>=${g(LT.chiM,3)}; f=${g(LT.fM,3)}</div><div class="value">&chi;<sub>LT,mod</sub> = ${g(LT.chiModM,3)}</div><div></div>`}
    <div>M<sub>b,Rd</sub></div><div class="formula">${LT.ignM?'= M<sub>c,Rd</sub>':'&chi;<sub>LT,mod</sub>W<sub>y</sub>f<sub>y</sub>/&gamma;<sub>M1</sub>'}</div><div class="value">${f1(LT.MbRd,1)} kN&middot;m</div>${st(c.ltbUtil<=1,'OK')}
  </div>` : LT.cant? `
  <div class="section-title smallgap">Equivalent Uniform Moment Factor C (${stdHead})</div>
  <div class="calc-block">${c1LineStd()}</div>
  <div class="section-title smallgap">Lateral&ndash;Torsional Buckling &mdash; Cantilever (NCCI SN006a-EN-EU; ${stdHead})</div>
  <div class="calc-block">
    <div>M<sub>cr,0</sub> = (&pi;/L)&radic;(EI<sub>z</sub>GI<sub>t</sub>)</div><div class="formula">L = ${g(S.L,2)} m; SN006a boundary conditions &mdash; L<sub>E</sub> factor and destabilising switch not applied</div><div class="value">${f1(LT.Mcr0,1)} kN&middot;m</div><div></div>
    <div>&kappa;<sub>wt</sub> = (1/L)&radic;(EI<sub>w</sub>/GI<sub>t</sub>)</div><div class="formula">warping at root: ${LT.warp==='restr'? 'restrained':'free'}</div><div class="value">${g(LT.kwt,3)}</div><div></div>
    <div>&eta; = z<sub>a</sub>/(h<sub>s</sub>/2)</div><div class="formula">z<sub>a</sub> = ${g(S.za||0,0)} mm; h<sub>s</sub> = h &minus; t<sub>f</sub> = ${g(sec.D-sec.tf,1)} mm</div><div class="value">${g(LT.eta,2)}</div><div></div>
    ${LT.C>0? `<div>C &mdash; ${LT.caseLbl}</div><div class="formula">${LT.Cq!=null&&LT.CF!=null? 'C<sub>q</sub> = '+g(LT.Cq,2)+'; C<sub>F</sub> = '+g(LT.CF,2)+'; M<sub>q</sub> = '+f1(Math.abs(LT.Mq),1)+', M<sub>F</sub> = '+f1(Math.abs(LT.MF),1)+' kN&middot;m; Eq (7)':'Tables 3.1&ndash;3.3, bilinear interpolation'}</div><div class="value">${g(LT.C,2)}</div><div></div>
    <div>M<sub>cr</sub> = C&middot;M<sub>cr,0</sub></div><div class="formula">${g(LT.C,2)} &times; ${f1(LT.Mcr0,1)}</div><div class="value">${f1(LT.Mcr,1)} kN&middot;m</div><div></div>
    <div>&lambda;&#772;<sub>LT</sub>; &chi;<sub>LT</sub> (curve ${LT.curve.curve})</div><div class="formula">&lambda;&#772; = ${f1(LT.lamLTmcr,2)}${LT.ignM? ' &le; 0.4 &mdash; LTB ignored (cl 6.3.2.2(4))':''}</div><div class="value">&chi; = ${g(LT.chiM,3)}</div><div></div>
    <div>M<sub>b,Rd</sub> = &chi;<sub>LT</sub>W<sub>y</sub>f<sub>y</sub>/&gamma;<sub>M1</sub></div><div class="formula">${g(LT.chiM,3)}&times;${g(c.cl.cls<=2?sec.Sx:sec.Zx,0)}&times;${g(a.py,0)}/1.0</div><div class="value">${f1(LT.MbRd,1)} kN&middot;m</div><div></div>
    <div>M<sub>Ed</sub> / M<sub>b,Rd</sub></div><div class="formula">${f1(c.Mx,1)} / ${f1(LT.MbRd,1)}</div><div class="value">${g(c.Mx/Math.max(LT.MbRd,1e-9),2)}</div>${st(c.Mx<=LT.MbRd*1.0001,'OK','exceeded')}` : `<div>C &mdash; ${LT.caseLbl}</div><div class="formula">see the NOT COVERED note</div><div class="value">&mdash;</div><div class="status fail">BLOCKED</div>`}
  </div>` : LT.channel? `
  <div class="section-title smallgap">Equivalent Uniform Moment Factor C<sub>1</sub> (${stdHead})</div>
  <div class="calc-block">${c1LineStd()}</div>
  <div class="section-title smallgap">Lateral&ndash;Torsional Buckling &mdash; Channel (P385/P362 chain; ${stdHead})</div>
  <div class="calc-block">
    <div>&lambda;&#772;<sub>LT</sub> = (L/i<sub>z</sub>)/${g(LT.kappa,0)} (${S.grade})</div><div class="formula">(${g(c.LE,0)}/${g(LT.ry,1)})/${g(LT.kappa,0)}</div><div class="value">${g(LT.lamLTmcr,3)}</div><div></div>
    ${LT.ignM? `<div>&lambda;&#772;<sub>LT</sub> &le; 0.4</div><div class="formula">LTB may be ignored (cl 6.3.2.2(4))</div><div class="value">&chi;<sub>LT</sub> = 1.000</div><div></div>` : `<div>&chi;<sub>LT</sub> (curve d, &alpha;<sub>LT</sub>=0.76; no f-factor)</div><div class="formula">&Phi; = ${g(LT.PhiM,3)}</div><div class="value">${g(LT.chiM,3)}</div><div></div>`}
    <div>M<sub>b,Rd</sub> = &chi;<sub>LT</sub>W<sub>pl,y</sub>f<sub>y</sub>/&gamma;<sub>M1</sub></div><div class="formula">${g(LT.chiM,3)}&times;${g(sec.Sx,0)}&times;${g(a.py,0)}/1.0</div><div class="value">${f1(LT.MbRd,1)} kN&middot;m</div><div></div>
    <div>M<sub>cr</sub> (back-calculated, for k<sub>&alpha;</sub>)</div><div class="formula">W<sub>y</sub>f<sub>y</sub>/&lambda;&#772;&sup2;</div><div class="value">${f1(LT.McrBack,1)} kN&middot;m</div><div></div>
    ${LT.chanMcr? `<div>M<sub>cr</sub> route (load through the shear centre)</div><div class="formula">zj = 0 for a channel bent about y-y &rarr; doubly-symmetric M<sub>cr</sub> valid; C<sub>1</sub> = ${g(c.C1,3)}</div><div class="value">M<sub>cr</sub> = ${f1(LT.chanMcr.Mcr,1)} kN&middot;m</div><div></div>
    <div>&lambda;&#772;; &chi; (curve d); f; &chi;<sub>mod</sub></div><div class="formula">${g(LT.chanMcr.lam,3)}; ${g(LT.chanMcr.chi,3)}; ${g(LT.chanMcr.f,3)}${LT.chanMcr.ign? ' (&lambda;&#772; &le; 0.4: LTB ignored)':''}</div><div class="value">&chi;<sub>mod</sub> = ${g(LT.chanMcr.chiMod,3)}</div><div></div>
    <div>M<sub>b,Rd</sub> (M<sub>cr</sub> route)</div><div class="formula">${g(LT.chanMcr.chiMod,3)}&times;${g(sec.Sx,0)}&times;${g(a.py,0)} &le; M<sub>c,Rd</sub></div><div class="value">${f1(LT.chanMcr.Mb,1)} kN&middot;m</div><div></div>` : ''}
    <div>M<sub>Ed</sub> / M<sub>b,Rd</sub></div><div class="formula">${f1(c.Mx,1)} / ${f1(LT.MbRd,1)}</div><div class="value">${g(c.Mx/Math.max(LT.MbRd,1e-9),2)}</div>${st(c.Mx<=LT.MbRd*1.0001,'OK','exceeded')}
  </div>` : `
  <div class="section-title smallgap">Equivalent Uniform Moment Factor C<sub>1</sub> (${stdHead})</div>
  <div class="calc-block">${c1LineStd()}
    <div>1/&radic;C<sub>1</sub> = k<sub>c</sub> (NA 2.18)</div><div class="formula">1/&radic;${g(c.C1,3)}</div><div class="value">${g(LT.invSqrtC1,3)}</div><div></div>
  </div>

  <div class="section-title smallgap">LTB &mdash; Non-Dimensional Slenderness, Simplified Method (P362 Expn 6.55)</div>
  <div class="calc-block">
    <div>&lambda;<sub>z</sub> = L/i<sub>z</sub></div><div class="formula">${g(c.LE,0)}/${g(LT.ry,1)}</div><div class="value">${f1(LT.lamZ,1)}</div><div></div>
    <div>&lambda;<sub>1</sub> = &pi;&radic;(E/f<sub>y</sub>)</div><div class="formula">&pi;&radic;(${g(a.E,0)}/${g(a.py,0)})</div><div class="value">${f1(LT.lam1,1)}</div><div></div>
    <div>&lambda;&#772;<sub>z</sub> = &lambda;<sub>z</sub>/&lambda;<sub>1</sub></div><div class="formula">${f1(LT.lamZ,1)}/${f1(LT.lam1,1)}</div><div class="value">${g(LT.lamZbar,3)}</div><div></div>
    <div>&radic;&beta;<sub>w</sub></div><div class="formula">${c.cl.cls<=2?'Class 1/2 &rarr; W<sub>y</sub>=W<sub>pl,y</sub> &rarr; 1.0':'&radic;(W<sub>el,y</sub>/W<sub>pl,y</sub>)'}</div><div class="value">${g(LT.rootBw,2)}</div><div></div>
    <div>&lambda;&#772;<sub>LT</sub> = (1/&radic;C<sub>1</sub>)&middot;0.9&middot;&lambda;&#772;<sub>z</sub>&middot;&radic;&beta;<sub>w</sub></div><div class="formula">${g(LT.invSqrtC1,2)}&times;0.9&times;${g(LT.lamZbar,3)}&times;${g(LT.rootBw,2)}</div><div class="value">${g(LT.lamLTsimp,2)}</div><div></div>
  </div>

  <div class="section-title smallgap">Reduction Factor for LTB (Cl. 6.3.2.3, NA 2.17 / NA 2.18)</div>
  <div class="calc-block">
    <div>Buckling curve (NA Table 6.3, rolled I/H)</div><div class="formula">h/b = ${g(sec.D,1)}/${g(sec.B,1)} = ${g(LT.hb,2)} &rarr; curve ${LT.curve.curve}</div><div class="value">&alpha;<sub>LT</sub> = ${g(LT.curve.alphaLT,2)}</div><div></div>
    ${LT.ignS? `<div>&lambda;&#772;<sub>LT</sub> &le; &lambda;&#772;<sub>LT,0</sub> = 0.4</div><div class="formula">LTB effects may be ignored (cl 6.3.2.2(4))</div><div class="value">&chi;<sub>LT,mod</sub> = 1.000</div><div></div>` : `
    <div>&Phi;<sub>LT</sub> = 0.5[1+&alpha;<sub>LT</sub>(&lambda;&#772;<sub>LT</sub>&minus;0.4)+0.75&lambda;&#772;<sub>LT</sub>&sup2;]</div><div class="formula">0.5[1+${g(LT.curve.alphaLT,2)}(${g(LT.lamLTsimp,2)}&minus;0.4)+0.75&times;${g(LT.lamLTsimp,2)}&sup2;]</div><div class="value">${g(LT.PhiS,3)}</div><div></div>
    <div>&chi;<sub>LT</sub> = 1/[&Phi;+&radic;(&Phi;&sup2;&minus;0.75&lambda;&#772;&sup2;)] &le; min(1, 1/&lambda;&#772;&sup2;)</div><div class="formula">1/&lambda;&#772;&sup2; = ${g(1/(LT.lamLTsimp*LT.lamLTsimp),3)}</div><div class="value">${g(LT.chiS,3)}</div><div></div>
    <div>k<sub>c</sub> = 1/&radic;C<sub>1</sub>;&nbsp; f = 1&minus;0.5(1&minus;k<sub>c</sub>)[1&minus;2(&lambda;&#772;<sub>LT</sub>&minus;0.8)&sup2;] &le; 1</div><div class="formula">k<sub>c</sub> = ${g(LT.kc,2)}</div><div class="value">f = ${g(LT.fS,3)}</div><div></div>
    <div>&chi;<sub>LT,mod</sub> = &chi;<sub>LT</sub>/f</div><div class="formula">${g(LT.chiS,3)}/${g(LT.fS,3)}</div><div class="value">${g(LT.chiModS,3)}</div><div></div>`}
    <div>M<sub>b,Rd</sub> = &chi;<sub>LT,mod</sub>&middot;W<sub>${c.cl.cls<=2?'pl':'el'},y</sub>&middot;f<sub>y</sub>/&gamma;<sub>M1</sub></div><div class="formula">${g(LT.ignS?1:LT.chiModS,3)}&times;${g(c.cl.cls<=2?sec.Sx:sec.Zx,0)}&times;${g(a.py,0)}/1.0</div><div class="value">${f1(LT.MbSimp,0)} kN&middot;m</div><div></div>
    <div>M<sub>Ed</sub> / M<sub>b,Rd</sub></div><div class="formula">${f1(c.Mx,1)} / ${f1(LT.MbSimp,0)}</div><div class="value">${g(c.Mx/Math.max(LT.MbSimp,1e-9),2)}</div>${st(c.Mx<=LT.MbSimp*1.0001,'OK','exceeded')}
  </div>

  <div class="section-title smallgap">LTB &mdash; Elastic Critical Moment, ${stdHead} (SN003a; ${LT.zgUsed? 'C<sub>2</sub>z<sub>g</sub> term applied' : 'z<sub>g</sub>=0'}, k=k<sub>w</sub>=1, G=81000 N/mm&sup2;; FE eigensolver not run)</div>
  <div class="calc-block">
    <div>&pi;&sup2;EI<sub>z</sub>/L&sup2;</div><div class="formula">&pi;&sup2;&times;${g(a.E,0)}&times;${g(sec.Iy,0)}&times;10<sup>4</sup>/${g(c.LE,0)}&sup2;</div><div class="value">${f1(LT.T1,0)} kN</div><div></div>
    <div>I<sub>w</sub>/I<sub>z</sub></div><div class="formula">${g((sec.Iw||0)*1e6,0)} cm<sup>6</sup> / ${g(sec.Iy,0)} cm<sup>4</sup></div><div class="value">${f1(LT.IwIz,1)} cm&sup2;</div><div></div>
    <div>GI<sub>t</sub></div><div class="formula">81000&times;${g(sec.J,0)}&times;10<sup>4</sup></div><div class="value">${f1(LT.GIt,2)} kN&middot;m&sup2;</div><div></div>
    ${LT.zgUsed? `<div>Load height (SN003a): z<sub>g</sub>, C<sub>2</sub></div><div class="formula">z<sub>g</sub> = ${g(LT.zg,0)} mm above the shear centre; C<sub>2</sub> = ${g(LT.C2,3)} &rarr; M<sub>cr</sub> term {&radic;(&hellip;+(C<sub>2</sub>z<sub>g</sub>)&sup2;) &minus; C<sub>2</sub>z<sub>g</sub>}</div><div class="value">C<sub>2</sub>z<sub>g</sub> = ${g(LT.C2*LT.zg,1)} mm</div><div></div>`:''}
    <div>M<sub>cr</sub> = C<sub>1</sub>(&pi;&sup2;EI<sub>z</sub>/L&sup2;)&radic;[I<sub>w</sub>/I<sub>z</sub> + GI<sub>t</sub>/(&pi;&sup2;EI<sub>z</sub>/L&sup2;)]${LT.zgUsed? ' with the C<sub>2</sub>z<sub>g</sub> term':''}</div><div class="formula">${g(c.C1,3)}&times;${f1(LT.T1,0)}&times;&radic;[${g(LT.IwIz/1e4,5)}+${g(LT.GIt/LT.T1,5)}] m</div><div class="value">${f1(LT.Mcr,1)} kN&middot;m</div><div></div>
    <div>&lambda;&#772;<sub>LT</sub> = &radic;(W<sub>y</sub>f<sub>y</sub>/M<sub>cr</sub>)</div><div class="formula">&radic;(${g(c.cl.cls<=2?sec.Sx:sec.Zx,0)}&times;10&sup3;&times;${g(a.py,0)}/${f1(LT.Mcr,1)}&times;10<sup>6</sup>)</div><div class="value">${f1(LT.lamLTmcr,2)}</div><div></div>
    ${LT.ignM? `<div>&lambda;&#772;<sub>LT</sub> &le; 0.4 &rarr; LTB may be ignored</div><div class="formula">cl 6.3.2.2(4)</div><div class="value">&chi;<sub>LT,mod</sub> = 1.000</div><div></div>` : `
    <div>&Phi;<sub>LT</sub>; &chi;<sub>LT</sub>; f; &chi;<sub>LT,mod</sub></div><div class="formula">&Phi;=${g(LT.PhiM,3)}; &chi;<sub>LT</sub>=${g(LT.chiM,3)}; f=${g(LT.fM,3)}</div><div class="value">&chi;<sub>LT,mod</sub> = ${g(LT.chiModM,3)}</div><div></div>`}
    <div>M<sub>b,Rd</sub> (M<sub>cr</sub> method)</div><div class="formula">${g(LT.ignM?1:LT.chiModM,3)}&times;${g(c.cl.cls<=2?sec.Sx:sec.Zx,0)}&times;${g(a.py,0)}/1.0</div><div class="value">${f1(LT.MbMcr,0)} kN&middot;m</div><div></div>
    <div>M<sub>Ed</sub> / M<sub>b,Rd</sub></div><div class="formula">${f1(c.Mx,1)} / ${f1(LT.MbMcr,0)}</div><div class="value">${g(c.Mx/Math.max(LT.MbMcr,1e-9),2)}</div>${st(c.Mx<=LT.MbMcr*1.0001,'OK','exceeded')}
  </div>`;
  const torsionCard = ((sci||sciU)&&c.tor)? `
  <div class="diagcard">
    <div class="dt">Torsional moment (kN&middot;m) &mdash; per-load shear-centre eccentricities (${a.tors.governT})</div>
    ${plot(a.tors.diag.xs,a.tors.diag.T,{color:'#7a4',fill:'#dcebc4',unit:'kN&middot;m',fmt:v=>f1(v,2)})}
    <div class="note" style="margin-left:0">All supports are assumed to prevent twist (fork supports); the torque diagram is drawn for the combination governing torsion.</div>
  </div>` : '';
  const ltbBlock = sci? `
  <div class="section-title smallgap">Lateral&ndash;Torsional Buckling (Cl. 6.3.2.1)</div>
  <div class="calc-block">
    <div>Restraint condition</div><div class="formula">Beam fully laterally restrained &mdash; compression flange held in position throughout its length</div><div class="value">LTB cannot occur</div><div class="status ok">Not required</div>
  </div>` : sciU? (mcrStd? sciUltbBlocks : ltbEigenReport(c,a,sec)) : ltbBlockBSfn();

  const sciAvFormula = sec.isBox? 'A<sub>v</sub> = AD/(D+B)'
    : sec.kind==='channel'? 'A<sub>v</sub> = A &minus; 2bt<sub>f</sub> + (t<sub>w</sub>+r)t<sub>f</sub>'
    : 'A<sub>v</sub> = A &minus; 2bt<sub>f</sub> + (t<sub>w</sub>+2r)t<sub>f</sub>';
  const sciAvNums = sec.isBox? `${g(sec.A*100,0)}&times;${g(sec.D,0)}/(${g(sec.D,0)}+${g(sec.B,0)})`
    : sec.kind==='channel'? `${g(sec.A*100,0)} &minus; 2&times;${g(sec.B,1)}&times;${g(sec.tf,1)} + (${g(sec.tw,1)}+${g(sec.r,1)})&times;${g(sec.tf,1)}`
    : `${g(sec.A*100,0)} &minus; 2&times;${g(sec.B,1)}&times;${g(sec.tf,1)} + (${g(sec.tw,1)}+2&times;${g(sec.r,1)})&times;${g(sec.tf,1)}`;
  const sciResistanceBlocks = (sci||sciU)? `
  <div class="section-title smallgap">Shear Resistance (Cl. 6.2.6)</div>
  <div class="calc-block">
    <div>${sciAvFormula}</div><div class="formula">${sciAvNums}</div><div class="value">${g(c.AvRaw!=null?c.AvRaw:c.Av,0)} mm&sup2;</div><div></div>
    ${c.avFloor!=null? `<div>but not less than &eta;h<sub>w</sub>t<sub>w</sub> (&eta;=1.0)</div><div class="formula">1.0&times;${g(c.hw,1)}&times;${g(sec.tw,1)} = ${g(c.avFloor,0)} mm&sup2;</div><div class="value">A<sub>v</sub> = ${g(c.Av,0)} mm&sup2;</div><div class="status ${c.AvRaw>=c.avFloor?'ok':''}">${c.AvRaw>=c.avFloor? g(c.AvRaw,0)+' &gt; '+g(c.avFloor,0) : 'floor governs'}</div>`:''}
    <div>V<sub>c,Rd</sub> = V<sub>pl,Rd</sub> = A<sub>v</sub>(f<sub>y</sub>/&radic;3)/&gamma;<sub>M0</sub></div><div class="formula">${g(c.Av,0)}&times;(${g(a.py,0)}/&radic;3)/1.0 &times;10<sup>&minus;3</sup></div><div class="value">${f1(c.VcRd,0)} kN</div><div></div>
    <div>V<sub>Ed</sub> / V<sub>c,Rd</sub> &le; 1.0</div><div class="formula">${f1(c.Fv,1)} / ${f1(c.VcRd,0)}</div><div class="value">${g(c.shearUtil,2)}</div>${st(c.shearUtil<=1,'OK')}
  </div>

  <div class="section-title smallgap">Shear Buckling (Cl. 6.2.6(6))</div>
  <div class="calc-block">
    <div>h<sub>w</sub>/t<sub>w</sub> &le; 72&epsilon;/&eta;</div><div class="formula">${sec.isBox? 'd/t = '+g(c.sbRatio,1) : g(c.hw,1)+'/'+g(sec.tw,1)+' = '+g(c.sbRatio,1)} vs 72&times;${g(c.eps,2)}/1.0 = ${g(c.sbLimit,1)}</div><div class="value">${g(c.sbRatio,1)} ${c.sbOk?'&lt;':'&gt;'} ${g(c.sbLimit,1)}</div>${st(c.sbOk,'Not required')}
  </div>

  ${c.tor&&c.tor.box? `
  <div class="section-title smallgap">Torsional Resistance (Cl. 6.2.7(7))</div>
  <div class="calc-block">
    <div>T<sub>Ed</sub> (max., @ x = ${g(a.tors.Tpos,2)} m)</div><div class="formula">T<sub>w,Ed</sub> neglected for hollow sections</div><div class="value">${f1(c.tor.TEd,1)} kN&middot;m</div><div></div>
    <div>W<sub>t</sub> (${c.tor.WtSrc})</div><div class="formula">I<sub>t</sub> = ${g(c.tor.ItShow/1e4,0)} cm<sup>4</sup></div><div class="value">${g(c.tor.Wt/1e3,0)} cm&sup3;</div><div></div>
    <div>T<sub>Rd</sub> = f<sub>y</sub>W<sub>t</sub>/(&radic;3&middot;&gamma;<sub>M0</sub>)</div><div class="formula">${g(a.py,0)}&times;${g(c.tor.Wt/1e3,0)}&times;10&sup3;/(&radic;3&times;1.0)</div><div class="value">${f1(c.tor.TRd,1)} kN&middot;m</div><div></div>
    <div>T<sub>Ed</sub> / T<sub>Rd</sub></div><div class="formula">${f1(c.tor.TEd,1)} / ${f1(c.tor.TRd,1)}</div><div class="value">${g(c.tor.torUtil,3)}</div>${st(c.tor.torUtil<=1,'OK')}
  </div>

  <div class="section-title smallgap">Shear and Torsion (Cl. 6.2.7(9), Eq 6.28)</div>
  <div class="calc-block">
    <div>&tau;<sub>t,Ed</sub> at governing V-T point</div><div class="formula">@ x = ${g(vtX,2)} m${vtCombo}: T = ${f1(vtT,2)} kN&middot;m; &tau;<sub>t,Ed</sub> = T/W<sub>t</sub></div><div class="value">${f1(vtTau,1)} N/mm&sup2;</div><div></div>
    <div>V<sub>pl,T,Rd</sub> = [1 &minus; &tau;<sub>t,Ed</sub>/((f<sub>y</sub>/&radic;3)/&gamma;<sub>M0</sub>)]&middot;V<sub>pl,Rd</sub></div><div class="formula">[1 &minus; ${f1(vtTau,1)}/${f1(a.py/Math.sqrt(3),1)}]&times;${f1(c.VcRd,0)}</div><div class="value">${f1(vtVpl,0)} kN</div><div></div>
    <div>V<sub>Ed</sub> / V<sub>pl,T,Rd</sub></div><div class="formula">${f1(vtV,1)} / ${f1(vtVpl,0)}</div><div class="value">${c.tor.vtZeroCapacity?'&infin;':g(c.tor.vtUtil,3)}</div>${st(!c.tor.vtZeroCapacity&&c.tor.vtUtil<=1,'OK')}
  </div>` : c.tor&&c.tor.p385? `
  <div class="section-title smallgap">Torsion Analysis &mdash; SCI P385 Method B (elastic; fork ends, warping free)</div>
  <div class="calc-block">
    <div>Torsional bending constant a = &radic;(EI<sub>w</sub>/GI<sub>T</sub>)</div><div class="formula">I<sub>T</sub> = ${g(c.tor.IT/1e4,1)} cm<sup>4</sup>; I<sub>w</sub> = ${g(c.tor.Iw/1e12,3)} dm<sup>6</sup> (P385 App A)</div><div class="value">a = ${f1(c.tor.aa/1000,2)} m; L/a = ${f1(c.tor.X,2)}</div><div></div>
    ${c.tor.e0!=null? `<div>Shear centre (channel)</div><div class="formula">e<sub>0</sub> = ${g(c.tor.e0,1)} mm from web centreline${c.tor.esc!=null? '; e<sub>sc</sub> = '+g(c.tor.esc,1)+' mm from centroid':''} &mdash; e measured from the shear centre</div><div class="value"></div><div></div>`:''}
    <div>T<sub>Ed</sub> (max. internal)</div><div class="formula">torque diagram by statics (fork ends)</div><div class="value">${f1(c.tor.TEd,2)} kN&middot;m</div><div></div>
    <div>Max rotation &phi; (ULS)</div><div class="formula">Cases 3/4/10 closed forms, superposed per combination</div><div class="value">${c.tor.phiUmax.toFixed(4)} rad = ${f1(c.tor.phiUmax*180/Math.PI,2)}&deg;</div><div></div>
    <div>Warping flange moment M<sub>w,Ed</sub> = EI<sub>w</sub>&phi;&Prime;/(h&minus;t<sub>f</sub>)</div><div class="formula">max over span</div><div class="value">${f1(c.tor.MwMax,2)} kN&middot;m</div><div></div>
    <div>Rotation-induced M<sub>z,Ed</sub> = &phi;&middot;M<sub>y,Ed</sub></div><div class="formula">max coincident value (mandatory, P385)</div><div class="value">${f1(c.tor.MzMax,2)} kN&middot;m</div><div></div>
    <div>End torque reactions T<sub>t</sub> (for connection design)</div><div class="formula">x = 0 / x = L</div><div class="value">${f1(Math.abs(c.tor.TtEnds[0]),2)} / ${f1(Math.abs(c.tor.TtEnds[1]),2)} kN&middot;m</div><div></div>
  </div>

  <div class="section-title smallgap">Bending + Torsion Cross-Section (P385 &sect;3.1.2${c.tor.cls12? ' &mdash; plastic, Class 1/2':' &mdash; elastic, Class 3'})</div>
  <div class="calc-block">
    <div>Resistances</div><div class="formula">M<sub>pl,y,Rd</sub> = ${f1(c.tor.Mply,0)}; M<sub>pl,z,Rd</sub> = ${f1(c.tor.Mplz,0)}; M<sub>pl,f,Rd</sub> = ${c.tor.chan? 'b&sup2;t<sub>f</sub>/4&middot;f<sub>y</sub>':'W<sub>pl,z</sub>/2&middot;f<sub>y</sub>'} = ${f1(c.tor.Mplf,1)} kN&middot;m</div><div class="value"></div><div></div>
    <div>${c.tor.cls12? '(M<sub>y</sub>/M<sub>pl,y</sub>)&sup2; + M<sub>w</sub>/M<sub>pl,f</sub> + M<sub>z</sub>/M<sub>pl,z</sub>':'M<sub>y</sub>/M<sub>el,y</sub> + M<sub>z</sub>/M<sub>el,z</sub> + M<sub>w</sub>/M<sub>f,Rd</sub>'}</div><div class="formula">@ x = ${g(c.tor.cross.x/1000,2)} m (${c.tor.cross.combo}): M<sub>y</sub>=${f1(c.tor.cross.My,1)}, M<sub>w</sub>=${f1(c.tor.cross.Mw,2)}, M<sub>z</sub>=${f1(c.tor.cross.Mz,2)} kN&middot;m</div><div class="value">${g(c.tor.cross.u,2)}</div>${st(c.tor.cross.u<=1.0001,'OK')}
  </div>

  <div class="section-title smallgap">Shear + Torsion (Cl. 6.2.7(9), Eq 6.2${c.tor.chan? '7':'6'})</div>
  <div class="calc-block">
    <div>&tau;<sub>t,Ed</sub>${c.tor.chan? '; &tau;<sub>w,Ed</sub>':''} at governing V-T point</div><div class="formula">@ x = ${g(vtX,2)} m${vtCombo}: V = ${f1(vtV,1)} kN, T<sub>t</sub> = ${f1(vtT,2)} kN&middot;m</div><div class="value">${f1(vtTauT,1)}${c.tor.chan? ' / '+f1(vtTauW,2):''} N/mm&sup2;</div><div></div>
    <div>V<sub>pl,T,Rd</sub> = ${c.tor.chan? '[&radic;(1&minus;&tau;<sub>t</sub>/(1.25f<sub>y</sub>/&radic;3)) &minus; &tau;<sub>w</sub>/(f<sub>y</sub>/&radic;3)]':'&radic;(1&minus;&tau;<sub>t</sub>/(1.25&middot;f<sub>y</sub>/&radic;3))'}&middot;V<sub>pl,Rd</sub></div><div class="formula">coincident sweep; V<sub>pl,Rd</sub> = ${f1(c.VcRd,0)} kN</div><div class="value">${f1(vtVpl,0)} kN</div><div></div>
    <div>V<sub>Ed</sub> / V<sub>pl,T,Rd</sub></div><div class="formula">${f1(vtV,1)} / ${f1(vtVpl,0)}</div><div class="value">${c.tor.vtZeroCapacity?'&infin;':g(c.tor.vtUtil,2)}</div>${st(!c.tor.vtZeroCapacity&&c.tor.vtUtil<=1,'OK')}
  </div>` : c.tor? `
  <div class="section-title smallgap">Torsion (Cl. 6.2.7)</div>
  <div class="calc-block">
    <div>T<sub>Ed</sub> (max., envelope)</div><div class="formula">torque from loads with e &ne; 0 (per-load eccentricities)</div><div class="value">${f1(c.tor.TEd,2)} kN&middot;m</div><div class="status fail">NOT COVERED</div>
    ${c.tor.tp? `<div>P385 torsional properties (Appendix A)</div><div class="formula">I<sub>T</sub> = ${g(c.tor.tp.IT,1)} cm<sup>4</sup>; I<sub>w</sub> = ${g(c.tor.tp.Iw,3)} dm<sup>6</sup>; a = ${g(c.tor.tp.a,2)} m; W<sub>n0</sub> = ${g(c.tor.tp.Wn0,1)} cm&sup2;; S<sub>w1</sub> = ${g(c.tor.tp.Sw1,0)} cm<sup>4</sup>${c.tor.tp.Wn2!=null? '; W<sub>n2</sub> = '+g(c.tor.tp.Wn2,1)+' cm&sup2;; S<sub>w2</sub> = '+g(c.tor.tp.Sw2,0)+'; S<sub>w3</sub> = '+g(c.tor.tp.Sw3,0)+' cm<sup>4</sup>':''}</div><div class="value">loaded, awaiting P385 method</div><div></div>`:''}
    ${c.tor.e0!=null? `<div>Shear centre (P385/Blue Book)</div><div class="formula">e<sub>0</sub> = ${g(c.tor.e0,1)} mm from the web centreline${c.tor.esc!=null? '; e<sub>sc</sub> = '+g(c.tor.esc,1)+' mm from the centroid':''}</div><div class="value">measure e from the shear centre</div><div></div>`:''}
  </div>` : ''}

  <div class="section-title smallgap">Moment Resistance (Cl. 6.2.5)</div>
  <div class="calc-block">
    <div>Shear at point of max. moment (Cl. 6.2.8)</div><div class="formula">V<sub>Ed</sub> @ x=${g(a.Mpos,2)} m: ${f1(c.VatM,1)} kN vs 0.5V<sub>pl${c.tor&&c.tor.VplTRd!=null?',T':''},Rd</sub> = ${f1(c.halfVpl,0)} kN (cl 6.2.8(${c.tor&&c.tor.VplTRd!=null?'4':'2'}))</div><div class="value">${c.lowShearAtM? 'no reduction':'M<sub>c,Rd</sub> reduced'}</div>${st(c.lowShearAtM,'Low shear','High shear')}
    <div>M<sub>c,Rd</sub> = M<sub>pl,Rd</sub> = W<sub>${c.cl.cls<=2?'pl':'el'},y</sub>&middot;f<sub>y</sub>/&gamma;<sub>M0</sub></div><div class="formula">${g(c.cl.cls<=2?sec.Sx:sec.Zx,0)}&times;${g(a.py,0)}/1.0 &times;10<sup>&minus;3</sup></div><div class="value">${f1(c.McRd,0)} kN&middot;m</div><div></div>
    <div>M<sub>y,Ed</sub> / M<sub>c,Rd</sub> &le; 1.0</div><div class="formula">${f1(c.Mx,0)} / ${f1(c.McRd,0)}</div><div class="value">${g(c.momUtil,2)}</div>${st(c.momUtil<=1,'OK')}
    ${c.coex? (c.coex.pureShearFail
      ? `<div>Coexistent M&ndash;V along the span (cl 6.2.8)</div><div class="formula">@ x = ${g(c.coex.x/1000,2)} m: M = ${f1(c.coex.M,1)} kN&middot;m with V = ${f1(c.coex.V,0)} kN &gt; V<sub>pl${c.tor&&c.tor.VplTRd!=null?',T':''},Rd</sub> = ${f1(c.coex.VplRd,0)} kN; pure shear resistance fails, so M<sub>v,Rd</sub> is not evaluated</div><div class="value">V<sub>Ed</sub>/V<sub>pl${c.tor&&c.tor.VplTRd!=null?',T':''},Rd</sub> = ${f1(c.coex.u,3)}</div><div class="status fail">Shear FAIL</div>`
      : `<div>Coexistent M&ndash;V along the span (cl 6.2.8)</div><div class="formula">@ x = ${g(c.coex.x/1000,2)} m: M = ${f1(c.coex.M,1)} kN&middot;m with V = ${f1(c.coex.V,0)} kN &gt; 0.5V<sub>pl,Rd</sub>; M<sub>v,Rd</sub> = ${f1(c.coex.MvRd,0)} kN&middot;m</div><div class="value">${g(c.coex.u,2)}</div>${st(c.coex.u<=1.0001,'OK')}`):''}
  </div>` : '';

  const pvFormula = sec.isBox? (sec.D===sec.B? 'P<sub>v</sub>=0.6 p<sub>y</sub> A D/(D+B)=0.6 p<sub>y</sub> A/2' : 'P<sub>v</sub>=0.6 p<sub>y</sub> A D/(D+B)') : 'P<sub>v</sub>=0.6 p<sub>y</sub> t D';
  const VplFormula = sec.isBox? (sec.D===sec.B? 'V<sub>pl,Rd</sub>=A<sub>v</sub>f<sub>y</sub>/(v3?<sub>M0</sub>), A<sub>v</sub>=A D/(D+B)=A/2' : 'V<sub>pl,Rd</sub>=A<sub>v</sub>f<sub>y</sub>/(v3?<sub>M0</sub>), A<sub>v</sub>=A D/(D+B)')
    : sec.kind==='channel' ? 'V<sub>pl,Rd</sub>=A<sub>v</sub>f<sub>y</sub>/(v3?<sub>M0</sub>), A<sub>v</sub>=A-2bt<sub>f</sub>+(t<sub>w</sub>+r)t<sub>f</sub>'
    : 'V<sub>pl,Rd</sub>=A<sub>v</sub>f<sub>y</sub>/(v3?<sub>M0</sub>), A<sub>v</sub>=A-2bt<sub>f</sub>+(t<sub>w</sub>+2r)t<sub>f</sub>=?h<sub>w</sub>t<sub>w</sub>';

  rep.innerHTML = `
  ${banner}
  <div class="report-head">
    <div>
      <h2>Member Loading and Member Forces</h2>
      <div class="meta">${sname(sec.key)} ${famLabel} &nbsp; &nbsp; ${gradeTxt} &nbsp; &nbsp; L = ${g(S.L)} m</div>
      <div class="loadlist">${loadLines}</div>
    </div>
    ${sectionView}
  </div>

  <div class="diagcard">
    <div class="dt">Loading</div>
    ${beamDiagram(a)}
    <div class="note" style="margin-left:0">Reactions (governing-moment combo, ${a.governM.combo.label}): ${reactLine}</div>
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

  ${torsionCard}
  <div class="calcs-start"></div>
  ${classBlock}

  ${(sci||sciU) ? sciResistanceBlocks : S.code==='EC3' ? `
  <div class="section-title smallgap">Cross-Section Resistance (Cl. 6.2)</div>
  <div class="calc-block">
    <div>V<sub>ed</sub> / V<sub>pl,Rd</sub></div><div class="formula">${f1(c.Fv,2)} / ${f1(c.VplRd,1)} &nbsp;(${VplFormula})</div><div class="value">${g(c.Fv/c.VplRd,3)}</div>${st(c.lowShear,'Low Shear','High Shear (>0.5 Vpl,Rd)')}
    <div>M<sub>c,Rd</sub> = W<sub>${c.cl.cls<=2?'pl':'el'}</sub>f<sub>y</sub>/?<sub>M0</sub></div><div class="formula">${g(c.cl.cls<=2?sec.Sx:sec.Zx,1)} ${g(a.py,0)}/1.0</div><div class="value">${f1(c.McRd,2)} kN m</div><div></div>
    <div>N<sub>Rd</sub> = Af<sub>y</sub>/?<sub>M0</sub></div><div class="formula">${g(c.Ag/1e2,1)} cm  ${g(a.py,0)}</div><div class="value">${f1(c.NRd,1)} kN</div><div></div>
    <div>n = N<sub>ed</sub>/N<sub>Rd</sub></div><div class="formula">${f1(c.F,2)} / ${f1(c.NRd,1)}</div><div class="value">${g(c.n,3)}</div>${st(c.n<=1,'OK')}
    <div>M<sub>N,Rd</sub> = Fn(M<sub>c,Rd</sub>, n)</div><div class="formula">${c.awNote?'reduced for axial (cl 6.2.9.1)':'n 0, no reduction'}</div><div class="value">${f1(c.MNRd,2)} kN m</div><div></div>
    <div>M<sub>ed</sub> / M<sub>N,Rd</sub></div><div class="formula">${f1(c.Mx,2)} / ${f1(c.MNRd,2)}</div><div class="value">${g(c.localUtil,3)}</div>${st(c.localUtil<=1,'OK')}
  </div>` : `
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
  </div>`}

  ${S.code==='EC3' ? '' : `
  <div class="section-title smallgap">Equivalent Uniform Moment Factors</div>
  <div class="calc-block">
    ${mfRow}
    ${mxRow}
    <div>m<sub>y</sub>, m<sub>yx</sub></div><div class="formula">M<sub>y</sub> = 0 (single-plane bending)</div><div class="value">1.000</div><div class="status">Table 26</div>
  </div>`}

  ${ltbBlock}
  ${(sciU&&c.annex)? `
  <div class="section-title smallgap">LTB + Torsion Interaction (BS EN 1993-6 Annex A / P385 &sect;6.2)</div>
  <div class="calc-block">
    <div>Basis</div><div class="formula">M<sub>b,Rd</sub> = &chi;<sub>LT</sub>W<sub>y</sub>f<sub>y</sub> (no f-factor) = ${f1(c.annex.MbA,0)} kN&middot;m; M<sub>cr</sub> = ${f1(c.annex.McrA,0)} kN&middot;m</div><div class="value">C<sub>mz</sub> = ${g(c.annex.Cmz,2)}; k<sub>&alpha;</sub> = ${g(c.annex.kAlpha,2)}</div><div></div>
    <div>M<sub>y</sub>/M<sub>b,Rd</sub> + C<sub>mz</sub>M<sub>z</sub>/M<sub>pl,z</sub> + k<sub>w</sub>k<sub>zw</sub>k<sub>&alpha;</sub>M<sub>w</sub>/M<sub>pl,f</sub></div><div class="formula">@ x = ${g((c.annex.x||0)/1000,2)} m: ${f1(c.annex.My||0,1)}/${f1(c.annex.MbA,0)} + ${g(c.annex.Cmz,2)}&times;${f1(c.annex.Mz||0,2)}/${f1(c.annex.MzR,1)} + ${g(c.annex.kw||0,2)}&times;${g(c.annex.kzw||0,2)}&times;${g(c.annex.kAlpha,2)}&times;${f1(c.annex.Mw||0,2)}/${f1(c.annex.MfR,2)}</div><div class="value">${g(Math.min(c.annex.u,9.99),2)}</div>${st(c.annex.u<=1.0001,'OK')}
  </div>`:''}

  ${(sci||sciU)&&c.ax? `
  <div class="section-title smallgap">Cross-Section Axial + Bending (Cl. 6.2.9)</div>
  <div class="calc-block">
    <div>N<sub>pl,Rd</sub> = Af<sub>y</sub>/&gamma;<sub>M0</sub>${S.anet!=null? ';&nbsp; N<sub>u,Rd</sub> = 0.9A<sub>net</sub>f<sub>u</sub>/&gamma;<sub>M2</sub>':''}</div><div class="formula">${g(sec.A,1)} cm&sup2;&times;${g(a.py,0)}${S.anet!=null? ' ; 0.9&times;'+g(S.anet,1)+' cm&sup2;&times;'+g(fuFromGrade(S.grade),0)+'/1.1 (&gamma;<sub>M2</sub>, UK NA)':''}</div><div class="value">${f1(c.ax.NplRd,1)}${S.anet!=null? ' / '+f1(c.ax.NuRd,1):''} kN</div><div></div>
    <div>${c.ax.tension? 'N<sub>Ed</sub> / N<sub>t,Rd</sub> (tension)':'N<sub>Ed</sub> / N<sub>pl,Rd</sub>'}</div><div class="formula">${f1(Math.abs(c.F),1)} / ${f1(c.ax.tension? c.ax.NtRd:c.ax.NplRd,1)}; n = ${g(c.ax.n,3)}</div><div class="value">${g(c.ax.nUtil,3)}</div>${st(c.ax.nUtil<=1,'OK')}
    ${c.ax.chan? `<div>Linear interaction (cl 6.2.1(7))</div><div class="formula">n + M<sub>y,Ed</sub>/M<sub>c,y,Rd</sub> = ${g(c.ax.n,3)} + ${f1(c.Mx,2)}/${f1(c.ax.MN,2)} &mdash; ${c.ax.mnLbl}</div><div class="value">${g(c.ax.mUtil,3)}</div>${st(c.ax.mUtil<=1,'OK')}` : c.ax.cls3? `<div>Elastic interaction (cl 6.2.9.2)</div><div class="formula">N<sub>Ed</sub>/(Af<sub>y</sub>) + M<sub>y,Ed</sub>/(W<sub>el,y</sub>f<sub>y</sub>) = ${g(c.ax.n,3)} + ${f1(c.Mx,1)}/${f1(c.ax.MN,1)}</div><div class="value">${g(c.ax.mUtil,3)}</div>${st(c.ax.mUtil<=1,'OK')}` : `<div>M<sub>N,y,Rd</sub> (cl 6.2.9.1)</div><div class="formula">${c.ax.mnLbl}</div><div class="value">${f1(c.ax.MN,2)} kN&middot;m</div><div></div>
    <div>(M<sub>y,Ed</sub>/M<sub>N,y,Rd</sub>)<sup>&alpha;</sup> + (M<sub>z,Ed</sub>/M<sub>N,z,Rd</sub>)<sup>&beta;</sup></div><div class="formula">(${f1(c.Mx,2)}/${f1(c.ax.MN,2)})<sup>${g(c.ax.alpha,2)}</sup> + ${c.ax.biax? '('+f1(c.ax.Mz,2)+'/'+f1(c.ax.MNz,2)+')<sup>'+g(c.ax.beta,2)+'</sup>' : '0'}</div><div class="value">${g(c.ax.mUtil,3)}</div>${st(c.ax.mUtil<=1,'OK')}`}
  </div>`:''}
  ${(sci||sciU)&&c.buck? `
  <div class="section-title smallgap">Member Buckling Resistance (Cl. 6.3.3, Annex B Method 2 &mdash; Table ${c.buck.useB1?'B.1':'B.2'})</div>
  <div class="calc-block">
    <div>L<sub>cr,y</sub> = ${g(S.leFactor,2)}&middot;L${c.buck.lczFromRestraints? '; L<sub>cr,z</sub> = restraint spacing (P360 6.2)':''}</div><div class="formula">&lambda;&#772;<sub>y</sub> = ${g(c.buck.lamY,3)} (curve ${c.buck.cvY.curve}); &lambda;&#772;<sub>z</sub> = ${g(c.buck.lamZ,3)} (curve ${c.buck.cvZ.curve})</div><div class="value">${g((c.buck.LcrY!=null?c.buck.LcrY:c.buck.Lcr)/1000,2)}${c.buck.LcrZ!=null&&Math.abs(c.buck.LcrZ-(c.buck.LcrY!=null?c.buck.LcrY:c.buck.Lcr))>1e-6? ' / '+g(c.buck.LcrZ/1000,2):''} m</div><div></div>
    <div>N<sub>b,y,Rd</sub>; N<sub>b,z,Rd</sub> = &chi;Af<sub>y</sub>/&gamma;<sub>M1</sub></div><div class="formula">&chi;<sub>y</sub> = ${g(c.buck.chiY,3)}; &chi;<sub>z</sub> = ${g(c.buck.chiZ,3)}</div><div class="value">${f1(c.buck.NbY,1)} / ${f1(c.buck.NbZ,1)} kN</div><div></div>
    <div>C<sub>my</sub> = C<sub>mLT</sub> (Table B.3)</div><div class="formula" style="font-size:12.5px">${c.buck.cmLabel}${c.buck.swayNote? ' &mdash; sway buckling mode (cantilever): C<sub>m</sub> = 0.9 floor applied (Table B.3 note)':''}</div><div class="value">${g(c.buck.Cmy,3)}; C<sub>mz</sub> = ${g(c.buck.Cmz,2)}</div><div></div>
    <div>k<sub>yy</sub>; k<sub>zz</sub>; k<sub>yz</sub>; k<sub>zy</sub></div><div class="formula">${c.buck.kzyLbl}</div><div class="value">${g(c.buck.kyy,3)}; ${g(c.buck.kzz,3)}; ${g(c.buck.kyz,3)}; ${g(c.buck.kzy,3)}</div><div></div>
    <div>N<sub>Ed</sub>/N<sub>b,y,Rd</sub> + k<sub>yy</sub>M<sub>y,Ed</sub>/M<sub>b,Rd</sub>${c.buck.biax?' + k<sub>yz</sub>M<sub>z,Ed</sub>/M<sub>c,z,Rd</sub>':''} (Eq 6.61)</div><div class="formula">${g(c.buck.ny,3)} + ${g(c.buck.kyy,3)}&times;${f1(c.buck.Mx,2)}/${f1(c.buck.MbRdI,2)}${c.buck.biax?' + '+g(c.buck.kyz,3)+'&times;'+f1(c.buck.MzEd,2)+'/'+f1(c.buck.Mcz,2):''}</div><div class="value">${g(c.buck.u1,3)}</div>${c.buck.Fc>1e-6? st(c.buck.u1<=1.0001,'OK') : '<div class="status">N<sub>Ed</sub> = 0</div>'}
    <div>N<sub>Ed</sub>/N<sub>b,z,Rd</sub> + k<sub>zy</sub>M<sub>y,Ed</sub>/M<sub>b,Rd</sub>${c.buck.biax?' + k<sub>zz</sub>M<sub>z,Ed</sub>/M<sub>c,z,Rd</sub>':''} (Eq 6.62)</div><div class="formula">${g(c.buck.nz,3)} + ${g(c.buck.kzy,3)}&times;${f1(c.buck.Mx,2)}/${f1(c.buck.MbRdI,2)}${c.buck.biax?' + '+g(c.buck.kzz,3)+'&times;'+f1(c.buck.MzEd,2)+'/'+f1(c.buck.Mcz,2):''}</div><div class="value">${g(c.buck.u2,3)}</div>${c.buck.Fc>1e-6? st(c.buck.u2<=1.0001,'OK') : '<div class="status">N<sub>Ed</sub> = 0</div>'}
  </div>`:''}
  ${(sci||sciU) ? '' : S.code==='EC3' ? `
  <div class="section-title smallgap">Member Buckling Resistance (Cl. 6.3.3, Annex B Method 2)</div>
  <div class="calc-block">
    <div>Strut curve y-y / z-z (Table 6.2)</div><div class="formula">curve ${c.curveY.curve} (a=${c.curveY.alpha}) / curve ${c.curveZ.curve} (a=${c.curveZ.alpha})</div><div class="value">? <sub>y</sub>=${f1(c.lamBarY,3)}, ? <sub>z</sub>=${f1(c.lamBarZ,3)}</div><div></div>
    <div>N<sub>b,Rd,y</sub> = ?<sub>y</sub>Af<sub>y</sub>/?<sub>M1</sub></div><div class="formula">?<sub>y</sub>=${f1(c.chiY,3)}   ${g(c.Ag/1e2,1)} cm    ${g(a.py,0)}</div><div class="value">${f1(c.NbRdY,1)} kN</div><div></div>
    <div>N<sub>b,Rd,z</sub> = ?<sub>z</sub>Af<sub>y</sub>/?<sub>M1</sub></div><div class="formula">?<sub>z</sub>=${f1(c.chiZ,3)}   ${g(c.Ag/1e2,1)} cm    ${g(a.py,0)}</div><div class="value">${f1(c.NbRdZ,1)} kN</div><div></div>
    <div>C<sub>my</sub>=C<sub>mz</sub>=C<sub>mLT</sub></div><div class="formula">${c.cmMethod}; ? = ${f1(c.psiInteraction,3)}</div><div class="value">${f1(c.Cm,3)}</div><div></div>
    <div>k<sub>yy</sub> (Table ${sec.isBox?'B.1':'B.2'})</div><div class="formula">${c.cl.cls<=2?`C<sub>my</sub>min[1+(? <sub>y</sub>-0.2)n<sub>y</sub>, 1+0.8n<sub>y</sub>]`:`C<sub>my</sub>min[1+0.6? <sub>y</sub>n<sub>y</sub>, 1+0.6n<sub>y</sub>]`}</div><div class="value">${f1(c.kyy,3)}</div><div></div>
    <div>k<sub>zy</sub> (Table ${sec.isBox?'B.1: 0.8 k<sub>yy</sub>':'B.2: torsion-susceptible form'})</div><div class="formula">${sec.isBox?'box section   simpler form, no C<sub>mLT</sub> term':'1-0.1? <sub>z</sub>n<sub>z</sub>/[(C<sub>mLT</sub>-0.25)?<sub>z</sub>], capped'}</div><div class="value">${f1(c.kzy,3)}</div><div></div>
    <div>N<sub>ed</sub>/N<sub>b,Rd,y</sub> + k<sub>yy</sub>M<sub>ed</sub>/M<sub>b,Rd</sub></div><div class="formula">${f1(c.Fc,1)}/${f1(c.NbRdY,0)} + ${f1(c.kyy,3)} ${f1(c.Mx,2)}/${f1(c.McRdLT,2)}</div><div class="value">${g(c.u1,3)}</div>${st(c.u1<=1,'OK')}
    <div>N<sub>ed</sub>/N<sub>b,Rd,z</sub> + k<sub>zy</sub>M<sub>ed</sub>/M<sub>b,Rd</sub></div><div class="formula">${f1(c.Fc,1)}/${f1(c.NbRdZ,0)} + ${f1(c.kzy,3)} ${f1(c.Mx,2)}/${f1(c.McRdLT,2)}</div><div class="value">${g(c.u2,3)}</div>${st(c.u2<=1,'OK')}
  </div>` : `
  <div class="section-title smallgap">Simplified Buckling Approach (Cl. 4.8.3.3.1)</div>
  <div class="calc-block">
    <div>p<sub>y</sub> Z<sub>x</sub></div><div class="formula">${g(a.py,0)} ${g(sec.Zx,1)}</div><div class="value">${f1(c.pyZx,2)} kN m</div><div></div>
    <div>F/P<sub>c</sub> + m<sub>x</sub> M<sub>x</sub>/(p<sub>y</sub>Z<sub>x</sub>)</div><div class="formula">${f1(c.Fc,1)}/${f1(c.Pc,0)} + ${g(c.mx,3)} ${f1(c.Mx,2)}/${f1(c.pyZx,2)}</div><div class="value">${g(c.u1,3)}</div>${st(c.u1<=1,'OK')}
    <div>F/P<sub>cy</sub> + m<sub>LT</sub> M<sub>LT</sub>/M<sub>b</sub></div><div class="formula">${f1(c.Fc,1)}/${f1(c.Pcy,0)} + ${g(c.mLT,3)} ${f1(c.Mx,2)}/${f1(c.Mb,2)}</div><div class="value">${g(c.u2,3)}</div>${st(c.u2<=1,'OK')}
  </div>`}

  <div class="section-title smallgap">${(sci||sciU)? 'Vertical Deflection of Beam (BS EN 1993-1-1 NA 2.23 &mdash; ' : 'Deflection Check (SLS &mdash; '}${a.governD.combo.label})</div>
  <div class="calc-block">
    <div>w (governing span utilisation)</div><div class="formula">@ x = ${g(a.deflection?a.deflection.dpos/1000:a.dpos,2)} m</div><div class="value">${f1(c.dmax,1)} mm</div><div></div>
    <div>Limit = span/${g(c.divisor,0)}</div><div class="formula">${g(c.span,0)}/${g(c.divisor,0)} = ${f1(c.dlimit,1)} mm</div><div class="value">${f1(c.dmax,1)} ${c.defOk?'&lt;':'&gt;'} ${f1(c.dlimit,1)} mm</div>${st(c.defOk,'OK')}
  </div>

  ${(sci||sciU)&&c.tor&&c.tor.p385? `
  <div class="section-title smallgap">Rotation at SLS (${c.tor.governTw})</div>
  <div class="calc-block">
    <div>Max rotation &phi;<sub>ser</sub></div><div class="formula">@ x = ${g(c.tor.phiSerPos,2)} m; P385 practical guide: &phi; &le; 2&deg; (no codified limit &mdash; advisory)</div><div class="value">${c.tor.phiSer.toFixed(4)} rad = ${f1(c.tor.phiSerDeg,2)}&deg;</div><div class="status ${c.tor.phiSerDeg<=2?'ok':''}">${c.tor.phiSerDeg<=2?'&le; 2&deg;':'&gt; 2&deg; &mdash; review'}</div>
  </div>`:''}
  ${(sci||sciU)&&c.tor&&c.tor.box? `
  <div class="section-title smallgap">Twist at SLS (${a.tors.governTw})</div>
  <div class="calc-block">
    <div>Max. torsional moment (SLS)</div><div class="formula">governing enabled SLS combination</div><div class="value">${f1(c.tor.TmaxSLS,2)} kN&middot;m</div><div></div>
    <div>Twist per unit length = T<sub>Ed</sub>/GI<sub>t</sub></div><div class="formula">${f1(c.tor.TmaxSLS,2)}&times;10<sup>6</sup> / (81000&times;${g(sec.J,0)}&times;10<sup>4</sup>)</div><div class="value">${(c.tor.TmaxSLS*1e6/c.tor.GIt).toExponential(1)} rad/mm</div><div></div>
    <div>Max. twist</div><div class="formula">@ x = ${g(c.tor.phiPos,2)} m</div><div class="value">${(c.tor.phiMax*1e3).toFixed(2)}&times;10<sup>&minus;3</sup> rad = ${f1(c.tor.phiDeg,2)}&deg;</div><div></div>
  </div>`:''}
  <div class="note">${notes.map(n=>'  '+n).join('<br>')}</div>
  <div class="note" style="margin-top:8px;color:#9a8f78">Analysis: 2-node Euler Bernoulli beam elements (direct stiffness); reactions exact, shear/moment by statics, deflection at nodes exact. Section data: SCI P363 Blue Book. This is a design aid   results to be verified by a competent engineer.</div>
  `;
}
