'use strict';
// Material equivalents screen (data/materials.json), with what each source prints.
let MAT = null;
const MATUI = { q: '', fam: '', st: '', open: null };
// Property units: data is SI; inch mode converts. [metric unit, metric dp, inch unit, factor, inch dp]
const PUNIT = {
  density: ['kg/m³', 0, 'lb/in³', 3.6127292e-5, 4], e_modulus: ['GPa', 1, 'Msi', 1 / 6.894757, 1],
  rm: ['MPa', 0, 'ksi', 1 / 6.894757, 1], rp02: ['MPa', 0, 'ksi', 1 / 6.894757, 1], elongation: ['%', 1, '%', 1, 1],
  cte: ['µm/m·K', 2, 'µin/in·°F', 1 / 1.8, 2], k: ['W/m·K', 1, 'BTU/h·ft·°F', 0.5778, 1], machinability: ['%', 0, '%', 1, 0], hardness: ['', 0, '', 1, 0]
};
function propValue(p, v, sys) {
  const [mu, mdp, iu, f, idp] = PUNIT[p.prop];
  const inch = sys === 'inch' && p.prop !== 'hardness';
  const k = inch ? f : 1, dp = inch ? idp : mdp;
  const one = x => { const r = x * k; return (Math.round(r) === r && !inch) ? String(r) : (+r.toFixed(dp)).toLocaleString('en-GB', { maximumFractionDigits: dp, useGrouping: false }); };
  const unit = p.prop === 'hardness' ? p.unit : (inch ? iu : mu);
  return (v.max != null ? one(v.value) + '–' + one(v.max) : one(v.value)) + ' ' + unit;
}
async function renderMaterials(el) {
  el.innerHTML = '<input id="msearch" type="search" placeholder="Type any grade: 304, 1.4404, EN24, SKD11, 6082, HE30, CZ121, CW614N..." style="width:100%;max-width:560px;margin-bottom:10px"><div class="mfilter"></div><div id="mres"></div><div id="mev"></div><div id="msrc" class="note"></div>';
  if (!MAT) { try { MAT = await (await fetch('data/materials.json')).json(); } catch (e) { el.textContent = 'Material data not found (run scripts/build-web.sh).'; return; } }
  const fams = Object.keys(MAT.families).filter(f => MAT.materials.some(m => m.family === f));
  const esc = x => String(x ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const norm = x => String(x).toLowerCase().replace(/[\s.\-\/]/g, '');
  const ff = $('.mfilter', el);
  ff.innerHTML = '<select id="mfam"><option value="">All families</option>' + fams.map(f => '<option>' + f + '</option>').join('') + '</select>' +
    '<select id="mst"><option value="">Any status</option><option value="confirmed">Confirmed</option><option value="differs">Sources differ</option><option value="review">Needs a second source</option></select>';
  const LABEL = { confirmed: 'Confirmed', differs: 'Sources differ', review: 'Needs 2nd source' };
  const pub = k => (MAT.sources[k] || {}).publisher_norm || k;
  function cell(vals, uns) {
    let h = '';
    (vals || []).forEach((v, i) => {
      const n = v.publishers.length;
      h += '<div class="' + (i ? 'malt' : 'mv') + '" title="' + esc(v.publishers.join(', ')) + '">' + esc(v.value) + ' <span class="mc ' + (n >= 2 ? 'ok' : '') + '">' + n + '</span></div>';
    });
    if (uns) h += '<div class="mu" title="Not printed by any source yet">' + esc(uns) + ' <i>unsourced</i></div>';
    return h;
  }
  function draw() {
    const q = norm($('#msearch').value), fam = $('#mfam').value, st = $('#mst').value;
    const hit = m => !q || norm(m.grade).includes(q) || Object.values(m.fields).some(vs => vs.some(v => norm(v.value).includes(q))) || Object.values(m.unsourced).some(v => norm(v).includes(q));
    const rows = MAT.materials.filter(m => (!fam || m.family === fam) && (!st || m.status === st) && hit(m));
    let h = '';
    fams.filter(f => rows.some(m => m.family === f)).forEach(f => {
      const cols = MAT.families[f];
      h += '<h3 class="mfh">' + esc(f) + '</h3><div class="res mtab"><table><tr><th>Grade</th>' + cols.map(c => '<th>' + c[1] + '</th>').join('') + '</tr>' +
        rows.filter(m => m.family === f).map(m => {
          const i = MAT.materials.indexOf(m);
          return '<tr class="mrow" data-i="' + i + '"><td><b>' + esc(m.grade) + '</b><div><span class="badge ' + m.status + '">' + LABEL[m.status] + '</span></div><div class="fam">' +
            esc([m.subfamily, m.iso_group ? 'ISO ' + m.iso_group : ''].filter(Boolean).join(' · ')) + ' · ' + m.publishers.length + ' publisher' + (m.publishers.length === 1 ? '' : 's') + (m.properties && m.properties.length ? ' · ' + m.properties.length + ' properties' : '') + (m.composition ? ' · composition' : '') + '</div></td>' +
            cols.map(([k]) => '<td>' + cell(m.fields[k], m.unsourced[k]) + '</td>').join('') + '</tr>' +
            (m.notes.length ? '<tr class="mn"><td></td><td colspan="' + cols.length + '">' + esc(m.notes.join(' ')) + '</td></tr>' : '');
        }).join('') + '</table></div>';
    });
    $('#mres').innerHTML = (h || '<p class="warn">No grade matches.</p>') + '<p class="desc">' + rows.length + ' of ' + MAT.materials.length + ' grades shown. The number next to each value is how many independent publishers print it. Click a grade to see exactly what each source prints.</p>';
    el.querySelectorAll('.mrow').forEach(r => r.onclick = () => evidence(MAT.materials[+r.dataset.i]));
  }
  const BASIS = { min: 'min', max: 'max', typical: 'typical', range: 'spec range', unstated: 'not stated' };
  function propTable(m) {
    const props = m.properties || [];
    if (!props.length) return '<div class="res" style="max-width:none;margin-top:12px"><div class="h">Properties of ' + esc(m.grade) + '</div><table><tr><td class="ms">No source with properties for this grade yet.</td></tr></table></div>';
    const defs = MAT.property_defs || {};
    let last = '';
    const rows = props.map(p => {
      const name = p.prop === last ? '' : esc((defs[p.prop] || {}).label || p.prop) + (p.prop === 'machinability' && p.ref ? '<div class="ms">' + esc(p.ref) + '</div>' : '');
      last = p.prop;
      const vals = p.values.map((v, i) => {
        const n = v.publishers.length;
        const tip = v.evidence.map(e => e.publisher + ': ' + e.printed + ' (' + e.verbatim + ')').join('\n');
        const spread = (v.printed_values || []).length > 1 ? ' <span class="ms">(within tolerance: ' + esc(v.printed_values.map(([a, b]) => propValue(p, { value: a, max: b }, state.sys)).join(', ')) + ')</span>' : '';
        return '<div class="' + (i ? 'malt' : 'mv') + '" title="' + esc(tip) + '">' + esc(propValue(p, v, state.sys)) + ' <span class="mc ' + (n >= 2 ? 'ok' : '') + '">' + n + '</span>' + spread +
          (i || p.values.length > 1 ? ' <span class="ms">' + esc(v.publishers.join(', ')) + '</span>' : '') + '</div>';
      }).join('');
      return '<tr><td>' + name + '</td><td><b>' + esc(p.cond) + '</b>' + p.conditions.map(c => '<div class="ms">' + esc(c) + '</div>').join('') + '</td><td>' + BASIS[p.basis] +
        '</td><td>' + vals + '</td><td><span class="badge ' + p.status + '">' + LABEL[p.status] + '</span></td></tr>';
    }).join('');
    return '<div class="res mtab mprops" style="margin-top:12px"><div class="h">Properties of ' + esc(m.grade) + ' (' + (state.sys === 'inch' ? 'inch units' : 'metric units') + ')</div><table>' +
      '<tr><th>Property</th><th>Condition</th><th>Value is</th><th>Value <span class="ms">(publishers)</span></th><th>Status</th></tr>' + rows + '</table>' +
      '<p class="ms" style="padding:4px 10px">Mechanical values only mean something with their condition and size. Spec minimums, spec ranges and typical values are kept apart and never compared. Hardness is shown on the scale the source printed; it is never converted. Hover a value to see what each source printed.</p></div>';
  }
  // Composition chart: one bar per element. The bar is a drawing of the printed limits only (no value is
  // worked out). Lengths are on a square-root scale so that 0.03 % and 18 % can share one chart.
  const limitText = v => v.text != null ? v.text : v.min != null && v.max != null ? (v.min === v.max ? String(v.min) : v.min + ' to ' + v.max) : v.max != null ? v.max + ' max' : v.min + ' min';
  function compCard(m) {
    const C = m.composition;
    if (!C) return '<div class="res" style="max-width:none;margin-top:12px" id="mcomp"><div class="h">Composition of ' + esc(m.grade) + '</div><table><tr><td class="ms">No source with a composition table for this grade yet.</td></tr></table></div>';
    const top = Math.max(1, ...C.elements.flatMap(e => e.values.map(v => v.max != null ? v.max : v.min != null ? v.min : 0)));
    const X = v => Math.round(200 * Math.sqrt(Math.max(0, v) / top) * 10) / 10;
    const bar = e => {
      const v = e.values[0];
      if (v.text != null && v.min == null && v.max == null) return '';
      const lo = v.min != null ? X(v.min) : 0, hi = v.max != null ? X(v.max) : 200;
      return '<svg class="cbar" viewBox="0 0 204 12" preserveAspectRatio="none" aria-hidden="true"><rect class="cb-track" x="0" y="4" width="200" height="4"/>' +
        (v.min != null && v.max != null ? '<rect class="cb-lo" x="0" y="4" width="' + lo + '" height="4"/><rect class="cb-rng" x="' + lo + '" y="1" width="' + Math.max(1.5, hi - lo) + '" height="10"/>'
          : v.max != null ? '<rect class="cb-max" x="0" y="2.5" width="' + hi + '" height="7"/><rect class="cb-rng" x="' + (hi - 1.5) + '" y="0" width="1.5" height="12"/>'
            : '<rect class="cb-lo" x="0" y="4" width="' + lo + '" height="4"/><rect class="cb-rng" x="' + lo + '" y="0" width="1.5" height="12"/><rect class="cb-max" x="' + lo + '" y="2.5" width="' + (200 - lo) + '" height="7"/>') + '</svg>';
    };
    const rows = C.elements.map(e => '<tr data-el="' + e.el + '"><td><b>' + e.el + '</b></td><td>' + e.values.map((v, i) => {
      const n = v.publishers.length;
      return '<div class="' + (i ? 'malt' : 'mv') + '" title="' + esc(v.printed.map(q => q.publisher + ': ' + q.as).join('\n')) + '">' + esc(limitText(v)) + ' <span class="mc ' + (n >= 2 ? 'ok' : '') + '">' + n + '</span>' +
        (e.values.length > 1 ? ' <span class="ms">' + esc(v.publishers.join(', ')) + '</span>' : '') + '</div>';
    }).join('') + '</td><td class="cbc">' + bar(e) + '</td><td><span class="badge ' + e.status + '">' + LABEL[e.status] + '</span></td></tr>').join('');
    return '<div class="res mtab mcomp" style="margin-top:12px" id="mcomp"><div class="h">Composition of ' + esc(m.grade) + ' (percent by mass)</div><table>' +
      '<tr><th>Element</th><th>Limits <span class="ms">(publishers)</span></th><th>Chart <span class="ms">(0 to ' + top + ' %, square-root scale)</span></th><th>Status</th></tr>' + rows + '</table>' +
      '<p class="ms" style="padding:4px 10px">Limits as each source prints them: ' + C.records.map(r => esc(r.publisher) + ' (' + esc(r.basis) + ')').join('; ') + '. A wide block is a range, a thin mark with a pale bar is a maximum or a minimum. ' +
      'Where two sources print different limits both are listed and the chart shows the first; standards are revised, so the edition matters. An element that is not listed is not limited by these tables, which is not the same as absent. The mill certificate of the bar is what counts.</p></div>';
  }
  // Machinability ring: one ring per printed rating. The ring is full at 200 %; the tick at the bottom is 100 %, the reference material.
  function machCard(m) {
    const groups = (m.properties || []).filter(q => q.prop === 'machinability');
    if (!groups.length) return '';
    const ring = v => {
      const val = v.value, r = 30, c = 2 * Math.PI * r, f = Math.min(val, 200) / 200;
      return '<svg class="mring" viewBox="0 0 84 84" role="img" aria-label="' + val + ' percent"><circle class="mr-track" cx="42" cy="42" r="' + r + '"/>' +
        '<circle class="mr-arc" cx="42" cy="42" r="' + r + '" stroke-dasharray="' + (c * f).toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(-90 42 42)"/>' +
        '<line class="mr-ref" x1="42" y1="' + (42 + r - 6) + '" x2="42" y2="' + (42 + r + 6) + '"/>' +
        '<text x="42" y="46" text-anchor="middle">' + esc(v.max != null ? val + '-' + v.max : val) + '</text></svg>';
    };
    const cells = groups.flatMap(g => g.values.map(v => '<div class="mrc" data-ref="' + esc(g.ref || '') + '">' + ring(v) + '<div><b>' + esc(v.max != null ? v.value + ' to ' + v.max : v.value) + ' %</b> <span class="mc ' + (v.publishers.length >= 2 ? 'ok' : '') + '">' + v.publishers.length + '</span>' +
      '<div class="ms">' + esc(g.cond) + '</div><div class="ms">' + esc(g.ref || '') + '</div><div class="ms">' + esc(v.publishers.join(', ')) + '</div></div></div>')).join('');
    return '<div class="res mmach" style="max-width:none;margin-top:12px" id="mmach"><div class="h">Machinability of ' + esc(m.grade) + '</div><div class="mrings">' + cells + '</div>' +
      '<p class="ms" style="padding:4px 10px">A rating compares the grade with a reference material that is given 100 % (named under each ring); the tick at the bottom of the ring is 100 % and the ring is full at 200 %. ' +
      'Ratings on different references, or for different conditions, cannot be compared with each other, and tables for the same reference do not always agree. Use a rating to rank materials, not to set a speed.</p></div>';
  }
  function evidence(m, quiet) {
    MATUI.open = m.grade;
    const ev = $('#mev');
    ev.innerHTML = '<div class="mcardh" id="mcard">Material card: ' + esc(m.grade) + '</div>' + compCard(m) + machCard(m) + propTable(m) + '<div class="res" style="max-width:none;margin-top:12px"><div class="h">What each source prints for ' + esc(m.grade) + ' <button class="btn" id="mevx" style="float:right;height:20px;padding:0 6px">Close</button></div><table>' +
      m.printed.map(p => { const s = MAT.sources[p.source] || {};
        return '<tr><td style="width:220px"><b>' + esc(s.publisher_norm || p.source) + '</b><div class="ms">' + esc(s.title || '') + '</div>' + (s.revision ? '<div class="ms">Revision: ' + esc(s.revision) + '</div>' : '') + (s.url ? '<div class="ms">' + esc(s.url) + '</div>' : '') + '<div class="ms">Accessed ' + esc(s.accessed || '') + '</div></td><td>' +
          (p.printed_as ? '<div class="ms">Printed as ' + esc(p.printed_as) + '</div>' : '') +
          Object.entries(p.values || {}).filter(([k, v]) => v).map(([k, v]) => '<span class="kv"><i>' + esc(k) + '</i> ' + esc(v) + '</span>').join(' ') +
          (p.verbatim_row ? '<div class="verb">' + esc(p.verbatim_row) + '</div>' : '') +
          (p.composition ? '<div class="verb"><b>composition</b> ' + esc(Object.entries(p.composition.elements).map(([k, v]) => k + ' ' + v.replace(/^text /, '')).join(', ')) + ' · ' + esc(p.composition.basis) + '\n' + esc(p.composition.verbatim) + (p.composition.note ? '\nNote: ' + esc(p.composition.note) : '') + '</div>' : '') +
          (p.properties || []).map(q => '<div class="verb"><b>' + esc(q.prop) + '</b> ' + esc(q.value + (q.max != null ? '-' + q.max : '') + ' ' + q.unit) + ' · ' + esc(q.basis) + ' · ' + esc(q.condition) + '\n' + esc(q.verbatim) + (q.note ? '\nNote: ' + esc(q.note) : '') + '</div>').join('') +
          (p.transcription ? '<div class="ms">' + esc(p.transcription) + '</div>' : '') + '</td></tr>'; }).join('') + '</table></div>';
    $('#mevx').onclick = () => { ev.innerHTML = ''; MATUI.open = null; };
    if (!quiet) ev.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  const pubs = {}; Object.values(MAT.sources).forEach(s => { (pubs[s.publisher_norm] = pubs[s.publisher_norm] || []).push(s); });
  $('#msrc').innerHTML = '<b>Sources (' + Object.keys(pubs).length + ' publishers, ' + Object.keys(MAT.sources).length + ' documents)</b><br>' +
    Object.entries(pubs).sort().map(([p, ss]) => '<b>' + esc(p) + '</b>: ' + ss.map(s => esc(s.title) + (s.url ? ' (' + esc(s.url) + ')' : '')).join('; ')).join('<br>');
  $('#msearch').value = MATUI.q; $('#mfam').value = MATUI.fam; $('#mst').value = MATUI.st;
  const redraw = () => { MATUI.q = $('#msearch').value; MATUI.fam = $('#mfam').value; MATUI.st = $('#mst').value; draw(); };
  $('#msearch').oninput = redraw; $('#mfam').onchange = redraw; $('#mst').onchange = redraw; draw();
  const reopen = MAT.materials.find(m => m.grade === MATUI.open);
  if (reopen) evidence(reopen, true);
}
