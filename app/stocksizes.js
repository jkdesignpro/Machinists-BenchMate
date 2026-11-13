'use strict';
// Common profiles and sizes (0.8.0): stock sizes as two publishers list them, a drawing of the chosen
// section, its area, weight and stiffness from the Rust core, and a hand-off to Section properties.
// The size lists are in stocksizes-data.js (scripts/gen_stock_sizes.py); sources in docs/stock-sizes.md.
const SS_FAMILIES = {
  shs: { title: 'Square hollow section (box tube), metric', unit: 'mm', sec: 1, pubs: ['AmesWeb, Square Hollow Section Dimensions Table (EN 10210-2)', 'Project Materials, HSS hollow sections: CHS, SHS, RHS sizes'] },
  sqin: { title: 'Square tube, inch', unit: 'in', sec: 1, pubs: ['Metals Depot, steel square tube (A513 and A500)', 'Speedy Metals, structural steel square and rectangular tube (A500)'] },
  angm: { title: 'Equal angle, metric', unit: 'mm', sec: 6, pubs: ['Wermac, dimensions of equal angles (NEN-EN 10025)', 'Kerschgens, product portfolio steel L-bars (DIN EN 10056)'] },
  angin: { title: 'Equal angle, inch', unit: 'in', sec: 6, pubs: ['The Engineering ToolBox, steel angles with equal legs', 'Speedy Metals, hot rolled structural shapes (A36)'] },
  tslot: { title: 'Aluminium T-slot framing', unit: 'mm' },
};
const SS_STATE = { fam: 'shs', size: null, wall: null, mat: '' };

function ssFrac(x) {
  // Inch sizes as the publishers print them: whole and sixteenths, else three decimals.
  const w = Math.floor(x + 1e-9), r = Math.round((x - w) * 16);
  if (Math.abs(x - w - r / 16) > 1e-6) return x.toFixed(3).replace(/^0/, '');
  if (r === 0) return String(w);
  let n = r, d = 16; while (n % 2 === 0) { n /= 2; d /= 2; }
  return (w ? w + '-' : '') + n + '/' + d;
}
const ssLab = (v, unit) => unit === 'in' ? ssFrac(v) : String(v);

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
      el.innerHTML = h; el.querySelector('#ssf').onchange = e => { s.fam = e.target.value; s.size = s.wall = null; draw(); };
      return;
    }
    const list = STOCK_SIZES[s.fam];
    if (s.size == null) {
      // Start on a size both publishers list, about a third of the way down the list, so the section shows at once.
      for (const [sz, walls] of list.slice(Math.floor(list.length / 3)).concat(list)) { const w = walls.find(x => x[1] === 3); if (w) { s.size = sz; s.wall = w[0]; break; } }
    }
    h += '<p class="desc">Sizes as two stockists or tables list them. A size in a plain box is listed by both publishers; a dashed box marked <b>1</b> or <b>2</b> is listed by that one only. Pick a wall to see the section.' +
      (F.unit === 'in' ? ' Sizes in inches.' : ' Sizes in mm.') + '</p><div class="res mtab"><table class="sstab"><tr><th>' + (F.sec === 6 ? 'Legs' : 'Outside') + '</th><th>' + (F.sec === 6 ? 'Thickness' : 'Wall') + '</th></tr>' +
      list.map(([sz, walls]) => '<tr><td style="white-space:nowrap"><b>' + ssLab(sz, F.unit) + ' x ' + ssLab(sz, F.unit) + '</b></td><td>' +
        walls.map(([w, who]) => '<button class="sschip' + (s.size === sz && s.wall === w ? ' on' : '') + (who === 3 ? '' : ' one') + '" data-s="' + sz + '" data-w="' + w + '" title="' + rEsc(who === 3 ? 'Listed by both publishers' : 'Listed by ' + F.pubs[who - 1].split(',')[0] + ' only') + '">' +
          ssLab(w, F.unit) + (who === 3 ? '' : '<sup>' + who + '</sup>') + '</button>').join('') + '</td></tr>').join('') + '</table></div>' +
      '<p class="desc"><b>1</b> ' + rEsc(F.pubs[0]) + '. <b>2</b> ' + rEsc(F.pubs[1]) + '.</p>' +
      '<div class="tg"><section class="pane"><div id="ssdia"></div></section><section class="pane"><div id="ssres"></div></section></div>';
    el.innerHTML = h;
    el.querySelector('#ssf').onchange = e => { s.fam = e.target.value; s.size = s.wall = null; draw(); };
    el.querySelectorAll('.sschip').forEach(b => b.onclick = () => { s.size = +b.dataset.s; s.wall = +b.dataset.w; draw(); });
    calc();
  };
  const calc = () => {
    const F = SS_FAMILIES[s.fam], dia = el.querySelector('#ssdia'), res = el.querySelector('#ssres');
    if (s.size == null) { res.innerHTML = '<p class="desc">Pick a size above.</p>'; dia.innerHTML = ''; return; }
    // The section in the user's units, and in mm for the weight.
    const toMm = F.unit === 'in' ? IN_MM : 1, k = inch ? toMm / IN_MM : toMm, b = s.size * k, t = s.wall * k;
    const args = F.sec === 6 ? [6, b, b, t, 0] : [1, b, b, t, 0], q = i => W.mech_section(args[0], args[1], args[2], args[3], args[4], i);
    const areaMm = W.mech_section(args[0], s.size * toMm, s.size * toMm, s.wall * toMm, 0, 0);
    const name = ssLab(s.size, F.unit) + ' x ' + ssLab(s.size, F.unit) + ' x ' + ssLab(s.wall, F.unit) + ' ' + F.unit;
    const rows = [['Size', name, ''], ['Area A', fmt(q(0), u.adp), u.A], ['Ix = Iy', fmt(q(3), u.idp), u.I]];
    if (F.sec === 1) rows.push(['Section modulus Sx', fmt(q(9), u.idp), u.Z], ['Radius of gyration r', fmt(q(13), u.dp), u.L]);
    else rows.push(['Centroid from the back of each leg', fmt(q(1), u.dp), u.L], ['Least radius of gyration (buckling)', fmt(q(15), u.dp), u.L]);
    const rho = s.mat !== '' && dens[+s.mat] ? dens[+s.mat].v : 0;
    if (rho > 0) {
      const kgm = W.mass_metric_kg(areaMm, 1000, rho);
      rows.push(inch ? ['Weight per foot', fmt(W.mass_metric_kg(areaMm, 304.8, rho) / 0.45359237, 3), 'lb'] : ['Weight per metre', fmt(kgm, 3), 'kg']);
    }
    res.innerHTML = '<div class="res"><table>' + rows.map(r => '<tr><td>' + r[0] + '</td><td class="v">' + r[1] + '</td><td>' + r[2] + '</td></tr>').join('') + '</table></div>' +
      '<div class="mfilter"><span>Weight for:</span><select id="ssmat"><option value="">' + (dens.length ? 'Pick a confirmed density...' : 'No confirmed density yet') + '</option>' +
      dens.map((d, i) => '<option value="' + i + '"' + (String(s.mat) === String(i) ? ' selected' : '') + '>' + rEsc(d.grade) + '</option>').join('') + '</select></div>' +
      '<p class="desc">Sharp corners: the corner radii of tube and the root and toe radii of rolled angle are left out, so the maker\'s table gives slightly different values. Use the maker\'s table for design.</p>' +
      '<button class="btn" id="ssgo">Open in Section properties</button> <button class="btn" id="ssbeam">Open in Beam deflection</button>';
    res.querySelector('#ssmat').onchange = e => { s.mat = e.target.value; calc(); };
    const vals = F.sec === 6 ? { sec: 6, sb: b, sh: b, st: t } : { sec: 1, sb: b, sh: b, st: t };
    res.querySelector('#ssgo').onclick = () => sendTo('section', vals);
    res.querySelector('#ssbeam').onclick = () => sendTo('beam', vals);
    dia.innerHTML = DIAGRAMS.stocksizesSec ? DIAGRAMS.stocksizesSec({ sec: F.sec, b: s.size, t: s.wall, unit: F.unit, lab: ssLab }) : '';
  };
  draw();
}

// Drawing: the section to scale (the wall drawn at least 4 px so it shows), with its size and wall.
DIAGRAMS.stocksizesSec = function (o) {
  const W = 360, H = 260, S = 160, x0 = 70, y0 = 40, k = S / o.b, t = Math.max(4, o.t * k), L = v => o.lab(v, o.unit) + (o.unit === 'in' ? ' in' : '');
  let s = '';
  if (o.sec === 1) {
    s += '<path class="hatch" fill-rule="evenodd" d="M' + x0 + ' ' + y0 + 'h' + S + 'v' + S + 'h-' + S + 'Z M' + (x0 + t) + ' ' + (y0 + t) + 'v' + (S - 2 * t) + 'h' + (S - 2 * t) + 'v-' + (S - 2 * t) + 'Z"/>';
    s += DK.cl(x0 - 14, y0 + S / 2, x0 + S + 14, y0 + S / 2) + DK.cl(x0 + S / 2, y0 - 14, x0 + S / 2, y0 + S + 14);
  } else {
    s += DK.poly([[x0, y0], [x0 + t, y0], [x0 + t, y0 + S - t], [x0 + S, y0 + S - t], [x0 + S, y0 + S], [x0, y0 + S]], 'hatch');
  }
  s += DK.dimH(x0, x0 + S, y0 + S, L(o.b), { off: -26, below: true }) + DK.dimV(y0 + S, y0, x0, L(o.b), { off: 30 });
  s += o.sec === 1 ? DK.leader(x0 + S - t / 2, y0 + S / 2 + 30, x0 + S + 40, y0 + S / 2 + 56, 'wall ' + L(o.t), { anchor: 'start' })
    : DK.leader(x0 + t / 2, y0 + 30, x0 + t + 50, y0 + 20, 'thickness ' + L(o.t), { anchor: 'start' });
  return DK.svg(W, H, s, o.sec === 1 ? 'Square hollow section, sharp corners' : 'Equal angle, sharp corners');
};
