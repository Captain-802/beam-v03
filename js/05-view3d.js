/* ===========================================================================
   5C. 3D CONFIGURATION VIEW (opens in a new tab; self-contained canvas
   renderer - no external libraries, works offline and from the single-file
   build). The beam is rendered as a TRUE extruded section profile - the real
   outline including root fillets traced as arcs - with per-face Lambert
   lighting and mild perspective, so an I-section reads as rolled steel, a
   PFC shows its asymmetry and an RHS/SHS shows its rounded corners and
   hollow end faces. Supports, intermediate lateral restraints and loads
   (magnitude-scaled arrows, translucent UDL ribbons, bending-moment arcs,
   torsion lever ties at the true e / z_g offsets) complete the scene.
   Drag = rotate, wheel = zoom, shift/right-drag = pan.
   =========================================================================== */
function build3DProfile(sec){
  // Closed outline(s) in section coordinates (y across, z up), traced with
  // root-fillet arcs (4 segments each). The right-hand web fillets are built
  // once and mirrored, so the profile is exactly symmetric. Validated by
  // comparing the shoelace area of the outline against the tabulated A.
  const arc=(cy,cz,R,a0,a1,n)=>{ const p=[]; for(let k=1;k<=n;k++){ const a=a0+(a1-a0)*k/n;
    p.push([cy+R*Math.cos(a),cz+R*Math.sin(a)]); } return p; };
  const D=+sec.D||100, B=+sec.B||100, tw=+sec.tw||+sec.tf||6, tf=+sec.tf||+sec.tw||6, r=+sec.r||0;
  const hD=D/2, hB=B/2, hw=tw/2, PI=Math.PI;
  if(sec.isBox){
    const t=tf, Ro=Math.min(1.5*t,hB*0.9), Ri=Math.max(Math.min(1.0*t,hB-t-1),0.5);
    const rr=(hy,hz,R)=>[
      [hy-R,-hz],...arc(hy-R,-hz+R,R,-PI/2,0,4),
      [hy,hz-R],...arc(hy-R,hz-R,R,0,PI/2,4),
      [-hy+R,hz],...arc(-hy+R,hz-R,R,PI/2,PI,4),
      [-hy,-hz+R],...arc(-hy+R,-hz+R,R,PI,1.5*PI,4)
    ];
    return {outer:rr(hB,hD,Ro), inner:rr(hB-t,hD-t,Ri)};
  }
  if(sec.kind==='channel'){
    const x0=-(isFinite(+sec.x)? +sec.x : B*0.25);
    const pts=[[x0,-hD],[x0+B,-hD],[x0+B,-hD+tf]];
    if(r>0){ pts.push([x0+tw+r,-hD+tf],...arc(x0+tw+r,-hD+tf+r,r,1.5*PI,PI,4),
             [x0+tw,hD-tf-r],...arc(x0+tw+r,hD-tf-r,r,PI,PI/2,4)); }
    else pts.push([x0+tw,-hD+tf],[x0+tw,hD-tf]);
    pts.push([x0+B,hD-tf],[x0+B,hD],[x0,hD]);
    if(typeof pfcMirrored==='function' && pfcMirrored())
      return {outer:pts.map(p=>[-p[0],p[1]]), inner:null};
    return {outer:pts, inner:null};
  }
  // I / H: build the right-hand fillet runs, mirror them for the left side
  const rightLower = r>0? [[hw+r,-hD+tf],...arc(hw+r,-hD+tf+r,r,1.5*PI,PI,4)] : [[hw,-hD+tf]];
  const rightUpper = r>0? [[hw,hD-tf-r],...arc(hw+r,hD-tf-r,r,PI,PI/2,4)] : [[hw,hD-tf]];
  const mirror=seg=>seg.slice().reverse().map(p=>[-p[0],p[1]]);
  const outer=[[-hB,-hD],[hB,-hD],[hB,-hD+tf],
    ...rightLower,...rightUpper,
    [hB,hD-tf],[hB,hD],[-hB,hD],[-hB,hD-tf],
    ...mirror(rightUpper),...mirror(rightLower),
    [-hB,-hD+tf]];
  return {outer, inner:null};
}
function build3DScene(){
  const sec=activeSection();
  const geom=sectionViewGeometry(sec);
  const sc=sectionViewShearCentre(sec);
  const showZg = S.code==='EC3' && (S.restraint||'full')!=='full';
  const L=S.L*1000;
  const prof=build3DProfile(sec);
  // Type-coloured loads (point = red, UDL = blue, moment = green). Arrows land
  // at the true application point: lateral offset e from the shear centre, and
  // height z_g when the per-load load-height mode is active; otherwise they
  // bear on the top flange like a standard analysis-package view.
  const pl=typeof plateGeom==='function'? plateGeom(sec):null;
  const zTop=(+sec.D||100)/2+(pl&&pl.side==='top'? pl.t:0);   // loads bear on a top plate when present
  const loads=[];
  S.loads.forEach(ld=>{
    if(ld.isSelfWeight) return;
    const e=S.eccOn? (+ld.e||0):0;
    const zg=showZg? loadZgValue(ld):0;
    const zApp=showZg? zg : zTop;
    const ecc=Math.abs(e)>0.5 || (showZg && Math.abs(zg-zTop)>0.5);
    if(ld.type==='point') loads.push({kind:'point',x:(+ld.pos)*1000,y:sc.x+e,z:zApp,ecc,P:Math.abs(+ld.P||0),up:(+ld.P||0)<0,mag:(+ld.P||0)+' @ '+(+ld.pos),col:'#dc2626'});
    else if(ld.type==='moment') loads.push({kind:'moment',x:(+ld.pos)*1000,mag:(+ld.M||0)+' kN·m @ '+(+ld.pos),col:'#16a34a'});
    else {
      const w1=ld.type==='trap'? (+ld.w1||0):(+ld.w||0), w2=ld.type==='trap'? (+ld.w2||0):(+ld.w||0);
      loads.push({kind:'udl',x1:(+ld.x1)*1000,x2:(+ld.x2)*1000,y:sc.x+e,z:zApp,ecc,w1:Math.abs(w1),w2:Math.abs(w2),
        mag:(ld.type==='trap'? (w1+' → '+w2):String(ld.w))+' kN/m',col:'#2563eb'});
    }
  });
  return {
    L, D:+sec.D||100, B:+sec.B||100, scY:sc.x,
    plateT:pl&&pl.side==='bottom'? pl.t:0, plateTop:pl&&pl.side==='top'? pl.t:0,
    profile:{outer:prof.outer.map(p=>[+p[0].toFixed(2),+p[1].toFixed(2)]),
             inner:prof.inner? prof.inner.map(p=>[+p[0].toFixed(2),+p[1].toFixed(2)]):null,
             plate:pl? [[pl.x1,pl.z1],[pl.x2,pl.z1],[pl.x2,pl.z2],[pl.x1,pl.z2]]:null},
    name:sectionDisplayName(sec.key)+' '+({pfc:'PFC',shs:'SHS',rhs:'RHS',ub:'UB',uc:'UC'}[S.family]||''),   // "200 x 75 x 23 PFC" (js/03-state-ui.js), not the raw key
    supports:endsToSupports(S).map(s=>{ const e=endsList()[s.end-1]; return {x:(+s.pos)*1000,type:s.type,vp:!!e.rz,phip:!!e.warp}; }),
    restraints:(S.code==='EC3'&&(S.restraint||'full')!=='full'? (S.ltbRestraints||[]):[]).map(r=>({
      x:(+r.pos)*1000, v:r.v!==false, phi:r.phi!==false, vp:!!r.vp, phip:!!r.phip})),
    loads
  };
}
/* Serialised into the new tab - must be fully self-contained. */
function viewer3dMain(SCENE){
  const cv=document.getElementById('cv'), ctx=cv.getContext('2d');
  let yaw=-0.55, pitch=0.38, zoom=1, panX=0, panY=0, secScale=1;
  const L=SCENE.L, D=SCENE.D, B=SCENE.B;
  const maxP=Math.max(1e-9,...SCENE.loads.filter(l=>l.kind==='point').map(l=>l.P||0));
  const maxW=Math.max(1e-9,...SCENE.loads.filter(l=>l.kind==='udl').map(l=>Math.max(l.w1,l.w2)));
  function fit(){ cv.width=innerWidth; cv.height=innerHeight-46; draw(); }
  addEventListener('resize',fit);
  let C1,S1,C2,S2,SS,KP;   // per-frame camera constants
  function cam(){
    C1=Math.cos(yaw); S1=Math.sin(yaw); C2=Math.cos(pitch); S2=Math.sin(pitch);
    SS=zoom*Math.min(cv.width*0.9,cv.height*1.8)/(L*1.35);
    KP=0.10/L;                                     // mild perspective
  }
  function PR(x,y,z){
    y*=secScale; z*=secScale;
    const dx=x-L/2;
    const x1=dx*C1-y*S1, y1=dx*S1+y*C1;
    const z2=z*C2-y1*S2, y2=z*S2+y1*C2;
    const per=1/(1+Math.max(-0.6,y2*KP));
    return {x:cv.width/2+x1*SS*per+panX, y:cv.height/2-z2*SS*per+panY, d:y2};
  }
  function rotN(ny,nz){                            // rotate a section-plane normal to view space
    const y1=ny*C1, z2=nz*C2-y1*S2, y2=nz*S2+y1*C2, x1=-ny*S1;
    return [x1,y2,z2];
  }
  const LIGHT=[-0.42,-0.45,0.79];                  // view-space light (upper-left-front)
  function lambert(hex,n,alpha){
    const dot=Math.abs(n[0]*LIGHT[0]+n[1]*LIGHT[1]+n[2]*LIGHT[2]);
    const k=0.42+0.58*dot;
    const c=parseInt(hex.slice(1),16);
    const r=Math.round(((c>>16)&255)*k), g=Math.round(((c>>8)&255)*k), b=Math.round((c&255)*k);
    return alpha!=null? 'rgba('+r+','+g+','+b+','+alpha+')' : 'rgb('+r+','+g+','+b+')';
  }
  const faces=[], labels=[], xmarks=[], scDots=[];
  function shade(hex,k,alpha){
    const n=parseInt(hex.slice(1),16);
    const r=Math.round(((n>>16)&255)*k), g=Math.round(((n>>8)&255)*k), b=Math.round((n&255)*k);
    return alpha!=null? 'rgba('+r+','+g+','+b+','+alpha+')' : 'rgb('+r+','+g+','+b+')';
  }
  function quad(p1,p2,p3,p4,color,noEdge){
    const a=PR(...p1),b=PR(...p2),c=PR(...p3),d=PR(...p4);
    faces.push({pts:[a,b,c,d], d:(a.d+b.d+c.d+d.d)/4, color, noEdge});
  }
  function cuboid(x1,x2,y1,y2,z1,z2,color,alpha){
    quad([x1,y1,z2],[x2,y1,z2],[x2,y2,z2],[x1,y2,z2],shade(color,1.0,alpha));
    quad([x1,y1,z1],[x2,y1,z1],[x2,y2,z1],[x1,y2,z1],shade(color,.55,alpha));
    quad([x1,y1,z1],[x2,y1,z1],[x2,y1,z2],[x1,y1,z2],shade(color,.82,alpha));
    quad([x1,y2,z1],[x2,y2,z1],[x2,y2,z2],[x1,y2,z2],shade(color,.7,alpha));
    quad([x1,y1,z1],[x1,y2,z1],[x1,y2,z2],[x1,y1,z2],shade(color,.9,alpha));
    quad([x2,y1,z1],[x2,y2,z1],[x2,y2,z2],[x2,y1,z2],shade(color,.9,alpha));
  }
  function wedge(x,halfB,y1,y2,z0,h,color){
    const A=[x,y1,z0],Bp=[x,y2,z0];
    const c1=[x-halfB,y1,z0-h],c2=[x+halfB,y1,z0-h],c3=[x+halfB,y2,z0-h],c4=[x-halfB,y2,z0-h];
    quad(A,Bp,c4,c1,shade(color,.85)); quad(A,Bp,c3,c2,shade(color,.7));
    quad(c1,c2,c3,c4,shade(color,.5)); quad(A,c1,c2,A,shade(color,.9)); quad(Bp,c4,c3,Bp,shade(color,.9));
  }
  function label(x,y,z,text,color,small){
    const p=PR(x,y,z); labels.push({x:p.x,y:p.y,text,color,small});
  }
  function line3(p1,p2,color,w,dash){
    const a=PR(...p1), b=PR(...p2);
    faces.push({line:[a,b],d:(a.d+b.d)/2,color,w:w||1.5,dash});
    return {a,b};
  }
  function arrowTo(x,y,z,len,color,up,thick){
    const zTail=z+(up?-len:len);
    const {a,b}=line3([x,y,zTail],[x,y,z],color,thick||2.2);
    const dx=b.x-a.x, dy=b.y-a.y, m=Math.hypot(dx,dy)||1;
    const ux=dx/m, uy=dy/m, px=-uy, py=ux;
    const hl=Math.min(16,Math.max(7,(thick||2.2)*4));
    faces.push({tri:[{x:b.x,y:b.y},{x:b.x-ux*hl+px*hl*.45,y:b.y-uy*hl+py*hl*.45},{x:b.x-ux*hl-px*hl*.45,y:b.y-uy*hl-py*hl*.45}],d:(a.d+b.d)/2-1,color});
  }
  /* ---- realistic extruded section ---- */
  const STEEL='#a3c49b', PLATEC='#8b96a4';   // welded plate in contrasting steel grey
  function extrudeBeam(){
    const rings=[{pts:SCENE.profile.outer,col:STEEL}]
      .concat(SCENE.profile.inner?[{pts:SCENE.profile.inner,col:STEEL}]:[])
      .concat(SCENE.profile.plate?[{pts:SCENE.profile.plate,col:PLATEC}]:[]);
    rings.forEach(ring=>{
      const pts=ring.pts, n=pts.length;
      for(let i=0;i<n;i++){
        const p=pts[i], q=pts[(i+1)%n];
        const ey=q[0]-p[0], ez=q[1]-p[1], m=Math.hypot(ey,ez)||1;
        const nn=rotN(ez/m,-ey/m);
        quad([0,p[0],p[1]],[L,p[0],p[1]],[L,q[0],q[1]],[0,q[0],q[1]], lambert(ring.col,nn), true);
      }
    });
    // end caps (ring path with hole for hollow sections), lit by the axis
    // normal; the plate gets its own cap in the plate colour
    [0,L].forEach(xe=>{
      const nx=[C1, S1*S2, -S1*C2]; // world X rotated
      const dot=Math.abs(nx[0]*LIGHT[0]+nx[1]*LIGHT[1]+nx[2]*LIGHT[2]);
      const k=0.42+0.58*dot;
      const secRings=[SCENE.profile.outer].concat(SCENE.profile.inner?[SCENE.profile.inner]:[]);
      const proj=secRings.map(ring=>ring.map(p=>PR(xe,p[0],p[1])));
      const dMean=proj[0].reduce((s,p)=>s+p.d,0)/proj[0].length;
      faces.push({cap:proj, d:dMean, color:shade(STEEL,k)});
      if(SCENE.profile.plate){
        const pp=[SCENE.profile.plate.map(p=>PR(xe,p[0],p[1]))];
        const dP=pp[0].reduce((s,p)=>s+p.d,0)/pp[0].length;
        faces.push({cap:pp, d:dP, color:shade(PLATEC,k)});
      }
    });
    // longitudinal highlight edges at the flange tips (crisp rolled-steel arris)
    const tips=SCENE.profile.outer.filter((p,i,arr)=>{
      const prev=arr[(i-1+arr.length)%arr.length], next=arr[(i+1)%arr.length];
      const a1=Math.atan2(p[1]-prev[1],p[0]-prev[0]), a2=Math.atan2(next[1]-p[1],next[0]-p[0]);
      let dA=Math.abs(a2-a1); if(dA>Math.PI) dA=2*Math.PI-dA;
      return dA>0.6;
    });
    tips.forEach(p=>line3([0,p[0],p[1]],[L,p[0],p[1]],'rgba(30,38,52,0.35)',0.8));
  }
  function draw(){
    cam();
    faces.length=0; labels.length=0; xmarks.length=0;
    // clean white sheet - nothing above or below the beam
    ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,cv.width,cv.height);
    extrudeBeam();
    // standard support symbols: pinned = solid triangle on a base plate under
    // the soffit; fixed = end plate clamped across the section at the beam end
    SCENE.supports.forEach(s=>{
      if(s.type==='fixed'||s.type==='guided'){
        // fixed = end plate clamped across the section; guided = the same plate
        // standing clear of the soffit (rotation held, vertical free)
        const p = s.x < L/2 ? [s.x-90,s.x-2] : [s.x+2,s.x+90];
        cuboid(p[0],p[1],-B*0.85,B*0.85,-D*0.8,D*0.8, s.type==='guided'? '#a3acb8' : '#7c8694');
      } else {
        const zSoff=-D/2-(SCENE.plateT||0), hTri=D*0.5, zBase=zSoff-hTri;
        wedge(s.x,D*0.4,-B*0.32,B*0.32,zSoff-1,hTri,'#68727f');
        cuboid(s.x-D*0.5,s.x+D*0.5,-B*0.4,B*0.4,zBase-D*0.07,zBase,'#8a94a1');
      }
      if(s.vp||s.phip) label(s.x,0,-D*1.35,'+'+[s.vp?"v'":null,s.phip?"φ'":null].filter(Boolean).join(','),'#475569',true);
    });
    // LTB restraints: red X on the top flange at each restraint position
    SCENE.restraints.forEach(r=>{
      const tags=[r.v?'v':null,r.phi?'φ':null,r.vp?"v'":null,r.phip?"φ'":null].filter(Boolean).join(',');
      xmarks.push({p:PR(r.x,0,D/2+(SCENE.plateTop||0)+4), txt:(r.x/1000)+' m ('+tags+')'});
    });
    SCENE.loads.forEach(ld=>{
      if(ld.kind==='point'){
        const len=D*(0.9+0.7*Math.min(1,ld.P/maxP));
        arrowTo(ld.x,ld.y,ld.z,len,ld.col,ld.up,4.5);
        // thin reference line up to the "value @ position" tag, as in the
        // classic analysis-package view
        const zt=ld.z+(ld.up?-1:1)*(len+D*0.65);
        line3([ld.x,ld.y,ld.z+(ld.up?-1:1)*len],[ld.x,ld.y,zt],ld.col,1);
        label(ld.x,ld.y,zt+(ld.up?-1:1)*D*0.22,ld.mag,ld.col);
        if(ld.ecc) line3([ld.x,SCENE.scY,0],[ld.x,ld.y,ld.z],ld.col,1,[5,4]);
      } else if(ld.kind==='udl'){
        // row of slender arrows bearing on the application line, tails joined
        // by a thin line (magnitude-scaled at each end for trapezoidal loads)
        const h1=D*(0.55+0.6*Math.min(1,ld.w1/maxW)), h2=D*(0.55+0.6*Math.min(1,ld.w2/maxW));
        line3([ld.x1,ld.y,ld.z+h1],[ld.x2,ld.y,ld.z+h2],ld.col,1.6);
        const n=Math.max(5,Math.round((ld.x2-ld.x1)/(L/22)));
        for(let k=0;k<=n;k++){
          const t=k/n;
          arrowTo(ld.x1+(ld.x2-ld.x1)*t,ld.y,ld.z,h1+(h2-h1)*t,ld.col,false,1.8);
        }
        label((ld.x1+ld.x2)/2,ld.y,ld.z+Math.max(h1,h2)+D*0.32,ld.mag,ld.col);
        if(ld.ecc){
          const xm=(ld.x1+ld.x2)/2;
          line3([xm,SCENE.scY,0],[xm,ld.y,ld.z],ld.col,1,[5,4]);
        }
      } else if(ld.kind==='moment'){
        const R=D*0.62, seg=22, t0=-0.7*Math.PI, t1=0.55*Math.PI, pts=[];
        for(let k=0;k<=seg;k++){ const t=t0+(t1-t0)*k/seg;
          pts.push(PR(ld.x+Math.cos(t)*R, 0, Math.sin(t)*R)); }
        for(let k=0;k<seg;k++) faces.push({line:[pts[k],pts[k+1]],d:(pts[k].d+pts[k+1].d)/2,color:ld.col,w:2.6});
        const e2=pts[seg], e1=pts[seg-1];
        const dx=e2.x-e1.x, dy=e2.y-e1.y, m=Math.hypot(dx,dy)||1, ux=dx/m, uy=dy/m, px=-uy, py=ux, hl=11;
        faces.push({tri:[{x:e2.x,y:e2.y},{x:e2.x-ux*hl+px*hl*.45,y:e2.y-uy*hl+py*hl*.45},{x:e2.x-ux*hl-px*hl*.45,y:e2.y-uy*hl-py*hl*.45}],d:e2.d-1,color:ld.col});
        label(ld.x,0,R+D*0.45,ld.mag,ld.col);
      }
    });
    // shear-centre axis: always shown (red dashed), with end markers so the
    // End view - where the axis projects to a point - still shows SC clearly
    line3([0,SCENE.scY,0],[L,SCENE.scY,0],'#dc2626',1.2,[7,5]);
    label(-L*0.02,SCENE.scY,0,'SC','#dc2626',true);
    scDots.length=0;
    scDots.push(PR(0,SCENE.scY,0), PR(L,SCENE.scY,0));
    faces.sort((p,q)=>q.d-p.d);
    faces.forEach(f=>{
      if(f.pts){
        ctx.beginPath(); ctx.moveTo(f.pts[0].x,f.pts[0].y);
        for(let i=1;i<4;i++) ctx.lineTo(f.pts[i].x,f.pts[i].y);
        ctx.closePath(); ctx.fillStyle=f.color; ctx.fill();
        if(!f.noEdge){ ctx.strokeStyle='rgba(20,25,35,0.45)'; ctx.lineWidth=0.7; ctx.stroke(); }
      } else if(f.cap){
        ctx.beginPath();
        f.cap.forEach(ring=>{
          ctx.moveTo(ring[0].x,ring[0].y);
          for(let i=1;i<ring.length;i++) ctx.lineTo(ring[i].x,ring[i].y);
          ctx.closePath();
        });
        ctx.fillStyle=f.color; ctx.fill('evenodd');
        ctx.strokeStyle='rgba(20,25,35,0.55)'; ctx.lineWidth=1.0; ctx.stroke();
      } else if(f.line){
        ctx.beginPath(); ctx.setLineDash(f.dash||[]);
        ctx.moveTo(f.line[0].x,f.line[0].y); ctx.lineTo(f.line[1].x,f.line[1].y);
        ctx.strokeStyle=f.color; ctx.lineWidth=f.w||1.5; ctx.stroke(); ctx.setLineDash([]);
      } else if(f.tri){
        ctx.beginPath(); ctx.moveTo(f.tri[0].x,f.tri[0].y);
        ctx.lineTo(f.tri[1].x,f.tri[1].y); ctx.lineTo(f.tri[2].x,f.tri[2].y);
        ctx.closePath(); ctx.fillStyle=f.color; ctx.fill();
      }
    });
    labels.forEach(t=>{
      ctx.font=(t.small?'':'700 ')+(t.small?'11':'12.5')+'px Arial'; ctx.textAlign='center';
      ctx.lineWidth=4; ctx.strokeStyle='#ffffff'; ctx.strokeText(t.text,t.x,t.y);
      ctx.fillStyle=t.color; ctx.fillText(t.text,t.x,t.y);
    });
    // shear-centre end markers: red ring with white core, fixed screen size
    scDots.forEach(p=>{
      ctx.beginPath(); ctx.arc(p.x,p.y,4.5,0,2*Math.PI);
      ctx.fillStyle='#ffffff'; ctx.fill();
      ctx.lineWidth=2.2; ctx.strokeStyle='#dc2626'; ctx.stroke();
      ctx.beginPath(); ctx.arc(p.x,p.y,1.3,0,2*Math.PI);
      ctx.fillStyle='#dc2626'; ctx.fill();
    });
    // red X restraint markers drawn last, fixed screen size so they always read
    xmarks.forEach(m=>{
      const s=8;
      ctx.strokeStyle='#dc2626'; ctx.lineWidth=3.2; ctx.lineCap='round';
      ctx.beginPath();
      ctx.moveTo(m.p.x-s,m.p.y-s); ctx.lineTo(m.p.x+s,m.p.y+s);
      ctx.moveTo(m.p.x-s,m.p.y+s); ctx.lineTo(m.p.x+s,m.p.y-s);
      ctx.stroke(); ctx.lineCap='butt';
      ctx.font='10.5px Arial'; ctx.textAlign='center';
      ctx.lineWidth=3.5; ctx.strokeStyle='#ffffff'; ctx.strokeText(m.txt,m.p.x,m.p.y-s-5);
      ctx.fillStyle='#dc2626'; ctx.fillText(m.txt,m.p.x,m.p.y-s-5);
    });
  }
  let drag=null;
  cv.addEventListener('mousedown',e=>{ drag={x:e.clientX,y:e.clientY,pan:e.button===2||e.shiftKey}; });
  addEventListener('mouseup',()=>drag=null);
  addEventListener('mousemove',e=>{
    if(!drag) return;
    const dx=e.clientX-drag.x, dy=e.clientY-drag.y; drag.x=e.clientX; drag.y=e.clientY;
    if(drag.pan){ panX+=dx; panY+=dy; }
    else { yaw+=dx*0.008; pitch=Math.max(-1.45,Math.min(1.45,pitch+dy*0.008)); }
    draw();
  });
  cv.addEventListener('wheel',e=>{ e.preventDefault(); zoom*=e.deltaY<0?1.12:1/1.12; draw(); },{passive:false});
  cv.addEventListener('contextmenu',e=>e.preventDefault());
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{
    const v=b.dataset.view;
    if(v==='iso'){yaw=-0.55;pitch=0.38;} else if(v==='front'){yaw=0;pitch=0;}
    else if(v==='top'){yaw=0;pitch=1.45;} else if(v==='end'){yaw=Math.PI/2;pitch=0;}
    panX=panY=0; zoom=1; draw();
  }));
  document.querySelectorAll('[data-sec]').forEach(b=>b.addEventListener('click',()=>{
    secScale=+b.dataset.sec; draw();
  }));
  fit();
}
function open3DView(){
  const scene=build3DScene();
  const w=window.open('','_blank');
  if(!w){ alert('Pop-up blocked: allow pop-ups for this page to open the 3D view.'); return; }
  const html='<!DOCTYPE html><html><head><meta charset="utf-8"><title>3D view - '+scene.name+'</title>'+
    '<style>body{margin:0;font-family:Arial;background:#eef1f5;overflow:hidden}'+
    '#bar{height:46px;display:flex;align-items:center;gap:8px;padding:0 12px;background:#111827;color:#fff;font-size:12px}'+
    '#bar b{font-size:13px;margin-right:8px}'+
    '#bar button{border:1px solid #4b5563;background:#1f2937;color:#fff;border-radius:5px;padding:5px 10px;cursor:pointer;font-size:12px}'+
    '#bar button:hover{background:#374151}'+
    '#bar .hint{margin-left:auto;color:#9ca3af}'+
    'canvas{display:block;cursor:grab}canvas:active{cursor:grabbing}</style></head><body>'+
    '<div id="bar"><b>'+scene.name+' &mdash; L = '+(scene.L/1000)+' m</b>'+
    '<button data-view="iso">Isometric</button><button data-view="front">Front</button>'+
    '<button data-view="top">Top</button><button data-view="end">End</button>'+
    '<span style="margin-left:10px">Section scale:</span>'+
    '<button data-sec="1">&times;1</button><button data-sec="3">&times;3</button><button data-sec="6">&times;6</button>'+
    '<span class="hint">drag = rotate &middot; wheel = zoom &middot; shift/right-drag = pan</span></div>'+
    '<canvas id="cv"></canvas>'+
    '<scr'+'ipt>const SCENE='+JSON.stringify(scene)+';('+viewer3dMain.toString()+')(SCENE);</scr'+'ipt>'+
    '</body></html>';
  w.document.write(html); w.document.close();
}
