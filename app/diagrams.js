'use strict';
// Drawings for the standard calculators (see dk.js). One function per tool id.
Object.assign(DIAGRAMS, {
  // Spindle speed: end view of the turning part (or cutter), its diameter, the rotation and the surface speed at the rim.
  rpm(v, sys, rows) {
    const W = 520, H = 250, cx = 170, cy = 125, r = 78, u = sys === 'inch' ? 'in' : 'mm';
    const n = isFinite(v.rpm) ? v.rpm : (rows.find(x => x.unit === 'RPM') || {}).value;
    const vs = isFinite(v.speed) ? v.speed : (rows.find(x => x.unit !== 'RPM') || {}).value;
    let h = DK.circle(cx, cy, r) + DK.cl(cx - r - 16, cy, cx + r + 16, cy) + DK.cl(cx, cy - r - 16, cx, cy + r + 16);
    h += DK.dim(cx - r, cy + r + 28, cx + r, cy + r + 28, 'Ø ' + (isFinite(v.dia) ? DK.n(v.dia, 4) + ' ' + u : 'D'), { below: true });
    h += DK.line(cx - r, cy + 4, cx - r, cy + r + 33, 'dim ext') + DK.line(cx + r, cy + 4, cx + r, cy + r + 33, 'dim ext');
    h += DK.angle(cx, cy, r * 0.55, 200, 340, isFinite(n) ? DK.n(n, 0) + ' RPM' : 'n', { inside: false });
    // Surface speed: tangent arrow at the top of the rim.
    h += DK.arrow(cx, cy - r, cx + 120, cy - r, 'hot') + DK.circle(cx, cy - r, 3, 'hotf');
    h += DK.text(cx + 128, cy - r + 4, (isFinite(vs) ? DK.n(vs, 1) + ' ' : '') + (sys === 'inch' ? 'SFM' : 'm/min'), { cls: 'hott', anchor: 'start' });
    h += DK.text(cx + 128, cy - r + 20, 'surface speed at the rim', { cls: 'mut', anchor: 'start' });
    h += DK.text(298, 150, 'One turn moves the rim π × D,', { cls: 'mut', anchor: 'start' }) + DK.text(298, 166, 'so speed = π × D × RPM.', { cls: 'mut', anchor: 'start' });
    return DK.svg(W, H, h, 'Spindle speed: diameter, rotation and surface speed');
  },
  // Bolt circle: the holes to scale, numbered, with the start angle and the pitch circle.
  bolt(v, sys) {
    const W = 520, H = 300, cx = 200, cy = 150, r = 100, n = Math.max(1, Math.min(72, Math.round(v.n) || 0)), u = sys === 'inch' ? 'in' : 'mm';
    if (!(v.n >= 1)) return '';
    const a0 = (isFinite(v.start) ? v.start : 0) * Math.PI / 180, hr = Math.max(3, Math.min(11, 2.2 * r / Math.max(n, 6)));
    let h = DK.circle(cx, cy, r, 'cl') + DK.cl(cx - r - 22, cy, cx + r + 22, cy) + DK.cl(cx, cy - r - 22, cx, cy + r + 22);
    for (let i = 0; i < n; i++) {
      const a = a0 + i * 2 * Math.PI / n, x = cx + r * Math.cos(a), y = cy - r * Math.sin(a);
      h += DK.circle(x, y, hr, i === 0 ? 'tool' : 'part');
      if (n <= 24) h += DK.text(cx + (r + hr + 12) * Math.cos(a), cy - (r + hr + 12) * Math.sin(a) + 4, String(i + 1), { cls: i === 0 ? 'hott' : 'mut' });
    }
    if (isFinite(v.start) && Math.abs(v.start % 360) > 0.5) h += DK.line(cx, cy, cx + r * Math.cos(a0), cy - r * Math.sin(a0), 'hot') + DK.angle(cx, cy, 38, 0, v.start % 360, DK.n(v.start, 2) + '°', { hot: true });
    h += DK.leader(cx + r * Math.cos(2.4), cy - r * Math.sin(2.4), 372, 44, 'Ø ' + (isFinite(v.dia) ? DK.n(v.dia, 4) + ' ' + u : 'D') + ' PCD', { anchor: 'start' });
    h += DK.text(372, 150, n + ' holes, ' + DK.n(360 / n, 3) + '° apart', { cls: 'txt', anchor: 'start' });
    h += DK.text(372, 168, 'Hole 1 is highlighted.', { cls: 'mut', anchor: 'start' }) + DK.text(372, 183, 'Angles run anticlockwise', { cls: 'mut', anchor: 'start' }) + DK.text(372, 198, 'from +X.', { cls: 'mut', anchor: 'start' });
    h += DK.arrow(cx, cy, cx + 34, cy, 'dim') + DK.text(cx + 42, cy - 5, 'X', { cls: 'dimt' }) + DK.arrow(cx, cy, cx, cy - 34, 'dim') + DK.text(cx + 9, cy - 36, 'Y', { cls: 'dimt' });
    return DK.svg(W, H, h, 'Bolt circle with numbered holes');
  },
});
