/* ===========================================================================
   6b. MASTERSERIES-FORMAT DESIGN BRIEF  (EC3 path)
   ---------------------------------------------------------------------------
   renderMasterSeriesBrief(a, c, sec) -> HTML string.
   Pure: reads the analysis result a (analyse()), the check result c
   (checks(a)), the normalised section sec (= a.sec) and the app state S;
   touches no DOM. Block order, wording and the three-column layout follow
   docs/BRIEF_MAPPING.md, i.e. a MasterSeries 2025 "MasterSteel Beam Design
   to EN 1993-1-1" printout. Every number printed is a field of a / c / sec
   or is derived by one of the msb* helpers below, each of which only
   re-expresses a value the check engine already used (ratio, unit change,
   back-substitution); no resistance is recomputed here (V_pl.z.Rd and
   M_c.z.Rd come from the engine's c.ax block). Where the engine has no
   value the tag column prints "not evaluated".
   Blocking messages (c.unsupported) appear as red "NOT VERIFIED" rows in
   the block of the check they concern (a message no block claims is printed
   before the deflection block) and again in the verdict footer.
   20 Sep 2026 (owner: one brief only, MasterSeries order, every block on its
   trigger): this brief IS the EC3 report (js/06-render.js prints the verdict
   banner and then this string alone). Block sequence, audited against the
   MasterSeries printouts of docs/owner-cases/masterseries/COMPARISON_LOG.md:
   Title (+ "Includes Design for Torsion ..." line when torsion is active) ->
   Member Loading and Member Forces (load list, forces table, loading sketch
   and hover diagrams V / M / delta / T, combination table when > 1 case) ->
   Classification and Effective Area -> Shear Capacity Check -> Local Capacity
   Check (or Moment Capacity Check M.c.y.Rd) -> Web Transverse Forces (beam-v03
   addition, when the engine ran it) -> Compression Resistance N.b.Rd (N_Ed > 0)
   -> Equivalent Uniform Moment Factor(s) -> Lateral Buckling Check M.b.Rd
   (+ Lateral Restraint Portions with intermediate restraints) -> Buckling
   Resistance (Axial with Moments brief) -> Torsion Design / Torsion Bending
   Design @ x / Torsion Shear Design @ x (torsion active) -> Deflection Check
   (+ the "Torq in Case n" twist line with torsion) -> unity bar -> verdict.
   A MasterSeries line beam-v03 has no value for prints its label with
   "n/a - not evaluated by beam-v03" once; nothing is recomputed here.
   =========================================================================== */

/* ---- formatting (docs/BRIEF_MAPPING.md section 3) ---- */
function msbR(v){ return f1(v,3); }                       // ratio / chi / k / lambda-bar
function msbKNm(v){ return f1(v,3); }                     // kN.m
function msbKN(v){ return f1(v,3); }                      // kN
function msbMM(v){ return f1(v,2); }                      // mm
function msbM(v){ return g(v,3); }                        // m, trimmed
function msbInt(v){ return g(v,0); }
function msbDash(v,fmt){ return (v==null||!isFinite(v))? '&mdash;' : fmt(v); }
function msbEsc(s){ return String(s==null?'':s); }
function msbSecName(key){ return String(key||'').replace(/\s*x\s*/g,' x '); }   // "457 x 191 x 89", "150 x 150 x 6.3"

/* ---- pure DERIVE helpers (docs/BRIEF_MAPPING.md section 8) ---- */
// shear at a station of one combination's own diagram, kN
function msbEndShear(fb,x){ return interpAt(fb.xs,fb.V,x)/1000; }
// bending moment at a station, kN.m (signed, sagging positive)
function msbMomentAt(fb,x){ return interpAt(fb.xs,fb.M,x)/1e6; }
// MasterSeries C1 inputs of a portion: M1, M2 (|M2| >= |M1|), Mo (mid-portion
// moment above the chord), psi = M1/M2, mu = Mo/M2 capped at 300; plus the
// largest |M| on the grid inside the portion and its position
function msbPortionMoments(fb,xa,xb){
  const Ma=msbMomentAt(fb,xa+1e-4), Mb=msbMomentAt(fb,xb-1e-4);
  const [M1,M2]= Math.abs(Mb)>=Math.abs(Ma)? [Ma,Mb] : [Mb,Ma];
  const Mmid=mAtStation(fb,(xa+xb)/2,xa,xb)/1e6;   // larger side of a jump (in-span couple), as c1Inputs
  const Mo=Mmid-(M1+M2)/2;
  const psi= Math.abs(M2)>1e-9? M1/M2 : 0;
  const mu= Math.abs(M2)>1e-9? Math.min(Mo/M2,300) : 300;
  let Mmax=0, xmax=xa;
  fb.xs.forEach((x,i)=>{ if(x>=xa-1e-6&&x<=xb+1e-6&&Math.abs(fb.M[i])>Math.abs(Mmax)){ Mmax=fb.M[i]; xmax=x; } });
  return {M1,M2,Mo,psi,mu,Mmax:Mmax/1e6,xmax};
}
// Table B.3 parameters exactly as cmTableB3() reads them from the analysis
function msbCmB3Params(a){
  const M0=a.M0end, ML=a.MLend, Ms=a.Mh;
  const Mh= Math.abs(M0)>=Math.abs(ML)? M0 : ML;
  const Mo= Math.abs(M0)>=Math.abs(ML)? ML : M0;
  const psi= Math.abs(Mh)>1e-9? Math.max(-1,Math.min(1,Mo/Mh)) : 1;
  const useAlphaS = Math.abs(Ms)<=Math.abs(Mh)+1e-12;
  const alphaS = useAlphaS? (Math.abs(Mh)>1e-9? Ms/Mh : 0) : null;
  const alphaH = useAlphaS? null : Mh/Ms;
  return {Mh,Ms,psi,alphaS,alphaH};
}
// Table B.3 expression text from the annexB2 cmLabel prefix
function msbCmB3Form(label,alphaS){
  const s=msbEsc(label);
  const hasH=/alpha;<sub>h<\/sub>/.test(s), hasS=/alpha;<sub>s<\/sub>/.test(s);
  if(s.indexOf('linear end-moment diagram')===0) return 'Max(0.6+0.4&psi;, 0.4)';
  if(s.indexOf('negligible moment')===0) return '1.0';
  if(s.indexOf('C_m = 1')===0) return '1.0 (diagram outside Table B.3)';
  if(s.indexOf('mixed loading')===0) return 'max(uniform, concentrated)';
  if(s.indexOf('uniform load diagram')===0){
    if(hasH) return '0.95+0.05&alpha;<sub>h</sub>';
    if(hasS) return (alphaS!=null&&alphaS<0)? 'Table B.3 (&alpha;<sub>s</sub> &lt; 0 row)' : '0.2+0.8&alpha;<sub>s</sub>';
    return '0.95 (M<sub>h</sub> = 0)';
  }
  if(s.indexOf('concentrated load diagram')===0){
    if(hasH) return '0.90+0.10&alpha;<sub>h</sub>';
    if(hasS) return (alphaS!=null&&alphaS<0)? 'Table B.3 (&alpha;<sub>s</sub> &lt; 0 row)' : '0.2+0.8&alpha;<sub>s</sub>';
    return '0.90 (M<sub>h</sub> = 0)';
  }
  return 'Table B.3';
}
// MasterSeries C1 tag from the closed-form label / route
function msbC1Tag(label,route){
  const s=msbEsc(label);
  if(route==='override'||/user override/.test(s)) return 'User';
  if(route==='sn006a'||route==='cantilever'||/cantilever/.test(s)) return 'Cantilever';
  if(/uniformly distributed/.test(s)) return 'Uniform';
  if(/central point load/.test(s)) return 'Point';
  if(/linear end-moment gradient/.test(s)) return 'Not Loaded';
  if(/Serna/.test(s)) return 'Serna';
  if(/negligible/.test(s)) return 'Uniform';
  return '';
}
// Euler load about one axis, kN: pi^2 E I / L^2 (I cm4, L mm)
function msbNcr(E,I_cm4,L_mm){ return Math.PI*Math.PI*E*I_cm4*1e4/(L_mm*L_mm)/1000; }
// characteristic resistances used by the cl 6.3.3 ratios
function msbNRk(sec,fy){ return sec.A*100*fy/1000; }           // kN
function msbMyRk(Wy,fy){ return Wy*fy/1e6; }                   // kN.m (Wy mm3)
function msbKc(C1){ return (typeof kcFromC1==='function')? kcFromC1(C1).kc : Math.max(Math.min(1/Math.sqrt(Math.max(C1,1e-6)),1),1/Math.sqrt(2.76)); }   // NA 2.18 with the Table 6.6 floor 0.60
// cl 6.2.8(3) shear reduction factor
function msbRhoShear(V,Vpl){ return Math.min(Math.pow(2*V/Math.max(Vpl,1e-9)-1,2),1); }
// reduced plastic modulus back-substituted from M_N,Rd, cm3
function msbWplN(MN_kNm,fy){ return MN_kNm*1e3/fy; }
// Phi_LT of cl 6.3.2.3 (the expression the check engine evaluates)
function msbPhiLT(lam,alphaLT){ return 0.5*(1+alphaLT*(lam-0.4)+0.75*lam*lam); }
// 1-based index of a combination among the analysed ULS (or SLS) combinations
// (the list of analyse() when `a` is given, else the enabled entries of S.combos)
function msbCaseIndex(combo,sls,a){
  const list= a? (sls? a.slsResults : a.ulsResults).map(r=>r.combo) : (S.combos||[]).filter(cb=>cb.on && (sls? cb.sls : !cb.sls));
  let i=list.indexOf(combo);
  if(i<0 && combo) i=list.findIndex(cb=>cb.label===combo.label);
  return i<0? null : i+1;
}
function msbCaseLabel(combo,sls,a){
  const n=msbCaseIndex(combo,sls,a);
  return (n!=null? String(n) : '?')+(combo&&combo.label? ' ('+combo.label+')' : '');
}
// [1,2,4,5,6] -> "1-2, 4-6"
function msbCaseRanges(list){
  const out=[]; let i=0;
  while(i<list.length){ let j=i; while(j+1<list.length && list[j+1]===list[j]+1) j++; out.push(list[i]===list[j]? String(list[i]) : list[i]+'-'+list[j]); i=j+1; }
  return out.join(', ');
}
function msbAxialTag(sec,eps){ return ((S.axial||0)>0 && sec.dt>42*eps)? '(Axial: Slender web)' : '(Axial: Non-Slender)'; }
function msbMaxExclDeflection(utils){
  const v=(utils||[]).filter(u=>u.name!=='Deflection').map(u=>+u.val).filter(x=>isFinite(x));
  return v.length? Math.max(...v) : 0;
}
// governing portion [xa, xb] in mm (docs/BRIEF_MAPPING.md section 7.1)
function msbPortion(a,LT){
  const L=a.L;
  if(LT && LT.spanGoverns && LT.spanGov) return [LT.spanGov.a, LT.spanGov.b];
  const pts=(LT && LT.vPoints)||[];
  if(pts.length>=3 && LT.modePeakX!=null){
    for(let i=0;i<pts.length-1;i++) if(LT.modePeakX>=pts[i]-1e-6 && LT.modePeakX<=pts[i+1]+1e-6) return [pts[i],pts[i+1]];
  }
  return [0,L];
}
// which brief block a blocking message belongs to
function msbBlockFor(msg){
  const s=msbEsc(msg);
  if(/^Hold-down/.test(s)) return 'forces';
  if(/Web transverse forces|bearing stiffener|EN 1993-1-5 clause 6|EN 1993-1-5 9\.4/i.test(s)) return 'web';
  if(/torsion|Torsion|Eccentric loads|Annex A|k_alpha|Torsional constants|eccentric load/i.test(s)) return 'torsion';
  if(/Class 4|effective-section|Effective-area|slender/i.test(s)) return 'class';
  if(/shear/i.test(s)) return 'local';
  if(/PFC under axial|torsional-flexural|6\.3\.1\.4/.test(s)) return 'compression';
  if(/reduced moment resistance under axial|channel sections/i.test(s)) return 'local';
  if(/critical moment|LTB|eigensolver|mesh|Cantilever|lateral/i.test(s)) return 'ltb';
  return 'general';
}

/* ---- row / block builders ---- */
function msbWarn(ok){ return ok? 'OK' : '<span class="ms-warn">Warning</span>'; }
function msbRow(label,vals,res,tag,cls){
  return '<div class="ms-row'+(cls? ' '+cls:'')+'"><div class="ms-l">'+msbEsc(label)+'</div><div class="ms-v">'+msbEsc(vals)+'</div><div class="ms-r">'+msbEsc(res)+'</div><div class="ms-t">'+msbEsc(tag)+'</div></div>';
}
function msbNotVerifiedRows(list){
  return (list||[]).map(m=>'<div class="ms-row ms-nv"><div class="ms-l">NOT VERIFIED</div><div class="ms-v ms-nv-msg">'+msbEsc(m)+'</div><div class="ms-r"></div><div class="ms-t"><span class="ms-warn">NOT VERIFIED</span></div></div>').join('');
}
// 20 Sep 2026 review: advisory rows (engine notes that do not enter the verdict), one per message
function msbAdvisoryRows(list){
  return (list||[]).map(m=>'<div class="ms-row ms-advrow"><div class="ms-l">Advisory</div><div class="ms-v ms-adv-msg">'+msbEsc(m)+'</div><div class="ms-r"></div><div class="ms-t">advisory</div></div>').join('');
}
// 20 Sep 2026 review: the eigen route's buckled mode shape (LT.mode: x mm, phi and v normalised to their own
// peaks; LT.vPoints the lateral restraint stations), formerly a figure of the deleted CED report. Pure SVG string,
// no hover data (the curves are shapes, not values); empty when the route has no mode.
function msbModeShape(LT){
  const md=LT && LT.mode;
  if(!md || !md.x || md.x.length<3) return '';
  const W=540,H=120,pd=12,Lm=md.x[md.x.length-1]||1;
  let vmx=0; md.v.forEach(vv=>{ vmx=Math.max(vmx,Math.abs(vv)); });
  const X=x=>pd+(W-2*pd)*x/Lm, Yc=H/2, ampl=H/2-pd-14;
  let pphi='', pv='';
  md.x.forEach((x,i)=>{ pphi+=(i? ' L ':'M ')+X(x).toFixed(1)+' '+(Yc-ampl*md.phi[i]).toFixed(1); pv+=(i? ' L ':'M ')+X(x).toFixed(1)+' '+(Yc-ampl*(vmx>0? md.v[i]/vmx : 0)).toFixed(1); });
  const marks=(LT.vPoints||[]).map(x=>{ const xx=X(x).toFixed(1); return '<line x1="'+xx+'" y1="'+pd+'" x2="'+xx+'" y2="'+(H-pd)+'" stroke="#b91c1c" stroke-width="1" stroke-dasharray="3,3"/><text x="'+xx+'" y="'+(H-2)+'" font-family="Arial" font-size="9" text-anchor="middle" fill="#b91c1c">'+g(x/1000,2)+'</text>'; }).join('');
  return '<div class="ms-diag-full ms-mode"><div class="ms-dt">Buckled mode shape &mdash; critical eigenmode (normalised; twist &phi; solid, lateral v dashed; red: lateral restraint points; peak twist at x = '+(LT.modePeakX!=null? g(LT.modePeakX/1000,2) : '&mdash;')+' m)</div>'+
    '<svg class="diag" viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg"><line x1="'+pd+'" y1="'+Yc+'" x2="'+(W-pd)+'" y2="'+Yc+'" stroke="#9ca3af" stroke-width="1"/>'+marks+
    '<path d="'+pphi+'" fill="none" stroke="#1d4ed8" stroke-width="2"/><path d="'+pv+'" fill="none" stroke="#059669" stroke-width="1.6" stroke-dasharray="6,4"/></svg></div>';
}
function msbHead(t){ return '<div class="ms-h">'+t+'</div>'; }
function msbSub(t){ return '<div class="ms-sub">'+t+'</div>'; }
// [20 Sep 2026] MasterSeries second title line when torsion is designed: an open
// section names the warping condition of its ends (the P385 closed forms assume
// fork ends free to warp; the warping-torsion FE reads the end W flags), a
// hollow section simply "Includes Design for Torsion".
function msbTorsionTitle(T,sec){
  if(!T) return '';
  if(sec.isBox || T.box) return '<div>Includes Design for Torsion</div>';
  const e1=(S.ends&&S.ends.e1)||{}, e2=(S.ends&&S.ends.e2)||{};
  const w1=!!(T.fe && e1.warp), w2=!!(T.fe && e2.warp);
  const txt=(w1&&w2)? 'End Warping Fixed' : (!w1&&!w2)? 'Ends Free to Warp' : 'End '+(w1?1:2)+' Warping Fixed, End '+(w1?2:1)+' Free to Warp';
  return '<div>Includes Design for Torsion with Span Warping, '+txt+'</div>';
}
/* ---- [20 Sep 2026] diagram panel of the Member Loading block ----
   The loading sketch (beamDiagram) full width, then the shear force, bending
   moment (tension side down), deflection and - with torsion active - torsional
   moment plots in a two-column grid. plot() (js/05-diagrams.js) rides every
   sample on the <svg> as data-* attributes and appends the hidden hover group
   that installDiagramHover() drives, so each diagram reads "x = .. m  M = ..
   kN.m" under the pointer; opt.name labels the readout. Pure: a.diag and
   a.tors.diag only, nothing recomputed. */
function msbDiagramPanel(a){
  if(typeof plot!=='function') return '';
  const cap=(s)=>'<div class="ms-dt">'+s+'</div>';
  const torsOn=!!(a.tors && a.tors.on && a.tors.diag);
  let h='<div class="ms-diagrams">';
  if(typeof beamDiagram==='function') h+='<div class="ms-diag-full">'+cap('Loading')+beamDiagram(a)+'</div>';
  h+='<div class="ms-diag-grid">'+
    '<div>'+cap('Shear force V (kN)')+plot(a.diag.xs,a.diag.V,{color:'#1d4ed8',fill:'#bcd0f7',unit:'kN',name:'V',fmt:v=>f1(v,2)})+'</div>'+
    '<div>'+cap('Bending moment M (kN.m)')+plot(a.diag.xs,a.diag.M,{color:'#b91c1c',fill:'#f3c2c2',unit:'kN.m',name:'M',flip:true,fmt:v=>f1(v,2)})+'</div>'+
    '<div>'+cap('Deflection &delta; (mm, '+msbEsc(a.governD.combo.label)+')')+plot(a.diag.dx,a.diag.dw,{color:'#166534',fill:'#bfe3cb',unit:'mm',name:'\u03b4',fmt:v=>f1(v,2)})+'</div>'+
    (torsOn? '<div>'+cap('Torsional moment T (kN.m, '+msbEsc(a.tors.governT)+')')+plot(a.tors.diag.xs,a.tors.diag.T,{color:'#7a4',fill:'#dcebc4',unit:'kN.m',name:'T',fmt:v=>f1(v,2)})+'</div>' : '')+
    '</div>';
  h+='<div class="ms-note ms-diag-note"><i>Bending-moment diagram drawn on the tension side (sagging down); shear and deflection to true sign (down = below the axis); hover over a diagram for the value at any point.</i></div>';
  return h+'</div>';
}

/* ---- Web Transverse Forces (EN 1993-1-5 cl 6 + 7.2) block, pure ----
   Prints the web geometry and m1/m2, the full derivation of the governing
   station (worst F_Ed/F_Rd), one table row per station, a stiffener-declared
   advisory row per declared station and the assumptions note. Every number
   is a field of c.web (webTransverseCheck); nothing is recomputed. */
function msbWebTypeText(t){ return t==='a'? 'Fig 6.1(a) interior' : t==='b'? 'Fig 6.1(b) through the web' : 'Fig 6.1(c) end'; }
function msbWebBlock(a,c,sec,nvRows){
  const W=c.web||null;
  if(!W) return msbNotVerifiedRows(nvRows);   // 20 Sep 2026: no block when the engine did not run the check (the rows, if any, still print)
  let h=msbHead('Web Transverse Forces (EN 1993-1-5 cl 6)');
  const webs= W.nWebs>1? W.nWebs+' webs' : '1 web';
  h+=msbRow('Web h<sub>w</sub>, t<sub>w</sub>, t<sub>f</sub>, b<sub>f</sub>', msbMM(W.hw)+', '+msbMM(W.tw)+', '+msbMM(W.tf)+', '+msbMM(W.bf)+' mm ('+(W.isBox? 'B/2' : 'B')+' = '+msbMM(W.bfRaw)+' &le; '+(W.isBox||W.chan? 't<sub>w</sub> + 15&epsilon;t<sub>f</sub>' : 't<sub>w</sub> + 30&epsilon;t<sub>f</sub>')+' = '+msbMM(W.bfLim)+'); f<sub>yw</sub> = f<sub>yf</sub> = '+msbInt(W.fyw)+'; '+webs+(W.isBox? ' (flat depth from the section table, corner geometry)' : ''), '', 'Fig 5.1');
  h+=msbRow('m<sub>1</sub> = f<sub>yf</sub>.b<sub>f</sub>/(f<sub>yw</sub>.t<sub>w</sub>) ; m<sub>2</sub> = 0.02(h<sub>w</sub>/t<sub>f</sub>)&sup2;', msbInt(W.fyf)+' x '+msbMM(W.bf)+'/('+msbInt(W.fyw)+' x '+msbMM(W.tw)+') = '+msbR(W.m1)+' ; 0.02 x ('+msbMM(W.hw)+'/'+msbMM(W.tf)+')&sup2; = '+msbR(W.m2full)+' if &lambda;&#772;<sub>F</sub> &gt; 0.5, else 0', '', '6.5(1)');
  h+=msbRow('a = distance between transverse stiffeners', msbEsc(W.aBasis), '', '6.4(1)');
  const G=W.show||W.gov2||null;
  if(G){
    const s=G, t=s.gov, cs=s.cases[s.g2], c72=s.cases[s.g72];
    const nvTag='<span class="ms-warn">NOT VERIFIED</span>';
    h+=msbSub((s.nv? 'Worst station (NOT VERIFIED: s<sub>s</sub> not entered, lower bound 0) x = ' : 'Governing station x = ')+msbM(s.x/1000)+' m: '+msbEsc(s.label)+', load type ('+t.type+') '+msbWebTypeText(t.type)+(s.types.length>1? ' [types '+s.types.map(x=>'('+x+')').join(', ')+' evaluated, lower F<sub>Rd</sub> governs]' : ''));
    const ssTxt='s<sub>s</sub> = '+msbMM(s.ss)+' mm'+(s.ssDefault? ' (not entered: lower bound 0)' : s.kind==='load'&&s.ssIn===0? ' (default 0)' : ' (entered)')+(s.ssCap? ' (capped at h<sub>w</sub>, 6.3(1))' : '')+'; c = '+msbMM(s.c)+' mm (d = '+msbMM(s.d)+' to the member end)';
    const kfTxt= t.type==='c'? 'k<sub>F</sub> = 2 + 6(s<sub>s</sub> + c)/h<sub>w</sub> &le; 6 = 2 + 6 x '+msbMM(s.ss+s.c)+'/'+msbMM(W.hw) : 'k<sub>F</sub> = '+(t.type==='b'? '3.5' : '6')+' + 2(h<sub>w</sub>/a)&sup2; = '+(t.type==='b'? '3.5' : '6')+' + 2('+msbMM(W.hw)+'/'+g(s.a,0)+')&sup2;';
    h+=msbRow('s<sub>s</sub>, c ; k<sub>F</sub>', ssTxt+' ; '+kfTxt, msbR(t.kF), 'Fig 6.1('+t.type+')');
    h+=msbRow('F<sub>cr</sub> = 0.9k<sub>F</sub>.E.t<sub>w</sub>&sup3;/h<sub>w</sub>', '0.9 x '+msbR(t.kF)+' x '+msbInt(a.E)+' x '+msbMM(W.tw)+'&sup3;/'+msbMM(W.hw), msbKN(t.Fcr)+' kN', '6.4(1)');
    const m2Txt='m<sub>2</sub> = '+msbR(t.m2)+(t.iter? ' (first pass &lambda;&#772;<sub>F</sub> = '+msbR(t.lam1)+' &le; 0.5 with m<sub>2</sub> = '+msbR(W.m2full)+', so m<sub>2</sub> = 0)' : ' (&lambda;&#772;<sub>F</sub> &gt; 0.5)');
    if(t.type==='c'){
      h+=msbRow('l<sub>e</sub> = k<sub>F</sub>.E.t<sub>w</sub>&sup2;/(2f<sub>yw</sub>.h<sub>w</sub>) &le; s<sub>s</sub> + c', msbR(t.kF)+' x '+msbInt(a.E)+' x '+msbMM(W.tw)+'&sup2;/(2 x '+msbInt(W.fyw)+' x '+msbMM(W.hw)+') = '+msbMM(t.leRaw)+' &le; '+msbMM(s.ss+s.c), msbMM(t.le)+' mm', '6.5(4)');
      h+=msbRow('l<sub>y</sub> = min[l<sub>e</sub> + t<sub>f</sub>&radic;(m<sub>1</sub>/2 + (l<sub>e</sub>/t<sub>f</sub>)&sup2; + m<sub>2</sub>), l<sub>e</sub> + t<sub>f</sub>&radic;(m<sub>1</sub> + m<sub>2</sub>)]', m2Txt+'; min['+msbMM(t.l1)+', '+msbMM(t.l2)+']', msbMM(t.ly)+' mm', '6.5(4)');
    } else {
      h+=msbRow('l<sub>y</sub> = s<sub>s</sub> + 2t<sub>f</sub>(1 + &radic;(m<sub>1</sub> + m<sub>2</sub>)) &le; a', m2Txt+'; '+msbMM(s.ss)+' + 2 x '+msbMM(W.tf)+' x (1 + &radic;('+msbR(W.m1)+' + '+msbR(t.m2)+')) = '+msbMM(t.l1)+(t.capA? ' &gt; a = '+g(s.a,0)+' (capped)' : ''), msbMM(t.ly)+' mm', '6.5(3)');
    }
    h+=msbRow('&lambda;&#772;<sub>F</sub> = &radic;(l<sub>y</sub>.t<sub>w</sub>.f<sub>yw</sub>/F<sub>cr</sub>)', '&radic;('+msbMM(t.ly)+' x '+msbMM(W.tw)+' x '+msbInt(W.fyw)+'/'+msbKN(t.Fcr)+'e3)', msbR(t.lam), '6.4(1)');
    h+=msbRow('&chi;<sub>F</sub> = 0.5/&lambda;&#772;<sub>F</sub> &le; 1 ; L<sub>eff</sub> = &chi;<sub>F</sub>.l<sub>y</sub>', '0.5/'+msbR(t.lam)+' = '+msbR(t.chiRaw)+(t.chiRaw>1? ' &rarr; 1.000' : '')+' ; '+msbR(t.chi)+' x '+msbMM(t.ly), msbMM(t.Leff)+' mm', '6.4(1)');
    h+=msbRow('F<sub>Rd</sub> = f<sub>yw</sub>.L<sub>eff</sub>.t<sub>w</sub>/&gamma;<sub>M1</sub>', msbInt(W.fyw)+' x '+msbMM(t.Leff)+' x '+msbMM(W.tw)+'/1.0'+(W.isBox? ' per web; load share to this web = '+msbR(s.share)+(s.eMax>0? ' (lever rule, e = '+g(s.eMax,0)+' mm)' : ' (e = 0)')+'; F<sub>Rd</sub> for the load = '+msbKN(s.FRdTot)+' kN' : ''), msbKN(t.FRd)+' kN', '6.2(1)');
    const fTxt=(cs.P!==0&&s.support? 'P = '+msbKN(Math.abs(cs.P))+', R = '+msbKN(cs.R)+': ' : '')+'F<sub>Ed</sub> = '+msbKN(cs.F)+' kN ('+msbEsc(cs.combo)+'; on the '+cs.flange+' flange, '+msbEsc(cs.flangeState)+')';
    h+=msbRow('F<sub>Ed</sub>/F<sub>Rd</sub>', fTxt+' / '+msbKN(s.FRdTot)+' =', msbR(cs.eta2), s.nv? nvTag : msbWarn(cs.eta2<=1.0001));
    const eta1Txt='M<sub>Ed</sub>/M<sub>c.y.Rd</sub> = '+msbKNm(c72.M)+'/'+msbKNm(W.McRd0)+(W.NEd>1e-9? ' + N<sub>Ed</sub>/N<sub>pl.Rd</sub> = '+msbKN(W.NEd)+'/'+msbKN(W.NplRd) : '')+' = '+msbR(c72.eta1);
    h+=msbRow('&eta;<sub>2</sub> + 0.8&eta;<sub>1</sub> &le; 1.4', msbR(c72.eta2)+' + 0.8 x ('+eta1Txt+') = '+msbR(c72.u72raw)+' &le; 1.4 ('+msbEsc(c72.combo)+(c72.flangeComp? '' : '; loaded flange in tension: 7.2(2) refers to 6.2.1(5), expression applied as a screen [verify]')+')', msbR(c72.u72), (s.nv? nvTag : msbWarn(c72.u72<=1.0001))+' 7.2');
  }
  // every station
  if(W.stations.length){
    h+='<table class="ms-combos"><thead><tr><th>x (m)</th><th>Station</th><th>Type</th><th>s<sub>s</sub> (mm)</th><th>k<sub>F</sub></th><th>l<sub>y</sub> (mm)</th><th>&lambda;&#772;<sub>F</sub></th><th>&chi;<sub>F</sub></th><th>F<sub>Rd</sub> (kN)</th><th>F<sub>Ed</sub> (kN)</th><th>Load case</th><th>F<sub>Ed</sub>/F<sub>Rd</sub></th><th>(&eta;<sub>2</sub>+0.8&eta;<sub>1</sub>)/1.4</th><th></th></tr></thead><tbody>'+
      W.stations.map(s=>{
        if(s.stiff) return '<tr><td class="num">'+msbM(s.x/1000)+'</td><td>'+msbEsc(s.label)+'</td><td colspan="11">'+msbEsc(s.msg)+'</td><td>advisory</td></tr>';
        const t=s.gov, cs=s.cases[s.g2];
        return '<tr><td class="num">'+msbM(s.x/1000)+'</td><td>'+msbEsc(s.label)+'</td><td>('+t.type+')</td><td class="num">'+msbMM(s.ss)+(s.ssDefault? '*' : '')+'</td><td class="num">'+msbR(t.kF)+'</td><td class="num">'+msbMM(t.ly)+'</td><td class="num">'+msbR(t.lam)+'</td><td class="num">'+msbR(t.chi)+'</td><td class="num">'+msbKN(s.FRdTot)+'</td><td class="num">'+msbKN(cs.F)+'</td><td>'+msbEsc(cs.combo)+'</td><td class="num">'+msbR(s.eta2)+'</td><td class="num">'+msbR(s.u72)+'</td><td>'+(s.nv? '<span class="ms-warn">NOT VERIFIED</span>' : (s.eta2<=1.0001&&s.u72<=1.0001)? (s===W.gov2? 'governs' : 'OK') : '<span class="ms-warn">Warning</span>')+'</td></tr>';
      }).join('')+'</tbody></table>';
  }
  h+='<div class="ms-note">'+(W.anyDefaultSs? '* s<sub>s</sub> not entered at this end: evaluated at the lower bound s<sub>s</sub> = 0 (F<sub>Rd</sub> rises with the seating length, so a station passing at 0 is verified for any seating; one failing at 0 is NOT VERIFIED until s<sub>s</sub> is entered). ' : '')+'Point loads act on the top flange (bottom flange for an upward load), reactions on the bottom flange; s<sub>s</sub> &le; h<sub>w</sub> (6.3(1)); c = distance from the bearing edge to the member end; type (c) is evaluated whenever s<sub>s</sub> + c &lt; 2h<sub>w</sub>/3 (k<sub>F</sub>(c) &lt; 6) and the lower F<sub>Rd</sub> of types (a) and (c) governs; a load over an end holding U<sub>z</sub> is type (b) with F<sub>Ed</sub> = max(P, R). &eta;<sub>1</sub> uses the unreduced M<sub>c.y.Rd</sub> ('+(W.cls<=2? 'W<sub>pl.y</sub>' : 'W<sub>el.y</sub>')+') [verify: EN 1993-1-5 4.6 writes &eta;<sub>1</sub> with W<sub>eff</sub>]. Distributed loads, hanger loads, the closely-spaced total-load check (6.3(3)) and flange-induced buckling (section 8) are not evaluated.</div>';
  h+=msbNotVerifiedRows(nvRows);
  return h;
}

function renderMasterSeriesBrief(a,c,sec){
  sec=sec||a.sec;
  const LT=c.ltb||null, AX=c.ax||null, B=c.buck||null, T=c.tor||null, AN=c.annex||null;
  const fullRest=(S.restraint||'full')==='full';
  const isCant=isCantilever(S);
  const eigen=!!(LT && LT.eigen);
  const ltbChecked=!fullRest && !(LT && LT.na);
  const utils=c.utils||[];
  const failed=utils.some(u=>!Number.isFinite(u.val)||u.val>1.0001);
  const unsupported=c.unsupported||[];
  const verdict=c.pass? 'PASS' : failed? 'FAIL' : 'NOT VERIFIED';
  const titleSuffix=c.pass? '' : ' ('+verdict+')';
  const famLabel = sec.isBox? (S.family==='rhs'? 'RHS ['+(sec.boxType==='CF'?'Cold-formed':'Hot-finished')+']' : 'SHS ['+(sec.boxType==='CF'?'Cold-formed':'Hot-finished')+']') : S.family==='ub'? 'UB' : S.family==='uc'? 'UC' : 'PFC';
  const secStr=msbSecName(sec.key)+' '+famLabel+' ['+S.grade+']';
  const memberName=(S.memberName&&String(S.memberName).trim())? String(S.memberName).trim() : secStr;
  const cls=c.cl.cls;
  const Wy_cm3=c.Wy/1e3;
  const gfb=a.governM.fb;
  const [xa,xb]=msbPortion(a,LT);
  const wholePortion = xa<=1e-6 && Math.abs(xb-a.L)<=1e-6;
  const nULS=a.ulsResults.length;
  const caseM=msbCaseLabel(a.governM.combo,false,a), caseD=msbCaseLabel(a.governD.combo,true,a);
  // blocking messages sorted into their blocks
  const nv={forces:[],class:[],local:[],web:[],compression:[],ltb:[],torsion:[],general:[]};
  unsupported.forEach(m=>{ let k=msbBlockFor(m); if(k==='compression' && !(B && B.Fc>1e-9)) k='local'; if(k==='torsion' && !T) k= /Annex A|k_alpha/.test(m)? 'ltb' : 'general'; nv[k].push(m); });

  let h='';
  /* ---- 5.0 Title ---- */
  h+='<div class="ms-title"><div>'+(AX? 'Axial with Moments (Member)' : 'Beam &amp; Beam-Portion (Member)')+titleSuffix+'</div>'+
     msbTorsionTitle(T,sec)+   // 20 Sep 2026: "Includes Design for Torsion ..." when torsion is active
     '<div>Member '+memberName+'</div>'+
     '<div>'+(isCant? 'Cantilever 0 to '+msbM(a.L/1000)+' m' : 'Between '+msbM(xa/1000)+' and '+msbM(xb/1000)+' m')+', in Load Case '+caseM+'</div>'+
     // [beam-v03 addition, 19 Sep 2026 scope] the seven DOF flags of each end, the derived end types, the preset name and the hinges
     '<div class="ms-ends">End conditions: '+endsConditionsLine(S)+'</div></div>';

  /* ---- 5.1 Member Loading and Member Forces ---- */
  h+=msbHead('Member Loading and Member Forces');
  const loadLines=[];
  loadLines.push('Loading Combination : '+a.governM.combo.label+(nULS>1? ' (governing moment; '+nULS+' ULS cases enabled)' : ''));
  const ecc=(ld)=> S.eccOn && ld.type!=='moment'? ' e = '+g(ld.e||0,0)+' mm'+(loadHeightPerLoadOn()? ' z<sub>g</sub> = '+g(loadZgValue(ld),0)+' mm' : '') : '';
  S.loads.filter(ld=>!ld.isSelfWeight).forEach(ld=>{
    const cs=ld.case||'?';
    if(ld.type==='udl') loadLines.push(cs+' UDL '+f1(ld.w,3)+' '+g(ld.x1)+'&ndash;'+g(ld.x2)+' m'+ecc(ld)+' ( kN/m )');
    else if(ld.type==='trap') loadLines.push(cs+' TRAP '+f1(ld.w1,3)+'&rarr;'+f1(ld.w2,3)+' '+g(ld.x1)+'&ndash;'+g(ld.x2)+' m'+ecc(ld)+' ( kN/m )');
    else if(ld.type==='point') loadLines.push(cs+' PY '+f1(ld.P,3)+' @ '+g(ld.pos)+' m'+ecc(ld)+' ( kN )');
    else if(ld.type==='moment') loadLines.push(cs+' M '+f1(ld.M,3)+' @ '+g(ld.pos)+' m ( kN.m )');
  });
  const swE=selfWeightEccentricity(sec);
  loadLines.push('G SW '+g(selfWeightValue(sec),4)+' kN/m 0&ndash;'+g(S.L)+' m'+(S.eccOn&&Math.abs(swE)>1e-9? ' e = '+g(swE,1)+' mm' : '')+' ( automatic )');
  // gamma_G,inf companions (19 Sep 2026 review): G at 1.0 (STR set B) and 0.9 (EQU set A) of every ULS combination
  // with G > 1.0, solved for the end reactions (uplift / hold-down, web bearing)
  if(a.ulsCompanions && a.ulsCompanions.length){
    loadLines.push('<b>&gamma;<sub>G,inf</sub> companions</b> (reactions only): '+a.ulsCompanions.length+' &mdash; G at 1.0 (STR set B) and 0.9 (EQU set A) of every ULS combination with G &gt; 1.0, variable factors as entered');
    a.ulsCompanions.forEach((r,i)=>loadLines.push('&nbsp;&nbsp;ULS C'+(i+1)+': '+r.combo.label));
  }
  if(a.companionNote) loadLines.push('<span class="ms-note">'+a.companionNote+'</span>');
  // 20 Sep 2026: the load list stands alone (the section load-lines figure of
  // js/05-section-view.js beside it when eccentricities / load heights are
  // entered); the sketch and the value diagrams follow the forces table.
  const secFig=(typeof sectionLoadLineView==='function' && (S.eccOn || (typeof loadHeightPerLoadOn==='function' && loadHeightPerLoadOn())))? sectionLoadLineView(sec) : '';
  h+='<div class="ms-loading'+(secFig? '' : ' ms-loading-plain')+'"><div class="ms-loadlist">'+loadLines.join('<br>')+'</div>'+(secFig? '<div class="ms-sketch">'+secFig+'</div>' : '')+'</div>';

  // member forces table
  const N=S.axial||0, Ntag=N>=0? 'C':'T';
  // 20 Sep 2026 review: the Torque Moment column is the end torque REACTION, as MasterSeries prints it: the total
  // T = GI_T phi' - EI_w phi''' (T.TEnds) when the P385 / FE torsion analysis provides it, else the St Venant part
  const torqueAt=(x)=>{ if(T && T.p385 && T.TEnds) return x<=xa+1e-6? T.TEnds[0] : T.TEnds[1]; if(T && T.p385 && T.TtEnds) return x<=xa+1e-6? T.TtEnds[0] : T.TtEnds[1]; if(a.tors && a.tors.diag) return interpAt(a.tors.diag.xs,a.tors.diag.T,x/1000); return 0; };
  const V1=msbEndShear(gfb,xa+1e-4), V2=msbEndShear(gfb,xb-1e-4);
  const M1=wholePortion? a.M0end : msbMomentAt(gfb,xa+1e-4), M2=wholePortion? a.MLend : msbMomentAt(gfb,xb-1e-4);
  const pm=msbPortionMoments(gfb,xa,xb);
  const MmaxP=wholePortion? a.Mmax : pm.Mmax, MposP=wholePortion? a.Mpos : pm.xmax/1000;
  const dfl=a.deflection||{dmax:a.dmax,dpos:a.dpos*1000};
  // [beam-v03 addition, 19 Sep 2026 scope] End 1 / End 2 reactions of the governing-moment
  // combination (a.reactions: end, type, V, M): R and M as the end type carries them, a
  // guided end "M only", a free end none; printed only when the portion end is the member end
  const reactCells=(n,xEnd)=>{
    const r=a.reactions.find(q=>q.end===n);
    if(Math.abs(xEnd-(n===1? 0 : a.L))>1e-6) return '<td class="num">&mdash;</td><td class="num">&mdash;</td>';
    if(!r) return '<td class="num">free: none</td><td class="num">&mdash;</td>';
    if(r.type==='guided') return '<td class="num">guided: M only</td><td class="num">'+f1(reactionEndMomentKNm(r),2)+'</td>';
    return '<td class="num">'+f1(r.V/1000,2)+'</td><td class="num">'+(r.type==='fixed'? f1(reactionEndMomentKNm(r),2) : '&mdash;')+'</td>';
  };
  h+='<table class="ms-forces"><thead><tr><th colspan="13" class="ms-ft">Member Forces in Load Case '+caseM+' and Maximum Deflection from Load Case '+caseD+'</th></tr>'+
     '<tr><th rowspan="2">Mem<br>ber<br>No.</th><th rowspan="2">Node<br>End1<br>End2</th><th rowspan="2">Axial<br>Force<br>(kN)</th><th rowspan="2">Torque<br>Moment<br>(kN.m)</th><th colspan="2">Shear Force<br>(kN)</th><th colspan="2">Bending Moment<br>(kN.m)</th><th colspan="2">Maximum Moment<br>(kN.m @ m)</th><th rowspan="2">Maximum<br>Deflection<br>(mm @ m)</th><th colspan="2">Reaction<br>R (kN), M (kN.m)</th></tr>'+
     '<tr><th>y-y</th><th>z-z</th><th>y-y</th><th>z-z</th><th>y-y</th><th>z-z</th><th>R</th><th>M</th></tr></thead><tbody>'+
     '<tr><td class="num">1</td><td class="num">End 1, x = '+msbM(xa/1000)+'</td><td class="num">'+f1(Math.abs(N),2)+Ntag+'</td><td class="num">'+f1(torqueAt(xa),2)+'</td><td class="num">'+f1(V1,2)+'</td><td class="num">0.00</td><td class="num">'+f1(M1,2)+'</td><td class="num">'+f1(S.Mz||0,2)+'</td><td class="num">'+f1(MmaxP,2)+'</td><td class="num">'+f1(S.Mz||0,2)+'</td><td class="num">'+f1(dfl.dmax,2)+'</td>'+reactCells(1,xa)+'</tr>'+
     '<tr><td class="num"></td><td class="num">End 2, x = '+msbM(xb/1000)+'</td><td class="num">'+f1(Math.abs(N),2)+Ntag+'</td><td class="num">'+f1(torqueAt(xb),2)+'</td><td class="num">'+f1(V2,2)+'</td><td class="num">0.00</td><td class="num">'+f1(M2,2)+'</td><td class="num">'+f1(S.Mz||0,2)+'</td><td class="num">@ '+f1(MposP,3)+'</td><td class="num">@ &mdash;</td><td class="num">@ '+f1(dfl.dpos/1000,3)+'</td>'+reactCells(2,xb)+'</tr>'+
     '</tbody></table>';
  h+='<div class="ms-note">Reactions of '+a.governM.combo.label+' at the member ends: R positive upward (a negative R is uplift), M = the end bending moment in the diagram convention (sagging positive, hogging negative); a pinned end carries no M, a guided end no R, a free end neither. V<sub>z</sub> = 0: no minor-axis shear in the single-plane model; M<sub>z</sub> is the entered constant design moment.</div>';
  // uplift / hold-down (item 1.2): one row per lifting support, in the Member Forces block
  const HD=c.holdDown||null;
  if(HD && HD.rows && HD.rows.length){
    HD.rows.forEach(u=>{
      if(u.level==='sls'){
        h+=msbRow('Uplift at SLS only, End '+u.n+' (x = '+msbM(u.pos/1000)+' m)', 'R = &minus;'+f1(Math.abs(u.RSls),2)+' kN (SLS combination '+msbEsc(u.comboSls)+'); no ULS combination lifts this end, incl. the &gamma;<sub>G,inf</sub> companions (G at 1.0 STR set B, 0.9 EQU set A) (advisory)', 'R = &minus;'+f1(Math.abs(u.RSls),2)+' kN', 'advisory');
        return;
      }
      const lbl='Hold-down '+(u.holdDown? 'provided' : 'required')+' at End '+u.n+' (x = '+msbM(u.pos/1000)+' m)';
      const vals='R = &minus;'+f1(Math.abs(u.RUls),2)+' kN (combination '+msbEsc(u.comboUls)+')'+(u.RSls!=null? '; SLS uplift &minus;'+f1(Math.abs(u.RSls),2)+' kN ('+msbEsc(u.comboSls)+')' : '')+'; '+u.nCombos+' combination(s) lift this end';
      if(u.holdDown) h+=msbRow(lbl, vals+' &mdash; design the hold-down connection for this force (advisory)', 'R = &minus;'+f1(Math.abs(u.RUls),2)+' kN', 'hold-down');
    });
    h+=msbNotVerifiedRows(nv.forces);
  }
  if(a.uplift && !a.uplift.any) h+=msbRow('Uplift', 'no end lifts in any of the '+(a.uplift.nCombos!=null? a.uplift.nCombos : a.ulsResults.length+a.slsResults.length)+' combinations (all reactions &ge; 0'+((a.ulsCompanions&&a.ulsCompanions.length)? '; incl. the '+a.ulsCompanions.length+' &gamma;<sub>G,inf</sub> companions with G at 1.0 and 0.9' : '')+')', 'R<sub>min</sub> &ge; 0', 'OK');
  // 20 Sep 2026: loading sketch + hover diagrams (V, M, delta, T) after the forces table
  h+=msbDiagramPanel(a);
  if(nULS>1 || a.slsResults.length>1){
    h+='<table class="ms-combos"><thead><tr><th>Combination</th><th>V<sub>max</sub> (kN)</th><th>M<sub>max</sub> (kN.m @ m)</th><th>&delta; (mm)</th></tr></thead><tbody>'+
       a.ulsResults.map(r=>'<tr><td>'+r.combo.label+(r===a.governM? ' (governs M)':'')+'</td><td class="num">'+f1(r.Vmax/1000,3)+'</td><td class="num">'+f1(r.Mmax/1e6,3)+' @ '+g(r.Mpos/1000,3)+'</td><td class="num">&mdash;</td></tr>').join('')+
       a.slsResults.map(r=>'<tr><td>'+r.combo.label+(r===a.governD? ' (governs &delta;)':'')+'</td><td class="num">&mdash;</td><td class="num">&mdash;</td><td class="num">'+f1(r.dmax,2)+'</td></tr>').join('')+
       '</tbody></table>';
  }

  /* ---- 5.2 Classification and Effective Area ---- */
  h+=msbHead('Classification and Effective Area (EN 1993: 2006)');
  h+=msbRow('Section ('+f1(sec.mass,1)+' kg/m)', secStr+(sec.isBox? ' D='+g(sec.D,0)+' B='+g(sec.B,0)+' t='+g(sec.tf,1) : ''),'','');
  const clsTag= cls>=4? '<span class="ms-warn">BLOCKED</span>' : 'Class '+cls;
  h+=msbRow('Class = Fn(c/t, d/t, f<sub>y</sub>, N, M<sub>y</sub>, M<sub>z</sub>)',
    f1(sec.bT,2)+', '+f1(sec.dt,2)+', '+msbInt(c.fy)+', '+f1(Math.abs(N),2)+', '+f1(c.Mx,2)+', '+f1(Math.abs(S.Mz||0),2)+'<span class="ms-inline-tag">'+msbAxialTag(sec,c.eps)+'</span>',
    '', clsTag);
  if((c.cl.webCase && c.cl.webCase!=='bending') || c.cl.mzStress){
    const wl=c.cl.wlim||[];
    const mzWeb = c.cl.mzStress? ' (M<sub>z</sub> does not stress the web of an I/H section: it lies on the z-z axis)' : '';
    h+=msbRow('Web classified for', c.cl.webCase==='bending+compression'
      ? 'bending + compression: &alpha; = '+f1(c.cl.alphaW,3)+', &psi; = '+f1(c.cl.psiW,3)+'; limits '+g(wl[0],1)+'&epsilon; / '+g(wl[1],1)+'&epsilon; / '+g(wl[2],1)+'&epsilon;'+mzWeb
      : c.cl.webCase==='bending'? 'y-y bending: limits 72&epsilon; / 83&epsilon; / 124&epsilon;'+mzWeb
      : 'biaxial: uniform-compression web bound; limits '+g(wl[0],1)+'&epsilon; / '+g(wl[1],1)+'&epsilon; / '+g(wl[2],1)+'&epsilon;',
      'Class '+c.cl.wc, 'Table 5.2');
  }
  // [beam-v03 addition, 19 Sep 2026 G3] I/H flange outstands under M_y + M_z: the outstand compressed by M_z is wholly in compression (alpha = 1)
  if(c.cl.mzStress){
    const ms=c.cl.mzStress;
    h+=msbRow('Flange outstands under M<sub>y</sub> + M<sub>z</sub> (+N)', '&sigma; = N/A + M<sub>y</sub>/W<sub>el.y</sub> &plusmn; M<sub>z</sub>y/I<sub>z</sub>: outstand compressed by M<sub>z</sub>: root '+f1(ms.compRoot,1)+', tip '+f1(ms.compTip,1)+' N/mm&sup2; (both compressive, &alpha; = 1 &rarr; 9&epsilon;/&alpha;, 10&epsilon;/&alpha;, 21&epsilon;&radic;k<sub>&sigma;</sub> &ge; 9&epsilon;/10&epsilon;/14&epsilon; bound kept); opposite outstand: root '+f1(ms.relRoot,1)+', tip '+f1(ms.relTip,1)+' N/mm&sup2; ('+ms.relState+', laxer limits, does not govern)', 'Class '+c.cl.fc, 'Table 5.2 sheet 2');
  }
  // [beam-v03 addition, 19 Sep 2026 G3] effective area of a Class-4 web in uniform compression (EN 1993-1-5 4.4)
  if(c.aeff && c.aeff.active){
    const ae=c.aeff;
    h+=msbRow('A<sub>eff</sub> = A &minus; '+(ae.nWebs>1? '2':'')+'(1 &minus; &rho;)b&#772;t<sub>w</sub>', 'web Class 4 in uniform compression: d/t = '+f1(ae.dt,2)+' &gt; 42&epsilon; = '+f1(ae.limit,2)+'; &lambda;&#772;<sub>p</sub> = (b&#772;/t)/(28.4&epsilon;&radic;k<sub>&sigma;</sub>) = '+f1(ae.dt,2)+'/(28.4 x '+f1(ae.eps,3)+' x &radic;4) = '+msbR(ae.lamP)+'; &rho; = (&lambda;&#772;<sub>p</sub> &minus; 0.055(3+&psi;))/&lambda;&#772;<sub>p</sub>&sup2; = '+msbR(ae.rho)+' (&psi; = 1); b<sub>eff</sub> = '+msbMM(ae.beff)+' mm = b<sub>e1</sub> + b<sub>e2</sub> = 2 x '+msbMM(ae.be1)+'; '+f1(ae.A/100,2)+' &minus; '+(ae.nWebs>1? '2 x ':'')+f1(ae.bineff*ae.tw/100,2)+' cm&sup2; (e<sub>N</sub> = 0, symmetric)', f1(ae.Aeff/100,2)+' cm&sup2;', 'EN 1993-1-5 4.4');
  }
  const ulsIdx=a.ulsResults.map((r,i)=>i+1), slsIdx=a.slsResults.map((r,i)=>i+1);
  h+=msbRow('Auto Design Load Cases', msbCaseRanges(ulsIdx)+(slsIdx.length? '; SLS '+msbCaseRanges(slsIdx) : ''),'','');
  h+=msbNotVerifiedRows(nv.class);

  /* ---- 5.2b Shear Capacity Check (MasterSeries block; 20 Sep 2026 order) ----
     the maximum shear of every ULS combination against V_pl.y.Rd (cl 6.2.6)
     and the cl 6.2.6(6) shear-buckling screen; no V_z.Ed line because the
     single-plane model has no minor-axis shear (MasterSeries prints one only
     with a minor-axis load) */
  h+=msbHead('Shear Capacity Check');
  h+=msbRow('V<sub>pl.y.Rd</sub> = A<sub>v</sub>f<sub>y</sub>/(&radic;3&gamma;<sub>M0</sub>)', g(c.Av,1)+' mm&sup2; x '+msbInt(c.fy)+'/(&radic;3 x 1)'+(c.avFloor!=null? ' ; A<sub>v</sub> &ge; &eta;h<sub>w</sub>t<sub>w</sub> = '+g(c.avFloor,1)+' mm&sup2;' : ''), msbKN(c.VcRd)+' kN', '6.2.6');
  h+=msbRow('V<sub>y.Ed</sub>/V<sub>pl.y.Rd</sub>', msbKN(c.Fv)+' / '+msbKN(c.VcRd)+' =', msbR(c.shearUtil), msbWarn(c.shearUtil<=1.0001));
  if(c.sbRatio!=null && c.sbLimit!=null) h+=msbRow((sec.isBox? 'd/t' : 'h<sub>w</sub>/t<sub>w</sub>')+' &le; 72&epsilon;/&eta;', f1(c.sbRatio,2)+' '+(c.sbOk? '&le;' : '&gt;')+' 72 x '+f1(c.eps,3)+'/'+g(c.eta!=null? c.eta : 1,2)+' = '+f1(c.sbLimit,2)+(c.sbOk? '' : ' (shear buckling, EN 1993-1-5 5: not evaluated)'), c.sbOk? 'no shear buckling' : '&mdash;', c.sbOk? 'OK 6.2.6(6)' : '<span class="ms-warn">BLOCKED</span>');

  /* ---- 5.3 Local Capacity Check / Moment Capacity Check ---- */
  h+=msbHead(AX? 'Local Capacity Check' : 'Moment Capacity Check M.c.y.Rd'+(fullRest? ' - Fully Restrained Beam' : ''));
  const VplMoment=(T && T.VplTRd!=null)? T.VplTRd : c.VcRd;
  // the shear coincident with the maximum moment (cl 6.2.8 low-shear test), as MasterSeries prints it here
  h+=msbRow('V<sub>y.Ed</sub>/V<sub>pl.y.Rd</sub> (at max M)', msbKN(c.VatM)+' / '+msbKN(c.VcRd)+' =', msbR(c.VatM/Math.max(c.VcRd,1e-9)), c.lowShearAtM? 'Low Shear' : 'High Shear');   // 20 Sep 2026 review: "(at max M)" in the label, as MasterSeries
  const hsReduced = !c.lowShearAtM && /6\.2\.8\(3\)/.test(msbEsc(c.hsNote));
  if(hsReduced){
    h+=msbRow('&rho; = (2V<sub>y.Ed</sub>/V<sub>pl'+(T&&T.VplTRd!=null?'.T':'')+'.Rd</sub> &minus; 1)&sup2;', '(2 x '+msbKN(c.VatM)+'/'+msbKN(VplMoment)+' &minus; 1)&sup2;', msbR(msbRhoShear(c.VatM,VplMoment)), '6.2.8(3)');
  }
  const Wlbl= cls<=2? 'W<sub>pl.y</sub>' : 'W<sub>el.y</sub>';
  h+=msbRow(hsReduced? 'M<sub>v.y.Rd</sub> = '+(c.mvForm||'(W<sub>pl.y</sub> &minus; &rho;A<sub>v</sub>&sup2;/4t<sub>w</sub>)f<sub>y</sub>/&gamma;<sub>M0</sub>') : 'M<sub>c.y.Rd</sub> = f<sub>y</sub>.'+Wlbl+'/&gamma;<sub>M0</sub>',
    msbInt(c.fy)+' x '+f1(Wy_cm3,1)+'/1'+(hsReduced&&c.rhoAtM!=null? ' with &rho; = '+msbR(c.rhoAtM) : ''), msbKNm(c.McRd)+' kN.m', hsReduced? '6.2.8' : '');
  h+=msbRow('M<sub>y.Ed</sub>/M<sub>c.y.Rd</sub>', msbKNm(c.Mx)+' / '+msbKNm(c.McRd)+' =', msbR(c.momUtil), msbWarn(c.momUtil<=1.0001));
  if(c.coex){
    const cx=c.coex;
    h+=msbRow('M<sub>y.Ed</sub>/M<sub>v.y.Rd</sub> @ x', cx.pureShearFail
      ? '@ x = '+msbM(cx.x/1000)+' m: V<sub>Ed</sub> = '+msbKN(cx.V)+' &gt; V<sub>pl.Rd</sub> = '+msbKN(cx.VplRd)+': pure shear governs'
      : '@ x = '+msbM(cx.x/1000)+' m: M = '+msbKNm(cx.M)+', V = '+msbKN(cx.V)+' &gt; 0.5V<sub>pl.Rd</sub>; &rho; = '+msbR(cx.rho||0)+'; M<sub>v.y.Rd</sub> = '+(cx.form||'')+' = '+msbKNm(cx.MvRd),
      msbR(cx.u), msbWarn(cx.u<=1.0001));
  }
  // [beam-v03 addition, 19 Sep 2026 G3] cl 6.2.10: bending + shear + axial / minor-axis at the worst high-shear station
  if(c.mvn){
    const m=c.mvn;
    const lbl= m.plastic? (m.biax? '(M<sub>y.Ed</sub>/M<sub>N.V.y.Rd</sub>)<sup>&alpha;</sup>+(M<sub>z.Ed</sub>/M<sub>N.V.z.Rd</sub>)<sup>&beta;</sup> @ x' : 'M<sub>y.Ed</sub>/M<sub>N.V.y.Rd</sub> @ x')
                        : 'N<sub>Ed</sub>/N<sub>V.Rd</sub> + M<sub>y.Ed</sub>/M<sub>v.y.Rd</sub>'+(m.biax? ' + M<sub>z.Ed</sub>/M<sub>v.z.Rd</sub>' : '')+' @ x';
    const vals='@ x = '+msbM(m.x/1000)+' m ('+msbEsc(m.combo)+'): V = '+msbKN(m.V)+', &rho; = '+msbR(m.rho)+'; N<sub>V.Rd</sub> = (A &minus; &rho;A<sub>v</sub>)f<sub>y</sub> = '+msbKN(m.NV)+', n<sub>V</sub> = '+msbR(m.nV)+'; M<sub>v.y.Rd</sub> = '+msbEsc(m.formY)+' = '+msbKNm(m.MvY)+(m.biax? '; M<sub>v.z.Rd</sub> = '+msbEsc(m.formZ)+' = '+msbKNm(m.MvZ) : '')+
      (m.plastic? '; a<sub>V</sub> = '+msbR(m.aV)+(m.afV!=null? ', a<sub>f.V</sub> = '+msbR(m.afV) : '')+(m.waiver? '; 6.2.9.1(4): no reduction (N &le; 0.25N<sub>V.Rd</sub>, N &le; 0.5h<sub>w</sub>t<sub>w</sub>(1&minus;&rho;)f<sub>y</sub>)' : '')+'; M<sub>N.V.y.Rd</sub> = '+msbKNm(m.MNVy)+(m.biax? ', M<sub>N.V.z.Rd</sub> = '+msbKNm(m.MNVz)+', &alpha; = '+g(m.alpha,2)+', &beta; = '+g(m.beta,2) : '') : '')+
      '; M<sub>y</sub> = '+msbKNm(m.M)+(m.biax? ', M<sub>z</sub> = '+msbKNm(m.Mz) : '')+', N = '+msbKN(m.N)+' ('+msbEsc(m.form)+')';
    h+=msbRow(lbl, vals, msbR(m.u), msbWarn(m.u<=1.0001)+' 6.2.10');
  }
  if(AX){
    // V_pl.z.Rd, A_v,z and M_c.z.Rd are engine values (c.ax, cl 6.2.6(3) / 6.2.5);
    // 20 Sep 2026: printed with a minor-axis moment only, as MasterSeries does
    if(AX.biax){
      if(AX.VplZ!=null) h+=msbRow('V<sub>z.Ed</sub>/V<sub>pl.z.Rd</sub>', '0 / '+msbKN(AX.VplZ)+' = (A<sub>v,z</sub> = '+g(AX.Avz,1)+' mm&sup2;; no minor-axis shear in the single-plane model)', '0.000', 'Low Shear');
      else h+=msbRow('V<sub>z.Ed</sub>/V<sub>pl.z.Rd</sub>', 'V<sub>pl.z.Rd</sub> not evaluated by the engine for this section', '&mdash;', 'not evaluated');
      if(AX.Mcz!=null) h+=msbRow('M<sub>c.z.Rd</sub> = f<sub>y</sub>.'+(cls<=2? 'W<sub>pl.z</sub>':'W<sub>el.z</sub>')+'/&gamma;<sub>M0</sub>', msbInt(c.fy)+' x '+f1(cls<=2? sec.Sy : sec.Zy,1)+'/1', msbKNm(AX.Mcz)+' kN.m', '');
      else h+=msbRow('M<sub>c.z.Rd</sub>', 'not evaluated by the engine', '&mdash;', 'not evaluated');
    }
    h+=msbRow('N<sub>pl.Rd</sub> = A<sub>g</sub>.f<sub>y</sub>/&gamma;<sub>M0</sub>', f1(sec.A,2)+' x '+msbInt(c.fy)+'/1 = (No bearing / block tearing design)', msbKN(AX.NplRd)+' kN', '');
    if(AX.aeff && AX.aeff.active) h+=msbRow('N<sub>c.Rd</sub> = A<sub>eff</sub>.f<sub>y</sub>/&gamma;<sub>M0</sub>', f1(AX.aeff.Aeff/100,2)+' x '+msbInt(c.fy)+'/1 (Class-4 web in uniform compression, cl 6.2.4(2))', msbKN(AX.NcRd)+' kN', '6.2.4');
    if(AX.tension && S.anet!=null) h+=msbRow('N<sub>u.Rd</sub> = 0.9A<sub>net</sub>f<sub>u</sub>/&gamma;<sub>M2</sub>', '0.9 x '+f1(S.anet,2)+' x '+msbInt(fuFromGrade(S.grade))+'/1.10', msbKN(AX.NuRd)+' kN', '&gamma;<sub>M2</sub> = 1.10 (UK NA)');
    if(AX.tension) h+=msbRow('n = N<sub>Ed</sub>/N<sub>t.Rd</sub>', f1(-Math.abs(N),3)+' / '+msbKN(AX.NtRd)+' =', msbR(AX.nUtil), msbWarn(AX.nUtil<=1.0001));
    else if(AX.aeff && AX.aeff.active){
      h+=msbRow('n = N<sub>Ed</sub>/N<sub>pl.Rd</sub>', f1(N,3)+' / '+msbKN(AX.NplRd)+' = (parameter of the 6.2.9 interaction)', msbR(AX.n), '');
      h+=msbRow('N<sub>Ed</sub>/N<sub>c.Rd</sub>', f1(N,3)+' / '+msbKN(AX.NcRd)+' =', msbR(AX.nUtil), msbWarn(AX.nUtil<=1.0001));
    } else h+=msbRow('n = N<sub>Ed</sub>/N<sub>pl.Rd</sub>', f1(N,3)+' / '+msbKN(AX.NplRd)+' =', msbR(AX.n), msbWarn(AX.nUtil<=1.0001));
    if(AX.cls3){
      h+=msbRow('W<sub>el.y</sub>', 'Class 3: elastic (cl 6.2.9.2)', f1(sec.Zx,1)+' cm&sup3;', '');
      h+=msbRow('M<sub>el.y.Rd</sub> = W<sub>el.y</sub>.f<sub>y</sub>/&gamma;<sub>M0</sub>', f1(sec.Zx,1)+' x '+msbInt(c.fy)+'/1', msbKNm(AX.MN)+' kN.m', '');
      if(AX.biax) h+=msbRow('M<sub>el.z.Rd</sub> = W<sub>el.z</sub>.f<sub>y</sub>/&gamma;<sub>M0</sub>', f1(sec.Zy,1)+' x '+msbInt(c.fy)+'/1', msbKNm(AX.MNz)+' kN.m', '');
      h+=msbRow('N<sub>Ed</sub>/N<sub>pl.Rd</sub> + M<sub>y.Ed</sub>/M<sub>el.y.Rd</sub> + M<sub>z.Ed</sub>/M<sub>el.z.Rd</sub>', msbR(AX.n)+' + '+msbKNm(c.Mx)+'/'+msbKNm(AX.MN)+' + '+(AX.biax? msbKNm(AX.Mz)+'/'+msbKNm(AX.MNz) : '0')+' =', msbR(AX.mUtil), msbWarn(AX.mUtil<=1.0001));
    } else if(AX.chan){
      h+=msbRow('M<sub>c.y.Rd</sub>, M<sub>c.z.Rd</sub> (channel, no M<sub>N</sub> reduction)', 'cl 6.2.1(7) linear interaction: '+AX.mnLbl, msbKNm(AX.MN)+', '+msbKNm(AX.MNz)+' kN.m', '6.2.1(7)');
      h+=msbRow('n + M<sub>y.Ed</sub>/M<sub>c.y.Rd</sub> + M<sub>z.Ed</sub>/M<sub>c.z.Rd</sub>', msbR(AX.n)+' + '+msbKNm(c.Mx)+'/'+msbKNm(AX.MN)+' + '+(AX.biax? msbKNm(AX.Mz)+'/'+msbKNm(AX.MNz) : '0')+' =', msbR(AX.mUtil), msbWarn(AX.mUtil<=1.0001));
    } else {
      const waiver=/small axial/.test(msbEsc(AX.mnLbl));
      h+=msbRow('W<sub>pl.N.y</sub> = Fn(W<sub>pl.y</sub>, A<sub>vy</sub>, n)', f1(sec.Sx,1)+', '+f1(c.Av/100,3)+', '+msbR(AX.n), f1(msbWplN(AX.MN,c.fy),1)+' cm&sup3;', '');
      h+=msbRow('M<sub>N.y.Rd</sub> = W<sub>pl.N.y</sub>.f<sub>y</sub>/&gamma;<sub>M0</sub>', f1(msbWplN(AX.MN,c.fy),1)+' x '+msbInt(c.fy)+'/1', msbKNm(AX.MN)+' kN.m', waiver? '6.2.9.1(4)' : '');
      if(AX.biax){
        h+=msbRow('W<sub>pl.N.z</sub> = Fn(W<sub>pl.z</sub>, A<sub>vz</sub>, n)', f1(sec.Sy,1)+', '+(AX.Avz!=null? f1(AX.Avz/100,3) : '&mdash;')+', '+msbR(AX.n), f1(msbWplN(AX.MNz,c.fy),1)+' cm&sup3;', '');
        h+=msbRow('M<sub>N.z.Rd</sub> = W<sub>pl.N.z</sub>.f<sub>y</sub>/&gamma;<sub>M0</sub>', f1(msbWplN(AX.MNz,c.fy),1)+' x '+msbInt(c.fy)+'/1', msbKNm(AX.MNz)+' kN.m', '');
      }
      h+=msbRow('(M<sub>y.Ed</sub>/M<sub>N.y.Rd</sub>)<sup>&alpha;</sup>+(M<sub>z.Ed</sub>/M<sub>N.z.Rd</sub>)<sup>&beta;</sup>',
        '('+msbKNm(c.Mx)+'/'+msbKNm(AX.MN)+')<sup>'+g(AX.alpha,2)+'</sup>+'+(AX.biax? '('+msbKNm(AX.Mz)+'/'+msbKNm(AX.MNz)+')<sup>'+g(AX.beta,2)+'</sup>' : '(0)<sup>1</sup>')+'=',
        msbR(AX.mUtil), msbWarn(AX.mUtil<=1.0001));
    }
  }
  h+=msbNotVerifiedRows(nv.local);

  /* ---- [beam-v03 addition, 19 Sep 2026] Web Transverse Forces (EN 1993-1-5 cl 6), after Local Capacity;
     20 Sep 2026: the block appears only when the engine ran the check (c.web) ---- */
  if(c.web) h+=msbWebBlock(a,c,sec,nv.web); else nv.general.push(...nv.web);

  /* ---- 5.4 Compression Resistance N.b.Rd ---- */
  if(B && B.Fc>1e-9){
    h+=msbHead('Compression Resistance N.b.Rd');
    const NcrY=msbNcr(a.E,sec.Ix,B.LcrY), NcrZ=msbNcr(a.E,sec.Iy,B.LcrZ);
    const Ky=B.Ky, Kz=(B.KzEnd!=null? B.KzEnd : B.Kz);
    const kTag=B.leOverride? 'user L<sub>E</sub>' : (B.cantStrut? 'cantilever 2.0L' : 'end fixities [verify]');
    h+=msbRow('L<sub>ey</sub> = K<sub>y</sub>.L<sub>y</sub>', g(Ky,2)+' x '+msbM(S.L)+' = ('+msbEsc(B.leOverride? B.lcrBasis : B.lcrBasisY)+')', msbM(B.LcrY/1000)+' m', kTag);
    const Acm=(B.aeffOn? B.Aeff : sec.A*100)/100, Albl=B.aeffOn? 'A<sub>eff</sub>' : 'A';
    if(B.aeffOn) h+=msbRow('A<sub>eff</sub> (Class-4 web in uniform compression)', 'N<sub>Rk</sub> = A<sub>eff</sub>f<sub>y</sub>; &lambda;&#772; = &radic;(A<sub>eff</sub>f<sub>y</sub>/N<sub>cr</sub>) (6.3.1.3(1)); Table 6.7 Class-4 column with W<sub>eff.y</sub> = W<sub>el.y</sub> (flanges Class &le; 3; web Class 4 only in uniform compression, e<sub>N</sub> = 0) [assumption printed]', f1(Acm,2)+' cm&sup2;', 'EN 1993-1-5 4.4');
    h+=msbRow('&lambda;&#772;<sub>y</sub> = &radic;'+Albl+'.f<sub>y</sub>/N<sub>cr</sub>', '&radic;'+f1(Acm,2)+'x'+msbInt(c.fy)+'/'+f1(NcrY,2)+' (N<sub>cr,y</sub> = &pi;&sup2;EI<sub>y</sub>/L<sub>ey</sub>&sup2;)', msbR(B.lamY), '');
    h+=msbRow('N<sub>b.y.Rd</sub> = '+(B.aeffOn? 'A<sub>eff</sub>' : 'Area')+'.&chi;.f<sub>y</sub>/&gamma;<sub>M1</sub>', f1(Acm,2)+'x'+msbR(B.chiY)+'x'+msbInt(c.fy)+'/10/1 =', msbKN(B.NbY)+' kN', 'Curve '+B.cvY.curve);
    h+=msbRow('L<sub>ez</sub> = K<sub>z</sub>.L<sub>z</sub>', B.lczFromRestraints? 'largest lateral-restraint spacing (&le; '+g(Kz,2)+' x '+msbM(S.L)+' from the end fixities) =' : g(Kz,2)+' x '+msbM(S.L)+' = ('+msbEsc(B.leOverride? B.lcrBasis : B.lcrBasisZ)+')', msbM(B.LcrZ/1000)+' m', B.lczFromRestraints? 'P360 6.2' : kTag);
    h+=msbRow('&lambda;&#772;<sub>z</sub> = &radic;'+Albl+'.f<sub>y</sub>/N<sub>crz</sub>', '&radic;'+f1(Acm,2)+'x'+msbInt(c.fy)+'/'+f1(NcrZ,2)+' (N<sub>cr,z</sub> = &pi;&sup2;EI<sub>z</sub>/L<sub>ez</sub>&sup2;)', msbR(B.lamZ), '');
    h+=msbRow('N<sub>b.z.Rd</sub> = '+(B.aeffOn? 'A<sub>eff</sub>' : 'Area')+'.&chi;.f<sub>y</sub>/&gamma;<sub>M1</sub>', f1(Acm,2)+'x'+msbR(B.chiZ)+'x'+msbInt(c.fy)+'/10/1 =', msbKN(B.NbZ)+' kN', 'Curve '+B.cvZ.curve);
    // [beam-v03 addition, 19 Sep 2026 G3] channel: torsional / torsional-flexural buckling (cl 6.3.1.4)
    if(B.tfb && B.tfb.ok){
      const t=B.tfb;
      h+=msbRow('i<sub>0</sub>&sup2; = i<sub>y</sub>&sup2; + i<sub>z</sub>&sup2; + y<sub>0</sub>&sup2;', f1(t.iy,2)+'&sup2; + '+f1(t.iz,2)+'&sup2; + '+f1(t.y0,2)+'&sup2; (y<sub>0</sub> = '+msbEsc(t.y0Src)+')', f1(t.i0sq,1)+' mm&sup2;', '6.3.1.4');
      h+=msbRow('N<sub>cr.T</sub> = (GI<sub>T</sub> + &pi;&sup2;EI<sub>w</sub>/L<sub>T</sub>&sup2;)/i<sub>0</sub>&sup2;', '(81000 x '+g(t.IT/1e4,2)+'e4 + &pi;&sup2; x '+msbInt(a.E)+' x '+g(t.Iw/1e12,5)+'e12/'+g(t.LT,0)+'&sup2;)/'+f1(t.i0sq,1)+' (I<sub>T</sub>, I<sub>w</sub>: '+msbEsc(t.ITSrc)+'; L<sub>T</sub> = '+msbM(t.LT/1000)+' m = '+msbEsc(t.LTSrc)+')', msbKN(t.NcrT)+' kN', '6.3.1.4');
      h+=msbRow('N<sub>cr.TF</sub> = (N<sub>cr.y</sub> + N<sub>cr.T</sub>)/2&beta; [1 &minus; &radic;(1 &minus; 4&beta;N<sub>cr.y</sub>N<sub>cr.T</sub>/(N<sub>cr.y</sub> + N<sub>cr.T</sub>)&sup2;)]', 'N<sub>cr.y</sub> = '+msbKN(t.NcrY)+' (flexure about the axis of symmetry y-y, L<sub>ey</sub>), &beta; = 1 &minus; (y<sub>0</sub>/i<sub>0</sub>)&sup2; = '+msbR(t.beta)+'; N<sub>cr</sub> = min(N<sub>cr.T</sub>, N<sub>cr.TF</sub>) = '+msbKN(t.Ncr)+' ('+t.mode+' mode)', msbKN(t.NcrTF)+' kN', '6.3.1.4');
      h+=msbRow('&lambda;&#772;<sub>T</sub> = &radic;A.f<sub>y</sub>/N<sub>cr</sub>', '&radic;'+f1(sec.A,2)+'x'+msbInt(c.fy)+'/'+msbKN(t.Ncr), msbR(t.lamT), '');
      h+=msbRow('N<sub>b.T.Rd</sub> = Area.&chi;<sub>T</sub>.f<sub>y</sub>/&gamma;<sub>M1</sub>', f1(sec.A,2)+'x'+msbR(t.chiT)+'x'+msbInt(c.fy)+'/10/1 = (curve related to z-z: Table 6.2 U-sections, any axis [verify])', msbKN(t.NbT)+' kN', 'Curve '+t.cvT.curve);
      h+=msbRow('N<sub>Ed</sub>/N<sub>b.T.Rd</sub>', msbKN(B.Fc)+' / '+msbKN(t.NbT)+' = (the lower of &chi;<sub>T</sub> and the flexural &chi; feeds U<sub>N.y</sub>, U<sub>N.z</sub>)', msbR(t.util), msbWarn(t.util<=1.0001));
    } else {
      // 20 Sep 2026: MasterSeries prints a torsional-buckling strut line (L_et, lambda_T, N_b.T.Rd) for every section; beam-v03 evaluates cl 6.3.1.4 for channels only
      h+=msbRow('L<sub>et</sub> = K<sub>t</sub>.L<sub>z</sub> ; &lambda;&#772;<sub>T</sub> ; N<sub>b.T.Rd</sub>', 'n/a - not evaluated by beam-v03 (cl 6.3.1.4 torsional / torsional-flexural buckling is evaluated for channels only)', '&mdash;', 'not evaluated');
    }
    {
      // N.Ed/N.b.Rd against the lower flexural resistance (the values U_N.y / U_N.z use; N_b.T.Rd already folded in for a channel)
      const NbYe=(B.NbYeff!=null? B.NbYeff : B.NbY), NbZe=(B.NbZeff!=null? B.NbZeff : B.NbZ), NbMin=Math.min(NbYe,NbZe), uN=B.Fc/Math.max(NbMin,1e-9);
      h+=msbRow('N<sub>Ed</sub>/N<sub>b.Rd</sub>', msbKN(B.Fc)+' / '+msbKN(NbMin)+' = (min of N<sub>b.y.Rd</sub>, N<sub>b.z.Rd</sub>'+((B.tfb&&B.tfb.ok)? ', N<sub>b.T.Rd</sub>' : '')+')', msbR(uN), msbWarn(uN<=1.0001));
    }
    h+=msbNotVerifiedRows(nv.compression);
  }

  /* ---- 5.5 Equivalent Uniform Moment Factor(s) ---- */
  // 20 Sep 2026 review: one rule on both Mcr routes - MasterSeries prints "C1 = ... Uniform" for a hollow section too
  // (SHS-L2 / RHS-L2 printouts), so the standard-route box with lambda_LT <= 0.4 (LT.na) no longer suppresses the block
  const c1Line=!fullRest && LT && !LT.failed;
  if(c1Line || B){
    // 20 Sep 2026: the C_mLT / C_mz / C_my lines exist only when the cl 6.3.3 interaction is evaluated (B), so the heading follows B, not the brief type
    h+=msbHead(B? 'Equivalent Uniform Moment Factors C1, C.mLT, C.mz, and C.my' : 'Equivalent Uniform Moment Factor C1');
    if(c1Line){
      const ci=LT.c1in;
      const ciTxt= ci? f1(ci.M1,1)+', '+f1(ci.M2,1)+', '+f1(ci.Mo,1)+', '+f1(ci.psi,3)+', '+f1(ci.mu,3) : '&mdash;';
      if(eigen){
        const lbl=msbEsc(LT.c1label);
        if(S.C1o!=null) h+=msbRow('C<sub>1</sub> = user override', 'user override; '+lbl, msbR(LT.C1), 'User');
        else if(/critical bay/.test(lbl)) h+=msbRow('C<sub>1</sub> = M<sub>cr</sub>/M<sub>cr,uniform</sub> (critical bay)', 'bay between restraints containing the eigenmode peak (x = '+msbM((LT.modePeakX||0)/1000)+' m); whole-member ratio '+msbR(LT.McrShape/Math.max(LT.McrUniform,1e-9)), msbR(LT.C1), 'NA 2.18');
        else h+=msbRow('C<sub>1</sub> = M<sub>cr</sub>/M<sub>cr,uniform</sub>', msbKNm(LT.McrShape)+' / '+msbKNm(LT.McrUniform)+' kN.m (shape only: z<sub>g</sub> = z<sub>j</sub> = 0)', msbR(LT.C1), LT.c1Trusted===false? 'not converged: k<sub>c</sub> = 1' : 'k<sub>c</sub> only');
        if(LT.std && LT.std.C1!=null && isFinite(LT.std.C1)){
          const sg=LT.c1seg||{};
          const segTxt=(sg.whole===false)? ' [segment '+msbM(sg.xa/1000)+'&ndash;'+msbM(sg.xb/1000)+' m]' : '';
          h+=msbRow((LT.std.route==='sn006a'? 'C' : 'C<sub>1</sub>')+' = fn(M<sub>1</sub>, M<sub>2</sub>, M<sub>o</sub>, &psi;, &mu;) (standard, comparison)', ciTxt+segTxt+' &mdash; '+msbEsc(LT.std.label), msbR(LT.std.C1), msbC1Tag(LT.std.label,LT.std.route));
        }
      } else {
        const C1v=(LT.C1show!=null? LT.C1show : c.C1);
        const tag= LT.cant? 'Cantilever' : msbC1Tag(LT.c1label||c.c1label, LT.c1route);
        // 20 Sep 2026: the cantilever prints the MasterSeries SN006a form "C1 = fn(M, Zg, kwt) ... Ncci-sn006" (LT.kwt, LT.zg, LT.warp of the engine)
        // 20 Sep 2026 review: a channel on the P362 kappa chain uses no C1 (lambda_LT = (L_e/i_z)/kappa) unless the
        // shear-centre Mcr route (LT.chanMcr, SN003a form) is offered; a channel cantilever / torsion case prints the
        // table value as "not used" rather than an I-section "Cantilever [SN003a]" tag
        const chanNoC1=!!(LT.channel && !LT.chanMcr);
        if(LT.cant) h+=msbRow('C<sub>1</sub> = fn(M, Z<sub>g</sub>, &kappa;<sub>wt</sub>)', 'M<sub>1</sub>, M<sub>2</sub> = '+(ci? f1(ci.M1,1)+', '+f1(ci.M2,1) : '&mdash;')+' kN.m; z<sub>g</sub> = '+g(LT.zg||0,0)+' mm; &kappa;<sub>wt</sub> = '+msbDash(LT.kwt,v=>f1(v,3))+'; "Cantilever end warping '+(LT.warp==='restr'? 'fixed' : 'free')+'"', msbR(C1v), 'Ncci-sn006');
        else if(chanNoC1) h+=msbRow('C<sub>1</sub> = fn(M<sub>1</sub>, M<sub>2</sub>, M<sub>o</sub>, &psi;, &mu;)', ciTxt+' &mdash; not used: the P362 &kappa; chain sets &lambda;&#772;<sub>LT</sub> = (L<sub>e</sub>/i<sub>z</sub>)/&kappa; without C<sub>1</sub>'+(isCant? ' (channel cantilever: the SN006a coefficients are for I sections)' : ''), '&mdash;', 'not used');
        else h+=msbRow('C<sub>1</sub> = fn(M<sub>1</sub>, M<sub>2</sub>, M<sub>o</sub>, &psi;, &mu;)', ciTxt, msbR(C1v), tag);
        h+=msbRow('C<sub>1</sub> basis', msbEsc(LT.c1label||c.c1label), '', LT.cant? 'SN006a' : chanNoC1? 'P362' : 'SN003a', 'ms-basis');
      }
    }
    if(B){
      const aB=(B.combo && nULS>1)? a.ulsResults.find(r=>r.combo.label===B.combo) : null;
      const aCm= aB? analysisForCombination(a,aB) : a;
      const p=msbCmB3Params(aCm);
      const pTxt='M<sub>h</sub> = '+f1(p.Mh,2)+', M<sub>s</sub> = '+f1(p.Ms,2)+', &psi; = '+f1(p.psi,3)+', '+(p.alphaS!=null? '&alpha;<sub>s</sub> = '+f1(p.alphaS,3) : '&alpha;<sub>h</sub> = '+f1(p.alphaH,3));
      const form=msbCmB3Form(B.cmLabel,p.alphaS)+(B.swayNote? ' &ge; 0.9 (sway mode)' : '');
      h+=msbRow('C<sub>mLT</sub> = '+form, pTxt, msbR(B.CmLT), 'Table B.3');
      h+=msbRow('C<sub>mz</sub> = Max(0.6+0.4&psi;, 0.4)', 'M = '+msbKNm(B.MzEd)+', &psi; = 1.000', msbR(B.Cmz), 'Table B.3');
      h+=msbRow('C<sub>my</sub> = '+form, pTxt, msbR(B.Cmy), 'Table B.3');
    }
  }

  /* ---- 5.6 Lateral Buckling Check M.b.Rd ---- */
  h+=msbHead('Lateral Buckling Check M.b.Rd');
  const WyTxt=f1(Wy_cm3,1);
  const lamLine=(lam,Mcr)=>msbRow('&lambda;&#772;<sub>LT</sub> = &radic;W.f<sub>y</sub>/M<sub>cr</sub>', '&radic; '+WyTxt+' x '+msbInt(c.fy)+' / '+msbKNm(Mcr), msbR(lam), '');
  const ignLine=(lam)=>msbRow('&lambda;&#772;<sub>LT</sub> &le; &lambda;&#772;<sub>LT,0</sub>', msbR(lam)+' &le; 0.4 : LTB may be ignored', '&chi;<sub>LT</sub> = 1.000', '6.3.2.2(4)');
  const chiLine=(lam,Phi,alphaLT,chi,curve)=>msbRow('&chi;<sub>LT</sub> = Fn(&lambda;&#772;<sub>LT</sub>, &Phi;<sub>LT</sub>, &alpha;<sub>LT</sub>)', msbR(lam)+', '+msbDash(Phi,v=>f1(v,3))+', '+g(alphaLT,2), msbR(chi), 'Curve '+curve);
  const chiModLine=(chi,lam,kc,f,chiMod,tag)=>msbRow('&chi;<sub>LT.mod</sub> = Fn(&chi;<sub>LT</sub>, &lambda;&#772;<sub>LT</sub>, k<sub>c</sub>, f)', msbR(chi)+', '+msbR(lam)+', '+msbDash(kc,v=>f1(v,3))+', '+msbR(f), msbR(chiMod), tag);
  const mbLine=(chiMod,Mb,capped)=>msbRow('M<sub>b.Rd</sub> = &chi;'+Wlbl+'.f<sub>y</sub>'+(capped!==false? ' &le; M<sub>c.y.Rd</sub>' : ''), msbR(chiMod)+' x '+WyTxt+' x '+msbInt(c.fy)+(capped!==false? ' &le; '+msbKNm(c.McRd) : '')+' =', msbKNm(Mb)+' kN.m', '');
  const ratioLine=(Mx,Mb)=>msbRow('M<sub>y.Ed</sub>/M<sub>b.Rd</sub>', msbKNm(Mx)+' / '+msbKNm(Mb), (Mb>0&&isFinite(c.ltbUtil))? msbR(c.ltbUtil) : '&mdash;', (Mb>0&&isFinite(c.ltbUtil))? msbWarn(c.ltbUtil<=1.0001) : 'not evaluated');
  // 20 Sep 2026 review: the MasterSeries "Section not susceptible to lateral torsional buckling" line of a hollow section
  // with lambda_LT <= 0.4, the same on both Mcr routes (the eigen route printed the chi_LT = 1 / chi_LT.mod pair instead)
  const boxIgnRow=(lam,Mb)=> S.family==='shs'
    ? msbRow('M<sub>b.Rd</sub> = M<sub>c.y.Rd</sub>', 'closed hollow section &mdash; not susceptible to LTB (&lambda;&#772;<sub>LT</sub> = '+msbR(lam)+' &le; 0.4)', msbKNm(Mb)+' kN.m', '6.3.2.1(2)')
    : msbRow('M<sub>b.Rd</sub> = M<sub>c.y.Rd</sub>', 'closed hollow section, &lambda;&#772;<sub>LT</sub> = '+msbR(lam)+' &le; 0.4: LTB may be ignored', msbKNm(Mb)+' kN.m', '6.3.2.2(4)');
  const leK=ltbLeFactor()*(S.destab?1.2:1);
  if(fullRest){
    h+=msbRow('M<sub>b.Rd</sub> = M<sub>c.y.Rd</sub>', 'Fully Restrained', msbKNm(c.McRd)+' kN.m', '');
  } else if(!LT){
    h+=msbRow('M<sub>b.Rd</sub>', 'no LTB result in the check object', '&mdash;', 'not evaluated');
  } else if(LT.box && !eigen){
    // closed section on the standard route: SN003a chain with I_w = 0
    if(LT.ignM){
      h+=boxIgnRow(LT.lamLTmcr,LT.MbRd);
      if(LT.Mcr>0) h+=msbRow('M<sub>cr</sub> (information, I<sub>w</sub> = 0)', 'SN003a with C<sub>1</sub> = '+msbR(c.C1)+', L<sub>e</sub> = '+msbM(c.LE/1000)+' m; '+msbEsc(LT.zgNote||''), msbKNm(LT.Mcr)+' kN.m', 'SN003a');
    } else {
      h+=msbRow('L<sub>e</sub> = '+g(leK,2)+' L', g(leK,2)+' x '+msbM(S.L)+' =', msbM(c.LE/1000)+' m', '');
      h+=msbRow('M<sub>cr</sub> = Fn(C<sub>1</sub>, L<sub>e</sub>, I<sub>z</sub>, I<sub>t</sub>, I<sub>w</sub> = 0, E)', msbR(c.C1)+', '+f1(c.LE/1000,3)+', '+g(sec.Iy,2)+', '+g(sec.J,2)+', 0, '+msbInt(a.E)+'; '+msbEsc(LT.zgNote||''), msbKNm(LT.Mcr)+' kN.m', LT.zgBlocked? '<span class="ms-warn">BLOCKED</span>' : 'SN003a');
      h+=lamLine(LT.lamLTmcr,LT.Mcr);
      h+=chiLine(LT.lamLTmcr,LT.PhiM,LT.curve.alphaLT,LT.chiM,LT.curve.curve);
      h+=chiModLine(LT.chiM,LT.lamLTmcr,LT.kc,LT.fM,LT.chiModM,'6.3.2.3 / NA Table NA.1');
      h+=mbLine(LT.chiModM,LT.MbRd);
    }
    h+=ratioLine(c.Mx,LT.MbRd);
  } else if(eigen){
    if(LT.failed){
      h+=msbRow('M<sub>cr</sub> = FE eigenvalue', msbEsc(LT.err), '&mdash;', '<span class="ms-warn">BLOCKED</span>');
      h+=ratioLine(c.Mx,0);
    } else {
      const sg=LT.spanGoverns? LT.spanGov : null;
      const endBc=ltbEndBcText(S, sec, true);
      if(sg) h+=msbRow('Governing bay '+msbM(sg.a/1000)+'&ndash;'+msbM(sg.b/1000)+' m (isolated, fork ends)', 'M<sub>y.Ed</sub> = '+msbKNm(sg.Ms)+', M<sub>cr</sub> = '+msbKNm(sg.Mcr)+', &lambda;&#772; = '+msbR(sg.lam)+', &chi; = '+msbR(sg.chi), msbKNm(sg.Mb)+' kN.m', 'bay by bay');
      h+=msbRow('L<sub>e</sub> = portion between restraints', endBc+((LT.vPoints||[]).length>2? '; lateral restraint points at x = '+(LT.vPoints||[]).map(x=>msbM(x/1000)).join(', ')+' m' : ''), msbM((xb-xa)/1000)+' m', 'FE');
      const zgTxt=(LT.zgValues&&LT.zgValues.length>1)? '; z<sub>g</sub> = '+LT.zgValues.map(z=>g(z,0)).join(', ')+' mm' : (Math.abs(LT.zg||0)>1e-9? '; z<sub>g</sub> = '+g(LT.zg,0)+' mm (load reversed: '+msbKNm(LT.McrRev)+')' : '');
      const mcrBad = LT.mcrConverged===false || (LT.meshError||0)>0.005;
      h+=msbRow('M<sub>cr</sub> = FE eigenvalue (n<sub>Elem</sub>, mesh error)', msbInt(LT.nElem)+' elements, '+f1((LT.meshError||0)*100,3)+' %'+(LT.nCombos>1? '; governing: '+msbEsc(LT.governCombo) : '')+zgTxt+(LT.nSolves!=null? '; '+LT.nCombos+' combination(s), '+LT.nSolves+' solve(s)'+(LT.nCached? ' + '+LT.nCached+' cached' : '') : ''), msbKNm(LT.Mcr)+' kN.m'+(sg? ' (whole member)' : ''), mcrBad? '<span class="ms-warn">BLOCKED</span>' : 'converged');
      const lam= sg? sg.lam : LT.lamLT, Mcr= sg? sg.Mcr : LT.Mcr;
      h+=lamLine(lam,Mcr);
      if(sg){
        if(lam<=0.4) h+=ignLine(lam);
        else h+=chiLine(lam,msbPhiLT(lam,LT.curve.alphaLT),LT.curve.alphaLT,sg.chi,LT.curve.curve);
        h+=chiModLine(sg.chi,lam,null,1,sg.chi,'isolated bay: f = 1');
        h+=mbLine(sg.chi,sg.Mb);
        h+=ratioLine(sg.Ms,sg.Mb);
      } else if(LT.box && (LT.ign || lam<=0.4)){
        h+=boxIgnRow(lam,LT.MbRd);   // the FE Mcr and lambda rows above stay as information
        h+=ratioLine(LT.MxGov!=null? LT.MxGov : c.Mx, LT.MbRd);
      } else {
        if(LT.ign) h+=ignLine(lam);
        else h+=chiLine(lam,LT.Phi,LT.curve.alphaLT,LT.chi,LT.curve.curve);
        h+=chiModLine(LT.chi,lam,LT.kc,LT.f,LT.chiMod,isCant? 'f = 1 (cantilever)' : (LT.kcFloored? '6.3.2.3; k<sub>c</sub> floored at 0.60 (Table 6.6)' : '6.3.2.3'));
        h+=mbLine(LT.chiMod,LT.MbRd);
        h+=ratioLine(LT.MxGov!=null? LT.MxGov : c.Mx, LT.MbRd);
      }
    }
  } else if(LT.cant){
    h+=msbRow('M<sub>cr0</sub> = (&pi;/L)&radic;(EI<sub>z</sub>GI<sub>t</sub>)', 'L = '+msbM(S.L)+' m, E = '+msbInt(a.E)+', I<sub>z</sub> = '+g(sec.Iy,2)+' cm&#8308;, I<sub>t</sub> = '+g(sec.J,2)+' cm&#8308;, G = 81000', msbKNm(LT.Mcr0)+' kN.m', 'SN006a');
    const blocked = !(LT.C>0);
    h+=msbRow('C = Fn(&kappa;<sub>wt</sub>, &eta;, warping)', f1(LT.kwt,3)+', '+f1(LT.eta,3)+', '+(LT.warp==='restr'? 'restrained' : 'free')+'; '+msbEsc(LT.caseLbl)+(LT.Cq!=null&&LT.CF!=null? '; C<sub>q</sub> = '+f1(LT.Cq,3)+', C<sub>F</sub> = '+f1(LT.CF,3)+', Eq (7)' : ''), blocked? '&mdash;' : msbR(LT.C), blocked? '<span class="ms-warn">BLOCKED</span>' : 'Tables 3.1&ndash;3.3');
    if(!blocked){
      h+=msbRow('M<sub>cr</sub> = C&middot;M<sub>cr0</sub>', msbR(LT.C)+' x '+msbKNm(LT.Mcr0), msbKNm(LT.Mcr)+' kN.m', '');
      h+=lamLine(LT.lamLTmcr,LT.Mcr);
      if(LT.ignM) h+=ignLine(LT.lamLTmcr); else h+=chiLine(LT.lamLTmcr,LT.PhiM,LT.curve.alphaLT,LT.chiM,LT.curve.curve);
      h+=chiModLine(LT.chiM,LT.lamLTmcr,null,1,LT.chiModM,'f = 1 (cantilever)');
      h+=mbLine(LT.chiModM,LT.MbRd);
    }
    h+=ratioLine(c.Mx,LT.MbRd);
  } else if(LT.channel){
    h+=msbRow('L<sub>e</sub> = '+g(leK,2)+' L', g(leK,2)+' x '+msbM(S.L)+' =', msbM(c.LE/1000)+' m', '');
    if(Math.abs(LT.zg||0)>1e-9) h+=msbRow('z<sub>g</sub>', msbEsc(LT.zgNote||''), '', 'load height');
    h+=msbRow('&lambda;&#772;<sub>LT</sub> = (L<sub>e</sub>/i<sub>z</sub>)/&kappa;', '('+g(c.LE,0)+'/'+g(LT.ry,1)+')/'+g(LT.kappa,0)+' ('+S.grade+')', msbR(LT.lamLTmcr), 'P362 channel');
    if(LT.ignM) h+=ignLine(LT.lamLTmcr); else h+=chiLine(LT.lamLTmcr,LT.PhiM,0.76,LT.chiM,'d');
    h+=msbRow('M<sub>b.Rd</sub> = &chi;W<sub>pl.y</sub>.f<sub>y</sub> (&kappa; chain, no f)', msbR(LT.chiM)+' x '+WyTxt+' x '+msbInt(c.fy)+' =', msbKNm(LT.MbSimp)+' kN.m', '');
    h+=msbRow('M<sub>cr</sub> (back-calculated) = W.f<sub>y</sub>/&lambda;&#772;<sub>LT</sub>&sup2;', WyTxt+' x '+msbInt(c.fy)+' / '+msbR(LT.lamLTmcr)+'&sup2;', msbKNm(LT.McrBack)+' kN.m', 'Annex A only');
    if(LT.chanMcr){
      const cm=LT.chanMcr;
      h+=msbRow('M<sub>cr</sub> route (load through the shear centre)', 'M<sub>cr</sub> = '+msbKNm(cm.Mcr)+', &lambda;&#772; = '+msbR(cm.lam)+', &chi; = '+msbR(cm.chi)+', f = '+msbR(cm.f)+', &chi;<sub>mod</sub> = '+msbR(cm.chiMod), msbKNm(cm.Mb)+' kN.m', 'SN003a (z<sub>j</sub> = 0)');
    }
    if(Math.abs(LT.MbRd-LT.MbSimp)>1e-6) h+=msbRow('M<sub>b.Rd</sub> (design basis)', msbEsc(c.ltbBasis), msbKNm(LT.MbRd)+' kN.m', '');
    h+=ratioLine(c.Mx,LT.MbRd);
  } else {
    // D. standard closed form, SN003a (I/H)
    h+=msbRow('L<sub>e</sub> = '+g(leK,2)+' L', g(leK,2)+' x '+msbM(S.L)+' =', msbM(c.LE/1000)+' m', '');
    h+=msbRow('M<sub>cr</sub> = Fn(C<sub>1</sub>, L<sub>e</sub>, I<sub>z</sub>, I<sub>t</sub>, I<sub>w</sub>, E)', msbR(c.C1)+', '+f1(c.LE/1000,3)+', '+g(sec.Iy,2)+', '+g(sec.J,2)+', '+g(sec.Iw||0,4)+', '+msbInt(a.E)+(LT.zgUsed? ', C<sub>2</sub>z<sub>g</sub> = '+g(LT.C2*LT.zg,1)+' mm' : '')+'; '+msbEsc(LT.zgNote||''), msbKNm(LT.Mcr)+' kN.m', LT.zgBlocked? '<span class="ms-warn">BLOCKED</span>' : 'SN003a');
    h+=lamLine(LT.lamLTmcr,LT.Mcr);
    if(LT.ignM) h+=ignLine(LT.lamLTmcr); else h+=chiLine(LT.lamLTmcr,LT.PhiM,LT.curve.alphaLT,LT.chiM,LT.curve.curve);
    h+=chiModLine(LT.chiM,LT.lamLTmcr,LT.kc,LT.fM,LT.chiModM,LT.kcFloored? '6.3.2.3; k<sub>c</sub> floored at 0.60 (Table 6.6)' : '6.3.2.3');
    h+=mbLine(LT.chiModM,LT.MbRd);
    // [beam-v03 addition] the P362 Expn 6.55 simplified slenderness, comparison only (never the design basis)
    h+=msbRow('&lambda;&#772;<sub>LT</sub> (P362 6.55 simplified) ; M<sub>b.Rd</sub> (comparison only)', '(1/&radic;C<sub>1</sub>)0.9&lambda;&#772;<sub>z</sub>&radic;&beta;<sub>w</sub> = '+msbR(LT.lamLTsimp)+'; &chi;<sub>LT.mod</sub> = '+msbR(LT.chiModS)+'; M<sub>y.Ed</sub>/M<sub>b.Rd,simp</sub> = '+msbR(c.Mx/Math.max(LT.MbSimp,1e-9)), msbKNm(LT.MbSimp)+' kN.m', 'P362 6.55 comparison');
    h+=ratioLine(c.Mx,LT.MbRd);
  }
  h+=msbNotVerifiedRows(nv.ltb);
  // 20 Sep 2026 review: the eigen route's LTB notes (LT.warn: L_E factor ignored on this route, warping flag not
  // applied to a closed section, C1 not trusted / k_c floored, L_cr,z from the restraint spacing) were printed only
  // by the deleted CED report; they are advisory rows of this block now
  h+=msbAdvisoryRows(LT && LT.warn);
  /* ---- 7.2 portion table ---- */
  const RF=c.restraintForces||null;
  const rfRows=(RF && RF.rows)||[];
  const hasSeg=!!(LT && LT.segments && LT.segments.length);
  // 20 Sep 2026 review: a "Lateral Restraint Portions" block only with intermediate lateral restraints (bay by bay
  // and / or the restraint-force table), as MasterSeries prints no portion for a plain cantilever or fixed-ended
  // beam; the restraint design force of a support restraint with M_Ed != 0 (fixed end, cantilever root) is an
  // advisory row of this block instead. A simply supported beam (M_Ed = 0 at both supports) prints nothing.
  const rfInter=rfRows.some(r=> r.kind==='lateral' || (r.x>1e-6 && r.x<a.L-1e-6));
  if(RF && !rfInter && !hasSeg){
    rfRows.filter(r=>Math.abs(r.F)>5e-4).forEach(r=>{   // 5e-4 kN: below the printed 3 dp (a pinned end carries ~1e-5 kN.m numerically)
      h+=msbRow('Restraint design force @ '+msbM(r.x/1000)+' m', msbEsc(r.label)+': M<sub>Ed</sub> = '+msbKNm(r.MEd)+' kN.m ('+msbEsc(r.combo)+'); N<sub>f.Ed</sub> = M<sub>Ed</sub>/h = '+msbKN(r.NfEd)+' kN (h = '+msbMM(RF.h)+' mm); 2.5 % N<sub>f.Ed</sub> = (restraint design force, advisory: 6.3.5.2(5)(b), not part of the verdict)', msbKN(r.F)+' kN', 'advisory', 'ms-advrow');
    });
  }
  h+=msbModeShape(LT);   // 20 Sep 2026 review: the eigen route's buckled mode shape (was in the deleted CED report)
  if(hasSeg || rfInter){
    const rfShow=rfInter;
    h+=msbHead(hasSeg? 'Lateral Restraint Portions (bay by bay, fork ends)' : 'Lateral Restraint Portions (restraint design forces)');
    if(hasSeg){
      let worst=null; LT.segments.forEach(s2=>{ if(s2.ok && (!worst||s2.util>worst.util)) worst=s2; });
      h+='<table class="ms-combos"><thead><tr><th>Portion</th><th>From &ndash; To (m)</th><th>L<sub>e</sub> (m)</th><th>M<sub>y.Ed</sub> (kN.m)</th><th>M<sub>cr</sub> (kN.m)</th><th>&lambda;&#772;<sub>LT</sub></th><th>&chi;<sub>LT</sub></th><th>M<sub>b.Rd</sub> (kN.m)</th><th>M<sub>y.Ed</sub>/M<sub>b.Rd</sub></th><th></th></tr></thead><tbody>'+
         LT.segments.map((s2,i)=>'<tr><td class="num">'+(i+1)+'</td><td class="num">'+msbM(s2.a/1000)+' &ndash; '+msbM(s2.b/1000)+'</td><td class="num">'+msbM((s2.b-s2.a)/1000)+'</td>'+
           (s2.ok? '<td class="num">'+msbKNm(s2.Ms)+'</td><td class="num">'+msbKNm(s2.Mcr)+'</td><td class="num">'+msbR(s2.lam)+'</td><td class="num">'+msbR(s2.chi)+'</td><td class="num">'+msbKNm(s2.Mb)+'</td><td class="num">'+msbR(s2.util)+'</td><td>'+(s2===worst? (LT.spanGoverns? 'governs' : 'worst segment') : '')+'</td>'
                  : '<td colspan="7">not solved: '+msbEsc(s2.err)+'</td>')+'</tr>').join('')+
         '</tbody></table><div class="ms-note">&chi;<sub>LT</sub> per portion without the f-factor. Whole-member M<sub>cr</sub> = '+msbKNm(LT.Mcr)+' kN.m. '+msbEsc(c.ltbBasis)+'</div>';
    }
    // [beam-v03 addition, 19 Sep 2026 G3] restraint design forces (advisory): 2.5 % of N_f,Ed = M_Ed/h at every restraint station
    if(rfShow){
      h+='<table class="ms-combos ms-restraint"><thead><tr><th>x (m)</th><th>Restraint</th><th>M<sub>Ed</sub> (kN.m)</th><th>Load case</th><th>N<sub>f.Ed</sub> = M<sub>Ed</sub>/h (kN)</th><th>2.5 % N<sub>f.Ed</sub> (kN)</th><th></th></tr></thead><tbody>'+
        RF.rows.map(r=>'<tr><td class="num">'+msbM(r.x/1000)+'</td><td>'+msbEsc(r.label)+'</td><td class="num">'+msbKNm(r.MEd)+'</td><td>'+msbEsc(r.combo)+'</td><td class="num">'+msbKN(r.NfEd)+'</td><td class="num">'+msbKN(r.F)+'</td><td>restraint design force, advisory</td></tr>').join('')+
        '</tbody></table><div class="ms-note">h = '+msbMM(RF.h)+' mm. '+RF.basis+'</div>';
    }
  }

  /* ---- 5.7 Buckling Resistance ---- */
  // 20 Sep 2026: MasterSeries prints this block in every Axial with Moments brief (zeros for N);
  // with a tensile N_Ed the engine evaluates no cl 6.3.3 interaction (B = null) and the block says so
  if(AX && !B){
    h+=msbHead('Buckling Resistance');
    h+=msbRow('U<sub>N.y</sub>, U<sub>N.z</sub>, U<sub>M.y</sub>, U<sub>M.z</sub>, k<sub>ij</sub>, Eq 6.61 / 6.62', 'n/a - not evaluated by beam-v03 (N<sub>Ed</sub> is tensile: cl 6.3.3 member buckling is not required; lateral-torsional buckling is verified above)', '&mdash;', 'not evaluated');
  }
  if(B && (B.Fc>1e-9 || B.biax)){
    h+=msbHead('Buckling Resistance');
    const MbEff=(B.MbRdEff!=null? B.MbRdEff : B.MbRdI);
    const UMy=B.Mx/Math.max(MbEff,1e-9);
    const nTag=(u)=> B.Fc>1e-9? msbWarn(u<=1.0001) : 'N<sub>Ed</sub> = 0';
    const NRk= B.aeffOn? B.Aeff*c.fy/1000 : msbNRk(sec,c.fy);
    const tfT=(B.tfb&&B.tfb.ok)? '; min with N<sub>b.T.Rd</sub> = '+msbKN(B.tfb.NbT)+' (6.3.1.4)' : '';
    if(B.aeffOn) h+=msbRow('Table 6.7 Class-4 column', 'N<sub>Rk</sub> = A<sub>eff</sub>f<sub>y</sub> = '+msbKN(NRk)+' kN; M<sub>y.Rk</sub> = W<sub>eff.y</sub>f<sub>y</sub> with W<sub>eff.y</sub> = W<sub>el.y</sub> = '+f1(sec.Zx,1)+' cm&sup3; (flanges Class &le; 3, web Class 4 only in uniform compression, &Delta;M = 0) [assumption]; k<sub>ij</sub> from the Class 3/4 rows', '', '6.3.3');
    h+=msbRow('U<sub>N.y</sub> = N<sub>Ed</sub>/(&chi;<sub>y</sub>.N<sub>Rk</sub>/&gamma;<sub>M1</sub>)', msbKN(B.Fc)+' / '+msbKN(B.NbYeff!=null? B.NbYeff : B.NbY)+' (N<sub>Rk</sub> = '+msbKN(NRk)+tfT+')', msbR(B.ny), nTag(B.ny));
    h+=msbRow('U<sub>N.z</sub> = N<sub>Ed</sub>/(&chi;<sub>z</sub>.N<sub>Rk</sub>/&gamma;<sub>M1</sub>)', msbKN(B.Fc)+' / '+msbKN(B.NbZeff!=null? B.NbZeff : B.NbZ)+(tfT? ' ('+tfT.slice(2)+')' : ''), msbR(B.nz), nTag(B.nz));
    h+=msbRow('U<sub>M.y</sub> = M<sub>y.Ed</sub>/(&chi;<sub>LT</sub>.M<sub>y.Rk</sub>/&gamma;<sub>M1</sub>)', msbKNm(B.Mx)+' / '+msbKNm(MbEff)+' (M<sub>y.Rk</sub> = '+msbKNm(B.aeffOn? sec.Zx*1e3*c.fy/1e6 : msbMyRk(c.Wy,c.fy))+(B.aeffOn&&B.wFac!==1? '; W<sub>el.y</sub>/W<sub>pl.y</sub> = '+msbR(B.wFac)+' applied to M<sub>b.Rd</sub>' : '')+')', msbR(UMy), msbWarn(UMy<=1.0001));
    h+=msbRow('U<sub>M.z</sub> = M<sub>z.Ed</sub>/(M<sub>z.Rk</sub>/&gamma;<sub>M1</sub>)', msbKNm(B.MzEd)+' / '+msbKNm(B.Mcz), msbR(B.mzTerm), msbWarn(B.mzTerm<=1.0001));
    // 20 Sep 2026: the MasterSeries "kzy method" line (the engine's Table B.1 / B.2 choice)
    h+=msbRow('k<sub>zy</sub> method', B.useB1? 'not susceptible to torsional deformation (closed section, fully restrained, or M<sub>b.Rd</sub> = M<sub>c.y.Rd</sub>), using Table B.1' : 'M<sub>b.Rd</sub> &lt; M<sub>c.y.Rd</sub> therefore susceptible to LTB, using Table B.2', '', B.useB1? 'Table B.1' : 'Table B.2', 'ms-basis');
    if(B.c12){
      h+=msbRow('k<sub>yy</sub> = C<sub>my</sub>{1+(&lambda;&#772;<sub>y</sub>&minus;0.2)U<sub>N.y</sub>}', msbR(B.Cmy)+'{1+('+msbR(B.lamY)+'&minus;0.2)x'+msbR(B.ny)+'} &le; '+msbR(B.Cmy)+'(1+0.8x'+msbR(B.ny)+')', msbR(B.kyy), 'Table B.1');
      if(B.rhsRow){
        h+=msbRow('k<sub>zz</sub> = C<sub>mz</sub>{1+(&lambda;&#772;<sub>z</sub>&minus;0.2)U<sub>N.z</sub>}', msbR(B.Cmz)+'{1+('+msbR(B.lamZ)+'&minus;0.2)x'+msbR(B.nz)+'} &le; '+msbR(B.Cmz)+'(1+0.8x'+msbR(B.nz)+')', msbR(B.kzz), 'Table B.1 (RHS)');
        h+=msbRow('k<sub>yz</sub> = k<sub>zz</sub>', 'rectangular hollow section', msbR(B.kyz), 'Table B.1 (RHS)');
      } else {
        h+=msbRow('k<sub>zz</sub> = C<sub>mz</sub>{1+(2&lambda;&#772;<sub>z</sub>&minus;0.6)U<sub>N.z</sub>}', msbR(B.Cmz)+'{1+(2x'+msbR(B.lamZ)+'&minus;0.6)x'+msbR(B.nz)+'} &le; '+msbR(B.Cmz)+'(1+1.4x'+msbR(B.nz)+')', msbR(B.kzz), '');
        h+=msbRow('k<sub>yz</sub> = 0.6k<sub>zz</sub>', '0.6 x '+msbR(B.kzz), msbR(B.kyz), '');
      }
    } else {
      h+=msbRow('k<sub>yy</sub> = C<sub>my</sub>{1+0.6&lambda;&#772;<sub>y</sub>U<sub>N.y</sub>}', msbR(B.Cmy)+'{1+0.6x'+msbR(B.lamY)+'x'+msbR(B.ny)+'} &le; '+msbR(B.Cmy)+'(1+0.6x'+msbR(B.ny)+')', msbR(B.kyy), 'Table B.1 (Class 3)');
      h+=msbRow('k<sub>zz</sub> = C<sub>mz</sub>{1+0.6&lambda;&#772;<sub>z</sub>U<sub>N.z</sub>}', msbR(B.Cmz)+'{1+0.6x'+msbR(B.lamZ)+'x'+msbR(B.nz)+'} &le; '+msbR(B.Cmz)+'(1+0.6x'+msbR(B.nz)+')', msbR(B.kzz), '');
      h+=msbRow('k<sub>yz</sub> = k<sub>zz</sub>', '', msbR(B.kyz), '');
    }
    h+=msbRow(B.useB1? ('k<sub>zy</sub> = '+(B.c12? '0.6' : '0.8')+'k<sub>yy</sub>') : 'k<sub>zy</sub> = 1 &minus; 0.1&lambda;&#772;<sub>z</sub>U<sub>N.z</sub>/(C<sub>mLT</sub>&minus;0.25)', B.useB1? (B.c12? '0.6' : '0.8')+' x '+msbR(B.kyy) : msbEsc(B.kzyLbl)+'; &lambda;&#772;<sub>z</sub> = '+msbR(B.lamZ)+', U<sub>N.z</sub> = '+msbR(B.nz)+', C<sub>mLT</sub> = '+msbR(B.CmLT), msbR(B.kzy), B.useB1? 'Table B.1' : 'Table B.2');
    h+=msbRow('U<sub>Ny</sub>+k<sub>yy</sub>.U<sub>M.y</sub>+k<sub>yz</sub>.U<sub>M.z</sub>', msbR(B.ny)+'+'+msbR(B.kyy)+'x'+msbR(UMy)+'+'+msbR(B.kyz)+'x'+msbR(B.mzTerm), msbR(B.u1), nTag(B.u1));
    h+=msbRow('U<sub>Nz</sub>+k<sub>zy</sub>.U<sub>M.y</sub>+k<sub>zz</sub>.U<sub>M.z</sub>', msbR(B.nz)+'+'+msbR(B.kzy)+'x'+msbR(UMy)+'+'+msbR(B.kzz)+'x'+msbR(B.mzTerm), msbR(B.u2), nTag(B.u2));
  }

  /* ---- 5.8 Torsion Design ---- */
  if(T){
    h+=msbHead('Torsion Design');
    const tp=sec.tp||null;
    const Jv= tp&&tp.IT!=null? tp.IT : sec.J;
    const Hv= tp&&tp.Iw!=null? tp.Iw : sec.Iw;
    const av= T.p385? T.aa : (tp&&tp.a!=null? tp.a*1000 : null);
    h+=msbRow('J, H, a, Q<sub>f</sub>, Q<sub>w</sub>', g(Jv,2)+' cm&#8308;, '+msbDash(Hv,v=>g(v,4))+' dm&#8310;, '+msbDash(av,v=>g(v,0))+' mm, &mdash;, &mdash;', '', 'P385 App A');
    h+=msbRow('W<sub>n0</sub>, S<sub>w1</sub>', (tp&&tp.Wn0!=null? g(tp.Wn0,1)+' cm&sup2;' : '&mdash;')+', '+(tp&&tp.Sw1!=null? g(tp.Sw1,0)+' cm&#8308;' : '&mdash;')+(tp&&tp.Wn2!=null? '; W<sub>n2</sub> = '+g(tp.Wn2,1)+' cm&sup2;, S<sub>w2</sub> = '+g(tp.Sw2,1)+', S<sub>w3</sub> = '+g(tp.Sw3,1)+' cm&#8308;, e<sub>0</sub> = '+g(tp.e0,1)+', e<sub>sc</sub> = '+g(tp.esc,1)+' mm' : ''), '', 'P385 App A');
    const xT= T.p385&&T.cross? T.cross.x/1000 : (a.tors? a.tors.Tpos : 0);
    h+=msbSub('Torsion Bending Design @ '+msbM(xT)+' m');
    h+=msbRow('T<sub>Ed</sub> (max)', 'combination '+msbEsc(T.governT), msbKNm(T.TEd)+' kN.m', '');
    if(T.p385){
      // [beam-v03 addition, 19 Sep 2026 G4] method line: P385 closed forms where
      // they apply, the warping-torsion FE elsewhere (with its mesh error)
      if(T.fe){
        h+=msbRow('Torsion analysis', 'EI<sub>w</sub>&phi;&#8279; &minus; GI<sub>T</sub>&phi;&Prime; = m<sub>t</sub>(x): '+msbEsc(T.methodLabel)+'; '+T.bcText+'; closed forms not applicable: '+msbEsc((T.feReasons||[]).join('; '))+(T.nSolves!=null? '; '+T.nSolves+' FE solve(s)'+(T.nCached? ' + '+T.nCached+' cached' : '') : ''),
          'mesh error '+(T.meshError*100).toFixed(3)+' %', T.meshConverged? 'FE (&le; '+(T.meshBlock*100).toFixed(1)+' %)' : '<span class="ms-warn">BLOCKED</span>');
      } else {
        h+=msbRow('Torsion analysis', msbEsc(T.methodLabel)+'; '+T.bcText, 'L/a = '+f1(T.X,2), 'P385 App C');
      }
      h+=msbRow('&phi;<sub>max</sub> (ULS)', T.fe? 'warping-torsion FE, '+T.bcText : 'L/a = '+f1(T.X,2)+'; fork ends, warping free (P385 Cases 3/4/10)', f1(T.phiUmax,4)+' rad = '+f1(T.phiUmax*180/Math.PI,2)+'&deg;', '');
      h+=msbRow('B<sub>Ed</sub> = EI<sub>w</sub>&phi;&Prime; (max)', '@ x = '+msbM((T.BMaxPos||0)/1000)+' m', f1(T.BMax,3)+' kN.m&sup2;', '');
      h+=msbRow('M<sub>w.Ed</sub> = EI<sub>w</sub>&phi;&Prime;/(h&minus;t<sub>f</sub>)', 'max over span', msbKNm(T.MwMax)+' kN.m', '');
      h+=msbRow('M<sub>z.Ed</sub> = &phi;.M<sub>y.Ed</sub>', 'max coincident', msbKNm(T.MzMax)+' kN.m', '');
      const cr=T.cross;
      h+=msbRow(T.cls12? '(M<sub>y</sub>/M<sub>pl.y</sub>)&sup2; + M<sub>w</sub>/M<sub>pl.f</sub> + M<sub>z</sub>/M<sub>pl.z</sub>' : 'M<sub>y</sub>/M<sub>el.y</sub> + M<sub>z</sub>/M<sub>el.z</sub> + M<sub>w</sub>/M<sub>f.Rd</sub>',
        '@ x = '+msbM(cr.x/1000)+' m: '+msbKNm(cr.My)+', '+msbKNm(cr.Mw)+', '+msbKNm(cr.Mz)+' kN.m; '+(T.cls12? 'M<sub>pl.y</sub> = '+msbKNm(T.Mply)+', M<sub>pl.f</sub> = '+msbKNm(T.Mplf)+', M<sub>pl.z</sub> = '+msbKNm(T.Mplz) : 'M<sub>el.y</sub> = '+msbKNm(T.Mely)+', M<sub>el.z</sub> = '+msbKNm(T.Melz)+', M<sub>f.Rd</sub> = '+msbKNm(T.Melf)),
        msbR(cr.u), msbWarn(cr.u<=1.0001)+' P385 3.1.2');
      // MasterSeries "Combined Torsion buckling": the EN 1993-6 Annex A interaction with its amplifier k = kw.kzw.k_alpha (c.annex)
      if(AN){
        const unb = !isFinite(AN.kAlpha);
        h+=msbRow('k = k<sub>w</sub>.k<sub>zw</sub>.k<sub>&alpha;</sub>', msbR(AN.kw)+' x '+msbR(AN.kzw)+' x '+(unb? '&infin; (M<sub>y.Ed</sub> &ge; M<sub>cr</sub> = '+msbKNm(AN.McrA)+' kN.m)' : msbR(AN.kAlpha)), unb? '&mdash;' : msbR(AN.kw*AN.kzw*AN.kAlpha), 'EN 1993-6 A');
        h+=msbRow('M<sub>y</sub>/M<sub>b.Rd</sub> + C<sub>mz</sub>M<sub>z</sub>/M<sub>z.Rk</sub> + k<sub>w</sub>k<sub>zw</sub>k<sub>&alpha;</sub>M<sub>w</sub>/M<sub>f.Rk</sub>',
          unb? 'k<sub>&alpha;</sub> unbounded: M<sub>y.Ed</sub> reaches M<sub>cr</sub> = '+msbKNm(AN.McrA)+' kN.m' : '@ x = '+msbM((AN.x||0)/1000)+' m: '+msbKNm(AN.My)+'/'+msbKNm(AN.MbA)+' + '+msbR(AN.Cmz)+'x'+msbKNm(AN.Mz)+'/'+msbKNm(AN.MzR)+' + '+msbR(AN.kw)+'x'+msbR(AN.kzw)+'x'+msbR(AN.kAlpha)+'x'+msbKNm(AN.Mw)+'/'+msbKNm(AN.MfR),
          unb? '&mdash;' : msbR(AN.u), unb? '<span class="ms-warn">BLOCKED</span>' : msbWarn(AN.u<=1.0001)+' EN 1993-6 A');
      }
      h+=msbRow('End torques T<sub>t</sub>', 'St Venant part GI<sub>T</sub>&phi;&prime; at x = 0 / x = L'+(T.TEnds? '; total T = GI<sub>T</sub>&phi;&prime; &minus; EI<sub>w</sub>&phi;&#8244; = '+msbKNm(Math.abs(T.TEnds[0]))+' / '+msbKNm(Math.abs(T.TEnds[1]))+' kN.m' : ''), msbKNm(Math.abs(T.TtEnds[0]))+' / '+msbKNm(Math.abs(T.TtEnds[1]))+' kN.m', '');
      // Torsion Shear Design @ x (MasterSeries sub-block): St Venant (+ warping, channel) shear stress at the governing V-T station, the shear-torsion reduction and the ratio
      const vt=T.vt||{};
      h+=msbSub('Torsion Shear Design @ '+msbM((vt.x||0)/1000)+' m');
      h+=msbRow('&tau;<sub>t</sub>'+(T.chan? ', &tau;<sub>w</sub>' : '')+' at the V-T station', '@ x = '+msbM((vt.x||0)/1000)+' m'+(vt.combo? ' ('+msbEsc(vt.combo)+')' : '')+': T<sub>t</sub> = '+msbKNm(vt.T!=null? vt.T : 0)+' kN.m, V = '+msbKN(vt.V!=null? vt.V : c.Fv)+' kN', f1(vt.tauT||0,2)+(T.chan? ' / '+f1(vt.tauW||0,2) : '')+' N/mm&sup2;', 'P385');
      h+=msbRow(T.chan? 'V<sub>pl.T.Rd</sub> = [&radic;(1 &minus; &tau;<sub>t</sub>/(1.25f<sub>y</sub>/&radic;3)) &minus; &tau;<sub>w</sub>/(f<sub>y</sub>/&radic;3)].V<sub>pl.Rd</sub>' : 'V<sub>pl.T.Rd</sub> = &radic;(1 &minus; &tau;<sub>t</sub>/(1.25f<sub>y</sub>/&radic;3)).V<sub>pl.Rd</sub>',
        '@ x = '+msbM((vt.x||0)/1000)+' m: &tau;<sub>t</sub> = '+f1(vt.tauT||0,2)+(T.chan? ' (&tau;<sub>w</sub> = '+f1(vt.tauW||0,2)+')' : '')+' N/mm&sup2;; V<sub>pl.Rd</sub> = '+msbKN(c.VcRd)+'; S<sub>mod</sub> = V<sub>pl.T.Rd</sub>/V<sub>pl.Rd</sub> = '+msbR(T.VplTRd/Math.max(c.VcRd,1e-9)), msbKN(T.VplTRd)+' kN', '6.2.7(9)');
      h+=msbRow('V<sub>Ed</sub>/V<sub>pl.T.Rd</sub>', msbKN(vt.V!=null? vt.V : c.Fv)+' / '+msbKN(T.VplTRd), T.vtZeroCapacity? '&infin;' : msbR(T.vtUtil), msbWarn(!T.vtZeroCapacity && T.vtUtil<=1.0001));
    } else if(T.box){
      // MasterSeries box form: J, C (= W_t), tau_t.Ed = T/C, the torsion-modified local capacity (not evaluated here), then the torsion shear in the web
      h+=msbRow('W<sub>t</sub> (= C)', msbEsc(T.WtSrc)+'; I<sub>t</sub> = '+g(T.ItShow/1e4,1)+' cm&#8308;', g(T.Wt/1e3,1)+' cm&sup3;', '');
      h+=msbRow('T<sub>Rd</sub> = f<sub>y</sub>W<sub>t</sub>/(&radic;3&gamma;<sub>M0</sub>)', msbInt(c.fy)+' x '+g(T.Wt/1e3,1)+'/(&radic;3 x 1)', msbKNm(T.TRd)+' kN.m', '6.2.7(7)');
      h+=msbRow('T<sub>Ed</sub>/T<sub>Rd</sub>', msbKNm(T.TEd)+' / '+msbKNm(T.TRd), msbR(T.torUtil), msbWarn(T.torUtil<=1.0001));
      if(T.tauMax!=null) h+=msbRow('&tau;<sub>t.Ed</sub> = T<sub>Ed</sub>/W<sub>t</sub>', msbKNm(T.TEd)+' x 10&sup3;/'+g(T.Wt/1e3,1), f1(T.tauMax,2)+' N/mm&sup2;', '6.2.7(7)');
      h+=msbRow('Modified Local Capacity (M<sub>y.Ed</sub>/(M<sub>pl.y.Rd</sub>.S<sub>mod</sub>))<sup>&alpha;</sup> + (M<sub>z.Ed</sub>/(M<sub>pl.z.Rd</sub>.S<sub>mod</sub>))<sup>&beta;</sup>', 'n/a - not evaluated by beam-v03 (the cl 6.2.7 T<sub>Ed</sub>/T<sub>Rd</sub> and V<sub>pl.T.Rd</sub> checks are the verdict basis)', '&mdash;', 'not evaluated');
      const vt=T.vt||{};
      h+=msbSub('Torsion Shear Design @ '+msbM((vt.x||0)/1000)+' m');
      h+=msbRow('V<sub>pl.T.Rd</sub> = [1 &minus; &tau;<sub>t</sub>/(f<sub>y</sub>/&radic;3)].V<sub>pl.Rd</sub>', '@ x = '+msbM((vt.x||0)/1000)+' m'+(vt.combo? ' ('+msbEsc(vt.combo)+')' : '')+': T = '+msbKNm(vt.T!=null? vt.T : 0)+' kN.m, &tau;<sub>t</sub> = '+f1(vt.tau||0,2)+' N/mm&sup2;; V<sub>pl.Rd</sub> = '+msbKN(c.VcRd)+'; S<sub>mod</sub> = V<sub>pl.T.Rd</sub>/V<sub>pl.Rd</sub> = '+msbR(T.VplTRd/Math.max(c.VcRd,1e-9)), msbKN(T.VplTRd)+' kN', '6.2.7(9) Eq 6.28');
      h+=msbRow('V<sub>Ed</sub>/V<sub>pl.T.Rd</sub>', msbKN(vt.V!=null? vt.V : c.Fv)+' / '+msbKN(T.VplTRd), T.vtZeroCapacity? '&infin;' : msbR(T.vtUtil), msbWarn(!T.vtZeroCapacity && T.vtUtil<=1.0001));
    } else {
      h+=msbRow('P385 warping analysis', 'not covered for this arrangement (see NOT VERIFIED)', '&mdash;', '<span class="ms-warn">BLOCKED</span>');
    }
    h+=msbNotVerifiedRows(nv.torsion);
  }

  /* ---- blocking messages that no block above claims ---- */
  h+=msbNotVerifiedRows(nv.general);

  /* ---- 5.9 Deflection Check ---- */
  h+=msbHead('Deflection Check - Load Case '+caseD);
  const dCant = a.deflection? !!a.deflection.cant : isCant;
  const dAbs = a.deflection && a.deflection.abs!=null ? a.deflection.abs : null;
  const dAbsGov = !!(a.deflection && a.deflection.absGoverns);
  // limit label: Span/divisor (L/divisorCant when an end is vertically free), with the absolute cap when entered
  const limLbl=(cant,div)=>(cant? 'Tip &delta; &le; L/' : 'In-span &delta; &le; Span/')+msbInt(div)+(dAbs!=null? ' (&le; '+msbMM(dAbs)+' mm)' : '');
  const limVals=(sg)=>msbMM(Math.abs(sg.dmax))+' &le; '+(sg.absGoverns? msbMM(sg.abs)+' mm (absolute limit governs; '+g(sg.span,0)+' / '+msbInt(sg.divisor)+' = '+msbMM(sg.limSpan)+' mm)' : g(sg.span,0)+' / '+msbInt(sg.divisor)+' = '+msbMM(sg.limit)+' mm'+(sg.abs!=null? ' (absolute limit '+msbMM(sg.abs)+' mm not governing)' : ''))+' @ x = '+msbM(sg.dpos/1000)+' m';
  const gseg = a.deflection || {dmax:c.dmax,dpos:dfl.dpos,span:c.span,divisor:c.divisor,limit:c.dlimit,limSpan:c.dlimit,abs:null,absGoverns:false};
  h+=msbRow(limLbl(dCant,c.divisor), limVals(gseg)+(dCant? ' (vertically free end: tip deflection relative to the held end; L/'+msbInt(c.divisor)+' per UK NA to EN 1993-1-1 Table NA.2 [verify], cantilever row)' : ''), msbMM(c.dmax)+' mm', msbWarn(c.defOk)+(dAbsGov? ' abs' : ''));
  // 20 Sep 2026: with torsion active MasterSeries prints the SLS twist here - "Torq in Case n @ x: theta_max = .. rad = .. deg <= 2.00 deg";
  // the 2 degree limit is P385 guidance and stays an advisory in beam-v03 (it does not enter c.utils)
  if(T && (T.p385 || T.box)){
    const twRad= T.p385? T.phiSer : T.phiMax, twDeg= T.p385? T.phiSerDeg : T.phiDeg, twX= T.p385? T.phiSerPos : T.phiPos;
    const twN=msbCaseIndex({label:T.governTw},true,a);
    h+=msbRow('Torq in Case '+(twN!=null? twN : '?')+' @ '+msbM(twX)+' m: &theta;<sub>max</sub> &le; 2.00&deg;', f1(twRad,4)+' rad = '+f1(twDeg,2)+'&deg; &le; 2.00&deg; ('+msbEsc(T.governTw)+'; P385 guidance, advisory: does not enter the verdict)', f1(twDeg,2)+'&deg;', twDeg<=2? 'OK' : '<span class="ms-warn">&gt; 2&deg;</span> advisory');
  }

  /* ---- 5.10 Unity bar ---- */
  const findU=(re)=>{ const u=utils.find(u=>re.test(u.name)); return u? u.val : null; };
  const cells=[];
  const push=(name,val)=>{ if(val!=null && isFinite(val)) cells.push({name,val}); else if(val===undefined) return; else cells.push({name,val:null}); };
  const deflU=c.dlimit>0? c.dmax/c.dlimit : null;
  if(AX){
    // 20 Sep 2026 review: the cells carry what the block rows print - N_Ed/N_c.Rd when the Class-4 A_eff applies,
    // U_M.y against the same M_b.Rd (W_el.y/W_pl.y applied) as the printed U_M.y row, and an em dash (not 0.000)
    // for the cl 6.3.3 cells of a tension brief, where the interaction is not evaluated
    push(AX.aeff&&AX.aeff.active? 'N_Ed/N_(c.Rd)' : 'N_Ed/N_(pl.Rd)', AX.nUtil);
    push('Local', AX.mUtil);
    push('UNyz', B? Math.max(B.ny,B.nz) : null);
    push('UMyz', B? Math.max(B.Mx/Math.max(B.MbRdEff!=null? B.MbRdEff : B.MbRdI,1e-9), B.mzTerm) : (ltbChecked? c.ltbUtil : c.momUtil));
    push('Ax+M_6.61', B? B.u1 : null);
    push('Ax+M_6.62', B? B.u2 : null);
    push('Deflection', deflU);
    push('V/Vpl', c.shearUtil);
    push('MA/Mc', c.momUtil);
    if(!fullRest) push('LTB', c.ltbUtil);
  } else {
    push('MA/Mc', c.momUtil);
    push('M_(y.Ed)/M_(b.Rd)', fullRest? c.momUtil : c.ltbUtil);
    push('Deflection', deflU);
    push('V/Vpl', c.shearUtil);
  }
  const coexU=findU(/6\.2\.8|Pure shear failure/), torU=findU(/^Torsion|Bending\+torsion cross-section/), vtU=findU(/Shear\+torsion/), anU=findU(/LTB\+torsion/);
  const webU=findU(/^Web transverse force  F_Ed/), web72U=findU(/^Web transverse force \+ bending/);
  const mvnU=findU(/6\.2\.10/), tfU=findU(/6\.3\.1\.4/);
  if(coexU!=null) push('M-V', coexU);
  if(mvnU!=null) push('M-V-N', mvnU);
  if(tfU!=null) push('N_b.T', tfU);
  if(webU!=null) push('F/F_Rd', webU);
  if(web72U!=null) push('Web 7.2', web72U);
  if(torU!=null) push('Torsion', torU);
  if(vtU!=null) push('V+T', vtU);
  if(anU!=null) push('LTB+T', anU);
  const maxU=msbMaxExclDeflection(utils);
  cells.push({name:'Max', val:maxU, max:true});
  h+='<div class="ms-unity"><div class="ms-unity-head">'+cells.map(x=>'<div'+(x.max? ' class="ms-max"':'')+'>'+x.name+'</div>').join('')+'</div>'+
     '<div class="ms-unity-vals">'+cells.map(x=>'<div class="'+(x.max? 'ms-max ':'')+(x.val!=null&&x.val>1.0001? 'ms-warn':'')+'">'+(x.val==null? '&mdash;' : msbR(x.val))+'</div>').join('')+'</div></div>';

  /* ---- verdict footer ---- */
  h+='<div class="ms-verdict '+(c.pass? 'ms-pass' : 'ms-failv')+'">'+verdict+(c.gov? ' &mdash; governing '+msbEsc(c.gov.name)+' = '+msbR(c.gov.val) : '')+'</div>';
  if(unsupported.length) h+='<div class="ms-footer">'+unsupported.map(m=>'<div><span class="ms-warn">NOT COVERED:</span> '+msbEsc(m)+'</div>').join('')+'</div>';
  if(c.advisory && c.advisory.length) h+='<div class="ms-footer ms-adv">'+c.advisory.map(m=>'<div><b>ADVISORY:</b> '+msbEsc(m)+'</div>').join('')+'</div>';

  return '<div class="ms-brief'+(c.pass? '' : ' ms-fail')+'">'+h+'</div>';
}
