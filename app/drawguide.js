// Drawings and weld symbols guide (parity MH69, MH73, MH185, MH194, ED86, BB71).
// All wording and drawings are BenchMate's own. Every statement carries the keys of the public sources read for
// it (docs/sources.md, "Drawings and weld symbols guide"); one with fewer than two independent publishers is
// shown as "to be verified". Where two sources put a thing differently both are shown.
'use strict';

const DG_SOURCES = {
  WIP: 'What Is Piping, "Types of lines in engineering/technical drawings and their uses"',
  MU: 'Lecture "Engineering drawing", types of lines, at engineering.mu.edu.iq (no author shown)',
  WP_ED: 'Wikipedia, "Engineering drawing" (CC BY-SA)',
  WP_PS: 'Wikipedia, "Paper size" (CC BY-SA)',
  WP_Y141: 'Wikipedia, "ANSI/ASME Y14.1" (CC BY-SA)',
  WP_BS: 'Wikipedia, "BS 8888" (CC BY-SA)',
  MCG: 'McGill University, Engineering Design pages, "Working drawings and assemblies"',
  MCG2: 'McGill University, Engineering Design pages, "Drawing format and elements"',
  TUD: 'TU Darmstadt, CAD tutorial, "2.2 View, cuts, and hatching"',
  DA: 'DraftAid blog, "Section view drawings: uncovering what\'s hidden", 2025-12-08',
  DA2: 'DraftAid blog, "Assembly drawing types and tips", 2025-11-19',
  XOMP: 'Xometry Pro, A. Velling and A. Aksin, "First angle vs. third angle projection: what\'s the difference?", 2026-05-11',
  GDTB: 'GD&T Basics, B. John, "How does 1st angle projection work?", 2021-01-19',
  W24: 'Werk24 knowledge base, "Title block"',
  OWA: 'D. M. Donner, "Introduction to machining" (WA Open ProfTech, SBCTC, CC BY 4.0), section 3.2 "Sheet size and format"',
  MILLER: 'Miller Electric, "Deciphering weld symbols" and "How to read and understand weld symbols"',
  WGURU: 'WeldGuru, J. Grill, "Welding symbols: basics and meanings explained", updated 2024-01-12',
  C5: 'Clause5, "ISO 2553 vs AWS A2.4: welding symbol differences explained"',
  MW: 'Material Welding, S. Kumar, "Difference between ISO 2553 and AWS D1.1 welding symbols", 2020-12-22',
  STRUC: 'STRUCTURE Magazine, J. McCool, "Commonly misapplied welding symbols", 2023-02-01',
  SIGM: 'Sigmetrix, "What is MBD? A beginner\'s guide to model-based definition", 2025-05-08',
  ETMM: 'ETMM (European Tool and Mould Making), M. Zwettler, "What is model based definition?", 2022-02-14',
  GIM: 'Get It Made, L. Smoothy, "CAD file formats for CNC machining", 2022-02-22',
  GIBBS: 'CAMBRIO, GibbsCAM manual "Data exchange", version 14, 2020',
  IMD: 'Industrial Monitor Direct knowledge base, "3D CAD file formats compared: STEP vs IGES vs Parasolid vs native", 2026-05-07',
  D3D: 'DEVELOP3D, S. Holmes, "UK\'s national standard for engineering drawings is now all BS 8888:2017", 2017-02-15',
};
// Several pages of one publisher count once.
const DG_FAMILY = { WP_ED: 'WIKI', WP_PS: 'WIKI', WP_Y141: 'WIKI', WP_BS: 'WIKI', MCG: 'MCGILL', MCG2: 'MCGILL', DA: 'DRAFTAID', DA2: 'DRAFTAID' };
const dgTags = keys => guideTags(keys, DG_SOURCES, DG_FAMILY);
const dgP = (html, keys) => '<p>' + html + (keys === null ? '' : ' ' + dgTags(keys)) + '</p>';
const dgBox = d => '<path class="gfill" d="' + d + '"/><path class="gp" d="' + d + '"/>';

// Samples of the line types, each with its name.
function dgLines() {
  const y = i => 20 + 22 * i;
  const thin = 'style="stroke-width:1"', thick = 'style="stroke-width:3"';
  let hatch = '';
  for (let x = 24; x <= 150; x += 9) hatch += 'M' + x + ' ' + (y(6) + 7) + 'l14 -14';
  return cnSvg(420, 198,
    '<path class="gp" ' + thick + ' d="M20 ' + y(0) + 'H160"/>' +
    '<path class="gp" ' + thin + ' stroke-dasharray="6 4" d="M20 ' + y(1) + 'H160"/>' +
    '<path class="gp" ' + thin + ' stroke-dasharray="20 4 4 4" d="M20 ' + y(2) + 'H160"/>' +
    '<path class="gp" ' + thick + ' stroke-dasharray="20 5 5 5" d="M26 ' + y(3) + 'H154"/><path class="gp" d="M22 ' + (y(3) - 8) + 'V' + (y(3) + 6) + 'M22 ' + (y(3) + 6) + 'l-3 -6M22 ' + (y(3) + 6) + 'l3 -6M158 ' + (y(3) - 8) + 'V' + (y(3) + 6) + 'M158 ' + (y(3) + 6) + 'l-3 -6M158 ' + (y(3) + 6) + 'l3 -6"/>' +
    '<path class="gp" ' + thin + ' stroke-dasharray="20 4 4 4 4 4" d="M20 ' + y(4) + 'H160"/>' +
    '<path class="gp" ' + thin + ' d="M20 ' + y(5) + 'H160M20 ' + y(5) + 'l8 -3M20 ' + y(5) + 'l8 3M160 ' + y(5) + 'l-8 -3M160 ' + y(5) + 'l-8 3"/>' +
    '<path class="gp" ' + thin + ' d="' + hatch + '"/>' +
    '<path class="gp" d="M20 ' + y(7) + 'q12 -9 24 0t24 0t24 0t24 0t24 0t20 0"/>' +
    ['visible edge: thick, continuous', 'hidden edge: short dashes', 'centre line: long and short dashes', 'cutting plane: thick chain, arrows', 'phantom: long, two short', 'dimension line: thin, arrowheads', 'section lining (hatching)', 'break line'].map((t, i) => cnT(180, y(i) + 4, t, 'gs')).join(''),
    'Samples of eight line types on a drawing: a thick continuous line for a visible edge, short dashes for a hidden edge, long and short dashes for a centre line, a thick chain line with an arrow at each end for a cutting plane, one long and two short dashes for a phantom line, a thin line with arrowheads for a dimension line, thin sloping parallel lines for section lining, and a wavy line for a break');
}
// Where the views go in first angle and in third angle projection, with the symbol of each.
function dgProj() {
  const box = (x, y, t) => '<path class="gp" d="M' + x + ' ' + y + 'h60v34h-60Z"/>' + cnT(x + 30, y + 21, t, 'gs', 'middle');
  const cone = x => dgBox('M' + x + ' 157l30 -8v30l-30 -8Z');
  const rings = cx => '<circle class="gp" cx="' + cx + '" cy="164" r="15"/><circle class="gp" cx="' + cx + '" cy="164" r="7"/>';
  return cnSvg(470, 196,
    cnT(115, 16, 'first angle', 'gv', 'middle') + cnT(355, 16, 'third angle', 'gv', 'middle') + '<path class="gm" d="M235 8V190"/>' +
    box(120, 28, 'front') + box(120, 72, 'top') + box(50, 28, 'right') +
    cone(70) + rings(128) + '<path class="gk" d="M62 164H150"/>' + cnT(162, 168, 'symbol', 'gs') +
    box(290, 72, 'front') + box(290, 28, 'top') + box(360, 72, 'right') +
    rings(300) + cone(328) + '<path class="gk" d="M278 164H366"/>' + cnT(378, 168, 'symbol', 'gs'),
    'Where the views go. First angle: the top view sits below the front view and the view from the right sits to the left of it; in the symbol the circles are next to the large end of the cone. Third angle: the top view sits above the front view and the view from the right sits to the right of it; in the symbol the circles are next to the small end of the cone');
}
// A welding symbol with its parts named (AWS reading).
function dgWeld() {
  return cnSvg(470, 172,
    '<path class="gp" d="M150 90H400M400 90l16 -12M400 90l16 12M150 90L96 138M96 138l3 -10M96 138l10 -3"/>' +
    '<circle class="gc" cx="150" cy="90" r="6"/><path class="gc" d="M150 84V60"/><path class="gacc" d="M150 60l16 5l-16 5Z"/>' +
    '<path class="gp" d="M240 90V72L258 90M240 90V108L258 90"/>' +
    cnT(234, 108, '6', 'gv', 'end') + cnT(264, 108, '50-150', 'gv') +
    cnT(266, 82, 'other side', 'gs') + cnT(334, 108, 'arrow side', 'gs') +
    cnT(200, 40, 'reference line', 'gs', 'middle') + '<path class="gm" d="M200 44V86"/>' +
    cnT(150, 52, 'field weld', 'gs', 'middle') + cnT(138, 86, 'all around', 'gs', 'end') +
    cnT(424, 94, 'tail', 'gs') + cnT(84, 154, 'arrow, to the joint', 'gs', 'middle') +
    cnT(226, 140, 'size', 'gs', 'middle') + '<path class="gm" d="M228 128L230 112"/>' + cnT(306, 140, 'length - pitch', 'gs', 'middle') + '<path class="gm" d="M290 128L286 112"/>',
    'A welding symbol read the AWS way: a reference line with an arrow to the joint at one end and a tail at the other; a fillet weld triangle below the line for the arrow side and one above the line for the other side; the size 6 to the left of the triangle and the length and pitch 50-150 to the right; a small circle where the arrow meets the line for weld all around, and a flag at the same point for a field weld');
}

const DG_SET = [
  ['Detail (part) drawing', 'One part, with all its dimensions and its material: enough to make the part', ['MCG', 'DA2']],
  ['Assembly drawing', 'The parts in their working positions, numbered, with a parts list', ['MCG', 'DA2']],
  ['Subassembly drawing', 'A group of parts that is put together first, with its own drawing and its own parts list', ['MCG', 'DA2']],
  ['Sectioned assembly', 'An assembly cut open to show the inside', ['MCG', 'DA2']],
  ['Exploded view', 'The parts drawn apart but in line, to show how they go together', ['MCG', 'DA2']],
  ['Outline assembly', 'The outside shape only, for catalogues and installation', ['MCG']],
  ['Weldment drawing', 'An assembly of parts joined by welding, with the welding symbols', ['DA2']],
];
const DG_ISO = [
  ['A0', '841 × 1189', ['WP_PS', 'MCG2']],
  ['A1', '594 × 841', ['WP_PS', 'MCG2']],
  ['A2', '420 × 594', ['WP_PS', 'MCG2']],
  ['A3', '297 × 420', ['WP_PS', 'MCG2']],
  ['A4', '210 × 297', ['WP_PS', 'MCG2']],
];
const DG_ANSI = [
  ['A', '8.5 × 11', ['WP_Y141', 'OWA']],
  ['B', '11 × 17', ['WP_Y141', 'OWA']],
  ['C', '17 × 22', ['WP_Y141', 'OWA']],
  ['D', '22 × 34', ['WP_Y141', 'OWA']],
  ['E', '34 × 44', ['WP_Y141', 'OWA']],
];
const DG_LINE = [
  ['Visible edge', 'Thick, continuous', 'Edges and outlines that can be seen', ['WIP', 'WP_ED', 'MU']],
  ['Hidden edge', 'Short dashes, thinner than a visible edge', 'Edges that cannot be seen in this view', ['WIP', 'WP_ED', 'MU']],
  ['Centre line', 'Thin, long and short dashes in turn', 'Axes of round features, lines of symmetry', ['WIP', 'WP_ED', 'MU']],
  ['Dimension and extension lines', 'The dimension line ends in arrowheads, between two extension lines', 'Showing what a dimension runs between', ['WIP', 'MU']],
  ['Leader', 'At an angle, ending in an arrowhead', 'Tying a note or a number to a feature', ['WIP', 'MCG']],
  ['Section lining (hatching)', 'Parallel lines, usually at 45°', 'The material cut through in a section', ['WIP', 'MU', 'TUD']],
  ['Cutting plane', 'Thick chain line with an arrow at each end', 'Where a section is cut and which way it is viewed', ['WIP', 'TUD']],
  ['Phantom', 'Thin, one long and two short dashes in turn', 'Something that is not part of the piece drawn, such as a neighbouring part', ['WIP', 'WP_ED']],
  ['Break line', 'A wavy line', 'Where the piece is broken off and part of it left out', ['WIP', 'MU']],
];
const DG_SEC = [
  ['Full section', 'The cut runs right through the part and the half in front is taken away', ['TUD', 'DA']],
  ['Half section', 'Only a quarter is cut away, so the view shows outside and inside together; for symmetrical parts', ['TUD', 'DA']],
  ['Broken-out (partial) section', 'Only a small area is cut open, bounded by an irregular break line', ['TUD', 'DA']],
  ['Offset (stepped) section', 'The cutting plane is stepped to pass through features that do not lie in one plane', ['TUD', 'DA']],
  ['Revolved section', 'The cross-section of a spoke, rib or arm, turned through 90° and drawn in place', ['DA']],
];
const DG_GROOVE = [
  ['Square', 'Edges left square; any gap at the root is shown on the symbol', ['MILLER']],
  ['V', 'Both edges bevelled', ['MILLER', 'WGURU']],
  ['Bevel', 'One edge bevelled, the other square; the arrow points to the piece that is bevelled', ['MILLER', 'WGURU']],
  ['U', 'Both edges hollowed out', ['MILLER', 'WGURU']],
  ['J', 'One edge hollowed out, the other square', ['MILLER', 'WGURU']],
  ['Flare V', 'Between two rounded edges', ['MILLER', 'WGURU']],
  ['Flare bevel', 'Between a rounded edge and a flat one', ['MILLER', 'WGURU']],
];
const DG_FILE = [
  ['STEP (.step, .stp)', 'Neutral exchange format, owned by no CAD maker; the most widely accepted way to pass on a 3D model', ['GIM', 'IMD']],
  ['IGES (.iges, .igs)', 'An older neutral format, from before STEP', ['GIM', 'IMD']],
  ['Parasolid (.x_t, .x_b)', 'The format of the Parasolid modelling kernel', ['GIBBS', 'IMD']],
  ['Native files (.sldprt and others)', 'The CAD program\'s own format; a difference in version can stop a file from opening', ['GIM', 'IMD']],
  ['STL (.stl)', 'A mesh of flat triangles, not exact surfaces; curves arrive as facets', ['GIM', 'GIBBS']],
  ['DXF (.dxf)', 'A drawing exchange format', ['GIM', 'GIBBS']],
  ['DWG (.dwg)', 'AutoCAD\'s own format', ['GIM', 'GIBBS']],
];
const DG_STD = [
  ['ISO 128', 'How a drawing is presented: lines, views, sections', ['WIP', 'TUD', 'XOMP']],
  ['ISO 5457', 'Sizes and layout of drawing sheets', ['WP_PS']],
  ['ISO 5455', 'Scales', ['TUD']],
  ['ISO 7200', 'What goes in the title block', ['WP_ED']],
  ['ISO 2768', 'General tolerances', ['W24']],
  ['ISO 2553', 'Welding symbols', ['WGURU', 'C5', 'MW']],
  ['ISO 16792', 'Annotated 3D models', ['SIGM', 'ETMM']],
  ['ASME Y14.1', 'Sheet sizes', ['WP_Y141', 'WP_ED']],
  ['ASME Y14.3', 'Views; third angle projection', ['XOMP', 'WP_ED']],
  ['ASME Y14.5', 'Dimensioning and tolerancing', ['WP_ED']],
  ['ASME Y14.41', 'Annotated 3D models', ['SIGM', 'ETMM']],
  ['AWS A2.4', 'Welding symbols', ['MILLER', 'WGURU', 'C5']],
  ['BS 8888', 'The British standard for technical product specification; it gathers and indexes the ISO standards', ['WP_BS', 'D3D']],
];

function renderDrawGuide(el) {
  const toc = [['dg-set', 'Kinds of drawing'], ['dg-sheet', 'Sheet, title block, scale'], ['dg-line', 'Lines'], ['dg-view', 'Views'], ['dg-sec', 'Sections'], ['dg-weld', 'Welding symbols'], ['dg-cad', 'CAD files and 3D models'], ['dg-std', 'Standards']];
  const two = (head, rows) => '<div class="res cntab" style="max-width:none"><table class="gtab"><tr>' + head.map(h => '<th>' + h + '</th>').join('') + '<th>Sources</th></tr>' +
    rows.map(r => '<tr><td><b>' + gesc(r[0]) + '</b></td><td>' + gesc(r[1]) + '</td><td>' + dgTags(r[2]) + '</td></tr>').join('') + '</table></div>';
  el.innerHTML =
    '<nav class="gtoc">' + toc.map(([a, t]) => '<a href="#' + a + '">' + t + '</a>').join('') + '</nav>' +
    '<p class="desc">How to read a drawing, in our own words: the kinds of drawing, sheet sizes and the title block, line types, first and third angle views, sections and hatching, welding symbols, the CAD file formats and the 3D model that replaces the drawing, and the standards behind it all. The small grey keys after each statement name the public sources it was checked against (list at the bottom). <span class="gtbv">to be verified</span> marks a statement not yet confirmed by two independent publishers.</p>' +

    '<h2 id="dg-set">Kinds of drawing</h2>' +
    dgP('<b>Working drawings.</b> The whole set needed to make a product and put it together: a detail drawing for each part that is made, the assembly drawings, and a parts list.', ['MCG']) +
    two(['Drawing', 'What it shows'], DG_SET) +
    dgP('<b>Bought parts.</b> Standard parts that are bought in get no detail drawing. They appear in the assembly and in the parts list.', ['MCG']) +
    dgP('<b>Few dimensions on an assembly.</b> Only what is needed to put it together; the part drawings carry the rest.', ['MCG', 'DA2']) +
    dgP('<b>Hidden lines</b> are left off an assembly drawing unless they are needed.', ['MCG']) +
    dgP('<b>Balloons.</b> Each part has an item number in a balloon, tied to the part by a leader.', ['MCG', 'DA2']) +
    dgP('<b>Leaders</b> are drawn at an angle and must not cross.', ['MCG', 'WIP']) +
    dgP('<b>Parts list (bill of materials).</b> For each item: its number, a part number or code, a name or description, and how many are needed.', ['MCG', 'DA2']) +
    dgP('<b>A long parts list</b> goes on a sheet of its own.', ['DA2']) +

    '<h2 id="dg-sheet">Sheet, title block and scale</h2>' +
    '<p class="desc">ISO sheet sizes in millimetres:</p>' + two(['Size', 'mm'], DG_ISO) +
    dgP('<b>How the A sizes are built.</b> The sides are in the ratio of 1 to the square root of 2. A0 has an area of one square metre, and each size is half the one before.', ['WP_PS']) +
    dgP('<b>Which way up.</b> A0 to A3 are used landscape, A4 portrait.', ['WP_PS']) +
    dgP('<b>Border, metric sheets.</b> 20 mm on the edge that is bound and 10 mm on the other three.', ['MCG2']) +
    '<p class="desc">American (ANSI) sheet sizes in inches:</p>' + two(['Size', 'in'], DG_ANSI) +
    dgP('<b>Halving.</b> Cutting an ANSI sheet in half gives two sheets of the next size down.', ['WP_Y141']) +
    dgP('<b>Border, inch sheets.</b> At least 0.50 in.', ['OWA']) +
    dgP('<b>Title block.</b> In the lower right corner of the sheet.', ['WP_ED', 'MCG2', 'W24']) +
    dgP('<b>What is in it.</b> The drawing number, the title, the firm\'s name, the scale, the sheet number, tolerances and finish, names and dates.', ['MCG2', 'W24', 'OWA']) +
    dgP('<b>Also there.</b> The revision, the material and the projection method.', ['W24', 'OWA']) +
    dgP('<b>ISO 7200</b> names eight fields: title, created by, approved by, legal owner, document type, drawing number, sheet number with the total, and date of issue.', ['WP_ED']) +
    dgP('<b>General tolerance.</b> A note that sets the tolerance of every dimension that has none of its own.', ['W24', 'MCG']) +
    dgP('<b>ISO 2768</b> is a common one, written for example ISO 2768-mK.', ['W24']) +
    dgP('<b>Revision.</b> The change level of the drawing, such as Rev A. Each change is entered in a revision table.', ['W24', 'MCG2']) +
    dgP('<b>Scale</b> is stated in the title block.', ['MCG2', 'W24', 'OWA']) +
    dgP('<b>Reading a scale.</b> 2:1 is twice full size, 1:2 is half size.', ['W24']) +
    dgP('<b>Preferred scales.</b> Enlarged 2:1, 5:1, 10:1, 20:1 and 50:1; reduced 1:2, 1:5, 1:10, 1:20, 1:50 and 1:100.', ['TUD', 'MCG2']) +
    dgP('<b>Several scales on one sheet.</b> The main one goes in the title block, the others next to their views.', ['MCG2']) +
    dgP('<b>NTS</b> means not to scale.', ['WP_ED', 'MCG2']) +
    dgP('<b>Do not scale the drawing.</b> A size is read from the dimensions, never measured off the paper.', ['WP_ED']) +
    dgP('<b>Notes.</b> A general note holds for the whole drawing; a local note is tied to one feature by a leader.', ['MCG2']) +
    dgP('The limits behind an ISO 2768 note are in <a href="#/t/gentol">general tolerances</a>.', null) +

    '<h2 id="dg-line">Lines</h2>' + dgLines() +
    guideTable(['Line', 'Drawn as', 'Used for'], DG_LINE, dgTags) +
    dgP('<b>ISO line widths.</b> 0.13, 0.18, 0.25, 0.35, 0.5, 0.7, 1.0, 1.4 and 2.0 mm. A line keeps one width along its whole length.', ['WIP']) +
    dgP('<b>Where lines fall on top of each other</b> the one shown is, in this order: cutting plane, visible edge, hidden edge, centre line.', ['WIP']) +
    dgP('<b>Phantom lines</b> also show another position of a moving part, and detail that repeats.', ['WIP']) +

    '<h2 id="dg-view">Views and projection</h2>' + dgProj() +
    dgP('<b>Views.</b> The part is drawn square-on from several sides. Front, top and right side are the usual three.', ['WP_ED']) +
    dgP('<b>How many.</b> Only as many as it takes to describe the part fully. The main view is the one that tells most.', ['TUD']) +
    dgP('<b>First angle.</b> The object lies between the observer and the plane the view is drawn on. The top view goes below the front view, and the view from the right goes on the left.', ['XOMP', 'WP_ED']) +
    dgP('<b>Third angle.</b> The plane lies between the observer and the object. The top view goes above the front view, and the view from the right goes on the right.', ['XOMP', 'WP_ED']) +
    dgP('<b>Who uses which.</b> First angle is the ISO method and the usual one in Europe. Third angle is the usual one in the United States and Canada.', ['XOMP', 'GDTB', 'WP_ED', 'TUD']) +
    dgP('<b>The symbol.</b> A truncated cone drawn in two views, in the title block, says which method the drawing uses.', ['XOMP', 'GDTB']) +
    dgP('<b>Reading the symbol, first angle.</b> The large end of the cone is next to the view with the circles.', ['GDTB', 'XOMP']) +
    dgP('<b>Reading the symbol, third angle.</b> The small end of the cone is next to the view with the circles (GD&amp;T Basics). Xometry Pro words it the other way round, with the small end facing away from that view.', ['GDTB', 'XOMP']) +
    dgP('<b>Auxiliary view.</b> A view projected on to a plane other than the six main ones. It shows a sloping face in its true size and shape.', ['WP_ED']) +
    dgP('<b>Detail view.</b> A small area drawn again, enlarged.', ['TUD', 'DA2']) +
    dgP('Geometric tolerances are in the <a href="#/t/gdtguide">GD&amp;T reference guide</a>; the ways a tolerance is written and the surface texture symbols are in the <a href="#/t/measguide">measurement guide</a>.', null) +

    '<h2 id="dg-sec">Sections and hatching</h2>' +
    dgP('<b>What a section is for.</b> The part is cut open on paper, which shows the inside more clearly than hidden lines do.', ['WP_ED', 'DA']) +
    dgP('<b>How it is marked.</b> A cutting plane line shows where the cut runs, the arrows at its ends show which way it is viewed, and capital letters name it: section A-A.', ['TUD', 'DA']) +
    two(['Section', 'What is cut'], DG_SEC) +
    dgP('<b>Hatching.</b> Evenly spaced parallel lines at 45° mark the material that is cut.', ['TUD', 'DA', 'WIP']) +
    dgP('<b>Parts that touch</b> are hatched differently: one at 45° and the next at 135°, or at another spacing.', ['TUD', 'DA', 'MCG']) +
    dgP('<b>Thin parts.</b> A section too thin to hatch, such as a gasket, is filled in black.', ['TUD', 'MCG']) +
    dgP('<b>Not sectioned.</b> Shafts, screws, pins, rivets, nuts and washers are drawn whole even where the cutting plane passes through them.', ['TUD', 'DA', 'MCG', 'WP_ED']) +
    dgP('<b>Ribs and spokes.</b> A rib cut along its length is left without hatching.', ['DA']) +
    dgP('<b>Keys</b> are not cut along their length.', ['TUD']) +

    '<h2 id="dg-weld">Welding symbols</h2>' + dgWeld() +
    dgP('<b>Two standards.</b> AWS A2.4 is the American one and ISO 2553 the international one.', ['WGURU', 'MW']) +
    dgP('<b>The parts.</b> A reference line carries the information, an arrow joins it to the joint, and a tail holds the welding process and other notes.', ['MILLER', 'WGURU']) +
    dgP('<b>Arrow side and other side (AWS).</b> What is drawn below the reference line is for the side of the joint the arrow points to. What is drawn above it is for the opposite side. Which way the arrow points makes no difference.', ['MILLER', 'WGURU', 'C5']) +
    dgP('<b>Both sides.</b> A fillet symbol above and below the line asks for a weld on both sides.', ['WGURU']) +
    dgP('<b>Sides of the joint, not of the sheet.</b> Arrow side and other side are taken from the joint, not from where the reader stands.', ['STRUC']) +
    dgP('<b>Fillet weld.</b> The leg size is written to the left of the symbol and the length of the weld to the right.', ['MILLER', 'WGURU']) +
    dgP('<b>The fillet symbol</b> is a triangle whose upright side is always on the left.', ['MILLER']) +
    dgP('<b>No length given.</b> The weld runs the full length of the joint, up to where it changes direction.', ['MILLER']) +
    dgP('<b>Intermittent welds.</b> Length, a dash, then pitch. The pitch is measured from centre to centre of the welds; it is not the gap between them.', ['MILLER', 'WGURU', 'C5']) +
    '<p class="desc">Groove welds, by the shape the edges are given:</p>' + two(['Groove', 'Edges'], DG_GROOVE) +
    dgP('<b>Broken arrow.</b> For a bevel or J groove a kink in the arrow stresses that it points at the piece to be prepared.', ['MILLER']) +
    dgP('<b>Groove figures.</b> The depth of preparation goes to the left of the symbol, and the weld size, where it differs, in brackets.', ['MILLER', 'WGURU', 'STRUC']) +
    dgP('<b>Groove angle</b> is the whole included angle: 60° is two bevels of 30°.', ['WGURU']) +
    dgP('<b>No depth given.</b> A V groove with no depth or size is taken as a complete joint penetration weld.', ['STRUC']) +
    dgP('<b>CJP</b> in the tail asks for complete joint penetration.', ['WGURU']) +
    dgP('<b>Weld all around.</b> A small circle where the arrow meets the reference line.', ['MILLER', 'WGURU']) +
    dgP('<b>Field weld.</b> A flag at the same point: the weld is made on site. Without the flag it is a shop weld.', ['MILLER', 'WGURU']) +
    dgP('<b>Backing and melt-through</b> are drawn on the opposite side of the reference line from the weld symbol. An R in the backing symbol means the backing is removed after welding.', ['MILLER', 'WGURU']) +
    dgP('<b>Contour and finish.</b> A flat, convex or concave mark gives the finished shape of the weld, and a letter the way it is finished: C chipping, G grinding, M machining, H hammering, R rolling, P planishing, U unspecified.', ['WGURU']) +
    dgP('<b>ISO 2553: the dashed line.</b> ISO adds a dashed line for the other side of the joint. AWS has none.', ['C5', 'MW', 'WGURU']) +
    dgP('<b>ISO system A.</b> A symbol on the solid line is for the arrow side and one on the dashed line for the other side, whichever line is drawn on top (Clause5). Material Welding puts it as the arrow side above the line.', ['C5', 'MW']) +
    dgP('<b>ISO system B</b> has one line and is read as in AWS.', ['C5']) +
    dgP('<b>Fillet size, ISO.</b> A letter comes before the figure: a for the throat, z for the leg. a4 is a throat of 4 mm. AWS gives the leg, with no letter.', ['C5', 'MW']) +
    dgP('<b>Units.</b> ISO 2553 sizes are in millimetres.', ['C5', 'MW']) +
    dgP('<b>Process, ISO.</b> A number from ISO 4063 in the tail, 135 for MAG welding, where AWS writes letters such as GMAW.', ['MW']) +
    dgP('<b>Intermittent welds, ISO.</b> The number of welds, their length and the gap between them, where AWS gives length and pitch.', ['C5']) +

    '<h2 id="dg-cad">CAD files and 3D models</h2>' +
    two(['Format', 'What it is'], DG_FILE) +
    dgP('<b>STEP versions.</b> AP203, AP214 and AP242 are versions of STEP. AP242 is the newest and carries the most.', ['GIM', 'IMD']) +
    dgP('<b>STEP, in detail.</b> Defined in ISO 10303, plain text, with the full boundary geometry of a solid.', ['IMD']) +
    dgP('<b>IGES trouble.</b> Solids often arrive as loose surfaces, and some surfaces may have to be made again before the model is solid.', ['IMD', 'GIBBS']) +
    dgP('<b>Parasolid.</b> Programs built on the Parasolid kernel read it without translation.', ['GIBBS']) +
    dgP('<b>STL</b> cannot be used for CNC machining.', ['GIM']) +
    dgP('<b>DXF</b> is plain text and carries no unit of measure.', ['GIBBS']) +
    dgP('<b>DXF for cutting.</b> It is a 2D format, common for laser cutting; state the thickness of the material with it.', ['GIM']) +
    dgP('<b>Model-based definition (MBD).</b> The 3D model itself, and not a drawing, is the authority for the part.', ['SIGM', 'ETMM', 'WP_ED']) +
    dgP('<b>PMI,</b> product and manufacturing information: the dimensions, tolerances, surface finish and notes attached to the model.', ['SIGM', 'ETMM']) +
    dgP('<b>Its standards</b> are ASME Y14.41 and ISO 16792.', ['SIGM', 'ETMM']) +
    dgP('<b>Passing it on.</b> STEP AP242 carries the annotations along with the geometry.', ['SIGM', 'ETMM', 'IMD']) +
    dgP('<b>What it buys.</b> CAM and measuring machine software can work from the annotated model, so nothing is carried over by hand from a drawing.', ['SIGM', 'ETMM']) +
    dgP('<b>Machine-readable.</b> Annotations of this kind are called semantic: software can read them, where a drawing can only be read by a person.', ['ETMM']) +
    dgP('<b>Drawings do not vanish.</b> They are still made where a supplier needs them, and the two ways of working run side by side.', ['ETMM', 'SIGM']) +
    dgP('<b>For reference only.</b> Where the model is the authority, a drawing that goes with it is often marked this way.', ['WP_ED']) +
    dgP('<b>Technical data package.</b> The whole set that is handed over: the model, the parts list and the documents that go with them.', ['ETMM', 'WP_ED']) +

    '<h2 id="dg-std">Standards</h2>' +
    two(['Standard', 'Covers'], DG_STD) +
    dgP('<b>BS 8888</b> is the descendant of BS 308 and points to 200 or more international standards.', ['D3D']) +
    dgP('<b>It covers</b> 3D models as well as drawings.', ['WP_BS', 'D3D']) +

    '<h2 id="dg-src">Sources</h2><ul class="gsl">' + Object.entries(DG_SOURCES).map(([k, v]) => '<li><b>' + k + '</b> ' + gesc(v) + '</li>').join('') + '</ul>' +
    '<p class="desc">Full URLs and access dates are in docs/sources.md, "Drawings and weld symbols guide". No text, figures or tables were copied from the sources.</p>';
  guideToc(el);
}
