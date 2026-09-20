/* ===========================================================================
   W2. BEAM IN WALL - GEOMETRY AND LOAD DERIVATION
   (js/wall/02-wall-geometry.js, 20 Sep 2026; review fixes 21 Sep 2026)
   PURE functions, no DOM, usable in the vm harness (tests/wall/harness-wall.cjs).
   They lean on beam-v03's own section helpers, unchanged:
     sectionViewGeometry(sec) / sectionViewShearCentre(sec)  js/05-section-view.js
     plateGeom(sec) / pfcMirrored() / selfWeightEccentricity js/02-section-data.js
   Those helpers consult the LIVE state S (S.pfcMirror, S.plate), so the
   placement is evaluated with S.pfcMirror set from the wall's "web faces"
   input for the duration of the call (wallWithMirror) and restored after.
   Every derived number is returned raw (mm, kN) and rounded only where it
   becomes a beam-v03 input (e, z_g to 0.01 mm) so the report can trace it.

   Coordinates (see js/wall/01-wall-state.js): x_w from the EXTERNAL face
   inward; beam +x (js/05-section-view.js) = +x_w; e_beamv03 = x_w,load -
   x_w,sc; z_g + = above the shear centre = destabilising.

   Channel outline (21 Sep 2026 review, three reviewers): beam-v03's
   sectionViewGeometry() / plateGeom() / build3DProfile() place a channel's
   web back at -sec.x from the centroid, but the PFC table's x column is the
   Blue Book TORSIONAL INDEX (17.0 for 300x100x46), not the centroid distance
   c_y (30.5 mm). The wall page needs the true extreme fibres (flush
   placements, recess check, the leaf eccentricities e), so this module builds
   the channel outline itself from the P385 torsion row it already carries:
     c_y = e_sc - e_0 + t_w/2     (e_sc: shear centre to centroid, e_0: shear
                                    centre to the web centreline, both mm)
   = 62.7 - 36.7 + 4.5 = 30.5 mm for 300x100x46 (Blue Book 3.05 cm; a
   rectangles + fillets centroid by hand gives 30.52), 26.2 for 430x100x64
   (Blue Book 2.62), 17.3 for 100x50x10 (Blue Book 1.73). The plate extents
   are rebuilt from that outline (x1 = web back or toe - outL, x2 = + outR).
   beam-v03 itself is NOT changed (house rule): its section card, 3D view and
   - with a plate on a channel - its automatic self-weight eccentricity keep
   their own outline; the report block says so (placement note).
   =========================================================================== */
const WALL_TOL=1e-6;                            // mm: "touching" is not "under"

/* number -> string with d decimals, trailing zeros stripped (fmtMM style) */
function wallNum(v,d){
  if(!Number.isFinite(+v)) return '-';
  d=d==null? 2 : d;
  const s=(Math.abs(+v)<5e-9? 0 : +v).toFixed(d);
  return s.replace(/(\.\d*?)0+$/,'$1').replace(/\.$/,'');
}
function wallSigned(v,d){ const s=wallNum(v,d); return (s==='-'||s.startsWith('-')||s==='0')? s : '+'+s; }
/* Sketch / table tag of a ledger row: O1 (outer leaf), I1 / I2 (inner leaf),
   B1 (on the beam), X1 (other). */
function wallRowTag(ledger, i){ return ({outer:'O', inner:'I', beam:'B', other:'X'}[ledger]||'L')+((i|0)+1); }

/* Leaf extents along x_w. A solid wall (t2 = 0) ignores c (cIgnored flags
   a typed cavity that was dropped). chased: the leaf is cut over the beam
   (default true); false makes a beam fibre inside the leaf a WARNING. */
function wallLayout(w){
  const t1=Math.max(+w.t1||0,0), solid=wallIsSolid(w);
  const c=solid? 0 : Math.max(+w.c||0,0), t2=solid? 0 : Math.max(+w.t2||0,0);
  const W=t1+c+t2;
  const outer={key:'outer', label:'outer leaf', x1:0, x2:t1, t:t1, mat:w.mat1||'custom', chased:w.chased1!==false, centre:t1/2};
  const inner=solid? null : {key:'inner', label:'inner leaf', x1:t1+c, x2:W, t:t2, mat:w.mat2||'custom', chased:w.chased2!==false, centre:t1+c+t2/2};
  return {t1, c, t2, W, solid, cIgnored: solid && (+w.c||0)>0,
    outer, inner, cavity: solid? null : {x1:t1, x2:t1+c, w:c, insulation:w.insulation||''},
    leaves: inner? [outer, inner] : [outer]};
}

/* "web faces" input -> S.pfcMirror: unmirrored channel = web back at -x =
   toward the OUTSIDE, flange tips inward; mirrored = web toward the inside.
   Returned for every family (pfcMirrored() ignores it unless S.family is
   'pfc'), so syncWall() can always write it. */
function wallPfcMirror(w){ return (w.pfcWebFaces||'outside')==='inside'; }

/* Run fn with S.pfcMirror = mirror (the beam-v03 helpers read the live S),
   restoring the previous value whatever happens: placeBeam() stays free of
   observable side effects. st is the state object handed in; the global S
   is set too when a copy was handed in. */
function wallWithMirror(st, mirror, fn){
  const targets=[st];
  if(typeof S!=='undefined' && S && S!==st) targets.push(S);
  const had=targets.map(t=>t.pfcMirror);
  targets.forEach(t=>{ t.pfcMirror=!!mirror; });
  try{ return fn(); }
  finally{ targets.forEach((t,i)=>{ t.pfcMirror=had[i]; }); }
}

/* Blue Book centroid distance c_y of a channel (mm from the web back to the
   centroid): c_y = e_sc - e_0 + t_w/2 from the P385 Table A.3 row beam-v03
   attaches as sec.tp (esc, e0 in mm). Fallback without the row: beam-v03's
   own -sec.x convention (flagged in the source text). */
function wallChannelCy(sec){
  const tp=sec&&sec.tp, tw=+sec.tw||0, B=+sec.B||0;
  if(tp && Number.isFinite(+tp.esc) && Number.isFinite(+tp.e0)){
    const cy=+tp.esc-+tp.e0+tw/2;
    return {cy, source:'e_sc - e_0 + t_w/2 = '+wallNum(+tp.esc,1)+' - '+wallNum(+tp.e0,1)+' + '+wallNum(tw/2,2)+' = '+wallNum(cy,2)+' mm (P385 Table A.3 / Blue Book c_y)'};
  }
  const cy=Number.isFinite(+sec.x)? +sec.x : 0.25*B;
  return {cy, source:'no P385 torsion row: beam-v03 fallback '+wallNum(cy,2)+' mm'};
}
/* The channel outline in beam coordinates (mm from the centroid), the shape
   of sectionViewGeometry() but with the web back at -c_y: unmirrored = web
   back at -c_y (toward the outside), toes at -c_y + B (inward); mirrored =
   the reverse. minZ / maxZ = -D/2 / +D/2 as beam-v03. */
function wallChannelOutline(sec, mirror){
  const D=+sec.D||1, B=+sec.B||1, tw=+sec.tw||+sec.tf||1, tf=+sec.tf||+sec.tw||1;
  const cyInfo=wallChannelCy(sec), webBack=-cyInfo.cy;
  const rects=[
    {x1:webBack, z1:-D/2,     x2:webBack+tw, z2:D/2},
    {x1:webBack, z1:D/2-tf,   x2:webBack+B,  z2:D/2},
    {x1:webBack, z1:-D/2,     x2:webBack+B,  z2:-D/2+tf}
  ];
  let minX=webBack, maxX=webBack+B;
  if(mirror){ rects.forEach(r=>{ const a=r.x1; r.x1=-r.x2; r.x2=-a; }); const m=minX; minX=-maxX; maxX=-m; }
  return {type:'channel', rects, minX, maxX, minZ:-D/2, maxZ:D/2, cy:cyInfo.cy, cySource:cyInfo.source, mirror:!!mirror};
}

/* Extreme fibres of the beam in beam coordinates (mm from the centroid):
   the section outline (beam-v03's sectionViewGeometry() for I / H / box
   sections, wallChannelOutline() for a channel - see the header) extended
   by the welded plate (x1 = section edge - outL, x2 = section edge + outR)
   when it is on. top* = the bearing extent the masonry can sit on: the
   section's own top flange, extended only by a TOP plate; a bottom plate
   carries a leaf on its outstand (reported separately, plate not designed).
   Reads S.pfcMirror / S.plate via the helpers, so call it inside
   wallWithMirror(). outline: the channel correction (null for other kinds). */
function beamExtremes(sec, st){
  const isCh=sec.kind==='channel';
  const mirror=(typeof pfcMirrored==='function')? pfcMirrored() : !!(st&&st.pfcMirror);
  const geomV03=sectionViewGeometry(sec), sc=sectionViewShearCentre(sec);
  const geom=isCh? wallChannelOutline(sec, mirror) : geomV03;
  let pl=(typeof plateGeom==='function')? plateGeom(sec) : null;
  let outline=null;
  if(isCh){
    const delta=geom.cy-(Number.isFinite(+sec.x)? +sec.x : 0.25*(+sec.B||0));   // c_y - beam-v03's web-back distance (mm)
    outline={cy:geom.cy, cySource:geom.cySource, v03:(Number.isFinite(+sec.x)? +sec.x : null), delta,
      differs:Math.abs(delta)>0.05, v03MinX:geomV03.minX, v03MaxX:geomV03.maxX};
    if(pl){   // the plate hangs off the corrected outline (beam-v03's plateGeom uses its own web-back distance)
      const x1=geom.minX-pl.oL, x2=geom.maxX+pl.oR;
      outline.plateV03={x1:pl.x1, x2:pl.x2, cx:pl.cx};
      pl=Object.assign({}, pl, {x1, x2, w:x2-x1, cx:(x1+x2)/2});
    }
  }
  let minX=geom.minX, maxX=geom.maxX, topMinX=geom.minX, topMaxX=geom.maxX;
  if(pl){
    minX=Math.min(minX,pl.x1); maxX=Math.max(maxX,pl.x2);
    if(pl.side==='top'){ topMinX=Math.min(topMinX,pl.x1); topMaxX=Math.max(topMaxX,pl.x2); }
  }
  return {minX, maxX, topMinX, topMaxX, width:maxX-minX, B:+sec.B||0, D:+sec.D||0,
    scX:sc.x, scZ:sc.z, geom, sc, plate:pl, plateOn:!!pl, outline};
}

/* Bearing of one leaf: the top flange (or top plate) overlap and, with a
   bottom plate, the plate overlap; outstand = the plate width under the leaf
   beyond the flange. on = the leaf sits on any steel. */
function wallBearingText(u){
  if(!u || !u.on) return 'NOT under it';
  const fl=u.flange, pl=u.plate;
  if(fl.on && pl.on && pl.outstand>WALL_TOL) return 'top flange under it over '+wallNum(fl.width,1)+' mm + bottom-plate outstand over '+wallNum(pl.outstand,1)+' mm (plate not designed here)';
  if(fl.on) return 'top flange under it over '+wallNum(fl.width,1)+' mm';
  return 'bottom-plate outstand under it over '+wallNum(pl.outstand,1)+' mm, no top flange under it (plate not designed here)';
}

/* The beam in the wall: centroid x_w from the placement mode and the recess
   r, then the shear centre, the extreme fibres, the clearances to the wall
   faces, the bearing under each leaf and the validation lists.
     errors   (report not run): r < 10; beam wider than W - 2r; an extreme
              fibre outside [r, W - r]; custom mode without a number
     warnings (report runs): a fibre inside a leaf declared not chased;
              the beam under neither leaf (top flange or bottom-plate outstand)
     notes    : solid-wall fallbacks, channel outline / shear-centre position */
function placeBeam(w, sec, st){
  const lay=wallLayout(w), W=lay.W;
  const r=+w.recess, mode=w.placement||'flush-inside', mirror=wallPfcMirror(w);
  const ext=wallWithMirror(st, mirror, ()=>beamExtremes(sec, st));
  const errors=[], warnings=[], notes=[];
  if(!(lay.t1>0)) errors.push('Outer leaf thickness t1 must be greater than 0 mm.');
  if(lay.cIgnored) notes.push('t2 = 0: single-leaf (solid) wall of t1 = '+wallNum(lay.t1,1)+' mm; the typed cavity c = '+wallNum(+w.c,1)+' mm is ignored (W = t1).');
  if(!Number.isFinite(r) || r<WALL_RECESS_MIN-WALL_TOL)
    errors.push('Recess r = '+(Number.isFinite(r)? wallNum(r,2) : '?')+' mm is below the '+WALL_RECESS_MIN+' mm minimum (mortar / pointing cover so the steel is not seen).');   // 2 decimals: r = 9.99 must not read "10 mm is below the 10 mm minimum" (21 Sep 2026 review)
  const rr=Number.isFinite(r)? r : WALL_RECESS_MIN;
  let xc, modeText;
  switch(mode){
    case 'flush-inside':  xc=W-rr-ext.maxX; modeText='flush inside: innermost fibre at W - r = '+wallNum(W-rr)+' mm'; break;
    case 'flush-outside': xc=rr-ext.minX;   modeText='flush outside: outermost fibre at r = '+wallNum(rr)+' mm'; break;
    case 'cavity-centre':
      if(lay.solid){ xc=W/2; modeText='cavity centre (solid wall: no cavity, centroid at W/2 = '+wallNum(W/2)+' mm)'; notes.push('Solid wall has no cavity: "cavity centre" places the centroid at the wall centre W/2 = '+wallNum(W/2)+' mm.'); }
      else { xc=lay.t1+lay.c/2; modeText='cavity centre: centroid at t1 + c/2 = '+wallNum(xc)+' mm'; }
      break;
    case 'wall-centre':   xc=W/2; modeText='wall centre: centroid at W/2 = '+wallNum(xc)+' mm'; break;
    case 'custom':
      xc=(w.xcCustom===null || w.xcCustom===undefined || w.xcCustom==='')? NaN : +w.xcCustom;   // blank input is "not typed", not 0
      if(!Number.isFinite(xc)){ errors.push('Custom placement: type the centroid x_w (mm).'); xc=W/2; }
      modeText='custom: centroid at x_w = '+wallNum(xc)+' mm (typed)'; break;
    default: errors.push('Unknown placement mode "'+mode+'".'); xc=W/2; modeText=String(mode);
  }
  const xsc=xc+ext.scX, xmin=xc+ext.minX, xmax=xc+ext.maxX, xTopMin=xc+ext.topMinX, xTopMax=xc+ext.topMaxX;
  const plB=(ext.plate && ext.plate.side!=='top')? {x1:xc+ext.plate.x1, x2:xc+ext.plate.x2} : null;   // bottom plate extent in x_w
  const available=W-2*rr;
  const widthText='total width '+wallNum(ext.width,1)+' mm (B = '+wallNum(ext.B,1)+(ext.plate? ' + plate outstands '+wallNum(ext.plate.oL,1)+' / '+wallNum(ext.plate.oR,1) : '')+')';
  if(ext.width>available+WALL_TOL){
    errors.push('Beam wider than the wall: '+widthText+' > W - 2r = '+wallNum(available,1)+' mm (W = '+wallNum(W,1)+', r = '+wallNum(rr,1)+').');
  } else {
    if(xmin<rr-WALL_TOL) errors.push('Beam outer extreme fibre at x_w = '+wallNum(xmin)+' mm is outside the recess limits [r, W - r] = ['+wallNum(rr)+', '+wallNum(W-rr)+'] mm.');
    if(xmax>W-rr+WALL_TOL) errors.push('Beam inner extreme fibre at x_w = '+wallNum(xmax)+' mm is outside the recess limits [r, W - r] = ['+wallNum(rr)+', '+wallNum(W-rr)+'] mm.');
  }
  // bearing: the top flange (or top plate) overlapping a leaf's thickness, and
  // the bottom-plate outstand under it (21 Sep 2026 review: a leaf on the
  // plate outstand is the owner's stated use; touching = 0 = not under)
  const under={}, inLeaf={};
  lay.leaves.forEach(lf=>{
    const ovF=Math.min(xTopMax,lf.x2)-Math.max(xTopMin,lf.x1);
    const ovP=plB? Math.min(plB.x2,lf.x2)-Math.max(plB.x1,lf.x1) : -1;
    const flange={on:ovF>WALL_TOL, width:Math.max(ovF,0)};
    const plate={on:ovP>WALL_TOL, width:Math.max(ovP,0), outstand:Math.max(Math.max(ovP,0)-Math.max(ovF,0),0)};
    const u={on:flange.on||plate.on, width:flange.width, flange, plate};
    u.text=wallBearingText(u);
    under[lf.key]=u;
    const intr=Math.min(xmax,lf.x2)-Math.max(xmin,lf.x1);      // any part of the beam (plate incl.) within the leaf thickness
    inLeaf[lf.key]=intr>WALL_TOL;
    if(intr>WALL_TOL && !lf.chased)
      warnings.push('The beam ('+wallNum(xmin)+' to '+wallNum(xmax)+' mm) lies '+wallNum(intr)+' mm inside the '+lf.label+' ('+wallNum(lf.x1)+' to '+wallNum(lf.x2)+' mm), which is declared not chased: cut the leaf over the beam or accept that the beam bears it.');
  });
  const underOuter=!!under.outer.on, underInner=!!(under.inner&&under.inner.on);
  if(!underOuter && !underInner)
    warnings.push('The beam sits under neither leaf (top flange x_w '+wallNum(xTopMin)+' to '+wallNum(xTopMax)+' mm'+(plB? ', bottom plate '+wallNum(plB.x1)+' to '+wallNum(plB.x2)+' mm' : '')+'; outer leaf 0 to '+wallNum(lay.t1)+(lay.inner? ', inner leaf '+wallNum(lay.inner.x1)+' to '+wallNum(lay.inner.x2) : '')+' mm): no masonry bearing on the beam.');
  let cavity=null;
  if(lay.cavity){
    const whole=xmin>=lay.cavity.x1-WALL_TOL && xmax<=lay.cavity.x2+WALL_TOL;
    cavity={whole, clearance: whole? Math.min(xmin-lay.cavity.x1, lay.cavity.x2-xmax) : null,
      needed: ext.width+2*rr};   // cavity width that would hold the beam with the recess r each side
  }
  if(ext.outline && ext.outline.differs){
    const o=ext.outline;
    notes.push('Channel outline: web back at c_y = '+wallNum(o.cy,2)+' mm from the centroid ('+o.cySource+'); beam-v03\'s own section card and 3D view draw it at '+wallNum(o.v03,2)+' mm (its table\'s torsional index x), '+wallNum(Math.abs(o.delta),2)+' mm off - a beam-v03 drawing issue flagged 20 Sep 2026, corrected here for the placement, the sketch and every e'
      +(o.plateV03? '; with the plate, beam-v03\'s automatic self-weight eccentricity still uses its own plate position (plate centroid '+wallSigned(o.plateV03.cx,1)+' instead of '+wallSigned(ext.plate.cx,1)+' mm)' : '')+'.');
  }
  if(Math.abs(ext.scX)>WALL_TOL){
    notes.push('Channel: shear centre at x_w = '+wallNum(xsc)+' mm ('+wallSigned(ext.scX,1)+' mm from the centroid, web toward the '+(mirror? 'inside' : 'outside')+')'+((xsc<-WALL_TOL||xsc>W+WALL_TOL)? ' - outside the wall thickness, as a channel\'s shear centre lies beyond its web; every e is measured from it.' : '.'));
  }
  return {layout:lay, r:rr, mode, modeText, mirror, ext,
    xc, xsc, xmin, xmax, xTopMin, xTopMax, plateX:plB, width:ext.width, B:ext.B, available,
    clearances:{outer:xmin, inner:W-xmax},        // each extreme fibre to its wall face (must be >= r)
    under, underOuter, underInner, inLeaf, cavity,
    errors, warnings, notes, ok:errors.length===0};
}

/* x_w of a leaf load line: the LEAF CENTRE (owner decision). null when the
   leaf does not exist (inner leaf of a solid wall) or for the other ledgers. */
function leafLoadX(w, leaf){
  const lay=wallLayout(w);
  if(leaf==='outer') return lay.outer.centre;
  if(leaf==='inner') return lay.inner? lay.inner.centre : null;
  return null;
}

/* z_g (mm from the shear centre, + above) for a load height choice.
   'plate' = the plate underside (-D/2 - t; a top plate: +D/2 + t) and falls
   back to the flange it would sit against when the plate is off. */
function zgFor(choice, sec, custom){
  const D=+sec.D||0;
  switch(choice){
    case 'bottom': return -D/2;
    case 'sc':     return 0;
    case 'plate': { const pl=(typeof plateGeom==='function')? plateGeom(sec) : null; return pl? (pl.side==='top'? pl.z2 : pl.z1) : -D/2; }
    case 'custom': return Number.isFinite(+custom)? +custom : 0;
    default:       return D/2;   // 'top' and anything unknown: the default choice
  }
}
function zgChoiceText(choice, sec, custom){
  const zg=zgFor(choice, sec, custom), z=wallSigned(zg,1)+' mm';
  const pl=(typeof plateGeom==='function')? plateGeom(sec) : null;
  return choice==='bottom'? 'bottom flange (-D/2 = '+z+')' : choice==='sc'? 'shear centre (0)' :
    choice==='plate'? (pl? (pl.side==='top'? 'plate top (+D/2 + t = '+z+')' : 'plate underside (-D/2 - t = '+z+')') : 'plate underside (no plate: bottom flange '+z+')') :
    choice==='custom'? 'custom ('+z+')' : 'top flange (+D/2 = '+z+')';
}
/* The load-height drop-list for the current plate: 'plate' offered only while
   the plate is on, labelled by its side. */
function wallHeightOptions(sec){
  const pl=(typeof plateGeom==='function')? plateGeom(sec) : null;
  return WALL_HEIGHTS.filter(h=>h.key!=='plate' || pl).map(h=>(h.key==='plate' && pl && pl.side==='top')? {key:'plate', label:'plate top (+D/2 + t)'} : h);
}
/* Rows left at 'plate' after the plate is switched off go to the flange the
   plate sat against (S.plate.side survives the switch-off), so the ledger's
   select always shows the z_g applied. Mutates w; returns the rows changed. */
function wallNormaliseHeights(w, sec, st){
  const pl=(typeof plateGeom==='function')? plateGeom(sec) : null;
  if(pl) return 0;
  const to=(st&&st.plate&&st.plate.side==='top')? 'top' : 'bottom';
  let n=0;
  WALL_LEDGERS.forEach(lg=>((w.ledgers&&w.ledgers[lg.key])||[]).forEach(row=>{ if(row.height==='plate'){ row.height=to; n++; } }));
  return n;
}

/* "UDL 12 kN/m 0-4 m" / "TRAP 0->12 kN/m 0-4 m" / "P 30 kN @ 2 m" / "M 10 kN.m @ 2 m" */
function wallLoadMagText(ld){
  if(ld.type==='point')  return 'P '+wallNum(ld.P,3)+' kN @ '+wallNum(ld.pos,3)+' m';
  if(ld.type==='moment') return 'M '+wallNum(ld.M,3)+' kN.m @ '+wallNum(ld.pos,3)+' m';
  if(ld.type==='trap')   return 'TRAP '+wallNum(ld.w1,3)+'->'+wallNum(ld.w2,3)+' kN/m '+wallNum(ld.x1,3)+'-'+wallNum(ld.x2,3)+' m';
  return 'UDL '+wallNum(ld.w,3)+' kN/m '+wallNum(ld.x1,3)+'-'+wallNum(ld.x2,3)+' m';
}

/* Ledger row validation (21 Sep 2026 review): a partial UDL / trapezoid typed
   beyond the span or with x1 >= x2, a position outside [0, L] or a blank
   magnitude used to be clamped silently and then refused by beam-v03's
   generic "Load N must have x2 greater than x1". Returns [{msg, keys}] with
   the row tag so the derived box prints it in red and marks the inputs. */
function wallRowErrors(row, ledger, i, L){
  const tag=wallRowTag(ledger, i), out=[], fin=v=>Number.isFinite(+v) && v!==null && v!=='';
  const rowType=row.type||'udl', hasL=Number.isFinite(+L) && +L>0;
  const Ltxt='L = '+wallNum(L,3)+' m';
  const typeText={udl:'UDL', pudl:'partial UDL', trap:'trapezoidal load', point:'point load', moment:'applied moment'}[rowType]||rowType;
  if(rowType==='pudl' || rowType==='trap'){
    if(!fin(row.x1) || !fin(row.x2)) out.push({msg:tag+' ('+typeText+'): x1 and x2 must be numbers (m).', keys:['x1','x2']});
    else if(!(+row.x2>+row.x1+1e-9) || +row.x1<-1e-9 || (hasL && +row.x2>+L+1e-9))
      out.push({msg:tag+' ('+typeText+'): x1 = '+wallNum(row.x1,3)+' m, x2 = '+wallNum(row.x2,3)+' m must satisfy 0 <= x1 < x2 <= '+Ltxt+'.', keys:['x1','x2']});
    if(rowType==='pudl' && !fin(row.w)) out.push({msg:tag+' ('+typeText+'): w is not a number.', keys:['w']});
    if(rowType==='trap' && (!fin(row.w1) || !fin(row.w2))) out.push({msg:tag+' ('+typeText+'): w1 / w2 are not numbers.', keys:['w1','w2']});
  } else if(rowType==='point' || rowType==='moment'){
    if(!fin(row.pos) || +row.pos<-1e-9 || (hasL && +row.pos>+L+1e-9))
      out.push({msg:tag+' ('+typeText+'): position '+(fin(row.pos)? wallNum(row.pos,3)+' m' : '(blank)')+' must lie within 0 to '+Ltxt+'.', keys:['pos']});
    if(rowType==='point' && !fin(row.P)) out.push({msg:tag+' ('+typeText+'): P is not a number.', keys:['P']});
    if(rowType==='moment' && !fin(row.M)) out.push({msg:tag+' ('+typeText+'): M is not a number.', keys:['M']});
  } else {
    if(!fin(row.w)) out.push({msg:tag+' (UDL): w is not a number.', keys:['w']});
  }
  if(rowType!=='moment'){
    if(ledger==='other' && row.e!=null && row.e!=='' && !Number.isFinite(+row.e)) out.push({msg:tag+': e is not a number (mm).', keys:['e']});
    if((row.height||'top')==='custom' && row.zgCustom!=null && row.zgCustom!=='' && !Number.isFinite(+row.zgCustom)) out.push({msg:tag+': custom z_g is not a number (mm).', keys:['zgCustom']});
    if(ledger==='beam' && row.xw!=null && row.xw!=='' && !Number.isFinite(+row.xw)) out.push({msg:tag+': x_w of the load line is not a number (mm).', keys:['xw']});
  }
  return out;
}

/* One ledger row -> one beam-v03 load {type, x1,x2,w | w1,w2 | pos,P | pos,M,
   case, e, zg, ss, stiff, label, wall:{...origin}}. Returns null for an
   unknown row type. Span positions are clamped to [0, L] (m) so the sketch
   and the table still draw a row that wallRowErrors() has refused. */
function wallRowToLoad(row, ledger, i, P, sec, st, L){
  const lg=WALL_LEDGER_MAP[ledger]||{label:ledger};
  const rowType=row.type||'udl', type=rowType==='pudl'? 'udl' : rowType;
  if(!['udl','trap','point','moment'].includes(type)) return null;
  const clamp=v=>Math.min(Math.max(Number.isFinite(+v)? +v : 0,0),L);
  const cs=['G','Q','W','E'].includes(row.case)? row.case : 'G';
  const isMoment=type==='moment';
  let xwLoad, e, eSource;
  if(ledger==='outer'){ xwLoad=P.layout.outer.centre; eSource='outer leaf centre t1/2'; }
  else if(ledger==='inner'){ xwLoad=P.layout.inner? P.layout.inner.centre : P.xsc; eSource='inner leaf centre t1 + c + t2/2'; }
  else if(ledger==='beam'){
    const typed=row.xw!=null && row.xw!=='' && Number.isFinite(+row.xw);
    xwLoad=typed? +row.xw : P.xsc; eSource=typed? 'typed x_w' : 'through the shear centre';
  } else { e=Number.isFinite(+row.e)? +row.e : 0; xwLoad=P.xsc+e; eSource='typed e'; }
  if(e===undefined) e=xwLoad-P.xsc;
  e=+e.toFixed(2);
  const height=row.height||'top';
  const custom=row.zgCustom!=null? row.zgCustom : row.zg;
  const zg=isMoment? null : +zgFor(height, sec, custom).toFixed(2);
  const load={type, case:cs, label:String(row.label||'')};
  if(type==='point'){
    load.pos=clamp(row.pos); load.P=Number.isFinite(+row.P)? +row.P : 0;
    if(row.ss!=null && row.ss!=='' && Number.isFinite(+row.ss)) load.ss=+row.ss;   // stiff bearing length: beam-v03's own field, untouched
    if(row.stiff) load.stiff=true;
  } else if(isMoment){
    load.pos=clamp(row.pos); load.M=Number.isFinite(+row.M)? +row.M : 0;
  } else if(rowType==='udl'){
    load.x1=0; load.x2=L; load.w=Number.isFinite(+row.w)? +row.w : 0;
  } else if(rowType==='pudl'){
    let x1=clamp(row.x1), x2=clamp(row.x2); if(x2<x1){ const t=x1; x1=x2; x2=t; }
    load.x1=x1; load.x2=x2; load.w=Number.isFinite(+row.w)? +row.w : 0;
  } else {
    let x1=clamp(row.x1), x2=clamp(row.x2); if(x2<x1){ const t=x1; x1=x2; x2=t; }
    load.x1=x1; load.x2=x2; load.w1=Number.isFinite(+row.w1)? +row.w1 : 0; load.w2=Number.isFinite(+row.w2)? +row.w2 : 0;
  }
  if(!isMoment){ load.e=e; load.zg=zg; }
  const mag=wallLoadMagText(load);
  const text=lg.label+': '+(load.label? load.label+' ' : '')+mag+(isMoment
    ? ' (a moment carries no e / z_g)'
    : ' at x_w = '+wallNum(xwLoad)+' mm ('+eSource+'), e = '+wallSigned(e)+' mm, z_g = '+wallSigned(zg,1)+' mm ('+zgChoiceText(height, sec, custom)+')');
  load.wall={ledger, ledgerLabel:lg.label, i, id:row.id||null, tag:wallRowTag(ledger, i), rowType, xwLoad, xwSc:P.xsc, eSource, height, heightText:zgChoiceText(height, sec, custom), text};
  return load;
}

/* Plausibility of a masonry / bearing load line against the steel (21 Sep
   2026 review): outer, inner and typed-x_w beam loads must fall on the top
   flange (or top plate); on a bottom-plate outstand they are carried by the
   plate (note: plate not designed here); outside the steel altogether they
   need a bearing detail (warning). 'other' loads (typed e: brackets, hangers)
   are the engineer's own and are not judged. */
function wallLoadLineCheck(ld, P){
  const w=ld.wall; if(!w || ld.type==='moment') return null;
  if(!(w.ledger==='outer' || w.ledger==='inner' || (w.ledger==='beam' && w.eSource==='typed x_w'))) return null;
  const x=w.xwLoad;
  if(x<P.xmin-WALL_TOL || x>P.xmax+WALL_TOL)
    return {warning:w.tag+': load line at x_w = '+wallNum(x)+' mm lies outside the steel ('+wallNum(P.xmin)+' to '+wallNum(P.xmax)+' mm): needs a plate outstand / bearing detail to reach the beam (not designed here).'};
  if(x<P.xTopMin-WALL_TOL || x>P.xTopMax+WALL_TOL)
    return {note:w.tag+': load line at x_w = '+wallNum(x)+' mm is carried by the bottom-plate outstand (top flange '+wallNum(P.xTopMin)+' to '+wallNum(P.xTopMax)+' mm; plate outstand bending / weld not designed here).'};
  return null;
}

/* The whole wall model -> beam-v03 inputs. loads = S.loads (self-weight is
   NOT among them: beam-v03 adds it automatically, PFC centroid offset and
   plate included); eccOn = any e or z_g non-zero, or a channel (its automatic
   self-weight is eccentric and beam-v03 adds that torque only on its
   eccentric path - 21 Sep 2026 review), else beam-v03's plain path runs;
   pfcMirror = S.pfcMirror. placement = placeBeam(); errors = its errors +
   the row errors (both block the report), warnings = its warnings + the
   load-line warnings. Ledgers are generated in WALL_LEDGERS order. */
function wallToLoads(w, sec, st){
  const P=placeBeam(w, sec, st);
  const L=Number.isFinite(+st.L)? +st.L : 0;
  const loads=[], notes=P.notes.slice(), warnings=P.warnings.slice(), rowErrors=[];
  WALL_LEDGERS.forEach(lg=>{
    const rows=(w.ledgers&&w.ledgers[lg.key])||[];
    if(!wallLedgerEnabled(w, lg.key)){
      if(rows.length) notes.push('Inner leaf ledger ignored: solid wall ('+rows.length+' row'+(rows.length>1?'s':'')+' not applied).');
      return;
    }
    rows.forEach((row,i)=>{
      wallRowErrors(row, lg.key, i, L).forEach(e=>rowErrors.push({ledger:lg.key, i, keys:e.keys, msg:e.msg}));
      const ld=wallRowToLoad(row, lg.key, i, P, sec, st, L); if(!ld) return;
      loads.push(ld);
      const chk=wallLoadLineCheck(ld, P);
      if(chk&&chk.warning) warnings.push(chk.warning);
      if(chk&&chk.note) notes.push(chk.note);
    });
  });
  const loadsEcc=loads.some(ld=>ld.type!=='moment' && (Math.abs(ld.e||0)>WALL_TOL || Math.abs(ld.zg||0)>WALL_TOL));
  const swE=(typeof selfWeightEccentricity==='function')? wallWithMirror(st, P.mirror, ()=>+selfWeightEccentricity(sec)||0) : 0;
  const swEcc=Math.abs(swE)>WALL_TOL;
  if(swEcc && !loadsEcc) notes.push('Self-weight eccentric: beam-v03\'s automatic self-weight acts through the centroid, e_sw = '+wallSigned(swE,1)+' mm from the shear centre, so S.eccOn = true although no ledger load is eccentric (beam-v03 adds the self-weight torque on its eccentric path only).');
  const errors=P.errors.concat(rowErrors.map(e=>e.msg));
  return {loads, eccOn:loadsEcc||swEcc, swE, pfcMirror:P.mirror, notes, warnings, placement:P, errors, rowErrors, ok:errors.length===0};
}

/* Text / table material of the "Wall model and load derivation" block
   (plain strings and numbers, no HTML: js/wall/04-wall-report.js renders
   them). res = wallToLoads() result. */
function formatPlacement(P, sec){
  const lay=P.layout, lines=[];
  const mat=k=>(typeof wallMaterial==='function'? wallMaterial(k).label : k);
  lines.push('Wall W = '+wallNum(lay.W,1)+' mm: outer leaf '+mat(lay.outer.mat)+' t1 = '+wallNum(lay.t1,1)+' mm [0, '+wallNum(lay.t1,1)+']'
    +(lay.cavity? ', cavity c = '+wallNum(lay.c,1)+' mm ['+wallNum(lay.cavity.x1,1)+', '+wallNum(lay.cavity.x2,1)+']'+(lay.cavity.insulation? ' ('+lay.cavity.insulation+')' : '')
      +', inner leaf '+mat(lay.inner.mat)+' t2 = '+wallNum(lay.t2,1)+' mm ['+wallNum(lay.inner.x1,1)+', '+wallNum(lay.inner.x2,1)+']' : ' (solid wall)')+'.');
  lines.push('Beam '+(sec&&sec.key? sec.key : '')+', B = '+wallNum(P.B,1)+' mm'+(P.ext.plate? ' with a '+(P.ext.plate.side||'bottom')+' plate '+wallNum(P.ext.plate.w,1)+' x '+wallNum(P.ext.plate.t,1)+' mm (outstands '+wallNum(P.ext.plate.oL,1)+' outside / '+wallNum(P.ext.plate.oR,1)+' inside)' : '')
    +', total width '+wallNum(P.width,1)+' mm vs W - 2r = '+wallNum(P.available,1)+' mm (r = '+wallNum(P.r,1)+' mm).');
  lines.push('Placement '+P.modeText+(Math.abs(P.ext.scX)>WALL_TOL? ' (channel, web toward the '+(P.mirror? 'inside' : 'outside')+')' : '')+'.');
  lines.push('Centroid x_w,c = '+wallNum(P.xc)+' mm; shear centre x_w,sc = '+wallNum(P.xsc)+' mm'+(Math.abs(P.ext.scX)>WALL_TOL? ' (= x_w,c '+wallSigned(P.ext.scX,1)+')' : ' (= centroid)')
    +'; extreme fibres x_w = '+wallNum(P.xmin)+' / '+wallNum(P.xmax)+' mm; clearance to the external / internal face '+wallNum(P.clearances.outer,1)+' / '+wallNum(P.clearances.inner,1)+' mm (r = '+wallNum(P.r,1)+').');
  const bearing=lay.leaves.map(lf=>lf.label+': '+wallBearingText(P.under[lf.key]));
  lines.push('Bearing (top flange x_w '+wallNum(P.xTopMin)+' to '+wallNum(P.xTopMax)+' mm'+(P.plateX? ', bottom plate '+wallNum(P.plateX.x1)+' to '+wallNum(P.plateX.x2)+' mm' : '')+') - '+bearing.join('; ')+'.');
  if(P.cavity && P.cavity.whole) lines.push('The beam sits wholly in the cavity with '+wallNum(P.cavity.clearance,1)+' mm to the nearer leaf face.');
  return lines;
}
function formatDerivation(res, sec){
  const P=res.placement||res;
  const rows=(res.loads||[]).map(ld=>{
    const wl=ld.wall||{};
    const isM=ld.type==='moment';
    return {
      load:(ld.label? ld.label+' - ' : '')+wallLoadMagText(ld)+' ['+ld.case+']',
      leaf:wl.ledgerLabel||'',
      xwLoad:isM? null : wl.xwLoad, xwSc:isM? null : wl.xwSc,
      e:isM? null : ld.e, zg:isM? null : ld.zg,
      xwLoadText:isM? '-' : wallNum(wl.xwLoad)+' mm ('+wl.eSource+')',
      xwScText:isM? '-' : wallNum(wl.xwSc)+' mm',
      eText:isM? '-' : wallSigned(ld.e)+' mm', zgText:isM? '-' : wallSigned(ld.zg,1)+' mm ('+(wl.heightText||'')+')',
      beamLoad:ld.case+' '+wallLoadMagText(ld)+(isM? '' : ' e = '+wallSigned(ld.e)+' mm z_g = '+wallSigned(ld.zg,1)+' mm'),
      text:wl.text||''
    };
  });
  return {placement:formatPlacement(P, sec), rows, lines:rows.map(r=>r.text),
    eccOn:!!res.eccOn, swE:res.swE||0, pfcMirror:!!res.pfcMirror, notes:res.notes||[], warnings:res.warnings||P.warnings||[], errors:res.errors||P.errors||[]};
}
