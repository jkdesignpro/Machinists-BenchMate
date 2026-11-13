'use strict';
// Measurement round 2 and shop maths screens: ball in a countersink or
// tapered bore, taper over rolls, shrink and press fits, unit converter,
// expression calculator, plane figures and solids, compound angles, lathe
// change gears, shop economics, ISO 2768-1 general tolerances, micrometer and
// vernier reading aid, drawing abbreviations. Arithmetic is in the Rust core
// (state.W); this file reads inputs, converts units and draws. Uses helpers
// from shop.js (sesc, snum, sinp, sfield, stable) and geometry.js (gseg,
// gsel, gbind, gsvg, gtxt, gpt, gf, gdp, toBuf, listOut).

const mStr = (W, n) => new TextDecoder().decode(new Uint8Array(W.memory.buffer, W.str_ptr(), n));
const mNote = t => '<p class="ms" style="padding:4px 10px">' + t + '</p>';
const mRes = (h, rows) => '<div class="res">' + stable(h, rows) + '</div>';
const mMsg = (h, t) => mRes(h, [[t, '', '']]);
// Text input (not a number), for lists and expressions.
const mtxt = (k, v, w, ph) => '<input type="text" data-k="' + k + '" value="' + sesc(v) + '" style="width:' + (w || 240) + 'px;font-family:var(--mono)"' + (ph ? ' placeholder="' + sesc(ph) + '"' : '') + ' autocomplete="off" spellcheck="false">';
const mangle = x => gf(x, 4);
function mdms(W, x) {
  if (!isFinite(x)) return '';
  const a = Math.abs(x), d = W.deg_to_dms(a, 0), m = W.deg_to_dms(a, 1), s = W.deg_to_dms(a, 2);
  return (x < 0 ? '−' : '') + d + '° ' + m + '′ ' + fmt(s, 1) + '″';
}

// ---------- Ball in a countersink or tapered bore ----------
const BALL_STATE = { mode: 'h', bd: 0.375, D: 0.5, inc: 90, h: '', d1: '', h1: '', d2: '', h2: '' };
const BALL_DEF = { inch: { bd: 0.375, D: 0.5 }, mm: { bd: 10, D: 12 } };
function ballDiagram(bd, D, inc, h) {
  const a = inc / 2 * Math.PI / 180, r = bd / 2;
  const apex = D / 2 / Math.tan(a); // apex depth below the face
  const depth = Math.max(apex, r * 2);
  const zc = h - r; // ball centre above the face
  const pts = [[-D / 2 - r, 0], [D / 2 + r, 0], [0, -apex], [0, zc + r], [0, zc - r], [-r, zc], [r, zc]];
  const m = gfit(pts.concat([[0, -Math.min(depth, apex)]]), 420, 230, 30);
  const P = m.P, R = r * m.k;
  const top = Math.max(h, 0) + r * 0.6;
  let s = '<path class="gsoft" d="M' + gpt(P([-D / 2 - r * 1.4, 0])) + 'L' + gpt(P([-D / 2, 0])) + 'L' + gpt(P([0, -apex])) + 'L' + gpt(P([D / 2, 0])) + 'L' + gpt(P([D / 2 + r * 1.4, 0])) + 'L' + gpt(P([D / 2 + r * 1.4, -apex - r * 0.4])) + 'L' + gpt(P([-D / 2 - r * 1.4, -apex - r * 0.4])) + 'Z"/>';
  s += '<path class="gp" d="M' + gpt(P([-D / 2 - r * 1.4, 0])) + 'L' + gpt(P([-D / 2, 0])) + 'L' + gpt(P([0, -apex])) + 'L' + gpt(P([D / 2, 0])) + 'L' + gpt(P([D / 2 + r * 1.4, 0])) + '"/>';
  const c = P([0, zc]);
  s += '<circle class="gc" cx="' + c[0].toFixed(1) + '" cy="' + c[1].toFixed(1) + '" r="' + R.toFixed(1) + '"/><circle class="gdot" cx="' + c[0].toFixed(1) + '" cy="' + c[1].toFixed(1) + '" r="2"/>';
  s += '<path class="gm" d="M' + gpt(P([0, -apex])) + 'L' + gpt(P([0, top])) + '"/>';
  const xr = D / 2 + r * 1.1, tb = P([xr, zc + r]), f0 = P([xr, 0]);
  s += '<path class="gk" d="M' + gpt(P([r * 0.2, zc + r])) + 'L' + gpt(tb) + '"/><path class="gc" d="M' + gpt(f0) + 'L' + gpt(tb) + '"/>';
  s += gtxt([tb[0] + 5, (tb[1] + f0[1]) / 2 + 4], 'h', 'gv') + gtxt(P([-D / 2 - r * 1.35, 0]).map((v, i) => v + (i ? -6 : 0)), 'face', 'gs', 'start');
  return gsvg(420, 230, s, 'Ball in a countersink');
}
function renderBallCone(el) {
  const s = BALL_STATE, W = state.W, u = lenU(state.sys);
  if (s.sys !== state.sys) { Object.assign(s, BALL_DEF[state.sys]); s.h = ''; s.sys = state.sys; }
  const draw = () => {
    el.innerHTML = '<div class="mfilter"><span>Find:</span>' + gseg('bmode', [['h', 'Ball height'], ['D', 'Face diameter'], ['two', 'Two balls']], s.mode) + '</div>' +
      '<p class="desc">For a countersink or a tapered bore with its large end at the face. The height is from the face to the top of the ball: positive when the ball stands proud, negative when it sits below the face (read it with a depth micrometer or a height gauge from the face).</p>' +
      (s.mode === 'two'
        ? '<div class="grid">' + sfield('Smaller ball diameter', sinp('d1', s.d1), u) + sfield('Its height over the face', sinp('h1', s.h1), u) + sfield('Larger ball diameter', sinp('d2', s.d2), u) + sfield('Its height over the face', sinp('h2', s.h2), u) + '</div>'
        : '<div class="grid">' + sfield('Ball diameter', sinp('bd', s.bd), u) + sfield('Included angle', sinp('inc', s.inc), 'deg') +
          (s.mode === 'h' ? sfield('Diameter at the face', sinp('D', s.D), u) : sfield('Measured height over the face', sinp('h', s.h), u)) + '</div>') +
      '<div id="bdia"></div><div id="bres"></div>';
    el.querySelectorAll('#bmode button').forEach(b => b.onclick = () => { s.mode = b.dataset.v; draw(); });
    gbind(el, s, calc); calc();
  };
  const calc = () => {
    const out = el.querySelector('#bres'), dia = el.querySelector('#bdia'), d = gdp();
    if (s.mode === 'two') {
      const v = ['d1', 'h1', 'd2', 'h2'].map(k => snum(s[k]));
      if (!v.every(isFinite)) { dia.innerHTML = ''; out.innerHTML = mMsg('Results', 'Enter both balls and their heights'); return; }
      const inc = W.cone_two_balls(...v, 0), D = W.cone_two_balls(...v, 1);
      if (!isFinite(inc)) { dia.innerHTML = ''; out.innerHTML = mMsg('Results', 'These readings do not fit a cone that opens towards the face: the larger ball must sit higher, by more than the difference of the radii'); return; }
      dia.innerHTML = ballDiagram(v[2], D, inc, v[3]);
      out.innerHTML = mRes('Tapered bore from two balls', [['Included angle', mangle(inc), 'deg'], ['', mdms(W, inc), ''], ['Half angle', mangle(inc / 2), 'deg'],
        ['Diameter at the face', gf(D, d + 1), u], ['Taper on diameter per unit length', gf(2 * Math.tan(inc / 2 * Math.PI / 180), 5), u + '/' + u],
        [state.sys === 'inch' ? 'Taper per foot (on diameter)' : 'Taper 1 : x', state.sys === 'inch' ? gf(24 * Math.tan(inc / 2 * Math.PI / 180), 4) : gf(1 / (2 * Math.tan(inc / 2 * Math.PI / 180)), 2), state.sys === 'inch' ? 'in/ft' : '']]) +
        mNote('Both balls must touch the wall all round and sit square. Ball sizes and heights should be known to the same accuracy you need: an error in a ball diameter goes almost straight into the angle.');
      return;
    }
    const bd = snum(s.bd), inc = snum(s.inc);
    if (!(bd > 0 && inc > 0 && inc < 180)) { dia.innerHTML = ''; out.innerHTML = mMsg('Results', 'Enter a ball diameter and an included angle between 0 and 180°'); return; }
    if (s.mode === 'h') {
      const D = snum(s.D), h = W.ball_height_in_cone(bd, D, inc);
      if (!(D >= 0) || !isFinite(h)) { dia.innerHTML = ''; out.innerHTML = mMsg('Results', 'Enter the diameter at the face'); return; }
      dia.innerHTML = ballDiagram(bd, D, inc, h);
      const ca = Math.PI * inc / 360, contact = bd * Math.cos(ca);
      out.innerHTML = mRes('Ball in the countersink', [['Height of the ball top over the face', gf(h, d + 1), u, h < 0 ? 'The ball sits below the face: measure the depth to its top.' : ''],
        ['Ball centre over the face', gf(h - bd / 2, d + 1), u], ['Diameter where the ball touches the wall', gf(contact, d + 1), u],
        ['Change in height per ' + (state.sys === 'inch' ? '0.001 in' : '0.01 mm') + ' of face diameter', gf((state.sys === 'inch' ? 0.001 : 0.01) / (2 * Math.tan(ca)), d + 1), u]]) +
        (contact > D ? mNote('The ball touches the wall outside the countersink (its contact circle is bigger than the face diameter): use a smaller ball.') : '');
    } else {
      const h = snum(s.h), D = W.cone_face_dia_from_ball(bd, h, inc);
      if (!isFinite(h) || !isFinite(D)) { dia.innerHTML = ''; out.innerHTML = mMsg('Results', 'Enter the measured height'); return; }
      dia.innerHTML = D > 0 ? ballDiagram(bd, D, inc, h) : '';
      out.innerHTML = mRes('Countersink from the ball reading', [['Diameter at the face', gf(D, d + 1), u, D <= 0 ? 'No countersink fits this reading.' : ''],
        ['Diameter where the ball touches the wall', gf(bd * Math.cos(Math.PI * inc / 360), d + 1), u]]);
    }
  };
  draw();
}

// ---------- External taper over rolls ----------
const ROLL_STATE = { mode: 'M', d: 0.25, d0: 1, inc: 7.152, H: 0, m1: '', h1: 0, m2: '', h2: 1 };
const ROLL_DEF = { inch: { d: 0.25, d0: 1, H: 0, h1: 0, h2: 1 }, mm: { d: 6, d0: 25, H: 0, h1: 0, h2: 25 } };
function rollDiagram(d0, inc, d, h1, h2) {
  const t = Math.tan(inc / 2 * Math.PI / 180), r = d / 2;
  const L = Math.max(h2 + 3 * r, d0 * 0.8), dL = d0 + 2 * L * t;
  const xo = y => d0 / 2 + y * t + r * Math.sqrt(1 + t * t); // roll centre x at the height of its centre
  const xm = Math.max(xo(h2 + r), xo(h1 + r)) + r;
  const m = gfit([[-xm, 0], [xm * 1.18, 0], [0, L]], 420, 230, 22), P = m.P;
  let s = '<path class="gm" d="M' + gpt(P([-xm, 0])) + 'L' + gpt(P([xm, 0])) + '"/>';
  const prof = 'M' + gpt(P([-d0 / 2, 0])) + 'L' + gpt(P([d0 / 2, 0])) + 'L' + gpt(P([dL / 2, L])) + 'L' + gpt(P([-dL / 2, L])) + 'Z';
  s += '<path class="gfill" d="' + prof + '"/><path class="gp" d="' + prof + '"/>';
  const rolls = [[h1, 'gk'], [h2, 'gc']];
  rolls.forEach(([h]) => { const xc = xo(h + r); if (h > 0) [-1, 1].forEach(sg => { s += '<path class="gsoft" d="M' + gpt(P([sg * xc - r, 0])) + 'L' + gpt(P([sg * xc + r, 0])) + 'L' + gpt(P([sg * xc + r, h])) + 'L' + gpt(P([sg * xc - r, h])) + 'Z"/>'; }); });
  rolls.forEach(([h, cls], i) => {
    const yc = h + r, xc = xo(yc);
    [-1, 1].forEach(sg => { const c = P([sg * xc, yc]); s += '<circle class="' + cls + '" cx="' + c[0].toFixed(1) + '" cy="' + c[1].toFixed(1) + '" r="' + (r * m.k).toFixed(1) + '"/>'; });
    const y = P([0, yc])[1];
    s += '<path class="grap" d="M' + gpt([P([-xc - r, 0])[0], y]) + 'L' + gpt([P([xc + r, 0])[0], y]) + '"/>' + gtxt([P([xc + r, 0])[0] + 4, y + 4], 'M' + (i + 1), 'gs');
  });
  return gsvg(420, 230, s, 'Taper measured over rolls');
}
function renderTaperRolls(el) {
  const s = ROLL_STATE, W = state.W, u = lenU(state.sys);
  if (s.sys !== state.sys) { Object.assign(s, ROLL_DEF[state.sys]); s.m1 = ''; s.m2 = ''; s.sys = state.sys; }
  const draw = () => {
    el.innerHTML = '<div class="mfilter"><span>Find:</span>' + gseg('rmode', [['M', 'Measurement'], ['inv', 'Taper from two readings']], s.mode) + '</div>' +
      '<p class="desc">External taper standing small end down on a surface plate, with two equal rolls (or pins) on equal gauge blocks either side, measured over the rolls with a micrometer.</p>' +
      (s.mode === 'M'
        ? '<div class="grid">' + sfield('Diameter at the plate (small end)', sinp('d0', s.d0), u) + sfield('Included angle', sinp('inc', s.inc), 'deg') + sfield('Roll diameter', sinp('d', s.d), u) + sfield('Gauge block height (0 = on the plate)', sinp('H', s.H), u) + '</div>'
        : '<div class="grid">' + sfield('Roll diameter', sinp('d', s.d), u) + sfield('Lower blocks height H1', sinp('h1', s.h1), u) + sfield('Measurement M1 over rolls', sinp('m1', s.m1), u) + sfield('Upper blocks height H2', sinp('h2', s.h2), u) + sfield('Measurement M2 over rolls', sinp('m2', s.m2), u) + '</div>') +
      '<div id="rdia"></div><div id="rres"></div>';
    el.querySelectorAll('#rmode button').forEach(b => b.onclick = () => { s.mode = b.dataset.v; draw(); });
    gbind(el, s, calc); calc();
  };
  const calc = () => {
    const out = el.querySelector('#rres'), dia = el.querySelector('#rdia'), d = snum(s.d), dp = gdp();
    if (s.mode === 'M') {
      const d0 = snum(s.d0), inc = snum(s.inc), H = snum(s.H) || 0, M = W.taper_over_rolls(d0, inc, d, H);
      if (!(d0 > 0) || !isFinite(M)) { dia.innerHTML = ''; out.innerHTML = mMsg('Results', 'Enter the small-end diameter, included angle and roll diameter'); return; }
      const t = Math.tan(inc / 2 * Math.PI / 180);
      dia.innerHTML = rollDiagram(d0, inc, d, H, H + 2 * d);
      out.innerHTML = mRes('Over the rolls', [['Measurement over rolls M', gf(M, dp + 1), u], ['Taper diameter at the block top', gf(d0 + 2 * H * t, dp + 1), u],
        ['Change of M per unit block height', gf(2 * t, 5), u + '/' + u], [state.sys === 'inch' ? 'Taper per foot (on diameter)' : 'Taper 1 : x', state.sys === 'inch' ? gf(24 * t, 4) : gf(1 / (2 * t), 2), state.sys === 'inch' ? 'in/ft' : '']]);
      return;
    }
    const v = [d, snum(s.m1), snum(s.h1), snum(s.m2), snum(s.h2)];
    if (!v.every(isFinite)) { dia.innerHTML = ''; out.innerHTML = mMsg('Results', 'Enter the roll diameter and both readings with their block heights'); return; }
    const inc = W.taper_from_rolls(...v, 0), d0 = W.taper_from_rolls(...v, 1);
    if (!isFinite(inc)) { dia.innerHTML = ''; out.innerHTML = mMsg('Results', 'The upper reading must be the larger one, at a different block height'); return; }
    const t = Math.tan(inc / 2 * Math.PI / 180);
    dia.innerHTML = d0 > 0 ? rollDiagram(d0, inc, d, v[2], v[4]) : '';
    out.innerHTML = mRes('Taper from the two readings', [['Included angle', mangle(inc), 'deg'], ['', mdms(W, inc), ''], ['Diameter at the plate (small end)', gf(d0, dp + 1), u],
      ['Diameter at H1', gf(d0 + 2 * v[2] * t, dp + 1), u], [state.sys === 'inch' ? 'Taper per foot (on diameter)' : 'Taper 1 : x', state.sys === 'inch' ? gf(24 * t, 4) : gf(1 / (2 * t), 2), state.sys === 'inch' ? 'in/ft' : '']]);
  };
  draw();
}

// ---------- Shrink and press fits ----------
const FIT_STATE = { gL: '', ga: '', gdt: '', d: '', i: '', c: '', ah: '', as: '', t0: '', ts: '', dout: '', din: 0, eh: '', nh: '', es: '', ns: '', len: '', mu: '' };
const FIT_DEF = { inch: { d: 2, i: 0.002, c: 0.002, t0: 68, ts: '' }, mm: { d: 50, i: 0.05, c: 0.05, t0: 20, ts: '' } };
let FIT_CTE = null;
async function fitCte() {
  if (FIT_CTE) return FIT_CTE;
  try { const m = await (await fetch('data/materials.json')).json(); FIT_CTE = [];
    m.materials.forEach(x => (x.properties || []).filter(p => p.prop === 'cte' && p.status === 'confirmed' && p.values.length).forEach(p => FIT_CTE.push({ name: x.grade + ' (' + p.cond + ')', v: p.values[0].value, pubs: p.values[0].publishers })));
  } catch (e) { FIT_CTE = []; }
  return FIT_CTE;
}
async function renderShrinkFit(el) {
  const s = FIT_STATE, W = state.W, u = lenU(state.sys), inch = state.sys === 'inch';
  if (s.sys !== state.sys) { Object.assign(s, FIT_DEF[state.sys]); ['ah', 'as', 'eh', 'es', 'dout', 'len', 'gL', 'ga', 'gdt'].forEach(k => s[k] = ''); s.sys = state.sys; }
  const cte = await fitCte();
  const au = inch ? 'µin/in·°F' : 'µm/m·K', tu = inch ? '°F' : '°C', eu = inch ? 'Msi' : 'GPa';
  const opts = [['', cte.length ? 'Choose a confirmed value...' : 'No confirmed values yet']].concat(cte.map((c, i) => [i, sesc(c.name) + ': ' + fmt(inch ? c.v / 1.8 : c.v, 2)]));
  el.innerHTML = '<p class="desc">Expansion coefficients are yours to enter (mean value over the temperature range you use), or pick a value that two publishers agree on from the materials data. BenchMate does not guess them.</p>' +
    '<h2>Growth for a temperature change</h2><div class="grid">' + sfield('Length or diameter', sinp('gL', s.gL), u) + sfield('Expansion coefficient', sinp('ga', s.ga), au) + sfield('Pick a value', gsel('pg', opts, ''), '') + sfield('Temperature change (+ warmer)', sinp('gdt', s.gdt), inch ? '°F' : 'K') + '</div><div id="gres"></div>' +
    '<h2>Shrink fit: assembly temperature</h2><div class="grid">' + sfield('Nominal fit diameter', sinp('d', s.d), u) + sfield('Interference (shaft minus bore)', sinp('i', s.i), u) +
    sfield('Assembly clearance wanted', sinp('c', s.c), u) + sfield('Hub (bore) expansion coefficient', sinp('ah', s.ah), au) + sfield('Pick for the hub', gsel('ph', opts, ''), '') +
    sfield('Shaft expansion coefficient', sinp('as', s.as), au) + sfield('Pick for the shaft', gsel('ps', opts, ''), '') +
    sfield('Room temperature', sinp('t0', s.t0), tu) + sfield('Shaft cooled to (blank = not cooled)', sinp('ts', s.ts), tu) + '</div><div id="sres"></div>' +
    '<h2>Press fit: pressure, stress and holding torque</h2><p class="desc">Lamé thick-cylinder equations for a hub on a shaft of the same length. Elastic only: check the hub stress against the material\'s yield strength yourself.</p><div class="grid">' +
    sfield('Hub outside diameter', sinp('dout', s.dout), u) + sfield('Shaft bore (0 = solid)', sinp('din', s.din), u) + sfield('Hub Young\'s modulus E', sinp('eh', s.eh), eu) + sfield('Hub Poisson\'s ratio', sinp('nh', s.nh), '') +
    sfield('Shaft Young\'s modulus E', sinp('es', s.es), eu) + sfield('Shaft Poisson\'s ratio', sinp('ns', s.ns), '') + sfield('Engaged length', sinp('len', s.len), u) + sfield('Friction coefficient (yours)', sinp('mu', s.mu), '') + '</div><div id="pres"></div>';
  gbind(el, s, calc);
  const pk = (k, t) => el.querySelector('[data-k="' + k + '"]').onchange = e => { const c = cte[+e.target.value]; if (e.target.value === '' || !c) return; s[t] = +(inch ? c.v / 1.8 : c.v).toFixed(3); el.querySelector('[data-k="' + t + '"]').value = s[t]; calc(); };
  pk('ph', 'ah'); pk('ps', 'as'); pk('pg', 'ga');
  function calc() {
    const d = snum(s.d), i = snum(s.i), c = snum(s.c) || 0, ah = snum(s.ah) * 1e-6, as = snum(s.as) * 1e-6, t0 = snum(s.t0), ts = snum(s.ts), dp = gdp();
    const gL = snum(s.gL), ga = snum(s.ga) * 1e-6, gdt = snum(s.gdt), gr = el.querySelector('#gres');
    if (gL > 0 && ga > 0 && isFinite(gdt)) { const g = W.thermal_growth(gL, ga, gdt); gr.innerHTML = mRes('Growth', [['Change in size', gf(g, dp + 2), u], ['New size', gf(gL + g, dp + 2), u]]); }
    else gr.innerHTML = mMsg('Growth', 'Enter a size, a coefficient and a temperature change');
    const out = el.querySelector('#sres');
    if (!(d > 0 && isFinite(i))) out.innerHTML = mMsg('Shrink fit', 'Enter the diameter and the interference');
    else if (!(ah > 0)) out.innerHTML = mMsg('Shrink fit', 'Enter the hub expansion coefficient');
    else {
      const rows = [['Hub growth needed', gf(i + c, dp + 1), u]];
      const dt = W.shrink_fit_dt(d, i, c, ah);
      rows.push(['Hub temperature rise (shaft at room temperature)', fmt(dt, 1), inch ? '°F' : 'K']);
      if (isFinite(t0)) rows.push(['Heat the hub to', fmt(t0 + dt, 1), tu]);
      if (as > 0) {
        const dts = W.shrink_fit_dt(d, i, c, as);
        rows.push(['Or cool the shaft by (hub at room temperature)', fmt(dts, 1), inch ? '°F' : 'K']);
        if (isFinite(t0)) rows.push(['Cool the shaft to', fmt(t0 - dts, 1), tu]);
        if (isFinite(t0) && isFinite(ts)) { const th = W.shrink_fit_hub_temp(d, i, c, ah, as, t0, ts); rows.push(['With the shaft at ' + fmt(ts, 0) + ' ' + tu + ', heat the hub to', fmt(Math.max(th, t0), 1), tu, th <= t0 ? 'Cooling the shaft alone gives the clearance.' : '']); }
      }
      out.innerHTML = mRes('Shrink fit', rows) + mNote('A coefficient is a mean over a temperature range; over a large rise (and for cooling below about −50 °C) use the mean value for that range from the material maker. Do not exceed the tempering or ageing temperature of the hub, and keep the time at temperature short.');
    }
    const p_ = el.querySelector('#pres'), dout = snum(s.dout), din = snum(s.din) || 0, k = inch ? 1e6 : 1000, eh = snum(s.eh) * k, es = snum(s.es) * k, nh = snum(s.nh), ns = snum(s.ns);
    if (!(d > 0 && i > 0 && dout > d && eh > 0 && es > 0 && isFinite(nh) && isFinite(ns))) { p_.innerHTML = mMsg('Press fit', 'Enter the fit diameter and interference above, the hub outside diameter, and E and Poisson\'s ratio of both parts'); return; }
    const p = W.press_fit_pressure(d, i, dout, din, eh, nh, es, ns), pu = inch ? 'psi' : 'MPa';
    const rows = [['Contact pressure', fmt(p, inch ? 0 : 1), pu], ['Hub hoop stress at the bore', fmt(W.press_fit_hub_stress(p, d, dout), inch ? 0 : 1), pu],
      ['Interference per ' + pu + ' of pressure', gf(W.press_fit_compliance(d, dout, din, eh, nh, es, ns), dp + 3), u]];
    const L = snum(s.len), mu = snum(s.mu);
    if (L > 0 && mu > 0) {
      const T = W.press_fit_torque(p, d, L, mu), F = W.press_fit_axial_force(p, d, L, mu);
      rows.push(['Torque the fit can hold', fmt(inch ? T / 12 : T / 1000, 1), inch ? 'lbf·ft' : 'N·m'], ['Axial force to push it off', fmt(inch ? F : F / 1000, inch ? 0 : 2), inch ? 'lbf' : 'kN']);
    }
    p_.innerHTML = mRes('Press fit', rows);
  }
  calc();
}

// ---------- Unit converter ----------
const UNIT_STATE = { q: 0, from: 1, x: 1 };
// Angle forms that are not a fixed factor (kinds of core units::angle_form_*), offered as extra "From" choices.
const ANGLE_FORMS = [['dms', 'Degrees, minutes, seconds (type 29 30 15)'], ['f0', '% slope (100 tan a)'], ['f1', 'Slope 1 in n'], ['f2', 'Taper per foot (in of diameter per ft)'], ['f3', 'Taper ratio 1:x (on the diameter)'], ['f4', 'Rate of taper C = (D - d) / L']];
function renderUnits(el) {
  const s = UNIT_STATE, W = state.W;
  const qs = mStr(W, W.unit_quantities()).split('\n');
  const list = q => mStr(W, W.unit_list(q)).split('\n').map(l => { const [sym, name, ex, k] = l.split('|'); return { sym, name, exact: ex === '1', k: +k }; });
  const isAngle = () => qs[s.q] === 'Angle';
  const draw = () => {
    const us = list(s.q); if (!(isAngle() && ANGLE_FORMS.some(f => f[0] === s.from)) && !(+s.from < us.length)) s.from = 0;
    const opts = us.map((x, i) => [i, sesc(x.sym + ' (' + x.name + ')')]).concat(isAngle() ? ANGLE_FORMS : []);
    const txt = s.from === 'dms';
    el.innerHTML = '<div class="grid">' + sfield('Quantity', gsel('q', qs.map((n, i) => [i, n]), s.q), '') + sfield('Value', txt ? mtxt('x', s.x, 160, '29 30 15') : sinp('x', s.x, 160), '') + sfield('From', gsel('from', opts, s.from), '') + '</div><div id="ures"></div>';
    el.querySelector('[data-k="q"]').onchange = e => { s.q = +e.target.value; s.from = 1; draw(); };
    el.querySelector('[data-k="from"]').onchange = e => { const v = e.target.value, wasTxt = s.from === 'dms'; s.from = /^\d+$/.test(v) ? +v : v; if (wasTxt !== (s.from === 'dms')) draw(); else calc(); };
    el.querySelector('[data-k="x"]').oninput = e => { s.x = e.target.value; calc(); };
    calc();
  };
  const fmtv = v => { const a = Math.abs(v); return a !== 0 && (a >= 1e9 || a < 1e-4) ? v.toExponential(6) : (+v.toPrecision(10)).toLocaleString('en-GB', { maximumFractionDigits: 10 }); };
  const calc = () => {
    const us = list(s.q), out = el.querySelector('#ures');
    if (isAngle() && typeof s.from === 'string') { angleCalc(us, out); return; }
    const x = snum(s.x);
    if (!isFinite(x)) { out.innerHTML = mMsg('Converted', 'Enter a value'); return; }
    out.innerHTML = '<div class="res"><div class="h">' + sesc(fmtv(x) + ' ' + us[s.from].sym) + ' is</div><table>' + us.map((t, i) => '<tr' + (i === s.from ? ' class="on"' : '') + '><td>' + sesc(t.name) + (t.exact ? '' : ' <span class="ms">(conventional value)</span>') + '</td><td class="v">' + fmtv(W.unit_convert(s.q, s.from, i, x)) + '</td><td class="u">' + sesc(t.sym) + '</td></tr>').join('') + '</table></div>' +
      (isAngle() ? angleForms(W.unit_convert(s.q, s.from, 1, x)) : '') +
      mNote('Factors are built from the exact definitions in NIST SP 811 Appendix B (inch 0.0254 m, pound 0.45359237 kg, standard gravity 9.80665 m/s², and so on); results are shown to 10 significant digits. ' + (s.q === 12 ? 'Temperature converts a reading (20 °C = 68 °F); use "Temperature difference" for a change or an expansion coefficient (10 K = 18 °F).' : s.q === 6 ? 'mmHg, inHg and inH₂O are conventional values (standard mercury and water density with standard gravity).' : isAngle() ? ANGLE_NOTE : ''));
  };
  const ANGLE_NOTE = 'Angle factors are exact: 1° = π/180 rad, 1 gon = π/200 rad = 0.9°, 1′ = 1/60°, 1″ = 1/3600° (NIST SP 811). Slope and taper forms are not fixed factors: % slope = 100 tan a and 1 in n with n = 1 / tan a take the angle from the horizontal (Wikipedia "Grade (slope)"); the tapers take it as the included angle of a cone: rate of taper C = (D − d) / L = 2 tan(a/2) = 1 : x with x = 1 / (2 tan(a/2)) (ISO 1119 definition, as printed in the public preview of ISO/R 1119), and taper per foot = 12 C inches of diameter per foot (Omni Calculator taper; Machinery\'s Handbook, tapers, by name). Worked in the Rust core.';
  // Slope and taper forms of an angle in degrees.
  const angleForms = deg => {
    const F = k => W.angle_form_from_deg(k, deg), half = deg / 2;
    const row = (label, v, u) => '<tr><td>' + label + '</td><td class="v">' + (isFinite(v) ? fmtv(v) : '<span class="ms">not meaningful for this angle</span>') + '</td><td class="u">' + u + '</td></tr>';
    return '<div class="res" style="margin-top:12px"><div class="h">The same angle as degrees, minutes, seconds, slope and taper</div><table>' +
      '<tr><td>Degrees, minutes, seconds</td><td class="v">' + mdms(W, deg) + '</td><td class="u"></td></tr>' +
      row('As a slope from the horizontal: percent', F(0), '%') + row('As a slope: 1 in n', F(1), 'n') +
      row('As the included angle of a taper: taper per foot', F(2), 'in/ft') + row('Taper ratio 1 : x', F(3), 'x') + row('Rate of taper C (diameter change per length)', F(4), 'per unit') +
      '<tr><td>Half angle (each side of the taper)</td><td class="v">' + fmtv(half) + '° <span class="ms">' + mdms(W, half) + '</span></td><td class="u"></td></tr></table></div>';
  };
  const angleCalc = (us, out) => {
    let deg = NaN, shown = '';
    if (s.from === 'dms') {
      const p = String(s.x).trim().split(/[^0-9.+-]+/).filter(Boolean).map(Number);
      if (p.length && p.every(isFinite)) { deg = W.dms_to_deg(p[0], p[1] || 0, p[2] || 0); shown = String(s.x).trim(); }
    } else {
      const x = snum(s.x);
      if (isFinite(x)) { deg = W.angle_form_to_deg(+s.from.slice(1), x); shown = fmtv(x) + ' (' + ANGLE_FORMS.find(f => f[0] === s.from)[1] + ')'; }
    }
    if (!isFinite(deg)) { out.innerHTML = mMsg('Converted', s.from === 'dms' ? 'Enter degrees, minutes and seconds, e.g. 29 30 15' : 'Enter a value this form allows (a slope or taper above zero)'); return; }
    out.innerHTML = '<div class="res"><div class="h">' + sesc(shown) + ' is</div><table>' + us.map((t, i) => '<tr><td>' + sesc(t.name) + '</td><td class="v">' + fmtv(W.unit_convert(s.q, 1, i, deg)) + '</td><td class="u">' + sesc(t.sym) + '</td></tr>').join('') + '</table></div>' +
      angleForms(deg) + mNote((s.from === 'f0' || s.from === 'f1' ? 'The angle above is the slope angle from the horizontal. ' : s.from === 'dms' ? '' : 'The angle above is the included angle of the taper. ') + ANGLE_NOTE);
  };
  draw();
}

// ---------- Calculator tool page ----------
// The calculator itself is app/calc.js (BenchCalc), rendered inline here;
// below it: degrees-minutes-seconds, prime factors and interpolation.
const CALC_STATE = { dd: 29.5, dm: '', ds: '', dx: '', pf: 360, x1: 0, y1: 0, x2: 10, y2: 100, x: 2.5 };
function renderCalc(el) {
  const s = CALC_STATE, W = state.W;
  el.innerHTML = '';
  if (window.BenchCalc) BenchCalc.render(el);
  const x = document.createElement('div'); el.appendChild(x);
  x.innerHTML = mNote('Typing: operators + − * / ^ (power, right to left: 2^3^2 = 512; −2^2 = −4), % (percent when nothing follows it: 200*15% = 30; remainder between two numbers: 7 % 3 = 1), ! (factorial) and brackets. Mixed numbers: 3 7/16 or 3-7/16 (no spaces); write 3 - 7/16 with spaces to subtract. Constants pi, e, ans (last result). Functions: sin cos tan asin acos atan atan2(y, x), sinh cosh tanh, sqrt cbrt abs, ln, log (base 10), log2, exp, floor ceil round, min max hypot pow mod, fact ncr npr, dms(d, m, s) to decimal degrees, inv(a) involute (tan a − a, in radians), sec csc cot, versin(a) versed sine (1 − cos a), coversin(a) (1 − sin a), exsec(a) (sec a − 1). Lengths with a unit can be mixed and come back in the app\u2019s unit: 12.7mm + 1/2 in, 3 7/16&quot;, 5\' 3 1/2&quot;, 5 thou, 25 um (units: in or &quot;, ft or \', thou, mm, cm, m, um). Angles in degrees, minutes and seconds: 29\u00B030\'15&quot;. Multiplication must be written: 2*pi, not 2pi. Enter evaluates, Ctrl+Enter uses the result in the field the calculator was opened from. The expression is parsed by BenchMate\'s own parser in the Rust core; nothing is run as code.') +
    '<h2>Degrees, minutes and seconds</h2><div class="grid">' + sfield('Degrees', sinp('dd', s.dd), '°') + sfield('Minutes', sinp('dm', s.dm), '′') + sfield('Seconds', sinp('ds', s.ds), '″') + sfield('Or decimal degrees', sinp('dx', s.dx), '°') + '</div><div id="cdms"></div>' +
    '<h2>Prime factors</h2><div class="grid">' + sfield('Whole number', sinp('pf', s.pf), '') + '</div><div id="cpf"></div>' +
    '<h2>Linear interpolation</h2><p class="desc">Read a value between two table rows.</p><div class="grid">' + sfield('x1', sinp('x1', s.x1), '') + sfield('y1', sinp('y1', s.y1), '') + sfield('x2', sinp('x2', s.x2), '') + sfield('y2', sinp('y2', s.y2), '') + sfield('x', sinp('x', s.x), '') + '</div><div id="cint"></div>';
  x.querySelectorAll('[data-k]').forEach(i => { i.oninput = () => { s[i.dataset.k] = i.value; if (i.dataset.k === 'dx') ['dd', 'dm', 'ds'].forEach(k => s[k] = ''); else if (['dd', 'dm', 'ds'].includes(i.dataset.k)) s.dx = ''; side(); }; });
  function side() {
    const dx = snum(s.dx);
    let deg;
    if (isFinite(dx)) deg = dx; else { const d = snum(s.dd) || 0, m = snum(s.dm) || 0, sc = snum(s.ds) || 0; deg = (d < 0 ? -1 : 1) * (Math.abs(d) + m / 60 + sc / 3600); }
    x.querySelector('#cdms').innerHTML = mRes('Angle', [['Decimal degrees', fmt(deg, 8), '°'], ['Degrees, minutes, seconds', mdms(W, deg), ''], ['Radians', fmt(deg * Math.PI / 180, 10), 'rad'], ['Minutes', fmt(deg * 60, 6), '′']]);
    const n = snum(s.pf), c = W.prime_factors(n), f = listOut(W, c);
    x.querySelector('#cpf').innerHTML = mRes('Prime factors', [[c ? (c === 1 ? sesc(String(n)) + ' is prime' : sesc(String(n)) + ' =') : 'Enter a whole number from 2 to 10¹²', c > 1 ? f.join(' × ') : '', '']]);
    const y = W.interpolate(snum(s.x1), snum(s.y1), snum(s.x2), snum(s.y2), snum(s.x));
    x.querySelector('#cint').innerHTML = mRes('Interpolated', [['y at x', isFinite(y) ? fmt(y, 6) : 'enter two different x values', '', snum(s.x) < Math.min(snum(s.x1), snum(s.x2)) || snum(s.x) > Math.max(snum(s.x1), snum(s.x2)) ? 'x is outside the two rows: this is extrapolation.' : '']]);
  }
  side();
}

// ---------- Plane figures and solids ----------
const FIG_STATE = { kind: 'p1', a: 4, b: 2, c: 3 };
const FIG = {
  p0: ['Square', ['Side a'], ['Diagonal (across corners)', 'Diameter of the circle of equal area']],
  p1: ['Rectangle', ['Length a', 'Width b'], ['Diagonal']],
  p2: ['Parallelogram', ['Base a', 'Height b', 'Slant side c'], ['Acute angle (deg)']],
  p3: ['Trapezoid (isosceles)', ['Parallel side a', 'Parallel side b', 'Height c'], ['Slant side']],
  p4: ['Circle', ['Diameter a'], ['Side of the square of equal area']],
  p5: ['Ring (annulus)', ['Outside diameter a', 'Inside diameter b'], ['Wall']],
  p6: ['Ellipse', ['Major axis a (full length)', 'Minor axis b'], []],
  p7: ['Regular polygon from across flats', ['Number of sides a', 'Across flats b'], ['Side length', 'Across corners']],
  p9: ['Regular polygon from across corners', ['Number of sides a', 'Across corners b'], ['Side length', 'Across flats']],
  p8: ['Circular sector', ['Radius a', 'Angle b (deg)'], ['Arc length', 'Chord']],
  s0: ['Cube', ['Side a'], ['Space diagonal']],
  s1: ['Box (rectangular prism)', ['Length a', 'Width b', 'Height c'], ['Space diagonal']],
  s2: ['Cylinder (round bar)', ['Diameter a', 'Length b'], []],
  s3: ['Tube', ['Outside diameter a', 'Inside diameter b', 'Length c'], ['Inside surface']],
  s4: ['Cone', ['Base diameter a', 'Height b'], ['Slant height']],
  s5: ['Frustum of a cone', ['Large diameter a', 'Small diameter b', 'Height c'], ['Slant height']],
  s6: ['Sphere', ['Diameter a'], []],
  s7: ['Spherical cap', ['Sphere diameter a', 'Cap height b'], ['Base diameter']],
  s8: ['Square pyramid', ['Base side a', 'Height b'], ['Slant height (face)']],
  s9: ['Torus (O-ring shape)', ['Mean diameter a', 'Section diameter b'], []],
  s10: ['Hexagon bar', ['Across flats a', 'Length b'], ['Across corners']],
};
function figDiagram(kind, a, b, c) {
  const W = 420, H = 220;
  let s = '', lab = '';
  const L = (q, t) => gtxt(q, t, 'gv', 'middle');
  const P = (pts) => 'M' + pts.map(gpt).join('L') + 'Z';
  const fit = (w, h) => { const k = Math.min(300 / w, 170 / h); return { k, x0: (W - w * k) / 2, y0: (H - h * k) / 2 }; };
  const box = (w, h) => { const f = fit(w, h); return [[f.x0, f.y0 + h * f.k], [f.x0 + w * f.k, f.y0 + h * f.k], [f.x0 + w * f.k, f.y0], [f.x0, f.y0], f]; };
  const reg = (n, R, cx, cy, rot) => Array.from({ length: n }, (_, i) => { const t = rot + 2 * Math.PI * i / n; return [cx + R * Math.cos(t), cy - R * Math.sin(t)]; });
  const ell = (cx, cy, rx, ry, cls, half) => half ? '<path class="' + cls + '" d="M' + (cx - rx).toFixed(1) + ' ' + cy.toFixed(1) + 'A' + rx.toFixed(1) + ' ' + ry.toFixed(1) + ' 0 0 0 ' + (cx + rx).toFixed(1) + ' ' + cy.toFixed(1) + '"/>' : '<ellipse class="' + cls + '" cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" rx="' + Math.max(rx, 0.1).toFixed(1) + '" ry="' + Math.max(ry, 0.1).toFixed(1) + '"/>';
  switch (kind) {
    case 'p0': case 'p1': { const w = a, h = kind === 'p0' ? a : b, q = box(w, h); s = '<path class="gfill" d="' + P(q.slice(0, 4)) + '"/><path class="gp" d="' + P(q.slice(0, 4)) + '"/><path class="gk" d="M' + gpt(q[0]) + 'L' + gpt(q[2]) + '"/>'; lab = L([(q[0][0] + q[1][0]) / 2, q[0][1] + 16], 'a') + (kind === 'p1' ? L([q[1][0] + 12, (q[1][1] + q[2][1]) / 2], 'b') : ''); break; }
    case 'p2': { const off = Math.sqrt(Math.max(c * c - b * b, 0)), f = fit(a + off, b); const pts = [[0, 0], [a, 0], [a + off, b], [off, b]].map(p => [f.x0 + p[0] * f.k, f.y0 + (b - p[1]) * f.k]); s = '<path class="gfill" d="' + P(pts) + '"/><path class="gp" d="' + P(pts) + '"/><path class="gk" d="M' + gpt(pts[3]) + 'L' + gpt([pts[3][0], pts[0][1]]) + '"/>'; lab = L([(pts[0][0] + pts[1][0]) / 2, pts[0][1] + 16], 'a') + L([pts[3][0] - 10, (pts[0][1] + pts[3][1]) / 2], 'b') + L([(pts[1][0] + pts[2][0]) / 2 + 12, (pts[1][1] + pts[2][1]) / 2], 'c'); break; }
    case 'p3': { const w = Math.max(a, b), f = fit(w, c); const pts = [[(w - a) / 2, 0], [(w + a) / 2, 0], [(w + b) / 2, c], [(w - b) / 2, c]].map(p => [f.x0 + p[0] * f.k, f.y0 + (c - p[1]) * f.k]); s = '<path class="gfill" d="' + P(pts) + '"/><path class="gp" d="' + P(pts) + '"/>'; lab = L([(pts[0][0] + pts[1][0]) / 2, pts[0][1] + 16], 'a') + L([(pts[2][0] + pts[3][0]) / 2, pts[2][1] - 6], 'b') + '<path class="gk" d="M' + gpt([W / 2, pts[0][1]]) + 'L' + gpt([W / 2, pts[2][1]]) + '"/>' + L([W / 2 + 10, (pts[0][1] + pts[2][1]) / 2], 'c'); break; }
    case 'p4': case 'p5': case 'p6': { const rx = 150 * (kind === 'p6' ? 1 : 0.55), ry = kind === 'p6' ? 150 * Math.min(b / a, 1) * 0.55 : 80; const R = kind === 'p6' ? rx : 80; s = '<ellipse class="gfill" cx="210" cy="110" rx="' + (kind === 'p6' ? rx : R) + '" ry="' + (kind === 'p6' ? ry : R) + '"/>' + ell(210, 110, kind === 'p6' ? rx : R, kind === 'p6' ? ry : R, 'gp'); if (kind === 'p5' && b > 0) s += '<circle class="gsoft" cx="210" cy="110" r="' + (80 * b / a).toFixed(1) + '"/><circle class="gp" cx="210" cy="110" r="' + (80 * b / a).toFixed(1) + '"/>'; s += '<path class="gk" d="M' + (210 - (kind === 'p6' ? rx : R)) + ' 110L' + (210 + (kind === 'p6' ? rx : R)) + ' 110"/>'; lab = L([210, 104], 'a') + (kind === 'p6' ? '<path class="gk" d="M210 ' + (110 - ry).toFixed(1) + 'L210 ' + (110 + ry).toFixed(1) + '"/>' + L([222, 110 - ry / 2], 'b') : kind === 'p5' ? L([210, 110 + 80 * b / a / 2 + 4], 'b') : ''); break; }
    case 'p7': case 'p9': { const n = Math.max(3, Math.round(a)), R = 85, pts = reg(n, R, 210, 110, Math.PI / 2 + (n % 2 ? 0 : Math.PI / n)); s = '<path class="gfill" d="' + P(pts) + '"/><path class="gp" d="' + P(pts) + '"/><circle class="gm" cx="210" cy="110" r="' + (R * Math.cos(Math.PI / n)).toFixed(1) + '"/><circle class="gm" cx="210" cy="110" r="' + R + '"/>'; lab = gtxt([210, 214], kind === 'p7' ? 'across flats b (inner circle)' : 'across corners b (outer circle)', 'gs', 'middle'); break; }
    case 'p8': { const t = Math.min(b, 359.9) * Math.PI / 180, R = 90, c0 = [210, 150], a0 = Math.PI / 2 - t / 2, a1 = Math.PI / 2 + t / 2, p0 = [c0[0] + R * Math.cos(a0), c0[1] - R * Math.sin(a0)], p1 = [c0[0] + R * Math.cos(a1), c0[1] - R * Math.sin(a1)]; const d = 'M' + gpt(c0) + 'L' + gpt(p0) + 'A' + R + ' ' + R + ' 0 ' + (t > Math.PI ? 1 : 0) + ' 0 ' + gpt(p1) + 'Z'; s = '<path class="gfill" d="' + d + '"/><path class="gp" d="' + d + '"/>'; lab = L([(c0[0] + p0[0]) / 2 + 10, (c0[1] + p0[1]) / 2 + 4], 'a') + L([c0[0], c0[1] - 16], 'b'); break; }
    case 's0': case 's1': case 's10': {
      const w = kind === 's10' ? b : a, h = kind === 's0' ? a : kind === 's10' ? a : c, dpt = kind === 's0' ? a : kind === 's10' ? a * 1.15 : b;
      const k = Math.min(260 / (w + dpt * 0.5), 160 / (h + dpt * 0.35)), ox = (W - (w + dpt * 0.5) * k) / 2, oy = H - (H - (h + dpt * 0.35) * k) / 2;
      const p = (x, y, z) => [ox + (x + z * 0.5) * k, oy - (y + z * 0.35) * k];
      if (kind === 's10') {
        const f0 = [0, 1, 2, 3, 4, 5].map(i => { const t = Math.PI / 6 + i * Math.PI / 3; return [0, a / 2 + a / 2 / Math.cos(Math.PI / 6) * Math.sin(t), dpt / 2 + dpt / 2 * Math.cos(t)]; });
        const fr = f0.map(q => p(q[0], q[1], q[2])), bk = f0.map(q => p(b, q[1], q[2]));
        s = '<path class="gfill" d="' + P(fr) + '"/><path class="gp" d="' + P(fr) + '"/><path class="gp" d="' + [0, 1, 2, 3, 4, 5].map(i => 'M' + gpt(fr[i]) + 'L' + gpt(bk[i])).join('') + 'M' + bk.map(gpt).join('L') + 'Z"/>';
        lab = L([fr[0][0] - 12, (fr[1][1] + fr[4][1]) / 2], 'a') + L([(fr[4][0] + bk[4][0]) / 2, Math.max(...fr.map(q => q[1])) + 16], 'b');
      } else {
        const v = [p(0, 0, 0), p(w, 0, 0), p(w, h, 0), p(0, h, 0), p(0, 0, dpt), p(w, 0, dpt), p(w, h, dpt), p(0, h, dpt)];
        s = '<path class="gfill" d="' + P([v[0], v[1], v[2], v[3]]) + '"/><path class="gp" d="' + P([v[0], v[1], v[2], v[3]]) + 'M' + gpt(v[1]) + 'L' + gpt(v[5]) + 'L' + gpt(v[6]) + 'L' + gpt(v[2]) + 'M' + gpt(v[6]) + 'L' + gpt(v[7]) + 'L' + gpt(v[3]) + '"/><path class="grap" d="M' + gpt(v[0]) + 'L' + gpt(v[4]) + 'L' + gpt(v[5]) + 'M' + gpt(v[4]) + 'L' + gpt(v[7]) + '"/>';
        lab = L([(v[0][0] + v[1][0]) / 2, v[0][1] + 16], 'a') + (kind === 's1' ? L([(v[1][0] + v[5][0]) / 2 + 10, (v[1][1] + v[5][1]) / 2 + 8], 'b') + L([v[0][0] - 10, (v[0][1] + v[3][1]) / 2], 'c') : '');
      }
      break;
    }
    case 's2': case 's3': case 's4': case 's5': {
      const D = a, d2 = kind === 's5' ? b : kind === 's4' ? 0 : a, h = kind === 's2' ? b : c * (kind === 's3' || kind === 's5') + b * (kind === 's4');
      const k = Math.min(170 / Math.max(D, d2), 160 / (h + D * 0.3)), cx = 210, yb = H / 2 + h * k / 2 + 6, yt = yb - h * k, rx = D * k / 2, rt = d2 * k / 2, ry = rx * 0.28, ryt = rt * 0.28;
      s = '<path class="gfill" d="M' + (cx - rx) + ' ' + yb + 'L' + (cx - rt) + ' ' + yt + 'L' + (cx + rt) + ' ' + yt + 'L' + (cx + rx) + ' ' + yb + 'Z"/>';
      s += ell(cx, yb, rx, ry, 'gp', true) + '<path class="grap" d="M' + (cx - rx) + ' ' + yb + 'A' + rx + ' ' + ry + ' 0 0 1 ' + (cx + rx) + ' ' + yb + '"/>';
      s += '<path class="gp" d="M' + (cx - rx) + ' ' + yb + 'L' + (cx - rt) + ' ' + yt + 'M' + (cx + rx) + ' ' + yb + 'L' + (cx + rt) + ' ' + yt + '"/>';
      if (rt > 0) s += ell(cx, yt, rt, ryt, 'gp');
      if (kind === 's3' && b > 0 && b < a) s += ell(cx, yt, rt * b / a, ryt * b / a, 'gp');
      lab = L([cx, yb + ry + 16], 'a') + (kind === 's3' ? L([cx, yt + 4], 'b') : kind === 's5' ? L([cx, yt - ryt - 6], 'b') : '') + L([cx + Math.max(rx, rt) + 14, (yb + yt) / 2], kind === 's2' || kind === 's4' ? 'b' : 'c');
      break;
    }
    case 's6': case 's7': {
      const R = 85, cx = 210, cy = 110;
      s = '<circle class="gfill" cx="' + cx + '" cy="' + cy + '" r="' + R + '"/><circle class="gp" cx="' + cx + '" cy="' + cy + '" r="' + R + '"/>' + ell(cx, cy, R, R * 0.28, 'grap');
      if (kind === 's7') { const hh = Math.min(b / a, 1) * 2 * R, yc = cy - R + hh, half = Math.sqrt(Math.max(R * R - (yc - cy) ** 2, 0)); s += '<path class="gacc" d="M' + (cx - half).toFixed(1) + ' ' + yc.toFixed(1) + 'A' + R + ' ' + R + ' 0 ' + (hh > R ? 1 : 0) + ' 1 ' + (cx + half).toFixed(1) + ' ' + yc.toFixed(1) + 'Z"/>' + L([cx + half + 12, (yc + cy - R) / 2], 'b'); }
      s += '<path class="gk" d="M' + (cx - R) + ' ' + (cy + R + 10) + 'L' + (cx + R) + ' ' + (cy + R + 10) + '"/>'; lab = L([cx, cy + R + 24], 'a').replace('y="' + (cy + R + 24).toFixed(1), 'y="' + (cy + R + 6).toFixed(1));
      break;
    }
    case 's8': { const k = Math.min(240 / (a * 1.5), 160 / (b + a * 0.35)), ox = (W - a * 1.5 * k) / 2, oy = H - 24; const p = (x, y, z) => [ox + (x + z * 0.5) * k, oy - (y + z * 0.35) * k]; const v = [p(0, 0, 0), p(a, 0, 0), p(a, 0, a), p(0, 0, a)], ap = p(a / 2, b, a / 2); s = '<path class="gfill" d="' + P([v[0], v[1], ap]) + '"/><path class="gp" d="' + P([v[0], v[1], ap]) + 'M' + gpt(v[1]) + 'L' + gpt(v[2]) + 'L' + gpt(ap) + '"/><path class="grap" d="M' + gpt(v[0]) + 'L' + gpt(v[3]) + 'L' + gpt(v[2]) + 'M' + gpt(v[3]) + 'L' + gpt(ap) + '"/>'; lab = L([(v[0][0] + v[1][0]) / 2, v[0][1] + 16], 'a') + '<path class="gk" d="M' + gpt(ap) + 'L' + gpt(p(a / 2, 0, a / 2)) + '"/>' + L([ap[0] + 10, (ap[1] + p(a / 2, 0, a / 2)[1]) / 2], 'b'); break; }
    case 's9': { const Rm = 110 * 0.75, r = Math.min(Rm * b / a, Rm), cx = 210, cy = 110, sy = 0.4; s = ell(cx, cy, Rm + r, (Rm + r) * sy, 'gfill') + ell(cx, cy, Rm + r, (Rm + r) * sy, 'gp') + ell(cx, cy, Math.max(Rm - r, 1), Math.max(Rm - r, 1) * sy, 'gp') + ell(cx, cy, Rm, Rm * sy, 'gk'); lab = gtxt([cx, cy + (Rm + r) * sy + 18], 'mean diameter a, section b', 'gs', 'middle'); break; }
  }
  return gsvg(W, H, s + lab, FIG[kind][0]);
}
function renderFigures(el) {
  const s = FIG_STATE, W = state.W, u = lenU(state.sys);
  const plane = k => k[0] === 'p';
  const draw = () => {
    const f = FIG[s.kind];
    const opt = (pre, t) => '<optgroup label="' + t + '">' + Object.keys(FIG).filter(k => k[0] === pre).map(k => '<option value="' + k + '"' + (k === s.kind ? ' selected' : '') + '>' + FIG[k][0] + '</option>').join('') + '</optgroup>';
    el.innerHTML = '<div class="grid"><label class="f"><span>Figure</span><div class="row"><select data-k="kind">' + opt('p', 'Plane figures') + opt('s', 'Solids') + '</select></div></label>' +
      f[1].map((lab, i) => sfield(lab, sinp('abc'[i], s['abc'[i]]), /angle|deg/i.test(lab) ? 'deg' : /Number of sides/.test(lab) ? '' : u)).join('') + '</div><div id="fdia"></div><div id="fres"></div>';
    el.querySelector('[data-k="kind"]').onchange = e => { s.kind = e.target.value; draw(); };
    el.querySelectorAll('input[data-k]').forEach(i => i.oninput = () => { s[i.dataset.k] = i.value; calc(); });
    calc();
  };
  const calc = () => {
    const f = FIG[s.kind], kind = +s.kind.slice(1), a = snum(s.a), b = snum(s.b), c = snum(s.c), dp = gdp();
    const v = [0, 1, 2, 3].map(i => plane(s.kind) ? W.plane_figure(kind, a, b, c, i) : W.solid_figure(kind, a, b, c, i));
    const out = el.querySelector('#fres'), dia = el.querySelector('#fdia');
    if (!isFinite(v[0])) { dia.innerHTML = ''; out.innerHTML = mMsg('Results', 'Enter ' + f[1].join(', ').toLowerCase() + (s.kind === 'p2' ? ' (the slant side cannot be shorter than the height)' : ['p5', 's3'].includes(s.kind) ? ' (inside smaller than outside)' : s.kind === 's7' ? ' (cap no higher than the sphere)' : '')); return; }
    dia.innerHTML = figDiagram(s.kind, a, b, c);
    const rows = plane(s.kind)
      ? [['Area', gf(v[0], dp), u + '²'], [s.kind === 'p4' ? 'Circumference' : 'Perimeter', gf(v[1], dp), u]]
      : [['Volume', gf(v[0], dp), u + '³'], ['Total surface area', gf(v[1], dp), u + '²'], ['Side (lateral) surface', gf(v[2], dp), u + '²']];
    f[2].forEach((lab, i) => { const x = plane(s.kind) ? v[2 + i] : v[3]; if (isFinite(x)) rows.push([lab, /deg/.test(lab) ? mangle(x) : gf(x, dp), /deg/.test(lab) ? 'deg' : u]); });
    if (!plane(s.kind)) rows.push(['Volume', gf(state.sys === 'inch' ? v[0] * 16.387064 : v[0] / 1000, 3), state.sys === 'inch' ? 'cm³' : 'cm³ (mL)']);
    out.innerHTML = mRes(f[0], rows) + (s.kind === 'p6' ? mNote('The ellipse perimeter has no closed form; Ramanujan\'s second approximation is used (good to better than 1 part in a million except for very flat ellipses).') : '') +
      (!plane(s.kind) ? mNote('For weight, multiply the volume by the density (see the stock weight tool for bar, tube and plate).') : '');
  };
  draw();
}

// ---------- Irregular area from equally spaced widths ----------
const IRR_STATE = { text: '3.6 5.0 6.5 5.5 7.3 6.0 4.0', d: 25 };
function renderIrregular(el) {
  const s = IRR_STATE, W = state.W, u = lenU(state.sys);
  el.innerHTML = '<p class="desc">Rule lines across the outline at equal steps and measure the width on each line, including the two ends (enter 0 where the outline closes to a point). Type the widths in order.</p>' +
    '<div class="grid"><label class="f" style="grid-column:1/-1"><span>Widths, in order (' + u + ')</span><div class="row"><textarea data-k="text" rows="2" style="width:100%;font-family:var(--mono)">' + sesc(s.text) + '</textarea></div></label>' +
    sfield('Step between the lines', sinp('d', s.d), u) + '</div><div id="idia"></div><div id="ires"></div>';
  const calc = () => {
    const ys = parseValues(s.text), d = snum(s.d), out = el.querySelector('#ires'), dia = el.querySelector('#idia'), dp = gdp();
    if (ys.length < 2 || !(d > 0) || ys.some(y => y < 0)) { dia.innerHTML = ''; out.innerHTML = mMsg('Area', 'Enter at least two widths (none below zero) and the step between them.'); return; }
    const n = toBuf(W, ys), tr = W.area_from_buf(n, d, 0), si = W.area_from_buf(n, d, 1);
    // Figure: the widths as uprights, joined along the top (layout only; the areas come from the core).
    const Wd = 520, Hd = 200, x0 = 30, y0 = 160, top = Math.max(...ys.slice(0, n)) || 1, kx = (Wd - 60) / (n - 1), ky = 120 / top;
    const pts = ys.slice(0, n).map((y, i) => [x0 + i * kx, y0 - y * ky]);
    dia.innerHTML = '<svg viewBox="0 0 ' + Wd + ' ' + Hd + '" class="geo" role="img" aria-label="The widths drawn as uprights at equal steps, joined along the top"><path d="M' + x0 + ' ' + y0 + 'L' + pts.map(q => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join('L') + 'L' + (x0 + (n - 1) * kx).toFixed(1) + ' ' + y0 + 'Z" class="gp gfill"/>' +
      pts.map(q => '<path d="M' + q[0].toFixed(1) + ' ' + y0 + 'L' + q[0].toFixed(1) + ' ' + q[1].toFixed(1) + '" class="gm"/>').join('') +
      gtxt([x0 + kx / 2, y0 + 18], 'step ' + gf(d, dp) + ' ' + u, 'gv', 'middle') + gtxt([Wd / 2, 20], n + ' widths, ' + (n - 1) + ' strips', 'gv', 'middle') + '</svg>';
    const rows = [['Widths entered', String(n), ''], ['Area by the trapezoidal rule', gf(tr, dp), u + '²']];
    rows.push(isFinite(si) ? ['Area by Simpson\'s rule', gf(si, dp), u + '²'] : ['Area by Simpson\'s rule', 'needs an odd number of widths (an even number of strips): add or drop one line', '']);
    out.innerHTML = mRes('Irregular area', rows) + mNote('The trapezoidal rule joins the tops of the widths with straight lines, so it reads low on an outline that bulges outward and high on one that curves inward. Simpson\'s rule fits a curve through each three widths and is usually closer. More lines, closer together, improve both.');
  };
  el.querySelectorAll('[data-k]').forEach(i => i.oninput = () => { s[i.dataset.k] = i.value; calc(); });
  calc();
}

// ---------- Compound angles ----------
const CMP_STATE = { mode: 'app', a: 30, b: 20, c: 35, dir: 30, sb: '' };
function renderCompound(el) {
  const s = CMP_STATE, W = state.W, u = lenU(state.sys);
  const draw = () => {
    const lab = { app: ['Apparent angle seen from the front (in the XZ plane)', 'Apparent angle seen from the side (in the YZ plane)'], seq: ['First tilt, about the X axis (lower plate)', 'Second tilt, about the tilted plate\'s own Y axis (upper plate)'], true: ['True angle of the face (steepest slope)', 'Direction of the slope in plan, from X towards Y'] }[s.mode];
    el.innerHTML = '<div class="mfilter"><span>You know:</span>' + gseg('cmode', [['app', 'Drawing angles'], ['seq', 'Two tilts'], ['true', 'True angle']], s.mode) + '</div>' +
      '<p class="desc">A compound-angle face is tilted in two directions at once. Its true angle is the steepest slope of the face against the base. Drawings usually give the two apparent angles (the slope you see in the front view and in the side view); a compound sine plate or a tilting table on a tilting table sets two successive tilts. These differ: 30° and 30° apparent is 39.23° true, 30° then 30° tilted is 41.41° true.</p>' +
      '<div class="grid">' + sfield(lab[0], sinp('a', s.mode === 'true' ? s.c : s.a), 'deg') + sfield(lab[1], sinp('b', s.mode === 'true' ? s.dir : s.b), 'deg') + sfield('Sine bar or plate length (for heights)', sinp('sb', s.sb), u) + '</div><div id="cres"></div>';
    el.querySelectorAll('#cmode button').forEach(b => b.onclick = () => { s.mode = b.dataset.v; draw(); });
    el.querySelectorAll('input[data-k]').forEach(i => i.oninput = () => { const k = i.dataset.k; if (s.mode === 'true' && k === 'a') s.c = i.value; else if (s.mode === 'true' && k === 'b') s.dir = i.value; else s[k] = i.value; calc(); });
    calc();
  };
  const calc = () => {
    const out = el.querySelector('#cres');
    let C, dir;
    if (s.mode === 'app') { C = W.compound_apparent(snum(s.a), snum(s.b), 0); dir = W.compound_apparent(snum(s.a), snum(s.b), 1); }
    else if (s.mode === 'seq') { C = W.compound_sequential(snum(s.a), snum(s.b), 0); dir = W.compound_sequential(snum(s.a), snum(s.b), 1); }
    else { C = snum(s.c); dir = snum(s.dir); }
    const st = [0, 1, 2, 3].map(i => W.compound_settings(C, dir, i));
    if (!isFinite(C) || !st.every(isFinite)) { out.innerHTML = mMsg('Results', 'Enter two angles below 90°'); return; }
    const L = snum(s.sb), h = x => L > 0 ? gf(L * Math.sin(Math.abs(x) * Math.PI / 180), gdp()) + ' ' + u : '';
    out.innerHTML = mRes('The face', [['True angle (steepest slope)', mangle(C), 'deg'], ['', mdms(W, C), ''], ['Direction of the slope in plan, from X', mangle(dir), 'deg']]) +
      mRes('Ways to set it up', [
        ['Swivel ' + gf(dir, 2) + '° in plan, then tilt', mangle(C), 'deg', ''],
        ['Compound sine plate: lower plate (about X)', mangle(st[2]), 'deg' + (L > 0 ? ', blocks ' + h(st[2]) : '')],
        ['Compound sine plate: upper plate (about its own Y)', mangle(st[3]), 'deg' + (L > 0 ? ', blocks ' + h(st[3]) : '')],
        ['Apparent angle in the front view (XZ)', mangle(st[0]), 'deg'], ['Apparent angle in the side view (YZ)', mangle(st[1]), 'deg']]) +
      mNote('Order matters for two successive tilts: the second tilt is about the axis of the plate that has already been tilted. A sine plate set by its lower and upper angles gives the same face as the swivel and single tilt. Check the result with an indicator along the slope direction before cutting.');
  };
  draw();
}

// ---------- Lathe change gears ----------
const GEAR_STATE = { lsu: 'tpi', ls: 8, tu: 'mm', t: 1.5, fix: 1, gears: '20 25 30 35 40 45 50 55 60 65 70 75 80 127', comp: 1 };
function renderChangeGears(el) {
  const s = GEAR_STATE, W = state.W;
  const draw = () => {
    el.innerHTML = '<p class="desc">Enter your own leadscrew and change gears. BenchMate lists the gear trains that come closest to the thread you want, with the pitch error. Check that each train fits your quadrant (banjo) and that the gears clear the studs.</p><div class="grid">' +
      sfield('Leadscrew', sinp('ls', s.ls) + gsel('lsu', [['tpi', 'TPI'], ['mm', 'mm pitch']], s.lsu), '') + sfield('Thread to cut', sinp('t', s.t) + gsel('tu', [['tpi', 'TPI'], ['mm', 'mm pitch'], ['mod', 'module (worm, lead = pi m)'], ['dp', 'diametral pitch (worm, lead = pi/DP in)']], s.tu), '') +
      sfield('Fixed ratio spindle to stud (1 if equal speed)', sinp('fix', s.fix), '') + sfield('Train', gsel('comp', [[1, 'Simple and compound'], [0, 'Simple only']], s.comp), '') +
      '<label class="f" style="grid-column:1/-1"><span>Change gears you have (tooth counts; list a count twice if you have two)</span><div class="row">' + mtxt('gears', s.gears, 520) + '</div></label></div><div id="gres"></div>';
    gbind(el, s, calc); calc();
  };
  const calc = () => {
    const out = el.querySelector('#gres');
    const lead = (v, unit) => unit === 'tpi' ? 25.4 / v : unit === 'mm' ? v : unit === 'mod' ? Math.PI * v : 25.4 * Math.PI / v;
    const ls = lead(snum(s.ls), s.lsu), tg = lead(snum(s.t), s.tu), fix = snum(s.fix);
    const gears = String(s.gears).split(/[\s,;]+/).filter(Boolean).map(Number).filter(x => x >= 1 && x <= 1000 && Number.isInteger(x));
    const ratio = W.change_gear_ratio(tg, ls, fix);
    if (!isFinite(ratio)) { out.innerHTML = mMsg('Gear trains', 'Enter the leadscrew, the thread and the fixed ratio'); return; }
    if (gears.length < 2) { out.innerHTML = mMsg('Gear trains', 'Enter at least two gears'); return; }
    const n = W.change_gears(toBuf(W, gears), ratio, +s.comp, 15), L = listOut(W, n * 5);
    const showT = v => s.tu === 'tpi' ? fmt(25.4 / v, 4) + ' TPI' : s.tu === 'mm' ? fmt(v, 5) + ' mm' : s.tu === 'mod' ? 'module ' + fmt(v / Math.PI, 5) : 'DP ' + fmt(25.4 * Math.PI / v, 4);
    let h = '<div class="res mtab" style="max-width:760px"><div class="h">Ratio needed ' + fmt(ratio, 6) + ' (driver/driven)</div><table><tr><th>Train</th><th>Ratio</th><th>Thread cut</th><th>Error</th><th>Error over ' + (state.sys === 'inch' ? '1 in' : '25 mm') + '</th></tr>';
    for (let i = 0; i < n; i++) {
      const [a, b, c, d, r] = L.slice(5 * i, 5 * i + 5), got = ls * fix * r, e = r / ratio - 1;
      h += '<tr><td class="v">' + (c ? a + '/' + b + ' × ' + c + '/' + d : a + '/' + b) + '</td><td class="v">' + fmt(r, 6) + '</td><td class="v">' + showT(got) + '</td><td class="v">' + (Math.abs(e) < 1e-12 ? 'exact' : fmt(e * 100, 4) + ' %') + '</td><td class="v">' + (Math.abs(e) < 1e-12 ? '0' : state.sys === 'inch' ? fmt(e, 6) + ' in' : fmt(25 * e, 4) + ' mm') + '</td></tr>';
    }
    out.innerHTML = h + '</table></div>' + mNote('Read a train as driver / driven: a/b is a gear of a teeth on the stud driving b teeth on the leadscrew through any idler; a/b × c/d has b and c on one compound stud. The error over a length is how far the thread drifts from the true pitch over that engaged length. The 127-tooth gear converts exactly between inch and metric (127 = 5 × 25.4).');
  };
  draw();
}

// ---------- Shop economics ----------
const ECO_STATE = { price: '', resale: '', years: '', rate: '', hours: '', fixed: '', kw: '', load: '', kwh: '', labour: '', bf: '', bp: '', bv: '', inv: '', save: '', pn: '', pi: '' };
// Break-even chart: income and total cost against the number of parts. The lines are drawn from the
// inputs to show the shape; the break-even quantity written on it is the core's result.
function ecoChart(bf, bp, bv, q) {
  if (typeof DK === 'undefined') return '';
  const live = isFinite(q) && q > 0 && bf >= 0 && bp > 0 && bv >= 0;
  const F = live ? bf : 3, P = live ? bp : 1, V = live ? bv : 0.4, Q = live ? q : 5;
  const W = 520, H = 250, x0 = 60, x1 = 470, yb = 196, yt = 36, qmax = 2 * Q, cmax = Math.max(P * qmax, F + V * qmax);
  const X = n => x0 + (x1 - x0) * n / qmax, Y = c => yb - (yb - yt) * c / cmax;
  let h = DK.poly([[X(0), Y(F)], [X(Q), Y(P * Q)], [X(0), Y(0)]], 'hatch') + DK.poly([[X(Q), Y(P * Q)], [X(qmax), Y(P * qmax)], [X(qmax), Y(F + V * qmax)]], 'tool');
  h += DK.line(x0, yt - 12, x0, yb, 'thin') + DK.line(x0, yb, x1 + 14, yb, 'thin');
  h += DK.line(X(0), Y(0), X(qmax), Y(P * qmax), 'ln') + DK.line(X(0), Y(F), X(qmax), Y(F + V * qmax), 'hot') + DK.line(X(0), Y(F), X(qmax), Y(F), 'hid');
  h += DK.line(X(Q), Y(P * Q), X(Q), yb, 'hid') + DK.circle(X(Q), Y(P * Q), 3.2, 'hotf');
  h += DK.text(x0 - 8, yt - 16, 'money', { cls: 'mut', anchor: 'start' }) + DK.text(x1 + 14, yb + 16, 'parts', { cls: 'mut', anchor: 'end' });
  h += DK.text(X(qmax) + 4, Y(P * qmax) + 4, 'income', { cls: 'txt', anchor: 'start' }) + DK.text(X(qmax) + 4, Y(F + V * qmax) + 4, 'cost', { cls: 'hott', anchor: 'start' });
  h += DK.text(x0 - 6, Y(F) + 4, live ? fmt(bf, 0) : 'fixed', { cls: 'mut', anchor: 'end' });
  h += DK.text(X(Q), yb + 16, live ? fmt(q, 1) + ' parts' : 'break-even', { cls: 'dimt' });
  h += DK.text(X(Q / 3), Y((F + P * Q) / 3) + 4, 'loss', { cls: 'mut' }) + DK.text(X(Q * 5 / 3), Y((P * Q + P * qmax + F + V * qmax) / 3) + 4, 'profit', { cls: 'hott' });
  h += DK.text(x0, H - 8, live ? 'Fixed cost, then each part adds its margin (price less variable cost).' : 'Enter the fixed cost, the price and the variable cost per part.', { cls: 'mut', anchor: 'start' });
  return DK.svg(W, H, h, 'Break-even chart: income and cost against the number of parts');
}
function renderEconomics(el) {
  const s = ECO_STATE, W = state.W, cur = '(money)';
  el.innerHTML = '<p class="desc">Every input is yours: BenchMate does not suggest prices, rates or lives. Use any one currency throughout.</p>' +
    '<h2>Machine hourly rate</h2><div class="grid">' + sfield('Machine price (installed)', sinp('price', s.price), cur) + sfield('Resale value at the end', sinp('resale', s.resale), cur) + sfield('Years of use', sinp('years', s.years), 'years') +
    sfield('Interest rate (cost of the money)', sinp('rate', s.rate), '% a year') + sfield('Hours run per year', sinp('hours', s.hours), 'h') + sfield('Yearly fixed costs (floor space, service, insurance)', sinp('fixed', s.fixed), cur) +
    sfield('Machine power', sinp('kw', s.kw), 'kW') + sfield('Average load (0 to 1)', sinp('load', s.load), '') + sfield('Electricity price', sinp('kwh', s.kwh), 'per kWh') + sfield('Operator rate', sinp('labour', s.labour), 'per hour') + '</div><div id="eres1"></div>' +
    '<h2>Break-even quantity</h2><div class="grid">' + sfield('Fixed cost of the job (setup, tooling, fixtures)', sinp('bf', s.bf), cur) + sfield('Price per part', sinp('bp', s.bp), cur) + sfield('Variable cost per part (material, machine time)', sinp('bv', s.bv), cur) + '</div><div id="eres2"></div><div class="tdia" id="edia" style="max-width:640px;margin-top:10px"></div>' +
    '<h2>Payback</h2><div class="grid">' + sfield('Investment', sinp('inv', s.inv), cur) + sfield('Net saving per year', sinp('save', s.save), cur) + sfield('Years to compare over', sinp('pn', s.pn), 'years') + sfield('Interest rate', sinp('pi', s.pi), '% a year') + '</div><div id="eres3"></div>';
  gbind(el, s, calc);
  function calc() {
    const v = k => snum(s[k]), m = x => fmt(x, 2);
    const i = (v('rate') || 0) / 100;
    if (v('price') > 0 && v('years') > 0 && v('hours') > 0) {
      const a = [v('price'), v('resale') || 0, v('years'), i, v('hours'), v('fixed') || 0, v('kw') || 0, v('load') || 0, v('kwh') || 0, v('labour') || 0];
      const r = k => W.machine_hourly_rate(...a, k);
      el.querySelector('#eres1').innerHTML = mRes('Per hour run', [['Capital (depreciation and interest)', m(r(1)), 'per h'], ['Fixed costs', m(r(2)), 'per h'], ['Power', m(r(3)), 'per h'], ['Operator', m(v('labour') || 0), 'per h'], ['Machine hourly rate', m(r(0)), 'per h'], ['Capital recovery factor', fmt(W.capital_recovery_factor(i, v('years')), 6), '']]) +
        mNote('Capital per year = (price − resale) × CRF + resale × interest, with CRF = i(1+i)ⁿ / ((1+i)ⁿ − 1): the level yearly payment that repays the price less resale with interest over n years (straight-line depreciation at 0 % interest).');
    } else el.querySelector('#eres1').innerHTML = mMsg('Per hour run', 'Enter the price, years of use and hours run per year');
    const q = W.break_even_qty(v('bf'), v('bp'), v('bv'));
    el.querySelector('#eres2').innerHTML = isFinite(q) && v('bf') >= 0 ? mRes('Break-even', [['Parts to cover the fixed cost', fmt(q, 1), 'parts'], ['Margin per part', m(v('bp') - v('bv')), cur]]) : mMsg('Break-even', 'Enter the fixed cost and a price above the variable cost');
    el.querySelector('#edia').innerHTML = ecoChart(v('bf'), v('bp'), v('bv'), q);
    const pb = W.payback_years(v('inv'), v('save'));
    if (isFinite(pb)) {
      const pi = (v('pi') || 0) / 100, rows = [['Simple payback', fmt(pb, 2), 'years']];
      const dpb = W.discounted_payback_years(v('inv'), v('save'), pi);
      rows.push(['Discounted payback at ' + fmt(pi * 100, 1) + ' %', isFinite(dpb) ? fmt(dpb, 2) : 'never', isFinite(dpb) ? 'years' : '']);
      if (v('pn') > 0) rows.push(['Net present value over ' + fmt(v('pn'), 0) + ' years', m(W.npv(v('inv'), v('save'), v('pn'), pi, 0)), cur]);
      el.querySelector('#eres3').innerHTML = mRes('Payback', rows) + mNote('NPV = saving × (1 − (1+i)⁻ⁿ)/i − investment. Positive means the saving beats leaving the money at that interest rate.');
    } else el.querySelector('#eres3').innerHTML = mMsg('Payback', 'Enter the investment and a yearly saving');
  }
  calc();
}

// ---------- ISO 2768-1 general tolerances ----------
const GT_STATE = { len: '', cls: 'm', short: '' };
async function renderGenTol(el) {
  const R = await loadRef(el); if (!R) return;
  const G = R.iso2768, s = GT_STATE, inch = state.sys === 'inch', u = lenU(state.sys);
  const CL = [['f', 'f (fine)'], ['m', 'm (medium)'], ['c', 'c (coarse)'], ['v', 'v (very coarse)']];
  const rng = r => { const [a, b] = r.split('-'); return b ? (+a ? 'over ' + a + ' to ' + b : 'up to ' + b) : 'over ' + a; };
  const cell = (c, ang) => !c ? '' : (c.value === 'none' ? '<span class="ms">none</span>' : (ang ? amin(+c.value) : '±' + c.value)) + ' ' + badge(c.status);
  const amin = x => '±' + Math.floor(x / 60) + '°' + (x % 60 ? ' ' + (x % 60) + '′' : '');
  // Range 'a-b' holds a < size <= b; the first linear and edge range starts at 0.5 inclusive; 'a-' has no upper end.
  const find = (rows, mm) => rows.find(r => { const [a, b] = r.size.split('-'); return (+a === 0.5 ? mm >= 0.5 : mm > +a) && (b === '' || mm <= +b); });
  el.innerHTML = '<p class="desc">General tolerances for dimensions on a drawing that says "ISO 2768-m" (or f, c, v) and gives no tolerance of its own. Sizes are in millimetres in the standard; in inch mode your size is converted to look up the range.</p><div class="grid">' +
    sfield('Dimension (length, diameter, step)', sinp('len', s.len), u) + sfield('Tolerance class', gsel('cls', CL, s.cls), '') + sfield('Shorter side of an angle (for angles)', sinp('short', s.short), u) + '</div><div id="gres"></div><div id="gtab"></div><div class="note" id="gsrc"></div>';
  gbind(el, s, calc);
  function calc() {
    const k = inch ? IN_MM : 1, L = snum(s.len) * k, sh = snum(s.short) * k, rows = [];
    if (L > 0) {
      const lin = L >= 0.5 ? find(G.linear, L) : null, ed = L >= 0.5 ? find(G.edge, L) : null;
      if (!lin && L < 0.5) rows.push(['Below 0.5 mm the standard gives no general tolerance: the drawing must state one', '', '']);
      else if (!lin) rows.push(['Above 4000 mm: not covered by ISO 2768-1', '', '']);
      if (lin) { const c = lin[s.cls]; rows.push(['Linear dimension, range ' + rng(lin.size) + ' mm', c.value === 'none' ? 'no value for class ' + s.cls : '±' + c.value + ' mm' + (inch ? ' (±' + fmt(+c.value / IN_MM, 4) + ' in)' : ''), '', '']);
        if (c.value !== 'none') rows.push(['Limits', fmt((L - +c.value) / k, gdp()) + ' to ' + fmt((L + +c.value) / k, gdp()), u]); }
      if (ed) { const c = ed[s.cls]; rows.push(['If it is an outside radius or chamfer height (' + rng(ed.size) + ' mm)', '±' + c.value + ' mm' + (inch ? ' (±' + fmt(+c.value / IN_MM, 4) + ' in)' : ''), '']); }
    }
    if (sh > 0) { const an = find(G.angle_min, sh); if (an) { const c = an[s.cls]; rows.push(['Angle, shorter side ' + rng(an.size) + ' mm', amin(+c.value), '', '']); rows.push(['Same, as an offset at the end of the shorter side', '±' + fmt(sh * Math.tan(+c.value / 60 * Math.PI / 180) / k, gdp()), u]); } }
    el.querySelector('#gres').innerHTML = rows.length ? mRes('ISO 2768-' + s.cls, rows) : mMsg('ISO 2768-' + s.cls, 'Enter a dimension or the shorter side of an angle');
  }
  const tab = (h, rows, ranges, ang) => '<div class="res mtab" style="max-width:760px;margin-top:12px"><div class="h">' + h + '</div><table><tr><th>Range (mm)</th>' + CL.map(c => '<th>' + c[1] + '</th>').join('') + '</tr>' +
    rows.map(r => '<tr><td>' + rng(r.size) + '</td>' + CL.map(c => '<td>' + cell(r[c[0]], ang) + '</td>').join('') + '</tr>').join('') + '</table></div>';
  el.querySelector('#gtab').innerHTML = tab('Linear dimensions (except broken edges)', G.linear, G.linear_ranges) + tab('Broken edges: outside radii and chamfer heights', G.edge, G.edge_ranges) + tab('Angles, by the length of the shorter side', G.angle_min, G.angle_ranges, true);
  el.querySelector('#gsrc').innerHTML = '<b>Standard:</b> ' + rEsc(G.standard.number) + ', ' + rEsc(G.standard.status) + ' (' + rEsc(G.standard.url) + ', checked ' + rEsc(G.standard.checked) + '). Values below as printed by free publishers, each cell with the number that agree:<br>' +
    Object.values(G.sources).map(x => '<b>' + rEsc(x.publisher) + '</b>: ' + rEsc(x.title) + ' (' + rEsc(x.url) + ', accessed ' + rEsc(x.accessed) + '). ' + rEsc(x.note)).join('<br>');
  calc();
}

// ---------- Micrometer and vernier reading aid ----------
const SC_STATE = { kind: 0, val: 7.38, show: 0 };
const SC_KINDS = [[0, 'Metric micrometer, 0.01 mm'], [1, 'Metric micrometer with vernier, 0.001 mm'], [2, 'Inch micrometer, 0.001 in'], [3, 'Inch micrometer with vernier, 0.0001 in'], [4, 'Vernier caliper, 0.02 mm'], [5, 'Vernier caliper, 0.05 mm'], [6, 'Inch vernier caliper, 0.001 in']];
function scaleSvg(W, kind, val, show) {
  const [res, step, thim, ver] = [0, 1, 2, 3].map(i => W.scale_spec(kind, i)), r = [0, 1, 2, 3, 4].map(i => W.scale_reading(kind, val, i));
  const inch = kind === 2 || kind === 3 || kind === 6, dec = inch ? 4 : 3;
  let s = '';
  const ln = (x1, y1, x2, y2, cls) => '<path class="' + (cls || 'gp') + '" d="M' + x1.toFixed(1) + ' ' + y1.toFixed(1) + 'L' + x2.toFixed(1) + ' ' + y2.toFixed(1) + '"/>';
  if (thim > 0) {
    // Micrometer: sleeve on the left with the reference line, thimble edge at the reading.
    const x0 = 40;
    const xs = v => x0 + (v - Math.max(0, r[1] - (inch ? 0.2 : 7))) / step * (inch ? 15 : 12);
    const lo = Math.max(0, r[1] - (inch ? 0.2 : 7)), ex = xs(r[0]), yRef = 90;
    s += '<rect class="gsoft" x="20" y="60" width="' + (ex - 20).toFixed(1) + '" height="60"/>' + ln(20, yRef, ex, yRef);
    for (let i = 0; lo + i * step <= r[0] + 1e-9; i++) {
      const v = lo + i * step, x = xs(v), major = inch ? Math.abs(v * 10 - Math.round(v * 10)) < 1e-6 : Math.abs(v - Math.round(v)) < 1e-6;
      const up = inch ? true : major;
      s += ln(x, yRef, x, up ? yRef - (major ? 16 : 10) : yRef + 10);
      if (major && (inch || Math.round(v) % 5 === 0)) s += gtxt([x, yRef - 20], inch ? String(Math.round(v * 10) % 10) : String(Math.round(v)), 'gs', 'middle');
    }
    // thimble
    const tw = 150, tx = ex, pitch = 9;
    s += '<rect class="gfill" x="' + tx.toFixed(1) + '" y="40" width="' + tw + '" height="100"/><path class="gp" d="M' + tx.toFixed(1) + ' 40L' + tx.toFixed(1) + ' 140"/>';
    const frac = (r[0] - r[1]) / res / (thim > 0 ? (step / res) / thim : 1); // thimble divisions past the line (can be fractional with vernier)
    for (let k = -5; k <= 5; k++) {
      const div = Math.floor(frac) + k, y = yRef - (div - frac) * pitch;
      if (y < 44 || y > 136) continue;
      const dn = ((div % thim) + thim) % thim, long = dn % 5 === 0;
      s += ln(tx, y, tx + (long ? 18 : 11), y);
      if (long) s += gtxt([tx + 22, y + 4], String(dn), 'gs');
    }
    if (ver > 0) {
      // Vernier on the sleeve: 10 lines spaced 9/10 of a thimble division; line r[4] coincides.
      const vx = 20, vy = 160, vp = 30;
      s += gtxt([vx, vy - 6], 'Thimble lines (top), sleeve vernier 0 to 9 (below)', 'gs');
      const off = (frac - Math.floor(frac));
      for (let k = 0; k <= 10; k++) { s += ln(vx + k * vp * 0.9 + 40, vy + 20, vx + k * vp * 0.9 + 40, vy + 36, show && k === r[4] ? 'gw' : 'gp'); if (k < 10) s += gtxt([vx + k * vp * 0.9 + 40, vy + 48], String(k), 'gs', 'middle'); }
      for (let k = -1; k <= 11; k++) { const x = vx + 40 + (k - off) * vp; if (x > vx + 30 && x < vx + 40 + 10 * vp) s += ln(x, vy + 4, x, vy + 20, 'gm'); }
      return gsvg(420, 216, s, 'Micrometer scale');
    }
    return gsvg(420, 160, s, 'Micrometer scale');
  }
  // Caliper: main scale above, vernier plate below, zero of the vernier at the reading.
  const m = kind === 5 ? 2 : 1, sp = m * step - res, N = ver, x0 = 20, k = 340 / (N * sp + step * 4);
  const lo = Math.floor(r[0] / step) * step - step * 2, X = v => x0 + (v - lo) * k;
  const yM = 70;
  s += '<rect class="gsoft" x="10" y="30" width="400" height="40"/><rect class="gfill" x="' + (X(r[0]) - 8).toFixed(1) + '" y="70" width="' + (N * sp * k + 16).toFixed(1) + '" height="40"/>';
  for (let v = lo; v <= lo + (N * sp + step * 5); v += step) {
    const x = X(v); if (x < 10 || x > 410) continue;
    const t = Math.round(v / step), major = inch ? t % 4 === 0 : t % 10 === 0, mid = inch ? false : t % 5 === 0;
    s += ln(x, yM, x, yM - (major ? 18 : mid ? 13 : 9));
    if (major) s += gtxt([x, yM - 22], inch ? String(Math.round(v * 10) / 10) : String(Math.round(v / 10)), 'gs', 'middle');
  }
  for (let j = 0; j <= N; j++) {
    const x = X(r[0]) + j * sp * k, long = inch ? j % 5 === 0 : (N === 50 ? j % 5 === 0 : j % 2 === 0);
    s += ln(x, yM, x, yM + (long ? 16 : 10), show && j === r[4] ? 'gw' : 'gp');
    if (show && j === r[4]) s += '<path class="gdot" d="M' + x.toFixed(1) + ' ' + (yM + 33) + 'l-4 7h8z"/>';
    if (long && (N !== 50 || j % 10 === 0)) s += gtxt([x, yM + 28], inch ? String(j) : String(N === 50 ? j / 5 : j * 5 / 10), 'gs', 'middle');
  }
  return gsvg(420, 132, s, 'Vernier caliper scale');
}
function renderScales(el) {
  const s = SC_STATE, W = state.W;
  const draw = () => {
    el.innerHTML = '<p class="desc">A reading aid: pick an instrument and a value (or a random one), read the scales yourself, then show the breakdown to check. Nothing is scored.</p><div class="grid">' +
      sfield('Instrument', gsel('kind', SC_KINDS, s.kind), '') + sfield('Reading to show', sinp('val', s.val), [2, 3, 6].includes(+s.kind) ? 'in' : 'mm') +
      '<label class="f"><span>&nbsp;</span><div class="row"><button class="btn" id="scnew">New random reading</button> <button class="btn" id="scshow">' + (s.show ? 'Hide the breakdown' : 'Show the breakdown') + '</button></div></label></div><div id="scsvg"></div><div id="scres"></div>';
    el.querySelector('[data-k="kind"]').onchange = e => { s.kind = +e.target.value; const sp = [0, 1, 2, 3].map(i => W.scale_spec(s.kind, i)); s.val = rnd(sp); s.show = 0; draw(); };
    el.querySelector('[data-k="val"]').oninput = e => { s.val = e.target.value; s.show = 0; calc(); el.querySelector('#scshow').textContent = 'Show the breakdown'; };
    el.querySelector('#scnew').onclick = () => { const sp = [0, 1, 2, 3].map(i => W.scale_spec(s.kind, i)); s.val = rnd(sp); s.show = 0; draw(); };
    el.querySelector('#scshow').onclick = () => { s.show = s.show ? 0 : 1; draw(); };
    calc();
  };
  const rnd = sp => { const max = sp[2] > 0 ? (sp[1] === 0.5 ? 25 : 1) : (sp[1] === 1 ? 150 : 6); const units = Math.floor(Math.random() * Math.round(max / sp[0])); return +(units * sp[0]).toFixed(sp[0] < 0.001 ? 4 : sp[0] < 0.01 ? 3 : 2); };
  const calc = () => {
    const v = snum(s.val), out = el.querySelector('#scres'), k = +s.kind, inch = [2, 3, 6].includes(k), u = inch ? 'in' : 'mm';
    if (!(v >= 0)) { el.querySelector('#scsvg').innerHTML = ''; out.innerHTML = mMsg('Reading', 'Enter a reading of 0 or more'); return; }
    const r = [0, 1, 2, 3, 4].map(i => W.scale_reading(k, v, i)), sp = [0, 1, 2, 3].map(i => W.scale_spec(k, i)), dp = inch ? 4 : 3;
    el.querySelector('#scsvg').innerHTML = scaleSvg(W, k, v, s.show);
    if (!s.show) { out.innerHTML = mNote('Read the scale, then press "Show the breakdown" to mark the vernier line that lines up and see the sum.'); return; }
    const rows = [['Main scale (last line passed)', fmt(r[1], dp), u]];
    if (sp[2] > 0) rows.push(['Thimble: division ' + r[3] + ' × ' + fmt(sp[1] / sp[2], dp), fmt(r[3] * sp[1] / sp[2], dp), u]);
    if (sp[3] > 0) rows.push(['Vernier: line ' + r[4] + ' × ' + fmt(sp[0], dp), fmt(r[4] * sp[0], dp), u]);
    rows.push(['Reading', fmt(r[0], dp), u]);
    out.innerHTML = mRes('Breakdown', rows) + (Math.abs(r[0] - v) > 1e-9 ? mNote('Shown to the instrument\'s resolution of ' + fmt(sp[0], dp) + ' ' + u + '.') : '');
  };
  draw();
}

// ---------- Drawing abbreviations ----------
// SI prefixes, SI defining constants, Greek alphabet. Reference only: every value shown is as the publishers print it.
async function renderSymbols(el) {
  const R = await loadRef(el); if (!R) return;
  const S = R.symbols, pub = k => (S.sources[k] || {}).publisher || k;
  const pow = n => '10<sup>' + (n < 0 ? '−' + (-n) : n) + '</sup>';
  const val = v => rEsc(v).replace(/10\^(-?)(\d+)/, (m, sg, d) => '10<sup>' + (sg ? '−' : '') + d + '</sup>');
  const names = r => { const ns = [...new Set(Object.values(r.printed).map(p => p[0]))]; return ns.length > 1 ? ns.map(rEsc).join(' or ') : rEsc(r.name); };
  const un = v => rEsc(v).replace(/\^(-?)(\d+)/g, (m, sg, d) => '<sup>' + (sg ? '−' : '') + d + '</sup>').replace(/([A-Za-z])2\b/g, '$1²');
  const by = keys => '<span class="ms">' + [...new Set(keys.map(pub))].map(rEsc).join(', ') + '</span>';
  el.innerHTML = '<p class="desc">The two systems of units and how they are tied together, the SI base and derived units, the prefixes that scale an SI unit, the seven constants that define the SI, mathematical signs, the letters used for quantities, and the Greek letters with what each stands for in BenchMate\'s formulas. Nothing is calculated here.</p>' +
    '<h3>Systems of units</h3><div class="res mtab" id="symsys" style="max-width:760px"><table><tr><th>Topic</th><th>In our words</th><th>Listed by</th></tr>' +
    S.systems.map(r => '<tr><td><b>' + rEsc(r.topic) + '</b></td><td>' + rEsc(r.text) + '</td><td>' + badge(r.status) + ' ' + by(r.src) + '</td></tr>').join('') + '</table></div>' +
    '<div class="note">To change a value from one system to the other use the <a href="#/t/units">Unit converter</a>; its factors are the exact ones where an exact one exists.</div>' +
    '<h3>The seven SI base units</h3><div class="res mtab" id="symbase" style="max-width:640px"><table><tr><th>Quantity</th><th>Unit</th><th>Symbol</th><th>Listed by</th></tr>' +
    S.base.map(r => '<tr><td>' + rEsc(r.quantity) + '</td><td>' + rEsc(r.name) + '</td><td class="v"><b>' + rEsc(r.sym) + '</b></td><td>' + badge(r.status) + ' ' + by(Object.keys(r.printed)) + '</td></tr>').join('') + '</table></div>' +
    '<div class="note">NIST prints the US spelling meter; Wikipedia prints metre. They are the same unit.</div>' +
    '<h3>The 22 SI derived units with a name of their own</h3><div class="res mtab" id="symder" style="max-width:760px"><table><tr><th>Quantity</th><th>Unit</th><th>Symbol</th><th>Equal to</th><th>Listed by</th></tr>' +
    S.derived.map(r => '<tr><td>' + rEsc(r.quantity) + '</td><td>' + rEsc(r.name) + '</td><td class="v"><b>' + rEsc(r.sym) + '</b></td><td class="v">' + (r.other ? un(r.other) : un(r.base) + ' <span class="ms">(base units, NIST)</span>') + '</td><td>' + badge(r.status) + ' ' + by(r.publishers) + '</td></tr>').join('') + '</table></div>' +
    '<div class="note">The ones a shop meets: newton (force), pascal (pressure and stress; 1 MPa = 1 N/mm²), joule (energy), watt (power), hertz (frequency) and the degree Celsius. A step of one degree Celsius is the same size as one kelvin.</div>' +
    '<h3>SI prefixes</h3><div class="res mtab" id="sympre" style="max-width:640px"><table><tr><th>Prefix</th><th>Symbol</th><th>Factor</th><th>Listed by</th></tr>' +
    S.prefixes.map(r => '<tr><td>' + names(r) + '</td><td class="v"><b>' + rEsc(r.sym) + '</b></td><td class="v">' + pow(r.exp) + '</td><td>' + badge(r.status) + ' <span class="ms">' + Object.keys(r.printed).map(pub).map(rEsc).join(', ') + '</span></td></tr>').join('') + '</table></div>' +
    '<div class="note">A prefix joins the unit with no space: 5 µm, 3 kN, 40 MPa. Upper and lower case matter: m is milli and M is mega, k (kilo) is lower case. The prefix for 10 is printed deca by BIPM and deka by NIST. In machining, µm (micrometre, "micron") is 0.001 mm and µin (microinch) is 0.000001 in.</div>' +
    '<h3>The seven defining constants of the SI</h3><div class="res mtab" id="symcon" style="max-width:760px"><table><tr><th>Constant</th><th>Symbol</th><th>Value (exact)</th><th>Unit</th><th>Listed by</th></tr>' +
    S.constants.map(r => '<tr><td>' + rEsc(r.name) + '</td><td class="v">' + rEsc(r.sym) + '</td><td class="v">' + val(r.value) + '</td><td class="u">' + rEsc(r.unit) + '</td><td>' + badge(r.status) + ' <span class="ms">' + r.publishers.map(pub).map(rEsc).join(', ') + '</span></td></tr>').join('') + '</table></div>' +
    '<div class="note">Since 2019 every SI unit is defined by fixing these seven values. The value used most in a shop is not one of them: the standard acceleration of gravity, 9.806 65 m/s² exactly, which turns kilograms-force and pounds-force into newtons (NIST SP 811; it is the "g" in the unit converter).</div>' +
    '<h3>Mathematical signs</h3><div class="res mtab" id="symsig" style="max-width:640px"><table><tr><th>Sign</th><th>Read as</th><th>Listed by</th></tr>' +
    S.signs.map(r => '<tr><td class="v"><b>' + rEsc(r.sign) + '</b></td><td>' + rEsc(r.meaning) + '</td><td>' + badge(r.status) + ' ' + by(r.src) + '</td></tr>').join('') + '</table></div>' +
    '<h3>Letters used for quantities</h3><div class="res mtab" id="symqty" style="max-width:760px"><table><tr><th>Quantity</th><th>Letter</th><th>SI unit</th><th>Listed by</th></tr>' +
    S.quantities.map(r => '<tr><td>' + rEsc(r.quantity) + (r.who ? '<div class="ms">' + rEsc(r.who) + '</div>' : '') + '</td><td class="v"><b>' + rEsc(r.sym) + '</b></td><td class="u">' + rEsc(r.unit) + '</td><td>' + badge(r.status) + ' ' + by(r.src) + '</td></tr>').join('') + '</table></div>' +
    '<div class="note">These letters are habits, not rules: one letter serves several quantities (T is period, temperature and, for some, torque) and books differ, as the rows marked "sources differ" show. Always read the legend of the formula in front of you.</div>' +
    '<h3>Greek alphabet</h3><div class="res mtab" id="symgrk" style="max-width:760px"><table><tr><th>Name</th><th>Capital</th><th>Small</th><th>In BenchMate\'s formulas</th><th>Listed by</th></tr>' +
    S.greek.map(r => '<tr><td>' + rEsc(r.name) + '</td><td class="v">' + rEsc(r.upper) + '</td><td class="v">' + rEsc(r.lower) + '</td><td>' + (r.used ? rEsc(r.used) : '<span class="ms">not used</span>') + '</td><td>' + badge(r.status) + '</td></tr>').join('') + '</table></div>' +
    '<div class="note">The meanings are how BenchMate\'s own formula library uses each letter; other books use some letters differently, so read the legend of the formula in front of you. The diameter sign ⌀ on a drawing is not the Greek letter phi.</div>' +
    '<div class="note"><b>Sources:</b><br>' + sourceList(S.sources) + '</div>';
}
const AB_STATE = { q: '', cat: '' };
async function renderAbbrev(el) {
  const R = await loadRef(el); if (!R) return;
  const A = R.abbrev, s = AB_STATE;
  const cats = [['', 'All'], ['holes', 'Holes'], ['size', 'Sizes and dimensions'], ['features', 'Features and threads'], ['inspection', 'Inspection and GD&T'], ['material', 'Materials and hardness'], ['finish', 'Finish'], ['general', 'General']];
  el.innerHTML = '<p class="desc">Common abbreviations on engineering drawings, in BenchMate\'s own words. Practice varies between companies and countries (ASME Y14.38 in the US; ISO 128 and national standards elsewhere): when a drawing has its own list, that list wins.</p><div class="mfilter"><input type="search" data-k="q" placeholder="Search: CSK, thread, spotface..." value="' + sesc(s.q) + '" style="width:260px">' + gsel('cat', cats, s.cat) + '</div><div id="abres"></div><div class="note" id="absrc"></div>';
  const pub = k => (A.sources[k] || {}).publisher || k;
  function calc() {
    const q = String(s.q || '').trim().toLowerCase();
    const rows = A.rows.filter(r => (!s.cat || r.cat === s.cat) && (!q || (r.ab + ' ' + r.own).toLowerCase().includes(q)));
    el.querySelector('#abres').innerHTML = '<div class="res mtab" style="max-width:760px"><table><tr><th>Abbreviation</th><th>Meaning</th><th>Listed by</th></tr>' +
      rows.map(r => '<tr><td class="v"><b>' + rEsc(r.ab) + '</b></td><td>' + rEsc(r.own) + '</td><td>' + badge(r.status) + '<div class="ms" title="' + rEsc(Object.entries(r.printed).map(([k, v]) => pub(k) + ': ' + v).join('\n')) + '">' + rEsc(Object.keys(r.printed).map(pub).join(', ')) + '</div></td></tr>').join('') + '</table></div>' +
      '<p class="desc">' + rows.length + ' of ' + A.rows.length + ' shown. Hover the publishers to see how each prints the meaning.</p>';
  }
  el.querySelector('[data-k="q"]').oninput = e => { s.q = e.target.value; calc(); };
  el.querySelector('[data-k="cat"]').onchange = e => { s.cat = e.target.value; calc(); };
  el.querySelector('#absrc').innerHTML = '<b>Standards (by name only):</b> ASME Y14.38 (abbreviations and acronyms for use on drawings and related documents), ISO 128 series (technical product documentation, general principles of representation).<br>' + Object.values(A.sources).map(x => '<b>' + rEsc(x.publisher) + '</b>: ' + rEsc(x.title) + ' (' + rEsc(x.url) + ', accessed ' + rEsc(x.accessed) + '). ' + rEsc(x.note)).join('<br>');
  calc();
}
