'use strict';
// Common profiles and sizes (0.8.0): stock sizes as two publishers list them, a drawing of the chosen
// section, its area, weight and stiffness from the Rust core, and a hand-off to Section properties.
// The size lists are in stocksizes-data.js (scripts/gen_stock_sizes.py); sources in docs/stock-sizes.md.
// sec: the Section properties shape (1 box, 3 round tube, 4 I-beam, 5 channel, 6 angle).
const SS_FAMILIES = {
  shs: { title: 'Square hollow section (box), metric', unit: 'mm', sec: 1, pubs: ['AmesWeb, Square Hollow Section Dimensions Table (EN 10210-2)', 'Project Materials, HSS hollow sections: CHS, SHS, RHS sizes'] },
  rhs: { title: 'Rectangular hollow section (box), metric', unit: 'mm', sec: 1, pubs: ['AmesWeb, Rectangular Hollow Section table (EN 10210-2)', 'Project Materials, HSS hollow sections: CHS, SHS, RHS sizes'] },
  chs: { title: 'Circular hollow section (round tube), metric', unit: 'mm', sec: 3, pubs: ['AmesWeb, Circular Hollow Section Sizes Table (EN 10210-2)', 'Wermac, hollow structural sections'] },
  angm: { title: 'Equal angle, metric', unit: 'mm', sec: 6, pubs: ['Wermac, dimensions of equal angles (NEN-EN 10025)', 'Kerschgens, product portfolio steel L-bars (DIN EN 10056)'] },
  ipe: { title: 'IPE beam (I-beam), metric', unit: 'mm', sec: 4, pubs: ['Wermac, dimensions of IPE and INP beams', 'Project Materials, IPE beam dimensions and weight'] },
  pfc: { title: 'Parallel flange channel (PFC), metric', unit: 'mm', sec: 5, pubs: ['British Steel, parallel flange channels datasheet (BS EN 10365)', 'Kocaer Steel, channels PFC (BS 4-1)'] },
  sqin: { title: 'Square tube, inch', unit: 'in', sec: 1, pubs: ['Metals Depot, steel square tube (A513 and A500)', 'Speedy Metals, structural steel square and rectangular tube (A500)'] },
  rectin: { title: 'Rectangular tube, inch', unit: 'in', sec: 1, pubs: ['Metals Depot, steel rectangle tube', 'Speedy Metals, structural steel square and rectangular tube (A500)'] },
  angin: { title: 'Equal angle, inch', unit: 'in', sec: 6, pubs: ['The Engineering ToolBox, steel angles with equal legs', 'Speedy Metals, hot rolled structural shapes (A36)'] },
  alang: { title: 'Aluminium equal angle, inch', unit: 'in', sec: 6, pubs: ['Speedy Metals, 6061 and 6063 structural shapes', 'Russel Metals, 6061-T6 aluminum angles'] },
  flat: { title: 'Flat bar, any width and thickness', sec: 0, typed: true },
  tslot: { title: 'Aluminium T-slot framing', unit: 'mm' },
};
// fb: the typed flat bar, width and thickness in mm (shown in the page's units); until typed, 50 x 10 mm or 2 x 3/8 in.
const SS_STATE = { fam: 'shs', pick: null, mat: '', fb: null };
const ssTrim = v => String(+v.toFixed(4));

function ssFrac(x) {
  // Inch sizes as the publishers print them: whole and sixteenths, else three decimals.
  const w = Math.floor(x + 1e-9), r = Math.round((x - w) * 16);
  if (Math.abs(x - w - r / 16) > 1e-6) return x.toFixed(3).replace(/^0/, '');
  if (r === 0) return String(w);
  let n = r, d = 16; while (n % 2 === 0) { n /= 2; d /= 2; }
  return (w ? w + '-' : '') + n + '/' + d;
}
const ssLab = (v, unit) => unit === 'in' ? ssFrac(v) : String(v);
const ssBeam = sec => sec === 4 || sec === 5;

async function renderStockSizes(el) {
  const s = SS_STATE, W = state.W, sys = state.sys, inch = sys === 'inch', u = mku(sys);
  if (typeof MAT !== 'undefined' && !MAT) { try { MAT = await (await fetch('data/materials.json')).json(); } catch (e) {} }
  const dens = confirmedDensity();
  const draw = () => {
    const F = SS_FAMILIES[s.fam];
    let h = '<div class="grid" style="max-width:760px"><label class="f"><span>Profile</span><div class="row"><select id="ssf" style="min-width:320px">' +
      Object.entries(SS_FAMILIES).map(([k, f]) => '<option value="' + k + '"' + (k === s.fam ? ' selected' : '') + '>' + rEsc(f.title) + '</option>').join('') + '</select></div></label></div>';
    if (s.fam === 'tslot') {
      h += '<p class="desc">T-slot framing is named by series, and makers use different names for it, so the two publishers are shown side by side. The slot and the T-nuts belong to a maker\'s series: check the maker\'s catalogue before mixing parts.</p>' +
        '<div class="res mtab"><table><tr><th>Wikipedia, T-slot structural framing</th><th>MISUMI USA blog (R. Brownell, 19 May 2026)</th></tr>' +
        '<tr><td>Inch: 10 series (1 in) and 15 series (1.5 in)</td><td>3 series: 15 x 15</td></tr>' +
        '<tr><td>Metric: 20, 25, 30, 40 and 45 series (20 to 45 mm)</td><td>5 series: 20 x 20, 40 x 40</td></tr>' +
        '<tr><td>Square sections in each series; rectangles are x by 2x, such as 40 x 80 in the 40 series</td><td>6 series: 30 x 30, 30 x 60</td></tr>' +
        '<tr><td></td><td>8 series: 40 x 40, 40 x 80; 8-45 series shares the 8 series slot, so the T-nuts fit both</td></tr>' +
        '<tr><td></td><td>A higher series number means a wider slot</td></tr></table></div>' +
        '<p class="desc">Each column is one publisher. The section of a T-slot extrusion is the maker\'s shape: take its area and stiffness from the maker\'s data sheet.</p>';
      el.innerHTML = h; el.querySelector('#ssf').onchange = e => { s.fam = e.target.value; s.pick = null; draw(); };
      return;
    }
    if (F.typed) {
      if (!s.fb) s.fb = inch ? { b: 2 * IN_MM, t: 0.375 * IN_MM } : { b: 50, t: 10 };
      const c = inch ? IN_MM : 1, val = v => +(v / c).toFixed(inch ? 4 : 2);
      h += '<p class="desc">Flat bar is cut to any width and thickness, and each stockist lists its own range, so type the size. No list of sizes is given: no two publishers\' lists could be read in full (see docs/stock-sizes.md).</p>' +
        '<div class="grid" style="max-width:520px"><label class="f"><span>Width (' + u.L + ')</span><input id="ssfb" type="number" step="any" value="' + val(s.fb.b) + '"></label>' +
        '<label class="f"><span>Thickness (' + u.L + ')</span><input id="ssft" type="number" step="any" value="' + val(s.fb.t) + '"></label></div>' +
        '<div class="tg"><section class="pane"><div id="ssdia"></div></section><section class="pane"><div id="ssres"></div></section></div>';
      el.innerHTML = h;
      el.querySelector('#ssf').onchange = e => { s.fam = e.target.value; s.pick = null; draw(); };
      el.querySelector('#ssfb').oninput = e => { s.fb.b = parseFloat(e.target.value) * c; calc(); };
      el.querySelector('#ssft').oninput = e => { s.fb.t = parseFloat(e.target.value) * c; calc(); };
      calc();
      return;
    }
    const list = STOCK_SIZES[s.fam], beam = ssBeam(F.sec);
    if (!s.pick) {
      // Start on a size both publishers list, about a third of the way down the list, so the section shows at once.
      for (const [i, row] of list.map((r, i) => [i, r]).slice(Math.floor(list.length / 3)).concat(list.map((r, i) => [i, r]))) { const w = row[2].find(x => x[1] === 3); if (w) { s.pick = [i, w[0]]; break; } }
    }
    const on = (i, w) => s.pick && s.pick[0] === i && s.pick[1] === w;
    const chip = (i, w, who, text) => '<button class="sschip' + (on(i, w) ? ' on' : '') + (who === 3 ? '' : ' one') + '" data-i="' + i + '" data-w="' + (w == null ? '' : w) + '" title="' +
      rEsc(who === 3 ? 'Listed by both publishers' : 'Listed by ' + F.pubs[who - 1].split(',')[0] + ' only') + '">' + text + (who === 3 ? '' : '<sup>' + who + '</sup>') + '</button>';
    h += '<p class="desc">Sizes as two stockists or tables list them. A size in a plain box is listed by both publishers; a dashed box marked <b>1</b> or <b>2</b> is listed by that one only.' +
      (beam ? ' Pick a section to see it.' : ' Pick a wall to see the section.') + (F.unit === 'in' ? ' Sizes in inches.' : ' Sizes in mm.') + '</p>' +
      '<div class="res mtab"><table class="sstab"><tr><th>' + (beam ? 'Section' : F.sec === 6 ? 'Legs' : F.sec === 3 ? 'Outside diameter' : 'Outside') + '</th><th>' +
      (beam ? 'Web and flange' : F.sec === 6 ? 'Thickness' : 'Wall') + '</th></tr>' +
      list.map(([name, d, walls], i) => '<tr><td style="white-space:nowrap"><b>' + rEsc(name) + '</b></td><td>' +
        (beam ? chip(i, null, walls[0][1], 'tw ' + d[2] + ', tf ' + d[3]) : walls.map(([w, who]) => chip(i, w, who, ssLab(w, F.unit))).join('')) + '</td></tr>').join('') + '</table></div>' +
      '<p class="desc"><b>1</b> ' + rEsc(F.pubs[0]) + '. <b>2</b> ' + rEsc(F.pubs[1]) + '.</p>' +
      '<div class="tg"><section class="pane"><div id="ssdia"></div></section><section class="pane"><div id="ssres"></div></section></div>';
    el.innerHTML = h;
    el.querySelector('#ssf').onchange = e => { s.fam = e.target.value; s.pick = null; draw(); };
    el.querySelectorAll('.sschip').forEach(b => b.onclick = () => { s.pick = [+b.dataset.i, b.dataset.w === '' ? null : +b.dataset.w]; draw(); });
    calc();
  };
  const calc = () => {
    const F = SS_FAMILIES[s.fam], dia = el.querySelector('#ssdia'), res = el.querySelector('#ssres');
    // A typed flat bar is held in mm; its "row" is [name, [thickness, width]] like the listed sections' [h, b].
    const fbOk = s.fb && s.fb.b > 0 && s.fb.t > 0 && isFinite(s.fb.b) && isFinite(s.fb.t);
    const row = F.typed ? (fbOk ? ['Flat bar', [s.fb.t, s.fb.b]] : null) : s.pick && STOCK_SIZES[s.fam][s.pick[0]];
    if (!row) { res.innerHTML = '<p class="desc">' + (F.typed ? 'Type a width and a thickness above zero.' : 'Pick a size above.') + '</p>'; dia.innerHTML = ''; return; }
    const [name, d] = row, t = F.typed ? null : s.pick[1], unit = F.typed ? 'mm' : F.unit;
    // The section in the user's units (k), and in mm (km) for the weight. Section arguments as Section properties takes them.
    const toMm = unit === 'in' ? IN_MM : 1, k = inch ? toMm / IN_MM : toMm;
    const argsAt = c => F.sec === 0 ? [0, d[1] * c, d[0] * c, 0, 0] : F.sec === 1 ? [1, d[1] * c, d[0] * c, t * c, 0] : F.sec === 3 ? [3, d[0] * c, (d[0] - 2 * t) * c, 0, 0]
      : F.sec === 6 ? [6, d[0] * c, d[1] * c, t * c, 0] : [F.sec, d[1] * c, d[0] * c, d[3] * c, d[2] * c];
    const a = argsAt(k), q = i => W.mech_section(a[0], a[1], a[2], a[3], a[4], i), am = argsAt(toMm), areaMm = W.mech_section(am[0], am[1], am[2], am[3], am[4], 0);
    const size = F.typed ? ssTrim(d[1] * k) + ' x ' + ssTrim(d[0] * k) + ' ' + u.L : name + (t == null ? '' : ' x ' + ssLab(t, F.unit)) + ' ' + F.unit;
    const rows = [['Size', size, ''], ['Area A', fmt(q(0), u.adp), u.A]];
    if (F.sec === 6) rows.push(['Ix = Iy', fmt(q(3), u.idp), u.I], ['Centroid from the back of each leg', fmt(q(1), u.dp), u.L], ['Least radius of gyration (buckling)', fmt(q(15), u.dp), u.L]);
    else if (F.sec === 3) rows.push(['I', fmt(q(3), u.idp), u.I], ['Section modulus', fmt(q(9), u.idp), u.Z], ['Polar moment J', fmt(q(16), u.idp), u.I], ['Radius of gyration r', fmt(q(13), u.dp), u.L]);
    else if (F.sec === 0) rows.push(['Ix (bar lying flat, as drawn)', fmt(q(3), u.idp), u.I], ['Section modulus lying flat', fmt(q(9), u.idp), u.Z],
      ['Iy (bar on edge)', fmt(q(4), u.idp), u.I], ['Least radius of gyration (buckling)', fmt(q(15), u.dp), u.L]);
    else {
      rows.push(['Ix (about the strong axis)', fmt(q(3), u.idp), u.I], ['Section modulus Sx', fmt(q(9), u.idp), u.Z]);
      if (Math.abs(d[0] - d[1]) > 1e-9) rows.push(['Iy (about the weak axis)', fmt(q(4), u.idp), u.I]);
      rows.push(['Least radius of gyration (buckling)', fmt(q(15), u.dp), u.L]);
    }
    const rho = s.mat !== '' && dens[+s.mat] ? dens[+s.mat].v : 0;
    if (rho > 0) rows.push(inch ? ['Weight per foot', fmt(W.mass_metric_kg(areaMm, 304.8, rho) / 0.45359237, 3), 'lb'] : ['Weight per metre', fmt(W.mass_metric_kg(areaMm, 1000, rho), 3), 'kg']);
    res.innerHTML = '<div class="res"><table>' + rows.map(r => '<tr><td>' + r[0] + '</td><td class="v">' + r[1] + '</td><td>' + r[2] + '</td></tr>').join('') + '</table></div>' +
      '<div class="mfilter"><span>Weight for:</span><select id="ssmat"><option value="">' + (dens.length ? 'Pick a confirmed density...' : 'No confirmed density yet') + '</option>' +
      dens.map((x, i) => '<option value="' + i + '"' + (String(s.mat) === String(i) ? ' selected' : '') + '>' + rEsc(x.grade) + '</option>').join('') + '</select></div>' +
      (F.typed ? '<p class="desc">Sharp corners: hot rolled flat bar has slightly rounded edges, so its true area is a little less.</p>' : '<p class="desc">Sharp corners: the corner radii of tube and the root and toe radii of rolled sections are left out' + (F.sec === 4 || F.sec === 5 ? ' (on a beam or channel the root fillets add a few per cent of area)' : '') + ', so the maker\'s table gives slightly different values. Use the maker\'s table for design.</p>') +
      '<button class="btn" id="ssgo">Open in Section properties</button> <button class="btn" id="ssbeam">Open in Beam deflection</button>';
    res.querySelector('#ssmat').onchange = e => { s.mat = e.target.value; calc(); };
    const vals = F.sec === 0 ? { sec: 0, sb: a[1], sh: a[2] } : F.sec === 1 ? { sec: 1, sb: a[1], sh: a[2], st: a[3] } : F.sec === 3 ? { sec: 3, sD: a[1], sd: a[2] } : F.sec === 6 ? { sec: 6, sb: a[2], sh: a[1], st: a[3] }
      : { sec: F.sec, sb: a[1], sh: a[2], stf: a[3], stw: a[4] };
    res.querySelector('#ssgo').onclick = () => sendTo('section', vals);
    res.querySelector('#ssbeam').onclick = () => sendTo('beam', vals);
    dia.innerHTML = DIAGRAMS.stocksizesSec ? DIAGRAMS.stocksizesSec({ sec: F.sec, d: F.typed ? d.map(v => v * k) : d, t, unit: F.typed ? u.L : F.unit, lab: F.typed ? ssTrim : ssLab }) : '';
  };
  draw();
}

// Drawing: the section to scale (thin walls drawn at least 3 px so they show), with its sizes.
DIAGRAMS.stocksizesSec = function (o) {
  const W = 380, H = 270, d = o.d, L = v => o.lab(v, o.unit) + (o.unit === 'in' ? ' in' : '');
  const beam = o.sec === 4 || o.sec === 5, hh = o.sec === 3 ? d[0] : d[0], bb = o.sec === 3 ? d[0] : d[1];
  const k = Math.min(170 / hh, 200 / bb), w = bb * k, h = hh * k, x0 = 90 + (200 - w) / 2, y0 = 30 + (170 - h) / 2, th = v => Math.max(3, v * k);
  let s = '';
  if (o.sec === 0) {
    s += DK.poly([[x0, y0], [x0 + w, y0], [x0 + w, y0 + h], [x0, y0 + h]], 'hatch');
    s += DK.cl(x0 - 14, y0 + h / 2, x0 + w + 14, y0 + h / 2) + DK.cl(x0 + w / 2, y0 - 14, x0 + w / 2, y0 + h + 14);
  } else if (o.sec === 1) {
    const t = th(o.t);
    s += '<path class="hatch" fill-rule="evenodd" d="M' + x0 + ' ' + y0 + 'h' + w + 'v' + h + 'h-' + w + 'Z M' + (x0 + t) + ' ' + (y0 + t) + 'v' + (h - 2 * t) + 'h' + (w - 2 * t) + 'v-' + (h - 2 * t) + 'Z"/>';
    s += DK.cl(x0 - 14, y0 + h / 2, x0 + w + 14, y0 + h / 2) + DK.cl(x0 + w / 2, y0 - 14, x0 + w / 2, y0 + h + 14);
    s += DK.leader(x0 + w - t / 2, y0 + h / 2 + 24, x0 + w + 28, y0 + h / 2 + 50, 'wall ' + L(o.t), { anchor: 'start' });
  } else if (o.sec === 3) {
    const r = w / 2, cx = x0 + r, cy = y0 + r, t = th(o.t);
    s += '<path class="hatch" fill-rule="evenodd" d="M' + (cx - r) + ' ' + cy + 'a' + r + ' ' + r + ' 0 1 0 ' + 2 * r + ' 0a' + r + ' ' + r + ' 0 1 0 -' + 2 * r + ' 0Z M' + (cx - r + t) + ' ' + cy + 'a' + (r - t) + ' ' + (r - t) + ' 0 1 0 ' + 2 * (r - t) + ' 0a' + (r - t) + ' ' + (r - t) + ' 0 1 0 -' + 2 * (r - t) + ' 0Z"/>';
    s += DK.cl(cx - r - 14, cy, cx + r + 14, cy) + DK.cl(cx, cy - r - 14, cx, cy + r + 14);
    s += DK.leader(cx + r * 0.7, cy + r * 0.7, cx + r + 26, cy + r + 10, 'wall ' + L(o.t), { anchor: 'start' });
  } else if (o.sec === 6) {
    const t = th(o.t);
    s += DK.poly([[x0, y0], [x0 + t, y0], [x0 + t, y0 + h - t], [x0 + w, y0 + h - t], [x0 + w, y0 + h], [x0, y0 + h]], 'hatch');
    s += DK.leader(x0 + t / 2, y0 + 30, x0 + t + 50, y0 + 20, 'thickness ' + L(o.t), { anchor: 'start' });
  } else {
    const tw = th(d[2]), tf = th(d[3]), wx = o.sec === 4 ? x0 + (w - tw) / 2 : x0;
    s += DK.poly(o.sec === 4
      ? [[x0, y0], [x0 + w, y0], [x0 + w, y0 + tf], [wx + tw, y0 + tf], [wx + tw, y0 + h - tf], [x0 + w, y0 + h - tf], [x0 + w, y0 + h], [x0, y0 + h], [x0, y0 + h - tf], [wx, y0 + h - tf], [wx, y0 + tf], [x0, y0 + tf]]
      : [[x0, y0], [x0 + w, y0], [x0 + w, y0 + tf], [x0 + tw, y0 + tf], [x0 + tw, y0 + h - tf], [x0 + w, y0 + h - tf], [x0 + w, y0 + h], [x0, y0 + h]], 'hatch');
    s += DK.cl(x0 - 14, y0 + h / 2, x0 + w + 14, y0 + h / 2);
    if (o.sec === 4) s += DK.cl(x0 + w / 2, y0 - 14, x0 + w / 2, y0 + h + 14);
    s += DK.leader(wx + tw, y0 + h / 2 + 20, x0 + w + 20, y0 + h / 2 + 40, 'tw ' + L(d[2]), { anchor: 'start' });
    s += DK.leader(x0 + w - 8, y0 + tf / 2, x0 + w + 20, y0 - 2, 'tf ' + L(d[3]), { anchor: 'start' });
  }
  s += DK.dimH(x0, x0 + w, y0 + h, o.sec === 3 ? 'Ø ' + L(d[0]) : L(bb), { off: -26, below: true });
  if (o.sec !== 3) s += DK.dimV(y0 + h, y0, x0, L(hh), { off: 30 });
  const names = { 0: 'Flat bar', 1: 'Hollow section', 3: 'Round tube', 4: 'I-beam', 5: 'Channel', 6: 'Equal angle' };
  return DK.svg(W, H, s, names[o.sec] + ', sharp corners');
};
