function checksBS5950(a){
  const sec=a.sec, py=a.py, E=a.E;
  const unsupported=[];
  const advisory=[];
  const eps=Math.sqrt(275/py);
  const Ag=sec.A*1e2;
  const F=S.axial||0, Fc0=Math.max(F,0);
  if(Math.abs(S.Mz||0)>1e-9) unsupported.push('BS 5950 minor-axis bending and biaxial interaction are not implemented. The entered minor-axis moment cannot be ignored; PASS is blocked.');
  // BS 5950-1:2000 Figure 5 flange outstand: rolled I/H  b = B/2; channel  b = B
  // (the FULL flange width). The section tables store the EC3 ratio
  // c/t = ((B - tw - 2r)/2)/tf, which is SMALLER and would misclassify near the
  // Table 11 limits, so the BS ratio is rebuilt from the raw geometry here.
  // The web d/t is the same dimension in both codes (d = depth between fillets),
  // and the box tables already store the Table 12 flats (B-3t HF / B-5t CF per
  // note a), so those pass through unchanged.
  // Classification sees the coexistent axial compression: Table 11 "generally"
  // web rows with r1/r2 (cl 3.5.5) tighten the limits below 80/100/120e.
  const bT_BS = sec.isBox? sec.bT : ((sec.kind==='channel'? sec.B : sec.B/2)/sec.tf);
  const cl = sec.isBox? classifyBox(sec.bT,sec.dt,eps,sec.boxType)
    : classify(bT_BS,sec.dt,eps,sec.kind,{Fc:Fc0*1000, dwt:(sec.d||0)*sec.tw, Ag:Ag, py:py});
  const clsName=["","Plastic","Compact","Semi-compact","Slender"][cl.cls];
  if(cl.cls>=4) unsupported.push("BS 5950 slender section"+(cl.webCase==='bending+compression'?" (web classified for combined bending + compression, Table 11 r1/r2 rows)":"")+": effective-section design is required; gross Zx is not accepted for PASS.");
  if(sec.isBox && Fc0>0) advisory.push("Box-section web classification uses the pure-bending Table 12 limits; the r1-based rows for coexistent axial compression are not applied (axial + bending on boxes is blocked from PASS separately when significant).");
  advisory.push("Web bearing and buckling at supports and under concentrated loads (cl 4.5.2 / 4.5.3) are outside this calculator's scope - verify separately wherever a reaction or point load is applied to an unstiffened web.");
  // shear   BS 5950 cl 4.2.3: open section Av=tw D; box section Av=A D/(D+B)
  // (for a square SHS, D=B, so this reduces exactly to A/2 as before).
  const Av = sec.isBox? sec.A*100*sec.D/(sec.D+sec.B) : sec.tw*sec.D; // sec.A is cm  for box ? mm ; PFC/UB/UC path unaffected
  const Pv=0.6*py*Av/1000, Fv=Math.abs(a.Vmax);
  const lowShear=Fv<=0.6*Pv;
  const shearBuckle=sec.dt>70*eps;
  if(shearBuckle) unsupported.push("BS 5950 shear buckling check is required and is not implemented in this calculator.");
  // moment capacity
  const Zx=sec.Zx*1e3, Sx=sec.Sx*1e3;
  let Mcx;
  if(cl.cls<=2) Mcx=Math.min(py*Sx,1.2*py*Zx)/1e6;
  else Mcx=py*Zx/1e6;
  let hsNote=null;
  if(!lowShear){
    if(sec.isBox){
      unsupported.push("BS 5950 high-shear moment reduction for box/RHS/SHS sections is section-specific and is not implemented exactly.");
    } else if(cl.cls<=2){
      const rho=Math.pow(2*Fv/Pv-1,2);
      const Sv=Av*Av/(4*sec.tw); // mm3, web shear area plastic modulus for open sections
      Mcx=Math.min(py*(Sx-rho*Sv),1.2*py*Zx)/1e6;
      hsNote=`high-shear reduction applied with S<sub>v</sub>=A<sub>v</sub> /(4t<sub>w</sub>)`;
    } else {
      // cl 4.2.5.3, class 3 semi-compact: Mc = py(Z - rho*Sv/1.5)
      const rho=Math.pow(2*Fv/Pv-1,2);
      const Sv=Av*Av/(4*sec.tw);
      Mcx=py*Math.max(Zx-rho*Sv/1.5,0)/1e6;
      hsNote=`high-shear reduction (semi-compact, cl 4.2.5.3): M<sub>c</sub> = p<sub>y</sub>(Z<sub>x</sub> &minus; &rho;S<sub>v</sub>/1.5)`;
    }
  }
  // effective area & axial
  const Anet=(S.anet!=null? S.anet*1e2 : Ag);
  const Ke=(S.Ke!=null? S.Ke : (KeByGrade[S.grade]||1.2));
  const Ae=Math.min(Ke*Anet,Ag);
  const Pz=Ae*py/1000;
  const n=Pz>0? Math.abs(F)/Pz : 0;
  // Reduced modulus for coexistent axial (cl 4.2.5 / 4.8.3.2). Class 1/2 uses
  // the plastic web-block formula S_r = S - (n Ag)^2/(4 t_w), valid only while
  // the shifted plastic neutral axis stays IN THE WEB (n Ag <= t_w d) - beyond
  // that the formula understates the loss, so PASS is blocked. Class 3 uses the
  // ELASTIC basis Z_x(1 - n) (linear interaction, cl 4.8.3.2) - previously the
  // plastic S_x was used for every class, overstating semi-compact capacity by
  // the shape factor (~12-15% on a UB). Only the covered I/H path feeds PASS;
  // box/channel axial+bending stays blocked.
  let Srx = cl.cls<=2? Sx : Zx;
  const tEff = sec.isBox? 2*sec.tw : sec.tw;
  if(n>0.02){
    if(sec.isBox || sec.kind==='channel') unsupported.push("BS 5950 axial-load plus major-axis bending requires section-family-specific reduced modulus data; this calculator does not use an adapted approximate formula for PASS.");
    else if(cl.cls<=2){
      const dn=n*Ag/sec.tw; // depth of web carrying the axial block, mm
      if(dn>(sec.d||0)+1e-6) unsupported.push("Axial ratio n = "+n.toFixed(2)+" pushes the plastic neutral axis out of the web (n&middot;A<sub>g</sub>/t<sub>w</sub> &gt; d): the web-block reduced-modulus formula is no longer valid and the flange-region expression is not implemented; PASS is blocked.");
      Srx=Math.max(0, Sx-(Ag*Ag*n*n)/(4*tEff));
    } else {
      Srx=Math.max(0, Zx*(1-n));
    }
  }
  const Mrx=Math.max(0,Math.min(Mcx,(cl.cls<=2? Math.min(py*Srx, 1.2*py*Zx) : py*Srx)/1e6));
  if(Math.abs(F)>1e-9&&!lowShear) unsupported.push('BS 5950 combined high shear, axial force and bending requires the web interaction check in clause 4.8; this is not implemented. PASS is blocked.');
  const Mx=Math.abs(a.Mmax);
  // zero/negative reduced capacity with a coexistent moment must read as a
  // failure, not util = 0 (n >= 1 zeroes the Class 3 elastic basis)
  const localUtil=Mrx>1e-9? Mx/Mrx : (Mx>1e-9? 99 : 0);
  // m-factors. Table 18 note: mLT = 1.0 for cantilevers AND for members with
  // DESTABILISING loading conditions (previously the destabilising switch only
  // lengthened LE and kept mLT < 1, which Table 18 does not permit).
  const isCant=(S.supports.length===1 && S.supports[0].type==='fixed');
  const mf=mFactors(a.Mq,a.Mh,a.Mq3,a.Mmax,a.M24);
  let mLT=(isCant||S.destab)?1:mf.mLT, mx=mf.mx;
  if(S.mLTo!=null) mLT=S.mLTo;
  if(S.mxo!=null) mx=S.mxo;
  // LTB   BS 5950 box-section path. SHS naturally returns very low ?LT because
  // Ix Iy; RHS uses the closed-section ?LT expression rather than a rough Table
  // 15 screen.
  const LE=S.leFactor*(S.destab?1.2:1)*a.L;
  const ry=sec.ry*10;
  let lam=null,v=null,betaW=null,lamLT=null,pb=null,lamL0=null,Mb,ltbUtil,rhsFlag=false,phiB=null,gammaPrime=null;
  if(sec.isBox){
    lam=LE/ry; lamL0=0.4*Math.sqrt(Math.PI*Math.PI*E/py);
    betaW=cl.cls<=2?1:Zx/Sx;
    const Ixmm=sec.Ix*1e4, Iymm=sec.Iy*1e4, Jmm=sec.J*1e4;
    gammaPrime=Math.max(0,(1-Iymm/Ixmm)*(1-Jmm/(2.6*Ixmm)));
    phiB=Math.sqrt(Math.max((Sx*Sx*gammaPrime)/(Ag*Jmm),0));
    lamLT=2.25*Math.sqrt(Math.max(phiB*lam*betaW,0));
    ({pb,lamL0}=pbFunc(lamLT,py,E));
    Mb=Math.min((cl.cls<=2? pb*Sx : pb*Zx)/1e6, Mcx);
    mLT=1; ltbUtil=Mb>0? Mx/Mb : 0;
  } else {
    lam=LE/ry;
    v=1/Math.pow(1+0.05*Math.pow(lam/sec.x,2),0.25);
    betaW=cl.cls<=2?1:Zx/Sx;
    lamLT=sec.u*v*lam*Math.sqrt(betaW);
    ({pb,lamL0}=pbFunc(lamLT,py,E));
    Mb=(cl.cls<=2? pb*Sx : pb*Zx)/1e6;
    // cl 4.3.6.2: the buckling resistance check is mLT*Mx <= Mb (the companion
    // Mx <= Mcx is carried by the bending utilisation above). Checking plain
    // Mx <= Mb was over-conservative by 1/mLT; mLT = 1 for cantilevers and
    // destabilising loads, so those cases are unchanged.
    ltbUtil=Mb>0? mLT*Mx/Mb : 0;
  }
  // strut (axial term)   rx=ry for a square SHS, so Pc=Pcy automatically there;
  // for UB the major/minor axis curves genuinely differ (Table 23).
  const autoRob = defaultRobertson(S.family,sec.boxType,sec.tf);
  const a_robX = S.robX!=null? S.robX : autoRob.x;
  const a_robY = S.robY!=null? S.robY : autoRob.y;
  const rx=sec.rx*10;
  const pcx=pcFunc(LE/rx,py,a_robX,E), pcy=pcFunc(LE/ry,py,a_robY,E);
  const Pc=Ag*pcx/1000, Pcy=Ag*pcy/1000;
  const Fc=Math.max(F,0);
  if(Fc>0 && sec.kind==='channel') unsupported.push("BS 5950 PFC/channel compression must use the UK channel strut approach/Table 25 or verified Blue Book data; the previous generic Robertson placeholder is not accepted.");
  const pyZx=py*Zx/1e6;
  const u1=Fc/Pc + mx*Mx/pyZx;
  const u2=Fc/Pcy + mLT*Mx/Mb;
  // deflection
  const span=a.deflection?a.deflection.span:a.L, divisor=S.divisor, dlimit=span/divisor;
  const dmax=Math.abs(a.deflection?a.deflection.dmax:a.dmax), defOk=dmax<=dlimit;

  if(S.eccOn && S.loads.some(ld=>Math.abs(ld.e||0)>1e-9)) unsupported.push("Load eccentricity / torsion design is implemented for the EC3 code path only; switch Design code to EC3.");
  const utils=[
    {name:"Shear  Fv/Pv",val:Fv/Pv},
    {name:"Bending  Mx/Mrx",val:localUtil},
    {name: sec.isBox? "Mx/Mcx":"LTB  mLT.Mx/Mb", val:ltbUtil},
    {name:"Buckling (in-plane)",val:u1},
    {name:"Buckling (LTB interaction)",val:u2},
    {name:"Deflection",val:dmax/dlimit},
  ];
  if(Math.abs(F)>1e-9) utils.push({name:F<0?'Tension  Ft/Pt':'Compression cross-section  Fc/(Ag.py)',val:Math.abs(F)/(F<0?Pz:Ag*py/1000)});
  let gov=utils[0]; utils.forEach(u=>{ if(u.val>gov.val) gov=u; });
  const pass=unsupported.length===0 && utils.every(u=>u.val<=1.0001);

  return {eps,cl,clsName,unsupported,advisory,bTBS:bT_BS,Av,Pv,Fv,lowShear,shearBuckle,Mcx,hsNote,Zx,Sx,rhsFlag,
    Ag,Anet,Ke,Ae,Pz,F,n,Srx,Mrx,Mx,localUtil,isCant,mLT,mx,mf,
    LE,lam,v,betaW,phiB,gammaPrime,lamLT,pb,lamL0,Mb,ltbUtil,a_robX,a_robY,pcx,pcy,Pc,Pcy,Fc,pyZx,u1,u2,
    span,divisor,dlimit,dmax,defOk,utils,gov,pass};
}

