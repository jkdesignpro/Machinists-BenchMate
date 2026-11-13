'use strict';
// DK: BenchMate's drawing kit. Small helpers that return SVG markup in one
// engineering-drawing style: part outlines, centre lines, dimension lines with
// arrowheads, angle arcs, leaders and hatching. Colours come from the CSS
// tokens (classes below are styled in shell.css), so drawings follow the
// light and dark themes. Coordinates are SVG pixels (y down).
//
//   DK.svg(w, h, body, label)           wrap a drawing (viewBox 0 0 w h)
//   DK.fit(bw, bh, w, h, pad)           scale + offsets to fit a bw x bh shape; returns { s, x(v), y(v) }
//   DK.line / DK.path / DK.rect / DK.circle / DK.poly   shapes; cls: part, ln, thin, hid, tool, hot, hatch, ghost
//   DK.cl(x1, y1, x2, y2)               centre line (chain line)
//   DK.dim(x1, y1, x2, y2, text, o)     dimension between two points; o.off = offset from the points
//                                       (perpendicular, + is to the left of the direction), o.hot = accent colour
//   DK.dimH(x1, x2, y, text, o)         horizontal dimension at height y, extension lines from o.from (y) if given
//   DK.dimV(y1, y2, x, text, o)         vertical dimension at x, extension lines from o.from (x) if given
//   DK.angle(cx, cy, r, a0, a1, text)   angle arc from a0 to a1 (degrees, anticlockwise from +x as seen on screen)
//   DK.leader(x, y, tx, ty, text)       arrow at (x, y), text at (tx, ty)
//   DK.arrow(x1, y1, x2, y2, cls)       a plain arrow (motion, feed direction)
//   DK.text(x, y, str, o)               o.anchor: start | middle | end; o.cls: txt, mut, dimt, hott; o.size
//   DK.n(v, dp)                         number for a label: fixed, trailing zeros trimmed
const DK = (() => {
  const f = v => (Math.round(v * 100) / 100).toString();
  const esc = t => String(t).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  const head = (x, y, ang, cls) => { // arrowhead with its tip at (x, y), pointing along ang (radians)
    const L = 9, W = 2.3, c = Math.cos(ang), s = Math.sin(ang);   // closed filled head, about 15 degrees (ISO 129)
    const bx = x - L * c, by = y - L * s;
    return '<path class="' + cls + '" d="M' + f(x) + ' ' + f(y) + 'L' + f(bx - W * s) + ' ' + f(by + W * c) + 'L' + f(bx + W * s) + ' ' + f(by - W * c) + 'Z"/>';
  };
  const K = {
    n(v, dp) { if (!isFinite(v)) return '?'; return (+v.toFixed(dp === undefined ? 3 : dp)).toString(); },
    svg(w, h, body, label) {
      return '<svg class="dk" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + esc(label || 'Drawing') + '"><defs><pattern id="dkh" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line class="dkhl" x1="0" y1="0" x2="0" y2="7"/></pattern></defs>' + body + '</svg>';
    },
    fit(bw, bh, w, h, pad) {
      pad = pad === undefined ? 40 : pad;
      const s = Math.min((w - 2 * pad) / (bw || 1), (h - 2 * pad) / (bh || 1));
      const ox = (w - bw * s) / 2, oy = (h - bh * s) / 2;
      return { s, x: v => ox + v * s, y: v => oy + v * s };
    },
    line(x1, y1, x2, y2, cls) { return '<line class="' + (cls || 'ln') + '" x1="' + f(x1) + '" y1="' + f(y1) + '" x2="' + f(x2) + '" y2="' + f(y2) + '"/>'; },
    path(d, cls) { return '<path class="' + (cls || 'part') + '" d="' + d + '"/>'; },
    poly(pts, cls) { return '<path class="' + (cls || 'part') + '" d="M' + pts.map(p => f(p[0]) + ' ' + f(p[1])).join('L') + 'Z"/>'; },
    rect(x, y, w, h, cls, r) { return '<rect class="' + (cls || 'part') + '" x="' + f(x) + '" y="' + f(y) + '" width="' + f(Math.max(0, w)) + '" height="' + f(Math.max(0, h)) + '"' + (r ? ' rx="' + f(r) + '"' : '') + '/>'; },
    circle(cx, cy, r, cls) { return '<circle class="' + (cls || 'part') + '" cx="' + f(cx) + '" cy="' + f(cy) + '" r="' + f(Math.max(0, r)) + '"/>'; },
    cl(x1, y1, x2, y2) { return K.line(x1, y1, x2, y2, 'cl'); },
    text(x, y, str, o) {
      o = o || {};
      return '<text class="' + (o.cls || 'txt') + '" x="' + f(x) + '" y="' + f(y) + '" text-anchor="' + (o.anchor || 'middle') + '"' + (o.size ? ' font-size="' + o.size + '"' : '') + (o.rot ? ' transform="rotate(' + f(o.rot) + ' ' + f(x) + ' ' + f(y) + ')"' : '') + '>' + esc(str) + '</text>';
    },
    arrow(x1, y1, x2, y2, cls) {
      const a = Math.atan2(y2 - y1, x2 - x1), c = cls || 'hot';
      return K.line(x1, y1, x2 - 5 * Math.cos(a), y2 - 5 * Math.sin(a), c) + head(x2, y2, a, c + 'f');
    },
    dim(x1, y1, x2, y2, text, o) {
      o = o || {};
      const off = o.off === undefined ? 0 : o.off, d = o.hot ? 'hot' : 'dim';
      const len = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / len, uy = (y2 - y1) / len;
      const nx = uy, ny = -ux; // left of the direction of travel, on screen
      const ax = x1 + nx * off, ay = y1 + ny * off, bx = x2 + nx * off, by = y2 + ny * off;
      const sg = off >= 0 ? 1 : -1, g = 3, over = 5;
      let h = '';
      if (Math.abs(off) > g + 1) {
        h += K.line(x1 + nx * g * sg, y1 + ny * g * sg, ax + nx * over * sg, ay + ny * over * sg, d + ' ext');
        h += K.line(x2 + nx * g * sg, y2 + ny * g * sg, bx + nx * over * sg, by + ny * over * sg, d + ' ext');
      }
      const ang = Math.atan2(by - ay, bx - ax);
      const inside = len > 34;
      if (inside) { h += K.line(ax, ay, bx, by, d) + head(ax, ay, ang + Math.PI, d + 'f') + head(bx, by, ang, d + 'f'); }
      else { h += K.line(ax - ux * 16, ay - uy * 16, bx + ux * 16, by + uy * 16, d) + head(ax, ay, ang, d + 'f') + head(bx, by, ang + Math.PI, d + 'f'); }
      let rot = ang * 180 / Math.PI; if (rot > 90 || rot <= -90) rot += 180;
      // Text sits just off the line on its upper side (or lower with o.below).
      let tx = (ax + bx) / 2 + Math.sin(rot * Math.PI / 180) * (o.below ? -13 : 5), ty = (ay + by) / 2 - Math.cos(rot * Math.PI / 180) * (o.below ? -13 : 5);
      const est = String(text === undefined ? '' : text).length * 7;
      // A short upright dimension takes its text level, beside the middle of the line, on the side away from the part.
      if (est > len - 8 && Math.abs(uy) > 0.7) {
        const side = nx * off > 0.5 ? 1 : nx * off < -0.5 ? -1 : 1;
        if (text !== undefined && text !== '') h += K.text((ax + bx) / 2 + side * 6, (ay + by) / 2 + 4, text, { cls: d + 't', anchor: side > 0 ? 'start' : 'end' });
        return h;
      }
      if (text !== undefined && text !== '') h += K.text(tx, ty, text, { cls: d + 't', rot });
      return h;
    },
    dimH(x1, x2, y, text, o) {
      o = o || {};
      if (o.from !== undefined) { const off = o.from - y; return K.dim(x1, o.from, x2, o.from, text, Object.assign({}, o, { off })); }
      return K.dim(x1, y, x2, y, text, o);
    },
    dimV(y1, y2, x, text, o) {
      o = o || {};
      if (o.from !== undefined) { const off = x - o.from; return K.dim(o.from, y1, o.from, y2, text, Object.assign({}, o, { off: -off })); }
      return K.dim(x, y1, x, y2, text, o);
    },
    angle(cx, cy, r, a0, a1, text, o) {
      o = o || {};
      const d = o.hot ? 'hot' : 'dim', t0 = a0 * Math.PI / 180, t1 = a1 * Math.PI / 180;
      const p = t => [cx + r * Math.cos(t), cy - r * Math.sin(t)];
      const [x0, y0] = p(t0), [x1, y1] = p(t1);
      const sweep = a1 > a0 ? 0 : 1, large = Math.abs(a1 - a0) > 180 ? 1 : 0;
      let h = '<path class="' + d + '" d="M' + f(x0) + ' ' + f(y0) + 'A' + f(r) + ' ' + f(r) + ' 0 ' + large + ' ' + sweep + ' ' + f(x1) + ' ' + f(y1) + '"/>';
      const dir = a1 > a0 ? 1 : -1;
      if (Math.abs(t1 - t0) * r > 22) {
        h += head(x1, y1, -(t1 + dir * Math.PI / 2) + dir * 4 / r, d + 'f') + head(x0, y0, -(t0 - dir * Math.PI / 2) - dir * 4 / r, d + 'f');
      }
      if (text) { const tm = (t0 + t1) / 2, rr = r + (o.inside ? -12 : 13); h += K.text(cx + rr * Math.cos(tm), cy - rr * Math.sin(tm) + 4, text, { cls: d + 't' }); }
      return h;
    },
    leader(x, y, tx, ty, text, o) {
      o = o || {};
      const d = o.hot ? 'hot' : 'dim', a = Math.atan2(y - ty, x - tx);
      const anchor = o.anchor || (tx >= x ? 'start' : 'end');
      return K.line(tx, ty, x - 5 * Math.cos(a), y - 5 * Math.sin(a), d) + head(x, y, a, d + 'f') + K.text(tx + (anchor === 'start' ? 4 : anchor === 'end' ? -4 : 0), ty + (anchor === 'middle' ? (ty < y ? -5 : 13) : 4), text, { cls: d + 't', anchor });
    },
  };
  return K;
})();
// Drawings for the standard calculators, by tool id: DIAGRAMS[id] = (v, sys, rows) => SVG markup or ''.
// `v` holds the input values by field id (NaN when blank). Tool files add theirs with Object.assign(DIAGRAMS, {...}).
const DIAGRAMS = {};
