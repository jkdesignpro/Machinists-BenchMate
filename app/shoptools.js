// Shop tools guide (parity BB18, BB24, BB25, BB27, BB28, BB60, BB62, BB80, MH157, MH163; parts of BB26, MH129,
// MH132, MH156, MH158, MH164). All wording and drawings are BenchMate's own. Every statement carries the keys
// of the public sources read for it (docs/sources.md, "Shop tools guide"); one with fewer than two independent
// publishers is shown as "to be verified". Where two charts give different figures both are shown.
'use strict';

const ST_SOURCES = {
  TTE: 'TTE training college, work instruction "Sharpening twist drills" (tte-lisa.ac.uk; no author or date)',
  NAVY: 'Machinery Repairman training manual, page 5-21, "Grinding drill lip correctly" (as reproduced at enginemechanics.tpub.com)',
  NILS_L: 'J. A. Nilsson, The Lathe Mastery Wiki Book, "Grinding your own tools: from blank to sharp" (jonilsson.github.io)',
  MINI: 'mini-lathe.com, "Grinding lathe tools" (no author or date)',
  DONNER: 'D. M. Donner, Introduction to Machining, 5.2 "Stock preparation" (Washington open textbook, CC BY 4.0)',
  TAMESON: 'S. L. Simonson, Tameson, "Hacksaw blade selection", 2022-09-05',
  FAST: 'Fastenal, Metalworking Tool Talk, "Bandsaw blades", October 2018',
  SAWB: 'Sawblade.com, tech tip "Breaking in band saw blades" (no author; year not shown)',
  MMS_SAW: 'R. Saxon (Simonds International), Modern Machine Shop, "Avoiding bandsaw blunders", 2012-03-13',
  RUKO: 'AutomationDirect, "Hole saws: recommended cutting speeds" (chart for RUKO hole saws)',
  REMORA: 'Remora Electrical knowledge base, "Recommended hole saw cutting speeds" (the file is named for Starrett)',
  KLING: 'Klingspor, product page "Carbide burrs": cuts and recommended speeds (klingspor.de)',
  AMANA: 'Amana Tool, "General burr speed recommendations"',
  AM: 'D. Walker, American Machinist, "Choosing the right coolants and lubricants for machining", 2023-12-06',
  FUCHS: 'FUCHS Lubricants Sweden, "How to choose the right cutting fluid?" (fuchs.com)',
  BACON: 'T. A. Bacon, Introduction to Machining, 11.2 "Grinding wheels" (Washington open textbook, CC BY 4.0)',
  PALM: 'Palmgren, "How to dress a grinding wheel for optimal performance", 2024-10-02',
  MMS_DRESS: 'D. Goetz (Norton, Saint-Gobain Abrasives), Modern Machine Shop, "Optimize grinding processes with proper truing and dressing tools", 2019-07-20',
  OWN: 'BenchMate arithmetic or reasoning from the sources beside it',
};
// Two chapters of one open textbook count once, as do two articles in one magazine.
const ST_FAMILY = { DONNER: 'WAOPEN', BACON: 'WAOPEN', MMS_SAW: 'GARDNER', MMS_DRESS: 'GARDNER' };
const stTags = keys => guideTags(keys, ST_SOURCES, ST_FAMILY);
const stP = (html, keys) => '<p>' + html + (keys === null ? '' : ' ' + stTags(keys)) + '</p>';

// A general-purpose drill point from the side and from the end.
function stDrill() {
  return cnSvg(440, 190,
    '<path class="gfill" d="M100 16V110L140 134L180 110V16Z"/><path class="gp" d="M100 16V110L140 134L180 110V16"/><path class="gk" d="M140 8V160"/>' +
    '<path class="gc" d="M140 134L96 160M140 134L184 160"/>' + cnT(140, 176, '118° (59° each side)', 'gs', 'middle') +
    cnT(92, 126, 'lip', 'gs', 'end') + cnT(188, 126, 'lip', 'gs') + cnT(140, 60, 'both lips', 'gs', 'middle') + cnT(140, 74, 'equal', 'gs', 'middle') +
    '<circle class="gfill" cx="340" cy="84" r="46"/><circle class="gp" cx="340" cy="84" r="46"/>' +
    '<path class="gp" d="M347 77H385.5M333 91H294.5"/><path class="gw" d="M333 91L347 77"/>' +
    cnT(340, 150, 'from the end: chisel edge', 'gs', 'middle') + cnT(340, 164, 'about 45° to the lips', 'gs', 'middle') +
    cnT(366, 70, 'lip', 'gs', 'middle') + cnT(314, 106, 'lip', 'gs', 'middle'),
    'A general-purpose drill point: 118 degrees included with two equal lips seen from the side, and the chisel edge at about 45 degrees to the lips seen from the end');
}
// A lathe tool bit from above with the order of grinding.
function stBit() {
  return cnSvg(440, 170,
    '<path class="gfill" d="M40 60H280L330 76L312 120H40Z"/><path class="gp" d="M40 60H280L330 76L312 120H40Z"/>' +
    '<path class="gk" d="M226 60L276 120"/>' +
    cnT(338, 104, '1 end relief', 'gs') + cnT(300, 50, '2 side relief', 'gs', 'middle') + cnT(292, 98, '3 top', 'gs', 'middle') +
    '<circle class="gw" cx="328" cy="77" r="5"/>' + cnT(344, 72, '4 nose radius', 'gs') +
    cnT(130, 94, 'tool bit, seen from above', 'gs', 'middle') +
    cnT(220, 150, 'grind in this order; cool the bit in water as you go', 'gs', 'middle'),
    'A lathe tool bit seen from above with the faces numbered in the order they are ground: end relief, side relief, top rake, nose radius');
}
// Sections through six wheel shapes.
function stWheels() {
  const sec = (cx, pts) => { const d = s => 'M' + pts.map(p => (cx + s * p[0]) + ' ' + (36 + p[1])).join('L') + 'Z';
    return '<path class="gfill" d="' + d(1) + d(-1) + '"/><path class="gp" d="' + d(1) + d(-1) + '"/><path class="gk" d="M' + cx + ' 26V86"/>'; };
  const lab = (cx, n, t) => cnT(cx, 104, 'type ' + n, 'gv', 'middle') + cnT(cx, 120, t, 'gs', 'middle');
  return cnSvg(440, 150,
    sec(40, [[4, 0], [28, 0], [28, 16], [4, 16]]) + lab(40, 1, 'straight') +
    sec(112, [[14, 0], [24, 0], [24, 36], [14, 36]]) + lab(112, 2, 'cylinder') +
    sec(184, [[4, 6], [12, 6], [12, 0], [28, 0], [28, 16], [4, 16]]) + lab(184, 5, 'recessed') +
    sec(256, [[4, 5], [12, 5], [12, 0], [28, 0], [28, 16], [12, 16], [12, 11], [4, 11]]) + lab(256, 7, 'both sides') +
    sec(328, [[4, 0], [16, 0], [30, 30], [22, 30], [13, 10], [4, 10]]) + lab(328, 11, 'flaring cup') +
    sec(400, [[4, 0], [14, 0], [30, 10], [30, 14], [24, 14], [12, 7], [4, 7]]) + lab(400, 12, 'dish') +
    cnT(220, 142, 'sections through the axis', 'gs', 'middle'),
    'Sections through six grinding wheel shapes: type 1 straight, type 2 cylinder, type 5 recessed one side, type 7 recessed both sides, type 11 flaring cup, type 12 dish');
}

const ST_FAULTS = [
  ['Lips at unequal angles, or of unequal length', 'The drill does not turn about its own centre. The hole comes out oversize, and one lip does the cutting and wears fast.', ['TTE']],
  ['Point too flat', 'The drill does not centre well on the work.', ['TTE']],
  ['Point too steep', 'It needs more power and cuts slowly.', ['TTE']],
  ['Too much clearance', 'The edge is thin, cannot carry the heat away and breaks down.', ['TTE']],
  ['Too little clearance', 'There is hardly a cutting edge: the drill rubs, and forcing the feed can break it.', ['TTE']],
];
const ST_SAW = [
  ['Teeth chipped or broken', 'No break-in, the wrong blade for the job, work not clamped firmly, too much feed, hard spots or scale.', ['FAST']],
  ['Cracks from the back edge', 'Too much feed, worn or over-tight back-up guides, wrong band tension, band not tracking.', ['FAST']],
  ['Gullets packed with chips', 'Pitch too fine, too much feed, chip brush worn or out of place, too little fluid.', ['FAST']],
  ['Teeth worn smooth and round', 'No break-in, band too fast for the material, feed too light, abrasive material, too little fluid.', ['FAST']],
  ['Teeth stripped off the band', 'No break-in, chip brush worn or missing, too much feed, work moving, wrong pitch for the section.', ['FAST']],
];
// rpm at four diameters: the first chart's figure for the top of its diameter band, then the second chart's maximum.
const ST_HOLE = [
  ['25 mm (1 in)', '350 / 382', '175 / 255', '470 / 382', '470 / 446', '235 / 127'],
  ['51 mm (2 in)', '170 / 187', '85 / 125', '230 / 187', '230 / 219', '115 / 62'],
  ['76 mm (3 in)', '115 / 126', '55 / 84', '150 / 126', '150 / 147', '75 / 42'],
  ['102 mm (4 in)', '85 / 94', '40 / 62', '110 / 94', '110 / 109', '55 / 31'],
];
const ST_FLUID = [
  ['Neat (straight) oil', 'Oil used as it comes, with additives for heavy pressure. The best lubrication and rust protection: slow, heavy work such as tapping, threading and deep drilling. It cools poorly, is messy and harder to clean off, and can burn.', ['AM', 'FUCHS']],
  ['Emulsion (soluble oil)', 'Oil mixed into water. Cools and lubricates: the all-round fluid for turning, milling, drilling and grinding most materials. It has to be looked after and changed in time.', ['FUCHS', 'AM']],
  ['Semi-synthetic', 'Soluble oil and synthetic fluid together in water, between the two in what it does: turning and milling. It can foam in some waters.', ['AM']],
  ['Synthetic', 'A solution in water with no oil. The best cooling and cleaning: grinding and fast, light cutting. It lubricates least unless it carries an additive for that.', ['AM', 'FUCHS']],
];

function renderShopTools(el) {
  const toc = [['st-drill', 'Sharpening drills'], ['st-bit', 'Lathe tool bits'], ['st-saw', 'Hacksaw and band saw'], ['st-hole', 'Hole saws'], ['st-burr', 'Carbide burrs'], ['st-fluid', 'Cutting fluids'], ['st-wheel', 'Grinding wheels'], ['st-src', 'Sources']];
  el.innerHTML =
    '<nav class="gtoc">' + toc.map(([a, t]) => '<a href="#' + a + '">' + t + '</a>').join('') + '</nav>' +
    '<p class="desc">Bench and toolroom practice: sharpening drills and lathe tool bits, choosing saw blades and breaking them in, hole saw and burr speeds, choosing a cutting fluid, and grinding wheel shapes with dressing and truing, in our own words with our own drawings. Each statement shows the keys of the sources that confirm it (hover a key); anything not confirmed by two independent publishers is marked <span class="gtbv">to be verified</span>. Wear eye protection at any grinder, and keep its guards and tool rest in place.</p>' +

    '<h2 id="st-drill">Sharpening a twist drill</h2>' + stDrill() +
    stP('<b>Four things have to be right.</b> Both lips at the same angle, both lips the same length, the right clearance behind each lip, and the right chisel edge angle.', ['NAVY', 'TTE']) +
    stP('<b>Lip clearance.</b> 8 to 12 degrees behind each lip on the general-purpose point, and the same on both.', ['TTE', 'NAVY']) +
    stP('<b>Flat point.</b> The flatter point for hard, tough materials takes 6 to 9 degrees of clearance.', ['NAVY']) +
    stP('<b>Chisel edge as a check.</b> Looked at from the end, the chisel edge should lie at about 45 degrees to the lips. If it does, the clearance is about right.', ['TTE']) +
    stP('<b>By hand.</b> Dress the wheel first. Grind one lip at 59 degrees to the axis, turn the drill over and grind the other the same, checking both with the gauge as you go. Then grind the clearance behind each edge.', ['TTE']) +
    stP('<b>Drill point gauge.</b> Hold the gauge against the body of the drill and bring its graduated edge down onto one lip: it shows the angle and the length of that lip together. Do the same on the other lip.', ['NAVY', 'TTE']) +
    stP('<b>Heat.</b> Do not let the point turn blue: the hardness is lost there and all the blue has to be ground away. Do not dip a hot drill in cold water either, since the lips can crack.', ['TTE']) +
    '<p class="desc">What a badly ground point does:</p>' + guideTable(['Fault', 'Effect'], ST_FAULTS, stTags) +
    stP('<b>Web thinning.</b> The web is thicker toward the shank, so a drill that has been sharpened many times has a wide chisel edge, which scrapes and needs heavy feed pressure. Thin the web on a narrow wheel with a rounded face, taking the same amount from each flute. Do not overdo it: a web that is too thin can split.', ['TTE']) +
    stP('Point angles by material are in the <a href="#/t/toolguide">tooling guide</a>; the length of the point is worked out in <a href="#/t/drillpoint">drill point length</a>.', null) +

    '<h2 id="st-bit">Grinding a lathe tool bit</h2>' + stBit() +
    stP('<b>Order.</b> The end relief first, then the side relief, then the top, then the nose radius.', ['NILS_L', 'MINI']) +
    stP('<b>Relief.</b> About 10 degrees on the end and on the side in both guides; one of them holds the end at 10 to 15 degrees.', ['NILS_L', 'MINI']) +
    stP('<b>Top rake by material.</b> More for aluminium, little or none for brass, which digs in on a keen edge. One guide gives 5 to 8 degrees for steel and cast iron and 35 to 40 degrees for aluminium.', ['NILS_L', 'MINI']) +
    stP('<b>Keep the height.</b> When grinding the top, do not grind the cutting edge itself down, or the tip ends up below centre.', ['MINI']) +
    stP('<b>Nose radius.</b> Always put one on. One guide gives 1/64 in for roughing, 1/32 in for finishing and 1/16 in for heavy cuts; the other 1/32 to 1/16 in for turning and facing.', ['NILS_L', 'MINI']) +
    stP('<b>Cooling.</b> Dip the bit in water often, before it discolours; one guide says about every 15 seconds.', ['MINI', 'NILS_L']) +
    stP('<b>Wheel.</b> Dress the wheel often, whenever it loads or glazes.', ['NILS_L', 'MINI']) +
    stP('One guide uses white aluminium oxide wheels, 60 grit to rough and 120 grit to finish, with the tool rest no more than 1/8 in from the wheel.', ['NILS_L']) +
    stP('<b>Finish.</b> Take the burr off with a fine stone, without rounding the cutting edge.', ['NILS_L', 'MINI']) +
    stP('The names of the angles are in the <a href="#/t/toolguide">tooling guide</a>, and the finish a nose radius gives is in <a href="#/t/finish">surface finish from nose radius</a>.', null) +

    '<h2 id="st-saw">Hacksaw and band saw blades</h2>' +
    stP('<b>Three teeth in the cut.</b> At least three teeth should be on the work at all times; with two the blade binds and loses teeth. So the pitch can be at most a third of the thickness: 1/4 in stock needs a pitch of 0.083 in or finer.', ['DONNER']) +
    stP('<b>Hacksaw blades.</b> 18 and 24 teeth per inch do most workshop jobs, and 32 is for thin-walled tube. A blade that is too fine clogs: its small gullets fill with chips.', ['TAMESON', 'DONNER']) +
    stP('<b>Fitting.</b> The teeth point forward, because a hacksaw cuts on the push stroke. Tension the blade hard, so that it cannot wobble.', ['DONNER', 'TAMESON']) +
    stP('<b>Bi-metal</b> blades are the economical choice, by hand and on the band saw.', ['DONNER', 'FAST']) +
    stP('<b>Band saw blades.</b> Bi-metal for most metals, carbide teeth for the hardest cutting and the longest life, carbon steel for light general work.', ['FAST']) +
    stP('<b>Break in a new band saw blade.</b> Run the right band speed for the material but ease the feed for the first cuts, then bring it up gradually. The figures differ: one supplier says to feed at 20 to 50 % of the normal rate, with the larger cut in feed for soft material; another to feed 20 to 25 % below normal for the first 100 square inches.', ['FAST', 'SAWB']) +
    stP('<b>Chips tell.</b> Thin, powdery chips: the feed is too light. Blue or burnt chips: too much speed or feed. Curled, silvery chips: right.', ['SAWB']) +
    stP('<b>Speed and feed.</b> Slow the band for tough material and speed it up for soft. Too little feed makes the teeth rub and wear; too much chips and strips them.', ['MMS_SAW', 'FAST']) +
    stP('<b>Fluid and brush.</b> Keep sawing fluid on the cut and the chip brush working, so that chips are not carried back into the cut.', ['MMS_SAW', 'FAST']) +
    stP('Band sawing wants a richer mix of fluid than other machining.', ['MMS_SAW']) +
    '<p class="desc">What a band saw blade shows, and the usual causes:</p>' + guideTable(['What you see', 'Usual causes'], ST_SAW, stTags) +
    stP('The pitch for a section is worked out in <a href="#/t/sawtpi">saw blade pitch</a> and the time for a cut in <a href="#/t/bandsaw">band saw cut time</a>.', null) +

    '<h2 id="st-hole">Hole saws</h2>' +
    '<p class="desc">Speeds in rpm from two charts for bi-metal hole saws, as printed. The first figure is one chart\'s speed for the top of its diameter band, the second the other chart\'s maximum. Their columns are not named alike: "stainless and tool steel" against "alloyed steel", and the first chart has one column for brass, copper and aluminium. ' + stTags(['REMORA', 'RUKO']) + '</p>' +
    '<div class="res cntab" style="max-width:none"><table class="gtab"><tr><th>Saw diameter</th><th>Mild steel</th><th>Stainless or alloy steel</th><th>Aluminium</th><th>Brass</th><th>Cast iron</th></tr>' +
    ST_HOLE.map(r => '<tr><td><b>' + gesc(r[0]) + '</b></td>' + r.slice(1).map(c => '<td>' + gesc(c) + '</td>').join('') + '</tr>').join('') + '</table></div>' +
    stP('<b>Bigger saw, slower.</b> The speed falls as the diameter rises, and harder material is slower again. Too fast heats the teeth, and hot teeth go dull or strip.', ['REMORA', 'RUKO']) +
    stP('<b>The charts differ most on cast iron,</b> where one is nearly twice as fast as the other. Start from the slower figure.', ['REMORA', 'RUKO', 'OWN']) +
    stP('<b>Another size.</b> In mild steel both charts come to a cutting speed of about 27 to 30 m/min (90 to 100 ft/min) at the teeth: put that and the saw diameter into <a href="#/t/rpm">spindle speed</a>.', ['REMORA', 'RUKO', 'OWN']) +
    stP('<b>Deep cuts.</b> Use the low end of the speed range and stop now and then to clear the swarf.', ['REMORA']) +
    stP('<b>Coolant.</b> One chart calls for cutting spray on steel and aluminium, and air alone on cast iron and brass.', ['RUKO']) +

    '<h2 id="st-burr">Carbide burrs</h2>' +
    stP('<b>Cuts.</b> A plain cut for general finishing; a double cut, which makes a small chip and runs with less vibration, for general use; a coarse aluminium cut for soft metals and plastics, which clog finer teeth. Makers also grind cuts for steel and for stainless steel.', ['KLING']) +
    stP('<b>Speed falls with size, and the charts differ.</b> For a 6 mm (1/4 in) burr one maker gives 30 000 to 35 000 rpm (solid carbide) and the other 15 000 to 45 000 depending on the material; for 12 mm (1/2 in), 20 000 to 25 000 against 7 000 to 22 000; for 25 mm (1 in), 12 000 to 18 000 against 4 000 to 10 000.', ['AMANA', 'KLING']) +
    stP('<b>By material.</b> For burrs of 4 mm and over, the chart that goes by material runs fastest in unhardened steel and slowest in aluminium and plastics.', ['KLING']) +
    stP('<b>Long shanks</b> run slower.', ['AMANA']) +

    '<h2 id="st-fluid">Choosing a cutting fluid</h2>' + guideTable(['Kind', 'What it is and where it suits'], ST_FLUID, stTags) +
    stP('<b>The rule.</b> Slow, heavy cutting needs lubrication, which points to oil. Fast cutting needs cooling, which points to a fluid mixed with water.', ['FUCHS', 'AM']) +
    stP('<b>By material.</b> Cast iron and brass can often be cut dry or with an air blast. Aluminium and the tougher alloy steels need more lubrication.', ['FUCHS', 'AM']) +
    stP('<b>Copper.</b> One article warns that neat oils with their additives can attack copper.', ['AM']) +
    stP('<b>Looking after it.</b> Fluids mixed with water need care: check the concentration with a refractometer and make up what evaporates. They carry more risk of skin trouble than oil does.', ['AM', 'FUCHS', 'MMS_SAW']) +
    stP('Reading a refractometer is in <a href="#/t/coolconc">coolant concentration</a>, and topping up a sump in <a href="#/t/coolmix">coolant mixing</a>.', null) +

    '<h2 id="st-wheel">Grinding wheels: shapes, dressing and truing</h2>' + stWheels() +
    stP('<b>Shapes by number.</b> Type 1 straight, type 2 cylinder, type 4 tapered, type 5 recessed on one side, type 7 recessed on both sides, type 11 flaring cup, type 12 dish, type 13 saucer.', ['BACON']) +
    stP('<b>Which for what.</b> The straight wheel is the usual one for precision grinding. Recessed wheels keep the sides of the wheel off the work. Cup, dish and saucer wheels are for grinding tools and cutters.', ['BACON']) +
    stP('<b>Face.</b> A wheel normally cuts on its rim. Using the side as well as the rim grinds shoulders, slots and grooves.', ['BACON']) +
    stP('<b>The right wheel for the material.</b> Grinding a material the wheel is not made for, such as aluminium on a wheel for steel, clogs the wheel and heats it, and a badly overheated wheel can burst.', ['BACON']) +
    stP('<b>Choosing the wheel.</b> Aluminium oxide for steels; silicon carbide, the green wheel, for carbide. A coarse grit removes metal fast and leaves a rougher finish; a fine grit the reverse.', ['BACON']) +
    stP('<b>Grade.</b> A soft wheel for hard material, so that dull grain lets go and sharp grain comes up. A hard wheel on hard material holds its dull grain, glazes and burns the work.', ['BACON']) +
    stP('<b>Dressing and truing are two jobs.</b> Truing puts the wheel back to its shape and running round. Dressing renews the face: it clears the metal loaded into it and brings sharp grain to the surface.', ['PALM', 'MMS_DRESS']) +
    stP('<b>When.</b> A wheel that is glazed or loaded, has lost its shape, needs more pressure to cut or leaves a poorer finish is due for dressing.', ['PALM']) +
    stP('<b>Open or closed.</b> Dressed open, with fresh sharp points, a wheel removes stock fast and leaves a rougher finish. Dressed closed it rubs more: a better finish, and much slower stock removal.', ['MMS_DRESS']) +
    stP('<b>Tools.</b> A single-point diamond for fine wheels and exact work, a multi-point diamond for larger wheels, crush rolls for special forms. One maker\'s guide holds the diamond at 10 to 15 degrees to the wheel and dresses every 2 to 4 hours of steady use.', ['PALM']) +
    stP('The marking on a wheel is decoded in <a href="#/t/wheelcode">grinding wheel marking</a>, and its speed is checked in <a href="#/t/grindspeed">wheel speed</a>.', null) +

    '<h2 id="st-src">Sources</h2><ul class="gsl">' + Object.entries(ST_SOURCES).map(([k, v]) => '<li><b>' + k + '</b> ' + gesc(v) + '</li>').join('') + '</ul>' +
    '<p class="desc">Full URLs and access dates are in docs/sources.md, "Shop tools guide". No text, figures or tables were copied from the sources.</p>';
  guideToc(el);
}
