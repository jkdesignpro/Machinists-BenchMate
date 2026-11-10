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

const MAT_COLS = [['aisi','AISI / SAE'],['uns','UNS'],['en_number','EN / W.-Nr.'],['en_name','EN name'],['bs970','BS 970 / BS 4659'],['uk_en','UK old EN'],['jis','JIS'],['gb','GB (China)']];
let MAT = null;
async function renderMaterials(el) {
  el.innerHTML = '<input id="msearch" type="search" placeholder="Type any grade: 304, 1.4404, EN24, SKD11, 42CrMo4..." style="width:100%;max-width:520px;margin-bottom:10px"><div class="mfilter"></div><div id="mres"></div><div id="msrc" class="note"></div>';
  if (!MAT) { try { MAT = await (await fetch('data/materials.json')).json(); } catch (e) { el.textContent = 'Material data not found (run scripts/build-web.sh).'; return; } }
  const fams = [...new Set(MAT.materials.map(m => m.family))];
  const ff = $('.mfilter', el);
  ff.innerHTML = '<select id="mfam"><option value="">All families</option>' + fams.map(f => '<option>' + f + '</option>').join('') + '</select> <label class="chk"><input type="checkbox" id="mconf"> Confirmed only</label>';
  const esc = x => String(x).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const norm = x => String(x).toLowerCase().replace(/[\s.\-\/]/g, '');
  function draw() {
    const q = norm($('#msearch').value), fam = $('#mfam').value, conf = $('#mconf').checked;
    const rows = MAT.materials.filter(m => (!fam || m.family === fam) && (!conf || m.status === 'confirmed') && (!q ||
      [m.id, ...Object.values(m.fields).map(f => f.value), ...Object.values(m.unsourced)].some(v => norm(v).includes(q))));
    $('#mres').innerHTML = '<div class="res mtab"><table><tr><th>Status</th>' + MAT_COLS.map(c => '<th>' + c[1] + '</th>').join('') + '</tr>' +
      rows.map(m => '<tr><td><span class="badge ' + m.status + '">' + (m.status === 'confirmed' ? 'Confirmed' : 'Review') + '</span><div class="fam">' + esc(m.family) + ' · ISO ' + m.iso_group + '</div></td>' +
        MAT_COLS.map(([k]) => { const f = m.fields[k]; const u = m.unsourced[k];
          return '<td>' + (f ? '<div class="mv">' + esc(f.value) + '</div><div class="ms">' + f.sources.join(', ') + '</div>' : '') +
            (u ? '<div class="mu" title="Not yet sourced">' + esc(u) + ' <i>unsourced</i></div>' : '') + '</td>'; }).join('') + '</tr>' +
        (m.notes ? '<tr class="mn"><td></td><td colspan="' + MAT_COLS.length + '">' + esc(m.notes) + '</td></tr>' : '')).join('') +
      '</table></div><p class="desc">' + rows.length + ' of ' + MAT.materials.length + ' grades shown.</p>';
  }
  $('#msrc').innerHTML = '<b>Source key</b><br>' + Object.entries(MAT.sources).map(([k, v]) => '<b>' + k + '</b>: ' + esc(v)).join('<br>');
  $('#msearch').oninput = draw; $('#mfam').onchange = draw; $('#mconf').onchange = draw; draw();
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
