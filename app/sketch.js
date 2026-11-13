// 2D sketcher. The drawing lives in the Rust core (core/src/sketch.rs): adding, deleting, moving, undo,
// object snap, picking, measuring, the arc through three points and DXF in and out are all done there.
// This file draws what the core returns, turns pointer positions into drawing coordinates (the view
// transform) and reads what you type. Text in and out goes through gsPut / gsGet (gsim.js).
'use strict';

const SK = { ready: false, tool: 'select', layer: 0, modes: 511, grid: '', ortho: false, view: null, pts: [], sel: [], cur: null,
  text: '', th: '', trot: '0', ver: 2000, explode: false, conv: true, rep: [], err: '', meas: null, file: '', typed: '' };
const SK_TOOLS = [['select', 'Select', 'Click an entity to select it; Shift adds to the selection'], ['point', 'Point', 'A single point'], ['line', 'Line', 'Lines, one after another'],
  ['arc', 'Arc', 'An arc through three points: start, a point on it, end'], ['circle', 'Circle', 'Centre, then a point on the circle or a typed radius'],
  ['rect', 'Rectangle', 'Two opposite corners'], ['text', 'Text', 'One line of text'], ['measure', 'Measure', 'Distance and angle between two points'],
  ['move', 'Move', 'Move the selection from one point to another'], ['copy', 'Copy', 'Copy the selection from one point to another']];
const SK_SNAPS = [[1, 'End'], [2, 'Crossing'], [4, 'Middle'], [8, 'Centre'], [16, 'Quadrant'], [128, 'Tangent'], [256, 'Square'], [32, 'On a line'], [64, 'Grid']];
const SK_KIND = { 1: 'end point', 2: 'crossing', 4: 'middle', 8: 'centre', 16: 'quadrant', 32: 'on the line', 64: 'grid', 128: 'tangent', 256: 'square' };
// AutoCAD Color Index numbers offered for a layer, and how they are drawn here (7 follows the theme: black or white).
const SK_ACI = [[7, 'Black / white'], [1, 'Red'], [2, 'Yellow'], [3, 'Green'], [4, 'Cyan'], [5, 'Blue'], [6, 'Magenta'], [8, 'Grey']];
const SK_RGB = { 1: '#e5484d', 2: '#c9a200', 3: '#2fa84f', 4: '#16a3b3', 5: '#4a7df0', 6: '#c04ac0', 8: '#808080', 9: '#b0b0b0' };
const SK_STEPS = {
  select: ['Click an entity to select it (Shift adds). Two lines selected give the angle between them, two holes the centre distance. Drag to move the view, wheel to zoom.'],
  point: ['Point: click, or type x,y and press Enter.'],
  line: ['Line: click the start point, or type x,y.', 'Line: next point. Type x,y, @dx,dy or @length<angle. Esc or right click ends.'],
  arc: ['Arc: click the start point.', 'Arc: click a point the arc passes through.', 'Arc: click the end point.'],
  circle: ['Circle: click the centre, or type x,y.', 'Circle: click a point on the circle, or type the radius (r5) or diameter (d10).'],
  rect: ['Rectangle: click the first corner.', 'Rectangle: click the opposite corner, or type @width,height.'],
  text: ['Text: fill in the text and height below, then click where it starts (lower left).'],
  measure: ['Measure: click the first point.', 'Measure: click the second point.'],
  move: ['Move: click the base point.', 'Move: click where it goes, or type @dx,dy.'],
  copy: ['Copy: click the base point.', 'Copy: click where the copy goes, or type @dx,dy.'],
};

function skSave() { try { localStorage.setItem('bm.sketch', gsGet(state.W.sk_text())); } catch (e) {} }

// The core's display list (Sketch::display) as objects.
function skRead() {
  const W = state.W, out = { inch: false, layers: [], segs: [], arcs: [], pts: [], texts: [] };
  gsGet(W.sk_draw()).split('\n').forEach(l => {
    const f = l.split('\t');
    if (f[0] === 'U') out.inch = f[1] === 'inch';
    else if (f[0] === 'Y') out.layers.push({ name: f[1], aci: +f[2] });
    else if (f[0] === 'S') out.segs.push({ i: +f[1], l: +f[2], a: [+f[3], +f[4]], b: [+f[5], +f[6]] });
    else if (f[0] === 'R') out.arcs.push({ i: +f[1], l: +f[2], c: [+f[3], +f[4]], r: +f[5], s: +f[6], e: +f[7], full: f[8] === '1' });
    else if (f[0] === 'P') out.pts.push({ i: +f[1], l: +f[2], p: [+f[3], +f[4]] });
    else if (f[0] === 'T') out.texts.push({ i: +f[1], l: +f[2], p: [+f[3], +f[4]], h: +f[5], rot: +f[6], w: +f[7], text: f.slice(8).join(' ') });
  });
  return out;
}

// Put a DXF text into the sketcher (used by the DXF shapes page too). Returns the report lines, or throws.
function skImport(text, name) {
  const W = state.W;
  if (!SK.ready) { W.sk_new(state.sys === 'inch' ? 1 : 0); SK.ready = true; }
  const n = W.sk_import(gsPut(text), W.sk_inch());
  const msg = gsGet(W.sk_msg());
  if (n < 0) throw new Error(msg || 'Could not read the file');
  SK.rep = msg.split('\n').filter(Boolean); SK.err = ''; SK.view = null; SK.sel = []; SK.pts = []; SK.meas = null; SK.layer = 0;
  SK.file = name || '';
  skSave();
  return SK.rep;
}

function renderSketch(el) {
  const W = state.W;
  if (!SK.ready) {
    let t = null;
    try { t = localStorage.getItem('bm.sketch'); } catch (e) {}
    if (t) W.sk_load(gsPut(t)); else W.sk_new(state.sys === 'inch' ? 1 : 0);
    SK.ready = true;
  }
  let D = skRead();
  const inch = () => D.inch, U = () => (D.inch ? 'in' : 'mm'), dp = () => (D.inch ? 4 : 3);
  const gridDefault = () => (D.inch ? 0.05 : 1);
  const grid = () => { const g = snum(SK.grid); return g > 0 ? g : gridDefault(); };
  const chk = b => (b ? ' checked' : '');
  el.innerHTML =
    '<div class="mfilter gsbar"><div class="seg sktools" id="sktool">' + SK_TOOLS.map(t => '<button data-v="' + t[0] + '" title="' + sesc(t[2]) + '">' + t[1] + '</button>').join('') + '</div></div>' +
    '<div class="mfilter gsbar"><button class="btn" id="skundo" title="Undo (Ctrl+Z)">Undo</button><button class="btn" id="skredo" title="Redo (Ctrl+Y)">Redo</button>' +
      '<button class="btn" id="skdel" title="Delete the selection (Delete key)">Delete</button><button class="btn" id="skclr" title="Remove everything (Undo brings it back)">Clear</button>' +
      '<button class="btn" id="skfit" title="Show the whole drawing">Fit</button>' +
      '<button class="btn" id="skopen">Open DXF</button><input type="file" id="skfile" accept=".dxf,application/dxf,text/plain" hidden>' +
      '<button class="btn" id="sksave">Save DXF</button>' +
      '<span class="skarc" title="Polylines made of many short straight lines (curves cut up by another CAD or CAM program) become arcs where every point lies within the tolerance. Undo brings the lines back."><button class="btn" id="skarcfit">Lines to arcs</button> <input type="number" step="any" min="0" inputmode="decimal" id="skarctol" aria-label="Arc fit tolerance" style="width:74px;font-family:var(--mono)"> <span class="ms" id="skarcu"></span></span>' +
      '<select id="skver" aria-label="DXF version" title="DXF version"><option value="2000">R2000 (units stored)</option><option value="12">R12 (widest CAM support)</option></select>' +
      '<label class="chk" title="Write rectangles and other polylines as separate LINE and ARC entities, for programs that do not read polylines or their arcs"><input type="checkbox" id="skexpl"> Polylines as lines and arcs</label></div>' +
    '<div class="grid">' +
      sfield('Layer and its colour', '<select id="sklayer" style="min-width:110px"></select> <select id="sklcol" aria-label="Layer colour" title="Colour of this layer" style="min-width:130px"></select>', '') +
      sfield('New layer', '<input type="text" id="sklnew" placeholder="name" style="width:110px;font-family:var(--mono)"> <button class="btn" id="skladd">Add</button>', '') +
      sfield('Drawing units', '<select id="skunits"><option value="0">mm</option><option value="1">inch</option></select>', '') +
      sfield('Grid spacing', '<input type="number" step="any" min="0" inputmode="decimal" id="skgrid" style="width:90px;font-family:var(--mono)">', '<span id="skgu"></span>') +
    '</div>' +
    '<div class="gschk" id="sksnap"><span class="ms">Snap to:</span>' + SK_SNAPS.map(s => '<label><input type="checkbox" data-m="' + s[0] + '"' + chk(SK.modes & s[0]) + '> ' + s[1] + '</label>').join('') +
      '<label title="Keep each new point level with the last one or straight above or below it"><input type="checkbox" id="skortho"' + chk(SK.ortho) + '> Level or upright only (0 and 90 degrees)</label>' +
      '<label title="When the drawing units change, multiply or divide every size by 25.4 so the part keeps its real size"><input type="checkbox" id="skconv"' + chk(SK.conv) + '> Convert sizes when the units change</label></div>' +
    '<div class="gspanel" id="sktextp" hidden><div class="grid">' +
      sfield('Text', '<input type="text" id="sktext" style="width:220px;font-family:var(--mono)">', '') +
      sfield('Height', '<input type="number" step="any" min="0" inputmode="decimal" id="skth" style="width:90px;font-family:var(--mono)">', '<span id="skthu"></span>') +
      sfield('Angle', '<input type="number" step="any" inputmode="decimal" id="sktrot" style="width:90px;font-family:var(--mono)">', 'deg') +
    '</div></div>' +
    '<p class="ms skhint" id="skhint"></p>' +
    '<div class="mfilter gsbar"><label class="chk">Type a point <input type="text" id="skin" placeholder="x,y   @dx,dy   @length&lt;angle" autocomplete="off" spellcheck="false" style="width:230px;font-family:var(--mono)"></label>' +
      '<span class="ms skstat" id="skstat"></span></div>' +
    '<canvas id="skcv" class="gscv skcv" tabindex="0" role="img" aria-label="Sketch"></canvas>' +
    '<div id="skerr"></div><div class="res" id="skmeas"></div><div class="res" id="skinfo"></div><div class="res" id="sksum"></div><div id="skrep"></div>';
  const $q = s => el.querySelector(s);
  const cv = $q('#skcv');
  let drag = null;

  // ---- view: drawing coordinates <-> canvas pixels ----
  const size = () => [Math.max(200, cv.clientWidth || 700), Math.max(200, cv.clientHeight || 440)];
  const ext = () => { const e = [0, 1, 2, 3].map(i => W.sk_ext(i)); return isFinite(e[0]) ? e : null; };
  function fit() {
    const [w, h] = size(), e = ext();
    if (!e) { const span = D.inch ? 6 : 150; return { k: w / span, cx: span * 0.35, cy: span * 0.35 * h / w }; }
    const ww = Math.max(e[2] - e[0], 1e-9), hh = Math.max(e[3] - e[1], 1e-9);
    const k = Math.min((w - 60) / ww, (h - 60) / hh);
    // A single point or a tiny drawing: do not zoom in without limit.
    const kmax = w / (D.inch ? 0.2 : 5);
    return { k: Math.min(k, kmax), cx: (e[0] + e[2]) / 2, cy: (e[1] + e[3]) / 2 };
  }
  const view = () => SK.view || (SK.view = fit());
  const toPx = p => { const [w, h] = size(), v = view(); return [w / 2 + (p[0] - v.cx) * v.k, h / 2 - (p[1] - v.cy) * v.k]; };
  const toWorld = (px, py) => { const [w, h] = size(), v = view(); return [v.cx + (px - w / 2) / v.k, v.cy - (py - h / 2) / v.k]; };
  const evPx = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  SK.px = toPx; // where a drawing point is on the canvas (used by the smoke test)

  // ---- drawing ----
  function layerColour(l, ink) { const a = D.layers[l] ? D.layers[l].aci : 7; return SK_RGB[a] || ink; }
  function draw() {
    const dpr = window.devicePixelRatio || 1, [w, h] = size();
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const g = cv.getContext('2d'), v = view();
    const ink = gsVar('--ink'), muted = gsVar('--muted'), line = gsVar('--line'), acc = gsVar('--accent');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = gsVar('--panel'); g.fillRect(0, 0, w, h);
    // Grid: the chosen spacing, shown ten times coarser while it would be too dense to read.
    let gs = grid();
    while (gs * v.k < 8) gs *= 10;
    const a = toWorld(0, h), b = toWorld(w, 0);
    g.lineWidth = 1; g.strokeStyle = line; g.globalAlpha = 0.5; g.beginPath();
    for (let i = Math.ceil(a[0] / gs); i * gs <= b[0]; i++) { const x = Math.round(toPx([i * gs, 0])[0]) + 0.5; g.moveTo(x, 0); g.lineTo(x, h); }
    for (let i = Math.ceil(a[1] / gs); i * gs <= b[1]; i++) { const y = Math.round(toPx([0, i * gs])[1]) + 0.5; g.moveTo(0, y); g.lineTo(w, y); }
    g.stroke(); g.globalAlpha = 1;
    // Axes through the origin.
    const o = toPx([0, 0]);
    g.strokeStyle = muted; g.fillStyle = muted; g.font = '10px sans-serif'; g.beginPath();
    g.moveTo(0, Math.round(o[1]) + 0.5); g.lineTo(w, Math.round(o[1]) + 0.5); g.moveTo(Math.round(o[0]) + 0.5, 0); g.lineTo(Math.round(o[0]) + 0.5, h); g.stroke();
    if (o[1] > 12 && o[1] < h) g.fillText('X', w - 12, o[1] - 4);
    if (o[0] > 0 && o[0] < w - 12) g.fillText('Y', o[0] + 4, 11);
    // Entities.
    const sel = new Set(SK.sel);
    const style = (i, l) => { const on = sel.has(i); g.strokeStyle = g.fillStyle = on ? acc : layerColour(l, ink); g.lineWidth = on ? 2.5 : 1.3; };
    D.segs.forEach(s => { style(s.i, s.l); const p = toPx(s.a), q = toPx(s.b); g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke(); });
    D.arcs.forEach(s => { style(s.i, s.l); const c = toPx(s.c); g.beginPath(); if (s.full) g.arc(c[0], c[1], s.r * v.k, 0, 2 * Math.PI); else g.arc(c[0], c[1], s.r * v.k, -s.s * Math.PI / 180, -s.e * Math.PI / 180, true); g.stroke(); });
    D.pts.forEach(s => { style(s.i, s.l); const p = toPx(s.p); g.beginPath(); g.moveTo(p[0] - 4, p[1]); g.lineTo(p[0] + 4, p[1]); g.moveTo(p[0], p[1] - 4); g.lineTo(p[0], p[1] + 4); g.stroke(); });
    D.texts.forEach(s => {
      style(s.i, s.l);
      const p = toPx(s.p), px = s.h * v.k / 0.7;
      if (px < 3) { g.fillRect(p[0], p[1] - 1, Math.max(2, s.w * v.k), 1); return; }
      g.save(); g.translate(p[0], p[1]); g.rotate(-s.rot * Math.PI / 180);
      g.font = px + 'px ' + (gsVar('--mono') || 'monospace');
      // Drawn as wide as the core takes the text to be (its box is what Select picks and Fit shows).
      const mw = g.measureText(s.text).width || 1;
      g.scale(s.w * v.k / mw, 1); g.fillText(s.text, 0, 0); g.restore();
    });
    // The points placed so far and the rubber band to the pointer.
    const c = SK.cur, pts = SK.pts;
    g.strokeStyle = acc; g.fillStyle = acc; g.lineWidth = 1.2; g.setLineDash([5, 4]);
    if (pts.length && c) {
      const p0 = toPx(pts[0]), pc = toPx([c.x, c.y]);
      g.beginPath();
      if (SK.tool === 'line' || SK.tool === 'measure' || SK.tool === 'move' || SK.tool === 'copy') { g.moveTo(p0[0], p0[1]); g.lineTo(pc[0], pc[1]); }
      else if (SK.tool === 'rect') g.rect(Math.min(p0[0], pc[0]), Math.min(p0[1], pc[1]), Math.abs(pc[0] - p0[0]), Math.abs(pc[1] - p0[1]));
      else if (SK.tool === 'circle') g.arc(p0[0], p0[1], W.sk_measure(pts[0][0], pts[0][1], c.x, c.y, 0) * v.k, 0, 2 * Math.PI);
      else if (SK.tool === 'arc' && pts.length === 1) { g.moveTo(p0[0], p0[1]); g.lineTo(pc[0], pc[1]); }
      else if (SK.tool === 'arc') {
        const A = i => W.sk_arc3_at(pts[0][0], pts[0][1], pts[1][0], pts[1][1], c.x, c.y, i);
        if (isFinite(A(2))) { const cc = toPx([A(0), A(1)]); g.arc(cc[0], cc[1], A(2) * v.k, -A(3) * Math.PI / 180, -A(4) * Math.PI / 180, true); }
        else { g.moveTo(p0[0], p0[1]); g.lineTo(pc[0], pc[1]); }
      }
      g.stroke();
    }
    if (SK.meas) { const p = toPx(SK.meas[0]), q = toPx(SK.meas[1]); g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke(); }
    g.setLineDash([]);
    pts.concat(SK.meas || []).forEach(p => { const q = toPx(p); g.fillRect(q[0] - 2.5, q[1] - 2.5, 5, 5); });
    // Snap marker at the pointer.
    if (c && SK.tool !== 'select') {
      const q = toPx([c.x, c.y]), r = 6;
      g.lineWidth = 1.5; g.beginPath();
      if (c.kind === 1) g.rect(q[0] - r, q[1] - r, 2 * r, 2 * r);
      else if (c.kind === 2) { g.moveTo(q[0] - r, q[1] - r); g.lineTo(q[0] + r, q[1] + r); g.moveTo(q[0] - r, q[1] + r); g.lineTo(q[0] + r, q[1] - r); }
      else if (c.kind === 4) { g.moveTo(q[0], q[1] - r); g.lineTo(q[0] + r, q[1] + r); g.lineTo(q[0] - r, q[1] + r); g.closePath(); }
      else if (c.kind === 8) g.arc(q[0], q[1], r, 0, 2 * Math.PI);
      else if (c.kind === 16) { g.moveTo(q[0], q[1] - r); g.lineTo(q[0] + r, q[1]); g.lineTo(q[0], q[1] + r); g.lineTo(q[0] - r, q[1]); g.closePath(); }
      else if (c.kind === 32) { g.moveTo(q[0] - r, q[1] - r); g.lineTo(q[0] + r, q[1] - r); g.lineTo(q[0] - r, q[1] + r); g.lineTo(q[0] + r, q[1] + r); g.closePath(); }
      else if (c.kind === 128) { g.arc(q[0], q[1] + 2, r - 2, 0, 2 * Math.PI); g.moveTo(q[0] - r, q[1] - r + 3.5); g.lineTo(q[0] + r, q[1] - r + 3.5); }
      else if (c.kind === 256) { g.moveTo(q[0] - r, q[1] - r); g.lineTo(q[0] - r, q[1] + r); g.lineTo(q[0] + r, q[1] + r); g.moveTo(q[0] - r, q[1]); g.lineTo(q[0], q[1]); g.lineTo(q[0], q[1] + r); }
      else { g.moveTo(q[0] - r, q[1]); g.lineTo(q[0] + r, q[1]); g.moveTo(q[0], q[1] - r); g.lineTo(q[0], q[1] + r); }
      g.stroke();
      if (c.kind && c.kind !== 64) { g.font = '10px sans-serif'; g.fillText(SK_KIND[c.kind], q[0] + r + 4, q[1] - r - 2); }
    }
  }

  // ---- panels under the canvas ----
  const rowsOf = txt => txt.split('\n').filter(Boolean).map(l => l.split('\t'));
  const val = (v, k) => (k === 'L' ? [fmt(+v, dp()), U()] : k === 'A' ? [fmt(+v, 3), 'deg'] : k === 'S' ? [fmt(+v, dp()), U() + '²'] : k === 'N' ? [fmt(+v, 0), ''] : ['', '']);
  function panels() {
    const hint = SK_STEPS[SK.tool], needSel = (SK.tool === 'move' || SK.tool === 'copy') && !SK.sel.length;
    $q('#skhint').textContent = needSel ? 'Pick what to ' + SK.tool + ' first: choose Select, click the entities (Shift adds), then choose ' + (SK.tool === 'move' ? 'Move' : 'Copy') + ' again.' : hint[Math.min(SK.pts.length, hint.length - 1)];
    $q('#sktextp').hidden = SK.tool !== 'text';
    el.querySelectorAll('#sktool button').forEach(b => b.classList.toggle('on', b.dataset.v === SK.tool));
    $q('#skundo').disabled = !W.sk_can_undo(); $q('#skredo').disabled = !W.sk_can_redo();
    $q('#skdel').disabled = !SK.sel.length; $q('#skclr').disabled = !W.sk_count(); $q('#sksave').disabled = !W.sk_count();
    $q('#skerr').innerHTML = SK.err ? '<p class="gsbanner">' + sesc(SK.err) + '</p>' : '';
    const m = SK.meas;
    $q('#skmeas').innerHTML = m ? stable('Measured', [
      ['Distance', fmt(W.sk_measure(m[0][0], m[0][1], m[1][0], m[1][1], 0), dp()), U()], ['Along X', fmt(W.sk_measure(m[0][0], m[0][1], m[1][0], m[1][1], 1), dp()), U()],
      ['Along Y', fmt(W.sk_measure(m[0][0], m[0][1], m[1][0], m[1][1], 2), dp()), U()], ['Direction (from +X, counter-clockwise)', fmt(W.sk_measure(m[0][0], m[0][1], m[1][0], m[1][1], 3), 3), 'deg'],
      ['From', fmt(m[0][0], dp()) + ', ' + fmt(m[0][1], dp()), U()], ['To', fmt(m[1][0], dp()) + ', ' + fmt(m[1][1], dp()), U()]]) : '';
    let info = '';
    if (SK.sel.length === 1) {
      const r = rowsOf(gsGet(W.sk_info(SK.sel[0])));
      if (r.length) {
        const ent = D.segs.concat(D.arcs, D.pts, D.texts).find(x => x.i === SK.sel[0]);
        info = stable('Selected: ' + sesc(r[0][0]), r.slice(1).map(x => [sesc(x[0])].concat(val(x[1], x[2]))).concat([['Layer', sesc(ent && D.layers[ent.l] ? D.layers[ent.l].name : '0'), '']]));
      }
    } else if (SK.sel.length === 2) {
      const r = rowsOf(gsGet(W.sk_between(SK.sel[0], SK.sel[1])));
      info = r.length ? stable('Selected: ' + sesc(r[0][0]), r.slice(1).map(x => [sesc(x[0])].concat(val(x[1], x[2])))) : stable('Selected', [['Entities', '2', '']]);
    } else if (SK.sel.length > 2) info = stable('Selected', [['Entities', String(SK.sel.length), '']]);
    $q('#skinfo').innerHTML = info;
    const e = ext(), n = W.sk_count();
    $q('#sksum').innerHTML = stable('Drawing', n ? [['Entities', String(n), ''], ['Width (X)', fmt(e[2] - e[0], dp()), U()], ['Height (Y)', fmt(e[3] - e[1], dp()), U()],
      ['Extents X', fmt(e[0], dp()) + ' to ' + fmt(e[2], dp()), U()], ['Extents Y', fmt(e[1], dp()) + ' to ' + fmt(e[3], dp()), U()],
      ['Layers', D.layers.map(l => sesc(l.name)).join(', '), '']] : [['Entities', '0', '']]);
    $q('#skrep').innerHTML = SK.rep.length ? '<div class="res"><div class="h">Last file opened' + (SK.file ? ': ' + sesc(SK.file) : '') + '</div><ul class="gsl">' + SK.rep.map(r => '<li>' + sesc(r) + '</li>').join('') + '</ul></div>' : '';
    // Layer boxes.
    if (SK.layer >= D.layers.length) SK.layer = 0;
    $q('#sklayer').innerHTML = D.layers.map((l, i) => '<option value="' + i + '"' + (i === SK.layer ? ' selected' : '') + '>' + sesc(l.name) + '</option>').join('');
    const aci = D.layers[SK.layer] ? D.layers[SK.layer].aci : 7;
    $q('#sklcol').innerHTML = (SK_ACI.some(c => c[0] === aci) ? SK_ACI : SK_ACI.concat([[aci, 'Colour ' + aci]])).map(c => '<option value="' + c[0] + '"' + (c[0] === aci ? ' selected' : '') + '>' + c[1] + '</option>').join('');
    $q('#skunits').value = D.inch ? '1' : '0';
    $q('#skgu').textContent = U(); $q('#skthu').textContent = U();
    $q('#skgrid').placeholder = String(gridDefault());
    $q('#skth').placeholder = D.inch ? '0.1' : '2.5';
  }
  function status() {
    const c = SK.cur;
    if (!c) { $q('#skstat').textContent = ''; return; }
    let t = 'X ' + fmt(c.x, dp()) + '  Y ' + fmt(c.y, dp()) + ' ' + U();
    if (SK.pts.length) {
      const p = SK.pts[SK.pts.length - 1];
      t += '   from the last point: ' + fmt(W.sk_measure(p[0], p[1], c.x, c.y, 0), dp()) + ' ' + U() + ' at ' + fmt(W.sk_measure(p[0], p[1], c.x, c.y, 3), 2) + ' deg';
    }
    $q('#skstat').textContent = t;
  }
  // After anything changed in the core: read it back, save it, redraw.
  function sync(keepRep) {
    D = skRead();
    SK.sel = SK.sel.filter(i => i < W.sk_count());
    if (!keepRep) SK.err = '';
    skSave(); panels(); draw();
  }
  const fail = () => { SK.err = gsGet(W.sk_msg()); panels(); };

  // ---- tools ----
  function setTool(t) { SK.tool = t; SK.pts = []; SK.meas = t === 'measure' ? SK.meas : null; SK.err = ''; panels(); draw(); }
  const textH = () => { const h = snum(SK.th); return h > 0 ? h : (D.inch ? 0.1 : 2.5); };
  // Send the selection to the core (it holds it for delete, move and copy).
  const pushSel = () => { W.sk_sel_clear(); SK.sel.forEach(i => W.sk_sel_add(i)); };
  const pullSel = () => { SK.sel = []; for (let i = 0; i < W.sk_sel_len(); i++) SK.sel.push(W.sk_sel_at(i)); };
  // One point given, by a click or typed.
  function place(p) {
    const t = SK.tool, L = SK.layer, pts = SK.pts;
    let r = 0;
    if (t === 'select') return;
    if (t === 'point') r = W.sk_point(L, p[0], p[1]);
    else if (t === 'text') { if (!SK.text.trim()) { SK.err = 'Type the text first'; panels(); return; } r = W.sk_text_add(gsPut(SK.text), L, p[0], p[1], textH(), snum(SK.trot) || 0); }
    else if ((t === 'move' || t === 'copy') && !SK.sel.length) { panels(); return; }
    else if (!pts.length || (t === 'arc' && pts.length === 1)) { pts.push(p); if (t === 'measure') SK.meas = null; panels(); draw(); return; }
    else if (t === 'line') { r = W.sk_line(L, pts[0][0], pts[0][1], p[0], p[1]); if (r >= 0) SK.pts = [p]; }
    else if (t === 'circle') { r = W.sk_circle(L, pts[0][0], pts[0][1], W.sk_measure(pts[0][0], pts[0][1], p[0], p[1], 0)); if (r >= 0) SK.pts = []; }
    else if (t === 'rect') { r = W.sk_rect(L, pts[0][0], pts[0][1], p[0], p[1]); if (r >= 0) SK.pts = []; }
    else if (t === 'arc') { r = W.sk_arc3(L, pts[0][0], pts[0][1], pts[1][0], pts[1][1], p[0], p[1]); if (r >= 0) SK.pts = []; }
    else if (t === 'measure') { SK.meas = [pts[0], p]; SK.pts = []; panels(); draw(); return; }
    else if (t === 'move' || t === 'copy') {
      pushSel();
      const n = W.sk_move_sel(W.sk_measure(pts[0][0], pts[0][1], p[0], p[1], 1), W.sk_measure(pts[0][0], pts[0][1], p[0], p[1], 2), t === 'copy' ? 1 : 0);
      if (n > 0) { pullSel(); SK.pts = []; }
    }
    if (r < 0) { fail(); return; }
    sync();
  }
  // What was typed in the point box: x,y  @dx,dy  @length<angle  length<angle  r5  d10
  function typed(s) {
    const t = s.replace(/\s+/g, ''), num = '([-+]?(?:\\d+\\.?\\d*|\\.\\d+))', last = SK.pts.length ? SK.pts[SK.pts.length - 1] : [0, 0];
    let m;
    if ((m = t.match(new RegExp('^(@?)' + num + ',' + num + '$')))) return place(m[1] ? [last[0] + +m[2], last[1] + +m[3]] : [+m[2], +m[3]]);
    if ((m = t.match(new RegExp('^(@?)' + num + '<' + num + '$')))) { const b = m[1] ? last : [0, 0]; return place([W.sk_polar(b[0], b[1], +m[2], +m[3], 0), W.sk_polar(b[0], b[1], +m[2], +m[3], 1)]); }
    if (SK.tool === 'circle' && SK.pts.length === 1 && (m = t.match(new RegExp('^([rRdD]?)' + num + '$')))) {
      const c = SK.pts[0], r = /d/i.test(m[1]) ? W.sk_circle_dia(SK.layer, c[0], c[1], +m[2]) : W.sk_circle(SK.layer, c[0], c[1], +m[2]);
      if (r < 0) return fail();
      SK.pts = []; return sync();
    }
    SK.err = 'Could not read "' + s + '". Type x,y for a point, @dx,dy for a step from the last point, or @length<angle' + (SK.tool === 'circle' ? '; for a circle r5 is a radius and d10 a diameter' : '');
    panels();
  }
  function cancel() { if (SK.pts.length) SK.pts = []; else if (SK.meas) SK.meas = null; else SK.sel = []; SK.err = ''; panels(); draw(); }
  function del() { if (!SK.sel.length) return; pushSel(); W.sk_delete_sel(); SK.sel = []; sync(); }
  function undo(redo) { if (redo ? W.sk_redo() : W.sk_undo()) { SK.sel = []; SK.pts = []; sync(); } }

  // ---- pointer ----
  function pointer(e) {
    const [px, py] = evPx(e), w = toWorld(px, py), tol = 10 / view().k;
    const from = SK.pts.length ? SK.pts[SK.pts.length - 1] : null;
    let kind = W.sk_snap(w[0], w[1], tol, SK.modes, grid(), from ? 1 : 0, from ? from[0] : 0, from ? from[1] : 0), x = W.sk_sx(), y = W.sk_sy();
    if (SK.ortho && SK.pts.length) { const p = SK.pts[SK.pts.length - 1], ox = W.sk_ortho(p[0], p[1], x, y, 0), oy = W.sk_ortho(p[0], p[1], x, y, 1); if (ox !== x || oy !== y) kind = 0; x = ox; y = oy; }
    SK.cur = { x, y, kind, raw: w };
  }
  cv.onpointerdown = e => { cv.focus(); drag = { x: e.clientX, y: e.clientY, cx: view().cx, cy: view().cy, moved: false, button: e.button }; try { cv.setPointerCapture(e.pointerId); } catch (x) {} };
  cv.onpointermove = e => {
    if (drag && (drag.moved || Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 4)) {
      drag.moved = true;
      const v = view(); v.cx = drag.cx - (e.clientX - drag.x) / v.k; v.cy = drag.cy + (e.clientY - drag.y) / v.k;
      draw(); return;
    }
    pointer(e); status(); draw();
  };
  cv.onpointerup = e => {
    const d = drag; drag = null;
    if (!d || d.moved) return;
    if (d.button === 2) return cancel();
    if (d.button !== 0) return;
    pointer(e);
    if (SK.tool === 'select') {
      const i = W.sk_pick(SK.cur.raw[0], SK.cur.raw[1], 6 / view().k);
      if (i < 0) { if (!e.shiftKey) SK.sel = []; }
      else if (e.shiftKey) SK.sel = SK.sel.includes(i) ? SK.sel.filter(x => x !== i) : SK.sel.concat([i]);
      else SK.sel = [i];
      panels(); draw(); return;
    }
    place([SK.cur.x, SK.cur.y]);
  };
  cv.onpointerleave = () => { if (!drag) { SK.cur = null; status(); draw(); } };
  cv.oncontextmenu = e => e.preventDefault();
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    const [px, py] = evPx(e), before = toWorld(px, py), v = view();
    v.k *= Math.exp(-e.deltaY * 0.0015);
    const after = toWorld(px, py);
    v.cx += before[0] - after[0]; v.cy += before[1] - after[1];
    draw();
  }, { passive: false });
  const keys = e => {
    const k = e.key.toLowerCase(), ctrl = e.ctrlKey || e.metaKey;
    if (k === 'escape') { cancel(); e.preventDefault(); }
    else if ((k === 'delete' || k === 'backspace') && e.target === cv) { del(); e.preventDefault(); }
    else if (ctrl && k === 'z' && !e.shiftKey && e.target === cv) { undo(false); e.preventDefault(); }
    else if (ctrl && (k === 'y' || (k === 'z' && e.shiftKey)) && e.target === cv) { undo(true); e.preventDefault(); }
  };
  cv.onkeydown = keys;

  // ---- controls ----
  el.querySelectorAll('#sktool button').forEach(b => b.onclick = () => setTool(b.dataset.v));
  $q('#skundo').onclick = () => undo(false);
  $q('#skredo').onclick = () => undo(true);
  $q('#skdel').onclick = del;
  $q('#skclr').onclick = () => { if (W.sk_clear()) { SK.sel = []; SK.pts = []; SK.meas = null; SK.rep = []; sync(); } };
  $q('#skfit').onclick = () => { SK.view = null; draw(); };
  $q('#skver').value = String(SK.ver);
  $q('#skver').onchange = e => { SK.ver = +e.target.value; };
  $q('#skexpl').checked = SK.explode;
  $q('#skexpl').onchange = e => { SK.explode = e.target.checked; };
  $q('#sksave').onclick = () => {
    let name = (SK.file || 'sketch').replace(/\.dxf$/i, '').replace(/[\\/:*?"<>|]+/g, '_') + '.dxf';
    saveFile(name, gsGet(W.sk_export(SK.ver === 12 ? 1 : 0, SK.explode ? 1 : 0)), 'application/dxf');
  };
  // Arc fitting of imported polylines, within a tolerance in the drawing's units (0.01 mm or 0.0005 in to start).
  if (!(snum(SK.arctol) > 0)) SK.arctol = D.inch ? 0.0005 : 0.01;
  $q('#skarctol').value = SK.arctol; $q('#skarcu').textContent = U();
  $q('#skarctol').oninput = e => { SK.arctol = e.target.value; };
  $q('#skarcfit').onclick = () => {
    const t = snum(SK.arctol);
    if (!(t > 0)) { SK.err = 'Enter a tolerance for the arc fit.'; panels(); return; }
    W.sk_fit_arcs(t); SK.rep = gsGet(W.sk_msg()).split('\n').filter(Boolean); SK.err = ''; skSave(); sync(true);
  };
  $q('#skopen').onclick = () => $q('#skfile').click();
  $q('#skfile').onchange = e => {
    const f = e.target.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try { skImport(String(rd.result), f.name); sync(true); }
      catch (x) { SK.err = f.name + ': ' + x.message; panels(); }
      e.target.value = '';
    };
    rd.readAsText(f);
  };
  $q('#sklayer').onchange = e => { SK.layer = +e.target.value; panels(); };
  $q('#sklcol').onchange = e => { if (W.sk_layer_colour(SK.layer, +e.target.value)) sync(); };
  $q('#skladd').onclick = () => {
    const name = $q('#sklnew').value.trim();
    if (!name) return;
    SK.layer = W.sk_layer(gsPut(name), 7);
    $q('#sklnew').value = '';
    sync();
  };
  $q('#skunits').onchange = e => { if (W.sk_set_units(+e.target.value, SK.conv ? 1 : 0)) { SK.view = null; SK.grid = ''; $q('#skgrid').value = ''; SK.pts = []; SK.meas = null; sync(); } };
  $q('#skgrid').value = SK.grid;
  $q('#skgrid').oninput = e => { SK.grid = e.target.value; draw(); };
  el.querySelectorAll('#sksnap [data-m]').forEach(c => c.onchange = () => { SK.modes = c.checked ? SK.modes | +c.dataset.m : SK.modes & ~+c.dataset.m; });
  $q('#skortho').onchange = e => { SK.ortho = e.target.checked; };
  $q('#skconv').onchange = e => { SK.conv = e.target.checked; };
  $q('#sktext').value = SK.text; $q('#skth').value = SK.th; $q('#sktrot').value = SK.trot;
  $q('#sktext').oninput = e => { SK.text = e.target.value; };
  $q('#skth').oninput = e => { SK.th = e.target.value; };
  $q('#sktrot').oninput = e => { SK.trot = e.target.value; };
  $q('#skin').onkeydown = e => {
    if (e.key === 'Enter') { const s = e.target.value.trim(); if (s) { typed(s); e.target.value = ''; } e.preventDefault(); }
    else if (e.key === 'Escape') { e.target.value = ''; cancel(); }
  };
  if (typeof ResizeObserver === 'function') { const ro = new ResizeObserver(() => { if (!document.body.contains(cv)) { ro.disconnect(); return; } draw(); }); ro.observe(cv); }
  panels(); draw();
}
