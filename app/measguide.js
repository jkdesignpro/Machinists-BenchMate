// Measurement guide (parity MH75, MH78, MH87, MH92, MH94, MH184, ED12, BB38; parts of MH90, MH93, MH95).
// All wording and drawings are BenchMate's own. Every statement carries the keys of the public sources read for
// it (docs/sources.md, "Measurement guide"); one with fewer than two independent publishers is shown as "to be
// verified". Where two sources give different figures both are shown.
'use strict';

const MZ_SOURCES = {
  WTCS: 'WisTech Open, Blueprint Reading, chapter on tolerances (open textbook, CC BY 4.0), 2025',
  MGT: 'Machinist Guides, "Types of tolerances"',
  FRAC: 'Fractory, "Limits and fits" (text only; its table could not be read as printed)',
  AMES: 'Amesweb, "Preferred fits and tolerance table for hole and shaft basis systems" (cites ISO 286-1:2010 and ANSI B4.2-1978)',
  EE: 'Engineers Edge, "Preferred tolerances and fits, metric, ISO 286"',
  STAR: 'L. S. Starrett, "Precision granite: frequently asked questions"',
  QM_SP: 'Quality Magazine, "Keep granite surface plates calibrated" (repeats the maker\'s text, so it counts with STAR)',
  MITU_SP: 'Mitutoyo America, quick guide to surface plate flatness (document 15004A; text only)',
  TRAV: 'Travers Tool, "How to use 1-2-3 blocks"',
  QM_MIC: 'Quality Magazine, "Quality 101: calibrating micrometers"',
  MITU_MIC: 'Mitutoyo America, hand-out "Common mistakes in dimensional calibration methods"',
  MITU_CAL: 'Mitutoyo America, quick guide to caliper calibration (document 15003A; text only)',
  MGC: 'Machinist Guides, "Complete guide to measuring caliper calibration"',
  FAB: 'Fabrico blog, "Shaft runout (TIR) measurement"',
  ACOEM: 'Acoem USA at CBM Connect, "Shaft alignment 101: runout", 2024-07-03',
  MFAQ: 'Machining FAQ (readthedocs, MIT LEAP group), "How do I inspect for concentricity?"',
  GDTB: 'GD&T Basics, article on surface finish (text only; its symbol charts are images)',
  WEV_SF: 'Wevolver, "Surface finish symbols: how to read a drawing callout"',
  DS: 'Digital Surf, Surface metrology guide, "Indication of surface texture"',
  OWN: 'BenchMate reading of the rule in the sources beside it',
};
// Several pages of one publisher count once. The Quality Magazine article on surface plates repeats Starrett's text.
const MZ_FAMILY = { QM_SP: 'STARRETT', STAR: 'STARRETT', MITU_SP: 'MITUTOYO', MITU_MIC: 'MITUTOYO', MITU_CAL: 'MITUTOYO', MGT: 'MACHG', MGC: 'MACHG' };
const mzTags = keys => guideTags(keys, MZ_SOURCES, MZ_FAMILY);
const mzP = (html, keys) => '<p>' + html + (keys === null ? '' : ' ' + mzTags(keys)) + '</p>';

// Four ways to write a tolerance on the same 2.000 dimension, as zones on one scale (0.001 = 20 px).
function mzTol() {
  const x = v => 260 + (v - 2) * 20000;
  const row = (y, t, lo, hi) => cnT(14, y + 4, t, 'gs') + '<path class="gfill" d="M' + x(lo) + ' ' + (y - 6) + 'H' + x(hi) + 'V' + (y + 6) + 'H' + x(lo) + 'Z"/><path class="gp" d="M' + x(lo) + ' ' + (y - 6) + 'H' + x(hi) + 'V' + (y + 6) + 'H' + x(lo) + 'Z"/>';
  const tick = v => '<path class="gm" d="M' + x(v) + ' 122V128"/>' + cnT(x(v), 142, v.toFixed(3), 'gs', 'middle');
  return cnSvg(460, 150,
    '<path class="gk" d="M260 14V124"/>' +
    row(30, '2.002 over 1.998', 1.998, 2.002) + row(56, '2.000 ±0.002', 1.998, 2.002) + row(82, '2.000 +0.001 −0.002', 1.998, 2.001) + row(108, '2.000 +0 −0.005', 1.995, 2.000) +
    '<path class="gm" d="M150 122H320"/>' + tick(1.995) + tick(1.998) + tick(2) + tick(2.002),
    'Four ways to write a tolerance on a 2.000 dimension, drawn as zones on one scale: limits 2.002 over 1.998 and 2.000 plus or minus 0.002 both allow 1.998 to 2.002; 2.000 plus 0.001 minus 0.002 allows 1.998 to 2.001; 2.000 plus 0 minus 0.005 allows 1.995 to 2.000');
}
// A shaft in two V-blocks on a surface plate with a dial indicator at mid span.
function mzRunout() {
  const vb = x => '<path class="gfill" d="M' + (x - 22) + ' 140V110H' + (x - 9) + 'L' + x + ' 119L' + (x + 9) + ' 110H' + (x + 22) + 'V140Z"/><path class="gp" d="M' + (x - 22) + ' 140V110H' + (x - 9) + 'L' + x + ' 119L' + (x + 9) + ' 110H' + (x + 22) + 'V140Z"/>' + cnT(x, 156, 'V-block', 'gs', 'middle');
  return cnSvg(460, 166,
    '<path class="gm" d="M20 140H440"/>' +
    '<path class="gp" d="M238 48H292V140M276 140H308"/>' +
    vb(100) + vb(340) +
    '<path class="gfill" d="M50 94H390V114H50Z"/><path class="gp" d="M50 94H390V114H50Z"/><path class="gk" d="M40 104H400"/>' +
    '<path class="gc" d="M220 94V66"/><circle class="gfill" cx="220" cy="48" r="18"/><circle class="gp" cx="220" cy="48" r="18"/><path class="gw" d="M220 48L231 38"/>' +
    cnT(194, 30, 'dial indicator,', 'gs', 'end') + cnT(194, 44, 'square to the shaft', 'gs', 'end') +
    cnT(450, 30, 'turn the shaft once by hand', 'gs', 'end') + cnT(450, 44, 'TIR = highest − lowest', 'gs', 'end') +
    cnT(220, 132, 'surface plate', 'gs', 'middle'),
    'Checking a shaft for runout: the shaft rests in two V-blocks on a surface plate, a dial indicator stands square to it at mid span, the shaft is turned once by hand, and the total indicator reading is the highest reading minus the lowest');
}
// The three basic surface texture symbols.
function mzSym() {
  const chk = cx => '<path class="gp" d="M' + (cx - 14) + ' 44L' + cx + ' 68L' + (cx + 28) + ' 20"/><path class="gm" d="M' + (cx - 40) + ' 68H' + (cx + 40) + '"/>';
  const cap = (cx, a, b) => cnT(cx, 90, a, 'gs', 'middle') + (b ? cnT(cx, 104, b, 'gs', 'middle') : '');
  return cnSvg(460, 114,
    chk(80) + cap(80, 'any process') +
    chk(230) + '<path class="gp" d="M216 44H244"/>' + cap(230, 'material removal', 'required') +
    chk(380) + '<circle class="gp" cx="380" cy="55" r="6"/>' + cap(380, 'material removal', 'not permitted'),
    'The three basic surface texture symbols, each a check mark standing on the surface: plain, any process is allowed; with a bar closing the V, material removal is required; with a circle in the V, material removal is not permitted');
}

const MZ_TOL = [
  ['Limits', '2.002 over 1.998', '1.998 to 2.002', ['WTCS', 'MGT']],
  ['Equal bilateral', '2.000 ±0.002', '1.998 to 2.002', ['WTCS', 'MGT']],
  ['Unequal bilateral', '2.000 +0.001 −0.002', '1.998 to 2.001', ['WTCS', 'MGT']],
  ['Unilateral', '2.000 +0 −0.005', '1.995 to 2.000', ['WTCS', 'MGT']],
];
const MZ_FITS = [
  ['H11/c11', 'C11/h11', 'loose running', 'where wide tolerances are good enough, as on outside members', ['AMES', 'EE']],
  ['H9/d9', 'D9/h9', 'free running', 'running fits where accuracy is not the point: large temperature swings, high speed, heavy journal loads', ['AMES', 'EE']],
  ['H8/f7', 'F8/h7', 'close running', 'running fits on accurate machines at moderate speed and load, and accurate location', ['AMES', 'EE']],
  ['H7/g6', 'G7/h6', 'sliding', 'parts that must slide and turn freely and still locate well; not for continuous running', ['AMES', 'EE']],
  ['H7/h6', 'H7/h6', 'locational clearance', 'a snug fit that locates parts which do not move, easy to assemble and take apart', ['AMES', 'EE']],
  ['H7/k6', 'K7/h6', 'locational transition', 'accurate location, half way between clearance and interference', ['AMES', 'EE']],
  ['H7/n6', 'N7/h6', 'locational transition', 'more accurate location, where more interference can be accepted', ['AMES', 'EE']],
  ['H7/p6', 'P7/h6', 'locational interference', 'parts that must be rigid and in line and located very accurately, with no particular pressure needed in the bore', ['AMES', 'EE']],
  ['H7/s6', 'S7/h6', 'medium drive', 'ordinary steel parts and shrink fits on light sections; the tightest fit cast iron will take', ['AMES', 'EE']],
  ['H7/u6', 'U7/h6', 'force', 'parts that can take high stress, and shrink fits where pressing would need too much force', ['AMES', 'EE']],
];
const MZ_SYM = [
  ['Plain check mark', 'any manufacturing process is allowed', ['WEV_SF', 'DS']],
  ['Bar closing the V', 'material removal is required', ['WEV_SF', 'DS']],
  ['Circle in the V', 'material removal is not permitted: the surface stays as it was formed', ['WEV_SF', 'DS']],
];
const MZ_LAY = [
  ['=', 'parallel to the projection plane of the view the symbol is in', ['WEV_SF', 'DS']],
  ['⊥', 'perpendicular to it', ['WEV_SF', 'DS']],
  ['X', 'crossed, in two slanting directions', ['WEV_SF', 'DS']],
  ['M', 'multidirectional', ['WEV_SF', 'DS']],
  ['C', 'roughly circular about the centre of the surface', ['WEV_SF', 'DS']],
  ['R', 'roughly radial from the centre of the surface', ['WEV_SF', 'DS']],
  ['P', 'particulate: no direction, or standing proud', ['WEV_SF', 'DS']],
];

function renderMeasGuide(el) {
  const toc = [['mz-tol', 'Writing a tolerance'], ['mz-fit', 'Preferred fits'], ['mz-plate', 'Surface plates'], ['mz-mic', 'Checking micrometers and calipers'], ['mz-shaft', 'Shaft runout'], ['mz-surf', 'Surface texture symbols']];
  el.innerHTML =
    '<nav class="gtoc">' + toc.map(([a, t]) => '<a href="#' + a + '">' + t + '</a>').join('') + '</nav>' +
    '<p class="desc">Inspection practice in our own words: the ways a tolerance is written, the ten preferred metric fits, surface plates and their care, checking a micrometer and a caliper against gauge blocks, checking a shaft for runout, and the surface texture symbols on a drawing. The small grey keys after each statement name the public sources it was checked against (list at the bottom). <span class="gtbv">to be verified</span> marks a statement not yet confirmed by two independent publishers.</p>' +

    '<h2 id="mz-tol">Ways to write a tolerance</h2>' + mzTol() +
    guideTable(['Kind', 'Written', 'Allows'], MZ_TOL, mzTags) +
    mzP('<b>Limit dimensions</b> give the largest and the smallest size directly, with no arithmetic left to do.', ['WTCS', 'MGT']) +
    mzP('<b>Which limit on top.</b> The high limit is written above the low one.', ['WTCS']) +
    mzP('<b>A unilateral tolerance</b> lets the size vary in one direction only from the stated size.', ['WTCS', 'MGT']) +
    mzP('<b>A bilateral tolerance</b> lets it vary both ways, by the same amount (equal) or by different amounts (unequal).', ['WTCS', 'MGT']) +
    mzP('<b>No tolerance on the dimension.</b> It takes the tolerance from the tolerance block of the drawing, which sets one for each kind of dimension or number of decimal places.', ['WTCS']) +
    mzP('<b>Maximum and least material.</b> Maximum material condition is the size with the most material: the largest shaft, the smallest hole. Least material condition is the opposite.', ['WTCS']) +
    mzP('Geometric tolerances are explained in the <a href="#/t/gdtguide">GD&amp;T guide</a>; how tolerances add up along a chain is worked out in the <a href="#/t/gdtstack">tolerance stack</a>.', null) +

    '<h2 id="mz-fit">Fits and the ten preferred fits</h2>' +
    mzP('<b>Three kinds of fit.</b> Clearance: the shaft is always smaller than the hole. Interference: the shaft is larger than the hole, so the parts are forced or shrunk together. Transition: either can come out, even within one batch.', ['FRAC', 'AMES']) +
    mzP('<b>Hole basis and shaft basis.</b> On the hole basis the hole is kept the same and the shaft is made to give the fit; on the shaft basis it is the other way round.', ['FRAC', 'AMES']) +
    '<p class="desc">The preferred fits, from loosest to tightest. The first five are clearance fits, the next two transition fits and the last three interference fits:</p>' +
    guideTable(['Hole basis', 'Shaft basis', 'Name', 'For'], MZ_FITS, mzTags) +
    mzP('<b>Putting them together.</b> Transition fits go together with a soft mallet or light force. Interference fits are pressed, and the tightest need the hole heated or the shaft cooled.', ['FRAC']) +
    mzP('The limits of any hole and shaft class are in <a href="#/t/fits">ISO limits and fits</a>, inch fits in <a href="#/t/ansifits">ANSI standard fits</a>, and the heating needed in <a href="#/t/shrinkfit">shrink and press fits</a>.', null) +

    '<h2 id="mz-plate">Surface plates</h2>' +
    mzP('<b>Three grades.</b> AA is the most accurate, A the middle grade and B the least accurate.', ['MITU_SP', 'STAR']) +
    mzP('<b>Grade names and the flatness rule.</b> AA is the laboratory grade, A the inspection grade and B the tool room grade. The flatness of grade AA in millionths of an inch is 40 plus the square of the diagonal in inches divided by 25. Grade A is allowed twice that and grade B four times.', ['STAR', 'QM_SP']) +
    mzP('<b>Overall flatness.</b> Every point of the surface lies between two parallel planes; the distance between the planes is the flatness.', ['STAR', 'MITU_SP']) +
    mzP('<b>Repeat reading.</b> A second, tighter figure for local flatness, checked with a repeat reading gauge moved over the plate. A plate has to meet both figures.', ['STAR', 'MITU_SP']) +
    mzP('<b>Why granite.</b> One maker points to its mass, stiffness and hardness; another says it does not rust, raises no hump when it is nicked, expands little with heat and is not magnetic.', ['MITU_SP', 'STAR']) +
    mzP('<b>What wears a plate.</b> Abrasive dust from the air, mostly. Keep the plate clean, and covered when it is not in use.', ['STAR', 'QM_SP']) +
    mzP('<b>Spread the wear.</b> Turn the plate round from time to time so that one area does not take all the work, and use carbide pads, not steel ones, on gauges that slide on it.', ['STAR', 'QM_SP']) +
    mzP('<b>Food and drink</b> stay off the plate: the acid in soft drinks pits the surface.', ['STAR', 'QM_SP']) +
    mzP('<b>After cleaning.</b> Solvents and water-based cleaners chill the surface. Let the plate come back to temperature before measuring: about an hour for a small plate and two for a large one.', ['STAR']) +
    mzP('<b>Three supports.</b> A plate rests on three points only, placed where the maker set them, about a fifth of the length in from the ends. More supports bend the plate. A plate supported this way does not have to be levelled to be accurate.', ['STAR', 'QM_SP']) +
    mzP('<b>How often to calibrate.</b> A new plate within a year, a plate in heavy use every six months, and a monthly check of repeat readings in between.', ['STAR', 'QM_SP']) +
    mzP('<b>Temperature.</b> On a 36 by 48 by 8 in plate, one degree Fahrenheit of difference between top and bottom takes the surface from 0.000075 in to 0.000275 in convex.', ['STAR']) +
    mzP('<b>1-2-3 blocks</b> are hardened steel blocks of 1 by 2 by 3 in, ground on all six faces. They serve as parallels, as known heights of 1, 2 and 3 in, and bolted together as an angle plate. They are not a calibrated standard for checking a measuring tool.', ['TRAV']) +
    mzP('Parallels and angle plates are in the <a href="#/t/workholding">workholding guide</a>; setting an angle on the plate is in <a href="#/t/sinebar">sine bar</a>.', null) +

    '<h2 id="mz-mic">Checking micrometers and calipers</h2>' +
    mzP('<b>The standard.</b> Whatever a tool is checked against should be at least four times more accurate than the tool.', ['QM_MIC', 'MGC', 'MITU_CAL']) +
    mzP('<b>Micrometer, look first.</b> Check the frame for signs of a drop and the faces for dirt, pits and a frosted look, which means wear. Run the spindle through its whole travel: it must turn smoothly everywhere, and it must not be forced.', ['QM_MIC']) +
    mzP('<b>Micrometer faces.</b> The anvil and spindle faces have to be flat.', ['QM_MIC', 'MITU_MIC']) +
    mzP('<b>Flat and parallel, in figures.</b> Checked with an optical parallel, the faces are held to under 12 millionths of an inch for flatness and under 40 millionths for parallelism.', ['MITU_MIC']) +
    mzP('<b>Micrometer, five points with gauge blocks.</b> The points differ by source: 0.0625, 0.125, 0.250, 0.500 and 1.000 in in one; 0.210, 0.420, 0.605, 0.815 and 1.000 in in the other.', ['QM_MIC', 'MITU_MIC']) +
    mzP('<b>Sizes you measure every day</b> are worth adding to the check.', ['QM_MIC']) +
    mzP('<b>Caliper jaws.</b> Look at the measuring faces for wear and damage before anything else.', ['MGC', 'MITU_CAL']) +
    mzP('<b>Against the light.</b> Close the outside jaws and hold them up to a light: worn or misaligned jaws show a gap. Closed, the caliper should read zero.', ['MGC']) +
    mzP('<b>Caliper, outside jaws.</b> Check with gauge blocks over the whole range. One source asks for three to five points covering at least 90 % of the range; the other prefers odd sizes such as 0.754 in to round ones.', ['MITU_CAL', 'MGC']) +
    mzP('<b>Along the jaw.</b> Put the block at different places on the jaws, from close to the beam to near the tips.', ['MITU_CAL']) +
    mzP('<b>Inside jaws and depth rod.</b> Check each of them as well, at one point or more.', ['MITU_CAL', 'MGC']) +
    mzP('<b>With what.</b> Inside jaws against a ring gauge or gauge blocks of 20 to 50 mm; depth and step against a gauge block standing on a surface plate.', ['MITU_CAL']) +
    mzP('<b>Dial calipers.</b> Choose sizes that bring the pointer to different places round the dial.', ['MITU_CAL']) +
    mzP('<b>How often.</b> Every three to four months for a tool in critical, daily use; once a year for one seldom used.', ['MGC']) +
    mzP('Reading a vernier and a micrometer thimble is practised in <a href="#/t/scales">reading scales</a>; what a temperature difference does to a measurement is in <a href="#/t/tempcomp">temperature compensation</a>.', null) +

    '<h2 id="mz-shaft">Checking a shaft for runout</h2>' + mzRunout() +
    mzP('<b>Runout</b> is how far a surface moves against a fixed point while the shaft is turned once.', ['FAB', 'ACOEM']) +
    mzP('<b>Total indicator reading (TIR)</b> is the highest reading minus the lowest over one full turn.', ['FAB', 'ACOEM']) +
    mzP('<b>Support.</b> Hold the shaft the way it runs: in its own bearings, in V-blocks under the journals, or between centres. Clean off burrs and oil first.', ['FAB']) +
    mzP('<b>Indicator.</b> Fix it rigidly with the plunger square to the surface. The preload differs: a quarter to a third of the travel in one source, half the travel in the other.', ['FAB', 'ACOEM']) +
    mzP('<b>Turn and read.</b> Turn the shaft through one full turn and note the highest and the lowest reading.', ['FAB', 'ACOEM']) +
    mzP('<b>Check the reading.</b> Mark where you started; the needle should come back to its starting value there. Measure at three places or more along the shaft.', ['FAB']) +
    mzP('<b>Half the reading.</b> The surface is off the axis by half the TIR: 0.08 mm TIR is 0.04 mm off centre.', ['FAB']) +
    mzP('<b>A bent shaft</b> reads near zero at the journals and most at mid span, with the high spot at the same angle all along.', ['FAB']) +
    mzP('<b>Shaft or coupling.</b> When a coupling hub runs out, measure on the shaft beside it. If the shaft reading accounts for the hub reading, the shaft is bent; if the shaft runs true, the hub is bored off centre or its bore is larger than the shaft.', ['ACOEM']) +
    mzP('<b>Radial and face runout.</b> Radial runout is read on a diameter, with the plunger square to the axis. Face runout is read on a face, with the plunger along the axis, and shows a face that is not square.', ['FAB', 'ACOEM']) +
    mzP('<b>How much is too much.</b> The maker\'s figure decides. Without one, one source calls 0.002 in or less usual; the other works to about 0.05 mm TIR at 1500 rpm and 0.025 mm at 3000 rpm and above.', ['ACOEM', 'FAB']) +
    mzP('<b>Concentricity</b> is hard to measure directly without a coordinate measuring machine; runout stands in for it as long as the part is round.', ['MFAQ']) +
    mzP('What runout does to a cutter is worked out in <a href="#/t/runout">runout and chip load</a>; runout as a drawing tolerance is in the <a href="#/t/gdtguide">GD&amp;T guide</a>.', null) +

    '<h2 id="mz-surf">Surface texture on the drawing</h2>' + mzSym() +
    guideTable(['Symbol', 'Meaning'], MZ_SYM, mzTags) +
    mzP('<b>Lay</b> is the direction of the main pattern on the surface, which the manufacturing process leaves.', ['GDTB', 'WEV_SF']) +
    mzP('<b>Roughness and waviness.</b> Roughness is the fine, closely spaced irregularity of the surface; waviness is the variation with the widest spacing.', ['GDTB']) +
    '<p class="desc">The lay symbols:</p>' + guideTable(['Symbol', 'The lay is'], MZ_LAY, mzTags) +
    mzP('<b>Where things go, new standard.</b> In ISO 21920-1 the process is written above the line on the left and the lay on the right; the parameter with its value goes below the line.', ['WEV_SF']) +
    mzP('<b>Three profiles.</b> The first letter of a parameter names the profile it is taken from: P the primary profile, R roughness, W waviness.', ['DS']) +
    mzP('<b>Defaults.</b> The default filter settings are a cut-off of 0.8 mm and a short-wave filter of 2.5 micrometres. A default may be left off the drawing; it still applies when the surface is measured.', ['DS']) +
    mzP('<b>Accepting a surface.</b> Under the older rule up to one reading in six may exceed the limit (the 16 % rule). ISO 21920-1 makes the maximum rule the default instead.', ['DS']) +
    mzP('Ra values, N grades and typical finishes by process are in <a href="#/t/surface">surface texture</a>; the finish a feed and nose radius give is in <a href="#/t/finish">surface finish from nose radius</a>.', null) +

    '<h2 id="mz-src">Sources</h2><ul class="gsl">' + Object.entries(MZ_SOURCES).map(([k, v]) => '<li><b>' + k + '</b> ' + gesc(v) + '</li>').join('') + '</ul>' +
    '<p class="desc">Full URLs and access dates are in docs/sources.md, "Measurement guide". No text, figures or tables were copied from the sources.</p>';
  guideToc(el);
}
