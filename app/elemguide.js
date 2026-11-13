// Machine elements guide (parity MH26, ED69, MH266, MH275, MH280, ED73, MH282, MH291).
// All wording and drawings are BenchMate's own. Every statement carries the keys of the public sources read for
// it (docs/sources.md, "Machine elements guide"); one with fewer than two independent publishers is shown as
// "to be verified". Where two sources give different figures both are shown with the source named.
'use strict';

const ME_SOURCES = {
  WP_FR: 'Wikipedia, "Friction" (CC BY-SA)',
  MISUMI: 'MISUMI USA blog, S. Bredemann, "Coefficient of friction", updated 2025-08-15',
  GUNT: 'G.U.N.T., "Engineering mechanics, statics: static and kinetic friction" (gunt.de)',
  WP_BL: 'Wikipedia, "Backlash (engineering)" (CC BY-SA)',
  KHK_BL: 'KHK-USA, B. Dengel, "A primer on backlash, its purpose in gear designs"',
  KHK_GM: 'KHK-USA, B. Dengel, "What are you made of?", Gear Solutions, February 2018',
  MMFG: 'MachineMfg, "Choosing gear materials: essential factors to consider" (no author or date shown)',
  WP_CAM: 'Wikipedia, "Cam (mechanism)" (CC BY-SA)',
  RCET: 'Course material "ME3491 Theory of machines" at rcet.org.in (no author shown)',
  IGETIT: 'i GET IT, S. Tholiya, "Cam and follower mechanism", 2024-03-18',
  WP_PB: 'Wikipedia, "Plain bearing" (CC BY-SA)',
  GS_PB: 'GlobalSpec, "Plain bearings and sleeve bearings information"',
  ARM: 'Armoloy, "Plain bush bearings: selection, failures, fixes", 2026-01-15',
  WP_LS: 'Wikipedia, "Leadscrew" (CC BY-SA)',
  WP_BSC: 'Wikipedia, "Ball screw" (CC BY-SA)',
  MD_BS: 'Machine Design, "Ballscrews vs. lead screws", 2008-01-01',
  ROTON: 'Roton Products, Screw University, "Efficiency and backdriving"',
};
// Several pages of one publisher count once.
const ME_FAMILY = { WP_FR: 'WIKI', WP_BL: 'WIKI', WP_CAM: 'WIKI', WP_PB: 'WIKI', WP_LS: 'WIKI', WP_BSC: 'WIKI', KHK_BL: 'KHK', KHK_GM: 'KHK' };
const meTags = keys => guideTags(keys, ME_SOURCES, ME_FAMILY);
const meP = (html, keys) => '<p>' + html + (keys === null ? '' : ' ' + meTags(keys)) + '</p>';
const meBox = d => '<path class="gfill" d="' + d + '"/><path class="gp" d="' + d + '"/>';

// A block pushed along a surface, and how the friction force answers the push.
function meFric() {
  return cnSvg(420, 176,
    '<path class="gp" d="M20 130H190"/><path class="gm" d="M26 130l-8 10M46 130l-8 10M66 130l-8 10M86 130l-8 10M106 130l-8 10M126 130l-8 10M146 130l-8 10M166 130l-8 10M186 130l-8 10"/>' +
    meBox('M70 90H140V130H70Z') +
    '<path class="gc" d="M105 46V88M105 88l-4 -9M105 88l4 -9M28 110H68M68 110l-9 -4M68 110l-9 4"/>' +
    '<path class="gw" d="M140 150H92M92 150l9 -4M92 150l9 4"/>' +
    cnT(112, 60, 'load', 'gs') + cnT(28, 102, 'push', 'gs') + cnT(146, 154, 'friction', 'gs') +
    '<path class="gm" d="M230 150H402M230 150V46"/>' +
    '<path class="gc" d="M230 150L300 80L306 102H400"/>' +
    cnT(236, 42, 'friction', 'gs') + cnT(402, 166, 'push', 'gs', 'end') +
    cnT(312, 78, 'static limit', 'gs') + cnT(352, 120, 'sliding: kinetic', 'gs', 'middle') + cnT(288, 142, 'at rest', 'gs'),
    'Left: a block on a surface with the load pressing it down, a push along the surface and the friction force acting against the push. Right: a graph of the friction force against the push; friction rises with the push while the block is at rest, up to the limit of static friction, then drops to the lower kinetic value once the block slides');
}
// One tooth in a tooth space, with the gap that is the backlash.
function meBack() {
  return cnSvg(420, 176,
    meBox('M60 24H360V60H262L233.2 132H166.8L138 60H60Z') +
    meBox('M60 90H150L170 140H250L270 90H360V160H60Z') +
    '<path class="gc" d="M246 100H266M246 96V104M266 96V104"/>' +
    '<path class="gm" d="M256 98L286 82M134 82L156 104"/>' +
    cnT(290, 80, 'backlash', 'gs') + cnT(130, 80, 'flanks touch', 'gs', 'end') +
    cnT(84, 46, 'driving gear', 'gs') + cnT(84, 134, 'driven gear', 'gs'),
    'One tooth of the driving gear sitting in a tooth space of the driven gear: the tooth touches the flank on one side, and the gap left on the other side, measured between the flanks, is the backlash');
}
// A plate cam with a roller follower, and the follower movement over one turn.
function meCam() {
  return cnSvg(420, 200,
    meBox('M55 130A40 40 0 0 0 135 130C135 95 118 62 95 62C72 62 55 95 55 130Z') +
    '<circle class="gk" cx="95" cy="130" r="40" style="fill:none"/>' +
    '<circle class="gp" cx="95" cy="130" r="3"/>' +
    meBox('M91 18H99V46H91Z') + '<circle class="gfill" cx="95" cy="53" r="9"/><circle class="gp" cx="95" cy="53" r="9"/>' +
    meBox('M76 22H88V38H76Z') + meBox('M102 22H114V38H102Z') +
    '<path class="gm" d="M104 53H128M135 150l22 20"/>' +
    cnT(132, 57, 'roller follower', 'gs') + cnT(95, 156, 'cam', 'gv', 'middle') + cnT(120, 184, 'base circle', 'gs') +
    '<path class="gm" d="M222 160H406M222 160V84"/>' +
    '<path class="gc" d="M222 160C242 160 252 100 272 100H308C328 100 338 160 358 160H404"/>' +
    '<path class="gm" stroke-dasharray="3 3" d="M272 100V160M308 100V160M358 160V166M222 100H272"/>' +
    cnT(247, 176, 'rise', 'gs', 'middle') + cnT(290, 176, 'dwell', 'gs', 'middle') + cnT(333, 176, 'return', 'gs', 'middle') + cnT(382, 176, 'dwell', 'gs', 'middle') +
    cnT(218, 104, 'lift', 'gs', 'end') + cnT(314, 74, 'follower movement, one turn', 'gs', 'middle'),
    'Left: a plate cam turning on its shaft with a roller follower resting on its edge; the dashed base circle is the smallest circle that fits the cam profile. Right: the displacement diagram for one turn of the cam; the follower rises by the lift, dwells at the top, returns, and dwells at the bottom');
}

const ME_FRIC = [
  ['Steel on steel, dry', 'Wikipedia: 0.74 to 0.80. MISUMI: 0.5 to 0.8', 'Wikipedia: 0.42 to 0.62. MISUMI: 0.42', ['WP_FR', 'MISUMI']],
  ['Steel on steel, lubricated', 'Wikipedia: 0.005 to 0.23. MISUMI: 0.11 to 0.23 with oil, 0.16 with grease', 'Wikipedia: 0.029 to 0.19. MISUMI: 0.081 to 0.084 with oil', ['WP_FR', 'MISUMI']],
  ['Aluminium on steel', '0.61', '0.47', ['WP_FR', 'MISUMI']],
  ['Brass on steel', 'Wikipedia: 0.35 to 0.51. MISUMI: 0.51', '0.44', ['WP_FR', 'MISUMI']],
  ['Copper on steel', '0.53', '0.36', ['WP_FR', 'MISUMI']],
  ['PTFE on steel', 'Wikipedia: 0.04 to 0.2. MISUMI: 0.05 to 0.2. G.U.N.T.: 0.04', 'Wikipedia: 0.04 lubricated', ['WP_FR', 'MISUMI', 'GUNT']],
  ['PTFE on PTFE', '0.04', '0.04', ['WP_FR', 'MISUMI']],
  ['Cast iron on cast iron', '1.1', '0.15', ['MISUMI']],
  ['Cast iron on steel', '0.4', '0.23', ['MISUMI']],
  ['Tungsten carbide on steel', '0.4 to 0.6', 'not given', ['MISUMI']],
];
const ME_GEAR = [
  ['Carbon steel', 'The usual choice. It can be heat-treated', ['KHK_GM', 'MMFG']],
  ['Alloy steel', 'Stronger, and it can be hardened: for high loads and high speeds', ['KHK_GM', 'MMFG']],
  ['Stainless steel', 'Where there is corrosion, such as wash-down and food machinery', ['KHK_GM', 'MMFG']],
  ['Cast iron', 'Damps vibration and machines well, but is brittle: low to moderate speed and power', ['MMFG']],
  ['Bronze, aluminium bronze', 'Worm wheels', ['KHK_GM']],
  ['Aluminium', 'Light, for fine-pitch instrument drives at low torque. It expands much more than steel with heat', ['KHK_GM']],
  ['Plastics: acetal, nylon', 'Light and self-lubricating, and they deaden vibration', ['KHK_GM', 'MMFG']],
];
const ME_CAM = [
  ['Plate (disc, radial) cam', 'A flat plate with a shaped edge. The follower moves in a plane square to the camshaft', ['WP_CAM', 'RCET']],
  ['Cylindrical (barrel) cam', 'A groove cut round a cylinder. The follower rides in the groove', ['WP_CAM', 'RCET']],
  ['Translating (linear, wedge) cam', 'The cam slides in a straight line and does not turn', ['WP_CAM', 'RCET', 'IGETIT']],
  ['Face cam', 'A slot in the face of a disc. The scroll plate of a scroll chuck is one', ['WP_CAM']],
];
const ME_CAMT = [
  ['Base circle', 'The smallest circle that can be drawn to the cam profile, centred on the camshaft', ['WP_CAM', 'RCET', 'IGETIT']],
  ['Pitch curve', 'The path of the follower point (the centre of a roller) as the cam turns', ['RCET', 'IGETIT']],
  ['Prime circle', 'The smallest circle that touches the pitch curve: the base circle radius plus the roller radius', ['WP_CAM', 'RCET']],
  ['Pressure angle', 'The angle between the direction the follower moves and the normal to the pitch curve', ['RCET', 'IGETIT']],
  ['Rise, dwell, return', 'Rise: the follower moves away from the cam centre. Dwell: it stays still. Return: it comes back', ['WP_CAM', 'RCET', 'IGETIT']],
  ['Lift', 'The furthest the follower moves from the base circle', ['IGETIT']],
];
const ME_PB = [
  ['Sleeve (bushing)', 'A plain cylinder, straight inside and out, fitted into a housing', ['WP_PB', 'GS_PB']],
  ['Flanged', 'A flange at one end locates the bushing', ['WP_PB', 'GS_PB']],
  ['Lined', 'A bearing surface of a different material from the body, such as plastic on a metal shell', ['WP_PB', 'GS_PB']],
  ['Thrust washer', 'Carries load along the shaft', ['WP_PB']],
  ['Two half shells', 'For large diameters such as crankshafts. They are crushed slightly when bolted up so that they cannot spin', ['WP_PB']],
];
const ME_PBM = [
  ['Bronze', 'The softer half of the pair: the shaft is harder, and ground or polished', ['WP_PB', 'ARM']],
  ['Sintered bronze', 'Porous, and soaked with oil, so it lubricates itself', ['WP_PB', 'GS_PB']],
  ['Plastics and PTFE linings', 'Can run without added lubricant', ['WP_PB', 'ARM']],
  ['Babbitt', 'Soft, so it does not damage the journal, and dirt beds into it', ['WP_PB']],
  ['Cast iron', 'On a hardened steel shaft it glazes over and wear becomes negligible', ['WP_PB']],
];
const ME_PV = [
  ['Bronze SAE 841', '14 MPa (2000 psi)', '6.1 m/s (1200 sfm)', '1.75 MPa·m/s (50 000 psi·sfm)', ['WP_PB']],
  ['Bronze SAE 660', '28 MPa (4000 psi)', '3.8 m/s (750 sfm)', '2.6 MPa·m/s (75 000 psi·sfm)', ['WP_PB']],
  ['Nylon', '3 MPa (400 psi)', '1.83 m/s (360 sfm)', '0.11 MPa·m/s (3000 psi·sfm)', ['WP_PB']],
  ['PTFE', '3 MPa (500 psi)', '0.5 m/s (100 sfm)', '0.04 MPa·m/s (1000 psi·sfm)', ['WP_PB']],
];
const ME_SCREW = [
  ['How it works', 'The threads of the nut slide on the threads of the screw', 'Balls roll between the screw and the nut', ['MD_BS', 'WP_BSC', 'ROTON']],
  ['Efficiency', 'Low, and it rises with the lead angle. Wikipedia: 20 to 25 % for an Acme screw. Roton: 45 % at a lead angle of 8°, 65 % at 20°', 'About 90 %', ['WP_BSC', 'ROTON', 'MD_BS']],
  ['Holding a load', 'Many are self-locking: the load cannot turn the screw', 'Back-drives: the load can turn the screw', ['WP_LS', 'MD_BS', 'ROTON']],
  ['Cost', 'Lower: few parts', 'Higher: more parts', ['MD_BS', 'WP_BSC', 'WP_LS']],
  ['Backlash', 'A plain nut always has some', 'Can be preloaded so that there is no play', ['WP_BL', 'WP_BSC']],
];

function renderElemGuide(el) {
  const toc = [['me-fric', 'Friction'], ['me-back', 'Backlash'], ['me-gear', 'Gear materials'], ['me-cam', 'Cams'], ['me-plain', 'Plain bearings'], ['me-screw', 'Leadscrews and ball screws']];
  const two = (head, rows) => '<div class="res cntab" style="max-width:none"><table class="gtab"><tr>' + head.map(h => '<th>' + h + '</th>').join('') + '<th>Sources</th></tr>' +
    rows.map(r => '<tr><td><b>' + gesc(r[0]) + '</b></td><td>' + gesc(r[1]) + '</td><td>' + meTags(r[2]) + '</td></tr>').join('') + '</table></div>';
  el.innerHTML =
    '<nav class="gtoc">' + toc.map(([a, t]) => '<a href="#' + a + '">' + t + '</a>').join('') + '</nav>' +
    '<p class="desc">The machine elements a machinist meets when building, fixing or setting up a machine, in our own words: friction and its coefficients, backlash, what gears are made of, cams and followers, plain bearings, and leadscrews against ball screws. The small grey keys after each statement name the public sources it was checked against (list at the bottom). <span class="gtbv">to be verified</span> marks a statement not yet confirmed by two independent publishers. Where the sources give different figures, each figure is shown with its source.</p>' +

    '<h2 id="me-fric">Friction</h2>' + meFric() +
    meP('<b>The basic law.</b> The friction force is proportional to the force pressing the two surfaces together.', ['WP_FR', 'GUNT', 'MISUMI']) +
    meP('<b>Coefficient of friction.</b> The friction force divided by the force pressing the surfaces together. It is a plain number with no unit.', ['WP_FR', 'MISUMI', 'GUNT']) +
    meP('<b>It belongs to the pair.</b> The coefficient depends on the two materials together and on the state of their surfaces, not on one material alone.', ['WP_FR', 'GUNT', 'MISUMI']) +
    meP('<b>Static and kinetic.</b> Static friction acts while the surfaces are not moving and grows with the push up to a limit. Kinetic friction acts once they slide, and it is usually the lower of the two.', ['WP_FR', 'GUNT', 'MISUMI']) +
    meP('<b>Two more laws,</b> both rules of thumb from experiment: friction does not depend on the apparent area of contact, and kinetic friction does not depend on the sliding speed.', ['WP_FR']) +
    meP('<b>Typical size.</b> Most dry pairs lie between 0.3 and 0.6. PTFE can be as low as 0.04.', ['WP_FR']) +
    meP('<b>Angle of friction.</b> The steepest slope on which a body stays put before it starts to slide.', ['WP_FR']) +
    guideTable(['Pair', 'Static', 'Kinetic'], ME_FRIC, meTags) +
    meP('<b>A rough guide only.</b> A coefficient has to be measured for the case in hand: the table values shift with the surface, the temperature and other conditions.', ['WP_FR', 'MISUMI']) +
    meP('A third source gives 0.1 to 0.4 for steel on steel, without saying whether dry or oiled, static or kinetic.', ['GUNT']) +
    meP('For friction in a bolted joint see <a href="#/t/bolttorque">bolt torque and preload</a>.', null) +

    '<h2 id="me-back">Backlash</h2>' + meBack() +
    meP('<b>What it is.</b> Backlash is the play between mating parts: how far one can move before it moves the next. In a pair of gears it is the amount by which the tooth space is wider than the tooth that sits in it.', ['WP_BL', 'KHK_BL']) +
    meP('<b>Why gears need some.</b> To keep the teeth from jamming, to leave room for lubricant, and to allow for heat expansion and for errors of manufacture.', ['WP_BL', 'KHK_BL']) +
    meP('<b>Accuracy.</b> The more accurate the gears, the less backlash they need.', ['WP_BL', 'KHK_BL']) +
    meP('<b>How it is made.</b> By cutting the teeth thinner, or by setting the centres further apart.', ['WP_BL', 'KHK_BL']) +
    meP('<b>Sharing it.</b> Usually half of the allowance is taken off each gear. Where the pinion is much the smaller (one source says this of bevel gears), all of it comes off the larger gear, to keep the pinion strong.', ['WP_BL', 'KHK_BL']) +
    meP('<b>Rule of thumb,</b> in one source: 0.04 in divided by the diametral pitch on average, with 0.03 as the least and 0.05 as the most. In metric, the same three figures in millimetres times the module.', ['WP_BL']) +
    meP('<b>Centre distance.</b> Moving the centres apart opens the backlash at the pitch circle by twice the movement times the tangent of the pressure angle. For the same movement a 20° gear gains 41 % more backlash than a 14.5° gear.', ['KHK_BL']) +
    meP('<b>Do not close the centres</b> to get rid of backlash: it takes away the room for lubricant and leads to early failure.', ['KHK_BL']) +
    meP('What usually matters is the angular backlash at the shaft.', ['KHK_BL']) +
    meP('<b>In a gear train</b> backlash adds up. On reversal the driver turns through the total before the last gear moves.', ['WP_BL']) +
    meP('<b>Anti-backlash gear.</b> The gear is split into two thin halves. One is fixed to the shaft; the other is sprung round so that its teeth bear on the opposite flanks. It works only for loads lighter than the springs.', ['WP_BL']) +
    meP('<b>On a manual machine</b> a leadscrew with a plain nut always has backlash: come up to the final position from the same direction every time.', ['WP_BL']) +
    meP('<b>On a CNC machine</b> ball screws with preloaded nuts take it out. A simple control can instead add the lost movement at each reversal (backlash compensation), which is cheaper but less capable.', ['WP_BL']) +
    meP('For tooth sizes see <a href="#/t/spurgear">spur gear data</a> and <a href="#/t/gearmeasure">gear measurement</a>.', null) +

    '<h2 id="me-gear">Gear materials</h2>' +
    two(['Material', 'What the sources say'], ME_GEAR) +
    meP('<b>Carbon steel</b> is normalised for steady loads with little shock, and quenched and tempered for moderate shock.', ['MMFG']) +
    meP('<b>Worm and wheel.</b> The worm must have the more durable surface, or the flanks score. The worm is steel; the wheel is bronze, aluminium bronze or cast iron.', ['KHK_GM']) +
    meP('<b>Plastics.</b> Nylon changes size with temperature and humidity. Acetal takes up little moisture and holds its size, but is not for shock loads. Plain nylon has about one sixth of the bending strength of a like gear in carbon steel; glass fibre adds about 30 % and carbon fibre about 90 %.', ['KHK_GM']) +
    meP('A plastic gear is often the pinion, running with a larger gear of steel or cast iron.', ['MMFG']) +
    meP('<b>Heat treatment.</b> Carburising gives a hard, wear-resistant case over a tough core. Nitriding gives a very hard surface with no change of size. Induction hardening hardens the teeth alone.', ['MMFG']) +
    meP('<b>Hardness.</b> Soft gears run up to 350 HB. Hardened gears are typically 58 to 65 HRC and are finished by grinding. Between two soft gears keep a difference of 30 to 50 HB or more.', ['MMFG']) +
    meP('See also <a href="#/t/worm">worm and wheel basics</a> and the <a href="#/t/heattreat">heat treatment reference</a>.', null) +

    '<h2 id="me-cam">Cams</h2>' + meCam() +
    meP('<b>What a cam does.</b> The cam is the driver. By direct contact it gives the follower a set movement, most often turning rotation into movement to and fro. The camshaft that opens the valves of an engine is the common example.', ['WP_CAM', 'RCET', 'IGETIT']) +
    two(['Cam', 'How it works'], ME_CAM) +
    meP('<b>Followers</b> are named by what touches the cam: knife edge, roller, flat faced and spherical faced.', ['RCET', 'IGETIT']) +
    meP('The roller has the least friction and wear and suits high speeds. The spherical face puts up with misalignment. The flat face is simple and cheap.', ['IGETIT']) +
    meP('A follower either slides to and fro or swings. One that slides is radial when its line passes through the centre of the camshaft, and offset when it does not.', ['RCET']) +
    two(['Term', 'Meaning'], ME_CAMT) +
    meP('<b>Displacement diagram.</b> A graph of the follower movement against the angle of the cam.', ['WP_CAM']) +
    meP('<b>Motions</b> used for the rise and the return: uniform velocity, uniform acceleration and retardation, simple harmonic, and cycloidal.', ['RCET']) +
    meP('The size of the base circle sets the size of the cam.', ['RCET']) +
    meP('A grooved cam, cylindrical or face, moves the follower both ways and needs no spring.', ['WP_CAM']) +

    '<h2 id="me-plain">Plain bearings</h2>' +
    meP('<b>What it is.</b> A bearing with no rolling parts: the shaft slides on the bearing surface. It is the cheapest kind, compact and light, and it carries a high load.', ['WP_PB']) +
    two(['Form', 'What it is'], ME_PB) +
    two(['Material', 'Notes'], ME_PBM) +
    meP('<b>Plastics have limits:</b> they creep, expand a lot with heat, soften when hot and swell with moisture.', ['WP_PB']) +
    meP('<b>PV.</b> Pressure times sliding speed. Each material has a limit for it, as well as for pressure and for speed alone; beyond the limit the bearing overheats. The lower the PV, the longer the life.', ['WP_PB', 'GS_PB', 'ARM']) +
    guideTable(['Material', 'Top pressure', 'Top speed', 'Top PV'], ME_PV, meTags) +
    meP('<b>The shaft</b> counts too: its hardness and its finish.', ['GS_PB', 'ARM']) +
    meP('One source: 0.2 to 0.4 µm Ra or better for a shaft that runs in a plastic or PTFE bushing.', ['ARM']) +
    meP('<b>Allow for heat.</b> The clearance shrinks as the bearing warms up, and too little of it brings severe wear.', ['GS_PB', 'ARM']) +
    meP('<b>Press fit.</b> Pressing a bushing in closes its bore, so the clearance after fitting is less than before.', ['GS_PB']) +
    meP('The press fit in the housing is what stops the bushing from creeping round. A length of about 0.5 to 1.0 times the diameter is typical, and a shorter bushing puts up with misalignment better.', ['ARM']) +
    meP('<b>Lubrication.</b> With a full film of oil the surfaces do not touch. With a partial film they share the load, and dry they carry all of it. Starting and stopping happen without a full film.', ['WP_PB']) +
    meP('Grease suits pivots; oil suits steady rotation and higher speeds.', ['ARM']) +
    meP('<b>What goes wrong,</b> in one source: seizure from too little lubricant, too tight a clearance or misalignment; wear from too high a PV, abrasive dirt, a soft shaft or a poor finish.', ['ARM']) +
    meP('Rolling bearings are in the <a href="#/t/bearguide">bearings and seals guide</a>; shaft and housing limits are under <a href="#/t/fits">ISO limits and fits</a>.', null) +

    '<h2 id="me-screw">Leadscrews and ball screws</h2>' +
    meP('<b>What they do.</b> Both turn rotation into movement in a straight line. The lead is the distance moved in one turn.', ['WP_LS']) +
    guideTable(['', 'Leadscrew (Acme, trapezoidal)', 'Ball screw'], ME_SCREW, meTags) +
    meP('<b>Self-locking</b> depends on the lead angle and on the friction: a screw with a low lead angle locks, one with a steep lead does not.', ['WP_LS', 'ROTON', 'MD_BS']) +
    meP('The rule in one source: a screw is self-locking when the coefficient of friction is greater than the tangent of the lead angle.', ['WP_LS']) +
    meP('A screw maker\'s example: at a lead angle of 8° the screw locks; at 20° the load drives it back, and a brake is needed to hold the load.', ['ROTON']) +
    meP('Vibration or shock can make a self-locking screw run back. A load that must not fall needs a brake.', ['WP_LS']) +
    meP('<b>Friction in the nut.</b> A steel screw in a bronze nut: 0.15 to 0.23 dry and 0.10 to 0.16 with machine oil in one source; a screw maker works with 0.15.', ['WP_LS', 'ROTON']) +
    meP('<b>Not for running all day.</b> A leadscrew does not suit continuous running.', ['MD_BS', 'WP_LS']) +
    meP('A ball screw that is well chosen stands a high duty cycle. It needs about a third of the driving torque of a leadscrew.', ['MD_BS']) +
    meP('<b>Hand feeds.</b> A ball screw does not suit a hand-fed machine: the cut can drive the screw and feed itself. A leadscrew is the safer one there.', ['WP_BSC']) +
    meP('<b>Thread forms.</b> A square thread is the most efficient and the hardest to make. An Acme thread, with its 29° thread angle, is easier to make and stronger, but less efficient. A buttress thread is for a load in one direction.', ['WP_LS']) +
    meP('<b>Wear.</b> A worn nut on an Acme or trapezoidal screw can be taken up with a split nut.', ['WP_LS']) +
    meP('<b>Rolled or ground.</b> A rolled ball screw costs less than a ground one.', ['WP_BSC', 'MD_BS']) +
    meP('Rolled screws hold several thousandths of an inch per foot, ground ones about one thousandth per foot or better. Accuracy grades run from C0, the most precise, to C10.', ['WP_BSC']) +
    meP('<b>Keep dirt out</b> of a ball screw. Bellows are the usual guard.', ['WP_BSC']) +
    meP('<b>Speed.</b> Run a screw at no more than 80 % of its critical speed, the speed that sets the screw vibrating at its natural frequency.', ['WP_LS']) +
    meP('Thread sizes are under <a href="#/t/acme">ACME and Stub ACME threads</a> and <a href="#/t/trapezoidal">metric trapezoidal threads</a>.', null) +

    '<h2 id="me-src">Sources</h2><ul class="gsl">' + Object.entries(ME_SOURCES).map(([k, v]) => '<li><b>' + k + '</b> ' + gesc(v) + '</li>').join('') + '</ul>' +
    '<p class="desc">Full URLs and access dates are in docs/sources.md, "Machine elements guide". No text, figures or tables were copied from the sources.</p>';
  guideToc(el);
}
