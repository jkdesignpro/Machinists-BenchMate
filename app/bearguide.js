// Bearings and seals guide (parity MH283, MH284, ED66, ED67, ED71, MH293, BB59).
// All wording and drawings are BenchMate's own. Every statement carries the keys of the public sources read for
// it (docs/sources.md, "Bearings and seals guide"); one with fewer than two independent publishers is shown as
// "to be verified". Where two sources give different figures both are shown.
'use strict';

const BG_SOURCES = {
  RSOL: 'Reliability Solutions, "Rolling element bearing types"',
  RD: 'RapidDirect blog, "Types of bearings: features and uses"',
  NSK_T: 'NSK, Bearing ABCs, "Types of rolling bearings"',
  KOYO: 'JTEKT (Koyo), Bearing knowledge, "Bearing number"',
  NPTC: 'NPTC Group of Colleges, hand-out "Bearing number table" (no author or date)',
  NSK_D: 'NSK Europe, Technical Insight TI/E/0111, boundary dimensions and bearing designations',
  SOCO: 'Southern Cross Bearings (soco.co.nz), "Bearing numbers explained"',
  WP_ABEC: 'Wikipedia, "ABEC scale" (CC BY-SA)',
  NSK_C: 'NSK Europe, Technical Insight TI/E/0112, tolerances and accuracy classes of rolling bearings',
  NHBB: 'NHBB (New Hampshire Ball Bearings), engineering reference, "Shaft and housing fits"',
  NRB: 'NRB Bearings blog, "Shaft and housing tolerances"',
  MINEBEA: 'MinebeaMitsumi, ball bearing catalogue pages on fits',
  TFL: 'TFL Bearing, "Bearing fits explained: how to choose shaft and housing tolerances"',
  PROC: 'Processing Magazine, D. Juchniewicz (SKF USA), "How to properly mount bearings", 2014-10-15',
  FAB: 'Fabrico blog, "Bearing installation"',
  SCH: 'Schaeffler, mounting handbook extract MH 1, "Thermal mounting"',
  SEALS: 'Seals-Shop GmbH, installation guide "Radial oil seals"',
  IMA: 'University of Stuttgart, Institute of Machine Components, TechSheet 104170, "Optimal shaft counterfaces for radial shaft seals: plunge grinding"',
  PERMA: 'Permabond, "What do the threadlocker colors mean?"',
  FE: 'Fastener Engineering, S. Ay (Hernon Manufacturing), "A guide to choosing and using threadlockers"',
  AIMS_TL: 'AIMS Industrial, "Thread locking & sealing: Loctite, PTFE & anaerobic sealant guide", 2026-09-29',
  INC_RC: 'Incure Inc., "Threadlockers vs. retaining compounds: a manufacturer\'s guide", 2025-07-19',
  INC_TS: 'Incure Inc., "The industrial professional\'s guide to thread sealants", 2025-12-08',
  INC_FS: 'Incure Inc., "Flange sealing methods: a comprehensive guide for manufacturers", modified 2026-08-30',
  MD_SA: 'Machine Design, S. Loushin (3M), "Choosing and using structural adhesives", 2016-12-01',
  GG_SA: 'Gluegun.com, "How to choose a structural adhesive", 2026-02-09',
  APPLE_BU: 'Apple Rubber, seal design guide, "Use of backup rings"',
  MARCO_BU: 'Marco Rubber, "Back-up O-rings"',
  FPW_BU: 'P. Heney, Fluid Power World, "Backup rings help prevent O-ring migration", 2017-05-05',
  OWN: 'BenchMate arithmetic on the rule in the sources beside it',
};
// Several documents of one publisher count once.
const BG_FAMILY = { NSK_T: 'NSK', NSK_D: 'NSK', NSK_C: 'NSK', INC_RC: 'INCURE', INC_TS: 'INCURE', INC_FS: 'INCURE' };
const bgTags = keys => guideTags(keys, BG_SOURCES, BG_FAMILY);
const bgP = (html, keys) => '<p>' + html + (keys === null ? '' : ' ' + bgTags(keys)) + '</p>';
const bgBox = d => '<path class="gfill" d="' + d + '"/><path class="gp" d="' + d + '"/>';

// The number 6205-2RS C3 taken apart.
function bgNumber() {
  const box = (x, t, fill) => (fill ? '<path class="gfill" d="M' + x + ' 30H' + (x + 60) + 'V66H' + x + 'Z"/>' : '') + '<path class="gp" d="M' + x + ' 30H' + (x + 60) + 'V66H' + x + 'Z"/>' + cnT(x + 30, 53, t, 'gv', 'middle');
  const under = (cx, lines) => lines.map((t, i) => cnT(cx, 86 + 14 * i, t, 'gs', 'middle')).join('');
  return cnSvg(440, 136,
    cnT(218, 18, 'bearing number 6205-2RS C3', 'gs', 'middle') +
    box(20, '6', true) + box(104, '2', false) + box(188, '05', true) + box(272, '2RS', false) + box(356, 'C3', false) +
    under(50, ['type:', 'deep groove', 'ball']) + under(134, ['series:', 'light']) + under(218, ['bore:', '05 × 5', '= 25 mm']) + under(302, ['rubber seal', 'on both', 'sides']) + under(386, ['clearance', 'larger than', 'normal']),
    'The bearing number 6205-2RS C3 taken apart: 6 is a single-row deep groove ball bearing, 2 is the light series, 05 times 5 gives a bore of 25 mm, 2RS is a contact rubber seal on both sides, and C3 is an internal clearance larger than normal');
}
// Half section of a bearing on a turning shaft: tight on the shaft, sliding in the housing.
function bgFit() {
  return cnSvg(500, 170,
    bgBox('M110 14H230V42H110Z') + bgBox('M40 110H232V150H40Z') +
    '<path class="gp" d="M140 42H200V62H140ZM140 90H200V110H140Z"/><circle class="gp" cx="170" cy="76" r="14"/>' +
    '<path class="gk" d="M30 150H242"/>' +
    '<path class="gc" d="M140 42H200"/><path class="gw" d="M140 110H200"/>' +
    cnT(246, 34, 'outer ring in the housing:', 'gs') + cnT(246, 48, 'sliding fit, the ring stands still', 'gs') +
    cnT(246, 104, 'inner ring on the shaft:', 'gs') + cnT(246, 118, 'tight fit, the ring turns', 'gs') +
    cnT(14, 34, 'steady load,', 'gs') + cnT(14, 48, 'shaft turns', 'gs') +
    cnT(170, 166, 'shaft', 'gs', 'middle') + cnT(170, 32, 'housing', 'gs', 'middle'),
    'Half section of a ball bearing on a turning shaft under a steady load: the inner ring turns with the shaft and has a tight fit on it; the outer ring stands still and has a sliding fit in the housing');
}
// Pressing a bearing on to a shaft: through the inner ring (right) and through the outer ring (wrong).
function bgMount() {
  const pan = (ox, r1, r2) => {
    const ring = (y1, y2) => 'M' + (ox + 90) + ' ' + y1 + 'H' + (ox + 114) + 'V' + y2 + 'H' + (ox + 90) + 'Z';
    return bgBox('M' + (ox + 20) + ' 60H' + (ox + 150) + 'V90H' + (ox + 20) + 'Z') +
      '<path class="gp" d="' + ring(25, 35) + ring(49, 60) + ring(90, 101) + ring(115, 125) + '"/>' +
      '<circle class="gp" cx="' + (ox + 102) + '" cy="42" r="7"/><circle class="gp" cx="' + (ox + 102) + '" cy="108" r="7"/>' +
      bgBox('M' + (ox + 114) + ' ' + r1 + 'H' + (ox + 198) + 'V' + (150 - r1) + 'H' + (ox + 114) + 'V' + (150 - r2) + 'H' + (ox + 190) + 'V' + r2 + 'H' + (ox + 114) + 'Z') +
      '<path class="gc" d="M' + (ox + 226) + ' 75H' + (ox + 204) + 'M' + (ox + 204) + ' 75l6 -4M' + (ox + 204) + ' 75l6 4"/>' +
      '<path class="gk" d="M' + (ox + 12) + ' 75H' + (ox + 200) + '"/>';
  };
  return cnSvg(480, 150,
    cnT(110, 14, 'right', 'gv', 'middle') + cnT(350, 14, 'wrong', 'gv', 'middle') +
    pan(0, 49, 60) + pan(240, 25, 35) +
    '<path class="gw" d="M354 30L342 42L330 55M354 120L342 108L330 95"/>' +
    cnT(110, 144, 'sleeve on the ring being fitted', 'gs', 'middle') + cnT(350, 144, 'the force crosses the balls', 'gs', 'middle'),
    'Pressing a bearing on to a shaft. Right: the sleeve bears on the inner ring, the ring that is being fitted to the shaft. Wrong: the sleeve bears on the outer ring, so the pressing force passes through the balls into the inner ring');
}

const BG_TYPE = [
  ['Deep groove ball', 'Mainly radial load', 'High speeds; tolerates little misalignment', ['RSOL', 'RD', 'NSK_T']],
  ['Angular contact ball', 'Radial and axial load together', 'High speeds', ['RSOL', 'RD']],
  ['Self-aligning ball', 'Mainly radial load', 'Takes up misalignment of the shaft', ['RSOL', 'RD', 'NSK_T']],
  ['Cylindrical roller', 'Heavy radial load, some axial load at most', 'Misalignment loads the ends of the rollers', ['RSOL', 'RD', 'NSK_T']],
  ['Needle roller', 'Heavy radial load in a small section height', 'Thin rollers', ['RSOL', 'RD']],
  ['Tapered roller', 'Heavy radial and axial load together', 'Used in gearboxes', ['RSOL', 'RD']],
  ['Spherical roller', 'Very heavy loads', 'Takes up misalignment of the shaft', ['RSOL', 'RD']],
  ['Thrust ball', 'Axial load only', 'Made for one direction or for both', ['RSOL', 'RD', 'NSK_T']],
  ['Spherical roller thrust', 'Heavy axial load with some radial load', 'The one thrust bearing that also takes radial load', ['RD', 'NSK_T']],
];
const BG_CODE = [
  ['1', 'Self-aligning ball bearing', ['KOYO', 'NPTC', 'NSK_D']],
  ['2', 'Spherical roller bearing', ['KOYO', 'NPTC', 'NSK_D']],
  ['3', 'Tapered roller bearing; also double-row angular contact ball bearing', ['KOYO', 'NPTC', 'NSK_D']],
  ['4', 'Double-row deep groove ball bearing', ['KOYO', 'NPTC']],
  ['5', 'Thrust ball bearing', ['KOYO', 'NPTC', 'NSK_D']],
  ['6', 'Single-row deep groove ball bearing', ['KOYO', 'NPTC', 'NSK_D', 'SOCO']],
  ['7', 'Single-row angular contact ball bearing', ['KOYO', 'NPTC', 'NSK_D']],
  ['N, NU, NN', 'Cylindrical roller bearing (NN: double row)', ['KOYO', 'NPTC', 'NSK_D']],
  ['NA', 'Needle roller bearing', ['KOYO', 'NPTC', 'NSK_D']],
];
const BG_SUF = [
  ['Z, ZZ (also 2Z)', 'Metal shield on one side, on both sides', ['KOYO', 'NPTC', 'NSK_D', 'SOCO']],
  ['RS, 2RS', 'Contact rubber seal on one side, on both sides', ['KOYO', 'NPTC', 'SOCO']],
  ['DU, DDU', 'Contact rubber seal on one side, on both sides (NSK)', ['NSK_D', 'NPTC']],
  ['V, VV', 'Non-contact rubber seal on one side, on both sides (NSK)', ['NSK_D', 'NPTC']],
  ['C2', 'Internal clearance smaller than normal', ['KOYO', 'NPTC', 'NSK_D']],
  ['CN (usually not marked)', 'Normal internal clearance', ['KOYO', 'NPTC', 'NSK_D']],
  ['C3', 'Internal clearance larger than normal', ['KOYO', 'NPTC', 'NSK_D', 'SOCO']],
  ['C4', 'Internal clearance larger than C3', ['KOYO', 'NPTC', 'NSK_D']],
  ['NR', 'Snap ring groove in the outer ring, with its snap ring', ['KOYO', 'NPTC']],
  ['M', 'Brass cage', ['NPTC', 'SOCO']],
  ['P6, P5, P4, P2', 'Tolerance class finer than normal', ['KOYO', 'NSK_D']],
  ['K', 'Tapered bore, 1:12', ['KOYO']],
  ['DB, DF, DT', 'Matched pair: back to back, face to face, tandem', ['KOYO']],
];
const BG_CLASS = [
  ['Normal', 'P0', 'ABEC 1', ['WP_ABEC', 'NSK_C']],
  ['Class 6', 'P6', 'ABEC 3', ['WP_ABEC', 'NSK_C']],
  ['Class 5', 'P5', 'ABEC 5', ['WP_ABEC', 'NSK_C']],
  ['Class 4', 'P4', 'ABEC 7', ['WP_ABEC', 'NSK_C']],
  ['Class 2', 'P2', 'ABEC 9', ['WP_ABEC', 'NSK_C']],
];
const BG_FIT = [
  ['Inner ring turns with the shaft, normal load', 'Tight on the shaft', 'k6 or m6 (NRB); j5, k5, m5 or m6 (TFL)', ['TFL', 'NRB']],
  ['Inner ring turns, heavy or shock load', 'Tighter on the shaft', 'n6 or p6 (TFL)', ['TFL', 'NRB']],
  ['Outer ring stands still in the housing', 'Sliding fit in the housing', 'H7 (TFL adds H8 and J7)', ['TFL', 'NRB', 'NHBB']],
  ['Outer ring turns relative to the load', 'Tight in the housing', 'M7 or N7, P7 for heavy load (TFL); N6 (NHBB)', ['TFL', 'NRB', 'NHBB']],
];
const BG_LOCK = [
  ['Purple', 'Low', 'Small screws, under 1/4 in', 'By hand or with basic tools', ['PERMA', 'FE']],
  ['Blue', 'Medium', 'Up to 3/4 in', 'With hand tools', ['PERMA', 'FE']],
  ['Red', 'High', '3/4 in to 1 in', 'Heat and tools; Permabond says local heat above 550 °F', ['PERMA', 'FE']],
  ['Green', 'Wicking grade: thin, creeps into fasteners already assembled', 'Assembled fasteners', 'Local heat and hand tools', ['PERMA', 'FE']],
];
// Families of structural adhesive: what each source prints, in our own words.
const BG_STRUCT = [
  ['Epoxy', 'The best all-round strength on metals and the widest range of grades; Gluegun.com adds the best resistance to chemicals and heat', 'Wants clean, prepared surfaces: oil has to come off. Fast rigid grades are brittle (Machine Design)', ['MD_SA', 'GG_SA']],
  ['Acrylic (MMA)', 'Fast, with little surface preparation; Machine Design: the highest strength on plastics, and some grades bond oily metal', 'Smell and heat while it cures (Gluegun.com); stands vibration and impact less well than epoxy (Machine Design)', ['MD_SA', 'GG_SA']],
  ['Polyurethane', 'Flexible; good in fatigue (Gluegun.com)', 'Lower strength, more so when hot; two-part grades are sensitive to moisture (Machine Design)', ['MD_SA', 'GG_SA']],
  ['Cyanoacrylate (instant glue)', 'Good shear strength on many plastics and rubbers', 'Rigid, poor in peel and impact; may need a primer; can leave a white bloom', ['MD_SA']],
];

function renderBearGuide(el) {
  const toc = [['bg-type', 'Bearing types'], ['bg-num', 'Bearing numbers'], ['bg-class', 'Tolerance classes'], ['bg-fit', 'Shaft and housing fits'], ['bg-mount', 'Mounting'], ['bg-seal', 'Shaft seals'], ['bg-bu', 'Back-up rings'], ['bg-lock', 'Threadlockers'], ['bg-ret', 'Retaining compounds'], ['bg-tseal', 'Thread and flange sealants'], ['bg-struct', 'Structural adhesives']];
  el.innerHTML =
    '<nav class="gtoc">' + toc.map(([a, t]) => '<a href="#' + a + '">' + t + '</a>').join('') + '</nav>' +
    '<p class="desc">Rolling bearings for the person who has to fit them, in our own words: what each type carries, how to read a bearing number, the tolerance classes, which ring gets the tight fit, how to mount a bearing without hurting it, what a shaft seal asks of the shaft, and the threadlocker colours. Every statement was checked against public sources: they are listed under Sources at the bottom, where you can also show the source keys beside each statement. <span class="gtbv">to be verified</span> marks a statement not yet confirmed by two independent publishers.</p>' +

    '<h2 id="bg-type">Rolling bearing types</h2>' +
    guideTable(['Type', 'Carries', 'Remarks'], BG_TYPE, bgTags) +
    bgP('<b>Balls or rollers.</b> Ball bearings carry less and run faster; roller bearings carry more and run slower.', ['NSK_T']) +
    bgP('<b>Axial load, one way or both.</b> A deep groove ball bearing takes a moderate axial load in either direction. A single angular contact bearing takes it in one direction only, so two are paired or stacked where the load can come from both sides.', ['RSOL']) +
    bgP('<b>Tapered roller bearings</b> have to be adjusted axially when they are fitted.', ['RSOL']) +
    bgP('<b>Thrust bearings</b> take no radial load, the spherical roller thrust bearing excepted, so the shaft needs a radial bearing as well.', ['RSOL', 'NSK_T']) +
    bgP('Rating life from the load and the catalogue rating is worked out in <a href="#/t/bearinglife">bearing rating life (L10)</a>.', null) +

    '<h2 id="bg-num">Reading a bearing number</h2>' + bgNumber() +
    bgP('<b>How it is built.</b> A code for the type, then the dimension series, then the bore number, then suffixes for everything else.', ['KOYO', 'NSK_D']) +
    bgP('<b>Bore number.</b> From 04 upward the bore in millimetres is the number times 5: 04 is 20 mm, 05 is 25 mm.', ['KOYO', 'NPTC', 'NSK_D', 'SOCO']) +
    bgP('<b>The four small ones.</b> 00 is 10 mm, 01 is 12 mm, 02 is 15 mm and 03 is 17 mm.', ['KOYO', 'NPTC']) +
    bgP('<b>Below 10 mm</b> the bore is written as it is: a 625 has a 5 mm bore.', ['KOYO', 'NPTC']) +
    bgP('<b>Odd and large bores.</b> Bores of 22, 28 and 32 mm, and bores over 480 mm, are written in millimetres after a slash: /22, /28, /32, /500.', ['KOYO']) +
    bgP('<b>The example above.</b> 6205-2RS C3: 05 times 5 is a 25 mm bore.', ['KOYO', 'NPTC', 'OWN']) +
    '<p class="desc">The first part of the number names the type:</p>' +
    guideTable(['Code', 'Bearing type'], BG_CODE, bgTags) +
    bgP('<b>Series digit.</b> The digit after the type code is the series: 0 extra light, 2 light, 3 medium, 4 heavy; 8 and 9 are thin sections.', ['NPTC']) +
    bgP('<b>Medium series.</b> The 3 in a 63 bearing stands for the medium series.', ['NPTC', 'SOCO']) +
    '<p class="desc">Common suffixes:</p>' +
    guideTable(['Suffix', 'Meaning'], BG_SUF, bgTags) +
    bgP('<b>Makers differ.</b> Suffixes are not the same in every catalogue: the contact seal on both sides is 2RS at Koyo and DDU at NSK. Check the maker\'s own list.', ['KOYO', 'NSK_D']) +
    bgP('<b>Inch bearings.</b> In the R series the digits give the bore in sixteenths of an inch: an R6 has a 3/8 in bore.', ['NPTC']) +

    '<h2 id="bg-class">Tolerance classes</h2>' +
    guideTable(['ISO 492', 'DIN 620', 'ABEC (ball bearings)'], BG_CLASS, bgTags) +
    bgP('<b>Which way they run.</b> A lower ISO class number, and a higher ABEC number, is a closer tolerance.', ['WP_ABEC', 'NSK_C']) +
    bgP('<b>What a class controls.</b> The dimensions needed for mounting (bore, outside diameter, width) and the running accuracy (radial and face runout of the rings).', ['NSK_C']) +
    bgP('<b>What it does not.</b> The class says nothing about load capacity, materials, noise, vibration or the lubricant.', ['WP_ABEC']) +
    bgP('<b>Normal is enough</b> for general use in most cases. Machine tool main spindles use P5, P4 or P2.', ['NSK_C']) +
    bgP('<b>In figures.</b> The inner ring of a small bearing (shaft 1 to 18 mm) may run out by at most 10 micrometres in ABEC 1, 7 in ABEC 3, 4 in ABEC 5, 2.5 in ABEC 7 and 1.5 in ABEC 9.', ['WP_ABEC']) +

    '<h2 id="bg-fit">Shaft and housing fits</h2>' + bgFit() +
    bgP('<b>The rule.</b> The ring that turns relative to the load gets an interference fit; the other ring gets a slightly loose fit.', ['NHBB', 'TFL', 'NRB']) +
    bgP('<b>The usual case.</b> The shaft turns and the housing stands still: the inner ring is tight on the shaft, and the outer ring slides in the housing, which also lets it move along as the shaft grows with heat.', ['TFL', 'NRB']) +
    guideTable(['Case', 'Fit', 'Classes named in the sources'], BG_FIT, bgTags) +
    bgP('<b>Too loose.</b> The ring creeps round on its seat: wear, heat, fretting corrosion and vibration follow.', ['MINEBEA', 'TFL', 'PROC']) +
    bgP('<b>Too tight.</b> The interference takes up the internal clearance of the bearing, which then runs hot; it also raises the mounting force.', ['PROC', 'NHBB', 'TFL']) +
    bgP('<b>When to ask for C3.</b> When the fit has to be tight for the load, or the shaft runs much hotter than the housing, choose a bearing with more internal clearance.', ['TFL', 'NHBB']) +
    bgP('<b>Light, normal, heavy.</b> For ball bearings a load up to 0.06 of the dynamic load rating counts as light, 0.06 to 0.12 as normal and above that as heavy.', ['NHBB']) +
    bgP('<b>Thin bearings</b> are more sensitive to the fit than heavy sections; a line-to-line or loose fit usually suits them better.', ['NHBB']) +
    bgP('<b>Aluminium housings</b> expand about twice as much as steel, so a fit that is tight at room temperature can be loose when warm.', ['TFL']) +
    bgP('<b>Check the seats.</b> Measure the shaft at three places along the seat, in two directions at each, to find taper and ovality; the housing bore the same way. Each fillet radius must be smaller than the chamfer of the bearing, so that the ring sits against the shoulder.', ['FAB']) +
    bgP('The limits of each tolerance class are in <a href="#/t/fits">ISO limits and fits</a>; the heat needed for a shrink fit in <a href="#/t/shrinkfit">shrink and press fits</a>.', null) +

    '<h2 id="bg-mount">Mounting</h2>' + bgMount() +
    bgP('<b>Leave it wrapped.</b> Keep the bearing in its unopened package until the moment it is fitted.', ['PROC', 'FAB']) +
    bgP('<b>Where to push.</b> Press on the ring that has the interference fit, through a sleeve or fitting tool. The mounting force must never pass through the balls or rollers.', ['PROC', 'FAB']) +
    bgP('<b>Press, not hammer.</b> A press is better than a hammer. A hammer and a piece of pipe is not a fitting tool.', ['PROC', 'FAB']) +
    bgP('<b>How large for cold mounting.</b> The sources draw the line differently: bearings up to 4 in outside diameter by Processing Magazine, up to a bore of roughly 60 to 70 mm by Fabrico.', ['PROC', 'FAB']) +
    bgP('<b>How hot.</b> Heating the bearing to 80 to 90 °C above the shaft is normally enough, about 100 to 110 °C in a workshop at 20 °C.', ['PROC', 'FAB']) +
    bgP('<b>Never hotter than.</b> 120 °C by Schaeffler and Fabrico; Processing Magazine gives 125 °C (257 °F) for open bearings. More heat changes the structure and hardness of the steel.', ['SCH', 'FAB', 'PROC']) +
    bgP('<b>Sealed and greased bearings</b> have a lower limit.', ['SCH', 'PROC']) +
    bgP('<b>The lower limit, in figures.</b> 80 °C for sealed or greased bearings and for those with a polyamide cage.', ['SCH']) +
    bgP('<b>No oil bath</b> for sealed or greased bearings.', ['SCH', 'FAB']) +
    bgP('<b>No flame.</b> Never heat a bearing with a torch.', ['PROC', 'FAB']) +
    bgP('<b>Induction heaters</b> heat quickly and cleanly. They magnetise the bearing, so it has to be demagnetised afterwards; many heaters do this themselves.', ['PROC', 'SCH']) +
    bgP('<b>Oil bath.</b> Clean oil with a flash point above 250 °C, a thermostat, and the bearings on a grid or hung up so that they heat evenly and stay out of the dirt at the bottom.', ['SCH']) +
    bgP('<b>Once it is hot.</b> Slide it on in one quick movement, without tilting, up to the shoulder, and hold it against the shoulder until it has cooled.', ['SCH']) +
    bgP('<b>Very large bearings</b> are mounted with oil injection and a hydraulic nut.', ['PROC']) +
    bgP('<b>Afterwards.</b> Turn the shaft by hand and feel for roughness or a catch once per turn.', ['FAB']) +
    bgP('<b>Storing bearings.</b> Flat, not on edge, in a cool, clean, dry place free of vibration.', ['PROC']) +

    '<h2 id="bg-seal">What a radial shaft seal asks of the shaft</h2>' +
    bgP('<b>Roughness.</b> Ra 0.2 to 0.8 micrometres, with Rmax no more than 6.3.', ['SEALS', 'IMA']) +
    bgP('<b>Rz, sources differ.</b> 1 to 4 micrometres in the seal supplier\'s guide; 1 to 5 as the Stuttgart institute quotes the standard.', ['SEALS', 'IMA']) +
    bgP('<b>No spiral.</b> The running surface must carry no spiral machining marks (lead).', ['SEALS', 'IMA']) +
    bgP('<b>Plunge grinding</b> with a rotating wheel is the way to a surface free of lead.', ['IMA']) +
    bgP('<b>No damage.</b> Scores, scratches and pores are not allowed where the lip runs.', ['SEALS']) +
    bgP('<b>Hardness.</b> 55 HRC (600 HV), hardened at least 0.3 mm deep.', ['SEALS']) +
    bgP('<b>Housing bore.</b> Tolerance H8 gives the press fit for a metric seal; roughness Ra 1.6 to 6.3 micrometres.', ['SEALS']) +
    bgP('<b>Fitting.</b> Oil or grease the lip and the shaft. Chamfer, round or cover every sharp edge the lip has to pass. Press as close to the outside of the seal as possible, and leave it square to the shaft.', ['SEALS']) +
    bgP('<b>Renewing.</b> Fit a new seal after every strip-down, and do not let its lip run in the track of the old one: move it along the bore or fit a wear sleeve.', ['SEALS']) +
    bgP('Static seals are in <a href="#/t/oring">O-ring glands</a>.', null) +

    '<h2 id="bg-bu">Back-up rings for O-rings</h2>' +
    bgP('<b>What they are for.</b> Under pressure an O-ring is pushed into the clearance gap behind it and can be nibbled away there. A back-up ring blocks or narrows that gap.', ['MARCO_BU', 'FPW_BU', 'APPLE_BU']) +
    bgP('<b>Gap and hardness.</b> How much pressure an O-ring stands before it extrudes depends on the size of the diametral clearance and on the hardness of the rubber. Beyond that limit, use a harder O-ring, close the gap, or fit back-up rings.', ['APPLE_BU']) +
    bgP('<b>An example (Apple Rubber).</b> At 1000 psi with a diametral clearance of 0.016 in, a 70 Shore A ring needs a harder compound, back-up rings or less clearance; an 80 Shore A ring is acceptable.', ['APPLE_BU']) +
    bgP('<b>When, the sources differ.</b> Marco Rubber: above 1500 psi, or with a large gap. Fluid Power World: above about 5 MPa (50 bar), and also with fast movement, heavy pressure pulses, heat or changing temperature.', ['MARCO_BU', 'FPW_BU']) +
    bgP('<b>Which side.</b> With pressure from one side only, one ring on the side away from the pressure. With pressure from both sides, one ring each side of the O-ring.', ['FPW_BU', 'MARCO_BU']) +
    bgP('Apple Rubber prefers two rings, one each side, in every case: the gap is then blocked whichever way the pressure acts.', ['APPLE_BU']) +
    bgP('<b>The groove gets wider.</b> The gland has to be widened to take one or two back-up rings.', ['MARCO_BU']) +
    bgP('<b>Materials.</b> PTFE, or a hard rubber such as 90 Shore A nitrile or FKM, hard enough to resist extrusion itself.', ['MARCO_BU', 'FPW_BU']) +
    bgP('<b>Heavier duty</b> calls for filled PTFE, usually glass-filled, sometimes with bronze or carbon.', ['FPW_BU']) +
    bgP('<b>Solid, split or spiral.</b> Split and spiral rings go in more easily, above all on small diameters; a solid ring has no joint.', ['MARCO_BU', 'FPW_BU']) +
    bgP('The squeeze, stretch and fill of the O-ring itself are checked in <a href="#/t/oring">O-ring glands</a>.', null) +

    '<h2 id="bg-lock">Threadlocker colours</h2>' +
    guideTable(['Colour', 'Strength', 'Fastener size (FE)', 'Taking apart'], BG_LOCK, bgTags) +
    bgP('<b>How it sets.</b> The liquid hardens once tightening the threads has shut the air out.', ['FE']) +
    bgP('<b>How long.</b> It holds within a few minutes and reaches full strength in about 24 hours.', ['FE']) +
    bgP('<b>Putting it on.</b> Threads clean and dry; a drop on the first few threads of the bolt is enough, tightening spreads it.', ['FE']) +
    bgP('<b>Colours are a habit, not a rule.</b> They come from old US military specifications and not every product follows them: there is a red low-strength threadlocker, and retaining compounds are green too. Go by the product number and its data sheet.', ['PERMA']) +
    bgP('Tightening torque and preload are in <a href="#/t/bolttorque">bolt torque and preload</a>.', null) +

    '<h2 id="bg-ret">Retaining compounds</h2>' +
    bgP('<b>What they are.</b> Anaerobic adhesives for plain round joints, not for threads: a bearing in its housing, a bush in a bore, a sleeve, gear or pulley on a shaft.', ['AIMS_TL', 'INC_RC']) +
    bgP('<b>What they do.</b> The liquid fills the small clearance between the two parts and hardens there, so the whole surface carries the load.', ['AIMS_TL', 'INC_RC']) +
    bgP('<b>Setting.</b> As with a threadlocker: liquid in air, hard once it is shut in between close-fitting metal surfaces.', ['AIMS_TL', 'INC_RC']) +
    bgP('<b>The gap.</b> Typically up to 0.25 mm (AIMS gives this as the clearance on the diameter for Loctite 638); Incure adds up to 0.5 mm for some grades.', ['AIMS_TL', 'INC_RC']) +
    bgP('<b>The fit.</b> A retaining compound can add to a press or shrink fit or take its place (Incure). AIMS advises a clearance fit, H7/g6 or looser, and lets the adhesive do the holding.', ['AIMS_TL', 'INC_RC']) +
    bgP('<b>Surfaces to be bonded.</b> Clean, with heavy oil removed. On stainless steel and other less active surfaces use the activator (primer) of the maker, or the cure is slow.', ['AIMS_TL', 'INC_RC']) +
    bgP('<b>Active and passive.</b> AIMS counts mild steel, cast iron, copper and brass as active; stainless steel, zinc and chrome plating, anodised aluminium and black oxide as passive.', ['AIMS_TL']) +
    bgP('<b>Against threadlockers.</b> Retaining compounds are thicker, fill larger gaps and have a higher shear strength.', ['INC_RC']) +
    bgP('<b>No fretting.</b> With the gap filled, the small movements that cause fretting corrosion stop.', ['INC_RC']) +
    bgP('<b>Heat.</b> Grades differ: AIMS lists Loctite 638 to 150 °C and 648 to 200 °C. Go by the data sheet.', ['AIMS_TL']) +
    bgP('<b>Getting it apart again</b> is often hard, and some grades are meant to stay for good.', ['INC_RC']) +
    bgP('Fits without adhesive are in <a href="#/t/shrinkfit">shrink and press fits</a> and <a href="#/t/fits">ISO limits and fits</a>.', null) +

    '<h2 id="bg-tseal">Thread and flange sealants</h2>' +
    bgP('<b>Anaerobic thread sealant.</b> A liquid or paste that hardens inside the thread of a metal fitting once the air is shut out.', ['AIMS_TL', 'INC_TS']) +
    bgP('<b>It needs time.</b> Unlike tape, it has a cure time before the joint is at full strength. AIMS gives one hour to handle and 24 hours to full cure for Loctite 567.', ['AIMS_TL', 'INC_TS']) +
    bgP('<b>Stainless steel</b> and other less active metals may need a primer for a full, fast cure.', ['AIMS_TL', 'INC_TS']) +
    bgP('<b>Putting it on.</b> Threads clean and free of oil and cutting fluid. Incure starts the bead a thread or two back from the end.', ['AIMS_TL', 'INC_TS']) +
    bgP('<b>PTFE tape and fluid power.</b> Tape can shred as the joint is made up, and the shreds travel to valves and filters (Incure). AIMS: never on hydraulic fittings.', ['AIMS_TL', 'INC_TS']) +
    bgP('<b>Tape in general.</b> Cheap, and it keeps without limit. It stands vibration and changes of temperature poorly: the wrap can loosen and creep.', ['INC_TS']) +
    bgP('<b>Tape colours (AIMS, Australia).</b> White for water and low pressure, yellow for gas; white tape is not allowed on gas connections there. Local rules decide.', ['AIMS_TL']) +
    bgP('<b>Pipe dope.</b> The older solvent-based pastes harden as the solvent leaves. They are messy, and the result depends on how thickly the paste went on.', ['INC_TS']) +
    bgP('<b>Metal threads.</b> Most anaerobic sealants are made for metal threads.', ['INC_TS']) +
    bgP('<b>Anaerobic flange sealant.</b> For rigid, machined metal faces in place of a cut gasket: gearboxes, pumps and the like.', ['AIMS_TL', 'INC_FS']) +
    bgP('<b>Flange gap.</b> Up to 0.5 mm at most. AIMS lists one grade to 0.25 mm and another to 0.5 mm.', ['AIMS_TL', 'INC_FS']) +
    bgP('<b>Rough, cast or flexible faces.</b> Use a formed-in-place silicone (RTV) there: it cures to a flexible rubber and bridges larger gaps. Stamped covers are the usual case.', ['AIMS_TL', 'INC_FS']) +
    bgP('<b>Clean faces.</b> An anaerobic sealant bridges only very small voids, so the faces must be clean and free of deep scores.', ['INC_FS']) +
    bgP('<b>No tightening again.</b> The cured film does not shrink or relax, so the bolts keep their load.', ['INC_FS']) +
    bgP('<b>Pressure.</b> A silicone seal generally holds less pressure than an anaerobic one.', ['INC_FS']) +
    bgP('<b>Not together with a soft gasket.</b> Anaerobic flange sealants do not bond well to rubber, paper or composite gaskets.', ['AIMS_TL']) +
    bgP('<b>Cut gaskets.</b> A soft gasket follows uneven and rougher faces, but it creeps and relaxes with time, and the bolts lose load.', ['INC_FS']) +
    bgP('Pipe thread sizes are in <a href="#/t/pipethreads">pipe threads</a>.', null) +

    '<h2 id="bg-struct">Structural adhesives</h2>' +
    guideTable(['Family', 'Strong points', 'Weak points'], BG_STRUCT, bgTags) +
    bgP('<b>Preparation decides.</b> Both sources put the state of the surfaces first: clean, and abraded or primed where the adhesive asks for it.', ['MD_SA', 'GG_SA']) +
    bgP('<b>Toughened and flexible epoxies.</b> Toughened grades do best in shear, peel, impact, vibration and fatigue together; flexible grades peel better and take knocks.', ['MD_SA']) +
    bgP('<b>Heat-cured epoxy.</b> One-part grades cured at 250 to 350 °F give the highest shear strength on metal.', ['MD_SA']) +
    bgP('<b>Joints that move.</b> For an assembly that flexes or vibrates choose a flexible adhesive; choosing on strength alone is a mistake.', ['GG_SA']) +
    bgP('<b>Temperature.</b> Two-part adhesives cure faster when warm: about half the working time for every 10 °C. Apply at 60 to 80 °F and not below about 40 °F.', ['MD_SA']) +
    bgP('<b>Try it.</b> No table replaces a test on your own parts.', ['GG_SA']) +

    '<h2 id="bg-src">Sources</h2><ul class="gsl">' + Object.entries(BG_SOURCES).map(([k, v]) => '<li><b>' + k + '</b> ' + gesc(v) + '</li>').join('') + '</ul>' +
    '<p class="desc">Full URLs and access dates are in docs/sources.md, "Bearings and seals guide". No text, figures or tables were copied from the sources.</p>';
  guideToc(el);
}
