'use strict';
// G-code cycle generators: drilling and tapping, thread milling, lathe
// threading (G76 / G92 with infeed table), taper, groove and cut-off, keyway
// broaching, G71/G70 profile. The program text, the moves and the times all
// come from the Rust core (core/src/gcode.rs); this file reads the inputs,
// converts units, draws the backplot and offers the downloads.
// Uses helpers from shop.js (sesc, snum, sinp, sfield, stable) and
// geometry.js (gsel, gfit, gsvg, gpt, toBuf, listOut, numsFrom).

const CYC = { DRILL: 1, TMILL: 2, G76: 3, G92: 4, TAPER: 5, GROOVE: 6, BROACH: 7, G71: 8 };
const CTRLS = [[0, 'Generic ISO 6983 / Fanuc-style'], [1, 'Haas'], [2, 'Mitsubishi M70/M80'], [3, 'Siemens 840D (ISO mode)'], [4, 'Heidenhain (ISO)'], [5, 'Okuma OSP']];
const CYS = {};   // per tool and unit system: input values (strings as typed)
const cyInch = () => state.sys === 'inch';
const cyU = () => lenU(state.sys);

function cyState(id, defs) {
  const key = id + ':' + state.sys;
  if (!CYS[key]) CYS[key] = defs(cyInch());
  return CYS[key];
}

// One input row. f: {k, label, unit, sel: [[v, t]], area: rows, show: s => bool}
function cyField(f, s) {
  if (f.sel) {
    const opts = typeof f.sel === 'function' ? f.sel(s) : f.sel;
    return sfield(f.label, '<select data-k="' + f.k + '" data-redraw="1">' + opts.map(([v, t, dis]) => '<option value="' + v + '"' + (String(v) === String(s[f.k]) ? ' selected' : '') + (dis ? ' disabled' : '') + '>' + sesc(t) + '</option>').join('') + '</select>', f.unit || '');
  }
  if (f.area) return '<label class="f" style="grid-column:1/-1"><span>' + f.label + '</span><textarea data-k="' + f.k + '" rows="' + f.area + '" spellcheck="false" style="width:100%;font-family:var(--mono);border:1px solid var(--line);border-radius:var(--r);background:var(--panel);padding:6px;box-sizing:border-box">' + sesc(s[f.k]) + '</textarea></label>';
  return sfield(f.label, sinp(f.k, s[f.k], 110), typeof f.unit === 'function' ? f.unit(s) : (f.unit || ''));
}

const ctrlField = cycle => ({ k: 'ctrl', label: 'Control (output dialect)', sel: s => CTRLS.map(([v, t]) => [v, state.W && !state.W.cyc_supported(v, typeof cycle === 'function' ? cycle(s) : cycle) ? t + ' (not yet supported)' : t, state.W && !state.W.cyc_supported(v, typeof cycle === 'function' ? cycle(s) : cycle)]) });
const commonHead = (cycle) => [ctrlField(cycle), { k: 'prog', label: 'Program number (O)', unit: '' }, { k: 'tool', label: 'Tool number', unit: '' }];
const rapidField = { k: 'rapid', label: 'Rapid rate (blank = active machine)', unit: () => cyInch() ? 'in/min' : 'mm/min' };
const spindleFields = [
  { k: 'css', label: 'Spindle', sel: [[1, 'Constant surface speed (G96)'], [0, 'Fixed rpm (G97)']] },
  { k: 'v', label: 'Surface speed', unit: () => cyInch() ? 'SFM' : 'm/min', show: s => +s.css === 1 },
  { k: 'vmax', label: 'Max spindle speed (G50 clamp)', unit: 'RPM', show: s => +s.css === 1 },
  { k: 'rpm', label: 'Spindle speed', unit: 'RPM', show: s => +s.css !== 1 },
];
const spParams = s => [+s.css === 1 ? 1 : 0, snum(s.v), snum(s.vmax), snum(s.rpm)];

// Generic screen: draws the form, runs the generator on every change.
function cyScreen(el, id, defs, fields, build, extra) {
  const s = cyState(id, defs);
  const draw = () => {
    el.innerHTML = '<div class="grid">' + fields.filter(f => !f.show || f.show(s)).map(f => cyField(f, s)).join('') + '</div><div id="cyx"></div><div id="cyout"></div>';
    el.querySelectorAll('[data-k]').forEach(i => {
      i.oninput = i.onchange = () => {
        if (s[i.dataset.k] === i.value) return;
        s[i.dataset.k] = i.value;
        const f = fields.find(x => x.k === i.dataset.k);
        if (f && f.on) f.on(s, cyInch());
        if (i.dataset.redraw) { const y = window.scrollY; draw(); window.scrollTo(0, y); } else calc();
      };
    });
    calc();
  };
  const calc = () => {
    const out = el.querySelector('#cyout'), xb = el.querySelector('#cyx');
    let job;
    try { job = build(s); } catch (e) { job = { error: e.message }; }
    if (job.error) { xb.innerHTML = ''; out.innerHTML = '<div class="res">' + stable('Program', [[sesc(job.error), '', '']]) + '</div>'; return; }
    const res = cyRun(job.cycle, job.params);
    xb.innerHTML = extra ? extra(s, res, job) : '';
    cyOutput(out, s, res, job);
  };
  draw();
}

function cyStr(W, len) { return new TextDecoder().decode(new Uint8Array(W.memory.buffer, W.str_ptr(), len)); }

function cyRun(cycle, params) {
  const W = state.W;
  const n = toBuf(W, params.map(x => (x === '' || x === undefined) ? NaN : +x));
  const ok = W.cyc_run(cycle, n) === 1;
  const r = { ok, cycle };
  if (!ok) { r.err = cyStr(W, W.cyc_text(1)); return r; }
  r.text = cyStr(W, W.cyc_text(0));
  const wl = W.cyc_text(2); r.warns = wl ? cyStr(W, wl).split('\n') : [];
  r.start = [W.cyc_info(2), W.cyc_info(3), W.cyc_info(4)];
  r.maxRpm = W.cyc_info(0); r.maxFeed = W.cyc_info(1);
  r.moves = []; const nm = W.cyc_moves();
  for (let i = 0; i < nm; i++) { const m = []; for (let k = 0; k < 8; k++) m.push(W.cyc_move(i, k)); r.moves.push(m); }
  r.table = []; const nt = W.cyc_info(5); for (let i = 0; i < nt; i++) r.table.push(W.cyc_table(i));
  r.time = rapid => [0, 1, 2].map(k => W.cyc_time(rapid, k));
  return r;
}

function cyRapid(s) {
  const v = snum(s.rapid); if (v > 0) return { v, from: 'entered' };
  const m = Profiles.active(); const pr = m ? +m.rapid : NaN;
  if (pr > 0) return { v: cyInch() ? pr / 25.4 : pr, from: m.name };
  return { v: NaN, from: '' };
}

const cyClock = sec => { if (!isFinite(sec)) return 'n/a'; const m = Math.floor(sec / 60), x = sec - 60 * m; return m + ':' + (x < 10 ? '0' : '') + x.toFixed(1); };

function cyChecks(res) {
  const m = Profiles.active(), rows = [];
  if (!m) return rows;
  const n = v => (v === '' || v == null) ? NaN : +v;
  if (res.maxRpm > 0) {
    const over = n(m.rpm_max) > 0 && res.maxRpm > n(m.rpm_max) + 0.5;
    rows.push(['Highest spindle speed in the program', fmt(res.maxRpm, 0), 'RPM', over ? 'Above ' + sesc(m.name) + ' max ' + n(m.rpm_max) + ' RPM' : '']);
  }
  if (res.maxFeed > 0) {
    const mm = cyInch() ? res.maxFeed * 25.4 : res.maxFeed;
    const over = n(m.feed_max) > 0 && mm > n(m.feed_max) + 1e-6;
    rows.push(['Highest cutting feed in the program', fmt(res.maxFeed, cyInch() ? 2 : 0), feedMinU(state.sys), over ? 'Above ' + sesc(m.name) + ' max feed ' + n(m.feed_max) + ' mm/min' : '']);
  }
  return rows;
}

// Backplot: XY for the mill, Z (horizontal) against radius X for the lathe.
function cyPlot(res, lathe) {
  const segs = []; // [kind, [[x,y],...]]
  let p = lathe ? [res.start[2], res.start[0]] : [res.start[0], res.start[1]];
  const pts = [p];
  const dots = [];
  for (const m of res.moves) {
    const [kind, x, y, z, cx, cy] = m;
    if (kind === 4) continue;
    const q = lathe ? [z, x] : [x, y];
    if (kind === 2 || kind === 3) {
      let a0 = Math.atan2(p[1] - cy, p[0] - cx), a1 = Math.atan2(q[1] - cy, q[0] - cx), r = Math.hypot(q[0] - cx, q[1] - cy);
      let sw = kind === 3 ? a1 - a0 : a0 - a1;
      while (sw <= 1e-9) sw += 2 * Math.PI;
      const nseg = Math.max(8, Math.ceil(sw / (2 * Math.PI) * 72)), poly = [];
      for (let i = 0; i <= nseg; i++) { const a = a0 + (kind === 3 ? 1 : -1) * sw * i / nseg; poly.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
      segs.push([1, poly]); pts.push(...poly);
    } else if (Math.hypot(q[0] - p[0], q[1] - p[1]) > 1e-9) {
      segs.push([kind, [p, q]]); pts.push(q);
    } else if (!lathe && kind === 1) dots.push(q);
    p = q;
  }
  if (lathe) pts.push([pts[0][0], 0]);
  const Wd = 560, Hd = 300, f = gfit(pts, Wd, Hd, 22), P = f.P;
  let h = '';
  if (lathe) { const a = P([Math.min(...pts.map(t => t[0])), 0]), b = P([Math.max(...pts.map(t => t[0])), 0]); h += '<path class="gm" stroke-dasharray="8 3 2 3" d="M' + gpt(a) + 'L' + gpt(b) + '"/>'; }
  const o = P([0, 0]); h += '<path class="gm" d="M' + gpt([o[0] - 6, o[1]]) + 'L' + gpt([o[0] + 6, o[1]]) + 'M' + gpt([o[0], o[1] - 6]) + 'L' + gpt([o[0], o[1] + 6]) + '"/>';
  segs.forEach(([k, poly]) => { h += '<path class="' + (k === 0 ? 'grap' : 'gc') + '" d="M' + poly.map(t => gpt(P(t))).join('L') + '"/>'; });
  const seen = new Set();
  dots.forEach(d => { const key = d[0].toFixed(4) + ',' + d[1].toFixed(4); if (seen.has(key)) return; seen.add(key); const q = P(d); h += '<circle class="gp" cx="' + q[0].toFixed(1) + '" cy="' + q[1].toFixed(1) + '" r="3.5"/>'; });
  const st = P(lathe ? [res.start[2], res.start[0]] : [res.start[0], res.start[1]]);
  h += '<circle class="gdot" cx="' + st[0].toFixed(1) + '" cy="' + st[1].toFixed(1) + '" r="3"/>';
  h += '<text class="gs" x="8" y="' + (Hd - 8) + '">' + (lathe ? 'Z horizontal, X (radius) up' : 'XY plane, seen from +Z') + '</text>';
  return '<svg class="geo cyplot" viewBox="0 0 ' + Wd + ' ' + Hd + '" role="img" aria-label="Toolpath backplot" style="max-width:560px">' + h + '</svg>' +
    '<p class="ms"><span class="gkey gkp" style="border-color:var(--accent)"></span> feed &nbsp; <span class="gkey" style="border-top:1px dashed var(--muted)"></span> rapid &nbsp; dot = start. ' + (lathe ? 'Only the side above the centreline is drawn.' : 'Circles mark holes.') + '</p>';
}

// Through saveFile (app.js) so the desktop app shows a native save dialog.
function cyDownload(name, text, type) { saveFile(name, text, type || 'text/plain'); }

function cyOutput(out, s, res, job) {
  if (!res.ok) { out.innerHTML = '<div class="res">' + stable('Program', [[sesc(res.err), '', '']]) + '</div>'; return; }
  const rp = cyRapid(s), t = res.time(rp.v), tot = t[0] + (isFinite(t[1]) ? t[1] : 0) + t[2];
  const rows = [['Cutting (feed) time', cyClock(t[0]), 'min:s'], ['Dwell time', cyClock(t[2]), 'min:s']];
  if (rp.v > 0) rows.push(['Rapid time at ' + fmt(rp.v, 0) + ' ' + feedMinU(state.sys) + ' (' + sesc(rp.from) + ')', cyClock(t[1]), 'min:s'], ['Estimated cycle time', cyClock(tot), 'min:s']);
  else rows.push(['Rapid time', 'enter rapid', '', 'No rapid rate: enter one, or add it to the active machine profile']);
  const checks = cyChecks(res);
  const prog = 'O' + (s.prog || '0');
  out.innerHTML = cyPlot(res, job.lathe) +
    '<div class="res" style="margin-top:10px">' + stable('Estimate (no tool change, acceleration or block processing time)', rows) + '</div>' +
    (checks.length ? '<div class="res" style="margin-top:10px">' + stable('Active machine check', checks) + '</div>' : '') +
    (res.warns.length ? '<div class="res" style="margin-top:10px">' + stable('Check before running', res.warns.map(w => [sesc(w), '', ''])) + '</div>' : '') +
    '<div class="mfilter" style="margin-top:12px"><button class="btn" id="cycopy">Copy program</button><button class="btn" id="cydl">Download ' + sesc(prog) + '.nc</button>' + (job.csv ? '<button class="btn" id="cycsv">Download hole CSV</button>' : '') + '</div>' +
    '<pre class="gcode" id="cytext"></pre>';
  out.querySelector('#cytext').textContent = res.text;
  out.querySelector('#cycopy').onclick = () => { try { navigator.clipboard.writeText(res.text); } catch (e) {} };
  out.querySelector('#cydl').onclick = () => cyDownload(prog + '.nc', res.text);
  if (job.csv) out.querySelector('#cycsv').onclick = () => cyDownload('holes.csv', job.csv(), 'text/csv');
}

const cyHead = (s, metric) => [metric ? 1 : 0, +s.ctrl, snum(s.prog), snum(s.tool)];

// ---------- Drilling and tapping (mill) ----------
function cyHoles(s) {
  const W = state.W, h = [];
  if (s.pat === 'bolt') {
    const n = Math.round(snum(s.bn)), d = snum(s.bd);
    if (!(n >= 1 && n <= 360 && d > 0)) throw new Error('Bolt circle: enter the diameter and 1 to 360 holes.');
    for (let i = 0; i < n; i++) h.push([W.bolt_x(n, d, snum(s.ba) || 0, snum(s.bcx) || 0, snum(s.bcy) || 0, i), W.bolt_y(n, d, snum(s.ba) || 0, snum(s.bcx) || 0, snum(s.bcy) || 0, i)]);
  } else if (s.pat === 'grid') {
    const nx = Math.round(snum(s.gnx)), ny = Math.round(snum(s.gny));
    if (!(nx >= 1 && ny >= 1 && nx * ny <= 2000)) throw new Error('Grid: 1 or more holes each way, 2000 at most.');
    const n = W.pattern_grid(snum(s.gx) || 0, snum(s.gy) || 0, nx, ny, snum(s.gdx) || 0, snum(s.gdy) || 0);
    const v = listOut(W, 2 * n); for (let i = 0; i < n; i++) h.push([v[2 * i], v[2 * i + 1]]);
  } else {
    const v = numsFrom(s.list);
    if (v.length % 2) throw new Error('Pasted coordinates: an X and a Y on every line (odd count of numbers found).');
    for (let i = 0; i + 1 < v.length; i += 2) h.push([v[i], v[i + 1]]);
    if (!h.length) throw new Error('Paste the hole coordinates, one "X Y" pair per line.');
  }
  return h;
}

function renderDrillCycles(el) {
  const defs = inch => ({ ctrl: 0, prog: 1001, tool: 1, wcs: 54, cycle: 81, rigid: 1, ret: 1, rpm: inch ? 1500 : 1500, feed: inch ? 6 : 150, pitch: inch ? 13 : 1.5,
    zi: inch ? 1 : 25, r: inch ? 0.1 : 2, z: inch ? -0.75 : -20, q: inch ? 0.15 : 4, dwell: 0.3, cool: 1,
    pat: 'bolt', bd: inch ? 4 : 100, bn: 6, ba: 0, bcx: 0, bcy: 0, gx: 0, gy: 0, gnx: 3, gny: 2, gdx: inch ? 1 : 25, gdy: inch ? 1 : 25, list: inch ? '0.5 0.5\n1.5 0.5\n1.0 1.25' : '10 10\n40 10\n25 35', rapid: '' });
  const tap = s => +s.cycle === 84;
  const fields = [...commonHead(CYC.DRILL),
    { k: 'cycle', label: 'Cycle', sel: [[81, 'G81 drill'], [82, 'G82 drill with dwell'], [83, 'G83 peck (full retract)'], [73, 'G73 chip break peck'], [84, 'G84 tap (right hand)']] },
    { k: 'rigid', label: 'Tapping', sel: [[1, 'Rigid'], [0, 'Floating holder']], show: tap },
    { k: 'ret', label: 'Between holes return to', sel: [[1, 'R plane (G99)'], [0, 'Initial Z (G98)']] },
    { k: 'wcs', label: 'Work offset', sel: [54, 55, 56, 57, 58, 59].map(n => [n, 'G' + n]) },
    { k: 'rpm', label: 'Spindle speed', unit: 'RPM' },
    { k: 'feed', label: 'Feed', unit: () => feedMinU(state.sys), show: s => !tap(s) },
    { k: 'pitch', label: cyInch() ? 'Tap threads per inch' : 'Tap pitch', unit: () => cyInch() ? 'TPI' : 'mm', show: tap },
    { k: 'zi', label: 'Initial Z (clearance)', unit: cyU }, { k: 'r', label: 'R plane', unit: cyU }, { k: 'z', label: 'Hole bottom Z', unit: cyU },
    { k: 'q', label: 'Peck depth Q', unit: cyU, show: s => +s.cycle === 83 || +s.cycle === 73 },
    { k: 'dwell', label: 'Dwell at the bottom', unit: 's', show: s => +s.cycle === 82 },
    { k: 'cool', label: 'Coolant', sel: [[1, 'On (M08)'], [0, 'Off']] },
    rapidField,
    { k: 'pat', label: 'Hole positions', sel: [['bolt', 'Bolt circle'], ['grid', 'Grid (rectangular)'], ['list', 'Paste coordinates']] },
    { k: 'bd', label: 'Bolt circle diameter', unit: cyU, show: s => s.pat === 'bolt' }, { k: 'bn', label: 'Number of holes', unit: '', show: s => s.pat === 'bolt' },
    { k: 'ba', label: 'Start angle (from +X, counter-clockwise)', unit: 'deg', show: s => s.pat === 'bolt' },
    { k: 'bcx', label: 'Centre X', unit: cyU, show: s => s.pat === 'bolt' }, { k: 'bcy', label: 'Centre Y', unit: cyU, show: s => s.pat === 'bolt' },
    { k: 'gx', label: 'First hole X', unit: cyU, show: s => s.pat === 'grid' }, { k: 'gy', label: 'First hole Y', unit: cyU, show: s => s.pat === 'grid' },
    { k: 'gnx', label: 'Holes along X', unit: '', show: s => s.pat === 'grid' }, { k: 'gny', label: 'Holes along Y', unit: '', show: s => s.pat === 'grid' },
    { k: 'gdx', label: 'Pitch X', unit: cyU, show: s => s.pat === 'grid' }, { k: 'gdy', label: 'Pitch Y', unit: cyU, show: s => s.pat === 'grid' },
    { k: 'list', label: 'Coordinates: X and Y on each line (space, comma or tab; decimal point ".")', area: 5, show: s => s.pat === 'list' },
  ];
  cyScreen(el, 'drill', defs, fields, s => {
    const holes = cyHoles(s), inch = cyInch();
    const pitch = tap(s) ? (inch ? 1 / snum(s.pitch) : snum(s.pitch)) : NaN;
    const p = [...cyHead(s, !inch), +s.cycle, +s.rigid, +s.ret, +s.wcs, snum(s.rpm), snum(s.feed), pitch, snum(s.zi), snum(s.r), snum(s.z), snum(s.q), +s.cycle === 82 ? snum(s.dwell) : 0, +s.cool, holes.length];
    holes.forEach(h => p.push(h[0], h[1]));
    return { cycle: CYC.DRILL, params: p, lathe: false, holes,
      csv: () => { const n = toBuf(state.W, holes.flat()); return cyStr(state.W, state.W.holes_csv(n / 2, inch ? 0 : 1)); } };
  }, (s, res, job) => {
    const rows = [['Holes', String(job.holes.length), '']];
    if (tap(s)) { const pitch = cyInch() ? 1 / snum(s.pitch) : snum(s.pitch); rows.push(['Tap feed = pitch x rpm', fmt(state.W.tap_feed(pitch, snum(s.rpm)), cyInch() ? 4 : 2), feedMinU(state.sys)]); }
    return '<div class="res" style="margin-bottom:10px">' + stable('Pattern', rows) + '</div>';
  });
}

// ---------- Thread milling ----------
function renderThreadMillCycle(el) {
  const defs = inch => ({ ctrl: 0, prog: 2001, tool: 1, wcs: 54, dreg: 1, internal: 1, lh: 0, climb: 1, comp: 0, major: inch ? 0.5 : 12, pitch: inch ? 13 : 1.75, depth: '',
    td: inch ? 0.375 : 9, len: inch ? 0.5 : 12, ztop: 0, zcl: inch ? 0.2 : 5, rpm: 4000, fe: inch ? 20 : 500, passes: 1, spring: 0, multi: 0, cx: 0, cy: 0, rapid: '' });
  const pitchOf = s => cyInch() ? 1 / snum(s.pitch) : snum(s.pitch);
  const depthOf = s => { const d = snum(s.depth); if (d > 0) return d; const p = pitchOf(s); return +s.internal === 1 ? state.W.thread_depth_internal(p) : state.W.thread_depth_external(p); };
  const fields = [...commonHead(CYC.TMILL),
    { k: 'internal', label: 'Thread', sel: [[1, 'Internal (hole)'], [0, 'External (boss)']] },
    { k: 'lh', label: 'Hand', sel: [[0, 'Right hand'], [1, 'Left hand']] },
    { k: 'climb', label: 'Milling direction', sel: [[1, 'Climb'], [0, 'Conventional']] },
    { k: 'comp', label: 'Radius compensation', sel: [[0, 'Off: program the tool centre'], [1, 'On: G41/G42 with D register']] },
    { k: 'dreg', label: 'D register', unit: '', show: s => +s.comp === 1 },
    { k: 'wcs', label: 'Work offset', sel: [54, 55, 56, 57, 58, 59].map(n => [n, 'G' + n]) },
    { k: 'major', label: 'Major diameter', unit: cyU }, { k: 'pitch', label: cyInch() ? 'Threads per inch' : 'Pitch', unit: () => cyInch() ? 'TPI' : 'mm' },
    { k: 'depth', label: 'Thread depth, radial (blank = ISO/UN basic)', unit: cyU },
    { k: 'td', label: 'Thread mill diameter', unit: cyU }, { k: 'multi', label: 'Tool', sel: [[0, 'Single-form (helix over the length)'], [1, 'Multi-form (one turn)']] },
    { k: 'len', label: 'Thread length', unit: cyU }, { k: 'ztop', label: 'Z of the top of the thread', unit: cyU }, { k: 'zcl', label: 'Clearance Z', unit: cyU },
    { k: 'cx', label: 'Centre X', unit: cyU }, { k: 'cy', label: 'Centre Y', unit: cyU },
    { k: 'rpm', label: 'Spindle speed', unit: 'RPM' }, { k: 'fe', label: 'Feed at the cutting edge', unit: () => feedMinU(state.sys) },
    { k: 'passes', label: 'Radial passes', unit: '' }, { k: 'spring', label: 'Spring passes', unit: '' }, rapidField,
  ];
  cyScreen(el, 'tmill', defs, fields, s => {
    const p = [...cyHead(s, !cyInch()), +s.internal, +s.lh, +s.climb, +s.comp, snum(s.major), pitchOf(s), depthOf(s), snum(s.td), snum(s.len), snum(s.ztop), snum(s.zcl),
      snum(s.rpm), snum(s.fe), snum(s.passes), snum(s.spring) || 0, +s.multi, snum(s.cx) || 0, snum(s.cy) || 0, snum(s.dreg), +s.wcs];
    return { cycle: CYC.TMILL, params: p, lathe: false };
  }, (s, res) => {
    const W = state.W, int = +s.internal === 1, D = snum(s.major), d = snum(s.td), h = depthOf(s), cut = int ? D : D - 2 * h, u = cyU(), dp = cyInch() ? 4 : 3;
    const rc = W.thread_mill_path_radius(cut, d, int ? 1 : 0), fc = W.thread_mill_centre_feed(snum(s.fe), cut, d, int ? 1 : 0);
    const rows = [['Diameter the cutter reaches (' + (int ? 'major' : 'root') + ')', fmt(cut, dp), u], ['Thread depth (radial)', fmt(h, dp), u],
      ['Tool centre path radius', fmt(rc, dp), u], ['Tool centre feed F', fmt(fc, cyInch() ? 3 : 1), feedMinU(state.sys)],
      ['Helix lead angle', fmt(W.helix_lead_angle_deg(rc, pitchOf(s)), 3), 'deg'], ['Feed along the helix (if your control applies F in 3D)', fmt(W.helix_path_feed(fc, rc, pitchOf(s)), cyInch() ? 3 : 1), feedMinU(state.sys)]];
    let pass = '';
    if (res.ok && res.table.length) {
      const t = [];
      for (let i = 0; i + 2 < res.table.length; i += 3) t.push(['Pass ' + res.table[i], fmt(res.table[i + 1], dp) + ' / ' + fmt(res.table[i + 2], dp), u]);
      pass = '<div class="res" style="margin-top:10px">' + stable('Passes: thread diameter / tool centre path diameter', t) + '</div>';
    }
    return '<div class="res">' + stable('Thread mill data', rows) + '</div>' + pass + '<div style="height:10px"></div>';
  });
}

// ---------- Lathe threading: G76 or G92 with infeed table ----------
function renderLatheThreadCycle(el) {
  const defs = inch => ({ ctrl: 0, prog: 3001, tool: 1, mode: 'g76', internal: 0, major: inch ? 0.5 : 10, pitch: inch ? 13 : 1.5, depth: '', zs: inch ? 0.2 : 5, ze: inch ? -0.75 : -20,
    xc: inch ? 0.04 : 1, infeed: 0, first: inch ? 0.008 : 0.2, minc: inch ? 0.002 : 0.05, np: 8, ff: 0.3, step: inch ? 0.005 : 0.12, custom: inch ? '0.010 0.008 0.007 0.006 0.005 0.004 0.003 0.002' : '0.25 0.2 0.15 0.12 0.1 0.06 0.04',
    finish: inch ? 0.002 : 0.05, spring: 1, angle: 60, pull: 1, iang: 0, rpm: 800, rapid: '' });
  const pitchOf = s => cyInch() ? 1 / snum(s.pitch) : snum(s.pitch);
  const depthOf = s => { const d = snum(s.depth); if (d > 0) return d; if (+s.infeed === 3) { const v = numsFrom(s.custom); if (v.length) return v.reduce((a, b) => a + b, 0); } const p = pitchOf(s); return +s.internal === 1 ? state.W.thread_depth_internal(p) : state.W.thread_depth_external(p); };
  const cycOf = s => s.mode === 'g76' ? CYC.G76 : CYC.G92;
  const g76ok = s => s.mode !== 'g76' || +s.infeed === 0 || (+s.infeed === 2 && +s.ctrl === 1);
  const fields = [ctrlField(cycOf), { k: 'prog', label: 'Program number (O)', unit: '' }, { k: 'tool', label: 'Tool number', unit: '' },
    { k: 'mode', label: 'Program as', sel: [['g76', 'G76 multi-pass cycle'], ['g92', 'G92 one block per pass']] },
    { k: 'internal', label: 'Thread', sel: [[0, 'External'], [1, 'Internal']] },
    { k: 'major', label: 'Major diameter', unit: cyU }, { k: 'pitch', label: cyInch() ? 'Threads per inch' : 'Pitch (lead)', unit: () => cyInch() ? 'TPI' : 'mm' },
    { k: 'depth', label: 'Thread depth, radial (blank = ISO/UN; custom: sum of passes)', unit: cyU },
    { k: 'zs', label: 'Start Z (in front of the part)', unit: cyU }, { k: 'ze', label: 'Thread end Z', unit: cyU }, { k: 'xc', label: 'X clearance (radial)', unit: cyU },
    { k: 'infeed', label: 'Infeed', sel: [[0, 'Constant volume from first cut (d x sqrt n)'], [1, 'Constant volume over n passes'], [2, 'Constant depth'], [3, 'Custom pass depths']] },
    { k: 'first', label: 'First cut depth (radial)', unit: cyU, show: s => +s.infeed === 0 },
    { k: 'minc', label: 'Minimum cut', unit: cyU, show: s => +s.infeed === 0 },
    { k: 'np', label: 'Roughing passes', unit: '', show: s => +s.infeed === 1 }, { k: 'ff', label: 'First-pass factor (0.3 typical)', unit: '', show: s => +s.infeed === 1 },
    { k: 'step', label: 'Depth per pass', unit: cyU, show: s => +s.infeed === 2 },
    { k: 'custom', label: 'Depth of each pass (radial, in order; must add up to the thread depth)', area: 2, show: s => +s.infeed === 3 },
    { k: 'finish', label: 'Finish allowance (last pass)', unit: cyU, show: s => +s.infeed !== 3 },
    { k: 'spring', label: 'Spring passes', unit: '' },
    { k: 'angle', label: 'Tool angle', unit: 'deg', show: s => s.mode === 'g76' },
    { k: 'pull', label: 'Pull-out (chamfer) length', unit: 'x lead', show: s => s.mode === 'g76' && +s.ctrl === 0 },
    { k: 'iang', label: 'Infeed angle (0 = radial)', unit: 'deg', show: s => s.mode === 'g92' },
    { k: 'rpm', label: 'Spindle speed (G97)', unit: 'RPM' }, rapidField,
  ];
  const passesOf = s => {
    const W = state.W, h = depthOf(s), fin = +s.infeed === 3 ? 0 : (snum(s.finish) || 0);
    let n;
    if (+s.infeed === 3) { const v = numsFrom(s.custom); n = W.infeed(3, h, toBuf(W, v), 0, 0); const out = listOut(W, n); if (out.length && Math.abs(out[out.length - 1] - h) > 1e-6) throw new Error('Custom pass depths add up to ' + fmt(out[out.length - 1], 4) + ', not the thread depth ' + fmt(h, 4) + '. Adjust the list or enter the depth.'); return out; }
    if (+s.infeed === 0) n = W.infeed(0, h, snum(s.first), snum(s.minc) || 0, fin);
    else if (+s.infeed === 1) n = W.infeed(1, h, snum(s.np), snum(s.ff), fin);
    else n = W.infeed(2, h, snum(s.step), 0, fin);
    return listOut(W, n);
  };
  cyScreen(el, 'lthread', defs, fields, s => {
    if (!g76ok(s)) throw new Error(+s.ctrl === 1 ? 'Haas G76 cuts constant volume (P1) or constant depth (P3) only: pick one of those, or program as G92 passes.' : 'A Fanuc-style G76 works out its own passes from the first cut (d x sqrt n): pick that infeed, or program as G92 passes.');
    const passes = passesOf(s);
    if (!passes.length) throw new Error('Check the infeed values (depth, first cut or step, finish allowance).');
    const first = +s.infeed === 2 ? snum(s.step) : snum(s.first);
    const p = [...cyHead(s, !cyInch()), +s.internal, snum(s.major), pitchOf(s), depthOf(s), snum(s.zs), snum(s.ze), snum(s.xc), snum(s.spring) || 0,
      first, snum(s.minc) || 0, +s.infeed === 3 ? 0 : (snum(s.finish) || 0), +s.infeed === 2 ? 1 : 0, snum(s.angle), snum(s.pull) || 0, snum(s.iang) || 0, snum(s.rpm), passes.length, ...passes];
    return { cycle: cycOf(s), params: p, lathe: true };
  }, (s, res) => {
    if (!res.ok) return '';
    const dp = cyInch() ? 4 : 3, t = [];
    for (let i = 0; i + 3 < res.table.length; i += 4) t.push('<tr><td>' + res.table[i] + '</td><td class="v">' + fmt(res.table[i + 1], dp) + '</td><td class="v">' + fmt(res.table[i + 2], dp) + '</td><td class="v">' + fmt(res.table[i + 3], dp) + '</td></tr>');
    return '<div class="res" style="margin-bottom:10px"><div class="h">Infeed table (' + cyU() + ', radial depths; X is the diameter)' + '</div><table><tr><td class="ms">Pass</td><td class="ms" style="text-align:right">Total depth</td><td class="ms" style="text-align:right">This pass</td><td class="ms" style="text-align:right">X</td></tr>' + t.join('') + '</table></div>';
  });
}

// ---------- Taper ----------
function renderTaperCycle(el) {
  const defs = inch => ({ ctrl: 0, prog: 4001, tool: 1, internal: 0, fd: inch ? 0.75 : 20, bd: inch ? 1.25 : 30, len: inch ? 1 : 25, zf: 0, doc: inch ? 0.05 : 1.5, fin: inch ? 0.008 : 0.2,
    fr: inch ? 0.01 : 0.25, ff: inch ? 0.004 : 0.1, cl: inch ? 0.08 : 2, comp: 1, css: 1, v: inch ? 600 : 180, vmax: 3000, rpm: 1200, rapid: '' });
  const fields = [...commonHead(CYC.TAPER),
    { k: 'internal', label: 'Taper', sel: [[0, 'External (turn)'], [1, 'Internal (bore)']], on: s => { const a = snum(s.fd), b = snum(s.bd); if ((+s.internal === 1) === (a < b)) { s.fd = String(b); s.bd = String(a); } } },
    { k: 'fd', label: 'Diameter at the front (Z front)', unit: cyU }, { k: 'bd', label: 'Diameter at the back (= stock or pre-bore)', unit: cyU },
    { k: 'len', label: 'Taper length', unit: cyU }, { k: 'zf', label: 'Z front', unit: cyU },
    { k: 'doc', label: 'Depth of cut (per side)', unit: cyU }, { k: 'fin', label: 'Finish allowance (per side)', unit: cyU },
    { k: 'fr', label: 'Roughing feed', unit: () => feedRevU(state.sys) }, { k: 'ff', label: 'Finishing feed', unit: () => feedRevU(state.sys) },
    { k: 'cl', label: 'Clearance', unit: cyU }, { k: 'comp', label: 'Nose radius compensation', sel: [[1, 'G41/G42 on the finish pass'], [0, 'Off']] },
    ...spindleFields, rapidField];
  cyScreen(el, 'taper', defs, fields, s => ({ cycle: CYC.TAPER, lathe: true,
    params: [...cyHead(s, !cyInch()), +s.internal, snum(s.fd), snum(s.bd), snum(s.len), snum(s.zf) || 0, snum(s.doc), snum(s.fin) || 0, snum(s.fr), snum(s.ff), snum(s.cl), +s.comp, ...spParams(s)] }),
  (s, res) => {
    const D = snum(s.bd), d = snum(s.fd), L = snum(s.len);
    const rows = [['Included angle', fmt(state.W.taper_included_angle_deg(Math.max(D, d), Math.min(D, d), L), 4), 'deg'], ['Taper per unit length (on diameter)', fmt(Math.abs(D - d) / L, 5), cyU() + '/' + cyU()]];
    if (res.ok) rows.push(['Roughing passes', String(res.table.length), '']);
    return '<div class="res" style="margin-bottom:10px">' + stable('Taper', rows) + '</div>';
  });
}

// ---------- Groove and cut-off ----------
function renderGrooveCycle(el) {
  const defs = inch => ({ ctrl: 0, prog: 5001, tool: 1, cutoff: 0, sd: inch ? 1.5 : 40, bd: inch ? 1.25 : 34, zf: inch ? -0.5 : -10, w: inch ? 0.25 : 6, tw: inch ? 0.118 : 3, step: '',
    peck: '', pb: inch ? 0.01 : 0.3, f: inch ? 0.002 : 0.05, cl: inch ? 0.04 : 1, css: 1, v: inch ? 400 : 120, vmax: 2500, rpm: 800, rapid: '' });
  const co = s => +s.cutoff === 1;
  const fields = [...commonHead(CYC.GROOVE),
    { k: 'cutoff', label: 'Operation', sel: [[0, 'Groove'], [1, 'Cut-off (part-off)']] },
    { k: 'sd', label: 'Stock diameter', unit: cyU }, { k: 'bd', label: 'Bottom diameter (cut-off: 0 or a little below)', unit: cyU },
    { k: 'zf', label: 'Z of the front wall (tool front corner)', unit: cyU },
    { k: 'w', label: 'Groove width', unit: cyU, show: s => !co(s) }, { k: 'tw', label: 'Insert width', unit: cyU },
    { k: 'step', label: 'Step between plunges (blank = 80 % of insert)', unit: cyU, show: s => !co(s) },
    { k: 'peck', label: 'Peck depth, radial (blank = no pecking)', unit: cyU }, { k: 'pb', label: 'Peck back-off (radial)', unit: cyU },
    { k: 'f', label: 'Feed', unit: () => feedRevU(state.sys) }, { k: 'cl', label: 'Clearance (radial)', unit: cyU },
    ...spindleFields, rapidField];
  cyScreen(el, 'groove', defs, fields, s => ({ cycle: CYC.GROOVE, lathe: true,
    params: [...cyHead(s, !cyInch()), +s.cutoff, snum(s.sd), snum(s.bd), snum(s.zf) || 0, snum(s.w), snum(s.tw), snum(s.step) || 0, snum(s.peck) || 0, snum(s.pb) || 0, snum(s.f), snum(s.cl), ...spParams(s)] }),
  (s, res) => {
    if (!res.ok) return '';
    const W = state.W, metric = cyInch() ? 0 : 1, rows = [];
    if (+s.css === 1) {
      const dc = (metric ? 1000 : 12) * snum(s.v) / (Math.PI * snum(s.vmax));
      rows.push(['Speed at the stock diameter', fmt(W.css_rpm(snum(s.v), snum(s.sd), snum(s.vmax), metric), 0), 'RPM'], ['Clamp (G50) reached below diameter', fmt(dc, cyInch() ? 4 : 2), cyU()]);
    }
    rows.push(['Plunges', String(res.table[0]), ''], ['Cut time per plunge (stock to bottom, no pecks)', cyClock(res.table[1] * 60), 'min:s']);
    return '<div class="res" style="margin-bottom:10px">' + stable('Grooving data', rows) + '</div>';
  });
}

// ---------- Keyway broaching ----------
function renderBroachCycle(el) {
  const defs = inch => ({ ctrl: 0, prog: 6001, tool: 1, lathe: 1, bore: inch ? 1 : 25, depth: inch ? 0.06 : 1.5, doc: inch ? 0.002 : 0.05, spring: 1, zs: inch ? 0.1 : 3, ze: inch ? -1.1 : -30,
    feed: inch ? 80 : 2000, lift: inch ? 0.008 : 0.2, cx: 0, cy: 0, dir: 0, edge: 0, wcs: 54, rapid: '' });
  const mill = s => +s.lathe !== 1;
  const fields = [...commonHead(CYC.BROACH),
    { k: 'lathe', label: 'Machine', sel: [[1, 'Lathe (stroke along Z, depth in X)'], [0, 'Mill (stroke along Z, spindle locked)']] },
    { k: 'bore', label: 'Bore diameter', unit: cyU }, { k: 'depth', label: 'Keyway depth from the bore wall', unit: cyU },
    { k: 'doc', label: 'Depth per stroke', unit: cyU }, { k: 'spring', label: 'Spring strokes', unit: '' },
    { k: 'zs', label: 'Stroke start Z (above the face)', unit: cyU }, { k: 'ze', label: 'Stroke end Z (past the keyway)', unit: cyU },
    { k: 'feed', label: 'Stroke feed', unit: () => feedMinU(state.sys) }, { k: 'lift', label: 'Lift for the return stroke', unit: cyU },
    { k: 'wcs', label: 'Work offset', sel: [54, 55, 56, 57, 58, 59].map(n => [n, 'G' + n]), show: mill },
    { k: 'cx', label: 'Bore centre X', unit: cyU, show: mill }, { k: 'cy', label: 'Bore centre Y', unit: cyU, show: mill },
    { k: 'dir', label: 'Keyway direction', sel: [[0, '+X'], [1, '+Y'], [2, '-X'], [3, '-Y']], show: mill },
    { k: 'edge', label: 'Cutting edge distance from the spindle axis', unit: cyU, show: mill }, rapidField];
  cyScreen(el, 'broach', defs, fields, s => ({ cycle: CYC.BROACH, lathe: +s.lathe === 1,
    params: [...cyHead(s, !cyInch()), +s.lathe, snum(s.bore), snum(s.depth), snum(s.doc), snum(s.spring) || 0, snum(s.zs), snum(s.ze), snum(s.feed), snum(s.lift) || 0, snum(s.cx) || 0, snum(s.cy) || 0, +s.dir, snum(s.edge) || 0, +s.wcs] }),
  (s, res) => res.ok ? '<div class="res" style="margin-bottom:10px">' + stable('Strokes', [['Strokes (incl. spring)', String(res.table.length / 2), ''], ['Stroke length', fmt(snum(s.zs) - snum(s.ze), cyInch() ? 4 : 3), cyU()]]) + '</div>' : '');
}

// ---------- G71 / G70 from a simple profile ----------
function renderG71Cycle(el) {
  const defs = inch => ({ ctrl: 0, prog: 7001, tool: 1, internal: 0, stock: inch ? 2 : 50, doc: inch ? 0.06 : 1.5, ret: inch ? 0.02 : 0.5, u: inch ? 0.016 : 0.4, w: inch ? 0.004 : 0.1,
    fr: inch ? 0.01 : 0.25, ff: inch ? 0.004 : 0.1, cl: inch ? 0.08 : 2, ns: 100, css: 1, v: inch ? 600 : 180, vmax: 3000, rpm: 1200, rapid: '',
    prof: inch ? '0.75 0\n0.875 -0.0625\n0.875 -0.6\n1.375 -0.6\n1.5 -0.6625\n1.5 -1.5' : '20 0\n24 -2\n24 -15\n36 -15\n40 -17\n40 -40' });
  const fields = [...commonHead(CYC.G71),
    { k: 'internal', label: 'Profile', sel: [[0, 'Outside (turning)'], [1, 'Inside (boring)']], on: (s, inch) => {
      if (+s.internal === 1) { s.stock = inch ? 0.5 : 12; s.prof = inch ? '1.5 0\n1.375 -0.0625\n1.375 -0.5\n1.0 -0.5\n1.0 -1.25' : '40 0\n36 -2\n36 -12\n26 -12\n26 -30'; }
      else { s.stock = inch ? 2 : 50; s.prof = inch ? '0.75 0\n0.875 -0.0625\n0.875 -0.6\n1.375 -0.6\n1.5 -0.6625\n1.5 -1.5' : '20 0\n24 -2\n24 -15\n36 -15\n40 -17\n40 -40'; }
    } },
    { k: 'stock', label: 'Stock diameter (inside: pre-bore)', unit: cyU },
    { k: 'doc', label: 'Depth of cut (per side)', unit: cyU }, { k: 'ret', label: 'Retract (G71 R)', unit: cyU },
    { k: 'u', label: 'Finish allowance X (on diameter)', unit: cyU }, { k: 'w', label: 'Finish allowance Z', unit: cyU },
    { k: 'fr', label: 'Roughing feed', unit: () => feedRevU(state.sys) }, { k: 'ff', label: 'Finishing feed (G70)', unit: () => feedRevU(state.sys) },
    { k: 'cl', label: 'Clearance', unit: cyU }, { k: 'ns', label: 'First profile block number (N)', unit: '' },
    ...spindleFields, rapidField,
    { k: 'prof', label: 'Profile points from the front: diameter and Z on each line (straight lines only; no undercuts)', area: 6 }];
  cyScreen(el, 'g71', defs, fields, s => {
    const v = numsFrom(s.prof);
    if (v.length % 2 || v.length < 4) throw new Error('Profile: enter at least two points, a diameter and a Z on each line.');
    return { cycle: CYC.G71, lathe: true, params: [...cyHead(s, !cyInch()), +s.internal, snum(s.stock), snum(s.doc), snum(s.ret) || 0, snum(s.u) || 0, snum(s.w) || 0, snum(s.fr), snum(s.ff), snum(s.cl), snum(s.ns), ...spParams(s), v.length / 2, ...v] };
  }, (s, res) => res.ok ? '<div class="res" style="margin-bottom:10px">' + stable('Roughing model', [['Roughing levels', String(res.table.length), '']]) + '</div>' : '');
}
