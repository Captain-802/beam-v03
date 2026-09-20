/* ===========================================================================
   5. DIAGRAMS (inline SVG)
   =========================================================================== */
function svgEl(W,H,inner,attrs){ return `<svg class="diag${attrs?' diag-hover':''}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"${attrs||''}>${inner}</svg>`; }
function plot(xs,ys,opt){
  const W=540,H=150,padL=46,padR=16,padT=16,padB=24;
  const xmax=xs[xs.length-1]||1;
  const ymax=Math.max(1e-9,...ys.map(v=>Math.abs(v)));
  const X=x=>padL+x/xmax*(W-padL-padR);
  const midY=padT+(H-padT-padB)/2;
  const amp=(H-padT-padB)/2-4;
  const sgn=opt.flip?-1:1;
  const Y=v=>midY - sgn*v/ymax*amp;
  let path=`M ${X(xs[0])} ${Y(ys[0])}`;
  for(let i=1;i<xs.length;i++) path+=` L ${X(xs[i])} ${Y(ys[i])}`;
  let fill=`M ${X(xs[0])} ${midY} L ${X(xs[0])} ${Y(ys[0])}`;
  for(let i=1;i<xs.length;i++) fill+=` L ${X(xs[i])} ${Y(ys[i])}`;
  fill+=` L ${X(xs[xs.length-1])} ${midY} Z`;
  // peak
  let pk=0,pi=0; ys.forEach((v,i)=>{ if(Math.abs(v)>Math.abs(pk)){pk=v;pi=i;} });
  const peakLbl=`${opt.fmt(pk)} ${opt.unit}`;
  const lx=X(xs[pi]), ly=Y(pk);
  let inner=`
    <line x1="${padL}" y1="${midY}" x2="${W-padR}" y2="${midY}" stroke="#888" stroke-width="1"/>
    <path d="${fill}" fill="${opt.fill}" opacity="0.5"/>
    <path d="${path}" fill="none" stroke="${opt.color}" stroke-width="2"/>
    <circle cx="${lx}" cy="${ly}" r="3" fill="${opt.color}"/>
    <text x="${Math.min(Math.max(lx,padL+30),W-padR-30)}" y="${ly+ (sgn*pk>=0? -6:14)}" font-family="Arial" font-size="11" font-weight="700" fill="${opt.color}" text-anchor="middle">${peakLbl}</text>
    <text x="6" y="${midY+4}" font-family="Arial" font-size="10" fill="#555">0</text>
    <text x="${padL}" y="${H-8}" font-family="Arial" font-size="10" fill="#555">0</text>
    <text x="${W-padR}" y="${H-8}" font-family="Arial" font-size="10" fill="#555" text-anchor="end">${xmax.toFixed(2)} m</text>`;
  // 20 Sep 2026 hover readout (owner: "see values on the diagram at any point
  // when I hover"). The sample arrays (7 s.f., x in m; 20 Sep 2026 review: 4
  // s.f. let the 2-dp readout disagree with the peak label and the forces
  // table above ~1000 kN.m, e.g. 2607.00 for 2606.92) and every number of the
  // data -> viewBox mapping above ride on the <svg> as data-* attributes, and a
  // hidden <g class="hover"> (guide line, marker, haloed readout) waits at the
  // end so it paints on top. installDiagramHover() below drives it through ONE
  // delegated listener set - no per-svg state, so innerHTML re-renders are free.
  // opt.name ('V','M','delta','T') and opt.caption feed the readout only; with
  // no name the readout is "x = .. m   <value> <unit>" except for the three
  // unambiguous defaults: unit 'kN' -> V, unit 'mm' -> delta, and a flipped
  // (sagging-down) moment plot -> M (torsion is not flipped, so it stays blank).
  const sig=v=>+Number(v).toPrecision(7), esc=v=>String(v==null?'':v).replace(/"/g,'&quot;').replace(/</g,'&lt;');
  const unit=opt.unit||'';
  const name=opt.name!=null? String(opt.name) : unit==='kN'?'V' : unit==='mm'?'δ' : (opt.flip&&/^kN.{0,9}m$/.test(unit))?'M':'';
  const attrs=` data-xs="${JSON.stringify(xs.map(sig))}" data-ys="${JSON.stringify(ys.map(sig))}"`+
    ` data-unit="${esc(unit)}" data-fmt-dp="${opt.dp!=null?+opt.dp:2}" data-xlabel="${esc(opt.xlabel||'x')}" data-name="${esc(name)}" data-caption="${esc(opt.caption||'')}"`+
    ` data-padl="${padL}" data-padr="${padR}" data-padt="${padT}" data-padb="${padB}" data-xmax="${sig(xmax)}" data-ymax="${sig(ymax)}" data-flip="${opt.flip?1:0}" data-midy="${midY}" data-amp="${amp}"`;
  inner+=`
    <g class="hover" style="display:none" pointer-events="none">
      <line class="hover-x" x1="${padL}" y1="${padT}" x2="${padL}" y2="${H-padB}" stroke="#444" stroke-width="1" stroke-dasharray="3 2"/>
      <circle class="hover-pt" cx="${padL}" cy="${midY}" r="4" fill="${opt.color}" stroke="#fffdf8" stroke-width="1.5"/>
      <text class="hover-txt" x="${padL+8}" y="${midY-9}" font-family="Arial" font-size="11" font-weight="700" fill="#111" stroke="#fffdf8" stroke-width="4" paint-order="stroke" stroke-linejoin="round" text-anchor="start"></text>
    </g>`;
  return svgEl(W,H,inner,attrs);
}

/* ---- hover readout driver (20 Sep 2026) ------------------------------------
   Pure helpers first (they run in the vm test harness, which has no DOM):
   diagHoverData(svg)      -> the data-* attributes parsed once per element
                              (cached in a WeakMap keyed by the svg, so a
                              re-rendered svg simply parses afresh);
   diagHoverReadout(d,vx)  -> for a viewBox x: the interpolated sample, the
                              marker position on the curve, the readout text
                              and its anchor/position kept inside the viewBox.
   installDiagramHover(root) (default document) attaches ONE delegated listener
   set - mousemove / mouseleave (capture, it does not bubble) / touchmove /
   touchend / touchcancel - for every svg.diag-hover under root, present now or
   rendered later by innerHTML. Idempotent per root; returns false when the
   root cannot take listeners (the harness stub document). No inline handlers,
   no eval: CSP-safe. */
function diagHoverData(svg){
  const cache=diagHoverData.cache||(diagHoverData.cache=(typeof WeakMap==='function')? new WeakMap() : null);
  if(cache&&cache.has(svg)) return cache.get(svg);
  const g=k=>svg.getAttribute('data-'+k), n=k=>+g(k);
  let xs,ys; try{ xs=JSON.parse(g('xs')||'[]'); ys=JSON.parse(g('ys')||'[]'); }catch(e){ xs=[]; ys=[]; }
  const vb=String(svg.getAttribute('viewBox')||'0 0 540 150').trim().split(/[\s,]+/).map(Number);
  const d={xs,ys,W:vb[2]||540,H:vb[3]||150,padL:n('padl'),padR:n('padr'),padT:n('padt'),padB:n('padb'),xmax:n('xmax')||1,ymax:n('ymax')||1e-9,
    flip:g('flip')==='1',midY:n('midy'),amp:n('amp'),unit:g('unit')||'',name:g('name')||'',dp:(g('fmt-dp')!=null&&g('fmt-dp')!=='')? +g('fmt-dp') : 2,
    xlabel:g('xlabel')||'x',caption:g('caption')||''};
  if(!(d.midY>0)) d.midY=d.padT+(d.H-d.padT-d.padB)/2;
  if(!(d.amp>0)) d.amp=(d.H-d.padT-d.padB)/2-4;
  if(cache) cache.set(svg,d);
  return d;
}
function diagHoverReadout(d,vx){
  const n=d.xs.length; if(!n||d.ys.length!==n) return null;
  const span=d.W-d.padL-d.padR;
  // viewBox x -> member x, clamped to the sampled range
  let x=(vx-d.padL)/span*d.xmax; x=Math.min(Math.max(x,d.xs[0]),d.xs[n-1]);
  // segment [lo,hi] by bisection, linear interpolation inside it (a zero-length
  // segment - the two samples either side of a jump - takes its first end)
  let lo=0,hi=n-1; while(hi-lo>1){ const m=(lo+hi)>>1; if(d.xs[m]<=x) lo=m; else hi=m; }
  const x0=d.xs[lo],x1=d.xs[hi]; let t=(x1>x0)? (x-x0)/(x1-x0) : 0; t=Math.min(Math.max(t,0),1);
  const y=d.ys[lo]+(d.ys[hi]-d.ys[lo])*t;
  const cx=d.padL+x/d.xmax*span, cy=d.midY-(d.flip?-1:1)*y/d.ymax*d.amp;
  let ys=y.toFixed(d.dp); if(/^-0\.?0*$/.test(ys)) ys=ys.slice(1);   // no "-0.00"
  const text=(d.caption? d.caption+': ' : '')+`${d.xlabel} = ${x.toFixed(2)} m ${d.name? d.name+' = ' : ''}${ys} ${d.unit}`.trim();
  // keep the readout inside the viewBox: flip the anchor near the right edge,
  // and sit the text on the EMPTY side of the axis at this x (the curve is on
  // one side only there), tied to the marker by the guide line - so it never
  // fights the peak label, which lives on the curve's outer side
  const est=text.length*6.3;
  const flipAnchor=cx+8+est>d.W-2;
  const tx=flipAnchor? cx-8 : cx+8, anchor=flipAnchor? 'end' : 'start';
  const ty=(cy>=d.midY)? d.midY-12 : d.midY+20;
  return {x,y,cx,cy,text,tx,ty,anchor};
}
function diagHoverPoint(svg,clientX,clientY){
  // pointer -> viewBox units: the screen CTM when the browser gives one, else
  // the bounding-rect ratio (width:100%, default xMidYMid meet => uniform scale)
  try{
    if(typeof svg.getScreenCTM==='function'){
      const m=svg.getScreenCTM();
      if(m){ const inv=m.inverse();
        if(typeof DOMPoint==='function'){ const p=new DOMPoint(clientX,clientY).matrixTransform(inv); return {x:p.x,y:p.y}; }
        if(typeof svg.createSVGPoint==='function'){ let p=svg.createSVGPoint(); p.x=clientX; p.y=clientY; p=p.matrixTransform(inv); return {x:p.x,y:p.y}; }
      }
    }
  }catch(e){ /* fall through to the ratio */ }
  const d=diagHoverData(svg), r=svg.getBoundingClientRect();
  const sc=Math.min(r.width/d.W,r.height/d.H)||1;
  return {x:(clientX-r.left-(r.width-d.W*sc)/2)/sc, y:(clientY-r.top-(r.height-d.H*sc)/2)/sc};
}
function diagHoverShow(svg,clientX,clientY){
  const grp=svg.querySelector('.hover'); if(!grp) return;
  const d=diagHoverData(svg), p=diagHoverPoint(svg,clientX,clientY), r=diagHoverReadout(d,p.x);
  if(!r){ grp.style.display='none'; return; }
  const ln=grp.querySelector('.hover-x'), pt=grp.querySelector('.hover-pt'), tx=grp.querySelector('.hover-txt');
  if(ln){ ln.setAttribute('x1',r.cx); ln.setAttribute('x2',r.cx); }
  if(pt){ pt.setAttribute('cx',r.cx); pt.setAttribute('cy',r.cy); }
  if(tx){ tx.setAttribute('x',r.tx); tx.setAttribute('y',r.ty); tx.setAttribute('text-anchor',r.anchor); tx.textContent=r.text; }
  grp.style.display='';
}
function diagHoverHide(svg){ const grp=svg&&svg.querySelector&&svg.querySelector('.hover'); if(grp) grp.style.display='none'; }
function installDiagramHover(root){
  root=root||(typeof document!=='undefined'? document : null);
  if(!root||typeof root.addEventListener!=='function') return false;
  const roots=installDiagramHover.roots||(installDiagramHover.roots=[]);
  if(roots.indexOf(root)>=0) return false;   // idempotent: one listener set per root
  roots.push(root);
  let active=null;   // the svg currently showing a readout (dropped when detached)
  const svgOf=t=>(t&&typeof t.closest==='function')? t.closest('svg.diag-hover') : null;
  const hideActive=()=>{ if(active){ diagHoverHide(active); active=null; } };
  const move=(target,clientX,clientY)=>{
    const svg=svgOf(target);
    if(!svg){ hideActive(); return; }
    if(active&&active!==svg) hideActive();
    active=svg; diagHoverShow(svg,clientX,clientY);
  };
  root.addEventListener('mousemove',e=>move(e.target,e.clientX,e.clientY),{passive:true});
  root.addEventListener('mouseleave',e=>{ const svg=svgOf(e.target); if(svg){ diagHoverHide(svg); if(active===svg) active=null; } },{capture:true,passive:true});
  root.addEventListener('touchmove',e=>{ const t=e.touches&&e.touches[0]; if(t) move(t.target||e.target,t.clientX,t.clientY); },{passive:true});
  root.addEventListener('touchend',hideActive,{passive:true});
  root.addEventListener('touchcancel',hideActive,{passive:true});
  return true;
}
function beamDiagram(a){
  // Collision-free loading sketch:
  //  - distributed loads whose extents overlap are STACKED in tiers, each in
  //    its own colour with its label on its own tier line;
  //  - point/moment load labels live in a collision-managed band above the
  //    load zone (two rows, side-nudged like the section view);
  //  - all text carries a paper halo, and the canvas height grows with the
  //    number of tiers so nothing is ever forced on top of anything else.
  const W=540,padL=46,padR=16;
  const L=S.L, xmax=L||1;
  const X=x=>padL+x/xmax*(W-padL-padR);
  const halo=' stroke="#fffdf8" stroke-width="3" paint-order="stroke" stroke-linejoin="round"';
  const distCols=['#06c','#0a7f5a','#c2620a','#8b3fc9','#0a7fa8','#b00'];
  const loads=S.loads;
  // ---- tier assignment for distributed loads (overlap => next tier up) ----
  const dists=[]; loads.forEach((ld,i)=>{ if(ld.type==='udl'||ld.type==='trap') dists.push({ld,i}); });
  const tierRanges=[];
  dists.forEach(o=>{
    const x1=Math.min(+o.ld.x1,+o.ld.x2), x2=Math.max(+o.ld.x1,+o.ld.x2);
    let t=0;
    while(tierRanges[t] && tierRanges[t].some(r=>x1<r[1]-1e-9 && r[0]<x2-1e-9)) t++;
    (tierRanges[t]=tierRanges[t]||[]).push([x1,x2]);
    o.tier=t; o.x1=x1; o.x2=x2;
  });
  const nT=Math.max(tierRanges.length,0), tierH=24;
  const havePts=loads.some(ld=>ld.type==='point'||ld.type==='moment');
  const topMargin=6;
  const bandRows=havePts?2:0, bandRowY=[topMargin+10,topMargin+23];
  const distTop=topMargin+(havePts?bandRows*13+4:2);
  const yB=distTop + (nT>0? nT*tierH : 34) + 8;
  const H=yB+72;
  let inner=`<line x1="${X(0)}" y1="${yB}" x2="${X(L)}" y2="${yB}" stroke="#111" stroke-width="3"/>`;
  // end supports from the in-plane type of each end: pinned = triangle, fixed =
  // hatched wall, guided (rotation held, vertical free) = sliding block, free = nothing
  endsToSupports(S).forEach(sp=>{ const x=X(sp.pos), sgn=sp.end===1? -1 : 1;
    if(sp.type==='pinned'){
      inner+=`<polygon points="${x},${yB} ${x-7},${yB+13} ${x+7},${yB+13}" fill="none" stroke="#111" stroke-width="1.6"/>
        <line x1="${x-10}" y1="${yB+16}" x2="${x+10}" y2="${yB+16}" stroke="#111" stroke-width="1.4"/>`;
    } else if(sp.type==='fixed'){
      inner+=`<line x1="${x}" y1="${yB-16}" x2="${x}" y2="${yB+16}" stroke="#111" stroke-width="2.4"/>`;
      for(let k=-14;k<=14;k+=6) inner+=`<line x1="${x}" y1="${yB+k}" x2="${x+sgn*7}" y2="${yB+k+6}" stroke="#111" stroke-width="1"/>`;
    } else if(sp.type==='guided'){
      inner+=`<rect x="${x-3}" y="${yB-14}" width="6" height="28" fill="none" stroke="#111" stroke-width="1.6"/>
        <line x1="${x+sgn*7}" y1="${yB-16}" x2="${x+sgn*7}" y2="${yB+16}" stroke="#111" stroke-width="2.4"/>`;
      for(let k=-14;k<=14;k+=6) inner+=`<line x1="${x+sgn*7}" y1="${yB+k}" x2="${x+sgn*14}" y2="${yB+k+6}" stroke="#111" stroke-width="1"/>`;
    }
  });
  // ---- distributed loads, tier by tier ----
  dists.forEach((o,di)=>{
    const ld=o.ld, col=distCols[di%distCols.length];
    const x1=X(o.x1), x2=X(o.x2);
    const top=yB-8-(o.tier+1)*tierH+tierH-16;   // block top for this tier
    inner+=`<line x1="${x1}" y1="${top}" x2="${x2}" y2="${top}" stroke="${col}" stroke-width="1.6"/>`;
    const N=Math.max(2,Math.round((x2-x1)/22));
    for(let k=0;k<=N;k++){ const xx=x1+(x2-x1)*k/N;
      inner+=`<line x1="${xx}" y1="${top}" x2="${xx}" y2="${yB-2}" stroke="${col}" stroke-width="1.1" opacity="${o.tier>0?0.55:0.9}"/>
        <polygon points="${xx},${yB-2} ${xx-3},${yB-9} ${xx+3},${yB-9}" fill="${col}" opacity="${o.tier>0?0.6:1}"/>`; }
    const w1=ld.type==='trap'?ld.w1:ld.w, w2=ld.type==='trap'?ld.w2:ld.w;
    const lbl=(ld.type==='trap'?`${w1} to ${w2}`:`${ld.w}`)+' kN/m'+(ld.case?` (${ld.case})`:'');
    const lx=Math.min(Math.max((x1+x2)/2,padL+34),W-padR-34);
    inner+=`<text x="${lx}" y="${top-4}" font-family="Arial" font-size="10.5" font-weight="700" fill="${col}" text-anchor="middle"${halo}>${lbl}</text>`;
  });
  // ---- point + moment loads: arrows to the beam, labels in the top band ----
  const bandItems=[];
  loads.forEach(ld=>{
    if(ld.type==='point'){ const x=X(+ld.pos); const dir=(ld.P>=0)?1:-1;
      if(dir>0){
        const startY=distTop+2;
        inner+=`<line x1="${x}" y1="${startY}" x2="${x}" y2="${yB-2}" stroke="#b00" stroke-width="2"/>
          <polygon points="${x},${yB-2} ${x-4},${yB-12} ${x+4},${yB-12}" fill="#b00"/>`;
        bandItems.push({x, text:`${Math.abs(ld.P)} kN`, color:'#b00', anchorY:startY});
      } else { // uplift: below the beam
        inner+=`<line x1="${x}" y1="${yB+34}" x2="${x}" y2="${yB+2}" stroke="#b00" stroke-width="2"/>
          <polygon points="${x},${yB+2} ${x-4},${yB+12} ${x+4},${yB+12}" fill="#b00"/>
          <text x="${x}" y="${yB+46}" font-family="Arial" font-size="10.5" font-weight="700" fill="#b00" text-anchor="middle"${halo}>${Math.abs(ld.P)} kN</text>`;
      }
    } else if(ld.type==='moment'){ const x=X(+ld.pos);
      inner+=`<path d="M ${x-10} ${yB-22} A 11 11 0 1 1 ${x-11} ${yB-20}" fill="none" stroke="#7a4" stroke-width="2"/>
        <polygon points="${x-11},${yB-20} ${x-15},${yB-24} ${x-7},${yB-26}" fill="#7a4"/>`;
      bandItems.push({x, text:`${Math.abs(ld.M)} kN·m`, color:'#5a7a2a', anchorY:yB-26});
    }
  });
  if(bandItems.length){
    const est=t=>t.length*6.0+6;
    bandItems.sort((p,q)=>p.x-q.x);
    const lastEnd=[-1e9,-1e9];
    bandItems.forEach(it=>{
      const w=est(it.text);
      let row=0, lab=it.x;
      if(it.x-w/2 <= lastEnd[0]+4){
        if(it.x-w/2 > lastEnd[1]+4) row=1;
        else { row=lastEnd[0]<=lastEnd[1]?0:1; lab=lastEnd[row]+4+w/2; }
      }
      lab=Math.min(Math.max(lab,w/2+2),W-w/2-2);
      lastEnd[row]=lab+w/2;
      const y=bandRowY[row];
      if(Math.abs(lab-it.x)>6) inner+=`<line x1="${lab}" y1="${y+2}" x2="${it.x}" y2="${it.anchorY}" stroke="${it.color}" stroke-width="0.7" opacity="0.7"/>`;
      inner+=`<text x="${lab}" y="${y}" font-family="Arial" font-size="10.5" font-weight="700" fill="${it.color}" text-anchor="middle"${halo}>${it.text}</text>`;
    });
  }
  inner+=`<line x1="${X(0)}" y1="${H-14}" x2="${X(L)}" y2="${H-14}" stroke="#999" stroke-width="1"/>
    <text x="${(X(0)+X(L))/2}" y="${H-4}" font-family="Arial" font-size="10.5" fill="#555" text-anchor="middle">L = ${L.toFixed(2)} m</text>`;
  return svgEl(W,H,inner);
}
