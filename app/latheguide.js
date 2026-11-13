// CNC lathe guide (parity CN49, CN50, CN51, CN53, CN54) and glossary (CN82). All wording and drawings are
// BenchMate's own. Every statement in the guide carries the keys of the public sources read for it
// (docs/sources.md, "CNC lathe guide"); one with fewer than two independent publishers is shown as
// "to be verified". The glossary is our own wording; each entry links to the page that explains the term.
'use strict';

const LG_SOURCES = {
  CIMCO8: 'CIMCO, CNC programming book, chapter 8 "CNC turning": lathe components, driven tools, tools and tool holders, lathe tool types, cutting speeds and feeds, setup and programming example (cimco.com)',
  HFO_LP: 'Haas Factory Outlet (Productivity Inc.), Haas Lathe Programming manual, revised 12/2024',
  HAAS_CUT: 'Haas Automation, "Mounting cut-off tools" (tooling instruction sheet, no date)',
  PM_COL: 'Production Machining, "Collets vs. chucks", 2001-03-15, updated 2019-08-28',
  PM_PART: 'C. Koepfer, Production Machining, "Five process security tips when parting off", 2014-05-23 (advice from a Sandvik Coromant specialist)',
  MMS_BAR: 'D. Korn, Modern Machine Shop, "Bar puller basics", 2006',
  CCB_LATHE: 'CNC Cookbook, "Lathe workholding" (no author named; page dated 2010 to 2016)',
  CTC_DRV: 'D. Garner, CNC Training Centre, "Driven tools (live tooling) milling on a CNC lathe", 2024-06-06',
  MMC: 'Mitsubishi Materials, training course page "Insert selection for external turning" (mmc-carbide.com)',
  HAAS_G32: 'Haas Automation, lathe G-code page "G32 thread cutting" (its figure of the lead did not come through)',
  HAAS_G76: 'Haas Automation, lathe G-code page "G76 threading cycle, multiple pass"',
  CTE_SP: 'K. Hanson, Cutting Tool Engineering, "Single-point thread programming can be fun and easy", 2016-08-05',
  CTE_MS: 'T. Lipton, Cutting Tool Engineering, "Cutting multiple-start threads", 2012-09-01 (manual lathe)',
  MMS_MS: 'M. Lynch, Modern Machine Shop, "Dealing with multiple start threads on turning centers", 2006-02-01 (only the first part of the page could be read)',
  IMD_G78: 'Industrial Monitor Direct, "G78 R value for NPT tapered threading: correct calculation method", 2026-05-29 (its angle figures do not agree with each other and are not used)',
  IMD_MS: 'Industrial Monitor Direct, "Programming Masso G3 G32 taper and multi-start threads", 2026-09-28',
  OWN: 'BenchMate reasoning from the sources beside it',
};
// Production Machining and Modern Machine Shop have one publisher; the two Haas documents count once.
const LG_FAMILY = { PM_COL: 'GARDNER', PM_PART: 'GARDNER', MMS_BAR: 'GARDNER', MMS_MS: 'GARDNER', HFO_LP: 'HAAS', HAAS_CUT: 'HAAS', HAAS_G32: 'HAAS', HAAS_G76: 'HAAS', CTE_SP: 'CTE', CTE_MS: 'CTE', IMD_G78: 'IMD', IMD_MS: 'IMD' };
const lgTags = keys => guideTags(keys, LG_SOURCES, LG_FAMILY);
const lgP = (html, keys) => '<p>' + html + (keys === null ? '' : ' ' + lgTags(keys)) + '</p>';

// Insert shapes in order of edge strength.
function lgInserts() {
  const rh = (cx, a) => { const s = 34, l = s * Math.cos(a * Math.PI / 360), w = s * Math.sin(a * Math.PI / 360);
    return '<path class="gp" d="M' + cx + ' ' + (70 - l).toFixed(1) + 'L' + (cx + w).toFixed(1) + ' 70L' + cx + ' ' + (70 + l).toFixed(1) + 'L' + (cx - w).toFixed(1) + ' 70Z"/>'; };
  return cnSvg(440, 170,
    '<circle class="gp" cx="45" cy="70" r="22"/>' + cnT(45, 122, 'round', 'gs', 'middle') +
    '<path class="gp" d="M95 50H135V90H95Z"/>' + cnT(115, 122, 'square', 'gs', 'middle') +
    rh(185, 80) + cnT(185, 122, '80°', 'gs', 'middle') +
    '<path class="gp" d="M233 57H277L255 95Z"/>' + cnT(255, 122, 'triangle', 'gs', 'middle') +
    rh(325, 55) + cnT(325, 122, '55°', 'gs', 'middle') +
    rh(395, 35) + cnT(395, 122, '35°', 'gs', 'middle') +
    cnArrow(250, 146, 420, 146, 'gc') + cnArrow(190, 146, 20, 146, 'gc') + cnT(24, 162, 'stronger edge', 'gs') + cnT(416, 162, 'reaches further', 'gs', 'end'),
    'Turning insert shapes from the strongest edge to the one that reaches furthest: round, square, 80 degree diamond, triangle, 55 degree diamond, 35 degree diamond');
}
// A bar in the chuck with the operations numbered in the usual order.
function lgOrder() {
  return cnSvg(440, 204,
    '<path class="gm" d="M16 30H90V64H16Z"/><path class="gm" d="M16 156H90V190H16Z"/>' + cnT(53, 24, 'jaws', 'gs', 'middle') +
    '<path class="gk" d="M60 60H406V160H60"/>' +
    '<path class="gfill" d="M60 64H200V74H312V94H322V88H400V132H322V126H312V146H200V156H60Z"/>' +
    '<path class="gp" d="M130 64H200V74H312V94H322V88H400V132H322V126H312V146H200V156H130"/><path class="gp" d="M60 64H130M60 156H130"/>' +
    '<path class="gk" d="M8 110H432"/>' +
    cnArrow(416, 58, 416, 104, 'gc') + cnT(436, 48, '1 face', 'gs', 'end') +
    '<path class="gc" d="M308 68H204M196 58H136"/>' + cnT(256, 50, '2 rough, 3 finish', 'gs', 'middle') +
    '<path class="gk" d="M317 128V166"/>' + cnT(317, 180, '4 groove', 'gs', 'middle') +
    cnT(361, 80, '5 thread', 'gs', 'middle') +
    '<path class="gk" d="M400 104H352L346 110L352 116H400"/><path class="gk" d="M376 118V166"/>' + cnT(378, 180, '6 drill', 'gs', 'middle') +
    cnArrow(130, 26, 130, 58, 'gw') + cnT(140, 20, '7 cut off', 'gs', 'middle') +
    cnT(220, 200, 'one part from bar, in the usual order', 'gs', 'middle'),
    'A bar held in chuck jaws with the turning operations numbered in the usual order: face, rough, finish, groove, thread, drill, cut off');
}
// Parting off seen along the spindle axis.
function lgPart() {
  return cnSvg(440, 196,
    '<circle class="gfill" cx="130" cy="100" r="56"/><circle class="gp" cx="130" cy="100" r="56"/><circle class="gk" cx="130" cy="100" r="14"/>' +
    '<path class="gk" d="M50 100H424"/>' +
    '<path class="gm" d="M300 84H410V150H300Z"/>' + cnT(355, 122, 'tool block', 'gs', 'middle') +
    '<path class="gp" d="M186 100H300V134H196Z"/>' + cnT(250, 122, 'blade', 'gs', 'middle') +
    cnT(190, 92, 'edge on centre', 'gs') +
    '<path class="gk" d="M186 140V172M300 152V172"/>' + cnArrow(240, 166, 188, 166, 'gc') + cnArrow(246, 166, 298, 166, 'gc') + cnT(243, 186, 'overhang: as short as the cut allows', 'gs', 'middle') +
    cnT(130, 28, 'slow the feed near the centre', 'gs', 'middle') + '<path class="gk" d="M130 84V34"/>',
    'Parting off seen along the spindle: the blade edge on the centre line, a short overhang from the tool block, and the zone near the centre where the feed is reduced');
}
// Axial and radial live tools.
function lgLive() {
  return cnSvg(440, 200,
    '<path class="gm" d="M16 50H70V150H16Z"/>' + cnT(43, 76, 'chuck', 'gs', 'middle') +
    '<path class="gfill" d="M70 64H250V136H70Z"/><path class="gp" d="M70 64H250V136H70Z"/><path class="gk" d="M8 100H432"/>' +
    '<path class="gp" d="M254 80H320V88H254Z"/><path class="gm" d="M320 68H400V100H320Z"/>' + cnT(360, 58, 'axial holder: the face', 'gs', 'middle') +
    '<path class="gp" d="M166 24H174V60H166Z"/><path class="gm" d="M146 4H194V24H146Z"/>' + cnT(202, 18, 'radial holder: the diameter', 'gs') +
    '<path class="gc" d="M100 150C80 166 80 182 104 188"/>' + cnArrow(100, 187, 106, 189, 'gc') + cnT(114, 180, 'C: the spindle as a rotary axis', 'gs') +
    cnT(300, 150, 'tool turns, part is held', 'gs', 'middle'),
    'Live tools on a lathe: an axial holder working on the face of the part and a radial holder working on its diameter, with the spindle used as the C axis');
}

const LG_HOLD = [
  ['Three-jaw chuck, hard jaws', 'Quick, and holds a wide range of sizes. A part taken out and put back does not run true again, so finish all you can in one chucking. Three jaws mark finished surfaces and can squeeze a thin wall out of round.', ['CCB_LATHE']],
  ['Three-jaw chuck, soft jaws', 'Jaws bored on the machine to the diameter they will grip, so the part runs true to the spindle. The usual way on a CNC lathe. One page gives 0.0006 to 0.0012 in run-out for freshly bored jaws.', ['CCB_LATHE', 'CIMCO8']],
  ['Collet chuck', 'Grips all round the part: truer running, rounder parts and less marking than jaws. Each collet fits one size.', ['PM_COL', 'CCB_LATHE']],
  ['Four-jaw chuck', 'Each jaw is set by hand against an indicator: square, odd-shaped and off-centre work.', ['CCB_LATHE']],
  ['Six-jaw chuck', 'Spreads the grip over more of the part: thin-walled tube and finished surfaces.', ['CCB_LATHE']],
  ['Between centres', 'Centre holes in both ends and a driving dog. The part can come out and go back and still run true.', ['CCB_LATHE']],
  ['Expanding mandrel', 'Grips in the bore and leaves the whole outside free. It holds only a limited cutting force.', ['CCB_LATHE']],
  ['Faceplate', 'Irregular parts clamped on as on a mill table, with counterweights if they are out of balance.', ['CCB_LATHE']],
];
const LG_TOOLS = [
  ['Rough turning and facing', 'Strong inserts: the 80 degree diamond, also square and round. The 80 degree diamond both turns and faces, which makes it the usual first tool on a CNC lathe.', ['CIMCO8', 'MMC']],
  ['Finishing and profiling', '55 and 35 degree diamonds: weaker edges, but they follow contours and reach details the 80 degree shape cannot.', ['CIMCO8', 'MMC']],
  ['Boring bar', 'Finishes a hole to size. It points along the spindle axis and needs a hole big enough to go in and come out safely.', ['CIMCO8']],
  ['Grooving tool', 'Known by its width and corner radii: O-ring and snap ring grooves, and turning where no diamond fits. Made for outside, inside and face grooves.', ['CIMCO8']],
  ['Cut-off (parting) tool', 'A narrow blade for deep cuts, known by its width and deepest cut. It stands little side force.', ['CIMCO8']],
  ['Threading tool', 'An insert with the form of the thread. A small thread on the centre line of the part can be tapped instead.', ['CIMCO8', 'HFO_LP']],
  ['Spot drills, drills and taps', 'Used on the centre line of the part as on a mill, but here the part turns.', ['CIMCO8', 'OWN']],
];
const LG_PATHS = [
  ['1 Face', 'First: it gives a known end to set Z from and a flat face to drill into. Sawn ends vary, so allow a roughing and a finishing pass.', 'G94 (one pass per block), G72 (roughing in steps)', ['CIMCO8', 'HFO_LP']],
  ['2 Rough turn', 'Takes off the bulk in passes and leaves an even skin for the finishing tool.', 'G71, the shape between blocks P and Q', ['CIMCO8', 'HFO_LP']],
  ['3 Finish turn', 'One pass along the shape for size and surface finish.', 'G70 over the same P and Q', ['CIMCO8', 'HFO_LP']],
  ['4 Groove', 'Straight-walled grooves plunged with a grooving tool.', 'G75 (outside or inside), G74 (in the face)', ['CIMCO8', 'HFO_LP']],
  ['5 Thread', 'Several passes of a threading insert, each a little deeper.', 'G76 (the whole thread), G92 (one pass per block)', ['CIMCO8', 'HFO_LP']],
  ['6 Drill, tap, bore', 'A drill on the centre line, pecking if the hole is deep; a tap for a small thread; a boring bar to finish a hole to size.', 'G81, G83 (peck), G74 (peck), G84 (tap)', ['CIMCO8', 'HFO_LP']],
  ['7 Cut off', 'Last: it parts the piece from the bar, and can put a chamfer or a radius on the back edge on the way.', 'no cycle for it in the manual read', ['CIMCO8', 'HFO_LP']],
];

function renderLatheGuide(el) {
  const toc = [['l-parts', 'The machine'], ['l-hold', 'Holding the part'], ['l-bar', 'Bar work'], ['l-tools', 'Tools'], ['l-speed', 'Speeds and feeds'], ['l-paths', 'Toolpaths'], ['l-thread', 'Threading'], ['l-part', 'Parting off'], ['l-live', 'Live tools'], ['l-src', 'Sources']];
  el.innerHTML =
    '<nav class="gtoc">' + toc.map(([a, t]) => '<a href="#' + a + '">' + t + '</a>').join('') + '</nav>' +
    '<p class="desc">Turning on a CNC lathe: how the part is held, the common tools, the toolpaths in the order they are run, parting off and live tools, in our own words with our own drawings. Each statement shows the keys of the sources that confirm it (hover a key); anything not confirmed by two independent publishers is marked <span class="gtbv">to be verified</span>. Axes, offsets and nose radius compensation are in the <a href="#/t/cncguide">CNC knowledge guide</a>.</p>' +

    '<h2 id="l-parts">The machine</h2>' +
    lgP('<b>What it is for.</b> A lathe spins the part and moves the tool, which suits round parts such as shafts, pins and pulleys. The kind described here, a turning centre, has one spindle and one tool turret.', ['CIMCO8']) +
    lgP('<b>Spindle and chuck.</b> The spindle turns the chuck, and the chuck grips the part in hard jaws, soft jaws or a collet. The three-jaw power chuck is the usual one.', ['CIMCO8', 'PM_COL']) +
    lgP('<b>Turret.</b> Tool holders bolt to the face or the rim of the turret, and a tool change is the turret turning the next tool round to the part. Keep the turret far enough from the part that no tool hits it on the way round.', ['CIMCO8']) +
    lgP('<b>Radial and axial.</b> Turning, grooving and cut-off tools stand out radially. Boring bars point along the spindle axis so that they can go into the bore and come out again.', ['CIMCO8']) +
    lgP('<b>Door.</b> Keep it shut while the machine runs, and do not run a lathe whose window is cracked: the window is what stops a thrown part or a broken tool.', ['CIMCO8']) +

    '<h2 id="l-hold">Holding the part</h2>' + guideTable(['Method', 'What it does and where it suits'], LG_HOLD, lgTags) +
    lgP('<b>Chuck or collet: the sources differ on the size.</b> One trade article gives collets for diameters from 1/16 in to 2.5 in and calls a three-jaw chuck clumsy for very small parts; another page puts the limit at about 3 in.', ['PM_COL', 'CCB_LATHE']) +
    lgP('<b>Why a collet runs well.</b> It is lighter than a chuck, so the spindle picks up speed faster and vibrates less, and a collet chuck typically runs true within 0.0005 in.', ['CCB_LATHE']) +
    lgP('<b>Length.</b> Chuck jaws close square to the axis, so every part sits at the same place along Z. A draw-in collet pulls the part back as it closes, and how far depends on the size of the bar: one article gives 0.003 in along Z for each 0.001 in of diameter.', ['PM_COL']) +
    lgP('<b>Grip.</b> Enough to hold the part against the cut, but not so much that a thin-walled part is squeezed out of shape.', ['CIMCO8', 'CCB_LATHE']) +
    lgP('<b>Speed and stick-out.</b> Every chuck has a top speed that depends on the weight of the part and how far it sticks out, and its jaws may only be set outward so far; both limits are in the chuck maker\'s documents. Stock without support at the far end can only stick out so far.', ['CIMCO8']) +
    lgP('Grip against speed is worked out in <a href="#/t/chuckforce">centrifugal force and chuck grip</a>, and how far a slender part bends in <a href="#/t/slender">slender part deflection</a>.', null) +

    '<h2 id="l-bar">Bar work</h2>' +
    lgP('<b>Through the spindle.</b> A bar passes through the hole in the spindle. After each part is cut off the jaws open, the bar is drawn out by the length of the next part and the jaws close again, so the stock does not have to be sawn to length first.', ['CIMCO8', 'MMS_BAR']) +
    lgP('<b>Bar puller.</b> A gripper in one turret station takes hold of the end of the bar, and the turret moves back along Z to pull the next length out. It takes no floor space and needs no wiring to the control.', ['MMS_BAR']) +
    lgP('<b>Puller or feeder.</b> A bar feeder suits long runs with nobody at the machine; a puller suits small and medium batches.', ['MMS_BAR']) +
    lgP('<b>Leave room.</b> Set the back of the part as close to the jaws as the cut-off tool allows and no closer: a tool that touches turning jaws is dangerous. Let the stock stand a little past the finished face so the facing cut cleans up the sawn end.', ['CIMCO8']) +
    lgP('<b>Part catcher.</b> A chute that swings out during the cut-off, so the part rolls into a tray.', ['CIMCO8']) +

    '<h2 id="l-tools">Common lathe tools</h2>' + lgInserts() + guideTable(['Tool', 'What it is for'], LG_TOOLS, lgTags) +
    lgP('<b>Strong or reaching.</b> The larger the nose angle of the insert, the stronger the edge and the less it can reach into a shape.', ['MMC', 'CIMCO8']) +
    lgP('<b>Round inserts</b> have the strongest edge and leave the best finish, but they push hardest on the part and can set a small or thin part vibrating.', ['MMC']) +
    lgP('<b>Nose radius.</b> Usually 0.4 to 1.2 mm. A larger radius is stronger and suits heavy cuts; a smaller one is for finishing. When an insert with another radius goes in, change the offset too, or the sizes move.', ['MMC']) +
    lgP('<b>Hand.</b> A left-hand holder has its cutting edge pointing left when you look down on it. Which hand a lathe takes depends on where its turret sits.', ['CIMCO8']) +
    lgP('<b>Insert and holder</b> have to match in type, size, shape and clamping. Most turning is done with carbide inserts, which are turned to a fresh edge when one wears.', ['CIMCO8']) +
    lgP('The codes are decoded in <a href="#/t/insertcode">insert designation</a> and <a href="#/t/holdercode">toolholder designation</a>; the finish a nose radius leaves is in <a href="#/t/finish">surface finish from nose radius</a>; a long bar is checked in <a href="#/t/boringbar">boring bar overhang</a>.', null) +

    '<h2 id="l-speed">Speeds and feeds</h2>' +
    lgP('<b>Speed comes from the diameter.</b> Take the surface speed the insert maker recommends for the material and work out the rpm at the diameter where the tool first touches the part.', ['CIMCO8']) +
    lgP('<b>Feed is per revolution</b> on a lathe (G99 on Haas), so the chip stays the same thickness when the speed changes.', ['CIMCO8', 'HFO_LP', 'OWN']) +
    lgP('<b>Constant surface speed</b> for turning and facing, always with a top speed set. Use a fixed rpm for drilling and tapping on the centre line, where the diameter of the cut does not change.', ['CIMCO8']) +
    lgP('The rpm is worked out in <a href="#/t/rpm">spindle speed</a>, starting values for a material come from the <a href="#/t/advturn">turning advisor</a>, and G96 with its speed limit is in the <a href="#/t/cncguide">CNC knowledge guide</a>.', null) +

    '<h2 id="l-paths">Toolpaths, in the usual order</h2>' + lgOrder() +
    guideTable(['Operation', 'What it does', 'Haas cycle'], LG_PATHS, lgTags) +
    lgP('<b>Nose radius compensation.</b> G41 and G42 start on a straight approach move. The plunging and threading cycles (G74, G75, G76, G92) ignore compensation: cancel it before them.', ['HFO_LP']) +
    lgP('The cycles are named as Haas uses them; other controls use some of the same numbers differently, so check your own in <a href="#/t/gmcodes">G and M codes</a>. The blocks are written for you by <a href="#/t/cycg71">G71 / G70 rough and finish</a>, <a href="#/t/cycgroove">groove and cut-off</a>, <a href="#/t/cycthread">lathe threading</a> and <a href="#/t/cyctaper">lathe taper program</a>.', null) +

    '<h2 id="l-thread">Threading</h2>' +
    lgP('<b>G32, one move per block.</b> G32 makes a single threading move. Getting into position, the infeed, the pull-out and the way back are each programmed, about four lines for every pass, and a thread takes many passes.', ['HAAS_G32', 'CTE_SP']) +
    lgP('<b>G92 and G76.</b> G92 makes one whole pass per block, with a new X for each pass. G76 cuts the whole thread from one or two blocks.', ['CTE_SP', 'HFO_LP']) +
    lgP('<b>Tied to the spindle.</b> In a threading move the feed follows the turning of the spindle, so every pass runs in the groove of the one before. The speed must stay the same from the first pass to the last: thread at a fixed speed (G97), not at constant surface speed.', ['HAAS_G32', 'CTE_SP', 'IMD_MS']) +
    lgP('<b>F is the lead:</b> how far the tool travels along the thread in one turn.', ['HAAS_G76', 'CTE_SP', 'IMD_MS']) +
    lgP('<b>Override and feed hold.</b> Haas: the feed override is ignored in G32, and feed hold and single block wait for the end of the threading moves. Cutting Tool Engineering: feed hold does nothing during a threading pass.', ['HAAS_G32', 'CTE_SP']) +
    lgP('<b>Speed against feed.</b> A coarse thread at a high speed asks a lot of the Z axis: 8 threads per inch at 1600 rpm is 200 in/min.', ['CTE_SP']) +
    lgP('<b>Room to get up to speed.</b> Start each pass far enough in front of the part for the axis to reach its feed.', ['IMD_MS']) +
    lgP('<b>G32 on a Haas.</b> G32 is modal and is cancelled by another motion code such as G00. The chamfer codes M23 and M24 do nothing in G32, so a pull-out has to be programmed. Nothing brings the tool back at the end of a pass.', ['HAAS_G32']) +
    lgP('<b>Tapered thread with G32.</b> Put an X move in the same block as the Z move.', ['HAAS_G32', 'CTE_SP', 'IMD_MS']) +
    lgP('The lead on a taper: Haas says to program the larger of the lead along X and the lead along Z. Industrial Monitor Direct notes that some controls take F along Z and others along the path, and says to measure the lead on a steep taper.', ['HAAS_G32', 'IMD_MS']) +
    lgP('<b>Tapered thread in a cycle.</b> The taper is a difference in radius between the start and the end of the threading move, not an angle: the word I in a Haas G76; R in a two-block G76 (Cutting Tool Engineering) and in the one-pass cycle G78 (Industrial Monitor Direct).', ['HAAS_G76', 'IMD_G78', 'CTE_SP']) +
    lgP('An ordinary outside taper thread, small at the front, takes a negative value.', ['HAAS_G76', 'IMD_G78']) +
    lgP('An inside taper thread takes a positive value, the length counts from where the tool starts in front of the part, and one make of control turns the signs round: check the manual of yours.', ['IMD_G78']) +
    lgP('<b>More than one start.</b> The lead is the pitch times the number of starts, and it is the lead that goes in F.', ['MMS_MS', 'CTE_MS', 'IMD_MS']) +
    lgP('The depth of the thread is that of the pitch, not of the lead.', ['CTE_MS']) +
    lgP('<b>Getting to the next start.</b> Either begin one pitch further along Z, or turn the start by 360° divided by the number of starts. The two come to the same thread.', ['CTE_MS', 'IMD_MS']) +
    lgP('Industrial Monitor Direct cuts every start at one depth before going deeper.', ['IMD_MS']) +
    lgP('<b>Start angle on a Haas.</b> The word Q in G32 gives the angle at which the thread starts, in thousandths of a degree without a decimal point: Q180000 is 180°. It is not modal, so it goes in every block that needs it.', ['HAAS_G32']) +
    lgP('The passes and the G76 or G92 blocks of a straight, single-start thread are written by <a href="#/t/cycthread">lathe threading</a>; lead, pitch and the shift between starts are worked out in <a href="#/t/multistart">multi-start thread lead and pitch</a>; the taper of pipe threads is in <a href="#/t/pipethreads">pipe threads</a>.', null) +

    '<h2 id="l-part">Parting off</h2>' + lgPart() +
    lgP('<b>On centre.</b> Set the cutting edge on the centre line of the spindle. The figures differ a little: within 0.1 mm (0.004 in) in a trade article that quotes a tool maker, within 0.005 in on a machine maker\'s sheet.', ['PM_PART', 'HAAS_CUT']) +
    lgP('Above centre the clearance under the edge closes up and the tool rubs and chatters. Below centre the cutting forces rise and the insert chips.', ['PM_PART']) +
    lgP('<b>Short blade.</b> Set the blade out only as far as the cut needs. The trade article\'s guide is an overhang of no more than 8 to 10 times the width of the insert.', ['HAAS_CUT', 'PM_PART']) +
    lgP('<b>Slow the feed near the centre.</b> As the diameter shrinks the spindle reaches its top speed and the cutting speed falls away. Both sources cut the feed: by up to 75 % from 2 mm (0.080 in) off centre in one; by 50 to 75 % from about 6 mm (0.250 in) off centre, or as soon as the spindle is at top speed, in the other.', ['PM_PART', 'HAAS_CUT']) +
    lgP('<b>Do not cross the centre.</b> Stop the feed just short of the centre line, or at most go past it by the corner radius of the insert. At the centre the cutting speed is zero and the insert only rubs.', ['PM_PART']) +
    lgP('<b>Coolant: the sources differ.</b> The machine maker\'s sheet says always to use coolant when parting off, aimed at the insert and at high pressure if the machine has it. The tool maker\'s advice is to switch it off once the spindle is at top speed or slowing, because a cold edge at low speed picks up a built-up edge, most of all with hard grades and stainless steel.', ['HAAS_CUT', 'PM_PART']) +
    lgP('<b>Sub-spindle.</b> When a second spindle holds the part, draw it away by 0.001 to 0.002 in before the tool reaches the centre, so the cut does not pinch.', ['PM_PART']) +
    lgP('How long the cut takes with and without constant surface speed is in <a href="#/t/partofftime">part-off and groove time</a>.', null) +

    '<h2 id="l-live">Live tools</h2>' + lgLive() +
    lgP('<b>What they are.</b> Drills, end mills and taps that rotate, held in the turret and driven through their holders. With them a lathe mills flats, drills and taps holes in the face and cuts cross holes and slots in the diameter, so a part that would need a second machine is made on one.', ['CIMCO8', 'CTC_DRV']) +
    lgP('<b>Axial and radial.</b> An axial holder points the tool along the spindle axis, for work on the face. A radial holder points it at the centre line, for work on the diameter.', ['CIMCO8', 'CTC_DRV']) +
    lgP('<b>C axis.</b> For milling, the main spindle stops being a spindle and becomes a rotary axis, C, programmed in degrees. It can go to an angle and hold there, or turn in step with the other axes.', ['CIMCO8', 'CTC_DRV']) +
    lgP('<b>Milling a shape on the face.</b> With polar interpolation the shape is programmed in X and Y as on a mill and the control turns it into X and C moves. It is switched on with G112 and off with G113 on Haas, and with G12.1 and G13.1 on some other controls.', ['CTC_DRV', 'HFO_LP']) +
    lgP('<b>Y axis.</b> A turret that also moves up and down mills in X and Y like a milling machine and gives more choice, such as radial slots. Without one, the cutter has to stand exactly on centre.', ['CTC_DRV']) +
    lgP('<b>Codes on Haas.</b> M133 runs the live tool forward, M134 runs it in reverse and M135 stops it.', ['HFO_LP']) +
    lgP('<b>Feed per minute.</b> Milling with a live tool is fed per minute (G98), since the main spindle is not turning to count revolutions from. Go back to feed per revolution (G99) for turning: forgetting to switch is a common mistake.', ['CTC_DRV', 'HFO_LP', 'OWN']) +
    lgP('<b>Limits.</b> The holders are costly and each one takes a turret station. Their alignment to the centre line matters: one trainer traces most live tool trouble to it.', ['CTC_DRV']) +
    lgP('The speed limit of the live tool spindle is kept in <a href="#/t/machines">machine profiles</a>, and the feed for a move that turns C is in <a href="#/t/rotfeed">rotary axis feed</a>.', null) +

    '<h2 id="l-src">Sources</h2><ul class="gsl">' + Object.entries(LG_SOURCES).map(([k, v]) => '<li><b>' + k + '</b> ' + gesc(v) + '</li>').join('') + '</ul>' +
    '<p class="desc">Full URLs and access dates are in docs/sources.md, "CNC lathe guide". No text, figures or tables were copied from the sources.</p>';
  guideToc(el);
}

// ------------------------------------------------------------------ glossary
// [term, meaning in our own words, id of the page that explains it or null]
const GLOSSARY = [
  ['1-2-3 block', 'A hardened and ground steel block measuring 1 x 2 x 3 in, used as a known height or a square support in a setup.', 'millsetup'],
  ['2D toolpath (2.5D)', 'A cut made by moving in X and Y while Z stays at a set depth for each level.', 'toolpaths'],
  ['3D toolpath', 'A cut in which Z moves together with X and Y so that the tool follows a curved surface.', 'toolpaths'],
  ['3+2 machining', 'A rotary axis turns the part to a fixed angle and ordinary toolpaths are run there.', 'toolpaths'],
  ['Absolute programming (G90)', 'Every coordinate is measured from the work zero.', 'cncguide'],
  ['Axial depth of cut', 'How deep the cutter is engaged along its own axis. In a CAM system: the stepdown.', 'toolpaths'],
  ['Ball-nose end mill', 'An end mill with a hemispherical end, for curved surfaces.', 'ballcusp'],
  ['Bar feeder, bar puller', 'Two ways to bring the next length of bar through a lathe spindle: a feeder pushes from behind, a puller in the turret draws it out.', 'latheguide'],
  ['Block', 'One line of a program.', 'cncguide'],
  ['Boring bar', 'A bar that carries a cutting edge into a hole to bring it to size.', 'boringbar'],
  ['Built-up edge (BUE)', 'Work material welded onto the cutting edge. It spoils the finish and can pull pieces out of the edge when it breaks away.', 'toolwear'],
  ['Burr', 'The thin raised edge of metal that a cut leaves behind.', null],
  ['C axis', 'A rotary axis about Z. On a lathe: the main spindle used as a positioning axis.', 'latheguide'],
  ['CAD', 'Computer-aided design: drawing the model of the part.', 'toolpaths'],
  ['CAM', 'Computer-aided manufacturing: software that works out toolpaths from the model.', 'toolpaths'],
  ['Canned cycle', 'One block that makes the control carry out a whole routine, such as drilling a hole in pecks.', 'cycdrill'],
  ['Chatter', 'Vibration between tool and work that leaves a regular pattern on the surface.', 'chatter'],
  ['Chip load (feed per tooth)', 'How far the cutter advances for each tooth that passes.', 'feed'],
  ['Chip thinning', 'With a light radial cut the chip is thinner than the feed per tooth, so the feed can be raised to bring it back.', 'chipthin'],
  ['Chuck', 'A holder with jaws that close on the work in a lathe, or on a drill.', 'latheguide'],
  ['Climb milling', 'The cutter turns so that each tooth starts with a thick chip and ends with a thin one.', 'cncguide'],
  ['CNC', 'Computer numerical control: a machine whose movements are run by a program.', 'cncguide'],
  ['Collet', 'A split sleeve that closes all round a tool or a bar to grip it.', 'latheguide'],
  ['Constant surface speed (CSS, G96)', 'The control changes the spindle speed as the diameter changes so that the cutting speed stays the same.', 'cncguide'],
  ['Contour', 'A toolpath along the outline of a wall.', 'toolpaths'],
  ['Conventional milling', 'The cutter turns so that each tooth starts with a thin chip and ends with a thick one.', 'cncguide'],
  ['Coolant', 'Fluid that cools and lubricates the cut and carries the chips away.', 'coolconc'],
  ['Cusp (scallop) height', 'The height of the ridge left between two neighbouring passes of a ball-nose cutter.', 'ballcusp'],
  ['Cutter compensation (CDC; G41, G42)', 'The control shifts the path by the radius of the tool, to the left or to the right of the programmed line.', 'toolpaths'],
  ['Cutting speed (surface speed)', 'How fast the cutting edge passes the work, in m/min or ft/min.', 'rpm'],
  ['Datum', 'A point, line or surface that dimensions are measured from.', 'gdtguide'],
  ['Deflection', 'How far a tool or a part bends away under the cutting force.', 'deflection'],
  ['Drill chart', 'A table of drill sizes: number, letter, fraction and metric, with their decimal sizes.', 'drillchart'],
  ['Dry run', 'Running a program above the part, or with no part, to see the moves before anything is cut.', 'millsetup'],
  ['Dwell (G04)', 'A programmed pause in the feed while the spindle keeps running.', 'gmcodes'],
  ['Edge finder', 'A spring-loaded tool whose tip kicks sideways when it touches an edge, used to find where that edge is.', 'millsetup'],
  ['End mill', 'A milling cutter with teeth on its end and along its side.', 'toolguide'],
  ['Facing', 'Cutting a flat surface: across the top of a part on a mill, across its end on a lathe.', 'toolpaths'],
  ['Feed', 'How fast the tool moves through the work: per minute, per revolution or per tooth.', 'feed'],
  ['Feed hold', 'The button that stops the axes while the spindle keeps running.', 'millsetup'],
  ['First article', 'The first part from a new setup, measured in full before the batch is run.', 'millsetup'],
  ['Fixture', 'A device made to locate and hold a particular part.', 'workholding'],
  ['Fixture plate', 'A plate with a grid of tapped and dowel holes, bolted to the machine table.', 'workholding'],
  ['Flute', 'The groove along a cutter that forms the cutting edge and carries the chip out.', 'toolguide'],
  ['G-code', 'Program words beginning with G that tell the control how to move: rapid, feed, arc, cycles.', 'gmcodes'],
  ['Gouge', 'A cut into material that was meant to stay.', null],
  ['Helix angle', 'The angle between the flutes of a cutter and its axis.', 'toolguide'],
  ['High-speed machining (HSM)', 'Light, fast cuts that keep the load on the tool even, at high spindle speed and feed.', null],
  ['Home (machine zero, reference point)', 'The fixed position each axis goes to at start-up. Machine coordinates are measured from it.', 'millsetup'],
  ['ID, OD', 'Inside diameter, outside diameter.', null],
  ['Imaginary tool tip', 'The point where the X and Z touch-off lines of a lathe tool meet. The round nose of the insert lies inside it.', 'tnrc'],
  ['Incremental programming (G91)', 'Every coordinate is measured from where the tool is now.', 'cncguide'],
  ['Indicator', 'An instrument whose needle shows small movements of its plunger or lever, used to set work true.', null],
  ['Insert', 'A replaceable cutting tip clamped in a holder.', 'insertcode'],
  ['Jog', 'Moving an axis by hand from the control.', 'millsetup'],
  ['Lead-in, lead-out', 'The move that brings the tool onto a contour and the one that takes it off, so that it does not start or stop on the finished wall.', 'toolpaths'],
  ['Live tool (driven tool)', 'A rotating tool in a lathe turret.', 'latheguide'],
  ['M-code', 'Program words for machine functions: spindle, coolant, tool change, end of program.', 'gmcodes'],
  ['Machine coordinates', 'Positions measured from machine home; the same whatever part is on the machine.', 'cncguide'],
  ['MDI', 'Manual data input: typing a block or a few at the control and running them.', 'millsetup'],
  ['Milling machine (mill)', 'A machine that moves a rotating cutter over a part that is held still.', 'cncguide'],
  ['Modal', 'Said of a code that stays in force until another code of its group replaces it.', 'cncguide'],
  ['Nose radius', 'The radius on the corner of a turning insert.', 'finish'],
  ['Offset', 'A stored correction: tool length, tool radius, wear, or the position of the work zero.', 'cncguide'],
  ['Optional stop (M01)', 'A stop in the program that takes effect only when the optional stop switch is on.', 'gmcodes'],
  ['Overcut', 'More material removed than the drawing asks for.', null],
  ['Override', 'A knob or key that scales the programmed feed, rapid or spindle speed by a percentage.', 'millsetup'],
  ['Parallels', 'Ground steel strips in matched pairs that raise the part in a vise.', 'workholding'],
  ['Parting off (cut-off)', 'Separating the finished part from the bar with a narrow blade.', 'latheguide'],
  ['Peck drilling', 'Drilling in steps with a retract between them, to break the chips and clear them.', 'cycdrill'],
  ['Pencil pass', 'A single finishing pass along an inside corner.', 'toolpaths'],
  ['Pitch', 'The distance from one thread, or one tooth, to the next.', 'threaddata'],
  ['Plunge', 'Feeding straight down into the material.', 'toolpaths'],
  ['Pocket', 'A closed recess cut into a face.', 'toolpaths'],
  ['Post-processor', 'The part of a CAM system that writes the toolpaths as G-code in the dialect of one control.', 'toolpaths'],
  ['Radial depth of cut', 'How wide a band the cutter takes sideways. In a CAM system: the stepover.', 'chipthin'],
  ['Rake angle', 'The slope of the face of the tool that the chip slides over.', 'toolguide'],
  ['Ramp', 'Entering the material at a shallow angle while moving sideways.', 'helix'],
  ['Rapid (G00)', 'A positioning move at the top speed of the machine; not for cutting.', 'gmcodes'],
  ['Reamer', 'A tool with several edges that takes a light cut to bring a drilled hole to an accurate size and a good finish.', 'toolguide'],
  ['Rest machining', 'Cutting only the material that a larger tool before could not reach.', 'toolpaths'],
  ['Rigid tapping', 'Tapping with the rotation of the spindle locked to the feed, so that no floating holder is needed.', 'advtap'],
  ['Run-out (TIR)', 'How far a surface moves in and out as it turns: the total indicator reading.', 'runout'],
  ['Setup', 'One holding of the part, with its work zero and its tools; also the work of getting a machine ready.', 'millsetup'],
  ['Setup sheet', 'The page that tells the operator how the part is held, where zero is and which tool goes where.', 'setupsheet'],
  ['Single block', 'A mode in which the control runs one block for each press of cycle start.', 'millsetup'],
  ['Soft jaws', 'Jaws of soft metal machined to the shape of the part.', 'workholding'],
  ['Spindle', 'The rotating shaft that carries the tool on a mill and the work on a lathe.', null],
  ['Spindle speed', 'How fast the spindle turns, in revolutions per minute.', 'rpm'],
  ['Spring pass', 'A finishing pass run again with no more cut put on, to take off what the bending of the tool left.', null],
  ['Stepdown', 'The distance the tool goes down between levels.', 'toolpaths'],
  ['Stepover', 'The distance between one pass and the next beside it.', 'toolpaths'],
  ['Stock to leave (allowance)', 'Material left by a roughing cut for the finishing cut to remove.', 'toolpaths'],
  ['Surface finish (Ra)', 'The average height of the roughness of a surface.', 'surface'],
  ['T-slot', 'A slot shaped like an upside-down T in a machine table, which takes the heads of clamping bolts.', 'tslots'],
  ['Tailstock', 'The support at the far end of a lathe bed, carrying a centre that holds up long work.', null],
  ['Tap', 'A tool that cuts or forms a thread in a hole.', 'tapdrill'],
  ['Thread milling', 'Cutting a thread by moving a rotating cutter along a helix.', 'cyctmill'],
  ['Tolerance', 'The amount by which a size is allowed to vary.', 'fits'],
  ['Tool changer', 'The mechanism that swaps tools between the spindle and a magazine.', null],
  ['Tool length offset (TLO; G43 H)', 'The stored length that tells the control where the tip of each tool is.', 'millsetup'],
  ['Tool nose radius compensation', 'Cutter compensation on a lathe: the control allows for the round corner of the insert on tapers and arcs.', 'tnrc'],
  ['Toolpath', 'The path the tool follows for one operation.', 'toolpaths'],
  ['Turret', 'The tool carrier of a lathe, which turns to bring each tool to the part.', 'latheguide'],
  ['Undercut', 'A recess behind a shoulder or under an overhang that a straight tool cannot reach from above.', null],
  ['Vise stop', 'A stop fixed to the vise or the table that puts every part in the same place.', 'workholding'],
  ['Wear offset', 'A small correction added to the offset of a tool as its edge wears, to bring the parts back to size.', 'cncguide'],
  ['Work coordinates (work offset; G54)', 'Positions measured from a zero chosen on the part or the fixture. The work offset is the distance from machine home to that zero.', 'cncguide'],
];
const GL_STATE = { q: '' };

function renderGlossary(el) {
  const title = id => (TOOLS.find(t => t.id === id) || {}).title || id;
  el.innerHTML = '<p class="desc">Shop and CNC words in plain language, in BenchMate\'s own wording. The link beside a meaning opens the page that explains the term, with the sources for it.</p>' +
    '<div class="mfilter"><input type="search" data-k="q" placeholder="Search the glossary" aria-label="Search the glossary" value="' + gesc(GL_STATE.q) + '" style="flex:1 1 260px;max-width:360px"></div><div id="glres"></div>';
  function show() {
    const q = GL_STATE.q.trim().toLowerCase();
    const rows = GLOSSARY.filter(r => !q || (r[0] + ' ' + r[1]).toLowerCase().includes(q));
    el.querySelector('#glres').innerHTML = '<div class="res cntab" style="max-width:none"><table class="gtab"><tr><th>Term</th><th>Meaning</th><th>Explained in</th></tr>' +
      rows.map(r => '<tr><td><b>' + gesc(r[0]) + '</b></td><td>' + gesc(r[1]) + '</td><td>' + (r[2] ? '<a href="#/t/' + r[2] + '">' + gesc(title(r[2])) + '</a>' : '') + '</td></tr>').join('') + '</table></div>' +
      '<p class="desc">' + rows.length + ' of ' + GLOSSARY.length + ' terms shown.</p>';
  }
  el.querySelector('[data-k="q"]').oninput = e => { GL_STATE.q = e.target.value; show(); };
  show();
}
