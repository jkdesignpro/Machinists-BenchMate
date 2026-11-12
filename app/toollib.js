'use strict';
// Tool library: end mills, drills, taps, reamers, inserts and other cutting
// tools, kept in this browser (localStorage) with JSON export and import,
// and a picker that fills tool diameter, flutes and lengths into the
// calculators. Each tool keeps the units it was entered in; values are
// converted (1 in = 25.4 mm exactly) when they are filled into a calculator
// in the other unit system. Nothing is calculated here.

const ToolLib = (() => {
  const KEY = 'bm.tools';
  let list = [];
  try { list = JSON.parse(localStorage.getItem(KEY) || '[]'); if (!Array.isArray(list)) list = []; } catch (e) { list = []; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {} };
  const TYPES = ['End mill', 'Ball end mill', 'Corner radius end mill', 'Face mill', 'Chamfer mill', 'Thread mill', 'Drill', 'Spot / centre drill', 'Tap (cutting)', 'Tap (forming)', 'Reamer', 'Boring bar', 'Turning insert', 'Grooving / parting insert', 'Threading insert', 'Other'];
  const MATERIALS = ['', 'Solid carbide', 'HSS', 'HSS-Co (cobalt)', 'Carbide insert', 'Cermet', 'Ceramic', 'CBN', 'PCD', 'Other'];
  // [key, label, kind, hint]. kind: text, select:<list>, len (in the tool's units), int, deg, pitch.
  const FIELDS = [
    ['name', 'Name or description (optional)', 'text', 'e.g. 12 mm 3FL aluminium rougher'],
    ['type', 'Type', 'types', ''],
    ['units', 'Units of this tool', 'units', ''],
    ['tno', 'Tool number / pocket (optional)', 'text', 'e.g. T12'],
    ['dia', 'Cutting diameter', 'len', ''],
    ['shank', 'Shank diameter', 'len', ''],
    ['flutes', 'Number of flutes / teeth', 'int', ''],
    ['flute_len', 'Flute length (length of cut)', 'len', ''],
    ['oal', 'Overall length', 'len', ''],
    ['stick', 'Stick-out from the holder', 'len', ''],
    ['cr', 'Corner radius / nose radius', 'len', ''],
    ['fn_min', 'Chip breaker range: feed per rev from (inserts)', 'len', ''],
    ['fn_max', 'Chip breaker range: feed per rev to', 'len', ''],
    ['ap_min', 'Chip breaker range: depth of cut from', 'len', ''],
    ['ap_max', 'Chip breaker range: depth of cut to', 'len', ''],
    ['point', 'Point angle (drills)', 'deg', ''],
    ['pitch', 'Thread pitch (taps, thread mills): mm, or TPI for an inch tool', 'pitch', ''],
    ['material', 'Tool material', 'materials', ''],
    ['coating', 'Coating', 'text', 'e.g. AlTiN, TiB2, uncoated'],
    ['maker', 'Maker', 'text', ''],
    ['part', 'Part number', 'text', ''],
    ['notes', 'Notes', 'text', ''],
  ];
  const LEN = ['dia', 'shank', 'flute_len', 'oal', 'stick', 'cr', 'fn_min', 'fn_max', 'ap_min', 'ap_max'];
  const newId = () => 't' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
  const same = (a, b) => FIELDS.every(([k]) => String(a[k] ?? '') === String(b[k] ?? ''));
  const describe = t => {
    if (t.name) return t.name;
    const u = t.units === 'in' ? ' in' : ' mm';
    return [t.tno, t.type, t.dia ? 'Ø' + t.dia + u : '', t.flutes ? t.flutes + ' fl' : '', t.cr ? 'R' + t.cr : '', t.maker].filter(Boolean).join(' ');
  };
  return {
    FIELDS, TYPES, MATERIALS, LEN, describe,
    all: () => list,
    get: id => list.find(t => t.id === id) || null,
    upsert: t => { if (!t.id) t.id = newId(); const i = list.findIndex(x => x.id === t.id); if (i >= 0) list[i] = t; else list.push(t); save(); return t; },
    remove: id => { list = list.filter(t => t.id !== id); save(); },
    exportJson: () => JSON.stringify({ benchmate_tools: 1, tools: list }, null, 1),
    // Import never overwrites: identical tools are skipped, anything else is added as a new tool.
    importJson: txt => {
      const d = JSON.parse(txt);
      if (!d || !Array.isArray(d.tools)) throw new Error('Not a BenchMate tool library file');
      let added = 0, skipped = 0;
      d.tools.forEach(t => {
        if (!t || typeof t !== 'object' || !t.type) { skipped++; return; }
        const clean = {}; FIELDS.forEach(([k]) => { if (t[k] !== undefined && t[k] !== null) clean[k] = String(t[k]); });
        if (clean.units !== 'in') clean.units = 'mm';
        if (list.some(x => same(x, clean))) { skipped++; return; }
        clean.id = newId(); list.push(clean); added++;
      });
      save(); return { added, skipped };
    },
    // A tool value in the calculator's unit system, or NaN when the tool has none.
    value: (t, k, sys) => {
      const v = t[k] === '' || t[k] === undefined ? NaN : Number(t[k]);
      if (!isFinite(v)) return NaN;
      const tin = t.units === 'in', win = sys === 'inch';
      if (LEN.includes(k) && tin !== win) return tin ? v * 25.4 : v / 25.4;
      return v;
    },
    // Thread pitch in mm (a TPI value for inch tools).
    pitchMm: t => { const v = Number(t.pitch); if (!(v > 0)) return NaN; return t.units === 'in' ? 25.4 / v : v; },
  };
})();

// Picker spec on a calculator: { map: { fieldId: toolKey | 'material' }, clear: [fieldIds], types: [..] }.
// Returns the markup of a picker row, or '' when the library has no matching tool.
function toolPickOptions(spec) {
  const ok = t => (!spec.types || spec.types.some(p => t.type.startsWith(p))) && Object.values(spec.map).some(k => k !== 'material' && t[k] !== undefined && t[k] !== '');
  return ToolLib.all().filter(ok);
}
function toolPickRow(spec) {
  const tools = toolPickOptions(spec);
  if (!ToolLib.all().length) return '<div class="tpick ms">Tip: save your tools in Setup &gt; Tool library to fill diameter, flutes and lengths here.</div>';
  if (!tools.length) return '<div class="tpick ms">No tool in your library has values for this calculator.</div>';
  return '<div class="tpick"><label for="tpick">Fill from tool library</label><select id="tpick"><option value="">Choose a tool...</option>' +
    tools.map(t => '<option value="' + sesc(t.id) + '">' + sesc(ToolLib.describe(t)) + '</option>').join('') + '</select><span class="ms" id="tpickmsg"></span></div>';
}
// Values for the calculator fields from tool `t`: { fieldId: value-or-'' }.
function toolPickValues(spec, t, sys) {
  const out = {};
  Object.entries(spec.map).forEach(([fid, key]) => {
    if (key === 'material') { if (t.material === 'Solid carbide') out[fid] = 1; return; }
    const v = ToolLib.value(t, key, sys);
    if (isFinite(v)) out[fid] = +v.toPrecision(10);
    else if ((spec.clear || []).includes(fid)) out[fid] = '';
  });
  return out;
}

function renderToolLibrary(el) {
  let edit = null, filter = '', q = '';
  const n = (t, k) => (t[k] === undefined || t[k] === '' ? '' : sesc(t[k]));
  function draw() {
    const u = t => (t.units === 'in' ? 'in' : 'mm');
    const rows = ToolLib.all().filter(t => (!filter || t.type === filter) && (!q || (ToolLib.describe(t) + ' ' + Object.values(t).join(' ')).toLowerCase().includes(q.toLowerCase())));
    el.innerHTML = '<div class="mfilter" style="flex-wrap:wrap"><button class="btn" id="tnew">New tool</button><button class="btn" id="texp">Export to file</button><label class="btn" style="display:inline-flex;align-items:center">Import from file<input type="file" id="timp" accept=".json,application/json" hidden></label>' +
      '<select id="tfilt" aria-label="Filter by type"><option value="">All types</option>' + ToolLib.TYPES.map(x => '<option' + (x === filter ? ' selected' : '') + '>' + x + '</option>').join('') + '</select>' +
      '<input type="search" id="tq" placeholder="Search tools" value="' + sesc(q) + '" style="width:180px"></div>' +
      '<p class="desc" id="tmsg">' + ToolLib.all().length + ' tool' + (ToolLib.all().length === 1 ? '' : 's') + ' in this browser. Import adds tools and never overwrites the ones you have.</p>' +
      '<div class="res mtab"><table><tr><th>Tool</th><th>Type</th><th>Diameter</th><th>Flutes</th><th>Flute length</th><th>Overall length</th><th>Stick-out</th><th>Corner R</th><th>Material, coating</th><th>Maker, part no.</th><th></th></tr>' +
      (rows.length ? rows.map(t => '<tr><td><b>' + sesc(ToolLib.describe(t)) + '</b>' + (t.notes ? '<div class="ms">' + sesc(t.notes) + '</div>' : '') + '</td><td>' + sesc(t.type) + '</td>' +
        ['dia', 'flutes', 'flute_len', 'oal', 'stick', 'cr'].map(k => '<td class="mv">' + (n(t, k) ? n(t, k) + (k === 'flutes' ? '' : ' ' + u(t)) : '') + '</td>').join('') +
        '<td>' + [t.material, t.coating].filter(Boolean).map(sesc).join(', ') + '</td><td>' + [t.maker, t.part].filter(Boolean).map(sesc).join(' ') + '</td>' +
        '<td style="white-space:nowrap"><button class="btn" data-a="edit" data-id="' + sesc(t.id) + '">Edit</button> <button class="btn" data-a="dup" data-id="' + sesc(t.id) + '">Copy</button> <button class="btn" data-a="del" data-id="' + sesc(t.id) + '">Delete</button></td></tr>').join('')
        : '<tr><td colspan="11" class="warn">' + (ToolLib.all().length ? 'No tool matches.' : 'No tools yet. Add your end mills, drills, taps, reamers and inserts once, then fill them into the calculators.') + '</td></tr>') +
      '</table></div><div id="tform"></div>';
    el.querySelector('#tnew').onclick = () => { edit = { type: 'End mill', units: state.sys === 'inch' ? 'in' : 'mm' }; form(); };
    el.querySelector('#texp').onclick = () => saveFile('benchmate-tools.json', ToolLib.exportJson(), 'application/json');
    el.querySelector('#timp').onchange = e => {
      const f = e.target.files[0]; if (!f) return;
      f.text().then(t => { const r = ToolLib.importJson(t); draw(); el.querySelector('#tmsg').textContent = 'Imported: ' + r.added + ' added, ' + r.skipped + ' skipped (already in the library or not a tool).'; })
        .catch(err => { el.querySelector('#tmsg').innerHTML = '<span class="warn">Import failed: ' + sesc(err.message) + '</span>'; });
    };
    el.querySelector('#tfilt').onchange = e => { filter = e.target.value; draw(); };
    el.querySelector('#tq').oninput = e => { q = e.target.value; const pos = e.target.selectionStart; draw(); const i = el.querySelector('#tq'); i.focus(); i.setSelectionRange(pos, pos); };
    el.querySelectorAll('button[data-a]').forEach(b => b.onclick = () => {
      const t = ToolLib.get(b.dataset.id); if (!t) return;
      if (b.dataset.a === 'edit') { edit = { ...t }; form(); }
      if (b.dataset.a === 'dup') { edit = { ...t, id: undefined, name: t.name ? t.name + ' (copy)' : '' }; form(); }
      if (b.dataset.a === 'del' && confirm('Delete ' + ToolLib.describe(t) + ' from the tool library?')) { ToolLib.remove(t.id); draw(); }
    });
  }
  function form() {
    const f = el.querySelector('#tform');
    const lu = edit.units === 'in' ? 'in' : 'mm';
    const opt = (list, cur) => list.map(o => '<option' + (String(cur ?? '') === o ? ' selected' : '') + '>' + o + '</option>').join('');
    f.innerHTML = '<h2>' + (edit.id ? 'Edit tool' : 'New tool') + '</h2><div class="grid">' + ToolLib.FIELDS.map(([k, label, kind, hint]) => {
      let inp, unit = '';
      if (kind === 'types') inp = '<select data-k="type">' + opt(ToolLib.TYPES, edit.type) + '</select>';
      else if (kind === 'materials') inp = '<select data-k="material">' + opt(ToolLib.MATERIALS, edit.material) + '</select>';
      else if (kind === 'units') inp = '<select data-k="units"><option value="mm"' + (lu === 'mm' ? ' selected' : '') + '>mm</option><option value="in"' + (lu === 'in' ? ' selected' : '') + '>inch</option></select>';
      else if (kind === 'text') inp = '<input type="text" data-k="' + k + '" value="' + n(edit, k) + '" placeholder="' + sesc(hint) + '">';
      else { inp = '<input type="number" step="any" inputmode="decimal" min="0" data-k="' + k + '" value="' + n(edit, k) + '">'; unit = kind === 'len' ? lu : kind === 'deg' ? 'deg' : kind === 'pitch' ? (lu === 'in' ? 'TPI' : 'mm') : ''; }
      return '<label class="f"><span>' + label + '</span><div class="row">' + inp + '<span class="u">' + unit + '</span></div></label>';
    }).join('') + '</div><button class="btn" id="tsave">Save tool</button> <button class="btn" id="tcancel">Cancel</button>' +
      '<p class="desc" style="margin-top:10px">Leave any value you do not know blank. Use the maker\'s catalogue figures; stick-out is what you set in the holder. The calculators only fill the values a tool has.</p>';
    const read = () => f.querySelectorAll('[data-k]').forEach(i => { edit[i.dataset.k] = i.value.trim(); });
    f.querySelector('[data-k="units"]').onchange = () => { read(); form(); };
    f.querySelector('#tcancel').onclick = () => { edit = null; f.innerHTML = ''; };
    f.querySelector('#tsave').onclick = () => {
      read();
      const bad = ToolLib.FIELDS.filter(([k, , kind]) => !['text', 'types', 'materials', 'units'].includes(kind) && edit[k] !== '' && !(Number(edit[k]) >= 0));
      if (bad.length) { alert('Check: ' + bad.map(b => b[1]).join(', ')); return; }
      if (!edit.name && !edit.dia && !edit.tno) { alert('Give the tool a name, a number or a diameter.'); return; }
      Object.keys(edit).forEach(k => { if (edit[k] === '' || edit[k] === undefined) delete edit[k]; });
      ToolLib.upsert(edit); edit = null; draw();
    };
    f.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  draw();
}
