'use strict';
const $ = (s, r = document) => r.querySelector(s);
const state = { sys: 'inch', tool: 'rpm', W: null, vals: {} };
try { const u = localStorage.getItem('bm.units'); if (u) state.sys = u; const t = localStorage.getItem('bm.tool'); if (t) state.tool = t; } catch (e) {}

function fmt(v, dp) {
  if (typeof v === 'string') return v;
  if (!isFinite(v)) return 'n/a';
  return v.toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

// Save a file. A native wrapper (Tauri) can set window.BenchMateSave to show a save dialog.
function saveFile(name, data, type) {
  if (typeof window.BenchMateSave === 'function') return window.BenchMateSave(name, data, type);
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// Favourite tools, in the order they were starred; kept in this browser.
const Favs = (() => {
  let ids = [];
  try { ids = JSON.parse(localStorage.getItem('bm.favs') || '[]'); if (!Array.isArray(ids)) ids = []; } catch (e) { ids = []; }
  const save = () => { try { localStorage.setItem('bm.favs', JSON.stringify(ids)); } catch (e) {} };
  return {
    has: id => ids.includes(id),
    toggle: id => { ids = ids.includes(id) ? ids.filter(x => x !== id) : ids.concat(id); save(); },
    tools: () => ids.map(id => TOOLS.find(t => t.id === id)).filter(Boolean),
  };
})();
const STAR_SVG = '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.9l1.85 3.85 4.2.55-3.07 2.93.77 4.17L8 11.37l-3.75 2.03.77-4.17L1.95 6.3l4.2-.55z"/></svg>';
function toggleFav(id) { Favs.toggle(id); renderList($('#search').value); const b = $('#favbtn'); if (b && b.dataset.id === id) favButton(b, id); }
function favButton(b, id) {
  const on = Favs.has(id);
  b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
  b.innerHTML = STAR_SVG + '<span>' + (on ? 'Favourite' : 'Add to favourites') + '</span>';
}

function renderList(filter = '') {
  const list = $('#list'); list.innerHTML = '';
  const q = filter.trim().toLowerCase();
  const match = t => !q || (t.title + ' ' + t.group + ' ' + t.desc).toLowerCase().includes(q);
  const head = txt => { const h = document.createElement('h3'); h.textContent = txt; list.appendChild(h); };
  const row = t => {
    const r = document.createElement('div'); r.className = 'li';
    const b = document.createElement('button');
    b.className = 't' + (t.id === state.tool ? ' on' : ''); b.textContent = t.title; b.dataset.id = t.id;
    b.onclick = () => { state.tool = t.id; try { localStorage.setItem('bm.tool', t.id); } catch (e) {} renderList($('#search').value); renderTool(); };
    const st = document.createElement('button');
    const fav = Favs.has(t.id);
    st.className = 'star' + (fav ? ' on' : ''); st.innerHTML = STAR_SVG;
    st.setAttribute('aria-pressed', fav ? 'true' : 'false');
    st.title = (fav ? 'Remove ' : 'Add ') + t.title + (fav ? ' from favourites' : ' to favourites');
    st.setAttribute('aria-label', st.title);
    st.onclick = () => toggleFav(t.id);
    r.append(b, st); list.appendChild(r);
  };
  const favs = Favs.tools().filter(match);
  if (favs.length) { head('Favourites'); favs.forEach(row); }
  let last = '';
  TOOLS.filter(match).forEach(t => {
    if (t.group !== last) { head(t.group); last = t.group; }
    row(t);
  });
}

// Title row of a tool card: heading and the favourite toggle.
function cardHead(card, t) {
  const h = document.createElement('div'); h.className = 'thead';
  const h1 = document.createElement('h1'); h1.textContent = t.title;
  const b = document.createElement('button'); b.className = 'btn favbtn'; b.id = 'favbtn'; b.dataset.id = t.id;
  favButton(b, t.id); b.onclick = () => toggleFav(t.id);
  h.append(h1, b); card.prepend(h);
}

function renderTool() {
  const t = TOOLS.find(x => x.id === state.tool) || TOOLS[0];
  if (t.render) { renderCustom(t); return; }
  const fields = t.fields(state.sys);
  const key = t.id + ':' + state.sys;
  const saved = state.vals[key] || (state.vals[key] = {});
  const main = $('#main');
  main.innerHTML = '';
  const card = document.createElement('div'); card.className = 'card';
  card.innerHTML = '<p class="desc"></p>' + (t.pick ? toolPickRow(t.pick) : '') + '<div class="grid"></div>';
  cardHead(card, t); $('.desc', card).textContent = t.desc;
  const grid = $('.grid', card);
  fields.forEach(f => {
    const lab = document.createElement('label'); lab.className = 'f';
    const span = document.createElement('span'); span.textContent = f.label;
    const row = document.createElement('div'); row.className = 'row';
    // A field with `options: [[value, label], ...]` renders as a drop-down; the value is still a number.
    let inp;
    if (f.options) {
      inp = document.createElement('select');
      f.options.forEach(([val, txt]) => { const o = document.createElement('option'); o.value = val; o.textContent = txt; inp.appendChild(o); });
    } else { inp = document.createElement('input'); inp.type = 'number'; inp.step = 'any'; inp.inputMode = 'decimal'; }
    inp.value = saved[f.id] !== undefined ? saved[f.id] : f.def; inp.dataset.id = f.id;
    inp.oninput = inp.onchange = () => { saved[f.id] = inp.value; update(); };
    const u = document.createElement('span'); u.className = 'u'; u.textContent = f.unit;
    row.append(inp, u); lab.append(span, row); grid.appendChild(lab);
  });
  const res = document.createElement('div'); res.className = 'res'; res.id = 'res';
  const note = document.createElement('div'); note.className = 'note';
  note.innerHTML = '<b>Working:</b> <span id="w"></span><br><b>Source:</b> <span id="s"></span>';
  $('#w', note).textContent = t.working; $('#s', note).textContent = t.source;
  // Optional drawing under the results: t.diagram(v, sys) returns SVG markup or ''.
  const dia = document.createElement('div'); dia.className = 'tdia';
  main.append(card, res, dia, note);
  function update() {
    const v = {}; fields.forEach(f => { const e = grid.querySelector('[data-id="' + f.id + '"]'); v[f.id] = e.value === '' ? NaN : parseFloat(e.value); });
    let rows = [];
    try { rows = t.calc(v, state.W, state.sys); } catch (e) { rows = []; }
    rows = rows.filter(r => typeof r.value === 'string' || isFinite(r.value));
    res.innerHTML = '<div class="h">Results</div>' + (rows.length
      ? '<table>' + rows.map(r => { const w = checkRow(r, state.sys, state.W); return '<tr' + (w ? ' class="over"' : '') + '><td>' + r.label + (w ? '<div class="wmsg">' + w + '</div>' : '') + '</td><td class="v' + (typeof r.value === 'string' && r.value.length > 24 ? ' txt' : '') + '">' + fmt(r.value, r.dp) + '</td><td class="u">' + r.unit + '</td></tr>'; }).join('') + '</table>'
      : '<table><tr><td class="warn">Enter the values above.</td></tr></table>');
    if (t.diagram) { let h = ''; try { h = t.diagram(v, state.sys) || ''; } catch (e) { h = ''; } dia.innerHTML = h; }
  }
  const pick = $('#tpick', card);
  if (pick) pick.onchange = () => {
    const tool = ToolLib.get(pick.value); if (!tool) return;
    const vals = toolPickValues(t.pick, tool, state.sys);
    Object.entries(vals).forEach(([id, val]) => { const e = grid.querySelector('[data-id="' + id + '"]'); if (e) { e.value = val; saved[id] = String(val); } });
    $('#tpickmsg', card).textContent = 'Filled from ' + ToolLib.describe(tool) + ': ' + (Object.keys(vals).map(id => (fields.find(f => f.id === id) || {}).label).filter(Boolean).join(', ') || 'nothing to fill') + '.';
    pick.value = ''; update();
  };
  update();
}

function renderCustom(t) {
  const main = $('#main'); main.innerHTML = '';
  const card = document.createElement('div'); card.className = 'card wide';
  card.innerHTML = '<p class="desc"></p><div class="body"></div>';
  cardHead(card, t); $('.desc', card).textContent = t.desc;
  const note = document.createElement('div'); note.className = 'note';
  note.innerHTML = '<b>Note:</b> <span id="w"></span><br><b>Sources:</b> <span id="s"></span>';
  $('#w', note).textContent = t.working; $('#s', note).textContent = t.source;
  main.append(card, note);
  t.render($('.body', card));
}

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

function setUnits(u) {
  state.sys = u; try { localStorage.setItem('bm.units', u); } catch (e) {}
  document.querySelectorAll('#units button').forEach(b => b.classList.toggle('on', b.dataset.u === u));
  renderTool();
}

function setTheme(t) {
  if (t) document.documentElement.setAttribute('data-theme', t); else document.documentElement.removeAttribute('data-theme');
}
let theme = null; try { theme = localStorage.getItem('bm.theme'); } catch (e) {}
setTheme(theme);

async function boot() {
  const resp = await fetch('benchmate.wasm');
  const { instance } = await WebAssembly.instantiate(await resp.arrayBuffer(), {});
  state.W = instance.exports;
  $('#ver').textContent = 'v0.1.0';
  refreshMachineSelect();
  $('#machine').onchange = e => { Profiles.setActive(e.target.value); renderTool(); };
  renderList(); setUnits(state.sys);
  $('#search').oninput = e => renderList(e.target.value);
  document.querySelectorAll('#units button').forEach(b => b.onclick = () => setUnits(b.dataset.u));
  $('#theme').onclick = () => {
    const cur = document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const nx = cur === 'dark' ? 'light' : 'dark'; setTheme(nx); try { localStorage.setItem('bm.theme', nx); } catch (e) {}
  };
}
boot().catch(e => { $('#main').textContent = 'Could not load the calculation module: ' + e.message; });
