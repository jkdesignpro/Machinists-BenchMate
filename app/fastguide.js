// Fasteners guide (parity MH201, MH208, MH209, MH210, MH211, MH214, MH215, MH216).
// All wording and drawings are BenchMate's own. Every statement carries the keys of the public sources read for
// it (docs/sources.md, "Fasteners guide"); one with fewer than two independent publishers is shown as
// "to be verified". Where two sources give different figures both are shown with the source named.
'use strict';

const FG_SOURCES = {
  NORD: 'Nord-Lock Group, "The Experts: Thread engagement in a tapped hole" (no author shown)',
  UW: 'University of Wisconsin physics instrument shop, FAQ (no author shown)',
  FAST_ART: 'Fastenal, engineering article "Screw thread design", rev. 2009 (no author shown)',
  MD_LOCK: 'Machine Design, K. Bock (Nord-Lock), "Proper fastener selection and application are key to bolted joints that won’t loosen or lose clamping force", 2009-06-16',
  FE_LOCK: 'Fastener Engineering, J. Muelaner, "What is the difference between a lock washer and a vibration-resistant washer?", 2020-04-20',
  ESS_LN: 'Essentra Components, "What is a lock nut? How does it work?" (no author or date shown)',
  WP_SW: 'Wikipedia, "Safety wire" (CC BY-SA)',
  FAA_SW: 'FAA Safety Team fact sheet "Safety wire", AFS-850 20-05',
  WP_SS: 'Wikipedia, "Set screw" (CC BY-SA)',
  TAM_SS: 'Tameson, "Your guide to set screw point types" (no author or date shown)',
  BOLTS_SS: 'bolts.co.uk, "Guide to socket head sets and grub screw point types" (no author or date shown)',
  ACCU_H: 'Accu, "Different screw head types: an engineer’s guide" (no author or date shown)',
  ESS_H: 'Essentra Components, "What are screws heads, drives and threads?" (no author or date shown)',
  MD_TS: 'Machine Design, "What’s the difference between thread-forming and thread-cutting tapping screws?", 2015-07-14',
  ESS_TS: 'Essentra Components, "Self-tapping fasteners: the facts on this cleverly designed component" (no author or date shown)',
  SB_TS: 'Specialty Bolt & Screw, "Threads, thread forms, and points" (no author or date shown)',
  MD_PIN: 'Machine Design, "Semipermanent pins", 2002-11-15',
  FE_PIN: 'Fastener Engineering, J. Muelaner, article on pin fasteners (title and date not shown)',
  WP_RR: 'Wikipedia, "Retaining ring" (CC BY-SA)',
  RC: 'Rotor Clip, F. Ellison, "Exploring retaining ring styles: a comprehensive guide", 2023-09-06',
  EH_BR: 'Aircraft Engine Historical Society, G. White, "British fastening systems", with S. Moore, "Why British spanners have dual markings"',
  WP_BSW: 'Wikipedia, "British Standard Whitworth" (CC BY-SA)',
  XO_CB: 'D. McClements, Xometry, "Spotface vs. counterbore holes in machining: their key differences", 2022-12-16, updated 2025-11-19',
  MG_CB: 'B. Fowler, Machinist Guides, "Counterbores: all about", 2021-02-16, modified 2026-03-01',
  FIC_CB: 'T. Axsom, Fictiv, "Our guide to counterbore holes", 2023-09-08',
  NIST_FQA: 'NIST, "Compliance FAQs: Fastener Quality Act (FQA)", content last updated 2019-11-15',
  MB_CB: 'B. Marciszewski, Metric Bolt, "Counterfeit bolts: risks and mitigation in military applications", 2025-04-04 (a supplier\'s page)',
  EASA_CB: 'R. A. Huber, EASA, "Counterfeit bolts: tips on how to avoid them", April 2003 (only the introduction is public)',
  LBL_SCI: 'Lawrence Berkeley National Laboratory, "Suspect counterfeit items", 2020-02-18',
  BSCI_TM: 'Bolt Science Limited, "Methods of tightening threaded fasteners"',
  AC_ANG: 'Atlas Copco, Z. Mikic, "Beyond torque: using angle and other methods to ensure proper tightening", 2026-04-15',
};
// Several pages of one publisher count once.
const FG_FAMILY = { WP_SW: 'WIKI', WP_SS: 'WIKI', WP_RR: 'WIKI', WP_BSW: 'WIKI', MD_LOCK: 'ENDEAVOR', MD_TS: 'ENDEAVOR', MD_PIN: 'ENDEAVOR', ESS_LN: 'ESSENTRA', ESS_H: 'ESSENTRA', ESS_TS: 'ESSENTRA', FE_LOCK: 'FE', FE_PIN: 'FE' };
const fgTags = keys => guideTags(keys, FG_SOURCES, FG_FAMILY);
const fgP = (html, keys) => '<p>' + html + (keys === null ? '' : ' ' + fgTags(keys)) + '</p>';
const fgBox = d => '<path class="gfill" d="' + d + '"/><path class="gp" d="' + d + '"/>';

// A screw through a clamped part into a tapped part, with the engaged length marked.
function fgEngage() {
  const teeth = x => Array.from({ length: 10 }, (_, i) => 'M' + x + ' ' + (72 + 6 * i) + 'l' + (x < 140 ? -5 : 5) + ' 3l' + (x < 140 ? 5 : -5) + ' 3').join('');
  return cnSvg(420, 170,
    fgBox('M60 70H220V160H60Z') + '<path class="gp" d="M60 46H220V70H60Z"/>' +
    fgBox('M110 6H170V20H110Z') + fgBox('M125 20H155V132H125Z') +
    '<path class="gm" d="' + teeth(125) + teeth(155) + 'M125 132V142H155V132"/>' +
    '<path class="gc" d="M240 70V132M234 70H246M234 132H246M125 33H155M125 28V38M155 28V38"/>' +
    '<path class="gm" stroke-dasharray="3 3" d="M220 70H240M155 132H240"/>' +
    cnT(250, 105, 'engagement', 'gs') + cnT(162, 37, 'd', 'gv') + cnT(228, 62, 'clamped part', 'gs') + cnT(66, 154, 'tapped part', 'gs'),
    'A screw passes through a clamped part and is screwed into a tapped part; the length of thread in the tapped part is marked as the engagement, and the diameter of the screw as d');
}
// Two bolt heads wired so that the pull of the wire tightens both.
function fgWire() {
  const hex = (cx, cy) => 'M' + Array.from({ length: 6 }, (_, i) => (cx + 34 * Math.cos(i * Math.PI / 3)).toFixed(1) + ' ' + (cy + 34 * Math.sin(i * Math.PI / 3)).toFixed(1)).join('L') + 'Z';
  return cnSvg(420, 150,
    fgBox(hex(120, 72)) + fgBox(hex(300, 72)) +
    '<path class="gm" stroke-dasharray="3 3" d="M128 43L112 101M292 101L308 43"/>' +
    '<path class="gc" id="fgw" d="M128 43L292 101"/>' +
    '<path class="gc" d="M112 101L100 107L79 72L100 37L128 43M308 43L326 30M322 36L330 26M146 44l-3 10M176 55l-3 10M206 66l-3 10M236 76l-3 10M266 87l-3 10"/>' +
    '<path class="gm" d="M150 20A52 52 0 0 1 168 44M168 44L160 39M168 44L169 34M330 100A52 52 0 0 1 300 124M300 124L309 123M300 124L305 116"/>' +
    cnT(176, 24, 'tightens', 'gs') + cnT(336, 124, 'tightens', 'gs') +
    cnT(210, 144, 'the pull of the wire turns each bolt the tightening way', 'gs', 'middle'),
    'Two hexagon bolt heads seen from above, each with a hole drilled across it. A twisted wire runs from the top of the left head to the bottom of the right head, so that its pull would turn each bolt clockwise, the tightening direction of a right-hand thread');
}
// Six set screw points in side view.
function fgPoints() {
  const tip = [
    ['cup', x => 'V60L' + (x + 30) + ' 66Q' + (x + 18) + ' 54 ' + (x + 6) + ' 66L' + x + ' 60Z'],
    ['flat', x => 'V60L' + (x + 30) + ' 66H' + (x + 6) + 'L' + x + ' 60Z'],
    ['cone', x => 'V60L' + (x + 18) + ' 80L' + x + ' 60Z'],
    ['oval', x => 'V60Q' + (x + 18) + ' 80 ' + x + ' 60Z'],
    ['dog', x => 'V60H' + (x + 28) + 'V80H' + (x + 8) + 'V60H' + x + 'Z'],
    ['half dog', x => 'V60H' + (x + 28) + 'V70H' + (x + 8) + 'V60H' + x + 'Z'],
  ];
  return cnSvg(420, 112, tip.map(([name, f], i) => { const x = 20 + 68 * i; return fgBox('M' + x + ' 16H' + (x + 36) + f(x)) + '<path class="gm" d="M' + x + ' 26l36 -6M' + x + ' 36l36 -6M' + x + ' 46l36 -6M' + x + ' 56l36 -6"/>' + cnT(x + 18, 102, name, 'gs', 'middle'); }).join(''),
    'Six set screws in side view with different points: cup, with a hollow end; flat; cone, coming to a sharp point; oval, with a rounded end; dog, with a plain cylindrical tip; and half dog, with a tip half as long');
}
// Five pins seen from the end.
function fgPins() {
  const cy = 52, r = 26;
  const spiral = cx => 'M' + Array.from({ length: 55 }, (_, i) => { const a = i * Math.PI / 12, q = r - 11 * i / 54; return (cx + q * Math.cos(a)).toFixed(1) + ' ' + (cy + q * Math.sin(a)).toFixed(1); }).join('L');
  const groove = cx => 'M' + Array.from({ length: 72 }, (_, i) => { const d = i * 5, near = [90, 210, 330].some(g => Math.abs(d - g) < 6), q = near ? r - 6 : r, a = d * Math.PI / 180; return (cx + q * Math.cos(a)).toFixed(1) + ' ' + (cy + q * Math.sin(a)).toFixed(1); }).join('L') + 'Z';
  return cnSvg(420, 128,
    '<circle class="gfill" cx="50" cy="52" r="26"/><circle class="gp" cx="50" cy="52" r="26" style="fill:none"/>' +
    '<path class="gp" style="stroke-width:5;fill:none" d="M143 29.5A26 26 0 1 1 117 29.5"/>' +
    '<path class="gp" style="stroke-width:3;fill:none" d="' + spiral(210) + '"/>' +
    fgBox(groove(290)) +
    fgBox('M368 26A26 26 0 0 0 368 78Z') + fgBox('M372 26A26 26 0 0 1 372 78Z') +
    cnT(50, 98, 'dowel', 'gs', 'middle') + cnT(130, 98, 'slotted', 'gs', 'middle') + cnT(210, 98, 'coiled', 'gs', 'middle') + cnT(290, 98, 'grooved', 'gs', 'middle') + cnT(370, 98, 'split pin', 'gs', 'middle') +
    cnT(210, 120, 'pins seen from the end', 'gs', 'middle'),
    'Five pins seen from the end: a dowel pin, a solid circle; a slotted spring pin, a ring with a gap; a coiled spring pin, a spiral of sheet; a grooved pin, a solid circle with three grooves; and a split pin, two half-round legs side by side');
}

const FG_LOCK = [
  ['Split (helical spring) washer', 'A spring under the head or nut.', 'Both sources: it does little or nothing against vibration.', ['MD_LOCK', 'FE_LOCK']],
  ['Toothed (star) washer', 'The teeth raise the friction at a given preload.', 'Small resistance to loosening.', ['FE_LOCK']],
  ['Belleville (conical spring) washer', 'A conical spring that can keep up a considerable preload.', 'Machine Design: not effective against vibration.', ['MD_LOCK', 'FE_LOCK']],
  ['Wedge-locking washers', 'Used as a pair: serrations on the outside grip the part and the nut, cams on the inside face each other, so that the bolt would have to stretch for the nut to turn back.', 'Machine Design, written by the maker: reusable.', ['MD_LOCK', 'FE_LOCK']],
  ['Nylon insert nut', 'A nylon collar smaller than the thread deforms over it and grips by friction.', 'Essentra: good up to 120 °C (248 °F); reuse weakens it. Machine Design: the nylon degrades when hot.', ['ESS_LN', 'MD_LOCK']],
  ['All-metal prevailing torque nut', 'The top of the nut is distorted and grips the thread by friction.', 'Essentra: it can still be taken off and adjusted.', ['ESS_LN', 'MD_LOCK']],
  ['Jam nut', 'A thin second nut tightened against the first.', 'Essentra: not best practice, because the load on the pair is hard to predict.', ['ESS_LN', 'MD_LOCK']],
  ['Castle nut and cotter pin', 'A pin passes through slots in the nut and a cross hole in the bolt, and its ends are bent over.', 'A positive lock, slow to fit. Essentra: for joints without a set preload, such as wheel hubs.', ['ESS_LN', 'MD_LOCK']],
  ['Thread-locking adhesive', 'An adhesive on the thread.', 'Hard to take apart, and sensitive to temperature.', ['MD_LOCK']],
  ['Safety wire', 'A wire through holes in the fasteners, as below.', 'A positive lock. Slow to fit and needs skill.', ['MD_LOCK', 'WP_SW']],
];
const FG_SET = [
  ['Cup', 'A hollow end. The most common point.', 'General use. Tameson: collars, gears and knobs on shafts.', ['WP_SS', 'TAM_SS', 'BOLTS_SS']],
  ['Knurled cup', 'A cup with a serrated rim that bites and resists vibration.', 'Wikipedia: not to be used twice, because the knurls deform.', ['WP_SS', 'TAM_SS', 'BOLTS_SS']],
  ['Flat', 'Presses flat on the surface and does the least damage.', 'Tameson: where the setting is changed often. bolts.co.uk: the least holding power.', ['WP_SS', 'TAM_SS', 'BOLTS_SS']],
  ['Cone', 'Goes in deepest, holds hardest and leaves a mark.', 'Tameson: permanent settings. Wikipedia: used with a recess in the other part.', ['WP_SS', 'TAM_SS', 'BOLTS_SS']],
  ['Oval', 'A rounded end that does little damage.', 'Where the setting is changed often.', ['TAM_SS']],
  ['Dog', 'A plain cylindrical tip that enters a hole or a slot.', 'Keeps parts located.', ['TAM_SS', 'BOLTS_SS']],
  ['Half dog', 'A dog point about half as long.', 'Where a full dog point would foul.', ['TAM_SS']],
  ['Nylon tip', 'A soft tip.', 'Leaves no mark.', ['TAM_SS']],
];
const FG_HEAD = [
  ['Pan', 'Rounded top, flat underside; sits on the surface.', 'General use.', ['ACCU_H', 'ESS_H']],
  ['Fillister', 'A deep cylindrical head with a slightly domed top and a deep slot.', 'Like a taller pan head.', ['ACCU_H', 'ESS_H']],
  ['Cheese', 'A disc with a flat top, slotted.', 'A wide bearing surface.', ['ACCU_H']],
  ['Truss (mushroom)', 'A wide, low dome with a large bearing surface.', 'Essentra: sheet metal. Accu: not for heavy loads.', ['ACCU_H', 'ESS_H']],
  ['Countersunk (flat)', 'A cone that sits flush in a countersink.', 'A flush surface. Accu: takes less torque than a cap or button head.', ['ACCU_H', 'ESS_H']],
  ['Raised countersunk (oval)', 'A countersunk head with a rounded top.', 'Essentra: decorative.', ['ACCU_H', 'ESS_H']],
  ['Button', 'A low rounded top with a socket drive.', 'Low profile. Takes less torque than a cap head.', ['ACCU_H']],
  ['Socket cap', 'A cylinder with a hexagon socket.', 'High torque and clamping force where space is tight.', ['ACCU_H', 'ESS_H']],
  ['Hexagon', 'Six sides, turned with a spanner from the side.', 'High torque.', ['ACCU_H', 'ESS_H']],
  ['Flanged', 'A washer face built into the head.', 'A wider bearing area without a loose washer.', ['ACCU_H']],
  ['Thumb and wing', 'Shaped to be turned by hand.', 'No tool needed. Limited torque: not for structural joints.', ['ACCU_H', 'ESS_H']],
];
const FG_DRIVE = [
  ['Slotted', 'The simplest and cheapest.', 'The driver slips out sideways.', ['ESS_H']],
  ['Phillips', 'Works with power drivers; cam-out limits overtightening.', 'Cam-out damages the recess.', ['ESS_H']],
  ['Pozidriv', 'A Phillips with an extra cross, which cams out less.', 'A Phillips driver fits a Pozidriv head, but not the other way round.', ['ESS_H']],
  ['Hexagon socket', 'High torque without cam-out; cheap.', 'Key and socket must match.', ['ESS_H']],
  ['Six-lobe (Torx)', 'High torque without cam-out.', 'Needs the exact driver size.', ['ESS_H']],
  ['Square (Robertson)', 'A tapered recess with good grip; high torque.', 'Harder to find.', ['ESS_H']],
];
const FG_TYPE = [
  ['Type A', 'Pointed, thread-forming.', 'Specialty Bolt: largely replaced by Type AB. Essentra: hard to find.', ['ESS_TS', 'SB_TS']],
  ['Type AB', 'Pointed (gimlet point), thread-forming.', 'Thin sheet metal.', ['ESS_TS', 'SB_TS']],
  ['Type B', 'Blunt point, thread-forming.', 'Holes in thin metal and non-ferrous castings.', ['ESS_TS', 'SB_TS']],
  ['Type 25', 'Blunt point with a slot that clears the chips, thread-cutting.', 'Hard plastics and die castings.', ['SB_TS']],
  ['Type U', 'A drive screw that is hammered in.', 'Permanent.', ['ESS_TS', 'SB_TS']],
  ['Three-lobed thread-rolling screw', 'A thread of three-lobed section that rolls its own thread in a pilot hole.', 'Steel and aluminium. Holds well against vibration.', ['SB_TS']],
  ['Self-drilling screw', 'A drill point makes the hole, so no pilot hole is needed.', 'Essentra: point No. 2 for light gauge sheet, No. 3 for medium, No. 4 or 5 for heavier material.', ['ESS_TS', 'SB_TS']],
];
const FG_PIN = [
  ['Dowel pin', 'A solid ground pin, held by a slight interference fit.', 'Locates one part on another. Machine Design: standard pins are 0.0002 in over the nominal size, oversize pins 0.001 in over.', ['MD_PIN', 'FE_PIN']],
  ['Taper pin', 'A pin that tapers along its length.', 'Machine Design: small end = large end less 0.02083 times the length, in inches.', ['MD_PIN']],
  ['Slotted spring pin', 'Sheet rolled into a tube with a slot. Squeezed into a hole smaller than itself, it springs out and grips.', 'Machine Design: it cannot flex any more once the slot has closed.', ['MD_PIN', 'FE_PIN']],
  ['Coiled spring pin', 'Sheet coiled more than one turn, gripping by spring pressure along its whole length.', 'Fastener Engineering: heavier duty than a slotted pin. Machine Design: takes shock and vibration better.', ['MD_PIN', 'FE_PIN']],
  ['Grooved pin', 'A solid pin with lengthwise grooves; the raised edges of the grooves are forced into the hole.', 'Machine Design: drill the hole to the nominal size and never undersize; no reaming.', ['MD_PIN', 'FE_PIN']],
  ['Split pin (cotter pin)', 'Half-round wire bent double. The two legs go through a cross hole and are bent apart.', 'Machine Design: 18 standard sizes from 1/32 in, in mild steel, brass, bronze, stainless steel or aluminium.', ['MD_PIN', 'FE_PIN']],
  ['Clevis pin', 'Listed with its sizes only.', 'Machine Design: 3/16 to 1 in, in soft or hardened steel.', ['MD_PIN']],
];
const FG_RING = [
  ['Axial ring (circlip), external or internal', 'Pushed along the axis into its groove, with pliers that fit the lug holes.', 'Tapered in section, so that it stays round and bears on the groove all the way round. Rotor Clip: takes significant thrust.', ['WP_RR', 'RC']],
  ['Radial ring (E-ring, C-ring)', 'Pushed onto a grooved shaft from the side, with an applicator.', 'No lug holes. Rotor Clip: for low thrust loads, and where a ring cannot be fitted from the end.', ['WP_RR', 'RC']],
  ['Self-locking (push-on) ring', 'Pushed on; needs no groove.', 'Rotor Clip: very low thrust loads. Wikipedia: hard to take off without damage.', ['WP_RR', 'RC']],
  ['Constant section ring (snap ring)', 'Of the same width all round; touches the groove at three points or more.', 'No lugs. Rotor Clip: for tight clearances and impact loads.', ['WP_RR', 'RC']],
  ['Spiral ring', 'Wound into the groove by hand, without special tools.', 'Bears on the groove all the way round, has no lugs, and comes out at a removal notch.', ['WP_RR', 'RC']],
  ['Bowed ring', 'A ring curved like a spring.', 'Takes up end play and the build-up of tolerances.', ['WP_RR', 'RC']],
  ['Bevelled ring', 'A 15 degree edge wedges between the groove and the part.', 'Takes up end play rigidly.', ['WP_RR']],
];
function renderFastGuide(el) {
  const toc = [['fg-eng', 'Thread engagement'], ['fg-lock', 'Keeping fasteners tight'], ['fg-tight', 'Tightening methods'], ['fg-set', 'Set screws'], ['fg-head', 'Heads and drives'], ['fg-tap', 'Self-tapping screws'], ['fg-pin', 'Pins'], ['fg-ring', 'Retaining rings'], ['fg-cb', 'Counterbore and spotface'], ['fg-fake', 'Counterfeit fasteners'], ['fg-brit', 'British fasteners']];
  el.innerHTML =
    '<nav class="gtoc">' + toc.map(([a, t]) => '<a href="#' + a + '">' + t + '</a>').join('') + '</nav>' +
    '<p class="desc">Fasteners as a machinist meets them, in our own words: how much thread to engage, what keeps a fastener tight, lock wire, set screw points, screw heads and drives, self-tapping screws, pins, retaining rings and the old British threads. Every statement was checked against public sources: they are listed under Sources at the bottom, where you can also show the source keys beside each statement. <span class="gtbv">to be verified</span> marks a statement not yet confirmed by two independent publishers. Where the sources give different figures, each figure is shown with its source.</p>' +

    '<h2 id="fg-eng">Thread engagement</h2>' + fgEngage() +
    fgP('<b>The aim.</b> Engage enough thread that the screw breaks before the threads strip.', ['NORD', 'FAST_ART']) +
    fgP('<b>Rule of thumb.</b> Nord-Lock: about 1 times the screw diameter in steel and about 2 times in aluminium. The Wisconsin physics shop: about 1.5 times the diameter as the best length.', ['NORD', 'UW']) +
    fgP('Fastenal: about 1 times the diameter in carbon steel and about 1.5 times in aluminium, with no real gain beyond that.', ['FAST_ART']) +
    fgP('The same shop gives three fully engaged threads as the least, and works an example: a 1/4-20 screw wants 0.375 in, about 7.5 threads.', ['UW']) +
    fgP('<b>Softer materials</b> and special alloys can need more than the rule gives. Then the length has to be calculated.', ['NORD']) +
    fgP('<b>Galling</b> is most common in stainless steel, aluminium and titanium. A lubricant with molybdenum disulphide or graphite helps, and so does pairing two different grades of stainless steel.', ['UW']) +
    fgP('The <a href="#/t/threadstrip">thread engagement and breaking force</a> calculator works these out for a thread. Strengths are under <a href="#/t/boltgrade">bolt grades and property classes</a>, tightening under <a href="#/t/bolttorque">bolt torque and preload</a>, thread inserts under <a href="#/t/sti">helical insert tapped holes</a>.', null) +

    '<h2 id="fg-lock">Keeping fasteners tight</h2>' +
    fgP('<b>Why they come loose.</b> Vibration makes the surfaces in contact slip. The friction in the thread is overcome and the clamp load is lost.', ['MD_LOCK']) +
    fgP('<b>Torque and friction.</b> About 90 % of the tightening torque goes into friction and only about 10 % into clamp load, so the state of the lubrication changes the clamp load a great deal.', ['MD_LOCK']) +
    guideTable(['Method', 'How it works', 'Notes'], FG_LOCK, fgTags) +
    fgP('<b>Vibration tests</b> named after Junker show how a joint loses its clamp load while it is shaken.', ['MD_LOCK', 'FE_LOCK']) +
    fgP('One article, written by a washer maker, says that most fasteners lose their clamp load within seconds in that test.', ['MD_LOCK']) +
    fgP('Threadlocker grades and colours are in the <a href="#/t/bearguide">bearings and seals guide</a>.', null) +
    '<h3 class="gcat">Safety wire (lock wire)</h3>' + fgWire() +
    fgP('<b>What it does.</b> Safety wire is a positive lock: a wire through holes in the fasteners that keeps them from backing out.', ['WP_SW', 'MD_LOCK']) +
    fgP('<b>Torque first.</b> The wire does not make or keep the torque. Tighten the fastener to its torque, then wire it.', ['WP_SW', 'FAA_SW']) +
    fgP('<b>Direction.</b> Lead the wire so that its pull tends to tighten the fastener.', ['WP_SW', 'FAA_SW']) +
    fgP('<b>Twists.</b> About 6 to 8 twists to the inch.', ['WP_SW', 'FAA_SW']) +
    fgP('<b>Once only.</b> Wire is used once. A fastener that has been undone gets new wire.', ['WP_SW', 'FAA_SW']) +
    fgP('<b>The wire</b> is usually stainless steel.', ['WP_SW', 'FAA_SW']) +
    fgP('Common diameters are 0.5 to 1 mm (0.020 to 0.041 in); 0.8 mm (0.032 in) is usual on aircraft and in racing. Bend the cut ends under so that nothing sharp sticks out.', ['WP_SW']) +

    '<h2 id="fg-tight">Tightening methods</h2>' +
    fgP('<b>Torque is a stand-in.</b> What the joint needs is clamp load. Torque only stands in for it, and friction makes the result scatter: two bolts at the same torque do not carry the same load.', ['BSCI_TM', 'AC_ANG']) +
    fgP('<b>Torque plus angle.</b> Snug the bolt to a low torque, then turn it on by a set angle; the example given is 30 Nm, then 90 degrees. Bolt Science describes the angle taking the bolt past its elastic range, which leaves only a small variation in preload.', ['BSCI_TM', 'AC_ANG']) +
    fgP('<b>Tightening to yield.</b> The bolt is tightened until it just begins to yield, to get the most clamp load from it. A controller watches how the torque climbs with the angle and stops when the slope changes.', ['BSCI_TM', 'AC_ANG']) +
    fgP('<b>Where the torque goes.</b> Usually 85 to 95 % of it is used up by friction.', ['BSCI_TM']) +
    fgP('<b>Torque control</b> is the usual method. The torque is commonly worked out for a direct stress in the thread of 75 % of the yield stress of the bolt. Give the torque with a tolerance: plus or minus 5 % is good practice.', ['BSCI_TM']) +
    fgP('<b>Angle within the elastic range.</b> There a given angle means a given stretch of the bolt.', ['AC_ANG']) +
    fgP('<b>Watching the angle</b> also catches faults: a missing washer or a seized or damaged thread shows up as the wrong angle for the torque.', ['AC_ANG']) +
    fgP('<b>Hydraulic tensioning.</b> A hydraulic puller stretches the bolt, the nut is run down and the pressure is let off. The pressure sets the preload; a little is lost when the pressure is released.', ['BSCI_TM']) +
    fgP('<b>Heat.</b> The bolt is heated, the nut turned through a set angle, and the preload comes as the bolt cools and shrinks.', ['BSCI_TM']) +
    fgP('<b>Load-indicating washers</b> have small raised pips that flatten under load. The preload is right when a set gap is left under the head.', ['BSCI_TM']) +
    '<p class="desc">Neither source prints the scatter of each method in per cent, so none is given here.</p>' +
    fgP('Torque from preload with your own friction values is in <a href="#/t/bolttorque">bolt torque and preload</a>.', null) +

    '<h2 id="fg-set">Set screws</h2>' + fgPoints() +
    fgP('<b>What it is.</b> A set screw has no head and is threaded for its whole length (a grub screw). It is screwed through one part and holds a second part with its point.', ['WP_SS', 'BOLTS_SS']) +
    guideTable(['Point', 'What it does', 'Use'], FG_SET, fgTags) +
    fgP('<b>Hard or soft.</b> Cup, knurled cup and cone points suit harder materials, oval and flat points softer ones.', ['TAM_SS']) +
    fgP('<b>A flat on the shaft,</b> milled or ground where the point lands, keeps the screw from slipping and raises the load it holds. Line the flat up with the hole before tightening.', ['WP_SS']) +
    fgP('<b>Marks.</b> A hardened point raises a ring in the shaft. The ring adds to the hold but makes the part hard to pull off; a flat avoids that.', ['WP_SS']) +
    fgP('<b>Not for high torque.</b> A small set screw without a flat can slip and gall. Where much torque has to be carried, use a key or splines.', ['WP_SS']) +
    fgP('Key sizes are under <a href="#/t/spanner">spanner and hex key sizes</a>.', null) +

    '<h2 id="fg-head">Heads and drives</h2>' +
    guideTable(['Head', 'Shape', 'Chosen for'], FG_HEAD, fgTags) +
    guideTable(['Drive', 'For', 'Against'], FG_DRIVE, fgTags) +
    '<p class="desc">The sources read give no countersink angles and no head dimensions. Cap screw heads are under socket head cap screws.</p>' +
    fgP('See <a href="#/t/shcs">socket head cap screws</a> and <a href="#/t/clearance">clearance holes</a>.', null) +

    '<h2 id="fg-tap">Self-tapping screws</h2>' +
    fgP('<b>What they are.</b> A tapping screw makes its own thread in a plain hole. It needs no nut and can be put in from one side.', ['MD_TS', 'ESS_TS']) +
    fgP('<b>Thread-forming</b> screws push the material aside. Nothing is cut away, and the thread fits without clearance.', ['MD_TS', 'ESS_TS']) +
    fgP('That tight fit resists loosening, usually without a lock washer, but the screw takes more torque to drive.', ['MD_TS']) +
    fgP('<b>Thread-cutting</b> screws have cutting edges and a slot or flute that takes the chips.', ['MD_TS', 'SB_TS']) +
    fgP('They drive with less torque and suit materials that should not be stressed.', ['MD_TS']) +
    fgP('<b>The hole matters.</b> Too large, and the screw is loose and strips the thread. Too small, and the screw may break.', ['ESS_TS']) +
    guideTable(['Screw', 'Point and thread', 'Use'], FG_TYPE, fgTags) +
    fgP('<b>Material.</b> Tapping screws are usually case hardened, with a tensile strength of at least 100 000 psi.', ['MD_TS']) +
    '<p class="desc">Pilot hole sizes are not listed here yet: they differ from maker to maker.</p>' +

    '<h2 id="fg-pin">Pins</h2>' + fgPins() +
    fgP('<b>Shear.</b> Pins are loaded mainly in shear. Keep the plane of shear at least one pin diameter from the end of the pin.', ['MD_PIN']) +
    guideTable(['Pin', 'How it holds', 'Notes'], FG_PIN, fgTags) +
    fgP('Taper pin sizes are under <a href="#/t/taperpin">taper pins</a>.', null) +

    '<h2 id="fg-ring">Retaining rings</h2>' +
    fgP('<b>What it is.</b> A retaining ring holds a part on a shaft (an external ring) or in a bore (an internal ring). Most sit in a groove and form a shoulder.', ['WP_RR', 'RC']) +
    guideTable(['Ring', 'Fitting', 'Notes'], FG_RING, fgTags) +
    fgP('<b>Standards.</b> ASME B18.27, DIN 471 and DIN 472.', ['WP_RR']) +
    '<p class="desc">Groove dimensions are not listed here yet.</p>' +

    '<h2 id="fg-cb">Counterbore, spotface and countersink</h2>' +
    fgP('<b>Counterbore.</b> A larger hole with a flat bottom on the same centre as a smaller one, deep enough to take the head of a screw below the surface.', ['XO_CB', 'MG_CB', 'FIC_CB']) +
    fgP('<b>Spotface.</b> A very shallow counterbore: only deep enough to give the head or the washer a flat seat, on the rough skin of a casting for example.', ['XO_CB', 'MG_CB', 'FIC_CB']) +
    fgP('<b>Countersink.</b> A conical seat for a screw with a tapered head. Machinist Guides lists 82°, 90° and 100° as the angles.', ['MG_CB', 'FIC_CB']) +
    fgP('<b>On the drawing.</b> The counterbore symbol ⌴ with the diameter and the depth. Older prints write CBORE.', ['XO_CB', 'MG_CB', 'FIC_CB']) +
    fgP('A spotface has no symbol of its own: it is the counterbore symbol with SF in it.', ['XO_CB']) +
    fgP('<b>Making one.</b> Drill the smaller hole first, then cut the counterbore on the same centre.', ['XO_CB', 'FIC_CB']) +
    fgP('The flat bottom needs a tool with a flat end, not a drill point.', ['XO_CB']) +
    fgP('<b>Size.</b> The diameter is that of the head plus clearance, the depth the height of the head plus any washer.', ['FIC_CB']) +
    fgP('Counterbore sizes for socket head cap screws are in <a href="#/t/shcs">socket head cap screws</a>.', null) +

    '<h2 id="fg-fake">Counterfeit fasteners</h2>' +
    fgP('<b>Suspect and counterfeit.</b> A suspect item is one that may not meet the specification it is sold to. A counterfeit is a copy or substitute passed off without the right to do so.', ['LBL_SCI']) +
    fgP('<b>Two marks on the head.</b> A graded bolt carries the mark of its grade and the mark of its maker. Check both.', ['MB_CB', 'NIST_FQA']) +
    fgP('<b>Other signs.</b> A poor finish, marks that are wrong, papers that do not match the goods. A counterfeit can still look right to an untrained eye.', ['MB_CB']) +
    fgP('<b>Proof is a test.</b> Hardness and tensile tests, and analysis of the steel. Under the US law the tests behind a grade mark are done by an accredited laboratory.', ['MB_CB', 'NIST_FQA']) +
    fgP('<b>Papers.</b> Ask for the certificate of the lot. The US law has the maker keep, for five years, a record with the lot number, the standard, the chemistry and grade of the material and the test results.', ['NIST_FQA', 'MB_CB']) +
    fgP('<b>The US law.</b> The Fastener Quality Act of 1990 followed fastener failures in the 1980s. A fastener must meet the specification it is sold to.', ['NIST_FQA', 'EASA_CB']) +
    fgP('It covers metal bolts, nuts, screws and studs of 6 mm (1/4 in) and larger, with many exemptions.', ['NIST_FQA']) +
    fgP('<b>Buying.</b> Write the standard and the grade in the order, buy where the lot can be traced, and look at the goods when they arrive.', ['LBL_SCI', 'MB_CB']) +
    fgP('Grade marks and what each grade must reach are in <a href="#/t/boltgrade">bolt grades and property classes</a>.', null) +

    '<h2 id="fg-brit">British fasteners</h2>' +
    fgP('<b>Whitworth.</b> Joseph Whitworth put forward his thread in 1841. It has an angle of 55 degrees, with rounded crests and roots.', ['EH_BR', 'WP_BSW']) +
    fgP('<b>BSW and BSF.</b> British Standard Whitworth is the coarse series. British Standard Fine has the same form with a finer pitch.', ['EH_BR', 'WP_BSW']) +
    fgP('<b>BA.</b> The British Association thread is for small screws, 6 mm and below. It is based on metric sizes and has an angle of 47.5 degrees.', ['EH_BR', 'WP_BSW']) +
    fgP('The largest is 0 BA, 6 mm in diameter with a pitch of 1.0 mm. The numbers rise as the screws get smaller, down to 16 BA, and each pitch is 0.9 times the one before.', ['EH_BR']) +
    fgP('<b>BSP</b> is the British pipe thread. Wikipedia: it has the Whitworth form and is named by the bore of the pipe. White: it is not interchangeable with NPT.', ['EH_BR', 'WP_BSW']) +
    fgP('<b>Cycle thread.</b> BSC has an angle of 60 degrees and very fine pitches, and was used on British bicycles and motorcycles.', ['WP_BSW']) +
    fgP('<b>Spanners.</b> A Whitworth or BSF spanner is marked with the diameter of the bolt, not with the width across the flats of the head.', ['EH_BR', 'WP_BSW']) +
    fgP('<b>Two markings.</b> The hexagons were later made one size smaller (White: in the early twentieth century; Wikipedia: formalised in 1929 and taken up widely in the Second World War to save metal). That is why one spanner can carry two sizes: 1/4 W with 5/16 BSF in White, 3/8 W with 7/16 BSF in Wikipedia.', ['EH_BR', 'WP_BSW']) +
    fgP('<b>Not Unified.</b> Unified threads have an angle of 60 degrees. Several BSW and UNC sizes share their threads per inch, but 1/2 in is 12 to the inch in BSW and 13 in UNC. Do not mix them.', ['EH_BR', 'WP_BSW']) +
    fgP('The Unified thread was agreed between the United States, Britain and Canada after the Second World War.', ['EH_BR']) +
    fgP('Thread sizes are under <a href="#/t/whitworth">Whitworth and BA threads</a> and <a href="#/t/pipethreads">pipe threads (BSP and NPT)</a>.', null) +

    '<h2 id="fg-src">Sources</h2><ul class="gsl">' + Object.entries(FG_SOURCES).map(([k, v]) => '<li><b>' + k + '</b> ' + gesc(v) + '</li>').join('') + '</ul>' +
    '<p class="desc">Full URLs and access dates are in docs/sources.md, "Fasteners guide". No text, figures or tables were copied from the sources.</p>';
  guideToc(el);
}
