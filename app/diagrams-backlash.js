'use strict';
// Drawing for the backlash tool (0.8.0): the indicator test on a slide, the play of a rotary axis at a
// radius, or a gear pair whose centres move apart. Labelled with the user's numbers where given.
(() => {
  const f = v => (Math.round(v * 100) / 100).toString();
  Object.assign(DIAGRAMS, {
    backlash(v, sys) {
      const W = 520, H = 252, u = dcU(sys), mode = v.mode === 2 || v.mode === 3 ? v.mode : 1;
      let s = '';
      if (mode === 1) {
        // Half section along the screw: the nut (cut) on the screw thread, its teeth bearing on one flank with
        // the clearance on the other (drawn far larger than it is); the slide on the nut, an indicator at its end.
        const ya = 204, yr = 168, yc = 156, P = 24, g = 4, X0 = 150, X1 = 294;
        let scr = 'M36 ' + ya + 'V' + yr;
        for (let x = 36; x < 400; x += P) scr += 'L' + x + ' ' + yr + 'L' + (x + 4) + ' ' + yc + 'L' + (x + 10) + ' ' + yc + 'L' + (x + 14) + ' ' + yr;
        scr += 'L' + (36 + Math.ceil(364 / P) * P) + ' ' + yr + 'V' + ya + 'Z';
        s += DK.path(scr, 'part') + DK.cl(24, ya, 420, ya) + DK.text(40, ya - 8, 'screw', { cls: 'mut', anchor: 'start' });
        // Nut outline: top, right side, then its teeth along the bottom from right to left.
        const bot = [];
        for (let x = 36; x < 400; x += P) if (x + 10 >= X0 && x + 28 <= X1) bot.push([x + 10 + g, yc], [x + 13.3 + g, yr - 2], [x + 24.7, yr - 2], [x + 28, yc]);
        let nut = 'M' + X0 + ' 112H' + X1 + 'V' + yc;
        bot.slice().reverse().forEach(q => { nut += 'L' + f(q[0]) + ' ' + f(q[1]); });
        nut += 'L' + X0 + ' ' + yc + 'Z';
        s += DK.path(nut, 'hatch') + DK.text((X0 + X1) / 2, 128, 'nut (cut)', { cls: 'txt' });
        s += DK.rect(128, 62, 190, 50, 'part') + DK.text(223, 92, 'slide', { cls: 'txt' });
        // The gap on the left flank of each tooth: the lost motion.
        const gx = bot.length ? bot[0][0] : X0 + 20;
        s += DK.leader(gx - 1, yc + 6, 40, 138, 'clearance', { anchor: 'start', hot: true });
        // Dial indicator: plunger on the end of the slide.
        const dx = 372, dy = 87;
        s += DK.line(318, dy, dx - 26, dy, 'ln') + DK.rect(dx - 26, dy - 4, 6, 8, 'ln') + DK.circle(dx, dy, 22, 'tool') + DK.circle(dx, dy, 17, 'thin');
        for (let k = 0; k < 20; k++) { const a = k * Math.PI / 10; s += DK.line(dx + 17 * Math.cos(a), dy + 17 * Math.sin(a), dx + (k % 5 ? 14.5 : 12.5) * Math.cos(a), dy + (k % 5 ? 14.5 : 12.5) * Math.sin(a), 'thin'); }
        s += DK.line(dx, dy, dx + 9, dy - 11, 'hot') + DK.circle(dx, dy, 2, 'hotf') + DK.text(dx, dy + 38, 'indicator', { cls: 'mut' });
        // Out and back.
        s += DK.arrow(150, 44, 250, 44, 'hot') + DK.arrow(250, 32, 150, 32, 'ln') + DK.text(260, 42, 'out, then back to the start', { cls: 'mut', anchor: 'start' });
        s += DK.text(18, 228, 'Zero the indicator after coming in from one side, go out and come back:', { cls: 'mut', anchor: 'start' });
        s += DK.text(18, 242, 'the reading left on the indicator, less the start reading, is the lost motion.', { cls: 'mut', anchor: 'start' });
        return DK.svg(W, H, s, 'Indicator test for lost motion on a linear axis');
      }
      if (mode === 2) {
        // The angle is drawn far larger than any real play so that it shows.
        const cx = 160, cy = 104, r = 78, a0 = -38, a1 = -8, p = d => [cx + r * Math.cos(d * Math.PI / 180), cy + r * Math.sin(d * Math.PI / 180)];
        s += DK.circle(cx, cy, r + 12, 'part') + DK.circle(cx, cy, 6, 'ln') + DK.cl(cx - r - 30, cy, cx + r + 30, cy) + DK.cl(cx, cy - r - 30, cx, cy + r + 30);
        const [x0, y0] = p(a0), [x1, y1] = p(a1);
        s += DK.line(cx, cy, x0, y0, 'dim') + DK.line(cx, cy, x1, y1, 'hot');
        s += DK.text((cx + x1) / 2 + 4, (cy + y1) / 2 + 18, 'R ' + dcL(v.rad, u, ''), { cls: 'dimt', anchor: 'start' });
        s += '<path class="hot" d="M' + f(x0) + ' ' + f(y0) + 'A' + r + ' ' + r + ' 0 0 1 ' + f(x1) + ' ' + f(y1) + '"/>';
        s += DK.leader(x1 + 2, (y0 + y1) / 2, 318, 70, 'play at radius R', { hot: true, anchor: 'start' });
        s += DK.angle(cx, cy, 40, -a1, -a0, 'angle', { hot: true });
        s += DK.text(318, 118, 'The same angle gives more', { cls: 'mut', anchor: 'start' }) + DK.text(318, 132, 'play further from the axis:', { cls: 'mut', anchor: 'start' }) + DK.text(318, 146, 'play = R x angle (radians).', { cls: 'mut', anchor: 'start' });
        s += DK.text(18, 224, 'Measure with an indicator on a bar or the part at radius R,', { cls: 'mut', anchor: 'start' }) + DK.text(18, 238, 'turning the axis one way and then the other (angle drawn much larger than it is).', { cls: 'mut', anchor: 'start' });
        return DK.svg(W, H, s, 'Play of a rotary axis at a radius and the angle it makes');
      }
      // Gear pair: two pitch circles, the centres moved apart by da.
      // Pitch circles touching at the pitch point, then the larger gear moved out by da (drawn larger than it is).
      const cy = 112, r1 = 50, r2 = 88, c1 = 130, c2 = c1 + r1 + r2, m = 12;
      s += DK.circle(c1, cy, r1, 'ghost') + DK.circle(c2, cy, r2, 'hid') + DK.circle(c2 + m, cy, r2, 'ghost') + DK.cl(60, cy, 470, cy);
      s += DK.circle(c1, cy, 4, 'ln') + DK.circle(c2 + m, cy, 4, 'ln') + DK.line(c2, cy - 14, c2, cy + 14, 'thin');
      s += DK.dim(c1, cy, c2, cy, 'centre distance', { off: 76 }) + DK.dim(c2, cy, c2 + m, cy, '', { off: -64 });
      s += DK.text(c2 + m + 8, cy + 78, 'moved apart by ' + dcL(v.da, u, 'da'), { cls: 'hott', anchor: 'start' });
      s += DK.text(c1, cy + r1 + 16, 'pitch circles', { cls: 'mut' }) + DK.text(c2 + m, cy - r2 - 6 < 10 ? 14 : cy - r2 - 6, '', { cls: 'mut' });
      s += DK.text(18, 236, 'Circular backlash gained j = 2 da tan(pressure angle)' + (dcOk(v.alpha) ? ', pressure angle ' + dcN(v.alpha) + '°' : '') + '.', { cls: 'mut', anchor: 'start' });
      return DK.svg(W, H, s, 'Gear pair with the centre distance opened, which adds backlash');
    },
  });
})();
