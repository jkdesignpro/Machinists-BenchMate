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
  const step = 2 * Math.PI / z, land = step * (z > 12 ? 0.45 : 0.42), core = z > 12 ? 0.84 : (z > 2 ? 0.7 : 0.6), pts = [];
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
    h += dcLines(334, 236, ['Bent shape exaggerated;', 'holder and spindle flex', 'are not included.']);
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
    const cd = 350, cyd = 34, rd = 100, f = 30, kd = dcClamp(k, 0.2, 1), ypd = cyd + rd - 2 * rd * kd, t1 = Math.asin(dcClamp((ypd - cyd) / rd, -1, 1));
    const cur = [], pre = [];
    for (let i = 0; i <= 30; i++) { const t = Math.PI / 2 - (Math.PI / 2 - t1) * i / 30; cur.push([cd + f + rd * Math.cos(t), cyd + rd * Math.sin(t)]); }
    for (let i = 0; i <= 30; i++) { const t = t1 + (Math.PI / 2 - t1) * i / 30; pre.push([cd + rd * Math.cos(t), cyd + rd * Math.sin(t)]); }
    h += DK.text(460, 20, 'chip, enlarged', { cls: 'mut' });
    h += DK.poly([[cd - 14, cyd + rd + 26], [510, cyd + rd + 26], [510, ypd], [cd + f + rd * Math.cos(t1), ypd]].concat(cur.slice().reverse(), [[cd - 14, cyd + rd]]), 'hatch');
    h += DK.poly(cur.concat(pre), 'tool');
    const ext = []; for (let i = 0; i <= 30; i++) { const t = t1 - 0.35 + (Math.PI / 2 + 0.12 - t1 + 0.35) * i / 30; ext.push([cd + rd * Math.cos(t), cyd + rd * Math.sin(t)]); }
    h += dcPl(ext, 'thin') + DK.text(cd + rd * Math.cos(t1 - 0.35) - 4, cyd + rd * Math.sin(t1 - 0.35) - 2, 'previous tooth', { cls: 'mut', anchor: 'end' });
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
    if (dcOk(fz1)) { h += DK.text(x, y, 'fz on the arc ' + dcN(fz1) + ' ' + u, { cls: 'hott', anchor: 'start' }); y += 16; }
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
    const R = 52, k = dcOk(d) && dcOk(st) ? dcClamp(st / d, 0.14, 1) : 0.45, sp = k * 2 * R, cx = 150, base = 196, cyc = base - R, top = 54;
    const prof = [];
    for (let x = 14; x <= 286; x += 1) { const i = Math.round((x - cx) / sp), dx = x - (cx + i * sp); prof.push([x, cyc + Math.sqrt(Math.max(0, R * R - dx * dx))]); }
    let h = DK.poly(prof.concat([[286, base + 30], [14, base + 30]]), 'hatch');
    const ball = (x, cls) => DK.path('M' + (x - R) + ' ' + top + 'L' + (x - R) + ' ' + cyc + 'A' + R + ' ' + R + ' 0 0 0 ' + (x + R) + ' ' + cyc + 'L' + (x + R) + ' ' + top, cls);
    h += ball(cx - sp, 'ghost') + ball(cx + sp, 'ghost') + ball(cx, 'tool');
    [-1, 0, 1].forEach(i => { h += DK.cl(cx + i * sp, top - 8, cx + i * sp, base + 8); });
    h += DK.dimH(cx - sp, cx, top - 18, sp > 60 ? 'stepover ' + dcL(st, u, 's') : '', { from: top - 8 });
    if (sp <= 60) h += DK.text(cx - sp - 6, top - 22, 'stepover ' + dcL(st, u, 's'), { cls: 'dimt', anchor: 'end' });
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
    const s = ok ? Math.min(280 / v.L, 150 / v.D) : 1, Lp = ok ? v.L * s : 260, Dp = ok ? v.D * s : 140, dp = ok ? Math.max(6, v.d * s) : 70;
    const cy = 128, x0 = 60, x1 = x0 + Lp;
    let h = DK.poly([[x0, cy - Dp / 2], [x1, cy - dp / 2], [x1, cy + dp / 2], [x0, cy + Dp / 2]], 'part') + DK.cl(x0 - 16, cy, x1 + 70, cy);
    h += dcDimV(cy - Dp / 2, cy + Dp / 2, x0 - 24, 'Ø ' + dcL(v.D, u, 'D'), { from: x0 - 2 });
    h += DK.dimH(x0, x1, cy + Dp / 2 + 30, 'L ' + dcL(v.L, u, 'L'), { from: cy + Math.max(Dp, dp) / 2 + 2, below: true });
    // Half angle at the small end, against a line parallel to the axis.
    const tang = Math.atan2((Dp - dp) / 2, Lp) * 180 / Math.PI;
    const ra = Math.min(Lp - 10, 120), am = dcRad(180 - tang / 2);
    h += DK.line(x1, cy - dp / 2, x1 - ra - 12, cy - dp / 2, 'thin') + DK.angle(x1, cy - dp / 2, ra, 180 - tang, 180, '', { hot: true });
    h += DK.leader(x1 + ra * Math.cos(am), cy - dp / 2 - ra * Math.sin(am), x1 - ra - 20, Math.max(20, cy - Dp / 2 - 20), 'half ' + (dcOk(half) ? dcN(half) + '°' : 'α/2') + ' (slide)', { hot: true, anchor: 'end' });
    // Small diameter: dimension on the right with room for the apex lines.
    h += dcDimV(cy - dp / 2, cy + dp / 2, x1 + 26, dp > 50 ? 'Ø ' + dcL(v.d, u, 'd') : '', { from: x1 + 2 });
    if (dp <= 50) h += DK.text(x1 + 34, cy + dp / 2 + 18, 'Ø ' + dcL(v.d, u, 'd'), { cls: 'dimt', anchor: 'start' });
    const xa = x1 + (dp / 2) / Math.max(Math.tan(dcRad(tang)), 1e-6);
    if (xa < 500) { h += DK.line(x1, cy - dp / 2, xa, cy, 'ghost') + DK.line(x1, cy + dp / 2, xa, cy, 'ghost') + DK.text(Math.min(xa + 6, 506), cy + 4, '', { cls: 'mut' }); }
    h += DK.text(380, 220, 'included ' + (dcOk(inc) ? dcN(inc) + '°' : 'α'), { cls: 'hott', anchor: 'start' });
    h += dcLines(380, 238, [dcOk(tpl) ? 'taper ' + dcN(tpl) + ' ' + (sys === 'inch' ? 'in/in' : 'mm/mm') + ' on Ø' : '', ok ? 'drawn to scale' : '']);
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
    if (rem > 0) h += DK.text(x1, yb + hb + 50, 'remnant ' + dcN(rem) + ' ' + u, { cls: 'mut', anchor: 'end' });
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
    const x = 400;
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
    const Lp = ok ? v.L * s : 250, dp = ok ? Math.max(10, v.d * s) : 40, cy = 128, xh = Math.min(420, 236 + Lp / 2), xt = xh - Lp, rb = dp / 2 + 24, e = 16;
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
    h += DK.text(20, H - 38, dcOk(dt) ? 'δ ' + dcN(dt) + ' ' + du + ' at the edge (tangential)' : 'δ: enter the force, or kc with ap and feed', { cls: 'hott', anchor: 'start' });
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
