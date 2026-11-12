'use strict';
// Reference data tools, round 2: pipe threads (BSP, NPT), Whitworth and BA
// threads, machine tapers. Uses the helpers in refdata.js (loadRef, badge,
// fBoth, RMEM ...). Series values come from data/refdata.json with their
// publisher consensus; dimensions that follow from a formula are computed by
// the Rust core (state.W).

// A published value with its evidence: value as the result, badge, publishers on hover.
function pubCell(srcs, c, show) {
  if (!c) return '<td class="v">-</td><td></td>';
  const pubs = c.groups.map(g => g.value + ': ' + g.publishers.map(p => pubName(srcs, p)).join(', ')).join(' | ');
  const alt = c.groups.length > 1 ? ' <span class="ms">also printed: ' + c.groups.slice(1).map(g => rEsc(g.printed[0]) + ' (' + g.publishers.map(p => rEsc(pubName(srcs, p))).join(', ') + ')').join('; ') + '</span>' : '';
  return '<td class="v">' + show(c.value) + '</td><td title="' + rEsc(pubs) + '">' + badge(c.status) + ' <span class="ms">' + c.groups[0].publishers.map(p => rEsc(pubName(srcs, p))).join(', ') + '</span>' + alt + '</td>';
}
const calcCell = (html, note) => '<td class="v">' + html + '</td><td><span class="ms">' + (note || 'computed') + '</span></td>';
const tpiText = t => (Number.isInteger(t) ? t : +t.toFixed(3)) + ' TPI';
const rowsHtml = rows => rows.map(([lab, cells]) => '<tr><td>' + lab + '</td>' + cells + '</tr>').join('');

// ------------------------------------------------------------------ pipe threads
async function renderPipeThreads(el) {
  const R = await loadRef(el); if (!R) return;
  const W = state.W, O = R.other_threads, m = RMEM.pipe || (RMEM.pipe = { sys: 'bsp', size: '1/2' });
  el.innerHTML = '<div class="grid" style="max-width:760px"><label class="f"><span>Thread</span><div class="row"><select id="ps"><option value="bsp">BSP: G (ISO 228-1) and R / Rp / Rc (ISO 7-1)</option><option value="npt">NPT (ASME B1.20.1)</option></select></div></label>' +
    '<label class="f"><span>Nominal size</span><div class="row"><select id="pz"></select></div></label></div><div id="pres"></div>' +
    '<div class="note"><b>Working:</b> BSP (G parallel and R taper) uses the 55 degree Whitworth form: H = 0.960491 P, thread depth h = 0.640327 P, crest and root radius r = 0.137329 P; pitch diameter = D - h, minor diameter = D - 2h. ISO 228-1 (G, parallel, joint not made on the thread) and ISO 7-1 (R external taper, Rc internal taper, Rp internal parallel; pressure-tight joint made on the thread) share the sizes and basic diameters; for ISO 7-1 the basic diameters apply at the gauge plane and the taper is 1:16 on diameter. ' +
    'NPT (60 degree, taper 1:16 on diameter): pitch diameter at the small end of the external thread E0 = D - (0.050 D + 1.1) p, D = pipe outside diameter; at the hand-tight plane E1 = E0 + 0.0625 L1 (L1 is a tabulated length); effective thread length L2 = (0.80 D + 6.8) p; truncated thread height h = 0.800 p. The formulas reproduce the published E1 and L2 values (tests in core/src/thread_forms.rs). ' +
    '<br><b>NPTF (Dryseal, ASME B1.20.3-1976, reaffirmed 2023):</b> same sizes, taper, pitch and basic pitch diameters (E0, E1, L1, L2) as NPT, but the crests and roots of both threads are truncated by controlled amounts so that the roots crush the mating crests before the flanks bear, closing the spiral leak path; it seals pressure-tight without tape or compound if both parts are in tolerance and not galled (a compatible lubricant may still be used against galling). Related Dryseal forms: PTF-SAE SHORT (one turn shorter), NPSF (internal straight, fuel) and NPSI (internal straight, intermediate). The truncation limits and the gauging classes are tabulated in the standard and are not given here. Sources: the ASME catalogue page for B1.20.3 and Wikipedia, National pipe thread (accessed 2026-11-11). ' +
    '<br><b>Sources:</b> ISO 228-1:2000 and ISO 7-1:1994 with Cor 1:2007 (dimensions, tolerances and designation), ASME B1.20.1-2013, reaffirmed 2018 (pipe threads, general purpose, inch); series values from the publishers listed below. Older practice: BS 21 (UK) has been replaced by BS EN 10226 / ISO 7-1, and ANSI B2.1-1968 by ASME B1.20.1.</div><div class="note" id="psrc"></div>';
  const ps = $('#ps', el), pz = $('#pz', el);
  function sizes() {
    const list = O[ps.value];
    pz.innerHTML = list.map(r => '<option' + (r.size === m.size ? ' selected' : '') + '>' + rEsc(r.size) + '</option>').join('');
  }
  function upd() {
    m.sys = ps.value; m.size = pz.value;
    const r = O[ps.value].find(x => x.size === pz.value); if (!r) return;
    const tpi = r.tpi.value;
    let h;
    if (ps.value === 'bsp') {
      const D = r.major_mm ? r.major_mm.value : NaN, P = 25.4 / tpi;
      h = '<div class="res"><div class="h">G ' + rEsc(r.size) + ' / R ' + rEsc(r.size) + '</div><table>' + rowsHtml([
        ['Threads per inch', pubCell(O.sources, r.tpi, v => tpiText(v))],
        ['Pitch P', calcCell(fBoth(P), '25.4 / TPI')],
        ['Major diameter D (at the gauge plane for ISO 7-1)', pubCell(O.sources, r.major_mm, v => fBoth(v))],
        ['Pitch diameter D - 0.640327 P', calcCell(fBoth(W.whitworth_value(D, P, 0)))],
        ['Minor diameter D - 1.280654 P', calcCell(fBoth(W.whitworth_value(D, P, 1)))],
        ['Thread depth h = 0.640327 P', calcCell(fBoth(W.whitworth_value(D, P, 2)))],
        ['Crest and root radius r = 0.137329 P', calcCell(fBoth(W.whitworth_value(D, P, 3)))],
        ['ISO 7-1 gauge length (basic)', r.gauge_mm ? pubCell(O.sources, r.gauge_mm, v => fBoth(v)) : calcCell('-', 'not available')],
      ]) + '</table></div>';
    } else {
      const D = r.od.value, p = 1 / tpi, l1 = r.l1 ? r.l1.value : NaN;
      const din = v => fBoth(v * IN_MM);
      const vsF = (c, f, dp) => c ? pubCell(O.sources, c, v => din(v) + (Math.abs(v - f) < 0.6 * Math.pow(10, -dp) ? ' <span class="ms">= formula</span>' : ' <span class="warn">formula ' + f.toFixed(dp) + ' in</span>')) : calcCell(din(f));
      h = '<div class="res"><div class="h">' + rEsc(r.size) + ' NPT</div><table>' + rowsHtml([
        ['Threads per inch', pubCell(O.sources, r.tpi, v => tpiText(v))],
        ['Pitch p', calcCell(din(p), '1 / TPI')],
        ['Pipe outside diameter D', pubCell(O.sources, r.od, din)],
        ['Pitch diameter at small end E0 = D - (0.050 D + 1.1) p', calcCell(din(W.npt_value(r.size === '1/16' ? 0.3125 : D, p, 0, 0)), r.size === '1/16' ? 'computed with D = 0.3125 (printed .313)' : 'computed')],
        ['Hand-tight engagement L1', r.l1 ? pubCell(O.sources, r.l1, din) : calcCell('-', 'not printed')],
        ['Pitch diameter at hand-tight plane E1 = E0 + 0.0625 L1', vsF(r.e1, W.npt_value(r.size === '1/16' ? 0.3125 : D, p, l1, 3), 5)],
        ['Effective thread length L2 = (0.80 D + 6.8) p', vsF(r.l2, W.npt_value(D, p, 0, 1), 4)],
        ['Truncated thread height h = 0.800 p', calcCell(din(W.npt_value(D, p, 0, 2)))],
      ]) + '</table></div>';
    }
    $('#pres', el).innerHTML = h;
  }
  $('#psrc', el).innerHTML = '<b>Series sources</b><br>' + sourceList(O.sources);
  ps.value = m.sys; sizes();
  ps.onchange = () => { m.size = ps.value === 'bsp' ? '1/2' : '1/2'; sizes(); upd(); }; pz.onchange = upd;
  upd();
}

// ------------------------------------------------------------------ Whitworth and BA
async function renderWhitworth(el) {
  const R = await loadRef(el); if (!R) return;
  const W = state.W, O = R.other_threads, m = RMEM.whit || (RMEM.whit = { sys: 'bsw', size: '1/4' });
  el.innerHTML = '<div class="grid" style="max-width:760px"><label class="f"><span>Series</span><div class="row"><select id="ws"><option value="bsw">BSW (British Standard Whitworth)</option><option value="bsf">BSF (British Standard Fine)</option><option value="ba">BA (British Association)</option></select></div></label>' +
    '<label class="f"><span>Size</span><div class="row"><select id="wz"></select></div></label></div><div id="wres"></div>' +
    '<div class="note"><b>Working:</b> BSW and BSF (BS 84): 55 degree thread, H = 0.960491 P, depth h = 0.640327 P, crest and root radius r = 0.137329 P; effective (pitch) diameter = D - h, minor diameter = D - 2h. Some tables print D - 2 x (h rounded to 0.0001 in), which differs in the last digit. ' +
    'BA (BS 93): pitch P = 0.9^n mm and major diameter D = 6 P^1.2 mm, both tabulated to two significant figures; 47.5 degree thread, depth 0.6 P, radius 0.18083 P; pitch diameter D - 0.6 P, minor D - 1.2 P. The series values (threads per inch) are checked against two publishers; the dimensions are computed. Whitworth and BA threads are obsolete for new designs (replaced by ISO metric) but still met in repair work.' +
    '<br><b>Sources:</b> BS 84:2007 (parallel screw threads of Whitworth form), BS 93:2008 (British Association screw threads); publishers listed below.</div><div class="note" id="wsrc"></div>';
  const ws = $('#ws', el), wz = $('#wz', el);
  function sizes() {
    const list = O[ws.value] || [];
    wz.innerHTML = list.map(r => '<option value="' + rEsc(r.size) + '"' + (r.size === m.size ? ' selected' : '') + '>' + rEsc(ws.value === 'ba' ? r.size + ' BA' : r.size + '"') + '</option>').join('');
  }
  function upd() {
    m.sys = ws.value; m.size = wz.value;
    const r = (O[ws.value] || []).find(x => x.size === wz.value); if (!r) return;
    let h;
    if (ws.value === 'ba') {
      const n = +r.size, P = W.round_sig(W.ba_value(n, 0), 2), D = W.round_sig(W.ba_value(n, 1), 2);
      h = '<div class="res"><div class="h">' + n + ' BA</div><table>' + rowsHtml([
        ['Pitch P = 0.9^n (two significant figures)', calcCell(fBoth(P), 'formula ' + fx(W.ba_value(n, 0), 4) + ' mm')],
        ['Threads per inch', pubCell(O.sources, r.tpi, v => tpiText(v) + ' <span class="ms">25.4 / P = ' + fx(25.4 / P, 2) + '</span>')],
        ['Major diameter D = 6 P^1.2 (two significant figures)', calcCell(fBoth(D), 'formula ' + fx(W.ba_value(n, 1), 3) + ' mm')],
        ['Pitch diameter D - 0.6 P', calcCell(fBoth(D - 0.6 * P))],
        ['Minor diameter D - 1.2 P', calcCell(fBoth(D - 1.2 * P))],
        ['Thread depth 0.6 P', calcCell(fBoth(0.6 * P))],
      ]) + '</table></div>';
    } else {
      const D = r.size.split(' ').reduce((s, f) => s + (f.includes('/') ? f.split('/')[0] / f.split('/')[1] : +f), 0) * IN_MM, P = IN_MM / r.tpi.value;
      h = '<div class="res"><div class="h">' + rEsc(r.size) + '" ' + ws.value.toUpperCase() + '</div><table>' + rowsHtml([
        ['Threads per inch', pubCell(O.sources, r.tpi, v => tpiText(v))],
        ['Major diameter D', calcCell(fBoth(D), 'nominal size')],
        ['Pitch P', calcCell(fBoth(P), '1 / TPI')],
        ['Effective (pitch) diameter D - 0.640327 P', calcCell(fBoth(W.whitworth_value(D, P, 0)))],
        ['Minor diameter D - 1.280654 P', calcCell(fBoth(W.whitworth_value(D, P, 1)))],
        ['Thread depth h', calcCell(fBoth(W.whitworth_value(D, P, 2)))],
        ['Crest and root radius r', calcCell(fBoth(W.whitworth_value(D, P, 3)))],
      ]) + '</table></div>';
    }
    $('#wres', el).innerHTML = h;
  }
  $('#wsrc', el).innerHTML = '<b>Series sources</b><br>' + sourceList(O.sources);
  ws.value = m.sys; sizes();
  ws.onchange = () => { m.size = ws.value === 'ba' ? '2' : '1/4'; sizes(); upd(); }; wz.onchange = upd;
  upd();
}

// ------------------------------------------------------------------ machine tapers
const TAPER_FAMILIES = {
  morse: { title: 'Morse tapers', fields: [['d_gauge_in', 'Gauge (large end) diameter', 'in'], ['small_in', 'Small end diameter', 'in'], ['length_in', 'Length', 'in'], ['tpf_in', 'Taper per foot', 'tpf']], prefix: 'MT' },
  jacobs: { title: 'Jacobs (drill chuck) tapers', fields: [['large_in', 'Large end diameter', 'in'], ['small_in', 'Small end diameter', 'in'], ['length_in', 'Length', 'in']], prefix: 'JT' },
  jarno: { title: 'Jarno tapers', fields: [['large_in', 'Large end diameter', 'in'], ['small_in', 'Small end diameter', 'in'], ['length_in', 'Length', 'in'], ['tpf_in', 'Taper per foot', 'tpf']], prefix: 'No.' },
  brownsharpe: { title: 'Brown & Sharpe tapers', fields: [['large_in', 'Large end diameter', 'in'], ['small_in', 'Small end diameter', 'in'], ['length_in', 'Length', 'in'], ['tpf_in', 'Taper per foot', 'tpf']], prefix: 'No.' },
  steep724: { title: '7:24 steep tapers (ISO 7388-1 / SK, BT, CAT)', fields: [], prefix: '' },
  hsk: { title: 'HSK hollow taper shanks (ISO 12164-1), form A', fields: [['d2_mm', 'Taper diameter d2', 'mm'], ['l1_mm', 'Shank length l1', 'mm']], prefix: 'HSK-A' },
  r8: { title: 'R8 collet', fields: [['angle', 'Included angle', 'deg'], ['body_in', 'Body (locating) diameter', 'in'], ['drawbar', 'Drawbar thread', 'text']], prefix: '' },
};

async function renderMachineTapers(el) {
  const R = await loadRef(el); if (!R) return;
  const W = state.W, T = R.tapers; if (!T) { el.textContent = 'Taper data not built.'; return; }
  const m = RMEM.taper || (RMEM.taper = { fam: 'morse' });
  const fams = Object.keys(TAPER_FAMILIES).filter(f => T.families[f] && T.families[f].length);
  el.innerHTML = '<div class="grid" style="max-width:760px"><label class="f"><span>Taper system</span><div class="row"><select id="tf">' + fams.map(f => '<option value="' + f + '">' + rEsc(TAPER_FAMILIES[f].title) + '</option>').join('') + '</select></div></label></div>' +
    '<div id="tres"></div><div class="note" id="tnote"></div><div class="note" id="tsrc"></div>';
  const tf = $('#tf', el); tf.value = fams.includes(m.fam) ? m.fam : fams[0];
  function show(unit, v) {
    if (unit === 'in') return fBoth(v * IN_MM);
    if (unit === 'mm') return fBoth(v);
    if (unit === 'tpf') return '<span class="mv">' + fx(v, 4) + ' in/ft</span><br><span class="ms">included angle ' + fx(W.taper_included_angle_deg(v, 0, 12), 4) + ' deg</span>';
    if (unit === 'deg') return '<span class="mv">' + fx(v, 2) + ' deg</span>';
    return rEsc(v);
  }
  function upd() {
    m.fam = tf.value;
    const F = TAPER_FAMILIES[tf.value], rows = T.families[tf.value];
    const fields = F.fields.length ? F.fields : (T.notes['fields_' + tf.value] || []);
    const cell = (c, unit) => {
      if (!c) return '<td class="v">-</td>';
      const pubs = c.groups.map(g => g.value + ': ' + g.publishers.map(p => pubName(T.sources, p)).join(', ')).join(' | ');
      const alt = c.groups.length > 1 ? '<br><span class="ms">also ' + c.groups.slice(1).map(g => rEsc(g.printed[0])).join(', ') + '</span>' : '';
      const val = unit === 'text' ? rEsc(c.groups[0].printed[0]) : show(unit, c.value);
      return '<td class="v" title="' + rEsc(pubs) + '">' + val + '<br>' + badge(c.status) + alt + '</td>';
    };
    $('#tres', el).innerHTML = '<div class="res mtab"><table><tr><th>Size</th>' + fields.map(f => '<th>' + rEsc(f[1]) + '</th>').join('') + '</tr>' +
      rows.map(r => '<tr><td style="white-space:nowrap"><b>' + rEsc((F.prefix ? F.prefix + ' ' : '') + r.size) + '</b></td>' + fields.map(f =>
        f[2] === 'auto' ? (r[f[0] + '_in'] ? cell(r[f[0] + '_in'], 'in') : cell(r[f[0] + '_mm'], 'mm')) : cell(r[f[0]], f[2])).join('') + '</tr>').join('') + '</table></div>';
    $('#tnote', el).innerHTML = (T.notes[tf.value] || '');
  }
  $('#tsrc', el).innerHTML = '<b>Sources</b><br>' + sourceList(T.sources);
  tf.onchange = upd; upd();
}

// ------------------------------------------------------------------ sheet metal and wire gauges
const GAUGE_FAMILIES = {
  sheet: { title: 'Sheet metal gauges', fields: [['steel_in', 'Steel sheet (Manufacturers\' Standard)'], ['galv_in', 'Galvanized steel'], ['stainless_in', 'Stainless steel'], ['alu_in', 'Aluminium (Brown & Sharpe)'], ['usstd_in', 'US Standard gauge']] },
  wire: { title: 'Wire gauges', fields: [['awg', 'AWG (American, Brown & Sharpe)'], ['swg_in', 'SWG (British Standard)'], ['tube_in', 'Steel tube wall and strip']] },
};
// Gauge label to the n of the AWG rule: 0 is 0, 2/0 is -1, 3/0 is -2, 4/0 is -3. The diameter itself comes from the core.
const awgN = size => { const m = /^(\d)\/0$/.exec(size); return m ? 1 - Number(m[1]) : Number(size); };

async function renderGauges(el) {
  const R = await loadRef(el); if (!R) return;
  const W = state.W, G = R.gauges; if (!G) { el.textContent = 'Gauge data not built.'; return; }
  const m = RMEM.gauges || (RMEM.gauges = { fam: 'sheet' });
  const fams = Object.keys(GAUGE_FAMILIES).filter(f => G.families[f] && G.families[f].length);
  el.innerHTML = '<div class="grid" style="max-width:760px"><label class="f"><span>Gauge system</span><div class="row"><select id="gf">' + fams.map(f => '<option value="' + f + '">' + rEsc(GAUGE_FAMILIES[f].title) + '</option>').join('') + '</select></div></label></div>' +
    '<div id="gres"></div><div class="note" id="gnote"></div><div class="note" id="gsrc"></div>';
  const gf = $('#gf', el); gf.value = fams.includes(m.fam) ? m.fam : fams[0];
  function upd() {
    m.fam = gf.value;
    const F = GAUGE_FAMILIES[gf.value], rows = G.families[gf.value];
    const cell = c => {
      if (!c) return '<td class="v">-</td>';
      const alt = c.groups.length > 1 ? '<br><span class="ms">also ' + c.groups.slice(1).map(g => rEsc(g.printed[0])).join(', ') + '</span>' : '';
      return '<td class="v" title="' + rEsc(groupsTitle(G.sources, c.groups)) + '">' + fBoth(c.value * IN_MM) + '<br>' + badge(c.status) + alt + '</td>';
    };
    const awg = size => {
      const d = W.awg_dia_in(awgN(size));
      return Number.isFinite(d) && awgN(size) <= 40 ? '<td class="v">' + fBoth(d * IN_MM) + '<br><span class="ms">by the rule</span></td>' : '<td class="v">-</td>';
    };
    $('#gres', el).innerHTML = '<div class="res mtab"><table><tr><th>Gauge</th>' + F.fields.map(f => '<th>' + rEsc(f[1]) + '</th>').join('') + '</tr>' +
      rows.map(r => '<tr><td style="white-space:nowrap"><b>' + rEsc(r.size) + '</b></td>' + F.fields.map(f => f[0] === 'awg' ? awg(r.size) : cell(r[f[0]])).join('') + '</tr>').join('') + '</table></div>';
    $('#gnote', el).innerHTML = rEsc(G.notes[gf.value] || '');
  }
  $('#gsrc', el).innerHTML = '<b>Sources</b><br>' + sourceList(G.sources) + '<br>AWG rule: Wikipedia, American wire gauge (after ASTM B258); RapidTables, wire gauge chart; Omni Calculator, wire gauge.';
  gf.onchange = upd; upd();
}
