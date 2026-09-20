const { app } = require('../../../tests/harness.cjs');
const c = app();
function run(method) {
  c.reset({ family: 'ub', ubKey: '457 x 191 x 82', grade: 'S275', L: 9, code: 'EC3', restraint: 'ltb', mcrMethod: method, eccOn: true,
    loads: [{ type: 'udl', x1: 0, x2: 9, w: 10, case: 'G', e: 40 }, { type: 'udl', x1: 0, x2: 9, w: 8, case: 'Q', e: 40 }, { type: 'point', pos: 3, P: 30, case: 'Q', e: 40 }],
    combos: [{ id: 'c1', label: 'ULS 1.35G+1.5Q', factors: { G: 1.35, Q: 1.5, W: 0, E: 0 }, sls: false, on: true }, { id: 's1', label: 'SLS 1.0G+1.0Q', factors: { G: 1, Q: 1, W: 0, E: 0 }, sls: true, on: true }] });
  const r = c.run(`(() => { const a = analyse(); const cc = checks(a); const L = cc.ltb || {}; const T = cc.tor || {}; const A = cc.annex || null;
    return { Tmax: a.tors && a.tors.Tmax, Tends: T.TtEnds, method: a.torsO && a.torsO.method, aa: T.aa, phiUmax: T.phiUmax, phiUdeg: T.phiUmax * 180 / Math.PI, phiSerDeg: T.phiSerDeg,
      MwMax: T.MwMax, MzMax: T.MzMax, cross: T.cross, tauT: T.tauT, VplTRd: T.VplTRd, vtUtil: T.vtUtil, annex: A, Mcr: L.Mcr, MbRd: L.MbRd, ltbUtil: cc.ltbUtil,
      utils: cc.utils.map(u => u.name + '=' + u.val.toFixed(3)), unsupported: cc.unsupported }; })()`);
  console.log(method, JSON.stringify(r, null, 1));
}
run(process.argv[2] || 'standard');
