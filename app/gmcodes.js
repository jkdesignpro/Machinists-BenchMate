'use strict';
// G and M code reference and macro reference, per control.
// Data: data/refdata.json key "gcodes", built by scripts/build_refdata.py from
// data/refdata/gcodes-evidence.json. Every row carries its source(s); a code
// that a control's sources do not list is shown as "not confirmed for this
// control", never borrowed from another control.
// Uses loadRef and rEsc from refdata.js and Profiles from profiles.js.

const GMUI = { ctrl: null, cmp: '', q: '', kind: '', mach: '', mctrl: null, mq: '' };
// Order matters: the more specific names are tried first.
const GM_MATCH_ORDER = ['siemens-iso', 'meldas', 'mitsubishi', 'siemens', 'fanuc', 'haas', 'heidenhain', 'okuma', 'mazak', 'generic'];

// Control id for the active machine profile, from its free-text "Control" field.
function gmProfileCtrl(G) {
  const m = typeof Profiles !== 'undefined' ? Profiles.active() : null;
  const txt = m && m.control ? String(m.control).toLowerCase() : '';
  if (!txt) return null;
  for (const id of GM_MATCH_ORDER) {
    const c = G.controls[id];
    if (c && c.match.some(w => txt.includes(w))) return id;
  }
  return null;
}
function gmProfileType() {
  const m = typeof Profiles !== 'undefined' ? Profiles.active() : null;
  if (!m || !m.type) return '';
  return /lathe/i.test(m.type) ? 'L' : /mill|router/i.test(m.type) ? 'M' : '';
}

// "G01", "g1", "G1." all become "G1"; "G54.1" stays "G54.1".
function gmNorm(code) {
  const m = /^\s*([gm])\s*0*(\d+)(?:\.(\d+))?\s*$/i.exec(code || '');
  if (!m) return null;
  return m[1].toUpperCase() + (m[2] === '' ? '0' : String(+m[2])) + (m[3] && +m[3] ? '.' + m[3].replace(/0+$/, '') : '');
}
function gmSort(a, b) {
  if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
  const na = parseFloat(a.code.slice(1)), nb = parseFloat(b.code.slice(1));
  return na - nb || (a.mill === b.mill ? 0 : a.mill ? -1 : 1);
}
const GM_KIND = { maker: 'maker', builder: 'machine builder', distributor: "maker's distributor", standard: 'public standard report', secondary: 'independent' };
function gmBadge(G, row) {
  const kinds = row.src.map(s => (G.sources[s.s] || {}).kind);
  if (row.status === 'confirmed') return '<span class="badge confirmed" title="Two independent public sources agree">Two sources</span>';
  if (kinds.includes('standard')) return '<span class="badge confirmed" title="Printed in a public standard or report">Public report</span>';
  if (kinds.includes('builder')) return '<span class="badge confirmed" title="Printed in the machine builder\'s document">Builder</span>';
  return '<span class="badge confirmed" title="Printed in the maker\'s own document">Maker</span>';
}
function gmSrc(G, row) {
  return row.src.map(s => {
    const S = G.sources[s.s] || {};
    const tip = S.publisher + ': ' + S.title + (S.edition ? ' (' + S.edition + ')' : '') + (s.at ? ', ' + s.at : '') + '\n' + S.url + '\nAccessed ' + S.accessed;
    return '<div class="ms" title="' + rEsc(tip) + '"><a href="' + rEsc(S.url) + '" target="_blank" rel="noopener">' + rEsc(s.s) + '</a>' + (s.at ? ' ' + rEsc(s.at) : '') + '</div>';
  }).join('');
}
function gmApps(r) { return r.mill && r.lathe ? 'Mill, lathe' : r.mill ? 'Mill' : 'Lathe'; }
function gmCtrlOptions(G, cur, blank) {
  return (blank ? '<option value="">' + blank + '</option>' : '') + Object.entries(G.controls).map(([id, c]) => '<option value="' + id + '"' + (id === cur ? ' selected' : '') + '>' + rEsc(c.name) + '</option>').join('');
}
function gmSourceList(G, ids) {
  const used = new Set(ids);
  return Object.entries(G.sources).filter(([k]) => used.has(k)).map(([k, s]) =>
    '<b>' + rEsc(k) + '</b> ' + rEsc(s.publisher) + ', <i>' + rEsc(s.title) + '</i>' + (s.edition ? ', ' + rEsc(s.edition) : '') +
    ' (' + rEsc(GM_KIND[s.kind] || s.kind) + '). <a href="' + rEsc(s.url) + '" target="_blank" rel="noopener">' + rEsc(s.url) + '</a>, accessed ' + rEsc(s.accessed) + '. ' + rEsc(s.note || '')).join('<br>');
}
function gmNotes(G, ctrl, sec) {
  const dis = G.disagreements.filter(d => d.ctrl === ctrl && (sec === 'macro' ? /macro|variable/i.test(d.topic) : !/macro|variable/i.test(d.topic)));
  const gaps = G.gaps[ctrl] || [];
  let h = '';
  if (dis.length) h += '<div class="res mtab gmbox"><div class="h">Where sources disagree</div><table>' + dis.map(d => '<tr><td><b>' + rEsc(d.topic) + '</b><div>' + rEsc(d.text) + '</div>' + gmSrc(G, d) + '</td></tr>').join('') + '</table></div>';
  if (gaps.length) h += '<div class="res mtab gmbox"><div class="h">Not yet confirmed for ' + rEsc(G.controls[ctrl].short) + ' (gaps)</div><table>' + gaps.map(g => '<tr><td>' + rEsc(g) + '</td></tr>').join('') + '</table></div>';
  return h;
}

async function renderGmCodes(el) {
  const R = await loadRef(el); if (!R) return;
  const G = R.gcodes; if (!G) { el.textContent = 'G-code data not found (run scripts/build-web.sh).'; return; }
  const fromProfile = gmProfileCtrl(G);
  if (!GMUI.ctrl) { GMUI.ctrl = fromProfile || 'generic'; if (!GMUI.mach) GMUI.mach = gmProfileType(); }
  el.innerHTML = '<div class="mfilter gmf">' +
    '<label class="gml"><span class="ms">Control</span><select id="gmc">' + gmCtrlOptions(G, GMUI.ctrl) + '</select></label>' +
    '<label class="gml"><span class="ms">Compare with</span><select id="gmx">' + gmCtrlOptions(G, GMUI.cmp, 'No comparison') + '</select></label>' +
    '<label class="gml"><span class="ms">Search code or word</span><input id="gmq" type="search" placeholder="G76, M98, thread, tap ..."></label>' +
    '<label class="gml"><span class="ms">Codes</span><select id="gmk"><option value="">G and M</option><option value="G">G only</option><option value="M">M only</option></select></label>' +
    '<label class="gml"><span class="ms">Machine</span><select id="gmm"><option value="">Mill and lathe</option><option value="M">Mill</option><option value="L">Lathe</option></select></label></div>' +
    '<p class="desc" id="gmprof"></p><div id="gmctl" class="note"></div><div id="gmres"></div><div id="gmnotes"></div><div id="gmsrc" class="note"></div>';
  const c = $('#gmc', el), x = $('#gmx', el), q = $('#gmq', el), k = $('#gmk', el), mm = $('#gmm', el);
  q.value = GMUI.q; k.value = GMUI.kind; mm.value = GMUI.mach;
  function rowsOf(ctrl) {
    const s = q.value.trim(), nq = gmNorm(s), low = s.toLowerCase();
    return G.codes.filter(r => r.ctrl === ctrl && (!k.value || r.kind === k.value) &&
      (!mm.value || (mm.value === 'M' ? r.mill : r.lathe)) &&
      (!s || (nq ? gmNorm(r.code) === nq : (r.code + ' ' + r.meaning + ' ' + r.note).toLowerCase().includes(low)))).sort(gmSort);
  }
  function cell(G, r) {
    return '<td><div>' + rEsc(r.meaning) + (r.option ? ' <span class="badge review" title="An option, or fitted by the machine builder">Option</span>' : '') + '</div>' +
      (r.note ? '<div class="ms">' + rEsc(r.note) + '</div>' : '') + '</td>';
  }
  function draw() {
    GMUI.ctrl = c.value; GMUI.cmp = x.value === c.value ? '' : x.value; GMUI.q = q.value; GMUI.kind = k.value; GMUI.mach = mm.value;
    const C = G.controls[GMUI.ctrl];
    $('#gmprof', el).textContent = fromProfile ? 'Active machine control: ' + G.controls[fromProfile].name + (fromProfile === GMUI.ctrl ? ' (selected).' : '.') : 'No active machine with a recognised control: pick one above. Machine profiles (Setup) set the default.';
    $('#gmctl', el).innerHTML = '<b>' + rEsc(C.name) + ':</b> ' + rEsc(C.note);
    const A = rowsOf(GMUI.ctrl), out = $('#gmres', el);
    const nq = gmNorm(q.value.trim());
    let h = '';
    if (!GMUI.cmp) {
      if (A.length) {
        h = '<div class="res mtab"><table><tr><th>Code</th><th>Meaning</th><th>Group</th><th>Use</th><th>Source</th></tr>' + A.map(r =>
          '<tr><td class="mv"><b>' + rEsc(r.code) + '</b></td>' + cell(G, r) + '<td class="mv">' + rEsc(r.group || '') + '</td><td>' + gmApps(r) + '</td><td>' + gmBadge(G, r) + gmSrc(G, r) + '</td></tr>').join('') + '</table></div>';
      }
      if (nq && !A.length) {
        const other = Object.keys(G.controls).filter(id => id !== GMUI.ctrl && G.codes.some(r => r.ctrl === id && gmNorm(r.code) === nq));
        h += '<p class="warn gmnc">' + rEsc(nq) + ' is not confirmed for ' + rEsc(C.name) + (mm.value ? ' (' + (mm.value === 'M' ? 'mill' : 'lathe') + ')' : '') + '.</p>' +
          (other.length ? '<p class="desc">Listed for: ' + other.map(id => '<a href="#" data-c="' + id + '">' + rEsc(G.controls[id].short) + '</a>').join(', ') + '. Its meaning there does not carry over to this control.</p>' : '<p class="desc">Not listed for any control here.</p>');
      } else if (!A.length) h += '<p class="warn">Nothing matches.</p>';
      h += '<p class="desc">' + A.length + ' of ' + G.codes.filter(r => r.ctrl === GMUI.ctrl).length + ' rows for this control. Hover a source for its title, edition and page; click it to open the document.</p>';
    } else {
      const B = rowsOf(GMUI.cmp), D = G.controls[GMUI.cmp];
      const keys = []; const seen = new Set();
      [...A, ...B].sort(gmSort).forEach(r => { const kk = gmNorm(r.code); if (!seen.has(kk)) { seen.add(kk); keys.push(kk); } });
      const side = (rows, kk, name) => {
        const rs = rows.filter(r => gmNorm(r.code) === kk);
        return rs.length ? '<td>' + rs.map(r => '<div><b class="mv">' + rEsc(r.code) + '</b> ' + rEsc(r.meaning) + ' <span class="ms">(' + gmApps(r) + ')</span>' + (r.option ? ' <span class="badge review">Option</span>' : '') + '</div>' + (r.note ? '<div class="ms">' + rEsc(r.note) + '</div>' : '') + gmBadge(G, r) + gmSrc(G, r)).join('<hr class="gmhr">') + '</td>'
          : '<td class="gmnc"><span class="ms">Not confirmed for ' + rEsc(name) + '</span></td>';
      };
      h = keys.length ? '<div class="res mtab"><table class="gmcmp"><tr><th>Code</th><th>' + rEsc(C.short) + '</th><th>' + rEsc(D.short) + '</th></tr>' +
        keys.map(kk => '<tr><td class="mv"><b>' + rEsc(kk) + '</b></td>' + side(A, kk, C.short) + side(B, kk, D.short) + '</tr>').join('') + '</table></div>' : '<p class="warn">Nothing matches.</p>';
      h += '<p class="desc">Side by side: ' + keys.length + (keys.length === 1 ? ' code. ' : ' codes. ') + 'Codes are matched by number (G01 = G1). "Not confirmed" means the sources read for that control do not list it; it may still exist, but BenchMate will not borrow another control\'s meaning.</p>';
    }
    out.innerHTML = h;
    out.querySelectorAll('a[data-c]').forEach(a => a.onclick = e => { e.preventDefault(); c.value = a.dataset.c; draw(); });
    $('#gmnotes', el).innerHTML = gmNotes(G, GMUI.ctrl, 'codes') + (GMUI.cmp ? gmNotes(G, GMUI.cmp, 'codes') : '');
    const ids = new Set(); G.codes.filter(r => r.ctrl === GMUI.ctrl || r.ctrl === GMUI.cmp).forEach(r => r.src.forEach(s => ids.add(s.s)));
    G.disagreements.filter(d => d.ctrl === GMUI.ctrl || d.ctrl === GMUI.cmp).forEach(d => d.src.forEach(s => ids.add(s.s)));
    $('#gmsrc', el).innerHTML = '<b>Sources for this view</b><br>' + gmSourceList(G, ids);
  }
  c.onchange = x.onchange = k.onchange = mm.onchange = draw; q.oninput = draw;
  draw();
}

async function renderMacroRef(el) {
  const R = await loadRef(el); if (!R) return;
  const G = R.gcodes; if (!G) { el.textContent = 'G-code data not found (run scripts/build-web.sh).'; return; }
  if (!GMUI.mctrl) GMUI.mctrl = gmProfileCtrl(G) || 'fanuc';
  const withMacro = Object.keys(G.controls).filter(id => G.macro.some(m => m.ctrl === id) || (G.gaps[id] || []).length);
  if (!withMacro.includes(GMUI.mctrl)) GMUI.mctrl = 'fanuc';
  el.innerHTML = '<div class="mfilter gmf"><label class="gml"><span class="ms">Control</span><select id="mrc">' +
    withMacro.map(id => '<option value="' + id + '"' + (id === GMUI.mctrl ? ' selected' : '') + '>' + rEsc(G.controls[id].name) + '</option>').join('') + '</select></label>' +
    '<label class="gml"><span class="ms">Search</span><input id="mrq" type="search" placeholder="WHILE, #500, GOTO, R parameter ..."></label></div>' +
    '<div id="mrres"></div><div id="mrnotes"></div><div id="mrsrc" class="note"></div>';
  const c = $('#mrc', el), q = $('#mrq', el); q.value = GMUI.mq;
  function draw() {
    GMUI.mctrl = c.value; GMUI.mq = q.value;
    const low = q.value.trim().toLowerCase();
    const rows = G.macro.filter(m => m.ctrl === GMUI.mctrl && (!low || (m.topic + ' ' + m.text).toLowerCase().includes(low)));
    $('#mrres', el).innerHTML = (rows.length ? '<div class="res mtab"><table><tr><th>Topic</th><th>What it does (in our words)</th><th>Source</th></tr>' + rows.map(m =>
      '<tr><td><b>' + rEsc(m.topic) + '</b></td><td>' + rEsc(m.text) + '</td><td>' + gmBadge(G, m) + gmSrc(G, m) + '</td></tr>').join('') + '</table></div>'
      : '<p class="warn">' + (low ? 'Nothing matches.' : 'No macro facts confirmed for this control yet: see the gaps below.') + '</p>') +
      '<p class="desc">Macro syntax differs between controls even when the idea is the same (Haas prints WH where Fanuc prints WHILE; Siemens uses R parameters and IF / ENDIF blocks; Heidenhain uses Q parameters; Okuma uses VC variables). Never move a macro between controls without checking each line.</p>';
    $('#mrnotes', el).innerHTML = gmNotes(G, GMUI.mctrl, 'macro');
    const ids = new Set(); rows.forEach(m => m.src.forEach(s => ids.add(s.s)));
    G.disagreements.filter(d => d.ctrl === GMUI.mctrl && /macro|variable/i.test(d.topic)).forEach(d => d.src.forEach(s => ids.add(s.s)));
    $('#mrsrc', el).innerHTML = '<b>Sources for this view</b><br>' + gmSourceList(G, ids);
  }
  c.onchange = draw; q.oninput = draw; draw();
}
