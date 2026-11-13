'use strict';
// Machine profiles: limits every result is checked against, and what the machine is (0.8.0: a builder per
// machine type). Stored per computer (localStorage) and exportable/importable as a JSON file so profiles can
// move to air-gapped PCs by USB. Values are always metric inside (mm, mm/min, kg, RPM, kW, N·m, µm); the form
// shows lengths, feeds and masses in the units chosen in the top bar.
const Profiles = (() => {
  const KEY = 'bm.machines', ACT = 'bm.machine';
  let list = [], active = '';
  try { list = JSON.parse(localStorage.getItem(KEY) || '[]'); active = localStorage.getItem(ACT) || ''; } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(list)); localStorage.setItem(ACT, active); } catch (e) {} };
  // Machine types. The stored names are kept from earlier versions (other pages read "lathe", "mill", "router" in them).
  const TYPES = [
    ['mill', 'Mill / machining centre', 'Vertical, horizontal or knee mill, 3 or 4 axes'],
    ['mill5', '5-axis mill / machining centre', 'Two rotary axes: trunnion table, head and table, or two heads'],
    ['lathe', 'Lathe', '2-axis, or with C axis, live tools, Y axis, sub spindle'],
    ['swiss', 'Swiss-type lathe', 'Sliding headstock, gang and live tools, sub spindle'],
    ['millturn', 'Mill-turn', 'Turning centre with a milling spindle (B axis)'],
    ['router', 'Router', 'Gantry router for sheet and panels'],
    ['other', 'Other', 'Grinder, EDM, anything else'],
  ];
  const typeCode = t => { const r = TYPES.find(x => x[1] === t || x[0] === t); return r ? r[0] : t ? 'other' : 'mill'; };
  const ALL = ['mill', 'mill5', 'lathe', 'swiss', 'millturn', 'router', 'other'], MILLS = ['mill', 'mill5', 'router'], TURN = ['lathe', 'swiss', 'millturn'];
  const GUIDE = 'Not known,Linear guides (rails),Box ways (hardened and ground),Dovetail ways,Hydrostatic ways';
  // [key, label, kind, unit or hint, machine types (blank = all), section, what BenchMate does with it]
  // kind: text, number, len (mm), feed (mm/min), mass (kg), select:a,b,c. use: chk = results are checked against it.
  const S1 = 'The machine', S2 = 'Layout and axes', S3 = 'Work volume', S4 = 'Main spindle', S5 = 'Sub spindle', S6 = 'Live (driven) tools',
    S7 = 'Feeds and rapids', S8 = 'How it is built', S9 = 'The control', S10 = 'Rigidity';
  const F = (k, label, kind, unit, types, sec, use) => ({ k, label, kind, unit: unit || '', types: types || ALL, sec, use: use || '' });
  const FIELDS = [
    F('name', 'Machine name', 'text', 'e.g. Shop VMC', 0, S1),
    F('type', 'Machine type', 'type', '', 0, S1, 'Sets which boxes this form asks for; the G and M code list starts on mill or lathe codes'),
    F('model', 'Maker and model', 'text', 'e.g. the plate on the machine', 0, S1),
    F('year', 'Year built', 'number', '', 0, S1),
    F('control', 'Control', 'text', 'e.g. Fanuc 0i-MF, Haas NGC, Mitsubishi M80', 0, S1, 'G and M codes, and the code snippets, start on this control'),
    // Layout, per type
    F('orient', 'Spindle', 'select:Vertical,Horizontal,Gantry or bridge,Knee mill (manual or CNC)', '', ['mill'], S2),
    F('axis4', 'Fourth axis', 'select:None,Indexer (positions only),Rotary axis cutting while it turns', '', ['mill', 'router'], S2),
    F('kin', 'Layout of the rotary axes', 'select:Table and table (trunnion),Head and table,Head and head', '', ['mill5'], S2),
    F('rot', 'Rotary axes', 'text', 'e.g. A and C, or B and C', ['mill5'], S2),
    F('tilt', 'Tilt range', 'text', 'e.g. -30 to +120 deg', ['mill5'], S2),
    F('five', 'Five-axis work', 'select:Positioning only (3+2),Simultaneous 5-axis', '', ['mill5'], S2),
    F('tcp', 'Tool centre point control (TCPM, RTCP)', 'select:Not known,Yes,No', '', ['mill5', 'millturn'], S2),
    F('rotdrive', 'Rotary axis drive', 'select:Not known,Worm gear,Direct drive (torque motor),Roller cam', '', ['mill', 'mill5'], S2),
    F('laxes', 'Axes', 'select:2-axis (X and Z),C axis with live tools,C and Y axis with live tools', '', ['lathe'], S2),
    F('bed', 'Bed', 'select:Slant bed,Flat bed', '', ['lathe'], S2),
    F('turret', 'Turret stations', 'number', '', ['lathe', 'millturn'], S2),
    F('sub', 'Sub spindle (second spindle)', 'select:None,Yes', '', ['lathe', 'millturn'], S2),
    F('tail', 'Tailstock', 'select:None,Manual,Programmable', '', ['lathe', 'millturn'], S2),
    F('gb', 'Guide bushing', 'select:Guide bushing (sliding headstock),Convertible: can run without the guide bushing,No guide bushing', '', ['swiss'], S2),
    F('gang', 'Gang tool positions (turning)', 'number', '', ['swiss'], S2),
    F('radial', 'Radial live tools (cross drilling and milling)', 'number', '', ['swiss'], S2),
    F('axial', 'Front-working axial tools (end working)', 'number', '', ['swiss'], S2),
    F('back', 'Back-working tools (for the sub spindle)', 'number', '', ['swiss'], S2),
    F('bmill', 'Milling spindle', 'select:B axis milling head,Fixed live tool turret', '', ['millturn'], S2),
    F('lower', 'Lower turret', 'select:None,Yes', '', ['millturn'], S2),
    F('atc', 'Tool changer pockets', 'number', '', ['mill', 'mill5', 'millturn', 'router'], S2),
    F('bar', 'Bar feeder', 'select:None,Yes', '', TURN, S2),
    F('probe', 'Probing', 'select:None,Spindle probe,Tool setter,Spindle probe and tool setter', '', 0, S2),
    // Work volume
    F('tx', 'Travel X', 'len', '', ['mill', 'mill5', 'router', 'millturn', 'lathe', 'swiss'], S3),
    F('ty', 'Travel Y', 'len', '', ['mill', 'mill5', 'router', 'millturn', 'lathe', 'swiss'], S3),
    F('tz', 'Travel Z', 'len', '', ['mill', 'mill5', 'router', 'millturn', 'lathe', 'swiss'], S3),
    F('table', 'Table size', 'text', 'e.g. 1000 x 500 mm', ['mill', 'mill5', 'router'], S3),
    F('kg', 'Largest part mass on the table', 'mass', '', ['mill', 'mill5', 'router'], S3),
    F('spindle_table', 'Spindle nose to table, least and most', 'text', 'e.g. 100 to 610 mm', ['mill', 'mill5'], S3),
    F('swing', 'Swing over the bed', 'len', '', ['lathe', 'millturn'], S3),
    F('turn_d', 'Largest turning diameter', 'len', '', ['lathe', 'millturn'], S3),
    F('turn_l', 'Largest turning length', 'len', '', ['lathe', 'millturn'], S3),
    F('bar_d', 'Bar capacity (through the spindle)', 'len', '', TURN, S3),
    F('chuck', 'Chuck size', 'text', 'e.g. 8 in, or collet type', ['lathe', 'millturn'], S3),
    F('stroke', 'Headstock stroke per chucking', 'len', '', ['swiss'], S3),
    // Main spindle
    F('rpm_min', 'Lowest speed', 'number', 'RPM', 0, S4, 'chk'),
    F('rpm_max', 'Top speed', 'number', 'RPM', 0, S4, 'chk'),
    F('power_kw', 'Power (continuous, not peak)', 'number', 'kW', 0, S4, 'chk'),
    F('torque_nm', 'Top torque', 'number', 'N·m', 0, S4, 'Lets the power check allow for the torque limit at low speed'),
    F('taper', 'Spindle taper or tool holder', 'text', 'e.g. BT40, CAT40, HSK-A63, R8, ER32', 0, S4),
    F('tsc', 'Coolant through the spindle', 'text', 'e.g. 70 bar, or none', ['mill', 'mill5', 'millturn', 'lathe', 'swiss'], S4),
    F('sub_rpm', 'Top speed', 'number', 'RPM', TURN, S5),
    F('sub_kw', 'Power (continuous)', 'number', 'kW', TURN, S5),
    F('live_rpm_max', 'Top speed', 'number', 'RPM', TURN, S6, 'chk'),
    F('live_kw', 'Power (continuous)', 'number', 'kW', TURN, S6),
    F('live_holder', 'Tool holders', 'text', 'e.g. ER16 collets, VDI 30', TURN, S6),
    F('feed_max', 'Top cutting feed', 'feed', '', 0, S7, 'chk'),
    F('rapid', 'Rapid traverse', 'feed', '', 0, S7, 'Cycle times of the G-code cycle pages'),
    // How it is built
    F('gx', 'Guideways on X', 'select:' + GUIDE, '', 0, S8),
    F('gy', 'Guideways on Y', 'select:' + GUIDE, '', ['mill', 'mill5', 'router', 'millturn', 'lathe', 'swiss'], S8),
    F('gz', 'Guideways on Z', 'select:' + GUIDE, '', 0, S8),
    F('scales', 'Linear scales (position read on the axis, not only the motor)', 'select:Not known,No,Yes', '', 0, S8),
    F('thermal', 'Thermal compensation', 'select:Not known,None,Spindle growth only,Spindle and axes', '', 0, S8),
    F('bl_x', 'Backlash measured on X', 'number', 'µm', 0, S8),
    F('bl_y', 'Backlash measured on Y', 'number', 'µm', ['mill', 'mill5', 'router', 'millturn', 'lathe', 'swiss'], S8),
    F('bl_z', 'Backlash measured on Z', 'number', 'µm', 0, S8),
    F('acc', 'Positioning accuracy and repeatability (maker\'s figures)', 'text', 'e.g. ±5 µm, ±2 µm (ISO 230-2)', 0, S8),
    // The control
    F('small', 'Many short moves (3D surfaces, fine code)', 'select:Not known,Runs them smoothly at the programmed feed,Slows down but keeps going,Stutters or stops between moves', '', 0, S9),
    F('hsm', 'High-speed or look-ahead mode', 'select:Not known,None,Yes', '', 0, S9),
    F('hsm_name', 'Name of that mode and how it is switched on', 'text', 'e.g. G05.1 Q1, AI contour control', 0, S9),
    F('lookahead', 'Look-ahead blocks', 'number', 'blocks', 0, S9),
    F('memory', 'Program memory, and drip feed or a network drive', 'text', 'e.g. 2 MB, data server, USB', 0, S9),
    F('rigidity', 'Rigidity class', 'select:Medium,Light (bench or hobby machine),Heavy', '', 0, S10, 'Where the advisors\' "How hard is this cut" slider starts'),
    F('holder_k', 'Holder and spindle stiffness from a push test', 'number', 'N/µm', 0, S10, 'Tool deflection and the milling advisor (see Tool deflection)'),
    F('notes', 'Notes', 'text', '', 0, S10),
  ];
  return {
    FIELDS, TYPES, typeCode,
    all: () => list,
    active: () => list.find(m => m.id === active) || null,
    setActive: id => { active = id; save(); },
    upsert: m => { if (!m.id) m.id = 'm' + Date.now(); const i = list.findIndex(x => x.id === m.id); if (i >= 0) list[i] = m; else list.push(m); save(); return m; },
    remove: id => { list = list.filter(m => m.id !== id); if (active === id) active = ''; save(); },
    exportJson: () => JSON.stringify({ benchmate_machines: 1, machines: list }, null, 1),
    importJson: txt => { const d = JSON.parse(txt); if (!d || !Array.isArray(d.machines)) throw new Error('Not a BenchMate machines file'); d.machines.forEach(m => { if (m && m.name) { const i = list.findIndex(x => x.id === m.id); if (i >= 0) list[i] = m; else list.push(m); } }); save(); return d.machines.length; },
  };
})();

// Check one result row against the active machine. Returns a warning string or ''.
function checkRow(r, sys, W) {
  const m = Profiles.active(); if (!m || !r.chk || typeof r.value !== 'number') return '';
  const n = v => (v === '' || v === undefined || v === null) ? NaN : Number(v);
  if (r.chk === 'rpm') {
    if (n(m.rpm_max) > 0 && r.value > n(m.rpm_max)) return 'Above ' + m.name + ' max ' + n(m.rpm_max) + ' RPM';
    if (n(m.rpm_min) > 0 && r.value < n(m.rpm_min)) return 'Below ' + m.name + ' min ' + n(m.rpm_min) + ' RPM';
  }
  if (r.chk === 'live_rpm' && n(m.live_rpm_max) > 0 && r.value > n(m.live_rpm_max)) return 'Above live tool max ' + n(m.live_rpm_max) + ' RPM';
  if (r.chk === 'feed' && n(m.feed_max) > 0) {
    const mm = sys === 'inch' ? r.value * 25.4 : r.value;
    if (mm > n(m.feed_max)) return 'Above ' + m.name + ' max feed ' + (sys === 'inch' ? +(n(m.feed_max) / 25.4).toFixed(1) + ' in/min' : n(m.feed_max) + ' mm/min');
  }
  if (r.chk === 'power_kw' && n(m.power_kw) > 0) {
    const avail = r.rpm > 0 && W ? W.spindle_power_available_kw(r.rpm, n(m.power_kw), n(m.torque_nm) || 0) : n(m.power_kw);
    if (r.value > avail) return 'Needs more than ' + m.name + ' has (' + avail.toFixed(2) + ' kW' + (r.rpm > 0 ? ' at ' + Math.round(r.rpm) + ' RPM' : '') + ')';
  }
  return '';
}

function renderMachines(el) {
  const esc = x => String(x ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const inch = () => typeof state !== 'undefined' && state.sys === 'inch';
  // Shown units for the kinds stored metric. 1 in = 25.4 mm and 1 lb = 0.45359237 kg by definition.
  const UNIT = { len: () => inch() ? 'in' : 'mm', feed: () => inch() ? 'in/min' : 'mm/min', mass: () => inch() ? 'lb' : 'kg' };
  const FAC = { len: () => inch() ? 25.4 : 1, feed: () => inch() ? 25.4 : 1, mass: () => inch() ? 0.45359237 : 1 };
  const shown = (kind, v) => v === '' || v === undefined || v === null || !UNIT[kind] ? (v ?? '') : String(+(Number(v) / FAC[kind]()).toFixed(inch() ? 4 : 3));
  const stored = (kind, v) => v === '' || !UNIT[kind] || !isFinite(Number(v)) ? v : String(+(Number(v) * FAC[kind]()).toFixed(4));
  const typeName = c => (Profiles.TYPES.find(t => t[0] === c) || Profiles.TYPES[0])[1];
  let edit = null;
  function summary(m) {
    const c = Profiles.typeCode(m.type), bits = [];
    const add = (k, f) => { if (m[k] !== undefined && m[k] !== '' && m[k] !== 'None' && m[k] !== 'Not known') bits.push(f ? f(m[k]) : m[k]); };
    if (c === 'mill') { add('orient'); add('axis4', v => '4th axis: ' + v.toLowerCase()); }
    if (c === 'mill5') { add('kin'); add('five'); }
    if (c === 'lathe') { add('laxes'); add('sub', () => 'sub spindle'); }
    if (c === 'swiss') { add('gb'); add('radial', v => v + ' radial live'); add('axial', v => v + ' axial'); add('back', v => v + ' back-working'); }
    if (c === 'millturn') { add('bmill'); add('sub', () => 'sub spindle'); }
    if (MILLS_OR(c) && m.tx && m.ty && m.tz) bits.push('travel ' + [m.tx, m.ty, m.tz].map(v => shown('len', v)).join(' x ') + ' ' + UNIT.len());
    if (m.rpm_max) bits.push(esc(m.rpm_max) + ' RPM');
    if (m.power_kw) bits.push(esc(m.power_kw) + ' kW');
    return bits.map(esc).join(' · ');
  }
  const MILLS_OR = c => ['mill', 'mill5', 'router', 'millturn'].includes(c);
  function draw() {
    const act = Profiles.active();
    el.innerHTML = '<div class="mfilter"><button class="btn" id="mnew">New machine</button><button class="btn" id="mexp">Export to file</button><label class="btn">Import from file<input type="file" id="mimp" accept=".json" hidden></label></div>' +
      '<div class="res"><table>' + (Profiles.all().length ? Profiles.all().map(m => '<tr><td><b>' + esc(m.name) + '</b>' + (act && act.id === m.id ? ' <span class="badge confirmed">Active</span>' : '') + '<div class="fam">' + esc(typeName(Profiles.typeCode(m.type))) + (m.model ? ' · ' + esc(m.model) : '') + (m.control ? ' · ' + esc(m.control) : '') + '</div><div class="fam">' + summary(m) + '</div></td>' +
        '<td style="text-align:right;white-space:nowrap"><button class="btn" data-a="use" data-id="' + m.id + '">Use</button> <button class="btn" data-a="edit" data-id="' + m.id + '">Edit</button> <button class="btn" data-a="del" data-id="' + m.id + '">Delete</button></td></tr>').join('') : '<tr><td class="warn">No machines yet. Add one so every result is checked against its limits.</td></tr>') + '</table></div><div id="mform"></div>';
    $('#mnew', el).onclick = () => { edit = {}; form(); };
    $('#mexp', el).onclick = () => saveFile('benchmate-machines.json', Profiles.exportJson(), 'application/json');
    $('#mimp', el).onchange = e => { const f = e.target.files[0]; if (!f) return; f.text().then(t => { try { const n = Profiles.importJson(t); draw(); refreshMachineSelect(); alert('Imported ' + n + ' machine(s).'); } catch (err) { alert('Import failed: ' + err.message); } }); };
    el.querySelectorAll('button[data-a]').forEach(b => b.onclick = () => {
      const id = b.dataset.id;
      if (b.dataset.a === 'use') { Profiles.setActive(id); refreshMachineSelect(); draw(); }
      if (b.dataset.a === 'edit') { edit = { ...Profiles.all().find(m => m.id === id) }; form(); }
      if (b.dataset.a === 'del' && confirm('Delete this machine profile?')) { Profiles.remove(id); refreshMachineSelect(); draw(); }
    });
  }
  // The form: first the machine type (cards), then only the sections and boxes that type has.
  function form() {
    const f = $('#mform', el);
    let code = Profiles.typeCode(edit.type);
    const input = fd => {
      const v = edit[fd.k];
      if (fd.kind.startsWith('select:')) return '<select data-k="' + fd.k + '">' + fd.kind.slice(7).split(',').map(o => '<option' + (v === o ? ' selected' : '') + '>' + esc(o) + '</option>').join('') + '</select>';
      const num = fd.kind === 'number' || UNIT[fd.kind];
      return '<input data-k="' + fd.k + '" type="' + (num ? 'number' : 'text') + '" step="any" value="' + esc(shown(fd.kind, v)) + '"' + (!num && fd.unit ? ' placeholder="' + esc(fd.unit) + '"' : '') + '>';
    };
    const use = fd => fd.use === 'chk' ? '<small class="muse chk">Results are checked against it</small>' : fd.use ? '<small class="muse">' + esc(fd.use) + '</small>' : '';
    function body() {
      const secs = [];
      Profiles.FIELDS.forEach(fd => { if (fd.kind === 'type' || !fd.types.includes(code)) return; let s = secs.find(x => x[0] === fd.sec); if (!s) secs.push(s = [fd.sec, []]); s[1].push(fd); });
      return secs.map(([title, fds], i) => '<details class="msec"' + (i < 5 ? ' open' : '') + '><summary>' + esc(title) + '</summary><div class="grid">' + fds.map(fd =>
        '<label class="f"><span>' + esc(fd.label) + '</span><div class="row">' + input(fd) + '<span class="u">' + (UNIT[fd.kind] ? UNIT[fd.kind]() : fd.kind === 'number' ? esc(fd.unit) : '') + '</span></div>' + use(fd) + '</label>').join('') + '</div></details>').join('');
    }
    // Keep what was typed when the type changes (boxes the new type does not have keep their values too).
    const grab = () => f.querySelectorAll('[data-k]').forEach(i => { const fd = Profiles.FIELDS.find(x => x.k === i.dataset.k); edit[i.dataset.k] = fd && UNIT[fd.kind] ? stored(fd.kind, i.value.trim()) : i.value.trim(); });
    function paint() {
      f.innerHTML = '<h1 style="margin-top:16px">' + (edit.id ? 'Edit machine' : 'New machine') + '</h1>' +
        '<div class="mtypes" role="radiogroup" aria-label="Machine type">' + Profiles.TYPES.map(t => '<button type="button" role="radio" aria-checked="' + (t[0] === code) + '" class="mtype' + (t[0] === code ? ' on' : '') + '" data-t="' + t[0] + '"><b>' + esc(t[1]) + '</b><small>' + esc(t[2]) + '</small></button>').join('') + '</div>' +
        '<div id="mfields">' + body() + '</div>' +
        '<button class="btn" id="msave">Save</button> <button class="btn" id="mcancel">Cancel</button><p class="desc" style="margin-top:10px">Use the builder\'s published figures (spec sheet or manual). Continuous power, not peak. Boxes marked "Results are checked against it" are used on every page; the rest describe the machine for you and for the pages that ask about it. Leave a box blank when you do not know.</p>';
      f.querySelectorAll('.mtype').forEach(b => b.onclick = () => { grab(); code = b.dataset.t; edit.type = typeName(code); paint(); });
      $('#mcancel', f).onclick = () => { edit = null; f.innerHTML = ''; };
      $('#msave', f).onclick = () => {
        grab(); edit.type = typeName(code);
        if (!edit.name) { alert('Give the machine a name.'); return; }
        const m = Profiles.upsert(edit); if (!Profiles.active()) Profiles.setActive(m.id); refreshMachineSelect(); edit = null; draw();
      };
    }
    paint();
    f.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  draw();
}

function refreshMachineSelect() {
  const s = document.getElementById('machine'); if (!s) return;
  const act = Profiles.active();
  s.innerHTML = '<option value="">No machine</option>' + Profiles.all().map(m => '<option value="' + m.id + '"' + (act && act.id === m.id ? ' selected' : '') + '>' + m.name.replace(/</g, '&lt;') + '</option>').join('');
}
