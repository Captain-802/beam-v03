function checksEC3(a){
  const sec=a.sec, fy=a.py, E=a.E; // fy reuses the same Table 9 / EN 10025-2 thickness bands
  const unsupported=[];
  const eps=epsEC3(fy);
  const gM0=1.0, gM1=1.0; // UK NA
  const cl=classifyEC3(sec,eps);
  const clsName=["","Class 1","Class 2","Class 3","Class 4"][cl.cls];
  if(cl.cls>=4) unsupported.push("EC3 Class 4 section: effective-section properties per EN 1993-1-5 are required; gross Wel is not accepted for PASS.");

  const Av=avEC3(sec);
  const VplRd=Av*fy/(Math.sqrt(3)*gM0)/1000; // kN
  const Fv=Math.abs(a.Vmax);
  const lowShear=Fv<=0.5*VplRd; // EC3 cl 6.2.8: high-shear threshold is 0.5 Vpl,Rd (not 0.6 like BS5950)
  const shearBuckle = !sec.isBox && (sec.dt/eps) > 72; // cl 6.2.6(6): web shear-buckling check needed if hw/t>72e/eta (eta~1.0 conservative)
  if(shearBuckle) unsupported.push("EC3 web shear-buckling check per EN 1993-1-5 is required and is not implemented in this calculator.");

  const Zx=sec.Zx*1e3, Sx=sec.Sx*1e3;
  let McRd = cl.cls<=2? Sx*fy/gM0/1e6 : Zx*fy/gM0/1e6;
  let hsNote=null;
  if(!lowShear){
    if(cl.cls<=2 && sec.kind==='I'){
      const rho=Math.pow(2*Fv/VplRd-1,2);
      const Sv=Av*Av/(4*sec.tw);
      McRd=Math.min(McRd,(Sx-rho*Sv)*fy/gM0/1e6);
      hsNote='high-shear reduction applied with A<sub>v</sub> /(4t<sub>w</sub>) for a rolled I/H section';
    } else {
      unsupported.push("Exact EC3 high-shear reduced moment resistance for this section family/class is not implemented.");
    }
  }

  const Ag=sec.A*1e2; // mm2 (gross; bolt-hole deduction not modelled here)
  const NRd=Ag*fy/gM0/1000; // kN
  const F=S.axial||0;
  const n=NRd>0? Math.abs(F)/NRd : 0;
  let MNRd=McRd, awNote=false;
  if(n>0.01 && cl.cls<=2){
    if(sec.kind==='channel'){
      unsupported.push("EC3 reduced moment resistance under axial force is not defined here for PFC/channel sections; use verified Blue Book/software data.");
    } else {
      const aw=Math.min(Math.max((Ag-2*sec.B*sec.tf)/Ag,0),0.5);
      MNRd=Math.min(McRd*(1-n)/(1-0.5*aw), McRd);
      awNote=true;
    }
  }
  const Mx=Math.abs(a.Mmax);
  const localUtil=MNRd>0? Mx/MNRd : 0;

  const isCant=isCantilever(S);
  const c1r = S.C1o!=null? {C1:S.C1o, method:'user override'} : computeC1(a,isCant);
  const C1=c1r.C1;

  const LE=ltbLeFactor()*(S.destab?1.2:1)*a.L;
  let MbRd,ltbUtil,lamLT=null,chiLT=null,kc=null,fmod=null,curveInfo=null,Mcr=null,chiLTmod=null;
  if(sec.isBox){
    MbRd=McRd; ltbUtil=MbRd>0? Mx/MbRd:0;
  } else {
    if(sec.kind==='channel' && Mx>1e-9) unsupported.push("EC3 PFC/channel LTB requires a channel-specific Mcr calculation including exact warping/shear-centre/load-position terms; the previous approximate Mcr path is not accepted for PASS.");
    Mcr=mcrEC3(sec,LE,E,fy,C1)/1e6; // kN.m
    const Wy=(cl.cls<=2? Sx : Zx);
    lamLT=Math.sqrt(Wy*fy/(Mcr*1e6));
    curveInfo=ltbCurveEC3(sec);
    chiLT=chiLTEC3(lamLT,curveInfo.alphaLT,0.4,0.75);
    kc=1/Math.sqrt(Math.max(C1,1e-6));
    fmod=Math.min(1-0.5*(1-kc)*(1-2*Math.pow(lamLT-0.8,2)),1.0);
    chiLTmod=Math.min(chiLT/fmod,1.0);
    MbRd=Math.min(chiLTmod*Wy*fy/gM1/1e6, McRd);
    ltbUtil=MbRd>0? Mx/MbRd:0;
  }

  const ry=sec.ry*10, rx=sec.rx*10;
  const lam1=Math.PI*Math.sqrt(E/fy);
  const curveY=strutCurveEC3(sec,'y'), curveZ=strutCurveEC3(sec,'z');
  const lamBarY=(LE/rx)/lam1, lamBarZ=(LE/ry)/lam1;
  const chiY=chiStrutEC3(lamBarY,curveY.alpha), chiZ=chiStrutEC3(lamBarZ,curveZ.alpha);
  const NbRdY=chiY*Ag*fy/gM1/1000, NbRdZ=chiZ*Ag*fy/gM1/1000;
  const Fc=Math.max(F,0);

  // Member-buckling interaction (cl 6.3.3) via Annex B, Method 2   the method
  // recommended by steelconstruction.info as "the simpler approach for manual
  // calculations" (Annex A is the alternative; both are permitted by the UK NA).
  // Table B.1 applies to members NOT susceptible to torsional deformation
  // (CHS/SHS/RHS); Table B.2 applies to members that ARE susceptible (I, H,
  // channel). The two tables share the same kyy/kzz, but differ in kyz/kzy.
  const n_ratio = Fc/Math.max(Ag*fy/gM0/1000,1e-9); // NEd/NRd
  const psiInteraction = a.M0end!==0? Math.max(-1,Math.min(1,a.MLend/(a.M0end||1e-9))) : 0;
  const endMomentOnly = Math.max(Math.abs(a.M0end),Math.abs(a.MLend)) > 0.98*Math.max(Math.abs(a.Mmax),1e-9);
  const Cm = endMomentOnly ? Math.max(0.6+0.4*psiInteraction, 0.4) : 1.0;
  const cmMethod = endMomentOnly ? 'linear end-moment diagram' : 'general transverse-load moment diagram; conservative Cm=1.0';
  const Cmy=Cm, Cmz=Cm, CmLT=Cm;

  const ny=Fc/Math.max(NbRdY,1e-9), nz=Fc/Math.max(NbRdZ,1e-9);
  let kyy,kzz,kyz,kzy;
  if(cl.cls<=2){
    kyy=Math.min(Cmy*(1+(lamBarY-0.2)*ny), Cmy*(1+0.8*ny));
    kzz=Math.min(Cmz*(1+(2*lamBarZ-0.6)*nz), Cmz*(1+1.4*nz));
  } else {
    kyy=Math.min(Cmy*(1+0.6*lamBarY*ny), Cmy*(1+0.6*ny));
    kzz=Math.min(Cmz*(1+0.6*lamBarZ*nz), Cmz*(1+0.6*nz));
  }
  if(sec.isBox){ // Table B.1   not susceptible to torsional deformation
    kyz=kzz;
    kzy=Math.min(0.8*kyy, kyy);
  } else { // Table B.2   susceptible to torsional deformation (I/H/channel)
    kyz=0.6*kzz;
    const denom=Math.max(CmLT-0.25,0.05)*Math.max(chiZ,0.05);
    if(cl.cls<=2) kzy=Math.max(1-0.1*lamBarZ*nz/denom, 1-0.1*nz/denom);
    else kzy=Math.max(1-0.1*lamBarZ*nz/denom, 1-0.1*nz/denom); // same form, NA keeps the 0.1 coefficient for both class groups in this term
  }
  const McRdLT = sec.isBox? McRd : MbRd;
  const u1=ny + kyy*Mx/Math.max(McRdLT,1e-9);          // y-y (in-plane) interaction, Eq 6.61
  const u2=nz + kzy*Mx/Math.max(McRdLT,1e-9);          // z-z (out-of-plane) interaction, Eq 6.62

  const span=a.deflection?a.deflection.span:a.L, divisor=S.divisor, dlimit=span/divisor;
  const dmax=Math.abs(a.deflection?a.deflection.dmax:a.dmax), defOk=dmax<=dlimit;

  const utils=[
    {name:"Shear  Ved/Vpl,Rd",val:Fv/VplRd},
    {name:"Bending  Med/MN,Rd",val:localUtil},
    {name: sec.isBox?"Bending Med/Mc,Rd":"LTB  Med/Mb,Rd", val:ltbUtil},
    {name:"Buckling (y-y)",val:u1},
    {name:"Buckling (z-z)",val:u2},
    {name:"Deflection",val:dmax/dlimit},
  ];
  let gov=utils[0]; utils.forEach(u=>{ if(u.val>gov.val) gov=u; });
  const pass=unsupported.length===0 && utils.every(u=>u.val<=1.0001);

  return {eps,cl,clsName,unsupported,fy,Av,VplRd,Fv,lowShear,shearBuckle,McRd,hsNote,Zx,Sx,
    Ag,NRd,F,n,MNRd,awNote,Mx,localUtil,isCant,
    C1,c1method:c1r.method,LE,lamLT,Mcr,curveInfo,chiLT,kc,fmod,chiLTmod,MbRd,ltbUtil,
    lam1,curveY,curveZ,lamBarY,lamBarZ,chiY,chiZ,NbRdY,NbRdZ,Fc,Cm,cmMethod,Cmy,Cmz,CmLT,kyy,kzz,kyz,kzy,n_ratio,psiInteraction,McRdLT,u1,u2,
    span,divisor,dlimit,dmax,defOk,utils,gov,pass};
}

// ---- EN 1993-1-1 Table B.3: equivalent uniform moment factor Cm from the
// governing combination's own moment diagram (single span between restraints).
// Returns {Cm, label}. Loading type: 'uniform' / 'concentrated'; where the two
// give different values (mixed loading) the LARGER (conservative) is used.
function cmTableB3(a){
  const Mm=Math.abs(a.Mmax);
  if(Mm<1e-9) return {Cm:1.0,label:'negligible moment'};
  const fb=a.governM.fb, L=a.L;
  const M0=interpAt(fb.xs,fb.M,1e-4)/1e6, ML=interpAt(fb.xs,fb.M,L-1e-4)/1e6;
  const Ms=interpAt(fb.xs,fb.M,L/2)/1e6;
  const gfac=a.governM.combo.factors;
  const pieces=comboLoadPieces(a.governM.combo);   // pattern-aware effective load list
  let hasDist=Math.abs(gfac.G??0)>0, hasConc=false;   // auto self-weight is distributed
  pieces.forEach(p=>{ if(!p.factor) return;
    if(p.type==='point') hasConc=true; else if(p.type==='udl'||p.type==='trap') hasDist=true; });
  // 'linear end-moment diagram' means the BMD is actually a straight line
  // between the ends (no transverse-load curvature) - test every grid value
  // against the chord, not just the midpoint (a cantilever's Mmax sits
  // at the end but its diagram is far from linear; Table B.3 alpha_s applies).
  const isLinear=fb.xs.every((x,i)=>x<1e-4||x>L-1e-4||Math.abs(fb.M[i]/1e6-(M0+(ML-M0)*x/L))<=1e-5*Mm);
  if(isLinear){
    const Mh2=Math.abs(M0)>=Math.abs(ML)? M0:ML, Mo2=Math.abs(M0)>=Math.abs(ML)? ML:M0;
    const psi=Math.max(-1,Math.min(1,Mo2/(Mh2||1e-9)));
    return {Cm:Math.max(0.6+0.4*psi,0.4),label:'linear end-moment diagram, &psi; = '+psi.toFixed(2)};
  }
  // Table B.3's transverse-load diagrams do not describe arbitrary partial,
  // multiple or reversing loads. No beneficial Cm is inferred from a single
  // midpoint for those layouts.
  const active=pieces.filter(p=>Math.abs(p.factor)>1e-12);
  const simpleSpan=endsList().every(e=>e.uz)&&!(S.hinges||[]).length;   // both ends held vertically (pinned or fixed), no hinge
  const canonical=active.every(p=>p.type==='udl'&&p.x1<=1e-9&&Math.abs(p.x2-a.L)<1e-6||(p.type==='point'&&Math.abs(p.pos-a.L/2)<1e-6));
  if(!simpleSpan||!canonical||(hasDist&&hasConc)) return {Cm:1,label:'C_m = 1: arbitrary or mixed moment diagram; no Table B.3 reduction assumed'};
  const Mh=Math.abs(M0)>=Math.abs(ML)? M0:ML;
  const Mo=Math.abs(M0)>=Math.abs(ML)? ML:M0;
  const psi=Math.abs(Mh)>1e-9? Math.max(-1,Math.min(1,Mo/Mh)) : 1;
  const evalType=(type)=>{
    if(Math.abs(Mh)<0.02*Mm){ // no significant end moment: alpha_h family with Mh=0
      return type==='uniform'? 0.95 : 0.90;
    }
    if(Math.abs(Ms)<=Math.abs(Mh)+1e-12){
      const as=Math.max(-1,Math.min(1,Ms/Mh));
      if(as>=0) return 0.2+0.8*as;
      if(psi>=0) return type==='uniform'? 0.1-0.8*as : -0.8*as;
      return type==='uniform'? 0.1*(1-psi)-0.8*as : 0.2*(-psi)-0.8*as;
    }
    const ah=Math.max(-1,Math.min(1,Mh/Ms));
    const mod=(ah<0&&psi<0)? (1+2*psi) : 1;
    return type==='uniform'? 0.95+0.05*ah*mod : 0.90+0.10*ah*mod;
  };
  let Cm,label;
  const tag=Math.abs(Ms)<=Math.abs(Mh)? '&alpha;<sub>s</sub> = '+ (Math.abs(Mh)<0.02*Mm?'&mdash;':(Ms/Mh).toFixed(3)) : '&alpha;<sub>h</sub> = '+(Mh/Ms).toFixed(3);
  if(hasDist&&hasConc){ Cm=Math.max(evalType('uniform'),evalType('concentrated')); label='mixed loading (larger of uniform/concentrated), '+tag; }
  else if(hasConc){ Cm=evalType('concentrated'); label='concentrated load diagram, '+tag; }
  else { Cm=evalType('uniform'); label='uniform load diagram, '+tag; }
  return {Cm:Math.max(Cm,0.4),label:label+', M<sub>h</sub> = '+Mh.toFixed(1)+', M<sub>s</sub> = '+Ms.toFixed(1)+', &psi; = '+psi.toFixed(2)};
}
// ---- EN 1993-1-1 cl 6.3.3, Annex B Method 2 (interaction factors kyy, kzz,
// kyz, kzy from Table B.1 [not susceptible to torsional deformation] or B.2
// [susceptible]; Cm from Table B.3). This is a compression-member check, so
// callers should only create it when N_Ed is compressive.
function lcrZFromRestraints(a){
  // SCI P360 Section 6.2: secondary members (purlins, side rails, ties) attached
  // to a member "act as bracing points" and reduce the MINOR-AXIS (z-z) strut
  // buckling length; between adjacent lateral restraints k = 1.0 and L is the
  // distance between restraint points. Applied only in the EC3 unrestrained
  // mode, where the intermediate-lateral-restraint list is visible and edited;
  // only restraints that hold lateral displacement v count; the bays run
  // between the ends that hold U_y. Returns null (keep the end-fixity length)
  // when there are no intermediate v-restraints, when only one end holds U_y
  // (lateral cantilever), or if anything is degenerate.
  if(!(S.code==='EC3' && (S.restraint||'full')!=='full')) return null;
  const ir=(S.ltbRestraints||[]).filter(r=>r.v!==false).map(r=>(+r.pos)*1000).filter(x=>isFinite(x)&&x>=0&&x<=a.L);
  if(!ir.length) return null;
  const endPts=endsList().filter(e=>e.uy).map(e=>e.x*1000);   // ends holding lateral translation U_y
  if(endPts.length<2) return null;               // lateral cantilever: keep the end-fixity default
  const pts=[...new Set(endPts.concat(ir).map(x=>+x.toFixed(3)))].sort((p,q)=>p-q);
  if(pts.length<2) return null;
  let gmax=0;
  for(let i=1;i<pts.length;i++) gmax=Math.max(gmax,pts[i]-pts[i-1]);
  return gmax>1e-6? gmax : null;
}
/* Torsional buckling length from the TWIST restraints (19 Sep 2026 review
   finding): EN 1993-1-1 6.3.1.4(1) with EN 1993-1-3 6.2.3(5) - l_T is set by
   the torsional / warping restraint at the ends of the torsional segment. A
   restraint that holds lateral displacement v only (phi unticked) does not
   bound the torsional mode, so L_T is the largest spacing between points that
   prevent twist: every end whose R_x is restrained and every intermediate
   restraint with phi !== false. Mirrors lcrZFromRestraints(): null (keep the
   flexural default) when there are no intermediate twist restraints, when
   only one end holds twist (torsion cantilever: L_cr,y), or in the fully
   restrained mode. */
function lcrTFromTwistRestraints(a){
  if(!(S.code==='EC3' && (S.restraint||'full')!=='full')) return null;
  const ir=(S.ltbRestraints||[]).filter(r=>r.phi!==false).map(r=>(+r.pos)*1000).filter(x=>isFinite(x)&&x>=0&&x<=a.L);
  if(!ir.length) return null;
  const endPts=endsList().filter(e=>e.rx).map(e=>e.x*1000);
  if(endPts.length<2) return null;
  const pts=[...new Set(endPts.concat(ir).map(x=>+x.toFixed(3)))].sort((p,q)=>p-q);
  if(pts.length<2) return null;
  let gmax=0;
  for(let i=1;i<pts.length;i++) gmax=Math.max(gmax,pts[i]-pts[i-1]);
  return gmax>1e-6? gmax : null;
}
/* ---- k_c floor (19 Sep 2026 gap closure, item 3.5) ----
   NA 2.18 allows k_c = 1/sqrt(C1). Table 6.6 lists k_c down to 0.60 (the
   psi = -1 end-moment case, C1 = 2.76), so a back-calculated or Serna C1 above
   2.76 is capped at that lower bound: k_c >= 1/sqrt(2.76) = 0.602. */
const KC_FLOOR_C1=2.76, KC_FLOOR=1/Math.sqrt(KC_FLOOR_C1);
function kcFromC1(C1){
  const raw=Math.min(1/Math.sqrt(Math.max(C1,1e-6)),1);
  return {kc:Math.max(raw,KC_FLOOR), kcRaw:raw, floored:raw<KC_FLOOR-1e-12};
}
/* ---- Effective area of a Class-4 web in uniform compression (item 1.9(c) /
   3.9(c)), EN 1993-1-5 4.4: internal compression element, psi = 1, k_sigma = 4,
   lambda_p = (b/t)/(28.4 eps sqrt(k_sigma)), rho = (lambda_p - 0.055(3 + psi))/
   lambda_p^2 <= 1 (lambda_p > 0.673; = 1 otherwise), b_eff = rho b split
   b_e1 = b_e2 = 0.5 b_eff. b = the flat web depth of Table 5.2 (sec.d: I/H
   h - 2t_f - 2r, hollow h - 3t); a hollow section has two such walls. The
   reduction is symmetric, so the centroid does not move (e_N = 0). Applies
   when the web is Class 4 in uniform compression (d/t > 42 eps); the flanges
   must stay Class <= 3 in compression (outstand 14 eps / internal 42 eps) -
   the caller blocks otherwise. Pure. */
function aeffWebCompression(sec,eps){
  const A=sec.A*1e2, tw=sec.tw, bbar=sec.d, ratio=sec.dt, nWebs=sec.isBox? 2 : 1;
  const out={applies:false,A,Aeff:A,ratio:1,nWebs,bbar,tw,eps,limit:42*eps,dt:ratio,ksig:4,psi:1,lamP:null,rho:1,beff:bbar,be1:bbar/2,be2:bbar/2,bineff:0,eN:0};
  if(!(ratio>42*eps) || !(bbar>0&&tw>0)) return out;
  const lamP=ratio/(28.4*eps*Math.sqrt(4));
  const rho= lamP<=0.673? 1 : Math.min((lamP-0.055*(3+1))/(lamP*lamP),1);
  const beff=rho*bbar, bineff=(1-rho)*bbar;
  const Aeff=A-nWebs*bineff*tw;
  return Object.assign(out,{applies:true,lamP,rho,beff,be1:beff/2,be2:beff/2,bineff,Aeff,ratio:Aeff/A});
}
/* ---- Flange outstand stresses of an I/H section under N + M_y + M_z (item
   1.9(b), printed with the classification): elastic extreme-fibre values,
   compression positive. The outstand of the compression flange on the side
   compressed by M_z has root stress sN + sMy + sMz(root) and tip stress sN +
   sMy + sMz(tip): both compressive -> alpha = 1 -> the uniform-compression
   bound 9e/10e/14e governs. The opposite outstand is relieved at its tip
   (tip in tension when sMz(tip) > sN + sMy) and takes the laxer stress-
   gradient limits of Table 5.2 sheet 2, so it never governs. Pure. */
function mzFlangeStress(sec,F,My,Mz){
  const A=sec.A*1e2, Zx=sec.Zx*1e3, Zy=sec.Zy*1e3;
  const sN=Math.max(F,0)*1000/A, sMy=Math.abs(My)*1e6/Zx, sMzTip=Math.abs(Mz)*1e6/Zy;
  const yRoot=sec.tw/2+sec.r, yTip=sec.B/2;
  const sMzRoot=sMzTip*yRoot/yTip;
  const compRoot=sN+sMy+sMzRoot, compTip=sN+sMy+sMzTip;
  const relRoot=sN+sMy-sMzRoot, relTip=sN+sMy-sMzTip;
  return {sN,sMy,sMzTip,sMzRoot,yRoot,yTip,compRoot,compTip,relRoot,relTip,
    compAlpha:(compRoot>=0&&compTip>=0)? 1 : null, relState: relTip<0? 'tip in tension' : 'wholly in compression'};
}
/* ---- Torsional and torsional-flexural buckling of a channel under N (item
   3.10, EN 1993-1-1 6.3.1.4). Monosymmetric about y-y (the major axis, the
   axis of symmetry); the shear centre lies on it at y0 = e_sc from the
   centroid (SCI P385 Table A.3 / Blue Book, sec.tp.esc, mm). i0^2 = i_y^2 +
   i_z^2 + y0^2; N_cr,T = (G I_T + pi^2 E I_w/L_T^2)/i0^2 with L_T = the
   spacing of the TWIST restraints (lcrTFromTwistRestraints: supports and
   intermediate restraints with phi ticked, never the v-only spacing L_cr,z),
   capped at L_cr,y, unless the user enters S.LT (m); the torsional mode
   couples with flexure
   about the axis of symmetry (the y-y flexural mode, N_cr,y) through the
   standard cubic, which for one axis of symmetry reduces to
   N_cr,TF = (N_cr,y + N_cr,T)/(2 beta) [1 - sqrt(1 - 4 beta N_cr,y N_cr,T/
   (N_cr,y + N_cr,T)^2)], beta = 1 - (y0/i0)^2 (EN 1993-1-3 6.2.3(6) form).
   N_cr = min(N_cr,T, N_cr,TF); lambda_T = sqrt(A f_y/N_cr); chi from the curve
   related to the z-z axis (6.3.1.4(3)): Table 6.2 "U-sections: any axis ->
   curve c" [verify]; N_b,T,Rd = chi A f_y/gamma_M1. Pure. */
function torsionalFlexuralBuckling(sec,fy,E,LcrY,LcrZ,Ag,gM1,LcrT){
  const G=81000;
  const IT=((sec.tp&&sec.tp.IT)? sec.tp.IT : sec.J)*1e4, ITSrc=(sec.tp&&sec.tp.IT)? 'SCI P385 Table A.3' : 'section table';
  const Iw=(((sec.tp&&sec.tp.Iw!=null)? sec.tp.Iw : sec.Iw)||0)*1e12;
  const y0=(sec.tp&&sec.tp.esc!=null&&isFinite(+sec.tp.esc))? +sec.tp.esc : null;
  if(y0==null || !(IT>0)) return {ok:false,reason:'the shear-centre offset e<sub>sc</sub> (SCI P385 Table A.3) or I<sub>T</sub> is not tabulated for this section, so N<sub>cr,T</sub> / N<sub>cr,TF</sub> cannot be formed'};
  const iy=sec.rx*10, iz=sec.ry*10;
  const i0sq=iy*iy+iz*iz+y0*y0, i0=Math.sqrt(i0sq);
  const LTin=(S.LT!=null && S.LT!=='' && isFinite(+S.LT) && +S.LT>0)? (+S.LT)*1000 : null;
  // default L_T: the twist-restraint spacing (LcrT, capped at L_cr,y by the
  // caller), never the lateral-only spacing L_cr,z; LcrZ is kept for reporting
  const LTdef= (LcrT!=null && isFinite(LcrT) && LcrT>0)? LcrT : LcrY;
  const LT= LTin!=null? LTin : LTdef;
  const LTSrc= LTin!=null? 'user L<sub>T</sub>' : (LcrT!=null && LcrT<LcrY-1e-6)? 'spacing of twist restraints (ends with R<sub>x</sub> held and restraints with &phi; held)' : 'L<sub>cr,y</sub> (no intermediate twist restraint)';
  const NcrT=(G*IT+Math.PI*Math.PI*E*Iw/(LT*LT))/i0sq;            // N
  const NcrY=Math.PI*Math.PI*E*sec.Ix*1e4/(LcrY*LcrY);           // N, flexural about the axis of symmetry (y-y, major)
  const beta=1-(y0*y0)/i0sq;
  const NcrTF=(NcrY+NcrT)/(2*beta)*(1-Math.sqrt(Math.max(1-4*beta*NcrY*NcrT/Math.pow(NcrY+NcrT,2),0)));
  const Ncr=Math.min(NcrT,NcrTF), mode= NcrTF<NcrT? 'TF' : 'T';
  const lamT=Math.sqrt(Ag*fy/Ncr);
  const cvT=strutCurveEC3(sec,'z');
  const chiT=chiStrutEC3(lamT,cvT.alpha);
  const NbT=chiT*Ag*fy/gM1/1000;                                 // kN
  return {ok:true,y0,y0Src:'e<sub>sc</sub> = shear centre to centroid, SCI P385 Table A.3 (Blue Book e<sub>0</sub> + c<sub>y</sub>)',iy,iz,i0,i0sq,IT,ITSrc,Iw,G,LT,LTSrc,LTdef,LcrZ,LcrT,
    NcrT:NcrT/1000,NcrY:NcrY/1000,beta,NcrTF:NcrTF/1000,Ncr:Ncr/1000,mode,lamT,cvT,chiT,NbT};
}
function annexB2(a,sec,fy,cl,MbRdI,useB1,isCant,aeff){
  if(a.ulsResults&&a.ulsResults.length>1){
    const rows=a.ulsResults.map(res=>({...annexB2(analysisForCombination(a,res),sec,fy,cl,MbRdI,useB1,isCant,aeff),combo:res.combo.label}));
    return rows.reduce((p,r)=>Math.max(r.u1,r.u2)>Math.max(p.u1,p.u2)?r:p);
  }
  const gM1=1.0, E=a.E;
  const Fc=Math.max(S.axial||0,0);
  const Ag=sec.A*1e2;
  // Class-4 web in uniform compression (item 1.9(c)): A_eff replaces A in
  // N_Rk, in lambda-bar (6.3.1.3(1): lambda = sqrt(A_eff f_y/N_cr)) and in the
  // Table 6.7 Class-4 column of Eq 6.61/6.62 (W_eff,y = W_el,y, e_N = 0).
  const aeffOn=!!(aeff&&aeff.applies&&Fc>1e-9);
  const Aeff= aeffOn? aeff.Aeff : Ag;
  const aeffFac= aeffOn? Math.sqrt(Aeff/Ag) : 1;
  // Strut lengths per axis (destabilising x1.2 is an LTB concept, not applied).
  // Both axes default from the END FIXITIES (lcrDefaults, js/03-state-ui.js:
  // P360 Table 6.2 / BS 5950 Table 22 style - 0.7 L fixed-fixed, 0.85 L one
  // end fixed, 1.0 L pinned-pinned, 2.0 L fixed-free (cantilever), 1.2 L
  // fixed-guided; y-y from U_z / R_y, z-z from U_y / R_z, printed [verify]);
  // the entered L_E/L factor overrides both. Minor axis: further reduced to
  // the largest spacing between adjacent lateral restraint points where
  // intermediate restraints are modelled (SCI P360 6.2 bracing-point
  // assumption), never longer than its end-fixity length.
  const lcr=lcrDefaults(S);
  if(Fc>1e-9 && (lcr.Ky==null || lcr.Kz==null)) throw 'Strut buckling: the end fixities form a mechanism ('+(lcr.Ky==null? lcr.basisY : lcr.basisZ)+'); N_Ed cannot be carried.';
  const cantStrut = !!isCant && Fc>1e-9;
  const leOverride = !!lcr.override;
  const Ky = lcr.Ky!=null? lcr.Ky : 1.0;
  const KzEnd = lcr.Kz!=null? lcr.Kz : 1.0;
  const lcrBasis = lcr.basis;
  const LcrY=Ky*a.L;
  const LcrZEnd=KzEnd*a.L;
  const lz=lcrZFromRestraints(a);
  const LcrZ=lz!=null? Math.min(lz,LcrZEnd) : LcrZEnd;
  const Kz=LcrZ/a.L;
  const lczFromRestraints=(lz!=null && LcrZ<LcrZEnd-1e-6);
  const Lcr=LcrY;                                 // kept for report compatibility
  const lam1=Math.PI*Math.sqrt(E/fy);
  const rx=sec.rx*10, ry=sec.ry*10;
  const lamY=(LcrY/rx)/lam1*aeffFac, lamZ=(LcrZ/ry)/lam1*aeffFac;
  const cvY=strutCurveEC3(sec,'y'), cvZ=strutCurveEC3(sec,'z');
  const chiY=chiStrutEC3(lamY,cvY.alpha), chiZ=chiStrutEC3(lamZ,cvZ.alpha);
  const NbY=chiY*Aeff*fy/gM1/1000, NbZ=chiZ*Aeff*fy/gM1/1000;   // kN
  // channel under compression: torsional / torsional-flexural buckling (6.3.1.4);
  // the lower of chi_T and the flexural chi feeds both axial terms of 6.61/6.62
  let tfb=null;
  if(sec.kind==='channel' && Fc>1e-9){
    // L_T from the twist-restraint spacing (phi held), capped at L_cr,y; a
    // lateral-only restraint shortens L_cr,z but not L_T
    const lt=lcrTFromTwistRestraints(a);
    const LcrT= lt!=null? Math.min(lt,LcrY) : LcrY;
    tfb=torsionalFlexuralBuckling(sec,fy,E,LcrY,LcrZ,Aeff,gM1,LcrT);
    if(tfb.ok) tfb.util=Fc/Math.max(tfb.NbT,1e-9);
  }
  const NbYeff= (tfb&&tfb.ok)? Math.min(NbY,tfb.NbT) : NbY;
  const NbZeff= (tfb&&tfb.ok)? Math.min(NbZ,tfb.NbT) : NbZ;
  const ny=Fc/Math.max(NbYeff,1e-9), nz=Fc/Math.max(NbZeff,1e-9);
  const cm=cmTableB3(a);
  let Cmy=cm.Cm, CmLT=cm.Cm, swayNote=false;
  if(isCant && Fc>1e-6 && Cmy<0.9){ Cmy=0.9; CmLT=0.9; swayNote=true; } // Table B.3 note: sway buckling mode -> Cm = 0.9
  const Cmz=1.0;                                   // 20 Sep 2026 review: Table B.3 upper bound - exact for the imposed constant M_z (psi = 1), conservative for the twist-induced phi.M_y diagram (M_z,Ed = M_z + phi.M_y below)
  // k_ij column: Class 1/2 plastic forms only for a Class 1/2 section that is not
  // a channel (elastic column, conservative) and has no Class-4 web in
  // compression (Table 6.7 Class-4 column -> the Class 3/4 rows of Table B.1/B.2)
  const c12=cl.cls<=2 && sec.kind!=='channel' && !aeffOn;
  const rhsRow=!!sec.isBox;                        // Table B.1 "rectangular hollow sections" row for k_zz (item 3.12(a))
  const kyy = c12? Math.min(Cmy*(1+(lamY-0.2)*ny), Cmy*(1+0.8*ny))
                 : Math.min(Cmy*(1+0.6*lamY*ny),   Cmy*(1+0.6*ny));
  const kzz = c12? (rhsRow? Math.min(Cmz*(1+(lamZ-0.2)*nz), Cmz*(1+0.8*nz))       // RHS row: same form as k_yy
                          : Math.min(Cmz*(1+(2*lamZ-0.6)*nz), Cmz*(1+1.4*nz)))    // I-section row
                 : Math.min(Cmz*(1+0.6*lamZ*nz),     Cmz*(1+0.6*nz));
  const kyz = (c12&&!rhsRow)? 0.6*kzz : kzz;      // Table B.1: I-sections Class 1/2 0.6k_zz; RHS and the Class 3 column k_zz (shared by B.2)
  let kzy, kzyLbl;
  if(useB1){ kzy=(c12?0.6:0.8)*kyy; kzyLbl='Table B.1: '+(c12?'0.6':'0.8')+'k<sub>yy</sub>'; }
  else {
    const dn=Math.max(CmLT-0.25,1e-6), lz=Math.min(lamZ,1);
    const coef=c12? 0.1 : 0.05;
    let e1=1-coef*lz*nz/dn;
    if(c12 && lamZ<0.4) e1=Math.min(0.6+lamZ,e1);
    kzy=Math.max(e1,0); kzyLbl='Table B.2 (susceptible): 1&minus;'+coef+'&middot;min(&lambda;&#772;<sub>z</sub>,1)&middot;n<sub>z</sub>/(C<sub>mLT</sub>&minus;0.25)';
  }
  // Table 6.7 Class-4 column (A_eff case): M_y,Rk = W_eff,y f_y with W_eff,y =
  // W_el,y (flanges Class <= 3 in compression, web Class 4 only in uniform
  // compression, so the section under bending keeps its elastic modulus), so a
  // Class 1/2 M_b,Rd handed in (plastic W_y) is scaled by W_el,y/W_pl,y.
  const wFac= (aeffOn && cl.cls<=2)? sec.Zx/sec.Sx : 1;
  const Mrd=Math.max(MbRdI*wFac,1e-9), Mx=Math.abs(a.Mmax);
  // Minor-axis moment terms (fully biaxial 6.61/6.62). Mz,Ed is the direct design
  // input; its resistance Mc,z,Rd carries no LTB reduction (chi_LT is major-axis only).
  // 20 Sep 2026 torsion + N/Mz: M_z,Ed = imposed M_z + max over the member of |phi.M_y|,
  // the second-order minor-axis moment of this combination's torsion solution (EN 1993-1-1
  // 5.2.1(3); SCI P385 3.1.2 M_z = phi.M_y); zero without torsion, so nothing changes then.
  const MzImp=Math.abs(S.Mz||0);
  const cb0=(a.ulsResults&&a.ulsResults[0])? a.ulsResults[0].combo : (a.governM? a.governM.combo : null);
  const MzTwist=cb0? torsionMzTwistMax(a,cb0) : 0;
  const MzEd=MzImp+MzTwist;
  const Mcz=Math.max((c12? sec.Sy : sec.Zy)*1e3*fy/gM1/1e6, 1e-9);   // Mc,z,Rd
  const mzTerm = MzEd>1e-9 ? MzEd/Mcz : 0;                            // Mz,Ed / Mc,z,Rd
  const u1=ny + kyy*Mx/Mrd + kyz*mzTerm;           // Eq 6.61
  const u2=nz + kzy*Mx/Mrd + kzz*mzTerm;           // Eq 6.62
  return {Fc,Mx,Lcr,LcrY,LcrZ,Ky,Kz,KzEnd,cantStrut,leOverride,lcrBasis,lcrBasisY:lcr.basisY,lcrBasisZ:lcr.basisZ,lczFromRestraints,lam1,lamY,lamZ,cvY,cvZ,chiY,chiZ,NbY,NbZ,NbYeff,NbZeff,ny,nz,
    Cmy,Cmz,CmLT,cmLabel:cm.label,swayNote,useB1,c12,rhsRow,kyy,kzz,kyz,kzy,kzyLbl,MbRdI,MbRdEff:Mrd,wFac,Mcz,MzEd,MzImp,MzTwist,mzTerm,biax:MzImp>1e-9,u1,u2,
    aeffOn,Aeff,Ag,aeffFac,tfb};
}
/* ---------------------------------------------------------------------------
   EN 1993-1-5 clause 6: resistance of the web to transverse forces, with the
   clause 7.2 interaction (19 Sep 2026 gap closure, items 2.16 + 2.18). Pure:
   reads the analysis a (every ULS combination's own reactions and diagram),
   the section, fy, eps, the class and the state S (per-load ss / stiff, per-
   support ss / stiff, axial). No DOM.
   Stations: every point load (non-zero P) and every support. Loads within
   0.5 mm of each other share a station (forces summed, the smaller s_s
   kept); a point load at a support position is a "both" station.
   Load types (Figure 6.1): (a) interior load resisted by shear in the web,
   k_F = 6 + 2(h_w/a)^2; (b) load transferred through the web to the opposite
   flange (a point load directly over a support), k_F = 3.5 + 2(h_w/a)^2,
   F_Ed = max(P, R) taken conservatively as the through-load; (c) load near an
   unstiffened end, k_F = 2 + 6(s_s + c)/h_w <= 6, evaluated whenever
   (s_s + c) < 2h_w/3 (the value at which k_F(c) reaches the long-panel 6),
   together with type (a); the lower F_Rd governs.
   F_Rd = f_yw L_eff t_w / gamma_M1 (6.2), L_eff = chi_F l_y, chi_F = 0.5 /
   lambda_F <= 1, lambda_F = sqrt(l_y t_w f_yw / F_cr), F_cr = 0.9 k_F E t_w^3
   / h_w (6.4); m1 = f_yf b_f/(f_yw t_w), m2 = 0.02 (h_w/t_f)^2 if lambda_F >
   0.5 else 0 (one re-evaluation with m2 = 0 when the first pass gives
   lambda_F <= 0.5); l_y = s_s + 2 t_f (1 + sqrt(m1 + m2)) <= a for (a)/(b),
   the two 6.5(4) expressions with l_e = k_F E t_w^2/(2 f_yw h_w) <= s_s + c
   for (c). b_f is limited to 15 eps t_f each side of the web (6.5(1)).
   s_s: per-load input (default 0) and per-support input (blank = the LOWER
   BOUND s_s = 0, since the seating length is set by the bearing, not by the
   beam; F_Rd rises monotonically with s_s, so a station that passes at 0 is
   verified for any seating, while a station that fails at 0 with s_s not
   entered is reported NOT VERIFIED - blocking, with the s_s = 0 values
   printed - instead of FAIL: 19 Sep 2026 review finding, replacing the
   former default s_s = B), capped at h_w (6.3(1)). c = max(d - s_s/2, 0) with d the distance
   from the station to the nearer member end. a = distance between declared
   bearing stiffeners bounding the station, the full member length when none
   are declared (conservative, printed).
   Hollow sections: two webs, each a plate of thickness t with the tabulated
   flat depth (h_w = d, corner geometry of the section table); the flange
   width per web is B/2 limited to t + 15 eps t; the load is shared between
   the webs by the lever rule of its eccentricity e (0.5 each when e = 0).
   Interaction 7.2: eta_2 + 0.8 eta_1 <= 1.4 with eta_2 = F_Ed/F_Rd and eta_1
   = M_Ed/M_c,Rd (+ N_Ed/N_pl,Rd when N_Ed != 0) at the same station in the
   same combination; M_c,Rd is the unreduced class-consistent W_y f_y/gamma_M0
   [verify: EN 1993-1-5 4.6 writes eta_1 with W_eff, i.e. W_el for Class 3].
   The interaction is evaluated at every station; where the loaded flange is
   in tension 7.2(2) refers to 6.2.1(5) of EN 1993-1-1 instead and the row
   says so (the 7.2 expression is still applied as a screen).
   A station whose "bearing stiffener provided" box is ticked is not checked:
   it prints "stiffener declared - design stiffener separately (EN 1993-1-5
   9.4)" as an advisory. Returns {checked, stations, util2, util72, ...}.
   --------------------------------------------------------------------------- */
const WEB_UTIL_NAMES=["Web transverse force  F_Ed/F_Rd (EN 1993-1-5 6.2)","Web transverse force + bending (EN 1993-1-5 7.2)"];
const TFB_UTIL_NAME="Torsional-flexural buckling  N_Ed/N_b,T,Rd (6.3.1.4)";
function mvnUtilName(m){ return "Bending+shear+"+(m.N>1e-9? (m.biax? "axial+biaxial" : "axial") : "biaxial")+" (6.2.10)"; }
function webTransverseCheck(a,sec,fy,eps,cl){
  const gM0=1.0, gM1=1.0, E=a.E, L=a.L;
  const isBox=!!sec.isBox, chan=sec.kind==='channel';
  const tw=sec.tw, tf=sec.tf;
  const hw= isBox? sec.d : sec.D-2*sec.tf;
  const nWebs= isBox? 2 : 1;
  const fyw=fy, fyf=fy;
  const bfRaw= isBox? sec.B/2 : sec.B;
  const bfLim= (isBox||chan)? tw+15*eps*tf : tw+30*eps*tf;
  const bf=Math.min(bfRaw,bfLim);
  const m1=fyf*bf/(fyw*tw);
  const m2full=0.02*Math.pow(hw/tf,2);
  const Wy=(cl.cls<=2? sec.Sx : sec.Zx)*1e3;
  const McRd0=Wy*fy/gM0/1e6;                     // kN.m, unreduced, class-consistent
  const NplRd=sec.A*100*fy/gM0/1000;             // kN
  const NEd=Math.abs(S.axial||0);
  const out={checked:false,hw,tw,tf,bf,bfRaw,bfLim,m1,m2full,eps,fyw,fyf,nWebs,isBox,chan,McRd0,NplRd,NEd,cls:cl.cls,
    stations:[],gov2:null,gov72:null,util2:0,util72:0,unsupported:[],advisory:[],aBasis:'',anyDefaultSs:false,anyTension:false};
  if(!(hw>0&&tw>0&&tf>0)){ out.unsupported.push('Web transverse forces (EN 1993-1-5 clause 6): the web geometry (h_w, t_w, t_f) is undefined for this section; the check cannot be made.'); return out; }
  const tol=0.5;   // mm: loads / supports closer than this share a station
  const st=[];
  const find=x=>st.find(s=>Math.abs(s.x-x)<=tol);
  const ssOf=v=>(v!=null && v!=='' && Number.isFinite(+v))? Math.max(+v,0) : null;
  S.loads.forEach((ld,i)=>{
    if(ld.isSelfWeight||ld.type!=='point'||!(Math.abs(+ld.P||0)>1e-12)) return;
    const x=(+ld.pos)*1000;
    let s=find(x); if(!s){ s={x,loads:[],support:null}; st.push(s); }
    s.loads.push({i,ss:ssOf(ld.ss),stiff:!!ld.stiff,e:(S.eccOn&&Number.isFinite(+ld.e))? Math.abs(+ld.e) : 0});
  });
  // every end that carries a vertical reaction (U_z held): i = index into the
  // solver's reaction list, n = end number
  verticalEnds(S).forEach(sp=>{
    const x=(+sp.pos)*1000;
    let s=find(x); if(!s){ s={x,loads:[],support:null}; st.push(s); }
    s.support={i:sp.i,n:sp.end,ss:ssOf(sp.ss),stiff:!!sp.stiff,type:sp.type};
  });
  st.sort((p,q)=>p.x-q.x);
  // declared stiffeners bound the web panels (a); none declared -> a = L
  const stiffX=st.filter(s=>s.loads.some(l=>l.stiff)||(s.support&&s.support.stiff)).map(s=>s.x);
  out.aBasis= stiffX.length? 'a = distance between the declared bearing stiffeners bounding the station (member ends otherwise)' : 'no transverse stiffeners declared: a = L = '+g(L,0)+' mm, the full member length (conservative)';
  const panelOf=x=>{ let l=0,r=L; stiffX.forEach(p=>{ if(p<x-tol && p>l) l=p; if(p>x+tol && p<r) r=p; }); return {a:Math.max(r-l,1e-6),l,r}; };
  const solve=(type,ss,c,aPanel)=>{
    const kF= type==='a'? 6+2*Math.pow(hw/aPanel,2) : type==='b'? 3.5+2*Math.pow(hw/aPanel,2) : Math.min(2+6*(ss+c)/hw,6);
    const Fcr=0.9*kF*E*Math.pow(tw,3)/hw;                       // N
    const leRaw= type==='c'? kF*E*tw*tw/(2*fyw*hw) : null;
    const le= type==='c'? Math.min(leRaw,ss+c) : null;
    const lyFor=(m2)=>{
      if(type==='c'){ const l1=le+tf*Math.sqrt(m1/2+Math.pow(le/tf,2)+m2), l2=le+tf*Math.sqrt(m1+m2); return {ly:Math.min(l1,l2),l1,l2,capA:false}; }
      const l=ss+2*tf*(1+Math.sqrt(m1+m2)); return {ly:Math.min(l,aPanel),l1:l,l2:null,capA:l>aPanel};
    };
    let m2=m2full, r=lyFor(m2), lam=Math.sqrt(r.ly*tw*fyw/Fcr), iter=false, lam1=lam, ly1=r.ly;
    if(lam<=0.5){ m2=0; r=lyFor(0); lam=Math.sqrt(r.ly*tw*fyw/Fcr); iter=true; }
    const chiRaw=0.5/lam, chi=Math.min(chiRaw,1);
    const Leff=chi*r.ly;
    const FRd=fyw*Leff*tw/gM1/1000;                             // kN per web
    return {type,kF,Fcr:Fcr/1000,leRaw,le,m2,iter,lam1,ly1,ly:r.ly,l1:r.l1,l2:r.l2,capA:r.capA,lam,chiRaw,chi,Leff,FRd};
  };
  st.forEach(s=>{
    const kind= s.loads.length&&s.support? 'both' : s.support? 'support' : 'load';
    const stiff= s.loads.some(l=>l.stiff)||(s.support&&s.support.stiff);
    const n= s.support? s.support.n : null;
    const loadIdx=s.loads.map(l=>l.i+1);
    const label= kind==='support'? 'End '+n+' reaction' : kind==='load'? 'point load '+loadIdx.join('+') : 'point load '+loadIdx.join('+')+' over End '+n;
    const rec={x:s.x,kind,label,n,loadIdx,stiff:!!stiff,isEnd:(s.x<=tol||s.x>=L-tol)};
    if(stiff){
      rec.msg='stiffener declared - design stiffener separately (EN 1993-1-5 9.4)';
      out.advisory.push('Web transverse forces at x = '+g(s.x/1000,3)+' m ('+label+'): '+rec.msg+'.');
      out.stations.push(rec); return;
    }
    // stiff bearing length: the smaller of the entries at the station; a blank
    // support entry is the lower bound 0 (ssDefault: NOT VERIFIED if it fails)
    const ssLoad= s.loads.length? Math.min(...s.loads.map(l=>l.ss==null? 0 : l.ss)) : null;
    let ssSup=null, ssDefault=false;
    if(s.support){ ssSup= s.support.ss==null? 0 : s.support.ss; ssDefault= s.support.ss==null; }
    const ssIn= kind==='both'? Math.min(ssLoad,ssSup) : kind==='load'? ssLoad : ssSup;
    const ssCap= ssIn>hw;
    const ss=Math.min(ssIn,hw);
    if(ssDefault) out.anyDefaultSs=true;
    const d=Math.min(s.x,L-s.x);
    const c=Math.max(d-ss/2,0);
    const endZone=(ss+c)<2*hw/3;
    const panel=panelOf(s.x);
    const types= kind==='both'? ['b'].concat(endZone? ['c']:[]) : (endZone? ['a','c'] : ['a']);
    const sols=types.map(t=>solve(t,ss,c,panel.a));
    const gov=sols.reduce((p,q)=>q.FRd<p.FRd? q : p);
    // load share per web (box: lever rule of the largest eccentricity at the station)
    const eMax=s.loads.length? Math.max(...s.loads.map(l=>l.e)) : 0;
    const share= isBox? Math.min(1,0.5+eMax/Math.max(sec.B-tw,1e-9)) : 1;
    const FRdTot= isBox? gov.FRd/share : gov.FRd;
    // F_Ed, M_Ed per ULS combination (its own load pieces, reactions and diagram);
    // the gamma_G,inf = 1.0 STR set-B companions (19 Sep 2026 review) are swept
    // too - a relieving G raises the reaction where G lifts the support
    const ulsList=a.ulsResults.concat((a.ulsCompanions||[]).filter(res=>res.combo.gInfSet==='B'));
    const cases=ulsList.map(res=>{
      let P=0;
      comboLoadPieces(res.combo).forEach(p=>{ if(p.type==='point' && Math.abs(p.pos-s.x)<=tol) P+=p.P*p.factor; });
      const R= s.support? Math.max(res.r.reactions[s.support.i].V/1000,0) : 0;
      const F= kind==='both'? Math.max(Math.abs(P),R) : kind==='load'? Math.abs(P) : R;
      // M_Ed at the station: an end station reads the diagram a fraction
      // inside the member (x = 1e-4 mm, a grid point of sfdBmd, as analyse()
      // does for M0end / MLend) - the reaction couple of a fixed / guided end
      // is inside it, whereas sfdBmd closes the diagram to zero at x = L
      // beyond the End 2 reaction couple, so a sample exactly at the station
      // dropped the hogging end moment from the 7.2 interaction (19 Sep 2026
      // review finding F-A); an interior station reads the larger-magnitude
      // side of a jump (mAtStation: an applied couple at the same x)
      const xEnd= s.x<=tol? 1e-4 : s.x>=L-tol? L-1e-4 : null;
      const Ms=(xEnd!=null? interpAt(res.fb.xs,res.fb.M,xEnd) : mAtStation(res.fb,s.x,0,L))/1e6;
      const M=Math.abs(Ms);
      const flange= kind==='support'? 'bottom' : (P>=0? 'top' : 'bottom');
      // is the loaded flange the compression flange (7.2(1)) - a "both" station loads both flanges,
      // and a station without a coincident moment (simply supported end: the sample a fraction
      // inside the member is R x 1e-4 mm, negligible against the diagram peak) has no tension flange
      const noM = M<1e-5*Math.max(Math.abs(res.Mmax)/1e6,1e-9);
      const flangeComp= kind==='both'? true : noM? true : (flange==='top'? Ms>1e-9 : Ms<-1e-9);
      const flangeState= kind==='both'? 'load through the web' : noM? 'no coincident moment' : (flangeComp? 'in compression' : 'in tension');
      const eta2=F*share/Math.max(gov.FRd,1e-9);
      const eta1=M/Math.max(McRd0,1e-9)+(NEd>1e-9? NEd/Math.max(NplRd,1e-9) : 0);
      const u72raw=eta2+0.8*eta1, u72=u72raw/1.4;
      return {combo:res.combo.label,P,R,F,Fweb:F*share,M,Ms,flange,flangeComp,flangeState,eta2,eta1,u72raw,u72};
    });
    let g2=0,g72=0; cases.forEach((cs,i)=>{ if(cs.eta2>cases[g2].eta2) g2=i; if(cs.u72>cases[g72].u72) g72=i; });
    if(!cases[g2].flangeComp && cases[g2].F>1e-9) out.anyTension=true;
    Object.assign(rec,{ssIn,ss,ssCap,ssDefault,d,c,endZone,a:panel.a,panel,types,sols,gov,type:gov.type,share,eMax,FRd:gov.FRd,FRdTot,cases,g2,g72,
      eta2:cases[g2].eta2,u72:cases[g72].u72,F:cases[g2].F,combo:cases[g2].combo,nv:false});
    // s_s not entered and the lower bound fails: the seating is unknown, so the
    // station is NOT VERIFIED (blocking) rather than FAIL; its s_s = 0 values are printed
    if(ssDefault && (rec.eta2>1.0001 || rec.u72>1.0001)){
      rec.nv=true;
      rec.msg='NOT VERIFIED: s<sub>s</sub> not entered; at the lower bound s<sub>s</sub> = 0 the station gives F<sub>Ed</sub>/F<sub>Rd</sub> = '+g(rec.eta2,3)+(rec.u72>1.0001? ' and 7.2 = '+g(rec.u72,3) : '');
      out.unsupported.push('Web transverse force at x = '+g(s.x/1000,3)+' m ('+label+'): the stiff bearing length s<sub>s</sub> is not entered; at the lower bound s<sub>s</sub> = 0 the station gives F<sub>Ed</sub>/F<sub>Rd</sub> = '+g(rec.eta2,3)+' (F<sub>Ed</sub> = '+g(rec.F,1)+' kN, F<sub>Rd</sub> = '+g(rec.FRdTot,1)+' kN, type ('+rec.type+'))'+(rec.u72>1.0001? ' and (&eta;<sub>2</sub> + 0.8&eta;<sub>1</sub>)/1.4 = '+g(rec.u72,3) : '')+'. F<sub>Rd</sub> rises with the seating length: enter s<sub>s</sub> (mm along the member, EN 1993-1-5 6.3(1)) in the end row, or tick "bearing stiffener provided"; PASS is blocked until then.');
    }
    out.stations.push(rec);
  });
  const checked=out.stations.filter(s=>!s.stiff && !s.nv);
  out.anyNv=out.stations.some(s=>s.nv);
  out.checked=checked.length>0;
  // station whose derivation is printed: the worst F_Ed/F_Rd of every evaluated
  // station, a NOT VERIFIED one included (its s_s = 0 chain is shown as such)
  const shown=out.stations.filter(s=>!s.stiff);
  if(shown.length){ let w=shown[0]; shown.forEach(s=>{ if(s.eta2>w.eta2) w=s; }); out.show=w; } else out.show=null;
  if(out.checked){
    let w2=checked[0], w72=checked[0];
    checked.forEach(s=>{ if(s.eta2>w2.eta2) w2=s; if(s.u72>w72.u72) w72=s; });
    out.gov2=w2; out.gov72=w72; out.util2=w2.eta2; out.util72=w72.u72;
    checked.filter(s=>s.eta2>1.0001).forEach(s=>out.advisory.push('Bearing stiffener required at x = '+g(s.x/1000,3)+' m ('+s.label+'): F<sub>Ed</sub> = '+g(s.F,1)+' kN exceeds F<sub>Rd</sub> = '+g(s.FRdTot,1)+' kN (EN 1993-1-5 6.2, type ('+s.type+')); tick "bearing stiffener provided" once a stiffener is designed to EN 1993-1-5 9.4, or increase the stiff bearing length s<sub>s</sub>.'));
  }
  return out;
}
/* ---- Shear-reduced cross-section resistances (19 Sep 2026 gap closure, items
   2.10 and 2.13): the yield strength of the shear area is reduced to
   (1 - rho) f_y with rho = (2V_Ed/V_pl(,T),Rd - 1)^2 (cl 6.2.8(3), 6.2.10(3)).
   Returns, in kN.m / kN, the resistances of the section with that reduction:
     MvY   major-axis moment resistance M_v,y,Rd
             I/H Class 1/2 : (W_pl,y - rho A_v^2/(4 t_w)) f_y             (6.2.8(5), Eq 6.30 with A_v for A_w: conservative)
             I/H Class 3   : (W_el,y - rho I_web/(h/2)) f_y                (elastic: web fibre stress limited to (1 - rho) f_y, conservative)
             channel       : (W_pl,y or W_el,y - rho t_w h_w^2/4) f_y     (plastic web modulus; conservative for Class 3)
             RHS/SHS       : (W_pl,y or W_el,y - rho t (h - 2t)^2/2) f_y  (two webs, plastic web modulus; conservative for Class 3)
     MvZ   minor-axis resistance with the web contribution reduced
             I/H           : (W_pl,z - rho A_v t_w/4) f_y (Class 1/2), (W_el,z - rho A_v t_w/6) f_y (Class 3)
             channel       : M_c,z,Rd (1 - rho A_v/A)  (web share of W_z bounded by its area share: conservative)
             RHS/SHS       : (W_pl,z or W_el,z - rho t (h - 2t)(b - t)) f_y (two webs, plastic web modulus about z)
     NV    axial resistance N_V,Rd = (A - rho A_v) f_y/gamma_M0
     aV    the 6.2.9.1 parameter a evaluated on the reduced-yield section:
           ((A - 2 b t_f) - rho A_v)/(A - rho A_v) <= 0.5 (I/H, RHS a_w); a_f,V = (A - 2 h t)/(A - rho A_v) <= 0.5 (RHS)
   Every value is capped at its unreduced counterpart and floored at 0. Pure. */
function shearReducedResistances(sec,cl,fy,Av,rho,gM0){
  gM0=gM0||1.0;
  const A=sec.A*1e2, tw=sec.tw, tf=sec.tf, D=sec.D, B=sec.B, hw=D-2*tf;
  const cls12=cl.cls<=2;
  const Wy=(cls12? sec.Sx : sec.Zx)*1e3, Wz=(cls12? sec.Sy : sec.Zy)*1e3;
  const Mc=Wy*fy/gM0/1e6, Mcz=Wz*fy/gM0/1e6;
  const NV=Math.max(A-rho*Av,0)*fy/gM0/1000;
  let dWy, dWz, form, formZ;
  if(sec.kind==='I'){
    if(cls12){ dWy=rho*Av*Av/(4*tw); dWz=rho*Av*tw/4; form='(W<sub>pl,y</sub> &minus; &rho;A<sub>v</sub>&sup2;/4t<sub>w</sub>)f<sub>y</sub>/&gamma;<sub>M0</sub>'; formZ='(W<sub>pl,z</sub> &minus; &rho;A<sub>v</sub>t<sub>w</sub>/4)f<sub>y</sub>/&gamma;<sub>M0</sub>'; }
    else { const Iweb=tw*Math.pow(hw,3)/12; dWy=rho*Iweb/(D/2); dWz=rho*Av*tw/6; form='(W<sub>el,y</sub> &minus; &rho;I<sub>web</sub>/(h/2))f<sub>y</sub>/&gamma;<sub>M0</sub> [elastic, conservative]'; formZ='(W<sub>el,z</sub> &minus; &rho;A<sub>v</sub>t<sub>w</sub>/6)f<sub>y</sub>/&gamma;<sub>M0</sub>'; }
  } else if(sec.kind==='channel'){
    dWy=rho*tw*hw*hw/4; dWz=rho*Av/A*Wz;
    form='('+(cls12? 'W<sub>pl,y</sub>' : 'W<sub>el,y</sub>')+' &minus; &rho;t<sub>w</sub>h<sub>w</sub>&sup2;/4)f<sub>y</sub>/&gamma;<sub>M0</sub>'+(cls12? '' : ' [plastic web modulus, conservative]');
    formZ='M<sub>c,z,Rd</sub>(1 &minus; &rho;A<sub>v</sub>/A) [web share bounded by its area share, conservative]';
  } else {
    const t=tf, hi=D-2*t;
    dWy=rho*t*hi*hi/2; dWz=rho*t*hi*(B-t);
    form='('+(cls12? 'W<sub>pl,y</sub>' : 'W<sub>el,y</sub>')+' &minus; &rho;t(h &minus; 2t)&sup2;/2)f<sub>y</sub>/&gamma;<sub>M0</sub> [two webs'+(cls12? '' : '; plastic web modulus, conservative')+']';
    formZ='('+(cls12? 'W<sub>pl,z</sub>' : 'W<sub>el,z</sub>')+' &minus; &rho;t(h &minus; 2t)(b &minus; t))f<sub>y</sub>/&gamma;<sub>M0</sub> [two webs]';
  }
  const MvY=Math.min(Math.max((Wy-dWy)*fy/gM0/1e6,0),Mc);
  const MvZ=Math.min(Math.max((Wz-dWz)*fy/gM0/1e6,0),Mcz);
  const Ared=Math.max(A-rho*Av,1e-9);
  const aV=Math.min(Math.max(((A-2*B*tf)-rho*Av)/Ared,0),0.5);              // sec.tf = t for a hollow section
  const afV= sec.isBox? Math.min(Math.max((A-2*D*tf)/Ared,0),0.5) : null;
  return {rho,MvY,MvZ,NV,Mc,Mcz,dWy,dWz,form,formZ,aV,afV,cls12};
}
/* ---- Restraint design forces (19 Sep 2026 gap closure, items 1.7 / 3.17),
   advisory: for every intermediate lateral restraint and every support's
   torsional (fork) restraint, N_f,Ed = M_Ed/h with M_Ed the largest moment at
   the restraint station over the ULS combinations and h the overall depth
   (EN 1993-1-1 5.3.3(3) notation), and the design force 2.5 % N_f,Ed
   (6.3.5.2(5)(b) / SCI practice). Only on the not-fully-restrained path (a
   fully restrained flange has no discrete restraints). Pure. */
function restraintForces(a,sec){
  if((S.restraint||'full')==='full') return null;
  const h=sec.D;
  const pts=[];
  endsList().filter(e=>e.rx).forEach(e=>pts.push({x:e.x*1000,kind:'support',n:e.n,label:'End '+e.n+' (torsional restraint, R<sub>x</sub> held)'}));
  (S.ltbRestraints||[]).forEach((r,i)=>{ const x=(+r.pos)*1000; if(!isFinite(x)||x<-1e-6||x>a.L+1e-6) return; if(r.v===false&&r.phi===false) return;
    pts.push({x,kind:'lateral',n:i+1,label:'lateral restraint '+(i+1)+(r.v===false? ' (twist only)' : '')}); });
  pts.sort((p,q)=>p.x-q.x || (p.kind==='support'? -1 : 1));
  const rows=pts.map(p=>{
    let MEd=0, combo='';
    (a.ulsResults||[]).forEach(res=>{
      const m=Math.max(Math.abs(interpAt(res.fb.xs,res.fb.M,Math.max(p.x-1e-4,0))),Math.abs(interpAt(res.fb.xs,res.fb.M,Math.min(p.x+1e-4,a.L))))/1e6;
      if(m>MEd){ MEd=m; combo=res.combo.label; }
    });
    const NfEd=MEd*1000/h;             // kN: kN.m x 1000 / mm
    return Object.assign({},p,{MEd,combo,NfEd,F:0.025*NfEd});
  });
  const Fmax=rows.reduce((m,r)=>Math.max(m,r.F),0);
  return {h,rows,Fmax,basis:'N<sub>f,Ed</sub> = M<sub>Ed</sub>/h at the restraint station (h = overall depth, EN 1993-1-1 5.3.3(3)); restraint design force 2.5 % N<sub>f,Ed</sub> (6.3.5.2(5)(b), SCI practice) &mdash; advisory, not part of the member verdict; the bracing system must also satisfy the 5.3.3 stiffness/imperfection requirements. A station with M<sub>Ed</sub> = 0 (simply supported end) gets no flange force from this rule; its torsional restraint must still prevent twist.'};
}
/* ===========================================================================
   20 Sep 2026 torsion + N/Mz: combined torsion with direct axial force N_Ed
   and an imposed minor-axis moment M_z,Ed, verified "as Eurocode advises".
   The former block ("Combined torsion with direct axial force or imposed
   minor-axis bending is not implemented as one interaction") is replaced by
   the checks below; torsionCombinedBasis() states the basis in the brief.
   20 Sep 2026 review (reviewer findings on the first implementation): the
   binding policy of (6.1), the closed-section shear flow, the flange shear
   flow at P2, the channel points P1b/P2 and the per-path basis text below.
   ---------------------------------------------------------------------------
   FORMULAE IMPLEMENTED (units: N, mm, N/mm2 unless stated; E = a.E N/mm2,
   G = 81000 N/mm2, gamma_M0 = gamma_M1 = 1.0 UK NA, f_yd = f_y/gamma_M0)
   (1) CROSS-SECTION, EN 1993-1-1 cl 6.2.7(4)-(5) with the yield criterion
       6.2.1(5) Eq (6.1), sigma_z,Ed = 0:
         (sigma_x,Ed/f_yd)^2 + 3 (tau_Ed/f_yd)^2 <= 1
       at every station x of the torsion solution of every ULS combination
       and at the critical points of the section, every contribution taken at
       its worst (|values|, additive - conservative):
         sigma_x,Ed = N_Ed/A + M_y,Ed/W_el,y + M_z,tot/W_el,z + sigma_w,Ed
         tau_Ed     = tau_V + tau_t,Ed + tau_w,Ed
         N_Ed [kN] -> N_Ed*1e3/(A*100)            A = sec.A cm2
         M_z,tot(x) = |M_z,Ed| + |phi(x) M_y,Ed(x)|  imposed S.Mz [kN.m] plus the
                      second-order minor-axis moment of the twist (SCI P385
                      3.1.2 "M_z = phi M_y"; EN 1993-1-1 5.2.1(3): second-order
                      effects included where they increase the action effects)
         sigma_w  = E W_n phi''      W_n = tp.Wn0*100 mm2 (flange tip); channel
                                     tp.Wn2*100 mm2 at the web-flange junction;
                                     I/H: omega = 0 at the junction (web line)
         tau_t    = G t phi'          t = t_f on the flange, t_w on the web
                                     (= T_t t/I_T with T_t = G I_T phi')
         tau_w    = E S_w phi'''/t    S_w = tp.Sw1*1e4 mm4 at the flange centre
                                     (I/H: the junction, where omega = 0);
                                     channel: Sw1 at the flange point where
                                     W_n = 0 (P1b), Sw2 at the junction (flange
                                     side t = t_f, web side t = t_w), Sw3 at the
                                     web mid-depth (P385 Table A.2 points 1/2/3)
         tau_V    = V S/(I_y t)       EN 1993-1-1 6.2.6(4) Eq (6.20), I_y =
                                     sec.Ix*1e4 mm4 (major axis), the first
                                     moment of the area beyond the point:
                                     flange at the junction S_fF = S_f/2 (I/H,
                                     half flange one side of the web) or S_f
                                     (channel, the whole flange), t = t_f;
                                     web at the junction S_f = B t_f (D - t_f)/2,
                                     web mid-depth S_max = S_f + t_w (D/2 - t_f)^2/2,
                                     t = t_w (channel: its own B)
       Points (I/H and channel):
         P1 flange tip:         sigma = N/A + M_y/W_el,y + M_z,tot/W_el,z + E Wn0 phi''
                                tau   = G t_f phi'
         P1b flange, W_n = 0    (channel only) at s_1 = B' Wn0/(Wn0 + Wn2) from
                                the toe, B' = B - t_w/2 (omega is linear along
                                the flange: W_n0 at the toe and W_n2 at the web
                                line have opposite signs, so s_1 = B' - e_0):
                                sigma = N/A + M_y (D/2 - t_f/2)/I_y + M_z,tot |y_toe - s_1|/I_z
                                tau   = V s_1 t_f (D - t_f)/2/(I_y t_f) + G t_f phi' + E Sw1 phi'''/t_f
         P2 junction, flange:   sigma = N/A + M_y (D/2 - t_f/2)/I_y + M_z,tot y_web/I_z + E Wn2 phi''
                                tau   = V S_fF/(I_y t_f) + G t_f phi' + E S_w,J phi'''/t_f
                                (S_w,J = Sw1 for I/H, Sw2 for a channel)
         P3 junction, web:      sigma = N/A + M_y (D/2 - t_f)/I_y + M_z,tot y_web/I_z + E Wn2 phi''
                                tau   = V S_f/(I_y t_w) + G t_w phi' + E Sw2 phi'''/t_w
         P4 web mid-depth:      sigma = N/A + M_z,tot y_web/I_z
                                tau   = V S_max/(I_y t_w) + G t_w phi' + E Sw3 phi'''/t_w
         y_web = distance of the web plane from the minor axis: t_w/2 (I/H);
         channel: the web back c_y = B - I_z/W_el,z (W_el,z tabulated at the
         toe, y_toe = I_z/W_el,z) - the M_z stress on the web (M_z y/I_z),
         omitted by a flange-tip-only summation, is ~44 % of the toe stress for
         a PFC and is kept; the Wn2 and Sw2/Sw3 terms are zero for a doubly
         symmetric I/H.
       Hollow sections, cl 6.2.7(7): warping neglected, tau_t = T_Ed/W_t
         (W_t = tp.Wt*1e3 mm3 or the EN 10210-2 value already used), t = wall;
         the shear flow of V_Ed round the closed mid-line (Eq 6.20, q = 0 at
         the flange mid-width by symmetry): Q_c = ((B - t)/2) t ((D - t)/2) at
         the corner, Q_m = Q_c + t (D - t)^2/8 at the web mid-depth:
         corner:            sigma = N/A + M_y/W_el,y + M_z,tot/W_el,z; tau = tau_t + V Q_c/(I_y t)
         web mid-depth:     sigma = N/A + M_z,tot/W_el,z (the webs are the
                            extreme minor-axis fibres); tau = tau_t + V Q_m/(I_y t)
         flange mid-width:  sigma = N/A + M_y/W_el,y;                  tau = tau_t
         phi(x) of the St Venant solution (a.tors.uls) gives M_z,tot.
       Utilisation "Elastic yield criterion (6.1) with torsion, cl 6.2.7(5)"
       = the largest (6.1) value; reported with the station, point and every
       stress component (tor.elastic). BINDING POLICY (elasticBindingPolicy):
       6.2.7(5) is permissive ("the yield criterion in 6.2.1(5) MAY be
       applied") and 6.2.7(6) permits the plastic moment resistance under
       bending + torsion for Class 1/2 sections with B_Ed from the elastic
       analysis, so (6.1) enters the verdict (c.utils) only where the code
       gives no plastic route: Class 3 sections, and Class 1/2 OPEN sections
       with N_Ed != 0 (no expression of EN 1993-1-1 or P385 combines N_Ed with
       the bimoment plastically). Class 1/2 open sections with N_Ed = 0 are
       verified plastically by the P385 3.1.2 interaction under 6.2.7(6);
       Class 1/2 hollow sections by 6.2.7(7)/(9) (Eq 6.28), 6.2.8(4) and
       6.2.9.1/6.2.10 with V_pl,T,Rd: there (6.1) is computed and printed as
       information (c.info; an advisory when it exceeds 1). The P385 3.1.2
       plastic interaction, V/V_pl,T,Rd (6.2.7(9)), T_Ed/T_Rd and the 6.2.9/
       6.2.10 N-M interactions are kept; 3.1.2 now carries M_z,tot in its
       M_z term.
   (2) MEMBER, EN 1993-6 Annex A Eq (A.1) (informative; stated for I
       sections, applied to channels on the SCI P385 basis), P385 6.2/8.2 form:
         M_y,Ed/M_b,Rd + C_mz M_z,tot/M_z,Rd + k_w k_zw k_alpha M_w,Ed/M_f,Rd <= 1
         k_w = 0.7 - 0.2 M_w,Ed/M_f,Rd, k_zw = 1 - M_z,tot/M_z,Rd,
         k_alpha = 1/(1 - M_y,Ed,max/M_cr); M_z,tot = M_z,Ed + phi M_y per station;
         C_mz = 1.0 whenever an imposed M_z exists (constant diagram, psi = 1,
         Table B.3); otherwise the existing proxy (0.9 / 0.95 / 1.0).
   (3) MEMBER, EN 1993-1-1 cl 6.3.3 Eq 6.61/6.62 (annexB2): M_z,Ed = M_z,Ed
       (imposed) + max over the member of |phi M_y| of the combination's own
       torsion solution; C_mz = 1.0 (Table B.3 upper bound: exact for the
       imposed constant M_z, psi = 1, conservative for the twist-induced
       diagram); everything else unchanged.
   (4) ADVISORY (information only, NOT a utilisation), N_Ed > 0 with torsion:
         N_Ed/(chi_z N_Rk/gM1) + k_zy M_y,Ed/(chi_LT M_y,Rk/gM1)
           + k_zz M_z,tot/(M_z,Rk/gM1) + k_w k_zw k_alpha M_w,Ed/M_f,Rd
       = Eq 6.62 as evaluated (buck.u2, its M_z,Ed already M_z,tot) + the
       largest station value of the (A.1) warping term; k_alpha = 1 when no
       LTB check exists (fully restrained, M_cr -> infinity). "Superposition
       of Eq 6.62 and (A.1) - not a Eurocode expression, information only."
   No Eurocode expression combines N_Ed with warping torsion at member level;
   nothing beyond the clauses named above is invented.
   =========================================================================== */
// 20 Sep 2026: the k_alpha-unbounded state is a FAIL row (LTB governs), printed with the FAIL: prefix
const KALPHA_UNBOUNDED_FAIL='FAIL: M_y,Ed reaches the elastic critical moment M_cr (M_y,Ed >= M_cr): lateral-torsional buckling governs before the torsion interaction can be evaluated - the EN 1993-6 Annex A amplifier k_alpha = 1/(1 - M_y,Ed/M_cr) is unbounded and the utilisation is carried as 99; the member is inadequate as arranged (larger section, shorter unrestrained length or compression-flange restraint).';
const ELASTIC_TORSION_UTIL_NAME="Elastic yield criterion (6.1) with torsion, cl 6.2.7(5)";
const SUPERPOSITION_LABEL="superposition of Eq 6.62 and (A.1) - not a Eurocode expression, information only";
/* 20 Sep 2026 review: is the (6.1) value verdict-binding? (see the comment block, item (1) BINDING POLICY)
   Returns {binding, basis}. */
function elasticBindingPolicy(sec,cl,NEd){
  const cls=cl.cls, hasN=Math.abs(NEd)>1e-9;
  if(cls>=3) return {binding:true, basis:'Class 3 section: no plastic resistance exists, so the elastic verification of EN 1993-1-1 6.2.7(5) with the yield criterion 6.2.1(5) Eq (6.1) is the cross-section check (verdict-binding)'};
  if(!sec.isBox && hasN) return {binding:true, basis:'Class 1/2 open section with N_Ed: EN 1993-1-1 6.2.7(6) admits the plastic resistance for bending + torsion only and no expression of EN 1993-1-1 or SCI P385 combines N_Ed with the bimoment plastically, so the elastic verification 6.2.7(5)/(6.1) is the cross-section check (verdict-binding)'};
  if(sec.isBox) return {binding:false, basis:'Class 1/2 hollow section: the cross-section is verified by the plastic route the code gives - T_Ed/T_Rd (6.2.7(1)/(7), warping neglected), V_Ed/V_pl,T,Rd (6.2.7(9), Eq 6.28), rho from V_pl,T,Rd (6.2.8(4)) and the 6.2.9.1/6.2.10 N-M_y-M_z interaction; the elastic verification of 6.2.7(5) is permissive ("may be applied") and is printed for information'};
  return {binding:false, basis:'Class 1/2 open section without N_Ed: EN 1993-1-1 6.2.7(6) permits the plastic moment resistance under bending + torsion with B_Ed from the elastic analysis (the SCI P385 3.1.2 interaction with M_z,tot); the elastic verification of 6.2.7(5) is permissive ("may be applied") and is printed for information'};
}
/* 20 Sep 2026 review: the basis text of the combined verification, per path (the former single sentence
   named warping torsion and (A.1) for hollow sections and 6.61/6.62 where they are not evaluated).
   o = {box, tension, hasN, hasMz, restrained, buckEvaluated, annexEvaluated, binding} */
function torsionCombinedBasis(o){
  const buckTxt= o.buckEvaluated? ', cl 6.3.3 (6.61/6.62) with the second-order minor-axis moment phi.M_y added to M_z,Ed'
    : o.tension? '; cl 6.3.3 (6.61/6.62) is not evaluated for axial tension (N_t,Rd and the 6.2.9 cross-section interaction apply)'
    : o.restrained? '; cl 6.3.3 (6.61/6.62) does not apply to a fully restrained member without axial compression (the 6.2.9 cross-section interaction with M_z,tot applies)'
    : '';
  if(o.box){
    return 'EN 1993-1-1 6.2.7(7): warping neglected for the hollow section; the verification is 6.2.7(5)/(6.1) at the cross-section with tau_t = T_Ed/W_t, the V_Ed shear flow and N/A + M_y/W_el,y + M_z,tot/W_el,z'+(o.binding? '' : ' (information only: the Class 1/2 plastic route governs)')+', T_Ed/T_Rd (6.2.7(1)), V_Ed/V_pl,T,Rd (6.2.7(9), Eq 6.28), 6.2.8(4)/6.2.9.1/6.2.10 with V_pl,T,Rd'+buckTxt+'; EN 1993-6 (A.1) does not apply to a closed section';
  }
  return 'No expression in EN 1993-1-1 or EN 1993-6 combines N_Ed with warping torsion at member level; the verification is EN 1993-1-1 6.2.7(5)/(6.1) at the cross-section with all stresses'+(o.binding? '' : ' (information only: the Class 1/2 plastic route of 6.2.7(6) / SCI P385 3.1.2 with M_z,tot governs)')+buckTxt+(o.annexEvaluated? ', and EN 1993-6 (A.1) with M_z,Ed = M_z + phi.M_y' : (o.restrained? '; EN 1993-6 (A.1) is not evaluated for a fully restrained member (no lateral-torsional buckling)' : ''));
}
// EN 1993-1-1 6.2.1(5) Eq (6.1) with sigma_z,Ed = 0
function yieldCriterion61(sigmaX,tau,fyd){ return Math.pow(sigmaX/fyd,2)+3*Math.pow(tau/fyd,2); }
// one station's points -> totals and (6.1); pts = [{point, sigmaN, sigmaMy, sigmaMz, sigmaW, tauV, tauT, tauW}]
function elasticPoints61(pts,fyd){
  return pts.map(p=>{ const sigmaX=p.sigmaN+p.sigmaMy+p.sigmaMz+p.sigmaW, tau=p.tauV+p.tauT+p.tauW;
    return Object.assign({},p,{sigmaX,tau,u:yieldCriterion61(sigmaX,tau,fyd)}); });
}
// worst point of a station into the running record (st = {x, combo, ...station data})
function elasticGovern(worst,pts,st){
  let w=worst;
  pts.forEach(p=>{ if(p.u>w.u) w=Object.assign({},st,p,{points:pts}); });
  return w;
}
/* (1) open sections: the P385 Method B solution O = a.torsO (sols per ULS
   combination: sol.xs mm, phi rad, p1 = phi' rad/mm, p2 = phi'' rad/mm2,
   p3 = phi''' rad/mm3; fb.xs/fb.M N.mm/fb.V N coincident). NEd kN (design
   value, |.| taken), MzImp kN.m (imposed |S.Mz|). Returns tor.elastic. */
function torsionElasticOpen(a,sec,fy,gM0,O,NEd,MzImp){
  const E=a.E, G=81000, fyd=fy/gM0;
  const A=sec.A*100, Iy=sec.Ix*1e4, Iz=sec.Iy*1e4, Wely=sec.Zx*1e3, Welz=sec.Zy*1e3;   // mm2, mm4, mm3
  const D=sec.D, B=sec.B, tf=sec.tf, tw=sec.tw, chan=sec.kind==='channel', tp=sec.tp||{};
  const Wn0=(tp.Wn0||0)*100, Wn2=chan? (tp.Wn2||0)*100 : 0;                       // mm2 (cm2 -> mm2)
  const Sw1=(tp.Sw1||0)*1e4, Sw2=chan? (tp.Sw2||0)*1e4 : 0, Sw3=chan? (tp.Sw3||0)*1e4 : 0;   // mm4 (cm4 -> mm4)
  const SwJ=chan? Sw2 : Sw1;                                                       // junction, flange side (20 Sep 2026 review: Sw2 for a channel, not max(Sw1,Sw2,Sw3))
  const Sf=B*tf*(D-tf)/2, Smax=Sf+tw*Math.pow(D/2-tf,2)/2;                        // mm3, first moments about y-y (web values, Eq 6.20)
  const SfF=chan? Sf : Sf/2;                                                       // mm3, flange at the junction: one side of the web (20 Sep 2026 review)
  const yWeb=chan? Math.max(B-Iz/Welz,0) : tw/2;                                   // mm, web plane from the minor axis
  // channel point P1b: the flange point where W_n = 0 (P385 point 1, S_w1), s_1 from the toe (omega linear along the flange)
  const Bf=B-tw/2, s1=(chan && Wn0+Wn2>0)? Bf*Wn0/(Wn0+Wn2) : 0, yToe=Iz/Welz, y1b=Math.abs(yToe-s1);
  const sN=Math.abs(NEd)*1e3/A;
  let worst={u:-1}, MzTwistMax=0, MzTotMax=0, nSt=0;
  O.sols.forEach(se=>{ const g=se.sol, fb=se.fb;
    g.xs.forEach((x,i)=>{
      const MyN=Math.abs(interpAt(fb.xs,fb.M,x)), VN=Math.abs(interpAt(fb.xs,fb.V,x));   // N.mm, N
      const phi=g.phi[i], p1=Math.abs(g.p1[i]), p2=Math.abs(g.p2[i]), p3=Math.abs(g.p3[i]);
      const MzTw=Math.abs(phi*MyN), MzTot=MzImp*1e6+MzTw;                          // N.mm
      const sMyTip=MyN/Wely, sMyFm=MyN*(D/2-tf/2)/Iy, sMyJ=MyN*(D/2-tf)/Iy;
      const sMzTip=MzTot/Welz, sMzWeb=MzTot*yWeb/Iz, sMz1b=MzTot*y1b/Iz;
      const sW0=E*Wn0*p2, sW2=E*Wn2*p2;
      const tTf=G*tf*p1, tTw=G*tw*p1;
      const tWJ=E*SwJ*p3/tf, tW1b=chan? E*Sw1*p3/tf : 0, tW3=chan? E*Sw2*p3/tw : 0, tW4=chan? E*Sw3*p3/tw : 0;
      const tV2=VN*SfF/(Iy*tf), tV1b=chan? VN*s1*tf*(D-tf)/2/(Iy*tf) : 0, tV3=VN*Sf/(Iy*tw), tV4=VN*Smax/(Iy*tw);
      const list=[
        {point:'P1 flange tip',                 sigmaN:sN, sigmaMy:sMyTip, sigmaMz:sMzTip, sigmaW:sW0, tauV:0,    tauT:tTf, tauW:0}];
      if(chan) list.push({point:'P1b flange at W_n = 0',   sigmaN:sN, sigmaMy:sMyFm,  sigmaMz:sMz1b,  sigmaW:0,   tauV:tV1b, tauT:tTf, tauW:tW1b});
      list.push(
        {point:'P2 web-flange junction, flange',sigmaN:sN, sigmaMy:sMyFm,  sigmaMz:sMzWeb, sigmaW:sW2, tauV:tV2,  tauT:tTf, tauW:tWJ},
        {point:'P3 web-flange junction, web',   sigmaN:sN, sigmaMy:sMyJ,   sigmaMz:sMzWeb, sigmaW:sW2, tauV:tV3,  tauT:tTw, tauW:tW3},
        {point:'P4 web mid-depth',              sigmaN:sN, sigmaMy:0,      sigmaMz:sMzWeb, sigmaW:0,   tauV:tV4,  tauT:tTw, tauW:tW4});
      const pts=elasticPoints61(list,fyd);
      worst=elasticGovern(worst,pts,{x,combo:se.combo.label,My:MyN/1e6,V:VN/1e3,phi,p1:g.p1[i],p2:g.p2[i],p3:g.p3[i],MzImp,MzTwist:MzTw/1e6,MzTot:MzTot/1e6});
      MzTwistMax=Math.max(MzTwistMax,MzTw/1e6); MzTotMax=Math.max(MzTotMax,MzTot/1e6); nSt++;
    });
  });
  if(worst.u<0) return null;
  return Object.assign(worst,{box:false,fy:fyd,NEd,MzTwistMax,MzTotMax,nStations:nSt,
    geom:{A,Iy,Iz,Wely,Welz,Wn0,Wn2,Sw1,Sw2,Sw3,SwJ,Sf,SfF,Smax,yWeb,yToe,s1,y1b,E,G,tf,tw,D,B,chan},
    basis:'EN 1993-1-1 6.2.7(5): elastic verification of the cross-section with the yield criterion 6.2.1(5) Eq (6.1), sigma_x = N/A + M_y/W_el,y + M_z,tot/W_el,z + sigma_w and tau = tau_V + tau_t + tau_w at the flange tip, '+(chan? 'the flange point where W_n = 0 (S_w1), ' : '')+'the web-flange junction (flange and web side) and the web mid-depth, every station of every ULS combination, every contribution at its worst; M_z,tot = M_z,Ed + phi.M_y'});
}
/* (1) hollow sections, cl 6.2.7(7): warping neglected; the St Venant solution
   a.tors.uls per ULS combination (r.xs/r.T N.mm torque diagram, r.nodes/r.phi
   twist); Wt mm3. The V_Ed shear flow round the closed mid-line (Eq 6.20):
   Q_c at the corner, Q_m at the web mid-depth (20 Sep 2026 review: the corner
   carried tau_V = 0 and the web the mean V/(2(D - 2t)t)). Returns tor.elastic. */
function torsionElasticBox(a,sec,fy,gM0,Wt,NEd,MzImp){
  const fyd=fy/gM0, A=sec.A*100, Iy=sec.Ix*1e4, Wely=sec.Zx*1e3, Welz=sec.Zy*1e3, t=sec.tf, D=sec.D, B=sec.B;
  const Qc=((B-t)/2)*t*((D-t)/2), Qm=Qc+t*Math.pow(D-t,2)/8;                       // mm3, mid-line first moments (cut at the flange mid-width, q = 0)
  const sN=Math.abs(NEd)*1e3/A;
  const torsUls=(a.tors&&a.tors.uls)||[];
  let worst={u:-1}, MzTwistMax=0, MzTotMax=0, nSt=0;
  a.ulsResults.forEach(res=>{
    const tr=torsUls.find(u=>u.combo===res.combo); if(!tr) return;
    const xs=[...new Set([...res.fb.xs,...tr.r.xs].map(x=>+x.toFixed(4)))].sort((p,q)=>p-q);
    xs.forEach(x=>{
      const MyN=Math.abs(interpAt(res.fb.xs,res.fb.M,x)), VN=Math.abs(interpAt(res.fb.xs,res.fb.V,x));
      const T=Math.abs(interpAt(tr.r.xs,tr.r.T,x)), phi=interpAt(tr.r.nodes,tr.r.phi,x);
      const MzTw=Math.abs(phi*MyN), MzTot=MzImp*1e6+MzTw;
      const tauT=T/Wt, tauVc=VN*Qc/(Iy*t), tauVm=VN*Qm/(Iy*t), sMy=MyN/Wely, sMz=MzTot/Welz;
      const pts=elasticPoints61([
        {point:'corner',           sigmaN:sN, sigmaMy:sMy, sigmaMz:sMz, sigmaW:0, tauV:tauVc, tauT, tauW:0},
        {point:'web mid-depth',    sigmaN:sN, sigmaMy:0,   sigmaMz:sMz, sigmaW:0, tauV:tauVm, tauT, tauW:0},
        {point:'flange mid-width', sigmaN:sN, sigmaMy:sMy, sigmaMz:0,   sigmaW:0, tauV:0,     tauT, tauW:0}],fyd);
      worst=elasticGovern(worst,pts,{x,combo:res.combo.label,My:MyN/1e6,V:VN/1e3,T:T/1e6,phi,MzImp,MzTwist:MzTw/1e6,MzTot:MzTot/1e6});
      MzTwistMax=Math.max(MzTwistMax,MzTw/1e6); MzTotMax=Math.max(MzTotMax,MzTot/1e6); nSt++;
    });
  });
  if(worst.u<0) return null;
  return Object.assign(worst,{box:true,fy:fyd,NEd,MzTwistMax,MzTotMax,nStations:nSt,geom:{A,Iy,Wely,Welz,Wt,t,D,B,Qc,Qm},
    basis:'EN 1993-1-1 6.2.7(5) with 6.2.7(7) (warping neglected, tau_t = T_Ed/W_t): yield criterion 6.2.1(5) Eq (6.1) at the corner (tau_t + V Q_c/(I_y t)), the web mid-depth (tau_t + V Q_m/(I_y t)) and the flange mid-width, the V_Ed shear flow round the closed mid-line per Eq (6.20), every station of every ULS combination, every contribution at its worst; M_z,tot = M_z,Ed + phi.M_y'});
}
/* (3) max over the member of |phi(x) M_y,Ed(x)| (kN.m) for ONE ULS combination:
   the P385 solution for open sections, the St Venant twist for hollow ones. */
function torsionMzTwistMax(a,combo){
  let m=0;
  if(a.torsO&&a.torsO.ok&&a.torsO.sols){
    const se=a.torsO.sols.find(s=>s.combo===combo);
    if(se) se.sol.xs.forEach((x,i)=>{ m=Math.max(m,Math.abs(se.sol.phi[i]*interpAt(se.fb.xs,se.fb.M,x))/1e6); });
  } else if(a.tors&&a.tors.on&&a.tors.uls){
    const tr=a.tors.uls.find(u=>u.combo===combo), res=(a.ulsResults||[]).find(r=>r.combo===combo);
    if(tr&&res) tr.r.nodes.forEach((x,i)=>{ m=Math.max(m,Math.abs(tr.r.phi[i]*interpAt(res.fb.xs,res.fb.M,x))/1e6); });
  }
  return m;
}
/* (2) EN 1993-6 Annex A Eq (A.1) over the P385 station grids of tor (rows
   carry My, Mw, Mz = phi.My, MzImp, MzTot kN.m); MbA = chi_LT W_y f_y/gM1
   (no f-factor, P385 basis), McrA kN.m, CmzProxy the caller's diagram proxy.
   Shared by the standard (closed-form Mcr) and eigen paths. */
function annexAEval(tor,MbA,McrA,CmzProxy){
  const MzImp=tor.MzImp||0;
  const Cmz= MzImp>1e-9? 1.0 : CmzProxy;
  const CmzBasis= MzImp>1e-9? 'C_mz = 1.0: the imposed M_z is a constant diagram (psi = 1, Table B.3); the twist-induced part carries no proxy'
                            : 'C_mz = '+CmzProxy.toFixed(2)+' for the twist-induced M_z = phi.M_y diagram (no M_z imposed; the caller\'s load-case proxy or override)';
  let MyMax=0; tor.grids.forEach(g2=>g2.rows.forEach(r2=>{ MyMax=Math.max(MyMax,r2.My); }));
  // resistances CLASS-CONSISTENT (elastic for Class 3)
  const MzR=tor.cls12? tor.Mplz : tor.Melz;
  const MfR=tor.cls12? tor.Mplf : tor.Melf;
  if(MyMax>=McrA*0.999) return {u:99,kAlpha:Infinity,Cmz,CmzBasis,MbA,McrA,MzR,MfR,MzImp,MzTwist:tor.MzMax,MzTot:tor.MzTot,unbounded:true};
  const kAlpha=1/(1-MyMax/McrA);
  let worst={u:-1};
  tor.grids.forEach(g2=>g2.rows.forEach(r2=>{
    const MzT=r2.MzTot;                                     // M_z,tot = M_z,Ed + phi.M_y at the station
    const kw=Math.max(0.7-0.2*r2.Mw/MfR,0);
    const kzw=Math.max(1-MzT/MzR,0);
    const u=r2.My/MbA + Cmz*MzT/MzR + kw*kzw*kAlpha*r2.Mw/MfR;
    if(u>worst.u) worst={u,x:r2.x,My:r2.My,Mz:MzT,MzImp,MzTwist:r2.Mz,MzTot:MzT,Mw:r2.Mw,kw,kzw,combo:g2.combo.label};
  }));
  return Object.assign(worst,{kAlpha,Cmz,CmzBasis,MbA,McrA,MzR,MfR,unbounded:false});
}
/* (4) advisory superposition, N_Ed > 0 with an open-section torsion solution;
   annex = null when no LTB check exists (k_alpha = 1). Returns null or
   {u, u62, uw, kAlpha, at, text}; the caller pushes text as an advisory. */
function torsionSuperposition(tor,annex,buck){
  if(!(tor&&tor.p385&&tor.grids&&buck&&buck.Fc>1e-9)) return null;
  if(annex&&annex.unbounded) return null;
  const MzR=tor.cls12? tor.Mplz : tor.Melz, MfR=tor.cls12? tor.Mplf : tor.Melf;
  const kAlpha=(annex&&isFinite(annex.kAlpha))? annex.kAlpha : 1;
  let uw=0, at=null;
  tor.grids.forEach(g2=>g2.rows.forEach(r2=>{
    const kw=Math.max(0.7-0.2*r2.Mw/MfR,0), kzw=Math.max(1-r2.MzTot/MzR,0);
    const t=kw*kzw*kAlpha*r2.Mw/MfR;
    if(t>uw){ uw=t; at={x:r2.x,kw,kzw,Mw:r2.Mw,MzTot:r2.MzTot,combo:g2.combo.label}; }
  }));
  const u=buck.u2+uw;
  const text='ADVISORY - '+SUPERPOSITION_LABEL+': N<sub>Ed</sub>/(&chi;<sub>z</sub>N<sub>Rk</sub>/&gamma;<sub>M1</sub>) + k<sub>zy</sub>M<sub>y,Ed</sub>/(&chi;<sub>LT</sub>M<sub>y,Rk</sub>/&gamma;<sub>M1</sub>) + k<sub>zz</sub>M<sub>z,tot</sub>/(M<sub>z,Rk</sub>/&gamma;<sub>M1</sub>) + k<sub>w</sub>k<sub>zw</sub>k<sub>&alpha;</sub>M<sub>w,Ed</sub>/M<sub>f,Rd</sub> = '
    +buck.u2.toFixed(3)+' (Eq 6.62 with M<sub>z,tot</sub> = '+buck.MzEd.toFixed(2)+' kN&middot;m) + '+uw.toFixed(3)+' (warping term of (A.1)'+(at? ' at x = '+(at.x/1000).toFixed(2)+' m, k<sub>w</sub> = '+at.kw.toFixed(3)+', k<sub>zw</sub> = '+at.kzw.toFixed(3)+', k<sub>&alpha;</sub> = '+kAlpha.toFixed(3)+(annex? '' : ' (no LTB check: M<sub>cr</sub> unbounded)') : '')+') = '+u.toFixed(3)+'. Not a utilisation; the verdict rests on (6.1), 6.61/6.62, (A.1), V/V<sub>pl,T,Rd</sub> and P385 3.1.2.';
  return {u,u62:buck.u2,uw,kAlpha,at,text,label:SUPERPOSITION_LABEL};
}
function checksEC3Restrained(a){
  // SCI worked-example procedure: fully laterally restrained beam to BS EN 1993-1-1 (UK NA).
  // Sequence: classification -> shear (6.2.6) -> shear buckling screen (6.2.6(6)) ->
  // moment (6.2.5, with the 6.2.8 shear check made AT the point of maximum moment) ->
  // vertical deflection (NA 2.23).
  const sec=a.sec, fy=a.py;
  const unsupported=[];
  const advisory=[];
  const eps=epsEC3(fy);
  const gM0=1.0, eta=1.0; // UK NA gammaM0; eta=1.0 taken conservatively (EN 1993-1-5)
  const F=S.axial||0;
  // classification must see the coexistent axial compression: with N_Ed the web
  // is an "internal part in bending and compression" (Table 5.2) and its limits
  // tighten below 72e/83e/124e - a web that is Class 1 in pure bending can be
  // Class 3 or 4 under combined actions, which changes W_y and can invalidate
  // the plastic M_N,Rd expressions.
  const cl=classifyEC3(sec,eps,{NEd:Math.max(F,0)*1000, fy,minorBending:Math.abs(S.Mz||0)>1e-9});
  // I/H under M_z (item 1.9(b)): the web is unstressed by M_z and keeps its y-y
  // (+N) limits; the flange outstands are classified under the combined stress
  // (the outstand compressed by M_z is wholly in compression, alpha = 1, so the
  // 9e/10e/14e bound governs). Printed with the classification.
  cl.mzStress = (Math.abs(S.Mz||0)>1e-9 && sec.kind==='I')? mzFlangeStress(sec,F,a.Mmax,S.Mz) : null;
  if(Math.abs(S.Mz||0)>1e-9 && sec.kind!=='I') advisory.push('For biaxial bending of this section family each wall parallel to the web is conservatively classified using the uniform-compression limits in Table 5.2; no favourable biaxial stress distribution is assumed.');
  // Class-4 web in uniform compression (item 1.9(c) / 3.9(c)): effective area
  // per EN 1993-1-5 4.4 (aeffWebCompression) instead of blocking; used in
  // N_c,Rd, N_b,Rd and the Table 6.7 Class-4 column of Eq 6.61/6.62. The
  // flanges must stay Class <= 3 in uniform compression and the section must
  // be doubly symmetric (e_N = 0); a channel web reduction would shift the
  // centroid (N e_N), which is not modelled.
  const aeff=aeffWebCompression(sec,eps);
  aeff.active = F>0 && aeff.applies;
  const flangeCompLimit = sec.isBox? 42*eps : 14*eps;
  if(F>0 && sec.bT>flangeCompLimit) unsupported.push('The flange is Class 4 in uniform compression (c/t = '+g(sec.bT,2)+' > '+g(flangeCompLimit,2)+'): an effective flange width per EN 1993-1-5 4.4 is not implemented; PASS is blocked.');
  if(aeff.active && sec.kind==='channel') unsupported.push('PFC web Class 4 in uniform compression (d/t = '+g(sec.dt,2)+' > 42&epsilon; = '+g(42*eps,2)+'): the effective web shifts the centroid of a channel (N<sub>Ed</sub>e<sub>N</sub> minor-axis moment, EN 1993-1-1 6.2.9.3), which is not implemented; PASS is blocked.');
  const clsName=["","Class 1","Class 2","Class 3","Class 4"][cl.cls];
  if(cl.cls>=4) unsupported.push("EC3 Class 4 (slender) section"+(cl.webCase==='bending+compression'?" (web classified for combined bending + compression: the effective section under the actual stress gradient, with its e_N shift, is not implemented)":"")+": effective-section properties per EN 1993-1-5 are required; not covered by the restrained-beam procedure.");
  // web transverse forces at every point load and every support reaction
  // (EN 1993-1-5 clause 6 + 7.2; webTransverseCheck above); its utilisations
  // enter the verdict below, a declared stiffener prints an advisory
  const web=webTransverseCheck(a,sec,fy,eps,cl);
  web.unsupported.forEach(m=>unsupported.push(m));
  web.advisory.forEach(m=>advisory.push(m));
  advisory.push("Web transverse forces (EN 1993-1-5 clause 6) are checked at every point load and support as patch loads on the loaded flange: distributed loads, loads hung from the bottom flange (hangers), the total-load check of closely spaced loads (6.3(3)) and flange-induced buckling (section 8) are not evaluated; a declared bearing stiffener must be designed to 9.4.");
  const MzEd=Math.abs(S.Mz||0);   // applied minor-axis design moment (kN.m), single-value input
  // ---- axial + biaxial bending cross-section resistance, cl 6.2.9.1
  // Forms (My/MN,y)^alpha + (Mz/MN,z)^beta <= 1. (validated against the
  // independent commercial-software SHS beam-column example for the uniaxial+axial case) ----
  const AgAx=sec.A*1e2, AnetAx=(S.anet!=null? S.anet*1e2 : AgAx);
  const fuAx=fuFromGrade(S.grade);
  const NplRd=AgAx*fy/gM0/1000;                              // kN
  const NcRd= aeff.active? aeff.Aeff*fy/gM0/1000 : NplRd;    // kN, cl 6.2.4(2): A_eff for a Class-4 web in uniform compression
  const NuRd=0.9*AnetAx*fuAx/1.10/1000;                      // kN, gammaM2 = 1.10 (UK NA Table NA.1: resistance of cross-sections in tension to fracture; 1.25 is the EN recommended value)
  const NtRd=Math.min(NplRd,NuRd);
  let ax=null;
  if(Math.abs(F)>1e-9 || MzEd>1e-9){
    const nAx=Math.abs(F)/NplRd;
    const biax=MzEd>1e-9;
    const My=Math.abs(a.Mmax);
    // minor-axis resistances reported with the axial/biaxial block (so the
    // brief prints engine values, not its own): V_pl,z,Rd from the cl 6.2.6(3)
    // shear area for load parallel to the flanges - (f) rolled I, H and
    // channel sections A - sum(hw tw), (h) hollow sections A b/(b + h) - and
    // M_c,z,Rd = W_z fy/gammaM0 with the class-consistent modulus (cl 6.2.5).
    // V_z,Ed is zero in this single-plane model, so V_pl,z,Rd is informational.
    const hwAxz=sec.D-2*sec.tf;
    const Avz= sec.isBox? AgAx*sec.B/(sec.D+sec.B) : Math.max(AgAx-hwAxz*sec.tw,0);
    const VplZ=Avz*fy/(Math.sqrt(3)*gM0)/1000;                 // kN
    const Mcz=(cl.cls<=2? sec.Sy : sec.Zy)*1e3*fy/gM0/1e6;      // kN.m
    if(sec.kind==='channel' && cl.cls<4){
      const McChan=(cl.cls<=2? sec.Sx:sec.Zx)*1e3*fy/gM0/1e6;
      const McChanZ=Mcz;
      ax={cls3:false,chan:true,n:nAx,NplRd,NuRd,NtRd,MN:McChan,MNz:McChanZ,alpha:1,beta:1,biax,Mz:MzEd,Avz,VplZ,Mcz,
        mnLbl:'channel: linear interaction (cl 6.2.1(7); &alpha; = &beta; = 1, conservative &mdash; verified commercial-software basis)',
        mUtil:nAx + My/Math.max(McChan,1e-9) + (biax? MzEd/Math.max(McChanZ,1e-9):0),
        nUtil: F>0? Math.abs(F)/NcRd : (F<0? Math.abs(F)/NtRd : 0), tension:F<0, NcRd, aeff};
    } else if(cl.cls>=4){
      /* Class 4 already blocked above */
    } else {
      const Mpl=sec.Sx*1e3*fy/gM0/1e6, Mel=sec.Zx*1e3*fy/gM0/1e6;
      const Mplz=sec.Sy*1e3*fy/gM0/1e6, Melz=sec.Zy*1e3*fy/gM0/1e6;
      let MN,MNz,alpha,beta,mnLbl,waiver=false;
      if(cl.cls<=2){
        const aw=Math.min(Math.max((AgAx-2*sec.B*sec.tf)/AgAx,0),0.5);
        MN=Math.max(0,Math.min(Mpl*(1-nAx)/(1-0.5*aw),Mpl));
        if(sec.kind==='I'){
          const hwAx=sec.D-2*sec.tf;
          if(Math.abs(F)*1000<=0.25*NplRd*1000 && Math.abs(F)*1000<=0.5*hwAx*sec.tw*fy/gM0){ MN=Mpl; waiver=true; }
          alpha=2; beta=Math.max(5*nAx,1);
          MNz = nAx<=aw ? Mplz : Mplz*(1-Math.pow((nAx-aw)/(1-aw),2));  // cl 6.2.9.1(5), minor axis
          mnLbl='a = '+g(aw,3)+'; &alpha; = 2, &beta; = '+g(beta,2)+(waiver? '; small axial (cl 6.2.9.1(4)): no major reduction':'');
        } else { // RHS / SHS
          alpha=nAx<=0.8?1.66/(1-1.13*nAx*nAx):6; beta=alpha;
          const af=Math.min(Math.max((AgAx-2*sec.D*sec.tf)/AgAx,0),0.5);
          MNz=Math.min(Mplz*(1-nAx)/(1-0.5*af),Mplz);
          mnLbl='a<sub>w</sub> = '+g(aw,3)+'; &alpha; = &beta; = 1.66/(1&minus;1.13n&sup2;) = '+g(alpha,2);
        }
        ax={cls3:false,n:nAx,NplRd,NuRd,NtRd,MN,MNz,alpha,beta,mnLbl,biax,Mz:MzEd,Avz,VplZ,Mcz,
          mUtil:Math.pow(My/Math.max(MN,1e-9),alpha) + (biax? Math.pow(MzEd/Math.max(MNz,1e-9),beta):0),
          nUtil: F>0? Math.abs(F)/NcRd : (F<0? Math.abs(F)/NtRd : 0), tension:F<0, NcRd, aeff};
      } else {
        ax={cls3:true,n:nAx,NplRd,NuRd,NtRd,MN:Mel,MNz:Melz,alpha:1,beta:1,mnLbl:'Class 3: elastic, cl 6.2.9.2',biax,Mz:MzEd,Avz,VplZ,Mcz,
          mUtil:Math.abs(F)/NplRd + My/Math.max(Mel,1e-9) + (biax? MzEd/Math.max(Melz,1e-9):0),
          nUtil: F>0? Math.abs(F)/NcRd : (F<0? Math.abs(F)/NtRd : 0), tension:F<0, NcRd, aeff};
      }
    }
  }
  // geometry
  const hw=sec.D-2*sec.tf;                                   // clear web depth h - 2tf
  const cOut = sec.kind==='I'? (sec.B-sec.tw-2*sec.r)/2 : null; // outstand flange width
  // shear area, cl 6.2.6(3)
  const A=sec.A*100; let Av,AvRaw=null,avFloor=null;
  if(sec.isBox){ Av=A*sec.D/(sec.D+sec.B); }
  else if(sec.kind==='channel'){ Av=A-2*sec.B*sec.tf+(sec.tw+sec.r)*sec.tf; }
  else { AvRaw=A-2*sec.B*sec.tf+(sec.tw+2*sec.r)*sec.tf; avFloor=eta*hw*sec.tw; Av=Math.max(AvRaw,avFloor); }
  const VcRd=Av*fy/(Math.sqrt(3)*gM0)/1000;                   // kN
  const Fv=Math.abs(a.Vmax);
  const shearUtil=VcRd>0? Fv/VcRd : 0;
  const cshear=(fy/Math.sqrt(3))/gM0;
  const shearTorsionUtil=(VplTRd,V=Fv)=> VplTRd>1e-9 ? V/VplTRd : (V>1e-9 ? 99 : 0);
  const sweepXs=(...sets)=>[...new Set(sets.flat().map(x=>+x.toFixed(4)))].sort((p,q)=>p-q);
  const boxShearTorsionSweep=(Wt)=>{
    let worst={u:-1,x:0,V:0,T:0,tau:0,VplTRd:VcRd,combo:''};
    const torsUls=(a.tors&&a.tors.uls)||[];
    a.ulsResults.forEach(res=>{
      const tr=torsUls.find(u=>u.combo===res.combo);
      if(!tr) return;
      sweepXs(res.fb.xs,tr.r.xs).forEach(x=>{
        const Vx=Math.abs(interpAt(res.fb.xs,res.fb.V,x))/1000;
        const T=Math.abs(interpAt(tr.r.xs,tr.r.T,x))/1e6;
        const tau=T*1e6/Wt;
        const VplTRd=Math.max(0,1-tau/cshear)*VcRd;
        const u=shearTorsionUtil(VplTRd,Vx);
        if(u>worst.u) worst={u,x,V:Vx,T,tau,VplTRd,combo:res.combo.label,zeroCapacity:VplTRd<=1e-9&&Vx>1e-9};
      });
    });
    if(worst.u<0){
      const T=(a.tors&&a.tors.Tmax)||0, tau=T*1e6/Wt;
      const VplTRd=Math.max(0,1-tau/cshear)*VcRd;
      worst={u:shearTorsionUtil(VplTRd,Fv),x:(a.tors&&a.tors.Tpos? a.tors.Tpos:0)*1000,V:Fv,T,tau,VplTRd,combo:(a.tors&&a.tors.governT)||'',zeroCapacity:VplTRd<=1e-9&&Fv>1e-9};
    }
    return worst;
  };
  // shear buckling screen, cl 6.2.6(6): hw/tw <= 72 eps/eta (unstiffened web)
  const sbRatio = sec.isBox? sec.dt : hw/sec.tw;
  const sbLimit = 72*eps/eta;
  const sbOk = sbRatio<=sbLimit+1e-9;
  if(!sbOk) unsupported.push("h_w/t_w exceeds 72*eps/eta: web shear-buckling resistance per EN 1993-1-5 must be checked and is not implemented in this calculator.");
  // torsion (cl 6.2.7) - active when loads are eccentric to the shear centre
  let tor=null;
  if(a.tors && a.tors.on){
    if(sec.isBox){
      const cb=ctBoxEN10210(sec);
      const Wt=(sec.tp&&sec.tp.Wt)? sec.tp.Wt*1e3 : cb.Ct; // mm3, tabulated P385 value preferred
      const WtSrc=(sec.tp&&sec.tp.Wt)? 'SCI P385 Table A.7/A.8' : 'EN 10210-2 formula';
      const ItShow=(sec.tp&&sec.tp.IT)? sec.tp.IT*1e4 : cb.It;
      const TRd=fy*Wt/(Math.sqrt(3)*gM0)/1e6;                  // kN.m, cl 6.2.7(7); Tw,Ed neglected for hollow sections
      const TEd=a.tors.Tmax;
      const tauMax=TEd*1e6/Wt;                                  // N/mm2, shear stress due to peak torsion
      const vt=boxShearTorsionSweep(Wt);
      // 20 Sep 2026 torsion + N/Mz: elastic yield criterion (6.1) with N_Ed, M_y, M_z,tot and
      // tau_t = T_Ed/W_t (cl 6.2.7(5)/(7)), every station of every ULS combination (helper above)
      const elastic=torsionElasticBox(a,sec,fy,gM0,Wt,F,MzEd);
      tor={box:true,Wt,WtSrc,ItShow,TRd,TEd,
        tau:vt.tau, tauMax, VplTRd:vt.VplTRd, vt,
        torUtil:TRd>0? TEd/TRd:0, vtUtil:vt.u, vtZeroCapacity:!!vt.zeroCapacity,
        elastic, MzImp:MzEd, MzTot:elastic? elastic.MzTotMax : MzEd, MzTwistMax:elastic? elastic.MzTwistMax : 0,
        GIt:a.tors.GIt,TmaxSLS:a.tors.TmaxSLS,phiMax:a.tors.phiMax,phiDeg:a.tors.phiMax*180/Math.PI,phiPos:a.tors.phiPos,governT:a.tors.governT,governTw:a.tors.governTw};
      if(sec.boxType==='CF') unsupported.push("Torsional constants are computed with hot-finished (EN 10210-2) corner geometry; cold-formed (EN 10219-2) corners differ slightly - verify W_t for a cold-formed section.");
    } else if(a.torsO && a.torsO.ok){
      // ---- SCI P385 Method B: elastic warping analysis + design effects ----
      const O=a.torsO, hh=sec.D-sec.tf;                     // (h - tf) flange lever
      const EIw=a.E*O.Iw;
      const chan=sec.kind==='channel';
      const Mply=sec.Sx*1e3*fy/1e6, Mplz=sec.Sy*1e3*fy/1e6; // kNm
      const Mely=sec.Zx*1e3*fy/1e6, Melz=sec.Zy*1e3*fy/1e6;
      // 20 Sep 2026 accuracy: M_f,Rd = the resistance of ONE FLANGE bending about its own axis in the flange
      // plane (SCI P385 3.1.2 / 6.2, W_pl,f = t_f b^2/4, W_el,f = t_f b^2/6) for I/H AND channels; formerly
      // M_pl,z/2 for I/H, which carried half the web's minor-axis share (UB 457x191x82: 41.80 vs 40.255 kN.m,
      // MasterSeries prints 40.255) - affects P385 3.1.2, the (A.1) warping term and k_w by up to 4 %
      const Mplf=sec.B*sec.B*sec.tf/4*fy/1e6;               // one flange (plastic), kN.m
      const Melf=sec.B*sec.B*sec.tf/6*fy/1e6;               // one flange (elastic), kN.m
      const cls12=cl.cls<=2;
      // evaluate effects on each ULS combo's own coincident (My, phi, Mw) fields
      const SwChan=(chan&&sec.tp)? Math.max(sec.tp.Sw2||0,sec.tp.Sw3||0)*1e4 : 0;
      const MzImp=MzEd;                                       // 20 Sep 2026 torsion + N/Mz: imposed constant M_z,Ed (kN.m, S.Mz)
      let cross={u:-1}, grids=[], tauT=0, tauW=0, TtEnds=[0,0], TEnds=[0,0], BMaxAbs=0, BMaxPos=0, MwMaxAbs=0, MzMax=0, MzTotMax=0, phiUmax=0, MyAtCross=0;
      let vt={u:-1,x:0,V:0,T:0,tauT:0,tauW:0,VplTRd:VcRd,combo:'',zeroCapacity:false};
      O.sols.forEach(se=>{
        const g=se.sol, fb=se.fb;
        const rows=g.xs.map((x,i)=>{
          const My=Math.abs(interpAt(fb.xs,fb.M,x))/1e6;         // kNm
          const Vx=Math.abs(interpAt(fb.xs,fb.V,x))/1000;        // kN, coincident shear
          const phi=g.phi[i];
          const Mw=Math.abs(EIw*g.p2[i]/hh)/1e6;                 // kNm, per flange
          const Mz=Math.abs(phi*interpAt(fb.xs,fb.M,x)/1e6);     // kNm (phi*My), second-order minor-axis moment of the twist
          const MzTot=MzImp+Mz;                                  // 20 Sep 2026 torsion + N/Mz: M_z,tot = M_z,Ed + phi.M_y (P385 3.1.2 M_z term; = Mz when no M_z is imposed)
          const Tt=Math.abs(O.GIt*g.p1[i])/1e6;                  // kNm, coincident St Venant torque
          const tauTi=Tt*1e6*sec.tw/O.IT;                        // N/mm2
          const tauWi=SwChan? Math.abs(a.E*SwChan*g.p3[i]/sec.tw) : 0;
          const VplTRdi=chan
            ? Math.max(0,(Math.sqrt(Math.max(0,1-tauTi/(1.25*cshear)))-tauWi/cshear))*VcRd
            : Math.sqrt(Math.max(0,1-tauTi/(1.25*cshear)))*VcRd;
          const vu=shearTorsionUtil(VplTRdi,Vx);
          if(vu>vt.u) vt={u:vu,x,V:Vx,T:Tt,tauT:tauTi,tauW:tauWi,VplTRd:VplTRdi,combo:se.combo.label,zeroCapacity:VplTRdi<=1e-9&&Vx>1e-9};
          tauT=Math.max(tauT,tauTi);
          tauW=Math.max(tauW,tauWi);
          // P385 3.1.2 cross-section interaction, Class 1/2 plastic, Class 3 elastic; M_z term = M_z,tot
          const u=cls12? Math.pow(My/Mply,2)+Mw/Mplf+MzTot/Mplz
                        : My/Mely+MzTot/Melz+Mw/Melf;
          return {x,My,phi,Mw,Mz,MzImp,MzTot,u};
        });
        rows.forEach(r2=>{ if(r2.u>cross.u) cross={...r2,combo:se.combo.label};
          MwMaxAbs=Math.max(MwMaxAbs,r2.Mw); MzMax=Math.max(MzMax,r2.Mz); MzTotMax=Math.max(MzTotMax,r2.MzTot); phiUmax=Math.max(phiUmax,Math.abs(r2.phi)); });
        g.p2.forEach((v,i)=>{ const Bi=Math.abs(EIw*v)/1e9; if(Bi>BMaxAbs){ BMaxAbs=Bi; BMaxPos=g.xs[i]; } });   // bimoment B = EI_w phi'', kN.m2
        grids.push({combo:se.combo,rows});
        const n=g.xs.length;
        const Tt0=O.GIt*g.p1[0]/1e6, TtL=O.GIt*g.p1[n-1]/1e6;    // kNm, St Venant part at the ends
        if(Math.abs(Tt0)>Math.abs(TtEnds[0])) TtEnds[0]=Tt0;
        if(Math.abs(TtL)>Math.abs(TtEnds[1])) TtEnds[1]=TtL;
        // total torque T = G I_T phi' - E I_w phi''' at the ends (St Venant + warping parts)
        const T0=(O.GIt*g.p1[0]-EIw*g.p3[0])/1e6, TL=(O.GIt*g.p1[n-1]-EIw*g.p3[n-1])/1e6;
        if(Math.abs(T0)>Math.abs(TEnds[0])) TEnds[0]=T0;
        if(Math.abs(TL)>Math.abs(TEnds[1])) TEnds[1]=TL;
      });
      const VplTRd=vt.VplTRd;                                                          // coincident V-T sweep, Eq 6.26/6.27
      // Method A comparison (simplified flange couple - conservative)
      let MwA=0; { let Tud=0;
        (O.sols[0]? O.sols[0].sol.xs:[]);
        // rebuild from the governing-moment combo torque set magnitudes
      }
      // simplified Mw: point torques -> flange SS BM; ud/lin -> F L/8
      const gm=O.sols.find(se=>se.combo===a.governM.combo)||O.sols[0];
      // Method of the elastic warping analysis (19 Sep 2026 gap closure, G4):
      // 'closed' = P385 App C Cases 3/4/10, 'fe' = the warping-torsion FE of
      // js/checks/torsion-fe.js (torsion cantilevers, partial-span torque,
      // warping-fixed ends). The FE mesh is doubled once; PASS is refused when
      // the change exceeds the tool threshold TORSION_FE_MESH_BLOCK.
      const feMethod=O.method==='fe';
      if(feMethod && !O.converged) unsupported.push('Warping-torsion FE mesh has not converged: doubling the mesh ('+O.nElemCoarse+' to '+O.nElem+' elements) changed the peak twist / St Venant torque / bimoment by '+(O.meshError*100).toFixed(2)+' % (limit '+(O.meshBlock*100).toFixed(1)+' %). The torsion effects are printed but PASS is blocked; refine the load layout or report the case.');
      // 20 Sep 2026 torsion + N/Mz: elastic yield criterion (6.1) with N_Ed, M_y, M_z,tot, sigma_w,
      // tau_V, tau_t, tau_w at the four section points (cl 6.2.7(5); helper torsionElasticOpen above)
      const elastic=torsionElasticOpen(a,sec,fy,gM0,O,F,MzImp);
      if(elastic && !(elastic.geom.Wn0>0 && elastic.geom.Sw1>0)) unsupported.push('Torsion: the P385 warping table (W_n0, S_w1'+(chan? ', W_n2, S_w2, S_w3' : '')+') is not tabulated for this section, so the warping stresses of the elastic yield criterion (6.1) cannot be evaluated; PASS is blocked.');
      tor={box:false,p385:true,TEd:a.tors.Tmax,governT:a.tors.governT,tp:sec.tp||null,
        elastic,MzImp,MzTot:MzTotMax,MzTwistMax:MzMax,
        method:O.method||'closed',methodLabel:O.methodLabel||'SCI P385 App C closed forms (Cases 3/4/10)',fe:feMethod,
        nElem:O.nElem||null,nElemCoarse:O.nElemCoarse||null,meshError:feMethod? O.meshError:null,meshBlock:O.meshBlock||null,meshConverged:feMethod? !!O.converged:true,
        bcText:O.bcText||'',feReasons:O.feReasons||[],
        BMax:BMaxAbs,BMaxPos,TEnds,nSolves:(O.nSolves!=null? O.nSolves : null),nCached:(O.nCached!=null? O.nCached : null),
        e0:(sec.tp&&sec.tp.e0!=null)? sec.tp.e0 : (sec.e0!=null? sec.e0*10 : null),
        esc:(sec.tp&&sec.tp.esc!=null)? sec.tp.esc : null,
        aa:O.aa,X:O.X,IT:O.IT,Iw:O.Iw,chan,cls12,
        Mply,Mplz,Mplf,Mely,Melz,Melf,
        cross,grids,MwMax:MwMaxAbs,MzMax,phiUmax,
        TtEnds,tauT,tauW,VplTRd,vt,vtUtil:vt.u, vtZeroCapacity:!!vt.zeroCapacity,
        phiSer:O.sls? Math.abs(O.sls.phiMax):0, phiSerDeg:O.sls? Math.abs(O.sls.phiMax)*180/Math.PI:0,
        phiSerPos:O.sls? O.sls.phiPos/1000:0, governTw:O.sls? O.sls.combo.label:'',
        GIt:O.GIt};
    } else {
      unsupported.push("Torsion on this open section is NOT COVERED: "+((a.torsO&&a.torsO.reason)||"the P385 St Venant + warping analysis requires a warping constant")+".");
      tor={box:false,TEd:a.tors.Tmax,governT:a.tors.governT,tp:sec.tp||null,
        e0:(sec.tp&&sec.tp.e0!=null)? sec.tp.e0 : (sec.e0!=null? sec.e0*10 : null),
        esc:(sec.tp&&sec.tp.esc!=null)? sec.tp.esc : null};
    }
  }
  if(a.torsErr) unsupported.push("Eccentric loads are active but torsion cannot be evaluated: "+a.torsErr+".");
  // 20 Sep 2026 torsion + N/Mz: the former block "Combined torsion with direct axial force or
  // imposed minor-axis bending is not implemented as one interaction" is removed; the
  // verification is the (6.1) elastic check above, 6.61/6.62 with M_z,Ed = M_z + phi.M_y
  // (annexB2) and EN 1993-6 (A.1) with M_z,tot (unrestrained paths); the basis is printed
  // (torsionCombinedBasis, set per path once buck / annex are known - below and in the
  // unrestrained paths). 20 Sep 2026 review: the binding policy of (6.1) (elasticBindingPolicy).
  if(tor && (tor.p385 || tor.box)){
    tor.combinedActive=(Math.abs(F)>1e-9 || MzEd>1e-9);
    if(!tor.elastic) unsupported.push('Torsion: the elastic yield criterion (6.1) could not be evaluated (no coincident station data); PASS is blocked.');
    else { const pol=elasticBindingPolicy(sec,cl,F); tor.elastic.binding=pol.binding; tor.elastic.bindingBasis=pol.basis; }
  }
  // SLS twist guideline: SCI P385 suggests limiting the serviceability rotation
  // to about 2 degrees; flagged as a non-blocking advisory (guideline, not a
  // code limit) - matches common commercial-software practice.
  {
    const twistDeg = tor? (tor.p385? tor.phiSerDeg : (tor.box? tor.phiDeg : null)) : null;
    if(twistDeg!=null && twistDeg>2)
      advisory.push("Serviceability twist &theta;<sub>max</sub> = "+twistDeg.toFixed(1)+"&deg; exceeds the ~2&deg; guideline (SCI P385): check that the rotation is acceptable for whatever the member supports.");
  }
  // moment resistance, cl 6.2.5, with the cl 6.2.8 shear check at the point of maximum moment
  const Zx=sec.Zx*1e3, Sx=sec.Sx*1e3;
  const Wy = cl.cls<=2? Sx : Zx;
  let McRd=Wy*fy/gM0/1e6;                                     // kN.m
  const gfb=a.governM.fb;
  // kN, worst shear coincident with a combination's own maximum moment - swept
  // over EVERY enabled ULS combination, not just the governing-moment one (a
  // combo with a slightly lower Mmax can pair it with a much higher V there).
  const VatM=Math.max(...a.ulsResults.map(res=>Math.abs(interpAt(res.fb.xs,res.fb.V,res.Mpos))))/1000;
  const VplMoment=(tor&&tor.VplTRd!=null)? tor.VplTRd : VcRd;
  const halfVpl=0.5*VplMoment; // cl 6.2.8(4): use Vpl,T,Rd when torsion is present
  const lowShearAtM = VatM<=halfVpl+1e-9;
  let hsNote=null, mvForm=null, rhoAtM=null;
  if(!lowShearAtM){
    if(VatM>VplMoment+1e-9){
      hsNote="V<sub>Ed</sub> at the point of maximum moment exceeds V<sub>pl,Rd</sub>: the member has already failed the pure shear resistance check, so the cl 6.2.8 reduced moment formula is not valid";
    } else if(cl.cls<=3){
      // cl 6.2.8(3): (1 - rho) f_y on the shear area, every family and class
      // (shearReducedResistances): rolled I/H Eq 6.30 form, elastic I/H Class 3,
      // channel and hollow-section web moduli
      rhoAtM=Math.min(Math.pow(2*VatM/VplMoment-1,2),1);
      const R=shearReducedResistances(sec,cl,fy,Av,rhoAtM,gM0);
      McRd=Math.min(McRd,R.MvY); mvForm=R.form;
      hsNote="V<sub>Ed</sub> at the point of maximum moment exceeds 0.5V<sub>pl,Rd</sub>: moment resistance reduced per cl 6.2.8(3) with &rho;=(2V<sub>Ed</sub>/V<sub>pl,Rd</sub>&minus;1)&sup2; = "+g(rhoAtM,3)+", M<sub>v,Rd</sub> = "+R.form;
    }
  }
  const Mx=Math.abs(a.Mmax);
  const momUtil=McRd>0? Mx/McRd : 0;
  // ---- span-wise coexistent M-V (cl 6.2.8) and M-V-N / M-V-Mz (cl 6.2.10) sweep ----
  // Every station of every enabled ULS combination's own (V, M) fields (the
  // interaction is nonlinear, so the envelopes of V and M do not bound it).
  // Where V > 0.5 V_pl(,T),Rd: rho = (2V/V_pl - 1)^2 and the resistances of
  // shearReducedResistances() apply at that station - all families, Class 1-3:
  //   coex : M/M_v,Rd (6.2.8), worst station;
  //   mvn  : with N_Ed != 0 or M_z != 0 (6.2.10(3)): the 6.2.9 interaction
  //          re-evaluated with N_V,Rd, M_v,y,Rd, M_v,z,Rd and a_V -
  //          I/H and RHS Class 1/2: M_N,V,y,Rd = M_v,y,Rd (1 - n_V)/(1 - 0.5 a_V)
  //          <= M_v,y,Rd with the 6.2.9.1(4) waiver (N <= 0.25 N_V,Rd and N <=
  //          0.5 h_w t_w (1 - rho) f_y), M_N,V,z,Rd per 6.2.9.1(5) / Eq 6.40;
  //          uniaxial: M_y/M_N,V,y,Rd; biaxial: (M_y/M_N,V,y)^alpha + (M_z/M_N,V,z)^beta;
  //          Class 3 and channels: n_V + M_y/M_v,y,Rd + M_z/M_v,z,Rd (6.2.9.2 / 6.2.1(7)).
  // V > V_pl,Rd at a station is a pure shear failure (the reduced-moment forms
  // are not valid there) and is reported as such.
  let coex=null, mvn=null;
  if(cl.cls<=3){
    const VplB=(tor&&tor.VplTRd!=null)? tor.VplTRd : VcRd;
    const NEdAbs=Math.abs(F), hasN=NEdAbs>1e-9, hasMz=MzEd>1e-9;
    const hw62=sec.D-2*sec.tf;
    let worst={u:momUtil,x:a.Mpos*1000,red:false};
    let worstN={u:-1};
    a.ulsResults.forEach(res=>{ const cfb=res.fb;
    cfb.xs.forEach((x,i)=>{
      const Vx=Math.abs(cfb.V[i])/1e3, Mxx=Math.abs(cfb.M[i])/1e6;
      if(Mxx<1e-9 && !hasN && !hasMz) return;
      if(Vx>VplB+1e-9){
        const u=Vx/Math.max(VplB,1e-9);
        if(!worst.pureShearFail || Mxx>worst.M+1e-9 || (Math.abs(Mxx-worst.M)<=1e-9 && u>worst.u))
          worst={u,x,red:true,pureShearFail:true,V:Vx,M:Mxx,VplRd:VplB,MvRd:null,combo:res.combo.label};
        return;
      }
      if(!(Vx>0.5*VplB)) return;          // low shear: M/M_c,Rd <= momUtil already (M_c,Rd carries the peak-station reduction)
      const rho=Math.min(Math.pow(2*Vx/VplB-1,2),1);
      const R=shearReducedResistances(sec,cl,fy,Av,rho,gM0);
      const MvRd=Math.min(McRd,R.MvY);
      if(Mxx>1e-9){
        const u=Mxx/Math.max(MvRd,1e-9);
        if(!worst.pureShearFail && u>worst.u) worst={u,x,red:true,V:Vx,M:Mxx,MvRd,rho,form:R.form,combo:res.combo.label};
      }
      if(hasN||hasMz){
        const nV=NEdAbs/Math.max(R.NV,1e-9);
        let MNVy, MNVz, alpha=1, beta=1, form, waiver=false, aV=R.aV;
        if(cl.cls<=2 && sec.kind==='I'){
          MNVy=Math.max(0,Math.min(R.MvY*(1-nV)/(1-0.5*aV),R.MvY));
          if(NEdAbs<=0.25*R.NV && NEdAbs*1000<=0.5*hw62*sec.tw*(1-rho)*fy/gM0){ MNVy=R.MvY; waiver=true; }
          alpha=2; beta=Math.max(5*nV,1);
          MNVz= nV<=aV? R.MvZ : R.MvZ*(1-Math.pow((nV-aV)/(1-aV),2));
          form='plastic, 6.2.9.1 with (1 &minus; &rho;)f<sub>y</sub> on A<sub>v</sub>';
        } else if(cl.cls<=2 && sec.isBox){
          const afV=R.afV;
          MNVy=Math.max(0,Math.min(R.MvY*(1-nV)/(1-0.5*aV),R.MvY));
          MNVz=Math.max(0,Math.min(R.MvZ*(1-nV)/(1-0.5*afV),R.MvZ));
          alpha= nV<=0.8? 1.66/(1-1.13*nV*nV) : 6; beta=alpha;
          form='plastic, Eq 6.39/6.40 with (1 &minus; &rho;)f<sub>y</sub> on A<sub>v</sub>';
        } else {
          MNVy=R.MvY; MNVz=R.MvZ;
          form= sec.kind==='channel'? 'linear, cl 6.2.1(7) with N<sub>V,Rd</sub>, M<sub>v,y,Rd</sub>, M<sub>v,z,Rd</sub>' : 'elastic, cl 6.2.9.2 with N<sub>V,Rd</sub>, M<sub>v,y,Rd</sub>, M<sub>v,z,Rd</sub>';
        }
        let u;
        if(cl.cls<=2 && sec.kind!=='channel'){
          u= hasMz? Math.pow(Mxx/Math.max(MNVy,1e-9),alpha)+Math.pow(MzEd/Math.max(MNVz,1e-9),beta) : Mxx/Math.max(MNVy,1e-9);
        } else {
          u= nV + Mxx/Math.max(MNVy,1e-9) + (hasMz? MzEd/Math.max(MNVz,1e-9) : 0);
        }
        if(u>worstN.u) worstN={u,x,V:Vx,M:Mxx,Mz:MzEd,N:NEdAbs,rho,NV:R.NV,nV,MvY:R.MvY,MvZ:R.MvZ,MNVy,MNVz,alpha,beta,aV,afV:R.afV,waiver,form,formY:R.form,formZ:R.formZ,combo:res.combo.label,
          biax:hasMz,plastic:(cl.cls<=2 && sec.kind!=='channel')};
      }
    });
    });
    if(worst.red){
      coex=worst;
      if(!hsNote) hsNote=worst.pureShearFail
        ? "Coexistent shear and moment (cl 6.2.8): at x = "+(worst.x/1000).toFixed(2)+" m, V<sub>Ed</sub> = "+worst.V.toFixed(0)+" kN exceeds V<sub>pl,Rd</sub> = "+worst.VplRd.toFixed(0)+" kN, so pure shear failure governs and the reduced M<sub>v,Rd</sub> formula is not valid"
        : "Coexistent shear and moment (cl 6.2.8): at x = "+(worst.x/1000).toFixed(2)+" m, V<sub>Ed</sub> = "+worst.V.toFixed(0)+" kN &gt; 0.5V<sub>pl,Rd</sub> and the reduced M<sub>v,Rd</sub> = "+worst.MvRd.toFixed(0)+" kN&middot;m governs";
    }
    if(worstN.u>=0 && !(coex&&coex.pureShearFail)) mvn=worstN;
  }
  // vertical deflection (NA 2.23) - governing enabled SLS combination and segment;
  // the limit is the segment's own (span/divisor, L/divisorCant for a cantilever
  // segment, capped by the optional absolute limit) as set by analyse()
  const span=a.deflection?a.deflection.span:a.L;
  const divisor=(a.deflection&&a.deflection.divisor!=null)? a.deflection.divisor : S.divisor;
  const dlimit=(a.deflection&&a.deflection.limit!=null)? a.deflection.limit : span/divisor;
  const dmax=Math.abs(a.deflection?a.deflection.dmax:a.dmax), defOk=dmax<=dlimit;
  const deflCant=!!(a.deflection&&a.deflection.cant), deflAbsGoverns=!!(a.deflection&&a.deflection.absGoverns);
  // uplift / hold-down at every support, every combination (EN 1990 2.4.4)
  const holdDown=holdDownCheck(a);
  holdDown.unsupported.forEach(m=>unsupported.push(m));
  holdDown.advisory.forEach(m=>advisory.push(m));
  if(a.stability&&a.stability.notes) a.stability.notes.forEach(m=>advisory.push(m));
  if(a.companionNote) advisory.push(a.companionNote);
  const isCantR=isCantilever(S);
  const buck=(ax && !ax.tension)? annexB2(a,sec,fy,cl,McRd,true,isCantR,aeff) : null; // fully restrained: not susceptible -> Table B.1; MbRd = Mc,Rd
  if(buck && buck.tfb && !buck.tfb.ok) unsupported.push('PFC under axial compression: '+buck.tfb.reason+'; torsional / torsional-flexural buckling (cl 6.3.1.4) cannot be verified, PASS is blocked.');
  const utils=[
    {name:"Shear  V_Ed/V_c,Rd",val:shearUtil},
    {name:"Bending  M_Ed/M_c,Rd",val:momUtil},
    {name:"Deflection",val:dmax/dlimit},
  ];
  if(ax){
    utils.push({name: ax.tension? "Tension  N_Ed/N_t,Rd" : (ax.aeff&&ax.aeff.active? "Compression  N_Ed/N_c,Rd (A_eff)" : "Compression  N_Ed/N_pl,Rd"), val:ax.nUtil});
    utils.push({name: ax.biax? ("Biaxial bending"+(Math.abs(F)>1e-9?" + axial":"")+" (6.2.9.1)") : "Bending+axial cross-section (6.2.9)",val:ax.mUtil});
    if(!ax.tension && buck && buck.Fc>1e-9){   // cl 6.3.3 applies only with axial compression
      if(buck.tfb && buck.tfb.ok) utils.push({name:TFB_UTIL_NAME,val:buck.tfb.util});
      utils.push({name:"Member buckling y-y (Eq 6.61)",val:buck.u1});
      utils.push({name:"Member buckling z-z (Eq 6.62)",val:buck.u2});
    }
  }
  if(coex) utils.push({name:coex.pureShearFail? "Pure shear failure at M-V check point (6.2.6)" : "Bending+shear coexistent (6.2.8)",val:coex.u});
  if(mvn) utils.push({name:mvnUtilName(mvn),val:mvn.u});
  if(web&&web.checked){
    utils.push({name:WEB_UTIL_NAMES[0],val:web.util2});
    utils.push({name:WEB_UTIL_NAMES[1],val:web.util72});
  }
  if(tor&&tor.box){
    utils.push({name:"Torsion  T_Ed/T_Rd",val:tor.torUtil});
    utils.push({name:"Shear+torsion  V_Ed/V_pl,T,Rd",val:tor.vtUtil});
  }
  if(tor&&tor.p385){
    utils.push({name:"Bending+torsion cross-section (P385 3.1.2)",val:tor.cross.u});
    utils.push({name:"Shear+torsion  V_Ed/V_pl,T,Rd",val:tor.vtUtil});
  }
  // 20 Sep 2026 torsion + N/Mz: elastic yield criterion (6.1), cl 6.2.7(5), computed in every torsion case;
  // 20 Sep 2026 review: verdict-binding (utils) only where the code gives no plastic route (Class 3, or an
  // open Class 1/2 section with N_Ed - elasticBindingPolicy), otherwise information (c.info; an advisory
  // when it exceeds 1 - 6.2.7(5) is permissive and 6.2.7(6) admits the plastic route)
  const info=[];
  if(tor&&tor.elastic){
    if(tor.elastic.binding) utils.push({name:ELASTIC_TORSION_UTIL_NAME,val:tor.elastic.u});
    else {
      info.push({name:ELASTIC_TORSION_UTIL_NAME,val:tor.elastic.u,note:tor.elastic.bindingBasis});
      if(tor.elastic.u>1.0001) advisory.push('ADVISORY - elastic yield criterion (6.1) with torsion, cl 6.2.7(5) = '+tor.elastic.u.toFixed(3)+' at x = '+(tor.elastic.x/1000).toFixed(2)+' m ('+tor.elastic.point+'): first yield is reached under the design actions (information only, not a utilisation: '+tor.elastic.bindingBasis+').');
    }
  }
  // 20 Sep 2026 torsion + N/Mz: advisory superposition of Eq 6.62 and (A.1) (fully restrained: k_alpha = 1);
  // the unrestrained paths recompute it with their own k_alpha and print their own text
  if(tor&&tor.p385){ tor.superposition=torsionSuperposition(tor,null,buck); if(tor.superposition && (S.restraint||'full')==='full') advisory.push(tor.superposition.text); }
  // 20 Sep 2026 review: the basis text of this (fully restrained) path; the unrestrained paths overwrite it with theirs
  if(tor&&(tor.p385||tor.box)) tor.combinedBasis=torsionCombinedBasis({box:!!tor.box,tension:!!(ax&&ax.tension),hasN:Math.abs(F)>1e-9,hasMz:MzEd>1e-9,restrained:true,buckEvaluated:!!(buck&&buck.Fc>1e-9),annexEvaluated:false,binding:!!(tor.elastic&&tor.elastic.binding)});
  let gov=utils[0]; utils.forEach(u=>{ if(u.val>gov.val) gov=u; });
  const pass=unsupported.length===0 && utils.every(u=>u.val<=1.0001);
  return {sci:true,tor,coex,mvn,web,ax,aeff,buck,eps,cl,clsName,unsupported,advisory,info,fy,eta,hw,cOut,Av,AvRaw,avFloor,VcRd,Fv,shearUtil,
    sbRatio,sbLimit,sbOk,Zx,Sx,Wy,McRd,hsNote,mvForm,rhoAtM,VatM,halfVpl,lowShearAtM,Mx,momUtil,F,
    span,divisor,dlimit,dmax,defOk,deflCant,deflAbsGoverns,holdDown,restraintForces:null,utils,gov,pass};
}

/* ===========================================================================
   STANDARD (closed-form) Mcr METHOD  -  S.mcrMethod === 'standard'
   ---------------------------------------------------------------------------
   Everything from here to the end of checksEC3UnrestrainedSCI() is the
   standard-method implementation: C1 from the NCCI SN003a tables / SCI
   end-moment curve / Serna quarter-point expression, the SN003a closed-form
   Mcr with the C2*zg load-height term where C2 is published, the SN006a
   cantilever C factors (sn006C in 01-computation-engine.js), and the P385/P362
   channel kappa chain. This is how MasterSeries-type software derives Mcr.
   js/08-mcr-eigen-patch.js keeps this function alive as
   window.checksEC3UnrestrainedStandard and delegates to it when the user
   selects the standard method; it is NOT dead code. The helpers it depends on
   (C1_END_MOMENT, SN006/sn006C, sernaC1, c1FromPsi, computeC1, mcrEC3,
   cmTableB3, annexB2) must stay in place.
   =========================================================================== */

// ---- Moment ordinate at an interior station of a diagram with jumps ----
// An applied in-span couple makes M(x) discontinuous. A quarter-point or
// mid-span sample that lands exactly on the jump must take the larger of the
// two side ordinates: the closed-form C1 expressions (Serna quarter points,
// the MasterSeries M_o) describe the envelope of the diagram, and the far-side
// value overstates C1 (19 Sep 2026 verification campaign, UB-27: C1 1.68 ->
// 1.21, the standard M_cr was 20 % above the eigenvalue). The diagram grid
// carries x - 1e-4, x, x + 1e-4 at a jump, so 1e-3 mm either side reaches
// both sides while a smooth diagram is unchanged to 1e-6. Clamped to the
// segment. Pure.
function mAtStation(fb,x,xa,xb){
  const d=1e-3;
  const l=interpAt(fb.xs,fb.M,Math.max(x-d,xa)), r=interpAt(fb.xs,fb.M,Math.min(x+d,xb));
  return Math.abs(l)>=Math.abs(r)? l : r;
}
// ---- C1 inputs in the MasterSeries convention (pure) ----
// fb = {xs (mm), M (N.mm)} of one combination's BMD (sagging positive);
// xa, xb = the segment ends (mm). Returns kN.m:
//   M1, M2 = the end moments of the segment, M2 the larger in magnitude;
//   Mo     = mid-segment moment above the chord joining M1 and M2 (the free
//            bending moment from the loads inside the segment);
//   psi    = M1/M2 (clamped to [-1, 1]);
//   mu     = Mo/M2, capped at +/-300 (MasterSeries prints 300.000 when M2 ~ 0).
// End moments are read a fraction inside the segment so that a point moment or
// a support reaction exactly at the end does not pick the wrong side of the jump.
function c1Inputs(fb,xa,xb){
  const Ma=interpAt(fb.xs,fb.M,xa+1e-4)/1e6, Mb=interpAt(fb.xs,fb.M,xb-1e-4)/1e6;
  const Mmid=mAtStation(fb,(xa+xb)/2,xa,xb)/1e6;
  let [M1,M2]= Math.abs(Mb)>=Math.abs(Ma)? [Ma,Mb] : [Mb,Ma];
  const Mo=Mmid-(Ma+Mb)/2;
  // end moments that are numerical noise next to the in-span moment (a pinned
  // end) are reported as zero, so psi and mu are deterministic
  const scale=Math.max(Math.abs(M1),Math.abs(M2),Math.abs(Mo),1e-9);
  if(Math.abs(M2)<=1e-6*scale){ M1=0; M2=0; }
  else if(Math.abs(M1)<=1e-6*scale) M1=0;
  const eps=1e-9;
  const psi= Math.abs(M2)>eps? Math.max(-1,Math.min(1,M1/M2)) : 1;
  let mu= Math.abs(M2)>eps? Mo/M2 : (Math.abs(Mo)>eps? 300*Math.sign(Mo) : 0);
  mu=Math.max(-300,Math.min(300,mu));
  return {M1,M2,Mo,psi,mu,xa,xb};
}
// ---- Governing segment for the C1 inputs ----
// Whole member for a span without intermediate lateral restraints or a
// cantilever. With intermediate restraints: the bay between adjacent
// lateral-restraint points (ends holding U_y and v-restraints) that contains
// the governing combination's peak moment. Returns {xa, xb, whole} in mm.
function c1Segment(a){
  const L=a.L;
  const isCant=isCantilever(S);
  const pts=[...new Set(endsList().filter(e=>e.uy).map(e=>+((e.x*1000).toFixed(3)))
    .concat((S.ltbRestraints||[]).filter(r=>r.v!==false).map(r=>+(((+r.pos)*1000).toFixed(3))))
    .filter(x=>isFinite(x)&&x>=-1e-6&&x<=L+1e-6))].sort((p,q)=>p-q);
  if(isCant || pts.length<3) return {xa:0,xb:L,whole:true};
  const xm=a.Mpos*1000;
  for(let i=0;i<pts.length-1;i++) if(xm>=pts[i]-1e-6 && xm<=pts[i+1]+1e-6) return {xa:pts[i],xb:pts[i+1],whole:false};
  if(xm<pts[0]) return {xa:0,xb:pts[0],whole:false};
  return {xa:pts[pts.length-1],xb:L,whole:false};
}
// ---- LTB buckling curve, UK NA Table NA.1 (cl 6.3.2.3), shared by both Mcr methods ----
// Rolled doubly symmetric I/H sections and hot-finished hollow sections:
// h/b <= 2 -> b, 2 < h/b <= 3.1 -> c, h/b > 3.1 -> d. Cold-formed hollow
// sections (with welded sections): h/b <= 2 -> c, otherwise d. Channels (not
// doubly symmetric, "all other hot-rolled sections") -> d.
function ltbCurveNA(sec){
  if(sec.isBox && sec.boxType==='CF') return sec.D/sec.B<=2? {alphaLT:0.49,curve:'c'} : {alphaLT:0.76,curve:'d'};
  if(sec.kind==='channel') return {alphaLT:0.76,curve:'d'};
  const hb=sec.D/sec.B;
  return hb<=2? {alphaLT:0.34,curve:'b'} : hb<=3.1? {alphaLT:0.49,curve:'c'} : {alphaLT:0.76,curve:'d'};
}
// ---- SN003a closed-form Mcr (pure), N.mm ----
// Doubly symmetric section, k = kw = 1, G = 81000 N/mm2 (SN003a / P385):
// Mcr = C1 (pi^2 E Iz/LE^2) { sqrt[ Iw/Iz + LE^2 G It/(pi^2 E Iz) + (C2 zg)^2 ] - C2 zg }
// The C2 zg term is applied only when zg is non-zero AND C2 is published for
// the recognised diagram (C2 = null otherwise). Hollow sections have Iw = 0.
function mcrClosedForm(sec,E,LE,C1,C2,zg){
  const G=81000, Iz=sec.Iy*1e4, It=sec.J*1e4, Iw=(sec.Iw||0)*1e12;
  const T1=Math.PI*Math.PI*E*Iz/(LE*LE);          // N
  const IwIz=Iw/Iz;                                // mm2
  const GIt=G*It;                                  // N.mm2
  const zgUsed=(Math.abs(zg||0)>1e-9 && C2!=null && C2>0);
  const zgTerm=zgUsed? C2*zg : 0;
  const Mcr=C1*T1*(Math.sqrt(Math.max(IwIz+GIt/T1+zgTerm*zgTerm,0))-zgTerm);
  return {Mcr,T1,IwIz,GIt,zgUsed,zgTerm};
}
// ---- Load height for the closed-form route (pure, reads S) ----
// The SN003a form takes ONE z_g for the whole diagram. It is the most
// destabilising signed height among the transverse loads that are active in
// the combination `factors`: each load's own z_g from loadZgValue() (the
// per-load value when eccOn is on, else the default S.za), positive above
// the shear centre for a DOWNWARD load. A load acting upward at +z_g is
// stabilising, so its height enters with the sign reversed. Automatic
// self-weight (centroid, z_g = 0) and moment loads carry no load height.
// Falls back to S.za when no transverse load is active in the combination.
// `combo` is a combination object ({factors, mask?}) or a bare factors object;
// pattern combinations see only the loads their mask keeps (comboLoadPieces).
// Returns {zg (mm), source: 'loads' | 'default'}.
function asCombo(combo){ return (combo && combo.factors)? combo : {factors:combo||{}}; }
function stdZgFor(combo){
  let best=null;
  comboLoadPieces(asCombo(combo)).forEach(p=>{
    if(p.type==='moment') return;
    const f=p.factor; if(!f) return;
    const mag= p.type==='point'? p.P : (p.w1+p.w2)/2;
    if(Math.abs(mag)<1e-12) return;
    const z0=(typeof loadZgValue==='function')? loadZgValue(p.ld) : (+S.za||0);
    const zg=(mag*f<0)? -z0 : z0;
    if(best==null||zg>best) best=zg;
  });
  return best==null? {zg:(+S.za||0), source:'default'} : {zg:best, source:'loads'};
}
// ---- Transverse-load shape of one combination (pure, reads S) ----
// Counts the loads with a non-zero factor (self-weight excluded, it is always
// a full-span UDL): full-span UDLs (trap with w1 = w2 counts), point loads
// (and how many of them sit at mid-span, +/-1% of L), any other transverse
// load, and applied moments. The SN003a Table 3.2 rows are recognised from
// these counts, not from the quarter-point moment ratio alone.
function stdLoadShape(combo){
  const L=(+S.L)*1000;
  let nUdl=0,nPoint=0,nCentral=0,nOther=0,nMoment=0;
  comboLoadPieces(asCombo(combo)).forEach(p=>{
    const f=p.factor; if(!f) return;
    if(p.type==='moment'){ if(Math.abs(p.M)>1e-12) nMoment++; return; }
    if(p.type==='point'){
      if(Math.abs(p.P)<1e-12) return;
      nPoint++; if(Math.abs(p.pos-L/2)<=0.01*L) nCentral++; return;
    }
    const w1=p.w1, w2=p.w2;
    if(Math.abs(w1)<1e-12&&Math.abs(w2)<1e-12) return;
    const full=p.x1<=1e-3 && Math.abs(p.x2-L)<=1e-3 && Math.abs(w1-w2)<=1e-9*Math.max(Math.abs(w1),1);
    if(full) nUdl++; else nOther++;
  });
  return {nUdl,nPoint,nCentral,nOther,nMoment,
    notLoaded: nUdl+nPoint+nOther===0,                                   // only applied moments (and self-weight)
    uniform: nMoment===0 && nUdl>0 && nPoint===0 && nOther===0,           // full-span UDL family only
    central: nMoment===0 && nPoint>0 && nCentral===nPoint && nUdl===0 && nOther===0}; // central point load(s) only
}
// ---- Status of the entered load height on the closed-form route (pure, reads S.destab) ----
// Returns {text (HTML, always printed), block (HTML or null: blocks PASS),
// advisory (HTML or null)}. The SN003a C2 z_g term exists only for the four
// Table 3.2 rows; a destabilising height on any other diagram cannot be
// included by the closed form, and silently taking the load at the shear
// centre would be unconservative, so PASS is blocked unless the user has
// chosen the destabilising L_E = 1.2 L treatment (BS 5950 practice) instead.
function stdZgStatus(zg,C2,zgUsed){
  zg=+zg||0;
  const zs=(zg>0?'+':'')+zg.toFixed(0)+' mm';
  if(Math.abs(zg)<1e-9) return {text:'z<sub>g</sub> = 0 (load through the shear centre)', block:null, advisory:null};
  if(zgUsed){
    return {text:'z<sub>g</sub> = '+zs+' above the shear centre, C<sub>2</sub> = '+(+C2).toFixed(3)+' (SN003a Table 3.2)'+(S.destab? '; the destabilising &times;1.2 L<sub>E</sub> switch is also on' : ''),
      block:null,
      advisory: S.destab? 'Standard (closed-form) M<sub>cr</sub>: the destabilising &times;1.2 L<sub>E</sub> switch AND the SN003a C<sub>2</sub>z<sub>g</sub> load-height term are both applied. They describe the same effect, so the load height is counted twice (conservative). Untick the switch or set z<sub>g</sub> = 0 to apply one treatment only.' : null};
  }
  if(zg>0 && S.destab) return {text:'z<sub>g</sub> = '+zs+' entered &mdash; NOT applied in M<sub>cr</sub> (C<sub>2</sub> not published for this moment diagram); the load height is carried by the destabilising L<sub>E</sub> = 1.2&times;L<sub>E</sub>-factor&times;L only (BS 5950 practice)',
    block:null,
    advisory:'Standard (closed-form) M<sub>cr</sub>: z<sub>g</sub> = '+zs+' (destabilising) is entered but SN003a publishes C<sub>2</sub> only for the simply supported and fixed-ended full-span UDL and central point-load diagrams. The C<sub>2</sub>z<sub>g</sub> term is therefore NOT applied; the load height is represented by the destabilising L<sub>E</sub> = 1.2&times;L<sub>E</sub>-factor&times;L switch only. Use the FE eigenvalue method for the exact load-height effect.'};
  if(zg>0) return {text:'z<sub>g</sub> = '+zs+' entered &mdash; NOT applied: C<sub>2</sub> not published for this moment diagram; M<sub>cr</sub> is at the shear centre (PASS blocked)',
    block:'Standard (closed-form) M<sub>cr</sub>: a destabilising load height z<sub>g</sub> = '+zs+' is entered, but SN003a publishes C<sub>2</sub> only for the simply supported and fixed-ended full-span UDL and central point-load diagrams (Table 3.2). The closed form cannot include the load height for this moment diagram, so the printed M<sub>cr</sub> is computed with the load at the shear centre (unconservative). Use the FE eigenvalue M<sub>cr</sub> method, a verified M<sub>cr</sub>, or the destabilising L<sub>E</sub> switch (BS 5950 practice); PASS is blocked.',
    advisory:null};
  return {text:'z<sub>g</sub> = '+zs+' (below the shear centre, stabilising) &mdash; not applied: C<sub>2</sub> not published for this moment diagram; M<sub>cr</sub> is taken with the load at the shear centre (conservative)', block:null, advisory:null};
}
function sn003aC1(a,isCant,seg,diag){
  // C1 for the Mcr calculation (SN003a Table 3.1/3.2) and 1/sqrt(C1) for the
  // P362 Eq 6.55 simplified slenderness / NA 2.18 kc factor.
  // `seg` = {xa, xb} (mm) evaluates the diagram over that segment; omitted =
  // the whole member, using the analysis quantities exactly as before.
  // `diag` = {fb, factors}: the moment diagram the C1 describes and the load
  // factors of the combination that produced it (used for the load-list shape
  // recognition); omitted = the governing-moment combination a.governM.
  // Returns {C1, C2, label, route, c1in}; route is one of 'override',
  // 'cantilever', 'negligible', 'end-moment', 'uniform', 'point',
  // 'fixed-uniform', 'fixed-point', 'serna'.
  const fbM=(diag&&diag.fb)||a.governM.fb;
  const fac=(diag&&diag.combo)||((diag&&diag.factors)? {factors:diag.factors} : a.governM.combo);   // combination (pattern-aware)
  const xa=seg? seg.xa : 0, xb=seg? seg.xb : a.L, Ls=xb-xa;
  const c1in=c1Inputs(fbM,xa,xb);
  if(S.C1o!=null) return {C1:S.C1o, C2:null, label:'user override', route:'override', c1in};
  if(isCant) return {C1:1.0, C2:null, label:'cantilever', route:'cantilever', c1in};
  const Mat=x=>interpAt(fbM.xs,fbM.M,x)/1e6;
  const Mst=x=>mAtStation(fbM,x,xa,xb)/1e6;   // interior stations: larger side of a jump (in-span couple)
  // peak, end (read a fraction inside the segment) and quarter-point moments of
  // the segment; for the whole member these equal the analysis quantities
  let Mm=0; fbM.xs.forEach((x,i)=>{ if(x>=xa-1e-6&&x<=xb+1e-6) Mm=Math.max(Mm,Math.abs(fbM.M[i])/1e6); });
  const M0=Mat(xa+1e-4), ML=Mat(xb-1e-4), Mq=Mst(xa+Ls/4), Mq3=Mst(xa+3*Ls/4);
  if(Mm<1e-9) return {C1:1.0, C2:0, label:'negligible moment', route:'negligible', c1in};
  const endLevel=Math.max(Math.abs(M0),Math.abs(ML))/Mm;
  const shape=stdLoadShape(fac);
  // The end-moment curve ("Not Loaded") applies when the combination carries
  // no transverse load other than self-weight (decided from the load list, so
  // a light section's factored self-weight curvature does not disqualify it)
  // or when the diagram IS a straight line between the segment ends (every
  // grid value within 5% of Mmax of the chord); in both cases the larger end
  // moment must be the peak of the segment.
  const isLinear=fbM.xs.every((x,i)=> x<xa+1e-4 || x>xb-1e-4 || Math.abs(fbM.M[i]/1e6-(M0+(ML-M0)*(x-xa)/Ls))<=0.05*Mm);
  if(endLevel>0.98 && (shape.notLoaded || isLinear)){
    // psi = smaller end moment / larger end moment (SN003a Table 3.1 convention;
    // MasterSeries psi = M1/M2), so a larger moment at x = L does not clamp to 1.
    const psi=c1in.psi;
    const c=Math.pow(1.33-0.33*psi,2); // SCI curve C1=(1.33-0.33psi)^2 = 1.77-0.88psi+0.11psi^2 (NA kc inverted)
    return {C1:c, C2:0, label:'linear end-moment gradient, &psi; = '+psi.toFixed(2)+' (SCI curve, NA 2.18)'+(shape.notLoaded? '; not loaded' : ''), route:'end-moment', c1in};
  }
  // The four tabulated transverse-load shapes (SN003a Table 3.2, k = kw = 1)
  // are recognised from the LOAD LIST of the combination (full-span UDL family
  // only, or central point load(s) only, no applied moments) on the whole
  // member with a vertical support (U_z) at each end and no hinge inside it:
  // simply supported ends (R_y free) with no significant end moment, or both
  // ends fixed (U_z + R_y). The quarter-point/mid-span ratio of the diagram
  // is kept as a guard (the point-load row tolerates a self-weight moment
  // share of about 9%).
  const [eA,eB]=endsList();
  const endSupported=!!(eA.uz&&eB.uz);
  const endFixed=!!(eA.uz&&eB.uz&&eA.ry&&eB.ry);
  const interiorBreak=(S.hinges||[]).some(h=>(+h.pos)*1000>xa+1e-6&&(+h.pos)*1000<xb-1e-6);
  const whole=(!seg)||(seg.xa<=1e-6&&Math.abs(seg.xb-a.L)<=1e-6);
  const r=(Math.abs(Mq)+Math.abs(Mq3))/(2*Mm);
  if(whole && endSupported && !interiorBreak){
    if(!endFixed && endLevel<0.02){
      if(shape.uniform && Math.abs(r-0.75)<=0.02) return {C1:1.127, C2:0.454, label:'simply supported + uniformly distributed load (SN003a Table 3.2)', route:'uniform', c1in};
      if(shape.central && Math.abs(r-0.50)<=0.02) return {C1:1.348, C2:0.630, label:'simply supported + central point load (SN003a Table 3.2)', route:'point', c1in};
    }
    if(endFixed){
      if(shape.uniform) return {C1:2.578, C2:1.554, label:'fixed-ended + uniformly distributed load (SN003a Table 3.2)', route:'fixed-uniform', c1in};
      if(shape.central) return {C1:1.683, C2:1.645, label:'fixed-ended + central point load (SN003a Table 3.2)', route:'fixed-point', c1in};
    }
  }
  { // general diagram: Serna et al. quarter-point expression (SCI, NSC Nov 2013)
    const M2=Mst(xa+Ls/4), M3=Mst(xa+Ls/2), M4=Mst(xa+3*Ls/4);
    const c=sernaC1(Math.max(Mm,1e-9),M2,M3,M4);
    return {C1:c, C2:null, label:'general moment diagram &mdash; Serna et al. quarter-point expression (SCI): M(L/4)='+M2.toFixed(1)+', M(L/2)='+M3.toFixed(1)+', M(3L/4)='+M4.toFixed(1)+', M<sub>max</sub>='+Mm.toFixed(1)+' kN&middot;m', route:'serna', c1in};
  }
}
// ---- NCCI SN006a-EN-EU cantilever Mcr (doubly symmetric I/H), pure ----
// Mcr = C * Mcr0, Mcr0 = (pi/L) sqrt(E Iz G It); C from Tables 3.1-3.3 via
// sn006C() with kwt and eta; q + F combined by Eq (7). The SN006a boundary
// conditions replace the effective-length machinery (LE factor and the
// destabilising switch are NOT applied; load height enters through eta,
// warping through the root condition). `factors` = the combination's load
// factors (default a.governM), `zg` = the load height in mm for eta (default
// stdZgFor(factors)). Returns Mcr = null with `reason` (HTML) when the loading
// or the table range is not covered.
function mcrSN006aFor(a,sec,factors,zg){
  const E=a.E, G=81000, Iz=sec.Iy*1e4, It=sec.J*1e4, Iw=(sec.Iw||0)*1e12;
  const Lc=a.L;
  const Mcr0=Math.PI/Lc*Math.sqrt(E*Iz*G*It);        // N.mm
  const kwt=Math.sqrt(E*Iw/(G*It))/Lc;
  const hs=sec.D-sec.tf;
  const gcb=asCombo(factors||a.governM.combo), gfac=gcb.factors;
  const za=(zg!=null)? +zg : stdZgFor(gcb).zg;
  const eta=za/(hs/2);
  const warp=(endsList()[0].warp)?'restr':'free';   // root warping condition = End 1 warping flag
  // classify tip loading from the loads (2% de-minimis on the support moment)
  let Mq=0,MF=0,Mm2=0,nF2=0,nM2=0,other=false;
  const Lmm=S.L*1000;
  comboLoadPieces(gcb).forEach(p=>{
    const f=p.factor; if(!f) return; // zero-factor loads do not shape this combination
    if(p.type==='udl'&&p.x1<=1e-3&&Math.abs(p.x2-Lmm)<=1e-3) Mq+=p.w1*f*S.L*S.L/2;
    else if(p.type==='point'&&Math.abs(p.pos-Lmm)<=0.02*Lmm){ MF+=p.P*f*S.L; nF2++; }
    else if(p.type==='moment'&&Math.abs(p.pos-Lmm)<=0.02*Lmm){ Mm2+=Math.abs(p.M)*f; nM2++; }
    else other=true;
  });
  Mq+=(a.swPerM||0)*(gfac.G??0)*S.L*S.L/2;
  const tot=Math.abs(Mq)+Math.abs(MF)+Mm2;
  const dm=0.02*Math.max(tot,1e-9);
  const hasQ=Math.abs(Mq)>dm, hasF=Math.abs(MF)>dm, hasM=Mm2>dm;
  let C=null,Cq=null,CF=null,caseLbl='';
  if(other||hasM&&(hasQ||hasF)||nM2>1){ C=null; caseLbl='loading outside SN006a Tables 3.1-3.3'; }
  else if(hasM&&!hasQ&&!hasF){ C=sn006C('M',warp,kwt,0); caseLbl='external moment at the free end (Table 3.3)'; }
  else if(hasQ&&hasF){ Cq=sn006C('q',warp,kwt,eta); CF=sn006C('F',warp,kwt,eta);
    if(Cq!=null&&CF!=null) C=(Math.abs(Mq)+Math.abs(MF))/(Math.abs(Mq)/Cq+Math.abs(MF)/CF);
    caseLbl='uniform load + tip point load, interaction Eq (7)'; }
  else if(hasQ){ C=sn006C('q',warp,kwt,eta); caseLbl='uniformly distributed load (Table 3.1)'; }
  else if(hasF){ C=sn006C('F',warp,kwt,eta); caseLbl='point load at the free end (Table 3.2)'; }
  else { C=sn006C('q',warp,kwt,eta); caseLbl='self-weight only (Table 3.1)'; }
  let reason=null;
  if(C==null){
    if(kwt>1) reason="Cantilever LTB: &kappa;<sub>wt</sub> = "+kwt.toFixed(2)+" exceeds the SN006a table range (0&ndash;1); use a longer cantilever, a torsionally stiffer section, or a specialist tool (LTBeam).";
    else if(Math.abs(eta)>0&&(eta<-2||eta>3)) reason="Cantilever LTB: load-height parameter &eta; = "+eta.toFixed(2)+" is outside the SN006a table range (&minus;2 to +3).";
    else reason="Cantilever LTB: "+caseLbl+" &mdash; not covered by SN006a; PASS is blocked (conservative C1=1.0 route removed in favour of the published method).";
  }
  return {Mcr0,kwt,hs,eta,za,warp,caseLbl,C,Cq,CF,Mq,MF,Mcr:(C==null? null : C*Mcr0),reason};
}
// ---- End conditions the closed-form Mcr chain can describe (pure, reads S.ends) ----
// The SN003a form (and the channel kappa chain and the box chain with I_w = 0)
// takes k = k_w = 1: FORK ends - U_y (lateral translation) and R_x (twist)
// held - at BOTH ends. NCCI SN006a describes the cantilever of
// isSn006aCantilever() (root U_y + R_z + R_x, free tip), doubly symmetric
// I/H only. A square hollow section is not susceptible to LTB whatever its
// ends (cl 6.3.2.1(2)). Every other end flag set is refused on the standard
// route (19 Sep 2026 review finding F-C: an end releasing R_x or U_y was
// given the fork-fork closed form, 0.41-0.68 of the eigenvalue), the printed
// chain still assuming fork ends; the FE eigen route models the flags.
// Laterally clamped (R_z) and warping-fixed ends raise M_cr; taking them as
// forks is conservative and is stated (the SN003a k = 0.5 rows are not
// applied). Returns {ok, sn006, msg (HTML, blocking when !ok), note (HTML,
// advisory), ends (HTML list of the released DOFs)}.
function stdMcrEndsStatus(st,sec){
  st=st||S;
  const ends=endsList(st);
  const sym={uy:'U<sub>y</sub>',rx:'R<sub>x</sub>',rz:'R<sub>z</sub>',warp:'warping'};
  const releases=e=>['uy','rx'].filter(k=>!e[k]).map(k=>sym[k]);
  const holds=e=>['uy','rx','rz','warp'].filter(k=>e[k]).map(k=>sym[k]);
  const cant=isCantilever(st);
  const useMcr='Use the FE eigenvalue M<sub>cr</sub> method (Axial &amp; lateral-torsional buckling), which models the end degrees of freedom; PASS is blocked on the standard route.';
  if(cant && sec && sec.kind==='I'){
    if(isSn006aCantilever(st)) return {ok:true, sn006:true, msg:null, note:null, ends:''};
    const [e1,e2]=ends;
    const rootTxt=releases(e1).length? 'End 1 (root) releases '+releases(e1).join(', ')+(e1.rz? '' : (releases(e1).length? ' and ' : 'releases ')+sym.rz) : (e1.rz? '' : 'End 1 (root) releases '+sym.rz);
    const tipTxt=holds(e2).length? 'End 2 (tip) restrains '+holds(e2).join(', ') : '';
    const desc=[rootTxt,tipTxt].filter(Boolean).join('; ');
    return {ok:false, sn006:false, kind:'sn006', ends:desc,
      msg:'Cantilever LTB on the standard route: NCCI SN006a (Tables 3.1&ndash;3.3) describes a cantilever whose root holds U<sub>y</sub>, R<sub>z</sub> and R<sub>x</sub> (v = v&prime; = &phi; = 0, warping restrained or free) and whose tip is free of every lateral restraint; here '+desc+', which the tables do not cover. '+useMcr,
      note:null};
  }
  if(sec && sec.isBox && st.family==='shs') return {ok:true, sn006:false, msg:null, note:null, ends:''};
  const bad=ends.filter(e=>!(e.uy&&e.rx));
  if(bad.length){
    const desc=bad.map(e=>'End '+e.n+' releases '+releases(e).join(' and ')).join('; ');
    return {ok:false, sn006:false, kind:'fork', ends:desc,
      msg:'Standard (closed-form) M<sub>cr</sub> for LTB: the SN003a form'+(sec&&sec.kind==='channel'? ' and the P385/P362 channel &kappa; chain assume' : ' assumes')+' fork ends &mdash; U<sub>y</sub> (lateral translation) and R<sub>x</sub> (twist) held &mdash; at both ends (k = k<sub>w</sub> = 1); here '+desc+'. The chain printed below assumes fork ends and would be unconservative for these end conditions. '+useMcr,
      note:null};
  }
  // a warping flag on an I_w = 0 box is not a boundary condition of the twist equation (warpingApplies, js/03-state-ui.js)
  const warpOn = !sec || warpingApplies(sec);
  const clamped=ends.filter(e=>e.rz).map(e=>'End '+e.n), warped=ends.filter(e=>e.warp&&warpOn).map(e=>'End '+e.n);
  let note=null;
  if(clamped.length||warped.length){
    const parts=[];
    if(clamped.length) parts.push('laterally clamped end'+(clamped.length>1?'s':'')+' (R<sub>z</sub> held at '+clamped.join(' and ')+')');
    if(warped.length) parts.push('warping-fixed end'+(warped.length>1?'s':'')+' ('+warped.join(' and ')+')');
    note='Standard (closed-form) M<sub>cr</sub>: '+parts.join(' and ')+' taken as fork end'+(clamped.length+warped.length>1?'s':'')+', k = k<sub>w</sub> = 1 (conservative: the SN003a k = 0.5 / k<sub>w</sub> = 0.5 rows are not applied; the FE eigen route uses v&prime; = 0 / &phi;&prime; = 0 and gives the higher M<sub>cr</sub>).';
  }
  const warpIgnored=ends.filter(e=>e.warp&&!warpOn).map(e=>'End '+e.n);
  if(warpIgnored.length) note=(note? note+' ' : '')+'Warping flag at '+warpIgnored.join(' and ')+' not applied: this closed section has I<sub>w</sub> = 0, so &phi;&prime; is not a boundary condition of its twist equation (EN 1993-1-1 6.2.7(7)).';
  return {ok:true, sn006:false, msg:null, note, ends:''};
}
// ---- Standard (closed-form) Mcr for one segment, pure ----
// Used by the eigen method for the "Mcr eigen / Mcr standard" comparison (no
// eigen solve needed) and by the report. Cantilever (I/H) -> SN006a; otherwise
// the SN003a form with C1 from sn003aC1 over the segment, LE = LE-factor
// (x1.2 if destabilising) x segment length, z_g = the load height of the
// combination (stdZgFor) with C2 where published. End flag sets the closed
// form cannot describe (stdMcrEndsStatus) return Mcr = null with the reason.
// `diag` = {fb, factors} selects the combination whose diagram and loads the
// value describes (default a.governM), so the eigen method can pass its own
// LTB-governing combination and get a sign-consistent comparison.
// Returns kN.m: {route, Mcr (null if not covered), C1, C2, label, c1in, seg,
// LE, zg, zgSource, zgUsed, zgNote (HTML), zgBlocked}.
function mcrStandardFor(a,sec,seg,diag){
  const isCant=isCantilever(S);
  seg=seg||c1Segment(a);
  const fb=(diag&&diag.fb)||a.governM.fb;
  const fac=(diag&&diag.combo)||((diag&&diag.factors)? {factors:diag.factors} : a.governM.combo);   // combination (pattern-aware)
  const zgi=stdZgFor(fac);
  const es=stdMcrEndsStatus(S,sec);
  if(!es.ok){
    return {route:'unsupported', Mcr:null, C1:null, C2:null, label:'closed form not applicable to these end conditions ('+es.ends+'; '+(es.kind==='sn006'? 'SN006a needs a root holding U<sub>y</sub>, R<sub>z</sub>, R<sub>x</sub> and a free tip' : 'the SN003a form needs fork ends U<sub>y</sub> + R<sub>x</sub> at both ends')+')',
      c1in:c1Inputs(fb,seg.xa,seg.xb), seg, LE:null, endsMsg:es.msg, zg:zgi.zg, zgSource:zgi.source, zgUsed:false, zgNote:'', zgBlocked:false};
  }
  if(es.sn006){
    const r=mcrSN006aFor(a,sec,fac,zgi.zg);
    const c1in=c1Inputs(fb,seg.xa,seg.xb);
    return {route:'sn006a', Mcr:(r.Mcr!=null? r.Mcr/1e6 : null), C1:r.C, C2:null,
      label:'cantilever SN006a &mdash; '+r.caseLbl, c1in, seg, LE:a.L, sn006:r,
      zg:zgi.zg, zgSource:zgi.source, zgUsed:Math.abs(zgi.zg)>1e-9, zgNote:'z<sub>g</sub> = '+(zgi.zg>0?'+':'')+zgi.zg.toFixed(0)+' mm through &eta; = '+r.eta.toFixed(2)+' (SN006a)', zgBlocked:false};
  }
  const c1r=sn003aC1(a,isCant,seg.whole? undefined : seg,{fb,combo:fac});
  const LE=ltbLeFactor()*(S.destab?1.2:1)*(seg.xb-seg.xa);
  const cf=mcrClosedForm(sec,a.E,LE,c1r.C1,c1r.C2,zgi.zg);
  const zs=stdZgStatus(zgi.zg,c1r.C2,cf.zgUsed);
  const route= sec.kind==='channel'? 'channel' : c1r.route;
  const endsTag= es.note? ' [k = k<sub>w</sub> = 1: clamped / warping-fixed end(s) taken as forks]' : '';
  return {route, Mcr:cf.Mcr/1e6, C1:c1r.C1, C2:c1r.C2, label:c1r.label+endsTag, c1in:c1r.c1in, seg, LE,
    T1:cf.T1/1e3, zg:zgi.zg, zgSource:zgi.source, zgUsed:cf.zgUsed, zgNote:zs.text, zgBlocked:!!zs.block, endsNote:es.note};
}

function checksEC3UnrestrainedSCI(a){
  // STANDARD METHOD (closed-form Mcr). Kept alive by js/08-mcr-eigen-patch.js
  // as window.checksEC3UnrestrainedStandard and used when S.mcrMethod ===
  // 'standard'; the patch's own function (FE eigensolver) is the default.
  // SCI worked-example procedure: unrestrained beam to BS EN 1993-1-1 (UK NA).
  // Cross-section checks are identical to the restrained case. LTB design
  // basis for I/H sections: the elastic critical moment route, Mcr from the
  // SN003a closed form (k = kw = 1, G = 81000 N/mm2, C2*zg where published),
  // lamLT = sqrt(Wy fy / Mcr), chiLT per cl 6.3.2.3 with lamLT0 = 0.4,
  // beta = 0.75 (NA 2.17), curve from NA Table NA.1 (ltbCurveNA), then
  // chiLT,mod = chiLT/f with kc = 1/sqrt(C1) (NA 2.18) and Mb,Rd <= Mc,Rd.
  // The P362 Expn (6.55) simplified slenderness lamLT = (1/sqrt(C1)) 0.9
  // lamZbar sqrt(betaW) is evaluated alongside as a COMPARISON only (ltb.MbSimp);
  // it never sets the verdict. Boxes take the same Mcr chain with Iw = 0,
  // cantilevers SN006a, channels the P385/P362 kappa chain.
  const b=checksEC3Restrained(a);
  const sec=a.sec, fy=a.py, E=a.E, gM1=1.0;
  const unsupported=b.unsupported.slice();
  const advisory=(b.advisory||[]).slice();
  const Wy=b.Wy;
  const isCant=isCantilever(S);
  // End conditions the closed form can describe (19 Sep 2026 review finding
  // F-C): fork ends U_y + R_x at both ends, or the SN006a cantilever of
  // isSn006aCantilever() for an I/H section; anything else is NOT VERIFIED
  // on this route (message below, the fork-ended chain still printed), a
  // clamped / warping-fixed end is taken as a fork and said so.
  const endsStd=stdMcrEndsStatus(S,sec);
  const LE=ltbLeFactor()*(S.destab?1.2:1)*a.L;
  const gfac=a.governM.combo;     // governing-moment combination (pattern-aware load list)
  const c1r=sn003aC1(a,isCant);   // whole member: the closed form treats the member as one segment
  const C1=c1r.C1, kcr=kcFromC1(C1), invSqrtC1=kcr.kcRaw, kc=kcr.kc;   // k_c floored at 1/sqrt(2.76) = 0.60 (Table 6.6 lower bound)
  const zgi=stdZgFor(gfac);       // load height of the governing combination (per-load z_g, most destabilising)
  const zgStd=zgi.zg;
  const segStd=c1Segment(a);
  if(!segStd.whole) advisory.push("Standard (closed-form) M<sub>cr</sub>: the member is treated as ONE segment of length L<sub>E</sub> = "+(ltbLeFactor()*(S.destab?1.2:1)).toFixed(2)+"&times;L with C<sub>1</sub> from the whole-member moment diagram; intermediate lateral restraints are not applied on this route (conservative on L<sub>E</sub>). Use the FE eigenvalue method for the bay-by-bay M<sub>cr</sub>, or verify each bay separately.");
  const curve=ltbCurveNA(sec);
  // chi_LT chain of cl 6.3.2.3 (NA 2.17: lamLT0 = 0.4, beta = 0.75) with the
  // NA 2.18 f-factor from kc = 1/sqrt(C1); f = 1 when `noF` (cantilevers)
  const chiChain=(lamLT,noF)=>{
    if(lamLT<=0.4) return {Phi:null,chi:1,f:1,chiMod:1,ign:true};
    const Phi=0.5*(1+curve.alphaLT*(lamLT-0.4)+0.75*lamLT*lamLT);
    let chi=1/(Phi+Math.sqrt(Math.max(Phi*Phi-0.75*lamLT*lamLT,1e-12)));
    chi=Math.min(chi,1,1/(lamLT*lamLT));
    let f=noF? 1 : Math.min(1-0.5*(1-kc)*(1-2*Math.pow(lamLT-0.8,2)),1);
    const chiMod=Math.min(chi/f,1,1/(lamLT*lamLT));
    return {Phi,chi,f,chiMod,ign:false};
  };
  let ltb, zgs=null;
  if(sec.isBox){
    // Closed section: the same SN003a chain with Iw = 0 (warping neglected),
    // C2*zg where published, chi_LT from the NA Table NA.1 curve (hot-finished
    // hollow sections share the I/H h/b allocation, cold-formed c/d - the same
    // ltbCurveNA() the eigen method uses). lamLT <= 0.4 reproduces the
    // exemption (cl 6.3.2.2(4); square hollow sections are also exempt by
    // cl 6.3.2.1(2)); a slender RHS on a long span gets a real chi_LT.
    const cf=mcrClosedForm(sec,E,LE,C1,c1r.C2,zgStd);
    const Mcr=cf.Mcr;
    const lamLT=Math.sqrt(Wy*fy/Mcr);
    const sB=chiChain(lamLT,false);
    const Mb=Math.min(sB.chiMod*Wy*fy/gM1/1e6,b.McRd);
    zgs=stdZgStatus(zgStd,c1r.C2,cf.zgUsed);
    ltb={na:sB.ign, box:true, T1:cf.T1/1e3, GIt:cf.GIt/1e9, Mcr:Mcr/1e6, lamLTmcr:lamLT, ignM:sB.ign,
      PhiM:sB.Phi, chiM:sB.chi, fM:sB.f, chiModM:sB.chiMod, curve, kc, kcRaw:kcr.kcRaw, kcFloored:kcr.floored, invSqrtC1,
      zg:zgStd, C2:c1r.C2, zgUsed:cf.zgUsed, MbSimp:Mb, MbMcr:Mb, MbRd:Mb};
  } else if(endsStd.sn006){
    // NCCI SN006a-EN-EU cantilever path (doubly symmetric I/H, root U_y + R_z +
    // R_x, free tip - isSn006aCantilever): see mcrSN006aFor(). An I/H
    // cantilever with other lateral flags falls through to the fork-ended
    // chain below and is refused by endsStd (NOT VERIFIED).
    const sn=mcrSN006aFor(a,sec,gfac,zgStd);
    const {Mcr0,kwt,eta,warp,caseLbl,C,Cq,CF,Mq,MF}=sn;
    zgs={text:'z<sub>g</sub> = '+(zgStd>0?'+':'')+zgStd.toFixed(0)+' mm through &eta; = z<sub>g</sub>/(h<sub>s</sub>/2) = '+eta.toFixed(2)+' (SN006a)', block:null, advisory:null};
    if(C==null){
      unsupported.push(sn.reason);
      ltb={na:false,cant:true,Mcr0:Mcr0/1e6,kwt,eta,warp,caseLbl,C:0,Cq,CF,Mq,MF,
        lamLTsimp:0,lamLTmcr:0,ignS:true,ignM:true,chiM:1,fM:1,chiModM:1,PhiM:null,
        curve,kc:1,invSqrtC1:1,MbSimp:0,MbMcr:0,MbRd:0,Mcr:0,T1:0,IwIz:0,GIt:0,zg:zgStd,zgUsed:Math.abs(zgStd)>1e-9};
    } else {
      const Mcr=C*Mcr0;
      const lamLT=Math.sqrt(Wy*fy/Mcr);
      const sB=chiChain(lamLT,true);   // kc/f-factor not applied for cantilevers (no published kc)
      const Mb=Math.min(sB.chiMod*Wy*fy/gM1/1e6,b.McRd);
      ltb={na:false,cant:true,Mcr0:Mcr0/1e6,kwt,eta,warp,caseLbl,C,Cq,CF,Mq,MF,
        lamLTsimp:lamLT,lamLTmcr:lamLT,PhiS:sB.Phi,chiS:sB.chi,ignS:sB.ign,
        PhiM:sB.Phi,chiM:sB.chi,fM:1,chiModM:sB.chiMod,ignM:sB.ign,curve,kc:1,invSqrtC1:1,
        lamZ:0,lam1:0,lamZbar:0,rootBw:1,hb:sec.D/sec.B,
        MbSimp:Mb,MbMcr:Mb,MbRd:Mb,Mcr:Mcr/1e6,McrBack:Mcr/1e6,T1:0,IwIz:0,GIt:0,fS:1,chiModS:sB.chiMod,zg:zgStd,zgUsed:Math.abs(zgStd)>1e-9};
    }
  } else if(sec.kind==='channel'){
    // P385 / P362 channel chain (spec 13.4): lamLT = (L/i_z)/kappa, curve d,
    // rolled-section chi formulas (validated: Ex 4 chi = 0.29), no f-factor;
    // M_cr back-calculated = W_y*f_y / lamLT^2 (needed for the Annex A k_alpha).
    const ry=sec.ry*10;
    const kappa=({S275:96,S355:85,S460:74})[S.grade]||96;
    const lamLT=(LE/ry)/kappa;
    const alphaLT=0.76; // curve d (non-doubly-symmetric)
    let chi=1,Phi=null,ign=true;
    if(lamLT>0.4){
      Phi=0.5*(1+alphaLT*(lamLT-0.4)+0.75*lamLT*lamLT);
      chi=Math.min(1/(Phi+Math.sqrt(Math.max(Phi*Phi-0.75*lamLT*lamLT,1e-12))),1,1/(lamLT*lamLT));
      ign=false;
    }
    const Mb=Math.min(chi*Wy*fy/gM1/1e6,b.McRd);
    const McrBack=Wy*fy/(lamLT*lamLT)/1e6;
    // Mcr route for channels: a PFC bent about its major axis is symmetric about
    // the axis of bending (Wagner term zj = 0), so with the load through the
    // SHEAR CENTRE and fork supports at both ends the doubly-symmetric Mcr
    // expression is theoretically exact (validated against an independent commercial-software
    // channel example: Mcr 330.9, chi 0.881, f 0.838, Mb = Mc 97.625). Route is
    // OFFERED only under those conditions: no active torsion (e = 0 everywhere),
    // z_g = 0, two end fork supports (not a cantilever). The kappa chain stays
    // the primary basis; the Mcr route rescues it, mirroring the old I-section pattern.
    let chanMcr=null;
    const chanMcrOK = !(a.tors&&a.tors.on) && Math.abs(zgStd)<1e-9 && !isCant &&
      endsList().every(e=>e.uz&&e.uy&&e.rx) && (sec.Iw||0)>0;   // vertically supported fork ends at both ends
    let MbMcr2=Mb;
    if(chanMcrOK){
      const G=81000, Iz=sec.Iy*1e4, It=sec.J*1e4, Iw=(sec.Iw||0)*1e12;
      const T1c=Math.PI*Math.PI*E*Iz/(LE*LE);
      const McrC=C1*T1c*Math.sqrt(Math.max(Iw/Iz+G*It/T1c,0));
      const lamC=Math.sqrt(Wy*fy/McrC);
      let PhiC=null,chiC=1,fC=1,chiModC=1,ignC=true;
      if(lamC>0.4){
        PhiC=0.5*(1+0.76*(lamC-0.4)+0.75*lamC*lamC);
        chiC=Math.min(1/(PhiC+Math.sqrt(Math.max(PhiC*PhiC-0.75*lamC*lamC,1e-12))),1,1/(lamC*lamC));
        fC=Math.min(1-0.5*(1-kc)*(1-2*Math.pow(lamC-0.8,2)),1);
        chiModC=Math.min(chiC/fC,1,1/(lamC*lamC)); ignC=false;
      }
      MbMcr2=Math.min(chiModC*Wy*fy/gM1/1e6, b.McRd);
      chanMcr={Mcr:McrC/1e6,lam:lamC,Phi:PhiC,chi:chiC,f:fC,chiMod:chiModC,ign:ignC,Mb:MbMcr2,T1:T1c/1e3};
    }
    zgs={text: Math.abs(zgStd)<1e-9? 'z<sub>g</sub> = 0 (load through the shear centre)' : 'z<sub>g</sub> = '+(zgStd>0?'+':'')+zgStd.toFixed(0)+' mm entered &mdash; not used by the P385/P362 &kappa; chain (load height enters the channel route only through the destabilising L<sub>E</sub> switch); the shear-centre M<sub>cr</sub> route is not offered', block:null, advisory:null};
    ltb={na:false,channel:true,chanMcr,ry,kappa,lamLTsimp:lamLT,lamLTmcr:lamLT,PhiS:Phi,chiS:chi,ignS:ign,
      PhiM:Phi,chiM:chi,fM:1,chiModM:chi,ignM:ign,curve:{alphaLT:0.76,curve:'d'},kc,kcRaw:kcr.kcRaw,kcFloored:kcr.floored,invSqrtC1,
      lamZ:LE/ry,lam1:0,lamZbar:0,rootBw:1,hb:sec.D/sec.B,
      MbSimp:Mb,MbMcr:MbMcr2,MbRd:Mb,Mcr:McrBack,McrBack,T1:0,IwIz:0,GIt:0,fS:1,chiModS:chi,zg:zgStd,zgUsed:false};
  } else {
    const ry=sec.ry*10;
    const lamZ=LE/ry;
    const lam1=Math.PI*Math.sqrt(E/fy);
    const lamZbar=lamZ/lam1;
    const rootBw=b.cl.cls<=2? 1 : Math.sqrt(sec.Zx/sec.Sx);
    const hb=sec.D/sec.B;
    // (B) DESIGN BASIS: elastic critical moment (SN003a; k = kw = 1; C2*zg
    // load-height term where published for the recognised diagram) - mcrClosedForm()
    const C2=c1r.C2;
    const cf=mcrClosedForm(sec,E,LE,C1,C2,zgStd);
    const T1=cf.T1, IwIz=cf.IwIz, GIt=cf.GIt, zgUsed=cf.zgUsed, Mcr=cf.Mcr; // N, mm2, N.mm2, N.mm
    const lamLTmcr=Math.sqrt(Wy*fy/Mcr);
    const sB=chiChain(lamLTmcr,false);
    const MbMcr=Math.min(sB.chiMod*Wy*fy/gM1/1e6,b.McRd);
    // (A) COMPARISON ONLY: simplified slenderness, P362 Expn (6.55)
    const lamLTsimp=invSqrtC1*0.9*lamZbar*rootBw;
    const sA=chiChain(lamLTsimp,false);
    const MbSimp=Math.min(sA.chiMod*Wy*fy/gM1/1e6,b.McRd);
    zgs=stdZgStatus(zgStd,C2,zgUsed);
    ltb={na:false,ry,lamZ,lam1,lamZbar,rootBw,hb,curve,kc,kcRaw:kcr.kcRaw,kcFloored:kcr.floored,invSqrtC1,
      lamLTsimp,PhiS:sA.Phi,chiS:sA.chi,fS:sA.f,chiModS:sA.chiMod,ignS:sA.ign,MbSimp,
      T1:T1/1e3,IwIz:IwIz/1e2,GIt:GIt/1e9,Mcr:Mcr/1e6,zg:zgStd,C2,zgUsed,
      lamLTmcr,PhiM:sB.Phi,chiM:sB.chi,fM:sB.f,chiModM:sB.chiMod,ignM:sB.ign,MbMcr,
      MbRd:MbMcr};
  }
  // ---- load height bookkeeping (always printed; may block PASS) ----
  ltb.zgSource=zgi.source;
  ltb.zgNote=zgs? zgs.text : '';
  ltb.zgBlocked=!!(zgs&&zgs.block);
  if(zgs&&zgs.block) unsupported.push(zgs.block);
  if(zgs&&zgs.advisory) advisory.push(zgs.advisory);
  // ---- end conditions of the closed form (always recorded; may block PASS) ----
  ltb.endsOk=endsStd.ok; ltb.endsMsg=endsStd.msg; ltb.endsNote=endsStd.note;
  if(!endsStd.ok) unsupported.push(endsStd.msg);
  if(endsStd.note) advisory.push(endsStd.note);
  // ---- method tags and the MasterSeries-style C1 inputs (M1, M2, Mo, psi, mu) ----
  // The closed form derives C1 from the WHOLE member, so the printed inputs are
  // the whole-member values (segment 0..L); the eigen method fills the same
  // fields for its governing span. McrEigen is null here: the eigensolver is
  // not run on the standard route (keeps it fast).
  ltb.mcrMethod='standard';
  ltb.c1in=c1r.c1in;
  ltb.c1seg={xa:0,xb:a.L,whole:true};
  ltb.c1route= ltb.cant? 'sn006a' : ltb.channel? 'channel' : c1r.route;
  ltb.c1label= ltb.cant? ('cantilever SN006a &mdash; '+ltb.caseLbl) : ltb.channel? ('channel &mdash; P385/P362 kappa chain; '+c1r.label) : c1r.label;
  ltb.C1show= ltb.cant? (ltb.C||0) : C1;
  ltb.McrStandard= ltb.cant? (ltb.Mcr>0? ltb.Mcr : null) : ltb.channel? (ltb.chanMcr? ltb.chanMcr.Mcr : ltb.McrBack) : ltb.Mcr;
  ltb.McrEigen=null;
  ltb.segWhole=segStd.whole;
  const Mx=b.Mx;
  let ltbUtil = ltb.MbRd>0? Mx/ltb.MbRd : 0;
  let ltbBasis;
  if(ltb.box){
    ltbBasis = ltb.ignM
      ? 'closed hollow section, &lambda;&#772;<sub>LT</sub> = '+ltb.lamLTmcr.toFixed(3)+' &le; 0.4 from the SN003a M<sub>cr</sub> with I<sub>w</sub> = 0: lateral-torsional buckling effects may be ignored (cl 6.3.2.2(4)'+(S.family==='shs'? '; a square hollow section is also not susceptible by cl 6.3.2.1(2)' : '')+'), M<sub>b,Rd</sub> = M<sub>c,Rd</sub>'
      : 'closed hollow section on a long span: M<sub>cr</sub> method (SN003a with I<sub>w</sub> = 0), &lambda;&#772;<sub>LT</sub> = '+ltb.lamLTmcr.toFixed(3)+' &gt; 0.4, &chi;<sub>LT,mod</sub> from cl 6.3.2.3 with curve '+curve.curve+' (NA Table NA.1, hot-finished / cold-formed hollow section) and k<sub>c</sub> = 1/&radic;C<sub>1</sub>; M<sub>b,Rd</sub> = &chi;<sub>LT,mod</sub>W<sub>y</sub>f<sub>y</sub>/&gamma;<sub>M1</sub> &le; M<sub>c,Rd</sub>';
  } else if(ltb.cant){
    ltbBasis = 'M<sub>cr</sub> method (NCCI SN006a cantilever): M<sub>cr</sub> = C&middot;M<sub>cr,0</sub>, &lambda;&#772;<sub>LT</sub> = &radic;(W<sub>y</sub>f<sub>y</sub>/M<sub>cr</sub>), &chi;<sub>LT</sub> from cl 6.3.2.3 curve '+curve.curve+' with f = 1; M<sub>b,Rd</sub> = &chi;<sub>LT</sub>W<sub>y</sub>f<sub>y</sub>/&gamma;<sub>M1</sub> &le; M<sub>c,Rd</sub>';
  } else if(ltb.channel){
    ltbBasis = 'P385/P362 channel &kappa; chain, &lambda;&#772;<sub>LT</sub> = (L<sub>E</sub>/i<sub>z</sub>)/&kappa;, curve d, no f-factor; M<sub>b,Rd</sub> = &chi;<sub>LT</sub>W<sub>y</sub>f<sub>y</sub>/&gamma;<sub>M1</sub> &le; M<sub>c,Rd</sub>';
    if(ltbUtil>1.0001 && ltb.MbMcr>0 && Mx/ltb.MbMcr<=1.0001){
      ltbUtil=Mx/ltb.MbMcr; ltb.MbRd=ltb.MbMcr;
      ltbBasis='M<sub>cr</sub> method (SN003a with z<sub>j</sub> = 0, load through the shear centre) &mdash; the P385/P362 channel &kappa; chain is exceeded, but it is conservative; adequacy is demonstrated by the M<sub>cr</sub> route';
    }
  } else {
    ltbBasis = 'M<sub>cr</sub> method (SN003a closed form, k = k<sub>w</sub> = 1, G = 81000 N/mm&sup2;'+(ltb.zgUsed? ', C<sub>2</sub>z<sub>g</sub> load-height term' : '')+'): &lambda;&#772;<sub>LT</sub> = &radic;(W<sub>y</sub>f<sub>y</sub>/M<sub>cr</sub>) = '+ltb.lamLTmcr.toFixed(3)+', &chi;<sub>LT,mod</sub> from cl 6.3.2.3 curve '+curve.curve+' with k<sub>c</sub> = 1/&radic;C<sub>1</sub> (NA 2.18); M<sub>b,Rd</sub> = &chi;<sub>LT,mod</sub>W<sub>y</sub>f<sub>y</sub>/&gamma;<sub>M1</sub> &le; M<sub>c,Rd</sub>. The P362 Expn 6.55 simplified slenderness (&lambda;&#772;<sub>LT</sub> = '+ltb.lamLTsimp.toFixed(3)+', M<sub>b,Rd</sub> = '+ltb.MbSimp.toFixed(1)+' kN&middot;m) is printed for comparison only';
  }
  // end conditions of the closed form: fork ends assumed (a released end is NOT VERIFIED), clamped / warping-fixed ends taken as forks
  if(!endsStd.ok) ltbBasis+='. NOT VERIFIED: the closed form assumes fork ends (U<sub>y</sub> + R<sub>x</sub> at both ends'+(isCant? ', or the SN006a cantilever root / free tip' : '')+') and '+endsStd.ends+' &mdash; use the FE eigenvalue method';
  else if(endsStd.note) ltbBasis+='. Clamped / warping-fixed end(s) taken as fork ends, k = k<sub>w</sub> = 1 (conservative)';
  // ---- BS EN 1993-6 Annex A: LTB + minor-axis bending + torsion interaction (P385 6.2/8.2) ----
  let annex=null;
  if(b.tor && b.tor.p385 && !ltb.na){
    // chi_LT WITHOUT the f-factor (P385 validation basis), curve per table
    const chiA=ltb.channel? ltb.chiM : (ltb.ignM? 1 : ltb.chiM);
    const MbA=chiA*Wy*fy/gM1/1e6;
    const McrA=ltb.channel? ltb.McrBack : ltb.Mcr;
    // Cmz proxy for the minor-axis diagram: the tabulated load case behind C1
    // (central point load 0.9, UDL 0.95, otherwise 1.0 conservative)
    const CmzProxy = (c1r.route==='point')? 0.9 : (c1r.route==='uniform')? 0.95 : 1.0;
    // resistances CLASS-CONSISTENT (elastic for Class 3) - required: with plastic
    // values a Class 3 member scores unconservatively (exposed by an independent commercial-software
    // UC 152x152x23 warping-torsion example: elastic gives 1.03-1.05 FAIL, plastic
    // would have shown 0.91 PASS).
    // 20 Sep 2026 torsion + N/Mz: Eq (A.1) per station with M_z,Ed = M_z,tot = imposed M_z + phi.M_y
    // in both the C_mz M_z/M_z,Rd term and k_zw; C_mz = 1.0 when an M_z is imposed (annexAEval above)
    annex=annexAEval(b.tor,MbA,McrA,CmzProxy);
    // 20 Sep 2026: M_y,Ed >= M_cr is a FAILURE (LTB governs, the Annex A utilisation is carried as 99), not an
    // unverified check - reported through advisory with the FAIL: prefix so the brief prints a Warning row
    if(annex.unbounded) advisory.push(KALPHA_UNBOUNDED_FAIL);
  }
  // member buckling: susceptible to torsional deformation unless closed section
  // or LTB plays no part (chiLT = 1); cantilever/channel handled per path.
  // The Mb,Rd handed to Eq 6.61/6.62 is the design value above (Mcr route).
  const isCantU=isCantilever(S);
  const useB1u = sec.isBox || ltb.na || (ltb.MbRd>=b.McRd*0.9999);
  const buck=(b.ax && !b.ax.tension)? annexB2(a,sec,fy,b.cl,ltb.MbRd>0? ltb.MbRd : b.McRd,useB1u,isCantU,b.aeff) : null;
  if(buck && buck.tfb && !buck.tfb.ok) unsupported.push('PFC under axial compression: '+buck.tfb.reason+'; torsional / torsional-flexural buckling (cl 6.3.1.4) cannot be verified, PASS is blocked.');
  const restraintF=restraintForces(a,sec);
  const utils=[
    {name:"Shear  V_Ed/V_c,Rd",val:b.shearUtil},
    {name:"Bending  M_Ed/M_c,Rd",val:b.momUtil},
    {name:"LTB  M_Ed/M_b,Rd",val:ltbUtil},
    {name:"Deflection",val:b.dmax/b.dlimit},
  ];
  if(b.ax){
    utils.push({name: b.ax.tension? "Tension  N_Ed/N_t,Rd" : (b.ax.aeff&&b.ax.aeff.active? "Compression  N_Ed/N_c,Rd (A_eff)" : "Compression  N_Ed/N_pl,Rd"), val:b.ax.nUtil});
    utils.push({name: b.ax.biax? ("Biaxial bending"+((S.axial||0)!==0?" + axial":"")+" (6.2.9.1)") : "Bending+axial cross-section (6.2.9)",val:b.ax.mUtil});
    // Eq 6.61/6.62 are needed with axial compression AND for biaxial bending on
    // an LTB-susceptible member with N_Ed = 0 (kzy*My/MbRd + kzz*Mz/MczRd).
    if(!b.ax.tension && buck && (buck.Fc>1e-9 || buck.biax)){
      if(buck.tfb && buck.tfb.ok) utils.push({name:TFB_UTIL_NAME,val:buck.tfb.util});
      utils.push({name:"Member buckling y-y (Eq 6.61)",val:buck.u1});
      utils.push({name:"Member buckling z-z (Eq 6.62)",val:buck.u2});
    }
  }
  if(annex) utils.push({name:"LTB+torsion (EN 1993-6 Annex A)",val:annex.u});
  if(b.coex) utils.push({name:b.coex.pureShearFail? "Pure shear failure at M-V check point (6.2.6)" : "Bending+shear coexistent (6.2.8)",val:b.coex.u});
  if(b.mvn) utils.push({name:mvnUtilName(b.mvn),val:b.mvn.u});
  if(b.web&&b.web.checked){
    utils.push({name:WEB_UTIL_NAMES[0],val:b.web.util2});
    utils.push({name:WEB_UTIL_NAMES[1],val:b.web.util72});
  }
  if(b.tor&&b.tor.box){
    utils.push({name:"Torsion  T_Ed/T_Rd",val:b.tor.torUtil});
    utils.push({name:"Shear+torsion  V_Ed/V_pl,T,Rd",val:b.tor.vtUtil});
  }
  if(b.tor&&b.tor.p385){
    utils.push({name:"Bending+torsion cross-section (P385 3.1.2)",val:b.tor.cross.u});
    utils.push({name:"Shear+torsion  V_Ed/V_pl,T,Rd",val:b.tor.vtUtil});
  }
  // 20 Sep 2026 torsion + N/Mz: elastic yield criterion (6.1), cl 6.2.7(5); 20 Sep 2026 review: in utils only when
  // verdict-binding (elasticBindingPolicy in checksEC3Restrained), otherwise in b.info (carried over) with its advisory
  if(b.tor&&b.tor.elastic&&b.tor.elastic.binding) utils.push({name:ELASTIC_TORSION_UTIL_NAME,val:b.tor.elastic.u});
  // 20 Sep 2026 torsion + N/Mz: advisory superposition of Eq 6.62 and (A.1) with this path's k_alpha (information only)
  if(b.tor&&b.tor.p385){ b.tor.superposition=torsionSuperposition(b.tor,annex,buck); if(b.tor.superposition) advisory.push(b.tor.superposition.text); }
  // 20 Sep 2026 review: the basis text of this path (6.61/6.62 and (A.1) as evaluated here)
  if(b.tor&&(b.tor.p385||b.tor.box)) b.tor.combinedBasis=torsionCombinedBasis({box:!!b.tor.box,tension:!!(b.ax&&b.ax.tension),hasN:Math.abs(S.axial||0)>1e-9,hasMz:Math.abs(S.Mz||0)>1e-9,restrained:false,buckEvaluated:!!(!(b.ax&&b.ax.tension)&&buck&&(buck.Fc>1e-9||buck.biax)),annexEvaluated:!!annex,binding:!!(b.tor.elastic&&b.tor.elastic.binding)});
  let gov=utils[0]; utils.forEach(u=>{ if(u.val>gov.val) gov=u; });
  const pass=unsupported.length===0 && utils.every(u=>u.val<=1.0001);
  return Object.assign({},b,{sci:false,sciU:true,mcrMethod:'standard',unsupported,advisory,ltb,ltbUtil,ltbBasis,C1,c1label:c1r.label,LE,utils,gov,pass,annex,buck,restraintForces:restraintF});
}
