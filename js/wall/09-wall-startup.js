/* Beam in Wall startup (wall.html, 20 Sep 2026). Replaces js/09-startup.js
   on this page: beam-v03's own four startup steps in the same order, with
   the wall panels wired between them so the generic demo loads of DEMO are
   never rendered - syncWall() writes S.loads / S.eccOn / S.pfcMirror from
   the ledgers and renders once, synchronously (immediate), the way
   js/09-startup.js renders once. wireWall() registers its listeners AFTER
   wire(), so on every shared event (span, section, plate, reset) beam-v03's
   handler runs first and the ledgers have the last word. wallApplyDemoBeam()
   (21 Sep 2026) writes the wall demo's span and plate (WALL_DEMO_SPAN,
   WALL_DEMO_PLATE) over beam-v03's DEMO before the first render. */
syncInputs();
wire();
wireWall();
wallApplyDemoBeam();
fillWallPanels();
syncWall({immediate:true});
installDiagramHover();   // one delegated hover-readout listener set for the analysis diagrams (js/05-diagrams.js)
