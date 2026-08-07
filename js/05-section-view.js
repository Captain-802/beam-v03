/* ===========================================================================
   5B. SECTION LOAD-LINE VIEW (inline SVG)
   Shows cross-section, centroid, shear centre, and every transverse load line.
   =========================================================================== */
function sectionViewFmt(v,d=0){
  if(!isFinite(v)) return " ";
  const s=(Math.abs(v)<5e-7?0:v).toFixed(d);
  return s.replace(/(\.\d*?)0+$/,'$1').replace(/\.$/,'');
}
function sectionViewShearCentre(sec){
  if(sec.kind==='channel'){
    const esc = sec.tp && isFinite(+sec.tp.esc) ? +sec.tp.esc
      : sec.e0!=null ? +sec.e0*10 : 0;
    const mir = typeof pfcMirrored==='function' && pfcMirrored();
    return {x:mir? esc : -esc, z:0, note:'PFC shear centre from P385/Blue Book'};
  }
  return {x:0, z:0, note:'doubly symmetric section'};
}
function sectionViewGeometry(sec){
  const D=+sec.D||1, B=+sec.B||1, tw=+sec.tw||+sec.tf||1, tf=+sec.tf||+sec.tw||1;
  const rects=[];
  let minX=-B/2, maxX=B/2, minZ=-D/2, maxZ=D/2;
  if(sec.isBox){
    return {
      type:'box', minX, maxX, minZ, maxZ,
      outer:{x1:-B/2,z1:-D/2,x2:B/2,z2:D/2},
      inner:{x1:-B/2+tf,z1:-D/2+tf,x2:B/2-tf,z2:D/2-tf}
    };
  }
  if(sec.kind==='channel'){
    const webBack = -(isFinite(+sec.x) ? +sec.x : B*0.25);
    rects.push({x1:webBack,z1:-D/2,x2:webBack+tw,z2:D/2});
    rects.push({x1:webBack,z1:D/2-tf,x2:webBack+B,z2:D/2});
    rects.push({x1:webBack,z1:-D/2,x2:webBack+B,z2:-D/2+tf});
    minX=webBack; maxX=webBack+B;
    if(typeof pfcMirrored==='function' && pfcMirrored()){
      rects.forEach(r=>{ const a=r.x1; r.x1=-r.x2; r.x2=-a; });
      return {type:'channel', rects, minX:-maxX, maxX:-minX, minZ, maxZ};
    }
    return {type:'channel', rects, minX, maxX, minZ, maxZ};
  }
  rects.push({x1:-B/2,z1:D/2-tf,x2:B/2,z2:D/2});
  rects.push({x1:-tw/2,z1:-D/2+tf,x2:tw/2,z2:D/2-tf});
  rects.push({x1:-B/2,z1:-D/2,x2:B/2,z2:-D/2+tf});
  return {type:'i', rects, minX, maxX, minZ, maxZ};
}
function sectionViewLoadLabel(ld, idx){
  if(ld.kind==='self') return 'SW';
  if(ld.type==='point') return 'P'+idx;
  if(ld.type==='udl') return 'U'+idx;
  if(ld.type==='trap') return 'T'+idx;
  return 'L'+idx;
}
function sectionViewLoadGroups(sec, showZg){
  const colors=['#b91c1c','#2563eb','#16a34a','#9333ea','#ea580c','#0891b2','#be123c','#4f46e5'];
  const loads=[];
  let idx=0;
  if(S.eccOn){
    S.loads.filter(ld=>!ld.isSelfWeight && ld.type!=='moment').forEach(ld=>{
      idx++;
      loads.push({
        label:sectionViewLoadLabel(ld,idx),
        e:isFinite(+ld.e)? +ld.e : 0,
        zg:showZg ? loadZgValue(ld) : 0,
        type:ld.type
      });
    });
    if(selfWeightValue(sec)>0){
      loads.unshift({label:'SW', e:selfWeightEccentricity(sec), zg:0, type:'self'});
    }
  }
  if(!loads.length){
    loads.push({label:'load', e:0, zg:showZg?(+S.za||0):0, type:'reference'});
  }
  const groups=[];
  loads.forEach(ld=>{
    const key=sectionViewFmt(ld.e,1)+','+sectionViewFmt(ld.zg,1);
    let g=groups.find(x=>x.key===key);
    if(!g){
      g={key,e:ld.e,zg:ld.zg,labels:[],types:[]};
      groups.push(g);
    }
    g.labels.push(ld.label);
    g.types.push(ld.type);
  });
  groups.forEach((g,i)=>{ g.color=colors[i%colors.length]; });
  return groups;
}
function sectionViewModal(){
  let modal=document.getElementById('sectionViewZoomModal');
  if(modal) return modal;
  modal=document.createElement('div');
  modal.id='sectionViewZoomModal';
  modal.className='section-view-modal';
  modal.setAttribute('role','dialog');
  modal.setAttribute('aria-modal','true');
  modal.innerHTML='<div class="section-view-modal-panel">' +
    '<button type="button" class="section-view-modal-close" aria-label="Close section load-line zoom">&times;</button>' +
    '<div class="section-view-modal-body"></div>' +
    '</div>';
  modal.addEventListener('click',e=>{ if(e.target===modal) sectionViewZoomClose(); });
  modal.querySelector('.section-view-modal-close').addEventListener('click',sectionViewZoomClose);
  document.body.appendChild(modal);
  return modal;
}
function sectionViewZoomClose(){
  const modal=document.getElementById('sectionViewZoomModal');
  if(!modal) return;
  modal.classList.remove('open');
  document.body.classList.remove('section-view-zoom-open');
}
function sectionViewZoomOpen(){
  const sec=activeSection();
  if(!sec) return;
  const modal=sectionViewModal();
  modal.querySelector('.section-view-modal-body').innerHTML=sectionLoadLineView(sec,{zoomed:true});
  modal.classList.add('open');
  document.body.classList.add('section-view-zoom-open');
  const close=modal.querySelector('.section-view-modal-close');
  if(close) close.focus();
}
function sectionViewZoomActivate(e){
  if(e && e.type==='keydown' && e.key!=='Enter' && e.key!==' ') return;
  if(e){ e.preventDefault(); e.stopPropagation(); }
  sectionViewZoomOpen();
}
document.addEventListener('keydown',e=>{
  if(e.key==='Escape') sectionViewZoomClose();
});
function sectionLoadLineView(sec, opts){
  opts=opts||{};
  const zoomed=!!opts.zoomed;
  // Layout: a dedicated LABEL BAND at the top (two rows, collision-managed),
  // the section drawing in the middle, and the e/zg legend at the bottom.
  // Every text element carries a paper-coloured halo (paint-order:stroke) so
  // nothing becomes unreadable where it crosses the section outline.
  //
  // The zoomed (modal) view is NOT the small drawing scaled up: it uses its
  // own large-format parameter set (bigger canvas, bigger fonts, thicker
  // strokes, wider label/legend pitch) and an ADAPTIVE drawing height so the
  // section fills the panel instead of floating in whitespace.
  const P = zoomed
    ? {W:620, rowY:[24,46], arrowTop:56, padL:46, padR:34, padT:64,
       fLab:14, fLeg:12.5, fSC:13.5, haloW:4.5, arrowW:3.2, dashW:1.8,
       legRow:23, gapLeg:26, scR:7.5, cR:4, estC:9.4, estP:12,
       drawHmin:300, drawHmax:540, leadSC:36}
    : {W:300, rowY:[13,25], arrowTop:31, padL:24, padR:18, padT:38,
       fLab:9.5, fLeg:8.8, fSC:10, haloW:3, arrowW:2.1, dashW:1.1,
       legRow:14, gapLeg:14, scR:5, cR:2.6, estC:6.2, estP:6,
       drawHmin:104, drawHmax:150, leadSC:17};
  const W=P.W, rowY=P.rowY, arrowTop=P.arrowTop;
  const padL=P.padL, padR=P.padR, padT=P.padT;
  const halo=' stroke="#fffdf8" stroke-width="'+P.haloW+'" paint-order="stroke" stroke-linejoin="round"';
  const geom=sectionViewGeometry(sec);
  const sc=sectionViewShearCentre(sec);
  const showZg = S.code==='EC3' && (S.restraint||'full')!=='full';
  const groups=sectionViewLoadGroups(sec, showZg);
  const pl = typeof plateGeom==='function'? plateGeom(sec) : null;
  const spanX = Math.max(geom.maxX-geom.minX, 1), spanZ = Math.max(geom.maxZ-geom.minZ, 1);
  let minX=Math.min(geom.minX, sc.x, 0, pl? pl.x1:0, ...groups.map(g=>sc.x+g.e)) - Math.max(18, spanX*0.12);
  let maxX=Math.max(geom.maxX, sc.x, 0, pl? pl.x2:0, ...groups.map(g=>sc.x+g.e)) + Math.max(18, spanX*0.12);
  let minZ=Math.min(geom.minZ, sc.z, 0, pl? pl.z1:0, ...groups.map(g=>g.zg)) - Math.max(14, spanZ*0.08);
  let maxZ=Math.max(geom.maxZ, sc.z, 0, pl? pl.z2:0, ...groups.map(g=>g.zg)) + Math.max(14, spanZ*0.08);
  // adaptive drawing height: follow the section's aspect ratio within limits,
  // then centre the drawing in both directions inside the reserved area
  const drawW=W-padL-padR;
  const drawH=Math.min(Math.max(drawW*(maxZ-minZ)/(maxX-minX), P.drawHmin), P.drawHmax);
  const legendY0=padT+drawH+P.gapLeg;
  const H=legendY0+P.legRow*Math.min(groups.length,4)+8;
  const scale=Math.min(drawW/(maxX-minX), drawH/(maxZ-minZ));
  const offX=(drawW-(maxX-minX)*scale)/2, offZ=(drawH-(maxZ-minZ)*scale)/2;
  const X=x=>padL+offX+(x-minX)*scale;
  const Y=z=>padT+offZ+(maxZ-z)*scale;
  const rw=r=>{
    const x=X(r.x1), y=Y(r.z2), w=(r.x2-r.x1)*scale, h=(r.z2-r.z1)*scale;
    return '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="#e5e7eb" stroke="#111" stroke-width="1.2"/>';
  };
  let shape='';
  if(geom.type==='box'){
    const o=geom.outer, i=geom.inner;
    shape += '<rect x="'+X(o.x1)+'" y="'+Y(o.z2)+'" width="'+((o.x2-o.x1)*scale)+'" height="'+((o.z2-o.z1)*scale)+'" fill="#e5e7eb" stroke="#111" stroke-width="1.2"/>';
    shape += '<rect x="'+X(i.x1)+'" y="'+Y(i.z2)+'" width="'+((i.x2-i.x1)*scale)+'" height="'+((i.z2-i.z1)*scale)+'" fill="#fffdf8" stroke="#111" stroke-width="1.1"/>';
  } else {
    shape = geom.rects.map(rw).join('');
  }
  if(pl) shape += rw({x1:pl.x1, z1:pl.z1, x2:pl.x2, z2:pl.z2});
  const scx=X(sc.x), scy=Y(sc.z), cx=X(0), cy=Y(0);
  const xAxis = '<line x1="'+X(geom.minX)+'" y1="'+cy+'" x2="'+X(geom.maxX)+'" y2="'+cy+'" stroke="#94a3b8" stroke-width="0.8" stroke-dasharray="3 3"/>';
  const zAxis = '<line x1="'+cx+'" y1="'+Y(geom.minZ)+'" x2="'+cx+'" y2="'+Y(geom.maxZ)+'" stroke="#94a3b8" stroke-width="0.8" stroke-dasharray="3 3"/>';
  // ---- label band: place each group's label near its line-x, resolving
  // collisions onto two rows and nudging sideways when a row is crowded ----
  const est=t=>t.length*P.estC+P.estP;         // crude text-width estimate, px
  const order=groups.map((g,i)=>({g,i,lx:X(sc.x+g.e)})).sort((a,b)=>a.lx-b.lx);
  const lastEnd=[-1e9,-1e9];
  order.forEach(o=>{
    const label=o.g.labels.join('+'), w=est(label);
    let row=0, lab=o.lx;
    if(o.lx-w/2 <= lastEnd[0]+4){
      if(o.lx-w/2 > lastEnd[1]+4) row=1;
      else { row = lastEnd[0]<=lastEnd[1]? 0:1; lab=lastEnd[row]+4+w/2; }
    }
    lab=Math.min(Math.max(lab, w/2+2), W-w/2-2);
    lastEnd[row]=lab+w/2;
    o.row=row; o.labX=lab; o.label=label;
  });
  const loadLines=order.map(o=>{
    const g=o.g, i=o.i;
    const lx=o.lx, ly=Y(g.zg);
    const startY=Math.min(arrowTop+(o.row===1? (zoomed?10:6):0), ly-(zoomed?26:14));
    const leader=(Math.abs(o.labX-lx)>6)
      ? '<line x1="'+o.labX+'" y1="'+(rowY[o.row]+2)+'" x2="'+lx+'" y2="'+startY+'" stroke="'+g.color+'" stroke-width="'+(zoomed?1.1:0.7)+'" opacity="0.7"/>' : '';
    return '<line x1="'+lx+'" y1="'+arrowTop+'" x2="'+lx+'" y2="'+(legendY0-(zoomed?14:8))+'" stroke="'+g.color+'" stroke-width="'+P.dashW+'" stroke-dasharray="5 3" opacity="0.8"/>' +
      leader +
      '<line x1="'+lx+'" y1="'+startY+'" x2="'+lx+'" y2="'+ly+'" stroke="'+g.color+'" stroke-width="'+P.arrowW+'" marker-end="url(#secLoadArrow'+i+')"/>' +
      '<text x="'+o.labX+'" y="'+rowY[o.row]+'" text-anchor="middle" font-family="Arial" font-size="'+P.fLab+'" font-weight="700" fill="'+g.color+'"'+halo+'>'+o.label+'</text>';
  }).join('');
  // ---- SC / C markers: combined callout when they coincide (doubly
  // symmetric), separate labelled markers otherwise (channel) ----
  const together = Math.abs(scx-cx)<8 && Math.abs(scy-cy)<8;
  let scMarkers;
  if(together){
    scMarkers =
      '<circle cx="'+scx+'" cy="'+scy+'" r="'+P.scR+'" fill="none" stroke="#dc2626" stroke-width="'+(zoomed?2.4:1.6)+'"/>' +
      '<circle cx="'+cx+'" cy="'+cy+'" r="'+P.cR+'" fill="#2563eb" stroke="#1e3a8a" stroke-width="0.8"/>' +
      '<line x1="'+(scx-P.leadSC-7)+'" y1="'+scy+'" x2="'+(scx-P.scR-2)+'" y2="'+scy+'" stroke="#64748b" stroke-width="'+(zoomed?1.3:0.8)+'"/>' +
      '<text x="'+(scx-P.leadSC-9)+'" y="'+(scy+P.fSC*0.34)+'" text-anchor="end" font-family="Arial" font-size="'+P.fSC+'" font-weight="700" fill="#334155"'+halo+'><tspan fill="#dc2626">SC</tspan> = <tspan fill="#2563eb">C</tspan></text>';
  } else {
    scMarkers =
      '<circle cx="'+scx+'" cy="'+scy+'" r="'+(P.scR*0.8)+'" fill="#dc2626" stroke="#7f1d1d" stroke-width="1"/>' +
      '<circle cx="'+cx+'" cy="'+cy+'" r="'+(P.cR+0.8)+'" fill="#2563eb" stroke="#1e3a8a" stroke-width="1"/>' +
      '<text x="'+(scx-P.scR-3)+'" y="'+(scy+P.fSC*0.3)+'" text-anchor="end" font-family="Arial" font-size="'+P.fSC+'" font-weight="700" fill="#dc2626"'+halo+'>SC</text>' +
      '<text x="'+(cx+P.scR+3)+'" y="'+(cy+P.fSC*0.3)+'" font-family="Arial" font-size="'+P.fSC+'" font-weight="700" fill="#2563eb"'+halo+'>C</text>';
  }
  const legend=groups.slice(0,4).map((g,i)=>{
    const y=legendY0+P.legRow*i;
    const e=(g.e>=0?'+':'')+sectionViewFmt(g.e,1);
    const z=(g.zg>=0?'+':'')+sectionViewFmt(g.zg,1);
    return '<circle cx="'+(zoomed?14:9)+'" cy="'+(y-P.fLeg*0.34)+'" r="'+(zoomed?5:3)+'" fill="'+g.color+'"/>' +
      '<text x="'+(zoomed?26:16)+'" y="'+y+'" font-family="Arial" font-size="'+P.fLeg+'" font-weight="700" fill="#334155"'+halo+'>'+g.labels.join('+')+': e '+e+', z<tspan baseline-shift="sub" font-size="'+(P.fLeg*0.8)+'">g</tspan> '+z+' mm</text>';
  }).join('') + (groups.length>4 ? '<text x="'+(W*0.56)+'" y="'+legendY0+'" font-family="Arial" font-size="'+P.fLeg+'" fill="#334155"'+halo+'>+'+(groups.length-4)+' more load lines</text>' : '');
  const markers=groups.map((g,i)=>
    '<marker id="secLoadArrow'+i+'" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L8,4 L0,8 Z" fill="'+g.color+'"/></marker>'
  ).join('');
  const meta = (groups.length===1? '1 load line':groups.length+' load lines (same e/z_g grouped)')
    + ' &middot; <span style="color:#dc2626">&#9679;</span> SC <span style="color:#2563eb">&#9679;</span> C'
    + (zoomed? '' : ' &middot; <b>click to enlarge</b>');
  const cardClass='section-view-card'+(zoomed?' section-view-card-zoomed':' section-view-card-clickable');
  const cardAttrs=zoomed ? '' : ' tabindex="0" role="button" aria-label="Zoom section load lines" title="Click to enlarge" onclick="sectionViewZoomActivate(event)" onkeydown="sectionViewZoomActivate(event)"';
  return '<div class="'+cardClass+'"'+cardAttrs+'>' +
    '<div class="dt">Section load lines</div>' +
    '<svg class="section-view-svg" viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Cross-section load lines and eccentricities from shear centre">' +
    '<defs>' + markers + '</defs>' +
    '<rect x="0" y="0" width="'+W+'" height="'+H+'" fill="#fffdf8"/>' +
    xAxis + zAxis + shape + loadLines + scMarkers +
    legend +
    '</svg>' +
    '<div class="section-view-meta">'+meta+'</div>' +
    '</div>';
}
