'use strict';
// Drawing for the backlash tool (0.8.0): the indicator test on a slide, the play of a rotary axis at a
// radius, or a gear pair whose centres move apart. Labelled with the user's numbers where given.
(() => {
  const f = v => (Math.round(v * 100) / 100).toString();
  Object.assign(DIAGRAMS, {
    backlash(v, sys) {
      const W = 520, H = 250, u = dcU(sys), mode = v.mode === 2 || v.mode === 3 ? v.mode : 1;
      let s = '';
      if (mode === 1) {
        // Screw, nut with clearance, slide; indicator touching the slide.
        const y = 150;
        s += DK.rect(40, y - 8, 330, 16, 'part') + DK.cl(24, y, 390, y);
        for (let x = 46; x < 366; x += 12) s += DK.line(x, y - 8, x + 6, y + 8, 'thin');
        s += DK.text(48, y + 30, 'screw', { cls: 'mut', anchor: 'start' });
        s += DK.rect(150, y - 30, 70, 60, 'hatch') + DK.text(185, y + 46, 'nut', { cls: 'mut' });
        s += DK.rect(130, 56, 150, 48, 'part') + DK.text(205, 84, 'slide', { cls: 'txt' });
        // Indicator against the slide end.
        s += DK.rect(300, 66, 46, 28, 'tool') + DK.line(300, 80, 281, 80, 'ln') + DK.circle(372, 80, 22, 'tool') + DK.line(346, 80, 350, 80, 'ln');
        s += DK.line(372, 80, 382, 66, 'hot') + DK.text(372, 118, 'indicator', { cls: 'mut' });
        // Out and back.
        s += DK.arrow(140, 40, 230, 40, 'hot') + DK.arrow(230, 30, 140, 30, 'ln') + DK.text(240, 38, 'out, then back to the start', { cls: 'mut', anchor: 'start' });
        s += DK.leader(152, y - 22, 22, 106, 'clearance in the nut', { anchor: 'start' });
        s += DK.text(18, 222, 'Zero the indicator after coming in from one side, go out and come back:', { cls: 'mut', anchor: 'start' });
        s += DK.text(18, 236, 'the reading left on the indicator, less the start reading, is the lost motion.', { cls: 'mut', anchor: 'start' });
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
