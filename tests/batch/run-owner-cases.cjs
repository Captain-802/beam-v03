'use strict';
/* ===========================================================================
   Owner comparison matrix runner (20 Sep 2026)
   ---------------------------------------------------------------------------
   Loads the app through tests/harness.cjs (Node vm, no DOM) and runs every
   case of tests/batch/owner-cases.cjs - both M_cr methods ('eigen' and
   'standard') when restraint === 'ltb', once ('full') when fully restrained,
   not at all when the case carries `refuse` (documented refusal). A thrown
   validation error is caught and recorded as REFUSED with the message; a
   JavaScript error (TypeError / ReferenceError / RangeError) is an ERROR.
   Writes
     docs/owner-cases/index.md                one row per run + verdict counts,
                                              "Comparison" column blank for the
                                              MasterSeries figures
     docs/owner-cases/coverage.md             owner phrase -> mapping -> COVERED /
                                              APPROXIMATED / NOT COVERED
     docs/owner-cases/runs.json               the run records (used by the PDF merge)
     docs/owner-cases/briefs/<id>-<method>.html
                                              the MasterSeries-format brief of the
                                              run (renderMasterSeriesBrief) as a
                                              standalone page with the app CSS and
                                              a print stylesheet (A4 portrait)
     docs/owner-cases/cover.html              index table for the merged PDF cover
   Options
     --pdf     print the cover and every brief whose PDF is missing or older than
               its HTML with headless Edge (C:\Program Files (x86)\Microsoft\Edge\
               Application\msedge.exe, absolute Windows paths, one job at a time:
               the launch hands the job to Edge's background instance and returns
               at once, so the runner waits for the file to appear and settle);
               --pdf-all reprints everything (~4 s per brief)
     --merge   merge cover + briefs (index order) into docs/owner-cases/ALL-BRIEFS.pdf
               with PyMuPDF (python -c "import fitz")
     <id-substring ...>  run a subset (ids containing any of the substrings)
   Usage:  node tests/batch/run-owner-cases.cjs [--pdf [--pdf-all]] [--merge] [id-substring ...]
   =========================================================================== */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');
const { app } = require('../harness.cjs');
const { cases, SECTIONS, OWNER, constants } = require('./owner-cases.cjs');
const PFC_SEC = SECTIONS.find(s => s.tag === 'PFC');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'docs', 'owner-cases');
const BRIEFS = path.join(OUT, 'briefs');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const argv = process.argv.slice(2);
const flags = new Set(argv.filter(a => a.startsWith('--')));
const filter = argv.filter(a => !a.startsWith('--'));
const selected = filter.length ? cases.filter(c => filter.some(f => c.id.includes(f))) : cases;
fs.mkdirSync(BRIEFS, { recursive: true });

const ctx = app();

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
const num = v => (typeof v === 'number' && Number.isFinite(v)) ? v : null;
const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&ndash;': '-', '&mdash;': '-', '&times;': 'x', '&middot;': '.', '&plusmn;': '+/-', '&deg;': 'deg', '&psi;': 'psi', '&mu;': 'mu', '&lambda;': 'lambda', '&chi;': 'chi', '&alpha;': 'alpha', '&eta;': 'eta', '&kappa;': 'kappa', '&phi;': 'phi', '&Phi;': 'Phi', '&radic;': 'sqrt', '&sup2;': '^2', '&sup3;': '^3', '&prime;': "'", '&le;': '<=', '&ge;': '>=', '&minus;': '-', '&bull;': '*', '&rsquo;': "'", '&nbsp;': ' ', '&epsilon;': 'eps', '&gamma;': 'gamma', '&delta;': 'delta', '&#772;': '', '&rarr;': '->' };
const stripHtml = s => String(s).replace(/<[^>]+>/g, '').replace(/&[a-z]+;|&#\d+;/gi, m => (ENT[m] != null ? ENT[m] : ''));
const fmt = (v, d = 3) => (v == null || !Number.isFinite(v)) ? '-' : (+v).toFixed(d);
// a utilisation: the engine marks an exhausted resistance with 99 (V_pl,T,Rd = 0, Annex A amplifier unbounded);
// a ratio over a vanished resistance can come out astronomically large - both print as '>= 99 (capacity exhausted)'
const fmtU = v => (v == null || !Number.isFinite(v)) ? '-' : v >= 99 ? '>= 99 (capacity exhausted)' : (+v).toFixed(3);
// write only when the content changed (keeps the mtime, so --pdf reprints only the briefs that changed)
const writeIfChanged = (file, text) => { if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === text) return false; fs.writeFileSync(file, text); return true; };
const mdEsc = s => String(s).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
const htmlEsc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fileUrl = p => 'file:///' + path.resolve(p).replace(/\\/g, '/').replace(/ /g, '%20');

// ---------------------------------------------------------------------------
// standalone brief page: the app CSS inline + a print stylesheet (A4 portrait,
// 12 px base font, the .ms-brief panel full width, tables unsplit, the
// loading / BMD sketch capped at 280 px so it never forces a page break)
// ---------------------------------------------------------------------------
const APP_CSS = fs.readFileSync(path.join(ROOT, 'css', 'beam-design.css'), 'utf8');
const PRINT_CSS = `
  /* ---- owner-cases brief page (tests/batch/run-owner-cases.cjs) ---- */
  html,body{width:auto; height:auto; overflow:visible;}
  body{background:#fff; margin:0; padding:12px 14px; font-size:12px; -webkit-print-color-adjust:exact; print-color-adjust:exact;}
  .oc-head{font-family:Arial,Helvetica,sans-serif; font-size:11px; color:#333; border-bottom:1px solid #999; padding-bottom:4px; margin-bottom:6px; line-height:1.35;}
  .oc-head b{color:#1a237e;}
  .oc-head .oc-v{font-weight:700;}
  .oc-head .oc-v.PASS{color:#166534;} .oc-head .oc-v.FAIL,.oc-head .oc-v.REFUSED,.oc-head .oc-v.ERROR{color:#c00000;} .oc-head .oc-v.NV{color:#b45309;}
  .ms-brief{width:100%; max-width:none; margin:0; padding:6px 8px 8px; font-size:12px;}
  .ms-brief.ms-fail{background:#dbe6f5;}
  .ms-row{grid-template-columns:minmax(170px,30%) 1fr minmax(110px,15%) minmax(80px,11%);}
  .ms-sketch{max-height:280px; overflow:hidden;}
  .ms-sketch svg.diag{max-height:136px; width:auto; max-width:100%; margin:0 auto;}
  .ms-loading{grid-template-columns:minmax(0,1fr) 300px; max-height:280px; overflow:hidden;}
  .ms-forces,.ms-combos,table{break-inside:avoid; page-break-inside:avoid;}
  .ms-unity-head{font-size:9px;}
  .oc-refusal{font-family:Arial,Helvetica,sans-serif; font-size:12px; border:2px solid #c00000; background:#fdecec; padding:10px 12px; line-height:1.45;}
  .oc-refusal h2{margin:0 0 6px; font-size:14px; color:#c00000;}
  @media print{
    @page{size:A4 portrait; margin:10mm;}
    body{padding:0; font-size:12px;}
    .ms-brief{border:0; padding:0; font-size:12px;}
    .ms-brief.ms-fail{background:#dbe6f5;}
    .ms-row,.ms-unity,.ms-forces,.ms-combos,.ms-title,.ms-loading,table{break-inside:avoid; page-break-inside:avoid;}
    .ms-h,.ms-sub{break-after:avoid; page-break-after:avoid;}
    .ms-sketch{max-height:280px; overflow:hidden;}
  }
`;
function briefPage(rec, bodyHtml) {
  const vcls = rec.verdict === 'NOT VERIFIED' ? 'NV' : rec.verdict;
  const head = '<div class="oc-head"><b>' + htmlEsc(rec.id) + '</b> &middot; ' + htmlEsc(rec.section) + ' &middot; M<sub>cr</sub> method: ' + htmlEsc(rec.method) +
    ' &middot; verdict <span class="oc-v ' + vcls + '">' + htmlEsc(rec.verdict) + '</span>' + (rec.gov ? ' &middot; governing ' + htmlEsc(rec.gov.name) + ' = ' + fmtU(rec.gov.val) : '') +
    '<br>Owner case: ' + htmlEsc(rec.owner) + '<br>' + htmlEsc(rec.title) + '</div>';
  return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>' + htmlEsc(rec.id + ' ' + rec.method) + '</title><style>' + APP_CSS + PRINT_CSS + '</style></head><body>' + head + bodyHtml + '</body></html>';
}

// ---------------------------------------------------------------------------
// one run = one case x one Mcr method
// ---------------------------------------------------------------------------
const TORSION_UTILS = [
  ['p385', /P385 3\.1\.2/],
  ['vt', /Shear\+torsion/],
  ['annexA', /LTB\+torsion/],
  ['boxT', /^Torsion  T_Ed\/T_Rd/],
];
function runOne(cs, method) {
  const rec = { id: cs.id, variant: cs.variant, section: cs.section, sectionTag: cs.sectionTag, owner: cs.owner, title: cs.title, method, restraint: cs.overrides.restraint, file: cs.id + '-' + method + '.html' };
  if (cs.refuse) {
    rec.verdict = 'REFUSED';
    rec.messages = [cs.refuse];
    rec.refusal = cs.refuse;
    return rec;
  }
  const o = JSON.parse(JSON.stringify(cs.overrides));
  o.mcrMethod = method === 'full' ? 'eigen' : method;
  ctx.reset(o);
  const t0 = process.hrtime.bigint();
  let out;
  try {
    out = ctx.run(`(()=>{ const a=analyse(); const c=checks(a); const html=renderMasterSeriesBrief(a,c,a.sec); return {a,c,html}; })()`);
  } catch (e) {
    const name = e && e.name;
    rec.error = stripHtml(e && e.message ? e.message : e);
    rec.verdict = /^(TypeError|ReferenceError|RangeError|SyntaxError)$/.test(name) ? 'ERROR' : 'REFUSED';
    rec.messages = [rec.error];
    rec.refusal = rec.error;
    rec.ms = Number(process.hrtime.bigint() - t0) / 1e6;
    return rec;
  }
  rec.ms = Number(process.hrtime.bigint() - t0) / 1e6;
  const { a, c, html } = out;
  const utils = c.utils || [];
  rec.verdict = c.pass ? 'PASS' : utils.some(u => !Number.isFinite(u.val) || u.val > 1.0001) ? 'FAIL' : 'NOT VERIFIED';
  rec.gov = { name: stripHtml(c.gov.name), val: num(c.gov.val) };
  rec.utils = utils.map(u => ({ name: stripHtml(u.name), val: num(u.val) }));
  rec.cls = c.clsName ? stripHtml(c.clsName) : null;
  rec.Mmax = num(a.Mmax); rec.McRd = num(c.McRd);
  rec.deflRatio = (c.dlimit > 0) ? c.dmax / c.dlimit : null;
  rec.dmax = num(c.dmax); rec.dlimit = num(c.dlimit);
  rec.messages = (c.unsupported || []).map(stripHtml);
  rec.advisory = (c.advisory || []).map(stripHtml);
  rec.torsionMethod = (c.tor && c.tor.p385) ? c.tor.method : (c.tor && c.tor.box ? 'box' : null);
  TORSION_UTILS.forEach(([k, re]) => { const u = utils.find(x => re.test(x.name)); rec[k] = u ? num(u.val) : null; });
  // ---- LTB quantities behind the printed utilisation (same reading as tests/batch/run-batch.cjs) ----
  const L = c.ltb || null;
  rec.Mcr = null; rec.C1 = null; rec.MbRd = null; rec.ltbUtil = num(c.ltbUtil);
  if (method === 'full') {
    rec.MbRd = num(c.McRd);   // M_b.Rd = M_c.y.Rd, fully restrained
  } else if (L) {
    rec.ltbBasis = stripHtml(c.ltbBasis || '');
    if (L.failed) { rec.MbRd = 0; rec.ltbFailed = stripHtml(L.err || ''); }
    else if (method === 'eigen' && L.eigen) {
      const sg = L.spanGoverns ? L.spanGov : null;
      rec.Mcr = num(sg ? sg.Mcr : L.Mcr); rec.C1 = num(L.C1); rec.MbRd = num(sg ? sg.Mb : L.MbRd);
      rec.McrStd = num(L.McrStandard); rec.spanGoverns = !!L.spanGoverns;
    } else if (L.channel) {
      // Channel on the standard route (20 Sep 2026 review): the design basis is the P385/P362 kappa
      // chain, whose M_cr is the back-calculated W_y f_y / lambda_LT^2 (L.McrBack) - the value behind
      // the printed M_b.Rd. The engine's L.McrStandard switches meaning: it is the SN003a shear-centre
      // M_cr when that route is offered (no torsion, z_g = 0, fork ends - L1 only) and McrBack
      // otherwise, so the index prints McrBack in the M_cr column consistently and carries the SN003a
      // value separately (rec.McrSN003a, shown in the column in brackets).
      rec.Mcr = num(L.McrBack != null ? L.McrBack : L.Mcr);
      rec.McrSN003a = (L.chanMcr && L.chanMcr.Mcr != null) ? num(L.chanMcr.Mcr) : null;
      rec.C1 = num(L.C1show != null ? L.C1show : c.C1);
      rec.MbRd = num(L.MbRd);
      rec.stdBasis = /M.?cr.? method/i.test(rec.ltbBasis) ? 'Mcr route' : 'channel kappa chain';
    } else {
      rec.Mcr = num(L.McrStandard != null ? L.McrStandard : L.Mcr);
      rec.C1 = num(L.C1show != null ? L.C1show : c.C1);
      rec.MbRd = num(L.MbRd);
      rec.stdBasis = 'Mcr route';
    }
    rec.zg = num(L.zg);
  }
  rec.html = briefPage(rec, html);
  return rec;
}

// ---------------------------------------------------------------------------
// refusal page (a case the tool does not model, or a thrown validation)
// ---------------------------------------------------------------------------
function refusalPage(rec) {
  return briefPage(rec, '<div class="oc-refusal"><h2>' + htmlEsc(rec.verdict) + ' &mdash; not run</h2><div>' + htmlEsc(rec.refusal) + '</div>' +
    '<div style="margin-top:8px;color:#333">Owner case: ' + htmlEsc(rec.owner) + '</div></div>');
}

// ---------------------------------------------------------------------------
// run everything
// ---------------------------------------------------------------------------
const runs = [];
for (const cs of selected) {
  const methods = cs.refuse ? ['refused'] : cs.overrides.restraint === 'ltb' ? ['eigen', 'standard'] : ['full'];
  for (const m of methods) {
    const rec = runOne(cs, m);
    if (rec.verdict === 'REFUSED' || rec.verdict === 'ERROR') rec.html = refusalPage(rec);
    writeIfChanged(path.join(BRIEFS, rec.file), rec.html);
    delete rec.html;
    runs.push(rec);
    process.stdout.write(`${rec.id.padEnd(9)} ${rec.method.padEnd(9)} ${rec.verdict.padEnd(13)} ${(rec.gov ? rec.gov.name + ' = ' + fmtU(rec.gov.val) : (rec.refusal || '').slice(0, 70)).padEnd(72)} Mcr ${fmt(rec.Mcr, 1).padStart(8)}  Mb ${fmt(rec.MbRd, 1).padStart(7)} ${fmt(rec.ms, 0).padStart(6)} ms\n`);
  }
}

// ---------------------------------------------------------------------------
// index.md
// ---------------------------------------------------------------------------
const counts = {};
runs.forEach(r => { counts[r.verdict] = (counts[r.verdict] || 0) + 1; });
const nCases = selected.length;
const md = [];
md.push('# Owner comparison matrix - beam-v03 vs MasterSeries');
md.push('');
md.push(`Generated ${new Date().toISOString().slice(0, 10)} by \`node tests/batch/run-owner-cases.cjs\` from \`tests/batch/owner-cases.cjs\` (the owner's Notepad list \`docs/owner-cases-2026-09-20.txt\`; mapping of every owner phrase in [coverage.md](coverage.md)). ${nCases} cases, ${runs.length} runs. Briefs: [briefs/](briefs/) (one HTML per run, MasterSeries format) and [ALL-BRIEFS.pdf](ALL-BRIEFS.pdf).`);
md.push('');
md.push('**Common basis:** S275, one span L = 6.0 m, simply supported fork ends (U_x U_y U_z R_x at End 1, U_y U_z R_x at End 2, warping free, 100 mm seatings), EC3 (EN 1993-1-1 + UK NA), unrestrained between the ends unless the variant says fully restrained, ULS 1.35G + 1.5Q, SLS 1.0Q; base loading G UDL 10 kN/m + Q UDL 8 kN/m full span + Q point 30 kN at 2.0 m (self-weight automatic). ' +
  `L6 inclined load: 30 kN at ${constants.INC_DEG} deg from the vertical at ${constants.INC_X} m = vertical ${constants.INC_V} kN + horizontal ${constants.INC_H} kN, modelled as the vertical component (Q, factored by the combination) + a constant M_z,Ed = ${constants.INC_MZ_ED} kN.m = ${constants.GAMMA_Q} x ${constants.INC_MZ} (the tool's M_z is a ULS design value entered directly; approximation, see coverage.md). L7 couple: ${constants.COUPLE} kN.m (Q, factored) at ${constants.COUPLE_X} m. L5..L7 axial: N_Ed = ${constants.N_AX} kN compression, U_x at End 1 - the ULS design value entered directly (not factored; = ${constants.N_AX / constants.GAMMA_Q} kN imposed in MasterSeries).`);
md.push('');
md.push('**MasterSeries comparison (20 Sep 2026):** 14 MasterFrame models (their own spans and loads, sized so that most checks pass) were analysed and designed live in MasterSeries 2025.20.11 (MasterKey Steel, EN 1993-1-1 UK NA) and every printout transcribed against the beam-v03 run of the same input: [masterseries/README.md](masterseries/README.md) (summary table and findings) and [masterseries/COMPARISON_LOG.md](masterseries/COMPARISON_LOG.md) (line-by-line printouts). The MasterFrame `.$5` model files are in [masterseries/models/](masterseries/models/) and the beam-v03 runner is `masterseries/run-case.cjs`. The Comparison column of the table below is left blank: the MasterSeries runs use the model set above, not this 6 m matrix.');
md.push('');
md.push('**Columns:** method = M_cr method of the run (eigen = FE eigenvalue on the real diagram with per-load z_g and the end flags; standard = SN003a / SN006a / P385 closed forms; full = fully restrained, M_b.Rd = M_c.y.Rd; refused = not run). Verdict PASS / FAIL (a utilisation > 1) / NOT VERIFIED (a blocking message, printed) / REFUSED (a documented refusal or a thrown validation, message printed). M_cr, C1, M_b.Rd in kN.m. C1: eigen = the generalised M_cr(shape) / M_cr(uniform) of the run, standard = the SN003a Table 3.2 / Serna value of the closed form. For a channel on the standard route M_cr is the value behind the P385/P362 kappa chain (W_y f_y / lambda_LT^2, the basis of the printed M_b.Rd); where the engine also offers the SN003a shear-centre M_cr (no torsion, z_g = 0, fork ends: L1 only) that value follows in brackets. Torsion columns: P385 3.1.2 = bending + torsion cross-section, V+T = V_Ed/V_pl,T,Rd, Annex A = EN 1993-6 LTB + torsion, Box T = T_Ed/T_Rd of a hollow section; ">= 99 (capacity exhausted)" = the engine\'s 99 marker (the Annex A amplifier is unbounded because M_y,Ed >= M_cr, or V_pl,T,Rd is exhausted by the torsional shear). Deflection = delta/limit (span/360). Comparison: enter the MasterSeries figures.');
md.push('');
md.push('| id | section | owner case | method | verdict | governing check (util.) | M_cr | C1 | M_b.Rd | P385 3.1.2 | V+T | Annex A | Box T | deflection | blocking / refusal messages | Comparison (MasterSeries) |');
md.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
runs.forEach(r => {
  const msgs = (r.messages || []).map(m => m.length > 240 ? m.slice(0, 237) + '...' : m).join(' // ');
  md.push(`| ${r.id} | ${mdEsc(r.section)} | ${mdEsc(r.variant + ': ' + r.owner)} | ${r.method} | ${r.verdict} | ${r.gov ? mdEsc(r.gov.name) + ' (' + fmtU(r.gov.val) + ')' : '-'} | ${fmt(r.Mcr, 1)}${r.McrSN003a != null ? ' (SN003a ' + fmt(r.McrSN003a, 1) + ')' : ''} | ${fmt(r.C1, 3)} | ${fmt(r.MbRd, 1)} | ${fmtU(r.p385)} | ${fmtU(r.vt)} | ${fmtU(r.annexA)} | ${fmtU(r.boxT)} | ${fmt(r.deflRatio)} | ${mdEsc(msgs || '-')} |  |`);
});
md.push('');
md.push('## Verdict counts');
md.push('');
md.push('| verdict | runs |'); md.push('|---|---|');
['PASS', 'FAIL', 'NOT VERIFIED', 'REFUSED', 'ERROR'].forEach(v => md.push(`| ${v} | ${counts[v] || 0} |`));
md.push(`| total | ${runs.length} |`);
md.push('');
md.push('## Case titles');
md.push('');
selected.forEach(cs => md.push(`- **${cs.id}** - ${cs.title}`));
md.push('');
fs.writeFileSync(path.join(OUT, 'index.md'), md.join('\n'));
// runs.json: the records without the timings (so a rerun with the same figures gives an identical file)
fs.writeFileSync(path.join(OUT, 'runs.json'), JSON.stringify({ generated: new Date().toISOString().slice(0, 10), cases: nCases, runs: runs.map(r => { const o = Object.assign({}, r); delete o.ms; return o; }) }, null, 1));

// ---------------------------------------------------------------------------
// coverage.md - every owner phrase of docs/owner-cases-2026-09-20.txt
// ---------------------------------------------------------------------------
const idsOf = v => runs.filter(r => r.variant === v).map(r => r.id).filter((x, i, a) => a.indexOf(x) === i).join(', ');
const verdictsOf = v => { const c = {}; runs.filter(r => r.variant === v).forEach(r => { c[r.verdict] = (c[r.verdict] || 0) + 1; }); return Object.keys(c).map(k => k + ' ' + c[k]).join(', ') || '-'; };
const COVER = [
  ['vertical loads resulting in no torsion', 'L1', 'COVERED', 'All loads through the shear centre (e = 0, z_g = 0, eccentricity inputs off): bending, shear, LTB (both M_cr routes), web transverse forces, deflection. No torsion block is printed.'],
  ['UC SECTION, UB SECTION, RHS SHS SECTIONS, AND PFC SECTION FOR THE FOLLOWING CASES', 'all', 'COVERED', 'Five sections: UB 457 x 191 x 82, UC 203 x 203 x 60, RHS 200 x 100 x 8.0 (hot finished), SHS 150 x 150 x 6.3 (hot finished), PFC 200 x 75 x 23, all S275, from the MasterSeries 2025 UK library tables in js/sections/. Every load variant runs on every section; the restraint variants on the UB and the PFC.'],
  ['udl point vertical loads acting at horizontal eccentricity from shear center', 'L2', 'COVERED', 'Per-load e = +40 mm on the two UDLs and the point load (torque = load x e): open sections by the P385 Appendix C closed forms (fork ends, warping free) with the P385 3.1.2 bending + torsion cross-section check, V_pl,T,Rd and the EN 1993-6 Annex A LTB + torsion interaction; hollow sections by St Venant box torsion (T_Ed/T_Rd, V+T). PFC twin PFC-L2w: the load line through the web (e = +' + PFC_SEC.e0 + ' mm = P385 Table A.3 e_0; the self-weight sits at the centroid e_sc = ' + PFC_SEC.esc + ' mm and is applied there automatically once the eccentricity inputs are on). Note: the tool applies the torque about the shear centre exactly as entered; MasterSeries applies loads through the shear centre unless a load position is entered.'],
  ['udl point vertical loads acting at vertical + - eccentricity from shear center', 'L3', 'COVERED (eigen) / APPROXIMATED (standard)', 'Per-load z_g = +D/2 (top flange, destabilising, L3t) and z_g = -D/2 (bottom flange, stabilising, L3b) with e = 0. The eigen route carries z_g exactly. The standard route applies C_2 z_g only where SN003a Table 3.2 publishes C_2 (full-span UDL or central point load, simply supported or fixed-ended); the owner\'s mixed UDL + off-centre point-load diagram has no published C_2, so a destabilising z_g BLOCKS the standard run (NOT VERIFIED, message printed) and a stabilising z_g is ignored there (conservative). For the PFC the standard route is the P385/P362 kappa chain, which has no load-height term at all (printed).'],
  ['udl point vertical loads acting at vertical horizontal eccentricity from shear center', 'L4', 'COVERED (eigen) / APPROXIMATED (standard)', 'e = +40 mm and z_g = +D/2 together: torsion as L2 and load height as L3t in one run; the Annex A interaction uses the M_cr of the run. Standard-route load-height block as L3.'],
  ['... and axial load on beam', 'L5', 'APPROXIMATED', 'N_Ed = ' + constants.N_AX + ' kN compression with U_x at End 1 - the ULS DESIGN value: the tool\'s axial input is N_Ed entered directly and not run through the combinations (index.html "Axial F, kN"), so in MasterSeries enter an axial load whose factored value is ' + constants.N_AX + ' kN (' + (constants.N_AX / constants.GAMMA_Q) + ' kN imposed x ' + constants.GAMMA_Q + '). Checks: N_c,Rd (A_eff where the web is Class 4 in compression), M-N cross-section 6.2.9, flexural buckling with the strut lengths from the end fixities, Annex B 6.61 / 6.62 with the LTB M_b.Rd, PFC torsional-flexural buckling 6.3.1.4 - all evaluated and printed. NOT one interaction with the torsion: the tool prints "Combined torsion with direct axial force or imposed minor-axis bending is not implemented as one interaction" and blocks PASS (NOT VERIFIED). Needed for full coverage: a combined N + M_y + M_z + torsion (bimoment) stress check, e.g. the P385 3.1.2 elastic check with the axial stress added, or the EN 1993-6 Annex A form extended with the N terms.'],
  ['load applied at angle on beam', 'L6', 'APPROXIMATED', 'The tool has no lateral (y-direction) load. A further 30 kN point load at 2.0 m inclined ' + constants.INC_DEG + ' deg from the vertical is modelled as its vertical component ' + constants.INC_V + ' kN (with the L4 e and z_g) plus an entered CONSTANT M_z,Ed = ' + constants.INC_MZ_ED + ' kN.m = ' + constants.GAMMA_Q + ' x ' + constants.INC_MZ + ' (the simply supported minor-axis moment of the horizontal component ' + constants.INC_H + ' kN at 2.0 m, H a b / L = ' + constants.INC_MZ + ' kN.m characteristic, factored by gamma_Q because the tool\'s M_z input is the ULS design value M_z,Ed entered directly - corrected in the 20 Sep 2026 review; the first build entered the characteristic value). The constant M_z,Ed is the peak of the true triangular M_z diagram applied along the whole member: the tool takes C_mz = 1.0 (uniform minor-axis moment; js/checks/eurocode-checks.js Cmz = 1.0, the eigen-route Annex A C_mz = 1.0 unless overridden), exact for the constant entered and conservative against the true triangular diagram; no minor-axis shear or deflection is computed, and the torque of the horizontal component acting at z_g (H x z_g = ' + constants.INC_H + ' kN x D/2, e.g. 2.36 kN.m characteristic on the UB, 1.03 kN.m on the PFC) is not modelled. The case is titled as an approximation. Needed: a lateral load list with its own V_z / M_z diagrams, minor-axis deflection, and the torque of lateral loads at their height.'],
  ['EXTERNAL BENDING MOMENT AT ANY POINT ON BEAM, ON SHEAR CENTER AND ABOVE OR BELOW SHEAR CENTER', 'L7', 'COVERED', 'An applied couple ' + constants.COUPLE + ' kN.m (Q) at ' + constants.COUPLE_X + ' m enters the moment diagram as a pure M_y (jump in M, C_1 from the real diagram on both routes, the larger side of the jump at the sampling stations). The "on / above / below the shear centre" variant is NOT a distinct case for a member tool: a couple has no line of action, so it produces no torque (only a force with a lever arm e does) and no load-height effect (the C_2 z_g term is the second-order work of a transverse FORCE moving with the twist; a couple about y-y does none), and its point of application in the cross-section changes nothing in the member statics. The same is true of the standard route (SN003a / MasterSeries treat an applied moment as a diagram value only).'],
  ['TOP FLANGE RESTRAINED', 'R9', 'COVERED (by equivalence)', 'For a sagging simply supported beam the top flange is the compression flange, so a continuously restrained top flange is the fully restrained case: restraint = full, M_b.Rd = M_c.y.Rd (UB-R9, PFC-R9 - identical inputs to R1, kept under the owner\'s heading). The tool has no flange-level restraint input, so a hogging region with the top (tension) flange restrained would not be covered (see the next row).'],
  ['BOTTOM FLANGE RESTREAINED', 'R10', 'NOT COVERED', 'Tension-flange restraint only. The tool\'s restraints (end flags and intermediate v / v\' / phi / phi\') act at the shear centre with no height in the cross-section, so a restraint that holds the tension flange laterally while the compression flange is free cannot be described. Needed: a restraint-height term in the LTB eigen model (lateral constraint at z = -h/2, coupling v and phi) or the tension-flange-restraint method of BS 5950-1 Annex G / SCI P093. Documented refusal UB-R10 / PFC-R10 (REFUSED, not run). Bounds: R2 (unrestrained) is conservative, R9 (fully restrained) is unsafe.'],
  ['FULLY RESTRAINED', 'R1', 'COVERED', 'restraint = full: M_b.Rd = M_c.y.Rd, LTB not checked; torsion, web transverse forces and deflection still evaluated (UB-R1, PFC-R1).'],
  ['RESTRAINED AT SOME POINTS', 'R3', 'COVERED (eigen) / APPROXIMATED (standard)', 'Intermediate lateral restraints at 2.0 and 4.0 m holding v and phi (v\' and phi\' free). The eigen route solves M_cr bay by bay on the real diagram (the governing bay is printed; restraint design forces advisory). The standard route treats the member as ONE segment L_E = L with C_1 from the whole diagram (conservative, advisory printed) - to compare with MasterSeries\' per-portion check read the eigen run, or check each bay separately.'],
  ['PARTIALLY RESTRAINED', 'R11', 'NOT COVERED', 'Elastic (spring) restraint. Every restraint in the tool is rigid or absent (each of v, v\', phi, phi\' held or free), so a lateral or torsional spring of finite stiffness cannot be entered. Needed: lateral / rotational spring stiffness terms in the LTB eigen element matrices (and the warping-torsion FE), a stiffness input per restraint and per end, and the EN 1993-1-1 BB.2 minimum-stiffness test. Documented refusal UB-R11 / PFC-R11 (REFUSED, not run). Bounds: R2 (no restraint) and R3 (rigid restraints at the same positions).'],
  ['WARPING RESTRAINED', 'R4', 'COVERED', 'The warping flag of both ends (phi\' = 0): the LTB eigen model applies it as a boundary condition (SN003a k_w = 0.5 type) and the torsion of the eccentric load is routed to the general warping-torsion FE with phi\' = 0 at both ends (the P385 closed forms assume warping free). The standard M_cr route takes the warping-fixed ends as fork ends, k = k_w = 1 (conservative; advisory printed "clamped / warping-fixed end(s) taken as forks") - the standard-route M_cr of R4 therefore equals R2; its torsion block is the warping-torsion FE with phi\' = 0 (the P385 3.1.2 figure of R4 differs from R2 on both routes).'],
  ['WARPING FREE', 'R5', 'COVERED', 'The default fork end (warping free): identical inputs to R2, kept under the owner\'s heading (UB-R5, PFC-R5).'],
  ['STABILIZING LOADS', 'R7', 'COVERED (eigen) / APPROXIMATED (standard)', 'All loads hung from the bottom flange, z_g = -D/2 (with the L2 e = +40 mm): the eigen route raises M_cr accordingly; the standard route ignores a stabilising z_g on this diagram (no C_2 published) and keeps the shear-centre M_cr (conservative). Also the L3b twins on every section.'],
  ['DESTABLIZING LOADS', 'R6 (and L3t / L4 / L5..L7)', 'COVERED via z_g; the switch alone is blocked on the eigen route (NOT VERIFIED, run kept)', 'The modelled destabilising case is the load height z_g = +D/2 (L3t, L4 and their descendants; R7 is the stabilising twin). R6 ticks the "destabilising" switch with every z_g = 0: the eigen route BLOCKS this contradictory input (the switch is the BS 5950 x1.2 L_E device, the eigenvalue carries the height through z_g; PASS blocked, message printed - the run is kept and its figures are the z_g = 0 ones, verdict NOT VERIFIED unless another check already fails), the standard route applies L_E = 1.2 L (BS 5950 practice) and runs. Compare MasterSeries\' "destabilising" option against the standard run of R6 and the eigen run of L3t.'],
  ['EFFECTIVE LENGTHS OVERRIDE', 'R8', 'COVERED (standard) / not applicable (eigen)', 'L_E = 0.85 L entered (S.leFactor 0.85): the standard route uses L_E = 0.85 x 6.0 m in the SN003a chain (and both strut lengths); the eigen route derives its buckling length from the end flags and does not use the factor for M_cr (the strut lengths take it), so its M_cr equals R2 - read the standard run for the override.'],
  ['ANY TYPE OF LOADS ACTING ALONG BEAM AXIS, X AXIS OR Y AXIS OR Z AXIS', '-', 'z: COVERED; x: APPROXIMATED; y: NOT COVERED', 'z-axis (vertical): point, UDL, trapezoidal and couple loads by case G / Q / W / E, partial span, with e and z_g per load - COVERED. x-axis (along the member): a single constant N_Ed (compression or tension) with U_x at one or both ends only; a distributed or stepped axial load, or an axial load at a station, is not modelled (needed: an axial load list and an N(x) diagram in the buckling and cross-section checks). y-axis (lateral): no lateral load at all - only a constant M_z can be entered (the L6 approximation); needed: a lateral load list with V_z / M_z diagrams, minor-axis deflection and the torque of lateral loads at their height.'],
];
const cov = [];
cov.push('# Coverage of the owner\'s case list (docs/owner-cases-2026-09-20.txt)');
cov.push('');
cov.push(`Generated ${new Date().toISOString().slice(0, 10)} by \`node tests/batch/run-owner-cases.cjs\`. Each owner phrase, how it was mapped into \`tests/batch/owner-cases.cjs\`, whether the tool covers it, and the verdicts of the runs that realise it ([index.md](index.md)). COVERED = modelled as worded; APPROXIMATED = modelled with a stated substitute (how); NOT COVERED = not modelled (why, and what the tool would need).`);
cov.push('');
cov.push('| owner phrase | variant | coverage | mapping and notes | runs (verdicts) |');
cov.push('|---|---|---|---|---|');
COVER.forEach(([phrase, v, status, note]) => {
  const vv = v.split(' ')[0];
  const ids = vv === 'all' || vv === '-' ? '-' : idsOf(vv);
  const vs = vv === 'all' || vv === '-' ? (vv === 'all' ? `${runs.length} runs` : '-') : verdictsOf(vv);
  cov.push(`| ${mdEsc(phrase)} | ${mdEsc(v)} | ${mdEsc(status)} | ${mdEsc(note)} | ${mdEsc(ids)}${ids !== '-' ? ' (' + vs + ')' : ''} |`);
});
cov.push('');
cov.push('## Tool behaviours met in the matrix (not owner phrases)');
cov.push('');
cov.push('- **Base loading vs section size:** the owner\'s base loading (G 10 + Q 8 kN/m + Q 30 kN at 2 m on 6 m) is light for the UB 457 x 191 x 82 and heavy for the other four sections, so those FAIL on bending / deflection; where M_y,Ed reaches M_cr the EN 1993-6 Annex A amplifier is unbounded (printed ">= 99 (capacity exhausted)", "the member is inadequate as arranged"). The M_cr, C_1, M_b.Rd, torsion and deflection figures are still the ones to compare; a per-section scaled loading would give utilisations in the 0.5-0.95 band if a PASS-level comparison is wanted.');
cov.push('- **Torsion + N_Ed / M_z (L5, L6, L7):** every separate check is evaluated and printed; PASS is blocked because the tool has no single interaction for torsion with direct axial force or imposed minor-axis bending (NOT VERIFIED).');
cov.push('- **Standard route and load height (L3t, L4, L5..L7):** SN003a publishes C_2 only for the full-span UDL and central point-load diagrams; the owner\'s mixed diagram has none, so a destabilising z_g blocks the closed form (NOT VERIFIED) - the eigen route is the exact figure. A stabilising z_g (L3b, R7) is ignored by the closed form (conservative).');
cov.push('- **Channel (PFC) on the standard route:** the design basis is the P385/P362 kappa chain (a lower bound independent of the moment shape, end flags and load height); the M_cr printed in index.md for a PFC standard run is the value behind that chain (W_y f_y / lambda_LT^2, e.g. 9.1 kN.m at L_E = L) and is well below the eigen M_cr (35.8 kN.m; explained in tests/batch/mcr-method-comparison.md). Only where the engine offers the SN003a shear-centre M_cr route as well (no torsion, z_g = 0, fork ends: PFC-L1) is that value (35.7 kN.m, the figure to compare with a MasterSeries M_cr) printed in brackets after it.');
cov.push('- **Self-weight of the PFC:** once the eccentricity inputs are on (L2..L7, R-variants) the self-weight is applied at the centroid, e_sc = ' + PFC_SEC.esc + ' mm from the shear centre (printed in the loading line); in L1 (inputs off) every load incl. the self-weight passes through the shear centre.');
cov.push('- **Stiff bearing lengths:** 100 mm seatings declared at both ends (the tool\'s demo value); the point loads carry s_s = 0 (bare web). Enter the same in MasterSeries or ignore the web transverse rows.');
cov.push('');
cov.push('## Engine defects found');
cov.push('');
cov.push('Recorded here, not corrected (no engine file is changed by the owner matrix); each is reproduced by a run of this matrix.');
cov.push('');
cov.push('- **OC-1 (presentation):** when the St Venant shear stress of the torsion exhausts the shear resistance (V_pl,T,Rd = 0, tau_t,Ed above 1.25 f_y / sqrt(3) / gamma_M0; PFC-L6 and PFC-L7 under the owner\'s loading) the V+T entry carries the engine\'s 99 marker, but the coexistent bending + shear sweep (cl 6.2.8, "Pure shear failure at M-V check point") divides V_Ed by max(V_pl,T,Rd, 1e-9) and prints a utilisation of order 1e9 as the governing check. The verdict (FAIL) is unaffected; the sweep should carry the same "capacity exhausted" marker as the V+T entry. index.md prints such values as ">= 99 (capacity exhausted)".');
cov.push('- **OC-2 (documented, by design):** the destabilising switch with every z_g = 0 (R6) is blocked on the eigen route and applied as L_E = 1.2 L on the standard route - two different answers to one input; the eigen block is the intended behaviour (campaign finding F2, tests/campaign.test.cjs).');
cov.push('- **OC-3 (documented, by design):** L5..L7 cannot PASS on any section because torsion with N_Ed or M_z has no single interaction check; the separate checks are all printed.');
cov.push('- **OC-4 (unconservative gap, 20 Sep 2026 review):** on the standard route a channel with a destabilising load height (PFC-L3t, PFC-L4, PFC-L5..L7: z_g = +' + PFC_SEC.h2 + ' mm, destabilising switch off) is NOT blocked: js/checks/eurocode-checks.js stdZgStatus() blocks PASS for the I/H and box chains ("a destabilising load height z_g is entered, but SN003a publishes C_2 only for ... PASS is blocked"), but the channel branch replaces it with an advisory-only text ("not used by the P385/P362 kappa chain; load height enters the channel route only through the destabilising L_E switch") and the kappa chain runs at L_E = L with the load height dropped. Under a loading light enough to pass, a top-flange-loaded PFC on the standard route would PASS with the load height ignored. Expected: the same block as the other chains, or L_E = 1.2 L applied automatically when z_g > 0. The PFC standard runs of this matrix FAIL on other checks, so the verdict is not affected here.');
cov.push('- **OC-5 (reporting):** ltb.McrStandard of a channel on the standard route changes meaning with the loading: it is the SN003a shear-centre M_cr when that route is offered (no torsion, z_g = 0, fork ends: PFC-L1, 35.7 kN.m) and the kappa-chain back-calculated W_y f_y / lambda_LT^2 otherwise (PFC-L2.., 9.1 kN.m), although the printed M_b.Rd is the kappa-chain value in both. The brief prints both rows and is unambiguous; a consumer reading McrStandard alone (tests/batch/run-batch.cjs does) gets two different quantities under one name. index.md now prints the kappa-chain value in the M_cr column for every channel standard run and the SN003a value in brackets where it exists.');
cov.push('');
fs.writeFileSync(path.join(OUT, 'coverage.md'), cov.join('\n'));

// ---------------------------------------------------------------------------
// cover page (index table) for the merged PDF
// ---------------------------------------------------------------------------
{
  // short owner-case labels for the cover table (the full wording is in index.md / coverage.md)
  const SHORT = { L1: 'no torsion', L2: 'horizontal ecc. e = +40', L3: 'vertical ecc. z_g = +/-D/2', L4: 'e + z_g', L5: 'e + z_g + N_Ed', L6: 'L5 + inclined load (approx., M_z,Ed)', L7: 'L6 + couple 40 kN.m', R1: 'fully restrained', R2: 'unrestrained (reference)', R3: 'restrained at 2, 4 m', R4: 'warping restrained', R5: 'warping free', R6: 'destabilising switch, z_g = 0', R7: 'stabilising z_g = -D/2', R8: 'L_E override 0.85 L', R9: 'top flange restrained (= full)', R10: 'bottom flange restrained', R11: 'partially restrained' };
  const rows = runs.map(r => `<tr><td class="id">${htmlEsc(r.id)}</td><td>${htmlEsc(r.section)}</td><td>${htmlEsc(r.variant + ': ' + (SHORT[r.variant] || r.owner))}</td><td>${htmlEsc(r.method)}</td><td class="v ${r.verdict === 'NOT VERIFIED' ? 'NV' : r.verdict}">${htmlEsc(r.verdict)}</td><td>${r.gov ? htmlEsc(r.gov.name) + ' (' + fmtU(r.gov.val) + ')' : '-'}</td><td class="n">${fmt(r.Mcr, 1)}${r.McrSN003a != null ? ' (' + fmt(r.McrSN003a, 1) + ')' : ''}</td><td class="n">${fmt(r.MbRd, 1)}</td><td class="n">${fmtU(r.annexA)}</td><td class="n">${fmt(r.deflRatio)}</td><td class="cmp"></td></tr>`).join('\n');
  const cover = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Owner comparison matrix - cover</title><style>
  body{font-family:Arial,Helvetica,sans-serif; font-size:10px; color:#111; margin:0; padding:10px 12px;}
  h1{font-size:16px; color:#1a237e; margin:0 0 4px;} h2{font-size:12px; margin:10px 0 4px; color:#1a237e;}
  p{margin:3px 0; line-height:1.35;}
  table{border-collapse:collapse; width:100%; font-size:8.5px;} th,td{border:1px solid #666; padding:1px 3px; vertical-align:top;}
  th{background:#e8ecf5; text-align:left;} td.n{text-align:right; white-space:nowrap;} td.cmp{min-width:60px;} td.id{white-space:nowrap; font-weight:700;}
  td.v{font-weight:700;} td.v.PASS{color:#166534;} td.v.FAIL,td.v.REFUSED,td.v.ERROR{color:#c00000;} td.v.NV{color:#b45309;}
  tr{break-inside:avoid; page-break-inside:avoid;}
  @page{size:A4 portrait; margin:10mm;}
  </style></head><body>
  <h1>Owner comparison matrix - beam-v03 (EC3) vs MasterSeries</h1>
  <p>${nCases} cases, ${runs.length} runs, generated ${new Date().toISOString().slice(0, 10)}. Basis: S275, 6.0 m simply supported fork ends, EC3 + UK NA, ULS 1.35G + 1.5Q, SLS 1.0Q; base loading G UDL 10 kN/m + Q UDL 8 kN/m + Q 30 kN at 2.0 m. One brief per run follows in this order. Verdicts: ${['PASS', 'FAIL', 'NOT VERIFIED', 'REFUSED', 'ERROR'].map(v => v + ' ' + (counts[v] || 0)).join(', ')}.</p>
  <p>Method: eigen = FE eigenvalue M_cr; standard = SN003a / P385 closed forms; full = fully restrained; refused = not run. Annex A = EN 1993-6 LTB + torsion (&ge; 99 (capacity exhausted) = the amplifier is unbounded, M_y,Ed &ge; M_cr). A channel's standard-route M_cr is the kappa-chain value (SN003a value in brackets where offered). N_Ed and M_z,Ed of L5..L7 are ULS design values entered directly. Comparison column: MasterSeries figures.</p>
  <table><thead><tr><th>id</th><th>section</th><th>owner case</th><th>method</th><th>verdict</th><th>governing (util.)</th><th>M_cr</th><th>M_b.Rd</th><th>Annex A</th><th>defl.</th><th>Comparison</th></tr></thead><tbody>
  ${rows}
  </tbody></table></body></html>`;
  fs.writeFileSync(path.join(OUT, 'cover.html'), cover);
}

console.log(`\n${nCases} cases, ${runs.length} runs: ` + ['PASS', 'FAIL', 'NOT VERIFIED', 'REFUSED', 'ERROR'].map(v => v + ' ' + (counts[v] || 0)).join(', '));
console.log('index: ' + path.join(OUT, 'index.md') + '\ncoverage: ' + path.join(OUT, 'coverage.md'));

// ---------------------------------------------------------------------------
// --pdf: headless Edge, absolute Windows paths, a pool of 4 processes
// ---------------------------------------------------------------------------
async function printPdfs() {
  const all = [{ html: path.join(OUT, 'cover.html'), pdf: path.join(OUT, 'cover.pdf') }]
    .concat(runs.map(r => ({ html: path.join(BRIEFS, r.file), pdf: path.join(BRIEFS, r.file.replace(/.html$/, '.pdf')) })));
  // incremental: a PDF older than its HTML, missing or undersized is (re)printed; --pdf-all reprints everything
  const stale = j => !fs.existsSync(j.pdf) || fs.statSync(j.pdf).size < 1000 || fs.statSync(j.pdf).mtimeMs < fs.statSync(j.html).mtimeMs;
  const jobs = flags.has('--pdf-all') ? all : all.filter(stale);
  console.log(`PDF: ${jobs.length} of ${all.length} to print`);
  // Edge on this machine keeps a background instance alive ("startup boost"); a headless launch -
  // even with its own --user-data-dir - hands the print job to it and returns at once, and the PDF
  // is written a few seconds later. So: launch, then wait for the file to appear and stop growing.
  const profRoot = path.join(os.tmpdir(), 'beam-v03-owner-cases-edge');
  fs.mkdirSync(profRoot, { recursive: true });
  let seq = 0;
  const freshProfile = () => path.join(profRoot, process.pid + '-' + (++seq));
  const edgeArgs = (j, prof) => ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--user-data-dir=' + prof, '--print-to-pdf=' + path.resolve(j.pdf), fileUrl(j.html)];
  const dropProfile = prof => { try { fs.rmSync(prof, { recursive: true, force: true }); } catch (e) { /* a late Edge child may still hold it */ } };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const sizeOf = f => (fs.existsSync(f) ? fs.statSync(f).size : -1);
  const waitPrinted = async (j, limitMs) => {
    const t0 = Date.now();
    let last = -1, stableFor = 0;
    while (Date.now() - t0 < limitMs) {
      await sleep(250);
      const sz = sizeOf(j.pdf);
      if (sz >= 1000 && sz === last) { stableFor += 250; if (stableFor >= 750) return true; } else stableFor = 0;
      last = sz;
    }
    return false;
  };
  const failed = [];
  let done = 0;
  const printOne = async (j, limitMs) => {
    if (fs.existsSync(j.pdf)) fs.unlinkSync(j.pdf);
    const prof = freshProfile();
    const p = spawn(EDGE, edgeArgs(j, prof), { stdio: 'ignore', windowsHide: true });
    p.on('error', () => { /* reported by waitPrinted */ });
    const ok = await waitPrinted(j, limitMs);
    try { p.kill(); } catch (e) { /* already gone */ }
    dropProfile(prof);
    return ok;
  };
  for (const j of jobs) {
    const ok = await printOne(j, 60000);
    if (!ok) failed.push(j);
    done++;
    if (done % 10 === 0 || done === jobs.length) process.stdout.write(`  pdf ${done}/${jobs.length}
`);
  }
  // one retry, longer wait, for anything that did not print
  for (const j of failed.splice(0)) { if (!(await printOne(j, 120000))) failed.push(j); }
  dropProfile(profRoot);
  console.log(`PDF: ${jobs.length - failed.length}/${jobs.length} printed` + (failed.length ? '; FAILED: ' + failed.map(j => path.basename(j.pdf)).join(', ') : ''));
  return failed.length === 0 && all.every(j => !stale(j));
}
// ---------------------------------------------------------------------------
// --merge: cover + briefs in index order -> ALL-BRIEFS.pdf (PyMuPDF)
// ---------------------------------------------------------------------------
function mergePdfs() {
  const list = [path.join(OUT, 'cover.pdf')].concat(runs.map(r => path.join(BRIEFS, r.file.replace(/\.html$/, '.pdf'))));
  const listFile = path.join(OUT, 'merge-list.txt');
  fs.writeFileSync(listFile, list.join('\n'));
  const py = [
    'import fitz, sys',
    'files = [l.strip() for l in open(sys.argv[1], encoding="utf-8") if l.strip()]',
    'out = fitz.open()',
    'toc = []',
    'for f in files:',
    '    d = fitz.open(f)',
    '    toc.append([1, f.replace("\\\\", "/").split("/")[-1].replace(".pdf", ""), out.page_count + 1])',
    '    out.insert_pdf(d)',
    '    d.close()',
    'out.set_toc(toc)',
    'out.subset_fonts()',   // one subset per font for the whole document instead of one per printed file (28 MB -> 8 MB)
    'out.save(sys.argv[2], garbage=4, deflate=True, clean=True)',   // garbage=4 also merges duplicate streams (the subset fonts): 18 MB -> 7.6 MB
    'print("merged", len(files), "files,", out.page_count, "pages")',
  ].join('\n');
  const res = execFileSync('python', ['-c', py, listFile, path.join(OUT, 'ALL-BRIEFS.pdf')], { encoding: 'utf8' });
  fs.unlinkSync(listFile);
  process.stdout.write(res);
}
(async () => {
  let ok = true;
  if (flags.has('--pdf')) ok = await printPdfs();
  if (flags.has('--merge')) { if (ok) mergePdfs(); else console.log('merge skipped: PDFs missing'); }
  process.exitCode = runs.some(r => r.verdict === 'ERROR') ? 1 : 0;
})();
