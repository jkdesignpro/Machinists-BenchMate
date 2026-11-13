// Materials guide (parity MH50, MH60, MH62, MH63, MH64, MH65, ED51 to ED61, ED63, ED64, BB56; parts of MH53, MH54).
// All wording and drawings are BenchMate's own. Every statement carries the keys of the public sources read for
// it (docs/sources.md, "Materials guide"); one with fewer than two independent publishers is shown as "to be
// verified". Where two sources give different figures both are shown.
'use strict';

const MG_SOURCES = {
  ET: 'The Engineering ToolBox, "AISI/SAE steel and alloys: designation system" (engineeringtoolbox.com)',
  MD: 'Machine Design, "Unraveling the SAE/AISI index system for carbon and alloy steels"',
  WP_SAE: 'Wikipedia, "SAE steel grades" (CC BY-SA; the carbon and alloy steel table and the letters only)',
  MM_CS: 'Matmatch, article on carbon steel (matmatch.com/learn/material/carbon-steel)',
  TATA: 'Tata Steel DigECA, "Low, medium and high carbon steel: a complete guide"',
  EF_TS: 'eFunda, "Tool steels": the AISI designations (efunda.com)',
  TM_TS: 'Total Materia, article "Tool steels" (body text only; its table could not be read as printed)',
  MHCC: 'L. Hillyard, Metallurgy, chapter 7 "Tool steels" (Mt. Hood Community College open textbook, CC BY 4.0), 2024',
  OUT: 'Outokumpu, "The stainless steel family: introducing the different categories and grades", 2020',
  AALCO: 'Aalco, datasheet "Stainless steel: introduction"',
  ACME: 'Acme Foundry, "Cast iron metals compared: ductile vs gray iron, malleable vs white iron"',
  WP_CI: 'Wikipedia, "Cast iron" (CC BY-SA)',
  ESAB: 'ESAB University, "Understanding the aluminum alloy designation system"',
  HYDRO: 'Hydro (Shapes by Hydro), "A quick guide to understanding aluminium temper designations"',
  ALC: 'AlCircle blog, "Aluminium temper designations explained"',
  XOM_AL: 'Xometry, "How to read aluminum alloys and tempers"',
  TM_AL: 'Total Materia, article "Temper designation system for heat treatable aluminium alloys"',
  ROB: 'Righton Blackburns, datasheet "Aluminium alloy temper designations" (the H lines and the stress-relief codes only)',
  TM_CU: 'Total Materia, article "Temper designations for copper: wrought and cast"',
  NB: 'National Bronze Mfg., "What the temper designations of copper alloys really mean"',
  TM_TI: 'Total Materia, "Titanium grades"',
  OLM: 'Online Metals, "Understanding titanium"',
  TM_MG: 'Total Materia, article "Magnesium alloy and temper designations"',
  EF_MG: 'eFunda, "Magnesium alloys": designations and tempers (efunda.com)',
  XOM_NI: 'Xometry, "What is nickel alloy"',
  WI: 'White Industries, "Foundry tech: nickels and alloys"',
  DYN: 'Dynacast, "Zinc die casting metals" (dynacast.com)',
  ALD: 'Aludiecasting, "Zinc alloys for die casting" (names and aluminium content only)',
  MM_H: 'Matmatch, "Comparing hardness tests: Vickers, Rockwell, Brinell, Mohs, Shore and Knoop"',
  WEV: 'Wevolver, "Hardness testing of metals: Rockwell, Brinell, Vickers, Knoop and Leeb tests"',
  UNSW: 'UNSW Sydney, School of Materials Science and Engineering, online tutorial "Brinell, Vickers and Rockwell tests"',
  MST: 'Missouri S&T, class lesson "Hardness: equipment" (web.mst.edu/jthomas)',
  WA: 'Welding Advisers, "Hardness test" (welding-advisers.com)',
  AMPP: 'AMPP (formerly NACE), Corrosion basics, "Fontana\'s eight forms of corrosion"',
  TWI: 'TWI, frequently asked question "What is corrosion?"',
  PM: 'Projectmaterials blog, "EN 10204 2.1 vs 2.2 vs 3.1 vs 3.2"',
  WIP: 'What Is Piping, "What is a material test certificate (mill test certificate)?"',
  WP_HARD: 'Wikipedia, "Hardenability" (CC BY-SA)',
  CAM_JOM: 'H. K. D. H. Bhadeshia, "The Jominy end quench test" (phase-trans.msm.cam.ac.uk, University of Cambridge site)',
  TM_HT: 'Total Materia, article "Hardenability testing", June 2003',
  TM_SH: 'Total Materia, article "Surface hardening of steels", September 2003 (only the cells of its table that read cleanly)',
  OU_PNC: 'The Open University, OpenLearn Manupedia, "Plasma nitriding/carburising", 2018-03-09',
  OU_IFH: 'The Open University, OpenLearn Manupedia, "Induction/flame hardening", 2018-03-09',
  WP_CN: 'Wikipedia, "Carbonitriding" (CC BY-SA)',
  PAULO_CN: 'Paulo, "Case hardening basics: nitrocarburizing vs. carbonitriding", 2017-02-15',
  GS_IH: 'Gear Solutions, Hot Seat column, "Basic principles of induction hardening of steels"',
  WP_MACH: 'Wikipedia, "Machinability" (CC BY-SA)',
  INF_MACH: 'Infinita Lab, B. Raval, "Machining performance of ferrous metals: testing, factors & material properties", 2023-06-05, updated 2026-10-01',
  FRAC_SS: 'A. Velling, Fractory, "Stress-strain curve", 2020-06-03, updated 2026-08-19',
  WP_SS: 'Wikipedia, "Stress-strain curve" (CC BY-SA)',
  MATH_SS: 'MATHalino, "Stress-strain diagram" (mathalino.com)',
  TWI_TT: 'TWI, Job Knowledge 69, "Mechanical testing: tensile testing part 1"',
  TM_TEMP: 'Total Materia, article "Steel properties at low and high temperatures"',
  MAT_TEMP: 'N. Lewis and Materion Customer Technical Services, "In our element: how does temperature affect material properties?", 2024-01-01 (measured on a copper beryllium alloy)',
  AIMS_SG: 'AIMS Industrial, "Steel grades comparison", 2026-09-29 (a supplier)',
  CS_SG: 'Continental Steel & Tube, carbon and alloy steel grades page (a supplier; no date)',
  CRU_SEL: 'Crucible Industries, eSelector, "Selection of tool & die steels" (a maker of tool steels; crucible.com)',
  PL_TS: 'Protolabs, "Tool steel in manufacturing", 2025-09-11',
  NORP_FG: 'ILNorplex (Norplex-Micarta), "Laminate fabrication guide" (a maker of laminates)',
  PS_TS: 'M. Mush (Atlas Fibre), "Fabricating and cutting thermoset materials", The IAPD Magazine, 2015 (hosted by Polymershapes; prints the same figures as the Norplex guide, so it counts with it)',
  CTE_PH: 'B. Taylor, Cutting Tool Engineering, "Machining phenolic: dust, wear, and tooling guide", 2023-09-15',
  XOM_G10: 'G. Paulsen and J. Schadegg, Xometry, "Garolite machining", 2020-10-07, updated 2024-09-10',
  HAS_EB: 'P. N. Hasluck, Cassell\'s Cyclopaedia of Mechanics, "Turning and polishing ebonite and vulcanite" (early 1900s; chestofbooks.com)',
  ERP3: 'R. Ye, 3ERP blog, "CNC machining magnesium: benefits and safety tips", 2020-05-29, modified 2025-07-11',
  WAYKEN: 'WayKen blog, "Machining magnesium safely guide: risks and tips", 2023-08-04',
  LUX_MM: 'Luxfer MEL Technologies, knowledge hub, "Machining magnesium" (a magnesium alloy maker)',
  HUD_M2: 'Hudson Tool Steel, technical data "M2 high speed steel" (heat treating instructions)',
  SBSM_M2: 'SB Specialty Metals, data sheet "M2" (2022; the PDF layout is jumbled, read line by line)',
  TM_HSS: 'Total Materia, article "Heat treatment of high-speed steels", 2001, reviewed 2026',
  MF_SZ: 'P. Ulintz, "Sub-zero treatment of tool steels", MetalForming, March 2012, p. 50',
  ENC_DCT: 'P. Jovicevic-Klug and B. Podgornik, "Deep cryogenic treatment", Encyclopedia.pub (MDPI) entry 512',
  WP_HT: 'Wikipedia, "Heat treating" (CC BY-SA)',
  IITK: 'IIT Kanpur Virtual Labs, "Tailoring microstructure with various heat treatments (annealing, normalizing and quenching)", theory page',
  MHCC_F: 'L. Hillyard, Metallurgy, ch. 22 "Brittle" and ch. 25 "Fatigue resistance" (MHCC Library Press, CC BY 4.0, 2024)',
  ELEM_F: 'J. Dahman, Element Materials Technology, "Fatigue failure: how can you tell?", 2024-05-01',
  IMT_F: 'P. Lours and F. Baillon, IMT Mines Albi, SciMat course, "Crack initiation, propagation and failure analysis", 2024-03-19',
  OWN: 'BenchMate reading of the rule in the sources beside it',
};
// Several pages of one publisher count once.
const MG_FAMILY = {
  TM_TS: 'TOTALMAT', TM_AL: 'TOTALMAT', TM_CU: 'TOTALMAT', TM_TI: 'TOTALMAT', TM_MG: 'TOTALMAT',
  MM_CS: 'MATMATCH', MM_H: 'MATMATCH', XOM_AL: 'XOMETRY', XOM_NI: 'XOMETRY', EF_TS: 'EFUNDA', EF_MG: 'EFUNDA', WP_SAE: 'WIKI', WP_CI: 'WIKI',
  WP_HARD: 'WIKI', WP_CN: 'WIKI', WP_MACH: 'WIKI', TM_HT: 'TOTALMAT', TM_SH: 'TOTALMAT', OU_PNC: 'OU', OU_IFH: 'OU',
  WP_SS: 'WIKI', TWI_TT: 'TWI', TM_TEMP: 'TOTALMAT', TM_HSS: 'TOTALMAT', WP_HT: 'WIKI', MHCC_F: 'MHCC', XOM_G10: 'XOMETRY', NORP_FG: 'NORPLEX', PS_TS: 'NORPLEX',
};
const mgTags = keys => guideTags(keys, MG_SOURCES, MG_FAMILY);
const mgP = (html, keys) => '<p>' + html + (keys === null ? '' : ' ' + mgTags(keys)) + '</p>';

// A steel number and an aluminium temper taken apart.
function mgNumber() {
  const box = (x, w, t, fill) => (fill ? '<path class="gfill" d="M' + x + ' 30H' + (x + w) + 'V66H' + x + 'Z"/>' : '') + '<path class="gp" d="M' + x + ' 30H' + (x + w) + 'V66H' + x + 'Z"/>' + cnT(x + w / 2, 53, t, 'gv', 'middle');
  const under = (cx, lines) => lines.map((t, i) => cnT(cx, 86 + 14 * i, t, 'gs', 'middle')).join('');
  return cnSvg(490, 136,
    cnT(114, 18, 'steel: 4140', 'gs', 'middle') + box(30, 80, '41', true) + box(118, 80, '40', false) +
    under(70, ['family:', 'chromium-', 'molybdenum']) + under(158, ['carbon:', 'about 0.40 %']) +
    cnT(364, 18, 'aluminium: 6061-T651', 'gs', 'middle') + box(262, 70, '6061', true) + box(338, 56, 'T6', false) + box(400, 66, '51', false) +
    under(297, ['alloy:', 'magnesium', 'and silicon']) + under(366, ['solution', 'treated,', 'aged']) + under(433, ['stretched', 'to relieve', 'stress']),
    'Two designations taken apart. Steel 4140: 41 is the chromium-molybdenum family and 40 is about 0.40 per cent carbon. Aluminium 6061-T651: 6061 is a magnesium and silicon alloy, T6 is solution heat treated and artificially aged, 51 is stress relieved by stretching');
}
// A stress-strain curve of a ductile metal (schematic, not to scale).
function mgCurve() {
  const dot = (x, y) => '<circle class="gfill" cx="' + x + '" cy="' + y + '" r="3.5"/><circle class="gp" cx="' + x + '" cy="' + y + '" r="3.5"/>';
  return cnSvg(480, 230,
    '<path class="gm" d="M60 20V200H455"/>' + cnT(60, 13, 'stress', 'gs', 'middle') + cnT(455, 218, 'strain', 'gs', 'end') +
    '<path class="gc" d="M60 86H133M60 46H300"/>' +
    '<path class="gp" d="M60 200L130 90C150 60 230 46 300 46C350 46 380 56 400 72"/>' +
    dot(133, 86) + dot(300, 46) + '<path class="gp" d="M394 66L406 78M406 66L394 78"/>' +
    cnT(150, 150, 'straight line: elastic,', 'gs') + cnT(150, 164, 'slope = Young\'s modulus', 'gs') +
    cnT(54, 90, 'yield', 'gs', 'end') + cnT(54, 50, 'tensile', 'gs', 'end') + cnT(54, 62, 'strength', 'gs', 'end') +
    cnT(240, 100, 'plastic: the stretch stays', 'gs', 'middle') + cnT(352, 92, 'necking', 'gs', 'middle') + cnT(412, 76, 'fracture', 'gs'),
    'A stress-strain curve for a ductile metal, not to scale: a straight elastic line up to the yield point, a rising curve to the tensile strength, then necking and fracture');
}
// How the carbon sits in three cast irons (schematic).
function mgIron() {
  const pan = x => '<path class="gfill" d="M' + x + ' 20H' + (x + 100) + 'V90H' + x + 'Z"/><path class="gp" d="M' + x + ' 20H' + (x + 100) + 'V90H' + x + 'Z"/>';
  const flakes = [[38, 36, 12, -8, 24, 2], [70, 30, 10, 10, 24, 4], [100, 46, 8, -10, 22, -4], [36, 60, 14, 6, 26, -4], [68, 56, 12, -6, 22, 6], [96, 72, 10, -8, 26, 0], [44, 80, 10, -6, 22, 0], [76, 80, 8, 6, 18, 2]];
  const nods = [[198, 38], [230, 32], [262, 42], [210, 60], [244, 58], [266, 76], [196, 80], [228, 80]];
  const plates = [[340, 32, 26, 8], [376, 28, 30, -2], [338, 52, 22, -6], [368, 50, 34, 10], [412, 44, 12, 18], [342, 74, 30, 4], [382, 72, 26, -8], [414, 76, 12, 6]];
  return cnSvg(460, 130,
    pan(30) + flakes.map(f => '<path class="gw" d="M' + f[0] + ' ' + f[1] + 'q' + f[2] + ' ' + f[3] + ' ' + f[4] + ' ' + f[5] + '"/>').join('') +
    pan(180) + nods.map(n => '<circle class="gw" cx="' + n[0] + '" cy="' + n[1] + '" r="5"/>').join('') +
    pan(330) + plates.map(p => '<path class="gw" d="M' + p[0] + ' ' + p[1] + 'l' + p[2] + ' ' + p[3] + 'l2 5l' + (-p[2]) + ' ' + (-p[3]) + 'Z"/>').join('') +
    cnT(80, 108, 'grey iron', 'gv', 'middle') + cnT(80, 123, 'graphite flakes', 'gs', 'middle') +
    cnT(230, 108, 'ductile iron', 'gv', 'middle') + cnT(230, 123, 'graphite nodules', 'gs', 'middle') +
    cnT(380, 108, 'white iron', 'gv', 'middle') + cnT(380, 123, 'iron carbide', 'gs', 'middle'),
    'Schematic of how the carbon sits in cast iron: as graphite flakes in grey iron, as round graphite nodules in ductile iron, and combined as iron carbide in white iron');
}
// Four indenters from the side and the impression each one leaves.
function mgIndent() {
  const head = (cx, a, b) => cnT(cx, 14, a, 'gv', 'middle') + cnT(cx, 28, b, 'gs', 'middle');
  const tip = (cx, hw, top) => '<path class="gfill" d="M' + (cx - 12) + ' 44H' + (cx + 12) + 'V' + top + 'H' + (cx + hw) + 'L' + cx + ' 92L' + (cx - hw) + ' ' + top + 'H' + (cx - 12) + 'Z"/>' +
    '<path class="gp" d="M' + (cx - 12) + ' 44H' + (cx + 12) + 'V' + top + 'H' + (cx + hw) + 'L' + cx + ' 92L' + (cx - hw) + ' ' + top + 'H' + (cx - 12) + 'Z"/>';
  return cnSvg(500, 170,
    '<path class="gm" d="M10 89H490"/>' +
    head(62, 'Brinell', 'ball') + '<circle class="gfill" cx="62" cy="67" r="24"/><circle class="gp" cx="62" cy="67" r="24"/>' +
    '<circle class="gp" cx="62" cy="126" r="13"/><path class="gc" d="M49 126H75"/>' + cnT(62, 160, 'diameter', 'gs', 'middle') +
    head(187, 'Rockwell', 'cone or ball') + tip(187, 34, 72) +
    '<circle class="gp" cx="187" cy="126" r="7"/><path class="gc" d="M226 89V93M221 89H231M221 93H231"/>' + cnT(187, 160, 'depth', 'gs', 'middle') +
    head(312, 'Vickers', '136° pyramid') + tip(312, 34, 78) +
    '<path class="gp" d="M312 110L328 126L312 142L296 126Z"/><path class="gc" d="M296 126H328M312 110V142"/>' + cnT(312, 160, 'two diagonals', 'gs', 'middle') +
    head(437, 'Knoop', 'long pyramid') + tip(437, 40, 82) +
    '<path class="gp" d="M407 126L437 120L467 126L437 132Z"/><path class="gc" d="M407 126H467"/>' + cnT(437, 160, 'long diagonal', 'gs', 'middle'),
    'Four hardness indenters seen from the side, each with the impression it leaves and what is measured: Brinell ball and the diameter of a round impression, Rockwell cone or ball and the depth, Vickers 136 degree pyramid and the two diagonals of a square impression, Knoop long pyramid and the long diagonal');
}

const MG_STEEL = [
  ['10xx', 'plain carbon', 'manganese 1.00 % at most', ['ET', 'WP_SAE']],
  ['11xx', 'free machining, resulphurized', 'no figure given', ['ET', 'WP_SAE', 'MD']],
  ['12xx', 'free machining, resulphurized and rephosphorized', 'no figure given', ['ET', 'WP_SAE', 'MD']],
  ['13xx', 'manganese', 'Mn 1.75 %', ['ET', 'WP_SAE']],
  ['15xx', 'plain carbon with more manganese', 'Mn 1.00 to 1.65 %', ['ET', 'WP_SAE']],
  ['23xx', 'nickel', 'Ni 3.50 %', ['ET', 'WP_SAE', 'MD']],
  ['31xx', 'nickel-chromium', 'Ni 1.25 %, Cr 0.65 to 0.80 % (a third source: 0.60 %)', ['ET', 'WP_SAE', 'MD']],
  ['40xx', 'molybdenum', 'Mo 0.20 to 0.25 %', ['ET', 'WP_SAE']],
  ['41xx', 'chromium-molybdenum', 'Cr 0.50 to 0.95 %, Mo 0.12 to 0.30 %', ['ET', 'WP_SAE']],
  ['43xx', 'nickel-chromium-molybdenum', 'Ni 1.82 %, Cr 0.50 to 0.80 %, Mo 0.25 %', ['ET', 'WP_SAE']],
  ['46xx', 'nickel-molybdenum', 'Ni 0.85 to 1.82 %, Mo 0.20 to 0.25 %', ['ET', 'WP_SAE']],
  ['51xx', 'chromium', 'Cr 0.80 to 1.05 %', ['ET', 'WP_SAE']],
  ['52xxx', 'chromium with 1.00 % carbon or more', 'Cr 1.45 %', ['ET', 'WP_SAE']],
  ['61xx', 'chromium-vanadium', 'Cr 0.60 to 0.95 %, V 0.10 to 0.15 %', ['ET', 'WP_SAE']],
  ['86xx', 'nickel-chromium-molybdenum', 'Ni 0.55 %, Cr 0.50 %, Mo 0.20 %', ['ET', 'WP_SAE']],
  ['92xx', 'silicon-manganese', 'Si 1.40 to 2.00 %, Mn 0.65 to 0.85 %', ['ET', 'WP_SAE']],
  ['93xx', 'nickel-chromium-molybdenum', 'Ni 3.25 %, Cr 1.20 %, Mo 0.12 %', ['ET', 'WP_SAE']],
];
const MG_TOOL = [
  ['W', 'water hardening', 'W1: hand cutting tools, taps, reamers', ['EF_TS', 'TM_TS', 'MHCC']],
  ['S', 'shock resisting', 'S2: chisels, hammers, repeated hard blows', ['EF_TS', 'MHCC']],
  ['O', 'oil hardening, cold work', 'O1: short-run blanking and forming dies, cutting tools', ['EF_TS', 'TM_TS', 'MHCC']],
  ['A', 'air hardening, medium alloy, cold work', 'A2: dies and slitters', ['EF_TS', 'TM_TS', 'MHCC']],
  ['D', 'high carbon, high chromium, cold work', 'D2: long-run blanking, forming and thread rolling dies', ['EF_TS', 'MHCC']],
  ['H', 'hot work', 'H11', ['EF_TS', 'MHCC']],
  ['T', 'high speed, tungsten', 'T4: cutting tools, broaches', ['EF_TS', 'MHCC']],
  ['M', 'high speed, molybdenum', 'M1: like the T steels at lower cost', ['EF_TS', 'MHCC']],
  ['P', 'mould steels', 'none read', ['EF_TS']],
  ['L', 'low alloy', 'none read', ['EF_TS']],
  ['F', 'carbon-tungsten', 'none read', ['EF_TS']],
];
const MG_STAIN = [
  ['Ferritic', 'chromium with little or no nickel', 'yes', 'exhaust systems, appliances, kitchen ware', ['OUT', 'AALCO']],
  ['Martensitic', 'more carbon; hardened by heat treatment; strong and wear resistant, poor to weld', 'yes', 'knives, shafts', ['OUT', 'AALCO']],
  ['Austenitic', 'chromium and nickel, about 18 % and 8 % in the common type; forms and welds well', 'no when annealed; cold work can make some grades magnetic', 'food and kitchen equipment, process plant, architecture', ['OUT', 'AALCO']],
  ['Duplex', 'a mix of ferrite and austenite; high strength', 'yes', 'oil and gas, desalination, chemical plant', ['OUT', 'AALCO']],
  ['Precipitation hardening', 'hardened by a treatment that forms precipitates in the structure', 'yes (one source)', 'high-strength mechanical parts (one source)', ['OUT', 'AALCO']],
];
const MG_IRON = [
  ['Grey', 'graphite flakes', 'damps vibration and machines easily, but is brittle and weak in tension', 'engine blocks, machine bases', ['ACME', 'WP_CI']],
  ['Ductile (nodular)', 'round graphite nodules', 'strong and tough, without the weakness the flakes bring', 'crankshafts, gears, pipes', ['ACME', 'WP_CI']],
  ['White', 'iron carbide, with no free graphite', 'very hard and wear resistant, brittle', 'mill liners, pump impellers', ['ACME', 'WP_CI']],
  ['Malleable', 'compact graphite, made by heat treating white iron', 'ductile and tough, close to mild steel', 'small castings such as pipe fittings (one source)', ['ACME', 'WP_CI']],
];
const MG_ALSER = [
  ['1xxx', 'none: 99 % aluminium or more', 'no', ['ESAB', 'XOM_AL']],
  ['2xxx', 'copper', 'yes', ['ESAB', 'XOM_AL']],
  ['3xxx', 'manganese', 'no', ['ESAB', 'XOM_AL']],
  ['4xxx', 'silicon', 'sources differ: one says some are, the other says no', ['ESAB', 'XOM_AL']],
  ['5xxx', 'magnesium', 'no', ['ESAB', 'XOM_AL']],
  ['6xxx', 'magnesium and silicon', 'yes', ['ESAB', 'XOM_AL']],
  ['7xxx', 'zinc', 'yes', ['ESAB', 'XOM_AL']],
  ['8xxx', 'other elements', 'not stated', ['ESAB']],
];
const MG_TEMPER = [
  ['F', 'as fabricated: no special control of the hardening', ['ESAB', 'HYDRO', 'ALC', 'XOM_AL']],
  ['O', 'annealed: the softest and most ductile condition', ['ESAB', 'HYDRO', 'ALC', 'XOM_AL']],
  ['H', 'strain hardened, that is cold worked; digits follow', ['ESAB', 'HYDRO', 'ALC', 'XOM_AL']],
  ['W', 'solution heat treated and still ageing at room temperature: an unstable condition, rarely a finished temper', ['ESAB', 'HYDRO', 'ALC', 'TM_AL']],
  ['T', 'heat treated to a stable temper; digits follow', ['ESAB', 'HYDRO', 'ALC']],
];
const MG_T = [
  ['T1', 'cooled from hot shaping (such as extrusion), naturally aged', ['ESAB', 'HYDRO', 'ALC', 'XOM_AL']],
  ['T2', 'cooled from hot shaping, cold worked, naturally aged', ['ESAB', 'HYDRO', 'ALC', 'XOM_AL']],
  ['T3', 'solution heat treated, cold worked, naturally aged', ['ESAB', 'HYDRO', 'ALC', 'XOM_AL']],
  ['T4', 'solution heat treated, naturally aged', ['ESAB', 'HYDRO', 'ALC', 'XOM_AL']],
  ['T5', 'cooled from hot shaping, artificially aged', ['ESAB', 'HYDRO', 'ALC', 'XOM_AL']],
  ['T6', 'solution heat treated, artificially aged', ['ESAB', 'HYDRO', 'ALC', 'XOM_AL']],
  ['T7', 'solution heat treated, overaged (stabilised)', ['ESAB', 'HYDRO', 'ALC', 'XOM_AL']],
  ['T8', 'solution heat treated, cold worked, artificially aged', ['ESAB', 'HYDRO', 'ALC', 'XOM_AL']],
  ['T9', 'solution heat treated, artificially aged, cold worked', ['ESAB', 'HYDRO', 'ALC', 'XOM_AL']],
  ['T10', 'cooled from hot shaping, cold worked, artificially aged', ['ESAB', 'HYDRO', 'ALC', 'XOM_AL']],
];
const MG_CUCLASS = [
  ['O', 'annealed to meet mechanical properties', ['TM_CU', 'NB']],
  ['OS', 'annealed to a stated grain size', ['TM_CU', 'NB']],
  ['H', 'cold worked', ['TM_CU', 'NB']],
  ['HR', 'cold worked and stress relieved', ['TM_CU', 'NB']],
  ['M', 'as manufactured: cast or hot worked', ['TM_CU', 'NB']],
  ['T (TB, TD, TF, TH and others)', 'heat treated', ['TM_CU', 'NB']],
  ['W (WM, WH, WR)', 'welded tube', ['TM_CU', 'NB']],
];
const MG_CUH = [
  ['H00', '1/8 hard', ['TM_CU', 'NB']], ['H01', '1/4 hard', ['TM_CU', 'NB']], ['H02', '1/2 hard', ['TM_CU', 'NB']], ['H03', '3/4 hard', ['TM_CU', 'NB']],
  ['H04', 'hard', ['TM_CU', 'NB']], ['H06', 'extra hard', ['TM_CU', 'NB']], ['H08', 'spring', ['TM_CU', 'NB']], ['H10', 'extra spring', ['TM_CU', 'NB']],
];
const MG_NI = [
  ['Nickel-copper', 'Monel', 'sea water and brine', ['XOM_NI', 'WI']],
  ['Nickel-chromium, often with iron', 'Inconel', 'heat and oxidation', ['XOM_NI', 'WI']],
  ['Nickel-molybdenum', 'Hastelloy', 'strong acids', ['XOM_NI', 'WI']],
  ['Nickel-chromium-molybdenum', 'several', 'heat and corrosion together, as in chemical plant', ['XOM_NI', 'WI']],
];
const MG_HARD = [
  ['Brinell', 'hard ball, 10 mm', '3000 kgf on steel and iron, 500 kgf on softer metals', 'diameter of the round impression', 'castings and forgings; leaves a large mark', ['UNSW', 'MST', 'WEV', 'MM_H', 'WA']],
  ['Rockwell', '120 degree diamond cone, or a 1/16 in ball', '10 kgf minor load, then 60, 100 or 150 kgf', 'depth of the impression, read directly', 'quick checks in the shop', ['MST', 'WA', 'WEV', 'MM_H']],
  ['Vickers', 'square diamond pyramid, 136 degrees between opposite faces', 'from a few grams to about 100 kgf', 'both diagonals of the square impression', 'thin sections and small parts, soft or hard', ['MST', 'WA', 'WEV']],
  ['Knoop', 'long, narrow diamond pyramid', '1 kgf or less', 'the long diagonal', 'thin layers, coatings, brittle materials', ['WEV', 'MM_H']],
  ['Leeb (rebound)', 'carbide ball fired at the surface', 'an impact, not a load', 'rebound speed against impact speed', 'large parts tested where they stand', ['WEV']],
  ['Shore (durometer)', 'spring-loaded pin', 'a spring', 'how far the pin sinks, on a scale of 0 to 100', 'rubber and plastics: scale A soft, scale D hard', ['MM_H', 'WEV']],
  ['Mohs', 'none: a scratch test', 'none', 'which of ten minerals scratches it, from 1 talc to 10 diamond', 'minerals; coarse', ['MM_H']],
];
const MG_CORR = [
  ['Uniform', 'even attack over the whole surface; the commonest form', ['AMPP', 'TWI']],
  ['Galvanic', 'two different metals joined in a conducting liquid: the more active one corrodes faster', ['AMPP', 'TWI']],
  ['Crevice', 'local attack in shielded gaps where liquid sits still, as under washers and bolt heads', ['AMPP', 'TWI']],
  ['Pitting', 'very local attack that bores holes into the metal; hard to find', ['AMPP', 'TWI']],
  ['Intergranular', 'attack along the grain boundaries, which weakens the metal while the grains are hardly touched', ['AMPP', 'TWI']],
  ['Stress corrosion cracking', 'cracks that grow when tensile stress and a particular corrosive surrounding act together', ['AMPP', 'TWI']],
  ['Selective leaching', 'one element is taken out of an alloy, as zinc out of brass', ['AMPP']],
  ['Erosion corrosion', 'faster attack where a corrosive fluid moves over the surface', ['AMPP']],
];
const MG_CERT = [
  ['2.1', 'declaration of compliance with the order', 'none', 'the manufacturer', ['PM', 'WIP']],
  ['2.2', 'test report', 'yes, from non-specific inspection: the same grade, not necessarily the batch delivered', 'the manufacturer', ['PM', 'WIP']],
  ['3.1', 'inspection certificate 3.1', 'yes; one source says in terms that they are from the delivered product', 'the manufacturer\'s authorised inspection representative, independent of production', ['PM', 'WIP']],
  ['3.2', 'inspection certificate 3.2', 'yes, as 3.1', 'as 3.1, and countersigned by an independent or purchaser\'s inspector', ['PM', 'WIP']],
];

// Uses of common carbon and alloy steels as two suppliers list them.
const MG_USE = [
  ['A36', '-', 'General construction and structural uses', ['CS_SG']],
  ['1018, 1020', '1020: structural sections, case-hardened parts', '1018, with the 1006 to 1050 series: machining, cold-finished products', ['AIMS_SG', 'CS_SG']],
  ['1045', 'Shafts, axles, gears, couplings', 'With the 1006 to 1050 series: machining, cold-finished products', ['AIMS_SG', 'CS_SG']],
  ['12L14, 1215, 1144', '-', 'Free-machining steels for precision components', ['CS_SG']],
  ['4130, 4140', '4140: hydraulic shafts, gears, bolts and studs, axles, crankshafts, mining equipment', '4130, 4140, 4142: aircraft parts, gears, shafts', ['AIMS_SG', 'CS_SG']],
  ['4340', 'Crankshafts, heavy-duty axles, aircraft parts', '4330, 4340: aerospace, defence, high-stress parts', ['AIMS_SG', 'CS_SG']],
  ['5160, 6150', '-', 'Springs, automotive components', ['CS_SG']],
  ['8620', 'Gears, camshafts, sprockets', '8620, 8630: case-hardened parts', ['AIMS_SG', 'CS_SG']],
  ['9310', '-', '8740, 9310: gears, shafts, aircraft components', ['CS_SG']],
  ['52100', '-', 'Bearings, precision components', ['CS_SG']],
];
// Case hardening processes: each cell names who prints the figure. Micrometres in the source are written here in mm.
const MG_CASE = [
  ['Carburising', 'Carbon diffuses into the surface of a low-carbon steel', 'Total Materia: 815 to 980 °C in gas or liquid, up to 1090 °C in a pack. Open University (plasma): usually below 950 °C', 'Total Materia: up to 1.5 mm. Open University: 0.2 to 2 mm', ['TM_SH', 'OU_PNC']],
  ['Carbonitriding', 'Carbon and nitrogen together, for cheap low-carbon steels that would not harden well otherwise', 'Total Materia: 760 to 870 °C. Wikipedia: around 850 °C. Paulo: around 1600 °F', 'Total Materia: 0.075 to 0.75 mm. Wikipedia: typically 0.07 to 0.5 mm, 0.75 mm at most', ['TM_SH', 'WP_CN', 'PAULO_CN']],
  ['Nitriding', 'Nitrogen forms hard nitrides in an alloy steel', 'Total Materia: 480 to 590 °C in gas. Open University (plasma): usually below 550 °C', 'Total Materia: up to 0.75 mm', ['TM_SH', 'OU_PNC']],
  ['Ferritic nitrocarburising', 'Nitrogen and carbon at a temperature too low to change the structure of the steel', '975 to 1125 °F', 'Shallower than carbonitriding', ['PAULO_CN']],
  ['Induction hardening', 'A coil induces eddy currents that heat the surface in seconds; a spray or a bath quenches it', 'no figure in the sources read', 'Open University: 0.1 to 10 mm for induction and flame together', ['GS_IH', 'OU_IFH']],
  ['Flame hardening', 'Oxy-fuel burners heat the surface, which is then quenched', 'no figure in the sources read', 'Open University: 0.1 to 10 mm for induction and flame together', ['OU_IFH', 'TM_SH']],
];

// ---------- 0.8.0: high speed steel, terms ----------
// M2 as two makers print it; side by side, never merged. Fahrenheit as printed, Celsius converted.
const MG_M2 = [
  ['Anneal', '829 to 843 C (1525 to 1550 F), 1 h per inch (2 h least); furnace cool at most 50 F per hour to 538 C (1000 F); 248 HBW or less', '871 C (1600 F) for 2 h; cool 25 F per hour to 538 C (1000 F); 215 to 255 HB', ['HUD_M2', 'SBSM_M2']],
  ['Preheat', '788 to 843 C (1450 to 1550 F); large or complex tools first equalised at 593 C (1100 F)', '816 to 843 C (1500 to 1550 F), equalise', ['HUD_M2', 'SBSM_M2']],
  ['Harden (austenitize)', 'Cutting tools, furnace: 1204 to 1232 C (2200 to 2250 F); salt 1191 to 1218 C. For toughness without hot hardness: 1175 to 1191 C', '1149 to 1218 C (2100 to 2225 F), soak 5 to 10 min; high side and longer soak in vacuum', ['HUD_M2', 'SBSM_M2']],
  ['Quench', 'Pressurized gas, fast to below 538 C; or warm oil until black (about 482 C), then still air; or salt at 538 to 593 C, then air to 51 to 66 C', 'Vacuum, at least 50 F per minute to below 538 C; or salt at 538 to 593 C, then air to 66 C', ['HUD_M2', 'SBSM_M2']],
  ['Temper', 'Straight after the quench; 552 to 566 C (1025 to 1050 F), 2 h, air cool. Double temper required, triple for large sections and wire EDM blanks', 'Straight after the quench; at least 538 C (1000 F); cool to room temperature between tempers. Double required, triple recommended', ['HUD_M2', 'SBSM_M2']],
];
const MG_TERMS = [
  ['Austenite', 'The form of steel above its upper critical temperature. Every hardening treatment starts from it.', ['WP_HT', 'IITK']],
  ['Ferrite', 'Soft, ductile iron; more of it makes a steel more ductile.', ['WP_HT']],
  ['Cementite', 'Hard iron carbide. It is the hard part of pearlite and forms a network at the grain boundaries of high carbon steel if cooled wrongly.', ['WP_HT', 'IITK']],
  ['Pearlite', 'Thin alternate layers of ferrite and cementite, formed from austenite on slow cooling. Slow cooling gives coarse, softer pearlite; faster cooling fine, harder pearlite.', ['WP_HT', 'IITK']],
  ['Bainite', 'Forms between the speeds (or temperatures) that give pearlite and those that give martensite.', ['WP_HT', 'IITK']],
  ['Martensite', 'The hard, brittle structure made when austenite is cooled fast (quenched). Brittle and prone to cracking until it is tempered.', ['WP_HT', 'IITK', 'MF_SZ']],
  ['Retained austenite', 'Austenite left over after the quench. High carbon, high alloy steels keep a lot of it: 20 to 40 % in high speed steel by one source. Tempering or cold treatment turns it to martensite.', ['TM_HSS', 'MF_SZ']],
  ['Annealing (full)', 'Heat above the upper critical temperature and cool very slowly in the furnace: soft, coarse pearlite that cold works and machines easily.', ['WP_HT', 'IITK']],
  ['Normalizing', 'Heat above the upper critical temperature and cool in still air: finer, more even grain, harder and stronger than annealed but less ductile.', ['WP_HT', 'IITK']],
  ['Spheroidizing', 'A long soak just below the lower critical temperature that turns the cementite plates into small balls. Makes high carbon steel more ductile before it is hardened.', ['IITK', 'WP_HT']],
  ['Stress relieving', 'Heat below the lower critical temperature and cool evenly to take out stress from welding, cold work or rough machining.', ['WP_HT', 'SBSM_M2']],
  ['Quenching', 'Fast cooling from above the critical temperature in water, brine, oil, polymer or gas. Hardens steel (martensite); most non-ferrous alloys are softened by it instead.', ['WP_HT', 'IITK']],
  ['Tempering', 'Reheating hardened steel below the lower critical temperature to trade some hardness for toughness. The hotter, the tougher and softer.', ['WP_HT', 'IITK']],
  ['Solution treatment and ageing', 'Dissolve the alloying elements by heating, quench to keep them dissolved, then age at room temperature (natural) or in an oven (artificial) so fine particles form and strengthen it: 2xxx, 6xxx and 7xxx aluminium (T4, T6), maraging steel.', ['WP_HT', 'HYDRO']],
  ['Case hardening', 'Carbon or nitrogen diffused into the surface: a hard, wear resistant skin on a tough core. See Case hardening above.', ['WP_HT']],
  ['Decarburization', 'Loss of carbon from the surface of hot steel in an oxidising atmosphere: a soft skin that will not harden.', ['WP_HT']],
];

function renderMatGuide(el) {
  const toc = [['mg-steel', 'Steel numbers'], ['mg-tool', 'Tool steels'], ['mg-stain', 'Stainless'], ['mg-iron', 'Cast iron'], ['mg-alu', 'Aluminium'], ['mg-cu', 'Copper tempers'], ['mg-other', 'Titanium, magnesium, nickel, zinc'], ['mg-hard', 'Hardness tests'], ['mg-harden', 'Hardenability'], ['mg-case', 'Case hardening'], ['mg-mach', 'Machinability'], ['mg-tens', 'Tensile test'], ['mg-temp', 'Heat and cold'], ['mg-use', 'Steels by use'], ['mg-lam', 'Laminates and hard rubber'], ['mg-corr', 'Corrosion'], ['mg-cert', 'Mill certificates'], ['mg-nonfe', 'Machining magnesium'], ['mg-hss', 'High speed steel heat treatment'], ['mg-terms', 'Metallurgy terms'], ['mg-fail', 'How metals fail']];
  el.innerHTML =
    '<nav class="gtoc">' + toc.map(([a, t]) => '<a href="#' + a + '">' + t + '</a>').join('') + '</nav>' +
    '<p class="desc">How to read what is stamped on the bar and printed on the certificate: steel numbers, tool steel letters, stainless and cast iron families, aluminium and copper tempers, the names of titanium, magnesium, nickel and zinc alloys, how each hardness test works, the forms of corrosion, and the mill certificate, in our own words. Every statement was checked against public sources: they are listed under Sources at the bottom, where you can also show the source keys beside each statement. <span class="gtbv">to be verified</span> marks a statement not yet confirmed by two independent publishers.</p>' +

    '<h2 id="mg-steel">Carbon and alloy steel numbers (SAE and AISI)</h2>' + mgNumber() +
    mgP('<b>Four digits.</b> The first two name the family of steel and the last two give the carbon content in hundredths of a per cent.', ['ET', 'MD', 'WP_SAE']) +
    mgP('<b>Examples as the sources give them.</b> 1020 is a plain carbon steel with about 0.20 % carbon, 1060 one with 0.60 %, 5130 a chromium steel with about 0.30 % and 4340 a nickel-chromium-molybdenum steel with about 0.40 %.', ['ET', 'WP_SAE', 'MD']) +
    mgP('<b>First digit.</b> 1 carbon, 2 nickel, 3 nickel-chromium, 4 molybdenum, 5 chromium, 6 chromium-vanadium, 8 nickel-chromium-molybdenum, 9 silicon-manganese. The 9 series also holds nickel-chromium-molybdenum steels such as 93xx, so read the first two digits together.', ['MD', 'ET']) +
    '<p class="desc">Common series, with the nominal alloy content as two tables give it:</p>' + guideTable(['Series', 'Family', 'Main alloy content'], MG_STEEL, mgTags) +
    mgP('<b>A letter in the middle.</b> L means lead added to make the steel machine better, as in 12L14. B means boron added for hardenability, 0.0005 to 0.003 %.', ['MD', 'WP_SAE']) +
    mgP('<b>Lead content.</b> One source gives the lead as 0.15 to 0.35 %.', ['MD']) +
    mgP('<b>H at the end.</b> The steel is supplied to a hardenability requirement, measured on an end-quench test, with looser limits on its chemistry.', ['WP_SAE']) +
    mgP('<b>Low, medium and high carbon.</b> The boundaries differ by source. Low carbon: under 0.25 % in one, 0.05 to 0.30 % in the other. Medium: 0.25 to 0.60 % or 0.30 to 0.60 %. High: 0.60 to 1.25 % or 0.60 to 1.40 %.', ['MM_CS', 'TATA']) +
    mgP('<b>Low carbon steel</b> welds and forms easily and hardly responds to hardening by heat treatment.', ['MM_CS', 'TATA']) +
    mgP('<b>Medium carbon steel</b> can be quenched and tempered. It is the steel of shafts, axles, gears and crankshafts.', ['MM_CS', 'TATA']) +
    mgP('<b>High carbon steel</b> is the hardest and the least ductile: springs, cutting tools and high-strength wire.', ['MM_CS', 'TATA']) +
    mgP('<b>Welding and machining high carbon steel.</b> It welds poorly, with a high risk of cracking, and is hard to machine.', ['TATA']) +
    mgP('Compositions and equivalent grades are in <a href="#/t/materials">material equivalents</a>; hardening and tempering temperatures are in the <a href="#/t/heattreat">heat treatment reference</a>.', null) +

    '<h2 id="mg-tool">Tool steel letters</h2>' +
    mgP('<b>The letter is the group.</b> A tool steel is named by a letter for its group and a number within it.', ['EF_TS', 'MHCC']) +
    guideTable(['Letter', 'Group', 'Example and use'], MG_TOOL, mgTags) +
    mgP('<b>W, O and A name the quench:</b> water, oil and air. Water is the most severe quench and air the gentlest.', ['TM_TS', 'MHCC']) +
    mgP('<b>Carbon.</b> Tool steels hold between 0.5 and 1.5 % carbon.', ['MHCC']) +
    mgP('<b>Hardness of the examples.</b> W1 50 to 64 HRC, O1 57 to 62, A2 56 to 62, D2 54 to 61, S2 50 to 60, T4 62 to 66.', ['MHCC']) +
    mgP('<b>Machinability falls as the alloy rises.</b> With W1 as 100, O1 is rated about 90, A2 and S2 about 85, H11 about 75, and D2 and M1 about 50.', ['MHCC']) +
    mgP('<b>Hot work steels by number.</b> H1 to H19 are chromium based and H40 to H59 molybdenum based, with a tungsten based group between them.', ['EF_TS']) +
    mgP('One source calls the T group cobalt tool steel in its heading and tungsten type in its text; the other names it tungsten high speed steel.', ['MHCC', 'EF_TS']) +
    '<h3 class="gcat" id="mg-tsel">Choosing a tool steel for the job</h3>' +
    mgP('<b>Wear against toughness.</b> A steel that resists wear better usually breaks more easily, and the other way round. Choose by the way the tool is most likely to fail.', ['CRU_SEL', 'PL_TS']) +
    mgP('<b>Blows and shock.</b> For punches, chisels and tools that take impact, the shock-resisting S grades such as S7. Avoid a brittle grade like D2 there.', ['CRU_SEL', 'PL_TS']) +
    mgP('<b>Abrasion.</b> D2 for blanking, stamping and forming tools where wear is the main trouble, including dies for glass-filled plastics.', ['PL_TS', 'AIMS_SG']) +
    mgP('<b>General cold work.</b> O1, A2 and D2 are the general-purpose cold work steels. O1 for gauges, taps, reamers, small dies and short runs; A2 for punches, knives, gauges and form tools.', ['CRU_SEL', 'PL_TS', 'AIMS_SG']) +
    mgP('<b>Heat.</b> H13 for die-casting, forging and extrusion dies; Protolabs gives it for work above 400 °C.', ['PL_TS', 'AIMS_SG']) +
    mgP('<b>Moulds.</b> The pre-hardened P20 for plastic injection moulds in moderate numbers.', ['PL_TS']) +
    mgP('<b>Cutting tools.</b> High speed steel such as M2 for drills, taps, reamers and end mills.', ['PL_TS', 'AIMS_SG']) +
    mgP('<b>Wear failure is the better failure.</b> Wear comes on slowly and can be planned for; breakage cannot.', ['CRU_SEL']) +
    mgP('<b>When the tool fails (Crucible).</b> Wearing: a steel with more alloy, not just more hardness. Galling: keep the surfaces apart with lubricant or a coating such as TiN. Deforming: a new grade helps only if it can be run harder; or lower the load. Chipping and cracking: avoid sharp corners, and temper a part again after EDM before it goes into service.', ['CRU_SEL']) +
    mgP('Ten tool steels with their equivalents are in <a href="#/t/materials">material equivalents</a>.', null) +

    '<h2 id="mg-stain">Stainless steel families</h2>' +
    mgP('<b>What makes it stainless.</b> About 10.5 % chromium or more. The chromium forms a thin, clear oxide film on the surface that heals itself.', ['AALCO']) +
    guideTable(['Family', 'What it is', 'Magnetic', 'Used for'], MG_STAIN, mgTags) +
    mgP('<b>Grades.</b> Ferritic: 430. Martensitic: 410, 416, 431. Austenitic: 304 (also called 18/8), 316. Duplex: 2205, with 22 % chromium and 5 % nickel. Precipitation hardening: 630, also called 17-4 PH, with 17 % chromium, 4 % nickel and 4 % copper.', ['AALCO']) +
    mgP('<b>Austenitic grades are not hardened by heat treatment.</b> They gain strength by cold work.', ['AALCO', 'OUT']) +
    mgP('<b>Work hardening.</b> Austenitic grades work harden quickly.', ['AALCO']) +
    mgP('<b>Ferritic grades</b> cannot be hardened by heat treatment and are used annealed.', ['AALCO']) +
    mgP('<b>Free-machining.</b> Sulphur is added to some martensitic grades to make them machine better.', ['OUT']) +
    mgP('<b>17-4 PH</b> is machined in the solution-treated condition and then aged at a low temperature, which does not distort the part.', ['AALCO']) +
    mgP('Grades and equivalents are in <a href="#/t/materials">material equivalents</a>.', null) +

    '<h2 id="mg-iron">Cast iron</h2>' + mgIron() +
    mgP('<b>What it is.</b> Iron with more than 2 % carbon, and usually 1 to 3 % silicon.', ['WP_CI']) +
    mgP('<b>Silicon decides where the carbon goes.</b> With little silicon the carbon stays combined as iron carbide and the iron is white; with more, it comes out as graphite and the iron is grey.', ['WP_CI']) +
    guideTable(['Type', 'The carbon is present as', 'Behaviour', 'Used for'], MG_IRON, mgTags) +
    mgP('<b>Nodules.</b> Ductile iron gets its round graphite from a small addition of magnesium or cerium.', ['ACME']) +
    mgP('<b>Machining.</b> Grey and malleable iron machine easily; white iron machines poorly. Chilled iron has a hard white skin over a grey core.', ['ACME']) +

    '<h2 id="mg-alu">Aluminium alloys and tempers</h2>' +
    mgP('<b>Wrought alloys have four digits.</b> The first digit is the main alloying element.', ['ESAB', 'XOM_AL']) +
    guideTable(['Series', 'Main alloying element', 'Heat treatable'], MG_ALSER, mgTags) +
    mgP('<b>The other digits.</b> The second digit marks a modification of the alloy and the last two only identify it. In the 1xxx series the last two give the aluminium above 99 %: 1350 is 99.50 % at least.', ['ESAB']) +
    mgP('<b>Two ways to strength.</b> The 2xxx, 6xxx and 7xxx alloys are strengthened by heat treatment and carry T tempers. The 1xxx, 3xxx and 5xxx alloys are strengthened by cold work and carry H tempers.', ['ALC', 'HYDRO', 'ESAB']) +
    mgP('<b>The temper follows the alloy after a dash,</b> as in 5052-H32 or 7075-T7351.', ['ALC', 'XOM_AL']) +
    guideTable(['Letter', 'Meaning'], MG_TEMPER, mgTags) +
    mgP('<b>H tempers, first digit.</b> H1 strain hardened only. H2 strain hardened and partly annealed. H3 strain hardened and stabilised.', ['ESAB', 'HYDRO', 'ALC', 'XOM_AL']) +
    mgP('<b>H4</b> is strain hardened and lacquered or painted.', ['ESAB', 'XOM_AL']) +
    mgP('<b>H tempers, second digit:</b> how hard. 2 quarter hard, 4 half hard, 6 three-quarter hard, 8 full hard, 9 extra hard.', ['ESAB', 'ALC', 'HYDRO']) +
    mgP('<b>So 5052-H32</b> is strain hardened, stabilised and quarter hard.', ['ROB', 'ESAB']) +
    mgP('<b>H112</b> marks material with some hardening from shaping but no special control over how much.', ['ROB']) +
    '<p class="desc">The T tempers. "Hot shaping" is a shaping process at high temperature, such as extrusion:</p>' + guideTable(['Temper', 'Meaning'], MG_T, mgTags) +
    mgP('<b>Extra digits mean stress relief.</b> Tx51 is stress relieved by stretching and Tx52 by compressing.', ['ESAB', 'TM_AL']) +
    mgP('<b>T651</b> is solution heat treated, stress relieved by stretching and then artificially aged.', ['ROB', 'TM_AL']) +
    mgP('<b>On extrusions a fourth digit</b> follows: Tx510 has had no straightening after stretching, Tx511 minor straightening to meet the straightness tolerance.', ['TM_AL', 'ROB']) +
    mgP('<b>T73</b> is solution heat treated and then specially overaged for resistance to stress corrosion; T7351 is the same, stress relieved by stretching.', ['ROB']) +
    mgP('<b>T42 and T62</b> mark material solution treated (T42) or solution treated and artificially aged (T62) by the user and not by the mill.', ['TM_AL']) +
    mgP('<b>Cast alloys</b> have three digits and a decimal: .0 is a casting, .1 or .2 an ingot.', ['ESAB']) +
    mgP('One temper datasheet read prints T3, T5 and T10 differently from the four other sources; those lines were not used.', ['ROB', 'ESAB']) +
    mgP('Aluminium grades and equivalents are in <a href="#/t/materials">material equivalents</a>.', null) +

    '<h2 id="mg-cu">Copper alloy tempers</h2>' +
    mgP('<b>A letter class and digits.</b> A copper alloy temper is one or two letters for how the temper was produced, then two or three digits.', ['TM_CU', 'NB']) +
    guideTable(['Class', 'Meaning'], MG_CUCLASS, mgTags) +
    '<p class="desc">The cold-worked tempers most often seen on bar and sheet:</p>' + guideTable(['Temper', 'Name'], MG_CUH, mgTags) +
    mgP('<b>Annealed tempers.</b> O50 light annealed, O60 soft annealed, O61 annealed, O70 dead-soft annealed. O80, O81 and O82 are annealed to 1/8, 1/4 and 1/2 hard.', ['TM_CU', 'NB']) +
    mgP('<b>Grain size tempers.</b> The digits after OS are the average grain size in thousandths of a millimetre: OS025 is 0.025 mm. They run from OS005 to OS200.', ['TM_CU', 'NB']) +
    mgP('<b>As-manufactured tempers.</b> M01 as sand cast, M02 as centrifugal cast, M04 as pressure die cast, M07 as continuous cast, M20 as hot rolled, M30 as hot extruded.', ['TM_CU', 'NB']) +
    mgP('Twelve copper alloys with their equivalents are in <a href="#/t/materials">material equivalents</a>.', null) +

    '<h2 id="mg-other">Titanium, magnesium, nickel and zinc</h2>' +
    mgP('<b>Titanium grades 1 to 4</b> are commercially pure titanium. They differ in strength.', ['TM_TI', 'OLM']) +
    mgP('<b>Grade 2 and grade 4.</b> Grade 2 is the most used of the pure grades and grade 4 the strongest.', ['OLM']) +
    mgP('<b>Titanium grade 5</b> is Ti-6Al-4V, with about 6 % aluminium and 4 % vanadium. It is the most widely used titanium alloy.', ['TM_TI', 'OLM']) +
    mgP('<b>Grade 5 structure.</b> It is an alpha-beta alloy and is mostly used annealed. Titanium alloys are sorted into alpha, alpha-beta and beta classes by their structure.', ['TM_TI']) +
    mgP('<b>Grade 23</b> is grade 5 with fewer interstitial elements (ELI), for more toughness and fatigue life, as in implants.', ['OLM']) +
    mgP('<b>Magnesium alloy names.</b> Two letters for the two main alloying elements, then two numbers for their percentages in round figures.', ['TM_MG', 'EF_MG']) +
    mgP('<b>The letters.</b> A aluminium, Z zinc, M manganese, K zirconium, E rare earths, H thorium, Q silver, S silicon, T tin.', ['TM_MG', 'EF_MG']) +
    mgP('<b>Order and serial letter.</b> The element with the larger percentage comes first, and a serial letter after the numbers tells compositions with the same numbers apart. AZ81A-T4 is 8 % aluminium and 1 % zinc, the first composition registered, solution heat treated; AZ31B reads the same way, about 3 % aluminium and 1 % zinc.', ['TM_MG', 'OWN']) +
    mgP('<b>Magnesium tempers.</b> F as fabricated, O annealed, H strain hardened, T4 solution heat treated, T5 artificially aged, T6 solution heat treated and artificially aged.', ['TM_MG', 'EF_MG']) +
    '<p class="desc">Nickel alloy families:</p>' + guideTable(['Family', 'Trade name often heard', 'Known for resisting'], MG_NI, mgTags) +
    mgP('<b>Monel</b> holds about 30 % copper.', ['WI']) +
    mgP('<b>Machining nickel alloys.</b> They work harden rapidly, conduct heat poorly and need high cutting forces, so tools wear fast.', ['XOM_NI']) +
    mgP('<b>Zinc die casting alloys</b> come in two families, Zamak and ZA. Zamak 2 is the strong, hard one of the Zamak family.', ['DYN', 'ALD']) +
    mgP('<b>The number in a ZA name is its aluminium:</b> ZA-8 holds about 8 % and ZA-27 about 27 %, more than the Zamak alloys, and the ZA alloys are stronger.', ['DYN', 'ALD']) +
    mgP('<b>Zamak 3 and Zamak 5.</b> Zamak 3 is the usual first choice in North America and Zamak 5 in Europe.', ['DYN']) +
    mgP('<b>Zamak aluminium.</b> The Zamak alloys hold about 4 % aluminium.', ['ALD']) +
    mgP('<b>Hot chamber.</b> Zinc melts at a low temperature, which suits hot-chamber die casting.', ['ALD', 'DYN']) +

    '<h2 id="mg-hard">How the hardness tests work</h2>' + mgIndent() +
    guideTable(['Test', 'Indenter', 'Load', 'What is measured', 'Suits'], MG_HARD, mgTags) +
    mgP('<b>How Rockwell reads.</b> A minor load seats the indenter and sets the zero. The major load is applied and taken off again, and the extra depth that remains gives the number: the shallower the impression, the higher the number.', ['WA', 'MM_H', 'WEV']) +
    mgP('<b>Rockwell scales.</b> C: diamond cone, 150 kgf, for hardened steel. B: 1/16 in ball, 100 kgf, for soft steel, brass and aluminium. A: diamond cone, 60 kgf, for very hard or thin material such as carbide.', ['MST', 'WA', 'WEV']) +
    mgP('<b>Vickers angle, sources differ.</b> Two sources give 136 degrees between opposite faces of the pyramid; a university tutorial prints an apex angle of 120 degrees.', ['MST', 'WA', 'UNSW']) +
    mgP('<b>Vickers loads as given.</b> 1 gf to 100 kgf in one source and 1 to 120 kgf in another; a third lists 5, 10, 30 and 50 kg as the usual ones.', ['WEV', 'MST', 'WA']) +
    mgP('<b>Limit of Brinell.</b> It does not suit very hard material, where the ball itself starts to deform.', ['UNSW', 'WEV']) +
    mgP('<b>Surface.</b> The microhardness tests, Vickers and Knoop at small loads, need a smooth, polished surface.', ['MM_H', 'MST']) +
    mgP('Convert between the scales in <a href="#/t/hardness">hardness conversion</a>.', null) +

    '<h2 id="mg-harden">Hardenability</h2>' +
    mgP('<b>Hardness and hardenability are two things.</b> Hardness is resistance to indentation. Hardenability is how deep into a section a steel hardens when it is quenched.', ['WP_HARD', 'TM_HT']) +
    mgP('<b>What decides which.</b> The hardness of quenched steel depends on its carbon content and on how much martensite has formed. Hardenability depends on the composition as a whole, alloying elements included, and on the grain size.', ['TM_HT', 'WP_HARD']) +
    mgP('<b>The Jominy end-quench test.</b> A standard bar 25.4 mm in diameter and 102 mm long is heated until it is fully austenitic, then set in a rig where a jet of water quenches one end only.', ['CAM_JOM', 'TM_HT', 'WP_HARD']) +
    mgP('<b>Reading the bar.</b> The cooling rate falls steadily along the bar from the quenched end. Hardness is measured along it (Total Materia: on flats ground 4 mm deep). The farther from the quenched end the hardness holds up, the higher the hardenability.', ['CAM_JOM', 'TM_HT', 'WP_HARD']) +
    mgP('<b>An example from Cambridge.</b> Two steels with the same 0.4 % carbon: the plain carbon one has a low hardenability beside the one alloyed with nickel, chromium and molybdenum.', ['CAM_JOM']) +
    mgP('<b>From the bar to a part.</b> The results can be converted to the largest round bar that hardens right through. The ideal critical diameter, Di, is the bar that reaches 50 % martensite at its centre.', ['TM_HT']) +
    mgP('<b>Quenchants.</b> Brine and water cool steel much faster than oil or air.', ['WP_HARD']) +
    mgP('<b>Welding.</b> The higher the hardenability, the poorer the weldability.', ['WP_HARD']) +
    mgP('Temperatures for hardening and tempering are in the <a href="#/t/heattreat">heat treatment reference</a>.', null) +

    '<h2 id="mg-case">Case hardening</h2>' +
    mgP('<b>The idea.</b> A hard, wear-resistant skin over a core that stays tough.', ['TM_SH', 'OU_PNC']) +
    guideTable(['Process', 'How', 'Temperature', 'Case depth'], MG_CASE, mgTags) +
    '<p class="desc">Total Materia\'s table reached us with some damaged cells; only cells that read cleanly are quoted, each beside a second source where one was found. The Open University pages describe the plasma processes and warn that they may be out of date. Depths given in micrometres are written here in mm.</p>' +
    mgP('<b>Steels for carburising</b> are low in carbon: below 0.4 % and better below 0.25 %, so that the core stays tough.', ['OU_PNC', 'TM_SH']) +
    mgP('<b>Quench or not.</b> Carburised and carbonitrided parts are quenched to get their hardness. Nitrided parts are not quenched.', ['TM_SH', 'OU_PNC']) +
    mgP('<b>Distortion.</b> Nitriding, at the lowest temperature and with no quench, distorts least. Carbonitriding runs cooler than carburising, which reduces distortion in the quench.', ['OU_PNC', 'WP_CN', 'TM_SH']) +
    mgP('<b>Case hardness as printed.</b> Total Materia: 50 to 63 HRC for carburised cases and 50 to 70 HRC for nitrided ones. Open University: up to 1500 HV for nitrides. Wikipedia: 55 to 62 HRC for carbonitrided parts.', ['TM_SH', 'OU_PNC', 'WP_CN']) +
    mgP('<b>Steels for induction and flame hardening.</b> Medium carbon steels, plain or alloyed: at least 0.3 % carbon, mostly 0.4 to 0.7 % (Open University). The hardness reached depends on the carbon content (Gear Solutions).', ['OU_IFH', 'GS_IH']) +
    mgP('<b>Induction in production.</b> Fast, repeatable and easy to automate. The equipment is costly and the coil has to be designed and proved for the part, so it suits long runs.', ['GS_IH', 'OU_IFH']) +
    mgP('<b>Frequency and depth.</b> The higher the frequency of the induction heater, the shallower the hardened layer.', ['GS_IH']) +
    mgP('<b>Where the case ends.</b> For induction hardening the case depth is usually taken as the depth at which the structure is still at least 50 % martensite.', ['GS_IH']) +
    mgP('<b>Flame hardening</b> can treat small chosen areas and flat, round or irregular parts. The risks are overheating, burning and distortion.', ['OU_IFH']) +
    mgP('<b>More carbon, more risk.</b> The higher the carbon content, the greater the risk of cracks and distortion.', ['OU_IFH']) +
    mgP('Terms and temperatures steel by steel are in the <a href="#/t/heattreat">heat treatment reference</a>.', null) +

    '<h2 id="mg-mach">Machinability</h2>' +
    mgP('<b>What the word means.</b> How easily a metal can be cut to an acceptable finish, with an acceptable tool life.', ['WP_MACH', 'INF_MACH']) +
    mgP('<b>How it is judged.</b> By how long the tool lasts, by the forces and power the cut takes, by the finish, and by how the chips break.', ['WP_MACH', 'INF_MACH']) +
    mgP('<b>No agreed measure.</b> Many things affect machinability and there is no widely accepted way to put a number on it.', ['WP_MACH']) +
    mgP('<b>The rating in per cent.</b> The free-cutting steel B1112 is set at 100 % and other metals are rated against it.', ['WP_MACH', 'INF_MACH']) +
    mgP('<b>Carbon.</b> Of the elements, carbon matters most (Infinita Lab). Low-carbon steels are troublesome because they are soft, high-carbon steels because they are strong; Wikipedia puts the best machinability at about 0.20 % carbon.', ['WP_MACH', 'INF_MACH']) +
    mgP('<b>Sulphur and lead.</b> Sulphur forms soft inclusions that break the chip and improve the finish. Lead acts as a lubricant in the cut; Infinita Lab notes that it has largely been phased out because it is toxic.', ['WP_MACH', 'INF_MACH']) +
    mgP('<b>Stainless steel</b> machines worse than carbon steel. The austenitic grades work-harden quickly and conduct heat poorly, which overheats the tool.', ['WP_MACH', 'INF_MACH']) +
    mgP('<b>Hardness and structure.</b> As a rule machinability falls as hardness rises. Annealed, spheroidised steel cuts more easily; martensite is very hard to cut.', ['INF_MACH']) +
    mgP('<b>Alloying.</b> Chromium, molybdenum and nickel raise strength and hardness and generally lower machinability.', ['INF_MACH']) +
    mgP('Ratings grade by grade are on the cards of <a href="#/t/materials">material equivalents</a>; the work material groups are in <a href="#/t/iso513">cutting material groups</a>.', null) +

    '<h2 id="mg-tens">The tensile test: stress, strain and the figures on the certificate</h2>' + mgCurve() +
    mgP('<b>The test.</b> A test piece is pulled with a steadily rising load until it breaks, and the load and the stretch are recorded all the way.', ['TWI_TT', 'WP_SS']) +
    mgP('<b>Stress and strain.</b> Stress is the force divided by the cross-section it acts on. Strain is the change in length divided by the length at the start.', ['FRAC_SS']) +
    mgP('<b>The straight part.</b> At first the stress rises in step with the strain (Hooke\'s law). The slope of that line is Young\'s modulus: it tells how much a part gives elastically under load.', ['FRAC_SS', 'WP_SS', 'TWI_TT']) +
    mgP('<b>Proportional limit and elastic limit.</b> The proportional limit is where the straight line ends. The elastic limit is the stress beyond which the piece no longer returns to its shape.', ['FRAC_SS', 'MATH_SS']) +
    mgP('<b>Yield.</b> The stress at which the deformation turns from elastic to plastic, that is, permanent.', ['FRAC_SS', 'TWI_TT']) +
    mgP('<b>Proof stress.</b> Many metals show no clear yield point. For them the stress that leaves a small stated permanent strain is used, found by drawing a line parallel to the straight part of the curve. Most steel specifications use 0.2 %, written Rp0.2 in EN standards.', ['TWI_TT']) +
    mgP('<b>Tensile strength.</b> The highest stress on the curve.', ['FRAC_SS', 'WP_SS', 'MATH_SS']) +
    mgP('<b>Necking and fracture.</b> Past the highest point a ductile piece narrows at one place, the neck, and breaks there, leaving a cup on one side and a cone on the other.', ['FRAC_SS', 'WP_SS']) +
    mgP('<b>Elongation and reduction of area.</b> Elongation is the stretch at fracture in per cent of the gauge length. Reduction of area is how much the section has shrunk at the break. Both measure ductility: how far the metal deforms before it breaks.', ['TWI_TT']) +
    mgP('<b>Brittle materials</b> have no clear yield point and do not strain-harden.', ['WP_SS']) +
    mgP('<b>Engineering and true stress.</b> The usual curve divides by the cross-section at the start, so it falls once the neck forms. Worked on the real, shrinking section, the stress keeps rising.', ['WP_SS']) +
    mgP('<b>From strength to allowable stress.</b> The strength, yield or tensile, divided by the stress allowed in the part is the factor of safety.', ['MATH_SS']) +
    mgP('Factors of safety are in the <a href="#/t/elemguide">machine elements guide</a>.', null) +

    '<h2 id="mg-temp">Heat and cold: what temperature does to strength</h2>' +
    mgP('<b>Getting hotter.</b> Near room temperature the yield strength, the tensile strength and the modulus change little. As the temperature rises they fall away, slowly at first. Materion shows this for a copper beryllium alloy.', ['MAT_TEMP']) +
    mgP('<b>Getting colder.</b> Metals in general gain tensile and yield strength in the cold.', ['TM_TEMP', 'MAT_TEMP']) +
    mgP('<b>But steel turns brittle.</b> Steels become more brittle at low temperature, while copper alloys become tougher.', ['MAT_TEMP', 'TM_TEMP']) +
    mgP('<b>Which steels.</b> Ferritic steels lose their impact strength sharply at around 0 °C. Austenitic alloys keep much of their ductility and shock resistance. Below -100 °C, or where a notch takes a blow, Total Materia prefers an 18/8 austenitic steel or a non-ferrous metal.', ['TM_TEMP']) +
    mgP('<b>What lowers the temperature at which a steel turns brittle:</b> less carbon, more nickel and manganese, a finer grain, shallower and rounder notches, slower loading.', ['TM_TEMP']) +
    mgP('<b>Creep.</b> At high temperature a metal under a steady stress slowly keeps deforming. It matters in steam and chemical plant at 450 to 550 °C and in gas turbines.', ['TM_TEMP']) +
    mgP('<b>Three stages of creep.</b> First the stretching slows; then it runs at a steady, lowest rate; last it speeds up until the part breaks.', ['TM_TEMP']) +
    mgP('<b>Stress relaxation.</b> Creep and stress relaxation come from diffusion in the metal, with no change of phase, so relaxation can occur at temperatures too low to change the structure.', ['MAT_TEMP']) +
    mgP('Strength and modulus at room temperature are on the cards of <a href="#/t/materials">material equivalents</a>.', null) +

    '<h2 id="mg-use">Steels by what they are used for</h2>' +
    guideTable(['Grade', 'AIMS Industrial', 'Continental Steel'], MG_USE, mgTags) +
    '<p class="desc">Uses as two steel suppliers list them, each in its own column. A row with one supplier is marked. A dash means the supplier does not list the grade.</p>' +
    mgP('<b>Tool steels (AIMS).</b> O1 for taps, reamers and small dies; A2 for punches, knives and gauges; D2 for dies, punches and shear blades; M2 for drills, end mills and taps; H13 for die-casting, extrusion and forging dies.', ['AIMS_SG']) +
    mgP('<b>Stainless (AIMS).</b> 304 is the general-purpose grade for indoors and mild outdoor use; 316 is the grade for marine and chemical service.', ['AIMS_SG']) +
    mgP('Composition and properties grade by grade are on the cards of <a href="#/t/materials">material equivalents</a>.', null) +

    '<h2 id="mg-lam">Machining laminates and hard rubber</h2>' +
    mgP('<b>What laminates are.</b> Thermosets made of layers of paper, cotton cloth or glass cloth bonded with resin: phenolic for the paper and cotton grades, epoxy for glass grades such as G-10. They do not melt.', ['CTE_PH', 'XOM_G10', 'NORP_FG']) +
    mgP('<b>They wear tools.</b> The fillers are abrasive and dull cutting edges quickly, the glass grades most of all.', ['CTE_PH', 'XOM_G10', 'NORP_FG']) +
    mgP('<b>Tool material.</b> Paper and cotton grades can be cut with high speed steel, with carbide for production runs. Glass grades need carbide or diamond; Xometry suggests diamond-coated end mills.', ['NORP_FG', 'CTE_PH', 'XOM_G10']) +
    mgP('<b>Dust.</b> Cutting makes a fine powder rather than chips, and it must not be breathed. Collect it at the machine, and wear a respirator and eye protection.', ['XOM_G10', 'CTE_PH', 'NORP_FG']) +
    mgP('<b>Coolant, the sources differ.</b> Norplex: paper grades dry, with air or a vacuum to take the dust; glass grades dry with an exhaust, though water may be used. Cutting Tool Engineering drilled phenolic with water-based flood coolant, which also kept the dust down. Xometry: coolant cuts the dust, but medical G-10 parts are machined dry to keep them clean.', ['NORP_FG', 'CTE_PH', 'XOM_G10']) +
    mgP('<b>Heat.</b> Keep the work below about 150 °C.', ['NORP_FG', 'PS_TS']) +
    mgP('<b>Holes come out small.</b> Holes drilled in laminate come out undersize, and more so with a dull drill. Norplex: use a drill about 0.002 in larger than the hole. Cutting Tool Engineering: a 0.315 in drill gave holes of 0.310 to 0.314 in.', ['NORP_FG', 'CTE_PH']) +
    mgP('<b>Layers that split.</b> Xometry: too much heat and pressure along the grain splits the layers. Norplex: climb mill only, because conventional milling lifts the layers, and back the far side with scrap when drilling through.', ['XOM_G10', 'NORP_FG']) +
    mgP('<b>Threads, the sources differ.</b> Xometry: mill internal threads instead of tapping them, and turn or thread-mill outside threads instead of using a die. Norplex: taps cut close to size and bind in glass grades, so use carbide taps made oversize; in paper grades use a tap 0.002 in oversize.', ['XOM_G10', 'NORP_FG']) +
    mgP('<b>Hard rubber (ebonite).</b> An old workshop cyclopaedia: sharp steel tools ground about as for brass or hardwood, a moderate speed and light cuts; rough with a round-nosed tool, finish with a flat brass-finishing tool or a scraper, and polish with emery cloth and then putty powder.', ['HAS_EB']) +
    '<p class="desc">No speeds are given: the figures printed are for one maker\'s grades or one shop\'s job. Thermoplastics are on <a href="#/t/plastics">Machining plastics</a>.</p>' +

    '<h2 id="mg-corr">Forms of corrosion</h2>' +
    guideTable(['Form', 'What happens'], MG_CORR, mgTags) +
    mgP('<b>Crevices.</b> Crevice corrosion is kept down by the design of the joint.', ['TWI']) +
    mgP('<b>General protection.</b> Keep the surface clean and dry, coat it with oil, grease or paint, choose a metal that resists, or fit a sacrificial anode.', ['TWI']) +
    mgP('Which of two metals in contact corrodes is worked out in <a href="#/t/galvanic">galvanic series and two-metal check</a>.', null) +

    '<h2 id="mg-cert">Reading a mill certificate</h2>' +
    mgP('<b>EN 10204 names four documents.</b> The number on the certificate tells how far the test results can be tied to the material in your hand.', ['PM', 'WIP']) +
    guideTable(['Type', 'Name', 'Test results', 'Signed by'], MG_CERT, mgTags) +
    mgP('<b>What is on it.</b> The maker, the product, the grade and specification, the heat number, the chemical analysis, the mechanical test results, and a signature or stamp.', ['PM', 'WIP']) +
    mgP('<b>Check the heat number first.</b> The number marked on the material must be the one on the certificate: the analysis and the test results belong to that number.', ['WIP', 'PM']) +
    mgP('<b>Then compare with the order:</b> grade, specification, delivery condition and dimensions.', ['WIP']) +

    '<h2 id="mg-nonfe">Machining magnesium</h2>' +
    mgP('<b>Speeds and feeds</b> for aluminium, copper alloys and titanium are in the speeds and feeds tools; this section is about handling magnesium, whose chips can burn.', null) +
    mgP('<b>The bar is safe, the chips are not.</b> A solid magnesium part is hard to set alight; fine chips and dust catch fire easily, from heat or a spark.', ['ERP3', 'WAYKEN']) +
    mgP('<b>Sharp tools.</b> A dull tool heats the cut and can light the chips.', ['ERP3', 'WAYKEN']) +
    mgP('<b>Clearance.</b> Avoid small clearance angles: they rub, heat up and make long chips. Tools with large relief are used.', ['ERP3', 'WAYKEN']) +
    mgP('<b>Broken chips</b> rather than long ribbons: ribbons light more easily and wrap the cutter.', ['ERP3', 'WAYKEN']) +
    mgP('<b>Coolant.</b> Cut dry or with mineral oil. Water-based coolant is advised against: water with magnesium can give off hydrogen, which burns.', ['ERP3', 'WAYKEN']) +
    mgP('<b>If it burns: never water.</b> Use a class D (metal fire) extinguisher; dry sand smothers a small fire.', ['ERP3', 'WAYKEN']) +
    mgP('<b>Where to keep them.</b> Sand in a bucket by the machine, the extinguisher a little further off so a fire does not cut you off from it.', ['ERP3']) +
    mgP('<b>Carbon dioxide and nitrogen</b> do not put a magnesium fire out either.', ['ERP3']) +
    mgP('<b>Chips and dust.</b> Extract with an explosion-proof vacuum. Keep chips dry, in closed steel bins away from other waste; move wet chips somewhere remote.', ['ERP3', 'WAYKEN']) +
    mgP('<b>How it cuts.</b> One magnesium maker gives about 55 % of the power aluminium needs, with well broken chips and a fine finish.', ['LUX_MM']) +
    mgP('<b>Titanium chips</b> call for the same care.', ['ERP3']) +

    '<h2 id="mg-hss">High speed steel: hardening, tempering and cold treatment</h2>' +
    mgP('<b>The sequence</b> is anneal (as delivered), preheat, harden at a high temperature, quench, then temper at least twice. M2 as two makers print it, side by side:', ['HUD_M2', 'SBSM_M2']) +
    guideTable(['Step', 'Hudson Tool Steel', 'SB Specialty Metals'], MG_M2, mgTags) +
    mgP('<b>Why twice.</b> Fresh from the quench, high speed steel holds 20 to 40 % retained austenite. The first temper (about 575 C in one source) turns it to new martensite, which the next temper must temper in its turn.', ['TM_HSS']) +
    mgP('<b>Double tempering is required</b> by both makers; triple is recommended for large sections.', ['HUD_M2', 'SBSM_M2']) +
    mgP('<b>Hardening temperature.</b> The low end of the range for the most toughness, the high end for the most hot hardness.', ['HUD_M2']) +
    mgP('<b>Upper limit.</b> 1200 to 1220 C for M2, M7 and M42, never over 1230 C, in one source.', ['TM_HSS']) +
    mgP('<b>Example hardness.</b> Hardened from 1204 C (2200 F) and tempered at 552 C (1025 F): 65 HRC in one maker\'s table.', ['SBSM_M2']) +
    mgP('<b>Cold (sub-zero) treatment.</b> Taking a high carbon or high alloy steel below room temperature after the quench carries on the change of retained austenite to martensite: harder, more wear resistant and more stable in size.', ['MF_SZ', 'ENC_DCT']) +
    mgP('<b>How cold, as printed.</b> Cold treatment about -70 to -120 C, held about 1 hour per 3 cm of section (MetalForming). Shallow cryogenic -80 to -160 C, deep cryogenic below -160 C (or -153 C), often in liquid nitrogen at -196 C (Encyclopedia.pub).', ['MF_SZ', 'ENC_DCT']) +
    mgP('<b>Temper afterwards.</b> The new martensite is brittle and must be tempered like the rest.', ['MF_SZ', 'WP_HT']) +
    mgP('<b>Deep cryogenic results vary</b> between studies; some found no gain or a loss of toughness.', ['ENC_DCT']) +

    '<h2 id="mg-terms">Metallurgy terms</h2>' +
    guideTable(['Term', 'Meaning'], MG_TERMS, mgTags) +

    '<h2 id="mg-fail">How metals fail</h2>' +
    mgP('<b>Ductile overload.</b> The part stretches, bends or necks before it breaks, which gives warning.', ['ELEM_F', 'MHCC_F']) +
    mgP('<b>Brittle fracture.</b> Little or no deformation, little energy absorbed, often with a crack of sound; the halves fit back together. Wrongly heat treated steel can break this way.', ['MHCC_F']) +
    mgP('<b>Fatigue.</b> Repeated or changing load starts a crack and grows it a little with every cycle, at stresses well below what would break the part in one pull.', ['MHCC_F', 'ELEM_F', 'IMT_F']) +
    mgP('<b>Three stages.</b> The crack starts; it grows slowly; when it reaches a critical size the rest breaks suddenly.', ['MHCC_F', 'IMT_F', 'ELEM_F']) +
    mgP('<b>Reading the break.</b> The slow growth zone is flat and fairly smooth, with curved beach (clamshell) marks where the growth paused; trace them back to find where it started. The last part to break is rough.', ['IMT_F', 'ELEM_F']) +
    mgP('<b>Striations</b>, seen only under a microscope, are one per load cycle.', ['IMT_F', 'MHCC_F']) +
    mgP('<b>Where cracks start.</b> At the surface and at stress raisers: sharp corners, tool marks, inclusions. A radius in every corner and a good finish lengthen fatigue life.', ['ELEM_F', 'IMT_F']) +

    '<h2 id="mg-src">Sources</h2><ul class="gsl">' + Object.entries(MG_SOURCES).map(([k, v]) => '<li><b>' + k + '</b> ' + gesc(v) + '</li>').join('') + '</ul>' +
    '<p class="desc">Full URLs and access dates are in docs/sources.md, "Materials guide". No text, figures or tables were copied from the sources.</p>';
  guideToc(el);
}
