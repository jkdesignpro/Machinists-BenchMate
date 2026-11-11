'use strict';
// Engineering drawings for the thread, gear, GD&T, sheet-metal, coolant and
// mechanics calculators, in the drawing-kit style (dk.js). One function per tool
// id: DIAGRAMS[id] = (v, sys, rows) => SVG markup or ''. Every number written on
// a drawing comes from the inputs (v) or the result rows computed by the core;
// the JS here only works out drawing geometry (involute outlines, positions).

// ---------- shared helpers (prefix de) ----------
const deU = s => (s === 'inch' ? 'in' : 'mm');
const deDp = s => (s === 'inch' ? 4 : 3);
const deClamp = (x, a, b) => Math.max(a, Math.min(b, x));
const deF = v => (Math.round(v * 100) / 100).toString();
const deFin = x => typeof x === 'number' && isFinite(x);
// Result row by label (string: label contains it; RegExp: label matches).
function deRow(rows, re) { return (rows || []).find(r => r && typeof r.label === 'string' && (typeof re === 'string' ? r.label.indexOf(re) >= 0 : re.test(r.label))); }
function deV(rows, re) { const r = deRow(rows, re); return r && typeof r.value === 'number' && isFinite(r.value) ? r.value : NaN; }
// A row's value as label text, "12.345 mm", with its own decimals.
function deT(rows, re, unit) {
  const r = deRow(rows, re); if (!r || typeof r.value !== 'number' || !isFinite(r.value)) return '';
  const u = unit !== undefined ? unit : r.unit;
  return DK.n(r.value, r.dp) + (u ? (u === ': 1' ? ' : 1' : ' ' + u) : '');
}
// An input value as label text (or the fallback symbol when blank).
const deIn = (x, dp, unit, sym) => (deFin(x) ? DK.n(x, dp) + (unit ? ' ' + unit : '') : (sym || '?'));
const deLines = (x, y, lines, o) => lines.filter(Boolean).map((l, i) => DK.text(x, y + i * 15, l, Object.assign({ anchor: 'start', cls: 'mut' }, o || {}))).join('');
// Arrowhead (same shape as DK's) and arrows in any line class.
const DE_FILL = { ln: 'txt', thin: 'mut', hot: 'hotf', dim: 'dimf', tool: 'hotf' };
function deHead(x, y, ang, fcls) {
  const L = 8, W = 2.6, c = Math.cos(ang), s = Math.sin(ang), bx = x - L * c, by = y - L * s;
  return '<path class="' + fcls + '" d="M' + deF(x) + ' ' + deF(y) + 'L' + deF(bx - W * s) + ' ' + deF(by + W * c) + 'L' + deF(bx + W * s) + ' ' + deF(by - W * c) + 'Z"/>';
}
function deArrow(x1, y1, x2, y2, cls) {
  cls = cls || 'ln'; const a = Math.atan2(y2 - y1, x2 - x1);
  return DK.line(x1, y1, x2 - 5 * Math.cos(a), y2 - 5 * Math.sin(a), cls) + deHead(x2, y2, a, DE_FILL[cls] || 'txt');
}
// Circular arc as path data, angles in degrees anticlockwise from +x on screen.
function deArcD(cx, cy, r, a0, a1) {
  const t0 = a0 * Math.PI / 180, t1 = a1 * Math.PI / 180;
  return 'M' + deF(cx + r * Math.cos(t0)) + ' ' + deF(cy - r * Math.sin(t0)) + 'A' + deF(r) + ' ' + deF(r) + ' 0 ' + (Math.abs(a1 - a0) > 180 ? 1 : 0) + ' ' + (a1 > a0 ? 0 : 1) + ' ' + deF(cx + r * Math.cos(t1)) + ' ' + deF(cy - r * Math.sin(t1));
}
// Rotation arrow: arc from a0 to a1 with a head at a1.
function deRot(cx, cy, r, a0, a1, cls) {
  cls = cls || 'ln'; const t = a1 * Math.PI / 180, dir = a1 > a0 ? 1 : -1;
  const ang = Math.atan2(-Math.cos(t) * dir, -Math.sin(t) * dir);
  return DK.path(deArcD(cx, cy, r, a0, a1 - dir * 4 * 180 / Math.PI / r), cls) + deHead(cx + r * Math.cos(t), cy - r * Math.sin(t), ang, DE_FILL[cls] || 'txt');
}
const dePoly = (pts, cls, closed) => '<path class="' + (cls || 'part') + '" d="M' + pts.map(p => deF(p[0]) + ' ' + deF(p[1])).join('L') + (closed === false ? '' : 'Z') + '"/>';
const deClip = (id, w, h, body) => '<clipPath id="' + id + '"><rect x="0" y="0" width="' + w + '" height="' + h + '"/></clipPath><g clip-path="url(#' + id + ')">' + body + '</g>';
// Ground (support) symbols: a hatched strip under a line from x1 to x2 at y.
function deGround(x1, x2, y, down) {
  const d = down === false ? -1 : 1;
  let h = DK.line(x1, y, x2, y, 'ln');
  for (let x = x1 + 3; x < x2; x += 7) h += DK.line(x, y + d * 1, x - 6, y + d * 8, 'thin');
  return h;
}
function deWall(x, y1, y2, left) { // fixed end: thick line with hatching on the outside
  const d = left ? -1 : 1; let h = DK.line(x, y1, x, y2, 'ln');
  for (let y = y1 + 3; y < y2; y += 7) h += DK.line(x + d, y, x + d * 8, y + 6, 'thin');
  return h;
}
const dePinSup = (x, y) => dePoly([[x, y], [x - 9, y + 14], [x + 9, y + 14]], 'part') + deGround(x - 14, x + 14, y + 14);
const deRollSup = (x, y) => dePoly([[x, y], [x - 9, y + 12], [x + 9, y + 12]], 'part') + DK.circle(x - 5, y + 15, 3, 'ln') + DK.circle(x + 5, y + 15, 3, 'ln') + deGround(x - 14, x + 14, y + 18);
// Vertical dimension between yA and yB at x (either order), extension lines from o.from; text reads upwards on the left.
const deDimV = (yA, yB, x, text, o) => DK.dimV(Math.max(yA, yB), Math.min(yA, yB), x, text, o);
// Points of a cut edge with a break zig-zag, from x2 back to x1 at y (to close a polygon).
const deCutPts = (x1, x2, y) => { const m = (x1 + x2) / 2; return [[x2, y], [m + 6, y], [m + 2, y + 6], [m - 2, y - 6], [m - 6, y], [x1, y]]; };
// Break line (zig-zag) across a shape, horizontal from x1 to x2 at y.
function deBreak(x1, x2, y) {
  const m = (x1 + x2) / 2;
  return dePoly([[x1 - 4, y], [m - 6, y], [m - 2, y - 6], [m + 2, y + 6], [m + 6, y], [x2 + 4, y]], 'thin', false);
}

// ---------- involute gear outline ----------
const deInv = a => Math.tan(a) - a;
// Outline of an external (or, o.internal, an internal) involute gear as path data.
// m module and radii in drawing units, s px per unit, rot = angle of tooth 0 (rad, anticlockwise).
// o: x profile shift, ha, hf factors, or explicit ra (tip) and rf (root) radii, psi = half tooth angle at the pitch circle.
function deGear(cx, cy, s, m, z, alphaDeg, o) {
  o = o || {};
  const al = alphaDeg * Math.PI / 180, x = o.x || 0, ha = o.ha > 0 ? o.ha : 1, hf = o.hf > 0 ? o.hf : 1.25, rot = o.rot || 0, inn = !!o.internal;
  const r = m * z / 2, rb = r * Math.cos(al), pitch = 2 * Math.PI / z;
  const ra = o.ra > 0 ? o.ra : (inn ? r - (ha - x) * m : r + (ha + x) * m);
  const rf = o.rf > 0 ? o.rf : (inn ? r + (hf + x) * m : Math.max(r - (hf - x) * m, 0.2 * r));
  const psi = o.psi > 0 ? o.psi : (Math.PI / 2 + 2 * x * Math.tan(al)) / z; // half tooth (external) or half space (internal)
  const th = ry => {
    const ay = Math.acos(rb / Math.max(ry, rb)), e = psi + deInv(al) - deInv(ay);
    return deClamp(inn ? pitch / 2 - e : e, 0.002, pitch / 2 - 0.002);
  };
  const N = 9, rad = [];
  for (let i = 0; i <= N; i++) rad.push(rf + (ra - rf) * i / N);
  if ((rb - rf) * (rb - ra) < 0) { rad.push(rb); rad.sort((a, b) => inn ? b - a : a - b); }
  const P = (R, a) => deF(cx + R * s * Math.cos(a)) + ' ' + deF(cy - R * s * Math.sin(a));
  const pts = [];
  for (let k = 0; k < z; k++) {
    const c = rot + k * pitch;
    rad.forEach(R => pts.push(P(R, c - th(R))));
    const tt = th(ra); for (let j = 1; j < 3; j++) pts.push(P(ra, c - tt + 2 * tt * j / 3));
    for (let i = rad.length - 1; i >= 0; i--) pts.push(P(rad[i], c + th(rad[i])));
    const t0 = c + th(rf), t1 = c + pitch - th(rf);
    for (let j = 1; j < 4; j++) pts.push(P(rf, t0 + (t1 - t0) * j / 4));
  }
  return { d: 'M' + pts.join('L') + 'Z', r, rb, ra, rf };
}
const deGearPath = (g, cls) => '<path class="' + (cls || 'part') + '" d="' + g.d + '"/>';
// A ring (internal gear) body: outer circle plus the toothed bore, filled between.
const deRing = (cx, cy, Rpx, g, cls) => '<path class="' + (cls || 'part') + '" fill-rule="evenodd" d="M' + deF(cx + Rpx) + ' ' + deF(cy) + 'A' + deF(Rpx) + ' ' + deF(Rpx) + ' 0 1 0 ' + deF(cx - Rpx) + ' ' + deF(cy) + 'A' + deF(Rpx) + ' ' + deF(Rpx) + ' 0 1 0 ' + deF(cx + Rpx) + ' ' + deF(cy) + 'Z' + g.d + '"/>';
const deCross = (x, y, r) => DK.cl(x - r, y, x + r, y) + DK.cl(x, y - r, x, y + r);

// Thread form data for the wire drawing: flank half-angle, crest height and root depth from the pitch line (x P).
const DE_FORMS = { 60: [30, 0.324760, 0.216506, '60° UN / ISO metric'], 55: [27.5, 0.320163, 0.320163, '55° Whitworth'], 29: [14.5, 0.25, 0.25, '29° ACME'], 30: [15, 0.25, 0.25, '30° trapezoidal'], 291: [14.5, 0.15, 0.15, '29° Stub ACME'] };

Object.assign(DIAGRAMS, {
  // Three-wire measurement: the thread in axial section to scale, wires seated on the flanks, anvils and M.
  wires(v, sys, rows) {
    const W = 520, H = 300, u = deU(sys), F = DE_FORMS[v.form] || DE_FORMS[60];
    if (!(v.major > 0 && v.pitch > 0)) return '';
    const P = sys === 'inch' ? 1 / v.pitch : v.pitch, E = deV(rows, /itch diameter/), best = deV(rows, 'Best wire'), M = deV(rows, 'over three wires');
    if (!(E > 0)) return '';
    const w = v.wire > 0 ? v.wire : best, hh = F[0] * Math.PI / 180, c = F[1] * P, d = F[2] * P;
    const wd = deClamp(w, 0.05 * P, 1.3 * P), x0 = 64, x1 = 336;
    const hc = (wd / 2) / Math.sin(hh) - (P / 4) / Math.tan(hh); // wire centre above the pitch line
    const s = Math.min(74 / P, 52 / Math.max(c, hc + wd / 2));
    const top = Math.max(c, hc + wd / 2), gap = deClamp(E * s, 60, 104), broken = E * s > 104;
    const yT = 34 + top * s, yB = yT + gap; // pitch lines of the upper and lower flank
    // Profile: y offset (units, + outward) at axial position t (units), groove centres at t = k P.
    // Whitworth: crest and root arcs of radius 0.137329 P tangent to the flanks.
    const rho = F[0] === 27.5 ? 0.137329 * P : 0, apex = P / (4 * Math.tan(hh)) - rho / Math.sin(hh), rq = rho * Math.cos(hh);
    const prof = t => {
      let q = ((t % P) + P) % P; q = Math.min(q, P - q);
      if (rho > 0) { if (P / 2 - q < rq) return apex + Math.sqrt(rho * rho - (P / 2 - q) ** 2); if (q < rq) return -apex - Math.sqrt(rho * rho - q * q); return (q - P / 4) / Math.tan(hh); }
      return deClamp((q - P / 4) / Math.tan(hh), -d, c);
    };
    const edge = (yp, sg, ph) => { const pts = []; for (let X = x0; X <= x1 + 0.1; X += 1) pts.push([X, yp - sg * prof((X - x0) / s + ph) * s]); return pts; };
    const up = edge(yT, 1, 0), lo = edge(yB, -1, P / 2);
    let h = '';
    if (broken) {
      const mid = (yT + yB) / 2;
      h += dePoly(up.concat(deCutPts(x0, x1, mid - 6)), 'hatch') + dePoly(lo.concat(deCutPts(x0, x1, mid + 6)), 'hatch');
    } else h += dePoly(up.concat(lo.slice().reverse()), 'hatch');
    h += DK.cl(x0 - 18, yT, x1 + 18, yT) + DK.cl(x0 - 18, yB, x1 + 18, yB);
    // Wires: two in adjacent grooves on top, one opposite.
    const gx = [1, 2].map(k => x0 + k * P * s), bx = x0 + 1.5 * P * s;
    const ytop = yT - (hc + wd / 2) * s, ybot = yB + (hc + wd / 2) * s;
    gx.forEach(X => { h += DK.circle(X, yT - hc * s, wd / 2 * s, 'tool') + DK.circle(X, yT - hc * s, 1.6, 'hotf'); });
    h += DK.circle(bx, yB + hc * s, wd / 2 * s, 'tool') + DK.circle(bx, yB + hc * s, 1.6, 'hotf');
    // Micrometer anvils.
    h += DK.rect(gx[0] - wd * s / 2 - 10, ytop - 12, gx[1] - gx[0] + wd * s + 20, 12, 'ghost') + DK.rect(bx - wd * s / 2 - 10, ybot, wd * s + 20, 12, 'ghost');
    const xd = x1 + 40;
    h += deDimV(ytop, ybot, xd, 'M ' + (deFin(M) ? DK.n(M, 4) + ' ' + u : ''), { hot: true, from: gx[1] + wd * s / 2 + 10 });
    h += deDimV(yT, yB, x0 - 34, 'E ' + DK.n(E, 4), { from: x0 - 18 });
    h += DK.dimH(x0 + 2.5 * P * s, x0 + 3.5 * P * s, Math.min(ytop, yT - c * s) - 14, 'P ' + DK.n(P, 4), { from: yT - c * s - 2 });
    h += DK.leader(gx[0] - wd * s * 0.35, yT - hc * s - wd * s * 0.35, Math.max(150, gx[0] - wd * s * 0.35 - 24), Math.max(14, ytop - 16), 'wire Ø ' + DK.n(w, 4) + (v.wire > 0 ? '' : ' (best)'), { anchor: 'end' });
    h += deLines(x0 - 50, H - 30, [F[3] + ' thread, ' + (sys === 'inch' ? DK.n(v.pitch, 3) + ' TPI' : 'pitch ' + DK.n(P, 3) + ' mm') + ', major Ø ' + DK.n(v.major, 4) + ' ' + u,
      'E = pitch diameter (chain lines). M is read over the anvils.' + (broken ? ' Diameter shortened.' : '')]);
    return DK.svg(W, H, h, 'Three-wire thread measurement');
  },

  // Multi-start thread: side view with each start's crests, pitch and lead, and the end view with the start index.
  multistart(v, sys, rows) {
    const W = 520, H = 260, u = deU(sys), n = Math.round(v.n);
    const L = deV(rows, /^Lead L/), P = deV(rows, /^Pitch P/), ga = deV(rows, 'Lead angle');
    if (!(n >= 1 && L > 0 && P > 0)) return '';
    const nd = Math.min(n, 12), s = deClamp(250 / (2 * L), 6 / P, 1e9), x0 = 40, x1 = 330;
    const Dpx = deClamp(v.e > 0 ? v.e * s : 110, 70, 130), cy = 132, yt = cy - Dpx / 2, yb = cy + Dpx / 2, dep = deClamp(0.3 * P * s, 3, 12);
    let h = '';
    // Crest lines on the visible face: each crest advances L/2 over the visible half turn.
    let lines = '', hotl = '';
    const kMin = Math.floor(-L / P) - 1, kMax = Math.ceil((x1 - x0) / (P * s)) + 1;
    for (let k = kMin; k <= kMax; k++) {
      const xa = x0 + k * P * s, xb = xa + L / 2 * s;
      // Clip the slanted line to x0..x1.
      const t0 = deClamp((x0 - xa) / (xb - xa), 0, 1), t1 = deClamp((x1 - xa) / (xb - xa), 0, 1);
      if (t1 <= t0) continue;
      const seg = DK.line(xa + (xb - xa) * t0, yb - (yb - yt) * t0, xa + (xb - xa) * t1, yb - (yb - yt) * t1, ((k % n) + n) % n === 0 ? 'hot' : 'thin');
      if (((k % n) + n) % n === 0) hotl += seg; else lines += seg;
    }
    // Outline with a thread profile on the top and bottom edges.
    const tooth = (y, sg, ph) => { const pts = []; for (let X = x0; X <= x1 + 0.1; X += 1) { const q = ((((X - x0) / s + ph) % P) + P) % P, t = Math.abs(q / P - 0.5) * 2; pts.push([X, y - sg * dep * (t > 0.5 ? 1 : t * 2 > 0.25 ? (t * 2 - 0.25) / 0.75 : 0)]); } return pts; };
    const topE = tooth(yt, 1, 0), botE = tooth(yb, -1, L / 2);
    h += dePoly(topE.concat(botE.slice().reverse()), 'part') + lines + hotl;
    h += DK.cl(x0 - 14, cy, x1 + 14, cy);
    // Pitch and lead along the top.
    h += DK.dimH(x0 + P * s * 0.5, x0 + P * s * 1.5, yt - 22, 'P ' + DK.n(P, 4), { from: yt - dep - 2 });
    h += DK.dimH(x0 + P * s * 0.5, x0 + P * s * 0.5 + L * s, yt - 46, 'L ' + DK.n(L, 4) + ' ' + u, { hot: true, from: yt - dep - 2 });
    if (v.e > 0) h += deDimV(yt, yb, x0 - 22, 'Ø ' + DK.n(v.e, 4), { from: x0 - 4 });
    h += DK.text((x0 + x1) / 2, yb + 30, 'Start 1 highlighted: it comes round again one lead L later', { cls: 'mut' });
    // End view: the starts spaced 360/n.
    const ex = 432, ey = 130, er = 52;
    h += DK.circle(ex, ey, er, 'part') + deCross(ex, ey, er + 12);
    for (let i = 0; i < nd; i++) {
      const a = Math.PI / 2 - i * 2 * Math.PI / n, x = ex + er * Math.cos(a), y = ey - er * Math.sin(a);
      h += DK.circle(x, y, 4.5, i === 0 ? 'hotf' : 'part');
      if (n <= 8) h += DK.text(ex + (er + 13) * Math.cos(a), ey - (er + 13) * Math.sin(a) + 4, String(i + 1), { cls: i === 0 ? 'hott' : 'mut' });
    }
    if (n >= 2) h += DK.angle(ex, ey, 30, 90 - 360 / n, 90, DK.n(360 / n, 2) + '°', { hot: true, inside: true });
    h += DK.text(ex, ey + er + 30, n + ' start' + (n > 1 ? 's' : '') + (deFin(ga) ? ', lead angle ' + DK.n(ga, 2) + '°' : ''), { cls: 'txt' });
    return DK.svg(W, H, h, 'Multi-start thread: pitch, lead and start index');
  },

  // Spur gears: the pair in mesh with true involute teeth, pitch circles, line of action and centre distance.
  spurgear(v, sys, rows) {
    const W = 520, H = 300, u = deU(sys), m = gearMod(v.mp, sys), dp = deDp(sys);
    if (!(m > 0 && v.z1 >= 3 && v.z1 <= 400 && v.pa > 0 && v.pa < 45)) return '';
    const z1 = Math.round(v.z1), z2 = v.z2 >= 3 && v.z2 <= 600 ? Math.round(v.z2) : 0, al = v.pa;
    const ha = v.ha > 0 ? v.ha : 1, hf = v.hf > 0 ? v.hf : 1.25, x1 = deFin(v.x1) ? v.x1 : 0, x2 = deFin(v.x2) ? v.x2 : 0;
    const d1 = deV(rows, 'Gear 1: reference'), da1 = deV(rows, 'Gear 1: tip');
    let h = '', lab = '';
    if (!z2) {
      const g0 = deGear(0, 0, 1, m, z1, al, { x: x1, ha, hf });
      const s = 210 / (2 * g0.ra), cx = 160, cy = 150, g = deGear(cx, cy, s, m, z1, al, { x: x1, ha, hf, rot: Math.PI / 2 });
      h += deGearPath(g) + DK.circle(cx, cy, g.r * s, 'cl') + DK.circle(cx, cy, g.rb * s, 'hid') + deCross(cx, cy, g.ra * s + 14);
      h += DK.circle(cx, cy, Math.max(6, 0.18 * g.rf * s), 'ln');
      const L = (R, a, ty, t, hot) => DK.leader(cx + R * s * Math.cos(a), cy - R * s * Math.sin(a), 330, ty, t, { anchor: 'start', hot });
      h += L(g.ra, 0.5, 60, 'tip Ø ' + (deFin(da1) ? DK.n(da1, dp) : '?'), true) + L(g.r, 0.15, 100, 'pitch Ø ' + (deFin(d1) ? DK.n(d1, dp) : '?')) + L(g.rb, -0.25, 140, 'base Ø ' + deT(rows, 'Gear 1: base', '')) + L(g.rf, -0.55, 180, 'root Ø ' + deT(rows, 'Gear 1: root', ''));
      h += deLines(330, 230, [z1 + ' teeth, ' + (sys === 'inch' ? 'P ' + DK.n(v.mp, 3) : 'm ' + DK.n(m, 3)) + ', ' + DK.n(al, 2) + '° pressure angle', 'Diameters in ' + u + '. Base circle dashed.']);
      return DK.svg(W, H, h, 'Spur gear with involute teeth and its circles');
    }
    const a = deV(rows, /^Centre distance$/), aw = deV(rows, 'Working pressure angle'), alw = deFin(aw) ? aw : al;
    const A = deFin(a) ? a : m * (z1 + z2) / 2, dw1 = deV(rows, 'Working pitch diameter, gear 1'), dw2 = deV(rows, 'Working pitch diameter, gear 2');
    const ra1 = m * (z1 / 2 + ha + x1), ra2 = m * (z2 / 2 + ha + x2);
    let s = Math.min(460 / (ra1 + A + ra2), 220 / (2 * Math.max(ra1, ra2)));
    s = deClamp(s, 120 / (2 * ra1), 230 / (2 * ra1));
    const cy = 138, c1x = 34 + ra1 * s, c2x = c1x + A * s;
    const g1 = deGear(c1x, cy, s, m, z1, al, { x: x1, ha, hf, rot: 0 }), g2 = deGear(c2x, cy, s, m, z2, al, { x: x2, ha, hf, rot: Math.PI + Math.PI / z2 });
    const r1w = deFin(dw1) ? dw1 / 2 : A * z1 / (z1 + z2), r2w = deFin(dw2) ? dw2 / 2 : A - r1w;
    h += deGearPath(g2) + deGearPath(g1);
    h += DK.circle(c1x, cy, r1w * s, 'cl') + DK.circle(c2x, cy, r2w * s, 'cl');
    h += deCross(c1x, cy, g1.ra * s + 12) + DK.cl(c2x - g2.ra * s - 12, cy, c2x + Math.min(g2.ra * s + 12, 600), cy) + DK.cl(c2x, cy - g2.ra * s - 12, c2x, cy + g2.ra * s + 12);
    h += DK.circle(c1x, cy, 3, 'txt') + DK.circle(c2x, cy, 3, 'txt');
    // Line of action, tangent to both base circles through the pitch point.
    const t = alw * Math.PI / 180, nx = Math.cos(t), ny = Math.sin(t), px = c1x + r1w * s;
    const T1 = [c1x + g1.rb * s * nx, cy + g1.rb * s * ny], T2 = [c2x - g2.rb * s * nx, cy - g2.rb * s * ny];
    h += DK.line(T1[0], T1[1], T2[0], T2[1], 'hot') + DK.circle(T1[0], T1[1], 2.5, 'hotf') + DK.circle(T2[0], T2[1], 2.5, 'hotf') + DK.circle(px, cy, 3.5, 'hotf');
    h = deClip('declip-spur', W, H, h);
    lab += DK.angle(px, cy, 30, 90, 90 + alw, DK.n(alw, 2) + '°', { hot: true });
    const yd = Math.min(H - 16, cy + Math.max(g1.ra, Math.min(g2.ra, (H - cy) / s)) * s + 20);
    lab += DK.dimH(c1x, c2x, Math.min(yd, H - 14), 'a ' + DK.n(A, dp) + ' ' + u, { hot: true, from: cy + 4 });
    lab += DK.text(c1x, cy - g1.ra * s - 20 < 12 ? 14 : cy - g1.ra * s - 20, 'z1 = ' + z1, { cls: 'txt' });
    const z2y = Math.max(14, cy - g2.ra * s - 20), z2x = deClamp(c2x, 300, W - 40);
    lab += DK.text(z2x, z2y, 'z2 = ' + z2, { cls: 'txt' });
    const cr = deV(rows, 'Transverse contact ratio');
    const d2r = deV(rows, 'Gear 2: reference');
    lab += deLines(W - 196, H - 61, [(sys === 'inch' ? 'P ' + DK.n(v.mp, 3) : 'm ' + DK.n(m, 3)) + ', α ' + DK.n(al, 2) + '°', 'pitch Ø ' + (deFin(d1) ? DK.n(d1, dp) : '?') + ' / ' + (deFin(d2r) ? DK.n(d2r, dp) : '?') + ' ' + u, 'line of action (orange)', deFin(cr) ? 'contact ratio ' + DK.n(cr, 3) : '']);
    return DK.svg(W, H, h + lab, 'Spur gear pair in mesh');
  },

  // Gear inspection: the gear with two pins (or balls) and the measurement over them, and the span anvils over k teeth.
  gearmeasure(v, sys, rows) {
    const W = 520, H = 320, u = deU(sys), mn = gearMod(v.mp, sys), dp = deDp(sys) + 1;
    if (!(mn > 0 && v.z >= 3 && v.z <= 300 && v.pa > 0)) return '';
    const z = Math.round(v.z), b = deFin(v.beta) ? v.beta : 0, x = deFin(v.x) ? v.x : 0, inn = v.int === 1, ha = v.ha > 0 ? v.ha : 1;
    const br = b * Math.PI / 180, mt = mn / Math.cos(br), at = Math.atan(Math.tan(v.pa * Math.PI / 180) / Math.cos(br)) * 180 / Math.PI;
    const dpin = deV(rows, /diameter used/), M = deV(rows, /^Measurement (over|between)/), Dc = deV(rows, 'Pin centres on diameter');
    const r = mt * z / 2, cx = 180, cy = 168;
    let h = '', lab = '';
    const oddA = z % 2 ? Math.PI / z : 0; // second pin in the space nearest opposite
    if (!inn) {
      const ra = r + (ha + x) * mn, s = 220 / (2 * ra);
      const g = deGear(cx, cy, s, mt, z, at, { x: x * mn / mt, ha: ha * mn / mt, hf: 1.25 * mn / mt, rot: Math.PI / z });
      h += deGearPath(g) + DK.circle(cx, cy, r * s, 'cl') + deCross(cx, cy, ra * s + 14) + DK.circle(cx, cy, Math.max(6, 0.2 * g.rf * s), 'ln');
      if (dpin > 0 && Dc > 0) {
        const pa = [0, Math.PI - oddA], Rc = Dc / 2 * s, pr = dpin / 2 * s;
        const P = pa.map(a => [cx + Rc * Math.cos(a), cy - Rc * Math.sin(a)]);
        P.forEach(p => { h += DK.circle(p[0], p[1], pr, 'tool') + DK.circle(p[0], p[1], 1.6, 'hotf'); });
        const ux = (P[0][0] - P[1][0]) / Math.hypot(P[0][0] - P[1][0], P[0][1] - P[1][1]), uy = (P[0][1] - P[1][1]) / Math.hypot(P[0][0] - P[1][0], P[0][1] - P[1][1]);
        const A = [P[1][0] - ux * pr, P[1][1] - uy * pr], B = [P[0][0] + ux * pr, P[0][1] + uy * pr];
        lab += DK.dim(A[0], A[1], B[0], B[1], 'M ' + (deFin(M) ? DK.n(M, dp) + ' ' + u : ''), { hot: true, off: -(ra * s - Math.abs(A[1] - cy) + 22), below: true });
        lab += DK.leader(P[0][0] + pr * 0.7, P[0][1] - pr * 0.7, 410, cy - 40, (b ? 'ball' : 'pin') + ' Ø ' + DK.n(dpin, dp), { anchor: 'start' });
      }
      // Span anvils over k teeth, centred near the top (spur only: W is measured in the normal plane).
      const k = Math.round(deV(rows, 'teeth spanned k')), Wk = deV(rows, 'Span measurement W'), dk = deV(rows, 'anvils touch at diameter');
      if (k >= 1 && Wk > 0) {
        const pitch = 2 * Math.PI / z, base = k % 2 ? Math.PI / z : 0; // tooth centres at pi/z + j pitch; space centres at j pitch
        const j = Math.round((Math.PI / 2 - base) / pitch), phi = base + j * pitch;
        const ux = Math.cos(phi), uy = -Math.sin(phi), nx = -uy, ny = ux; // radial (screen) and across
        const half = Wk / 2 * s;
        if (!b) {
          const rt = dk > 0 ? Math.sqrt(Math.max(0, (dk / 2) ** 2 - (Wk / 2) ** 2)) * s : r * s;
          [-1, 1].forEach(sg => {
            const bx = cx + ux * rt + sg * nx * half, by = cy + uy * rt + sg * ny * half;
            const a1 = [bx - ux * 26 + sg * nx * 0, by - uy * 26], a2 = [bx + ux * 34, by + uy * 34];
            h += dePoly([[a1[0], a1[1]], [a2[0], a2[1]], [a2[0] + sg * nx * 9, a2[1] + sg * ny * 9], [a1[0] + sg * nx * 9, a1[1] + sg * ny * 9]], 'tool');
          });
          const e1 = [cx + ux * (ra * s + 30) - nx * half, cy + uy * (ra * s + 30) - ny * half], e2 = [cx + ux * (ra * s + 30) + nx * half, cy + uy * (ra * s + 30) + ny * half];
          lab += DK.dim(e1[0], e1[1], e2[0], e2[1], 'W ' + DK.n(Wk, dp) + ' (k = ' + k + ')', { off: Math.sign(e2[0] - e1[0]) || 1 });
        } else lab += DK.text(410, 60, 'Span W ' + DK.n(Wk, dp) + ' over ' + k, { cls: 'txt', anchor: 'start' }) + DK.text(410, 75, 'teeth, in the normal plane', { cls: 'mut', anchor: 'start' });
      }
    } else {
      const rTip = r - (ha - x) * mn, rRoot = r + (1.25 + x) * mn, s = 210 / (2 * rRoot * 1.12), rim = rRoot * 1.12 * s;
      const g = deGear(cx, cy, s, mt, z, at, { internal: true, x: x * mn / mt, ha: ha * mn / mt, hf: 1.25 * mn / mt, rot: Math.PI / z });
      h += deRing(cx, cy, rim, g) + DK.circle(cx, cy, r * s, 'cl') + deCross(cx, cy, rim + 12);
      if (dpin > 0 && Dc > 0) {
        const pa = [0, Math.PI - oddA], Rc = Dc / 2 * s, pr = dpin / 2 * s;
        const P = pa.map(a => [cx + Rc * Math.cos(a), cy - Rc * Math.sin(a)]);
        P.forEach(p => { h += DK.circle(p[0], p[1], pr, 'tool') + DK.circle(p[0], p[1], 1.6, 'hotf'); });
        const L = Math.hypot(P[0][0] - P[1][0], P[0][1] - P[1][1]), ux = (P[0][0] - P[1][0]) / L, uy = (P[0][1] - P[1][1]) / L;
        lab += DK.dim(P[1][0] + ux * pr, P[1][1] + uy * pr, P[0][0] - ux * pr, P[0][1] - uy * pr, 'M ' + (deFin(M) ? DK.n(M, dp) + ' ' + u : ''), { hot: true });
        lab += DK.leader(P[0][0] - pr * 0.5, P[0][1] - pr * 0.8, 410, cy - 70, 'pin Ø ' + DK.n(dpin, dp), { anchor: 'start' });
      }
      void rTip;
    }
    const ch = deV(rows, 'Chordal tooth thickness'), chh = deV(rows, 'Chordal height');
    lab += deLines(392, 236, [z + ' teeth, ' + (sys === 'inch' ? 'P ' + DK.n(v.mp, 3) : 'm ' + DK.n(mn, 3)) + (b ? ', β ' + DK.n(b, 2) + '°' : ''), inn ? 'internal: pins between' : '', deFin(ch) ? 'chordal s ' + DK.n(ch, dp) : '', deFin(chh) ? 'chordal h ' + DK.n(chh, dp) : '', 'sizes in ' + u].filter(Boolean));
    return DK.svg(W, H, h + lab, 'Gear measurement over pins and span');
  },

  // Helical pair: the transverse section in mesh (true involute in the transverse plane), and a plan view of gear 1 with the helix angle.
  helicalgear(v, sys, rows) {
    const W = 520, H = 300, u = deU(sys), dp = deDp(sys), mn = gearMod(v.mp, sys), beta = v.beta;
    const mt = deV(rows, /^Transverse module/), at = deV(rows, 'Transverse pressure angle'), a = deV(rows, /^Centre distance$/);
    if (!(mn > 0 && mt > 0 && at > 0 && v.z1 >= 3 && v.z1 <= 400 && beta >= 0 && beta < 60)) return '';
    const z1 = Math.round(v.z1), z2 = v.z2 >= 3 && v.z2 <= 600 && deFin(a) ? Math.round(v.z2) : 0, k = mn / mt;
    const ha = (v.ha > 0 ? v.ha : 1) * k, hf = (v.hf > 0 ? v.hf : 1.25) * k, x1 = (deFin(v.x1) ? v.x1 : 0) * k, x2 = (deFin(v.x2) ? v.x2 : 0) * k;
    const ra1 = mt * (z1 / 2 + ha + x1), ra2 = z2 ? mt * (z2 / 2 + ha + x2) : 0;
    let s = z2 ? Math.min(300 / (ra1 + a + ra2), 230 / (2 * Math.max(ra1, ra2))) : 220 / (2 * ra1);
    s = deClamp(s, 90 / (2 * ra1), 220 / (2 * ra1));
    const cy = 136, c1x = 24 + ra1 * s, c2x = c1x + (z2 ? a * s : 0);
    let h = '';
    const g1 = deGear(c1x, cy, s, mt, z1, at, { x: x1, ha, hf, rot: 0 });
    if (z2) h += deGearPath(deGear(c2x, cy, s, mt, z2, at, { x: x2, ha, hf, rot: Math.PI + Math.PI / z2 }));
    h += deGearPath(g1) + DK.circle(c1x, cy, g1.r * s, 'cl') + deCross(c1x, cy, g1.ra * s + 10) + DK.circle(c1x, cy, 3, 'txt');
    if (z2) h += DK.circle(c2x, cy, mt * z2 / 2 * s, 'cl') + DK.cl(c2x - ra2 * s - 10, cy, c2x + ra2 * s + 10, cy) + DK.cl(c2x, cy - ra2 * s - 10, c2x, cy + ra2 * s + 10) + DK.circle(c2x, cy, 3, 'txt');
    h = deClip('declip-hel', 346, H, h);
    let lab = DK.text(c1x, Math.max(14, cy - g1.ra * s - 14), 'z1 = ' + z1 + ' (RH)', { cls: 'txt' });
    if (z2) {
      lab += DK.text(deClamp(c2x, c1x + 80, 300), Math.max(14, cy - ra2 * s - 14), 'z2 = ' + z2 + ' (LH)', { cls: 'txt' });
      lab += DK.dimH(c1x, c2x, Math.min(H - 34, cy + Math.max(g1.ra, Math.min(ra2, (H - cy) / s)) * s + 18), 'a ' + DK.n(a, dp) + ' ' + u, { hot: true, from: cy + 4 });
    }
    lab += deLines(362, H - 24, ['Left: transverse section,', 'mt ' + DK.n(mt, dp) + ', αt ' + DK.n(at, 3) + '°']);
    // Plan view of gear 1: face width across, tooth lines at the helix angle.
    const px0 = 382, pw = 104, ph = 120, py0 = 40, tb = Math.tan(beta * Math.PI / 180);
    lab += DK.rect(px0, py0, pw, ph, 'part');
    const step = 14, sh = pw * tb;
    let lines = '';
    for (let y = py0 - sh - step; y < py0 + ph + step; y += step) {
      const t0 = deClamp(sh > 0.01 ? (py0 - y) / sh : 0, 0, 1), t1 = deClamp(sh > 0.01 ? (py0 + ph - y) / sh : 1, 0, 1);
      if (sh <= 0.01 && (y < py0 || y > py0 + ph)) continue;
      if (t1 <= t0) continue;
      lines += DK.line(px0 + pw * t0, y + sh * t0, px0 + pw * t1, y + sh * t1, 'thin');
    }
    lab += lines + DK.rect(px0, py0, pw, ph, 'ln') + DK.cl(px0 - 14, py0 + ph / 2, px0 + pw + 14, py0 + ph / 2);
    if (beta > 0.5) {
      const yy = py0 + ph / 2 - 4 - sh / 2, xs = px0;
      lab += DK.line(xs, yy, xs + pw, yy + sh, 'hot') + DK.angle(xs, yy, 54, -Math.min(beta, 59), 0, '', { hot: true });
    }
    lab += DK.text(px0 + pw / 2, py0 - 8, 'gear 1 from above', { cls: 'mut' });
    lab += DK.text(px0 + pw / 2, py0 + ph + 18, 'β ' + DK.n(beta, 2) + '°' + (v.b > 0 ? ', b ' + DK.n(v.b, dp) : ''), { cls: 'hott' });
    const bb = deV(rows, 'Base helix angle'), et = deV(rows, 'Total contact ratio'), d1 = deV(rows, 'Gear 1: pitch');
    lab += deLines(362, 200, [deFin(d1) ? 'pitch Ø ' + DK.n(d1, dp) + (z2 ? ' / ' + DK.n(deV(rows, 'Gear 2: pitch'), dp) : '') : '', deFin(bb) ? 'base helix ' + DK.n(bb, 3) + '°' : '', deFin(et) ? 'total contact ratio ' + DK.n(et, 3) : '', z2 ? 'external pair: opposite hands' : '']);
    return DK.svg(W, H, h + lab, 'Helical gear pair: transverse section and helix angle');
  },

  // Gear train: the gears in a row, compound gears on one shaft, tooth counts, input and output speed and directions.
  geartrain(v, sys, rows) {
    const W = 520, H = 280, pr = [];
    for (let i = 1; i <= 4; i++) if (v['a' + i] >= 4 && v['b' + i] >= 4 && v['a' + i] <= 400 && v['b' + i] <= 400) pr.push([Math.round(v['a' + i]), Math.round(v['b' + i])]);
    if (!pr.length) return '';
    // Shafts: 0 carries driver 1; shaft i carries driven i and driver i + 1.
    const sh = [{ g: [pr[0][0]] }];
    pr.forEach((p, i) => { sh.push({ g: [p[1]].concat(i + 1 < pr.length ? [pr[i + 1][0]] : []) }); });
    let span = pr[0][0] + pr[pr.length - 1][1]; pr.forEach(p => { span += p[0] + p[1]; });
    const zmax = Math.max(...pr.flat()), k = Math.min(470 / span, 190 / (2 * zmax)); // pitch radius = k z px
    let x = 25 + pr[0][0] * k; const cy = 132;
    sh.forEach((S, i) => { S.x = x; if (i < pr.length) x += k * (pr[i][0] + pr[i][1]); });
    let h = '';
    sh.forEach((S, i) => {
      // Rear gear (driven, meshing to the left) first, then the driver for the next pair.
      if (i > 0) h += deGearPath(deGear(S.x, cy, 1, 2 * k, pr[i - 1][1], 20, { rot: Math.PI + Math.PI / pr[i - 1][1] }));
      if (i < pr.length) h += deGearPath(deGear(S.x, cy, 1, 2 * k, pr[i][0], 20, { rot: 0 }));
      const rr = Math.max(...S.g) * k;
      h += DK.circle(S.x, cy, Math.max(4, Math.min(...S.g) * k * 0.25), 'ln') + DK.circle(S.x, cy, 2, 'txt') + DK.cl(S.x, cy - rr - 10, S.x, cy + rr + 10);
    });
    h += DK.cl(10, cy, W - 10, cy);
    h = deClip('declip-train', W, H, h);
    let lab = '';
    const nOut = deV(rows, 'Output speed'), ratio = deV(rows, /^Train ratio/), last = sh.length - 1;
    sh.forEach((S, i) => {
      const rr = Math.max(...S.g) * k, dir = i % 2 === 0 ? 1 : -1, ra = rr + 12;
      lab += DK.text(S.x, Math.min(cy + rr + 22, H - 34), S.g.map(z => z + 'T').join(' + '), { cls: 'txt' });
      if (i === 0 || i === last) {
        const rad = Math.min(ra, cy - 20);
        lab += deRot(S.x, cy, rad, dir > 0 ? 125 : 55, dir > 0 ? 55 : 125, i === last ? 'hot' : 'ln');
        const t = i === 0 ? (v.n > 0 ? DK.n(v.n, 1) + ' RPM in' : 'input') : (deFin(nOut) ? DK.n(nOut, 2) + ' RPM out' : 'output');
        lab += DK.text(deClamp(S.x, 60, W - 60), Math.max(14, cy - rad - 8), t, { cls: i === last ? 'hott' : 'txt' });
      } else lab += deRot(S.x, cy, Math.min(ra, cy - 20) * 0.6, dir > 0 ? 125 : 55, dir > 0 ? 55 : 125, 'thin');
    });
    const dr = deRow(rows, 'Output direction');
    lab += deLines(14, H - 22, ['Ratio ' + (deFin(ratio) ? DK.n(ratio, 5) + ' : 1' : '?') + (v.idl > 0 ? ', plus ' + Math.round(v.idl) + ' idler' + (v.idl >= 2 ? 's' : '') + ' (not drawn)' : '') + (dr ? '; output turns ' + dr.value : '')], { cls: 'txt' });
    return DK.svg(W, H, h + lab, 'Gear train with tooth counts and speeds');
  },

  // Planetary set: ring, sun, planets on the carrier, with tooth counts, speeds and the held member.
  planetary(v, sys, rows) {
    const W = 520, H = 300;
    if (!(v.zs >= 4 && v.zr > v.zs + 6 && v.zr <= 400)) return '';
    const zs = Math.round(v.zs), zr = Math.round(v.zr), zp = Math.max(4, Math.round((zr - zs) / 2)), np = deClamp(Math.round(v.np) || 3, 1, 8);
    const m = 2 * 112 / zr, cx = 150, cy = 150, rc = m * (zs + zp) / 2;
    let h = '';
    // Phase: sun tooth at 0; each planet meshes with the sun; the ring is phased to planet 1.
    const pitchP = 2 * Math.PI / zp, pl = [];
    for (let j = 0; j < np; j++) {
      const phi = j * 2 * Math.PI / np, pS = 2 * Math.PI / zs, del = phi - Math.round(phi / pS) * pS;
      pl.push({ phi, rot: phi + Math.PI + Math.PI / zp - del * zs / zp });
    }
    const r0 = pl[0].rot, sig = r0 + Math.PI / zp + pitchP * Math.round((0 - r0 - Math.PI / zp) / pitchP);
    const ringG = deGear(cx, cy, 1, m, zr, 20, { internal: true, rot: sig * zp / zr });
    h += deRing(cx, cy, ringG.rf + 14, ringG);
    h += deGearPath(deGear(cx, cy, 1, m, zs, 20, { rot: 0 }));
    pl.forEach(p => { const px = cx + rc * Math.cos(p.phi), py = cy - rc * Math.sin(p.phi); h += deGearPath(deGear(px, py, 1, m, zp, 20, { rot: p.rot })) + DK.circle(px, py, Math.max(3, m * zp * 0.12), 'ln'); });
    // Carrier: arms from the centre to each planet.
    h += DK.circle(cx, cy, rc, 'cl');
    pl.forEach(p => { h += DK.line(cx, cy, cx + rc * Math.cos(p.phi), cy - rc * Math.sin(p.phi), 'dim') + DK.circle(cx + rc * Math.cos(p.phi), cy - rc * Math.sin(p.phi), 3, 'dimf'); });
    h += DK.circle(cx, cy, Math.max(4, m * zs * 0.15), 'ln') + DK.circle(cx, cy, 3, 'dimf');
    // Speeds: entered, or solved (hot).
    const sol = { ns: deV(rows, /^Sun speed$/), nr: deV(rows, /^Ring speed$/), nc: deV(rows, /^Carrier speed$/) };
    const sp = k => (deFin(v[k]) ? { n: v[k], hot: false } : deFin(sol[k]) ? { n: sol[k], hot: true } : null);
    const st = k => { const q = sp(k); if (!q) return '?'; return Math.abs(q.n) < 1e-9 ? 'held' : DK.n(q.n, 2) + ' RPM'; };
    const L = (x, y, tx, ty, t1, t2, k) => { const q = sp(k); return DK.leader(x, y, tx, ty, t1, { anchor: 'start' }) + DK.text(tx + 4, ty + 19, t2, { cls: q && q.hot ? 'hott' : 'dimt', anchor: 'start' }); };
    const rr = ringG.rf + 14;
    let lab = L(cx + rr * 0.72, cy - rr * 0.69, 330, 46, 'Ring ' + zr + 'T', st('nr'), 'nr');
    lab += L(cx + zs * m * 0.3, cy + zs * m * 0.25, 330, 120, 'Sun ' + zs + 'T', st('ns'), 'ns');
    const pc = pl[np > 1 ? np - 1 : 0];
    lab += L(cx + rc * Math.cos(pc.phi) * 0.55, cy - rc * Math.sin(pc.phi) * 0.55, 330, 194, 'Carrier (arms)', st('nc'), 'nc');
    lab += DK.text(cx + rc * Math.cos(pl[0].phi), cy - rc * Math.sin(pl[0].phi) + 4, zp + 'T', { cls: 'txt' });
    const eq = deRow(rows, 'Equal planet spacing');
    lab += deLines(330, 254, [np + ' planets of ' + zp + 'T' + (eq && /^yes/.test(eq.value) ? ', equally spaced' : eq ? ': not equally spaceable' : ''), 'Solved speed in orange.']);
    return DK.svg(W, H, h + lab, 'Planetary gear set');
  },

  // Involute splines: external with pins over, internal with pins between, both drawn from the 30° involute.
  spline(v, sys, rows) {
    const W = 520, H = 310, u = deU(sys), dp = deDp(sys) + 1;
    if (!(v.mp > 0 && v.z >= 6 && v.z <= 200 && (v.std === 1 || v.std === 2))) return '';
    const z = Math.round(v.z), m = v.std === 1 ? (sys === 'inch' ? 1 / v.mp : 25.4 / v.mp) : (sys === 'inch' ? v.mp / 25.4 : v.mp), D = deV(rows, 'Pitch diameter D');
    if (!(D > 0)) return '';
    const Doe = deV(rows, 'Major diameter, external'), Die = deV(rows, 'Minor diameter, external'), Dii = deV(rows, 'Major diameter, internal'), Dmi = deV(rows, 'Minor diameter, internal');
    const ra = (Doe || m * (z + 1)) / 2, rf = (Die || m * (z - 1.35)) / 2, Ra = (Dmi || m * (z - 1)) / 2, Rf = (Dii || m * (z + 1.35)) / 2;
    const st = v.st > 0 ? v.st : deV(rows, 'Basic tooth thickness'), et = v.et > 0 ? v.et : deV(rows, 'Basic tooth thickness');
    const s = 200 / (2 * Rf * 1.16), cy = 150, odd = z % 2 === 1, co = odd ? Math.cos(Math.PI / (2 * z)) : 1, yd = cy + Rf * 1.16 * s + 20;
    let h = '', lab = '';
    const pins = (cx, Rc, d, inner, M) => {
      const P = [0, Math.PI - (odd ? Math.PI / z : 0)].map(a => [cx + Rc * s * Math.cos(a), cy - Rc * s * Math.sin(a)]), pr = d / 2 * s;
      let g = ''; P.forEach(p => { g += DK.circle(p[0], p[1], pr, 'tool') + DK.circle(p[0], p[1], 1.4, 'hotf'); });
      const L = Math.hypot(P[0][0] - P[1][0], P[0][1] - P[1][1]), ux = (P[0][0] - P[1][0]) / L, uy = (P[0][1] - P[1][1]) / L, sg = inner ? -1 : 1;
      const A = [P[1][0] - sg * ux * pr, P[1][1] - sg * uy * pr], B = [P[0][0] + sg * ux * pr, P[0][1] + sg * uy * pr];
      return { g, d: DK.dim(A[0], A[1], B[0], B[1], 'M ' + (deFin(M) ? DK.n(M, dp) : '?'), { hot: true, off: -(yd - Math.max(A[1], B[1])), below: true }) };
    };
    // External.
    const ex = 128, ge = deGear(ex, cy, s, m, z, 30, { ra, rf, psi: st > 0 ? st / D : Math.PI / 2 / z, rot: Math.PI / z });
    h += deGearPath(ge) + DK.circle(ex, cy, D / 2 * s, 'cl') + deCross(ex, cy, ra * s + 12) + DK.circle(ex, cy, rf * s * 0.35, 'ln');
    const pe = deV(rows, 'Pin diameter, external'), Me = deV(rows, 'Measurement over pins, external');
    if (pe > 0 && Me > 0) { const q = pins(ex, (Me - pe) / 2 / co, pe, false, Me); h += q.g; lab += q.d; }
    // Internal (hub).
    const ix = 386, gi = deGear(ix, cy, s, m, z, 30, { internal: true, ra: Ra, rf: Rf, psi: et > 0 ? et / D : Math.PI / 2 / z, rot: Math.PI / z });
    h += deRing(ix, cy, Rf * 1.16 * s, gi) + DK.circle(ix, cy, D / 2 * s, 'cl') + deCross(ix, cy, Rf * 1.16 * s + 10);
    const pi = deV(rows, 'Pin diameter, internal'), Mi = deV(rows, 'Measurement between pins, internal');
    if (pi > 0 && Mi > 0) { const q = pins(ix, (Mi + pi) / 2 / co, pi, true, Mi); h += q.g; lab += q.d; }
    lab += DK.text(ex, 18, 'External (shaft): over pins', { cls: 'txt' }) + DK.text(ix, 18, 'Internal (hub): between pins', { cls: 'txt' });
    lab += DK.text(W / 2, H - 6, z + ' teeth, ' + (v.std === 1 ? DK.n(v.mp, 3) + '/' + DK.n(2 * v.mp, 3) + ' pitch' : 'module ' + DK.n(v.mp, 3)) + ', 30° pressure angle, pitch Ø ' + DK.n(D, dp - 1) + ' ' + u + ' (chain circle)', { cls: 'mut' });
    if (pe > 0) lab += DK.text(ex, 34, 'pins Ø ' + DK.n(pe, dp), { cls: 'mut' });
    if (pi > 0) lab += DK.text(ix, 34, 'pins Ø ' + DK.n(pi, dp), { cls: 'mut' });
    return DK.svg(W, H, h + lab, 'Involute spline, external and internal, with measuring pins');
  },

  // Worm and wheel: wheel teeth over the worm's axial section, centre distance, and the unrolled helix with the lead angle.
  worm(v, sys, rows) {
    const W = 520, H = 300, u = deU(sys), dp = deDp(sys), m = gearMod(v.mp, sys);
    if (!(m > 0 && v.z1 >= 1 && v.z2 >= 4 && v.z2 <= 400 && v.d1 > 0)) return '';
    const z2 = Math.round(v.z2), px = deV(rows, 'Axial pitch'), Ld = deV(rows, /^Lead = /), ga = deV(rows, 'Lead angle'), a = deV(rows, /^Centre distance/), d2 = deV(rows, 'Wheel pitch diameter');
    if (!(px > 0 && a > 0 && d2 > 0)) return '';
    const s = deClamp(Math.min(90 / v.d1, 185 / a), 12 / px, 40 / px), cx = 175, wy = 224, wcy = wy - a * s, r2 = d2 / 2 * s, r1 = v.d1 / 2 * s;
    let h = '';
    h += deGearPath(deGear(cx, wcy, s, m, z2, 20, { rot: -Math.PI / 2 + Math.PI / z2 }));
    h += DK.circle(cx, wcy, r2, 'cl') + DK.cl(cx, Math.max(wcy - r2 - 10, -10), cx, wy + r1 + 18);
    // Worm in axial section: rack-like thread teeth top and bottom, tooth centred under the wheel.
    const x0 = 40, x1 = 310, ad = m * s, dd = 1.2 * m * s, t20 = Math.tan(20 * Math.PI / 180);
    const prof = (sg, ph) => { const pts = []; for (let X = x0; X <= x1 + 0.1; X += 1) { let q = (((X - cx) / (px * s) + ph) % 1 + 1) % 1; q = Math.min(q, 1 - q) * px * s; const y = deClamp((px * s / 4 - q) / t20, -dd, ad); pts.push([X, wy - sg * (r1 + y)]); } return pts; };
    h += dePoly(prof(1, 0).concat(prof(-1, 0.5).reverse()), 'hatch');
    h += DK.cl(x0 - 14, wy, x1 + 14, wy) + DK.line(x0, wy - r1, x1, wy - r1, 'cl') + DK.line(x0, wy + r1, x1, wy + r1, 'cl');
    h = deClip('declip-worm', 348, H, h);
    let lab = deDimV(Math.max(wcy, 8), wy, x1 + 30, 'a ' + DK.n(a, dp) + ' ' + u, { hot: true, from: cx + 6 });
    lab += deDimV(wy - r1, wy + r1, x0 - 18, 'Ø ' + DK.n(v.d1, dp), { from: x0 - 2 });
    lab += DK.dimH(cx + px * s * 0.5, cx + px * s * 1.5, Math.min(H - 10, wy + r1 + ad + 20), 'px ' + DK.n(px, dp + 1), { from: wy + r1 + ad + 2 });
    lab += DK.text(cx, Math.max(14, Math.min(wcy + r2 * 0.45, wy - r1 - 40)), 'wheel ' + z2 + 'T', { cls: 'txt' });
    // Unrolled helix: one turn of the pitch diameter against the lead.
    const tx = 376, ty = 200, base = 130, hgt = deClamp(base * Math.tan((ga || 5) * Math.PI / 180), 6, 150);
    lab += dePoly([[tx, ty], [tx + base, ty], [tx + base, ty - hgt]], 'part') + DK.line(tx, ty, tx + base, ty - hgt, 'hot');
    lab += DK.angle(tx, ty, 44, 0, Math.atan2(hgt, base) * 180 / Math.PI, '', { hot: true }) + DK.text(tx, ty + 34, 'lead angle γ ' + (deFin(ga) ? DK.n(ga, 2) + '°' : '?'), { cls: 'hott', anchor: 'start' });
    lab += DK.text(tx + base / 2, ty + 16, 'π × pitch Ø', { cls: 'mut' }) + DK.text(tx + base + 6, ty - hgt / 2 + 4, 'L', { cls: 'dimt', anchor: 'start' });
    lab += deLines(372, 30, [Math.round(v.z1) + '-start worm, lead ' + (deFin(Ld) ? DK.n(Ld, dp + 1) : '?'), 'ratio ' + deT(rows, 'Ratio z2 / z1'), v.n > 0 ? 'wheel ' + deT(rows, 'Wheel speed') : '', 'one turn unrolled:']);
    return DK.svg(W, H, h + lab, 'Worm and wheel with centre distance and lead angle');
  },
});

// ---------- GD&T, sheet metal and coolant ----------
Object.assign(DIAGRAMS, {
  // True position: the round zone (stated plus bonus) round the true position, and the measured axis.
  gdttp(v, sys, rows) {
    const W = 520, H = 290, u = deU(sys), dp = deDp(sys);
    if (!(deFin(v.dx) && deFin(v.dy))) return '';
    const tp = deV(rows, /^Position deviation/), allowed = deV(rows, 'Position tolerance allowed'), bonus = deV(rows, 'Bonus tolerance'), res = deRow(rows, /^Result$/);
    const tol = v.tol >= 0 ? v.tol : NaN, zone = deFin(allowed) ? allowed : tol;
    const cx = 150, cy = 148, k = 112 / Math.max(deFin(zone) ? zone / 2 : 0, deFin(tp) ? tp / 2 : 0, 1e-9);
    const pass = res && /^PASS/.test(res.value);
    let h = '';
    if (deFin(zone) && zone > 0) {
      h += DK.circle(cx, cy, zone / 2 * k, bonus > 0 ? 'hatch' : 'part');
      if (bonus > 0 && tol > 0) h += DK.circle(cx, cy, tol / 2 * k, 'part');
    }
    h += deCross(cx, cy, 128);
    h += DK.text(cx - 124, cy - 6, 'X', { cls: 'mut', anchor: 'start' }) + DK.text(cx + 6, cy - 118, 'Y', { cls: 'mut', anchor: 'start' });
    // Measured axis.
    const px = cx + v.dx * k, py = cy - v.dy * k;
    if (Math.abs(v.dx * k) > 30) h += DK.dimH(cx, px, cy + (v.dy >= 0 ? 16 : -16), 'dX ' + DK.n(v.dx, dp), { below: v.dy >= 0 });
    if (Math.abs(v.dy * k) > 30) h += deDimV(cy, py, px + (v.dx >= 0 ? 16 : -16), 'dY ' + DK.n(v.dy, dp), {});
    h += DK.line(cx, cy, px, py, 'hot') + DK.circle(px, py, 4.5, pass ? 'hotf' : 'hotf') + DK.circle(px, py, 8, 'hot');
    if (deFin(tp)) h += DK.circle(cx, cy, tp / 2 * k, 'hid');
    // Legend on the right.
    const L = [];
    if (deFin(tol)) L.push(['Ø ' + DK.n(tol, dp) + ' stated tolerance', 'txt']);
    if (bonus > 0) L.push(['+ ' + DK.n(bonus, dp) + ' bonus (hatched ring)', 'txt']);
    if (deFin(allowed)) L.push(['= Ø ' + DK.n(allowed, dp) + ' allowed at this size', 'txt']);
    let y = 54;
    L.forEach(l => { h += DK.text(310, y, l[0], { cls: l[1], anchor: 'start' }); y += 18; });
    if (deFin(tp)) { h += DK.text(310, y + 8, 'Measured Ø ' + DK.n(tp, dp) + ' ' + u, { cls: 'hott', anchor: 'start' }); y += 26; }
    if (res) h += DK.text(310, y + 14, typeof res.value === 'string' ? res.value.replace(/\s*\(.*\)/, '') : '', { cls: 'hott', anchor: 'start', size: 22 });
    h += deLines(310, 232, ['Dashed circle: the zone the measured', 'axis needs, Ø = 2 × offset.' + (deFin(v.dz) ? ' XY view.' : ''), 'Zone drawn to scale, much enlarged.']);
    return DK.svg(W, H, h, 'True position zone with the measured axis');
  },

  // Bonus: the feature at its limits with the virtual-condition gauge, and the tolerance-against-size line.
  gdtbonus(v, sys, rows) {
    const W = 520, H = 290, u = deU(sys), dp = deDp(sys), inn = v.int === 1, mc = v.mc;
    if (!(v.lo > 0 && v.hi >= v.lo && v.tol >= 0)) return '';
    const mmc = deV(rows, 'MMC size'), lmc = deV(rows, 'LMC size'), vc = deV(rows, 'Virtual condition'), act = v.act > 0 ? v.act : NaN, tot = deV(rows, 'Total geometric tolerance');
    // Left: the sizes, exaggerated, about one centre.
    const sizes = [v.lo, v.hi, vc, act].filter(deFin), smin = Math.min(...sizes), smax = Math.max(...sizes), R = d => 38 + 62 * (smax > smin ? (d - smin) / (smax - smin) : 0.5);
    const cx = 120, cy = 140;
    let h = '';
    const vok = mc > 0 && deFin(vc), gauge = mc === 1; // at MMC the virtual condition is the functional gauge
    if (inn) {
      h += DK.rect(cx - 112, cy - 112, 224, 224, 'hatch') + DK.circle(cx, cy, R(deFin(act) ? act : mmc), 'part');
      h += DK.circle(cx, cy, R(deFin(act) ? act : mmc), 'ln');
      if (vok && gauge) h += DK.circle(cx, cy, R(vc), 'tool');
    } else {
      if (vok && gauge) h += DK.circle(cx, cy, R(vc), 'tool');
      h += DK.circle(cx, cy, R(deFin(act) ? act : mmc), 'part');
    }
    if (vok && !gauge) h += DK.circle(cx, cy, R(vc), 'hot');
    h += DK.circle(cx, cy, R(mmc), 'hid') + DK.circle(cx, cy, R(lmc), 'ghost') + deCross(cx, cy, inn ? 118 : 112);
    const lead = (r, a, ty, t, hot) => DK.leader(cx + r * Math.cos(a), cy - r * Math.sin(a), 248, ty, t, { anchor: 'start', hot });
    let lab = '';
    const big = R(lmc) > R(mmc);
    lab += lead(R(mmc), big ? 0.55 : 0.95, big ? 52 : 28, 'MMC ' + DK.n(mmc, dp)) + lead(R(lmc), big ? 0.95 : 0.55, big ? 28 : 52, 'LMC ' + DK.n(lmc, dp));
    if (mc > 0 && deFin(vc)) lab += DK.leader(cx + R(vc) * Math.cos(-0.9), cy - R(vc) * Math.sin(-0.9), 236, 266, (gauge ? (inn ? 'gauge pin' : 'gauge ring') : (inn ? 'outer boundary' : 'inner boundary')) + ' = VC ' + DK.n(vc, dp) + ' ' + u, { anchor: 'start', hot: true });
    if (deFin(act)) lab += DK.text(cx, cy + 4, 'actual ' + DK.n(act, dp), { cls: 'txt' });
    lab += DK.text(cx, 18, (inn ? 'Hole' : 'Pin') + ', sizes exaggerated', { cls: 'mut' });
    // Right: allowed tolerance against actual size.
    const gx0 = 336, gx1 = 496, gy0 = 196, gy1 = 100, range = v.hi - v.lo;
    const tMax = v.tol + (mc > 0 ? range : 0), Y = t => gy0 - (gy0 - gy1) * (tMax > 0 ? t / tMax : 0) * 0.92;
    const from = mc === 2 ? lmc : mmc, to = mc === 2 ? mmc : lmc, X = d => gx0 + (gx1 - gx0) * (to !== from ? (d - from) / (to - from) : 0.5);
    lab += DK.line(gx0, gy1 - 14, gx0, gy0, 'thin') + DK.line(gx0, gy0, gx1 + 6, gy0, 'thin');
    lab += DK.line(X(from), Y(v.tol), X(to), Y(mc > 0 ? tMax : v.tol), 'ln') + DK.circle(X(from), Y(v.tol), 2.5, 'txt') + DK.circle(X(to), Y(mc > 0 ? tMax : v.tol), 2.5, 'txt');
    lab += DK.text(gx0 - 4, Y(v.tol) + 4, DK.n(v.tol, dp), { cls: 'mut', anchor: 'end' }) + (mc > 0 ? DK.text(gx0 - 4, Y(tMax) + 4, DK.n(tMax, dp), { cls: 'mut', anchor: 'end' }) : '');
    lab += DK.text(X(from), gy0 + 15, (mc === 2 ? 'LMC' : 'MMC'), { cls: 'mut' }) + DK.text(X(to), gy0 + 15, (mc === 2 ? 'MMC' : 'LMC'), { cls: 'mut' });
    lab += DK.text((gx0 + gx1) / 2, gy0 + 32, 'actual size', { cls: 'mut' }) + DK.text(gx0 - 30, gy1 - 22, 'tolerance allowed', { cls: 'mut', anchor: 'start' });
    if (deFin(act) && deFin(tot)) {
      const ax = X(deClamp(act, Math.min(from, to), Math.max(from, to))), ay = Y(tot);
      lab += DK.line(ax, gy0, ax, ay, 'hot ext') + DK.line(gx0, ay, ax, ay, 'hot ext') + DK.circle(ax, ay, 4.5, 'hotf');
      lab += DK.text(ax + (ax > 440 ? -8 : 8), ay - 9, 'Ø ' + DK.n(tot, dp) + ' ' + u, { cls: 'hott', anchor: ax > 440 ? 'end' : 'start' });
    }
    lab += DK.text(gx1, 60, mc === 1 ? 'MMC modifier' : mc === 2 ? 'LMC modifier' : 'RFS: no bonus', { cls: 'txt', anchor: 'end' });
    return DK.svg(W, H, h + lab, 'Bonus tolerance and virtual condition');
  },

  // Plus/minus and position: the square zone with the circle round it, and the square inside a position circle.
  gdtconv(v, sys, rows) {
    const W = 520, H = 280, u = deU(sys), dp = deDp(sys);
    const pos = deV(rows, 'Position diameter containing'), pm = deV(rows, 'Equal +/- that fits');
    if (!deFin(pos) && !deFin(pm)) return '';
    let h = '';
    const R = 92, cy = 140;
    if (deFin(pos) && v.tx > 0) {
      const tx = v.tx, ty = v.ty > 0 ? v.ty : v.tx, k = R / Math.hypot(tx, ty), cx = 130;
      h += DK.circle(cx, cy, R, 'tool') + DK.rect(cx - tx * k, cy - ty * k, 2 * tx * k, 2 * ty * k, 'part') + deCross(cx, cy, R + 12);
      h += DK.line(cx, cy, cx + tx * k, cy - ty * k, 'hot');
      h += DK.dimH(cx - tx * k, cx + tx * k, cy + ty * k + 16, '± ' + DK.n(tx, dp), { from: cy + ty * k, below: true });
      h += deDimV(cy - ty * k, cy + ty * k, cx - tx * k - 18, '± ' + DK.n(ty, dp), { from: cx - tx * k });
      h += DK.leader(cx + R * Math.cos(2.4), cy - R * Math.sin(2.4), cx - 40, 22, 'Ø ' + DK.n(pos, dp) + ' ' + u, { anchor: 'end', hot: true });
      const gain = deV(rows, 'Area gain');
      h += DK.text(cx, H - 10, '± zone → position' + (deFin(gain) ? ': +' + DK.n(gain, 1) + ' % area (orange)' : ''), { cls: 'mut' });
    }
    if (deFin(pm) && v.d > 0) {
      const cx = 390, k = R / (v.d / 2), a = pm * k;
      h += DK.circle(cx, cy, R, 'part') + DK.rect(cx - a, cy - a, 2 * a, 2 * a, 'tool') + deCross(cx, cy, R + 12);
      h += DK.dimH(cx - a, cx + a, cy + a + 16, '± ' + DK.n(pm, dp), { hot: true, from: cy + a, below: true });
      h += DK.leader(cx + R * Math.cos(0.75), cy - R * Math.sin(0.75), cx + 40, 22, 'Ø ' + DK.n(v.d, dp) + ' ' + u, { anchor: 'start' });
      h += DK.text(cx, H - 10, 'position → ± (square inside, conservative)', { cls: 'mut' });
    }
    return DK.svg(W, H, h, 'Square plus/minus zone and round position zone');
  },

  // Fastener formulas: the two parts in section with the holes shifted to the worst case and the fastener just fitting.
  gdtfast(v, sys, rows) {
    const W = 520, H = 290, u = deU(sys), dp = deDp(sys);
    if (!(v.H > v.F && v.F > 0)) return '';
    const fixed = v.mode === 2, T = fixed ? deV(rows, 'Equal split') : deV(rows, 'Position tolerance at MMC');
    const Fp = 46, Hp = Fp + deClamp((v.H - v.F) / v.F * Fp, 14, 40), bc = 170, off = (Hp - Fp) / 2;
    const t1 = 46, yA = 70, yB = yA + t1, yC = yB + 46, x0 = 40, x1 = 300;
    let h = '';
    // Top plate: clearance hole shifted right; bottom plate: clearance hole (floating) or the fastener's own hole (fixed) shifted left.
    const plate = (y, hh, hc, hw) => DK.rect(x0, y, hc - hw / 2 - x0, hh, 'hatch') + DK.rect(hc + hw / 2, y, x1 - hc - hw / 2, hh, 'hatch');
    h += plate(yA, t1, bc + off, Hp);
    if (fixed) h += plate(yB, yC - yB, bc - 0, Fp);
    else h += plate(yB, yC - yB, bc - off, Hp);
    // Fastener (head, shank, nut or threaded end).
    const top = yA - 22, bot = fixed ? yC - 6 : yC + 30;
    h += DK.rect(bc - Fp / 2 - 18, top, Fp + 36, 22, 'tool') + DK.rect(bc - Fp / 2, yA, Fp, bot - yA, 'tool');
    if (!fixed) h += DK.rect(bc - Fp / 2 - 16, yC, Fp + 32, 20, 'tool');
    else for (let y = yB + 6; y < yC - 6; y += 6) h += DK.line(bc - Fp / 2 + 2, y, bc + Fp / 2 - 2, y, 'thin');
    h += DK.cl(fixed ? bc + off / 2 : bc, top - 14, fixed ? bc + off / 2 : bc, bot + 14) + DK.line(bc + off, yA - 4, bc + off, yB + 4, 'hid');
    if (!fixed) h += DK.line(bc - off, yB - 4, bc - off, yC + 4, 'hid');
    // Sizes.
    h += DK.dimH(bc + off - Hp / 2, bc + off + Hp / 2, top - 14, 'H ' + DK.n(v.H, dp), { from: yA });
    h += DK.dimH(bc - Fp / 2, bc + Fp / 2, Math.min(H - 30, bot + 22), 'F ' + DK.n(v.F, dp), { from: bot, below: true });
    let lab = '';
    lab += DK.text(x1 - 6, yA + 28, fixed ? 'clearance hole part' : 'part 1', { cls: 'txt', anchor: 'end' }) + DK.text(x1 - 6, yB + 28, fixed ? 'threaded part' : 'part 2', { cls: 'txt', anchor: 'end' });
    const tl = (t, y, cls, size) => DK.text(330, y, t, { cls: cls || 'txt', anchor: 'start', size });
    lab += tl(fixed ? 'Fixed fastener' : 'Floating fastener', 40);
    lab += tl(fixed ? 't1 + t2 = H − F = ' + DK.n(v.H - v.F, dp) : 'T = H − F', 60, 'mut');
    if (deFin(T)) lab += tl('Ø ' + DK.n(T, dp) + ' ' + u, 92, 'hott', 18) + tl(fixed ? 'each part, equal split, at MMC' : 'position at MMC, each part', 110, 'mut');
    const t2 = deV(rows, 'Left for the clearance-hole part');
    if (fixed && deFin(t2)) lab += tl('with t1 ' + DK.n(v.t1, dp) + ': clearance part Ø ' + DK.n(t2, dp), 132, 'txt');
    lab += deLines(330, 176, ['Worst case: the holes sit at the edges', 'of their zones (shifted ± T/2 from the', 'true position, chain line) and the', 'fastener at MMC still just fits.', 'Clearance exaggerated.']);
    return DK.svg(W, H, h + lab, 'Fastener position tolerance, worst case');
  },

  // Unequal profile: the true profile with the zone split u outside and t − u inside, the equal-zone offset, and the measured point.
  gdtprofu(v, sys, rows) {
    const W = 520, H = 280, u = deU(sys), dp = deDp(sys);
    if (!(v.t > 0 && v.u >= 0 && v.u <= v.t)) return '';
    const k = 64 / v.t, x0 = 30, x1 = 400, N = 60;
    const base = x => 150 - 34 * Math.sin(Math.PI * (x - x0) / (x1 - x0)) + 10 * Math.sin(3 * Math.PI * (x - x0) / (x1 - x0));
    const pt = (i, off) => { // point offset normal to the profile (outside = up)
      const x = x0 + (x1 - x0) * i / N, e = 0.5, dy = (base(x + e) - base(x - e)) / (2 * e), L = Math.hypot(1, dy);
      return [x + off * dy / L, base(x) - off / L];
    };
    const curve = off => { const p = []; for (let i = 0; i <= N; i++) p.push(pt(i, off)); return p; };
    const out = curve(v.u * k), inn = curve(-(v.t - v.u) * k), nom = curve(0);
    let h = dePoly(nom.concat([[x1, 250], [x0, 250]]), 'hatch');
    h += dePoly(out.concat(inn.slice().reverse()), 'tool');
    h += dePoly(nom, 'ln', false) + dePoly(curve((v.u - v.t / 2) * k), 'cl', false);
    // Dimensions at the right end.
    const xr = x1, yn = base(x1), yo = yn - v.u * k, yi = yn + (v.t - v.u) * k;
    h += DK.line(x1, yo, x1 + 22, yo, 'dim ext') + DK.line(x1, yi, x1 + 22, yi, 'dim ext') + DK.line(x1, yn, x1 + 54, yn, 'dim ext');
    if (v.u > 0) h += deDimV(yo, yn, xr + 50, '', {}) + DK.text(xr + 60, (yo + yn) / 2 + 4, 'u ' + DK.n(v.u, dp), { cls: 'dimt', anchor: 'start' });
    if (v.t - v.u > 0) h += deDimV(yn, yi, xr + 50, '', {}) + DK.text(xr + 60, (yn + yi) / 2 + 4, 't − u ' + DK.n(v.t - v.u, dp), { cls: 'dimt', anchor: 'start' });
    h += deDimV(yo, yi, xr + 18, '', { hot: true }) + DK.text(xr + 14, yi + 16, 't ' + DK.n(v.t, dp), { cls: 'hott', anchor: 'start' });
    h += DK.text(70, 250 - 8, 'material', { cls: 'mut', anchor: 'start' }) + DK.text(70, 40, 'outside the material (adds material)', { cls: 'mut', anchor: 'start' });
    const off = deV(rows, 'offset');
    h += DK.leader(pt(14, (v.u - v.t / 2) * k)[0], pt(14, (v.u - v.t / 2) * k)[1], 120, 80, 'equal-zone profile: offset ' + (deFin(off) ? DK.n(off, dp) : '?') + ', ± ' + DK.n(v.t / 2, dp), { anchor: 'start' });
    if (deFin(v.e)) {
      const res = deRow(rows, /^Result$/), e = deClamp(v.e, -1.4 * v.t, 1.4 * v.t), p = pt(N * 0.62, e * k);
      h += DK.circle(p[0], p[1], 4.5, 'hotf') + DK.leader(p[0] + 3, p[1] + 3, 300, 236, 'measured ' + DK.n(v.e, dp) + (res ? ': ' + res.value : ''), { anchor: 'start', hot: true });
    }
    h += DK.text(30, H - 8, 'Zone (orange) much enlarged against the part. Sizes in ' + u + '.', { cls: 'mut', anchor: 'start' });
    return DK.svg(W, H, h, 'Unequally disposed profile zone');
  },

  // Bend: the sheet in side view with the inside radius, the neutral line at K t (bend allowance), setbacks and flanges.
  bend(v, sys, rows) {
    const W = 520, H = 300, u = deU(sys), dp = deDp(sys);
    if (!(v.t > 0 && v.r >= 0 && v.a > 0 && v.a < 180)) return '';
    const t = v.t, r = v.r, a = v.a * Math.PI / 180, K = v.k >= 0 && v.k <= 1 ? v.k : NaN;
    const ossb = deV(rows, 'Outside setback'), BA = deV(rows, 'Bend allowance'), BD = deV(rows, 'Bend deduction'), flat = deV(rows, 'Flat length');
    const ro = r + t, os = deFin(ossb) ? ossb : Math.tan(a / 2) * ro;
    // Straight lengths beyond the tangent points; long flanges are drawn shortened (break mark).
    const cap = 2.2 * Math.max(ro, os) + 3 * t, Lr1 = v.f1 > os ? v.f1 - os : NaN, Lr2 = v.f2 > os ? v.f2 - os : NaN;
    const L1 = deFin(Lr1) ? Math.min(Lr1, cap) : cap, L2 = deFin(Lr2) ? Math.min(Lr2, cap) : cap;
    const brk1 = deFin(Lr1) && Lr1 > cap * 1.02, brk2 = deFin(Lr2) && Lr2 > cap * 1.02;
    // Units, y up; bend centre at the origin; flange 1 runs left along y = -r..-(r + t).
    const d2 = [Math.cos(a), Math.sin(a)], P = (ang, rad) => [rad * Math.cos(ang), rad * Math.sin(ang)];
    const a0 = -Math.PI / 2, a1 = -Math.PI / 2 + a;
    const arc = (rad, n) => { const p = []; for (let i = 0; i <= n; i++) p.push(P(a0 + a * i / n, rad)); return p; };
    const e2 = (rad, L) => { const q = P(a1, rad); return [q[0] + d2[0] * L, q[1] + d2[1] * L]; };
    const outer = [[-L1, -ro]].concat(arc(ro, 30), [e2(ro, L2)]), inner = [[-L1, -r]].concat(arc(r, 30), [e2(r, L2)]);
    const vs = [os, -ro]; // virtual sharp of the outer mould lines
    const all = outer.concat(inner, [vs, [0, 0]]);
    const minX = Math.min(...all.map(p => p[0])), maxX = Math.max(...all.map(p => p[0])), minY = Math.min(...all.map(p => p[1])), maxY = Math.max(...all.map(p => p[1]));
    const s = Math.min(270 / (maxX - minX), 200 / (maxY - minY)), ox = 30 - minX * s, oy = 26 + maxY * s;
    const X = p => [ox + p[0] * s, oy - p[1] * s];
    let h = dePoly(outer.map(X).concat(inner.slice().reverse().map(X)), 'part');
    // Break marks across shortened flanges.
    const brk = (p, n) => { const q = X(p), m = [-n[1], n[0]], L = t * s + 10; return dePoly([[q[0] + m[0] * L / 2, q[1] - m[1] * L / 2], [q[0] + m[0] * 3 + n[0] * 4, q[1] - m[1] * 3 - n[1] * 4], [q[0] - m[0] * 3 - n[0] * 4, q[1] + m[1] * 3 + n[1] * 4], [q[0] - m[0] * L / 2, q[1] + m[1] * L / 2]], 'ln', false); };
    if (brk1) h += brk([-L1 * 0.55, -r - t / 2], [1, 0]);
    if (brk2) { const q = e2(r + t / 2, L2 * 0.55); h += brk(q, d2); }
    const C = X([0, 0]), V = X(vs), T1 = X(P(a0, ro)), T2 = X(P(a1, ro));
    // Mould lines to the virtual sharp and the bend radii.
    h += DK.line(T1[0], T1[1], V[0], V[1], 'ghost') + DK.line(T2[0], T2[1], V[0], V[1], 'ghost') + DK.circle(V[0], V[1], 2.5, 'txt');
    h += DK.line(C[0], C[1], T1[0], T1[1], 'thin') + DK.line(C[0], C[1], T2[0], T2[1], 'thin') + DK.circle(C[0], C[1], 2, 'txt');
    let lab = '';
    if (deFin(K)) {
      const rn = r + K * t, na = arc(rn, 30).map(X), q0 = X([-L1, -rn]), q1 = X(e2(rn, L2));
      h += DK.line(q0[0], q0[1], na[0][0], na[0][1], 'cl') + DK.line(na[na.length - 1][0], na[na.length - 1][1], q1[0], q1[1], 'cl');
      h += '<path class="hot" style="stroke-width:3" d="M' + na.map(p => deF(p[0]) + ' ' + deF(p[1])).join('L') + '"/>';
      const mid = X(P(a0 + a / 2, rn));
      const lx = Math.min(mid[0] + 60, 392), ly = Math.min(mid[1] + 56, H - 64);
      lab += DK.leader(mid[0], mid[1], lx, ly, 'BA ' + (deFin(BA) ? DK.n(BA, dp) + ' ' + u : '?'), { anchor: 'start', hot: true });
      lab += DK.text(lx + 4, ly + 16, 'neutral line, R + K t', { cls: 'mut', anchor: 'start' });
    }
    if (r > 0) { const q = X(P(a0 + a * 0.6, r)); lab += DK.leader(q[0], q[1], Math.max(60, C[0] - 50), Math.max(16, C[1] - 40), 'R ' + DK.n(r, dp), { anchor: 'end' }); }
    // Thickness, setback, flanges and angle.
    const tx = X([-L1 * 0.3, 0])[0];
    lab += deDimV(X([0, -r])[1], X([0, -ro])[1], tx, 't ' + DK.n(t, dp), { from: tx });
    const yo = X([0, -ro])[1];
    lab += DK.dimH(T1[0], V[0], yo + 20, 'OSSB ' + (deFin(ossb) ? DK.n(ossb, dp) : ''), { from: yo, below: true });
    if (v.f1 > 0) lab += DK.dimH(X([-L1, 0])[0], V[0], yo + 50, 'f1 ' + DK.n(v.f1, dp) + (brk1 ? ' (shortened)' : ''), { from: yo, below: true });
    lab += DK.angle(V[0], V[1], 26, 0, v.a, DK.n(v.a, 2) + '°');
    lab += deLines(340, 40, ['K ' + (deFin(K) ? DK.n(K, 3) : 'not entered'), deFin(BD) ? 'bend deduction ' + DK.n(BD, dp) : '', deFin(flat) ? 'flat length ' + DK.n(flat, dp) + ' ' + u : '', v.f2 > 0 ? 'f2 ' + DK.n(v.f2, dp) + (brk2 ? ' (shortened)' : '') : ''], { cls: 'txt' });
    lab += deLines(340, 112, ['Mould lines dashed to the', 'virtual sharp (dot).']);
    return DK.svg(W, H, h + lab, 'Sheet-metal bend with neutral line and bend allowance');
  },

  // Refractometer: the reading on the prism scale and the concentration against the recommended range.
  coolconc(v, sys, rows) {
    const W = 520, H = 240;
    if (!(v.brix >= 0)) return '';
    const c = deV(rows, /^Concentration$/), top = Math.max(10, Math.ceil((v.brix * 1.4 + 0.1) / 5) * 5);
    const cx = 110, cy = 118, R = 88, Y = b => cy + R * 0.8 - 1.6 * R * 0.8 * b / top;
    let h = '<clipPath id="declip-refr"><circle cx="' + cx + '" cy="' + cy + '" r="' + R + '"/></clipPath><g clip-path="url(#declip-refr)">';
    h += DK.rect(cx - R, cy - R, 2 * R, 2 * R, 'part') + DK.rect(cx - R, cy - R, 2 * R, Y(v.brix) - cy + R, 'tool');
    for (let b = 0; b <= top; b += top > 20 ? 2 : 1) {
      const y = Y(b), big = b % 5 === 0;
      h += DK.line(cx - 10, y, cx - 10 + (big ? 22 : 12), y, 'ln');
      if (big) h += DK.text(cx + 18, y + 4, String(b), { cls: 'txt', anchor: 'start' });
    }
    h += DK.line(cx - 10, Y(0), cx - 10, Y(top), 'ln') + DK.line(cx - R, Y(v.brix), cx + R, Y(v.brix), 'hot') + '</g>';
    h += DK.circle(cx, cy, R, 'ln') + DK.circle(cx, cy, R + 7, 'thin');
    h += DK.text(cx, H - 6, 'Brix scale: line at ' + DK.n(v.brix, 2), { cls: 'hott' });
    // Gauge.
    if (deFin(c)) {
      const gx0 = 250, gx1 = 500, gy = 120, cmax = Math.max(10, Math.ceil(Math.max(c, v.hi || 0) * 1.3 / 5) * 5), X = q => gx0 + (gx1 - gx0) * q / cmax;
      h += DK.rect(gx0, gy - 10, gx1 - gx0, 20, 'part');
      if (v.lo > 0 || v.hi > 0) { const lo = v.lo > 0 ? v.lo : 0, hi = v.hi > 0 ? v.hi : cmax; h += DK.rect(X(lo), gy - 10, X(hi) - X(lo), 20, 'tool') + DK.text((X(lo) + X(hi)) / 2, gy + 48, 'recommended range', { cls: 'mut' }); }
      for (let q = 0; q <= cmax; q += cmax > 20 ? 5 : 1) { const big = q % 5 === 0; h += DK.line(X(q), gy + 10, X(q), gy + (big ? 18 : 14), 'thin'); if (big) h += DK.text(X(q), gy + 30, String(q), { cls: 'mut' }); }
      const xc = X(deClamp(c, 0, cmax));
      h += dePoly([[xc, gy - 12], [xc - 7, gy - 26], [xc + 7, gy - 26]], 'hotf') + DK.line(xc, gy - 12, xc, gy + 10, 'hot');
      h += DK.text(xc, gy - 34, DK.n(c, 2) + ' %', { cls: 'hott', size: 16 });
      const st = rows.find(r => /range/i.test(r.label));
      h += DK.text((gx0 + gx1) / 2, 62, 'Concentration = reading × factor ' + deIn(v.k, 3, '', 'k'), { cls: 'txt' });
      if (st) h += DK.text((gx0 + gx1) / 2, 200, st.label.replace(/\s*\(.*\)/, ''), { cls: 'mut' });
    } else h += DK.text(380, 120, 'Enter the refractometer factor', { cls: 'mut' });
    return DK.svg(W, H, h, 'Refractometer reading and coolant concentration');
  },

  // Coolant mix: the sump with what is in it now, what to add, and the top-up to full.
  coolmix(v, sys, rows) {
    const W = 520, H = 270, u = sys === 'inch' ? 'gal' : 'L';
    if (!(v.v > 0 && v.t > 0)) return '';
    const fresh = !deFin(v.c), add = fresh ? NaN : deV(rows, /to add/), after = deV(rows, 'Volume after');
    const conc = rows.some(r => /^Concentrate to add/.test(r.label)), mix = deV(rows, 'mix strength'), tk = deV(rows, 'Top-up: concentrate'), tw = deV(rows, 'Top-up: water');
    const vmax = Math.max(v.v, deFin(after) ? after : 0, v.full > 0 ? v.full : 0) * 1.08;
    const tank = (x, w, layers, full, title) => {
      const y0 = 222, hgt = 170, Y = q => y0 - hgt * q / vmax; let g = '';
      let acc = 0;
      layers.forEach(L => {
        if (!(L.q > 0)) return;
        const ya = Y(acc + L.q), yb = Y(acc), cls = L.cls === 'tool' ? 'hott' : 'txt';
        g += DK.rect(x + 2, ya, w - 4, yb - ya, L.cls);
        if (yb - ya >= 18) g += DK.text(x + w / 2, (ya + yb) / 2 + 4, L.t, { cls });
        else g += DK.leader(x + w / 2, (ya + yb) / 2, x + w / 2, 24, L.t, { anchor: 'middle', hot: L.cls === 'tool' });
        acc += L.q;
      });
      g += dePoly([[x, y0 - hgt - 8], [x, y0], [x + w, y0], [x + w, y0 - hgt - 8]], 'ln', false);
      if (full > 0) g += DK.line(x - 8, Y(full), x + w + 8, Y(full), 'hid') + DK.text(x + w + 10, Y(full) + 4, 'full ' + DK.n(full, 1), { cls: 'mut', anchor: 'start' });
      return g + DK.text(x + w / 2, 246, title, { cls: 'txt' });
    };
    let h = '';
    if (fresh) {
      const kq = deV(rows, 'Fresh fill: concentrate'), wq = deV(rows, 'Fresh fill: water');
      h += tank(150, 150, [{ q: wq, cls: 'part', t: 'water ' + DK.n(wq, 2) + ' ' + u }, { q: kq, cls: 'tool', t: '+ concentrate ' + DK.n(kq, 2) + ' ' + u }], 0, 'Fresh fill to ' + DK.n(v.v, 1) + ' ' + u + ' at ' + DK.n(v.t, 2) + ' %');
      return DK.svg(W, H, h, 'Fresh coolant fill');
    }
    const two = deFin(mix) && deFin(tk);
    const x1 = two ? 36 : 160;
    h += tank(x1, 140, [{ q: v.v, cls: 'part', t: 'now ' + DK.n(v.v, 1) + ' ' + u + ' at ' + DK.n(v.c, 2) + ' %' }, { q: add, cls: 'tool', t: '+ ' + DK.n(add, 2) + ' ' + u + ' ' + (conc ? 'concentrate' : 'water') }], v.full, deFin(add) ? 'Adjust to ' + DK.n(v.t, 2) + ' %' + (deFin(after) ? ': ' + DK.n(after, 1) + ' ' + u : '') : 'Already at ' + DK.n(v.t, 2) + ' %');
    if (two) h += tank(326, 130, [{ q: v.v, cls: 'part', t: 'now ' + DK.n(v.v, 1) + ' ' + u }, { q: v.full - v.v, cls: 'tool', t: 'top up at ' + DK.n(mix, 2) + ' %' }], v.full, 'Or top up: ' + DK.n(tk, 2) + ' conc. + ' + DK.n(tw, 2) + ' water');
    return DK.svg(W, H, h, 'Coolant sump: adjust or top up');
  },
});

// ---------- mechanics ----------
// Outline of a mechanics section (units, origin lower left, y up) from the shared section fields: { polys, holes, circ }.
function deSecShape(v) {
  const a = typeof mkSecArgs === 'function' ? mkSecArgs(v) : null;
  if (!a || !a.slice(1).some(x => x > 0)) return null;
  const [sh, p1, p2, p3, p4] = a;
  const ok = (...x) => x.every(q => q > 0);
  switch (sh) {
    case 0: return ok(p1, p2) ? { w: p1, h: p2, poly: [[0, 0], [p1, 0], [p1, p2], [0, p2]] } : null;
    case 1: return ok(p1, p2, p3) && 2 * p3 < Math.min(p1, p2) ? { w: p1, h: p2, poly: [[0, 0], [p1, 0], [p1, p2], [0, p2]], hole: [[p3, p3], [p1 - p3, p3], [p1 - p3, p2 - p3], [p3, p2 - p3]] } : null;
    case 2: return ok(p1) ? { w: p1, h: p1, circ: [p1 / 2, 0] } : null;
    case 3: return ok(p1) && p2 < p1 ? { w: p1, h: p1, circ: [p1 / 2, p2 > 0 ? p2 / 2 : 0] } : null;
    case 4: { const b = p1, h = p2, tf = p3, tw = p4; if (!ok(b, h, tf, tw) || 2 * tf >= h || tw >= b) return null;
      const l = (b - tw) / 2, r = (b + tw) / 2; return { w: b, h, poly: [[0, 0], [b, 0], [b, tf], [r, tf], [r, h - tf], [b, h - tf], [b, h], [0, h], [0, h - tf], [l, h - tf], [l, tf], [0, tf]] }; }
    case 5: { const b = p1, h = p2, tf = p3, tw = p4; if (!ok(b, h, tf, tw) || 2 * tf >= h || tw >= b) return null;
      return { w: b, h, poly: [[0, 0], [b, 0], [b, tf], [tw, tf], [tw, h - tf], [b, h - tf], [b, h], [0, h]] }; }
    case 6: { const h = p1, b = p2, t = p3; if (!ok(b, h, t) || t >= Math.min(b, h)) return null;
      return { w: b, h, poly: [[0, 0], [b, 0], [b, t], [t, t], [t, h], [0, h]] }; }
    case 7: { const b = p1, h = p2, tf = p3, tw = p4; if (!ok(b, h, tf, tw) || tf >= h || tw >= b) return null;
      const l = (b - tw) / 2, r = (b + tw) / 2; return { w: b, h, poly: [[0, h], [b, h], [b, h - tf], [r, h - tf], [r, 0], [l, 0], [l, h - tf], [0, h - tf]] }; }
  }
  return null;
}
// Section drawn at (ox, oy) = screen position of the origin, k px per unit, as a hatched cut face.
function deSecSvg(S, ox, oy, k, cls) {
  const X = p => [ox + p[0] * k, oy - p[1] * k];
  if (S.circ) {
    const c = X([S.w / 2, S.h / 2]), R = S.circ[0] * k, r = S.circ[1] * k;
    if (!(r > 0)) return DK.circle(c[0], c[1], R, cls || 'hatch');
    return '<path class="' + (cls || 'hatch') + '" fill-rule="evenodd" d="' + [R, r].map(q => 'M' + deF(c[0] + q) + ' ' + deF(c[1]) + 'A' + deF(q) + ' ' + deF(q) + ' 0 1 0 ' + deF(c[0] - q) + ' ' + deF(c[1]) + 'A' + deF(q) + ' ' + deF(q) + ' 0 1 0 ' + deF(c[0] + q) + ' ' + deF(c[1]) + 'Z').join('') + '"/>';
  }
  const d = pts => 'M' + pts.map(p => X(p).map(deF).join(' ')).join('L') + 'Z';
  return '<path class="' + (cls || 'hatch') + '" fill-rule="evenodd" d="' + d(S.poly) + (S.hole ? d(S.hole) : '') + '"/>';
}
// Centroid symbol: a circle with two filled quarters.
const deCentroid = (x, y, r) => DK.circle(x, y, r, 'ln') + '<path class="txt" d="M' + deF(x) + ' ' + deF(y) + 'L' + deF(x + r) + ' ' + deF(y) + 'A' + r + ' ' + r + ' 0 0 0 ' + deF(x) + ' ' + deF(y - r) + 'ZM' + deF(x) + ' ' + deF(y) + 'L' + deF(x - r) + ' ' + deF(y) + 'A' + r + ' ' + r + ' 0 0 0 ' + deF(x) + ' ' + deF(y + r) + 'Z"/>';

Object.assign(DIAGRAMS, {
  // Section: the cut face hatched, centroidal axes through the centroid, principal axis when tilted, sizes and I.
  section(v, sys, rows) {
    const W = 520, H = 290, u = mku(sys), S = deSecShape(v);
    if (!S) return '';
    const xc = deV(rows, 'Centroid x'), yc = deV(rows, 'Centroid y');
    if (!deFin(xc) || !deFin(yc)) return '';
    const k = Math.min(220 / S.w, 210 / S.h), ox = 80 + (220 - S.w * k) / 2, oy = 245 - (210 - S.h * k) / 2;
    const X = p => [ox + p[0] * k, oy - p[1] * k], c = X([xc, yc]), x0 = ox, x1 = ox + S.w * k, yt = oy - S.h * k;
    let h = deSecSvg(S, ox, oy, k);
    h += DK.cl(x0 - 18, c[1], x1 + 22, c[1]) + DK.cl(c[0], yt - 18, c[0], oy + 18);
    h += DK.text(x1 + 26, c[1] + 4, 'x', { cls: 'txt', anchor: 'start' }) + DK.text(c[0] + 5, yt - 20, 'y', { cls: 'txt', anchor: 'start' });
    const ang = deV(rows, 'Angle of the I1 axis');
    if (deFin(ang)) {
      const t = ang * Math.PI / 180, L = Math.max(S.w, S.h) * k * 0.62;
      h += DK.line(c[0] - L * Math.cos(t), c[1] + L * Math.sin(t), c[0] + L * Math.cos(t), c[1] - L * Math.sin(t), 'hot') + DK.text(c[0] + (L + 10) * Math.cos(t), c[1] - (L + 10) * Math.sin(t) + 4, '1', { cls: 'hott' });
      h += DK.angle(c[0], c[1], 34, 0, ang, DK.n(ang, 1) + '°', { hot: true });
    }
    h += deCentroid(c[0], c[1], 6);
    // Overall sizes and the centroid position from the lower left.
    h += DK.dimH(x0, x1, oy + 26, (S.circ ? 'Ø ' : 'b ') + DK.n(S.w, u.dp), { from: oy, below: true });
    if (!S.circ) h += deDimV(yt, oy, x0 - 26, 'h ' + DK.n(S.h, u.dp), { from: x0 });
    if (!S.circ) h += deDimV(c[1], oy, x1 + 44, 'ȳ ' + DK.n(yc, u.dp), { hot: true, from: x1 });
    if (!S.circ && Math.abs(xc - S.w / 2) > 1e-6 * S.w) h += DK.dimH(x0, c[0], yt - 12, 'x̄ ' + DK.n(xc, u.dp), { hot: true, from: yt });
    const L = [['A', 'Area A', u.A], ['Ix', 'Ix (about', u.I], ['Iy', 'Iy (about', u.I], ['Sx', 'Sx, top', u.Z], ['r min', 'Least radius', u.L]];
    let y = 40;
    L.forEach(q => { const val = deV(rows, q[1]); if (!deFin(val)) return; h += DK.text(392, y, q[0], { cls: 'mut', anchor: 'start' }) + DK.text(422, y, DK.n(val, val >= 1000 ? 0 : 4) + ' ' + q[2], { cls: q[0] === 'Ix' ? 'hott' : 'dimt', anchor: 'start' }); y += 18; });
    h += deLines(392, y + 10, ['x, y: centroidal axes', deFin(ang) ? '1: principal axis (I1)' : '', 'cut face hatched']);
    return DK.svg(W, H, h, 'Section with centroid and axes');
  },

  // Beam: supports, loads, the deflected shape (exaggerated) and the bending moment diagram, with the results.
  beam(v, sys, rows) {
    const W = 520, H = 310, u = mku(sys), L = v.L, sup = v.sup;
    const P = deFin(v.P) ? v.P : 0, wl = deFin(v.w) ? v.w : 0;
    if (!(L > 0) || !(P || wl) || !state || !state.W) return '';
    const a = P ? (v.a >= 0 && v.a <= L ? v.a : (sup === 0 ? L : L / 2)) : 0, Wm = state.W;
    const x0 = 60, x1 = 420, by = 96, X = x => x0 + (x1 - x0) * x / L, N = 80;
    const ys = [], ms = [];
    for (let i = 0; i <= N; i++) { const x = L * i / N; ys.push(Wm.mech_beam_at(sup, L, a, P, wl, 1, x, 0)); ms.push(Wm.mech_beam_at(sup, L, a, P, wl, 1, x, 2)); }
    if (!ys.every(deFin) || !ms.every(deFin)) return '';
    const ymax = Math.max(...ys.map(Math.abs)) || 1, mmax = Math.max(...ms.map(Math.abs)) || 1;
    let h = '';
    // Beam (as a bar of some depth) and the deflected shape.
    h += DK.rect(x0, by - 5, x1 - x0, 10, 'part');
    const def = ys.map((y, i) => [X(L * i / N), by + 30 * y / ymax]);
    h += dePoly(def, 'hot', false);
    // Supports.
    if (sup === 0) h += deWall(x0, by - 26, by + 26, true);
    else if (sup === 1) h += dePinSup(x0, by + 5) + deRollSup(x1, by + 5);
    else h += deWall(x0, by - 26, by + 26, true) + deWall(x1, by - 26, by + 26, false);
    // Loads.
    let lab = '';
    if (P) { const xp = X(a), up = P < 0; h += up ? deArrow(xp, by + 52, xp, by + 7, 'ln') : deArrow(xp, by - 52, xp, by - 7, 'ln'); lab += DK.text(xp + 6, up ? by + 50 : by - 42, 'P ' + DK.n(v.P, 2) + ' ' + u.F, { cls: 'txt', anchor: xp > 330 ? 'end' : 'start' }); }
    if (wl) { const yt = by - 26; h += DK.line(x0, yt, x1, yt, 'ln'); for (let i = 0; i <= 12; i++) { const xx = x0 + (x1 - x0) * i / 12; h += deArrow(xx, yt, xx, by - 6, 'thin'); } lab += DK.text(x0 + 4, yt - 6, 'w ' + DK.n(v.w, 3) + ' ' + u.w, { cls: 'txt', anchor: 'start' }); }
    // Largest deflection.
    const dmax = deV(rows, 'Largest deflection'), xd = deV(rows, /^at x from the left end$/);
    let im = 0; ys.forEach((y, i) => { if (Math.abs(y) > Math.abs(ys[im])) im = i; });
    const dp = def[im];
    const dx = deClamp(dp[0], 150, 330);
    lab += DK.circle(dp[0], dp[1], 3, 'hotf') + DK.text(dx, dp[1] + (ys[im] > 0 ? 20 : -10), deFin(dmax) ? 'δ max ' + DK.n(dmax, sys === 'inch' ? 5 : 4) + ' ' + u.L : 'δ (enter E and section)', { cls: 'hott' });
    void xd;
    // Reactions.
    const RL = deV(rows, 'Left reaction'), RR = deV(rows, 'Right reaction');
    if (deFin(RL)) lab += DK.text(x0 - 6, by + 44, 'R ' + DK.n(RL, 1), { cls: 'dimt', anchor: 'middle' });
    if (deFin(RR) && sup !== 0) lab += DK.text(x1 + 6, by + 44, 'R ' + DK.n(RR, 1), { cls: 'dimt', anchor: 'middle' });
    lab += DK.dimH(x0, x1, by + 64, 'L ' + DK.n(L, u.dp) + ' ' + u.L, { below: true });
    if (P && Math.abs(X(a) - x0) > 36 && Math.abs(X(a) - x1) > 1) lab += DK.dimH(x0, X(a), by - 66, 'a ' + DK.n(a, u.dp), { from: by - 54 });
    // Bending moment diagram.
    const my = 238, mh = 30, mp = ms.map((m, i) => [X(L * i / N), my - mh * m / mmax]);
    h += dePoly([[x0, my]].concat(mp, [[x1, my]]), 'tool') + DK.line(x0 - 6, my, x1 + 6, my, 'thin');
    const Mx = deV(rows, 'Largest bending moment'), xmRow = rows.filter(r => /^at x from the left end$/.test(r.label))[0];
    let jm = 0; ms.forEach((m, i) => { if (Math.abs(m) > Math.abs(ms[jm])) jm = i; });
    lab += DK.text(mp[jm][0] + (mp[jm][0] > 330 ? -6 : 6), mp[jm][1] + (ms[jm] > 0 ? -6 : 14), 'M max ' + (deFin(Mx) ? DK.n(Mx, 2) + ' ' + u.M : ''), { cls: 'hott', anchor: mp[jm][0] > 330 ? 'end' : 'start' });
    void xmRow;
    lab += DK.text(x0 - 10, my + 4, 'M', { cls: 'mut', anchor: 'end' }) + DK.text(x1 + 12, by + 4, '', {});
    const st = deV(rows, 'Largest bending stress');
    lab += deLines(434, 30, ['shape', 'exaggerated', deFin(st) ? '' : '', ''], {});
    if (deFin(st)) lab += DK.text(W - 6, 300, 'bending stress ' + DK.n(st, u.sdp) + ' ' + u.S, { cls: 'hott', anchor: 'end' });
    lab += DK.text(x0 - 10, my - mh - 16, 'Bending moment (sagging up)', { cls: 'mut', anchor: 'start' });
    return DK.svg(W, H, h + lab, 'Beam with loads, deflected shape and moment diagram');
  },

  // Torsion: the shaft with the torque at both ends, the twist of a surface line and the shear stress across the section.
  torsion(v, sys, rows) {
    const W = 520, H = 270, u = mku(sys), inch = sys === 'inch';
    if (!(v.D > 0)) return '';
    const di = v.d > 0 && v.d < v.D ? v.d : 0, T = deV(rows, /^Torque/), tau = deV(rows, 'Largest shear stress'), phi = deV(rows, /^Angle of twist$/);
    const Dp = 96, cy = 120, x0 = 70, x1 = deClamp(v.L > 0 ? x0 + Dp * v.L / v.D : 300, 190, 320), R = Dp / 2;
    let h = DK.rect(x0, cy - R, x1 - x0, Dp, 'part');
    if (di > 0) { const r = R * di / v.D; h += DK.line(x0, cy - r, x1, cy - r, 'hid') + DK.line(x0, cy + r, x1, cy + r, 'hid'); }
    h += DK.cl(x0 - 18, cy, x1 + 18, cy);
    // A surface line before (dashed) and after twisting (orange), twist drawn exaggerated.
    const show = deFin(phi) ? deClamp(phi * 8, 18, 70) : 40, b0 = 50; // phi in degrees (first 'Angle of twist' row)
    const yAt = deg => cy - R * Math.cos(deg * Math.PI / 180);
    h += DK.line(x0, yAt(b0), x1, yAt(b0), 'ghost') + DK.line(x0, yAt(b0), x1, yAt(b0 - show), 'hot');
    // Torque arrows round the ends (half ellipses).
    const tq = (x, sg) => '<path class="ln" d="M' + deF(x) + ' ' + deF(cy - R - 14) + 'A12 ' + deF(R + 14) + ' 0 0 ' + (sg > 0 ? 1 : 0) + ' ' + deF(x) + ' ' + deF(cy + R + 14) + '"/>' + deHead(x - sg * 1, cy + R + 14, sg > 0 ? Math.PI : 0, 'txt');
    h += tq(x0 - 2, -1) + tq(x1 + 2, 1);
    let lab = DK.text(x1 + 14, cy - R - 22, 'T', { cls: 'txt', anchor: 'end' }) + DK.text(x0 - 14, cy - R - 22, 'T ' + (deFin(T) ? DK.n(T, 2) + ' ' + (inch ? 'lbf·in' : 'N·m') : '?'), { cls: 'txt', anchor: 'start' });
    lab += deDimV(cy - R, cy + R, x0 - 40, 'Ø ' + DK.n(v.D, u.dp), { from: x0 - 26 });
    if (v.L > 0) lab += DK.dimH(x0, x1, cy + R + 36, 'L ' + DK.n(v.L, u.dp) + ' ' + u.L, { from: cy + R + 16, below: true });
    if (di > 0) lab += DK.text((x0 + x1) / 2, cy + R * di / v.D - 5, 'bore Ø ' + DK.n(di, u.dp), { cls: 'mut' });
    // End view with the twist angle and the shear stress growing to the rim.
    const ex = 432, ey = cy - 6, er = 58;
    h += di > 0 ? '<path class="part" fill-rule="evenodd" d="M' + (ex + er) + ' ' + ey + 'A' + er + ' ' + er + ' 0 1 0 ' + (ex - er) + ' ' + ey + 'A' + er + ' ' + er + ' 0 1 0 ' + (ex + er) + ' ' + ey + 'ZM' + deF(ex + er * di / v.D) + ' ' + ey + 'A' + deF(er * di / v.D) + ' ' + deF(er * di / v.D) + ' 0 1 0 ' + deF(ex - er * di / v.D) + ' ' + ey + 'A' + deF(er * di / v.D) + ' ' + deF(er * di / v.D) + ' 0 1 0 ' + deF(ex + er * di / v.D) + ' ' + ey + 'Z"/>' : DK.circle(ex, ey, er, 'part');
    h += deCross(ex, ey, er + 10);
    // Shear stress: linear from the centre (or bore) to the rim, drawn along the horizontal radius.
    const ri = er * di / v.D;
    h += dePoly([[ex + ri, ey], [ex + er, ey], [ex + er, ey + 36], [ex + ri, ey + 36 * (ri / er)]], 'tool');
    lab += DK.text(ex + er + 4, ey + 50, 'τ ' + (deFin(tau) ? DK.n(tau, u.sdp) + ' ' + u.S : 'max'), { cls: 'hott', anchor: 'end' });
    const t0 = 120, t1 = t0 - show; // the surface line seen end-on, before and after the twist
    h += DK.line(ex, ey, ex + er * Math.cos(t0 * Math.PI / 180), ey - er * Math.sin(t0 * Math.PI / 180), 'ghost');
    h += DK.line(ex, ey, ex + er * Math.cos(t1 * Math.PI / 180), ey - er * Math.sin(t1 * Math.PI / 180), 'hot');
    lab += DK.angle(ex, ey, er * 0.7, t1, t0, 'φ', { hot: true });
    lab += DK.text(ex, ey + er + 34, 'twist φ ' + (deFin(phi) ? DK.n(phi, 3) + '°' : '(enter G and L)'), { cls: 'hott' });
    lab += DK.text(ex, ey + er + 50, 'end view, twist exaggerated', { cls: 'mut' });
    const pw = deRow(rows, /^Power at/);
    if (pw) lab += DK.text(x0, H - 10, pw.label + ': ' + DK.n(pw.value, pw.dp) + ' ' + pw.unit, { cls: 'txt', anchor: 'start' });
    return DK.svg(W, H, h + lab, 'Shaft in torsion with twist and shear stress');
  },

  // Column: the column with its end conditions, the buckled shape and the load, and the critical stress curve with this column on it.
  column(v, sys, rows) {
    const W = 520, H = 310, u = mku(sys), K = v.end > 0 ? v.end : v.K;
    if (!(K > 0 && v.L > 0)) return '';
    const lam = deV(rows, 'Slenderness K L / r'), Pcr = deV(rows, 'Critical load'), scr = deV(rows, 'Critical stress'), lt = deV(rows, 'Transition slenderness');
    const cx = 92, yt = 46, yb = 262, Lp = yb - yt;
    // End conditions from K: fixed bottom unless pinned-pinned; top fixed (0.5), pinned (0.7, 1) or free (2).
    const kind = K === 0.5 ? 'ff' : K === 0.7 ? 'fp' : K === 2 ? 'fr' : 'pp';
    const shape = t => { // lateral deflection 0..1 at height fraction t from the bottom
      if (kind === 'ff') return (1 - Math.cos(2 * Math.PI * t)) / 2;
      if (kind === 'fr') return 1 - Math.cos(Math.PI * t / 2);
      if (kind === 'fp') { const b = 4.4934; const f = x => (Math.sin(b * x) - b * x * Math.cos(b) / 1) ; void f; return Math.max(0, (1 - Math.cos(b * (1 - t)) + Math.sin(b * (1 - t)) / b * 0 - (1 - t) * (1 - Math.cos(b)))) / 1.6; }
      return Math.sin(Math.PI * t);
    };
    let h = DK.rect(cx - 7, yt, 14, Lp, 'part'), pts = [];
    for (let i = 0; i <= 40; i++) { const t = i / 40; pts.push([cx + 34 * shape(t), yb - Lp * t]); }
    h += dePoly(pts, 'hot', false) + DK.cl(cx, yt - 28, cx, yb + 10);
    // Supports.
    if (kind === 'pp') h += dePinSup(cx, yb) + dePoly([[cx, yt], [cx - 9, yt - 14], [cx + 9, yt - 14]], 'part') + deGround(cx - 14, cx + 14, yt - 14, false);
    else h += deGround(cx - 26, cx + 26, yb, true) + DK.rect(cx - 9, yb - 4, 18, 4, 'part');
    if (kind === 'ff') h += deGround(cx - 26, cx + 26, yt, false);
    if (kind === 'fp') h += dePoly([[cx, yt], [cx - 9, yt - 14], [cx + 9, yt - 14]], 'part') + deGround(cx - 14, cx + 14, yt - 14, false);
    h += deArrow(cx + 2, yt - 44, cx + 2, yt - (kind === 'fr' ? 2 : 16), 'hot');
    let lab = DK.text(cx + 14, yt - 30, 'P cr ' + (deFin(Pcr) ? DK.n(Pcr, 0) + ' ' + u.F : '?'), { cls: 'hott', anchor: 'start' });
    lab += deDimV(yt, yb, cx - 46, 'L ' + DK.n(v.L, u.dp), { from: cx - 12 });
    lab += DK.text(cx + 48, (yt + yb) / 2, 'K ' + DK.n(K, 2), { cls: 'txt', anchor: 'start' }) + DK.text(cx + 48, (yt + yb) / 2 + 15, 'KL ' + DK.n(K * v.L, u.dp), { cls: 'mut', anchor: 'start' });
    // Critical stress against slenderness.
    const Wm = state && state.W, E = v.E * u.eK, Sy = v.Sy * u.sK;
    if (Wm && E > 0 && Sy > 0 && deFin(lam)) {
      const gx0 = 260, gx1 = 500, gy0 = 236, gy1 = 50, lT = Math.sqrt(2 * Math.PI * Math.PI * E / Sy), lmax = Math.max(2.4 * lT, 1.25 * lam);
      const Xg = l => gx0 + (gx1 - gx0) * l / lmax, Yg = sg => gy0 - (gy0 - gy1) * Math.min(sg, Sy * 1.08) / (Sy * 1.08);
      const cur = (f, a, b) => { const p = []; for (let i = 0; i <= 50; i++) { const l = a + (b - a) * i / 50; p.push([Xg(l), Yg(f(l))]); } return p; };
      lab += DK.line(gx0, gy1 - 8, gx0, gy0, 'thin') + DK.line(gx0, gy0, gx1 + 4, gy0, 'thin');
      lab += dePoly(cur(l => Wm.mech_euler_stress(E, l), lT * 0.62, lT), 'ghost', false);
      lab += dePoly(cur(l => Wm.mech_johnson_stress(E, Sy, l), 0, lT).concat(cur(l => Wm.mech_euler_stress(E, l), lT, lmax)), 'ln', false);
      lab += DK.line(Xg(lT), gy0, Xg(lT), Yg(Sy / 2), 'hid') + DK.text(Xg(lT), gy0 + 14, 'λ₁ ' + DK.n(deFin(lt) ? lt : lT, 0), { cls: 'mut' });
      lab += DK.text(gx0 - 4, Yg(Sy) + 4, 'Sy', { cls: 'mut', anchor: 'end' }) + DK.line(gx0 - 2, Yg(Sy), gx0 + 4, Yg(Sy), 'thin');
      lab += DK.text(Xg(lT * 0.4), Yg(Wm.mech_johnson_stress(E, Sy, lT * 0.4)) + 20, 'Johnson', { cls: 'mut' }) + DK.text(Xg(Math.min(lT * 1.6, lmax * 0.85)), Yg(Wm.mech_euler_stress(E, Math.min(lT * 1.6, lmax * 0.85))) + 20, 'Euler', { cls: 'mut', anchor: 'start' });
      const sc = deFin(scr) ? scr * u.sK : (lam < lT ? Wm.mech_johnson_stress(E, Sy, lam) : Wm.mech_euler_stress(E, lam));
      const px = Xg(Math.min(lam, lmax)), py = Yg(sc);
      lab += DK.line(px, gy0, px, py, 'hot ext') + DK.circle(px, py, 4.5, 'hotf');
      lab += DK.text(px + (px > 420 ? -8 : 8), py - 8, 'σ cr ' + (deFin(scr) ? DK.n(scr, u.sdp) + ' ' + u.S : ''), { cls: 'hott', anchor: px > 420 ? 'end' : 'start' });
      lab += DK.text(px, gy0 + 28, 'KL/r ' + DK.n(lam, 1), { cls: 'hott' }) + DK.text(gx1, gy0 + 28, '', {});
      lab += DK.text(gx0, gy1 - 16, 'critical stress', { cls: 'mut', anchor: 'start' }) + DK.text(gx1, gy0 + 44, 'slenderness KL / r', { cls: 'mut', anchor: 'end' });
    } else lab += deLines(260, 120, [deFin(lam) ? 'Slenderness KL/r ' + DK.n(lam, 1) : '', 'Enter E and Sy for the', 'critical stress curve.']);
    return DK.svg(W, H, h + lab, 'Column buckling: end conditions, shape and critical stress');
  },

  // Stress concentration: the plate with the hole under tension and the stress across the net section rising to the peak.
  stressconc(v, sys, rows) {
    const W = 520, H = 270, u = mku(sys);
    if (v.case === 1) {
      if (!(v.W > 0 && v.d > 0 && v.d < v.W)) return '';
      const kt = deV(rows, 'Kt (on the net'), pk = deV(rows, 'Peak stress at the hole'), sn = deV(rows, 'Net-section stress');
      const Wp = 170, k = Wp / v.W, cx = 170, cy = 135, r = v.d / 2 * k, x0 = 50, x1 = 290, yt = cy - Wp / 2, yb = cy + Wp / 2;
      let h = DK.rect(x0, yt, x1 - x0, Wp, 'part') + DK.circle(cx, cy, r, 'ln');
      h += '<circle class="dk-bg" cx="' + cx + '" cy="' + cy + '" r="' + deF(r) + '" style="fill:var(--panel)"/>' + DK.circle(cx, cy, r, 'ln');
      h += deCross(cx, cy, r + 10);
      for (let i = 0; i < 5; i++) { const y = yt + Wp * (i + 0.5) / 5; h += deArrow(x0 - 4, y, x0 - 30, y, 'ln') + deArrow(x1 + 4, y, x1 + 30, y, 'ln'); }
      // Stress across the section through the hole (upper ligament), shape of the Kirsch solution scaled to the peak.
      const base = 34, amp = 95, pts = [];
      for (let i = 0; i <= 30; i++) { const y = r + (Wp / 2 - r) * i / 30, q = r / y, f = 1 + 0.5 * q * q + 1.5 * q ** 4; pts.push([cx + base + (amp - base) * (f - 1) / 2, cy - y]); }
      h += dePoly([[cx, cy - r]].concat(pts, [[cx, yt]]), 'tool') + DK.line(cx, yt, cx, cy - r, 'hot');
      let lab = DK.text(cx + amp + 4, cy - r + 4, 'peak ' + (deFin(pk) ? DK.n(pk, u.sdp) + ' ' + u.S : 'Kt × net'), { cls: 'hott', anchor: 'start' });
      if (deFin(sn)) lab += DK.text(cx + base + 6, yt + 14, 'net ' + DK.n(sn, u.sdp), { cls: 'mut', anchor: 'start' });
      lab += deDimV(yt, yb, x0 - 44, 'W ' + DK.n(v.W, u.dp), { from: x0 });
      lab += DK.leader(cx + r * 0.7, cy + r * 0.7, cx + 60, yb + 22, 'Ø d ' + DK.n(v.d, u.dp), { anchor: 'start' });
      if (v.F > 0) lab += DK.text(x1 + 34, cy - Wp / 2 - 8, 'F ' + DK.n(v.F, 0) + ' ' + u.F, { cls: 'txt', anchor: 'end' });
      lab += deLines(330, 210, ['Kt ' + (deFin(kt) ? DK.n(kt, 3) : '?') + ' on the net section', 'd/W ' + deT(rows, 'd / W', '') + (v.t > 0 ? ', t ' + DK.n(v.t, u.dp) : '')], { cls: 'txt' });
      return DK.svg(W, H, h + lab, 'Plate with a hole in tension and the stress peak');
    }
    if (v.case === 2) {
      if (!(v.ea > 0 && v.eb > 0)) return '';
      const kt = deV(rows, 'Kt = 1'), pk = deV(rows, 'Peak stress at the end');
      const cx = 170, cy = 135, s = 80 / Math.max(v.ea, v.eb), A = v.ea * s, B = v.eb * s;
      let h = DK.rect(50, 30, 240, 210, 'part') + '<ellipse class="ln" cx="' + cx + '" cy="' + cy + '" rx="' + deF(B) + '" ry="' + deF(A) + '" style="fill:var(--panel)"/>';
      h += deCross(cx, cy, Math.max(A, B) + 10);
      for (let i = 0; i < 5; i++) { const y = 30 + 210 * (i + 0.5) / 5; h += deArrow(46, y, 20, y, 'ln') + deArrow(294, y, 320, y, 'ln'); }
      h += DK.circle(cx, cy - A, 4, 'hotf') + DK.circle(cx, cy + A, 4, 'hotf');
      let lab = deDimV(cy - A, cy, cx - B - 16, 'a ' + DK.n(v.ea, u.dp), { from: cx - 4 }) + DK.dimH(cx, cx + B, cy + A + 18, 'b ' + DK.n(v.eb, u.dp), { from: cy, below: true });
      lab += DK.leader(cx + 3, cy - A - 3, 340, 50, 'peak ' + (deFin(pk) ? DK.n(pk, u.sdp) + ' ' + u.S : 'here'), { anchor: 'start', hot: true });
      lab += deLines(340, 200, ['Kt = 1 + 2a/b = ' + (deFin(kt) ? DK.n(kt, 3) : '?'), 'a across the load, b along it'], { cls: 'txt' });
      return DK.svg(W, H, h + lab, 'Elliptical hole in tension');
    }
    return '';
  },

  // Fatigue: alternating against mean stress with the Goodman, Soderberg and Gerber lines, the yield line and the working point.
  fatigue(v, sys, rows) {
    const W = 520, H = 310, u = mku(sys);
    const se = deV(rows, /^Endurance limit Se/), sa = deV(rows, /^Alternating stress/), sm = deV(rows, /^Mean stress/), sut = v.sut, sy = v.sy;
    if (!(se > 0 && sut > 0)) return '';
    const x0 = 66, x1 = 440, y0 = 262, y1 = 34, ymax = Math.max(se, sy > 0 ? sy : 0, sa > 0 ? sa : 0) * 1.12, xmax = sut * 1.06;
    const X = m => x0 + (x1 - x0) * m / xmax, Y = a => y0 - (y0 - y1) * a / ymax;
    let h = DK.line(x0, y1 - 10, x0, y0, 'ln') + DK.line(x0, y0, x1 + 16, y0, 'ln');
    if (sy > 0) h += DK.line(X(0), Y(sy), X(sy), Y(0), 'ghost') + DK.line(X(0), Y(se), X(sy), Y(0), 'hid');
    let g = []; for (let i = 0; i <= 40; i++) { const m = sut * i / 40; g.push([X(m), Y(se * (1 - (m / sut) ** 2))]); }
    h += dePoly(g, 'thin', false) + DK.line(X(0), Y(se), X(sut), Y(0), 'ln');
    // Ticks.
    const tick = (x, y, t, side) => side === 'y' ? DK.line(x0 - 4, y, x0, y, 'ln') + DK.text(x0 - 7, y + 4, t, { cls: 'mut', anchor: 'end' }) : DK.line(x, y0, x, y0 + 4, 'ln') + DK.text(x, y0 + 16, t, { cls: 'mut' });
    h += tick(0, Y(se), 'Se ' + DK.n(se, u.sdp), 'y') + tick(X(sut), 0, 'Sut', 'x');
    if (sy > 0) h += tick(0, Y(sy), 'Sy', 'y') + tick(X(sy), 0, 'Sy', 'x');
    // Labels on the lines.
    const lbl = (m, a, t, dy) => DK.text(X(m) + 4, Y(a) + (dy || -6), t, { cls: 'mut', anchor: 'start' });
    h += lbl(sut * 0.62, se * 0.38, 'Goodman', -6);
    h += lbl(sut * 0.5, se * (1 - 0.25), 'Gerber', -6);
    if (sy > 0) h += lbl(sy * 0.22, se * 0.62, 'Soderberg', 16) + lbl(sy * 0.2, sy * 0.8 + 0, 'yield', -8);
    // Working point.
    let lab = '';
    if (deFin(sa) && deFin(sm) && sa >= 0) {
      const px = X(deClamp(sm, -0.0 * sut, xmax)), py = Y(Math.min(sa, ymax));
      if (sm >= 0) lab += DK.line(X(0), Y(0), px, py, 'dim') ;
      lab += DK.line(x0, py, px, py, 'hot ext') + DK.line(px, y0, px, py, 'hot ext') + DK.circle(px, py, 5, 'hotf');
      const n = deV(rows, 'modified Goodman');
      lab += DK.text(px + (px > 330 ? -10 : 10), py - 10, 'σa ' + DK.n(sa, u.sdp) + ', σm ' + DK.n(sm, u.sdp), { cls: 'hott', anchor: px > 330 ? 'end' : 'start' });
      if (deFin(n)) lab += DK.text(px + (px > 330 ? -10 : 10), py + 18, 'n Goodman ' + DK.n(n, 2), { cls: 'hott', anchor: px > 330 ? 'end' : 'start' });
    }
    lab += DK.text(x0, y1 - 16, 'alternating stress σa (' + u.S + ')', { cls: 'txt', anchor: 'start' }) + DK.text(x1 + 14, y0 + 34, 'mean stress σm', { cls: 'txt', anchor: 'end' });
    lab += deLines(450, 70, ['solid: Goodman', 'thin: Gerber', 'dashed: Soderberg', 'faint: yield'], {});
    return DK.svg(W, H, h + lab, 'Fatigue diagram: alternating against mean stress');
  },

  // Chuck: end view with the jaws, centrifugal force on each jaw and the grip left at speed.
  chuckforce(v, sys, rows) {
    const W = 520, H = 290, u = mku(sys), cx = 150, cy = 145;
    if (!(v.n >= 0)) return '';
    let h = '', lab = '';
    if (v.mode === 2) {
      if (!(v.m > 0 && v.r > 0)) return '';
      const F = deV(rows, 'Centrifugal force m r'), g = deV(rows, 'multiple of its weight'), R = 100;
      h += DK.circle(cx, cy, R + 14, 'part') + deCross(cx, cy, R + 26) + DK.line(cx, cy, cx + R * 0.72, cy - R * 0.69, 'ln');
      const mx = cx + R * 0.72, my = cy - R * 0.69;
      h += DK.circle(mx, my, 10, 'tool') + deArrow(mx + 8, my - 8, mx + 58, my - 56, 'hot');
      lab += DK.dim(cx, cy, mx, my, 'r ' + DK.n(v.r, u.dp), { off: 12 }) + DK.text(mx + 62, my - 58, 'F ' + (deFin(F) ? DK.n(F, 1) + ' ' + u.F : ''), { cls: 'hott', anchor: 'start' });
      lab += deRot(cx, cy, 40, 220, 320, 'ln') + DK.text(cx, cy + 62, DK.n(v.n, 0) + ' rpm', { cls: 'txt' });
      lab += deLines(320, 200, ['mass ' + DK.n(v.m, 3) + ' ' + u.m, deFin(g) ? 'force = ' + DK.n(g, 1) + ' × its weight' : ''], { cls: 'txt' });
      return DK.svg(W, H, h + lab, 'Centrifugal force on a rotating mass');
    }
    if (!(v.z >= 1 && v.mj > 0 && v.rj > 0)) return '';
    const z = deClamp(Math.round(v.z), 1, 8), bore = v.grip === 1, R = 112, rp = bore ? 66 : 34;
    const fc1 = deV(rows, 'Centrifugal force, one jaw'), grip = deV(rows, /^Grip at/), chg = deV(rows, 'Change from standstill');
    h += DK.circle(cx, cy, R, 'part') + DK.circle(cx, cy, R - 6, 'thin');
    // The work: a bar (outside grip) or a ring (bore grip).
    const ro = rp + 30;
    if (bore) h += '<path class="hatch" fill-rule="evenodd" d="M' + (cx + ro) + ' ' + cy + 'A' + ro + ' ' + ro + ' 0 1 0 ' + (cx - ro) + ' ' + cy + 'A' + ro + ' ' + ro + ' 0 1 0 ' + (cx + ro) + ' ' + cy + 'ZM' + (cx + rp) + ' ' + cy + 'A' + rp + ' ' + rp + ' 0 1 0 ' + (cx - rp) + ' ' + cy + 'A' + rp + ' ' + rp + ' 0 1 0 ' + (cx + rp) + ' ' + cy + 'Z"/>';
    else h += DK.circle(cx, cy, rp, 'hatch');
    const jw = 24, jl = bore ? 40 : 52;
    for (let i = 0; i < z; i++) {
      const a = Math.PI / 2 + i * 2 * Math.PI / z, c = Math.cos(a), s = -Math.sin(a), nx = -s, ny = c;
      const r0 = bore ? rp - jl : rp, r1 = r0 + jl;
      h += dePoly([[cx + c * r0 + nx * jw / 2, cy + s * r0 + ny * jw / 2], [cx + c * r1 + nx * jw / 2, cy + s * r1 + ny * jw / 2], [cx + c * r1 - nx * jw / 2, cy + s * r1 - ny * jw / 2], [cx + c * r0 - nx * jw / 2, cy + s * r0 - ny * jw / 2]], 'tool');
      const rg = (r0 + r1) / 2;
      h += DK.circle(cx + c * rg, cy + s * rg, 2.5, 'hotf') + deArrow(cx + c * (r1 + 4), cy + s * (r1 + 4), cx + c * (r1 + 34), cy + s * (r1 + 34), 'hot');
      // Grip on the work.
      // Grip on the work, at the contact face, pointing into the work.
      const gc = bore ? r1 : r0, gd = bore ? 1 : -1;
      h += deArrow(cx + c * (gc - gd * 12) + nx * 6, cy + s * (gc - gd * 12) + ny * 6, cx + c * (gc + gd * 4) + nx * 6, cy + s * (gc + gd * 4) + ny * 6, 'dim');
    }
    h += deCross(cx, cy, R + 14);
    const a0 = Math.PI / 2, rg0 = bore ? rp - jl / 2 : rp + jl / 2;
    lab += DK.dim(cx, cy, cx + Math.cos(a0 - 0.0) * 0, cy - rg0, '', {});
    lab += DK.text(cx + 8, cy - rg0 / 2, 'r ' + DK.n(v.rj, u.dp), { cls: 'dimt', anchor: 'start' });
    lab += DK.text(cx, 14, 'Fc ' + (deFin(fc1) ? DK.n(fc1, 0) + ' ' + u.F : '') + ' each', { cls: 'hott' });
    lab += deRot(cx, cy, R + 24, 300, 340, 'ln') + DK.text(cx + R * 0.93, cy + R * 0.7 + 20, DK.n(v.n, 0) + ' rpm', { cls: 'txt', anchor: 'start' });
    const L = [];
    if (deFin(grip)) L.push(['Grip at speed', DK.n(grip, 0) + ' ' + u.F, 'hott']);
    if (v.f0 > 0) L.push(['at standstill', DK.n(v.f0, 0) + ' ' + u.F, 'dimt']);
    if (deFin(chg)) L.push(['change', DK.n(chg, 1) + ' %', chg < 0 ? 'hott' : 'dimt']);
    const z0 = deV(rows, 'grip reaches zero'), t3 = deV(rows, 'one third');
    if (deFin(t3)) L.push(['⅓ grip left at', DK.n(t3, 0) + ' rpm', 'dimt']);
    if (deFin(z0)) L.push(['no grip at', DK.n(z0, 0) + ' rpm', 'dimt']);
    let y = 50;
    L.forEach(q => { lab += DK.text(318, y, q[0], { cls: 'mut', anchor: 'start' }) + DK.text(318, y + 16, q[1], { cls: q[2], anchor: 'start', size: q[2] === 'hott' && y === 50 ? 16 : undefined }); y += 38; });
    lab += DK.text(318, H - 12, (bore ? 'Gripping a bore: speed adds grip' : 'Gripping outside: speed takes grip away'), { cls: 'mut', anchor: 'start' });
    return DK.svg(W, H, h + lab, 'Chuck jaws with centrifugal force and grip at speed');
  },

  // Balancing: the rotor between its bearings, the two correction planes, the permissible unbalance and its split.
  balance(v, sys, rows) {
    const W = 520, H = 290, u = mku(sys);
    const U = deV(rows, /^Permissible residual unbalance/), e = deV(rows, 'centre-of-mass offset');
    if (!deFin(U)) return '';
    const two = v.hl > 0 && v.hr > 0, cy = 116;
    const b = two ? v.hl + v.hr : 1, k = two ? 230 / b : 0, cg = two ? 70 + 60 + v.hl * k : 245;
    const pl = two ? 130 : 245, pr = two ? 130 + b * k : 245, x0 = Math.min(pl, cg) - 70, x1 = Math.max(pr, cg) + 70;
    let h = DK.line(x0 - 20, cy, x1 + 20, cy, 'ln') + DK.rect(x0 - 20, cy - 6, x1 - x0 + 40, 12, 'part');
    h += DK.rect(pl - 20, cy - 58, (pr - pl) + 40, 116, 'part', 6);
    h += DK.cl(x0 - 34, cy, x1 + 34, cy);
    // Bearings.
    [x0, x1].forEach(x => { h += dePoly([[x, cy + 6], [x - 11, cy + 26], [x + 11, cy + 26]], 'part') + deGround(x - 16, x + 16, cy + 26); });
    // Planes and correction masses.
    const share = [deV(rows, 'Share for plane L'), deV(rows, 'Share for plane R')], cm = [deV(rows, 'Correction mass in plane L'), deV(rows, 'Correction mass in plane R')];
    const cm1 = deV(rows, 'Correction mass for U_per');
    const planes = two ? [[pl, 'L', share[0], cm[0]], [pr, 'R', share[1], cm[1]]] : [[pl, '', U, cm1]];
    let lab = '';
    planes.forEach((p, i) => {
      h += DK.line(p[0], cy - 76, p[0], cy + 76, 'hid') + DK.circle(p[0], cy - 46, 6, 'tool');
      lab += DK.text(p[0], cy - 84, 'plane ' + p[1], { cls: 'txt' });
      lab += DK.text(p[0], cy + 92, (two ? DK.n(p[2], 1) : DK.n(U, 1)) + ' g·mm', { cls: two ? 'dimt' : 'hott' });
      if (deFin(p[3])) lab += DK.text(p[0], cy + 107, DK.n(p[3], 3) + ' g at r', { cls: 'mut' });
      void i;
    });
    if (v.rc > 0) lab += deDimV(cy - 46, cy, pl - 28, 'r ' + DK.n(v.rc, u.dp), { from: pl - 8 });
    // Centre of gravity.
    lab += deCentroid(cg, cy, 6);
    if (two) lab += DK.dimH(pl, cg, cy - 100 + 0, 'hL ' + DK.n(v.hl, u.dp), { from: cy - 78 }) + DK.dimH(cg, pr, cy - 100, 'hR ' + DK.n(v.hr, u.dp), { from: cy - 78 });
    lab += deRot(x1 + 36, cy, 22, 60, 300, 'ln');
    const G = v.G > 0 ? v.G : v.Gx;
    lab += DK.text(W - 8, 22, 'U per ' + DK.n(U, 1) + ' g·mm', { cls: 'hott', anchor: 'end', size: 15 });
    lab += deLines(14, H - 20, ['G ' + DK.n(G, 2) + ' at ' + DK.n(v.n, 0) + ' rpm, rotor ' + DK.n(v.m, 3) + ' ' + u.m + (deFin(e) ? ', e per ' + DK.n(e, 3) + ' µm' : ''), two ? '' : 'Give hL and hR to split U over two planes.'], { cls: 'txt' });
    return DK.svg(W, H, h + lab, 'Rotor with correction planes and permissible unbalance');
  },

  // Critical speed: the shaft on its bearings (or overhung) with the discs to scale along it and the first whirling shape.
  critspeed(v, sys, rows) {
    const W = 520, H = 270, u = mku(sys);
    if (!(v.L > 0 && v.D > 0)) return '';
    const sup = v.sup, x0 = 60, x1 = 440, cy = 120, X = x => x0 + (x1 - x0) * x / v.L, Dp = deClamp(v.D / v.L * (x1 - x0), 6, 20);
    const ray = deV(rows, 'Rayleigh'), dun = deV(rows, 'Dunkerley'), sag = deV(rows, 'Largest static sag');
    let h = DK.rect(x0, cy - Dp / 2, x1 - x0, Dp, 'part') + DK.cl(x0 - 20, cy, x1 + 20, cy);
    // Whirl shape (exaggerated).
    const pts = []; for (let i = 0; i <= 50; i++) { const t = i / 50; pts.push([x0 + (x1 - x0) * t, cy + 34 * (sup === 0 ? 1 - Math.cos(Math.PI * t / 2) : Math.sin(Math.PI * t))]); }
    h += dePoly(pts, 'hot', false);
    if (sup === 0) h += deWall(x0, cy - 34, cy + 34, true);
    else h += [x0, x1].map(x => dePoly([[x, cy + Dp / 2], [x - 11, cy + Dp / 2 + 18], [x + 11, cy + Dp / 2 + 18]], 'part') + deGround(x - 16, x + 16, cy + Dp / 2 + 18)).join('');
    let lab = '';
    const ms = [1, 2, 3].map(i => v['m' + i] > 0 && v['x' + i] >= 0 && v['x' + i] <= v.L ? [v['m' + i], v['x' + i], i] : null).filter(Boolean);
    const mmax = Math.max(1e-9, ...ms.map(q => q[0]));
    ms.forEach(q => {
      const x = X(q[1]), hh = 30 + 50 * Math.cbrt(q[0] / mmax);
      h += DK.rect(x - 7, cy - hh / 2, 14, hh, 'tool');
      lab += DK.text(x, cy - hh / 2 - 8, 'm' + q[2] + ' ' + DK.n(q[0], 2) + ' ' + u.m, { cls: 'txt' });
    });
    lab += DK.dimH(x0, x1, cy + 74, 'L ' + DK.n(v.L, u.dp) + ' ' + u.L, { from: cy + 30, below: true });
    if (ms[0]) lab += DK.dimH(x0, X(ms[0][1]), cy + 54, 'x1 ' + DK.n(ms[0][1], u.dp), { from: cy - 10 });
    lab += DK.text(x1 + 12, cy - 30, 'Ø ' + DK.n(v.D, u.dp), { cls: 'dimt', anchor: 'start' });
    const L = [];
    if (deFin(ray)) L.push('Rayleigh ' + DK.n(ray, 0) + ' rpm (upper)');
    if (deFin(dun)) L.push('Dunkerley ' + DK.n(dun, 0) + ' rpm (lower)');
    L.forEach((t, i) => { lab += DK.text(14, 22 + i * 18, t, { cls: 'hott', anchor: 'start' }); });
    lab += deLines(14, H - 24, [deFin(sag) ? 'static sag ' + DK.n(sag, sys === 'inch' ? 5 : 4) + ' ' + u.L : '', 'First whirling shape in orange, exaggerated.']);
    return DK.svg(W, H, h + lab, 'Shaft critical speed with discs and the whirl shape');
  },
});
