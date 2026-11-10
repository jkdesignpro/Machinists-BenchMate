'use strict';
// Machine profiles: limits every result is checked against.
// Stored per computer (localStorage) and exportable/importable as a JSON file
// so profiles can move to air-gapped PCs by USB. Limits are always metric
// internally (RPM, kW, N*m, mm/min).
const Profiles = (() => {
  const KEY = 'bm.machines', ACT = 'bm.machine';
  let list = [], active = '';
  try { list = JSON.parse(localStorage.getItem(KEY) || '[]'); active = localStorage.getItem(ACT) || ''; } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(list)); localStorage.setItem(ACT, active); } catch (e) {} };
  const FIELDS = [
    ['name', 'Machine name', 'text', ''],
    ['type', 'Type', 'select:Lathe,Swiss-type lathe,Mill / machining centre,Mill-turn,Router,Other', ''],
    ['control', 'Control', 'text', 'e.g. Fanuc 0i, Mitsubishi M70, Haas'],
    ['rpm_min', 'Main spindle min speed', 'number', 'RPM'],
    ['rpm_max', 'Main spindle max speed', 'number', 'RPM'],
    ['power_kw', 'Main spindle power (continuous)', 'number', 'kW'],
    ['torque_nm', 'Main spindle max torque (optional)', 'number', 'N·m'],
    ['live_rpm_max', 'Live / driven tool max speed (optional)', 'number', 'RPM'],
    ['feed_max', 'Max cutting feed (optional)', 'number', 'mm/min'],
    ['rapid', 'Rapid traverse rate (optional, for cycle times)', 'number', 'mm/min'],
    ['notes', 'Notes', 'text', ''],
  ];
  return {
    FIELDS,
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
  if (r.chk === 'feed' && n(m.feed_max) > 0) { const mm = sys === 'inch' ? r.value * 25.4 : r.value; if (mm > n(m.feed_max)) return 'Above ' + m.name + ' max feed ' + n(m.feed_max) + ' mm/min'; }
  if (r.chk === 'power_kw' && n(m.power_kw) > 0) {
    const avail = r.rpm > 0 && W ? W.spindle_power_available_kw(r.rpm, n(m.power_kw), n(m.torque_nm) || 0) : n(m.power_kw);
    if (r.value > avail) return 'Needs more than ' + m.name + ' has (' + avail.toFixed(2) + ' kW' + (r.rpm > 0 ? ' at ' + Math.round(r.rpm) + ' RPM' : '') + ')';
  }
  return '';
}

function renderMachines(el) {
  const esc = x => String(x ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  let edit = null;
  function draw() {
    const act = Profiles.active();
    el.innerHTML = '<div class="mfilter"><button class="btn" id="mnew">New machine</button><button class="btn" id="mexp">Export to file</button><label class="btn">Import from file<input type="file" id="mimp" accept=".json" hidden></label></div>' +
      '<div class="res"><table>' + (Profiles.all().length ? Profiles.all().map(m => '<tr><td><b>' + esc(m.name) + '</b>' + (act && act.id === m.id ? ' <span class="badge confirmed">Active</span>' : '') + '<div class="fam">' + esc(m.type) + (m.control ? ' · ' + esc(m.control) : '') + '</div></td><td class="v">' + (m.rpm_max ? esc(m.rpm_max) + ' RPM' : '') + (m.power_kw ? ' · ' + esc(m.power_kw) + ' kW' : '') + '</td><td style="text-align:right;white-space:nowrap"><button class="btn" data-a="use" data-id="' + m.id + '">Use</button> <button class="btn" data-a="edit" data-id="' + m.id + '">Edit</button> <button class="btn" data-a="del" data-id="' + m.id + '">Delete</button></td></tr>').join('') : '<tr><td class="warn">No machines yet. Add one so every result is checked against its limits.</td></tr>') + '</table></div><div id="mform"></div>';
    $('#mnew', el).onclick = () => { edit = {}; form(); };
    $('#mexp', el).onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([Profiles.exportJson()], { type: 'application/json' })); a.download = 'benchmate-machines.json'; a.click(); };
    $('#mimp', el).onchange = e => { const f = e.target.files[0]; if (!f) return; f.text().then(t => { try { const n = Profiles.importJson(t); draw(); refreshMachineSelect(); alert('Imported ' + n + ' machine(s).'); } catch (err) { alert('Import failed: ' + err.message); } }); };
    el.querySelectorAll('button[data-a]').forEach(b => b.onclick = () => {
      const id = b.dataset.id;
      if (b.dataset.a === 'use') { Profiles.setActive(id); refreshMachineSelect(); draw(); }
      if (b.dataset.a === 'edit') { edit = { ...Profiles.all().find(m => m.id === id) }; form(); }
      if (b.dataset.a === 'del' && confirm('Delete this machine profile?')) { Profiles.remove(id); refreshMachineSelect(); draw(); }
    });
  }
  function form() {
    const f = $('#mform', el);
    f.innerHTML = '<h1 style="margin-top:16px">' + (edit.id ? 'Edit machine' : 'New machine') + '</h1><div class="grid">' + Profiles.FIELDS.map(([k, label, type, hint]) => {
      let inp;
      if (type.startsWith('select:')) inp = '<select data-k="' + k + '">' + type.slice(7).split(',').map(o => '<option' + (edit[k] === o ? ' selected' : '') + '>' + o + '</option>').join('') + '</select>';
      else inp = '<input data-k="' + k + '" type="' + type + '" step="any" value="' + esc(edit[k]) + '"' + (type === 'text' && hint ? ' placeholder="' + esc(hint) + '"' : '') + '>';
      return '<label class="f"><span>' + label + '</span><div class="row">' + inp + '<span class="u">' + (type === 'number' ? hint : '') + '</span></div></label>';
    }).join('') + '</div><button class="btn" id="msave">Save</button> <button class="btn" id="mcancel">Cancel</button><p class="desc" style="margin-top:10px">Use the builder\'s published figures (spec sheet or manual). Continuous power, not peak. Torque lets BenchMate check power at low speed.</p>';
    $('#mcancel', f).onclick = () => { edit = null; f.innerHTML = ''; };
    $('#msave', f).onclick = () => {
      f.querySelectorAll('[data-k]').forEach(i => edit[i.dataset.k] = i.value.trim());
      if (!edit.name) { alert('Give the machine a name.'); return; }
      const m = Profiles.upsert(edit); if (!Profiles.active()) Profiles.setActive(m.id); refreshMachineSelect(); edit = null; draw();
    };
  }
  draw();
}

function refreshMachineSelect() {
  const s = document.getElementById('machine'); if (!s) return;
  const act = Profiles.active();
  s.innerHTML = '<option value="">No machine</option>' + Profiles.all().map(m => '<option value="' + m.id + '"' + (act && act.id === m.id ? ' selected' : '') + '>' + m.name.replace(/</g, '&lt;') + '</option>').join('');
}
