'use strict';
// G and M code reference and macro reference, per control.
// Data: data/refdata.json key "gcodes", built by scripts/build_refdata.py from
// data/refdata/gcodes-evidence.json. Every row carries its source(s); a code
// that a control's sources do not list is shown as "not confirmed for this
// control", never borrowed from another control.
// Uses loadRef and rEsc from refdata.js and Profiles from profiles.js.

const GMUI = { ctrl: null, cmp: '', q: '', kind: '', mach: '', mctrl: null, mq: '', tag: '', open: -1 };

// Operation tags: BenchMate's own grouping of the codes, read from the meaning
// already in the data (nothing is added to a code). This is the only list of tags.
// Each tag: [id, chip label, words that put a meaning in it, words that keep it out].
// A code gets every tag that matches. "Cancel G43" style meanings take the tags of
// the code they cancel on the same control. A meaning that matches none is 'Other'.
const GM_TAGS = [
  ['motion', 'Motion', /rapid|linear|straight|\barc\b|\barc,|helix|involute|positioning|\bmove\b|movement|traverse|reference (point|position)|home position|machine zero|machine coordinates|^dwell|interpolation|tangential|chamfer of|corner rounding|automatic chamfering|retract from the contour|index on the fly/i,
    /cycle|bore|drill|bolt hole|absolute|incremental|compensation|infeed|repetition/i],
  ['path', 'Path control', /exact stop|exact path|continuous|cutting mode|look-ahead|smoothness|contour control|corner override|pre-control|high-speed cycle/i],
  ['holes', 'Hole cycles', /drill|bor(e|ing)\b|\btap\b|tapping|ream|centring|spot|bolt hole|canned|(canned|fixed) cycle: return|cycle (cancel|off)|cancel motion mode|broaching/i],
  ['turning', 'Turning cycles', /\brough|stock removal|finishing cycle|groov|cut-?off|facing cycle|end fac|end face (cutting|turning)|face cutting|o\.d\.|outer \/ inner|outside \/ inside|longitudinal cutting|pattern repeating|formed material|forming material|irregular path/i],
  ['milling', 'Milling cycles', /pocket|bore milling|engraving|contour repetition|polygonal|hob milling/i],
  ['thread', 'Threading', /thread|\btap\b|tapping/i],
  ['comp', 'Compensation', /compensation|cutter comp|nose r\b|tool offset (double )?(in|de)crease|tool centre point|paraxial|tool length offset/i],
  ['coords', 'Coordinates and offsets', /coordinate|work offset|offsets|zero offset|local coordinate|\(local\)|g92 shift|shift|^rotation|cancel rotation|mirror|scaling|polar|pole|cylindrical|preset|actual value|data input|data setting|tool definition|mapping|^milling mode/i],
  ['units', 'Units and modes', /inch|metric|millimetre|absolute|incremental|plane|diameter programming|radius programming|dialect|siemens mode|swiss-type/i, /cycle/i],
  ['spindle', 'Spindle and feed', /spindle|feed per|feed in units|inverse time|surface speed|cutting speed|peripheral speed|gear|live tool|rotary (\(milling\) )?tool|speed override|override switches|override ignore|asynchronous|synchronous feed|c-axis/i,
    /cycle|tap|plane|coolant|dwell|feature|tailstock|bore|drill/i],
  ['coolant', 'Coolant and air', /coolant|air blast|air jet/i],
  ['program', 'Program control', /program (stop|end)|end of (sub)?program|main program end|subprogram|macro|optional stop|jump if|alarm if|parameter entry|interactive|sleep mode|display media|output relay|two-process|modify a setting|blank form/i],
  ['probe', 'Probing and measuring', /prob|skip|measure/i],
  ['machine', 'Machine functions', /tool change|pallet|door|chuck|tailstock|steady rest|turret|parts catcher|brake|tool (un)?clamp|barrier|stroke (check|limit)|working area|chip auger|secondary spindle|spindle swap|servo bar|balance cut|cross machining/i],
];
const GM_TAG_NAME = Object.fromEntries(GM_TAGS.map(([id, name]) => [id, name]).concat([['other', 'Other']]));
const gmTagCache = new Map();
function gmTags(r, G) {
  const key = r.ctrl + '|' + r.meaning;
  if (gmTagCache.has(key)) return gmTagCache.get(key);
  let t = GM_TAGS.filter(([, , yes, no]) => yes.test(r.meaning) && !(no && no.test(r.meaning))).map(([id]) => id);
  const c = /^cancel ([GM]\d+(?:\.\d+)?)\b/i.exec(r.meaning);
  if (!t.length && c && G) {
    const target = G.codes.find(x => x.ctrl === r.ctrl && gmNorm(x.code) === gmNorm(c[1]) && x !== r);
    if (target) t = gmTags(target, G).slice();
  }
  if (!t.length) t.push('other');
  gmTagCache.set(key, t); return t;
}
// Order matters: the more specific names are tried first.
const GM_MATCH_ORDER = ['siemens-iso', 'meldas', 'mitsubishi', 'siemens', 'fanuc', 'haas', 'heidenhain', 'okuma', 'mazak', 'doosan', 'dmg', 'generic'];

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
  if (row.status === 'single') return '<span class="badge differs" title="One independent source and no maker document: check it on the control before relying on it">One source</span>';
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
// Letter addresses (word letters). Each column is one document's own table, in
// BenchMate's words: NIST RS274NGC (generic RS-274 / ISO 6983 base, Table 3,
// section 3.3.2, p. 16) and the Haas mill programming workbook (pp. 24-28).
// A letter a document does not list is shown as "not listed", never filled from
// the other column. Meanings depend on the G code in force (arcs, cycles).
const GM_ADDR = [
  ['A', 'A rotary axis', '4th axis (rotary)'],
  ['B', 'B rotary axis', '5th axis (rotary)'],
  ['C', 'C rotary axis', 'Auxiliary external rotary axis'],
  ['D', 'Tool radius compensation (offset) number', 'Tool diameter offset number'],
  ['E', '', 'Engraving feed rate; contouring accuracy'],
  ['F', 'Feed rate', 'Feed rate'],
  ['G', 'Preparatory (general) function', 'Preparatory function (G code)'],
  ['H', 'Tool length offset number', 'Tool length offset number'],
  ['I', 'Arc centre offset in X; X offset in the G87 cycle', 'Arc and canned cycle data'],
  ['J', 'Arc centre offset in Y; Y offset in the G87 cycle', 'Arc and canned cycle data'],
  ['K', 'Arc centre offset in Z; Z offset in the G87 cycle', 'Arc and canned cycle data'],
  ['L', 'Repeat count for canned cycles', 'Loop (repeat) count for the block'],
  ['M', 'Miscellaneous function', 'Miscellaneous function (M code)'],
  ['N', 'Line (sequence) number', 'Block (sequence) number'],
  ['O', '', 'Program number'],
  ['P', 'Dwell time (G4, canned cycles); key with G10', 'Dwell time; program number for M98, sequence number for M97; G103 look-ahead'],
  ['Q', 'Feed increment (peck) in G83', 'Optional canned cycle data'],
  ['R', 'Arc radius; canned cycle retract (R) plane', 'Arc and canned cycle data'],
  ['S', 'Spindle speed', 'Spindle speed'],
  ['T', 'Tool selection', 'Tool selection'],
  ['U', '', 'Auxiliary external linear axis'],
  ['V', '', 'Auxiliary external linear axis'],
  ['W', '', 'Auxiliary external linear axis'],
  ['X', 'X axis', 'X axis motion'],
  ['Y', 'Y axis', 'Y axis motion'],
  ['Z', 'Z axis', 'Z axis motion'],
];
function gmAddrTable(G) {
  const cell = t => t ? rEsc(t) : '<span class="ms">not listed</span>';
  return '<details class="gmbox" id="gmaddr"><summary><b>Letter addresses (what each word letter means)</b></summary>' +
    '<div class="res mtab"><table><tr><th>Letter</th><th>Generic RS-274 (NIST RS274NGC)</th><th>Haas mill</th></tr>' +
    GM_ADDR.map(([l, a, b]) => '<tr><td class="mv"><b>' + l + '</b></td><td>' + cell(a) + '</td><td>' + cell(b) + '</td></tr>').join('') + '</table></div>' +
    '<p class="desc">A word is a letter followed by a number (G01, X25.4, F0.2). I, J, K, L, P and R change meaning with the G code in force (NIST notes this), so read them with the arc or cycle they belong to. Other controls, and lathes, use some letters differently: check the control&#39;s own manual. Each column is that document&#39;s own list, in our words; "not listed" means that document does not define the letter.</p>' +
    '<div class="note">' + gmSrc(G, { src: [{ s: 'NIST', at: 'Table 3, section 3.3.2, p. 16' }, { s: 'HAAS_MWB', at: 'address codes, pp. 24-28' }] }) + '</div></details>';
}
function gmNotes(G, ctrl, sec) {
  const dis = G.disagreements.filter(d => d.ctrl === ctrl && (sec === 'macro' ? /macro|variable/i.test(d.topic) : !/macro|variable/i.test(d.topic)));
  const gaps = G.gaps[ctrl] || [];
  let h = '';
  if (dis.length) h += '<div class="res mtab gmbox"><div class="h">Where sources disagree</div><table>' + dis.map(d => '<tr><td><b>' + rEsc(d.topic) + '</b><div>' + rEsc(d.text) + '</div>' + gmSrc(G, d) + '</td></tr>').join('') + '</table></div>';
  if (gaps.length) h += '<div class="res mtab gmbox"><div class="h">Not yet confirmed for ' + rEsc(G.controls[ctrl].short) + ' (gaps)</div><table>' + gaps.map(g => '<tr><td>' + rEsc(g) + '</td></tr>').join('') + '</table></div>';
  return h;
}

// The info drawer for one code: everything the data holds for it, arranged; nothing added.
function gmDrawer(G, r) {
  const nq = gmNorm(r.code), C = G.controls[r.ctrl];
  const same = G.codes.filter(x => x !== r && gmNorm(x.code) === nq);
  const line = x => '<div><b class="mv">' + rEsc(x.code) + '</b> ' + rEsc(x.meaning) + ' <span class="ms">(' + gmApps(x) + ')</span>' + (x.option ? ' <span class="badge review">Option</span>' : '') + '</div>' + (x.note ? '<div class="ms">' + rEsc(x.note) + '</div>' : '');
  const here = same.filter(x => x.ctrl === r.ctrl), others = Object.keys(G.controls).filter(id => id !== r.ctrl);
  const listed = others.filter(id => same.some(x => x.ctrl === id)), missing = others.filter(id => !listed.includes(id));
  // Disagreements that name this code (G36, G036 ...) on any control.
  const m = /^([GM])(\d+)(?:\.(\d+))?$/.exec(nq || '');
  const re = m ? new RegExp('\\b' + m[1] + '0*' + m[2] + (m[3] ? '\\.' + m[3] : '') + '(?![\\d.])', 'i') : null;
  const dis = re ? G.disagreements.filter(d => re.test(d.topic + ' ' + d.text)) : [];
  const srcFull = x => x.src.map(s => {
    const S = G.sources[s.s] || {};
    return '<li><b>' + rEsc(s.s) + '</b>' + (s.at ? ', ' + rEsc(s.at) : '') + ': ' + rEsc(S.publisher || '') + ', <i>' + rEsc(S.title || '') + '</i>' + (S.edition ? ', ' + rEsc(S.edition) : '') +
      (S.kind ? ' (' + rEsc(GM_KIND[S.kind] || S.kind) + ')' : '') + '. ' + (S.url ? '<a href="' + rEsc(S.url) + '" target="_blank" rel="noopener">' + rEsc(S.url) + '</a>' : '') +
      (S.accessed ? ', accessed ' + rEsc(S.accessed) : '') + (S.note ? '. <span class="ms">' + rEsc(S.note) + '</span>' : '') + '</li>';
  }).join('');
  const dd = (t, v) => '<dt>' + t + '</dt><dd>' + v + '</dd>';
  return '<div class="gmdrawer" role="region" aria-label="' + rEsc(r.code + ' on ' + C.short) + '"><div class="gmdh"><span><b class="mv">' + rEsc(r.code) + '</b> ' + rEsc(r.meaning) + '<span class="ms gmdc">' + rEsc(C.name) + '</span></span>' +
    '<button type="button" class="btn sm gmdx" aria-label="Close the details">Close</button></div><dl class="gmdl">' +
    dd('Meaning', rEsc(r.meaning) + (r.option ? ' <span class="badge review" title="An option, or fitted by the machine builder">Option</span>' : '')) +
    (r.note ? dd('Note', rEsc(r.note)) : '') + (r.group ? dd('Modal group', '<span class="mv">' + rEsc(r.group) + '</span>') : '') +
    dd('Used on', gmApps(r)) + dd('Operation', gmTags(r, G).map(t => rEsc(GM_TAG_NAME[t])).join(', ') + ' <span class="ms">(BenchMate grouping)</span>') + dd('Evidence', gmBadge(G, r)) +
    (here.length ? dd('Also on ' + rEsc(C.short), here.map(line).join('')) : '') + '</dl>' +
    '<div class="gmdsec"><div class="h">Other controls</div>' + (listed.length ? '<table>' + listed.map(id => '<tr><td><b>' + rEsc(G.controls[id].short) + '</b></td><td>' + same.filter(x => x.ctrl === id).map(line).join('') + '</td></tr>').join('') + '</table>' : '') +
    (missing.length ? '<p class="ms">Not confirmed for: ' + missing.map(id => rEsc(G.controls[id].short)).join(', ') + '.</p>' : '') + '</div>' +
    (dis.length ? '<div class="gmdsec"><div class="h">Where sources disagree</div>' + dis.map(d => '<p><b>' + rEsc(G.controls[d.ctrl] ? G.controls[d.ctrl].short : d.ctrl) + ', ' + rEsc(d.topic) + ':</b> ' + rEsc(d.text) + '</p><ul class="gmdsrc">' + srcFull(d) + '</ul>').join('') + '</div>' : '') +
    '<div class="gmdsec"><div class="h">Sources</div><ul class="gmdsrc">' + srcFull(r) + '</ul></div></div>';
}

async function renderGmCodes(el) {
  const R = await loadRef(el); if (!R) return;
  const G = R.gcodes; if (!G) { el.textContent = 'G-code data not found (run scripts/build-web.sh).'; return; }
  const fromProfile = gmProfileCtrl(G);
  if (!GMUI.ctrl) { GMUI.ctrl = fromProfile || 'generic'; if (!GMUI.mach) GMUI.mach = gmProfileType(); }
  const idx = new Map(G.codes.map((r, i) => [r, i]));
  el.innerHTML = '<div class="mfilter gmf">' +
    '<label class="gml"><span class="ms">Control</span><select id="gmc">' + gmCtrlOptions(G, GMUI.ctrl) + '</select></label>' +
    '<label class="gml"><span class="ms">Compare with</span><select id="gmx">' + gmCtrlOptions(G, GMUI.cmp, 'No comparison') + '</select></label>' +
    '<label class="gml"><span class="ms">Search code or word</span><input id="gmq" type="search" placeholder="G76, M98, thread, tap ..."></label>' +
    '<label class="gml"><span class="ms">Codes</span><select id="gmk"><option value="">G and M</option><option value="G">G only</option><option value="M">M only</option></select></label>' +
    '<label class="gml"><span class="ms">Machine</span><select id="gmm"><option value="">Mill and lathe</option><option value="M">Mill</option><option value="L">Lathe</option></select></label></div>' +
    '<div class="fchips gmtags" id="gmt" role="group" aria-label="Filter by operation"></div>' +
    '<p class="desc" id="gmprof"></p><div id="gmctl" class="note"></div><div id="gmres"></div><div id="gmnotes"></div><div id="gmsrc" class="note"></div>' + gmAddrTable(G);
  const c = $('#gmc', el), x = $('#gmx', el), q = $('#gmq', el), k = $('#gmk', el), mm = $('#gmm', el), tg = $('#gmt', el);
  q.value = GMUI.q; k.value = GMUI.kind; mm.value = GMUI.mach;
  const tagOk = r => !GMUI.tag || gmTags(r, G).includes(GMUI.tag);
  function rowsOf(ctrl, noTag) {
    const s = q.value.trim(), nq = gmNorm(s), low = s.toLowerCase();
    return G.codes.filter(r => r.ctrl === ctrl && (!k.value || r.kind === k.value) &&
      (!mm.value || (mm.value === 'M' ? r.mill : r.lathe)) && (noTag || tagOk(r)) &&
      (!s || (nq ? gmNorm(r.code) === nq : (r.code + ' ' + r.meaning + ' ' + r.note).toLowerCase().includes(low)))).sort(gmSort);
  }
  function cell(G, r) {
    return '<td><div>' + rEsc(r.meaning) + (r.option ? ' <span class="badge review" title="An option, or fitted by the machine builder">Option</span>' : '') + '</div>' +
      (r.note ? '<div class="ms">' + rEsc(r.note) + '</div>' : '') + '</td>';
  }
  // Operation chips; each count is the rows the other filters leave.
  function chips() {
    const base = rowsOf(GMUI.ctrl, true).concat(GMUI.cmp ? rowsOf(GMUI.cmp, true) : []);
    const n = id => base.filter(r => gmTags(r, G).includes(id)).length;
    const ids = GM_TAGS.map(t => t[0]).concat(G.codes.some(r => gmTags(r, G).includes('other')) ? ['other'] : []);
    tg.innerHTML = '<button type="button" class="fchip' + (GMUI.tag ? '' : ' on') + '" data-t="" aria-pressed="' + !GMUI.tag + '">All</button>' +
      ids.map(id => { const on = GMUI.tag === id, cnt = n(id); return '<button type="button" class="fchip' + (on ? ' on' : '') + '" data-t="' + id + '" aria-pressed="' + on + '"' + (cnt || on ? '' : ' disabled') + '>' + rEsc(GM_TAG_NAME[id]) + ' <span class="gmtn">' + cnt + '</span></button>'; }).join('');
    tg.querySelectorAll('.fchip').forEach(b => b.onclick = () => { GMUI.tag = b.dataset.t; draw(); });
  }
  const rowAttrs = i => ' class="gmrow' + (GMUI.open === i ? ' open' : '') + '" data-i="' + i + '" tabindex="0" aria-expanded="' + (GMUI.open === i) + '"';
  function draw() {
    GMUI.ctrl = c.value; GMUI.cmp = x.value === c.value ? '' : x.value; GMUI.q = q.value; GMUI.kind = k.value; GMUI.mach = mm.value;
    const C = G.controls[GMUI.ctrl];
    chips();
    $('#gmprof', el).textContent = fromProfile ? 'Active machine control: ' + G.controls[fromProfile].name + (fromProfile === GMUI.ctrl ? ' (selected).' : '.') : 'No active machine with a recognised control: pick one above. Machine profiles (Setup) set the default.';
    $('#gmctl', el).innerHTML = '<b>' + rEsc(C.name) + ':</b> ' + rEsc(C.note);
    const A = rowsOf(GMUI.ctrl), out = $('#gmres', el);
    const nq = gmNorm(q.value.trim());
    const tagTxt = GMUI.tag ? ' tagged ' + GM_TAG_NAME[GMUI.tag] : '';
    let h = '';
    if (!GMUI.cmp) {
      if (A.length) {
        h = '<div class="res mtab"><table class="gmtab"><tr><th>Code</th><th>Meaning</th><th>Group</th><th>Use</th><th>Source</th></tr>' + A.map(r => {
          const i = idx.get(r);
          return '<tr' + rowAttrs(i) + '><td class="mv"><b>' + rEsc(r.code) + '</b></td>' + cell(G, r) + '<td class="mv">' + rEsc(r.group || '') + '</td><td>' + gmApps(r) + '</td><td>' + gmBadge(G, r) + gmSrc(G, r) + '</td></tr>' +
            (GMUI.open === i ? '<tr class="gmdrw"><td colspan="5">' + gmDrawer(G, r) + '</td></tr>' : '');
        }).join('') + '</table></div>';
      }
      if (nq && !A.length && !rowsOf(GMUI.ctrl, true).length) {
        const other = Object.keys(G.controls).filter(id => id !== GMUI.ctrl && G.codes.some(r => r.ctrl === id && gmNorm(r.code) === nq));
        h += '<p class="warn gmnc">' + rEsc(nq) + ' is not confirmed for ' + rEsc(C.name) + (mm.value ? ' (' + (mm.value === 'M' ? 'mill' : 'lathe') + ')' : '') + '.</p>' +
          (other.length ? '<p class="desc">Listed for: ' + other.map(id => '<a href="#" data-c="' + id + '">' + rEsc(G.controls[id].short) + '</a>').join(', ') + '. Its meaning there does not carry over to this control.</p>' : '<p class="desc">Not listed for any control here.</p>');
      } else if (!A.length) h += '<p class="warn">Nothing matches' + rEsc(tagTxt) + '.</p>';
      h += '<p class="desc">' + A.length + ' of ' + G.codes.filter(r => r.ctrl === GMUI.ctrl).length + ' rows for this control' + rEsc(tagTxt) + '. Click a row to see everything BenchMate holds on that code. Hover a source for its title, edition and page; click it to open the document.</p>';
    } else {
      const B = rowsOf(GMUI.cmp), D = G.controls[GMUI.cmp];
      const keys = []; const seen = new Set();
      [...A, ...B].sort(gmSort).forEach(r => { const kk = gmNorm(r.code); if (!seen.has(kk)) { seen.add(kk); keys.push(kk); } });
      const side = (rows, kk, name) => {
        const rs = rows.filter(r => gmNorm(r.code) === kk);
        return rs.length ? '<td>' + rs.map(r => '<div><b class="mv">' + rEsc(r.code) + '</b> ' + rEsc(r.meaning) + ' <span class="ms">(' + gmApps(r) + ')</span>' + (r.option ? ' <span class="badge review">Option</span>' : '') + '</div>' + (r.note ? '<div class="ms">' + rEsc(r.note) + '</div>' : '') + gmBadge(G, r) + gmSrc(G, r)).join('<hr class="gmhr">') + '</td>'
          : '<td class="gmnc"><span class="ms">Not confirmed for ' + rEsc(name) + '</span></td>';
      };
      // Side by side, a row opens the drawer for the first control that lists the code.
      h = keys.length ? '<div class="res mtab"><table class="gmcmp gmtab"><tr><th>Code</th><th>' + rEsc(C.short) + '</th><th>' + rEsc(D.short) + '</th></tr>' +
        keys.map(kk => {
          const r0 = A.find(r => gmNorm(r.code) === kk) || B.find(r => gmNorm(r.code) === kk), i = idx.get(r0);
          return '<tr' + rowAttrs(i) + '><td class="mv"><b>' + rEsc(kk) + '</b></td>' + side(A, kk, C.short) + side(B, kk, D.short) + '</tr>' +
            (GMUI.open === i ? '<tr class="gmdrw"><td colspan="3">' + gmDrawer(G, r0) + '</td></tr>' : '');
        }).join('') + '</table></div>' : '<p class="warn">Nothing matches' + rEsc(tagTxt) + '.</p>';
      h += '<p class="desc">Side by side: ' + keys.length + (keys.length === 1 ? ' code' : ' codes') + rEsc(tagTxt) + '. Codes are matched by number (G01 = G1). "Not confirmed" means the sources read for that control do not list it; it may still exist, but BenchMate will not borrow another control\'s meaning. Click a row for more on that code.</p>';
    }
    out.innerHTML = h;
    out.querySelectorAll('a[data-c]').forEach(a => a.onclick = e => { e.preventDefault(); c.value = a.dataset.c; draw(); });
    const refocus = i => { const t = out.querySelector('tr.gmrow[data-i="' + i + '"]'); if (t) t.focus({ preventScroll: true }); };
    const toggle = tr => { const i = +tr.dataset.i; GMUI.open = GMUI.open === i ? -1 : i; draw(); refocus(i); };
    out.querySelectorAll('tr.gmrow').forEach(tr => {
      tr.onclick = e => { if (e.target.closest('a, button')) return; toggle(tr); };
      tr.onkeydown = e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === tr) { e.preventDefault(); toggle(tr); } };
    });
    out.querySelectorAll('.gmdx').forEach(b => b.onclick = () => { const i = GMUI.open; GMUI.open = -1; draw(); refocus(i); });
    $('#gmnotes', el).innerHTML = gmNotes(G, GMUI.ctrl, 'codes') + (GMUI.cmp ? gmNotes(G, GMUI.cmp, 'codes') : '');
    const ids = new Set(); G.codes.filter(r => r.ctrl === GMUI.ctrl || r.ctrl === GMUI.cmp).forEach(r => r.src.forEach(s => ids.add(s.s)));
    G.disagreements.filter(d => d.ctrl === GMUI.ctrl || d.ctrl === GMUI.cmp).forEach(d => d.src.forEach(s => ids.add(s.s)));
    $('#gmsrc', el).innerHTML = '<b>Sources for this view</b><br>' + gmSourceList(G, ids);
  }
  c.onchange = x.onchange = k.onchange = mm.onchange = draw; q.oninput = draw;
  draw();
}

// Numbers a search names: "#3003", "3003" or "#5021-#5025" find the rows whose ranges hold them.
function gmVarHit(row, low) {
  const nums = (low.match(/\d+/g) || []).map(Number);
  return nums.length > 0 && nums.every(n => row.ranges.some(([a, b]) => n >= a && n <= b));
}

async function renderMacroRef(el) {
  const R = await loadRef(el); if (!R) return;
  const G = R.gcodes; if (!G) { el.textContent = 'G-code data not found (run scripts/build-web.sh).'; return; }
  const SV = G.sysvars || [];
  if (!GMUI.mctrl) GMUI.mctrl = gmProfileCtrl(G) || 'fanuc';
  const withMacro = Object.keys(G.controls).filter(id => G.macro.some(m => m.ctrl === id) || SV.some(v => v.ctrl === id) || (G.gaps[id] || []).length);
  if (!withMacro.includes(GMUI.mctrl)) GMUI.mctrl = 'fanuc';
  el.innerHTML = '<div class="mfilter gmf"><label class="gml"><span class="ms">Control</span><select id="mrc">' +
    withMacro.map(id => '<option value="' + id + '"' + (id === GMUI.mctrl ? ' selected' : '') + '>' + rEsc(G.controls[id].name) + '</option>').join('') + '</select></label>' +
    '<label class="gml"><span class="ms">Search</span><input id="mrq" type="search" placeholder="WHILE, #3000, 5023, offset, timer ..."></label></div>' +
    '<div id="mrres"></div><div id="mrsv"></div><div id="mrnotes"></div><div id="mrsrc" class="note"></div>';
  const c = $('#mrc', el), q = $('#mrq', el); q.value = GMUI.mq;
  function draw() {
    GMUI.mctrl = c.value; GMUI.mq = q.value;
    const low = q.value.trim().toLowerCase();
    const rows = G.macro.filter(m => m.ctrl === GMUI.mctrl && (!low || (m.topic + ' ' + m.text).toLowerCase().includes(low)));
    const all = SV.filter(v => v.ctrl === GMUI.mctrl);
    // A search made only of a number (with or without #) is a variable number: match it against the ranges.
    const numOnly = /^#?\d+(\s*(-|to)\s*#?\d+)?$/.test(low);
    const vars = all.filter(v => !low || (numOnly ? gmVarHit(v, low) : (v.group + ' ' + v.var + ' ' + v.text).toLowerCase().includes(low)));
    $('#mrres', el).innerHTML = (rows.length ? '<div class="res mtab"><table><tr><th>Topic</th><th>What it does (in our words)</th><th>Source</th></tr>' + rows.map(m =>
      '<tr><td><b>' + rEsc(m.topic) + '</b></td><td>' + rEsc(m.text) + '</td><td>' + gmBadge(G, m) + gmSrc(G, m) + '</td></tr>').join('') + '</table></div>'
      : '<p class="warn">' + (low ? 'No macro fact matches.' : 'No macro facts confirmed for this control yet: see the gaps below.') + '</p>') +
      '<p class="desc">Macro syntax differs between controls even when the idea is the same (Haas prints WH where Fanuc prints WHILE; Siemens uses R parameters and IF / ENDIF blocks; Heidenhain uses Q parameters; Okuma uses VC variables). Never move a macro between controls without checking each line.</p>';
    let h = '';
    if (all.length) {
      h = '<div class="res mtab gmbox" id="mrsvt"><div class="h">System variables: ' + rEsc(G.controls[GMUI.mctrl].short) + ' <span class="ms">(' + vars.length + ' of ' + all.length + ')</span></div>';
      if (vars.length) {
        h += '<table><tr><th>Variable</th><th>What it holds (in our words)</th><th>Source</th></tr>';
        let grp = '';
        for (const v of vars) {
          if (v.group !== grp) { grp = v.group; h += '<tr class="svgrp"><td colspan="3"><b>' + rEsc(grp) + '</b></td></tr>'; }
          h += '<tr><td class="mv svv">' + rEsc(v.var.replace(/-/g, ' to ')) + '</td><td>' + rEsc(v.text) + '</td><td>' + gmBadge(G, v) + gmSrc(G, v) + '</td></tr>';
        }
        h += '</table>';
      } else h += '<p class="warn">No system variable matches. A number that is not in this list is not confirmed for this control: it is not borrowed from another control.</p>';
      h += '<p class="desc">A system variable reads or changes the control itself. The numbers depend on the control model, its options and the machine builder, and a wrong write can change an offset or an output: read a variable back and compare it with the screen before a program writes to it. "One source" rows have no maker document behind them.</p></div>';
    } else if (!rows.length || low) h = '<p class="desc" id="mrsvt">No system variables confirmed for ' + rEsc(G.controls[GMUI.mctrl].short) + ' yet.</p>';
    $('#mrsv', el).innerHTML = h;
    $('#mrnotes', el).innerHTML = gmNotes(G, GMUI.mctrl, 'macro');
    const ids = new Set(); rows.forEach(m => m.src.forEach(s => ids.add(s.s))); vars.forEach(v => v.src.forEach(s => ids.add(s.s)));
    G.disagreements.filter(d => d.ctrl === GMUI.mctrl && /macro|variable/i.test(d.topic)).forEach(d => d.src.forEach(s => ids.add(s.s)));
    $('#mrsrc', el).innerHTML = '<b>Sources for this view</b><br>' + gmSourceList(G, ids);
  }
  c.onchange = draw; q.oninput = draw; draw();
}
