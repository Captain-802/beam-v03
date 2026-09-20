/* ===========================================================================
   W1. BEAM IN WALL - STATE   (js/wall/01-wall-state.js, 20 Sep 2026)
   The cavity-wall model that replaces beam-v03's generic load editor on
   wall.html. Pure data + pure row builders: no DOM, no engine call. The
   beam-v03 state S (js/03-state-ui.js) is untouched here; syncWall()
   (js/wall/03-wall-ui.js) writes S.loads / S.eccOn / S.pfcMirror from
   wallToLoads() (js/wall/02-wall-geometry.js).

   Wall axis x_w (mm) runs from the EXTERNAL face of the outer leaf inward:
     outer leaf [0, t1] | cavity [t1, t1 + c] | inner leaf [t1 + c, W],
     W = t1 + c + t2. A solid wall is t2 = 0 (and c = 0): one leaf of t1.
   The beam's own +x (js/05-section-view.js: + toward the flange tips of an
   unmirrored channel) always points INWARD (+x_w), so
     e_beamv03 = x_w,load - x_w,shear-centre   (mm, beam-v03 sign convention).
   Owner decisions (20 Sep 2026): a leaf load acts at the LEAF CENTRE; load
   height per load from a drop-list (top flange +D/2 default); plate outstand
   bending / weld checks out of scope; stiff bearing lengths as beam-v03;
   an "other" ledger takes a typed e and z_g.
   =========================================================================== */

/* Leaf materials: labels for the sketch / report only (no masonry design).
   t = the usual leaf thickness the UI offers when the material is picked
   (null = keep what is typed); hatch = the sketch hatch family. */
const WALL_MATERIALS=[
  {key:'brick',     label:'Brick 102.5',       t:102.5, hatch:'brick'},
  {key:'block-d100',label:'Dense block 100',   t:100,   hatch:'block'},
  {key:'block-d140',label:'Dense block 140',   t:140,   hatch:'block'},
  {key:'block-d215',label:'Dense block 215',   t:215,   hatch:'block'},
  {key:'block-a100',label:'Aerated block 100', t:100,   hatch:'aac'},
  {key:'block-a140',label:'Aerated block 140', t:140,   hatch:'aac'},
  {key:'block-a215',label:'Aerated block 215', t:215,   hatch:'aac'},
  {key:'stone',     label:'Stone',             t:null,  hatch:'stone'},
  {key:'concrete',  label:'Concrete',          t:null,  hatch:'concrete'},
  {key:'timber',    label:'Timber frame',      t:null,  hatch:'timber'},
  {key:'custom',    label:'Custom',            t:null,  hatch:'plain'}
];
const WALL_MATERIAL_MAP=Object.fromEntries(WALL_MATERIALS.map(m=>[m.key,m]));
function wallMaterial(key){ return WALL_MATERIAL_MAP[key]||WALL_MATERIAL_MAP.custom; }

/* Beam placement modes: ONE typed number, the recess r (mm, >= 10: the mortar
   / pointing cover so the steel is not seen), plus the mode. The extreme
   fibres (plate outstands included) come from sectionViewGeometry /
   plateGeom (js/05-section-view.js, js/02-section-data.js). */
const WALL_RECESS_MIN=10;                       // mm, hard minimum (owner rule)
const WALL_PLACEMENTS=[
  {key:'flush-inside',  label:'Flush inside (innermost fibre at W - r)'},
  {key:'flush-outside', label:'Flush outside (outermost fibre at r)'},
  {key:'cavity-centre', label:'Cavity centre (centroid at t1 + c/2)'},
  {key:'wall-centre',   label:'Wall centre (centroid at W/2)'},
  {key:'custom',        label:'Custom (centroid x_w typed)'}
];

/* Load height choices: z_g from the shear centre, + = above = destabilising
   (EN 1993-1-1 / SN003a sign, beam-v03's own). 'plate' = underside of the
   welded bottom plate (-D/2 - t; a hanger load on the plate outstand) or, with
   the plate on top, its top (+D/2 + t): wallHeightOptions() (02-wall-geometry)
   relabels it and offers it only while the plate is on; wallNormaliseHeights()
   maps rows left at 'plate' back to the flange when the plate is switched off
   (21 Sep 2026 review: the select and the applied z_g must never disagree). */
const WALL_HEIGHTS=[
  {key:'top',    label:'top flange (+D/2)'},
  {key:'bottom', label:'bottom flange (-D/2)'},
  {key:'sc',     label:'shear centre (0)'},
  {key:'plate',  label:'plate underside (-D/2 - t)'},
  {key:'custom', label:'custom (mm, + above the shear centre)'}
];

/* The four ledgers, in the order they are generated into S.loads. */
const WALL_LEDGERS=[
  {key:'outer', label:'Outer leaf',  note:'acts at the outer leaf centre, x_w = t1/2'},
  {key:'inner', label:'Inner leaf',  note:'acts at the inner leaf centre, x_w = t1 + c + t2/2 (disabled for a solid wall)'},
  {key:'beam',  label:'On the beam', note:'acts through the shear centre (e = 0) unless an x_w is typed'},
  {key:'other', label:'Other loads', note:'e (mm, beam-v03 convention: + toward the inside) and z_g typed by the engineer'}
];
const WALL_LEDGER_MAP=Object.fromEntries(WALL_LEDGERS.map(l=>[l.key,l]));

/* Ledger row types. 'udl' = the full span (x1 / x2 follow S.L at generation
   time); 'pudl' = partial UDL over the typed x1-x2; 'trap' = trapezoidal
   w1 -> w2 over x1-x2 (beam-v03's 'trap'); 'point' = P at pos; 'moment' =
   M at pos (no e / z_g: a moment has no line of action). */
const WALL_ROW_TYPES=[
  {key:'udl',   label:'UDL (full span)'},
  {key:'pudl',  label:'Partial UDL'},
  {key:'trap',  label:'Trapezoidal'},
  {key:'point', label:'Point load'},
  {key:'moment',label:'Applied moment'}
];

let wallRowSeq=0;                               // row ids for the UI's add / remove
/* One ledger row with beam-v03-style fields. L (m) sets the span defaults. */
function wallNewRow(ledger, type, L, overrides){
  L=Number.isFinite(+L)? +L : 4;
  const row={
    id:'w'+(++wallRowSeq), type:type||'udl', label:'', case:'G',
    w:10, w1:0, w2:10, x1:0, x2:L,              // kN/m, m
    P:10, M:10, pos:+(L/2).toFixed(3),          // kN, kN.m, m
    height:'top', zgCustom:0,                   // load height choice (WALL_HEIGHTS) + custom z_g (mm); top flange for EVERY ledger (owner: "defaulting to top flange"; 21 Sep 2026 review - the other ledger too, its typed value is the e; a typed z_g is the 'custom' choice)
    xw:null,                                    // 'beam' ledger only: typed x_w of the load line (null = shear centre)
    e:0,                                        // 'other' ledger only: typed eccentricity from the shear centre (mm)
    ss:null, stiff:false                        // point loads: stiff bearing length (mm, null = beam-v03 lower bound 0) and stiffener flag, passed through unchanged
  };
  return Object.assign(row, overrides||{});
}

/* Demo wall (owner's demo, 20 Sep 2026): brick 102.5 outer leaf, 100 cavity,
   100 aerated-block inner leaf (W = 302.5) with the DEMO UB 457 x 191 x 82
   of beam-v03 flush inside at r = 10; outer leaf UDL 6 kN/m G, inner leaf
   UDL 19.7 G + 19.8 Q (beam-v03's own demo loads), all at the top flange -
   the worked example of tests/wall/geometry.test.cjs (e = -145.6 / +55.65 mm,
   z_g = +230 mm). WALL_DEMO_SPAN (m) is written into beam-v03's S.L by the
   page at startup and on Reset (js/wall/03-wall-ui.js wallApplyDemoSpan):
   beam-v03's own DEMO.L = 8 m fails deflection with these loads and the wall
   demo on top of it failed at 2.54 on the P385 bending + torsion check
   (21 Sep 2026 review); at 4 m - a lintel span - the demo passes (governing
   web transverse force 0.30 fully restrained, LTB + torsion 0.57 unrestrained)
   and the outer-leaf load line at x_w = 51.25 mm is carried by a 90 mm bottom
   plate outstand (WALL_DEMO_PLATE -> S.plate), so the demo shows the plate
   bearing note rather than the "load line outside the steel" warning. */
const WALL_DEMO_SPAN=4;                                          // m
const WALL_DEMO_PLATE={on:true, side:'bottom', t:10, outL:90, outR:0};   // outstand 90 mm toward the outside: plate from x_w = 11.2 to 292.5 mm under the demo UB
const WALL_DEMO={
  t1:102.5, mat1:'brick',      chased1:true,   // chased: the leaf is cut over the beam, so a beam fibre inside it is intended (false = warning when the beam intrudes)
  c:100,    insulation:'',                     // cavity width (mm) and an insulation label (sketch / report only)
  t2:100,   mat2:'block-a100', chased2:true,
  recess:10, placement:'flush-inside', xcCustom:150,   // r (mm), mode, custom centroid x_w (mm)
  pfcWebFaces:'outside',                       // channel only: 'outside' = web back toward the external face (S.pfcMirror false) | 'inside' (S.pfcMirror true)
  ledgers:{
    outer:[wallNewRow('outer','udl',8,{label:'outer leaf masonry', w:6,    case:'G'})],
    inner:[wallNewRow('inner','udl',8,{label:'inner leaf + floor', w:19.7, case:'G'}),
           wallNewRow('inner','udl',8,{label:'floor imposed',      w:19.8, case:'Q'})],
    beam:[], other:[]
  }
};
let WALL=JSON.parse(JSON.stringify(WALL_DEMO));
function wallIsSolid(w){ return !((+w.t2||0)>0); }            // one leaf: t2 = 0 (c is then ignored)
function wallLedgerEnabled(w, ledger){ return !(ledger==='inner' && wallIsSolid(w)); }
