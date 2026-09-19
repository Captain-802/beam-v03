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
   back-substitution); no resistance is recomputed here. Where the engine
   has no value the tag column prints "not evaluated".
   Blocking messages (c.unsupported) appear as red "NOT VERIFIED" rows in
   the block of the check they concern and again in the verdict footer.
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
  const Mmid=msbMomentAt(fb,(xa+xb)/2);
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
// minor-axis plastic shear resistance, EN 1993-1-1 6.2.6(3), kN; null for channels
function msbVplZ(sec,fy,hw){
  if(sec.kind==='channel') return null;
  const A=sec.A*100;
  const Avz= sec.isBox? A*sec.B/(sec.D+sec.B) : (A-hw*sec.tw);
  return {Avz, VplZ:Avz*fy/Math.sqrt(3)/1000};
}
// minor-axis moment resistance, kN.m (class-consistent modulus, gammaM0 = 1)
function msbMcz(sec,cls,fy){ const W=cls<=2? sec.Sy : sec.Zy; return {W, Mcz:W*1e3*fy/1e6}; }
// characteristic resistances used by the cl 6.3.3 ratios
function msbNRk(sec,fy){ return sec.A*100*fy/1000; }           // kN
function msbMyRk(Wy,fy){ return Wy*fy/1e6; }                   // kN.m (Wy mm3)
function msbKc(C1){ return Math.min(1/Math.sqrt(Math.max(C1,1e-6)),1); }
// cl 6.2.8(3) shear reduction factor
function msbRhoShear(V,Vpl){ return Math.min(Math.pow(2*V/Math.max(Vpl,1e-9)-1,2),1); }
// reduced plastic modulus back-substituted from M_N,Rd, cm3
function msbWplN(MN_kNm,fy){ return MN_kNm*1e3/fy; }
// Phi_LT of cl 6.3.2.3 (the expression the check engine evaluates)
function msbPhiLT(lam,alphaLT){ return 0.5*(1+alphaLT*(lam-0.4)+0.75*lam*lam); }
// 1-based index of a combination among the enabled ULS (or SLS) combinations
function msbCaseIndex(combo,sls){
  const list=(S.combos||[]).filter(cb=>cb.on && (sls? cb.sls : !cb.sls));
  let i=list.indexOf(combo);
  if(i<0 && combo) i=list.findIndex(cb=>cb.label===combo.label);
  return i<0? null : i+1;
}
function msbCaseLabel(combo,sls){
  const n=msbCaseIndex(combo,sls);
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
function msbHead(t){ return '<div class="ms-h">'+t+'</div>'; }
function msbSub(t){ return '<div class="ms-sub">'+t+'</div>'; }

function renderMasterSeriesBrief(a,c,sec){
  sec=sec||a.sec;
  const LT=c.ltb||null, AX=c.ax||null, B=c.buck||null, T=c.tor||null, AN=c.annex||null;
  const fullRest=(S.restraint||'full')==='full';
  const isCant=(S.supports.length===1 && S.supports[0].type==='fixed');
  const eigen=!!(LT && LT.eigen);
  const ltbChecked=!fullRest && !(LT && LT.na);
  const utils=c.utils||[];
  const failed=utils.some(u=>!Number.isFinite(u.val)||u.val>1.0001);
  const unsupported=c.unsupported||[];
  const verdict=c.pass? 'PASS' : failed? 'FAIL' : 'NOT VERIFIED';
  const titleSuffix=c.pass? '' : ' ('+verdict+')';
  const famLabel = sec.isBox? (S.family==='rhs'? 'RHS [Hot-finished]' : 'SHS ['+(sec.boxType==='CF'?'Cold-formed':'Hot-finished')+']') : S.family==='ub'? 'UB' : S.family==='uc'? 'UC' : 'PFC';
  const secStr=msbSecName(sec.key)+' '+famLabel+' ['+S.grade+']';
  const memberName=(S.memberName&&String(S.memberName).trim())? String(S.memberName).trim() : secStr;
  const cls=c.cl.cls;
  const Wy_cm3=c.Wy/1e3;
  const gfb=a.governM.fb;
  const [xa,xb]=msbPortion(a,LT);
  const wholePortion = xa<=1e-6 && Math.abs(xb-a.L)<=1e-6;
  const nULS=a.ulsResults.length;
  const caseM=msbCaseLabel(a.governM.combo,false), caseD=msbCaseLabel(a.governD.combo,true);
  // blocking messages sorted into their blocks
  const nv={class:[],local:[],compression:[],ltb:[],torsion:[],general:[]};
  unsupported.forEach(m=>{ let k=msbBlockFor(m); if(k==='compression' && !(B && B.Fc>1e-9)) k='local'; if(k==='torsion' && !T) k= /Annex A|k_alpha/.test(m)? 'ltb' : 'general'; nv[k].push(m); });

  let h='';
  /* ---- 5.0 Title ---- */
  h+='<div class="ms-title"><div>'+(AX? 'Axial with Moments (Member)' : 'Beam &amp; Beam-Portion (Member)')+titleSuffix+'</div>'+
     '<div>Member '+memberName+'</div>'+
     '<div>'+(isCant? 'Cantilever 0 to '+msbM(a.L/1000)+' m' : 'Between '+msbM(xa/1000)+' and '+msbM(xb/1000)+' m')+', in Load Case '+caseM+'</div></div>';

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
  const sketch=(typeof beamDiagram==='function'? beamDiagram(a) : '')+(typeof plot==='function'? plot(a.diag.xs,a.diag.M,{color:'#1a237e',fill:'#c9d3ea',unit:'kN.m',flip:true,fmt:v=>f1(v,2)}) : '');
  h+='<div class="ms-loading"><div class="ms-loadlist">'+loadLines.join('<br>')+'</div><div class="ms-sketch">'+sketch+'</div></div>';

  // member forces table
  const N=S.axial||0, Ntag=N>=0? 'C':'T';
  const torqueAt=(x)=>{ if(T && T.p385 && T.TtEnds) return x<=xa+1e-6? T.TtEnds[0] : T.TtEnds[1]; if(a.tors && a.tors.diag) return interpAt(a.tors.diag.xs,a.tors.diag.T,x/1000); return 0; };
  const V1=msbEndShear(gfb,xa+1e-4), V2=msbEndShear(gfb,xb-1e-4);
  const M1=wholePortion? a.M0end : msbMomentAt(gfb,xa+1e-4), M2=wholePortion? a.MLend : msbMomentAt(gfb,xb-1e-4);
  const pm=msbPortionMoments(gfb,xa,xb);
  const MmaxP=wholePortion? a.Mmax : pm.Mmax, MposP=wholePortion? a.Mpos : pm.xmax/1000;
  const dfl=a.deflection||{dmax:a.dmax,dpos:a.dpos*1000};
  h+='<table class="ms-forces"><thead><tr><th colspan="12" class="ms-ft">Member Forces in Load Case '+caseM+' and Maximum Deflection from Load Case '+caseD+'</th></tr>'+
     '<tr><th rowspan="2">Mem<br>ber<br>No.</th><th rowspan="2">Node<br>End1<br>End2</th><th rowspan="2">Axial<br>Force<br>(kN)</th><th rowspan="2">Torque<br>Moment<br>(kN.m)</th><th colspan="2">Shear Force<br>(kN)</th><th colspan="2">Bending Moment<br>(kN.m)</th><th colspan="2">Maximum Moment<br>(kN.m @ m)</th><th rowspan="2">Maximum<br>Deflection<br>(mm @ m)</th></tr>'+
     '<tr><th>y-y</th><th>z-z</th><th>y-y</th><th>z-z</th><th>y-y</th><th>z-z</th></tr></thead><tbody>'+
     '<tr><td class="num">1</td><td class="num">x = '+msbM(xa/1000)+'</td><td class="num">'+f1(Math.abs(N),2)+Ntag+'</td><td class="num">'+f1(torqueAt(xa),2)+'</td><td class="num">'+f1(V1,2)+'</td><td class="num">0.00</td><td class="num">'+f1(M1,2)+'</td><td class="num">'+f1(S.Mz||0,2)+'</td><td class="num">'+f1(MmaxP,2)+'</td><td class="num">'+f1(S.Mz||0,2)+'</td><td class="num">'+f1(dfl.dmax,2)+'</td></tr>'+
     '<tr><td class="num"></td><td class="num">x = '+msbM(xb/1000)+'</td><td class="num">'+f1(Math.abs(N),2)+Ntag+'</td><td class="num">'+f1(torqueAt(xb),2)+'</td><td class="num">'+f1(V2,2)+'</td><td class="num">0.00</td><td class="num">'+f1(M2,2)+'</td><td class="num">'+f1(S.Mz||0,2)+'</td><td class="num">@ '+f1(MposP,3)+'</td><td class="num">@ &mdash;</td><td class="num">@ '+f1(dfl.dpos/1000,3)+'</td></tr>'+
     '</tbody></table>';
  const reactLine=a.reactions.map(r=>'R @ '+msbM(r.pos/1000)+' m = '+f1(r.V/1000,2)+' kN'+(r.type==='fixed'? ', M = '+f1(-r.M/1e6,2)+' kN.m' : '')).join(' &nbsp; ');
  h+='<div class="ms-note">Reactions ('+a.governM.combo.label+'): '+reactLine+'. V<sub>z</sub> = 0: no minor-axis shear in the single-plane model; M<sub>z</sub> is the entered constant design moment.</div>';
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
  if(c.cl.webCase && c.cl.webCase!=='bending'){
    const wl=c.cl.wlim||[];
    h+=msbRow('Web classified for', c.cl.webCase==='bending+compression'
      ? 'bending + compression: &alpha; = '+f1(c.cl.alphaW,3)+', &psi; = '+f1(c.cl.psiW,3)+'; limits '+g(wl[0],1)+'&epsilon; / '+g(wl[1],1)+'&epsilon; / '+g(wl[2],1)+'&epsilon;'
      : 'biaxial: uniform-compression web bound; limits '+g(wl[0],1)+'&epsilon; / '+g(wl[1],1)+'&epsilon; / '+g(wl[2],1)+'&epsilon;',
      'Class '+c.cl.wc, 'Table 5.2');
  }
  const ulsIdx=[], slsIdx=[]; let iu=0, is=0;
  (S.combos||[]).forEach(cb=>{ if(!cb.on) return; if(cb.sls){ is++; slsIdx.push(is);} else { iu++; ulsIdx.push(iu);} });
  h+=msbRow('Auto Design Load Cases', msbCaseRanges(ulsIdx)+(slsIdx.length? '; SLS '+msbCaseRanges(slsIdx) : ''),'','');
  h+=msbNotVerifiedRows(nv.class);

  /* ---- 5.3 Local Capacity Check / Moment Capacity Check ---- */
  h+=msbHead(AX? 'Local Capacity Check' : 'Moment Capacity Check M.c.y.Rd'+(fullRest? ' - Fully Restrained Beam' : ''));
  const VplMoment=(T && T.VplTRd!=null)? T.VplTRd : c.VcRd;
  h+=msbRow('V<sub>y.Ed</sub>/V<sub>pl.y.Rd</sub>', msbKN(c.VatM)+' / '+msbKN(c.VcRd)+' =', msbR(c.VatM/Math.max(c.VcRd,1e-9)), c.lowShearAtM? 'Low Shear' : 'High Shear');
  h+=msbRow('V<sub>y.Ed,max</sub>/V<sub>pl.y.Rd</sub>', msbKN(c.Fv)+' / '+msbKN(c.VcRd)+' =', msbR(c.shearUtil), msbWarn(c.shearUtil<=1.0001));
  h+=msbRow('V<sub>pl.y.Rd</sub> = A<sub>v</sub>f<sub>y</sub>/(&radic;3&gamma;<sub>M0</sub>)', g(c.Av,1)+' mm&sup2; x '+msbInt(c.fy)+'/(&radic;3 x 1)'+(c.avFloor!=null? ' ; A<sub>v</sub> &ge; &eta;h<sub>w</sub>t<sub>w</sub> = '+g(c.avFloor,1)+' mm&sup2;' : ''), msbKN(c.VcRd)+' kN', '6.2.6');
  const hsReduced = !c.lowShearAtM && /6\.2\.8\(3\)/.test(msbEsc(c.hsNote));
  if(hsReduced){
    h+=msbRow('&rho; = (2V<sub>y.Ed</sub>/V<sub>pl'+(T&&T.VplTRd!=null?'.T':'')+'.Rd</sub> &minus; 1)&sup2;', '(2 x '+msbKN(c.VatM)+'/'+msbKN(VplMoment)+' &minus; 1)&sup2;', msbR(msbRhoShear(c.VatM,VplMoment)), '6.2.8(3)');
  }
  const Wlbl= cls<=2? 'W<sub>pl.y</sub>' : 'W<sub>el.y</sub>';
  h+=msbRow(hsReduced? 'M<sub>v.y.Rd</sub> = (W<sub>pl.y</sub> &minus; &rho;A<sub>v</sub>&sup2;/4t<sub>w</sub>)f<sub>y</sub>/&gamma;<sub>M0</sub>' : 'M<sub>c.y.Rd</sub> = f<sub>y</sub>.'+Wlbl+'/&gamma;<sub>M0</sub>',
    msbInt(c.fy)+' x '+f1(Wy_cm3,1)+'/1', msbKNm(c.McRd)+' kN.m', hsReduced? '6.2.8' : '');
  h+=msbRow('M<sub>y.Ed</sub>/M<sub>c.y.Rd</sub>', msbKNm(c.Mx)+' / '+msbKNm(c.McRd)+' =', msbR(c.momUtil), msbWarn(c.momUtil<=1.0001));
  if(c.coex){
    const cx=c.coex;
    h+=msbRow('M<sub>y.Ed</sub>/M<sub>v.y.Rd</sub> @ x', cx.pureShearFail
      ? '@ x = '+msbM(cx.x/1000)+' m: V<sub>Ed</sub> = '+msbKN(cx.V)+' &gt; V<sub>pl.Rd</sub> = '+msbKN(cx.VplRd)+': pure shear governs'
      : '@ x = '+msbM(cx.x/1000)+' m: M = '+msbKNm(cx.M)+', V = '+msbKN(cx.V)+' &gt; 0.5V<sub>pl.Rd</sub>; M<sub>v.y.Rd</sub> = '+msbKNm(cx.MvRd),
      msbR(cx.u), msbWarn(cx.u<=1.0001));
  }
  if(AX){
    const vz=msbVplZ(sec,c.fy,c.hw);
    if(vz) h+=msbRow('V<sub>z.Ed</sub>/V<sub>pl.z.Rd</sub>', '0 / '+msbKN(vz.VplZ)+' = (A<sub>v,z</sub> = '+g(vz.Avz,1)+' mm&sup2;; no minor-axis shear in the single-plane model)', '0.000', 'Low Shear');
    const mz=msbMcz(sec,cls,c.fy);
    const McZ = B? B.Mcz : mz.Mcz;
    h+=msbRow('M<sub>c.z.Rd</sub> = f<sub>y</sub>.'+(cls<=2? 'W<sub>pl.z</sub>':'W<sub>el.z</sub>')+'/&gamma;<sub>M0</sub>', msbInt(c.fy)+' x '+f1(mz.W,1)+'/1', msbKNm(McZ)+' kN.m', '');
    h+=msbRow('N<sub>pl.Rd</sub> = A<sub>g</sub>.f<sub>y</sub>/&gamma;<sub>M0</sub>', f1(sec.A,2)+' x '+msbInt(c.fy)+'/1 = (No bearing / block tearing design)', msbKN(AX.NplRd)+' kN', '');
    if(AX.tension && S.anet!=null) h+=msbRow('N<sub>u.Rd</sub> = 0.9A<sub>net</sub>f<sub>u</sub>/&gamma;<sub>M2</sub>', '0.9 x '+f1(S.anet,2)+' x '+msbInt(fuFromGrade(S.grade))+'/1.10', msbKN(AX.NuRd)+' kN', '&gamma;<sub>M2</sub> = 1.10 (UK NA)');
    if(AX.tension) h+=msbRow('n = N<sub>Ed</sub>/N<sub>t.Rd</sub>', f1(-Math.abs(N),3)+' / '+msbKN(AX.NtRd)+' =', msbR(AX.nUtil), msbWarn(AX.nUtil<=1.0001));
    else h+=msbRow('n = N<sub>Ed</sub>/N<sub>pl.Rd</sub>', f1(N,3)+' / '+msbKN(AX.NplRd)+' =', msbR(AX.n), msbWarn(AX.nUtil<=1.0001));
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
        h+=msbRow('W<sub>pl.N.z</sub> = Fn(W<sub>pl.z</sub>, A<sub>vz</sub>, n)', f1(sec.Sy,1)+', '+(vz? f1(vz.Avz/100,3) : '&mdash;')+', '+msbR(AX.n), f1(msbWplN(AX.MNz,c.fy),1)+' cm&sup3;', '');
        h+=msbRow('M<sub>N.z.Rd</sub> = W<sub>pl.N.z</sub>.f<sub>y</sub>/&gamma;<sub>M0</sub>', f1(msbWplN(AX.MNz,c.fy),1)+' x '+msbInt(c.fy)+'/1', msbKNm(AX.MNz)+' kN.m', '');
      }
      h+=msbRow('(M<sub>y.Ed</sub>/M<sub>N.y.Rd</sub>)<sup>&alpha;</sup>+(M<sub>z.Ed</sub>/M<sub>N.z.Rd</sub>)<sup>&beta;</sup>',
        '('+msbKNm(c.Mx)+'/'+msbKNm(AX.MN)+')<sup>'+g(AX.alpha,2)+'</sup>+'+(AX.biax? '('+msbKNm(AX.Mz)+'/'+msbKNm(AX.MNz)+')<sup>'+g(AX.beta,2)+'</sup>' : '(0)<sup>1</sup>')+'=',
        msbR(AX.mUtil), msbWarn(AX.mUtil<=1.0001));
    }
  }
  h+=msbNotVerifiedRows(nv.local);

  /* ---- 5.4 Compression Resistance N.b.Rd ---- */
  if(B && B.Fc>1e-9){
    h+=msbHead('Compression Resistance N.b.Rd');
    const NcrY=msbNcr(a.E,sec.Ix,B.LcrY), NcrZ=msbNcr(a.E,sec.Iy,B.LcrZ);
    h+=msbRow('L<sub>ey</sub> = K<sub>y</sub>.L<sub>y</sub>', g(S.leFactor,2)+' x '+msbM(S.L)+' =', msbM(B.LcrY/1000)+' m', '');
    h+=msbRow('&lambda;&#772;<sub>y</sub> = &radic;A.f<sub>y</sub>/N<sub>cr</sub>', '&radic;'+f1(sec.A,2)+'x'+msbInt(c.fy)+'/'+f1(NcrY,2)+' (N<sub>cr,y</sub> = &pi;&sup2;EI<sub>y</sub>/L<sub>ey</sub>&sup2;)', msbR(B.lamY), '');
    h+=msbRow('N<sub>b.y.Rd</sub> = Area.&chi;.f<sub>y</sub>/&gamma;<sub>M1</sub>', f1(sec.A,2)+'x'+msbR(B.chiY)+'x'+msbInt(c.fy)+'/10/1 =', msbKN(B.NbY)+' kN', 'Curve '+B.cvY.curve);
    h+=msbRow('L<sub>ez</sub> = K<sub>z</sub>.L<sub>z</sub>', B.lczFromRestraints? 'largest lateral-restraint spacing =' : g(S.leFactor,2)+' x '+msbM(S.L)+' =', msbM(B.LcrZ/1000)+' m', B.lczFromRestraints? 'P360 6.2' : '');
    h+=msbRow('&lambda;&#772;<sub>z</sub> = &radic;A.f<sub>y</sub>/N<sub>crz</sub>', '&radic;'+f1(sec.A,2)+'x'+msbInt(c.fy)+'/'+f1(NcrZ,2)+' (N<sub>cr,z</sub> = &pi;&sup2;EI<sub>z</sub>/L<sub>ez</sub>&sup2;)', msbR(B.lamZ), '');
    h+=msbRow('N<sub>b.z.Rd</sub> = Area.&chi;.f<sub>y</sub>/&gamma;<sub>M1</sub>', f1(sec.A,2)+'x'+msbR(B.chiZ)+'x'+msbInt(c.fy)+'/10/1 =', msbKN(B.NbZ)+' kN', 'Curve '+B.cvZ.curve);
    h+=msbNotVerifiedRows(nv.compression);
  }

  /* ---- 5.5 Equivalent Uniform Moment Factor(s) ---- */
  const c1Line=ltbChecked && LT && !LT.failed;
  if(c1Line || B){
    h+=msbHead(AX? 'Equivalent Uniform Moment Factors C1, C.mLT, C.mz, and C.my' : 'Equivalent Uniform Moment Factor C1');
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
        h+=msbRow((LT.cant? 'C' : 'C<sub>1</sub>')+' = fn(M<sub>1</sub>, M<sub>2</sub>, M<sub>o</sub>, &psi;, &mu;)'+(LT.cant? ' &rarr; SN006a C' : ''), ciTxt, msbR(C1v), tag);
        h+=msbRow('C<sub>1</sub> basis', msbEsc(LT.c1label||c.c1label), '', LT.cant? 'SN006a' : 'SN003a', 'ms-basis');
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
  const leK=S.leFactor*(S.destab?1.2:1);
  if(fullRest){
    h+=msbRow('M<sub>b.Rd</sub> = M<sub>c.y.Rd</sub>', 'Fully Restrained', msbKNm(c.McRd)+' kN.m', '');
  } else if(!LT){
    h+=msbRow('M<sub>b.Rd</sub>', 'no LTB result in the check object', '&mdash;', 'not evaluated');
  } else if(LT.na){
    h+=msbRow('M<sub>b.Rd</sub> = M<sub>c.y.Rd</sub>', 'closed hollow section &mdash; not susceptible to LTB', msbKNm(LT.MbRd)+' kN.m', '6.3.2.1(2)');
    if(LT.Mcr>0) h+=msbRow('M<sub>cr</sub> (information, I<sub>w</sub> = 0)', 'SN003a with C<sub>1</sub> = '+msbR(c.C1)+', L<sub>e</sub> = '+msbM(c.LE/1000)+' m: &lambda;&#772;<sub>LT</sub> = '+msbR(LT.lamLTmcr), msbKNm(LT.Mcr)+' kN.m', 'SN003a');
    h+=ratioLine(c.Mx,LT.MbRd);
  } else if(eigen){
    if(LT.failed){
      h+=msbRow('M<sub>cr</sub> = FE eigenvalue', msbEsc(LT.err), '&mdash;', '<span class="ms-warn">BLOCKED</span>');
      h+=ratioLine(c.Mx,0);
    } else {
      const sg=LT.spanGoverns? LT.spanGov : null;
      const supExtras=S.supports.map(s=>{ const ex=[]; const vpOn= s.type==='fixed'? (S.fixedLateral!==false||s.vp) : !!s.vp; const wpOn= s.type==='fixed'? (S.rootWarp==='restrained'||s.phip) : !!s.phip; if(vpOn) ex.push('v&prime;'); if(wpOn) ex.push('&phi;&prime;'); return ex.length? 'x = '+g(+s.pos,2)+' m: +'+ex.join(', ')+' fixed' : null; }).filter(t=>t);
      if(sg) h+=msbRow('Governing span '+msbM(sg.a/1000)+'&ndash;'+msbM(sg.b/1000)+' m (isolated, fork ends)', 'M<sub>y.Ed</sub> = '+msbKNm(sg.Ms)+', M<sub>cr</sub> = '+msbKNm(sg.Mcr)+', &lambda;&#772; = '+msbR(sg.lam)+', &chi; = '+msbR(sg.chi), msbKNm(sg.Mb)+' kN.m', 'span by span');
      h+=msbRow('L<sub>e</sub> = portion between restraints', (isCant? 'root at x = 0 (fixed), tip free; root warping '+(S.rootWarp==='restrained'?'restrained':'free') : 'restraints at x = '+(LT.vPoints||[]).map(x=>msbM(x/1000)).join(', ')+' m (fork)')+(supExtras.length? '; '+supExtras.join('; ') : ''), msbM((xb-xa)/1000)+' m', 'FE');
      const zgTxt=(LT.zgValues&&LT.zgValues.length>1)? '; z<sub>g</sub> = '+LT.zgValues.map(z=>g(z,0)).join(', ')+' mm' : (Math.abs(LT.zg||0)>1e-9? '; z<sub>g</sub> = '+g(LT.zg,0)+' mm (load reversed: '+msbKNm(LT.McrRev)+')' : '');
      const mcrBad = LT.mcrConverged===false || (LT.meshError||0)>0.005;
      h+=msbRow('M<sub>cr</sub> = FE eigenvalue (n<sub>Elem</sub>, mesh error)', msbInt(LT.nElem)+' elements, '+f1((LT.meshError||0)*100,3)+' %'+(LT.nCombos>1? '; governing: '+msbEsc(LT.governCombo) : '')+zgTxt, msbKNm(LT.Mcr)+' kN.m'+(sg? ' (whole member)' : ''), mcrBad? '<span class="ms-warn">BLOCKED</span>' : 'converged');
      const lam= sg? sg.lam : LT.lamLT, Mcr= sg? sg.Mcr : LT.Mcr;
      h+=lamLine(lam,Mcr);
      if(sg){
        if(lam<=0.4) h+=ignLine(lam);
        else h+=chiLine(lam,msbPhiLT(lam,LT.curve.alphaLT),LT.curve.alphaLT,sg.chi,LT.curve.curve);
        h+=chiModLine(sg.chi,lam,null,1,sg.chi,'span: f = 1');
        h+=mbLine(sg.chi,sg.Mb);
        h+=ratioLine(sg.Ms,sg.Mb);
      } else {
        if(LT.ign) h+=ignLine(lam);
        else h+=chiLine(lam,LT.Phi,LT.curve.alphaLT,LT.chi,LT.curve.curve);
        h+=chiModLine(LT.chi,lam,LT.kc,LT.f,LT.chiMod,isCant? 'f = 1 (cantilever)' : '6.3.2.3');
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
    h+=msbRow('M<sub>cr</sub> = Fn(C<sub>1</sub>, L<sub>e</sub>, I<sub>z</sub>, I<sub>t</sub>, I<sub>w</sub>, E)', msbR(c.C1)+', '+f1(c.LE/1000,3)+', '+g(sec.Iy,2)+', '+g(sec.J,2)+', '+g(sec.Iw||0,4)+', '+msbInt(a.E)+(LT.zgUsed? ', C<sub>2</sub>z<sub>g</sub> = '+g(LT.C2*LT.zg,1)+' mm' : ''), msbKNm(LT.Mcr)+' kN.m', 'SN003a');
    h+=lamLine(LT.lamLTmcr,LT.Mcr);
    if(LT.ignM) h+=ignLine(LT.lamLTmcr); else h+=chiLine(LT.lamLTmcr,LT.PhiM,LT.curve.alphaLT,LT.chiM,LT.curve.curve);
    h+=chiModLine(LT.chiM,LT.lamLTmcr,LT.kc,LT.fM,LT.chiModM,'6.3.2.3');
    h+=mbLine(LT.chiModM,LT.MbMcr);
    if(Math.abs(LT.MbRd-LT.MbMcr)>1e-6){
      h+=msbRow('&lambda;&#772;<sub>LT</sub> (P362 6.55 simplified) ; M<sub>b.Rd</sub>', '(1/&radic;C<sub>1</sub>)0.9&lambda;&#772;<sub>z</sub>&radic;&beta;<sub>w</sub> = '+msbR(LT.lamLTsimp)+'; &chi;<sub>LT.mod</sub> = '+msbR(LT.chiModS), msbKNm(LT.MbSimp)+' kN.m', 'P362 6.55');
      h+=msbRow('M<sub>b.Rd</sub> (design basis)', msbEsc(c.ltbBasis), msbKNm(LT.MbRd)+' kN.m', '');
    }
    h+=ratioLine(c.Mx,LT.MbRd);
  }
  h+=msbNotVerifiedRows(nv.ltb);

  /* ---- 7.2 portion table ---- */
  if(LT && LT.segments && LT.segments.length){
    let worst=null; LT.segments.forEach(s2=>{ if(s2.ok && (!worst||s2.util>worst.util)) worst=s2; });
    h+=msbHead('Lateral Restraint Portions (span by span, fork ends)');
    h+='<table class="ms-combos"><thead><tr><th>Portion</th><th>From &ndash; To (m)</th><th>L<sub>e</sub> (m)</th><th>M<sub>y.Ed</sub> (kN.m)</th><th>M<sub>cr</sub> (kN.m)</th><th>&lambda;&#772;<sub>LT</sub></th><th>&chi;<sub>LT</sub></th><th>M<sub>b.Rd</sub> (kN.m)</th><th>M<sub>y.Ed</sub>/M<sub>b.Rd</sub></th><th></th></tr></thead><tbody>'+
       LT.segments.map((s2,i)=>'<tr><td class="num">'+(i+1)+'</td><td class="num">'+msbM(s2.a/1000)+' &ndash; '+msbM(s2.b/1000)+'</td><td class="num">'+msbM((s2.b-s2.a)/1000)+'</td>'+
         (s2.ok? '<td class="num">'+msbKNm(s2.Ms)+'</td><td class="num">'+msbKNm(s2.Mcr)+'</td><td class="num">'+msbR(s2.lam)+'</td><td class="num">'+msbR(s2.chi)+'</td><td class="num">'+msbKNm(s2.Mb)+'</td><td class="num">'+msbR(s2.util)+'</td><td>'+(s2===worst? (LT.spanGoverns? 'governs' : 'worst segment') : '')+'</td>'
                : '<td colspan="7">not solved: '+msbEsc(s2.err)+'</td>')+'</tr>').join('')+
       '</tbody></table><div class="ms-note">&chi;<sub>LT</sub> per portion without the f-factor. Whole-member M<sub>cr</sub> = '+msbKNm(LT.Mcr)+' kN.m. '+msbEsc(c.ltbBasis)+'</div>';
  }

  /* ---- 5.7 Buckling Resistance ---- */
  if(B && (B.Fc>1e-9 || B.biax)){
    h+=msbHead('Buckling Resistance');
    const UMy=B.Mx/Math.max(B.MbRdI,1e-9);
    const nTag=(u)=> B.Fc>1e-9? msbWarn(u<=1.0001) : 'N<sub>Ed</sub> = 0';
    h+=msbRow('U<sub>N.y</sub> = N<sub>Ed</sub>/(&chi;<sub>y</sub>.N<sub>Rk</sub>/&gamma;<sub>M1</sub>)', msbKN(B.Fc)+' / '+msbKN(B.NbY)+' (N<sub>Rk</sub> = '+msbKN(msbNRk(sec,c.fy))+')', msbR(B.ny), nTag(B.ny));
    h+=msbRow('U<sub>N.z</sub> = N<sub>Ed</sub>/(&chi;<sub>z</sub>.N<sub>Rk</sub>/&gamma;<sub>M1</sub>)', msbKN(B.Fc)+' / '+msbKN(B.NbZ), msbR(B.nz), nTag(B.nz));
    h+=msbRow('U<sub>M.y</sub> = M<sub>y.Ed</sub>/(&chi;<sub>LT</sub>.M<sub>y.Rk</sub>/&gamma;<sub>M1</sub>)', msbKNm(B.Mx)+' / '+msbKNm(B.MbRdI)+' (M<sub>y.Rk</sub> = '+msbKNm(msbMyRk(c.Wy,c.fy))+')', msbR(UMy), msbWarn(UMy<=1.0001));
    h+=msbRow('U<sub>M.z</sub> = M<sub>z.Ed</sub>/(M<sub>z.Rk</sub>/&gamma;<sub>M1</sub>)', msbKNm(B.MzEd)+' / '+msbKNm(B.Mcz), msbR(B.mzTerm), msbWarn(B.mzTerm<=1.0001));
    if(B.c12){
      h+=msbRow('k<sub>yy</sub> = C<sub>my</sub>{1+(&lambda;&#772;<sub>y</sub>&minus;0.2)U<sub>N.y</sub>}', msbR(B.Cmy)+'{1+('+msbR(B.lamY)+'&minus;0.2)x'+msbR(B.ny)+'} &le; '+msbR(B.Cmy)+'(1+0.8x'+msbR(B.ny)+')', msbR(B.kyy), 'Table B.1');
      h+=msbRow('k<sub>zz</sub> = C<sub>mz</sub>{1+(2&lambda;&#772;<sub>z</sub>&minus;0.6)U<sub>N.z</sub>}', msbR(B.Cmz)+'{1+(2x'+msbR(B.lamZ)+'&minus;0.6)x'+msbR(B.nz)+'} &le; '+msbR(B.Cmz)+'(1+1.4x'+msbR(B.nz)+')', msbR(B.kzz), '');
      h+=msbRow('k<sub>yz</sub> = 0.6k<sub>zz</sub>', '0.6 x '+msbR(B.kzz), msbR(B.kyz), '');
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
      h+=msbRow('&phi;<sub>max</sub> (ULS)', 'L/a = '+f1(T.X,2)+'; fork ends, warping free (P385 Cases 3/4/10)', f1(T.phiUmax,4)+' rad = '+f1(T.phiUmax*180/Math.PI,2)+'&deg;', '');
      h+=msbRow('M<sub>w.Ed</sub> = EI<sub>w</sub>&phi;&Prime;/(h&minus;t<sub>f</sub>)', 'max over span', msbKNm(T.MwMax)+' kN.m', '');
      h+=msbRow('M<sub>z.Ed</sub> = &phi;.M<sub>y.Ed</sub>', 'max coincident', msbKNm(T.MzMax)+' kN.m', '');
      const cr=T.cross;
      h+=msbRow(T.cls12? '(M<sub>y</sub>/M<sub>pl.y</sub>)&sup2; + M<sub>w</sub>/M<sub>pl.f</sub> + M<sub>z</sub>/M<sub>pl.z</sub>' : 'M<sub>y</sub>/M<sub>el.y</sub> + M<sub>z</sub>/M<sub>el.z</sub> + M<sub>w</sub>/M<sub>f.Rd</sub>',
        '@ x = '+msbM(cr.x/1000)+' m: '+msbKNm(cr.My)+', '+msbKNm(cr.Mw)+', '+msbKNm(cr.Mz)+' kN.m; '+(T.cls12? 'M<sub>pl.y</sub> = '+msbKNm(T.Mply)+', M<sub>pl.f</sub> = '+msbKNm(T.Mplf)+', M<sub>pl.z</sub> = '+msbKNm(T.Mplz) : 'M<sub>el.y</sub> = '+msbKNm(T.Mely)+', M<sub>el.z</sub> = '+msbKNm(T.Melz)+', M<sub>f.Rd</sub> = '+msbKNm(T.Melf)),
        msbR(cr.u), msbWarn(cr.u<=1.0001)+' P385 3.1.2');
      const vt=T.vt||{};
      h+=msbRow(T.chan? 'V<sub>pl.T.Rd</sub> = [&radic;(1 &minus; &tau;<sub>t</sub>/(1.25f<sub>y</sub>/&radic;3)) &minus; &tau;<sub>w</sub>/(f<sub>y</sub>/&radic;3)].V<sub>pl.Rd</sub>' : 'V<sub>pl.T.Rd</sub> = &radic;(1 &minus; &tau;<sub>t</sub>/(1.25f<sub>y</sub>/&radic;3)).V<sub>pl.Rd</sub>',
        '@ x = '+msbM((vt.x||0)/1000)+' m: &tau;<sub>t</sub> = '+f1(vt.tauT||0,2)+(T.chan? ' (&tau;<sub>w</sub> = '+f1(vt.tauW||0,2)+')' : '')+' N/mm&sup2;; V<sub>pl.Rd</sub> = '+msbKN(c.VcRd), msbKN(T.VplTRd)+' kN', '6.2.7(9)');
      h+=msbRow('V<sub>Ed</sub>/V<sub>pl.T.Rd</sub>', msbKN(vt.V!=null? vt.V : c.Fv)+' / '+msbKN(T.VplTRd), T.vtZeroCapacity? '&infin;' : msbR(T.vtUtil), msbWarn(!T.vtZeroCapacity && T.vtUtil<=1.0001));
      if(AN){
        const unb = !isFinite(AN.kAlpha);
        h+=msbRow('M<sub>y</sub>/M<sub>b.Rd</sub> + C<sub>mz</sub>M<sub>z</sub>/M<sub>z.Rk</sub> + k<sub>w</sub>k<sub>zw</sub>k<sub>&alpha;</sub>M<sub>w</sub>/M<sub>f.Rk</sub>',
          unb? 'k<sub>&alpha;</sub> unbounded: M<sub>y.Ed</sub> reaches M<sub>cr</sub> = '+msbKNm(AN.McrA)+' kN.m' : '@ x = '+msbM((AN.x||0)/1000)+' m: '+msbKNm(AN.My)+'/'+msbKNm(AN.MbA)+' + '+msbR(AN.Cmz)+'x'+msbKNm(AN.Mz)+'/'+msbKNm(AN.MzR)+' + '+msbR(AN.kw)+'x'+msbR(AN.kzw)+'x'+msbR(AN.kAlpha)+'x'+msbKNm(AN.Mw)+'/'+msbKNm(AN.MfR),
          unb? '&mdash;' : msbR(AN.u), unb? '<span class="ms-warn">BLOCKED</span>' : msbWarn(AN.u<=1.0001)+' EN 1993-6 A');
      }
      h+=msbRow('End torques T<sub>t</sub>', 'x = 0 / x = L', msbKNm(Math.abs(T.TtEnds[0]))+' / '+msbKNm(Math.abs(T.TtEnds[1]))+' kN.m', '');
      h+=msbRow('&theta;<sub>ser</sub> &le; &theta;<sub>limit</sub>', '@ x = '+msbM(T.phiSerPos)+' m, '+msbEsc(T.governTw)+'; limit 2&deg; (P385 guidance, advisory)', f1(T.phiSerDeg,2)+'&deg;', T.phiSerDeg<=2? 'OK' : 'review');
    } else if(T.box){
      h+=msbRow('W<sub>t</sub>', msbEsc(T.WtSrc)+'; I<sub>t</sub> = '+g(T.ItShow/1e4,1)+' cm&#8308;', g(T.Wt/1e3,1)+' cm&sup3;', '');
      h+=msbRow('T<sub>Rd</sub> = f<sub>y</sub>W<sub>t</sub>/(&radic;3&gamma;<sub>M0</sub>)', msbInt(c.fy)+' x '+g(T.Wt/1e3,1)+'/(&radic;3 x 1)', msbKNm(T.TRd)+' kN.m', '6.2.7(7)');
      h+=msbRow('T<sub>Ed</sub>/T<sub>Rd</sub>', msbKNm(T.TEd)+' / '+msbKNm(T.TRd), msbR(T.torUtil), msbWarn(T.torUtil<=1.0001));
      const vt=T.vt||{};
      h+=msbRow('V<sub>pl.T.Rd</sub> = [1 &minus; &tau;<sub>t</sub>/(f<sub>y</sub>/&radic;3)].V<sub>pl.Rd</sub>', '@ x = '+msbM((vt.x||0)/1000)+' m: &tau;<sub>t</sub> = '+f1(vt.tau||0,2)+' N/mm&sup2;', msbKN(T.VplTRd)+' kN', '6.2.7(9) Eq 6.28');
      h+=msbRow('V<sub>Ed</sub>/V<sub>pl.T.Rd</sub>', msbKN(vt.V!=null? vt.V : c.Fv)+' / '+msbKN(T.VplTRd), T.vtZeroCapacity? '&infin;' : msbR(T.vtUtil), msbWarn(!T.vtZeroCapacity && T.vtUtil<=1.0001));
      h+=msbRow('&theta; (SLS)', 'T<sub>Ed,SLS</sub> = '+msbKNm(T.TmaxSLS)+' kN.m; @ x = '+msbM(T.phiPos)+' m', f1(T.phiDeg,2)+'&deg;', T.phiDeg<=2? 'advisory' : 'review');
    } else {
      h+=msbRow('P385 warping analysis', 'not covered for this arrangement (see NOT VERIFIED)', '&mdash;', '<span class="ms-warn">BLOCKED</span>');
    }
    h+=msbNotVerifiedRows(nv.torsion);
  }

  /* ---- 5.9 Deflection Check ---- */
  h+=msbHead('Deflection Check - Load Case '+caseD);
  const defSeg = a.deflection && (a.deflection.start>1e-6 || a.deflection.end<a.L-1e-6);
  h+=msbRow((isCant? 'Tip &delta; &le; L/' : 'In-span &delta; &le; Span/')+msbInt(c.divisor), msbMM(c.dmax)+' &le; '+g(c.span,0)+' / '+msbInt(c.divisor)+' = '+msbMM(c.dlimit)+' mm @ x = '+msbM(dfl.dpos/1000)+' m'+(defSeg? ' (segment '+msbM(a.deflection.start/1000)+'&ndash;'+msbM(a.deflection.end/1000)+' m)' : ''), msbMM(c.dmax)+' mm', msbWarn(c.defOk));

  /* ---- 5.10 Unity bar ---- */
  const findU=(re)=>{ const u=utils.find(u=>re.test(u.name)); return u? u.val : null; };
  const cells=[];
  const push=(name,val)=>{ if(val!=null && isFinite(val)) cells.push({name,val}); else if(val===undefined) return; else cells.push({name,val:null}); };
  const deflU=c.dlimit>0? c.dmax/c.dlimit : null;
  if(AX){
    push('N_Ed/N_(pl.Rd)', AX.nUtil);
    push('Local', AX.mUtil);
    push('UNyz', B? Math.max(B.ny,B.nz) : 0);
    push('UMyz', B? Math.max(B.Mx/Math.max(B.MbRdI,1e-9), B.mzTerm) : (ltbChecked? c.ltbUtil : c.momUtil));
    push('Ax+M_6.61', B? B.u1 : 0);
    push('Ax+M_6.62', B? B.u2 : 0);
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
  if(coexU!=null) push('M-V', coexU);
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
