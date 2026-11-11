'use strict';
// Gears and splines: drawings for the gear tools in tools.js. The tooth
// outline (true involute from the base circle to the tip) is computed in the
// Rust core (gear_tooth); this file only places it and draws the circles.

// Module in the current length unit from the pitch field: inch mode takes a
// diametral pitch P (teeth per inch of pitch diameter), so m = 1 / P inch.
function gearMod(mp, sys) { return sys === 'inch' ? (mp > 0 ? 1 / mp : NaN) : mp; }

// Three teeth of an external gear with its tip, reference, base and root
// circles (arcs over the drawn sector). Returns SVG markup or ''.
function gearToothSvg(m, z, alpha, x, haK, hfK, label) {
  const W = state.W;
  if (!(m > 0 && z >= 5 && z <= 400 && alpha > 0 && alpha < 45)) return '';
  const g = i => W.gear_spur(m, z, alpha, x, haK, hfK, i);
  const d = g(0), db = g(1), da = g(2), df = g(3), s = g(9);
  if (!(df > 0 && da > df && s > 0)) return '';
  const n = W.gear_tooth(d, db, da, df, s, 40);
  if (!(n > 8)) return '';
  const one = []; for (let i = 0; i < n; i += 2) one.push([W.list_out(i), W.list_out(i + 1)]);
  const step = 2 * Math.PI / z, rot = (p, a) => [p[0] * Math.cos(a) + p[1] * Math.sin(a), -p[0] * Math.sin(a) + p[1] * Math.cos(a)];
  const teeth = [-1, 0, 1].map(k => one.map(p => rot(p, k * step)));
  const span = 1.6 * step, ra = da / 2, rf = df / 2;
  const arcPts = r => { const o = []; for (let i = 0; i <= 40; i++) { const t = -span + 2 * span * i / 40; o.push([r * Math.sin(t), r * Math.cos(t)]); } return o; };
  const all = teeth.flat().concat(arcPts(ra), arcPts(rf));
  const w = 420, h = 250, mp = gfit(all, w, h, 22);
  const path = pts => pts.map((p, i) => (i ? 'L' : 'M') + gpt(mp.P(p))).join('');
  // Root arcs between the teeth.
  let body = '';
  const rootSeg = (a0, a1) => { const o = []; for (let i = 0; i <= 8; i++) { const t = a0 + (a1 - a0) * i / 8; o.push([rf * Math.sin(t), rf * Math.cos(t)]); } return o; };
  const startAng = p => Math.atan2(p[0], p[1]);
  let outline = [];
  const first = teeth[0][0];
  outline.push(...rootSeg(-span, startAng(first)));
  teeth.forEach((t, k) => {
    outline.push(...t);
    if (k < 2) outline.push(...rootSeg(startAng(t[t.length - 1]), startAng(teeth[k + 1][0])));
  });
  outline.push(...rootSeg(startAng(teeth[2][teeth[2].length - 1]), span));
  const circ = (r, cls) => '<path class="' + cls + '" d="' + path(arcPts(r)) + '"/>';
  body += circ(db / 2, 'grap') + circ(d / 2, 'gk');
  body += '<path class="gp" d="' + path(outline) + '"/>';
  const lab = (r, t) => { const q = mp.P([r * Math.sin(span), r * Math.cos(span)]); return gtxt([q[0] + 4, q[1] + 4], t, 'gs'); };
  body += lab(ra, 'tip') + lab(d / 2, 'reference') + lab(db / 2, 'base') + lab(rf, 'root');
  return gsvg(w, h, body, label || 'Involute gear teeth');
}
