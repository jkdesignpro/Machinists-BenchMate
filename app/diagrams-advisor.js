'use strict';
// Drawings for the speeds and feeds advisor (0.3.0). Layout only: every number shown is an input
// or a value worked out in the Rust core (through the advisor's own run).

// Plan view of an end mill in its cut (feed to the right, climb milling, stock below): cutter, engaged arc, rotation and feed.
function daPlan(cx, cy, r, aeFrac, z, x0, x1, yT, yB) {
  const ae = dcClamp(aeFrac, 0.02, 1) * 2 * r, slot = aeFrac >= 0.999, t1 = Math.asin(dcClamp((r - ae) / r, -1, 1)), yU = cy + r - ae;
  const arc = []; for (let i = 0; i <= 40; i++) { const t = Math.PI / 2 + (t1 - Math.PI / 2) * i / 40; arc.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); }
  const stock = [[x0, cy + r]].concat(arc, slot ? [[x0, cy - r], [x0, yT], [x1, yT], [x1, yB], [x0, yB]] : [[x1, yU], [x1, yB], [x0, yB]]);
  let h = DK.poly(stock, 'hatch') + dcCutter(cx, cy, r, Math.min(z, 12), -Math.PI / 2) + DK.cl(cx - r - 10, cy, cx + r + 10, cy) + DK.cl(cx, cy - r - 10, cx, cy + r + 10);
  h += dcPl(arc, 'hot');
  h += dcSpin(cx, cy, r + 10, r + 10, 150, 30, 'dim');
  return h;
}

Object.assign(DIAGRAMS, {
  // Milling advisor: the section across the feed with the advised width and depth, and the cutter in its cut seen from above.
  advmill(v, sys, rows) {
    const W = 520, H = 300, u = dcU(sys), r = advMillRun(v, state.W, sys);
    if (!r || r.none) return '';
    const k = r.k, d = r.dmm, L = v.L > 0 ? v.L * k : 3 * d, lf = v.lf > 0 ? v.lf * k : 0, dsh = v.dsh > 0 ? v.dsh * k : d;
    const s = Math.min(150 / L, 60 / d), Lp = L * s, dp = Math.max(12, d * s), rr = dp / 2, lfp = Math.min(lf * s, Lp), dsp = Math.max(10, dsh * s);
    const cx = 104, y0 = 62, yt = y0 + Lp, aep = dcClamp(r.ae * s, 2, dp), app = dcClamp(r.ap * s, 2, Lp - 6), xw = cx + rr, top = yt - app, xr = xw + 50, yb = yt + 24;
    let h = DK.poly([[cx - rr - 34, yt], [xw, yt], [xw, top], [xr, top], [xr, yb], [cx - rr - 34, yb]], 'hatch');
    h += dcHolder(cx, y0, Math.max(dp, dsp) + 50, 32) + dcEndMill(cx, y0, Lp, dp, lfp, dsp) + DK.cl(cx, y0 - 38, cx, yb + 6);
    h += DK.rect(xw - aep, top, aep, app, 'hatch') + DK.rect(xw - aep, top, aep, app, 'hot');
    h += dcDimV(y0, yt, cx - rr - 46, 'L ' + dcL(L / k, u, 'L'), { from: cx - Math.max(rr, dsp / 2) - 3 });
    h += DK.dimH(xw - aep, xw, top - 16, '', { from: top }) + DK.text(xw + 6, top - 20, 'ae ' + dcL(r.ae / k, u, ''), { cls: 'dimt', anchor: 'start' });
    h += dcDimV(top, yt, xr + 14, 'ap ' + dcL(r.ap / k, u, ''), { from: xr + 2 });
    h += DK.text(14, H - 8, 'Section across the feed', { cls: 'mut', anchor: 'start' });
    // plan view
    const px = 378, py = 104, pr = 44;
    h += daPlan(px, py, pr, r.ae / d, v.z, px - pr - 54, px + pr + 60, py - pr - 22, py + pr + 26);
    h += DK.arrow(px + pr + 24, py - 18, px + pr + 62, py - 18, 'hot') + DK.text(px + pr + 43, py - 26, 'feed', { cls: 'mut' });
    h += DK.text(290, H - 8, 'From above: the arc in the cut', { cls: 'mut', anchor: 'start' });
    const lines = ['feed ' + dcN(r.vf / k) + ' ' + dcFU(sys), 'per tooth ' + dcN(r.fz / k) + ' ' + u, 'largest chip ' + dcN(r.hex / k) + ' ' + u];
    h += DK.text(290, 196, dcN(r.rpm, 0) + ' RPM', { cls: 'hott', anchor: 'start' }) + dcLines(290, 214, lines, { cls: 'txt' });
    const lim = ADV_LIMITS[r.limit];
    h += dcLines(290, 268, [lim ? 'limited by ' + lim.toLowerCase() : 'no limit reached']);
    return DK.svg(W, H, h, 'Milling advisor: the advised width and depth of cut on the tool, and the cutter in its cut seen from above');
  },
  // Drilling advisor: the drill in the hole with the depth and point length, speed and feed.
  advdrill(v, sys, rows) {
    const r = advDrillRun(v, state.W, sys);
    if (!r || r.none) return '';
    return daHole(v, sys, r, false);
  },
  // Reaming advisor: the reamer in a drilled hole, with the stock it removes.
  advream(v, sys, rows) {
    const r = advReamRun(v, state.W, sys);
    if (!r) return '';
    return daHole(v, sys, r, true);
  },
  // Tapping advisor: the tap in its hole with the thread depth, the spindle speed and the feed that goes with it.
  advtap(v, sys, rows) {
    const r = advTapRun(v, state.W, sys);
    if (!r || r.none) return '';
    const W = 520, H = 280, u = dcU(sys), k = r.k, cx = 180, xl = cx - 140, xr = cx + 140, hw = 28, top = 110, bot = 206;
    let s = DK.rect(xl, top, cx - hw - xl, 262 - top, 'hatch') + DK.rect(cx + hw, top, xr - cx - hw, 262 - top, 'hatch');
    s += DK.rect(cx - 15, 28, 30, 44, 'tool') + DK.poly([[cx - hw, 72], [cx + hw, 72], [cx + hw, bot - 10], [cx + hw - 8, bot], [cx - hw + 8, bot], [cx - hw, bot - 10]], 'tool');
    for (let y = 78; y < bot - 14; y += 9) s += DK.line(cx - hw, y + 5, cx + hw, y, 'thin');
    s += DK.cl(cx, 8, cx, 270) + DK.dimH(cx - hw, cx + hw, 18, 'Ø ' + dcL(v.d, u, 'd'), { from: 28 });
    if (dcOk(v.depth)) s += dcDimV(top, bot, xr + 18, 'depth ' + dcL(v.depth, u, ''), { from: cx + hw + 2 });
    s += dcSpin(cx, 52, 56, 14, 205, 335, 'hot') + DK.text(cx + 70, 56, dcN(r.rpm, 0) + ' RPM', { cls: 'hott', anchor: 'start' });
    s += DK.arrow(cx - 78, 44, cx - 78, 96, 'hot') + DK.text(cx - 86, 66, 'feed ' + dcN(r.vf / k), { cls: 'hott', anchor: 'end' }) + DK.text(cx - 86, 82, dcFU(sys), { cls: 'hott', anchor: 'end' });
    const lim = ADV_LIMITS[r.limit];
    s += dcLines(xr + 42, 214, [sys === 'inch' ? dcL(v.tpi, 'tpi', '', 0) : 'pitch ' + dcL(v.p, 'mm', ''), 'feed = pitch x speed', lim ? 'limit: ' + lim.toLowerCase() : ''], { cls: 'txt' });
    return DK.svg(W, H, s, 'Tap in its hole with the thread depth, the spindle speed and the feed rate of one pitch per revolution');
  },
  // Turning advisor: the bar in the chuck with the depth of cut, the feed and the diameter being cut.
  advturn(v, sys, rows) {
    const W = 520, H = 270, u = dcU(sys), r = advTurnRun(v, state.W, sys);
    if (!r || r.none) return '';
    const k = r.k, cy = 118, R = 52, x0 = 70, xe = 400, xs = 230, cut = dcClamp(r.ap / r.dmm * 2 * R * 2.2, 6, R * 0.55);
    let h = dcChuck(x0, cy, R) + DK.rect(x0, cy - R, xs - x0, 2 * R, 'part') + DK.rect(xs, cy - R + cut, xe - xs, 2 * (R - cut), 'part') + DK.cl(x0 - 44, cy, xe + 46, cy);
    h += DK.rect(xs, cy - R, xe - xs, cut, 'ghost');
    h += dcInsert(xs, cy - R + cut, 34, 1, 44);
    h += dcDimV(cy - R, cy + R, x0 - 58, 'Ø ' + dcL(v.d, u, 'D'), { from: x0 - 38 });
    h += DK.dimV(cy - R + cut, cy - R, xe + 18, '', { from: xe + 2, hot: true }) + DK.text(xe + 26, cy - R + cut / 2 + 4, 'ap ' + dcN(r.ap / k) + ' ' + u, { cls: 'hott', anchor: 'start' });
    h += DK.arrow(xs + 70, cy + R + 22, xs + 8, cy + R + 22, 'hot') + DK.text(xs + 76, cy + R + 26, 'feed ' + dcN(r.f / k) + ' ' + (sys === 'inch' ? 'in/rev' : 'mm/rev'), { cls: 'hott', anchor: 'start' });
    h += dcTurnSpin(xe + 30, cy + 12, R - 26);
    const lim = ADV_LIMITS[r.limit];
    h += DK.text(20, 232, dcN(r.rpm, 0) + ' RPM', { cls: 'hott', anchor: 'start' });
    h += dcLines(20, 250, [dcN(r.inch ? r.vcA / 0.3048 : r.vcA, 0) + ' ' + dcSU(sys) + ' at the diameter' + (lim ? ', limited by ' + lim.toLowerCase() : '') + (r.over ? ': over the limit' : '')]);
    h += DK.text(W - 14, 250, 'Depth of cut drawn larger than scale', { cls: 'mut', anchor: 'end' });
    return DK.svg(W, H, h, 'Turning advisor: the bar in the chuck with the depth of cut, the feed and the spindle speed');
  },
});

// A drill or reamer in its hole: diameter, depth, point length (drill), stock (reamer), speed and feed. Numbers from the advisor run.
function daHole(v, sys, r, ream) {
  const W = 520, H = 280, u = dcU(sys), k = r.k, cx = ream ? 170 : 210, xl = cx - 140, xr = cx + 140, hw = 30, top = 110, dep = 96, bot = top + dep, core = state.W;
  const pt = ream ? 180 : dcClamp(r.pt, 60, 180), tipH = ream ? 0 : Math.min(46, hw / Math.tan(dcRad(pt / 2))), fr = sys === 'inch' ? 'in/rev' : 'mm/rev';
  let s = '';
  if (ream) {
    // above the end of the reamer the hole is to size; below it the drilled hole is still smaller by the stock (drawn larger than scale)
    const hs = hw - 6, ye = bot - 20;
    s += DK.poly([[xl, top], [cx - hw, top], [cx - hw, ye], [cx - hs, ye], [cx - hs, 262], [xl, 262]], 'hatch') + DK.poly([[xr, top], [cx + hw, top], [cx + hw, ye], [cx + hs, ye], [cx + hs, 262], [xr, 262]], 'hatch');
    s += DK.rect(cx - hw * 0.7, 30, 1.4 * hw, top - 40, 'tool') + DK.poly([[cx - hw, top - 10], [cx - hw, ye - 7], [cx - hs, ye], [cx + hs, ye], [cx + hw, ye - 7], [cx + hw, top - 10]], 'tool');
    for (let x = cx - hw + 10; x < cx + hw - 4; x += 12) s += DK.line(x, top - 10, x, ye - 2, 'thin');
    s += DK.leader(cx + hs + 3, ye + 16, xr + 22, ye + 34, 'stock for the reamer', { anchor: 'start' });
    const st = r.st, sh = x => dcN(sys === 'inch' ? x : x * 25.4);
    s += dcLines(xr + 22, ye + 52, [st ? sh(st[1]) + ' to ' + sh(st[2]) + ' ' + u + ' on Ø (ICS)' : '', 'about ' + dcN(r.stock3 / k) + ' ' + u + ' on Ø (Gammons)']);
    if (!r.none) s += dcLines(xr + 22, 108, ['feed rate ' + dcN(r.vf / k) + ' ' + dcFU(sys)], { cls: 'txt' });
    s += DK.text(xl, 276, 'Stock drawn larger than scale', { cls: 'mut', anchor: 'start' });
  } else {
    s += DK.poly([[xl, top], [cx - hw, top], [cx - hw, bot], [cx, bot + tipH], [cx, 262], [xl, 262]], 'hatch') + DK.poly([[xr, top], [cx + hw, top], [cx + hw, bot], [cx, bot + tipH], [cx, 262], [xr, 262]], 'hatch');
    s += DK.poly([[cx - hw, 30], [cx + hw, 30], [cx + hw, bot], [cx, bot + tipH], [cx - hw, bot]], 'tool');
    for (let y = 44; y < bot - 10; y += 34) s += DK.line(cx - hw, y + 26, cx + hw, y, 'thin');
    if (dcOk(v.depth)) s += dcDimV(top, bot, xr + 18, 'depth ' + dcL(v.depth, u, ''), { from: cx + hw + 2 });
    const pl = core.drill_point_length(r.dmm, r.pt);
    if (tipH > 4) s += dcDimV(bot, bot + tipH, 44, '', { from: cx - hw - 2 }) + DK.text(52, bot + tipH + 18, 'point ' + dcN(pl / k) + ' ' + u, { cls: 'dimt', anchor: 'start' });
    s += dcLines(xr + 42, 232, ['feed rate ' + dcN(r.vf / k) + ' ' + dcFU(sys), isFinite(r.tq) ? 'torque ' + dcN(sys === 'inch' ? r.tq * NM_LBFIN : r.tq) + (sys === 'inch' ? ' lbf in' : ' N m') : '', isFinite(r.thrust) ? 'thrust ' + dcN(sys === 'inch' ? r.thrust / LBF_N : r.thrust, 0) + (sys === 'inch' ? ' lbf' : ' N') : ''], { cls: 'txt' });
  }
  s += DK.cl(cx, 8, cx, 268);
  s += DK.dimH(cx - hw, cx + hw, 18, 'Ø ' + dcL(v.d, u, 'D'), { from: 30 });
  if (!r.none) {
    s += dcSpin(cx, 66, 60, 15, 205, 335, 'hot') + DK.text(cx + 74, 70, dcN(r.rpm, 0) + ' RPM', { cls: 'hott', anchor: 'start' });
    s += DK.arrow(cx - 78, 44, cx - 78, 96, 'hot') + DK.text(cx - 86, 66, 'feed ' + dcN(r.f / k), { cls: 'hott', anchor: 'end' }) + DK.text(cx - 86, 82, fr, { cls: 'hott', anchor: 'end' });
  }
  return DK.svg(W, H, s, ream ? 'Reamer in a drilled hole with the stock it removes, the spindle speed and the feed' : 'Drill in the hole with the depth, the point length, the spindle speed and the feed');
}
