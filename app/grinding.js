'use strict';
// Grinding screens: grit size conversion and wheel marking decoder (data from
// data/refdata.json, section `grinding`, built from data/refdata/grinding-evidence.json
// with publisher consensus), and the drawings for the grinding calculators.
// Uses refdata.js helpers (loadRef, rEsc, badge, pubName, sourceList) and shop.js (sesc).

const GR_SYS = { FEPA_F: 'FEPA F (grinding wheels, stones)', ANSI: 'ANSI / US grit (mesh)', FEPA_P: 'FEPA P (coated abrasives)' };
const GR_TEXT = {
  alox: 'aluminium oxide', sic: 'silicon carbide', zirconia_alox: 'zirconia alumina', seeded_gel: 'seeded gel (ceramic) aluminium oxide',
  white_alox: 'white aluminium oxide', mix_a_wa: 'mix of regular and white aluminium oxide', synthetic_diamond: 'synthetic diamond',
  synthetic_diamond_coated: 'synthetic diamond, metal coated', semi_friable_alox: 'semi-friable aluminium oxide', pink_alox: 'pink aluminium oxide',
  single_crystal_alox: 'single-crystal (monocrystalline) aluminium oxide', mix_a_sa: 'mix of regular and single-crystal aluminium oxide',
  zirconia: 'zirconium oxide (zirconia)', green_sic: 'green silicon carbide', mix_c_gc: 'mix of black and green silicon carbide',
  ceramic_alox: 'ceramic aluminium oxide', blue_alox: 'blue aluminium oxide', red_alox: 'red (ruby) aluminium oxide',
  pink_alox_premium: 'premium pink aluminium oxide', mix_alox_sic: 'mix of aluminium oxide and silicon carbide', white_friable: 'highly friable white grain',
  resinoid: 'resinoid (resin)', resinoid_reinforced: 'resinoid, reinforced', shellac: 'shellac', oxychloride: 'oxychloride (magnesia cement)',
  magnesia: 'magnesium oxide (magnesite)', rubber: 'rubber', rubber_reinforced: 'rubber, reinforced', silicate: 'silicate', vitrified: 'vitrified',
  epoxy: 'epoxy', metal: 'metal', electroplated: 'electroplated',
  coarse: 'coarse', medium: 'medium', fine: 'fine', very_fine: 'very fine', soft: 'soft', hard: 'hard',
};
const grNum = k => parseFloat(String(k).replace(/^[A-Z]+/, ''));
const grText = v => GR_TEXT[v] || v;
function grCons(srcs, c, map) {
  if (!c) return '<span class="ms">not in the sources used here</span>';
  return c.groups.map((g, i) => (i ? '<div class="ms">' : '<div>') + rEsc(map ? map(g.value) : g.value) + ' <span class="ms">(' + g.publishers.map(p => rEsc(pubName(srcs, p))).join(', ') + ')</span></div>').join('') + ' ' + badge(c.status);
}

const GRIT = { sys: 'FEPA_F', code: 'F60', all: false };
async function renderGritConv(el) {
  const R = await loadRef(el); if (!R) return;
  const G = R.grinding; if (!G) { el.textContent = 'Grinding data not found (run scripts/build-web.sh).'; return; }
  const s = GRIT;
  const codes = sys => Object.keys(G.grit_um[sys]).sort((a, b) => grNum(a) - grNum(b));
  const draw = () => {
    if (!G.grit_um[s.sys][s.code]) s.code = codes(s.sys)[0];
    el.innerHTML = '<div class="mfilter"><select id="gsys">' + Object.entries(GR_SYS).map(([k, t]) => '<option value="' + k + '"' + (k === s.sys ? ' selected' : '') + '>' + t + '</option>').join('') + '</select>' +
      '<select id="gcode">' + codes(s.sys).map(c => '<option' + (c === s.code ? ' selected' : '') + '>' + c + '</option>').join('') + '</select>' +
      '<label class="ms"><input type="checkbox" id="gall"' + (s.all ? ' checked' : '') + '> Show the full tables</label></div><div id="gout"></div><div class="note" id="gsrc"></div>';
    $('#gsys', el).onchange = e => { s.sys = e.target.value; s.code = ''; draw(); };
    $('#gcode', el).onchange = e => { s.code = e.target.value; out(); };
    $('#gall', el).onchange = e => { s.all = e.target.checked; out(); };
    $('#gsrc', el).innerHTML = '<b>What the numbers are.</b> ' + rEsc(G.note) + '<br><b>Sources</b><br>' + sourceList(Object.fromEntries(Object.entries(G.sources).filter(([k]) => ['NORITAKE', 'HAPSTONE', 'TEDPELLA', 'STEELDATA'].includes(k))));
    out();
  };
  const out = () => {
    const c = G.grit_um[s.sys][s.code], um = parseFloat(c.value);
    let h = '<div class="res"><div class="h">' + rEsc(s.code) + ' (' + rEsc(GR_SYS[s.sys]) + ')</div><table class="codes"><tr><td>Size printed</td><td class="v">' + c.groups.map(g => '<div>' + rEsc(g.value) + ' um <span class="ms">(' + (g.value / 25400).toFixed(5) + ' in; ' + g.publishers.map(p => rEsc(pubName(G.sources, p))).join(', ') + ')</span></div>').join('') + '</td><td>' + badge(c.status) + '</td></tr>';
    Object.keys(GR_SYS).filter(k => k !== s.sys).forEach(k => {
      const list = Object.entries(G.grit_um[k]).map(([code, cc]) => ({ code, v: parseFloat(cc.value), cc })).sort((a, b) => Math.abs(a.v - um) - Math.abs(b.v - um)).slice(0, 2).sort((a, b) => b.v - a.v);
      h += '<tr><td>Nearest in ' + rEsc(GR_SYS[k]) + '</td><td class="v">' + list.map(x => '<div>' + rEsc(x.code) + ': ' + rEsc(x.cc.value) + ' um <span class="ms">(' + x.cc.groups[0].publishers.map(p => rEsc(pubName(G.sources, p))).join(', ') + ')</span></div>').join('') + '</td><td><span class="ms">approximate</span></td></tr>';
    });
    h += '</table></div>';
    if (s.code.startsWith('F') && grNum(s.code) <= 220) h += '<p class="desc">For F4 to F220 the Noritake figure is the opening of the control sieve (stage 3) the grains must mostly stay on, so the grains are a little larger than this number on average.</p>';
    if (s.all) Object.keys(GR_SYS).forEach(k => {
      h += '<h3 class="mfh">' + rEsc(GR_SYS[k]) + '</h3><div class="res mtab"><table><tr><th>Grit</th><th>Size, um (publishers)</th><th>Status</th></tr>' +
        codes(k).map(code => { const cc = G.grit_um[k][code]; return '<tr><td><b>' + rEsc(code) + '</b></td><td>' + cc.groups.map(g => rEsc(g.value) + ' <span class="ms">' + g.publishers.map(p => rEsc(pubName(G.sources, p))).join(', ') + '</span>').join('<br>') + '</td><td>' + badge(cc.status) + '</td></tr>'; }).join('') + '</table></div>';
    });
    $('#gout', el).innerHTML = h;
  };
  draw();
}

const WHEEL = { code: 'A46-K8V' };
function parseWheel(G, raw) {
  const t = String(raw || '').toUpperCase().replace(/[\s\-.]/g, '');
  const m = t.match(/^(\d*)([A-Z]+)(\d+)([A-Z])(\d*)([A-Z]*)(.*)$/);
  if (!m) return null;
  const [, pre, letters, grit, grade, struct, after, rest] = m;
  let abr = pre + letters, prefix = '';
  if (!G.abrasive[abr]) { abr = letters; prefix = pre; }
  const bonds = Object.keys(G.bond).sort((a, b) => b.length - a.length);
  const bond = bonds.find(b => after.startsWith(b)) || '';
  return { prefix, abr, grit, grade, struct, bond, record: after.slice(bond.length) + rest, unknownBond: after && !bond ? after : '' };
}
async function renderWheelCode(el) {
  const R = await loadRef(el); if (!R) return;
  const G = R.grinding; if (!G) { el.textContent = 'Grinding data not found (run scripts/build-web.sh).'; return; }
  el.innerHTML = '<div class="mfilter"><input id="wcode" type="text" style="width:220px;font-family:var(--mono)" placeholder="e.g. A46-K8V, WA 60 K 7 V" aria-label="Wheel specification"><span class="ms">Type the specification printed on the wheel or its blotter.</span></div><div id="wout"></div>' +
    '<div class="res" style="margin-top:12px"><div class="h">Marking order as printed by each source</div><table>' + Object.entries(G.order).map(([p, o]) => '<tr><td>' + rEsc(pubName(G.sources, p)) + '</td><td>' + rEsc(o) + '</td></tr>').join('') + '</table></div>' +
    '<p class="desc" style="margin-top:10px"><b>Maximum operating speed:</b> every wheel carries its own maximum (m/s and rpm on wheels over 80 mm, on a label or notice for smaller ones; colour stripes mark high-speed wheels). Read it on the wheel and never exceed it. Standards cited by name: ISO 525:2020 (shape types, designation and marking; confirmed 2026), EN 12413 (safety of bonded abrasives), ANSI B74.13-2016 (markings), ANSI B7.1 (safety).</p>' +
    '<div class="note"><b>Sources</b><br>' + sourceList(Object.fromEntries(Object.entries(G.sources).filter(([k]) => ['UNITED', 'CGW', 'NAVY', 'HST'].includes(k)))) + '</div>';
  const inp = $('#wcode', el); inp.value = WHEEL.code;
  const go = () => {
    WHEEL.code = inp.value;
    const p = parseWheel(G, inp.value), o = $('#wout', el);
    if (!inp.value.trim()) { o.innerHTML = ''; return; }
    if (!p) { o.innerHTML = '<p class="warn">Not a conventional wheel specification this decoder reads (abrasive letters, grit number, grade letter, optional structure number, bond letters). Diamond and CBN markings are different.</p>'; return; }
    const S = G.sources, rows = [];
    if (p.prefix) rows.push(['Prefix ' + p.prefix, '<span class="ms">a number before the abrasive letters that the sources here do not list: the maker\'s own code for the grain type. Look it up in the maker\'s catalogue.</span>']);
    rows.push(['Abrasive ' + p.abr, grCons(S, G.abrasive[p.abr], grText)]);
    const g = parseInt(p.grit, 10), grp = Object.entries(G.grit_group).filter(([, c]) => c.groups.some(x => { const [a, b] = String(x.value).split('-').map(Number); return g >= a && g <= b; }));
    let gh = grp.length ? grp.map(([name, c]) => { const pubs = c.groups.filter(x => { const [a, b] = String(x.value).split('-').map(Number); return g >= a && g <= b; }).flatMap(x => x.publishers); return rEsc(grText(name)) + ' <span class="ms">(' + pubs.map(q => rEsc(pubName(S, q))).join(', ') + ')</span>'; }).join('<br>') : '<span class="ms">outside the grit groups the sources print</span>';
    const fu = G.grit_um.FEPA_F['F' + g], au = G.grit_um.ANSI[String(g)];
    if (fu) gh += '<div class="ms">As F' + g + ': ' + rEsc(fu.value) + ' um (' + fu.groups[0].publishers.map(q => rEsc(pubName(S, q))).join(', ') + ')</div>';
    if (au) gh += '<div class="ms">As ANSI ' + g + ': ' + rEsc(au.value) + ' um (' + au.groups[0].publishers.map(q => rEsc(pubName(S, q))).join(', ') + ')</div>';
    rows.push(['Grit ' + p.grit, gh + '<div class="ms">Lower numbers are coarser. See Grit size conversion for all sizes.</div>']);
    const pos = p.grade.charCodeAt(0) - 64, gg = G.grade_group.CGW, inG = Object.entries(gg).find(([, r]) => { const [a, b] = r.split('-'); return p.grade >= a && p.grade <= b; });
    rows.push(['Grade ' + p.grade, 'letter ' + pos + ' of 26 on the A (soft) to Z (hard) scale ' + badge(G.grade_scale.status) + ' <span class="ms">(' + G.grade_scale.groups[0].publishers.map(q => rEsc(pubName(S, q))).join(', ') + ')</span>' +
      (inG ? '<div class="ms">' + rEsc(pubName(S, 'CGW')) + ' groups it as ' + inG[0] + ' (' + inG[1] + ')</div>' : '') + '<div class="ms">Grade is how firmly the bond holds the grain, not the hardness of the grain.</div>']);
    if (p.struct) rows.push(['Structure ' + p.struct, 'grain spacing: low numbers dense, high numbers open ' + badge(G.structure_low.status) + '<div class="ms">' + Object.entries(G.structure).map(([q, v]) => rEsc(pubName(S, q)) + ': ' + rEsc(v.range)).join('; ') + '</div>']);
    else rows.push(['Structure', '<span class="ms">not given (ANSI allows it to be left out)</span>']);
    if (p.bond) rows.push(['Bond ' + p.bond, grCons(S, G.bond[p.bond], grText) + (p.bond === 'E' || p.bond === 'O' ? '<div class="ms">The ANSI (US) source and the UK source (citing ISO 525) give different meanings for this letter; ask the maker.</div>' : '')]);
    else rows.push(['Bond', p.unknownBond ? '<span class="warn">' + rEsc(p.unknownBond) + ' is not a bond letter in the sources used here</span>' : '<span class="ms">missing</span>']);
    if (p.record) rows.push(["Maker's record " + rEsc(p.record), '<span class="ms">the maker\'s own code (bond variant, process); see the maker\'s catalogue</span>']);
    o.innerHTML = '<div class="res"><div class="h">' + rEsc(inp.value.trim()) + '</div><table class="codes">' + rows.map(r => '<tr><td><b>' + rEsc(r[0]) + '</b></td><td class="v">' + r[1] + '</td></tr>').join('') + '</table></div>';
  };
  inp.oninput = go; go();
}

// Wheel and work in the three equivalent-diameter cases (to scale, capped).
function grindDeSvg(mode, ds, dw) {
  if (!(ds > 0)) return '';
  const H = 220, cy = 110;
  let s = '';
  if (mode === 2) {
    const r = 80; s += '<circle class="gc" cx="220" cy="' + (cy - 20) + '" r="' + r + '"/><rect class="gsoft" x="40" y="' + (cy + 60) + '" width="360" height="30"/>';
    s += gtxt([220, cy - 20], 'wheel ds', 'gs', 'middle') + gtxt([220, cy + 80], 'work (flat): de = ds', 'gs', 'middle');
  } else {
    if (!(dw > 0)) return '';
    const big = Math.max(ds, dw), k = (mode === 1 ? 180 : 170) / big, rs = ds * k / 2, rw = dw * k / 2;
    if (mode === 1) {
      if (ds >= dw) return '';
      s += '<circle class="gp" cx="220" cy="' + cy + '" r="' + rw + '"/><circle class="gc" cx="' + (220 + rw - rs) + '" cy="' + cy + '" r="' + rs + '"/>';
      s += gtxt([220 - rw + 6, cy + 4], 'bore dw', 'gs') + gtxt([220 + rw - rs, cy + 4], 'wheel ds', 'gs', 'middle') + gtxt([10, H - 10], 'internal: de = dw ds / (dw - ds)', 'gs');
    } else {
      const xs = Math.min(400 - rs, 220 + rw);
      const xwc = xs - rs - rw;
      s += '<circle class="gp" cx="' + xwc.toFixed(1) + '" cy="' + cy + '" r="' + rw.toFixed(1) + '"/><circle class="gc" cx="' + xs.toFixed(1) + '" cy="' + cy + '" r="' + rs.toFixed(1) + '"/>';
      s += gtxt([xwc, cy - rw - 8], 'work dw', 'gs', 'middle') + gtxt([xs, cy + 4], 'wheel ds', 'gs', 'middle') + gtxt([10, H - 10], 'external: de = dw ds / (dw + ds)', 'gs');
    }
  }
  s += gtxt([10, 16], 'to scale', 'gs');
  return gsvg(440, H, s, 'Equivalent wheel diameter');
}

// Top view of reciprocating surface grinding: strokes, overtravel, cross-feed.
function grindSurfSvg() {
  let s = '<rect class="gsoft" x="110" y="60" width="220" height="110"/>';
  let p = '', y = 70, dir = 1;
  for (let i = 0; i < 6; i++) { const x0 = dir > 0 ? 70 : 370, x1 = dir > 0 ? 370 : 70; p += (i ? 'L' : 'M') + x0 + ' ' + y + 'L' + x1 + ' ' + y; y += 18; dir = -dir; }
  s += '<path class="gc" d="' + p + '"/>';
  s += '<path class="gm" d="M110 185L330 185M70 200L110 200M330 200L370 200"/>';
  s += gtxt([220, 200], 'L', 'gv', 'middle') + gtxt([90, 216], 'overtravel', 'gs', 'middle') + gtxt([350, 216], 'overtravel', 'gs', 'middle');
  s += mtArrow([395, 70], [395, 160], 'gm') + gtxt([402, 120], 'cross', 'gs');
  s += gtxt([10, 18], 'schematic: wheel centre path, cross-feed at each end', 'gs');
  return gsvg(440, 230, s, 'Surface grinding strokes');
}
