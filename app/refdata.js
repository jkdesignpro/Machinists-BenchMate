'use strict';
// Reference data tools: drill chart, tap drills, thread data, ISO limits and fits.
// Data (what each publisher prints, with consensus) comes from data/refdata.json,
// built by scripts/build_refdata.py from data/refdata/*-evidence.json.
// Every calculation is done by the Rust core (state.W); JS converts units,
// looks up table rows and draws.

let REF = null;
async function loadRef(el) {
  if (REF) return REF;
  try { REF = await (await fetch('data/refdata.json')).json(); } catch (e) { el.textContent = 'Reference data not found (run scripts/build-web.sh).'; return null; }
  return REF;
}
const rEsc = x => String(x ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const RSTATUS = { confirmed: ['confirmed', 'Confirmed'], confirmed_with_outlier: ['differs', 'One source differs'], differs: ['differs', 'Sources differ'], review: ['review', 'One source'], listed: ['review', 'One source'], exact: ['confirmed', 'Exact'] };
const badge = s => { const b = RSTATUS[s] || ['review', s]; return '<span class="badge ' + b[0] + '">' + b[1] + '</span>'; };
const pubName = (srcs, k) => (srcs[k] || {}).publisher || k;
// Shared per-tool input memory (values kept in mm so the unit toggle does not lose them).
const RMEM = {};
const inMode = () => state.sys === 'inch';
const toUser = mm => inMode() ? mm / IN_MM : mm;
const fromUser = v => inMode() ? v * IN_MM : v;
const uLen = () => inMode() ? 'in' : 'mm';
const fx = (v, dp) => (isFinite(v) ? v.toFixed(dp) : 'n/a');
const fLen = mm => inMode() ? fx(mm / IN_MM, 4) : fx(mm, 3);
const fBoth = mm => '<span class="mv">' + fLen(mm) + ' ' + uLen() + '</span> <span class="ms">' + (inMode() ? fx(mm, 3) + ' mm' : fx(mm / IN_MM, 4) + ' in') + '</span>';

function groupsTitle(srcs, groups) {
  return groups.map(g => g.value + ': ' + g.publishers.map(p => pubName(srcs, p)).join(', ')).join(' | ');
}
function sourceList(srcs) {
  return Object.values(srcs).map(s => '<b>' + rEsc(s.publisher) + '</b>: ' + rEsc(s.title) + (s.url ? ' (' + rEsc(s.url) + ')' : '') + ', accessed ' + rEsc(s.accessed) + (s.note ? '. <i>' + rEsc(s.note) + '</i>' : '')).join('<br>');
}

// ------------------------------------------------------------------ drill chart
function drillLabel(d) { return d.kind === 'number' ? 'Number ' + d.name : d.kind === 'letter' ? 'Letter ' + d.name : d.kind === 'fraction' ? 'Fractional ' + d.name : 'Metric ' + d.name; }

async function renderDrillChart(el) {
  const R = await loadRef(el); if (!R) return;
  const D = R.drills, m = RMEM.drill || (RMEM.drill = { q: '', kind: '', target: '' });
  el.innerHTML = '<div class="mfilter"><input id="dq" type="search" placeholder="Search: #7, F, 13/64, 6.8 ..." style="width:260px">' +
    '<select id="dk"><option value="">All series</option><option value="fraction">Fractional</option><option value="number">Number</option><option value="letter">Letter</option><option value="metric">Metric</option></select></div>' +
    '<div class="grid" style="max-width:760px"><label class="f"><span>Nearest drill to a target size</span><div class="row"><input id="dt" type="number" step="any" inputmode="decimal"><span class="u">' + uLen() + '</span></div></label></div>' +
    '<div id="dn"></div><div id="dres"></div><div class="note" id="dsrc"></div>';
  const q = $('#dq', el), k = $('#dk', el), t = $('#dt', el);
  q.value = m.q; k.value = m.kind; const t0 = m.target === '' ? '' : String(+toUser(m.target).toFixed(inMode() ? 4 : 3)); t.value = t0;
  function nearest() {
    const v = parseFloat(t.value), out = $('#dn', el);
    if (!(v > 0)) { out.innerHTML = ''; m.target = ''; return; }
    const mm = t.value === t0 ? m.target : fromUser(v); m.target = mm;
    const list = D.drills.filter(d => !k.value || d.kind === k.value).map(d => ({ d, diff: d.inch * IN_MM - mm })).sort((a, b) => Math.abs(a.diff) - Math.abs(b.diff)).slice(0, 8).sort((a, b) => a.diff - b.diff);
    out.innerHTML = '<div class="res" style="margin-bottom:12px"><div class="h">Nearest drills to ' + fBoth(mm) + '</div><table>' + list.map(({ d, diff }) =>
      '<tr><td>' + rEsc(drillLabel(d)) + ' ' + badge(d.status) + '</td><td class="v">' + fBoth(d.inch * IN_MM) + '</td><td class="v">' + (diff >= 0 ? '+' : '') + (inMode() ? fx(diff / IN_MM, 4) : fx(diff, 3)) + '</td><td class="u">' + uLen() + '</td></tr>').join('') + '</table></div>';
  }
  function draw() {
    m.q = q.value; m.kind = k.value;
    const s = q.value.trim().toLowerCase().replace(/^#/, '').replace(/"/g, '');
    const rows = D.drills.filter(d => (!k.value || d.kind === k.value) && (!s || d.name.toLowerCase().replace(/[#"]/g, '').replace(' mm', '') === s || d.name.toLowerCase().includes(s) || String(+d.inch.toFixed(4)).includes(s) || String(+(d.inch * IN_MM).toFixed(3)).includes(s)));
    $('#dres', el).innerHTML = '<div class="res mtab"><table><tr><th>Size</th><th>Series</th><th>Decimal inch</th><th>mm</th><th>Evidence</th></tr>' + rows.map(d =>
      '<tr><td><b>' + rEsc(d.name) + '</b></td><td>' + rEsc(d.kind === 'number' ? 'Number (wire gauge)' : d.kind === 'letter' ? 'Letter' : d.kind === 'fraction' ? 'Fractional' : 'Metric') + '</td><td class="mv">' + fx(d.inch, 4) + '</td><td class="mv">' + fx(d.inch * IN_MM, 3) + '</td><td title="' + rEsc(groupsTitle(D.sources, d.groups)) + '">' + badge(d.status) +
      (d.groups.length > 1 ? '<div class="ms">' + d.groups.slice(1).map(g => rEsc(g.printed[0]) + ' printed by ' + g.publishers.map(p => rEsc(pubName(D.sources, p))).join(', ')).join('; ') + '</div>' : '') +
      (d.kind === 'number' || d.kind === 'letter' ? '<div class="ms">' + d.groups[0].publishers.length + ' publisher' + (d.groups[0].publishers.length > 1 ? 's' : '') + '</div>' : '') + '</td></tr>').join('') + '</table></div>' +
      '<p class="desc">' + rows.length + ' of ' + D.drills.length + ' sizes. Number and letter sizes are not given by a formula; their decimal sizes are what the publishers below print (Confirmed = two or more agree). Fractional sizes are exact (n/64 in). Metric sizes are exact by name; the list is the sizes one supplier stocks (a second list is still to be added). mm values are inch x 25.4.</p>';
  }
  q.oninput = () => { draw(); }; k.onchange = () => { draw(); nearest(); }; t.oninput = nearest;
  $('#dsrc', el).innerHTML = '<b>Sources</b><br>' + sourceList(D.sources);
  draw(); nearest();
}

// ------------------------------------------------------------------ thread pickers
function threadOptions(R) {
  const T = R.threads, opts = [];
  T.metric.forEach(t => opts.push({ key: 'M' + t.d + 'x' + t.p, label: 'M' + t.d + ' x ' + t.p + (t.series === 'coarse' ? ' (coarse)' : ' (fine)'), sys: 'metric', d: t.d, p: t.p, status: t.status, pubs: t.publishers }));
  T.unified.forEach(t => opts.push({ key: t.size + '-' + t.tpi + ' ' + t.series, label: t.size + '-' + t.tpi + ' ' + t.series, sys: 'unified', d: t.d * IN_MM, p: IN_MM / t.tpi, tpi: t.tpi, din: t.d, status: t.status, pubs: t.publishers }));
  return opts;
}
function threadSelect(opts, cur) {
  const g = s => opts.filter(o => o.sys === s).map(o => '<option value="' + rEsc(o.key) + '"' + (o.key === cur ? ' selected' : '') + '>' + rEsc(o.label) + '</option>').join('');
  return '<option value="custom"' + (cur === 'custom' ? ' selected' : '') + '>Other: enter major diameter and pitch</option><optgroup label="ISO metric (ISO 261 / ISO 262)">' + g('metric') + '</optgroup><optgroup label="Unified inch (ASME B1.1)">' + g('unified') + '</optgroup>';
}

// ------------------------------------------------------------------ tap drills
async function renderTapDrill(el) {
  const R = await loadRef(el); if (!R) return;
  const W = state.W, opts = threadOptions(R);
  const m = RMEM.tap || (RMEM.tap = { key: 'M10x1.5', type: 'cut', pct: '', d: 10, p: 1.5 });
  el.innerHTML = '<div class="grid" style="max-width:760px">' +
    '<label class="f"><span>Thread</span><div class="row"><select id="tk">' + threadSelect(opts, m.key) + '</select></div></label>' +
    '<label class="f"><span>Tap type</span><div class="row"><select id="tt"><option value="cut">Cutting tap</option><option value="form">Forming (roll) tap</option></select></div></label>' +
    '<label class="f"><span>Percent of thread (blank = 75 cut, 65 form)</span><div class="row"><input id="tp" type="number" step="any"><span class="u">%</span></div></label>' +
    '<label class="f cust"><span>Major diameter</span><div class="row"><input id="td" type="number" step="any"><span class="u">' + uLen() + '</span></div></label>' +
    '<label class="f cust"><span>Pitch' + (inMode() ? ' (threads per inch)' : '') + '</span><div class="row"><input id="tpp" type="number" step="any"><span class="u">' + (inMode() ? 'TPI' : 'mm') + '</span></div></label>' +
    '</div><div id="tres"></div><div class="note"><b>Working:</b> Cutting taps: drill = D - 1.299038 P x %/100, the convention behind the inch formula drill = D - 0.01299 x % / TPI (OSG USA tapping guide, 2024) and the metric form D - % x P / 76.98 (FM Carbide). In this convention 100 % is a thread depth of 2 x 0.75 H = 1.299 P on the diameter, deeper than the basic engagement of ISO 68-1 / ASME B1.1 (2 x 5/8 H = 1.0825 P), so a hole at the basic minor diameter is 83.3 %. Forming taps: hole = D - 0.0068 x % x P (inch: D - 0.0068 x % / TPI; metric form D - % x P / 147.06), as published by FM Carbide and Engineers Edge; the formed metal flows inward, so the hole is larger than for a cutting tap. This is a rule of thumb, not a tap maker\'s formula: the forming-tap maker Balax prints hole sizes for 75, 65 and 55 % thread (miniature sizes, 0-80 to 3-48 and M1 to M1.4) that are 0 to 0.0016 in larger than it gives. Use the tap maker\'s recommended hole size for the tap you have. The shop rule of thumb "drill = major minus pitch" is an approximation: it gives 77 % thread with a cutting tap. Nearest drills come from the drill chart; check the hole against the internal thread minor diameter limits and your tap maker\'s chart, especially for forming taps.<br><b>Sources:</b> OSG USA, Tapping Guide vol. 3 (2024), formula and drill tables for 60 to 80 % thread; FM Carbide TechTips "Tapping formulas" (constants 1.299 / 0.68, 76.98 / 147.06); Engineers Edge "Theoretical tapping hole size, cold form threads" (0.0068). Thread geometry ISO 68-1:2023, ASME B1.1-2024.</div>';
  const k = $('#tk', el), tt = $('#tt', el), tp = $('#tp', el), td = $('#td', el), tpp = $('#tpp', el);
  tt.value = m.type; tp.value = m.pct;
  function setCustomFields() {
    const cust = k.value === 'custom';
    el.querySelectorAll('.cust').forEach(x => x.style.display = cust ? '' : 'none');
    td.value = +toUser(m.d).toFixed(inMode() ? 4 : 3);
    tpp.value = inMode() ? +(IN_MM / m.p).toFixed(3) : +m.p.toFixed(4);
  }
  function upd() {
    m.key = k.value; m.type = tt.value; m.pct = tp.value;
    let d, p, sel = opts.find(o => o.key === k.value);
    if (sel) { d = sel.d; p = sel.p; m.d = d; m.p = p; }
    else { d = fromUser(parseFloat(td.value)); const pv = parseFloat(tpp.value); p = inMode() ? IN_MM / pv : pv; if (d > 0 && p > 0) { m.d = d; m.p = p; } }
    const out = $('#tres', el);
    if (!(d > 0 && p > 0 && p < d)) { out.innerHTML = '<div class="res"><table><tr><td class="warn">Enter the thread size.</td></tr></table></div>'; return; }
    const form = tt.value === 'form';
    const pct = tp.value === '' ? (form ? 65 : 75) : parseFloat(tp.value);
    const drill = form ? W.tap_drill_form(d, p, pct) : W.tap_drill_cut(d, p, pct);
    const pctOf = h => form ? W.tap_pct_form(d, p, h) : W.tap_pct_cut(d, p, h);
    const d1 = W.thread_basic_minor_dia(d, p);
    const pctTxt = h => { const v = pctOf(h); return v > 100 ? 'too small for a forming tap (over 100 %)' : '= ' + fx(v, 1) + ' %'; };
    const rows = [
      ['Hole for ' + fx(pct, 0) + ' % thread', fBoth(drill)],
      ['Basic minor diameter of the internal thread (D1)', fBoth(d1) + ' <span class="ms">' + pctTxt(d1) + '</span>'],
      ['Rule of thumb D - P (approximation)', fBoth(d - p) + ' <span class="ms">' + pctTxt(d - p) + '</span>'],
    ];
    const near = R.drills.drills.map(x => ({ x, mm: x.inch * IN_MM })).sort((a, b) => Math.abs(a.mm - drill) - Math.abs(b.mm - drill)).slice(0, 8).sort((a, b) => a.mm - b.mm);
    out.innerHTML = '<div class="res"><div class="h">Results' + (sel ? ' for ' + rEsc(sel.label) + ' ' + badge(sel.status) : '') + '</div><table>' + rows.map(r => '<tr><td>' + r[0] + '</td><td class="v">' + r[1] + '</td></tr>').join('') + '</table></div>' +
      '<div class="res" style="margin-top:12px"><div class="h">Nearest standard drills (' + (form ? 'forming' : 'cutting') + ' tap)</div><table><tr><td class="ms">Drill</td><td class="ms" style="text-align:right">Size</td><td class="ms" style="text-align:right">Thread</td></tr>' + near.map(({ x, mm }) => {
        const pc = pctOf(mm), warn = pc > 100 || pc < 50;
        return '<tr' + (warn ? ' class="over"' : '') + '><td>' + rEsc(drillLabel(x)) + ' ' + badge(x.status) + '</td><td class="v">' + fBoth(mm) + '</td><td class="v">' + fx(pc, 1) + ' %' + (warn ? '<div class="wmsg">' + (pc > 100 ? 'over 100 %: tap will bind or break' : 'under 50 %: weak thread') + '</div>' : '') + '</td></tr>';
      }).join('') + '</table></div>';
  }
  k.onchange = () => { setCustomFields(); upd(); }; tt.onchange = upd; tp.oninput = upd; td.oninput = upd; tpp.oninput = upd;
  setCustomFields(); upd();
}

// ------------------------------------------------------------------ thread data
async function renderThreadData(el) {
  const R = await loadRef(el); if (!R) return;
  const W = state.W, opts = threadOptions(R), T = R.threads;
  const m = RMEM.thd || (RMEM.thd = { key: 'M10x1.5', d: 10, p: 1.5 });
  el.innerHTML = '<div class="grid" style="max-width:760px"><label class="f"><span>Thread</span><div class="row"><select id="hk">' + threadSelect(opts, m.key) + '</select></div></label>' +
    '<label class="f cust"><span>Major diameter</span><div class="row"><input id="hd" type="number" step="any"><span class="u">' + uLen() + '</span></div></label>' +
    '<label class="f cust"><span>Pitch' + (inMode() ? ' (threads per inch)' : '') + '</span><div class="row"><input id="hp" type="number" step="any"><span class="u">' + (inMode() ? 'TPI' : 'mm') + '</span></div></label>' +
    '<label class="f cust"><span>Thread system (for tolerances)</span><div class="row"><select id="hs"><option value="metric">ISO metric</option><option value="unified">Unified inch</option></select></div></label></div>' +
    '<div id="hres"></div><div class="note"><b>Working:</b> Basic profile (ISO 68-1:2023, ASME B1.1-2024): H = 0.866025 P; pitch diameter d2 = D - 0.649519 P; basic minor diameter D1 = D - 1.082532 P (internal thread); ISO external minor diameter d3 = D - 1.226869 P (rounded root used for tolerancing). ' +
    'ISO metric tolerances from the ISO 965-1 formulas: Td2(6) = 90 P^0.4 d^0.1 (d = geometric mean of the diameter step), TD2 = 1.32 Td2(6), Td(6) = 180 P^(2/3) - 3.15 P^(-1/2), TD1(6) = 230 P^0.7 (P >= 1 mm) or 433 P - 190 P^1.22, es(g) = -(15 + 11 P), each rounded to the R40 series. The standard\'s own tables (ISO 965-2/-3) are normative and differ from these formulas by one R40 step for some sizes (found for M3, M10, M20, M36, M39, M42 against published tables); BenchMate shows published limits where two publishers print them and marks computed ones. ISO 965-1 was revised in 2026 (ISO 965-1:2026); the formulas here were checked against tables published under the 2013 and earlier editions. ' +
    'Unified: PD tolerance 2A = 0.0015 D^(1/3) + 0.0015 sqrt(LE) + 0.015 P^(2/3) with LE = D (reproduces all 30 class 2A rows checked in a published table), 1A 1.5x, 3A 0.75x, 1B 1.95x, 2B 1.3x, 3B 0.975x; allowance 1A/2A = 0.3 x Td2(2A), 3A/3B none; major tolerance 2A/3A = 0.060 P^(2/3); rounded to 0.0001 in. Class 2B minor diameter limits are computed (rule in the table note); 1B and 3B minor limits are not. TD2 of internal classes is the factor times the unrounded 2A tolerance, then rounded, which is the order that reproduces the published 2B table.<br><b>Sources:</b> thread series and limits as listed below; formulas: ISO 68-1:2023, ISO 965-1:2013/2026 (formula clause), ASME B1.1-2024 (Table 4 title gives the 2A formula).</div><div class="note" id="hsrc"></div>';
  const k = $('#hk', el), hd = $('#hd', el), hp = $('#hp', el), hs = $('#hs', el);
  function setCustom() {
    const c = k.value === 'custom';
    el.querySelectorAll('.cust').forEach(x => x.style.display = c ? '' : 'none');
    hd.value = +toUser(m.d).toFixed(inMode() ? 4 : 3); hp.value = inMode() ? +(IN_MM / m.p).toFixed(3) : +m.p.toFixed(4);
    hs.value = m.sys || 'metric';
  }
  function row(label, mm, extra) { return '<tr><td>' + label + (extra || '') + '</td><td class="v">' + fBoth(mm) + '</td></tr>'; }
  function upd() {
    m.key = k.value;
    let sel = opts.find(o => o.key === k.value), d, p, sys;
    if (sel) { d = sel.d; p = sel.p; sys = sel.sys; m.d = d; m.p = p; }
    else { d = fromUser(parseFloat(hd.value)); const pv = parseFloat(hp.value); p = inMode() ? IN_MM / pv : pv; sys = hs.value; m.sys = sys; if (d > 0 && p > 0) { m.d = d; m.p = p; } }
    const out = $('#hres', el);
    if (!(d > 0 && p > 0 && p < d)) { out.innerHTML = '<div class="res"><table><tr><td class="warn">Enter the thread size.</td></tr></table></div>'; return; }
    let h = '<div class="res"><div class="h">Basic dimensions' + (sel ? ' of ' + rEsc(sel.label) + ' ' + badge(sel.status) + ' <span class="ms">series printed by ' + sel.pubs.map(x => rEsc(pubName(T.sources, x))).join(', ') + '</span>' : '') + '</div><table>' +
      row('Major diameter D', d) + row('Pitch P' + (sys === 'unified' ? ' (' + fx(IN_MM / p, 2) + ' TPI)' : ''), p) + row('Fundamental triangle height H', W.thread_fundamental_h(p)) +
      row('Basic thread height H1 = 5/8 H', W.thread_basic_height(p)) + row('Pitch diameter d2', W.thread_basic_pitch_dia(d, p)) + row('Basic minor diameter D1 (internal)', W.thread_basic_minor_dia(d, p)) +
      (sys === 'metric' ? row('Minor diameter d3 (external, ISO 965 rounded root)', W.thread_iso_d3(d, p)) : '') + '</table></div>';
    if (sys === 'metric') {
      const key = 'M' + (+d.toFixed(3)) + 'x' + (+p.toFixed(3));
      const ext = ['Major max', 'Major min', 'Pitch max', 'Pitch min'], intl = ['Pitch min', 'Pitch max', 'Minor min', 'Minor max'];
      const pubT = (cls, i) => { const r = (T.limits[cls] || {})[key]; return r ? r[i] : null; };
      // A value two publishers agree on is shown as the result; the formula value beside it.
      // Otherwise the formula value is the result and any single published value is shown.
      const cell = (mm, pub, note) => {
        const pubs = g => g.publishers.map(x => rEsc(pubName(T.sources, x))).join(', ');
        if (pub && pub.status === 'confirmed') {
          const same = Math.abs(pub.value - mm) < 6e-4;
          return '<td class="v">' + fBoth(pub.value) + '</td><td>' + badge('confirmed') + ' <span class="ms" title="' + rEsc(groupsTitle(T.sources, pub.groups)) + '">published by ' + pubs(pub.groups[0]) + '</span>' +
            (same ? ' <span class="ms">= formula</span>' : ' <span class="warn">formula gives ' + fLen(mm) + '</span>') + '</td>';
        }
        let s = '<td class="v">' + fBoth(mm) + '</td><td><span class="ms">' + (note || 'computed from the formulas') + '</span>';
        if (pub) s += ' ' + badge(pub.status) + ' <span class="ms">published ' + pub.groups.map(g => g.value.toFixed(3) + ' (' + pubs(g) + ')').join(' / ') + '</span>';
        return s + '</td>';
      };
      const g6 = [0, 1, 2, 3].map(i => W.iso965_limit(d, p, 6, 3, i)), H6 = [3, 2, 5, 4].map(i => W.iso965_limit(d, p, 6, 12, i));
      h += '<div class="res" style="margin-top:12px"><div class="h">External thread 6g (ISO 965-1 formulas: es = ' + fx(W.iso965_value(d, p, 3, 4), 0) + ' um, Td2 = ' + fx(W.iso965_value(d, p, 6, 0), 0) + ' um, Td = ' + fx(W.iso965_value(d, p, 6, 2), 0) + ' um)</div><table>' +
        ext.map((lab, i) => { const pub = pubT('6g', i); return '<tr><td>' + lab + '</td>' + cell(g6[i], pub) + '</tr>'; }).join('') + '<tr><td>Minor d3 max</td>' + cell(W.iso965_limit(d, p, 6, 3, 4), null) + '</tr></table></div>';
      h += '<div class="res" style="margin-top:12px"><div class="h">Internal thread 6H (ISO 965-1 formulas: EI = 0, TD2 = ' + fx(W.iso965_value(d, p, 6, 1), 0) + ' um, TD1 = ' + fx(W.iso965_value(d, p, 6, 3), 0) + ' um)</div><table>' +
        intl.map((lab, i) => { const pub = pubT('6H', i); return '<tr><td>' + lab + '</td>' + cell(H6[i], pub) + '</tr>'; }).join('') + '<tr><td>Major min</td>' + cell(d, null, 'basic major diameter (EI = 0)') + '</tr></table></div>';
      // Other classes from the same formulas; no published table has been compared for these.
      const mmv = v => '<td class="mv">' + (isFinite(v) ? fLen(v) : '-') + '</td>';
      const extC = [['4h', 4, 4], ['6e', 6, 1], ['6f', 6, 2], ['6h', 6, 4], ['8g', 8, 3]], intC = [['5H', 5, 12], ['6G', 6, 11], ['7H', 7, 12]];
      h += '<div class="res" style="margin-top:12px"><div class="h">Other classes, computed from the ISO 965-1 formulas (' + uLen() + '; not checked against a published table)</div><table>' +
        '<tr><td class="ms">External</td><td class="ms">Major max</td><td class="ms">Major min</td><td class="ms">Pitch max</td><td class="ms">Pitch min</td></tr>' +
        extC.map(([n, g, pos]) => '<tr><td><b>' + n + '</b></td>' + [0, 1, 2, 3].map(i => mmv(W.iso965_limit(d, p, g, pos, i))).join('') + '</tr>').join('') +
        '<tr><td class="ms">Internal</td><td class="ms">Pitch min</td><td class="ms">Pitch max</td><td class="ms">Minor min</td><td class="ms">Minor max</td></tr>' +
        intC.map(([n, g, pos]) => '<tr><td><b>' + n + '</b></td>' + [3, 2, 5, 4].map(i => mmv(W.iso965_limit(d, p, g, pos, i))).join('') + '</tr>').join('') +
        '</table></div><p class="desc">Major tolerance for 4h uses grade 4 (Td(4)); 6e, 6f, 6h use grade 6; 8g uses grade 8. 5H and 7H minor tolerances use TD1 of grades 5 and 7.</p>';
    } else {
      const din = d / IN_MM, pin = p / IN_MM, cls = [[2, '2A', 'checked'], [3, '3A', ''], [1, '1A', ''], [12, '2B', 'checked'], [13, '3B', ''], [11, '1B', '']];
      h += '<div class="res" style="margin-top:12px"><div class="h">Unified classes (computed from ASME B1.1-2024 formulas, inch, rounded as tabulated)</div><table><tr><td class="ms">Class</td><td class="ms">Major max</td><td class="ms">Major min</td><td class="ms">Pitch max</td><td class="ms">Pitch min</td><td class="ms">Minor max</td><td class="ms">Minor min</td><td class="ms">Allowance</td></tr>' +
        cls.map(([c, n, chk]) => { const L = w => W.un_limit(din, pin, c, w); const ext = c < 10;
          const f = v => '<td class="mv">' + (isFinite(v) ? (inMode() ? v.toFixed(4) : (v * IN_MM).toFixed(3)) : '-') + '</td>';
          return '<tr><td><b>' + n + '</b>' + (chk ? ' ' + badge('confirmed') : ' <span class="ms">not checked</span>') + '</td>' + f(ext ? L(0) : NaN) + f(L(1)) + f(L(2)) + f(L(3)) + f(c === 12 ? L(7) : NaN) + f(c === 12 ? L(6) : NaN) + f(ext ? L(5) : 0) + '</tr>'; }).join('') +
        '</table></div><p class="desc">Values in ' + (inMode() ? 'inch' : 'mm (converted from the inch limits)') + '. "Confirmed": the formulas reproduce a published class 2A table (30 rows) and class 2B table (74 rows: pitch and minor limits; exceptions listed in the tests); 1A, 3A, 1B and 3B use the standard\'s class factors but have not been compared with a published table. ' +
        'Internal minor limits (2B): minimum = basic minor diameter; tolerance 0.25 P - 0.40 P^2 for 1/4 in and larger, 0.05 P^(2/3) + 0.03 P / D - 0.002 (kept between 0.120 P and 0.394 P) below 1/4 in. 1B and 3B minor limits are not computed. Internal major minimum = basic major diameter.</p>';
    }
    out.innerHTML = h;
  }
  $('#hsrc', el).innerHTML = '<b>Thread series and published limits</b><br>' + sourceList(T.sources);
  k.onchange = () => { setCustom(); upd(); }; hd.oninput = upd; hp.oninput = upd; hs.onchange = upd;
  setCustom(); upd();
}

// ------------------------------------------------------------------ ISO limits and fits
const SHAFT_LETTERS = ['a', 'b', 'c', 'cd', 'd', 'e', 'ef', 'f', 'fg', 'g', 'h', 'js', 'k', 'm', 'n', 'p', 'r', 's', 't', 'u', 'v', 'x', 'y', 'z', 'za', 'zb', 'zc'];
const LETTER_CODE = Object.fromEntries(['', 'a', 'b', 'c', 'cd', 'd', 'e', 'ef', 'f', 'fg', 'g', 'h', 'js', 'k', 'm', 'n', 'p', 'r', 's', 't', 'u', 'v', 'x', 'y', 'z', 'za', 'zb', 'zc'].map((l, i) => [l, i]));

function iso286Step(I, sizeMm, sub) {
  const steps = sub ? I.sub_steps : I.main_steps;
  for (const s of steps) { const [lo, hi] = s.split('-').map(Number); if (sizeMm > lo && sizeMm <= hi) return { key: s, lo, hi }; }
  return null;
}
function iso286It(I, sizeMm, grade) {
  const st = iso286Step(I, sizeMm, false); if (!st) return null;
  const c = (I.it['IT' + grade] || {})[st.key]; return c ? { v: c.value, c, st } : null;
}
function iso286ShaftFd(I, sizeMm, letter) {
  if (letter === 'h' || letter === 'js') { const st = iso286Step(I, sizeMm, false); return st ? { v: 0, c: { status: 'exact', groups: [] }, st } : null; }
  const sub = I.sub_letters.includes(letter);
  const st = iso286Step(I, sizeMm, sub); if (!st) return null;
  const c = (I.shaft[letter] || {})[st.key]; return c ? { v: c.value, c, st } : null;
}
function iso286Class(I, W, sizeMm, letter, grade, hole) {
  const l = letter.toLowerCase(), code = LETTER_CODE[l];
  const it = iso286It(I, sizeMm, grade); if (!it) return { err: 'No IT' + grade + ' value for this size.' };
  const fd = iso286ShaftFd(I, sizeMm, l); if (!fd) return { err: (hole ? letter.toUpperCase() : l) + ' is not defined for ' + sizeMm + ' mm (ISO 286-1 leaves it out for this size step).' };
  let up, lo;
  if (!hole) { up = W.iso286_shaft_limit(code, grade, fd.v, it.v, 0); lo = W.iso286_shaft_limit(code, grade, fd.v, it.v, 1); }
  else {
    const itn1 = grade > 1 ? iso286It(I, sizeMm, grade - 1) : null;
    up = W.iso286_hole_limit(code, grade, fd.v, it.v, itn1 ? itn1.v : it.v, it.st.lo, it.st.hi, 0);
    lo = W.iso286_hole_limit(code, grade, fd.v, it.v, itn1 ? itn1.v : it.v, it.st.lo, it.st.hi, 1);
  }
  return { up, lo, it, fd };
}

async function renderFits(el) {
  const R = await loadRef(el); if (!R) return;
  const W = state.W, I = R.iso286;
  const m = RMEM.fit || (RMEM.fit = { size: 40, hl: 'H', hg: 7, sl: 'g', sg: 6 });
  const gradeOpts = cur => Array.from({ length: 18 }, (_, i) => i + 1).map(g => '<option' + (g === cur ? ' selected' : '') + '>' + g + '</option>').join('');
  const letterOpts = (cur, up) => SHAFT_LETTERS.map(l => { const t = up ? l.toUpperCase() : l; return '<option value="' + l + '"' + (l === cur.toLowerCase() ? ' selected' : '') + '>' + (up && l === 'js' ? 'JS' : t) + '</option>'; }).join('');
  el.innerHTML = '<div class="grid" style="max-width:760px">' +
    '<label class="f"><span>Nominal size (up to 500 mm)</span><div class="row"><input id="fs" type="number" step="any"><span class="u">' + uLen() + '</span></div></label>' +
    '<label class="f"><span>Hole: letter and grade</span><div class="row"><select id="fhl">' + letterOpts(m.hl, true) + '</select><select id="fhg">' + gradeOpts(m.hg) + '</select></div></label>' +
    '<label class="f"><span>Shaft: letter and grade</span><div class="row"><select id="fsl">' + letterOpts(m.sl, false) + '</select><select id="fsg">' + gradeOpts(m.sg) + '</select></div></label>' +
    '<label class="f"><span>Common fits</span><div class="row"><select id="fpre"><option value="">Choose...</option>' +
    ['H11/c11', 'H9/d9', 'H8/f7', 'H7/g6', 'H7/h6', 'H7/k6', 'H7/n6', 'H7/p6', 'H7/s6', 'H7/u6', 'C11/h11', 'F8/h7', 'G7/h6', 'K7/h6', 'N7/h6', 'P7/h6', 'S7/h6'].map(f => '<option>' + f + '</option>').join('') + '</select></div></label></div>' +
    '<div id="fres"></div><div class="note"><b>Working:</b> Limits of a class = fundamental deviation and the IT value of the grade. Shafts a to h: es = deviation, ei = es - IT; k to zc: ei = deviation, es = ei + IT; js: +/- IT/2. k uses its IT4 to IT7 value for grades 4 to 7 and 0 otherwise. Holes (ISO 286-1): A to H: EI = -es of the same shaft letter; K, M, N up to IT8 and P to ZC up to IT7: ES = -ei + delta, delta = IT(n) - IT(n-1) for the size step (no delta up to 3 mm); K above IT8: ES = 0; M above IT8: ES = -ei; N above IT8: ES = 0; M6 over 250 to 315 mm: ES = -9 um (the standard\'s exception). Fit: maximum clearance = ES - ei, minimum clearance = EI - es; negative clearance is interference. ' +
    'The IT values and shaft deviations come from published tables (two or more publishers), not from the formulas: ISO 286-1:2010 tabulates them, and its tables depart from the annex formulas in places (sizes to 3 mm, IT1 to IT4, letters a, b, c and t to zc in small sizes, and 10 IT5 to IT10 cells). The formula value is shown alongside for comparison. js7 to js11: older practice (ISO 286-1:1988, still printed in JIS tables) allowed rounding an odd IT to the even number below; BenchMate shows the exact +/- IT/2 as ISO 286-2:2010 prints it. Letters j and J (tabulated only, no formula) are not included.<br><b>Sources:</b> ISO 286-1:2010 (Cor 1:2013) rules, clause on holes; tables as listed below.</div><div class="note" id="fsrc"></div>';
  const fs = $('#fs', el), fhl = $('#fhl', el), fhg = $('#fhg', el), fsl = $('#fsl', el), fsg = $('#fsg', el), fpre = $('#fpre', el);
  const fs0 = String(+toUser(m.size).toFixed(inMode() ? 4 : 3)); fs.value = fs0;
  const um = v => fx(v, Number.isInteger(v) ? 0 : 1);
  const limLen = (sizeMm, dev) => fLen(sizeMm + dev / 1000);
  function classRows(name, c, sizeMm) {
    if (c.err) return '<tr><td colspan="4" class="warn">' + rEsc(name) + ': ' + rEsc(c.err) + '</td></tr>';
    const st = c.fd.c.status === 'exact' ? '' : ' ' + badge(c.fd.c.status);
    return '<tr><td><b>' + rEsc(name) + '</b>' + st + '<div class="ms">IT' + rEsc(name.replace(/\D/g, '')) + ' = ' + um(c.it.v) + ' um ' + badge(c.it.c.status) + ', step ' + c.it.st.key + ' mm</div></td><td class="v">' + (c.up > 0 ? '+' : '') + um(c.up) + ' / ' + (c.lo > 0 ? '+' : '') + um(c.lo) + ' um</td><td class="v">' + limLen(sizeMm, c.up) + ' / ' + limLen(sizeMm, c.lo) + '</td><td class="u">' + uLen() + '</td></tr>';
  }
  function upd() {
    const v = parseFloat(fs.value); const out = $('#fres', el);
    m.hl = fhl.value; m.hg = +fhg.value; m.sl = fsl.value; m.sg = +fsg.value;
    if (!(v > 0)) { out.innerHTML = '<div class="res"><table><tr><td class="warn">Enter a nominal size.</td></tr></table></div>'; return; }
    const size = fs.value === fs0 ? m.size : fromUser(v); m.size = size;
    if (size > 500) { out.innerHTML = '<div class="res"><table><tr><td class="warn">Sizes above 500 mm are not covered yet.</td></tr></table></div>'; return; }
    const hn = (fhl.value === 'js' ? 'JS' : fhl.value.toUpperCase()) + fhg.value, sn = fsl.value + fsg.value;
    const H = iso286Class(I, W, size, fhl.value, +fhg.value, true), S = iso286Class(I, W, size, fsl.value, +fsg.value, false);
    let h = '<div class="res"><div class="h">' + rEsc(hn) + '/' + rEsc(sn) + ' at ' + fBoth(size) + '</div><table><tr><td class="ms">Class</td><td class="ms" style="text-align:right">Upper / lower deviation</td><td class="ms" style="text-align:right">Limits of size</td><td></td></tr>' + classRows(hn, H, size) + classRows(sn, S, size);
    if (!H.err && !S.err) {
      const mx = W.iso286_fit(H.up, H.lo, S.up, S.lo, 0), mn = W.iso286_fit(H.up, H.lo, S.up, S.lo, 1), ty = W.iso286_fit(H.up, H.lo, S.up, S.lo, 2);
      const txt = { 1: 'Clearance fit', 2: 'Transition fit', 3: 'Interference fit' }[ty];
      const q = x => um(Math.abs(x)) + ' um (' + (inMode() ? fx(Math.abs(x) / 1000 / IN_MM, 5) + ' in' : fx(Math.abs(x) / 1000, 3) + ' mm') + ')';
      // mx = largest clearance (ES - ei), mn = smallest clearance (EI - es); negative clearance is interference
      const lines = ty === 1 ? ['max clearance ' + q(mx), 'min clearance ' + q(mn)]
        : ty === 3 ? ['max interference ' + q(mn), 'min interference ' + q(mx)]
        : ['max clearance ' + q(mx), 'max interference ' + q(mn)];
      h += '<tr><td><b>' + txt + '</b></td><td class="v" colspan="2">' + lines.join('<br>') + '</td><td></td></tr>';
    }
    h += '</table></div>';
    // formula comparison for the shaft letter and the IT values used
    const cmp = [];
    [[S, fsl.value, +fsg.value], [H, fhl.value, +fhg.value]].forEach(([c, l, g]) => {
      if (c.err || !c.it) return;
      const st = c.it.st; const dm = W.iso286_step_mean(st.lo, st.hi);
      const itf = W.iso286_it_formula(dm, g);
      cmp.push('IT' + g + ' (' + st.key + ' mm): table ' + um(c.it.v) + ' um, formula ' + fx(itf, 1) + ' um');
      if (!['h', 'js'].includes(l)) {
        const fst = c.fd.st, fdm = W.iso286_step_mean(fst.lo, fst.hi);
        const gi = n => (iso286It(I, size, n) || {}).v;
        const ff = W.iso286_shaft_fd_formula(LETTER_CODE[l], fdm, gi(6), gi(7), gi(8), gi(9), gi(10));
        if (isFinite(ff)) cmp.push('shaft ' + l + ' deviation (' + fst.key + ' mm): table ' + um(c.fd.v) + ' um, formula ' + fx(ff, 1) + ' um' + (['p', 's', 'r'].includes(l) && size <= 50 ? ' (formula gives a range here)' : ''));
      }
    });
    h += '<p class="desc">' + cmp.map(rEsc).join('; ') + '.</p>';
    // IT grade table for this size
    const st = iso286Step(I, size, false);
    if (st) h += '<div class="res mtab" style="margin-top:12px"><div class="h">Standard tolerances for ' + st.key + ' mm (um)</div><table><tr>' + Object.keys(I.it).map(g => '<th>' + g + '</th>').join('') + '</tr><tr>' +
      Object.keys(I.it).map(g => { const c = I.it[g][st.key]; return '<td class="mv" title="' + rEsc(groupsTitle(I.sources, c.groups)) + '">' + um(c.value) + (c.status === 'confirmed' ? '' : '<div>' + badge(c.status) + '</div>') + '</td>'; }).join('') + '</tr></table></div>';
    out.innerHTML = h;
  }
  fpre.onchange = () => { const v = fpre.value; if (!v) return; const [a, b] = v.split('/'); const pa = a.match(/^([A-Z]+)(\d+)$/), pb = b.match(/^([a-z]+)(\d+)$/); fhl.value = pa[1].toLowerCase(); fhg.value = pa[2]; fsl.value = pb[1]; fsg.value = pb[2]; upd(); };
  $('#fsrc', el).innerHTML = '<b>Table sources</b><br>' + sourceList(I.sources);
  [fs, fhl, fhg, fsl, fsg].forEach(x => { x.oninput = upd; x.onchange = upd; });
  upd();
}
