'use strict';
// Speeds and feeds advisor (0.3.0). Starting speeds and chip loads as printed by each publisher
// (docs/sources.md, "Advisor"), kept apart and shown side by side; the choice of which to start
// from is the user's. Every calculation is in the Rust core (core/src/advisor.rs); this file
// looks values up, converts units and words the result.

// LittleMachineShop, "Cutting Speeds" (ft/min): [grades, turning HSS, turning carbide, milling, drilling, reaming].
// Turning figures are for 0.004 in/rev, 0.040 in depth of cut and 180 min tool life. The milling table does not name the tool material.
const ADV_LMS = {
  1: ['1212, 1213, 1215', [270, 290], [820, 1045], [130, 140], [120, 125], [80, 80]],
  2: ['1108 to 1126, 1211 (1117, 1118)', [215, 235], [950, 950], [115, 130], [100, 120], [75, 80]],
  3: ['1132 to 1151 (1137, 1144)', [70, 215], [670, 800], [35, 70], [35, 70], [20, 45]],
  4: ['11L17, 11L18, 12L13, 12L14', [200, 260], [800, 820], [110, 140], [90, 130], [60, 85]],
  5: ['1006 to 1026 (1018, 1020)', [125, 215], [800, 885], [65, 110], [60, 100], [40, 65]],
  6: ['1027 to 1052 (1045)', [55, 180], [670, 970], [25, 100], [25, 90], [15, 60]],
  7: ['4140, 4150', [70, 200], [430, 685], [35, 100], [30, 90], [15, 60]],
  8: ['W1, W2, W5', [180, 180], [590, 590], [85, 85], [85, 85], [55, 55]],
  9: ['O1, O2, O6, O7', [125, 125], [590, 590], [50, 50], [45, 45], [30, 30]],
  10: ['A2 to A10', [80, 125], [355, 365], [40, 50], [30, 50], [20, 35]],
  11: ['201 to 348 (304, 321)', [115, 135], [570, 570], [70, 75], [50, 55], [30, 35]],
  12: ['ASTM class 20 to 40', [145, 215], [410, 410], [70, 100], [80, 100], [50, 65]],
  13: ['C36000 and other leaded brasses', [300, 350], [1170, 1170], [100, 200], [160, 175], [160, 175]],
  14: ['C65500, C22600, C65100, C67500', [200, 250], [715, 715], [30, 80], [120, 140], [110, 120]],
  15: ['6061-T6, 5000, 6000 and 7000 series', [500, 600], [2820, 2820], [165, 165], [350, 400], [350, 400]],
  16: ['sand and permanent mould casting alloys', [600, 750], [2820, 2820], [165, 165], [350, 400], [350, 400]],
};
// University of Florida, MAE design lab, "Speeds and Feeds" (web page): [row as printed, HSS ft/min, end mill in/tooth low, high].
// The feed per tooth is for cutters from 1/2 in to 1-1/2 in. Carbide: 2.5 times the HSS speed.
const ADV_UF = {
  acetal: ['Acetal (Delrin)', 250, 0.008, 0.030], al: ['Aluminum and its alloys', 250, 0.004, 0.012], brass: ['Brass (360 high machining)', 250, 0.004, 0.012],
  bronze: ['Bronze (high tensile)', 100, 0.002, 0.006], cisoft: ['Cast iron (soft)', 100, 0.002, 0.006], cimed: ['Cast iron (medium hard)', 80, 0.002, 0.006],
  inconel: ['Inconel', 25, 0.0015, 0.003], mild: ['Mild steel (.2-.3 C)', 100, 0.002, 0.008], med: ['Steel (.4-.5 C)', 60, 0.002, 0.006],
  tool: ['Tool steel', 40, 0.0015, 0.004], alloy300: ['Steel alloys (300-400 Brinell)', 30, 0.0015, 0.004],
  ssfree: ['Stainless steel (free machining)', 40, 0.002, 0.006], sswh: ['Stainless steel (work hardening)', 20, 0.0015, 0.004], ti: ['Titanium alloys', 20, 0.0015, 0.004],
};
// Harvey Tool, "General Machining Guidelines", carbide end mills: [row as printed, ft/min low, high, in/tooth at each diameter].
const ADV_HAR_D = [0.125, 0.1875, 0.25, 0.375, 0.5, 0.625, 0.75, 1];
const ADV_HAR = {
  alwr: ['Aluminum 2024-T4/T6, 2014, 6061-T6/T651, 7075-T6', 800, 1500, [0.001, 0.002, 0.002, 0.003, 0.004, 0.005, 0.006, 0.007]],
  alcast: ['Aluminum 440, 356, 380, C61300', 500, 1000, [0.001, 0.002, 0.002, 0.003, 0.004, 0.005, 0.006, 0.007]],
  brass: ['Yellow brass, high lead brass, red brass', 800, 1500, [0.001, 0.001, 0.002, 0.0025, 0.003, 0.004, 0.004, 0.005]],
  bronze: ['Alum/bronze, low silicon bronze', 800, 1000, [0.001, 0.001, 0.002, 0.0025, 0.003, 0.004, 0.004, 0.005]],
  grey: ['Gray cast iron', 100, 400, [0.0005, 0.001, 0.002, 0.003, 0.004, 0.005, 0.006, 0.008]],
  lowalloy: ['Low alloy 10XX, 11XX, 13XX', 100, 300, [0.0005, 0.001, 0.0015, 0.002, 0.003, 0.004, 0.005, 0.006]],
  tool: ['High alloy A-2/6/10, P-3/10, O1, O2, O6', 100, 250, [0.0005, 0.0005, 0.001, 0.001, 0.001, 0.0015, 0.002, 0.004]],
  aust: ['Austenitic 304, 310, 314, 316, 321, 330, 347, 348', 100, 250, [0.0001, 0.0002, 0.0005, 0.001, 0.0015, 0.002, 0.003, 0.004]],
  austfree: ['Austenitic 200 series, 302, 303, 304L, 316L', 100, 350, [0.0001, 0.0002, 0.0005, 0.001, 0.0015, 0.002, 0.003, 0.004]],
  mart: ['Martensitic 403, 410, 416', 100, 250, [0.0001, 0.0002, 0.0005, 0.0005, 0.001, 0.001, 0.003, 0.004]],
  ni: ['Nickel base: Hastelloy, Inconel 718, Waspaloy, Rene', 40, 60, [0.0005, 0.0005, 0.001, 0.001, 0.002, 0.0025, 0.003, 0.004]],
  ti: ['Titanium: commercially pure, 6Al-4V', 50, 250, [0.0005, 0.0005, 0.0005, 0.001, 0.001, 0.0015, 0.002, 0.004]],
  plastic: ['Plastics: acrylics, phenolics, polysulfone', 200, 600, [0.001, 0.002, 0.003, 0.004, 0.006, 0.008, 0.010, 0.015]],
};
// RedLine Tools catalogue p. 216, general purpose carbide end mills:
// [row as printed, ft/min uncoated [low, high], AlTiN, TiCN, in/tooth [low, high] at each diameter]. Aluminium is printed as "over 500".
const ADV_RED_D = [0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 1];
const ADV_RED_A = [[0.0007, 0.0015], [0.0010, 0.0015], [0.0015, 0.0020], [0.0020, 0.0025], [0.0025, 0.0030], [0.0030, 0.0035], [0.0040, 0.0050]];
const ADV_RED_B = [[0.0005, 0.0010], [0.0008, 0.0010], [0.0010, 0.0015], [0.0015, 0.0020], [0.0020, 0.0030], [0.0030, 0.0040], [0.0035, 0.0045]];
const ADV_RED_C = [[0.0010, 0.0015], [0.0015, 0.0020], [0.0020, 0.0030], [0.0030, 0.0040], [0.0040, 0.0060], [0.0060, 0.0080], [0.0080, 0.0100]];
const ADV_RED = {
  low: ['Low carbon: A36, 12L14, 1018, 1020, 1215, 9310', [200, 250], [280, 350], [250, 310], ADV_RED_A],
  med: ['Medium carbon: 1040-1095, 4140 series, 8620-8660, 52100', [200, 250], [280, 350], [250, 310], ADV_RED_A],
  tool: ['High strength tool steel: A2, D2, P20, H11, H13, S2, O1', [150, 225], [210, 315], [185, 310], ADV_RED_B],
  aust: ['Austenitic: 301-304L, 310, 316L, 321, 347', [200, 250], [280, 350], [250, 310], ADV_RED_B],
  mart: ['Martensitic: 403, 410, 416, 420, 430, 431, 440', [150, 250], [210, 350], [185, 310], ADV_RED_B],
  grey: ['Gray cast iron: A48, A436, A319, Class 20, G4000', [250, 350], [350, 490], [310, 435], ADV_RED_C],
  al: ['Aluminum alloys', [500, null], [500, null], [500, null], ADV_RED_C],
  brass: ['Brass / bronze (aluminum bronze, low silicon bronze)', [250, 350], [350, 490], [310, 435],
    [[0.0007, 0.0015], [0.0010, 0.0015], [0.0015, 0.0020], [0.0020, 0.0025], [0.0025, 0.0050], [0.0050, 0.0080], [0.0080, 0.0100]]],
  ni: ['Nickel base: Inconel 625/718, Inco 700, 713C', [125, 175], [175, 245], [155, 215], ADV_RED_B],
  ti: ['Titanium: commercially pure, 6Al-4V', [200, 300], [280, 420], [250, 375], ADV_RED_A],
};
// University of Pennsylvania, MEAM design guides, "Feeds and Speeds": [row, carbide ft/min, carbide in/tooth at 1/8, 1/4, 1/2, HSS ft/min, HSS in/tooth].
// Aluminium and plastics carbide speeds are printed as "600+".
const ADV_UPN_D = [0.125, 0.25, 0.5];
const ADV_UPN = {
  al: ['Aluminum', [600, null], [0.001, 0.002, 0.004], 300, [0.001, 0.0015, 0.002]],
  brass: ['Brass', [300, 300], [0.001, 0.002, 0.003], 150, [0.001, 0.002, 0.003]],
  mild: ['Mild steel', [250, 250], [0.001, 0.002, 0.003], 100, [0.0005, 0.001, 0.002]],
  plastic: ['Plastics', [600, null], [0.001, 0.003, 0.006], 400, [0.001, 0.0015, 0.002]],
  ss: ['Stainless steel', [200, 200], [0.0005, 0.001, 0.002], 80, [0.0005, 0.001, 0.002]],
  ti: ['Titanium', [150, 150], [0.0005, 0.001, 0.0015], 40, [0.0005, 0.001, 0.0015]],
};
// BenchMate's material classes. Each points at the row of each publisher that names that material; a publisher with no
// such row is left out. kc is the Iscar group used for forces (app/cutforce.js); the matching is BenchMate's own.
const ADV_MATS = [
  { id: 3, name: 'Low carbon steel (1018, 1020, A36)', kc: 1, lms: 5, uf: 'mild', har: 'lowalloy', red: 'low', upn: 'mild' },
  { id: 2, name: 'Free-machining steel, leaded (12L14)', kc: 1, lms: 4, red: 'low', upn: 'mild' },
  { id: 1, name: 'Free-machining steel (1215)', kc: 1, lms: 1, red: 'low', upn: 'mild' },
  { id: 20, name: 'Free-machining steel (1117, 1118)', kc: 1, lms: 2, har: 'lowalloy', upn: 'mild' },
  { id: 21, name: 'Free-machining medium carbon steel (1137, 1144)', kc: 2, lms: 3, har: 'lowalloy' },
  { id: 4, name: 'Medium carbon steel (1045)', kc: 2, lms: 6, uf: 'med', har: 'lowalloy', red: 'med' },
  { id: 5, name: 'Alloy steel (4140, 4150), annealed', kc: 6, lms: 7, red: 'med' },
  { id: 6, name: 'Alloy steel, heat treated (300 to 400 HB)', kc: 9, uf: 'alloy300' },
  { id: 7, name: 'Tool steel O1, annealed', kc: 10, lms: 9, uf: 'tool', har: 'tool', red: 'tool' },
  { id: 8, name: 'Tool steel A2, annealed', kc: 10, lms: 10, uf: 'tool', har: 'tool', red: 'tool' },
  { id: 22, name: 'Tool steel W1, annealed', kc: 10, lms: 8, uf: 'tool' },
  { id: 9, name: 'Stainless steel, austenitic (304, 316)', kc: 14, lms: 11, uf: 'sswh', har: 'aust', red: 'aust', upn: 'ss' },
  { id: 10, name: 'Stainless steel, free-machining (303)', kc: 14, uf: 'ssfree', har: 'austfree', upn: 'ss' },
  { id: 11, name: 'Stainless steel, martensitic (410, 416)', kc: 12, har: 'mart', red: 'mart', upn: 'ss' },
  { id: 12, name: 'Grey cast iron', kc: 15, lms: 12, uf: 'cimed', har: 'grey', red: 'grey' },
  { id: 13, name: 'Brass, free-cutting (C360)', kc: 27, lms: 13, uf: 'brass', har: 'brass', red: 'brass', upn: 'brass' },
  { id: 14, name: 'Bronze', kc: 27, lms: 14, uf: 'bronze', har: 'bronze', red: 'brass' },
  { id: 15, name: 'Aluminium, wrought (6061, 7075)', kc: 22, lms: 15, uf: 'al', har: 'alwr', red: 'al', upn: 'al' },
  { id: 16, name: 'Aluminium, cast', kc: 23, lms: 16, uf: 'al', har: 'alcast', red: 'al', upn: 'al' },
  { id: 17, name: 'Titanium alloy (Ti-6Al-4V)', kc: 37, uf: 'ti', har: 'ti', red: 'ti', upn: 'ti' },
  { id: 18, name: 'Nickel alloy (Inconel 718)', kc: 33, uf: 'inconel', har: 'ni', red: 'ni' },
  { id: 19, name: 'Plastics (acetal, acrylic)', kc: 0, uf: 'acetal', har: 'plastic', upn: 'plastic' },
];
const advMat = id => ADV_MATS.find(m => m.id === id);
// Gaylee Corporation, "Cutting speed recommendations: circular saws" (solid carbide, carbide-tipped and HSS saws), ft/min:
// [row as printed, hardness range as printed, carbide low, high, HSS low, high]. Kyocera's "Slitting saw parameters" reprints the carbide column.
// Each range covers the whole hardness range of the group, so the soft end of a group takes the high end of the speed.
const ADV_SAW = {
  fmcs: ['Free machining carbon steels, wrought', '100 to 425 HB', 130, 555, 30, 130], cs: ['Carbon steels, wrought', '85 to 425 HB', 105, 530, 25, 125],
  as: ['Alloy steels, wrought', '125 to 425 HB', 35, 425, 8, 100], ts: ['Tool steels, wrought', '100 to 375 HB', 35, 470, 8, 110],
  fmss: ['Free machining stainless steels, wrought', '135 to 425 HB', 150, 470, 35, 110], ss: ['Stainless steels, wrought', '135 to 425 HB', 35, 425, 8, 100],
  gci: ['Gray cast irons', '120 to 320 HB', 105, 470, 25, 110], alw: ['Aluminum alloys, wrought', '30 to 150 HB', 3400, 4250, 800, 1000],
  alc: ['Aluminum alloys, cast', '40 to 125 HB', 2125, 5315, 500, 1250], ti: ['Titanium alloys, wrought', '110 to 440 HB', 65, 530, 15, 125],
  cu: ['Copper alloys, wrought', '10 to 100 HRB', 340, 2125, 80, 500], ht: ['High temperature alloys, wrought and cast', '140 to 475 HB', 35, 255, 8, 60],
  tp: ['Plastics, thermoplastics', '', 1065, 1490, 250, 350],
};
// Which Gaylee row each BenchMate material class reads (BenchMate's own matching).
const ADV_SAW_OF = { 3: 'cs', 2: 'fmcs', 1: 'fmcs', 20: 'fmcs', 21: 'fmcs', 4: 'cs', 5: 'as', 6: 'as', 7: 'ts', 8: 'ts', 22: 'ts', 9: 'ss', 10: 'fmss', 11: 'ss', 12: 'gci',
  13: 'cu', 14: 'cu', 15: 'alw', 16: 'alc', 17: 'ti', 18: 'ht', 19: 'tp' };
// Feed per tooth the same sheet prints for all materials (in): carbide saws 0.0002 to 0.0015, HSS saws 0.002 to 0.006.
const ADV_SAW_FZ = { 1: [0.0002, 0.0015], 2: [0.002, 0.006] };
// Starting speed (m/min) and feed per tooth (mm) for a saw: tm 1 carbide, 2 HSS; sp and ag are the slider places 0 to 100.
function advSaw(W, matId, tm, sp, ag) {
  const row = ADV_SAW[ADV_SAW_OF[matId]], t = tm === 1 ? 1 : 2;
  if (!row) return null;
  const v = t === 1 ? [row[2], row[3]] : [row[4], row[5]], fz = ADV_SAW_FZ[t];
  return { row, v, fz, vc: W.range_pick(v[0], v[1], (isFinite(sp) ? sp : 50) / 100) * FT_M, chip: W.range_pick(fz[0], fz[1], (isFinite(ag) ? ag : 50) / 100) * IN_MM };
}
const ADV_MAT_OPTIONS = ADV_MATS.map(m => [m.id, m.name]);
const ADV_COOL = [[1, 'Flood or through-tool coolant (table figures)'], [2, 'Oil put on by hand: 60 % of speed and feed'], [3, 'Dry or mist: no published factor, table figures']];
const ADV_PUB = { har: 'Harvey Tool', red0: 'RedLine Tools, uncoated', red1: 'RedLine Tools, AlTiN coated', red2: 'RedLine Tools, TiCN coated', upn: 'University of Pennsylvania guide',
  uf: 'University of Florida design lab', lms: 'LittleMachineShop' };
// Publishers in the order the advisor tries them when the choice is left on "first that lists this material".
const ADV_MILL_SRC = [[0, 'The first publisher that lists this material'], [1, 'Harvey Tool (carbide)'], [2, 'RedLine Tools, uncoated (carbide)'], [3, 'RedLine Tools, AlTiN coated (carbide)'],
  [4, 'RedLine Tools, TiCN coated (carbide)'], [5, 'University of Pennsylvania guide'], [6, 'University of Florida design lab'], [9, 'My own speed and chip load']];
const ADV_MILL_KEYS = { 1: 'har', 2: 'red0', 3: 'red1', 4: 'red2', 5: 'upn', 6: 'uf' };

// Chip load at a diameter (inches) from a publisher's row of printed sizes. Between two printed sizes: the straight line
// (core lerp_at). Below the smallest: the straight line to zero. Above the largest: the largest figure. Returns [value, how].
function advAtSize(W, D, Y, d) {
  const n = D.length, eps = 1e-9;
  if (d < D[0] - eps) return [W.lerp_at(0, 0, D[0], Y[0], d), 'below'];
  if (d > D[n - 1] + eps) return [Y[n - 1], 'above'];
  for (let i = 0; i < n; i++) if (Math.abs(d - D[i]) <= eps) return [Y[i], 'printed'];
  let i = 0; while (i < n - 2 && d > D[i + 1]) i++;
  return [W.lerp_at(D[i], Y[i], D[i + 1], Y[i + 1], d), 'between'];
}
const ADV_HOW = { printed: 'a printed size', between: 'between two printed sizes, read along the straight line', below: 'below the smallest printed size, scaled down with the diameter', above: 'above the largest printed size, largest figure used', range: 'printed for 1/2 to 1-1/2 in cutters' };
// What each publisher prints for end milling this material with this tool material (1 carbide, 2 HSS) at diameter d (inches).
// Each entry: { key, pub, row, v: [low, high] ft/min, open (printed as "more than"), fz: [low, high] in/tooth, how, note }.
function advMillEntries(W, m, tm, d) {
  const out = [];
  const add = (key, row, v, open, fz, how, note) => out.push({ key, pub: ADV_PUB[key], row, v, open, fz, how, note: note || '' });
  if (tm === 1) {
    const h = ADV_HAR[m.har];
    if (h) { const c = advAtSize(W, ADV_HAR_D, h[3], d); add('har', h[0], [h[1], h[2]], false, [c[0], c[0]], c[1]); }
    const r = ADV_RED[m.red];
    if (r) [0, 1, 2].forEach(i => { const lo = advAtSize(W, ADV_RED_D, r[4].map(x => x[0]), d), hi = advAtSize(W, ADV_RED_D, r[4].map(x => x[1]), d);
      add('red' + i, r[0], [r[1 + i][0], r[1 + i][1] == null ? r[1 + i][0] : r[1 + i][1]], r[1 + i][1] == null, [lo[0], hi[0]], lo[1]); });
    const p = ADV_UPN[m.upn];
    if (p) { const c = advAtSize(W, ADV_UPN_D, p[2], d); add('upn', p[0], [p[1][0], p[1][1] == null ? p[1][0] : p[1][1]], p[1][1] == null, [c[0], c[0]], c[1]); }
    const u = ADV_UF[m.uf];
    if (u) { const v = W.apply_factor(u[1], 2.5), s = advUfChip(W, u, d); add('uf', u[0], [v, v], false, s.fz, s.how, '2.5 x the HSS speed of ' + u[1] + ' ft/min; chip load from the HSS table'); }
  } else {
    const u = ADV_UF[m.uf];
    if (u) { const s = advUfChip(W, u, d); add('uf', u[0], [u[1], u[1]], false, s.fz, s.how); }
    const p = ADV_UPN[m.upn];
    if (p) { const c = advAtSize(W, ADV_UPN_D, p[4], d); add('upn', p[0], [p[3], p[3]], false, [c[0], c[0]], c[1]); }
  }
  return out;
}
// University of Florida chip load: printed for 1/2 to 1-1/2 in cutters; smaller cutters are scaled down with the diameter.
function advUfChip(W, u, d) {
  if (d >= 0.5 - 1e-9) return { fz: [u[2], u[3]], how: d > 1.5 + 1e-9 ? 'above' : 'range' };
  return { fz: [W.lerp_at(0, 0, 0.5, u[2], d), W.lerp_at(0, 0, 0.5, u[3], d)], how: 'below' };
}
const advNum = x => (x === '' || x == null) ? 0 : (Number(x) > 0 ? Number(x) : 0);
// Machine limits: a typed box wins, then the active machine profile. live: use the driven-tool top speed.
function advMachine(v, live) {
  const m = typeof Profiles !== 'undefined' ? Profiles.active() : null;
  const pick = (typed, prof) => typed > 0 ? [typed, 'entered'] : (m && advNum(prof) > 0 ? [advNum(prof), m.name] : [0, '']);
  const n = pick(v.nmax, m ? (live ? m.live_rpm_max : m.rpm_max) : 0), f = pick(v.vfmax, m ? m.feed_max : 0);
  const p = live && !(v.pmax > 0) ? [0, ''] : pick(v.pmax, m ? m.power_kw : 0), t = live && !(v.tmax > 0) ? [0, ''] : pick(v.tmax, m ? m.torque_nm : 0);
  return { name: m ? m.name : '', n: n[0], nSrc: n[1], vf: f[0], vfSrc: f[1], p: p[0], pSrc: p[1], t: t[0], live: !!live };
}
const ADV_MACHINE_FIELDS = [
  { level: 'advanced', id: 'nmax', label: 'Top spindle speed (blank = active machine)', unit: 'RPM', def: '' },
  { level: 'advanced', id: 'vfmax', label: 'Top feed rate (blank = active machine)', unit: 'mm/min', def: '' },
  { level: 'advanced', id: 'pmax', label: 'Spindle power (blank = active machine)', unit: 'kW', def: '' },
  { level: 'advanced', id: 'tmax', label: 'Spindle torque (blank = active machine)', unit: 'N·m', def: '' },
  { level: 'advanced', id: 'eta', label: 'Machine efficiency', unit: '0-1', def: 0.8 },
];
const ADV_LIMITS = { 1: 'Tool deflection', 2: 'Spindle power', 3: 'Spindle torque', 7: 'Top spindle speed', 8: 'Top feed rate' };
// 'of Haas VF-2' or 'you entered', after 'the top speed' and the like.
const advOf = src => (src === 'entered' ? 'you entered' : src ? 'of ' + src : 'of the machine');
const advTile = (name, value, note, state) => '<div class="tile ' + state + '"><b>' + name + '</b><span>' + value + '</span><i>' + note + '</i></div>';
// Display bands for a share of a limit: up to 80 % good, to 100 % caution, above that over. These bands only colour the tile.
const advBand = u => (u > 1.0005 ? 'over' : u > 0.8 ? 'caution' : 'good');
const advPct = u => Math.round(u * 100) + ' %';
const advCard = (name, why, fix, over) => '<div class="limcard' + (over ? ' over' : '') + '"><h3>What is limiting this cut</h3><div class="lname">' + name + '</div><p>' + why + '</p>' + (fix ? '<p class="fix"><b>One fix:</b> ' + fix + '</p>' : '') + '</div>';
const ADV_START_NOTE = 'A starting point from published tables, not a promise. Publishers differ, tools and setups differ: start here, listen to the cut and adjust.';
// Deflection limits used when the box is blank: BenchMate\'s own starting figures (0.05 mm roughing, 0.01 mm finishing).
const advDeflDefault = op => (op === 3 ? 0.01 : 0.05);

// One evaluation of the milling advisor, shared by the result rows, the suggestions, the panel, the table and the drawing.
function advMillRun(v, W, s) {
  const inch = s === 'inch', k = inch ? IN_MM : 1, m = advMat(v.mat);
  if (!m || !(v.d > 0 && v.z > 0)) return null;
  const tm = v.tm === 2 ? 2 : 1, dmm = v.d * k, din = dmm / IN_MM;
  const entries = advMillEntries(W, m, tm, din);
  let e = null, fell = '';
  if (v.src !== 9) {
    e = entries.find(x => x.key === ADV_MILL_KEYS[v.src]) || null;
    if (!e && entries.length) { e = entries[0]; if (v.src > 0) fell = (ADV_MILL_SRC.find(o => o[0] === v.src) || ['', ''])[1] + ' prints nothing for this material and tool material.'; }
  }
  const tS = (isFinite(v.sp) ? v.sp : 50) / 100, tA = (isFinite(v.ag) ? v.ag : 50) / 100, tH = (isFinite(v.hard) ? v.hard : 50) / 100;
  const cool = v.cool === 2 ? 0.6 : 1;
  let vTab = NaN, chipTab = NaN;
  if (e) { vTab = W.range_pick(e.v[0], e.v[1], tS) * FT_M; chipTab = W.range_pick(e.fz[0], e.fz[1], tA) * IN_MM; }
  if (v.vown > 0) vTab = inch ? v.vown * FT_M : v.vown;
  if (v.fzown > 0) chipTab = v.fzown * k;
  if (!(vTab > 0 && chipTab > 0)) return { m, tm, entries, e, none: true, fell };
  const vc = W.apply_factor(vTab, cool), chip = W.apply_factor(chipTab, cool);
  const op = [0, 1, 2, 3].includes(v.op) ? v.op : 1, lf = v.lf > 0 ? v.lf * k : 0;
  const sAe = W.mill_engagement(op, dmm, lf, tH, 0), sAp = W.mill_engagement(op, dmm, lf, tH, 1);
  const aeL = v.ae > 0, apL = v.ap > 0, ae = aeL ? Math.min(v.ae * k, dmm) : sAe, ap = apL ? v.ap * k : sAp;
  const g = kcGroup(m.kc), mach = advMachine(v, v.spn === 1), pE = E_PRESETS[tm], eGpa = v.E > 0 ? v.E * eField(s).k : pE.gpa;
  const lim = v.lim > 0 ? v.lim * k : advDeflDefault(op), ratio = v.ratio > 0 ? v.ratio : 1;
  const args = [dmm, v.z, v.dsh > 0 ? v.dsh * k : 0, v.L > 0 ? v.L * k : 0, lf, v.kf > 0 ? v.kf : 0, eGpa, vc, chip, g ? g[5] : 0, g && g[6] != null ? g[6] : 0, ae, ap,
    (apL ? 1 : 0) + (aeL ? 2 : 0), mach.n, mach.vf, mach.p, mach.t, v.eta > 0 ? v.eta : 0, ratio, v.L > 0 ? lim : 0];
  const A = i => W.advise_mill(...args, i);
  return { m, tm, entries, e, fell, g, mach, op, k, inch, vTab, chipTab, cool, vc, chip, sAe, sAp, aeL, apL, ae0: ae, ap0: ap, lim, limOwn: v.lim > 0, ratio, eGpa, eSrc: v.E > 0 ? 'as entered' : pE.name + ' preset', A,
    srcAe: W.mill_engagement(op, dmm, lf, tH, 2), srcAp: W.mill_engagement(op, dmm, lf, tH, 3), dmm,
    rpm: A(0), vcA: A(1), fz: A(2), vf: A(3), ae: A(4), ap: A(5), hm: A(6), hex: A(7), kc: A(8), q: A(9), pNet: A(10), pSp: A(11), tq: A(12), defl: A(13),
    limit: A(14), reduced: A(15), rpmCap: A(16) > 0, feedCap: A(17) > 0, useD: A(18), useP: A(19), pAv: A(20), solid: A(21) > 0, rpmTab: A(22) };
}
const ADV_ENG_SRC = { 1: 'Mitsubishi Materials', 2: 'Helical Solutions', 3: "BenchMate's own starting figure", 4: 'full width: a slot' };
const ADV_OPS = [[1, 'Roughing on the side (shoulder)'], [0, 'Slotting (full width)'], [2, 'High-speed or adaptive path (light width, full depth)'], [3, 'Finishing a wall']];

TOOLS.push(
{
  id: 'advmill', level: 'advanced', group: 'Speeds and feeds', title: 'Milling advisor',
  pick: { map: { d: 'dia', dsh: 'shank', L: 'stick', lf: 'flute_len', tm: 'material', z: 'flutes' }, clear: ['dsh', 'lf'] },
  desc: 'Pick the material and the end mill: the advisor starts from a published speed and chip load, suggests a width and depth of cut, then checks them against your machine and the stiffness of the tool and says in plain words what limits the cut. Type your own width or depth and it is locked: the advice works around it.',
  fields: s => [
    { id: 'mat', label: 'Work material', unit: '', def: 3, options: ADV_MAT_OPTIONS, wide: true },
    { id: 'tm', label: 'Tool material', unit: '', def: 1, options: [[1, 'Solid carbide'], [2, 'High speed steel (HSS)']] },
    { id: 'op', label: 'Kind of cut', unit: '', def: 1, options: ADV_OPS, wide: true },
    { id: 'd', label: 'End mill diameter D', unit: lenU(s), def: s === 'inch' ? 0.5 : 12 },
    { id: 'z', label: 'Number of flutes', unit: '', def: 4 },
    { id: 'L', label: 'Stick-out (holder face to tip)', unit: lenU(s), def: s === 'inch' ? 1.5 : 40 },
    { id: 'lf', label: 'Flute length', unit: lenU(s), def: s === 'inch' ? 1 : 26 },
    { id: 'ae', label: 'Width of cut ae (blank = suggested)', unit: lenU(s), def: '', lock: true },
    { id: 'ap', label: 'Depth of cut ap (blank = suggested)', unit: lenU(s), def: '', lock: true },
    { id: 'hard', label: 'How hard is this cut', unit: '', def: 50, slider: { min: 0, max: 100, step: 5, labels: ['Light', 'Balanced', 'Heavy'] } },
    { id: 'ag', label: 'Aggressiveness (chip load in the printed range)', unit: '', def: 50, slider: { min: 0, max: 100, step: 5, labels: ['Gentle', 'Middle', 'Aggressive'] } },
    { id: 'sp', label: 'Speed in the printed range (hard stock: low)', unit: '', def: 50, slider: { min: 0, max: 100, step: 5, labels: ['Low', 'Middle', 'High'] } },
    { id: 'cool', label: 'Coolant', unit: '', def: 1, options: ADV_COOL, wide: true },
    { level: 'advanced', id: 'src', label: 'Starting figures from', unit: '', def: 0, options: ADV_MILL_SRC, wide: true },
    { level: 'advanced', id: 'vown', label: 'Your own cutting speed (wins over the table)', unit: spdU(s), def: '' },
    { level: 'advanced', id: 'fzown', label: 'Your own chip load (wins over the table)', unit: lenU(s), def: '' },
    { level: 'advanced', id: 'spn', label: 'Spindle', unit: '', def: 0, options: [[0, 'Main spindle'], [1, 'Driven (live) tool']] },
    { level: 'advanced', id: 'lim', label: 'Deflection allowed at the tip (blank = 0.05 mm rough, 0.01 mm finish)', unit: lenU(s), def: '' },
    { level: 'advanced', id: 'dsh', label: 'Shank diameter (blank = D)', unit: lenU(s), def: '' },
    { level: 'advanced', id: 'kf', label: 'Effective flute diameter / D (blank = solid rod)', unit: 'x D', def: '' },
    { level: 'advanced', id: 'E', label: "Young's modulus E (blank = preset)", unit: eField(s).u, def: '' },
    { level: 'advanced', id: 'ratio', label: 'Bending force / tangential force (blank = 1)', unit: '', def: '' },
  ].concat(ADV_MACHINE_FIELDS),
  suggest: (v, W, s) => { const r = advMillRun(v, W, s); return r && !r.none ? { ae: r.sAe / r.k, ap: r.sAp / r.k } : {}; },
  calc: (v, W, s) => {
    const r = advMillRun(v, W, s);
    if (!r) return [];
    if (r.none) return [R('Starting figures', r.entries.length ? 'Pick a publisher, or type your own speed and chip load' : 'No publisher in the table lists this material for this tool material: type your own speed and chip load (Advanced)', '', 0)];
    const inch = r.inch, k = r.k, lu = lenU(s), dpL = inch ? 4 : 3, dpF = inch ? 5 : 4;
    const how = (locked, v0, vNow, what, src) => (locked ? 'yours, locked' : Math.abs(vNow - v0) > 1e-9 * v0 ? 'reduced from ' + fmt(v0 / k, dpL) + ' ' + lu + ' to fit ' + what : 'suggested: ' + src);
    const limName = (ADV_LIMITS[r.limit] || '').toLowerCase();
    const rows = [
      R('Spindle speed', r.rpm, 'RPM', 0),
      R('Table feed', r.vf / k, feedMinU(s), inch ? 2 : 0),
      R('Feed per tooth', r.fz / k, lu, dpF),
      R('Cutting speed at the tool', inch ? r.vcA / FT_M : r.vcA, spdU(s), 0),
      R('Width of cut ae (' + how(r.aeL, r.ae0, r.ae, limName, ADV_ENG_SRC[r.srcAe]) + ')', r.ae / k, lu, dpL),
      R('Depth of cut ap (' + how(r.apL, r.ap0, r.ap, limName, ADV_ENG_SRC[r.srcAp]) + ')', r.ap / k, lu, dpL),
      R('Removal rate', inch ? r.q / IN3_CM3 : r.q, inch ? 'in3/min' : 'cm3/min', 2),
    ];
    if (isFinite(r.pSp)) {
      rows.push(R('Spindle power needed', r.pSp, 'kW', 2));
      if (inch) rows.push(R('Spindle power needed', r.pSp * KW_HP, 'hp', 2));
      rows.push(R('Spindle torque needed', inch ? r.tq * NM_LBFIN : r.tq, inch ? 'lbf in' : 'N m', inch ? 1 : 2));
    } else rows.push(R('Power and torque', 'No specific cutting force is published for this material group, so power, torque and deflection are not worked out', '', 0));
    if (isFinite(r.defl)) rows.push(R('Tool tip deflection', r.defl / k, lu, inch ? 5 : 4));
    rows.push(R('Chip thickness: mean hm', r.hm / k, lu, dpF), R('Chip thickness: largest hex', r.hex / k, lu, dpF));
    if (isFinite(r.kc)) rows.push(R('Specific cutting force kc at hm (Iscar group ' + r.g[0] + ')', r.kc, 'N/mm2', 0));
    // The table value beside the corrected one.
    const e = r.e, src = v.vown > 0 ? 'your own figure' : e.pub + (r.cool < 1 ? ', before the coolant factor' : '');
    rows.push(R('From the table: cutting speed (' + src + ')', inch ? r.vTab / FT_M : r.vTab, spdU(s), 0));
    rows.push(R('From the table: chip load (' + (v.fzown > 0 ? 'your own figure' : e.pub + ', ' + ADV_HOW[e.how]) + ')', r.chipTab / k, lu, dpF));
    rows.push(R('From the table: spindle speed', r.rpmTab, 'RPM', 0));
    if (r.cool < 1) rows.push(R('Coolant factor on speed and feed (University of Florida, oil by hand)', r.cool, 'x', 2));
    if (Math.abs(r.fz - r.chip) > 1e-9 * r.chip && !r.feedCap && r.reduced !== 3) rows.push(R('Chip thinning: feed per tooth raised to keep the chip thickness', W.rctf(r.ae, r.dmm), 'x', 3));
    if (r.fell) rows.push(R('Publisher', r.fell + ' Using ' + e.pub + '.', '', 0));
    if (v.cool === 3) rows.push(cfNote('Dry or mist: no publisher in the table prints a factor for it, so the table figures are used unchanged. Watch the heat and the chips.'));
    if (e && e.open && !(v.vown > 0)) rows.push(cfNote(e.pub + ' prints this speed as "more than ' + e.v[0] + ' ft/min": the low figure is used.'));
    if (r.solid && v.lf > 0) rows.push(cfNote('Deflection treats the tool as a solid rod of the shank diameter: the fluted part is weaker, so the real figure is higher. Enter the effective flute diameter (Advanced) if you have it.'));
    rows.push(R('Note', ADV_START_NOTE, '', 0));
    return rows;
  },
  panel: (v, W, s) => {
    const r = advMillRun(v, W, s);
    if (!r || r.none) return '';
    const inch = r.inch, k = r.k, lu = lenU(s), f = (x, dp) => fmt(x, dp);
    let tiles = advTile('Spindle speed', f(r.rpm, 0) + ' RPM', r.rpmCap ? 'held to the top speed ' + advOf(r.mach.nSrc) : r.mach.n > 0 ? 'inside the top speed ' + advOf(r.mach.nSrc) : 'no machine picked', r.rpmCap ? 'caution' : 'good');
    if (isFinite(r.useP)) tiles += advTile(r.limit === 3 ? 'Torque' : 'Power', advPct(r.useP), 'of ' + f(r.pAv, 2) + ' kW at this speed', advBand(r.useP));
    else tiles += advTile('Power', isFinite(r.pSp) ? f(r.pSp, 2) + ' kW' : 'not worked out', r.mach.live ? 'driven tool: type its power to check it' : 'pick a machine to check it', '');
    if (isFinite(r.useD)) tiles += advTile('Deflection', f(r.defl / k, inch ? 5 : 3) + ' ' + lu, advPct(r.useD) + ' of ' + f(r.lim / k, inch ? 4 : 2) + ' ' + lu + (r.limOwn ? '' : ' (starting figure)'), advBand(r.useD));
    else tiles += advTile('Deflection', 'not worked out', 'enter the stick-out', '');
    const red = r.reduced === 1 ? 'The depth of cut was reduced from ' + f(r.ap0 / k, 3) + ' to ' + f(r.ap / k, 3) + ' ' + lu + '.' : r.reduced === 2 ? 'Your depth is locked, so the width of cut was reduced from ' + f(r.ae0 / k, 3) + ' to ' + f(r.ae / k, 3) + ' ' + lu + '.'
      : r.reduced === 3 && !r.feedCap ? 'Your width and depth are locked, so the feed per tooth was reduced to ' + f(r.fz / k, inch ? 5 : 4) + ' ' + lu + '.' : '';
    let card;
    if (r.limit === 1) card = advCard('Tool deflection', 'At the table feed the tool tip would bend more than ' + f(r.lim / k, inch ? 4 : 2) + ' ' + lu + '. ' + red, 'Shorten the stick-out. Deflection goes with its cube, so a quarter less stick-out more than halves it.');
    else if (r.limit === 2) card = advCard('Spindle power', 'The cut would need more than the ' + f(r.pAv, 2) + ' kW the spindle has at this speed. ' + red, r.reduced === 1 ? 'Nothing more to do: the reduced depth of cut fits. For more removal, a narrower and deeper cut uses the same power with less deflection.' : 'Unlock the depth of cut and let it come down instead.');
    else if (r.limit === 3) card = advCard('Spindle torque', 'This speed is below the base speed of the spindle, where it gives torque, not full power: ' + f(r.pAv, 2) + ' kW here. ' + red, 'Use a smaller cutter: torque is cutting force times the cutter radius, and the smaller cutter also runs faster.');
    else if (r.limit === 8) card = advCard('Top feed rate', 'The table feed would be more than ' + r.mach.vf + ' mm/min, the top feed ' + advOf(r.mach.vfSrc) + ', so the feed per tooth was reduced to ' + f(r.fz / k, inch ? 5 : 4) + ' ' + lu + '.', 'Take a wider or deeper cut at this feed: the chip is thinner than the table asks for, so there is room.');
    else if (r.limit === 7) card = advCard('Top spindle speed', 'The table speed needs ' + f(r.rpmTab, 0) + ' RPM. The top speed is ' + f(r.mach.n, 0) + ' RPM, so the tool cuts at ' + f(inch ? r.vcA / FT_M : r.vcA, 0) + ' ' + spdU(s) + ' and the feed follows the speed.', 'Use a larger cutter if the job allows: it reaches the table speed at fewer RPM.');
    else card = advCard('Nothing', 'The table speed and chip load fit' + (r.mach.name ? ' ' + r.mach.name : '') + (isFinite(r.useD) ? (r.mach.name ? ' and' : '') + ' the stiffness of the tool.' : '.') + (r.mach.name ? '' : ' No machine is picked, so power, torque and top speed are not checked: pick one in the title bar.'), '');
    return '<div class="tiles">' + tiles + '</div>' + card;
  },
  table: (v, W, s) => {
    const r = advMillRun(v, W, s);
    if (!r || !r.entries.length) return null;
    const inch = r.inch, sp = x => fmt(inch ? x : x * FT_M, 0), cl = x => fmt(inch ? x : x * IN_MM, inch ? 4 : 3);
    const used = r.e, lo = used ? used.v[0] : 0, hi = used ? used.v[1] : 0;
    const rows = r.entries.map(e => [e.pub, e.row + (e.note ? ' (' + e.note + ')' : ''), (e.open ? 'over ' + sp(e.v[0]) : e.v[0] === e.v[1] ? sp(e.v[0]) : sp(e.v[0]) + ' to ' + sp(e.v[1])) + ' ' + spdU(s),
      (e.fz[0] === e.fz[1] ? cl(e.fz[0]) : cl(e.fz[0]) + ' to ' + cl(e.fz[1])) + ' ' + lenU(s), e === used && !(v.vown > 0) ? 'used' : !used ? '' : (e.open || used.open || (e.v[0] <= hi && e.v[1] >= lo)) ? 'speeds overlap' : e.v[0] > hi ? 'prints a higher speed' : 'prints a lower speed']);
    const lm = ADV_LMS[r.m.lms];
    if (lm && r.tm === 2) rows.push([ADV_PUB.lms, lm[0] + ' (milling table; tool material not stated)', (lm[3][0] === lm[3][1] ? sp(lm[3][0]) : sp(lm[3][0]) + ' to ' + sp(lm[3][1])) + ' ' + spdU(s), 'not printed', 'speed only']);
    return { title: 'What each publisher prints for this material, ' + (r.tm === 1 ? 'carbide' : 'HSS') + ' end mill of this size', head: ['Publisher', 'Row as printed', 'Speed', 'Chip load per tooth', ''], rows, text: true };
  },
  sends: (v, W, s) => {
    const r = advMillRun(v, W, s);
    if (!r || r.none) return [];
    const k = r.k;
    return [['Check this cut in detail', 'cutopt', { d: v.d, dsh: v.dsh > 0 ? v.dsh : '', L: v.L, lf: v.lf > 0 ? v.lf : '', kf: v.kf > 0 ? v.kf : '', mat: r.tm, z: v.z, ae: r.ae / k, ap: r.ap / k, fz: r.fz / k,
      speed: r.inch ? r.vcA / FT_M : r.vcA, rpm: '', kc: isFinite(r.kc) ? Math.round(r.kc) : '', ratio: r.ratio, lim: r.lim / k }],
      ['Feed rate calculator', 'feed', { rpm: Math.round(r.rpm), z: v.z, fz: r.fz / k }]];
  },
  working: 'Order of work. 1: starting cutting speed and chip load from the chosen publisher\'s table for the material, tool material and cutter diameter; the sliders pick a place inside the printed range. Between two printed diameters the chip load is read along the straight line; below the smallest it is scaled down with the diameter. 2: coolant factor. 3: spindle speed n = 1000 Vc / (pi D), held to the machine\'s top speed. 4: width ae and depth ap suggested for the kind of cut (slot: full width, depth 0.2 D to 1 D; shoulder roughing: half the diameter wide, one diameter deep; high-speed path: 7 to 30 % of D wide, up to 2 D deep; finishing: 2 to 5 % of D wide, 1.5 D deep), depth held to the flute length. 5: feed per tooth fz = chip load x chip thinning factor for the width (1 at half the diameter or more), so the chip keeps its thickness in a light cut. 6: table feed Vf = n x z x fz, held to the machine\'s top feed. 7: specific cutting force kc = kc1.1 x hm^(-mc) at the mean chip thickness. 8: power Pc = ae x ap x Vf x kc / 60 000 000 kW, spindle power = Pc / efficiency, torque = P x 60 000 / (2 pi n), checked against P(n) = min(P_max, T_max x 2 pi n / 60 000). 9: tool tip deflection as a cantilever under the tangential force (x the bending ratio). If a limit is passed the depth is reduced; if you locked the depth, the width; if you locked both, the feed. A locked value is never changed. The chip loads are used as the chip thickness for a cut half the diameter wide or wider. BenchMate\'s own starting figures, which no publisher prints: 1 D depth for shoulder roughing, 1.5 D for finishing, bending force equal to the tangential force, 0.05 mm (rough) and 0.01 mm (finish) allowed deflection, and tile colours at 80 % and 100 % of a limit.',
  source: 'Speeds and chip loads: Harvey Tool, "General Machining Guidelines"; RedLine Tools catalogue p. 216 (general purpose carbide end mills); University of Pennsylvania MEAM, "Feeds and Speeds" guide; University of Florida MAE design lab, "Speeds and Feeds" (HSS speeds, chip loads, carbide factor 2.5, 60 % for oil by hand); LittleMachineShop, "Cutting Speeds". Width and depth: Mitsubishi Materials course "Depth of cut"; Helical Solutions, Machining Guidebook (2016) pp. 11, 31-32. kc: Iscar material groups. Formulas: Sandvik Coromant milling formulas; beam deflection: Gere and Goodno. See docs/sources.md, "Advisor".',
},
);

// ---------------- Drilling, reaming and turning ----------------
// Open Oregon Educational Resources, "Manufacturing Processes 4-5", unit 2, Table 1 "Cutting speeds for material types" (ft/min).
// The table names neither the tool material nor the operation, so it is shown for comparison only and never used as the start.
const ADV_OO = { low: ['Low carbon steel', 40, 140], med: ['Medium carbon steel', 70, 120], free: ['Free-machining steel', 100, 150], ss304: ['Stainless steel 302, 304', 60, 60],
  alloy: ['Alloy steel SAE 4130, 4140', 70, 70], tool: ['Tool steel', 40, 70], grey: ['Gray cast iron', 50, 80], al: ['Aluminum alloys', 300, 400], ti: ['Titanium alloy', 20, 60],
  inconel: ['Nickel alloy, Inconel', 5, 10], bronze: ['Bronze, regular', 90, 150], brass: ['Brass and aluminum', 200, 350] };
const ADV_OO_OF = { 3: 'low', 2: 'free', 1: 'free', 20: 'free', 21: 'free', 4: 'med', 5: 'alloy', 7: 'tool', 8: 'tool', 22: 'tool', 9: 'ss304', 12: 'grey', 13: 'brass', 14: 'bronze', 15: 'al', 16: 'al', 17: 'ti', 18: 'inconel' };
ADV_PUB.oo = 'Open Oregon, Manufacturing Processes 4-5'; ADV_PUB.ics = 'ICS Cutting Tools'; ADV_PUB.gam = 'Gammons Hoaglund'; ADV_PUB.mit = 'Mitsubishi Materials';
// ICS Cutting Tools, "Reaming recommendations": speed (ft/min) and feed (in/rev) by material class, stock to leave by reamer diameter (inches, on the diameter).
// No feed is printed for steel under Rockwell C30.
const ADV_ICS = { steel30: ['Steel, under Rockwell C30', 60, 90, null, null], steel3040: ['Steel, Rockwell C30 to 40', 35, 65, 0.004, 0.008], ci: ['Cast iron and malleable iron', 50, 85, 0.005, 0.012], nf: ['Non-ferrous materials', 90, 175, 0.005, 0.012] };
const ADV_ICS_OF = { 1: 'steel30', 2: 'steel30', 3: 'steel30', 4: 'steel30', 5: 'steel30', 20: 'steel30', 21: 'steel30', 7: 'steel30', 8: 'steel30', 22: 'steel30', 6: 'steel3040', 12: 'ci', 13: 'nf', 14: 'nf', 15: 'nf', 16: 'nf', 19: 'nf' };
const ADV_ICS_STOCK = [[0.0625, 0.003, 0.005], [0.125, 0.004, 0.008], [0.25, 0.006, 0.012], [0.375, 0.008, 0.014], [0.5, 0.010, 0.015], [0.75, 0.012, 0.018]];
const advIcsStock = din => ADV_ICS_STOCK.find(r => din <= r[0] + 1e-9) || null;
const advRange = (a, b, f) => (a === b ? f(a) : f(a) + ' to ' + f(b));
const advPickEntry = (entries, key) => entries.find(x => x.key === key) || null;
// Shared limit card for the hole and turning advisors.
function advHoleCard(r, s, what) {
  const f = (x, dp) => fmt(x, dp), inch = s === 'inch';
  if (r.limit === 2 || r.limit === 3) return advCard(r.limit === 3 ? 'Spindle torque' : 'Spindle power', 'The cut would need more than the ' + f(r.pAv, 2) + ' kW the spindle has at this speed. ' + (r.over ? 'Your values are locked, so nothing was changed: the cut is over the limit.' : r.redText), r.over ? 'Unlock the ' + what + ' and let it come down.' : r.fixText, r.over);
  if (r.limit === 8) return advCard('Top feed rate', 'The feed would be more than ' + r.mach.vf + ' mm/min, the top feed ' + advOf(r.mach.vfSrc) + ', so the feed per revolution was reduced.', 'Nothing more to do: a lower feed per revolution is safe for the tool.');
  if (r.limit === 7) return advCard('Top spindle speed', 'The table speed needs ' + f(r.rpmTab, 0) + ' RPM. The top speed is ' + f(r.mach.n, 0) + ' RPM, so the cut runs at ' + f(inch ? r.vcA / FT_M : r.vcA, 0) + ' ' + spdU(s) + '.', r.fixRpm);
  return advCard('Nothing', 'The table speed and feed fit' + (r.mach.name ? ' ' + r.mach.name + '.' : '. No machine is picked, so power, torque and top speed are not checked: pick one in the title bar.'), '');
}
function advHoleTiles(r, s) {
  const f = (x, dp) => fmt(x, dp);
  let t = advTile('Spindle speed', f(r.rpm, 0) + ' RPM', r.limit === 7 || r.rpmCap ? 'held to the top speed ' + advOf(r.mach.nSrc) : r.mach.n > 0 ? 'inside the top speed ' + advOf(r.mach.nSrc) : 'no machine picked', r.limit === 7 || r.rpmCap ? 'caution' : 'good');
  if (isFinite(r.useP)) t += advTile(r.limit === 3 ? 'Torque' : 'Power', advPct(r.useP), 'of ' + f(r.pAv, 2) + ' kW at this speed', advBand(r.useP));
  else if (r.hasForce) t += advTile('Power', isFinite(r.pSp) ? f(r.pSp, 2) + ' kW' : 'not worked out', r.mach.live ? 'driven tool: type its power to check it' : 'pick a machine to check it', '');
  return t;
}
const ADV_SRC_SIMPLE = pubs => [[0, 'The first publisher that lists this material']].concat(pubs, [[9, 'My own speed']]);

function advDrillRun(v, W, s) {
  const inch = s === 'inch', k = inch ? IN_MM : 1, m = advMat(v.mat);
  if (!m || !(v.d > 0)) return null;
  const tm = v.tm === 1 ? 1 : 2, dmm = v.d * k, din = dmm / IN_MM, entries = [], lm = ADV_LMS[m.lms], u = ADV_UF[m.uf], oo = ADV_OO[ADV_OO_OF[m.id]];
  if (tm === 2 && lm) entries.push({ key: 'lms', pub: ADV_PUB.lms, row: lm[0], v: lm[4] });
  if (u) { const x = tm === 1 ? W.apply_factor(u[1], 2.5) : u[1]; entries.push({ key: 'uf', pub: ADV_PUB.uf, row: u[0] + (tm === 1 ? ' (2.5 x the HSS speed of ' + u[1] + ' ft/min)' : ''), v: [x, x] }); }
  const want = { 1: 'lms', 2: 'uf' }[v.src];
  let e = v.src === 9 ? null : (advPickEntry(entries, want) || entries[0] || null);
  const fell = e && want && e.key !== want ? ADV_PUB[want] + ' prints nothing for this material and tool material.' : '';
  const tS = (isFinite(v.sp) ? v.sp : 50) / 100, tA = (isFinite(v.ag) ? v.ag : 50) / 100, cool = v.cool === 2 ? 0.6 : 1;
  let vTab = e ? W.range_pick(e.v[0], e.v[1], tS) * FT_M : NaN;
  if (v.vown > 0) vTab = inch ? v.vown * FT_M : v.vown;
  const fLo = W.drill_feed_range_in(din, 0), fHi = W.drill_feed_range_in(din, 1);
  if (!(vTab > 0)) return { m, tm, entries, none: true, oo };
  const vc = W.apply_factor(vTab, cool), fSug = W.apply_factor(W.range_pick(fLo, fHi, tA) * IN_MM, cool);
  const fL = v.f > 0, f0 = fL ? v.f * k : fSug, pt = v.pt > 0 ? v.pt : 118, g = kcGroup(m.kc), mach = advMachine(v, v.spn === 1);
  const args = [vc, dmm, f0, pt, g ? g[5] : 0, g && g[6] != null ? g[6] : 0, fL ? 1 : 0, mach.n, mach.vf, mach.p, mach.t, v.eta > 0 ? v.eta : 0];
  const D = i => W.advise_drill(...args, i);
  const r = { m, tm, entries, e, fell, oo, k, inch, g, mach, vTab, cool, vc, fSug, fL, f0, pt, dmm, din, fLo, fHi, hasForce: !!g,
    rpm: D(0), vcA: D(1), f: D(2), vf: D(3), rpmTab: D(4), limit: D(5), kc: D(6), tq: D(7), thrust: D(8), pSp: D(9), pAv: D(10), useP: D(11) };
  r.over = r.useP > 1.0005;
  r.redText = 'The feed per revolution was reduced from ' + fmt(r.f0 / k, inch ? 4 : 3) + ' to ' + fmt(r.f / k, inch ? 4 : 3) + ' ' + feedRevU(s) + '.';
  r.fixText = 'Nothing more to do: the reduced feed fits. A pilot hole also lowers the torque and thrust of a large drill.';
  r.fixRpm = 'Nothing more to do: a small drill at the top speed of the machine simply cuts below the table speed. The feed per revolution is unchanged.';
  return r;
}

function advReamRun(v, W, s) {
  const inch = s === 'inch', k = inch ? IN_MM : 1, m = advMat(v.mat);
  if (!m || !(v.d > 0)) return null;
  const dmm = v.d * k, din = dmm / IN_MM, lm = ADV_LMS[m.lms], u = ADV_UF[m.uf], ic = ADV_ICS[ADV_ICS_OF[m.id]];
  const dLo = W.drill_feed_range_in(din, 0), dHi = W.drill_feed_range_in(din, 1), entries = [];
  const twice = [W.apply_factor(dLo, 2), W.apply_factor(dHi, 2)];
  if (lm) entries.push({ key: 'lms', pub: ADV_PUB.lms, row: lm[0] + ' (reaming column)', v: lm[5], fz: twice, fnote: 'feed: twice the drill feed (University of Florida)' });
  if (ic) entries.push({ key: 'ics', pub: ADV_PUB.ics, row: ic[0], v: [ic[1], ic[2]], fz: ic[3] == null ? twice : [ic[3], ic[4]], fnote: ic[3] == null ? 'no feed printed for this class; twice the drill feed (University of Florida)' : '' });
  if (u) entries.push({ key: 'uf', pub: ADV_PUB.uf, row: u[0] + ': half the drill speed of ' + u[1] + ' ft/min, twice the drill feed', v: [W.apply_factor(u[1], 0.5), W.apply_factor(u[1], 0.5)], fz: twice, fnote: '' });
  const dr = lm ? lm[4] : u ? [u[1], u[1]] : null;
  if (dr) entries.push({ key: 'gam', pub: ADV_PUB.gam, row: 'Two thirds of the drilling speed (' + (lm ? ADV_PUB.lms : ADV_PUB.uf) + ': ' + advRange(dr[0], dr[1], x => x) + ' ft/min), 2 to 3 times the drill feed',
    v: [W.apply_factor(dr[0], 2 / 3), W.apply_factor(dr[1], 2 / 3)], fz: [W.apply_factor(dLo, 2), W.apply_factor(dHi, 3)], fnote: '' });
  const want = { 1: 'lms', 2: 'ics', 3: 'uf', 4: 'gam' }[v.src];
  const e = v.src === 9 ? null : (advPickEntry(entries, want) || entries[0] || null);
  const fell = e && want && e.key !== want ? ADV_PUB[want] + ' prints nothing for this material.' : '';
  const tS = (isFinite(v.sp) ? v.sp : 50) / 100, tA = (isFinite(v.ag) ? v.ag : 50) / 100, cool = v.cool === 2 ? 0.6 : 1;
  let vTab = e ? W.range_pick(e.v[0], e.v[1], tS) * FT_M : NaN, fTab = e ? W.range_pick(e.fz[0], e.fz[1], tA) * IN_MM : NaN;
  if (v.vown > 0) vTab = inch ? v.vown * FT_M : v.vown;
  const st = advIcsStock(din), stock3 = W.apply_factor(dmm, 0.03);
  if (!(vTab > 0) || !(v.f > 0 || fTab > 0)) return { m, entries, none: true, st, stock3, k, inch, dmm };
  const vc = W.apply_factor(vTab, cool), fSug = W.apply_factor(fTab, cool), fL = v.f > 0, f0 = fL ? v.f * k : fSug, mach = advMachine(v, v.spn === 1);
  const H = i => W.advise_hole(vc, dmm, f0, mach.n, mach.vf, i);
  const r = { m, entries, e, fell, k, inch, mach, vTab, fTab, cool, vc, fSug, fL, f0, dmm, din, st, stock3, hasForce: false,
    rpm: H(0), vcA: H(1), f: H(2), vf: H(3), rpmTab: H(4), limit: H(5), useP: NaN, pAv: NaN };
  r.fixRpm = 'Nothing more to do: reamers run slowly, and a lower speed only helps the finish.';
  return r;
}

function advTurnRun(v, W, s) {
  const inch = s === 'inch', k = inch ? IN_MM : 1, m = advMat(v.mat);
  if (!m || !(v.d > 0)) return null;
  const tm = v.tm === 2 ? 2 : 1, dmm = v.d * k, lm = ADV_LMS[m.lms], oo = ADV_OO[ADV_OO_OF[m.id]], entries = [];
  if (lm) entries.push({ key: 'lms', pub: ADV_PUB.lms, row: lm[0] + (tm === 1 ? ' (carbide column)' : ' (HSS column)'), v: tm === 1 ? lm[2] : lm[1] });
  const e = v.src === 9 ? null : entries[0] || null;
  const tS = (isFinite(v.sp) ? v.sp : 50) / 100, tA = (isFinite(v.ag) ? v.ag : 50) / 100, cool = v.cool === 2 ? 0.6 : 1;
  let vTab = e ? W.range_pick(e.v[0], e.v[1], tS) * FT_M : NaN;
  if (v.vown > 0) vTab = inch ? v.vown * FT_M : v.vown;
  const re = v.re > 0 ? v.re * k : NaN;
  // Mitsubishi Materials: a corner radius of 2 to 3 times the feed, so the feed is a third to a half of the radius.
  const fLo = W.apply_factor(re, 1 / 3), fHi = W.apply_factor(re, 1 / 2);
  if (!(vTab > 0)) return { m, tm, entries, none: true, oo };
  const vc = W.apply_factor(vTab, cool), fSug = W.apply_factor(W.range_pick(fLo, fHi, tA), cool), apSug = 0.040 * IN_MM;
  const fL = v.f > 0, apL = v.ap > 0, f0 = fL ? v.f * k : fSug, ap0 = apL ? v.ap * k : apSug;
  if (!(f0 > 0)) return { m, tm, entries, none: true, oo, needRe: true };
  const g = kcGroup(m.kc), mach = advMachine(v, false), kap = v.kap > 0 ? v.kap : 95;
  const args = [dmm, vc, f0, ap0, kap, g ? g[5] : 0, g && g[6] != null ? g[6] : 0, (apL ? 1 : 0) + (fL ? 2 : 0), mach.n, mach.p, mach.t, v.eta > 0 ? v.eta : 0];
  const T = i => W.advise_turn(...args, i);
  const r = { m, tm, entries, e, oo, k, inch, g, mach, vTab, cool, vc, fSug, apSug, fL, apL, f0, ap0, re, kap, dmm, fLo, fHi, hasForce: !!g,
    rpm: T(0), vcA: T(1), f: T(2), ap: T(3), h: T(4), kc: T(5), q: T(6), fc: T(7), pNet: T(8), pSp: T(9), pAv: T(10), tq: T(11), useP: T(12), limit: T(13), reduced: T(14), rpmCap: T(15) > 0, rpmTab: T(16) };
  r.over = r.reduced === 4;
  r.redText = r.reduced === 1 ? 'The depth of cut was reduced from ' + fmt(ap0 / k, inch ? 4 : 3) + ' to ' + fmt(r.ap / k, inch ? 4 : 3) + ' ' + lenU(s) + '.' : r.reduced === 3 ? 'Your depth is locked, so the feed was reduced from ' + fmt(f0 / k, inch ? 4 : 3) + ' to ' + fmt(r.f / k, inch ? 4 : 3) + ' ' + feedRevU(s) + '.' : '';
  r.fixText = r.limit === 3 ? 'Take the depth in more passes. Below its base speed the spindle gives torque, not full power; on a geared head a lower gear gives more torque at this speed.' : 'Nothing more to do: the reduced cut fits. More passes at this depth remove the same metal.';
  r.fixRpm = 'Nothing more to do: a small diameter at the top speed of the lathe simply cuts below the table speed.';
  return r;
}

TOOLS.push(
{
  id: 'advdrill', level: 'advanced', group: 'Drilling and tapping', title: 'Drilling advisor',
  pick: { map: { d: 'dia' }, types: ['Drill'] },
  desc: 'Speed and feed for a twist drill from published tables for the material and the drill diameter, checked against your machine for top speed, top feed, power and torque, with the point length, removal rate, time to depth and a drilling cycle.',
  fields: s => [
    { id: 'mat', label: 'Work material', unit: '', def: 3, options: ADV_MAT_OPTIONS, wide: true },
    { id: 'tm', label: 'Drill material', unit: '', def: 2, options: [[2, 'High speed steel (HSS)'], [1, 'Solid carbide']] },
    { id: 'd', label: 'Drill diameter', unit: lenU(s), def: s === 'inch' ? 0.375 : 10 },
    { id: 'f', label: 'Feed per revolution (blank = suggested)', unit: feedRevU(s), def: '', lock: true },
    { id: 'depth', label: 'Hole depth at full diameter (optional)', unit: lenU(s), def: s === 'inch' ? 0.75 : 20 },
    { id: 'pt', label: 'Point angle', unit: 'deg', def: 118 },
    { id: 'ag', label: 'Feed in the printed range (hard or strong stock: low)', unit: '', def: 50, slider: { min: 0, max: 100, step: 5, labels: ['Gentle', 'Middle', 'Aggressive'] } },
    { id: 'sp', label: 'Speed in the printed range (hard stock: low)', unit: '', def: 50, slider: { min: 0, max: 100, step: 5, labels: ['Low', 'Middle', 'High'] } },
    { id: 'cool', label: 'Coolant', unit: '', def: 1, options: ADV_COOL, wide: true },
    { level: 'advanced', id: 'src', label: 'Starting speed from', unit: '', def: 0, options: ADV_SRC_SIMPLE([[1, 'LittleMachineShop (drilling table)'], [2, 'University of Florida design lab']]), wide: true },
    { level: 'advanced', id: 'vown', label: 'Your own cutting speed (wins over the table)', unit: spdU(s), def: '' },
    { level: 'advanced', id: 'spn', label: 'Spindle', unit: '', def: 0, options: [[0, 'Main spindle'], [1, 'Driven (live) tool']] },
  ].concat(ADV_MACHINE_FIELDS),
  suggest: (v, W, s) => { const r = advDrillRun(v, W, s); return r && !r.none ? { f: r.fSug / r.k } : {}; },
  calc: (v, W, s) => {
    const r = advDrillRun(v, W, s);
    if (!r) return [];
    if (r.none) return [R('Starting speed', 'No publisher in the table lists this material for this drill material: type your own cutting speed (Advanced)', '', 0)];
    const inch = r.inch, k = r.k, lu = lenU(s), dpF = inch ? 4 : 3;
    const fHow = r.fL ? (r.f < r.f0 * (1 - 1e-9) ? 'yours, reduced to the top feed of the machine' : 'yours, locked') : r.f < r.f0 * (1 - 1e-9) ? 'reduced from ' + fmt(r.f0 / k, dpF) + ' to fit ' + (ADV_LIMITS[r.limit] || 'the machine').toLowerCase() : 'suggested: University of Florida table for this diameter';
    const rows = [
      R('Spindle speed', r.rpm, 'RPM', 0),
      R('Feed per revolution (' + fHow + ')', r.f / k, feedRevU(s), dpF),
      R('Feed rate', r.vf / k, feedMinU(s), inch ? 2 : 0),
      R('Cutting speed at the drill', inch ? r.vcA / FT_M : r.vcA, spdU(s), 0),
    ];
    const pl = W.drill_point_length(r.dmm, r.pt), q = W.mrr_drilling_cm3_min(r.dmm, r.vf);
    rows.push(R('Point length to add to the depth', pl / k, lu, dpF));
    if (v.depth > 0) { const t = W.drill_time_min(v.depth * k, pl, r.f, r.rpm); rows.push(R('Time to depth (depth and point at the feed)', t * 60, 's', 1)); }
    rows.push(R('Removal rate', inch ? q / IN3_CM3 : q, inch ? 'in3/min' : 'cm3/min', 2));
    if (isFinite(r.kc)) {
      rows.push(R('Torque', inch ? r.tq * NM_LBFIN : r.tq, inch ? 'lbf in' : 'N m', inch ? 1 : 2), R('Feed force (thrust)', inch ? r.thrust / LBF_N : r.thrust, inch ? 'lbf' : 'N', 0));
      if (isFinite(r.pSp)) rows.push(R('Spindle power needed', r.pSp, 'kW', 2));
      rows.push(R('Specific cutting force kc at the lip (Iscar group ' + r.g[0] + ')', r.kc, 'N/mm2', 0));
    } else rows.push(R('Torque, thrust and power', 'No specific cutting force is published for this material group', '', 0));
    rows.push(R('From the table: cutting speed (' + (v.vown > 0 ? 'your own figure' : r.e.pub + (r.cool < 1 ? ', before the coolant factor' : '')) + ')', inch ? r.vTab / FT_M : r.vTab, spdU(s), 0));
    rows.push(R('From the table: spindle speed', r.rpmTab, 'RPM', 0));
    rows.push(R('From the table: feed range for this diameter (University of Florida)', fmt(inch ? r.fLo : r.fLo * IN_MM, dpF) + ' to ' + fmt(inch ? r.fHi : r.fHi * IN_MM, dpF) + ' ' + feedRevU(s), '', 0));
    if (r.cool < 1) rows.push(R('Coolant factor on speed and feed (University of Florida, oil by hand)', r.cool, 'x', 2));
    if (r.fell) rows.push(R('Publisher', r.fell + ' Using ' + r.e.pub + '.', '', 0));
    if (r.din >= 0.5 - 1e-9) rows.push(cfNote('Two editions of the University of Florida table differ from 1/2 in up: the lab handout prints ' + (r.din >= 1 ? '0.012 to 0.020' : '0.008 to 0.012') + ' in/rev (used here), the web page ' + (r.din >= 1 ? '0.016 in/rev and up' : '0.008 to 0.016 in/rev') + '.'));
    if (v.depth > 0 && v.depth * k > 3 * r.dmm) rows.push(cfNote('Deeper than 3 diameters: without through-tool coolant the University of Florida page says to drop the speed by up to half and to peck. Move the speed slider down.'));
    if (r.tm === 1) rows.push(cfNote('Carbide: the speed is 2.5 times the HSS figure (one publisher) and the feed band is the HSS one. A carbide drill maker\'s own chart will be higher: use it if you have it.'));
    if (v.cool === 3) rows.push(cfNote('Dry or mist: no publisher in the table prints a factor for it, so the table figures are used unchanged.'));
    rows.push(R('Note', ADV_START_NOTE, '', 0));
    return rows;
  },
  panel: (v, W, s) => { const r = advDrillRun(v, W, s); return !r || r.none ? '' : '<div class="tiles">' + advHoleTiles(r, s) + '</div>' + advHoleCard(r, s, 'feed'); },
  table: (v, W, s) => {
    const r = advDrillRun(v, W, s);
    if (!r) return null;
    const inch = s === 'inch', sp = x => fmt(inch ? x : x * FT_M, 0);
    const rows = r.entries.map(e => [e.pub, e.row, advRange(e.v[0], e.v[1], sp) + ' ' + spdU(s), e === r.e && !(v.vown > 0) ? 'used' : '']);
    if (r.oo) rows.push([ADV_PUB.oo, r.oo[0] + ' (tool material and operation not stated)', advRange(r.oo[1], r.oo[2], sp) + ' ' + spdU(s), 'for comparison']);
    return rows.length ? { title: 'What each publisher prints for drilling this material', head: ['Publisher', 'Row as printed', 'Speed', ''], rows, text: true } : null;
  },
  sends: (v, W, s) => {
    const r = advDrillRun(v, W, s);
    if (!r || r.none) return [];
    const k = r.k, out = [['Drilling cycle (G-code)', 'cycdrill', { label: 'the drilling advisor', rpm: Math.round(r.rpm), feed: +(r.vf / k).toPrecision(4), z: v.depth > 0 ? -(+(v.depth + W.drill_point_length(r.dmm, r.pt) / k).toPrecision(5)) : '', cycle: v.depth > 0 && v.depth * k > 3 * r.dmm ? 83 : 81 }]];
    if (r.g) out.push(['Thrust, torque and power in detail', 'drillforce', { d: v.d, f: r.f / k, speed: r.inch ? r.vcA / FT_M : r.vcA, pt: r.pt, grp: r.g[0], kc: '' }]);
    return out;
  },
  working: 'Order of work. 1: starting cutting speed from the chosen publisher\'s table for the material; the slider picks a place inside a printed range. A carbide drill takes 2.5 times the HSS speed. 2: feed per revolution from the table by drill diameter (under 1/8 in: up to 0.002 in/rev; 1/8 to 1/4: 0.002 to 0.004; 1/4 to 1/2: 0.004 to 0.008; 1/2 to 1: 0.008 to 0.012; 1 in and over: 0.012 to 0.020), low end for hard or strong materials. 3: coolant factor. 4: n = 1000 Vc / (pi D), held to the machine\'s top speed; feed rate Vf = fn x n, held to its top feed. 5: chip thickness of each lip h = (fn / 2) sin(point angle / 2); kc = kc1.1 x h^(-mc). 6: torque Mc = D^2 fn kc / 8000 N m, thrust Ff = 0.5 kc (D / 2) fn sin(point angle / 2) N, power Pc = Vc D fn kc / 240 000 kW, spindle power = Pc / efficiency, against P(n) = min(P_max, T_max x 2 pi n / 60 000). If the spindle is short, the feed per revolution is reduced; a feed you typed is locked and is left alone. Point length = (D / 2) / tan(point angle / 2). Time = (depth + point length) / (fn x n). Removal rate Q = pi/4 D^2 Vf.',
  source: 'Speeds: LittleMachineShop, "Cutting Speeds" (drilling table); University of Florida MAE design lab, "Speeds and Feeds" web page and EML2322L handout (HSS speeds, drill feeds by diameter, carbide factor 2.5, 60 % for oil by hand, deep holes). For comparison: Open Oregon, "Manufacturing Processes 4-5", Table 1. Forces: Sandvik Coromant drilling formulas with kc from the Iscar material groups (see Drill thrust, torque and power). See docs/sources.md, "Advisor".',
},
{
  id: 'advream', level: 'advanced', group: 'Drilling and tapping', title: 'Reaming advisor',
  pick: { map: { d: 'dia' }, types: ['Reamer'] },
  desc: 'Speed and feed for a machine reamer, and how much stock to leave for it, from four publishers shown side by side. The hole to drill first is the reamer size less that stock.',
  fields: s => [
    { id: 'mat', label: 'Work material', unit: '', def: 3, options: ADV_MAT_OPTIONS, wide: true },
    { id: 'd', label: 'Reamer diameter', unit: lenU(s), def: s === 'inch' ? 0.375 : 10 },
    { id: 'f', label: 'Feed per revolution (blank = suggested)', unit: feedRevU(s), def: '', lock: true },
    { id: 'src', label: 'Speed and feed from', unit: '', def: 0, wide: true, options: [[0, 'The first publisher that lists this material'], [1, 'LittleMachineShop reaming speed, twice the drill feed'], [2, 'ICS Cutting Tools reaming table'],
      [3, 'University of Florida: half the drill speed, twice the drill feed'], [4, 'Gammons: two thirds of the drill speed, 2 to 3 times the drill feed'], [9, 'My own speed']] },
    { id: 'ag', label: 'Feed in the printed range', unit: '', def: 50, slider: { min: 0, max: 100, step: 5, labels: ['Gentle', 'Middle', 'Aggressive'] } },
    { id: 'sp', label: 'Speed in the printed range (fine finish: low)', unit: '', def: 50, slider: { min: 0, max: 100, step: 5, labels: ['Low', 'Middle', 'High'] } },
    { id: 'cool', label: 'Coolant', unit: '', def: 1, options: ADV_COOL, wide: true },
    { level: 'advanced', id: 'vown', label: 'Your own cutting speed (wins over the table)', unit: spdU(s), def: '' },
    { level: 'advanced', id: 'spn', label: 'Spindle', unit: '', def: 0, options: [[0, 'Main spindle'], [1, 'Driven (live) tool']] },
    { level: 'advanced', id: 'nmax', label: 'Top spindle speed (blank = active machine)', unit: 'RPM', def: '' },
    { level: 'advanced', id: 'vfmax', label: 'Top feed rate (blank = active machine)', unit: 'mm/min', def: '' },
  ],
  suggest: (v, W, s) => { const r = advReamRun(v, W, s); return r && !r.none ? { f: r.fSug / r.k } : {}; },
  calc: (v, W, s) => {
    const r = advReamRun(v, W, s);
    if (!r) return [];
    const inch = r.inch, k = r.k, lu = lenU(s), dpF = inch ? 4 : 3, rows = [];
    if (r.none) rows.push(R('Speed and feed', 'No publisher in the table lists a reaming speed for this material: type your own cutting speed and feed', '', 0));
    else {
      rows.push(R('Spindle speed', r.rpm, 'RPM', 0),
        R('Feed per revolution (' + (r.fL ? 'yours, locked' : 'suggested: ' + r.e.pub + (r.e.fnote ? '; ' + r.e.fnote : '')) + ')', r.f / k, feedRevU(s), dpF),
        R('Feed rate', r.vf / k, feedMinU(s), inch ? 2 : 0),
        R('Cutting speed at the reamer', inch ? r.vcA / FT_M : r.vcA, spdU(s), 0));
    }
    // Stock to leave, each publisher on its own line.
    const st = r.st, sh = x => fmt(inch ? x : x * IN_MM, inch ? 4 : 3);
    if (st) {
      rows.push(R('Stock to leave on the diameter (ICS Cutting Tools, by reamer size)', sh(st[1]) + ' to ' + sh(st[2]) + ' ' + lu, '', 0));
      rows.push(R('Hole to drill first, ICS: from', W.ream_predrill(r.dmm, st[2] * IN_MM) / k, lu, dpF), R('Hole to drill first, ICS: to', W.ream_predrill(r.dmm, st[1] * IN_MM) / k, lu, dpF));
    } else rows.push(R('Stock to leave (ICS Cutting Tools)', 'Not printed above 3/4 in', '', 0));
    rows.push(R('Stock to leave on the diameter (Gammons: about 3 % of the hole)', r.stock3 / k, lu, dpF), R('Hole to drill first, Gammons', W.ream_predrill(r.dmm, r.stock3) / k, lu, dpF));
    rows.push(R('Other printed figures', 'Gammons: usually 0.004 to 0.012 in (0.10 to 0.30 mm) on the diameter for finish reaming, rarely over 0.015 in (0.38 mm); 0.010 in on a 1/4 in hole, 0.015 in on 1/2 in, up to 0.025 in on 1-1/2 in. ICS: finishing 0.002 to 0.004 in (0.05 to 0.10 mm); roughing no more than 2 to 4 % of the diameter.', '', 0));
    if (!r.none) {
      rows.push(R('From the table: cutting speed (' + (v.vown > 0 ? 'your own figure' : r.e.pub) + ')', inch ? r.vTab / FT_M : r.vTab, spdU(s), 0), R('From the table: spindle speed', r.rpmTab, 'RPM', 0));
      if (r.cool < 1) rows.push(R('Coolant factor on speed and feed (University of Florida, oil by hand)', r.cool, 'x', 2));
      if (r.fell) rows.push(R('Publisher', r.fell + ' Using ' + r.e.pub + '.', '', 0));
    }
    rows.push(cfNote('The publishers do not agree on reaming speed: Gammons prints two thirds of the drilling speed and, lower down the same page, a third to a half as a start. The table below shows each. A twist drill cuts 0.002 to 0.004 in oversize (Gammons), so check the drilled hole before trusting the stock.'));
    rows.push(R('Note', ADV_START_NOTE, '', 0));
    return rows;
  },
  panel: (v, W, s) => { const r = advReamRun(v, W, s); return !r || r.none ? '' : '<div class="tiles">' + advHoleTiles(r, s) + '</div>' + advHoleCard(r, s, 'feed'); },
  table: (v, W, s) => {
    const r = advReamRun(v, W, s);
    if (!r || !r.entries.length) return null;
    const inch = s === 'inch', sp = x => fmt(inch ? x : x * FT_M, 0), fd = x => fmt(inch ? x : x * IN_MM, inch ? 4 : 3);
    return { title: 'What each publisher gives for reaming this material at this size', head: ['Publisher', 'Row or rule', 'Speed', 'Feed per revolution', ''],
      rows: r.entries.map(e => [e.pub, e.row, advRange(e.v[0], e.v[1], sp) + ' ' + spdU(s), advRange(e.fz[0], e.fz[1], fd) + ' ' + feedRevU(s) + (e.fnote ? ' (' + e.fnote + ')' : ''), e === r.e && !(v.vown > 0) ? 'used' : '']), text: true };
  },
  working: 'Speed: the reaming column of the speed table, or the class table of a reamer maker, or a rule against the drilling speed for the same material (half, or two thirds). Feed: the reamer maker\'s class table where it prints one, otherwise 2 (to 3) times the feed per revolution a drill of that diameter would take. n = 1000 Vc / (pi D), held to the machine\'s top speed; feed rate = fn x n, held to its top feed. Stock to leave: the reamer maker\'s table by diameter, and about 3 % of the hole diameter; hole to drill first = reamer diameter - stock on the diameter. No force or power is worked out: a reamer removes very little.',
  source: 'LittleMachineShop, "Cutting Speeds" (reaming column); ICS Cutting Tools, "Reaming recommendations" (stock removal, feeds, speeds); Gammons Hoaglund, "Reaming guide" (about 3 % stock, two thirds of drilling speed, 200 to 300 % of drilling feed); University of Florida MAE design lab, "Speeds and Feeds" (reamers at half the drill speed and twice its feed; drill feeds by diameter). See docs/sources.md, "Advisor".',
},
{
  id: 'advturn', level: 'advanced', group: 'Speeds and feeds', title: 'Turning advisor',
  pick: { map: { re: 'cr' }, types: ['Turning insert', 'Boring bar', 'Other'] },
  desc: 'Speed, feed and depth of cut for turning or boring from a published speed table and the nose radius of the insert, checked against the lathe for top speed, power and torque, with the finish the feed will leave. Type your own feed or depth and it is locked.',
  fields: s => [
    { id: 'mat', label: 'Work material', unit: '', def: 3, options: ADV_MAT_OPTIONS, wide: true },
    { id: 'tm', label: 'Tool material', unit: '', def: 1, options: [[1, 'Carbide insert'], [2, 'High speed steel (HSS)']] },
    { id: 'd', label: 'Diameter being cut', unit: lenU(s), def: s === 'inch' ? 1 : 25 },
    { id: 're', label: 'Nose radius of the tool', unit: lenU(s), def: s === 'inch' ? 0.0156 : 0.4 },
    { id: 'f', label: 'Feed per revolution (blank = suggested)', unit: feedRevU(s), def: '', lock: true },
    { id: 'ap', label: 'Depth of cut (blank = suggested)', unit: lenU(s), def: '', lock: true },
    { id: 'ag', label: 'Feed for the nose radius (fine finish: low)', unit: '', def: 50, slider: { min: 0, max: 100, step: 5, labels: ['A third of the radius', 'Middle', 'Half the radius'] } },
    { id: 'sp', label: 'Speed in the printed range (hard stock: low)', unit: '', def: 50, slider: { min: 0, max: 100, step: 5, labels: ['Low', 'Middle', 'High'] } },
    { id: 'cool', label: 'Coolant', unit: '', def: 1, options: ADV_COOL, wide: true },
    { level: 'advanced', id: 'kap', label: 'Entering angle (90 = square shoulder)', unit: 'deg', def: 95 },
    { level: 'advanced', id: 'src', label: 'Starting speed from', unit: '', def: 0, options: [[0, 'LittleMachineShop turning table'], [9, 'My own speed']] },
    { level: 'advanced', id: 'vown', label: 'Your own cutting speed (wins over the table)', unit: spdU(s), def: '' },
    { level: 'advanced', id: 'nmax', label: 'Top spindle speed (blank = active machine)', unit: 'RPM', def: '' },
    { level: 'advanced', id: 'pmax', label: 'Spindle power (blank = active machine)', unit: 'kW', def: '' },
    { level: 'advanced', id: 'tmax', label: 'Spindle torque (blank = active machine)', unit: 'N·m', def: '' },
    { level: 'advanced', id: 'eta', label: 'Machine efficiency', unit: '0-1', def: 0.8 },
  ],
  suggest: (v, W, s) => { const r = advTurnRun(v, W, s); return r && !r.none ? { f: r.fSug / r.k, ap: r.apSug / r.k } : {}; },
  calc: (v, W, s) => {
    const r = advTurnRun(v, W, s);
    if (!r) return [];
    if (r.none) return [R('Starting figures', r.needRe ? 'Enter the nose radius of the tool, or type your own feed' : 'LittleMachineShop prints no turning speed for this material: type your own cutting speed (Advanced)', '', 0)];
    const inch = r.inch, k = r.k, lu = lenU(s), dpF = inch ? 4 : 3;
    const lim = (ADV_LIMITS[r.limit] || '').toLowerCase();
    const rows = [
      R('Spindle speed', r.rpm, 'RPM', 0),
      R('Feed per revolution (' + (r.fL ? 'yours, locked' : r.reduced === 3 ? 'reduced to fit ' + lim : 'suggested: nose radius rule, Mitsubishi Materials') + ')', r.f / k, feedRevU(s), dpF),
      R('Depth of cut (' + (r.apL ? 'yours, locked' : r.reduced === 1 ? 'reduced from ' + fmt(r.ap0 / k, dpF) + ' to fit ' + lim : 'suggested: the depth the speed table is based on') + ')', r.ap / k, lu, dpF),
      R('Cutting speed at the diameter', inch ? r.vcA / FT_M : r.vcA, spdU(s), 0),
      R('Removal rate', inch ? r.q / IN3_CM3 : r.q, inch ? 'in3/min' : 'cm3/min', 2),
    ];
    if (isFinite(r.kc)) {
      rows.push(R('Cutting force', inch ? r.fc / LBF_N : r.fc, inch ? 'lbf' : 'N', 0));
      if (isFinite(r.pSp)) { rows.push(R('Spindle power needed', r.pSp, 'kW', 2)); if (inch) rows.push(R('Spindle power needed', r.pSp * KW_HP, 'hp', 2)); rows.push(R('Spindle torque needed', inch ? r.tq * NM_LBFIN : r.tq, inch ? 'lbf in' : 'N m', inch ? 1 : 2)); }
      rows.push(R('Specific cutting force kc at this chip (Iscar group ' + r.g[0] + ')', r.kc, 'N/mm2', 0));
    } else rows.push(R('Force and power', 'No specific cutting force is published for this material group', '', 0));
    if (r.re > 0) { const ra = W.ra_theoretical(r.f, r.re); rows.push(R('Finish the feed leaves (theoretical Ra)', inch ? ra / IN_MM * 1e6 : ra * 1000, inch ? 'uin' : 'um', inch ? 0 : 2)); }
    rows.push(R('From the table: cutting speed (' + (v.vown > 0 ? 'your own figure' : r.e.pub + (r.cool < 1 ? ', before the coolant factor' : '')) + ')', inch ? r.vTab / FT_M : r.vTab, spdU(s), 0));
    rows.push(R('From the table: spindle speed', r.rpmTab, 'RPM', 0));
    if (r.re > 0) rows.push(R('Feed range for this nose radius (a third to a half of it)', fmt(r.fLo / k, dpF) + ' to ' + fmt(r.fHi / k, dpF) + ' ' + feedRevU(s), '', 0));
    if (r.cool < 1) rows.push(R('Coolant factor on speed and feed (University of Florida, oil by hand)', r.cool, 'x', 2));
    if (!(v.vown > 0)) rows.push(cfNote('The speed table is printed for a light cut: 0.004 in/rev (0.10 mm/rev), 0.040 in (1.0 mm) deep, 180 minutes of tool life. A heavier feed or depth shortens tool life at the same speed: move the speed slider down for roughing.'));
    if (v.cool === 3) rows.push(cfNote('Dry or mist: no publisher in the table prints a factor for it, so the table figures are used unchanged.'));
    rows.push(R('Note', ADV_START_NOTE, '', 0));
    return rows;
  },
  panel: (v, W, s) => { const r = advTurnRun(v, W, s); return !r || r.none ? '' : '<div class="tiles">' + advHoleTiles(r, s) + '</div>' + advHoleCard(r, s, 'feed or depth'); },
  table: (v, W, s) => {
    const r = advTurnRun(v, W, s);
    if (!r) return null;
    const inch = s === 'inch', sp = x => fmt(inch ? x : x * FT_M, 0), lm = ADV_LMS[r.m.lms], rows = [];
    if (lm) rows.push([ADV_PUB.lms, lm[0] + ', HSS', advRange(lm[1][0], lm[1][1], sp) + ' ' + spdU(s), r.tm === 2 && !(v.vown > 0) ? 'used' : ''], [ADV_PUB.lms, lm[0] + ', carbide', advRange(lm[2][0], lm[2][1], sp) + ' ' + spdU(s), r.tm === 1 && !(v.vown > 0) ? 'used' : '']);
    if (r.oo) rows.push([ADV_PUB.oo, r.oo[0] + ' (tool material and operation not stated)', advRange(r.oo[1], r.oo[2], sp) + ' ' + spdU(s), 'for comparison']);
    return rows.length ? { title: 'What each publisher prints for this material', head: ['Publisher', 'Row as printed', 'Speed', ''], rows, text: true } : null;
  },
  sends: (v, W, s) => {
    const r = advTurnRun(v, W, s);
    if (!r || r.none) return [];
    const k = r.k;
    return [['Cut time for a pass', 'passtime', { f: r.f / k, rpm: Math.round(r.rpm) }], ['Finish from nose radius and feed', 'finish', { f: r.f / k, r: v.re }]];
  },
  working: 'Order of work. 1: starting cutting speed from the table for the material and tool material; the slider picks a place inside the printed range. 2: feed per revolution from the nose radius: the publisher recommends a corner radius of 2 to 3 times the feed, so the feed is between a third and a half of the radius. 3: depth of cut: the 0.040 in (1.0 mm) the speed table is based on, unless you type your own. 4: coolant factor. 5: n = 1000 Vc / (pi D) at the diameter being cut, held to the lathe\'s top speed. 6: chip thickness h = fn sin(entering angle); kc = kc1.1 x h^(-mc). 7: cutting force Fc = kc x ap x fn; power Pc = Fc x Vc / 60 000 kW; spindle power = Pc / efficiency; torque = P x 60 000 / (2 pi n), against P(n) = min(P_max, T_max x 2 pi n / 60 000). If the spindle is short the depth is reduced; if you locked the depth, the feed; if you locked both, nothing is changed and the card says the cut is over the limit. Theoretical finish Ra = fn^2 / (32 r) x 1000 um, a lower bound.',
  source: 'Speeds: LittleMachineShop, "Cutting Speeds" (turning table: HSS and carbide, for 0.004 in/rev, 0.040 in depth, 180 min tool life). For comparison: Open Oregon, "Manufacturing Processes 4-5", Table 1. Feed from nose radius: Mitsubishi Materials, technical information for turning, "Corner radius" (a corner radius of 2 to 3 times the feed). Forces: Kienzle with kc from the Iscar material groups; power and torque: Sandvik Coromant turning formulas. See docs/sources.md, "Advisor".',
},
);
