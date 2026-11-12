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
            esc([m.subfamily, m.iso_group ? 'ISO ' + m.iso_group : ''].filter(Boolean).join(' · ')) + ' · ' + m.publishers.length + ' publisher' + (m.publishers.length === 1 ? '' : 's') + (m.properties && m.properties.length ? ' · ' + m.properties.length + ' properties' : '') + '</div></td>' +
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
  function evidence(m, quiet) {
    MATUI.open = m.grade;
    const ev = $('#mev');
    ev.innerHTML = propTable(m) + '<div class="res" style="max-width:none;margin-top:12px"><div class="h">What each source prints for ' + esc(m.grade) + ' <button class="btn" id="mevx" style="float:right;height:20px;padding:0 6px">Close</button></div><table>' +
      m.printed.map(p => { const s = MAT.sources[p.source] || {};
        return '<tr><td style="width:220px"><b>' + esc(s.publisher_norm || p.source) + '</b><div class="ms">' + esc(s.title || '') + '</div>' + (s.revision ? '<div class="ms">Revision: ' + esc(s.revision) + '</div>' : '') + (s.url ? '<div class="ms">' + esc(s.url) + '</div>' : '') + '<div class="ms">Accessed ' + esc(s.accessed || '') + '</div></td><td>' +
          (p.printed_as ? '<div class="ms">Printed as ' + esc(p.printed_as) + '</div>' : '') +
          Object.entries(p.values || {}).filter(([k, v]) => v).map(([k, v]) => '<span class="kv"><i>' + esc(k) + '</i> ' + esc(v) + '</span>').join(' ') +
          (p.verbatim_row ? '<div class="verb">' + esc(p.verbatim_row) + '</div>' : '') +
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
