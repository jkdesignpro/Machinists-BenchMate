'use strict';
// Drawings for the small milling and turning calculators (tools.js `diagram`).
// Each returns SVG markup in the shared `geo` style (geometry.js helpers gsvg,
// gtxt, gpt). Drawings are schematic or to the scale noted on them; every number
// shown in the results comes from the Rust core.

const MTW = 440, MTH = 230;
const mtArc = pts => pts.length ? 'M' + pts.map(gpt).join('L') : '';
const mtArrow = (a, b, cls) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, h = 7;
  return '<path class="' + (cls || 'gm') + '" d="M' + gpt(a) + 'L' + gpt(b) + 'M' + gpt(b) + 'L' + gpt([b[0] - h * ux + h * 0.45 * uy, b[1] - h * uy - h * 0.45 * ux]) + 'M' + gpt(b) + 'L' + gpt([b[0] - h * ux - h * 0.45 * uy, b[1] - h * uy + h * 0.45 * ux]) + '"/>';
};

// Top view of a tool cutting a wall: mode 0 straight, 1 inside corner, -1 outside (boss).
function mtEngageSvg(d, ae, Rw, mode) {
  if (!(d > 0 && ae > 0)) return '';
  const r = d / 2;
  if (mode === 1 && !(Rw > r)) return '';
  if (mode !== 0 && !(Rw > 0)) return '';
  // World: tool centre at the origin, feed along +x, finished wall below the tool.
  const k = (MTH / 2 - 18) / (1.7 * r), cx = MTW / 2, cy = MTH / 2 - 10;
  const P = p => [cx + p[0] * k, cy - p[1] * k];
  const C = mode === 1 ? [0, Rw - r] : mode === -1 ? [0, -(Rw + r)] : null;
  const inStock = p => mode === 0 ? p[1] < -r + ae : mode === 1 ? Math.hypot(p[0] - C[0], p[1] - C[1]) > Rw - ae : Math.hypot(p[0] - C[0], p[1] - C[1]) < Rw + ae;
  let s = '';
  const circ = (c, rad, cls) => '<circle class="' + cls + '" cx="' + P(c)[0].toFixed(1) + '" cy="' + P(c)[1].toFixed(1) + '" r="' + (rad * k).toFixed(1) + '"/>';
  if (mode === 0) {
    s += '<path class="gp" d="M' + gpt(P([-2.2 * r, -r])) + 'L' + gpt(P([2.2 * r, -r])) + '"/>';
    s += '<path class="grap" d="M' + gpt(P([0, -r + ae])) + 'L' + gpt(P([2.2 * r, -r + ae])) + '"/>';
  } else {
    s += circ(C, Rw, 'gp');
    s += circ(C, mode === 1 ? Math.max(Rw - ae, 0) : Rw + ae, 'grap');
  }
  s += circ([0, 0], r, 'gc');
  const arc = [];
  for (let i = 0; i <= 720; i++) { const a = -Math.PI / 2 + Math.PI * i / 720; const p = [r * Math.cos(a), r * Math.sin(a)]; if (p[0] >= -1e-9 && inStock(p)) arc.push(P(p)); }
  // the engaged arc runs from the bottom of the tool forward; keep only the run that starts there
  s += '<path class="gw" stroke-width="3" d="' + mtArc(arc) + '"/>';
  s += '<circle class="gdot" cx="' + cx + '" cy="' + cy + '" r="2.5"/>';
  s += mtArrow(P([-1.5 * r, 0.25 * r]), P([-0.6 * r, 0.25 * r]));
  s += gtxt([P([-1.5 * r, 0.25 * r])[0], P([0, 0.25 * r])[1] - 6], 'feed', 'gs');
  s += gtxt([10, MTH - 26], mode === 0 ? 'finished wall, previous wall (dashed)' : mode === 1 ? 'inside corner: finished wall R, previous R - ae (dashed)' : 'outside arc: finished wall R, previous R + ae (dashed)', 'gs');
  s += gtxt([10, MTH - 10], 'tool engaged on the heavy arc; drawn to scale', 'gs');
  return gsvg(MTW, MTH, s, 'Tool engagement on the wall');
}

// Schematic of three ball-nose passes and the cusp between them.
function mtCuspSvg(d, st) {
  if (!(d > 0)) return '';
  const R = 70, s = 95, base = 190, cx0 = MTW / 2 - s;
  let p = '';
  for (let i = 0; i < 3; i++) p += '<circle class="gm" cx="' + (cx0 + i * s) + '" cy="' + (base - R) + '" r="' + R + '"/>';
  const prof = [];
  for (let x = cx0 - s / 2; x <= cx0 + 2.5 * s; x += 1) { const c = cx0 + Math.round((x - cx0) / s) * s; const dx = x - c; prof.push([x, base - (R - Math.sqrt(Math.max(R * R - dx * dx, 0)))]); }
  p += '<path class="gp" d="' + mtArc(prof) + '"/>';
  const h = R - Math.sqrt(R * R - s * s / 4), xc = cx0 + s / 2;
  p += '<path class="gk" d="M' + (xc - 25) + ' ' + base + 'L' + (xc + 25) + ' ' + base + '"/>';
  p += '<path class="gc" d="M' + xc + ' ' + (base - h) + 'L' + xc + ' ' + base + '"/>';
  p += gtxt([xc + 6, base - h / 2 + 4], 'h', 'gv');
  p += mtArrow([cx0, base + 16], [cx0 + s, base + 16], 'gm') + gtxt([cx0 + s / 2 - 4, base + 32], 's', 'gv');
  p += '<path class="gm" d="M' + (cx0 + s * 2 - R) + ' ' + (base - R) + 'L' + (cx0 + s * 2 + R) + ' ' + (base - R) + '"/>' + gtxt([cx0 + 2 * s - 6, base - R - 6], 'D', 'gv');
  p += gtxt([10, 16], 'schematic: stepover s, cusp height h, ball diameter D', 'gs');
  return gsvg(MTW, 240, p, 'Ball-nose cusp');
}

// Ball-nose tool at depth ap, tilted beta from the surface normal: band in cut and De.
function mtBallSvg(d, ap, tilt) {
  if (!(d > 0 && ap > 0) || !(tilt >= 0 && tilt < 90)) return '';
  const R = 70, a = Math.min(ap / d, 1) * 2 * R, b = tilt * Math.PI / 180, bot = 200, cx = MTW / 2;
  const C = [cx, bot - R], ax = [Math.sin(b), -Math.cos(b)], pr = [Math.cos(b), Math.sin(b)];
  let s = '<path class="gsoft" d="M10 ' + (bot - a) + 'L' + (MTW - 10) + ' ' + (bot - a) + 'L' + (MTW - 10) + ' ' + (bot + 20) + 'L10 ' + (bot + 20) + 'Z"/>';
  s += '<path class="gp" d="M10 ' + bot + 'L' + (MTW - 10) + ' ' + bot + '"/>';
  // shank from the equator, along the tilted axis
  const e1 = [C[0] + R * pr[0], C[1] + R * pr[1]], e2 = [C[0] - R * pr[0], C[1] - R * pr[1]], up = 100;
  s += '<path class="gp" d="M' + gpt(e1) + 'L' + gpt([e1[0] + up * ax[0], e1[1] + up * ax[1]]) + 'M' + gpt(e2) + 'L' + gpt([e2[0] + up * ax[0], e2[1] + up * ax[1]]) + '"/>';
  s += '<path class="grap" d="M' + gpt([C[0] - 95 * ax[0], C[1] - 95 * ax[1]]) + 'L' + gpt([C[0] + 160 * ax[0], C[1] + 160 * ax[1]]) + '"/>';
  // lower half of the ball (the side away from the shank)
  const half = []; for (let i = 0; i <= 180; i++) { const t = b + Math.PI * i / 180; half.push([C[0] + R * Math.cos(t), C[1] + R * Math.sin(t)]); }
  s += '<path class="gp" d="' + mtArc(half) + '"/>';
  // band in cut: ball points below the stock top; De chord at the point farthest from the axis
  const band = half.filter(p => p[1] >= bot - a - 1e-9);
  s += '<path class="gw" stroke-width="3" d="' + mtArc(band) + '"/>';
  let best = null, dist = -1;
  band.forEach(p => { const v = [p[0] - C[0], p[1] - C[1]], dd = Math.abs(v[0] * pr[0] + v[1] * pr[1]); if (dd > dist) { dist = dd; best = p; } });
  if (best) {
    const v = [best[0] - C[0], best[1] - C[1]], along = v[0] * ax[0] + v[1] * ax[1], foot = [C[0] + along * ax[0], C[1] + along * ax[1]];
    s += '<path class="gc" d="M' + gpt([foot[0] - dist * pr[0], foot[1] - dist * pr[1]]) + 'L' + gpt([foot[0] + dist * pr[0], foot[1] + dist * pr[1]]) + '"/>';
    s += gtxt([foot[0] + dist * pr[0] + 6, foot[1] + dist * pr[1] - 4], 'De', 'gv');
  }
  s += gtxt([14, bot - a - 6], 'stock top', 'gs') + gtxt([14, bot + 14], 'machined surface (ap below)', 'gs');
  s += gtxt([MTW - 10, 16], 'to scale; heavy arc = edge in the cut', 'gs', 'end');
  return gsvg(MTW, MTH, s, 'Ball-nose effective diameter');
}

// Side view of a boring bar as a cantilever with the tip force (deflection exaggerated).
function mtBarSvg(d, L, di) {
  if (!(d > 0 && L > 0)) return '';
  const x0 = 70, len = 300, ld = Math.min(L / d, 30), h = Math.max(8, Math.min(60, len / ld)), cy = 95;
  let s = '<rect class="gsoft" x="20" y="' + (cy - 55) + '" width="' + (x0 - 20) + '" height="110"/>';
  s += '<rect class="gp" x="' + x0 + '" y="' + (cy - h / 2) + '" width="' + len + '" height="' + h + '"/>';
  if (di > 0 && di < d) { const hi = h * di / d; s += '<path class="grap" d="M' + x0 + ' ' + (cy - hi / 2) + 'L' + (x0 + len) + ' ' + (cy - hi / 2) + 'M' + x0 + ' ' + (cy + hi / 2) + 'L' + (x0 + len) + ' ' + (cy + hi / 2) + '"/>'; }
  const curve = []; for (let i = 0; i <= 40; i++) { const x = i / 40; curve.push([x0 + x * len, cy + 24 * x * x * (3 - x) / 2]); }
  s += '<path class="gk" d="' + mtArc(curve) + '"/>';
  s += mtArrow([x0 + len - 4, cy - h / 2 - 34], [x0 + len - 4, cy - h / 2 - 4], 'gc') + gtxt([x0 + len + 4, cy - h / 2 - 20], 'Fc', 'gv');
  s += mtArrow([x0 + 4, cy + 72], [x0 + len, cy + 72], 'gm') + gtxt([x0 + len / 2, cy + 88], 'L (overhang)', 'gs', 'middle');
  s += gtxt([x0 + len + 8, cy + 4], 'd', 'gv') + gtxt([24, cy + 72], 'holder', 'gs');
  s += gtxt([10, 16], 'L/D drawn to scale (up to 30 x D); dashed: bent centreline, exaggerated', 'gs');
  return gsvg(MTW, 210, s, 'Boring bar cantilever');
}

// Spot drill or centre drill section with the chamfer diameter and the depth from the tip.
function mtSpotSvg(mode, dc, ang, dp, lp) {
  if (!(dc > 0 && ang > 0 && ang < 180)) return '';
  const top = 40, cx = MTW / 2, hk = Math.tan(ang * Math.PI / 360);
  const centre = mode === 2 && dp > 0 && lp >= 0 && dc > dp;
  const zc = centre ? lp + (dc - dp) / 2 / hk : dc / 2 / hk;
  const k = Math.min(150 / Math.max(zc, 1e-9), 160 / dc), P = (x, z) => [cx + x * k, top + z * k];
  let s = '<path class="gsoft" d="M10 ' + top + 'L' + (MTW - 10) + ' ' + top + 'L' + (MTW - 10) + ' ' + (MTH - 10) + 'L10 ' + (MTH - 10) + 'Z"/>';
  let pts;
  if (centre) {
    const zt = Math.min(lp, dp / 2 / Math.tan(59 * Math.PI / 180)); // pilot point drawn at 118 deg, schematic
    pts = [P(-dc / 2, 0), P(-dp / 2, zc - lp), P(-dp / 2, zc - zt), P(0, zc), P(dp / 2, zc - zt), P(dp / 2, zc - lp), P(dc / 2, 0)];
  } else pts = [P(-dc / 2, 0), P(0, zc), P(dc / 2, 0)];
  s += '<path class="gacc" d="M' + pts.map(gpt).join('L') + 'Z"/>';
  s += '<path class="gp" d="M10 ' + top + 'L' + (MTW - 10) + ' ' + top + '"/>';
  s += mtArrow([P(-dc / 2, 0)[0], top - 10], [P(dc / 2, 0)[0], top - 10], 'gm') + mtArrow([P(dc / 2, 0)[0], top - 10], [P(-dc / 2, 0)[0], top - 10], 'gm') + gtxt([cx, top - 16], 'Dc', 'gv', 'middle');
  const xr = dc / 2 + 0.15 * dc;
  s += '<path class="gm" d="M' + gpt(P(xr, 0)) + 'L' + gpt(P(xr, zc)) + 'M' + gpt(P(0, zc)) + 'L' + gpt(P(xr + 0.05 * dc, zc)) + '"/>' + gtxt([P(xr, 0)[0] + 6, P(0, zc / 2)[1]], 'z', 'gv');
  if (centre) s += gtxt([P(-dp / 2, 0)[0] - 8, P(0, zc - lp / 2)[1]], 'l', 'gv', 'end');
  s += gtxt([14, MTH - 16], (centre ? 'centre drill (pilot point schematic)' : 'pointed tool') + ', included angle ' + ang + ' deg, to scale', 'gs');
  return gsvg(MTW, MTH, s, 'Spot or centre drill depth');
}
