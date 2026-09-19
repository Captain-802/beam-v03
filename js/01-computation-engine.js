/* ===========================================================================
   1. COMPUTATION ENGINE  (validated against closed-form solutions)
   Units throughout the solver: mm, N, N mm, N/mm.  Up = positive.
   =========================================================================== */
function linsolve(A,b){
  // Both callers solve restrained, symmetric stiffness matrices. Diagonal
  // scaling removes the translation/rotation unit disparity; Cholesky then
  // detects mechanisms, including hinge layouts that pass a restraint count.
  const n=b.length, scale=A.map((r,i)=>Math.sqrt(r[i]));
  const fail=()=>{ throw new Error('Singular or unstable stiffness matrix (mechanism or numerically ill-conditioned layout). Check supports, hinges and closely spaced nodes.'); };
  if(scale.some(s=>!Number.isFinite(s)||s<=0)||b.some(v=>!Number.isFinite(v))) fail();
  const C=Array.from({length:n},()=>new Float64Array(n));
  for(let i=0;i<n;i++) for(let j=0;j<=i;j++){
    let v=A[i][j]/scale[i]/scale[j];
    for(let k=0;k<j;k++) v-=C[i][k]*C[j][k];
    if(i===j){ if(!Number.isFinite(v)||v<=1e-12) fail(); C[i][j]=Math.sqrt(v); }
    else C[i][j]=v/C[j][j];
  }
  const y=new Float64Array(n), z=new Float64Array(n);
  for(let i=0;i<n;i++){ let v=b[i]/scale[i]; for(let j=0;j<i;j++) v-=C[i][j]*y[j]; y[i]=v/C[i][i]; }
  for(let i=n-1;i>=0;i--){ let v=y[i]; for(let j=i+1;j<n;j++) v-=C[j][i]*z[j]; z[i]=v/C[i][i]; }
  return Array.from(z,(v,i)=>v/scale[i]);
}
function buildNodes(L,supports,loads,nSub,extra){
  const pts=new Set([0,L]);
  supports.forEach(s=>pts.add(+s.pos));
  (extra||[]).forEach(x=>{ if(Number.isFinite(+x)) pts.add(+x); });   // e.g. internal-hinge positions
  loads.forEach(ld=>{ if(ld.type==='point'||ld.type==='moment') pts.add(+ld.pos);
    else {pts.add(+ld.x1); pts.add(+ld.x2);} });
  const P=[...pts].filter(x=>x>=0&&x<=L).sort((a,b)=>a-b);
  const step=L/nSub; let nodes=[];
  for(let i=0;i<P.length-1;i++){ const a=P[i],b=P[i+1];
    const ns=Math.max(1,Math.ceil((b-a)/step));
    for(let k=0;k<ns;k++) nodes.push(a+(b-a)*k/ns); }
  nodes.push(P[P.length-1]);
  nodes=[...new Set(nodes.map(x=>+x.toFixed(6)))].sort((a,b)=>a-b);
  return nodes;
}
function solveBeam(L,EI,supports,loads,nSub=120,hinges){
  // A zero-energy displacement is piecewise linear across moment releases.
  // Check its restraint matrix directly: finite round-off in a large FE matrix
  // can otherwise disguise an exact mechanism as a very flexible stable beam.
  const releases=[...new Set((hinges||[]).filter(x=>x>0&&x<L))].sort((a,b)=>a-b);
  const basis=x=>[1,x/L,...releases.map(h=>Math.max(0,(x-h)/L))];
  const rows=[];
  supports.forEach(s=>{ rows.push(basis(s.pos)); if(s.type==='fixed') rows.push([0,1,...releases.map(h=>s.pos>h?1:0)]); });
  let rank=0;
  for(let col=0;col<releases.length+2;col++){
    let pivot=rank;
    for(let j=rank;j<rows.length;j++) if(Math.abs(rows[j][col])>Math.abs(rows[pivot][col])) pivot=j;
    if(pivot>=rows.length||Math.abs(rows[pivot][col])<1e-10) continue;
    [rows[rank],rows[pivot]]=[rows[pivot],rows[rank]];
    const div=rows[rank][col]; rows[rank]=rows[rank].map(v=>v/div);
    for(let j=rank+1;j<rows.length;j++){ const v=rows[j][col]; for(let k=col;k<rows[j].length;k++) rows[j][k]-=v*rows[rank][k]; }
    rank++;
  }
  if(rank<releases.length+2) throw new Error('Unstable beam mechanism: supports do not restrain every segment separated by internal hinges.');
  // Internal hinges = major-axis (in-plane) MOMENT RELEASES. At a hinge node the
  // two adjacent elements get INDEPENDENT rotation DOFs (sharing the translation),
  // so the transmitted bending moment is zero and the slope is discontinuous; the
  // BMD/deflection redistribute. With no hinges the DOF numbering is identical to
  // the classic 2-DOF-per-node scheme (wDof[i]=2i, thDof[i]=2i+1), so results are
  // byte-identical to before. Lateral/torsional continuity is NOT affected here
  // (that lives in the Mcr eigensolver, which reads the redistributed BMD).
  const hp=(hinges||[]).map(x=>+(+x).toFixed(6));
  const nodes=buildNodes(L,supports,loads,nSub,hp);
  const nN=nodes.length;
  const idx=new Map(nodes.map((x,i)=>[+x.toFixed(6),i]));
  const hingeNode=new Set();
  hp.forEach(x=>{ const i=idx.get(+x.toFixed(6)); if(i!=null && i>0 && i<nN-1) hingeNode.add(i); });
  // DOF layout: one translation per node; one shared rotation per node, except
  // hinge nodes which get a left rotation and a right rotation.
  const wDof=new Array(nN), thDof=new Array(nN), thL=new Array(nN), thR=new Array(nN);
  let nd=0;
  for(let i=0;i<nN;i++){ wDof[i]=nd++; if(hingeNode.has(i)){ thL[i]=nd++; thR[i]=nd++; } else { thDof[i]=nd++; } }
  const ndof=nd;
  const rotR=i=> hingeNode.has(i)? thR[i] : thDof[i];   // rotation seen by the element to the RIGHT of node i
  const rotL=i=> hingeNode.has(i)? thL[i] : thDof[i];   // rotation seen by the element to the LEFT  of node i
  const K=Array.from({length:ndof},()=>new Array(ndof).fill(0));
  const F=new Array(ndof).fill(0);
  for(let e=0;e<nN-1;e++){
    const Le=nodes[e+1]-nodes[e], c=EI/(Le*Le*Le);
    const k=[[12,6*Le,-12,6*Le],[6*Le,4*Le*Le,-6*Le,2*Le*Le],
             [-12,-6*Le,12,-6*Le],[6*Le,2*Le*Le,-6*Le,4*Le*Le]];
    const d=[wDof[e], rotR(e), wDof[e+1], rotL(e+1)];
    for(let a=0;a<4;a++) for(let b=0;b<4;b++) K[d[a]][d[b]]+=k[a][b]*c;
  }
  loads.forEach(ld=>{
    if(ld.type==='point'){ const i=idx.get(+(+ld.pos).toFixed(6)); if(i!=null) F[wDof[i]]+=ld.P; }
    else if(ld.type==='moment'){ const i=idx.get(+(+ld.pos).toFixed(6)); if(i!=null) F[rotR(i)]+=ld.M; }
    else if(ld.type==='udl'){
      for(let e=0;e<nN-1;e++){ const xa=nodes[e],xb=nodes[e+1];
        if(xb<=ld.x1+1e-9||xa>=ld.x2-1e-9) continue; const Le=xb-xa;
        const wv=x=>{ if(ld.x2===ld.x1) return ld.w1; const t=(x-ld.x1)/(ld.x2-ld.x1); return ld.w1+(ld.w2-ld.w1)*t; };
        const wa=wv(xa),wb=wv(xb), d=[wDof[e], rotR(e), wDof[e+1], rotL(e+1)];
        F[d[0]]+=Le*(7*wa+3*wb)/20; F[d[1]]+=Le*Le*(3*wa+2*wb)/60;
        F[d[2]]+=Le*(3*wa+7*wb)/20; F[d[3]]+=-Le*Le*(2*wa+3*wb)/60;
      }
    }
  });
  const fixed=new Set();
  supports.forEach(s=>{ const i=idx.get(+(+s.pos).toFixed(6)); if(i==null) return;
    fixed.add(wDof[i]); if(s.type==='fixed') fixed.add(rotR(i)); });
  const free=[]; for(let d=0;d<ndof;d++) if(!fixed.has(d)) free.push(d);
  const Kff=free.map(r=>free.map(c=>K[r][c])), Ff=free.map(r=>F[r]);
  const df=linsolve(Kff,Ff), d=new Array(ndof).fill(0);
  free.forEach((dof,j)=>d[dof]=df[j]);
  const R=new Array(ndof).fill(0);
  for(let i=0;i<ndof;i++){ let s=0; for(let j=0;j<ndof;j++) s+=K[i][j]*d[j]; R[i]=s-F[i]; }
  const reactions=supports.map(s=>{ const i=idx.get(+(+s.pos).toFixed(6));
    return {pos:s.pos,type:s.type,V:i!=null?R[wDof[i]]:0,M:(s.type==='fixed'&&i!=null)?R[rotR(i)]:0}; });
  const w=nodes.map((_,i)=>d[wDof[i]]);
  return {nodes,w,reactions};
}
function sfdBmd(L,supports,loads,reactions,N=1000){
  const PF=[],PM=[];
  reactions.forEach(r=>{ PF.push([r.pos,r.V]); if(r.type==='fixed') PM.push([r.pos,-r.M]); });
  // Applied point moments: with the solver's reaction convention (verified: R1=+M/L up,
  // V=+M/L), a ccw-positive applied moment REDUCES the sagging BM as x crosses it -
  // the diagram must close to zero at a pin. The previous +ld.M sign left the BMD
  // non-closing (M(L) = M instead of 0) for every applied-moment case; fixed-support
  // reaction moments (-r.M above) were and remain correct (fixed-fixed closures verified).
  loads.forEach(ld=>{ if(ld.type==='point') PF.push([ld.pos,ld.P]); else if(ld.type==='moment') PM.push([ld.pos,-ld.M]); });
  const crit=new Set([0,L]);
  PF.forEach(p=>{crit.add(p[0]-1e-4);crit.add(p[0]+1e-4);});
  PM.forEach(p=>{crit.add(p[0]-1e-4);crit.add(p[0]+1e-4);});
  loads.forEach(ld=>{ if(ld.type==='udl'){crit.add(ld.x1);crit.add(ld.x2);} });
  let grid=[]; for(let i=0;i<=N;i++) grid.push(L*i/N);
  grid=grid.concat([...crit].filter(x=>x>=0&&x<=L));
  grid=[...new Set(grid.map(x=>+x.toFixed(4)))].sort((a,b)=>a-b);
  const xs=[],V=[],M=[];
  grid.forEach(x=>{
    let v=0,m=0;
    PF.forEach(([p,f])=>{ if(p<=x+1e-9){ v+=f; m+=f*(x-p); } });
    PM.forEach(([p,mo])=>{ if(p<=x+1e-9) m+=mo; });
    loads.forEach(ld=>{ if(ld.type==='udl'){ const a=ld.x1,b=Math.min(ld.x2,x);
      if(b>a){ // exact closed-form integrals of the linear load (replaces the previous nn=40 trapezoid loop; makes triangular/trapezoidal BMD exact)
        const s=(ld.x2===ld.x1)?0:(ld.w2-ld.w1)/(ld.x2-ld.x1), u=b-a;
        const wA=(ld.x2===ld.x1)?ld.w1:ld.w1+s*(a-ld.x1);
        v+=wA*u+s*u*u/2;
        m+=wA*((x-a)*u-u*u/2)+s*((x-a)*u*u/2-u*u*u/3); } } });
    xs.push(x); V.push(v); M.push(m);
  });
  return {xs,V,M};
}
function pbFunc(lamLT,py,E){
  const lamL0=0.4*Math.sqrt(Math.PI*Math.PI*E/py);
  if(lamLT<=lamL0) return {pb:py,lamL0,pE:null,etaLT:0};
  const pE=Math.PI*Math.PI*E/(lamLT*lamLT);
  const etaLT=7*(lamLT-lamL0)/1000;
  const phiB=(py+(etaLT+1)*pE)/2;
  let pb=py*pE/(phiB+Math.sqrt(phiB*phiB-pE*py));
  return {pb:Math.min(pb,py),lamL0,pE,etaLT};
}
function pcFunc(lam,py,a,E){
  const lam0=0.2*Math.sqrt(Math.PI*Math.PI*E/py);
  if(lam<=lam0) return py;
  const pE=Math.PI*Math.PI*E/(lam*lam);
  const eta=a*(lam-lam0)/1000;
  const phi=(py+(eta+1)*pE)/2;
  return Math.min(py, py*pE/(phi+Math.sqrt(phi*phi-pE*py)));
}
function classify(bT,dt,eps,kind,opt){
  // BS 5950-1:2000 Table 11. Flange-outstand (rolled section) limit is common to
  // all open sections. The WEB limit differs by section type: a channel web has
  // its own flat 40e row for all three classes; an I/H web uses the "neutral
  // axis at mid-depth" row 80/100/120e for pure bending, or the "generally"
  // rows when axial COMPRESSION coexists (stress ratios per cl 3.5.5):
  //   Class 1: 80e/(1+r1),  Class 2: 100e/(1+1.5r1),  Class 3: 120e/(1+2r2),
  //   each but >= 40e;  r1 = Fc/(d t pyw) (-1 < r1 <= 1),  r2 = Fc/(Ag pyw).
  // At Fc = 0 these reduce exactly to 80/100/120e. Tension is conservatively
  // kept on the pure-bending row (relaxing limits for tension is not taken).
  const fc=bT<=9*eps?1:bT<=10*eps?2:bT<=15*eps?3:4;
  let wc, wlim=[80,100,120], webCase='bending', r1=null, r2=null;
  if(kind==='channel'){ wc = dt<=40*eps? 1 : 4; wlim=[40,40,40]; }
  else {
    if(opt && opt.Fc>0 && opt.dwt>0 && opt.Ag>0 && opt.py>0){
      r1=Math.min(opt.Fc/(opt.dwt*opt.py),1);
      r2=opt.Fc/(opt.Ag*opt.py);
      wlim=[Math.max(80/(1+r1),40), Math.max(100/(1+1.5*r1),40), Math.max(120/(1+2*r2),40)];
      webCase='bending+compression';
    }
    wc = dt<=wlim[0]*eps?1:dt<=wlim[1]*eps?2:dt<=wlim[2]*eps?3:4;
  }
  return {cls:Math.max(fc,wc),fc,wc,wlim,webCase,r1,r2};
}
function classifyBox(bt_flange,dt_web,eps,boxType){
  // BS 5950-1:2000 Table 12   box sections have SEPARATE flange (compression
  // due to bending, uses b) and web (neutral axis at mid-depth, uses d) rows.
  // For a square SHS the two ratios are numerically equal, so the flange row
  // (lower limits) always governs   this generalisation is fully backward
  // compatible with that case while correctly handling a true RHS (h != b).
  const flim = boxType==='CF'? [26,28,35]   : [28,32,40];
  const wlim = boxType==='CF'? [56,70,105]  : [64,80,120];
  const fc = bt_flange<=flim[0]*eps?1: bt_flange<=flim[1]*eps?2: bt_flange<=flim[2]*eps?3:4;
  const wc = dt_web<=wlim[0]*eps?1: dt_web<=wlim[1]*eps?2: dt_web<=wlim[2]*eps?3:4;
  return {cls:Math.max(fc,wc), fc, wc, flim, wlim};
}

/* ===========================================================================
   EUROCODE 3 (EN 1993-1-1 + UK National Annex) DESIGN FUNCTIONS
   Parallel to the BS5950 set above   same solver/diagrams feed both codes;
   only the cross-section/member checks differ. epsilon uses 235 (not 275).
   =========================================================================== */
function epsEC3(fy){ return Math.sqrt(235/fy); }

function classifyEC3(sec,eps,opt){
  // Table 5.2: box sections get flange="internal, compression" (33/38/42e) and
  // web="internal, bending" (72/83/124e). Open sections (I/H/channel) get
  // outstand flange (9/10/14e) and internal web, bending (72/83/124e)   EC3
  // does not carve out a separate channel-web row the way BS5950 Table 11 does.
  //
  // With coexistent axial COMPRESSION (opt.NEd in N, opt.fy in N/mm2) the web
  // must be classified as "internal part in bending and compression":
  //   Class 1: 396e/(13a-1) for a>0.5, 36e/a otherwise
  //   Class 2: 456e/(13a-1) for a>0.5, 41.5e/a otherwise
  //   Class 3: 42e/(0.67+0.33psi) for psi>-1
  // a from the plastic stress block with the web(s) conservatively carrying all
  // of N_Ed; psi from the conservative elastic form psi = 2N_Ed/(A f_y) - 1.
  // At N_Ed = 0 these reduce exactly to 72e / 82.9e / 124e, i.e. continuous
  // with the pure-bending row. Tension is conservatively ignored (kept at the
  // pure-bending limits, which are the tighter choice for a partly tensioned web).
  const flim = sec.isBox? [33,38,42] : [9,10,14];
  let wlim=[72,83,124], webCase='bending', alphaW=null, psiW=null;
  const NEd = (opt && opt.NEd>0)? opt.NEd : 0;
  if(NEd>0 && opt.fy>0){
    const twc = sec.tw||sec.tf;                 // box normalisation sets tw = t
    const nWeb = sec.isBox? 2 : 1;
    const cw = sec.dt*twc;                      // web flat depth c, mm
    alphaW = Math.min(0.5*(1 + NEd/(nWeb*cw*twc*opt.fy)), 1);
    psiW = Math.min(2*NEd/((sec.A*1e2)*opt.fy) - 1, 1);
    const l1 = alphaW>0.5? 396/(13*alphaW-1) : 36/alphaW;
    const l2 = alphaW>0.5? 456/(13*alphaW-1) : 41.5/alphaW;
    const l3 = psiW>-1? 42/(0.67+0.33*psiW) : 62*(1-psiW)*Math.sqrt(-psiW);
    wlim=[l1,l2,l3]; webCase='bending+compression';
  }
  let mzFlange=null;
  if(opt&&opt.minorBending){
    if(sec.kind==='I'){
      // I/H under M_z (19 Sep 2026 gap closure, item 1.9(b)): the web lies on the
      // z-z axis, so an applied M_z does not stress it - the web keeps its y-y
      // bending (+N) limits above. The flanges are outstands under the combined
      // stress: the outstand compressed by M_z has both its root and its tip in
      // compression (alpha = 1), for which Table 5.2 sheet 2 gives 9e/alpha,
      // 10e/alpha and 21e sqrt(k_sigma) with k_sigma >= 0.43 (EN 1993-1-5 Table
      // 4.2), i.e. never stricter than the uniform-compression bound 9e/10e/14e
      // already applied to flim; the opposite outstand (tip relieved by M_z) has
      // laxer limits and never governs. The uniform-compression bound is kept.
      mzFlange='outstand';
    } else {
      // Channels and hollow sections: a wall parallel to the web is compressed
      // over its full width by M_z - conservative uniform-compression bound.
      wlim=[33,38,42]; webCase='biaxial: uniform-compression web bound'; mzFlange='uniform-bound';
    }
  }
  const fc = sec.bT<=flim[0]*eps?1:sec.bT<=flim[1]*eps?2:sec.bT<=flim[2]*eps?3:4;
  const wc = sec.dt<=wlim[0]*eps?1:sec.dt<=wlim[1]*eps?2:sec.dt<=wlim[2]*eps?3:4;
  return {cls:Math.max(fc,wc),fc,wc,flim,wlim,webCase,alphaW,psiW,mzFlange};
}

function avEC3(sec){
  // EC3 cl 6.2.6(3) shear area, mm^2. Box: Av=A.D/(D+B), verified against the
  // verified commercial-software SHS example (collapses to A/2 for a square section, same as
  // the BS5950 rule). Channel/I-H formulas verified to ~98% against the PFC
  // example (residual gap likely a small area-rounding difference between the
  // BS5950-table and EC3-table figures for the same physical section).
  const A=sec.A*100;
  if(sec.isBox) return A*sec.D/(sec.D+sec.B);
  if(sec.kind==='channel') return A-2*sec.B*sec.tf+(sec.tw+sec.r)*sec.tf;
  const hw=sec.D-2*sec.tf;
  return Math.max(A-2*sec.B*sec.tf+(sec.tw+2*sec.r)*sec.tf, 1.2*hw*sec.tw);
}

// C1 for end-moment loading (linear gradient), psi = ratio of end moments.
// Source: SCI P360 Table 2.4 / Blue Book EC3 explanatory notes Table (8.1)  
// these are the precise published values (a fraction more refined than the
// older NCCI SN003 figures, e.g. ?=0.75?1.17 not 1.14; ?=-1.00?2.76, properly
// monotonic, not the 2.55 sometimes mis-cited).
const C1_END_MOMENT=[[1.00,1.00],[0.75,1.17],[0.50,1.36],[0.25,1.56],[0,1.77],[-0.25,2.00],[-0.50,2.24],[-0.75,2.49],[-1.00,2.76]];
// ---- NCCI SN006a-EN-EU: elastic critical moment of cantilevers ----
// Mcr = C * Mcr0;  Mcr0 = (pi/L)*sqrt(E*Iz*G*It);  kwt = (1/L)*sqrt(E*Iw/(G*It));
// eta = za/(hs/2), hs = h - tf (doubly symmetric I/H); +eta destabilising.
// C from Tables 3.1 (UDL q), 3.2 (tip point F), 3.3 (tip moment); warping at
// the support free or restrained. q+F combos by Eq (7). Values verbatim.
const SN006={
 eta:[-2,-1.5,-1,-0.5,0,0.25,0.5,0.75,1,1.25,1.5,2,2.5,3],
 kwt:[0,0.05,0.1,0.15,0.2,0.3,0.4,0.6,0.8,1],
 q:{free:[
  [2.04,2.04,2.04,2.04,2.04,2.04,2.04,2.04,2.04,2.04,2.04,2.04,2.04,2.04],
  [2.42,2.34,2.25,2.16,2.06,2.02,1.97,1.92,1.87,1.82,1.77,1.67,1.58,1.49],
  [2.87,2.71,2.53,2.34,2.13,2.03,1.92,1.82,1.71,1.61,1.52,1.35,1.20,1.07],
  [3.37,3.14,2.87,2.56,2.22,2.05,1.87,1.71,1.56,1.42,1.30,1.09,0.93,0.81],
  [3.93,3.62,3.25,2.82,2.32,2.06,1.82,1.60,1.41,1.25,1.12,0.91,0.76,0.65],
  [5.13,4.67,4.11,3.39,2.50,2.06,1.69,1.39,1.17,0.99,0.86,0.68,0.55,0.47],
  [6.40,5.79,5.04,4.02,2.66,2.02,1.54,1.21,0.98,0.81,0.70,0.54,0.43,0.36],
  [9.07,8.16,7.04,5.38,2.88,1.85,1.26,0.92,0.72,0.59,0.50,0.38,0.30,0.25],
  [11.8,10.6,9.11,6.82,3.00,1.65,1.03,0.73,0.56,0.46,0.38,0.29,0.23,0.19],
  [14.6,13.1,11.2,8.30,3.08,1.47,0.87,0.61,0.46,0.37,0.31,0.23,0.19,0.16]],
 restr:[
  [2.04,2.04,2.04,2.04,2.04,2.04,2.04,2.04,2.04,2.04,2.04,2.04,2.04,2.04],
  [2.81,2.71,2.61,2.50,2.39,2.33,2.27,2.21,2.15,2.09,2.04,1.92,1.81,1.70],
  [3.76,3.55,3.33,3.07,2.80,2.65,2.51,2.36,2.22,2.08,1.95,1.72,1.52,1.35],
  [4.80,4.50,4.15,3.72,3.23,2.97,2.71,2.47,2.23,2.03,1.84,1.54,1.31,1.13],
  [5.91,5.51,5.03,4.42,3.68,3.28,2.89,2.53,2.22,1.96,1.74,1.40,1.17,1.00],
  [8.22,7.63,6.91,5.93,4.57,3.82,3.14,2.59,2.16,1.84,1.59,1.24,1.02,0.86],
  [10.6,9.82,8.87,7.52,5.45,4.29,3.32,2.62,2.13,1.78,1.52,1.17,0.95,0.79],
  [15.5,14.3,12.9,10.8,7.15,5.10,3.65,2.74,2.17,1.78,1.51,1.15,0.92,0.77],
  [20.4,18.9,17.0,14.2,8.85,5.92,4.05,2.98,2.33,1.90,1.60,1.22,0.98,0.82],
  [25.4,23.5,21.1,17.6,10.6,6.80,4.54,3.30,2.57,2.09,1.76,1.33,1.07,0.89]]},
 F:{free:[
  [1.27,1.27,1.27,1.27,1.27,1.27,1.27,1.27,1.27,1.27,1.27,1.27,1.27,1.27],
  [1.39,1.37,1.34,1.31,1.28,1.26,1.25,1.23,1.21,1.19,1.17,1.13,1.08,1.04],
  [1.52,1.48,1.43,1.37,1.30,1.27,1.23,1.18,1.14,1.10,1.05,0.96,0.87,0.79],
  [1.65,1.60,1.53,1.45,1.34,1.27,1.21,1.13,1.06,0.99,0.92,0.80,0.69,0.61],
  [1.80,1.74,1.66,1.54,1.38,1.28,1.18,1.07,0.97,0.88,0.80,0.67,0.56,0.49],
  [2.15,2.07,1.94,1.75,1.45,1.27,1.10,0.94,0.81,0.70,0.61,0.49,0.40,0.34],
  [2.54,2.44,2.27,1.99,1.52,1.24,1.00,0.81,0.67,0.56,0.49,0.38,0.31,0.26],
  [3.41,3.26,3.01,2.52,1.60,1.14,0.81,0.61,0.49,0.40,0.34,0.26,0.21,0.17],
  [4.33,4.14,3.81,3.09,1.65,1.02,0.67,0.49,0.38,0.31,0.26,0.20,0.16,0.13],
  [5.29,5.06,4.63,3.70,1.68,0.91,0.57,0.40,0.31,0.25,0.21,0.16,0.13,0.11]],
 restr:[
  [1.27,1.27,1.27,1.27,1.27,1.27,1.27,1.27,1.27,1.27,1.27,1.27,1.27,1.27],
  [1.55,1.52,1.49,1.45,1.42,1.40,1.37,1.35,1.33,1.31,1.28,1.24,1.19,1.14],
  [1.86,1.81,1.75,1.67,1.58,1.54,1.48,1.43,1.37,1.31,1.25,1.13,1.02,0.92],
  [2.20,2.13,2.04,1.93,1.77,1.68,1.58,1.47,1.36,1.26,1.16,0.99,0.85,0.74],
  [2.56,2.48,2.37,2.21,1.96,1.81,1.65,1.48,1.32,1.18,1.06,0.86,0.72,0.62],
  [3.36,3.26,3.10,2.82,2.35,2.03,1.72,1.44,1.21,1.04,0.90,0.71,0.58,0.49],
  [4.21,4.08,3.88,3.49,2.72,2.21,1.75,1.39,1.14,0.95,0.82,0.63,0.51,0.43],
  [5.99,5.82,5.52,4.90,3.46,2.53,1.84,1.39,1.10,0.91,0.77,0.59,0.47,0.40],
  [7.83,7.61,7.22,6.36,4.20,2.88,2.00,1.48,1.16,0.95,0.80,0.61,0.49,0.41],
  [9.69,9.43,8.94,7.84,4.98,3.27,2.21,1.62,1.26,1.03,0.86,0.66,0.53,0.44]]},
 M:{free:[0.50,0.50,0.50,0.51,0.51,0.52,0.53,0.54,0.54,0.54],
    restr:[0.50,0.50,0.50,0.51,0.52,0.55,0.59,0.68,0.80,0.93]}
};
function sn006C(tab,warp,kwt,eta){
  // bilinear interpolation; returns null outside the published ranges
  if(kwt<-1e-9||kwt>1+1e-9) return null;
  const K=SN006.kwt, T=SN006[tab][warp];
  let ki=0; while(ki<K.length-2 && kwt>K[ki+1]) ki++;
  const kf=(kwt-K[ki])/(K[ki+1]-K[ki]);
  if(tab==='M'){ return T[ki]+(T[ki+1]-T[ki])*Math.min(Math.max(kf,0),1); }
  const E2=SN006.eta;
  if(eta<E2[0]-1e-9||eta>E2[E2.length-1]+1e-9) return null;
  let ei=0; while(ei<E2.length-2 && eta>E2[ei+1]) ei++;
  const ef=(eta-E2[ei])/(E2[ei+1]-E2[ei]);
  const c1v=T[ki][ei]+(T[ki][ei+1]-T[ki][ei])*ef;
  const c2v=T[ki+1][ei]+(T[ki+1][ei+1]-T[ki+1][ei])*ef;
  return c1v+(c2v-c1v)*Math.min(Math.max(kf,0),1);
}
// ---- Serna et al. general C1 (SCI form, NSC Nov 2013, fork ends) ----
// C1 = sqrt( 35 Mmax^2 / (Mmax^2 + 9 M2^2 + 16 M3^2 + 9 M4^2) ).
// Note: the article's typeset equation omits the radical; restored here, as
// proven by its own worked examples (2.0 vs LTBeam 2.03; 1.1 vs 1.1) and by
// the uniform-moment limit C1 = 1.
function sernaC1(Mmax,M2,M3,M4){
  const d=Mmax*Mmax+9*M2*M2+16*M3*M3+9*M4*M4;
  if(d<=0) return 1.0;
  return Math.sqrt(35*Mmax*Mmax/d);
}
function c1FromPsi(psi){
  psi=Math.max(-1,Math.min(1,psi));
  for(let i=0;i<C1_END_MOMENT.length-1;i++){
    const [p1,v1]=C1_END_MOMENT[i],[p2,v2]=C1_END_MOMENT[i+1];
    if(psi<=p1+1e-9 && psi>=p2-1e-9){ const t=(p1-psi)/(p1-p2); return v1+(v2-v1)*t; }
  }
  return 1.77;
}
function computeC1(a,isCant){
  // Returns {C1, method}. Uses the exact published SCI/Blue Book C1 values for
  // the pure end-moment-gradient case. For transverse loading or the genuinely
  // combined case   significant end moment AND transverse load together   SCI P360 itself states this
  // needs either the graphical NCCI SN003 method or software (LTBeam), and
  // that "C1=1 is conservative" as the fallback; that is exactly what's used
  // here. Override below for a verified value (e.g. from LTBeam, or a
  // closed-form fit such as Lopez/Yong/Serna that some commercial software uses).
  if(isCant) return {C1:1.0, method:'cantilever   safe default (the published tables assume a beam between two restrained ends)'};
  const Mmax=Math.abs(a.Mmax);
  if(Mmax<1e-9) return {C1:1.0, method:'negligible moment'};
  const endLevel=Math.max(Math.abs(a.M0end),Math.abs(a.MLend))/Mmax;
  if(endLevel<0.02){
    return {C1:1.0, method:'transverse load with no significant end moment   conservative default C1=1.0 used; override only with a verified value for the exact loading/restraint case'};
  }
  const psi=a.MLend/(a.M0end||1e-9);
  const C1endOnly=c1FromPsi(psi);
  return {C1:1.0, method:`combined end-moment (?=${psi.toFixed(2)}, end-moment-only C1 would be ${C1endOnly.toFixed(2)}) + transverse load   SCI P360/NCCI SN003 give this case only as graphs or via software (LTBeam); "C1=1 is conservative" is SCI's own stated fallback, used here. Override below if you have a verified value (e.g. from LTBeam, or a closed-form fit such as Lopez/Yong/Serna)`};
}

function mcrEC3(sec,Le,E,fy,C1){
  // Simplified (zg=0) Mcr for doubly symmetric open sections with load through
  // the shear centre. PFC/channel design is blocked elsewhere unless a
  // channel-specific Mcr method is implemented.
  const G=E/2.6;
  const Iz=sec.Iy*1e4, It=sec.J*1e4, Iw=(sec.Iw||0)*1e12;
  const term1=(Math.PI*Math.PI*E*Iz)/(Le*Le);
  const inside=Iw/Iz + (Le*Le*G*It)/(Math.PI*Math.PI*E*Iz);
  return C1*term1*Math.sqrt(Math.max(inside,0));
}
function ltbCurveEC3(sec){
  // Table 6.5 (cl 6.3.2.3, rolled/equivalent welded sections). Rolled I-section
  // (h/b<=2): curve b; (h/b>2): curve c. Anything not explicitly listed
  // (channels, box   though box is LTB-exempt anyway) defaults to curve d.
  if(sec.kind==='I'){ const hb=sec.D/sec.B; return hb<=2?{alphaLT:0.34,curve:'b'}:{alphaLT:0.49,curve:'c'}; }
  return {alphaLT:0.76,curve:'d'};
}
function chiLTEC3(lamLT,alphaLT,lamLT0,beta){
  const Phi=0.5*(1+alphaLT*(lamLT-lamLT0)+beta*lamLT*lamLT);
  return Math.min(1/(Phi+Math.sqrt(Math.max(Phi*Phi-beta*lamLT*lamLT,1e-12))),1.0);
}
function strutCurveEC3(sec,axis){
  // Table 6.2 (buckling curve allocation for axial compression).
  if(sec.isBox) return sec.boxType==='CF'? {alpha:0.49,curve:'c'} : {alpha:0.21,curve:'a'};
  if(sec.kind==='channel') return {alpha:0.49,curve:'c'};
  const hb=sec.D/sec.B;
  if(hb>1.2){ // rolled I-section
    if(sec.tf<=40) return axis==='y'?{alpha:0.21,curve:'a'}:{alpha:0.34,curve:'b'};
    return axis==='y'?{alpha:0.34,curve:'b'}:{alpha:0.49,curve:'c'};
  }
  // rolled H-section
  if(sec.tf<=100) return axis==='y'?{alpha:0.34,curve:'b'}:{alpha:0.49,curve:'c'};
  return {alpha:0.76,curve:'d'};
}
function chiStrutEC3(lamBar,alpha){
  const Phi=0.5*(1+alpha*(lamBar-0.2)+lamBar*lamBar);
  return Math.min(1/(Phi+Math.sqrt(Math.max(Phi*Phi-lamBar*lamBar,1e-12))),1.0);
}

function interpAt(xs,ys,xq){
  if(xq<=xs[0]) return ys[0];
  if(xq>=xs[xs.length-1]) return ys[ys.length-1];
  for(let i=0;i<xs.length-1;i++) if(xq>=xs[i]&&xq<=xs[i+1]){
    const t=(xs[i+1]===xs[i])?0:(xq-xs[i])/(xs[i+1]-xs[i]); return ys[i]+(ys[i+1]-ys[i])*t; }
  return ys[ys.length-1];
}
function mFactors(M2,M3,M4,MmaxSigned,M24abs){
  const Mm=Math.abs(MmaxSigned);
  if(Mm<1e-9) return {mLT:1,mx:1,a2:0,a3:0,a4:0};
  const s=MmaxSigned>=0?1:-1, a2=s*M2,a3=s*M3,a4=s*M4;
  const mLT=Math.max(0.2+(0.15*a2+0.5*a3+0.15*a4)/Mm,0.44);
  const mx =Math.max(0.2+(0.1*a2+0.6*a3+0.1*a4)/Mm,0.8*M24abs/Mm);
  return {mLT,mx,a2,a3,a4};
}
