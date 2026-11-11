'use strict';
// BenchMate shell: modes, workspaces, routing, the tool page and its common
// controls. The tools themselves live in tools.js and the other tool files;
// how they are grouped is in workspaces.js; the Home dashboard is dashboard.js.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const hesc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
const lsJson = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
const lsPut = (k, v) => lsSet(k, JSON.stringify(v));

const state = { sys: 'inch', tool: 'rpm', W: null, vals: {}, mode: 'advanced', route: { kind: 'home' }, ws: '', compactPref: 'auto' };
if (lsGet('bm.units')) state.sys = lsGet('bm.units') === 'mm' ? 'mm' : 'inch';
state.vals = lsJson('bm.vals', {}) || {};
let valsTimer = 0;
const saveVals = () => { clearTimeout(valsTimer); valsTimer = setTimeout(() => lsPut('bm.vals', state.vals), 400); };

// ---- Modes: Simple (everyday tools, main inputs), Advanced (everything), Expert (also internals and evidence open) ----
const MODES = ['simple', 'advanced', 'expert'];
const LV = { simple: 0, advanced: 1, expert: 2 };
const MODE_NAME = { simple: 'Simple', advanced: 'Advanced', expert: 'Expert' };
if (MODES.includes(lsGet('bm.mode'))) state.mode = lsGet('bm.mode');
const lvOf = x => (x && LV[x.level] !== undefined ? x.level : 'advanced');
const fieldShown = f => !f.level || LV[f.level] <= LV[state.mode];
const toolShown = t => state.mode !== 'simple' || t.level === 'simple';
const pageShown = p => state.mode !== 'simple' || SIMPLE_PAGES.includes(p.id);
const pageTabs = p => (p.tabs || []).filter(tb => state.mode !== 'simple' || tb.simple);

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
function copyText(txt) {
  const done = () => toast('Copied');
  const old = () => { const t = document.createElement('textarea'); t.value = txt; t.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done(); } catch (e) { toast('Could not copy'); } t.remove(); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, old); else old();
}
// The desktop app only loads its own pages (it works offline), so a link to a source on the web cannot open there.
// Copy the address instead and say so, rather than doing nothing.
document.addEventListener('click', e => {
  const a = e.target.closest && e.target.closest('a[href^="http"]');
  if (!a || typeof window.BenchMateSave !== 'function') return;
  e.preventDefault(); copyText(a.href); setTimeout(() => toast('Link copied. Paste it into a web browser.', 3200), 30);
});
let toastTimer = 0;
function toast(msg, ms) {
  let t = $('#toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), ms || 1600);
}

// ---- Favourites, recent pages and pinned results (kept in this browser) ----
const Favs = (() => {
  let ids = lsJson('bm.favs', []); if (!Array.isArray(ids)) ids = [];
  ids = [...new Set(ids.map(id => PAGE_OF[id] || id).filter(id => PAGES[id]))];
  const save = () => lsPut('bm.favs', ids);
  return {
    has: id => ids.includes(id),
    toggle: id => { ids = ids.includes(id) ? ids.filter(x => x !== id) : ids.concat(id); save(); },
    pages: () => ids.map(id => PAGES[id]).filter(Boolean),
  };
})();
const Recents = (() => {
  let ids = lsJson('bm.recent', []); if (!Array.isArray(ids)) ids = [];
  return {
    add: id => { ids = [id].concat(ids.filter(x => x !== id)).slice(0, 12); lsPut('bm.recent', ids); },
    pages: () => ids.map(id => PAGES[id]).filter(Boolean),
  };
})();
const Pins = (() => {
  let list = lsJson('bm.pins', []); if (!Array.isArray(list)) list = [];
  const save = () => lsPut('bm.pins', list);
  return {
    all: () => list,
    add: p => { list = [p].concat(list).slice(0, 30); save(); },
    remove: i => { list.splice(i, 1); save(); },
  };
})();
const STAR_PATH = 'M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8Z';
function starBtn(id, cls) {
  const b = document.createElement('button');
  const paint = () => { const on = Favs.has(id); b.className = 'star ' + (cls || '') + (on ? ' on' : ''); b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.title = on ? 'Remove from favourites' : 'Add to favourites'; b.setAttribute('aria-label', b.title + ': ' + PAGES[id].title); };
  b.innerHTML = icon('star'); paint();
  b.onclick = e => { e.stopPropagation(); e.preventDefault(); Favs.toggle(id); paint(); renderRail(); };
  return b;
}

// ---- Routing: #/home, #/w/<workspace>, #/t/<page>[/<tab>][?numbers], #/news ----
// A tool link may carry the numbers to open with: ?_sys=mm&dia=12&speed=90 (see linkQuery in mountTool).
function parseHash() {
  const raw = (location.hash || '').replace(/^#\/?/, ''), qi = raw.indexOf('?');
  const h = (qi < 0 ? raw : raw.slice(0, qi)).split('/').map(decodeURIComponent);
  let q = null; if (qi >= 0) { try { q = Object.fromEntries(new URLSearchParams(raw.slice(qi + 1))); } catch (e) { q = null; } }
  if (h[0] === 'w' && WORKSPACES.some(w => w.id === h[1])) return { kind: 'ws', id: h[1] };
  if (h[0] === 't') {
    let id = h[1], tab = h[2];
    if (!PAGES[id] && PAGE_OF[id]) { tab = id; id = PAGE_OF[id]; }
    if (PAGES[id]) return { kind: 'tool', id, tab, q };
  }
  if (h[0] === 'news') return { kind: 'news' };
  return { kind: 'home' };
}
function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
// Open a tool by its id (or a page id). A tool inside a hub opens the hub on that tab.
function openTool(id) {
  const page = PAGES[id] ? id : PAGE_OF[id]; if (!page) return;
  go('#/t/' + page + (page !== id ? '/' + id : ''));
}
// One tool can open another with values to start from: handoff('cyctmill', { dia: 10, pitch: 1.5 }).
// The receiving tool calls takeHandoff('cyctmill') when it draws; it gets the values once, or null.
let handoffBox = null;
function handoff(id, vals) { handoffBox = { id, vals }; const was = location.hash; openTool(id); if (location.hash === was) renderMain(); }
function takeHandoff(id) { if (handoffBox && handoffBox.id === id) { const v = handoffBox.vals; handoffBox = null; return v; } return null; }
// Kept for the tool files that re-render after a change.
function renderTool() { renderMain(); }
function renderList() { renderRail(); }

// ---- Left rail ----
function wsOfPage(id) {
  const lists = w => w.sections.some(s => s[1].includes(id));
  const cur = WORKSPACES.find(w => w.id === state.ws);
  if (cur && lists(cur)) return cur.id;
  const h = PAGE_HOME[id]; return h ? h.ws : '';
}
function renderRail() {
  const list = $('#list'); const r = state.route; list.innerHTML = '';
  const add = el => { list.appendChild(el); return el; };
  const mk = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  const pageBtn = p => {
    const row = mk('div', 'li');
    const b = mk('button', 't' + (r.kind === 'tool' && r.id === p.id ? ' on' : ''), icon(p.icon) + '<span>' + hesc(p.title) + '</span>');
    b.dataset.id = p.id; b.onclick = () => openTool(p.id);
    row.append(b, starBtn(p.id)); return row;
  };
  const home = add(mk('button', 'rw' + (r.kind === 'home' ? ' on' : ''), icon('home') + '<span>Home</span>'));
  home.dataset.ws = 'home'; home.onclick = () => go('#/home');
  const favs = Favs.pages().filter(pageShown);
  if (favs.length) { add(mk('h3', '', 'Favourites')); favs.forEach(p => add(pageBtn(p))); }
  if (state.mode === 'simple') {
    add(mk('h3', '', 'Everyday tools'));
    SIMPLE_PAGES.map(id => PAGES[id]).filter(Boolean).forEach(p => add(pageBtn(p)));
    add(mk('p', 'railnote', 'Simple mode shows the everyday tools. Switch to Advanced for all ' + Object.keys(PAGES).length + '.'));
    return;
  }
  add(mk('h3', '', 'Workspaces'));
  const openWs = r.kind === 'ws' ? r.id : (r.kind === 'tool' ? wsOfPage(r.id) : '');
  WORKSPACES.forEach(w => {
    const open = w.id === openWs;
    const b = add(mk('button', 'rw' + (r.kind === 'ws' && r.id === w.id ? ' on' : '') + (open ? ' open' : ''), icon(w.icon) + '<span>' + hesc(w.name) + '</span>' + icon(open ? 'down' : 'right', 'chev')));
    b.dataset.ws = w.id; b.setAttribute('aria-expanded', open ? 'true' : 'false');
    b.onclick = () => go('#/w/' + w.id);
    if (!open) return;
    const box = add(mk('div', 'rsec'));
    w.sections.forEach(([name, ids]) => {
      box.appendChild(mk('h4', '', hesc(name)));
      ids.map(id => PAGES[id]).filter(Boolean).forEach(p => box.appendChild(pageBtn(p)));
    });
  });
  add(mk('h3', '', 'My shop'));
  MY_SHOP.map(id => PAGES[id]).filter(Boolean).forEach(p => add(pageBtn(p)));
  const on = $('#list .on'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' });
}

// ---- Search (top bar) ----
function searchHits(q) {
  q = q.trim().toLowerCase(); if (!q) return [];
  const words = q.split(/\s+/), out = [];
  const score = (title, rest) => { const t = title.toLowerCase(), all = t + ' ' + rest.toLowerCase(); if (!words.every(w => all.includes(w))) return 0; return (t.startsWith(q) ? 4 : 0) + (t.includes(q) ? 3 : 0) + (words.every(w => t.includes(w)) ? 2 : 0) + 1; };
  Object.values(PAGES).forEach(p => {
    if (!pageShown(p)) return;
    const s = score(p.title, p.desc || ''); if (s) out.push({ s: s + 0.5, id: p.id, title: p.title, sub: p.desc, icon: p.icon });
    pageTabs(p).forEach(tb => { const st = score(tb.tool.title, (tb.tool.desc || '') + ' ' + tb.label + ' ' + (tb.tool.group || '')); if (st) out.push({ s: st, id: tb.id, title: tb.tool.title, sub: 'In ' + p.title, icon: p.icon }); });
    if (!p.tabs && p.tool && !s) { const sg = score('', p.tool.group || ''); if (sg) out.push({ s: 0.5, id: p.id, title: p.title, sub: p.desc, icon: p.icon }); }
  });
  return out.sort((a, b) => b.s - a.s || a.title.localeCompare(b.title)).slice(0, 14);
}
function initSearch() {
  const inp = $('#search'), pop = $('#searchpop'); let hits = [], sel = 0;
  const close = () => { pop.hidden = true; };
  const paint = () => {
    const q = inp.value; hits = searchHits(q); sel = Math.min(sel, Math.max(0, hits.length - 1));
    if (!q.trim()) { close(); return; }
    pop.hidden = false;
    if (/#\/t\/\S+/.test(q)) { pop.innerHTML = '<div class="shn">Press Enter to open this link.</div>'; return; }
    pop.innerHTML = hits.length ? hits.map((h, i) => '<button class="sh' + (i === sel ? ' on' : '') + '" data-i="' + i + '">' + icon(h.icon) + '<span><b>' + hesc(h.title) + '</b><small>' + hesc(h.sub || '') + '</small></span></button>').join('')
      : '<div class="shn">No tool matches' + (state.mode === 'simple' ? ' in Simple mode. Switch to Advanced to search every tool.' : '.') + '</div>';
  };
  const pick = i => { const h = hits[i]; if (!h) return; inp.value = ''; close(); inp.blur(); openTool(h.id); };
  inp.oninput = () => { sel = 0; paint(); };
  inp.onfocus = paint;
  inp.onkeydown = e => {
    if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, hits.length - 1); paint(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); paint(); e.preventDefault(); }
    else if (e.key === 'Enter') { const m = /#\/t\/\S+/.exec(inp.value); if (m) { inp.value = ''; close(); inp.blur(); go(m[0]); } else pick(sel); }
    else if (e.key === 'Escape') { inp.value = ''; close(); inp.blur(); }
  };
  pop.onmousedown = e => { const b = e.target.closest('.sh'); if (b) { e.preventDefault(); pick(+b.dataset.i); } };
  inp.onblur = () => setTimeout(close, 120);
}

// ---- Main area ----
function render() {
  state.route = parseHash();
  const r = state.route;
  if (r.kind === 'ws') state.ws = r.id;
  if (r.kind === 'tool') { state.ws = wsOfPage(r.id); Recents.add(r.id); }
  lsSet('bm.route', (location.hash || '#/home').split('?')[0]);
  document.body.classList.remove('railopen');
  renderRail(); renderMain();
  const m = $('#main'); if (m) m.scrollTop = 0;
}
function renderMain() {
  const r = state.route, main = $('#main');
  main.innerHTML = ''; main.className = 'k-' + r.kind;
  if (r.kind === 'ws') renderWorkspace(main, WORKSPACES.find(w => w.id === r.id));
  else if (r.kind === 'tool') renderPage(main, PAGES[r.id], r.tab);
  else if (r.kind === 'news') renderNews(main);
  else Dash.render(main);
  $$('#bbar button').forEach(b => b.classList.toggle('on', b.dataset.b === (r.kind === 'home' ? 'home' : '')));
}

function pageCard(p) {
  const c = document.createElement('div'); c.className = 'tcard';
  const tabs = pageTabs(p);
  const b = document.createElement('button'); b.className = 'tcb'; b.dataset.id = p.id;
  b.innerHTML = '<span class="tci">' + icon(p.icon) + '</span><span class="tct"><b>' + hesc(p.title) + '</b><small>' + hesc(p.desc || '') + '</small>' +
    (tabs.length > 1 ? '<span class="chips">' + tabs.map(tb => '<i>' + hesc(tb.label) + '</i>').join('') + '</span>' : '') + '</span>';
  b.onclick = () => openTool(p.id);
  c.append(b, starBtn(p.id)); return c;
}
function renderWorkspace(main, w) {
  const head = document.createElement('div'); head.className = 'wshead';
  // Cards or a compact list: the user's choice, kept for all workspaces.
  const list = lsGet('bm.wsview') === 'list';
  head.innerHTML = '<span class="wsi">' + icon(w.icon) + '</span><div class="wst"><h1>' + hesc(w.name) + '</h1><p>' + hesc(w.blurb) + '</p></div>' +
    '<div class="seg wsv" role="group" aria-label="Show tools as"><button type="button" data-v="cards"' + (list ? '' : ' class="on"') + ' aria-pressed="' + !list + '">Cards</button><button type="button" data-v="list"' + (list ? ' class="on"' : '') + ' aria-pressed="' + list + '">List</button></div>';
  $$('.wsv button', head).forEach(bt => bt.onclick = () => { lsSet('bm.wsview', bt.dataset.v); renderMain(); });
  main.appendChild(head);
  const wsWrap = document.createElement('div'); wsWrap.className = list ? 'wslist' : ''; main.appendChild(wsWrap); main = wsWrap;
  w.sections.forEach(([name, ids]) => {
    const pages = ids.map(id => PAGES[id]).filter(p => p && pageShown(p)); if (!pages.length) return;
    const h = document.createElement('h2'); h.className = 'sech'; h.textContent = name; main.appendChild(h);
    const g = document.createElement('div'); g.className = 'cards'; pages.forEach(p => g.appendChild(pageCard(p))); main.appendChild(g);
  });
}

// One page: header with the common controls, tabs for a hub, then the tool.
function renderPage(main, page, tabId) {
  const tabs = page.tabs ? (pageTabs(page).length ? pageTabs(page) : page.tabs) : null;
  let tab = tabs ? (page.tabs.find(tb => tb.id === tabId) || tabs.find(tb => tb.id === lsGet('bm.tab.' + page.id)) || tabs[0]) : null;
  const t = tab ? tab.tool : page.tool;
  state.tool = t.id;
  takeLink(t);
  if (tab) lsSet('bm.tab.' + page.id, tab.id);
  const wsId = wsOfPage(page.id), ws = WORKSPACES.find(w => w.id === wsId);
  const sec = ws ? (ws.sections.find(s => s[1].includes(page.id)) || [''])[0] : (PAGE_HOME[page.id] || {}).section;
  const wrap = document.createElement('div'); wrap.className = 'tp' + (t.render ? ' custom' : '');
  wrap.innerHTML = '<header class="tph"><div class="crumb">' + (ws ? '<a href="#/w/' + ws.id + '">' + hesc(ws.name) + '</a>' : '<a href="#/home">Home</a>') + (sec ? '<span>/</span>' + hesc(sec) : '') + '</div>' +
    '<div class="tpt"><span class="tpi">' + icon(page.icon) + '</span><div class="tptt"><h1></h1><p class="desc"></p></div><div class="tpa"></div></div></header>' +
    (tabs && tabs.length > 1 ? '<div class="tabs" role="tablist">' + tabs.map(tb => '<button role="tab" data-tab="' + tb.id + '"' + (tb === tab ? ' class="on" aria-selected="true"' : '') + '>' + hesc(tb.label) + '</button>').join('') + '</div>' : '') +
    (state.mode === 'simple' && t.level !== 'simple' ? '<div class="modenote">This is an Advanced tool. It is shown here because you opened it directly.</div>' : '') +
    '<div class="tpb"></div>';
  $('h1', wrap).textContent = tab && tabs.length > 1 ? page.title : t.title === page.title ? t.title : (page.tabs ? page.title : t.title);
  $('.desc', wrap).textContent = tab ? (tabs.length > 1 ? tab.tool.desc : tab.tool.desc || page.desc) : t.desc;
  $$('.tabs button', wrap).forEach(b => b.onclick = () => go('#/t/' + page.id + '/' + b.dataset.tab));
  main.appendChild(wrap);
  const acts = $('.tpa', wrap), body = $('.tpb', wrap);
  const act = (name, title, fn, cls) => { const b = document.createElement('button'); b.className = 'ib ' + (cls || ''); b.innerHTML = icon(name); b.title = title; b.setAttribute('aria-label', title); b.onclick = fn; acts.appendChild(b); return b; };
  const why = document.createElement('details'); why.className = 'why';
  why.innerHTML = '<summary>Formula and sources</summary><div class="whyb"><p><b>' + (t.render ? 'Note' : 'Working') + ':</b> <span class="w"></span></p><p><b>Sources:</b> <span class="s"></span></p></div>';
  $('.w', why).textContent = t.working || ''; $('.s', why).textContent = t.source || '';
  why.open = state.mode === 'expert'; if (state.mode === 'simple') why.hidden = true;
  let api = null;
  if (t.render) {
    // Reference drawing for a tool that draws its own screen: a key to the names its tables use.
    // Folded state is the user's choice (one setting for all tools); folded by default in Compact view.
    const ref = !t.ownDrawing && typeof DIAGRAMS !== 'undefined' && DIAGRAMS[t.id];
    let rh = ''; if (ref) { try { rh = ref({}, state.sys, []) || ''; } catch (e) { rh = ''; } }
    if (rh) {
      const d = document.createElement('details'); d.className = 'dref'; d.dataset.kept = '1';
      const pref = lsGet('bm.dref');
      d.open = pref ? pref === '1' : !document.body.classList.contains('compact');
      d.innerHTML = '<summary>Drawing</summary><div class="tdia"></div>';
      $('.tdia', d).innerHTML = rh;
      $('summary', d).addEventListener('click', () => setTimeout(() => lsSet('bm.dref', d.open ? '1' : '0')));
      body.appendChild(d);
    }
    const card = document.createElement('div'); card.className = 'card wide'; card.innerHTML = '<div class="body"></div>'; body.appendChild(card);
    t.render($('.body', card));
  } else {
    api = mountTool(body, t, {});
    act('minus', 'Fewer decimal places', () => api.decimals(-1));
    act('plus', 'More decimal places', () => api.decimals(1));
    act('reset', 'Reset to the starting values', () => api.reset());
    act('copy', 'Copy the results', () => api.copy());
    act('pin', 'Pin this result to Home', () => api.pin());
  }
  const ub = document.createElement('button'); ub.className = 'ib unitb'; ub.textContent = state.sys === 'inch' ? 'in' : 'mm'; ub.title = 'Units: ' + (state.sys === 'inch' ? 'inch. Switch to mm' : 'mm. Switch to inch'); ub.setAttribute('aria-label', ub.title);
  ub.onclick = () => setUnits(state.sys === 'inch' ? 'mm' : 'inch'); acts.appendChild(ub);
  act('link', api ? 'Copy a link that reopens this calculator with these numbers' : 'Copy a link to this page', () => {
    const h = '#/t/' + page.id + (tab ? '/' + tab.id : '') + (api && api.query() ? '?' + api.query() : '');
    const web = /^https?:$/.test(location.protocol) && typeof window.BenchMateSave !== 'function';
    copyText(web ? location.origin + location.pathname + h : h);
    setTimeout(() => toast(web ? 'Link copied' : 'Link copied. Paste it into the search box to open it again.', 3200), 30);
  });
  act('print', 'Print this page: inputs, results, drawing and sources', printPage);
  act('info', 'Formula and sources', () => { why.hidden = false; why.open = !why.open || why.hidden; if (why.open) why.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });
  acts.appendChild(starBtn(page.id, 'ib'));
  body.appendChild(why);
  if (t.proof && t.proof.length && !t.render) body.appendChild(proofPanel(t));
  if (state.mode === 'expert') openDetails(main);
}
// Expert mode opens every evidence table a tool keeps folded. Tools that redraw are caught by the observer.
function openDetails(root) { $$('details:not([data-kept])', root).forEach(d => { d.open = true; d.dataset.kept = '1'; }); }

// ---- Links with numbers, printing and worked examples ----
// Numbers from a link (#/t/<page>?_sys=mm&dia=12): checked against the tool's own boxes, stored as its
// values, and the link is then shortened so later typing is not undone by a reload.
function takeLink(t) {
  const q = state.route && state.route.q; if (!q) return;
  state.route.q = null;
  if ((q._sys === 'inch' || q._sys === 'mm') && q._sys !== state.sys) markUnits(q._sys);
  if (!t.render && t.fields) {
    const ids = new Set(t.fields(state.sys).map(f => f.id)), vals = {};
    Object.keys(q).forEach(k => {
      const m = /^_src_(.+)$/.exec(k);
      if (m) { if (ids.has(m[1]) && ids.has(q[k])) vals[k] = q[k]; }
      else if (ids.has(k) && /^-?[0-9.eE+-]{1,24}$/.test(q[k]) && isFinite(parseFloat(q[k]))) vals[k] = q[k];
    });
    if (Object.keys(vals).length) { state.vals[t.id + ':' + state.sys] = vals; saveVals(); setTimeout(() => toast('Opened with the numbers from the link', 2400), 30); }
  }
  try { history.replaceState(null, '', location.pathname + location.search + location.hash.split('?')[0]); } catch (e) {}
  lsSet('bm.route', (location.hash || '#/home').split('?')[0]);
}
// Print the page in view: the sources are opened and a dated footer added for the paper, then put back.
function printSetup() {
  const main = $('#main'), opened = $$('details.why', main).filter(d => !d.open || d.hidden).map(d => [d, d.open, d.hidden]);
  opened.forEach(([d]) => { d.hidden = false; d.open = true; });
  const f = document.createElement('div'); f.className = 'printfoot';
  f.textContent = 'Machinists BenchMate ' + $('#ver').textContent + ', printed ' + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) + '. Results are a guide: check them before you cut.';
  main.appendChild(f);
  return () => { opened.forEach(([d, o, h]) => { d.open = o; d.hidden = h; }); f.remove(); };
}
function printPage() {
  if (typeof window.print !== 'function') { toast('Printing is not available here'); return; }
  const undo = printSetup(), done = () => { removeEventListener('afterprint', done); undo(); };
  addEventListener('afterprint', done);
  window.print();
}
// A worked example (t.proof[i]): the tool's own calculation run on the published inputs.
// expect rows are [label contains, unit or null, published value, tolerance].
function proofRun(t, ex) {
  const v = {};
  t.fields(ex.sys).forEach(f => { const x = ex.vals[f.id] !== undefined ? ex.vals[f.id] : f.def; v[f.id] = x === '' ? NaN : parseFloat(x); });
  (t.pairs || []).forEach(p => { if (p[4] !== 'both') v[ex.vals[p[1]] !== undefined && ex.vals[p[0]] === undefined ? p[0] : p[1]] = NaN; });
  let rows = []; try { rows = t.calc(v, state.W, ex.sys) || []; } catch (e) { rows = []; }
  return ex.expect.map(([lab, unit, val, tol]) => {
    const r = rows.find(x => String(x.label).replace(/<[^>]+>/g, '').indexOf(lab) >= 0 && (unit === null || x.unit === unit));
    const got = r && typeof r.value === 'number' ? r.value : NaN;
    return { label: r ? String(r.label).replace(/<[^>]+>/g, '') : lab, unit: r ? r.unit : unit || '', val, tol, got, dp: r ? r.dp : 4, ok: isFinite(got) && Math.abs(got - val) <= tol };
  });
}
function proofPanel(t) {
  const d = document.createElement('details'); d.className = 'why proof';
  d.innerHTML = '<summary>Worked example: check the maths</summary><div class="whyb"></div>';
  const box = $('.whyb', d);
  t.proof.forEach((ex, i) => {
    const fields = t.fields(ex.sys), res = proofRun(t, ex), sec = document.createElement('div'); sec.className = 'pex';
    const inputs = fields.filter(f => ex.vals[f.id] !== undefined).map(f => hesc(f.label) + ' <b>' + hesc(f.options ? (f.options.find(o => o[0] === ex.vals[f.id]) || ['', ex.vals[f.id]])[1] : ex.vals[f.id]) + '</b>' + (f.unit && !f.options ? ' ' + hesc(f.unit) : '')).join('; ');
    sec.innerHTML = '<p><b>' + hesc(ex.name) + '</b></p><p>Inputs: ' + inputs + '.</p>' +
      '<table class="ptab"><tr><th>Result</th><th>Published</th><th>BenchMate</th><th></th></tr>' + res.map(r => '<tr><td>' + hesc(r.label) + '</td><td class="v">' + hesc(String(r.val)) + ' ' + hesc(r.unit) + '</td><td class="v">' + fmt(r.got, Math.max(r.dp || 0, (String(r.val).split('.')[1] || '').length)) + ' ' + hesc(r.unit) + '</td><td>' +
        (r.ok ? '<span class="badge confirmed">Agrees</span>' : '<span class="badge differs">Differs</span>') + '</td></tr>').join('') + '</table>' +
      '<p><b>Source:</b> ' + hesc(ex.source) + '</p>' + (ex.note ? '<p>' + hesc(ex.note) + '</p>' : '') +
      '<p><button type="button" class="btn sm noprint" data-ex="' + i + '">Load these numbers</button></p>';
    box.appendChild(sec);
  });
  box.addEventListener('click', e => {
    const b = e.target.closest('button[data-ex]'); if (!b) return;
    const ex = t.proof[+b.dataset.ex], vals = {};
    Object.keys(ex.vals).forEach(k => { vals[k] = String(ex.vals[k]); });
    (t.pairs || []).forEach(p => { vals['_src_' + p[0]] = ex.vals[p[1]] !== undefined && ex.vals[p[0]] === undefined ? p[1] : p[0]; });
    if (ex.sys !== state.sys) markUnits(ex.sys);
    state.vals[t.id + ':' + ex.sys] = vals; saveVals(); renderMain();
    toast('Loaded the worked example');
  });
  return d;
}

// ---- The standard calculator view: inputs, results, drawing ----
// opts.mini: the small version used by Home widgets (main inputs, main results).
function mountTool(host, t, opts) {
  const mini = !!opts.mini, sys = state.sys;
  const fields = t.fields(sys);
  const key = t.id + ':' + sys;
  const saved = state.vals[key] || (state.vals[key] = {});
  const dpKey = 'bm.dp.' + t.id; let dpAdj = +lsGet(dpKey) || 0;
  host.innerHTML = '<div class="tg' + (mini ? ' mini' : '') + '"><section class="pane inputs">' + (mini ? '' : '<h2>Inputs</h2>') + (!mini && t.pick && (state.mode !== 'simple' || ToolLib.all().length) ? toolPickRow(t.pick) : '') +
    '<div class="grid"></div></section><section class="pane results"><div class="res" id="' + (mini ? '' : 'res') + '"></div><div class="tdia"></div></section></div>';
  const grid = $('.grid', host), res = $('.res', host), dia = $('.tdia', host);
  const pairs = (t.pairs || []).map(p => ({ a: p[0], b: p[1], ab: p[2], ba: p[3], both: p[4] === 'both' }));
  const pairOf = id => pairs.find(p => p.a === id || p.b === id);
  const src = {}; pairs.forEach(p => { src[p.a + p.b] = saved['_src_' + p.a] === p.b ? p.b : p.a; });
  let shownCount = 0; const els = {};
  const makeField = f => {
    const lab = document.createElement('label'); lab.className = 'f';
    const span = document.createElement('span'); span.textContent = f.label;
    const row = document.createElement('div'); row.className = 'row';
    let inp;
    // A field with `options: [[value, label], ...]` renders as a drop-down; the value is still a number.
    if (f.options) { inp = document.createElement('select'); f.options.forEach(([val, txt]) => { const o = document.createElement('option'); o.value = val; o.textContent = txt; inp.appendChild(o); }); }
    else { inp = document.createElement('input'); inp.type = 'number'; inp.step = 'any'; inp.inputMode = 'decimal'; }
    inp.value = saved[f.id] !== undefined ? saved[f.id] : f.def; inp.dataset.id = f.id;
    inp.oninput = inp.onchange = () => { saved[f.id] = inp.value; const p = pairOf(f.id); if (p) { src[p.a + p.b] = f.id; saved['_src_' + p.a] = f.id; } saveVals(); update(); };
    const u = document.createElement('span'); u.className = 'u'; u.textContent = f.unit;
    row.append(inp, u);
    if (!f.options && !mini && window.BenchCalc) { const cb = document.createElement('button'); cb.type = 'button'; cb.className = 'fx'; cb.innerHTML = icon('calc'); cb.title = 'Work this value out in the calculator'; cb.setAttribute('aria-label', cb.title); cb.tabIndex = -1; cb.onclick = e => { e.preventDefault(); BenchCalc.open(inp); }; row.appendChild(cb); }
    lab.append(span, row);
    // `when(v)`: show the field only when it applies (e.g. to the chosen shape).
    if (f.when) lab.dataset.when = f.id;
    const hide = !fieldShown(f) || (mini && shownCount >= 4 && !pairOf(f.id));
    if (hide) { lab.classList.add('lvhide'); if (saved[f.id] === undefined) inp.dataset.def = f.def; } else shownCount++;
    els[f.id] = { lab, inp, f }; return lab;
  };
  fields.forEach(f => {
    const p = pairOf(f.id);
    if (p && f.id === p.b) return;
    if (p && f.id === p.a) {
      const fb = fields.find(x => x.id === p.b), box = document.createElement('div'); box.className = 'pair';
      const sw = document.createElement('span'); sw.className = 'swap'; sw.innerHTML = icon('units'); sw.title = 'Type in either box; the other is worked out';
      box.append(makeField(f), sw, makeField(fb)); grid.appendChild(box); return;
    }
    grid.appendChild(makeField(f));
  });
  const read = () => { const v = {}; fields.forEach(f => { const e = els[f.id].inp; const x = e.dataset.def !== undefined ? e.dataset.def : e.value; v[f.id] = x === '' ? NaN : parseFloat(x); }); return v; };
  let last = [];
  function update() {
    const v = read(), vc = Object.assign({}, v);
    // Linked pairs: the box typed in last is the input; the other shows the worked-out value.
    // The calculation sees the worked-out box as blank (unless the pair says 'both'), so the result is the one asked for.
    pairs.forEach(p => {
      const from = src[p.a + p.b], to = from === p.a ? p.b : p.a, fn = from === p.a ? p.ab : p.ba;
      let out = NaN; try { out = fn(v, state.W, sys); } catch (e) {}
      const e = els[to].inp; e.value = isFinite(out) ? String(+out.toPrecision(7)) : ''; saved[to] = e.value; v[to] = isFinite(out) ? out : NaN;
      els[to].lab.classList.add('calcd'); els[from].lab.classList.remove('calcd'); vc[to] = p.both ? v[to] : NaN;
    });
    fields.forEach(f => { if (f.when) { let on = true; try { on = !!f.when(v); } catch (e) {} els[f.id].lab.hidden = !on; } });
    // Required boxes: a box with a starting value must hold a number.
    fields.forEach(f => { const need = f.def !== '' && !f.options && !pairOf(f.id); els[f.id].lab.classList.toggle('bad', need && !isFinite(v[f.id])); });
    let rows = [];
    try { rows = t.calc(vc, state.W, sys); } catch (e) { rows = []; }
    rows = rows.filter(r => typeof r.value === 'string' || isFinite(r.value));
    last = rows;
    const dp = r => Math.max(0, Math.min(10, (r.dp || 0) + (typeof r.value === 'number' && r.dp > 0 ? dpAdj : (dpAdj > 0 && typeof r.value === 'number' ? dpAdj : 0))));
    const warn = r => checkRow(r, sys, state.W);
    if (!rows.length) { res.innerHTML = '<div class="rempty">' + icon('info') + '<span>Enter the values ' + (mini ? '' : 'on the left ') + 'to see the result.</span></div>'; }
    else {
      const hero = rows[0], w0 = warn(hero), rest = rows.slice(1, mini ? 3 : rows.length);
      const longTxt = typeof hero.value === 'string' && hero.value.length > 24;
      res.innerHTML = '<div class="hero rrow' + (w0 ? ' over' : '') + (longTxt ? ' txt' : '') + '"><div class="hl">' + hero.label + '</div><div class="hv"><b>' + fmt(hero.value, dp(hero)) + '</b><span>' + hero.unit + '</span></div>' + (w0 ? '<div class="wmsg">' + icon('info') + w0 + '</div>' : '') + '</div>' +
        (rest.length ? '<table>' + rest.map(r => { const w = warn(r); return '<tr class="rrow' + (w ? ' over' : '') + '"><td>' + r.label + (w ? '<div class="wmsg">' + w + '</div>' : '') + '</td><td class="v' + (typeof r.value === 'string' && r.value.length > 24 ? ' txt' : '') + (r.value === 'PASS' || r.value === 'OK' ? ' good' : r.value === 'FAIL' ? ' fail' : '') + '">' + fmt(r.value, dp(r)) + '</td><td class="u">' + r.unit + '</td></tr>'; }).join('') + '</table>' : '');
    }
    // A tool may add a table under its results (t.table): { head, rows, dp, copies: [[label, text]] }.
    if (!mini && t.table) {
      let tb = null; try { tb = rows.length ? t.table(v, state.W, sys, dpAdj) : null; } catch (e) { tb = null; }
      if (tb && tb.rows.length) {
        const box = document.createElement('div'); box.className = 'rtab';
        box.innerHTML = '<div class="rtabh"><span>' + hesc(tb.title || '') + '</span></div><div class="rtabs"><table><thead><tr>' + tb.head.map(h => '<th>' + hesc(h) + '</th>').join('') + '</tr></thead><tbody>' +
          tb.rows.map(r => '<tr>' + r.map((c, i) => '<td' + (i ? ' class="v"' : '') + '>' + hesc(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
        (tb.copies || []).forEach(([label, text]) => { const b = document.createElement('button'); b.className = 'btn sm'; b.type = 'button'; b.innerHTML = icon('copy') + '<span>' + hesc(label) + '</span>'; b.onclick = () => copyText(text); $('.rtabh', box).appendChild(b); });
        res.appendChild(box);
      }
    }
    if (!mini) { const d = t.diagram || (typeof DIAGRAMS !== 'undefined' && DIAGRAMS[t.id]); let h = ''; if (d) { try { h = d(v, sys, rows) || ''; } catch (e) { h = ''; } } dia.innerHTML = h; dia.hidden = !h; }
  }
  const pick = $('#tpick', host);
  if (pick) pick.onchange = () => {
    const tool = ToolLib.get(pick.value); if (!tool) return;
    const vals = toolPickValues(t.pick, tool, sys);
    Object.entries(vals).forEach(([id, val]) => { if (els[id]) { els[id].inp.value = val; saved[id] = String(val); } });
    $('#tpickmsg', host).textContent = 'Filled from ' + ToolLib.describe(tool) + ': ' + (Object.keys(vals).map(id => (fields.find(f => f.id === id) || {}).label).filter(Boolean).join(', ') || 'nothing to fill') + '.';
    pick.value = ''; saveVals(); update();
  };
  update();
  const text = () => t.title + '\n' + last.map(r => r.label.replace(/<[^>]+>/g, '') + ': ' + fmt(r.value, r.dp) + (r.unit ? ' ' + r.unit : '')).join('\n');
  return {
    update,
    // The numbers on screen as a link query: every filled box, the unit system and which box of a linked pair was typed.
    query: () => { const q = new URLSearchParams(); q.set('_sys', sys);
      fields.forEach(f => { const e = els[f.id].inp, x = e.dataset.def !== undefined ? e.dataset.def : e.value; if (x !== '' && x !== undefined) q.set(f.id, x); });
      pairs.forEach(p => q.set('_src_' + p.a, src[p.a + p.b]));
      return q.toString(); },
    decimals: d => { dpAdj = Math.max(-3, Math.min(4, dpAdj + d)); lsSet(dpKey, String(dpAdj)); update(); },
    reset: () => { Object.keys(saved).forEach(k => delete saved[k]); saveVals(); mountToolAgain(); },
    copy: () => { if (last.length) copyText(text()); else toast('Nothing to copy yet'); },
    pin: () => { if (!last.length) { toast('Nothing to pin yet'); return; } const h = last[0];
      Pins.add({ tool: t.id, sys, title: t.title, vals: Object.assign({}, saved), label: h.label.replace(/<[^>]+>/g, ''), value: fmt(h.value, h.dp), unit: h.unit, when: Date.now(),
        inputs: fields.filter(f => fieldShown(f) && !els[f.id].lab.hidden && els[f.id].inp.value !== '').slice(0, 5).map(f => f.label + ' ' + (f.options ? els[f.id].inp.selectedOptions[0].textContent : els[f.id].inp.value) + (f.unit && !f.options ? ' ' + f.unit : '')) });
      toast('Pinned to Home'); },
  };
  function mountToolAgain() { if (mini) mountTool(host, t, opts); else renderMain(); }
}

// ---- What's new (from CHANGELOG.md, built into data/changelog.json) ----
async function renderNews(main) {
  main.innerHTML = '<div class="wshead"><span class="wsi">' + icon('book') + '</span><div><h1>What\'s new</h1><p>Every change to BenchMate, newest first.</p></div></div><div id="news" class="news"></div>';
  let d = null; try { d = await (await fetch('data/changelog.json')).json(); } catch (e) {}
  const box = $('#news', main); if (!box) return;
  if (!d || !Array.isArray(d.versions)) { box.textContent = 'The change list was not found (run scripts/build-web.sh).'; return; }
  box.innerHTML = d.versions.map(v => '<section class="pane"><h2>' + hesc(v.version) + (v.date ? ' <small>' + hesc(v.date) + '</small>' : '') + '</h2>' +
    v.groups.map(g => (g.name ? '<h3>' + hesc(g.name) + '</h3>' : '') + '<ul>' + g.items.map(i => '<li>' + hesc(i) + '</li>').join('') + '</ul>').join('') + '</section>').join('');
}

// ---- Units, theme, mode, compact view ----
function markUnits(u) {
  state.sys = u; lsSet('bm.units', u);
  if (window.BenchCalc) BenchCalc.unitsChanged();
  $$('#units button').forEach(b => { const on = b.dataset.u === u; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
}
function setUnits(u) { markUnits(u); renderMain(); }
// Theme: dark is the default look; 'auto' follows the system. (0.1.0 stored '' for Auto.)
function themePref() { const t = lsGet('bm.theme'); return t === 'light' || t === 'dark' ? t : (t === 'auto' || t === '') ? 'auto' : 'dark'; }
function setTheme(t) { document.documentElement.setAttribute('data-theme', t === 'light' || t === 'auto' ? t : 'dark'); }
setTheme(themePref());
// Accent colour: the user's choice, kept under bm.accent. Sets --key (the colour as chosen), --key-ink (black or
// white lettering to sit on it), and --key-lift / --key-drop (the colour lightened or darkened until it reads as
// text on the dark and the light panel). Colour maths only: WCAG relative luminance and contrast ratio.
const ACCENT_DEFAULT = '#ffb000';
const ACCENTS = [['#ffb000', 'Amber'], ['#ff6a3d', 'Orange'], ['#ff4d5e', 'Red'], ['#e86bd6', 'Magenta'], ['#5b9dff', 'Blue'], ['#35c5f0', 'Cyan'], ['#4fe08a', 'Green'], ['#d9dfe0', 'Steel']];
function accentPref() { const a = (lsGet('bm.accent') || '').toLowerCase(); return /^#[0-9a-f]{6}$/.test(a) ? a : ACCENT_DEFAULT; }
function setAccent(hex) {
  hex = /^#[0-9a-f]{6}$/i.test(hex || '') ? hex.toLowerCase() : ACCENT_DEFAULT;
  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const lum = c => { const [r, g, b] = c.map(x => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const ratio = (a, b) => { const la = lum(a), lb = lum(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };
  const toHex = c => '#' + c.map(x => Math.round(x).toString(16).padStart(2, '0')).join('');
  const toward = (c, t, bg) => { let out = c; for (let k = 0; k <= 20 && ratio(out, bg) < 4.5; k++) out = c.map((x, i) => x + (t[i] - x) * k / 20); return toHex(out); };
  const key = rgb(hex), st = document.documentElement.style;
  st.setProperty('--key', hex);
  st.setProperty('--key-ink', ratio(key, [20, 20, 20]) >= ratio(key, [255, 255, 255]) ? '#141414' : '#ffffff');
  st.setProperty('--key-lift', toward(key, [255, 255, 255], [27, 31, 34]));
  st.setProperty('--key-drop', toward(key, [0, 0, 0], [236, 238, 234]));
}
setAccent(accentPref());
function setMode(m) {
  if (!MODES.includes(m)) return;
  state.mode = m; lsSet('bm.mode', m);
  document.documentElement.dataset.mode = m;
  $$('#mode button').forEach(b => { const on = b.dataset.m === m; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
  const r = state.route;
  if (m === 'simple' && ((r.kind === 'tool' && !pageShown(PAGES[r.id])) || r.kind === 'ws')) { go('#/home'); return; }
  renderRail(); renderMain();
}
// Compact view: one column, the rail as a drawer and a bottom bar. 'auto' follows the window width.
function applyCompact() {
  const on = state.compactPref === 'on' || (state.compactPref === 'auto' && innerWidth < 820);
  document.body.classList.toggle('compact', on);
}
function setCompact(p) { state.compactPref = p; lsSet('bm.compact', p); applyCompact(); }
if (['on', 'off', 'auto'].includes(lsGet('bm.compact'))) state.compactPref = lsGet('bm.compact');

function initMenu() {
  const btn = $('#menubtn'), pop = $('#menupop');
  const seg = (id, opts, cur) => '<div class="seg" id="' + id + '">' + opts.map(([v, l]) => '<button data-v="' + v + '"' + (v === cur ? ' class="on"' : '') + '>' + l + '</button>').join('') + '</div>';
  const paint = () => {
    pop.innerHTML = '<div class="mrow"><span>Theme</span>' + seg('mtheme', [['dark', 'Dark'], ['light', 'Light'], ['auto', 'Auto']], themePref()) + '</div>' +
      '<div class="mrow macc"><span>Accent colour</span><div class="swatches" id="maccent">' +
      ACCENTS.map(([c, n]) => '<button data-c="' + c + '" title="' + n + (c === ACCENT_DEFAULT ? ' (standard)' : '') + '" aria-label="' + n + ' accent" style="background:' + c + '"' + (c === accentPref() ? ' class="on" aria-pressed="true"' : ' aria-pressed="false"') + '></button>').join('') +
      '<label class="swpick' + (ACCENTS.some(([c]) => c === accentPref()) ? '' : ' on') + '" title="Pick any colour"><input type="color" id="maccentpick" value="' + accentPref() + '" aria-label="Pick any accent colour">' + icon('theme') + '</label></div></div>' +
      '<div class="mrow"><span>Compact view</span>' + seg('mcompact', [['auto', 'Auto'], ['on', 'On'], ['off', 'Off']], state.compactPref) + '</div>' +
      '<div class="mrow narrowonly"><span>Mode</span>' + seg('mmode', MODES.map(m => [m, MODE_NAME[m]]), state.mode) + '</div>' +
      '<div class="mrow narrowonly"><span>Units</span>' + seg('munits', [['inch', 'inch'], ['mm', 'mm']], state.sys) + '</div>' +
      '<button class="mlink" data-go="#/news">' + icon('book') + 'What\'s new</button>' +
      '<button class="mlink" data-go="#/t/machines">' + icon('machine') + 'Machine profiles</button>' +
      '<button class="mlink" data-go="#/t/toollib">' + icon('toollib') + 'Tool library</button>' +
      '<div class="mabout">Machinists BenchMate ' + hesc($('#ver').textContent) + '. Open source, AGPL-3.0. Results are a guide: check them before you cut.</div>';
    $$('#mtheme button', pop).forEach(b => b.onclick = () => { lsSet('bm.theme', b.dataset.v); setTheme(b.dataset.v); paint(); if (state.route.kind !== 'home') renderMain(); });
    const accent = c => { lsSet('bm.accent', c); setAccent(c); };
    $$('#maccent button', pop).forEach(b => b.onclick = () => { accent(b.dataset.c); paint(); });
    $('#maccentpick', pop).oninput = e => accent(e.target.value);
    $('#maccentpick', pop).onchange = () => paint();
    $$('#mcompact button', pop).forEach(b => b.onclick = () => { setCompact(b.dataset.v); paint(); });
    $$('#mmode button', pop).forEach(b => b.onclick = () => { setMode(b.dataset.v); paint(); });
    $$('#munits button', pop).forEach(b => b.onclick = () => { setUnits(b.dataset.v); paint(); });
    $$('.mlink', pop).forEach(b => b.onclick = () => { pop.hidden = true; go(b.dataset.go); });
  };
  btn.onclick = e => { e.stopPropagation(); pop.hidden = !pop.hidden; if (!pop.hidden) paint(); };
  pop.addEventListener('click', e => e.stopPropagation());
  document.addEventListener('click', e => { if (!pop.hidden && !pop.contains(e.target) && e.target !== btn) pop.hidden = true; });
}

async function boot() {
  $$('[data-ic]').forEach(e => { e.insertAdjacentHTML('afterbegin', icon(e.dataset.ic)); });
  const resp = await fetch('benchmate.wasm');
  const { instance } = await WebAssembly.instantiate(await resp.arrayBuffer(), {});
  state.W = instance.exports;
  $('#ver').textContent = 'v0.2.0';
  refreshMachineSelect();
  $('#machine').onchange = e => { Profiles.setActive(e.target.value); renderMain(); };
  $$('#mode button').forEach(b => b.onclick = () => setMode(b.dataset.m));
  $$('#units button').forEach(b => b.onclick = () => setUnits(b.dataset.u));
  $$('#units button').forEach(b => { const on = b.dataset.u === state.sys; b.classList.toggle('on', on); });
  document.documentElement.dataset.mode = state.mode;
  $$('#mode button').forEach(b => { const on = b.dataset.m === state.mode; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
  new MutationObserver(() => { if (state.mode === 'expert' && state.route.kind === 'tool') openDetails($('#main')); }).observe($('#main'), { childList: true, subtree: true });
  initSearch(); initMenu(); applyCompact();
  addEventListener('resize', applyCompact);
  $('#calcbtn').onclick = () => { if (BenchCalc.isOpen) BenchCalc.close(); else BenchCalc.open(); };
  $('#railbtn').onclick = () => document.body.classList.toggle('railopen');
  $('#scrim').onclick = () => document.body.classList.remove('railopen');
  $$('#bbar button').forEach(b => b.onclick = () => {
    const k = b.dataset.b;
    if (k === 'home') go('#/home'); else if (k === 'tools') document.body.classList.toggle('railopen');
    else if (k === 'search') { document.body.classList.remove('railopen'); $('#search').focus(); } else if (k === 'calc') $('#calcbtn').click();
  });
  // Keyboard: Ctrl+K or / for search, Alt+C for the calculator.
  addEventListener('keydown', e => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || '')) || e.target.isContentEditable;
    if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) { e.preventDefault(); $('#search').focus(); $('#search').select(); }
    else if (e.altKey && (e.key === 'c' || e.key === 'C')) { e.preventDefault(); $('#calcbtn').click(); }
  });
  addEventListener('hashchange', render);
  if (!location.hash || location.hash === '#') { const r = lsGet('bm.route'); if (r && r !== '#/home') { history.replaceState(null, '', r); } }
  render();
}
boot().catch(e => { $('#main').textContent = 'Could not load the calculation module: ' + e.message; });
