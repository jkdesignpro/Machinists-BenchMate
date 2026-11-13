'use strict';
// Text engraving: type a text, pick a stroke font, see it to scale and get
// the program. The font is read, the text is laid out and the program is
// written in the Rust core (core/src/engrave.rs, gcode::gen_engrave); this
// file reads the inputs, loads the font file, draws the strokes the core
// returns and offers the downloads.
// The fonts are the Hershey fonts as SVG font files (data/fonts/hershey),
// each with its own use notice and acknowledgements inside the file.
// Uses helpers from shop.js, geometry.js, cycles.js and gsim.js.

const ENG_FONTS = [
  ['HersheySans1', 'Sans, single line (the usual engraving letter)'],
  ['HersheySansMed', 'Sans, double line'],
  ['HersheySerifMed', 'Serif'],
  ['HersheySerifMedItalic', 'Serif italic'],
  ['HersheySerifBold', 'Serif bold'],
  ['HersheySerifBoldItalic', 'Serif bold italic'],
  ['HersheyScript1', 'Script, single line'],
  ['HersheyScriptMed', 'Script, double line'],
  ['HersheyGothEnglish', 'Gothic English'],
];
const ENG = { files: {}, inCore: '', loading: '', err: '' };
const ENG_CREDIT = 'The Hershey Fonts were originally created by Dr. A. V. Hershey while working at the U. S. National Bureau of Standards. The format of the font data in the distribution they come from was originally created by James Hurt, Cognition, Inc., 900 Technology Park Drive, Billerica, MA 01821. Prepared and converted to SVG fonts by Windell H. Oskay.';

// Make sure the core holds the font `name`. Returns true when it does; otherwise starts
// loading the file and calls `again` when it has arrived.
function engFont(name, again) {
  if (!ENG_FONTS.some(f => f[0] === name)) name = ENG_FONTS[0][0];
  const W = state.W;
  if (ENG.inCore === name) return true;
  if (ENG.files[name]) {
    const n = W.engrave_font(gsPut(ENG.files[name]));
    if (n > 0) { ENG.inCore = name; ENG.err = ''; return true; }
    ENG.inCore = ''; ENG.err = gsGet(-n) || 'The font file could not be read.'; return false;
  }
  if (ENG.loading === name) return false;
  ENG.loading = name; ENG.err = '';
  fetch('data/fonts/' + name + '.svg').then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
    .then(t => { ENG.files[name] = t; }, () => { ENG.err = 'Font file not found (run scripts/build-web.sh).'; })
    .then(() => { ENG.loading = ''; again(); });
  return false;
}

// Lay the text out in the core. Returns { strokes: [[[x, y], ...]], info(i), missing } or { error }.
function engLayout(s) {
  const W = state.W, pct = snum(s.stretch);
  const n = W.engrave_layout(gsPut(s.text), snum(s.h), s.spacing === '' ? 0 : snum(s.spacing), s.line === '' ? 0 : snum(s.line), pct / 100, +s.align, +s.lay,
    s.x === '' ? 0 : snum(s.x), s.y === '' ? 0 : snum(s.y), s.angle === '' ? 0 : snum(s.angle), +s.lay === 0 ? 0 : snum(s.radius), +s.mirror);
  if (n < 0) return { error: gsGet(-n) };
  const total = n + 2 * W.engrave_info(9), v = listOut(W, total), strokes = [];
  for (let i = 0; i < v.length;) { const c = v[i++], st = []; for (let k = 0; k < c; k++) { st.push([v[i], v[i + 1]]); i += 2; } strokes.push(st); }
  return { strokes, info: i => W.engrave_info(i), missing: gsGet(W.engrave_missing()) };
}

// The strokes to scale: cuts solid, moves between strokes dashed, the position marked.
function engPlot(s, lay) {
  const pts = lay.strokes.flat(), circ = +s.lay !== 0;
  const ax = s.x === '' ? 0 : snum(s.x), ay = s.y === '' ? 0 : snum(s.y), R = snum(s.radius);
  pts.push([ax, ay]);
  if (circ) { const a = (s.angle === '' ? 0 : snum(s.angle)) * Math.PI / 180; pts.push([ax + R * Math.cos(a), ay + R * Math.sin(a)]); }
  const Wd = 760, Hd = 300, f = gfit(pts, Wd, Hd, 26), P = f.P;
  let h = '';
  if (circ) { const c = P([ax, ay]); h += '<circle class="gm" id="engcirc" fill="none" stroke-dasharray="6 4" cx="' + c[0].toFixed(1) + '" cy="' + c[1].toFixed(1) + '" r="' + (R * f.k).toFixed(1) + '"/>'; }
  for (let i = 1; i < lay.strokes.length; i++) { const a = lay.strokes[i - 1], b = lay.strokes[i]; h += '<path class="grap" d="M' + gpt(P(a[a.length - 1])) + 'L' + gpt(P(b[0])) + '"/>'; }
  lay.strokes.forEach(st => { h += st.length > 1 ? '<path class="gc engs" fill="none" d="M' + st.map(p => gpt(P(p))).join('L') + '"/>' : '<circle class="gdot" cx="' + P(st[0])[0].toFixed(1) + '" cy="' + P(st[0])[1].toFixed(1) + '" r="1.6"/>'; });
  const o = P([ax, ay]);
  h += '<path class="gp" id="enganchor" d="M' + gpt([o[0] - 7, o[1]]) + 'L' + gpt([o[0] + 7, o[1]]) + 'M' + gpt([o[0], o[1] - 7]) + 'L' + gpt([o[0], o[1] + 7]) + '"/>';
  const st = P(lay.strokes[0][0]);
  h += '<circle class="gdot" cx="' + st[0].toFixed(1) + '" cy="' + st[1].toFixed(1) + '" r="3"/>';
  h += '<text class="gs" x="8" y="' + (Hd - 8) + '">XY plane, seen from +Z' + (+s.mirror ? ' (mirror image)' : '') + '</text>';
  return '<svg class="geo cyplot" id="engsvg" data-k="' + f.k + '" viewBox="0 0 ' + Wd + ' ' + Hd + '" role="img" aria-label="The engraving to scale" style="max-width:760px">' + h + '</svg>' +
    '<p class="ms"><span class="gkey gkp" style="border-color:var(--accent)"></span> engraved &nbsp; <span class="gkey" style="border-top:1px dashed var(--muted)"></span> lifted move &nbsp; cross = ' + (circ ? 'centre of the circle' : 'the position typed') + ' &nbsp; dot = start</p>';
}

function renderEngrave(el) {
  const defs = inch => ({ text: 'BENCHMATE', font: 'HersheySans1', h: inch ? 0.2 : 5, stretch: 100, spacing: '', line: '', lay: 0, align: 0, x: 0, y: 0, angle: 0, radius: inch ? 1 : 25, mirror: 0,
    vang: '', vflat: '', ctrl: 0, prog: 1001, tool: 1, wcs: 54, rpm: 10000, feed: inch ? 12 : 300, plunge: inch ? 4 : 100, zs: inch ? 0.1 : 2, depth: inch ? 0.005 : 0.1, cool: 0, rapid: '', arct: '' });
  const s = cyState('engrave', defs);
  const circ = x => +x.lay !== 0;
  const fields = [
    { k: 'text', label: 'Text (one or more lines)', area: 3 },
    { k: 'font', label: 'Letter style', sel: ENG_FONTS },
    { k: 'h', label: 'Letter height (capitals)', unit: cyU },
    { k: 'stretch', label: 'Letter width', unit: '%' },
    { k: 'spacing', label: 'Extra space between letters (blank = none)', unit: cyU },
    { k: 'line', label: 'Line pitch (blank = 1.5 x height)', unit: cyU },
    { k: 'lay', label: 'Layout', sel: [[0, 'Straight line'], [1, 'Round a circle, letter tops outward'], [2, 'Round a circle, letter tops inward']] },
    { k: 'align', label: 'The position is the', sel: [[0, 'start of the text'], [1, 'middle of the text'], [2, 'end of the text']] },
    { k: 'x', label: x => circ(x) ? 'Centre of the circle X' : 'Position X (foot of the letters)', unit: cyU },
    { k: 'y', label: x => circ(x) ? 'Centre of the circle Y' : 'Position Y (foot of the letters)', unit: cyU },
    { k: 'radius', label: 'Radius to the foot of the letters', unit: cyU, show: circ },
    { k: 'angle', label: x => circ(x) ? 'Where on the circle (0 = +X, 90 = +Y)' : 'Angle of the line of text (counter-clockwise from +X)', unit: 'deg' },
    { k: 'mirror', label: 'Mirror image (mould, stamp)', sel: [[0, 'No'], [1, 'Yes']] },
    { k: 'vang', label: 'Pointed cutter: included angle (optional)', unit: 'deg' },
    { k: 'vflat', label: 'Pointed cutter: tip flat (optional)', unit: cyU },
    ...commonHead(9),
    { k: 'wcs', label: 'Work offset', sel: [54, 55, 56, 57, 58, 59].map(n => [n, 'G' + n]) },
    { k: 'rpm', label: 'Spindle speed', unit: 'RPM' },
    { k: 'feed', label: 'Cutting feed', unit: () => feedMinU(state.sys) },
    { k: 'plunge', label: 'Plunge feed', unit: () => feedMinU(state.sys) },
    { k: 'depth', label: 'Depth below the surface', unit: cyU },
    { k: 'zs', label: 'Safe height above the surface', unit: cyU },
    { k: 'cool', label: 'Coolant', sel: [[1, 'On (M08)'], [0, 'Off']] },
    { k: 'arct', label: 'Curves as arcs (G02, G03) within (blank = straight lines, as the letters are drawn)', unit: cyU },
    rapidField,
  ];
  const labelOf = f => typeof f.label === 'function' ? f.label(s) : f.label;
  const draw = () => {
    el.innerHTML = '<div class="grid">' + fields.filter(f => !f.show || f.show(s)).map(f => cyField(Object.assign({}, f, { label: labelOf(f) }), s)).join('') + '</div>' +
      '<p class="desc" style="max-width:880px">The Hershey letters are drawn with straight lines (the O of the plain letters is 20 of them, at any size), and by default the program follows them line for line. Give a distance under "Curves as arcs" and each run of three or more lines that lies within it of one circle is written as a single G02 or G03 arc: fewer blocks and smoother motion, with every point and every line of the letter within that distance of the arc.</p>' +
      '<div id="engprev" style="margin-top:12px"></div><div id="cyout" style="margin-top:12px"></div>' +
      '<p class="desc" id="engcredit" style="max-width:880px;margin-top:14px">' + sesc(ENG_CREDIT) + ' The font files and their full use notice are in data/fonts/hershey.</p>';
    el.querySelectorAll('[data-k]').forEach(i => {
      i.oninput = i.onchange = () => {
        if (s[i.dataset.k] === i.value) return;
        s[i.dataset.k] = i.value;
        if (i.dataset.redraw) { const y = window.scrollY; draw(); window.scrollTo(0, y); } else calc();
      };
    });
    calc();
  };
  const calc = () => {
    if (!el.isConnected) return;
    const prev = el.querySelector('#engprev'), out = el.querySelector('#cyout'), W = state.W, dp = sdp(), u = cyU();
    const say = (box, t) => { box.innerHTML = '<div class="res">' + stable('Text', [[sesc(t), '', '']]) + '</div>'; };
    if (!engFont(s.font, calc)) { out.innerHTML = ''; say(prev, ENG.err || 'Loading the letters...'); return; }
    const lay = engLayout(s);
    if (lay.error) { out.innerHTML = ''; say(prev, lay.error); return; }
    const I = lay.info, f = v => fmt(v, dp);
    const rows = [
      ['Overall size, width x height', f(I(5) - I(3)) + ' x ' + f(I(6) - I(4)), u],
      ['Lower left corner X, Y', f(I(3)) + ', ' + f(I(4)), u],
      ['Upper right corner X, Y', f(I(5)) + ', ' + f(I(6)), u],
      ['Letters engraved', String(I(7)), ''],
      ['Strokes (the cutter goes down once for each)', String(I(0)), ''],
      ['Length engraved', f(I(1)), u],
      ['Length of the lifted moves between strokes', f(I(2)), u],
    ];
    if (lay.missing) rows.push(['Left out', sesc(lay.missing), '', 'This letter style has no shape for: ' + sesc(lay.missing.split('').join(' ')) + '. A gap is left where each would be.']);
    const va = snum(s.vang), vf = s.vflat === '' ? 0 : snum(s.vflat), dep = snum(s.depth);
    if (va > 0) {
      const w = W.engrave_v_width(dep, va, vf);
      rows.push(['Line width at this depth with the pointed cutter', isFinite(w) ? f(w) : 'n/a', isFinite(w) ? u : '', isFinite(w) ? '' : 'Enter a depth, an angle between 0 and 180 degrees and a tip flat of 0 or more.']);
    }
    prev.innerHTML = engPlot(s, lay) + '<div class="res" id="engres" style="margin-top:10px">' + stable('Text', rows) + '</div>' +
      '<div class="mfilter" style="margin-top:10px"><button class="btn" id="engsk" title="Opens the strokes as a drawing you can measure and change">Send to the sketcher</button><button class="btn" id="engdxf">Save DXF</button><button class="btn" id="engdxf12" title="For older programs that only read the R12 form">Save DXF (R12)</button></div>';
    const dxf = r12 => gsGet(W.engrave_dxf(cyInch() ? 0 : 1, r12));
    prev.querySelector('#engsk').onclick = () => { try { skImport(dxf(0), 'engraving'); openTool('sketch'); } catch (e) { toast(e.message); } };
    prev.querySelector('#engdxf').onclick = () => saveFile('engraving.dxf', dxf(0), 'application/dxf');
    prev.querySelector('#engdxf12').onclick = () => saveFile('engraving-r12.dxf', dxf(1), 'application/dxf');
    // the program
    const ok = W.engrave_program(gsPut(s.text), cyInch() ? 0 : 1, +s.ctrl, snum(s.prog), snum(s.tool), +s.wcs, snum(s.rpm), snum(s.feed), snum(s.plunge), snum(s.zs), dep, +s.cool, s.arct === '' ? 0 : snum(s.arct)) === 1;
    const res = cyRead(ok, 9);
    cyOutput(out, s, res, { lathe: false, plot: () => '', more: [['engsim', 'Open in the simulator', () => gsOpenText(res.text)]] });
  };
  draw();
}
