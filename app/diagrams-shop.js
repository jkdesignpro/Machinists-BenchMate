'use strict';
// Reference drawings for shop tools that draw their own screens (fits, surface,
// hardness, fasteners, machine elements, setup and materials). See dk.js. Each
// drawing is a static key to the names and symbols the tool's tables use; it
// shows no live values, and every word or rule on it is one the tool states.
// Proportions are schematic (deviations, waves and gaps are exaggerated).
(() => {
  const rad = d => d * Math.PI / 180;
  const f = v => (Math.round(v * 100) / 100).toString();
  // Text shorthand: left-aligned unless told otherwise.
  const T = (x, y, s, cls, anchor, size) => DK.text(x, y, s, { cls: cls || 'txt', anchor: anchor || 'start', size });
  // Muted note text, wrapped to the drawing's width; returns the markup.
  const notes = (text, x, y, max) => {
    const out = []; let line = '';
    for (const w of String(text).split(' ')) { if ((line + ' ' + w).trim().length > (max || 90)) { out.push(line); line = w; } else line = (line + ' ' + w).trim(); }
    if (line) out.push(line);
    return out.map((t, i) => DK.text(x, y + i * 14, t, { cls: 'mut', anchor: 'start' })).join('');
  };
  // Lines of text in a column, 14 px apart: [[text, cls], ...].
  const col = (x, y, rows) => rows.map(([t, c], i) => T(x, y + i * 14, t, c || 'mut')).join('');
  // Regular hexagon, centre (cx, cy), circumradius r, first corner at angle a0 (degrees).
  const hexPts = (cx, cy, r, a0) => Array.from({ length: 6 }, (_, i) => [cx + r * Math.cos(rad(a0 + 60 * i)), cy - r * Math.sin(rad(a0 + 60 * i))]);
  // Closed path through points (no class): for building compound outlines.
  const pd = pts => 'M' + pts.map(p => f(p[0]) + ' ' + f(p[1])).join('L') + 'Z';
  const ring = (cx, cy, R, r, cls) => '<path class="' + (cls || 'hatch') + '" fill-rule="evenodd" d="M' + f(cx - R) + ' ' + f(cy) + 'a' + f(R) + ' ' + f(R) + ' 0 1 0 ' + f(2 * R) + ' 0a' + f(R) + ' ' + f(R) + ' 0 1 0 ' + f(-2 * R) + ' 0Z' +
    'M' + f(cx - r) + ' ' + f(cy) + 'a' + f(r) + ' ' + f(r) + ' 0 1 0 ' + f(2 * r) + ' 0a' + f(r) + ' ' + f(r) + ' 0 1 0 ' + f(-2 * r) + ' 0Z"/>';
  const cross = (cx, cy, r) => DK.cl(cx - r, cy, cx + r, cy) + DK.cl(cx, cy - r, cx, cy + r);

  Object.assign(DIAGRAMS, {
    // ISO 286: hole and shaft tolerance zones against the zero line.
    fits() {
      const W = 520, H = 250, y0 = 124, hx = 96, sx = 200, bw = 70;
      const ES = 60, EI = 104, es = 140, ei = 188;
      let s = DK.line(14, y0, 330, y0, 'ln') + T(336, y0 + 4, 'zero line', 'mut') + T(336, y0 + 18, '(basic size)', 'mut');
      s += DK.rect(hx, ES, bw, EI - ES, 'hatch') + T(hx + bw / 2, ES - 8, 'hole', 'txt', 'middle');
      s += DK.rect(sx, es, bw, ei - es, 'part') + T(sx + bw / 2, ei + 16, 'shaft', 'txt', 'middle');
      // Hole deviations at the left, shaft deviations at the right.
      s += DK.dimV(y0, ES, 56, 'ES', { from: hx }) + DK.dimV(y0, EI, 78, 'EI', { from: hx });
      s += DK.dimV(es, y0, 290, 'es', { from: sx + bw }) + DK.dimV(ei, y0, 312, 'ei', { from: sx + bw });
      // Clearances between the zones.
      s += DK.line(hx + bw + 3, EI, sx + 20, EI, 'dim ext') + DK.dim(183, es, 183, EI, 'min', { hot: true });
      s += DK.line(hx - 3, ES, 16, ES, 'hot ext') + DK.line(sx - 3, ei, 16, ei, 'hot ext') + DK.dim(24, ei, 24, ES, 'max clearance', { hot: true });
      s += col(352, 40, [['upper / lower deviation', 'txt'], ['ES, EI of the hole', 'mut'], ['es, ei of the shaft', 'mut']]);
      s += col(352, 168, [['max clearance = ES − ei', 'txt'], ['min clearance = EI − es', 'txt'], ['negative = interference', 'mut']]);
      s += notes('Drawn as a clearance fit. Each zone is one IT grade tall; its letter (fundamental deviation) places it against the zero line.', 18, 222, 92);
      return DK.svg(W, H, s, 'ISO fit: hole and shaft tolerance zones, deviations ES, EI, es, ei and the clearances');
    },

    // ANSI B4.1: the three kinds of fit as hole and shaft zones, hole basis.
    ansifits() {
      const W = 520, H = 250, y0 = 132;
      const kinds = [['Clearance fit', 'RC, LC', [144, 180]], ['Transition fit', 'LT', [112, 150]], ['Interference fit', 'LN, FN', [54, 86]]];
      let s = '';
      kinds.forEach(([name, fam, [sy0, sy1]], i) => {
        const x0 = 18 + i * 168, hx = x0 + 22, sx = x0 + 84, bw = 40, hTop = 94;
        s += T(x0 + 72, 26, name, 'txt', 'middle') + DK.line(x0, y0, x0 + 148, y0, 'ln');
        s += DK.rect(hx, hTop, bw, y0 - hTop, 'hatch') + T(hx + bw / 2, hTop - 6, 'hole', 'mut', 'middle');
        s += DK.rect(sx, sy0, bw, sy1 - sy0, 'part') + T(sx + bw / 2, sy1 + 14, 'shaft', 'mut', 'middle');
        s += T(x0 + 72, 214, fam, 'dimt', 'middle');
      });
      s += T(18, y0 + 14, 'basic size', 'mut');
      s += notes('Hole basis: the hole\'s lower limit is the basic size. The tables give deviations from it in thousandths of an inch.', 18, 238, 92);
      return DK.svg(W, H + 6, s, 'ANSI fits: clearance, transition and interference as hole and shaft zones');
    },

    // Shrink fit: the bore is smaller than the shaft cold; heated, it clears the shaft.
    shrinkfit() {
      const W = 520, H = 250, cy = 112, ls = 108, rs = 290, Rh = 68, rb = 38, rsh = 46, rbh = 54;
      let s = T(ls, 22, 'room temperature', 'txt', 'middle') + T(rs, 22, 'hub heated', 'hott', 'middle');
      // Cold: hub ring and the shaft (dashed) that is larger than the bore.
      s += ring(ls, cy, Rh, rb) + DK.circle(ls, cy, rsh, 'ghost') + cross(ls, cy, Rh + 10);
      const a = rad(-50), pi = [ls + (rb + rsh) / 2 * Math.cos(a), cy - (rb + rsh) / 2 * Math.sin(a)];
      s += DK.leader(pi[0], pi[1], ls + 46, 206, 'interference', { hot: true, anchor: 'start' });
      s += T(ls + 50, 222, 'shaft Ø − bore Ø', 'mut');
      // Heated: the hub has grown, the bore clears the shaft.
      s += ring(rs, cy, Rh + 4, rbh) + DK.circle(rs, cy, rsh, 'part') + cross(rs, cy, Rh + 14);
      [150, 210, 270].forEach(d => { const c = Math.cos(rad(d)), n = -Math.sin(rad(d)); s += DK.arrow(rs + (Rh + 8) * c, cy + (Rh + 8) * n, rs + (Rh + 24) * c, cy + (Rh + 24) * n, 'hot'); });
      const b = rad(-50), pc = [rs + (rsh + rbh) / 2 * Math.cos(b), cy - (rsh + rbh) / 2 * Math.sin(b)];
      s += DK.leader(pc[0], pc[1], rs + 44, 214, 'assembly clearance', { anchor: 'start' });
      const pb = [rs + rbh * Math.cos(rad(50)), cy - rbh * Math.sin(rad(50))];
      s += DK.leader(pb[0], pb[1], 352, 42, 'heated bore', { hot: true, anchor: 'start' });
      s += col(388, 96, [['hub growth needed', 'txt'], ['= interference', 'mut'], ['+ assembly clearance', 'mut']]);
      s += col(388, 154, [['or cool the shaft,', 'mut'], ['or both', 'mut']]);
      return DK.svg(W, H, s, 'Shrink fit: interference when cold, assembly clearance with the hub heated');
    },

    // ISO 2768-1: the kinds of untoleranced feature a general tolerance covers.
    gentol() {
      const W = 520, H = 250, R = 14;
      // Stepped part: left block with an angled face and a rounded corner, lower step with a chamfer.
      const P = [[40, 196], [300, 196], [300, 116], [286, 102], [200, 102], [200, 60 + R]];
      let d = 'M' + P.map(p => f(p[0]) + ' ' + f(p[1])).join('L') + 'A' + R + ' ' + R + ' 0 0 0 ' + f(200 - R) + ' 60L96 60L40 126Z';
      let s = DK.path(d, 'part');
      s += DK.dimH(40, 300, 220, 'linear size', { from: 196, below: true });
      s += DK.dimV(196, 102, 326, 'linear', { from: 300 });
      s += DK.dimH(200, 300, 84, 'linear', { from: 102 });
      s += DK.leader(200 - R * (1 - Math.cos(rad(45))), 60 + R * (1 - Math.sin(rad(45))), 232, 34, 'outside radius', { hot: true, anchor: 'start' });
      s += DK.leader(293, 109, 334, 60, 'chamfer', { hot: true, anchor: 'start' });
      // Angle between the angled face and the side, and its shorter side.
      const ang = Math.atan2(126 - 60, 96 - 40) * 180 / Math.PI;
      s += DK.angle(40, 126, 34, 90, ang, '', { hot: true }) + T(22, 80, 'angle', 'hott');
      s += DK.line(40, 126, 40, 86, 'thin');
      s += DK.dimV(196, 126, 18, 'shorter side', {});
      s += col(372, 132, [['general tolerance by:', 'txt'], ['linear: the size', 'mut'], ['radius, chamfer: the size', 'mut'], ['angle: the shorter side', 'mut']]);
      s += notes('Applies only to sizes with no tolerance of their own, on a drawing that names ISO 2768-f, m, c or v.', 18, 250, 92);
      return DK.svg(W, H + 16, s, 'General tolerances: linear sizes, outside radius, chamfer and angle on a stepped part');
    },

    // Surface texture: magnified profile, mean line, Ra and Rz.
    surface() {
      const W = 520, H = 250, x0 = 40, n = 5, Ls = 60, y0 = 120, A = 30;
      const xs = [], ys = [];
      for (let x = x0; x <= x0 + n * Ls; x += 1.5) {
        const u = x - x0;
        let y = 0.55 * Math.sin(u / 5.3) + 0.32 * Math.sin(u / 2.3 + 1.1) + 0.22 * Math.sin(u / 11 + 2.4) + 0.12 * Math.sin(u / 1.35 + 0.3);
        if (Math.abs(u - 158) < 5) y += 1.05 * (1 - Math.abs(u - 158) / 5); // one deep scratch
        xs.push(x); ys.push(y);
      }
      const m = ys.reduce((a, b) => a + b, 0) / ys.length, Y = ys.map(y => y0 + (y - m) * A);
      const ra = Y.reduce((a, y) => a + Math.abs(y - y0), 0) / Y.length;
      let s = DK.path('M' + xs.map((x, i) => f(x) + ' ' + f(Y[i])).join('L') + 'L' + f(xs[xs.length - 1]) + ' 206L' + f(x0) + ' 206Z', 'hatch');
      s += DK.cl(x0 - 10, y0, x0 + n * Ls + 10, y0) + T(x0 + n * Ls + 22, y0 + 18, 'mean line', 'mut');
      s += DK.line(x0, y0 - ra, x0 + n * Ls, y0 - ra, 'hot ext') + DK.line(x0, y0 + ra, x0 + n * Ls, y0 + ra, 'hot ext');
      s += DK.dim(26, y0, 26, y0 - ra, 'Ra', { hot: true });
      for (let k = 0; k <= n; k++) s += DK.line(x0 + k * Ls, 46, x0 + k * Ls, 58, 'thin');
      s += DK.dimH(x0, x0 + Ls, 52, 'sampling length');
      // Peak to valley in the third sampling length (it holds the scratch).
      const k = 2, idx = xs.map((x, i) => i).filter(i => xs[i] >= x0 + k * Ls && xs[i] <= x0 + (k + 1) * Ls);
      const yt = Math.min(...idx.map(i => Y[i])), yb = Math.max(...idx.map(i => Y[i])), xr = x0 + (k + 1) * Ls;
      const xe = x0 + n * Ls + 14;
      s += DK.line(x0 + k * Ls, yt, xe + 6, yt, 'dim ext') + DK.line(x0 + k * Ls, yb, xe + 6, yb, 'dim ext') + DK.dim(xe, yb, xe, yt, '');
      s += T(xe + 8, yt + 6, 'peak to valley', 'dimt') + T(xe + 8, yt + 20, 'in one sampling length', 'mut');
      s += col(392, 164, [['Ra: average distance', 'txt'], ['from the mean line', 'mut'], ['Rz: average of the five', 'txt'], ['peak-to-valley heights', 'mut']]);
      s += notes('Profile magnified. One scratch barely moves Ra but sets Rz, so the two do not convert. An N grade is an upper limit of Ra.', 18, 232, 92);
      return DK.svg(W, H + 4, s, 'Surface profile: mean line, Ra band and Rz peak to valley over sampling lengths');
    },

    // Hardness tests: what each indenter leaves and what is measured.
    hardness() {
      const W = 520, H = 250, ys = 104;
      const block = cx => DK.rect(cx - 72, ys, 144, 30, 'hatch');
      let s = '';
      // Vickers: pyramid; the square impression's two diagonals.
      let c = 88;
      s += T(c, 22, 'Vickers HV', 'txt', 'middle') + block(c);
      // Square-based diamond pyramid, 136° between opposite faces, set in its holder; pressed in to depth 8.
      const tipY = ys + 8, half = 30, topY = tipY - half / Math.tan(rad(68));
      s += DK.poly([[c - half, topY], [c - 18, topY - 22], [c - 18, topY - 44], [c + 18, topY - 44], [c + 18, topY - 22], [c + half, topY]], 'part');
      s += DK.poly([[c, tipY], [c - half, topY], [c + half, topY]], 'tool') + DK.cl(c, topY - 52, c, ys + 22);
      s += DK.angle(c, tipY, 20, 22, 158, '', {}) + T(c + half + 6, topY - 2, '136°', 'dimt', 'start') + T(c, topY - 54, 'diamond pyramid', 'mut', 'middle');
      const q = 18, cy1 = 178;
      s += DK.poly([[c, cy1 - q], [c + q, cy1], [c, cy1 + q], [c - q, cy1]], 'part') + DK.line(c - q, cy1, c + q, cy1, 'thin') + DK.line(c, cy1 - q, c, cy1 + q, 'thin');
      s += DK.dimH(c - q, c + q, cy1 + q + 10, 'd1', { from: cy1, below: true }) + DK.dimV(cy1 + q, cy1 - q, c + q + 14, 'd2', { from: c });
      s += T(c, 152, 'impression, from above', 'mut', 'middle');
      // Brinell: ball; the round impression's diameter.
      c = 260; const rb = 24, dip = 9;
      s += T(c, 22, 'Brinell HB', 'txt', 'middle') + block(c);
      s += DK.circle(c, ys + dip - rb, rb, 'tool') + T(c, ys - rb - 18, 'ball', 'mut', 'middle');
      const hw = Math.sqrt(rb * rb - (rb - dip) * (rb - dip));
      s += DK.circle(c, cy1, hw, 'part') + DK.dimH(c - hw, c + hw, cy1 + hw + 12, 'd', { from: cy1, below: true });
      s += T(c, 152, 'impression, from above', 'mut', 'middle');
      // Rockwell C: cone; depth of penetration.
      c = 432; const dep = 16, hc = dep * Math.tan(rad(60));
      s += T(c, 22, 'Rockwell C (HRC)', 'txt', 'middle') + block(c);
      s += DK.poly([[c, ys + dep], [c - hc, ys], [c - hc, ys - 30], [c + hc, ys - 30], [c + hc, ys]], 'tool') + T(c, ys - 40, 'diamond cone', 'mut', 'middle');
      s += DK.line(c + hc + 2, ys, c + 64, ys, 'dim ext') + DK.line(c + 3, ys + dep, c + 64, ys + dep, 'dim ext') + DK.dim(c + 58, ys + dep, c + 58, ys, 'h');
      s += T(c, 172, 'depth h of the', 'mut', 'middle') + T(c, 186, 'indentation', 'mut', 'middle');
      s += T(88, 244, 'diagonals d1, d2', 'hott', 'middle') + T(260, 244, 'diameter d', 'hott', 'middle') + T(432, 244, 'depth h', 'hott', 'middle');
      return DK.svg(W, H + 4, s, 'Hardness tests: Vickers diagonals, Brinell diameter and Rockwell depth');
    },

    // Compound angle: the two apparent angles in front and side view, and the slope direction in plan.
    compound() {
      const W = 520, H = 250, A = 28, B = 18, base = 172;
      let s = '';
      // Front view (XZ): slope at the apparent angle A.
      const fx0 = 24, fx1 = 164, fh0 = 120;
      const fy1 = base - fh0 + (fx1 - fx0) * Math.tan(rad(A));
      s += DK.poly([[fx0, base], [fx1, base], [fx1, fy1], [fx0, base - fh0]], 'part');
      s += DK.line(fx1 - 66, fy1, fx1 + 8, fy1, 'thin') + DK.angle(fx1, fy1, 56, 180, 180 - A, '', { hot: true });
      s += T(94, 30, 'front view (XZ)', 'txt', 'middle') + T(fx1 + 4, base + 14, 'X', 'mut', 'end');
      // Side view (YZ): slope at the apparent angle B.
      const sx0 = 196, sx1 = 326, sh0 = 120;
      const sy1 = base - sh0 + (sx1 - sx0) * Math.tan(rad(B));
      s += DK.poly([[sx0, base], [sx1, base], [sx1, sy1], [sx0, base - sh0]], 'part');
      s += DK.line(sx1 - 66, sy1, sx1 + 8, sy1, 'thin') + DK.angle(sx1, sy1, 56, 180, 180 - B, '', { hot: true });
      s += T(261, 30, 'side view (YZ)', 'txt', 'middle') + T(sx1 + 4, base + 14, 'Y', 'mut', 'end');
      s += T(94, 196, 'apparent angle', 'hott', 'middle') + T(261, 196, 'apparent angle', 'hott', 'middle');
      // Plan (XY): the direction of the steepest slope.
      const px = 366, py = 160, pw = 130, ph = 110, dir = Math.atan2(Math.tan(rad(B)), Math.tan(rad(A)));
      s += DK.rect(px, py - ph, pw, ph, 'part') + T(px + pw / 2, 30, 'plan (XY)', 'txt', 'middle');
      s += DK.arrow(px + 14, py - 14, px + pw + 14, py - 14, 'thin') + T(px + pw + 14, py - 2, 'X', 'mut', 'end');
      s += DK.arrow(px + 14, py - 14, px + 14, py - ph - 4, 'thin') + T(px + 22, py - ph + 6, 'Y', 'mut');
      const L = 92, ex = px + 14 + L * Math.cos(dir), ey = py - 14 - L * Math.sin(dir);
      s += DK.arrow(px + 14, py - 14, ex, ey, 'hot') + DK.angle(px + 14, py - 14, 50, 0, dir * 180 / Math.PI, '', {});
      s += T(px + pw / 2, 182, 'slope direction', 'hott', 'middle') + T(px + pw / 2, 196, 'from X towards Y', 'mut', 'middle');
      s += notes('The true angle is the steepest slope of the face against the base, measured along the slope direction. A drawing gives the two apparent angles; the tool converts between them.', 18, 222, 92);
      return DK.svg(W, H + 4, s, 'Compound angle: apparent angles in the front and side views and the slope direction in plan');
    },

    // Tolerance stack: a chain of dimensions across a housing and the parts in it.
    gdtstack() {
      const W = 520, H = 250, top = 70, fl = 160, bot = 182;
      let s = DK.path('M30 ' + top + 'L50 ' + top + 'L50 ' + fl + 'L310 ' + fl + 'L310 ' + top + 'L330 ' + top + 'L330 ' + bot + 'L30 ' + bot + 'Z', 'hatch');
      s += DK.rect(50, 100, 124, fl - 100, 'part') + DK.rect(174, 110, 108, fl - 110, 'part');
      s += T(112, 136, 'part', 'mut', 'middle') + T(228, 140, 'part', 'mut', 'middle') + T(180, 200, 'housing', 'mut', 'middle');
      s += DK.dimH(50, 310, 36, '1  (+)', { from: top });
      s += DK.dimH(50, 174, 82, '2  (−)', { from: 100 }) + DK.dimH(174, 282, 82, '3  (−)', { from: 110 });
      s += DK.line(282, 108, 282, 76, 'hot ext') + DK.dim(282, 82, 310, 82, '', { hot: true }) + DK.leader(296, 120, 346, 136, 'gap', { hot: true, anchor: 'start' });
      s += col(352, 40, [['gap = 1 − 2 − 3', 'txt'], ['(+ adds to the gap,', 'mut'], ['− subtracts)', 'mut']]);
      s += col(352, 166, [['worst case: ± sum of', 'txt'], ['the half tolerances', 'mut'], ['RSS: ± root of the sum of', 'txt'], ['squared half tolerances', 'mut']]);
      s += notes('RSS assumes independent, normally distributed dimensions centred in their tolerance; otherwise use worst case.', 18, 232, 92);
      return DK.svg(W, H, s, 'Tolerance stack: dimensions 1, 2 and 3 in a chain leaving a gap');
    },

    // Stock weight: the sections the tool knows, and the length.
    weight() {
      const W = 520, H = 250, cy = 86, r = 28;
      let s = '';
      // Round.
      let c = 56;
      s += DK.circle(c, cy, r, 'part') + cross(c, cy, r + 8) + DK.dimH(c - r, c + r, 36, 'd', { from: cy }) + T(c, 136, 'round', 'txt', 'middle');
      // Hex: flats vertical, s across them.
      c = 156; const hr = r / Math.cos(rad(30)) * 1.0, hp = hexPts(c, cy, hr, 90);
      s += DK.poly(hp, 'part') + DK.dimH(c - r, c + r, 36, 's', { from: cy - hr / 2 }) + T(c, 136, 'hex', 'txt', 'middle');
      // Square.
      c = 256; s += DK.rect(c - r, cy - r, 2 * r, 2 * r, 'part') + DK.dimH(c - r, c + r, 36, 's', { from: cy - r }) + T(c, 136, 'square', 'txt', 'middle');
      // Tube.
      c = 356; const ti = r - 8;
      s += ring(c, cy, r, ti, 'part') + DK.dimH(c - r, c + r, 36, 'D', { from: cy });
      s += DK.dim(c + ti, cy, c + r, cy, 't', {}) + T(c, 136, 'tube', 'txt', 'middle');
      // Flat.
      c = 462; const fw = 76, ft = 26;
      s += DK.rect(c - fw / 2, cy - ft / 2, fw, ft, 'part') + DK.dimH(c - fw / 2, c + fw / 2, 50, 'width', { from: cy - ft / 2 });
      s += DK.dim(c - fw / 2 + 10, cy + ft / 2, c - fw / 2 + 10, cy - ft / 2, '', {}) + T(c - fw / 2 + 16, cy + ft / 2 + 18, 'thickness', 'dimt');
      s += T(c, 136, 'flat', 'txt', 'middle');
      // Length, on a bar seen from the side.
      s += DK.rect(56, 162, 400, 18, 'part') + DK.dimH(56, 456, 204, 'length', { from: 180, below: true });
      s += T(260, 156, 'weight = section area × length × density', 'txt', 'middle');
      s += notes('Sharp corners assumed.', 18, 242);
      return DK.svg(W, H, s, 'Stock sections: round d, hex and square s, tube D and t, flat width and thickness, and the length');
    },

    // Temperature compensation: part and gauge both grow from their size at 20 degrees.
    tempcomp(v, sys) {
      const W = 520, H = 250, x0 = 40, L20 = 236, gp = 30, gg = 12, ref = sys === 'inch' ? '68 °F' : '20 °C';
      let s = T(x0, 42, 'part (at the part temperature)', 'txt');
      s += DK.rect(x0, 52, L20 + gp, 34, 'part') + DK.rect(x0, 52, L20, 34, 'ghost');
      s += DK.dim(x0 + L20, 52, x0 + L20 + gp, 52, '', { hot: true, off: 10 }) + T(x0 + L20 + gp + 16, 46, 'part expansion', 'hott');
      // Gauge: a scale whose graduations grow with its own temperature.
      const gy = 140, n = 10, step = (L20 + gg) / n;
      s += T(x0, gy - 10, 'gauge or machine scale (at its temperature)', 'txt');
      s += DK.rect(x0, gy, L20 + gg, 22, 'part') + DK.rect(x0, gy, L20, 22, 'ghost');
      for (let i = 1; i < n; i++) s += DK.line(x0 + i * step, gy, x0 + i * step, gy + (i % 5 ? 8 : 13), 'ln');
      s += DK.dim(x0 + L20, gy + 22, x0 + L20 + gg, gy + 22, '', { hot: true, off: -10 }) + T(x0 + L20 + gg + 22, gy + 44, 'gauge expansion', 'hott');
      // Reading: the warm part against the warm scale.
      s += DK.line(x0, 92, x0, gy - 4, 'thin') + DK.line(x0 + L20 + gp, 92, x0 + L20 + gp, gy + 26, 'thin') + DK.circle(x0 + L20 + gp, gy, 3, 'hotf');
      s += DK.leader(x0 + L20 + gp + 2, gy + 4, 380, 112, 'reading', { anchor: 'start' });
      s += DK.dimH(x0, x0 + L20, 210, 'length at ' + ref, { from: gy + 22, below: true });
      s += T(370, 60, 'dashed: size at ' + ref, 'mut');
      s += notes('Each grows with its own temperature and coefficient. Same material at the same temperature: the correction is close to zero.', 18, 244, 86);
      return DK.svg(W, H + 20, s, 'Temperature compensation: part and gauge both grown from their size at the reference temperature');
    },

    // Dividing head: index plate, crank and pin, sector arms.
    indexing() {
      const W = 520, H = 250, cx = 128, cy = 124, R = 98, r1 = 82, r2 = 62, n1 = 24, n2 = 18;
      let s = DK.circle(cx, cy, R, 'part') + cross(cx, cy, R + 10);
      for (let i = 0; i < n1; i++) { const a = rad(90 - i * 360 / n1); s += DK.circle(cx + r1 * Math.cos(a), cy - r1 * Math.sin(a), 3, 'thin'); }
      for (let i = 0; i < n2; i++) { const a = rad(90 - i * 360 / n2); s += DK.circle(cx + r2 * Math.cos(a), cy - r2 * Math.sin(a), 2.6, 'thin'); }
      // Sector arms spanning 5 hole spaces on the outer circle, from the pin.
      const a0 = 60, sp = 360 / n1, a1 = a0 - 5 * sp, R2 = R + 6;
      [a0, a1].forEach(a => { s += DK.line(cx + 22 * Math.cos(rad(a)), cy - 22 * Math.sin(rad(a)), cx + R2 * Math.cos(rad(a)), cy - R2 * Math.sin(rad(a)), 'hot'); });
      for (let k = 1; k <= 5; k++) { const a = rad(a0 - k * sp); s += DK.circle(cx + r1 * Math.cos(a), cy - r1 * Math.sin(a), 3, 'hotf'); }
      // Crank to the pin, with its handle.
      const px = cx + r1 * Math.cos(rad(a0)), py = cy - r1 * Math.sin(rad(a0));
      s += DK.line(cx, cy, px + 14 * Math.cos(rad(a0)), py - 14 * Math.sin(rad(a0)), 'ln') + DK.circle(cx, cy, 7, 'part');
      s += DK.circle(px, py, 4.5, 'tool');
      s += DK.leader(px + 3, py - 3, 250, 22, 'crank pin in a hole', { anchor: 'start' });
      const ma = rad(a0 - 2.5 * sp);
      s += DK.leader(cx + (R2 - 2) * Math.cos(rad(a1)), cy - (R2 - 2) * Math.sin(rad(a1)), 266, 186, 'sector arms', { hot: true, anchor: 'start' });
      s += DK.leader(cx + r1 * Math.cos(ma) + 3, cy - r1 * Math.sin(ma), 262, 110, 'holes to move', { hot: true, anchor: 'start' });
      s += DK.leader(cx + r2 * Math.cos(rad(200)), cy - r2 * Math.sin(rad(200)), 22, 236, 'another hole circle', { anchor: 'start' });
      s += col(262, 56, [['index plate', 'txt'], ['hole circles: copy the', 'mut'], ['counts from your plates', 'mut']]);
      s += col(372, 106, [['crank turns per division', 'txt'], ['= worm ratio ÷ divisions', 'mut'], ['(whole turns + holes', 'mut'], ['on one circle)', 'mut']]);
      s += notes('Worm ratio: turns of the crank per turn of the spindle. Count holes from the next hole; the hole the pin is in is not counted.', 266, 210, 42);
      return DK.svg(W, H + 10, s, 'Dividing head: index plate with hole circles, crank pin and sector arms');
    },

    // Change gears: spindle, stud gear a, compound b and c, leadscrew gear d.
    changegears() {
      const W = 520, H = 250, ax = 78, ay = 112, ra = 24, rb = 44, rc = 22, rd = 40;
      const bx = ax + ra + rb, by = ay, dx = bx + (rc + rd) * Math.cos(rad(55)), dy = by + (rc + rd) * Math.sin(rad(55));
      let s = DK.circle(ax, 40, 22, 'part') + cross(ax, 40, 28) + T(ax + 32, 30, 'spindle', 'txt');
      s += DK.line(ax, 62, ax, ay - ra, 'hid') + T(ax - 8, 76, 'fixed ratio', 'mut', 'end');
      s += DK.circle(ax, ay, ra, 'tool') + cross(ax, ay, ra + 6) + T(ax - ra - 8, ay + 4, 'a', 'hott', 'end');
      s += DK.circle(bx, by, rb, 'part') + DK.circle(bx, by, rc, 'tool') + cross(bx, by, rb + 6);
      s += T(bx + 26, by - 16, 'b', 'txt', 'start', 14) + T(bx - 8, by - 6, 'c', 'hott', 'end');
      s += DK.circle(dx, dy, rd, 'part') + cross(dx, dy, rd + 6) + T(dx - 14, dy + 26, 'd', 'txt', 'end', 14);
      s += DK.line(dx, dy, 330, dy, 'ln') + DK.line(dx + rd + 26, dy - 4, dx + rd + 26, dy + 4, 'ln') + T(330, dy - 8, 'leadscrew', 'txt', 'end');
      s += DK.leader(bx + rb * Math.cos(rad(40)), by - rb * Math.sin(rad(40)), 208, 44, 'compound stud: b and c', { anchor: 'start' });
      s += col(360, 104, [['ratio = driver / driven', 'txt'], ['simple: a / b', 'mut'], ['compound: a/b × c/d', 'mut']]);
      s += col(360, 168, [['shaded: drivers a, c', 'hott'], ['plain: driven b, d', 'mut']]);
      s += notes('Pitch circles shown. Check that a train fits the quadrant (banjo) and clears the studs.', 18, 252, 92);
      return DK.svg(W, H + 12, s, 'Change gear train: spindle, stud gear a, compound gears b and c, leadscrew gear d');
    },

    // Bolted joint: torque on the head, preload clamping the plates, the two friction faces.
    bolttorque() {
      const W = 520, H = 250, cx = 150, hTop = 40, p1 = 64, p2 = 106, p3 = 148, nb = 174, hole = 15, rb = 10;
      let s = '';
      // Plates (hatched), each side of the clearance hole.
      [[p1, p2], [p2, p3]].forEach(([a, b]) => { s += DK.rect(40, a, cx - hole - 40, b - a, 'hatch') + DK.rect(cx + hole, a, 260 - cx - hole, b - a, 'hatch'); });
      // Bolt: head, shank, nut.
      s += DK.rect(cx - 40, hTop, 80, p1 - hTop, 'part') + DK.rect(cx - rb, p1, 2 * rb, nb + 16 - p1, 'part') + DK.rect(cx - 36, p3, 72, nb - p3, 'part');
      for (let y = p3 + 4; y < nb + 14; y += 5) s += DK.line(cx - rb, y, cx + rb, y - 3, 'thin');
      s += DK.cl(cx, hTop - 8, cx, nb + 24);
      // Tightening torque on the head.
      s += '<path class="hot" d="M' + (cx - 46) + ' ' + (hTop - 10) + 'A46 9 0 0 0 ' + (cx + 40) + ' ' + (hTop - 3) + '"/>' + DK.arrow(cx + 34, hTop - 1, cx + 46, hTop - 9, 'hot');
      s += T(cx - 52, hTop - 12, 'torque MA', 'hott', 'end');
      // Preload clamps the plates.
      s += DK.arrow(222, 24, 222, p1 - 2, 'hot') + DK.arrow(222, 206, 222, p3 + 2, 'hot') + T(232, 34, 'F', 'hott') + T(232, 202, 'F', 'hott');
      s += DK.leader(cx + 37, p1 - 1, 288, 60, 'μK  under the head', { anchor: 'start' });
      s += DK.leader(cx + rb - 1, p3 + 12, 288, 150, 'μG  in the thread', { anchor: 'start' });
      s += DK.leader(cx + hole - 2, 88, 288, 104, 'dh  clearance hole', { anchor: 'start' });
      s += DK.dimH(cx - 40, cx + 40, 22, 'dw', { from: hTop });
      s += col(292, 192, [['preload F, clamping the plates', 'hott'], ['MA: tightening torque', 'mut'], ['dw: bearing face Ø under the head', 'mut']]);
      s += notes('MA = stretching the bolt + thread friction μG + friction under the head or nut μK.', 18, 248, 92);
      return DK.svg(W, H + 8, s, 'Bolted joint: tightening torque MA, preload F, friction in the thread and under the head, dw and dh');
    },

    // Clearance holes: screw diameter, hole diameter and the three series.
    clearance() {
      const W = 520, H = 250, cx = 150, d = 32, dh = 46, pt = 96, pb = 152;
      let s = DK.rect(40, pt, cx - dh / 2 - 40, pb - pt, 'hatch') + DK.rect(cx + dh / 2, pt, 260 - cx - dh / 2, pb - pt, 'hatch');
      s += DK.rect(cx - 42, 70, 84, pt - 70, 'part') + DK.rect(cx - d / 2, pt, d, 78, 'part') + DK.cl(cx, 60, cx, 186);
      s += DK.dimH(cx - d / 2, cx + d / 2, 196, 'd', { from: pt + 78, below: true });
      s += DK.dimH(cx - dh / 2, cx + dh / 2, 222, 'dh', { from: pb, below: true });
      s += DK.leader(cx + dh / 2 - 3, 124, 280, 160, 'gap', { anchor: 'start' });
      s += T(cx, 54, 'section', 'mut', 'middle');
      // End view: the screw in fine, medium and coarse holes.
      const ex = 380, ey = 112, rs = 30, rr = [[36, 'fine', 34], [42, 'medium', 0], [50, 'coarse', -34]];
      s += DK.circle(ex, ey, rs, 'part') + cross(ex, ey, 60) + T(ex, ey + 4, 'd', 'txt', 'middle');
      rr.forEach(([r, name, a], i) => { s += DK.circle(ex, ey, r, i === 1 ? 'hot' : 'ghost'); s += DK.leader(ex + r * Math.cos(rad(a)), ey - r * Math.sin(rad(a)), 452, ey - 40 + 40 * i, name, { anchor: 'start', hot: i === 1 }); });
      s += T(ex, 30, 'hole series', 'txt', 'middle');
      s += notes('Metric: ISO 273 fine, medium and coarse. The inch tables give close, normal and free fits.', 292, 188, 34);
      return DK.svg(W, H, s, 'Clearance hole: screw diameter d, hole diameter dh, and fine, medium and coarse holes');
    },

    // Spanner and hex key sizes: across flats.
    spanner() {
      const W = 520, H = 250, cx = 120, cy = 120, s0 = 104;
      const R = s0 / 2 / Math.cos(rad(30));
      let s = DK.poly(hexPts(cx, cy, R, 0), 'part') + DK.circle(cx, cy, s0 / 2 - 4, 'thin') + cross(cx, cy, R + 8);
      s += DK.dimV(cy + s0 / 2, cy - s0 / 2, cx - R - 22, 's', { from: cx - R / 2 });
      s += DK.dimH(cx - R, cx + R, cy + s0 / 2 + 26, 'across corners', { from: cy, below: true });
      s += T(cx, 28, 'hex head or nut', 'txt', 'middle');
      s += T(cx, 44, 's = width across flats = spanner size', 'mut', 'middle');
      // Socket head cap screw: the hex socket's flats take the key.
      const sx = 372, rh = 64, k = 44, Rk = k / 2 / Math.cos(rad(30));
      s += DK.circle(sx, cy, rh, 'part') + DK.poly(hexPts(sx, cy, Rk, 0), 'ln') + cross(sx, cy, rh + 8);
      s += DK.dimV(cy + k / 2, cy - k / 2, sx + rh + 24, 'key', { from: sx + Rk / 2 });
      s += T(sx, 28, 'socket head cap screw', 'txt', 'middle') + T(sx, 44, 'hex key size: across the socket flats', 'mut', 'middle');
      s += notes('A spanner fits across the flats, never the corners. Older DIN sizes differ from ISO 272 for some threads: check the table.', 18, 226, 92);
      return DK.svg(W, H, s, 'Hex head: width across flats s and across corners; socket head with its hex key size');
    },

    // Rolling bearing in section with its loads, for the rating life.
    bearinglife() {
      const W = 520, H = 250, cx = 150, cy = 126, w = 64;
      const rows = [[40, 62, 75, 88, 104], [210, 188, 177, 164, 148]];
      let s = '';
      rows.forEach(([o0, o1, bc, i0, i1]) => {
        s += DK.rect(cx - w / 2, Math.min(o0, o1), w, Math.abs(o1 - o0), 'hatch');
        s += DK.rect(cx - w / 2, Math.min(i0, i1), w, Math.abs(i1 - i0), 'hatch');
        s += DK.circle(cx, bc, 12.5, 'tool');
      });
      s += DK.cl(36, cy, 264, cy) + T(266, cy + 4, 'axis', 'mut');
      s += DK.arrow(cx, 4, cx, 38, 'hot') + T(cx + 8, 18, 'Fr  radial load', 'hott');
      s += DK.arrow(54, 96, cx - w / 2 - 2, 96, 'hot') + T(54, 88, 'Fa  axial', 'hott');
      s += DK.leader(cx + w / 2 - 2, 52, 222, 44, 'outer ring', { anchor: 'start' });
      s += DK.leader(cx + 9, 66, 222, 68, 'ball', { anchor: 'start' });
      s += DK.leader(cx + w / 2 - 2, 98, 222, 100, 'inner ring', { anchor: 'start' });
      s += col(320, 52, [['P = X Fr + Y Fa', 'txt'], ['X, Y from the catalogue', 'mut']]);
      s += col(320, 108, [['L10 = (C / P)^p', 'txt'], ['million revolutions', 'mut'], ['p = 3 ball bearings', 'mut'], ['p = 10/3 roller bearings', 'mut'], ['C: catalogue rating', 'mut']]);
      s += notes('L10 is the life that 90 % of a large group of identical bearings reach or exceed.', 18, 238, 92);
      return DK.svg(W, H, s, 'Ball bearing in section with radial load Fr and axial load Fa; life L10 = (C/P)^p');
    },

    // Grinding wheel marking, split into its parts.
    wheelcode() {
      const W = 520, H = 250, bw = 64, gap = 34, x0 = 32, y0 = 56, bh = 54;
      const parts = [['A', 'abrasive', ['letters']], ['46', 'grit size', ['lower number', '= coarser']], ['K', 'grade', ['A soft', 'to Z hard']], ['8', 'structure', ['low: dense', 'high: open']], ['V', 'bond', ['letters']]];
      let s = T(W / 2, 32, 'A46-K8V', 'txt', 'middle', 15);
      parts.forEach(([code, name, sub], i) => {
        const x = x0 + i * (bw + gap), xc = x + bw / 2;
        s += DK.rect(x, y0, bw, bh, 'part', 4) + '<text class="hott" style="font-size:24px" x="' + f(xc) + '" y="' + f(y0 + bh / 2 + 8) + '" text-anchor="middle">' + code + '</text>';
        s += T(xc, y0 + bh + 22, name, 'txt', 'middle') + sub.map((t, k) => T(xc, y0 + bh + 38 + 13 * k, t, 'mut', 'middle')).join('');
      });
      s += T(x0 + 3 * (bw + gap) + bw / 2, y0 + bh + 64, '(optional)', 'mut', 'middle');
      s += notes('Often a maker\'s number comes in front of the abrasive letters and a maker\'s record after the bond. Grade is how firmly the bond holds the grain, not the hardness of the grain. Diamond and CBN wheels are marked differently.', 18, 206, 86);
      return DK.svg(W, H, s, 'Grinding wheel marking A46-K8V: abrasive, grit size, grade, structure, bond');
    },

    // ISO 513 groups: letters, the tool's colours and the workpiece materials.
    iso513() {
      const W = 520, H = 250, bw = 244, bh = 50;
      const C = typeof ISO513 !== 'undefined' ? Object.fromEntries(ISO513.map(r => [r[0], r[2]])) : {};
      const G = [['P', 'Steels', 'also ferritic, martensitic stainless'], ['M', 'Stainless steels', 'austenitic and duplex'], ['K', 'Cast irons', 'grey, nodular, malleable'],
        ['N', 'Non-ferrous metals', 'aluminium, copper, plastics'], ['S', 'Super alloys, titanium', 'nickel, cobalt and iron based'], ['H', 'Hardened steels', 'and chilled cast iron']];
      let s = '';
      G.forEach(([g, a, b], i) => {
        const x = 12 + (i % 2) * (bw + 8), y = 12 + Math.floor(i / 2) * (bh + 10);
        s += DK.rect(x, y, bw, bh, 'part', 4);
        if (C[g]) s += '<rect x="' + f(x + 4) + '" y="' + f(y + 4) + '" width="10" height="' + f(bh - 8) + '" rx="2" style="fill:' + C[g] + '"/>';
        s += T(x + 32, y + bh / 2 + 9, g, 'txt', 'middle', 24) + T(x + 52, y + 22, a, 'txt') + T(x + 52, y + 38, b, 'mut');
      });
      s += notes('The groups sort cutting materials by the workpiece they are meant for. The number after the letter (P10, K20 ...) is the maker\'s application range: low = harder, more wear resistant; high = tougher.', 18, 206, 92);
      return DK.svg(W, H, s, 'ISO 513 groups P, M, K, N, S and H with their workpiece materials');
    },

    // Galvanic corrosion: two metals in contact under a drop of water.
    galvanic() {
      const W = 520, H = 250, y0 = 132, xm = 176;
      // Metal A (less noble) with a pitted top under the drop; metal B plain.
      let top = [[36, y0], [126, y0]];
      for (let x = 130; x < xm; x += 8) top.push([x, y0 + 3 + (x % 16 ? 5 : 1)], [x + 4, y0 + 1]);
      top.push([xm, y0 + 3]);
      let s = DK.poly(top.concat([[xm, 184], [36, 184]]), 'hatch') + DK.rect(xm, y0, 140, 52, 'part');
      s += DK.path('M108 ' + y0 + 'C114 86 238 86 244 ' + y0, 'thin');
      s += T(80, 166, 'A', 'txt', 'middle', 16) + T(250, 166, 'B', 'txt', 'middle', 16);
      s += DK.leader(178, 96, 272, 70, 'water (electrolyte)', { anchor: 'start' });
      s += DK.arrow(118, 92, 146, y0 + 2, 'hot') + T(112, 86, 'corrodes', 'hott', 'end');
      s += T(80, 204, 'A: anode, corrodes', 'hott', 'middle') + T(250, 204, 'B: cathode, protected', 'txt', 'middle');
      // Scale: more noble at the top.
      const sx = 420;
      s += DK.arrow(sx, 196, sx, 52, 'dim') + T(sx, 30, 'more noble', 'txt', 'middle') + T(sx, 44, '(cathodic)', 'mut', 'middle');
      s += T(sx, 212, 'less noble', 'txt', 'middle') + T(sx, 226, '(anodic)', 'mut', 'middle');
      s += DK.circle(sx, 84, 3.5, 'dimf') + T(sx + 10, 88, 'B', 'txt') + DK.circle(sx, 170, 3.5, 'hotf') + T(sx + 10, 174, 'A', 'hott');
      s += notes('The smaller the anode\'s area against the cathode\'s, the faster it corrodes.', 18, 240, 92);
      return DK.svg(W, H, s, 'Galvanic corrosion: the less noble metal A corrodes where it touches the nobler metal B under water');
    },

    // Chatter: the wave left by one tooth against the path of the next.
    chatter() {
      const W = 520, H = 256, x0 = 24, x1 = 296, k = 2 * Math.PI / 46, a = 6;
      const wave = (y, ph) => { const p = []; for (let x = x0; x <= x1; x += 2) p.push([x, y + a * Math.sin(k * (x - x0) + ph)]); return p; };
      const panel = (yt, ph, title, l1, l2) => {
        const up = wave(yt, 0), lo = wave(yt + 22, ph);
        let s = DK.path('M' + up.map(p => f(p[0]) + ' ' + f(p[1])).join('L') + 'L' + lo.slice().reverse().map(p => f(p[0]) + ' ' + f(p[1])).join('L') + 'Z', 'tool');
        s += DK.path('M' + lo.map(p => f(p[0]) + ' ' + f(p[1])).join('L') + 'L' + f(x1) + ' ' + f(yt + 52) + 'L' + f(x0) + ' ' + f(yt + 52) + 'Z', 'hatch');
        const ty = lo[lo.length - 1][1];
        s += DK.poly([[x1 + 2, ty], [x1 + 20, ty - 4], [x1 + 24, ty - 26], [x1 + 12, ty - 24]], 'part');
        s += T(344, yt - 4, title, 'txt') + T(344, yt + 12, l1, 'mut') + T(344, yt + 26, l2, 'mut');
        return s;
      };
      let s = panel(44, 0, 'In phase: stable', 'chip thickness stays even:', 'whole number of waves');
      s += panel(140, Math.PI, 'Out of phase: chatter', 'chip thickness varies and', 'feeds the vibration');
      s += DK.leader(60, 44 + a * Math.sin(k * 36) - 1, 70, 22, 'surface left by the last tooth', { anchor: 'start' });
      s += DK.leader(240, 140 + 22 + a * Math.sin(k * 216 + Math.PI) + 1, 200, 206, 'path of the next tooth', { anchor: 'start' });
      s += DK.leader(x1 + 18, 44 + 10, 330, 92, 'tooth', { anchor: 'start' });
      s += notes('Tooth passing frequency f_t = n z / 60; chatter frequency fc. Stable speeds n = 60 fc / (z (N + 1)): a whole number of chatter waves per tooth period.', 18, 230, 88);
      return DK.svg(W, H, s, 'Chatter: waves left by successive teeth in phase (stable) and out of phase (chatter)');
    },
  });
})();
