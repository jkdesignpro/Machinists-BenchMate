'use strict';
// Home: a dashboard of widgets the user picks, sizes and orders. Kept in this
// browser (localStorage key bm.dash). Widget kinds:
//   tool     a calculator in small form (its main inputs and main result), or a
//            launcher card for tools that need the full page
//   favs, recent, pins, calc, tip, toollib, news
const Dash = (() => {
  const KEY = 'bm.dash';
  const KINDS = {
    favs: { title: 'Favourites', icon: 'star', size: 's' },
    recent: { title: 'Recent tools', icon: 'recent', size: 's' },
    pins: { title: 'Pinned results', icon: 'pin', size: 'm' },
    calc: { title: 'Calculator', icon: 'calc', size: 'w' },
    tip: { title: 'Tip of the day', icon: 'info', size: 'm' },
    toollib: { title: 'Tool library', icon: 'toollib', size: 's' },
    news: { title: 'What\'s new', icon: 'book', size: 's' },
  };
  const SIZES = ['s', 'm', 'w', 'l', 'x'], SIZE_NAME = { s: 'small', m: 'medium', w: 'wide', l: 'large', x: 'full width' };
  // Columns of the 12-column grid each size takes (shell.css), for snapping a drag to the nearest size.
  const SPAN = { s: 3, m: 4, w: 6, l: 8, x: 12 }, SIZE_KEY = { s: 'S', m: 'M', w: 'W', l: 'L', x: 'F' };
  const T = id => ({ k: 'tool', id, size: 'm' });
  const K = (k, size) => ({ k, size: size || KINDS[k].size });
  const PRESETS = {
    turning: { name: 'Turning', icon: 'turning', blurb: 'Lathe work', items: [T('rpm'), T('lathefeed'), T('finish'), T('passtime'), T('taper'), K('pins'), K('favs'), K('recent'), K('tip')] },
    milling: { name: 'Milling', icon: 'milling', blurb: 'Mill work', items: [T('rpm'), T('feed'), T('chipthin'), T('ballcusp'), T('bolt'), K('pins'), K('favs'), K('recent'), K('tip')] },
    both: { name: 'Turning and milling', icon: 'machine', blurb: 'A bit of everything', items: [T('rpm'), T('feed'), T('lathefeed'), T('bolt'), T('passtime'), K('pins'), K('favs'), K('recent'), K('tip')] },
    inspect: { name: 'Inspection', icon: 'inspection', blurb: 'Measuring and checking', items: [T('gdttp'), T('wires'), T('fits'), T('sinebar'), T('hardness'), K('pins'), K('favs'), K('recent'), K('tip')] },
  };
  let L = null, loaded = false, editing = false, adding = false;
  const load = () => { if (loaded) return; loaded = true; L = lsJson(KEY, null); if (L && !Array.isArray(L.items)) L = null; };
  const save = () => lsPut(KEY, L);
  const toolOf = id => TOOLS.find(t => t.id === id);

  function body(w, el) {
    if (w.k === 'tool') {
      const t = toolOf(w.id); if (!t) { el.innerHTML = '<div class="wempty">This tool is no longer available.</div>'; return; }
      if (t.render) {
        el.innerHTML = '<div class="wlaunch"><p></p><button class="btn pri">Open</button></div>';
        $('p', el).textContent = t.desc; $('button', el).onclick = () => openTool(t.id);
      } else mountTool(el, t, { mini: true });
    } else if (w.k === 'favs' || w.k === 'recent') {
      const pages = (w.k === 'favs' ? Favs.pages() : Recents.pages()).slice(0, 8);
      el.innerHTML = pages.length ? '<div class="wlist">' + pages.map(p => '<button data-id="' + p.id + '">' + icon(p.icon) + '<span>' + hesc(p.title) + '</span></button>').join('') + '</div>'
        : '<div class="wempty">' + (w.k === 'favs' ? 'Star a tool to keep it here.' : 'Tools you open will show here.') + '</div>';
      $$('button', el).forEach(b => b.onclick = () => openTool(b.dataset.id));
    } else if (w.k === 'pins') {
      const pins = Pins.all();
      el.innerHTML = pins.length ? pins.slice(0, 6).map((p, i) => '<div class="wpin" data-i="' + i + '" tabindex="0" role="button"><div><small>' + hesc(p.title) + ' · ' + hesc(p.label) + '</small><b>' + hesc(p.value) + '</b> ' + hesc(p.unit || '') +
        '<small>' + hesc((p.inputs || []).join(' · ')) + '</small></div><button class="ib" data-x="' + i + '" title="Remove this pin" aria-label="Remove this pin">' + icon('close') + '</button></div>').join('')
        : '<div class="wempty">Use the pin button on a calculator to keep a result, with its inputs, here.</div>';
      $$('.wpin', el).forEach(d => { const open = () => { const p = pins[+d.dataset.i]; state.vals[p.tool + ':' + p.sys] = Object.assign({}, p.vals); if (state.sys !== p.sys) { state.sys = p.sys; lsSet('bm.units', p.sys); $$('#units button').forEach(b => b.classList.toggle('on', b.dataset.u === p.sys)); } openTool(p.tool); };
        d.onclick = open; d.onkeydown = e => { if (e.key === 'Enter') open(); }; });
      $$('[data-x]', el).forEach(b => b.onclick = e => { e.stopPropagation(); Pins.remove(+b.dataset.x); render($('#main')); });
    } else if (w.k === 'calc') {
      if (window.BenchCalc) BenchCalc.render(el);
    } else if (w.k === 'tip') {
      let i = Math.floor(Date.now() / 864e5) % TIPS.length;
      const paint = () => { const tp = TIPS[i]; el.innerHTML = '<div class="wtip">' + hesc(tp[0]) + '<small>' + hesc(tp[1]) + '</small></div><button class="btn" style="margin-top:10px">Another tip</button>'; $('button', el).onclick = () => { i = (i + 1) % TIPS.length; paint(); }; };
      paint();
    } else if (w.k === 'toollib') {
      const all = ToolLib.all(), by = {}; all.forEach(t => { by[t.type] = (by[t.type] || 0) + 1; });
      el.innerHTML = (all.length ? '<div class="wlist">' + Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, n]) => '<button>' + icon('toollib') + '<span>' + n + ' × ' + hesc(k) + '</span></button>').join('') + '</div>'
        : '<div class="wempty">Save your cutters once and fill diameters, flutes and lengths into any calculator.</div>') + '<button class="btn" style="margin-top:8px">Open tool library</button>';
      $$('button', el).forEach(b => b.onclick = () => openTool('toollib'));
    } else if (w.k === 'news') {
      el.innerHTML = '<div class="wempty">Loading...</div>';
      fetch('data/changelog.json').then(r => r.json()).then(d => { const v = (d.versions || []).find(x => x.groups.some(g => g.items.length)); if (!v || !el.isConnected) return;
        const items = v.groups.flatMap(g => g.items).slice(0, 3);
        el.innerHTML = '<b>' + hesc(v.version) + '</b><ul style="margin:6px 0 8px;padding-left:18px;color:var(--muted)">' + items.map(i => '<li>' + hesc(i.length > 110 ? i.slice(0, 107) + '...' : i) + '</li>').join('') + '</ul><button class="btn">See all changes</button>';
        $('button', el).onclick = () => go('#/news'); }).catch(() => { el.innerHTML = '<div class="wempty">The change list was not found.</div>'; });
    }
  }
  const titleOf = w => w.k === 'tool' ? ((toolOf(w.id) || {}).title || 'Tool') : KINDS[w.k].title;
  const iconOf = w => w.k === 'tool' ? ((PAGES[PAGE_OF[w.id]] || {}).icon || 'info') : KINDS[w.k].icon;

  function onboard(main) {
    main.innerHTML = '<div class="onb"><h1>Welcome to Machinists BenchMate</h1><p>What do you mostly do? This sets up your Home page. You can change every part of it later.</p><div class="cards"></div>' +
      '<p style="margin-top:18px"><button class="btn" id="onbskip">Skip: give me a general layout</button></p></div>';
    const g = $('.cards', main);
    Object.entries(PRESETS).forEach(([id, p]) => {
      const c = document.createElement('div'); c.className = 'tcard';
      c.innerHTML = '<button class="tcb" data-p="' + id + '"><span class="tci">' + icon(p.icon) + '</span><span class="tct"><b>' + hesc(p.name) + '</b><small>' + hesc(p.blurb) + '</small></span></button>';
      $('button', c).onclick = () => { L = { v: 1, items: p.items.map(x => Object.assign({}, x)) }; save(); render(main); };
      g.appendChild(c);
    });
    $('#onbskip', main).onclick = () => { L = { v: 1, items: PRESETS.both.items.map(x => Object.assign({}, x)) }; save(); render(main); };
  }

  function render(main) {
    load();
    if (!L) { onboard(main); return; }
    main.innerHTML = '<div class="dhead"><h1>Home<p>Your tools, your way. ' + (state.mode === 'simple' ? 'Simple mode: the everyday tools.' : MODE_NAME[state.mode] + ' mode.') + '</p></h1>' +
      '<button class="btn" id="dadd">' + icon('plus') + 'Add widget</button><button class="btn' + (editing ? ' pri' : '') + '" id="dedit">' + icon(editing ? 'check' : 'layout') + (editing ? 'Done' : 'Customise') + '</button></div><div class="dgrid' + (editing ? ' editing' : '') + '"></div>';
    const grid = $('.dgrid', main);
    $('#dedit', main).onclick = () => { editing = !editing; adding = false; render(main); };
    $('#dadd', main).onclick = () => { adding = !adding; editing = true; render(main); };
    if (adding) grid.appendChild(addPanel(main));
    if (!L.items.length && !adding) { const e = document.createElement('div'); e.className = 'wadd'; e.innerHTML = '<div class="wempty">Your Home page is empty. Use Add widget to put tools here.</div>'; grid.appendChild(e); }
    L.items.forEach((w, i) => {
      const d = document.createElement('section'); d.className = 'wd ' + (w.size || 'm') + (w.h ? ' hset' : ''); d.dataset.i = i;
      if (w.h) d.style.height = w.h + 'px';
      const pageId = w.k === 'tool' ? w.id : null;
      d.innerHTML = '<div class="wdh">' + icon(iconOf(w)) + '<b></b>' + (pageId ? '<a href="#" title="Open the full tool">Open' + icon('right') + '</a>' : '') + '</div><div class="wdb"></div>' +
        '<div class="wded"><button class="ib" data-a="l" title="Move earlier" aria-label="Move earlier">' + icon('left') + '</button><button class="ib" data-a="r" title="Move later" aria-label="Move later">' + icon('right') + '</button>' +
        '<span class="wsizes">' + SIZES.map(z => '<button type="button" data-z="' + z + '" class="' + ((w.size || 'm') === z ? 'on' : '') + '" title="' + SIZE_NAME[z] + '" aria-label="Size ' + SIZE_NAME[z] + '">' + SIZE_KEY[z] + '</button>').join('') + '</span>' +
        '<button class="ib" data-a="x" title="Remove" aria-label="Remove">' + icon('trash') + '</button></div>' +
        '<div class="wrsz" title="Drag to resize; double-click to fit the height to the contents" aria-hidden="true"></div>';
      $('b', d).textContent = titleOf(w);
      const a = $('.wdh a', d); if (a) a.onclick = e => { e.preventDefault(); openTool(pageId); };
      $$('.wsizes button', d).forEach(b => b.onclick = () => { w.size = b.dataset.z; save(); render(main); });
      $$('.wded button[data-a]', d).forEach(b => b.onclick = () => {
        const k = b.dataset.a;
        if (k === 'x') L.items.splice(i, 1);
        else { const j = i + (k === 'l' ? -1 : 1); if (j < 0 || j >= L.items.length) return; L.items.splice(j, 0, L.items.splice(i, 1)[0]); }
        save(); render(main);
      });
      // Resize by dragging the corner: the width snaps to the nearest size, the height is free (at least 90 px).
      const rz = $('.wrsz', d);
      rz.ondblclick = () => { w.h = 0; save(); render(main); };
      rz.onpointerdown = e => {
        e.preventDefault(); e.stopPropagation(); if (rz.setPointerCapture) rz.setPointerCapture(e.pointerId);
        const r0 = d.getBoundingClientRect(), col = grid.getBoundingClientRect().width / 12, x0 = e.clientX, y0 = e.clientY;
        d.draggable = false; d.classList.add('sizing');
        let size = w.size || 'm', h = r0.height;
        rz.onpointermove = ev => {
          const want = (r0.width + ev.clientX - x0) / col;
          size = SIZES.reduce((a, z) => Math.abs(SPAN[z] - want) < Math.abs(SPAN[a] - want) ? z : a, SIZES[0]);
          h = Math.max(90, Math.round(r0.height + ev.clientY - y0));
          SIZES.forEach(z => d.classList.toggle(z, z === size)); d.style.height = h + 'px'; d.classList.add('hset');
        };
        let moved = false;
        const mv0 = rz.onpointermove;
        rz.onpointermove = ev => { if (Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) > 3) moved = true; mv0(ev); };
        rz.onpointerup = () => {
          rz.onpointermove = rz.onpointerup = null; d.classList.remove('sizing');
          // A click without a drag changes nothing (and leaves the handle in place for a double-click).
          if (!moved) { d.draggable = editing; return; }
          w.size = size;
          if (Math.abs(h - r0.height) > 4) w.h = h;
          save(); render(main);
        };
      };
      if (editing) {
        d.draggable = true;
        d.ondragstart = e => { e.dataTransfer.setData('text/plain', String(i)); e.dataTransfer.effectAllowed = 'move'; d.classList.add('drag'); };
        d.ondragend = () => d.classList.remove('drag');
        d.ondragover = e => { e.preventDefault(); d.classList.add('over'); };
        d.ondragleave = () => d.classList.remove('over');
        d.ondrop = e => { e.preventDefault(); const from = +e.dataTransfer.getData('text/plain'); if (isNaN(from) || from === i) return; L.items.splice(i, 0, L.items.splice(from, 1)[0]); save(); render(main); };
      }
      grid.appendChild(d);
      try { body(w, $('.wdb', d)); } catch (err) { $('.wdb', d).textContent = 'This widget could not be shown.'; }
    });
  }

  function addPanel(main) {
    const p = document.createElement('div'); p.className = 'wadd';
    p.innerHTML = '<h2>Add a widget</h2><div class="chipsel" id="wkinds"></div><input type="search" id="wq" placeholder="Or find a tool to add, e.g. bolt circle" aria-label="Find a tool to add"><div class="chipsel" id="wtools" style="margin-top:10px"></div>' +
      '<p class="wempty" style="margin-top:6px">Start again from a ready-made layout: ' + Object.entries(PRESETS).map(([id, x]) => '<button class="btn" data-preset="' + id + '">' + hesc(x.name) + '</button>').join(' ') + '</p>';
    const add = w => { L.items.unshift(w); save(); adding = false; render(main); };
    const kinds = $('#wkinds', p);
    Object.entries(KINDS).forEach(([k, d]) => { const b = document.createElement('button'); b.innerHTML = icon(d.icon) + hesc(d.title); b.onclick = () => add(K(k)); kinds.appendChild(b); });
    const tools = $('#wtools', p), q = $('#wq', p);
    const paint = () => {
      const s = q.value.trim().toLowerCase(); tools.innerHTML = '';
      const list = TOOLS.filter(t => toolShown(t) && (s ? (t.title + ' ' + t.desc).toLowerCase().includes(s) : t.level === 'simple' && !t.render)).slice(0, 14);
      list.forEach(t => { const b = document.createElement('button'); b.innerHTML = icon((PAGES[PAGE_OF[t.id]] || {}).icon || 'info') + hesc(t.title); b.onclick = () => add(T(t.id)); tools.appendChild(b); });
      if (!list.length) tools.innerHTML = '<span class="wempty">No tool matches.</span>';
    };
    q.oninput = paint; paint();
    $$('[data-preset]', p).forEach(b => b.onclick = () => { L = { v: 1, items: PRESETS[b.dataset.preset].items.map(x => Object.assign({}, x)) }; save(); adding = false; render(main); });
    return p;
  }
  return { render, reset: () => { L = null; lsSet(KEY, 'null'); }, get layout() { return L; } };
})();
