// Milling toolpath guide (parity CN3, CN35, CN37 to CN47, CN56 to CN61, CN67) and workholding guide (CN62 to
// CN73, CN76). All wording and drawings are BenchMate's own. Every statement carries the keys of the public
// sources read for it (docs/sources.md, "Milling toolpath guide" and "Workholding guide"); a statement with
// fewer than two independent publishers is shown as "to be verified".
'use strict';

function guideTags(keys, sources, family) {
  const ks = keys || [];
  const pubs = new Set(ks.filter(k => k !== 'OWN').map(k => family[k] || k));
  return ks.map(k => '<abbr class="gsrc" title="' + gesc(sources[k] || k) + '">' + k + '</abbr>').join('') +
    (pubs.size >= 2 ? '' : '<span class="gtbv" title="Not yet confirmed in two independent public sources">to be verified</span>');
}
function guideTable(head, rows, tags) {
  return '<div class="res cntab" style="max-width:none"><table class="gtab"><tr>' + head.map(h => '<th>' + h + '</th>').join('') + '<th>Sources</th></tr>' +
    rows.map(r => '<tr>' + r.slice(0, head.length).map((c, i) => '<td>' + (i ? '' : '<b>') + gesc(c) + (i ? '' : '</b>') + '</td>').join('') + '<td>' + tags(r[head.length]) + '</td></tr>').join('') + '</table></div>';
}
function guideToc(el) {
  el.querySelectorAll('.gtoc a').forEach(a => a.onclick = e => { e.preventDefault(); const t = el.querySelector(a.getAttribute('href')); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
}

// ------------------------------------------------------------------ milling toolpaths
const TP_SOURCES = {
  ADSK_2D: 'M. Deans, Autodesk Fusion blog, "10 milling toolpaths for your first 2D CNC machining project", 2018-06-28',
  ADSK_3D: 'Autodesk, Inventor CAM 2020 help, "3D machining strategies" (help.autodesk.com)',
  MITCBA: 'MIT Center for Bits and Atoms class page, "Toolpath planning with Fusion 360" (pages.cba.mit.edu; no author or date)',
  HELICAL: 'Helical Solutions, Machining Guidebook: quick reference eBook for CNC milling practices and techniques, 2016',
  MEC: 'MecSoft Corporation, "Best practices in 3 axis machining" (eBook, undated)',
  LCNC_TC: 'LinuxCNC documentation, "Tool compensation": cutter radius compensation (linuxcnc.org)',
  HFO_MP: 'Haas Factory Outlet (Productivity Inc.), Haas Mill Programming manual, revised 06/26',
  ADSK_4AX: 'M. Deans, Autodesk Fusion blog, "Advanced manufacturing with 4-axis CNC milling", 2020-07-20',
  CCB_4AX: 'CNC Cookbook, "4 axis CNC machining: the definitive guide", last modified 2024-07-16',
  LCNC_OV: 'LinuxCNC documentation, "G-code overview", section on linear and rotary axes (linuxcnc.org)',
  OWN: 'BenchMate reasoning or example from the sources beside it',
};
const TP_FAMILY = { ADSK_2D: 'ADSK', ADSK_3D: 'ADSK', ADSK_4AX: 'ADSK', LCNC_OV: 'LCNC_TC' };
const tpTags = keys => guideTags(keys, TP_SOURCES, TP_FAMILY);
const tpP = (html, keys) => '<p>' + html + (keys === null ? '' : ' ' + tpTags(keys)) + '</p>';

// A part seen from above with the 2D features named.
function tpFeatures() {
  return cnSvg(440, 220,
    '<path class="gfill" d="M40 30H400V190H40Z"/><path class="gp" d="M40 30H400V190H40Z"/>' + cnT(46, 24, 'outside wall: contour', 'gs') + cnT(394, 24, 'top: face', 'gs', 'end') +
    '<path class="gp" d="M70 60H200V130H70Z"/>' + cnT(135, 99, 'pocket', 'gv', 'middle') +
    '<path class="gp" d="M240 70H360A12 12 0 0 1 360 94H240A12 12 0 0 1 240 70Z"/>' + cnT(300, 86, 'slot', 'gv', 'middle') +
    '<circle class="gp" cx="250" cy="150" r="9"/><circle class="gp" cx="290" cy="150" r="9"/><circle class="gp" cx="330" cy="150" r="9"/>' + cnT(290, 178, 'holes: spot, drill, tap', 'gs', 'middle') +
    '<path class="gk" d="M46 36H394V184H46Z"/>' + cnT(60, 178, 'edges: chamfer', 'gs') +
    cnT(220, 210, 'seen from above: each feature is cut at fixed depths', 'gs', 'middle'),
    'A prismatic part seen from above with its 2D features named: face, contour, pocket, slot, holes, chamfer');
}
// Three ways into a pocket, seen from the side.
function tpEntry() {
  const cut = (x, lab) => '<path class="gfill" d="M' + x + ' 60H' + (x + 110) + 'V150H' + x + 'Z"/><path class="gp" d="M' + x + ' 60H' + (x + 110) + 'V150H' + x + 'Z"/>' + cnT(x + 55, 170, lab, 'gv', 'middle');
  return cnSvg(440, 200,
    cut(20, 'helix') + '<path class="gc" d="M45 40C105 46 105 58 45 64C105 70 105 82 45 88C105 94 105 106 45 112"/>' + cnT(75, 190, 'first choice', 'gs', 'middle') +
    cut(165, 'ramp') + '<path class="gc" d="M180 46L260 70L180 94L260 118"/>' + cnT(220, 190, 'in a narrow pocket', 'gs', 'middle') +
    cut(310, 'plunge') + cnArrow(365, 34, 365, 116, 'gw') + cnT(365, 190, 'last choice', 'gs', 'middle'),
    'Three ways to enter a pocket: helix, ramp and straight plunge');
}
// A section of a 3D surface: shallow areas and steep walls take different finishing passes.
function tpSteep() {
  return cnSvg(440, 200,
    '<path class="gfill" d="M20 170V120C80 118 110 112 130 96L190 40H250L310 96C330 112 360 118 420 120V170Z"/><path class="gp" d="M20 120C80 118 110 112 130 96L190 40H250L310 96C330 112 360 118 420 120"/>' +
    '<path class="gc" d="M24 112C80 110 104 106 124 90"/><path class="gc" d="M316 90C336 106 360 110 416 112"/><path class="gc" d="M192 32H248"/>' +
    '<path class="gk" d="M134 86L186 38"/><path class="gk" d="M254 38L306 86"/>' +
    cnT(80, 150, 'shallow: parallel', 'gs', 'middle') + cnT(360, 150, 'shallow: parallel', 'gs', 'middle') + cnT(220, 24, 'flat', 'gs', 'middle') +
    cnT(126, 56, 'steep: contour', 'gs', 'end') + cnT(314, 56, 'steep: contour', 'gs') + cnT(220, 190, 'section through a 3D part', 'gs', 'middle'),
    'Section through a 3D part: parallel passes on the shallow areas, contour passes at constant height on the steep walls');
}

const TP_FEATURES = [
  ['Flat top of the part', 'Face', 'Takes the stock down to the top face and leaves a clean surface to work from. A face mill is the usual tool.', ['ADSK_2D', 'MITCBA']],
  ['Outside walls, profiles', '2D contour', 'Follows the outline at one or more depths; roughs and finishes walls.', ['ADSK_2D', 'MITCBA']],
  ['Closed cavity with a floor', '2D pocket', 'Clears the inside of a closed outline, with or without islands, from the middle outward.', ['ADSK_2D', 'MITCBA']],
  ['Cavity or open area, roughing', '2D adaptive clearing', 'Roughs without ever taking a full-width cut, so the load on the tool stays even.', ['ADSK_3D', 'MITCBA']],
  ['Slot', 'Slot', 'A cutter narrower than the slot, entered on a ramp.', ['ADSK_2D', 'HELICAL']],
  ['Holes', 'Spot, drill, tap', 'A spot to start the drill true, the drill (pecking when deep), then the tap.', ['ADSK_2D', 'MITCBA']],
  ['Large holes, round bosses', 'Bore (helical)', 'An end mill spirals down the wall of a hole too big to drill, or round a boss.', ['ADSK_2D']],
  ['Sharp edges', 'Chamfer, radius', 'A chamfer mill or corner-rounding cutter run along the edge as the last operation.', ['ADSK_2D']],
];
const TP_3D = [
  ['Roughing, level by level', 'Clears the stock one Z level at a time, leaving an even skin for finishing. Adaptive roughing does the same while keeping the load on the tool steady.', ['ADSK_3D', 'MEC', 'MITCBA']],
  ['Parallel', 'Straight passes side by side that follow the surface up and down. Best on shallow areas; often run twice at right angles.', ['ADSK_3D', 'MEC']],
  ['Contour (constant Z, waterline)', 'Passes at constant heights round the part. Best on steep walls.', ['ADSK_3D', 'MEC']],
  ['Scallop (constant stepover)', 'Passes kept the same distance apart along the surface, on sloping and upright walls alike; often used to pick up what parallel and contour left.', ['ADSK_3D']],
  ['Spiral, radial', 'A spiral from the centre, or passes like spokes, for round, shallow parts. Radial passes crowd together near the centre.', ['ADSK_3D', 'MEC']],
  ['Horizontal (flats)', 'Finds the flat areas and clears them with a flat-bottomed pass.', ['ADSK_3D']],
  ['Pencil', 'Single passes along inside corners and small fillets that the finishing tool could not reach: a clean-up after the other finishing passes.', ['ADSK_3D']],
];

function renderToolpaths(el) {
  const toc = [['tp-flow', 'Model to part'], ['tp-kind', '2D and 3D'], ['tp-words', 'The words'], ['tp-feat', '2D features'], ['tp-contour', 'Contour'], ['tp-pocket', 'Pockets and slots'], ['tp-edge', 'Chamfer and radius'],
    ['tp-holes', 'Holes'], ['tp-3d', '3D toolpaths'], ['tp-rest', 'Rest and pencil'], ['tp-tol', 'Tolerances'], ['tp-src', 'Sources']];
  el.innerHTML =
    '<nav class="gtoc">' + toc.map(([a, t]) => '<a href="#' + a + '">' + t + '</a>').join('') + '</nav>' +
    '<p class="desc">What each kind of milling toolpath is for and how to set it up, in our own words with our own drawings. The names are the common ones; your CAM system may use others. Each statement shows the keys of the sources that confirm it (hover a key); anything not confirmed by two independent publishers is marked <span class="gtbv">to be verified</span>.</p>' +

    '<h2 id="tp-flow">From model to part</h2>' +
    tpP('<b>The chain.</b> Start from the CAD model. In the CAM system set up the job: the stock and where part zero is. Choose the operation, then the tool and its cutting data, then the geometry it works on. Check the toolpath in simulation. Post-process it, send the program to the machine, set up and cut.', ['MITCBA']) +
    tpP('<b>The post-processor</b> turns the toolpaths into G-code in the dialect of one machine and control. It has to be the one for your machine.', ['MITCBA']) +
    tpP('The machine side of the chain is in the <a href="#/t/millsetup">CNC mill setup guide</a>.', null) +

    '<h2 id="tp-kind">2D, 3D and beyond</h2>' +
    tpP('<b>2D (often called 2.5D).</b> The feature is cut by moving in X and Y; Z only sets the depth of each level. Faces, walls, pockets, slots and holes are all 2D work.', ['ADSK_2D', 'MITCBA']) +
    tpP('<b>3D.</b> The tool follows a curved surface, with Z moving together with X and Y.', ['ADSK_3D', 'MEC']) +
    tpP('<b>3+2.</b> A rotary axis turns the part or the head to a fixed angle and ordinary 2D and 3D toolpaths are run there.', ['ADSK_3D']) +
    '<h3 class="gcat" id="tp-4ax">A fourth axis: indexing and continuous cutting</h3>' +
    tpP('<b>The fourth axis</b> on a mill is usually the A axis: a rotary table or indexer that turns the part about X.', ['ADSK_4AX', 'CCB_4AX']) +
    tpP('<b>Indexing (3+1).</b> The rotary axis turns the part to an angle and stops; only then does the cutting start. It reaches several sides of a part in one setup. Gear teeth cut one at a time are the usual example.', ['ADSK_4AX', 'CCB_4AX']) +
    tpP('<b>Continuous 4-axis.</b> The rotary axis turns while the tool cuts and the other axes move with it. It makes shapes that are hard or impossible any other way; a cam lobe is the usual example.', ['ADSK_4AX', 'CCB_4AX']) +
    tpP('<b>Wrapping.</b> A flat 2D or 3D toolpath is wrapped round a cylinder: what would have been travel along Y becomes rotation of the fourth axis.', ['ADSK_4AX', 'CCB_4AX']) +
    tpP('<b>A brake for indexing.</b> A stopped axis has to hold against the cut, so the rotary axis is often locked with a brake once it is in position.', ['CCB_4AX']) +
    tpP('<b>Programming.</b> Continuous work is harder to program than indexing and asks for a CAM system that can do it.', ['ADSK_4AX']) +
    tpP('<b>Feed on a move that turns the axis.</b> What F means in feed-per-minute mode depends on which axes move in the block. Read the manual of your control before the first cut that turns the rotary axis.', ['LCNC_OV']) +

    '<h2 id="tp-words">The words every toolpath uses</h2>' +
    tpP('<b>Stepover</b> is how far the tool moves sideways between passes: the radial depth, or width, of cut. <b>Stepdown</b> is how far it goes down between levels: the axial depth of cut.', ['ADSK_2D', 'HELICAL']) +
    tpP('<b>Stock to leave</b> (allowance) is the skin a roughing pass leaves on walls and floors for a later pass. Finishing passes leave none.', ['ADSK_2D', 'MEC']) +
    tpP('<b>Lead-in and lead-out.</b> Start a wall cut off the part and come onto it on an arc, which spares the tool the shock of a square entry. Where the entry has to be straight, halve the feed until the cutter is fully in the cut.', ['ADSK_2D', 'HELICAL']) +
    tpP('For climb and conventional milling, and when to use which, see the <a href="#/t/cncguide">CNC knowledge guide</a>.', null) +

    '<h2 id="tp-feat">Which toolpath for which feature</h2>' + tpFeatures() +
    guideTable(['Feature', 'Toolpath', 'What it does'], TP_FEATURES, tpTags) +
    tpP('<b>Facing.</b> If the stock height varies, plan roughing passes before the finishing pass rather than one deep cut.', ['ADSK_2D']) +

    '<h2 id="tp-contour">Contour, with cutter compensation</h2>' +
    tpP('<b>Setting it up.</b> Start off the part. Take the cut a little below the bottom of the wall, as long as that does not reach the vise or the table. Rough with an even skin left on, then take a finishing pass at full depth on a tall wall.', ['ADSK_2D']) +
    tpP('<b>Size from the offset table.</b> For a close tolerance, switch on cutter compensation so the wall can be brought to size at the machine: G41 puts the cutter on the left of the programmed line, G42 on the right, G40 cancels; the radius comes from the D register.', ['ADSK_2D', 'LCNC_TC', 'HFO_MP']) +
    tpP('<b>Rules for G41 and G42.</b> Switch compensation on and off in a straight move, never in an arc, and make that move at least as long as the cutter radius. The control cannot fit a cutter into an inside arc smaller than its radius and will stop with an alarm.', ['LCNC_TC', 'HFO_MP']) +
    '<p class="desc">An example to adapt, not a proven program: the outside of a 60 by 40 mm block, lower left corner at X0 Y0, climb milling with a 10 mm cutter whose radius is in D1.</p>' +
    '<pre class="gcode">G00 X-12. Y-12.        (start clear of the corner, more than a cutter radius away)\nG01 Z-5. F150.         (down to depth beside the part)\nG41 D1 X0. Y-6. F300.  (compensation comes on during this straight move)\nG01 Y40.               (up the left side: the cutter is on the left of the line)\nX60.\nY0.\nX-6.                   (run on past the corner)\nG40 X-12. Y-12.        (compensation comes off during a straight move away)</pre>' +
    tpP('Going clockwise round the outside with G41 keeps the part on the right of the cutter, which is climb milling with a spindle turning clockwise.', ['HFO_MP', 'OWN']) +

    '<h2 id="tp-pocket">Pockets and slots</h2>' + tpEntry() +
    tpP('<b>Getting in.</b> A helix is the first choice where there is room; a ramp along the pocket is next; a hole drilled first to full depth also works. Plunging straight down is the last choice and needs a centre-cutting tool.', ['ADSK_2D', 'HELICAL']) +
    tpP('<b>Starting figures from one tool maker:</b> helix diameter 110 to 120 % of the cutter diameter; ramp angle 3 to 10 degrees in soft and non-ferrous materials, 1 to 3 degrees in steels and hard materials; a pre-drilled hole 5 to 10 % larger than the cutter. See the <a href="#/t/helix">helical interpolation and ramping</a> calculator.', ['HELICAL']) +
    tpP('<b>Clearing.</b> Work from the middle outward, climb milling, and leave the same skin on the walls and the floor for a finishing pass. A roughing cutter with serrated teeth clears fast but leaves a poor wall: finish with a plain end mill.', ['ADSK_2D', 'MITCBA']) +
    tpP('<b>Inside corners.</b> In a corner the cutter is suddenly cutting over a much wider arc, which is where chatter and breakage start. Use a cutter smaller than the corner radius so that it sweeps round the corner, instead of one that fits the corner exactly and stops in it. See <a href="#/t/cornerfeed">corner engagement</a>.', ['HELICAL']) +
    tpP('<b>Deep pockets.</b> Step down in levels, start with a tool of ordinary length to about two or three diameters deep, then change to a longer tool with a relieved neck.', ['HELICAL']) +
    tpP('<b>Slots.</b> Use a cutter narrower than the slot and ramp in. A cutter the full width of the slot is buried on both sides and the chips have nowhere to go.', ['ADSK_2D', 'HELICAL']) +
    tpP('One tool maker suggests a cutter of 55 to 65 % of the slot width at most, taking slices 10 to 15 % of its diameter wide and up to two diameters deep.', ['HELICAL']) +
    tpP('<b>Finishing a wall.</b> A light radial cut of 2 to 5 % of the cutter diameter, climb milling, gives the best finish.', ['HELICAL']) +

    '<h2 id="tp-edge">Chamfer and radius milling</h2>' +
    tpP('<b>Chamfer.</b> A chamfer mill run along the edge breaks sharp corners; it is one of the last operations. Set it so the cutting is done part way up the cone, not at the tip: the <a href="#/t/chamfermill">chamfer mill</a> calculator gives the depth and the offset.', ['ADSK_2D']) +
    tpP('<b>Radius.</b> A corner-rounding cutter follows the same kind of path as a contour to put a radius on an outside edge. A ball-nose cutter on a 3D contour gives much the same result.', ['ADSK_2D']) +

    '<h2 id="tp-holes">Holes: spot, drill, tap</h2>' +
    tpP('<b>Spot first.</b> A spot drill leaves a small cone that keeps the drill from wandering. Go deep enough for the full diameter of the hole, or a little more to leave a chamfer. See <a href="#/t/spotdepth">spot and centre drill depth</a>.', ['ADSK_2D']) +
    tpP('<b>Drill.</b> G81 is the plain drilling cycle and G82 adds a dwell at the bottom. For a deep hole peck (G83, with Q the depth of each peck) so the chips come out. In a through hole go far enough for the whole point to break out.', ['ADSK_2D', 'HFO_MP']) +
    tpP('<b>R plane.</b> In a canned cycle R is the height the tool feeds from and comes back to; G98 returns to the starting height between holes and G99 only to the R plane.', ['HFO_MP']) +
    tpP('<b>Tap.</b> G84 taps a right-hand thread, starting and stopping the spindle by itself. The feed is tied to the speed by the lead of the thread, and the hole has to be the right size first. The Fusion blog suggests tapping holes smaller than No. 6 by hand.', ['ADSK_2D', 'HFO_MP']) +
    tpP('The <a href="#/t/cycdrill">hole cycle generator</a> writes these cycles, and the <a href="#/t/advdrill">drilling</a> and <a href="#/t/advtap">tapping</a> advisors give starting speeds and feeds.', null) +

    '<h2 id="tp-3d">3D toolpaths</h2>' + tpSteep() +
    tpP('<b>The order.</b> Rough first, then semi-finish or finish, then clean up the detail with smaller tools.', ['MEC', 'ADSK_3D']) +
    tpP('<b>Steep or shallow decides.</b> No one finishing pass suits a whole part. Passes that follow the surface in straight lines work on shallow areas; passes at constant height work on steep walls. CAM systems let you limit each to a range of slope, for example contour passes from 30 to 90 degrees and parallel passes for the rest.', ['ADSK_3D', 'MEC']) +
    guideTable(['Toolpath', 'What it does and where it suits'], TP_3D, tpTags) +
    tpP('<b>Tools.</b> Finishing passes on curved surfaces use ball-nose or corner-radius cutters. The stepover sets the height of the ridges left between passes: see <a href="#/t/ballcusp">cusp height and stepover</a>.', ['MEC']) +

    '<h2 id="tp-rest">Rest machining and pencil passes</h2>' +
    tpP('<b>Rest machining</b> cuts only what the tool before could not reach. Working down through smaller and smaller cutters this way cleans the tight places without cutting air over the whole part again.', ['MEC', 'ADSK_3D']) +
    tpP('<b>Pencil passes</b> run a small tool once along each inside corner and small fillet, after the other finishing passes.', ['ADSK_3D']) +

    '<h2 id="tp-tol">3D tolerances</h2>' +
    tpP('<b>A chain of tolerances.</b> The surface you get depends on the tolerance of the CAD model, of the toolpath, of the arc fitting, of the post-processor and of the control. Check each one; one maker of CAM software suggests an arc fitting tolerance of about twice the toolpath tolerance.', ['MEC']) +
    tpP('A tighter tolerance takes longer to compute and makes a longer program.', ['MEC']) +

    '<h2 id="tp-src">Sources</h2><ul class="gsl">' + Object.entries(TP_SOURCES).map(([k, v]) => '<li><b>' + k + '</b> ' + gesc(v) + '</li>').join('') + '</ul>' +
    '<p class="desc">Full URLs and access dates are in docs/sources.md, "Milling toolpath guide". No text, figures or tables were copied from the sources.</p>';
  guideToc(el);
}

// ------------------------------------------------------------------ workholding
const WH_SOURCES = {
  CCB_VISE: 'CNC Cookbook, "Machinist vise: complete guide", modified 2024-03-18 (cnccookbook.com)',
  TORM: 'B. Warfield, Tormach, "The beginner\'s complete guide to machinist vises" (tormach.com/articles)',
  CCB_CLAMP: 'CNC Cookbook, "Easy guide to CNC fixture clamps", modified 2024-02-01 (cnccookbook.com)',
  CIMCO10: 'CIMCO, CNC programming book, chapter 10 "Vise and accessories" (cimco.com/docs/cncbook)',
  NILS: 'J. A. Nilsson, Machine Shop Tutorials, "Work holding secrets" (jonilsson.github.io)',
  JENN: 'M. R. Jennings, Introduction to Machining, 9.11 "Block squaring" (Washington open textbook, CC BY 4.0)',
  ADSK_FIX: 'S. McGarry, Autodesk Fusion blog, "Understanding the top 10 CNC fixturing types", 2022-03-14',
  HELICAL: 'Helical Solutions, Machining Guidebook, 2016: thin wall milling',
  WPI: 'W. Tian and others, HAAS Machine WPI Quick Guide, Worcester Polytechnic Institute, June 2012',
  CIMCO_A: 'CIMCO, CNC programming book, appendix A "CNC milling work-holding examples": projects 8 (clamp), 12 (bracket) and 13 (housing) (cimco.com)',
};
// The Tormach article and the two CNC Cookbook guides share an author and much of their text; the two CIMCO
// keys are one book.
const WH_FAMILY = { CCB_VISE: 'WARF', TORM: 'WARF', CCB_CLAMP: 'WARF', CIMCO10: 'CIMCO', CIMCO_A: 'CIMCO' };
const whTags = keys => guideTags(keys, WH_SOURCES, WH_FAMILY);
const whP = (html, keys) => '<p>' + html + (keys === null ? '' : ' ' + whTags(keys)) + '</p>';

// A step clamp on a part: the bolt close to the part, the heel a little higher than the part.
function whClamp() {
  return cnSvg(440, 200,
    '<path class="gm" d="M20 160H420V180H20Z"/>' +
    '<path class="gfill" d="M40 110H200V160H40Z"/><path class="gp" d="M40 110H200V160H40Z"/>' + cnT(120, 140, 'part', 'gv', 'middle') +
    '<path class="gp" d="M330 98H370V160H330Z"/>' + cnT(350, 134, 'heel', 'gs', 'middle') +
    '<path class="gp" d="M168 104L372 86L374 98L170 116Z"/>' + cnT(300, 76, 'clamp', 'gs', 'middle') +
    '<path class="gp" d="M228 70V160M220 70H236M218 92H238"/>' + cnT(236, 150, 'bolt', 'gs') +
    '<path class="gk" d="M200 110V40M228 60V40"/>' + cnArrow(202, 46, 226, 46, 'gc') + cnT(240, 44, 'keep this short', 'gs') +
    cnT(220, 196, 'bolt close to the part; heel level or a little higher', 'gs', 'middle'),
    'A step clamp holding a part to the table: the bolt close to the part and the heel a little higher than the part');
}

const WH_JAWS = [
  ['Hard jaws', 'Hardened steel, ground on every face. The ordinary jaws, used with parallels under the part.', ['CIMCO10', 'CCB_VISE']],
  ['Step jaws', 'A small step along the top of each jaw carries the part, so no parallels are needed. Bought ready made, or cut into soft jaws.', ['CIMCO10', 'CCB_VISE']],
  ['Soft jaws', 'Aluminium blanks with the shape of the part machined into them, for round or odd shapes, thin walls and second operations.', ['CIMCO10', 'CCB_VISE', 'NILS', 'ADSK_FIX']],
  ['V jaws', 'For round work; they hold a large round part less well than soft jaws cut to fit it.', ['CCB_VISE', 'TORM']],
  ['Dovetail jaws', 'Grip a thin band at the bottom of the stock and lock it against lifting.', ['CCB_VISE', 'TORM']],
];
const WH_SQUARE = [
  ['1', 'Largest face up, on parallels', 'Face it with a light cut; deburr.'],
  ['2', 'Face 1 against the fixed jaw, on one parallel, a round bar between the moving jaw and the part', 'Face the next largest side; deburr. The bar lets face 1 seat flat on the fixed jaw.'],
  ['3', 'Face 1 against the fixed jaw, face 2 down on the parallel, round bar again; tap the part down', 'Cut to size; deburr.'],
  ['4', 'Face 1 down on two parallels, face 2 against the fixed jaw, no bar; tap down', 'Cut to size; deburr.'],
  ['5', 'An end up, face 1 against the fixed jaw, round bar; clamp lightly, set the side upright with an indicator, then tighten', 'Face the end; deburr.'],
  ['6', 'The other end up, face 1 against the fixed jaw, end 5 down on the parallel, round bar; tap down', 'Cut to length; deburr.'],
];

function renderWorkholding(el) {
  const toc = [['wh-rules', 'Rules'], ['wh-vise', 'The vise'], ['wh-align', 'Align a vise'], ['wh-jaws', 'Jaws'], ['wh-soft', 'Soft jaws'], ['wh-square', 'Square a block'], ['wh-clamps', 'Clamps and plates'],
    ['wh-thin', 'Thin parts'], ['wh-sides', 'Flanges and angle plates'], ['wh-many', 'Round and many parts'], ['wh-src', 'Sources']];
  el.innerHTML =
    '<nav class="gtoc">' + toc.map(([a, t]) => '<a href="#' + a + '">' + t + '</a>').join('') + '</nav>' +
    '<p class="desc">Holding work on a mill: the vise and its jaws, clamps and fixture plates, thin parts and tape, in our own words with our own drawings. Each statement shows the keys of the sources that confirm it (hover a key); anything not confirmed by two independent publishers is marked <span class="gtbv">to be verified</span>. A part that comes loose is dangerous: when in doubt hold it better and cut lighter.</p>' +

    '<h2 id="wh-rules">Rules that hold for every setup</h2>' +
    whP('<b>Locate, then clamp.</b> Three points set a plane, two more stop the part turning, one more stops it sliding: the 3-2-1 rule. Clamps push the part against those points; they do not set where it is.', ['NILS']) +
    whP('<b>Enough force, no more.</b> The hold has to suit the part and the cutting forces. Too much squeezes a fragile part out of shape.', ['CIMCO10', 'NILS']) +
    whP('<b>Where clamps go.</b> Close to the cut, over solid, supported material, low on the part. Several light clamps hold better than one heavy one.', ['NILS']) +
    whP('<b>Clean and deburred.</b> Chips or a burr under the part or under the vise put everything out. Clean the table before a vise goes on it, and deburr the part between operations.', ['CCB_VISE', 'NILS', 'JENN']) +

    '<h2 id="wh-vise">The vise and its accessories</h2>' + cnVise() +
    whP('<b>Parts.</b> The fixed jaw does not move and sets the position of the part. The moving jaw is driven by the screw. On a machine vise it is also pulled down onto the bed as it tightens, so the part is not lifted.', ['CIMCO10', 'CCB_VISE']) +
    whP('<b>Parallels</b> are ground steel strips that raise the part in the jaws and keep it square. After clamping, tap both: one that is loose means the part is not seated.', ['CIMCO10', 'CCB_VISE', 'NILS']) +
    whP('<b>Grip high and little.</b> Hold the part high in the jaws on as little of its height as is safe: it repeats better and leaves more of the part free to cut.', ['CCB_VISE', 'TORM']) +
    whP('<b>A vise stop</b> puts every part in the same place along the jaw, so one work offset serves the whole batch.', ['CIMCO10', 'CCB_VISE', 'NILS']) +
    whP('<b>Same pressure each time.</b> Close the vise with the same force for every part, with a torque wrench or to a mark, or the parts will not repeat.', ['CIMCO10']) +
    whP('<b>Take the handle off</b> the vise before the program runs.', ['CIMCO10', 'WPI']) +

    '<h2 id="wh-align">Align a vise</h2>' +
    whP('<b>1.</b> Clean the table and the underside of the vise, set the vise down and bolt it lightly.', ['CCB_VISE', 'CIMCO10']) +
    whP('<b>2.</b> Put an indicator in the spindle against the fixed jaw, never the moving jaw, and run the axis along the length of the jaw.', ['CCB_VISE', 'TORM', 'NILS']) +
    whP('<b>3.</b> Adjust the vise until the reading stays the same from end to end, then tighten the bolts and check again.', ['CCB_VISE', 'CIMCO10']) +
    whP('<b>Two vises.</b> Align the first; clamp a long parallel in it; close the second vise on the same parallel while its bolts are loose, then tighten them.', ['CCB_VISE']) +

    '<h2 id="wh-jaws">Vise jaws</h2>' + guideTable(['Jaws', 'What they are for'], WH_JAWS, whTags) +

    '<h2 id="wh-soft">Making and using soft jaws</h2>' +
    whP('<b>Cut them in place.</b> Bolt the blanks to the vise and machine the shape of the part into them on the machine that will use them, so the pocket is true to that vise.', ['NILS', 'CIMCO10']) +
    whP('<b>Clamp on a spacer while cutting.</b> Close the jaws on a spacer bar, cut the pocket, and take the spacer out before the part goes in.', ['CIMCO10']) +
    whP('<b>Detail.</b> One author cuts the profile 0.001 to 0.002 in undersize so the jaws grip, adds relief in the corners, and numbers each pair for its job.', ['NILS']) +
    whP('<b>Second operations.</b> Jaws cut as the mirror image of the finished first side hold the part for the other side.', ['TORM']) +
    whP('<b>Keep the parts alike.</b> Soft jaws fit one size: parts that vary are held unevenly, and an unevenly held part can come out.', ['ADSK_FIX']) +

    '<h2 id="wh-square">Square a block</h2>' +
    '<p class="desc">Six sides in six settings. The first face cut goes against the fixed jaw for every later cut, so each new face is square to it. From one open textbook: check it against your shop\'s practice. ' + whTags(['JENN']) + '</p>' +
    '<div class="res cntab" style="max-width:none"><table class="gtab"><tr><th>Step</th><th>How the block sits</th><th>Cut</th></tr>' + WH_SQUARE.map(r => '<tr><td><b>' + r[0] + '</b></td><td>' + gesc(r[1]) + '</td><td>' + gesc(r[2]) + '</td></tr>').join('') + '</table></div>' +
    whP('The ends can also be cut with the side of a large end mill, with the block overhanging the side of the vise, instead of standing it on end.', ['JENN']) +

    '<h2 id="wh-clamps">Clamps and fixture plates</h2>' + whClamp() +
    whP('<b>Step clamps.</b> The clamp bridges from the part to a heel block, with a bolt into a T-nut or a tapped hole between them. Put the bolt close to the part, so most of its force goes onto the part and not onto the heel.', ['CCB_CLAMP']) +
    whP('<b>Heel height: the sources differ.</b> One guide sets the heel a step or two above level so the clamp tilts down onto the part; another says to keep clamps level. Either way the heel is never lower than the part.', ['CCB_CLAMP', 'NILS']) +
    whP('Put a strip of soft metal under the clamp to save a finished surface, and use a screw jack under any part of the work that is not supported where a clamp or the cut presses.', ['CCB_CLAMP', 'NILS']) +
    whP('<b>Toe (edge) clamps</b> grip the side of the part and leave the whole top free to machine.', ['CCB_CLAMP']) +
    whP('<b>Fixture plates</b> are plates with a grid of tapped holes and dowel holes, bolted to the table: clamps, stops and vises go on anywhere, and large parts that will not fit a vise are held straight on the plate.', ['NILS', 'CCB_CLAMP', 'ADSK_FIX']) +
    whP('Aluminium plate serves for most work and steel for heavy cutting.', ['NILS']) +

    '<h2 id="wh-thin">Thin parts, tape and glue</h2>' +
    whP('<b>Why they are hard.</b> A thin part bends under the clamp and under the cutter, and springs back afterwards. Watch an indicator on the part as you tighten and stop when it starts to move.', ['NILS']) +
    whP('<b>Vacuum.</b> Air pressure holds a thin flat sheet down without clamps, but only with about 14 psi over the sealed area: enough for light cuts only.', ['ADSK_FIX', 'NILS']) +
    whP('<b>Tape and glue.</b> Double-sided tape, or superglue with a layer of tape between so that no glue touches the part or the machine, holds flat work for light cuts. Wax and low-melting alloys are used the same way.', ['CCB_CLAMP', 'ADSK_FIX']) +
    whP('<b>Sacrificial plate.</b> Fix the part to a plate with glue, tape or screws, clamp the plate and cut through into it.', ['NILS']) +
    whP('Glued and taped work is for light cuts. Superglue lets go with heat; its fumes need ventilation.', ['NILS', 'CCB_CLAMP']) +
    whP('<b>Tabs.</b> Leave the part joined to the stock by small tabs so the stock itself is the fixture, and cut the tabs last.', ['ADSK_FIX']) +
    whP('<b>Thin walls.</b> Take the wall down in steps on alternate sides with lighter and lighter radial cuts (one tool maker gives 50, 30, 15 and then 5 % of the cutter diameter), climb milling.', ['HELICAL']) +

    '<h2 id="wh-sides">Flanges, angle plates and two-sided parts</h2>' +
    whP('<b>A flange of spare stock.</b> Leave a flange round the part and put the clamps on it. They then bear on metal that will be cut away later, so they can be tightened hard without marking the finished part.', ['CIMCO_A']) +
    whP('<b>Check for lift.</b> After clamping a plate, try to slide a sheet of paper or a feeler gauge under it. On a fixture, tap the part down with a soft mallet first.', ['CIMCO_A']) +
    whP('<b>Angle plate.</b> A stiff, ground plate that stands a part on edge so that its ends and sides can be reached. Bolt the plate to the table and set it true, seat a finished face of the part against it and clamp it there, level the part with a square and then with an indicator, and pick up the new zero. Keep the part from standing far beyond the plate and cut lightly: an unsupported edge rings.', ['CIMCO_A']) +
    whP('<b>Two-sided plate parts on dowels.</b> Cut the first side with a flange left on, and drill dowel holes in the flange. Make a fixture plate with matching dowel holes, turn the part over onto the dowels and clamp it by the flange. The dowels have to stand lower than the finished thickness, so that the facing cutter passes over them.', ['CIMCO_A']) +
    whP('<b>Shoulder bolts.</b> Once the second side is faced, shoulder bolts through holes in the part locate it and hold it to the fixture while the flange is cut away. Check that each bolt really grips the part.', ['CIMCO_A']) +

    '<h2 id="wh-many">Round parts and many parts</h2>' +
    whP('<b>Round work</b> is held in soft jaws cut to its diameter, in a collet block or in a chuck standing on the table.', ['ADSK_FIX', 'CCB_VISE', 'NILS']) +
    whP('<b>Several parts at once.</b> A double-station vise, or several vises in a row, lets one program cut a first and a second operation, or several parts, in one cycle. Vises used together have to be matched in height.', ['ADSK_FIX', 'CCB_VISE']) +
    whP('<b>Several parts from one bar.</b> Machine all the parts side by side in one piece of bar, then turn the bar over in the vise and face it away until the parts come free.', ['CIMCO_A']) +
    whP('Lathe chucks and collets are in the <a href="#/t/latheguide">CNC lathe guide</a>; chuck grip against speed is in <a href="#/t/chuckforce">chuck jaw force</a>.', null) +

    '<h2 id="wh-src">Sources</h2><ul class="gsl">' + Object.entries(WH_SOURCES).map(([k, v]) => '<li><b>' + k + '</b> ' + gesc(v) + '</li>').join('') + '</ul>' +
    '<p class="desc">Full URLs and access dates are in docs/sources.md, "Workholding guide". No text, figures or tables were copied from the sources.</p>';
  guideToc(el);
}
