'use strict';
// Fasteners and machine elements: bolt grades, tightening torque and preload,
// socket head cap screws, clearance and counterbore holes, spanner and hex key
// sizes, T-slots, parallel keys, O-ring glands, bearing life.
// Table values come from data/refdata.json (section `fasteners`, built by
// scripts/build_refdata.py from data/refdata/fasteners-evidence.json) with the
// publishers that print them. Every calculation is done by the Rust core
// (state.W, core/src/fasteners.rs); JS converts units, looks up rows and draws.

const PSI_MPA = 0.006894757293168, NM_LBFT = 1.3558179483314; // LBF_N is in tools.js
const FMEM = {};
async function loadFast(el) {
  const R = await loadRef(el); if (!R) return null;
  if (!R.fasteners) { el.textContent = 'Fastener data not built (run scripts/build-web.sh).'; return null; }
  return R;
}
// Inch sizes as printed ('#10', '1/4', '1 1/4') to inches.
function inchSize(s) {
  s = String(s).trim();
  if (s[0] === '#') return 0.060 + 0.013 * +s.slice(1);
  return s.split(' ').reduce((a, p) => a + (p.includes('/') ? p.split('/')[0] / p.split('/')[1] : +p), 0);
}
const inchLabel = s => (s[0] === '#' ? s : s + '"');
const fracIn = s => String(s).split(' ').reduce((a, p) => a + (p.includes('/') ? p.split('/')[0] / p.split('/')[1] : +p), 0);
// One evidence cell: value, badge, the publishers on hover, other printed values beside it.
function fCell(srcs, c, show, opts) {
  if (!c) return '<td class="mv">-</td>';
  const tip = c.groups.map(g => g.printed[0] + ': ' + g.publishers.map(p => pubName(srcs, p)).join(', ')).join(' | ');
  const alt = c.groups.length > 1 ? '<br><span class="warn">also printed: ' + c.groups.slice(1).map(g => rEsc(g.printed[0]) + ' (' + g.publishers.map(p => rEsc(pubName(srcs, p))).join(', ') + ')').join('; ') + '</span>' : '';
  return '<td class="mv" title="' + rEsc(tip) + '">' + (show ? show(c.value) : rEsc(c.value)) + (opts && opts.nobadge ? '' : ' ' + badge(c.status)) + alt + '</td>';
}
const pubsOf = (srcs, row) => (row.publishers || []).map(p => rEsc(pubName(srcs, p))).join(', ');
const mmIn = (mm, dpmm, dpin) => inMode() ? fx(mm / IN_MM, dpin == null ? 4 : dpin) + ' in' : fx(mm, dpmm == null ? 2 : dpmm) + ' mm';
const inMm = (inch, dpin) => inMode() ? fx(inch, dpin == null ? 3 : dpin) + ' in' : fx(inch * IN_MM, 2) + ' mm';
const legend = '<p class="ms">Each value shows how many publishers agree: ' + badge('confirmed') + ' two or more independent publishers print it, ' + badge('review') + ' one publisher so far, ' + badge('differs') + ' publishers print different values (all shown). Hover a value to see who prints what.</p>';
function srcNote(F, keys) {
  const S = {}; keys.forEach(k => { if (F.sources[k]) S[k] = F.sources[k]; });
  return '<b>Publishers</b><br>' + sourceList(S);
}
function sel(id, opts, cur) { return '<select id="' + id + '">' + opts.map(([v, t]) => '<option value="' + rEsc(v) + '"' + (String(v) === String(cur) ? ' selected' : '') + '>' + rEsc(t) + '</option>').join('') + '</select>'; }
function fld(label, inner, unit, cls) { return '<label class="f' + (cls ? ' ' + cls : '') + '"><span>' + label + '</span><div class="row">' + inner + (unit != null ? '<span class="u">' + unit + '</span>' : '') + '</div></label>'; }
const numIn = (id, val, ph) => '<input id="' + id + '" type="number" step="any" inputmode="decimal" value="' + rEsc(val ?? '') + '"' + (ph ? ' placeholder="' + rEsc(ph) + '"' : '') + '>';

// ------------------------------------------------------------------ bolt grades
// Head mark drawings (our own): hexagon head seen from above with the radial lines.
function headMarkSvg(kind, label) {
  const S = 96, c = 48, r = 38;
  const hex = Array.from({ length: 6 }, (_, i) => { const a = Math.PI / 6 + i * Math.PI / 3; return (c + r * Math.cos(a)).toFixed(1) + ',' + (c + r * Math.sin(a)).toFixed(1); }).join(' ');
  let marks = '';
  const lines = n => Array.from({ length: n }, (_, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return '<path class="gz" style="stroke-dasharray:none;stroke-width:2.2" d="M' + (c + 9 * Math.cos(a)).toFixed(1) + ' ' + (c + 9 * Math.sin(a)).toFixed(1) + 'L' + (c + 26 * Math.cos(a)).toFixed(1) + ' ' + (c + 26 * Math.sin(a)).toFixed(1) + '"/>'; }).join('');
  if (kind === 'g5') marks = lines(3);
  else if (kind === 'g8') marks = lines(6);
  else if (kind === 'iso') marks = '<text class="gl" x="' + c + '" y="' + (c + 4) + '" text-anchor="middle" style="font:600 13px var(--mono);fill:var(--ink)">' + rEsc(label) + '</text><text class="gl" x="' + c + '" y="' + (c + 18) + '" text-anchor="middle">maker</text>';
  else if (kind === 'socket') { const hx = Array.from({ length: 6 }, (_, i) => { const a = i * Math.PI / 3; return (c + 13 * Math.cos(a)).toFixed(1) + ',' + (c + 13 * Math.sin(a)).toFixed(1); }).join(' '); return '<svg class="gdia" style="width:96px" viewBox="0 0 96 96" role="img" aria-label="socket head"><circle class="gp" cx="48" cy="48" r="38"/><polygon class="gm" points="' + hx + '" style="fill:none;stroke:var(--muted)"/><text class="gl" x="48" y="24" text-anchor="middle">' + rEsc(label) + '</text></svg>'; }
  return '<svg class="gdia" style="width:96px" viewBox="0 0 ' + S + ' ' + S + '" role="img" aria-label="head marking ' + rEsc(label || kind) + '"><polygon class="gp" points="' + hex + '" style="fill:none;stroke:var(--ink);stroke-width:1.8"/><circle class="gm" cx="' + c + '" cy="' + c + '" r="30"/>' + marks + '</svg>';
}

async function renderBoltGrades(el) {
  const R = await loadFast(el); if (!R) return;
  const F = R.fasteners, srcs = F.sources, inch = inMode();
  const st = v => inch ? fx(v * 0.1450377, 1) + ' ksi' : fx(v, 0) + ' MPa';
  const stPsi = v => inch ? fx(v / 1000, 0) + ' ksi' : fx(v * PSI_MPA, 0) + ' MPa';
  const isoRows = F.iso898.map(r => '<tr><td style="white-space:nowrap"><b>' + rEsc(r.size.replace('d<=16', '(d ≤ 16 mm)').replace('d>16', '(d > 16 mm)')) + '</b></td>' +
    fCell(srcs, r.sp, st) + fCell(srcs, r.yield_min, st) + fCell(srcs, r.rm_min, st) + fCell(srcs, r.hv, v => rEsc(v) + ' HV') + '</tr>').join('');
  const saeRows = F.sae.map(r => '<tr><td><b>' + rEsc(r.size) + '</b></td>' + fCell(srcs, r.sp, stPsi) + fCell(srcs, r.yield_min, stPsi) + fCell(srcs, r.rm_min, stPsi) + fCell(srcs, r.hrc_min, v => 'HRC ' + v) + '</tr>').join('');
  el.innerHTML =
    '<div class="res mtab"><div class="h">ISO 898-1 property classes (bolts, screws and studs of carbon and alloy steel)</div><table><tr><th>Class</th><th>Stress under proof load Sp</th><th>Lower yield / 0.2 % proof, min</th><th>Tensile Rm, min</th><th>Vickers hardness</th></tr>' + isoRows + '</table></div>' +
    '<p class="ms">For 4.8, 5.8 and 6.8 the yield column is Rpf, the stress at a set plastic elongation of a full-size fastener; Optimas notes these are not test values and serve to set the proof stress ratio. The others are ReL (4.6, 5.6) or Rp0.2. 8.8 is split at d = 16 mm. Values are minimums from the publishers below; the standard itself (ISO 898-1:2013, clause 9 and Table 3) is the authority.</p>' +
    '<div class="res mtab" style="margin-top:12px"><div class="h">SAE J429 grades and ASTM A574 socket head cap screws (inch)</div><table><tr><th>Grade and size</th><th>Proof stress</th><th>Yield, min</th><th>Tensile, min</th><th>Core hardness, min</th></tr>' + saeRows + '</table></div>' +
    '<p class="ms">' + rEsc(F.sae_note || '') + ' ASTM A574 values are from one publisher\'s handbook so far (hardness confirmed by a second). Grade 1 bolts carry no grade mark.</p>' +
    legend +
    '<div class="res" style="margin-top:12px"><div class="h">Reading the head marks</div><div style="display:flex;flex-wrap:wrap;gap:14px;padding:10px">' +
    [['g2', 'SAE Grade 2', 'No grade lines (maker\'s mark only).'], ['g5', 'SAE Grade 5', 'Three radial lines, 120 degrees apart.'], ['g8', 'SAE Grade 8', 'Six radial lines, 60 degrees apart.'], ['iso', 'ISO 8.8 / 10.9 / 12.9', 'Class number and the maker\'s mark on the head.']].map(([k, t, d]) =>
      '<div style="width:150px">' + headMarkSvg(k, k === 'iso' ? '10.9' : '') + '<div><b>' + rEsc(t) + '</b></div><div class="ms">' + rEsc(d) + '</div></div>').join('') + '</div>' +
    '<p class="ms" style="padding:0 10px 10px">Metric class numbers read as follows: the first number times 100 is the nominal tensile strength in MPa, the second number times 10 is the yield strength as a percentage of it (8.8: 800 MPa, yield 80 % = 640 MPa). A leading zero (04.6, 010.9) marks a part with reduced loadability, such as a thin-head screw, that cannot carry the full class load. Counting radial lines on an inch bolt: the grade is the number of lines plus 2. Drawings are schematic.</p></div>' +
    '<div class="note" id="bgsrc"></div>';
  $('#bgsrc', el).innerHTML = srcNote(F, ['OPTIMAS', 'WESTFIELD', 'MUTUAL', 'BOSSARD', 'MSC', 'AFT', 'MAREK']);
}

// ------------------------------------------------------------------ torque and preload
function isoClassRow(F, cls, dmm) {
  const key = cls === '8.8' ? (dmm <= 16 ? '8.8 d<=16' : '8.8 d>16') : cls;
  return F.iso898.find(r => r.size === key);
}
function saeRow(F, grade, din) {
  const pick = { g2: din <= 0.75 ? 'Grade 2, 1/4 to 3/4 in' : 'Grade 2, over 3/4 to 1 1/2 in', g5: din <= 1 ? 'Grade 5, 1/4 to 1 in' : 'Grade 5, over 1 to 1 1/2 in', g8: 'Grade 8, 1/4 to 1 1/2 in', a574: din <= 0.5 ? 'ASTM A574, #0 to 1/2 in' : 'ASTM A574, over 1/2 in' }[grade];
  return F.sae.find(r => r.size === pick);
}

async function renderBoltTorque(el) {
  const R = await loadFast(el); if (!R) return;
  const W = state.W, F = R.fasteners, srcs = F.sources, opts = threadOptions(R), inch = inMode();
  const m = FMEM.tq || (FMEM.tq = { key: 'M10x1.5', d: 10, p: 1.5, sys: 'metric', grade: '8.8', method: 'vdi', nu: 0.9, pct: '', fknown: '', mug: '', muk: '', head: 'hex', dw: '', dh: '', rp: '', sp: '' });
  if (m.u !== state.sys) { Object.assign(m, { u: state.sys, dw: '', dh: '', fknown: '', rp: '', sp: '' }); }
  const gradeOpts = [['4.6', 'ISO 4.6'], ['4.8', 'ISO 4.8'], ['5.6', 'ISO 5.6'], ['5.8', 'ISO 5.8'], ['6.8', 'ISO 6.8'], ['8.8', 'ISO 8.8'], ['9.8', 'ISO 9.8'], ['10.9', 'ISO 10.9'], ['12.9', 'ISO 12.9'], ['g2', 'SAE J429 Grade 2'], ['g5', 'SAE J429 Grade 5'], ['g8', 'SAE J429 Grade 8'], ['a574', 'ASTM A574 socket head'], ['custom', 'Other: enter strengths']];
  const sU = inch ? 'ksi' : 'MPa', fU = inch ? 'lbf' : 'kN';
  el.innerHTML = '<div class="grid" style="max-width:760px">' +
    fld('Thread', '<select id="qk">' + threadSelect(opts, m.key) + '</select>') +
    fld('Major diameter', numIn('qd', ''), uLen(), 'cust') +
    fld('Pitch' + (inch ? ' (threads per inch)' : ''), numIn('qp', ''), inch ? 'TPI' : 'mm', 'cust') +
    fld('Thread system', sel('qs', [['metric', 'ISO metric'], ['unified', 'Unified inch']], m.sys), null, 'cust') +
    fld('Property class or grade', sel('qg', gradeOpts, m.grade)) +
    fld('Minimum yield Rp0.2 / ReL', numIn('qrp', m.rp), sU, 'gcust') +
    fld('Proof stress Sp', numIn('qsp', m.sp), sU, 'gcust') +
    fld('Preload from', sel('qm', [['vdi', 'Yield utilisation while tightening (VDI 2230)'], ['proof', 'Percent of proof load'], ['known', 'A preload I know']], m.method)) +
    fld('Utilisation of yield nu', numIn('qnu', m.nu), '0-1', 'mvdi') +
    fld('Percent of proof load', numIn('qpct', m.pct, 'your target'), '%', 'mproof') +
    fld('Preload', numIn('qf', m.fknown), fU, 'mknown') +
    fld('Thread friction muG (required)', numIn('qmg', m.mug, 'e.g. class B 0.08-0.16'), '') +
    fld('Head / nut friction muK (required)', numIn('qmk', m.muk, 'e.g. class B 0.08-0.16'), '') +
    fld('Bearing face under the head', sel('qh', [['hex', 'Hex head or nut (dw = width across flats)'], ['shcs', 'Socket head cap screw (dw = head diameter)'], ['custom', 'Enter dw']], m.head)) +
    fld('Bearing face outside diameter dw', numIn('qdw', m.dw, 'from the table'), uLen()) +
    fld('Clearance hole dh', numIn('qdh', m.dh, 'from the table'), uLen()) +
    '</div><div id="qres"></div>' +
    '<div class="res" style="margin-top:12px"><div class="h">Typical friction coefficients (classes A to E, VDI 2230-1:2015 as printed by Bossard)</div><table>' +
    F.torque_friction.classes.map(([c, r, d]) => '<tr><td><b>' + c + '</b></td><td class="v">' + rEsc(r) + '</td><td>' + rEsc(d) + '</td></tr>').join('') +
    '</table><p class="ms" style="padding:4px 10px">These ranges are for planning only. BenchMate never fills friction in for you: friction scatter is the largest error in torque tightening, and the same torque gives very different preloads on dry, oiled or plated parts. Use values measured for your parts, or from your fastener or lubricant maker. Measured mean friction on structural bolts (Hameedi and Völgyi, 2025) ran from 0.13 oiled to 0.44 dry.</p></div>' +
    '<div class="note"><b>Working:</b> Tightening torque MA = F (0.16 P + 0.58 d2 muG + DKm/2 muK), DKm = (dw + dh)/2 (VDI 2230-1:2015, equation R13). The three terms are the torque that stretches the bolt, thread friction and friction under the head or nut. Preload at a yield utilisation nu (VDI 2230 uses 0.9): FM = As nu Rp0.2 / sqrt(1 + 3 [3/2 d2/d0 (P/(pi d2) + 1.155 muG)]^2), the preload at which the combined tension and thread torsion in the bolt reaches nu x yield while tightening (R7). As = pi/4 d0^2 with d0 = d - 0.938194 P for ISO metric (ISO 898-1 clause 9.1.6.1) and d - 0.9743 P for Unified (ASME B1.1); d2 = d - 0.649519 P. Percent of proof load: F = % x Sp x As. ' +
    'The torque then follows from the friction you enter. Results assume a bolt with a full-size shank (A0 = As), steel parts, room temperature and no embedding or relaxation losses; tightening by torque scatters the preload by about +/-20 % or more even with known friction. It is not a joint design: VDI 2230 also checks the clamped parts, the working load, fatigue and surface pressure under the head.<br>' +
    '<b>Sources:</b> VDI 2230 Part 1:2015 (by name and equation number only). The same relations are printed by FVA (FVA-Workbench bolt connection, eq. 230 and 259) and by Hameedi and Völgyi, ÉPKO 2025, eq. (3). The torque formula was checked against published VDI 2230 table values (test in core/src/fasteners.rs). Bossard: tables at 90 % yield utilisation with ISO 273 medium holes. Property values: see Bolt grades and property classes.</div>' +
    '<div class="note" id="qsrc"></div>';
  const g = id => $('#' + id, el);
  const show = (cls, on) => el.querySelectorAll('.' + cls).forEach(x => x.style.display = on ? '' : 'none');
  function setCustom() {
    const c = g('qk').value === 'custom';
    show('cust', c);
    g('qd').value = +toUser(m.d).toFixed(inch ? 4 : 3); g('qp').value = inch ? +(IN_MM / m.p).toFixed(3) : +m.p.toFixed(4); g('qs').value = m.sys;
  }
  function thread() {
    const s = opts.find(o => o.key === g('qk').value);
    if (s) return { d: s.d, p: s.p, sys: s.sys, label: s.label };
    const d = fromUser(parseFloat(g('qd').value)), pv = parseFloat(g('qp').value);
    return { d, p: inch ? IN_MM / pv : pv, sys: g('qs').value, label: 'custom' };
  }
  // Bearing diameter and hole from the tables (mm), or null.
  function lookup(t) {
    const out = {};
    if (t.sys === 'metric') {
      const key = 'M' + (+t.d.toFixed(3));
      const af = F.af_metric.find(r => r.size === key), sh = F.shcs_metric.find(r => r.size === key), cl = F.clearance_metric.find(r => r.size === key);
      if (af && af.iso) out.hex = [af.iso.value, 'ISO width across flats ' + af.iso.value + ' mm'];
      if (sh && sh.dk_max) out.shcs = [sh.dk_max.value, 'head diameter ' + sh.dk_max.value + ' mm'];
      if (cl && cl.medium) out.dh = [cl.medium.value, 'medium clearance hole ' + cl.medium.value + ' mm' + (cl.medium.status === 'confirmed' ? '' : ' (publishers differ)')];
    } else {
      const din = t.d / IN_MM;
      const near = rows => rows.find(r => Math.abs(inchSize(r.size) - din) < 1e-4);
      const af = near(F.af_inch), sh = near(F.shcs_inch), cl = near(F.clearance_inch);
      if (af && af.hex) out.hex = [af.hex.value * IN_MM, 'hex width across flats ' + af.hex.value + ' in'];
      if (sh && sh.head_d_max) out.shcs = [sh.head_d_max.value * IN_MM, 'head diameter ' + sh.head_d_max.value + ' in'];
      const hole = cl && (cl.normal || cl.free);
      if (hole) out.dh = [hole.value * IN_MM, (cl.normal ? 'normal' : 'free') + ' fit clearance hole ' + hole.value + ' in'];
    }
    return out;
  }
  function strengths(t) {
    const G = g('qg').value;
    if (G === 'custom') {
      const k = inch ? 1 / 0.1450377 : 1;
      return { rp: parseFloat(g('qrp').value) * k, sp: parseFloat(g('qsp').value) * k, src: 'as entered', warn: '' };
    }
    if (/^g|a574/.test(G)) {
      const r = saeRow(F, G, t.d / IN_MM); if (!r) return {};
      return { rp: r.yield_min ? r.yield_min.value * PSI_MPA : NaN, sp: r.sp ? r.sp.value * PSI_MPA : NaN, row: r, src: r.size, warn: differWarn(r, PSI_MPA) };
    }
    const r = isoClassRow(F, G, t.d); if (!r) return {};
    return { rp: r.yield_min ? r.yield_min.value : NaN, sp: r.sp ? r.sp.value : NaN, row: r, src: 'ISO ' + r.size.replace('d<=16', 'd ≤ 16').replace('d>16', 'd > 16'), warn: differWarn(r, 1) };
  }
  // Publishers that print different strengths for the row in use: list them all; the value used is the first group.
  function differWarn(r, k) {
    const w = [['sp', 'proof'], ['yield_min', 'yield']].filter(([f]) => r[f] && r[f].status !== 'confirmed' && r[f].groups.length > 1)
      .map(([f, n]) => n + ': ' + r[f].groups.map(gr => (inch ? fx(gr.value * k * 0.1450377, 1) + ' ksi' : fx(gr.value * k, 0) + ' MPa') + ' (' + gr.publishers.map(p => pubName(srcs, p)).join(', ') + ')').join(' / '));
    return w.length ? '<br><span class="warn">Publishers differ, ' + rEsc(w.join('; ')) + '. The first is used; check the value against your fastener\'s certificate or enter it with Other.</span>' : '';
  }
  function upd() {
    Object.assign(m, { key: g('qk').value, grade: g('qg').value, method: g('qm').value, nu: g('qnu').value, pct: g('qpct').value, fknown: g('qf').value, mug: g('qmg').value, muk: g('qmk').value, head: g('qh').value, dw: g('qdw').value, dh: g('qdh').value, rp: g('qrp').value, sp: g('qsp').value });
    show('gcust', m.grade === 'custom'); show('mvdi', m.method === 'vdi'); show('mproof', m.method === 'proof'); show('mknown', m.method === 'known');
    const t = thread(), out = $('#qres', el);
    if (!(t.d > 0 && t.p > 0 && t.p < t.d)) { out.innerHTML = '<div class="res"><table><tr><td class="warn">Enter the thread size.</td></tr></table></div>'; return; }
    if (g('qk').value === 'custom') { m.d = t.d; m.p = t.p; m.sys = t.sys; }
    const sysN = t.sys === 'unified' ? 1 : 0;
    const d2 = W.thread_basic_pitch_dia(t.d, t.p), d0 = W.stress_dia(t.d, t.p, sysN), As = W.stress_area(t.d, t.p, sysN);
    const lk = lookup(t), S = strengths(t);
    // Bearing face and hole: typed value wins; else the table value.
    const dwT = m.head === 'hex' ? lk.hex : m.head === 'shcs' ? lk.shcs : null;
    const dw = m.dw !== '' ? fromUser(parseFloat(m.dw)) : dwT ? dwT[0] : NaN, dh = m.dh !== '' ? fromUser(parseFloat(m.dh)) : lk.dh ? lk.dh[0] : NaN;
    g('qdw').placeholder = dwT ? (inch ? fx(dwT[0] / IN_MM, 3) : fx(dwT[0], 2)) + ' from the table' : 'enter';
    g('qdh').placeholder = lk.dh ? (inch ? fx(lk.dh[0] / IN_MM, 4) : fx(lk.dh[0], 2)) + ' from the table' : 'enter';
    const mug = parseFloat(m.mug), muk = parseFloat(m.muk);
    const rows = [];
    const len = mm => fBoth(mm), area = mm2 => '<span class="mv">' + (inch ? fx(mm2 / 645.16, 4) + ' in²' : fx(mm2, 2) + ' mm²') + '</span> <span class="ms">' + (inch ? fx(mm2, 2) + ' mm²' : fx(mm2 / 645.16, 4) + ' in²') + '</span>';
    const force = n => '<span class="mv">' + (inch ? fx(n / LBF_N, 0) + ' lbf' : fx(n / 1000, 2) + ' kN') + '</span> <span class="ms">' + (inch ? fx(n / 1000, 2) + ' kN' : fx(n / LBF_N, 0) + ' lbf') + '</span>';
    const torque = nmm => { const nm = nmm / 1000; return '<span class="mv">' + (inch ? fx(nm / NM_LBFT, 1) + ' lbf·ft' : fx(nm, 1) + ' N·m') + '</span> <span class="ms">' + (inch ? fx(nm / NM_LBFT * 12, 0) + ' lbf·in, ' + fx(nm, 1) + ' N·m' : fx(nm / NM_LBFT, 1) + ' lbf·ft') + '</span>'; };
    const stress = mpa => '<span class="mv">' + (inch ? fx(mpa * 0.1450377, 1) + ' ksi' : fx(mpa, 0) + ' MPa') + '</span>';
    rows.push(['Pitch diameter d2', len(d2)], ['Stress diameter d0', len(d0)], ['Tensile stress area As', area(As)]);
    rows.push(['Strength used', S.src ? rEsc(S.src) + ': yield ' + stress(S.rp) + ', proof ' + (isFinite(S.sp) ? stress(S.sp) : '<span class="ms">not printed</span>') + (S.row ? ' <span class="ms">(' + pubsOf(srcs, S.row) + ')</span>' + S.warn : '') : '<span class="warn">no table row for this size; choose Other and enter the strengths</span>']);
    let Fp = NaN, how = '';
    if (m.method === 'vdi') {
      const nu = parseFloat(m.nu);
      if (!(mug >= 0)) how = 'Enter the thread friction muG.';
      else if (!(nu > 0 && nu <= 1)) how = 'Enter the utilisation nu (0 to 1).';
      else if (!(S.rp > 0)) how = 'No yield strength.';
      else Fp = W.preload_permitted(As, d0, d2, t.p, mug, nu, S.rp);
    } else if (m.method === 'proof') {
      const pct = parseFloat(m.pct);
      if (!(pct > 0)) how = 'Enter the percent of proof load you want.';
      else if (!(S.sp > 0)) how = 'No proof stress for this grade; enter one with Other.';
      else Fp = W.preload_from_proof(As, S.sp, pct);
    } else {
      const fk = parseFloat(m.fknown);
      if (!(fk > 0)) how = 'Enter the preload.'; else Fp = inch ? fk * LBF_N : fk * 1000;
    }
    if (isFinite(Fp)) rows.push(['Preload F', force(Fp)]);
    const dkm = W.bearing_mean_dia(dw, dh);
    rows.push(['Mean head bearing diameter DKm = (dw + dh)/2', isFinite(dkm) ? len(dkm) + ' <span class="ms">dw ' + (m.dw !== '' ? 'as entered' : dwT ? rEsc(dwT[1]) : '-') + '; dh ' + (m.dh !== '' ? 'as entered' : lk.dh ? rEsc(lk.dh[1]) : '-') + '</span>' : '<span class="warn">enter dw and dh</span>']);
    if (isFinite(Fp) && mug >= 0 && muk >= 0 && isFinite(dkm)) {
      const T = W.tightening_torque(Fp, t.p, d2, mug, dkm, muk);
      const part = i => W.tightening_torque_part(Fp, t.p, d2, mug, dkm, muk, i);
      rows.push(['<b>Tightening torque MA</b>', torque(T)]);
      rows.push(['Share: stretching the bolt / thread friction / head friction', '<span class="mv">' + [0, 1, 2].map(i => fx(part(i) / T * 100, 0) + ' %').join(' / ') + '</span>']);
      rows.push(['Equivalent nut factor K (T = K F d)', '<span class="mv">' + fx(W.nut_factor(T, Fp, t.d), 3) + '</span>']);
      const seq = W.assembly_equiv_stress(Fp, As, d0, t.p, d2, mug);
      const pctY = S.rp > 0 ? seq / S.rp * 100 : NaN;
      rows.push(['Tension stress F / As', stress(Fp / As)]);
      rows.push(['Equivalent stress while tightening (tension + thread torsion)', stress(seq) + (isFinite(pctY) ? ' <span class="' + (pctY > 100 ? 'warn' : 'ms') + '">' + fx(pctY, 0) + ' % of minimum yield' + (pctY > 100 ? ': the bolt will yield' : '') + '</span>' : '')]);
    } else if (!how) how = (mug >= 0 ? '' : 'Enter the thread friction muG. ') + (muk >= 0 ? '' : 'Enter the head friction muK. ') + (isFinite(dkm) ? '' : 'Enter dw and dh.');
    out.innerHTML = '<div class="res"><div class="h">Results for ' + rEsc(t.label === 'custom' ? 'custom thread' : t.label) + '</div><table>' + rows.map(r => '<tr><td>' + r[0] + '</td><td class="v" style="white-space:normal">' + r[1] + '</td></tr>').join('') +
      (how ? '<tr><td colspan="2" class="warn">' + rEsc(how) + '</td></tr>' : '') + '</table></div>';
  }
  $('#qsrc', el).innerHTML = srcNote(F, ['FVA', 'HAMEEDI', 'BOSSARD_VDI', 'BOSSARD_F044', 'MAREK']);
  g('qk').onchange = () => { setCustom(); upd(); };
  ['qd', 'qp', 'qnu', 'qpct', 'qf', 'qmg', 'qmk', 'qdw', 'qdh', 'qrp', 'qsp'].forEach(id => g(id).oninput = upd);
  ['qs', 'qg', 'qm', 'qh'].forEach(id => g(id).onchange = upd);
  setCustom(); upd();
}

// ------------------------------------------------------------------ socket head cap screws
function shcsSvg(dk, k, d, cb, depth) {
  // Section of a socket head cap screw in a counterbore. Proportional to the numbers given (mm).
  const W0 = 220, H0 = 170, sc = Math.min(120 / Math.max(cb || dk, dk), 110 / (k + 1.6 * d)), cx = 110, top = 22;
  const X = v => (cx + v * sc).toFixed(1), Y = v => (top + v * sc).toFixed(1);
  const cbw = (cb || dk * 1.1) / 2, dep = depth || k * 1.05, hole = d * 0.55;
  const part = 'M' + X(-W0 / sc / 2 + 4 / sc) + ' ' + Y(0) + 'H' + X(-cbw) + 'V' + Y(dep) + 'H' + X(-hole) + 'V' + Y(dep + 1.6 * d) + 'M' + X(hole) + ' ' + Y(dep + 1.6 * d) + 'V' + Y(dep) + 'H' + X(cbw) + 'V' + Y(0) + 'H' + X(W0 / sc / 2 - 4 / sc);
  const head = 'M' + X(-dk / 2) + ' ' + Y(dep - k) + 'h' + (dk * sc).toFixed(1) + 'v' + (k * sc).toFixed(1) + 'h' + (-dk * sc).toFixed(1) + 'z';
  const shank = 'M' + X(-d / 2) + ' ' + Y(dep) + 'V' + Y(dep + 1.5 * d) + 'H' + X(d / 2) + 'V' + Y(dep);
  const key = 'M' + X(-d * 0.3) + ' ' + Y(dep - k) + 'v' + (k * 0.5 * sc).toFixed(1) + 'h' + (d * 0.6 * sc).toFixed(1) + 'v' + (-k * 0.5 * sc).toFixed(1);
  return '<svg class="gdia big" viewBox="0 0 ' + W0 + ' ' + H0 + '" role="img" aria-label="socket head cap screw in a counterbore"><path class="gb" d="' + part + '"/><path class="gp" d="' + head + '"/><path class="gp" d="' + shank + '"/><path class="gm" d="' + key + '"/>' +
    '<path class="gm" style="stroke-dasharray:2 3" d="M' + X(0) + ' ' + Y(-1) + 'V' + Y(dep + 1.6 * d + 1) + '"/>' +
    '<text class="gl" x="' + X(cbw + 1) + '" y="' + Y(dep / 2) + '">counterbore</text><text class="gl" x="' + X(d / 2 + 1) + '" y="' + Y(dep + d) + '">clearance hole</text><text class="gl" x="6" y="' + (H0 - 6) + '">schematic</text></svg>';
}

async function renderShcs(el) {
  const R = await loadFast(el); if (!R) return;
  const F = R.fasteners, srcs = F.sources;
  const m = FMEM.shcs || (FMEM.shcs = { sys: inMode() ? 'inch' : 'metric', mk: 'M6', ik: '1/4' });
  el.innerHTML = '<div class="grid" style="max-width:760px">' + fld('Series', sel('ss', [['metric', 'Metric (ISO 4762)'], ['inch', 'Inch 1960 series (ASME B18.3)']], m.sys)) + fld('Size', '<select id="sz"></select>') + '</div><div id="sres"></div>' + legend +
    '<div class="note"><b>Working:</b> Head diameter, head height and hex key are as printed; the head height and the body diameter are the same nominal number on both series. Counterbore sizes are recommendations, not part of the screw standards, and the publishers differ: the MSC handbook (ASME B18.3.1M style, metric; and inch) gives larger counterbores than MISUMI (JIS B 1176 practice). Pick one and keep it on the drawing. A counterbore at least 0.5 to 1 mm (0.02 to 0.04 in) larger than the maximum head diameter clears the head with a standard counterbore tool; check the head-to-hole radius under the head before using a sharp-cornered hole.<br><b>Sources:</b> ISO 4762:2004 and ASME B18.3 (by name only); publishers listed below.</div><div class="note" id="ssrc"></div>';
  const ss = $('#ss', el), sz = $('#sz', el);
  function sizes() {
    const list = ss.value === 'metric' ? F.shcs_metric : F.shcs_inch;
    const cur = ss.value === 'metric' ? m.mk : m.ik;
    sz.innerHTML = list.map(r => '<option value="' + rEsc(r.size) + '"' + (r.size === cur ? ' selected' : '') + '>' + rEsc(ss.value === 'metric' ? r.size : inchLabel(r.size)) + '</option>').join('');
  }
  function upd() {
    m.sys = ss.value; if (m.sys === 'metric') m.mk = sz.value; else m.ik = sz.value;
    const met = m.sys === 'metric', s = sz.value;
    const find = rows => rows.find(r => r.size === s);
    const r = find(met ? F.shcs_metric : F.shcs_inch), cl = find(met ? F.clearance_metric : F.clearance_inch), cb = find(met ? F.cbore_metric : F.cbore_inch);
    if (!r) return;
    const L = met ? v => mmIn(v) : v => inMm(v), keyShow = met ? v => fx(+v, 1) + ' mm' : v => rEsc(v) + ' in';
    const row = (lab, cell) => '<tr><td>' + lab + '</td>' + cell + '</tr>';
    let h = '<div class="res"><div class="h">' + rEsc(met ? s : inchLabel(s)) + ' socket head cap screw <span class="ms">(' + pubsOf(srcs, r) + ')</span></div><table>' +
      row('Nominal diameter', '<td class="mv">' + (met ? mmIn(+s.slice(1)) : inMm(inchSize(s), 4)) + '</td>') +
      row('Head diameter, max', fCell(srcs, met ? r.dk_max : r.head_d_max, L)) + row('Head diameter, min', fCell(srcs, met ? r.dk_min : r.head_d_min, L)) +
      row('Head height, max', fCell(srcs, met ? r.k_max : r.head_h_max, L)) + row('Head height, min', fCell(srcs, met ? r.k_min : r.head_h_min, L)) +
      row('Hex key (socket) size', fCell(srcs, met ? r.s_key : r.key, keyShow)) + '</table></div>';
    if (cl) h += '<div class="res" style="margin-top:12px"><div class="h">Clearance hole</div><table>' + (met
      ? row('Fine (close)', fCell(srcs, cl.fine, L)) + row('Medium (normal)', fCell(srcs, cl.medium, L)) + row('Coarse (loose)', fCell(srcs, cl.coarse, L))
      : row('Close fit', fCell(srcs, cl.close, L)) + row('Normal fit (MSC)', fCell(srcs, cl.normal, L)) + row('Free fit (TR Fastenings)', fCell(srcs, cl.free, L))) + '</table></div>';
    if (cb) h += '<div class="res" style="margin-top:12px"><div class="h">Counterbore</div><table>' +
      row('Counterbore diameter', fCell(srcs, cb.cbore_d, L)) + (met ? row('Counterbore depth (MISUMI: head flush to just below)', cb.depth_min ? '<td class="mv">' + mmIn(cb.depth_min.value) + ' to ' + mmIn(cb.depth_max.value) + ' ' + badge(cb.depth_min.status) + '</td>' : '<td class="mv">-</td>') : '') + '</table></div>';
    const dk = met ? r.dk_max.value : r.head_d_max.value * IN_MM, k = met ? r.k_max.value : r.head_h_max.value * IN_MM, d = met ? +s.slice(1) : inchSize(s) * IN_MM;
    const cbd = cb && cb.cbore_d ? (met ? cb.cbore_d.value : cb.cbore_d.value * IN_MM) : null, dep = cb && cb.depth_max ? cb.depth_max.value : null;
    h += shcsSvg(dk, k, d, cbd, dep);
    $('#sres', el).innerHTML = h;
  }
  $('#ssrc', el).innerHTML = srcNote(F, ['MSC', 'MISUMI', 'AFT', 'AMFAST', 'NBK', 'OPTIMAS_TAP', 'FRACTORY', 'TRF']);
  ss.onchange = () => { sizes(); upd(); }; sz.onchange = upd;
  sizes(); upd();
}

// ------------------------------------------------------------------ clearance holes
async function renderClearance(el) {
  const R = await loadFast(el); if (!R) return;
  const F = R.fasteners, srcs = F.sources;
  const L = v => mmIn(v), Li = v => inMm(v, 4);
  el.innerHTML = '<div class="res mtab"><div class="h">Metric clearance holes (ISO 273 fine / medium / coarse series)</div><table><tr><th>Thread</th><th>Fine</th><th>Medium</th><th>Coarse</th></tr>' +
    F.clearance_metric.map(r => '<tr><td><b>' + rEsc(r.size) + '</b></td>' + fCell(srcs, r.fine, L) + fCell(srcs, r.medium, L) + fCell(srcs, r.coarse, L) + '</tr>').join('') + '</table></div>' +
    '<p class="ms">' + rEsc(F.clearance_metric_note || '') + ' For M12, M14 and M16 two publishers print the ISO 273 values (13.5 / 15.5 / 17.5 medium) and two others print a series 0.5 mm larger (14 / 16 / 18); the second set is not the ISO 273 series. Use the ISO 273 column of your drawing standard.</p>' +
    '<div class="res mtab" style="margin-top:12px"><div class="h">Inch clearance holes</div><table><tr><th>Size</th><th>Close fit</th><th>Normal fit (MSC)</th><th>Free fit (TR Fastenings)</th><th>Drills printed</th></tr>' +
    F.clearance_inch.map(r => '<tr><td><b>' + rEsc(inchLabel(r.size)) + '</b></td>' + fCell(srcs, r.close, Li) + fCell(srcs, r.normal, Li) + fCell(srcs, r.free, Li) + '<td class="ms">' + [r.close_drill, r.free_drill].map(c => c ? rEsc(c.value) : '-').join(' / ') + '</td></tr>').join('') + '</table></div>' +
    '<p class="ms">' + rEsc(F.clearance_inch_note || '') + ' The two inch lists are different recommendations (each maker\'s own close fit), so they are shown side by side, not merged. ASME B18.2.8 is the US standard for clearance holes; its tables were not available from a free publisher.</p>' + legend +
    '<div class="note"><b>Working:</b> no calculation: values as printed. ISO 273:1979 (current, iso.org) defines the fine, medium and coarse series; JIS B 1001 grades 1, 2 and 3 match them.<br><b>Sources:</b> ISO 273:1979, ASME B18.2.8 (by name only); publishers below.</div><div class="note" id="csrc"></div>';
  $('#csrc', el).innerHTML = srcNote(F, ['NBK', 'TRF', 'OPTIMAS_TAP', 'FRACTORY', 'MSC']);
}

// ------------------------------------------------------------------ spanner and hex key sizes
// Cross-reference of the metric and inch widths across flats: every size of the two tables, in order of size.
function spannerOrder(F) {
  const W = state.W, by = new Map();
  const add = (mm, name, inch, use) => { const k = mm.toFixed(3); if (!by.has(k)) by.set(k, { mm, name, inch, uses: [] }); by.get(k).uses.push(use); };
  F.af_metric.forEach(r => { const seen = {}; ['iso', 'din', 'jis'].forEach(f => { if (r[f]) (seen[r[f].value] = seen[r[f].value] || []).push(f === 'din' ? 'old DIN' : f.toUpperCase()); }); Object.keys(seen).forEach(v => add(+v, fx(+v, +v % 1 ? 1 : 0) + ' mm', false, r.size + ' (' + seen[v].join(', ') + ')')); });
  F.af_inch.forEach(r => { if (r.hex) { const f = fracText(W, r.hex.value, 16); add(f.val * IN_MM, f.txt, true, inchLabel(r.size) + ' (ASME)'); } });
  return [...by.values()].sort((a, b) => a.mm - b.mm).map(e => '<tr><td><b>' + rEsc(e.name) + '</b></td><td class="mv">' + fx(e.mm, e.inch ? 4 : (e.mm % 1 ? 1 : 0)) + '</td><td class="mv">' + fx(e.mm / IN_MM, e.inch ? 4 : 3) + '</td><td class="ms">' + rEsc(e.uses.join('; ')) + '</td></tr>').join('');
}
async function renderSpanner(el) {
  const R = await loadFast(el); if (!R) return;
  const F = R.fasteners, srcs = F.sources, m = FMEM.span || (FMEM.span = { q: '' });
  const mm = v => fx(v, v % 1 ? 1 : 0) + ' mm', inch = v => fx(v, 3) + ' in';
  el.innerHTML = '<div class="grid" style="max-width:760px">' + fld('Find a spanner or key size', numIn('sq', m.q, 'e.g. 13 (mm) or 0.5 (in)'), 'mm or in') + '</div><div id="sqres"></div>' +
    '<div class="res mtab"><div class="h">Metric hexagon heads and nuts: width across flats</div><table><tr><th>Thread</th><th>ISO 272</th><th>DIN (old)</th><th>JIS</th><th>Socket head key</th></tr>' +
    F.af_metric.map(r => { const k = F.shcs_metric.find(x => x.size === r.size); return '<tr><td><b>' + rEsc(r.size) + '</b></td>' + fCell(srcs, r.iso, mm) + fCell(srcs, r.din, mm) + fCell(srcs, r.jis, mm) + fCell(srcs, k && k.s_key, v => fx(v, 1) + ' mm') + '</tr>'; }).join('') + '</table></div>' +
    '<p class="ms">ISO 272 (1982) moved M10, M12, M14 and M22 to 16, 18, 21 and 34 mm; older DIN parts and many tools still use 17, 19, 22 and 32 mm. ' + rEsc(F.af_metric_note || '') + '</p>' +
    '<div class="res mtab" style="margin-top:12px"><div class="h">Inch hexagon heads: width across flats</div><table><tr><th>Size</th><th>Hex head (ASME)</th><th>BS (Whitworth)</th><th>Socket head key</th></tr>' +
    F.af_inch.map(r => { const k = F.shcs_inch.find(x => x.size === r.size); return '<tr><td><b>' + rEsc(inchLabel(r.size)) + '</b></td>' + fCell(srcs, r.hex, inch) + fCell(srcs, r.bs, inch) + fCell(srcs, k && k.key, v => rEsc(v) + ' in') + '</tr>'; }).join('') + '</table></div>' +
    '<p class="ms">Accu\'s inch list is for hex nuts, which are larger than hex cap screw heads at 7/16 and 9/16 (11/16 and 7/8 against 5/8 and 13/16), so those two rows differ. Heavy hex bolts and nuts are larger again.</p>' +
    '<div class="res mtab" style="margin-top:12px" id="spx"><div class="h">Metric and inch spanner and socket sizes in order of size</div><table><tr><th>Spanner</th><th>mm</th><th>in</th><th>Hexagon heads in the tables above</th></tr>' + spannerOrder(F) + '</table></div>' +
    '<p class="ms">The list only puts the sizes of the two tables in order, with each size converted to the other unit. It does not say that neighbouring sizes can replace each other. Inch sizes are the ASME hex head column; British Standard (Whitworth) spanners are marked with the bolt size, not the width, and are left out.</p>' + legend +
    '<p class="ms">Head heights, nut heights and plain washers are in <a href="#/t/hexhw">hexagon screws, nuts and washers</a>.</p>' +
    '<div class="note"><b>Sources:</b> ISO 272:1982 (current; a revision is at DIS stage on iso.org), ASME B18.2.1 and B18.3 (by name only); publishers below.</div><div class="note" id="spsrc"></div>';
  function find() {
    const v = parseFloat($('#sq', el).value); m.q = $('#sq', el).value;
    const out = $('#sqres', el);
    if (!(v > 0)) { out.innerHTML = ''; return; }
    const hits = [];
    F.af_metric.forEach(r => ['iso', 'din', 'jis'].forEach(f => { if (r[f] && Math.abs(r[f].value - v) < 0.051) hits.push(r.size + ' hex (' + f.toUpperCase() + ')'); }));
    F.shcs_metric.forEach(r => { if (r.s_key && Math.abs(r.s_key.value - v) < 0.051) hits.push(r.size + ' socket head (hex key)'); });
    F.af_inch.forEach(r => ['hex', 'bs'].forEach(f => { if (r[f] && Math.abs(r[f].value - v) < 0.0011) hits.push(inchLabel(r.size) + (f === 'hex' ? ' hex head' : ' BS hex')); }));
    F.shcs_inch.forEach(r => { if (r.key && Math.abs(fracIn(r.key.value) - v) < 0.0011) hits.push(inchLabel(r.size) + ' socket head (hex key)'); });
    const near = v < 4 && v * IN_MM > 1 ? ' <span class="ms">(' + fx(v * IN_MM, 2) + ' mm if inch)</span>' : ' <span class="ms">(' + fx(v / IN_MM, 4) + ' in if mm)</span>';
    out.innerHTML = '<div class="res" style="margin-bottom:12px"><div class="h">Fits ' + rEsc(String(v)) + near + '</div><table><tr><td>' + (hits.length ? hits.map(rEsc).join('<br>') : 'No size in these tables.') + '</td></tr></table></div>';
  }
  $('#sq', el).oninput = find; find();
  $('#spsrc', el).innerHTML = srcNote(F, ['WIKI_AF', 'ACCU', 'SLS', 'MSC', 'MISUMI', 'AFT', 'AMFAST']);
}

// ------------------------------------------------------------------ T-slots
function tslotSvg(a, b, c, h) {
  const sc = 150 / Math.max(b * 1.6, h * 1.6), W0 = 240, H0 = 180, cx = 120, top = 30;
  const X = v => (cx + v * sc).toFixed(1), Y = v => (top + v * sc).toFixed(1);
  const p = 'M' + X(-b * 0.8) + ' ' + Y(0) + 'H' + X(-a / 2) + 'V' + Y(h - c) + 'H' + X(-b / 2) + 'V' + Y(h) + 'H' + X(b / 2) + 'V' + Y(h - c) + 'H' + X(a / 2) + 'V' + Y(0) + 'H' + X(b * 0.8);
  const dim = (x1, y1, x2, y2, t, tx, ty) => '<path class="gm" d="M' + x1 + ' ' + y1 + 'L' + x2 + ' ' + y2 + '"/><text class="gl" x="' + tx + '" y="' + ty + '" text-anchor="middle" style="fill:var(--ink)">' + t + '</text>';
  return '<svg class="gdia big" viewBox="0 0 ' + W0 + ' ' + H0 + '" role="img" aria-label="T-slot section"><path class="gp" d="' + p + '"/>' +
    dim(X(-a / 2), Y(-6 / sc), X(a / 2), Y(-6 / sc), 'a', X(0), Y(-9 / sc)) + dim(X(-b / 2), Y(h + 8 / sc), X(b / 2), Y(h + 8 / sc), 'b', X(0), Y(h + 20 / sc)) +
    dim(X(b / 2 + 8 / sc), Y(h - c), X(b / 2 + 8 / sc), Y(h), 'c', X(b / 2 + 16 / sc), Y(h - c / 2 + 4 / sc)) + dim(X(-b / 2 - 10 / sc), Y(0), X(-b / 2 - 10 / sc), Y(h), 'h', X(-b / 2 - 18 / sc), Y(h / 2)) + '</svg>';
}
async function renderTslots(el) {
  const R = await loadFast(el); if (!R) return;
  const F = R.fasteners, srcs = F.sources, m = FMEM.ts || (FMEM.ts = { a: '14' });
  const L = v => mmIn(v, 1, 3);
  const rng = (lo, hi) => lo && hi ? '<td class="mv" title="' + rEsc([lo, hi].map(c => c.groups.map(g => g.printed[0] + ': ' + g.publishers.map(p => pubName(srcs, p)).join(', ')).join(' | ')).join(' / ')) + '">' + L(lo.value) + ' to ' + L(hi.value) + ' ' + badge(lo.status === 'confirmed' && hi.status === 'confirmed' ? 'confirmed' : lo.status === 'review' || hi.status === 'review' ? 'review' : 'differs') + '</td>' : '<td class="mv">-</td>';
  el.innerHTML = '<div class="grid" style="max-width:760px">' + fld('Slot width a', sel('ta', F.tslots.map(r => [r.size, r.size + ' mm']), m.a)) + '</div><div id="tsres"></div>' +
    '<div class="res mtab" style="margin-top:12px"><div class="h">T-slots for machine tool tables (ISO 299), mm</div><table><tr><th>a</th><th>Head space width b</th><th>Head space height c</th><th>Total depth h</th><th>Bolt</th><th>Slot pitch</th></tr>' +
    F.tslots.map(r => '<tr><td><b>' + r.size + '</b></td>' + rng(r.b_min, r.b_max) + rng(r.c_min, r.c_max) + rng(r.h_min, r.h_max) + fCell(srcs, r.bolt) + '<td class="ms">' + rEsc(F.tslot_pitch[r.size] || '') + '</td></tr>').join('') + '</table></div>' + legend +
    '<p class="ms">Slot width a: tolerance H12 for clamping slots and H8 for locating (reference) slots. Pitches in brackets are to be avoided. DIN 650 uses the same slot sizes. Inch tables (ASME B5.1M) give the same metric slots with inch conversions.</p>' +
    '<div class="note"><b>Sources:</b> ISO 299:1987 (current, iso.org) and DIN 650 (by name only); publishers below. The total depth h is so far from one source.</div><div class="note" id="tssrc"></div>';
  function upd() {
    m.a = $('#ta', el).value;
    const r = F.tslots.find(x => x.size === m.a); if (!r) return;
    const mid = (lo, hi) => (lo.value + hi.value) / 2;
    $('#tsres', el).innerHTML = tslotSvg(+r.size, mid(r.b_min, r.b_max), mid(r.c_min, r.c_max), mid(r.h_min, r.h_max)) + '<p class="ms">Section drawn to the middle of each range; T-nut and T-bolt heads must fit inside b x c with clearance.</p>';
  }
  $('#ta', el).onchange = upd; upd();
  $('#tssrc', el).innerHTML = srcNote(F, ['EE_TSLOT', 'ITEH_299']);
}

// ------------------------------------------------------------------ hexagon screws, nuts and plain washers
// Side view of a bolted joint, to scale in mm apart from the clamped parts: head, parts, washer, nut.
function hexhwSvg(d, s, k, m, d2, h) {
  const W = 520, H = 300, grip = 0.8 * d, tail = 0.35 * d;
  const sc = Math.min(230 / Math.max(d2, s), 215 / (k + grip + h + m + tail)), cx = 215, top = 40;
  const y1 = top + k * sc, y2 = y1 + grip * sc, y3 = y2 + h * sc, y4 = y3 + m * sc, y5 = y4 + tail * sc;
  const hs = s / 2 * sc, r = d / 2 * sc, pw = Math.max(d2 / 2 * sc + 46, hs + 46);
  let g = DK.rect(cx - pw, y1, pw - r, y2 - y1, 'hatch') + DK.rect(cx + r, y1, pw - r, y2 - y1, 'hatch');
  g += DK.rect(cx - r, y1, 2 * r, y5 - y1, 'tool');
  g += DK.rect(cx - hs, top, 2 * hs, k * sc, 'part') + DK.line(cx - hs / 2, top, cx - hs / 2, y1, 'thin') + DK.line(cx + hs / 2, top, cx + hs / 2, y1, 'thin');
  g += DK.rect(cx - d2 / 2 * sc, y2, d2 * sc, h * sc, 'part');
  g += DK.rect(cx - hs, y3, 2 * hs, m * sc, 'part') + DK.line(cx - hs / 2, y3, cx - hs / 2, y4, 'thin') + DK.line(cx + hs / 2, y3, cx + hs / 2, y4, 'thin');
  g += DK.cl(cx, top - 26, cx, y5 + 10);
  g += DK.dimH(cx - hs, cx + hs, top - 16, 's', { from: top });
  g += DK.dimH(cx - d2 / 2 * sc, cx + d2 / 2 * sc, y5 + 18, 'd2', { from: y3, below: true });
  const xr = cx + pw + 26;
  g += DK.dimV(y1, top, xr, 'k', { from: cx + hs }) + DK.dimV(y3, y2, xr, 'h', { from: cx + d2 / 2 * sc }) + DK.dimV(y4, y3, xr + 34, 'm', { from: cx + hs });
  g += DK.text(cx - pw + 6, (y1 + y2) / 2 + 4, 'clamped parts', { cls: 'mut', anchor: 'start' }) + DK.text(W - 8, H - 8, 'head, washer and nut to scale', { cls: 'mut', anchor: 'end' });
  return '<div class="tdia" style="max-width:520px;margin-top:12px">' + DK.svg(W, H, g, 'Side view of a hexagon head screw through two parts with a plain washer and a hexagon nut') + '</div>';
}
async function renderHexhw(el) {
  const R = await loadFast(el); if (!R) return;
  const F = R.fasteners, srcs = F.sources;
  const m = FMEM.hexhw || (FMEM.hexhw = { sys: 'metric', mk: 'M10', ik: '1/2' });
  const L = v => mmIn(v), LI = v => inMm(v, 4);
  const rng = (lo, hi, show, bare) => lo && hi ? '<td class="mv" title="' + rEsc(lo.groups[0].publishers.map(p => pubName(srcs, p)).join(', ')) + '">' + show(lo.value) + ' to ' + show(hi.value) + (bare ? '' : ' ' + badge(lo.status === 'confirmed' && hi.status === 'confirmed' ? 'confirmed' : 'review')) + '</td>' : '<td class="mv">-</td>';
  const wm = z => F.washer_metric.find(r => r.size === z), nm = z => F.nut_metric.find(r => r.size === z);
  el.innerHTML = '<div class="grid" style="max-width:760px">' + fld('Series', sel('hs', [['metric', 'Metric (ISO 4017, ISO 4032, ISO 7089)'], ['inch', 'Inch hexagon nuts (ASME B18.2.2)']], m.sys)) + fld('Size', '<select id="hz"></select>') + '</div><div id="hres"></div>' +
    '<div class="res mtab" style="margin-top:12px"><div class="h">Metric hexagon head (ISO 4014, ISO 4017)</div><table><tr><th>Thread</th><th>Width across flats s</th><th>Head height k (nominal)</th></tr>' +
    F.hex_metric.map(r => '<tr><td><b>' + rEsc(r.size) + '</b></td>' + fCell(srcs, r.s, L) + fCell(srcs, r.k, L) + '</tr>').join('') + '</table></div>' +
    '<div class="res mtab" style="margin-top:12px"><div class="h">Metric hexagon nut, style 1 (ISO 4032)</div><table><tr><th>Thread</th><th>Across flats, max</th><th>Across flats, min</th><th>Height m, max</th><th>Height m, min</th></tr>' +
    F.nut_metric.map(n => '<tr><td><b>' + rEsc(n.size) + '</b></td>' + fCell(srcs, n.s_max, L) + fCell(srcs, n.s_min, L) + fCell(srcs, n.m_max, L) + fCell(srcs, n.m_min, L) + '</tr>').join('') + '</table></div>' +
    '<div class="res mtab" style="margin-top:12px"><div class="h">Metric plain washer, normal series (ISO 7089)</div><table><tr><th>For thread</th><th>Hole d1</th><th>Outside d2</th><th>Thickness h</th><th>Greatest hole *</th><th>Least outside *</th><th>Thickness range *</th></tr>' +
    F.washer_metric.map(r => '<tr><td><b>' + rEsc(r.size) + '</b></td>' + fCell(srcs, r.d1, L) + fCell(srcs, r.d2, L) + fCell(srcs, r.h, L) + fCell(srcs, r.d1_max, L, { nobadge: true }) + fCell(srcs, r.d2_min, L, { nobadge: true }) + rng(r.h_min, r.h_max, L, true) + '</tr>').join('') + '</table><p class="ms" style="margin:6px 8px">* One publisher (fasteners.eu, table headed DIN 125).</p></div>' +
    '<div class="res mtab" style="margin-top:12px"><div class="h">Inch hexagon nuts, coarse-thread sizes</div><table><tr><th>Thread</th><th>Across flats</th><th>Thickness</th></tr>' +
    F.nut_inch.map(r => '<tr><td><b>' + rEsc(inchLabel(r.size)) + '</b></td>' + fCell(srcs, r.af, v => rEsc(r.af_frac.value) + ' in = ' + LI(v)) + fCell(srcs, r.h, v => rEsc(r.h_frac.value) + ' in = ' + LI(v)) + '</tr>').join('') + '</table></div>' + legend +
    '<p class="ms">' + rEsc(F.nut_metric_note) + ' ' + rEsc(F.washer_metric_note) + ' ' + rEsc(F.nut_inch_note) + '</p>' +
    '<div class="note"><b>Working:</b> No calculation: values as printed. The head height is the nominal value; the screw standards put a tolerance on it that the two publishers used here do not both print. ISO 4014 (bolt with a plain shank) and ISO 4017 (threaded to the head) have the same head. Nuts are style 1 (the regular nut). Editions: fasten.it names DIN EN ISO 4032 of 04-2013 and the other publishers name none; a 2023 edition of ISO 4032 is listed in the AFNOR catalogue and the free tables could not be compared with it. The widths across flats of the head also count the publishers of the <a href="#/t/spanner">spanner table</a>, which lists the older DIN and the JIS sizes as well. Hole sizes for these screws are in <a href="#/t/clearance">clearance holes</a> and strengths in <a href="#/t/boltgrade">bolt grades</a>.<br><b>Sources:</b> ISO 4014, ISO 4017, ISO 4032, ISO 7089, DIN 125, ASME B18.2.2 (by name only); publishers below.</div><div class="note" id="hsrc"></div>';
  const hs = $('#hs', el), hz = $('#hz', el);
  function sizes() {
    const met = hs.value === 'metric', cur = met ? m.mk : m.ik;
    hz.innerHTML = (met ? F.hex_metric : F.nut_inch).map(r => '<option value="' + rEsc(r.size) + '"' + (r.size === cur ? ' selected' : '') + '>' + rEsc(met ? r.size : inchLabel(r.size)) + '</option>').join('');
  }
  function upd() {
    m.sys = hs.value; if (m.sys === 'metric') m.mk = hz.value; else m.ik = hz.value;
    const z = hz.value, row = (lab, cell) => '<tr><td>' + lab + '</td>' + cell + '</tr>';
    let h = '';
    if (m.sys === 'metric') {
      const r = F.hex_metric.find(x => x.size === z), n = nm(z), w = wm(z); if (!r) return;
      h = '<div class="res"><div class="h">' + rEsc(z) + ' hexagon head screw, nut and plain washer</div><table>' +
        row('Head: width across flats s', fCell(srcs, r.s, L)) + row('Head height k (nominal)', fCell(srcs, r.k, L)) +
        (n ? row('Nut: width across flats, max', fCell(srcs, n.s_max, L)) + row('Nut: width across flats, min', fCell(srcs, n.s_min, L)) + row('Nut height m, max', fCell(srcs, n.m_max, L)) + row('Nut height m, min', fCell(srcs, n.m_min, L)) : '') +
        (w ? row('Washer: hole d1', fCell(srcs, w.d1, L)) + row('Washer: outside diameter d2', fCell(srcs, w.d2, L)) + row('Washer: thickness h (nominal)', fCell(srcs, w.h, L)) + row('Washer: thickness, least to greatest', rng(w.h_min, w.h_max, L)) : '') + '</table></div>';
      if (n && w && n.m_max && w.d2 && w.h) h += hexhwSvg(+z.slice(1), r.s.value, r.k.value, n.m_max.value, w.d2.value, w.h.value);
    } else {
      const r = F.nut_inch.find(x => x.size === z); if (!r) return;
      h = '<div class="res"><div class="h">' + rEsc(inchLabel(z)) + ' hexagon nut <span class="ms">(' + pubsOf(srcs, r) + ')</span></div><table>' +
        row('Width across flats', fCell(srcs, r.af, v => rEsc(r.af_frac.value) + ' in = ' + LI(v))) + row('Thickness', fCell(srcs, r.h, v => rEsc(r.h_frac.value) + ' in = ' + LI(v))) + '</table></div>';
    }
    $('#hres', el).innerHTML = h;
  }
  $('#hsrc', el).innerHTML = srcNote(F, ['BOLTS_4017', 'FEU_4014', 'FASTENIT_4032', 'WERMAC_NUT', 'OMDL_4032', 'BOLTS_7089', 'FEU_125', 'EUGENE_NUT', 'WIKI_AF', 'ACCU', 'SLS']);
  hs.onchange = () => { sizes(); upd(); }; hz.onchange = upd;
  sizes(); upd();
}

// ------------------------------------------------------------------ keys and keyways
// Section through the shaft, key and hub, to scale, with the table's letters on the dimensions.
// t1 and t2 are the depths from the shaft surface at the centreline. inch: ASME B17.1 letters.
function keySvg(d, b, t1, t2, h, inch) {
  const W = 340, H = 256, R0 = 62, sc = R0 / (d / 2), cx = 160, cy = 122, RH = R0 + 30;
  const hb = b / 2 * sc, ang = Math.asin(Math.min(1, hb / R0)), yCh = cy - R0 * Math.cos(ang), yTop = cy - R0;
  const ySeat = yTop + t1 * sc, yWay = yTop - t2 * sc, yKey = ySeat - h * sc, F = v => v.toFixed(1);
  const L = inch ? { b: 'W', h: 'H', t1: 'H/2 + Y', t2: 'H/2 - Y', s: 'D - Y - H/2', hub: 'D - Y + H/2', d: 'Ø D' } : { b: 'b', h: 'h', t1: 't1', t2: 't2', s: 'd - t1', hub: 'd + t2', d: 'Ø d' };
  let g = DK.circle(cx, cy, RH, 'hatch');
  g += '<rect x="' + F(cx - hb) + '" y="' + F(yWay) + '" width="' + F(2 * hb) + '" height="' + F(cy - yWay) + '" style="fill:var(--panel);stroke:var(--ink);stroke-width:1.6"/>';
  g += DK.path('M' + F(cx - hb) + ' ' + F(yCh) + 'V' + F(ySeat) + 'H' + F(cx + hb) + 'V' + F(yCh) + 'A' + R0 + ' ' + R0 + ' 0 1 1 ' + F(cx - hb) + ' ' + F(yCh) + 'Z', 'part');
  g += DK.rect(cx - hb, yKey, 2 * hb, h * sc, 'tool');
  g += DK.cl(cx - RH - 8, cy, cx + RH + 8, cy) + DK.cl(cx, cy - RH - 8, cx, cy + RH + 8);
  g += DK.dimH(cx - hb, cx + hb, cy - RH - 16, L.b, { from: yWay - 2 });
  g += DK.dimH(cx - R0, cx + R0, cy + RH + 16, L.d, { from: cy + 4, below: true });
  // Depths on the right, from the shaft surface at the centreline.
  const xr = cx + RH + 14;
  g += DK.line(cx + hb + 2, yWay, xr + 6, yWay, 'dim ext') + DK.line(cx + 2, yTop, xr + 6, yTop, 'dim ext') + DK.line(cx + hb + 2, ySeat, xr + 6, ySeat, 'dim ext');
  g += DK.line(xr, yWay - 12, xr, ySeat + 12, 'dim');
  g += DK.text(xr + 8, (yWay + yTop) / 2 - 3, L.t2, { cls: 'dimt', anchor: 'start' }) + DK.text(xr + 8, (yTop + ySeat) / 2 + 11, L.t1, { cls: 'dimt', anchor: 'start' });
  // Key height and the two check dimensions on the left.
  const xl = cx - RH - 14;
  g += DK.line(cx - hb - 2, yKey, xl - 6, yKey, 'dim ext') + DK.line(cx - hb - 2, ySeat, xl - 6, ySeat, 'dim ext') + DK.line(xl, yKey - 12, xl, ySeat + 12, 'dim');
  g += DK.text(xl - 8, (yKey + ySeat) / 2 + 4, L.h, { cls: 'dimt', anchor: 'end' });
  g += DK.dimV(cy + R0, ySeat, cx - 22, L.s, { hot: true }) + DK.dimV(cy + R0, yWay, cx + 36, L.hub, { hot: true });
  g += DK.text(cx - 44, cy - 8, 'shaft', { cls: 'mut' }) + DK.text(cx + RH - 4, cy + RH - 2, 'hub', { cls: 'mut', anchor: 'start' });
  return '<div class="tdia" style="max-width:520px;margin-top:12px">' + DK.svg(W, H, g, 'Shaft, key and hub section with the keyseat and keyway dimensions') + '</div>';
}
async function renderKeys(el) {
  const R = await loadFast(el); if (!R) return;
  const W = state.W, F = R.fasteners, srcs = F.sources, m = FMEM.keys || (FMEM.keys = { sys: inMode() ? 'inch' : 'metric', d: '' });
  el.innerHTML = '<div class="grid" style="max-width:760px">' + fld('Key standard', sel('ks', [['metric', 'Metric parallel keys (DIN 6885-1 / ISO 773)'], ['inch', 'Inch keys (ASME B17.1)']], m.sys)) + fld('Shaft diameter', numIn('kd', m.d), '<span id="kdu"></span>') + '</div><div id="kres"></div><div id="ktab"></div>' + legend +
    '<div class="note"><b>Working:</b> Metric: the key size follows from the shaft range; t1 is the keyseat depth in the shaft and t2 the keyway depth in the hub, both measured from the shaft (bore) surface at the centreline, so the check dimensions are d - t1 over the shaft and d + t2 across the bore. Inch (ASME B17.1): keyseat depth is half the key height measured at the edge of the keyseat; the check dimensions add the chordal height Y = (D - sqrt(D^2 - W^2))/2: shaft D - Y - H/2, hub D - Y + H/2 (own derivation from the geometry). Tolerances on width and depth are not included: take them from your standard. DIN 6885-1 was revised in 2021 (DIN 6885-1:2021-11, current on dinmedia.de); the free tables used here follow the 1968 edition and could not be compared with the new one. Woodruff keys are not included: a second free source for their seat dimensions was not found.<br><b>Sources:</b> DIN 6885-1, ISO 773, JIS B 1301, ASME B17.1 (by name only); publishers below.</div><div class="note" id="ksrc"></div>';
  const ks = $('#ks', el), kd = $('#kd', el);
  function upd() {
    m.sys = ks.value; m.d = kd.value;
    const met = m.sys === 'metric';
    $('#kdu', el).textContent = uLen();
    const dmm = fromUser(parseFloat(kd.value)), out = $('#kres', el);
    const L = v => mmIn(v);
    let h = '';
    if (dmm > 0) {
      if (met) {
        const r = F.keys_metric.find(x => dmm > x.d_over.value && dmm <= x.d_to.value);
        if (!r) h = '<div class="res"><table><tr><td class="warn">Outside the table (over 6 to 500 mm).</td></tr></table></div>';
        else {
          const [b, hh] = r.size.split('x').map(Number);
          h = '<div class="res"><div class="h">Key ' + rEsc(r.size.replace('x', ' x ')) + ' mm for shaft over ' + r.d_over.value + ' to ' + r.d_to.value + ' mm <span class="ms">(' + pubsOf(srcs, r) + ')</span></div><table>' +
            [['Key width b x height h', '<td class="mv">' + b + ' x ' + hh + ' mm</td>'], ['Shaft keyseat depth t1', fCell(srcs, r.t1, L)], ['Hub keyway depth t2', fCell(srcs, r.t2, L)],
             ['Shaft check dimension d - t1', '<td class="mv">' + L(W.keyseat_shaft_dim(dmm, r.t1.value)) + '</td>'], ['Hub check dimension d + t2', '<td class="mv">' + L(W.keyway_hub_dim(dmm, r.t2.value)) + '</td>'],
             ['Key lengths available', fCell(srcs, r.lengths, v => rEsc(v) + ' mm')]].map(([a, c]) => '<tr><td>' + a + '</td>' + c + '</tr>').join('') + '</table></div>' + keySvg(dmm, b, r.t1.value, r.t2.value, hh);
        }
      } else {
        const din = dmm / IN_MM;
        const r = F.keys_inch.find(x => { const [lo, hi] = x.size.split('-').map(fracIn); return din > lo && din <= hi; });
        if (!r || !r.width) h = '<div class="res"><table><tr><td class="warn">Outside the table (over 5/16 to 11 in).</td></tr></table></div>';
        else {
          const w = fracIn(r.width.value), sq = r.square_h ? fracIn(r.square_h.value) : NaN, rc = r.rect_h ? fracIn(r.rect_h.value) : NaN;
          const Y = W.keyseat_chordal_height(din, w);
          const IN = v => inMm(v, 4);
          const chk = H => isFinite(H) ? '<td class="mv">shaft ' + IN(din - Y - H / 2) + '<br>hub ' + IN(din - Y + H / 2) + '</td>' : '<td class="mv">-</td>';
          h = '<div class="res"><div class="h">Shaft over ' + rEsc(r.size.replace('-', ' to ')) + ' in <span class="ms">(' + pubsOf(srcs, r) + ')</span></div><table>' +
            [['Key width W', fCell(srcs, r.width, v => rEsc(v) + ' in')], ['Square key height', fCell(srcs, r.square_h, v => rEsc(v) + ' in')], ['Rectangular key height', fCell(srcs, r.rect_h, v => rEsc(v) + ' in')],
             ['Keyseat depth (square / rectangular) = H/2', '<td class="mv">' + (isFinite(sq) ? IN(sq / 2) : '-') + ' / ' + (isFinite(rc) ? IN(rc / 2) : '-') + '</td>'],
             ['Chordal height Y at this diameter', '<td class="mv">' + IN(Y) + '</td>'], ['Check dimensions, square key', chk(sq)], ['Check dimensions, rectangular key', chk(rc)]].map(([a, c]) => '<tr><td>' + a + '</td>' + c + '</tr>').join('') + '</table></div>' +
            '<p class="ms">' + rEsc(F.keys_inch_note || '') + '</p>' + keySvg(din, w, (isFinite(sq) ? sq : rc) / 2 + Y, (isFinite(sq) ? sq : rc) / 2 - Y, isFinite(sq) ? sq : rc, true);
        }
      }
    } else h = '<div class="res"><table><tr><td class="warn">Enter the shaft diameter.</td></tr></table></div>' + keySvg(30, 8, 4, 3.3, 7, !met); // proportions only, no values shown
    out.innerHTML = h;
    $('#ktab', el).innerHTML = met
      ? '<div class="res mtab" style="margin-top:12px"><div class="h">Parallel keys, all sizes (mm)</div><table><tr><th>Shaft over to</th><th>b x h</th><th>t1</th><th>t2</th></tr>' + F.keys_metric.map(r => '<tr><td>' + r.d_over.value + ' to ' + r.d_to.value + '</td><td><b>' + rEsc(r.size.replace('x', ' x ')) + '</b></td>' + fCell(srcs, r.t1, v => fx(v, 1)) + fCell(srcs, r.t2, v => fx(v, 1)) + '</tr>').join('') + '</table></div>'
      : '<div class="res mtab" style="margin-top:12px"><div class="h">Inch keys, all sizes (in)</div><table><tr><th>Shaft over to</th><th>Width</th><th>Square height</th><th>Rectangular height</th></tr>' + F.keys_inch.map(r => '<tr><td>' + rEsc(r.size.replace('-', ' to ')) + '</td>' + fCell(srcs, r.width) + fCell(srcs, r.square_h) + fCell(srcs, r.rect_h) + '</tr>').join('') + '</table></div>';
  }
  ks.onchange = upd; kd.oninput = upd; upd();
  $('#ksrc', el).innerHTML = srcNote(F, ['FASTENIT', 'AIMS', 'MISUMI', 'EE_KEY', 'AMES_KEY']);
}

// ------------------------------------------------------------------ O-ring glands
function glandSvg(kind) {
  // Schematic of the three gland types with the dimensions the calculator asks for.
  const t = (x, y, s) => '<text class="gl" x="' + x + '" y="' + y + '">' + s + '</text>';
  let p = '';
  if (kind === 'face') p = '<path class="gp" d="M20 40H70V90H130V40H200"/><path class="gb" d="M20 38H200"/><circle class="gz" style="stroke-dasharray:none" cx="100" cy="66" r="20"/>' + t(70, 104, 'groove width') + t(136, 70, 'depth');
  else p = '<path class="gb" d="M20 40H200"/><path class="gp" d="M20 52H70V100H130V52H200"/><circle class="gz" style="stroke-dasharray:none" cx="100" cy="74" r="22"/>' + t(70, 116, 'groove width') + t(136, 80, 'gland depth') + t(24, 34, kind === 'piston' ? 'bore' : 'rod') + t(24, 120, kind === 'piston' ? 'groove bottom (in the piston)' : 'groove bottom (in the housing)');
  return '<svg class="gdia" style="width:220px" viewBox="0 0 220 130" role="img" aria-label="O-ring gland">' + p + '</svg>';
}
async function renderOring(el) {
  const R = await loadFast(el); if (!R) return;
  const W = state.W, F = R.fasteners, srcs = F.sources, inch = inMode();
  const m = FMEM.or || (FMEM.or = { dash: '214', kind: 'piston', service: 'static', a: '', b: '', w: '', tsq: '', tfill: '', id: '', cs: '' });
  const rules = F.oring_rules;
  el.innerHTML = '<div class="grid" style="max-width:760px">' +
    fld('O-ring (AS568 dash number)', '<select id="od"><option value="custom">Other: enter ID and CS</option>' + F.as568.map(r => '<option value="' + r.size + '"' + (r.size === m.dash ? ' selected' : '') + '>-' + r.size + ' (' + r.id.value + ' x ' + r.cs.value + ' in)</option>').join('') + '</select>') +
    fld('O-ring inside diameter ID', numIn('oid', m.id), uLen(), 'ocust') + fld('O-ring cross-section CS', numIn('ocs', m.cs), uLen(), 'ocust') +
    fld('Gland', sel('ok', [['piston', 'Radial, groove in the piston (male)'], ['rod', 'Radial, groove in the housing (female, rod seal)'], ['face', 'Face (axial), internal pressure']], m.kind)) +
    fld('Service', sel('osv', [['static', 'Static'], ['dynamic', 'Dynamic (reciprocating)']], m.service)) +
    fld('<span id="oal"></span>', numIn('oa', m.a), uLen()) + fld('<span id="obl"></span>', numIn('ob', m.b), uLen()) + fld('Groove width', numIn('ow', m.w), uLen()) +
    '</div><div id="ores"></div>' +
    '<div class="res" style="margin-top:12px"><div class="h">Suggest a groove from your targets</div><div class="grid" style="padding:10px;margin:0">' + fld('Target squeeze', numIn('otq', m.tsq, 'e.g. 20'), '%') + fld('Target gland fill', numIn('otf', m.tfill, 'e.g. 75'), '%') + '</div><div id="osug"></div></div>' +
    '<div class="res" style="margin-top:12px"><div class="h">Makers\' guidance (as printed)</div><table>' +
    [['Squeeze, static', 'squeeze_static'], ['Squeeze, dynamic', 'squeeze_dynamic'], ['Gland fill, maximum', 'fill_max'], ['Stretch in service, maximum', 'stretch_max']].map(([l, k]) => '<tr><td>' + l + '</td><td>' + Object.entries(rules[k]).map(([p, v]) => rEsc(pubName(srcs, p)) + ': <span class="mv">' + rEsc(v) + ' %</span>').join('<br>') + '</td></tr>').join('') +
    '</table><p class="ms" style="padding:4px 10px">Parker\'s O-Ring Handbook (ORD 5700) is the classic reference for gland tables by cross-section; its tables are not reproduced here. These limits are general; material, temperature, pressure and extrusion gap all matter, and a seal maker\'s gland table for your ring is the final word.</p></div>' +
    glandSvg(m.kind) +
    '<div class="note"><b>Working:</b> gland depth: piston (bore - groove bottom)/2; rod (groove bottom - rod)/2; face: the groove depth. Squeeze = (CS - gland depth) / CS (CS as entered, nominal). Stretch = (groove bottom - ID) / ID on a piston; on a rod gland the ID is compared with the rod. Stretched cross-section from constant ring volume, CS\'^2 (D + CS\') = CS^2 (ID + CS) (an idealisation; makers\' curves give a little less reduction). Gland fill = ring volume / groove volume = (pi CS\'^2/4 x ring mean diameter) / (width x depth x groove mean diameter). Suggested depth = CS (1 - squeeze), width = (pi CS^2/4) / (fill x depth). Tolerances are not included: check the extremes (smallest CS in the deepest groove, largest in the shallowest).<br><b>Sources:</b> SAE AS568 and ISO 3601-1:2012 (by name only); Parker ORD 5700 (cited, not reproduced); Global O-Ring and Seal and Apple Rubber design guides; sizes from the publishers below.</div><div class="note" id="osrc"></div>';
  const g = id => $('#' + id, el);
  function upd() {
    Object.assign(m, { dash: g('od').value, kind: g('ok').value, service: g('osv').value, a: g('oa').value, b: g('ob').value, w: g('ow').value, tsq: g('otq').value, tfill: g('otf').value, id: g('oid').value, cs: g('ocs').value });
    el.querySelectorAll('.ocust').forEach(x => x.style.display = m.dash === 'custom' ? '' : 'none');
    g('oal').textContent = m.kind === 'piston' ? 'Bore diameter' : m.kind === 'rod' ? 'Rod diameter' : 'Groove outside diameter';
    g('obl').textContent = m.kind === 'face' ? 'Groove depth' : 'Groove bottom diameter';
    const r = F.as568.find(x => x.size === m.dash);
    const id = r ? r.id.value * IN_MM : fromUser(parseFloat(m.id)), cs = r ? r.cs.value * IN_MM : fromUser(parseFloat(m.cs));
    const L = v => fBoth(v), P = v => '<span class="mv">' + fx(v, 1) + ' %</span>';
    const rows = [];
    if (r) rows.push(['AS568-' + r.size, fBoth(id) + ' ID x ' + fBoth(cs) + ' CS <span class="ms">tolerance ID ±' + r.id_tol.value + ' in, CS ±' + r.cs_tol.value + ' in; ' + badge(r.id.status) + ' ' + pubsOf(srcs, r) + '</span>']);
    const A = fromUser(parseFloat(m.a)), B = fromUser(parseFloat(m.b)), Wd = fromUser(parseFloat(m.w));
    const lim = (v, lo, hi) => v < lo || v > hi ? ' <span class="warn">outside ' + lo + '-' + hi + ' %</span>' : '';
    if (id > 0 && cs > 0 && A > 0 && B > 0) {
      let depth, stretch, seat, gm;
      if (m.kind === 'piston') { depth = (A - B) / 2; seat = B; stretch = W.oring_stretch_pct(id, B); gm = (A + B) / 2; }
      else if (m.kind === 'rod') { depth = (B - A) / 2; seat = A; stretch = W.oring_stretch_pct(id, A); gm = (A + B) / 2; }
      else { depth = B; seat = id; stretch = 0; gm = A - Wd; }
      const csS = stretch > 0 ? W.oring_cs_stretched(cs, id, seat) : cs;
      const sq = W.oring_squeeze_pct(csS, depth);
      const dyn = m.service === 'dynamic';
      rows.push(['Gland depth', L(depth)]);
      rows.push(['Squeeze (on the stretched cross-section)', P(sq) + (dyn ? lim(sq, 5, 30) : lim(sq, 10, 40)) + ' <span class="ms">on nominal CS ' + fx(W.oring_squeeze_pct(cs, depth), 1) + ' %</span>']);
      if (m.kind !== 'face') rows.push([m.kind === 'piston' ? 'ID stretch on the groove bottom' : 'ID against the rod (negative = ring larger than the rod)', P(stretch) + (stretch > 5 ? ' <span class="warn">over 5 %</span>' : '')]);
      if (stretch > 0) rows.push(['Cross-section after stretch (constant volume estimate)', L(csS)]);
      if (m.kind === 'face') { const od = id + 2 * cs; rows.push(['Ring OD against groove OD (internal pressure: ring should touch the outside wall)', L(od) + ' <span class="ms">groove OD ' + fx(A, 3) + '; ' + (od >= A ? 'ring presses on the outer wall' : 'gap ' + fx(A - od, 3)) + '</span>']); }
      if (Wd > 0) {
        const ringDm = (m.kind === 'piston' ? seat : id) + csS;
        const fill = W.oring_fill_pct(csS, ringDm, Wd, depth, gm);
        rows.push(['Gland fill', P(fill) + (fill > 90 ? ' <span class="warn">over 90 %: no room for swell</span>' : fill > 85 ? ' <span class="warn">over 85 %</span>' : '')]);
      } else rows.push(['Gland fill', '<span class="ms">enter the groove width</span>']);
    } else rows.push(['', '<span class="warn">Enter the ring and the gland diameters.</span>']);
    $('#ores', el).innerHTML = '<div class="res" style="margin-top:12px"><div class="h">Results</div><table>' + rows.map(([a, b]) => '<tr><td>' + a + '</td><td class="v" style="white-space:normal">' + b + '</td></tr>').join('') + '</table></div>';
    const tq = parseFloat(m.tsq), tf = parseFloat(m.tfill);
    if (cs > 0 && tq > 0 && tq < 100 && tf > 0 && tf < 100) {
      const d = W.oring_depth_for_squeeze(cs, tq), w = W.oring_width_for_fill(cs, d, tf);
      $('#osug', el).innerHTML = '<table><tr><td>Gland depth</td><td class="v">' + L(d) + '</td></tr><tr><td>Groove width</td><td class="v">' + L(w) + '</td></tr>' +
        (m.kind === 'piston' && A > 0 ? '<tr><td>Groove bottom diameter for this bore</td><td class="v">' + L(A - 2 * d) + '</td></tr>' : '') + (m.kind === 'rod' && A > 0 ? '<tr><td>Groove bottom diameter for this rod</td><td class="v">' + L(A + 2 * d) + '</td></tr>' : '') + '</table>';
    } else $('#osug', el).innerHTML = '<p class="ms" style="padding:0 10px 8px">Enter both targets (BenchMate does not pick them for you; see the makers\' ranges below).</p>';
  }
  ['od', 'ok', 'osv'].forEach(id => g(id).onchange = () => { upd(); if (id === 'ok') { const s = el.querySelector('svg.gdia[aria-label="O-ring gland"]'); if (s) s.outerHTML = glandSvg(m.kind); } });
  ['oa', 'ob', 'ow', 'otq', 'otf', 'oid', 'ocs'].forEach(id => g(id).oninput = upd);
  upd();
  $('#osrc', el).innerHTML = srcNote(F, ['GTWEED', 'EFUNDA', 'ORINGSINC', 'GLOBAL_ORING', 'APPLE']);
}

// ------------------------------------------------------------------ bearing life
async function renderBearingLife(el) {
  const W = state.W, m = FMEM.brg || (FMEM.brg = { c: '', p: '', x: '', fr: '', y: '', fa: '', type: 0, rpm: '', hours: '' });
  el.innerHTML = '<div class="grid" style="max-width:760px">' +
    fld('Bearing type', sel('bt', [[0, 'Ball bearing (p = 3)'], [1, 'Roller bearing (p = 10/3)']], m.type)) +
    fld('Basic dynamic load rating C (catalogue)', numIn('bc', m.c), 'N or lbf') +
    fld('Equivalent dynamic load P', numIn('bp', m.p, 'or X, Fr, Y, Fa below'), 'same unit') +
    fld('Radial load Fr', numIn('bfr', m.fr), 'same unit') + fld('Axial load Fa', numIn('bfa', m.fa), 'same unit') +
    fld('Factor X (catalogue)', numIn('bx', m.x), '') + fld('Factor Y (catalogue)', numIn('by', m.y), '') +
    fld('Speed', numIn('bn', m.rpm), 'rpm') + fld('Required life (for C needed)', numIn('bh', m.hours), 'h') +
    '</div><div id="bres"></div>' +
    '<div class="note"><b>Working:</b> basic rating life L10 = (C/P)^p million revolutions, p = 3 for ball bearings and 10/3 for roller bearings (ISO 281:2007, clause 6); in hours L10h = 10^6 L10 / (60 n). P = X Fr + Y Fa, with X and Y from the bearing maker\'s catalogue for your bearing and its Fa/Fr ratio (enter P directly if you have it). C needed for a life: C = P (60 n L10h / 10^6)^(1/p). L10 is the life that 90 % of a large group of identical bearings reach or exceed. It does not include lubrication, contamination or the fatigue load limit: ISO 281 adds the life modification factor aISO for those (L10m = a1 aISO L10), which needs the maker\'s data and is not calculated here. Shaft and housing fits for bearings are not included yet: a second bearing maker\'s fit table could not be compared.<br><b>Sources:</b> ISO 281:2007 (current on iso.org; a revision is at DIS stage), by name and clause only. The same formula is printed in the bearing makers\' catalogues (SKF, Schaeffler, NSK, Timken, ZKL).</div>';
  const g = id => $('#' + id, el);
  function upd() {
    Object.assign(m, { type: g('bt').value, c: g('bc').value, p: g('bp').value, fr: g('bfr').value, fa: g('bfa').value, x: g('bx').value, y: g('by').value, rpm: g('bn').value, hours: g('bh').value });
    const C = parseFloat(m.c), roller = +m.type, n = parseFloat(m.rpm), hrs = parseFloat(m.hours);
    let P = parseFloat(m.p), pSrc = 'as entered';
    if (!(P > 0)) { const x = parseFloat(m.x), fr = parseFloat(m.fr), y = parseFloat(m.y), fa = parseFloat(m.fa) || 0; if (x >= 0 && fr >= 0 && (y >= 0 || !fa)) { P = W.bearing_equiv_load(x, fr, y || 0, fa); pSrc = 'X Fr + Y Fa'; } }
    const rows = [];
    if (P > 0) rows.push(['Equivalent dynamic load P', '<span class="mv">' + fx(P, 1) + '</span> <span class="ms">' + pSrc + '</span>']);
    if (C > 0 && P > 0) {
      const L = W.bearing_l10(C, P, roller);
      rows.push(['C / P', '<span class="mv">' + fx(C / P, 3) + '</span>'], ['Basic rating life L10', '<span class="mv">' + fx(L, 2) + ' million rev</span>']);
      if (n > 0) rows.push(['Basic rating life L10h', '<span class="mv">' + fx(W.bearing_l10h(C, P, roller, n), 0) + ' h</span> <span class="ms">' + fx(W.bearing_l10h(C, P, roller, n) / 8760, 2) + ' years running non-stop</span>']);
      if (P > 0.5 * C) rows.push(['', '<span class="warn">P is over half of C: heavy load, outside the usual range of the life formula; ask the bearing maker.</span>']);
    }
    if (P > 0 && n > 0 && hrs > 0) rows.push(['C needed for ' + fx(hrs, 0) + ' h', '<span class="mv">' + fx(W.bearing_c_required(P, roller, n, hrs), 1) + '</span>']);
    g('bres').innerHTML = '<div class="res"><div class="h">Results</div><table>' + (rows.length ? rows.map(([a, b]) => '<tr><td>' + a + '</td><td class="v" style="white-space:normal">' + b + '</td></tr>').join('') : '<tr><td class="warn">Enter C and P (or X, Fr, Y, Fa).</td></tr>') + '</table></div>';
  }
  g('bt').onchange = upd; ['bc', 'bp', 'bfr', 'bfa', 'bx', 'by', 'bn', 'bh'].forEach(id => g(id).oninput = upd); upd();
}
