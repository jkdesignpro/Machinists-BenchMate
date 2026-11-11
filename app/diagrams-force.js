'use strict';
// Drawings for the cutting force tools (cutforce.js), in the drawing-kit style (dk.js).
// Every number written on a drawing is an input (v) or a result row computed by the Rust core.
// Curves are drawn from core values (state.W); the JS here only places things.
Object.assign(DIAGRAMS, {
  // Specific cutting force against chip thickness for the chosen material group, with this cut marked.
  kcforce(v, sys, rows) {
    const W = 520, H = 250, x0 = 70, x1 = 480, y0 = 200, y1 = 36, g = kcGroup(v.grp), core = state.W;
    let s = DK.line(x0, y0, x1, y0, 'ln') + DK.line(x0, y0, x0, y1 - 8, 'ln');
    s += DK.text(x0 - 8, y1 - 12, 'kc', { cls: 'mut', anchor: 'end' }) + DK.text((x0 + x1) / 2, y0 + 16, 'chip thickness', { cls: 'mut' });
    if (!g || !core) return DK.svg(W, H, s + DK.text(260, 120, 'kc = kc1.1 × h^(-mc)', { cls: 'mut' }), 'Specific cutting force against chip thickness');
    const hu = dcRow(rows, 'Chip thickness used'), h = dcOk(hu) ? (sys === 'inch' ? hu * 25.4 : hu) : NaN, kc = dcRow(rows, 'Specific cutting force kc at');
    const hmax = Math.max(1, dcOk(h) ? h * 1.15 : 1), hmin = 0.02, mc = g[6] == null ? 0 : g[6];
    const top = core.kienzle_kc(g[5], mc, hmin) * 1.05, X = x => x0 + (x1 - x0) * x / hmax, Y = k => y0 - (y0 - y1) * k / top, pts = [];
    for (let i = 0; i <= 60; i++) { const x = hmin + (hmax - hmin) * i / 60; pts.push([X(x), Y(core.kienzle_kc(g[5], mc, x))]); }
    s += DK.path('M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L'), 'ln');
    const xk = X(1), yk = Y(g[5]);
    s += DK.line(xk, y0, xk, yk, 'dim ext') + DK.circle(xk, yk, 3, 'dimf') + DK.text(xk, y0 + 14, sys === 'inch' ? '1 mm (0.0394 in)' : '1 mm', { cls: 'dimt' }) + DK.text(xk - 6, yk - 8, 'kc1.1 ' + g[5], { cls: 'dimt', anchor: 'end' });
    if (dcOk(h) && dcOk(kc)) {
      const xp = X(h), yp = Y(Math.min(kc, top));
      s += DK.line(xp, y0, xp, yp, 'hot') + DK.line(x0, yp, xp, yp, 'hot') + DK.circle(xp, yp, 4, 'hotf');
      s += DK.text(Math.min(xp + 8, x1 - 150), Math.max(yp - 8, y1 + 4), 'kc ' + DK.n(kc, 0) + ' N/mm² at ' + DK.n(hu, sys === 'inch' ? 4 : 3) + ' ' + dcU(sys), { cls: 'hott', anchor: 'start' });
    }
    s += DK.text(x0 + 6, H - 8, g[1] + g[0] + ': ' + g[2] + (g[6] == null ? '. No mc printed: kc1.1 is used unchanged.' : '. Thinner chips need more force per mm².'), { cls: 'mut', anchor: 'start' });
    return DK.svg(W, H, s, 'Specific cutting force against chip thickness for the material group, with this cut marked');
  },

  // Drill in the work: torque about the axis, thrust along it.
  drillforce(v, sys, rows) {
    const W = 520, H = 260, cx = 250, hw = 30, ys = 170, u = dcU(sys);
    const pt = dcOk(v.pt) ? dcClamp(v.pt, 60, 180) : 140, tip = ys + Math.min(52, hw / Math.tan(dcRad(pt / 2)));
    let s = DK.poly([[130, 150], [cx - hw, 150], [cx - hw, ys], [cx, tip], [cx, 244], [130, 244]], 'hatch') + DK.poly([[370, 150], [cx + hw, 150], [cx + hw, ys], [cx, tip], [cx, 244], [370, 244]], 'hatch');
    s += DK.poly([[cx - hw, 44], [cx + hw, 44], [cx + hw, ys], [cx, tip], [cx - hw, ys]], 'tool');
    for (let y = 60; y < ys - 10; y += 34) s += DK.line(cx - hw, y + 26, cx + hw, y, 'thin');
    s += DK.cl(cx, 14, cx, 252);
    s += DK.dimH(cx - hw, cx + hw, 30, 'D ' + dcL(v.d, u, ''), { from: 44 });
    s += dcSpin(cx, 92, 62, 16, 205, 335, 'hot');
    const tq = (rows || []).find(r => r.label === 'Torque'), ff = (rows || []).find(r => r.label.indexOf('Feed force') === 0);
    s += DK.text(cx + 76, 96, tq && typeof tq.value === 'number' ? 'torque ' + DK.n(tq.value, tq.dp) + ' ' + tq.unit : 'torque', { cls: 'hott', anchor: 'start' });
    s += DK.arrow(cx - 70, 70, cx - 70, 140, 'hot') + DK.text(cx - 78, 100, ff && typeof ff.value === 'number' ? 'thrust ' + DK.n(ff.value, 0) + ' ' + ff.unit : 'thrust', { cls: 'hott', anchor: 'end' });
    s += DK.text(378, 200, 'point ' + dcL(v.pt, '°', '').replace(' °', '°'), { cls: 'dimt', anchor: 'start' });
    s += DK.text(122, 200, 'feed ' + dcL(v.f, sys === 'inch' ? 'in/rev' : 'mm/rev', 'fn'), { cls: 'dimt', anchor: 'end' });
    return DK.svg(W, H, s, 'Drill in the work with the torque about its axis and the thrust along it');
  },

  // Tap in a hole: torque about the axis.
  taptorque(v, sys, rows) {
    const W = 520, H = 250, cx = 250, hw = 26, u = dcU(sys);
    let s = DK.rect(130, 120, cx - hw - 130, 110, 'hatch') + DK.rect(cx + hw, 120, 370 - cx - hw, 110, 'hatch');
    s += DK.rect(cx - 15, 22, 30, 40, 'tool') + DK.rect(cx - hw, 62, 2 * hw, 150, 'tool');
    for (let y = 70; y < 206; y += 9) s += DK.line(cx - hw, y + 5, cx + hw, y, 'thin');
    s += DK.cl(cx, 10, cx, 240);
    s += dcSpin(cx, 44, 50, 13, 205, 335, 'hot');
    const tq = (rows || []).find(r => r.label.indexOf('Torque') === 0 && typeof r.value === 'number');
    s += DK.text(cx + 64, 48, tq ? 'torque ' + DK.n(tq.value, tq.dp) + ' ' + tq.unit : 'torque Md', { cls: 'hott', anchor: 'start' });
    const p = dcRow(rows, 'Pitch');
    s += DK.text(380, 166, 'd ' + dcL(v.d, u, ''), { cls: 'dimt', anchor: 'start' }) + DK.text(380, 184, sys === 'inch' ? dcL(v.tpi, 'tpi', 'tpi', 0) : 'P ' + dcL(v.p, 'mm', ''), { cls: 'dimt', anchor: 'start' });
    s += DK.text(18, H - 8, v.kind === 2 ? 'Forming tap: T = Kf × d × P² / 1000' : 'Cutting tap: Md = kc × P² × d / 8000' + (dcOk(p) && sys === 'inch' ? '  (P ' + DK.n(p, 4) + ' mm)' : ''), { cls: 'mut', anchor: 'start' });
    return DK.svg(W, H, s, 'Tap in a hole with the torque about its axis');
  },

  // Chip between two passes of the cutting edge: a straight edge at the entering angle, or a round insert.
  leadthin(v, sys, rows) {
    const W = 520, H = 250, u = dcU(sys), floor = 190, fzT = dcOk(v.fz) ? v.fz : dcRow(rows, 'Feed per tooth for that chip'), hexT = dcOk(v.hex) ? v.hex : dcRow(rows, 'Largest chip thickness'), dp = sys === 'inch' ? 4 : 3;
    const fzL = 'fz ' + dcL(fzT, u, '', dp), hexL = 'hex ' + dcL(hexT, u, '', dp);
    let s = '';
    if (v.kind === 2) {
      const R = 150, cx = 210, cy = floor - R, f = 64, apPx = dcOk(v.ap) && dcOk(v.ic) ? dcClamp(v.ap / v.ic * 2 * R, 30, R) : 0.4 * R, top = floor - apPx, ka = Math.acos((R - apPx) / R);
      const arc = (ox, a0, a1) => { const p = []; for (let i = 0; i <= 24; i++) { const a = a0 + (a1 - a0) * i / 24; p.push([ox + R * Math.sin(a), cy + R * Math.cos(a)]); } return p; };
      const k2 = Math.acos(dcClamp((R - apPx) / R, -1, 1));
      s += DK.poly(arc(cx + f, 0, k2).concat([[470, top], [470, floor]]), 'hatch');
      s += DK.poly(arc(cx, 0, ka).concat(arc(cx + f, k2, 0)), 'tool');
      s += DK.circle(cx + f, cy, R, 'ghost') + DK.path('M' + arc(cx, -0.9, ka + 0.4).map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L'), 'ln');
      s += DK.line(60, floor, 470, floor, 'thin') + DK.line(cx + R * Math.sin(ka), top, 470, top, 'ln');
      const ex = cx + R * Math.sin(ka), ey = cy + R * Math.cos(ka), t = f * Math.sin(ka);
      s += DK.dim(ex, ey, ex + t * Math.sin(ka), ey + t * Math.cos(ka), '', { hot: true }) + DK.text(ex + 14, ey - 12, hexL, { cls: 'hott', anchor: 'start' });
      s += DK.dimH(cx, cx + f, floor + 26, fzL, { from: floor, below: true });
      s += DK.dimV(top, floor, 488, 'ap ' + dcL(v.ap, u, ''), { from: 470 });
      s += DK.leader(cx - R * Math.sin(0.7), cy + R * Math.cos(0.7), 30, 60, 'insert ' + dcL(v.ic, u, 'iC'), { anchor: 'start' });
    } else {
      const kap = dcOk(v.kap) ? dcClamp(v.kap, 8, 90) : 45, k = dcRad(kap), ap = 90, top = floor - ap, f = 76, xa = dcClamp(250 - ap / Math.tan(k) / 2, 90, 250), run = Math.min(ap / Math.tan(k), 300);
      const A = [xa, floor], B = [xa + run, floor - run * Math.tan(k)], A2 = [xa + f, floor], B2 = [B[0] + f, B[1]];
      s += DK.poly([A2, B2, [Math.max(B2[0], 440) + 40, B2[1]], [Math.max(B2[0], 440) + 40, floor]], 'hatch') + DK.poly([A, B, B2, A2], 'tool');
      s += DK.line(60, floor, A2[0], floor, 'thin') + DK.line(A[0], A[1], B[0], B[1], 'ln');
      const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2, t = f * Math.sin(k);
      s += DK.dim(mx, my, mx + t * Math.sin(k), my + t * Math.cos(k), '', { hot: true }) + DK.text(mx - 8, my - 10, hexL, { cls: 'hott', anchor: 'end' });
      s += DK.dimH(A[0], A2[0], floor + 26, fzL, { from: floor, below: true });
      s += DK.angle(A2[0], floor, 34, 0, kap, dcL(v.kap, '°', 'κ').replace(' °', '°'));
      s += DK.arrow(70, 60, 130, 60, 'dim') + DK.text(70, 50, 'feed', { cls: 'mut', anchor: 'start' });
    }
    const fac = dcRow(rows, 'Feed factor');
    s += DK.text(18, H - 6, dcOk(fac) ? 'The feed per tooth is ' + DK.n(fac, 2) + ' × the chip thickness' : 'hex = fz × sin(entering angle)', { cls: 'mut', anchor: 'start' });
    return DK.svg(W, H, s, 'The chip between two passes of the cutting edge, with the feed per tooth and the chip thickness');
  },

  // The part as it comes off the lathe: oversize where it was pushed away (much exaggerated), against the true cylinder.
  slender(v, sys, rows) {
    const W = 520, H = 230, cy = 104, xa = 100, xb = 440, r = 20, sup = v.sup === 1 || v.sup === 2 ? v.sup : 0, core = state.W, n = 40;
    let s = DK.cl(40, cy, 490, cy), up = [], lo = [], imax = 0;
    if (core) {
      const d = [];
      for (let i = 0; i <= n; i++) d.push(core.turn_work_deflection(sup, 1, i / n, 1, 1, 0, 1));
      const m = Math.max(...d); imax = d.indexOf(m);
      for (let i = 0; i <= n; i++) { const x = xa + (xb - xa) * i / n, e = m > 0 ? 16 * d[i] / m : 0; up.push([x, cy - r - e]); lo.push([x, cy + r + e]); }
      s += DK.poly(up.concat(lo.reverse()), 'tool');
    }
    s += DK.rect(xa, cy - r, xb - xa, 2 * r, 'ghost');
    if (sup !== 2) s += DK.rect(46, cy - 46, 54, 92, 'hatch') + DK.text(73, cy + 62, 'chuck', { cls: 'mut' });
    else s += DK.poly([[xa, cy], [xa - 30, cy - 12], [xa - 30, cy + 12]], 'part') + DK.text(xa - 16, cy + 30, 'centre', { cls: 'mut' });
    if (sup !== 0) s += DK.poly([[xb, cy], [xb + 30, cy - 12], [xb + 30, cy + 12]], 'part') + DK.text(xb + 18, cy + 30, 'centre', { cls: 'mut' });
    const xw = xa + (xb - xa) * imax / n, ov = (rows || []).find(x => x.label.indexOf('Diameter comes out oversize') === 0 && typeof x.value === 'number');
    s += DK.arrow(xw, cy + r + 62, xw, cy + r + 20, 'hot') + DK.text(xw, cy + r + 76, 'tool pushes with ' + dcL(v.Fr, sys === 'inch' ? 'lbf' : 'N', 'F'), { cls: 'hott', anchor: xw > 380 ? 'end' : 'middle' });
    s += DK.dimH(xa, xb, 34, 'L ' + dcL(v.L, dcU(sys), ''), { from: cy - r - 18 });
    s += DK.text(xw, cy - r - 24, ov ? 'oversize by ' + DK.n(ov.value, ov.dp) + ' ' + ov.unit + ' here' : 'largest here', { cls: 'hott', anchor: xw > 380 ? 'end' : 'middle' });
    s += DK.text(18, H - 6, 'Shape as turned, much exaggerated. Dashed: the true cylinder.', { cls: 'mut', anchor: 'start' });
    return DK.svg(W, H, s, 'A slender part as turned: oversize where it was pushed away from the tool');
  },
});
