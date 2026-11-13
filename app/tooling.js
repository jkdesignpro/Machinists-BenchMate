// Tooling reference (parity B3): the tooling guide, tap pitch diameter limits
// (H, L, D numbers) and the forming tap makers' comparison used by the Tap
// drill size tool. All wording and drawings are BenchMate's own. Values come
// from data/refdata/tooling-evidence.json through REF.tooling (built by
// scripts/build_refdata.py); arithmetic is done by the Rust core (state.W).
// A statement with fewer than two independent public sources is flagged
// "needs 2nd source". Keys marked OWN are BenchMate's own geometry.
'use strict';

// Sources not in the tooling evidence file (already used by the CNC guide).
const TG_EXTRA = {
  MMC: { publisher: 'Mitsubishi Materials', title: 'Causes of tool damage, course 78 (mmc-carbide.com); used in the CNC guide' },
  SECO: { publisher: 'Seco Tools', title: 'Tool wear patterns: how to recognize and to optimize them (secotools.com/article/122073); used in the CNC guide' },
  OWN: { publisher: 'BenchMate', title: 'Own derivation (geometry), with tests in core/src/tooling.rs' },
};
// USCTI's tapping tips are GWS Tool Group's text: one publisher family.
const TG_FAMILY = { USCTI: 'GWS', GWS: 'GWS', MSC_TM: 'MSC' };
let TG_SRC = TG_EXTRA;
function tgTags(keys) {
  const ks = keys || [];
  const pubs = new Set(ks.filter(k => k !== 'OWN').map(k => TG_FAMILY[k] || k));
  const ok = pubs.size >= 2 || (ks.includes('OWN') && pubs.size === 0);
  return ks.map(k => '<abbr class="gsrc" title="' + rEsc(((TG_SRC[k] || {}).publisher || k) + ': ' + ((TG_SRC[k] || {}).title || '')) + '">' + k + '</abbr>').join('') +
    (ok ? '' : '<span class="gtbv" title="Not yet confirmed by two independent public sources">needs 2nd source</span>');
}
const tp = (html, keys) => '<p>' + html + ' ' + tgTags(keys) + '</p>';
const tgLink = (id, text) => '<button class="btn tglink" data-id="' + id + '">' + rEsc(text) + '</button>';
function tgWireLinks(el) {
  el.querySelectorAll('.tglink').forEach(b => b.onclick = () => {
    openTool(b.dataset.id);
  });
}
// Every group a publisher prints, never only the top one.
function tgGroups(srcs, c, unit) {
  if (!c) return '-';
  return c.groups.map((g, i) => (i ? '<span class="warn">' : '<b>') + rEsc(g.value) + (unit || '') + (i ? '</span>' : '</b>') + ' <span class="ms">(' + g.publishers.map(p => rEsc(pubName(srcs, p))).join(', ') + ')</span>').join('<br>');
}

// ---------- Drawings (own, schematic) ----------
const tgSvg = (w, h, body, label) => '<svg class="geo cng" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + label + '">' + body + '</svg>';
const tgT = (x, y, t, a) => '<text class="gs" x="' + x + '" y="' + y + '"' + (a ? ' text-anchor="' + a + '"' : '') + '>' + t + '</text>';
function tgWedge() {
  // Section through a cutting edge: tool wedge, chip, work; rake and clearance angles.
  return tgSvg(440, 230,
    '<path class="gfill" d="M40 150H420V210H40Z"/><path class="gp" d="M40 150H420"/>' + // work
    '<path class="gm" d="M200 150L170 40H300L230 140Z"/>' + // tool wedge, tip at (200,150)
    '<path class="gp" d="M200 150L170 40M200 150L230 140"/>' +
    '<path class="gc" d="M200 150L120 60L150 50L196 132"/>' + // chip
    '<path class="gk" d="M200 150V40M200 150H300"/>' +
    '<path class="gp" d="M200 70A80 80 0 0 0 178 73"/>' + tgT(206, 66, 'rake angle (from the vertical)') +
    '<path class="gp" d="M262 150A62 62 0 0 0 259 131"/>' + tgT(268, 132, 'clearance angle') +
    tgT(110, 52, 'chip', 'end') + tgT(60, 196, 'work: cut moves the work to the left under the edge') + tgT(250, 30, 'tool') +
    tgT(222, 152, 'edge'),
    'Section through a cutting edge with rake and clearance angles');
}
function tgLead() {
  // Turning: entering angle (ISO) and lead angle (ANSI) of the same edge.
  return tgSvg(440, 200,
    '<path class="gfill" d="M20 120H300V180H20Z"/><path class="gp" d="M20 120H300"/>' +
    '<path class="gm" d="M300 120L340 40L420 40L420 120Z"/><path class="gp" d="M300 120L340 40"/>' +
    '<path class="gk" d="M300 120H430M300 120V20"/>' +
    '<path class="gp" d="M360 120A60 60 0 0 0 327 66"/>' + tgT(366, 112, 'entering angle (ISO)') +
    '<path class="gp" d="M300 70A50 50 0 0 1 322 75"/>' + tgT(306, 60, 'lead angle (ANSI)') +
    tgT(40, 112, 'feed direction: along the work axis, toward the chuck at the left') + tgT(30, 170, 'work'),
    'Entering angle and lead angle of a turning tool');
}

// ---------- Tooling guide ----------
async function renderToolGuide(el) {
  const R = await loadRef(el); if (!R) return;
  const T = R.tooling; if (!T) { el.textContent = 'Tooling data not built.'; return; }
  TG_SRC = Object.assign({}, TG_EXTRA, T.sources);
  const S = T.sources;
  const toc = [['t-geo', 'Tool geometry'], ['t-mat', 'Tool materials'], ['t-coat', 'Coatings'], ['t-em', 'End mills'], ['t-dr', 'Drills'], ['t-rm', 'Reamers'], ['t-tap', 'Taps'],
    ['t-lim', 'Tap limits'], ['t-tm', 'Thread mills'], ['t-saw', 'Saw blades'], ['t-brk', 'Broken taps'], ['t-src', 'Sources']];
  const coatRows = [
    ['TiN', 'Titanium nitride. Gold. The general purpose coating for HSS and carbide drills, taps and end mills.', ['HARTNER', 'GWS']],
    ['TiCN', 'Titanium carbonitride. Harder than TiN, for edges under high mechanical load or impact, such as taps and interrupted cuts; lower heat limit.', ['HARTNER', 'PRODINC']],
    ['TiAlN', 'Titanium aluminium nitride. Forms an aluminium oxide skin when hot, so it suits high speed and dry or near-dry cutting of steels and cast iron.', ['HARTNER', 'PRODINC']],
    ['AlTiN', 'Aluminium-rich TiAlN. More heat and oxidation resistance; hardened steel, stainless, titanium and nickel alloys, high speed. Not for aluminium (aluminium in the coating sticks to aluminium work).', ['HARTNER', 'PRODINC']],
    ['AlCrN', 'Aluminium chromium nitride. For very hot cutting: steels, hardened steels, gear cutting.', ['BALZERS', 'PRODINC']],
    ['DLC', 'Diamond-like carbon (amorphous carbon). Low friction against aluminium and other non-ferrous metals, against built-up edge.', ['HARTNER', 'PRODINC']],
    ['Diamond', 'CVD diamond film on carbide. Graphite, fibre-reinforced plastics and high-silicon aluminium. Never for steel or cast iron: carbon dissolves into iron when hot.', ['HARTNER', 'BALZERS']],
    ['ZrN', 'Zirconium nitride. Pale gold. Aluminium and other non-ferrous metals.', ['HARTNER', 'PRODINC']],
    ['CrN', 'Chromium nitride. Silver grey. Non-ferrous metals, and forming and moulding tools.', ['BRYCOAT', 'IJS']],
    ['CVD Al2O3', 'Aluminium oxide, applied by chemical vapour deposition, usually in a thick multilayer with TiCN on turning and milling inserts. It shields the carbide from heat and resists crater wear in steel and cast iron. No maximum temperature is given here: the sources compared print none.', ['MMC', 'SECO']],
  ];
  el.innerHTML =
    '<nav class="gtoc">' + toc.map(([a, t]) => '<a href="#' + a + '">' + t + '</a>').join('') + '</nav>' +
    '<p class="desc">Written for BenchMate in our own words, with our own drawings. Each statement shows the keys of the public sources that support it (hover a key). A statement with fewer than two independent sources is marked <span class="gtbv">needs 2nd source</span>; numbers where sources disagree are shown with every value and who prints it. Your tool maker\'s data for the tool in your hand always wins.</p>' +

    '<h2 id="t-geo">Tool geometry terms</h2>' + tgWedge() + tgLead() +
    tp('<b>Rake angle</b> is the tilt of the face the chip slides over, measured from a line square to the cut. Positive rake (face leaning away from the chip) cuts with less force and heat but gives a weaker edge; negative rake gives a strong edge for hard or interrupted cuts and needs a stiffer machine.', []) +
    tp('<b>Clearance (relief) angle</b> is the gap between the face below the edge (the flank) and the cut surface, so that only the edge touches. Too little and the flank rubs; too much and the edge is weak. Negative inserts (clearance letter N in the insert code) get their clearance from tilting the insert in the holder.', []) +
    tp('<b>Entering angle and lead angle.</b> ISO gives the angle between the cutting edge and the feed direction (entering angle, κr); North American catalogues give the angle from the square-shoulder position (lead angle). The two add up to 90°: a 95° entering angle is a −5° lead, 45° is 45°. With feed f, the chip is f sin κr thick, so a smaller entering angle (larger lead) thins the chip and spreads the load along a longer edge, but pushes harder radially.', ['OWN']) +
    tp('<b>Helix angle</b> (end mills, drills, taps) is the angle of the flute to the tool axis. A high helix lifts chips well and cuts smoothly, which suits aluminium and plastics; a low helix gives a stronger edge and less pull-out force.', ['PRODINC']) +
    tp('<b>Nose (corner) radius</b>: a larger radius gives a stronger corner and, at the same feed, a better finish, but more radial force and chatter. See the ' + tgLink('finish', 'Surface finish from nose radius') + ' tool.', []) +
    tp('<b>Chip breaker</b>: a groove or bumps pressed into the rake face that curl and break the chip. Each breaker works in a range of feed and depth; makers print that range for each one. The letters after the ISO code are the maker\'s breaker (see ' + tgLink('insertcode', 'Insert designation') + ').', []) +
    tp('<b>Edge preparation (hone)</b>: a small radius or chamfer (land) ground or brushed on the edge. A sharp edge cuts with the least force for finishing and sticky materials; a honed or chamfered edge resists chipping in steel, cast iron and interrupted cuts. The insert code letter for the edge condition (F sharp, E rounded, T chamfered, S both) is in the insert designation tool.', []) +

    '<h2 id="t-mat">Tool materials, substrates and grades</h2>' +
    tp('<b>HSS and cobalt HSS</b> are tough and cheap, can be ground sharp, and are used for taps, drills, reamers and form tools, at lower speeds. <b>Cemented carbide</b> is hard tungsten carbide grains held in a cobalt binder; less cobalt and finer grains make it harder and more wear resistant, more cobalt makes it tougher. <b>Cermet</b> (titanium carbonitride based) gives good finish in steel at high speed. <b>Ceramics</b> (alumina, silicon nitride, whisker reinforced) run very fast in cast iron and nickel alloys. <b>CBN</b> cuts hardened steel and cast iron; <b>PCD</b> cuts aluminium, copper, composites and wood, never steel.', []) +
    tp('<b>Grades and groups.</b> A maker\'s grade is a substrate plus coating tuned for a work material. ISO 513 sorts them into the P, M, K, N, S and H groups with a number for the application range: see ' + tgLink('iso513', 'Cutting material groups (ISO 513)') + '. Grade names are not comparable across makers by number alone: compare the group and the application range.', []) +

    '<h2 id="t-coat">Common coatings</h2>' +
    '<p class="desc">Maximum temperatures are the makers\' and coaters\' "maximum service" or "maximum application" figures; some call it an oxidation temperature. They differ a lot because each brand is its own recipe, so read them as an order of magnitude. A value is <b>confirmed</b> only where two independent publishers print the same figure.</p>' +
    '<div class="res cntab" style="max-width:none"><table class="gtab"><tr><th>Coating</th><th>Typical use (our summary)</th><th>Max temperature, °C, as printed</th><th>Evidence</th></tr>' +
    coatRows.map(([k, use, keys]) => {
      const c = T.coating_max_c[k === 'CVD Al2O3' ? '' : k];
      return '<tr><td><b>' + rEsc(k) + '</b></td><td>' + rEsc(use) + ' ' + tgTags(keys) + '</td><td>' + (c ? tgGroups(S, c, ' °C') : '<span class="ms">not printed by the sources compared</span>') + '</td><td>' + (c ? badge(c.groups.length > 2 ? 'differs' : c.status) : '') + '</td></tr>';
    }).join('') + '</table></div>' +
    tp('<b>Choosing.</b> For steels use the aluminium-bearing nitrides (TiAlN, AlTiN, AlCrN); for aluminium and other non-ferrous metals use a non-sticking coating (ZrN, DLC) or polished uncoated carbide and avoid aluminium-bearing coatings; for graphite and composites use diamond.', ['PRODINC', 'HARTNER']) +

    '<h2 id="t-em">End mills</h2>' +
    tp('<b>Flute count.</b> Fewer flutes leave more room for chips; more flutes give a thicker core, a stiffer tool and a smoother finish but less chip room.', ['PRODINC', 'BROTHER']) +
    tp('Typical choices: 2 or 3 flutes for aluminium, brass and plastics; 3 or 4 for mild and alloy steels; 4 to 6 for stainless, tool steels and super alloys (more for high-efficiency milling with a small radial cut).', ['PRODINC']) +
    tp('For hard work materials end mills with at least four flutes are the usual choice; a 2-flute tool is suggested for slotting, where chip room matters most.', ['BROTHER']) +
    tp('<b>End shapes.</b> Square end: sharp 90° corners and flat floors. Ball end: 3D surfaces and fillets. Corner radius (bull nose): a stronger corner and longer life in steels and hard materials, leaving a radius in the corner.', ['PRODINC', 'BROTHER']) +
    tp('<b>Roughers</b> have serrated or wavy edges that break the chip into short pieces for heavy removal; they leave a rough wall and are not for finishing.', ['PRODINC', 'BROTHER']) +
    tp('<b>Variable helix and variable pitch</b> (unequal flute spacing) break up the regular tooth rhythm that feeds chatter, giving a calmer cut and a better finish.', ['PRODINC']) +
    tp('<b>High-feed mills</b> have a very small entering angle, so the chip is thin and the force is mostly axial into the spindle: they take shallow cuts at very high feed per tooth. See the ' + tgLink('chipthin', 'Radial chip thinning') + ' tool for the chip thickness idea.', []) +

    '<h2 id="t-dr">Drills and point geometry</h2>' +
    tp('<b>118° point</b>: the general purpose angle of most jobber drills, for mild steel, soft metals and plastics.', ['REGAL', 'TRAVERS']) +
    tp('<b>135° point</b>: flatter, so the lips engage sooner; for harder and tougher materials such as stainless and alloy steels.', ['REGAL', 'TRAVERS']) +
    tp('<b>Split point</b> (usually 135°): the chisel edge is ground into two small cutting edges, so the drill centres itself, needs less thrust and can often start without a spot drill.', ['TRAVERS']) +
    tp('Points over 140° are used for very hard alloys (titanium, nickel alloys, hardened steel) on stiff machines with good coolant.', ['TRAVERS']) +
    tp('<b>Spot drill angle</b>: equal to or larger than the drill\'s point angle, so the drill touches at its tip first and does not walk on the spot\'s edge. See ' + tgLink('spotdepth', 'Spot and centre drill depth') + ' and ' + tgLink('drillpoint', 'Drill point length') + '.', ['TRAVERS']) +
    tp('<b>Types</b>: jobber (general length); stub or screw machine length (short and stiff, for CNC and hard materials); taper length and extra long (deep holes); parabolic flute (more chip room, deep holes in soft materials); solid carbide (high speed and production, often coolant through); centre drill (small pilot and 60° countersink, for work between centres); step drill (several diameters in thin sheet).', ['TRAVERS']) +
    tp('<b>Point thinning</b> (web thinning) grinds back the thick web at the chisel edge of larger drills to cut the thrust force.', []) +

    '<h2 id="t-rm">Reamers</h2>' +
    tp('<b>Flute direction.</b> Straight flutes: general reaming of both blind and through holes. Left-hand spiral (with a right-hand cut): pushes the chips ahead, for through holes and holes broken by cross holes or keyways. Right-hand spiral: pulls the chips back up, for blind holes.', ['GAMMONS', 'CUTWEL']) +
    tp('<b>Types</b>: machine (chucking) reamers with straight or Morse taper shanks; hand reamers with a square drive and a long lead; adjustable reamers that can be opened a little as they wear; taper pin reamers for taper pin holes.', ['CUTWEL', 'GAMMONS']) +
    tp('<b>Stock to leave</b>: Gammons gives about 3 % of the diameter, typically 0.004 to 0.012 in on the diameter; Cutwel\'s example is a pilot 0.2 mm under the reamer (4.3 mm for 4.5 mm). Too little stock and the reamer rubs and burnishes; too much and it deflects and wears.', ['GAMMONS']) +
    tp('<b>Speed</b>: a common start is about two thirds of the drilling speed in the same material. Oversize holes usually come from chatter, too much speed or feed; bell mouth from misalignment of spindle, holder and hole (a floating holder helps).', ['GAMMONS']) +

    '<h2 id="t-tap">Taps</h2>' +
    tp('<b>Spiral point (gun) taps</b> have straight flutes with an angled grind at the front that shoots the chips ahead of the tap: through holes.', ['MSC', 'TRAVERS']) +
    tp('<b>Spiral flute taps</b> lift the chips up and out of the hole: blind holes, and long through holes in long-chipping materials. Faster helix for soft metals, slower for tough alloys.', ['MSC', 'TRAVERS']) +
    tp('<b>Straight flute (hand) taps</b> hold the chips in the flutes: general hand and machine tapping, short holes, short-chipping materials.', ['MSC', 'TRAVERS']) +
    tp('<b>Chamfer (lead) length.</b> Taper: about 7 to 10 threads (MSC) or about 9 (Travers); plug: 3 to 5 or about 4; bottoming: 1 to 2. A longer chamfer shares the load over more teeth and cuts more freely; a short one reaches closer to the bottom of a blind hole.', ['MSC', 'TRAVERS']) +
    tp('<b>Forming (roll) taps</b> have no cutting edges: lobes push the metal into the thread shape, so they make no chips, need no flutes, and give a thread that is generally stronger than a cut one.', ['MSC', 'RS', 'TRAVERS']) +
    tp('They need a ductile material (aluminium, mild and low to medium alloy steels, and similar) and a larger hole than a cutting tap. Good lubrication matters because the tap works by pressure.', ['MSC', 'RS']) +
    tp('<b>Forming tap hole.</b> hole = D − 0.0068 × % × P (inch: D − 0.0068 × % / TPI; metric: D − % × P / 147.06). Use 65 to 75 % thread; forming above 75 % is not recommended. The full comparison of makers is shown under the forming mode of the ' + tgLink('tapdrill', 'Tap drill size') + ' tool.', ['BESLY', 'NAT']) +

    '<h2 id="t-lim">Tap limits (H, L and D numbers)</h2>' +
    tp('<b>H numbers (inch).</b> A ground-thread tap is marked with the pitch diameter band it is made to, in steps of 0.0005 in above the basic pitch diameter: H1 is basic to basic + 0.0005, H2 + 0.0005 to + 0.0010, and so on through 1 in. "GH3" is a ground thread tap to H3.', ['OSG', 'MSC']) +
    tp('Over 1 in to 1-1/2 in OSG prints a band 0.0010 in wide (H4 = basic + 0.0010 to + 0.0020).', ['OSG']) +
    tp('<b>L numbers</b> are undersize taps, stepping 0.0005 in below basic.', ['USCTI']) +
    tp('<b>D numbers (metric)</b> step the same way above the basic pitch diameter: OSG gives them as multiples of 0.0005 in (D3 to + 0.0015 in, D9 to + 0.0045 in), USCTI as multiples of 0.013 mm. The two steps differ by 0.0003 mm per number, so D9 is 0.114 mm (OSG, 0.0045 in) or 0.117 mm (USCTI). DU numbers are undersize.', ['OSG', 'USCTI']) +
    tp('<b>Choosing.</b> The tap must cut inside the internal thread\'s pitch diameter tolerance, allowing for the hole cutting a little larger than the tap. MSC says to choose the largest H number that still gives the class of fit, for tap life; Cutting Tool Supply gives a "40 % rule" (tap about 40 % of the tolerance above the minimum). OSG prints a recommended number per size and class. Forming taps are made to their own limits, often higher: use the maker\'s chart.', ['MSC', 'CTS']) +
    '<p>The ' + tgLink('taplimits', 'Tap pitch diameter limits') + ' tool works these out for any thread and class.</p>' +

    '<h2 id="t-tm">Thread mills</h2>' +
    '<p class="desc">A thread mill cuts a thread by going round the hole or the boss while it moves along the axis. Our own summary of what the sources below say; the program is written by the ' + tgLink('cyctmill', 'Thread milling program') + ' tool.</p>' +
    tp('<b>The machine</b> has to move X, Y and Z at the same time.', ['HARVEY_TM']) +
    tp('Most modern controls have a cycle for it.', ['PROTOOL_TM']) +
    tp('<b>Single-profile (single-form) cutters</b> have one cutting tooth and make the thread one turn at a time. Protool calls them the slower kind.', ['HARVEY_TM', 'MSC_TM', 'PROTOOL_TM']) +
    tp('<b>Full-profile (multi-form) cutters</b> carry the whole thread form on several teeth and finish the thread in one orbit, for one pitch only. Harvey lists a tri-form cutter as well.', ['PROTOOL_TM', 'HARVEY_TM']) +
    tp('<b>Partial-profile cutters</b>, with a 60° or 55° point, cover a range of pitches.', ['PROTOOL_TM']) +
    tp('<b>One tool, many threads.</b> A thread mill cuts any diameter that has its pitch.', ['MSC_TM', 'PROTOOL_TM']) +
    tp('The same tool cuts right-hand and left-hand threads, inside and outside.', ['MSC_TM', 'HARVEY_TM']) +
    tp('<b>Against tapping: no tap to break.</b> Thread milling suits materials and parts where a broken tap is the worry.', ['MSC_TM', 'PROTOOL_TM']) +
    tp('<b>Blind holes.</b> The thread can run close to the bottom of the hole: MSC says within half a pitch.', ['MSC_TM', 'PROTOOL_TM']) +
    tp('<b>Hard and tough materials</b> are easier to thread mill than to tap. Protool names titanium, Inconel, hardened steel and stainless.', ['MSC_TM', 'PROTOOL_TM']) +
    tp('<b>Power.</b> Thread milling takes less power than tapping; a large tap needs a lot of torque and a rigid spindle.', ['MSC_TM', 'PROTOOL_TM']) +
    tp('<b>Size.</b> A tight thread is put right with the cutter radius offset.', ['PROTOOL_TM']) +
    tp('<b>Where tapping wins.</b> Tapping is quicker on small holes made in large numbers in free-cutting material.', ['PROTOOL_TM']) +
    tp('<b>Climb milling a right-hand internal thread:</b> start at the bottom and go round counter-clockwise on the way up, with the spindle turning clockwise.', ['HARVEY_TM', 'IMD_TM', 'PROTOOL_TM']) +
    tp('<b>A left-hand internal thread</b> is climb milled from the top down, also counter-clockwise.', ['HARVEY_TM', 'IMD_TM']) +
    tp('<b>Several radial passes.</b> In tough material, or with a long tool, step out to size over two or three orbits. It spares the tool, bends it less and gives a better thread.', ['HARVEY_TM', 'PROTOOL_TM']) +
    tp('<b>Chips.</b> Clear them with coolant: chips that are cut a second time push the thread out of tolerance.', ['HARVEY_TM']) +
    tp('<b>Cutter diameter.</b> Harvey: no larger than the job needs.', ['HARVEY_TM']) +

    '<h2 id="t-saw">Saw blades and tooth pitch</h2>' +
    tp('<b>At least three teeth in the cut.</b> Choose a pitch that keeps at least three teeth in the thinnest section the blade crosses (the wall of a tube or the leg of an angle); with fewer, teeth snag and strip.', ['STARRETT', 'RMT']) +
    tp('<b>Not too many.</b> With too many teeth in the cut the gullets fill with chips. Starrett\'s rule of thumb is no more than about 10 to 14 teeth in soft materials; RMT prefers 6 to 12. The two upper figures differ and both are shown by the ' + tgLink('sawtpi', 'Saw blade pitch (TPI)') + ' tool.', ['STARRETT', 'RMT']) +
    tp('<b>Size and pitch.</b> Thin or small sections need a finer pitch (more teeth per inch); large solid sections need a coarser one. Bundles are judged by the size of the whole bundle.', ['STARRETT', 'RMT']) +
    tp('<b>Hole saws</b>: speed charts were not compared from two independent makers, so no hole saw speeds are given here. Use the maker\'s chart for the saw and material.', []) +

    '<h2 id="t-brk">Broken tap removal</h2>' +
    '<p class="desc">Our own summary; each method below is described by at least two publishers. Think about the part\'s value and material before choosing a method; stop the machine and lock it out before working on a part still in it.</p>' +
    tp('<b>Extractor</b>: steel fingers slid down the flutes and turned with a wrench, for HSS taps with a stub showing and not jammed hard. Back the tap out gently, with oil, rocking it. It needs a clean break: AIMS puts the limit at M6 and larger and says it fails on a shattered tap, a break below the surface and taps under M4.', ['RAPID', 'AIMS_BT', 'MFGSHOP_BT']) +
    tp('<b>Shatter and pick out</b>: HSS is brittle, so a punch can break the tap up; then the pieces come out with pliers or a pick. Risk of damage to the thread and the part. In a through hole the tap can be driven through with a punch as a last resort (AIMS).', ['RAPID', 'MFGSHOP_BT']) +
    tp('<b>EDM</b> (a tap burner or sinker): erodes the core of the tap without force and without heating the part, for valuable parts and carbide taps; slow, and limited by the part size and hole direction. The part must conduct electricity; AIMS calls it the only method that reliably removes a shattered tap without destroying the hole.', ['RAPID', 'AIMS_BT', 'MFGSHOP_BT']) +
    tp('<b>Drill or grind it out</b>: grind the stub flat and drill with carbide, or open the hole and fit a helical insert or a larger thread. Carbide is used because it is harder than the tap; the cutter must be in line with the tap or it wanders into the thread.', ['RAPID', 'AIMS_BT', 'MFGSHOP_BT']) +
    tp('<b>Chemical</b>: some solutions dissolve the tap steel faster than the part (aluminium parts). Acids are hazardous: follow the product\'s safety data sheet, ventilate, protect skin and eyes. AIMS names alum, which dissolves the steel of the tap, for aluminium parts only: not steel, stainless steel, cast iron or brass.', ['RAPID', 'AIMS_BT']) +
    tp('<b>Weld a nut on</b> a protruding stub and turn it out with a wrench (the heat also helps break it loose); hard on small parts. AIMS wants 3 mm or more of the tap standing proud and warns that thin aluminium warps.', ['RAPID', 'AIMS_BT', 'MFGSHOP_BT']) +
    tp('<b>Prevention</b>: the right tap drill (see ' + tgLink('tapdrill', 'Tap drill size') + '), the right tap type for the hole, square alignment, good lubrication and chip removal, deep enough blind holes, sound taps replaced when worn, and no forcing. AIMS: drill a blind hole at least 3 pitches deeper than the thread, and back the tap off every one or two turns to break the chips.', ['RAPID', 'AIMS_BT', 'MFGSHOP_BT']) +

    '<h2 id="t-src">Sources</h2><ul class="gsl">' + Object.entries(TG_SRC).map(([k, v]) => '<li><b>' + k + '</b> ' + rEsc(v.publisher) + ', ' + rEsc(v.title) + (v.url ? ' (' + rEsc(v.url) + ')' : '') + (v.accessed ? ', accessed ' + rEsc(v.accessed) : '') + '</li>').join('') + '</ul>' +
    '<p class="desc">Full notes are in data/refdata/tooling-evidence.json and docs/tooling.md. No text, figures or tables were copied from handbooks, standards or maker catalogues.</p>';
  el.querySelectorAll('.gtoc a').forEach(a => a.onclick = e => { e.preventDefault(); const t = el.querySelector(a.getAttribute('href')); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  tgWireLinks(el);
}

// ---------- Tap pitch diameter limits ----------
async function renderTapLimits(el) {
  const R = await loadRef(el); if (!R) return;
  const T = R.tooling; if (!T) { el.textContent = 'Tooling data not built.'; return; }
  TG_SRC = Object.assign({}, TG_EXTRA, T.sources);
  const W = state.W, opts = threadOptions(R);
  const m = RMEM.taplim || (RMEM.taplim = { key: '1/4-20 UNC', cls: '', n: '', frac: 40 });
  if (!opts.find(o => o.key === m.key)) m.key = (opts.find(o => o.sys === 'unified') || opts[0]).key;
  el.innerHTML = '<div class="grid" style="max-width:760px">' +
    '<label class="f"><span>Thread</span><div class="row"><select id="lk">' + threadSelect(opts, m.key).replace(/<option value="custom"[^<]*<\/option>/, '') + '</select></div></label>' +
    '<label class="f"><span>Internal thread class</span><div class="row"><select id="lc"></select></div></label>' +
    '<label class="f"><span>Tap limit number to check (blank = suggestion)</span><div class="row"><input id="ln" type="number" step="1" min="1"><span class="u">H / D</span></div></label>' +
    '<label class="f"><span>Place the tap at this share of the tolerance</span><div class="row"><input id="lf" type="number" step="any"><span class="u">%</span></div></label>' +
    '</div><div id="lres"></div>' +
    '<div class="res mtab" style="margin-top:12px"><div class="h">Evidence for the steps</div><table><tr><th>Item</th><th>Value, as printed</th><th>Evidence</th></tr>' +
    [['H and L step (inch)', T.tap_limits.h_step_in, ' in'], ['H band width, through 1 in', T.tap_limits.h_band_to_1in, ' in'], ['H band width, over 1 in to 1-1/2 in', T.tap_limits.h_band_over_1in, ' in'],
     ['L step (undersize)', T.tap_limits.l_step_in, ' in'], ['D step (metric; USCTI prints 0.013 mm, shown converted)', T.tap_limits.d_step_in, ' in'], ['"40 % rule" share of tolerance', T.tap_limits.rule_fraction, '']]
      .map(([a, c, u]) => '<tr><td>' + a + '</td><td>' + tgGroups(T.sources, c, u) + (c && c.groups[0].printed.length > 1 && new Set(c.groups[0].printed).size > 1 ? '<br><span class="ms">printed: ' + c.groups[0].printed.map(rEsc).join(', ') + '</span>' : '') + '</td>' + evCell(T.sources, c) + '</tr>').join('') +
    '</table></div>' +
    '<div class="note"><b>Working:</b> Inch H number n: maximum = basic pitch diameter + n × 0.0005 in; minimum = maximum − 0.0005 in through 1 in (OSG, MSC) and − 0.0010 in over 1 in to 1-1/2 in (OSG only); above 1-1/2 in no minimum is given. L number: minimum = basic − n × 0.0005 in. Metric D number: maximum = basic + n × step, with the step 0.0005 in = 0.0127 mm (OSG) or 0.013 mm (USCTI); the minimum of each D number is OSG\'s printed band (D3 to D9) and is shown only where OSG prints it. ' +
    'Internal thread limits come from the Thread data tool\'s formulas (ASME B1.1 classes 1B, 2B, 3B; ISO 965-1 tolerance classes). A number "fits" when its whole band lies inside the internal thread\'s pitch diameter tolerance. The suggestion puts the tap\'s maximum nearest the share of the tolerance you enter (default 40 %, the Cutting Tool Supply rule). OSG\'s printed recommendation is shown for the sizes in hand: it sits at or one step below the 40 % rule. ' +
    'A tap usually cuts a little larger than itself, and more in soft or gummy materials; forming taps are made to their own (often higher) limits. Check the first part with a go / no-go gauge.<br><b>Sources:</b> OSG USA, Tap drill size and pitch diameter limit chart vol. 3 (2024); USCTI / GWS Tool Group tapping tips; MSC taps buying guide; Cutting Tool Supply, H limits and class. Standard cited, not read: ASME B94.9 (taps).</div>';
  const lk = $('#lk', el), lc = $('#lc', el), ln = $('#ln', el), lf = $('#lf', el);
  ln.value = m.n; lf.value = m.frac;
  function classes(sel) {
    return sel.sys === 'unified' ? [['12', '2B'], ['13', '3B'], ['11', '1B']] : [['6.12', '6H'], ['5.12', '5H'], ['7.12', '7H'], ['6.11', '6G']];
  }
  function setClasses() {
    const sel = opts.find(o => o.key === lk.value), cs = classes(sel);
    lc.innerHTML = cs.map(([v, t]) => '<option value="' + v + '">' + t + '</option>').join('');
    if (cs.some(c => c[0] === m.cls)) lc.value = m.cls; else m.cls = lc.value;
  }
  const f4 = v => fx(v, 4), f3 = v => fx(v, 3);
  function upd() {
    m.key = lk.value; m.cls = lc.value; m.n = ln.value; m.frac = lf.value;
    const sel = opts.find(o => o.key === lk.value), out = $('#lres', el);
    const frac = (lf.value === '' ? 40 : parseFloat(lf.value)) / 100;
    if (!sel) { out.innerHTML = ''; return; }
    const inch = sel.sys === 'unified', clsName = lc.options[lc.selectedIndex].text;
    // Work in inch for unified, mm for metric; both shown.
    let basic, pmin, pmax, step, unit, show, other;
    if (inch) {
      const d = sel.din, p = 1 / sel.tpi, c = +lc.value;
      basic = Math.round(W.thread_basic_pitch_dia(d, p) * 1e4) / 1e4; pmin = W.un_limit(d, p, c, 3); pmax = W.un_limit(d, p, c, 2);
      step = W.tap_h_limit(0, 1, d, 1); unit = 'in'; show = f4; other = v => f3(v * IN_MM) + ' mm';
    } else {
      const [g, pos] = lc.value.split('.').map(Number);
      basic = W.thread_basic_pitch_dia(sel.d, sel.p); pmin = W.iso965_limit(sel.d, sel.p, g, pos, 3); pmax = W.iso965_limit(sel.d, sel.p, g, pos, 2);
      step = 0.0005 * IN_MM; unit = 'mm'; show = f3; other = v => f4(v / IN_MM) + ' in';
    }
    const L = inch ? 'H' : 'D';
    const band = n => {
      if (inch) return [W.tap_h_limit(basic, n, sel.din, 0), W.tap_h_limit(basic, n, sel.din, 1)];
      const b = T.osg_d_bands_in['D' + n];
      return [b ? basic + parseFloat(b[0]) * IN_MM : NaN, W.tap_d_limit(basic, n, step, 1)];
    };
    const sug = W.tap_limit_for_fraction(basic, pmin, pmax, frac, step);
    const rec = (T.osg_recommended[sel.key] || {})[clsName];
    const n = ln.value === '' ? sug : Math.max(1, Math.round(parseFloat(ln.value)));
    const fits = ([a, b]) => isFinite(a) && a >= pmin - 1e-9 && b <= pmax + 1e-9;
    const rowsN = [];
    for (let i = 1; i <= (inch ? 12 : 9); i++) {
      const b = band(i);
      if (!(b[1] <= pmax + step * 2)) break;
      rowsN.push('<tr' + (i === n ? ' class="sel"' : '') + '><td><b>' + L + i + '</b>' + (i === sug ? ' <span class="ms">suggested</span>' : '') + (rec === L + i ? ' <span class="ms">OSG</span>' : '') + '</td><td class="v">' + (isFinite(b[0]) ? show(b[0]) : '-') + '</td><td class="v">' + show(b[1]) + '</td><td>' +
        (isFinite(b[0]) ? (fits(b) ? 'inside the tolerance' : '<span class="warn">outside</span>') : (b[1] <= pmax ? 'maximum inside; minimum not printed' : '<span class="warn">maximum outside</span>')) + '</td></tr>');
    }
    const b = band(n);
    out.innerHTML = '<div class="res"><div class="h">' + rEsc(sel.label) + ', class ' + rEsc(clsName) + ' ' + badge(sel.status) + '</div><table>' +
      '<tr><td>Basic pitch diameter</td><td class="v">' + show(basic) + '</td><td class="u">' + unit + '</td><td class="ms">' + other(basic) + '</td></tr>' +
      '<tr><td>Internal thread pitch diameter, min / max</td><td class="v">' + show(pmin) + ' / ' + show(pmax) + '</td><td class="u">' + unit + '</td><td class="ms">tolerance ' + show(pmax - pmin) + '</td></tr>' +
      '<tr><td>Suggested tap (' + fx(frac * 100, 0) + ' % of the tolerance)</td><td class="v">' + L + sug + '</td><td></td><td class="ms">' + (rec ? 'OSG prints ' + rEsc(rec) + ' for this size and class' : 'no OSG recommendation in hand for this size') + '</td></tr>' +
      '<tr><td>' + L + n + ' pitch diameter, min / max</td><td class="v">' + (isFinite(b[0]) ? show(b[0]) : '-') + ' / ' + show(b[1]) + '</td><td class="u">' + unit + '</td><td class="ms">' + (isFinite(b[0]) ? (fits(b) ? 'inside the tolerance' : 'outside the tolerance') : 'minimum: see the maker') + '</td></tr>' +
      (inch ? '<tr><td>L' + n + ' (undersize) minimum</td><td class="v">' + show(W.tap_l_limit_min(basic, n)) + '</td><td class="u">' + unit + '</td><td class="ms">needs 2nd source (USCTI only)</td></tr>' :
        '<tr><td>D' + n + ' maximum with the 0.013 mm step (USCTI)</td><td class="v">' + show(W.tap_d_limit(basic, n, 0.013, 1)) + '</td><td class="u">' + unit + '</td><td class="ms">OSG\'s inch step gives ' + show(b[1]) + '</td></tr>') +
      '</table></div>' +
      '<div class="res mtab" style="margin-top:12px"><div class="h">' + L + ' numbers against the ' + rEsc(clsName) + ' tolerance (' + unit + ')</div><table><tr><th>Number</th><th>Min</th><th>Max</th><th>Check</th></tr>' + rowsN.join('') + '</table></div>';
  }
  lk.onchange = () => { setClasses(); upd(); }; lc.onchange = upd; ln.oninput = upd; lf.oninput = upd;
  setClasses(); upd();
}

// ---------- Forming tap makers compared (shown by the Tap drill size tool) ----------
function formTapCompare(R, d, p, pct) {
  const T = R && R.tooling; if (!T) return '';
  const W = state.W, F = T.form_tap, S = T.sources;
  const rule = W.tap_drill_form(d, p, pct);
  const rows = [
    ['Inch: hole = D − k × % / TPI, constant k', tgGroups(S, F.inch_k), evCell(S, F.inch_k)],
    ['Metric: hole = D − % × P / divisor', tgGroups(S, F.metric_div), evCell(S, F.metric_div)],
    ['Shortcut', tgGroups(S, F.shortcut) + '<br><span class="ms">= ' + fLen(d - p / 2) + ' ' + uLen() + ' here, the rule at ' + fx(W.tap_pct_form(d, p, d - p / 2), 1) + ' %</span>', evCell(S, F.shortcut)],
  ];
  return '<div class="res mtab" style="margin-top:12px"><div class="h">Forming tap hole: what the publishers print</div><table><tr><th>Rule</th><th>As printed</th><th>Evidence</th></tr>' +
    rows.map(r => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td>' + r[2] + '</tr>').join('') + '</table></div>' +
    '<p class="desc">The 0.0068 rule gives ' + fBoth(rule) + ' at ' + fx(pct, 0) + ' %. Two tap makers (North American Tool, Besly) and three other publishers print it; 147.06 is 1 / 0.0068, the same rule in mm. MSC\'s metric line applies 0.0068 twice and is shown as printed, not used. Balax, a forming tap maker, prints miniature hole sizes 0 to 0.0016 in larger than the rule. Makers recommend 55 to 75 % for forming taps and not more than 75 %. Use the hole your tap maker gives for the tap in hand.</p>';
}
