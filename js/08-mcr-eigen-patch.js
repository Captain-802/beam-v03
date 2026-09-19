/* =====================================================================
   mcr-eigen-patch.js
   Replaces the C1-lookup / SN003a / SN006a / PFC-kappa LTB machinery in
   BEAM DESIGN CODE with a direct finite-element eigenvalue solution for
   the elastic critical moment.

   HOW TO APPLY
   ------------
   Paste this entire file inside the app's existing <script> block,
   immediately BEFORE the final `wire(); ... recompute();` lines.
   It reassigns two function bindings and injects one UI panel. Nothing
   else in the file is touched, so the encoding of the existing source is
   preserved.

   Mcr METHOD SWITCH  (S.mcrMethod: 'eigen' | 'standard')
   ---------------------------------------------------------
   The original closed-form function checksEC3UnrestrainedSCI() from
   js/checks/eurocode-checks.js is captured BEFORE the reassignment as
   window.checksEC3UnrestrainedStandard and the patched function delegates
   to it when S.mcrMethod === 'standard'. That is the STANDARD method:
   C1 from the NCCI SN003a tables / SCI end-moment curve / Serna quarter-point
   expression, the SN003a closed-form Mcr with C2*zg where published, SN006a
   for cantilevers and the P385/P362 channel kappa chain - as MasterSeries-
   type software does. The eigen method (default) remains the FE eigenvalue
   solution for the actual moment diagram, load heights, restraints and hinges.
   Both methods expose ltb.McrStandard (closed form for the same segment) and
   ltb.McrEigen (null in standard mode: the eigensolver is not run) so the
   report can print "Mcr eigen / Mcr standard". The helpers below are
   therefore the standard-method implementation and must STAY ALIVE:

       C1_END_MOMENT, SN006 / sn006C, sernaC1, c1FromPsi, computeC1, mcrEC3
                            (js/01-computation-engine.js)
       sn003aC1, c1Inputs, c1Segment, mcrClosedForm, mcrSN006aFor,
       mcrStandardFor, cmTableB3, annexB2, checksEC3UnrestrainedSCI
                            (js/checks/eurocode-checks.js)

   WHAT CHANGES IN THE NUMBERS (eigen method vs the standard method)
   -----------------------------------------------------------------
   * C1 is no longer an input. Mcr comes out of the eigenproblem directly
     and lamLT = sqrt(Wy*fy/Mcr).
   * The old `computeC1`/`sn003aC1` returned C1 = 1.0 for every combined
     end-moment + transverse-load case. The true value is 1.13 to 2.75.
     Expect Mb,Rd to RISE on those beams. This is a correction, not a
     relaxation, but re-run your worked examples before trusting it.
   * The simplified route (P362 Expn 6.55) is gone. It was the design
     basis; the Mcr route was only used to rescue it.
   * Load height enters through zg on every load, for every moment
     diagram - not just the two shapes SN003a tabulates C2 for.
   * The destabilising x1.2 switch no longer affects EC3 LTB (zg does).
     LE-factor no longer affects EC3 LTB (restraint positions do).
     Both still drive the strut check.
   * PFC: lamLT now comes from Mcr, not (L/iz)/kappa. See NOTE ON CHANNELS.
   * Cantilevers: no SN006a table-range blocking (kwt <= 1, -2 <= eta <= 3).

   SIGN CONVENTIONS (must hold, and are asserted at load time)
   -----------------------------------------------------------
     x  along the span, 0..L        [mm]
     z  vertical, POSITIVE UPWARD, from the shear centre
     M  sagging POSITIVE            [N.mm]
     q,P transverse loads POSITIVE DOWNWARD
     zg is read directly from the UI as height above the shear centre;
     POSITIVE when the load acts ABOVE the shear centre
     zj > 0 when the compression flange is the larger flange

   Note the app's own comboLoads() returns downward loads as NEGATIVE.
   This patch reads S.loads directly and re-signs them; it does not use
   comboLoads(). assertSaggingPositive() below verifies the BMD sign at
   load time and throws loudly if a future edit flips it.

   NOTE ON CHANNELS
   ----------------
   A PFC bent about its major axis is symmetric about that axis: the
   mirror across mid-height maps top flange onto bottom flange. Hence
   zj = 0 and the shear centre lies on the horizontal centroidal axis.
   Its offset e0 is HORIZONTAL, and an eccentric load applies a PRIMARY
   TORQUE - a separate action, not a buckling term. It must not be folded
   into zg. So: eigen Mcr with zj = 0 and Iw about the shear centre, then
   the EN 1993-6 Annex A interaction (already in this app) combines it
   with the P385 torsion. If a channel carries eccentric load and the
   Annex A check cannot run, PASS is blocked.
   ===================================================================== */
(function () {
  'use strict';

  var PI = Math.PI, G_STEEL = 81000;   // N/mm2, per SN003a / P385 (NOT E/2.6)
  // Tool thresholds, not code requirements. Near lamLT ~ 1, chi_LT varies
  // roughly with sqrt(Mcr), so d(MbRd)/MbRd is about 0.5*d(Mcr)/Mcr.
  var MESH_WARN = 0.001;   // 0.1% - mention it
  var MESH_BLOCK = 0.005;  // 0.5% - refuse to certify

  /* ================================================================
     PART 1 - LTB eigenvalue engine
     Verified against: uniform moment (exact), Iw=0 (exact),
     Kitipornchai & Trahair monosymmetric closed form (exact),
     zg reversal identity (exact), midspan restraint -> L/2 problem,
     Timoshenko cantilever constants 4.013 / 12.85.
     ================================================================ */

  function zeros(n, m) { var A = [], i; for (i = 0; i < n; i++) A.push(new Float64Array(m === undefined ? n : m)); return A; }
  function transpose(A) { var n = A.length, m = A[0].length, B = zeros(m, n), i, j; for (i = 0; i < n; i++) for (j = 0; j < m; j++) B[j][i] = A[i][j]; return B; }
  function nrm2(x) { var s = 0, i; for (i = 0; i < x.length; i++) s += x[i] * x[i]; return Math.sqrt(s); }
  function matvec(A, x, out) { var n = A.length, i, j, s, Ai; for (i = 0; i < n; i++) { s = 0; Ai = A[i]; for (j = 0; j < n; j++) s += Ai[j] * x[j]; out[i] = s; } return out; }
  function seedVec(n, s) { var x = new Float64Array(n), i; for (i = 0; i < n; i++) x[i] = Math.sin(1.7 * (i + 1) + s) + 0.31 * Math.cos(0.37 * (i + 1) + s); var d = nrm2(x); for (i = 0; i < n; i++) x[i] /= d; return x; }

  var GP = [[0.033765242898424, 0.085662246189585], [0.169395306766868, 0.180380786524069],
            [0.380690406958402, 0.233956967286346], [0.619309593041598, 0.233956967286346],
            [0.830604693233132, 0.180380786524069], [0.966234757101576, 0.085662246189585]];

  function shape(xi, Le) {
    var x2 = xi * xi, x3 = x2 * xi;
    return {
      N:   [1 - 3 * x2 + 2 * x3, Le * (xi - 2 * x2 + x3), 3 * x2 - 2 * x3, Le * (-x2 + x3)],
      Np:  [(-6 * xi + 6 * x2) / Le, 1 - 4 * xi + 3 * x2, (6 * xi - 6 * x2) / Le, -2 * xi + 3 * x2],
      Npp: [(-6 + 12 * xi) / (Le * Le), (-4 + 6 * xi) / Le, (6 - 12 * xi) / (Le * Le), (-2 + 6 * xi) / Le]
    };
  }
  function kBend(EI, Le) {
    var c = EI / (Le * Le * Le), L = Le, L2 = Le * Le;
    return [[12 * c, 6 * L * c, -12 * c, 6 * L * c], [6 * L * c, 4 * L2 * c, -6 * L * c, 2 * L2 * c],
            [-12 * c, -6 * L * c, 12 * c, -6 * L * c], [6 * L * c, 2 * L2 * c, -6 * L * c, 4 * L2 * c]];
  }
  function kTors(GJ, Le) {
    var c = GJ / (30 * Le), L = Le, L2 = Le * Le;
    return [[36 * c, 3 * L * c, -36 * c, 3 * L * c], [3 * L * c, 4 * L2 * c, -3 * L * c, -L2 * c],
            [-36 * c, -3 * L * c, 36 * c, -3 * L * c], [3 * L * c, -L2 * c, -3 * L * c, 4 * L2 * c]];
  }
  function cholesky(A) {
    var n = A.length, L = zeros(n), i, j, k, s;
    for (i = 0; i < n; i++) for (j = 0; j <= i; j++) {
      s = A[i][j]; for (k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      if (i === j) { if (s <= 1e-300) return null; L[i][i] = Math.sqrt(s); } else L[i][j] = s / L[j][j];
    }
    return L;
  }
  function solveLower(L, B) {
    var n = L.length, m = B[0].length, X = zeros(n, m), i, j, c, s;
    for (c = 0; c < m; c++) for (i = 0; i < n; i++) {
      s = B[i][c]; for (j = 0; j < i; j++) s -= L[i][j] * X[j][c]; X[i][c] = s / L[i][i];
    }
    return X;
  }
  function solveUpperT(L, b) {
    var n = L.length, x = new Float64Array(n), i, j, s;
    for (i = n - 1; i >= 0; i--) { s = b[i]; for (j = i + 1; j < n; j++) s -= L[j][i] * x[j]; x[i] = s / L[i][i]; }
    return x;
  }

  /* Spectral radius via power iteration on A^2.
     Necessary because when zg = zj = 0 the elastic matrix has no v-phi
     coupling, Cholesky preserves the (v,phi) block split, Kg is purely
     off-diagonal, and A = [[0,C],[C^T,0]] has an exactly symmetric +-mu
     spectrum on which plain power iteration silently returns a wrong,
     "converged" Rayleigh quotient. Squaring makes the dominant eigenvalue
     simple; shifting afterwards keeps it that way. */
  function spectralRadius(A) {
    var n = A.length, x = seedVec(n, 0.3), v = new Float64Array(n), w = new Float64Array(n);
    var r2 = 0, r2o = NaN, i, it, nw;
    for (it = 0; it < 5000; it++) {
      matvec(A, x, v);
      r2 = 0; for (i = 0; i < n; i++) r2 += v[i] * v[i];
      matvec(A, v, w); nw = nrm2(w);
      if (nw < 1e-300 || r2 < 1e-300) return Math.sqrt(Math.max(r2, 0));
      for (i = 0; i < n; i++) x[i] = w[i] / nw;
      if (it > 3 && Math.abs(r2 - r2o) <= 1e-15 * r2) break;
      r2o = r2;
    }
    return Math.sqrt(r2);
  }
  function dominantShifted(A, shift, seed) {
    var n = A.length, x = seedVec(n, seed), y = new Float64Array(n), Ax = new Float64Array(n);
    var mu = 0, muOld = NaN, i, it, ny, conv = false;
    for (it = 0; it < 20000; it++) {
      matvec(A, x, Ax);
      for (i = 0; i < n; i++) y[i] = Ax[i] - shift * x[i];
      ny = nrm2(y); if (ny < 1e-300) { mu = shift; conv = true; break; }
      for (i = 0; i < n; i++) x[i] = y[i] / ny;
      matvec(A, x, Ax);
      mu = 0; for (i = 0; i < n; i++) mu += x[i] * Ax[i];
      if (it > 3 && Math.abs(mu - muOld) <= 1e-14) { conv = true; break; }
      muOld = mu;
    }
    return { mu: mu, vec: x, converged: conv };
  }

  function meshNodes(L, forced, nElem) {
    var pts = [0, L], i, j;
    forced.forEach(function (x) { if (x > 1e-9 && x < L - 1e-9) pts.push(x); });
    pts.sort(function (a, b) { return a - b; });
    var uniq = [pts[0]];
    for (i = 1; i < pts.length; i++) if (pts[i] - uniq[uniq.length - 1] > 1e-6) uniq.push(pts[i]);
    var nodes = [uniq[0]];
    for (i = 0; i < uniq.length - 1; i++) {
      var a = uniq[i], b = uniq[i + 1], k = Math.max(1, Math.round(nElem * (b - a) / L));
      for (j = 1; j <= k; j++) nodes.push(a + (b - a) * j / k);
    }
    return nodes;
  }
  function nearestNode(nodes, x) {
    var bi = 0, bd = Infinity, i;
    for (i = 0; i < nodes.length; i++) { var d = Math.abs(nodes[i] - x); if (d < bd) { bd = d; bi = i; } }
    return bi;
  }

  function mcrOnce(p) {
    var E = p.E, G = p.G === undefined ? G_STEEL : p.G;
    var Iz = p.Iz, It = p.It, Iw = p.Iw || 0, L = p.L, zj = p.zj || 0;
    var nElem = p.nElem || 32, dl = p.distLoads || [], pl = p.pointLoads || [], rst = p.restraints || [];
    var M = p.moment, i, j, k;

    var forced = [];
    rst.forEach(function (r) { forced.push(r.x); });
    pl.forEach(function (q) { forced.push(q.x); });
    dl.forEach(function (q) { forced.push(q.x1); forced.push(q.x2); });
    var nodes = meshNodes(L, forced, nElem), nn = nodes.length, nd = 4 * nn;

    function qzg(x) {
      var s = 0, d, w;
      for (var t = 0; t < dl.length; t++) {
        d = dl[t];
        if (x < d.x1 - 1e-9 || x > d.x2 + 1e-9) continue;
        w = (d.x2 - d.x1 < 1e-9) ? d.w1 : d.w1 + (d.w2 - d.w1) * (x - d.x1) / (d.x2 - d.x1);
        s += w * (d.zg || 0);
      }
      return s;
    }

    var Ke = zeros(nd), Kg = zeros(nd), vL = [0, 1, 4, 5], pLoc = [2, 3, 6, 7];
    for (var e = 0; e < nn - 1; e++) {
      var x0 = nodes[e], Le = nodes[e + 1] - x0;
      var Kb = kBend(E * Iz, Le), Kw = kBend(E * Iw, Le), Kt = kTors(G * It, Le);
      var g = []; for (i = 0; i < 8; i++) g.push(4 * e + i);
      for (i = 0; i < 4; i++) for (j = 0; j < 4; j++) {
        Ke[g[vL[i]]][g[vL[j]]] += Kb[i][j];
        Ke[g[pLoc[i]]][g[pLoc[j]]] += Kw[i][j] + Kt[i][j];
      }
      var cpl = zeros(4, 4), gpp = zeros(4, 4);
      for (k = 0; k < GP.length; k++) {
        var xi = GP[k][0], wt = GP[k][1] * Le, x = x0 + xi * Le;
        var S2 = shape(xi, Le), Mx = M(x), qz = qzg(x);
        for (i = 0; i < 4; i++) for (j = 0; j < 4; j++) {
          cpl[i][j] += Mx * S2.Npp[i] * S2.N[j] * wt;                       // INT M v'' phi
          gpp[i][j] += (2 * zj * Mx * S2.Np[i] * S2.Np[j]                   // Wagner
                        - qz * S2.N[i] * S2.N[j]) * wt;                     // load height
        }
      }
      for (i = 0; i < 4; i++) for (j = 0; j < 4; j++) {
        Kg[g[vL[i]]][g[pLoc[j]]] += cpl[i][j];
        Kg[g[pLoc[j]]][g[vL[i]]] += cpl[i][j];
        Kg[g[pLoc[i]]][g[pLoc[j]]] += gpp[i][j];
      }
    }
    pl.forEach(function (q) {
      var ni = nearestNode(nodes, q.x);
      Kg[4 * ni + 2][4 * ni + 2] += -q.P * (q.zg || 0);
    });

    var fixed = {};
    rst.forEach(function (r) {
      var ni = nearestNode(nodes, r.x);
      if (r.v === undefined ? true : !!r.v) fixed[4 * ni + 0] = 1;
      if (r.vp) fixed[4 * ni + 1] = 1;
      if (r.phi === undefined ? true : !!r.phi) fixed[4 * ni + 2] = 1;
      if (r.phip) fixed[4 * ni + 3] = 1;
    });
    var free = []; for (var d2 = 0; d2 < nd; d2++) if (!fixed[d2]) free.push(d2);
    var nf = free.length;
    if (nf < 2) throw new Error('LTB model has fewer than 2 free degrees of freedom.');

    var Kef = zeros(nf), Kgf = zeros(nf);
    for (i = 0; i < nf; i++) for (j = 0; j < nf; j++) { Kef[i][j] = Ke[free[i]][free[j]]; Kgf[i][j] = Kg[free[i]][free[j]]; }

    var Lc = cholesky(Kef);
    if (!Lc) throw new Error('LTB elastic stiffness is singular: the member is laterally under-restrained. ' +
      'Provide at least two points of lateral restraint, or lateral-bending restraint at a built-in support.');

    var X = solveLower(Lc, Kgf), Y = solveLower(Lc, transpose(X)), A = transpose(Y);
    for (i = 0; i < nf; i++) for (j = i + 1; j < nf; j++) { var m = 0.5 * (A[i][j] + A[j][i]); A[i][j] = m; A[j][i] = m; }

    var rho = spectralRadius(A);
    if (!(rho > 0)) throw new Error('LTB geometric stiffness is null: the moment diagram is identically zero.');
    var As = zeros(nf);
    for (i = 0; i < nf; i++) for (j = 0; j < nf; j++) As[i][j] = A[i][j] / rho;
    var sig = 1 + 1e-6;
    var dLo = dominantShifted(As, sig, 0.7), dHi = dominantShifted(As, -sig, 1.9);
    var muMin = dLo.mu * rho, muMax = dHi.mu * rho;

    var Mref = 0;
    for (i = 0; i <= 2000; i++) { var av = Math.abs(M(L * i / 2000)); if (av > Mref) Mref = av; }

    var eps = 1e-12 * Math.max(Math.abs(muMin), Math.abs(muMax), 1e-300);
    var lamPos = (muMin < -eps) ? -1 / muMin : Infinity;
    var lamNeg = (muMax > eps) ? -1 / muMax : -Infinity;

    var mode = null;
    if (dLo.vec) {
      var dv = solveUpperT(Lc, dLo.vec), full = new Float64Array(nd);
      for (i = 0; i < nf; i++) full[free[i]] = dv[i];
      var pk = 0; for (i = 0; i < nn; i++) pk = Math.max(pk, Math.abs(full[4 * i + 2]));
      mode = { x: nodes.slice(), phi: [], v: [] };
      for (i = 0; i < nn; i++) { mode.phi.push(pk > 0 ? full[4 * i + 2] / pk : 0); mode.v.push(full[4 * i]); }
    }
    return { Mcr: lamPos * Mref, lambda: lamPos, McrRev: Math.abs(lamNeg) * Mref, lambdaRev: lamNeg,
             Mref: Mref, nElem: nn - 1, converged: dLo.converged && dHi.converged, mode: mode };
  }

  /* Richardson extrapolation on the O(h^4) eigenvalue error of cubic Hermite. */
  function mcrEigen(p) {
    if (!p.refine) return mcrOnce(p);
    var n0 = p.nElem || 32;
    var co = mcrOnce(Object.assign({}, p, { nElem: n0, refine: false }));
    var fi = mcrOnce(Object.assign({}, p, { nElem: 2 * n0, refine: false }));
    function rich(a, b) { return (isFinite(a) && isFinite(b)) ? (16 * b - a) / 15 : b; }
    fi.lambda = rich(co.lambda, fi.lambda); fi.Mcr = fi.lambda * fi.Mref;
    fi.lambdaRev = rich(co.lambdaRev, fi.lambdaRev); fi.McrRev = Math.abs(fi.lambdaRev) * fi.Mref;
    fi.meshError = Math.abs(fi.Mcr - co.lambda * co.Mref) / Math.max(Math.abs(fi.Mcr), 1e-9);
    fi.converged = co.converged && fi.converged;
    fi.refined = true;
    return fi;
  }

  function momentFromSamples(xs, Ms) {
    return function (x) {
      var n = xs.length;
      if (x <= xs[0]) return Ms[0];
      if (x >= xs[n - 1]) return Ms[n - 1];
      var lo = 0, hi = n - 1;
      while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (xs[mid] <= x) lo = mid; else hi = mid; }
      var t = (x - xs[lo]) / (xs[hi] - xs[lo]);
      return Ms[lo] + (Ms[hi] - Ms[lo]) * t;
    };
  }

  /* ================================================================
     PART 2 - sign-convention assertion
     Runs once at load. If a future edit flips comboLoads() or sfdBmd(),
     this fails loudly instead of quietly inverting the zg term (which
     would make top-flange loading look STABILISING).
     ================================================================ */
  function assertSaggingPositive() {
    var L = 6000, EI = 210000 * 3.71e8;
    var sup = [{ pos: 0, type: 'pinned' }, { pos: L, type: 'pinned' }];
    var loads = [{ type: 'udl', x1: 0, x2: L, w1: -10, w2: -10 }];  // downward, app's sign
    var r = solveBeam(L, EI, sup, loads);
    var fb = sfdBmd(L, sup, loads, r.reactions);
    var Mmid = interpAt(fb.xs, fb.M, L / 2);
    if (!(Mmid > 0)) throw new Error(
      'mcr-eigen-patch: BMD sign convention check FAILED. A simply supported beam under downward ' +
      'UDL returned M(L/2) = ' + Mmid + ', expected sagging POSITIVE. The zg load-height term would ' +
      'be inverted. Fix the convention before using this patch.');
    return true;
  }

  /* ================================================================
     PART 3 - build the eigen model from the app's state
     ================================================================ */

  /* Section properties, mm units. Prefers the P385 / Blue Book values
     (tp.IT, tp.Iw) which are taken about the SHEAR CENTRE for channels. */
  function secProps(sec) {
    var tp = sec.tp || {};
    return {
      Iz: sec.Iy * 1e4,                                        // minor-axis I, mm4
      It: ((tp.IT != null ? tp.IT : sec.J) || 0) * 1e4,        // St Venant, mm4
      Iw: ((tp.Iw != null ? tp.Iw : sec.Iw) || 0) * 1e12,      // warping, mm6 (about shear centre)
      hs: sec.D - sec.tf                                       // flange centroid separation
    };
  }

  /* zj: zero for every section in this app's library.
     - I/H (UB, UC): doubly symmetric.
     - PFC: symmetric about the MAJOR axis (top flange maps onto bottom).
     - SHS/RHS: doubly symmetric.
     Non-zero zj belongs to unequal-flange plated I-sections and tees.
     S.zj is exposed so a future plated-section path can supply it. */
  function zjFor(sec) { return (S.zj != null && isFinite(S.zj)) ? +S.zj : 0; }

  function ltbRestraintsFor(a) {
    var out = [], warpRoot = (S.rootWarp === 'restrained') ? 1 : 0;
    var fixLat = (S.fixedLateral === false) ? 0 : 1;
    /* Every support is a fork (v = phi = 0). Per-support checkboxes can ADD
       lateral-bending (vp) and warping (phip) fixity - the SCI Mcr tool's
       dU = F / dtheta = F - without changing the vertical model. For fixed
       supports these OR with the global fixedLateral / rootWarp settings. */
    S.supports.forEach(function (s) {
      var x = (+s.pos) * 1000;
      if (s.type === 'fixed') out.push({ x: x, v: 1, vp: (fixLat || s.vp) ? 1 : 0, phi: 1, phip: (warpRoot || s.phip) ? 1 : 0 });
      else out.push({ x: x, v: 1, phi: 1, vp: s.vp ? 1 : 0, phip: s.phip ? 1 : 0 });
    });
    (S.ltbRestraints || []).forEach(function (r) {
      out.push({ x: (+r.pos) * 1000, v: r.v !== false, vp: !!r.vp, phi: r.phi !== false, phip: !!r.phip });
    });
    return out;
  }

  /* Transverse loads of ONE ULS combination, re-signed DOWNWARD
     POSITIVE, each carrying the load-height zg. Moment loads contribute to
     M(x) but have no load-height term, so they are excluded here.
     This deliberately does NOT call comboLoads(), whose sign is inverted. */
  function unitLoadsFor(a, combo) {
    var fac = combo.factors;
    var dl = [], pl = [];
    /* comboLoadPieces() (04-checks.js) applies a pattern combination's mask
       and splits distributed Q loads at the span boundaries, so the eigen
       model of a pattern combination carries exactly that pattern's loads. */
    comboLoadPieces(combo).forEach(function (p) {
      if (p.type === 'moment') return;
      var f = p.factor;
      if (!f) return;
      var zg = typeof loadZgValue === 'function' ? loadZgValue(p.ld) : (+S.za || 0);
      if (p.type === 'point') pl.push({ x: p.pos, P: p.P * f * 1000, zg: zg });
      else dl.push({ x1: p.x1, x2: p.x2, w1: p.w1 * f, w2: p.w2 * f, zg: zg });
    });
    var gF = fac.G != null ? fac.G : 0;
    var sw = selfWeightValue(a.sec);
    if (gF !== 0 && sw > 0) dl.push({ x1: 0, x2: a.L, w1: sw * gF, w2: sw * gF, zg: 0 }); // self-weight acts at the centroid
    return { distLoads: dl, pointLoads: pl };
  }

  /* Full LTB solve for ONE ULS combination (res = {combo, fb}). Returns Mcr,
     plus a GENERALISED C1 defined as
        C1 = Mcr(actual diagram, zg=0, zj=0) / Mcr(uniform moment, same restraints)
     which reduces to the textbook C1 on a fork-fork span and remains
     meaningful for multi-span and intermediately restrained members,
     where no tabulated C1 exists. Used only for kc (NA 2.18).
     `shared` caches the combo-independent uniform-moment reference solve so a
     multi-combination run does not repeat it. */
  function solveLTB(a, sec, res, shared) {
    var sp = secProps(sec), zj = zjFor(sec), ul = unitLoadsFor(a, res.combo);
    var gfb = res.fb;
    var base = { E: a.E, G: G_STEEL, Iz: sp.Iz, It: sp.It, Iw: sp.Iw, L: a.L,
                 restraints: ltbRestraintsFor(a), nElem: 32, refine: true };

    var actual = mcrEigen(Object.assign({}, base, {
      moment: momentFromSamples(gfb.xs, gfb.M), zj: zj,
      distLoads: ul.distLoads, pointLoads: ul.pointLoads
    }));

    var shapeOnly = mcrEigen(Object.assign({}, base, {
      moment: momentFromSamples(gfb.xs, gfb.M), zj: 0,
      distLoads: ul.distLoads.map(function (d) { return Object.assign({}, d, { zg: 0 }); }),
      pointLoads: ul.pointLoads.map(function (q) { return Object.assign({}, q, { zg: 0 }); })
    }));

    var uniform = (shared && shared.uniform) ||
      mcrEigen(Object.assign({}, base, { moment: function () { return 1e6; }, zj: 0 }));
    if (shared) shared.uniform = uniform;

    var C1 = uniform.Mcr > 0 ? shapeOnly.Mcr / uniform.Mcr : 1;
    var zgVals = ul.distLoads.map(function(d){ return d.zg || 0; }).concat(ul.pointLoads.map(function(q){ return q.zg || 0; }));
    var zgRep = 0;
    zgVals.forEach(function(z){ if(Math.abs(z)>Math.abs(zgRep)) zgRep = z; });
    var zgUnique = [];
    zgVals.forEach(function(z){
      if(!zgUnique.some(function(u){ return Math.abs(u-z)<1e-9; })) zgUnique.push(z);
    });
    return { Mcr: actual.Mcr, McrRev: actual.McrRev, mode: actual.mode,
             meshError: actual.meshError, mcrConverged: actual.converged,
             c1Converged: shapeOnly.converged && uniform.converged,
             C1: C1, McrUniform: uniform.Mcr, McrShape: shapeOnly.Mcr,
             zg: zgRep, zgValues: zgUnique, zgUniform: zgUnique.length <= 1, zj: zj, nElem: actual.nElem, sp: sp };
  }

  function ltbCurve(sec) {
    // UK NA Table NA.1 (cl 6.3.2.3): hot-finished hollow sections share the
    // I/H h/b allocation; cold-formed hollow sections use c (h/b<=2) or d;
    // channels d. ONE allocation for both Mcr methods: ltbCurveNA() in
    // js/checks/eurocode-checks.js (the standard route uses the same function).
    if (typeof ltbCurveNA === 'function') return ltbCurveNA(sec);
    if (sec.isBox && sec.boxType === 'CF') return sec.D/sec.B <= 2 ? { alphaLT: 0.49, curve: 'c' } : { alphaLT: 0.76, curve: 'd' };
    if (sec.kind === 'channel') return { alphaLT: 0.76, curve: 'd' }; // not doubly symmetric
    var hb = sec.D / sec.B;
    return hb <= 2 ? { alphaLT: 0.34, curve: 'b' } : hb <= 3.1 ? { alphaLT: 0.49, curve: 'c' } : { alphaLT: 0.76, curve: 'd' };
  }

  /* ================================================================
     PART 4 - replacement LTB check
     ================================================================ */
  /* The closed-form (standard) implementation from eurocode-checks.js is kept
     under its own name; the patched binding delegates to it on request. */
  var checksEC3UnrestrainedStandard = window.checksEC3UnrestrainedSCI;
  if (typeof checksEC3UnrestrainedStandard !== 'function')
    throw new Error('mcr-eigen-patch: checksEC3UnrestrainedSCI (the standard closed-form method) must be loaded before this patch.');
  window.checksEC3UnrestrainedStandard = checksEC3UnrestrainedStandard;
  function mcrMethod() { return (S.mcrMethod === 'standard') ? 'standard' : 'eigen'; }

  window.checksEC3UnrestrainedSCI = function (a) {
    if (mcrMethod() === 'standard') return checksEC3UnrestrainedStandard(a);
    var b = checksEC3Restrained(a);
    var sec = a.sec, fy = a.py, gM1 = 1.0, Wy = b.Wy;
    var unsupported = b.unsupported.slice();
    var isCant = (S.supports.length === 1 && S.supports[0].type === 'fixed');
    var ltb, warn = [];

    /* Closed hollow sections are no longer blanket-exempted. EN 1993-1-1
       cl 6.3.2.1(2) genuinely exempts square/circular hollow sections, but a
       slender RECTANGULAR hollow section on a long unrestrained span has a
       finite Mcr. The eigen solver handles the closed section directly
       (Iw ~ 0, large It): a square/stocky box returns lamLT far below 0.4 and
       LTB is "ignored" (cl 6.3.2.2(4)), reproducing the exemption exactly
       where it is genuine; a slender RHS gets a real chi_LT. */

    /* LTB is checked for EVERY enabled ULS combination, not only the one with
       the largest |Mmax|: Mcr depends on the moment-diagram SHAPE, so a combo
       with a slightly smaller peak moment but a more uniform diagram (lower
       Mcr) can govern the LTB utilisation. The uniform-moment reference solve
       is combo-independent and shared. */
    var combosLTB = (a.ulsResults || []).filter(function (r) { return Math.abs(r.Mmax) > 1e-9; });
    if (!combosLTB.length) combosLTB = [a.governM];
    var shared = { uniform: null };
    var evals = [];
    try {
      combosLTB.forEach(function (res) {
        evals.push({ res: res, sol: solveLTB(a, sec, res, shared) });
      });
    } catch (err) {
      unsupported.push('Elastic critical moment: ' + err.message);
      var stdFail = null;
      try { stdFail = mcrStandardFor(a, sec); } catch (e3) { stdFail = null; }
      ltb = { eigen: true, failed: true, err: err.message, MbRd: 0, Mcr: 0, C1: 1, kc: 1,
              curve: ltbCurve(sec), ign: false, chi: 0, f: 1, chiMod: 0, lamLT: 0, warn: warn,
              mcrMethod: 'eigen', McrEigen: null, McrRatio: null,
              McrStandard: (stdFail && stdFail.Mcr != null) ? stdFail.Mcr : null,
              std: stdFail, c1in: stdFail ? stdFail.c1in : null, c1seg: stdFail ? stdFail.seg : null, c1route: stdFail ? stdFail.route : null };
      return Object.assign({}, b, { sci: false, sciU: true, mcrMethod: 'eigen', unsupported: unsupported, ltb: ltb,
        ltbUtil: 99, ltbBasis: 'Mcr could not be computed', C1: 1, c1label: 'n/a',
        LE: a.L, utils: [{ name: 'LTB', val: 99 }], gov: { name: 'LTB', val: 99 }, pass: false,
        annex: null, buck: null });
    }

    var meshErrorMax = 0, allConverged = true;
    evals.forEach(function (ev) {
      meshErrorMax = Math.max(meshErrorMax, ev.sol.meshError || 0);
      if (!ev.sol.mcrConverged) allConverged = false;
    });
    if (!allConverged) {
      unsupported.push('Elastic critical moment: the eigensolver did not reach convergence tolerance at one or both mesh levels' +
        (evals.length > 1 ? ' for at least one load combination' : '') + '. ' +
        'M<sub>cr</sub> is not reliable for design and PASS is blocked. Verify M<sub>cr</sub> independently.');
    }
    if (meshErrorMax > MESH_BLOCK) {
      unsupported.push('Elastic critical moment: mesh convergence error is ' + (meshErrorMax * 100).toFixed(2) +
        ' %, above the ' + (MESH_BLOCK * 100).toFixed(1) + ' % limit this tool will certify. PASS is blocked.');
    } else if (meshErrorMax > MESH_WARN) {
      warn.push('Mesh convergence error ' + (meshErrorMax * 100).toFixed(2) + ' % (below the blocking limit, but worth noting).');
    }

    var zgAny = evals.some(function (ev) { return Math.abs(ev.sol.zg || 0) > 1e-9; });
    if (zgAny && S.destab) warn.push('The destabilising x1.2 switch is ignored on the EC3 path: load height is carried exactly by per-load zg. Untick it to avoid confusion.');
    if (Math.abs(S.leFactor - 1) > 1e-9) warn.push('The LE factor no longer affects EC3 LTB; buckling length is set by the restraint positions. It still sets the major-axis strut length (and the minor-axis one where no intermediate lateral restraints are modelled).');

    var curve = ltbCurve(sec);

    /* kc's C1 must follow the NA 2.18 basis: the moment shape BETWEEN
       RESTRAINTS. With intermediate restraints the whole-member shape ratio
       can exceed the critical bay's own C1 (e.g. a near-uniform critical bay
       inside a varied overall diagram), which would overstate the f-factor
       benefit. So each combination's kc uses the C1 of the bay its OWN
       eigenmode localises in - isolated fork-fork, shape-only - and never a
       value more favourable than the whole-member ratio (min of the two). */
    var vPtsKc = [];
    S.supports.forEach(function (s) { vPtsKc.push(+(((+s.pos) * 1000).toFixed(3))); });
    (S.ltbRestraints || []).forEach(function (r) { if (r.v !== false) { var xr = (+r.pos) * 1000; if (isFinite(xr) && xr >= -1e-6 && xr <= a.L + 1e-6) vPtsKc.push(+xr.toFixed(3)); } });
    vPtsKc = vPtsKc.filter(function (x, i) { return vPtsKc.indexOf(x) === i; }).sort(function (p, q) { return p - q; });
    var hasIntermediateKc = !isCant && vPtsKc.length >= 3;
    function bayC1For(ev) {
      if (!hasIntermediateKc || sec.isBox || !ev.sol.mode || !ev.sol.mode.x) return null;
      var m = ev.sol.mode, pkv = 0, px = null;
      m.x.forEach(function (x, i) { if (Math.abs(m.phi[i]) > pkv) { pkv = Math.abs(m.phi[i]); px = x; } });
      if (px == null) return null;
      var xa = vPtsKc[0], xb = vPtsKc[vPtsKc.length - 1];
      for (var i2 = 0; i2 < vPtsKc.length - 1; i2++) if (px >= vPtsKc[i2] - 1e-6 && px <= vPtsKc[i2 + 1] + 1e-6) { xa = vPtsKc[i2]; xb = vPtsKc[i2 + 1]; break; }
      var Ls = xb - xa; if (Ls < 1e-3) return null;
      var Mf = momentFromSamples(ev.res.fb.xs, ev.res.fb.M);
      var sp2 = secProps(sec);
      try {
        var base2 = { E: a.E, G: G_STEEL, Iz: sp2.Iz, It: sp2.It, Iw: sp2.Iw, L: Ls, zj: 0,
                      restraints: [{ x: 0 }, { x: Ls }], nElem: 24, refine: true };
        var shb = mcrEigen(Object.assign({}, base2, { moment: (function (x0) { return function (x) { return Mf(x0 + x); }; })(xa) }));
        var unb = mcrEigen(Object.assign({}, base2, { moment: function () { return 1e6; } }));
        if (!(unb.Mcr > 0) || !shb.converged || !unb.converged) return null;
        return { C1: shb.Mcr / unb.Mcr, a: xa, b: xb };
      } catch (e2) { return null; }
    }

    /* kc = 1/sqrt(C1), NA 2.18. C1 is SHAPE-ONLY (zg = zj = 0): load height
       and monosymmetry are already inside Mcr, and folding them into kc
       would double-count them. Not applied to cantilevers (no published kc). */
    function chiChainFor(sol0, MxC, bay) {
      var lam = Math.sqrt(Wy * fy / sol0.Mcr);
      var C1c = sol0.C1;
      var c1lbl = 'back-calculated from the eigen solution: M<sub>cr</sub>(z<sub>g</sub>=0,z<sub>j</sub>=0)/M<sub>cr</sub>(uniform moment, same restraints)';
      if (bay && isFinite(bay.C1) && bay.C1 > 0 && bay.C1 < C1c) {
        C1c = bay.C1;
        c1lbl = 'critical bay ' + g(bay.a / 1000, 2) + '&ndash;' + g(bay.b / 1000, 2) + ' m between restraints (NA 2.18 basis): bay M<sub>cr</sub>(shape)/M<sub>cr</sub>(uniform); the whole-member ratio ' + sol0.C1.toFixed(3) + ' is not taken for k<sub>c</sub>';
      }
      var trusted = sol0.c1Converged;
      if (S.C1o != null) {
        c1lbl = 'user override for k<sub>c</sub> (eigen value was ' + C1c.toFixed(3) + ')';
        C1c = S.C1o;
        trusted = true;
      }
      var kcc = 1.0;
      if (trusted) kcc = Math.min(1 / Math.sqrt(Math.max(C1c, 1e-6)), 1.0);
      var Phi0 = null, chi0 = 1, f0 = 1, chiMod0 = 1, ign0 = true;
      if (lam > 0.4) {
        Phi0 = 0.5 * (1 + curve.alphaLT * (lam - 0.4) + 0.75 * lam * lam);
        chi0 = Math.min(1 / (Phi0 + Math.sqrt(Math.max(Phi0 * Phi0 - 0.75 * lam * lam, 1e-12))), 1, 1 / (lam * lam));
        f0 = isCant ? 1 : Math.min(1 - 0.5 * (1 - kcc) * (1 - 2 * Math.pow(lam - 0.8, 2)), 1);
        chiMod0 = Math.min(chi0 / f0, 1, 1 / (lam * lam));
        ign0 = false;
      }
      var MbRd0 = Math.min(chiMod0 * Wy * fy / gM1 / 1e6, b.McRd);
      return { lamLT: lam, C1: C1c, c1label: c1lbl, c1Trusted: trusted, kc: kcc,
               Phi: Phi0, chi: chi0, f: f0, chiMod: chiMod0, ign: ign0,
               MbRd: MbRd0, util: MbRd0 > 0 ? MxC / MbRd0 : 99, MxC: MxC };
    }

    var govEv = null, minMcrEv = null;
    evals.forEach(function (ev) {
      ev.bay = bayC1For(ev);
      ev.chain = chiChainFor(ev.sol, Math.abs(ev.res.Mmax) / 1e6, ev.bay);
      if (!govEv || ev.chain.util > govEv.chain.util) govEv = ev;
      if (!minMcrEv || ev.sol.Mcr < minMcrEv.sol.Mcr) minMcrEv = ev;
    });

    var sol = govEv.sol, chn = govEv.chain;
    var Mcr = sol.Mcr / 1e6;                     // kN.m
    var lamLT = chn.lamLT;
    var C1 = chn.C1, c1label = chn.c1label, c1Trusted = chn.c1Trusted, kc = chn.kc;
    if (!c1Trusted) warn.push('The reference solves used to back-calculate C<sub>1</sub> did not converge; k<sub>c</sub> = 1.0 has been used, which is the conservative value (f = 1.0, hence the lower M<sub>b,Rd</sub>). M<sub>cr</sub> itself is unaffected.');

    var Phi = chn.Phi, chi = chn.chi, f = chn.f, chiMod = chn.chiMod, ign = chn.ign;
    var MbRd = chn.MbRd;

    /* Channel + eccentric load: the eigen Mcr is the LTB half of the story.
       The primary torque from e0 must be carried by the EN 1993-6 Annex A
       interaction. If that check cannot run, do not allow a PASS. */
    var chanTorsionGap = false;
    if (sec.kind === 'channel' && a.tors && a.tors.on && !(b.tor && b.tor.p385)) {
      chanTorsionGap = true;
      unsupported.push('Channel with eccentric load: the LTB check is valid (z<sub>j</sub> = 0, I<sub>w</sub> about the shear centre), ' +
        'but the primary torque from e<sub>0</sub> must be combined with it through the EN 1993-6 Annex A interaction, ' +
        'which is not available for this support/load arrangement (it needs a fork-fork single span with full-span or point torques). PASS is blocked.');
    }

    ltb = { eigen: true, na: false, cant: isCant, channel: sec.kind === 'channel', box: !!sec.isBox,
            Mcr: Mcr, McrRev: sol.McrRev / 1e6, McrUniform: sol.McrUniform / 1e6, McrShape: sol.McrShape / 1e6,
            C1: C1, c1label: c1label, kc: kc, lamLT: lamLT, lamLTmcr: lamLT,
            curve: curve, Phi: Phi, chi: chi, f: f, chiMod: chiMod, ign: ign, ignM: ign,
            chiM: chi, chiModM: chiMod, fM: f, PhiM: Phi,           // aliases: Annex A block reads chiM
             MbRd: MbRd, MbMcr: MbRd, MbSimp: MbRd, McrBack: Mcr,    // aliases: Annex A reads Mcr / McrBack
             zg: sol.zg, zj: sol.zj, nElem: sol.nElem, meshError: meshErrorMax,
             zgValues: sol.zgValues, zgUniform: sol.zgUniform,
             c1Trusted: c1Trusted, mcrConverged: allConverged,
             mode: sol.mode, warn: warn, chanTorsionGap: chanTorsionGap,
             MxGov: chn.MxC, governCombo: govEv.res.combo ? govEv.res.combo.label : '',
             nCombos: evals.length,
             Iz: sol.sp.Iz, It: sol.sp.It, Iw: sol.sp.Iw, hs: sol.sp.hs };

    /* ---- Informational extras (NOT the design basis) ----
       1. Locate the buckled-mode twist peak: shows which bay the eigenmode
          localises in - the "critical segment" of the conventional method.
       2. Conventional segment-method comparison: each bay between lateral
          (v) restraint points solved in ISOLATION with fork ends and its own
          share of the moment diagram/loads. This discards lateral-bending and
          warping continuity across the restraints, so it is conservative
          relative to the whole-member eigen Mcr, which remains the design
          basis. Computed only when intermediate lateral restraints exist. */
    var modePeakX = null;
    if (sol.mode && sol.mode.x && sol.mode.x.length) {
      var mpk = 0;
      sol.mode.x.forEach(function (x, i) { if (Math.abs(sol.mode.phi[i]) > mpk) { mpk = Math.abs(sol.mode.phi[i]); modePeakX = x; } });
    }
    ltb.modePeakX = modePeakX;
    var vPts = [];
    S.supports.forEach(function (s) { vPts.push(+(((+s.pos) * 1000).toFixed(3))); });
    (S.ltbRestraints || []).forEach(function (r) { if (r.v !== false) { var xr = (+r.pos) * 1000; if (isFinite(xr) && xr >= -1e-6 && xr <= a.L + 1e-6) vPts.push(+xr.toFixed(3)); } });
    vPts = vPts.filter(function (x, i) { return vPts.indexOf(x) === i; }).sort(function (p, q) { return p - q; });
    ltb.vPoints = vPts;
    ltb.segments = null;
    if (!isCant && vPts.length >= 3) {
      var gfbG = govEv.res.fb, MfunG = momentFromSamples(gfbG.xs, gfbG.M);
      var ulG = unitLoadsFor(a, govEv.res.combo);
      var spG = secProps(sec), zjG = zjFor(sec);
      var segs = [];
      for (var si = 0; si < vPts.length - 1; si++) {
        var xa = vPts[si], xb = vPts[si + 1], Ls = xb - xa;
        if (Ls < 1e-3) continue;
        var dlS = ulG.distLoads.map(function (d) {
          var x1 = Math.max(d.x1, xa), x2 = Math.min(d.x2, xb);
          if (x2 - x1 < 1e-9) return null;
          var wAt = function (x) { return (d.x2 - d.x1 < 1e-9) ? d.w1 : d.w1 + (d.w2 - d.w1) * (x - d.x1) / (d.x2 - d.x1); };
          return { x1: x1 - xa, x2: x2 - xa, w1: wAt(x1), w2: wAt(x2), zg: d.zg || 0 };
        }).filter(function (d) { return d; });
        var plS = ulG.pointLoads.filter(function (q) { return q.x > xa + 1e-9 && q.x < xb - 1e-9; })
          .map(function (q) { return { x: q.x - xa, P: q.P, zg: q.zg || 0 }; });
        var seg = { a: xa, b: xb, ok: false };
        try {
          var rsS = mcrEigen({ E: a.E, G: G_STEEL, Iz: spG.Iz, It: spG.It, Iw: spG.Iw, L: Ls, zj: zjG,
            restraints: [{ x: 0 }, { x: Ls }], moment: (function (x0) { return function (x) { return MfunG(x0 + x); }; })(xa),
            distLoads: dlS, pointLoads: plS, nElem: 32, refine: true });
          var MsS = 0; for (var ii = 0; ii <= 200; ii++) { var mmS = Math.abs(MfunG(xa + Ls * ii / 200)); if (mmS > MsS) MsS = mmS; }
          var lamSg = Math.sqrt(Wy * fy / rsS.Mcr);
          var chiSg = 1;
          if (lamSg > 0.4) {
            var PhiSg = 0.5 * (1 + curve.alphaLT * (lamSg - 0.4) + 0.75 * lamSg * lamSg);
            chiSg = Math.min(1 / (PhiSg + Math.sqrt(Math.max(PhiSg * PhiSg - 0.75 * lamSg * lamSg, 1e-12))), 1, 1 / (lamSg * lamSg));
          }
          var MbSg = Math.min(chiSg * Wy * fy / gM1 / 1e6, b.McRd);
          seg = { a: xa, b: xb, ok: true, Ms: MsS / 1e6, Mcr: rsS.Mcr / 1e6, lam: lamSg, chi: chiSg, Mb: MbSg,
                  util: MbSg > 0 ? (MsS / 1e6) / MbSg : 99 };
        } catch (eS) { seg.err = eS.message; }
        segs.push(seg);
      }
      if (segs.length) ltb.segments = segs;
    }

    var Mx = b.Mx;
    var ltbUtil = chn.util;   // governing combination's own Mmax / its MbRd
    var ltbBasis = 'elastic critical moment from the finite-element eigenvalue solution ' +
      '(4 DOF/node: v, v\', &phi;, &phi;\'; z<sub>g</sub> and z<sub>j</sub> included; ' + ltb.nElem + ' elements, Richardson-extrapolated' +
      (evals.length > 1 ? '; ' + evals.length + ' ULS combinations each solved with their own moment diagram, governing: ' + ltb.governCombo : '') + ')';

    /* ---- MULTI-SPAN DESIGN BASIS: LTB span by span (support to support) ----
       For a continuous beam (>= 2 bays between lateral restraints) each
       unrestrained span is checked in ISOLATION with fork ends, its own Mcr and
       its own peak moment - the standard segment method - and the worst span
       governs the LTB utilisation. Taken as the MAX of the per-span and the
       whole-member result so nothing (e.g. an overhang not captured as an
       interior bay) is ever under-checked; isolating a bay is conservative vs
       the continuous whole-member Mcr, so the span check governs in practice.
       ltb.segments is empty for a single-span member (<=1 bay), so single-span
       members are completely unaffected. */
    var spanGov = null;
    if (ltb.segments && ltb.segments.length) {
      ltb.segments.forEach(function (s2) { if (s2.ok && (!spanGov || s2.util > spanGov.util)) spanGov = s2; });
    }
    if (spanGov && spanGov.util >= ltbUtil) {
      ltbUtil = spanGov.util;
      ltb.spanGoverns = true;
      ltb.spanGov = { a: spanGov.a, b: spanGov.b, Ms: spanGov.Ms, Mcr: spanGov.Mcr, lam: spanGov.lam, chi: spanGov.chi, Mb: spanGov.Mb, util: spanGov.util };
      ltbBasis = 'multi-span beam: lateral-torsional buckling checked SPAN BY SPAN (support to support). ' +
        'Each unrestrained bay between lateral restraints is solved in isolation with fork ends, its own M<sub>cr</sub> and its own peak moment; the worst span governs. ' +
        'Governing span ' + g(spanGov.a / 1000, 2) + '&ndash;' + g(spanGov.b / 1000, 2) + ' m: M<sub>Ed</sub> = ' + f1(spanGov.Ms, 1) + ', M<sub>cr</sub> = ' + f1(spanGov.Mcr, 1) + ', M<sub>b,Rd</sub> = ' + f1(spanGov.Mb, 1) + ' kN&middot;m, utilisation ' + g(spanGov.util, 2) + '. ' +
        '(Whole-member eigen M<sub>cr</sub> = ' + f1(ltb.Mcr, 1) + ' kN&middot;m retained for reference.)';
    }

    /* ---- Standard-method comparison (no eigen solve): closed-form Mcr for
       the same segment - the governing span when the span-by-span check
       governs, otherwise the whole member - and for the SAME COMBINATION as
       the design eigen value (govEv: its own moment diagram for C1 and the
       MasterSeries-style C1 inputs, its own load factors for the SN003a shape
       recognition and the load height z_g = most destabilising per-load value
       of that combination), with C1 from sn003aC1 (SN006a for a cantilever),
       LE = LE-factor x segment length and C2 where published. ---- */
    var segC1 = spanGov ? { xa: spanGov.a, xb: spanGov.b, whole: false }
                        : (typeof c1Segment === 'function' ? c1Segment(a) : { xa: 0, xb: a.L, whole: true });
    var stdCmp = null;
    try { stdCmp = mcrStandardFor(a, sec, segC1, { fb: govEv.res.fb, factors: govEv.res.combo.factors, combo: govEv.res.combo }); }
    catch (eStd) { stdCmp = { route: 'n/a', Mcr: null, C1: null, label: 'closed form not available: ' + eStd.message, c1in: null, seg: segC1 }; }
    if (stdCmp && !stdCmp.c1in && typeof c1Inputs === 'function') stdCmp.c1in = c1Inputs(govEv.res.fb, segC1.xa, segC1.xb);
    ltb.mcrMethod = 'eigen';
    ltb.McrEigen = spanGov ? spanGov.Mcr : Mcr;          // kN.m, the design value's segment
    ltb.McrStandard = (stdCmp && stdCmp.Mcr != null && isFinite(stdCmp.Mcr)) ? stdCmp.Mcr : null;
    ltb.McrRatio = (ltb.McrStandard > 0) ? ltb.McrEigen / ltb.McrStandard : null;
    ltb.std = stdCmp;
    ltb.c1in = stdCmp ? stdCmp.c1in : null;
    ltb.c1seg = segC1;
    ltb.c1route = stdCmp ? stdCmp.route : null;

    /* ---- EN 1993-6 Annex A: LTB + minor-axis bending + torsion ---- */
    var annex = null;
    if (b.tor && b.tor.p385) {
      /* The Annex A amplifier k_alpha uses the SMALLEST Mcr across the
         evaluated ULS combinations (conservative when several diagram shapes
         exist), with the matching chi_LT (no f-factor - P385 basis). */
      var lamAA = Math.sqrt(Wy * fy / minMcrEv.sol.Mcr);
      var chiA = 1;
      if (lamAA > 0.4) {
        var PhiAA = 0.5 * (1 + curve.alphaLT * (lamAA - 0.4) + 0.75 * lamAA * lamAA);
        chiA = Math.min(1 / (PhiAA + Math.sqrt(Math.max(PhiAA * PhiAA - 0.75 * lamAA * lamAA, 1e-12))), 1, 1 / (lamAA * lamAA));
      }
      var MbA = chiA * Wy * fy / gM1 / 1e6;
      var McrA = minMcrEv.sol.Mcr / 1e6;
      /* Cmz is an equivalent-uniform-moment factor for the minor-axis moment
         diagram (EN 1993-1-1 Annex B, Table B.3). C1 describes the major-axis
         diagram's effect on Mcr. Different quantities, different diagrams.

         The old lookup only worked because the retired sn003aC1() returned C1
         from a discrete table, where 1.348 meant "SS + central point load" and
         1.127 meant "SS + UDL". It was a proxy for the load case, not for C1.
         C1 is now a continuous eigenvalue ratio that also absorbs intermediate
         restraints and multi-span shape, so hitting a +/-0.02 window is
         coincidental and can reduce the minor-axis demand spuriously.

         1.0 is conservative: the term enters additively as +Cmz*Mz/MzR.
         Proper derivation = Table B.3 applied to the Mz(x)=phi(x)*My(x)
         diagram in b.tor.grids. NOTE this is not cmTableB3(), which reads the
         major-axis diagram a.governM.fb and returns Cmy. Not implemented. */
      var Cmz = (S.Cmzo != null && isFinite(S.Cmzo)) ? +S.Cmzo : 1.0;
      var MyMax = 0; b.tor.grids.forEach(function (g2) { g2.rows.forEach(function (r2) { MyMax = Math.max(MyMax, r2.My); }); });
      var MzR = b.tor.cls12 ? b.tor.Mplz : b.tor.Melz;
      var MfR = b.tor.cls12 ? b.tor.Mplf : b.tor.Melf;
      if (MyMax >= McrA * 0.999) {
        unsupported.push('M_y,Ed reaches the elastic critical moment M_cr: the Annex A amplifier k_alpha is unbounded; the member is inadequate as arranged.');
        annex = { u: 99, kAlpha: Infinity, Cmz: Cmz, MbA: MbA, McrA: McrA, MzR: MzR, MfR: MfR };
      } else {
        var kAlpha = 1 / (1 - MyMax / McrA), worst = { u: -1 };
        b.tor.grids.forEach(function (g2) {
          g2.rows.forEach(function (r2) {
            var kw = Math.max(0.7 - 0.2 * r2.Mw / MfR, 0), kzw = Math.max(1 - r2.Mz / MzR, 0);
            var u = r2.My / MbA + Cmz * r2.Mz / MzR + kw * kzw * kAlpha * r2.Mw / MfR;
            if (u > worst.u) worst = { u: u, x: r2.x, My: r2.My, Mz: r2.Mz, Mw: r2.Mw, kw: kw, kzw: kzw, combo: g2.combo.label };
          });
        });
        annex = Object.assign({}, worst, { kAlpha: kAlpha, Cmz: Cmz, MbA: MbA, McrA: McrA, MzR: MzR, MfR: MfR });
      }
    }

    var useB1u = sec.isBox || (ltb.MbRd >= b.McRd * 0.9999);
    // Bound the interaction with the lowest resistance of all enabled diagrams.
    // annexB2 separately sweeps each combination's own moment and Cm.
    var memberMb = Math.min.apply(null, evals.map(function(ev){ return ev.chain.MbRd; }));
    if (spanGov) memberMb = Math.min(memberMb, spanGov.Mb);
    useB1u = sec.isBox || (memberMb >= b.McRd * 0.9999);
    var buck = (b.ax && !b.ax.tension) ? annexB2(a, sec, fy, b.cl, memberMb, useB1u, isCant) : null;
    if (buck && buck.lczFromRestraints)
      warn.push('Minor-axis strut buckling length L<sub>cr,z</sub> = ' + (buck.LcrZ / 1000).toFixed(2) + ' m, taken as the largest spacing between adjacent lateral restraint points (SCI P360 6.2: secondary members act as bracing points; k = 1.0 between restraints). ' +
        'Ensure each restraint really is an effective bracing point - adequate stiffness, strength and anchorage. The major axis keeps L<sub>cr,y</sub> = L<sub>E</sub>&times;L = ' + (buck.LcrY / 1000).toFixed(2) + ' m.');

    var utils = [
      { name: 'Shear  V_Ed/V_c,Rd', val: b.shearUtil },
      { name: 'Bending  M_Ed/M_c,Rd', val: b.momUtil },
      { name: 'LTB  M_Ed/M_b,Rd', val: ltbUtil },
      { name: 'Deflection', val: b.dmax / b.dlimit }
    ];
    if (b.ax) {
      utils.push({ name: b.ax.tension ? 'Tension  N_Ed/N_t,Rd' : 'Compression  N_Ed/N_pl,Rd', val: b.ax.nUtil });
      utils.push({ name: b.ax.biax ? ('Biaxial bending' + ((S.axial || 0) !== 0 ? ' + axial' : '') + ' (6.2.9.1)') : 'Bending+axial cross-section (6.2.9)', val: b.ax.mUtil });
      /* Eq 6.61/6.62 are needed with axial compression AND for biaxial bending
         on an LTB-susceptible member with N_Ed = 0: Eq 6.62 then reads
         kzy*My/Mb,Rd + kzz*Mz/Mcz,Rd, which the separate LTB and cross-section
         checks do not cover. */
      if (!b.ax.tension && buck && (buck.Fc > 1e-9 || buck.biax)) {
        utils.push({ name: 'Member buckling y-y (Eq 6.61)', val: buck.u1 });
        utils.push({ name: 'Member buckling z-z (Eq 6.62)', val: buck.u2 });
      }
    }
    if (annex) utils.push({ name: 'LTB+torsion (EN 1993-6 Annex A)', val: annex.u });
    if (b.coex) utils.push({ name: b.coex.pureShearFail ? 'Pure shear failure at M-V check point (6.2.6)' : 'Bending+shear coexistent (6.2.8)', val: b.coex.u });
    if (b.web && b.web.checked) {
      utils.push({ name: WEB_UTIL_NAMES[0], val: b.web.util2 });
      utils.push({ name: WEB_UTIL_NAMES[1], val: b.web.util72 });
    }
    if (b.tor && b.tor.box) {
      utils.push({ name: 'Torsion  T_Ed/T_Rd', val: b.tor.torUtil });
      utils.push({ name: 'Shear+torsion  V_Ed/V_pl,T,Rd', val: b.tor.vtUtil });
    }
    if (b.tor && b.tor.p385) {
      utils.push({ name: 'Bending+torsion cross-section (P385 3.1.2)', val: b.tor.cross.u });
      utils.push({ name: 'Shear+torsion  V_Ed/V_pl,T,Rd', val: b.tor.vtUtil });
    }
    var gov = utils[0]; utils.forEach(function (u) { if (u.val > gov.val) gov = u; });
    var pass = unsupported.length === 0 && utils.every(function (u) { return u.val <= 1.0001; });

    return Object.assign({}, b, { sci: false, sciU: true, mcrMethod: 'eigen', unsupported: unsupported, ltb: ltb,
      ltbUtil: ltbUtil, ltbBasis: ltbBasis, C1: C1, c1label: c1label, LE: a.L,
      utils: utils, gov: gov, pass: pass, annex: annex, buck: buck });
  };

  /* ================================================================
     PART 5 - report block
     Replaces the `sciUltbBlocks` template in render().
     Pure ASCII + HTML entities, so it survives the file's cp1252 encoding.
     ================================================================ */
  window.ltbEigenReport = function (c, a, sec) {
    var LT = c.ltb || {};
    if (LT.na && LT.closed) return '<div class="section-title smallgap">Lateral&ndash;Torsional Buckling (Cl. 6.3.2.1(2))</div>' +
      '<div class="calc-block">' +
      '<div>Closed hollow section</div><div class="formula">' + (S.family === 'rhs' ? 'RHS' : 'SHS') + ' / closed box section &mdash; not susceptible to lateral-torsional buckling</div><div class="value">LTB not required</div><div class="status ok">Not required</div>' +
      '<div>M<sub>b,Rd</sub> = M<sub>c,Rd</sub></div><div class="formula">Full cross-section bending resistance used directly; adequacy is governed by the Clause 6.2 moment check above</div><div class="value">' + f1(LT.MbRd, 1) + ' kN&middot;m</div><div></div>' +
      '</div>';
    if (!LT.eigen) return '';
    if (LT.failed) return '<div class="section-title smallgap">Lateral&ndash;Torsional Buckling</div>' +
      '<div class="calc-block"><div>M<sub>cr</sub></div><div class="formula">' + LT.err +
      '</div><div class="value">&mdash;</div><div class="status fail">BLOCKED</div></div>';

    var Wy = c.cl.cls <= 2 ? sec.Sx : sec.Zx;
    var restr = (S.ltbRestraints || []).length;
    var rows = '';
    rows += '<div>Buckling model</div><div class="formula">FE eigenvalue solution of (K<sub>e</sub> + &lambda;K<sub>g</sub>)d = 0 over the governing BMD; ' +
            'Hermite cubics, 4 DOF/node (v, v&prime;, &phi;, &phi;&prime;); ' + LT.nElem + ' elements, Richardson-extrapolated</div>' +
            '<div class="value">mesh err &lt; ' + g(Math.max(LT.meshError || 0, 1e-6) * 100, 3) + ' %</div><div></div>';
    rows += '<div>Section properties</div><div class="formula">I<sub>z</sub> = ' + g(LT.Iz / 1e4, 0) + ' cm<sup>4</sup>; I<sub>T</sub> = ' + g(LT.It / 1e4, 1) +
            ' cm<sup>4</sup>; I<sub>w</sub> = ' + g(LT.Iw / 1e12, 4) + ' dm<sup>6</sup>' + (LT.channel ? ' (about the shear centre)' : '') +
            '; G = 81000 N/mm&sup2;</div><div class="value">z<sub>j</sub> = ' + g(LT.zj, 1) + ' mm</div><div></div>';
    var supExtras = S.supports.map(function (s) {
      var ex = [];
      var vpOn = s.type === 'fixed' ? (S.fixedLateral !== false || s.vp) : !!s.vp;
      var wpOn = s.type === 'fixed' ? (S.rootWarp === 'restrained' || s.phip) : !!s.phip;
      if (vpOn) ex.push('v&prime;');
      if (wpOn) ex.push('&phi;&prime;');
      return ex.length ? ('x = ' + g(+s.pos, 2) + ' m: +' + ex.join(', ') + ' fixed') : null;
    }).filter(function (t) { return t; });
    rows += '<div>Lateral restraints</div><div class="formula">' + S.supports.length + ' support(s) taken as fork restraints (v = &phi; = 0)' +
            (supExtras.length ? '; additionally ' + supExtras.join('; ') : '') +
            (restr ? '; ' + restr + ' intermediate restraint(s)' : '') +
            (LT.cant ? '; cantilever root warping ' + (S.rootWarp === 'restrained' ? 'restrained' : 'free') : '') +
            '</div><div class="value">&mdash;</div><div></div>';
    var zref = (typeof loadHeightReference === 'function') ? loadHeightReference(sec) : null;
    var zrefText = zref ? '; refs: top +' + g(zref.topSurface, 0) + ' mm, bottom ' + g(zref.bottomSurface, 0) + ' mm' : '';
    var zfmt = function(z){ return (z>0?'+':'') + g(z,0); };
    var zgText = (LT.zgValues && LT.zgValues.length > 1)
      ? 'per-load z<sub>g</sub> = ' + LT.zgValues.map(zfmt).join(', ') + ' mm above the shear centre'
      : 'z<sub>g</sub> = ' + zfmt(LT.zg || 0) + ' mm above the shear centre';
    rows += '<div>Load height</div><div class="formula">' + zgText + zrefText +
            (LT.zg > 0 ? ' (max value destabilising)' : LT.zg < 0 ? ' (max value stabilising)' : '') + '</div><div class="value">M<sub>cr</sub> (load reversed) = ' + f1(LT.McrRev, 1) + ' kN&middot;m</div><div></div>';
    rows += '<div><b>M<sub>cr</sub></b> (FE eigenvalue method)</div><div class="formula">eigenvalue &times; max|M(x)| &mdash; no C<sub>1</sub>, C<sub>2</sub> or C<sub>3</sub> used' +
            (LT.nCombos > 1 ? '; each of the ' + LT.nCombos + ' ULS combinations solved with its own diagram &mdash; governing: ' + LT.governCombo : '') + '</div>' +
            '<div class="value"><b>' + f1(LT.Mcr, 1) + ' kN&middot;m</b></div><div></div>';
    /* standard closed-form comparison for the same segment (informational) */
    if (LT.std) {
      var ci = LT.c1in, sg = LT.c1seg || {};
      var segTxt = (sg.whole === false) ? 'segment ' + g(sg.xa / 1000, 2) + '&ndash;' + g(sg.xb / 1000, 2) + ' m' : 'whole member';
      var ciTxt = ci ? 'M<sub>1</sub> = ' + f1(ci.M1, 1) + ', M<sub>2</sub> = ' + f1(ci.M2, 1) + ', M<sub>o</sub> = ' + f1(ci.Mo, 1) + ' kN&middot;m; &psi; = ' + f1(ci.psi, 3) + '; &mu; = ' + f1(ci.mu, 3) + '; ' : '';
      rows += '<div>Standard closed-form M<sub>cr</sub> (comparison, not the design basis)</div><div class="formula">' +
              (LT.std.route === 'sn006a' ? 'SN006a cantilever: C = ' : 'SN003a: C<sub>1</sub> = fn(M<sub>1</sub>, M<sub>2</sub>, M<sub>o</sub>, &psi;, &mu;) = ') +
              (LT.std.C1 != null ? g(LT.std.C1, 3) : '&mdash;') + ' &mdash; ' + ciTxt + (LT.std.label || '') +
              (LT.std.LE ? '; L<sub>E</sub> = ' + g(LT.std.LE / 1000, 2) + ' m (' + segTxt + ')' : '') +
              (LT.std.zgUsed ? '; C<sub>2</sub>z<sub>g</sub> term applied' : '') + '</div>' +
              '<div class="value">' + (LT.McrStandard != null ? f1(LT.McrStandard, 1) + ' kN&middot;m' : 'not covered') +
              (LT.McrRatio != null ? '<br>eigen / standard = ' + f1(LT.McrRatio, 2) : '') + '</div><div></div>';
    }
    rows += '<div>&lambda;&#772;<sub>LT</sub> = &radic;(W<sub>y</sub>f<sub>y</sub>/M<sub>cr</sub>)</div><div class="formula">&radic;(' + g(Wy, 0) + '&times;10&sup3;&times;' + g(a.py, 0) + '/' + f1(LT.Mcr, 1) + '&times;10<sup>6</sup>)</div><div class="value">' + f1(LT.lamLT, 3) + '</div><div></div>';
    rows += '<div>Buckling curve</div><div class="formula">' + (sec.isBox ? 'closed section, not listed in NA Table 6.3' : sec.kind === 'channel' ? 'not doubly symmetric' : 'NA Table 6.3, h/b = ' + g(sec.D / sec.B, 2)) +
            '</div><div class="value">curve ' + LT.curve.curve + ' (&alpha;<sub>LT</sub> = ' + g(LT.curve.alphaLT, 2) + ')</div><div></div>';
    if (LT.ign) {
      rows += '<div>&lambda;&#772;<sub>LT</sub> &le; 0.4 (NA 2.17)</div><div class="formula">LTB effects may be ignored (cl 6.3.2.2(4))</div><div class="value">&chi;<sub>LT,mod</sub> = 1.000</div><div class="status ok">Ignored</div>';
    } else {
      rows += '<div>&Phi;<sub>LT</sub>; &chi;<sub>LT</sub></div><div class="formula">&lambda;&#772;<sub>LT,0</sub> = 0.4, &beta; = 0.75 (NA 2.17); &Phi; = ' + g(LT.Phi, 3) + '</div><div class="value">&chi;<sub>LT</sub> = ' + g(LT.chi, 3) + '</div><div></div>';
      rows += '<div>C<sub>1</sub> (for k<sub>c</sub> only)</div><div class="formula">' + LT.c1label + '</div><div class="value">C<sub>1</sub> = ' + g(LT.C1, 3) + '</div><div></div>';
      if (LT.cant) rows += '<div>k<sub>c</sub> / f</div><div class="formula">not applied to cantilevers (no published k<sub>c</sub>)</div><div class="value">f = 1.000</div><div></div>';
      else rows += '<div>k<sub>c</sub> = 1/&radic;C<sub>1</sub>; f = 1&minus;0.5(1&minus;k<sub>c</sub>)[1&minus;2(&lambda;&#772;<sub>LT</sub>&minus;0.8)&sup2;] &le; 1</div><div class="formula">k<sub>c</sub> = ' + g(LT.kc, 3) + ' (NA 2.18)</div><div class="value">f = ' + g(LT.f, 3) + '</div><div></div>';
      rows += '<div>&chi;<sub>LT,mod</sub> = &chi;<sub>LT</sub>/f &le; min(1, 1/&lambda;&#772;&sup2;)</div><div class="formula">' + g(LT.chi, 3) + '/' + g(LT.f, 3) + '</div><div class="value">' + g(LT.chiMod, 3) + '</div><div></div>';
    }
    rows += '<div>M<sub>b,Rd</sub> = &chi;<sub>LT,mod</sub>W<sub>' + (c.cl.cls <= 2 ? 'pl' : 'el') + ',y</sub>f<sub>y</sub>/&gamma;<sub>M1</sub> &le; M<sub>c,Rd</sub></div>' +
            '<div class="formula">' + g(LT.ign ? 1 : LT.chiMod, 3) + '&times;' + g(Wy, 0) + '&times;' + g(a.py, 0) + '/1.0</div><div class="value">' + f1(LT.MbRd, 1) + ' kN&middot;m</div><div></div>';
    var MxLTB = LT.spanGoverns ? LT.spanGov.Ms : ((LT.MxGov != null) ? LT.MxGov : c.Mx);
    var MbLTB = LT.spanGoverns ? LT.spanGov.Mb : LT.MbRd;
    var mEdLbl = LT.spanGoverns ? ' (governing span ' + g(LT.spanGov.a / 1000, 2) + '&ndash;' + g(LT.spanGov.b / 1000, 2) + ' m)' : (LT.nCombos > 1 ? ' (governing combination)' : '');
    rows += '<div>M<sub>Ed</sub> / M<sub>b,Rd</sub>' + mEdLbl + '</div><div class="formula">' + f1(MxLTB, 1) + ' / ' + f1(MbLTB, 1) + (LT.spanGoverns ? '  &mdash; per-span (support to support)' : '') + '</div><div class="value">' + g(MxLTB / Math.max(MbLTB, 1e-9), 2) + '</div>' + st(c.ltbUtil <= 1, 'OK', 'exceeded');

    var warnHtml = (LT.warn && LT.warn.length) ? '<div class="note" style="margin-left:0">' + LT.warn.map(function (w) { return '&bull; ' + w; }).join('<br>') + '</div>' : '';

    /* ---- buckled mode shape (normalised) ---- */
    var modeHtml = '';
    var md = LT.mode;
    if (md && md.x && md.x.length > 2) {
      var Wp = 640, Hp = 150, pdd = 12, Lm = md.x[md.x.length - 1];
      var vmx = 0; md.v.forEach(function (vv) { vmx = Math.max(vmx, Math.abs(vv)); });
      var Xf = function (x) { return pdd + (Wp - 2 * pdd) * x / Lm; };
      var Yc = Hp / 2, ampl = Hp / 2 - pdd - 16;
      var pphi = '', pv = '';
      md.x.forEach(function (x, i) {
        pphi += (i ? ' L ' : 'M ') + Xf(x).toFixed(1) + ' ' + (Yc - ampl * md.phi[i]).toFixed(1);
        pv += (i ? ' L ' : 'M ') + Xf(x).toFixed(1) + ' ' + (Yc - ampl * (vmx > 0 ? md.v[i] / vmx : 0)).toFixed(1);
      });
      var marks = (LT.vPoints || []).map(function (x) {
        var xx = Xf(x);
        return '<line x1="' + xx.toFixed(1) + '" y1="' + pdd + '" x2="' + xx.toFixed(1) + '" y2="' + (Hp - pdd) + '" stroke="#b91c1c" stroke-width="1" stroke-dasharray="3,3"/>' +
               '<text x="' + xx.toFixed(1) + '" y="' + (Hp - 2) + '" font-size="9" text-anchor="middle" fill="#b91c1c">' + g(x / 1000, 2) + '</text>';
      }).join('');
      modeHtml =
        '<div class="section-title smallgap">Buckled Mode Shape &mdash; critical eigenmode (normalised)</div>' +
        '<div style="border:1px solid #d1d5db;border-radius:6px;padding:6px;background:#fff">' +
        '<svg viewBox="0 0 ' + Wp + ' ' + Hp + '" style="width:100%;max-width:' + Wp + 'px;display:block" xmlns="http://www.w3.org/2000/svg">' +
        '<line x1="' + pdd + '" y1="' + Yc + '" x2="' + (Wp - pdd) + '" y2="' + Yc + '" stroke="#9ca3af" stroke-width="1"/>' +
        marks +
        '<path d="' + pphi + '" fill="none" stroke="#1d4ed8" stroke-width="2"/>' +
        '<path d="' + pv + '" fill="none" stroke="#059669" stroke-width="1.6" stroke-dasharray="6,4"/>' +
        '</svg>' +
        '<div class="note" style="margin-left:0">Blue solid: twist &phi;(x); green dashed: lateral displacement v(x), each normalised to its own peak. ' +
        'Red dashed verticals: lateral restraint points. Peak twist at x = ' + (LT.modePeakX != null ? g(LT.modePeakX / 1000, 2) : '&mdash;') + ' m ' +
        '&mdash; the eigenmode localises in the critical bay, so the whole-member M<sub>cr</sub> already embodies the worst segment.</div></div>';
    }

    /* ---- conventional segment-method comparison (informational) ---- */
    var segHtml = '';
    if (LT.segments && LT.segments.length) {
      var worstSeg = null; LT.segments.forEach(function (s2) { if (s2.ok && (!worstSeg || s2.util > worstSeg.util)) worstSeg = s2; });
      var isBasis = !!LT.spanGoverns;
      segHtml =
        '<div class="section-title smallgap">' + (isBasis
          ? 'Lateral&ndash;Torsional Buckling &mdash; Span by Span (design basis, support to support)'
          : 'Segment-Method Comparison (informational &mdash; NOT the design basis)') + '</div>' +
        '<div class="calc-block">' +
        LT.segments.map(function (s2) {
          if (!s2.ok) return '<div>Span ' + g(s2.a / 1000, 2) + '&ndash;' + g(s2.b / 1000, 2) + ' m</div><div class="formula">could not be solved in isolation: ' + (s2.err || '') + '</div><div class="value">&mdash;</div><div></div>';
          var isWorst = (worstSeg && s2 === worstSeg);
          var tag = isWorst ? ('<div class="status' + (isBasis ? (s2.util <= 1 ? ' ok' : ' fail') : '') + '">' + (isBasis ? 'governs' : 'worst segment') + '</div>') : '<div></div>';
          return '<div>Span ' + g(s2.a / 1000, 2) + '&ndash;' + g(s2.b / 1000, 2) + ' m (support to support, fork ends)</div>' +
            '<div class="formula">M<sub>Ed</sub> = ' + f1(s2.Ms, 1) + '; M<sub>cr</sub> = ' + f1(s2.Mcr, 0) + '; M<sub>b,Rd</sub> = ' + f1(s2.Mb, 0) + ' kN&middot;m; &lambda;&#772;<sub>LT</sub> = ' + g(s2.lam, 3) + '; &chi;<sub>LT</sub> = ' + g(s2.chi, 3) + ' (no f-factor)</div>' +
            '<div class="value">util = ' + g(s2.util, 3) + '</div>' + tag;
        }).join('') +
        '</div>' +
        '<div class="note" style="margin-left:0">' + (isBasis
          ? 'Multi-span beam: LTB is checked <b>span by span</b>. Each unrestrained bay between lateral restraints is isolated with fork ends and its own share of the moment diagram and loads, giving its own M<sub>cr</sub>; the worst span governs the LTB utilisation above. Isolation conservatively discards the lateral-bending (v&prime;) and warping (&phi;&prime;) continuity across the supports (whole-member eigen M<sub>cr</sub> = ' + f1(LT.Mcr, 1) + ' kN&middot;m is shown for reference only).'
          : 'Conventional check for comparison: each bay between lateral restraints is isolated with fork ends and its own share of the moment diagram and loads. ' +
            'Isolation discards the lateral-bending (v&prime;) and warping (&phi;&prime;) continuity that the adjacent bays provide across the restraint points, so these values are conservative. ' +
            'The design basis is the whole-member eigen solution above: M<sub>cr</sub> = ' + f1(LT.Mcr, 1) + ' kN&middot;m' + (worstSeg ? ' vs the worst isolated segment ' + f1(worstSeg.Mcr, 0) + ' kN&middot;m' : '') + '.') + '</div>';
    }

    return '<div class="section-title smallgap">Lateral&ndash;Torsional Buckling &mdash; Elastic Critical Moment (FE eigenvalue solution)</div>' +
           '<div class="calc-block">' + rows + '</div>' + warnHtml + modeHtml + segHtml;
  };

  /* ================================================================
     PART 6 - intermediate lateral restraint UI
     ================================================================ */
  if (S.ltbRestraints == null) S.ltbRestraints = [];
  if (S.fixedLateral == null) S.fixedLateral = true;
  if (S.zj == null) S.zj = 0;
  if (S.Cmzo === undefined) S.Cmzo = null;   // verified Cmz override; null = conservative 1.0

  function injectUI() {
    var host = document.getElementById('restraintRow');
    if (!host || document.getElementById('ltbRestraintPanel')) return;
    var div = document.createElement('div');
    div.id = 'ltbRestraintPanel';
    div.innerHTML =
      '<div class="list" id="ltbRestraintList"></div>' +
      '<div class="addbar"><button type="button" id="addLtbRestraint">+ Add lateral restraint</button></div>' +
      '<label class="checkline ltb-fixed"><input type="checkbox" id="fixedLateral"> <span>Fixed supports restrain lateral bending (v&prime; = 0)</span></label>' +
      '<div class="hint">Every vertical support is taken as a fork restraint: lateral displacement and twist prevented, ' +
      'warping and lateral bending free by default &mdash; each support row offers <b>lat. bending v&prime;</b> and ' +
      '<b>warping &phi;&prime;</b> checkboxes to model laterally clamped or warping-restrained ends (the SCI Mcr tool&rsquo;s ' +
      'dU = F / d&theta; = F) without changing the vertical bending model. ' +
      'Add intermediate restraints where purlins, ties or secondary beams hold the member. ' +
      'The LTB buckling length follows from these positions &mdash; the L<sub>E</sub> factor and the destabilising &times;1.2 switch ' +
      'no longer affect EC3 LTB. Restraints that hold lateral displacement v also shorten the minor-axis strut length ' +
      'L<sub>cr,z</sub> to their spacing (SCI P360 6.2); the major-axis strut length stays L<sub>E</sub>&times;L. ' +
      'A cantilever needs lateral-bending restraint at its root, or the lateral stiffness matrix is singular.</div>';
    host.parentNode.insertBefore(div, host.nextSibling);
    document.getElementById('addLtbRestraint').addEventListener('click', function () {
      S.ltbRestraints.push({ pos: (S.L / 2).toFixed(3), v: true, phi: true, vp: false, phip: false });
      renderLtbRestraintList(); recompute();
    });
    document.getElementById('fixedLateral').addEventListener('change', function (e) {
      S.fixedLateral = e.target.checked; recompute();
    });
  }

  function renderLtbRestraintList() {
    var el = document.getElementById('ltbRestraintList');
    if (!el) return;
    var fl = document.getElementById('fixedLateral');
    if (fl) fl.checked = !!S.fixedLateral;
    el.innerHTML = (S.ltbRestraints || []).map(function (r, i) {
      return '<div class="row"><div class="rowhead">' +
        '<label style="flex:1">x, m <input type="number" step="0.01" data-i="' + i + '" data-k="pos" value="' + r.pos + '"></label>' +
        '<button type="button" class="del" data-del="' + i + '">Remove</button></div>' +
        '<div class="ltb-checks">' +
        chk(i, 'v', 'lateral v', r.v !== false) + chk(i, 'phi', 'twist &phi;', r.phi !== false) +
        chk(i, 'vp', 'lat. bending v&prime;', !!r.vp) + chk(i, 'phip', 'warping &phi;&prime;', !!r.phip) +
        '</div></div>';
    }).join('');
    function chk(i, k, lbl, on) {
      return '<label class="checkline"><input type="checkbox" data-i="' + i + '" data-k="' + k + '"' + (on ? ' checked' : '') + '> <span>' + lbl + '</span></label>';
    }
    el.querySelectorAll('input').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var i = +inp.dataset.i, k = inp.dataset.k;
        S.ltbRestraints[i][k] = inp.type === 'checkbox' ? inp.checked : inp.value;
        recompute();
      });
    });
    el.querySelectorAll('button[data-del]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        S.ltbRestraints.splice(+btn.dataset.del, 1); renderLtbRestraintList(); recompute();
      });
    });
  }
  window.renderLtbRestraintList = renderLtbRestraintList;

  /* keep the panel in step with syncInputs(), and hide it when LTB is off */
  var _sync = window.syncInputs;
  window.syncInputs = function () {
    _sync.apply(this, arguments);
    injectUI(); renderLtbRestraintList();
    var show = (S.code === 'EC3' && (S.restraint || 'full') !== 'full');
    var p = document.getElementById('ltbRestraintPanel');
    if (p) p.style.display = show ? '' : 'none';
    var c1h = document.getElementById('c1Hint');
    if (c1h) c1h.innerHTML = (mcrMethod() === 'standard')
      ? 'Standard method: C<sub>1</sub> is derived from the moment diagram (NCCI SN003a tables for a simply supported UDL / central point load, ' +
        'the SCI end-moment curve for a linear gradient, otherwise the Serna quarter-point expression); it sets both M<sub>cr</sub> and ' +
        'k<sub>c</sub> = 1/&radic;C<sub>1</sub>. Override with a verified value (e.g. LTBeam) if required.'
      : 'M<sub>cr</sub> is solved directly by the FE eigensolver &mdash; C<sub>1</sub> is not an input. ' +
        'It is back-calculated purely to form k<sub>c</sub> = 1/&radic;C<sub>1</sub> (NA 2.18). Override only to force k<sub>c</sub>; ' +
        'the eigen value is printed alongside.';
    /* the restraint panel is only meaningful to the eigen method; the standard
       route ignores intermediate restraints (whole-member LE = k x L) */
    var rp = document.getElementById('ltbRestraintPanel');
    if (rp && show) rp.style.opacity = (mcrMethod() === 'standard') ? '0.55' : '';
  };

  /* validate restraint positions */
  var _validate = window.validateInputs;
  window.validateInputs = function (py, E, uls, sls) {
    _validate.apply(this, arguments);
    (S.ltbRestraints || []).forEach(function (r, i) {
      var x = +r.pos;
      if (!isFinite(x) || x < 0 || x > S.L) throw 'Lateral restraint ' + (i + 1) + ' at x = ' + r.pos + ' m lies outside the span (0 to ' + S.L + ' m).';
    });
    if (S.Cmzo != null && !(isFinite(S.Cmzo) && S.Cmzo > 0)) throw 'C_mz override must be a positive number.';
  };

  assertSaggingPositive();
  if (typeof syncInputs === 'function') { try { injectUI(); renderLtbRestraintList(); } catch (e) {} }

  window.LTB_EIGEN = { mcrEigen: mcrEigen, solveLTB: solveLTB, momentFromSamples: momentFromSamples,
                       assertSaggingPositive: assertSaggingPositive };
})();
