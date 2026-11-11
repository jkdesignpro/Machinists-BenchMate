'use strict';
// Inspection round 2: ANSI B4.1 inch fits, preferred numbers (Renard series),
// control charts (X-bar/R and individuals/moving range) and single sampling
// plan OC curves. Table data comes from data/refdata.json (built from
// data/refdata/ansi-fits-evidence.json and preferred-evidence.json); every
// calculation is done by the Rust core (core/src/inspect.rs) through state.W.
// Sources: docs/inspection.md.

const iNum = x => (x === '' || x === null || x === undefined || isNaN(+x)) ? NaN : +x;
const iSel = (k, opts, cur) => '<select data-k="' + k + '">' + opts.map(([v, t]) => '<option value="' + rEsc(v) + '"' + (String(v) === String(cur) ? ' selected' : '') + '>' + rEsc(t) + '</option>').join('') + '</select>';
const iBind = (el, s, calc) => el.querySelectorAll('[data-k]').forEach(i => i.oninput = i.onchange = () => { s[i.dataset.k] = i.value; calc(i.dataset.k); });
const iNeeds = s => s === 'review' ? ' <span class="ms">needs 2nd source</span>' : '';

// ------------------------------------------------------------------ ANSI B4.1 inch fits
const ANSI_STATE = { size: 1, fam: 'RC', cls: 'RC4' };
const ANSI_FAMS = [['RC', 'RC: running and sliding'], ['LC', 'LC: locational clearance'], ['LT', 'LT: locational transition'], ['LN', 'LN: locational interference'], ['FN', 'FN: force and shrink']];

async function renderAnsiFits(el) {
  const R = await loadRef(el); if (!R) return;
  const A = R.ansi_fits, W = state.W, s = ANSI_STATE;
  const inch = inMode();
  const sizeShown = inch ? s.size : +(s.size * IN_MM).toFixed(3);
  const classesOf = fam => Object.keys(A.classes).filter(c => A.classes[c].family === fam);
  if (!classesOf(s.fam).includes(s.cls)) s.cls = classesOf(s.fam)[0];
  el.innerHTML = '<p class="desc">ANSI B4.1 preferred limits and fits for cylindrical parts, inch, hole basis. The tables give deviations in thousandths of an inch (0.001 in) from the basic size, by size range up to 19.69 in. Enter the basic size, pick a class.</p><div class="grid" style="max-width:760px">' +
    sfield('Basic (nominal) size', '<input type="number" step="any" inputmode="decimal" data-k="size" value="' + rEsc(sizeShown) + '" style="width:120px;font-family:var(--mono)">', uLen()) +
    sfield('Fit family', iSel('fam', ANSI_FAMS, s.fam), '') +
    sfield('Class', iSel('cls', classesOf(s.fam).map(c => [c, c + ' (' + A.classes[c].symbol.replace('/-', ', shaft not symbolised') + ')']), s.cls), '') + '</div>' +
    '<div id="ares"></div><div id="atab"></div>' +
    '<div class="note"><b>Working:</b> hole limits = basic + hole deviations, shaft limits = basic + shaft deviations (thousandths / 1000 = inches). Maximum clearance = hole upper - shaft lower; minimum clearance = hole lower - shaft upper; a negative clearance is interference. RC, LC and LT tables print the limits of clearance (minimum, maximum; LT prints interference with a minus sign); LN and FN tables print the limits of interference (minimum, maximum). The ISO-style symbols (H7/f6 and so on) show which hole and shaft grades each class uses; ANSI B4.1 values are its own inch values, not the ISO 286 metric limits converted. ' +
    'Every row is checked by the data build: the printed fit limits must follow from the printed hole and shaft limits, and every class using the same grade must show the same tolerance in a size range. Rows that fail are shown with a warning, as transcribed, never corrected silently. ' +
    '<b>Only one full table was read</b> (a university course reprint of the standard), so the values are marked "needs 2nd source" except the one row another publisher prints (RC5, 1.97 to 3.15 in, Engineers Edge worked example). Check a critical fit against the standard. ANSI B4.1-1967 was reaffirmed (R1999, R2004); its status today was not confirmed.</div><div class="note" id="asrc"></div>';
  const find = (rows, x) => rows.find(r => { const [a, b] = r.range.split('-').map(Number); return (a === 0 ? x >= 0 : x > a) && x <= b; });
  const th = v => (v > 0 ? '+' : '') + fx(v, Math.abs(v * 100 - Math.round(v * 100)) > 1e-9 ? 3 : (Math.abs(v * 10 - Math.round(v * 10)) > 1e-9 ? 2 : 1));
  const inS = x => fx(x, 4);
  function rowFit(cls, r) {
    const ip = A.classes[cls].family === 'LN' || A.classes[cls].family === 'FN' ? 1 : 0;
    const v = f => r[f].value;
    const F = k => W.ansi_fit(ip, v('hole_plus'), v('hole_minus'), v('shaft_plus'), v('shaft_minus'), k);
    return { ip, a: F(0), b: F(1), maxc: F(2), minc: F(3), type: F(4) };
  }
  function calc(k) {
    if (k === 'fam') { s.cls = classesOf(s.fam)[0]; renderAnsiFits(el); return; }
    if (k === 'size') { const x = iNum(el.querySelector('[data-k="size"]').value); s.size = inch ? x : x / IN_MM; }
    const out = el.querySelector('#ares'), tabEl = el.querySelector('#atab');
    const C = A.classes[s.cls], x = s.size;
    if (!(x > 0)) { out.innerHTML = mMsg(s.cls, 'Enter a basic size above zero'); tabEl.innerHTML = ''; return; }
    if (x > 19.69) { out.innerHTML = mMsg(s.cls, 'Above 19.69 in: the standard continues to 200 in, but those rows were not read. Not covered.'); tabEl.innerHTML = ''; return; }
    const r = find(C.rows, x);
    if (!r) { out.innerHTML = mMsg(s.cls, s.cls + ' has no values for this size in the standard (the class starts at a larger size).'); }
    else {
      const f = rowFit(s.cls, r), v = q => r[q].value;
      const lim = d => x + d / 1000;
      const unit = inch ? 'in' : 'mm', L = d => inch ? inS(lim(d)) : fx(lim(d) * IN_MM, 3);
      const typ = { 1: 'Clearance fit', 2: 'Transition fit', 3: 'Interference fit' }[f.type];
      const pr = (f.ip ? 'Limits of interference (as printed)' : 'Limits of clearance (as printed)');
      const rows = [
        ['Class ' + s.cls + ', ' + rEsc(C.symbol.replace('/-', ' (shaft not symbolised)')) + ', size range over ' + r.range.replace('-', ' to ') + ' in', badge(r.a.status) + iNeeds(r.a.status), ''],
        ['Hole limits (deviation ' + th(v('hole_plus')) + ' / ' + th(v('hole_minus')) + ' thousandths)', L(v('hole_plus')) + ' / ' + L(v('hole_minus')), unit],
        ['Shaft limits (deviation ' + th(v('shaft_plus')) + ' / ' + th(v('shaft_minus')) + ' thousandths)', L(v('shaft_plus')) + ' / ' + L(v('shaft_minus')), unit],
        [pr, th(v('a')) + ' / ' + th(v('b')), 'thou'],
        [typ + ': maximum clearance / minimum clearance (negative = interference), from the limits', fx(f.maxc / 1000, 4) + ' / ' + fx(f.minc / 1000, 4) + ' in (' + fx(f.maxc * 0.0254, 4) + ' / ' + fx(f.minc * 0.0254, 4) + ' mm)', ''],
      ];
      r.notes.forEach(n => rows.push(['Check failed', rEsc(n), '', 'Transcribed value kept as printed; compare with the standard']));
      if (C.desc) rows.push(['Use (AmesWeb description)', rEsc(C.desc), '']);
      out.innerHTML = mRes(s.cls + ' at ' + (inch ? inS(x) + ' in' : fx(x * IN_MM, 3) + ' mm (' + inS(x) + ' in)'), rows);
    }
    // all classes of the family at this size
    const cls = classesOf(s.fam);
    tabEl.innerHTML = '<div class="res mtab" style="margin-top:12px"><div class="h">' + rEsc(s.fam) + ' classes at this size (thousandths of an inch)</div><table><tr><th>Class</th><th>Symbol</th><th>Range (in)</th><th>Hole</th><th>Shaft</th><th>' + (s.fam === 'LN' || s.fam === 'FN' ? 'Interference' : 'Clearance') + ' min / max</th><th>Status</th></tr>' +
      cls.map(c => { const rr = find(A.classes[c].rows, x); if (!rr) return '<tr><td>' + c + '</td><td>' + rEsc(A.classes[c].symbol) + '</td><td colspan="5" class="ms">not defined for this size</td></tr>';
        const v = q => rr[q].value;
        return '<tr><td>' + c + '</td><td>' + rEsc(A.classes[c].symbol) + '</td><td>' + rr.range.replace('-', ' to ') + '</td><td class="mv">' + th(v('hole_plus')) + ' / ' + th(v('hole_minus')) + '</td><td class="mv">' + th(v('shaft_plus')) + ' / ' + th(v('shaft_minus')) + '</td><td class="mv">' + th(v('a')) + ' / ' + th(v('b')) + '</td><td>' + badge(rr.a.status) + (rr.notes.length ? ' <span class="warn">check failed</span>' : '') + '</td></tr>'; }).join('') + '</table></div>';
  }
  el.querySelector('#asrc').innerHTML = '<b>Sources</b><br>' + sourceList(A.sources);
  iBind(el, s, calc);
  calc();
}

// ------------------------------------------------------------------ Preferred numbers
const PN_STATE = { series: 'R10', from: 1, to: 100, x: '' };
async function renderPrefNum(el) {
  const R = await loadRef(el); if (!R) return;
  const P = R.preferred, W = state.W, s = PN_STATE;
  el.innerHTML = '<p class="desc">Preferred numbers (ISO 3 Renard series): sizes, speeds, loads or capacities stepped by a constant ratio, so a range is covered evenly. R5 steps about 60 %, R10 about 25 %, R20 about 12 %, R40 about 6 %. Each value is the rounded number the standard uses, with the theoretical value 10^(i/R) beside it.</p><div class="grid" style="max-width:760px">' +
    sfield('Series', iSel('series', [['R5', 'R5 (ratio 1.58)'], ['R10', 'R10 (ratio 1.26)'], ['R20', 'R20 (ratio 1.12)'], ['R40', 'R40 (ratio 1.06)'], ['R80', 'R80 (ratio 1.03, exceptional)']], s.series), '') +
    sfield('From', sinp('from', s.from), '') + sfield('To', sinp('to', s.to), '') + sfield('Nearest preferred number to', sinp('x', s.x), '') + '</div><div id="pnear"></div><div id="pres"></div>' +
    '<div class="note"><b>Working:</b> term i of series R has the theoretical value 10^(i/R); the series repeats in every decade (multiply by 10, 100, 0.1 ...). The rounded values are not always the nearest 3-digit rounding (3.15 for 3.162, 1.18 for 1.189, 3.00 and 6.00 in R40 chosen as rounder numbers), so they are taken from the published tables, not computed. R5 is every 2nd R10 term, R10 every 2nd R20 term, R20 every 2nd R40 term. Nearest: i = round(R log10 x), nearest in ratio. ISO 3:1973 (cited by name, edition from the iTeh catalogue); ISO 17 and ISO 497 (1973) give guidance on use and on more rounded series (R\'10, R\'\'5 ...), not covered here.</div><div class="note" id="psrc"></div>';
  const mant = () => P.series[s.series];
  const nR = () => +s.series.slice(1);
  function value(i) { // term i (any integer) = mantissa * 10^decade
    const n = nR(), m = mant(), k = ((i % n) + n) % n, dec = Math.floor(i / n);
    const e = m[k];
    return { v: +e.value * Math.pow(10, dec), e, dec };
  }
  const show = v => v >= 1000 ? String(Math.round(v)) : v.toPrecision(3);
  function calc() {
    const n = nR(), a = iNum(s.from), b = iNum(s.to), out = el.querySelector('#pres'), near = el.querySelector('#pnear');
    const x = iNum(s.x);
    if (x > 0) {
      const i = Math.round(W.renard_index(n, x)), t = value(i), th = W.renard_theoretical(n, i);
      near.innerHTML = mRes('Nearest ' + s.series + ' number to ' + rEsc(s.x), [['Preferred number', show(t.v) + ' ' + badge(t.e.status) + iNeeds(t.e.status), ''], ['Theoretical 10^(' + i + '/' + n + ')', fx(th, 5), ''], ['Your value against it', (x / t.v - 1 >= 0 ? '+' : '') + fx((x / t.v - 1) * 100, 2) + ' %', '']]);
    } else near.innerHTML = '';
    if (!(a > 0 && b > a)) { out.innerHTML = mMsg(s.series, 'Enter a range: From above zero and To above From'); return; }
    let i0 = Math.ceil(W.renard_index(n, a) - 1e-9), i1 = Math.floor(W.renard_index(n, b) + 1e-9);
    if (i1 - i0 > 400) { out.innerHTML = mMsg(s.series, 'Range too wide: more than 400 numbers. Narrow it.'); return; }
    let h = '<div class="res mtab" style="max-width:760px"><div class="h">' + s.series + ' from ' + rEsc(s.from) + ' to ' + rEsc(s.to) + '</div><table><tr><th>Term</th><th>Preferred number</th><th>Theoretical</th><th>Rounded vs theoretical</th><th>Step from previous</th><th>Status</th></tr>';
    let prev = NaN;
    for (let i = i0; i <= i1; i++) {
      const t = value(i), th = W.renard_theoretical(n, i);
      if (t.v < a * (1 - 1e-9) || t.v > b * (1 + 1e-9)) continue;
      h += '<tr><td>' + i + '</td><td class="mv">' + show(t.v) + '</td><td class="mv">' + fx(th, th < 10 ? 4 : th < 1000 ? 2 : 0) + '</td><td class="mv">' + ((t.v / th - 1) >= 0 ? '+' : '') + fx((t.v / th - 1) * 100, 2) + ' %</td><td class="mv">' + (isFinite(prev) ? '+' + fx((t.v / prev - 1) * 100, 1) + ' %' : '') + '</td><td>' + badge(t.e.status) + iNeeds(t.e.status) + '</td></tr>';
      prev = t.v;
    }
    out.innerHTML = h + '</table></div>';
  }
  el.querySelector('#psrc').innerHTML = '<b>Sources</b> (each value shows how many independent publishers print it)<br>' + sourceList(P.sources);
  iBind(el, s, calc);
  calc();
}

// ------------------------------------------------------------------ Control charts
const CC_EXAMPLE_IMR = '49.6 47.6 49.9 51.3 47.8 51.2 52.6 52.4 53.6 52.1';
const CC_EXAMPLE_XR = '10.02 10.01 9.99 10.00 10.03\n9.98 10.00 10.01 10.02 9.99\n10.01 10.03 10.00 9.98 10.01\n10.00 9.99 10.02 10.01 10.00\n10.04 10.02 10.01 10.03 10.02\n9.99 10.00 9.98 10.01 10.00';
const CC_STATE = { mode: 'imr', sg: 5, text: CC_EXAMPLE_IMR };
function ccPlot(title, pts, cl, ucl, lcl, dp) {
  const Wd = 600, Hd = 200, L = 58, Rr = 46, T = 18, B = 26;
  const vals = pts.filter(isFinite).concat([cl, ucl].filter(isFinite)).concat(isFinite(lcl) ? [lcl] : []);
  let lo = Math.min(...vals), hi = Math.max(...vals); if (!(hi > lo)) { hi = lo + 1; lo -= 1; }
  const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
  const n = pts.length, X = i => L + (n > 1 ? i / (n - 1) : 0.5) * (Wd - L - Rr), Y = y => T + (hi - y) / (hi - lo) * (Hd - T - B);
  let s = '<svg class="capplot" viewBox="0 0 ' + Wd + ' ' + Hd + '" role="img" aria-label="' + rEsc(title) + '">';
  s += '<text class="tl" x="' + L + '" y="12">' + rEsc(title) + '</text><path class="ax" d="M' + L + ' ' + (Hd - B) + 'H' + (Wd - Rr) + 'M' + L + ' ' + T + 'V' + (Hd - B) + '"/>';
  const hl = (y, cls, lab) => { if (!isFinite(y)) return; s += '<path class="' + cls + '" d="M' + L + ' ' + Y(y).toFixed(1) + 'H' + (Wd - Rr) + '"/><text class="tl" x="' + (Wd - Rr + 3) + '" y="' + (Y(y) + 4).toFixed(1) + '">' + lab + '</text><text class="tl" x="' + (L - 4) + '" y="' + (Y(y) + 4).toFixed(1) + '" text-anchor="end">' + fmt(y, dp) + '</text>'; };
  hl(ucl, 'lim', 'UCL'); hl(cl, 'mid', 'CL'); if (isFinite(lcl)) hl(lcl, 'lim', 'LCL');
  const seg = []; pts.forEach((p, i) => { if (isFinite(p)) seg.push((seg.length ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p).toFixed(1)); });
  s += '<path class="co" d="' + seg.join('') + '"/>';
  pts.forEach((p, i) => { if (!isFinite(p)) return; const out = p > ucl || (isFinite(lcl) && p < lcl); s += '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(p).toFixed(1) + '" r="' + (out ? 4 : 2.5) + '" class="' + (out ? 'ccout' : 'ccpt') + '"/>'; });
  s += '<text class="tl" x="' + L + '" y="' + (Hd - 8) + '">1</text><text class="tl" x="' + (Wd - Rr) + '" y="' + (Hd - 8) + '" text-anchor="end">' + n + '</text></svg>';
  return s;
}
function renderCtrlChart(el) {
  const s = CC_STATE, W = state.W;
  const draw = () => {
    el.innerHTML = '<p class="desc">Shewhart control charts from your measurements in production order: individuals and moving range (one part at a time) or X-bar and R (subgroups of 2 to 10 parts). Points outside the control limits are marked. Control limits come from the process itself; they are not the drawing tolerance.</p>' +
      '<div class="mfilter"><span>Chart:</span><div class="seg" id="ccmode"><button data-m="imr"' + (s.mode === 'imr' ? ' class="on"' : '') + '>Individuals and moving range</button><button data-m="xr"' + (s.mode === 'xr' ? ' class="on"' : '') + '>X-bar and R</button></div></div>' +
      (s.mode === 'xr' ? '<div class="grid">' + sfield('Subgroup size n', iSel('sg', [2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => [n, String(n)]), s.sg), 'parts') + '</div>' : '') +
      '<label class="f" style="max-width:760px"><span>Measurements in production order' + (s.mode === 'xr' ? ', consecutive groups of n make one subgroup' : '') + ' (spaces, new lines, commas or semicolons; decimal point ".")</span><textarea id="cctext" rows="6" spellcheck="false" style="width:100%;font-family:var(--mono);border:1px solid var(--line);border-radius:var(--r);background:var(--panel);padding:6px">' + rEsc(s.text) + '</textarea></label>' +
      '<div class="mfilter" style="margin-top:6px"><button class="btn" id="ccex">Example data</button><button class="btn" id="ccclr">Clear</button><span class="desc" style="margin:0" id="cccount"></span></div>' +
      '<div id="ccplot"></div><div class="res" id="ccres" style="margin-top:10px"></div><div id="cctab"></div>' +
      '<div class="note"><b>Working:</b> individuals: centre line x-bar, limits x-bar +/- 3 MR-bar / 1.128 (= 2.66 MR-bar), MR-bar the average of the moving ranges |x(i) - x(i-1)|; moving range chart UCL = 3.267 MR-bar, LCL 0. X-bar and R: grand mean +/- A2 R-bar; R chart LCL = D3 R-bar, UCL = D4 R-bar; sigma estimate R-bar / d2. A2 = 3 / (d2 sqrt n), D3 = max(0, 1 - 3 d3 / d2), D4 = 1 + 3 d3 / d2. The limits use the three-decimal constants NIST prints, so results match a hand calculation; the table below also shows d2 and d3 computed by BenchMate from their definitions (mean and standard deviation of the range of n normal values) by numerical integration. Only the first rule (a point beyond a limit) is marked; run rules (Western Electric, Nelson) are not applied. Start from at least 20 to 25 subgroups (or values) taken while the process ran normally.<br><b>Sources:</b> NIST/SEMATECH e-Handbook of Statistical Methods, 6.3.2.1 (X-bar and R, constants table) and 6.3.2.2 (individuals chart, flow-rate worked example, reproduced in the core tests); University of York, Department of Mathematics, factors for control charts (second table). See docs/inspection.md.</div>';
    el.querySelectorAll('#ccmode button').forEach(b => b.onclick = () => { s.mode = b.dataset.m; s.text = s.mode === 'xr' ? CC_EXAMPLE_XR : CC_EXAMPLE_IMR; draw(); });
    iBind(el, s, calc);
    const ta = el.querySelector('#cctext');
    ta.oninput = () => { s.text = ta.value; calc(); };
    el.querySelector('#ccex').onclick = () => { s.text = s.mode === 'xr' ? CC_EXAMPLE_XR : CC_EXAMPLE_IMR; draw(); };
    el.querySelector('#ccclr').onclick = () => { s.text = ''; draw(); };
    calc(); constants();
  };
  function constants() {
    const york = { 2: [3.266, 1.128, 0.852], 3: [2.574, 1.693, 0.888], 4: [2.281, 2.059, 0.879], 5: [2.114, 2.326, 0.864], 6: [2.003, 2.534, 0.848], 7: [1.924, 2.704, 0.833], 8: [1.863, 2.847, 0.819], 9: [1.816, 2.970, 0.807], 10: [1.777, 3.078, 0.797] };
    const yD3 = { 8: 0.137 };
    let h = '<div class="res mtab" style="max-width:760px;margin-top:12px"><div class="h">Constants for X-bar and R charts</div><table><tr><th>n</th><th>A2 (NIST)</th><th>D3 (NIST)</th><th>D4 (NIST)</th><th>D4 (York)</th><th>d2 computed</th><th>d3 computed</th><th>A2, D3, D4 computed</th></tr>';
    for (let n = 2; n <= 10; n++) {
      const T = k => W.spc_constant_table(n, k), C = k => W.spc_constant_computed(n, k);
      const d4y = york[n][0], d4 = T(4), dif = Math.abs(d4y - d4) > 1e-9;
      h += '<tr><td>' + n + '</td><td class="mv">' + fx(T(2), 3) + '</td><td class="mv">' + fx(T(3), 3) + (yD3[n] ? ' <span class="badge differs">York ' + yD3[n] + '</span>' : '') + '</td><td class="mv">' + fx(d4, 3) + '</td><td class="mv">' + fx(d4y, 3) + (dif ? ' <span class="badge differs">differs</span>' : '') + '</td><td class="mv">' + fx(C(0), 4) + '</td><td class="mv">' + fx(C(1), 4) + '</td><td class="mv">' + fx(C(2), 4) + ', ' + fx(C(3), 4) + ', ' + fx(C(4), 4) + '</td></tr>';
    }
    el.querySelector('#cctab').innerHTML = h + '</table></div><p class="ms" style="max-width:760px">Where NIST and York differ in the last digit, the computed value rounds to the NIST value (York appears to truncate). A2 agrees in both tables.</p>';
  }
  function calc() {
    const xs = parseValues(s.text), max = W.buf_len(), n = Math.min(xs.length, max), res = el.querySelector('#ccres'), plot = el.querySelector('#ccplot'), dp = sdp() + 1;
    new Float64Array(W.memory.buffer, W.buf_ptr(), n).set(xs.slice(0, n));
    el.querySelector('#cccount').textContent = n + ' values read' + (xs.length > max ? ' (only the first ' + max + ' used)' : '') + '.';
    const f = (x, d) => fmt(x, d);
    if (s.mode === 'imr') {
      if (n < 2) { res.innerHTML = stable('Results', [['Enter at least 2 values (20 or more for real limits)', '', '']]); plot.innerHTML = ''; return; }
      const C = k => W.spc_imr_buf(n, k);
      const x = [], mr = [NaN];
      for (let i = 0; i < n; i++) x.push(C(10000 + i));
      for (let i = 1; i < n; i++) mr.push(C(20000 + i));
      const ux = C(3), lx = C(4), um = C(5);
      const outX = x.filter(v => v > ux || v < lx).length, outM = mr.filter(v => v > um).length;
      res.innerHTML = stable('Individuals and moving range', [
        ['Values n', String(n), '', n < 20 ? 'Fewer than about 20 values: the limits are rough' : ''],
        ['Mean (centre line)', f(C(1), dp)], ['Average moving range MR-bar', f(C(2), dp + 1)],
        ['UCL / LCL individuals (mean +/- 2.66 MR-bar)', f(ux, dp) + ' / ' + f(lx, dp)], ['UCL moving range (3.267 MR-bar), LCL 0', f(um, dp)],
        ['Sigma estimate MR-bar / 1.128', f(C(7), dp + 1)],
        ['Points beyond the limits (individuals / moving range)', outX + ' / ' + outM, '', outX + outM ? 'Out of control: look for the cause before using the limits or a capability index' : ''],
      ]);
      plot.innerHTML = ccPlot('Individuals', x, C(1), ux, lx, dp) + ccPlot('Moving range', mr, C(2), um, 0, dp);
    } else {
      const sg = +s.sg, C = k => W.spc_xbar_r_buf(n, sg, k), k = C(0);
      if (!(k >= 1)) { res.innerHTML = stable('Results', [['Enter at least one full subgroup of ' + sg + ' values', '', '']]); plot.innerHTML = ''; return; }
      const xb = [], rr = [];
      for (let i = 0; i < k; i++) { xb.push(C(10000 + i)); rr.push(C(20000 + i)); }
      const ux = C(3), lx = C(4), ur = C(5), lr = C(6);
      const outX = xb.filter(v => v > ux || v < lx).length, outR = rr.filter(v => v > ur || v < lr).length, left = n - k * sg;
      res.innerHTML = stable('X-bar and R, subgroups of ' + sg, [
        ['Subgroups k', String(k) + (left ? ' (last ' + left + ' value(s) not used)' : ''), '', k < 20 ? 'Fewer than about 20 subgroups: the limits are rough' : ''],
        ['Grand mean (centre line)', f(C(1), dp)], ['Average range R-bar', f(C(2), dp + 1)],
        ['UCL / LCL X-bar (A2 = ' + fx(W.spc_constant_table(sg, 2), 3) + ')', f(ux, dp) + ' / ' + f(lx, dp)],
        ['UCL / LCL range (D4 = ' + fx(W.spc_constant_table(sg, 4), 3) + ', D3 = ' + fx(W.spc_constant_table(sg, 3), 3) + ')', f(ur, dp + 1) + ' / ' + f(lr, dp + 1)],
        ['Sigma estimate R-bar / d2 (d2 = ' + fx(W.spc_constant_table(sg, 0), 3) + ')', f(C(7), dp + 1)],
        ['Subgroups beyond the limits (X-bar / R)', outX + ' / ' + outR, '', outX + outR ? 'Out of control: look for the cause before using the limits or a capability index' : ''],
      ]);
      plot.innerHTML = ccPlot('Subgroup means (X-bar)', xb, C(1), ux, lx, dp) + ccPlot('Subgroup ranges (R)', rr, C(2), ur, lr, dp);
    }
  }
  draw();
}

// ------------------------------------------------------------------ Sampling plans
const SP_STATE = { n: 50, c: 1, lot: 1000, p: 1 };
function renderSampling(el) {
  const s = SP_STATE, W = state.W;
  el.innerHTML = '<p class="desc">What a sampling plan does: inspect n parts from a lot and accept the lot if c or fewer are defective. Enter the plan your customer or ISO 2859-1 / ANSI/ASQ Z1.4 tables give you; BenchMate draws its operating characteristic (OC) curve: the chance of accepting a lot for each true percent defective. The standards\' tables are not reproduced.</p><div class="grid" style="max-width:760px">' +
    sfield('Sample size n', sinp('n', s.n), 'parts') + sfield('Acceptance number c (accept if defectives &le; c)', sinp('c', s.c), '') + sfield('Lot size N', sinp('lot', s.lot), 'parts') + sfield('Percent defective to evaluate', sinp('p', s.p), '%') + '</div><div id="spres"></div><div id="spplot"></div>' +
    '<div class="note"><b>Working:</b> probability of acceptance Pa = sum over k = 0..c of C(n, k) p^k (1 - p)^(n - k) (binomial; good when n is under about a tenth of the lot), and the Poisson approximation with lambda = n p for comparison. Average outgoing quality with rectifying inspection (rejected lots 100 % sorted): AOQ = p Pa (N - n) / N; its maximum over p is the AOQL. Points read off the curve: p at Pa = 95 % (about where the producer\'s risk is set, the AQL region) and p at Pa = 10 % (the consumer\'s risk, LTPD).<br>' +
    '<b>How ISO 2859-1 and ANSI/ASQ Z1.4 work, in short:</b> both are attribute sampling schemes indexed by the acceptance quality limit (AQL). You pick an inspection level (general levels I, II and III, II being normal; special levels S-1 to S-4 for small samples); the lot size and level give a sample size code letter; the code letter and AQL give n and the acceptance and rejection numbers for normal, tightened or reduced inspection. Switching rules move you to tightened inspection after poor lots and to reduced inspection after a run of good ones; the protection the scheme promises depends on following them. Single, double and multiple plans are given. The AQL is not a guarantee that every lot is that good: read the OC curve of the plan. Z1.4 was derived from MIL-STD-105E, and ISO 2859-1 from the same family; the code-letter and plan tables are copyright and must come from the standard itself.<br>' +
    '<b>Sources:</b> binomial and Poisson distributions and AOQ as in NIST/SEMATECH e-Handbook of Statistical Methods, 6.2.3 (single sampling plans, cited by name); ISO 2859-1:1999 and ANSI/ASQ Z1.4-2003 (cited by name for the scheme structure, not reproduced; current editions not re-checked in this batch). See docs/inspection.md.</div>';
  function calc() {
    const n = Math.round(iNum(s.n)), c = Math.round(iNum(s.c)), N = iNum(s.lot), p = iNum(s.p) / 100, res = el.querySelector('#spres'), plot = el.querySelector('#spplot');
    if (!(n >= 1 && c >= 0 && c < n)) { res.innerHTML = mMsg('Plan', 'Enter n of 1 or more and c from 0 to n - 1'); plot.innerHTML = ''; return; }
    if (n > 5000) { res.innerHTML = mMsg('Plan', 'Sample size above 5000 is not supported'); plot.innerHTML = ''; return; }
    const lotOk = N >= n;
    const S = (pp, k) => W.sampling(n, c, pp, lotOk ? N : n, k);
    // find p for a given Pa by bisection on the monotone binomial OC curve (search only; the curve is the Rust value)
    const pAt = target => { let lo = 0, hi = 1; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (S(m, 0) > target) lo = m; else hi = m; } return (lo + hi) / 2; };
    const p95 = pAt(0.95), p10 = pAt(0.10), pmax = Math.min(1, Math.max(p10 * 1.6, 0.01));
    let aoql = 0, paoql = 0; for (let i = 1; i <= 400; i++) { const q = pmax * i / 400, a = S(q, 2); if (a > aoql) { aoql = a; paoql = q; } }
    const rows = [['Plan', 'n = ' + n + ', c = ' + c + (lotOk ? ', lot ' + N : ''), '', !lotOk ? 'Lot size must be at least n for AOQ' : (n > N / 10 ? 'n is over a tenth of the lot: the binomial curve is approximate (the exact one is hypergeometric)' : '')]];
    if (p >= 0 && p <= 1) rows.push(['At ' + fx(p * 100, 2) + ' % defective: chance of acceptance (binomial / Poisson)', fx(S(p, 0) * 100, 2) + ' % / ' + fx(S(p, 1) * 100, 2) + ' %', ''], ['AOQ at ' + fx(p * 100, 2) + ' %', lotOk ? fx(S(p, 2) * 100, 3) + ' %' : 'n/a', '']);
    rows.push(['Defective level accepted 95 % of the time', fx(p95 * 100, 3) + ' %', ''], ['Defective level accepted only 10 % of the time (LTPD)', fx(p10 * 100, 3) + ' %', ''], ['AOQL (worst average outgoing quality)', lotOk ? fx(aoql * 100, 3) + ' % at ' + fx(paoql * 100, 2) + ' % defective' : 'n/a', '']);
    res.innerHTML = mRes('Single sampling plan', rows);
    // OC curve
    const Wd = 600, Hd = 220, L = 46, Rr = 14, T = 14, B = 34, X = q => L + q / pmax * (Wd - L - Rr), Y = a => T + (1 - a) * (Hd - T - B);
    let sv = '<svg class="capplot" viewBox="0 0 ' + Wd + ' ' + Hd + '" role="img" aria-label="Operating characteristic curve"><path class="ax" d="M' + L + ' ' + (Hd - B) + 'H' + (Wd - Rr) + 'M' + L + ' ' + T + 'V' + (Hd - B) + '"/>';
    const pts = [], pp = []; for (let i = 0; i <= 120; i++) { const q = pmax * i / 120; pts.push(X(q).toFixed(1) + ' ' + Y(S(q, 0)).toFixed(1)); pp.push(X(q).toFixed(1) + ' ' + Y(S(q, 1)).toFixed(1)); }
    sv += '<path class="cw" d="M' + pp.join('L') + '"/><path class="co" d="M' + pts.join('L') + '"/>';
    [[p95, 0.95], [p10, 0.10]].forEach(([q, a]) => { sv += '<path class="mid" d="M' + X(q).toFixed(1) + ' ' + (Hd - B) + 'V' + Y(a).toFixed(1) + 'H' + L + '"/>'; });
    if (p > 0 && p <= pmax) sv += '<path class="lim" d="M' + X(p).toFixed(1) + ' ' + T + 'V' + (Hd - B) + '"/>';
    [0, 0.5, 1].forEach(a => { sv += '<text class="tl" x="' + (L - 4) + '" y="' + (Y(a) + 4).toFixed(1) + '" text-anchor="end">' + (a * 100) + '%</text>'; });
    [0, pmax / 2, pmax].forEach((q, i) => { sv += '<text class="tl" x="' + X(q).toFixed(1) + '" y="' + (Hd - B + 14) + '" text-anchor="' + ['start', 'middle', 'end'][i] + '">' + fx(q * 100, 2) + '%</text>'; });
    sv += '<text class="tl" x="' + L + '" y="' + (Hd - 6) + '">Chance of acceptance against percent defective. Solid: binomial; dashed: Poisson.</text></svg>';
    plot.innerHTML = sv;
  }
  iBind(el, s, calc);
  calc();
}
