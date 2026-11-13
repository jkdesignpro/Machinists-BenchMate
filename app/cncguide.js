// CNC knowledge guide (parity B6, A15 tool wear) and the tool nose radius
// compensation calculator (MH100, MH176). All wording and drawings are
// BenchMate's own. Standards are cited by name and edition only. Every
// statement carries source keys (CNC_SOURCES, and docs/sources.md section
// "CNC guide and TNRC"); a factual statement with fewer than two independent
// public sources is shown as "to be verified". Maths derived here is keyed OWN.
'use strict';

const CNC_SOURCES = {
  ISO841: 'ISO catalogue page, ISO 841:2001, edition 2, confirmed 2023 (iso.org/standard/23949.html, accessed 2026-11-11)',
  ISO6983: 'ISO 6983-1:2009, program format and address words (cited by name; status: see docs/sources.md)',
  MIT_EM: 'Mitsubishi Electric, The Basics of CNC Machining Programming (for Machining center), e-learning BNP-C8027-689, 2020',
  SECO: 'Seco Tools, "Tool wear patterns: how to recognize and to optimize them" (secotools.com/article/122073)',
  MMC: 'Mitsubishi Materials, "Causes of tool damage", course 78 (mmc-carbide.com)',
  HARV: 'Harvey Performance Company, In The Loupe, "Climb milling vs. conventional milling", 2017-05-05',
  HSE_EM: 'Health and Safety Executive, "Using emery cloth on metalworking lathes", updated 2026-08-18 (hse.gov.uk/engineering/lathes.htm)',
  CD: 'Carbide Depot (cutting tool distributor), turning troubleshooting table (carbidedepot.com/formulas-turning-troubleshoot.htm)',
  CDM: 'Carbide Depot (cutting tool distributor), milling troubleshooting table (carbidedepot.com/formulas-mc-troubleshoot.htm)',
  MMC68: 'Mitsubishi Materials, drilling course 68, "Trouble shooting" (mmc-carbide.com/permanent/courses/68/trouble-shooting.html)',
  PTD: 'Travers Tool, "Drill troubleshooting and tips", 2021, with material from Precision Twist Drill (Dormer Pramet) (solutions.travers.com)',
  FMC_D: 'FM Carbide, drilling troubleshooting chart for indexable drills (fmcarbide.com/pages/drilling-troubleshooting-chart)',
  FMC_T: 'FM Carbide, TechTalk "Tapping troubleshooting", 2021-12-15 (fmcarbide.com/blogs/techtalks/tapping-troubleshooting)',
  REGAL: 'Regal Cutting Tools, "5 common tap troubles, and how to remedy them", 2024-10-30 (regalcuttingtools.com)',
  RADIAC: 'Radiac Abrasives, troubleshooting tips: cylindrical grinding and surface grinding (radiac.com/troubleshooting-tip-category)',
  OKUMA_G: 'R. Williams, Okuma America, "6 causes of grinding chatter, and how to fix them", 2016-03-23 (okuma.com/blog)',
  NIST: 'T. R. Kramer, F. M. Proctor, E. Messina, The NIST RS274NGC Interpreter, version 3, NISTIR 6556, 2000 (public domain)',
  LCNC: 'LinuxCNC documentation: lathe user information and G-code overview (linuxcnc.org)',
  HFO_OP: 'Haas Factory Outlet (Productivity Inc.), Haas Lathe Operator manual, rev. 12/2018',
  HFO_L: 'Haas Factory Outlet (Productivity Inc.), Haas Lathe Programming manual, 2025',
  CIMCO: 'CIMCO, CNC programming book, "Imaginary tool tip" (cimco.com)',
  MACH: 'MachMotion, Lathe tool tip types (support.machmotion.com)',
  KENTECH: 'Kentech Inc., "Stop scratching your head and make some chips", TWI Press 2000, reprinted on a Florida International University course page',
  IA: 'Industry Arena (CNCzone mirror) forum thread "Manual tool comp partial radius lathe", 2005-2009',
  LCNC_G: 'LinuxCNC documentation: G-code overview (format of a line), G codes, M codes (linuxcnc.org)',
  HFO_MP: 'Haas Factory Outlet (Productivity Inc.), Haas Mill Programming manual, revised 06/26',
  HURCO_PF: 'Hurco Companies, WinMax Mill help, NC programming, "Program functions" (support.hurco.com)',
  MASSO: 'MASSO documentation, "G96: turn on constant surface speed (CSS)" (docs.masso.com.au)',
  MDOC: 'Machining Doctor, "G96 / G97 G-code: constant SFM vs. constant RPM" (machiningdoctor.com)',
  CADEM: 'Cadem, "Constant surface speed: why does it always go with a limiting spindle speed?" (cadem.com)',
  CTE: 'C. Tate, "Understanding cutting equations", Cutting Tool Engineering, 2014-07-01 (ctemag.com)',
  WOODWEB: 'WOODWEB knowledge base, "Understanding chip load", 2005-06-19 (woodweb.com)',
  CCB_SUB: 'CNC Cookbook, "M98 & M99 G-code: CNC subprograms", last modified 2024-04-30 (cnccookbook.com)',
  MG_SUB: 'B. Fowler, Machinist Guides, "Quick guide to CNC subprograms", 2024-09-08 (machinistguides.com; its example program is not used)',
  IMD_SUB: 'Industrial Monitor Direct, "Fanuc subprogramming: M98, M99, GOTO macro reference", 2026-09-13 (its combined form of the P word is described two ways and is not used)',
  MMC_EFF: 'Mitsubishi Materials, technical information for turning tools, "Effects of cutting conditions" (mmc-carbide.com)',
  SECO_PAR: 'Seco Tools, "Tools and parameters still play a key role in machining success" (secotools.com; no author or date shown)',
  HAAS_G141: 'Haas Automation, G-code reference "G141 3D+ cutter compensation (group 07)" (haascnc.com)',
  ICAM_3D: 'ICAM Technologies, "How to control left or right 3D cutter compensation (Fanuc)", 2014-09-23, modified 2023-11-07',
  CIMCO_3D: 'CIMCO, CNC book, chapter 9, "3D cutter compensation" (cimco.com)',
  OWN: 'BenchMate derivation (geometry), with tests in core/src/tnrc.rs',
};
const CNC_INDEPENDENT = { HAAS_G141: 'HAAS', HFO_OP: 'HAAS', HFO_L: 'HAAS', HFO_MP: 'HAAS', LCNC_G: 'LCNC', FMC_D: 'FMC', FMC_T: 'FMC' }; // same publisher family counts once
// mode 'cat': a standard's own edition and status, confirmed on the standards body's catalogue.
function cnTags(keys, mode) {
  const ks = keys || [];
  const pubs = new Set(ks.filter(k => k !== 'OWN').map(k => CNC_INDEPENDENT[k] || k));
  const ok = pubs.size >= 2 || (mode === true && ks.includes('OWN') && pubs.size >= 1) || (mode === 'cat' && ks.length === 1 && /^ISO/.test(ks[0]));
  return ks.map(k => '<abbr class="gsrc" title="' + gesc(CNC_SOURCES[k] || k) + '">' + k + '</abbr>').join('') +
    (ok ? '' : '<span class="gtbv" title="Not yet confirmed in two independent public sources">to be verified</span>');
}
// A paragraph with its own source keys.
const cp = (html, keys, maths) => '<p>' + html + (keys === null ? '' : ' ' + cnTags(keys, maths)) + '</p>';

// ---------- Drawings (own, schematic) ----------
const cnArrow = (x1, y1, x2, y2, cls) => {
  const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, h = 7;
  return '<path class="' + (cls || 'gp') + '" d="M' + x1 + ' ' + y1 + 'L' + x2 + ' ' + y2 + 'M' + x2 + ' ' + y2 + 'L' + (x2 - h * ux + h * .45 * uy).toFixed(1) + ' ' + (y2 - h * uy - h * .45 * ux).toFixed(1) +
    'M' + x2 + ' ' + y2 + 'L' + (x2 - h * ux - h * .45 * uy).toFixed(1) + ' ' + (y2 - h * uy + h * .45 * ux).toFixed(1) + '"/>';
};
const cnT = (x, y, t, cls, a) => '<text class="' + (cls || 'gs') + '" x="' + x + '" y="' + y + '"' + (a ? ' text-anchor="' + a + '"' : '') + '>' + t + '</text>';
const cnSvg = (w, h, body, label) => '<svg class="geo cng" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + label + '">' + body + '</svg>';

function cnMillAxes() {
  return cnSvg(440, 230,
    // column, spindle and table of a vertical mill
    '<path class="gm" d="M300 30H350V200H300Z"/><path class="gm" d="M230 40H300V75H230Z"/><path class="gp" d="M262 75V118"/><path class="gc" d="M258 118H266L262 128Z"/>' +
    '<path class="gm" d="M120 178H330V196H120Z"/><path class="gfill" d="M180 148H260V178H180Z"/><path class="gp" d="M180 148H260V178H180Z"/>' +
    cnArrow(60, 170, 60, 100) + cnT(56, 94, '+Z', 'gv', 'middle') + cnArrow(60, 170, 130, 170) + cnT(138, 174, '+X', 'gv') + cnArrow(60, 170, 100, 140) + cnT(104, 136, '+Y', 'gv') +
    cnT(60, 216, 'tool moves away from the work = +Z', 'gs', 'start') + cnT(370, 20, 'vertical mill', 'gs', 'end') +
    '<path class="gk" d="M50 128A14 6 0 1 0 70 128"/>' + cnT(76, 124, 'C about Z', 'gs'),
    'Right-handed axes on a vertical mill');
}
function cnLatheAxes() {
  return cnSvg(440, 200,
    '<path class="gm" d="M20 50H80V150H20Z"/>' + cnT(50, 168, 'chuck', 'gs', 'middle') +
    '<path class="gfill" d="M80 75H260V125H80Z"/><path class="gp" d="M80 75H260V125H80Z"/><path class="grap" d="M10 100H330"/>' +
    '<path class="gc" d="M300 50L280 72L300 72Z"/><path class="gm" d="M300 50H340V30"/>' +
    cnArrow(360, 150, 420, 150) + cnT(424, 172, '+Z', 'gv', 'end') + cnArrow(360, 150, 360, 95) + cnT(360, 88, '+X', 'gv', 'middle') +
    cnT(20, 20, 'Z along the spindle axis, X across it (radial);', 'gs') + cnT(20, 34, 'drawn here with +X up, as most manuals draw a lathe', 'gs'),
    'Lathe axes: Z along the spindle, X radial');
}
function cnOffsets() {
  return cnSvg(440, 230,
    '<path class="gm" d="M30 20H410V210H30Z"/>' + '<circle class="gdot2" cx="400" cy="30" r="4"/>' + cnT(404, 14, 'machine zero', 'gs', 'end') +
    '<path class="gfill" d="M120 110H260V180H120Z"/><path class="gp" d="M120 110H260V180H120Z"/><circle class="gdot" cx="120" cy="110" r="4"/>' + cnT(126, 104, 'part zero (G54)', 'gs') +
    cnArrow(396, 32, 124, 108, 'gc') + cnT(44, 40, 'work offset = machine', 'gs') + cnT(44, 54, 'position of part zero', 'gs') +
    '<path class="gm" d="M290 120V170"/><path class="gm" d="M280 120H300"/>' + cnT(304, 150, 'tool length', 'gs') + cnT(304, 164, 'offset (G43 H)', 'gs'),
    'Machine zero, part zero and offsets');
}
function cnClimb() {
  // Top view, spindle clockwise (M03 seen from above), tool feeding to the right.
  const panel = (cx, climb) => {
    const cy = 105, R = 40, ae = 13, w = Math.sqrt(R * R - (R - ae) * (R - ae));
    const wall = climb ? cy + R : cy - R, edge = climb ? cy + R - ae : cy - R + ae;
    let s = '<path class="gp" d="M' + (cx - 95) + ' ' + wall + 'H' + (cx + 95) + '"/>';
    s += '<path class="gfill" d="M' + cx + ' ' + wall + 'H' + (cx + 95) + 'V' + edge + 'H' + (cx + w) + 'Z"/>' + '<path class="gm" d="M' + (cx + w) + ' ' + edge + 'H' + (cx + 95) + '"/>';
    s += '<path class="gfill" d="M' + (cx + w).toFixed(1) + ' ' + edge + 'L' + cx + ' ' + wall + 'L' + (cx + w).toFixed(1) + ' ' + wall + 'Z"/><path class="gc" d="M' + (cx + w).toFixed(1) + ' ' + edge + 'L' + cx + ' ' + wall + '"/>';
    s += '<circle class="gc" cx="' + cx + '" cy="' + cy + '" r="' + R + '"/><circle class="gdot2" cx="' + cx + '" cy="' + cy + '" r="2"/>';
    // clockwise arrow on the upper left of the tool
    s += '<path class="gk" d="M' + (cx - 26) + ' ' + (cy - 14) + 'A30 30 0 0 1 ' + (cx + 4) + ' ' + (cy - 30) + '"/>' + cnArrow(cx - 2, cy - 30, cx + 6, cy - 30, 'gc');
    s += cnArrow(cx - 30, 192, cx + 30, 192) + cnT(cx, 207, 'tool feed', 'gs', 'middle');
    s += cnT(cx, 18, climb ? 'climb' : 'conventional', 'gv', 'middle') + cnT(cx, 33, climb ? 'tooth enters thick, leaves thin' : 'tooth enters thin, leaves thick', 'gs', 'middle');
    return s;
  };
  return cnSvg(440, 215, panel(110, true) + panel(330, false), 'Climb and conventional milling, top view, spindle clockwise');
}
function cnChip() {
  return cnSvg(440, 200,
    '<path class="gfill" d="M20 120H300V180H20Z"/><path class="gp" d="M20 120H300V180H20Z"/><path class="grap" d="M20 108H220"/>' +
    '<path class="gp" d="M300 120L340 30L410 30L410 120Z"/>' + '<path class="gc" d="M220 120L262 60"/>' +
    '<path class="gp" d="M220 108L300 108L310 90Q320 50 300 30Q280 20 266 40L262 60"/>' +
    cnT(30, 104, 'uncut chip thickness', 'gs') + cnT(170, 90, 'shear plane', 'gs', 'end') + cnT(316, 66, 'rake face', 'gs') + cnT(370, 140, 'flank', 'gs') +
    cnArrow(120, 150, 60, 150) + cnT(90, 168, 'work moves', 'gs', 'middle') + cnT(272, 24, 'chip', 'gv', 'end'),
    'Chip formation in orthogonal cutting');
}
// The worn edge "unfolded": the rake face (where the chip runs) above the edge line, the flank (the face towards
// the work) below it, the corner at the left and the depth-of-cut line where the edge leaves the work. Own drawing,
// the same base for every wear type so that they can be compared.
function wearDraw(kind) {
  const W = 300, H = 192, ye = 96, xd = 200;
  let h = DK.rect(30, 28, 244, ye - 28, 'part') + DK.rect(30, ye, 244, 64, 'part') + DK.line(xd, 16, xd, 172, 'hid');
  h += DK.text(268, 42, 'rake face', { cls: 'mut', anchor: 'end' }) + DK.text(268, 152, 'flank', { cls: 'mut', anchor: 'end' }) + DK.text(30, 184, 'corner', { cls: 'mut', anchor: 'start' }) + DK.text(xd, 184, 'depth-of-cut line', { cls: 'mut' });
  const T = (x, y, t, a) => DK.text(x, y, t, { cls: 'hott', anchor: a || 'middle' });
  const marks = {
    flank: () => DK.path('M31 96H200V110Q116 115 31 109Z', 'tool') + T(116, 132, 'even band below the edge'),
    crater: () => DK.path('M52 74Q116 50 180 74Q116 90 52 74Z', 'tool') + T(116, 46, 'hollow behind the edge'),
    notch: () => DK.path('M189 96L200 70L211 96L200 130Z', 'tool') + T(184, 146, 'notch', 'end'),
    bue: () => DK.path('M70 96Q72 70 100 78Q124 62 150 82Q162 92 156 104Q110 112 70 96Z', 'tool') + T(112, 54, 'work material stuck on'),
    chipping: () => DK.path('M54 96l5 9l6 -9ZM94 96l7 12l5 -6l5 -6ZM150 96l6 10l8 -10Z', 'tool') + T(116, 132, 'small pieces lost'),
    thermal: () => [58, 88, 118, 148, 178].map((x, i) => DK.line(x, 78, x + (i % 2 ? 3 : -3), 118, 'hot')).join('') + T(116, 140, 'cracks across the edge'),
    deform: () => DK.path('M31 96Q116 124 200 96Z', 'tool') + DK.path('M44 90Q116 74 188 90', 'hot') + T(116, 140, 'edge pushed down'),
    fracture: () => DK.path('M31 58L52 66L70 58L96 80L120 96L112 118L84 126L62 150L31 152Z', 'tool') + T(150, 136, 'piece broken away', 'start'),
    flaking: () => DK.path('M66 96Q98 56 130 96Z', 'tool') + DK.path('M80 96Q98 72 116 96', 'hot') + DK.path('M140 96Q162 68 184 96Z', 'tool') + DK.path('M152 96Q162 82 172 96', 'hot') + T(126, 50, 'shell-shaped scars'),
    hammer: () => DK.path('M214 96l6 -10l6 10ZM232 96l7 -12l7 12Z', 'tool') + DK.path('M150 62Q196 14 238 44Q254 60 240 78', 'hot') + DK.arrow(246, 66, 238, 82, 'hot') + T(146, 60, 'chip', 'end') + T(238, 132, 'struck here'),
  };
  h += (marks[kind] ? marks[kind]() : '') + DK.line(30, ye, 274, ye, 'ln');
  return DK.svg(W, H, h, 'Worn cutting edge: ' + kind);
}
// Small drawings of the edge for each wear type (insert corner from the flank side and from above).
function cnWear(kind) {
  // Insert edge seen from the flank side: rake face above the edge line (y 50), flank below.
  const base = '<path class="gp" d="M20 30H140V110H20Z"/><path class="gm" d="M20 50H140"/>' + cnT(146, 44, 'rake', 'gs') + cnT(146, 90, 'flank', 'gs');
  const cap = t => cnT(10, 136, t, 'gs');
  const marks = {
    flank: '<path class="gfill" d="M24 50H136V64H24Z"/><path class="gc" d="M24 64H136"/>' + cap('even land (VB)'),
    crater: '<path class="gfill" d="M40 44Q80 30 120 44Z"/><path class="gc" d="M40 44Q80 30 120 44"/>' + cap('hollow behind the edge'),
    notch: '<path class="gfill" d="M100 50L108 72L116 50Z"/><path class="gc" d="M100 50L108 72L116 50"/><path class="grap" d="M108 20V118"/>' + cap('at the depth-of-cut line'),
    bue: '<path class="gfill" d="M50 50Q60 36 76 42Q90 34 98 50Z"/><path class="gc" d="M50 50Q60 36 76 42Q90 34 98 50"/>' + cap('work material welded on'),
    chipping: '<path class="gc" d="M40 50L46 56L52 50M80 50L88 58L94 52L98 50"/>' + cap('small pieces lost'),
    thermal: '<path class="gc" d="M40 50V70M60 50V72M80 50V68M100 50V73M120 50V70"/>' + cap('cracks across the edge'),
    deform: '<path class="gc" d="M20 50Q80 64 140 50"/>' + cap('edge pushed down'),
  };
  return '<svg class="geo cnw" viewBox="0 0 190 145" role="img" aria-label="' + kind + ' wear sketch">' + base + (marks[kind] || '') + '</svg>';
}
function cnBlock() {
  const parts = [['N0040', 'sequence number'], ['G01', 'motion (modal)'], ['X25.0', 'coordinate'], ['Z-12.5', 'coordinate'], ['F0.15', 'feed (modal)'], ['(FINISH)', 'comment']];
  let x = 14, s = '';
  parts.forEach(([w, l], i) => { const wd = w.length * 9 + 10; s += '<path class="gm" d="M' + x + ' 30H' + (x + wd) + 'V58H' + x + 'Z"/>' + cnT(x + wd / 2, 49, w, 'gv', 'middle') + cnT(i ? x + wd / 2 : x, 74 + (i % 2) * 14, l, 'gs', i ? 'middle' : 'start'); x += wd + 6; });
  return cnSvg(440, 110, s + cnT(14, 18, 'one block (line): words = letter address + number', 'gs'), 'Anatomy of a program block');
}
function cnVise() {
  return cnSvg(440, 200,
    '<path class="gm" d="M30 150H410V180H30Z"/><path class="gp" d="M80 70H120V150H80Z"/><path class="gp" d="M320 70H360V150H320Z"/>' +
    '<path class="gm" d="M120 120H320V136H120Z"/>' + cnT(220, 148, 'parallels', 'gs', 'middle') +
    '<path class="gfill" d="M120 60H320V120H120Z"/><path class="gp" d="M120 60H320V120H120Z"/>' + cnT(220, 94, 'part', 'gv', 'middle') +
    cnT(100, 62, 'fixed jaw', 'gs', 'middle') + cnT(340, 62, 'moving jaw', 'gs', 'middle') + cnArrow(380, 100, 362, 100, 'gc') +
    cnT(220, 30, 'grip on the jaw height, part seated on the parallels', 'gs', 'middle'),
    'Part in a machine vise on parallels');
}

// ---------- TNRC tip chart ----------
const TIP_TEXT = {
  0: 'Centre of the nose radius (some controls use 0 for no tip direction).',
  1: 'Tip at +Z, +X of the nose centre: back boring (Haas).',
  2: 'Tip at −Z, +X: a boring bar cutting toward the chuck (Haas).',
  3: 'Tip at −Z, −X: an OD turning tool cutting toward the chuck (Haas).',
  4: 'Tip at +Z, −X: back turning (Haas).',
  5: 'Tip at +Z on the axis line of the nose: a tool that touches off on its +Z side only.',
  6: 'Tip at +X: e.g. a tool touched off on its +X side only.',
  7: 'Tip at −Z: e.g. a facing or grooving tool touched off on its −Z side.',
  8: 'Tip at −X: e.g. a grooving or button tool touched off on its −X side.',
  9: 'Centre of the nose radius, as 0.',
};
const TIP_SRC = { 0: ['MACH'], 1: ['HFO_OP'], 2: ['HFO_OP'], 3: ['HFO_OP'], 4: ['HFO_OP'], 5: ['MACH'], 6: ['MACH'], 7: ['MACH'], 8: ['MACH'], 9: ['MACH'] };
function tipSvg(tip, big) {
  const W = big ? 170 : 92, c = W / 2, r = W * 0.2;
  const tz = { 1: 1, 2: -1, 3: -1, 4: 1, 5: 1, 6: 0, 7: -1, 8: 0 }[tip] || 0, tx = { 1: 1, 2: 1, 3: -1, 4: -1, 5: 0, 6: 1, 7: 0, 8: -1 }[tip] || 0;
  const px = c + tz * r, py = c - tx * r;
  let s = '<circle class="gc" cx="' + c + '" cy="' + c + '" r="' + r.toFixed(1) + '"/>' + '<circle class="gdot2" cx="' + c + '" cy="' + c + '" r="2"/>';
  if (tz) s += '<path class="grap" d="M' + px + ' ' + (c - r - 8) + 'V' + (c + r + 8) + '"/>';
  if (tx) s += '<path class="grap" d="M' + (c - r - 8) + ' ' + py + 'H' + (c + r + 8) + '"/>';
  s += '<circle class="gdot" cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="' + (big ? 4.5 : 3.5) + '"/>';
  s += cnT(6, 14, String(tip), 'gv');
  if (big) s += cnArrow(W - 44, W - 12, W - 14, W - 12, 'gm') + cnT(W - 10, W - 16, '+Z', 'gs', 'end') + cnArrow(W - 44, W - 12, W - 44, W - 42, 'gm') + cnT(W - 40, W - 40, '+X', 'gs');
  return '<svg class="geo cntip' + (big ? ' big' : '') + '" viewBox="0 0 ' + W + ' ' + W + '" role="img" aria-label="Tip ' + tip + '">' + s + '</svg>';
}

// ---------- TNRC calculator ----------
const TNRC_STATE = {
  mm: { r: 0.8, tip: 3, kind: 'line', side: 1, z1: 0, x1: 18, z2: -1, x2: 20, e1: 2, e2: 1, rp: 2, dir: 1, th: 45 },
  inch: { r: 0.031, tip: 3, kind: 'line', side: 1, z1: 0, x1: 0.9, z2: -0.05, x2: 1, e1: 2, e2: 1, rp: 0.0625, dir: 1, th: 45 },
};
function renderTnrc(el) {
  const sys = state.sys, W = state.W, S = TNRC_STATE[sys === 'inch' ? 'inch' : 'mm'], u = sys === 'inch' ? 'in' : 'mm', dp = sys === 'inch' ? 4 : 3;
  const f = v => isFinite(v) ? (+v).toFixed(dp) : 'n/a';
  const num = (id, lab, unit) => '<label class="f"><span>' + lab + '</span><div class="row"><input type="number" step="any" inputmode="decimal" data-k="' + id + '" value="' + S[id] + '"><span class="u">' + unit + '</span></div></label>';
  const sel = (id, lab, opts) => '<label class="f"><span>' + lab + '</span><div class="row"><select data-k="' + id + '">' + opts.map(([v, t]) => '<option value="' + v + '"' + (String(S[id]) === String(v) ? ' selected' : '') + '>' + t + '</option>').join('') + '</select></div></label>';
  el.innerHTML =
    '<h2>Quick chamfer shifts</h2><div class="grid">' + num('r', 'Nose radius r', u) + num('th', 'Chamfer angle to the Z axis θ', 'deg') + '</div><div class="res" id="tq"></div>' +
    '<h2>Element to program</h2><div class="grid">' +
    sel('tip', 'Tip direction (imaginary tip number)', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => [i, i + ': ' + TIP_TEXT[i].split(':')[0]])) +
    sel('kind', 'Element', [['line', 'Chamfer or taper (straight)'], ['arc', 'Arc (corner radius)']]) +
    sel('side', 'Tool side of the travel (drawn +X up)', [[1, 'Right of travel (G42), e.g. OD toward the chuck'], [-1, 'Left of travel (G41), e.g. ID toward the chuck']]) +
    num('z1', 'Start Z', u) + num('x1', 'Start X (diameter)', u) + num('z2', 'End Z', u) + num('x2', 'End X (diameter)', u) +
    '<span class="tline">' + sel('e1', 'Start meets', [[2, 'a face (keep its Z)'], [1, 'a diameter (keep its X)'], [0, 'nothing (square offset)']]) + '</span>' +
    '<span class="tline">' + sel('e2', 'End meets', [[1, 'a diameter (keep its X)'], [2, 'a face (keep its Z)'], [0, 'nothing (square offset)']]) + '</span>' +
    '<span class="tarc">' + num('rp', 'Part arc radius R', u) + '</span>' +
    '<span class="tarc">' + sel('dir', 'Arc direction in the drawing (+X up, +Z right)', [[1, 'Counter-clockwise'], [0, 'Clockwise']]) + '</span>' +
    '</div><div class="res" id="tres"></div><div id="tdia" style="max-width:560px"></div><pre class="gcode" id="tcode"></pre>' +
    '<h2>Tip directions 0 to 9</h2><p class="desc">The dot is the imaginary tip (the point the offsets measure), the circle is the nose radius, viewed with +Z to the right and +X up. Tip numbers are not the same on every control or turret layout: always check the tip chart in your own control manual.</p>' +
    '<div class="cntips">' + [1, 2, 3, 4, 5, 6, 7, 8, 0, 9].map(i => '<div class="cntipc">' + tipSvg(i) + '<div>' + gesc(TIP_TEXT[i]) + ' ' + cnTags(TIP_SRC[i]) + '</div></div>').join('') + '</div>' +
    cp('<b>Charts differ.</b> Haas names the OD turning tool tip 3 and the boring bar tip 2. MachMotion\'s chart, drawn for a rear-turret lathe, uses the same 3 x 3 layout but lists OD turning as tip 2, 6 or 1 and boring as 3, 8 or 4, so its chart is the other way up in X. The tip number must come from your own control\'s chart; BenchMate uses the Haas meaning.', ['HFO_OP', 'MACH']) +
    '<h2>Without compensation versus G41/G42</h2>' +
    cp('<b>The imaginary tip.</b> A turning tool is touched off on a diameter and on a face, so the control knows the point where a line along Z and a line along X, both tangent to the nose radius, cross. That point is not on the tool: it sits out in the corner of the square round the nose circle.', ['CIMCO', 'LCNC']) +
    cp('<b>Why it matters.</b> On moves along Z or X the round nose cuts exactly where the imaginary tip says, so no compensation is needed. On a chamfer, taper or arc the edge that actually cuts is elsewhere on the nose, and the part comes out with extra material: a chamfer is short and an outside radius is not round.', ['HFO_L', 'KENTECH']) +
    cp('<b>Programming the tip by hand.</b> Shift the ends of each chamfer or arc by the amounts above and program the shifted points, with G40 (no compensation) in force. For a 90 degree corner radius, program the arc radius as R + r and move its ends out by r.', ['KENTECH', 'IA']) +
    cp('<b>With G41/G42.</b> Program the finished part shape and let the control do it: G41 keeps the tool on the left of the path, G42 on the right, looking along the direction of travel. The control needs the nose radius and the tip number in the tool\'s geometry offset (Haas: the radius and TIP columns).', ['HFO_L', 'NIST']) +
    cp('<b>Getting in and out.</b> Turn compensation on with a straight G00 or G01 approach move that starts clear of the part; the tool is fully compensated at the end of that move. Cancel it with G40 on a straight move away from the part. Haas: lathe threading and grooving canned cycles (G74, G75, G76, G92) ignore compensation, so cancel it before them.', ['HFO_L']) +
    cp('Which code is OD and which is ID depends on the side of the spindle the tools are on and how the axes are drawn. With +X up and the tool cutting toward the chuck, an OD tool is on the right of its travel (G42) and a boring bar on the left (G41).', ['OWN']);
  const read = () => { el.querySelectorAll('[data-k]').forEach(i => { const k = i.dataset.k; S[k] = (k === 'kind') ? i.value : parseFloat(i.value); }); };
  function draw() {
    read();
    el.querySelectorAll('.tline').forEach(e => e.style.display = S.kind === 'line' ? '' : 'none');
    el.querySelectorAll('.tarc').forEach(e => e.style.display = S.kind === 'arc' ? '' : 'none');
    const dz = W.tnrc_chamfer_dz(S.r, S.th), dx = W.tnrc_chamfer_dx(S.r, S.th), er = W.tnrc_chamfer_error(S.r, S.th);
    $('#tq', el).innerHTML = '<div class="h">Tip 3 or 2, end of the chamfer next to a diameter or face</div><table>' +
      [['Z shift where it meets a diameter, dz = r (1 − tan(θ/2))', f(dz), u], ['X shift where it meets a face, radial, dx = r (1 − tan((90° − θ)/2))', f(dx), u], ['X shift on diameter, 2 dx', f(2 * dx), u],
       ['Nose stand-off from the chamfer with no compensation', f(er), u], ['Error in the middle of a 90° corner radius with no compensation, r (√2 − 1)', f(W.tnrc_corner_arc_error(S.r)), u]]
        .map(([a, b, c]) => '<tr><td>' + a + '</td><td class="v">' + b + '</td><td class="u">' + c + '</td></tr>').join('') + '</table>';
    let o = [], n = 0;
    if (S.kind === 'line') n = W.tnrc_line(S.r, S.tip, S.z1, S.x1, S.z2, S.x2, S.side, S.e1, S.e2);
    else n = W.tnrc_arc(S.r, S.tip, S.z1, S.x1, S.z2, S.x2, S.rp, S.dir, S.side);
    for (let i = 0; i < n; i++) o.push(W.list_out(i));
    const ok = o.length && isFinite(o[0]);
    const rows = ok ? [['Start, as drawn', 'Z ' + f(S.z1) + '  X ' + f(S.x1)], ['Start, imaginary tip', 'Z ' + f(o[0]) + '  X ' + f(o[1])], ['Start shift', 'Z ' + f(o[0] - S.z1) + '  X ' + f(o[1] - S.x1)],
      ['End, as drawn', 'Z ' + f(S.z2) + '  X ' + f(S.x2)], ['End, imaginary tip', 'Z ' + f(o[2]) + '  X ' + f(o[3])], ['End shift', 'Z ' + f(o[2] - S.z2) + '  X ' + f(o[3] - S.x2)]] : [];
    if (ok && S.kind === 'arc') rows.push(['Arc radius to program', f(o[4]) + ' (' + (o[7] ? 'convex: R + r' : 'concave: R − r') + ')'], ['Arc centre of the tip path', 'Z ' + f(o[5]) + '  X ' + f(o[6])]);
    $('#tres', el).innerHTML = '<div class="h">Imaginary tip path (X on diameter)</div><table>' + (ok ? rows.map(([a, b]) => '<tr><td>' + a + '</td><td class="v txt">' + b + '</td><td class="u">' + u + '</td></tr>').join('')
      : '<tr><td class="warn">' + (S.kind === 'arc' ? 'No arc of that radius joins the two points, or the nose radius is not smaller than a concave arc.' : 'Enter two different points.') + '</td></tr>') + '</table>';
    $('#tdia', el).innerHTML = ok ? tnrcDiagram(S, o) : '';
    const g = S.kind === 'arc' ? (S.dir ? 'G03' : 'G02') : 'G01';
    const rr = S.kind === 'arc' ? ' R' + f(o[4]) : '';
    $('#tcode', el).textContent = ok ? '(WITHOUT COMPENSATION: PROGRAM THE TIP PATH, G40 IN FORCE)\nG40\nG01 X' + f(o[1]) + ' Z' + f(o[0]) + '\n' + g + ' X' + f(o[3]) + ' Z' + f(o[2]) + rr + '\n\n' +
      '(WITH COMPENSATION: PROGRAM THE PART, RADIUS ' + f(S.r) + ' AND TIP ' + S.tip + ' IN THE OFFSET)\n' + (S.side > 0 ? 'G42' : 'G41') + ' G01 X' + f(S.x1) + ' Z' + f(S.z1 + (sys === 'inch' ? 0.1 : 2)) + ' (APPROACH FROM CLEAR)\nG01 Z' + f(S.z1) + '\n' +
      (S.kind === 'arc' ? g + ' X' + f(S.x2) + ' Z' + f(S.z2) + ' R' + f(S.rp) : 'G01 X' + f(S.x2) + ' Z' + f(S.z2)) + '\n...\nG40 G00 X... (CANCEL ON A MOVE AWAY)' : '';
  }
  el.querySelectorAll('[data-k]').forEach(i => i.oninput = i.onchange = draw);
  draw();
}
// Drawing of the element, the nose at both ends and the tip path.
function tnrcDiagram(S, o) {
  const pts = [[S.z1, S.x1 / 2], [S.z2, S.x2 / 2], [o[0], o[1] / 2], [o[2], o[3] / 2]];
  const zs = pts.map(p => p[0]), xs = pts.map(p => p[1]);
  const pad = S.r * 2.5 + (S.kind === 'arc' ? S.rp * 0.3 : 0);
  const z0 = Math.min(...zs) - pad, z1 = Math.max(...zs) + pad, x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad;
  const Wd = 440, Hd = 260, k = Math.min((Wd - 40) / (z1 - z0), (Hd - 50) / (x1 - x0));
  const P = (z, x) => [20 + (z - z0) * k, Hd - 30 - (x - x0) * k];
  const pt = p => p[0].toFixed(1) + ' ' + p[1].toFixed(1);
  const tz = { 1: 1, 2: -1, 3: -1, 4: 1, 5: 1, 6: 0, 7: -1, 8: 0 }[S.tip] || 0, tx = { 1: 1, 2: 1, 3: -1, 4: -1, 5: 0, 6: 1, 7: 0, 8: -1 }[S.tip] || 0;
  let s = '';
  const a = P(S.z1, S.x1 / 2), b = P(S.z2, S.x2 / 2), a2 = P(o[0], o[1] / 2), b2 = P(o[2], o[3] / 2);
  // Nose centres at the two ends of the tip path (tip minus r along the tip direction).
  const cen = [[o[0], o[1] / 2], [o[2], o[3] / 2]].map(([z, x]) => P(z - tz * S.r, x - tx * S.r));
  const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], cm = [(cen[0][0] + cen[1][0]) / 2, (cen[0][1] + cen[1][1]) / 2];
  if (S.kind === 'arc') {
    const R = S.rp * k, R2 = o[4] * k, sw = S.dir ? 0 : 1; // SVG y is down, so counter-clockwise in the drawing is sweep 0
    s += DK.path('M' + pt(a) + 'A' + R.toFixed(1) + ' ' + R.toFixed(1) + ' 0 0 ' + sw + ' ' + pt(b), 'part nofill');
    s += DK.path('M' + pt(a2) + 'A' + R2.toFixed(1) + ' ' + R2.toFixed(1) + ' 0 0 ' + sw + ' ' + pt(b2), 'hot dash');
  } else {
    // The part: a hatched band on the side of the line away from the tool.
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L;
    let nx = -uy, ny = ux; if ((cm[0] - mid[0]) * nx + (cm[1] - mid[1]) * ny > 0) { nx = -nx; ny = -ny; }
    s += DK.poly([a, b, [b[0] + nx * 12, b[1] + ny * 12], [a[0] + nx * 12, a[1] + ny * 12]], 'hatch') + DK.line(a[0], a[1], b[0], b[1], 'part');
    // the neighbouring face or diameter, as the solver assumes it
    const dz = Math.sign(S.z2 - S.z1) || 1, dx = Math.sign(S.x2 - S.x1) || 1, Ln = 2.2 * S.r;
    const nb = (e, z, x, back) => e === 1 ? [[z, x], [z + (back ? -dz : dz) * Ln, x]] : e === 2 ? [[z, x], [z, x + (back ? -dx : dx) * Ln]] : null;
    [nb(S.e1, S.z1, S.x1 / 2, true), nb(S.e2, S.z2, S.x2 / 2, false)].forEach(q => { if (q) { const p0 = P(q[0][0], q[0][1]), p1 = P(q[1][0], q[1][1]); s += DK.line(p0[0], p0[1], p1[0], p1[1], 'part'); } });
    s += DK.line(a2[0], a2[1], b2[0], b2[1], 'hot dash');
  }
  // The insert nose at each end of the move, and the imaginary tip it is programmed by.
  cen.forEach((c, n) => {
    s += DK.circle(c[0], c[1], S.r * k, 'tool') + DK.circle(c[0], c[1], 1.6, 'dimf');
    const q = n ? b2 : a2; s += DK.circle(q[0], q[1], 3.2, 'hotf');
    if (tz || tx) { const tq = P((n ? o[2] : o[0]) - tz * S.r, (n ? o[3] : o[1]) / 2); const tr = P((n ? o[2] : o[0]), (n ? o[3] : o[1]) / 2 - tx * S.r);
      s += DK.line(q[0], q[1], tq[0], tq[1], 'cons') + DK.line(q[0], q[1], tr[0], tr[1], 'cons'); }
  });
  s += DK.leader(cen[1][0] + S.r * k * 0.7, cen[1][1] - S.r * k * 0.7, Wd - 200, 40, 'insert nose, r ' + DK.n(S.r, 3), { anchor: 'start' });
  s += DK.leader(b2[0], b2[1], Wd - 200, 60, 'imaginary tip (programmed)', { anchor: 'start', hot: true });
  // Axes: Z along the spindle, X as radius (up).
  s += DK.arrow(14, Hd - 14, 54, Hd - 14, 'dim') + DK.text(60, Hd - 10, 'Z', { cls: 'dimt', anchor: 'start' }) + DK.arrow(14, Hd - 14, 14, Hd - 54, 'dim') + DK.text(14, Hd - 60, 'X', { cls: 'dimt' });
  s += DK.text(12, 16, 'To scale, X as radius. Hatched: the part; dashed: the tip path to program.', { cls: 'mut', anchor: 'start' });
  return DK.svg(Wd, Hd, s, 'Nose radius compensation drawing');
}

// ---------- Guide ----------
const WEAR = [
  ['flank', 'Flank wear', 'An even band worn on the clearance face just below the edge, from the flank rubbing on the work. It is the normal, predictable way an edge ends its life and what tool life limits usually measure.', 'Cutting speed too high for the grade; a grade with too little wear resistance; hard or abrasive work material; a feed so low that the edge rubs.', 'Lower the cutting speed; choose a more wear-resistant grade; raise a feed that is too low.', ['MMC', 'SECO']],
  ['crater', 'Crater wear', 'A hollow worn into the rake face a little behind the edge, where the hot chip slides and carries tool material away. If it grows to the edge, the edge chips or breaks.', 'High temperature at the rake face (diffusion), plus abrasion; work material that is abrasive, sticky or chemically close to the tool; uncoated grade.', 'Use a coated grade (a thick aluminium oxide layer helps); lower the speed and feed; use a more positive, free-cutting geometry; apply coolant.', ['MMC', 'SECO']],
  ['notch', 'Notch wear', 'A local notch at the depth-of-cut line, where the edge meets the work surface.', 'A work-hardened layer, or a hard cast or forged skin, at the depth-of-cut line; oxidation at high temperature.', 'Mitsubishi: a larger lead angle (smaller ISO entering angle) or a round insert, a larger corner radius with the depth of cut kept below it. Seco: lower the feed, vary the depth of cut between passes so the line moves, use a tougher grade.', ['MMC', 'SECO']],
  ['bue', 'Built-up edge', 'Work material welded onto the edge, which changes the edge shape, tears the surface and can pull pieces of the edge away when it breaks off.', 'Cutting temperature too low; work material with a strong affinity to the tool (low carbon steel, stainless, aluminium).', 'Raise the cutting speed; use a larger rake angle and a small hone; use coolant with good lubricity; use a grade with low affinity (cermet or coated).', ['MMC', 'SECO']],
  ['chipping', 'Chipping', 'Small pieces lost along the edge line, giving a ragged edge and a poor finish; flank wear then speeds up.', 'Impact in interrupted cuts, vibration, hard inclusions, built-up edge breaking away.', 'Make the set-up stiffer; use a tougher grade and a stronger edge (larger hone, smaller rake, wider land); lower the feed, above all at entry and exit.', ['MMC', 'SECO']],
  ['thermal', 'Thermal cracking', 'Short cracks running across the edge, from repeated heating and cooling; typical in milling and interrupted turning, and worse with coolant that reaches the edge only now and then.', 'Temperature cycles: interrupted cuts, high cutting temperature, intermittent wetting.', 'Use a sharper geometry to make less heat; a grade that resists thermal shock; cut with air, or with plenty of coolant all the time.', ['MMC', 'SECO']],
  ['deform', 'Plastic deformation', 'The edge sags or bulges under heat and pressure, so the flank and rake lose their shape; it often leads to sudden breakage.', 'High cutting force and temperature; work materials that conduct heat poorly.', 'Use a harder grade; lower speed and feed; use a larger corner radius; use coolant.', ['MMC', 'SECO']],
  ['fracture', 'Fracture and breakage', 'A large piece of the edge or the whole corner is gone, often all at once. What is left shows a rough broken face, not a worn one.', 'Impact and thermal shock, more likely on hard work and at the start of a cut (Mitsubishi). A load greater than the edge can carry, from cutting conditions that are too heavy, or an edge already weakened by other wear (Seco). An insert that is not seated properly in its pocket (Mitsubishi).', 'Clean the pocket, seat the insert, clamp it and tighten to the right torque. Start with a smaller depth of cut and feed. Use a tougher grade and a stronger edge: larger hone and land, larger corner radius, smaller rake. For heavy interrupted cuts use a larger shank. If earlier wear weakened the edge, change it sooner.', ['MMC', 'SECO']],
  ['flaking', 'Flaking', 'Shell-shaped pieces lifted off the face at the edge, leaving shallow curved scars.', 'The work springs back and loads the edge in compression, or welded material peels away and takes the surface with it. Common on hardened work, where the force pushing the tool away is high.', 'Mitsubishi calls it hard to avoid. Lower the feed and the cutting speed to keep the flank wear small; use a smaller corner radius. A narrower hone or a larger rake would lower the force but weaken the edge.', ['MMC']],
  ['hammer', 'Chip hammering', 'Damage on the part of the edge that is not cutting, beyond the depth-of-cut line, where the chip curls back and strikes it. That part can break off.', 'The chip curls back onto the unused edge; more likely with a high feed together with a large depth of cut.', 'Change the feed or the depth of cut so the chip goes elsewhere; use another entering angle or another chip breaker; use a tougher grade.', ['SECO']],
];
const TROUBLE_TURN = [
  ['Chatter / vibration', 'A set-up that is not stiff (long overhang, slender work); an insert that pushes too hard radially (large nose radius, blunt or negative edge).', 'Stiffen and shorten the set-up; use a sharp, positive insert with a smaller nose radius and a larger lead angle; a little more feed can calm a rubbing cut.', ['CD']],
  ['Poor surface finish', 'Feed too high for the nose radius; cutting speed too low; built-up edge from poor shearing.', 'Lower the feed or use a larger nose radius; raise the speed; use a more positive chip breaker; flood the cut with coolant.', ['CD']],
  ['Short tool life', 'Too much heat: speed too high for the grade; abrasive work material; built-up edge; chipping from vibration. See the wear section to read the edge.', 'Lower the speed; use coolant; use a harder grade for wear or a tougher one for chipping; use a more positive chip breaker.', ['CD', 'MMC', 'SECO']],
  ['Long, tangled chips', 'Chip too thin for the chip breaker.', 'Raise the feed; use a chip breaker made for lighter cuts; a smaller nose radius or smaller lead angle makes the chip thicker.', ['CD']],
  ['Burrs at the end of a cut', 'Worn edge; ductile material pushed off the edge as the tool leaves.', 'Change the edge earlier; chamfer before the exit or ease the feed off; use a sharper geometry.', []],
];
const TROUBLE_MILL = [
  ['Chatter (regular marks)', 'Machine, fixture or tool not stiff enough; cutting force too high; thin walls.', 'Stiffen the spindle, tool and fixture; lower feed, depth or width of cut; use sharp edges without a land; damp the part; try another spindle speed (see the chatter finder).', ['CDM']],
  ['Poor finish: rough', 'Worn edge; built-up edge; one tooth or insert standing proud (runout).', 'Use a more wear-resistant grade; raise the speed or add coolant against built-up edge; set inserts evenly and check runout.', ['CDM']],
  ['Poor finish: not flat or wavy', 'Deflection of part, cutter or spindle; spindle tilt; cut too wide for the cutter; feed per rev larger than the wiper flat.', 'Check deflection and spindle tram; use a more positive cutter or a larger one; lower the feed.', ['CDM']],
  ['Burrs and breakout on edges', 'Worn edges; too much edge hone; poor entry or exit angle; zero lead angle; chip load too high or too low.', 'Change edges earlier; use a sharper edge; move the cutter centre over the part so it exits at a better angle; use a lead angle; adjust chip load.', ['CDM']],
  ['Short tool life', 'Heat (speed too high), wrong grade, built-up edge, chipping from chatter or recut chips. See the wear section to read the edge.', 'Lower the speed or raise the chip load so the chip carries the heat away; use a suitable coated grade; clear chips with air or coolant; give the chips room (larger gullets).', ['CDM', 'MMC', 'SECO']],
];
const TROUBLE_DRILL = [
  ['Hole oversize', 'The drill runs out in its holder or is not in line with the hole; the two lips are not the same height or the point is off centre; the drill is longer than it needs to be; the work moves; chips pack in the flutes.', 'Check the runout of the drill in the holder; regrind so the lips are even and the point is central; use a shorter drill; clamp the work; peck or give the chips more room if they pack.', ['MMC68', 'PTD', 'FMC_D']],
  ['Hole undersize, or closing in', 'Heat: cutting speed too high, too little coolant reaching the cut.', 'Lower the speed; get more coolant to the point (a drill with coolant holes); check the diameter of the drill itself.', ['MMC68', 'PTD']],
  ['Hole not straight, not round or out of position', 'Uneven lips; runout in the holder; a poor start on the surface or too much feed at entry; a starting hole that is inaccurate or too shallow; a drill that is too long; work that moves; chips packing.', 'Cut the runout; regrind the point and thin the web so it starts cleanly; lower the feed while the point enters; make a better and deeper starting hole; use a shorter drill; clamp the work.', ['MMC68', 'PTD']],
  ['Drill breaks', 'Too much feed; a long drill; runout; work that moves; chips that are not carried out (too little coolant, flutes packed); on indexable drills also inserts not seated, an unsteady spindle or too little power.', 'Lower the feed; shorten the drill or its overhang; check runout and clamping; raise the coolant flow or peck to clear chips; check the seating of the inserts.', ['MMC68', 'PTD', 'FMC_D']],
  ['Chipping at the outer corners or lips', 'Too much feed as the drill breaks through; runout; work that moves.', 'Lower the feed at the exit; check runout and clamping; lower the speed; a little less point clearance or a larger edge hone makes the lips stronger.', ['MMC68', 'PTD']],
  ['Chipping at the chisel edge (centre)', 'A chisel edge that is too wide; a poor start; runout; a point that is off centre.', 'Thin the chisel edge; check runout and the point. The two sources differ on feed: Mitsubishi lowers the feed at entry, Precision Twist Drill raises the feed rate.', ['MMC68', 'PTD']],
  ['Wear on the outer corners and margins', 'Cutting speed too high; heat at the corners.', 'Lower the speed; Precision Twist Drill also raises the feed per revolution; aim more coolant at the cut, at a higher pressure, or use a drill with coolant holes.', ['MMC68', 'PTD']],
  ['Long, stringy chips', 'Feed too light for the chip to break; material that does not break chips well; on indexable drills too little coolant or the wrong chip breaker.', 'Raise the feed; peck (step) drill; use coolant through the drill; on indexable drills raise the coolant flow or change the chip breaker.', ['MMC68', 'FMC_D']],
  ['Burrs where the drill comes out', 'Too much feed at the exit; too large an edge hone.', 'Lower the feed for the last part of the hole; use a smaller edge hone.', ['MMC68']],
  ['Chatter, or a loud rough cut (indexable drills)', 'A set-up or part that is not stiff; the drill not seated in its holder; chips being cut twice; too much thrust.', 'Check the set-up and the seating; raise the coolant flow; lower the feed and raise the speed.', ['FMC_D']],
];
const TROUBLE_TAP = [
  ['Thread oversize', 'A tap with the wrong limit for the class of thread; the tap not in line with the hole or loose in its holder; the feed not matching the pitch, or the holder pushing the tap.', 'Use a tap with a tighter limit (see the tap limits tool); check alignment and the holder; feed at exactly the pitch; check the hole size before tapping.', ['FMC_T', 'REGAL']],
  ['Thread undersize (the GO gauge will not enter)', 'A tap with the wrong limit; a worn tap; a tap drill that is too small; material that closes in after the tap has passed.', 'Use a tap with a looser limit; change the worn tap; use a larger tap drill.', ['FMC_T']],
  ['Tap breaks', 'Too much torque: a worn tap, a tap drill that is too small, too little or the wrong lubricant, speed too high; chips trapped in the flutes; the tap reaching the bottom of the hole.', 'Change the tap sooner; use a larger tap drill (see the tap drill tool for the engagement); lubricate at the cut; lower the speed; drill deeper or thread less deep; use a holder that limits the torque; see "Chips packing".', ['FMC_T', 'REGAL']],
  ['Chips packing in the flutes', 'Not enough room for the chips, or chips that have nowhere to go.', 'Use a tap with fewer flutes; a spiral flute tap lifts the chips out of the hole, a spiral point tap pushes them ahead in a through hole; where the material allows, a forming tap makes no chips.', ['REGAL']],
  ['Rapid wear, or the tap and chips burn', 'Speed too high; too little lubricant, or the wrong one; a tap or surface treatment that does not suit the material; a hole hardened by the drill or drilled too small; a tap with too little hook to cut freely.', 'Lower the speed; put a suitable oil or emulsion right at the cut; use a tap with a wear-resistant surface treatment; check the drilling.', ['FMC_T', 'REGAL']],
  ['Material welding to the cutting edges (built-up edge)', 'Speed too high; too little coolant or lubricant; a worn tap or the wrong type of tap.', 'Lower the speed; improve the lubrication; change the tap; a surface treatment that resists sticking (nitride or steam oxide) helps.', ['FMC_T', 'REGAL']],
  ['Rough or torn thread', 'The wrong type of tap; speed too high; a chamfer that is too short; chips that cannot get out; too little rake; a tap drill that is too small; chipped teeth or a badly resharpened tap; poor lubrication.', 'Choose the tap for the material and hole; lower the speed; use a longer chamfer where the hole allows; clear the chips; check the tap drill size; change or regrind the tap; improve the lubrication.', ['FMC_T']],
  ['Bell-mouthed thread (larger at the start)', 'Too much or uneven pressure as the tap starts; axial force from the spindle on the tap; a part that is not located or clamped properly.', 'Control the feed as the tap starts; use a holder with length compensation; check the fixture.', ['FMC_T']],
];
const TROUBLE_GRIND = [
  ['Burn or cracks on the work', 'A wheel that is too hard, too fine or too dense; wheel speed too high or work speed too low; a cut that is too heavy; too little coolant, or coolant aimed past the cut; a wheel that needs dressing.', 'Use a softer, coarser or more open wheel; lower the wheel speed or raise the work speed; take lighter cuts; check the coolant level and aim the nozzle at the cut; dress the wheel.', ['RADIAC']],
  ['Chatter marks', 'A cut that is too heavy; a wheel that acts too hard; a wheel out of balance; slender work without support; vibration in the machine (loose parts, belts) or from outside; weak coolant.', 'Lighten the cut (slower infeed or traverse); make the wheel act softer: softer grade, faster work, slower wheel, coarser dress, richer coolant, one change at a time; balance the wheel and check it for cracks; support slender work with a steady rest; tighten what can vibrate.', ['RADIAC', 'OKUMA_G']],
  ['Rough finish', 'Dressing too coarse or too fast; a diamond that is too sharp; a cut that is too heavy; traverse or work speed too fast; dirty or weak coolant.', 'Dress more slowly and lighter; take a lighter cut; slow the traverse and the work; change the coolant or correct its strength.', ['RADIAC']],
  ['Wheel loads or glazes', 'A depth of cut that is too small; poor coolant; a worn dressing diamond.', 'Dress coarser (more infeed, faster traverse); change the coolant or use one that cleans better; change the diamond.', ['RADIAC']],
  ['Work out of round between centres', 'Centre holes that are out of round, burred, dirty or too shallow; centres that are worn, loose or a poor fit; the work loose or too tight between centres.', 'Clean and lap the centre holes; regrind or change the centres and lubricate them; set the tailstock pressure so the work turns freely without play.', ['RADIAC']],
  ['Spiral marks or feed lines', 'Work loose on the centres; headstock and tailstock out of line; steady rests set unevenly; traverse or work speed wrong for the finishing passes; an unsuitable wheel.', 'Clamp the headstock and tailstock and check their alignment and the centres; set the steady rests evenly; adjust the traverse and work speed for finishing.', ['RADIAC']],
  ['Long, even waves', 'A wheel out of balance: often one that was stopped with the coolant running, so one side is soaked, or one stored where it took up moisture or oil.', 'Balance the wheel; shut the coolant off and let the wheel spin dry before stopping it; store wheels in racks off the floor.', ['RADIAC']],
  ['Short, close waves', 'Vibration from belts, motors, the hydraulic system or other machines nearby.', 'Find the source and repair or replace the part that causes it.', ['RADIAC']],
];
// Spindle direction seen from above a vertical mill: M03 clockwise, M04 counterclockwise.
function cnSpin() {
  const arc = (cx, cw) => '<circle class="gm" cx="' + cx + '" cy="78" r="46"/><path class="gc" d="M' + (cx - 46) + ' 78A46 46 0 0 ' + (cw ? 1 : 0) + ' ' + cx + ' ' + (cw ? 32 : 124) + '"/>' +
    (cw ? '<path class="gc" d="M' + (cx - 9) + ' 26L' + cx + ' 32L' + (cx - 8) + ' 39"/>' : '<path class="gc" d="M' + (cx - 9) + ' 118L' + cx + ' 124L' + (cx - 8) + ' 131"/>') +
    '<circle class="gp" cx="' + cx + '" cy="78" r="14"/><path class="gm" d="M' + (cx - 5) + ' 78H' + (cx + 5) + 'M' + cx + ' 73V83"/>';
  return cnSvg(440, 170, arc(120, true) + cnT(120, 150, 'M03 clockwise', 'gv', 'middle') + arc(320, false) + cnT(320, 150, 'M04 counterclockwise', 'gv', 'middle') +
    cnT(220, 166, 'seen from above, looking down the spindle of a vertical mill', 'gs', 'middle'), 'Spindle direction: M03 clockwise and M04 counterclockwise, seen from above');
}
const PROG_CHARS = [
  ['%', 'Start and end of the program file', 'On LinuxCNC the pair may be left out when the file ends with M2 or M30; a % at the start with none at the end is an error.', ['LCNC_G', 'HFO_MP']],
  ['O and a number', 'Program number', 'On the Haas control the letter O and five digits name the program. LinuxCNC uses O words for subroutines and flow control instead.', ['HFO_MP', 'LCNC_G']],
  ['N and a number', 'Block (line) number', 'Optional. It is a label, not a word that does anything.', ['LCNC_G', 'NIST']],
  ['( )', 'Comment', 'Text in round brackets is for the reader and is not carried out.', ['LCNC_G', 'HFO_MP', 'NIST']],
  [';', 'End of block, or a comment', 'Haas listings show a semicolon at the end of each block. On LinuxCNC a semicolon starts a comment that runs to the end of the line.', ['HFO_MP', 'LCNC_G']],
  ['/', 'Block delete', 'First on a line: the line is skipped when the block delete switch is on.', ['LCNC_G', 'NIST']],
  ['Spaces, capitals', 'No meaning', 'On LinuxCNC spaces and tabs change nothing outside comments, and letters may be upper or lower case.', ['LCNC_G']],
];
function cnTable(head, rows) {
  return '<div class="res cntab" style="max-width:none"><table class="gtab"><tr>' + head.map(h => '<th>' + h + '</th>').join('') + '<th>Sources</th></tr>' +
    rows.map(r => '<tr>' + r.slice(0, 3).map((c, i) => '<td>' + (i ? '' : '<b>') + gesc(c) + (i ? '' : '</b>') + '</td>').join('') + '<td>' + cnTags(r[3]) + '</td></tr>').join('') + '</table></div>';
}
// Three worked coordinate examples; every result is worked by the Rust core from the fixed inputs shown.
function cnGeoExamples() {
  const W = state.W, f = (x, dp) => (typeof x === 'number' && isFinite(x)) ? x.toFixed(dp === undefined ? 3 : dp) : '-';
  const p1 = [10, 0], p2 = [50, 30], c = [30, 10], r = 12, run = 20, ang = 15;
  const lt = k => W.line_two_points(p1[0], p1[1], p2[0], p2[1], k), lc = k => W.line_circle(p1[0], p1[1], p2[0], p2[1], c[0], c[1], r, k);
  const rows = [
    ['A straight move from X' + p1[0] + ' Y' + p1[1] + ' to X' + p2[0] + ' Y' + p2[1], 'Its length and its angle from the X axis', 'length <b class="cgv">' + f(lt(0)) + '</b>, angle <b class="cgv">' + f(lt(1), 2) + '°</b>', 'linecirc', 'Line and circle'],
    ['The same line and a circle of radius ' + r + ' with its centre at X' + c[0] + ' Y' + c[1], 'The two points where the line cuts the circle', 'X<b class="cgv">' + f(lc(1)) + '</b> Y<b class="cgv">' + f(lc(2)) + '</b> and X<b class="cgv">' + f(lc(3)) + '</b> Y<b class="cgv">' + f(lc(4)) + '</b>', 'linecirc', 'Line and circle'],
    ['A taper at ' + ang + '° to the axis over a length of ' + run, 'How far the surface rises on the radius over that length', '<b class="cgv">' + f(W.rise_for_angle(run, ang)) + '</b> on the radius; a lathe programmed on diameter moves X by twice that', 'triangle', 'Triangle solver'],
  ];
  return '<h3>Worked examples</h3><div class="res cntab" style="max-width:none" id="cgex"><table class="gtab"><tr><th>The drawing gives</th><th>The program needs</th><th>Result (worked by BenchMate)</th><th>Tool</th></tr>' +
    rows.map(x => '<tr><td>' + x[0] + '</td><td>' + x[1] + '</td><td>' + x[2] + '</td><td><a href="#/t/' + x[3] + '">' + x[4] + '</a></td></tr>').join('') + '</table></div>' +
    '<p class="ms">Numbers in the units of the program. The sources of each calculation are on the page of its tool.</p>';
}

function renderCncGuide(el) {
  const toc = [['c-axes', 'Axes'], ['c-coord', 'Coordinate systems'], ['c-geo', 'Working out coordinates'], ['c-offs', 'Offsets'], ['c-prog', 'Program structure'], ['c-sub', 'Subprograms'], ['c-spin', 'Spindle'], ['c-climb', 'Climb vs conventional'], ['c-chip', 'Chip formation'], ['c-cond', 'Speed, feed and depth'],
    ['c-wear', 'Tool wear'], ['c-trt', 'Turning troubles'], ['c-trm', 'Milling troubles'], ['c-trd', 'Drilling troubles'], ['c-trtap', 'Tapping troubles'], ['c-trg', 'Grinding troubles'], ['c-hold', 'Workholding'], ['c-safe', 'Safety'], ['c-src', 'Sources']];
  el.innerHTML =
    '<nav class="gtoc">' + toc.map(([a, t]) => '<a href="#' + a + '">' + t + '</a>').join('') + '</nav>' +
    '<p class="desc">Written for BenchMate in our own words, with our own drawings. Each statement shows the keys of the public sources that confirm it (hover a key); anything not confirmed in two independent public sources is marked <span class="gtbv">to be verified</span>. Your machine and control manuals always win over this guide.</p>' +

    '<h2 id="c-axes">Machine axes</h2>' + cnMillAxes() + cnLatheAxes() +
    cp('<b>The standard.</b> Axis names and directions for numerically controlled machines are set by ISO 841:2001 (edition 2, confirmed in 2023 and still current).', ['ISO841'], 'cat') +
    cp('<b>Right-handed axes.</b> X, Y and Z form a right-handed set at right angles: with the right hand, thumb along +X, first finger along +Y, middle finger along +Z. The rotary axes A, B and C turn about lines parallel to X, Y and Z.', ['NIST']) +
    cp('<b>Program as if the tool moves.</b> Whether the table or the spindle actually moves, the program describes the motion of the tool relative to a work piece that stands still.', ['ISO841', 'NIST']) +
    cp('<b>Z is the spindle.</b> Z lies along (or parallel to) the main spindle; +Z is the direction that takes the tool away from the work. On a vertical mill +Z is up; on a lathe +Z points from the chuck toward the tailstock.', ['LCNC']) +
    cp('<b>Lathe X.</b> On a lathe X is radial, across the spindle axis, and +X takes the tool away from the axis. On a typical lathe with the tools on the operator side, +X points toward the operator; lathes with the tools behind the spindle have it the other way, which is why tip charts and G41/G42 pictures differ between manuals.', ['LCNC']) +
    cp('Most lathes program X as a diameter, and X offsets are entered on diameter too.', ['HFO_OP']) +

    '<h2 id="c-coord">Machine, work and tool coordinates</h2>' + cnOffsets() +
    cp('<b>Machine coordinates</b> are fixed by the builder: after homing, the control knows where machine zero (the reference position) is, and every axis position can be given in it. A move in machine coordinates (G53 on Fanuc-style controls and RS274NGC) does not use any work offset.', ['NIST', 'MIT_EM']) +
    cp('<b>Work coordinates</b> put zero where the programmer chose on the part: a corner, a bore centre or a datum on the drawing. The work offset is simply the machine position of that part zero, stored in a table on the control and called by G54 to G59.', ['NIST', 'MIT_EM', 'HFO_OP']) +
    cp('<b>More work offsets.</b> Beyond the six standard ones, controls add more: Fanuc G54.1 P1 to P48 (or more as an option), Haas G110 to G129 and G154 P1 to P99, RS274NGC and LinuxCNC G59.1 to G59.3. Each is just another stored part zero.', ['NIST']) +
    cp('<b>On a lathe</b> the work offset normally holds only Z (the face of the part); X zero is the spindle centre line, so the X work offset is left at zero.', ['HFO_OP']) +

    '<h2 id="c-geo">Working out coordinates</h2>' +
    cp('<b>Absolute and incremental.</b> In absolute mode (G90) every coordinate is a position in the current work coordinate system, measured from the part zero. In incremental mode (G91) every coordinate is a distance from the point where the tool stands. Absolute programs are easier to check against the drawing; incremental suits a pattern that repeats.', ['NIST', 'LCNC_G']) +
    cp('<b>Arcs by their centre.</b> G02 and G03 need the end point of the arc and its centre. In the centre format I, J and K give the centre as distances from the start point of the arc along X, Y and Z. LinuxCNC can also take them as absolute positions (G90.1); other controls have their own setting, so check which one yours uses.', ['NIST', 'LCNC_G']) +
    cp('<b>Arcs by their radius.</b> With R instead of I, J and K the control works out the centre. A positive R gives the arc of less than a half circle and a negative R the larger one. Both sources call the radius format bad practice for arcs that are nearly a half circle or nearly a full circle; LinuxCNC gives the reason, that a small change in the end point moves the centre much further, and prefers the centre format throughout. (At exactly 180° the two differ: NIST counts it with the positive R, LinuxCNC says less than 180°.)', ['NIST', 'LCNC_G']) +
    cp('<b>The points the drawing leaves out.</b> A drawing gives sizes, angles and radii; the program needs the X, Y (or X, Z) of every point where a line meets a line or an arc. Those points come from right-angle triangles and from circles, and BenchMate has a tool for each case: the <a href="#/t/triangle">Triangle solver</a> for tapers and chamfers, <a href="#/t/linecirc">Line and circle</a> for the length and angle of a move and for where a line meets or touches a circle, <a href="#/t/fillet">Fillet and tangent points</a> for a corner radius between two lines or a line and an arc, <a href="#/t/arc">Chord, arc and sagitta</a> for a radius from its width and height, and <a href="#/t/bolt">Bolt circle</a> for hole patterns. For the corrections a lathe tool nose needs when compensation is off, see the <a href="#/t/tnrc">Tool nose radius compensation</a> calculator.', null) +
    cnGeoExamples() +

    '<h2 id="c-offs">Tool length, radius and wear offsets</h2>' +
    cp('<b>Tool length offset (mill).</b> Each tool sticks out a different length from the spindle. Its length is stored in the offset table and switched on with G43 H(number), which adds it to the Z position; G49 cancels it. Then Z0 in the program is the same surface for every tool.', ['NIST', 'MIT_EM']) +
    cp('<b>Cutter radius compensation (mill).</b> G41 keeps the cutter on the left of the programmed path and G42 on the right, looking along the direction of travel; G40 cancels. The radius comes from a D register. Program the part outline and adjust size with the D value.', ['NIST', 'HFO_L']) +
    cp('<b>Lathe tool offsets.</b> Each turret position has X and Z geometry offsets, measured by touching the tool on the part or with a tool setter; X offsets are on diameter. T0101 calls tool 1 with offset 1.', ['HFO_OP']) +
    cp('<b>Wear offsets.</b> A second column, added to the geometry, takes the small corrections as the tool wears or a size drifts. Change the wear column, not the geometry, so the measured value is kept.', ['HFO_OP']) +
    cp('For tool nose radius compensation on the lathe, see the TNRC calculator in the Turning group.', null) +
    '<h3 id="c-3dcomp">3D tool compensation</h3>' +
    cp('<b>G41 and G42 work in one plane.</b> Most controls do not apply them to a 3D surface path, so a worn ball cutter on a 3D finish path is usually fixed by a new tool or a new path, not an offset.', ['CIMCO_3D', 'ICAM_3D']) +
    cp('<b>3D compensation</b> needs the CAM system to put out, with each point, a unit vector normal to the surface (I J K). The control moves the tool along that vector by the offset in the table (geometry plus wear).', ['HAAS_G141']) +
    cp('<b>Haas G141</b> works on G00 and G01 only; D must be programmed; the vector must have a length of 1; only the end point of each block is compensated, so it suits fine paths with small steps. Program the centre of a ball nose cutter; G40 cancels. Too much compensation can make the path cross itself.', ['HAAS_G141']) +
    cp('<b>Fanuc five-axis</b> uses G41.2 and G42.2 with G43.4 (tool centre point); the compensation is applied in the plane square to the tool axis.', ['ICAM_3D']) +
    cp('Check your own control\'s manual: the codes and the vector rules differ from maker to maker.', null) +

    '<h2 id="c-prog">Program structure</h2>' + cnBlock() +
    cp('<b>Blocks and words.</b> A program is a list of blocks (lines). Each block holds words: a letter address followed by a number (G01, X25.0, F0.15). An optional N number at the start numbers the block. The format is standardised in ISO 6983-1:2009.', ['NIST', 'MIT_EM']) +
    cp('<b>Modal and one-shot codes.</b> Most G codes stay in force until another code of the same group replaces them (modal): motion G00/G01/G02/G03, plane G17/G18/G19, units G20/G21, distance mode G90/G91, compensation and canned cycles. Two codes from the same modal group may not share a block. One-shot (non-modal) codes such as dwell G04 or G53 act in their own block only and must be repeated where needed.', ['NIST', 'MIT_EM', 'LCNC']) +
    cp('<b>Safe start line.</b> Start every program and every tool with a block that puts the modal state where you expect it, whatever ran before: plane, units, absolute mode, compensation off, tool length off (mill), canned cycle off. For example a mill: G17 G21 G40 G49 G80 G90; a lathe: G18 G21 G40 G80 G99. Check each code against your control: not every control has every one.', ['OWN']) +
    cp('<b>Comments</b> go in round brackets on Fanuc-style, Mitsubishi and RS274NGC controls. M30 (or M02) ends the program.', ['NIST', 'MIT_EM']) +
    cp('A block starting with / is skipped when the block delete switch is on.', ['NIST', 'LCNC_G']) +
    cp('<b>Inch or millimetre.</b> G20 sets the program to inches and G21 to millimetres. Put one of them in the start-up block of every program, so that the numbers are never read in the wrong unit.', ['LCNC_G', 'HFO_MP']) +
    cp('The <a href="#/t/gsim">G-code simulator</a> can convert a program between inch and millimetre. Offsets and settings stored in the control are not part of the program and have to be right at the machine.', null) +
    '<h3>Special characters in a program</h3>' + cnTable(['Character', 'Meaning', 'Notes'], PROG_CHARS) +
    cp('<b>Subprograms.</b> Repeated work goes in a subprogram: M98 P(number) calls it and M99 returns (Fanuc, Haas); Haas M97 calls a block inside the same program; LinuxCNC uses O-word subroutines; G65 calls a macro with arguments. See the G and M codes and Macro reference screens for each control.', []) +
    cp('<b>Typical order of one tool:</b> safe start line, tool change and offsets, spindle speed and direction, coolant, rapid to a clear start point, cut, retract to a safe height or position, coolant and spindle off, next tool; finally return to the change position and M30.', ['OWN']) +

    '<h2 id="c-sub">Subprograms</h2>' +
    cp('<b>Call and return.</b> M98 with P runs the program that has that O number. M99 ends the subprogram and goes back to the block after the call.', ['CCB_SUB', 'MG_SUB', 'IMD_SUB']) +
    cp('<b>Repeats.</b> L is the number of times it is run. Left out, it runs once.', ['CCB_SUB', 'MG_SUB', 'IMD_SUB']) +
    cp('Some controls write the number of repeats another way, with K for example.', ['MG_SUB']) +
    cp('<b>Inside the same program (Haas M97).</b> M97 with P runs the blocks that begin at that N number of the same program. They are put after the M30.', ['CCB_SUB', 'MG_SUB', 'IMD_SUB']) +
    cp('<b>Nesting.</b> A subprogram can call another one, down to a limit set by the control. Machinist Guides gives four levels for most controls and finds one enough for most work.', ['CCB_SUB', 'MG_SUB']) +
    cp('<b>Modes carry over.</b> What is modal at the call is still on inside the subprogram, and what the subprogram turns on is still on after the return.', ['MG_SUB']) +
    cp('<b>Same shape in several places.</b> Write the shape once in incremental moves, go to each start point in the main program and call it there.', ['CCB_SUB', 'MG_SUB']) +
    cp('<b>Several depths.</b> Write one pass once and call it again for each deeper level.', ['CCB_SUB']) +
    cp('<b>Macro call.</b> G65 with P also runs another program, and hands the values written in the block to its local variables. M98 hands over nothing.', ['CCB_SUB', 'IMD_SUB']) +
    cp('<b>M99 with P</b> returns to that N number of the calling program, not to the block after the call. CNC Cookbook finds it confusing and advises against it.', ['CCB_SUB', 'IMD_SUB']) +
    cp('<b>M99 in the main program</b> starts the program again from the top.', ['IMD_SUB']) +
    '<h3 class="gcat">Worked examples</h3>' +
    '<p class="desc">The three examples are our own, in the Fanuc and Haas style that the sources describe, with mm values. They show how the blocks hang together and are not cut-ready programs: prove any program on your own control first.</p>' +
    cp('<b>1. One shape at three places.</b> The subprogram is written in G91, so it starts from wherever the tool stands, and it goes back to G90 before it returns.', null) +
    '<pre class="gcode" id="csub1">O1000 (MAIN PROGRAM)\nT1 M06\nG90 G54 G00 X10. Y10.    (first start point)\nG43 H01 Z5. M03 S2000\nM98 P2000                (cut the shape here)\nG00 X60. Y10.            (second start point)\nM98 P2000\nG00 X110. Y10.           (third start point)\nM98 P2000\nG00 Z50. M05\nM30\n\nO2000 (THE SHAPE, FROM WHERE THE TOOL STANDS)\nG91 G01 Z-7. F100.       (down)\nX30. F250.\nY20.\nX-30.\nY-20.\nG00 Z7.                  (up by the same amount)\nG90                      (absolute again)\nM99                      (back to the main program)</pre>' +
    cp('<b>2. One pass, four depths.</b> Each call goes 1.5 mm deeper than the one before, because the Z move is incremental.', null) +
    '<pre class="gcode" id="csub2">G90 G00 X0. Y0.\nZ2.\nG01 Z0. F100.            (down to the top of the part)\nM98 P3000 L4             (four passes)\nG90 G00 Z50.\n\nO3000 (ONE PASS)\nG91 G01 Z-1.5 F100.\nX40. F250.\nY25.\nX-40.\nY-25.\nG90\nM99</pre>' +
    cp('<b>3. Haas M97.</b> The same pass kept in the main program, after the M30.', null) +
    '<pre class="gcode" id="csub3">G90 G00 X0. Y0.\nZ2.\nG01 Z0. F100.\nM97 P500 L4              (run the blocks from N500 four times)\nG90 G00 Z50.\nM30\nN500 G91 G01 Z-1.5 F100.\nX40. F250.\nY25.\nX-40.\nY-25.\nG90\nM99</pre>' +
    cp('The codes of each control are in <a href="#/t/gmcodes">G and M codes</a>, and variables, arguments and loops in the <a href="#/t/macroref">macro reference</a>.', null) +

    '<h2 id="c-spin">Spindle direction and constant surface speed</h2>' + cnSpin() +
    cp('<b>M03, M04, M05.</b> M03 starts the spindle clockwise at the S speed, M04 starts it counterclockwise and M05 stops it.', ['LCNC_G', 'HURCO_PF', 'HFO_MP']) +
    cp('<b>Seen from where.</b> Clockwise is judged from the headstock, looking along the spindle toward the work: on a vertical mill that is looking down from above.', ['HURCO_PF']) +
    cp('<b>Constant surface speed (lathe).</b> At a fixed rpm the cutting speed falls as the tool moves toward the centre. G96 with an S word in surface speed (m/min in millimetre mode, ft/min in inch mode) makes the control change the rpm with the diameter so that the cutting speed stays the same. G97 goes back to a fixed speed, with S in rev/min.', ['MASSO', 'MDOC', 'CADEM']) +
    cp('<b>Why the rpm climbs.</b> rpm = 1000 x cutting speed / (pi x diameter) in metric units, or 12 x cutting speed / (pi x diameter) with ft/min and inches: halve the diameter and the rpm doubles. At the centre line no spindle could keep up.', ['MDOC', 'CADEM']) +
    cp('<b>Always with a speed limit.</b> Give the control a top speed for G96, and when the rpm reaches it the spindle stays there for the rest of the cut. The word differs by control: G50 S on Haas and Fanuc-style lathes, G92 S in one Fanuc example read, a D word in the G96 block on LinuxCNC-style controls.', ['HFO_L', 'MDOC', 'CADEM', 'MASSO']) +
    cp('For a round part held rigidly the limit can be the top speed of the machine; for a part that is not round, or a fixture that is out of balance, set it lower.', ['CADEM']) +
    cp('<b>When fixed rpm is better.</b> Facing to the centre or parting off, where G96 simply runs up to the limit; and when one particular speed has been found to stop vibration.', ['MDOC']) +
    cp('See <a href="#/t/rpm">speed from cutting speed</a> and <a href="#/t/partofftime">part-off time</a>, which allows for the speed limit.', null) +

    '<h2 id="c-climb">Climb and conventional milling</h2>' + cnClimb() +
    cp('<b>Climb (down) milling:</b> the cutter turns "with" the feed, so each tooth enters the chip at its thickest and leaves thin. With the spindle turning clockwise (M03, seen from above) that means the material is on the right of the tool path. It rubs less, more of the heat goes away with the chip, chips are left behind the cutter instead of being recut, and edges usually last longer with a better finish.', ['HARV']) +
    cp('<b>Backlash.</b> Climb milling pulls the work into the cutter, so the feed drive must have no free play (backlash) or must compensate for it; most CNC machines do. On a machine with backlash, mill conventionally, or the table can jump and break the tool.', ['HARV']) +
    cp('<b>Conventional (up) milling:</b> each tooth enters at zero thickness and rubs before it bites, then leaves thick. Besides machines with backlash, it is the usual choice on castings, forgings and case-hardened surfaces, where entering thick would hit the hard skin with the full chip load.', ['HARV']) +

    '<h2 id="c-chip">Chip formation</h2>' + cnChip() +
    cp('<b>Shearing, not splitting.</b> The edge pushes the material ahead of it until it shears along a narrow shear zone running from the edge up to the surface; the sheared layer slides up the rake face as a chip. Most of the cutting heat is made in this zone and at the rake face.', []) +
    cp('<b>Chip types.</b> Ductile materials give continuous ribbons (which need a chip breaker); brittle materials such as cast iron give small discontinuous pieces; hard or heat-resistant alloys give segmented, saw-tooth chips. Material that welds to the edge gives a built-up edge.', []) +
    cp('<b>Chip load</b> (feed per tooth) is how much each cutting edge takes as it passes: feed rate = rpm x number of teeth x chip load. In turning, the matching figure is the feed per revolution.', ['CTE', 'WOODWEB']) +
    cp('Chip load is not always the chip thickness: a small radial depth of cut or a lead angle makes the chip thinner than the feed per tooth. See the <a href="#/t/chipthin">chip thinning</a> tool.', ['CTE']) +
    cp('Too little chip load makes heat and wears the tool out early; too much overloads the tool and the spindle and spoils the cut.', ['WOODWEB']) +
    cp('<b>Chip thickness</b> is set by the feed (and the entering angle in turning, the radial engagement in milling). Each chip breaker and edge works in a range of chip thickness: too thin and the edge rubs, too thick and it breaks. See the chip thinning tool for milling.', []) +

    '<h2 id="c-cond">Speed, feed and depth of cut: which to change</h2>' +
    cp('<b>Speed wears the tool fastest.</b> Raising the cutting speed shortens tool life more than anything else. Mitsubishi gives figures for turning: 20 % more speed halves the tool life, 50 % more leaves a fifth.', ['MMC_EFF', 'SECO_PAR']) +
    cp('<b>Feed and depth cost far less tool life</b> than speed does.', ['MMC_EFF', 'SECO_PAR']) +
    cp('<b>Feed and finish.</b> The feed sets the roughness of the surface, so the finish wanted puts a ceiling on it.', ['MMC_EFF', 'SECO_PAR']) +
    cp('<b>The order (Seco).</b> Take the largest depth of cut the job allows, to save passes. Then the highest feed that still gives the finish and quality wanted. Set the cutting speed last, to steer for the lowest cost or the highest output.', ['SECO_PAR']) +
    cp('<b>Not too little.</b> A feed that is too small brings flank wear and a shorter tool life. A depth of cut that is too small rubs in the hardened skin of the work.', ['MMC_EFF']) +
    cp('<b>Skin and scale.</b> On a cast or unmachined surface take a depth that gets under the hard, dirty skin, as far as the power of the machine allows.', ['MMC_EFF']) +
    cp('<b>Too slow can chatter.</b> Mitsubishi, for its turning tools: cutting at 65 to 130 SFM tends to chatter, and that shortens tool life.', ['MMC_EFF']) +
    cp('<b>Energy.</b> A lower speed with a higher feed and a smaller depth also uses less energy.', ['SECO_PAR']) +
    cp('The sum is in <a href="#/t/toollife">tool life and cost</a>; starting values come from the <a href="#/t/advturn">turning advisor</a> and the <a href="#/t/advmill">milling advisor</a>.', null) +

    '<h2 id="c-wear">Tool wear: types, causes and remedies</h2>' +
    '<p class="desc">Change one thing at a time and keep a note of what worked. Look at the worn edge under a lens before deciding. The <a href="#/t/toolwear">tool wear guide</a> has the same entries with a picture index.</p>' +
    WEAR.map(([id, name, look, cause, fix, keys]) => '<section class="gchar"><div class="gcg"><div class="cnwd">' + wearDraw(id) + '</div><dl><dt>' + name + ' ' + cnTags(keys) + '</dt><dd>' + gesc(look) + '</dd><dt>Causes</dt><dd>' + gesc(cause) + '</dd><dt>Remedies</dt><dd>' + gesc(fix) + '</dd></dl></div></section>').join('') +

    '<h2 id="c-trt">Turning troubleshooting</h2>' + cnTable(['Problem', 'Likely causes', 'Try'], TROUBLE_TURN) +
    '<h2 id="c-trm">Milling troubleshooting</h2>' + cnTable(['Problem', 'Likely causes', 'Try'], TROUBLE_MILL) +
    '<h2 id="c-trd">Drilling troubleshooting</h2>' + cnTable(['Problem', 'Likely causes', 'Try'], TROUBLE_DRILL) +
    '<h2 id="c-trtap">Tapping troubleshooting</h2>' + cnTable(['Problem', 'Likely causes', 'Try'], TROUBLE_TAP) +
    '<h2 id="c-trg">Grinding troubleshooting</h2><p class="desc">Cylindrical and surface grinding with conventional wheels. Change one thing at a time.</p>' + cnTable(['Problem', 'Likely causes', 'Try'], TROUBLE_GRIND) +

    '<h2 id="c-hold">Workholding basics</h2>' + cnVise() +
    cp('<b>Locate, then clamp.</b> Seat the part against fixed locating faces (the fixed jaw, parallels, a stop), then apply clamping force toward those faces. The fixed jaw and the parallels set the position; the moving jaw only holds.', []) +
    cp('<b>Vise practice.</b> Indicate the fixed jaw parallel to the axis before work; seat the part on parallels with a soft-faced mallet; grip on enough jaw height; use a stop for repeat parts. Soft jaws machined to the part shape hold odd shapes and second operations.', []) +
    cp('<b>Lathe chucks and collets.</b> Keep the part stick-out short (long, slender parts need a tailstock or steady); never run a chuck faster than its rated speed, since grip falls as the jaws fly outward with speed.', []) +
    cp('<b>Thin and flexible parts.</b> Clamp force bends them, and they spring back after cutting: use more, gentler clamps, support under the cut, and lighter finishing passes.', []) +

    '<h2 id="c-safe">Shop safety</h2>' +
    '<p class="desc">A short reminder, not a safety programme. Follow your employer\'s risk assessment, the machine maker\'s manual and local law (in the UK the HSE guidance, in the US the OSHA rules).</p>' +
    cp('<b>Guards and interlocks.</b> Run with every guard and door interlock in place; never bypass an interlock. Rotating chucks, spindles and bar stock can catch clothing, hair, gloves and rags.', []) +
    cp('<b>Dress for rotating machinery.</b> Eye protection always; no loose sleeves, jewellery or long loose hair; do not wear gloves near a rotating chuck, spindle or work.', []) +
    cp('<b>Never touch moving parts or chips by hand.</b> Stop the spindle before measuring, clearing chips or adjusting; use a brush or hook for chips; never leave a key in a chuck.', []) +
    cp('<b>Emery cloth.</b> Never hold emery cloth by hand against a part turning in a lathe, manual or CNC: it can snag and pull the hand in. If it has to be used, clamp it in a holder in the tool post.', ['HSE_EM']) +
    cp('<b>Proving a new program.</b> Check offsets and the tool list; dry run or run with rapid override down and single block; keep a hand at feed hold; watch the first part through.', []) +
    cp('<b>Coolant.</b> Metalworking fluids can cause skin and breathing problems: keep them maintained at the right concentration, avoid skin contact and mist, and wash before eating.', []) +
    cp('<b>Isolation.</b> Lock out the machine before maintenance or clearing a jam inside the guarding.', []) +

    '<h2 id="c-src">Sources</h2><ul class="gsl">' + Object.entries(CNC_SOURCES).map(([k, v]) => '<li><b>' + k + '</b> ' + gesc(v) + '</li>').join('') + '</ul>' +
    '<p class="desc">Full URLs and access dates are in docs/sources.md. No text, figures or tables were copied from standards, handbooks, maker catalogues or other calculators.</p>';
  el.querySelectorAll('.gtoc a').forEach(a => a.onclick = e => { e.preventDefault(); const t = el.querySelector(a.getAttribute('href')); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
}

// ------------------------------------------------------------------ tool wear guide
// A picture index of the wear types, then one card each: what you see, why, and what to try. Same data as the
// tool wear section of the CNC guide.
const WEAR_GRADUAL = ['flank', 'crater'];
function renderToolWear(el) {
  el.innerHTML = '<div class="gdtguide wearg">' +
    '<p class="desc">Clean the edge and look at it under a lens (about 10x) in good light before changing anything. Find the picture that matches, read the causes, then change one thing at a time and keep a note of what worked. The drawings show the edge unfolded: the rake face, where the chip runs, is above the edge line; the flank, the face towards the work, is below it; the corner is at the left and the dashed line is where the edge leaves the work.</p>' +
    '<div class="weari">' + WEAR.map(([id, name]) => '<a class="weart" href="#/t/toolwear" data-w="' + id + '">' + wearDraw(id) + '<span>' + gesc(name) + '</span></a>').join('') + '</div>' +
    WEAR.map(([id, name, look, cause, fix, keys]) => '<section class="gchar wearc" id="wear-' + id + '"><div class="gcg"><div class="weard">' + wearDraw(id) + '</div><dl>' +
      '<dt>' + gesc(name) + ' ' + cnTags(keys) + '</dt><dd><span class="weark">' + (WEAR_GRADUAL.includes(id) ? 'Gradual wear: expected, keep it within limits' : 'Damage: find the cause') + '</span></dd>' +
      '<dt>What you see</dt><dd>' + gesc(look) + '</dd><dt>Causes</dt><dd>' + gesc(cause) + '</dd><dt>What to try</dt><dd>' + gesc(fix) + '</dd></dl></div></section>').join('') +
    '<div class="note"><b>How this was put together.</b> The causes and remedies are from two tool makers\' public guides, in our own words. Where they give different remedies both are named. An entry with one source key is marked "to be verified": only one of the two guides describes it. Mitsubishi separates gradual wear of the flank and rake faces from sudden damage, which the cutting conditions and the tool should be chosen to prevent; the label under each name follows that. The drawings are our own.</div>' +
    '<div class="note"><b>Sources</b><br>' + ['MMC', 'SECO'].map(k => '<b>' + k + '</b>: ' + gesc(CNC_SOURCES[k])).join('<br>') + ', both read again 2026-11-12.</div></div>';
  for (const a of el.querySelectorAll('.weart')) a.onclick = e => {
    e.preventDefault();
    const c = el.querySelector('#wear-' + a.dataset.w); if (!c) return;
    for (const x of el.querySelectorAll('.wearc.on')) x.classList.remove('on');
    c.classList.add('on'); c.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };
}

