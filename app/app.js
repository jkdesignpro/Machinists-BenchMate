'use strict';
const $ = (s, r = document) => r.querySelector(s);
const state = { sys: 'inch', tool: 'rpm', W: null, vals: {} };
try { const u = localStorage.getItem('bm.units'); if (u) state.sys = u; const t = localStorage.getItem('bm.tool'); if (t) state.tool = t; } catch (e) {}

function fmt(v, dp) {
  if (typeof v === 'string') return v;
  if (!isFinite(v)) return 'n/a';
  return v.toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

function renderList(filter = '') {
  const list = $('#list'); list.innerHTML = '';
  const q = filter.trim().toLowerCase();
  let last = '';
  TOOLS.filter(t => !q || (t.title + ' ' + t.group + ' ' + t.desc).toLowerCase().includes(q)).forEach(t => {
    if (t.group !== last) { const h = document.createElement('h3'); h.textContent = t.group; list.appendChild(h); last = t.group; }
    const b = document.createElement('button');
    b.textContent = t.title; b.dataset.id = t.id;
    if (t.id === state.tool) b.className = 'on';
    b.onclick = () => { state.tool = t.id; try { localStorage.setItem('bm.tool', t.id); } catch (e) {} renderList($('#search').value); renderTool(); };
    list.appendChild(b);
  });
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
  card.innerHTML = '<h1></h1><p class="desc"></p><div class="grid"></div>';
  $('h1', card).textContent = t.title; $('.desc', card).textContent = t.desc;
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
  main.append(card, res, note);
  function update() {
    const v = {}; fields.forEach(f => { const e = grid.querySelector('[data-id="' + f.id + '"]'); v[f.id] = e.value === '' ? NaN : parseFloat(e.value); });
    let rows = [];
    try { rows = t.calc(v, state.W, state.sys); } catch (e) { rows = []; }
    rows = rows.filter(r => typeof r.value === 'string' || isFinite(r.value));
    res.innerHTML = '<div class="h">Results</div>' + (rows.length
      ? '<table>' + rows.map(r => { const w = checkRow(r, state.sys, state.W); return '<tr' + (w ? ' class="over"' : '') + '><td>' + r.label + (w ? '<div class="wmsg">' + w + '</div>' : '') + '</td><td class="v">' + fmt(r.value, r.dp) + '</td><td class="u">' + r.unit + '</td></tr>'; }).join('') + '</table>'
      : '<table><tr><td class="warn">Enter the values above.</td></tr></table>');
  }
  update();
}

function renderCustom(t) {
  const main = $('#main'); main.innerHTML = '';
  const card = document.createElement('div'); card.className = 'card wide';
  card.innerHTML = '<h1></h1><p class="desc"></p><div class="body"></div>';
  $('h1', card).textContent = t.title; $('.desc', card).textContent = t.desc;
  const note = document.createElement('div'); note.className = 'note';
  note.innerHTML = '<b>Note:</b> <span id="w"></span><br><b>Sources:</b> <span id="s"></span>';
  $('#w', note).textContent = t.working; $('#s', note).textContent = t.source;
  main.append(card, note);
  t.render($('.body', card));
}

let MAT = null;
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
            esc([m.subfamily, m.iso_group ? 'ISO ' + m.iso_group : ''].filter(Boolean).join(' · ')) + ' · ' + m.publishers.length + ' publisher' + (m.publishers.length === 1 ? '' : 's') + '</div></td>' +
            cols.map(([k]) => '<td>' + cell(m.fields[k], m.unsourced[k]) + '</td>').join('') + '</tr>' +
            (m.notes.length ? '<tr class="mn"><td></td><td colspan="' + cols.length + '">' + esc(m.notes.join(' ')) + '</td></tr>' : '');
        }).join('') + '</table></div>';
    });
    $('#mres').innerHTML = (h || '<p class="warn">No grade matches.</p>') + '<p class="desc">' + rows.length + ' of ' + MAT.materials.length + ' grades shown. The number next to each value is how many independent publishers print it. Click a grade to see exactly what each source prints.</p>';
    el.querySelectorAll('.mrow').forEach(r => r.onclick = () => evidence(MAT.materials[+r.dataset.i]));
  }
  function evidence(m) {
    const ev = $('#mev');
    ev.innerHTML = '<div class="res" style="max-width:none;margin-top:12px"><div class="h">What each source prints for ' + esc(m.grade) + ' <button class="btn" id="mevx" style="float:right;height:20px;padding:0 6px">Close</button></div><table>' +
      m.printed.map(p => { const s = MAT.sources[p.source] || {};
        return '<tr><td style="width:220px"><b>' + esc(s.publisher_norm || p.source) + '</b><div class="ms">' + esc(s.title || '') + '</div>' + (s.url ? '<div class="ms">' + esc(s.url) + '</div>' : '') + '<div class="ms">Accessed ' + esc(s.accessed || '') + '</div></td><td>' +
          Object.entries(p.values).filter(([k, v]) => v).map(([k, v]) => '<span class="kv"><i>' + esc(k) + '</i> ' + esc(v) + '</span>').join(' ') +
          (p.verbatim_row ? '<div class="verb">' + esc(p.verbatim_row) + '</div>' : '') + (p.transcription ? '<div class="ms">' + esc(p.transcription) + '</div>' : '') + '</td></tr>'; }).join('') + '</table></div>';
    $('#mevx').onclick = () => { ev.innerHTML = ''; };
    ev.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  const pubs = {}; Object.values(MAT.sources).forEach(s => { (pubs[s.publisher_norm] = pubs[s.publisher_norm] || []).push(s); });
  $('#msrc').innerHTML = '<b>Sources (' + Object.keys(pubs).length + ' publishers, ' + Object.keys(MAT.sources).length + ' documents)</b><br>' +
    Object.entries(pubs).sort().map(([p, ss]) => '<b>' + esc(p) + '</b>: ' + ss.map(s => esc(s.title) + (s.url ? ' (' + esc(s.url) + ')' : '')).join('; ')).join('<br>');
  $('#msearch').oninput = draw; $('#mfam').onchange = draw; $('#mst').onchange = draw; draw();
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
