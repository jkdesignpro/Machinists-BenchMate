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

// Critical speed: discs from the fields into the shared buffer (x m, mass kg).
function mkCritDiscs(v, s) {
  const lk = s === 'inch' ? 0.0254 : 0.001, mk = s === 'inch' ? MK_LB_KG : 1, out = [];
  [1, 2, 3].forEach(i => { const m = v['m' + i], x = v['x' + i]; if (m > 0 && x >= 0) out.push(x * lk, m * mk); });
  const W = state.W, buf = new Float64Array(W.memory.buffer, W.buf_ptr(), out.length || 1);
  out.forEach((q, i) => { buf[i] = q; });
  return out.length / 2;
}
