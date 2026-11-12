'use strict';
// Drawings for the cutting calculators: speeds and feeds, milling, turning, sawing,
// drilling and grinding (see dk.js for the kit, diagrams.js for the style).
// Every number written on a drawing is an input (v) or a result row computed by
// the Rust core; the JS here only works out where to draw things.

// ---- shared helpers (dc...) ----
const dcU = s => (s === 'inch' ? 'in' : 'mm');
const dcFU = s => (s === 'inch' ? 'in/min' : 'mm/min');
const dcSU = s => (s === 'inch' ? 'SFM' : 'm/min');
const dcOk = x => typeof x === 'number' && isFinite(x) && x > 0;
const dcClamp = (x, a, b) => Math.max(a, Math.min(b, x));
const dcRad = d => d * Math.PI / 180;
// A number for a label with about four significant figures (trailing zeros trimmed).
const dcN = (x, dp) => DK.n(x, dp !== undefined ? dp : (x === 0 ? 0 : dcClamp(3 - Math.floor(Math.log10(Math.abs(x))), 0, 6)));
// Value with its unit, or the letter symbol when blank.
const dcL = (x, u, sym, dp) => (dcOk(x) ? dcN(x, dp) + (u ? ' ' + u : '') : sym);
const dcUnit = u => String(u || '').replace(/(in|cm|mm)3/g, '$1³').replace(/(in|cm|mm)2/g, '$1²');
// A numeric result row by the start of its label (and its unit, when given).
const dcRow = (rows, label, unit) => {
  const r = (rows || []).find(x => x.label.indexOf(label) === 0 && (unit === undefined || x.unit === unit) && typeof x.value === 'number' && isFinite(x.value));
  return r ? r.value : NaN;
};
const dcStr = (rows, label) => { const r = (rows || []).find(x => x.label.indexOf(label) === 0 && typeof x.value === 'string'); return r ? r.value : ''; };
const dcHead = (x, y, ang, cls) => {
  const L = 8, W = 2.6, c = Math.cos(ang), s = Math.sin(ang), bx = x - L * c, by = y - L * s;
  return DK.poly([[x, y], [bx - W * s, by + W * c], [bx + W * s, by - W * c]], cls);
};
// Rotation arrow: elliptical arc from a0 to a1 (degrees, anticlockwise on screen), head at a1. cls: dim | hot.
function dcSpin(cx, cy, rx, ry, a0, a1, cls) {
  cls = cls || 'dim';
  const N = 24, pts = [];
  for (let i = 0; i <= N; i++) { const t = dcRad(a0 + (a1 - a0) * i / N); pts.push([cx + rx * Math.cos(t), cy - ry * Math.sin(t)]); }
  const t1 = dcRad(a1), dir = a1 > a0 ? 1 : -1;
  const ang = Math.atan2(-ry * Math.cos(t1) * dir, -rx * Math.sin(t1) * dir);
  const end = pts[N], cut = [end[0] - 5 * Math.cos(ang), end[1] - 5 * Math.sin(ang)];
  pts[N] = cut;
  return '<path class="' + cls + '" d="M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L') + '"/>' + dcHead(end[0], end[1], ang, cls + 'f');
}
// Milling cutter seen along its axis: z teeth, turning clockwise (M03 seen from the spindle).
function dcCutter(cx, cy, r, z, rot) {
  z = dcClamp(Math.round(z) || 4, 1, 72);
  // Screen angles grow clockwise (y down), so the cutter turns towards +angle.
  // Going round: land on the rim behind each tip, the tip, the cutting face down
  // into the flute, then the flute curving back up to the next land.
  const step = 2 * Math.PI / z, land = step * (z > 12 ? 0.45 : 0.42), core = z > 12 ? 1 - Math.min(0.16, 0.45 * step) : (z > 2 ? 0.7 : 0.6), pts = [];
  const P = (rr, t) => [cx + r * rr * Math.cos(t), cy + r * rr * Math.sin(t)];
  for (let i = 0; i < z; i++) {
    const a = (rot || 0) + i * step;
    for (let j = 0; j <= 4; j++) pts.push(P(z > 12 ? 1 - 0.04 * j / 4 : 1, a - land + land * j / 4));
    const fl = step - land, N = 10;
    for (let j = 1; j <= N; j++) {
      const s = j / N, t = a + fl * s, depth = s < 0.25 ? (1 - core) * Math.sin(s / 0.25 * Math.PI / 2) : (1 - core) * Math.cos((s - 0.25) / 0.75 * Math.PI / 2);
      pts.push(P(1 - depth, t));
    }
  }
  return DK.poly(pts, 'tool') + DK.circle(cx, cy, r, 'ghost') + DK.circle(cx, cy, Math.max(2, r * 0.12), 'thin');
}
// Points of a circle (screen coords) for which keep(p) is true, as runs of polylines.
function dcArcRuns(cx, cy, r, keep, n) {
  n = n || 360; const runs = []; let cur = null;
  for (let i = 0; i <= n; i++) {
    const t = 2 * Math.PI * i / n, p = [cx + r * Math.cos(t), cy + r * Math.sin(t)];
    if (keep(p)) { if (!cur) { cur = []; runs.push(cur); } cur.push(p); } else cur = null;
  }
  if (runs.length > 1 && keep([cx + r, cy])) { const last = runs.pop(); runs[0] = last.concat(runs[0]); }
  return runs;
}
const dcPl = (pts, cls) => (pts.length > 1 ? '<path class="' + (cls || 'ln') + '" d="M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L') + '"/>' : '');
// Lines of muted (or other) text, starting at (x, y).
// Vertical dimension from yTop down to yBot at x (extension lines from o.from). DK.dimV puts the
// offset on the wrong side when y1 < y2, so it is always called bottom-to-top here.
const dcDimV = (yTop, yBot, x, text, o) => DK.dimV(Math.max(yTop, yBot), Math.min(yTop, yBot), x, text, o);
// Split a sentence into lines of at most n characters.
const dcWrap = (t, n) => { const out = []; let cur = ''; String(t || '').split(' ').forEach(w => { if (cur && (cur + ' ' + w).length > n) { out.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; }); if (cur) out.push(cur); return out; };
const dcLines = (x, y, lines, o) => lines.filter(Boolean).map((t, i) => DK.text(x, y + i * 16, t, Object.assign({ cls: 'mut', anchor: 'start' }, o || {}))).join('');
// Hot result text with a muted caption under it.
const dcResult = (x, y, val, cap, anchor) => DK.text(x, y, val, { cls: 'hott', anchor: anchor || 'start' }) + (cap ? DK.text(x, y + 15, cap, { cls: 'mut', anchor: anchor || 'start' }) : '');
// Vertical end mill: shank from y0 (holder face) to the tip at y0 + L, flutes over lf at the bottom.
function dcEndMill(cx, y0, L, d, lf, dsh, ball) {
  const r = d / 2, rs = (dsh || d) / 2, yt = y0 + L, yf = yt - dcClamp(lf || 0, 0, L);
  let h = DK.rect(cx - rs, y0, 2 * rs, yf - y0 + (lf > 0 ? 0 : L - (yf - y0)), 'tool');
  if (lf > 0) {
    h += ball ? DK.path('M' + (cx - r) + ' ' + yf + 'L' + (cx - r) + ' ' + (yt - r) + 'A' + r + ' ' + r + ' 0 0 0 ' + (cx + r) + ' ' + (yt - r) + 'L' + (cx + r) + ' ' + yf + 'Z', 'tool')
      : DK.rect(cx - r, yf, 2 * r, yt - yf, 'tool');
    const pitch = Math.max(10, 1.6 * r);
    for (let y = yf + 4; y < yt - (ball ? r : 2); y += pitch * 0.5) {
      const y2 = Math.min(y + pitch * 0.5, yt - (ball ? r : 2));
      h += DK.line(cx - r + 1, y, cx + r - 1, y2 - (y2 - y) * 0.1, 'thin');
    }
  }
  return h;
}
// Tool holder (collet nose) above a holder face at y0, hatched.
const dcHolder = (cx, y0, w, h) => DK.poly([[cx - w / 2, y0 - h], [cx + w / 2, y0 - h], [cx + w / 2, y0 - h * 0.35], [cx + w * 0.34, y0], [cx - w * 0.34, y0], [cx - w / 2, y0 - h * 0.35]], 'hatch');

Object.assign(DIAGRAMS, {
  // ---------------- Speeds and feeds ----------------
  // Milling feed: the cutter in a slot seen from above, its teeth, rotation and the table feed; a detail of the tooth marks fz apart.
  feed(v, sys, rows) {
    const W = 520, H = 250, u = dcU(sys), z = dcOk(v.z) ? Math.round(v.z) : 4;
    const vf = dcOk(dcRow(rows, 'Table feed')) ? dcRow(rows, 'Table feed') : v.vf;
    const fz = dcOk(v.fz) ? v.fz : dcRow(rows, 'Feed per tooth');
    const cx = 175, cy = 128, r = 58, top = 46, bot = 210;
    let h = DK.path('M16 ' + top + 'H300V' + bot + 'H16V' + (cy + r) + 'H' + cx + 'A' + r + ' ' + r + ' 0 0 0 ' + cx + ' ' + (cy - r) + 'H16Z', 'hatch');
    h += dcCutter(cx, cy, r, Math.min(z, 16), -Math.PI / 2) + DK.cl(cx - r - 12, cy, cx + r + 12, cy) + DK.cl(cx, cy - r - 12, cx, cy + r + 12);
    h += dcSpin(cx, cy, r + 14, r + 14, 150, 30, 'dim') + DK.text(cx, top - 18, (dcOk(v.rpm) ? dcN(v.rpm, 0) + ' RPM' : 'n') + ', ' + (z > 16 ? z + ' teeth (16 drawn)' : z + (z === 1 ? ' tooth' : ' teeth')), { cls: 'dimt' });
    h += DK.arrow(312, cy, 372, cy, 'hot') + DK.text(312, cy - 10, 'feed', { cls: 'mut', anchor: 'start' });
    h += dcResult(312, cy + 24, dcL(vf, dcFU(sys), 'Vf'), 'table feed');
    // Detail: the wall left by successive teeth, each fz further on (enlarged): scallops.
    const dx = 40, R = 24, x0 = 396, x1 = 506, cyc = 70, yb = cyc + R, n = 4, c0 = 386;
    h += DK.text((x0 + x1) / 2 - 6, 26, 'wall, enlarged', { cls: 'mut' });
    const env = [];
    for (let x = x0; x <= x1 + 0.01; x += 1) {
      let y = -1e9;
      for (let i = 0; i < n; i++) { const d = x - (c0 + i * dx); if (Math.abs(d) < R) y = Math.max(y, cyc + Math.sqrt(R * R - d * d)); }
      env.push([x, y]);
    }
    h += DK.poly(env.concat([[x1, yb + 30], [x0, yb + 30]]), 'hatch');
    for (let i = 0; i < n; i++) {
      const c = c0 + i * dx, a = Math.acos(dcClamp((x0 - c) / R, -1, 1)), b = Math.acos(dcClamp((x1 - c) / R, -1, 1)), pts = [];
      for (let j = 0; j <= 30; j++) { const t = b + (a - b) * j / 30; pts.push([c + R * Math.cos(t), cyc + R * Math.sin(t)]); }
      if (i === 2) h += dcPl(pts, 'hot');
    }
    h += DK.dimH(c0 + dx, c0 + 2 * dx, yb + 46, 'fz ' + dcL(fz, u, '', undefined), { from: yb + 2 });
    h += dcLines(x0 - 10, yb + 84, ['Each tooth cuts fz', 'further on; z teeth', 'per turn.']);
    h += DK.text(300, H - 10, 'Vf = n × z × fz', { cls: 'mut', anchor: 'end' });
    return DK.svg(W, H, h, 'Milling feed: cutter, teeth, rotation and table feed');
  },
});

// Ring between radii r1 < r2 (hatched material round a hole).
const dcRing = (cx, cy, r1, r2, cls) => DK.path('M' + (cx + r2) + ' ' + cy + 'A' + r2 + ' ' + r2 + ' 0 1 0 ' + (cx - r2) + ' ' + cy + 'A' + r2 + ' ' + r2 + ' 0 1 0 ' + (cx + r2) + ' ' + cy + 'Z' +
  'M' + (cx + r1) + ' ' + cy + 'A' + r1 + ' ' + r1 + ' 0 1 1 ' + (cx - r1) + ' ' + cy + 'A' + r1 + ' ' + r1 + ' 0 1 1 ' + (cx + r1) + ' ' + cy + 'Z', cls || 'hatch');
// Pocket corner (world coords, y up): inside the outline whose bottom wall is y = -R, right wall x = R, corner arc radius R about the origin.
const dcInCorner = (x, y, R) => (x > 0 && y < 0 ? Math.hypot(x, y) <= R : x > 0 ? x <= R : y < 0 ? y >= -R : true);
// That outline from (xl, -R) along the bottom, round the arc and up to (R, yt), as world points.
const dcCornerPath = (R, xl, yt) => { const p = [[xl, -R], [0, -R]]; for (let i = 1; i < 30; i++) { const t = -Math.PI / 2 + Math.PI / 2 * i / 30; p.push([R * Math.cos(t), R * Math.sin(t)]); } p.push([R, 0], [R, yt]); return p; };

Object.assign(DIAGRAMS, {
  // ---------------- Milling ----------------
  // Arc feed: inside and outside arc side by side, the tool on each, edge feed Fe and tool-centre feed Fc as arrows to length.
  arcfeed(v, sys, rows) {
    const W = 520, H = 300, u = dcU(sys), fu = dcFU(sys), R = v.R, r = v.d / 2, ok = dcOk(R) && dcOk(r);
    const fin = dcRow(rows, 'Internal arc: tool-centre feed'), fex = dcRow(rows, 'External arc: tool-centre feed');
    const kin = dcRow(rows, 'Internal arc: ratio'), kex = dcRow(rows, 'External arc: ratio');
    const La = 56, cy = 140;
    let h = DK.text(130, 18, 'Inside arc (pocket)', { cls: 'txt' }) + DK.text(390, 18, 'Outside arc (boss)', { cls: 'txt' });
    // Inside: hole radius 92 px.
    { const cx = 130, Rp = 92, rp = ok ? dcClamp(r / R * Rp, 4, Rp - 2) : 26, tc = cy - Rp + rp;
      h += dcRing(cx, cy, Rp, Rp + 14) + DK.circle(cx, cy, Rp - rp, 'cl') + DK.cl(cx - 8, cy, cx + 8, cy) + DK.cl(cx, cy - 8, cx, cy + 8);
      if (!ok || r < R) {
        h += dcCutter(cx, tc, rp, 4, 0) + DK.dim(cx, cy, cx + Rp * Math.cos(dcRad(150)), cy - Rp * Math.sin(dcRad(150)), 'R ' + dcL(R, u, 'R'), { below: true });
        const lc = dcClamp(La * (dcOk(kin) ? kin : 0.7), 8, 120);
        h += DK.arrow(cx, cy - Rp, cx + La, cy - Rp, 'dim') + DK.text(cx + La + 4, cy - Rp + 4, 'Fe', { cls: 'dimt', anchor: 'start' });
        h += DK.arrow(cx, tc, cx + lc, tc, 'hot') + DK.text(cx + lc + 4, tc + 4, 'Fc', { cls: 'hott', anchor: 'start' });
        h += DK.leader(cx + (Rp - rp) * 0.6, cy + (Rp - rp) * 0.8, cx + 10, cy + 30, 'tool-centre path', { anchor: 'middle' });
        h += dcResult(10, 262, 'Fc ' + dcL(fin, fu, '?'), 'tool centre, Fe × (R − r) / R');
      } else h += DK.text(130, cy + 4, 'tool larger than the arc', { cls: 'mut' });
    }
    // Outside: boss + tool fit 105 px.
    { const cx = 390, s = ok ? 104 / (R + 2 * r) : 1, Rb = ok ? Math.max(10, R * s) : 56, rt = ok ? Math.max(4, r * s) : 24, tc = cy - Rb - rt;
      h += DK.circle(cx, cy, Rb, 'hatch') + DK.circle(cx, cy, Rb + rt, 'cl') + DK.cl(cx - Rb - 10, cy, cx + Rb + 10, cy) + DK.cl(cx, cy - 10, cx, cy + Rb + 10);
      h += dcCutter(cx, tc, rt, 4, 0);
      h += DK.dim(cx, cy, cx + Rb * Math.cos(dcRad(210)), cy - Rb * Math.sin(dcRad(210)), 'R ' + dcL(R, u, 'R'), {});
      const lc = dcClamp(La * (dcOk(kex) ? kex : 1.3), 8, 110);
      h += DK.arrow(cx, cy - Rb, cx + La, cy - Rb, 'dim') + DK.text(cx + La + 4, cy - Rb + 4, 'Fe', { cls: 'dimt', anchor: 'start' });
      h += DK.arrow(cx, tc, cx + lc, tc, 'hot') + DK.text(cx + lc + 4, tc + 4, 'Fc', { cls: 'hott', anchor: 'start' });
      h += dcResult(270, 262, 'Fc ' + dcL(fex, fu, '?'), 'tool centre, Fe × (R + r) / R');
    }
    h += DK.text(W - 6, H - 4, 'Fe ' + dcL(v.fe, fu, '') + ' at the edge, tool Ø ' + dcL(v.d, u, 'd'), { cls: 'mut', anchor: 'end' });
    return DK.svg(W, H, h, 'Arc feed: edge feed and tool-centre feed on inside and outside arcs');
  },

  // Helical interpolation: top view of the hole or boss with the tool and its centre path; side view of the helix and its pitch.
  helix(v, sys, rows) {
    const W = 520, H = 314, u = dcU(sys), boss = v.mode === 2, D = v.D, d = v.d, ok = dcOk(D) && dcOk(d) && (boss || d < D);
    const pd = dcRow(rows, 'Tool-centre path diameter'), pitch = dcOk(v.pitch) ? v.pitch : dcRow(rows, 'Pitch per turn');
    const ang = dcOk(v.pitch) ? dcRow(rows, 'Ramp angle for that pitch') : v.ang, az = dcRow(rows, 'Axial feed (F applies to the arc');
    const cx = 116, cy = 138;
    let h = DK.text(cx, 16, 'Top view', { cls: 'txt' }) + DK.text(400, 16, 'Section: tool-centre path', { cls: 'txt' });
    // One scale for both views: the feature (and, for a boss, the tool beside it) fits 90 px radius.
    const s = ok ? (boss ? 90 / (D / 2 + d) : 90 / (D / 2)) : (boss ? 90 / 0.95 : 90 / 0.5);
    const Rf = (ok ? D : 1) / 2 * s, rt = Math.max(4, (ok ? d : 0.45) / 2 * s), Rp = Math.max(boss ? Rf + rt : Rf - rt, 1);
    h += boss ? DK.circle(cx, cy, Rf, 'hatch') : dcRing(cx, cy, Rf, Rf + 12);
    h += DK.cl(cx - Rf - 16, cy, cx + Rf + 16, cy) + DK.cl(cx, cy - Rf - 16, cx, cy + Rf + 16);
    const ta = dcRad(-50), tx = cx + Rp * Math.cos(ta), ty = cy + Rp * Math.sin(ta);
    h += dcCutter(tx, ty, rt, 4, 0) + DK.circle(cx, cy, Rp, 'hot') + DK.circle(tx, ty, 2.5, 'hotf');
    h += DK.dimH(cx - Rf, cx + Rf, cy + Rf + 34, 'Ø ' + dcL(D, u, 'D') + (boss ? ' boss' : ' hole'), { from: cy, below: true });
    // Section: 0.85 of the top-view scale, pitch to scale but clamped.
    const k2 = 0.85, F2 = Rf * k2, P2 = Rp * k2, T2 = rt * k2, x2 = 392, ytop = 64, ybot = 240;
    const pp = dcOk(pitch) && dcOk(pd) ? dcClamp(pitch / pd * 2 * P2, 10, 100) : 30, turns = dcClamp(Math.floor((ybot - ytop - 40) / pp), 1, 4);
    const front = [], back = [], ye = ytop + 16 + pp * turns, xl = x2 - F2 - 14, xr = x2 + F2 + 14;
    // Material: a hole cut down to the tool, solid below; a boss stands up to the tool, stock round it is cut away to that depth.
    if (boss) h += DK.path('M' + (x2 - F2) + ' ' + ytop + 'H' + (x2 + F2) + 'V' + (ye + 2 * 0) + 'H' + (x2 + P2 + T2 + 16) + 'V' + ybot + 'H' + (x2 - P2 - T2 - 16) + 'V' + ye + 'H' + (x2 - F2) + 'Z', 'hatch');
    else h += DK.path('M' + xl + ' ' + ytop + 'H' + (x2 - F2) + 'V' + ye + 'H' + (x2 + F2) + 'V' + ytop + 'H' + xr + 'V' + ybot + 'H' + xl + 'Z', 'hatch');
    let seg = null, segFront = null, prev = null;
    for (let i = 0; i <= 48 * turns; i++) {
      const t = 2 * Math.PI * i / 48, x = x2 + P2 * Math.cos(t), y = ytop + 16 + pp * t / (2 * Math.PI), fr = Math.sin(t) < 0;
      if (seg === null || fr !== segFront) { seg = []; (fr ? front : back).push(seg); segFront = fr; if (prev) seg.push(prev); }
      seg.push([x, y]); prev = [x, y];
    }
    back.forEach(p => { h += dcPl(p, 'hid'); });
    h += dcEndMill(x2 + P2, ytop - 24, ye - ytop + 24, 2 * T2, Math.min(ye - ytop + 14, 4 * T2 + 30), 2 * T2);
    front.forEach(p => { h += dcPl(p, 'hot'); });
    h += DK.cl(x2, ytop - 34, x2, ybot + 8) + DK.circle(x2 + P2, ye, 2.5, 'hotf');
    const yA = ytop + 16, xd = boss ? x2 + P2 + T2 + 30 : x2 + F2 + 28;
    h += dcDimV(yA, yA + pp, xd, '', { hot: true, from: x2 + P2 + 2 }) + DK.text(xd + 6, yA + pp / 2 + 4, 'P', { cls: 'hott', anchor: 'start' });
    h += DK.dimH(x2 - P2, x2 + P2, ybot + 16, 'path Ø ' + dcL(pd, u, '?'), { hot: true, from: ybot, below: true }) + DK.line(x2 - P2, ye, x2 - P2, ybot, 'hot ext') + DK.line(x2 + P2, ye, x2 + P2, ybot, 'hot ext');
    h += DK.text(272, 288, 'P ' + dcL(pitch, u, '?') + ' per turn', { cls: 'hott', anchor: 'start' });
    h += dcLines(272, 304, ['ramp ' + (dcOk(ang) ? dcN(ang) + '°' : '?') + (dcOk(az) ? ', Z feed ' + dcN(az) + ' ' + dcFU(sys) : '')]);
    return DK.svg(W, H, h, 'Helical interpolation: tool-centre path, pitch and ramp angle');
  },

  // Tool deflection: the end mill hanging from the holder, stick-out, flute length, the side force and the bent tool (exaggerated).
  deflection(v, sys, rows) {
    const W = 520, H = 300, u = dcU(sys), fU = sys === 'inch' ? 'lbf' : 'N', d = v.d, L = v.L;
    const ok = dcOk(d) && dcOk(L), s = ok ? Math.min(168 / L, 70 / d) : 100;
    const Lp = ok ? L * s : 168, dp = ok ? Math.max(12, d * s) : 50, lfp = dcOk(v.lf) && ok ? Math.min(v.lf * s, Lp) : 0, dsp = dcOk(v.dsh) && ok ? Math.max(10, v.dsh * s) : dp;
    const cx = 200, y0 = 56, yt = y0 + Lp, del = dcRow(rows, 'Tip deflection', u), thou = dcRow(rows, 'Tip deflection', sys === 'inch' ? 'thou' : 'um');
    const F = dcOk(v.F) ? v.F : dcRow(rows, 'Radial force Fr');
    let h = dcHolder(cx, y0, Math.max(dsp, dp) + 70, 40) + DK.line(cx - 110, y0, cx + 110, y0, 'thin');
    h += dcEndMill(cx, y0, Lp, dp, lfp, dsp);
    // Bent shape (exaggerated): tip moves e px in +x, cantilever curve.
    const e = 22, bend = t => e * t * t * (3 - t) / 2, pts = k => { const p = []; for (let i = 0; i <= 30; i++) { const t = i / 30, y = y0 + t * Lp, half = (lfp && y > yt - lfp ? dp : dsp) / 2; p.push([cx + k * half + bend(t), y]); } return p; };
    h += dcPl(pts(-1), 'ghost') + dcPl(pts(1), 'ghost') + DK.line(cx - dp / 2 + e, yt, cx + dp / 2 + e, yt, 'ghost');
    h += DK.cl(cx, y0 - 46, cx, yt + 14);
    h += DK.arrow(cx - dp / 2 - 70, yt - 8, cx - dp / 2 - 3, yt - 8, 'dim') + DK.text(cx - dp / 2 - 72, yt - 14, 'F ' + dcL(F, fU, ''), { cls: 'dimt', anchor: 'start' });
    h += dcDimV(y0, yt, cx - dp / 2 - 96, 'L ' + dcL(L, u, 'L'), { from: cx - dsp / 2 - 4 });
    if (lfp) h += dcDimV(yt - lfp, yt, cx + dp / 2 + e + 26, 'flutes ' + dcL(v.lf, u, ''), { from: cx + dp / 2 + 3 });
    h += DK.dimH(cx - dp / 2, cx + dp / 2, yt + 42, 'Ø ' + dcL(d, u, 'D'), { from: yt + 2, below: true });
    h += DK.dimH(cx, cx + e, yt + 18, '', { hot: true, from: yt + 2 }) + DK.text(cx + e + 20, yt + 22, 'δ', { cls: 'hott', anchor: 'start' });
    const why = dcStr(rows, 'Flute section') || dcStr(rows, 'Radial force') || 'Enter the radial force, or the cutting power, speed and Fr/Ft ratio.';
    h += DK.text(334, 70, dcOk(del) ? 'δ ' + dcN(del) + ' ' + u : 'δ tip deflection', { cls: 'hott', anchor: 'start' });
    h += dcLines(334, 86, dcOk(thou) ? ['= ' + dcN(thou) + ' ' + (sys === 'inch' ? 'thou' : 'µm') + ' at the tip'] : dcWrap(why, 32));
    const E = (rows.find(x => x.label.indexOf("Young's modulus used") === 0) || {});
    const sec = dcRow(rows, 'Effective flute diameter'), sol = dcRow(rows, 'Section diameter (solid)');
    h += dcLines(334, dcOk(thou) ? 124 : 172, [
      isFinite(E.value) ? 'E ' + dcN(E.value) + ' ' + E.unit : '',
      dcOk(sec) ? 'flute section Ø ' + dcN(sec) + ' ' + u : dcOk(sol) ? 'solid section Ø ' + dcN(sol) + ' ' + u : '',
    ]);
    h += dcLines(334, 236, dcRow(rows, 'Holder and spindle stiffness used') > 0 ? ['Bent shape exaggerated;', 'the holder giving way', 'is included.'] : ['Bent shape exaggerated;', 'holder and spindle flex', 'are not included.']);
    return DK.svg(W, H, h, 'Tool deflection: stick-out, side force and tip deflection');
  },

  // Cut check: section across the feed (ae by ap) with the tool in the shoulder, the largest ap (or ae) found, and the limits.
  cutopt(v, sys, rows) {
    const W = 520, H = 300, u = dcU(sys), d = v.d, L = v.L, ok = dcOk(d) && dcOk(L);
    const s = ok ? Math.min(150 / L, 64 / d) : 100;
    const Lp = ok ? L * s : 150, dp = ok ? Math.max(12, d * s) : 50, r = dp / 2, lfp = dcOk(v.lf) && ok ? Math.min(v.lf * s, Lp) : 0, dsp = dcOk(v.dsh) && ok ? Math.max(10, v.dsh * s) : dp;
    const cx = 116, y0 = 64, yt = y0 + Lp;
    const aep = dcOk(v.ae) && ok ? dcClamp(v.ae * s, 2, dp) : r * 0.5, app = dcOk(v.ap) && ok ? dcClamp(v.ap * s, 2, Lp - 8) : Lp * 0.45;
    const xw = cx + r, top = yt - app, xr = xw + 64, yb = yt + 26, mode = v.mode === 1 ? 'ae' : 'ap';
    let h = DK.poly([[cx - r - 40, yt], [xw, yt], [xw, top], [xr, top], [xr, yb], [cx - r - 40, yb]], 'hatch');
    h += dcHolder(cx, y0, Math.max(dp, dsp) + 56, 34) + dcEndMill(cx, y0, Lp, dp, lfp, dsp) + DK.cl(cx, y0 - 40, cx, yb + 8);
    h += DK.rect(xw - aep, top, aep, app, 'hatch') + DK.rect(xw - aep, top, aep, app, 'hot');
    h += dcDimV(y0, yt, cx - r - 54, 'L ' + dcL(L, u, 'L'), { from: cx - Math.max(r, dsp / 2) - 3 });
    h += DK.dimH(xw - aep, xw, top - 18, '', { from: top }) + DK.text(xw + 6, top - 22, 'ae ' + dcL(v.ae, u, ''), { cls: 'dimt', anchor: 'start' });
    h += dcDimV(top, yt, xr + 16, 'ap ' + dcL(v.ap, u, ''), { from: xr + 2 });
    const best = dcRow(rows, 'Largest ' + mode + ' inside the limits'), by = dcStr(rows, 'Set by');
    if (dcOk(best) && ok) {
      if (mode === 'ap') { const yb2 = Math.max(y0 + 4, yt - best * s); h += DK.line(xw - aep - 8, yb2, xr, yb2, 'hot') + dcDimV(yb2, yt, xr + 44, 'max ' + dcN(best), { hot: true, from: xr + 2 }); }
      else { const xa = Math.max(cx - r - 30, xw - best * s); h += DK.line(xa, top - 6, xa, yt, 'hot') + DK.dimH(xa, xw, top - 44, '', { hot: true, from: top - 6 }) + DK.text(xa - 4, top - 48, 'max ae', { cls: 'hott', anchor: 'end' }); }
    }
    h += DK.text(14, H - 8, 'Section across the feed (feed into the page)', { cls: 'mut', anchor: 'start' });
    const x = 300, rpm = dcRow(rows, 'Spindle speed'), vf = dcRow(rows, 'Table feed'), q = (rows.find(r => r.label === 'Material removal rate') || {});
    const pw = dcRow(rows, 'Power at the spindle', 'kW'), defl = dcRow(rows, 'Tool tip deflection'), bind = dcStr(rows, 'Binds first'), hex = dcRow(rows, 'Max chip thickness hex');
    let y = 40;
    if (dcOk(best)) { h += DK.text(x, y, 'largest ' + mode + ' ' + dcN(best) + ' ' + u, { cls: 'hott', anchor: 'start' }); y += 16; if (by) { h += dcLines(x, y, ['set by ' + by.toLowerCase()]); y += 16; } y += 8; }
    const lines = [dcOk(rpm) ? dcN(rpm, 0) + ' RPM, feed ' + dcN(vf) + ' ' + dcFU(sys) : '', isFinite(q.value) ? 'removal ' + dcN(q.value) + ' ' + dcUnit(q.unit) : '', dcOk(hex) ? 'max chip ' + dcN(hex) + ' ' + u : '', dcOk(pw) ? 'spindle power ' + dcN(pw) + ' kW' : '', dcOk(defl) ? 'tip deflection ' + dcN(defl) + ' ' + u : ''].filter(Boolean);
    h += dcLines(x, y, lines, { cls: 'txt' }); y += lines.length * 16 + 10;
    if (bind) h += dcLines(x, y, dcWrap('Binds first: ' + bind, 34));
    return DK.svg(W, H, h, 'Cut check: depth and width of cut, and the largest cut inside the limits');
  },

  // Chip thinning: the cutter on the wall to scale with the engaged arc and angle; an enlarged chip between two teeth.
  chipthin(v, sys, rows) {
    const W = 520, H = 290, u = dcU(sys), ok = dcOk(v.d) && dcOk(v.ae), k = ok ? Math.min(v.ae / v.d, 1) : 0.15;
    const cx = 132, cy = 130, r = 78, yw = cy + r, yp = yw - 2 * r * k, phi = dcRow(rows, 'Engagement angle');
    const t0 = Math.asin(dcClamp((yp - cy) / r, -1, 1)), xi = cx + r * Math.cos(t0);
    const arc = []; for (let i = 0; i <= 40; i++) { const t = t0 + (Math.PI / 2 - t0) * i / 40; arc.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); }
    let h = DK.poly([[14, yw + 26], [262, yw + 26], [262, yp], [xi, yp]].concat(arc, [[14, yw]]), 'hatch');
    h += dcCutter(cx, cy, r, dcOk(v.z) ? Math.min(v.z, 12) : 4, 0.3) + DK.cl(cx - r - 10, cy, cx + r + 10, cy) + DK.cl(cx, cy - r - 10, cx, cy + r + 10);
    h += dcPl(arc, 'hot') + DK.line(cx, cy, xi, yp, 'thin') + DK.line(cx, cy, cx, yw, 'thin');
    const aDeg = Math.atan2(-(yp - cy), xi - cx) * 180 / Math.PI;
    h += DK.angle(cx, cy, 30, -90, aDeg, dcOk(phi) ? 'φ ' + dcN(phi, 1) + '°' : 'φ', {});
    h += dcSpin(cx, cy, r + 10, r + 10, 130, 50, 'dim') + DK.dimH(cx - r, cx + r, cy - r - 30, 'Ø ' + dcL(v.d, u, 'D'), { from: cy });
    h += DK.arrow(18, 40, 60, 40, 'dim') + DK.text(18, 32, 'feed', { cls: 'mut', anchor: 'start' });
    h += dcDimV(yp, yw, 278, '', { from: 262 }) + DK.text(284, (yp + yw) / 2 + 4, 'ae ' + dcL(v.ae, u, ''), { cls: 'dimt', anchor: 'start' });
    // Detail: the chip between the previous tooth and this one, fz apart (enlarged, not to scale).
    const cd = 350, cyd = 34, rd = 100, f = 30, kd = dcClamp(k, 0.2, 0.45), ypd = cyd + rd - 2 * rd * kd, t1 = Math.asin(dcClamp((ypd - cyd) / rd, -1, 1));
    const cur = [], pre = [];
    for (let i = 0; i <= 30; i++) { const t = Math.PI / 2 - (Math.PI / 2 - t1) * i / 30; cur.push([cd + f + rd * Math.cos(t), cyd + rd * Math.sin(t)]); }
    for (let i = 0; i <= 30; i++) { const t = t1 + (Math.PI / 2 - t1) * i / 30; pre.push([cd + rd * Math.cos(t), cyd + rd * Math.sin(t)]); }
    h += DK.text(460, 20, 'chip, enlarged', { cls: 'mut' });
    h += DK.poly([[cd - 14, cyd + rd + 26], [510, cyd + rd + 26], [510, ypd], [cd + f + rd * Math.cos(t1), ypd]].concat(cur.slice().reverse(), [[cd - 14, cyd + rd]]), 'hatch');
    h += DK.poly(cur.concat(pre), 'tool');
    const ext = []; for (let i = 0; i <= 30; i++) { const t = t1 - 0.35 + (Math.PI / 2 + 0.12 - t1 + 0.35) * i / 30; ext.push([cd + rd * Math.cos(t), cyd + rd * Math.sin(t)]); }
    h += dcPl(ext, 'thin') + DK.text(cd + rd * Math.cos(t1 - 0.35) - 4, Math.max(16, cyd + rd * Math.sin(t1 - 0.35) - 2), 'previous tooth', { cls: 'mut', anchor: 'end' });
    const tip = [cd + f + rd * Math.cos(t1), ypd];
    h += DK.leader(tip[0] - 2, tip[1] + 3, 506, ypd - 34, 'hex', { anchor: 'end' });
    h += DK.dimH(cd, cd + f, cyd + rd + 50, '', { hot: true, from: cyd + rd + 2 }) + DK.text(cd + f + 22, cyd + rd + 54, 'fz', { cls: 'hott', anchor: 'start' });
    const fz = dcRow(rows, 'Feed per tooth for that chip'), rc = dcRow(rows, 'Chip thinning factor');
    h += dcLines(340, 236, [dcOk(v.hex) ? 'hex ' + dcN(v.hex) + ' ' + u + ' (target chip)' : 'hex: enter the target chip', dcOk(rc) ? 'RCTF ' + dcN(rc) + ' × hex' : '']);
    h += DK.text(340, 278, dcOk(fz) ? 'fz ' + dcN(fz) + ' ' + u : 'fz = hex × RCTF', { cls: 'hott', anchor: 'start' });
    h += DK.text(14, H - 6, 'Drawn to scale; thick arc = edge in the cut', { cls: 'mut', anchor: 'start' });
    return DK.svg(W, H, h, 'Radial chip thinning: engagement angle and chip thickness');
  },

  // Corner engagement: pocket corner (or boss) to scale, the tool on the arc and on the straight wall, engaged arcs and angles.
  cornerfeed(v, sys, rows) {
    const W = 520, H = 300, u = dcU(sys), inside = v.mode !== 0;
    const ok = dcOk(v.d) && dcOk(v.Rw) && dcOk(v.ae) && (!inside || v.Rw > v.d / 2);
    const r = ok ? v.d / 2 : 1, R = ok ? v.Rw : 2.6, a = ok ? Math.min(v.ae, v.d) : 0.35;
    const p0 = dcRow(rows, 'Engagement on the straight wall'), p1 = dcRow(rows, 'Engagement on the arc');
    const m = Math.SQRT1_2, rc = inside ? R - r : R + r, tc = [m * rc, -m * rc], gy = inside ? -(R - r) : -(R + r), gx = Math.min(-1.3 * r, tc[0] - 2.8 * r);
    const mm = Math.max(0.16 * R, 0.7 * r), xmin = gx - 1.6 * r, xmax = Math.max(R, tc[0] + r) + mm;
    const ymin = Math.min(-R, tc[1] - r, gy - r) - mm, ymax = Math.max(0.3 * R, tc[1] + r + 0.6 * r, 1.4 * r);
    const f = DK.fit(xmax - xmin, ymax - ymin, 330, H, 22), P = p => [f.x(p[0] - xmin), f.y(ymax - p[1])];
    const poly = (pts, cls) => DK.poly(pts.map(P), cls);
    const wall = dcCornerPath(R, xmin, ymax);
    let h = inside ? poly(wall.concat([[xmax, ymax], [xmax, ymin], [xmin, ymin]]), 'hatch') : poly(wall.concat([[xmin, ymax]]), 'hatch');
    // Stock still to cut, ahead of the tool: band between the finished wall and the previous one.
    const Ra = inside ? R - a : R + a, band = (Rr, rev) => { const p = []; for (let i = 0; i <= 20; i++) { const t = -Math.PI / 4 + Math.PI / 4 * i / 20; p.push([Rr * Math.cos(t), Rr * Math.sin(t)]); } p.push([Rr, ymax]); return rev ? p.reverse() : p; };
    h += poly(band(R).concat(band(Ra, true)), 'part');
    const prevWall = dcCornerPath(Ra, xmin, ymax).map(P);
    h += dcPl(prevWall, 'ghost');
    const S = f.s, T = P(tc), G = P([gx, gy]);
    const inBand = (x, y) => inside ? dcInCorner(x, y, R) && !dcInCorner(x, y, Ra) : dcInCorner(x, y, Ra) && !dcInCorner(x, y, R);
    const W2 = q => [xmin + (q[0] - f.x(0)) / S, ymax - (q[1] - f.y(0)) / S];
    const runs = dcArcRuns(T[0], T[1], r * S, q => { const w = W2(q); return inBand(w[0], w[1]) && Math.atan2(w[1], w[0]) >= -Math.PI / 4 - 1e-6; }, 720);
    const gruns = dcArcRuns(G[0], G[1], r * S, q => { const w = W2(q); return w[0] >= gx && (inside ? w[1] <= -(R - a) + 1e-9 : w[1] >= -(R + a) - 1e-9); }, 720);
    h += DK.circle(G[0], G[1], r * S, 'ghost') + DK.cl(G[0] - r * S - 6, G[1], G[0] + r * S + 6, G[1]);
    h += dcCutter(T[0], T[1], r * S, 4, 0) + DK.circle(T[0], T[1], 2, 'hotf');
    gruns.forEach(p => { h += dcPl(p, 'dim'); });
    runs.forEach(p => { h += dcPl(p, 'hot'); });
    const ends = rr => { if (!rr.length) return null; const p = rr[0]; return [p[0], p[p.length - 1]]; };
    const e1 = ends(runs), e0 = ends(gruns);
    if (e1) h += DK.line(T[0], T[1], e1[0][0], e1[0][1], 'hot') + DK.line(T[0], T[1], e1[1][0], e1[1][1], 'hot');
    if (e0) h += DK.line(G[0], G[1], e0[0][0], e0[0][1], 'dim') + DK.line(G[0], G[1], e0[1][0], e0[1][1], 'dim');
    // Feed direction along the wall (anticlockwise about the corner centre).
    h += DK.arrow(P([gx + 1.3 * r, gy])[0], G[1], P([gx + 2.3 * r, gy])[0], G[1], 'dim');
    const q = P([R * Math.cos(dcRad(inside ? -70 : -78)), R * Math.sin(dcRad(inside ? -70 : -78))]);
    h += DK.leader(q[0], q[1], Math.max(80, q[0] - 50), inside ? H - 12 : Math.max(16, q[1] - 44), 'R ' + dcL(v.Rw, u, 'R'), { anchor: 'end' });
    const x = 344, ratio = dcRow(rows, 'Chip on the arc'), fz1 = dcRow(rows, 'Feed per tooth on the arc'), fc = dcRow(rows, 'Programmed tool-centre feed');
    h += DK.text(x, 40, 'on the arc φ ' + (dcOk(p1) ? dcN(p1, 1) + '°' : '?'), { cls: 'hott', anchor: 'start' });
    h += DK.text(x, 58, 'straight wall φ ' + (dcOk(p0) ? dcN(p0, 1) + '°' : '?'), { cls: 'dimt', anchor: 'start' });
    h += dcLines(x, 84, [dcOk(ratio) ? 'chip on the arc ' + dcN(ratio) + ' ×' : '', 'tool Ø ' + dcL(v.d, u, 'D') + ', ae ' + dcL(v.ae, u, 'ae')], { cls: 'txt' });
    let y = 128;
    if (dcOk(fz1)) { h += dcLines(x, y, ['feed per tooth on the arc']) + DK.text(x, y + 16, dcN(fz1) + ' ' + u, { cls: 'hott', anchor: 'start' }); y += 34; }
    if (dcOk(fc)) { h += dcLines(x, y, ['tool-centre feed ' + dcN(fc) + ' ' + dcFU(sys)]); y += 16; }
    const note = dcStr(rows, 'Note') || dcStr(rows, 'Corner');
    if (note) h += dcLines(x, y + 8, dcWrap(note, 30));
    h += dcLines(x, 252, ['grey: stock for this pass;', 'dashed: wall before it.']);
    return DK.svg(W, H, h, 'Corner engagement: tool on the arc and on the straight wall');
  },

  // Ball-nose cusp: passes side by side to scale; an enlarged profile with the cusp height.
  ballcusp(v, sys, rows) {
    const W = 520, H = 270, u = dcU(sys), d = v.d, byStep = dcOk(v.st);
    const st = byStep ? v.st : dcRow(rows, 'Stepover for the target cusp');
    const hc = byStep ? dcRow(rows, 'Cusp height', u) : v.h, hmu = byStep ? dcRow(rows, 'Cusp height', sys === 'inch' ? 'uin' : 'um') : NaN;
    const k = dcOk(d) && dcOk(st) ? dcClamp(st / d, 0.14, 1) : 0.45, R = Math.min(52, 266 / (4 * k + 2)), sp = k * 2 * R, cx = 152, base = 196, cyc = base - R, top = 54;
    const prof = [];
    for (let x = 14; x <= 286; x += 1) { const i = Math.round((x - cx) / sp), dx = x - (cx + i * sp); prof.push([x, cyc + Math.sqrt(Math.max(0, R * R - dx * dx))]); }
    let h = DK.poly(prof.concat([[286, base + 30], [14, base + 30]]), 'hatch');
    const ball = (x, cls) => DK.path('M' + (x - R) + ' ' + top + 'L' + (x - R) + ' ' + cyc + 'A' + R + ' ' + R + ' 0 0 0 ' + (x + R) + ' ' + cyc + 'L' + (x + R) + ' ' + top, cls);
    h += ball(cx - sp, 'ghost') + ball(cx + sp, 'ghost') + ball(cx, 'tool');
    [-1, 0, 1].forEach(i => { h += DK.cl(cx + i * sp, top - 8, cx + i * sp, base + 8); });
    h += DK.dimH(cx - sp, cx, top - 18, sp > 60 ? 'stepover ' + dcL(st, u, 's') : '', { from: top - 8 });
    if (sp <= 60) h += DK.text(cx + 20, top - 14, 'stepover ' + dcL(st, u, 's'), { cls: 'dimt', anchor: 'start' });
    h += DK.dimH(cx - R, cx + R, top + 22, 'Ø ' + dcL(d, u, 'D'), {});
    h += DK.leader(cx + sp / 2, cyc + Math.sqrt(Math.max(0, R * R - sp * sp / 4)) + 1, cx + sp / 2 + 30, base + 22, 'cusp', { hot: true, anchor: 'start' });
    // Detail: profile with heights enlarged.
    const x0 = 330, cw = 56, sg = 24, rr = (cw * cw / 4 + sg * sg) / (2 * sg), yv = 150, c0 = x0 + 10;
    const dp = [];
    for (let x = x0 - 18; x <= 506; x += 1) { const i = Math.round((x - c0) / cw), dx = x - (c0 + i * cw); dp.push([x, yv - rr + Math.sqrt(Math.max(0, rr * rr - dx * dx))]); }
    h += DK.text(418, 48, 'profile, height enlarged', { cls: 'mut' });
    h += DK.poly(dp.concat([[506, yv + 26], [x0 - 18, yv + 26]]), 'hatch');
    const xc = c0 + cw * 1.5;
    h += DK.line(xc, yv - sg, xc + 28, yv - sg, 'hot ext') + DK.line(c0 + 2 * cw, yv, xc + 28, yv, 'hot ext');
    h += dcDimV(yv - sg, yv, xc + 22, '', { hot: true }) + DK.text(xc + 28, yv - sg - 8, 'h', { cls: 'hott', anchor: 'start' });
    h += DK.dimH(c0 + cw, c0 + 2 * cw, yv + 44, 's', { from: yv + 2 });
    h += DK.text(330, 232, 'h ' + dcL(hc, u, '?'), { cls: 'hott', anchor: 'start' });
    if (dcOk(hmu)) h += DK.text(330, 250, '= ' + dcN(hmu) + ' ' + (sys === 'inch' ? 'µin' : 'µm'), { cls: 'hott', anchor: 'start' });
    if (!byStep) h += DK.text(330, 266, 'stepover ' + dcL(st, u, '?'), { cls: 'mut', anchor: 'start' });
    return DK.svg(W, H, h, 'Ball-nose cusp height between passes');
  },

  // Ball-nose effective diameter: the ball at depth ap (tilted if set), the band of edge in the cut and De.
  balleff(v, sys, rows) {
    const W = 520, H = 280, u = dcU(sys), ok = dcOk(v.d) && dcOk(v.ap), bdeg = dcOk(v.tilt) && v.tilt < 89 ? v.tilt : 0, b = dcRad(bdeg);
    const R = 66, a = ok ? dcClamp(v.ap / v.d, 0.01, 1) * 2 * R : 0.24 * R, bot = 214, cx = 190, C = [cx, bot - R];
    const ax = [Math.sin(b), -Math.cos(b)], pr = [Math.cos(b), Math.sin(b)], up = 110;
    const t1 = Math.asin(dcClamp(1 - a / R, -1, 1));
    const fr = []; for (let i = 0; i <= 30; i++) { const t = Math.PI / 2 - (Math.PI / 2 - t1) * i / 30; fr.push([cx + R * Math.cos(t), C[1] + R * Math.sin(t)]); }
    let h = DK.poly([[14, H - 22], [14, bot], [cx, bot]].concat(fr, [[330, bot - a], [330, H - 22]]), 'hatch');
    const e1 = [C[0] + R * pr[0], C[1] + R * pr[1]], e2 = [C[0] - R * pr[0], C[1] - R * pr[1]], half = [];
    for (let i = 0; i <= 60; i++) { const t = b + Math.PI * i / 60; half.push([C[0] + R * Math.cos(t), C[1] + R * Math.sin(t)]); }
    h += DK.poly([[e1[0] + up * ax[0], e1[1] + up * ax[1]]].concat(half, [[e2[0] + up * ax[0], e2[1] + up * ax[1]]]), 'tool');
    h += DK.line(C[0] - 130 * ax[0] * 0 - (R + 14) * ax[0], C[1] - (R + 14) * ax[1], C[0] + (up + 12) * ax[0], C[1] + (up + 12) * ax[1], 'cl');
    const band = half.filter(p => p[1] >= bot - a - 1e-6);
    let best = null, dist = -1;
    band.forEach(p => { const q = [p[0] - C[0], p[1] - C[1]], dd = Math.abs(q[0] * pr[0] + q[1] * pr[1]); if (dd > dist) { dist = dd; best = p; } });
    // Split the band into its two sides of the axis.
    const sideA = band.filter(p => (p[0] - C[0]) * pr[0] + (p[1] - C[1]) * pr[1] >= 0), sideB = band.filter(p => (p[0] - C[0]) * pr[0] + (p[1] - C[1]) * pr[1] < 0);
    h += dcPl(sideA, 'hot') + dcPl(sideB, 'hot');
    const de = dcRow(rows, 'Effective (largest) cutting diameter'), dmin = dcRow(rows, 'Smallest diameter in the cut');
    if (best) {
      const q = [best[0] - C[0], best[1] - C[1]], along = q[0] * ax[0] + q[1] * ax[1], foot = [C[0] + along * ax[0], C[1] + along * ax[1]];
      const pA = [foot[0] - dist * pr[0], foot[1] - dist * pr[1]], pB = [foot[0] + dist * pr[0], foot[1] + dist * pr[1]];
      h += DK.line(pA[0], pA[1], pB[0], pB[1], 'hot') + DK.circle(pA[0], pA[1], 2.5, 'hotf') + DK.circle(pB[0], pB[1], 2.5, 'hotf');
      h += DK.leader(pA[0] - 2, pA[1], pA[0] - 40, pA[1] - 34, 'De', { hot: true, anchor: 'end' });
    }
    h += dcDimV(bot - a, bot, 350, '', { from: 330 }) + DK.text(356, bot - a / 2 + 4, 'ap ' + dcL(v.ap, u, ''), { cls: 'dimt', anchor: 'start' });
    h += DK.dim(e2[0], e2[1], e1[0], e1[1], 'Ø ' + dcL(v.d, u, 'D'), { off: 46 });
    if (bdeg > 0.5) h += DK.line(C[0], C[1], C[0], C[1] - R - 44, 'thin') + DK.angle(C[0], C[1], R + 22, 90 - bdeg, 90, 'β ' + dcN(bdeg) + '°', {});
    h += DK.text(14, bot - 8, 'finished', { cls: 'mut', anchor: 'start' }) + DK.text(326, bot - a - 8, 'stock', { cls: 'mut', anchor: 'end' });
    const rpm = dcRow(rows, 'Spindle speed for that speed'), fa = dcRow(rows, 'Feed per tooth to restore'), x = 372;
    h += DK.text(x, 40, 'De ' + dcL(de, u, '?'), { cls: 'hott', anchor: 'start' });
    h += dcLines(x, 58, [dcOk(dmin) ? 'smallest Ø in cut ' + dcN(dmin) + ' ' + u : (dmin === 0 ? 'smallest Ø in cut 0' : ''), dcOk(rpm) ? dcN(rpm, 0) + ' RPM at De' : '', dcOk(fa) ? 'fz ' + dcN(fa) + ' ' + u + ' (restored)' : ''], { cls: 'txt' });
    const note = dcStr(rows, 'Tool centre');
    if (note) h += dcLines(x, 124, dcWrap(note, 24));
    return DK.svg(W, H, h, 'Ball-nose effective diameter at depth of cut');
  },

  // Runout: end view with the tool axis off the spindle axis (exaggerated); each tooth's chip as a bar against the programmed fz.
  runout(v, sys, rows) {
    const W = 520, H = 270, u = dcU(sys), z = dcOk(v.z) ? Math.round(v.z) : 4;
    const chips = rows.filter(r => /^Tooth \d+ chip$/.test(r.label)).map(r => r.value);
    const cx = 104, cy = 128, r = 62, e = dcOk(v.tir) ? 9 : 0;
    let h = DK.circle(cx, cy, r + e, 'ghost') + dcCutter(cx + e, cy, r, Math.min(z, 12), 0) + DK.cl(cx - r - e - 12, cy, cx + r + e + 12, cy) + DK.cl(cx, cy - r - e - 12, cx, cy + r + e + 12);
    h += DK.circle(cx, cy, 2.5, 'dimf') + DK.circle(cx + e, cy, 2.5, 'hotf');
    h += dcSpin(cx, cy, r + e + 10, r + e + 10, 130, 50, 'dim');
    h += DK.circle(22, 232, 3, 'dimf') + DK.text(32, 236, 'spindle axis', { cls: 'mut', anchor: 'start' }) + DK.circle(22, 250, 3, 'hotf') + DK.text(32, 254, 'tool axis (offset exaggerated)', { cls: 'mut', anchor: 'start' });
    h += DK.text(cx, 30, 'TIR ' + dcL(v.tir, u, '?'), { cls: 'dimt' });
    // Bar chart.
    const x0 = 250, x1 = 506, yb = 200, yt = 50, fz = v.fz, tgt = dcOk(v.tgt) ? v.tgt : fz;
    if (!chips.length) return DK.svg(W, H, h + DK.text(380, 120, 'Enter the runout to see each tooth\'s chip.', { cls: 'mut' }), 'Runout');
    const mx = Math.max.apply(null, chips.concat([dcOk(fz) ? fz : 0, dcOk(tgt) ? tgt : 0])) * 1.15 || 1, Y = c => yb - (yb - yt) * c / mx;
    const n = chips.length, gap = (x1 - x0) / n, bw = Math.min(30, gap * 0.62), worst = chips.indexOf(Math.max.apply(null, chips));
    h += DK.line(x0 - 6, yb, x1, yb, 'ln') + DK.line(x0 - 6, yb, x0 - 6, yt - 8, 'thin');
    chips.forEach((c, i) => {
      const xc = x0 + gap * (i + 0.5);
      h += DK.rect(xc - bw / 2, Y(c), bw, yb - Y(c), i === worst ? 'tool' : 'part');
      if (n <= 16 || i % 2 === 0) h += DK.text(xc, yb + 15, String(i + 1), { cls: i === worst ? 'hott' : 'mut' });
    });
    if (dcOk(fz)) h += DK.line(x0 - 6, Y(fz), x1, Y(fz), 'dim') + DK.text(x1, Y(fz) - 5, 'programmed fz ' + dcN(fz), { cls: 'dimt', anchor: 'end' });
    const wx = x0 + gap * (worst + 0.5);
    h += DK.text(Math.min(wx, x1 - 40), Y(chips[worst]) - 6, dcN(chips[worst]), { cls: 'hott' });
    h += DK.text(x0 - 6, yt - 16, 'chip per tooth (' + u + ')', { cls: 'mut', anchor: 'start' }) + DK.text((x0 + x1) / 2, yb + 32, 'tooth', { cls: 'mut' });
    const pct = dcRow(rows, 'Worst tooth / programmed fz'), fix = dcRow(rows, 'Feed per tooth so the worst tooth');
    h += DK.text(x0 - 6, H - 22, 'worst tooth ' + (dcOk(pct) ? dcN(pct, 1) + '% of fz' : '?'), { cls: 'hott', anchor: 'start' });
    if (dcOk(fix)) h += DK.text(x0 - 6, H - 6, 'program fz ' + dcN(fix) + ' ' + u + ' to hold ' + dcN(tgt), { cls: 'mut', anchor: 'start' });
    return DK.svg(W, H, h, 'Runout: chip per tooth');
  },
});

// ---- lathe helpers ----
// Chuck jaws gripping a part of radius R whose face is at x (part to the right).
const dcChuck = (x, cy, R) => DK.rect(x - 36, cy - R - 34, 22, 2 * R + 68, 'hatch') + DK.rect(x - 14, cy - R - 18, 24, 18, 'hatch') + DK.rect(x - 14, cy + R, 24, 18, 'hatch');
// Turning tool in plan view: a triangular insert with its tip at (tx, ty) and a holder shank.
// dir +1: body to the right of the tip (turning towards the chuck on the left), -1 mirrored.
// rot (degrees, clockwise on screen) turns the whole tool about its tip: 0 = shank straight up.
// holder: shank length in px, or false for the insert alone. cls: the insert's class.
function dcInsert(tx, ty, s, dir, holder, cls, rot) {
  const a = dcRad(rot || 0), ca = Math.cos(a), sa = Math.sin(a), d = dir || 1;
  const P = (x, y) => [tx + (d * x) * ca - y * sa, ty + (d * x) * sa + y * ca];
  let h = '';
  if (holder !== false) { const hl = holder || 2.4 * s; h += DK.poly([P(0.22 * s, -0.42 * s), P(1.1 * s, -0.42 * s), P(1.1 * s, -0.42 * s - hl), P(0.22 * s, -0.42 * s - hl)], 'part'); }
  return h + DK.poly([P(0, 0), P(0.98 * s, -0.17 * s), P(0.34 * s, -0.94 * s)], cls || 'tool');
}
// Rotation of a turning part seen from the side: arrow round a narrow ellipse at x.
const dcTurnSpin = (x, cy, R, cls) => dcSpin(x, cy, 9, R + 10, 115, 245, cls || 'dim');

Object.assign(DIAGRAMS, {
  // ---------------- Turning ----------------
  // Milling surface finish: feed marks as arcs of the corner radius (floor) or the cutter radius (wall),
  // a feed per tooth apart. The arcs are drawn to the feed-to-radius ratio, held within a range that stays readable.
  millfinish(v, sys, rows) {
    const W = 520, H = 250, wall = v.surf === 2, r = wall ? v.d / 2 : v.r, mu = sys === 'inch' ? 'µin' : 'µm', fu = sys === 'inch' ? 'in' : 'mm';
    const Rn = 60, ok = dcOk(r) && dcOk(v.fz), fp = ok ? dcClamp(v.fz / r * Rn, 70, 1.5 * Rn) : 70, held = ok && Math.abs(v.fz / r * Rn - fp) > 0.5;
    const ys = 176, cy = ys - Rn, x0 = 70, x1 = 430, prof = [];
    for (let x = x0; x <= x1; x += 1) { const i = Math.round((x - x0) / fp), dx = x - (x0 + i * fp); prof.push([x, cy + Math.sqrt(Math.max(0, Rn * Rn - dx * dx))]); }
    const yp = cy + Math.sqrt(Rn * Rn - fp * fp / 4), xc = x0 + 2 * fp;
    let h = DK.poly(prof.concat([[x1, ys + 34], [x0, ys + 34]]), 'hatch');
    h += DK.circle(xc, cy, Rn, 'ghost') + DK.circle(xc, cy, 2, 'dimf') + DK.line(xc, cy, xc + Rn * 0.7071, cy - Rn * 0.7071, 'dim');
    h += DK.text(xc + Rn * 0.7071 + 6, cy - Rn * 0.7071 - 4, (wall ? 'cutter radius D/2 ' : 'corner radius r ') + dcL(r, fu, ''), { cls: 'dimt', anchor: 'start' });
    h += DK.dimH(xc + fp / 2, xc + 1.5 * fp, yp - 22, 'fz', { from: yp - 2 });
    h += DK.line(x1 + 4, yp, x1 + 30, yp, 'dim ext') + DK.line(x1 + 4, ys, x1 + 30, ys, 'dim ext') + DK.dim(x1 + 22, ys, x1 + 22, yp, '', {}) + DK.text(x1 + 36, (ys + yp) / 2 + 4, 'Rt', { cls: 'hott', anchor: 'start' });
    const ra = dcRow(rows, 'Theoretical Ra, every tooth'), rt = dcRow(rows, 'Theoretical Rt, every tooth'), ra1 = dcRow(rows, 'Theoretical Ra, one tooth');
    h += DK.text(18, 22, wall ? 'Wall, seen from above: marks left by the side of the cutter' : 'Floor, seen from the side: marks left by the corner radius', { cls: 'mut', anchor: 'start' });
    h += DK.text(18, H - 22, dcOk(ra) ? 'Every tooth alike: Ra ' + DK.n(ra, sys === 'inch' ? 1 : 3) + ' ' + mu + ', Rt ' + DK.n(rt, sys === 'inch' ? 1 : 3) + ' ' + mu + (dcOk(ra1) ? '.  One tooth marking: Ra ' + DK.n(ra1, sys === 'inch' ? 1 : 3) + ' ' + mu : '') : 'Rt = r - √(r² - (f/2)²)', { cls: 'mut', anchor: 'start' });
    h += DK.text(18, H - 8, held ? 'Marks not to scale (the real ones are much flatter)' : 'Marks to scale', { cls: 'mut', anchor: 'start' });
    return DK.svg(W, H, h, 'Milling surface finish: feed marks left by the cutter, a feed per tooth apart');
  },

  // Surface finish: the nose radius leaving feed marks f apart (to scale), and the profile enlarged with Rt and the mean line.
  finish(v, sys, rows) {
    const W = 520, H = 270, u = dcU(sys), r = v.r, fr = dcOk(v.f) ? v.f : dcRow(rows, 'Feed for target Ra');
    const ra = dcRow(rows, 'Theoretical Ra'), rt = dcRow(rows, 'Theoretical Rt'), mu = sys === 'inch' ? 'µin' : 'µm';
    const Rn = 44, fp = dcOk(r) && dcOk(fr) ? dcClamp(fr / r * Rn, 5, 1.9 * Rn) : 0.6 * Rn, ys = 168, cx = 120, cyc = ys - Rn;
    // Finished surface: envelope of the nose circles to the right of the tool; stock (uncut) to the left.
    const prof = [];
    for (let x = cx; x <= 262; x += 1) { const i = Math.round((x - cx) / fp), dx = x - (cx + i * fp); prof.push([x, cyc + Math.sqrt(Math.max(0, Rn * Rn - dx * dx))]); }
    const stockY = ys - 34;
    const left = []; for (let i = 0; i <= 20; i++) { const t = Math.PI - (Math.PI / 2) * i / 20, x = cx + Rn * Math.cos(t), y = cyc + Rn * Math.sin(t); if (y >= stockY) left.push([x, y]); }
    let h = DK.poly([[14, stockY]].concat(left, prof, [[262, ys + 40], [14, ys + 40]]), 'hatch');
    // Insert: nose arc from 40° to 140° (screen), flanks at 40° to the vertical.
    const pt = a => [cx + Rn * Math.cos(dcRad(a)), cyc + Rn * Math.sin(dcRad(a))], nose = [];
    for (let a = 140; a >= 40; a -= 5) nose.push(pt(a));
    const dl = [-Math.sin(dcRad(40)), -Math.cos(dcRad(40))], dr = [Math.sin(dcRad(40)), -Math.cos(dcRad(40))], Lf = 52;
    const lv = [pt(140)[0] + Lf * dl[0], pt(140)[1] + Lf * dl[1]], rv = [pt(40)[0] + Lf * dr[0], pt(40)[1] + Lf * dr[1]];
    h += DK.poly([lv].concat(nose, [rv, [lv[0] + rv[0] - cx, lv[1] + rv[1] - (cyc + Rn) + 0]]), 'tool');
    h += DK.circle(cx, cyc, 2, 'dimf') + DK.line(cx, cyc, pt(128)[0], pt(128)[1], 'dim') + dcHead(pt(128)[0], pt(128)[1], dcRad(128), 'dimf');
    h += DK.leader(pt(128)[0] - 1, pt(128)[1] - 1, 18, 232, 'nose r ' + dcL(r, u, 'r'), { anchor: 'start' });
    h += DK.arrow(cx + 70, 30, cx + 20, 30, 'dim') + DK.text(cx + 74, 34, 'feed ' + dcL(fr, sys === 'inch' ? 'in/rev' : 'mm/rev', 'f'), { cls: 'dimt', anchor: 'start' });
    h += DK.text(14, H - 8, 'Nose and feed to scale', { cls: 'mut', anchor: 'start' });
    // Profile enlarged.
    const x0 = 300, cw = 60, sg = 30, rr = (cw * cw / 4 + sg * sg) / (2 * sg), yv = 120, c0 = x0 + 22;
    const dp = [];
    for (let x = x0; x <= 506; x += 1) { const i = Math.round((x - c0) / cw), dx = x - (c0 + i * cw); dp.push([x, yv - rr + Math.sqrt(Math.max(0, rr * rr - dx * dx))]); }
    h += DK.text(404, 40, 'profile, height enlarged', { cls: 'mut' });
    h += DK.poly(dp.concat([[506, yv + 24], [x0, yv + 24]]), 'hatch');
    const xp = c0 + cw * 2.5, ym = yv - sg / 3;
    h += DK.cl(x0, ym, 506, ym);
    h += DK.line(xp, yv - sg, xp + 22, yv - sg, 'hot ext') + DK.line(c0 + 3 * cw, yv, xp + 22, yv, 'hot ext');
    h += dcDimV(yv - sg, yv, xp + 16, '', { hot: true }) + DK.text(xp + 22, yv - sg / 2 + 4, 'Rt', { cls: 'hott', anchor: 'start' });
    h += DK.dimH(c0 + cw, c0 + 2 * cw, yv + 46, 'f', { from: yv + 2 });
    h += DK.text(c0 + 2 * cw + 8, yv + 50, 'feed marks', { cls: 'mut', anchor: 'start' });
    h += DK.text(310, 210, 'Ra ' + (dcOk(ra) ? dcN(ra) + ' ' + mu : '?'), { cls: 'hott', anchor: 'start' });
    h += dcLines(310, 228, [dcOk(rt) ? 'Rt ' + dcN(rt) + ' ' + mu + ' peak to valley' : '', dcOk(v.ra) && dcOk(fr) ? 'feed ' + dcN(fr) + ' for Ra ' + dcN(v.ra) : '', 'dash-dot: mean line']);
    return DK.svg(W, H, h, 'Surface finish: feed marks left by the nose radius');
  },

  // Pass time: the part in the chuck, the tool travelling the length of cut at f per rev.
  passtime(v, sys, rows) {
    const W = 520, H = 260, u = dcU(sys), cy = 120, R = 44, x0 = 64, xe = 392, xs = 170;
    const t = dcRow(rows, 'Cut time', 'min'), ts = dcRow(rows, 'Cut time', 's');
    let h = dcChuck(x0, cy, R) + DK.rect(x0, cy - R, xe - x0, 2 * R, 'part') + DK.cl(x0 - 44, cy, xe + 40, cy);
    h += DK.rect(xs, cy - R, xe - xs, 5, 'ghost');
    h += dcInsert(xs, cy - R, 34, 1, false, 'ghost') + dcInsert(xe, cy - R, 34, 1, 40);
    h += DK.dimH(xs, xe, 24, 'L ' + dcL(v.len, u, 'L'), { from: cy - R - 4 });
    h += DK.arrow(xe - 30, cy + R + 22, xs + 4, cy + R + 22, 'dim') + DK.text((xs + xe) / 2, cy + R + 40, (dcOk(v.f) ? dcN(v.f) + ' ' + (sys === 'inch' ? 'in/rev' : 'mm/rev') : 'f') + ' at ' + (dcOk(v.rpm) ? dcN(v.rpm, 0) : 'n') + ' RPM', { cls: 'dimt' });
    h += dcTurnSpin(xe + 26, cy, R - 10);
    h += DK.text(20, 236, 'cut time ' + (dcOk(t) ? dcN(t) + ' min' : 'T') + (dcOk(ts) ? ' = ' + dcN(ts, 1) + ' s' : ''), { cls: 'hott', anchor: 'start' });
    h += DK.text(20, 252, 'T = L / (f × n)', { cls: 'mut', anchor: 'start' });
    return DK.svg(W, H, h, 'Cut time for a turning pass');
  },

  // Taper: the part to scale with both diameters, the length, the half angle at the slide and the included angle.
  taper(v, sys, rows) {
    const W = 520, H = 270, u = dcU(sys), ok = dcOk(v.D) && dcOk(v.d) && dcOk(v.L) && v.D > v.d;
    const inc = dcRow(rows, 'Included angle'), half = dcRow(rows, 'Half angle'), tpl = dcRow(rows, 'Taper per unit length');
    const s = ok ? Math.min(280 / v.L, 150 / v.D) : 1, Lp = ok ? Math.max(40, v.L * s) : 260, Dp = ok ? Math.max(20, v.D * s) : 140, dp = ok ? Math.max(6, v.d * s) : 70;
    const cy = 128, x0 = 60, x1 = x0 + Lp;
    let h = DK.poly([[x0, cy - Dp / 2], [x1, cy - dp / 2], [x1, cy + dp / 2], [x0, cy + Dp / 2]], 'part') + DK.cl(x0 - 16, cy, x1 + 70, cy);
    h += dcDimV(cy - Dp / 2, cy + Dp / 2, x0 - 24, 'Ø ' + dcL(v.D, u, 'D'), { from: x0 - 2 });
    h += DK.dimH(x0, x1, cy + Dp / 2 + 30, 'L ' + dcL(v.L, u, 'L'), { from: cy + Math.max(Dp, dp) / 2 + 2, below: true });
    // Half angle at the small end, against a line parallel to the axis.
    const tang = Math.atan2((Dp - dp) / 2, Lp) * 180 / Math.PI;
    const ra = Math.min(Lp - 10, 120), am = dcRad(180 - tang / 2);
    h += DK.line(x1, cy - dp / 2, x1 - ra - 12, cy - dp / 2, 'thin') + DK.angle(x1, cy - dp / 2, ra, 180 - tang, 180, '', { hot: true });
    h += DK.leader(x1 + ra * Math.cos(am), cy - dp / 2 - ra * Math.sin(am), Math.max(150, x1 - ra - 20), Math.max(20, cy - Dp / 2 - 20), 'half ' + (dcOk(half) ? dcN(half) + '°' : 'α/2') + ' (slide)', { hot: true, anchor: 'end' });
    // Small diameter: dimension on the right with room for the apex lines.
    h += dcDimV(cy - dp / 2, cy + dp / 2, x1 + 26, dp > 50 ? 'Ø ' + dcL(v.d, u, 'd') : '', { from: x1 + 2 });
    if (dp <= 50) h += DK.text(x1 + 34, cy + dp / 2 + 18, 'Ø ' + dcL(v.d, u, 'd'), { cls: 'dimt', anchor: 'start' });
    const xa = x1 + (dp / 2) / Math.max(Math.tan(dcRad(tang)), 1e-6);
    if (xa < 500) { h += DK.line(x1, cy - dp / 2, xa, cy, 'ghost') + DK.line(x1, cy + dp / 2, xa, cy, 'ghost') + DK.text(Math.min(xa + 6, 506), cy + 4, '', { cls: 'mut' }); }
    h += DK.text(372, 214, 'included ' + (dcOk(inc) ? dcN(inc) + '°' : 'α'), { cls: 'hott', anchor: 'start' });
    h += dcLines(372, 232, [dcOk(tpl) ? 'taper ' + dcN(tpl) + ' ' + (sys === 'inch' ? 'in/in' : 'mm/mm') : '', dcOk(tpl) ? '(on the diameter)' : '', ok ? 'drawn to scale' : '']);
    return DK.svg(W, H, h, 'Taper: diameters, length and angles');
  },

  // Bar stock: the whole bar to scale cut into parts with the scrap end; one part's share of bar enlarged.
  bar(v, sys, rows) {
    const W = 520, H = 280, u = dcU(sys);
    if (!(dcOk(v.bar) && dcOk(v.part))) return '';
    const n = dcRow(rows, 'Parts per bar'), per = dcRow(rows, 'Bar used per part'), scrap = dcRow(rows, 'Scrap per bar', u), pct = dcRow(rows, 'Scrap per bar', '%');
    const x0 = 20, x1 = 500, yb = 52, hb = 24, k = (x1 - x0) / v.bar, start = dcOk(v.start) ? v.start : 0, rem = dcOk(v.rem) ? v.rem : 0;
    let h = DK.rect(x0, yb, x1 - x0, hb, 'part');
    const xs = x0 + Math.min(start * k, x1 - x0), pw = dcOk(per) ? per * k : 0, xsc = Math.min(x1, xs + (n > 0 ? n * pw : 0));
    if (start > 0) h += DK.rect(x0, yb, xs - x0, hb, 'hatch');
    if (n > 0 && pw >= 3) for (let i = 1; i < n; i++) h += DK.line(xs + i * pw, yb + 3, xs + i * pw, yb + hb - 3, 'thin');
    if (rem > 0) h += DK.rect(Math.max(xsc, x1 - rem * k), yb, x1 - Math.max(xsc, x1 - rem * k), hb, 'hatch');
    if (x1 - xsc > 0.5) h += DK.rect(xsc, yb, x1 - xsc, hb, 'hot');
    if (n > 0) h += DK.text((xs + xsc) / 2, yb - 8, dcN(n, 0) + ' parts', { cls: 'hott' });
    h += DK.text(x1, yb - 8, dcOk(scrap) ? 'scrap ' + dcN(scrap) + ' ' + u + (dcOk(pct) ? ' (' + dcN(pct, 1) + '%)' : '') : '', { cls: 'hott', anchor: 'end' });
    h += DK.dimH(x0, x1, yb + hb + 20, 'bar ' + dcL(v.bar, u, ''), { from: yb + hb + 2, below: true });
    if (rem > 0) h += DK.text(x0, yb - 8, 'remnant ' + dcN(rem) + ' ' + u + ' (hatched)', { cls: 'mut', anchor: 'start' });
    if (start > 0) h += DK.text(x0 + 2, yb + hb + 15, 'start facing', { cls: 'mut', anchor: 'start' });
    // One part's share, enlarged: facing allowance, the part, the cut-off kerf with the parting blade.
    const face = dcOk(v.face) ? v.face : 0, cut = dcOk(v.cut) ? v.cut : 0, tot = v.part + face + cut, ya = 150, ha = 46, xa = 96, xb = 470;
    const k2 = (xb - xa) / tot, wf = face > 0 ? Math.max(12, face * k2) : 0, wc = cut > 0 ? Math.max(12, cut * k2) : 0, wp = xb - xa - wf - wc;
    h += DK.text(xa, 118, 'one part, enlarged', { cls: 'mut', anchor: 'start' });
    h += DK.rect(xa - 26, ya, 26, ha, 'ghost') + DK.rect(xb, ya, 26, ha, 'ghost');
    if (wf) h += DK.rect(xa, ya, wf, ha, 'hatch');
    h += DK.rect(xa + wf, ya, wp, ha, 'part') + DK.cl(xa - 30, ya + ha / 2, xb + 30, ya + ha / 2);
    if (wc) h += DK.rect(xb - wc, ya, wc, ha, 'hatch') + DK.rect(xb - wc, ya - 26, wc, ha / 2 + 26, 'tool');
    h += DK.dimH(xa + wf, xb - wc, ya + ha + 20, 'part ' + dcL(v.part, u, ''), { from: ya + ha + 2, below: true });
    if (wf) h += DK.leader(xa + wf / 2, ya + 6, xa + 40, ya - 18, 'face ' + dcN(face), { anchor: 'start' });
    if (wc) h += DK.leader(xb - wc / 2, ya - 26, xb - 40, ya - 36, 'cut-off ' + dcN(cut), { anchor: 'end' });
    h += DK.dimH(xa, xb, ya + ha + 50, 'bar per part ' + dcL(per, u, '?'), { from: ya + ha + 26, below: true, hot: true });
    // Section of the bar.
    const sx = 40, sy = ya + ha / 2, sr = 15;
    h += v.shape === 2 ? DK.poly([0, 1, 2, 3, 4, 5].map(i => [sx + sr / Math.cos(Math.PI / 6) * Math.cos(Math.PI / 3 * i), sy + sr / Math.cos(Math.PI / 6) * Math.sin(Math.PI / 3 * i)]), 'part')
      : v.shape === 3 ? DK.rect(sx - sr, sy - sr, 2 * sr, 2 * sr, 'part') : DK.circle(sx, sy, sr, 'part');
    h += DK.text(sx, sy + sr + 30, (v.shape === 1 || !v.shape ? 'Ø ' : 'A/F ') + dcL(v.size, u, ''), { cls: 'dimt' });
    const cost = dcRow(rows, 'Material cost per part');
    if (dcOk(cost)) h += DK.text(x1, H - 6, 'material cost ' + dcN(cost) + ' per part', { cls: 'mut', anchor: 'end' });
    return DK.svg(W, H, h, 'Bar stock: parts per bar, scrap and the bar used per part');
  },

  // Lathe feed: feed marks f apart on the turned diameter (enlarged), the spindle speed and the feed per minute.
  lathefeed(v, sys, rows) {
    const W = 520, H = 250, cy = 112, R = 48, x0 = 64, xe = 430, xt = 240, st = 6, fu = sys === 'inch' ? 'in/rev' : 'mm/rev';
    const n = dcOk(v.rpm) ? v.rpm : dcRow(rows, 'Spindle speed at that diameter'), vf = dcRow(rows, 'Feed per minute'), fr = dcOk(v.f) ? v.f : dcRow(rows, 'Feed per revolution');
    let h = dcChuck(x0, cy, R) + DK.poly([[x0, cy - R], [xt, cy - R], [xt, cy - R + st], [xe, cy - R + st], [xe, cy + R - st], [xt, cy + R - st], [xt, cy + R], [x0, cy + R]], 'part');
    const fp = 18;
    for (let x = xt + fp; x < xe - 2; x += fp) h += DK.line(x, cy - R + st, x - 9, cy + R - st, 'thin');
    h += DK.cl(x0 - 44, cy, xe + 34, cy) + dcInsert(xt, cy - R + st, 34, 1, 34);
    h += DK.dimH(xt + 6 * fp, xt + 7 * fp, cy - R - 14, '', { from: cy - R + st - 2 }) + DK.text(xt + 7 * fp + 22, cy - R - 10, 'f ' + dcL(fr, fu, 'f'), { cls: 'dimt', anchor: 'start' });
    h += dcTurnSpin(xe + 18, cy, R - 12) + DK.text(xe + 4, cy + R + 22, dcOk(n) ? dcN(n, 0) + ' RPM' : 'n', { cls: 'dimt' });
    h += DK.arrow(xt - 4, cy + R + 22, xt - 120, cy + R + 22, 'hot') + DK.text(xt - 62, cy + R + 40, dcOk(vf) ? 'Vf ' + dcN(vf) + ' ' + dcFU(sys) : 'Vf = f × n', { cls: 'hott' });
    if (dcOk(v.speed) && dcOk(v.dia) && !dcOk(v.rpm)) h += DK.text(20, H - 8, 'at Ø ' + dcN(v.dia) + ' ' + dcU(sys) + ' and ' + dcN(v.speed) + ' ' + dcSU(sys), { cls: 'mut', anchor: 'start' });
    h += DK.text(W - 8, H - 8, 'feed marks enlarged', { cls: 'mut', anchor: 'end' });
    return DK.svg(W, H, h, 'Lathe feed per revolution and per minute');
  },

  // Part-off and groove time: the blade plunging from the start diameter to the end diameter (diameters to scale),
  // and the spindle speed against the diameter with the speed limit. The curve only shows the shape; every number is a row.
  partofftime(v, sys, rows) {
    const W = 520, H = 270, u = dcU(sys), ok = dcOk(v.d0) && v.d1 >= 0 && v.d0 > v.d1, css = v.mode !== 0;
    const ts = dcRow(rows, 'Cutting time', 's'), tm = dcRow(rows, 'Cutting time', 'min');
    const n0 = css ? dcRow(rows, 'Spindle speed at the start diameter') : v.rpm, n1 = dcRow(rows, 'Spindle speed at the end diameter');
    const lim = dcRow(rows, 'Speed limit used'), dlim = dcRow(rows, 'Diameter where the limit is reached');
    const cy = 122, R0 = 60, R1 = ok ? Math.max(1.5, R0 * v.d1 / v.d0) : 12, x0 = 62, xb = 170, bw = 12, xe = 232;
    let h = dcChuck(x0, cy, R0);
    h += DK.poly([[x0, cy - R0], [xb, cy - R0], [xb, cy - R1], [xb + bw, cy - R1], [xb + bw, cy - R0], [xe, cy - R0], [xe, cy + R0], [xb + bw, cy + R0], [xb + bw, cy + R1], [xb, cy + R1], [xb, cy + R0], [x0, cy + R0]], 'part');
    h += DK.cl(x0 - 44, cy, xe + 44, cy);
    h += DK.rect(xb + 1.5, cy - R0 - 40, bw - 3, R0 - R1 + 40, 'tool') + DK.rect(xb - 9, cy - R0 - 56, bw + 18, 16, 'part');
    h += DK.arrow(xb + bw + 16, cy - R0 - 44, xb + bw + 16, cy - R0 - 10, 'hot');
    h += DK.text(xb + bw + 24, cy - R0 - 24, dcOk(v.f) ? 'f ' + dcN(v.f) + ' ' + (sys === 'inch' ? 'in/rev' : 'mm/rev') : 'f', { cls: 'hott', anchor: 'start' });
    h += dcDimV(cy - R0, cy + R0, xe + 20, 'Ø ' + dcL(v.d0, u, 'D'), { from: xe + 2 });
    h += DK.leader(xb + bw / 2, cy + R1, xb + bw / 2, cy + R0 + 20, ok ? (v.d1 > 0 ? 'to Ø ' + dcN(v.d1) + ' ' + u : 'to the centre') : 'to Ø d', { anchor: 'middle' });
    // Spindle speed against the diameter, start diameter on the left.
    const gx0 = 336, gx1 = 500, gt = 44, gb = 168, live = ok && dcOk(n0);
    const D0 = live ? v.d0 : 1, D1 = live ? v.d1 : 0, N0 = live ? n0 : 1, cap = css ? (live ? (dcOk(lim) ? lim : Infinity) : 3) : N0;
    const nEnd = css ? Math.min(D1 > 0 ? N0 * D0 / D1 : Infinity, cap) : N0, open = !isFinite(nEnd), top = open ? 4 * N0 : nEnd * (css ? 1 : 1.6);
    const X = d => gx0 + (gx1 - gx0) * (D0 - d) / (D0 - D1), Y = n => gb - (gb - gt) * Math.min(n, top) / top;
    h += DK.line(gx0, gt - 14, gx0, gb, 'thin') + DK.line(gx0, gb, gx1 + 8, gb, 'thin') + DK.text(gx0 + 6, gt - 12, 'RPM', { cls: 'mut', anchor: 'start' });
    const pts = [];
    for (let i = 0; i <= 80; i++) { const d = D0 - (D0 - D1) * i / 80, n = css ? Math.min(d > 0 ? N0 * D0 / d : Infinity, cap) : N0; if (n > top * 1.0001) break; pts.push([X(d), Y(n)]); }
    h += dcPl(pts, 'hot');
    if (open && pts.length) { const q = pts[pts.length - 1]; h += DK.arrow(q[0], q[1] + 1, q[0] + 2, gt - 12, 'hot'); }
    if (css && isFinite(cap) && nEnd >= cap * 0.9999) {
      const dl = live && dcOk(dlim) ? dlim : D0 * N0 / cap, xl = X(Math.max(D1, Math.min(D0, dl)));
      h += DK.line(gx0, Y(cap), gx1, Y(cap), 'hid') + DK.line(xl, Y(cap), xl, gb, 'hid') + DK.circle(xl, Y(cap), 2.6, 'hotf');
      if (!live) h += DK.text(xl, gb + 15, 'limit reached', { cls: 'dimt' });
    }
    h += DK.text(gx0, gb + 15, live ? 'Ø ' + dcN(v.d0) : 'start', { cls: 'mut', anchor: 'start' }) + DK.text(gx1 + 8, gb + 15, live ? (v.d1 > 0 ? 'Ø ' + dcN(v.d1) : 'centre') : 'end', { cls: 'mut', anchor: 'end' });
    h += dcLines(gx0, gb + 38, [
      live ? (css ? 'start ' : 'constant ') + dcN(n0, 0) + ' RPM' : '',
      live && css && dcOk(lim) ? 'limit ' + dcN(lim, 0) + ' RPM' + (dcOk(dlim) && dlim > v.d1 && dlim < v.d0 ? ' below Ø ' + dcN(dlim) + ' ' + u : '') : (live && css && !dcOk(n1) ? 'no limit: rpm rises without end' : ''),
      live && css && dcOk(n1) ? 'end ' + dcN(n1, 0) + ' RPM' : '',
    ], { cls: 'txt' });
    h += DK.text(20, 236, 'cutting time ' + (dcOk(ts) ? dcN(ts, 1) + ' s' : 'T') + (dcOk(tm) ? ' = ' + dcN(tm) + ' min' : ''), { cls: 'hott', anchor: 'start' });
    h += DK.text(20, 254, css ? 'G96: the rpm rises as the diameter falls' : 'G97: T = (D - d) / (2 f n)', { cls: 'mut', anchor: 'start' });
    return DK.svg(W, H, h, 'Part-off: blade travel and spindle speed against diameter');
  },

  // Multi-pass turning: the part to scale with the stock divided into equal passes, and each pass's time.
  roughtime(v, sys, rows) {
    const W = 520, H = 290, u = dcU(sys), ok = dcOk(v.d0) && v.d1 >= 0 && v.d0 > v.d1 && dcOk(v.len);
    const n = dcRow(rows, 'Passes'), dep = dcRow(rows, 'Depth of cut per pass'), tot = dcRow(rows, 'Total cutting time', 'min'), tots = dcRow(rows, 'Total cutting time', 's');
    const passes = rows.filter(r => /^Pass \d+ to/.test(r.label));
    const s = ok ? Math.min(230 / v.len, 180 / v.d0) : 1, Lp = ok ? v.len * s : 220, R0 = ok ? v.d0 / 2 * s : 80, R1 = ok ? Math.max(1, v.d1 / 2 * s) : 56;
    const cy = 136, x0 = 56, xe = x0 + 30 + Lp, xc = xe - Lp;
    let h = dcChuck(x0, cy, R0) + DK.poly([[x0, cy - R0], [xc, cy - R0], [xc, cy - R1], [xe, cy - R1], [xe, cy + R1], [xc, cy + R1], [xc, cy + R0], [x0, cy + R0]], 'part');
    h += DK.rect(xc, cy - R0, Lp, R0 - R1, 'ghost') + DK.rect(xc, cy + R1, Lp, R0 - R1, 'ghost') + DK.cl(x0 - 44, cy, xe + 14, cy);
    const N = dcOk(n) ? Math.round(n) : 3, band = (R0 - R1) / N;
    for (let i = 1; i < N && band >= 2.5; i++) h += DK.line(xc, cy - R0 + i * band, xe, cy - R0 + i * band, 'hid');
    h += DK.rect(xc, cy - R0, Lp, band, 'hot');
    if (band >= 12 && N <= 12) for (let i = 0; i < N; i++) h += DK.text(xc + Lp / 2, cy - R0 + (i + 0.5) * band + 4, String(i + 1), { cls: i === 0 ? 'hott' : 'mut' });
    h += dcInsert(xe, cy - R0 + band, 30, 1, 22);
    h += dcDimV(cy - R1, cy + R1, xe + 16, R1 > 30 ? 'Ø ' + dcL(v.d1, u, '') : '', { from: xe + 2 });
    h += dcDimV(cy - R0, cy + R0, xe + 40, 'Ø ' + dcL(v.d0, u, ''), { from: xe + 2 });
    h += DK.dimH(xc, xe, cy + R0 + 22, 'L ' + dcL(v.len, u, ''), { from: cy + R0 + 2, below: true });
    const x = 380;
    h += DK.text(x, 26, dcOk(tot) ? 'total ' + dcN(tot) + ' min' : 'total time', { cls: 'hott', anchor: 'start' });
    if (dcOk(tots)) h += DK.text(x, 42, '= ' + dcN(tots, 1) + ' s', { cls: 'hott', anchor: 'start' });
    h += dcLines(x, 66, [dcOk(n) ? dcN(n, 0) + ' passes of ' + dcN(dep) + ' ' + u : ''], { cls: 'txt' });
    passes.slice(0, 10).forEach((r, i) => { h += DK.text(x, 88 + i * 15, 'pass ' + (i + 1) + ':  ' + dcN(r.value, 1) + ' s', { cls: i === 0 ? 'hott' : 'mut', anchor: 'start' }); });
    if (passes.length > 10 || n > 10) h += DK.text(x, 88 + 10 * 15, '…', { cls: 'mut', anchor: 'start' });
    return DK.svg(W, H, h, 'Multi-pass turning: passes and cutting time');
  },

  // Boring bar: section through the bore, the bar clamped in its holder, the cutting force at the tip and the bent bar (exaggerated).
  boringbar(v, sys, rows) {
    const W = 520, H = 280, u = dcU(sys), ok = dcOk(v.d) && dcOk(v.L), s = ok ? Math.min(290 / v.L, 52 / v.d) : 1;
    const Lp = ok ? v.L * s : 250, dp = ok ? Math.max(10, v.d * s) : 40, cy = 128, xh = Math.min(420, 236 + Lp / 2), xt = xh - Lp, rb = dp / 2 + 24;
    // The bend drawn grows with the share of the allowed deflection (a core result), so the bar visibly bends as the overhang is dragged.
    const sh = dcRow(rows, 'Share of the allowed deflection'), e = dcOk(sh) ? dcClamp(3 + 0.17 * sh, 3, 30) : 16;
    const dt = dcRow(rows, 'Tip deflection, tangential'), dr = dcRow(rows, 'Tip deflection, radial'), ld = dcRow(rows, 'Overhang L/D'), du = sys === 'inch' ? 'thou' : 'µm';
    const F = dcOk(v.F) ? v.F : dcRow(rows, 'Tangential force Fc'), fU = sys === 'inch' ? 'lbf' : 'N';
    let h = DK.rect(xt - 36, cy - rb - 30, Math.max(20, xh - 60 - xt + 36), 30, 'hatch') + DK.rect(xt - 36, cy + rb, Math.max(20, xh - 60 - xt + 36), 30, 'hatch');
    h += DK.rect(xh, cy - dp / 2 - 26, 60, dp + 52, 'hatch');
    const bend = t => e * t * t * (3 - t) / 2, gl = k => { const p = []; for (let i = 0; i <= 30; i++) { const t = i / 30, x = xh - t * Lp; p.push([x, cy + k * dp / 2 + bend(t)]); } return p; };
    h += DK.rect(xt, cy - dp / 2, Lp, dp, 'part');
    if (dcOk(v.di) && v.di < v.d) { const hi = dp * v.di / v.d / 2; h += DK.line(xt, cy - hi, xh + 50, cy - hi, 'hid') + DK.line(xt, cy + hi, xh + 50, cy + hi, 'hid'); }
    h += dcPl(gl(-1), 'ghost') + dcPl(gl(1), 'ghost') + DK.cl(xt - 46, cy, xh + 70, cy);
    h += dcInsert(xt + 4, cy - rb, 26, -1, false, 'tool', 180);
    h += DK.arrow(xt + 12, cy + dp / 2 + 6, xt + 12, cy + dp / 2 + 20 + 2, 'dim') + DK.text(xt + 20, cy + dp / 2 + 22, 'Fc ' + dcL(F, fU, ''), { cls: 'dimt', anchor: 'start' });
    h += dcDimV(cy, cy + e, xt - 18, '', { hot: true, from: xt - 2 }) + DK.text(xt - 24, cy + e + 18, 'δ', { cls: 'hott', anchor: 'end' });
    h += DK.dimH(xt, xh, 24, 'overhang ' + dcL(v.L, u, 'L') + (dcOk(ld) ? ' = ' + dcN(ld, 2) + ' × D' : ''), { from: cy - dp / 2 - 2 });
    h += dcDimV(cy - dp / 2, cy + dp / 2, xh - 22, '', { from: xh - 22 }) + DK.leader(xh - 22, cy + dp / 2, xh - 6, cy + rb + 44, 'Ø ' + dcL(v.d, u, 'd'), { anchor: 'start' });
    h += DK.text(20, H - 38, dcOk(dt) ? 'δ ' + dcN(dt) + ' ' + du + ' at the edge (tangential)' + (dcOk(sh) ? ', ' + dcN(sh, 0) + ' % of the allowed' : '') : 'δ: pick the work material, or type the force', { cls: 'hott', anchor: 'start' });
    if (dcOk(dr)) h += DK.text(20, H - 22, 'radial ' + dcN(dr) + ' ' + du + ', combined ' + dcN(dcRow(rows, 'Combined tip deflection')) + ' ' + du, { cls: 'mut', anchor: 'start' });
    const chk = dcStr(rows, 'Check');
    h += DK.text(20, H - 6, chk ? 'Past the bar makers\' overhang guidance: see the results.' : 'Bent shape exaggerated; holder flex not included.', { cls: 'mut', anchor: 'start' });
    return DK.svg(W, H, h, 'Boring bar: overhang, cutting force and tip deflection');
  },

  // C axis: end view of the part with the live tool at the rim, C rotation and the surface feed; the G93 move unrolled.
  caxis(v, sys, rows) {
    const W = 520, H = 270, u = dcU(sys), cx = 128, cy = 158, R = 84;
    const cdeg = dcOk(v.vf) ? dcRow(rows, 'C-axis feed') : v.deg, vf = dcOk(v.vf) ? v.vf : dcRow(rows, 'Feed along the surface');
    let h = DK.circle(cx, cy, R, 'part') + DK.cl(cx - R - 14, cy, cx + R + 14, cy) + DK.cl(cx, cy - R - 14, cx, cy + R + 14);
    h += dcEndMill(cx, cy - R - 54, 54, 18, 30) + DK.circle(cx, cy - R, 2.5, 'hotf');
    h += dcSpin(cx, cy, R + 14, R + 14, 120, 40, 'hot') + DK.text(cx + R + 4, cy - R + 2, 'C ' + (dcOk(cdeg) ? dcN(cdeg) + ' °/min' : ''), { cls: 'hott', anchor: 'start' });
    h += DK.arrow(cx + 12, cy - R, cx + 70, cy - R, 'dim') + DK.text(cx + 14, cy - R + 16, dcOk(vf) ? dcN(vf) + ' ' + dcFU(sys) : 'Vf', { cls: 'dimt', anchor: 'start' });
    h += DK.dim(cx + R * Math.cos(dcRad(210)), cy - R * Math.sin(dcRad(210)), cx + R * Math.cos(dcRad(30)), cy - R * Math.sin(dcRad(30)), 'Ø ' + dcL(v.d, u, 'D'), { below: true });
    const rev = dcRow(rows, 'C-axis speed');
    if (dcOk(rev)) h += DK.text(14, H - 6, '= ' + dcN(rev) + ' rev/min', { cls: 'mut', anchor: 'start' });
    // G93 move unrolled: linear distance against the arc length on the surface.
    const F = dcRow(rows, 'G93 inverse time F'), mt = dcRow(rows, 'Move time');
    if ((dcOk(v.lin) || dcOk(v.ang)) && dcOk(v.d)) {
      const arc = dcOk(v.ang) ? Math.PI * v.d * v.ang / 360 : 0, lin = dcOk(v.lin) ? v.lin : 0, k = Math.min(170 / Math.max(arc, 1e-9), 130 / Math.max(lin, 1e-9));
      const aw = Math.max(arc * k, 0), lh = Math.max(lin * k, 0), x0 = 312, y0 = 190;
      h += DK.text(410, 26, 'G93 move, surface unrolled', { cls: 'mut' });
      h += DK.line(x0, y0, x0 + Math.max(aw, 30), y0, 'thin') + DK.line(x0, y0, x0, y0 - Math.max(lh, 30), 'thin');
      h += DK.arrow(x0, y0, x0 + aw, y0 - lh, 'hot') + DK.circle(x0, y0, 2.5, 'hotf');
      if (aw > 0) h += DK.dimH(x0, x0 + aw, y0 + 18, 'C ' + dcN(v.ang) + '°', { from: y0 + 2, below: true });
      if (lh > 0) h += dcDimV(y0 - lh, y0, x0 - 16, 'linear ' + dcN(lin), { from: x0 - 2 });
      h += DK.text(x0 + aw / 2 - 8, y0 - lh / 2 - 8, dcOk(F) ? 'F ' + dcN(F) : '', { cls: 'hott', anchor: 'end' });
      if (dcOk(mt)) h += DK.text(506, H - 6, 'move time ' + dcN(mt) + ' s', { cls: 'hott', anchor: 'end' });
    } else h += dcLines(312, 70, ['Add a G93 move (linear', 'distance and C rotation) to', 'see the inverse time feed.']);
    return DK.svg(W, H, h, 'C axis feed: rotation and feed along the surface');
  },

  // Removal rate: the part turning, the depth of cut ap and feed f per rev forming the chip section, speed at the surface.
  mrr(v, sys, rows) {
    const W = 520, H = 290, u = dcU(sys), cy = 142, R0 = 62, ap = 18, x0 = 66, xe = 404, xt = 250, fp = 16, fu = sys === 'inch' ? 'in/rev' : 'mm/rev';
    const R1 = R0 - ap, q = (rows.find(r => r.label === 'Material removal rate') || {}), kw = dcRow(rows, 'Power at the spindle', 'kW'), hp = dcRow(rows, 'Power at the spindle', 'hp');
    let h = dcChuck(x0, cy, R0) + DK.poly([[x0, cy - R0], [xt, cy - R0], [xt, cy - R1], [xe, cy - R1], [xe, cy + R1], [xt, cy + R1], [xt, cy + R0], [x0, cy + R0]], 'part');
    h += DK.rect(xt, cy - R0, xe - xt, ap, 'ghost') + DK.rect(xt, cy + R1, xe - xt, ap, 'ghost') + DK.cl(x0 - 44, cy, xe + 30, cy);
    h += DK.rect(xt - fp, cy - R0, fp, ap, 'hatch') + DK.rect(xt - fp, cy - R0, fp, ap, 'hot');
    h += dcInsert(xt, cy - R1, 36, 1, 30);
    h += dcDimV(cy - R0, cy - R1, xe + 18, '', { from: xe - 2 }) + DK.text(xe + 24, cy - R0 + ap / 2 + 4, 'ap ' + dcL(v.doc, u, ''), { cls: 'dimt', anchor: 'start' });
    h += DK.dimH(xt - fp, xt, cy - R0 - 18, '', { from: cy - R0 - 2 }) + DK.text(xt - fp - 24, cy - R0 - 14, 'f ' + dcL(v.f, fu, ''), { cls: 'dimt', anchor: 'end' });
    h += DK.leader(xt - fp / 2, cy - R0 + ap / 2 + 2, xt - 40, cy - 6, 'chip section ap × f', { hot: true, anchor: 'end' });
    h += dcTurnSpin(xe - 40, cy, R1) + DK.text(xe + 10, cy + R1 + 14, dcL(v.speed, dcSU(sys), 'Vc'), { cls: 'dimt', anchor: 'start' });
    h += DK.arrow(xt - 20, cy + R0 + 20, xt - 100, cy + R0 + 20, 'dim') + DK.text(xt - 16, cy + R0 + 24, 'feed', { cls: 'mut', anchor: 'start' });
    h += DK.text(14, H - 24, isFinite(q.value) ? 'Q ' + dcN(q.value) + ' ' + dcUnit(q.unit) : 'Q = Vc × ap × f', { cls: 'hott', anchor: 'start' });
    h += DK.text(14, H - 8, dcOk(kw) ? 'power at the spindle ' + dcN(kw) + ' kW' + (dcOk(hp) ? ' (' + dcN(hp) + ' hp)' : '') : 'Enter kc for the power.', { cls: dcOk(kw) ? 'hott' : 'mut', anchor: 'start' });
    return DK.svg(W, H, h, 'Material removal rate in turning');
  },
});

// Saw teeth along a straight edge from x0 to x1 at y, points down (dir 1) or up (-1), pitch p px.
function dcTeeth(x0, x1, y, p, dir, cls) {
  const pts = [[x0, y]]; let x = x0;
  const dd = Math.min(p * 0.5, 14);
  while (x + p <= x1 + 0.01) { pts.push([x + p * 0.3, y + dir * dd * 0.25], [x + p * 0.8, y + dir * dd], [x + p, y]); x += p; }
  pts.push([x1, y]);
  return dcPl(pts, cls || 'ln');
}

Object.assign(DIAGRAMS, {
  // ---------------- Sawing ----------------
  // Slitting saw: the saw to scale in the slot, the edge in the cut, approach to full depth, rotation and feed.
  slitsaw(v, sys, rows) {
    const W = 520, H = 290, u = dcU(sys), ok = dcOk(v.D) && dcOk(v.ae), k = ok ? dcClamp(v.ae / v.D, 0.015, 0.9) : 0.08;
    const Rs = 104, cx = 150, cy = 142, ys = cy + Rs - 2 * Rs * k, yb = cy + Rs, yp = 278, z = dcOk(v.z) ? v.z : 36;
    const t0 = Math.asin(dcClamp((ys - cy) / Rs, -1, 1)), xi = cx + Rs * Math.cos(t0);
    const arc = []; for (let i = 0; i <= 40; i++) { const t = Math.PI / 2 - (Math.PI / 2 - t0) * i / 40; arc.push([cx + Rs * Math.cos(t), cy + Rs * Math.sin(t)]); }
    let h = DK.poly([[14, yp], [14, yb], [cx, yb]].concat(arc, [[318, ys], [318, yp]]), 'hatch');
    h += dcCutter(cx, cy, Rs, Math.min(z, 72), 0) + DK.circle(cx, cy, Rs * 0.32, 'thin') + DK.cl(cx - Rs - 10, cy, cx + Rs + 10, cy) + DK.cl(cx, cy - Rs - 10, cx, cy + Rs + 6);
    h += dcPl(arc, 'hot') + dcSpin(cx, cy, Rs * 0.5, Rs * 0.5, 150, 30, 'dim');
    h += DK.dimH(cx - Rs, cx + Rs, cy - Rs - 16, 'Ø ' + dcL(v.D, u, 'D'), { from: cy });
    h += dcDimV(ys, yb, 334, '', { from: 318 }) + DK.text(340, (ys + yb) / 2 + 4, 'ae ' + dcL(v.ae, u, ''), { cls: 'dimt', anchor: 'start' });
    const app = dcRow(rows, 'Approach to full depth');
    if (xi - cx > 10) h += DK.dimH(cx, xi, ys - 18, '', { from: ys - 2 }) + DK.text(xi + 6, ys - 22, 'approach' + (dcOk(app) ? ' ' + dcN(app) : ''), { cls: 'dimt', anchor: 'start' });
    const n = dcRow(rows, 'Spindle speed'), vf = dcRow(rows, 'Table feed'), hex = dcRow(rows, 'Max chip thickness hex'), fz = dcRow(rows, 'Feed per tooth for that chip');
    const rc = dcRow(rows, 'Chip thinning factor'), te = dcRow(rows, 'Teeth in the cut'), tc = dcRow(rows, 'Cut time');
    h += DK.arrow(266, 40, 310, 40, 'hot') + DK.text(262, 44, 'feed', { cls: 'mut', anchor: 'end' });
    const x = 376;
    h += DK.text(x, 40, dcOk(vf) ? 'Vf ' + dcN(vf) + ' ' + dcFU(sys) : 'Vf: enter speed, z, fz', { cls: dcOk(vf) ? 'hott' : 'mut', anchor: 'start' });
    h += dcLines(x, 62, [dcOk(n) ? dcN(n, 0) + ' RPM' : '', dcOk(hex) ? 'chip hex ' + dcN(hex) : '', dcOk(fz) ? 'fz ' + dcN(fz) + ' for that chip' : '', dcOk(rc) ? 'RCTF ' + dcN(rc) + ' ×' : '', dcOk(te) ? dcN(te, 2) + ' teeth in the cut' : ''], { cls: 'txt' });
    if (dcOk(tc)) h += DK.text(x, 160, 'cut time ' + dcN(tc) + ' min', { cls: 'hott', anchor: 'start' });
    h += DK.text(W - 6, H - 6, 'to scale; ' + (z > 72 ? '72 of ' + z + ' teeth drawn' : z + ' teeth'), { cls: 'mut', anchor: 'end' });
    return DK.svg(W, H, h, 'Slitting saw in the slot: depth, approach, speed and feed');
  },

  // Bandsaw: the section being cut (to scale), the blade part way through, the down-feed and the time.
  bandsaw(v, sys, rows) {
    const W = 520, H = 280, u = dcU(sys), shape = v.shape === 2 ? 2 : v.shape === 3 ? 3 : 1, a = v.a, b = v.b;
    const ok = dcOk(a) && (shape === 1 || dcOk(b)), cx = 150, cy = 150;
    const ww = shape === 2 ? a : a, hh = shape === 2 ? b : a, s = ok ? Math.min(220 / ww, 170 / hh) : 1, Wp = ok ? ww * s : 160, Hp = ok ? hh * s : 160;
    let h = '';
    const sec = cls => shape === 2 ? DK.rect(cx - Wp / 2, cy - Hp / 2, Wp, Hp, cls) : shape === 3 ? dcRing(cx, cy, Math.max(1, Wp / 2 - (ok ? b * s : 18)), Wp / 2, cls) : DK.circle(cx, cy, Wp / 2, cls);
    const yb = cy - Hp / 2 + Hp * 0.36;
    h += sec('hatch') + '<clipPath id="dcbsc"><rect x="0" y="0" width="' + W + '" height="' + yb.toFixed(1) + '"/></clipPath><g clip-path="url(#dcbsc)">' + sec('part') + '</g>';
    h += DK.cl(cx - Wp / 2 - 12, cy, cx + Wp / 2 + 12, cy) + DK.cl(cx, cy - Hp / 2 - 12, cx, cy + Hp / 2 + 12);
    // Blade a third of the way down, cutting downwards; kerf above it.
    // The blade stops short of the height dimension on the right.
    const xe = Math.min(314, cx + Wp / 2 + 44);
    h += DK.rect(14, yb - 14, xe - 14, 14, 'tool') + dcTeeth(14, xe, yb, 9, 1, 'hot');
    h += DK.arrow(xe - 82, yb - 30, xe - 14, yb - 30, 'dim') + DK.text(xe - 86, yb - 26, 'blade', { cls: 'mut', anchor: 'end' });
    const t1 = dcRow(rows, 'Cut time from the down-feed'), t2 = dcRow(rows, 'Cut time from the cutting rate'), area = (rows.find(r => r.label === 'Area cut') || {});
    h += DK.arrow(34, yb + 4, 34, yb + 50, 'hot') + DK.text(40, yb + 64, 'down-feed', { cls: 'mut', anchor: 'middle' });
    h += DK.text(cx, cy - Hp / 2 - 8, 'cut', { cls: 'mut' });
    h += dcDimV(cy - Hp / 2, cy + Hp / 2, cx + Wp / 2 + 74, 'h ' + dcL(shape === 2 ? b : a, u, 'h'), { from: cx + (shape === 2 ? Wp / 2 : 0) + 2 });
    if (shape !== 2) h += DK.dimH(cx - Wp / 2, cx + Wp / 2, cy + Hp / 2 + 22, 'Ø ' + dcL(a, u, 'D'), { from: cy, below: true });
    else h += DK.dimH(cx - Wp / 2, cx + Wp / 2, cy + Hp / 2 + 22, 'width ' + dcL(a, u, 'W'), { from: cy + Hp / 2 + 2, below: true });
    const x = 360, cpt = dcRow(rows, 'Feed per tooth');
    h += DK.text(x, 40, dcOk(t1) ? 'time ' + dcN(t1) + ' min' : dcOk(t2) ? 'time ' + dcN(t2) + ' min' : 'time: enter a rate', { cls: 'hott', anchor: 'start' });
    h += dcLines(x, 58, [shape === 3 && dcOk(b) ? 'tube wall ' + dcN(b) + ' ' + u : '', dcOk(t1) && dcOk(t2) ? '(' + dcN(t2) + ' min from the rate)' : '', isFinite(area.value) ? 'area ' + dcN(area.value) + ' ' + dcUnit(area.unit) : '', dcOk(v.vf) ? 'down-feed ' + dcN(v.vf) + ' ' + dcFU(sys) : '', dcOk(cpt) ? 'chip per tooth ' + dcN(cpt) : '']);
    return DK.svg(W, H, h, 'Bandsaw cut through a section');
  },

  // Saw pitch: teeth across the thinnest wall and across the longest cut at the pitch (or the coarsest that keeps 3 teeth).
  sawtpi(v, sys, rows) {
    const W = 520, H = 250, u = dcU(sys);
    if (!dcOk(v.thin)) return '';
    const tpi = dcOk(v.tpi) ? v.tpi : dcRow(rows, 'Fewest teeth per inch');
    const nThin = dcOk(v.tpi) ? dcRow(rows, 'Teeth in the thinnest section') : 3, nThick = dcRow(rows, 'Teeth in the longest cut');
    const panel = (x0, w, n, label, val, title) => {
      const y = 120, p = dcOk(n) && n > 0 ? w / n : w / 3;
      let g = DK.text(x0 + w / 2, 30, title, { cls: 'txt' });
      g += DK.rect(x0, y, w, 64, 'hatch');
      const xL = Math.max(8, x0 - Math.min(2.5 * p, 40)), xR = Math.min(512, x0 + w + Math.min(2.5 * p, 40));
      const dd = Math.min(p * 0.5, 14), yT = y - dd;
      if (p >= 3) {
        g += DK.rect(xL, yT - 22, xR - xL, 22, 'tool') + dcTeeth(xL, xR, yT, p, 1, 'hot');
        for (let x = xL + 0.8 * p; x <= xR && p >= 6; x += p) if (x >= x0 - 0.01 && x <= x0 + w + 0.01) g += DK.circle(x, y, 2.2, 'hotf');
      } else g += DK.rect(xL, y - 24, xR - xL, 22, 'tool') + DK.text((xL + xR) / 2, y - 8, 'fine teeth', { cls: 'mut' });
      g += DK.dimH(x0, x0 + w, y + 86, label + ' ' + dcL(val, u, ''), { from: y + 66, below: true });
      g += DK.text(x0 + w / 2, y + 38, dcOk(n) ? dcN(n, 1) + ' teeth' : '', { cls: 'hott' });
      return g;
    };
    let h = panel(40, 150, nThin, 'wall', v.thin, 'thinnest wall');
    if (dcOk(v.thick) && dcOk(nThick)) h += panel(270, 220, nThick, 'cut', v.thick, 'longest cut');
    else if (dcOk(v.thick)) h += dcLines(270, 90, ['Enter a pitch to check to see', 'the teeth in the longest cut.']);
    h += DK.text(14, H - 6, (dcOk(v.tpi) ? 'pitch ' : 'coarsest pitch ') + (dcOk(tpi) ? dcN(tpi, 1) + ' TPI' : '?') + '; at least 3 teeth in the thinnest wall', { cls: dcOk(v.tpi) && nThin < 3 ? 'hott' : 'mut', anchor: 'start' });
    return DK.svg(W, H, h, 'Saw blade pitch: teeth in the wall and in the cut');
  },

  // ---------------- Drilling ----------------
  // Drill point: the drill to scale with its diameter, point angle and the point length.
  drillpoint(v, sys, rows) {
    const W = 520, H = 280, u = dcU(sys), ang = dcOk(v.ang) && v.ang < 180 ? v.ang : 118, r = 56, cx = 190, y0 = 18, ys = 140;
    const lp = Math.min(r / Math.tan(dcRad(ang / 2)), 122), pl = dcRow(rows, 'Point length'), tip = ys + lp;
    let h = DK.poly([[cx - r, y0], [cx + r, y0], [cx + r, ys], [cx, tip], [cx - r, ys]], 'tool');
    for (let y = y0 + 8; y + 22 < ys - 4; y += 26) h += DK.line(cx - r + 1, y, cx + r - 1, y + 22, 'thin');
    h += DK.cl(cx, y0 - 6, cx, Math.min(tip + 14, H - 4)) + DK.line(cx - r, ys, cx + r, ys, 'thin');
    h += dcDimV(ys, tip, cx + r + 40, '', { hot: true, from: cx + 4 }) + DK.line(cx + r + 2, ys, cx + r + 44, ys, 'hot ext');
    h += DK.text(cx + r + 48, (ys + tip) / 2 + 4, 'point ' + dcL(pl, u, '?'), { cls: 'hott', anchor: 'start' });
    h += DK.dimH(cx - r, cx + r, y0 + 40, 'Ø ' + dcL(v.dia, u, 'D'), {});
    const ex = Math.min(150, (tip - ys + 34) * Math.tan(dcRad(ang / 2))), ey = ex / Math.tan(dcRad(ang / 2));
    h += DK.line(cx, tip, cx - ex, tip - ey, 'thin') + DK.line(cx, tip, cx + ex, tip - ey, 'thin');
    h += DK.angle(cx, tip, Math.min(lp + 22, tip - y0 - 60), 90 - ang / 2, 90 + ang / 2, dcN(ang, 2) + '°', {});
    h += dcLines(350, 210, ['Add the point length to the', 'full-diameter depth for the', 'Z depth of a blind hole.']);
    if (lp >= 122) h += DK.text(cx, H - 6, 'point shortened to fit', { cls: 'mut' });
    return DK.svg(W, H, h, 'Drill point length');
  },

  // Spot and centre drill: section through the countersink with the tool in it, the diameter wanted and the depth to program.
  spotdepth(v, sys, rows) {
    const W = 520, H = 270, u = dcU(sys), ang = dcOk(v.ang) && v.ang < 180 ? v.ang : 90, ht = Math.tan(dcRad(ang / 2));
    const centre = v.mode === 2 && dcOk(v.dp) && v.lp >= 0 && dcOk(v.dc) && v.dc > v.dp;
    const dc = dcOk(v.dc) ? v.dc : 1, zc = centre ? v.lp + (v.dc - v.dp) / 2 / ht : dc / 2 / ht;
    const k = Math.min(170 / dc, 150 / Math.max(zc, 1e-9)), cx = 190, top = 70, P = (x, z) => [cx + x * k, top + z * k];
    const depth = dcRow(rows, 'Depth from the tip'), dAt = dcRow(rows, 'Chamfer diameter at that depth') || dcRow(rows, 'Countersink diameter at that depth');
    // Part with the recess.
    let rec;
    if (centre) { const zt = Math.min(v.lp, v.dp / 2 / Math.tan(dcRad(59))); rec = [P(-dc / 2, 0), P(-v.dp / 2, zc - v.lp), P(-v.dp / 2, zc - zt), P(0, zc), P(v.dp / 2, zc - zt), P(v.dp / 2, zc - v.lp), P(dc / 2, 0)]; }
    else rec = [P(-dc / 2, 0), P(0, zc), P(dc / 2, 0)];
    let h = DK.poly([[14, top]].concat(rec, [[360, top], [360, 250], [14, 250]]), 'hatch');
    if (dcOk(v.dh) && v.dh < dc) { const hx = v.dh / 2 * k; h += DK.line(cx - hx, P(0, (dc - v.dh) / 2 / ht)[1], cx - hx, 250, 'hid') + DK.line(cx + hx, P(0, (dc - v.dh) / 2 / ht)[1], cx + hx, 250, 'hid'); }
    // Tool above, following the recess.
    const tw = dc / 2 * 1.25, tz = -(tw - dc / 2) / ht, tl = rec.slice(), y1 = 14;
    h += DK.poly([[cx - tw * k, y1], [cx - tw * k, P(0, tz)[1]]].concat(tl, [[cx + tw * k, P(0, tz)[1]], [cx + tw * k, y1]]), 'tool');
    h += DK.line(14, top, 360, top, 'ln') + DK.cl(cx, y1 - 4, cx, P(0, zc)[1] + 22);
    h += DK.dimH(cx - dc / 2 * k, cx + dc / 2 * k, top + 0, '', {}) + DK.text(cx, top - 8, 'Ø ' + dcL(v.dc, u, 'Dc'), { cls: 'dimt' });
    h += dcDimV(top, P(0, zc)[1], 392, '', { hot: true, from: 362 }) + DK.line(cx + 4, P(0, zc)[1], 392, P(0, zc)[1], 'hot ext');
    h += DK.text(400, (top + P(0, zc)[1]) / 2 + 4, 'z ' + dcL(depth, u, '?'), { cls: 'hott', anchor: 'start' });
    h += DK.text(400, (top + P(0, zc)[1]) / 2 + 20, 'from the tip', { cls: 'mut', anchor: 'start' });
    if (!centre) h += DK.angle(P(0, zc)[0], P(0, zc)[1], 34, 90 - ang / 2, 90 + ang / 2, dcN(ang, 2) + '°', {});
    else { h += DK.text(cx - v.dp / 2 * k - 6, P(0, zc - v.lp / 2)[1], 'pilot Ø ' + dcN(v.dp), { cls: 'dimt', anchor: 'end' }); }
    const cw = dcRow(rows, 'Chamfer width on the hole');
    h += dcLines(380, 196, [dcOk(cw) ? 'chamfer ' + dcN(cw) + ' each side' : '', dcOk(v.z) && dcOk(dAt) ? 'at z ' + dcN(v.z) + ': Ø ' + dcN(dAt) : '', dcStr(rows, 'Centre drill') ? 'Enter the pilot Ø and length.' : '']);
    return DK.svg(W, H, h, 'Spot or centre drill depth');
  },

  // ---------------- Grinding ----------------
  // Wheel to work rpm ratio: the wheel with its high spot; the work drawn with as many waves as the ratio (far too large)
  // when the ratio is close to a whole number or a simple fraction, and round when it is not.
  grindratio(v, sys, rows) {
    const W = 520, H = 270, cy = 122, cx = 104, R0 = 72, rS = 84, cxS = cx + R0 + 3.2 + rS;
    const ratio = dcRow(rows, 'Rpm ratio (wheel'), verdict = dcStr(rows, 'Verdict'), amp = verdict && verdict.indexOf('Close to') !== 0 ? 0 : 3.2;
    const N = dcOk(ratio) ? dcClamp(Math.round(ratio), 2, 40) : 8, M = 360;
    let d = '';
    for (let i = 0; i < M; i++) { const a = i * 2 * Math.PI / M, r = R0 + amp * Math.cos(N * a); d += (i ? 'L' : 'M') + (cx + r * Math.cos(a)).toFixed(1) + ' ' + (cy - r * Math.sin(a)).toFixed(1); }
    let h = DK.path(d + 'Z', 'part') + DK.cl(cx - R0 - 12, cy, cxS + rS + 10, cy) + DK.cl(cx, cy - R0 - 12, cx, cy + R0 + 12) + DK.cl(cxS, cy - rS - 10, cxS, cy + rS + 10);
    h += DK.circle(cxS, cy, rS, 'tool') + DK.circle(cxS, cy, rS * 0.3, 'thin') + dcSpin(cxS, cy, rS * 0.6, rS * 0.6, 140, 40, 'dim') + dcSpin(cx, cy, R0 * 0.55, R0 * 0.55, 220, 320, 'dim');
    // The high spot of the wheel, the once-per-revolution disturbance.
    const ha = 2.45, hx = cxS + rS * Math.cos(ha), hy = cy - rS * Math.sin(ha);
    h += DK.circle(hx, hy, 3.5, 'hotf') + DK.leader(hx, hy, cxS - 10, cy - rS - 26, 'high spot, once per wheel turn', { hot: true, anchor: 'start' });
    const ns = dcRow(rows, 'Wheel rpm for that surface speed'), nsIn = dcOk(v.ns) ? v.ns : ns;
    h += DK.text(cx, cy + R0 + 30, 'work ' + (dcOk(v.nw) ? dcN(v.nw, v.nw % 1 ? 1 : 0) + ' rpm' : 'rpm'), { cls: 'mut' }) + DK.text(cxS, cy + rS + 30, 'wheel ' + (dcOk(nsIn) ? dcN(nsIn, nsIn % 1 ? 1 : 0) + ' rpm' : 'rpm'), { cls: 'mut' });
    const x = cxS + rS + 26, kind = !verdict ? '' : verdict.indexOf('Close to a whole') === 0 ? 'whole number:' : verdict.indexOf('Close to') === 0 ? 'simple fraction:' : 'long decimal:';
    const kind2 = !verdict ? '' : verdict.indexOf('Close to a whole') === 0 ? 'waves build up' : verdict.indexOf('Close to') === 0 ? 'scallops' : 'waves wiped out';
    h += DK.text(x, 70, 'rpm ratio', { cls: 'mut', anchor: 'start' }) + DK.text(x, 96, dcOk(ratio) ? dcN(ratio, 4) : 'ns / nw', { cls: 'txt', anchor: 'start', size: 18 });
    h += dcLines(x, 126, [kind, kind2, '', dcOk(ratio) && amp ? N + ' waves drawn,' : '', dcOk(ratio) && amp ? 'far too large' : '']);
    return DK.svg(W, H, h, 'Grinding wheel and work: the rpm ratio is the number of waves a wheel that runs out leaves per turn of the work');
  },

  // Wheel and work: external, internal or surface, to scale (clamped), with the equivalent diameter as a dashed circle on the contact.
  grindspeed(v, sys, rows) {
    const W = 520, H = 290, u = dcU(sys), mode = v.mode === 1 ? 1 : v.mode === 2 ? 2 : 0, ds = v.ds, dw = v.dw;
    const de = dcRow(rows, 'Equivalent wheel diameter de'), vs = rows.find(r => r.label === 'Wheel surface speed') || {}, vw = rows.find(r => r.label === 'Work surface speed') || {};
    const q = dcRow(rows, 'Speed ratio'), mark = dcStr(rows, 'Marked maximum');
    const cy = 150;
    let h = '', cxW, rW, cxS, rS, contact, k;
    if (mode === 2) {
      rS = 86; cxS = 170; k = dcOk(ds) ? 2 * rS / ds : 1; contact = [cxS, cy - 30 + rS];
      h += DK.rect(30, contact[1], 300, 40, 'hatch') + DK.circle(cxS, cy - 30, rS, 'tool') + DK.circle(cxS, cy - 30, rS * 0.3, 'thin') + dcSpin(cxS, cy - 30, rS * 0.55, rS * 0.55, 140, 40, 'dim');
      h += DK.arrow(250, contact[1] + 56, 310, contact[1] + 56, 'dim') + DK.text(246, contact[1] + 60, 'table', { cls: 'mut', anchor: 'end' });
      cxW = null;
    } else if (mode === 1) {
      const ok = dcOk(ds) && dcOk(dw) && ds < dw; rW = 104; k = ok ? 2 * rW / dw : 1; rS = ok ? Math.max(6, ds * k / 2) : 50; cxW = 170; cxS = cxW + rW - rS; contact = [cxW + rW, cy];
      h += dcRing(cxW, cy, rW, rW + 14) + DK.circle(cxS, cy, rS, 'tool') + DK.cl(cxW - rW - 20, cy, cxW + rW + 20, cy) + DK.cl(cxW, cy - rW - 20, cxW, cy + rW + 20);
    } else {
      const ok = dcOk(ds) && dcOk(dw), tot = ok ? ds + dw : 3; k = 300 / tot; rW = ok ? Math.max(8, dw * k / 2) : 50; rS = ok ? Math.max(8, ds * k / 2) : 100;
      const sc = Math.min(1, 125 / Math.max(rW, rS)); rW *= sc; rS *= sc; k *= sc;
      cxW = 30 + rW; cxS = cxW + rW + rS; contact = [cxW + rW, cy];
      h += DK.circle(cxW, cy, rW, 'part') + DK.circle(cxS, cy, rS, 'tool') + DK.circle(cxS, cy, rS * 0.3, 'thin') + DK.cl(cxW - rW - 10, cy, cxS + rS + 10, cy) + DK.cl(cxW, cy - rW - 10, cxW, cy + rW + 10);
    }
    if (mode !== 2) h += dcSpin(cxS, cy, rS * 0.55, rS * 0.55, 140, 40, 'dim');
    if (mode === 0 && cxW !== null) h += dcSpin(cxW, cy, rW * 0.55, rW * 0.55, 220, 320, 'dim');
    // Equivalent diameter: a dashed circle of diameter de touching the flat at the contact.
    if (dcOk(de) && dcOk(ds)) {
      const rde = de * k / 2;
      if (mode !== 2 && rde > 2) {
        const c = mode === 1 ? [contact[0] - rde, contact[1]] : [contact[0] + rde, contact[1]];
        h += '<path class="hot" stroke-dasharray="6 4" d="M' + (c[0] + rde * Math.cos(2.2)).toFixed(1) + ' ' + (c[1] - rde * Math.sin(2.2)).toFixed(1) + 'A' + rde.toFixed(1) + ' ' + rde.toFixed(1) + ' 0 ' + (rde > 150 ? 0 : 1) + ' 1 ' + (c[0] + rde * Math.cos(-2.2 + (mode === 1 ? 0 : 0))).toFixed(1) + ' ' + (c[1] - rde * Math.sin(-2.2)).toFixed(1) + '"/>';
      }
    }
    if (mode !== 2) h += DK.line(contact[0], contact[1] - 46, contact[0], contact[1] + 46, 'thin');
    h += DK.circle(contact[0], contact[1], 3, 'hotf');
    const sLab = 'wheel Ø ' + dcL(ds, u, 'ds'), wLab = mode === 2 ? 'flat work' : (mode === 1 ? 'bore Ø ' : 'work Ø ') + dcL(dw, u, 'dw');
    h += DK.text(cxS, mode === 2 ? cy - 30 - rS - 10 : cy - rS - 10, sLab, { cls: 'dimt' });
    h += DK.text(mode === 2 ? 180 : Math.max(cxW, 74), mode === 2 ? contact[1] + 26 : (mode === 1 ? cy + rW + 30 : cy + rW + 22), wLab, { cls: 'dimt' });
    const x = 372, mU = vs.unit || '';
    h += DK.text(x, 40, dcOk(de) ? 'de ' + dcN(de) + ' ' + u : 'de', { cls: 'hott', anchor: 'start' });
    h += dcLines(x, 58, [mode === 0 ? 'de = dw ds / (dw + ds)' : mode === 1 ? 'de = dw ds / (dw − ds)' : 'surface: de = ds', mode === 2 ? '' : 'dashed: equivalent wheel'], {});
    h += dcLines(x, 100, [isFinite(vs.value) ? 'wheel ' + dcN(vs.value) + ' ' + mU : '', isFinite(vw.value) ? 'work ' + dcN(vw.value) + ' ' + vw.unit : '', dcOk(q) ? 'speed ratio q ' + dcN(q, 1) : ''], { cls: 'txt' });
    if (mark) h += dcLines(x, 160, dcWrap(mark, /OVER/.test(mark) ? 18 : 24), { cls: /OVER/.test(mark) ? 'hott' : 'mut' });
    return DK.svg(W, H, h, 'Grinding wheel and work, equivalent diameter');
  },

  // Cylindrical grinding: the work between centres, the wheel of width bs traversing fa per work turn; or plunging.
  grindtime(v, sys, rows) {
    const W = 520, H = 270, u = dcU(sys), cy = 150, R = 40, x0 = 40, x1 = 400;
    const fa = dcOk(v.fa) ? v.fa : dcRow(rows, 'Traverse per work revolution'), ov = dcRow(rows, 'Overlap ratio'), tr = dcRow(rows, 'Traverse rate');
    const tt = dcRow(rows, 'Traverse grinding time'), tp = dcRow(rows, 'Plunge grinding time', 'min'), tps = dcRow(rows, 'Plunge grinding time', 's');
    const plunge = !dcOk(fa) && dcOk(tp);
    let h = DK.rect(x0, cy - R, x1 - x0, 2 * R, 'part') + DK.cl(x0 - 26, cy, x1 + 26, cy);
    h += DK.poly([[x0 - 22, cy - 8], [x0, cy], [x0 - 22, cy + 8]], 'hatch') + DK.poly([[x1 + 22, cy - 8], [x1, cy], [x1 + 22, cy + 8]], 'hatch');
    const L = dcOk(v.L) ? v.L : NaN, kx = dcOk(L) ? (x1 - x0 - 20) / L : 1, bw = dcOk(v.bs) ? dcClamp(v.bs * kx, 16, 160) : 60;
    const xw = plunge ? (x0 + x1) / 2 - bw / 2 : Math.min(x0 + 210, x1 - bw - 40);
    h += DK.rect(xw, cy - R - 70, bw, 70, 'tool') + DK.line(xw, cy - R - 35, xw + bw, cy - R - 35, 'thin');
    if (!plunge) {
      const fp = dcOk(fa) && dcOk(v.bs) ? dcClamp(bw * fa / v.bs, 4, Math.min(bw, (xw - x0) / 3)) : bw / 3;
      for (let x = xw - fp; x > x0 + 4; x -= fp) h += DK.line(x + fp * 0.25, cy - R + 2, x - fp * 0.25, cy + R - 2, 'thin');
      h += DK.dimH(xw - 2 * fp, xw - fp, cy - R - 10, '', { from: cy - R - 2 }) + DK.text(xw - 2 * fp - 22, cy - R - 6, 'fa ' + dcL(fa, u, ''), { cls: 'dimt', anchor: 'end' });
      h += DK.arrow(xw + bw / 2 - 40, cy + R + 22, xw + bw / 2 + 40, cy + R + 22, 'hot') + DK.text(xw + bw / 2 - 46, cy + R + 26, dcOk(tr) ? dcN(tr) + ' ' + dcFU(sys) : 'traverse', { cls: 'hott', anchor: 'end' });
      if (dcOk(L)) h += DK.dimH(x0 + 10, x1 - 10, cy + R + 56, 'traverse L ' + dcN(L) + ' ' + u, { from: cy + R + 2, below: true });
    } else {
      h += DK.arrow(xw + bw + 20, cy - R - 60, xw + bw + 20, cy - R - 4, 'dim') + DK.text(xw + bw + 26, cy - R - 30, 'infeed ' + dcL(v.vfr, dcFU(sys), ''), { cls: 'dimt', anchor: 'start' });
      h += DK.rect(xw, cy - R, bw, 6, 'hatch');
    }
    h += DK.dimH(xw, xw + bw, cy - R - 82, 'bs ' + dcL(v.bs, u, ''), { from: cy - R - 72 });
    h += dcSpin(x1 - 24, cy, 8, R + 8, 115, 245, 'dim') + DK.text(x1, cy - R - 16, dcOk(v.nw) ? dcN(v.nw, 0) + ' RPM' : '', { cls: 'dimt', anchor: 'end' });
    const x = 416;
    h += dcLines(x, 40, [dcOk(ov) ? 'overlap ' + dcN(ov, 2) : '', dcOk(tt) ? 'traverse time' : '', ''], { cls: 'txt' });
    if (dcOk(tt)) h += DK.text(x, 72, dcN(tt) + ' min', { cls: 'hott', anchor: 'start' });
    if (dcOk(tp)) h += dcLines(x, plunge ? 40 : 100, ['plunge time']) + DK.text(x, plunge ? 56 : 116, dcN(tp) + ' min', { cls: 'hott', anchor: 'start' }) + DK.text(x, plunge ? 72 : 132, dcOk(tps) ? '= ' + dcN(tps, 1) + ' s' : '', { cls: 'mut', anchor: 'start' });
    if (!dcOk(fa) && !dcOk(tp)) h += dcLines(x - 10, 40, ['Enter fa (or the', 'fraction) and the', 'work speed.']);
    return DK.svg(W, H, h, 'Cylindrical traverse and plunge grinding');
  },

  // Surface grinding: top view of the part, the wheel centre zig-zagging with overtravel and cross-feed per stroke.
  grindsurf(v, sys, rows) {
    const W = 520, H = 280, u = dcU(sys), ot = dcOk(v.ot) ? v.ot : 0, L = v.L, ct = dcOk(v.ct) ? v.ct : 0;
    if (!dcOk(L)) return '';
    const strokes = dcRow(rows, 'Strokes per layer'), layers = dcRow(rows, 'Layers'), tps = dcRow(rows, 'Time per stroke'), t = dcRow(rows, 'Grinding time', 'min');
    const k = 330 / (L + 2 * ot), x0 = 40 + ot * k, x1 = x0 + L * k, ya = 70, ch = ct > 0 ? dcClamp(ct / (L + 2 * ot) * 330, 50, 130) : 110;
    let h = DK.rect(x0, ya, L * k, ch, 'hatch');
    const n = dcOk(strokes) ? Math.min(Math.round(strokes), 14) : 7, step = ch / Math.max(n - 1, 1), pts = [];
    for (let i = 0; i < n; i++) { const y = ya + i * step, a = i % 2 ? 40 + (L + 2 * ot) * k : 40, b = i % 2 ? 40 : 40 + (L + 2 * ot) * k; pts.push([a, y], [b, y]); }
    h += dcPl(pts, 'hot') + DK.rect(36, ya - 9, 10, 18, 'tool');
    h += DK.arrow(40 + (L + 2 * ot) * k - 46, ya - 22, 40 + (L + 2 * ot) * k - 6, ya - 22, 'dim') + DK.text(40 + (L + 2 * ot) * k - 50, ya - 18, 'table', { cls: 'mut', anchor: 'end' });
    h += DK.dimH(x0, x1, ya + ch + 26, 'L ' + dcN(L) + ' ' + u, { from: ya + ch + 2, below: true });
    if (ot > 0) h += DK.dimH(40, x0, ya + ch + 26, '', { from: ya + ch }) + DK.text(40, ya + ch + 48, 'overtravel ' + dcN(ot), { cls: 'dimt', anchor: 'start' });
    h += dcDimV(ya, ya + ch, 400, ct > 0 ? 'cross ' + dcN(ct) : '', { from: 380 });
    if (n > 1 && step > 6) h += dcDimV(ya + ch - step, ya + ch, 388, '', {}) ;
    const x = 420;
    h += DK.text(x, 40, dcOk(t) ? dcN(t) + ' min' : 'time', { cls: 'hott', anchor: 'start' });
    h += dcLines(x, 58, [dcOk(strokes) ? dcN(strokes, 0) + ' strokes' : '', dcOk(layers) ? '× ' + dcN(layers, 0) + ' layers' : '', dcOk(tps) ? '× ' + dcN(tps) + ' s each' : '', dcOk(v.cf) ? 'cross-feed ' + dcN(v.cf) : ''], { cls: 'txt' });
    if (dcOk(layers)) {
      const nl = Math.min(Math.round(layers), 12), bx = 410, by = 226, bwid = 96, sh = 36;
      h += DK.text(bx + bwid / 2, by - sh - 8, 'side view: layers', { cls: 'mut' }) + DK.rect(bx, by, bwid, 30, 'hatch') + DK.rect(bx, by - sh, bwid, sh, 'part');
      for (let i = 1; i < nl; i++) h += DK.line(bx, by - sh + i * sh / nl, bx + bwid, by - sh + i * sh / nl, 'thin');
      h += DK.rect(bx, by - sh, bwid, sh / nl, 'hot');
    }
    h += DK.text(14, H - 6, 'Wheel centre path' + (dcOk(strokes) && strokes > 14 ? ' (14 of ' + dcN(strokes, 0) + ' strokes drawn)' : '') + '; ' + (v.both === 0 ? 'grinding one way, return stroke idle' : 'grinding both ways'), { cls: 'mut', anchor: 'start' });
    return DK.svg(W, H, h, 'Surface grinding strokes');
  },

  // ---------------- Tool life ----------------
  // Taylor line on log axes with this speed, lowest cost and fastest production marked; or, with a known life, the edge's parts.
  toollife(v, sys, rows) {
    const W = 520, H = 290, su = dcSU(sys), taylor = v.n > 0 && v.n < 1 && dcOk(v.c);
    const life = taylor ? dcRow(rows, 'Tool life at this speed') : v.t, ppe = dcRow(rows, 'Parts per edge'), cost = dcRow(rows, 'Cost per part');
    let h = '';
    if (taylor) {
      const pts = [];
      if (dcOk(v.v) && dcOk(life)) pts.push({ T: life, V: v.v, lab: 'this speed', cls: 'hot' });
      const te = dcRow(rows, 'Tool life for lowest cost'), ve = dcRow(rows, 'Speed for lowest cost'), tp = dcRow(rows, 'Tool life for fastest production'), vp = dcRow(rows, 'Speed for fastest production');
      if (dcOk(te) && dcOk(ve)) pts.push({ T: te, V: ve, lab: 'lowest cost', cls: 'dim' });
      if (dcOk(tp) && dcOk(vp)) pts.push({ T: tp, V: vp, lab: 'fastest', cls: 'dim' });
      const vt = dcRow(rows, 'Speed for target tool life');
      if (dcOk(v.tt) && dcOk(vt)) pts.push({ T: v.tt, V: vt, lab: 'target', cls: 'dim' });
      const Ts = pts.map(p => p.T).concat([1]);
      let lo = Math.log10(Math.min.apply(null, Ts)) - 0.3, hi = Math.log10(Math.max.apply(null, Ts)) + 0.3;
      if (hi - lo < 1) { const m = (hi + lo) / 2; lo = m - 0.5; hi = m + 0.5; }
      const Vat = T => v.c / Math.pow(T, v.n);
      const vlo = Math.log10(Vat(Math.pow(10, hi))), vhi = Math.log10(Vat(Math.pow(10, lo)));
      const pad = (vhi - vlo) * 0.08 + 0.02, a0 = vlo - pad, a1 = vhi + pad;
      const X0 = 70, X1 = 340, Y0 = 236, Y1 = 30, X = T => X0 + (Math.log10(T) - lo) / (hi - lo) * (X1 - X0), Y = V => Y0 - (Math.log10(V) - a0) / (a1 - a0) * (Y0 - Y1);
      h += DK.line(X0, Y0, X1, Y0, 'ln') + DK.line(X0, Y0, X0, Y1, 'ln');
      const ticks = (a, b) => { const out = []; for (let e = Math.floor(a); e <= Math.ceil(b); e++) [1, 2, 5].forEach(m => { const x = Math.log10(m) + e; if (x >= a - 1e-9 && x <= b + 1e-9) out.push(m * Math.pow(10, e)); }); return out; };
      const tx = ticks(lo, hi), ty = ticks(a0, a1);
      tx.forEach(T => { h += DK.line(X(T), Y0, X(T), Y0 + 4, 'thin') + (Math.abs(Math.log10(T) % 1) < 1e-9 ? DK.line(X(T), Y0, X(T), Y1, 'cl') : '') + DK.text(X(T), Y0 + 16, dcN(T), { cls: 'mut' }); });
      ty.forEach(V => { h += DK.line(X0 - 4, Y(V), X0, Y(V), 'thin') + DK.text(X0 - 7, Y(V) + 4, dcN(V), { cls: 'mut', anchor: 'end' }); });
      h += DK.text((X0 + X1) / 2, Y0 + 34, 'tool life T (min, log scale)', { cls: 'mut' }) + DK.text(14, Y1 - 12, su + ' (log)', { cls: 'mut', anchor: 'start' });
      h += '<path class="ln" d="M' + X(Math.pow(10, lo)).toFixed(1) + ' ' + Y(Vat(Math.pow(10, lo))).toFixed(1) + 'L' + X(Math.pow(10, hi)).toFixed(1) + ' ' + Y(Vat(Math.pow(10, hi))).toFixed(1) + '"/>';
      pts.slice().sort((a, b) => a.T - b.T).forEach((p, i) => {
        const x = X(p.T), y = Y(p.V), up = i % 2 === 0 && Y(p.V) > 30, tw = p.lab.length * 7.3;
        const right = x + 8 + tw <= X1 + 16 && (up || x - 8 - tw < 4);
        h += DK.circle(x, y, p.cls === 'hot' ? 4.5 : 3.5, p.cls + 'f') + DK.text(right ? x + 8 : x - 8, up ? y - 10 : y + 18, p.lab, { cls: p.cls === 'hot' ? 'hott' : 'dimt', anchor: right ? 'start' : 'end' });
      });
      h += DK.text(X0 + 8, Y0 - 10, 'V × T^' + dcN(v.n) + ' = ' + dcN(v.c), { cls: 'mut', anchor: 'start' });
      const xr = 376;
      let y = 36;
      pts.forEach(p => { h += DK.text(xr, y, p.lab, { cls: p.cls === 'hot' ? 'hott' : 'dimt', anchor: 'start' }) + DK.text(xr, y + 15, dcN(p.V) + ' ' + su + ', ' + dcN(p.T) + ' min', { cls: 'txt', anchor: 'start' }); y += 36; });
      y += 4;
      if (dcOk(cost)) h += DK.text(xr, y, 'cost ' + dcN(cost, 2) + ' per part', { cls: 'hott', anchor: 'start' });
      if (dcOk(ppe)) h += DK.text(xr, y + 16, dcN(ppe, 0) + ' parts per edge', { cls: 'mut', anchor: 'start' });
      return DK.svg(W, H, h, 'Taylor tool life: speed against tool life');
    }
    // No Taylor constants: the edge's life as a bar, divided into the cutting time of each part.
    if (!dcOk(life)) return DK.svg(W, 120, dcLines(20, 40, ['Enter the Taylor exponent n and constant C, or a known tool life,', 'to see the tool life and the parts per edge.']), 'Tool life');
    const X0 = 30, X1 = 490, y = 90, kx = (X1 - X0) / life, pw = dcOk(v.cut) ? v.cut * kx : 0, np = dcOk(ppe) ? ppe : 0;
    h += DK.text(X0, 40, 'one edge: ' + dcN(life) + ' min of cutting', { cls: 'txt', anchor: 'start' });
    h += DK.rect(X0, y, X1 - X0, 34, 'part');
    for (let i = 0; i < np && pw >= 2.5; i++) h += DK.rect(X0 + i * pw, y, pw, 34, i === 0 ? 'tool' : 'part');
    if (pw > 0 && np * pw < X1 - X0 - 0.5) h += DK.rect(X0 + np * pw, y, X1 - X0 - np * pw, 34, 'hatch');
    h += DK.dimH(X0, X1, y + 58, 'tool life ' + dcN(life) + ' min', { from: y + 36, below: true });
    if (pw >= 18) h += DK.dimH(X0, X0 + pw, y - 14, '', { from: y }) + DK.text(X0 + pw + 6, y - 10, 'cut ' + dcN(v.cut) + ' min per part', { cls: 'dimt', anchor: 'start' });
    h += DK.text(X0, 200, dcOk(np) ? dcN(np, 0) + ' parts per edge' : '', { cls: 'hott', anchor: 'start' });
    if (dcOk(cost)) h += DK.text(X0, 218, 'cost ' + dcN(cost, 2) + ' per part', { cls: 'hott', anchor: 'start' });
    h += DK.text(X0, 236, 'hatched: life left over, not enough for another part', { cls: 'mut', anchor: 'start' });
    return DK.svg(W, 250, h, 'Tool life: parts per edge');
  },
});

// The spot and centre drill screen draws its own picture with live values through this call
// (mode 1 pointed tool, 2 centre drill). The screen works in millimetres inside, so the values
// are shown in the chosen unit here. The depth comes from the core, like the screen's own numbers.
function mtSpotSvg(mode, dc, ang, dp, lp) {
  if (!(dc > 0 && ang > 0 && ang < 180)) return '';
  const W = state.W, centre = mode === 2 && dp > 0 && lp >= 0 && dc > dp;
  const z = centre ? W.centre_drill_depth(dc, dp, lp, ang) : W.spot_depth(dc, ang);
  const k = state.sys === 'inch' ? 1 / 25.4 : 1;
  return DIAGRAMS.spotdepth({ mode: centre ? 2 : 1, dc: dc * k, ang, dp: dp * k, lp: lp * k, dh: NaN, z: NaN }, state.sys, isFinite(z) ? [{ label: 'Depth from the tip', value: z * k, unit: '' }] : []);
}
