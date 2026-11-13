// Thread forms and terms guide (parity MH218, BB6, BB7).
// All wording and drawings are BenchMate's own. Every statement carries the keys of the public sources read for
// it (docs/sources.md, "Thread forms and terms guide"); one with fewer than two independent publishers is shown
// as "to be verified". Where a statement joins two sources, each part names its source.
'use strict';

const TF_SOURCES = {
  WP_ST: 'Wikipedia, "Screw thread" (CC BY-SA)',
  WP_TA: 'Wikipedia, "Thread angle" (CC BY-SA)',
  WP_TR: 'Wikipedia, "Trapezoidal thread form" (CC BY-SA)',
  WP_SQ: 'Wikipedia, "Square thread form" (CC BY-SA)',
  WP_BUT: 'Wikipedia, "Buttress thread" (CC BY-SA)',
  WP_KN: 'Wikipedia, "Knuckle thread" (CC BY-SA)',
  WP_UTS: 'Wikipedia, "Unified Thread Standard" (CC BY-SA)',
  KEL: 'Kelston Actuation, knowledge base, "Screw thread terms" (no author or date shown)',
  TEP: 'The Engineers Post, Saif M., "Types of screw threads and screw thread terminology", 2018-07-31, updated 2023-09-27',
  EE_DES: 'Engineers Edge, "ANSI screw thread designations and symbols A - N" (only the rows that came through clean)',
  AFT_AB: 'AFT Fasteners, "Common fastener related abbreviations"',
  EH_BR: 'Aircraft Engine Historical Society, G. White, "British fastening systems"',
};
// The seven Wikipedia articles count as one publisher.
const TF_FAMILY = { WP_ST: 'WIKI', WP_TA: 'WIKI', WP_TR: 'WIKI', WP_SQ: 'WIKI', WP_BUT: 'WIKI', WP_KN: 'WIKI', WP_UTS: 'WIKI' };
const tfTags = keys => guideTags(keys, TF_SOURCES, TF_FAMILY);
const tfP = (html, keys) => '<p>' + html + (keys === null ? '' : ' ' + tfTags(keys)) + '</p>';

// The parts of an external thread, shown on a 60 degree V profile with flat crests and roots. Not to scale.
function tfTerms() {
  // One pitch is 60 px: crest flat 8, flank 22 across and 38 down, root flat 8, flank 22 across and 38 up.
  const tooth = 'l8 0l22 38l8 0l22 -38';
  return cnSvg(420, 214,
    '<path class="gfill" d="M30 70' + tooth.repeat(5) + 'l8 0V176H30Z"/>' +
    '<path class="gp" fill="none" d="M30 70' + tooth.repeat(5) + 'l8 0"/>' +
    '<path class="gk" d="M22 89H346"/>' +
    '<path class="gm" stroke-dasharray="8 3 2 3" d="M14 176H406"/>' +
    '<path class="gc" d="M34 52H94M34 47V57M94 47V57"/>' +
    '<path class="gc" d="M356 89V176M351 89H361M376 70V176M371 70H381M396 108V176M391 108H401M351 176H361M371 176H381M391 176H401"/>' +
    '<path class="gm" stroke-dasharray="3 3" d="M338 70H376M346 89H356M308 108H396"/>' +
    '<path class="gm" d="M214 68V42M184 110V130M289 89L314 50"/>' +
    '<path class="gc" fill="none" d="M106 84A22 22 0 0 0 142 84"/>' +
    cnT(64, 44, 'pitch', 'gs', 'middle') + cnT(214, 36, 'crest', 'gs', 'middle') + cnT(184, 142, 'root', 'gs', 'middle') + cnT(318, 46, 'flank', 'gs') +
    cnT(124, 62, 'thread angle', 'gs', 'middle') + cnT(20, 170, 'axis', 'gs') +
    cnT(356, 192, 'P', 'gv', 'middle') + cnT(376, 192, 'M', 'gv', 'middle') + cnT(396, 192, 'm', 'gv', 'middle') +
    cnT(20, 208, 'half of the major (M), pitch (P) and minor (m) diameters', 'gs'),
    'A screw thread in section along its axis: pitch from crest to crest, crest, root and flank, the thread angle between two flanks, and half of the major, pitch and minor diameters measured from the axis');
}
// Six thread forms side by side, two teeth each. Shapes only, not to scale.
function tfForms() {
  const cell = (x, y, d, name, ang) => '<path class="gfill" d="M' + x + ' ' + (y + 44) + d + 'V' + (y + 58) + 'H' + x + 'Z"/><path class="gp" fill="none" d="M' + x + ' ' + (y + 44) + d + '"/>' +
    cnT(x + 55, y + 76, name, 'gv', 'middle') + cnT(x + 55, y + 90, ang, 'gs', 'middle');
  const two = t => t + t;
  return cnSvg(420, 216,
    cell(20, 0, two('l5 0l20 -34l5 0l20 34') + 'l10 0', 'V', '60°') +
    cell(155, 0, two('q5 0 8 -6l12 -22q5 -8 10 0l12 22q3 6 8 6') + 'l10 0', 'Whitworth', '55°, rounded') +
    cell(290, 0, two('l8 0l7 -28l20 0l7 28l8 0') + 'l10 0', 'ACME, trapezoidal', '29°, 30°') +
    cell(20, 108, two('l12 0l0 -28l25 0l0 28l13 0') + 'l10 0', 'Square', 'no angle') +
    cell(155, 108, two('l6 0l3 -30l8 0l28 30l5 0') + 'l10 0', 'Buttress', 'up to 7° and 45°') +
    cell(290, 108, two('q12 0 16 -15q9 -24 18 0q4 15 16 15') + 'l10 0', 'Knuckle (round)', '30°, rounded'),
    'Six thread forms in section: V with a 60 degree angle, Whitworth with rounded crests and roots, ACME and trapezoidal with flat crests, square, buttress with one steep and one sloping flank, and knuckle with fully rounded crests and roots');
}

const TF_FORM = [
  ['V (ISO metric, Unified)', '60°', 'A triangle with the tips cut off. The thread of most fasteners.', ['WP_ST', 'TEP']],
  ['Whitworth (BSW, BSF)', '55°', 'Rounded crests and roots. British fasteners.', ['WP_ST', 'EH_BR']],
  ['British Association (BA)', '47.5°', 'See the Whitworth and BA page.', ['WP_TA', 'EH_BR']],
  ['Pipe threads', 'NPT 60°, British Standard pipe 55°', 'See the pipe thread page.', ['WP_TA']],
  ['ACME', '29°', 'Leadscrews and other power screws; works with a split nut. Wikipedia: flat crests and roots, a basic height of half the pitch, and the split nut can take up wear.', ['WP_TR', 'TEP']],
  ['Stub ACME', '29°', 'As ACME, with a basic height of 0.3 of the pitch.', ['WP_TR']],
  ['Metric trapezoidal (Tr)', '30°', 'Like ACME with a 30° angle (DIN 103).', ['WP_TR']],
  ['Square', 'Flanks square to the axis', 'The least friction of all forms: power screws, presses, jacks. Slow and dear to cut. Wikipedia: wear of the nut cannot be taken up. Engineers Post: depth and thickness are each half the pitch.', ['WP_SQ', 'TEP']],
  ['Buttress', 'Load flank square to the axis or up to 7° off; the other flank often 45°', 'Takes thrust in one direction: vices, breech screws, leadscrews loaded one way.', ['WP_BUT']],
  ['Knuckle (round, Rd)', '30° (DIN 405)', 'Fully rounded crests and roots, so dirt can move out of the way.', ['WP_KN']],
];
const TF_ABBR = [
  ['UNC', 'Unified coarse', ['WP_UTS', 'AFT_AB']],
  ['UNF', 'Unified fine', ['WP_UTS', 'AFT_AB']],
  ['UNEF', 'Unified extra fine', ['WP_UTS']],
  ['UNS', 'Unified special: a diameter and pitch outside the standard series', ['WP_UTS']],
  ['UNR', 'AFT Fasteners: Unified with a rounded root. Wikipedia: external threads only.', ['AFT_AB', 'WP_UTS']],
  ['NC', 'National coarse (Engineers Edge: American National coarse thread series)', ['EE_DES', 'AFT_AB']],
  ['NF', 'National fine', ['AFT_AB']],
  ['NPT', 'American taper pipe thread', ['EE_DES', 'AFT_AB']],
  ['NPTF', 'Dryseal taper pipe thread', ['EE_DES']],
  ['NPSC', 'Straight pipe thread in couplings', ['EE_DES']],
  ['NPSM', 'Straight pipe thread for mechanical joints', ['EE_DES']],
  ['NGT', 'National gas taper thread', ['EE_DES']],
  ['ACME-G, ACME-C', 'ACME general purpose and ACME centralizing', ['EE_DES', 'WP_TR']],
  ['BSW', 'British Standard Whitworth', ['AFT_AB', 'WP_ST']],
  ['BSF', 'British Standard Fine', ['AFT_AB', 'WP_ST']],
  ['BA', 'British Association', ['WP_TA']],
  ['M', 'Metric V thread, 60°', ['WP_TA']],
  ['Tr', 'Metric trapezoidal', ['WP_TR']],
  ['Rd', 'Knuckle (round) thread', ['WP_KN']],
  ['G', 'British Standard pipe thread, 55°', ['WP_TA']],
  ['Pg', 'Steel conduit thread (Panzergewinde), 80°', ['WP_TA']],
  ['TPI', 'Threads per inch', ['AFT_AB', 'WP_UTS']],
  ['LH, RH', 'Left-hand and right-hand thread', ['AFT_AB', 'WP_ST']],
  ['ET, IT', 'External and internal thread', ['AFT_AB']],
];

function renderThreadGuide(el) {
  const toc = [['tf-term', 'The parts of a thread'], ['tf-lead', 'Pitch, lead and hand'], ['tf-form', 'Thread forms'], ['tf-kind', 'Coarse, fine, straight, tapered'], ['tf-abbr', 'Abbreviations']];
  el.innerHTML =
    '<nav class="gtoc">' + toc.map(([a, t]) => '<a href="#' + a + '">' + t + '</a>').join('') + '</nav>' +
    '<p class="desc">Screw threads in general, in our own words: what the parts of a thread are called, pitch and lead, the common thread forms and what each is for, and the abbreviations found on drawings, taps and gauges. The small grey keys after each statement name the public sources it was checked against (list at the bottom). <span class="gtbv">to be verified</span> marks a statement not yet confirmed by two independent publishers; the seven Wikipedia articles count as one. Sizes and limits are on the pages of each thread, linked below.</p>' +

    '<h2 id="tf-term">The parts of a thread</h2>' + tfTerms() +
    tfP('<b>Major diameter.</b> The largest diameter of the thread: over the crests of a screw, at the roots of a nut.', ['WP_ST', 'KEL']) +
    tfP('<b>Minor diameter.</b> The smallest diameter: at the roots of a screw, the bore of a nut.', ['WP_ST', 'KEL']) +
    tfP('<b>Pitch diameter.</b> The diameter of an imaginary cylinder on which the thread is as wide as the space beside it, each half the pitch.', ['WP_ST', 'KEL']) +
    tfP('On a sharp V it lies midway between the major and minor diameters.', ['KEL']) +
    tfP('<b>Pitch.</b> The distance along the axis from a point on one thread to the same point on the next.', ['WP_ST', 'KEL']) +
    tfP('<b>Crest and root.</b> The crest is the top surface of a thread, the root the bottom of the groove.', ['KEL', 'TEP']) +
    tfP('<b>Flank.</b> The surface between crest and root. It is the flank that bears on the mating thread.', ['TEP']) +
    tfP('<b>Thread angle.</b> The angle between the two flanks, measured in a plane through the axis.', ['WP_TA', 'KEL']) +
    tfP('<b>Depth of thread.</b> From crest to root, measured square to the axis: half the difference between the major and minor diameters.', ['WP_ST', 'TEP']) +
    tfP('A sharp 60° V is 0.866 of the pitch deep; a full ISO metric or Unified thread is about 0.65 of the pitch deep.', ['WP_ST']) +
    tfP('Sizes and limits are under <a href="#/t/threaddata">thread data and limits</a>; measuring the pitch diameter is under <a href="#/t/wires">thread measurement over wires</a>; an unknown thread can be named with the <a href="#/t/threadid">thread identifier</a>.', null) +

    '<h2 id="tf-lead">Pitch, lead and hand</h2>' +
    tfP('<b>Lead.</b> The distance the nut moves along the screw in one full turn.', ['WP_ST', 'KEL', 'TEP']) +
    tfP('On a single-start thread the lead equals the pitch.', ['WP_ST', 'TEP']) +
    tfP('<b>Starts.</b> With more than one start, lead = pitch × number of starts.', ['WP_ST']) +
    tfP('Multi-start threads are used where the screw must travel fast and does not have to hold its place by friction.', ['KEL']) +
    tfP('<b>Hand.</b> A right-hand thread tightens clockwise and is the normal one. Left-hand threads are used where the rotation would loosen a right-hand one (the left pedal of a bicycle, the left wheel of a bench grinder), in turnbuckles, and on fuel gas fittings so that they cannot be connected wrongly.', ['WP_ST']) +
    tfP('See <a href="#/t/multistart">multi-start thread lead and pitch</a>.', null) +

    '<h2 id="tf-form">Thread forms</h2>' + tfForms() +
    guideTable(['Form', 'Thread angle', 'Shape and use'], TF_FORM, tfTags) +
    tfP('<b>ACME against square.</b> An ACME thread is easier to cut than a square thread and stronger at the root.', ['WP_TR', 'TEP']) +
    tfP('The price is more friction, and some load on the nut that pushes it outwards.', ['WP_TR']) +
    tfP('<b>How a trapezoidal thread is written.</b> Tr 60×9 is 60 mm in diameter with a 9 mm pitch and one start. Tr 60×18(P9)LH has a lead of 18 mm and a pitch of 9 mm, so two starts, and is left-hand.', ['WP_TR']) +
    tfP('<b>How a knuckle thread is written.</b> Rd, the diameter and the pitch: Rd 20 × 1/8".', ['WP_KN']) +
    tfP('Sizes: <a href="#/t/whitworth">Whitworth and BA</a>, <a href="#/t/pipethreads">pipe threads</a>, <a href="#/t/acme">ACME and Stub ACME</a>, <a href="#/t/trapezoidal">metric trapezoidal</a>, <a href="#/t/buttress">buttress</a>.', null) +

    '<h2 id="tf-kind">Coarse, fine, straight, tapered</h2>' +
    tfP('<b>Coarse and fine</b> say only how large the pitch is, nothing about quality. Coarse threads resist stripping and cross-threading and go together faster. Fine threads leave a larger core, resist loosening and adjust more finely.', ['WP_ST']) +
    tfP('<b>Straight and tapered.</b> A straight thread lies on a cylinder, a tapered thread on a cone. Tapered threads are used on pipes, where tightening makes the seal.', ['WP_ST']) +
    tfP('<b>Classes of Unified threads.</b> The letter A marks an external thread and B an internal one. Class 2 is the most common.', ['WP_UTS']) +
    tfP('AFT Fasteners lists 2A and 3A, 2B and 3B as the classes of fit of inch screws and nuts, and 6g and 6H as those of metric screws and nuts.', ['AFT_AB']) +
    tfP('<b>How a Unified thread is written.</b> Diameter, threads per inch, series and class: #6-32 UNC 2B.', ['WP_UTS']) +
    tfP('See <a href="#/t/unseries">constant-pitch UN series and UNS</a> and <a href="#/t/unjunr">UNJ and UNR threads</a>. Engagement and locking are in the <a href="#/t/fastguide">fasteners guide</a>.', null) +

    '<h2 id="tf-abbr">Abbreviations</h2>' +
    guideTable(['Symbol', 'Meaning'], TF_ABBR, tfTags) +

    '<h2 id="tf-src">Sources</h2><ul class="gsl">' + Object.entries(TF_SOURCES).map(([k, v]) => '<li><b>' + k + '</b> ' + gesc(v) + '</li>').join('') + '</ul>' +
    '<p class="desc">Full URLs and access dates are in docs/sources.md, "Thread forms and terms guide". No text, figures or tables were copied from the sources. The two drawings are BenchMate\'s own and are not to scale.</p>';
  guideToc(el);
}
