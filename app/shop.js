'use strict';
// Shop helpers: process capability, temperature compensation, fraction
// converter and setup sheet screens. All arithmetic is in the Rust core
// (state.W); this file parses input, converts units and draws.

const sesc = x => String(x ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const snum = x => (x === '' || x === null || x === undefined || isNaN(+x)) ? NaN : +x;
const sdp = () => state.sys === 'inch' ? 4 : 3;
const sinp = (k, v, w, attrs) => '<input type="number" step="any" inputmode="decimal" data-k="' + k + '" value="' + sesc(v) + '" style="width:' + (w || 120) + 'px;font-family:var(--mono)"' + (attrs || '') + '>';
const sfield = (label, html, unit) => '<label class="f"><span>' + label + '</span><div class="row">' + html + '<span class="u">' + (unit || '') + '</span></div></label>';
const stable = (h, rows) => '<div class="h">' + h + '</div><table>' + rows.map(r => '<tr' + (r[3] ? ' class="over"' : '') + '><td>' + r[0] + (r[3] ? '<div class="wmsg">' + r[3] + '</div>' : '') + '</td><td class="v">' + r[1] + '</td><td class="u">' + (r[2] || '') + '</td></tr>').join('') + '</table>';

// ---------- Process capability ----------
const CAP_EXAMPLE = '9.999 10.002 10.000 9.999 9.997 10.000 10.006 10.003 10.006 10.002\n10.003 10.002 9.995 10.005 10.003 10.003 9.994 9.993 9.997 9.998\n10.001 9.999 10.001 9.996 10.000 10.000 9.996 10.005 10.001 10.003\n9.996 9.996 9.997 9.999 10.002 10.000 9.998 9.996 9.998 10.005';
const CAP_STATE = { mode: 'data', text: CAP_EXAMPLE, lsl: 9.985, usl: 10.015, sg: 1, mean: '', sigma: '' };

function parseValues(t) {
  return String(t).split(/[\s,;]+/).filter(Boolean).map(Number).filter(x => isFinite(x));
}

function capHistogram(W, n, lsl, usl, mean, so, sw) {
  const bins = W.cap_from_buf(n, lsl, usl, CAP_STATE.sg, 16), w = W.cap_from_buf(n, lsl, usl, CAP_STATE.sg, 17), x0 = W.cap_from_buf(n, lsl, usl, CAP_STATE.sg, 18);
  const counts = []; for (let i = 0; i < bins; i++) counts.push(W.cap_from_buf(n, lsl, usl, CAP_STATE.sg, 100 + i));
  return capPlot(W, { counts, x0, w, n, mean, so, sw, lsl, usl });
}

// Draws bars (if any), the fitted normal curves and the limits.
function capPlot(W, p) {
  const Wd = 560, Hd = 220, L = 44, Rr = 14, T = 14, B = 34;
  const sig = Math.max(p.so || 0, p.sw || 0) || 1;
  let lo = p.mean - 4 * sig, hi = p.mean + 4 * sig;
  if (p.counts) { lo = Math.min(lo, p.x0); hi = Math.max(hi, p.x0 + p.w * p.counts.length); }
  if (isFinite(p.lsl)) lo = Math.min(lo, p.lsl - 0.5 * sig);
  if (isFinite(p.usl)) hi = Math.max(hi, p.usl + 0.5 * sig);
  const X = x => L + (x - lo) / (hi - lo) * (Wd - L - Rr);
  // y scale: counts per bin; a curve is n x bin width x pdf. Without data use pdf only.
  const k = p.counts ? p.n * p.w : 1;
  const curve = s => { const pts = []; for (let i = 0; i <= 120; i++) { const x = lo + (hi - lo) * i / 120; pts.push([x, k * W.normal_pdf(x, p.mean, s)]); } return pts; };
  const cO = p.so > 0 ? curve(p.so) : [], cW = p.sw > 0 ? curve(p.sw) : [];
  const ymax = Math.max(1e-12, ...(p.counts || [0]), ...cO.map(q => q[1]), ...cW.map(q => q[1])) * 1.08;
  const Y = y => Hd - B - y / ymax * (Hd - B - T);
  let s = '<svg class="capplot" viewBox="0 0 ' + Wd + ' ' + Hd + '" role="img" aria-label="Histogram with fitted normal curve">';
  s += '<path class="ax" d="M' + L + ' ' + (Hd - B) + 'H' + (Wd - Rr) + 'M' + L + ' ' + T + 'V' + (Hd - B) + '"/>';
  if (p.counts) p.counts.forEach((c, i) => { const x1 = X(p.x0 + i * p.w), x2 = X(p.x0 + (i + 1) * p.w); s += '<rect class="bar" x="' + x1.toFixed(1) + '" y="' + Y(c).toFixed(1) + '" width="' + Math.max(0.5, x2 - x1 - 1).toFixed(1) + '" height="' + (Y(0) - Y(c)).toFixed(1) + '"/>'; });
  const path = pts => 'M' + pts.map(q => X(q[0]).toFixed(1) + ' ' + Y(q[1]).toFixed(1)).join('L');
  if (cW.length) s += '<path class="cw" d="' + path(cW) + '"/>';
  if (cO.length) s += '<path class="co" d="' + path(cO) + '"/>';
  const vline = (x, cls, label) => { if (!isFinite(x)) return; s += '<path class="' + cls + '" d="M' + X(x).toFixed(1) + ' ' + T + 'V' + (Hd - B) + '"/><text class="tl" x="' + X(x).toFixed(1) + '" y="' + (T - 3) + '" text-anchor="middle">' + label + '</text>'; };
  vline(p.lsl, 'lim', 'LSL'); vline(p.usl, 'lim', 'USL'); vline(p.mean, 'mid', 'mean');
  const dp = sdp() + 1;
  [lo, (lo + hi) / 2, hi].forEach((x, i) => { s += '<text class="tl" x="' + X(x).toFixed(1) + '" y="' + (Hd - B + 14) + '" text-anchor="' + ['start', 'middle', 'end'][i] + '">' + fmt(x, dp) + '</text>'; });
  if (p.counts) s += '<text class="tl" x="' + (L - 4) + '" y="' + (Y(ymax / 1.08) + 4).toFixed(1) + '" text-anchor="end">' + Math.round(ymax / 1.08) + '</text><text class="tl" x="' + (L - 4) + '" y="' + (Hd - B + 4) + '" text-anchor="end">0</text>';
  s += '<text class="tl" x="' + L + '" y="' + (Hd - 6) + '">' + (p.counts ? 'Bars: count per bin. ' : '') + (cO.length ? 'Solid: normal fit, overall sigma. ' : '') + (cW.length ? 'Dashed: within sigma.' : '') + '</text></svg>';
  return s;
}

function renderCapability(el) {
  const s = CAP_STATE, W = state.W;
  const draw = () => {
    el.innerHTML = '<div class="mfilter"><span>Input:</span><div class="seg" id="capmode"><button data-m="data"' + (s.mode === 'data' ? ' class="on"' : '') + '>Measurements</button><button data-m="stats"' + (s.mode === 'stats' ? ' class="on"' : '') + '>Mean and sigma</button></div></div>' +
      '<div class="grid">' +
      sfield('Lower spec limit LSL (blank = none)', sinp('lsl', s.lsl), 'same unit') + sfield('Upper spec limit USL (blank = none)', sinp('usl', s.usl), 'same unit') +
      (s.mode === 'data'
        ? sfield('Subgroup size (within sigma)', '<select data-k="sg">' + [[1, '1 (individuals)'], ...[2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => [n, String(n)])].map(([v, t]) => '<option value="' + v + '"' + (+s.sg === v ? ' selected' : '') + '>' + t + '</option>').join('') + '</select>', '')
        : sfield('Process mean', sinp('mean', s.mean), 'same unit') + sfield('Process sigma (standard deviation)', sinp('sigma', s.sigma), 'same unit')) +
      '</div>' +
      (s.mode === 'data' ? '<label class="f" style="max-width:760px"><span>Measurements in production order (separate with spaces, new lines, commas or semicolons; decimal point ".")</span><textarea id="captext" rows="6" spellcheck="false" style="width:100%;font-family:var(--mono);border:1px solid var(--line);border-radius:var(--r);background:var(--panel);padding:6px">' + sesc(s.text) + '</textarea></label>' +
        '<div class="mfilter" style="margin-top:6px"><button class="btn" id="capex">Example data</button><button class="btn" id="capclr">Clear</button><span class="desc" style="margin:0" id="capcount"></span></div>' : '') +
      '<div id="capplot"></div><div class="res" id="capres" style="margin-top:10px"></div>';
    el.querySelectorAll('#capmode button').forEach(b => b.onclick = () => { s.mode = b.dataset.m; draw(); });
    el.querySelectorAll('[data-k]').forEach(i => i.oninput = i.onchange = () => { s[i.dataset.k] = i.value; calc(); });
    const ta = el.querySelector('#captext');
    if (ta) {
      ta.oninput = () => { s.text = ta.value; calc(); };
      el.querySelector('#capex').onclick = () => { s.text = CAP_EXAMPLE; draw(); };
      el.querySelector('#capclr').onclick = () => { s.text = ''; draw(); };
    }
    calc();
  };
  const calc = () => {
    const lsl = snum(s.lsl), usl = snum(s.usl), f = (x, d) => fmt(x, d), dp = sdp() + 1, res = el.querySelector('#capres'), plot = el.querySelector('#capplot');
    const idxNote = 'Rule of thumb only: 1.33 is a common minimum requirement, your customer decides.';
    if (isFinite(lsl) && isFinite(usl) && usl <= lsl) { res.innerHTML = stable('Results', [['USL must be above LSL', '', '', 'Check the limits']]); plot.innerHTML = ''; return; }
    if (!isFinite(lsl) && !isFinite(usl)) { res.innerHTML = stable('Results', [['Enter at least one spec limit', '', '']]); plot.innerHTML = ''; return; }
    if (s.mode === 'stats') {
      const m = snum(s.mean), sg = snum(s.sigma);
      if (!isFinite(m) || !(sg > 0)) { res.innerHTML = stable('Results', [['Enter the mean and a sigma above zero', '', '']]); plot.innerHTML = ''; return; }
      const C = k => W.cap_from_stats(m, sg, lsl, usl, k);
      res.innerHTML = stable('Results from the entered mean and sigma', [
        ['Cp (needs both limits)', f(C(0), 2)], ['Cpk', f(C(1), 2), '', C(1) < 1 ? 'Below 1: the process spreads past a limit' : ''], ['Cpl (lower side)', f(C(2), 2)], ['Cpu (upper side)', f(C(3), 2)],
        ['Expected below LSL (normal)', f(C(4), 1), 'ppm'], ['Expected above USL (normal)', f(C(5), 1), 'ppm']]) +
        '<p class="ms" style="padding:4px 10px">These are Cp/Cpk if the sigma you entered is short-term (within) and Pp/Ppk if it is the overall standard deviation. ' + idxNote + '</p>';
      plot.innerHTML = capPlot(W, { mean: m, so: sg, sw: 0, lsl, usl });
      return;
    }
    const xs = parseValues(s.text), max = W.buf_len();
    const n = Math.min(xs.length, max);
    new Float64Array(W.memory.buffer, W.buf_ptr(), n).set(xs.slice(0, n));
    el.querySelector('#capcount').textContent = n + ' values read' + (xs.length > max ? ' (only the first ' + max + ' used)' : '') + '.';
    const sg = +s.sg || 1;
    if (n < 2 || (sg > 1 && n < sg)) { res.innerHTML = stable('Results', [['Enter at least ' + Math.max(2, sg) + ' measurements', '', '']]); plot.innerHTML = ''; return; }
    const C = k => W.cap_from_buf(n, lsl, usl, sg, k);
    const mean = C(1), so = C(2), sw = C(3);
    const below = isFinite(lsl) ? xs.slice(0, n).filter(x => x < lsl).length : 0, above = isFinite(usl) ? xs.slice(0, n).filter(x => x > usl).length : 0;
    const used = sg > 1 ? Math.floor(n / sg) * sg : n;
    const rows = [
      ['Count n', String(n), '', n < 50 ? 'Fewer than about 50 values: the indices are rough estimates (NIST)' : ''],
      ['Mean', f(mean, dp)], ['Min / max', f(C(14), dp) + ' / ' + f(C(15), dp)],
      ['Sigma within (' + (sg > 1 ? 'mean range / d2, subgroups of ' + sg + (used < n ? ', last ' + (n - used) + ' value(s) not used' : '') : 'mean moving range / 1.128') + ')', f(sw, dp + 1)],
      ['Sigma overall (sample standard deviation, n - 1)', f(so, dp + 1)],
      ['Cp (within)', f(C(4), 2)], ['Cpk (within)', f(C(5), 2), '', C(5) < 1 ? 'Below 1' : ''],
      ['Pp (overall)', f(C(6), 2)], ['Ppk (overall)', f(C(7), 2), '', C(7) < 1 ? 'Below 1' : ''],
      ['Cpl / Cpu (within)', f(C(8), 2) + ' / ' + f(C(9), 2)], ['Ppl / Ppu (overall)', f(C(10), 2) + ' / ' + f(C(11), 2)],
      ['Expected out of spec, overall (below + above)', f(C(12), 1) + ' + ' + f(C(13), 1), 'ppm'],
      ['Expected out of spec, within (below + above)', f(C(19), 1) + ' + ' + f(C(20), 1), 'ppm'],
      ['Observed out of spec (below + above)', below + ' + ' + above, 'parts', below + above ? 'Measured parts outside the limits' : ''],
    ];
    const gap = so > 0 && sw > 0 ? so / sw : NaN;
    res.innerHTML = stable('Results', rows) + '<p class="ms" style="padding:4px 10px">' +
      (gap > 1.3 ? 'Overall sigma is much larger than within sigma: the process drifts or shifts between parts or subgroups, so it may not be stable. Check it on a control chart before trusting Cp/Cpk. ' : '') +
      'All indices assume a stable process with normally distributed values; check the histogram shape. Values must be in production order for the within sigma to mean anything. ' + idxNote + '</p>';
    plot.innerHTML = capHistogram(W, n, lsl, usl, mean, so, sw);
  };
  draw();
}

// ---------- Temperature compensation ----------
const TEMP_STATE = { reading: '', tp: '', tg: '', ap: '', ag: '', ua: '', nom: '', matp: '', matg: '' };
function confirmedCte() {
  if (typeof MAT === 'undefined' || !MAT) return [];
  const out = [];
  MAT.materials.forEach(m => (m.properties || []).forEach(p => {
    if (p.prop === 'cte' && p.status === 'confirmed' && p.values.length === 1 && p.values[0].max == null)
      out.push({ grade: m.grade, cond: p.cond, um: p.values[0].value, pubs: p.values[0].publishers });
  }));
  return out;
}
async function renderTempComp(el) {
  const s = TEMP_STATE, W = state.W, inch = state.sys === 'inch';
  if (typeof MAT !== 'undefined' && !MAT) { try { MAT = await (await fetch('data/materials.json')).json(); } catch (e) {} }
  const ctes = confirmedCte();
  const tU = inch ? '°F' : '°C', aU = inch ? 'µin/in·°F' : 'µm/m·K', lU = lenU(state.sys);
  const toC = t => inch ? (t - 32) / 1.8 : t;           // unit conversion only
  const toPerK = a => (inch ? a * 1.8 : a) * 1e-6;       // µin/in·°F -> 1/K, µm/m·K -> 1/K
  const fromUm = um => inch ? um / 1.8 : um;
  const matSel = k => '<select data-mat="' + k + '" style="max-width:260px"><option value="">' + (ctes.length ? 'Pick a confirmed value...' : 'No confirmed value in the material data yet') + '</option>' +
    ctes.map((c, i) => '<option value="' + i + '"' + (String(s[k]) === String(i) ? ' selected' : '') + '>' + sesc(c.grade + ' (' + c.cond + '): ' + fmt(fromUm(c.um), 2) + ' ' + aU) + '</option>').join('') + '</select>';
  el.innerHTML = '<div class="grid">' +
    sfield('Measured reading', sinp('reading', s.reading), lU) + sfield('Part temperature', sinp('tp', s.tp), tU) + sfield('Gauge / machine scale temperature', sinp('tg', s.tg), tU) +
    sfield('Part expansion coefficient', sinp('ap', s.ap), aU) + sfield('Gauge expansion coefficient', sinp('ag', s.ag), aU) +
    sfield('Uncertainty of the part coefficient (optional, +/-)', sinp('ua', s.ua), aU) + sfield('Drawing size at ' + (inch ? '68 °F' : '20 °C') + ' (optional)', sinp('nom', s.nom), lU) +
    '</div><div class="mfilter"><span>Part coefficient from material data:</span>' + matSel('matp') + '</div>' +
    '<div class="mfilter"><span>Gauge coefficient from material data:</span>' + matSel('matg') + '</div>' +
    '<p class="desc">Only values that two or more independent publishers print identically (status Confirmed in Material equivalents) are offered. ' + (ctes.length ? '' : 'None of the thermal expansion values in the material data is confirmed yet, so enter the coefficient from your material and gauge data sheets.') + ' Coefficients are averages over a temperature range; near room temperature that is usually fine, but check the range on the data sheet.</p>' +
    '<div class="res" id="tres"></div>';
  el.querySelectorAll('[data-k]').forEach(i => i.oninput = i.onchange = () => { s[i.dataset.k] = i.value; calc(); });
  el.querySelectorAll('[data-mat]').forEach(sel => sel.onchange = () => {
    const k = sel.dataset.mat; s[k] = sel.value;
    if (sel.value !== '') { const c = ctes[+sel.value]; const f = k === 'matp' ? 'ap' : 'ag'; s[f] = +fromUm(c.um).toFixed(3); el.querySelector('[data-k="' + f + '"]').value = s[f]; }
    calc();
  });
  const calc = () => {
    const r = snum(s.reading), tp = snum(s.tp), tg = snum(s.tg), ap = snum(s.ap), ag = snum(s.ag), ua = snum(s.ua), nom = snum(s.nom), dp = sdp() + 1;
    const res = el.querySelector('#tres');
    if (!isFinite(tp) || !isFinite(tg) || !isFinite(ap) || !isFinite(ag)) { res.innerHTML = stable('Results', [['Enter both temperatures and both coefficients', '', '']]); return; }
    const a = [toC(tp), toC(tg), toPerK(ap), toPerK(ag)];
    const rows = [];
    if (isFinite(r)) {
      const l20 = W.temp_length_at_20(r, ...a);
      rows.push(['Length at ' + (inch ? '68 °F (20 °C)' : '20 °C'), fmt(l20, dp), lU], ['Correction to add to the reading', fmt(l20 - r, dp), lU]);
      if (isFinite(nom)) rows.push(['Deviation from drawing size (at 20 °C)', fmt(l20 - nom, dp), lU]);
      if (ua > 0) rows.push(['Uncertainty from the part coefficient (+/-)', fmt(W.alpha_uncertainty(r, toPerK(ua), a[0]), dp), lU]);
    }
    if (isFinite(nom)) rows.push(['A part that is exactly to size reads', fmt(W.temp_reading_for_length(nom, ...a), dp), lU]);
    if (!rows.length) rows.push(['Enter a reading or a drawing size', '', '']);
    const dT = Math.abs(a[0] - a[1]);
    res.innerHTML = stable('Results', rows) + '<p class="ms" style="padding:4px 10px">' + (dT > 2 ? 'Part and gauge differ by ' + fmt(dT, 1) + ' °C: let the part soak to the gauge temperature where you can; the coefficients are the weakest input. ' : '') +
      'When part and gauge are the same material at the same temperature, the correction is close to zero; this is why gauges are often made of steel for steel parts.</p>';
  };
  calc();
}

// ---------- Fraction / decimal / mm ----------
const FRAC_STATE = { text: '0.3', den: 64 };
// Returns inches from text like 1 3/8, 1-3/8, 3/8, 0.375, 0.375", 9.525 mm.
function parseLength(t, W) {
  const s = String(t).trim().toLowerCase().replace(/inch(es)?|in\b|"/g, ' in').replace(/\s+/g, ' ').trim();
  let m = s.match(/^(-?[\d.]+)\s*mm$/);
  if (m) return { inch: +m[1] / IN_MM, from: 'mm' };
  const body = s.replace(/\s*in$/, '').trim();
  m = body.match(/^(-?\d+)[\s-]+(\d+)\/(\d+)$/);
  if (m) return { inch: W.mixed_to_decimal(+m[1], +m[2], +m[3]), from: 'fraction' };
  m = body.match(/^(-?)(\d+)\/(\d+)$/);
  if (m) return { inch: (m[1] ? -1 : 1) * W.mixed_to_decimal(0, +m[2], +m[3]), from: 'fraction' };
  if (/^-?(\d+\.?\d*|\.\d+)$/.test(body)) return { inch: +body, from: state.sys === 'inch' || /in$/.test(s) ? 'decimal inch' : 'mm?' };
  return null;
}
function fracText(W, x, den) {
  const num = W.frac_nearest_num(x, den), a = W.frac_reduce(num, den, 0), b = W.frac_reduce(num, den, 1);
  const neg = a < 0, A = Math.abs(a), whole = Math.floor(A / b), rest = A - whole * b;
  const txt = (neg ? '-' : '') + (whole ? whole + (rest ? ' ' : '') : '') + (rest ? rest + '/' + b : (whole ? '' : '0'));
  return { txt: txt + '"', val: num / den };
}
function renderFraction(el) {
  const s = FRAC_STATE, W = state.W;
  el.innerHTML = '<div class="grid">' + sfield('Value (e.g. 1 3/8, 1-3/8, 0.375, 0.375", 9.525 mm)', '<input type="text" id="fin" value="' + sesc(s.text) + '" style="font-family:var(--mono)" autocomplete="off">', '') +
    sfield('Round to nearest', '<select id="fden">' + [2, 4, 8, 16, 32, 64, 128].map(d => '<option value="' + d + '"' + (d === +s.den ? ' selected' : '') + '>1/' + d + '</option>').join('') + '</select>', 'in') + '</div>' +
    '<p class="desc" id="fhint"></p><div class="res" id="fres"></div><div class="res" id="ftab" style="margin-top:10px"></div>';
  const calc = () => {
    s.text = el.querySelector('#fin').value; s.den = +el.querySelector('#fden').value;
    const p = parseLength(s.text, W), res = el.querySelector('#fres'), tab = el.querySelector('#ftab');
    if (!p || !isFinite(p.inch)) { res.innerHTML = stable('Result', [['Could not read that value', '', '']]); tab.innerHTML = ''; el.querySelector('#fhint').textContent = ''; return; }
    let inch = p.inch, hint = '';
    if (p.from === 'mm?') { inch = p.inch / IN_MM; hint = 'Plain number read as millimetres because the unit toggle is on mm. Add " or in to enter inches.'; }
    else if (p.from === 'decimal inch' && !/in|"/.test(s.text)) hint = 'Plain number read as inches because the unit toggle is on inch. Add mm to enter millimetres.';
    el.querySelector('#fhint').textContent = hint;
    const f = fracText(W, inch, s.den), err = inch - f.val;
    res.innerHTML = stable('Result', [
      ['Decimal inch', fmt(inch, 5), 'in'], ['Millimetres', fmt(inch * IN_MM, 4), 'mm'],
      ['Nearest 1/' + s.den, f.txt, ''], ['That fraction as decimal', fmt(f.val, 6), 'in'],
      ['Error (value - fraction)', fmt(err, 5) + ' in / ' + fmt(err * IN_MM, 4) + ' mm', '']]);
    tab.innerHTML = '<div class="h">Nearest fraction at each denominator</div><table><tr><th style="text-align:left;padding:5px 10px">Denominator</th><th style="text-align:left;padding:5px 10px">Fraction</th><th style="text-align:right;padding:5px 10px">Error in</th><th style="text-align:right;padding:5px 10px">Error mm</th></tr>' +
      [4, 8, 16, 32, 64].map(d => { const g = fracText(W, inch, d), e = inch - g.val; return '<tr><td>1/' + d + '</td><td class="v" style="text-align:left">' + g.txt + '</td><td class="v">' + fmt(e, 5) + '</td><td class="v">' + fmt(e * IN_MM, 4) + '</td></tr>'; }).join('') + '</table>';
  };
  el.querySelector('#fin').oninput = calc; el.querySelector('#fden').onchange = calc;
  calc();
}

// ---------- Setup sheet ----------
const SetupSheets = (() => {
  const KEY = 'bm.setups', ACT = 'bm.setup';
  let list = [], active = '';
  try { list = JSON.parse(localStorage.getItem(KEY) || '[]'); if (!Array.isArray(list)) list = []; active = localStorage.getItem(ACT) || ''; } catch (e) { list = []; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(list)); localStorage.setItem(ACT, active); } catch (e) {} };
  const blank = () => ({ id: 's' + Date.now() + Math.floor(Math.random() * 1000), job: '', part: '', rev: '', op: '', program: '', material: '', stock: '', customer: '', qty: '', date: new Date().toISOString().slice(0, 10), by: '', machine: '', units: state.sys,
    tools: [{ t: '1', desc: '', holder: '', stick: '', h: '', d: '', note: '' }], offsets: [{ name: 'G54', x: '', y: '', z: '', note: '' }], notes: '' });
  return {
    blank, all: () => list,
    current: () => { let s = list.find(x => x.id === active); if (!s) { s = list[0]; if (!s) { s = blank(); list.push(s); } active = s.id; save(); } return s; },
    select: id => { active = id; save(); },
    add: () => { const s = blank(); list.push(s); active = s.id; save(); return s; },
    remove: id => { list = list.filter(x => x.id !== id); active = list[0] ? list[0].id : ''; save(); },
    save,
    exportJson: s => JSON.stringify({ benchmate_setup: 1, sheet: s }, null, 1),
    importJson: txt => {
      const d = JSON.parse(txt), s = d && d.sheet;
      if (!s || typeof s !== 'object' || !Array.isArray(s.tools) || !Array.isArray(s.offsets)) throw new Error('Not a BenchMate setup sheet file');
      const b = blank(); const clean = Object.assign(b, s, { id: b.id });
      clean.tools = s.tools.map(r => Object.assign({ t: '', desc: '', holder: '', stick: '', h: '', d: '', note: '' }, r));
      clean.offsets = s.offsets.map(r => Object.assign({ name: '', x: '', y: '', z: '', note: '' }, r));
      list.push(clean); active = clean.id; save(); return clean;
    },
  };
})();

function renderSetupSheet(el) {
  const S = SetupSheets, s = S.current();
  const u = s.units === 'mm' ? 'mm' : 'in';
  const mach = (Profiles.all().find(m => m.id === s.machine)) || null;
  const HEAD = [['job', 'Job / work order'], ['part', 'Part number'], ['rev', 'Revision'], ['op', 'Operation'], ['program', 'Program number'], ['customer', 'Customer'], ['material', 'Material'], ['stock', 'Stock size'], ['qty', 'Quantity'], ['date', 'Date'], ['by', 'Prepared by']];
  const TC = [['t', 'T no.', 60], ['desc', 'Description', 220], ['holder', 'Holder', 140], ['stick', 'Stick-out (' + u + ')', 90], ['h', 'Length offset', 90], ['d', 'Dia / radius offset', 90], ['note', 'Notes', 160]];
  const OC = [['name', 'Work offset', 80], ['x', 'X', 100], ['y', 'Y', 100], ['z', 'Z', 100], ['note', 'Notes', 240]];
  const txt = (k, v, w, attr) => '<input type="text" ' + attr + ' value="' + sesc(v) + '" style="width:' + w + 'px">';
  const rowsHtml = (arr, cols, kind) => '<div style="overflow-x:auto"><table class="gtab sstab"><tr>' + cols.map(c => '<th>' + c[1] + '</th>').join('') + '<th></th></tr>' +
    arr.map((r, i) => '<tr>' + cols.map(([k, , w]) => '<td>' + txt(k, r[k], w, 'data-' + kind + '="' + i + '" data-c="' + k + '"') + '</td>').join('') + '<td><button class="btn" data-del' + kind + '="' + i + '">Remove</button></td></tr>').join('') + '</table></div>';
  const mopts = '<option value="">(none)</option>' + Profiles.all().map(m => '<option value="' + sesc(m.id) + '"' + (m.id === s.machine ? ' selected' : '') + '>' + sesc(m.name) + '</option>').join('');
  el.innerHTML = '<div class="noprint">' +
    '<div class="mfilter" style="flex-wrap:wrap"><span>Sheet:</span><select id="ssel" style="max-width:280px">' + S.all().map(x => '<option value="' + sesc(x.id) + '"' + (x.id === s.id ? ' selected' : '') + '>' + sesc([x.part || '(no part number)', x.op].filter(Boolean).join(' / ')) + '</option>').join('') + '</select>' +
    '<button class="btn" id="snew">New sheet</button><button class="btn" id="sdel">Delete sheet</button><button class="btn" id="sprint">Print</button><button class="btn" id="sexp">Export JSON</button><label class="btn" style="display:inline-flex;align-items:center">Import JSON<input type="file" id="simp" accept=".json,application/json" style="display:none"></label></div>' +
    '<p class="desc" id="smsg">Saved in this browser as you type. Export a JSON file to move a sheet to another computer.</p>' +
    '<div class="grid">' + HEAD.map(([k, l]) => '<label class="f"><span>' + l + '</span><div class="row">' + txt(k, s[k], 200, 'data-h="' + k + '"') + '</div></label>').join('') +
    '<label class="f"><span>Machine (from Machine profiles)</span><div class="row"><select data-h="machine">' + mopts + '</select></div></label>' +
    '<label class="f"><span>Units on this sheet</span><div class="row"><select data-h="units"><option value="in"' + (u === 'in' ? ' selected' : '') + '>inch</option><option value="mm"' + (u === 'mm' ? ' selected' : '') + '>mm</option></select></div></label></div>' +
    '<h2>Tools</h2>' + rowsHtml(s.tools, TC, 't') + '<div class="mfilter" style="margin-top:6px"><button class="btn" id="tadd">Add tool</button></div>' +
    '<h2>Work offsets</h2>' + rowsHtml(s.offsets, OC, 'o') + '<div class="mfilter" style="margin-top:6px"><button class="btn" id="oadd">Add work offset</button></div>' +
    '<h2>Notes</h2><textarea id="snotes" rows="5" style="width:100%;max-width:880px;border:1px solid var(--line);border-radius:var(--r);background:var(--panel);padding:6px">' + sesc(s.notes) + '</textarea></div>' +
    '<div class="sheetprint" id="sprintview"></div>';
  const printView = () => {
    const m = (Profiles.all().find(x => x.id === s.machine)) || null;
    const kv = HEAD.filter(([k]) => s[k]).map(([k, l]) => '<tr><th>' + l + '</th><td>' + sesc(s[k]) + '</td></tr>').join('') +
      (m ? '<tr><th>Machine</th><td>' + sesc([m.name, m.type, m.control].filter(Boolean).join(', ')) + '</td></tr>' : '');
    const tbl = (arr, cols) => '<table class="pt"><tr>' + cols.map(c => '<th>' + c[1] + '</th>').join('') + '</tr>' + arr.map(r => '<tr>' + cols.map(([k]) => '<td>' + sesc(r[k]) + '</td>').join('') + '</tr>').join('') + '</table>';
    el.querySelector('#sprintview').innerHTML = '<h1>Setup sheet' + (s.part ? ': ' + sesc(s.part) : '') + (s.op ? ' / ' + sesc(s.op) : '') + '</h1><table class="pkv">' + kv + '</table>' +
      '<h2>Tools</h2>' + tbl(s.tools, TC) + '<h2>Work offsets (' + u + ')</h2>' + tbl(s.offsets, OC) + (s.notes ? '<h2>Notes</h2><div class="pnotes">' + sesc(s.notes) + '</div>' : '') +
      '<p class="pfoot">Machinists BenchMate setup sheet. Printed ' + new Date().toISOString().slice(0, 10) + '.</p>';
  };
  const changed = () => { S.save(); printView(); };
  el.querySelectorAll('[data-h]').forEach(i => i.oninput = i.onchange = () => { s[i.dataset.h] = i.value; changed(); if (i.dataset.h === 'units') renderSetupSheet(el); if (i.dataset.h === 'part' || i.dataset.h === 'op') { const o = el.querySelector('#ssel option[value="' + s.id + '"]'); if (o) o.textContent = [s.part || '(no part number)', s.op].filter(Boolean).join(' / '); } });
  el.querySelectorAll('[data-t]').forEach(i => i.oninput = () => { s.tools[+i.dataset.t][i.dataset.c] = i.value; changed(); });
  el.querySelectorAll('[data-o]').forEach(i => i.oninput = () => { s.offsets[+i.dataset.o][i.dataset.c] = i.value; changed(); });
  el.querySelectorAll('[data-delt]').forEach(b => b.onclick = () => { s.tools.splice(+b.dataset.delt, 1); changed(); renderSetupSheet(el); });
  el.querySelectorAll('[data-delo]').forEach(b => b.onclick = () => { s.offsets.splice(+b.dataset.delo, 1); changed(); renderSetupSheet(el); });
  el.querySelector('#tadd').onclick = () => { const last = s.tools[s.tools.length - 1]; s.tools.push({ t: last && /^\d+$/.test(last.t) ? String(+last.t + 1) : '', desc: '', holder: '', stick: '', h: '', d: '', note: '' }); changed(); renderSetupSheet(el); };
  el.querySelector('#oadd').onclick = () => { const n = s.offsets.length; s.offsets.push({ name: n < 6 ? 'G' + (54 + n) : '', x: '', y: '', z: '', note: '' }); changed(); renderSetupSheet(el); };
  el.querySelector('#snotes').oninput = e => { s.notes = e.target.value; changed(); };
  el.querySelector('#ssel').onchange = e => { S.select(e.target.value); renderSetupSheet(el); };
  el.querySelector('#snew').onclick = () => { S.add(); renderSetupSheet(el); };
  el.querySelector('#sdel').onclick = () => { if (confirm('Delete this setup sheet from this browser?')) { S.remove(s.id); renderSetupSheet(el); } };
  el.querySelector('#sprint').onclick = () => { printView(); window.print(); };
  el.querySelector('#sexp').onclick = () => {
    const blob = new Blob([S.exportJson(s)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'setup-' + ((s.part || 'sheet') + (s.op ? '-' + s.op : '')).replace(/[^\w.-]+/g, '_') + '.json';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  el.querySelector('#simp').onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    f.text().then(t => { S.importJson(t); renderSetupSheet(el); }).catch(err => { el.querySelector('#smsg').innerHTML = '<span class="warn">Import failed: ' + sesc(err.message) + '</span>'; });
  };
  if (s.machine && !mach) el.querySelector('#smsg').innerHTML += ' <span class="warn">The machine on this sheet is not in this computer\'s machine profiles.</span>';
  printView();
}
