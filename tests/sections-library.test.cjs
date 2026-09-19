// Section library regression: MasterSeries 2025 UK completion of the UB/UC/SHS/RHS tables.
// See docs/SECTION_LIBRARY.md for the derivation formulas and the cross-check report.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { app } = require('./harness.cjs');
const c = app();
const run = x => c.run(x);
const root = path.resolve(__dirname, '..');
const readRows = (f, arr) => {                  // row lines of one array literal (or of the whole file when arr is omitted)
  const lines = fs.readFileSync(path.join(root, 'js/sections', f), 'utf8').split(/\r?\n/);
  const a = arr ? lines.findIndex(l => l.startsWith(`const ${arr}=[`)) : 0, b = arr ? lines.findIndex((l, i) => i > a && l.startsWith('].map(')) : lines.length;
  return lines.slice(a, b).filter(l => /^ \["/.test(l));
};
const rowKey = l => l.match(/^ \["([^"]+)"/)[1];
const rowArray = l => JSON.parse(l.replace(/\s*\/\/.*$/, '').replace(/,\s*$/, '').trim());
const isMS = l => /\/\/ MS/.test(l);
const near = (a, e, rel, msg) => assert.ok(Math.abs(a - e) <= rel * Math.max(1e-9, Math.abs(e)), `${msg}: ${a} vs ${e}`);
const posFinite = (v, msg) => assert.ok(Number.isFinite(v) && v > 0, `${msg} = ${v}`);

const FILES = { ub: 'ub-section-data.js', uc: 'uc-section-data.js', shs: 'shs-section-data.js', rhs: 'rhs-section-data.js', pfc: 'pfc-section-data.js' };
const LAYOUT = { ub: 23, uc: 23, shs: 12, rhs: 17, pfc: 24 };
const E = 210000, G = 81000;

// ---- independent hollow-section derivation (EN 10210-2:2006 Annex A / EN 10219-2:2006 Annex B) ----
function radii(t, cf) {
  if (!cf) return { ro: 1.5 * t, ri: 1.0 * t };
  const ro = t <= 6 ? 2.0 * t : t <= 10 ? 2.5 * t : 3.0 * t;
  return { ro, ri: ro - t };
}
function rrect(b, h, r) {                      // rounded rectangle: area, I about the axis parallel to b, half-section first moment
  const k = 1 - Math.PI / 4, ac = r * r * k, xc = r / (6 * k);
  const Iown = Math.pow(r, 4) * (1 / 3 - Math.PI / 16) - ac * xc * xc, d = h / 2 - r + xc;
  return { A: b * h - 4 * ac, I: b * h * h * h / 12 - 4 * (Iown + ac * d * d), Q: b * h * h / 8 - 2 * ac * d };
}
function hollow(H, B, t, cf) {
  const { ro, ri } = radii(t, cf);
  const o = rrect(B, H, ro), i = rrect(B - 2 * t, H - 2 * t, ri), oy = rrect(H, B, ro), iy = rrect(H - 2 * t, B - 2 * t, ri);
  const A = o.A - i.A, Ix = o.I - i.I, Iy = oy.I - iy.I;
  const Rc = (ro + ri) / 2, k4 = 4 - Math.PI;
  const hp = 2 * ((H - t) + (B - t)) - 2 * Rc * k4, Ah = (H - t) * (B - t) - Rc * Rc * k4, K = 2 * Ah * t / hp;
  const It = t * t * t * hp / 3 + 2 * K * Ah;
  return { A: A / 100, Ix: Ix / 1e4, Iy: Iy / 1e4, Zx: Ix / (H / 2) / 1e3, Zy: Iy / (B / 2) / 1e3, Sx: 2 * (o.Q - i.Q) / 1e3, Sy: 2 * (oy.Q - iy.Q) / 1e3,
    rx: Math.sqrt(Ix / A) / 10, ry: Math.sqrt(Iy / A) / 10, J: It / 1e4, C: It / (t + K / t) / 1e3 };
}

test('every UB, UC, SHS and RHS key resolves through activeSectionBase() with finite positive properties', () => {
  const props = ['mass', 'D', 'B', 'tw', 'tf', 'd', 'bT', 'dt', 'Ix', 'Iy', 'rx', 'ry', 'Zx', 'Zy', 'Sx', 'Sy', 'J', 'A'];
  const check = (fam, over, key, extra = []) => {
    c.reset(Object.assign({ family: fam }, over));
    const s = run('activeSection()');
    assert.equal(s.key, key);
    [...props, ...extra].forEach(p => posFinite(s[p], `${fam} ${key} ${p}`));
    return s;
  };
  for (const k of run('UB.map(s=>s.key)')) { const s = check('ub', { ubKey: k }, k, ['u', 'x', 'Iw']); assert.ok(s.tp && s.tp.IT > 0 && s.tp.a > 0 && s.tp.Iw > 0 && s.tp.Wn0 > 0 && s.tp.Sw1 > 0, `UB ${k} tp`); }
  for (const k of run('UC.map(s=>s.key)')) { const s = check('uc', { ucKey: k }, k, ['u', 'x', 'Iw']); assert.ok(s.tp && s.tp.IT > 0 && s.tp.a > 0, `UC ${k} tp`); }
  for (const k of run('SHS_HF.map(s=>s.key)')) check('shs', { shsType: 'HF', shsKey: k }, k);
  for (const k of run('SHS_CF.map(s=>s.key)')) check('shs', { shsType: 'CF', shsKey: k }, k);
  for (const k of run('RHS.map(s=>s.key)')) check('rhs', { rhsKey: k }, k);
  // RHS_CF is data only (no cold-formed RHS switch in activeSectionBase yet): check the map directly.
  for (const s of run('RHS_CF')) { assert.equal(run(`RHS_CFmap[${JSON.stringify(s.key)}].key`), s.key); ['mass', 'D', 'B', 't', 'A', 'bT', 'dt', 'Ix', 'Iy', 'rx', 'ry', 'Zx', 'Zy', 'Sx', 'Sy', 'J'].forEach(p => posFinite(s[p], `RHS_CF ${s.key} ${p}`)); }
  assert.ok(run('S.family="ub";S.ubKey="457 x 191 x 82";activeSectionBase().key==="457 x 191 x 82"'));
  for (const [fam, over, key] of [['ub', { ubKey: '457 x 191 x 82' }, '457 x 191 x 82'], ['uc', { ucKey: '203 x 203 x 60' }, '203 x 203 x 60'], ['rhs', { rhsKey: '200 x 100 x 8.0' }, '200 x 100 x 8.0'], ['shs', { shsType: 'HF', shsKey: '150x150x6.3' }, '150x150x6.3']]) check(fam, over, key); // DEMO keys
});

test('imported I-sections: derived Zx, Zy, rx, ry and P385 a, Wn0, Sw1 reproduce hand values', () => {
  const ms = [...readRows(FILES.ub).filter(isMS).map(l => ['UB', rowKey(l)]), ...readRows(FILES.uc).filter(isMS).map(l => ['UC', rowKey(l)])];
  assert.equal(ms.length, 7);
  const tpDerived = ['1016 x 305 x 584', '1016 x 305 x 494', '1016 x 305 x 415', '914 x 305 x 576', '914 x 305 x 521', '914 x 305 x 474', '914 x 305 x 425', '914 x 305 x 381', '914 x 305 x 345', '914 x 305 x 313', '914 x 305 x 271', '914 x 305 x 238'].map(k => ['UB', k])
    .concat(['356 x 406 x 1299', '356 x 406 x 1202', '356 x 406 x 1086', '356 x 406 x 990', '356 x 406 x 900', '356 x 406 x 818', '356 x 406 x 744', '356 x 406 x 677', '356 x 406 x 592', '356 x 406 x 509'].map(k => ['UC', k]));
  let n = 0;
  for (const [fam, k] of [...ms, ...tpDerived]) {
    const s = run(`${fam}map[${JSON.stringify(k)}]`), tp = run(`TP385_${fam}[${JSON.stringify(k)}]`);
    assert.ok(s && tp, `${fam} ${k} row and tp`);
    const [IT, a, Iw, Wn0, Sw1] = tp;
    near(IT, s.J, 1e-9, `${k} IT = J`); near(Iw, s.Iw, 1e-9, `${k} Iw`);
    near(a, Math.sqrt(E * Iw * 1e12 / (G * IT * 1e4)) / 1000, 0.006, `${k} a`);
    near(Wn0, (s.D - s.tf) * s.B / 4 / 100, 0.006, `${k} Wn0`);
    near(Sw1, (s.D - s.tf) * s.B * s.B * s.tf / 16 / 1e4, 0.006, `${k} Sw1`);
    if (ms.some(([f, kk]) => f === fam && kk === k)) {
      near(s.Zx, 20 * s.Ix / s.D, 0.002, `${k} Zx`); near(s.Zy, 20 * s.Iy / s.B, 0.002, `${k} Zy`);
      near(s.rx, Math.sqrt(s.Ix / s.A), 0.006, `${k} rx`); near(s.ry, Math.sqrt(s.Iy / s.A), 0.006, `${k} ry`);
      near(s.bT, (s.B - s.tw - 2 * s.r) / (2 * s.tf), 0.006, `${k} bT (EC3 flat outstand c/tf, file convention)`);
      near(s.dt, s.d / s.tw, 0.006, `${k} dt`);
    }
    n++;
  }
  assert.ok(n >= 10);
  // literal hand values (calculator): 1016 x 305 x 487 -> Zx = 20*1022000/1036.1 = 19728 cm3, ry = sqrt(26940/619.9) = 6.592 cm,
  // a = sqrt(210000*63.82e12/(81000*4282e4)) = 1966 mm; 356 x 406 x 477 -> Zx = 20*172500/427 = 8079.6, ry = sqrt(68100/607.4) = 10.59, a = 1.037 m
  const ub = run('UBmap["1016 x 305 x 487"]'), uc = run('UCmap["356 x 406 x 477"]');
  near(ub.Zx, 19728, 0.001, 'hand Zx'); near(ub.ry, 6.592, 0.002, 'hand ry'); near(run('TP385_UB["1016 x 305 x 487"][1]'), 1.966, 0.003, 'hand a');
  near(uc.Zx, 8079.6, 0.001, 'hand Zx UC'); near(uc.ry, 10.59, 0.002, 'hand ry UC'); near(run('TP385_UC["356 x 406 x 477"][1]'), 1.037, 0.004, 'hand a UC');
  near(run('TP385_UB["914 x 305 x 576"][1]'), Math.sqrt(210000 * 77.9e12 / (81000 * 7130e4)) / 1000, 0.006, 'derived a for existing 914 x 305 x 576');
});

test('hollow-section derivation reproduces the Blue Book rows kept from before within 1 %', () => {
  const bb = [['SHS_HF', false, '40x40x3.0'], ['SHS_HF', false, '150x150x6.3'], ['SHS_HF', false, '400x400x20.0'], ['SHS_CF', true, '50x50x3.0'], ['SHS_CF', true, '100x100x8.0'], ['SHS_CF', true, '180x180x12.0'],
    ['RHS', false, '50 x 30 x 3.2'], ['RHS', false, '200 x 100 x 8.0'], ['RHS', false, '300 x 200 x 12.5'], ['RHS', false, '500 x 300 x 17.5']];
  for (const [arr, cf, key] of bb) {
    const s = run(`${arr === 'RHS' ? 'RHSmap' : arr + 'map'}[${JSON.stringify(key)}]`);
    assert.ok(s, `${arr} ${key}`);
    const p = hollow(s.D, arr === 'RHS' ? s.B : s.D, s.t, cf);
    if (arr === 'RHS') for (const k of ['A', 'Ix', 'Iy', 'Zx', 'Zy', 'Sx', 'Sy', 'rx', 'ry', 'J']) near(p[k], s[k], 0.01, `${key} ${k}`);
    else { near(p.A, s.A, 0.01, `${key} A`); near(p.Ix, s.I, 0.01, `${key} I`); near(p.Zx, s.Z, 0.01, `${key} Z`); near(p.Sx, s.S, 0.01, `${key} S`); near(p.rx, s.r, 0.01, `${key} r`); near(p.J, s.J, 0.01, `${key} J`); near(p.C, s.C, 0.01, `${key} C`); }
  }
  // whole-table sweep of the Blue Book rows (those not tagged MS)
  const sweep = (file, arrName, cf, isRHS) => {
    const keys = new Set(readRows(file, arrName).filter(l => !isMS(l)).map(rowKey));
    let n = 0;
    for (const s of run(arrName)) {
      if (!keys.has(s.key)) continue;
      const p = hollow(s.D, isRHS ? s.B : s.D, s.t, cf);
      const pairs = isRHS ? [['A', 'A'], ['Ix', 'Ix'], ['Iy', 'Iy'], ['Zx', 'Zx'], ['Sx', 'Sx'], ['rx', 'rx'], ['J', 'J']] : [['A', 'A'], ['Ix', 'I'], ['Zx', 'Z'], ['Sx', 'S'], ['rx', 'r'], ['J', 'J'], ['C', 'C']];
      pairs.forEach(([pk, sk]) => near(p[pk], s[sk], 0.01, `${arrName} ${s.key} ${sk}`)); n++;
    }
    return n;
  };
  assert.equal(sweep(FILES.shs, 'SHS_HF', false, false), 96); assert.equal(sweep(FILES.shs, 'SHS_CF', true, false), 86); assert.equal(sweep(FILES.rhs, 'RHS', false, true), 161);
});

test('imported hollow rows carry the MasterSeries mass and the EN 10210-2 / EN 10219-2 derived properties', () => {
  const cases = [['SHS_HF', FILES.shs, false, false], ['SHS_CF', FILES.shs, true, false], ['RHS', FILES.rhs, false, true], ['RHS_CF', FILES.rhs, true, true]];
  let total = 0;
  for (const [arrName, file, cf, isRHS] of cases) {
    const keys = new Set(readRows(file, arrName).filter(isMS).map(rowKey));
    for (const s of run(arrName)) {
      if (!keys.has(s.key)) continue;
      const p = hollow(s.D, isRHS ? s.B : s.D, s.t, cf);
      const pairs = isRHS ? [['A', 'A'], ['Ix', 'Ix'], ['Iy', 'Iy'], ['Zx', 'Zx'], ['Zy', 'Zy'], ['Sx', 'Sx'], ['Sy', 'Sy'], ['rx', 'rx'], ['ry', 'ry'], ['J', 'J']] : [['A', 'A'], ['Ix', 'I'], ['Zx', 'Z'], ['Sx', 'S'], ['rx', 'r'], ['J', 'J'], ['C', 'C']];
      pairs.forEach(([pk, sk]) => near(p[pk], s[sk], 0.002, `${arrName} ${s.key} ${sk}`));
      near(s.mass, p.A * 0.785, 0.035, `${arrName} ${s.key} export mass vs A*7.85 (catalogue masses differ from the Annex A area by up to 3.2 %)`);
      const flat = cf ? 5 : 3;
      if (isRHS) { near(s.bT, (s.B - flat * s.t) / s.t, 0.006, `${s.key} bT`); near(s.dt, (s.D - flat * s.t) / s.t, 0.006, `${s.key} dt`); }
      else near(s.dt, s.D / s.t - flat, 0.006, `${s.key} dt`);
      total++;
    }
  }
  assert.equal(total, 159 + 13 + 200 + 142);
});

test('P385 torsion rows exist for every UB and UC key', () => {
  for (const k of run('UB.map(s=>s.key)')) assert.ok(Array.isArray(run(`TP385_UB[${JSON.stringify(k)}]`)) && run(`TP385_UB[${JSON.stringify(k)}].length`) === 5, `TP385_UB ${k}`);
  for (const k of run('UC.map(s=>s.key)')) assert.ok(Array.isArray(run(`TP385_UC[${JSON.stringify(k)}]`)) && run(`TP385_UC[${JSON.stringify(k)}].length`) === 5, `TP385_UC ${k}`);
  assert.equal(run('Object.keys(TP385_UB).length'), run('UB.length')); assert.equal(run('Object.keys(TP385_UC).length'), run('UC.length'));
});

test('no duplicate keys, constant row layout per file, family counts and sort order', () => {
  for (const arr of ['UB', 'UC', 'PFC', 'SHS_HF', 'SHS_CF', 'RHS', 'RHS_CF']) {
    const keys = run(`${arr}.map(s=>s.key)`);
    assert.equal(new Set(keys).size, keys.length, `${arr} duplicate keys`);
  }
  for (const [fam, file] of Object.entries(FILES)) {
    const rows = readRows(file);
    rows.forEach(l => assert.equal(rowArray(l).length, LAYOUT[fam], `${file}: ${rowKey(l)} has ${rowArray(l).length} fields`));
  }
  assert.equal(run('JSON.stringify([UB.length,UC.length,SHS_HF.length,SHS_CF.length,RHS.length,RHS_CF.length,PFC.length])'), JSON.stringify([113, 47, 255, 99, 361, 142, 16]));
  const mono = (keys, f, desc) => keys.slice(1).forEach((k, i) => assert.ok(desc ? f(keys[i]) > f(k) : f(keys[i]) < f(k), `order ${keys[i]} -> ${k}`));
  const iso = k => { const [a, b, m] = k.split(' x ').map(Number); return a * 1e7 + b * 1e4 + m; };
  const hso = k => { const [a, b, t] = k.split(/\s*x\s*/).map(Number); return a * 1e7 + b * 1e3 + t; };
  mono(run('UB.map(s=>s.key)'), iso, true); mono(run('UC.map(s=>s.key)'), iso, true);
  mono(run('SHS_HF.map(s=>s.key)'), hso, false); mono(run('SHS_CF.map(s=>s.key)'), hso, false); mono(run('RHS.map(s=>s.key)'), hso, false); mono(run('RHS_CF.map(s=>s.key)'), hso, false);
});

test('Blue Book values kept from before are unchanged by the import', () => {
  // spot values transcribed from the pre-import tables (commit 54070b8)
  assert.equal(run('JSON.stringify([UBmap["457 x 191 x 82"].Ix, UBmap["457 x 191 x 82"].J, UCmap["203 x 203 x 60"].Sx, SHS_HFmap["150x150x6.3"].C, SHS_CFmap["100x100x8.0"].A, RHSmap["200 x 100 x 8.0"].J, RHSmap["50 x 30 x 6.3"].mass])'), JSON.stringify([37100, 69.2, 656, 240, 27.2, 1800, 6.33]));
  assert.equal(run('JSON.stringify(TP385_UB["457 x 191 x 82"])'), JSON.stringify([69.2, 1.86, 0.922, 212, 1620]));
});
