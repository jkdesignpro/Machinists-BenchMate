'use strict';
// Reference data tools, round 3: ISO 1832 insert and ISO 5608 toolholder codes,
// ISO 513 application groups, surface texture, hardness conversion, knurling.
// Uses the helpers in refdata.js and refdata2.js (loadRef, badge, pubName,
// sourceList, fBoth, pubCell, calcCell, rowsHtml, RMEM). Code meanings and table
// values come from data/refdata.json with their publisher consensus; geometry and
// arithmetic are done by the Rust core (state.W).

// Short meaning ids used in the evidence files, in our own words.
const IC_TEXT = {
  hole: { none: 'no fixing hole', cyl: 'cylindrical fixing hole', screw: 'hole for a countersunk clamping screw', special: 'special (see maker)' },
  cb: { none: 'no chipbreaker', one: 'chipbreaker on one face', both: 'chipbreaker on both faces' },
  edge: { sharp: 'sharp edge' },
  hand: { right: 'right hand', left: 'left hand', neutral: 'neutral (cuts both ways)' },
  clamp: { top: 'top clamp on an insert without a hole', tophole: 'top clamp plus pin in the insert hole', lever: 'lever or pin pulling the insert by its hole', screw: 'screw through the insert hole', double: 'double clamp (Mitsubishi: clamp and hole together)' },
};
const SHAPE_NAME = { A: 'parallelogram', B: 'parallelogram', C: 'rhombic', D: 'rhombic', E: 'rhombic', H: 'hexagon', K: 'parallelogram', L: 'rectangle', M: 'rhombic', O: 'octagon', P: 'pentagon', R: 'round', S: 'square', T: 'triangle', V: 'rhombic', W: 'trigon' };
// Corner angle sequences for drawing (tangential polygons); K and L are drawn schematically.
const SHAPE_CORNERS = { C: [80, 100], D: [55, 125], E: [75, 105], M: [86, 94], V: [35, 145], S: [90], T: [60], P: [108], H: [120], O: [135], W: [80, 160] };
const IC_SIZES = [3.97, 4.76, 5.56, 6.35, 7.94, 9.525, 12.7, 15.875, 19.05, 25.4, 31.75];

function consText(c, map) {
  if (!c) return '-';
  const t = v => rEsc(map ? (map[v] || v) : v);
  return t(c.value) + (c.groups.length > 1 ? ' <span class="warn">also printed: ' + c.groups.slice(1).map(g => t(g.value)).join(', ') + '</span>' : '');
}
function evCell(srcs, c) {
  if (!c) return '<td><span class="ms">not in the maker keys used here</span></td>';
  const pubs = c.groups.map(g => g.value + ': ' + g.publishers.map(p => pubName(srcs, p)).join(', ')).join(' | ');
  return '<td title="' + rEsc(pubs) + '">' + badge(c.status) + ' <span class="ms">' + c.groups.map(g => g.publishers.map(p => rEsc(pubName(srcs, p))).join(', ')).join(' / ') + '</span></td>';
}

// SVG of an insert shape: tangential polygon walked from its corner angles around inscribed circle d.
function insertSvg(letter, W) {
  const S = 150, pad = 14;
  let pts = null, circle = '';
  if (letter === 'R') return '<svg viewBox="0 0 ' + S + ' ' + S + '" width="' + S + '" height="' + S + '" role="img" aria-label="round insert"><circle cx="75" cy="75" r="55" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
  if (SHAPE_CORNERS[letter]) {
    const seq = SHAPE_CORNERS[letter], n = { C: 4, D: 4, E: 4, M: 4, V: 4, S: 4, T: 3, P: 5, H: 6, O: 8, W: 6 }[letter];
    const ang = Array.from({ length: n }, (_, i) => seq[i % seq.length]);
    let x = 0, y = 0, h = 0; pts = [];
    for (let i = 0; i < n; i++) {
      pts.push([x, y]);
      const l = W.insert_edge_length(1, ang[i], ang[(i + 1) % n]);
      x += l * Math.cos(h); y += l * Math.sin(h);
      h += (180 - ang[(i + 1) % n]) * Math.PI / 180;
    }
    circle = true;
  } else if (letter === 'K' || letter === 'A' || letter === 'B') {
    const a = { K: 55, A: 85, B: 82 }[letter] * Math.PI / 180;
    pts = [[0, 0], [2, 0], [2 + Math.cos(a), Math.sin(a)], [Math.cos(a), Math.sin(a)]];
  } else if (letter === 'L') {
    pts = [[0, 0], [2, 0], [2, 1], [0, 1]];
  } else return '';
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const x0 = Math.min(...xs), y0 = Math.min(...ys), sc = (S - 2 * pad) / Math.max(Math.max(...xs) - x0, Math.max(...ys) - y0);
  const ox = (S - (Math.max(...xs) - x0) * sc) / 2, oy = (S - (Math.max(...ys) - y0) * sc) / 2;
  const P = pts.map(p => [ox + (p[0] - x0) * sc, oy + (p[1] - y0) * sc]);
  let ic = '';
  if (circle) { // incentre: for a tangential polygon the inscribed circle has radius 0.5 (d = 1) and touches every side
    ic = incircle(P, 0.5 * sc);
  }
  return '<svg viewBox="0 0 ' + S + ' ' + S + '" width="' + S + '" height="' + S + '" role="img" aria-label="insert shape ' + letter + '"><polygon points="' + P.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ') + '" fill="none" stroke="currentColor" stroke-width="2"/>' + ic +
    (circle ? '' : '<text x="75" y="' + (S - 2) + '" text-anchor="middle" font-size="9" fill="currentColor" opacity=".7">schematic</text>') + '</svg>';
}
// Inscribed circle of a tangential polygon: intersect the bisectors at two adjacent corners.
function incircle(P, r) {
  const n = P.length, bis = i => {
    const p = P[i], a = P[(i + n - 1) % n], b = P[(i + 1) % n];
    const u = [a[0] - p[0], a[1] - p[1]], v = [b[0] - p[0], b[1] - p[1]];
    const lu = Math.hypot(...u), lv = Math.hypot(...v);
    return [p, [u[0] / lu + v[0] / lv, u[1] / lu + v[1] / lv]];
  };
  const [p1, d1] = bis(0), [p2, d2] = bis(1);
  const den = d1[0] * d2[1] - d1[1] * d2[0]; if (Math.abs(den) < 1e-9) return '';
  const t = ((p2[0] - p1[0]) * d2[1] - (p2[1] - p1[1]) * d2[0]) / den;
  return '<circle cx="' + (p1[0] + t * d1[0]).toFixed(1) + '" cy="' + (p1[1] + t * d1[1]).toFixed(1) + '" r="' + r.toFixed(1) + '" fill="none" stroke="currentColor" stroke-dasharray="3 3" opacity=".6"/>';
}

// ------------------------------------------------------------------ insert code (ISO 1832)
function parseInsert(code) {
  const s = code.toUpperCase().replace(/\s+/g, ' ').trim();
  const [main, ...rest] = s.split('-');
  const c = (main || '').replace(/\s/g, '');
  const m = c.match(/^([A-Z])([A-Z])([A-Z])([A-Z])(\d{2})(T\d|\d{2})(M0|\d{2})?([A-Z]{0,2})$/);
  if (!m) return null;
  let edge = '', hand = '';
  if (m[8].length === 2) { edge = m[8][0]; hand = m[8][1]; } else if (m[8].length === 1) { if ('RLN'.includes(m[8])) hand = m[8]; else edge = m[8]; }
  return { shape: m[1], clear: m[2], tol: m[3], type: m[4], size: m[5], thick: m[6], corner: m[7] || '', edge, hand, cb: rest.join('-') };
}

// Outline of an insert from the Rust core: vertices [x, y, bulge, arc radius] in mm,
// centre of the inscribed circle at 0,0, counter-clockwise; null when the core refuses.
function insOutline(W, letter, d, r) {
  const n = W.insert_outline(letter.charCodeAt(0), d, r);
  if (!(n > 0)) return null;
  const v = [];
  for (let i = 0; i < n; i++) v.push([W.list_out(4 * i), W.list_out(4 * i + 1), W.list_out(4 * i + 2), W.list_out(4 * i + 3)]);
  return v;
}
// SVG path of an outline; px(x, y) places a point of the drawing on the picture, k is its scale.
function insPath(v, px, k) {
  const f = q => q[0].toFixed(2) + ' ' + q[1].toFixed(2);
  let s = 'M' + f(px(v[0][0], v[0][1]));
  v.forEach((p, i) => {
    const q = v[(i + 1) % v.length], rr = (p[3] * k).toFixed(2);
    s += (p[2] ? 'A' + rr + ' ' + rr + ' 0 0 0 ' : 'L') + f(px(q[0], q[1]));
  });
  return s + 'Z';
}
// Small picture of a shape for its key.
function insIcon(W, letter) {
  const S = 26, v = insOutline(W, letter, 1, 0);
  if (!v) return insertSvg(letter, W).replace(/width="150" height="150"/, 'width="' + S + '" height="' + S + '"').replace(/<text[^>]*>schematic<\/text>/, '').replace(/stroke-width="2"/g, 'stroke-width="9"');
  const c = letter.charCodeAt(0), w = W.insert_dim(c, 1, 0, 6), h = W.insert_dim(c, 1, 0, 7), x0 = W.insert_dim(c, 1, 0, 11), y0 = W.insert_dim(c, 1, 0, 12);
  const k = (S - 4) / Math.max(w, h), px = (x, y) => [(S - w * k) / 2 + (x - x0) * k, (S + h * k) / 2 - (y - y0) * k];
  return '<svg viewBox="0 0 ' + S + ' ' + S + '" width="' + S + '" height="' + S + '" aria-hidden="true"><path d="' + insPath(v, px, k) + '" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
}
// Top view and section of an insert, to scale. g: { shape, d, r, s, clr, hole, d1 } in mm and degrees
// (r, s, clr may be NaN when the code does not give them). Every number printed is an input or a core result.
function insDrawing(W, g) {
  const c = g.shape.charCodeAt(0), r = g.r > 0 ? g.r : 0;
  const v = insOutline(W, g.shape, g.d, r);
  if (!v) return '';
  const w = W.insert_dim(c, g.d, r, 6), h = W.insert_dim(c, g.d, r, 7), x0 = W.insert_dim(c, g.d, r, 11), y0 = W.insert_dim(c, g.d, r, 12);
  const TW = 430, M = 88, k = Math.min((TW - 2 * M) / w, 190 / h), TH = Math.round(h * k + 96);
  const px = (x, y) => [(TW - w * k) / 2 + (x - x0) * k, (TH + h * k) / 2 - (y - y0) * k];
  const o = px(0, 0), f = q => q[0].toFixed(1) + ',' + q[1].toFixed(1), T = (x, y, t, anchor, extra) => '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" font-size="11" text-anchor="' + (anchor || 'middle') + '" fill="currentColor"' + (extra || '') + '>' + t + '</text>';
  let top = '<path id="iout" d="' + insPath(v, px, k) + '" fill="currentColor" fill-opacity=".07" stroke="currentColor" stroke-width="2"/>';
  if (g.shape !== 'R') top += '<circle cx="' + o[0].toFixed(1) + '" cy="' + o[1].toFixed(1) + '" r="' + (g.d / 2 * k).toFixed(1) + '" fill="none" stroke="var(--accent)" stroke-dasharray="4 3"/>';
  const hr = g.d1 > 0 ? g.d1 / 2 : 0.2 * g.d, hdash = g.d1 > 0 ? '' : ' stroke-dasharray="2 3" opacity=".7"'; // hole to size when a table gives it, else for position only
  if (g.hole) top += '<circle id="ihole" cx="' + o[0].toFixed(1) + '" cy="' + o[1].toFixed(1) + '" r="' + (hr * k).toFixed(1) + '" fill="none" stroke="currentColor"' + hdash + '/>';
  top += '<path d="M' + (o[0] - 6) + ' ' + o[1] + 'h12M' + o[0] + ' ' + (o[1] - 6) + 'v12" stroke="currentColor" opacity=".6"/>';
  top += T(o[0], o[1] + g.d / 2 * k * 0.62, (g.shape === 'R' ? 'Ø ' : 'd ') + fLen(g.d), 'middle', ' style="fill:var(--accent)"');
  if (g.shape !== 'R') {
    const sharp = r > 0 ? insOutline(W, g.shape, g.d, 0) : v, A = px(sharp[0][0], sharp[0][1]), B = px(sharp[1][0], sharp[1][1]);
    // edge length: a dimension line outside the first side, between the sharp corners
    const mx = (A[0] + B[0]) / 2 - o[0], my = (A[1] + B[1]) / 2 - o[1], ml = Math.hypot(mx, my), nx = mx / ml, ny = my / ml, off = 20;
    const A2 = [A[0] + nx * off, A[1] + ny * off], B2 = [B[0] + nx * off, B[1] + ny * off];
    let ang = Math.atan2(B2[1] - A2[1], B2[0] - A2[0]) * 180 / Math.PI; if (ang > 90 || ang < -90) ang += 180;
    const tm = [(A2[0] + B2[0]) / 2 + nx * 12, (A2[1] + B2[1]) / 2 + ny * 12];
    top += '<path d="M' + f(A) + 'L' + f([A2[0] + nx * 4, A2[1] + ny * 4]) + 'M' + f(B) + 'L' + f([B2[0] + nx * 4, B2[1] + ny * 4]) + 'M' + f(A2) + 'L' + f(B2) + '" stroke="currentColor" stroke-width="1" opacity=".75" fill="none"/>' +
      [A2, B2].map(q => '<circle cx="' + q[0].toFixed(1) + '" cy="' + q[1].toFixed(1) + '" r="2" fill="currentColor"/>').join('') +
      T(tm[0], tm[1] + 4, 'l ' + fLen(W.insert_dim(c, g.d, r, 0)), 'middle', ' transform="rotate(' + ang.toFixed(1) + ' ' + tm[0].toFixed(1) + ' ' + tm[1].toFixed(1) + ')"');
    // first corner: its angle and radius, written outside the corner on its bisector
    const cx = A[0] - o[0], cy = A[1] - o[1], cl = Math.hypot(cx, cy), ux = cx / cl, uy = cy / cl;
    const lab = fx(W.insert_dim(c, g.d, r, 9), 0) + '°' + (r > 0 ? ', r ' + fLen(r) : g.r === 0 ? ', sharp' : '');
    const sg = -uy * nx + ux * ny > 0 ? -1 : 1, lx = ux * 9 - uy * 13 * sg, ly = uy * 9 + ux * 13 * sg; // beyond the corner, on the side away from the dimension line
    top += T(A[0] + lx, A[1] + ly + 4, lab, lx > 3 ? 'start' : lx < -3 ? 'end' : 'middle');
  }
  let out = '<figure class="insfig"><svg id="itop" viewBox="0 0 ' + TW + ' ' + TH + '" width="' + TW + '" height="' + TH + '" role="img" aria-label="insert ' + g.shape + ' seen from above, to scale">' + top + '</svg><figcaption>Top view, to scale</figcaption></figure>';
  if (g.s > 0) {
    const base = g.clr >= 0 ? W.insert_base_ic(g.d, g.s, g.clr) : NaN, bw = isFinite(base) ? base : g.d;
    const SW = 300, SH = Math.max(120, g.s * k + 84), xl = (SW - g.d * k) / 2 - 20, yt = 34, yb = yt + g.s * k, xc = xl + g.d * k / 2;
    let sec = '<path id="isec" d="M' + f([xl, yt]) + 'L' + f([xl + g.d * k, yt]) + 'L' + f([xc + bw * k / 2, yb]) + 'L' + f([xc - bw * k / 2, yb]) + 'Z" fill="currentColor" fill-opacity=".07" stroke="currentColor" stroke-width="2"/>';
    if (g.hole) sec += '<path d="M' + f([xc - hr * k, yt]) + 'V' + yb.toFixed(1) + 'M' + f([xc + hr * k, yt]) + 'V' + yb.toFixed(1) + '" stroke="currentColor" stroke-dasharray="2 3" opacity=".7"/>' +
      (g.d1 > 0 ? T(xc, (yt + yb) / 2 + 4, 'd1 ' + fLen(g.d1)) : '');
    const xr = xl + g.d * k + 16;
    sec += '<path d="M' + f([xl + g.d * k + 3, yt]) + 'H' + (xr + 4) + 'M' + f([xc + bw * k / 2 + 3, yb]) + 'H' + (xr + 4) + 'M' + xr + ' ' + yt + 'V' + yb.toFixed(1) + '" stroke="currentColor" opacity=".75" fill="none"/>' +
      T(xr + 6, (yt + yb) / 2 + 4, 's ' + fLen(g.s), 'start') + T(xc, yt - 10, (g.shape === 'R' ? 'Ø ' : 'd ') + fLen(g.d)) +
      T(xc, yb + 16, g.clr > 0 && isFinite(base) ? 'bottom face ' + fLen(base) + ', flanks ' + g.clr + '°' : g.clr === 0 ? 'flanks square to the face (0°)' : '');
    out += '<figure class="insfig"><svg id="iside" viewBox="0 0 ' + SW + ' ' + SH.toFixed(0) + '" width="' + SW + '" height="' + SH.toFixed(0) + '" role="img" aria-label="section of the insert, to scale">' + sec + '</svg><figcaption>Section across the inscribed circle, same scale</figcaption></figure>';
  }
  return '<div class="insdraw">' + out + '</div>';
}

async function renderInsertCode(el) {
  const R = await loadRef(el); if (!R) return;
  const W = state.W, X = R.inserts; if (!X) { el.textContent = 'Insert data not built.'; return; }
  const m = RMEM.ins || (RMEM.ins = { code: 'CNMG120408-PM', ic: 12.7 });
  const I = X.insert;
  const types = Object.keys(Object.assign({}, I.type_hole, I.type_cb)).sort();
  const typeTxt = k => [I.type_hole[k] && IC_TEXT.hole[I.type_hole[k].value], I.type_cb[k] && IC_TEXT.cb[I.type_cb[k].value]].filter(Boolean).join(', ');
  const shapeTxt = k => (SHAPE_NAME[k] || '') + (I.shape[k] && I.shape[k].value !== 'round' ? ' ' + I.shape[k].value + ' deg' : '');
  // One row of keys per position: [key value, small caption, tooltip, picture].
  const byVal = o => Object.keys(o).sort((a, b) => parseFloat(o[a].value) - parseFloat(o[b].value));
  const key = ([v, cap, tip, pic]) => '<button type="button" data-v="' + rEsc(v) + '" title="' + rEsc(tip || '') + '">' + (pic || '') + '<b>' + rEsc(v || '-') + '</b>' + (cap ? '<i>' + rEsc(cap) + '</i>' : '') + '</button>';
  const row = (i, label, keys) => '<div class="ikrow"><span class="iklab">' + label + '</span><div class="seg ikeys" id="b' + i + '">' + keys.map(key).join('') + '</div></div>';
  el.innerHTML = '<div class="grid" style="max-width:760px"><label class="f"><span>Insert designation (metric, ISO 1832)</span><div class="row"><input id="ic" type="text" spellcheck="false" style="text-transform:uppercase" value="' + rEsc(m.code) + '"></div></label></div>' +
    '<div class="res" style="margin-bottom:12px"><div class="h">Build a code: tap one key in each row</div><div class="ikpad">' +
    row(1, '1 Shape', Object.keys(I.shape).sort().map(k => [k, I.shape[k].value === 'round' ? 'round' : I.shape[k].value + '°', shapeTxt(k), insIcon(W, k)])) +
    row(2, '2 Clearance', Object.keys(I.clearance).sort().map(k => [k, I.clearance[k].value + '°', 'clearance angle ' + I.clearance[k].value + ' deg'])) +
    row(3, '3 Tolerance', Object.keys(I.tol_d).sort().map(k => [k, '±' + I.tol_d[k].value.replace('-', ' to '), 'd +/-' + I.tol_d[k].value + ' mm, m +/-' + I.tol_m[k].value + ' mm, s +/-' + I.tol_s[k].value + ' mm'])) +
    row(4, '4 Type', types.map(k => [k, I.type_hole[k] ? { none: 'no hole', cyl: 'hole', screw: 'screw', special: 'special' }[I.type_hole[k].value] : '', typeTxt(k)])) +
    '<div class="ikrow"><span class="iklab">5 Size</span><div class="seg ikeys" id="b5"></div></div>' +
    row(6, '6 Thickness', byVal(I.thickness).map(k => [k, I.thickness[k].value, 'thickness ' + I.thickness[k].value + ' mm'])) +
    row(7, '7 Corner', [['00', 'sharp', 'sharp corner']].concat(byVal(I.corner).map(k => [k, 'r ' + I.corner[k].value, 'corner radius ' + I.corner[k].value + ' mm']), [['M0', 'round', 'round insert']])) +
    row(9, '9 Hand', [['', 'none', 'no hand letter']].concat(Object.keys(I.hand).map(k => [k, I.hand[k].value, IC_TEXT.hand[I.hand[k].value] || '']))) +
    '<div class="ikrow"><span class="iklab">Maker code</span><input id="b8" type="text" spellcheck="false" placeholder="chipbreaker, optional" style="text-transform:uppercase;max-width:200px"></div>' +
    '</div></div><div id="ires"></div>' +
    '<div class="note"><b>How the code works:</b> positions 1 to 7 are fixed by ISO 1832 (shape, clearance angle, tolerance class, fixing and chipbreaker type, size, thickness, corner), 8 and 9 (edge condition, hand) are optional, and anything after a hyphen is the maker\'s own chipbreaker or grade code, which differs between makers. ' +
    'The size number is the cutting edge length in whole millimetres. Every ISO insert with equal corners on each side is a tangential polygon: all its sides touch the inscribed circle d. A side between corners of angles a1 and a2 is then l = (d/2)(cot(a1/2) + cot(a2/2)); for a rhombic insert of corner angle a this is d / sin a, for a triangle d x 1.732, for a square d. The code is l with the decimals dropped (round inserts: the diameter). The edge lengths are computed by the Rust core and checked against the Mitsubishi, Korloy and Walter size tables. ' +
    'Inch inserts use a different numbering (ANSI B212.4: size in eighths of an inch of d, thickness in sixteenths, corner in sixty-fourths) and are not decoded here. ' +
    'Each meaning is shown with the makers whose code keys print it; Confirmed = two or more makers agree. Clearance angle letters are for the insert\'s own relief; position 4 letters are shown only where a maker key could be read.' +
    '<br><b>The drawing</b> is worked out by the Rust core from the shape, the inscribed circle and the corner radius alone: a corner of angle a sits at (d/2) / sin(a/2) from the centre, the radius meets each side r / tan(a/2) from the sharp corner, and its tip sits r (1/sin(a/2) - 1) back from it. The section shows the flanks leaning in by the clearance angle, so the bottom face is smaller by 2 s tan(clearance). ' +
    'The corner height m is how far the nose tip stands beyond the inscribed circle (triangles: above the opposite side); it is the dimension the tolerance class limits. The 18 values of m printed in ISO 3364:1997 (the edition before the current ISO 3364:2017, which was not read) for triangular, square and 55 degree inserts all agree with this outline to 0.001 mm when the radius is taken as the inch size the standard works from (code 08 = 1/32 in = 0.794 mm); with the nominal 0.8 mm the result is 0.002 mm different, far inside any tolerance class. ' +
    'It is the nominal outline: chipbreaker, edge preparation and wiper flats are the maker\'s and are not drawn. The fixing hole is drawn to size where ISO 3364 gives it (cylindrical hole, 0 degree clearance) and otherwise as a dashed circle for position only. Shapes A, B, K and L (parallelograms and the rectangle) are not fixed by the inscribed circle, so they are shown as a sketch without dimensions.' +
    '<br><b>Standards:</b> ISO 1832:2017, Indexable inserts for cutting tools: designation (current per iso.org). ISO 3364, Indexable hardmetal (carbide) inserts with rounded corners, with cylindrical fixing hole: dimensions (1997 edition read; current edition 2017).</div><div class="note" id="isrc"></div>';
  const ic = $('#ic', el), cbIn = $('#b8', el);
  // The picked key of each row; a row with nothing picked gives ''.
  const pick = {}, rowEl = i => $('#b' + i, el);
  const show = i => rowEl(i).querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === pick[i]));
  const setPick = (i, v) => { if ([...rowEl(i).querySelectorAll('button')].some(b => b.dataset.v === v)) { pick[i] = v; show(i); } };
  function sizeCode(shape, d) {
    if (shape === 'R') return String(Math.round(d)).padStart(2, '0');
    const l = W.insert_edge_length_shape(d, shape.charCodeAt(0));
    return isFinite(l) ? String(W.insert_size_code(l)).padStart(2, '0') : '';
  }
  // Size keys depend on the shape: each shows the inscribed circle and the size number it gives.
  let sizeFor = null;
  function sizeKeys(shape) {
    if (sizeFor === shape) { show(5); return; }
    sizeFor = shape;
    rowEl(5).innerHTML = IC_SIZES.map(d => key([String(d), sizeCode(shape, d) ? 'code ' + sizeCode(shape, d) : 'no code', 'inscribed circle ' + d + ' mm (' + fx(d / IN_MM, 4).replace(/0+$/, '') + ' in)'])).join('');
    rowEl(5).querySelectorAll('button').forEach(b => b.onclick = () => { pick[5] = b.dataset.v; fromBuilder(); });
    show(5);
  }
  let edgeLetter = '', cur = null;
  function fromCode() {
    m.code = ic.value;
    const p = parseInsert(ic.value), out = $('#ires', el);
    cur = null;
    if (!p) { out.innerHTML = '<div class="res"><span class="warn">Not a metric ISO 1832 designation. Expected 4 letters, then size, thickness and corner numbers, for example CNMG 12 04 08, TCMT 16T308, VBMT 160404, RCMT 10T3M0; a maker chipbreaker may follow a hyphen.</span></div>'; return; }
    [[1, p.shape], [2, p.clear], [3, p.tol], [4, p.type], [6, p.thick], [7, p.corner], [9, p.hand]].forEach(([i, v]) => { pick[i] = ''; show(i); setPick(i, v); });
    edgeLetter = p.edge;
    if (document.activeElement !== cbIn) cbIn.value = p.cb;
    // inscribed circle(s) whose computed size code matches the printed one
    const ics = IC_SIZES.filter(d => sizeCode(p.shape, d) === p.size);
    if (ics.length) m.ic = ics.includes(m.ic) ? m.ic : ics[0];
    sizeKeys(p.shape); pick[5] = ics.length ? String(m.ic) : ''; show(5);
    const d = ics.length ? m.ic : NaN;
    const sh = I.shape[p.shape], l = p.shape === 'R' ? +p.size : W.insert_edge_length_shape(d, p.shape.charCodeAt(0));
    const tolRow = I.tol_d[p.tol] ? 'd +/-' + consText(I.tol_d[p.tol]) + ' mm, m +/-' + consText(I.tol_m[p.tol]) + ' mm, s +/-' + consText(I.tol_s[p.tol]) + ' mm' : '-';
    const tolEv = I.tol_d[p.tol] ? I.tol_d[p.tol] : null;
    const tolStat = tolEv ? (['tol_d', 'tol_m', 'tol_s'].map(f => I[f][p.tol].status).find(s => s !== 'confirmed') || 'confirmed') : null;
    const hole = I.type_hole[p.type], cb = I.type_cb[p.type];
    const rows = [
      ['1 Shape <b>' + p.shape + '</b>', '<td class="v">' + (sh ? rEsc(SHAPE_NAME[p.shape] || '') + (sh.value === 'round' ? '' : ', corner angle ' + consText(sh) + ' deg') : '-') + '</td>' + evCell(X.sources, sh)],
      ['2 Clearance <b>' + p.clear + '</b>', '<td class="v">' + (I.clearance[p.clear] ? consText(I.clearance[p.clear]) + ' deg' + (p.clear === 'N' ? ' (negative insert: the holder tilts it to give clearance)' : '') : '-') + '</td>' + evCell(X.sources, I.clearance[p.clear])],
      ['3 Tolerance class <b>' + p.tol + '</b>', '<td class="v">' + tolRow + '<br><span class="ms">d inscribed circle, m corner height, s thickness; a range depends on insert size</span></td>' + (tolEv ? evCell(X.sources, Object.assign({}, tolEv, { status: tolStat })) : evCell(X.sources, null))],
      ['4 Type <b>' + p.type + '</b>', '<td class="v">' + ([hole && consText(hole, IC_TEXT.hole), cb && consText(cb, IC_TEXT.cb)].filter(Boolean).join('; ') || '-') + '</td>' + evCell(X.sources, hole || cb)],
      ['5 Size <b>' + p.size + '</b>', calcCell(p.shape === 'R' ? 'diameter ' + fBoth(+p.size) : isFinite(l) ? 'cutting edge ' + fBoth(l) + '<br><span class="ms">inscribed circle ' + (ics.length > 1 ? ics.join(' or ') + ' mm' : fBoth(d)) + '</span>' : 'no standard inscribed circle gives ' + p.size + ' for shape ' + p.shape, p.shape === 'R' ? 'round: size = diameter' : 'computed, l = (d/2)(cot(a1/2) + cot(a2/2))')],
      ['6 Thickness <b>' + p.thick + '</b>', '<td class="v">' + (I.thickness[p.thick] ? fBoth(+I.thickness[p.thick].value) : '-') + '</td>' + evCell(X.sources, I.thickness[p.thick])],
      ['7 Corner <b>' + (p.corner || '-') + '</b>', '<td class="v">' + (I.corner[p.corner] ? 'radius ' + fBoth(+I.corner[p.corner].value) : p.corner === '00' ? 'sharp corner' : p.corner === 'M0' ? 'round insert, no corner' : '-') + '</td>' + (I.corner[p.corner] ? evCell(X.sources, I.corner[p.corner]) : '<td><span class="ms">' + (p.corner === '00' || p.corner === 'M0' ? 'ISO 1832 convention, not in the keys used here' : '') + '</span></td>')],
    ];
    if (p.edge) rows.push(['8 Edge <b>' + p.edge + '</b>', '<td class="v">' + (I.edge[p.edge] ? consText(I.edge[p.edge], IC_TEXT.edge) : 'edge preparation letter (meaning not confirmed by a maker key here)') + '</td>' + evCell(X.sources, I.edge[p.edge])]);
    if (p.hand) rows.push(['9 Hand <b>' + p.hand + '</b>', '<td class="v">' + (I.hand[p.hand] ? consText(I.hand[p.hand], IC_TEXT.hand) : '-') + '</td>' + evCell(X.sources, I.hand[p.hand])]);
    if (p.cb) rows.push(['Maker code <b>' + rEsc(p.cb) + '</b>', '<td class="v">chipbreaker or grade of one maker; look it up in that maker\'s catalogue</td><td></td>']);
    // The drawing: the shape's own inscribed circle (round inserts: the diameter the code prints), radius, thickness, clearance.
    const name = p.shape + p.clear + p.tol + p.type + p.size + p.thick + p.corner + p.edge + p.hand;
    const g = { shape: p.shape, d: p.shape === 'R' ? (ics.length ? d : +p.size) : d, r: I.corner[p.corner] ? +I.corner[p.corner].value : p.corner === '00' ? 0 : NaN,
      s: I.thickness[p.thick] ? +I.thickness[p.thick].value : NaN, clr: I.clearance[p.clear] ? +I.clearance[p.clear].value : NaN, hole: !!hole && hole.value !== 'none' };
    // Fixing hole size: ISO 3364 gives it for the cylindrical hole of inserts with 0 degree clearance.
    const d1c = hole && hole.value === 'cyl' && g.clr === 0 && I.hole_d1 ? I.hole_d1[String(g.d)] : null;
    g.d1 = d1c ? +d1c.value : NaN;
    const c = p.shape.charCodeAt(0), r = g.r > 0 ? g.r : 0;
    const drawn = g.d > 0 ? insDrawing(W, g) : '';
    const refused = g.d > 0 && !drawn && SHAPE_CORNERS[p.shape] ? gsGet(-W.insert_outline(c, g.d, r)) : '';
    let dims = '', acts = '';
    if (drawn) {
      cur = { g, name, r };
      const dr = [], D = (label, w, how) => { const x = W.insert_dim(c, g.d, r, w); if (isFinite(x)) dr.push([label, calcCell(fBoth(x), how)]); };
      if (p.shape !== 'R') {
        D('Cutting edge, sharp corner to sharp corner', 0, 'l = (d/2)(cot(a1/2) + cot(a2/2))');
        if (r > 0) {
          D('Straight part of the edge between the radii', 1, '(d/2 - r)(cot(a1/2) + cot(a2/2))');
          D('Radius meets the edge, from the sharp corner', 5, 'r / tan(a/2)');
          D('Nose tip sits back from the sharp corner', 4, 'r (1/sin(a/2) - 1)');
        }
        D(r > 0 ? 'Centre to the nose tip' : 'Centre to the corner', 3, r > 0 ? '(d/2) / sin(a/2) less the line above' : '(d/2) / sin(a/2)');
        D('Corner height m', 13, W.insert_dim(c, g.d, r, 10) === 3 ? 'nose tip above the opposite side' : 'nose tip beyond the inscribed circle');
        const w = W.insert_dim(c, g.d, r, 6), h = W.insert_dim(c, g.d, r, 7);
        dr.push(['Overall, as drawn', calcCell('<span class="mv">' + fLen(w) + ' x ' + fLen(h) + ' ' + uLen() + '</span>', 'extents of the outline')]);
      }
      const base = g.s > 0 && g.clr > 0 ? W.insert_base_ic(g.d, g.s, g.clr) : NaN;
      if (isFinite(base)) dr.push(['Bottom face ' + (p.shape === 'R' ? 'diameter' : 'inscribed circle'), calcCell(fBoth(base), 'd - 2 s tan(clearance)')]);
      if (d1c) dr.push(['Fixing hole d1', '<td class="v">' + fBoth(g.d1) + '</td>' + evCell(X.sources, d1c)]);
      if (isNaN(g.r) && p.shape !== 'R') dr.push(['Corner', '<td class="v"><span class="warn">corner code not known here: drawn sharp</span></td><td></td>']);
      dims = dr.length ? '<table class="codes" id="idims">' + rowsHtml(dr) + '</table>' : '';
      acts = '<div class="mfilter insacts"><button class="btn" id="iadv"' + (r > 0 ? '' : ' disabled') + ' title="Opens the turning advisor with this nose radius filled in">Use in the turning advisor</button>' +
        '<button class="btn" id="ifin"' + (r > 0 ? '' : ' disabled') + ' title="Opens the surface finish calculator with this nose radius filled in">Finish from this radius</button>' +
        '<button class="btn" id="isave" title="Adds this insert to your tool library, so the advisors can pick it">Save to my tools</button>' +
        '<button class="btn" id="isk" title="Opens the outline and its inscribed circle in the 2D sketcher, in millimetres (it replaces the sketch; Undo there brings the old one back)">Open in the sketcher</button>' +
        '<button class="btn" id="idxf" title="The outline and its inscribed circle as a DXF file in millimetres">Download DXF</button></div>';
    }
    out.innerHTML = '<div class="res"><div class="h">' + rEsc(p.shape + p.clear + p.tol + p.type + ' ' + p.size + ' ' + p.thick + ' ' + p.corner + (p.edge || p.hand ? ' ' + p.edge + p.hand : '') + (p.cb ? '-' + p.cb : '')) + '</div>' +
      (drawn ? drawn + acts + dims : '<div style="padding:8px 12px">' + insertSvg(p.shape, W) + (refused ? '<p class="warn" id="inodraw">Not drawn to scale: ' + rEsc(refused) + '.</p>' : '') + '</div>') + '<table class="codes">' + rowsHtml(rows) + '</table></div>';
    const on = (id, fn) => { const b = $('#' + id, out); if (b) b.onclick = fn; };
    on('iadv', () => sendTo('advturn', { re: toUser(cur.r) }));
    on('ifin', () => sendTo('finish', { r: toUser(cur.r) }));
    on('isave', () => {
      const nm = cur.name + (p.cb ? '-' + p.cb : '');
      if (ToolLib.all().some(t => t.type === 'Turning insert' && t.name === nm)) { toast(nm + ' is already in your tools'); return; }
      ToolLib.upsert({ name: nm, type: 'Turning insert', units: 'mm', cr: cur.r > 0 ? String(cur.r) : '', notes: 'From the insert designation page: inscribed circle ' + cur.g.d + ' mm' });
      toast(nm + ' saved to your tools');
    });
    const dxf = () => { const n = W.insert_dxf(c, cur.g.d, cur.r, 0); return n > 0 ? gsGet(n) : null; };
    on('isk', () => {
      const t = dxf(); if (!t) return;
      try { skImport(t, cur.name + '.dxf'); location.hash = '#/t/sketch'; } catch (x) { toast('Could not open it in the sketcher: ' + x.message); }
    });
    on('idxf', () => { const t = dxf(); if (t) saveFile(cur.name + '.dxf', t, 'application/dxf'); });
  }
  function fromBuilder() {
    const sh = pick[1] || 'C', d = +pick[5] || m.ic; m.ic = d;
    const cb = cbIn.value.trim().toUpperCase();
    ic.value = sh + (pick[2] || 'N') + (pick[3] || 'M') + (pick[4] || 'G') + sizeCode(sh, d) + (pick[6] || '04') + (sh === 'R' ? 'M0' : pick[7] === 'M0' || !pick[7] ? '08' : pick[7]) + edgeLetter + (pick[9] || '') + (cb ? '-' + cb : '');
    fromCode();
  }
  ic.oninput = fromCode;
  cbIn.oninput = fromBuilder;
  [1, 2, 3, 4, 6, 7, 9].forEach(i => rowEl(i).querySelectorAll('button').forEach(b => b.onclick = () => { pick[i] = b.dataset.v; fromBuilder(); }));
  $('#isrc', el).innerHTML = '<b>Sources (maker code keys and ISO 3364)</b><br>' + sourceList(X.sources);
  fromCode();
}

// ------------------------------------------------------------------ toolholder code (ISO 5608)
async function renderHolderCode(el) {
  const R = await loadRef(el); if (!R) return;
  const X = R.inserts; if (!X) { el.textContent = 'Insert data not built.'; return; }
  const m = RMEM.hold || (RMEM.hold = { code: 'PCLNR 2525 M12' });
  const H = X.holder, I = X.insert;
  el.innerHTML = '<div class="grid" style="max-width:760px"><label class="f"><span>External toolholder designation (ISO 5608)</span><div class="row"><input id="hc" type="text" spellcheck="false" style="text-transform:uppercase" value="' + rEsc(m.code) + '"></div></label></div><div id="hres"></div>' +
    '<div class="note"><b>How the code works:</b> 1 clamping system, 2 insert shape, 3 holder style (sets the approach angle and which way the edge faces), 4 insert clearance, 5 hand, 6 and 7 shank height and width in mm, 8 tool length letter, 9 insert size (the insert\'s cutting edge length in mm). ' +
    'The approach angle here is the ISO convention kr, measured from the work axis (feed direction) to the cutting edge: 90 deg and above is a square shoulder. North American catalogues often give a lead angle instead, measured from the square-on position, so a 15 deg lead is about kr 75. Boring bars (ISO 6261) use another layout and are not decoded here.' +
    '<br><b>Standard:</b> ISO 5608:2012, Turning and copying tool holders and cartridges for indexable inserts: designation (current per iso.org).</div><div class="note" id="hsrc"></div>';
  const hc = $('#hc', el);
  function kSvg(kr) {
    if (!isFinite(kr)) return '';
    const a = kr * Math.PI / 180, cx = 90, cy = 70, L = 55;
    const ex = cx - L * Math.cos(a), ey = cy - L * Math.sin(a);
    return '<svg viewBox="0 0 180 120" width="180" height="120" role="img" aria-label="approach angle"><line x1="10" y1="70" x2="170" y2="70" stroke="currentColor" stroke-dasharray="4 3" opacity=".6"/><text x="168" y="64" font-size="9" text-anchor="end" fill="currentColor">work axis, feed</text>' +
      '<line x1="' + cx + '" y1="' + cy + '" x2="' + ex.toFixed(1) + '" y2="' + ey.toFixed(1) + '" stroke="currentColor" stroke-width="3"/><text x="' + (cx + 6) + '" y="' + (cy + 16) + '" font-size="10" fill="currentColor">kr ' + kr + ' deg</text></svg>';
  }
  function upd() {
    m.code = hc.value;
    const s = hc.value.toUpperCase().replace(/[\s-]/g, '');
    const p = s.match(/^([A-Z])([A-Z])([A-Z])([A-Z])([RLN])(\d{2})(\d{2})([A-Z])(\d{2})/);
    const out = $('#hres', el);
    if (!p) { out.innerHTML = '<div class="res"><span class="warn">Expected 5 letters, shank height and width (2 digits each), a length letter and the insert size, for example PCLNR 2525 M12, SVJBL 2020 K16, DDJNR 3225 P15.</span></div>'; return; }
    const [, cl, sh, st, cr, hd, hh, bb, len, sz] = p;
    const style = H.style[st], kr = style ? +style.value : NaN;
    const rows = [
      ['1 Clamping <b>' + cl + '</b>', '<td class="v">' + consText(H.clamping[cl], IC_TEXT.clamp) + '</td>' + evCell(X.sources, H.clamping[cl])],
      ['2 Insert shape <b>' + sh + '</b>', '<td class="v">' + (I.shape[sh] ? rEsc(SHAPE_NAME[sh] || '') + (I.shape[sh].value === 'round' ? '' : ' ' + consText(I.shape[sh]) + ' deg') : '-') + '</td>' + evCell(X.sources, I.shape[sh])],
      ['3 Style <b>' + st + '</b>', '<td class="v">' + (style ? 'approach angle kr ' + consText(style) + ' deg' : '-') + '</td>' + evCell(X.sources, style)],
      ['4 Insert clearance <b>' + cr + '</b>', '<td class="v">' + (H.clearance[cr] || I.clearance[cr] ? consText(I.clearance[cr] || H.clearance[cr]) + ' deg' : '-') + '</td>' + evCell(X.sources, I.clearance[cr] || H.clearance[cr])],
      ['5 Hand <b>' + hd + '</b>', '<td class="v">' + consText(H.hand[hd], IC_TEXT.hand) + '</td>' + evCell(X.sources, H.hand[hd])],
      ['6 Shank height <b>' + hh + '</b>', calcCell(fBoth(+hh), 'the number is mm')],
      ['7 Shank width <b>' + bb + '</b>', calcCell(fBoth(+bb), 'the number is mm')],
      ['8 Tool length <b>' + len + '</b>', '<td class="v">' + (H.length[len] ? fBoth(+H.length[len].value) : '-') + '</td>' + evCell(X.sources, H.length[len])],
      ['9 Insert size <b>' + sz + '</b>', calcCell('<span class="mv">' + (+sz) + ' mm</span> <span class="ms">insert cutting edge length, whole mm</span>', 'matches the insert size code')],
    ];
    out.innerHTML = '<div class="res"><div class="h">' + rEsc(s) + '</div><div style="padding:8px 12px">' + kSvg(kr) + '</div><table class="codes">' + rowsHtml(rows) + '</table>' +
      '<p class="desc">Insert that fits: ' + rEsc(sh + cr) + '.. ' + rEsc(sz) + ' (shape ' + rEsc(sh) + ', clearance ' + rEsc(cr) + ', size ' + rEsc(sz) + '); the type and thickness depend on the clamping system and the maker.</p></div>';
  }
  hc.oninput = upd;
  $('#hsrc', el).innerHTML = '<b>Sources (maker code keys)</b><br>' + sourceList(X.sources);
  upd();
}

// ------------------------------------------------------------------ ISO 513 groups
const ISO513 = [
  ['P', 'Steels: unalloyed, low alloy and high alloy steels, steel castings, ferritic and martensitic stainless steels. Long chips.', '#2f6fb3'],
  ['M', 'Austenitic and duplex (austenitic-ferritic) stainless steels and their castings. Work hardening, sticky chips.', '#d9b100'],
  ['K', 'Cast irons: grey, nodular (ductile) and malleable. Short chips, abrasive.', '#c0392b'],
  ['N', 'Non-ferrous metals: aluminium and its alloys, copper, brass, bronze, plastics and other non-metals. Soft, built-up edge.', '#2e8b57'],
  ['S', 'Heat resistant super alloys (nickel, cobalt and iron based) and titanium alloys. High heat at the edge, low thermal conductivity.', '#d2691e'],
  ['H', 'Hardened steels (about 45 to 65 HRC) and chilled cast iron. High cutting forces, abrasive.', '#808080'],
];
async function renderIso513(el) {
  const R = await loadRef(el); if (!R) return;
  const G = R.iso513; if (!G) { el.textContent = 'ISO 513 data not built.'; return; }
  el.innerHTML = '<div class="res mtab"><table><tr><th>Group</th><th>Colour</th><th>Materials (our summary)</th><th>Colour evidence</th></tr>' + ISO513.map(([g, txt, col]) => {
    const c = G.colour[g];
    return '<tr><td><b>' + g + '</b></td><td style="white-space:nowrap"><span style="display:inline-block;width:14px;height:14px;background:' + col + ';border:1px solid var(--line, #888);vertical-align:middle;margin-right:6px"></span>' + consText(c) + '</td><td>' + rEsc(txt) + '</td>' + evCell(G.sources, c) + '</tr>';
  }).join('') + '</table></div>' +
    '<div class="note"><b>What the groups mean:</b> ISO 513 sorts hard cutting materials (carbide, cermet, ceramic, CBN, PCD) by the workpiece material they are meant for. Each insert box shows the letter and colour. The number after the letter (P10, P25, K20 ...) is the application range on a 01 to 50 scale: low numbers are harder, more wear resistant grades for finishing at higher speed and light feed; high numbers are tougher grades for roughing, interrupted cuts and heavy feeds. The numbers are a maker\'s own placing of its grade, not a measured property, so P25 from two makers need not behave the same. ' +
    'Older editions had only P, M and K, grouped by the kind of chip the material forms; the six groups based on machinability came later (Mitsubishi Materials dates the change to 2003). The colour swatches above are drawn by us to show the named colour.' +
    '<br><b>Standard:</b> ISO 513:2012, Classification and application of hard cutting materials for metal removal with defined cutting edges (current per iso.org). The disagreement for S (orange or brown) is shown as printed.</div><div class="note"><b>Sources</b><br>' + sourceList(G.sources) + '</div>';
}

// ------------------------------------------------------------------ surface texture
const PROC_NAME = { turning: 'Turning', boring: 'Boring', milling: 'Milling', drilling: 'Drilling', reaming: 'Reaming', broaching: 'Broaching', planing: 'Planing, shaping', sawing: 'Sawing', edm: 'Electrical discharge machining', grinding: 'Grinding', honing: 'Honing', polishing: 'Polishing', lapping: 'Lapping', superfinishing: 'Superfinishing', burnishing: 'Roller burnishing', flame: 'Flame cutting', sand_casting: 'Sand casting', die_casting: 'Die casting', investment_casting: 'Investment casting', forging: 'Forging', extruding: 'Extruding', cold_drawing: 'Cold rolling, drawing', laser: 'Laser cutting', electropolish: 'Electropolishing' };
async function renderSurface(el) {
  const R = await loadRef(el); if (!R) return;
  const W = state.W, T = R.surface; if (!T) { el.textContent = 'Surface data not built.'; return; }
  const m = RMEM.surf || (RMEM.surf = { ra: 1.6 });
  const uin = () => inMode(), raU = () => uin() ? 'uin' : 'um', toRaU = um => uin() ? um / 0.0254 : um, fromRaU = v => uin() ? v * 0.0254 : v;
  const fRa = um => '<span class="mv">' + (uin() ? fx(um / 0.0254, 0) + ' uin' : (+um.toPrecision(3)) + ' um') + '</span> <span class="ms">' + (uin() ? (+um.toPrecision(3)) + ' um' : fx(um / 0.0254, 0) + ' uin') + '</span>';
  const grades = Object.keys(T.n_ra).sort((a, b) => +a.slice(1) - +b.slice(1));
  el.innerHTML = '<div class="grid" style="max-width:760px"><label class="f"><span>Ra on the drawing or measured</span><div class="row"><input id="sr" type="number" step="any" inputmode="decimal" value="' + +toRaU(m.ra).toPrecision(4) + '"><span class="u">' + raU() + '</span></div></label></div><div id="sres"></div>' +
    '<div class="res mtab" style="margin-top:12px"><div class="h">Roughness grade numbers (N grades)</div><table><tr><th>Grade</th><th>Ra</th><th>Evidence</th></tr>' + grades.map(g => {
      const c = T.n_ra[g]; return '<tr><td><b>' + g + '</b></td><td>' + fRa(+c.value) + (c.groups.length > 1 ? '<br><span class="warn">also printed: ' + c.groups.slice(1).map(x => x.value + ' um (' + x.publishers.map(p => rEsc(pubName(T.sources, p))).join(', ') + ')').join('; ') + '</span>' : '') + '</td>' + evCell(T.sources, c) + '</tr>';
    }).join('') + '</table></div>' +
    '<div class="note"><b>Ra and RMS (Rq).</b> RMS, now written Rq, is the root-mean-square height of the profile about its mean line; Ra is the plain average height. Rq is never the smaller of the two. For a pure sine wave Rq = pi / (2 sqrt 2) x Ra = 1.11 Ra, the factor conversion charts use. For ideal profiles the ratio is ' +
    ['sine wave', 'triangular (sawtooth)', 'turned feed marks (arcs)', 'square wave'].map((n, i) => n + ' ' + fx(W.profile_rq_over_ra(i), 2)).join(', ') + ' (computed by the core and checked by sampling each profile). Measured surfaces run higher: Quality Magazine reports ratios of 1.17 to 1.26 for turning, 1.16 to 1.40 for milling, 1.22 to 1.27 for surface grinding, 1.29 to 2.10 for honing and 1.24 to 1.27 for EDM, and suggests about 1.25 for most processes (one source). So 1.11 is a low estimate, not a conversion. If an old drawing gives an RMS limit, measure Rq; if you can only measure Ra, keep it under the limit divided by the ratio for your process. Reading an RMS limit as an Ra limit of the same number accepts a rougher surface (Ra 63 uin is about 70 uin RMS or more).' +
    '<br><b>Sources:</b> Quality Magazine, "Apples, oranges and surface finish parameters" (sine ratio 1.11, measured ratios by process); Wevolver, "Surface finish chart: Ra, Rq and N grade conversions" (Rq about 1.11 Ra, exact only for a sine profile).</div>' +
    '<div class="note"><b>Why Ra cannot be converted to Rz with a fixed factor.</b> Ra is the average distance of the profile from its mean line, so it smooths everything out. Rz is the average of the largest peak-to-valley heights in five sampling lengths, so it is driven by the extremes. Two surfaces with the same Ra can have very different Rz: one isolated scratch or burr barely moves Ra but sets Rz. The ratio depends only on the shape of the profile; for ideal profiles it is ' +
    ['sine wave', 'triangular (sawtooth)', 'turned feed marks (arcs)', 'square wave'].map((n, i) => n + ' ' + fx(W.profile_rz_over_ra(i), 2)).join(', ') + ' (computed by the core and checked by sampling each profile). Real surfaces scatter much wider. ' +
    'Some tables print an Rz or Rt value beside each N grade; those columns are typical companions, not conversions. In the tables used here the ratio runs ' + (() => {
      const rs = []; Object.values(T.n_beside).forEach(b => grades.forEach(g => { const v = b.values[g]; if (v) rs.push(+v.split('-')[0] / +T.n_ra[g].value); }));
      return fx(Math.min(...rs), 1) + ' to ' + fx(Math.max(...rs), 1);
    })() + ' (' + Object.entries(T.n_beside).map(([p, b]) => b.param + ' column of ' + rEsc(pubName(T.sources, p))).join(', ') + '). If a drawing gives Rz, measure Rz. ' +
    'Ra = f^2 / (32 r) for a turned surface (see the Surface finish from nose radius tool) is the same geometric ideal; real finish is worse.</div>' +
    '<div class="note"><b>Drawing symbols, ISO 21920-1 and ISO 1302.</b> Both use the same tick-shaped symbol: the basic tick means any process allowed, a bar across the open side means material must be removed (machined), a circle in the vee means material must not be removed. A horizontal line on the long leg carries the requirement. ' +
    'ISO 21920-1:2021 replaced ISO 1302:2002 (withdrawn 2021-12-20). The new series moves the parameter definitions and the default measurement conditions (evaluation length, filters, how a measured value is compared with the limit) into ISO 21920-2 and ISO 21920-3. In practice: write the parameter with its value (Ra 1.6, Rz 6.3), and read an older drawing by the standard it names, since defaults differ between the old and new series. N grades such as N7 are an older ISO shorthand for an Ra limit (N7 = Ra 1.6 um); current drawings state the parameter and value instead.' +
    '<br><b>Standards:</b> ISO 21920-1:2021 (indication of surface texture), ISO 21920-2:2021 (terms, definitions and parameters), ISO 21920-3:2021 (specification operators), all current per iso.org; ISO 1302:2002 withdrawn 2021-12-20; ASME Y14.36-2018 for US drawings, edition not checked here.</div>' +
    '<div class="res mtab"><div class="h">Typical Ra by process (approximate; two publishers, shown side by side)</div><table><tr><th>Process</th>' + Object.keys(T.sources).filter(k => Object.values(T.process_ra).some(c => c.groups.some(g => g.publishers.includes(k)))).map(k => '<th>' + rEsc(pubName(T.sources, k)) + '</th>').join('') + '<th>Range both include</th></tr>' +
    Object.entries(T.process_ra).map(([p, c]) => {
      const pubs = ['AUTODESK', 'MECHENG'];
      const rg = pubs.map(k => { const g = c.groups.find(g => g.publishers.includes(k)); return g ? g.value.split('-').map(Number) : null; });
      const both = rg[0] && rg[1] ? [Math.max(rg[0][0], rg[1][0]), Math.min(rg[0][1], rg[1][1])] : null;
      const show = r => r ? (r[0] === r[1] ? fRa(r[0]) : fRa(r[0]) + ' to ' + fRa(r[1])) : '-';
      return '<tr><td>' + rEsc(PROC_NAME[p] || p) + '</td><td>' + show(rg[0]) + '</td><td>' + show(rg[1]) + '</td><td>' + (both ? both[0] <= both[1] ? show(both) : '<span class="warn">no overlap</span>' : '<span class="ms">one source</span>') + '</td></tr>';
    }).join('') + '</table><p class="desc">Ranges are what each publisher shows as usual for the process; special conditions give better or worse. The two charts group processes differently (one marks the usual values for each process, the other gives one range for a group of processes), so their limits rarely match exactly; the last column is the range both include.</p></div>' +
    '<div class="note"><b>Sources</b><br>' + sourceList(T.sources) + '</div>';
  const sr = $('#sr', el);
  function upd() {
    const v = parseFloat(sr.value), out = $('#sres', el);
    if (!(v > 0)) { out.innerHTML = ''; return; }
    const um = fromRaU(v); m.ra = um;
    const g = grades.find(g => +T.n_ra[g].value >= um * (1 - 1e-9));
    const below = [...grades].reverse().find(g => +T.n_ra[g].value < um * (1 - 1e-9));
    out.innerHTML = '<div class="res"><table>' + rowsHtml([
      ['Ra', calcCell(fRa(um), '1 um = 39.37 uin')],
      ['RMS (Rq), if the profile were a pure sine wave', calcCell(fRa(W.rq_ra_convert(um, 0, 0)), 'Ra x 1.11; real surfaces are 1.1 to 2.1 x Ra, see below')],
      ['Ra, if this number is an RMS (Rq) value', calcCell(fRa(W.rq_ra_convert(um, 0, 1)), 'RMS / 1.11, sine wave')],
      ['Smallest N grade that allows this Ra', calcCell(g ? '<b>' + g + '</b> (Ra ' + fRa(+T.n_ra[g].value) + ')' : 'coarser than N12', 'an N grade is an upper limit of Ra')],
      ['Next finer grade', calcCell(below ? below + ' (Ra ' + fRa(+T.n_ra[below].value) + ')' : '-')],
      ['Rz', calcCell('<span class="warn">not convertible</span>', 'for ideal profiles Rz is 2 to 4 x Ra, real surfaces vary more; see below')],
    ]) + '</table></div>';
  }
  sr.oninput = upd; upd();
}

// ------------------------------------------------------------------ hardness conversion
const HSCALES = [['hv', 'Vickers HV'], ['hb', 'Brinell HB'], ['hrc', 'Rockwell C (HRC)'], ['hrb', 'Rockwell B (HRB)'], ['hra', 'Rockwell A (HRA)'], ['uts', 'Tensile strength']];
async function renderHardness(el) {
  const R = await loadRef(el); if (!R) return;
  const W = state.W, T = R.hardness; if (!T) { el.textContent = 'Hardness data not built.'; return; }
  const m = RMEM.hard || (RMEM.hard = { scale: 'hrc', v: 45 });
  const KSI = 6.894757;
  el.innerHTML = '<div class="grid" style="max-width:760px"><label class="f"><span>Scale</span><div class="row"><select id="hs">' + HSCALES.map(([k, n]) => '<option value="' + k + '">' + n + '</option>').join('') + '</select></div></label>' +
    '<label class="f"><span>Value</span><div class="row"><input id="hv" type="number" step="any" inputmode="decimal"><span class="u" id="hu"></span></div></label></div>' +
    '<div class="fchips" id="hpick" role="group" aria-label="Scales to show"></div><div id="hres"></div><div class="tdia" id="hchart" style="border:0;padding:0;max-width:760px"></div>' +
    '<div class="note"><b>Read this first.</b> Hardness conversions are approximate and only valid for the material group the table was made for: here unalloyed and low alloy steels and cast steel, heat treated or hot formed (ISO 18265, the table both publishers below reproduce). Expect large errors for austenitic stainless, high alloy or cold worked steels, cast iron and non-ferrous metals, which have their own tables. Tensile strength from hardness is an estimate, not a substitute for a tensile test. Values in brackets in the source tables are outside the normal range of that test method (Brinell above 450 with a carbide ball only). ' +
    'Between table rows the value is interpolated linearly, as the standards do; the working shows the two rows used. Outside the table nothing is given. ' +
    '<br><b>Standards:</b> ISO 18265:2013 (metallic materials, conversion of hardness values; current per iso.org) and ASTM E140-26 (hardness conversion tables for metals; current, published 2026). The ASTM tables are separate and differ in places from ISO 18265; the values here are ISO 18265 values as printed by the publishers below. Older practice: DIN 50150 was replaced by DIN EN ISO 18265.</div><div id="htab"></div><div class="note"><b>Sources</b><br>' + sourceList(T.sources) + '</div>';
  const hs = $('#hs', el), hv = $('#hv', el);
  hs.value = m.scale;
  const unit = k => k === 'uts' ? (inMode() ? 'ksi' : 'MPa') : '';
  const show = (k, v) => k === 'uts' ? '<span class="mv">' + (inMode() ? fx(v / KSI, 0) + ' ksi' : fx(v, 0) + ' MPa') + '</span> <span class="ms">' + (inMode() ? fx(v, 0) + ' MPa' : fx(v / KSI, 0) + ' ksi') + '</span>' : '<span class="mv">' + fx(v, k === 'hv' || k === 'hb' ? 0 : 1) + '</span>';
  function setInput() { $('#hu', el).textContent = unit(hs.value); hv.value = m.scale === hs.value ? (hs.value === 'uts' && inMode() ? +(m.v / KSI).toFixed(1) : m.v) : ''; }
  // Scale picker: which scales to list and draw (the input scale always shows). Kept between runs.
  let shown = null; try { shown = JSON.parse(localStorage.getItem('bm.hardscales') || 'null'); } catch (e) {}
  if (!Array.isArray(shown) || !shown.length) shown = HSCALES.map(s => s[0]);
  const isOn = f => shown.includes(f) || f === hs.value;
  function picker() {
    $('#hpick', el).innerHTML = '<span class="ms" style="align-self:center">Show:</span>' + HSCALES.map(([f, n]) => '<button type="button" class="fchip' + (isOn(f) ? ' on' : '') + '" data-f="' + f + '"' + (f === hs.value ? ' disabled title="The scale you are converting from"' : '') + ' aria-pressed="' + isOn(f) + '">' + rEsc(n) + '</button>').join('');
    $$('#hpick button', el).forEach(b => b.onclick = () => {
      const f = b.dataset.f; shown = shown.includes(f) ? shown.filter(x => x !== f) : shown.concat(f);
      try { localStorage.setItem('bm.hardscales', JSON.stringify(shown)); } catch (e) {}
      picker(); upd();
    });
  }
  // Chart: every scale laid along a common Vickers axis, from the confirmed table rows, with the value marked.
  function chart(hvNow) {
    const scales = HSCALES.filter(([f]) => isOn(f)), Wd = 520, x0 = 96, x1 = 500, y0 = 34, dy = 30, H = y0 + scales.length * dy + 22;
    const hvs = T.rows.map(r => r.hv.value), hmin = Math.min(...hvs), hmax = Math.max(...hvs);
    const X = h => x0 + (x1 - x0) * (h - hmin) / (hmax - hmin);
    const ticks = { hv: [100, 200, 300, 400, 500, 600, 700, 800, 900], hb: [100, 200, 300, 400, 500, 600], hrc: [20, 30, 40, 50, 60, 65], hrb: [50, 60, 70, 80, 90, 100], hra: [60, 65, 70, 75, 80, 85], uts: inMode() ? [50, 100, 150, 200, 250, 300].map(v => v * KSI) : [500, 1000, 1500, 2000] };
    let s = '';
    scales.forEach(([f, n], i) => {
      const y = y0 + i * dy, rows = T.rows.filter(r => r[f] && r[f].status === 'confirmed' && !r[f].approx);
      if (rows.length < 2) return;
      s += DK.line(X(rows[0].hv.value), y, X(rows[rows.length - 1].hv.value), y, 'ln') + DK.text(x0 - 10, y + 4, f === 'uts' ? 'Tensile ' + (inMode() ? 'ksi' : 'MPa') : f.toUpperCase(), { cls: 'txt', anchor: 'end' });
      let lastX = -99;
      for (const tv of ticks[f]) {
        for (let j = 0; j < rows.length - 1; j++) {
          const a = rows[j][f].value, b = rows[j + 1][f].value;
          if ((a <= tv && tv <= b) || (b <= tv && tv <= a)) {
            const h = a === b ? rows[j].hv.value : W.lerp(tv, a, rows[j].hv.value, b, rows[j + 1].hv.value), x = X(h);
            s += DK.line(x, y - 4, x, y + 4, 'thin');
            if (Math.abs(x - lastX) >= 22) { s += DK.text(x, y - 7, f === 'uts' && inMode() ? fx(tv / KSI, 0) : String(tv), { cls: 'mut', size: 10 }); lastX = x; } // no crowded labels
            break;
          }
        }
      }
      if (isFinite(hvNow)) {
        const lo2 = rows.findIndex((r, j) => j < rows.length - 1 && r.hv.value <= hvNow && hvNow <= rows[j + 1].hv.value);
        if (lo2 >= 0) s += DK.circle(X(hvNow), y, 3.4, 'hotf');
      }
    });
    if (isFinite(hvNow)) s += DK.line(X(hvNow), y0 - 16, X(hvNow), y0 + (scales.length - 1) * dy + 10, 'hot');
    s += DK.text(x0, H - 6, 'softer', { cls: 'mut', anchor: 'start' }) + DK.text(x1, H - 6, 'harder', { cls: 'mut', anchor: 'end' });
    $('#hchart', el).innerHTML = DK.svg(Wd, H, s, 'Hardness scales side by side for steel, with the converted value marked');
  }
  function upd() {
    const k = hs.value, raw = parseFloat(hv.value), out = $('#hres', el);
    m.scale = k;
    if (!(raw > 0)) { out.innerHTML = ''; chart(NaN); return; }
    const x = k === 'uts' && inMode() ? raw * KSI : raw; m.v = k === 'uts' && inMode() ? x : raw;
    // interpolate only on values both publishers print
    const rows = T.rows.filter(r => r[k] && r[k].status === 'confirmed').map(r => ({ r, x: r[k].value }));
    let lo = null, hi = null;
    for (let i = 0; i < rows.length - 1; i++) if (rows[i].x <= x && x <= rows[i + 1].x) { lo = rows[i]; hi = rows[i + 1]; break; }
    if (!lo) { chart(NaN); out.innerHTML = '<div class="res"><span class="warn">Outside the published table for ' + rEsc(HSCALES.find(s => s[0] === k)[1]) + ' (' + fx(rows[0].x, 1) + ' to ' + fx(rows[rows.length - 1].x, 1) + '). No conversion given.</span></div>'; return; }
    chart(k === 'hv' ? x : W.lerp(x, lo.x, lo.r.hv.value, hi.x, hi.r.hv.value));
    const res = HSCALES.filter(([f]) => f !== k && isOn(f)).map(([f, n]) => {
      if (!lo.r[f] || !hi.r[f] || lo.r[f].status !== 'confirmed' || hi.r[f].status !== 'confirmed') return [n, calcCell('-', 'not in the table at this hardness (or printed by one source only)')];
      const v = W.lerp(x, lo.x, lo.r[f].value, hi.x, hi.r[f].value);
      const ap = lo.r[f].approx || hi.r[f].approx, st = [lo.r[f].status, hi.r[f].status].find(s => s !== 'confirmed') || 'confirmed';
      return [n, '<td class="v">' + show(f, v) + (ap ? ' <span class="warn">bracketed in the source: outside the test method range</span>' : '') + '</td><td title="' + rEsc(groupsTitle(T.sources, lo.r[f].groups)) + '">' + badge(st) + '</td>'];
    });
    out.innerHTML = '<div class="res"><div class="h">' + show(k, x) + ' ' + rEsc(HSCALES.find(s => s[0] === k)[1]) + ' (steel, approximate)' + (lo.r[k].approx || hi.r[k].approx ? ' <span class="warn">input is in the bracketed range of the source table</span>' : '') + '</div><table>' + rowsHtml(res) + '</table>' +
      '<p class="desc">Working: linear interpolation between the table rows at HV ' + lo.r.hv.value + ' (' + rEsc(k.toUpperCase()) + ' ' + lo.x + ') and HV ' + hi.r.hv.value + ' (' + rEsc(k.toUpperCase()) + ' ' + hi.x + '): y = y0 + (y1 - y0)(x - x0)/(x1 - x0).</p></div>';
  }
  function table() {
    $('#htab', el).innerHTML = '<details><summary>Show the table (' + T.rows.length + ' rows)</summary><div class="res mtab"><table><tr><th>HV</th><th>HB</th><th>HRC</th><th>HRB</th><th>HRA</th><th>Tensile ' + (inMode() ? 'ksi' : 'MPa') + '</th></tr>' + T.rows.map(r => '<tr><td>' + r.hv.value + '</td>' + ['hb', 'hrc', 'hrb', 'hra', 'uts'].map(f => {
      const c = r[f]; if (!c) return '<td>-</td>';
      const v = f === 'uts' && inMode() ? fx(c.value / KSI, 0) : String(c.value);
      return '<td title="' + rEsc(groupsTitle(T.sources, c.groups)) + '">' + (c.approx ? '(' + v + ')' : v) + (c.status === 'confirmed' ? '' : ' ' + badge(c.status)) + '</td>';
    }).join('') + '</tr>').join('') + '</table></div><p class="desc">Every cell is printed by both publishers unless marked One source. The bracketed HRB values above 100 sit one row apart in the two printings, so each shows as One source.</p></details>';
  }
  hs.onchange = () => { setInput(); picker(); upd(); }; hv.oninput = upd;
  setInput(); picker(); upd(); table();
}

// ------------------------------------------------------------------ knurling
// Four ways to a blank diameter: a diametral pitch knurl, a circular pitch
// knurl, measuring the knurl you have (print or wheel), and trial and error
// with a tick-off procedure. All numbers come from the Rust core; the steps
// and their sources come from data/refdata/knurl-evidence.json.
async function renderKnurl(el) {
  const R = await loadRef(el); if (!R) return;
  const W = state.W, K = R.knurl; if (!K) { el.textContent = 'Knurl data not built.'; return; }
  const m = RMEM.knurl || (RMEM.knurl = { meth: inMode() ? 'dp' : 'cp', sys: 'mm', p: 1.0, dp: 96, form: 0, d: 20, how: 'print', span: null, lines: '', wd: null, wt: '', tb: null, tk: null, tf: null, ticks: [] });
  const lenF = (id, lab, hint) => '<label class="f"><span>' + lab + '</span><div class="row"><input id="' + id + '" type="number" step="any" inputmode="decimal"' + (hint ? ' placeholder="' + hint + '"' : '') + '><span class="u">' + uLen() + '</span></div></label>';
  const srcTag = st => st.status === 'own' ? 'BenchMate\'s advice, no source' : st.src.map(k => rEsc(pubName(K.sources, k))).filter((x, n, a) => a.indexOf(x) === n).join(', ') + (st.status === 'single' ? ' (one source)' : '');
  el.innerHTML = '<div class="grid" style="max-width:760px">' +
    '<label class="f" style="grid-column:1/-1"><span>Method</span><div class="row"><select id="km"><option value="dp">1. Diametral pitch knurl (DP, ANSI/ASME B94.6)</option><option value="cp">2. Circular pitch knurl (mm or TPI)</option><option value="count">3. Measure and count the knurl you have</option><option value="trial">4. Trial and error, step by step</option></select></div></label></div>' +
    '<div class="grid kmeth" data-m="dp" style="max-width:760px"><label class="f"><span>Diametral pitch</span><div class="row"><input id="kdp" type="number" step="any" inputmode="decimal" list="kdpl"><datalist id="kdpl">' + K.pitches_dp.map(v => '<option value="' + v + '">').join('') + '</datalist><span class="u">DP</span></div></label></div>' +
    '<div class="grid kmeth" data-m="cp" style="max-width:760px"><label class="f"><span>Pitch given as</span><div class="row"><select id="ks"><option value="mm">Circular pitch, mm (DIN 82 / DIN 403)</option><option value="tpi">Teeth per inch, TPI (circular pitch)</option></select></div></label>' +
    '<label class="f"><span>Pitch</span><div class="row"><input id="kp" type="number" step="any" inputmode="decimal" list="kpl"><datalist id="kpl"></datalist><span class="u" id="kpu"></span></div></label></div>' +
    '<div class="grid kmeth" data-m="count" style="max-width:760px"><label class="f"><span>Measured from</span><div class="row"><select id="kh"><option value="print">A print: roll the wheel along paper, count the spaces</option><option value="wheel">The wheel: count its teeth, measure over them</option></select></div></label>' +
    '<label class="f"><span id="kll"></span><div class="row"><input id="kl" type="number" step="1" min="1" inputmode="numeric"></div></label>' + lenF('kspan', '<span id="ksl"></span>') + '</div>' +
    '<div class="grid kmeth" data-m="dp cp" style="max-width:760px"><label class="f"><span>Pattern</span><div class="row"><select id="kf"><option value="0">Straight (teeth parallel to the axis)</option><option value="30">Diagonal or diamond, 30 deg teeth</option></select></div></label></div>' +
    '<div class="grid kmeth" data-m="dp cp count" style="max-width:760px">' + lenF('kd', 'Wanted diameter (finished or blank)') + '</div>' +
    '<div class="kmeth" data-m="trial"><ol class="ktick" id="ktick">' + K.trial_steps.map((st, n) => '<li><label class="chk"><input type="checkbox" data-n="' + n + '"><span><b>' + rEsc(st.t) + '</b></span></label><div class="ms">' + rEsc(st.why) + ' <i>[' + srcTag(st) + ']</i></div></li>').join('') + '</ol>' +
    '<p><button class="btn" id="kclr" type="button">Clear the ticks</button> <span class="ms" id="kdone"></span></p>' +
    '<div class="grid" style="max-width:760px">' + lenF('ktb', 'Blank you tried') + lenF('ktk', 'Knurled diameter measured', 'after step 8') + lenF('ktf', 'Finished diameter wanted', 'optional') + '</div></div>' +
    '<div id="kres"></div>' +
    '<div class="note"><b>Working:</b> a knurl tracks cleanly when a whole number of teeth fits around the blank. With circular pitch p measured square to the teeth and the teeth at angle h to the axis, the pitch around the circumference is p / cos h, so teeth n = pi D cos h / p and the blank for n teeth is D = n p / (pi cos h). TPI knurls have p = 1/TPI in (25.4 / TPI mm); a diametral pitch knurl has p = pi / DP in, which makes D = n / DP for a straight knurl. ' +
    '<b>Measure and count:</b> a print of the wheel rolled along paper gives the pitch in the direction of rolling, p = span / spaces counted, which is the pitch around the work whatever the pattern, so D = n p / pi. Count 50 to 100 spaces to keep the error small. A wheel measured over its teeth gives p = pi d / teeth at its outside; on an ANSI diametral pitch wheel that reads a little low (see the result), so prefer the print or the maker\'s DP. ' +
    '<b>Trial and error:</b> no pitch is needed. The page gives the next blanks to try (about 0.005 in, 0.13 mm, either way), the growth measured on the trial piece and the blank that gives the finished size at that growth. All numbers are computed by the Rust core and checked against the Dorian, Hommel+Keller, Hoffman and ANSI wheel examples. ' +
    'A formed knurl raises the diameter (material is pushed up), by an amount that depends on pitch, material and form, so the blank is turned below the finished size; cut knurling barely changes the diameter. The makers\' allowance tables are approximations and are not tabulated here. ' +
    'The standard metric pitches in DIN 403 are 0.5, 0.6, 0.8, 1.0, 1.2 and 1.6 mm. In the US the diametral pitches are 64, 96, 128 and 160 DP (' + (K.pitches_dp_status === 'confirmed' ? 'two sources' : 'one source') + '), chosen so that standard fractional blanks hold whole tooth counts (96 and 160 DP on 1/32 in steps, 64 and 128 DP on 1/64 in steps, per Dorian).' +
    '<br><b>Standards:</b> DIN 82:1973-01 (knurls; current per DIN Media), DIN 403 (knurling wheels; edition not confirmed here). ANSI/ASME B94.6-1984 (knurling) is quoted from a secondary page; the standard itself was not read.</div><div class="note" id="kpitch"></div>' +
    '<div class="note"><b>Sources</b><br>' + sourceList(K.sources) + (K.not_used && K.not_used.length ? '<br><b>Read and not used:</b> ' + K.not_used.map(x => rEsc(x.publisher) + ', ' + rEsc(x.title) + ': ' + rEsc(x.why)).join(' ') : '') + '</div>';
  const q = id => $('#' + id, el), km = q('km'), ks = q('ks'), kp = q('kp'), kf = q('kf'), kdp = q('kdp'), kh = q('kh'), kl = q('kl');
  $('#kpitch', el).innerHTML = '<b>Metric pitches offered by the two makers:</b> ' + K.pitches_mm.map(x => x.p.toFixed(1) + ' mm ' + (x.status === 'confirmed' ? '(both)' : '(' + rEsc(pubName(K.sources, x.publishers[0])) + ')')).join(', ') + '.';
  // A length box bound to m[key] in mm: the stored value is kept exactly until the user types another.
  function bindLen(id, key) {
    const inp = q(id), orig = m[key], shown = orig > 0 ? String(+toUser(orig).toFixed(inMode() ? 4 : 3)) : '';
    inp.value = shown; inp.oninput = upd;
    return () => { const v = parseFloat(inp.value); m[key] = inp.value === shown ? orig : (v > 0 ? fromUser(v) : null); return m[key]; };
  }
  function setUnits() {
    $('#kpu', el).textContent = { mm: 'mm', tpi: 'TPI' }[ks.value];
    $('#kpl', el).innerHTML = (ks.value === 'mm' ? K.pitches_mm.map(x => x.p) : [10, 12, 14, 16, 20, 21, 25, 30, 33, 35, 40, 50]).map(v => '<option value="' + v + '">').join('');
  }
  function setHow() {
    q('kll').textContent = kh.value === 'print' ? 'Spaces counted on the print' : 'Teeth on the wheel';
    q('ksl').textContent = kh.value === 'print' ? 'Length they cover, along the direction of rolling' : 'Wheel diameter over the teeth';
    kl.value = kh.value === 'print' ? m.lines : m.wt;
    getSpan = bindLen('kspan', kh.value === 'print' ? 'span' : 'wd');
  }
  function setMeth() { for (const d of el.querySelectorAll('.kmeth')) d.hidden = !d.dataset.m.split(' ').includes(km.value); }
  if (m.sys === 'dp') { m.sys = 'tpi'; }
  km.value = m.meth; ks.value = m.sys; kf.value = String(m.form); kp.value = m.p; kdp.value = m.dp; kh.value = m.how;
  let getSpan = null;
  const getD = bindLen('kd', 'd'), getTb = bindLen('ktb', 'tb'), getTk = bindLen('ktk', 'tk'), getTf = bindLen('ktf', 'tf');
  const ticks = [...el.querySelectorAll('#ktick input')];
  function showTicks() {
    ticks.forEach((c, n) => { c.checked = !!m.ticks[n]; c.closest('li').classList.toggle('done', c.checked); });
    q('kdone').textContent = ticks.filter(c => c.checked).length + ' of ' + ticks.length + ' steps ticked';
  }
  ticks.forEach((c, n) => { c.onchange = () => { m.ticks[n] = c.checked; showTicks(); }; });
  q('kclr').onclick = () => { m.ticks = []; showTicks(); };
  function blankRows(pmm, h, dmm, how) {
    const nx = W.knurl_teeth_exact(dmm, pmm, h), n0 = Math.max(1, Math.floor(nx)), n1 = Math.ceil(nx);
    return [
      ['Circular pitch p' + (h ? ' (square to the teeth)' : ''), calcCell(fBoth(pmm), how)],
      ['Pitch around the circumference', calcCell(fBoth(W.knurl_pitch_around(pmm, h)), h ? 'p / cos ' + h + ' deg' : 'equal to p')],
      ['Teeth on the wanted diameter', calcCell(fx(nx, 2), h ? 'pi D cos h / p' : 'pi D / p')],
      ['Blank for ' + n0 + ' teeth', calcCell(fBoth(W.knurl_blank_dia(pmm, n0, h)), h ? 'D = n p / (pi cos h), smaller' : 'D = n p / pi, smaller')],
      ['Blank for ' + n1 + ' teeth', calcCell(fBoth(W.knurl_blank_dia(pmm, n1, h)), 'larger')],
      ['Steps between whole tooth counts', calcCell(fBoth(W.knurl_blank_dia(pmm, 1, h)), 'one tooth more or less')],
    ];
  }
  const tail = '<p class="desc">Turn the blank to one of the two diameters, then knurl. If it does not track, go on with method 4 from that diameter. For a formed knurl allow for the raise of diameter; check with a test piece.</p>';
  function upd() {
    m.meth = km.value; m.sys = ks.value; m.form = +kf.value; m.how = kh.value;
    if (parseFloat(kp.value) > 0) m.p = parseFloat(kp.value);
    if (parseFloat(kdp.value) > 0) m.dp = parseFloat(kdp.value);
    const out = q('kres'), dmm = getD(), h = +kf.value, nl = parseFloat(kl.value), span = getSpan();
    if (km.value === 'count') { if (kh.value === 'print') m.lines = kl.value; else m.wt = kl.value; }
    let rows = null, extra = '';
    if (km.value === 'dp') {
      const v = parseFloat(kdp.value);
      if (v > 0 && dmm > 0) rows = blankRows(W.knurl_dp_to_cp(v) * IN_MM, h, dmm, 'pi / DP in');
    } else if (km.value === 'cp') {
      const v = parseFloat(kp.value);
      if (v > 0 && dmm > 0) rows = blankRows(ks.value === 'mm' ? v : IN_MM / v, h, dmm, ks.value === 'mm' ? 'as entered' : '25.4 / TPI mm');
    } else if (km.value === 'count') {
      if (nl >= 1 && span > 0) {
        const print = kh.value === 'print', pmm = print ? W.knurl_pitch_from_print(span, nl) : W.knurl_pitch_from_wheel(span, nl);
        rows = dmm > 0 ? blankRows(pmm, 0, dmm, print ? 'span / spaces' : 'pi d / teeth, at the outside of the wheel')
          : [['Circular pitch p', calcCell(fBoth(pmm), print ? 'span / spaces' : 'pi d / teeth')]];
        if (!print) {
          const X = K.ansi_wheel_example;
          rows.push(['Teeth per inch of wheel diameter', calcCell(fx(W.knurl_dp_from_wheel(span / IN_MM, nl), 2), 'teeth / diameter in inch')]);
          extra = '<p class="desc"><b>Approximate.</b> ' + (X ? 'An ANSI ' + rEsc(X.dp) + ' DP wheel of ' + rEsc(X.nominal_in) + ' in nominal size measures ' + rEsc(X.major_in) + ' in over its ' + rEsc(X.teeth) + ' teeth (' + rEsc(pubName(K.sources, X.src[0])) + ', one source), which gives ' + fx(W.knurl_dp_from_wheel(+X.major_in, +X.teeth), 1) + ' on this line and a pitch of ' + rEsc(X.cp_outside_in) + ' in where the nominal pitch is ' + rEsc(X.cp_nominal_in) + ' in. ' : '') +
            'So a value a little above one of the standard diametral pitches (' + K.pitches_dp.join(', ') + ') points to that pitch: then use method 1 with it. Otherwise make a print, which measures the pitch the work sees.</p>';
        } else extra = '<p class="desc">Measure along the direction the wheel rolled, not square to the lines of a diagonal knurl. Keep the pitch with the knurl: it does not change.</p>';
      }
    } else {
      const tb = getTb(), tk = getTk(), tf = getTf(), st = W.knurl_trial_step_mm();
      rows = [];
      if (tb > 0) {
        rows.push(['If it double tracks, try next', calcCell(fBoth(W.knurl_blank_for_finish(tb, st)), 'blank less ' + fx(st / IN_MM, 3) + ' in (' + fx(st, 3) + ' mm)')]);
        rows.push(['or', calcCell(fBoth(W.knurl_blank_for_finish(tb, -st)), 'blank plus the same step')]);
        if (tk > 0) {
          const g = W.knurl_growth(tk, tb);
          rows.push(['Growth on this trial piece', calcCell(fBoth(g), 'knurled diameter less blank')]);
          if (tf > 0) rows.push(['Blank for the finished diameter', calcCell(fBoth(W.knurl_blank_for_finish(tf, g)), 'finished diameter less the growth')]);
          if (g < 0) extra = '<p class="desc"><b>Check the two diameters:</b> the knurled diameter is smaller than the blank. A formed knurl raises the diameter; a cut knurl barely changes it.</p>';
          else if (tf > 0) extra = '<p class="desc">Tracking depends on the diameter, so try the new blank on scrap as well before the job. The growth holds only for the same knurl, material and depth.</p>';
        }
      }
      if (!rows.length) { out.innerHTML = '<p class="desc">Enter the blank you tried to get the next diameters to try.</p>'; return; }
    }
    out.innerHTML = rows ? '<div class="res"><table>' + rowsHtml(rows) + '</table>' + extra + (km.value === 'trial' ? '' : tail) + '</div>' : '';
  }
  km.onchange = () => { setMeth(); upd(); };
  ks.onchange = () => { setUnits(); kp.value = ks.value === 'mm' ? 1.0 : 20; upd(); };
  kh.onchange = () => { m.how = kh.value; setHow(); upd(); };
  kp.oninput = upd; kdp.oninput = upd; kf.onchange = upd; kl.oninput = upd;
  setUnits(); setHow(); setMeth(); showTicks(); upd();
}

// ------------------------------------------------------------------ gun drilling
// Starting speed, feed, coolant pressure and flow for a single-flute gundrill. The tables are one maker's
// (Sterling), with a second maker's ranges (botek) beside them for the steels and nothing merged. Lookups and
// unit conversion happen here; every calculated number comes from the Rust core.
async function renderGunDrill(el) {
  const R = await loadRef(el); if (!R) return;
  const W = state.W, K = R.gundrill; if (!K) { el.textContent = 'Gun drilling data not built.'; return; }
  const m = RMEM.gundrill || (RMEM.gundrill = { d: 12.7, g: 'lc', h: 0, a: -1, c: 'hp', f: 'c1', depth: null });
  const GAL_L = 3.785411784, PSI_BAR = 0.0689475729, FCOL = Object.keys(K.feed.columns);
  const lenF = (id, lab, hint) => '<label class="f"><span>' + lab + '</span><div class="row"><input id="' + id + '" type="number" step="any" inputmode="decimal"' + (hint ? ' placeholder="' + hint + '"' : '') + '><span class="u">' + uLen() + '</span></div></label>';
  const sel = (id, lab) => '<label class="f"><span>' + lab + '</span><div class="row"><select id="' + id + '"></select></div></label>';
  el.innerHTML = '<div class="grid" style="max-width:760px">' + lenF('gdd', 'Drill diameter') + sel('gdm', 'Material') + sel('gdh', 'Hardness, HRC') + sel('gda', 'Speed adjustment') +
    '<label class="f"><span>Coolant delivery</span><div class="row"><select id="gdc">' + K.speed.columns.map(c => '<option value="' + c + '">' + rEsc(K.speed.column_names[c]) + '</option>').join('') + '</select></div></label>' +
    sel('gdf', 'Feed column of the table') + lenF('gdl', 'Hole depth', 'optional') + '</div><div id="gdres"></div>' +
    '<div class="note"><b>Working:</b> the speed comes from Sterling\'s chart by material and hardness; rpm = 12 x SFM / (pi x D in). The feed per revolution comes from Sterling\'s table by diameter, and the pressure, flow and longest unsupported length from its oil table; between two table sizes the value is taken on a straight line, and outside the table (0.125 to 1.000 in) nothing is given. Feed rate = feed x rpm. Over 30 diameters deep the feed is cut by 20 %. ' +
    'For the steels, botek\'s guide ranges for the same diameter are shown beside Sterling\'s figure and not mixed with it. The two makers do not agree everywhere: Sterling\'s feeds sit at or under the low end of botek\'s ranges. Start low and listen to the chips. ' +
    'The pressure and flow table has one source (botek and ISCAR give theirs as charts that could not be read). UNISIG\'s starting flow per unit of diameter, for deep hole drilling in general, is shown beside it; it is higher, and UNISIG says it varies by tool type. These are starting values, not limits: the tool maker\'s data for your drill comes first.</div>' +
    '<div class="note"><b>Before you drill</b><ul class="gdrules">' + K.rules.map(r => '<li>' + rEsc(r.t) + ' <i>[' + r.src.map(k => rEsc(pubName(K.sources, k))).filter((x, n, a) => a.indexOf(x) === n).join(', ') + (r.status === 'single' ? ', one source' : '') + ']</i></li>').join('') + '</ul></div>' +
    '<div class="note"><b>Sources</b><br>' + sourceList(K.sources) + '<br><b>Read and not used:</b> ' + K.not_used.map(x => rEsc(x.publisher) + ', ' + rEsc(x.title) + ': ' + rEsc(x.why)).join(' ') + '</div>';
  const q = id => $('#' + id, el), gm = q('gdm'), gh = q('gdh'), ga = q('gda'), gc = q('gdc'), gf = q('gdf');
  const grp = () => K.speed.groups.find(g => g.id === gm.value) || K.speed.groups[0];
  function bindLen(id, key) {
    const inp = q(id), orig = m[key], shown = orig > 0 ? String(+toUser(orig).toFixed(inMode() ? 4 : 3)) : '';
    inp.value = shown; inp.oninput = upd;
    return () => { const v = parseFloat(inp.value); m[key] = inp.value === shown ? orig : (v > 0 ? fromUser(v) : null); return m[key]; };
  }
  gm.innerHTML = K.speed.groups.map(g => '<option value="' + g.id + '">' + rEsc(g.name) + '</option>').join('');
  gf.innerHTML = FCOL.map(c => '<option value="' + c + '">' + rEsc(K.feed.columns[c]) + '</option>').join('');
  function fillGroup(keep) {
    const G = grp();
    gh.innerHTML = G.rows.map((r, n) => '<option value="' + n + '">' + rEsc(r[0]) + '</option>').join('');
    ga.innerHTML = '<option value="-1">None</option>' + G.adjust.map((a, n) => '<option value="' + n + '">' + rEsc(a[0]) + ': ' + (a[1] > 0 ? '+' : '') + a[1] + ' %</option>').join('');
    ga.disabled = !G.adjust.length;
    if (keep) { gh.value = String(Math.min(m.h, G.rows.length - 1)); ga.value = String(m.a < G.adjust.length ? m.a : -1); gf.value = m.f; }
    else { gh.value = '0'; ga.value = '-1'; gf.value = G.feed; }
  }
  // Straight line between the two table rows that bracket x (column c); null outside the table or where a cell is empty.
  function tab(rows, x, c) {
    if (!(x >= rows[0][0] && x <= rows[rows.length - 1][0])) return null;
    for (let i = 0; i < rows.length - 1; i++) if (x >= rows[i][0] && x <= rows[i + 1][0]) {
      if (rows[i][c] === null || rows[i + 1][c] === null) return x === rows[i + 1][0] ? rows[i + 1][c] : x === rows[i][0] ? rows[i][c] : null;
      return W.lerp(x, rows[i][0], rows[i][c], rows[i + 1][0], rows[i + 1][c]);
    }
    return null;
  }
  const two = (a, ua, da, b, ub, db) => '<span class="mv">' + fx(a, da) + ' ' + ua + '</span> <span class="ms">' + fx(b, db) + ' ' + ub + '</span>';
  const rng = (a0, a1, ua, da, b0, b1, ub, db) => '<span class="mv">' + fx(a0, da) + ' to ' + fx(a1, da) + ' ' + ua + '</span> <span class="ms">' + fx(b0, db) + ' to ' + fx(b1, db) + ' ' + ub + '</span>';
  const lng = i => inMode() ? two(i, 'in', 1, i * IN_MM, 'mm', 0) : two(i * IN_MM, 'mm', 0, i, 'in', 1);
  const spd = sfm => inMode() ? two(sfm, 'SFM', 0, sfm * FT_M, 'm/min', 1) : two(sfm * FT_M, 'm/min', 1, sfm, 'SFM', 0);
  const fdr = f => inMode() ? two(f, 'in/rev', 5, f * IN_MM, 'mm/rev', 4) : two(f * IN_MM, 'mm/rev', 4, f, 'in/rev', 5);
  const fdm = f => inMode() ? two(f, 'in/min', 2, f * IN_MM, 'mm/min', 1) : two(f * IN_MM, 'mm/min', 1, f, 'in/min', 2);
  const prs = p => inMode() ? two(p, 'psi', 0, p * PSI_BAR, 'bar', 1) : two(p * PSI_BAR, 'bar', 1, p, 'psi', 0);
  const flw = g => inMode() ? two(g, 'gal/min', 1, g * GAL_L, 'l/min', 1) : two(g * GAL_L, 'l/min', 1, g, 'gal/min', 1);
  const getD = bindLen('gdd', 'd'), getL = bindLen('gdl', 'depth');
  function upd() {
    const G = grp(); m.g = G.id; m.h = +gh.value; m.a = +ga.value; m.c = gc.value; m.f = gf.value;
    const dmm = getD(), depth = getL(), out = q('gdres');
    if (!(dmm > 0)) { out.innerHTML = ''; return; }
    const din = dmm / IN_MM, row = G.rows[m.h], sfm0 = row[1 + K.speed.columns.indexOf(m.c)], adj = m.a >= 0 ? G.adjust[m.a] : null;
    const sfm = adj ? W.pct_adjust(sfm0, adj[1]) : sfm0, rpm = W.rpm_from_sfm(sfm, din), ST = rEsc(pubName(K.sources, K.speed.src));
    const rows = [['Cutting speed', calcCell(spd(sfm), ST + ': ' + rEsc(row[0]) + ' HRC' + (adj ? ', ' + rEsc(adj[0].toLowerCase()) + ' ' + (adj[1] > 0 ? '+' : '') + adj[1] + ' %' : '') + (m.c === 'mist' && G.mist_note ? ', ' + rEsc(G.mist_note) : ''))]];
    const bk = G.botek !== undefined ? K.botek : null;
    if (bk) { const v = bk.vc_m_min[G.botek]; rows.push(['botek, for comparison', calcCell(inMode() ? rng(v[0] / FT_M, v[1] / FT_M, 'SFM', 0, v[0], v[1], 'm/min', 0) : rng(v[0], v[1], 'm/min', 0, v[0] / FT_M, v[1] / FT_M, 'SFM', 0), 'guide range for: ' + rEsc(bk.groups[G.botek]))]); }
    rows.push(['Spindle speed', calcCell('<span class="mv">' + fx(rpm, 0) + ' rpm</span>', '12 x SFM / (pi x D)')]);
    const ratio = depth > 0 ? W.depth_ratio(depth, dmm) : NaN, f0 = tab(K.feed.rows, din, 1 + FCOL.indexOf(m.f));
    if (ratio > 0) rows.push(['Depth in diameters', calcCell('<span class="mv">' + fx(ratio, 1) + ' x D</span>', 'depth / diameter')]);
    if (f0 === null) rows.push(['Feed per revolution', '<td class="v" colspan="2">Outside ' + ST + '\'s table (0.125 to 1.000 in, 3.18 to 25.4 mm). Use the drill maker\'s data.</td>']);
    else {
      const f = ratio > 0 ? W.gundrill_feed_for_depth(f0, ratio, K.feed.long_ratio, K.feed.long_pct) : f0, cut = f !== f0;
      rows.push(['Feed per revolution', calcCell(fdr(f), ST + ', column "' + rEsc(K.feed.columns[m.f]) + '"' + (cut ? '; cut by ' + (-K.feed.long_pct) + ' % because the hole is over ' + K.feed.long_ratio + ' diameters deep' : ''))]);
      if (bk) {
        const br = bk.feed_mm_rev.find(r => dmm >= r[0] - 1e-9 && (r[1] === null || dmm < r[1] + 0.01 - 1e-9));
        if (br) { const rg = br[2 + G.botek]; rows.push(['botek, for comparison', calcCell(inMode() ? rng(rg[0] / IN_MM, rg[1] / IN_MM, 'in/rev', 5, rg[0], rg[1], 'mm/rev', 4) : rng(rg[0], rg[1], 'mm/rev', 4, rg[0] / IN_MM, rg[1] / IN_MM, 'in/rev', 5), 'guide range for ' + fx(br[0], 2) + (br[1] === null ? ' mm and over' : ' to ' + fx(br[1], 2) + ' mm'))]); }
        else rows.push(['botek, for comparison', '<td class="v" colspan="2">No row for this diameter (the table starts at 1.85 mm).</td>']);
      }
      rows.push(['Feed rate', calcCell(fdm(W.table_feed(rpm, f, 1)), 'feed x rpm')]);
      if (depth > 0) rows.push(['Time to drill the depth', calcCell('<span class="mv">' + fx(W.drill_time_min(depth / IN_MM, 0, f, rpm), 2) + ' min</span>', 'depth / feed rate')]);
    }
    const psi = tab(K.coolant.rows, din, 1), gpm = tab(K.coolant.rows, din, 2), gtw = tab(K.coolant.rows, din, 3), uh = tab(K.coolant.rows, din, 4), ul = tab(K.coolant.rows, din, 5);
    if (psi === null) rows.push(['Coolant pressure and flow', '<td class="v" colspan="2">Outside ' + ST + '\'s table (0.125 to 1.000 in, 3.18 to 25.4 mm).</td>']);
    else {
      rows.push(['Coolant pressure', calcCell(prs(psi), ST + ', gun drill machine with oil; one source')], ['Coolant flow, single flute', calcCell(flw(gpm), 'per spindle; one source')]);
      if (gtw !== null) rows.push(['Coolant flow, twin flute', calcCell(flw(gtw), 'per spindle; one source')]);
      rows.push(['Longest unsupported drill length', calcCell(lng(uh), 'at high SFM')], ['', calcCell(lng(ul), 'at low SFM')]);
    }
    const U = K.unisig_flow;
    const u0 = W.flow_per_dia(U.gpm_per_in[0], din), u1 = W.flow_per_dia(U.gpm_per_in[1], din), l0 = W.flow_per_dia(U.l_min_per_mm[0], dmm), l1 = W.flow_per_dia(U.l_min_per_mm[1], dmm);
    rows.push(['UNISIG starting flow, any deep hole tool', calcCell(inMode() ? rng(u0, u1, 'gal/min', 1, l0, l1, 'l/min', 1) : rng(l0, l1, 'l/min', 1, u0, u1, 'gal/min', 1), U.gpm_per_in.join(' to ') + ' gal/min per inch, ' + U.l_min_per_mm.join(' to ') + ' l/min per mm of diameter; it varies by tool type')]);
    out.innerHTML = '<div class="res"><table>' + rowsHtml(rows) + '</table>' +
      (G.verify ? '<p class="desc"><b>' + ST + ' marks this material:</b> ask the drill maker to verify the application before relying on these values.</p>' : '') +
      (G.feed_note ? '<p class="desc">' + rEsc(G.feed_note) + '</p>' : '') +
      (m.c === 'mist' ? '<p class="desc">Spray mist: the speed is from the spray mist column. ' + ST + ' gives the feed table for spray mist at 100 psi and more as well; the pressure and flow rows are for a gun drill machine with oil.</p>' : '') + '</div>';
  }
  gm.value = m.g; gc.value = m.c; fillGroup(true);
  gm.onchange = () => { fillGroup(false); upd(); };
  gh.onchange = upd; ga.onchange = upd; gc.onchange = upd; gf.onchange = upd;
  upd();
}

// ------------------------------------------------------------------ collet nut and pull stud torque
// Each maker's printed figures for its own holders, side by side and never merged. Lookups and unit conversion
// happen here; the one calculated number (the ceiling, a percentage above the recommended torque) is the core's.
async function renderHolderTorque(el) {
  const R = await loadRef(el); if (!R) return;
  const W = state.W, K = R.holdertorque; if (!K) { el.textContent = 'Holder torque data not built.'; return; }
  const m = RMEM.holdertorque || (RMEM.holdertorque = { size: 'ER 16', nut: 'std', row: -1 });
  const E = K.er, RG = rEsc(pubName(K.sources, E.src)), TK = rEsc(pubName(K.sources, K.techniks_nut.src));
  const num = v => String(+v.toFixed(1));
  // v in N·m: the user's unit first, the other beside it.
  const tq = nm => inMode() ? '<span class="mv">' + num(nm / NM_LBFT) + ' lbf·ft</span> <span class="ms">' + num(nm) + ' N·m</span>'
    : '<span class="mv">' + num(nm) + ' N·m</span> <span class="ms">' + num(nm / NM_LBFT) + ' lbf·ft</span>';
  const tqr = (lo, hi) => lo === hi ? tq(lo) : inMode() ? '<span class="mv">' + num(lo / NM_LBFT) + ' to ' + num(hi / NM_LBFT) + ' lbf·ft</span> <span class="ms">' + num(lo) + ' to ' + num(hi) + ' N·m</span>'
    : '<span class="mv">' + num(lo) + ' to ' + num(hi) + ' N·m</span> <span class="ms">' + num(lo / NM_LBFT) + ' to ' + num(hi / NM_LBFT) + ' lbf·ft</span>';
  const nm = v => v.unit === 'Nm' ? [v.lo, v.hi] : [v.lo * NM_LBFT, v.hi * NM_LBFT];
  const printed = v => (v.lo === v.hi ? v.lo : v.lo + ' to ' + v.hi) + (v.unit === 'Nm' ? ' Nm' : ' ft-lb') + (v.kind === 'max' ? ', maximum' : '');
  const bore = r => (r[2] === r[3] ? num(r[2]) : num(r[2]) + ' to ' + num(r[3])) + ' mm' + (r[1] ? ', micro-bore (MB) collet' : '');
  const boreIn = r => r[2] === r[3] ? fx(r[2] / IN_MM, 3) + ' in' : fx(r[2] / IN_MM, 3) + ' to ' + fx(r[3] / IN_MM, 3) + ' in';
  const col = nut => nut === 'mini' ? 5 : 4;
  const sel = (id, lab) => '<label class="f"><span>' + lab + '</span><div class="row"><select id="' + id + '"></select></div></label>';
  const pubs = Object.keys(K.sources).filter(k => K.pullstud.some(r => r.v.some(v => v.src === k)));
  const studCell = (r, k) => { const v = r.v.find(x => x.src === k); if (!v) return '<td class="ms">not printed</td>'; const [a, b] = nm(v); return '<td title="' + rEsc(v.as + ': ' + printed(v)) + '">' + tqr(a, b) + '<div class="ms">as printed: ' + rEsc(printed(v)) + '</div></td>'; };
  el.innerHTML = '<div class="grid" style="max-width:760px">' + sel('htz', 'Collet size') + sel('htn', 'Clamping nut') + sel('htb', 'Collet bore (the size marked on the collet)') + '</div><div id="htres"></div>' +
    '<div class="res mtab" style="max-width:none;margin-top:12px" id="htall"><div class="h">' + RG + ': ER collet nut torque, every row</div><div style="overflow-x:auto"><table id="htallt"></table></div></div>' +
    '<div class="res mtab" style="max-width:none;margin-top:12px" id="htstud"><div class="h">Pull stud (retention knob) torque, by maker</div><div style="overflow-x:auto"><table><tr><th>Taper</th>' + pubs.map(k => '<th>' + rEsc(pubName(K.sources, k)) + '</th>').join('') + '<th>Status</th></tr>' +
    K.pullstud.map(r => '<tr data-taper="' + rEsc(r.taper) + '"><td><b>' + rEsc(r.taper) + '</b></td>' + pubs.map(k => studCell(r, k)).join('') + '<td><span class="badge differs">' + (r.status === 'single' ? 'One source' : 'Sources differ') + '</span></td></tr>').join('') + '</table></div>' +
    '<p class="ms" style="padding:4px 10px">The makers do not agree, and not by a little: compare the figures in the 40 taper row. ' + RG + ' prints its figure as a maximum. Nothing here is averaged. Use the figure of the maker of your pull stud and holder, or the machine builder\'s figure for your spindle, and tighten with a torque wrench in a holder fixture.</p></div>' +
    '<div class="note"><b>Working:</b> the recommended torque is read from ' + RG + '\'s table by collet size, bore and nut; it is for ' + RG + '\'s nuts with standard ER and ER-UP collets. The ceiling is the recommended torque plus ' + E.ceiling_pct + ' %, the most ' + RG + ' allows. N·m and lbf·ft are converted (1 lbf·ft = 1.3558 N·m); the table is printed in N·m. ' +
    TK + ' prints one figure per collet size, with no bore ranges; it is shown beside the first and not mixed with it. A small bore takes much less torque than a large one in the same nut: a 3 mm collet in an ER 16 takes 20 N·m, a 10 mm collet 56 N·m. Another maker\'s nut, a coated or bearing nut, or a sealed collet can need a different torque: the maker\'s sheet for your nut comes first.</div>' +
    '<div class="note"><b>Good practice</b><ul class="gdrules">' + K.rules.map(r => '<li>' + rEsc(r.t) + ' <i>[' + r.src.map(k => rEsc(pubName(K.sources, k))).filter((x, n, a) => a.indexOf(x) === n).join(', ') + (r.status === 'single' ? ', one source' : '') + ']</i></li>').join('') + '</ul></div>' +
    '<div class="note"><b>Sources</b><br>' + sourceList(K.sources) + '<br><b>Not covered:</b> ' + K.gaps.map(rEsc).join(' ') + '</div>';
  const q = id => $('#' + id, el), hz = q('htz'), hn = q('htn'), hb = q('htb');
  hz.innerHTML = K.sizes.map(z => '<option>' + rEsc(z) + '</option>').join('');
  const rowsOf = () => E.rows.map((r, i) => [r, i]).filter(([r]) => r[0] === hz.value);
  function fillNut() {
    const have = E.nuts.filter(n => rowsOf().some(([r]) => r[col(n.id)] !== null));
    hn.innerHTML = have.map(n => '<option value="' + n.id + '">' + rEsc(n.name) + '</option>').join('');
    hn.value = have.some(n => n.id === m.nut) ? m.nut : have[0].id;
  }
  function fillBore() {
    const rows = rowsOf().filter(([r]) => r[col(hn.value)] !== null);
    hb.innerHTML = rows.map(([r, i]) => '<option value="' + i + '">' + rEsc(bore(r)) + (inMode() ? ' (' + boreIn(r) + ')' : '') + '</option>').join('');
    hb.value = String(rows.some(([, i]) => i === m.row) ? m.row : rows[rows.length - 1][1]);
  }
  function upd() {
    m.size = hz.value; m.nut = hn.value; m.row = +hb.value;
    const r = E.rows[m.row], v = r[col(m.nut)], nutName = E.nuts.find(n => n.id === m.nut).name;
    const rows = [['Recommended torque', calcCell(tq(v), RG + ': ' + rEsc(r[0]) + ', bore ' + rEsc(bore(r)) + ', ' + rEsc(nutName) + '; printed as ' + v + ' Nm')],
      ['Do not go over', calcCell(tq(W.pct_adjust(v, E.ceiling_pct)), 'recommended + ' + E.ceiling_pct + ' % (' + rEsc(pubName(K.sources, E.ceiling_src)) + ', 2009 edition)')]];
    const tk = K.techniks_nut.rows.filter(t => t[0] === r[0]);
    tk.forEach(t => rows.push([TK + ', for comparison', calcCell(tq(t[2] * NM_LBFT), rEsc(t[1]) + '; printed as ' + t[2] + ' ft/lbs, one figure for every bore')]));
    if (!tk.length) rows.push([TK + ', for comparison', '<td class="v" colspan="2">No figure for this size.</td>']);
    q('htres').innerHTML = '<div class="res"><table>' + rowsHtml(rows) + '</table></div>';
    q('htallt').innerHTML = '<tr><th>Collet</th><th>Bore</th>' + E.nuts.map(n => '<th>' + rEsc(n.name) + '</th>').join('') + '</tr>' +
      E.rows.map((x, i) => '<tr' + (i === m.row ? ' class="hit"' : '') + '><td><b>' + rEsc(x[0]) + '</b></td><td>' + rEsc(bore(x)) + '</td>' + E.nuts.map(n => '<td>' + (x[col(n.id)] === null ? '<span class="ms">not printed</span>' : tq(x[col(n.id)])) + '</td>').join('') + '</tr>').join('');
  }
  hz.value = K.sizes.includes(m.size) ? m.size : K.sizes[0];
  fillNut(); fillBore();
  hz.onchange = () => { m.row = -1; fillNut(); fillBore(); upd(); };
  hn.onchange = () => { m.nut = hn.value; m.row = -1; fillBore(); upd(); };
  hb.onchange = upd;
  upd();
}

// ------------------------------------------------------------------ thread gauge limits (Unified, X tolerance)
// Pitch diameter limits of GO and NOT GO thread plug and ring gauges. The product limits are the core's (the
// Thread data tool's), the gauge maker's X tolerance is looked up in the published table, and the member's
// smallest and largest size come from the core. The drawing shows where the gauge zones sit in the product zone.
async function renderThreadGauge(el) {
  const R = await loadRef(el); if (!R) return;
  const W = state.W, K = R.threadgauge; if (!K) { el.textContent = 'Thread gauge data not built.'; return; }
  const opts = threadOptions(R).filter(o => o.sys === 'unified');
  const m = RMEM.threadgauge || (RMEM.threadgauge = { key: '1/4-20 UNC', cls: 2 });
  if (!opts.some(o => o.key === m.key)) m.key = opts[0].key;
  const pubs = ks => ks.map(k => rEsc(pubName(K.sources, k))).filter((x, n, a) => a.indexOf(x) === n).join(', ');
  el.innerHTML = '<div class="grid" style="max-width:760px"><label class="f"><span>Thread (Unified inch)</span><div class="row"><select id="tgk">' + opts.map(o => '<option value="' + rEsc(o.key) + '"' + (o.key === m.key ? ' selected' : '') + '>' + rEsc(o.label) + '</option>').join('') + '</select></div></label>' +
    '<label class="f"><span>Class</span><div class="row"><select id="tgc"><option value="2">2A external, 2B internal</option><option value="3">3A external, 3B internal</option></select></div></label></div>' +
    '<div id="tgplot"></div><div id="tgres"></div>' +
    '<div class="note"><b>Working:</b> each gauge member is made to one limit of the thread it checks, with the gauge maker\'s tolerance all on one side. Thread plug (checks the internal thread): GO is made to the smallest pitch diameter with the tolerance plus, NOT GO (HI) to the largest with the tolerance minus. ' +
    'Thread ring (checks the external thread): GO is made to the largest pitch diameter with the tolerance minus, NOT GO (LO) to the smallest with the tolerance plus. A new gauge therefore never passes a thread outside its limits, and may reject one that is inside them by less than the gauge tolerance. ' +
    'The thread\'s limits are the ones the Thread data tool works out from the ASME B1.1 formulas. The X tolerance on pitch diameter is read from the gauge makers\' table by threads per inch and diameter. The GO member must go; the NOT GO member must not. A GO gauge checks pitch diameter, lead and flank angle together over its whole length; a NOT GO gauge checks the pitch diameter only. ' +
    'Gauges wear: have them calibrated, and a worn GO plug passes threads that are too small (the last sentence is BenchMate\'s own advice).</div>' +
    '<div class="note"><b>Sources</b><br>' + sourceList(K.sources) + '<br><b>Not covered:</b> ' + K.gaps.map(rEsc).join(' ') + '</div>';
  const q = id => $('#' + id, el), tk = q('tgk'), tc = q('tgc');
  tc.value = String(m.cls);
  const two = v => inMode() ? '<span class="mv">' + fx(v, 4) + ' in</span> <span class="ms">' + fx(v * IN_MM, 4) + ' mm</span>' : '<span class="mv">' + fx(v * IN_MM, 4) + ' mm</span> <span class="ms">' + fx(v, 4) + ' in</span>';
  function upd() {
    m.key = tk.value; m.cls = +tc.value;
    const o = opts.find(x => x.key === m.key), din = o.din, tpi = o.tpi, pin = 1 / tpi, ce = m.cls, ci = m.cls + 10, out = q('tgres'), plot = q('tgplot');
    const row = K.x.find(r => r.tpi === tpi), ri = K.ranges.findIndex(g => din > g[0] && din <= g[1]), cell = row && ri >= 0 ? row.cells[ri] : null;
    if (!cell) { plot.innerHTML = ''; out.innerHTML = '<div class="res"><table><tr><td>The gauge makers\' table has no X tolerance for ' + tpi + ' threads per inch at this diameter. Ask the gauge maker.</td></tr></table></div>'; return; }
    const x = cell.v, lim = { plug: { min: W.un_limit(din, pin, ci, 3), max: W.un_limit(din, pin, ci, 2) }, ring: { min: W.un_limit(din, pin, ce, 3), max: W.un_limit(din, pin, ce, 2) } };
    const ch = K.chart.rows.find(r => Math.abs(r[1] - din) < 1e-6 && r[2] === tpi);
    const chartOf = (gauge, member) => !ch ? null : gauge === 'plug' ? (member === 'go' ? ch[3] : ch[m.cls === 2 ? 4 : 5]) : ch[(m.cls === 2 ? 6 : 8) + (member === 'go' ? 0 : 1)];
    const NAME = { plug: { go: 'GO plug', nogo: 'NOT GO (HI) plug' }, ring: { go: 'GO ring', nogo: 'NOT GO (LO) ring' } };
    const mem = {};
    const line = d => {
      const size = lim[d.gauge][d.limit], lo = W.gauge_member_limit(size, x, d.plus ? 1 : 0, 0), hi = W.gauge_member_limit(size, x, d.plus ? 1 : 0, 1), pc = chartOf(d.gauge, d.member);
      mem[d.gauge + d.member] = [lo, hi];
      const cmp = pc === null ? '<span class="ms">size not in the chart</span>' : Math.abs(pc - size) < 5e-5 ? '<span class="badge confirmed">Chart agrees</span> <span class="ms">' + fx(pc, 4) + ' in</span>'
        : '<span class="badge differs">Chart differs</span> <span class="ms">the chart prints ' + fx(pc, 4) + ' in; the limit worked out here is ' + fx(size, 4) + ' in</span>';
      return '<tr data-m="' + d.gauge + '-' + d.member + '"><td><b>' + NAME[d.gauge][d.member] + '</b><div class="ms">made to the ' + (d.limit === 'min' ? 'smallest' : 'largest') + ' pitch diameter, tolerance ' + (d.plus ? 'plus' : 'minus') + '</div></td><td>' + two(size) + '</td><td>' + two(lo) + '</td><td>' + two(hi) + '</td><td>' + cmp + '</td></tr>';
    };
    const tab = (gauge, title) => '<div class="res mtab" style="max-width:none;margin-top:12px" id="tg' + gauge + '"><div class="h">' + title + '</div><div style="overflow-x:auto"><table><tr><th>Member</th><th>Thread limit</th><th>Gauge pitch diameter, smallest</th><th>largest</th><th>Published chart</th></tr>' +
      K.direction.filter(d => d.gauge === gauge).map(line).join('') + '</table></div></div>';
    const chartSrc = ch ? '<p class="ms" style="padding:4px 10px">Published chart: ' + pubs(K.chart.plug_src) + ' for the plug, ' + pubs(K.chart.ring_src) + ' for the ring. It prints the size each member is made to, before the gauge tolerance. Where it differs from the limit worked out here (by 0.0001 in, a rounding step), both are shown and the gauge sizes use the limit worked out here.</p>' : '';
    const html = '<div class="res" style="margin-top:12px" id="tgx"><table>' + rowsHtml([['X tolerance on pitch diameter', calcCell(two(x), tpi + ' threads per inch, ' + rEsc(K.ranges[ri][2]) + '; ' + cell.pubs.map(rEsc).join(', ') + (cell.status === 'confirmed' ? '' : ' (one source)'))]]) + '</table></div>' +
      tab('plug', 'Thread plug gauge for ' + rEsc(o.label) + '-' + m.cls + 'B (internal thread)') + tab('ring', 'Thread ring gauge for ' + rEsc(o.label) + '-' + m.cls + 'A (external thread)') + chartSrc;
    out.innerHTML = html;
    // Drawing: the product's pitch diameter zone with the two gauge zones at its ends (to scale along the axis).
    const Wd = 600, L = 150, Rr = 30, bh = 22, T = 30, gap = 46, Hd = T + 2 * bh + gap + 30;
    const band = (i, title, pr, go, nogo) => {
      const pad = (pr.max - pr.min) * 0.12, X = v => L + (v - (pr.min - pad)) / (pr.max - pr.min + 2 * pad) * (Wd - L - Rr), y = T + i * (bh + gap);
      const z = (a, b, cls) => '<rect class="' + cls + '" x="' + X(a).toFixed(1) + '" y="' + y + '" width="' + Math.max(1.5, X(b) - X(a)).toFixed(1) + '" height="' + bh + '"/>';
      return '<text class="tl" x="' + (L - 8) + '" y="' + (y + 15) + '" text-anchor="end">' + title + '</text>' + z(pr.min, pr.max, 'bar') + z(go[0], go[1], 'tgz') + z(nogo[0], nogo[1], 'tgn') +
        '<text class="tl" x="' + X((go[0] + go[1]) / 2).toFixed(1) + '" y="' + (y - 5) + '" text-anchor="middle">GO</text><text class="tl" x="' + X((nogo[0] + nogo[1]) / 2).toFixed(1) + '" y="' + (y - 5) + '" text-anchor="middle">NOT GO</text>' +
        '<text class="tl" x="' + X(pr.min).toFixed(1) + '" y="' + (y + bh + 13) + '" text-anchor="middle">' + fx(inMode() ? pr.min : pr.min * IN_MM, 4) + '</text><text class="tl" x="' + X(pr.max).toFixed(1) + '" y="' + (y + bh + 13) + '" text-anchor="middle">' + fx(inMode() ? pr.max : pr.max * IN_MM, 4) + '</text>';
    };
    plot.innerHTML = '<svg class="capplot" viewBox="0 0 ' + Wd + ' ' + Hd + '" role="img" aria-label="Where the gauge tolerance zones sit in the pitch diameter tolerance of the thread"><text class="tl" x="' + L + '" y="12">pitch diameter, ' + (inMode() ? 'in' : 'mm') + '. Pale: the thread; solid: the gauge members</text>' +
      band(0, 'internal, ' + m.cls + 'B: plug', lim.plug, mem.pluggo, mem.plugnogo) + band(1, 'external, ' + m.cls + 'A: ring', lim.ring, mem.ringgo, mem.ringnogo) + '</svg>';
  }
  tk.onchange = upd; tc.onchange = upd;
  upd();
}

