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
const RSTATUS = { confirmed: ['confirmed', 'Confirmed'], confirmed_with_outlier: ['differs', 'One source differs'], differs: ['differs', 'Sources differ'], review: ['review', 'One source'], listed: ['review', 'One source'], exact: ['confirmed', 'Exact'],
  table_formula: ['review', 'One table, formula agrees'], rule: ['confirmed', 'By rule'] };
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
  const D = R.drills, m = RMEM.drill || (RMEM.drill = { q: '', kind: '', target: '', tu: '' });
  if (!m.tu) m.tu = inMode() ? 'in' : 'mm';
  el.innerHTML = '<div class="mfilter"><input id="dq" type="search" placeholder="Search: #7, F, 13/64, 6.8 ..." style="width:260px">' +
    '<select id="dk"><option value="">All series</option><option value="fraction">Fractional</option><option value="number">Number</option><option value="letter">Letter</option><option value="metric">Metric</option></select></div>' +
    '<div class="grid" style="max-width:760px"><label class="f"><span>Find the nearest drills to a diameter</span><div class="row"><input id="dt" type="number" step="any" inputmode="decimal"><select id="dtu" style="width:auto"><option value="in">in</option><option value="mm">mm</option></select></div></label></div>' +
    '<div id="dn"></div><div id="dres"></div><div class="note" id="dsrc"></div>';
  const q = $('#dq', el), k = $('#dk', el), t = $('#dt', el), tu = $('#dtu', el);
  q.value = m.q; k.value = m.kind; tu.value = m.tu;
  const showT = () => { t.value = m.target === '' ? '' : String(+(m.tu === 'in' ? m.target / IN_MM : m.target).toFixed(m.tu === 'in' ? 4 : 3)); };
  showT();
  // Nearest size at or below and above the diameter in each series; the difference is drill minus target.
  function nearest() {
    const out = $('#dn', el), mm = m.target;
    if (!(mm > 0)) { out.innerHTML = ''; return; }
    const dIn = x => (x >= 0 ? '+' : '') + fx(x / IN_MM, 4) + ' in', dMm = x => (x >= 0 ? '+' : '') + fx(x, 3) + ' mm';
    const rows = nearestBySeries(D.drills, mm).filter(s => !k.value || s.kind === k.value).map(s => {
      const cell = (x, side) => x ? '<td>' + rEsc(x.d.name) + ' ' + badge(x.d.status) + '<div class="ms">' + side + '</div></td><td class="v">' + fBoth(x.mm) + '</td><td class="v">' + (Math.abs(x.mm - mm) < 1e-9 ? '<b>exact</b>' : dIn(x.mm - mm) + '<div class="ms">' + dMm(x.mm - mm) + '</div>') + '</td>'
        : '<td colspan="3" class="ms">' + (side === 'below' ? 'none this small (smallest ' + rEsc(s.first.d.name) + ')' : 'none this large (largest ' + rEsc(s.last.d.name) + ')') + '</td>';
      return '<tr><td rowspan="2"><b>' + s.name + '</b></td>' + cell(s.below, 'at or below') + '</tr><tr>' + cell(s.above, 'above') + '</tr>';
    });
    out.innerHTML = '<div class="res mtab" style="margin-bottom:12px"><div class="h">Nearest drills to ' + fBoth(mm) + '</div><table><tr><th>Series</th><th>Drill</th><th style="text-align:right">Size</th><th style="text-align:right">Difference</th></tr>' + rows.join('') + '</table></div>';
  }
  t.oninput = () => { const v = parseFloat(t.value); m.target = v > 0 ? (m.tu === 'in' ? v * IN_MM : v) : ''; nearest(); };
  tu.onchange = () => { m.tu = tu.value; showT(); nearest(); };
  function draw() {
    m.q = q.value; m.kind = k.value;
    const s = q.value.trim().toLowerCase().replace(/^#/, '').replace(/"/g, '');
    // "#7" names a number drill: match that size only, not every size whose decimals contain a 7.
    const numberSize = /^#\s*\d+$/.test(q.value.trim());
    const rows = D.drills.filter(d => (!k.value || d.kind === k.value) && (numberSize ? d.kind === 'number' && d.name.replace('#', '') === s.trim() :
      (!s || d.name.toLowerCase().replace(/[#"]/g, '').replace(' mm', '') === s || d.name.toLowerCase().includes(s) || String(+d.inch.toFixed(4)).includes(s) || String(+(d.inch * IN_MM).toFixed(3)).includes(s))));
    $('#dres', el).innerHTML = '<div class="res mtab"><table><tr><th>Size</th><th>Series</th><th>Decimal inch</th><th>mm</th><th>Evidence</th></tr>' + rows.map(d =>
      '<tr><td><b>' + rEsc(d.name) + '</b></td><td>' + rEsc(d.kind === 'number' ? 'Number (wire gauge)' : d.kind === 'letter' ? 'Letter' : d.kind === 'fraction' ? 'Fractional' : 'Metric') + '</td><td class="mv">' + fx(d.inch, 4) + '</td><td class="mv">' + fx(d.inch * IN_MM, 3) + '</td><td title="' + rEsc(groupsTitle(D.sources, d.groups)) + '">' + badge(d.status) +
      (d.groups.length > 1 ? '<div class="ms">' + d.groups.slice(1).map(g => rEsc(g.printed[0]) + ' printed by ' + g.publishers.map(p => rEsc(pubName(D.sources, p))).join(', ')).join('; ') + '</div>' : '') +
      (d.kind === 'number' || d.kind === 'letter' ? '<div class="ms">' + d.groups[0].publishers.length + ' publisher' + (d.groups[0].publishers.length > 1 ? 's' : '') + '</div>' : '') + '</td></tr>').join('') + '</table></div>' +
      '<p class="desc">' + rows.length + ' of ' + D.drills.length + ' sizes. Number and letter sizes are not given by a formula; their decimal sizes are what the publishers below print (Confirmed = two or more agree). Fractional sizes are exact (n/64 in). Metric sizes are exact by name; the list is the sizes one supplier stocks (a second list is still to be added). mm values are inch x 25.4.</p>';
  }
  q.oninput = () => { draw(); }; k.onchange = () => { draw(); nearest(); };
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
const DRILL_SERIES = [['number', 'Number'], ['letter', 'Letter'], ['fraction', 'Fractional'], ['metric', 'Metric']];
// Nearest drill at or below and above `mm` in each series (a lookup in the drill chart).
function nearestBySeries(drills, mm) {
  return DRILL_SERIES.map(([kind, name]) => {
    const list = drills.filter(d => d.kind === kind).map(d => ({ d, mm: d.inch * IN_MM })).sort((a, b) => a.mm - b.mm);
    let below = null, above = null;
    for (const x of list) { if (x.mm <= mm + 1e-9) below = x; else if (!above) above = x; }
    return { kind, name, below, above, first: list[0], last: list[list.length - 1] };
  });
}
// Suggested starting engagement: 75 % cutting (USCTI tapping tip; FM Carbide 65-75 %, calculator default 75 %),
// 65 % forming (Besly in CTE 1995: 65 to 75 %, worked at 65 %; FM Carbide 60-65 % in steel). See docs/sources.md.
const TAP_SUGGEST = { cut: 75, form: 65 };
async function renderTapDrill(el) {
  const R = await loadRef(el); if (!R) return;
  const W = state.W, opts = threadOptions(R);
  const m = RMEM.tap || (RMEM.tap = { key: 'M10x1.5', type: 'cut', pctCut: TAP_SUGGEST.cut, pctForm: TAP_SUGGEST.form, d: 10, p: 1.5 });
  const TAP_PICK = { map: { d: 'dia', p: 'pitch' }, types: ['Tap'] };
  el.innerHTML = toolPickRow(TAP_PICK) + '<div class="grid" style="max-width:760px">' +
    '<label class="f"><span>Thread</span><div class="row"><select id="tk">' + threadSelect(opts, m.key) + '</select></div></label>' +
    '<div class="f"><span>Tap type</span><div class="row"><div class="seg" id="tt"><button type="button" data-v="cut">Cut tap</button><button type="button" data-v="form">Form (roll) tap</button></div></div></div>' +
    '<label class="f"><span>Thread engagement <b id="tpv" class="mv"></b> <span class="ms" id="tps"></span></span><div class="row"><input id="tp" type="range" min="55" max="85" step="1" style="flex:1 1 160px;min-width:120px;padding:0;border:0;background:transparent" aria-label="Thread engagement in percent"><span class="u">%</span></div></label>' +
    '<label class="f cust"><span>Major diameter</span><div class="row"><input id="td" type="number" step="any"><span class="u">' + uLen() + '</span></div></label>' +
    '<label class="f cust"><span>Pitch' + (inMode() ? ' (threads per inch)' : '') + '</span><div class="row"><input id="tpp" type="number" step="any"><span class="u">' + (inMode() ? 'TPI' : 'mm') + '</span></div></label>' +
    '</div><div id="tres"></div><div class="note"><b>Working:</b> Cutting taps: drill = D - 1.299038 P x %/100, the convention behind the inch formula drill = D - 0.01299 x % / TPI (OSG USA tapping guide, 2024) and the metric form D - % x P / 76.98 (FM Carbide). In this convention 100 % is a thread depth of 2 x 0.75 H = 1.299 P on the diameter, deeper than the basic engagement of ISO 68-1 / ASME B1.1 (2 x 5/8 H = 1.0825 P), so a hole at the basic minor diameter is 83.3 %. Forming taps: hole = D - 0.0068 x % x P (inch: D - 0.0068 x % / TPI; metric form D - % x P / 147.06), as published by the forming tap makers North American Tool and Besly and by FM Carbide, Engineers Edge and MSC (compared under the result in forming mode); the formed metal flows inward, so the hole is larger than for a cutting tap. It is a rule of thumb: the forming-tap maker Balax prints hole sizes for 75, 65 and 55 % thread (miniature sizes, 0-80 to 3-48 and M1 to M1.4) that are 0 to 0.0016 in larger than it gives. Use the tap maker\'s recommended hole size for the tap you have. The shop rule of thumb "drill = major minus pitch" is an approximation: it gives 77 % thread with a cutting tap.<br>' +
    '<b>Suggested engagement:</b> 75 % for cutting taps: USCTI calls 75 % the general rule for 2B and 3B threads (a little more in soft, a little less in hard material, and not under 65 % in holes shallower than 3 x D); FM Carbide gives 65 to 75 % for cutting taps and starts its calculator at 75 %. 65 % for forming taps: Besly (Cutting Tool Engineering, 1995) says 65 to 75 % is enough for general work and works its example at 65 %; FM Carbide gives 60 to 65 % for forming in steel, stainless and ductile alloys; North American Tool gives 55 to 75 %. Besly and FM Carbide both advise against forming above 75 %. The slider runs from 55 to 85 %; the suggestions are starting points, not limits.<br>' +
    '<b>Nearest drills:</b> for each drill series, the nearest size at or below and the nearest above the theoretical hole for the tap type you chose, with the engagement each gives with a cutting tap and with a forming tap (the two use different formulas, so the same drill gives a different percent). Sizes come from the drill chart (number and letter sizes as printed by its publishers). Check the hole against the internal thread minor diameter limits and your tap maker\'s chart, especially for forming taps.<br><b>Sources:</b> OSG USA, Tapping Guide vol. 3 (2024), formula and drill tables for 60 to 80 % thread; FM Carbide TechTips "Tapping formulas" (constants 1.299 / 0.68, 76.98 / 147.06; engagement ranges); Engineers Edge "Theoretical tapping hole size, cold form threads" (0.0068); USCTI tapping tip "Don\'t let percent of thread derail your part"; Besly Products in Cutting Tool Engineering, "Threads will roll" (1995); North American Tool TRU-FLO engineering data. Thread geometry ISO 68-1:2023, ASME B1.1-2024.</div>';
  const k = $('#tk', el), tt = $('#tt', el), tp = $('#tp', el), td = $('#td', el), tpp = $('#tpp', el);
  const type = () => m.type === 'form' ? 'form' : 'cut';
  function setType() {
    tt.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === type()));
    tp.value = type() === 'form' ? m.pctForm : m.pctCut;
  }
  function setCustomFields() {
    const cust = k.value === 'custom';
    el.querySelectorAll('.cust').forEach(x => x.style.display = cust ? '' : 'none');
    td.value = +toUser(m.d).toFixed(inMode() ? 4 : 3);
    tpp.value = inMode() ? +(IN_MM / m.p).toFixed(3) : +m.p.toFixed(4);
  }
  function upd() {
    m.key = k.value;
    const pct = parseFloat(tp.value), form = type() === 'form';
    if (form) m.pctForm = pct; else m.pctCut = pct;
    $('#tpv', el).textContent = fx(pct, 0) + ' %';
    $('#tps', el).textContent = pct === TAP_SUGGEST[type()] ? '(suggested for ' + (form ? 'forming' : 'cutting') + ' taps)' : '(suggested ' + TAP_SUGGEST[type()] + ' %)';
    let d, p, sel = opts.find(o => o.key === k.value);
    if (sel) { d = sel.d; p = sel.p; m.d = d; m.p = p; }
    else { d = fromUser(parseFloat(td.value)); const pv = parseFloat(tpp.value); p = inMode() ? IN_MM / pv : pv; if (d > 0 && p > 0) { m.d = d; m.p = p; } }
    const out = $('#tres', el);
    if (!(d > 0 && p > 0 && p < d)) { out.innerHTML = '<div class="res"><table><tr><td class="warn">Enter the thread size.</td></tr></table></div>'; return; }
    // Each tap type at its own engagement (the slider sets the one chosen; the other keeps its value).
    const T = { cut: { pct: m.pctCut, hole: W.tap_drill_cut(d, p, m.pctCut), of: h => W.tap_pct_cut(d, p, h), name: 'Cutting tap' },
      form: { pct: m.pctForm, hole: W.tap_drill_form(d, p, m.pctForm), of: h => W.tap_pct_form(d, p, h), name: 'Forming tap' } };
    const cur = T[type()], d1 = W.thread_basic_minor_dia(d, p);
    const pctTxt = h => { const v = cur.of(h); return v > 100 ? 'too small for a ' + (form ? 'forming' : 'cutting') + ' tap (over 100 %)' : '= ' + fx(v, 1) + ' % with a ' + (form ? 'forming' : 'cutting') + ' tap'; };
    const pitchTxt = (sel ? sel.sys === 'unified' : inMode()) ? fx(IN_MM / p, 2) + ' TPI' : fx(p, 3) + ' mm pitch';
    const order = form ? ['form', 'cut'] : ['cut', 'form'];
    const rows = order.map(t => ['Theoretical hole, ' + T[t].name.toLowerCase() + ', ' + fx(T[t].pct, 0) + ' % engagement' + (t === type() ? '' : ' <span class="ms">(its own setting; choose ' + (t === 'form' ? 'Form' : 'Cut') + ' tap to change it)</span>'), t === type() ? '<b>' + fBoth(T[t].hole) + '</b>' : fBoth(T[t].hole)]).concat([
      ['Basic minor diameter of the internal thread (D1)', fBoth(d1) + ' <span class="ms">' + pctTxt(d1) + '</span>'],
      ['Rule of thumb D - P (approximation)', fBoth(d - p) + ' <span class="ms">' + pctTxt(d - p) + '</span>'],
    ]);
    const nearTable = t => {
      const X = T[t];
      let near = '';
      nearestBySeries(R.drills.drills, X.hole).forEach(s => {
        const pick = [];
        if (!s.above) { near += '<tr><td><b>' + s.name + '</b></td><td colspan="4" class="ms">None this large: the largest is ' + rEsc(s.last.d.name) + ' (' + fLen(s.last.mm) + ' ' + uLen() + ')</td></tr>'; return; }
        if (s.below) pick.push(['at or below', s.below]);
        pick.push(['above', s.above]);
        pick.forEach(([side, x], i) => {
          const diff = x.mm - X.hole, v = X.of(x.mm), warn = v > 100 ? 'over 100 %: tap will bind or break' : v < 50 ? 'under 50 %: weak thread' : '';
          near += '<tr' + (warn ? ' class="over"' : '') + '>' + (i === 0 ? '<td rowspan="' + pick.length + '"><b>' + s.name + '</b>' + (!s.below ? '<div class="ms">none smaller in the chart</div>' : '') + '</td>' : '') +
            '<td>' + rEsc(x.d.name) + ' ' + badge(x.d.status) + '</td><td class="v">' + fBoth(x.mm) + '</td><td class="v ms">' + side + ', ' + (diff >= 0 ? '+' : '') + (inMode() ? fx(diff / IN_MM, 4) : fx(diff, 3)) + '</td><td class="v"><b>' + fx(v, 1) + ' %</b>' + (warn ? '<div class="wmsg">' + warn + '</div>' : '') + '</td></tr>';
        });
      });
      return '<div class="res mtab" style="margin-top:12px"><div class="h">' + X.name + ': nearest standard drills to ' + fLen(X.hole) + ' ' + uLen() + ' (' + fx(X.pct, 0) + ' %)</div><table><tr><th>Series</th><th>Drill</th><th style="text-align:right">Size</th><th style="text-align:right">Difference (' + uLen() + ')</th><th style="text-align:right">Engagement</th></tr>' + near + '</table></div>';
    };
    out.innerHTML = '<div class="res"><div class="h">Results' + (sel ? ' for ' + rEsc(sel.label) + ' ' + badge(sel.status) : ' for ' + fLen(d) + ' ' + uLen() + ', ' + pitchTxt) + '</div><table>' + rows.map(r => '<tr><td>' + r[0] + '</td><td class="v">' + r[1] + '</td></tr>').join('') + '</table></div>' +
      order.map(nearTable).join('') +
      (form && typeof formTapCompare === 'function' ? formTapCompare(R, d, p, pct) : '');
  }
  const pick = $('#tpick', el);
  if (pick) pick.onchange = () => {
    const t = ToolLib.get(pick.value); pick.value = ''; if (!t) return;
    const d = t.units === 'in' ? Number(t.dia) * IN_MM : Number(t.dia), p = ToolLib.pitchMm(t);
    if (!(d > 0 && p > 0)) { $('#tpickmsg', el).textContent = ToolLib.describe(t) + ' needs a diameter and a pitch.'; return; }
    // A standard thread with the same size is selected; anything else goes in as "Other".
    const std = opts.find(o => Math.abs(o.d - d) < 1e-6 && Math.abs(o.p - p) < 1e-6);
    m.d = d; m.p = p; k.value = std ? std.key : 'custom';
    if (t.type === 'Tap (forming)') m.type = 'form'; else if (t.type === 'Tap (cutting)') m.type = 'cut';
    $('#tpickmsg', el).textContent = 'Filled from ' + ToolLib.describe(t) + (std ? ' (' + std.label + ')' : '') + '.';
    setCustomFields(); setType(); upd();
  };
  tt.querySelectorAll('button').forEach(b => b.onclick = () => { m.type = b.dataset.v; setType(); upd(); });
  k.onchange = () => { setCustomFields(); upd(); }; tp.oninput = upd; td.oninput = upd; tpp.oninput = upd;
  setCustomFields(); setType(); upd();
}

// ------------------------------------------------------------------ spot and centre drill depth
const CD_FAMS = [
  ['inch_plain', 'Inch, plain type (#000 to #10)', 'in'],
  ['inch_bell', 'Inch, bell type (#11 to #20)', 'in'],
  ['iso866_a', 'Metric type A, ISO 866 / DIN 333 A', 'mm'],
  ['iso2540_b', 'Metric type B (protecting chamfer), ISO 2540 / DIN 333 B', 'mm'],
  ['iso2541_r', 'Metric type R (radius form), ISO 2541 / DIN 333 R', 'mm'],
];
const CD_FIELD = { body: 'Body (shank) diameter', pilot: 'Pilot (drill) diameter', pilot_len: 'Pilot (drill) length', bell: 'Bell diameter (end of the 60° countersink)',
  cone: 'Countersink diameter d2 (end of the 60°, start of the 120° chamfer)', l_min: 'Pilot length, smallest', l_max: 'Pilot length, largest', r_max: 'Radius r, largest', r_min: 'Radius r, smallest' };
async function renderSpotDepth(el) {
  const R = await loadRef(el); if (!R) return;
  const W = state.W, C = R.centredrills;
  const m = RMEM.spot || (RMEM.spot = { mode: 3, fam: inMode() ? 'inch_plain' : 'iso866_a', size: '', ang: 60, dc: '', z: '', dh: '', dp: '', lp: '', pang: 90 });
  const num = id => { const x = parseFloat($('#' + id, el).value); return isFinite(x) ? x : NaN; };
  const inp = (id, label, unit, val) => '<label class="f"><span>' + label + '</span><div class="row"><input id="' + id + '" type="number" step="any" inputmode="decimal" value="' + rEsc(val) + '"><span class="u">' + unit + '</span></div></label>';
  const memLen = k => m[k] === '' || m[k] === undefined ? '' : String(+toUser(m[k]).toFixed(inMode() ? 4 : 3));
  function draw() {
    const fam = C && C.families[m.fam] ? m.fam : 'iso866_a', rows = C ? C.families[fam] : [];
    if (!rows.find(r => r.size === m.size)) m.size = rows.length ? rows[Math.min(3, rows.length - 1)].size : '';
    const angs = (C && C.angles[fam]) || [60];
    if (!angs.includes(+m.ang)) m.ang = angs[0];
    el.innerHTML = '<div class="grid" style="max-width:760px">' +
      '<label class="f"><span>Tool</span><div class="row"><select id="sm">' + [[1, 'Spot drill or pointed chamfer tool'], [3, 'Standard centre drill (pick type and size)'], [2, 'Centre drill, your own sizes']].map(o => '<option value="' + o[0] + '"' + (o[0] === m.mode ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select></div></label>' +
      (m.mode === 3 ? '<label class="f"><span>Centre drill type</span><div class="row"><select id="sf">' + CD_FAMS.map(f => '<option value="' + f[0] + '"' + (f[0] === fam ? ' selected' : '') + '>' + f[1] + '</option>').join('') + '</select></div></label>' +
        '<label class="f"><span>Size</span><div class="row"><select id="ss">' + rows.map(r => '<option value="' + rEsc(r.size) + '"' + (r.size === m.size ? ' selected' : '') + '>' + rEsc(fam.startsWith('inch') ? r.size : r.size + ' mm pilot') + '</option>').join('') + '</select></div></label>' +
        '<label class="f"><span>Included countersink angle</span><div class="row"><select id="sa">' + angs.map(a => '<option value="' + a + '"' + (+a === +m.ang ? ' selected' : '') + '>' + a + '°</option>').join('') + '</select></div></label>' :
        inp('sang', 'Included angle of the point or countersink', 'deg', m.pang) +
        (m.mode === 2 ? inp('sdp', 'Centre drill pilot diameter', uLen(), memLen('dp')) + inp('slp', 'Centre drill: tip to start of the countersink cone', uLen(), memLen('lp')) : '')) +
      inp('sdc', 'Countersink (chamfer) diameter wanted', uLen(), memLen('dc')) +
      inp('sz', 'Or a depth from the tip, to get the diameter', uLen(), memLen('z')) +
      inp('sdh', 'Hole diameter (optional, for the chamfer width)', uLen(), memLen('dh')) +
      '</div><div id="sres"></div><div id="sdia"></div><div class="note" id="snote"></div>';
    $('#sm', el).onchange = e => { m.mode = +e.target.value; draw(); };
    if ($('#sf', el)) $('#sf', el).onchange = e => { m.fam = e.target.value; m.size = ''; draw(); };
    if ($('#ss', el)) $('#ss', el).onchange = e => { m.size = e.target.value; calc(); };
    if ($('#sa', el)) $('#sa', el).onchange = e => { m.ang = +e.target.value; calc(); };
    el.querySelectorAll('input').forEach(i => i.oninput = () => {
      const k = { sdc: 'dc', sz: 'z', sdh: 'dh', sdp: 'dp', slp: 'lp' }[i.id];
      if (k) m[k] = i.value === '' ? '' : fromUser(parseFloat(i.value)); else if (i.id === 'sang') m.pang = i.value;
      calc();
    });
    calc();
  }
  function calc() {
    const out = $('#sres', el), dia = $('#sdia', el), note = $('#snote', el), rows = [];
    const dcU = num('sdc'), zU = num('sz'), dhU = num('sdh'), dpL = inMode() ? 4 : 3;
    const len = mm => fBoth(mm);
    let svg = '';
    if (m.mode !== 3) {
      const ang = num('sang'), dc = fromUser(dcU), z = fromUser(zU), dh = fromUser(dhU);
      if (!(ang > 0 && ang < 180)) { out.innerHTML = '<div class="res"><table><tr><td class="warn">Enter an included angle between 0 and 180°.</td></tr></table></div>'; dia.innerHTML = ''; return; }
      if (m.mode === 2) {
        const dp = fromUser(num('sdp')), lp = fromUser(num('slp'));
        if (!(dp > 0 && lp >= 0)) rows.push(['Centre drill', 'Enter the pilot diameter and the length from the tip to the countersink']);
        else {
          if (dc > 0) { const zz = W.centre_drill_depth(dc, dp, lp, ang); rows.push(['<b>Depth from the tip</b>', isFinite(zz) ? '<b>' + len(zz) + '</b>' : 'Countersink smaller than the pilot']); }
          if (z > 0) { const d = W.centre_drill_dia(z, dp, lp, ang); rows.push(['Countersink diameter at that depth', isFinite(d) ? len(d) : 'Depth does not reach the countersink']); }
          svg = mtSpotSvg(2, dc, ang, dp, lp);
        }
      } else {
        if (dc > 0) rows.push(['<b>Depth from the tip</b>', '<b>' + len(W.spot_depth(dc, ang)) + '</b>']);
        if (z > 0) rows.push(['Chamfer diameter at that depth', len(W.spot_chamfer_dia(z, ang))]);
        svg = mtSpotSvg(1, dc, ang);
      }
      if (dh > 0 && dc > dh) rows.push(['Chamfer width on the hole (each side)', len((dc - dh) / 2)]);
      out.innerHTML = '<div class="res"><div class="h">Results</div><table>' + (rows.length ? rows.map(r => '<tr><td>' + r[0] + '</td><td class="v">' + r[1] + '</td></tr>').join('') : '<tr><td class="ms">Enter a countersink diameter or a depth.</td></tr>') + '</table></div>';
      dia.innerHTML = svg;
      note.innerHTML = '<b>Working:</b> pointed tool: depth from the tip z = (Dc / 2) / tan(angle / 2); diameter at depth z: Dc = 2 z tan(angle / 2). Centre drill: z = l + (Dc - d) / (2 tan(angle / 2)), with d the pilot diameter and l the length from the tip to where the countersink cone starts (it includes the pilot\'s own point). Program the Z depth to the tool tip; a tip with a flat or radius cuts slightly larger at the same depth. Right-triangle geometry of a cone, as in the Drill point length tool.';
      return;
    }
    // Standard centre drill from the table
    const fam = m.fam, F = C.families[fam], r = F.find(x => x.size === m.size), inch = fam.startsWith('inch');
    const toMm = v => inch ? v * IN_MM : v, srcs = C.sources, ang = +m.ang;
    const val = f => r[f] ? toMm(r[f].value) : NaN;
    const ev = c => badge(c.status) + ' <span class="ms" title="' + rEsc(groupsTitle(srcs, c.groups.map(g => ({ value: inch ? g.value : g.value, publishers: g.publishers })))) + '">' + c.groups.map((g, i) => (i ? '; ' : '') + (c.groups.length > 1 ? (inch ? fx(g.value, 4) + ' in' : g.value + ' mm') + ': ' : '') + g.publishers.map(p => rEsc(pubName(srcs, p))).join(', ')).join('') + '</span>';
    const dimRows = Object.keys(CD_FIELD).filter(f => r[f]).map(f => '<tr><td>' + CD_FIELD[f] + '</td><td class="v">' + len(val(f)) + '</td><td>' + ev(r[f]) + '</td></tr>').join('') +
      '<tr><td>Included countersink angle</td><td class="v">' + ang + '°</td><td><span class="ms">' + (fam === 'iso2540_b' ? 'with a 120° protecting chamfer beyond d2' : fam === 'inch_bell' ? 'with a 120° bell chamfer beyond the bell diameter' : fam === 'iso2541_r' ? 'radius form: the profile is an arc, not a cone' : '') + '</span></td></tr>';
    const dp = val('pilot');
    const maxDc = fam === 'inch_bell' ? val('bell') : fam === 'iso2540_b' ? val('cone') : val('body');
    const ls = fam.startsWith('inch') ? [['', val('pilot_len')]] : [['smallest pilot length', val('l_min')], ['largest pilot length', val('l_max')]].filter(x => isFinite(x[1]));
    const dc = fromUser(dcU), z = fromUser(zU), dh = fromUser(dhU), res = [];
    if (fam === 'iso2541_r') {
      res.push(['Depth for a countersink diameter', 'Not worked out for the radius form: the arc touches a 60° lathe centre along a line, and the free sources do not give where the arc starts. Use the tool maker\'s drawing.']);
    } else if (!(dp > 0) || !ls.length) {
      res.push(['Depth', 'This size has no pilot length in the sources in hand.']);
    } else {
      res.push(['Largest countersink this size can make', len(maxDc)]);
      ls.forEach(([lab, l]) => res.push(['Depth to that largest countersink' + (lab ? ' <span class="ms">(' + lab + ')</span>' : ''), len(W.centre_drill_depth(maxDc, dp, l, ang))]));
      if (dc > 0) {
        if (dc < dp) res.push(['Depth from the tip', 'Countersink smaller than the pilot']);
        else {
          ls.forEach(([lab, l]) => res.push(['<b>Depth from the tip</b>' + (lab ? ' <span class="ms">(' + lab + ' ' + fLen(l) + ' ' + uLen() + ')</span>' : ''), '<b>' + len(W.centre_drill_depth(dc, dp, l, ang)) + '</b>']));
          if (dc > maxDc * (1 + 1e-9)) res.push(['Check', '<span class="warn">Larger than this size can cut (' + fLen(maxDc) + ' ' + uLen() + '): choose a bigger size</span>']);
          const pt = W.drill_point_length(dp, inch ? 118 : 120);
          res.push(['If the maker\'s pilot length leaves out the pilot\'s point (' + (inch ? 118 : 120) + '°), add', len(pt)]);
        }
      }
      if (z > 0) ls.forEach(([lab, l]) => { const d = W.centre_drill_dia(z, dp, l, ang); res.push(['Countersink diameter at that depth' + (lab ? ' <span class="ms">(' + lab + ')</span>' : ''), isFinite(d) ? len(Math.min(d, maxDc)) + (d > maxDc ? ' <span class="warn">past the end of the countersink</span>' : '') : 'Depth does not reach the countersink']); });
      if (dh > 0 && dc > dh) res.push(['Chamfer width on the hole (each side)', len((dc - dh) / 2)]);
      svg = mtSpotSvg(2, dc > dp ? Math.min(dc, maxDc) : maxDc, ang, dp, ls[0][1]);
    }
    out.innerHTML = '<div class="res mtab"><div class="h">' + rEsc((CD_FAMS.find(f => f[0] === fam) || [])[1] || '') + ', size ' + rEsc(m.size) + '</div><table><tr><th>Dimension</th><th style="text-align:right">Value</th><th>Evidence</th></tr>' + dimRows + '</table></div>' +
      '<div class="res" style="margin-top:12px"><div class="h">Depth</div><table>' + res.map(x => '<tr><td>' + x[0] + '</td><td class="v">' + x[1] + '</td></tr>').join('') + '</table></div>';
    dia.innerHTML = svg;
    note.innerHTML = '<b>Working:</b> depth from the tip z = l + (Dc - d) / (2 tan(angle / 2)), with d the pilot diameter and l the pilot length, taken as measured from the tip to where the countersink cone starts. The free sources do not draw where the pilot length is measured from; if your maker measures only the parallel part, add the point length shown. Metric types A and B give the pilot length as a range (smallest and largest), so the depth is shown for both. The countersink cannot be larger than the body (plain type, type A), the bell diameter (bell type) or d2 (type B). The radius form (type R) is listed for its sizes only. Program the Z depth to the tool tip and check the first part.<br>' +
      '<b>Evidence:</b> Confirmed = two or more independent publishers print the same value; One source = a single publisher so far (the type B and type R tables are read from the public preview of the ISO standard only). Inch: ICS Cutting Tools, Greenfield (Cleveland), Michigan Drill and Linear Tools for the plain type; Greenfield, Exact Tooling, Michigan Drill and Linear Tools for the bell type. Linear Tools (UK) prints longer pilot lengths than the US makers for every inch size; they are shown as a differing source, not used. Sizes #00 and #0: ICS and Greenfield print different pilot lengths. Metric type A: ZPS-FN and Linear Tools. Standards cited by name: ISO 866:2016 (type A), ISO 2540:2016 (type B), ISO 2541:2016 (type R), DIN 333:1986.<br><b>Sources:</b><br>' + sourceList(srcs);
  }
  draw();
}

// ------------------------------------------------------------------ thread data
async function renderThreadData(el) {
  const R = await loadRef(el); if (!R) return;
  const W = state.W, opts = threadOptions(R), T = R.threads;
  const m = RMEM.thd || (RMEM.thd = { key: 'M10x1.5', d: 10, p: 1.5, int: 0 });
  el.innerHTML = '<div class="grid" style="max-width:760px"><label class="f"><span>Thread</span><div class="row"><select id="hk">' + threadSelect(opts, m.key) + '</select></div></label>' +
    '<label class="f cust"><span>Major diameter</span><div class="row"><input id="hd" type="number" step="any"><span class="u">' + uLen() + '</span></div></label>' +
    '<label class="f cust"><span>Pitch' + (inMode() ? ' (threads per inch)' : '') + '</span><div class="row"><input id="hp" type="number" step="any"><span class="u">' + (inMode() ? 'TPI' : 'mm') + '</span></div></label>' +
    '<label class="f cust"><span>Thread system (for tolerances)</span><div class="row"><select id="hs"><option value="metric">ISO metric</option><option value="unified">Unified inch</option></select></div></label></div>' +
    '<div class="thhist" id="hhist"></div><div id="hres"></div><div class="thgo" id="hgo"></div><div class="note"><b>Working:</b> Basic profile (ISO 68-1:2023, ASME B1.1-2024): H = 0.866025 P; pitch diameter d2 = D - 0.649519 P; basic minor diameter D1 = D - 1.082532 P (internal thread); ISO external minor diameter d3 = D - 1.226869 P (rounded root used for tolerancing). ' +
    'ISO metric tolerances from the ISO 965-1 formulas: Td2(6) = 90 P^0.4 d^0.1 (d = geometric mean of the diameter step), TD2 = 1.32 Td2(6), Td(6) = 180 P^(2/3) - 3.15 P^(-1/2), TD1(6) = 230 P^0.7 (P >= 1 mm) or 433 P - 190 P^1.22, es(g) = -(15 + 11 P), each rounded to the R40 series. The standard\'s own tables (ISO 965-2/-3) are normative and differ from these formulas by one R40 step for some sizes (found for M3, M10, M20, M36, M39, M42 against published tables); BenchMate shows published limits where two publishers print them and marks computed ones. ISO 965-1 was revised in 2026 (ISO 965-1:2026); the formulas here were checked against tables published under the 2013 and earlier editions. ' +
    'Unified: PD tolerance 2A = 0.0015 D^(1/3) + 0.0015 sqrt(LE) + 0.015 P^(2/3) with LE = D (reproduces all 30 class 2A rows checked in a published table), 1A 1.5x, 3A 0.75x, 1B 1.95x, 2B 1.3x, 3B 0.975x; allowance 1A/2A = 0.3 x Td2(2A), 3A/3B none; major tolerance 2A/3A = 0.060 P^(2/3); rounded to 0.0001 in. Class 2B minor diameter limits are computed (rule in the table note); 1B and 3B minor limits are not. TD2 of internal classes is the factor times the unrounded 2A tolerance, then rounded, which is the order that reproduces the published 2B table.<br><b>Sources:</b> thread series and limits as listed below; formulas: ISO 68-1:2023, ISO 965-1:2013/2026 (formula clause), ASME B1.1-2024 (Table 4 title gives the 2A formula).</div><div class="note" id="hsrc"></div>';
  const k = $('#hk', el), hd = $('#hd', el), hp = $('#hp', el), hs = $('#hs', el);
  function setCustom() {
    const c = k.value === 'custom';
    el.querySelectorAll('.cust').forEach(x => x.style.display = c ? '' : 'none');
    hd.value = +toUser(m.d).toFixed(inMode() ? 4 : 3); hp.value = inMode() ? +(IN_MM / m.p).toFixed(3) : +m.p.toFixed(4);
    hs.value = m.sys || 'metric';
  }
  // A small copy button for one value: copies the number as shown, without its unit.
  const cpy = (txt, what) => { const t = rEsc(what || 'Copy ' + txt); return '<button type="button" class="cpy" data-copy="' + rEsc(txt) + '" title="' + t + '" aria-label="' + t + '">' + icon('copy') + '</button>'; };
  // Rows with several values (the class tables) copy the whole row, tab separated, for a spreadsheet.
  const cpyRow = (name, vals) => cpy(vals.join('\t'), 'Copy the ' + name + ' row (tab separated)');
  function row(label, mm, extra) { return '<tr><td>' + label + (extra || '') + '</td><td class="v">' + fBoth(mm) + cpy(fLen(mm)) + '</td></tr>'; }
  // Recent threads (last 10 looked up, newest first), kept in this browser. Sizes in mm.
  const histKey = t => t.key && t.key !== 'custom' ? t.key : 'custom:' + (+t.d.toFixed(4)) + 'x' + (+t.p.toFixed(5)) + ':' + t.sys;
  const histLabel = t => { const o = t.key !== 'custom' && opts.find(x => x.key === t.key); return o ? o.label : fLen(t.d) + ' ' + uLen() + ' x ' + (t.sys === 'unified' || inMode() ? fx(IN_MM / t.p, 2) + ' TPI' : fx(t.p, 3) + ' mm') + ' (other)'; };
  const hist = () => { const h = lsJson('bm.thrhist', []); return Array.isArray(h) ? h.filter(t => t && t.d > 0 && t.p > 0) : []; };
  function remember(t) {
    const id = histKey(t);
    lsPut('bm.thrhist', [{ key: t.key, d: t.d, p: t.p, sys: t.sys }].concat(hist().filter(x => histKey(x) !== id)).slice(0, 10));
    drawHist();
  }
  function drawHist() {
    const box = $('#hhist', el), h = hist();
    box.innerHTML = h.length ? '<span class="ms">Recent threads</span><div class="fchips">' + h.map((t, i) => '<button type="button" class="fchip" data-i="' + i + '">' + rEsc(histLabel(t)) + '</button>').join('') +
      '<button type="button" class="btn sm thclr" title="Clear the recent threads">' + icon('trash') + '<span>Clear</span></button></div>' : '';
    box.querySelectorAll('.fchip').forEach(b => b.onclick = () => {
      const t = h[+b.dataset.i]; if (!t) return;
      const std = t.key && t.key !== 'custom' && opts.find(o => o.key === t.key);
      m.d = t.d; m.p = t.p; m.sys = t.sys; k.value = std ? std.key : 'custom';
      setCustom(); upd(); remember(t);
    });
    const clr = $('.thclr', box); if (clr) clr.onclick = () => { lsPut('bm.thrhist', []); drawHist(); };
  }
  let cur = null;   // the thread on screen: { key, d, p, sys, tpi, label }
  function upd() {
    m.key = k.value;
    let sel = opts.find(o => o.key === k.value), d, p, sys, tpi;
    if (sel) { d = sel.d; p = sel.p; sys = sel.sys; tpi = sel.tpi; m.d = d; m.p = p; }
    else { d = fromUser(parseFloat(hd.value)); const pv = parseFloat(hp.value); p = inMode() ? IN_MM / pv : pv; tpi = inMode() ? pv : undefined; sys = hs.value; m.sys = sys; if (d > 0 && p > 0) { m.d = d; m.p = p; } }
    const out = $('#hres', el);
    cur = null; drawGo();
    if (!(d > 0 && p > 0 && p < d)) { out.innerHTML = '<div class="res"><table><tr><td class="warn">Enter the thread size.</td></tr></table></div>'; return; }
    cur = { key: sel ? sel.key : 'custom', d, p, sys, tpi, label: sel ? sel.label : histLabel({ key: 'custom', d, p, sys }).replace(' (other)', '') };
    drawGo();
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
          return '<td class="v">' + fBoth(pub.value) + cpy(fLen(pub.value)) + '</td><td>' + badge('confirmed') + ' <span class="ms" title="' + rEsc(groupsTitle(T.sources, pub.groups)) + '">published by ' + pubs(pub.groups[0]) + '</span>' +
            (same ? ' <span class="ms">= formula</span>' : ' <span class="warn">formula gives ' + fLen(mm) + '</span>') + '</td>';
        }
        let s = '<td class="v">' + fBoth(mm) + cpy(fLen(mm)) + '</td><td><span class="ms">' + (note || 'computed from the formulas') + '</span>';
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
        extC.map(([n, g, pos]) => { const v = [0, 1, 2, 3].map(i => W.iso965_limit(d, p, g, pos, i)); return '<tr><td><b>' + n + '</b>' + cpyRow(n, v.map(x => isFinite(x) ? fLen(x) : '-')) + '</td>' + v.map(mmv).join('') + '</tr>'; }).join('') +
        '<tr><td class="ms">Internal</td><td class="ms">Pitch min</td><td class="ms">Pitch max</td><td class="ms">Minor min</td><td class="ms">Minor max</td></tr>' +
        intC.map(([n, g, pos]) => { const v = [3, 2, 5, 4].map(i => W.iso965_limit(d, p, g, pos, i)); return '<tr><td><b>' + n + '</b>' + cpyRow(n, v.map(x => isFinite(x) ? fLen(x) : '-')) + '</td>' + v.map(mmv).join('') + '</tr>'; }).join('') +
        '</table></div><p class="desc">Major tolerance for 4h uses grade 4 (Td(4)); 6e, 6f, 6h use grade 6; 8g uses grade 8. 5H and 7H minor tolerances use TD1 of grades 5 and 7.</p>';
    } else {
      const din = d / IN_MM, pin = p / IN_MM, cls = [[2, '2A', 'checked'], [3, '3A', ''], [1, '1A', ''], [12, '2B', 'checked'], [13, '3B', ''], [11, '1B', '']];
      h += '<div class="res" style="margin-top:12px"><div class="h">Unified classes (computed from ASME B1.1-2024 formulas, inch, rounded as tabulated)</div><table><tr><td class="ms">Class</td><td class="ms">Major max</td><td class="ms">Major min</td><td class="ms">Pitch max</td><td class="ms">Pitch min</td><td class="ms">Minor max</td><td class="ms">Minor min</td><td class="ms">Allowance</td></tr>' +
        cls.map(([c, n, chk]) => { const L = w => W.un_limit(din, pin, c, w); const ext = c < 10;
          const t = v => isFinite(v) ? (inMode() ? v.toFixed(4) : (v * IN_MM).toFixed(3)) : '-', f = v => '<td class="mv">' + t(v) + '</td>';
          const vals = [ext ? L(0) : NaN, L(1), L(2), L(3), c === 12 ? L(7) : NaN, c === 12 ? L(6) : NaN, ext ? L(5) : 0];
          return '<tr><td><b>' + n + '</b>' + cpyRow(n, vals.map(t)) + (chk ? ' ' + badge('confirmed') : ' <span class="ms">not checked</span>') + '</td>' + vals.map(f).join('') + '</tr>'; }).join('') +
        '</table></div><p class="desc">Values in ' + (inMode() ? 'inch' : 'mm (converted from the inch limits)') + '. "Confirmed": the formulas reproduce a published class 2A table (30 rows) and class 2B table (74 rows: pitch and minor limits; exceptions listed in the tests); 1A, 3A, 1B and 3B use the standard\'s class factors but have not been compared with a published table. ' +
        'Internal minor limits (2B): minimum = basic minor diameter; tolerance 0.25 P - 0.40 P^2 for 1/4 in and larger, 0.05 P^(2/3) + 0.03 P / D - 0.002 (kept between 0.120 P and 0.394 P) below 1/4 in. 1B and 3B minor limits are not computed. Internal major minimum = basic major diameter.</p>';
    }
    out.innerHTML = h;
  }
  // Open a program generator with this thread: major diameter and pitch in the units on screen.
  function drawGo() {
    const box = $('#hgo', el);
    if (!cur) { box.innerHTML = ''; return; }
    box.innerHTML = '<div class="f"><span>Use this thread in a program</span><div class="row thgor"><div class="seg" id="hint" role="group" aria-label="Internal or external thread">' +
      [[0, 'External'], [1, 'Internal']].map(([v, t]) => '<button type="button" data-v="' + v + '"' + (+m.int === v ? ' class="on" aria-pressed="true"' : ' aria-pressed="false"') + '>' + t + '</button>').join('') + '</div>' +
      '<button type="button" class="btn" id="hgomill">Thread mill this</button><button type="button" class="btn" id="hgolathe">Lathe G76 for this</button></div></div>';
    box.querySelectorAll('#hint button').forEach(b => b.onclick = () => { m.int = +b.dataset.v; drawGo(); });
    const vals = () => ({ dia: toUser(cur.d), pitch: toUser(cur.p), tpi: cur.sys === 'unified' && cur.tpi > 0 ? cur.tpi : undefined, internal: +m.int === 1, label: cur.label + (+m.int === 1 ? ' internal' : ' external') });
    $('#hgomill', box).onclick = () => { remember(cur); handoff('cyctmill', vals()); };
    $('#hgolathe', box).onclick = () => { remember(cur); handoff('cycthread', vals()); };
  }
  $('#hsrc', el).innerHTML = '<b>Thread series and published limits</b><br>' + sourceList(T.sources);
  $('#hres', el).addEventListener('click', e => { const b = e.target.closest('button.cpy'); if (b) copyText(b.dataset.copy); });
  // A thread counts as looked up when it is picked, or when a typed size is finished (change, not every key).
  const look = () => { if (cur) remember(cur); };
  k.onchange = () => { setCustom(); upd(); look(); }; hd.oninput = upd; hp.oninput = upd; hs.onchange = () => { upd(); look(); };
  hd.onchange = look; hp.onchange = look;
  setCustom(); upd(); drawHist();
}

// ------------------------------------------------------------------ ISO limits and fits
const SHAFT_LETTERS = ['a', 'b', 'c', 'cd', 'd', 'e', 'ef', 'f', 'fg', 'g', 'h', 'j', 'js', 'k', 'm', 'n', 'p', 'r', 's', 't', 'u', 'v', 'x', 'y', 'z', 'za', 'zb', 'zc'];
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
  // ISO 286-1: k is 0 above 500 mm (its formula 0.6 D^(1/3) applies up to 500 mm only)
  if (letter === 'k' && sizeMm > 500) { const st = iso286Step(I, sizeMm, false); return st ? { v: 0, c: { status: 'rule', groups: [] }, st } : null; }
  const sub = I.sub_letters.includes(letter);
  const st = iso286Step(I, sizeMm, sub); if (!st) return null;
  const c = (I.shaft[letter] || {})[st.key]; return c ? { v: c.value, c, st } : null;
}
// j and J are tabulated per class (j5, j6, j7; J6, J7, J8 in ISO 286-2), no fundamental deviation rule.
function iso286JClass(I, W, sizeMm, grade, hole, it) {
  const name = (hole ? 'J' : 'j') + grade, tab = (hole ? I.j_hole : I.j_shaft)[name];
  if (!tab) return { err: name + ' is not tabulated: ISO 286-2 gives ' + (hole ? 'J6, J7 and J8' : 'j5, j6 and j7') + ' (use JS/js for other grades).' };
  const st = iso286Step(I, sizeMm, false), c = st && tab[st.key];
  if (!c) return { err: name + ' is not tabulated for ' + rEsc(fx(sizeMm, 1)) + ' mm in the sources read (j/J are not defined above 500 mm).' };
  const h = hole ? 1 : 0;
  return { up: W.iso286_j_limit(c.value, it.v, h, 0), lo: W.iso286_j_limit(c.value, it.v, h, 1), it, fd: { v: c.value, c, st } };
}
function iso286Class(I, W, sizeMm, letter, grade, hole) {
  const l = letter.toLowerCase(), code = LETTER_CODE[l];
  const it = iso286It(I, sizeMm, grade); if (!it) return { err: 'No IT' + grade + ' value for this size' + (sizeMm > 500 && grade < 1 ? ' (IT01 and IT0 are not defined above 500 mm).' : '.') };
  if (l === 'j') return iso286JClass(I, W, sizeMm, grade, hole, it);
  if (hole && sizeMm > 500 && ['k', 'm', 'n'].includes(l) && grade > 8) return { err: letter.toUpperCase() + grade + ': above 500 mm BenchMate shows K, M and N only up to IT8 (the hole table column read).' };
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
    '<label class="f"><span>Nominal size (up to 3150 mm)</span><div class="row"><input id="fs" type="number" step="any"><span class="u">' + uLen() + '</span></div></label>' +
    '<label class="f"><span>Hole: letter and grade</span><div class="row"><select id="fhl">' + letterOpts(m.hl, true) + '</select><select id="fhg">' + gradeOpts(m.hg) + '</select></div></label>' +
    '<label class="f"><span>Shaft: letter and grade</span><div class="row"><select id="fsl">' + letterOpts(m.sl, false) + '</select><select id="fsg">' + gradeOpts(m.sg) + '</select></div></label>' +
    '<label class="f"><span>Common fits</span><div class="row"><select id="fpre"><option value="">Choose...</option>' +
    ['H11/c11', 'H9/d9', 'H8/f7', 'H7/g6', 'H7/h6', 'H7/k6', 'H7/n6', 'H7/p6', 'H7/s6', 'H7/u6', 'C11/h11', 'F8/h7', 'G7/h6', 'K7/h6', 'N7/h6', 'P7/h6', 'S7/h6'].map(f => '<option>' + f + '</option>').join('') + '</select></div></label></div>' +
    '<div id="fres"></div><div class="note"><b>Working:</b> Limits of a class = fundamental deviation and the IT value of the grade. Shafts a to h: es = deviation, ei = es - IT; k to zc: ei = deviation, es = ei + IT; js: +/- IT/2. k uses its IT4 to IT7 value for grades 4 to 7 and 0 otherwise. Holes (ISO 286-1): A to H: EI = -es of the same shaft letter; K, M, N up to IT8 and P to ZC up to IT7: ES = -ei + delta, delta = IT(n) - IT(n-1) for the size step (no delta up to 3 mm); K above IT8: ES = 0; M above IT8: ES = -ei; N above IT8: ES = 0; M6 over 250 to 315 mm: ES = -9 um (the standard\'s exception). Fit: maximum clearance = ES - ei, minimum clearance = EI - es; negative clearance is interference. ' +
    'The IT values and shaft deviations come from published tables (two or more publishers), not from the formulas: ISO 286-1:2010 tabulates them, and its tables depart from the annex formulas in places (sizes to 3 mm, IT1 to IT4, letters a, b, c and t to zc in small sizes, and 10 IT5 to IT10 cells). The formula value is shown alongside for comparison. Over 500 to 3150 mm: IT1 to IT18 = multiplier x I, I = 0.004 D + 2.1 um (IT1 2, IT2 2.7, IT3 3.7, IT4 5, then as below 500 mm); shaft d, e, f, g, h, js, k (0), m, n, p, r, s, t, u only; holes follow the general rule with no delta (ES = -ei for K to U); one table each was read (Wikipedia for IT, GOST 25346 for deviations), and the annex formulas reproduce every value within the rounding (marked "One table, formula agrees"). j and J have no formula: j5, j6, j7 (lower deviation ei) and J6, J7, J8 (upper deviation ES) are tabulated per class (ISO 286-2), es = ei + IT and EI = ES - IT; read from Simply Bearings, RoyMech (compared, not republished) and GOST 25346. js7 to js11: older practice (ISO 286-1:1988, still printed in JIS tables) allowed rounding an odd IT to the even number below; BenchMate shows the exact +/- IT/2 as ISO 286-2:2010 prints it.<br><b>Sources:</b> ISO 286-1:2010 (Cor 1:2013) rules, clause on holes; tables as listed below.</div><div class="note" id="fsrc"></div>';
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
    if (size > 3150) { out.innerHTML = '<div class="res"><table><tr><td class="warn">ISO 286-1 covers sizes up to 3150 mm.</td></tr></table></div>'; return; }
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
      const itf = size > 500 ? W.iso286_it_formula_large(dm, g) : W.iso286_it_formula(dm, g);
      cmp.push('IT' + g + ' (' + st.key + ' mm): table ' + um(c.it.v) + ' um, formula ' + fx(itf, 1) + ' um');
      if (!['h', 'js', 'j'].includes(l) && !(l === 'k' && size > 500)) {
        const fst = c.fd.st, fdm = W.iso286_step_mean(fst.lo, fst.hi);
        const gi = n => (iso286It(I, size, n) || {}).v;
        const pd = (iso286ShaftFd(I, size, 'p') || {}).v;
        const ff = size > 500 ? W.iso286_shaft_fd_formula_large(LETTER_CODE[l], fdm, gi(7), pd) : W.iso286_shaft_fd_formula(LETTER_CODE[l], fdm, gi(6), gi(7), gi(8), gi(9), gi(10));
        if (isFinite(ff)) cmp.push('shaft ' + l + ' deviation (' + fst.key + ' mm): table ' + um(c.fd.v) + ' um, formula ' + fx(ff, 1) + ' um' + (['p', 's', 'r'].includes(l) && size <= 50 ? ' (formula gives a range here)' : ''));
      }
    });
    h += '<p class="desc">' + cmp.map(rEsc).join('; ') + '.</p>';
    // IT grade table for this size
    const st = iso286Step(I, size, false);
    const its = st ? Object.keys(I.it).filter(g => I.it[g][st.key]) : [];
    if (st) h += '<div class="res mtab" style="margin-top:12px"><div class="h">Standard tolerances for ' + st.key + ' mm (um)</div><table><tr>' + its.map(g => '<th>' + g + '</th>').join('') + '</tr><tr>' +
      its.map(g => { const c = I.it[g][st.key]; return '<td class="mv" title="' + rEsc(groupsTitle(I.sources, c.groups)) + '">' + um(c.value) + (c.status === 'confirmed' ? '' : '<div>' + badge(c.status) + '</div>') + '</td>'; }).join('') + '</tr></table></div>';
    out.innerHTML = h;
  }
  fpre.onchange = () => { const v = fpre.value; if (!v) return; const [a, b] = v.split('/'); const pa = a.match(/^([A-Z]+)(\d+)$/), pb = b.match(/^([a-z]+)(\d+)$/); fhl.value = pa[1].toLowerCase(); fhg.value = pa[2]; fsl.value = pb[1]; fsg.value = pb[2]; upd(); };
  $('#fsrc', el).innerHTML = '<b>Table sources</b><br>' + sourceList(I.sources);
  [fs, fhl, fhg, fsl, fsg].forEach(x => { x.oninput = upd; x.onchange = upd; });
  upd();
}
