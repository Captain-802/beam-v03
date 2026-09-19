/* ===========================================================================
   Warping-torsion finite-element solver for open sections
   (19 Sep 2026 gap closure, group G4; docs/COVERAGE_MATRIX.md section 5 item
   11, trigger 2.6 of docs/EC3_BEAM_TRIGGER_LIST.md)
   ---------------------------------------------------------------------------
   Governing equation (Vlasov, linear elastic, small twist - the equation
   behind the SCI P385 Appendix C closed forms):

       E I_w phi''''(x) - G I_T phi''(x) = m_t(x)

   phi  = twist [rad], x along the member [mm], m_t = applied torque per unit
   length [N.mm/mm] (positive in the same sense as phi). Internal actions:
       T(x)   = G I_T phi' - E I_w phi'''   total torque   [N.mm]
       T_t(x) = G I_T phi'                  St Venant part [N.mm]
       B(x)   = E I_w phi''                 bimoment       [N.mm2]
       T_w(x) = -E I_w phi'''               warping part   [N.mm]
   so that dT/dx = -m_t (a distributed torque decreases T, a point torque P
   at x_p gives T(x_p+) = T(x_p-) - P).

   Discretisation: two-node elements, DOFs (phi, phi') per node, cubic Hermite
   shape functions - exactly the element that js/08-mcr-eigen-patch.js uses
   for the lateral-torsional eigenproblem. Its kBend(EI, Le) and kTors(GJ,
   Le) matrices are private to that file's closure, so they are duplicated
   here as the two small pure functions torsionFeKBend / torsionFeKTors
   (identical entries; hand-checked in tests/torsion-fe.test.cjs):
       K_e = kBend(E I_w, Le) + kTors(G I_T, Le)
   Consistent nodal torques of a linearly varying m_t over an element (same
   integrals as the bending solver's distributed-load vector).

   Boundary conditions:
       every support         phi = 0 (twist prevented - fork / torsional
                             restraint, as P385 assumes at every support)
       warping free          phi'' = 0 (natural, nothing imposed) - default,
                             matching P385 fork ends
       warping fixed         phi' = 0 imposed (per-support option, or the
                             root of a cantilever: single fixed support)
       free end / tip        natural: T = 0 and B = 0 come out of the
                             assembled equilibrium exactly
       in-plane hinge        twist and warping continuous (a bending release
                             does not release twist)

   Stress recovery (per station):
       phi, phi'   nodal DOFs
       B           element end forces f = K_e d_e - f_eq,e (the consistent
                   flux; satisfies the natural conditions B = 0 at free and
                   fork ends exactly) averaged at interior nodes where B is
                   continuous. At an interior node whose phi' DOF is fixed
                   (warping restrained) the restraint applies a REACTION
                   BIMOMENT, so B jumps there exactly like T jumps at a point
                   torque: the node is reported as three stations with the
                   left element value at x - 0.01, the larger-magnitude side
                   at x and the right element value at x + 0.01 mm (averaging
                   across the jump under-reported the peak B_Ed and made the
                   mesh-convergence measure creep instead of converge;
                   19 Sep 2026 review finding)
       T           element end forces (nodal equilibrium exact); a node where
                   T jumps (point torque, interior support) is reported as
                   three stations x - 0.01, x, x + 0.01 mm like p385Solve
       phi''       B/(E I_w);  phi''' = (G I_T phi' - T)/(E I_w)
   The returned object has the shape of p385Solve's result ({xs, phi, p1, p2,
   p3, X}) so the P385 3.1.2 cross-section check, the V_pl,T,Rd sweep and
   the EN 1993-6 Annex A interaction consume it unchanged.

   Mesh convergence: solve with nSub and 2 nSub subdivisions, report the fine
   solution with meshError = the largest relative change of max|phi|,
   max|phi'| and max|B|; the caller blocks PASS above TORSION_FE_MESH_BLOCK.

   Units: L, x in mm; E I_w in N.mm4; G I_T in N.mm2; point torque P in N.mm;
   distributed torque w1, w2 in N.mm/mm (= N). Pure functions, no DOM.
   =========================================================================== */
const TORSION_FE_MESH_BLOCK = 0.005;     // 0.5 %: refuse to certify above this
const TORSION_FE_NSUB = 120;             // base subdivisions (doubled once)

function torsionFeKBend(EIw, Le){
  const c=EIw/(Le*Le*Le), L=Le, L2=Le*Le;
  return [[12*c, 6*L*c, -12*c, 6*L*c],[6*L*c, 4*L2*c, -6*L*c, 2*L2*c],
          [-12*c, -6*L*c, 12*c, -6*L*c],[6*L*c, 2*L2*c, -6*L*c, 4*L2*c]];
}
function torsionFeKTors(GIt, Le){
  const c=GIt/(30*Le), L=Le, L2=Le*Le;
  return [[36*c, 3*L*c, -36*c, 3*L*c],[3*L*c, 4*L2*c, -3*L*c, -L2*c],
          [-36*c, -3*L*c, 36*c, -3*L*c],[3*L*c, -L2*c, -3*L*c, 4*L2*c]];
}
/* Consistent nodal loads of a distributed torque varying linearly ta -> tb
   over an element of length Le (Hermite cubic shape functions). */
function torsionFeLoadVector(ta, tb, Le){
  return [Le*(7*ta+3*tb)/20, Le*Le*(3*ta+2*tb)/60, Le*(3*ta+7*tb)/20, -Le*Le*(2*ta+3*tb)/60];
}
/* Banded symmetric positive-definite solve (Cholesky) with half-bandwidth hb.
   K is stored as K[i][j - i + hb] for |j - i| <= hb. Diagonal scaling removes
   the phi / phi' unit disparity exactly as linsolve() does for the beam. */
function torsionFeBandSolve(K, F, hb){
  const n=F.length;
  const scale=new Float64Array(n);
  for(let i=0;i<n;i++){ const d=K[i][hb]; if(!(Number.isFinite(d)&&d>0)) throw new Error('Warping-torsion FE: singular stiffness (no twist restraint?)'); scale[i]=Math.sqrt(d); }
  const C=Array.from({length:n},()=>new Float64Array(hb+1));   // C[i][j-i+hb], j<=i
  for(let i=0;i<n;i++){
    const j0=Math.max(0,i-hb);
    for(let j=j0;j<=i;j++){
      let v=K[i][j-i+hb]/(scale[i]*scale[j]);
      const k0=Math.max(j0,j-hb);
      for(let k=k0;k<j;k++) v-=C[i][k-i+hb]*C[j][k-j+hb];
      if(i===j){ if(!(Number.isFinite(v)&&v>1e-14)) throw new Error('Warping-torsion FE: stiffness matrix is not positive definite (mechanism or ill-conditioned mesh)'); C[i][hb]=Math.sqrt(v); }
      else C[i][j-i+hb]=v/C[j][hb];
    }
  }
  const y=new Float64Array(n), z=new Float64Array(n);
  for(let i=0;i<n;i++){ let v=F[i]/scale[i]; for(let j=Math.max(0,i-hb);j<i;j++) v-=C[i][j-i+hb]*y[j]; y[i]=v/C[i][hb]; }
  for(let i=n-1;i>=0;i--){ let v=y[i]; for(let j=i+1;j<=Math.min(n-1,i+hb);j++) v-=C[j][i-j+hb]*z[j]; z[i]=v/C[i][hb]; }
  return Array.from(z,(v,i)=>v/scale[i]);
}
/* Effective support list for the torsion model: every support prevents twist;
   warpFix = the per-support option, or automatically the root of a cantilever
   (a single fixed support). Positions in mm. */
function torsionFeSupports(supports){
  const root = supports.length===1;
  return supports.map(s=>({pos:+s.pos, warpFix: root || !!s.warpFix, root}));
}
/* Printed description of the boundary conditions (pure). */
function torsionFeBcText(supports, L){
  const m=v=>(v/1000).toFixed(2).replace(/\.?0+$/,'');
  const sp=torsionFeSupports(supports);
  if(sp.length===1) return 'cantilever: root at x = '+m(sp[0].pos)+' m with &phi; = 0 and &phi;&prime; = 0 (warping fixed), free tip (T = B = 0)';
  const items=sp.map(s=>'x = '+m(s.pos)+' m ('+(s.warpFix? '&phi; = 0, &phi;&prime; = 0: warping fixed' : 'fork, &phi; = 0, warping free')+')');
  const ends=[];
  if(sp[0].pos>1e-6) ends.push('free end at x = 0');
  if(L-sp[sp.length-1].pos>1e-6) ends.push('free end at x = '+m(L)+' m');
  return 'supports '+items.join(', ')+(ends.length? '; '+ends.join(', ') : '');
}
/* One solve on a mesh of nSub base subdivisions. Returns nodal DOFs and the
   element end forces; see torsionFeRecover for the station values. */
function torsionFeSolveOnce(L, EIw, GIt, supports, torques, nSub){
  const sp=torsionFeSupports(supports);
  const nodes=buildNodes(L, sp, torques, nSub);
  const nN=nodes.length, nd=2*nN, hb=3;
  const idx=new Map(nodes.map((x,i)=>[+x.toFixed(6),i]));
  const K=Array.from({length:nd},()=>new Float64Array(2*hb+1));
  const F=new Float64Array(nd);
  const add=(i,j,v)=>{ K[i][j-i+hb]+=v; };
  const feq=[];   // per element consistent load vector (for the end-force recovery)
  for(let e=0;e<nN-1;e++){
    const Le=nodes[e+1]-nodes[e];
    const kb=torsionFeKBend(EIw,Le), kt=torsionFeKTors(GIt,Le);
    const d=[2*e,2*e+1,2*e+2,2*e+3];
    for(let a=0;a<4;a++) for(let b=0;b<4;b++) add(d[a],d[b],kb[a][b]+kt[a][b]);
    feq.push([0,0,0,0]);
  }
  const nodalP=new Float64Array(nN);
  torques.forEach(ld=>{
    if(ld.type==='point'){ const i=idx.get(+(+ld.pos).toFixed(6)); if(i!=null){ F[2*i]+=ld.P; nodalP[i]+=ld.P; } }
    else if(ld.type==='udl'){
      for(let e=0;e<nN-1;e++){ const xa=nodes[e],xb=nodes[e+1];
        if(xb<=ld.x1+1e-9||xa>=ld.x2-1e-9) continue; const Le=xb-xa;
        const tv=x=>{ if(ld.x2===ld.x1) return ld.w1; const s=(x-ld.x1)/(ld.x2-ld.x1); return ld.w1+(ld.w2-ld.w1)*s; };
        const fv=torsionFeLoadVector(tv(xa),tv(xb),Le);
        for(let a=0;a<4;a++){ F[2*e+a]+=fv[a]; feq[e][a]+=fv[a]; }
      }
    }
  });
  // unconstrained copy for the reactions
  const K0=K.map(r=>Float64Array.from(r)), F0=Float64Array.from(F);
  const fixed=[];
  sp.forEach(s=>{ const i=idx.get(+(+s.pos).toFixed(6)); if(i==null) return; fixed.push(2*i); if(s.warpFix) fixed.push(2*i+1); });
  if(!fixed.length) throw new Error('Warping-torsion FE: no support prevents twist');
  fixed.forEach(r=>{
    for(let k=0;k<2*hb+1;k++){ const c=r+k-hb; if(c<0||c>=nd) continue; K[r][k]=0; K[c][r-c+hb]=0; }
    K[r][hb]=1; F[r]=0;
  });
  const d=torsionFeBandSolve(K,F,hb);
  // reactions R = K0 d - F0 at the constrained DOFs (torque; bimoment when warping is fixed)
  const R=new Float64Array(nd);
  fixed.forEach(r=>{ let s=0; for(let k=0;k<2*hb+1;k++){ const c=r+k-hb; if(c>=0&&c<nd) s+=K0[r][k]*d[c]; } R[r]=s-F0[r]; });
  // element end forces f = K_e d_e - f_eq: [-T(x1), -B(x1), T(x2), B(x2)]
  const ef=[];
  for(let e=0;e<nN-1;e++){
    const Le=nodes[e+1]-nodes[e];
    const kb=torsionFeKBend(EIw,Le), kt=torsionFeKTors(GIt,Le);
    const de=[d[2*e],d[2*e+1],d[2*e+2],d[2*e+3]];
    const f=[0,0,0,0];
    for(let a=0;a<4;a++){ let s=0; for(let b=0;b<4;b++) s+=(kb[a][b]+kt[a][b])*de[b]; f[a]=s-feq[e][a]; }
    ef.push({TL:-f[0], BL:-f[1], TR:f[2], BR:f[3]});
  }
  const reactions=sp.map(s=>{ const i=idx.get(+(+s.pos).toFixed(6)); return {pos:s.pos, warpFix:s.warpFix, T:i!=null? R[2*i]:0, B:(i!=null&&s.warpFix)? R[2*i+1]:0}; });
  const nodeOf=s=>idx.get(+(+s.pos).toFixed(6));
  return {nodes,d,ef,nodalP,reactions,nElem:nN-1,
    supportNodes:new Set(sp.map(nodeOf).filter(i=>i!=null)),
    warpNodes:new Set(sp.filter(s=>s.warpFix).map(nodeOf).filter(i=>i!=null))};   // phi' fixed: B jumps by the reaction bimoment
}
/* Station values from one solve (see the header for the recovery rules). */
function torsionFeRecover(sol, EIw, GIt){
  const {nodes,d,ef,nodalP,supportNodes}=sol, warpNodes=sol.warpNodes||new Set();
  const nN=nodes.length;
  const xs=[],phi=[],p1=[],p2=[],p3=[],T=[],B=[];
  const push=(x,ph,dph,Bv,Tv)=>{ xs.push(x); phi.push(ph); p1.push(dph); B.push(Bv); T.push(Tv); p2.push(Bv/EIw); p3.push((GIt*dph-Tv)/EIw); };
  for(let i=0;i<nN;i++){
    const x=nodes[i], ph=d[2*i], dph=d[2*i+1];
    const left = i>0? ef[i-1] : null, right = i<nN-1? ef[i] : null;
    // B is continuous at an ordinary interior node (average the two element
    // values); at an interior warping-fixed node the reaction bimoment makes
    // B jump, so the one-sided element values are kept (larger magnitude at x)
    const bJump = !!(left&&right && warpNodes.has(i));
    const BLv = left? left.BR : null, BRv = right? right.BL : null;
    const Bv = bJump? (Math.abs(BLv)>=Math.abs(BRv)? BLv : BRv) : (left&&right? 0.5*(BLv+BRv) : (left? BLv : BRv));
    const TLv = left? left.TR : null, TRv = right? right.TL : null;
    const jump = (left&&right && (Math.abs(nodalP[i])>1e-9 || supportNodes.has(i))) || bJump;
    if(jump){
      if(x-0.01>xs[xs.length-1]) push(x-0.01, ph, dph, bJump? BLv : Bv, TLv);
      push(x, ph, dph, Bv, Math.abs(TLv)>=Math.abs(TRv)? TLv : TRv);
      push(x+0.01, ph, dph, bJump? BRv : Bv, TRv);
    } else push(x, ph, dph, Bv, TLv!=null? TLv : TRv);
  }
  return {xs,phi,p1,p2,p3,T,B};
}
function torsionFeMax(arr){ let m=0; arr.forEach(v=>{ if(Math.abs(v)>m) m=Math.abs(v); }); return m; }
/* Public entry. opts = {L, EIw, GIt, supports:[{pos (mm), warpFix?}], torques:
   [{type:'point', pos, P} | {type:'udl', x1, x2, w1, w2}], nSub?, refine?}.
   Returns the fine-mesh solution in p385Solve's shape plus T (total torque),
   B (bimoment), reactions, nElem, nElemCoarse, meshError, meshErrorParts,
   converged, X = L/a, bc (support list), method label. */
function warpingTorsionFE(opts){
  const {L,EIw,GIt,supports,torques}=opts;
  if(!(L>0)) throw new Error('Warping-torsion FE: L must be > 0');
  if(!(EIw>0)) throw new Error('Warping-torsion FE: E I_w must be > 0');
  if(!(GIt>0)) throw new Error('Warping-torsion FE: G I_T must be > 0');
  const nSub=opts.nSub||TORSION_FE_NSUB;
  const refine=opts.refine!==false;
  const coarse=torsionFeSolveOnce(L,EIw,GIt,supports,torques,nSub);
  const rc=torsionFeRecover(coarse,EIw,GIt);
  let fine=coarse, rf=rc, meshError=0, parts={phi:0,p1:0,B:0};
  if(refine){
    fine=torsionFeSolveOnce(L,EIw,GIt,supports,torques,2*nSub);
    rf=torsionFeRecover(fine,EIw,GIt);
    const rel=(a,b)=>{ const m=torsionFeMax(b); return m>1e-300? Math.abs(torsionFeMax(a)-m)/m : 0; };
    parts={phi:rel(rc.phi,rf.phi), p1:rel(rc.p1,rf.p1), B:rel(rc.B,rf.B)};
    meshError=Math.max(parts.phi,parts.p1,parts.B);
  }
  const aa=Math.sqrt(EIw/GIt);
  return Object.assign({},rf,{X:L/aa, aa, nElem:fine.nElem, nElemCoarse:coarse.nElem, meshError, meshErrorParts:parts,
    converged:meshError<=TORSION_FE_MESH_BLOCK, reactions:fine.reactions, bc:torsionFeSupports(supports),
    method:'fe', methodLabel:'warping-torsion FE ('+fine.nElem+' elements)'});
}
