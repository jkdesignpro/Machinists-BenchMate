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
    const inp = document.createElement('input'); inp.type = 'number'; inp.step = 'any'; inp.inputMode = 'decimal';
    inp.value = saved[f.id] !== undefined ? saved[f.id] : f.def; inp.dataset.id = f.id;
    inp.oninput = () => { saved[f.id] = inp.value; update(); };
    const u = document.createElement('span'); u.className = 'u'; u.textContent = f.unit;
    row.append(inp, u); lab.append(span, row); grid.appendChild(lab);
  });
  const res = document.createElement('div'); res.className = 'res'; res.id = 'res';
  const note = document.createElement('div'); note.className = 'note';
  note.innerHTML = '<b>Working:</b> <span id="w"></span><br><b>Source:</b> <span id="s"></span>';
  $('#w', note).textContent = t.working; $('#s', note).textContent = t.source;
  main.append(card, res, note);
  function update() {
    const v = {}; fields.forEach(f => { const e = $('input[data-id="' + f.id + '"]'); v[f.id] = e.value === '' ? NaN : parseFloat(e.value); });
    let rows = [];
    try { rows = t.calc(v, state.W, state.sys); } catch (e) { rows = []; }
    rows = rows.filter(r => typeof r.value === 'string' || isFinite(r.value));
    res.innerHTML = '<div class="h">Results</div>' + (rows.length
      ? '<table>' + rows.map(r => '<tr><td>' + r.label + '</td><td class="v">' + fmt(r.value, r.dp) + '</td><td class="u">' + r.unit + '</td></tr>').join('') + '</table>'
      : '<table><tr><td class="warn">Enter the values above.</td></tr></table>');
  }
  update();
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
  renderList(); setUnits(state.sys);
  $('#search').oninput = e => renderList(e.target.value);
  document.querySelectorAll('#units button').forEach(b => b.onclick = () => setUnits(b.dataset.u));
  $('#theme').onclick = () => {
    const cur = document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const nx = cur === 'dark' ? 'light' : 'dark'; setTheme(nx); try { localStorage.setItem('bm.theme', nx); } catch (e) {}
  };
}
boot().catch(e => { $('#main').textContent = 'Could not load the calculation module: ' + e.message; });
