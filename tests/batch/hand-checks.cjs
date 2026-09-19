'use strict';
/* ===========================================================================
   Independent hand checks - 19 Sep 2026 verification campaign
   ---------------------------------------------------------------------------
   Every value below is recomputed from first principles or from published
   tables with the arithmetic written out, using ONLY the section table rows
   quoted from js/sections/*.js (typed in here as constants) and the case
   inputs of tests/batch/cases.cjs. No engine function is called for the hand
   value; the engine is run through tests/harness.cjs only to obtain the value
   it prints, for the comparison column. tests/batch/hand-checks.md documents
   the same steps in prose.

   Usage:  node tests/batch/hand-checks.cjs        (prints the table)
   A difference above 1 % is a finding (printed as such, exit code 1).
   =========================================================================== */
const { app } = require('../harness.cjs');
const { cases } = require('./cases.cjs');
const ctx = app();
const E = 210000, G = 81000, PI = Math.PI;
const rows = [];
const log = (...s) => console.log(...s);
const pct = (h, e) => 100 * (e - h) / h;
function record(id, what, hand, eng, unit, note) {
  const d = pct(hand, eng);
  rows.push({ id, what, hand, eng, unit, d, note: note || '' });
  log(`  => hand ${hand.toPrecision(6)} ${unit} | engine ${eng.toPrecision(6)} ${unit} | diff ${d.toFixed(3)} %${Math.abs(d) > 1 ? '   <-- FINDING (> 1 %)' : ''}`);
}
function engine(id, method, code) {
  const cs = cases.find(c => c.id === id);
  if (!cs) throw new Error('case ' + id + ' not in cases.cjs');
  const o = JSON.parse(JSON.stringify(cs.overrides)); o.mcrMethod = method || 'eigen';
  ctx.reset(o);
  return ctx.run(`(()=>{ const a=analyse(); const c=checks(a); return (${code})(a,c); })()`);
}

/* ---------------------------------------------------------------------------
   HC-01  WEB-01  UB 610x229x101, 3 m SS, 600 kN (Q) at mid-span, s_s = 0, S275
   EN 1993-1-5 clause 6, load type (a). js/sections/ub-section-data.js row:
   ["610 x 229 x 101",101.2,602.6,227.6,10.5,14.8,12.7,547.6,...]  (D, B, tw, tf, r, d)
   --------------------------------------------------------------------------- */
log('\nHC-01  WEB-01  F_Rd type (a), UB 610x229x101, s_s = 0');
{
  const D = 602.6, B = 227.6, tw = 10.5, tf = 14.8, L = 3000, fy = 275;   // tf < 16 -> fy = 275
  const eps = Math.sqrt(235 / fy);
  const hw = D - 2 * tf;                                   // 573.0
  const bf = Math.min(B, tw + 30 * eps * tf);              // 30 eps tf = 410.5 -> 421.0 > B -> bf = 227.6
  const m1 = bf / tw;                                      // 21.676
  const m2 = 0.02 * Math.pow(hw / tf, 2);                  // 0.02 x 38.72^2 = 29.98
  const kF = 6 + 2 * Math.pow(hw / L, 2);                  // a = L (no stiffener): 6 + 2 x 0.191^2 = 6.0730
  const Fcr = 0.9 * kF * E * Math.pow(tw, 3) / hw;         // N
  const ss = 0;
  let ly = Math.min(ss + 2 * tf * (1 + Math.sqrt(m1 + m2)), L);
  let lam = Math.sqrt(ly * tw * fy / Fcr);
  log(`  hw = ${hw}, bf = ${bf}, m1 = ${m1.toFixed(3)}, m2 = ${m2.toFixed(3)}, kF = ${kF.toFixed(4)}, Fcr = ${(Fcr / 1000).toFixed(1)} kN, ly = ${ly.toFixed(2)} mm, lambda_F = ${lam.toFixed(4)} (> 0.5 so m2 stays)`);
  const chi = Math.min(0.5 / lam, 1);
  const FRd = fy * chi * ly * tw / 1000;
  const FEd = 1.5 * 600;
  log(`  chi_F = ${chi.toFixed(4)}, L_eff = ${(chi * ly).toFixed(2)} mm, F_Rd = ${FRd.toFixed(1)} kN, F_Ed = ${FEd} kN, F_Ed/F_Rd = ${(FEd / FRd).toFixed(3)}`);
  const e = engine('WEB-01', 'eigen', '(a,c)=>({FRd:c.web.gov2.FRdTot,u:c.web.util2})');
  record('HC-01', 'WEB-01 F_Rd type (a) mid-span point load, s_s = 0', FRd, e.FRd, 'kN', 'lambda_F > 0.5, m2 retained');
}

/* ---------------------------------------------------------------------------
   HC-02  WEB-04  UB 533x210x92, 6 m SS, UDL 30 G + 40 Q, end reaction, s_s = 40
   load type (c) with type (a) alongside in the end zone; lower governs.
   row: ["533 x 210 x 92",92.1,533.1,209.3,10.1,15.6,12.7,476.5,...]
   --------------------------------------------------------------------------- */
log('\nHC-02  WEB-04  F_Rd type (c) end reaction, UB 533x210x92, s_s = 40');
{
  const D = 533.1, B = 209.3, tw = 10.1, tf = 15.6, L = 6000, fy = 275, mass = 92.1;
  const eps = Math.sqrt(235 / fy), hw = D - 2 * tf;                       // 501.9
  const bf = Math.min(B, tw + 30 * eps * tf), m1 = bf / tw, m2 = 0.02 * Math.pow(hw / tf, 2);
  const ss = 40, d = 0, c = Math.max(d - ss / 2, 0);                      // end station: c = 0
  const endZone = (ss + c) < 2 * hw / 3;
  // type (c)
  const kFc = Math.min(2 + 6 * (ss + c) / hw, 6);                          // 2 + 6 x 40/501.9 = 2.478
  const Fcrc = 0.9 * kFc * E * Math.pow(tw, 3) / hw;
  const le = Math.min(kFc * E * tw * tw / (2 * fy * hw), ss + c);          // 192.4 -> capped at 40
  const lyc = (m2v) => Math.min(le + tf * Math.sqrt(m1 / 2 + Math.pow(le / tf, 2) + m2v), le + tf * Math.sqrt(m1 + m2v));
  let ly = lyc(m2), lam = Math.sqrt(ly * tw * fy / Fcrc);
  if (lam <= 0.5) { ly = lyc(0); lam = Math.sqrt(ly * tw * fy / Fcrc); }
  const FRdc = fy * Math.min(0.5 / lam, 1) * ly * tw / 1000;
  // type (a) alongside
  const kFa = 6 + 2 * Math.pow(hw / L, 2), Fcra = 0.9 * kFa * E * Math.pow(tw, 3) / hw;
  let lya = Math.min(ss + 2 * tf * (1 + Math.sqrt(m1 + m2)), L), lama = Math.sqrt(lya * tw * fy / Fcra);
  if (lama <= 0.5) { lya = Math.min(ss + 2 * tf * (1 + Math.sqrt(m1)), L); lama = Math.sqrt(lya * tw * fy / Fcra); }
  const FRda = fy * Math.min(0.5 / lama, 1) * lya * tw / 1000;
  const FRd = endZone ? Math.min(FRdc, FRda) : FRda;
  const sw = mass * 9.81 / 1000, w = 1.35 * (30 + sw) + 1.5 * 40, R = w * 6 / 2;
  log(`  hw = ${hw.toFixed(1)}, m1 = ${m1.toFixed(3)}, m2 = ${m2.toFixed(3)}, end zone ${endZone}; type (c): kF = ${kFc.toFixed(4)}, Fcr = ${(Fcrc / 1000).toFixed(1)} kN, le = ${le.toFixed(1)}, ly = ${ly.toFixed(2)}, lambda_F = ${lam.toFixed(4)}, F_Rd = ${FRdc.toFixed(1)} kN; type (a): F_Rd = ${FRda.toFixed(1)} kN`);
  log(`  R = w L/2 with w = 1.35(30 + ${sw.toFixed(4)}) + 1.5 x 40 = ${w.toFixed(3)} kN/m -> ${R.toFixed(2)} kN; F_Ed/F_Rd = ${(R / FRd).toFixed(3)}`);
  const e = engine('WEB-04', 'eigen', '(a,c)=>({FRd:c.web.gov2.FRdTot,F:c.web.gov2.F})');
  record('HC-02', 'WEB-04 F_Rd type (c) end reaction, s_s = 40', FRd, e.FRd, 'kN', '(c) governs over (a) ' + FRda.toFixed(1));
  record('HC-02b', 'WEB-04 end reaction F_Ed (statics)', R, e.F, 'kN');
}

/* ---------------------------------------------------------------------------
   HC-03  WEB-07  UB 305x165x40, 3 m SS, 300 kN (Q) directly over End 2, s_s = 100
   load type (b) (load through the web) at the end station, with the end-zone
   type (c) evaluated alongside (d = 0 -> c = 0, s_s + c = 100 < 2 h_w/3 = 188.7)
   and the lower F_Rd governing; F_Ed = max(P, R) = R_2 (1.35 G + 1.5 Q).
   row: ["305 x 165 x 40",40.3,303.4,165.0,6.0,10.2,8.9,265.2,...]
   --------------------------------------------------------------------------- */
log('\nHC-03  WEB-07  F_Rd types (b) and (c) at the end, point load over End 2, UB 305x165x40');
{
  const D = 303.4, B = 165.0, tw = 6.0, tf = 10.2, L = 3000, fy = 275, mass = 40.3;
  const eps = Math.sqrt(235 / fy), hw = D - 2 * tf;                        // 283.0
  const bf = Math.min(B, tw + 30 * eps * tf), m1 = bf / tw, m2 = 0.02 * Math.pow(hw / tf, 2);
  const ss = 100, cc = 0;
  const FRdOf = (type) => {
    const kF = type === 'b' ? 3.5 + 2 * Math.pow(hw / L, 2) : Math.min(2 + 6 * (ss + cc) / hw, 6);
    const Fcr = 0.9 * kF * E * Math.pow(tw, 3) / hw;
    const le = type === 'c' ? Math.min(kF * E * tw * tw / (2 * fy * hw), ss + cc) : null;
    const ly = (m2v) => type === 'c' ? Math.min(le + tf * Math.sqrt(m1 / 2 + Math.pow(le / tf, 2) + m2v), le + tf * Math.sqrt(m1 + m2v)) : Math.min(ss + 2 * tf * (1 + Math.sqrt(m1 + m2v)), L);
    let l = ly(m2), lam = Math.sqrt(l * tw * fy / Fcr);
    if (lam <= 0.5) { l = ly(0); lam = Math.sqrt(l * tw * fy / Fcr); }
    const chi = Math.min(0.5 / lam, 1);
    log(`  type (${type}): kF = ${kF.toFixed(4)}, Fcr = ${(Fcr / 1000).toFixed(1)} kN, ly = ${l.toFixed(2)}, lambda_F = ${lam.toFixed(4)}, chi_F = ${chi.toFixed(4)}, F_Rd = ${(fy * chi * l * tw / 1000).toFixed(1)} kN`);
    return { FRd: fy * chi * l * tw / 1000, type };
  };
  const b = FRdOf('b'), c2 = FRdOf('c');
  const gov = b.FRd <= c2.FRd ? b : c2;
  // reaction: 3 m simply supported, UDL w = 1.35 (5 + sw), point 1.5 x 300 = 450 kN at End 2 goes straight into End 2: R2 = w L/2 + 450
  const sw = mass * 9.81 / 1000, w = 1.35 * (5 + sw), R2 = w * 3 / 2 + 450;
  log(`  hw = ${hw}, bf = ${bf}, m1 = ${m1.toFixed(3)}, m2 = ${m2.toFixed(3)}; governing type (${gov.type}) F_Rd = ${gov.FRd.toFixed(1)} kN`);
  log(`  R2 = ${w.toFixed(4)} x 3/2 + 450 = ${R2.toFixed(2)} kN = F_Ed; F_Ed/F_Rd = ${(R2 / gov.FRd).toFixed(3)}`);
  const e = engine('WEB-07', 'eigen', '(a,c)=>({FRd:c.web.gov2.FRdTot,F:c.web.gov2.F,type:c.web.gov2.type})');
  record('HC-03', 'WEB-07 F_Rd at the end station, load through the web over End 2 (lower of types (b) and (c))', gov.FRd, e.FRd, 'kN', 'hand type (' + gov.type + '), engine type (' + e.type + ')');
  record('HC-03b', 'WEB-07 F_Ed = R2 (simply supported statics)', R2, e.F, 'kN');
}

/* ---------------------------------------------------------------------------
   HC-04  WEB-06  RHS 250x150x6.3, 3 m SS, 80 kN (Q) at mid-span at e = 40 mm, s_s = 60
   two webs of thickness t with the tabulated flat depth d = dt x t, flange share
   B/2 per web <= t + 15 eps t, lever-rule share 0.5 + e/(B - t) to the near web.
   row: ["250 x 150 x 6.3",38.0,250.0,150.0,6.3,48.4,20.8,36.7,...]  (D, B, t, A, bT, dt)
   --------------------------------------------------------------------------- */
log('\nHC-04  WEB-06  F_Rd two webs + lever rule, RHS 250x150x6.3, e = 40, s_s = 60');
{
  const D = 250, B = 150, t = 6.3, dt = 36.7, L = 3000, fy = 275;
  const eps = Math.sqrt(235 / fy), hw = dt * t;                             // 231.21
  const bf = Math.min(B / 2, t + 15 * eps * t), m1 = bf / t, m2 = 0.02 * Math.pow(hw / t, 2);
  const ss = 60, kF = 6 + 2 * Math.pow(hw / L, 2), Fcr = 0.9 * kF * E * Math.pow(t, 3) / hw;
  let ly = Math.min(ss + 2 * t * (1 + Math.sqrt(m1 + m2)), L), lam = Math.sqrt(ly * t * fy / Fcr), second = false;
  if (lam <= 0.5) { ly = Math.min(ss + 2 * t * (1 + Math.sqrt(m1)), L); lam = Math.sqrt(ly * t * fy / Fcr); second = true; }
  const chi = Math.min(0.5 / lam, 1), FRdWeb = fy * chi * ly * t / 1000;
  const share = Math.min(1, 0.5 + 40 / (B - t)), FRd = FRdWeb / share;
  log(`  hw = ${hw.toFixed(2)}, bf = min(75, ${(t + 15 * eps * t).toFixed(2)}) = ${bf.toFixed(2)}, m1 = ${m1.toFixed(3)}, m2 = ${m2.toFixed(2)}, kF = ${kF.toFixed(4)}, Fcr = ${(Fcr / 1000).toFixed(1)} kN, ly = ${ly.toFixed(2)}${second ? ' (second pass, m2 = 0)' : ''}, lambda_F = ${lam.toFixed(4)}, chi_F = ${chi.toFixed(3)}, F_Rd per web = ${FRdWeb.toFixed(1)} kN, share = ${share.toFixed(4)}, F_Rd = ${FRd.toFixed(1)} kN`);
  const e = engine('WEB-06', 'eigen', '(a,c)=>({FRd:c.web.gov2.FRdTot,share:c.web.gov2.share})');
  record('HC-04', 'WEB-06 RHS two-web F_Rd with the lever-rule share', FRd, e.FRd, 'kN', 'share ' + share.toFixed(3) + ' vs engine ' + e.share.toFixed(3));
}

/* ---------------------------------------------------------------------------
   HC-07  UB-04 (standard route)  UB 305x165x40, 6 m SS, UDL 5 G + 6 Q, z_g = +152 mm
   SN003a Table 3.2: simply supported + UDL, C1 = 1.127, C2 = 0.454, k = kw = 1
   Mcr = C1 (pi^2 E Iz/L^2) { sqrt[ Iw/Iz + L^2 G It/(pi^2 E Iz) + (C2 zg)^2 ] - C2 zg }
   row: Iy 764 cm4, J 14.7 cm4, Iw 0.164 dm6
   --------------------------------------------------------------------------- */
log('\nHC-07  UB-04 standard Mcr with C2 zg (SS + UDL, top-flange load)');
{
  const Iz = 764e4, It = 14.7e4, Iw = 0.164e12, L = 6000, C1 = 1.127, C2 = 0.454, zg = 152;
  const T1 = PI * PI * E * Iz / (L * L);
  const IwIz = Iw / Iz, GItT1 = G * It / T1, cz = C2 * zg;
  const Mcr = C1 * T1 * (Math.sqrt(IwIz + GItT1 + cz * cz) - cz) / 1e6;
  log(`  pi^2 E Iz/L^2 = ${T1.toFixed(1)} N; Iw/Iz = ${IwIz.toFixed(1)} mm2; G It/T1 = ${GItT1.toFixed(1)} mm2; C2 zg = ${cz.toFixed(3)} mm; Mcr = ${Mcr.toFixed(2)} kN.m`);
  const Mcr0 = C1 * T1 * Math.sqrt(IwIz + GItT1) / 1e6;
  log(`  (with the load at the shear centre Mcr = ${Mcr0.toFixed(2)} kN.m: the load height costs ${(100 * (1 - Mcr / Mcr0)).toFixed(1)} %)`);
  const e = engine('UB-04', 'standard', '(a,c)=>({Mcr:c.ltb.Mcr, C1:c.C1, C2:c.ltb.C2, zg:c.ltb.zg, used:c.ltb.zgUsed})');
  record('HC-07', 'UB-04 standard Mcr, SS UDL, C1 1.127 / C2 0.454, zg +152', Mcr, e.Mcr, 'kN.m', `engine C1 ${e.C1}, C2 ${e.C2}, zg ${e.zg} applied ${e.used}`);
}

/* ---------------------------------------------------------------------------
   HC-08  UB-45 (standard route)  UC 203x203x60, 6 m fixed-fixed, central point load, z_g = +105
   SN003a Table 3.2: fixed-ended + central point load, C1 = 1.683, C2 = 1.645
   row: ["203 x 203 x 60",...,Iy 2060 cm4, J 47.2 cm4, Iw 0.197 dm6]
   --------------------------------------------------------------------------- */
log('\nHC-08  UB-45 standard Mcr with C2 zg (fixed-ended + central point load, top-flange load)');
{
  const Iz = 2060e4, It = 47.2e4, Iw = 0.197e12, L = 6000, C1 = 1.683, C2 = 1.645, zg = 105;
  const T1 = PI * PI * E * Iz / (L * L), IwIz = Iw / Iz, GItT1 = G * It / T1, cz = C2 * zg;
  const Mcr = C1 * T1 * (Math.sqrt(IwIz + GItT1 + cz * cz) - cz) / 1e6;
  log(`  pi^2 E Iz/L^2 = ${T1.toFixed(1)} N; Iw/Iz = ${IwIz.toFixed(1)} mm2; G It/T1 = ${GItT1.toFixed(1)} mm2; C2 zg = ${cz.toFixed(3)} mm; Mcr = ${Mcr.toFixed(2)} kN.m`);
  const e = engine('UB-45', 'standard', '(a,c)=>({Mcr:c.ltb.Mcr, C1:c.C1, C2:c.ltb.C2, zg:c.ltb.zg, used:c.ltb.zgUsed})');
  record('HC-08', 'UB-45 standard Mcr, fixed-ended central point load, C1 1.683 / C2 1.645, zg +105', Mcr, e.Mcr, 'kN.m', `engine C1 ${e.C1}, C2 ${e.C2}, zg ${e.zg} applied ${e.used}`);
}

/* ---------------------------------------------------------------------------
   HC-09  UB-19 (standard route)  UB 254x102x22, 3 m cantilever, 10 kN tip load, root warping restrained, z_g = 0
   NCCI SN006a: Mcr = C x Mcr0, Mcr0 = (pi/L) sqrt(E Iz G It), kwt = sqrt(E Iw/(G It))/L,
   eta = zg/(hs/2) = 0. The factored self-weight (1.35 x 0.2158 kN/m) gives a root moment
   Mq = 1.311 kN.m = 2.8 % of the total (> the 2 % de-minimis), so the engine combines the
   Table 3.1 (q) and Table 3.2 (F) factors by SN006a Eq (7): C = (Mq + MF)/(Mq/Cq + MF/CF).
   row: ["254 x 102 x 22",...,Iy 119 cm4, J 4.15 cm4, Iw 0.0182 dm6, mass 22.0]
   Tables (js/01-computation-engine.js SN006, 'restr', eta = 0 column, kwt rows 0.3 and 0.4):
     F.restr: kwt 0.3 -> 2.35, kwt 0.4 -> 2.72;   q.restr: kwt 0.3 -> 4.57, kwt 0.4 -> 5.45
   --------------------------------------------------------------------------- */
log('\nHC-09  UB-19 SN006a cantilever Mcr (tip point load + self-weight, root warping restrained, eta = 0)');
{
  const Iz = 119e4, It = 4.15e4, Iw = 0.0182e12, L = 3000, mass = 22.0;
  const Mcr0 = PI / L * Math.sqrt(E * Iz * G * It) / 1e6;
  const kwt = Math.sqrt(E * Iw / (G * It)) / L;
  if (!(kwt >= 0.3 && kwt <= 0.4)) throw new Error('HC-09: kwt outside the quoted table rows');
  const f = (kwt - 0.3) / 0.1;
  const CF = 2.35 + (2.72 - 2.35) * f, Cq = 4.57 + (5.45 - 4.57) * f;
  const Mq = 1.35 * mass * 9.81 / 1000 * 3 * 3 / 2, MF = 1.5 * 10 * 3;
  const C = (Mq + MF) / (Mq / Cq + MF / CF);
  const Mcr = C * Mcr0;
  log(`  Mcr0 = (pi/L) sqrt(E Iz G It) = ${Mcr0.toFixed(3)} kN.m; kwt = ${kwt.toFixed(4)}; CF = 2.35 + 0.37 x ${f.toFixed(4)} = ${CF.toFixed(4)}; Cq = 4.57 + 0.88 x ${f.toFixed(4)} = ${Cq.toFixed(4)}`);
  log(`  Mq = ${Mq.toFixed(3)} kN.m (self-weight), MF = ${MF.toFixed(1)} kN.m; Eq (7): C = (${Mq.toFixed(3)} + 45)/(${Mq.toFixed(3)}/${Cq.toFixed(3)} + 45/${CF.toFixed(3)}) = ${C.toFixed(4)}; Mcr = ${Mcr.toFixed(2)} kN.m`);
  const e = engine('UB-19', 'standard', '(a,c)=>({Mcr:c.ltb.Mcr, C:c.ltb.C, kwt:c.ltb.kwt, eta:c.ltb.eta, Mcr0:c.ltb.Mcr0, Cq:c.ltb.Cq, CF:c.ltb.CF})');
  record('HC-09', 'UB-19 SN006a Mcr = C Mcr0, tip load + self-weight, warping restrained', Mcr, e.Mcr, 'kN.m', `engine C ${e.C.toFixed(4)} (Cq ${e.Cq.toFixed(3)}, CF ${e.CF.toFixed(3)}), kwt ${e.kwt.toFixed(4)}, eta ${e.eta}`);
  record('HC-09b', 'UB-19 Mcr0 = (pi/L) sqrt(E Iz G It)', Mcr0, e.Mcr0, 'kN.m');
}

/* ---------------------------------------------------------------------------
   HC-10  TFB-01  PFC 200x90x30, 4 m SS, N = 80 kN, L_T = L_cr,z = 4 m
   EN 1993-1-1 6.3.1.4: i0^2 = iy^2 + iz^2 + y0^2; N_cr,T = (G I_T + pi^2 E I_w/L_T^2)/i0^2;
   N_cr,TF = (N_cr,y + N_cr,T)/(2 beta) [1 - sqrt(1 - 4 beta N_cr,y N_cr,T/(N_cr,y + N_cr,T)^2)], beta = 1 - (y0/i0)^2;
   lambda_T = sqrt(A fy/N_cr), curve c (alpha 0.49), N_b,T,Rd = chi A fy.
   row: ["200x90x30",...,Ix 2520, Iy 314, rx 8.16, ry 2.88 cm, ..., A 37.9 cm2]; TP385_PFC "200x90x30":[IT 19.1 cm4, a, Iw 0.0197 dm6, ..., e0 36, esc 63.7]
   --------------------------------------------------------------------------- */
log('\nHC-10  TFB-01  PFC 200x90x30 N_cr,T / N_cr,TF / N_b,T,Rd');
{
  const A = 37.9e2, Ix = 2520e4, iy = 81.6, iz = 28.8, y0 = 63.7, IT = 19.1e4, Iw = 0.0197e12, LT = 4000, Lcr = 4000, fy = 275;
  const i0sq = iy * iy + iz * iz + y0 * y0;
  const NcrT = (G * IT + PI * PI * E * Iw / (LT * LT)) / i0sq;
  const NcrY = PI * PI * E * Ix / (Lcr * Lcr);
  const beta = 1 - y0 * y0 / i0sq;
  const NcrTF = (NcrY + NcrT) / (2 * beta) * (1 - Math.sqrt(1 - 4 * beta * NcrY * NcrT / Math.pow(NcrY + NcrT, 2)));
  const Ncr = Math.min(NcrT, NcrTF), lamT = Math.sqrt(A * fy / Ncr);
  const Phi = 0.5 * (1 + 0.49 * (lamT - 0.2) + lamT * lamT), chiT = Math.min(1 / (Phi + Math.sqrt(Phi * Phi - lamT * lamT)), 1);
  const NbT = chiT * A * fy / 1000;
  log(`  i0^2 = ${iy}^2 + ${iz}^2 + ${y0}^2 = ${i0sq.toFixed(1)} mm2; G I_T = ${(G * IT).toExponential(4)}, pi^2 E I_w/L_T^2 = ${(PI * PI * E * Iw / (LT * LT)).toExponential(4)} N.mm2`);
  log(`  N_cr,T = ${(NcrT / 1000).toFixed(1)} kN; N_cr,y = ${(NcrY / 1000).toFixed(1)} kN; beta = ${beta.toFixed(4)}; N_cr,TF = ${(NcrTF / 1000).toFixed(1)} kN; lambda_T = ${lamT.toFixed(4)}; Phi = ${Phi.toFixed(4)}; chi_T = ${chiT.toFixed(4)}; N_b,T,Rd = ${NbT.toFixed(1)} kN; N_Ed/N_b,T,Rd = ${(80 / NbT).toFixed(4)}`);
  const e = engine('TFB-01', 'eigen', '(a,c)=>({NcrT:c.buck.tfb.NcrT, NcrTF:c.buck.tfb.NcrTF, NbT:c.buck.tfb.NbT, chiT:c.buck.tfb.chiT})');
  record('HC-10', 'TFB-01 N_cr,T', NcrT / 1000, e.NcrT, 'kN');
  record('HC-10b', 'TFB-01 N_cr,TF (coupled with the y-y mode)', NcrTF / 1000, e.NcrTF, 'kN');
  record('HC-10c', 'TFB-01 N_b,T,Rd (curve c)', NbT, e.NbT, 'kN', 'chi_T ' + chiT.toFixed(4) + ' vs ' + e.chiT.toFixed(4));
}

/* ---------------------------------------------------------------------------
   HC-11  HSV-04  RHS 300x100x10, 2 m SS, 470 kN (Q) at 0.3 m, high-shear M_v,Rd at the load
   V_pl,Rd = A_v fy/sqrt3 with A_v = A h/(b + h) (6.2.6(3)); at x = 0.3 m: V = 1.5 x 470 x 1.7/2 + self-weight part,
   M = 1.5 x 470 x 0.3 x 1.7/2 + self-weight part; rho = (2V/V_pl - 1)^2;
   M_v,y,Rd = (W_pl,y - rho t (h - 2t)^2/2) fy  (two webs).
   row: ["300 x 100 x 10.0",58.8,300,100,10,A 74.9,...,Sx 666 cm3, ...]
   --------------------------------------------------------------------------- */
log('\nHC-11  HSV-04  RHS 300x100x10 high-shear M_v,y,Rd at x = 0.3 m');
{
  const h = 300, b = 100, t = 10, A = 74.9e2, Sx = 666e3, fy = 275, mass = 58.8, L = 2, P = 1.5 * 470, xp = 0.3;
  const Av = A * h / (b + h), Vpl = Av * fy / Math.sqrt(3) / 1000;
  const sw = 1.35 * mass * 9.81 / 1000;
  // V just left of the load (support side): reaction R1 = P (L - xp)/L + sw L/2, V(0.3-) = R1 - sw x
  const R1 = P * (L - xp) / L + sw * L / 2, V = R1 - sw * xp, M = R1 * xp - sw * xp * xp / 2;
  const rho = Math.pow(2 * V / Vpl - 1, 2);
  const Mv = (Sx - rho * t * Math.pow(h - 2 * t, 2) / 2) * fy / 1e6, Mc = Sx * fy / 1e6;
  log(`  A_v = A h/(b + h) = ${Av.toFixed(1)} mm2, V_pl,Rd = ${Vpl.toFixed(1)} kN; R1 = ${R1.toFixed(2)} kN, V(0.3) = ${V.toFixed(2)} kN, M(0.3) = ${M.toFixed(2)} kN.m; rho = (2 x ${V.toFixed(1)}/${Vpl.toFixed(1)} - 1)^2 = ${rho.toFixed(4)}`);
  log(`  M_c,Rd = ${Mc.toFixed(2)}; M_v,y,Rd = (${Sx} - ${rho.toFixed(4)} x 10 x 280^2/2) x 275 = ${Mv.toFixed(2)} kN.m; M/M_v = ${(M / Mv).toFixed(4)}`);
  const e = engine('HSV-04', 'eigen', '(a,c)=>({MvRd:c.coex.MvRd, V:c.coex.V, M:c.coex.M, rho:c.coex.rho, u:c.coex.u, Vpl:c.VcRd})');
  record('HC-11', 'HSV-04 M_v,y,Rd (RHS two-web form) at x = 0.3 m', Mv, e.MvRd, 'kN.m', `V ${V.toFixed(1)} vs ${e.V.toFixed(1)}, rho ${rho.toFixed(4)} vs ${e.rho.toFixed(4)}`);
  record('HC-11b', 'HSV-04 V_pl,Rd (A_v = A h/(b + h))', Vpl, e.Vpl, 'kN');
  record('HC-11c', 'HSV-04 M/M_v,y,Rd', M / Mv, e.u, '-');
}

/* ---------------------------------------------------------------------------
   HC-12  AEF-01  UB 1016x305x222, S275 (tf 21.1 -> fy 265), N = 1500 kN
   EN 1993-1-5 4.4, internal element psi = 1, k_sigma = 4:
   lambda_p = (d/t)/(28.4 eps x 2), rho = (lambda_p - 0.22)/lambda_p^2, A_eff = A - (1 - rho) d tw
   row: ["1016 x 305 x 222",222.0,970.3,300.0,16.0,21.1,30.0,868.1,5.31,54.3,...,A 283 cm2]
   --------------------------------------------------------------------------- */
log('\nHC-12  AEF-01  A_eff of the Class-4 web, UB 1016x305x222');
{
  const d = 868.1, tw = 16.0, dt = 54.3, A = 283e2, fy = 265;
  const eps = Math.sqrt(235 / fy);
  const lamP = dt / (28.4 * eps * 2), rho = (lamP - 0.055 * 4) / (lamP * lamP);
  const Aeff = A - (1 - rho) * d * tw;
  log(`  eps = ${eps.toFixed(4)}, 42 eps = ${(42 * eps).toFixed(2)} < d/t ${dt}; lambda_p = ${dt}/(28.4 x ${eps.toFixed(4)} x 2) = ${lamP.toFixed(4)}; rho = (${lamP.toFixed(4)} - 0.22)/${lamP.toFixed(4)}^2 = ${rho.toFixed(4)}; A_eff = ${A} - ${(1 - rho).toFixed(4)} x ${d} x ${tw} = ${Aeff.toFixed(1)} mm2 (${(Aeff / A).toFixed(4)} A); N_c,Rd = ${(Aeff * fy / 1000).toFixed(1)} kN`);
  const e = engine('AEF-01', 'eigen', '(a,c)=>({Aeff:c.aeff.Aeff, rho:c.aeff.rho, NcRd:c.utils.find(u=>/^Compression/.test(u.name)).val})');
  record('HC-12', 'AEF-01 A_eff (EN 1993-1-5 4.4)', Aeff, e.Aeff, 'mm2', 'rho ' + rho.toFixed(4) + ' vs ' + e.rho.toFixed(4));
  record('HC-12b', 'AEF-01 N_Ed/N_c,Rd with A_eff', 1500 / (Aeff * fy / 1000), e.NcRd, '-');
}

/* ---------------------------------------------------------------------------
   HC-13  UB-49  UB 457x191x82, 4 m cantilever, 20 kN (Q) at the tip at e = 80 mm
   Vlasov cantilever, root warping fixed, tip free, tip torque T = 1.5 x 20 x 80 = 2400 kN.mm:
   phi(L) = (T/G I_T)[L - a tanh(L/a)], a = sqrt(E I_w/G I_T); B(0) = T a tanh(L/a)
   TP385_UB "457 x 191 x 82":[IT 69.2 cm4, a 1.86 m, Iw 0.922 dm6, ...]
   --------------------------------------------------------------------------- */
log('\nHC-13  UB-49  warping-torsion cantilever: tip twist and root bimoment');
{
  const IT = 69.2e4, Iw = 0.922e12, L = 4000, T = 1.5 * 20 * 1000 * 80;
  const GIt = G * IT, EIw = E * Iw, a = Math.sqrt(EIw / GIt);
  const phi = T / GIt * (L - a * Math.tanh(L / a)), B0 = T * a * Math.tanh(L / a);
  log(`  G I_T = ${GIt.toExponential(4)} N.mm2, E I_w = ${EIw.toExponential(4)} N.mm4, a = ${a.toFixed(2)} mm (P385 Table: 1.86 m), L/a = ${(L / a).toFixed(4)}, tanh = ${Math.tanh(L / a).toFixed(5)}`);
  log(`  phi(L) = ${(T / GIt).toExponential(4)} x (4000 - ${(a * Math.tanh(L / a)).toFixed(2)}) = ${phi.toFixed(5)} rad; B(0) = ${(B0 / 1e9).toFixed(4)} kN.m2 (1 kN.m2 = 1e9 N.mm2)`);
  const e = engine('UB-49', 'eigen', '(a,c)=>({phi:c.tor.phiUmax, B:c.tor.BMax, mesh:c.tor.meshError})');
  record('HC-13', 'UB-49 cantilever tip twist phi(L), tip torque', phi, e.phi, 'rad', 'mesh error ' + e.mesh.toExponential(2));
  record('HC-13b', 'UB-49 root bimoment B(0) = T a tanh(L/a)', B0 / 1e9, e.B, 'kN.m2');
}

/* ---------------------------------------------------------------------------
   HC-14  TOR-05  UB 305x165x40, 3 m cantilever, UDL 3 G + 5 Q at e = 80 mm
   uniform torque m = (1.35 x 3 + 1.5 x 5) x 80 = 924 N.mm/mm; root warping fixed, tip free:
   solving E I_w phi'''' - G I_T phi'' = m with phi(0) = phi'(0) = 0, B(L) = 0, T(L) = 0 gives
   phi(L) = (m/G I_T)[L^2/2 + a^2 (1 - sech(L/a)) - a L tanh(L/a)]  (derivation in hand-checks.md)
   TP385_UB "305 x 165 x 40":[IT 14.7 cm4, a 1.7 m, Iw 0.164 dm6, ...]
   --------------------------------------------------------------------------- */
log('\nHC-14  TOR-05  warping-torsion cantilever under a uniform torque: tip twist');
{
  const IT = 14.7e4, Iw = 0.164e12, L = 3000, m = (1.35 * 3 + 1.5 * 5) * 80;
  const GIt = G * IT, a = Math.sqrt(E * Iw / GIt), X = L / a;
  const phi = m / GIt * (L * L / 2 + a * a * (1 - 1 / Math.cosh(X)) - a * L * Math.tanh(X));
  const phiSV = m / GIt * L * L / 2;
  log(`  m = ${m} N.mm/mm; G I_T = ${GIt.toExponential(4)}; a = ${a.toFixed(2)} mm; L/a = ${X.toFixed(4)}; sech = ${(1 / Math.cosh(X)).toFixed(5)}, tanh = ${Math.tanh(X).toFixed(5)}`);
  log(`  phi(L) = ${(m / GIt).toExponential(4)} x [${(L * L / 2).toExponential(4)} + ${(a * a * (1 - 1 / Math.cosh(X))).toExponential(4)} - ${(a * L * Math.tanh(X)).toExponential(4)}] = ${phi.toFixed(5)} rad (St Venant only: ${phiSV.toFixed(4)} rad)`);
  const e = engine('TOR-05', 'eigen', '(a,c)=>({phi:c.tor.phiUmax, mesh:c.tor.meshError, T0:c.tor.TEnds[0]})');
  record('HC-14', 'TOR-05 cantilever tip twist, uniform torque', phi, e.phi, 'rad', 'mesh error ' + e.mesh.toExponential(2));
  record('HC-14b', 'TOR-05 root torque m L', m * L / 1e6, Math.abs(e.T0), 'kN.m');
}

/* ---------------------------------------------------------------------------
   HC-15  UB-51  UB 457x191x82, 8 m SS, UDL 5 G + 8 Q at e = 100 mm, both supports warping-fixed
   uniform torque t = (1.35 x 5 + 1.5 x 8) x 100 = 1875 N.mm/mm; phi = 0 and phi' = 0 at both ends:
   phi(L/2) = (t/G I_T)[L^2/8 - (L a/2) tanh(L/(4a))]
   --------------------------------------------------------------------------- */
log('\nHC-15  UB-51  warping-fixed ends, uniform torque: mid-span twist');
{
  const IT = 69.2e4, Iw = 0.922e12, L = 8000, t = (1.35 * 5 + 1.5 * 8) * 100;
  const GIt = G * IT, a = Math.sqrt(E * Iw / GIt);
  const phi = t / GIt * (L * L / 8 - L * a / 2 * Math.tanh(L / (4 * a)));
  const phiFork = t * a * a / GIt * (L * L / (8 * a * a) + 1 / Math.cosh(L / (2 * a)) - 1);
  log(`  t = ${t} N.mm/mm; a = ${a.toFixed(2)} mm; L/(4a) = ${(L / (4 * a)).toFixed(4)}; phi(L/2) = ${(t / GIt).toExponential(4)} x [${(L * L / 8).toExponential(3)} - ${(L * a / 2 * Math.tanh(L / (4 * a))).toExponential(4)}] = ${phi.toFixed(5)} rad (fork ends: ${phiFork.toFixed(4)} rad)`);
  const e = engine('UB-51', 'eigen', '(a,c)=>({phi:c.tor.phiUmax, mesh:c.tor.meshError})');
  record('HC-15', 'UB-51 mid-span twist, warping-fixed ends', phi, e.phi, 'rad', 'mesh error ' + e.mesh.toExponential(2));
}

/* ---------------------------------------------------------------------------
   HC-16  UB-43 (standard route)  UB 406x140x39, 8 m fixed-fixed, UDL, z_g = +203
   SN003a Table 3.2: fixed-ended + UDL, C1 = 2.578, C2 = 1.554.
   row: ["406 x 140 x 39",39.0,398.0,141.8,6.4,8.6,10.2,360.4,6.69,56.3,12500.0,410.0,...,10.7,49.7,0.155] -> Iy 410 cm4, J 10.7 cm4, Iw 0.155 dm6
   --------------------------------------------------------------------------- */
log('\nHC-16  UB-43 standard Mcr with C2 zg (fixed-ended + UDL, top-flange load)');
{
  const Iz = 410e4, It = 10.7e4, Iw = 0.155e12, L = 8000, C1 = 2.578, C2 = 1.554, zg = 203;
  const T1 = PI * PI * E * Iz / (L * L), IwIz = Iw / Iz, GItT1 = G * It / T1, cz = C2 * zg;
  const Mcr = C1 * T1 * (Math.sqrt(IwIz + GItT1 + cz * cz) - cz) / 1e6;
  const e0 = engine('UB-43', 'standard', '(a,c)=>({Mcr:c.ltb.Mcr, C1:c.C1, C2:c.ltb.C2, zg:c.ltb.zg, used:c.ltb.zgUsed})');
  log(`  pi^2 E Iz/L^2 = ${T1.toFixed(1)} N; Iw/Iz = ${IwIz.toFixed(1)}; G It/T1 = ${GItT1.toFixed(1)}; C2 zg = ${cz.toFixed(2)} mm; Mcr = ${Mcr.toFixed(2)} kN.m`);
  record('HC-16', 'UB-43 standard Mcr, fixed-ended UDL, C1 2.578 / C2 1.554, zg +203', Mcr, e0.Mcr, 'kN.m', `engine C1 ${e0.C1}, C2 ${e0.C2}, zg ${e0.zg} applied ${e0.used}`);
}

// ---------------------------------------------------------------------------
log('\n\n| # | Case / quantity | Hand value | Engine value | Diff % |');
log('|---|---|---|---|---|');
rows.forEach(r => log(`| ${r.id} | ${r.what} | ${r.hand.toPrecision(6)} ${r.unit} | ${r.eng.toPrecision(6)} ${r.unit} | ${r.d >= 0 ? '+' : ''}${r.d.toFixed(3)}${Math.abs(r.d) > 1 ? ' (FINDING)' : ''} |`));
const findings = rows.filter(r => Math.abs(r.d) > 1);
log(`\n${rows.length} comparisons, ${findings.length} above 1 %`);
process.exitCode = findings.length ? 1 : 0;
