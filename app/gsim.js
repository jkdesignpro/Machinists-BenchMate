'use strict';
// G-code backplot: paste or load a program, see the programmed path in 2D,
// step through it block by block, read the distances and the time estimate.
// Parsing, arcs, cycles, distances and times all come from the Rust core
// (core/src/gsim.rs); this file draws the canvas and the tables.
// Uses sesc, snum, sinp, sfield, stable (shop.js), CTRLS, cyRapid, cyClock
// (cycles.js), gmProfileType (gmcodes.js), Profiles (profiles.js).

const GS_EX_MILL = `%
O1234 (BENCHMATE BACKPLOT EXAMPLE - MILL)
(POCKET OUTLINE WITH CORNER RADII, THEN 4 DRILLED HOLES)
N10 G21 G17 G40 G49 G80 G90
N20 T1 M06
N30 G00 G54 X0. Y0. S3000 M03
N40 G43 H1 Z25. M08
N50 G00 X10. Y5.
N60 Z2.
N70 G01 Z-3. F150.
N80 G01 X50. F600.
N90 G03 X55. Y10. R5.
N100 G01 Y40.
N110 G03 X50. Y45. I-5. J0.
N120 G01 X10.
N130 G03 X5. Y40. R5.
N140 G01 Y10.
N150 G03 X10. Y5. I5. J0.
N160 G00 Z25.
N170 T2 M06
N180 G43 H2 Z25. S1500 M03
N190 G99 G81 X15. Y15. Z-12. R2. F120.
N200 X45.
N210 Y35.
N220 G98 X15.
N230 G80
N240 G00 Z25. M09
N250 M05
N260 G91 G28 Z0.
N270 G90
N280 M30
%`;

const GS_EX_LATHE = `%
O2345 (BENCHMATE BACKPLOT EXAMPLE - LATHE)
(OD PROFILE: G71 ROUGHING IS REPORTED, G70 FINISH IS DRAWN, THEN A G92 THREAD)
N10 G21 G40 G99
N20 T0101
N30 G50 S3000
N40 G96 S180 M03
N50 G00 X54. Z2. M08
N60 G71 U2. R0.5
N70 G71 P100 Q170 U0.4 W0.1 F0.25
N100 G00 X20.
N110 G01 Z0. F0.1
N120 X24. Z-2.
N130 Z-15.
N140 X32.
N150 G03 X36. Z-17. R2.
N160 G01 Z-40.
N170 X50.
N180 G70 P100 Q170
N190 G00 X54. Z2.
N200 G97 S800 T0505
N210 G00 X26. Z5.
N220 G92 X23.2 Z-13. F1.5
N230 X22.8
N240 X22.5
N250 X22.2
N260 X22.16
N270 G00 X54. Z5. M09
N280 M05
N290 M30
%`;

let GS_TEXT = null;
try { GS_TEXT = localStorage.getItem('bm.gsim.text'); } catch (e) {}
const GS = { lathe: null, ctrl: 0, punits: null, rapid: '', tol: '', vmax: '', view: 'xy', step: -1, timer: null };
const GS_LEV = ['Error', 'Warning', 'Note'];

function gsVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888'; }

function gsRun(text, opt) {
  const W = state.W;
  const bytes = new TextEncoder().encode(text);
  const p = W.gsim_in(bytes.length);
  new Uint8Array(W.memory.buffer, p, bytes.length).set(bytes);
  const nsteps = W.gsim_run(bytes.length, opt.lathe ? 1 : 0, opt.ctrl, opt.metric ? 1 : 0, opt.pmetric ? 1 : 0, opt.rapid > 0 ? opt.rapid : 0, opt.tol > 0 ? opt.tol : 0, opt.vmax > 0 ? opt.vmax : 0);
  // Copy out: the views die when the memory grows.
  const segs = new Float64Array(W.memory.buffer, W.gsim_segs_ptr(), W.gsim_segs_len()).slice();
  const sw = W.gsim_step_w();
  const steps = new Float64Array(W.memory.buffer, W.gsim_steps_ptr(), W.gsim_steps_len()).slice();
  const stats = []; for (let i = 0; i < 22; i++) stats.push(W.gsim_stat(i));
  const ml = W.gsim_msgs();
  const mtxt = ml ? new TextDecoder().decode(new Uint8Array(W.memory.buffer, W.text_ptr(), ml)) : '';
  const msgs = mtxt ? mtxt.split('\n').map(l => { const a = l.split('\t'); return { line: +a[0], level: +a[1], text: a.slice(2).join(' ') }; }) : [];
  const st = i => ({ line: steps[i * sw], seg0: steps[i * sw + 1], seg1: steps[i * sw + 2], x: steps[i * sw + 3], y: steps[i * sw + 4], z: steps[i * sw + 5],
    feed: steps[i * sw + 6], perRev: steps[i * sw + 7] === 1, rpm: steps[i * sw + 8], tool: steps[i * sw + 9], time: steps[i * sw + 10] });
  return { nsteps, segs, nsegs: segs.length / 7, step: st, stats, msgs };
}

function renderGsim(el) {
  if (GS.timer) { clearInterval(GS.timer); GS.timer = null; }
  const inch = state.sys === 'inch', U = inch ? 'in' : 'mm';
  if (GS.lathe === null) GS.lathe = (typeof gmProfileType === 'function' && gmProfileType() === 'L');
  if (GS.punits === null) GS.punits = inch ? 'inch' : 'mm';
  if (GS_TEXT === null) GS_TEXT = GS.lathe ? GS_EX_LATHE : GS_EX_MILL;
  const ctrlOpts = CTRLS.map(([v, t]) => '<option value="' + v + '"' + (v > 1 ? ' disabled' : '') + (+GS.ctrl === v ? ' selected' : '') + '>' + sesc(t) + (v > 1 ? ' (not yet supported)' : '') + '</option>').join('');
  const views = GS.lathe ? [['xz', 'XZ (lathe: Z across, X radius up)']] : [['xy', 'XY (top, from +Z)'], ['xz', 'XZ (front, from -Y)'], ['yz', 'YZ (side, from +X)']];
  if (!views.some(v => v[0] === GS.view)) GS.view = views[0][0];
  el.innerHTML =
    '<p class="gsbanner">Backplot of the programmed path only. It is not a machine verification: no stock, tool shape, compensation, machine limits, fixtures or collisions are checked. Prove out every program on the machine.</p>' +
    '<div class="grid">' +
      sfield('Machine', '<select id="gsmach"><option value="0"' + (GS.lathe ? '' : ' selected') + '>Mill (X, Y, Z)</option><option value="1"' + (GS.lathe ? ' selected' : '') + '>Lathe (X diameter, Z)</option></select>', '') +
      sfield('Control', '<select id="gsctrl">' + ctrlOpts + '</select>', '') +
      sfield('Units if no G20 / G21', '<select id="gspu"><option value="mm"' + (GS.punits === 'mm' ? ' selected' : '') + '>mm (G21)</option><option value="inch"' + (GS.punits === 'inch' ? ' selected' : '') + '>inch (G20)</option></select>', '') +
      sfield('Rapid rate (blank = active machine)', sinp('rapid', GS.rapid, 110), inch ? 'in/min' : 'mm/min') +
      sfield('Arc radius tolerance (blank = ' + (inch ? '0.0002' : '0.005') + ')', sinp('tol', GS.tol, 110), U) +
      (GS.lathe ? sfield('Max rpm for G96 if no G50', sinp('vmax', GS.vmax, 110), 'RPM') : '') +
    '</div>' +
    '<label class="f" style="display:block"><span>Program (paste, type or load a file)</span>' +
    '<textarea id="gstext" rows="10" spellcheck="false" class="gstext"></textarea></label>' +
    '<div class="mfilter gsbar"><button class="btn" id="gsload">Load file</button><input type="file" id="gsfile" accept=".nc,.ngc,.tap,.txt,.cnc,.gcode,.mpf,.eia,.min,.ptp,text/plain" hidden>' +
    '<button class="btn" id="gsexm">Mill example</button><button class="btn" id="gsexl">Lathe example</button><button class="btn" id="gsclr">Clear</button><span class="ms" id="gsinfo"></span></div>' +
    '<div class="gsmain"><div class="gsplotcol">' +
      '<div class="mfilter gsbar"><div class="seg" id="gsview">' + views.map(([v, t]) => '<button data-v="' + v + '"' + (GS.view === v ? ' class="on"' : '') + ' title="' + sesc(t) + '">' + v.toUpperCase() + '</button>').join('') + '</div>' +
      '<button class="btn" id="gsfit">Fit</button><span class="ms">Wheel to zoom, drag to pan.</span></div>' +
      '<canvas id="gscv" class="gscv" role="img" aria-label="Toolpath backplot"></canvas>' +
      '<p class="ms gskey"><span class="gkey gkp"></span> feed &nbsp; <span class="gkey gkr"></span> rapid &nbsp; <span class="gkey gkc"></span> current block &nbsp; <span class="gkey gkf"></span> not reached yet &nbsp; <span id="gsvlab"></span></p>' +
      '<div class="mfilter gsbar gsscrub"><button class="btn" id="gsfirst" title="First block">|&lt;</button><button class="btn" id="gsprev" title="Previous block">&lt;</button>' +
      '<button class="btn" id="gsplay">Play</button><button class="btn" id="gsnext" title="Next block">&gt;</button><button class="btn" id="gslast" title="Last block">&gt;|</button>' +
      '<input type="range" id="gsrange" min="0" max="0" value="0" aria-label="Block"></div>' +
      '<div class="res gscur" id="gscur"></div>' +
    '</div><div class="gslist" id="gslist" aria-label="Program listing"></div></div>' +
    '<div id="gsstats"></div><div id="gsmsgs"></div>';
  const ta = el.querySelector('#gstext'); ta.value = GS_TEXT;
  const cv = el.querySelector('#gscv'), list = el.querySelector('#gslist'), range = el.querySelector('#gsrange');
  let R = null, lines = [], view = null, lineDivs = [], lineFirstStep = new Map();

  const opts = () => {
    const rp = cyRapid({ rapid: GS.rapid });
    return { lathe: GS.lathe, ctrl: +GS.ctrl, metric: !inch, pmetric: GS.punits === 'mm', rapid: rp.v, rapidFrom: rp.from, tol: snum(GS.tol), vmax: snum(GS.vmax) };
  };

  function run() {
    const o = opts();
    lines = GS_TEXT.split('\n');
    try { R = gsRun(GS_TEXT, o); } catch (e) { R = null; el.querySelector('#gsinfo').textContent = 'Could not run the backplot: ' + e.message; return; }
    R.o = o;
    lineFirstStep = new Map();
    for (let i = 0; i < R.nsteps; i++) { const l = R.step(i).line; if (!lineFirstStep.has(l)) lineFirstStep.set(l, i); }
    range.max = Math.max(0, R.nsteps - 1);
    if (GS.step < 0 || GS.step >= R.nsteps) GS.step = R.nsteps - 1;
    range.value = Math.max(0, GS.step);
    el.querySelector('#gsinfo').textContent = lines.length + ' lines, ' + R.nsteps + ' blocks run, ' + R.nsegs + ' path pieces';
    buildList(); stats(); msgs(); view = null; draw(); cur();
  }

  function buildList() {
    const lev = new Map(); R.msgs.forEach(m => { if (m.line > 0) lev.set(m.line, Math.min(lev.has(m.line) ? lev.get(m.line) : 9, m.level)); });
    const shown = Math.min(lines.length, 20000);
    let h = '';
    for (let i = 0; i < shown; i++) {
      const n = i + 1, lv = lev.get(n);
      h += '<div class="gl' + (lv === 0 ? ' e' : lv === 1 ? ' w' : '') + (lineFirstStep.has(n) ? '' : ' skip') + '" data-l="' + n + '"><span class="gn">' + n + '</span>' + (sesc(lines[i]) || ' ') + '</div>';
    }
    if (lines.length > shown) h += '<div class="gl skip">... ' + (lines.length - shown) + ' more lines not listed</div>';
    list.innerHTML = h;
    lineDivs = [...list.querySelectorAll('.gl[data-l]')];
  }

  function fmtLen(v, dp) { return isFinite(v) ? fmt(v, dp === undefined ? (inch ? 4 : 3) : dp) : 'n/a'; }
  function stats() {
    const s = R.stats, box = (lo, hi) => fmtLen(lo) + ' to ' + fmtLen(hi);
    const rows = [];
    rows.push(['Feed (cutting) distance', fmtLen(s[12], inch ? 3 : 1), U], ['Rapid distance', fmtLen(s[13], inch ? 3 : 1), U]);
    rows.push(['Feed time', cyClock(s[14]), 'min:s'], ['Dwell time', cyClock(s[16]), 'min:s']);
    if (R.o.rapid > 0) rows.push(['Rapid time at ' + fmt(R.o.rapid, 0) + ' ' + (inch ? 'in/min' : 'mm/min') + ' (' + sesc(R.o.rapidFrom) + ')', cyClock(s[15]), 'min:s']);
    else rows.push(['Rapid time', 'enter rapid', '', 'No rapid rate: enter one above, or add it to the active machine profile']);
    rows.push(['Estimated cycle time' + (R.o.rapid > 0 ? '' : ' (without rapids)'), cyClock(s[17]), 'min:s']);
    if (s[18] > 0) rows.push(['Feed blocks not timed', fmt(s[18], 0), '', 'No F, or feed per revolution with no spindle speed: see the messages']);
    const ax = GS.lathe ? [['X (diameter)', 0, 2], ['Z', 2, 1]] : [['X', 0, 1], ['Y', 1, 1], ['Z', 2, 1]];
    if (isFinite(s[0])) ax.forEach(([n, i, k]) => rows.push(['Extent ' + n + ', all moves', box(s[i] * k, s[3 + i] * k), U]));
    if (isFinite(s[6])) ax.forEach(([n, i, k]) => rows.push(['Extent ' + n + ', feed moves', box(s[6 + i] * k, s[9 + i] * k), U]));
    el.querySelector('#gsstats').innerHTML = '<div class="res" style="margin-top:12px">' + stable('Program statistics (' + (inch ? 'inch' : 'mm') + ')', rows) + '</div>' +
      '<p class="ms" style="max-width:760px">Time = path length / F per block (feed per revolution: / (F x rpm), with G96 the rpm follows the diameter up to the G50 clamp). Helical arcs are timed along the arc in the plane. Acceleration and deceleration, block processing, tool changes, spindle start, M-code waits and the G28 travel to the reference point are ignored, so the real time is longer.</p>';
  }

  function msgs() {
    const errs = R.stats[19], warns = R.stats[20];
    let h = '<div class="res gsmsg" style="margin-top:12px"><div class="h">Messages: ' + errs + ' error' + (errs === 1 ? '' : 's') + ', ' + warns + ' warning' + (warns === 1 ? '' : 's') + '</div><table>';
    if (!R.msgs.length) h += '<tr><td class="ms">No errors or warnings.</td></tr>';
    R.msgs.forEach(m => {
      h += '<tr class="gm' + m.level + '" data-l="' + m.line + '"><td class="gml">' + (m.line ? 'Line ' + m.line : 'Program') + '</td><td class="gmk">' + GS_LEV[m.level] + '</td><td>' + sesc(m.text) + '</td></tr>';
    });
    h += '</table></div>';
    el.querySelector('#gsmsgs').innerHTML = h;
    el.querySelectorAll('#gsmsgs tr[data-l]').forEach(tr => tr.onclick = () => jumpLine(+tr.dataset.l));
  }

  function jumpLine(n) {
    if (!R) return;
    if (lineFirstStep.has(n)) { setStep(lineFirstStep.get(n)); return; }
    // Not executed (skipped or after M30): just show the line.
    lineDivs.forEach(d => d.classList.toggle('on', +d.dataset.l === n));
    const d = lineDivs[n - 1]; if (d) list.scrollTop = d.offsetTop - list.clientHeight / 2;
  }

  function setStep(k) {
    if (!R || !R.nsteps) return;
    GS.step = Math.max(0, Math.min(R.nsteps - 1, k));
    range.value = GS.step; draw(); cur();
  }

  function cur() {
    const box = el.querySelector('#gscur');
    if (!R || !R.nsteps) { box.innerHTML = '<div class="h">No blocks</div>'; return; }
    const s = R.step(GS.step), n = s.line, dp = inch ? 4 : 3;
    lineDivs.forEach(d => d.classList.remove('on'));
    const d = lineDivs[n - 1];
    if (d) { d.classList.add('on'); list.scrollTop = d.offsetTop - list.clientHeight / 2; }
    const pos = GS.lathe ? 'X' + fmt(2 * s.x, dp) + ' Z' + fmt(s.z, dp) : 'X' + fmt(s.x, dp) + ' Y' + fmt(s.y, dp) + ' Z' + fmt(s.z, dp);
    const fu = s.perRev ? (inch ? 'in/rev' : 'mm/rev') : (inch ? 'in/min' : 'mm/min');
    const rows = [['Block', sesc((lines[n - 1] || '').trim()) || '&nbsp;', ''], ['Position after the block', pos, U],
      ['Feed (modal)', s.feed > 0 ? fmt(s.feed, s.perRev ? (inch ? 4 : 3) : (inch ? 2 : 0)) : 'none', fu],
      ['Spindle', s.rpm > 0 ? fmt(s.rpm, 0) : 'off / unknown', 'RPM'], ['Tool', s.tool ? 'T' + s.tool : 'none', ''],
      ['Elapsed (estimate)' + (R.o.rapid > 0 ? '' : ', without rapids'), cyClock(s.time), 'min:s']];
    box.innerHTML = stable('Block ' + (GS.step + 1) + ' of ' + R.nsteps + ', line ' + n, rows);
  }

  // ---- canvas ----
  const proj = GS.lathe ? (b, i) => [b[i + 2], b[i]] : GS.view === 'xz' ? (b, i) => [b[i], b[i + 2]] : GS.view === 'yz' ? (b, i) => [b[i + 1], b[i + 2]] : (b, i) => [b[i], b[i + 1]];
  function fit(w, h) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    const S = R.segs;
    for (let i = 0; i < S.length; i += 7) {
      for (const o of [1, 4]) { const p = proj(S, i + o); if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
    }
    if (GS.lathe && isFinite(y0)) { y0 = Math.min(y0, 0); }
    if (!isFinite(x0)) { x0 = -1; x1 = 1; y0 = -1; y1 = 1; }
    const sx = x1 - x0 || 1, sy = y1 - y0 || 1, pad = 24;
    const k = Math.min((w - 2 * pad) / sx, (h - 2 * pad) / sy);
    return { k, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  }
  function draw() {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(200, cv.clientWidth || 600), h = Math.max(200, cv.clientHeight || 420);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = gsVar('--panel'); g.fillRect(0, 0, w, h);
    el.querySelector('#gsvlab').textContent = GS.lathe ? 'Z across, X up as radius (diameter halved); the side above the centreline' : GS.view === 'xy' ? 'XY plane, seen from +Z' : GS.view === 'xz' ? 'XZ plane, seen from -Y' : 'YZ plane, seen from +X';
    if (!R || !R.nsegs) { g.fillStyle = gsVar('--muted'); g.font = '12px sans-serif'; g.fillText('No moves to draw.', 12, 22); return; }
    if (!view) view = fit(w, h);
    const P = (u, v) => [w / 2 + (u - view.cx) * view.k, h / 2 - (v - view.cy) * view.k];
    const S = R.segs, s = R.step(GS.step), done = s.seg1, c0 = s.seg0;
    // Origin and lathe centreline.
    g.lineWidth = 1; g.strokeStyle = gsVar('--muted'); g.setLineDash([]);
    const o = P(0, 0); g.beginPath(); g.moveTo(o[0] - 7, o[1]); g.lineTo(o[0] + 7, o[1]); g.moveTo(o[0], o[1] - 7); g.lineTo(o[0], o[1] + 7); g.stroke();
    if (GS.lathe) { g.setLineDash([10, 3, 2, 3]); g.beginPath(); g.moveTo(0, o[1]); g.lineTo(w, o[1]); g.stroke(); g.setLineDash([]); }
    const path = (from, to, rapid) => {
      g.beginPath();
      for (let j = from; j < to; j++) {
        const i = j * 7; if ((S[i] === 1) !== rapid) continue;
        const a = proj(S, i + 1), b = proj(S, i + 4), pa = P(a[0], a[1]), pb = P(b[0], b[1]);
        g.moveTo(pa[0], pa[1]); g.lineTo(pb[0], pb[1]);
      }
      g.stroke();
    };
    // Not reached yet.
    g.strokeStyle = gsVar('--line'); g.lineWidth = 1; g.setLineDash([3, 3]); path(done, R.nsegs, true); g.setLineDash([]); path(done, R.nsegs, false);
    // Done.
    g.strokeStyle = gsVar('--muted'); g.lineWidth = 1; g.setLineDash([4, 3]); path(0, done, true);
    g.setLineDash([]); g.strokeStyle = gsVar('--accent'); g.lineWidth = 1.5; path(0, done, false);
    // Current block.
    g.strokeStyle = gsVar('--t'); g.lineWidth = 3; path(c0, done, false); g.setLineDash([4, 3]); g.lineWidth = 2; path(c0, done, true); g.setLineDash([]);
    // Tool position.
    const tp = GS.lathe ? P(s.z, s.x) : GS.view === 'xz' ? P(s.x, s.z) : GS.view === 'yz' ? P(s.y, s.z) : P(s.x, s.y);
    g.strokeStyle = gsVar('--ink'); g.lineWidth = 1.2; g.beginPath(); g.arc(tp[0], tp[1], 5, 0, 2 * Math.PI); g.stroke();
    // Scale bar.
    const target = 80 / view.k, p10 = Math.pow(10, Math.floor(Math.log10(target))), step = [1, 2, 5, 10].map(m => m * p10).find(m => m >= target) || target;
    const bl = step * view.k; g.strokeStyle = gsVar('--muted'); g.lineWidth = 1;
    g.beginPath(); g.moveTo(10, h - 12); g.lineTo(10 + bl, h - 12); g.moveTo(10, h - 16); g.lineTo(10, h - 8); g.moveTo(10 + bl, h - 16); g.lineTo(10 + bl, h - 8); g.stroke();
    g.fillStyle = gsVar('--muted'); g.font = '11px sans-serif'; g.fillText(+step.toPrecision(3) + ' ' + U, 16 + bl, h - 8);
  }
  // Zoom and pan.
  cv.onwheel = e => {
    if (!view) return; e.preventDefault();
    const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, w = r.width, h = r.height;
    const u = view.cx + (mx - w / 2) / view.k, v = view.cy - (my - h / 2) / view.k;
    const f = e.deltaY < 0 ? 1.25 : 0.8; view.k *= f;
    view.cx = u - (mx - w / 2) / view.k; view.cy = v + (my - h / 2) / view.k; draw();
  };
  let drag = null;
  cv.onpointerdown = e => { if (!view) return; drag = { x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy }; cv.setPointerCapture(e.pointerId); };
  cv.onpointermove = e => { if (!drag) return; view.cx = drag.cx - (e.clientX - drag.x) / view.k; view.cy = drag.cy + (e.clientY - drag.y) / view.k; draw(); };
  cv.onpointerup = cv.onpointercancel = () => { drag = null; };
  el.querySelector('#gsfit').onclick = () => { view = null; draw(); };

  // Controls.
  let deb = null;
  ta.oninput = () => {
    GS_TEXT = ta.value; GS.step = -1;
    clearTimeout(deb); deb = setTimeout(() => { try { if (GS_TEXT.length < 300000) localStorage.setItem('bm.gsim.text', GS_TEXT); } catch (e) {} run(); }, 300);
  };
  const setText = t => { GS_TEXT = t; ta.value = t; GS.step = -1; try { localStorage.setItem('bm.gsim.text', t.length < 300000 ? t : ''); } catch (e) {} run(); };
  const example = (lathe, t) => { if (GS.lathe !== lathe) { GS.lathe = lathe; GS.step = -1; GS_TEXT = t; try { localStorage.setItem('bm.gsim.text', t); } catch (e) {} renderGsim(el); } else setText(t); };
  el.querySelector('#gsexm').onclick = () => example(false, GS_EX_MILL);
  el.querySelector('#gsexl').onclick = () => example(true, GS_EX_LATHE);
  el.querySelector('#gsclr').onclick = () => setText('');
  const file = el.querySelector('#gsfile');
  el.querySelector('#gsload').onclick = () => file.click();
  file.onchange = () => {
    const f = file.files && file.files[0]; if (!f) return;
    if (f.size > 20e6) { el.querySelector('#gsinfo').textContent = 'File is larger than 20 MB; not loaded.'; return; }
    const rd = new FileReader();
    rd.onload = () => setText(String(rd.result).replace(/\r\n?/g, '\n'));
    rd.readAsText(f);
  };
  el.querySelector('#gsmach').onchange = e => { GS.lathe = e.target.value === '1'; GS.step = -1; renderGsim(el); };
  el.querySelector('#gsctrl').onchange = e => { GS.ctrl = +e.target.value; run(); };
  el.querySelector('#gspu').onchange = e => { GS.punits = e.target.value; run(); };
  el.querySelectorAll('input[data-k]').forEach(i => i.oninput = () => { GS[i.dataset.k] = i.value; run(); });
  el.querySelectorAll('#gsview button').forEach(b => b.onclick = () => { GS.view = b.dataset.v; renderGsim(el); });
  range.oninput = () => setStep(+range.value);
  el.querySelector('#gsfirst').onclick = () => setStep(0);
  el.querySelector('#gsprev').onclick = () => setStep(GS.step - 1);
  el.querySelector('#gsnext').onclick = () => setStep(GS.step + 1);
  el.querySelector('#gslast').onclick = () => setStep(R ? R.nsteps - 1 : 0);
  const play = el.querySelector('#gsplay');
  play.onclick = () => {
    if (GS.timer) { clearInterval(GS.timer); GS.timer = null; play.textContent = 'Play'; return; }
    if (R && GS.step >= R.nsteps - 1) setStep(0);
    play.textContent = 'Pause';
    GS.timer = setInterval(() => {
      if (!document.body.contains(cv) || !R || GS.step >= R.nsteps - 1) { clearInterval(GS.timer); GS.timer = null; if (document.body.contains(play)) play.textContent = 'Play'; return; }
      setStep(GS.step + 1);
    }, 120);
  };
  list.onclick = e => { const d = e.target.closest('.gl[data-l]'); if (d) jumpLine(+d.dataset.l); };
  // Keyboard stepping on the canvas.
  cv.tabIndex = 0;
  cv.onkeydown = e => { if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { setStep(GS.step + 1); e.preventDefault(); } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { setStep(GS.step - 1); e.preventDefault(); } };
  // Redraw on resize and on a theme or accent colour change.
  if (typeof ResizeObserver === 'function') { const ro = new ResizeObserver(() => { if (!document.body.contains(cv)) { ro.disconnect(); return; } view = null; draw(); }); ro.observe(cv); }
  const mo = new MutationObserver(() => { if (!document.body.contains(cv)) { mo.disconnect(); return; } draw(); });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style'] });
  run();
}
