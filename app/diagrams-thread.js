'use strict';
// Reference drawings for the thread tools (see dk.js). These tools draw their
// own screens, so the drawing is a key to the names their tables use: it has
// symbols, not live values. Thread forms are drawn to the proportions of the
// basic profile each tool already cites (flank angles, depth and flats as
// fractions of the pitch); nothing here is used in a calculation.
(() => {
  const rad = d => d * Math.PI / 180;
  const f = v => (Math.round(v * 100) / 100).toString();

  // A thread form in axial section, crests up, drawn left to right.
  //   a1, a2   flank angles from the perpendicular to the axis (degrees): leading, trailing
  //   fc       crest flat / P            h    depth / P (not needed when rr is given)
  //   rc, rr   crest and root radius / P (symmetric forms only); the flats follow from them
  //   P        pitch in pixels            n    number of teeth
  //   x0, yc   left end of the first flank at root level, and the crest height (pixels)
  //   slope    rise in y per pixel of x (taper), 0 for a parallel thread
  //   flip     true for an internal thread (crests down)
  // Returns the outline path and the levels a drawing needs.
  function form(o) {
    const P = o.P, n = o.n || 4, t1 = Math.tan(rad(o.a1)), t2 = Math.tan(rad(o.a2));
    const ar = rad(o.a1), k = Math.cos(ar) - (1 - Math.sin(ar)) * Math.tan(ar);
    const fc = (o.rc ? 2 * o.rc * k : o.fc) * P;
    const frr = o.rr ? 2 * o.rr * k * P : null;
    const h = frr !== null ? (P - fc - frr) / (t1 + t2) : o.h * P;
    const fr = P - fc - h * (t1 + t2);
    const sg = o.flip ? -1 : 1, yc = o.yc, yr = yc + sg * h;
    const sl = o.slope || 0, Y = (x, y) => y + sl * (x - o.x0);
    const pt = (x, y) => f(x) + ' ' + f(Y(x, y));
    const tail = 12;
    const rootR = o.rr ? o.rr * P : 0, rdy = rootR * (1 - Math.sin(ar)), rex = rootR * Math.cos(ar);
    let d = 'M' + (o.rr ? pt(o.x0 - fr / 2 - rex, yr - sg * rdy) : pt(o.x0 - tail, yr));
    const crest = [], apex = [];
    for (let i = 0; i < n; i++) {
      const X = o.x0 + i * P, bx = X + h * t1, cx = bx + fc, dx = cx + h * t2, xc = (bx + cx) / 2, xr = dx + fr / 2;
      if (o.rr) {
        // Down the flank before this groove, round the root, onto this tooth's flank.
        const xa = X - fr / 2;
        d += 'L' + pt(xa - rex, yr - sg * rdy) + 'A' + f(rootR) + ' ' + f(rootR) + ' 0 0 ' + (o.flip ? 1 : 0) + ' ' + pt(xa + rex, yr - sg * rdy);
      } else d += 'L' + pt(X, yr);
      if (o.rc) {
        const r = o.rc * P, dy = r * (1 - Math.sin(ar)), ex = r * Math.cos(ar);
        d += 'L' + pt(xc - ex, yc + sg * dy) + 'A' + f(r) + ' ' + f(r) + ' 0 0 ' + (o.flip ? 0 : 1) + ' ' + pt(xc + ex, yc + sg * dy);
      } else d += 'L' + pt(bx, yc) + 'L' + pt(cx, yc);
      if (!o.rr) d += 'L' + pt(dx, yr);
      crest.push([xc, Y(xc, yc)]);
      const e = fr / (t1 + t2), axx = dx + e * t2;
      apex.push([axx, Y(axx, yr + sg * e), xr, Y(xr, yr)]);
    }
    const xe = o.x0 + n * P + tail;
    if (o.rr) {
      const xa = o.x0 + n * P - fr / 2;
      d += 'L' + pt(xa - rex, yr - sg * rdy) + 'A' + f(rootR) + ' ' + f(rootR) + ' 0 0 ' + (o.flip ? 1 : 0) + ' ' + pt(xa + rex, yr - sg * rdy);
    } else d += 'L' + pt(xe, yr);
    const tp = (P / 2 - fc) / (t1 + t2); // depth of the pitch line below the crests
    return { d, h, fc, fr, yc, yr, yp: yc + sg * tp, xs: o.rr ? o.x0 - fr / 2 - rex : o.x0 - tail, xe: o.rr ? o.x0 + n * P - fr / 2 + rex : xe, crest, apex, Y, sl };
  }
  // Muted note text, wrapped to the drawing's width; returns the markup.
  const notes = (text, x, y, max) => {
    const out = []; let line = '';
    for (const w of String(text).split(' ')) { if ((line + ' ' + w).trim().length > (max || 90)) { out.push(line); line = w; } else line = (line + ' ' + w).trim(); }
    if (line) out.push(line);
    return out.map((t, i) => DK.text(x, y + i * 14, t, { cls: 'mut', anchor: 'start' })).join('');
  };
  // The screw body under an external form: hatched down to a break line.
  const body = (F, yb) => DK.path(F.d + 'L' + f(F.xe) + ' ' + f(yb) + 'L' + f(F.xs) + ' ' + f(yb) + 'Z', 'hatch');

  // The standard picture: one external thread form with its pitch, depth, angle and the three diameters.
  //   o.form   form() options without P, x0, yc      o.ang   [[from, to, text]] angle arcs in the second groove
  //   o.names  [major, pitch, minor] labels           o.notes lines of text under the drawing
  function profile(o) {
    const W = 520, H = 250, P = 74, yc = 62, axis = 196, yb = 162;
    const F = form(Object.assign({ P, n: 4, x0: 46, yc }, o.form));
    let s = body(F, yb) + DK.line(F.xs, yb, F.xe, yb, 'ghost');
    s += DK.cl(18, axis, F.xe + 22, axis) + DK.text(20, axis - 6, 'axis', { cls: 'mut', anchor: 'start' });
    // Pitch line through the flanks.
    s += DK.cl(F.xs - 8, F.yp, F.xe + 26, F.yp);
    // Pitch, between two crests.
    s += DK.dim(F.crest[1][0], yc, F.crest[2][0], yc, 'P', { off: 24 });
    // Depth of thread, at the left.
    s += DK.dim(F.xs + 4, F.yr, F.xs + 4, yc, o.depth || 'h', { off: 14 });
    // Flank angles, in the groove after the first tooth.
    const [ax, ay] = F.apex[0], r = Math.hypot(0, F.yr - ay) + F.h * 0.6;
    o.ang.forEach(([a0, a1, text], i) => { s += DK.angle(ax, ay, o.ang.length > 1 && i === 0 ? r + F.h * 0.42 : r, a0, a1, text, { hot: true }); });
    if (o.ang.length > 1) s += DK.line(ax, F.yr, ax, yc - 16, 'thin');
    // The three diameters, named at the right.
    const lx = F.xe + 30, nm = o.names || ['major Ø', 'pitch Ø', 'minor Ø'];
    [[yc, nm[0]], [F.yp, nm[1]], [F.yr, nm[2]]].forEach(([y, t]) => { s += DK.line(F.xe + 4, y, lx - 4, y, 'dim ext') + DK.text(lx, y + 4, t, { cls: 'dimt', anchor: 'start' }); });
    s += DK.text(lx, axis - 6, 'all three are measured', { cls: 'mut', anchor: 'start' }) + DK.text(lx, axis + 8, 'across the axis', { cls: 'mut', anchor: 'start' });
    if (o.notes) s += notes(o.notes, 18, 228);
    if (o.extra) s += o.extra(F, { P, yc, axis, yb });
    return DK.svg(W, H, s, o.label);
  }

  const V60 = { a1: 30, a2: 30, h: 0.541266, fc: 0.125 }; // ISO 68-1 / ASME B1.1 basic profile: depth 5/8 H, crest P/8, root P/4

  Object.assign(DIAGRAMS, {
    threaddata: () => profile({
      form: V60, ang: [[60, 120, '60°']], names: ['major Ø  d', 'pitch Ø  d2', 'minor Ø  d1'],
      label: 'Basic 60 degree thread profile: pitch, depth and the major, pitch and minor diameters',
      notes: 'Screw shown. Crest flat P/8, root flat P/4. On the pitch line the tooth and the gap are both P/2 wide.',
    }),
    unm: () => profile({
      form: V60, ang: [[60, 120, '60°']], names: ['major Ø', 'pitch Ø', 'minor Ø'],
      label: 'Unified miniature thread: 60 degree profile with the pitch and the three diameters',
      notes: 'UNM uses the 60° profile at watch and instrument sizes (0.30 to 1.40 mm).',
    }),
    unjunr: () => profile({
      form: { a1: 30, a2: 30, fc: 0.125, rr: 0.18042 }, ang: [[60, 120, '60°']], names: ['major Ø', 'pitch Ø', 'minor Ø (larger)'],
      label: 'UNJ thread: 60 degree profile with a controlled root radius',
      notes: 'UNJ and UNR screws have a rounded root; the UNJ nut has a larger minor Ø to clear it.',
      extra: F => { const [, , xr, yr] = F.apex[2]; return DK.leader(xr, yr - 2, xr + 34, yr + 34, 'root radius R', { hot: true, anchor: 'start' }); },
    }),
    whitworth: () => profile({
      form: { a1: 27.5, a2: 27.5, rc: 0.137329, rr: 0.137329 }, ang: [[62.5, 117.5, '55°']], names: ['major Ø', 'effective Ø', 'minor Ø'],
      label: 'Whitworth thread form: 55 degree flanks with rounded crests and roots',
      notes: 'Whitworth (BSW, BSF, BSP) has rounded crests and roots of the same radius r. BA is 47.5° and also rounded.',
      extra: F => DK.leader(F.crest[3][0], F.crest[3][1] + 1, F.crest[3][0] + 26, F.crest[3][1] - 26, 'r', { hot: true, anchor: 'start' }),
    }),
    acme: () => profile({
      form: { a1: 14.5, a2: 14.5, h: 0.5, fc: 0.3707 }, ang: [[75.5, 104.5, '29°']],
      label: 'ACME thread form: 29 degree included angle, depth half the pitch',
      notes: 'General purpose ACME: depth P/2, crest flat 0.3707 P. Stub ACME is the same angle with depth 0.3 P.',
    }),
    trapezoidal: () => profile({
      form: { a1: 15, a2: 15, h: 0.5, fc: 0.366 }, ang: [[75, 105, '30°']], names: ['major Ø  d', 'pitch Ø  d2', 'minor Ø  d3'], depth: 'H1',
      label: 'Metric trapezoidal thread form: 30 degree included angle',
      notes: 'Basic profile: H1 = 0.5 P, crest flat 0.366 P. The nut is cut deeper by the crest clearance ac.',
    }),
    buttress: () => profile({
      form: { a1: 7, a2: 45, h: 0.6, fc: 0.16316 }, ang: [[83, 90, '7°'], [90, 135, '45°']],
      label: 'Buttress thread form: 7 degree load flank and 45 degree clearance flank',
      notes: 'The near-square 7° flank takes the load in one direction; the 45° flank only clears.',
      extra: (F, g) => { const x = F.crest[3][0] - F.fc / 2 - F.h * 0.06, y = (g.yc + F.yr) / 2 + 6; return DK.arrow(x - 40, y, x - 3, y, 'hot') + DK.text(x - 24, y - 7, 'load', { cls: 'hott', anchor: 'middle' }); },
    }),

    // Constant-pitch series: the same pitch on a small and a large diameter.
    unseries() {
      const W = 520, H = 250, P = 26;
      const bar = (x, cy, r, n) => {
        const h = P * 0.541266, fc = P / 8, t = Math.tan(rad(30));
        let top = 'M' + f(x) + ' ' + f(cy - r + h), bot = '';
        const pts = [];
        for (let i = 0; i < n; i++) { const X = x + i * P; pts.push([X, h], [X + h * t, 0], [X + h * t + fc, 0], [X + 2 * h * t + fc, h]); }
        pts.push([x + n * P, h]);
        top = 'M' + pts.map(p => f(p[0]) + ' ' + f(cy - r + p[1])).join('L');
        bot = pts.slice().reverse().map(p => f(p[0]) + ' ' + f(cy + r - p[1])).join('L');
        return DK.path(top + 'L' + bot + 'Z', 'part') + DK.cl(x - 14, cy, x + n * P + 14, cy);
      };
      let s = bar(40, 70, 22, 7) + bar(40, 172, 48, 7);
      const c0 = 40 + P * 0.541266 * Math.tan(rad(30)) + P / 16;
      s += DK.dim(c0 + 2 * P, 48, c0 + 3 * P, 48, 'P', { off: 16 }) + DK.dim(c0 + 2 * P, 124, c0 + 3 * P, 124, 'P', { off: 16 });
      s += DK.dim(248, 92, 248, 48, 'Ø small', { off: -22 }) + DK.dim(248, 220, 248, 124, 'Ø large', { off: -22 });
      s += DK.text(312, 66, 'Constant-pitch series', { cls: 'txt', anchor: 'start' });
      s += DK.text(312, 84, 'keep the same threads per', { cls: 'mut', anchor: 'start' }) + DK.text(312, 98, 'inch on every diameter', { cls: 'mut', anchor: 'start' });
      s += DK.text(312, 112, '(8-UN, 12-UN, 16-UN).', { cls: 'mut', anchor: 'start' });
      s += DK.text(312, 158, 'The thread depth stays', { cls: 'mut', anchor: 'start' }) + DK.text(312, 172, 'the same, so on a large', { cls: 'mut', anchor: 'start' });
      s += DK.text(312, 186, 'diameter the thread is', { cls: 'mut', anchor: 'start' }) + DK.text(312, 200, 'shallow for its size.', { cls: 'mut', anchor: 'start' });
      return DK.svg(W, H, s, 'Constant-pitch series: the same pitch on a small and a large diameter');
    },

    // Taper pipe thread: the pitch line climbs along the pipe; the gauge plane fixes where the size is measured.
    pipethreads() {
      const W = 520, H = 260, P = 34, n = 8, x0 = 56, sl = -1 / 32 * 2.2; // taper drawn 2.2 times steeper than 1 in 16 so that it shows
      const F = form({ a1: 30, a2: 30, h: 0.8 * 0.866025, fc: 0.033 * 2.2, P, n, x0, yc: 96, slope: sl });
      const bore = 190, axis = 246, xg = x0 + 4.5 * P;
      let s = DK.path(F.d + 'L' + f(F.xe) + ' ' + f(bore) + 'L' + f(F.xs) + ' ' + f(bore) + 'Z', 'hatch');
      s += DK.cl(18, axis, 372, axis) + DK.text(376, axis + 4, 'axis', { cls: 'mut', anchor: 'start' }) + DK.text(F.xe - 4, bore + 15, 'bore', { cls: 'mut', anchor: 'end' });
      // Pitch line (tapered) and the gauge plane.
      s += DK.cl(F.xs - 10, F.Y(F.xs - 10, F.yp), F.xe + 16, F.Y(F.xe + 16, F.yp));
      s += DK.line(xg, 40, xg, bore + 8, 'hot') + DK.text(xg, 32, 'gauge plane', { cls: 'hott' });
      s += DK.circle(xg, F.Y(xg, F.yp), 3.2, 'hotf') + DK.leader(xg + 3, F.Y(xg, F.yp) - 2, 372, 50, 'pitch Ø here', { hot: true, anchor: 'start' });
      s += DK.text(376, 66, '(E1 for NPT, gauge', { cls: 'mut', anchor: 'start' }) + DK.text(376, 80, 'diameter for R)', { cls: 'mut', anchor: 'start' });
      // Hand-tight engagement from the pipe end.
      s += DK.line(F.xs, bore + 4, F.xs, bore + 30, 'dim ext') + DK.dim(F.xs, bore + 24, xg, bore + 24, 'hand-tight length', { below: true });
      s += DK.text(F.xs, 60, 'pipe end', { cls: 'mut', anchor: 'start' }) + DK.line(F.xs, 66, F.xs, F.yr - 4, 'thin');
      s += DK.dim(F.crest[5][0], F.crest[5][1], F.crest[6][0], F.crest[6][1], 'P', { off: 16 });
      s += DK.text(376, 122, 'Taper 1 in 16 on', { cls: 'txt', anchor: 'start' }) + DK.text(376, 136, 'diameter (drawn', { cls: 'txt', anchor: 'start' }) + DK.text(376, 150, 'steeper here).', { cls: 'txt', anchor: 'start' });
      s += DK.text(376, 174, 'NPT 60°, R / Rc 55°.', { cls: 'mut', anchor: 'start' }) + DK.text(376, 188, 'G (parallel) has', { cls: 'mut', anchor: 'start' }) + DK.text(376, 202, 'no taper.', { cls: 'mut', anchor: 'start' });
      return DK.svg(W, H, s, 'Taper pipe thread: pitch line, gauge plane and hand-tight length');
    },

    // Helical insert: the STI hole is tapped oversize; the wire coil brings it back to the nominal thread.
    sti() {
      const W = 520, H = 240, P = 52, x0 = 44, n = 5, hN = 0.541266, fcN = 0.25;
      // Parent metal with the oversize internal thread (crests down, roots up in the metal).
      const N = form({ a1: 30, a2: 30, h: hN, fc: fcN, P, n, x0, yc: 138, flip: true });
      let s = DK.path(N.d + 'L' + f(N.xe) + ' 30L' + f(N.xs) + ' 30Z', 'hatch');
      // Wire sections (diamond) seated in each groove; the inner V of the coil is the nominal thread.
      const hw = P * 0.25, hh = hw / Math.tan(rad(30)), top = N.yr + 4;
      let last = null;
      for (let i = 0; i < n - 1; i++) { const xr = N.apex[i][2]; s += DK.poly([[xr, top], [xr + hw, top + hh], [xr, top + 2 * hh], [xr - hw, top + hh]], 'tool'); last = xr; }
      const axis = 222, lx = N.xe + 26;
      s += DK.cl(18, axis, N.xe + 10, axis) + DK.text(20, axis - 6, 'axis of the hole', { cls: 'mut', anchor: 'start' });
      s += DK.text(N.xs + 6, 48, 'parent metal', { cls: 'txt', anchor: 'start' });
      s += DK.leader(N.xe - 14, N.yr + 6, lx, 74, 'STI tapped thread', { anchor: 'start' }) + DK.text(lx + 4, 92, '(larger than the nominal size)', { cls: 'mut', anchor: 'start' });
      s += DK.leader(last + hw - 2, top + hh, lx, 128, 'insert wire', { hot: true, anchor: 'start' });
      s += DK.leader(last + hw * 0.5, top + hh * 1.55, lx, 168, 'inside of the coil', { anchor: 'start' }) + DK.text(lx + 4, 186, '= the nominal thread', { cls: 'mut', anchor: 'start' });
      s += DK.dim(N.apex[0][2], top + 2 * hh, N.apex[1][2], top + 2 * hh, 'P', { off: -14, below: true });
      return DK.svg(W, H, s, 'Helical insert: oversize STI tapped hole with the wire insert forming the nominal thread');
    },

    // Coating on a 60 degree thread: thickness t on each flank moves the pitch diameter by 4 t.
    coating() {
      const W = 520, H = 250, P = 132, x0 = 40, yc = 46, t = 12, yb = 162;
      const F = form({ a1: 30, a2: 30, h: 0.541266, fc: 0.125, P, n: 2, x0, yc });
      // Coated outline: the base profile moved outward by t (flanks t / cos 30 along the axis, flats t up).
      const C = form({ a1: 30, a2: 30, h: 0.541266, fc: 0.125 + 2 * t * (1 / Math.cos(rad(30)) - Math.tan(rad(30))) / P, P, n: 2, x0: x0 - t / Math.cos(rad(30)) + t * Math.tan(rad(30)), yc: yc - t });
      let s = '<clipPath id="dkcoat"><rect x="' + f(F.xs) + '" y="0" width="' + f(F.xe - F.xs) + '" height="' + f(yb) + '"/></clipPath>';
      s += '<g clip-path="url(#dkcoat)">' + DK.path(C.d + 'L' + f(C.xe) + ' ' + f(yb) + 'L' + f(C.xs) + ' ' + f(yb) + 'Z', 'tool') + '</g>';
      s += DK.path(F.d + 'L' + f(F.xe) + ' ' + f(yb) + 'L' + f(F.xs) + ' ' + f(yb) + 'Z', 'part') + body(F, yb);
      s += DK.cl(F.xs - 8, F.yp, F.xe + 22, F.yp) + DK.text(F.xe + 26, F.yp + 4, 'pitch line', { cls: 'mut', anchor: 'start' });
      // t, square to the flank, on the first tooth's trailing flank at the pitch line.
      const fx = x0 + F.h * Math.tan(rad(30)) + F.fc + (F.yp - yc) * Math.tan(rad(30)), fy = F.yp;
      s += DK.dim(fx, fy, fx + Math.cos(rad(30)) * t, fy - Math.sin(rad(30)) * t, 't', { hot: true, off: 0 });
      // 2 t: how far the same flank moves measured straight up (radially).
      const gx = x0 + P + F.h * Math.tan(rad(30)) * 0.4, gy = F.yr - F.h * 0.4;
      s += DK.dim(gx, gy, gx, gy - 2 * t, '2 t', { off: -22 });
      s += DK.leader(F.crest[1][0] + 10, yc - t + 1, F.xe + 26, 30, 'coating, thickness t', { hot: true, anchor: 'start' });
      s += notes('On a 60° flank a coating t thick moves the flank 2 t radially (t ÷ sin 30°). Both sides of the diameter move, so the pitch Ø changes by 4 t: a screw grows by 4 t, a nut shrinks by 4 t.', 18, 196, 92);
      return DK.svg(W, H, s, 'Coating on a thread flank: thickness t changes the pitch diameter by four times t');
    },

    // Tap drill: the drill leaves part of the full thread height in the nut.
    tapdrill() {
      const W = 520, H = 250, P = 78, x0 = 52, yMaj = 70, hFull = P * 0.541266, pct = 0.72;
      // Internal thread: roots (major) at the top, crests cut off by the drill at pct of the height.
      const cut = hFull * pct, fcN = (P - P / 8 - 2 * cut * Math.tan(rad(30))) / P;
      const N = form({ a1: 30, a2: 30, h: cut / P, fc: fcN, P, n: 4, x0: x0 + P / 16, yc: yMaj + cut, flip: true });
      let s = DK.path(N.d + 'L' + f(N.xe) + ' 26L' + f(N.xs) + ' 26Z', 'hatch');
      const yFull = yMaj + hFull, axis = 222;
      // The full-height crests the drill removed.
      for (let i = 0; i < 4; i++) {
        const [xc] = N.crest[i], w = N.fc / 2, w2 = (P / 4) / 2;
        s += DK.path('M' + f(xc - w) + ' ' + f(yMaj + cut) + 'L' + f(xc - w2) + ' ' + f(yFull) + 'L' + f(xc + w2) + ' ' + f(yFull) + 'L' + f(xc + w) + ' ' + f(yMaj + cut), 'ghost');
      }
      const lx = N.xe + 30;
      s += DK.line(N.xs - 6, yMaj + cut, N.xe + 26, yMaj + cut, 'hot') + DK.text(lx, yMaj + cut + 1, 'tap drill Ø', { cls: 'hott', anchor: 'start' });
      s += DK.line(N.xe + 4, yMaj, N.xe + 26, yMaj, 'dim ext') + DK.text(lx, yMaj + 4, 'major Ø', { cls: 'dimt', anchor: 'start' });
      s += DK.line(N.xe + 4, yFull, N.xe + 26, yFull, 'dim ext') + DK.text(lx, yFull + 9, 'basic minor Ø', { cls: 'dimt', anchor: 'start' });
      s += DK.dim(N.xs + 2, yFull, N.xs + 2, yMaj, '100 %', { off: 18 });
      const xm = N.apex[1][2];
      s += DK.dim(xm, yMaj + cut, xm, yMaj, '', { hot: true, off: 0 }) + DK.text(xm + 8, yMaj + cut / 2 + 4, '72 %', { cls: 'hott', anchor: 'start' });
      s += DK.cl(18, axis, N.xe + 22, axis) + DK.text(20, axis - 6, 'axis of the hole', { cls: 'mut', anchor: 'start' });
      s += DK.text(N.xs, 18, 'nut (section)', { cls: 'mut', anchor: 'start' });
      s += notes('A bigger drill leaves less thread: easier tapping, slightly weaker thread.', lx, 148, 22);
      return DK.svg(W, H, s, 'Tap drill: the drilled hole leaves a percentage of the full thread height');
    },

    // Tap limits: pitch diameter bands stepping up from basic, against the nut's tolerance band.
    taplimits() {
      const W = 520, H = 250, x0 = 70, st = 62, y0 = 136;
      let s = DK.line(x0 - 40, y0, x0 + 6 * st + 10, y0, 'ln') + DK.line(x0, y0 - 100, x0, y0 + 10, 'ln');
      s += DK.text(x0, y0 + 26, 'basic', { cls: 'dimt' }) + DK.text(x0, y0 + 40, 'pitch Ø', { cls: 'dimt' });
      for (let i = 1; i <= 6; i++) {
        s += DK.line(x0 + i * st, y0 - 4, x0 + i * st, y0 + 6, 'thin');
        s += DK.rect(x0 + (i - 1) * st + 2, y0 - 34, st - 4, 26, i === 3 ? 'tool' : 'part', 3) + DK.text(x0 + (i - 0.5) * st, y0 - 16, 'H' + i, { cls: i === 3 ? 'hott' : 'txt' });
      }
      s += DK.dim(x0 + st, y0 + 18, x0 + 2 * st, y0 + 18, 'one step', { below: true });
      // Nut tolerance band.
      s += DK.rect(x0, y0 - 88, 4.3 * st, 24, 'ghost', 3) + DK.text(x0 + 2.15 * st, y0 - 71, 'pitch Ø tolerance of the nut (2B, 6H ...)', { cls: 'txt' });
      s += DK.text(x0 + 2.5 * st, y0 - 42, 'this tap', { cls: 'hott' });
      s += DK.arrow(x0 + 4.4 * st, y0 + 30, x0 + 6 * st + 6, y0 + 30, 'dim') + DK.text(x0 + 5.2 * st, y0 + 46, 'larger', { cls: 'dimt' });
      s += notes('Each H number is a band of pitch diameter above basic (D numbers for metric). Pick the tap whose band sits inside the nut tolerance, leaving room for the tap to cut slightly oversize.', 18, 208, 92);
      return DK.svg(W, H, s, 'Tap pitch diameter bands H1 to H6 above basic, against the nut tolerance');
    },

    // Machine taper shank: gauge diameter, small end, length and the half angle.
    machinetapers() {
      const W = 520, H = 250, xl = 84, xr = 330, cy = 92, R = 50, r = 27;
      let s = DK.poly([[xl, cy - R], [xr, cy - r], [xr, cy + r], [xl, cy + R]], 'part') + DK.cl(xl - 38, cy, xr + 26, cy);
      // Flange / tool side at the big end.
      s += DK.rect(xl - 22, cy - R - 12, 22, 2 * R + 24, 'hatch');
      s += DK.dim(xl - 22, cy + R, xl - 22, cy - R, 'gauge Ø  D', { off: 16 });
      s += DK.dim(xr, cy + r, xr, cy - r, 'small Ø  d', { off: -22 });
      s += DK.line(xl, cy + R + 16, xl, cy + R + 44, 'dim ext') + DK.line(xr, cy + r + 4, xr, cy + R + 44, 'dim ext') + DK.dim(xl, cy + R + 38, xr, cy + R + 38, 'length  L', { below: true });
      // Half angle: the flank against a line parallel to the axis from the big-end corner.
      const ang = Math.atan2(R - r, xr - xl) * 180 / Math.PI;
      s += DK.line(xl, cy - R, xl + 216, cy - R, 'thin') + DK.angle(xl, cy - R, 200, 0, -ang, '', { hot: true });
      s += DK.text(xl + 150, cy - R - 8, 'half angle', { cls: 'hott' });
      const lx = 386;
      s += DK.text(lx, 50, 'taper = (D − d) ÷ L', { cls: 'txt', anchor: 'start' }) + DK.text(lx, 68, 'taper per foot = × 12', { cls: 'mut', anchor: 'start' });
      s += DK.text(lx, 92, 'included angle', { cls: 'mut', anchor: 'start' }) + DK.text(lx, 106, '= 2 × half angle', { cls: 'mut', anchor: 'start' });
      s += notes('The gauge Ø is where the taper is sized. 7:24 tapers (BT, CAT, SK) give it at the gauge line near the flange.', 18, 220, 92);
      return DK.svg(W, H, s, 'Machine taper shank: gauge diameter, small end diameter, length and half angle');
    },

    // Knurling: a whole number of teeth has to fit around the blank.
    knurl() {
      const W = 520, H = 250, cx = 128, cy = 118, R = 78, N = 36, th = 5;
      let d = '';
      for (let i = 0; i < N; i++) {
        const a0 = i * 2 * Math.PI / N, a1 = (i + 0.5) * 2 * Math.PI / N;
        d += (i ? 'L' : 'M') + f(cx + R * Math.cos(a0)) + ' ' + f(cy - R * Math.sin(a0)) + 'L' + f(cx + (R - th) * Math.cos(a1)) + ' ' + f(cy - (R - th) * Math.sin(a1));
      }
      let s = DK.path(d + 'Z', 'part') + DK.cl(cx - R - 14, cy, cx + R + 14, cy) + DK.cl(cx, cy - R - 14, cx, cy + R + 14);
      // Knurl wheel touching at the right.
      const wr = 32, wx = cx + R + wr - 3, wn = 15;
      let wd = '';
      for (let i = 0; i < wn; i++) {
        const a0 = i * 2 * Math.PI / wn, a1 = (i + 0.5) * 2 * Math.PI / wn;
        wd += (i ? 'L' : 'M') + f(wx + wr * Math.cos(a0 + Math.PI)) + ' ' + f(cy - wr * Math.sin(a0 + Math.PI)) + 'L' + f(wx + (wr - th) * Math.cos(a1 + Math.PI)) + ' ' + f(cy - (wr - th) * Math.sin(a1 + Math.PI));
      }
      s += DK.path(wd + 'Z', 'tool') + DK.circle(wx, cy, 5, 'part') + DK.text(wx, cy - wr - 10, 'knurl wheel', { cls: 'hott' });
      s += DK.dim(cx - R, cy + R + 20, cx + R, cy + R + 20, 'blank Ø  D', { below: true }) + DK.line(cx - R, cy + 6, cx - R, cy + R + 25, 'dim ext') + DK.line(cx + R, cy + 38, cx + R, cy + R + 25, 'dim ext');
      // One pitch along the rim.
      const pa = 2 * Math.PI / N, aa = 2 * Math.PI * 5 / N;
      s += DK.leader(cx + (R + 2) * Math.cos(aa + pa / 2), cy - (R + 2) * Math.sin(aa + pa / 2), cx + R + 16, 26, 'pitch p, measured around the rim', { hot: true, anchor: 'start' });
      s += DK.text(318, 142, 'π × D = N × p', { cls: 'txt', anchor: 'start', size: 14 });
      s += notes('N must be a whole number of teeth, or the wheel lands between its own marks (double tracking).', 318, 162, 28);
      return DK.svg(W, H, s, 'Knurling: a whole number of teeth of pitch p around the blank diameter');
    },
  });
})();
