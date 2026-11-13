// Cutting tools guide (parity MH101, MH103, MH109, MH113, MH129, BB64; parts of MH105, MH128).
// All wording and drawings are BenchMate's own. Every statement carries the keys of the public sources read for
// it (docs/sources.md, "Cutting tools guide"); one with fewer than two independent publishers is shown as "to be
// verified". Where two sources give different figures both are shown.
'use strict';

const CG_SOURCES = {
  CTE_M: 'Cutting Tool Engineering, F. Marlow, "A milling tools overview", 2009-09-01',
  CTE_G: 'Cutting Tool Engineering, glossary entry "milling cutter"',
  CTE_B: 'Cutting Tool Engineering, C. Tate, "Choosing the right boring tool", 2017-04-03',
  AM12: 'American Machinist, G. Schneider Jr., "Cutting tool applications", chapter 12, "Milling cutters and operations", 2020-06-29',
  AM10: 'American Machinist, G. Schneider Jr., "Cutting tool applications", chapter 10, "Boring operations and machines", 2020-06-28',
  AM14: 'American Machinist, G. Schneider Jr., "Cutting tool applications", chapter 14, "Broaches and broaching", 2020-06-29',
  MMFG: 'MachineMfg, "A comprehensive guide to milling cutter tools and their applications"',
  WP_MC: 'Wikipedia, "Milling cutter" (CC BY-SA)',
  WP_BR: 'Wikipedia, "Broaching (metalworking)" (CC BY-SA)',
  EE_BR: 'Engineers Edge, "Broaching" (follows the Wikipedia text closely, so it counts with WP_BR)',
  CNCC: 'CNCCookbook, "Cutting tool materials"',
  AIMS: 'AIMS Industrial (Australia), "Cutting tool materials guide"',
  TTE: 'TTE training college, "Twist drills" (tte-lisa.ac.uk; no author or date)',
  TEP: 'The Engineers Post, "Twist drill nomenclature"',
  USFS: 'USDA Forest Service, ax manual (publication 1823-2812P), part 7 on files and filing',
  NICH: 'Crescent Nicholson, "Guide to files and filing"',
};
// Several pages of one publisher count once. The Engineers Edge page on broaching follows the Wikipedia text.
const CG_FAMILY = { CTE_M: 'CTE', CTE_G: 'CTE', CTE_B: 'CTE', AM12: 'AMACH', AM10: 'AMACH', AM14: 'AMACH', WP_MC: 'WIKI', WP_BR: 'WIKI', EE_BR: 'WIKI' };
const cgTags = keys => guideTags(keys, CG_SOURCES, CG_FAMILY);
const cgP = (html, keys) => '<p>' + html + (keys === null ? '' : ' ' + cgTags(keys)) + '</p>';
const cgBox = d => '<path class="gfill" d="' + d + '"/><path class="gp" d="' + d + '"/>';

// Cutters that go on an arbor (seen from the side, arbor lying across) and cutters held by a shank (shank up).
function cgCutters() {
  const sh = (cx, to) => 'M' + (cx - 6) + ' 34H' + (cx + 6) + 'V' + to + 'H' + (cx - 6) + 'Z';
  const neck = (cx, a, b) => 'M' + (cx - 3) + ' ' + a + 'H' + (cx + 3) + 'V' + b + 'H' + (cx - 3) + 'Z';
  const axis = cx => '<path class="gk" d="M' + cx + ' 28V110"/>';
  let flutes = '';
  for (let y = 70; y <= 98; y += 9) flutes += '<path class="gm" d="M255 ' + (y + 5) + 'L269 ' + (y - 5) + '"/>';
  let helix = '';
  for (let x = 32; x <= 62; x += 10) helix += '<path class="gm" d="M' + x + ' 98L' + (x + 8) + ' 42"/>';
  return cnSvg(470, 146,
    cnT(110, 16, 'on an arbor', 'gv', 'middle') + cnT(347, 16, 'on a shank', 'gv', 'middle') +
    '<path class="gp" d="M14 64H206V76H14Z"/>' +
    cgBox('M26 42H76V98H26Z') + helix + cgBox('M100 36H116V104H100Z') + cgBox('M138 36H142V104H138Z') + cgBox('M164 36L188 52V88L164 104Z') +
    '<path class="gk" d="M8 70H212"/>' +
    cnT(51, 124, 'plain', 'gs', 'middle') + cnT(108, 124, 'side', 'gs', 'middle') + cnT(140, 138, 'saw', 'gs', 'middle') + cnT(176, 124, 'angle', 'gs', 'middle') +
    cgBox('M255 34H269V104H255Z') + '<path class="gm" d="M255 62H269"/>' + flutes + axis(262) +
    cgBox('M297 34H311V97A7 7 0 0 1 297 97Z') + '<path class="gm" d="M297 62H311"/>' + axis(304) +
    cgBox(sh(346, 80)) + cgBox(neck(346, 80, 92)) + cgBox('M332 92H360V104H332Z') + axis(346) +
    cgBox(sh(390, 84)) + cgBox(neck(390, 84, 96)) + cgBox('M374 96H406V102H374Z') + axis(390) +
    cgBox(sh(434, 84)) + cgBox(neck(434, 84, 90)) + cgBox('M426 90H442L449 104H419Z') + axis(434) +
    cnT(262, 124, 'end mill', 'gs', 'middle') + cnT(304, 138, 'ball nose', 'gs', 'middle') + cnT(346, 124, 'T-slot', 'gs', 'middle') + cnT(390, 138, 'Woodruff', 'gs', 'middle') + cnT(434, 124, 'dovetail', 'gs', 'middle'),
    'Outlines of milling cutters. On an arbor: a wide plain cutter with helical teeth, a narrower side cutter, a thin slitting saw and an angle cutter with a sloping rim. On a shank: an end mill, a ball nose end mill with a round end, a T-slot cutter with a disc below a neck, a Woodruff keyseat cutter with a thin disc, and a dovetail cutter that widens toward its end');
}
// Six tool materials as steps, hardest on the right; hardness figures from one source.
function cgRank() {
  const m = [['HSS', '850'], ['cobalt HSS', '880 to 920'], ['carbide', '1400'], ['cermet', '1500'], ['CBN', '3500'], ['PCD', '8000 to 10000']];
  let s = '';
  m.forEach(([n, hv], i) => {
    const x = 14 + i * 74, top = 112 - i * 14;
    s += cgBox('M' + x + ' 128V' + top + 'H' + (x + 68) + 'V128Z') + cnT(x + 34, top - 6, hv, 'gs', 'middle') + cnT(x + 34, 144, n, 'gs', 'middle');
  });
  return cnSvg(470, 166,
    cnT(14, 16, 'hardness at 20 °C in HV (one source), softest to hardest', 'gs') + s +
    '<path class="gm" d="M14 152H156M162 152H456"/>' + cnT(85, 164, 'rated tough', 'gs', 'middle') + cnT(309, 164, 'rated brittle', 'gs', 'middle'),
    'Six cutting tool materials as rising steps by hardness at 20 degrees C, figures from one source: high speed steel 850 HV, cobalt high speed steel 880 to 920, carbide 1400, cermet 1500, CBN 3500, polycrystalline diamond 8000 to 10000. The two high speed steels are rated tough, the other four brittle');
}
// A taper shank twist drill from the side, with a small view on the point.
function cgDrill() {
  let fl = '';
  for (let x = 176; x <= 352; x += 44) fl += '<path class="gm" d="M' + x + ' 90C' + (x + 14) + ' 76 ' + (x + 26) + ' 64 ' + (x + 40) + ' 50"/>';
  const tick = (x, y1, y2) => '<path class="gm" d="M' + x + ' ' + y1 + 'V' + y2 + '"/>';
  return cnSvg(470, 176,
    cgBox('M14 62H34V78H14Z') + cgBox('M34 58L150 54V86L34 82Z') + cgBox('M150 60H166V80H150Z') + cgBox('M166 50H400L412 70L400 90H166Z') + fl +
    '<path class="gk" d="M8 70H424"/>' +
    cnT(24, 106, 'tang', 'gs', 'middle') + cnT(92, 106, 'taper shank', 'gs', 'middle') + cnT(158, 106, 'neck', 'gs', 'middle') + cnT(283, 106, 'body', 'gs', 'middle') +
    tick(24, 80, 94) + tick(92, 86, 94) + tick(158, 82, 94) + tick(283, 92, 94) +
    cnT(236, 36, 'flute', 'gs', 'middle') + '<path class="gm" d="M236 40L244 62"/>' +
    cnT(330, 36, 'land (margin)', 'gs', 'middle') + tick(330, 40, 50) +
    cnT(420, 50, 'lip', 'gs') + '<path class="gm" d="M418 50L407 60"/>' + cnT(420, 96, '118°', 'gv') +
    '<circle class="gfill" cx="390" cy="146" r="24"/><circle class="gp" cx="390" cy="146" r="24"/>' +
    '<path class="gc" d="M396 142H413.6M384 150H366.4"/><path class="gw" d="M384 150L396 142"/>' +
    cnT(354, 136, 'seen on the point:', 'gs', 'end') + cnT(354, 150, 'chisel edge across the web,', 'gs', 'end') + cnT(354, 164, 'one lip on each side of it', 'gs', 'end'),
    'A taper shank twist drill from the side: tang at the end of the shank, taper shank, neck, then the body with its helical flutes and the land or margin along each flute, ending in a point of 118 degrees with a lip on each side. A second view on the point shows the short chisel edge across the web with one lip running out from each end of it');
}
// A file with its parts named, and the four ways the teeth are cut.
function cgFile() {
  const box = x => '<path class="gp" d="M' + x + ' 92H' + (x + 60) + 'V128H' + x + 'Z"/>';
  let a = '', b = '', c = '', d = '';
  for (let k = 0; k < 5; k++) {
    a += 'M' + (32 + k * 10) + ' 128L' + (48 + k * 10) + ' 92';
    b += 'M' + (142 + k * 10) + ' 128L' + (158 + k * 10) + ' 92M' + (158 + k * 10) + ' 128L' + (142 + k * 10) + ' 92';
  }
  for (let r = 0; r < 3; r++) for (let k = 0; k < 5; k++) c += 'M' + (258 + k * 11 + (r % 2) * 5) + ' ' + (104 + r * 10) + 'l4 -5';
  for (let k = 0; k < 4; k++) d += 'M364 ' + (103 + k * 8) + 'Q390 ' + (93 + k * 8) + ' 416 ' + (103 + k * 8);
  return cnSvg(470, 150,
    cgBox('M14 40L70 33V26H300L330 30V50L300 54H70V47Z') +
    cnT(42, 70, 'tang', 'gs', 'middle') + cnT(88, 70, 'heel', 'gs', 'middle') + cnT(190, 70, 'belly', 'gs', 'middle') + cnT(318, 70, 'point', 'gs', 'middle') + cnT(190, 18, 'edge', 'gs', 'middle') +
    box(30) + '<path class="gm" d="' + a + '"/>' + box(140) + '<path class="gm" d="' + b + '"/>' + box(250) + '<path class="gp" d="' + c + '"/>' + box(360) + '<path class="gm" d="' + d + '"/>' +
    cnT(60, 144, 'single cut', 'gs', 'middle') + cnT(170, 144, 'double cut', 'gs', 'middle') + cnT(280, 144, 'rasp', 'gs', 'middle') + cnT(390, 144, 'curved cut', 'gs', 'middle'),
    'A file from above with its parts: the pointed tang that goes into the handle, the heel next to it, the belly along the middle, the point at the far end and the edge along the side. Below, four tooth patterns: single cut with one set of slanting rows, double cut with two sets crossing, rasp with separate teeth, and curved cut with rows in arcs');
}
// A pull broach along its length, and two teeth enlarged.
function cgBroach() {
  let d = 'M14 70V56H22V60H34V56H50V52H100', x = 100;
  const tooth = h => { d += 'L' + x + ' ' + (78 - h) + 'V' + (70 - h); x += 13; };
  for (let i = 0; i < 10; i++) tooth(20 + i * 1.2);
  for (let i = 0; i < 5; i++) tooth(32 + i * 0.5);
  for (let i = 0; i < 5; i++) tooth(34.5);
  d += 'L360 43.5V41H410V70Z';
  const tick = x0 => '<path class="gm" d="M' + x0 + ' 72V80"/>';
  return cnSvg(470, 202,
    cgBox(d) + cnT(14, 30, 'pulled this way', 'gs') + '<path class="gc" d="M124 26H144M124 26l6 -4M124 26l6 4"/>' +
    tick(50) + tick(100) + tick(230) + tick(295) + tick(360) +
    cnT(32, 92, 'pull end', 'gs', 'middle') + cnT(165, 92, 'roughing teeth', 'gs', 'middle') + cnT(328, 92, 'finishing', 'gs', 'middle') +
    cnT(75, 106, 'front pilot', 'gs', 'middle') + cnT(262, 106, 'semi-finishing', 'gs', 'middle') + cnT(388, 106, 'rear pilot', 'gs', 'middle') +
    '<path class="gp" d="M96 180H120V150H130L200 180V144H210L280 174"/>' +
    '<path class="gm" d="M120 134H200M120 130V138M200 130V138"/>' + cnT(160, 128, 'pitch', 'gs', 'middle') +
    '<path class="gk" d="M134 150H292M214 144H292"/>' + cnT(298, 151, 'rise per tooth', 'gs') +
    cnT(114, 146, 'land', 'gs', 'end') + cnT(196, 196, 'gullet', 'gs', 'middle') + '<path class="gm" d="M196 185L191 171"/>',
    'A pull broach along its length: pull end, front pilot, a long run of roughing teeth that each stand higher than the one before, a shorter run of semi-finishing teeth that rise less, finishing teeth all of one height, and the rear pilot. Below, two teeth enlarged: the pitch is the distance from one cutting face to the next, the rise per tooth is the step up between them, the land is the flat behind the cutting edge and the gullet is the space in front of the next tooth');
}

const CG_MILL = [
  ['Plain milling cutter', 'On the rim only', 'Flat surfaces, cut with the rim', ['AM12', 'MMFG']],
  ['Side milling cutter (side and face cutter)', 'On the rim and on the sides', 'Slots and grooves', ['AM12', 'WP_MC', 'CTE_M']],
  ['Staggered-tooth side cutter', 'Every other tooth cuts on the other side of the slot', 'Deep, heavy slots', ['AM12']],
  ['Half side cutter', 'On one side only', 'Shoulders; two on one arbor straddle the work', ['AM12']],
  ['Slitting saw', 'Thin blade with fine, closely spaced teeth', 'Slitting, parting and deep narrow grooves', ['MMFG']],
  ['Angle cutter', 'On a cone instead of a cylinder; single angle or double angle', 'Not described in the sources read', ['AM12']],
  ['Form cutter', 'Edge shaped to the profile wanted on the work', 'Concave, convex, corner rounding and gear tooth cutters are the usual ones', ['AM12', 'MMFG', 'CTE_G']],
  ['Face mill', 'Replaceable inserts around the body', 'Large flat surfaces, with fast metal removal', ['CTE_M', 'MMFG', 'WP_MC']],
  ['Shell end mill', 'On the rim and on one end face', 'Cuts with its face and its side at once; a separate body fastened to an arbor', ['AM12', 'CTE_M', 'WP_MC']],
  ['End mill', 'On the end and on the rim', 'Slotting, profiling and facing', ['AM12', 'WP_MC', 'MMFG']],
  ['Ball nose end mill', 'Round (hemispherical) end', 'Three-dimensional contours, round-bottomed slots and fillets', ['CTE_M', 'MMFG', 'WP_MC']],
  ['T-slot cutter', 'On a shank', 'T-shaped slots', ['MMFG', 'CTE_G']],
  ['Woodruff keyseat cutter', 'Small disc on a shank', 'The seat for a Woodruff key', ['MMFG', 'AM12', 'WP_MC']],
  ['Dovetail cutter', 'On a shank', 'Dovetail slots, as on slides', ['MMFG', 'AM12']],
  ['Fly cutter', 'One or two single-point tool bits in a body', 'Broad, light facing cuts', ['WP_MC', 'MMFG']],
  ['Hollow mill', 'On the inside, like a thick-walled pipe', 'Screw machine and lathe work', ['WP_MC', 'MMFG']],
];
// Hardness and temperature figures as printed by one source (AIMS).
const CG_HV = [
  ['High speed steel (M2)', '850 HV', '200 HV', 'about 550 °C', 'High', ['AIMS']],
  ['Cobalt HSS, 5 % (M35)', '880 HV', '350 HV', 'about 580 °C', 'High', ['AIMS']],
  ['Cobalt HSS, 8 % (M42)', '920 HV', '400 HV', 'about 620 °C', 'High', ['AIMS']],
  ['Solid carbide', '1400 HV', '1200 HV', 'about 900 °C and over', 'Low (brittle)', ['AIMS']],
  ['Cermet', '1500 HV', '1400 HV', 'about 1000 °C and over', 'Low (very brittle)', ['AIMS']],
  ['CBN (PCBN)', '3500 HV', '3200 HV', 'about 1300 °C and over', 'Low', ['AIMS']],
  ['Diamond (PCD)', '8000 to 10000 HV', 'breaks down above 600 °C', 'about 600 °C', 'Low', ['AIMS']],
];
const CG_DRILL = [
  ['Shank', 'The part the drill is held and driven by; straight or taper', ['TTE', 'TEP']],
  ['Tang', 'Flattened end of a taper shank; it fits a slot and gives a positive drive', ['TTE', 'TEP']],
  ['Neck', 'Short length of smaller diameter between body and shank, where the size is marked', ['TEP']],
  ['Body', 'From the point back to the neck or shank', ['TTE', 'TEP']],
  ['Flutes', 'Grooves along the body that form the lips', ['TTE', 'TEP']],
  ['Land or margin', 'Narrow ground strip running along each flute. TEP calls it the land, TTE the margin', ['TTE', 'TEP']],
  ['Body clearance', 'Body surface made smaller in diameter than the lands so that it clears the hole', ['TEP']],
  ['Web', 'Central core between the bottoms of the flutes, from the point toward the shank', ['TEP']],
  ['Point', 'The sharpened end: lips, faces, flanks and chisel edge together', ['TEP']],
  ['Lip', 'Cutting edge, where a flank meets a flute', ['TTE', 'TEP']],
  ['Chisel edge', 'Short edge across the very tip between the two lips; also called the dead centre', ['TTE', 'TEP']],
  ['Face', 'Flute surface next to the lip, which the chip runs against', ['TEP']],
  ['Flank', 'Surface of the point behind each lip, back to the next flute', ['TEP']],
  ['Heel', 'Edge where the flute meets the body clearance', ['TEP']],
];
const CG_CUT = [
  ['Single cut', 'One set of parallel rows slanting across the face', 'Sharpening and smooth finishes', ['USFS', 'NICH']],
  ['Double cut', 'Two sets of rows that cross; the second set (upcut) is finer than the first (overcut)', 'Rough work and fast removal', ['USFS', 'NICH']],
  ['Rasp', 'Separate coarse teeth, each raised on its own', 'Wood and other soft materials', ['USFS', 'NICH']],
  ['Curved cut', 'Rows of teeth in curves across the face', 'Smoothing car body panels', ['NICH']],
];
const CG_SHAPE = [
  ['Flat', 'General work', ['NICH']],
  ['Mill', 'Draw filing, lathe filing, sharpening large saws, and smoothing after a rougher file (single cut)', ['NICH']],
  ['Hand', 'Double cut; takes stock off faster', ['NICH']],
  ['Square', 'Enlarging rectangular holes', ['NICH']],
  ['Three square (triangular)', 'Internal angles under 90°, cleaning out square corners, sharpening saw teeth', ['NICH']],
  ['Round', 'Enlarging round holes', ['NICH']],
  ['Half round', 'Flat side for flat surfaces, round side for grooves', ['NICH']],
];
const CG_BORE = [
  ['Plain boring bar', 'One cutting edge at the end of a bar; the basic tool', ['CTE_B', 'AM10']],
  ['Adjustable boring head (milling machine)', 'Slides the bar toward or away from the spindle axis to set the diameter; one head covers a wide range of holes', ['CTE_B']],
  ['Twin cutter head', 'Two edges, both at one diameter for a faster feed or stepped to take more per pass; for roughing', ['CTE_B']],
  ['Fine boring head or micro-adjustable bar', 'Adjusts in steps as small as 0.0001 in (0.0025 mm); for finishing to close tolerance', ['CTE_B', 'AM10']],
  ['Damped bar', 'Has a damper inside it against chatter at long overhang', ['CTE_B']],
];

function renderCutGuide(el) {
  const toc = [['cg-mill', 'Milling cutters'], ['cg-mat', 'Tool materials'], ['cg-drill', 'Twist drill terms'], ['cg-file', 'Files'], ['cg-broach', 'Broaching'], ['cg-bore', 'Boring tools']];
  el.innerHTML =
    '<nav class="gtoc">' + toc.map(([a, t]) => '<a href="#' + a + '">' + t + '</a>').join('') + '</nav>' +
    '<p class="desc">What the cutting tools are called and what each is for, in our own words: the kinds of milling cutter, the tool materials from high speed steel to diamond, the parts of a twist drill, files and filing, broaches, and boring tools. The small grey keys after each statement name the public sources it was checked against (list at the bottom). <span class="gtbv">to be verified</span> marks a statement not yet confirmed by two independent publishers.</p>' +

    '<h2 id="cg-mill">Kinds of milling cutter</h2>' + cgCutters() +
    cgP('<b>Arbor or shank.</b> Plain, side and the other disc-shaped cutters are usually mounted on an arbor. End mills, T-slot, Woodruff and dovetail cutters are held by a shank and work in vertical and horizontal machines alike.', ['CTE_G', 'AM12']) +
    cgP('<b>Shell mills.</b> A shell mill is a separate cutter body fastened to an arbor or adapter instead of having a shank of its own.', ['AM12', 'WP_MC']) +
    guideTable(['Cutter', 'Teeth', 'Used for'], CG_MILL, cgTags) +
    cgP('<b>Plain cutters, narrow and wide.</b> Narrow plain cutters have straight teeth and wide ones helical teeth. Heavy-duty plain cutters have fewer, more widely spaced teeth at a helix of about 45° and take the heavier cuts.', ['AM12']) +
    cgP('<b>Wider than the work.</b> A plain cutter is usually wider than the work and cuts right across it.', ['CTE_M']) +
    cgP('<b>Slab mill.</b> A slab mill machines large flat surfaces on a horizontal mill, alone or ganged with other cutters on the arbor.', ['WP_MC', 'MMFG']) +
    cgP('<b>Helical teeth</b> keep some part of a cutting edge in the work all the time, so the load is steady instead of pulsing and the cutter chatters less.', ['CTE_M']) +
    cgP('<b>Plunging.</b> A two-flute end mill can be fed straight down into solid metal like a drill. End mills with three or four flutes can do so only when an end tooth reaches the centre.', ['CTE_M', 'AM12']) +
    cgP('<b>Gear tooth cutters</b> come as a set of eight, half sizes aside, that between them cut every gear from 12 teeth up to a rack.', ['WP_MC']) +
    cgP('Flute counts, end shapes, roughers and helix angles of end mills are in the <a href="#/t/toolguide">tooling guide</a>; climb and conventional milling in <a href="#/t/cncguide">CNC basics</a>; speeds for <a href="#/t/slitsaw">slitting saws</a>; slot sizes in <a href="#/t/tslots">T-slots</a>; Woodruff key sizes in <a href="#/t/keys">keys and keyways</a>; the gear cutter number for a tooth count in <a href="#/t/spurgear">spur gear data</a>.', null) +

    '<h2 id="cg-mat">Tool materials, from tough to hard</h2>' + cgRank() +
    cgP('<b>The tough end.</b> High speed steel is the tough material of the range.', ['AIMS', 'CNCC']) +
    cgP('<b>The brittle end.</b> Carbide, cermet, CBN and diamond are all rated low in toughness.', ['AIMS']) +
    cgP('<b>The hardest.</b> Polycrystalline diamond (PCD) is the hardest cutting tool material made.', ['AIMS', 'CNCC']) +
    cgP('<b>Second hardest</b> is CBN, about two and a half times as hard as carbide.', ['AIMS']) +
    '<p class="desc">Hardness and temperature figures as one source prints them. Ceramic is not in its table:</p>' +
    guideTable(['Material', 'Hardness at 20 °C', 'Hardness at 600 °C', 'Top cutting temperature', 'Toughness'], CG_HV, cgTags) +
    cgP('<b>High speed steel, how hot.</b> The sources differ: about 550 °C at the cutting edge by AIMS; CNCC has it keep its hardness to between 600 and 650 °C.', ['AIMS', 'CNCC']) +
    cgP('<b>Carbide, how hot.</b> CNCC prints two figures, softening from about 850 °C and hard up to 1000 °C; AIMS gives about 900 °C and over.', ['AIMS', 'CNCC']) +
    cgP('<b>Carbide against high speed steel.</b> CNCC gives carbide over three times the metal removal rate of high speed steel, coated carbide 4.58 times and PCD 5.24 times (1/2 in end mill, 1/2 in deep, 1/4 in stepover). AIMS puts carbide at three to five times high speed steel.', ['AIMS', 'CNCC']) +
    cgP('<b>Carbide grades.</b> More cobalt binder makes a grade tougher; finer grains make it harder.', ['CNCC']) +
    cgP('<b>Cobalt high speed steel</b>, with 5 % cobalt or more, is used for stainless steel, alloy steel and interrupted cuts.', ['AIMS']) +
    cgP('<b>Cermet</b> finishes steel and stainless steel at high speed and light depth of cut, typically 0.1 to 0.5 mm. It is not for roughing, interrupted cuts or work harder than 45 HRC.', ['AIMS']) +
    cgP('<b>Ceramic</b> starts to soften only at almost 2200 °C and is run at high cutting speeds.', ['CNCC']) +
    cgP('<b>CBN</b> is used on cast iron.', ['AIMS', 'CNCC']) +
    cgP('<b>CBN on steel.</b> It is the material for hardened steel above 55 HRC. On non-ferrous metals it gains nothing over carbide.', ['AIMS']) +
    cgP('<b>Diamond</b> is for non-ferrous metals, aluminium among them.', ['AIMS', 'CNCC']) +
    cgP('<b>Never diamond on steel or iron.</b> At cutting temperature the carbon of the diamond reacts with the iron and the edge dissolves.', ['AIMS']) +
    cgP('The ISO groups P, M, K, N, S and H of the work materials are in <a href="#/t/materials">material equivalents</a>; the tool materials as the makers describe them, and coatings, are in the <a href="#/t/toolguide">tooling guide</a>.', null) +

    '<h2 id="cg-drill">Parts of a twist drill</h2>' + cgDrill() +
    guideTable(['Part', 'What it is'], CG_DRILL, cgTags) +
    cgP('<b>Point angle.</b> 118° for general work, so each lip stands at 59° to the axis.', ['TTE', 'TEP']) +
    cgP('<b>Both lips alike.</b> The two lips need the same angle to the axis, the same length and the right clearance.', ['TEP']) +
    cgP('<b>Full size at the point only.</b> The drill measures its full diameter only across the lands at the point, and the lands keep it in line in the hole.', ['TEP']) +
    cgP('<b>Chisel edge.</b> It does not cut like a lip: it forces its own way in, like a flat drill, and takes a large part of the thrust.', ['TEP']) +
    cgP('<b>What the flutes do.</b> They let the chips out, curl them, and let the cutting fluid reach the lips.', ['TEP']) +
    cgP('<b>Helix angle.</b> From 18° to 45°, typically 30°.', ['TTE']) +
    cgP('<b>Lip clearance</b> on a general-purpose drill is 12°.', ['TTE']) +
    cgP('<b>Shanks.</b> Small drills have a straight shank held in a chuck; larger ones a Morse taper shank with a tang.', ['TTE']) +
    cgP('Regrinding the point is in the <a href="#/t/shoptools">shop tools guide</a>; drill types and point angles by material in the <a href="#/t/toolguide">tooling guide</a>; sizes in the <a href="#/t/drillchart">drill chart</a>; Morse tapers in <a href="#/t/machinetapers">machine tapers</a>.', null) +

    '<h2 id="cg-file">Files and filing</h2>' + cgFile() +
    cgP('<b>Parts.</b> A file has a point (the tip), a belly, a heel (the end next to the handle) and a tang, which goes into the handle.', ['USFS', 'NICH']) +
    cgP('<b>Safe edge.</b> An edge left smooth, with no teeth.', ['NICH']) +
    guideTable(['Cut', 'Teeth', 'For'], CG_CUT, cgTags) +
    cgP('<b>Pressure by cut.</b> A single cut file is used with light pressure, a double cut file with heavier pressure.', ['NICH']) +
    cgP('<b>Grades.</b> From rough to fine: bastard, second cut, smooth. Nicholson lists a coarse grade ahead of bastard.', ['USFS', 'NICH']) +
    cgP('<b>Swiss pattern files</b> are graded by number instead: 00, 0, 1, 2, 3, 4 and 6, from coarsest to finest.', ['USFS']) +
    cgP('<b>Length counts.</b> A longer file of the same grade has fewer teeth to the inch and cuts coarser: a 12 in bastard file is coarser than a 6 in one.', ['USFS', 'NICH']) +
    '<p class="desc">Shapes and their uses, from one maker:</p>' +
    guideTable(['Shape', 'Used for'], CG_SHAPE, cgTags) +
    cgP('<b>The push stroke cuts.</b> A file cuts on the forward stroke. Lift it off the work on the way back.', ['USFS', 'NICH']) +
    cgP('<b>Soft metals excepted.</b> On very soft metals the file may stay on the work on the way back, with no more than its own weight on it.', ['NICH']) +
    cgP('<b>Pressure.</b> On the point as the stroke starts, on point and heel alike in the middle, on the heel as it ends.', ['USFS']) +
    cgP('<b>Draw filing.</b> The file is held across the work and moved sideways along it instead of lengthwise.', ['USFS', 'NICH']) +
    cgP('<b>What draw filing is for.</b> It leaves a finer finish than straight filing. The mill bastard file is the usual one for it.', ['NICH']) +
    cgP('<b>Lathe filing.</b> Stroke the file across the turning work and keep it gliding a little sideways, never held in one place. A long-angle lathe file is made for it.', ['NICH']) +
    cgP('<b>Pinning.</b> Filings wedged between the teeth are called pinning. Brush them out with a file card or a fine wire brush.', ['USFS', 'NICH']) +
    cgP('<b>Chalk</b> rubbed across the teeth slows the clogging.', ['USFS']) +
    cgP('<b>Handle.</b> Use a file only with a tight handle: a loose one lets the tang go into the hand.', ['USFS', 'NICH']) +
    cgP('<b>Storage.</b> Keep files apart so that the teeth of one never touch another: hung up, in a divided drawer, or each wrapped in cloth.', ['USFS', 'NICH']) +
    cgP('<b>Dry and clean.</b> Keep files away from water and grease.', ['NICH']) +
    cgP('<b>Soft and tough metals.</b> For aluminium there are files with a deep upcut and an open throat. On brass and bronze use light pressure and cross the stroke often so the file does not groove the work. Stainless steel wears files fast: light pressure and a slow, steady stroke.', ['NICH']) +
    cgP('Rotary burrs, with their cuts and speeds, are in the <a href="#/t/shoptools">shop tools guide</a>.', null) +

    '<h2 id="cg-broach">Broaches and broaching</h2>' + cgBroach() +
    cgP('<b>What a broach is.</b> A long tool with a row of teeth, each cutting a little deeper than the one before, so that a single pass takes the whole cut.', ['AM14', 'WP_BR']) +
    cgP('<b>Three runs of teeth.</b> Roughing, semi-finishing and finishing.', ['AM14', 'WP_BR', 'EE_BR']) +
    cgP('<b>Rise per tooth</b> is the step up from one tooth to the next and sets the chip thickness. It is largest on the roughing teeth and smaller on the semi-finishing teeth; the finishing teeth are all one size.', ['AM14', 'WP_BR']) +
    cgP('<b>Spare finishing teeth.</b> Because the finishing teeth do not rise, the later ones take over the sizing as the first ones wear.', ['WP_BR']) +
    cgP('<b>Rise per tooth, in figures.</b> 0.003 to 0.006 in (0.076 to 0.152 mm) for surface broaching and 0.0012 to 0.0025 in (0.030 to 0.064 mm) for broaching a diameter.', ['WP_BR']) +
    cgP('<b>Pitch.</b> The tooth spacing is worked out from the length of the cut so that at least two teeth are in the work at any moment.', ['AM14', 'WP_BR']) +
    cgP('<b>One pitch or several.</b> The sources differ: Wikipedia has the pitch the same for every tooth of a broach; American Machinist has a larger pitch on the roughing teeth, for the bigger chip, and at times a smaller one on the semi-finishing teeth to shorten the tool. No formula for the pitch could be read from either source, so none is given here.', ['AM14', 'WP_BR']) +
    cgP('<b>Tooth proportions and angles.</b> Land and gullet radius each a quarter of the pitch; hook angle 15 to 20° for steel and 6 to 8° for cast iron; back-off angle 1 to 3°.', ['WP_BR']) +
    cgP('<b>Gullet.</b> Its depth goes with the rise, the pitch and the work material, and its root radius makes the chip curl up on itself.', ['AM14']) +
    cgP('<b>Chip breakers</b> are notches ground across the roughing and semi-finishing teeth, staggered from one tooth to the next. On a round broach they stop ring-shaped chips from wedging in the gullets and breaking the tool.', ['AM14']) +
    cgP('<b>Along a pull broach.</b> The pull end goes through the starting hole and locks into the puller of the machine. The front pilot lines the tool up in the starting hole and proves that the hole is large enough. After the teeth, the rear pilot keeps the tool in line while the last finishing teeth pass through.', ['AM14']) +
    cgP('<b>Push broaches</b> are worked in an arbor press or a machine built like one.', ['AM14', 'WP_BR']) +
    cgP('<b>Why push broaches are short.</b> A push broach is a column in compression and buckles and breaks under too much load, so a long, slender broach has to be pulled.', ['AM14']) +
    cgP('<b>Starting hole.</b> Broaching an internal shape needs a hole through the work first, for the tool to enter.', ['AM14', 'WP_BR']) +
    cgP('<b>What can be broached.</b> Almost any cross-section, as long as every surface runs parallel to the stroke and nothing stands in the path of the tool.', ['AM14', 'WP_BR']) +
    cgP('<b>Surface broaching.</b> Either the broach passes over the work or the work passes over the broach.', ['AM14', 'WP_BR']) +
    cgP('<b>Work hardness.</b> Steel broaches best at 16 to 24 HRC; above 35 HRC the broach dulls quickly.', ['WP_BR']) +
    cgP('<b>Accuracy.</b> Typically ±0.002 in (±0.05 mm), and ±0.0005 in (±0.01 mm) in precise work, with a finish of 16 to 63 microinches.', ['WP_BR']) +
    cgP('<b>Rotary broaching</b> needs no broaching machine: on a lathe or a mill the broach spins freely in a holder whose axis is tilted, typically by 1°, to the axis of the work, and is pressed in.', ['WP_BR']) +
    cgP('<b>Broach material.</b> Most broaches are high speed steel or an alloy steel.', ['WP_BR', 'EE_BR']) +

    '<h2 id="cg-bore">Boring tools</h2>' +
    cgP('<b>Why bore.</b> A drill or a reamer makes only its own size. Boring makes any diameter, straightens a hole that a long drill let wander or that was cast in, and makes it run true with the outside when both are machined at one setting.', ['AM10']) +
    guideTable(['Tool', 'What it does'], CG_BORE, cgTags) +
    cgP('<b>Overhang of a steel bar.</b> Four times the bar diameter is the practical limit; beyond it a steel bar chatters.', ['AM10', 'CTE_B']) +
    cgP('<b>Stiffer bars.</b> A heavy metal (tungsten alloy) bar reaches 6 diameters or more and a carbide bar 8 or more; some makers report 20 diameters with tunable damped bars. Carbide bars over 1 in diameter are seldom practical for their cost.', ['CTE_B']) +
    cgP('<b>Why carbide.</b> Carbide is three times as stiff as steel, but weak in tension.', ['AM10']) +
    cgP('<b>Against chatter, first.</b> Use the largest bar that still leaves room for the chips, and the shortest overhang.', ['AM10', 'CTE_B']) +
    cgP('<b>The insert.</b> Positive rake, a nose radius smaller than the depth of cut, and a lead angle of 0°, never more than 15°. Choose a tougher carbide grade than for outside turning.', ['AM10']) +
    cgP('<b>Then speed and feed.</b> More feed, less speed, or both, change the pressure on the tool and can stop the chatter; so can a different depth of cut.', ['CTE_B']) +
    cgP('<b>Coolant</b> through the bar is recommended.', ['AM10']) +
    cgP('How far a bar bends under the cut, with the overhang figures of the bar makers, is worked out in <a href="#/t/boringbar">boring bar deflection</a>.', null) +

    '<h2 id="cg-src">Sources</h2><ul class="gsl">' + Object.entries(CG_SOURCES).map(([k, v]) => '<li><b>' + k + '</b> ' + gesc(v) + '</li>').join('') + '</ul>' +
    '<p class="desc">Full URLs and access dates are in docs/sources.md, "Cutting tools guide". No text, figures or tables were copied from the sources.</p>';
  guideToc(el);
}
