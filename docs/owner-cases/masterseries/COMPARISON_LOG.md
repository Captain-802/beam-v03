# MasterSeries 2025.20.11 vs beam-v03 — live comparison log (20 Sep 2026)

Method: MasterFrame models generated as text `.$5` files (see `*.$5` here), analysed as a space frame, designed in MasterKey Steel (Sections module) with the code switched to EN 1993-1-1 UK NA. Every printout was read from the screen (zoom captures in this folder). beam-v03 numbers come from `tests/harness.cjs` runs with identical inputs (both Mcr methods). All members: 9.0 m simply supported (MasterFrame Simple Beam default span), node 1 fixed in dX dY dZ Rx, node 2 dY dZ Rx (fork ends), S275, self-weight automatic in both tools.

## UB-L1  457x191 UB 82, G 10 kN/m + Q 8 kN/m UDL + Q 30 kN at 3.0 m, no eccentricity, unrestrained

### MasterSeries BS 5950-1:2000 printout (bonus: first BS printout captured; loads 1.4 D + 1.6 L, UDL only — the point load was not in the first analysis)
```
Loading Combination : 1 UT + 1.4 D0 + 1.4 D1 + 1.6 L1     D1 D 077.010 (kN/m3), D1 UDLY -010.000, L1 UDLY -008.000
Forces LC3: V 125.67 / -125.67 kN, Mmax 282.76 kN.m @ 4.500, delta 21.15 mm @ 4.500 (LC4 = D+L service)
Classification and Properties (BS 5950: 2000): Class = Fn(b/T,d/t,py,F,Mx,My) = 5.98, 41.17, 275, 0, 282.75, 0  (Axial: Non-Slender)  Plastic
Shear Capacity Check:            Fvx/Pvx = 125.672 / 751.41 = 0.167 OK
Moment Capacity Check Mc:        Fv/Pv = 0.003/751.41 = 0  Low Shear
                                 Mc = py.Sxx <= 1.2 py.Zxx = 275 x 1831.3 <= 1.2 x 275 x 1611.05 = 503.608 kN.m
                                 MA/Mc = 282.75 / 503.608 = 0.561 OK
Equivalent Uniform Moment Factor mLT: mLT = 0.2 + (.15M2 + .5M3 + .15M4)/Mmax = 0.2 + (.15x212 + .5x283 + .15x212)/283 >= 0.44 -> 0.925  Table 18
Lateral Buckling Check Mb:       Le = 1.0 L = 1 x 9 = 9 m
                                 lambda = Le/ryy = 9/4.23 = 212.77
                                 v = Fn(x, Le, ryy, lambda) = 30.878, 9, 4.23, 212.77 -> 0.738  Table 19
                                 lambda_LT = u.v.lambda.sqrt(betaW) = 0.878 x 0.738 x 212.77 sqrt1 = 137.82
                                 pb = Fn(py, lambda_LT) = 275, 137.82 -> 76.68 N/mm2  Table 16
                                 Mb = Sxx.pb <= Mc = 1831.3 x 76.68 <= 503.608 = 140.420 kN.m
                                 MA/(Mb/mLT) = 0.925 x 282.75 / 140.42 = 1.863  Warning
Deflection Check - LC4:          In-span delta <= Span/360 : 21.15 <= 9000/360 -> 21.15 mm OK
Unity bar: Shear 0.167 | MA/Mc 0.561 | MA/(Mb/m) 1.863 | Deflection 0.846 | Max 1.863
```

### MasterSeries EN 1993-1-1 printout, same forces (BS-factored, UDL only) — LTB chain
```
Vy.Ed/Vpl.y.Rd = 125.672 / 763.881 = 0.165 OK ; at max M: 0.003/763.881 = 0 Low Shear
Mc.y.Rd = fy.Wpl.y/gM0 = 275 x 1831.3/1 = 503.608 kN.m ; My.Ed/Mc.y.Rd = 282.75/503.608 = 0.561 OK
C1 = fn(M1,M2,Mo,psi,mu) = 0.1, 0.1, 282.6, 0.984, 300.000 -> 1.127  Uniform
Le = 1.0 L = 9 m ; Mcr = Fn(C1,Le,Iz,It,Iw,E) = 1.127, 9.000, 1874, 69.21, 0.9201, 210000 -> 219.951 kN.m
lambda_LT = sqrt(1831.3 x 275 / 219.951) = 1.513
chi_LT = Fn(lambda_LT, phi_LT, beta, lambda_LT0) = 1.513, 1.631, 0.750, 0.400 -> 0.384  Curve c
chi_LT.mod = Fn(chi_LT, lambda_LT, kc, f) = 0.384, 1.513, 0.942, 1.000 -> 0.384  6.3.2.3
Mb.Rd = chi Wpl.y fy <= Mc.y.Rd = 0.384 x 1831 x 275 <= 503.608 = 193.476 kN.m ; My.Ed/Mb.Rd = 282.75/193.476 = 1.461 Warning
```
beam-v03 (same loads and factors 1.4/1.6, UDL only): standard: Mcr 220.008, lambda 1.512, chi 0.3845, kc 0.942, f 1, **Mb.Rd 193.476**, util 1.461; eigen: C1 1.131, Mcr 220.753, chi 0.3854, **Mb.Rd 193.957**, util 1.458. Vpl.Rd 756.26 (MS 763.88: Av convention), Mc.Rd 503.25 (Wpl 1830 vs 1831.3).

### MasterSeries EN 1993-1-1, Eurocode combinations (Case 021: 1.35 D + 1.5 L + notional), point load included, Axial-with-Moments brief
```
Shear Capacity Check:  Vy.Ed/Vpl.y.Rd = 149.638 / 763.881 = 0.196 OK
Local Capacity Check:  Vy.Ed/Vpl.y.Rd (at max M) = 3.407/763.881 = 0.004 Low Shear ; Mc.y.Rd = 503.608 ; Npl.Rd = 104.48x275/1 = 2873.2 kN (No bearing / block tearing design)
                       n = -0.657/2873.2 = 0.000 OK ; Wpl.N.y = Fn(1831.3, 48.112, 0) = 1831.3 ; MN.y.Rd = 503.608 ; (340.694/503.608)^2 + (0)^1 = 0.458 OK
Equivalent Uniform Moment Factors: C1 = 0.1, 0.1, 336.5, 0.905, 300.000 -> 1.127 Uniform ; CmLT = 0.95+0.05ah: Mh=0.15, Ms=336.68, psi=0.905, as=0.000 -> 0.95 ; Cmz = Max(0.6+0.4psi,0.4): M=0, psi=1 -> 1 ; Cmy -> 0.95  (Table B.3)
LTB: Le = 9 m ; Mcr = 219.951 ; lambda_LT 1.513 ; chi_LT 0.384 Curve c ; chi_LT.mod = Fn(0.384, 1.513, 0.942, 1.000) = 0.384 ; Mb.Rd = 193.476 kN.m
Buckling Resistance: UN.y = 0/2608.296 = 0 ; UN.z = 0/416.321 = 0 ; UM.y = 340.694/193.476 = 1.761 Warning ; UM.z = 0/83.572 = 0
                     kzy method: Mb,Rd < My,Rd therefore susceptible to LTB, using Table B.2
                     kyy = Cmy{1+(lambda_y-0.2)UN.y} = 0.950 ; kzz = Cmz{1+1.4UN.z} = 1.000 ; kyz = 0.6kzz = 0.600 ; kzy = 1-{0.1 lambda_z/(CmLT-0.25)}UN.z = 1.000
                     UNy + kyy.UM.y + kyz.UM.z = 0 + 0.950x1.761 + 0.6x0 = 1.673 Warning ; UNz + kzy.UM.y + kzz.UM.z = 1.761 Warning
Deflection Check - LC4: 25.64 <= 9000/360 = 25 -> 25.64 mm Warning
Unity bar: Shear 0.196 | N_Ed/N_pl 0.000 | Local 0.458 | UNyz 0.000 | UMyz 1.761 | Ax+M_6.61 1.673 | Ax+M_6.62 1.761 | Deflection 1.026 | Max 1.761
```
beam-v03 (1.35/1.5, with point load): V 149.637, M 340.914 @ 3.93, delta(D+L) 25.61 mm, Mc.Rd 503.25, M/Mc 0.677; standard: C1 1.149 (Serna), Mcr 224.246, lambda 1.498, chi 0.390, kc 0.933, f 0.999, **Mb.Rd 196.366**, util 1.736; eigen: C1 1.136, Mcr 221.699, chi 0.387, **Mb.Rd 194.574**, util 1.752.
Observation: MasterSeries keeps the UDL-table C1 = 1.127 ("Uniform") for a UDL + point-load diagram (mu saturates at 300); the FE value is 1.136 and Serna 1.149, so MasterSeries is 0.6 % (FE) to 1.5 % (Serna) conservative on Mb.Rd here.

## UB-L2  same beam and loads, horizontal eccentricity e = +40 mm on the UDLs and the point load (MasterFrame `UT Torq ex +0.040`, self-weight at the shear centre in both tools), Eurocode cases 1.35 D1 + 1.5 L1

### MasterSeries printout (Axial with Moments, "Includes Design for Torsion with Span Warping, Ends Free to Warp")
```
Forces LC1: Axial 0.66T ; Torque -5.79 / -5.19 kN.m ; Shear 149.64 / -134.64 ; Mmax 340.91 @ 3.949 ; delta 25.64 @ 4.408 (LC5)
Local: (My.Ed/MN.y.Rd)^2 = (340.694/503.608)^2 = 0.458 ; C1 1.127 Uniform ; Mcr 219.951 ; Mb.Rd 193.476
Buckling Resistance: UM.y = My.Ed/(chi_LT My.Rk/gM1) = 219.166 / 193.476 = 1.133 (NOTE: the torsion brief evaluates the LTB term with My.Ed = 219.166, the moment at the second torsion station 1.731 m, not Mmax 340.9)
   kyy 0.950 ; kzz 1.000 ; kyz 0.600 ; kzy 1.000 ; 6.61 = 1.076 ; 6.62 = 1.133
Torsion Design:  J, H, a, Qf, Qw = 69.21 cm4, 0.9201 dm6, 1859 mm, 322.2 cm3, 923.5 cm3 ; Wn0, Sw1 = 212.3 cm2, 1625 cm4
Torsion Bending Design @ 3.808 and 1.731:
   Mzt.Ed = Mxb.theta = 340.7 x 166.4e-3 = 56.68 kN.m ; Mw.Ed = E.Iw.theta''.(h-tf)/2 = 210 x 933.4e4 x 20.16e-9 x 222.00 = 8.77 kN.m
   Additional Local Torsion: Mzt.Ed/Mz.Rd + Mw.Ed/Mf.Rd = 56.679/83.57 + 8.774/40.255 = 0.896 ; Combined Local Capacity = 0.458 + 0.896 = 1.354 Warning
   Additional Torsion Buckling: k = kw.kzw.ka = 0.656 x 0.322 x 99 = 20.912 ; Cmz.Mzt/Mz.Rd + k.Mw/Mw.Rd = 0.95 x 56.679/83.572 + 20.912 x 8.774/40.255 = 5.202 ; Combined Torsion buckling = 1.133 + 5.202 = 6.335 Warning
   station 1.731: Mzt.Ed = 219.2 x 102.0e-3 = 22.36 ; Mw.Ed = 6.28 ; local 0.424 -> combined 0.881 OK ; k = 0.669 x 0.732 x 280.209 = 137.271 ; 21.672 ; Combined Torsion buckling 22.805 Warning
Torsion Shear Design @ 0.000: tau_tw = G.t.theta' = 80.77 x 9.9 x 63.78e-6 = 51.00 N/mm2 ; Smod = sqrt(1 - 51.00/(1.25 x 158.8)) = 0.862 ; Vy.Ed/(Vy.Rd.Smod) = 149.638/(763.881 x 0.862) = 0.227 OK
Deflection LC5: 25.64 <= 25 Warning ; Torq in Case 5 @ 4.275 m: theta_max = 117.7e-3 rad = 6.743 deg <= 2.00 deg Warning
Unity bar: Shear 0.196 | N/Npl 0.000 | Local 0.458 | UNyz 0.000 | UMyz 1.133 | Ax+M_6.61 1.076 | Ax+M_6.62 1.133 | Torsion 22.80 | Deflection 3.372 | Max 22.80
```
### beam-v03 (standard Mcr, P385 closed-form torsion, e = 40 mm on the three loads)
```
T_max 5.79 kN.m ; a = 1858.6 mm ; phi_max ULS 0.1683 rad = 9.64 deg (0.1672 at the P385 3.1.2 governing station x = 3.96 m) ; phi SLS 6.73 deg
Mw 8.63 kN.m (max 9.67) ; Mz = phi.My 57.00 (max 57.21) ; P385 3.1.2 cross-section (My/Mpl.y)^2 + Mw/Mpl.f + Mz/Mpl.z = 1.347
tau_t 51.02 N/mm2 ; V_pl,T,Rd 651.8 ; V/V_pl,T = 0.230 ; Mz.Rd 83.6 ; Mf.Rd 41.8 (Mpl.z/2; MasterSeries 40.255)
Annex A (EN 1993-6): k_alpha unbounded because My.Ed 340.9 > Mcr 224.2 -> printed 99, PASS blocked ; LTB 1.736 ; web bearing 0.342 / 7.2 interaction 0.442 ; deflection 1.024
```
Agreement: twist, warping moment, rotation-induced minor moment, St Venant shear stress and the local combined utilisation all within 2 %. Divergence only in the second-order amplifier, where MasterSeries prints k = 137 (ka = 280 at a station where My.Ed = 219 = Mcr) and beam-v03 refuses to evaluate an amplifier at My.Ed >= Mcr. Both verdicts: FAIL. MasterSeries' A+M brief with torsion reports UM.y at a torsion station moment (219) rather than Mmax (340.9): its 6.61/6.62 lines (1.076 / 1.133) are therefore lower than the same beam's non-torsion brief (1.673 / 1.761) — worth a query to CSCS.

## PFC-L2  200x75x23 PFC, 9 m, same loads as UB-L2 at e = +40 mm (MasterFrame: `UT D 000.000` to switch the automatic self-weight off, then `UT Torq ex +0.051` + `D1 UDLY -0.230` for the self-weight at the centroid, then `UT Torq ex +0.040` for the applied loads) — grossly overloaded (formula comparison only)

### MasterSeries printout (Axial with Moments (FAIL), torsion with span warping, ends free to warp)
```
Loads listed: D1 D 077.009 (the density line is still printed but the UT D 0 record cancels it: R1 = 146.15 kN matches 10.23 kN/m dead, not 10.46)
Forces LC1: Axial 0.64T ; Torque -5.86 / -5.26 ; Shear 146.15 / -131.15 ; Mmax 333.18 @ 3.949 ; delta 260.22 mm @ 4.316 (LC2 = LIVE ONLY, the auto-generated service case)
Class = 6, 25.17, 275, 0, 333.18, 0 -> Class 1 ; Vy.Ed/Vpl.y.Rd = 92.543/212.754 = 0.435 OK
Local: Vy.Ed/Vpl at max M = 2.87/212.754 = 0.013 Low Shear ; Mc.y.Rd = 275x227/1 = 62.425 ; Npl.Rd = 29.9x275 = 822.25 ; n = -0.639/822.25 = 0.001
       Wpl.N.y = Fn(227, 13.4, 0.001) = 227 ; MN.y.Rd = 62.425 ; (My.Ed/MN.y.Rd)^1 + (Mz/MN.z)^1 = (333.022/62.425) = 5.335 Warning   <- EXPONENT 1 for a channel (cl 6.2.9.1(6))
C1 = 0.1, 0.1, 328.7, 0.896, 300.000 -> 1.127 Uniform ; CmLT 0.95 (Mh 0.14, Ms 328.83, psi 0.896) ; Cmz 1 ; Cmy 0.95
LTB: Le = 9 m ; Mcr = Fn(1.127, 9.000, 170.0, 11.1, 0.01070, 210000) = 22.593 kN.m   <- doubly-symmetric closed form applied to the PFC
     lambda_LT = sqrt(227x275/22.593) = 1.662 ; chi_LT = Fn(1.662, 2.016, 0.750, 0.400) = 0.292 Curve d ; chi_LT.mod = Fn(0.292, 1.662, 0.942, 1.000) = 0.292 ; Mb.Rd = 0.292x227x275 <= 62.425 = 18.217 kN.m
Buckling: UN.y = 0/326.785 ; UN.z = 0/38.949 ; UM.y = 333.022/18.217 = 18.281 Warning ; UM.z = 0/16.665 ; kyy 0.950 kzz 1.000 kyz 1.000 kzy 1.000 (Table B.2, kyz = kzz for the channel) ; 6.61 = 17.367 ; 6.62 = 18.281
Torsion Design: J, H, a, Qf, Qw = 11.1 cm4, 0.01070 dm6, 500.6 mm, 80.86 cm3, 110.9 cm3 ; Wn0, Wn2, Sw1, Sw2, Sw3 = 40.22 cm2, 27.28 cm2, 107.8 cm4, 58.22 cm4, -18.51 cm4
Torsion Bending @ 3.808: Mzt.Ed = 333.0 x 1.45 = 483.0 kN.m (theta = 1.45 rad!) ; Mw.Ed = 210x43.95e4x155.3e-9x107.25 = 1.54 kN.m
   Additional Local Torsion 483.016/16.67 + 1.537/4.834 = 29.302 ; Combined Local Capacity 5.335 + 29.302 = 34.637 Warning
   k = kw.kzw.ka = 0.636 x -27.984 x 99 = -1763.131 (My.Ed > Mcr: the amplifier goes negative and is still multiplied through) ; Cmz.Mzt/Mz.Rd + k.Mw/Mw.Rd = 0.95x483.016/16.665 + -1763.131x1.537/4.834 = -532.989 ; Combined Torsion buckling 18.281 + -532.989 = 514.708 Warning
Torsion Shear @ 2.077: tau_tw = 80.77 x 6.0 x 396.9e-6 = 192.32 N/mm2 ; tau_ww = E.Sw2.theta''/t = 210.0x58.22x80.14e-12/6.0 = -1.37 ; Smod = sqrt(1 - 192.32/(1.25x158.8)) - 1.37/158.8 = 0.167 ; Vy.Ed/(Vy.Rd.Smod) = 92.543/(212.754x0.167) = 2.601 Warning
Deflection LC2: 260.22 <= 9000/360 = 25 Warning ; Torq in Case 2 @ 3.713 m: theta_max = 569.2e-3 rad = 32.61 deg <= 2.00 deg Warning
Unity bar: Shear 0.435 | N/Npl 0.001 | Local 5.335 | UNyz 0.000 | UMyz 18.28 | 6.61 17.36 | 6.62 18.28 | Torsion 514.7 | Deflection 16.30 | Max 514.7
```
### beam-v03
```
V 146.14 ; M 333.18 @ 3.915 ; T_max 5.861 ; delta(G+Q) 472.85 mm (MasterSeries' 260.22 is the live-only case: 8 kN/m + 30 kN gives 166 + 94 = 260 mm by hand) ; Class 1 ; Mc.Rd 62.425 ; M/Mc 5.337
standard (P385/P362 channel kappa chain, torsion active so the shear-centre Mcr route is not offered): lambda_LT = (9000/23.9)/96 = 3.92 ; chi 0.065 ; Mb.Rd 4.06 ; util 82.1
eigen: Mcr 23.228 (Serna C1 1.149; with C1 = 1.127 the closed form gives exactly MasterSeries' 22.593) ; lambda 1.639 ; chi 0.298 ; Mb.Rd 18.595 ; util 17.9
torsion (P385 closed form, It = 11.6 P385 value so a = 489 mm vs MasterSeries 500.6 with It = 11.1): phi_ULS 79.6 deg ; phi_SLS(G+Q) 55.5 deg ; Mw 3.67 ; Mz 462.8 ; cross-section 56.6 ; tau_t 276.8 ; Annex A refused (My.Ed >= Mcr)
```
Findings: (1) MasterSeries designs the PFC for LTB with the doubly-symmetric Mcr formula (Iz, It, Iw of the channel, C1 from the UDL table) even with the load 40 mm off the shear centre - the case the owner questioned; the beam-v03 FE route agrees with it (23.2 vs 22.6) while the P362 kappa route is 4.5x more conservative at this slenderness. (2) MasterSeries uses exponent 1 on My/MN,Rd for a channel (6.2.9.1(6)); beam-v03's P385 cross-section check squares it - see PFC46-L2. (3) Its amplifier k goes negative once My.Ed > Mcr and the negative product is still added to the utilisation; beam-v03 refuses the amplifier instead. (4) MasterSeries' deflection column reports the worse of delta/limit and theta/2 deg.

## PFC46-L2  300x100x46 PFC, 5.0 m, G 5 + Q 4 kN/m UDL + Q 10 kN at 2.0 m, all at e = +40 mm; self-weight 0.446 kN/m at e = +63 mm (centroid), automatic density off — REALISTIC (both tools 0.6-0.9)

### MasterSeries printout (Axial with Moments (FAIL) - the FAIL is the 2-degree SLS twist limit)
```
Forces LC1: Axial 0.19T ; Torque -1.73 / -1.61 ; Shear 42.38 / -39.38 ; Mmax 58.07 @ 2.041 ; delta 5.87 @ 2.449 (LC2 = D+L service, written in the file)
Class = 6.06, 26.33, 265, 0, 58.07, 0 -> Class 1 (fy = 265, tf = 16.5 > 16) ; Vy.Ed/Vpl.y.Rd = 42.38/443.082 = 0.096 OK
Local: 15.676/443.082 = 0.035 Low Shear ; Mc.y.Rd = 265x641 = 169.865 ; Npl.Rd = 58x265 = 1537 ; n = -0.193/1537 = 0.000 ; Wpl.N.y = Fn(641, 28.96, 0) = 641 ; MN.y.Rd 169.865 ; (58.054/169.865)^1 + 0 = 0.342 OK
C1 = 0.0, 0.0, 56.7, 0.950, 300.000 -> 1.127 Uniform ; CmLT = 0.95 (Mh 0.04, Ms 56.72, psi 0.950, as 0.001) ; Cmz 1 ; Cmy 0.95
LTB: Le = 5 m ; Mcr = Fn(1.127, 5.000, 568.0, 36.8, 0.08130, 210000) = 147.678 ; lambda_LT = sqrt(641x265/147.678) = 1.072 ; chi_LT = Fn(1.072, 1.187, 0.750, 0.400) = 0.519 Curve d ; chi_LT.mod = Fn(0.519, 1.072, 0.942, 0.975) = 0.532 ; Mb.Rd = 0.532x641x265 <= 169.865 = 90.438 kN.m
Buckling: UN.y 0/1317.253 ; UN.z 0/358.351 ; UM.y = 58.054/90.438 = 0.642 ; UM.z 0/39.22 ; kyy = Cmy{1+0.6 lambda_y UN.y} = 0.950 ; kzz 1.000 ; kyz 1.000 ; kzy 1.000 ; 6.61 = 0.610 OK ; 6.62 = 0.642 OK
Torsion Design: J, H, a, Qf, Qw = 36.8 cm4, 0.08130 dm6, 757.9 mm, 212.8 cm3, 314.1 cm3 ; Wn0, Wn2, Sw1, Sw2, Sw3 = 83.21 cm2, 52.16 cm2, 403.0 cm4, 244.6 cm4, -88.16 cm4
Torsion Bending @ 2.000: Mzt.Ed = 58.05 x 62.27e-3 = 3.615 ; Mw.Ed = 210x137.5e4x29.99e-9x166.41 = 1.44 kN.m
   Additional Local Torsion 3.615/39.22 + 1.441/10.931 = 0.224 ; Combined Local Capacity 0.342 + 0.224 = 0.566 OK
   k = kw.kzw.ka = 0.674 x 0.908 x 1.648 = 1.008 ; Cmz.Mzt/Mz.Rd + k.Mw/Mw.Rd = 0.95x3.615/39.22 + 1.008x1.441/10.931 = 0.220 ; Combined Torsion buckling 0.642 + 0.220 = 0.862 OK
Torsion Shear @ 0.000: tau_tw = 80.77 x 9.0 x 42.81e-6 = 31.12 ; tau_ww = 210.0x244.6x16.25e-12/9.0 = -1.53 ; Smod = sqrt(1 - 31.12/(1.25x153)) - 1.53/153 = 0.905 ; Vy.Ed/(Vy.Rd.Smod) = 42.38/(443.082x0.905) = 0.106 OK
Deflection LC2: 5.87 <= 5000/360 = 13.9 OK ; Torq in Case 2 @ 2.375 m: theta_max = 44.79e-3 rad = 2.566 deg <= 2.00 deg Warning
Unity bar: Shear 0.096 | N/Npl 0.000 | Local 0.342 | UNyz 0.000 | UMyz 0.642 | 6.61 0.610 | 6.62 0.642 | Torsion 0.862 | Deflection 1.283 | Max 0.862
```
### beam-v03
```
V 42.382 ; M 58.075 @ 2.05 ; T_max 1.7295 ; delta(G+Q) 5.872 @ 2.458 ; Class 1 ; fy 265 ; Mc.Rd 169.87 ; M/Mc 0.342 ; shear 0.096
standard (channel kappa chain): lambda_LT = (5000/31.3)/96 = 1.664 ; chi 0.291 (curve d, no f) ; Mb.Rd 49.49 ; util 1.173 -> FAIL
eigen: Mcr 155.6 ; lambda 1.045 ; chi 0.534 ; kc 0.926 ; f 0.968 ; chi_mod 0.552 ; Mb.Rd 93.818 ; util 0.619 -> PASS
torsion: a 740.9 (It 38.4 P385) ; phi_ULS 3.545 deg (MS 62.27e-3 rad = 3.568 deg at 2.0 m) ; phi_SLS 2.473 deg (MS 2.566) ; Mw 1.751 max (MS 1.44 at 2.0 m) ; Mz = phi.My 3.565 (MS 3.615) ; tau_t 30.10 (MS 31.12) ; V_pl,T,Rd 402.1 -> 0.105 (MS 0.106)
P385 3.1.2 cross-section (My/Mpl)^2 + Mw/Mf + Mz/Mpl.z = 0.117 + 0.132 + 0.091 = 0.366 (MS 0.566 because it takes My/MN,Rd to the power 1 for the channel)
Annex A: kw 0.668 (MS 0.674) ; kzw 0.911 (MS 0.908) ; LTB+torsion 0.884 (MS 0.862)
Verdict: eigen PASS except the 2-degree twist (beam-v03 reports phi_SLS 2.47 deg as an advisory, MS as a FAIL in its deflection column)
```
Agreement: forces, deflection, Mc, shear, twist, warping moment, St Venant stress, Smod, kw/kzw all within 3 %. Mb.Rd: MasterSeries 90.4 (Mcr 147.7, C1 1.127) vs eigen 93.8 (FE Mcr 155.6) vs kappa chain 49.5. Open beam-v03 items from this case: (a) channel cross-section exponent should be 1 (6.2.9.1(6)); (b) the SLS twist limit (2 deg) should be a governing utilisation, not an advisory, if the MasterSeries convention is wanted.

## UC-L2  203x203 UC 60, 6.0 m, G 5 + Q 4 kN/m UDL + Q 10 kN at 2.0 m, all at e = +40 mm (self-weight automatic at the shear centre in both tools)

### MasterSeries printout (Axial with Moments (FAIL) - only the 2-degree twist fails)
```
Forces LC1: Axial 0.22T ; Torque -1.93 / -1.73 ; Shear 50.63 / -45.63 ; Mmax 76.87 @ 2.633 ; delta 15.56 @ 2.939 (LC2 D+L)
Class = 7.25, 17.11, 275, 0, 76.87, 0 -> Class 1 ; Vy.Ed/Vpl.y.Rd = 50.632/351.748 = 0.144 OK
Local: 1.252/351.748 = 0.004 Low Shear ; Mc.y.Rd = 275x656.1 = 180.428 ; Npl.Rd = 76.37x275 = 2100.175 ; n = -0.223/2100.175 = 0.000 ; Wpl.N.y = Fn(656.1, 22.154, 0) = 656.1 ; MN.y.Rd 180.428 ; (76.807/180.428)^2 + 0 = 0.181 OK
C1 = 0.0, 0.0, 75.9, 0.917, 300.000 -> 1.127 Uniform ; CmLT 0.95 (Mh 0.05, Ms 75.94, psi 0.917, as 0.001) ; Cmz 1 ; Cmy 0.95
LTB: Le = 6 m ; Mcr = Fn(1.127, 6.000, 2068, 47.23, 0.1969, 210000) = 273.518 ; lambda_LT = sqrt(656.1x275/273.518) = 0.812 ; chi_LT = Fn(0.812, 0.817, 0.750, 0.400) = 0.810 Curve b ; chi_LT.mod = Fn(0.810, 0.812, 0.942, 0.971) = 0.835 ; Mb.Rd = 0.835x656.1x275 <= 180.428 = 150.588 kN.m
Buckling: UN.y 0/1558.238 ; UN.z 0/791.267 ; UM.y = 76.807/150.588 = 0.510 ; UM.z 0/83.958 ; kyy = Cmy{1+(lambda_y-0.2)UN.y} = 0.950 ; kzz = Cmz{1+1.4UN.z} = 1.000 ; kyz = 0.6kzz = 0.600 ; kzy = 1-{0.1 lambda_z/(CmLT-0.25)}UN.z = 1.000 ; 6.61 = 0.485 OK ; 6.62 = 0.510 OK
Torsion Design: J, H, a, Qf, Qw = 47.23 cm4, 0.1969 dm6, 1041 mm, 136.2 cm3, 330.4 cm3 ; Wn0, Sw1 = 100.5 cm2, 734.5 cm4
Torsion Bending @ 2.538: Mzt.Ed = 76.81 x 59.38e-3 = 4.561 ; Mw.Ed = 210x1031e4x16.12e-9x97.70 = 3.41 kN.m
   Additional Local Torsion 4.561/83.96 + 3.411/41.348 = 0.137 ; Combined Local Capacity 0.181 + 0.137 = 0.318 OK
   k = 0.684 x 0.946 x 1.39 = 0.899 ; 0.95x4.561/83.958 + 0.899x3.411/41.348 = 0.126 ; Combined Torsion buckling 0.510 + 0.126 = 0.636 OK
Torsion Shear @ 0.000: tau_tw = 80.77 x 9.4 x 34.45e-6 = 26.16 ; Smod = sqrt(1 - 26.16/(1.25x158.8)) = 0.932 ; 50.632/(351.748x0.932) = 0.154 OK
Deflection LC2: 15.56 <= 6000/360 = 16.7 OK ; Torq in Case 2 @ 2.85 m: theta_max = 41.94e-3 rad = 2.403 deg <= 2.00 deg Warning
Unity bar: Shear 0.144 | N/Npl 0.000 | Local 0.181 | UNyz 0.000 | UMyz 0.510 | 6.61 0.485 | 6.62 0.510 | Torsion 0.636 | Deflection 1.201 | Max 0.636
```
### beam-v03
```
V 50.634 ; M 76.874 @ 2.628 ; T_max 1.93 ; delta(G+Q) 15.578 @ 2.95 ; Class 1 ; Mc.Rd 180.4 ; M/Mc 0.426 ; shear 0.144
standard: C1 1.148 (Serna) ; Mcr 278.43 ; lambda 0.805 ; chi 0.814 ; kc 0.933 ; f 0.967 ; chi_mod 0.843 ; Mb.Rd 152.0 ; util 0.506
eigen:    Mcr 275.2 ; lambda 0.810 ; chi 0.812 ; kc 0.939 ; f 0.969 ; chi_mod 0.8375 ; Mb.Rd 151.09 ; util 0.509
torsion: a 1040.2 ; phi_ULS 3.439 deg (MS 59.38e-3 rad = 3.402 deg at 2.538 m) ; phi_SLS 2.399 deg (MS 2.403) ; Mw 3.915 max (MS 3.41 at 2.538) ; Mz = phi.My 4.603 (MS 4.561) ; tau_t 26.19 (MS 26.16) ; V_pl,T,Rd 328.2 -> 0.154 (MS 0.154)
P385 3.1.2 cross-section 0.317 (MS 0.318) ; Annex A: kw 0.684 (MS 0.684) ; kzw 0.946 (MS 0.946) ; LTB+torsion 0.650 / 0.652 (MS 0.636)
Verdict: PASS (twist 2.40 deg advisory) - MS FAIL on the 2-degree twist only
```
Agreement: every number within 1 % except Mb.Rd (+0.3 / +0.9 % from C1) and the Annex A total (+2 %, beam-v03 uses the peak Mw rather than the value at the torsion station).

## SHS-L2  150x150x6.3 SHS (hot finished), 4.0 m, G 3 + Q 3 kN/m UDL + Q 8 kN at 2.0 m, all at e = +40 mm

### MasterSeries printout (Axial with Moments (FAIL) - the FAIL is the L/360 deflection)
```
Forces LC1: Axial 0.12T ; Torque -0.92 / -0.92 ; Shear 23.84 / -23.84 ; Mmax 29.84 @ 2.000 ; delta 12.29 @ 2.000 (LC2 D+L)
Class = 20.81, 20.81, 275, 0, 29.844, 0 -> Class 1 ; Vy.Ed/Vpl.y.Rd = 23.844/284.121 = 0.084 OK
Local: 6/284.121 = 0.021 Low Shear ; Mc.y.Rd = 275x191.97 = 52.792 ; Npl.Rd = 35.79x275 = 984.225 ; n = -0.119/984.225 = 0.000 ; Wpl.N.y = Fn(191.97, 17.895, 0) = 191.97 ; MN.y.Rd 52.792
       (My.Ed/MN.y.Rd)^1.66 + (Mz.Ed/MN.z.Rd)^1.66 = (29.844/52.792)^1.66 + 0 = 0.388 OK      <- hollow-section exponents alpha = beta = 1.66
C1 = 0.0, 0.0, 29.8, 0.913, 300.000 -> 1.127 Uniform ; CmLT 0.95 ; Cmz 1 ; Cmy 0.95
LTB: Mb.Rd = Mc.y.Rd  "Section not susceptible to lateral torsional buckling"  52.792 kN.m
Buckling: UN.y 0/790.044 ; UN.z 0/790.044 ; UM.y = 29.844/52.792 = 0.565 ; UM.z 0/52.792 ; kzy method: Mb.Rd >= My.Rd therefore not susceptible to LTB, using Table B.1
          kyy = Cmy{1+(lambda_y-0.2)UN.y} = 0.950 ; kzz = Cmz{1+(lambda_z-0.2)UN.z} = 1.000 ; kyz = 0.6kzz = 0.600 ; kzy = 0.6kyy = 0.570 ; 6.61 = 0.537 OK ; 6.62 = 0.322 OK
Torsion Design: J, C, Qf, Qw = 1909 cm4, 239.6 cm3, 97.63 cm3, 97.63 cm3
Torsion Bending @ 2.000: tau_t.Ed = To/C = 0.24/239.6 = 1.00 N/mm2 ; Smod = 1 - 1.00/(fv/gM0) = 0.994 ; Modified Local Capacity (My.Ed/(My.pl.Rd.Smod))^1.66 + (Mz.Ed/(Mz.pl.Rd.Smod))^1.66 = 0.392 OK
Torsion Shear in web @ 4.000: tau_t = 0.924/239.6 = 3.86 N/mm2 ; Smod = 1 - 3.86/(fv/gM0) = 0.976 ; Vy.Ed/(Vy.Rd.Smod) = 23.844/(284.121x0.976) = 0.086 OK
Deflection LC2: 12.29 <= 4000/360 = 11.1 Warning ; Torq in Case 2 @ 2.0 m: theta_max = 518.8e-6 rad = 0.03 deg <= 2.00 deg OK
Unity bar: Shear 0.084 | N/Npl 0.000 | Local 0.388 | UNyz 0.000 | UMyz 0.565 | 6.61 0.537 | 6.62 0.322 | Torsion 0.392 | Deflection 1.106 | Max 1.106
```
### beam-v03 (standard; the eigen route is the same because LTB is ignored)
```
V 23.844 ; M 29.844 @ 2.0 ; T_max 0.924 ; delta(G+Q) 12.329 @ 2.0 ; Class 1 ; Mc.Rd 52.8 ; M/Mc 0.565 (linear) ; shear 0.084
LTB: closed-form Mcr (Iw = 0) 1865 kN.m ; lambda_LT 0.168 <= 0.4 -> ignored, Mb.Rd = Mc.Rd ; util 0.565
torsion (box): W_t 240 cm3 (P385 Table A.7; MS C = 239.6) ; T_Rd 38.1 ; T_Ed 0.924 -> 0.024 ; tau_t 3.85 N/mm2 (MS 3.86) ; V_pl,T,Rd 277.3 -> V/V_pl,T = 0.086 (MS 0.086) ; phi_SLS 0.030 deg (MS 0.03)
Deflection 1.110 (MS 1.106) -> FAIL in both
```
Agreement: forces, Mc, shear, torsional shear stress, shear-torsion reduction, twist and deflection all within 0.5 %. Differences of presentation only: MasterSeries prints the Class-1 hollow-section interaction with the 1.66 exponents (0.388) and a torsion-modified copy of it (0.392); beam-v03 prints the linear M/Mc (0.565) - both pass by a margin.

## RHS-L2  200x100x8 RHS (hot finished, major axis), 5.0 m, G 3 + Q 3 kN/m UDL + Q 8 kN at 2.0 m, all at e = +40 mm

### MasterSeries printout (Axial with Moments (FAIL) - the FAIL is the L/360 deflection)
```
Forces LC1: Axial 0.13T ; Torque -1.14 / -1.05 ; Shear 29.74 / -27.34 ; Mmax 41.45 @ 2.000 ; delta 15.20 @ 2.449 (LC2 D+L)
Class = 9.5, 22, 275, 0, 41.445, 0 -> Class 1 ; Vy.Ed/Vpl.y.Rd = 29.738/473.668 = 0.063 OK
Local: 11.709/473.668 = 0.025 Low Shear ; Mc.y.Rd = 275x281.95 = 77.536 ; Npl.Rd = 44.75x275 = 1230.625 ; n = 0.000 ; Wpl.N.y = Fn(281.95, 29.833, 0) = 281.95 ; MN.y.Rd 77.536 ; (41.443/77.536)^1.66 + 0 = 0.354 OK
C1 = 0.0, 0.0, 40.1, 0.963, 300.000 -> 1.127 Uniform ; CmLT 0.95 ; Cmz 1 ; Cmy 0.95
LTB: Mb.Rd = Mc.y.Rd  "Section not susceptible to lateral torsional buckling"  77.536 kN.m
Buckling: UN.y 0/967.963 ; UN.z 0/503.262 ; UM.y = 41.443/77.536 = 0.534 ; UM.z 0/47.24 ; Table B.1: kyy 0.950 ; kzz = Cmz{1+0.8UN.z} = 1.000 ; kyz 0.600 ; kzy = 0.6kyy = 0.570 ; 6.61 = 0.508 OK ; 6.62 = 0.305 OK
Torsion Design: J, C, Qf, Qw = 1804 cm4, 251.2 cm3, 87.71 cm3, 144.5 cm3
Torsion Bending @ 2.000: tau_t.Ed = 0.459/251.2 = 1.83 N/mm2 ; Smod = 0.988 ; Modified Local Capacity = 0.360 OK
Torsion Shear in web @ 0.000: tau_t = 1.143/251.2 = 4.55 N/mm2 ; Smod = 1 - 4.55/(fv/gM0) = 0.971 ; Vy.Ed/(Vy.Rd.Smod) = 29.738/(473.668x0.971) = 0.065 OK
Deflection LC2: 15.2 <= 5000/360 = 13.9 Warning ; Torq in Case 2 @ 2.0 m: theta_max = 756.1e-6 rad = 0.043 deg <= 2.00 deg OK
Unity bar: Shear 0.063 | N/Npl 0.000 | Local 0.354 | UNyz 0.000 | UMyz 0.534 | 6.61 0.508 | 6.62 0.305 | Torsion 0.360 | Deflection 1.095 | Max 0.534
```
### beam-v03 (standard)
```
V 29.737 ; M 41.444 @ 2.0 ; T_max 1.143 ; delta(G+Q) 15.23 @ 2.458 ; Class 1 ; Mc.Rd 77.55 ; M/Mc 0.534 ; shear 0.063
LTB: closed-form Mcr (Iw = 0) 1126 kN.m ; lambda_LT 0.262 <= 0.4 -> ignored, Mb.Rd = Mc.Rd ; util 0.534
torsion (box): W_t 251 cm3 (MS C = 251.2) ; T_Rd 39.85 ; T_Ed 1.143 -> 0.029 ; tau_t 4.55 N/mm2 (MS 4.55) ; V_pl,T,Rd 460.6 -> 0.065 (MS 0.065) ; phi_SLS 0.043 deg (MS 0.043)
Deflection 1.097 (MS 1.095) -> FAIL in both
```
Agreement: all quantities within 0.3 %. Same presentation difference as SHS-L2 (1.66-exponent interaction 0.354/0.360 in MasterSeries vs linear 0.534 in beam-v03).

## UB6-L3  457x191 UB 82, 6.0 m, G 10 + Q 8 kN/m UDL + Q 30 kN at 2.0 m, no eccentricity, PLUS an axial load: MasterFrame `L1 PX -200.000 6.000` (200 kN at node 2 pushing towards the dX-held node 1, factored 1.5 -> N_Ed = 299.5 kN compression)

### MasterSeries printout (Axial with Moments - all OK)
```
Forces LC1: Axial 299.54C / 0.46T ; Shear 109.76 / -94.76 ; Mmax 168.86 @ 2.412 ; delta 5.56 @ 2.907 (LC2)
Class = Fn(b/T, d/t, fy, N, My, Mz) = 5.98, 41.17, 275, 299.54, 168.85, 0 -> Class 1 (Axial: Non-Slender)   <- classified under the combined N + M
Vy.Ed/Vpl.y.Rd = 109.759/763.881 = 0.144 OK ; Local: 2.732/763.881 = 0.004 Low Shear ; Mc.y.Rd 503.608 ; Npl.Rd = 104.48x275 = 2873.2 ; n = -0.457/2873.2 = 0.000 (tension end) ; Wpl.N.y = Fn(1831.3, 48.112, 0) = 1831.3 ; MN.y.Rd 503.608 ; (168.727/503.608)^2 + 0 = 0.112 OK
Compression Resistance N.b.Rd:
   Ley = Ky.Ly = 1x6 = 6 ; lambda_y = sqrt(A fy/Ncr) = sqrt(104.48x275/21333.1) = 0.367 ; lambda_y = Ley/iy = 100x6/18.83 = 31.9 OK ; Nb.y.Rd = 104.48 x 0.961 x 275/10/1 = 2761.908 kN Curve a
   Lez = Kz.Lz = 6 ; lambda_z = 100x6/4.23 = 141.8 OK ; lambda_z = sqrt(104.48x275/1078.74) = 1.634 ; Nb.z.Rd = 104.48 x 0.297 x 275/10 = 854.272 kN Curve b
   Let = Kt.Lz = 6 ; lambda_T = sqrt(104.48x275/2923.09) = 0.991 ; Nb.T.Rd = 104.48 x 0.602 x 275/10 = 1731.021 kN Curve b   <- torsional buckling printed for the I section too
   N.Ed/N.b.Rd = 299.543/854.272 = 0.351 OK
C1 = 0.1, 0.1, 164.5, 0.869, 300.000 -> 1.127 Uniform ; CmLT = 0.95+0.05ah: Mh 0.11, Ms 164.64, psi 0.869, as 0.001 -> 0.95 ; Cmz 1 ; Cmy 0.95
LTB: Le = 6 m ; Mcr = Fn(1.127, 6.000, 1874, 69.21, 0.9201, 210000) = 386.228 ; lambda_LT 1.142 ; chi_LT = Fn(1.142, 1.171, 0.750, 0.400) = 0.556 Curve c ; chi_LT.mod = Fn(0.556, 1.142, 0.942, 0.978) = 0.569 ; Mb.Rd = 0.569x1831x275 <= 503.608 = 286.562 kN.m
Buckling: UN.y = 299.543/2761.908 = 0.108 ; UN.z = 299.543/854.272 = 0.351 ; UM.y = 168.727/286.562 = 0.589 ; UM.z 0/83.572
   kzy method: Mb.Rd < My.Rd therefore susceptible to LTB, using Table B.2
   kyy = Cmy{1+(lambda_y-0.2)UN.y} = 0.967 ; kzz = Cmz{1+1.4UN.z} = 1.491 ; kyz = 0.6kzz = 0.895 ; kzy = 1-{0.1 lambda_z/(CmLT-0.25)}UN.z = 0.918   <- 1 - 0.1x1.634x0.351/0.70; the Table B.2 floor 1 - 0.1 UN.z/(CmLT-0.25) = 0.950 is NOT applied
   6.61: 0.108 + 0.967x0.589 + 0.895x0 = 0.678 OK ; 6.62: 0.351 + 0.918x0.589 + 1.491x0 = 0.891 OK
Deflection LC2: 5.56 <= 6000/360 = 16.7 OK
Unity bar: Shear 0.144 | N/Npl 0.000 | Local 0.112 | lambda_y 0.127 | lambda_z 0.567 | N/Nb 0.351 | UNyz 0.351 | UMyz 0.589 | 6.61 0.678 | 6.62 0.891
```
### beam-v03 (S.axial = 300 kN = the factored N_Ed; standard / eigen)
```
V 109.76 ; M 168.87 @ 2.436 ; delta 5.55 ; Class 1 (bending) ; Mc.Rd 503.25 ; Npl.Rd 2860 ; M/Mc 0.336 ; 6.2.9 cross-section 0.113 (MS 0.112)
Compression: web c/t 41.17 > 42 eps = 38.8 -> Class 4 in UNIFORM compression, so A_eff = 10066 mm2 (0.984 A) is used for N: N/Nc,Rd 0.108 ; Nb.y 2664.5 (MS 2761.9) ; Nb.z 845.8 (MS 854.3) ; lambda_z-bar 1.607 (MS 1.634, gross A) ; no torsional-buckling strut check for the I section (MS Nb.T 1731, not governing)
LTB: standard C1 1.162 (Serna) Mcr 398.38 chi_mod 0.583 Mb.Rd 293.43 util 0.575 ; eigen Mcr 393.11 chi_mod 0.577 Mb.Rd 290.42 util 0.581 (MS 286.56 / 0.589)
Interaction: Cmy = CmLT = Cmz = 1.0 ("mixed UDL + point-load diagram: no Table B.3 reduction assumed"; MS 0.95) ; because of the Class-4-in-compression web the Table B.2 CLASS 3/4 rows are used: kyy = 1 + 0.6 lambda_y ny = 1.024 ; kzz = 1 + 0.6 nz = 1.213 ; kyz = kzz ; kzy = 1 - 0.05 nz/(CmLT-0.25) = 0.976 ; and Mb.Rd is scaled by W_el/W_pl = 0.880 -> 258.2
   6.61 = 0.108 + 1.024x168.87/258.2 = 0.783 (eigen 0.790) ; 6.62 = 0.355 + 0.976x168.87/258.2 = 0.993 (eigen 1.000) -> PASS, but 15 % above MasterSeries
```
Findings: the two tools agree on forces, Mc, Npl, Mb (within 2.5 %) and the strut curves, but the interaction check differs by design: (1) MasterSeries classifies the section under the actual N + M (Class 1) and keeps gross A, W_pl and the Class 1/2 k-factors; beam-v03 classifies the web under uniform compression (Class 4 for this UB), switches to A_eff, W_el and the Class 3/4 k-factors - conservative by ~15 % on 6.61/6.62. (2) beam-v03 takes Cm = 1.0 for a UDL + point-load diagram; MasterSeries reads Table B.3's uniform row (0.95). (3) MasterSeries' kzy = 0.918 ignores the Table B.2 lower bound (0.950) - conservative on its side. (4) MasterSeries prints a torsional-buckling strut resistance Nb.T for the I section (not governing here); beam-v03 only does so for channels.

## UB6-L1 / L4  457x191 UB 82, 6.0 m, G 10 + Q 8 kN/m UDL + Q 30 kN at 2.0 m — baseline, then the same file with `UT Torq ex +0.000 ey +0.230` (vertical loads placed at the top flange)

### MasterSeries (both files give the SAME printout: a vertical eccentricity on a vertical load produces no torque and MasterSeries does not read it as a load height)
```
Forces LC1: Torque 0.00 ; Shear 109.76 / -94.76 ; Mmax 168.87 @ 2.449 ; delta 5.56 @ 2.939 ; Class 1 ; Vy/Vpl 0.144 ; (168.727/503.608)^2 = 0.112
C1 = 0.1, 0.1, 164.5, 0.869, 300 -> 1.127 ; CmLT 0.95 ; Cmz 1 ; Cmy 0.95
LTB: Le = 1.0 L = 6 m ; Mcr = Fn(1.127, 6.000, 1874, 69.21, 0.9201, 210000) = 386.228 ; lambda_LT 1.142 ; chi_LT 0.556 Curve c ; chi_LT.mod = Fn(0.556, 1.142, 0.942, 0.978) = 0.569 ; Mb.Rd = 286.562 kN.m ; UM.y = 168.727/286.562 = 0.589
kyy 0.950 ; kzz 1.000 ; kyz 0.600 ; kzy 1.000 ; 6.61 = 0.559 ; 6.62 = 0.589 ; Deflection 5.56 <= 16.7 OK
Unity bar: Shear 0.144 | Local 0.112 | UMyz 0.589 | 6.61 0.559 | 6.62 0.589 | Deflection 0.334 | Max 0.589
```
### MasterSeries brief variants on the same member (Axial + Moment Design Data tab / Lateral Restraint tab)
```
Le End 1 = "1.2 L" (the destabilising-load convention; the list offers 1.0 L, 1.4 L + 2D, 1.2 L + 2D, 1.0 L + 2D, 0.5 L ... 10 L and "Fully Restrained" - no explicit load-height input):
   Le = 1.2 x 6 = 7.2 m ; Mcr = Fn(1.127, 7.200, ...) = 296.971 ; lambda_LT 1.302 ; chi 0.474 ; chi_mod = Fn(0.474, 1.302, 0.942, 0.986) = 0.480 ; Mb.Rd = 241.969 ; UM.y = 0.697 ; 6.62 = 0.697 (strut lengths stay 6 m)
Lateral Restraint tab, Equal Spacing = 3 m (both flanges restrained): member designed portion by portion, Portion 01: 0.000 to 3.000 governs
   C1 = fn(M1, M2, Mo, psi, mu) = 0.1, 164.7, 52.3, 0.001, 0.318 -> 1.244 "Uniform" ; CmLT = Max(0.2 + 0.8 as, 0.4): Mh 164.65, Ms 134.73, psi 0.001, as 0.818 -> 0.855
   Le = 1.0 L = 3 m ; Mcr = Fn(1.244, 3.000, 1874, 69.21, 0.9201, 210000) = 1337.262 ; lambda_LT 0.614 ; chi 0.878 Curve c ; chi_mod = Fn(0.878, 0.614, 0.897, 0.952) = 0.922 ; Mb.Rd = 464.415 ; UM.y = 168.864/464.415 = 0.364 ; kzz = Cmz{1+(2 lambda_z - 0.6)UN.z} = 1.000 ; 6.61 0.345 ; 6.62 0.364
   (with the Le list left on "1.0 L + 2D" the portion length becomes 1 x 3 + 2 x 0.460 = 3.92 m, Mcr 839.066, Mb.Rd 413.942, UM.y 0.408)
Restraint Side = "Bottom flange restrained" (tension flange only, sagging span): printout UNCHANGED (Le 3 m, Mb.Rd 464.415) - MasterSeries still counts the tension-flange point as a full LTB restraint; the option only opens an "a (mm)" / "Elastic Plastic Stability" box for a BS 5950 Annex G style check that is not evaluated with a = 0.
```
### beam-v03
```
baseline: standard C1 1.162 Mcr 398.38 chi_mod 0.583 Mb.Rd 293.43 util 0.575 ; eigen Mcr 393.11 chi_mod 0.577 Mb.Rd 290.42 util 0.581 (MS 286.56 / 0.589: MasterSeries 1.3-2.3 % lower through C1 = 1.127)
destabilising / L_E factor 1.2 (standard): LE 7.2 m ; Mcr 306.32 ; lambda 1.282 ; chi_mod 0.493 ; Mb.Rd 248.1 ; util 0.681 (MS 241.97 / 0.697 - same 1.2 L convention, C1 apart)
destabilising (eigen) with every zg = 0: refused - "Destabilising loading is ticked but every load height zg is 0" (asks for the real load height)
L_E factor 1.2 (eigen): SILENTLY IGNORED - the FE Mcr stays 393.11 (finding F-G below)
load height zg = +229.5 mm (top flange) standard: refused - C2 not published for a UDL + point-load diagram (PASS blocked) ; eigen: Mcr 284.05 ; lambda 1.331 ; chi_mod 0.467 ; Mb.Rd 234.91 ; util 0.719 (physically-based; 3 % below MasterSeries' 1.2 L convention)
midspan lateral + torsional restraint (S.ltbRestraints = [{pos: 3, v, phi}]):
   standard route: IGNORES the intermediate restraint ("the member is treated as ONE segment of length LE = 1.00 L") -> Mb.Rd 293.43, util 0.575 (finding F-H)
   eigen route: whole-member Mcr 1459 (restraint continuity), plus the bay-isolation check that governs: bay 0-3 m, C1 inputs M1 0, M2 164.64, Mo 52.41, psi 0, mu 0.318 (identical to MasterSeries' inputs), fork-ended bay Mcr 1352.3, lambda 0.610, chi 0.880 (no f-factor in the bay chain), Mb.Rd 442.9, util 168.87/442.9 = 0.381 (MS 0.364: MasterSeries applies chi_mod with f = 0.952)
   lateral-only restraint (v without phi): bay result unchanged (0.381); whole-member chi 0.888
tension-flange-only restraint: no input for the restraint height in beam-v03 (open item from the release notes); neither tool models it for EC3.
```
Findings: F-G eigen route ignores the L_E override (should either apply it or say so); F-H standard route ignores intermediate LTB restraints (should design the restrained segment with its own C1, as MasterSeries does); F-I MasterSeries treats a tension-flange restraint as a full restraint in a sagging span.

## UB6-L5  same member and vertical loads PLUS horizontal (global Z) loads: `L1 UDLZ +2.000` and `L1 PZ +10.000 2.000` (an inclined load resolved into components; biaxial bending)

### MasterSeries printout (Axial with Moments (FAIL) - the FAIL is the deflection)
```
Forces LC1: Shear y-y 109.76 / -94.76, z-z -19.00 / 14.00 ; Mmax y-y 168.87 @ 2.449, z-z -32.00 @ 2.000 ; delta 19.19 @ 2.878 (RESULTANT of the two directions)
Class = 5.98, 41.17, 275, 0, 168.85, 32 -> Class 1 ; Vy/Vpl.y 0.144 ; Vz.Ed/Vpl.z.Rd = 19/971.935 = 0.020
Local: Vy 56.586/763.881 = 0.074 Low Shear ; Mc.y.Rd 503.608 ; Vz 13/971.935 = 0.013 Low Shear ; Mc.z.Rd = 275x303.9 = 83.572 ; Npl 2873.2 ; Wpl.N.z = Fn(303.9, 61.216, 0) = 303.9 ; MN.z.Rd 83.572
       (My.Ed/MN.y.Rd)^2 + (Mz.Ed/MN.z.Rd)^1 = (166.342/503.608)^2 + (31.998/83.572)^1 = 0.492 OK   (alpha = 2, beta = 5n >= 1 -> 1)
C1 1.127 ; CmLT 0.95 ; Cmz = 0.95+0.05ah: Mh -0.02, Ms -28.5, psi 0.722, as 0.001 -> 0.95 ; Cmy 0.95
LTB unchanged: Mcr 386.228 ; Mb.Rd 286.562 ; UM.y = 168.648/286.562 = 0.589 ; UM.z = Mz.Ed/(Mz.Rk/gM1) = 31.241/83.572 = 0.374 (Mz at the check station, not the 32.0 peak)
kyy 0.950 ; kzz = Cmz{1+1.4UN.z} = 0.950 ; kyz = 0.6kzz = 0.570 ; kzy 1.000 ; 6.61 = 0 + 0.950x0.589 + 0.570x0.374 = 0.772 OK ; 6.62 = 0 + 1.000x0.589 + 0.950x0.374 = 0.944 OK
Deflection LC2: 19.19 <= 6000/360 = 16.7 Warning (resultant; the vertical component alone is 5.56)
Unity bar: Shear 0.144 | Local 0.492 | UMyz 0.589 | 6.61 0.772 | 6.62 0.944 | Deflection 1.151 | Max 0.944
```
### beam-v03 (no minor-axis load input: the peak Mz,Ed = 32.0 kN.m entered as the constant design value S.Mz)
```
Biaxial cross-section 6.2.9.1: (168.87/503.25)^2 + 32/83.6 = 0.495 (MS 0.492)
6.61 = 1.0x0.575 + 0.6x0.383 = 0.805 (eigen 0.811) ; 6.62 = 0.575 + 1.0x0.383 = 0.958 (eigen 0.964)   (MS 0.772 / 0.944: Cm = 1 vs 0.95 and the 32.0 peak vs 31.2 at the station)
Deflection: vertical only, 5.56 mm -> 0.333 PASS ; the horizontal deflection (about 18 mm) and the resultant are not computed
```
Findings: interaction agrees to within 4 % once Mz,Ed is supplied by hand; beam-v03 has no minor-axis load, minor-axis shear or resultant-deflection check (finding F-J) - MasterSeries fails this member on the resultant deflection, beam-v03 passes it.

## UB6-L6  same member and vertical loads PLUS an external moment: `L1 PMZ +050.000 4.000` (50 kN.m about the major axis at 4.0 m)

### MasterSeries printout (Axial with Moments - all OK)
```
Forces LC1: Shear 122.26 / -82.26 ; Mmax 202.24 @ 2.875 (diagram steps down by 75 kN.m at 4.0 m) ; delta 6.36 @ 2.938
Class 1 ; Vy/Vpl = 122.259/763.881 = 0.160 ; Local (202.137/503.608)^2 = 0.161
C1 = fn(M1, M2, Mo, psi, mu) = 0.1, 0.1, 202.0, 0.667, 300.000 -> 1.127 "Uniform" (the step in the diagram is not seen by the C1 table) ; CmLT 0.95 ; Cmz 1 ; Cmy 0.95
LTB: Mcr 386.228 ; Mb.Rd 286.562 ; UM.y = 202.137/286.562 = 0.705 ; kyy 0.950 kzz 1.000 kyz 0.600 kzy 1.000 ; 6.61 0.670 ; 6.62 0.705 ; Deflection 6.36 <= 16.7 OK
Unity bar: Shear 0.160 | Local 0.161 | UMyz 0.705 | 6.61 0.670 | 6.62 0.705 | Deflection 0.382 | Max 0.705
```
### beam-v03 (load {type: 'moment', pos: 4, M: 50, case: 'Q'})
```
V 122.26 ; M 202.25 @ 2.904 ; delta 6.358 ; M/Mc 0.402
standard: Serna C1 1.205 (whole-diagram inputs Mo 202.14, psi 1, mu 300) ; Mcr 413.2 ; chi_mod 0.600 ; Mb.Rd 301.82 ; util 0.670
eigen:    Mcr 398.75 ; chi_mod 0.584 ; Mb.Rd 293.65 ; util 0.689     (MS 286.56 / 0.705)
```
Agreement: forces and deflection exact; Mb.Rd within 2.5 % (eigen) / 5 % (Serna). MasterSeries keeps the UDL-table C1 for any single-span diagram whose mu saturates; the FE value with the moment step is 3 % higher.

## UB6-L2  457x191 UB 82, 6.0 m, G 10 + Q 8 kN/m UDL + Q 30 kN at 2.0 m, all at e = +40 mm — ends free to warp, then End Warping Fixity = 100 % (Axial + Moment Design Data tab, Torsion box)

### MasterSeries printout, ends free to warp
```
Forces LC1: Torque -4.26 / -3.66 ; Shear 109.76 / -94.76 ; Mmax 168.87 @ 2.449 ; delta 5.56 ; Class 1 ; Vy/Vpl 0.144 ; Local (168.648/503.608)^2 = 0.112
C1 1.127 ; CmLT 0.95 ; LTB unchanged: Mcr 386.228 ; Mb.Rd 286.562 ; UM.y 0.589 ; 6.61 0.559 ; 6.62 0.589
Torsion Design: J, H, a, Qf, Qw = 69.21 cm4, 0.9201 dm6, 1859 mm, 322.2 cm3, 923.5 cm3 ; Wn0, Sw1 = 212.3 cm2, 1625 cm4
Torsion Bending @ 2.308: Mzt.Ed = 168.6 x 58.12e-3 = 9.801 ; Mw.Ed = 210x933.4e4x17.14e-9x222.00 = 7.46 kN.m
   Additional Local Torsion 9.801/83.57 + 7.457/40.255 = 0.303 ; Combined Local Capacity 0.112 + 0.303 = 0.415 OK
   k = 0.663 x 0.883 x 1.775 = 1.039 ; 0.95x9.801/83.572 + 1.039x7.457/40.255 = 0.304 ; Combined Torsion buckling 0.589 + 0.304 = 0.892 OK
Torsion Shear @ 0.000: tau_tw = 80.77 x 9.9 x 34.02e-6 = 27.20 ; Smod = sqrt(1 - 27.20/(1.25x158.8)) = 0.929 ; 109.759/(763.881x0.929) = 0.155 OK
Deflection 5.56 OK ; Torq in Case 2 @ 2.85 m: theta_max = 42.14e-3 rad = 2.415 deg <= 2.00 deg Warning
Unity bar: Shear 0.144 | Local 0.112 | UMyz 0.589 | 6.61 0.559 | 6.62 0.589 | Torsion 0.892 | Deflection 1.207 | Max 0.892
```
### MasterSeries printout, End Warping Fixed ("Includes Design for Torsion with Span Warping, End Warping Fixed")
```
LTB UNCHANGED: Mcr 386.228 (kw stays 1.0 although the ends are warping-fixed) ; Mb.Rd 286.562 ; UM.y 0.589
Torsion Bending @ 2.538: Mzt.Ed = 168.7 x 20.0e-3 = 3.375 ; Mw.Ed = 210x933.4e4x8.984e-9x222.00 = 3.91 kN.m
   Additional Local Torsion 3.375/83.57 + 3.909/40.255 = 0.138 ; Combined Local Capacity 0.112 + 0.138 = 0.250 OK
   k = 0.681 x 0.96 x 1.776 = 1.16 ; 0.95x3.375/83.572 + 1.16x3.909/40.255 = 0.151 ; Combined Torsion buckling 0.589 + 0.151 = 0.740 OK
Torsion Shear @ 0.000: tau_tw = 80.77 x 9.9 x 0.0 = 0.00 (theta' = 0 at a warping-fixed end) ; Smod 1 ; 0.144 OK
Torq in Case 2 @ 2.85 m: theta_max = 14.15e-3 rad = 0.811 deg <= 2.00 deg OK
Unity bar: ... | Torsion 0.740 | Deflection 0.405 | Max 0.740
```
### beam-v03
```
ends free (P385 closed form): T_max 4.26 ; a 1858.6 ; phi_ULS 3.469 deg (MS 58.12e-3 rad = 3.330 deg at 2.308 m) ; phi_SLS 2.409 deg (MS 2.415) ; Mw 7.74 (MS 7.46) ; Mz 10.13 (MS 9.80) ; tau_t 27.22 (MS 27.20) ; V/V_pl,T 0.156 (MS 0.155)
   cross-section 0.408 (MS 0.415) ; kw 0.665 (MS 0.663) ; kzw 0.882 (MS 0.883) ; LTB+torsion 0.890 std / 0.897 eigen (MS 0.892)
ends warping-restrained (S.ends warp = true both ends -> warping-torsion FE): phi_ULS 1.166 deg (MS 20.0e-3 rad = 1.146 deg) ; phi_SLS 0.809 deg (MS 0.811) ; Mw 9.02 at the fixed ends (MS prints 3.91 at 2.538 m) ; Mz 3.41 (MS 3.375) ; tau_t 9.05 at the governing station (MS 0.00 at the ends) ; cross-section 0.247 (MS 0.250)
   kw 0.681 (MS 0.681) ; kzw 0.960 (MS 0.96) ; LTB+torsion: standard route 0.739 (MS 0.740 - identical) ; eigen route Mcr 669.5 (warping-fixed ends, kw = 0.5 effect) -> Mb.Rd 372.0, LTB 0.454, LTB+torsion 0.587
```
Agreement: every torsion quantity within 4 % in both warping conditions; the Annex A totals agree to 3 decimal places in the fixed case (0.739 vs 0.740). Difference of philosophy: MasterSeries leaves Mcr at the fork-end value when the ends are warping-fixed (kw = 1, conservative); beam-v03's eigen route credits the end warping restraint (Mcr +70 %).

## UB-C1  CANTILEVER 457x191 UB 82, 3.0 m, node 1 fully fixed (`UT Rs 1 1 1 1 1 1`), node 2 free; G 10 + Q 8 kN/m UDL + Q 30 kN at the tip

### MasterSeries, brief left at the default "Non-Cantilever"
```
Caution: - Member set as 'Non-Cantilever'. Bending moment and deflection exhibit cantilever characteristics. Consider setting the member as a Cantilever type using the drop list in the Axial+Moment tab.
Forces LC1: Shear 124.76 / 0 ; M -254.64 at the root ; "Maximum deflection 1.05 mm @ 1.212" (the in-span deflection relative to the chord between the nodes - the 5.9 mm tip deflection is not reported)
Local (254.638/503.608)^2 = 0.256 ; C1 = fn(M1, M2) = -254.5, 0.0 -> 1.750 "Not Loaded" (the linear end-moment table, psi = 0) ; CmLT = Cmy = Max(0.6 + 0.4 psi, 0.4) = 0.6
LTB: Le = 1.0 L = 3 m ; Mcr = Fn(1.750, 3.000, 1874, 69.21, 0.9201, 210000) = 1880.942 ; lambda_LT 0.517 ; chi 0.934 ; chi_mod = Fn(0.934, 0.517, 0.756, 0.897) = 1.000 ; Mb.Rd = Mc.y.Rd = 503.608 ; UM.y = 0.506 ; Table B.1 (not susceptible): kyy 0.600 kzz 1.000 kyz 0.600 kzy 0.360 ; 6.61 0.303 ; 6.62 0.182
Deflection: In-span 1.05 <= 3000/360 OK
```
### MasterSeries, Cantilever = "Cantilever - Warping Free"
```
C1 = fn(M, Zg, kwt) = 0.0, 0.0, 0.620 "Cantilever end warping free" -> 2.029  Ncci-sn006 ; CmLT = Cmy = 0.6 ; Cmz 1
LTB: Le = 1.0 L = 3 m ; Mcr = Fn(2.029, 3.000, 1874, 69.21, 0.9201, 210000) = 996.304 ; lambda_LT 0.711 ; chi_LT = Fn(0.711, 0.766, 0.750, 0.400) = 0.819 Curve c ; chi_LT.mod = Fn(0.819, 0.711, 0.702, 0.853) = 0.960 (kc = 1/sqrt(2.029), f = 0.853) ; Mb.Rd = 0.960 x 1831 x 275 = 483.302 ; UM.y = 254.638/483.302 = 0.527
kyy 0.600 (Cmy 0.6) ; kzz 1.000 ; kyz 0.600 ; kzy 1.000 (Table B.2) ; 6.61 0.316 ; 6.62 0.527 ; Deflection: Cantilever delta 5.92 <= 3000/360 = 8.33 OK (L/360 is applied to the cantilever tip)
Unity bar: Local 0.256 | UMyz 0.527 | 6.61 0.316 | 6.62 0.527 | Deflection 0.710 | Max 0.527
```
### MasterSeries, Cantilever = "Cantilever - Warping Fixed"
```
C1 = fn(M, Zg, kwt) = 0.0, 0.0, 0.620 "Cantilever end warping fixed" -> 4.665 ; Mcr 2291.238 ; lambda_LT 0.469 ; chi 0.961 ; chi_mod = Fn(0.961, 0.469, 0.463, 0.790) = 1.000 ; Mb.Rd = 503.608 ; UM.y 0.506 ; Table B.1 k-factors ; 6.61 0.303 ; 6.62 0.182
```
### beam-v03 (endPreset 'cantilever'; the preset restrains warping at the root, warp:false frees it)
```
V 124.76 ; M -254.64 ; tip deflection 5.909 mm, limit L/180 = 16.7 -> 0.355 (MS uses L/360 -> 0.710)
root warping FREE:  SN006a "uniform load + tip point load, interaction Eq (7)": kwt 0.6195 ; Mcr0 491.31 ; Cq 2.892, CF 1.605 -> C 2.0291 (MS 2.029) ; Mcr 996.93 (MS 996.304) ; lambda 0.710 ; chi 0.819 (MS 0.819) ; f = 1 (no Table 6.6 kc for a cantilever) -> Mb.Rd 412.31 ; util 0.618 (MS 0.527 with f = 0.853)
                    eigen: Mcr 1017.8 ; chi 0.824 ; Mb.Rd 414.57 ; util 0.614
root warping FIXED: C 4.6661 (MS 4.665) ; Mcr 2292.5 (MS 2291.238) ; lambda 0.469 ; chi 0.962 ; Mb.Rd 483.94 ; util 0.526 (MS 0.506, chi_mod = 1.0 with f = 0.790) ; eigen Mcr 2342.2 -> 485.36
```
Agreement: the SN006a cantilever route is implemented identically (C and Mcr to 4 significant figures in both warping conditions). The two design differences are deliberate: MasterSeries applies the cl 6.3.2.3 f-factor with kc = 1/sqrt(C1) to the cantilever (Mb.Rd +17 % here), beam-v03 keeps f = 1; MasterSeries checks the cantilever tip against L/360, beam-v03 against L/180. Left at its default "Non-Cantilever" brief, MasterSeries designs the cantilever as a beam segment with C1 = 1.75 and reports a 1.05 mm chord deflection - the caution line is the only warning.

## PFC46-C1  CANTILEVER 300x100x46 PFC, 2.5 m, root fixed, G 5 + Q 4 kN/m UDL + Q 10 kN at the tip, no eccentricity (brief set to Cantilever - Warping Free, then Warping Fixed: SAME printout)

### MasterSeries
```
Forces LC1: Shear 48.38 ; M -79.23 at the root ; Cantilever delta 5.68 @ tip ; Class 1 ; fy 265 ; Vy/Vpl 0.109 ; Local (79.228/169.865)^1 = 0.466
C1 = fn(M1, M2, Mo, psi, mu) = -79.2, 0.0, 10.4, 0.000, -0.132 -> 2.135 "Uniform"     <- the BEAM-segment C1 table, not the SN006 cantilever route (which only appears for I sections); identical for "Warping Free" and "Warping Fixed"
CmLT = Max(0.2 + 0.8 as, 0.4): Mh -79.18, Ms -29.18, psi 0, as 0.369 -> 0.495 ; Cmy 0.495 ; Cmz 1
LTB: Le = 1.0 L = 2.5 m ; Mcr = Fn(2.135, 2.500, 568.0, 36.8, 0.08130, 210000) = 697.488 ; lambda_LT 0.493 ; chi 0.921 Curve d ; chi_mod = Fn(0.921, 0.493, 0.684, 0.872) = 1.000 ; Mb.Rd = Mc.y.Rd = 169.865 ; UM.y 0.466
Table B.1 (not susceptible): kyy = Cmy{1+0.6 lambda_y UN.y} = 0.495 ; kzz 1.000 ; kyz = kzz = 1.000 ; kzy = 0.8 kyy = 0.396 ; 6.61 0.231 ; 6.62 0.185 ; Deflection 5.68 <= 2500/360 = 6.94 OK
Unity bar: Local 0.466 | UMyz 0.466 | 6.61 0.231 | 6.62 0.185 | Deflection 0.818 | Max 0.466
```
### beam-v03
```
V 48.382 ; M -79.227 ; tip deflection 5.682 (limit L/180 -> 0.409) ; Class 1 ; M/Mc 0.466
standard route: REFUSED for the channel cantilever ("the SN003a form and the P385/P362 channel kappa chain assume fork ends") - the kappa chain value printed for information gives Mb.Rd 113.1 (util 0.700)
eigen, root warping FREE:  Mcr 459.1 ; lambda 0.608 ; chi 0.829 (curve d, f = 1) ; Mb.Rd 140.9 ; util 0.562
eigen, root warping FIXED: Mcr 776.9 ; lambda 0.468 ; chi 0.943 ; Mb.Rd 160.1 ; util 0.495
eigen, root warping free + loads at e = +40 mm: LTB unchanged 0.562 ; twist 5.9 deg ; P385 cross-section 0.218 ; Annex A 0.562 ; V/V_pl,T 0.123
```
Finding (the owner's original point): for a channel cantilever MasterSeries applies the beam C1 table (C1 = 2.135 from the root/tip moments) with the doubly-symmetric Mcr formula and a full-span Le, and it does so regardless of the warping setting - Mcr 697 kN.m against 459 (warping-free FE) or 777 (warping-fixed FE). With the chi_LT plateau the unconservatism on Mb.Rd is +20 % (169.9 vs 140.9) for the warping-free root. The SN006a cantilever coefficients are only invoked for I sections in MasterSeries; beam-v03 refuses the closed form for a channel cantilever and relies on the eigensolver.
