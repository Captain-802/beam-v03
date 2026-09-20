// beam-v03 equivalents of the MasterFrame comparison models (MS*.$5 in this folder).
// usage: node run-case.cjs <CASE|all> [standard|eigen|both]
// All models: single span, fork ends, S275, EC3 UK NA, unrestrained (LTB on the
// full span), combos 1.35G+1.5Q (ULS) and 1.0G+1.0Q (SLS deflection).
// L1 = no eccentricity; L2 = the same loads at e = +40 mm from the shear centre.
const { app } = require('../../../tests/harness.cjs');
const c = app();
const UDL = (L, wG, wQ, e) => [{ type: 'udl', x1: 0, x2: L, w: wG, case: 'G', e, zg: 0 }, { type: 'udl', x1: 0, x2: L, w: wQ, case: 'Q', e, zg: 0 }];
const PT = (pos, P, e) => ({ type: 'point', pos, P, case: 'Q', e, zg: 0 });
const combos = [
  { id: 'c1', label: 'ULS 1.35G+1.5Q', factors: { G: 1.35, Q: 1.5, W: 0, E: 0 }, sls: false, on: true },
  { id: 's1', label: 'SLS 1.0G+1.0Q', factors: { G: 1, Q: 1, W: 0, E: 0 }, sls: true, on: true }];
const SEC = {
  UB: { family: 'ub', ubKey: '457 x 191 x 82' },
  UC: { family: 'uc', ucKey: '203 x 203 x 60' },
  PFC: { family: 'pfc', sectionKey: '200x75x23' },
  PFC46: { family: 'pfc', sectionKey: '300x100x46' },
  SHS: { family: 'shs', shsType: 'HF', shsKey: '150x150x6.3' },
  RHS: { family: 'rhs', rhsType: 'HF', rhsKey: '200 x 100 x 8.0' },
};
// [section, L, wG, wQ, P, xP, e, extra]
const DEF = {
  // first generation: 9 m UB-sized loads on every section (PFC/UC/SHS/RHS grossly overloaded - formula comparison only)
  'UB-L1': ['UB', 9, 10, 8, 30, 3, 0], 'UB-L2': ['UB', 9, 10, 8, 30, 3, 40],
  'PFC-L1': ['PFC', 9, 10, 8, 30, 3, 0], 'PFC-L2': ['PFC', 9, 10, 8, 30, 3, 40],
  // second generation: spans and loads sized to each section (utilisations 0.5 - 1.2)
  'PFC46-L1': ['PFC46', 5, 5, 4, 10, 2, 0], 'PFC46-L2': ['PFC46', 5, 5, 4, 10, 2, 40],
  'UC-L1': ['UC', 6, 5, 4, 10, 2, 0], 'UC-L2': ['UC', 6, 5, 4, 10, 2, 40],
  'SHS-L1': ['SHS', 4, 3, 3, 8, 2, 0], 'SHS-L2': ['SHS', 4, 3, 3, 8, 2, 40],
  'RHS-L1': ['RHS', 5, 3, 3, 8, 2, 0], 'RHS-L2': ['RHS', 5, 3, 3, 8, 2, 40],
  // UB at 6 m: axial, inclined (horizontal companion), external moment, load height
  'UB6-L1': ['UB', 6, 10, 8, 30, 2, 0],
  'UB6-L3': ['UB', 6, 10, 8, 30, 2, 0, { axial: 300 }],                 // + N_Ed = 1.5 x 200 kN compression (MasterFrame L1 PX -200 at node 2)
  'UB6-L4': ['UB', 6, 10, 8, 30, 2, 0, { destab: true }],               // load at the top flange, destabilising
  'UB6-L6': ['UB', 6, 10, 8, 30, 2, 0, { moment: { pos: 4, M: 50 } }], // + external moment 50 kN.m at 4 m
  'UB6-L2': ['UB', 6, 10, 8, 30, 2, 40],
};
function spec(name) {
  const d = DEF[name]; if (!d) return null;
  const [sk, L, wG, wQ, P, xP, e, extra] = d;
  const loads = [...UDL(L, wG, wQ, e), PT(xP, P, e)];
  const o = Object.assign({ grade: 'S275', L, code: 'EC3', restraint: 'ltb', combos, loads, eccOn: e !== 0 }, SEC[sk]);
  if (extra) { if (extra.moment) { loads.push({ type: 'moment', pos: extra.moment.pos, M: extra.moment.M, case: 'Q' }); } Object.assign(o, extra, { moment: undefined }); delete o.moment; }
  return o;
}
function run(name, method) {
  c.reset(Object.assign({ mcrMethod: method }, spec(name)));
  const r = c.run(`(() => { const a = analyse(); const cc = checks(a); const L = cc.ltb || {}; const T = cc.tor || {}; const A = cc.annex || null; const B = cc.buck || {};
    const f = v => (v == null || !isFinite(v)) ? v : +(+v).toPrecision(5);
    const chan = L.chanMcr || null;
    return { sec: a.sec.name || a.sec.key, cls: cc.cl && cc.cl.cls, fy: cc.fy,
      forces: { Vmax: f(a.Vmax), Mmax: f(a.Mmax), xM: f(a.Mpos), dSLS: f(a.dmax), xd: f(a.dpos), Tmax: f(a.tors && a.tors.Tmax) },
      section: { VplRd: f(cc.VplRd), McRd: f(cc.McRd), Wy: cc.Wy, NplRd: f(cc.ax && cc.ax.NplRd), localU: f(cc.momUtil) },
      ltb: { method: L.mcrMethod, route: L.c1route, C1: f(L.C1show), c1in: L.c1in && { M1: f(L.c1in.M1), M2: f(L.c1in.M2), Mo: f(L.c1in.Mo), psi: f(L.c1in.psi), mu: f(L.c1in.mu) }, LE: f(cc.LE),
        Mcr: f(L.McrStandard != null ? L.McrStandard : L.Mcr), McrEigen: f(L.McrEigen),
        lamLT: f(L.lamLTmcr), chi: f(L.chiM), kc: f(L.kc), f: f(L.fM), chiMod: f(L.chiModM), curve: L.curve && L.curve.curve, MbRd: f(L.MbRd), util: f(cc.ltbUtil),
        channel: chan ? { Mcr: f(chan.Mcr), lam: f(chan.lam), chi: f(chan.chi), f: f(chan.f), Mb: f(chan.Mb) } : undefined, kappa: f(L.kappa), lamZ: f(L.lamZ), ignored: L.ignM },
      buck: { NbY: f(B.NbY), NbZ: f(B.NbZ), Cmy: f(B.Cmy), Cmz: f(B.Cmz), CmLT: f(B.CmLT), kyy: f(B.kyy), kzz: f(B.kzz), kyz: f(B.kyz), kzy: f(B.kzy), u661: f(B.u1), u662: f(B.u2) },
      tor: T && T.p385 ? { a: f(T.aa), phiUdeg: f(T.phiUmax * 180 / Math.PI), phiSerDeg: f(T.phiSerDeg), Mw: f(T.MwMax), Mz: f(T.MzMax), cross: f(T.cross && T.cross.u), tauT: f(T.tauT), VplTRd: f(T.VplTRd), vt: f(T.vtUtil) }
           : T && T.box ? { TRd: f(T.TRd), torUtil: f(T.torUtil), vt: f(T.vtUtil) } : null,
      annex: A ? { ka: f(A.ka), kw: f(A.kw), kzw: f(A.kzw), u: f(A.u), blocked: A.blocked } : null,
      utils: cc.utils.map(u => u.name + '=' + (+u.val).toFixed(3)), pass: cc.pass, unsupported: cc.unsupported }; })()`);
  console.log('## ' + name + ' [' + method + ']');
  console.log(JSON.stringify(r, null, 1));
}
const name = process.argv[2] || 'PFC-L2';
const which = process.argv[3] || 'both';
const names = name === 'all' ? Object.keys(DEF) : [name];
if (!DEF[names[0]]) { console.error('cases: ' + Object.keys(DEF).join(' ')); process.exit(1); }
for (const n of names) { if (which === 'both') { run(n, 'standard'); run(n, 'eigen'); } else run(n, which); }
