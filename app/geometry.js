'use strict';
// Geometry screens: triangle solver, arcs and chords, sine bar and gauge
// blocks, dividing head, stock weight, fillets, dovetails. Arithmetic is in
// the Rust core (state.W); this file reads inputs, converts units and draws.
// Uses the small helpers defined in shop.js (sesc, snum, sinp, sfield, stable).

const gdp = () => state.sys === 'inch' ? 4 : 3;
const gf = (x, d) => fmt(x, d === undefined ? gdp() : d);
const gbind = (el, s, calc) => el.querySelectorAll('[data-k]').forEach(i => i.oninput = i.onchange = () => { s[i.dataset.k] = i.value; calc(); });
const gseg = (id, opts, cur) => '<div class="seg" id="' + id + '">' + opts.map(([v, t]) => '<button data-v="' + v + '"' + (String(v) === String(cur) ? ' class="on"' : '') + '>' + t + '</button>').join('') + '</div>';
const gsel = (k, opts, cur) => '<select data-k="' + k + '">' + opts.map(([v, t]) => '<option value="' + v + '"' + (String(v) === String(cur) ? ' selected' : '') + '>' + t + '</option>').join('') + '</select>';
const toBuf = (W, arr) => { const n = Math.min(arr.length, W.buf_len()); new Float64Array(W.memory.buffer, W.buf_ptr(), n).set(arr.slice(0, n)); return n; };
const listOut = (W, n) => { const o = []; for (let i = 0; i < n; i++) o.push(W.list_out(i)); return o; };
// Solution picker that is only rebuilt when the number of solutions changes,
// so a click on it is not lost when a blur/change redraws the results.
function gpicker(box, id, n, s, key, label, onpick) {
  if (n !== 2) { box.innerHTML = ''; box.dataset.n = ''; return; }
  if (box.dataset.n !== '2') {
    box.innerHTML = '<div class="mfilter"><span>' + label + '</span>' + gseg(id, [[0, 'Solution 1'], [1, 'Solution 2']], s[key]) + '</div>';
    box.dataset.n = '2';
    box.querySelectorAll('button').forEach(b => b.onclick = () => { s[key] = +b.dataset.v; onpick(); });
  }
  box.querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.v === s[key]));
}
const numsFrom = t => String(t || '').split(/[\s,;]+/).filter(Boolean).map(Number).filter(isFinite);

// Fit a set of points into an SVG box; returns a mapper and scale.
function gfit(pts, w, h, pad) {
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const k = Math.min((w - 2 * pad) / Math.max(x1 - x0, 1e-9), (h - 2 * pad) / Math.max(y1 - y0, 1e-9));
  const ox = pad + ((w - 2 * pad) - (x1 - x0) * k) / 2, oy = pad + ((h - 2 * pad) - (y1 - y0) * k) / 2;
  return { k, P: p => [ox + (p[0] - x0) * k, h - (oy + (p[1] - y0) * k)] };
}
const gsvg = (w, h, body, label) => '<svg class="geo" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + label + '">' + body + '</svg>';
const gpt = q => q[0].toFixed(1) + ' ' + q[1].toFixed(1);
const gtxt = (q, t, cls, anchor) => '<text class="' + (cls || 'gt') + '" x="' + q[0].toFixed(1) + '" y="' + q[1].toFixed(1) + '"' + (anchor ? ' text-anchor="' + anchor + '"' : '') + '>' + t + '</text>';

// ---------- Triangle solver ----------
const TRI_STATE = { mode: 'right', a: 3, b: 4, c: '', A: '', B: '', C: '', sol: 0 };
function triDiagram(t) {
  const [a, b, c, A] = t, Ar = A * Math.PI / 180;
  const pA = [0, 0], pB = [c, 0], pC = [b * Math.cos(Ar), b * Math.sin(Ar)];
  const m = gfit([pA, pB, pC], 420, 230, 34);
  const qA = m.P(pA), qB = m.P(pB), qC = m.P(pC);
  const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const cen = [(qA[0] + qB[0] + qC[0]) / 3, (qA[1] + qB[1] + qC[1]) / 3];
  const away = (q, d) => { const v = [q[0] - cen[0], q[1] - cen[1]], l = Math.hypot(v[0], v[1]) || 1; return [q[0] + v[0] / l * d, q[1] + v[1] / l * d + 4]; };
  let s = '<path class="gp" d="M' + gpt(qA) + 'L' + gpt(qB) + 'L' + gpt(qC) + 'Z"/>';
  s += gtxt(away(qA, 14), 'A', 'gv', 'middle') + gtxt(away(qB, 14), 'B', 'gv', 'middle') + gtxt(away(qC, 14), 'C', 'gv', 'middle');
  s += gtxt(away(mid(qB, qC), 12), 'a', 'gs', 'middle') + gtxt(away(mid(qA, qC), 12), 'b', 'gs', 'middle') + gtxt(away(mid(qA, qB), 12), 'c', 'gs', 'middle');
  return gsvg(420, 230, s, 'Triangle');
}
function renderTriangle(el) {
  const s = TRI_STATE, W = state.W, u = lenU(state.sys);
  if (s.mode === 'right') s.C = 90;
  const draw = () => {
    const right = s.mode === 'right';
    el.innerHTML = '<div class="mfilter"><span>Triangle:</span>' + gseg('trimode', [['right', 'Right angle at C'], ['any', 'Any triangle']], s.mode) + '</div>' +
      '<p class="desc">Side a is opposite angle A, b opposite B, c opposite C. Enter any three values, at least one of them a side' + (right ? ' (C is fixed at 90°, so enter two more; c is the hypotenuse)' : '') + '. Leave the rest blank.</p>' +
      '<div class="grid">' + sfield('Side a', sinp('a', s.a), u) + sfield('Side b', sinp('b', s.b), u) + sfield('Side c', sinp('c', s.c), u) +
      sfield('Angle A', sinp('A', s.A), 'deg') + sfield('Angle B', sinp('B', s.B), 'deg') + sfield('Angle C', sinp('C', right ? 90 : s.C, 120, right ? ' disabled' : ''), 'deg') + '</div>' +
      '<div id="trisol"></div><div id="tridia"></div><div class="res" id="trires"></div>';
    el.querySelectorAll('#trimode button').forEach(b => b.onclick = () => { s.mode = b.dataset.v; if (s.mode === 'any' && +s.C === 90) s.C = ''; s.sol = 0; draw(); });
    gbind(el, s, calc); calc();
  };
  const calc = () => {
    const v = ['a', 'b', 'c', 'A', 'B', 'C'].map(k => snum(s.mode === 'right' && k === 'C' ? 90 : s[k]));
    const known = v.filter(isFinite).length, res = el.querySelector('#trires');
    const n = W.tri_solve(...v, 0, 9);
    if (n < 2) s.sol = 0;
    gpicker(el.querySelector('#trisol'), 'trisel', n, s, 'sol', 'Two triangles fit (ambiguous case):', calc);
    if (known !== 3 || !n) {
      el.querySelector('#tridia').innerHTML = '';
      res.innerHTML = stable('Results', [[known !== 3 ? 'Enter exactly three values (' + known + ' entered)' : (v.slice(0, 3).some(isFinite) ? 'No triangle has these values' : 'At least one side is needed'), '', '']]);
      return;
    }
    const t = [0, 1, 2, 3, 4, 5].map(i => W.tri_solve(...v, s.sol, i)), area = W.tri_solve(...v, s.sol, 6);
    el.querySelector('#tridia').innerHTML = triDiagram(t);
    res.innerHTML = stable('Solution' + (n === 2 ? ' ' + (s.sol + 1) + ' of 2' : ''), [
      ['Side a', gf(t[0], gdp() + 1), u], ['Side b', gf(t[1], gdp() + 1), u], ['Side c', gf(t[2], gdp() + 1), u],
      ['Angle A', gf(t[3], 4), 'deg'], ['Angle B', gf(t[4], 4), 'deg'], ['Angle C', gf(t[5], 4), 'deg'],
      ['Area', gf(area, gdp()), u + '²'], ['Perimeter', gf(t[0] + t[1] + t[2], gdp()), u]]) +
      (n === 2 ? '<p class="ms" style="padding:4px 10px">Two sides and an angle that is not between them can fit two different triangles. Pick the one that matches your drawing.</p>' : '');
  };
  draw();
}

// ---------- Arcs, chords, circle through three points ----------
const ARC_STATE = { ka: 0, x: 50, kb: 1, y: 60, sol: 0, p: [[0, 0], [10, 0], [0, 10]] };
// Kinds as in core arc_from_two: 0 radius, 1 included angle, 2 chord, 3 arc length, 4 sagitta.
const ARC_KINDS = [[0, 'Radius'], [1, 'Included angle'], [2, 'Chord length'], [3, 'Arc length'], [4, 'Sagitta (height of the arc above the chord)']];
function arcDiagram(r, th) {
  const t = th * Math.PI / 180, a0 = Math.PI / 2 - t / 2, a1 = Math.PI / 2 + t / 2;
  const P = a => [r * Math.cos(a), r * Math.sin(a)];
  const pts = [[0, 0], P(a0), P(a1)]; for (let i = 0; i <= 24; i++) pts.push(P(a0 + (a1 - a0) * i / 24));
  const m = gfit(pts, 420, 230, 26);
  const p0 = m.P(P(a0)), p1 = m.P(P(a1)), c = m.P([0, 0]), top = m.P([0, r]), mc = m.P([0, r * Math.cos(t / 2)]);
  const R = r * m.k, large = th > 180 ? 1 : 0;
  let s = '<path class="gfill" d="M' + gpt(p0) + 'A' + R.toFixed(1) + ' ' + R.toFixed(1) + ' 0 ' + large + ' 0 ' + gpt(p1) + 'Z"/>';
  s += '<path class="gp" d="M' + gpt(p0) + 'A' + R.toFixed(1) + ' ' + R.toFixed(1) + ' 0 ' + large + ' 0 ' + gpt(p1) + '"/>';
  s += '<path class="gc" d="M' + gpt(p0) + 'L' + gpt(p1) + '"/><path class="gm" d="M' + gpt(c) + 'L' + gpt(p0) + 'M' + gpt(c) + 'L' + gpt(p1) + '"/>';
  s += '<path class="gk" d="M' + gpt(mc) + 'L' + gpt(top) + '"/>' + '<circle class="gdot" cx="' + c[0].toFixed(1) + '" cy="' + c[1].toFixed(1) + '" r="2.5"/>';
  s += gtxt([c[0] + 6, c[1] + 4], 'centre', 'gs') + gtxt([(p0[0] + p1[0]) / 2 + 6, (p0[1] + p1[1]) / 2 + 14], 'chord', 'gs') + gtxt([top[0] + 6, (top[1] + mc[1]) / 2 + 4], 'sagitta', 'gs');
  return gsvg(420, 230, s, 'Arc, chord and sagitta');
}
function renderArc(el) {
  const s = ARC_STATE, W = state.W, u = lenU(state.sys);
  const draw = () => {
    if (+s.ka === +s.kb) s.kb = (+s.ka + 1) % 5;
    el.innerHTML = '<div class="grid">' + sfield('First known value', gsel('ka', ARC_KINDS, s.ka), '') + sfield('Value', sinp('x', s.x), +s.ka === 1 ? 'deg' : u) +
      sfield('Second known value', gsel('kb', ARC_KINDS.filter(k => k[0] !== +s.ka), s.kb), '') + sfield('Value', sinp('y', s.y), +s.kb === 1 ? 'deg' : u) + '</div>' +
      '<div id="arcsol"></div><div id="arcdia"></div><div class="res" id="arcres"></div>' +
      '<h2>Circle through three points</h2><p class="desc">Centre and radius of the circle through three measured points, for example three probe hits on a bore or a radius.</p>' +
      '<div class="grid">' + [0, 1, 2].map(i => sfield('Point ' + (i + 1) + ' X', sinp('p' + i + 'x', s.p[i][0]), u) + sfield('Point ' + (i + 1) + ' Y', sinp('p' + i + 'y', s.p[i][1]), u)).join('') + '</div><div class="res" id="c3res"></div>';
    el.querySelector('[data-k="ka"]').onchange = e => { s.ka = +e.target.value; s.sol = 0; draw(); };
    el.querySelector('[data-k="kb"]').onchange = e => { s.kb = +e.target.value; s.sol = 0; draw(); };
    el.querySelectorAll('[data-k]').forEach(i => { if (i.dataset.k === 'ka' || i.dataset.k === 'kb') return; i.oninput = () => { const k = i.dataset.k; if (k[0] === 'p' && k.length === 3) s.p[+k[1]][k[2] === 'x' ? 0 : 1] = i.value; else s[k] = i.value; calc(); }; });
    calc();
  };
  const calc = () => {
    const x = snum(s.x), y = snum(s.y), d = gdp();
    const n = W.arc_two(+s.ka, x, +s.kb, y, 0, 9) || 0;
    if (s.sol >= n) s.sol = 0;
    const A = k => W.arc_two(+s.ka, x, +s.kb, y, s.sol, k);
    const r = A(0), t = A(1), solBox = el.querySelector('#arcsol');
    if (n > 0 && r > 0 && t > 0) {
      const angOf = i => W.arc_two(+s.ka, x, +s.kb, y, i, 1);
      solBox.innerHTML = n > 1 ? '<div class="grid"><div class="f"><span>Two arcs fit these values</span><div class="row"><div class="seg" id="arcseg">' + Array.from({ length: n }, (_, i) => '<button type="button" data-i="' + i + '"' + (i === s.sol ? ' class="on"' : '') + '>' + (i === 0 ? 'Smaller' : 'Larger') + ' angle, ' + gf(angOf(i), 2) + '°</button>').join('') + '</div></div></div></div>' : '';
      solBox.querySelectorAll('button').forEach(b => b.onclick = () => { s.sol = +b.dataset.i; calc(); });
      el.querySelector('#arcdia').innerHTML = arcDiagram(r, t);
      el.querySelector('#arcres').innerHTML = stable('Arc', [['Radius', gf(r, d + 1), u], ['Diameter', gf(A(7), d + 1), u], ['Included angle', gf(t, 4), 'deg'], ['Chord length', gf(A(2), d + 1), u], ['Arc length', gf(A(3), d + 1), u], ['Sagitta (arc height)', gf(A(4), d + 1), u], ['Segment area (between chord and arc)', gf(A(5), d), u + '²'], ['Sector area', gf(A(6), d), u + '²']]) +
        (n > 1 ? '<p class="ms" style="padding:4px 10px">' + (+s.ka + +s.kb === 2 ? 'A radius and a chord fit a minor arc and the major arc on the other side of the chord.' : 'A sagitta and an arc length fit two arcs when the sagitta is between 1/π and about 0.36 of the arc length (the ratio peaks at an included angle of about 267°).') + ' Pick the one you mean above.</p>' : '');
    } else { solBox.innerHTML = ''; el.querySelector('#arcdia').innerHTML = ''; el.querySelector('#arcres').innerHTML = stable('Arc', [['Enter two values that fit together (a chord cannot be longer than the diameter or the arc; an angle is at most 360°)', '', '']]); }
    const p = s.p.flat().map(snum), C = k => W.circle_3pts(...p, k);
    el.querySelector('#c3res').innerHTML = p.every(isFinite) && isFinite(C(2))
      ? stable('Circle through the three points', [['Centre X', gf(C(0), d + 1), u], ['Centre Y', gf(C(1), d + 1), u], ['Radius', gf(C(2), d + 1), u], ['Diameter', gf(2 * C(2), d + 1), u]])
      : stable('Circle through the three points', [[p.every(isFinite) ? 'The points are in a straight line' : 'Enter all three points', '', '']]);
  };
  draw();
}

// ---------- Sine bar and gauge blocks ----------
// Block set compositions as printed by the makers (see docs/geometry.md).
const GB_RANGE = (a, b, step) => { const o = []; const n = Math.round((b - a) / step); for (let i = 0; i <= n; i++) o.push(+(a + i * step).toFixed(5)); return o; };
const GB_SETS = {
  m112: { name: 'Metric 112 pieces', sys: 'mm', unit: 0.0005, blocks: () => [1.0005, ...GB_RANGE(1.001, 1.009, 0.001), ...GB_RANGE(1.01, 1.49, 0.01), ...GB_RANGE(0.5, 24.5, 0.5), ...GB_RANGE(25, 100, 25)] },
  i81: { name: 'Inch 81 pieces', sys: 'inch', unit: 0.00005, blocks: () => [...GB_RANGE(0.1001, 0.1009, 0.0001), ...GB_RANGE(0.101, 0.149, 0.001), ...GB_RANGE(0.05, 0.95, 0.05), 1, 2, 3, 4] },
  m88: { name: 'Metric 88 pieces (one maker\'s listing)', sys: 'mm', unit: 0.0005, blocks: () => [1.0005, ...GB_RANGE(1.001, 1.009, 0.001), ...GB_RANGE(1.01, 1.49, 0.01), ...GB_RANGE(0.5, 9.5, 0.5), ...GB_RANGE(10, 100, 10)] },
  m103: { name: 'Metric 103 pieces (one maker\'s listing)', sys: 'mm', unit: 0.0005, blocks: () => [1.005, ...GB_RANGE(1.01, 1.49, 0.01), ...GB_RANGE(0.5, 24.5, 0.5), ...GB_RANGE(25, 100, 25)] },
  m47: { name: 'Metric 47 pieces (one maker\'s listing)', sys: 'mm', unit: 0.0005, blocks: () => [1.005, ...GB_RANGE(1.01, 1.19, 0.01), ...GB_RANGE(1.2, 1.9, 0.1), ...GB_RANGE(1, 9, 1), ...GB_RANGE(10, 100, 10)] },
  m32: { name: 'Metric 32 pieces (one maker\'s listing)', sys: 'mm', unit: 0.0005, blocks: () => [1.005, ...GB_RANGE(1.01, 1.09, 0.01), ...GB_RANGE(1.1, 1.9, 0.1), ...GB_RANGE(1, 9, 1), 10, 20, 30, 60] },
  custom: { name: 'My own set (list the sizes)', sys: '', unit: 0, blocks: () => [] },
};
const SB_STATE = { L: '', ang: '', h: '', set: '', custom: '', target: '' };
function sineDiagram(ang) {
  const a = Math.min(Math.max(ang || 20, 2), 60) * Math.PI / 180, L = 300, x0 = 50, y0 = 190, h = L * Math.sin(a);
  const x1 = x0 + L * Math.cos(a), y1 = y0 - h;
  let s = '<path class="gb" d="M20 ' + (y0 + 10) + 'H400"/>';
  s += '<circle class="gp" cx="' + x0 + '" cy="' + y0 + '" r="10"/><circle class="gp" cx="' + x1.toFixed(1) + '" cy="' + y1.toFixed(1) + '" r="10"/>';
  const nx = Math.sin(a) * 10, ny = Math.cos(a) * 10;
  s += '<path class="gp" d="M' + (x0 - nx).toFixed(1) + ' ' + (y0 - ny).toFixed(1) + 'L' + (x1 - nx).toFixed(1) + ' ' + (y1 - ny).toFixed(1) + 'l' + (-2 * nx).toFixed(1) + ' ' + (-2 * ny).toFixed(1) + 'L' + (x0 - 3 * nx).toFixed(1) + ' ' + (y0 - 3 * ny).toFixed(1) + 'Z"/>';
  s += '<rect class="gfill gp" x="' + (x1 - 14).toFixed(1) + '" y="' + (y1 + 10).toFixed(1) + '" width="28" height="' + (y0 - y1).toFixed(1) + '"/>';
  s += '<path class="gk" d="M' + x0 + ' ' + y0 + 'L' + x1.toFixed(1) + ' ' + y1.toFixed(1) + '"/>' + gtxt([(x0 + x1) / 2 + 8, (y0 + y1) / 2 + 18], 'L', 'gv');
  s += gtxt([x1 + 22, (y0 + y1) / 2 + 10], 'H', 'gv') + gtxt([x0 + 40, y0 - 2], 'angle', 'gs');
  return gsvg(420, 240, s, 'Sine bar on a gauge block stack');
}
function renderSineBar(el) {
  const s = SB_STATE, W = state.W, u = lenU(state.sys);
  if (!s.set) s.set = state.sys === 'inch' ? 'i81' : 'm112';
  const draw = () => {
    const setOpts = Object.entries(GB_SETS).map(([k, v]) => [k, v.name + (v.sys ? ' (' + v.sys + ')' : '')]);
    el.innerHTML = sineDiagram(snum(s.ang)) + '<div class="grid">' + sfield('Sine bar length (centre distance of the rolls)', sinp('L', s.L), u) + sfield('Angle to set', sinp('ang', s.ang), 'deg') + sfield('Or: stack height you have', sinp('h', s.h), u) + '</div>' +
      '<div class="res" id="sbres"></div><h2>Gauge-block stack</h2>' +
      '<div class="grid">' + sfield('Block set', gsel('set', setOpts, s.set), '') + sfield('Stack size (blank = the sine bar height above)', sinp('target', s.target), GB_SETS[s.set].sys === 'inch' ? 'in' : (GB_SETS[s.set].sys === 'mm' ? 'mm' : u)) + '</div>' +
      (s.set === 'custom' ? '<label class="f" style="max-width:760px"><span>Block sizes in your set, one entry per block (' + u + '; list a size twice if you have two)</span><textarea data-k="custom" rows="3" style="width:100%;font-family:var(--mono);border:1px solid var(--line);border-radius:var(--r);background:var(--panel);padding:6px">' + sesc(s.custom) + '</textarea></label>' : '') +
      '<div class="res" id="gbres" style="margin-top:10px"></div>';
    el.querySelector('[data-k="set"]').onchange = e => { s.set = e.target.value; draw(); };
    el.querySelectorAll('[data-k]').forEach(i => { if (i.dataset.k !== 'set') i.oninput = () => { s[i.dataset.k] = i.value; calc(); }; });
    calc();
  };
  const calc = () => {
    const L = snum(s.L), ang = snum(s.ang), h = snum(s.h), d = gdp() + 1, rows = [];
    let H = NaN;
    if (L > 0 && isFinite(ang)) { H = W.sine_bar_height(L, ang); rows.push(['Stack height for ' + gf(ang, 4) + '°', gf(H, d), u]); }
    if (L > 0 && h >= 0) rows.push(['Angle set by a ' + gf(h, d) + ' stack', gf(W.sine_bar_angle(L, h), 5), 'deg']);
    if (!(L > 0)) rows.push(['Enter the sine bar length (the centre distance marked on your bar)', '', '']);
    if (isFinite(ang) && ang > 60) rows.push(['Above about 60° small height errors give large angle errors; consider setting the complement', '', '', 'Check']);
    el.querySelector('#sbres').innerHTML = stable('Sine bar', rows);
    const set = GB_SETS[s.set], gb = el.querySelector('#gbres');
    let blocks = set.blocks(), unit = set.unit;
    // Units of the set: a metric set works in mm, an inch set in inches. The target is in the set's units.
    const setInch = set.sys ? set.sys === 'inch' : state.sys === 'inch';
    let target = snum(s.target);
    if (!isFinite(target) && isFinite(H)) target = state.sys === 'inch' ? (setInch ? H : H * IN_MM) : (setInch ? H / IN_MM : H);
    if (s.set === 'custom') { blocks = numsFrom(s.custom); unit = setInch ? 0.00005 : 0.0005; }
    const su = setInch ? 'in' : 'mm', sdpp = setInch ? 5 : 4;
    if (!blocks.length) { gb.innerHTML = stable('Stack', [['List the block sizes in your set', '', '']]); return; }
    if (!(target > 0)) { gb.innerHTML = stable('Stack', [['Enter a stack size or a sine bar angle', '', '']]); return; }
    const tq = Math.round(target / unit) * unit;
    const n = W.gauge_stack(toBuf(W, blocks), tq, unit);
    if (!(n > 0)) { gb.innerHTML = stable('Stack for ' + gf(tq, sdpp) + ' ' + su, [['No combination of this set makes that size (each block used once)', '', '', 'Not possible']]); return; }
    const used = listOut(W, n).sort((a, b) => a - b);
    gb.innerHTML = stable('Stack for ' + gf(tq, sdpp) + ' ' + su + ': ' + n + ' block' + (n === 1 ? '' : 's') + ' (fewest possible)', used.map((b, i) => ['Block ' + (i + 1), gf(b, sdpp), su]).concat([['Total', gf(used.reduce((a, b) => a + b, 0), sdpp), su]])) +
      '<p class="ms" style="padding:4px 10px">' + (Math.abs(tq - target) > 1e-12 ? 'Size rounded to the set\'s smallest step (' + unit + ' ' + su + '). ' : '') + (s.set === 'm112' || s.set === 'i81' ? 'Set composition as printed by two makers (see sources); check it against the lid of your own box. ' : s.set !== 'custom' ? 'Set composition from one maker\'s listing (Mitutoyo); check it against the lid of your own box. ' : '') + 'If you use wear blocks, add them to the stack size.</p>';
  };
  draw();
}

// ---------- Dividing head / rotary table ----------
const IDX_STATE = { mode: 'div', ratio: 40, n: '', d: '', m: '', s: '', circles: '', gears: '', maxoff: 10 };
function renderIndexing(el) {
  const s = IDX_STATE, W = state.W;
  const draw = () => {
    el.innerHTML = '<div class="mfilter"><span>Indexing:</span>' + gseg('idxmode', [['div', 'Divisions (simple)'], ['ang', 'Angle'], ['diff', 'Differential']], s.mode) + '</div>' +
      '<div class="grid">' + sfield('Worm ratio of the head or table (turns of the crank per turn of the spindle)', sinp('ratio', s.ratio), ': 1') +
      (s.mode === 'ang' ? sfield('Degrees', sinp('d', s.d), 'deg') + sfield('Minutes', sinp('m', s.m), "'") + sfield('Seconds', sinp('s', s.s), '"') : sfield('Number of divisions', sinp('n', s.n), '')) +
      (s.mode === 'diff' ? sfield('Search A\' up to this far from N', sinp('maxoff', s.maxoff), '') : '') + '</div>' +
      '<label class="f" style="max-width:760px"><span>Hole circles on your index plates (count of holes in each circle; copy them from your plates)</span><textarea data-k="circles" rows="2" style="width:100%;font-family:var(--mono);border:1px solid var(--line);border-radius:var(--r);background:var(--panel);padding:6px" placeholder="e.g. 15 16 17 18 19 20 ...">' + sesc(s.circles) + '</textarea></label>' +
      (s.mode === 'diff' ? '<label class="f" style="max-width:760px;margin-top:8px"><span>Change gears you have (teeth; list a size twice if you have two)</span><textarea data-k="gears" rows="2" style="width:100%;font-family:var(--mono);border:1px solid var(--line);border-radius:var(--r);background:var(--panel);padding:6px">' + sesc(s.gears) + '</textarea></label>' : '') +
      '<div class="res" id="idxres" style="margin-top:10px"></div>';
    el.querySelectorAll('#idxmode button').forEach(b => b.onclick = () => { s.mode = b.dataset.v; draw(); });
    gbind(el, s, calc); calc();
  };
  const calc = () => {
    const res = el.querySelector('#idxres'), ratio = Math.round(snum(s.ratio)), circles = numsFrom(s.circles).filter(x => x >= 2 && Number.isInteger(x));
    if (!(ratio >= 1)) { res.innerHTML = stable('Result', [['Enter the worm ratio of your head or table', '', '']]); return; }
    if (!circles.length) { res.innerHTML = stable('Result', [['Enter the hole circles of your index plates', '', '']]); return; }
    const turnsTxt = (w, h, c) => w + ' turn' + (w === 1 ? '' : 's') + (h ? ' + ' + h + ' holes on the ' + c + ' circle' : '');
    if (s.mode !== 'diff') {
      const n = Math.round(snum(s.n));
      if (s.mode === 'div' && !(n >= 2)) { res.innerHTML = stable('Result', [['Enter the number of divisions', '', '']]); return; }
      const k = s.mode === 'div' ? W.index_plates(toBuf(W, circles), ratio, 0, n, 0, 0) : W.index_plates(toBuf(W, circles), ratio, 1, Math.round(snum(s.d) || 0), Math.round(snum(s.m) || 0), Math.round(snum(s.s) || 0));
      const o = listOut(W, 3 * k), rows = [];
      for (let i = 0; i < k; i++) rows.push(['Option ' + (i + 1), turnsTxt(o[3 * i], o[3 * i + 1], o[3 * i + 2]), '']);
      res.innerHTML = stable(s.mode === 'div' ? 'Crank movement per division (' + ratio + ' / ' + n + ' turns)' : 'Crank movement for the angle', rows.length ? rows : [['None of your hole circles gives this exactly' + (s.mode === 'div' ? ': try differential indexing' : ''), '', '', 'No plate fits']]) +
        '<p class="ms" style="padding:4px 10px">Set the sector arms to span the holes counted from the next hole (the hole the pin is in is not counted).</p>';
      return;
    }
    const n = Math.round(snum(s.n)), gears = numsFrom(s.gears).filter(x => x >= 8 && Number.isInteger(x));
    if (!(n >= 2)) { res.innerHTML = stable('Result', [['Enter the number of divisions', '', '']]); return; }
    if (gears.length < 2) { res.innerHTML = stable('Result', [['Enter the change gears you have', '', '']]); return; }
    toBuf(W, circles.concat(gears));
    const ok = W.index_differential(circles.length, gears.length, ratio, n, Math.max(1, Math.round(snum(s.maxoff) || 10)));
    if (!ok) { res.innerHTML = stable('Differential indexing', [['No approximate division in range works with these plates and gears', '', '', 'Not found']]); return; }
    const o = listOut(W, 7), g = listOut(W, 7 + o[6]).slice(7);
    const gtxtv = g.length === 2 ? 'driver ' + g[0] + ' on the spindle, driven ' + g[1] + ' on the plate shaft' : 'driver ' + g[0] + ', driven ' + g[1] + ', then driver ' + g[2] + ', driven ' + g[3];
    res.innerHTML = stable('Differential indexing for ' + n + ' divisions', [
      ["Index as if for A' =", String(o[0]), 'divisions'], ['Crank per division', turnsTxt(o[1], o[2], o[3]), ''],
      ["Gear ratio = ratio x |A' - N| / A'", gf(o[4], 5), ''], ['Change gears', gtxtv, ''],
      ['Idlers', (o[5] ? (g.length === 2 ? '1 or 3' : 'none or 2') : (g.length === 2 ? 'none or 2' : '1 or 3')) + ' (A\' ' + (o[5] ? 'above' : 'below') + ' N, ' + (g.length === 2 ? 'simple' : 'compound') + ' train)', '']]) +
      '<p class="ms" style="padding:4px 10px">The index plate is geared to the spindle for differential indexing, so it must be free to turn. Check the set-up with a trial division before cutting; head designs differ.</p>';
  };
  draw();
}

// ---------- Stock weight ----------
const WT_STATE = { shape: 1, a: '', b: '', len: '', qty: 1, mat: '', rho: '' };
function confirmedDensity() {
  if (typeof MAT === 'undefined' || !MAT) return [];
  const out = [];
  MAT.materials.forEach(m => (m.properties || []).forEach(p => { if (p.prop === 'density' && p.status === 'confirmed' && p.values.length === 1 && p.values[0].max == null) out.push({ grade: m.grade, cond: p.cond, v: p.values[0].value }); }));
  return out;
}
async function renderWeight(el) {
  const s = WT_STATE, W = state.W, inch = state.sys === 'inch', u = lenU(state.sys);
  if (typeof MAT !== 'undefined' && !MAT) { try { MAT = await (await fetch('data/materials.json')).json(); } catch (e) {} }
  const dens = confirmedDensity(), du = inch ? 'lb/in³' : 'kg/m³', toKgM3 = x => inch ? x / 3.6127292e-5 : x, fromKgM3 = x => inch ? x * 3.6127292e-5 : x;
  const lab = { 1: ['Diameter', ''], 2: ['Across flats', ''], 3: ['Side', ''], 4: ['Outside diameter', 'Wall thickness'], 5: ['Width', 'Thickness'] };
  const draw = () => {
    const [l1, l2] = lab[s.shape];
    el.innerHTML = '<div class="grid">' + sfield('Shape', gsel('shape', [[1, 'Round bar'], [2, 'Hex bar'], [3, 'Square bar'], [4, 'Tube'], [5, 'Flat bar, plate or sheet']], s.shape), '') +
      sfield(l1, sinp('a', s.a), u) + (l2 ? sfield(l2, sinp('b', s.b), u) : '') + sfield('Length', sinp('len', s.len), u) + sfield('Quantity', sinp('qty', s.qty), 'pcs') +
      sfield('Density', sinp('rho', s.rho), du) + '</div>' +
      '<div class="mfilter"><span>Density from material data:</span><select data-mat="1" style="max-width:320px"><option value="">' + (dens.length ? 'Pick a confirmed value...' : 'No confirmed density yet') + '</option>' +
      dens.map((d, i) => '<option value="' + i + '"' + (String(s.mat) === String(i) ? ' selected' : '') + '>' + sesc(d.grade + ': ' + fmt(fromKgM3(d.v), inch ? 4 : 0) + ' ' + du) + '</option>').join('') + '</select></div>' +
      '<p class="desc">Only densities that two or more independent publishers print the same (status Confirmed in Material equivalents) are offered; otherwise enter the density from your material\'s data sheet.</p><div class="res" id="wtres"></div>';
    el.querySelector('[data-k="shape"]').onchange = e => { s.shape = +e.target.value; draw(); };
    el.querySelectorAll('[data-k]').forEach(i => { if (i.dataset.k !== 'shape') i.oninput = () => { s[i.dataset.k] = i.value; if (i.dataset.k === 'rho') s.mat = ''; calc(); }; });
    el.querySelector('[data-mat]').onchange = e => { s.mat = e.target.value; if (e.target.value !== '') { s.rho = +fromKgM3(dens[+e.target.value].v).toFixed(inch ? 5 : 1); el.querySelector('[data-k="rho"]').value = s.rho; } calc(); };
    calc();
  };
  const calc = () => {
    const k = inch ? IN_MM : 1, a = snum(s.a) * k, b = snum(s.b) * k, len = snum(s.len) * k, qty = snum(s.qty) || 1, rho = toKgM3(snum(s.rho));
    const area = W.stock_area(+s.shape, a, b), res = el.querySelector('#wtres');
    if (!(area > 0)) { res.innerHTML = stable('Weight', [[+s.shape === 4 && a > 0 && b > 0 ? 'Wall is too thick for that diameter' : 'Enter the section size', '', '']]); return; }
    const rows = [['Section area', gf(inch ? area / (IN_MM * IN_MM) : area, inch ? 4 : 1), u + '²']];
    if (len > 0 && rho > 0) {
      const kg = W.mass_metric_kg(area, len, rho), wu = inch ? 'lb' : 'kg', w = inch ? kg / 0.45359237 : kg;
      rows.push(['Weight per piece', gf(w, 3), wu], ['Weight for ' + qty + ' pcs', gf(w * qty, 2), wu], ['Weight per ' + (inch ? 'foot' : 'metre'), gf(inch ? W.mass_metric_kg(area, 304.8, rho) / 0.45359237 : W.mass_metric_kg(area, 1000, rho), 3), wu]);
    } else rows.push([!(rho > 0) ? 'Enter or pick a density' : 'Enter the length', '', '']);
    res.innerHTML = stable('Weight', rows);
  };
  draw();
}

// ---------- Fillets and tangent points ----------
const FIL_STATE = { mode: 'ln', px: 0, py: 0, d1: 0, d2: 90, r: 5, x1: -30, y1: 0, x2: 30, y2: 0, cx: 0, cy: 18, R: 10, out: 1, side: 1, sol: 0 };
function renderFillet(el) {
  const s = FIL_STATE, W = state.W, u = lenU(state.sys);
  const draw = () => {
    el.innerHTML = '<div class="mfilter"><span>Fillet between:</span>' + gseg('filmode', [['ln', 'Two lines (corner)'], ['lc', 'Line and arc']], s.mode) + '</div>' +
      (s.mode === 'ln'
        ? '<div class="grid">' + sfield('Corner X', sinp('px', s.px), u) + sfield('Corner Y', sinp('py', s.py), u) + sfield('Direction of leg 1 from the corner', sinp('d1', s.d1), 'deg') + sfield('Direction of leg 2 from the corner', sinp('d2', s.d2), 'deg') + sfield('Fillet radius', sinp('r', s.r), u) + '</div>'
        : '<div class="grid">' + sfield('Line point 1 X', sinp('x1', s.x1), u) + sfield('Line point 1 Y', sinp('y1', s.y1), u) + sfield('Line point 2 X', sinp('x2', s.x2), u) + sfield('Line point 2 Y', sinp('y2', s.y2), u) +
          sfield('Arc centre X', sinp('cx', s.cx), u) + sfield('Arc centre Y', sinp('cy', s.cy), u) + sfield('Arc radius', sinp('R', s.R), u) + sfield('Fillet radius', sinp('r', s.r), u) +
          sfield('Fillet touches the arc from', gsel('out', [[1, 'outside (convex blend)'], [0, 'inside']], s.out), '') + sfield('Fillet centre on which side of the line (point 1 to 2)', gsel('side', [[1, 'left'], [-1, 'right']], s.side), '') + '</div>') +
      '<div id="filsel"></div><div id="fildia"></div><div class="res" id="filres"></div>';
    el.querySelectorAll('#filmode button').forEach(b => b.onclick = () => { s.mode = b.dataset.v; s.sol = 0; draw(); });
    gbind(el, s, calc); calc();
  };
  const calc = () => {
    const d = gdp() + 1, res = el.querySelector('#filres'), dia = el.querySelector('#fildia'), sel = el.querySelector('#filsel');
    const v = k => snum(s[k]);
    if (s.mode === 'ln') {
      gpicker(sel, 'filsol', 0, s, 'sol', '', calc);
      const F = k => W.fillet_line_line(v('px'), v('py'), v('d1'), v('d2'), v('r'), k);
      if (!isFinite(F(6))) { dia.innerHTML = ''; res.innerHTML = stable('Fillet', [['Enter a corner, two leg directions that are not in line, and a radius', '', '']]); return; }
      const P = [v('px'), v('py')], T1 = [F(0), F(1)], T2 = [F(2), F(3)], C = [F(4), F(5)], r = v('r');
      const L1 = [P[0] + (T1[0] - P[0]) * 1.8, P[1] + (T1[1] - P[1]) * 1.8], L2 = [P[0] + (T2[0] - P[0]) * 1.8, P[1] + (T2[1] - P[1]) * 1.8];
      const m = gfit([P, L1, L2, [C[0] - r, C[1] - r], [C[0] + r, C[1] + r]], 420, 240, 24), q = m.P;
      let g = '<path class="gm" d="M' + gpt(q(L1)) + 'L' + gpt(q(P)) + 'L' + gpt(q(L2)) + '"/>';
      g += '<path class="gp" d="M' + gpt(q(L1)) + 'L' + gpt(q(T1)) + 'A' + (r * m.k).toFixed(1) + ' ' + (r * m.k).toFixed(1) + ' 0 0 ' + (crossSign(P, T1, T2) > 0 ? 0 : 1) + ' ' + gpt(q(T2)) + 'L' + gpt(q(L2)) + '"/>';
      g += [T1, T2].map(t => '<circle class="gdot" cx="' + q(t)[0].toFixed(1) + '" cy="' + q(t)[1].toFixed(1) + '" r="3"/>').join('') + '<circle class="gdot2" cx="' + q(C)[0].toFixed(1) + '" cy="' + q(C)[1].toFixed(1) + '" r="2.5"/>';
      g += gtxt([q(T1)[0] + 6, q(T1)[1] + 14], 'T1', 'gs') + gtxt([q(T2)[0] + 6, q(T2)[1] - 6], 'T2', 'gs') + gtxt([q(C)[0] + 6, q(C)[1] + 4], 'centre', 'gs');
      dia.innerHTML = gsvg(420, 240, g, 'Corner fillet');
      res.innerHTML = stable('Corner fillet', [['Tangent point on leg 1 (X, Y)', gf(T1[0], d) + ', ' + gf(T1[1], d), u], ['Tangent point on leg 2 (X, Y)', gf(T2[0], d) + ', ' + gf(T2[1], d), u], ['Fillet centre (X, Y)', gf(C[0], d) + ', ' + gf(C[1], d), u], ['Distance from corner to each tangent point', gf(F(6), d), u]]);
      return;
    }
    const args = [v('x1'), v('y1'), v('x2'), v('y2'), v('cx'), v('cy'), v('R'), v('r'), +s.out, +s.side];
    const n = W.fillet_line_circle(...args, 0, 9);
    if (!(n > 0)) { gpicker(sel, 'filsol', 0, s, 'sol', '', calc); dia.innerHTML = ''; res.innerHTML = stable('Fillet', [['No fillet of this radius fits on that side; check the side, inside/outside and radius', '', '']]); return; }
    if (s.sol >= n) s.sol = 0;
    gpicker(sel, 'filsol', n, s, 'sol', 'Two places fit:', calc);
    const G = k => W.fillet_line_circle(...args, s.sol, k);
    const F = [G(0), G(1)], T1 = [G(2), G(3)], T2 = [G(4), G(5)], C = [v('cx'), v('cy')], R = v('R'), r = v('r');
    const A = [v('x1'), v('y1')], B = [v('x2'), v('y2')];
    const m = gfit([A, B, [C[0] - R, C[1] - R], [C[0] + R, C[1] + R], [F[0] - r, F[1] - r], [F[0] + r, F[1] + r]], 420, 240, 20), q = m.P;
    let g = '<path class="gm" d="M' + gpt(q(A)) + 'L' + gpt(q(B)) + '"/><circle class="gm" cx="' + q(C)[0].toFixed(1) + '" cy="' + q(C)[1].toFixed(1) + '" r="' + (R * m.k).toFixed(1) + '"/>';
    g += '<circle class="gp" cx="' + q(F)[0].toFixed(1) + '" cy="' + q(F)[1].toFixed(1) + '" r="' + (r * m.k).toFixed(1) + '"/>';
    g += [T1, T2].map(t => '<circle class="gdot" cx="' + q(t)[0].toFixed(1) + '" cy="' + q(t)[1].toFixed(1) + '" r="3"/>').join('') + '<circle class="gdot2" cx="' + q(F)[0].toFixed(1) + '" cy="' + q(F)[1].toFixed(1) + '" r="2.5"/>';
    g += gtxt([q(T1)[0] + 6, q(T1)[1] + 14], 'T1', 'gs') + gtxt([q(T2)[0] + 6, q(T2)[1] - 6], 'T2', 'gs');
    dia.innerHTML = gsvg(420, 240, g, 'Line to arc fillet');
    res.innerHTML = stable('Fillet' + (n === 2 ? ' (solution ' + (s.sol + 1) + ' of 2)' : ''), [['Tangent point on the line T1 (X, Y)', gf(T1[0], d) + ', ' + gf(T1[1], d), u], ['Tangent point on the arc T2 (X, Y)', gf(T2[0], d) + ', ' + gf(T2[1], d), u], ['Fillet centre (X, Y)', gf(F[0], d) + ', ' + gf(F[1], d), u]]) +
      '<p class="ms" style="padding:4px 10px">The drawing shows the whole fillet circle; the part of it you program runs between T1 and T2. Check the direction (G2/G3) against your tool path.</p>';
  };
  draw();
}
function crossSign(P, A, B) { return (A[0] - P[0]) * (B[1] - P[1]) - (A[1] - P[1]) * (B[0] - P[0]); }

// ---------- Dovetail and V-groove over pins ----------
const DV_STATE = { mode: 'male', wmode: 'corner', w: '', h: '', alpha: 60, d: '', beta: 90, vw: '' };
function dovetailDiagram(male) {
  let s;
  if (male) {
    s = '<path class="gb" d="M20 200H400"/><path class="gp gfill" d="M130 200L105 90H315L290 200Z"/>';
    s += '<circle class="gp" cx="106" cy="186" r="14"/><circle class="gp" cx="314" cy="186" r="14"/>';
    s += '<path class="gk" d="M92 225H328"/>' + gtxt([210, 238], 'measurement over pins M', 'gs', 'middle') + gtxt([210, 150], 'male', 'gs', 'middle') + gtxt([140, 196], 'W at the corners', 'gs');
  } else {
    s = '<path class="gp gfill" d="M20 70H120L95 200H325L300 70H400V220H20Z"/>';
    s += '<circle class="gp" cx="119" cy="186" r="14"/><circle class="gp" cx="301" cy="186" r="14"/>';
    s += '<path class="gk" d="M133 160H287"/>' + gtxt([210, 152], 'between pins M', 'gs', 'middle') + gtxt([210, 214], 'W at the bottom corners', 'gs', 'middle') + gtxt([210, 100], 'female', 'gs', 'middle');
  }
  return gsvg(420, 245, s, male ? 'Male dovetail over pins' : 'Female dovetail between pins');
}
function vgrooveDiagram() {
  const s = '<path class="gp gfill" d="M20 80H120L210 200L300 80H400V220H20Z"/><circle class="gp" cx="210" cy="104" r="48"/><path class="gk" d="M300 56H360M300 80H360"/>' + gtxt([366, 72], 'pin height', 'gs');
  return gsvg(420, 230, s, 'V-groove with pin');
}
function renderDovetail(el) {
  const s = DV_STATE, W = state.W, u = lenU(state.sys);
  const draw = () => {
    const v = s.mode === 'vg';
    el.innerHTML = '<div class="mfilter"><span>Feature:</span>' + gseg('dvmode', [['male', 'Male dovetail'], ['female', 'Female dovetail'], ['vg', 'V-groove']], s.mode) + '</div>' +
      (v ? vgrooveDiagram() + '<div class="grid">' + sfield('Width of the V at the top face (sharp edges)', sinp('vw', s.vw), u) + sfield('Included angle of the V', sinp('beta', s.beta), 'deg') + sfield('Pin (roll) diameter', sinp('d', s.d), u) + '</div>'
        : dovetailDiagram(s.mode === 'male') + '<div class="grid">' + sfield('Width given', gsel('wmode', [['corner', s.mode === 'male' ? 'at the root corners (narrow side)' : 'at the bottom corners (wide side)'], ['top', 'at the top face, plus depth']], s.wmode), '') +
          sfield('Width', sinp('w', s.w), u) + (s.wmode === 'top' ? sfield('Depth of the dovetail', sinp('h', s.h), u) : '') + sfield('Dovetail angle (between base and flank)', sinp('alpha', s.alpha), 'deg') + sfield('Pin diameter', sinp('d', s.d), u) + '</div>') +
      '<div class="res" id="dvres"></div>';
    el.querySelectorAll('#dvmode button').forEach(b => b.onclick = () => { s.mode = b.dataset.v; draw(); });
    el.querySelectorAll('[data-k]').forEach(i => i.oninput = i.onchange = () => { s[i.dataset.k] = i.value; if (i.dataset.k === 'wmode') draw(); else calc(); });
    calc();
  };
  const calc = () => {
    const d = gdp() + 1, res = el.querySelector('#dvres'), n = k => snum(s[k]);
    if (s.mode === 'vg') {
      const h = W.vgroove_pin_height(n('vw'), n('beta'), n('d')), mg = W.vgroove_contact_margin(n('vw'), n('beta'), n('d'));
      res.innerHTML = isFinite(h) ? stable('V-groove', [['Top of the pin above the top face (negative = below)', gf(h, d), u, mg <= 0 ? 'The pin is too big: it rests on the top edges, not the flanks' : ''], ['Depth of the sharp V below the top face', gf(n('vw') / 2 / Math.tan(n('beta') * Math.PI / 360), d), u]]) : stable('V-groove', [['Enter the width, angle and pin diameter', '', '']]);
      return;
    }
    const male = s.mode === 'male', alpha = n('alpha'), dd = n('d');
    let w = n('w'); const rows = [];
    if (s.wmode === 'top') { w = W.dovetail_corner_width(n('w'), n('h'), alpha, male ? 1 : 0); if (isFinite(w)) rows.push(['Width at the ' + (male ? 'root' : 'bottom') + ' corners', gf(w, d), u]); }
    const M = male ? W.dovetail_male_over_pins(w, alpha, dd) : W.dovetail_female_between_pins(w, alpha, dd);
    if (!isFinite(M)) { res.innerHTML = stable('Dovetail', [['Enter the width, angle (under 90°) and pin diameter', '', '']]); return; }
    const contact = W.dovetail_contact_along_flank(alpha, dd), flank = n('h') > 0 ? n('h') / Math.sin(alpha * Math.PI / 180) : NaN;
    rows.push([male ? 'Measurement over the pins' : 'Measurement between the pins', gf(M, d), u, !male && M <= 0 ? 'Pins too big for this slot' : '']);
    rows.push(['Pin contact point from the corner, along the flank', gf(contact, d), u, isFinite(flank) && contact >= flank ? 'Above the top of the flank: use a smaller pin' : '']);
    res.innerHTML = stable('Dovetail', rows) + '<p class="ms" style="padding:4px 10px">W is the width between the sharp corners where each flank meets the base. Use pins small enough to touch the flank below its top edge.</p>';
  };
  draw();
}
