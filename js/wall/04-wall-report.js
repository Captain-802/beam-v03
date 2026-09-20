/* ===========================================================================
   W4. BEAM IN WALL - REPORT PREFIX AND THE WALL SECTION SKETCH
   (js/wall/04-wall-report.js, 20 Sep 2026; review fixes 21 Sep 2026)
   Pure string builders, no DOM (usable in tests/wall/harness-wall.cjs):
     wallSectionSvg(P, res, opts) -> SVG of the wall section: leaves hatched
        by material, cavity (+ insulation label), the beam and its plate to
        scale, the recess / clearance dimensions, the centroid and shear
        centre marks and one load line per ledger row with its x_w. Shared
        by the live sidebar sketch (js/wall/03-wall-ui.js, opts.compact)
        and the report block.
     wallDerivationTableHtml(D) -> the derivation table (load | leaf |
        x_w,load | x_w,sc | e | z_g | beam-v03 load) from formatDerivation().
     reportPrefixHtml(a, c, sec) -> the ONE block "Wall model and load
        derivation" that js/06-render.js places between the verdict banner
        and the brief when this function exists (the only beam-v03 hook).
   Every number printed is a field of placeBeam() / wallToLoads() /
   formatDerivation() (js/wall/02-wall-geometry.js): nothing is recomputed
   here. The block is rendered from a FRESH wallToLoads(WALL, sec, S), which
   is deterministic, so the table and S.loads always agree.
   =========================================================================== */

/* HTML text escape for the engineer's own labels (row labels, insulation). */
function wallEsc(s){ return String(s==null? '' : s).replace(/[&<>"]/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch])); }

/* Short tag of a generated load for the sketch and the table: O1 (outer leaf),
   I1 / I2 (inner leaf), B1 (on the beam), X1 (other). */
function wallLoadTag(ld){
  const w=ld&&ld.wall; if(!w) return '?';
  return w.tag||(typeof wallRowTag==='function'? wallRowTag(w.ledger, w.i) : ({outer:'O', inner:'I', beam:'B', other:'X'}[w.ledger]||'L')+((w.i|0)+1));
}

/* SVG hatch patterns by material family (UK drawing convention, simplified:
   brickwork 45 deg dense, blockwork 45 deg sparse, aerated block sparse +
   dots, stone cross-hatch, concrete dots + triangles, timber grain, plain
   none; insulation zig-zag). userSpaceOnUse so the courses keep their size
   whatever the drawing scale; ids prefixed so the sidebar and report copies
   never share a pattern id. */
function wallHatchDefs(pid){
  const diag=(w,stroke,sw)=>'<path d="M0 '+w+' L'+w+' 0 M-1 1 L1 -1 M'+(w-1)+' '+(w+1)+' L'+(w+1)+' '+(w-1)+'" stroke="'+stroke+'" stroke-width="'+sw+'" fill="none"/>';
  const pat=(id,w,h,fill,body)=>'<pattern id="'+pid+'-'+id+'" patternUnits="userSpaceOnUse" width="'+w+'" height="'+h+'"><rect width="'+w+'" height="'+h+'" fill="'+fill+'"/>'+body+'</pattern>';
  return pat('brick',6,6,'#f2ddcc',diag(6,'#b5734f',0.7))
    +pat('block',10,10,'#e4e7ec',diag(10,'#6b7280',0.7))
    +pat('aac',12,12,'#eef1f4',diag(12,'#9ca3af',0.6)+'<circle cx="3" cy="9" r="0.7" fill="#9ca3af"/>')
    +pat('stone',12,12,'#e8e3d6',diag(12,'#8a7d66',0.6)+'<path d="M0 0 L12 12" stroke="#8a7d66" stroke-width="0.5"/>')
    +pat('concrete',12,12,'#dfe2e6','<circle cx="3" cy="3" r="0.8" fill="#4b5563"/><circle cx="9" cy="8" r="0.8" fill="#4b5563"/><path d="M5 10 L7 7 L8.5 10.5 Z" fill="#6b7280"/>')
    +pat('timber',8,8,'#f3e7cf','<path d="M2 0 L2 8 M5.5 0 L5.5 8" stroke="#b08a4a" stroke-width="0.5"/>')
    +pat('plain',8,8,'#ececec','')
    +pat('ins',10,8,'#fff8dc','<path d="M0 6 L2.5 2 L5 6 L7.5 2 L10 6" stroke="#c9a227" stroke-width="0.8" fill="none"/>');
}

/* The wall section sketch. P = placeBeam() result (layout, ext with the
   beam-v03 outline, xc, xsc, xmin, xmax, r, clearances), res = wallToLoads()
   result (its loads carry .wall.xwLoad and .zg) or null; opts.compact for the
   sidebar (no material labels, larger fonts), opts.idPrefix for the pattern /
   marker ids. Numbers formatted by wallNum() (js/wall/02-wall-geometry.js). */
function wallSectionSvg(P, res, opts){
  opts=opts||{};
  const compact=!!opts.compact, pid=opts.idPrefix||(compact? 'wsk' : 'wrp');
  const lay=P.layout, W=lay.W, ext=P.ext, geom=ext.geom, D=ext.D||100, pl=ext.plate;
  const loads=((res&&res.loads)||[]).filter(ld=>ld.type!=='moment' && ld.wall);
  const mat=k=>(typeof wallMaterial==='function'? wallMaterial(k) : {label:k, hatch:'plain'});
  // vertical extents (mm, z from the beam centroid, + up): masonry above the
  // top of the steel (the loaded leaves), wall below the underside (plate incl.)
  const zTopSteel=pl&&pl.side==='top'? Math.max(geom.maxZ,pl.z2) : geom.maxZ;
  const zBotSteel=pl&&pl.side!=='top'? Math.min(geom.minZ,pl.z1) : geom.minZ;
  const hAbove=Math.min(Math.max(0.35*D,70),160), hBelow=Math.min(Math.max(0.22*D,45),100);
  const zTop=zTopSteel+hAbove, zBot=zBotSteel-hBelow;
  // horizontal extents: the wall plus a margin, widened for a channel's shear
  // centre outside the wall and for every load line
  const xsAll=[0,W,P.xmin,P.xmax,P.xsc].concat(loads.map(ld=>ld.wall.xwLoad));
  const mrg=Math.max(18,0.06*W);
  const x0=Math.min.apply(null,xsAll)-mrg, x1=Math.max.apply(null,xsAll)+mrg;
  // canvas: fixed width, height from the section (to scale in both directions)
  const CW=560, padL=compact? 30 : 44, padR=compact? 30 : 44, padT=compact? 58 : 76, padB=compact? 46 : 62;
  const drawW=CW-padL-padR, maxH=compact? 340 : 440;
  const scale=Math.min(drawW/(x1-x0), maxH/(zTop-zBot));
  const dW=(x1-x0)*scale, dH=(zTop-zBot)*scale;
  const offX=padL+(drawW-dW)/2;
  const X=x=>offX+(x-x0)*scale, Y=z=>padT+(zTop-z)*scale;
  const CH=padT+dH+padB;
  const fs=compact? 11 : 10.5, fsSmall=compact? 10 : 9.5;
  const halo=' stroke="#fffdf8" stroke-width="3" paint-order="stroke" stroke-linejoin="round"';   // paper-coloured halo: text stays legible over the hatching
  const num=(v,d)=>(typeof wallNum==='function'? wallNum(v,d==null?1:d) : String(v));
  let s='';
  // ---- leaves and cavity (full height), then the beam chase ----
  const yT=Y(zTop), yB=Y(zBot), hPx=yB-yT;
  lay.leaves.forEach(lf=>{
    const m=mat(lf.mat);
    s+='<rect x="'+X(lf.x1)+'" y="'+yT+'" width="'+((lf.x2-lf.x1)*scale)+'" height="'+hPx+'" fill="url(#'+pid+'-'+(m.hatch||'plain')+')" stroke="#111" stroke-width="1.1"/>';
    if(!compact){   // material label, vertical, in the masonry above the steel
      const cx=X((lf.x1+lf.x2)/2), cy=yT+Math.min(hAbove*scale,hPx)/2;
      s+='<text x="'+cx+'" y="'+cy+'" font-family="Arial" font-size="'+fsSmall+'" fill="#374151" text-anchor="middle" transform="rotate(-90 '+cx+' '+cy+')"'+halo+'>'+wallEsc(m.label)+'</text>';
    }
  });
  if(lay.cavity){
    const cv=lay.cavity;
    if(cv.insulation) s+='<rect x="'+X(cv.x1)+'" y="'+yT+'" width="'+(cv.w*scale)+'" height="'+hPx+'" fill="url(#'+pid+'-ins)" stroke="none" opacity="0.9"/>';
    if(!compact){
      const cx=X((cv.x1+cv.x2)/2), cy=yT+Math.min(hAbove*scale,hPx)/2;
      s+='<text x="'+cx+'" y="'+cy+'" font-family="Arial" font-size="'+fsSmall+'" fill="#6b7280" text-anchor="middle" transform="rotate(-90 '+cx+' '+cy+')"'+halo+'>cavity'+(cv.insulation? ' - '+wallEsc(cv.insulation) : '')+'</text>';
    }
  }
  // wall faces as heavier lines (external at 0, internal at W)
  s+='<line x1="'+X(0)+'" y1="'+yT+'" x2="'+X(0)+'" y2="'+yB+'" stroke="#111" stroke-width="1.6"/><line x1="'+X(W)+'" y1="'+yT+'" x2="'+X(W)+'" y2="'+yB+'" stroke="#111" stroke-width="1.6"/>';
  // the chase: the steel envelope is cut out of the masonry (white), the
  // recess r each side stays masonry / pointing
  s+='<rect x="'+X(P.xmin)+'" y="'+Y(zTopSteel)+'" width="'+((P.xmax-P.xmin)*scale)+'" height="'+((zTopSteel-zBotSteel)*scale)+'" fill="#fffdf8" stroke="none"/>';
  // ---- the beam (beam-v03 outline in beam coordinates, shifted by x_w,c) and the plate ----
  const rw=(r,fill)=>'<rect x="'+X(P.xc+r.x1)+'" y="'+Y(r.z2)+'" width="'+((r.x2-r.x1)*scale)+'" height="'+((r.z2-r.z1)*scale)+'" fill="'+fill+'" stroke="#111" stroke-width="1"/>';
  if(geom.type==='box'){ s+=rw(geom.outer,'#a3a9b3')+rw(geom.inner,'#fffdf8'); }
  else (geom.rects||[]).forEach(r=>{ s+=rw(r,'#a3a9b3'); });
  if(pl) s+=rw({x1:pl.x1,x2:pl.x2,z1:pl.z1,z2:pl.z2},'#6b7280');
  // ---- load lines: one per generated load, grouped by (x_w, z_g), labelled in a two-row band at the top ----
  const colors=['#b91c1c','#2563eb','#16a34a','#9333ea','#ea580c','#0891b2','#be123c','#4f46e5'];
  const groups=[];
  loads.forEach(ld=>{
    const key=num(ld.wall.xwLoad,2)+','+num(ld.zg,1);
    let g=groups.find(q=>q.key===key);
    if(!g){ g={key, x:ld.wall.xwLoad, zg:ld.zg, tags:[]}; groups.push(g); }
    g.tags.push(wallLoadTag(ld));
  });
  groups.sort((a,b)=>a.x-b.x);
  const bandY=[13,26], lastEnd=[-1e9,-1e9], est=t=>t.length*(fs*0.62)+6;
  let lines='', defs='';
  groups.forEach((g,i)=>{
    g.color=colors[i%colors.length];
    const lab=g.tags.join('+'), w=est(lab), lx=X(g.x);
    let row=0, labX=lx;
    if(lx-w/2<=lastEnd[0]+4){ if(lx-w/2>lastEnd[1]+4) row=1; else { row=lastEnd[0]<=lastEnd[1]? 0 : 1; labX=lastEnd[row]+4+w/2; } }
    labX=Math.min(Math.max(labX,w/2+2),CW-w/2-2); lastEnd[row]=labX+w/2;
    const tipY=Y(g.zg), startY=bandY[1]+8;
    defs+='<marker id="'+pid+'-arr'+i+'" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L8,4 L0,8 Z" fill="'+g.color+'"/></marker>';
    if(Math.abs(labX-lx)>6) lines+='<line x1="'+labX+'" y1="'+(bandY[row]+2)+'" x2="'+lx+'" y2="'+startY+'" stroke="'+g.color+'" stroke-width="0.7" opacity="0.7"/>';
    lines+='<line x1="'+lx+'" y1="'+startY+'" x2="'+lx+'" y2="'+(tipY-1)+'" stroke="'+g.color+'" stroke-width="2" marker-end="url(#'+pid+'-arr'+i+')"/>';
    lines+='<line x1="'+lx+'" y1="'+tipY+'" x2="'+lx+'" y2="'+yB+'" stroke="'+g.color+'" stroke-width="0.8" stroke-dasharray="4 3" opacity="0.7"/>';
    lines+='<text x="'+labX+'" y="'+bandY[row]+'" text-anchor="middle" font-family="Arial" font-size="'+fs+'" font-weight="700" fill="'+g.color+'"'+halo+'>'+lab+'</text>';
    if(!compact) lines+='<text x="'+(lx+3)+'" y="'+(yB-3)+'" font-family="Arial" font-size="'+fsSmall+'" fill="'+g.color+'"'+halo+'>x<tspan baseline-shift="sub" font-size="'+(fsSmall*0.8)+'">w</tspan> '+num(g.x,2)+'</text>';
  });
  // ---- centroid C and shear centre SC ----
  const cx=X(P.xc), cy=Y(0), sx=X(P.xsc);
  const together=Math.abs(sx-cx)<6;
  s+='<circle cx="'+cx+'" cy="'+cy+'" r="3" fill="#2563eb" stroke="#1e3a8a" stroke-width="0.8"/>';
  s+='<circle cx="'+sx+'" cy="'+cy+'" r="'+(together? 5.5 : 3.2)+'" fill="'+(together? 'none' : '#dc2626')+'" stroke="#dc2626" stroke-width="1.5"/>';
  s+='<text x="'+(Math.max(cx,sx)+8)+'" y="'+(cy+4)+'" font-family="Arial" font-size="'+fs+'" font-weight="700"'+halo+'>'+(together? '<tspan fill="#dc2626">SC</tspan> = <tspan fill="#2563eb">C</tspan>' : '<tspan fill="#2563eb">C</tspan>')+'</text>';
  if(!together) s+='<text x="'+(sx-8)+'" y="'+(cy+4)+'" text-anchor="end" font-family="Arial" font-size="'+fs+'" font-weight="700" fill="#dc2626"'+halo+'>SC</text>';
  // ---- dimensions: the wall chain above, the recess / clearance and the centroid below ----
  const dim=(xa,xb,y,label,opts2)=>{
    const o=opts2||{}, a=X(xa), b=X(xb), tick=4;
    let d='<line x1="'+a+'" y1="'+y+'" x2="'+b+'" y2="'+y+'" stroke="#374151" stroke-width="0.8"/>';
    d+='<line x1="'+a+'" y1="'+(y-tick)+'" x2="'+a+'" y2="'+(y+tick)+'" stroke="#374151" stroke-width="0.8"/><line x1="'+b+'" y1="'+(y-tick)+'" x2="'+b+'" y2="'+(y+tick)+'" stroke="#374151" stroke-width="0.8"/>';
    const w=est(label.replace(/<[^>]+>/g,'')), mid=(a+b)/2, narrow=(b-a)<w+6;
    const tx= narrow? (o.side==='left'? a-3 : b+3) : mid, anchor= narrow? (o.side==='left'? 'end' : 'start') : 'middle';
    d+='<text x="'+tx+'" y="'+(y-3)+'" text-anchor="'+anchor+'" font-family="Arial" font-size="'+fsSmall+'" fill="#111"'+halo+'>'+label+'</text>';
    return d;
  };
  const yChain=padT-10;
  s+=dim(0,lay.t1,yChain,num(lay.t1,1),{side:'left'});
  if(lay.cavity){ s+=dim(lay.cavity.x1,lay.cavity.x2,yChain,num(lay.c,1)); s+=dim(lay.inner.x1,lay.inner.x2,yChain,num(lay.t2,1),{side:'right'}); }
  if(!compact) s+=dim(0,W,yChain-14,'W = '+num(W,1));
  const yRec=Y(zBotSteel)+12;
  s+=dim(0,P.xmin,yRec,num(P.clearances.outer,1),{side:'left'});
  s+=dim(P.xmax,W,yRec,(Math.abs(P.clearances.inner-P.r)<1e-6? 'r = ' : '')+num(P.clearances.inner,1),{side:'right'});
  const yC=yB+14;
  s+=dim(0,P.xc,yC,'x<tspan baseline-shift="sub" font-size="'+(fsSmall*0.8)+'">w,c</tspan> = '+num(P.xc,2));
  if(!together) s+=dim(0,P.xsc,yC+14,'x<tspan baseline-shift="sub" font-size="'+(fsSmall*0.8)+'">w,sc</tspan> = '+num(P.xsc,2));
  // external / internal faces
  const fy=yT+hPx*0.5;
  s+='<text x="'+(X(0)-6)+'" y="'+fy+'" text-anchor="middle" font-family="Arial" font-size="'+fsSmall+'" fill="#374151" transform="rotate(-90 '+(X(0)-6)+' '+fy+')"'+halo+'>OUTSIDE</text>';
  s+='<text x="'+(X(W)+9)+'" y="'+fy+'" text-anchor="middle" font-family="Arial" font-size="'+fsSmall+'" fill="#374151" transform="rotate(-90 '+(X(W)+9)+' '+fy+')"'+halo+'>INSIDE</text>';
  return '<svg class="wall-svg" viewBox="0 0 '+CW+' '+CH+'" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Wall section with the beam, the recess and the load lines">'
    +'<defs>'+wallHatchDefs(pid)+defs+'</defs><rect x="0" y="0" width="'+CW+'" height="'+CH+'" fill="#fffdf8"/>'+s+lines+'</svg>';
}

/* The derivation table from formatDerivation() rows (+ the sketch tags). */
function wallDerivationTableHtml(D, loads){
  const two=t=>{ const m=/^(.*?) \((.*)\)$/.exec(String(t||'')); return m? wallEsc(m[1])+'<br><span class="wall-src">('+wallEsc(m[2])+')</span>' : wallEsc(t); };   // "51.25 mm (outer leaf centre t1/2)" -> value + its source on a second line
  const rows=D.rows.map((r,i)=>{
    const ld=loads&&loads[i], tag=ld? wallLoadTag(ld) : '';
    return '<tr><td class="num">'+tag+'</td><td>'+wallEsc(r.load)+'</td><td>'+wallEsc(r.leaf)+'</td><td class="num">'+two(r.xwLoadText)+'</td><td class="num">'+wallEsc(r.xwScText)+'</td><td class="num">'+wallEsc(r.eText)+'</td><td class="num">'+two(r.zgText)+'</td><td>'+wallEsc(r.beamLoad)+'</td></tr>';
  }).join('');
  return '<table class="wall-table"><thead><tr><th>#</th><th>Load (characteristic)</th><th>Leaf / ledger</th><th>x<sub>w,load</sub></th><th>x<sub>w,sc</sub></th><th>e = x<sub>w,load</sub> &minus; x<sub>w,sc</sub></th><th>z<sub>g</sub></th><th>beam-v03 load</th></tr></thead><tbody>'
    +(rows||'<tr><td colspan="8">No ledger loads (self-weight only).</td></tr>')+'</tbody></table>';
}

/* The report block. a, c: analysis / check results (unused here beyond the
   section: the block derives from WALL and S only, so it also stands when
   the checks are blocked). Never throws: a failure prints a red note so the
   brief still renders (the hook in js/06-render.js has no try / catch). */
function reportPrefixHtml(a, c, sec){
  try{
    if(typeof WALL==='undefined' || !WALL) return '';
    sec=sec||(a&&a.sec)||activeSection();
    const res=wallToLoads(WALL, sec, S), P=res.placement, D=formatDerivation(res, sec);
    const lines=D.placement.map(l=>'<div>'+wallEsc(l)+'</div>').join('');
    const list=(arr,cls)=>arr.length? '<div class="'+cls+'">'+arr.map(t=>'<div>'+wallEsc(t)+'</div>').join('')+'</div>' : '';
    const ltbOn=typeof loadHeightPerLoadOn==='function'? loadHeightPerLoadOn() : false;
    const swE=Math.abs(res.swE||0)>1e-6;
    const ecc='beam-v03 inputs written: S.eccOn = '+(res.eccOn? 'true (every load carries its own e and z<sub>g</sub>'+(swE&&!res.loads.some(ld=>ld.type!=='moment'&&(Math.abs(ld.e||0)>1e-6||Math.abs(ld.zg||0)>1e-6))? '; switched on by the eccentric self-weight of the channel, e<sub>sw</sub> = '+wallSigned(res.swE,1)+' mm' : '')+')' : 'false (every load through the shear centre at z<sub>g</sub> = 0, S.za = 0 on this page: the plain beam-v03 path)')
      +(sec.kind==='channel'? '; S.pfcMirror = '+(res.pfcMirror? 'true (web toward the inside)' : 'false (web toward the outside)') : '')
      +'. e enters the torsion / eccentric-load checks; z<sub>g</sub> enters the LTB M<sub>cr</sub> of the EC3 unrestrained route only'+(ltbOn? '.' : ' (fully restrained here: printed for traceability, not applied).')
      +' Self-weight is added by beam-v03 automatically ('+(sec.kind==='channel'? 'through the channel centroid, e = e<sub>sc</sub>' : 'through the centroid')+(P.ext.plate? ', plate included' : '')+').';
    return '<div class="wall-block"><div class="wall-h">Wall model and load derivation</div>'
      +'<div class="wall-grid"><div class="wall-sketch">'+wallSectionSvg(P, res, {compact:false, idPrefix:'wrp'})+'</div>'
      +'<div class="wall-lines">'+lines+list(res.notes,'wall-notes')+list(res.warnings,'wall-warns')+list(res.errors,'wall-errs')
      +'<div class="wall-key">Conventions: x<sub>w</sub> in mm from the external face of the outer leaf inward (outer leaf [0, t<sub>1</sub>], cavity [t<sub>1</sub>, t<sub>1</sub> + c], inner leaf [t<sub>1</sub> + c, W]); the beam&rsquo;s +x points inward, so e = x<sub>w,load</sub> &minus; x<sub>w,sc</sub> (+ toward the inside, beam-v03&rsquo;s own sign); z<sub>g</sub> + above the shear centre (destabilising); a leaf load acts at the leaf centre; the recess r is the pointing cover from the steel to the wall face.</div></div></div>'
      +wallDerivationTableHtml(D, res.loads)
      +'<div class="wall-note">'+ecc+'</div></div>';
  } catch(err){
    return '<div class="err">Wall model block could not be rendered: '+wallEsc(err&&err.message? err.message : err)+'</div>';
  }
}
