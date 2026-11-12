// Special processes and finishing guide (parity MH173, MH189, MH196, MH197, ED92).
// All wording and drawings are BenchMate's own. Every statement carries the keys of the public sources read for
// it (docs/sources.md, "Special processes and finishing guide"); one with fewer than two independent publishers
// is shown as "to be verified". Where two sources give different figures both are shown with the source named.
'use strict';

const PG_SOURCES = {
  OU_WJ: 'The Open University, OpenLearn Manupedia, "Water jet cutting (hydrodynamic cutting)", 2018 (CC BY-NC-SA)',
  OU_AJ: 'The Open University, OpenLearn Manupedia, "Abrasive jet cutting", 2018 (CC BY-NC-SA)',
  OU_LC: 'The Open University, OpenLearn Manupedia, "Laser cutting", 2017 (CC BY-NC-SA)',
  OU_PC: 'The Open University, OpenLearn Manupedia, "Plasma arc cutting", 2018 (CC BY-NC-SA)',
  HYP: 'Hypertherm, "Choosing a cutting process"',
  FRAC: 'Fractory, A. Velling, article on plasma cutting, 2021-01-27',
  FAB: 'The Fabricator, J. H. Olsen, article on buying an abrasive jet machine, 2002-04-15',
  TECHNI: 'Techni Waterjet, "How it works"',
  WP_LC: 'Wikipedia, "Laser cutting" (CC BY-SA)',
  MMS_EDM: 'Modern Machine Shop, E. Doran, "Machining 101: what is electrical discharge machining?", 2021-07-10',
  XOM_EDM: 'Xometry, M. Conniff, article on electrical discharge machining, 2023-10-24',
  WP_USM: 'Wikipedia, "Ultrasonic machining" (CC BY-SA)',
  ARTZ: 'Artizono, "Ultrasonic machining technology: a technical deep dive", 2025-05-14',
  WP_AFM: 'Wikipedia, "Abrasive flow machining" (CC BY-SA)',
  EH: 'Extrude Hone AFM, FAQ "What is abrasive flow machining?"',
  WP_EBM: 'Wikipedia, "Electron-beam machining" (CC BY-SA)',
  WP_PCM: 'Wikipedia, "Photochemical machining" (CC BY-SA)',
  EFAB: 'E-Fab, "Photochemical etching: what it is, how it works"',
  PF: 'Products Finishing, P. Wenino, "Polishing vs. buffing: what\'s the difference?", 2017-07-01',
  EMP: 'Empire Abrasives blog, "What\'s the difference: buffing vs polishing", 2021-06-22',
  WP_POL: 'Wikipedia, "Polishing (metalworking)" (CC BY-SA)',
  UA: 'United Abrasives (SAIT), product technical information, "Wire brushes"',
  WEIL: 'Weiler Abrasives, P. Hutchinson, "Tips for overcoming common challenges when using wire brushes"',
  PCI: 'PCI Magazine, R. Zoontjens, "A guide to conversion coating", 2022-03-25',
  EFUNDA: 'eFunda, "Conversion coatings"',
  GLECO: 'Gleco Plating, "Exploring the different types of aluminum anodizing processes"',
  FIN: 'Finishing.com, "Aluminum anodizing: intro and FAQs"',
  WP_CR: 'Wikipedia, "Chrome plating" (CC BY-SA)',
  RICH: 'Richconn, "Hard chrome plating vs decorative chrome plating" (no date)',
  PL_FIN: 'Protolabs, design tip "Plating and other finishing considerations for CNC machining and sheet metal"',
  PL_EN: 'Protolabs blog, "Advantages of electroless nickel plating", 2026-03-24',
  EPI: 'EPI (epi.com), technical paper "How to select an electroplated finish" (no author or date shown)',
  TWI: 'TWI, FAQ "What are the different thermal spraying processes?"',
  WG_TS: 'WeldGuru, J. Grill, page on spray welding (thermal spraying), updated 2024-01-12',
};
// Several pages of one publisher count once.
const PG_FAMILY = { OU_WJ: 'OU', OU_AJ: 'OU', OU_LC: 'OU', OU_PC: 'OU', WP_LC: 'WIKI', WP_USM: 'WIKI', WP_AFM: 'WIKI', WP_EBM: 'WIKI', WP_PCM: 'WIKI', WP_POL: 'WIKI', WP_CR: 'WIKI', PL_FIN: 'PROTO', PL_EN: 'PROTO' };
const pgTags = keys => guideTags(keys, PG_SOURCES, PG_FAMILY);
const pgP = (html, keys) => '<p>' + html + (keys === null ? '' : ' ' + pgTags(keys)) + '</p>';
const pgBox = d => '<path class="gfill" d="' + d + '"/><path class="gp" d="' + d + '"/>';

// Abrasive water jet cutting head in section, cutting a plate.
function pgJet() {
  let grit = '';
  [[106, 84], [116, 82], [126, 86], [136, 83], [146, 85], [156, 84], [168, 84], [178, 88], [184, 96], [197, 94], [199, 86]].forEach(([x, y]) => { grit += '<circle class="gacc" cx="' + x + '" cy="' + y + '" r="1.6"/>'; });
  return cnSvg(420, 236,
    pgBox('M164 14H181V58H164Z') + pgBox('M199 14H216V58H199Z') +
    '<path class="gacc" d="M164 58H187V66H164Z"/><path class="gacc" d="M193 58H216V66H193Z"/>' +
    pgBox('M164 66H176V78H164Z') + pgBox('M164 90H176V102H164Z') + pgBox('M204 66H216V102H204Z') +
    pgBox('M100 74H164V78H100Z') + pgBox('M100 90H164V94H100Z') +
    pgBox('M176 102H186V164H176Z') + pgBox('M194 102H204V164H194Z') +
    grit +
    '<path class="gc" style="stroke-width:3" d="M190 16V212"/>' +
    pgBox('M60 182H185V208H60Z') + pgBox('M195 182H320V208H195Z') +
    '<path class="gm" d="M216 30H246M216 62H246M204 132H246"/>' +
    cnT(250, 34, 'high-pressure water', 'gs') + cnT(250, 66, 'orifice (a jewel)', 'gs') +
    cnT(94, 82, 'abrasive in', 'gs', 'end') + cnT(94, 95, '(garnet)', 'gs', 'end') +
    cnT(250, 136, 'mixing tube', 'gs') + cnT(190, 228, 'kerf (width of cut)', 'gs', 'middle') + cnT(110, 199, 'plate', 'gv', 'middle'),
    'An abrasive water jet cutting head in section: water at very high pressure comes down through a small jewel orifice, abrasive grit enters from the side below the orifice, the two leave together through a long mixing tube, and the jet cuts a narrow slot, the kerf, through the plate underneath');
}
// Ultrasonic machining: the tool, the slurry and the cavity it sinks.
function pgUsm() {
  let grit = '';
  [[136, 118], [138, 130], [137, 142], [141, 152], [150, 153], [160, 152], [169, 152], [183, 142], [182, 130], [184, 118], [176, 153], [126, 105], [194, 105]].forEach(([x, y]) => { grit += '<circle class="gacc" cx="' + x + '" cy="' + y + '" r="1.6"/>'; });
  return cnSvg(420, 210,
    pgBox('M70 110H132V156H188V110H250V190H70Z') +
    pgBox('M120 14H200V40L178 78V146H142V78L120 40Z') +
    grit +
    '<path class="gc" d="M100 30V74M100 30l-4 8M100 30l4 8M100 74l-4 -8M100 74l4 -8"/>' +
    '<path class="gm" d="M200 28H262M198 104H262M250 170H262"/>' +
    cnT(92, 56, 'vibrates', 'gs', 'end') +
    cnT(266, 32, 'tool (sonotrode)', 'gs') + cnT(266, 108, 'abrasive slurry', 'gs') + cnT(266, 174, 'work', 'gs') +
    cnT(160, 204, 'the cavity takes the shape of the tool', 'gs', 'middle'),
    'Ultrasonic machining in section: a tool called a sonotrode vibrates up and down above the work with a slurry of abrasive grains in the gap between them, and the cavity that forms in the work takes the shape of the end of the tool');
}
// Anodising: where the coating sits against the surface the part had before.
function pgAnod() {
  return cnSvg(420, 146,
    pgBox('M14 46H104V114H14Z') +
    pgBox('M130 58H230V114H130Z') + '<path class="gacc" d="M130 34H230V58H130Z"/><path class="gp" d="M130 34H230V58H130Z"/>' +
    '<path class="gp" stroke-dasharray="5 4" style="stroke-width:1.2" d="M6 46H238"/>' +
    '<path class="gm" d="M236 34V58M233 34H239M233 46H239M233 58H239"/>' +
    cnT(59, 86, 'aluminium', 'gs', 'middle') + cnT(180, 92, 'aluminium', 'gs', 'middle') +
    cnT(14, 38, 'surface before', 'gs') + cnT(180, 26, 'oxide coating', 'gs', 'middle') +
    cnT(246, 44, 'about half builds out', 'gs') + cnT(246, 57, 'about half grows in', 'gs') +
    cnT(59, 134, 'before', 'gv', 'middle') + cnT(180, 134, 'anodised', 'gv', 'middle'),
    'An aluminium surface before and after anodising: the oxide coating sits across the line of the original surface, about half of its thickness built outward above the line and about half grown inward below it, so the surface moves out by about half the coating thickness');
}

const PG_CUT = [
  ['Water jet, water only', 'Soft materials. Hard materials need abrasive in the jet', ['OU_WJ', 'TECHNI']],
  ['Abrasive water jet', 'Nearly any material', ['OU_AJ', 'HYP']],
  ['Laser', 'Sheet and the thinner plate', ['OU_LC', 'HYP', 'FRAC']],
  ['Plasma', 'Materials that conduct electricity', ['OU_PC', 'HYP', 'FRAC']],
  ['Oxyfuel (flame cutting)', 'Steel only: "carbon steel" in one source, "ferrous metals" in the other', ['HYP', 'FRAC']],
];
const PG_THICK = [
  ['Laser', 'Hypertherm: typically 6 mm and less, up to 30 mm in some cases. Fractory: a limit of about 25 to 30 mm. Open University: up to 25 mm', ['HYP', 'FRAC', 'OU_LC']],
  ['Plasma', 'Hypertherm: best from 6 to 80 mm. Fractory: 15 to 50 mm recommended, 150 mm at most. Open University: 0.75 to 200 mm, usually 5 to 25 mm', ['HYP', 'FRAC', 'OU_PC']],
  ['Oxyfuel', 'Hypertherm: 50 mm and above', ['HYP']],
  ['Abrasive water jet', 'Hypertherm: up to 305 mm (12 in). Techni Waterjet: up to 304 mm for most materials. The Fabricator: flat parts from shim to about 2 in. Open University: foil to 50 mm of steel', ['HYP', 'TECHNI', 'FAB', 'OU_AJ']],
];
const PG_EDM = [
  ['Sinker (ram) EDM', 'A shaped electrode of graphite or copper sinks its form into the work', ['MMS_EDM', 'XOM_EDM']],
  ['Wire EDM', 'A thin wire that keeps moving cuts a profile through the work. The wire is brass or coated copper', ['XOM_EDM']],
  ['Hole drilling EDM', 'A hollow tube electrode with the dielectric flowing through it', ['XOM_EDM']],
];
const PG_COMP = [
  ['Black (emery)', 'Coarse: cut buffing', ['EMP', 'WP_POL']],
  ['Brown (tripoli)', 'Cut buffing. One source: cut and colour on soft metals', ['EMP', 'WP_POL']],
  ['White', 'Colour buffing. One source: on the harder metals', ['EMP', 'WP_POL']],
  ['Green', 'Colour buffing. One source: stainless steel', ['EMP', 'WP_POL']],
  ['Blue', 'Colour buffing of plastics', ['EMP']],
  ['Red (rouge)', 'Polishes without cutting', ['WP_POL']],
];
const PG_CONV = [
  ['Black oxide', 'Steel and stainless steel', 'A black finish, sealed with oil', ['EFUNDA', 'PCI']],
  ['Phosphate', 'Carbon and low-alloy steel, cast iron', 'A layer of iron, zinc or manganese phosphate crystals. Manganese phosphate is the one for wear', ['EFUNDA']],
  ['Chromate (Alodine, Iridite)', 'Aluminium. One source adds zinc, cadmium and magnesium', 'Conducts electricity better than an anodised surface', ['EFUNDA', 'PCI']],
];
const PG_ANOD = [
  ['Type I', 'Chromic acid', 'Gleco: the thinnest. Finishing.com: usually under 0.0001 in', ['GLECO', 'FIN']],
  ['Type II', 'Sulfuric acid', 'Gleco: typically 0.0001 to 0.0005 in. Finishing.com: about 0.0001 to 0.0008 in. PCI Magazine: 5 to 30 µm', ['GLECO', 'FIN', 'PCI']],
  ['Type III (hardcoat)', 'Run cold', 'Gleco: typically 0.001 to 0.002 in. Finishing.com: about 0.002 in. PCI Magazine: 25 to 100 µm', ['GLECO', 'FIN', 'PCI']],
];

function renderProcGuide(el) {
  const toc = [['pg-cut', 'Cutting plate and sheet'], ['pg-edm', 'EDM'], ['pg-other', 'Other special processes'], ['pg-pol', 'Polishing, buffing, brushing'], ['pg-conv', 'Conversion coatings'], ['pg-anod', 'Anodising'], ['pg-plate', 'Plating and spraying']];
  const two = (head, rows) => '<div class="res cntab" style="max-width:none"><table class="gtab"><tr>' + head.map(h => '<th>' + h + '</th>').join('') + '<th>Sources</th></tr>' +
    rows.map(r => '<tr><td><b>' + gesc(r[0]) + '</b></td><td>' + gesc(r[1]) + '</td><td>' + pgTags(r[2]) + '</td></tr>').join('') + '</table></div>';
  el.innerHTML =
    '<nav class="gtoc">' + toc.map(([a, t]) => '<a href="#' + a + '">' + t + '</a>').join('') + '</nav>' +
    '<p class="desc">The processes a machine shop sends out or meets on a drawing, in our own words: cutting plate with water jet, laser, plasma and flame; EDM; ultrasonic, abrasive flow, electron beam and photochemical machining; polishing, buffing and wire brushing; conversion coatings, anodising, plating and thermal spraying. The small grey keys after each statement name the public sources it was checked against (list at the bottom). <span class="gtbv">to be verified</span> marks a statement not yet confirmed by two independent publishers. Where the sources give different figures, each figure is shown with its source.</p>' +

    '<h2 id="pg-cut">Cutting plate and sheet</h2>' +
    two(['Process', 'What it cuts'], PG_CUT) +
    pgP('<b>Cold or hot.</b> A water jet cuts cold: no heat-affected zone and no distortion from heat.', ['OU_WJ', 'TECHNI', 'FAB', 'HYP']) +
    pgP('<b>Laser and plasma</b> both leave a heat-affected zone, and the one plasma leaves is the larger.', ['HYP', 'FRAC']) +
    pgP('One source puts figures on that: a heat-affected zone of 0.025 to 0.075 mm for laser and of up to 5 mm for plasma.', ['OU_LC', 'OU_PC']) +
    '<p class="desc"><b>Thickness.</b> The sources do not agree on how thick each process cuts, so each is quoted.</p>' +
    two(['Process', 'Thickness, source by source'], PG_THICK) +
    pgP('<b>Oxyfuel</b> needs time to pre-heat the plate before the cut starts.', ['HYP']) +

    '<h3 class="gcat">Water jet</h3>' + pgJet() +
    pgP('<b>The cutting head.</b> Water at very high pressure passes a fine orifice. For hard materials, garnet grit is added to the stream.', ['FAB', 'TECHNI']) +
    pgP('<b>The orifice</b> is a jewel: sapphire in one source, ruby or diamond in another.', ['OU_WJ', 'TECHNI']) +
    pgP('The grit joins the water in a mixing tube made of carbide.', ['FAB']) +
    pgP('<b>Pressure.</b> One source gives 40 000 to 60 000 psi and another says above 40 000 psi; the Open University gives 70 to 415 MPa for a jet of plain water.', ['FAB', 'TECHNI', 'OU_WJ']) +
    pgP('The Open University page on abrasive jets gives 50 to 70 MPa, far below the figures above. Not resolved here.', ['OU_AJ']) +
    pgP('<b>Width of the cut.</b> One source: an abrasive jet is 0.020 to 0.050 in across, and the smallest inside corner radius is half the jet diameter. The Open University gives a much wider kerf for abrasive jets, usually 3 to 8 mm.', ['FAB', 'OU_AJ']) +
    pgP('A jet of plain water comes from a nozzle of 0.075 to 0.40 mm and leaves a kerf about 0.025 mm wider than the nozzle.', ['OU_WJ']) +
    pgP('<b>Taper.</b> The cut is slightly tapered. The sources differ on where it is worst: one measured 0.001 to 0.003 in on 2 in steel against 0.005 to 0.008 in on 1/8 in material, so most in thin material; the Open University says the taper grows with thickness.', ['FAB', 'OU_AJ']) +
    pgP('<b>The cut face</b> can show striations (scallops). One source says it runs from a sandblasted look to a striated one, depending on the cutting speed.', ['FAB', 'OU_AJ']) +
    pgP('<b>Speed.</b> An abrasive water jet is slower than the thermal processes.', ['OU_AJ', 'HYP']) +
    pgP('Doubling the thickness more than halves the cutting speed. Hardened tool steel (60 HRC) cuts about as fast as mild steel.', ['FAB']) +
    pgP('One maker gives a tolerance of ±0.1 to ±0.2 mm.', ['TECHNI']) +
    pgP('A plain water jet can delaminate laminated materials.', ['OU_WJ']) +

    '<h3 class="gcat">Laser</h3>' +
    pgP('<b>How it cuts.</b> A focused beam melts or vaporises the material in a very small spot, and a jet of gas blows the melt out of the cut.', ['OU_LC', 'WP_LC']) +
    pgP('<b>Assist gas.</b> Oxygen reacts with the hot metal and adds heat to the cut.', ['OU_LC', 'WP_LC']) +
    pgP('Argon and nitrogen clear and protect the cut without adding heat.', ['OU_LC']) +
    pgP('Cutting with oxygen suits carbon steel over 1 mm thick and cuts thick plate with little laser power.', ['WP_LC']) +
    pgP('<b>Kinds of laser</b> named by both sources: CO2 and Nd:YAG.', ['OU_LC', 'WP_LC']) +
    pgP('A fibre laser makes a much smaller spot and suits reflective metals such as copper and brass.', ['WP_LC']) +
    pgP('<b>Finish of the cut face.</b> 3.2 to 6.3 µm Ra in one source, 125 to 250 microinch in the other.', ['OU_LC', 'WP_LC']) +
    pgP('<b>The edge,</b> in one source: a recast layer 0.025 to 0.25 mm thick, and the smallest outside corner radius on sheet about 3 mm.', ['OU_LC']) +
    pgP('The kerf can be as narrow as 0.10 mm, and the tolerance is often within 0.025 mm.', ['WP_LC']) +
    pgP('<b>Safety.</b> Eye protection is required, and the fume and dust are a hazard.', ['OU_LC']) +

    '<h3 class="gcat">Plasma</h3>' +
    pgP('<b>How it cuts.</b> An arc runs between the torch and the work. Gas forced through a narrow nozzle becomes a plasma jet that melts the metal and blows it away.', ['OU_PC', 'FRAC']) +
    pgP('<b>Gases.</b> Air and nitrogen, among others.', ['OU_PC', 'FRAC']) +
    pgP('<b>Against laser.</b> Laser is the more precise; plasma cuts thicker plate.', ['FRAC', 'WP_LC']) +
    pgP('A laser machine costs more.', ['WP_LC', 'HYP']) +
    pgP('<b>The edge,</b> in one source: the sides of the cut taper by 2 to 7°, or 1 to 2° with care; the finish is 1.6 to 3.2 µm Ra; dross can stick to the underside; the smallest pierced hole is about 3 mm.', ['OU_PC']) +

    '<h2 id="pg-edm">EDM (electrical discharge machining)</h2>' +
    pgP('<b>How it cuts.</b> Sparks jump a small gap between an electrode and the work, through a dielectric fluid. Nothing touches the work, so there is no cutting force, but the work must conduct electricity.', ['MMS_EDM', 'XOM_EDM']) +
    pgP('The fluid insulates until the gap and the voltage are right for a spark. The current is pulsed so that the debris can be flushed away. The hardness of the work does not matter.', ['MMS_EDM']) +
    two(['Kind', 'The electrode'], PG_EDM) +
    pgP('<b>Sinker electrodes.</b> The electrode is a mirror image of the form wanted, made slightly smaller. Copper suits small parts and fine finishes.', ['MMS_EDM']) +
    pgP('<b>What a sinker is for:</b> blind cavities, moulds and dies.', ['XOM_EDM']) +
    pgP('<b>Recast layer.</b> EDM leaves a recast layer on the surface.', ['XOM_EDM', 'EH']) +
    pgP('Finishing passes at lower energy make smaller craters, so a smoother surface, and refine that layer.', ['XOM_EDM']) +
    pgP('<b>Also in one source:</b> the electrode wears; inside corners can be sharp; there are no burrs; the process is slow; tolerances are around ±0.005 to ±0.02 mm.', ['XOM_EDM']) +
    pgP('For wire EDM see <a href="#/t/edmoffset">kerf, wire offset and corner radius</a>, <a href="#/t/edmtaper">taper cut</a> and <a href="#/t/edmtime">cut time</a>.', null) +

    '<h2 id="pg-other">Other special processes</h2>' +
    '<h3 class="gcat">Ultrasonic machining</h3>' + pgUsm() +
    pgP('<b>How it cuts.</b> A tool (the sonotrode) vibrates at ultrasonic frequency with a slurry of abrasive between it and the work. The abrasive grains do the cutting, chipping the work away a little at a time.', ['WP_USM', 'ARTZ']) +
    pgP('<b>Slurry and tool.</b> Boron carbide, aluminium oxide or silicon carbide in water, grit 100 to 1000. The tool is usually low carbon steel.', ['WP_USM', 'ARTZ']) +
    pgP('<b>What it is for.</b> Hard, brittle materials: ceramics, carbides and glass.', ['WP_USM', 'ARTZ']) +
    pgP('<b>For and against.</b> No heat goes into the work. The process is slow, the tool wears, and deep holes are hard because the slurry does not reach the bottom.', ['WP_USM', 'ARTZ']) +
    pgP('It works on materials that do not conduct electricity, which EDM cannot cut. The cavity is a negative of the tool.', ['WP_USM']) +
    pgP('One source gives a frequency of 18 to 40 kHz and an amplitude of 0.05 to 0.125 mm.', ['WP_USM']) +
    pgP('<b>Rotary ultrasonic machining</b> uses a tool set with diamond that turns as well as vibrates, with no slurry.', ['WP_USM']) +
    '<h3 class="gcat">Abrasive flow machining</h3>' +
    pgP('<b>Abrasive flow machining</b> (also called extrude honing) forces a medium like putty, loaded with abrasive, through the work. It deburrs, polishes and rounds edges on inside surfaces that are hard to reach by hand.', ['WP_AFM', 'EH']) +
    pgP('It removes most where the passage is narrowest, and the rate of removal is low.', ['WP_AFM']) +
    pgP('It is also used to take off the recast layer that EDM leaves.', ['EH']) +
    '<h3 class="gcat">Electron beam machining</h3>' +
    pgP('A narrow beam of fast electrons heats and vaporises the material. The work sits in a vacuum, so only small parts can be done, and the process gives off hazardous X-rays.', ['WP_EBM']) +
    '<h3 class="gcat">Photochemical machining (photo etching)</h3>' +
    pgP('<b>Steps.</b> Sheet metal is coated on both sides with a light-sensitive resist, exposed to ultraviolet light through a phototool, and developed. Etchant, often ferric chloride, is then sprayed on to dissolve the bare metal, and the resist is stripped.', ['WP_PCM', 'EFAB']) +
    pgP('<b>Why use it.</b> No burrs. The tooling is quick, with no hard tools to make.', ['WP_PCM', 'EFAB']) +
    pgP('<b>Thickness.</b> 0.013 to 2.032 mm (0.0005 to 0.080 in) in one source; typically 1.5 mm or less in the other.', ['WP_PCM', 'EFAB']) +
    pgP('The etchant also cuts sideways under the resist, so the artwork is compensated for it. Only flat parts can be made.', ['EFAB']) +
    pgP('The hardness of the metal does not matter.', ['WP_PCM']) +

    '<h2 id="pg-pol">Polishing, buffing, brushing</h2>' +
    pgP('<b>Polishing, then buffing.</b> Polishing is the coarser step, done with abrasive fixed to a belt, disc or wheel; it leaves a brushed surface with fine lines. Buffing follows with a cloth wheel and compound and takes those lines out to a bright finish.', ['PF', 'EMP', 'WP_POL']) +
    pgP('<b>Grit steps.</b> Start at 60 or 80, then 120, 180, 220 or 240, 320, 400 and finer.', ['WP_POL']) +
    pgP('Run each finer polishing step across the lines of the one before, at 90°. The coarsest surface a cut buff removes efficiently is a 320 to 400 grit line.', ['PF']) +
    pgP('<b>Cut buff, then colour buff.</b> The cut buff uses more pressure and takes out the polishing lines; the colour (finish) buff uses less pressure and brings up the lustre.', ['PF', 'EMP', 'WP_POL']) +
    pgP('One source adds the motion: for the cut, move the work against the rotation of the wheel; for colour, with it.', ['WP_POL']) +
    two(['Compound', 'Use'], PG_COMP) +
    pgP('The colour of the bar tells how abrasive the compound is, not the colour it leaves.', ['EMP']) +
    pgP('<b>Buffing wheels,</b> from the coarsest to the finest: sisal, spiral sewn, airway, loose sewn.', ['EMP']) +
    pgP('<b>Wheel speed,</b> in one source: about 7500 surface feet per minute for most work, about 4000 for muslin, felt and leather wheels.', ['WP_POL']) +
    pgP('<b>Electropolishing</b> removes metal electrochemically.', ['WP_POL']) +
    pgP('<b>Wire brushing</b> takes off what lies on the surface without removing base metal. The tips of the wires do the work: pressing harder bends the wires, and they break.', ['UA', 'WEIL']) +
    pgP('Thicker wire is more aggressive.', ['UA', 'WEIL']) +
    pgP('Use a stainless steel brush on stainless steel and on aluminium.', ['UA', 'WEIL']) +
    pgP('Knotted (twisted) wire hits hard and suits heavy work such as cleaning welds; crimped wire is flexible and suits light work such as rust and paint.', ['UA']) +
    pgP('Never use the same brush on carbon steel and on stainless steel. Choose the finest wire that does the job.', ['WEIL']) +
    pgP('Never run a brush above the top speed marked on it. The slowest speed that does the job is the most efficient.', ['UA']) +
    pgP('Honing, lapping, superfinishing and belts are in the <a href="#/t/abrasguide">abrasive processes guide</a>; roughness values are under <a href="#/t/surface">surface roughness</a>.', null) +

    '<h2 id="pg-conv">Conversion coatings</h2>' +
    pgP('<b>What it is.</b> The outer surface of the part itself is changed chemically into the coating. It is part of the metal, not a layer put on top as plating or paint is.', ['PCI']) +
    guideTable(['Coating', 'On what', 'What it gives'], PG_CONV, pgTags) +
    pgP('<b>Thickness.</b> Black oxide is usually under 2.5 µm thick.', ['EFUNDA']) +
    pgP('Phosphate is 5 to 15 µm thick, and a chromate coating on aluminium 0.25 to 1 µm.', ['PCI']) +
    pgP('A chromate coating on aluminium is a good base for paint and other later coatings.', ['EFUNDA', 'PL_FIN']) +
    pgP('<b>Passivation</b> of stainless steel removes the stray iron left by machining and leaves a very thin oxide layer.', ['PL_FIN']) +

    '<h2 id="pg-anod">Anodising</h2>' + pgAnod() +
    pgP('<b>How it is done.</b> The aluminium part is made the anode in an acid bath with direct current. Its surface turns into an oxide layer full of fine pores.', ['FIN']) +
    guideTable(['Type', 'Bath', 'Thickness, source by source'], PG_ANOD, pgTags) +
    pgP('<b>Growth.</b> About half of the coating grows into the metal and about half builds outward, so each surface moves out by about half the coating thickness.', ['GLECO', 'FIN', 'PCI']) +
    pgP('An outside diameter therefore grows by about one coating thickness and a bore closes by about the same. On a 60° thread the pitch diameter moves by about four times the growth of one surface.', ['GLECO']) +
    pgP('For threads see <a href="#/t/coating">plating and coating allowance on threads</a>.', null) +
    pgP('<b>Dye and seal.</b> Dye soaks into the pores before sealing, and sealing locks it in.', ['GLECO', 'FIN']) +
    pgP('Sealing can soften a hardcoat.', ['GLECO', 'FIN']) +
    pgP('A hardcoat meant for wear is left unsealed, and it can be ground or lapped to size.', ['GLECO']) +
    pgP('<b>The anodic layer</b> insulates electrically.', ['EFUNDA', 'GLECO']) +
    pgP('<b>Alloys.</b> The 2xxx and 7xxx alloys anodise less well than 1xxx, 5xxx and 6xxx; castings are difficult.', ['FIN']) +

    '<h2 id="pg-plate">Plating and thermal spraying</h2>' +
    '<h3 class="gcat">Chrome plating</h3>' +
    pgP('<b>Decorative chrome</b> is a thin layer of chromium over nickel, for looks and for protection against corrosion.', ['WP_CR', 'RICH']) +
    pgP('It is 0.05 to 0.5 µm thick, usually 0.13 to 0.25 µm.', ['WP_CR']) +
    pgP('<b>Hard chrome</b> is plated for wear resistance and low friction, on hydraulic piston rods for one, and it can build a worn surface back up.', ['WP_CR', 'RICH']) +
    pgP('<b>Hard chrome figures differ.</b> One source: usually 20 to 40 µm thick, 100 µm or more for extreme wear, 65 to 69 HRC. The other: 0.020 to 0.127 mm thick, 68 to 72 HRC.', ['WP_CR', 'RICH']) +
    pgP('Hard chrome does not level: flaws in the surface underneath show through larger. It is often plated over size and then ground or lapped. It builds at about 25 µm an hour.', ['WP_CR']) +
    pgP('Outside edges plate thicker than inside corners and holes.', ['WP_CR']) +
    '<h3 class="gcat">Zinc, cadmium and nickel</h3>' +
    pgP('<b>Zinc plating</b> protects iron and steel from rust.', ['PL_FIN', 'EPI']) +
    pgP('Zinc is not for parts that run above 500 °F, nor for marine use.', ['PL_FIN']) +
    pgP('<b>Cadmium</b> also keeps steel from rusting. Its own corrosion product is thin and not bulky.', ['EPI']) +
    pgP('<b>Nickel plating</b> resists corrosion, and bright nickel is the layer that goes under chrome.', ['PL_FIN', 'EPI', 'WP_CR']) +
    pgP('Bright nickel is 0.00005 to 0.001 in thick, depending on the current and the time in the tank.', ['PL_FIN']) +
    pgP('<b>Electroless nickel</b> is deposited chemically, with no electric current, as an alloy of nickel and phosphorus.', ['PL_EN', 'EPI']) +
    pgP('It plates evenly over the whole part, blind holes included.', ['PL_EN', 'EPI']) +
    pgP('Electroplating builds unevenly where the current density varies. Electroless nickel is typically 0.0001 to 0.001 in thick: allow for it on threads and close fits.', ['PL_EN']) +
    pgP('<b>Phosphorus content.</b> Low phosphorus is the hardest and wears best; high phosphorus resists corrosion best and is not magnetic. Heat treatment after plating can raise the hardness.', ['PL_EN']) +
    pgP('<b>Hydrogen embrittlement.</b> Steel harder than 35 HRC can be made brittle by plating. One source: bake it as soon as possible afterwards, at 191 °C (375 °F) for four hours.', ['EPI']) +
    '<h3 class="gcat">Thermal spraying</h3>' +
    pgP('<b>What it is.</b> The coating material, as wire, rod or powder, is melted and blown on to the surface by a gas.', ['WG_TS']) +
    pgP('<b>Processes:</b> flame spraying, arc spraying, plasma spraying, HVOF and detonation spraying.', ['TWI', 'WG_TS']) +
    pgP('<b>The bond is mechanical,</b> so the surface must be clean and rough: it is grit blasted, or sometimes machined, before spraying.', ['TWI', 'WG_TS']) +
    pgP('<b>Use.</b> Building worn parts back up.', ['TWI', 'WG_TS']) +
    pgP('Flame and arc spraying are the lower energy processes. Their coatings are fairly porous and are often sealed. They also put zinc and aluminium on steel structures against corrosion.', ['TWI']) +
    pgP('Plasma, HVOF and detonation spraying give much less porosity and a stronger bond, for severe wear and for oxidation at high temperature.', ['TWI']) +
    pgP('The spray reaches only what the gun can see, puts little heat into the part, and builds 0.001 to 0.1 in.', ['WG_TS']) +

    '<h2 id="pg-src">Sources</h2><ul class="gsl">' + Object.entries(PG_SOURCES).map(([k, v]) => '<li><b>' + k + '</b> ' + gesc(v) + '</li>').join('') + '</ul>' +
    '<p class="desc">Full URLs and access dates are in docs/sources.md, "Special processes and finishing guide". No text, figures or tables were copied from the sources.</p>';
  guideToc(el);
}
