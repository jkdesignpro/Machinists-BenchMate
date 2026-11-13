'use strict';
// Threads round 3: ACME and Stub ACME (ASME B1.5, B1.8), metric trapezoidal
// (ISO 2904), helical-insert STI tapped holes, UNJ / UNR root rules and the
// constant-pitch UN series, coating allowance. Uses the helpers in
// refdata.js and refdata2.js (loadRef, badge, fBoth, pubCell, calcCell ...).
// Series come from data/refdata.json (power_threads) with their publisher
// consensus; every dimension is computed by the Rust core (state.W).

const T3_ACME_CLASSES = [[2, '2G'], [3, '3G'], [4, '4G'], [12, '2C'], [13, '3C'], [14, '4C']];
const t3Frac = s => String(s).split(' ').reduce((a, f) => a + (f.includes('/') ? f.split('/')[0] / f.split('/')[1] : +f), 0);
const t3Opt = (list, v) => list.map(([k, t]) => '<option value="' + rEsc(k) + '"' + (String(k) === String(v) ? ' selected' : '') + '>' + rEsc(t) + '</option>').join('');
const t3Num = (id, label, unit, val) => '<label class="f"><span>' + label + '</span><div class="row"><input id="' + id + '" type="number" step="any" inputmode="decimal" value="' + val + '"><span class="u">' + unit + '</span></div></label>';
const t3Sel = (id, label, html) => '<label class="f"><span>' + label + '</span><div class="row"><select id="' + id + '">' + html + '</select></div></label>';
// Limits table: inch values from the core, shown in both units.
function t3Limits(title, ext, int) {
  const L = v => fBoth(v * IN_MM);
  const r = (lab, a, b) => '<tr><td>' + lab + '</td><td class="v">' + L(a) + '</td><td class="v">' + L(b) + '</td></tr>';
  return '<div class="res"><div class="h">' + title + '</div><div class="mtab"><table><tr><th></th><th>Max</th><th>Min</th></tr>' +
    '<tr><td colspan="3"><b>External thread (screw)</b></td></tr>' + r('Major diameter', ext[0], ext[1]) + r('Pitch diameter', ext[2], ext[3]) + r('Minor diameter', ext[4], ext[5]) +
    '<tr><td colspan="3"><b>Internal thread (nut)</b></td></tr>' + r('Major diameter', int[0], int[1]) + r('Pitch diameter', int[2], int[3]) + r('Minor diameter', int[4], int[5]) +
    '</table></div></div>';
}

// ------------------------------------------------------------------ ACME and Stub ACME
async function renderAcme(el) {
  const R = await loadRef(el); if (!R) return;
  const W = state.W, A = R.power_threads, m = RMEM.acme || (RMEM.acme = { form: 'gp', size: '1', cls: 2, starts: 1, d: 1, tpi: 5 });
  const list = () => A[m.form === 'stub' ? 'stub_acme' : 'acme'];
  el.innerHTML = '<div class="grid" style="max-width:760px">' +
    t3Sel('af', 'Thread form', t3Opt([['gp', 'ACME general purpose and centralizing (ASME B1.5)'], ['stub', 'Stub ACME (ASME B1.8)']], m.form)) +
    t3Sel('az', 'Size', '') + t3Sel('ac', 'Class', '') +
    '<span id="acust" style="display:contents">' + t3Num('ad', 'Major diameter', 'in', m.d) + t3Num('at', 'Threads per inch', 'TPI', m.tpi) + '</span>' +
    t3Num('as', 'Number of starts', '', m.starts) + '</div><div id="ares"></div>' +
    '<div class="note"><b>Working:</b> 29 degree form, P = 1 / TPI. ACME: thread height h = 0.5 P, flat F = 0.3707 P, pitch diameter E = D - 0.5 P, minor K = D - P. Stub ACME: h = 0.3 P, flat 0.4224 P, E = D - 0.3 P, K = D - 0.6 P. ' +
    'Pitch diameter allowance on the screw (es): 2G 0.008 sqrt D, 3G 0.006 sqrt D, 4G 0.004 sqrt D. Pitch diameter tolerance, screw and nut alike: 2G 0.030 sqrt P + 0.006 sqrt D, 3G 0.014 sqrt P + 0.0028 sqrt D, 4G 0.010 sqrt P + 0.002 sqrt D. Clearance c = 0.020 in at 10 TPI and coarser, 0.010 in finer: screw minor max = K - c; nut major = D + c to D + 2c. Screw major tolerance and nut minor tolerance 0.05 P (at least 0.005 in). Screw minor tolerance = 1.5 x pitch diameter tolerance. ' +
    'Centralizing (C) classes have the same pitch diameters but a tight major diameter fit: screw major tolerance 0.0035 sqrt D (2C), 0.0015 sqrt D (3C), 0.0010 sqrt D (4C); nut major from D + 0.001 sqrt D, tolerance 0.0035 sqrt D (2C, 3C) or 0.0020 sqrt D (4C); nut minor from K + 0.1 P. Stub ACME takes the 2G allowance and tolerances. Allowance and pitch diameter tolerance are rounded to 0.0001 in before use, as the published tables are; the limits reproduce a published 2-4 ACME table for all six classes (tests in core/src/power_threads.rs). ' +
    'These limits are for single-start threads with a length of engagement up to 2 D; the standard adds allowance for multi-start nuts and longer engagements, which is not applied here. Classes 5G, 5C and 6C (appendices of B1.5) are not included.' +
    '<br><b>Sources:</b> ASME B1.5-1997 (R2024) and ASME B1.8-1988 (cited by name; see docs/sources.md for editions); formulas as confirmed in NBS Handbook H28 (1957) Part III and the publishers below.</div><div class="note" id="asrc"></div>';
  const af = $('#af', el), az = $('#az', el), ac = $('#ac', el), ad = $('#ad', el), at = $('#at', el), as = $('#as', el);
  function sizes() {
    az.innerHTML = list().map(r => '<option value="' + rEsc(r.size) + '"' + (r.size === m.size ? ' selected' : '') + '>' + rEsc(r.size + '"-' + r.tpi.value) + '</option>').join('') + '<option value="custom"' + (m.size === 'custom' ? ' selected' : '') + '>Other size</option>';
    ac.innerHTML = m.form === 'stub' ? '<option value="2">Stub (2G fit)</option>' : t3Opt(T3_ACME_CLASSES, m.cls);
  }
  function upd() {
    m.form = af.value; m.size = az.value; m.cls = +ac.value;
    $('#acust', el).style.display = m.size === 'custom' ? 'contents' : 'none';
    const r = list().find(x => x.size === m.size);
    let d, tpi;
    if (r) { d = t3Frac(r.size); tpi = +r.tpi.value; } else { d = parseFloat(ad.value); tpi = parseFloat(at.value); if (d > 0) m.d = d; if (tpi > 0) m.tpi = tpi; }
    const n = Math.max(1, Math.round(parseFloat(as.value) || 1)); m.starts = n;
    const out = $('#ares', el);
    if (!(d > 0 && tpi > 0 && 1 / tpi < d)) { out.innerHTML = '<div class="res"><table><tr><td class="warn">Enter the thread size.</td></tr></table></div>'; return; }
    const p = 1 / tpi, stub = m.form === 'stub', hk = stub ? 0.3 : 0.5;
    const e = d - hk * p, L = v => fBoth(v * IN_MM), lead = n * p;
    const lim = (int, w) => stub ? W.stub_acme_limit(d, p, int, w) : W.acme_limit(d, p, m.cls, int, w);
    const ext = [0, 1, 2, 3, 4, 5].map(w => lim(0, w)), intl = [0, 1, 2, 3, 4, 5].map(w => lim(1, w));
    const wire = W.thread_misc(p, 29, 1);
    let h = '<div class="res"><div class="h">' + rEsc((r ? r.size + '"' : fx(d, 4) + '"') + '-' + tpi + (stub ? ' STUB ACME' : ' ACME-' + (T3_ACME_CLASSES.find(c => c[0] === m.cls) || [0, ''])[1])) + (n > 1 ? ' (' + n + ' starts)' : '') + '</div><table>' + rowsHtml([
      ['Threads per inch', r ? pubCell(A.sources, r.tpi, v => tpiText(+v)) : calcCell(tpiText(tpi), 'entered')],
      ['Pitch P', calcCell(L(p), '1 / TPI')],
      ['Lead L = starts x P', calcCell(L(lead))],
      ['Thread height h = ' + hk + ' P', calcCell(L(hk * p))],
      ['Flat at crest ' + (stub ? '0.4224' : '0.3707') + ' P', calcCell(L((stub ? 0.4224 : 0.3707) * p))],
      ['Basic pitch diameter E', calcCell(L(e))],
      ['Basic minor diameter', calcCell(L(d - 2 * hk * p))],
      ['Lead angle at E', calcCell(fx(W.thread_misc(lead, e, 2), 3) + ' deg', 'atan(L / (pi E))')],
      ['Best wire 0.51645 P', calcCell(L(wire), 'touches the flanks at the pitch line')],
      ['Over three wires at basic E', calcCell(L(W.wire_measurement(e, wire, p, 29, 0)), 'M = E + 4.9939 w - 1.9334 P, no lead angle correction')],
    ]) + '</table></div>' + t3Limits('Limits of size (inch thread; lengths in both units)', ext, intl);
    if (n > 1) h += '<div class="note warn">Multi-start thread: the limits above are the single-start values. ASME B1.5 increases the pitch diameter allowance of multi-start threads; check the standard before cutting.</div>';
    out.innerHTML = h;
  }
  $('#asrc', el).innerHTML = '<b>Series sources</b><br>' + sourceList(A.sources);
  sizes();
  af.onchange = () => { m.form = af.value; m.size = '1'; sizes(); upd(); };
  [az, ac].forEach(x => x.onchange = upd); [ad, at, as].forEach(x => x.oninput = upd);
  upd();
}

// ------------------------------------------------------------------ metric trapezoidal
async function renderTrapezoidal(el) {
  const R = await loadRef(el); if (!R) return;
  const W = state.W, A = R.power_threads, m = RMEM.trap || (RMEM.trap = { size: '20x4', d: 20, p: 4, starts: 1 });
  const rows = A.trap || [];
  el.innerHTML = '<div class="grid" style="max-width:760px">' + t3Sel('tz', 'Size (Tr d x P)', rows.map(r => '<option value="' + rEsc(r.size) + '"' + (r.size === m.size ? ' selected' : '') + '>Tr ' + rEsc(r.size.replace('x', ' x ')) + '</option>').join('') + '<option value="custom"' + (m.size === 'custom' ? ' selected' : '') + '>Other size</option>') +
    '<span id="tcust" style="display:contents">' + t3Num('td', 'Nominal (major) diameter d', 'mm', m.d) + t3Num('tp', 'Pitch P', 'mm', m.p) + '</span>' + t3Num('tn', 'Number of starts', '', m.starts) + '</div><div id="tres"></div>' +
    '<div class="note"><b>Working (ISO 2904 basic profile, 30 degree thread):</b> H1 = 0.5 P (flank overlap); clearance ac = 0.15 mm (P 1.5), 0.25 (P 2 to 5), 0.5 (P 6 to 12), 1 (P 14 to 44); h3 = H4 = 0.5 P + ac; pitch diameter d2 = D2 = d - 0.5 P; screw minor d3 = d - 2 h3; nut minor D1 = d - P; nut major D4 = d + 2 ac; root radius R1 up to 0.5 ac, R2 up to ac; flat at crest 0.366 P. Multi-start: Tr d x Ph (lead) P (pitch); lead = starts x P. ' +
    'Tolerances (ISO 2903) are tabulated in the standard and are not computed here.' +
    '<br><b>Sources:</b> ISO 2904 (basic dimensions), ISO 2901 (basic profile), ISO 2903 (tolerances), cited by name (editions in docs/sources.md); series and published rows from the publishers below.</div><div class="note" id="tsrc3"></div>';
  const tz = $('#tz', el), td = $('#td', el), tp = $('#tp', el), tn = $('#tn', el);
  function upd() {
    m.size = tz.value;
    $('#tcust', el).style.display = m.size === 'custom' ? 'contents' : 'none';
    const r = rows.find(x => x.size === m.size);
    let d, p;
    if (r) { [d, p] = r.size.split('x').map(Number); } else { d = parseFloat(td.value); p = parseFloat(tp.value); if (d > 0) m.d = d; if (p > 0) m.p = p; }
    const n = Math.max(1, Math.round(parseFloat(tn.value) || 1)); m.starts = n;
    const out = $('#tres', el);
    if (!(d > 0 && p > 0 && p < d / 2)) { out.innerHTML = '<div class="res"><table><tr><td class="warn">Enter the thread size.</td></tr></table></div>'; return; }
    const v = k => W.trap_value(d, p, k);
    const pubd = (f, k) => r && r[f] ? pubCell(A.sources, r[f], x => fBoth(+x) + (Math.abs(+x - v(k)) < 6e-4 ? ' <span class="ms">= formula</span>' : ' <span class="warn">formula ' + fx(v(k), 3) + ' mm</span>')) : calcCell(fBoth(v(k)));
    out.innerHTML = '<div class="res"><div class="h">Tr ' + (+d) + ' x ' + (n > 1 ? (n * p) + ' (P ' + p + ')' : p) + (r ? ' ' + badge(r.p.status) + ' <span class="ms">size printed by ' + r.p.groups[0].publishers.map(x => rEsc(pubName(A.sources, x))).join(', ') + '</span>' : '') + '</div><table>' + rowsHtml([
      ['Pitch P', calcCell(fBoth(p))],
      ['Lead Ph = starts x P', calcCell(fBoth(n * p))],
      ['Clearance ac', calcCell(fBoth(v(6)))],
      ['Pitch diameter d2 = D2', pubd('d2', 0)],
      ['Screw minor diameter d3', pubd('d3', 1)],
      ['Nut minor diameter D1', pubd('D1', 2)],
      ['Nut major diameter D4', pubd('D4', 3)],
      ['Thread height h3 = H4', calcCell(fBoth(v(4)))],
      ['Flank overlap H1', calcCell(fBoth(v(5)))],
      ['Root radius R1 max / R2 max', calcCell(fBoth(v(7)) + ' / ' + fBoth(v(8)))],
      ['Flat at crest 0.366 P', calcCell(fBoth(v(9)))],
      ['Lead angle at d2', calcCell(fx(W.thread_misc(n * p, v(0), 2), 3) + ' deg', 'atan(Ph / (pi d2))')],
      ['Best wire P / (2 cos 15 deg)', calcCell(fBoth(W.thread_misc(p, 30, 1)))],
      ['Over three wires at basic d2', calcCell(fBoth(W.wire_measurement(v(0), W.thread_misc(p, 30, 1), p, 30, 0)), 'M = d2 + 4.8637 w - 1.8660 P, no lead angle correction')],
    ]) + '</table></div>';
  }
  $('#tsrc3', el).innerHTML = '<b>Series sources</b><br>' + sourceList(A.sources);
  tz.onchange = upd; [td, tp, tn].forEach(x => x.oninput = upd);
  upd();
}

// ------------------------------------------------------------------ helical insert (STI) tapped holes
// Parse '1/4-20' or '10-24' (inch, number sizes by the ASME B1.1 rule) and 'M10x1.5' (mm).
function t3Size(s) {
  if (s[0] === 'M') { const [d, p] = s.slice(1).split('x').map(Number); return { d, p, mm: true }; }
  const [a, t] = s.split('-'); const d = a.includes('/') || a.includes(' ') ? t3Frac(a) : state.W.un_number_major_in ? state.W.un_number_major_in(+a) : 0.060 + 0.013 * +a;
  return { d, p: 1 / +t, mm: false };
}
async function renderSti(el) {
  const R = await loadRef(el); if (!R) return;
  const W = state.W, A = R.power_threads, m = RMEM.sti || (RMEM.sti = { size: '1/4-20' });
  const all = [...(A.sti_unc || []).map(r => ['u', r]), ...(A.sti_metric || []).map(r => ['m', r])];
  el.innerHTML = '<div class="grid" style="max-width:760px">' + t3Sel('sz', 'Nominal thread of the installed insert', all.map(([k, r]) => '<option value="' + rEsc(r.size) + '"' + (r.size === m.size ? ' selected' : '') + '>' + rEsc(r.size) + (k === 'u' ? ' UNC' : '') + '</option>').join('') + '<option value="custom"' + (m.size === 'custom' ? ' selected' : '') + '>Other size</option>') +
    '<span id="scust" style="display:contents">' + t3Num('sd', 'Nominal major diameter', uLen(), m.d || '') + t3Num('sp', inMode() ? 'Threads per inch' : 'Pitch', inMode() ? 'TPI' : 'mm', m.p || '') + '</span></div><div id="sres"></div>' +
    '<div class="note"><b>Working:</b> a helical coil insert is a diamond-section wire coil; installed, its inside forms the nominal thread. The hole is tapped with an STI (screw thread insert) tap to a thread of the same pitch whose every diameter is larger by 2 x 0.649519 P = 1.299038 P: STI major (min) = D + 1.299038 P, STI pitch diameter (min) = D + 0.649519 P, STI minor (min) = D + 0.216506 P. This rule reproduces the tapped-hole tables of the insert makers below (tests in core/src/power_threads.rs); the maximum limits are the makers\' (the inch tables follow NASM33537, the metric MA1567). An STI tap is chosen by the maker\'s H limit (pitch diameter above the STI basic), and the tap drill by the minor diameter limits. Plating or coating the insert changes the fitted thread by twice the usual amount (8 x thickness on pitch diameter, see the coating tool).' +
    '<br><b>Sources:</b> insert and tap makers listed below; NASM33537 and MA1567 cited by name as the makers do.</div><div class="note" id="ssrc"></div>';
  const sz = $('#sz', el), sd = $('#sd', el), sp = $('#sp', el);
  function upd() {
    m.size = sz.value;
    $('#scust', el).style.display = m.size === 'custom' ? 'contents' : 'none';
    const r = all.map(x => x[1]).find(x => x.size === m.size);
    let d, p;
    if (r) { const t = t3Size(r.size); d = t.mm ? t.d : t.d * IN_MM; p = t.mm ? t.p : t.p * IN_MM; }
    else { d = fromUser(parseFloat(sd.value)); const pv = parseFloat(sp.value); p = inMode() ? IN_MM / pv : pv; if (d > 0 && p > 0) { m.d = sd.value; m.p = sp.value; } }
    const out = $('#sres', el);
    if (!(d > 0 && p > 0 && p < d)) { out.innerHTML = '<div class="res"><table><tr><td class="warn">Enter the thread size.</td></tr></table></div>'; return; }
    const isIn = r ? !r.size.startsWith('M') : inMode(), k = isIn ? IN_MM : 1;
    const v = w => W.sti_value(d, p, w);
    const pub = (f, w) => {
      if (!r || !r[f]) return w === undefined ? calcCell('-', 'not printed') : calcCell(fBoth(v(w)));
      return pubCell(A.sources, r[f], x => fBoth(+x * k) + (w === undefined ? '' : Math.abs(+x * k - v(w)) < (isIn ? 0.6 : 0.6) * (isIn ? 0.0001 * IN_MM : 0.001) ? ' <span class="ms">= rule</span>' : ' <span class="ms">rule ' + (isIn ? fx(v(w) / IN_MM, 4) + ' in' : fx(v(w), 3) + ' mm') + '</span>'));
    };
    out.innerHTML = '<div class="res"><div class="h">STI tapped hole for ' + rEsc(r ? r.size : 'D ' + fLen(d) + ' ' + uLen()) + '</div><table>' + rowsHtml([
      ['Pitch (same as the nominal thread)', calcCell(fBoth(p) + (isIn ? ' <span class="ms">' + fx(IN_MM / p, 2) + ' TPI</span>' : ''))],
      ['Enlargement on every diameter 1.299038 P', calcCell(fBoth(v(3)))],
      ['Major diameter, min (D + 1.299038 P)', pub('major_min', 0)],
      ['Pitch diameter, min (D + 0.649519 P)', pub('pd_min', 1)],
      ['Pitch diameter, max, class 3B / 4H', pub('pd_max_3b')],
      ['Pitch diameter, max, class 2B / 5H', pub('pd_max_2b')],
      ['Minor diameter, min (D + 0.216506 P)', pub('minor_min', 2)],
      ['Minor diameter, max', pub('minor_max')],
    ]) + '</table></div>';
  }
  $('#ssrc', el).innerHTML = '<b>Sources</b><br>' + sourceList(Object.fromEntries(['RECOIL', 'KATO', 'VARGUS_HC', 'KATO_PLATE'].map(k => [k, A.sources[k]])));
  sz.onchange = upd; [sd, sp].forEach(x => x.oninput = upd);
  upd();
}

// ------------------------------------------------------------------ UNJ and UNR
async function renderUnjUnr(el) {
  const R = await loadRef(el); if (!R) return;
  const W = state.W, A = R.power_threads, m = RMEM.unj || (RMEM.unj = { key: '1/4-20 UNC', cls: 3 });
  const opts = threadOptions(R).filter(o => o.sys === 'unified');
  el.innerHTML = '<div class="grid" style="max-width:760px">' + t3Sel('jk', 'Unified size', opts.map(o => '<option value="' + rEsc(o.key) + '"' + (o.key === m.key ? ' selected' : '') + '>' + rEsc(o.label) + '</option>').join('')) +
    t3Sel('jc', 'Class', t3Opt([[3, '3A / 3B'], [2, '2A / 2B']], m.cls)) + '</div><div id="jres"></div>' +
    '<div class="note"><b>Working:</b> UNJ (ASME B1.15) is the UN form with a controlled, larger root radius on the external thread, 0.15011 P to 0.18042 P, and a larger internal minor diameter, minimum D - 0.974279 P (= D - 2 x 0.5625 H, against D - 1.082532 P for UN), so a nut can clear the bigger root. With the root arc tangent to both flanks, the screw minor diameter is E - 2 (H/2 - r): its maximum uses the pitch diameter maximum and r = 0.18042 P, its minimum the pitch diameter minimum and r = 0.15011 P. These reproduce a published UNJC 3A/3B table (tests in core/src/power_threads.rs). UNJ is mainly class 3A/3B; pitch diameters follow the UN limits of the class. ' +
    'UNR (ASME B1.1) applies to external threads only: the same limits as UN 2A/3A, but the root must be rounded with a radius of curvature not less than 0.108253 P (H/8) anywhere, the tangency point no closer than 0.625 H to the basic major diameter. A UN thread ring gauge checks it; internal threads have no UNR requirement. BenchMate does not compute the UNR minor diameter limits.' +
    '<br><b>Sources:</b> ASME B1.15-1995 and ASME B1.1-2024 (cited by name); SAE AS8879 (formerly MIL-S-8879) as named by the publishers below.</div><div class="note" id="jsrc"></div>';
  const jk = $('#jk', el), jc = $('#jc', el);
  function upd() {
    m.key = jk.value; m.cls = +jc.value;
    const o = opts.find(x => x.key === m.key) || opts[0]; if (!o) return;
    jk.value = o.key; m.key = o.key;
    const d = o.d / IN_MM, p = o.p / IN_MM, c = m.cls, L = v => fBoth(v * IN_MM);
    const u = w => W.unj_value(d, p, c, w);
    $('#jres', el).innerHTML = '<div class="res"><div class="h">' + rEsc(o.label.replace('UN', 'UNJ')) + '-' + c + 'A / ' + c + 'B</div><table>' + rowsHtml([
      ['External root radius r', calcCell(L(u(0)) + ' to ' + L(u(1)), '0.15011 P to 0.18042 P')],
      ['External pitch diameter', calcCell(L(u(5)) + ' max, ' + L(u(6)) + ' min', 'UN ' + c + 'A limits')],
      ['External minor diameter, max', calcCell(L(u(2)), 'E max - 2 (H/2 - 0.18042 P)')],
      ['External minor diameter, min', calcCell(L(u(3)), 'E min - 2 (H/2 - 0.15011 P)')],
      ['Internal minor diameter, min', calcCell(L(u(4)), 'D - 0.974279 P')],
      ['UN internal minor diameter, basic (for comparison)', calcCell(L(W.thread_basic_minor_dia(d, p)), 'D - 1.082532 P')],
      ['UNR external root radius, min', calcCell(L(0.108253 * p), '0.108253 P')],
    ]) + '</table></div>';
  }
  $('#jsrc', el).innerHTML = '<b>Sources</b><br>' + sourceList(Object.fromEntries(['TORQ_UNJ', 'RPG_UNJ', 'TC_UNR'].filter(k => A.sources[k]).map(k => [k, A.sources[k]])));
  [jk, jc].forEach(x => x.onchange = upd);
  upd();
}

// ------------------------------------------------------------------ coating allowance
async function renderCoating(el) {
  const R = await loadRef(el); if (!R) return;
  const W = state.W, A = R.power_threads;
  const m = RMEM.coat || (RMEM.coat = { src: 'thread', sys: 'unified', d: '1/2', p: '20', cls: '2', plan: 'allow', ang: 60, int: 0, e1: '', e2: '', t1: '', t2: '' });
  if (!m.src) Object.assign(m, { src: 'thread', sys: 'unified', d: '1/2', p: '20', cls: '2', plan: 'allow' });
  // Classes: Unified (ASME B1.1) codes as in core un_limit; ISO 965 as [grade, position code] (core iso965_limit).
  const UN_CLS = [['1', '1A (external)'], ['2', '2A (external)'], ['3', '3A (external)'], ['11', '1B (internal)'], ['12', '2B (internal)'], ['13', '3B (internal)']];
  const ISO_CLS = [['6.3', '6g (external)'], ['6.4', '6h (external)'], ['6.2', '6f (external)'], ['6.1', '6e (external)'], ['8.3', '8g (external)'], ['4.4', '4h (external)'], ['6.12', '6H (internal)'], ['5.12', '5H (internal)'], ['7.12', '7H (internal)'], ['6.11', '6G (internal)']];
  el.innerHTML = '<div class="grid" style="max-width:760px">' +
    t3Sel('cm', 'Start from', t3Opt([['thread', 'A thread size and its class (worked out here)'], ['typed', 'Finished pitch diameter limits I type']], m.src)) + '</div>' +
    '<div class="grid cth" style="max-width:760px">' +
    t3Sel('cs', 'Thread system', t3Opt([['unified', 'Unified inch (UNC, UNF, UNEF, UN, UNS)'], ['metric', 'ISO metric']], m.sys)) +
    '<label class="f"><span>Major diameter</span><div class="row"><input id="cd" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" value="' + rEsc(m.d) + '"><span class="u" id="cdu"></span></div></label>' +
    '<label class="f"><span id="cpl">Pitch</span><div class="row"><input id="cp" type="number" step="any" inputmode="decimal" value="' + rEsc(m.p) + '"><span class="u" id="cpu"></span></div></label>' +
    t3Sel('cc', 'Class', '') +
    t3Sel('cpln', 'How the coating is allowed for', '') + '</div>' +
    '<div class="grid cty" style="max-width:760px">' +
    t3Sel('ca', 'Thread form (included angle)', t3Opt([[60, '60 degrees: UN, ISO metric, NPT'], [55, '55 degrees: Whitworth, BSP'], [29, '29 degrees: ACME, Stub ACME'], [30, '30 degrees: metric trapezoidal']], m.ang)) +
    t3Sel('ci', 'Thread', t3Opt([[0, 'External (screw)'], [1, 'Internal (nut)'], [2, 'Helical insert (coated insert)']], m.int)) +
    t3Num('ce1', 'Finished pitch diameter, max (after coating)', uLen(), m.e1) + t3Num('ce2', 'Finished pitch diameter, min (after coating)', uLen(), m.e2) + '</div>' +
    '<div class="grid" style="max-width:760px">' +
    t3Num('ct1', 'Coating thickness per surface, max', '<span class="ctu">' + uLen() + '</span>', m.t1) + t3Num('ct2', 'Coating thickness per surface, min', '<span class="ctu">' + uLen() + '</span>', m.t2) + '</div><div id="cres"></div>' +
    '<div class="note"><b>Working:</b> a uniform coating of thickness t on both flanks moves each flank by t normal to itself, which changes the pitch diameter by 2 t / sin(a/2) (a = included angle): 4 t for 60 degree threads, 4.17 t at 55, 7.99 t at 29, 7.73 t at 30. Major and minor diameters change by 2 t. A coated helical insert carries both threads, so the change doubles (8 t at 60 degrees). Coating thickness on threads is seldom uniform (thicker at crests and ends); this is the ideal case used by gauge makers.' +
    '<br><b>From a thread and class:</b> the class limits are worked out as in Thread data (Unified: ASME B1.1 formulas; ISO metric: ISO 965-1 formulas). Two ways to allow for the coating. <b>The coating uses the allowance</b> (external 1A, 2A and ISO e, f, g only): the thread is made to its class before coating, and after coating it may grow up to basic size, checked with a class 3A (inch) or tolerance position h (metric) GO gauge and the class NOT GO gauge; the coating must then be no more than a quarter of the allowance on the pitch diameter. <b>The finished thread meets the class</b>: the class limits are the after-coating limits, and the before-coating limits are moved by the coating: external pitch diameter max less the change at the maximum thickness and min less the change at the minimum thickness, major diameters less 2 t on the same pairing; internal threads the other way (pitch diameter min plus the change at the maximum thickness, max plus at the minimum, and the minor diameter likewise with 2 t). Internal threads have no allowance, so for them this is the only way.' +
    '<br><b>Sources:</b> Thread Check Inc. (4:1 rule and the before-coating limits, worked 1/2-20 example reproduced in the tests), Kato Fastening Systems (4 x thickness, 8 x for inserts); PEM and the Industrial Fasteners Institute (on ASTM F1941) for the allowance used by the coating and the 3A / h GO gauge after coating; PEM for the quarter of the allowance. ASME B1.1-2024 and ISO 965-1 treat coated threads by name; the general angle form is geometry.</div><div class="note" id="csrc"></div>';
  const g = id => $('#' + id, el);
  const uni = () => g('cs').value === 'unified';
  function setClasses() {
    const list = uni() ? UN_CLS : ISO_CLS;
    if (!list.some(c => c[0] === m.cls)) m.cls = uni() ? '2' : '6.3';
    g('cc').innerHTML = t3Opt(list, m.cls);
    g('cdu').textContent = uni() ? 'in' : 'mm'; g('cpu').textContent = uni() ? 'TPI' : 'mm'; g('cpl').textContent = uni() ? 'Threads per inch' : 'Pitch';
    el.querySelectorAll('.ctu').forEach(x => x.textContent = m.src === 'thread' ? (uni() ? 'in' : 'mm') : uLen());
  }
  // External classes with an allowance (fundamental deviation) can take the coating in it.
  const hasAllow = () => uni() ? ['1', '2'].includes(g('cc').value) : ['6.3', '6.2', '6.1', '8.3'].includes(g('cc').value);
  function setPlans() {
    const al = hasAllow();
    if (!al) m.plan = 'meet';
    g('cpln').innerHTML = t3Opt((al ? [['allow', 'The coating uses the allowance (finished up to basic size)']] : []).concat([['meet', 'The finished thread still meets the class']]), m.plan);
  }
  function showSrc() {
    const th = g('cm').value === 'thread';
    el.querySelectorAll('.cth').forEach(x => x.style.display = th ? '' : 'none');
    el.querySelectorAll('.cty').forEach(x => x.style.display = th ? 'none' : '');
  }
  const ids = ['cm', 'cs', 'cd', 'cp', 'cc', 'cpln', 'ca', 'ci', 'ce1', 'ce2', 'ct1', 'ct2'];
  function updThread() {
    const k = W.thread_misc(1, 60, 0), inch = uni(), cls = g('cc').value, out = $('#cres', el);
    // Lengths of this thread are in its own units (in or mm); shown in both.
    const toMm = x => inch ? x * IN_MM : x, U = x => fBoth(toMm(x));
    const d = inch ? parseSize(g('cd').value) : parseFloat(g('cd').value), pin = parseFloat(g('cp').value);
    const p = inch ? 1 / pin : pin;
    const T1 = parseFloat(g('ct1').value), T2r = parseFloat(g('ct2').value), T2 = T2r > 0 ? T2r : T1;
    if (!(d > 0 && p > 0 && p < d)) { out.innerHTML = '<div class="res"><table><tr><td class="warn">Enter the thread size.</td></tr></table></div>'; return; }
    const ext = inch ? +cls < 10 : +cls.split('.')[1] < 10;
    // Class limits: [major max, major min, PD max, PD min, minor min, minor max] (NaN where not toleranced here).
    let L;
    if (inch) {
      const c = +cls, f = w => W.un_limit(d, p, c, w);
      L = ext ? [f(0), f(1), f(2), f(3), NaN, NaN] : [NaN, f(1), f(2), f(3), c === 12 ? W.un_limit(d, p, 12, 6) : NaN, c === 12 ? W.un_limit(d, p, 12, 7) : NaN];
    } else {
      const [gr, pos] = cls.split('.').map(Number), f = w => W.iso965_limit(d, p, gr, pos, w);
      L = ext ? [f(0), f(1), f(2), f(3), NaN, NaN] : [NaN, f(1), f(2), f(3), f(5), f(4)];
    }
    const name = (inch ? fx(d, 4) + ' in x ' + fx(pin, 2) + ' TPI' : 'M' + fx(d, 3) + ' x ' + fx(p, 3)) + ', class ' + (g('cc').selectedOptions[0] || {}).textContent;
    const basicPD = W.thread_basic_pitch_dia(d, p);
    const fin = x => isFinite(x) ? U(x) : '-';
    const rows = [];
    const plan = g('cpln').value;
    rows.push(['<b>Class limits</b> (major max / min, pitch diameter max / min' + (ext ? '' : ', minor min / max') + ')', calcCell(fin(L[0]) + ' / ' + fin(L[1]) + '<br>' + fin(L[2]) + ' / ' + fin(L[3]) + (ext ? '' : '<br>' + fin(L[4]) + ' / ' + fin(L[5])), inch ? 'ASME B1.1 formulas' : 'ISO 965-1 formulas')]);
    if (!(T1 > 0)) {
      rows.push(['', '<td class="ms" colspan="2">Enter the coating thickness per surface.</td>']);
    } else if (plan === 'allow' && ext) {
      const allow = inch ? W.un_limit(d, p, +cls, 5) : (L[2] < basicPD ? basicPD - L[2] : 0);
      const fits = k * T1 <= allow + 1e-9;
      rows.push(['Allowance on the pitch diameter', calcCell(U(allow), inch ? 'ASME B1.1: 0.3 x Td2(2A)' : 'fundamental deviation es')]);
      rows.push(['Largest coating per surface that fits in it', calcCell(U(allow / k), 'a quarter of the allowance')]);
      rows.push(['Before coating: make to the class limits', calcCell(fin(L[2]) + ' / ' + fin(L[3]), 'pitch diameter max / min')]);
      rows.push(['After coating, pitch diameter max / min', calcCell(U(L[2] + k * T1) + ' / ' + U(L[3] + k * T2), 'class limit + 4 t at the max and min thickness')]);
      rows.push(['After coating, major diameter max / min', calcCell(U(L[0] + 2 * T1) + ' / ' + U(L[1] + 2 * T2), 'class limit + 2 t')]);
      rows.push(['Check', fits ? calcCell('Fits: after coating the pitch diameter stays at or under basic (' + U(basicPD) + ')', 'GO gauge ' + (inch ? 'class 3A' : 'position h') + ', NOT GO the class') : '<td class="v"><span class="warn">Too thick for the allowance: the pitch diameter after coating can reach ' + U(L[2] + k * T1) + ', over basic ' + U(basicPD) + '. Use a thinner coating or make the thread smaller: choose "The finished thread still meets the class".</span></td><td></td>']);
    } else if (ext) {
      rows.push(['<b>Before coating, pitch diameter max / min</b>', calcCell('<b>' + U(L[2] - k * T1) + ' / ' + U(L[3] - k * T2) + '</b>', 'max - 4 t max, min - 4 t min')]);
      rows.push(['Before coating, major diameter max / min', calcCell(U(L[0] - 2 * T1) + ' / ' + U(L[1] - 2 * T2), 'less 2 t on the same pairing')]);
      if (L[2] - k * T1 <= L[3] - k * T2) rows.push(['Check', '<td class="v"><span class="warn">No pitch diameter tolerance left before coating: the coating range takes all of it.</span></td><td></td>']);
    } else {
      rows.push(['<b>Before coating, pitch diameter min / max</b>', calcCell('<b>' + U(L[3] + k * T1) + ' / ' + U(L[2] + k * T2) + '</b>', 'min + 4 t max, max + 4 t min')]);
      rows.push(['Before coating, major diameter min', calcCell(U(L[1] + 2 * T1), 'min + 2 t max')]);
      if (isFinite(L[4])) rows.push(['Before coating, minor diameter min / max', calcCell(U(L[4] + 2 * T1) + ' / ' + U(L[5] + 2 * T2), 'min + 2 t max, max + 2 t min')]);
      if (L[3] + k * T1 >= L[2] + k * T2) rows.push(['Check', '<td class="v"><span class="warn">No pitch diameter tolerance left before coating: the coating range takes all of it.</span></td><td></td>']);
    }
    if (T1 > 0 && !(T2r > 0)) rows.push(['', '<td class="ms" colspan="2">No minimum thickness entered: the maximum is used for both.</td>']);
    out.innerHTML = '<div class="res"><div class="h">' + rEsc(name) + '</div><table>' + rowsHtml(rows) + '</table></div>';
  }
  function updTyped() {
    const [a, it, e1, e2, t1, t2] = ['ca', 'ci', 'ce1', 'ce2', 'ct1', 'ct2'].map(i => g(i).value);
    const k = W.thread_misc(1, +a, 0) * (+it === 2 ? 2 : 1), sgn = +it === 1 ? 1 : -1;
    const n = x => fromUser(parseFloat(x)), U = x => fBoth(x);
    const rows = [['Pitch diameter change per unit thickness', calcCell(fx(k, 4) + ' x t', +it === 2 ? 'insert: twice 2 / sin(a/2)' : '2 / sin(a/2)')]];
    const T1 = n(t1), T2 = n(t2), E1 = n(e1), E2 = n(e2);
    if (T1 > 0) rows.push(['Pitch diameter change at max thickness', calcCell(U(k * T1))], ['Major / minor diameter change at max thickness', calcCell(U(2 * T1 * (+it === 2 ? 2 : 1)))]);
    if (T2 > 0) rows.push(['Pitch diameter change at min thickness', calcCell(U(k * T2))]);
    if (E1 > 0 && T1 > 0 && +it !== 2) rows.push(['Before-coating pitch diameter, max', calcCell(U(E1 + sgn * k * (+it === 1 ? T2 || T1 : T1)), +it === 1 ? 'max + PD change at min thickness' : 'max - PD change at max thickness')]);
    if (E2 > 0 && (T2 > 0 || T1 > 0) && +it !== 2) rows.push(['Before-coating pitch diameter, min', calcCell(U(E2 + sgn * k * (+it === 1 ? T1 : T2 || T1)), +it === 1 ? 'min + PD change at max thickness' : 'min - PD change at min thickness')]);
    if (rows.length === 1) rows.push(['', '<td class="ms" colspan="2">Enter the coating thickness (and the finished limits for before-coating sizes).</td>']);
    $('#cres', el).innerHTML = '<div class="res"><table>' + rowsHtml(rows) + '</table></div>';
  }
  function upd(e) {
    if (e && e.target && e.target.id === 'cs') { m.sys = g('cs').value; setClasses(); }
    if (e && e.target && (e.target.id === 'cs' || e.target.id === 'cc')) { m.cls = g('cc').value; setPlans(); }
    Object.assign(m, { src: g('cm').value, sys: g('cs').value, d: g('cd').value, p: g('cp').value, cls: g('cc').value, plan: g('cpln').value,
      ang: +g('ca').value, int: +g('ci').value, e1: g('ce1').value, e2: g('ce2').value, t1: g('ct1').value, t2: g('ct2').value });
    showSrc(); setClasses();
    if (m.src === 'thread') updThread(); else updTyped();
  }
  $('#csrc', el).innerHTML = '<b>Sources</b><br>' + sourceList(Object.fromEntries(['TC_PLATE', 'KATO_PLATE', 'PEM_TI', 'IFI_F1941'].filter(k => A.sources[k]).map(k => [k, A.sources[k]])));
  setClasses(); setPlans();
  ids.forEach(i => { const x = g(i); x.oninput = upd; x.onchange = upd; });
  upd();
}

// ------------------------------------------------------------------ buttress 7/45
async function renderButtress(el) {
  const R = await loadRef(el); if (!R) return;
  const W = state.W, A = R.power_threads, m = RMEM.butt || (RMEM.butt = { d: 2, tpi: 8 });
  el.innerHTML = '<div class="grid" style="max-width:760px">' + t3Num('bd', 'Nominal (major) diameter D', 'in', m.d) + t3Num('bt', 'Threads per inch', 'TPI', m.tpi) + '</div><div id="bres"></div>' +
    '<div class="note"><b>Working (ASME B1.9, 7/45 buttress, inch):</b> load flank 7 degrees and clearance flank 45 degrees from the perpendicular to the axis; basic height of engagement h = 0.6 P. Sharp-vee height H = P / (tan 7 + tan 45) = 0.89064 P; crest truncation f = (H - h) / 2 = 0.14532 P, crest flat 0.16316 P; root radius r = 0.07141 P (minimum 0.0357 P), root truncation s = 0.08261 P (flat root alternative 0.0928 P); thread height hs = hn = 0.66271 P. Values at maximum material, without allowance: pitch diameter D - 0.6 P, screw minor D - 1.32542 P, nut major D + 0.12542 P, nut minor D - 1.2 P. The screw is made smaller by the allowance G of its class, and every diameter has a class tolerance; those come from the standard\'s tables and are not computed here. The thread carries load in one direction only (towards the 7 degree flank). The British (BS 1657) and DIN 513 / ISO metric buttress forms differ and are not included.' +
    '<br><b>Sources:</b> ASME B1.9-1973 (R2025), cited by name; constants as printed by AMESweb, each derived again from the geometry in core/src/power_threads.rs.</div><div class="note" id="bsrc"></div>';
  const bd = $('#bd', el), bt = $('#bt', el);
  function upd() {
    const d = parseFloat(bd.value), tpi = parseFloat(bt.value); if (d > 0) m.d = d; if (tpi > 0) m.tpi = tpi;
    const out = $('#bres', el);
    if (!(d > 0 && tpi > 0 && 1 / tpi < d / 2)) { out.innerHTML = '<div class="res"><table><tr><td class="warn">Enter the thread size.</td></tr></table></div>'; return; }
    const p = 1 / tpi, v = w => W.buttress_value(d, p, w), L = x => fBoth(x * IN_MM);
    out.innerHTML = '<div class="res"><div class="h">' + fx(d, 4) + '"-' + tpi + ' buttress (7/45)</div><table>' + rowsHtml([
      ['Pitch P', calcCell(L(p), '1 / TPI')],
      ['Sharp-vee height H', calcCell(L(v(0)), '0.89064 P')],
      ['Height of engagement h', calcCell(L(v(1)), '0.6 P')],
      ['Thread height hs = hn', calcCell(L(v(6)), '0.66271 P')],
      ['Crest truncation f / crest flat F', calcCell(L(v(4)) + ' / ' + L(v(5)), '0.14532 P / 0.16316 P')],
      ['Root radius r / root truncation s', calcCell(L(v(2)) + ' / ' + L(v(3)), '0.07141 P / 0.08261 P')],
      ['Pitch diameter (basic)', calcCell(L(v(8)), 'D - 0.6 P')],
      ['Screw minor diameter (basic, no allowance)', calcCell(L(v(9)), 'D - 1.32542 P')],
      ['Nut major diameter (minimum)', calcCell(L(v(7)), 'D + 0.12542 P')],
      ['Nut minor diameter (minimum)', calcCell(L(v(10)), 'D - 1.2 P')],
      ['Lead angle at the pitch diameter', calcCell(fx(W.thread_misc(p, v(8), 2), 3) + ' deg')],
    ]) + '</table></div>';
  }
  $('#bsrc', el).innerHTML = '<b>Sources</b><br>' + sourceList(Object.fromEntries(['AMES_BUTT'].filter(k => A.sources[k]).map(k => [k, A.sources[k]])));
  [bd, bt].forEach(x => x.oninput = upd);
  upd();
}

// ------------------------------------------------------------------ UNM miniature
async function renderUnm(el) {
  const R = await loadRef(el); if (!R) return;
  const W = state.W, A = R.power_threads, m = RMEM.unm || (RMEM.unm = { size: '1.00' });
  const rows = A.unm || [];
  el.innerHTML = '<div class="grid" style="max-width:760px">' + t3Sel('nz', 'Size', rows.map(r => '<option value="' + rEsc(r.size) + '"' + (r.size === m.size ? ' selected' : '') + '>' + rEsc(r.size) + ' UNM</option>').join('')) + '</div><div id="nres"></div>' +
    '<div class="note"><b>Working (ASME B1.10M):</b> sizes 0.30 to 1.40 mm, designated in mm (for example 0.80 UNM). 60 degree form with a basic thread height of 0.48 P (UN: 0.541266 P). Pitch diameter D - 0.649519 P; external design minor D - 1.1451814 P (height 0.5725907 P, root radius 0.1851815 P); internal minor D - 0.96 P; internal design major D + 0.0721688 P (root radius 0.0721688 P). The limits of size below are as one publisher prints them; the basic and design diameters are checked against both.' +
    '<br><b>Sources:</b> ASME B1.10M-2004 (cited by name); publishers below.</div><div class="note" id="nsrc"></div>';
  const nz = $('#nz', el);
  function upd() {
    m.size = nz.value;
    const r = rows.find(x => x.size === m.size) || rows[0]; if (!r) return;
    const d = +r.size, p = +r.p.value, v = w => W.unm_value(d, p, w);
    const chk = (f, w) => r[f] ? pubCell(A.sources, r[f], x => fBoth(+x) + (Math.abs(+x - v(w)) < 6e-4 ? ' <span class="ms">= formula</span>' : ' <span class="warn">formula ' + fx(v(w), 3) + ' mm</span>')) : calcCell(fBoth(v(w)));
    const pub = f => r[f] ? pubCell(A.sources, r[f], x => fBoth(+x)) : calcCell('-', 'not printed');
    $('#nres', el).innerHTML = '<div class="res"><div class="h">' + rEsc(r.size) + ' UNM</div><table>' + rowsHtml([
      ['Pitch P', pubCell(A.sources, r.p, x => fBoth(+x) + ' <span class="ms">' + fx(25.4 / +x, 1) + ' TPI</span>')],
      ['Basic thread height 0.48 P', calcCell(fBoth(v(4)))],
      ['Pitch diameter (basic)', chk('d2', 0)],
      ['External minor diameter (design, max)', chk('ext_minor', 1)],
      ['Internal minor diameter (min)', chk('int_minor', 2)],
      ['Internal major diameter (design, min)', chk('int_major', 3)],
      ['Root radius external / internal', calcCell(fBoth(v(5)) + ' / ' + fBoth(v(6)))],
      ['External major diameter, min', pub('ext_major_min')],
      ['External pitch diameter, min', pub('ext_pd_min')],
      ['External minor diameter, min', pub('ext_minor_min')],
      ['Internal minor diameter, max', pub('int_minor_max')],
      ['Internal pitch diameter, max', pub('int_pd_max')],
      ['Internal major diameter, max', pub('int_major_max')],
    ]) + '</table></div>';
  }
  $('#nsrc', el).innerHTML = '<b>Sources</b><br>' + sourceList(Object.fromEntries(['TC_UNM', 'AMES_UNM'].map(k => [k, A.sources[k]])));
  nz.onchange = upd;
  upd();
}

// ------------------------------------------------------------------ constant-pitch UN series and UNS
async function renderUnSeries(el) {
  const R = await loadRef(el); if (!R) return;
  const W = state.W, A = R.power_threads, m = RMEM.unser || (RMEM.unser = { s: '8UN' });
  const C = A.un_const || {}, same = (A.notes || {}).un_const_same || {};
  el.innerHTML = '<div class="grid" style="max-width:760px">' + t3Sel('us', 'Series', t3Opt([['8UN', '8-UN (8 threads per inch)'], ['12UN', '12-UN (12 threads per inch)'], ['16UN', '16-UN (16 threads per inch)']], m.s)) + '</div><div id="ures"></div>' +
    '<div class="note"><b>Working:</b> the constant-pitch UN series keep one pitch over a range of diameters (8-UN, 12-UN and 16-UN are the commonest; ASME B1.1 also has 4, 6, 20, 28 and 32-UN). The form and the tolerance formulas are those of UNC/UNF, so the limits for any size here come from the Thread data and limits tool (choose Other and enter the diameter and pitch, Unified inch). Where the series pitch is the same as the coarse or fine pitch of a size, that size is designated UNC or UNF, not UN. ' +
    'UNS (special) threads are diameter and pitch combinations outside the standard series; the same Unified form and tolerance formulas apply, and they are designated with UNS (for example 1.250-14 UNS-2A). The table lists sizes up to 2 in as two publishers print them; above 2 in the series continue in the standard.' +
    '<br><b>Sources:</b> ASME B1.1-2024 (cited by name); series lists from the publishers below.</div><div class="note" id="usrc"></div>';
  const us = $('#us', el);
  function upd() {
    m.s = us.value;
    const rows = Object.keys(C).filter(k => k.startsWith(m.s + ' ')).map(k => [k.slice(m.s.length + 1), C[k]]).sort((a, b) => t3Frac(a[0]) - t3Frac(b[0]));
    const tpi = parseInt(m.s), p = 1 / tpi, L = x => fBoth(x * IN_MM);
    $('#ures', el).innerHTML = '<div class="res mtab"><table><tr><th>Size</th><th>Designation</th><th>Pitch diameter</th><th>Basic minor</th><th>Evidence</th></tr>' + rows.map(([z, c]) => {
      const d = t3Frac(z), g = (R.threads.unified || []).find(t => Math.abs(t.d - d) < 1e-6 && +t.tpi === tpi), sm = g ? g.series : same[m.s + ' ' + z];
      return '<tr><td><b>' + rEsc(z) + '"</b></td><td>' + rEsc(z + '-' + tpi + ' ' + (sm || 'UN')) + '</td><td class="v">' + L(W.thread_basic_pitch_dia(d, p)) + '</td><td class="v">' + L(W.thread_basic_minor_dia(d, p)) + '</td><td title="' + rEsc(groupsTitle(A.sources, c.groups)) + '">' + badge(c.status) + ' <span class="ms">' + c.groups[0].publishers.map(x => rEsc(pubName(A.sources, x))).join(', ') + '</span></td></tr>';
    }).join('') + '</table></div>';
  }
  $('#usrc', el).innerHTML = '<b>Sources</b><br>' + sourceList(Object.fromEntries(['AMES_UN', 'TORQ_UN'].filter(k => A.sources[k]).map(k => [k, A.sources[k]])));
  us.onchange = upd;
  upd();
}

// ------------------------------------------------------------------ thread identifier
// Every standard thread in the tables as { label, std, d, p, tpi, minor, go }: d = basic major diameter and
// p = pitch in mm, minor = basic minor diameter of the nut in mm (NaN where the core has no rule for it),
// go = [tool id, RMEM key, values], so a click opens that thread in its own tool.
function tidCandidates(R, W) {
  const T = R.threads, O = R.other_threads, A = R.power_threads, out = [];
  const v60 = (d, p) => W.thread_basic_minor_dia(d, p), v55 = (d, p) => W.whitworth_value(d, p, 1);
  T.metric.forEach(t => out.push({ label: 'M' + t.d + ' x ' + t.p, std: 'ISO metric, ' + t.series, d: t.d, p: t.p, minor: v60(t.d, t.p),
    go: ['threaddata', 'thd', { key: 'M' + t.d + 'x' + t.p, d: t.d, p: t.p, sys: 'metric' }] }));
  T.unified.forEach(t => {
    const d = t.d * IN_MM, p = W.pitch_tpi(t.tpi);
    out.push({ label: t.size + '-' + t.tpi + ' ' + t.series, std: 'Unified inch', d, p, tpi: t.tpi, minor: v60(d, p), go: ['threaddata', 'thd', { key: t.size + '-' + t.tpi + ' ' + t.series, d, p, sys: 'unified' }] });
  });
  Object.keys(A.un_const || {}).forEach(k => {
    const i = k.indexOf(' '), s = k.slice(0, i), z = k.slice(i + 1), tpi = parseInt(s), din = t3Frac(z);
    if (!(tpi > 0 && din > 0) || T.unified.some(t => Math.abs(t.d - din) < 1e-6 && +t.tpi === tpi)) return;
    const d = din * IN_MM, p = W.pitch_tpi(tpi);
    out.push({ label: z + '-' + tpi + ' UN', std: 'Unified constant pitch', d, p, tpi, minor: v60(d, p), go: ['unseries', 'unser', { s }] });
  });
  ['bsw', 'bsf'].forEach(k => (O[k] || []).forEach(r => {
    const d = t3Frac(r.size) * IN_MM, tpi = +r.tpi.value, p = W.pitch_tpi(tpi);
    out.push({ label: r.size + '" ' + k.toUpperCase(), std: 'Whitworth, 55° (BS 84)', d, p, tpi, minor: v55(d, p), go: ['whitworth', 'whit', { sys: k, size: r.size }] });
  }));
  (O.bsp || []).forEach(r => {
    if (!r.major_mm) return;
    const d = r.major_mm.value, tpi = +r.tpi.value, p = W.pitch_tpi(tpi);
    out.push({ label: 'G ' + r.size + ' / R ' + r.size, std: 'BSP pipe, 55° (R is tapered)', d, p, tpi, minor: v55(d, p), go: ['pipethreads', 'pipe', { sys: 'bsp', size: r.size }] });
  });
  (O.npt || []).forEach(r => {
    const d = r.od.value * IN_MM, tpi = +r.tpi.value;
    out.push({ label: r.size + ' NPT', std: 'NPT pipe, 60°, tapered', d, p: W.pitch_tpi(tpi), tpi, minor: NaN, go: ['pipethreads', 'pipe', { sys: 'npt', size: r.size }] });
  });
  (O.ba || []).forEach(r => {
    const n = +r.size;
    out.push({ label: r.size + ' BA', std: 'BA, 47.5° (BS 93)', d: W.round_sig(W.ba_value(n, 1), 2), p: W.round_sig(W.ba_value(n, 0), 2), minor: NaN, go: ['whitworth', 'whit', { sys: 'ba', size: r.size }] });
  });
  [['acme', 'ACME', 'gp'], ['stub_acme', 'Stub ACME', 'stub']].forEach(([k, name, form]) => (A[k] || []).forEach(r => {
    const din = t3Frac(r.size), tpi = +r.tpi.value;
    const minor = (form === 'stub' ? W.stub_acme_limit(din, 1 / tpi, 1, 5) : W.acme_limit(din, 1 / tpi, 2, 1, 5)) * IN_MM;
    out.push({ label: r.size + '"-' + tpi + ' ' + name, std: name + ', 29°', d: din * IN_MM, p: W.pitch_tpi(tpi), tpi, minor, go: ['acme', 'acme', { form, size: r.size, cls: 2, starts: 1, d: din, tpi }] });
  }));
  (A.trap || []).forEach(r => {
    const d = parseFloat(r.size), p = +r.p.value;
    out.push({ label: 'Tr ' + d + ' x ' + p, std: 'Metric trapezoidal, 30°', d, p, minor: W.trap_value(d, p, 2), go: ['trapezoidal', 'trap', { size: r.size, d, p, starts: 1 }] });
  });
  (A.unm || []).forEach(r => {
    const d = +r.size, p = +r.p.value;
    out.push({ label: r.size + ' UNM', std: 'Unified miniature', d, p, minor: v60(d, p), go: ['unm', 'unm', { size: r.size }] });
  });
  return out.filter(c => c.d > 0 && c.p > 0);
}

async function renderThreadId(el) {
  const R = await loadRef(el); if (!R) return;
  const W = state.W, cands = tidCandidates(R, W);
  const m = RMEM.tid || (RMEM.tid = inMode() ? { d: 0.245 * IN_MM, pv: 20, pu: 'tpi', bore: 0 } : { d: 9.85, pv: 1.5, pu: 'mm', bore: 0 });
  el.innerHTML = '<div class="grid" style="max-width:760px">' +
    '<div class="f"><span>Measured on</span><div class="row"><div class="seg" id="ib"><button type="button" data-v="0">Screw</button><button type="button" data-v="1">Nut or hole</button></div></div></div>' +
    '<label class="f"><span id="idl"></span><div class="row"><input id="idv" type="number" step="any" min="0"><span class="u">' + uLen() + '</span></div></label>' +
    '<label class="f"><span>Pitch, from a thread pitch gauge</span><div class="row"><input id="ipv" type="number" step="any" min="0"><select id="ipu" aria-label="Pitch unit" style="flex:0 0 auto;width:auto"><option value="mm">mm</option><option value="tpi">threads per inch</option></select></div></label>' +
    '</div><div id="ires"></div>' +
    '<div class="note"><b>How to measure:</b> on a screw, measure across the thread crests with a caliper or micrometer. On a nut or tapped hole, measure the bore across the crests with the inside jaws. Read the pitch with a thread pitch gauge, or count the crests along 1 in (25.4 mm) for threads per inch. ' +
    'A screw normally measures a little under its nominal size and a tapped hole a little over its basic minor diameter, because of the allowance and tolerances (the Thread data and limits tool gives the limits), so a small minus on a screw or a small plus on a bore is what a good match looks like. ' +
    'Tapered pipe threads (NPT, R) change diameter along their length: measure near the middle of the thread. A diameter and a pitch cannot tell a 55° thread from a 60° one of nearly the same size (for example G 1/8 and 1/8 NPT, or 1/2 in BSW and 1/2-13 UNC at 12 and 13 threads per inch): check the flanks with the gauge leaf against the light, or try a known nut or screw. Worn, damaged, plated or special threads may not match anything here.' +
    '<br><b>Working:</b> pitch in mm = 25.4 / threads per inch. Every standard thread in BenchMate\'s tables is compared with the reading. Diameter difference = measured diameter minus that thread\'s basic major diameter (screw) or basic minor diameter (bore: D - 1.082532 P for 60° threads, D - 1.280654 P for Whitworth and BSP, D - P for ACME and trapezoidal, D - 0.6 P for Stub ACME). Pitch difference = (measured pitch - its pitch) / its pitch. A thread is listed when the pitch is within 6 % and the diameter within 6 % (never less than 0.3 mm). The list is ordered by score = &radic;((pitch difference / 2 %)&sup2; + (diameter difference / (2 % of the diameter + 0.05 mm))&sup2;); a score of 1 or less is called close. ' +
    'This search rule is BenchMate\'s own way of ordering the table. It is not taken from a standard and it does not prove what a thread is.' +
    '<br><b>Sources:</b> the sizes, pitches and basic diameters are the ones in the thread tools (Thread data and limits, Pipe threads, Whitworth and BA, ACME, Trapezoidal, Constant-pitch UN, UNM), with the standards and publishers cited there. For bores, BA and NPT are not searched.</div>';
  const ib = $('#ib', el), idv = $('#idv', el), ipv = $('#ipv', el), ipu = $('#ipu', el), out = $('#ires', el);
  const sg = (v, dp) => { const r = +v.toFixed(dp); return (r > 0 ? '+' : '') + r.toFixed(dp); };
  const pitchCell = c => c.tpi ? '<span class="mv">' + tpiText(c.tpi) + '</span> <span class="ms">' + fx(c.p, 4) + ' mm</span>' : '<span class="mv">' + (+c.p.toFixed(4)) + ' mm</span> <span class="ms">' + fx(W.pitch_tpi(c.p), 2) + ' TPI</span>';
  let shown = [];
  function setInputs() {
    ib.querySelectorAll('button').forEach(b => { const on = +b.dataset.v === +m.bore; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    $('#idl', el).textContent = m.bore ? 'Bore diameter, across the crests' : 'Outside diameter, across the crests';
    idv.value = +toUser(m.d).toFixed(inMode() ? 4 : 3); ipv.value = +(+m.pv).toFixed(4); ipu.value = m.pu;
  }
  function upd() {
    const dv = parseFloat(idv.value), pv = parseFloat(ipv.value);
    shown = [];
    if (!(dv > 0 && pv > 0)) { out.innerHTML = '<div class="res"><table><tr><td class="warn">Enter the measured diameter and pitch.</td></tr></table></div>'; return; }
    m.d = fromUser(dv); m.pv = pv;
    const dM = m.d, pM = m.pu === 'tpi' ? W.pitch_tpi(pv) : pv, rows = [];
    cands.forEach(c => {
      const ref = m.bore ? c.minor : c.d; if (!(ref > 0)) return;
      const s = W.thread_match(dM, pM, ref, c.p, 2);
      if (isFinite(s)) rows.push({ c, ref, s, dd: W.thread_match(dM, pM, ref, c.p, 0), dp: W.thread_match(dM, pM, ref, c.p, 1) });
    });
    rows.sort((a, b) => a.s - b.s || a.c.label.localeCompare(b.c.label));
    const head = '<div class="res mtab"><div class="h">Reading: ' + (m.bore ? 'bore ' : 'outside ') + fLen(dM) + ' ' + uLen() + ', pitch ' + (+pM.toFixed(4)) + ' mm (' + fx(W.pitch_tpi(pM), 2) + ' threads per inch)</div>';
    if (!rows.length) { out.innerHTML = head + '<table><tr><td class="warn">No standard thread in the tables is within 6 % on both pitch and diameter. Check the readings and the pitch unit. It may be a special thread.</td></tr></table></div>'; return; }
    shown = rows.slice(0, 12);
    const close = rows.filter(r => r.s <= 1).length;
    const fit = (r, i) => r.s <= 1 ? '<span class="badge confirmed">' + (i === 0 ? 'Closest' : 'Close') + '</span>' : i === 0 ? '<span class="badge review">Nearest</span>' : '<span class="ms">possible</span>';
    out.innerHTML = head + '<table><tr><th>Thread</th><th>Fit</th><th>Standard</th><th>Pitch</th><th>' + (m.bore ? 'Basic minor Ø (nut)' : 'Basic major Ø') + '</th><th>Your Ø minus basic</th><th>Your pitch against its pitch</th></tr>' +
      shown.map((r, i) => '<tr><td style="white-space:nowrap"><a href="#/t/' + r.c.go[0] + '" data-i="' + i + '" title="Open this thread"><b>' + rEsc(r.c.label) + '</b></a></td><td>' + fit(r, i) + '</td><td>' + rEsc(r.c.std) + '</td><td class="v">' + pitchCell(r.c) + '</td><td class="v">' + fBoth(r.ref) + '</td>' +
        '<td class="v"><span class="mv">' + sg(toUser(r.dd), inMode() ? 4 : 3) + ' ' + uLen() + '</span></td><td class="v"><span class="mv">' + sg(r.dp * 100, 1) + ' %</span></td></tr>').join('') + '</table></div>' +
      (close > 1 ? '<div class="note warn">More than one thread is a close fit. Check the flank angle with the gauge, measure the diameter again with a micrometer, or try a known nut or screw.</div>' : '') +
      (close === 0 ? '<div class="note warn">Nothing is a close fit. The nearest threads are listed, but check the readings and the pitch unit first.</div>' : '') +
      (rows.length > shown.length ? '<div class="note">' + (rows.length - shown.length) + ' more candidates further away are not shown.</div>' : '');
  }
  out.addEventListener('click', e => {
    const a = e.target.closest('a[data-i]'), r = a && shown[+a.dataset.i]; if (!r) return;
    const [, key, vals] = r.c.go;
    RMEM[key] = Object.assign(RMEM[key] || {}, vals, key === 'thd' ? { int: +m.bore } : {});
  });
  ib.querySelectorAll('button').forEach(b => b.onclick = () => { m.bore = +b.dataset.v; setInputs(); upd(); });
  ipu.onchange = () => { const pv = parseFloat(ipv.value); m.pu = ipu.value; if (pv > 0) { m.pv = +W.pitch_tpi(pv).toFixed(4); ipv.value = m.pv; } upd(); };
  idv.oninput = upd; ipv.oninput = upd;
  setInputs(); upd();
}
