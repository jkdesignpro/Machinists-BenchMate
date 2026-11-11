'use strict';
// Mechanics for the shop (parity B8): unit helpers, the shared section fields
// and the drawings for the mechanics tools in tools.js. Every formula runs in
// the Rust core (core/src/mechanics.rs); this file only converts units and
// draws. Sources: docs/mechanics.md.

// Exact unit factors (NIST SP 811 appendix B).
const MK_LBF_N = 4.4482216152605, MK_LB_KG = 0.45359237, MK_HP_W = 745.69987158227022, MK_LBFIN_NM = 4.4482216152605 * 0.0254;
const MK_MPSI_GPA = 6.894757293168, MK_OZIN_GMM = 28.349523125 * 25.4;

// Units per system. Core formulas are unit-consistent: inch mode passes in, lbf
// and psi, mm mode passes mm, N and MPa (N/mm2).
function mku(s) {
  return s === 'inch'
    ? { L: 'in', F: 'lbf', w: 'lbf/in', E: 'Mpsi', eK: 1e6, S: 'ksi', sK: 1000, M: 'lbf·in', mK: 1, A: 'in²', I: 'in⁴', Z: 'in³', m: 'lb', rho: 'lb/in³', dp: 4, adp: 4, idp: 4, sdp: 2 }
    : { L: 'mm', F: 'N', w: 'N/mm', E: 'GPa', eK: 1e3, S: 'MPa', sK: 1, M: 'N·m', mK: 1e-3, A: 'mm²', I: 'mm⁴', Z: 'mm³', m: 'kg', rho: 'g/cm³', dp: 3, adp: 1, idp: 0, sdp: 1 };
}
const mkWarn = t => '<span class="warn">' + t + '</span>';
const mkNote = t => R(mkWarn(t), '', '');

// Shared section fields (ids prefixed "s"). `extra` adds an option such as
// [8, 'Enter I and c yourself'] that the tool handles itself.
const MK_SHAPES = [[0, 'Rectangle (solid bar)'], [1, 'Hollow rectangle (box tube)'], [2, 'Round bar'], [3, 'Round tube'], [4, 'I-beam'], [5, 'Channel'], [6, 'Angle'], [7, 'Tee']];
function mkSecFields(s, extra, def) {
  const u = mku(s).L, inch = s === 'inch', has = list => v => list.includes(v.sec);
  return [
    { id: 'sec', label: 'Section shape', unit: '', def: def != null ? def : 0, options: MK_SHAPES.concat(extra || []) },
    { id: 'sb', label: 'Width b (flange width; horizontal leg)', unit: u, def: inch ? 2 : 50, when: has([0, 1, 4, 5, 6, 7]) },
    { id: 'sh', label: 'Height h (overall depth; vertical leg)', unit: u, def: inch ? 4 : 100, when: has([0, 1, 4, 5, 6, 7]) },
    { id: 'st', label: 'Wall or leg thickness t', unit: u, def: inch ? 0.25 : 6, when: has([1, 6]) },
    { id: 'stf', label: 'Flange thickness tf', unit: u, def: inch ? 0.375 : 10, when: has([4, 5, 7]) },
    { id: 'stw', label: 'Web (stem) thickness tw', unit: u, def: inch ? 0.25 : 6, when: has([4, 5, 7]) },
    { id: 'sD', label: 'Outside diameter D', unit: u, def: inch ? 1 : 25, when: has([2, 3]) },
    { id: 'sd', label: 'Inside diameter d', unit: u, def: inch ? 0.75 : 19, when: has([3]) },
  ];
}
// Core arguments [shape, p1, p2, p3, p4] for the section fields (angle: vertical leg first).
function mkSecArgs(v) {
  switch (v.sec) {
    case 0: return [0, v.sb, v.sh, 0, 0];
    case 1: return [1, v.sb, v.sh, v.st, 0];
    case 2: return [2, v.sD, 0, 0, 0];
    case 3: return [3, v.sD, v.sd, 0, 0];
    case 4: case 5: case 7: return [v.sec, v.sb, v.sh, v.stf, v.stw];
    case 6: return [6, v.sh, v.sb, v.st, 0];
    default: return null;
  }
}
const mkSec = (W, a, which) => a ? W.mech_section(a[0], a[1], a[2], a[3], a[4], which) : NaN;

// Section outline (to scale) with the centroid and the x and y centroidal axes.
function mkSectionSvg(v, W) {
  const a = mkSecArgs(v); if (!a) return '';
  const A = mkSec(W, a, 0); if (!(A > 0)) return '';
  const bw = mkSec(W, a, 17), bh = mkSec(W, a, 18), xc = mkSec(W, a, 1), yc = mkSec(W, a, 2);
  const w = 440, h = 230, mp = gfit([[0, 0], [bw, bh]], w - 160, h, 24);
  const rect = (x, y, rw, rh, cls) => { const p = mp.P([x, y + rh]); return '<rect class="' + cls + '" x="' + p[0].toFixed(1) + '" y="' + p[1].toFixed(1) + '" width="' + (rw * mp.k).toFixed(1) + '" height="' + (rh * mp.k).toFixed(1) + '"/>'; };
  let s = '';
  const [sh, p1, p2, p3, p4] = a;
  if (sh === 2 || sh === 3) {
    const c = mp.P([bw / 2, bh / 2]);
    s += '<circle class="gacc" cx="' + c[0].toFixed(1) + '" cy="' + c[1].toFixed(1) + '" r="' + (p1 / 2 * mp.k).toFixed(1) + '"/>';
    if (sh === 3 && p2 > 0) s += '<circle class="gsoft" cx="' + c[0].toFixed(1) + '" cy="' + c[1].toFixed(1) + '" r="' + (p2 / 2 * mp.k).toFixed(1) + '"/>';
  } else if (sh === 0) s += rect(0, 0, p1, p2, 'gacc');
  else if (sh === 1) s += rect(0, 0, p1, p2, 'gacc') + rect(p3, p3, p1 - 2 * p3, p2 - 2 * p3, 'gsoft');
  else if (sh === 4) s += rect(0, 0, p1, p3, 'gacc') + rect(0, p2 - p3, p1, p3, 'gacc') + rect((p1 - p4) / 2, p3, p4, p2 - 2 * p3, 'gacc');
  else if (sh === 5) s += rect(0, 0, p1, p3, 'gacc') + rect(0, p2 - p3, p1, p3, 'gacc') + rect(0, p3, p4, p2 - 2 * p3, 'gacc');
  else if (sh === 6) s += rect(0, 0, p3, p1, 'gacc') + rect(p3, 0, p2 - p3, p3, 'gacc');
  else if (sh === 7) s += rect(0, p2 - p3, p1, p3, 'gacc') + rect((p1 - p4) / 2, 0, p4, p2 - p3, 'gacc');
  const c = mp.P([xc, yc]), x0 = mp.P([0, 0]), x1 = mp.P([bw, bh]);
  s += '<path class="gk" d="M' + (x0[0] - 12).toFixed(1) + ' ' + c[1].toFixed(1) + 'L' + (x1[0] + 12).toFixed(1) + ' ' + c[1].toFixed(1) + 'M' + c[0].toFixed(1) + ' ' + (x0[1] + 12).toFixed(1) + 'L' + c[0].toFixed(1) + ' ' + (x1[1] - 12).toFixed(1) + '"/>';
  s += '<circle class="gdot" cx="' + c[0].toFixed(1) + '" cy="' + c[1].toFixed(1) + '" r="3.5"/>';
  s += gtxt([x1[0] + 16, c[1] + 4], 'x', 'gv') + gtxt([c[0] + 5, x1[1] - 14], 'y', 'gv');
  s += gtxt([w - 130, 30], 'centroid', 'gs') + gtxt([w - 130, 46], 'x = ' + xc.toPrecision(4), 'gs') + gtxt([w - 130, 62], 'y = ' + yc.toPrecision(4), 'gs') + gtxt([w - 130, 78], 'from lower left', 'gs');
  return gsvg(w, h, s, 'Section drawing with centroid');
}

// Beam drawing: supports, loads, deflected shape (exaggerated) and the bending moment diagram.
function mkBeamSvg(sup, L, a, P, wl, ei) {
  const W = state.W;
  if (!(L > 0 && ei > 0) || !(P || wl)) return '';
  const w = 440, h = 250, x0 = 40, x1 = 400, by = 70, my = 190;
  const X = x => x0 + (x1 - x0) * x / L;
  const N = 80, ys = [], ms = [];
  for (let i = 0; i <= N; i++) { const x = L * i / N; ys.push(W.mech_beam_at(sup, L, a, P, wl, ei, x, 0)); ms.push(W.mech_beam_at(sup, L, a, P, wl, ei, x, 2)); }
  const ymax = Math.max(...ys.map(Math.abs)) || 1, mmax = Math.max(...ms.map(Math.abs)) || 1;
  let s = '<path class="gb" d="M' + x0 + ' ' + by + 'L' + x1 + ' ' + by + '"/>';
  s += '<path class="gp" d="' + ys.map((y, i) => (i ? 'L' : 'M') + X(L * i / N).toFixed(1) + ' ' + (by + 34 * y / ymax).toFixed(1)).join('') + '"/>';
  const wall = x => '<path class="gm" d="M' + x + ' ' + (by - 22) + 'L' + x + ' ' + (by + 22) + '"/>' + [0, 1, 2, 3, 4].map(k => '<path class="gm" d="M' + x + ' ' + (by - 20 + 10 * k) + 'l' + (x === x0 ? -7 : 7) + ' 6"/>').join('');
  const pin = x => '<path class="gm" d="M' + x + ' ' + by + 'l-7 12h14z"/>';
  if (sup === 0) s += wall(x0); else if (sup === 1) s += pin(x0) + pin(x1); else s += wall(x0) + wall(x1);
  if (P) { const xp = X(a); s += '<path class="gc" d="M' + xp.toFixed(1) + ' ' + (by - 44) + 'L' + xp.toFixed(1) + ' ' + (by - 4) + 'M' + (xp - 4).toFixed(1) + ' ' + (by - 10) + 'L' + xp.toFixed(1) + ' ' + (by - 4) + 'L' + (xp + 4).toFixed(1) + ' ' + (by - 10) + '"/>' + gtxt([xp + 6, by - 34], 'P', 'gv'); }
  if (wl) { let d = ''; for (let i = 0; i <= 12; i++) { const xx = x0 + (x1 - x0) * i / 12; d += 'M' + xx.toFixed(1) + ' ' + (by - 24) + 'L' + xx.toFixed(1) + ' ' + (by - 4); } s += '<path class="gk" d="M' + x0 + ' ' + (by - 24) + 'L' + x1 + ' ' + (by - 24) + d + '"/>' + gtxt([x1 - 10, by - 28], 'w', 'gv'); }
  s += '<path class="gb" d="M' + x0 + ' ' + my + 'L' + x1 + ' ' + my + '"/>';
  s += '<path class="gc" d="M' + x0 + ' ' + my + ms.map((m, i) => 'L' + X(L * i / N).toFixed(1) + ' ' + (my - 40 * m / mmax).toFixed(1)).join('') + 'L' + x1 + ' ' + my + '"/>';
  s += gtxt([x0, 16], 'Deflected shape (exaggerated)', 'gs') + gtxt([x0, 136], 'Bending moment (sagging up, hogging down)', 'gs');
  return gsvg(w, h, s, 'Beam, deflected shape and bending moment');
}

// Column curve: critical stress against slenderness (Johnson then Euler) with the column's point.
function mkColumnSvg(e, sy, lam) {
  const W = state.W;
  if (!(e > 0 && sy > 0 && lam > 0)) return '';
  const lt = Math.sqrt(2 * Math.PI * Math.PI * e / sy), lmax = Math.max(2.2 * lt, 1.2 * lam);
  const w = 440, h = 230, x0 = 46, x1 = 420, y0 = 200, y1 = 20;
  const X = l => x0 + (x1 - x0) * l / lmax, Y = sg => y0 - (y0 - y1) * sg / sy;
  const cur = (f, a, b) => { let d = ''; for (let i = 0; i <= 60; i++) { const l = a + (b - a) * i / 60, v = Math.min(f(l), sy * 1.05); d += (i ? 'L' : 'M') + X(l).toFixed(1) + ' ' + Y(v).toFixed(1); } return d; };
  let s = '<path class="gb" d="M' + x0 + ' ' + y1 + 'L' + x0 + ' ' + y0 + 'L' + x1 + ' ' + y0 + '"/>';
  s += '<path class="grap" d="' + cur(l => W.mech_euler_stress(e, l), lt * 0.55, lt) + '"/>';
  s += '<path class="gp" d="' + cur(l => W.mech_johnson_stress(e, sy, l), 0, lt) + cur(l => W.mech_euler_stress(e, l), lt, lmax).replace('M', 'L') + '"/>';
  const sc = lam < lt ? W.mech_johnson_stress(e, sy, lam) : W.mech_euler_stress(e, lam);
  s += '<circle class="gdot" cx="' + X(lam).toFixed(1) + '" cy="' + Y(sc).toFixed(1) + '" r="4"/>';
  s += '<path class="gk" d="M' + X(lt).toFixed(1) + ' ' + y0 + 'L' + X(lt).toFixed(1) + ' ' + y1 + '"/>';
  s += gtxt([x0 + 4, 13], 'critical stress (top = Sy)', 'gs') + gtxt([X(lt) + 4, y1 + 26], 'transition', 'gs') + gtxt([X(lt * 0.25), Y(sy * 0.72)], 'Johnson', 'gs') + gtxt([X(lt * 1.4), Y(sy * 0.32)], 'Euler', 'gs') + gtxt([x1 - 90, y0 + 20], 'slenderness KL/r', 'gs');
  return gsvg(w, h, s, 'Column curve: critical stress against slenderness');
}

// Fatigue (Haigh) diagram: Goodman, Soderberg and Gerber lines, yield line and the working point.
function mkFatigueSvg(se, sut, sy, sa, sm) {
  if (!(se > 0 && sut > 0 && sy > 0)) return '';
  const w = 440, h = 240, x0 = 46, x1 = 420, y0 = 205, y1 = 20, mx = sut * 1.05, my = Math.max(se, sy) * 1.1;
  const X = m => x0 + (x1 - x0) * m / mx, Y = a => y0 - (y0 - y1) * a / my, pt = (m, a) => X(m).toFixed(1) + ' ' + Y(a).toFixed(1);
  let s = '<path class="gb" d="M' + x0 + ' ' + y1 + 'L' + x0 + ' ' + y0 + 'L' + x1 + ' ' + y0 + '"/>';
  s += '<path class="gp" d="M' + pt(0, se) + 'L' + pt(sut, 0) + '"/>';
  s += '<path class="grap" d="M' + pt(0, se) + 'L' + pt(sy, 0) + '"/>';
  let g = ''; for (let i = 0; i <= 40; i++) { const m = sut * i / 40; g += (i ? 'L' : 'M') + pt(m, se * (1 - (m / sut) ** 2)); }
  s += '<path class="gk" d="' + g + '"/>';
  s += '<path class="gw" d="M' + pt(0, sy) + 'L' + pt(sy, 0) + '"/>';
  if (sa >= 0 && isFinite(sm) && sm >= 0 && sm <= mx && sa <= my) s += '<path class="gm" d="M' + pt(0, 0) + 'L' + pt(sm, sa) + '"/><circle class="gdot" cx="' + X(sm).toFixed(1) + '" cy="' + Y(sa).toFixed(1) + '" r="4"/>';
  s += gtxt([x0 + 4, Y(se) - 4], 'Se', 'gs') + gtxt([X(sut) - 18, y0 + 16], 'Sut', 'gs') + gtxt([X(sy) - 10, y0 + 16], 'Sy', 'gs') + gtxt([x0 + 4, Y(sy) - 4], 'Sy (yield)', 'gs');
  s += gtxt([x1 - 170, y1 + 4], 'solid: Goodman', 'gs') + gtxt([x1 - 170, y1 + 18], 'blue dashed: Gerber', 'gs') + gtxt([x1 - 170, y1 + 32], 'grey dashed: Soderberg', 'gs') + gtxt([x1 - 170, y1 + 46], 'amber: first-cycle yield', 'gs') + gtxt([x1 - 110, y0 + 30], 'mean stress', 'gs') + gtxt([x0 - 40, y1 - 6], 'alternating', 'gs');
  return gsvg(w, h, s, 'Fatigue diagram: alternating against mean stress');
}

// Critical speed: discs from the fields into the shared buffer (x m, mass kg).
function mkCritDiscs(v, s) {
  const lk = s === 'inch' ? 0.0254 : 0.001, mk = s === 'inch' ? MK_LB_KG : 1, out = [];
  [1, 2, 3].forEach(i => { const m = v['m' + i], x = v['x' + i]; if (m > 0 && x >= 0) out.push(x * lk, m * mk); });
  const W = state.W, buf = new Float64Array(W.memory.buffer, W.buf_ptr(), out.length || 1);
  out.forEach((q, i) => { buf[i] = q; });
  return out.length / 2;
}
