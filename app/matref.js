'use strict';
// Materials reference (parity batch B4): temper and heat-tint colours, heat
// treatment, galvanic series and two-metal check, machining plastics, metal
// identification. Data comes from data/refdata.json (section matref), built by
// scripts/build_refdata.py from data/refdata/matref-evidence.json: every value
// keeps each publisher's printing; "confirmed" needs two independent publishers.
// Uses loadRef, rEsc, badge, pubName from refdata.js. Arithmetic (temperature
// conversion, galvanic difference) is done by the Rust core (state.W).

const MRMEM = { grade: 'D2', galv: 'sea', a: 'al_marine', b: 'ss_passive', ai_a: 'ss18', ai_b: 'al_other', plastic: 'POM' };
const mrBadge = s => s === 'unverified' ? '<span class="badge review">To be verified</span>' : s === 'printed' ? '<span class="badge review">As printed</span>' : badge(s);
const mrNames = (S, keys) => keys.map(k => rEsc(pubName(S, k))).join(', ');
const mrSrcTag = (S, keys) => keys.length ? '<span class="ms">' + mrNames(S, keys) + '</span>' : '<span class="ms">no source yet</span>';
// Temperature in the active units first, the other in brackets. degC -> degF by the Rust unit converter.
const mrF = c => state.W.unit_convert(12, 1, 2, c);
const mrR = x => String(Math.round(x));
// fp: the publisher's own printed degF, shown instead of the conversion when given.
function mrTemp(lo, hi, fp) {
  const c = lo === hi ? mrR(lo) : mrR(lo) + '-' + mrR(hi);
  const f = fp || (lo === hi ? mrR(mrF(lo)) : mrR(mrF(lo)) + '-' + mrR(mrF(hi)));
  return inMode() ? f + ' °F <span class="ms">(' + c + ' °C)</span>' : c + ' °C <span class="ms">(' + f + ' °F)</span>';
}
function mrSources(S, keys) {
  return keys.map(k => S[k]).filter(Boolean).map(s => '<b>' + rEsc(s.publisher) + '</b>: ' + rEsc(s.title) + (s.url ? ' (' + rEsc(s.url) + ')' : '') + ', accessed ' + rEsc(s.accessed) + (s.note ? '. <i>' + rEsc(s.note) + '</i>' : '')).join('<br>');
}
function mrOpen(id) {
  openTool(id);
}
// Each publisher's printing of a temperature field: "Publisher: 790-850 °C".
function mrTempCell(S, c) {
  if (!c) return '<td><span class="ms">-</span></td>';
  const rows = Object.entries(c.printed).map(([k, e]) => '<div title="' + rEsc(e.v || '') + '">' + (e.lo !== undefined ? '<span class="mv">' + mrTemp(e.lo, e.hi, e.fp) + '</span>' : rEsc(e.t || '')) +
    ' <span class="ms">' + rEsc(pubName(S, k)) + (e.note ? '; ' + rEsc(e.note) : '') + '</span></div>');
  return '<td>' + rows.join('') + '</td><td style="white-space:nowrap">' + mrBadge(c.status) + '</td>';
}

// ------------------------------------------------------------------ temper and heat-tint colours
async function renderTemperColours(el) {
  const R = await loadRef(el); if (!R) return;
  const M = R.matref; if (!M) { el.textContent = 'Materials reference data not built.'; return; }
  const S = M.sources;
  const table = (sec, title) => {
    const pubs = [...new Set(sec.rows.flatMap(r => Object.keys(r.printed)))];
    return '<div class="res mtab" style="margin-bottom:14px"><div class="h">' + title + '</div><table><tr><th></th><th>Colour</th>' + pubs.map(p => '<th>' + rEsc(pubName(S, p)) + '</th>').join('') + '<th>Status</th></tr>' +
      sec.rows.map(r => '<tr><td><span style="display:inline-block;width:28px;height:16px;background:' + r.swatch + ';border:1px solid var(--line);vertical-align:middle"></span></td><td><b>' + rEsc(r.name) + '</b></td>' +
        pubs.map(p => { const e = r.printed[p]; return '<td title="' + rEsc(e ? e.v : '') + '">' + (e ? '<span class="mv">' + mrTemp(e.lo, e.hi, e.fp) + '</span><div class="ms">' + rEsc(e.name) + '</div>' : '<span class="ms">-</span>') + '</td>'; }).join('') +
        '<td>' + mrBadge(r.status) + '</td></tr>').join('') + '</table></div>';
  };
  el.innerHTML = '<p class="desc">Oxide (temper) colours on clean, bright steel heated in air. <b>The colours are approximate</b>: they depend on time at temperature, the alloy, the atmosphere and the surface, and they are hard to judge under shop light. Use them as a rough guide, never instead of a thermometer or furnace control.</p>' +
    table(M.temper_carbon, 'Plain carbon steel (tempering colours)') +
    '<p class="ms" style="max-width:760px">°F as printed by the US Navy and West Yorkshire Steel; other °F values are converted from the printed °C. Confirmed = two independent publishers print the colour within 10 °C of each other (charts are printed to the nearest few degrees). ' + rEsc(M.temper_carbon.note) + ' The screen swatches are drawn by us and only indicate the named colour.</p>' +
    '<div class="res mtab" style="margin-bottom:14px"><div class="h">What changes the colour</div><table>' + M.colour_factors.map(f => '<tr><td><b>' + rEsc(f.factor) + '</b></td><td>' + rEsc(f.text) + '</td><td>' + mrBadge(f.status) + '<div>' + mrSrcTag(S, f.src) + '</div></td></tr>').join('') + '</table></div>' +
    table(M.tint_stainless, 'Stainless steel heat tint (heated in air)') +
    '<p class="ms" style="max-width:760px">' + rEsc(M.tint_stainless.note) + ' Only one publisher (the BSSA chart): needs a second source.</p>' +
    '<div class="note"><b>Titanium:</b> ' + rEsc(M.titanium_note) + '</div>' +
    '<div class="note"><b>Sources</b><br>' + mrSources(S, ['NAVY_AM', 'WYS', 'WIKI_HC', 'BSSA', 'HTT']) + '</div>';
}

// ------------------------------------------------------------------ heat treatment
async function renderHeatTreat(el) {
  const R = await loadRef(el); if (!R) return;
  const M = R.matref; if (!M) { el.textContent = 'Materials reference data not built.'; return; }
  const S = M.sources, G = M.grades;
  const fieldOrder = ['anneal', 'normalise', 'stress', 'harden', 'quench', 'temper', 'temper_min', 'avoid', 'nitride'];
  el.innerHTML = '<p class="desc">Typical heat treatment temperatures as printed by steel makers and stockists, side by side. <b>Always follow the data sheet of the steel you actually have</b>: makers differ, and hardening temperature, soak and quench depend on section size and furnace.</p>' +
    '<div class="grid" style="max-width:760px"><label class="f"><span>Steel</span><div class="row"><select id="htg">' + G.rows.map(r => '<option value="' + r.grade + '">' + rEsc(r.label) + '</option>').join('') + '</select></div></label></div>' +
    '<div id="htres"></div>' +
    '<div class="res mtab" style="margin:14px 0"><div class="h">All steels: hardening and tempering</div><table><tr><th>Steel</th><th>Hardening</th><th></th><th>Tempering</th><th></th></tr>' +
    G.rows.map(r => '<tr><td><b>' + rEsc(r.label) + '</b><div class="ms">' + rEsc(r.kind) + '</div></td>' + mrTempCell(S, r.fields.harden) + mrTempCell(S, r.fields.temper || r.fields.temper_min) + '</tr>').join('') + '</table></div>' +
    '<div id="ph"></div>' +
    '<div class="note"><b>Hardness after tempering:</b> ' + rEsc(M.temper_hardness_note) + '</div>' +
    '<h3 style="margin-top:18px">Heat treatment terms</h3><div class="res mtab"><table><tr><th>Term</th><th>In plain words (BenchMate)</th><th>Term used in this sense by</th></tr>' +
    M.terms.map(t => '<tr><td><b>' + rEsc(t.term) + '</b></td><td>' + rEsc(t.own) + '</td><td>' + mrBadge(t.status) + '<div>' + mrSrcTag(S, t.used_by) + '</div></td></tr>').join('') + '</table></div>' +
    '<div class="note">°C and °F are shown as each publisher prints them; where a publisher prints only one unit, the other is converted. Confirmed (temperatures) = two independent publishers print the same range, allowing 3 °C for °F to °C rounding. Most rows differ because makers recommend different ranges; both are shown, none is picked for you. Aalco\'s 416 text is the same as Atlas Steels\' and counts once. Terms: confirmed = used in this sense by two independent publishers; the wording is ours.<br><b>Sources</b><br>' +
    mrSources(S, Object.keys(S).filter(k => /^(UDD|DOER|LUCEFIN|HUDSON|GMH|ATLAS|AALCO|ATI)/.test(k))) + '</div>';
  const sel = $('#htg', el); sel.value = MRMEM.grade;
  function draw() {
    MRMEM.grade = sel.value;
    const r = G.rows.find(x => x.grade === sel.value) || G.rows[0];
    $('#htres', el).innerHTML = '<div class="res mtab"><div class="h">' + rEsc(r.label) + ' <span class="ms">' + rEsc(r.kind) + '</span></div><table><tr><th>Step</th><th>As printed (hover for the text)</th><th>Status</th></tr>' +
      fieldOrder.filter(f => r.fields[f]).map(f => '<tr><td><b>' + rEsc(G.fields[f]) + '</b></td>' + mrTempCell(S, r.fields[f]) + '</tr>').join('') + '</table></div>';
  }
  sel.onchange = draw; draw();
  const P = M.ph174;
  $('#ph', el).innerHTML = '<div class="res mtab"><div class="h">17-4PH (630, 1.4542): solution treatment and ageing</div><table><tr><th>Condition</th><th>Ageing temperature (from the name)</th><th>Atlas Steels prints</th><th>Time</th><th>Rm min</th><th>Rp0.2 min</th><th>HRC min</th></tr>' +
    '<tr><td><b>A</b> (solution treated)</td><td colspan="6">' + mrTemp(+P.solution.ATLAS_630.c, +P.solution.ATLAS_630.c) + ' <span class="ms">' + rEsc(P.solution.ATLAS_630.v) + ' (Atlas Steels)</span></td></tr>' +
    P.conditions.map(c => { const a = c.ATLAS_630, fc = state.W.unit_convert(12, 2, 1, c.f); return '<tr><td><b>' + c.cond + '</b></td><td class="v">' + (inMode() ? c.f + ' °F <span class="ms">(' + mrR(fc) + ' °C)</span>' : mrR(fc) + ' °C <span class="ms">(' + c.f + ' °F)</span>') + '</td><td class="v">' + a.c + ' °C</td><td class="v">' + a.h + ' h</td><td class="v">' + a.rm + ' MPa</td><td class="v">' + a.rp + ' MPa</td><td class="v">' + a.hrc + '</td></tr>'; }).join('') +
    '</table></div><p class="ms" style="max-width:760px">' + mrBadge(P.naming_status) + ' The condition name is the ageing temperature in °F (Atlas Steels and Aalco both state this). The °C, time and minimum properties are Atlas Steels\' only: needs a second source. ' + rEsc(P.shrink.AALCO_174) + ' (Aalco). ' + rEsc(P.double.ATLAS_630) + ' (Atlas Steels).</p>';
}

// ------------------------------------------------------------------ galvanic series
async function renderGalvanic(el) {
  const R = await loadRef(el); if (!R) return;
  const M = R.matref; if (!M) { el.textContent = 'Materials reference data not built.'; return; }
  const S = M.sources, W = state.W, SEA = M.galv_sea, AI = M.anodic_index;
  el.innerHTML = '<p class="desc">Which of two metals in contact corrodes, and whether the pair is acceptable by the common rule of thumb. <b>The seawater series is for seawater</b>; the anodic index table is a design table for general environments. Neither replaces testing or a corrosion engineer for critical parts.</p>' +
    '<div class="grid" style="max-width:760px"><label class="f"><span>Table</span><div class="row"><select id="gs"><option value="sea">Galvanic series in seawater (V vs Ag/AgCl)</option><option value="ai">Anodic index (design table)</option></select></div></label>' +
    '<label class="f"><span>Metal A</span><div class="row"><select id="ga"></select></div></label><label class="f"><span>Metal B</span><div class="row"><select id="gb"></select></div></label></div>' +
    '<div id="gres"></div><div id="gtab"></div><div class="note" id="gsrc"></div>';
  const gs = $('#gs', el), ga = $('#ga', el), gb = $('#gb', el);
  gs.value = MRMEM.galv;
  function fill() {
    const rows = gs.value === 'sea' ? SEA.rows : AI.rows, ka = gs.value === 'sea' ? 'a' : 'ai_a', kb = gs.value === 'sea' ? 'b' : 'ai_b';
    const opts = rows.map(r => '<option value="' + r.key + '">' + rEsc(r.name) + ' (' + r.printed + ' V)</option>').join('');
    ga.innerHTML = opts; gb.innerHTML = opts; ga.value = MRMEM[ka]; gb.value = MRMEM[kb];
    if (!ga.value) ga.value = rows[0].key; if (!gb.value) gb.value = rows[rows.length - 1].key;
  }
  function draw() {
    const sea = gs.value === 'sea', rows = sea ? SEA.rows : AI.rows;
    MRMEM.galv = gs.value; MRMEM[sea ? 'a' : 'ai_a'] = ga.value; MRMEM[sea ? 'b' : 'ai_b'] = gb.value;
    const A = rows.find(r => r.key === ga.value), B = rows.find(r => r.key === gb.value);
    const d = W.galv_diff(A.v, B.v), an = W.galv_anode(A.v, B.v, sea ? 0 : 1);
    const who = an < 0 ? 'Neither: same potential in this table.' : '<b>' + rEsc((an === 0 ? A : B).name) + '</b> is the anode and corrodes; ' + rEsc((an === 0 ? B : A).name) + ' is protected.';
    let rule = '';
    if (sea) {
      const lim = +SEA.rule.GERR.v, ok = W.galv_within(d, lim);
      rule = '<tr><td>Seawater, metals in direct contact: within ' + lim.toFixed(2) + ' V ' + mrBadge('review') + '<div class="ms">' + rEsc(pubName(S, 'GERR')) + ': ' + rEsc(SEA.rule.GERR.text) + '</div></td><td class="v' + (ok ? '' : ' warn') + '">' + (ok ? 'within' : 'exceeds') + '</td></tr>';
      let order = '';
      if (A.wiki_rank && B.wiki_rank && an >= 0) {
        const an2 = Math.min(...A.wiki_rank) > Math.max(...B.wiki_rank) ? 0 : Math.min(...B.wiki_rank) > Math.max(...A.wiki_rank) ? 1 : -1;
        order = an2 < 0 ? 'Wikipedia\'s seawater order (from MIL-STD-889C and others) does not separate these two.' : an2 === an ? 'Wikipedia\'s seawater order (from MIL-STD-889C and others) agrees on which is the anode.' : '<span class="warn">Wikipedia\'s seawater order puts them the other way round: sources differ for this pair.</span>';
      } else order = 'Not both in Wikipedia\'s order list, so the anode is from one source only.';
      rule += '<tr><td colspan="2"><span class="ms">' + order + '</span></td></tr>';
    } else {
      rule = AI.limits.map(L => { const lim = L.groups[0].lo, ok = W.galv_within(d, lim); return '<tr><td>' + rEsc(L.label) + ': within ' + lim.toFixed(2) + ' V ' + mrBadge(L.status) + '<div class="ms">' + mrNames(S, Object.keys(L.printed)) + '</div></td><td class="v' + (ok ? '' : ' warn') + '">' + (ok ? 'within' : 'exceeds') + '</td></tr>'; }).join('');
    }
    $('#gres', el).innerHTML = '<div class="res" style="max-width:760px;margin-bottom:14px"><div class="h">Result</div><table><tr><td>Potential difference ' + (sea ? '(seawater)' : '(anodic index)') + '</td><td class="v">' + d.toFixed(2) + ' V</td></tr><tr><td colspan="2">' + who + '</td></tr>' + rule + '</table>' +
      '<p class="ms" style="padding:4px 10px">Each potential is printed by one publisher only (needs a second source). The smaller the anode\'s area compared with the cathode\'s, the faster the anode corrodes; keep water out of the joint, insulate the metals or coat the cathode where the difference is large.</p></div>';
    $('#gtab', el).innerHTML = '<div class="res mtab"><div class="h">' + (sea ? 'Galvanic series in seawater, most anodic first (' + rEsc(pubName(S, SEA.src)) + ')' : 'Anodic index, most noble first (' + rEsc(pubName(S, AI.src)) + ')') + '</div><table><tr><th>Metal or alloy</th><th>V</th>' + (sea ? '<th>Wikipedia order (1 = most noble)</th>' : '') + '<th>Status</th></tr>' +
      rows.map(r => '<tr' + (r.key === A.key || r.key === B.key ? ' class="over"' : '') + '><td>' + rEsc(r.name) + '</td><td class="v">' + r.printed + '</td>' + (sea ? '<td class="v">' + (r.wiki_rank ? r.wiki_rank.map(i => i + 1).join(', ') : '-') + '</td>' : '') + '<td>' + mrBadge(r.status) + '</td></tr>').join('') + '</table></div>' +
      (sea ? '<p class="ms" style="max-width:760px">' + rEsc(SEA.note) + ' Wikipedia gives the order only, for stagnant (low-oxygen) seawater; passive stainless steel (oxygen present) is far nobler than active (oxygen starved, for example under a gasket).</p>' : '<p class="ms" style="max-width:760px">' + rEsc(AI.note) + '</p>');
  }
  gs.onchange = () => { fill(); draw(); }; ga.onchange = draw; gb.onchange = draw;
  fill(); draw();
  $('#gsrc', el).innerHTML = 'The pair-compatibility rule compares the difference with a limit; the area and moisture advice is general practice in our words. MISUMI prints a third table with signed values and no stated environment; it is a different scale and not mixed in.<br><b>Sources</b><br>' + mrSources(S, ['GERR', 'WIKI_GS', 'EE_GALV', 'CARRLANE', 'MISUMI_GALV']);
}

// ------------------------------------------------------------------ machining plastics
async function renderPlastics(el) {
  const R = await loadRef(el); if (!R) return;
  const M = R.matref; if (!M) { el.textContent = 'Materials reference data not built.'; return; }
  const S = M.sources, P = M.plastics, inch = inMode();
  // Value of one publisher's printing in the active units, from the canonical lo/hi.
  const f3 = x => (+x.toPrecision(3)).toString();
  const rng = (lo, hi, k) => lo === hi ? k(lo) : k(lo) + '-' + k(hi);
  const show = {
    max_temp: e => mrTemp(e.lo, e.hi), anneal_hold: e => mrTemp(e.lo, e.hi),
    cte: e => (inch ? rng(e.lo / 1.8, e.hi / 1.8, f3) + ' µin/in·°F' : rng(e.lo, e.hi, f3) + ' µm/m·K'),
    density: e => (inch ? rng(e.lo / 27679.9, e.hi / 27679.9, x => x.toFixed(4)) + ' lb/in³' : rng(e.lo, e.hi, x => x.toFixed(0)) + ' kg/m³'),
    turn_speed: e => (inch ? rng(e.lo / FT_M, e.hi / FT_M, x => x.toFixed(0)) + ' ft/min' : rng(e.lo, e.hi, x => x.toFixed(0)) + ' m/min'),
    turn_feed: e => (inch ? rng(e.lo / IN_MM, e.hi / IN_MM, x => x.toFixed(3)) + ' in/rev' : rng(e.lo, e.hi, x => x.toFixed(2)) + ' mm/rev'),
    clearance: e => rng(e.lo, e.hi, f3) + '°', rake: e => rng(e.lo, e.hi, f3) + '°',
  };
  const cell = (f, c) => !c ? '<td><span class="ms">-</span></td><td></td>' : '<td>' + Object.entries(c.printed).map(([k, e]) => '<div title="' + rEsc(e.v || '') + '"><span class="mv">' + show[f](e) + '</span> <span class="ms">' + rEsc(pubName(S, k)) + (e.family && e.family !== (S[k] || {}).family ? '; angles counted with Ensinger' : '') + '</span></div>').join('') + '</td><td>' + mrBadge(c.status) + '</td>';
  el.innerHTML = '<p class="desc">Properties that matter when machining engineering plastics, and each plastics maker\'s starting turning data side by side. The makers disagree on cutting data, so <b>start at the low end, test on scrap</b> and adjust; keep heat out of the part.</p>' +
    '<div class="grid" style="max-width:760px"><label class="f"><span>Plastic</span><div class="row"><select id="plp">' + P.rows.map(r => '<option value="' + r.key + '">' + rEsc(r.name) + '</option>').join('') + '</select></div></label></div>' +
    '<div id="plres"></div>' +
    '<div class="res mtab" style="margin:14px 0"><div class="h">General practice</div><table>' + P.general.map(g => '<tr><td>' + rEsc(g.text) + '</td><td>' + mrBadge(g.status) + '<div>' + mrSrcTag(S, g.src) + '</div></td></tr>').join('') + '</table></div>' +
    '<div class="res mtab"><div class="h">All plastics: maximum service temperature</div><table><tr><th>Plastic</th><th>As printed</th><th>Status</th></tr>' + P.rows.map(r => '<tr><td><b>' + rEsc(r.name) + '</b></td>' + cell('max_temp', r.fields.max_temp) + '</tr>').join('') + '</table></div>' +
    '<div class="note">Properties: confirmed = two independent publishers\' printed values or ranges overlap (3 °C or 3 x 10^-6/K slack for converted printings). Cutting data and annealing: confirmed = the same range (2 %, or 3 °C). Speeds and feeds from Boedeker are the span of its roughing and finishing rows. Boedeker\'s angles match Ensinger\'s for most plastics and are counted with Ensinger. Where BenchMate\'s material data already holds a plastic, density and expansion are shown from there (with their own sources) and not repeated here. ' + rEsc(P.units) +
    '<br><b>Sources</b><br>' + mrSources(S, ['MCAM_TK', 'ENSINGER_MG', 'BOEDEKER_T', 'WSH', 'PROPLAS_T']) + '</div>';
  const sel = $('#plp', el); sel.value = MRMEM.plastic;
  const order = ['max_temp', 'cte', 'density', 'anneal_hold', 'turn_speed', 'turn_feed', 'clearance', 'rake'];
  function draw() {
    MRMEM.plastic = sel.value;
    const r = P.rows.find(x => x.key === sel.value) || P.rows[0];
    let mat = '';
    if (r.materials) {
      const p = r.materials.props, line = (k, lab, fmt) => p[k] ? '<tr><td><b>' + lab + '</b></td><td><span class="mv">' + fmt(p[k].value) + '</span> <span class="ms">' + rEsc(p[k].publishers.join(', ')) + (p[k].others.length ? '; also printed: ' + p[k].others.map(fmt).join(', ') : '') + '</span></td><td>' + mrBadge(p[k].status) + '</td></tr>' : '';
      mat = line('density', 'Density', v => inch ? (v / 27679.9).toFixed(4) + ' lb/in³' : v.toFixed(0) + ' kg/m³') + line('cte', 'Thermal expansion', v => inch ? f3(v / 1.8) + ' µin/in·°F' : f3(v) + ' µm/m·K') +
        '<tr><td colspan="3"><span class="ms">Density and expansion from BenchMate\'s material data (' + rEsc(r.materials.grade) + '), where every value and source is listed. </span><button class="btn" id="plmat">Open Material equivalents</button></td></tr>';
    }
    $('#plres', el).innerHTML = '<div class="res mtab"><div class="h">' + rEsc(r.name) + '</div><table><tr><th>Property or setting</th><th>As printed (hover for the text)</th><th>Status</th></tr>' +
      order.filter(f => r.fields[f]).map(f => '<tr><td><b>' + rEsc(P.fields[f].replace(/ \(.*\)$/, '')) + '</b>' + (f.startsWith('turn') || f === 'clearance' || f === 'rake' ? '<div class="ms">turning, starting value</div>' : '') + '</td>' + cell(f, r.fields[f]) + '</tr>').join('') + mat +
      '</table></div><div class="res mtab" style="margin-top:10px"><div class="h">Notes</div><table>' + r.notes.map(n => '<tr><td>' + rEsc(n.text) + '</td><td>' + mrBadge(n.status) + '<div>' + mrSrcTag(S, n.src) + '</div></td></tr>').join('') + '</table></div>';
    const b = $('#plmat', el); if (b) b.onclick = () => mrOpen('materials');
  }
  sel.onchange = draw; draw();
}

// ------------------------------------------------------------------ metal identification
async function renderMetalId(el) {
  const R = await loadRef(el); if (!R) return;
  const M = R.matref; if (!M) { el.textContent = 'Materials reference data not built.'; return; }
  const S = M.sources, X = M.metalid, sp = X.spark;
  const len = v => v === '' ? '-' : inMode() ? 'about ' + v + ' in' : 'about ' + (v * IN_MM / 1000).toFixed(1) + ' m';
  el.innerHTML = '<p class="desc">Quick shop tests to sort an unknown bar into a family of metals. They do not identify a grade: for that use the mill certificate, a PMI (XRF or OES) analysis or a lab.</p>' +
    '<div class="res mtab" style="margin-bottom:14px"><div class="h">Tests</div><table>' + X.tests.map(t => '<tr><td><b>' + rEsc(t.test) + '</b></td><td>' + rEsc(t.text) + '</td><td>' + mrBadge(t.status) + '<div>' + mrSrcTag(S, t.src) + '</div></td></tr>').join('') + '</table></div>' +
    '<div class="res mtab"><div class="h">Spark test streams (' + rEsc(pubName(S, sp.src)) + ')</div><table><tr><th>Metal</th><th>Stream length</th><th>Volume</th><th>Colour</th><th>Bursts</th></tr>' +
    sp.rows.map(r => '<tr><td><b>' + rEsc(r[0]) + '</b></td><td class="v">' + len(r[1]) + '</td><td>' + rEsc(r[2]) + '</td><td>' + rEsc(r[3]) + '</td><td>' + rEsc(r[4]) + '</td></tr>').join('') + '</table></div>' +
    '<p class="ms" style="max-width:760px">' + mrBadge('review') + ' One source (in our words): needs a second source. ' + rEsc(sp._note) + '</p>' +
    '<div class="note"><b>Sources</b><br>' + mrSources(S, ['NAVY_SW']) + '</div>';
}
