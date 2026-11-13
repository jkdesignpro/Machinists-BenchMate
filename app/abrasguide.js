// Abrasive processes guide (parity MH127, MH168, MH170, MH171, MH172, BB61; parts of MH161, MH165).
// All wording and drawings are BenchMate's own. Every statement carries the keys of the public sources read for
// it (docs/sources.md, "Abrasive processes guide"); one with fewer than two independent publishers is shown as
// "to be verified". Where two sources give different figures both are shown.
'use strict';

const AG_SOURCES = {
  OU_G: 'The Open University, OpenLearn, Manupedia, "Grinding", 2018 (CC BY-NC-SA 4.0)',
  OU_C: 'The Open University, OpenLearn, Manupedia, "Centreless grinding", 2018 (CC BY-NC-SA 4.0)',
  CTE_W: 'Cutting Tool Engineering, J. Badger, "Achieving reasonable wheel wear", 2012-12-15',
  CTE_C: 'Cutting Tool Engineering, K. Hanson, "Basics of centerless grinding", 2016-12-01',
  CTE_H: 'Cutting Tool Engineering, C. Tate, "Honing: what it is, how it works", 2017-03-14',
  MMS_G: 'Modern Machine Shop, E. Doran, "Machining 101: what is grinding?", 2021-07-03',
  MMS_C: 'Production Machining (at mmsonline.com), C. Koepfer, "Centerless grinding: not magic!", 2000-12-15',
  MMS_H: 'Modern Machine Shop, D. Westhoff (Sunnen), "Single-pass vs. multi-stroke: the ins and outs of honing", 2012-04-13',
  AM18: 'American Machinist, G. Schneider Jr., "Cutting tool applications", chapter 18, "Lapping and honing", 2020-06-29',
  WP_HONE: 'Wikipedia, "Honing (metalworking)" (CC BY-SA), read in the copy at doc.surf',
  WP_LAP: 'Wikipedia, "Lapping" (CC BY-SA)',
  KEMET: 'Kemet International, "Factors to consider during the lapping process"',
  MISUMI: 'MISUMI, technical page "Diamond and CBN grindstones selection guide"',
  UKAM: 'UKAM Industrial Superhard Tools, "Diamond and CBN specifications"',
  M3: '3M, leaflet "Superabrasive wheel shapes"',
  EMI4: 'EMI Supply, "Abrasives lesson 4: basic belt methods and contact wheels" (courtesy of Carborundum Abrasives)',
  EMI6: 'EMI Supply, "Abrasives lesson 6: abrasive belt considerations" (courtesy of Carborundum Abrasives)',
  XOM_B: 'Xometry, "Belt grinder"',
  WEILER: 'Weiler Abrasives, "Cutting wheel guide"',
  NORTON: 'Norton (Saint-Gobain Abrasives), catalogue pages on mounted points',
  PFERD: 'PFERD, safety notes for mounted points and bench grinding wheels (catalogue 3)',
  GILSON: 'Gilson Company, "Sieve sizes" (ASTM E11 openings)',
  WP_MESH: 'Wikipedia, "Mesh (scale)" (CC BY-SA)',
  SIGMA: 'Sigma-Aldrich, "Particle size conversion table"',
  DEF_SG: 'DeFusco, "Surface grinding wheel selection: grit, bond, and grade", 2026-04-12 (a seller)',
  BACON_SG: 'T. A. Bacon, Introduction to Machining, 11.4 "Application" (Washington open textbook, CC BY 4.0)',
  AE_FS: 'Abrasive Engineering, "Feeds and speeds" (an excerpt it credits to Farago)',
  RAD_CG: 'Radiac Abrasives, troubleshooting tips, cylindrical grinding (only the rows that read cleanly)',
  OKU_CH: 'R. Williams, Okuma, "6 causes of grinding chatter and how to fix them", 2016-03-23',
  UG_ERR: 'UNITED GRINDING, Motion blog, "Typical grinding errors and how to eliminate them", 2020-12-08',
  CTE_BURN: 'Cutting Tool Engineering, J. A. Badger, "How to avoid grinding burn", 2014-04-01',
};
// Several pages of one publisher count once.
const AG_FAMILY = { OU_G: 'OU', OU_C: 'OU', CTE_W: 'CTE', CTE_C: 'CTE', CTE_H: 'CTE', MMS_G: 'MMS', MMS_C: 'MMS', MMS_H: 'MMS', WP_HONE: 'WIKI', WP_LAP: 'WIKI', WP_MESH: 'WIKI', EMI4: 'EMI', EMI6: 'EMI', CTE_BURN: 'CTE' };
const agTags = keys => guideTags(keys, AG_SOURCES, AG_FAMILY);
const agP = (html, keys) => '<p>' + html + (keys === null ? '' : ' ' + agTags(keys)) + '</p>';
const agBox = d => '<path class="gfill" d="' + d + '"/><path class="gp" d="' + d + '"/>';

// Centerless grinding from the end: grinding wheel, regulating wheel, work on the blade above the centre line.
function agCless() {
  return cnSvg(400, 222,
    '<g transform="translate(0 26)"><circle class="gfill" cx="130" cy="90" r="70"/><circle class="gp" cx="130" cy="90" r="70"/>' +
    '<circle class="gp" cx="288" cy="90" r="45"/>' +
    agBox('M202 95.3L232 112.6V170H202Z') +
    '<circle class="gfill" cx="221.6" cy="81.2" r="22"/><circle class="gc" cx="221.6" cy="81.2" r="22"/>' +
    '<path class="gk" d="M40 90H350"/><path class="gw" d="M213 81.2H230M221.6 73V89"/>' +
    cnT(118, 124, 'grinding wheel', 'gs', 'middle') + cnT(300, 152, 'regulating wheel', 'gs', 'middle') + cnT(217, 186, 'work rest blade', 'gs', 'middle') + '</g>' +
    cnT(221, 16, 'work, its centre above', 'gs', 'middle') + cnT(221, 30, 'the line of the wheel centres', 'gs', 'middle') + '<path class="gm" d="M221.6 36V82"/>',
    'Centerless grinding seen from the end: a large grinding wheel on the left, a smaller regulating wheel on the right, and between them the work resting on the sloping top of the work rest blade. The centre of the work lies a little above the line that joins the centres of the two wheels');
}
// A hone in a bore and the crosshatch its two motions leave.
function agHone() {
  let x = '';
  for (let k = 0; k < 4; k++) x += 'M' + (30 + k * 32) + ' 130L' + (88 + k * 32) + ' 30M' + (190 - k * 32) + ' 130L' + (132 - k * 32) + ' 30';
  return cnSvg(440, 160,
    '<path class="gp" d="M30 30H190V130H30Z"/><path class="gm" d="' + x + '"/>' +
    agBox('M98 10H122V150H98Z') + agBox('M84 50H98V110H84Z') + agBox('M122 50H136V110H122Z') +
    '<path class="gc" d="M214 40V120M214 40l-4 7M214 40l4 7M214 120l-4 -7M214 120l4 -7"/>' +
    '<path class="gc" d="M92 20A22 8 0 0 0 128 20M128 20l-7 0M128 20l-2 -6"/>' +
    cnT(232, 54, 'the hone turns and strokes', 'gs') + cnT(232, 68, 'at the same time;', 'gs') + cnT(232, 90, 'the two motions cross and', 'gs') + cnT(232, 104, 'leave a crosshatch that', 'gs') + cnT(232, 118, 'holds oil', 'gs') +
    cnT(60, 148, 'stone', 'gs', 'middle') + '<path class="gm" d="M66 138L86 112"/>',
    'A hone in a bore: the tool carries abrasive stones on both sides, turns and strokes in and out at the same time, and the two motions cross to leave a crosshatch pattern on the wall that holds oil');
}
// Lapping: loose abrasive between the work and a softer lap.
function agLap() {
  let g = '';
  for (let x = 154; x <= 266; x += 12) g += '<circle class="gp" cx="' + x + '" cy="96" r="2"/>';
  return cnSvg(420, 160,
    agBox('M60 100H360V130H60Z') + agBox('M150 60H270V92H150Z') + '<path class="gp" d="M180 30H240V60H180Z"/>' + g +
    '<path class="gc" d="M150 46H120M120 46l7 -4M120 46l7 4M270 46H300M300 46l-7 -4M300 46l-7 4"/>' +
    cnT(210, 49, 'weight', 'gs', 'middle') + cnT(210, 80, 'work', 'gs', 'middle') + cnT(210, 120, 'lap, softer than the work', 'gs', 'middle') +
    cnT(140, 78, 'loose abrasive', 'gs', 'end') + cnT(140, 92, 'in oil or paste', 'gs', 'end'),
    'Lapping: the work, under a light weight, is moved about on a flat lap that is softer than the work, with loose abrasive in oil or paste between the two');
}

const AG_CLESS = [
  ['Through-feed', 'The regulating wheel is tilted a few degrees and draws the work through between the wheels', 'Plain cylinders of any length, bar stock', ['CTE_C', 'OU_C']],
  ['Infeed (plunge)', 'The work sits against a stop and a wheel is fed in until the size is reached', 'Headed, stepped and profiled work', ['CTE_C', 'OU_C']],
  ['End-feed', 'Everything is fixed and the work is fed endways up to a stop', 'Fast production under automatic control', ['OU_C']],
];
const AG_CONC = [
  ['50', '2.2', '12.5 %', ['UKAM']],
  ['75', '3.3', '18.8 %', ['MISUMI', 'UKAM']],
  ['100', '4.4', '25 %', ['MISUMI', 'UKAM']],
];
const AG_BELT = [
  ['Contact wheel', 'A wheel behind the belt; the work meets the belt on the wheel', 'Most work (EMI); contours and hollow grinding (Xometry)', ['EMI4', 'XOM_B']],
  ['Platen', 'A fixed flat plate', 'Flat surfaces', ['EMI4', 'XOM_B']],
  ['Slack belt', 'Nothing: the free span between two wheels', 'Contoured parts: deburring, blending, polishing', ['EMI4', 'XOM_B']],
];

// Sieve openings as each source prints them, in the source's own units. Nothing is converted or averaged here.
const AG_SIEVE = [
  ['No. 4', '4.75 mm', '4.75 mm (0.187 in)', '4.76 mm (0.187 in)', ['GILSON', 'WP_MESH', 'SIGMA']],
  ['No. 5', '4.00 mm', '4.00 mm (0.157 in)', '4.00 mm (0.157 in)', ['GILSON', 'WP_MESH', 'SIGMA']],
  ['No. 6', '3.35 mm', '3.35 mm (0.132 in)', '3.36 mm (0.132 in)', ['GILSON', 'WP_MESH', 'SIGMA']],
  ['No. 7', '2.80 mm', '2.80 mm (0.110 in)', '2.83 mm (0.111 in)', ['GILSON', 'WP_MESH', 'SIGMA']],
  ['No. 8', '2.36 mm', '2.36 mm (0.093 in)', '2.38 mm (0.0937 in)', ['GILSON', 'WP_MESH', 'SIGMA']],
  ['No. 10', '2.00 mm', '2.00 mm (0.079 in)', '2.00 mm (0.0787 in)', ['GILSON', 'WP_MESH', 'SIGMA']],
  ['No. 12', '1.70 mm', '1.70 mm (0.0661 in)', '1.68 mm (0.0661 in)', ['GILSON', 'WP_MESH', 'SIGMA']],
  ['No. 14', '1.40 mm', '1.40 mm (0.0555 in)', '1.41 mm (0.0555 in)', ['GILSON', 'WP_MESH', 'SIGMA']],
  ['No. 16', '1.18 mm', '1.18 mm (0.0469 in)', '1.19 mm (0.0469 in)', ['GILSON', 'WP_MESH', 'SIGMA']],
  ['No. 18', '1.00 mm', '1.00 mm (0.0394 in)', '1.00 mm (0.0394 in)', ['GILSON', 'WP_MESH', 'SIGMA']],
  ['No. 20', '850 µm', '0.85 mm (0.0331 in)', '0.841 mm (0.0331 in)', ['GILSON', 'WP_MESH', 'SIGMA']],
  ['No. 25', '710 µm', '0.71 mm (0.0278 in)', '0.707 mm (0.0278 in)', ['GILSON', 'WP_MESH', 'SIGMA']],
  ['No. 30', '600 µm', '0.60 mm (0.0232 in)', '0.595 mm (0.0234 in)', ['GILSON', 'WP_MESH', 'SIGMA']],
  ['No. 35', '500 µm', '0.50 mm (0.0197 in)', '0.500 mm (0.0197 in)', ['GILSON', 'WP_MESH', 'SIGMA']],
  ['No. 40', '425 µm', '0.425 mm (0.0165 in)', '0.420 mm (0.0165 in)', ['GILSON', 'WP_MESH', 'SIGMA']],
  ['No. 45', '355 µm', '0.355 mm (0.0139 in)', '0.354 mm (0.0139 in)', ['GILSON', 'WP_MESH', 'SIGMA']],
  ['No. 50', '300 µm', '0.300 mm (0.0117 in)', '0.297 mm (0.0117 in)', ['GILSON', 'WP_MESH', 'SIGMA']],
  ['No. 60', '250 µm', '0.250 mm (0.0098 in)', '0.250 mm (0.0098 in)', ['GILSON', 'WP_MESH', 'SIGMA']],
  ['No. 70', '212 µm', '0.212 mm (0.0083 in)', '0.210 mm (0.0083 in)', ['GILSON', 'WP_MESH', 'SIGMA']],
  ['No. 80', '180 µm', '0.180 mm (0.0070 in)', '0.177 mm (0.0070 in)', ['GILSON', 'WP_MESH', 'SIGMA']],
  ['No. 100', '150 µm', '0.150 mm (0.0059 in)', '0.149 mm (0.0059 in)', ['GILSON', 'WP_MESH', 'SIGMA']],
  ['No. 120', '125 µm', '0.125 mm (0.0049 in)', '0.125 mm (0.0049 in)', ['GILSON', 'WP_MESH', 'SIGMA']],
  ['No. 140', '106 µm', '0.105 mm (0.0041 in)', '0.105 mm (0.0041 in)', ['GILSON', 'WP_MESH', 'SIGMA']],
  ['No. 170', '90 µm', '0.090 mm (0.0035 in)', '0.088 mm (0.0035 in)', ['GILSON', 'WP_MESH', 'SIGMA']],
  ['No. 200', '75 µm', '0.075 mm (0.0029 in)', '0.074 mm (0.0029 in)', ['GILSON', 'WP_MESH', 'SIGMA']],
  ['No. 230', '63 µm', '0.063 mm (0.0024 in)', '0.063 mm (0.0025 in)', ['GILSON', 'WP_MESH', 'SIGMA']],
  ['No. 270', '53 µm', '0.053 mm (0.0021 in)', '0.053 mm (0.0021 in)', ['GILSON', 'WP_MESH', 'SIGMA']],
  ['No. 325', '45 µm', '0.044 mm (0.0017 in)', '0.044 mm (0.0017 in)', ['GILSON', 'WP_MESH', 'SIGMA']],
  ['No. 400', '38 µm', '0.037 mm (0.0015 in)', '0.037 mm (0.0015 in)', ['GILSON', 'WP_MESH', 'SIGMA']],
  ['No. 450', '32 µm', 'not listed', 'not listed', ['GILSON']],
  ['No. 500', '25 µm', 'not listed', 'not listed', ['GILSON']],
  ['No. 635', '20 µm', 'not listed', 'not listed', ['GILSON']],
];

// Faults on externally ground round work, with causes and remedies as the sources give them.
const AG_FAULT = [
  ['Chatter marks', 'Cut too heavy; wheel too hard; wheel out of balance; slender work without support; vibration in or reaching the machine', 'Lighter infeed; a softer wheel or make it act softer (dress coarser, faster work speed); balance the wheel; a steady rest; find the vibration', ['RAD_CG', 'OKU_CH', 'UG_ERR']],
  ['Burn marks (yellow or brown patches, a spiral)', 'The surface overheats; wheel too hard; too little coolant; a dull wheel whose grains rub', 'A softer or more open wheel; more and better aimed coolant; correct the dressing feed', ['UG_ERR', 'RAD_CG', 'CTE_BURN']],
  ['Out of round (plunge grinding between centres)', 'Centre holes out of round, out of line or burred; work held too tight on the centres; too little coolant', 'Relap and clean the centre holes; ease the footstock spring; set the coolant flow', ['RAD_CG']],
  ['Thread pattern at the pitch of the table feed', 'Wheel face not parallel to the table travel; the dresser warm or worn', 'Check the dresser for wear and keep it cooled', ['UG_ERR']],
  ['Spiral marks', 'The wheel was dressed out of round or spiral', 'Dress in one direction only, perhaps with less dressing feed', ['UG_ERR']],
  ['Comma-shaped scratches', 'Dirt in the coolant carried through the cut', 'Check the coolant filter; clean the wheel guard', ['UG_ERR']],
  ['Flat spots', 'Vibration from outside: pumps, fans, presses, fork-lift trucks', 'Find the source and remove or isolate it', ['UG_ERR']],
  ['Mirror finish, stock left from before', 'Wheel dull: dressed too fine, clogged, or too fine a grit', 'Dress with more feed, several times; check the dresser; a coarser wheel', ['UG_ERR']],
];

function renderAbrasGuide(el) {
  const toc = [['ag-fig', 'Grinding in figures'], ['ag-surf', 'Surface grinding'], ['ag-fault', 'Faults in cylindrical grinding'], ['ag-cless', 'Centerless grinding'], ['ag-hone', 'Honing'], ['ag-lap', 'Lapping'], ['ag-super', 'Diamond and CBN wheels'], ['ag-belt', 'Belts and cut-off wheels'], ['ag-point', 'Mounted points'], ['ag-sieve', 'Sieves and mesh']];
  el.innerHTML =
    '<nav class="gtoc">' + toc.map(([a, t]) => '<a href="#' + a + '">' + t + '</a>').join('') + '</nav>' +
    '<p class="desc">The abrasive processes beyond the plain grinding wheel, in our own words: the grinding ratio and spark-out, centerless grinding, honing, lapping, diamond and CBN wheels, belt grinding and cut-off wheels, mounted points, and sieves and mesh numbers. Every statement was checked against public sources: they are listed under Sources at the bottom, where you can also show the source keys beside each statement. <span class="gtbv">to be verified</span> marks a statement not yet confirmed by two independent publishers.</p>' +

    '<h2 id="ag-fig">Grinding in figures</h2>' +
    agP('<b>Grinding ratio (G ratio).</b> The volume of metal ground off divided by the volume of wheel worn away in doing it.', ['OU_G', 'CTE_W']) +
    agP('<b>How large.</b> Values run from 2 to 200. A very high ratio often goes with poor surface integrity.', ['OU_G']) +
    agP('<b>An example.</b> A ratio of 18.8 is called pretty good for hardened stainless steel ground with a fine aluminium oxide wheel.', ['CTE_W']) +
    agP('<b>Less wheel wear.</b> A harder grade, a coarser grit where the form allows it, oil in place of a water-based coolant, a higher wheel speed.', ['CTE_W']) +
    agP('<b>Wheel speed.</b> Most surface grinding runs at 30 to 35 m/s. Low-stress grinding uses about 20 m/s, and high-speed grinding about 100 m/s on machines built for it.', ['OU_G']) +
    agP('<b>Spark-out.</b> A last pass after the main grinding that lets the strain out of the machine and improves finish and size.', ['MMS_G']) +
    agP('<b>What grinding holds.</b> On a diameter ±0.0065 mm in production and ±0.0025 mm in precision work; finish typically 0.1 to 2 micrometres Ra.', ['OU_G']) +
    agP('Wheel markings are decoded in <a href="#/t/wheelcode">grinding wheel marking</a>; wheel shapes, choice, dressing and truing are in the <a href="#/t/shoptools">shop tools guide</a>; speeds and times in <a href="#/t/grindspeed">grinding wheel speed</a> and <a href="#/t/grindtime">cylindrical grinding time</a>.', null) +

    '<h2 id="ag-surf">Surface grinding</h2>' +
    agP('<b>The wheel for the work.</b> Aluminium oxide for steel.', ['DEF_SG', 'BACON_SG']) +
    agP('<b>Other work (DeFusco).</b> Silicon carbide for aluminium, brass and copper; CBN for hardened steel and high speed steel.', ['DEF_SG']) +
    agP('<b>Grit and grade (DeFusco).</b> Grit 24 to 46 for rough stock removal, 80 to 120 for finishing. Grade runs from A, softest, to Z, hardest: a soft wheel (E to H) for hard work and a harder one (M to R) for soft work. Bacon uses 60 grit for general work.', ['DEF_SG']) +
    agP('<b>Wheel speed.</b> About 30 to 35 m/s (5500 to 6500 ft/min) at the rim.', ['AE_FS', 'OU_G']) +
    agP('<b>Table speed.</b> Most often 50 to 100 ft/min.', ['AE_FS']) +
    agP('<b>Down feed, the sources differ.</b> The figures credited to Farago: 0.001 in (0.025 mm) a pass for roughing and half that for finishing. The Open University, for grinding in general: 0.1 to 0.4 mm roughing, 0.01 to 0.025 mm finishing.', ['AE_FS', 'OU_G']) +
    agP('<b>Cross feed, the sources differ.</b> Farago: 1/4 to 1/12 of the wheel width a pass for roughing (up to 1/2 to 1/3 in some roughing) and 1/8 to 1/12 for finishing. The Open University: 75 to 90 % of the width for roughing, 10 to 25 % for finishing. Either way the passes overlap.', ['AE_FS', 'OU_G', 'BACON_SG']) +
    agP('<b>On the magnetic chuck.</b> A bowed part goes concave side down. Switch the magnet on and check that the part is held before you start.', ['BACON_SG']) +
    agP('<b>Keep it flat.</b> Grind a thin part a little from each side in turn, turning it over several times.', ['BACON_SG']) +
    agP('<b>Coolant</b> aimed into the nip where the wheel runs into the work.', ['BACON_SG']) +
    agP('<b>What it holds (Open University, production / precision).</b> Reciprocating table: flatness ±0.005 / ±0.0035 mm, thickness ±0.0075 / ±0.0035 mm.', ['OU_G']) +
    agP('The time for a surface grinding job is worked out in <a href="#/t/grindsurf">surface grinding time</a>; dressing is in the <a href="#/t/shoptools">shop tools guide</a>.', null) +

    '<h2 id="ag-fault">Faults in cylindrical grinding</h2>' +
    guideTable(['What you see', 'Usual causes', 'What to do'], AG_FAULT, agTags) +
    '<p class="desc">Causes and remedies as the sources give them, joined where they agree. A row from one source is marked. Radiac\'s table could only be read in part; its rows whose causes and corrections could not be paired with certainty are not used.</p>' +
    agP('<b>Why work burns.</b> When the grains do not cut deep enough they rub, and rubbing makes heat. Rubbing grains also stay blunt, which makes it worse.', ['CTE_BURN']) +
    agP('<b>A burnt shoulder (Badger).</b> Plunge into the shoulder at 60 or 90 degrees rather than 30, aim a small high-pressure coolant jet at the shoulder, or raise the work speed and lower the wheel speed.', ['CTE_BURN']) +
    agP('<b>Burns crack.</b> An overheated surface can crack later under changing load.', ['UG_ERR']) +
    agP('<b>Dress at the grinding speed.</b> Dressing at a higher wheel speed than you grind at brings chatter.', ['CTE_BURN']) +
    agP('<b>Coolant left in the wheel.</b> After stopping, run the wheel on without coolant so that it throws the fluid off; fluid left on one side puts it out of balance.', ['UG_ERR']) +
    agP('Times and speeds are in <a href="#/t/grindtime">cylindrical grinding time</a> and <a href="#/t/grindspeed">grinding wheel speed</a>.', null) +

    '<h2 id="ag-cless">Centerless grinding</h2>' + agCless() +
    agP('<b>No centres, no chuck.</b> The work lies on a work rest blade between the grinding wheel and a smaller regulating wheel.', ['CTE_C', 'MMS_C', 'OU_C']) +
    agP('<b>Regulating wheel.</b> The grinding force presses the work against the regulating wheel, which sets how fast the work turns.', ['CTE_C']) +
    agP('<b>What it is.</b> A rubber-bonded abrasive wheel with a surface speed of 0.25 to 1 m/s.', ['OU_C']) +
    agP('<b>Above centre.</b> The centre of the work is set above the line that joins the wheel centres. That is what makes the part come out round.', ['MMS_C', 'OU_C']) +
    agP('<b>On centre.</b> With the work on the centre line a high spot only makes a low spot opposite it, and the part gets steadily less round.', ['MMS_C']) +
    agP('<b>How far above.</b> 12 to 25 % of the work diameter, on a blade with a 30° top face. Higher grinds faster; too high and the work lifts off the blade.', ['OU_C']) +
    guideTable(['Method', 'How', 'For'], AG_CLESS, agTags) +
    agP('<b>Lobing.</b> A centerless ground part can be out of round in three or more lobes and still measure the same everywhere with a micrometer, which is a two-point measurement.', ['CTE_C']) +
    agP('<b>Against lobing and chatter.</b> Adjust the height of the work and the wheel centres, keep infeed and wheel forces moderate, and dress correctly.', ['CTE_C']) +
    agP('<b>Bores.</b> Running true with a bore machined earlier can be a problem.', ['CTE_C']) +
    agP('<b>What it holds.</b> Diameter ±0.0025 mm in production and ±0.00065 mm in precision work; roundness ±0.0003 mm.', ['OU_C']) +

    '<h2 id="ag-hone">Honing</h2>' + agHone() +
    agP('<b>What it is.</b> A slow abrasive process, mostly for bores: abrasive sticks (stones) on a tool that turns in the bore while tool or work strokes in and out.', ['AM18', 'WP_HONE']) +
    agP('<b>Crosshatch.</b> The two motions leave a crosshatch pattern on the wall, which holds oil.', ['AM18', 'CTE_H', 'WP_HONE']) +
    agP('<b>How slow.</b> American Machinist gives 100 to 250 ft/min for the turning hone; Cutting Tool Engineering has honing start at about 65 ft/min where grinding starts at about 5000.', ['AM18', 'CTE_H']) +
    agP('<b>What it is for.</b> Making a bore round and straight, and bringing it to size.', ['AM18', 'MMS_H', 'WP_HONE']) +
    agP('<b>Stock.</b> Usually 0.002 to 0.020 in is left for honing.', ['AM18']) +
    agP('<b>What it holds.</b> Under 0.001 in on the diameter with a finish below 20 microinches by American Machinist; as close as 0.0002 in by Cutting Tool Engineering.', ['AM18', 'CTE_H']) +
    agP('<b>Abrasives.</b> Aluminium oxide, silicon carbide, CBN and diamond.', ['AM18', 'WP_HONE']) +
    agP('<b>Which abrasive.</b> Diamond does not hone steel well, and CBN may not pay on soft steel.', ['AM18']) +
    agP('<b>Hard and soft stones.</b> The hardness of a stone is the strength of its bond, not of the grain.', ['AM18']) +
    agP('<b>Honing oil</b> keeps the stones from loading and picking up; it has to be filtered fine.', ['AM18']) +
    agP('<b>Single-pass honing</b> takes the bore to size in one stroke. American Machinist: an expandable diamond-plated sleeve, limited to materials that make small chips, such as cast iron. Modern Machine Shop: suited to short bores and powder metal.', ['AM18', 'MMS_H']) +
    agP('<b>Plateau honing</b> takes the peaks off the surface and leaves flat plateaus above deep valleys that still hold oil.', ['AM18', 'WP_HONE']) +
    agP('<b>Plateau finish, in figures.</b> Rz 3 to 6, Rpk at most 0.3, Rk 0.3 to 1.5 and Rvk 0.8 to 2.0 micrometres.', ['WP_HONE']) +

    '<h2 id="ag-lap">Lapping</h2>' + agLap() +
    agP('<b>What it is.</b> Rubbing the work on a lap with loose abrasive between the two, carried in oil, grease or paste. No bonded abrasive is used.', ['AM18', 'WP_LAP']) +
    agP('<b>The lap is the softer one.</b> The abrasive then beds into the lap and cuts the work. If the work were softer the grains would bed into the work.', ['AM18', 'KEMET', 'WP_LAP']) +
    agP('<b>Lap material.</b> Cast iron is the usual one.', ['AM18', 'WP_LAP', 'KEMET']) +
    agP('<b>Silicon carbide</b> cuts fast and leaves a matt surface.', ['AM18', 'KEMET']) +
    agP('<b>Diamond</b> cuts faster and finishes better.', ['AM18', 'KEMET']) +
    agP('<b>Hard and soft work.</b> Diamond paste for carbide and for metals over 64 HRC; for soft metals such as brass and bronze an abrasive that does not embed, such as garnet.', ['KEMET']) +
    agP('<b>Stock, pressure, speed.</b> 0.0005 to 0.005 in is left for lapping. Pressure is about 3 psi, often no more than the weight of the work. The plate turns at 10 to 15 rpm for critical parts.', ['AM18']) +
    agP('<b>Grit.</b> 100 to 280 mesh is coarse for lapping; 320 to 800 is fine.', ['AM18']) +
    agP('<b>Conditioning rings.</b> On a lapping machine the work sits inside rings that ride on the turning plate.', ['AM18', 'WP_LAP', 'KEMET']) +
    agP('<b>Bright is not flat.</b> Flatness, finish and polish do not come together of themselves: a bright surface is no proof of a flat one.', ['AM18', 'KEMET']) +
    agP('<b>Checking flatness.</b> An optical flat is laid on the lapped surface under light of one colour, and the dark bands are counted.', ['WP_LAP', 'KEMET']) +
    agP('<b>One light band</b> of helium light is about 280 nanometres (0.000011 in). One to three bands is typical for lapping without special equipment.', ['WP_LAP']) +
    agP('<b>What lapping does not do.</b> It makes little heat, does not warp the work and raises no burr.', ['AM18']) +

    '<h2 id="ag-super">Diamond and CBN wheels</h2>' +
    agP('<b>Diamond</b> wheels grind carbide.', ['MISUMI', 'UKAM']) +
    agP('<b>CBN</b> wheels grind hardened steel: alloy tool steel and high speed steel. They are not for mild steel, and their life drops sharply on steel of 50 HRC or less.', ['MISUMI']) +
    '<p class="desc">Concentration says how much abrasive is in the layer:</p>' +
    guideTable(['Concentration', 'Carats per cm³', 'Abrasive by volume'], AG_CONC, agTags) +
    agP('<b>One carat</b> is 0.2 g.', ['MISUMI', 'UKAM']) +
    agP('<b>More is not always better.</b> A higher concentration costs more and lasts longer, but does not always grind better.', ['MISUMI', 'UKAM']) +
    agP('<b>Bond.</b> Resin bonds carry the letter B. A softer bond makes a sharper wheel, a harder bond a longer-lived one.', ['MISUMI']) +
    agP('<b>Shape code.</b> A number for the shape of the body, a letter for the cross-section of the abrasive layer, a number for where the layer sits, and sometimes a letter for a modification: 1A1, 6A2C.', ['M3']) +
    agP('<b>Where the layer sits.</b> 1 on the periphery, 2 on the side, 3 on both sides, 6 on part of the periphery, 9 on the corner.', ['M3']) +
    agP('<b>Wheel speed.</b> Diamond 1200 to 1800 m/min wet and 700 to 1200 dry; CBN 1500 to 2400 m/min wet and 1200 to 1500 dry.', ['MISUMI']) +
    agP('Grit numbers against grain size are in <a href="#/t/gritconv">abrasive grit sizes</a>.', null) +

    '<h2 id="ag-belt">Belt grinding and cut-off wheels</h2>' +
    guideTable(['Way of working', 'The belt is backed by', 'For'], AG_BELT, agTags) +
    agP('<b>Belt speed.</b> 4000 to 6000 ft/min for most work.', ['EMI4', 'XOM_B']) +
    agP('<b>Contact wheel hardness.</b> For one grit, a harder wheel cuts faster and the belt lasts longer. Coarse belts (24 to 50) go with hard wheels of 70 to 95 Shore A, fine belts (150 and finer) with soft wheels of 30 to 50.', ['EMI4']) +
    agP('<b>Serrated wheels.</b> Grooves across the face cut the contact area and make the belt bite harder; narrower lands and wider grooves, more so. A smooth wheel gives the best finish.', ['EMI4']) +
    agP('<b>Grit by stage.</b> Roughing 24 to 60, in between 80 to 150, finishing 180 to 320 by EMI; Xometry gives 36 to 80 for stock removal and 220 and finer for finishing.', ['EMI6', 'XOM_B']) +
    agP('<b>Backing.</b> A limp J-weight cloth for strongly curved shapes, a stiffer X-weight for longer life where the shape allows.', ['EMI6']) +
    agP('<b>Cut-off wheels</b> are abrasive grain in a resin bond with glass fibre reinforcement. They are made to cut straight in at 90° and have no strength for grinding with the side.', ['WEILER']) +
    agP('<b>Thin or thick.</b> A thin wheel cuts faster and cooler and wastes less; a thick one lasts longer.', ['WEILER']) +
    agP('<b>Hard or soft bond.</b> A harder bond lasts longer; a softer bond sheds dull grain sooner and cuts faster.', ['WEILER']) +
    agP('<b>Speed marking.</b> The speed marked on the wheel must be at least the speed of the machine it goes on, and the wheel must fit under the guard.', ['WEILER']) +

    '<h2 id="ag-point">Mounted points</h2>' +
    agP('<b>The speed limit is not one number.</b> The highest safe speed of a mounted point depends on its shape and size, on the diameter of its shank, and on how far the shank sticks out of the collet.', ['NORTON', 'PFERD']) +
    agP('<b>Overhang.</b> The speeds in a maker\'s chart hold for an overhang of 1/2 in. The longer the overhang, the lower the safe speed.', ['NORTON']) +
    agP('<b>Grip.</b> At least 10 mm of the shank must be in the collet.', ['PFERD']) +
    agP('<b>Shapes.</b> A shapes for medium and heavy blending, B shapes for light deburring and finishing, W shapes for offhand and precision grinding.', ['NORTON']) +
    agP('<b>Grit.</b> 36 and coarser for rough grinding; 60 to 90 for a fine finish and on narrow surfaces.', ['NORTON']) +
    agP('Carbide burrs are in the <a href="#/t/shoptools">shop tools guide</a>.', null) +

    '<h2 id="ag-sieve">Sieves and mesh numbers</h2>' +
    agP('<b>Mesh number.</b> Sieve numbers began as the number of openings in one inch of the cloth.', ['GILSON', 'WP_MESH']) +
    agP('<b>Not an exact size.</b> The wires take up room, so the number does not give the opening directly, and different standards give slightly different openings for the same number.', ['WP_MESH']) +
    agP('<b>Standards.</b> ASTM E11 gives the US series of sieves. ISO 565 gives the nominal metric openings, from 125 mm down to 20 µm, and ISO 3310-1 the tolerances on wires and openings.', ['GILSON']) +
    agP('<b>The sources do not all print the same opening.</b> For No. 4, 20 and 200, Gilson and Wikipedia print 4.75 mm, 850 µm and 75 µm, and Sigma-Aldrich prints 4.76 mm, 0.841 mm and 0.074 mm. The table shows what each source prints, in its own units.', ['GILSON', 'WP_MESH', 'SIGMA']) +
    guideTable(['Sieve', 'Gilson (ASTM E11)', 'Wikipedia', 'Sigma-Aldrich'], AG_SIEVE, agTags) +
    agP('Abrasive grit numbers (FEPA, ANSI, JIS) are under <a href="#/t/gritconv">grit size conversion</a>.', null) +

    '<h2 id="ag-src">Sources</h2><ul class="gsl">' + Object.entries(AG_SOURCES).map(([k, v]) => '<li><b>' + k + '</b> ' + gesc(v) + '</li>').join('') + '</ul>' +
    '<p class="desc">Full URLs and access dates are in docs/sources.md, "Abrasive processes guide". No text, figures or tables were copied from the sources.</p>';
  guideToc(el);
}
