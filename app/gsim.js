'use strict';
// G-code editor and simulator: paste, type or load a program, see the programmed
// path from any side (view cube), step through it block by block, read the
// distances and the time estimate, and tidy or convert the text.
// Parsing, arcs, cycles, distances and times come from the Rust core
// (core/src/gsim.rs); renumbering, stripping, inch/mm conversion and telling a
// lathe from a mill program from core/src/gtidy.rs. This file draws the canvas
// (the camera is layout only), keeps the undo history and fills the tables.
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
// mach: 'auto' (lathe or mill told from the program), 'mill' or 'lathe'. az, el: the 3D camera in degrees
// (el 90 looks down the Z axis, el 0 is a side view; az turns about Z). view names the preset in use.
const GS = { mach: 'auto', lathe: null, why: '', ctrl: 0, punits: null, rapid: '', tol: '', vmax: '', view: 'xy', az: 0, el: 90, step: -1, timer: null, speed: 8, line: 1 };
const GS_LEV = ['Error', 'Warning', 'Note'];
const GS_VIEWS = { xy: [0, 90, 'XY: top view, seen from +Z'], xz: [0, 0, 'XZ: front view, seen from -Y'], yz: [90, 0, 'YZ: side view, seen from +X'], '3d': [45, 35.264, '3D view'] };
// Faces of the view cube: outward normal, label, the camera that looks straight at the face.
const GS_FACES = [[[0, 0, 1], 'TOP', 0, 90], [[0, 0, -1], 'BOTTOM', 0, -90], [[0, -1, 0], 'FRONT', 0, 0], [[0, 1, 0], 'BACK', 180, 0], [[1, 0, 0], 'RIGHT', 90, 0], [[-1, 0, 0], 'LEFT', -90, 0]];
// Undo history of the program text (whole-text snapshots, newest last).
const GS_HIST = { list: [], i: -1 };
const GS_TIDY = { numbers: 0, start: 10, step: 10, all: false, comments: false, blank: false, spacing: 0, upper: false, ints: 0 };

function gsVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888'; }

// Write the program text where the core reads it; returns the byte length.
function gsPut(text) {
  const W = state.W, bytes = new TextEncoder().encode(text);
  const p = W.gsim_in(bytes.length);
  new Uint8Array(W.memory.buffer, p, bytes.length).set(bytes);
  return bytes.length;
}
const gsGet = len => (len ? new TextDecoder().decode(new Uint8Array(state.W.memory.buffer, state.W.text_ptr(), len)) : '');
const gsMsgs = txt => (txt ? txt.split('\n').map(l => { const a = l.split('\t'); return { line: +a[0], level: +a[1], text: a.slice(2).join(' ') }; }) : []);

function gsRun(text, opt) {
  const W = state.W;
  const n = gsPut(text);
  const nsteps = W.gsim_run(n, opt.lathe ? 1 : 0, opt.ctrl, opt.metric ? 1 : 0, opt.pmetric ? 1 : 0, opt.rapid > 0 ? opt.rapid : 0, opt.tol > 0 ? opt.tol : 0, opt.vmax > 0 ? opt.vmax : 0);
  // Copy out: the views die when the memory grows.
  const segs = new Float64Array(W.memory.buffer, W.gsim_segs_ptr(), W.gsim_segs_len()).slice();
  const sw = W.gsim_step_w();
  const steps = new Float64Array(W.memory.buffer, W.gsim_steps_ptr(), W.gsim_steps_len()).slice();
  const stats = []; for (let i = 0; i < 22; i++) stats.push(W.gsim_stat(i));
  const msgs = gsMsgs(gsGet(W.gsim_msgs()));
  const st = i => ({ line: steps[i * sw], seg0: steps[i * sw + 1], seg1: steps[i * sw + 2], x: steps[i * sw + 3], y: steps[i * sw + 4], z: steps[i * sw + 5],
    feed: steps[i * sw + 6], perRev: steps[i * sw + 7] === 1, rpm: steps[i * sw + 8], tool: steps[i * sw + 9], time: steps[i * sw + 10] });
  return { nsteps, segs, nsegs: segs.length / 7, step: st, stats, msgs };
}

// Lathe or mill: the choice in the Machine box, or told from the program by the core (gtidy::detect_machine).
function gsMachine(text) {
  if (GS.mach !== 'auto') { GS.why = ''; return GS.mach === 'lathe'; }
  const W = state.W, k = W.gdetect(gsPut(text));
  GS.why = gsGet(W.gtidy_msgs());
  if (k >= 0) return k === 1;
  const prof = typeof gmProfileType === 'function' ? gmProfileType() : '';
  GS.why += prof ? '. Using the active machine: ' + (prof === 'L' ? 'lathe' : 'mill') : '. Using mill';
  return prof === 'L';
}

// Another tool hands a finished program over: it becomes the program in the editor.
function gsOpenText(t) {
  GS_TEXT = t; GS.step = -1;
  try { localStorage.setItem('bm.gsim.text', t.length < 300000 ? t : ''); } catch (e) {}
  if (GS_HIST.list.length && GS_HIST.list[GS_HIST.i] !== t) { GS_HIST.list = GS_HIST.list.slice(0, GS_HIST.i + 1); GS_HIST.list.push(t); GS_HIST.i = GS_HIST.list.length - 1; }
  openTool('gsim');
}

function renderGsim(el, keep) {
  if (GS.timer) { clearInterval(GS.timer); GS.timer = null; }
  const inch = state.sys === 'inch', U = inch ? 'in' : 'mm';
  if (GS_TEXT === null) GS_TEXT = (typeof gmProfileType === 'function' && gmProfileType() === 'L') ? GS_EX_LATHE : GS_EX_MILL;
  GS.lathe = gsMachine(GS_TEXT);
  if (GS.punits === null) GS.punits = inch ? 'inch' : 'mm';
  if (!GS_HIST.list.length) { GS_HIST.list = [GS_TEXT]; GS_HIST.i = 0; }
  const ctrlOpts = CTRLS.map(([v, t]) => '<option value="' + v + '"' + (v > 1 ? ' disabled' : '') + (+GS.ctrl === v ? ' selected' : '') + '>' + sesc(t) + (v > 1 ? ' (not yet supported)' : '') + '</option>').join('');
  const views = GS.lathe ? [] : ['xy', 'xz', 'yz', '3d'];
  const sel = (v, cur) => (String(v) === String(cur) ? ' selected' : ''), chk = b => (b ? ' checked' : '');
  el.innerHTML =
    '<p class="gsbanner">Backplot of the programmed path only. It is not a machine verification: no stock, tool shape, compensation, machine limits, fixtures or collisions are checked. Prove out every program on the machine.</p>' +
    '<div class="grid">' +
      sfield('Machine', '<select id="gsmach"><option value="auto"' + sel('auto', GS.mach) + '>Auto: ' + (GS.lathe ? 'lathe' : 'mill') + '</option><option value="mill"' + sel('mill', GS.mach) + '>Mill (X, Y, Z)</option><option value="lathe"' + sel('lathe', GS.mach) + '>Lathe (X diameter, Z)</option></select>', '') +
      sfield('Control', '<select id="gsctrl">' + ctrlOpts + '</select>', '') +
      sfield('Units if no G20 / G21', '<select id="gspu"><option value="mm"' + sel('mm', GS.punits) + '>mm (G21)</option><option value="inch"' + sel('inch', GS.punits) + '>inch (G20)</option></select>', '') +
      sfield('Rapid rate (blank = active machine)', sinp('rapid', GS.rapid, 110), inch ? 'in/min' : 'mm/min') +
      sfield('Arc radius tolerance (blank = ' + (inch ? '0.0002' : '0.005') + ')', sinp('tol', GS.tol, 110), U) +
      (GS.lathe ? sfield('Max rpm for G96 if no G50', sinp('vmax', GS.vmax, 110), 'RPM') : '') +
    '</div>' +
    (GS.mach === 'auto' ? '<p class="ms gswhy" id="gswhy">' + sesc(GS.why) + '</p>' : '') +
    '<label class="f" style="display:block"><span>Program (paste, type or load a file)</span>' +
    '<textarea id="gstext" rows="10" spellcheck="false" class="gstext"></textarea></label>' +
    '<div class="mfilter gsbar"><button class="btn" id="gsundo" title="Undo the last change to the program (Ctrl+Z)">Undo</button><button class="btn" id="gsredo" title="Redo (Ctrl+Y)">Redo</button>' +
    '<button class="btn" id="gsins" title="Insert an empty line after the current line">Insert line</button><button class="btn" id="gsdel" title="Delete the current line">Delete line</button>' +
    '<button class="btn" id="gstidyb" aria-expanded="false">Tidy</button><button class="btn" id="gsconvb" aria-expanded="false">Inch / mm</button><span class="ms" id="gsline"></span></div>' +
    '<div class="gspanel" id="gstidy" hidden><div class="grid">' +
      sfield('Sequence numbers (N)', '<select id="gtnum"><option value="0"' + sel(0, GS_TIDY.numbers) + '>Leave</option><option value="1"' + sel(1, GS_TIDY.numbers) + '>Renumber</option><option value="2"' + sel(2, GS_TIDY.numbers) + '>Remove</option></select>', '') +
      sfield('Start at', '<input id="gtstart" type="number" min="0" step="1" value="' + GS_TIDY.start + '" style="width:90px;font-family:var(--mono)">', '') +
      sfield('Step', '<input id="gtstep" type="number" min="1" step="1" value="' + GS_TIDY.step + '" style="width:90px;font-family:var(--mono)">', '') +
      sfield('Spaces', '<select id="gtsp"><option value="0"' + sel(0, GS_TIDY.spacing) + '>Leave</option><option value="1"' + sel(1, GS_TIDY.spacing) + '>One between words</option><option value="2"' + sel(2, GS_TIDY.spacing) + '>None</option></select>', '') +
    '</div><div class="gschk"><label><input type="checkbox" id="gtall"' + chk(GS_TIDY.all) + '> Number every block, not only the numbered ones</label>' +
      '<label><input type="checkbox" id="gtcom"' + chk(GS_TIDY.comments) + '> Remove comments (the program name on the O line stays)</label>' +
      '<label><input type="checkbox" id="gtblank"' + chk(GS_TIDY.blank) + '> Remove blank lines</label>' +
      '<label><input type="checkbox" id="gtup"' + chk(GS_TIDY.upper) + '> Upper case</label></div>' +
      '<p class="ms">Blocks named by number keep working: the P and Q of the lathe cycles G70 to G73, M97 and M99 P, and GOTO follow the new numbers. Macro statements are not re-spaced.</p>' +
      '<button class="btn" id="gtgo">Apply to the program</button></div>' +
    '<div class="gspanel" id="gsconv" hidden><div class="grid">' +
      sfield('Convert the program to', '<select id="gcto"><option value="1">mm (G21)</option><option value="0">inch (G20)</option></select>', '') +
      sfield('A length with no decimal point is', '<select id="gcint"><option value="0"' + sel(0, GS_TIDY.ints) + '>whole units (X1 = 1 in or 1 mm)</option><option value="1"' + sel(1, GS_TIDY.ints) + '>least increments (X1 = 0.0001 in or 0.001 mm)</option></select>', '') +
    '</div><p class="ms">Lengths, feeds and G96 surface speeds are converted and G20 / G21 is swapped. Offsets and parameters stored in the control are not in the program: change those at the machine. Check the result before you run it; Undo brings the old program back.</p>' +
      '<button class="btn" id="gcgo">Convert the program</button></div>' +
    '<div id="gsrep"></div>' +
    '<div class="mfilter gsbar"><button class="btn" id="gsload">Load file</button><input type="file" id="gsfile" accept=".nc,.ngc,.tap,.txt,.cnc,.gcode,.mpf,.eia,.min,.ptp,text/plain" hidden>' +
    '<button class="btn" id="gssave">Save file</button><button class="btn" id="gsexm">Mill example</button><button class="btn" id="gsexl">Lathe example</button><button class="btn" id="gsclr">Clear</button><span class="ms" id="gsinfo"></span></div>' +
    '<div class="gsmain"><div class="gsplotcol">' +
      '<div class="mfilter gsbar">' + (views.length ? '<div class="seg" id="gsview">' + views.map(v => '<button data-v="' + v + '"' + (GS.view === v ? ' class="on"' : '') + ' title="' + sesc(GS_VIEWS[v][2]) + '">' + v.toUpperCase() + '</button>').join('') + '</div>' : '') +
      '<button class="btn" id="gsfit">Fit</button><span class="ms" id="gshint"></span></div>' +
      '<div class="gscvwrap"><canvas id="gscv" class="gscv" role="img" aria-label="Toolpath backplot"></canvas>' +
      (GS.lathe ? '' : '<canvas id="gscube" class="gscube" width="96" height="96" role="img" aria-label="View cube: click a face to look at it, drag to turn the view"></canvas>') + '</div>' +
      '<p class="ms gskey"><span class="gkey gkp"></span> feed &nbsp; <span class="gkey gkr"></span> rapid &nbsp; <span class="gkey gkc"></span> current block &nbsp; <span class="gkey gkf"></span> not reached yet &nbsp; <span id="gsvlab"></span></p>' +
      '<div class="mfilter gsbar gsscrub"><button class="btn" id="gsfirst" title="First block">|&lt;</button><button class="btn" id="gsprev" title="Previous block">&lt;</button>' +
      '<button class="btn" id="gsplay">Play</button><button class="btn" id="gsnext" title="Next block">&gt;</button><button class="btn" id="gslast" title="Last block">&gt;|</button>' +
      '<select id="gsspeed" aria-label="Playback speed" title="Playback speed"><option value="2"' + sel(2, GS.speed) + '>2 blocks/s</option><option value="8"' + sel(8, GS.speed) + '>8 blocks/s</option><option value="30"' + sel(30, GS.speed) + '>30 blocks/s</option></select>' +
      '<input type="range" id="gsrange" min="0" max="0" value="0" aria-label="Block"></div>' +
      '<div class="res gscur" id="gscur"></div>' +
    '</div><div class="gslist" id="gslist" aria-label="Program listing"></div></div>' +
    '<div id="gsstats"></div><div id="gsmsgs"></div>';
  const $q = s => el.querySelector(s);
  const ta = $q('#gstext'); ta.value = GS_TEXT;
  const cv = $q('#gscv'), cube = $q('#gscube'), list = $q('#gslist'), range = $q('#gsrange');
  let R = null, lines = [], view = null, lineDivs = [], lineFirstStep = new Map();
  if (keep && keep.focus) { ta.focus(); try { ta.setSelectionRange(keep.a, keep.b); } catch (e) {} }

  const opts = () => {
    const rp = cyRapid({ rapid: GS.rapid });
    return { lathe: GS.lathe, ctrl: +GS.ctrl, metric: !inch, pmetric: GS.punits === 'mm', rapid: rp.v, rapidFrom: rp.from, tol: snum(GS.tol), vmax: snum(GS.vmax) };
  };

  function run() {
    // Auto: the program may now read as the other kind of machine. The page is laid out again (views, fields).
    if (GS.mach === 'auto') {
      const was = GS.lathe, now = gsMachine(GS_TEXT);
      if (now !== was) { GS.step = -1; renderGsim(el, { focus: document.activeElement === ta, a: ta.selectionStart, b: ta.selectionEnd }); return false; }
      const w = $q('#gswhy'); if (w) w.textContent = GS.why;
    }
    const o = opts();
    lines = GS_TEXT.split('\n');
    try { R = gsRun(GS_TEXT, o); } catch (e) { R = null; $q('#gsinfo').textContent = 'Could not run the backplot: ' + e.message; return; }
    R.o = o;
    lineFirstStep = new Map();
    for (let i = 0; i < R.nsteps; i++) { const l = R.step(i).line; if (!lineFirstStep.has(l)) lineFirstStep.set(l, i); }
    range.max = Math.max(0, R.nsteps - 1);
    if (GS.step < 0 || GS.step >= R.nsteps) GS.step = R.nsteps - 1;
    range.value = Math.max(0, GS.step);
    $q('#gsinfo').textContent = lines.length + ' lines, ' + R.nsteps + ' blocks run, ' + R.nsegs + ' path pieces';
    buildList(); stats(); msgs(); view = null; draw(); cur();
    // While typing, the line with the caret is the current line.
    if (document.activeElement === ta) caretLine();
    hist();
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
    $q('#gsstats').innerHTML = '<div class="res" style="margin-top:12px">' + stable('Program statistics (' + (inch ? 'inch' : 'mm') + ')', rows) + '</div>' +
      '<p class="ms" style="max-width:760px">Time = path length / F per block (feed per revolution: / (F x rpm), with G96 the rpm follows the diameter up to the G50 clamp). Helical arcs are timed along the arc in the plane. Acceleration and deceleration, block processing, tool changes, spindle start, M-code waits and the G28 travel to the reference point are ignored, so the real time is longer.</p>';
  }

  const msgRows = list => list.map(m => '<tr class="gm' + m.level + '" data-l="' + m.line + '"><td class="gml">' + (m.line ? 'Line ' + m.line : 'Program') + '</td><td class="gmk">' + GS_LEV[m.level] + '</td><td>' + sesc(m.text) + '</td></tr>').join('');
  function msgs() {
    const errs = R.stats[19], warns = R.stats[20];
    let h = '<div class="res gsmsg" style="margin-top:12px"><div class="h">Messages: ' + errs + ' error' + (errs === 1 ? '' : 's') + ', ' + warns + ' warning' + (warns === 1 ? '' : 's') + '</div><table>';
    if (!R.msgs.length) h += '<tr><td class="ms">No errors or warnings.</td></tr>';
    h += msgRows(R.msgs) + '</table></div>';
    $q('#gsmsgs').innerHTML = h;
    el.querySelectorAll('#gsmsgs tr[data-l]').forEach(tr => tr.onclick = () => jumpLine(+tr.dataset.l));
  }

  function setLine(n) {
    GS.line = Math.max(1, Math.min(lines.length || 1, n));
    $q('#gsline').textContent = 'Current line: ' + GS.line;
  }
  function jumpLine(n) {
    if (!R) return;
    setLine(n);
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
    const box = $q('#gscur');
    if (!R || !R.nsteps) { box.innerHTML = '<div class="h">No blocks</div>'; setLine(GS.line); return; }
    const s = R.step(GS.step), n = s.line, dp = inch ? 4 : 3;
    setLine(n);
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
  // The camera: r is the direction across the screen, u up the screen, d towards the eye (unit vectors in X, Y, Z).
  // Lathe: Z across, X (radius) up.
  function basis() {
    if (GS.lathe) return { r: [0, 0, 1], u: [1, 0, 0], d: [0, -1, 0] };
    const a = GS.az * Math.PI / 180, e = GS.el * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), se = Math.sin(e), ce = Math.cos(e);
    return { r: [c, s, 0], u: [-s * se, c * se, ce], d: [s * ce, -c * ce, se] };
  }
  let B = basis();
  const dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
  const proj = (b, i) => [b[i] * B.r[0] + b[i + 1] * B.r[1] + b[i + 2] * B.r[2], b[i] * B.u[0] + b[i + 1] * B.u[1] + b[i + 2] * B.u[2]];
  function fit(w, h) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    const S = R.segs;
    for (let i = 0; i < S.length; i += 7) {
      for (const o of [1, 4]) {
        const p = proj(S, i + o); if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1];
        for (let j = 0; j < 3; j++) { const q = S[i + o + j]; if (q < lo[j]) lo[j] = q; if (q > hi[j]) hi[j] = q; }
      }
    }
    if (GS.lathe && isFinite(y0)) { y0 = Math.min(y0, 0); }
    if (!isFinite(x0)) { x0 = -1; x1 = 1; y0 = -1; y1 = 1; lo.fill(0); hi.fill(0); }
    const sx = x1 - x0 || 1, sy = y1 - y0 || 1, pad = 24;
    const k = Math.min((w - 2 * pad) / sx, (h - 2 * pad) / sy);
    // The pivot: the middle of the path in space, moved in the screen plane to the middle of what is drawn.
    const c = [0, 1, 2].map(j => (lo[j] + hi[j]) / 2), dr = (x0 + x1) / 2 - dot(c, B.r), du = (y0 + y1) / 2 - dot(c, B.u);
    return { k, c: c.map((v, j) => v + dr * B.r[j] + du * B.u[j]) };
  }
  function draw() {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(200, cv.clientWidth || 600), h = Math.max(200, cv.clientHeight || 420);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = gsVar('--panel'); g.fillRect(0, 0, w, h);
    B = basis();
    $q('#gsvlab').textContent = GS.lathe ? 'Z across, X up as radius (diameter halved); the side above the centreline' : GS_VIEWS[GS.view] && GS.view !== '3d' ? GS_VIEWS[GS.view][2] : '3D view';
    $q('#gshint').textContent = GS.lathe || GS.view !== '3d' ? 'Wheel to zoom, drag to move.' + (GS.lathe ? '' : ' Drag the cube to turn the view.') : 'Wheel to zoom, drag to turn, Shift and drag to move.';
    drawCube();
    if (!R || !R.nsegs) { g.fillStyle = gsVar('--muted'); g.font = '12px sans-serif'; g.fillText('No moves to draw.', 12, 22); return; }
    if (!view) view = fit(w, h);
    const cr = dot(view.c, B.r), cu = dot(view.c, B.u);
    const P = (a, b) => [w / 2 + (a - cr) * view.k, h / 2 - (b - cu) * view.k];
    const P3 = p => P(dot(p, B.r), dot(p, B.u));
    const S = R.segs, s = R.step(GS.step), done = s.seg1, c0 = s.seg0;
    // Origin with its axes, and the lathe centreline.
    g.lineWidth = 1; g.strokeStyle = gsVar('--muted'); g.fillStyle = gsVar('--muted'); g.font = '10px sans-serif'; g.setLineDash([]);
    const o = P(0, 0);
    (GS.lathe ? [['Z', [0, 0, 1]], ['X', [1, 0, 0]]] : [['X', [1, 0, 0]], ['Y', [0, 1, 0]], ['Z', [0, 0, 1]]]).forEach(([n, a]) => {
      const dx = dot(a, B.r), dy = dot(a, B.u), len = Math.hypot(dx, dy);
      if (len < 0.15) return;
      g.beginPath(); g.moveTo(o[0], o[1]); g.lineTo(o[0] + dx * 26, o[1] - dy * 26); g.stroke();
      g.fillText(n, o[0] + dx * 26 + (dx / len) * 6 - 3, o[1] - dy * 26 - (dy / len) * 6 + 3);
    });
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
    // Tool position; in a tilted view a short line shows which way the tool axis (Z) points.
    const tp = P3([s.x, s.y, s.z]);
    g.strokeStyle = gsVar('--ink'); g.lineWidth = 1.2; g.beginPath(); g.arc(tp[0], tp[1], 5, 0, 2 * Math.PI); g.stroke();
    if (!GS.lathe && Math.abs(B.u[2]) > 0.15) { g.beginPath(); g.moveTo(tp[0], tp[1] - 5 * Math.sign(B.u[2])); g.lineTo(tp[0], tp[1] - 30 * B.u[2]); g.stroke(); }
    // Scale bar.
    const target = 80 / view.k, p10 = Math.pow(10, Math.floor(Math.log10(target))), step = [1, 2, 5, 10].map(m => m * p10).find(m => m >= target) || target;
    const bl = step * view.k; g.strokeStyle = gsVar('--muted'); g.lineWidth = 1;
    g.beginPath(); g.moveTo(10, h - 12); g.lineTo(10 + bl, h - 12); g.moveTo(10, h - 16); g.lineTo(10, h - 8); g.moveTo(10 + bl, h - 16); g.lineTo(10 + bl, h - 8); g.stroke();
    g.fillStyle = gsVar('--muted'); g.font = '11px sans-serif'; g.fillText(+step.toPrecision(3) + ' ' + U, 16 + bl, h - 8);
  }

  // ---- view cube (mill) ----
  const CUBE_V = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
  const CUBE_F = [[4, 5, 6, 7], [0, 3, 2, 1], [0, 1, 5, 4], [2, 3, 7, 6], [1, 2, 6, 5], [0, 4, 7, 3]]; // same order as GS_FACES
  let cubeFaces = [];
  function drawCube() {
    if (!cube) return;
    const dpr = window.devicePixelRatio || 1, n = 96;
    if (cube.width !== Math.round(n * dpr)) { cube.width = cube.height = Math.round(n * dpr); }
    const g = cube.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, n, n);
    const pt = v => [n / 2 + 25 * dot(v, B.r), n / 2 - 25 * dot(v, B.u)];
    cubeFaces = [];
    GS_FACES.forEach((f, i) => {
      const facing = dot(f[0], B.d);
      if (facing < 0.02) return;
      const poly = CUBE_F[i].map(k => pt(CUBE_V[k]));
      g.beginPath(); poly.forEach((p, k) => (k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath();
      g.fillStyle = gsVar('--raise'); g.fill(); g.strokeStyle = gsVar('--muted'); g.lineWidth = 1; g.stroke();
      if (facing > 0.4) { const c = pt(f[0]); g.fillStyle = gsVar('--ink'); g.font = '8px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(f[1], c[0], c[1]); }
      cubeFaces.push({ poly, i });
    });
  }
  const inPoly = (p, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
  function setCam(az, elv, name) {
    GS.az = ((az + 180) % 360 + 360) % 360 - 180; GS.el = Math.max(-90, Math.min(90, elv)); GS.view = name;
    el.querySelectorAll('#gsview button').forEach(b => b.classList.toggle('on', b.dataset.v === name));
  }
  // Turn the view about the pivot: the middle of the path stays where it is on the screen.
  const orbit = (d, e) => { setCam(d.az - (e.clientX - d.x) * 0.4, d.el + (e.clientY - d.y) * 0.4, '3d'); draw(); };
  if (cube) {
    let cd = null;
    cube.onpointerdown = e => { cd = { x: e.clientX, y: e.clientY, az: GS.az, el: GS.el, moved: false }; cube.setPointerCapture(e.pointerId); e.preventDefault(); };
    cube.onpointermove = e => { if (!cd) return; if (Math.abs(e.clientX - cd.x) + Math.abs(e.clientY - cd.y) > 3) cd.moved = true; if (cd.moved) orbit(cd, e); };
    cube.onpointerup = e => {
      if (cd && !cd.moved) {
        const r = cube.getBoundingClientRect(), p = [e.clientX - r.left, e.clientY - r.top], hit = cubeFaces.find(f => inPoly(p, f.poly));
        if (hit) { const f = GS_FACES[hit.i], name = hit.i === 0 ? 'xy' : hit.i === 2 ? 'xz' : hit.i === 4 ? 'yz' : '3d'; setCam(f[2], f[3], name); view = null; draw(); }
      }
      cd = null;
    };
    cube.onpointercancel = () => { cd = null; };
  }

  // Zoom and move.
  cv.onwheel = e => {
    if (!view) return; e.preventDefault();
    const r = cv.getBoundingClientRect(), mx = e.clientX - r.left - r.width / 2, my = e.clientY - r.top - r.height / 2;
    const k1 = view.k * (e.deltaY < 0 ? 1.25 : 0.8), sh = 1 / view.k - 1 / k1;
    // the point under the pointer stays under the pointer
    view.c = view.c.map((v, j) => v + mx * sh * B.r[j] - my * sh * B.u[j]); view.k = k1; draw();
  };
  let drag = null;
  cv.onpointerdown = e => { if (!view) return; drag = { x: e.clientX, y: e.clientY, c: view.c.slice(), az: GS.az, el: GS.el, turn: !GS.lathe && GS.view === '3d' && !e.shiftKey }; cv.setPointerCapture(e.pointerId); };
  cv.onpointermove = e => {
    if (!drag) return;
    if (drag.turn) { orbit(drag, e); return; }
    const dx = (e.clientX - drag.x) / view.k, dy = (e.clientY - drag.y) / view.k;
    view.c = drag.c.map((v, j) => v - dx * B.r[j] + dy * B.u[j]); draw();
  };
  cv.onpointerup = cv.onpointercancel = () => { drag = null; };
  $q('#gsfit').onclick = () => { view = null; draw(); };

  // ---- the program text: edits, undo, tidy, convert ----
  const store = t => { try { localStorage.setItem('bm.gsim.text', t.length < 300000 ? t : ''); } catch (e) {} };
  function hist() {
    $q('#gsundo').disabled = GS_HIST.i <= 0; $q('#gsredo').disabled = GS_HIST.i >= GS_HIST.list.length - 1;
  }
  function remember(t) {
    if (GS_HIST.list[GS_HIST.i] === t) return;
    GS_HIST.list = GS_HIST.list.slice(Math.max(0, GS_HIST.i - 198), GS_HIST.i + 1); GS_HIST.list.push(t); GS_HIST.i = GS_HIST.list.length - 1;
  }
  // Replace the whole program. `line` (1-based) is where the caret goes, if given.
  const setText = (t, line, noHist) => {
    GS_TEXT = t; ta.value = t; GS.step = -1; store(t); if (!noHist) remember(t);
    if (run() === false) return; // the page was laid out again for the other kind of machine
    if (line) { jumpLine(line); const at = t.split('\n').slice(0, GS.line - 1).join('\n').length + (GS.line > 1 ? 1 : 0); ta.focus(); try { ta.setSelectionRange(at, at); } catch (e) {} }
  };
  const undo = d => { const i = GS_HIST.i + d; if (i < 0 || i >= GS_HIST.list.length) return; GS_HIST.i = i; setText(GS_HIST.list[i], 0, true); };
  let deb = null;
  ta.oninput = () => {
    GS_TEXT = ta.value; GS.step = -1;
    clearTimeout(deb); deb = setTimeout(() => { store(GS_TEXT); remember(GS_TEXT); run(); }, 300);
  };
  function caretLine() {
    const n = ta.value.slice(0, ta.selectionStart).split('\n').length;
    if (n !== GS.line && R) jumpLine(n);
  }
  ta.onclick = caretLine;
  ta.onkeyup = e => { if (/^(Arrow|Page|Home|End)/.test(e.key)) caretLine(); };
  ta.onkeydown = e => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'z' || k === 'y') { e.preventDefault(); clearTimeout(deb); remember(ta.value); GS_TEXT = ta.value; undo(k === 'y' || e.shiftKey ? 1 : -1); }
  };
  $q('#gsundo').onclick = () => undo(-1);
  $q('#gsredo').onclick = () => undo(1);
  $q('#gsins').onclick = () => { const l = GS_TEXT.split('\n'), at = Math.min(GS.line, l.length); l.splice(at, 0, ''); setText(l.join('\n'), at + 1); };
  $q('#gsdel').onclick = () => { const l = GS_TEXT.split('\n'); if (!l.length) return; const at = Math.min(GS.line, l.length) - 1; l.splice(at, 1); setText(l.join('\n'), Math.max(1, Math.min(at + 1, l.length))); };
  const panel = (btn, box, other, otherBtn) => { $q(btn).onclick = () => { const p = $q(box), open = p.hidden; p.hidden = !open; $q(btn).setAttribute('aria-expanded', open ? 'true' : 'false'); $q(other).hidden = true; $q(otherBtn).setAttribute('aria-expanded', 'false'); }; };
  panel('#gstidyb', '#gstidy', '#gsconv', '#gsconvb'); panel('#gsconvb', '#gsconv', '#gstidy', '#gstidyb');
  // Which way to convert: away from the unit the program is in.
  $q('#gcto').value = /\bG0?20\b/i.test(GS_TEXT) || (GS.punits === 'inch' && !/\bG0?21\b/i.test(GS_TEXT)) ? '1' : '0';
  // The messages are read before the program is run again (telling lathe from mill reuses the same text buffer).
  const tidyMsgs = () => gsMsgs(gsGet(state.W.gtidy_msgs()));
  function report(title, changed, ms) {
    $q('#gsrep').innerHTML = '<div class="res gsmsg" style="margin:8px 0"><div class="h">' + title + ': ' + changed + ' line' + (changed === 1 ? '' : 's') + ' changed</div><table>' +
      (ms.length ? msgRows(ms) : '<tr><td class="ms">No warnings.</td></tr>') + '</table></div>';
    el.querySelectorAll('#gsrep tr[data-l]').forEach(tr => tr.onclick = () => { if (+tr.dataset.l) jumpLine(+tr.dataset.l); });
  }
  $q('#gtgo').onclick = () => {
    const W = state.W, T = GS_TIDY;
    T.numbers = +$q('#gtnum').value; T.start = Math.max(0, Math.round(snum($q('#gtstart').value) || 0)); T.step = Math.max(1, Math.round(snum($q('#gtstep').value) || 1));
    T.spacing = +$q('#gtsp').value; T.all = $q('#gtall').checked; T.comments = $q('#gtcom').checked; T.blank = $q('#gtblank').checked; T.upper = $q('#gtup').checked;
    const changed = W.gtidy_run(gsPut(GS_TEXT), T.numbers, T.start, T.step, T.all ? 1 : 0, T.comments ? 1 : 0, T.blank ? 1 : 0, T.spacing, T.upper ? 1 : 0, GS.lathe ? 1 : 0);
    const t = gsGet(W.gtidy_text()), ms = tidyMsgs();
    setText(t); report('Tidy', changed, ms);
  };
  $q('#gcgo').onclick = () => {
    const W = state.W, toMm = $q('#gcto').value === '1';
    GS_TIDY.ints = +$q('#gcint').value;
    const changed = W.gconv_run(gsPut(GS_TEXT), toMm ? 1 : 0, GS.lathe ? 1 : 0, GS_TIDY.ints);
    const t = gsGet(W.gtidy_text()), ms = tidyMsgs();
    GS.punits = toMm ? 'mm' : 'inch'; $q('#gspu').value = GS.punits; $q('#gcto').value = toMm ? '0' : '1';
    setText(t); report('Converted to ' + (toMm ? 'mm' : 'inch'), changed, ms);
  };

  // Controls.
  const example = t => { GS.mach = 'auto'; setText(t); if ($q('#gsmach')) $q('#gsmach').value = 'auto'; };
  $q('#gsexm').onclick = () => example(GS_EX_MILL);
  $q('#gsexl').onclick = () => example(GS_EX_LATHE);
  $q('#gsclr').onclick = () => setText('');
  const file = $q('#gsfile');
  $q('#gsload').onclick = () => file.click();
  file.onchange = () => {
    const f = file.files && file.files[0]; if (!f) return;
    if (f.size > 20e6) { $q('#gsinfo').textContent = 'File is larger than 20 MB; not loaded.'; return; }
    const rd = new FileReader();
    rd.onload = () => setText(String(rd.result).replace(/\r\n?/g, '\n'));
    rd.readAsText(f);
  };
  $q('#gssave').onclick = () => {
    const m = /^\s*[O:]0*(\d+)/im.exec(GS_TEXT), a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([GS_TEXT.replace(/\n/g, '\r\n')], { type: 'text/plain' })); a.download = (m ? 'O' + m[1] : 'program') + '.nc';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  $q('#gsmach').onchange = e => { GS.mach = e.target.value; GS.step = -1; renderGsim(el); };
  $q('#gsctrl').onchange = e => { GS.ctrl = +e.target.value; run(); };
  $q('#gspu').onchange = e => { GS.punits = e.target.value; run(); };
  el.querySelectorAll('input[data-k]').forEach(i => i.oninput = () => { GS[i.dataset.k] = i.value; run(); });
  el.querySelectorAll('#gsview button').forEach(b => b.onclick = () => { const v = GS_VIEWS[b.dataset.v]; setCam(v[0], v[1], b.dataset.v); view = null; draw(); });
  range.oninput = () => setStep(+range.value);
  $q('#gsfirst').onclick = () => setStep(0);
  $q('#gsprev').onclick = () => setStep(GS.step - 1);
  $q('#gsnext').onclick = () => setStep(GS.step + 1);
  $q('#gslast').onclick = () => setStep(R ? R.nsteps - 1 : 0);
  const play = $q('#gsplay');
  const stopPlay = () => { clearInterval(GS.timer); GS.timer = null; if (document.body.contains(play)) play.textContent = 'Play'; };
  const startPlay = () => {
    play.textContent = 'Pause';
    GS.timer = setInterval(() => {
      if (!document.body.contains(cv) || !R || GS.step >= R.nsteps - 1) { stopPlay(); return; }
      setStep(GS.step + 1);
    }, 1000 / GS.speed);
  };
  play.onclick = () => {
    if (GS.timer) { stopPlay(); return; }
    if (R && GS.step >= R.nsteps - 1) setStep(0);
    startPlay();
  };
  $q('#gsspeed').onchange = e => { GS.speed = +e.target.value || 8; if (GS.timer) { clearInterval(GS.timer); startPlay(); } };
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
