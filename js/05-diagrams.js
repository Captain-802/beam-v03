/* ===========================================================================
   5. DIAGRAMS (inline SVG)
   =========================================================================== */
function svgEl(W,H,inner){ return `<svg class="diag" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`; }
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
  return svgEl(W,H,inner);
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
  // supports
  S.supports.forEach(sp=>{ const x=X(sp.pos);
    if(sp.type==='pinned'){
      inner+=`<polygon points="${x},${yB} ${x-7},${yB+13} ${x+7},${yB+13}" fill="none" stroke="#111" stroke-width="1.6"/>
        <line x1="${x-10}" y1="${yB+16}" x2="${x+10}" y2="${yB+16}" stroke="#111" stroke-width="1.4"/>`;
    } else {
      inner+=`<line x1="${x}" y1="${yB-16}" x2="${x}" y2="${yB+16}" stroke="#111" stroke-width="2.4"/>`;
      for(let k=-14;k<=14;k+=6) inner+=`<line x1="${x}" y1="${yB+k}" x2="${x-7}" y2="${yB+k+6}" stroke="#111" stroke-width="1"/>`;
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
