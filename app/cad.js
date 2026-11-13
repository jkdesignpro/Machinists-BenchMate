'use strict';
// CAD / DXF generator: parametric 2D shapes exported as DXF for CAM.
// Geometry and the DXF text are made in the Rust core (core/src/cad.rs,
// core/src/dxf.rs) through `dxf_build`; this file reads inputs, draws the
// preview from the returned entity list and saves the file.
// Uses helpers from shop.js (sesc, snum, sinp, sfield, stable) and
// geometry.js (gseg, gsel, toBuf, listOut).

const CAD_LAYER = ['OUTLINE', 'HOLES', 'CENTRE'];
const CAD_MEM = {};
const CAD_OPT = { marks: true, origin: 0, ver: 2000, explode: false };
try { Object.assign(CAD_OPT, JSON.parse(localStorage.getItem('bm.cadopt') || '{}')); } catch (e) {}
const cadSaveOpt = () => { try { localStorage.setItem('bm.cadopt', JSON.stringify(CAD_OPT)); } catch (e) {} };

// Field: [key, label, kind, default inch, default mm, options]. kind L = length, deg, n = count, sel.
// The order of the fields is the parameter order of the Rust shape (cad::build).
const CAD_SHAPES = {
  0: { name: 'bolt-circle', fields: [['bc', 'Bolt circle (pitch) diameter', 'L', 4, 100], ['n', 'Number of holes', 'n', 6, 6], ['hd', 'Hole diameter', 'L', 0.266, 6.6], ['start', 'Angle of the first hole (from +X, CCW)', 'deg', 0, 0], ['od', 'Outside diameter of the part (0 = none)', 'L', 5, 125], ['bore', 'Centre bore diameter (0 = none)', 'L', 1.5, 40]] },
  1: { name: 'hole-grid', fields: [['nx', 'Columns (holes in X)', 'n', 4, 4], ['ny', 'Rows (holes in Y)', 'n', 3, 3], ['px', 'Pitch X (hole to hole)', 'L', 1, 25], ['py', 'Pitch Y', 'L', 0.75, 20], ['hd', 'Hole diameter', 'L', 0.201, 5], ['margin', 'Plate margin, hole centre to edge (0 = no plate)', 'L', 0.5, 12], ['cr', 'Plate corner radius', 'L', 0.125, 3]] },
  2: { name: 'slot', fields: [['l', 'Centre distance of the end radii', 'L', 1.5, 40], ['w', 'Slot width', 'L', 0.5, 12], ['ang', 'Slot angle (from +X, CCW)', 'deg', 0, 0]] },
  3: { name: 'arc-slot', fields: [['r', 'Centreline radius', 'L', 2, 50], ['w', 'Slot width', 'L', 0.375, 10], ['start', 'Start angle (from +X, CCW)', 'deg', 0, 0], ['sweep', 'Sweep angle (CCW)', 'deg', 90, 90]] },
  4: { name: 'rectangle', fields: [['w', 'Width (X)', 'L', 4, 100], ['h', 'Height (Y)', 'L', 2.5, 60], ['cr', 'Corner radius (0 = sharp)', 'L', 0.25, 6], ['hd', 'Corner hole diameter (0 = none)', 'L', 0.266, 6.6], ['inset', 'Hole centre inset from each edge', 'L', 0.375, 10]] },
  5: { name: 'polygon', fields: [['n', 'Number of sides', 'n', 6, 6], ['size', 'Size', 'L', 1, 24], ['mode', 'Size is measured', 'sel', 0, 0, [[0, 'Across flats'], [1, 'Across corners']]], ['rot', 'Rotation (CCW; 0 = flat at the bottom)', 'deg', 0, 0], ['bore', 'Centre bore diameter (0 = none)', 'L', 0, 0]] },
  6: { name: 'ring', fields: [['od', 'Outside diameter', 'L', 2, 50], ['id', 'Inside diameter (0 = solid disc)', 'L', 1, 25]] },
  7: { name: 'keyhole', fields: [['dh', 'Head diameter', 'L', 0.5, 12], ['w', 'Slot width', 'L', 0.25, 6], ['l', 'Head centre to slot end centre', 'L', 0.75, 20], ['rot', 'Rotation (CCW; 0 = slot pointing down)', 'deg', 0, 0]] },
  8: { name: 'd-flat', fields: [['d', 'Diameter', 'L', 0.5, 12], ['a', 'Across flat (flat to far side)', 'L', 0.45, 11], ['rot', 'Rotation (CCW; 0 = flat on top)', 'deg', 0, 0]] },
  9: { name: 'double-d', fields: [['d', 'Diameter', 'L', 0.5, 12], ['a', 'Across flats', 'L', 0.4, 10], ['rot', 'Rotation (CCW; 0 = flats top and bottom)', 'deg', 0, 0]] },
};
// Tool id -> shape variants [shape number, label].
const CAD_TOOLS = {
  dxfbolt: [[0, 'Bolt circle']], dxfgrid: [[1, 'Hole grid']], dxfslot: [[2, 'Straight slot'], [3, 'Arc slot']], dxfrect: [[4, 'Rectangle']],
  dxfpoly: [[5, 'Polygon']], dxfring: [[6, 'Circle or ring']], dxfprofile: [[7, 'Keyhole'], [8, 'D-flat'], [9, 'Double-D']],
};

// Parse Drawing::flatten from list_out.
function cadRead(W) {
  const n = W.list_out(4); if (!isFinite(n)) return null;
  const ext = [0, 1, 2, 3].map(i => W.list_out(i));
  const ents = []; let i = 5;
  for (let k = 0; k < n; k++) {
    const t = W.list_out(i), layer = CAD_LAYER[W.list_out(i + 1)];
    if (t === 1) { ents.push({ t: 'line', layer, a: [W.list_out(i + 2), W.list_out(i + 3)], b: [W.list_out(i + 4), W.list_out(i + 5)] }); i += 6; }
    else if (t === 2) { ents.push({ t: 'circle', layer, c: [W.list_out(i + 2), W.list_out(i + 3)], r: W.list_out(i + 4) }); i += 5; }
    else if (t === 3) { ents.push({ t: 'arc', layer, c: [W.list_out(i + 2), W.list_out(i + 3)], r: W.list_out(i + 4), s: W.list_out(i + 5), e: W.list_out(i + 6) }); i += 7; }
    else if (t === 4) {
      const closed = W.list_out(i + 2) === 1, nv = W.list_out(i + 3), v = [];
      for (let j = 0; j < nv; j++) v.push([W.list_out(i + 4 + 3 * j), W.list_out(i + 5 + 3 * j), W.list_out(i + 6 + 3 * j)]);
      ents.push({ t: 'poly', layer, closed, v }); i += 4 + 3 * nv;
    } else break;
  }
  return { ext, ents };
}

// Preview: entities by layer, overall dimensions and hole callouts.
function cadPreview(d, u, dp) {
  const Wd = 480, Hd = 340, pad = 50;
  const [x0, y0, x1, y1] = d.ext;
  const w = Math.max(x1 - x0, 1e-9), h = Math.max(y1 - y0, 1e-9);
  const k = Math.min((Wd - 2 * pad) / w, (Hd - 2 * pad) / h);
  const ox = (Wd - w * k) / 2, oy = (Hd - h * k) / 2;
  const P = p => [ox + (p[0] - x0) * k, Hd - (oy + (p[1] - y0) * k)];
  const f1 = x => x.toFixed(1), pt = q => f1(q[0]) + ' ' + f1(q[1]);
  const cls = { OUTLINE: 'cp-o', HOLES: 'cp-h', CENTRE: 'cp-c' };
  let s = '';
  d.ents.forEach(e => {
    const c = cls[e.layer];
    if (e.t === 'line') s += '<path class="' + c + '" d="M' + pt(P(e.a)) + 'L' + pt(P(e.b)) + '"/>';
    else if (e.t === 'circle') { const q = P(e.c); s += '<circle class="' + c + (e.layer === 'OUTLINE' ? ' cp-fill' : '') + '" cx="' + f1(q[0]) + '" cy="' + f1(q[1]) + '" r="' + f1(e.r * k) + '"/>'; }
    else if (e.t === 'arc') {
      const a = e.s * Math.PI / 180, b = e.e * Math.PI / 180, sw = ((e.e - e.s) % 360 + 360) % 360;
      const p1 = P([e.c[0] + e.r * Math.cos(a), e.c[1] + e.r * Math.sin(a)]), p2 = P([e.c[0] + e.r * Math.cos(b), e.c[1] + e.r * Math.sin(b)]);
      s += '<path class="' + c + '" d="M' + pt(p1) + 'A' + f1(e.r * k) + ' ' + f1(e.r * k) + ' 0 ' + (sw > 180 ? 1 : 0) + ' 0 ' + pt(p2) + '"/>';
    } else if (e.t === 'poly') {
      let p = 'M' + pt(P(e.v[0]));
      const n = e.v.length, segs = e.closed ? n : n - 1;
      for (let i = 0; i < segs; i++) {
        const a = e.v[i], b = e.v[(i + 1) % n];
        if (!a[2]) { p += 'L' + pt(P(b)); continue; }
        // Bulge: r = c (1 + b^2) / (4 |b|); model CCW (b > 0) is SVG sweep 0 after the y flip.
        const ch = Math.hypot(b[0] - a[0], b[1] - a[1]), r = ch * (1 + a[2] * a[2]) / (4 * Math.abs(a[2])) * k;
        p += 'A' + f1(r) + ' ' + f1(r) + ' 0 ' + (Math.abs(a[2]) > 1 ? 1 : 0) + ' ' + (a[2] > 0 ? 0 : 1) + ' ' + pt(P(b));
      }
      s += '<path class="' + c + (e.layer === 'OUTLINE' ? ' cp-fill' : '') + '" d="' + p + (e.closed ? 'Z' : '') + '"/>';
    }
  });
  // Overall dimensions: width below, height to the right.
  const bl = P([x0, y0]), tr = P([x1, y1]);
  const yd = bl[1] + 24, xd = tr[0] + 24;
  const arrow = (q, dx, dy) => '<path class="cp-a" d="M' + pt(q) + 'L' + pt([q[0] + dx * 7 - dy * 2.5, q[1] + dy * 7 + dx * 2.5]) + 'L' + pt([q[0] + dx * 7 + dy * 2.5, q[1] + dy * 7 - dx * 2.5]) + 'Z"/>';
  s += '<path class="cp-d" d="M' + f1(bl[0]) + ' ' + f1(bl[1] + 4) + 'V' + f1(yd + 4) + 'M' + f1(tr[0]) + ' ' + f1(bl[1] + 4) + 'V' + f1(yd + 4) + 'M' + f1(bl[0]) + ' ' + f1(yd) + 'H' + f1(tr[0]) + '"/>';
  s += arrow([bl[0], yd], 1, 0) + arrow([tr[0], yd], -1, 0);
  s += '<text class="cp-t" x="' + f1((bl[0] + tr[0]) / 2) + '" y="' + f1(yd + 15) + '" text-anchor="middle">' + fmt(w, dp) + ' ' + u + '</text>';
  s += '<path class="cp-d" d="M' + f1(tr[0] + 4) + ' ' + f1(tr[1]) + 'H' + f1(xd + 4) + 'M' + f1(tr[0] + 4) + ' ' + f1(bl[1]) + 'H' + f1(xd + 4) + 'M' + f1(xd) + ' ' + f1(tr[1]) + 'V' + f1(bl[1]) + '"/>';
  s += arrow([xd, tr[1]], 0, 1) + arrow([xd, bl[1]], 0, -1);
  s += '<text class="cp-t" transform="translate(' + f1(xd + 14) + ' ' + f1((tr[1] + bl[1]) / 2) + ') rotate(-90)" text-anchor="middle">' + fmt(h, dp) + ' ' + u + '</text>';
  // Hole callouts: one leader per distinct hole diameter.
  const holes = d.ents.filter(e => e.t === 'circle' && e.layer === 'HOLES');
  const sizes = [...new Set(holes.map(e => +(2 * e.r).toFixed(9)))].slice(0, 3);
  sizes.forEach((dia, i) => {
    const grp = holes.filter(e => Math.abs(2 * e.r - dia) < 1e-9);
    const e = grp.reduce((m, x) => (x.c[1] - x.c[0] > m.c[1] - m.c[0] ? x : m), grp[0]);
    const q = P(e.c), rk = e.r * k, a = [q[0] - rk * 0.7071, q[1] - rk * 0.7071];
    const label = (grp.length > 1 ? grp.length + 'x ' : '') + '\u00d8' + fmt(dia, dp);
    const ty = 16 + i * 16, tx = 8 + label.length * 7.4 + 4;
    s += '<text class="cp-t" x="8" y="' + ty + '">' + label + '</text>';
    s += '<path class="cp-d" d="M' + f1(tx) + ' ' + f1(ty - 4) + 'L' + pt(a) + '"/>' + '<circle class="cp-dot" cx="' + f1(a[0]) + '" cy="' + f1(a[1]) + '" r="1.8"/>';
  });
  return '<svg class="cadp" viewBox="0 0 ' + Wd + ' ' + Hd + '" role="img" aria-label="DXF preview with overall dimensions">' + s + '</svg>';
}

function cadBuild(W, shape, vals) {
  const n = toBuf(W, vals);
  const len = W.dxf_build(shape, n, state.sys === 'inch' ? 1 : 0, CAD_OPT.ver === 12 ? 1 : 0, CAD_OPT.marks ? 1 : 0, +CAD_OPT.origin, CAD_OPT.explode ? 1 : 0);
  const txt = new TextDecoder().decode(new Uint8Array(W.memory.buffer, W.text_ptr(), Math.abs(len)));
  return len < 0 ? { err: txt } : { dxf: txt, d: cadRead(W) };
}

function renderDxf(el, toolId) {
  const W = state.W, sys = state.sys, u = lenU(sys), dp = sys === 'inch' ? 4 : 3;
  const variants = CAD_TOOLS[toolId];
  const mem = CAD_MEM[toolId] || (CAD_MEM[toolId] = { shape: variants[0][0] });
  const draw = () => {
    const sh = CAD_SHAPES[mem.shape], key = mem.shape + ':' + sys;
    const v = mem[key] || (mem[key] = Object.fromEntries(sh.fields.map(f => [f[0], sys === 'inch' ? f[3] : f[4]])));
    const unit = f => f[2] === 'L' ? u : f[2] === 'deg' ? 'deg' : '';
    el.innerHTML = (variants.length > 1 ? '<div class="mfilter"><span>Shape:</span>' + gseg('cadvar', variants, mem.shape) + '</div>' : '') +
      '<div class="grid">' + sh.fields.map(f => sfield(f[1], f[2] === 'sel' ? gsel(f[0], f[5], v[f[0]]) : sinp(f[0], v[f[0]]), unit(f))).join('') + '</div>' +
      '<div class="mfilter cadopt"><label class="chk"><input type="checkbox" id="cadmarks"' + (CAD_OPT.marks ? ' checked' : '') + '> Centre marks</label>' +
      '<label class="chk">Origin ' + gsel('origin', [[0, 'Centre of the shape'], [1, 'Lower-left corner']], CAD_OPT.origin) + '</label>' +
      '<label class="chk">DXF ' + gsel('ver', [[2000, 'R2000 (LWPOLYLINE, units)'], [12, 'R12 (widest CAM support)']], CAD_OPT.ver) + '</label>' +
      '<label class="chk" title="Write each outline as separate LINE and ARC entities instead of one polyline. For programs that draw the rounded ends of a polyline as straight lines, or do not read polylines at all"><input type="checkbox" id="cadexpl"' + (CAD_OPT.explode ? ' checked' : '') + '> Outlines as separate lines and arcs</label></div>' +
      '<div id="cadprev"></div><div class="mfilter cadopt"><input type="text" id="cadname" aria-label="File name" style="width:220px;font-family:var(--mono)"><button class="btn" id="caddl">Download DXF</button><button class="btn" id="cadsk" title="Open this shape in the 2D sketcher to add to it or measure it (it replaces the sketch; Undo there brings the old one back)">Open in the sketcher</button><span class="desc" id="cadinfo" style="margin:0"></span></div>' +
      '<div class="res" id="cadres"></div><div class="res" id="cadholes" style="margin-top:12px"></div>';
    el.querySelectorAll('#cadvar button').forEach(b => b.onclick = () => { mem.shape = +b.dataset.v; draw(); });
    el.querySelectorAll('.grid [data-k]').forEach(i => i.oninput = i.onchange = () => { v[i.dataset.k] = i.value; calc(); });
    el.querySelector('#cadmarks').onchange = e => { CAD_OPT.marks = e.target.checked; cadSaveOpt(); calc(); };
    el.querySelector('#cadexpl').onchange = e => { CAD_OPT.explode = e.target.checked; cadSaveOpt(); calc(); };
    el.querySelector('.cadopt [data-k="origin"]').onchange = e => { CAD_OPT.origin = +e.target.value; cadSaveOpt(); calc(); };
    el.querySelector('.cadopt [data-k="ver"]').onchange = e => { CAD_OPT.ver = +e.target.value; cadSaveOpt(); calc(); };
    el.querySelector('#cadname').value = mem.file || '';
    el.querySelector('#cadname').oninput = e => { mem.file = e.target.value; };
    el.querySelector('#caddl').onclick = () => {
      if (!last) return;
      let name = (mem.file || el.querySelector('#cadname').placeholder || 'shape.dxf').trim().replace(/[\\/:*?"<>|]+/g, '_');
      if (!/\.dxf$/i.test(name)) name += '.dxf';
      saveFile(name, last.dxf, 'application/dxf');
    };
    el.querySelector('#cadsk').onclick = () => {
      if (!last) return;
      try { skImport(last.dxf, el.querySelector('#cadname').value || el.querySelector('#cadname').placeholder); location.hash = '#/t/sketch'; }
      catch (x) { toast('Could not open it in the sketcher: ' + x.message); }
    };
    calc();
  };
  let last = null;
  const calc = () => {
    const sh = CAD_SHAPES[mem.shape], v = mem[mem.shape + ':' + sys];
    const vals = sh.fields.map(f => { const x = snum(v[f[0]]); return f[2] === 'deg' && !isFinite(x) ? 0 : x; });
    const r = cadBuild(W, mem.shape, vals);
    const prev = el.querySelector('#cadprev'), res = el.querySelector('#cadres'), hl = el.querySelector('#cadholes'), dl = el.querySelector('#caddl');
    const nameEl = el.querySelector('#cadname');
    if (!mem.file) nameEl.placeholder = sh.name + '-' + (sys === 'inch' ? 'inch' : 'mm') + '.dxf';
    if (r.err) {
      last = null; dl.disabled = true; el.querySelector('#cadsk').disabled = true; prev.innerHTML = ''; hl.innerHTML = ''; hl.style.display = 'none';
      res.innerHTML = stable('Check the values', [['<span class="warn">' + sesc(r.err) + '</span>', '', '']]);
      el.querySelector('#cadinfo').textContent = '';
      return;
    }
    last = r; dl.disabled = false; el.querySelector('#cadsk').disabled = false;
    prev.innerHTML = cadPreview(r.d, u, dp);
    const [x0, y0, x1, y1] = r.d.ext, cnt = {};
    r.d.ents.forEach(e => { cnt[e.layer] = (cnt[e.layer] || 0) + 1; });
    const rows = [['Overall width (X)', fmt(x1 - x0, dp), u], ['Overall height (Y)', fmt(y1 - y0, dp), u],
      ['Part extents X', fmt(x0, dp) + ' to ' + fmt(x1, dp), u], ['Part extents Y', fmt(y0, dp) + ' to ' + fmt(y1, dp), u]];
    if (mem.shape === 5) {
      const n = snum(v.n), sz = snum(v.size), m = +v.mode;
      rows.push(['Across corners', fmt(W.polygon_dims(n, sz, m, 0), dp), u], [n % 2 ? 'Flat to opposite corner' : 'Across flats', fmt(W.polygon_dims(n, sz, m, 1), dp), u], ['Side length', fmt(W.polygon_dims(n, sz, m, 2), dp), u], ['Area', fmt(W.polygon_dims(n, sz, m, 3), dp), u + '²']);
    }
    rows.push(['Entities by layer', CAD_LAYER.filter(l => cnt[l]).map(l => l + ' ' + cnt[l]).join(', '), '']);
    rows.push(['DXF units', CAD_OPT.ver === 12 ? 'not stored in R12' : (sys === 'inch' ? 'inches ($INSUNITS 1)' : 'millimetres ($INSUNITS 4)'), '']);
    res.innerHTML = stable('Drawing', rows);
    const holes = r.d.ents.filter(e => e.t === 'circle' && e.layer === 'HOLES');
    hl.style.display = holes.length ? '' : 'none';
    hl.innerHTML = holes.length ? '<div class="h">Hole positions (from the DXF origin)</div><div style="overflow-x:auto"><table><tr><td class="ms">Hole</td><td class="ms" style="text-align:right">X</td><td class="ms" style="text-align:right">Y</td><td class="ms" style="text-align:right">Diameter</td></tr>' +
      holes.map((e, i) => '<tr><td>' + (i + 1) + '</td><td class="v">' + fmt(e.c[0], dp) + '</td><td class="v">' + fmt(e.c[1], dp) + '</td><td class="v">' + fmt(2 * e.r, dp) + '</td></tr>').join('') + '</table></div>' : '';
    el.querySelector('#cadinfo').textContent = (r.dxf.length / 1024).toFixed(1) + ' KB, ' + (CAD_OPT.ver === 12 ? 'R12 (AC1009)' : 'R2000 (AC1015)');
  };
  draw();
}
