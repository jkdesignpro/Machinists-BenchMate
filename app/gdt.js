// GD&T section: symbol drawings, the reference guide, the feature control frame
// builder and the tolerance stack screen. All text here is BenchMate's own
// wording; standards are cited by name, year and clause only. Every rule
// statement carries source keys that resolve to GDT_SOURCES (and docs/gdt.md).
// Statements without two independent sources are marked "to be verified".
'use strict';

const gesc = x => String(x ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- Symbols (own drawings, 20 x 20 box, stroke = currentColor) ----------
function arrowHead(hx, hy, dx, dy) {
  const l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l, nx = -uy, ny = ux;
  const bx = hx - 4.2 * ux, by = hy - 4.2 * uy;
  return '<path class="fill" d="M' + hx + ' ' + hy + 'L' + (bx + 1.7 * nx).toFixed(2) + ' ' + (by + 1.7 * ny).toFixed(2) + 'L' + (bx - 1.7 * nx).toFixed(2) + ' ' + (by - 1.7 * ny).toFixed(2) + 'Z"/>';
}
const SYM_BODY = {
  straightness: '<path d="M3 10H17"/>',
  flatness: '<path d="M4.5 14.5L8 5.5H16.5L13 14.5Z"/>',
  circularity: '<circle cx="10" cy="10" r="6"/>',
  cylindricity: '<circle cx="10" cy="10" r="4.6"/><path d="M2.3 13.4L8.9 2M11.1 18L17.7 6.6"/>',
  profile_line: '<path d="M3 14A7 7 0 0 1 17 14"/>',
  profile_surface: '<path d="M3 14A7 7 0 0 1 17 14Z"/>',
  perpendicularity: '<path d="M3 16H17M10 16V3"/>',
  parallelism: '<path d="M4.5 16L10 4M10 16L15.5 4"/>',
  angularity: '<path d="M3 16H17M3 16L16 8.5"/>',
  position: '<circle cx="10" cy="10" r="5"/><path d="M10 2V18M2 10H18"/>',
  concentricity: '<circle cx="10" cy="10" r="3"/><circle cx="10" cy="10" r="7"/>',
  symmetry: '<path d="M5.5 5.5H14.5M2 10H18M5.5 14.5H14.5"/>',
  circular_runout: '<path d="M6 16.5L13.6 4.4"/>' + arrowHead(14.5, 3, 1, -1.6),
  total_runout: '<path d="M3 17H11M3 17L8.6 6.4M11 17L16.6 6.4"/>' + arrowHead(9.4, 4.9, 1, -1.9) + arrowHead(17.4, 4.9, 1, -1.9),
  dia: '<circle cx="10" cy="10" r="5.5"/><path d="M4 16L16 4"/>',
};
function sym(name, cls) {
  return '<svg class="gsym ' + (cls || '') + '" viewBox="0 0 20 20" aria-hidden="true">' + (SYM_BODY[name] || '') + '</svg>';
}
// Circled-letter modifiers drawn as SVG (no dependence on a font having U+24xx glyphs).
function circled(letter) {
  return '<svg class="gmod" viewBox="0 0 20 20" aria-label="' + letter + ' in a circle"><circle cx="10" cy="10" r="8"/><text x="10" y="14.2" text-anchor="middle">' + letter + '</text></svg>';
}
function stBox() {
  return '<svg class="gmod wide" viewBox="0 0 30 20" aria-label="ST in a hexagon"><path d="M5 2H25L29 10L25 18H5L1 10Z"/><text x="15" y="14.2" text-anchor="middle">ST</text></svg>';
}

// ---------- Sources (full list with URLs and access dates in docs/gdt.md) ----------
const GDT_SOURCES = {
  ISO: 'ISO online catalogue (iso.org): ISO 1101:2017, ISO 2692:2021, ISO 8015:2011, ISO 22081:2021, ISO 5459:2024 listing, ISO 2768-2:1989 and ISO 5459:2011 withdrawn (accessed 2026-11-10)',
  ASME: 'ASME catalogue page, Y14.5-2018 (R2024) Dimensioning and Tolerancing, stabilized maintenance (asme.org, accessed 2026-11-10)',
  MIT: 'J. Salsbury, "GD&T and the new ASME Y14.5-2018", Mitutoyo America Corporation, 2019',
  GLS: 'Geometric Learning Systems (gdtseminars.com), GD&T reference chart for ASME Y14.5-2018, 2019',
  GDTB: 'GD&T Basics (gdandtbasics.com), educational articles',
  KEY: 'KEYENCE, "GD&T" measurement guide (keyence.com)',
  UIUC: 'University of Illinois, ME 170 Engineering Drawing Notes (courses.grainger.illinois.edu)',
  HZ: 'Z. Humienny, P. Zdrojewski, "ISO GPS and ASME GD&T standards: differences and similarities in definitions of measurands", Metrology and Measurement Systems 30(4), 2023',
  SKL: 'Skill-Lync resources, GD&T fundamentals and interview notes',
  OEP: 'Open Exam Prep, ASME GDTP study guide pages (open-exam-prep.com)',
  JLC: 'JLCCNC blog, MMC and LMC in GD&T, 2026',
  CNCC: 'CNCCookbook, Beginner\'s Guide to GD&T: Datums, 2024',
  WEV: 'Wevolver, True position in GD&T: formula, tolerance zones and MMC, 2026',
  ACC: 'F. Schenkelberg, Root sum squared tolerance analysis method, Accendo Reliability',
  FF: 'Five Flute, Introduction to root sum squared (RSS) tolerance analysis',
  OWN: 'BenchMate derivation (geometry or arithmetic), with tests in core/src/gdt.rs',
};
// Render source keys; fewer than two independent keys (OWN counts for maths only) = to be verified.
function srcTags(keys, tbv) {
  const k = (keys || []).map(x => '<abbr class="gsrc" title="' + gesc(GDT_SOURCES[x] || x) + '">' + x + '</abbr>').join('');
  return k + (tbv ? '<span class="gtbv" title="Not yet confirmed in two independent public sources">to be verified</span>' : '');
}

// ---------- Characteristics data ----------
// datums: 'never' | 'required' | 'optional'. fos: can apply to a feature of size (axis/median plane).
// mc: MMC/LMC allowed (only when applied to a feature of size). dia: diameter zone possible.
const CHARS = [
  { id: 'straightness', name: 'Straightness', cat: 'Form', datums: 'never', fos: true, mc: true, dia: true, asme: true, iso: true,
    zone: 'On a surface: two parallel lines, the tolerance apart, in each cross-section that contains the line element. Applied to a feature of size: a cylinder of the tolerance diameter that must contain the derived median line (axis).',
    controls: 'How straight each line element (or the axis) is. Nothing about orientation or location.',
    inspect: 'Line elements: indicator along the surface on a surface plate, straight edge, or CMM scan. Median line at MMC: a functional gauge at the virtual condition, or CMM.',
    mistakes: 'Adding a datum reference (form never has one). Mixing up surface-line straightness (no diameter symbol, no MMC) with axis straightness (diameter symbol, MMC allowed). Axis straightness at MMC lets the part break the Rule #1 envelope; its boundary is the virtual condition.',
    src: ['GDTB', 'UIUC', 'GLS', 'HZ'] },
  { id: 'flatness', name: 'Flatness', cat: 'Form', datums: 'never', fos: true, mc: true, dia: false, asme: true, iso: true,
    zone: 'Two parallel planes the tolerance apart; the whole surface must lie between them. The planes may sit at any angle: flatness is not related to any other feature. Applied to a feature of size (a width), it controls the derived median plane.',
    controls: 'Form of one plane surface only.',
    inspect: 'Part on adjustable supports on a surface plate, levelled until the indicator reads the same at three far-apart points, then sweep; or CMM; optical flats for lapped faces.',
    mistakes: 'Resting the part on its other face and sweeping the top: that measures parallelism to the opposite face, not flatness. Adding a datum or a diameter symbol.',
    src: ['GDTB', 'UIUC', 'GLS'] },
  { id: 'circularity', name: 'Circularity (roundness)', cat: 'Form', datums: 'never', fos: false, mc: false, dia: false, asme: true, iso: true,
    zone: 'In each cross-section square to the axis: two concentric circles whose radii differ by the tolerance. Every section is checked on its own.',
    controls: 'Roundness of each section. Not straightness, taper or location.',
    inspect: 'Roundness machine (part rotated on a precision spindle). Two-point measurement with a micrometer may not reveal odd-lobed shapes (three lobes, five lobes), so on its own it is not a circularity check (to be verified: how lobing affects V-block and two-point readings).',
    mistakes: 'Treating the tolerance as a diameter difference: the zone is a radial width. Adding a datum. Giving a value equal to or larger than the size tolerance, which Rule #1 already covers. Spinning the part on a datum instead of its own axis measures runout, not circularity.',
    src: ['GDTB', 'UIUC', 'GLS'] },
  { id: 'cylindricity', name: 'Cylindricity', cat: 'Form', datums: 'never', fos: false, mc: false, dia: false, asme: true, iso: true,
    zone: 'Two coaxial cylinders whose radii differ by the tolerance; the whole surface must lie between them.',
    controls: 'Circularity, straightness of the surface elements and taper of the surface together.',
    inspect: 'Roundness or form machine with a vertical axis travel, or CMM scanning several sections and lines.',
    mistakes: 'Adding a datum or a diameter symbol. Expecting it to control the location of the cylinder (it does not). Giving a value larger than the size tolerance.',
    src: ['GDTB', 'UIUC', 'GLS'] },
  { id: 'profile_line', name: 'Profile of a line', cat: 'Profile', datums: 'optional', fos: false, mc: false, dia: false, asme: true, iso: true,
    zone: 'In each cross-section: two lines offset from the true profile (defined by basic dimensions), the tolerance apart. Equally disposed about the true profile unless stated otherwise.',
    controls: 'Form of each line element. With datums it also controls orientation and location of those elements.',
    inspect: 'CMM sections compared with the CAD model; optical comparator against an overlay for flat parts.',
    mistakes: 'Defining the true profile with toleranced (plus/minus) dimensions instead of basic dimensions.',
    src: ['GDTB', 'GLS', 'UIUC'] },
  { id: 'profile_surface', name: 'Profile of a surface', cat: 'Profile', datums: 'optional', fos: false, mc: false, dia: false, asme: true, iso: true,
    zone: 'Two surfaces offset from the true profile (defined by basic dimensions), the tolerance apart, over the whole surface. Equally disposed about the true profile unless the unequal (U) modifier says otherwise.',
    controls: 'Without datums: form (and size of the shape). With datums: also orientation and location. One of the most useful controls for non-cylindrical shapes.',
    inspect: 'CMM or 3D scanner compared with the CAD model; check fixture with indicators set to a master.',
    mistakes: 'Reading the value as plus/minus (it is the total zone width). Forgetting basic dimensions. Expecting it to fix location when no datums are referenced.',
    src: ['GDTB', 'GLS', 'KEY'] },
  { id: 'perpendicularity', name: 'Perpendicularity', cat: 'Orientation', datums: 'required', fos: true, mc: true, dia: true, asme: true, iso: true,
    zone: 'Surface: two parallel planes the tolerance apart, at 90 degrees to the datum. Axis (feature of size): with the diameter symbol, a cylinder of the tolerance diameter at 90 degrees to the datum.',
    controls: 'Orientation at 90 degrees. On a surface the zone is two planes, so it also limits that surface\'s flatness. It does not locate the feature.',
    inspect: 'Part on a surface plate or angle plate (the datum simulator), indicator on a height stand or square; CMM; functional gauge for an axis at MMC.',
    mistakes: 'Leaving out the datum. Forgetting the diameter symbol when an axis is meant (the zone then becomes two parallel planes).',
    src: ['UIUC', 'GLS', 'GDTB'] },
  { id: 'parallelism', name: 'Parallelism', cat: 'Orientation', datums: 'required', fos: true, mc: true, dia: true, asme: true, iso: true,
    zone: 'Surface: two planes the tolerance apart, parallel to the datum. Axis: a cylinder of the tolerance diameter parallel to the datum (with the diameter symbol).',
    controls: 'Orientation parallel to a datum. On a surface it also limits flatness. It does not control the distance to the datum; the size or location tolerance does that.',
    inspect: 'Datum face on a surface plate, indicator swept over the toleranced face: the full indicator movement is the parallelism.',
    mistakes: 'Leaving out the datum. Expecting it to control the height (distance) of the surface.',
    src: ['GDTB', 'UIUC', 'GLS'] },
  { id: 'angularity', name: 'Angularity', cat: 'Orientation', datums: 'required', fos: true, mc: true, dia: true, asme: true, iso: true,
    zone: 'Two parallel planes (or a cylinder for an axis) at the basic angle to the datum.',
    controls: 'Orientation at a basic angle to the datum. It does not locate the feature.',
    inspect: 'Sine plate or sine bar set to the basic angle on a surface plate, then sweep with an indicator; CMM.',
    mistakes: 'Giving the angle its own plus/minus tolerance (the angle is basic). Leaving out the datum.',
    src: ['UIUC', 'GLS'] },
  { id: 'position', name: 'Position', cat: 'Location', datums: 'required', fos: true, mc: true, dia: true, asme: true, iso: true,
    zone: 'Usually a cylinder of the tolerance diameter, centred on the true position given by basic dimensions from the datum reference frame, that must contain the axis. For widths (slots, tabs) two parallel planes. For a sphere, a spherical zone.',
    controls: 'Location of features of size (holes, pins, slots, tabs), and their orientation to the datums referenced.',
    inspect: 'CMM: measure the deviation dX, dY from true position and convert to a diameter, 2 x sqrt(dX^2 + dY^2) (see the True position calculator), then add any bonus. At MMC: a functional gauge with pins at the virtual condition size (hole MMC minus the position tolerance), placed at the basic locations.',
    mistakes: 'Locating the feature with plus/minus dimensions instead of basic ones. Comparing the radial deviation sqrt(dX^2 + dY^2) with a diameter tolerance (it must be doubled). Forgetting bonus tolerance at MMC, or claiming bonus when the frame has no MMC modifier.',
    src: ['GDTB', 'WEV', 'UIUC', 'GLS', 'KEY'] },
  { id: 'circular_runout', name: 'Circular runout', cat: 'Runout', datums: 'required', fos: false, mc: false, dia: false, asme: true, iso: true,
    zone: 'At each measuring position, while the part turns one full turn about the datum axis, the full indicator movement must not exceed the tolerance. Each circular element is checked on its own.',
    controls: 'For surfaces around the axis: the combined effect of circularity and coaxiality in each section. For faces square to the axis: wobble in each circle.',
    inspect: 'Part held on its datum features (centres, V-blocks, collet or chuck that really simulates the datum), turned one revolution under a dial indicator.',
    mistakes: 'Holding the part on something that is not the datum feature. Applying MMC (runout is always regardless of feature size). Leaving out the datum axis.',
    src: ['GDTB', 'UIUC', 'GLS', 'SKL'] },
  { id: 'total_runout', name: 'Total runout', cat: 'Runout', datums: 'required', fos: false, mc: false, dia: false, asme: true, iso: true,
    zone: 'While the part turns about the datum axis and the indicator traverses the whole surface, the full indicator movement over the entire surface must not exceed the tolerance.',
    controls: 'For a cylinder: circularity, straightness, taper and coaxiality together (a cumulative control). For a face square to the axis: perpendicularity and flatness of that face.',
    inspect: 'As circular runout, but the indicator is moved along (or across) the surface while the part turns, and the readings are not reset between positions.',
    mistakes: 'Resetting the indicator at each position (that is circular runout). Applying MMC. Leaving out the datum.',
    src: ['GDTB', 'UIUC', 'GLS', 'SKL'] },
  { id: 'concentricity', name: 'Concentricity / coaxiality', cat: 'Location', datums: 'required', fos: true, mc: false, dia: true, asme: false, iso: true,
    zone: 'ISO 1101:2017 keeps coaxiality (for an axis) and concentricity (for a centre point); the zone is a cylinder (or circle) about the datum axis (to be verified against the standard). Former ASME practice (Y14.5-2009) controlled the median points of opposed elements.',
    controls: 'Coaxiality of an axis to a datum axis (ISO).',
    inspect: 'CMM. The former ASME median-point check was costly to inspect.',
    mistakes: 'Using it on a drawing to ASME Y14.5-2018: removed from that edition. Use position (RMB/MMC), runout or profile instead.',
    src: ['MIT', 'GLS', 'KEY'] },
  { id: 'symmetry', name: 'Symmetry', cat: 'Location', datums: 'required', fos: true, mc: false, dia: false, asme: false, iso: true,
    zone: 'Two parallel planes the tolerance apart, centred on the datum centre plane (to be verified against ISO 1101:2017).',
    controls: 'Centring of a slot or tab on a datum centre plane.',
    inspect: 'CMM, or measure both walls to the datum and compare.',
    mistakes: 'Using it on a drawing to ASME Y14.5-2018: removed from that edition. Use position or profile instead.',
    src: ['MIT', 'GLS', 'KEY'] },
];
const CHAR = Object.fromEntries(CHARS.map(c => [c.id, c]));

// ---------- Diagrams for each characteristic (own drawings, theme-aware) ----------
// Part = solid ink stroke; tolerance zone = accent dashed; datum = muted with triangle.
function zoneDiagram(id) {
  const W = 220, H = 120;
  const zone = (d) => '<path class="gz" d="' + d + '"/>';
  const part = (d) => '<path class="gp" d="' + d + '"/>';
  const dat = (x, y, letter) => '<g class="gd"><path d="M' + (x - 6) + ' ' + y + 'H' + (x + 6) + 'L' + x + ' ' + (y + 8) + 'Z"/><path d="M' + x + ' ' + (y + 8) + 'V' + (y + 16) + '"/><rect x="' + (x - 8) + '" y="' + (y + 16) + '" width="16" height="15"/><text x="' + x + '" y="' + (y + 27.5) + '" text-anchor="middle">' + letter + '</text></g>';
  const lab = (x, y, t, a) => '<text class="gl" x="' + x + '" y="' + y + '"' + (a ? ' text-anchor="' + a + '"' : '') + '>' + t + '</text>';
  const dim = (x, y1, y2, t) => '<path class="gm" d="M' + x + ' ' + y1 + 'V' + y2 + 'M' + (x - 3) + ' ' + y1 + 'H' + (x + 3) + 'M' + (x - 3) + ' ' + y2 + 'H' + (x + 3) + '"/>' + lab(x + 5, (y1 + y2) / 2 + 4, t);
  let b = '';
  switch (id) {
    case 'straightness':
      b = zone('M20 40H180M20 54H180') + part('M20 47Q60 42 100 49T180 46') + dim(190, 40, 54, 't') + lab(20, 80, 'line element between lines t apart');
      break;
    case 'flatness':
      b = zone('M20 50L60 30H200L160 50ZM20 66L60 46H200L160 66Z') + part('M22 58Q70 46 110 52T196 46') + dim(206, 46, 62, 't') + lab(20, 92, 'surface between planes t apart');
      break;
    case 'circularity':
      b = zone('M110 20A40 40 0 1 1 109.9 20ZM110 30A30 30 0 1 1 109.9 30Z') + part('M110 24Q146 24 145 60Q148 96 110 95Q74 98 75 60Q72 26 110 24Z') + dim(160, 20, 30, 't (radial)') + lab(14, 112, 'each section: two circles');
      break;
    case 'cylindricity':
      b = zone('M40 30H180M40 46H180M40 74H180M40 90H180') + '<path class="gz" d="M40 30A8 30 0 0 0 40 90M180 30A8 30 0 0 1 180 90M40 46A4 14 0 0 0 40 74"/>' + part('M40 36Q110 32 180 40M40 84Q110 86 180 80') + dim(195, 30, 46, 't') + lab(14, 112, 'between two coaxial cylinders');
      break;
    case 'profile_line': case 'profile_surface':
      b = '<path class="gb" d="M20 70Q70 70 90 45T160 40H200"/>' + zone('M20 62Q70 62 88 37T160 32H200M20 78Q70 78 92 53T160 48H200') + part('M20 72Q68 66 90 44T160 42Q180 38 200 41') + dim(208, 32, 48, 't') + lab(14, 104, 'zone t, centred on true profile');
      break;
    case 'perpendicularity':
      b = '<path class="gb" d="M20 92H200"/>' + zone('M96 20V92M110 20V92') + part('M100 92Q104 60 106 22') + dat(150, 92, 'A') + '<path class="gm" d="M96 14H110"/>' + lab(112, 16, 't') + lab(20, 114, '90 deg to datum A');
      break;
    case 'parallelism':
      b = '<path class="gb" d="M20 92H200"/>' + zone('M20 34H200M20 48H200') + part('M20 44Q80 37 140 42T200 40') + dat(110, 92, 'A') + dim(208, 34, 48, 't') + lab(14, 70, 'parallel to datum A');
      break;
    case 'angularity':
      b = '<path class="gb" d="M20 92H200"/>' + zone('M30 92L130 20M44 92L144 20') + part('M37 90Q90 52 136 22') + dat(170, 92, 'A') + lab(60, 84, 'basic angle') + '<path class="gm" d="M70 92A40 40 0 0 0 62 69"/>';
      break;
    case 'position':
      b = '<path class="gb" d="M20 100H200M20 100V10"/>' + '<path class="gm" d="M110 100V20M20 55H180"/>' + zone('M110 41A14 14 0 1 1 109.9 41Z') + part('M114 51l4 4M118 51l-4 4') + '<circle class="gdot" cx="116" cy="53" r="1.6"/>' + lab(128, 40, 'zone dia t') + lab(24, 52, 'basic') + lab(114, 96, 'basic') + lab(128, 74, 'axis inside');
      break;
    case 'circular_runout': case 'total_runout':
      b = '<path class="gb" d="M10 60H210"/>' + part('M40 34H180V86H40Z') + (id === 'total_runout' ? '<path class="gm" d="M50 20H170"/>' + lab(52, 14, 'indicator over whole surface') : lab(70, 14, 'each circle on its own')) + '<path class="gm" d="M110 22V32"/><circle class="gm" cx="110" cy="18" r="4"/>' + dat(25, 64, 'A') + lab(70, 112, 'part turns about axis A');
      break;
    case 'concentricity':
      b = '<path class="gb" d="M10 60H210"/>' + part('M30 40H90V80H30ZM90 30H190V90H90Z') + zone('M90 53H190M90 67H190') + lab(100, 112, 'axis in dia t about A') + dat(55, 80, 'A');
      break;
    case 'symmetry':
      b = '<path class="gb" d="M10 60H210"/>' + part('M40 30H180M40 90H180') + zone('M40 54H180M40 66H180') + lab(14, 112, 'median plane in zone t, centred');
      break;
  }
  return '<svg class="gdia" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Tolerance zone sketch">' + b + '</svg>';
}

function drfDiagram() {
  // 3-2-1: three mutually perpendicular planes with contact points.
  const p = (pts, cls) => '<path class="' + cls + '" d="M' + pts.map(q => q.join(' ')).join('L') + 'Z"/>';
  const dot = (x, y) => '<circle class="gdot" cx="' + x + '" cy="' + y + '" r="3"/>';
  return '<svg class="gdia big" viewBox="0 -22 320 222" role="img" aria-label="Three-plane datum reference frame with 3-2-1 contact points">' +
    p([[40, 150], [160, 190], [300, 140], [180, 100]], 'gplane') +
    p([[40, 150], [40, 40], [180, -10], [180, 100]], 'gplane') +
    p([[180, 100], [180, -10], [300, 30], [300, 140]], 'gplane') +
    dot(110, 160) + dot(200, 158) + dot(170, 125) +
    dot(80, 90) + dot(140, 70) +
    dot(240, 70) +
    '<text class="gl" x="120" y="196">A primary: 3 points</text><text class="gl" x="6" y="30">B secondary: 2 points</text><text class="gl" x="222" y="-8">C tertiary: 1 point</text>' +
    '</svg>';
}

function envelopeDiagram() {
  return '<svg class="gdia big" viewBox="0 0 320 130" role="img" aria-label="Rule 1 envelope versus independency">' +
    '<text class="gl" x="10" y="14">Rule #1 (ASME): perfect form at MMC</text>' +
    '<path class="gz" d="M20 30H140V80H20Z"/><path class="gp" d="M20 36Q80 30 140 42M20 74Q80 80 140 70"/>' +
    '<text class="gl" x="10" y="100">bent pin must still fit the MMC envelope</text>' +
    '<text class="gl" x="170" y="14">Independency (ISO 8015)</text>' +
    '<path class="gm" d="M180 42H300M180 70H300"/><path class="gp" d="M180 46Q240 26 300 50M180 74Q240 54 300 78"/>' +
    '<text class="gl" x="170" y="100">size checked by two-point sizes only;</text><text class="gl" x="170" y="114">form needs its own tolerance</text>' +
    '</svg>';
}

function mmbDiagram() {
  return '<svg class="gdia big" viewBox="0 0 320 120" role="img" aria-label="Datum feature of size at MMB with shift">' +
    '<path class="gp" d="M30 20H150V100H30Z"/><circle class="gp" cx="90" cy="60" r="24"/><circle class="gz" cx="90" cy="60" r="18"/>' +
    '<path class="gm" d="M60 60H120M90 30V90"/>' +
    '<text class="gl" x="170" y="40">simulator pin at MMB size;</text><text class="gl" x="170" y="58">hole larger than MMB:</text><text class="gl" x="170" y="76">part may shift on the pin</text><text class="gl" x="170" y="94">(datum feature shift)</text>' +
    '</svg>';
}

// ---------- Modifiers ----------
const MODS = [
  { k: 'M', show: () => circled('M'), name: 'Maximum material condition (MMC) / boundary (MMB)', asmeIso: 'ASME Y14.5-2018; ISO 2692:2021 (maximum material requirement, MMR)',
    text: 'The tolerance applies when the feature is at its MMC size (smallest hole, largest pin). As the actual size moves towards LMC, the difference is added as bonus tolerance. Gives a fixed virtual condition boundary that a functional gauge can check. Only for features of size.', src: ['GDTB', 'SKL', 'JLC', 'UIUC'] },
  { k: 'L', show: () => circled('L'), name: 'Least material condition (LMC) / boundary (LMB)', asmeIso: 'ASME Y14.5-2018; ISO 2692:2021 (least material requirement, LMR)',
    text: 'The tolerance applies at LMC size (largest hole, smallest pin); bonus grows as the feature moves towards MMC. Used to protect a minimum wall or edge distance.', src: ['SKL', 'JLC', 'KEY'] },
  { k: 'RFS', show: () => '<span class="gtx">(none)</span>', name: 'Regardless of feature size (RFS)', asmeIso: 'Default in ASME Y14.5-2018',
    text: 'No modifier: the stated tolerance applies at any actual size and there is no bonus. Older drawings may show a circled S for RFS; current ASME practice shows no symbol (the edition that dropped it: sources differ).', src: ['GDTB', 'SKL', 'KEY'], tbv: true },
  { k: 'P', show: () => circled('P'), name: 'Projected tolerance zone', asmeIso: 'ASME and ISO',
    text: 'The zone is projected above the part for a stated height, usually where the mating part sits. Used for threaded and press-fit holes, where a tilted fixed fastener could otherwise hit the mating part.', src: ['UIUC', 'KEY', 'GDTB'] },
  { k: 'F', show: () => circled('F'), name: 'Free state', asmeIso: 'ASME and ISO',
    text: 'The tolerance applies with the part unrestrained, for non-rigid parts that deflect when clamped.', src: ['KEY', 'GDTB', 'GLS'] },
  { k: 'T', show: () => circled('T'), name: 'Tangent plane', asmeIso: 'ASME (KEYENCE lists it as ASME only)',
    text: 'The tolerance applies to the plane touching the high points of the surface, not to every point of it. Useful on mounting faces where contact matters.', src: ['KEY', 'GDTB', 'GLS'] },
  { k: 'U', show: () => circled('U'), name: 'Unequally disposed profile', asmeIso: 'ASME (U); ISO 1101:2017 uses UZ',
    text: 'Profile only. The zone is not split equally about the true profile. The frame gives the total width, then, after the U, the part of it that lies outside the material: equal values put the whole zone outside, zero puts it all inside (the reading of the second value is from one source).', src: ['GDTB', 'KEY', 'GLS'], tbv: true },
  { k: 'ST', show: () => stBox(), name: 'Statistical tolerance', asmeIso: 'ASME (KEYENCE lists it as ASME only)',
    text: 'The tolerance relies on statistical tolerancing, so the feature is expected to be made under statistical process control (to be verified: only one source read).', src: ['KEY'], tbv: true },
  { k: 'CF', show: () => '<span class="gtx">CF</span>', name: 'Continuous feature', asmeIso: 'ASME (KEYENCE lists it as ASME only)',
    text: 'Interrupted surfaces (for example a bore broken by a groove) are treated as one feature under one tolerance.', src: ['KEY', 'GDTB'] },
  { k: 'I', show: () => circled('I'), name: 'Independency', asmeIso: 'ASME only, next to a size dimension',
    text: 'Switches Rule #1 off for that feature: form is no longer limited by the size tolerance and needs its own control if it matters. Local size must still be within limits.', src: ['GDTB', 'GLS'] },
  { k: 'E', show: () => circled('E'), name: 'Envelope requirement', asmeIso: 'ISO only (ISO 14405-1), next to a size dimension or by general note',
    text: 'The ISO way to ask for a perfect-form envelope at maximum material, which ISO does not assume by default. It is the ISO counterpart of ASME Rule #1.', src: ['GDTB', 'HZ', 'KEY'] },
];

// ---------- Guide ----------
function renderGdtGuide(el) {
  const charRow = c => '<section class="gchar" id="g-' + c.id + '"><div class="gch"><span class="gbig">' + sym(c.id) + '</span><div><h3>' + gesc(c.name) + '</h3><div class="fam">' + c.cat +
    ' · datums: ' + c.datums + ' · MMC/LMC: ' + (c.mc ? 'on features of size' : 'no') +
    (c.asme ? '' : ' · <b class="gwarn">not in ASME Y14.5-2018 (ISO only)</b>') + ' ' + srcTags(c.src) + '</div></div></div>' +
    '<div class="gcg">' + zoneDiagram(c.id) + '<dl>' +
    '<dt>Tolerance zone</dt><dd>' + gesc(c.zone) + '</dd><dt>What it controls</dt><dd>' + gesc(c.controls) + '</dd>' +
    '<dt>Typical inspection</dt><dd>' + gesc(c.inspect) + '</dd><dt>Common mistakes</dt><dd>' + gesc(c.mistakes) + '</dd></dl></div></section>';
  const cats = ['Form', 'Profile', 'Orientation', 'Location', 'Runout'];
  const toc = [['g-purpose', 'Purpose'], ['g-rule1', 'Rule #1 vs ISO 8015'], ['g-datums', 'Datums'], ['g-chars', 'Characteristics'], ['g-mods', 'Modifiers'], ['g-cmp', 'ASME vs ISO'], ['g-eds', 'Editions'], ['g-srcs', 'Sources']];
  el.innerHTML =
    '<nav class="gtoc">' + toc.map(([a, t]) => '<a href="#' + a + '">' + t + '</a>').join('') + '</nav>' +
    '<p class="desc">Written for BenchMate in our own words, for ASME Y14.5-2018 and the current ISO GPS editions. Standards are cited by name, year and clause only. Each rule carries the keys of the public sources that confirm it (hover a key); anything not confirmed in two independent sources is marked <span class="gtbv">to be verified</span>. Always work to the standard and edition named on your drawing.</p>' +

    '<h2 id="g-purpose">What GD&amp;T is for</h2>' +
    '<p>Geometric dimensioning and tolerancing is the symbol language a drawing uses to say how far each feature may vary in form, orientation, location and runout, and relative to what. The "relative to what" is the datum reference frame, built from real features of the part in a stated order. ' + srcTags(['UIUC', 'GDTB']) + '</p>' +
    '<p>Plus/minus coordinate dimensions are weak for locating holes. They do not say which surfaces to measure from, or in what order, so two inspectors can get different answers. And the zone they make is a square: a hole off along the diagonal can be further from where it should be than one rejected along an axis. The round zone that just contains that square has pi/2, about 1.57 times, its area, so the same worst-case fit accepts about 57% more parts. ' + srcTags(['OWN', 'GDTB', 'WEV']) + '</p>' +

    '<h2 id="g-rule1">Rule #1 (envelope) versus the ISO independency principle</h2>' + envelopeDiagram() +
    '<p><b>ASME Y14.5-2018, Rule #1 (envelope principle).</b> Where only a size tolerance is given for a feature of size, its surfaces may not go outside a boundary of perfect form at MMC. A pin at its largest allowed size must be perfectly straight and round; form error is allowed only as the size moves towards LMC. The independency symbol next to the size switches this off for that feature. ' + srcTags(['GDTB', 'HZ', 'GLS']) + '</p>' +
    '<p><b>ISO 8015:2011, independency principle.</b> On an ISO drawing every requirement is met on its own unless the drawing links them. A size tolerance alone does not limit form; size is commonly checked as two-point local size. Form needs its own tolerance, or the envelope requirement (E) next to the size, defined in ISO 14405-1. This is the biggest practical US/ISO difference: the same drawing means something different under the other system. ' + srcTags(['HZ', 'GDTB']) + '</p>' +
    '<p>Invoking the standard: an ASME drawing names the Y14.5 edition it follows; under ISO 8015, referring to one ISO GPS standard brings in the whole GPS system. ' + srcTags(['HZ'], true) + '</p>' +

    '<h2 id="g-datums">Datums and the datum reference frame</h2>' + drfDiagram() +
    '<p><b>Terms.</b> The <i>datum feature</i> is the real, imperfect surface on the part, marked with the datum feature symbol. The <i>datum</i> is the theoretically exact plane, axis or point taken from it. The <i>datum feature simulator</i> is the physical stand-in used in manufacture and inspection: a surface plate, gauge block, gauge pin, collet, or a CMM\'s virtual equivalent. ' + srcTags(['GDTB', 'KEY', 'CNCC']) + '</p>' +
    '<p><b>3-2-1 and degrees of freedom.</b> A free part has six degrees of freedom: three translations and three rotations. For a part with three plane datum features, the primary datum feature contacts its simulator at three or more points and removes three degrees of freedom, the secondary at two or more points and removes two, and the tertiary at one or more point and removes the last. ' + srcTags(['GDTB', 'CNCC']) + '</p>' +
    '<p><b>Order of precedence.</b> The first datum letter in the feature control frame is primary, the second secondary, the third tertiary. The order is the order of set-up, not alphabetical, and changing it can change the result. ' + srcTags(['UIUC', 'CNCC', 'GDTB']) + '</p>' +
    '<p><b>Datum targets.</b> On warped or irregular surfaces the drawing can name points, lines or small areas to contact instead of the whole surface, so set-up is repeatable. ' + srcTags(['KEY', 'CNCC']) + '</p>' +
    '<p><b>Datum features of size at MMB/LMB.</b> When a hole or pin is a datum feature it can be referenced at its maximum or least material boundary (M or L after the datum letter). The simulator is then fixed at that boundary size, and if the actual datum feature departs from it the part may shift relative to the simulator. This shift is not a bonus on the feature tolerance and must not simply be added to it. ' + srcTags(['GLS', 'GDTB'], true) + mmbDiagram() + '</p>' +

    '<h2 id="g-chars">The geometric characteristics</h2>' +
    '<p class="desc">ASME Y14.5-2018 has 12 characteristic symbols; concentricity and symmetry were removed from that edition but are still in ISO 1101:2017. ' + srcTags(['MIT', 'GLS', 'KEY']) + ' The zone and datum rules below are confirmed in the sources tagged on each; inspection notes are common shop practice from the same sources, not requirements of the standards. Sketch key: <span class="gkey gkp"></span> part, <span class="gkey gkz"></span> tolerance zone, <span class="gkey gkb"></span> true profile / datum.</p>' +
    cats.map(cat => '<h3 class="gcat">' + cat + '</h3>' + CHARS.filter(c => c.cat === cat).map(charRow).join('')).join('') +

    '<h2 id="g-mods">Modifiers</h2><div class="res" style="max-width:none"><table class="gtab"><tr><th>Symbol</th><th>Name</th><th>Meaning</th><th>Standards</th></tr>' +
    MODS.map(m => '<tr><td class="gsc">' + m.show() + '</td><td><b>' + gesc(m.name) + '</b></td><td>' + gesc(m.text) + ' ' + srcTags(m.src, m.tbv) + '</td><td>' + gesc(m.asmeIso) + '</td></tr>').join('') +
    '<tr><td class="gsc">' + sym('dia') + '</td><td><b>Diameter, spherical diameter</b></td><td>The zone is a cylinder; S before the diameter symbol means a spherical zone. Not used with runout, circularity or cylindricity, whose zones are radial widths. ' + srcTags(['UIUC', 'GDTB']) + '</td><td>ASME and ISO</td></tr>' +
    '</table></div>' +

    '<h2 id="g-cmp">ASME Y14.5-2018 and ISO GPS compared</h2><div class="res" style="max-width:none"><table class="gtab"><tr><th>Topic</th><th>ASME Y14.5-2018</th><th>ISO GPS (current editions)</th></tr>' +
    [['Size and form by default', 'Rule #1: perfect form at MMC.', 'Independency principle, ISO 8015:2011. Envelope only where E is shown (ISO 14405-1).', ['HZ', 'GDTB'], false],
     ['Concentricity and symmetry', 'Removed in the 2018 edition (present in 2009). Use position, runout or profile.', 'Still in ISO 1101:2017.', ['MIT', 'GLS', 'KEY'], false],
     ['Position on a plane surface', 'Position is for features of size only; use profile for surfaces.', 'Position may also be applied to plane surfaces.', ['HZ'], true],
     ['Unequal profile zone', 'U modifier.', 'UZ.', ['KEY', 'GDTB'], false],
     ['ASME-only modifiers', 'Tangent plane, statistical, continuous feature, independency.', 'Not in ISO in the same form; ISO has CZ (common zone) and others.', ['KEY', 'GDTB'], false],
     ['Material condition', 'MMC/LMC modifiers; RFS by default.', 'MMR and LMR, ISO 2692:2021.', ['ISO', 'KEY'], false],
     ['Datums', 'Y14.5-2018 datum reference frames.', 'ISO 5459:2024. Common datum written A-A in ISO.', ['ISO', 'HZ'], true],
     ['General geometric tolerances', 'No ASME general geometric tolerance table; by drawing note or company standard (to be verified).', 'ISO 22081:2021. ISO 2768-2:1989 is withdrawn in the ISO catalogue.', ['ISO'], true],
     ['Fastener formulas', 'Nonmandatory appendix (floating and fixed fastener formulas).', 'No ISO counterpart found (to be verified).', ['GDTB', 'OEP'], true],
    ].map(([a, b, c, s, t]) => '<tr><td><b>' + a + '</b></td><td>' + b + '</td><td>' + c + ' ' + srcTags(s, t) + '</td></tr>').join('') + '</table></div>' +

    '<h2 id="g-eds">Current editions and superseded practice</h2><div class="res" style="max-width:none"><table class="gtab"><tr><th>Standard</th><th>Status (standards body catalogue, checked 2026-11-10)</th><th>Superseded practice to watch for</th></tr>' +
    [['ASME Y14.5-2018', 'Current, reaffirmed 2024 (R2024), on stabilized maintenance. Replaces Y14.5-2009.', 'Concentricity and symmetry (2009 and earlier). Circled S for RFS on old drawings.'],
     ['ISO 1101:2017', 'Current, edition 4, last reviewed and confirmed 2022.', 'Older ISO 1101 editions.'],
     ['ISO 5459:2024', 'Listed as the current edition in the ISO catalogue (detail page could not be loaded); ISO 5459:2011 is withdrawn.', 'Datum rules from ISO 5459:2011.'],
     ['ISO 2692:2021', 'Current, edition 4 (under systematic review).', 'ISO 2692:2014 and earlier.'],
     ['ISO 8015:2011', 'Current, edition 2, last reviewed and confirmed 2021.', 'ISO 8015:1985.'],
     ['ISO 22081:2021', 'Current, edition 1, last reviewed and confirmed 2026.', 'ISO 2768-2:1989 (general geometrical tolerances), withdrawn. Many drawings still quote it: read it as the drawing says, but do not use it for new drawings to ISO.'],
    ].map(([a, b, c]) => '<tr><td><b>' + a + '</b></td><td>' + b + ' ' + srcTags(['ISO', 'ASME'].filter(k => (a.startsWith('ASME') ? k === 'ASME' : k === 'ISO'))) + '</td><td>' + c + '</td></tr>').join('') + '</table></div>' +

    '<h2 id="g-srcs">Sources</h2><ul class="gsl">' + Object.entries(GDT_SOURCES).map(([k, v]) => '<li><b>' + k + '</b> ' + gesc(v) + '</li>').join('') + '</ul>' +
    '<p class="desc">Full URLs, access dates and the per-statement checks are in docs/gdt.md. No text, figures or tables from the ASME or ISO standards or from published handbooks were copied.</p>';
  el.querySelectorAll('.gtoc a').forEach(a => a.onclick = e => { e.preventDefault(); const t = el.querySelector(a.getAttribute('href')); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
}

// ---------- Feature control frame builder ----------
const FCF_STATE = { std: 'asme', ch: 'position', fos: 1, zone: 'dia', val: '0.25', mc: 'M', p: false, ph: '', f: false, t: false, u: false, uv: '', st: false, cf: false, d: [['A', ''], ['B', ''], ['C', '']] };

function fcfCheck(s) {
  const c = CHAR[s.ch], out = [];
  const err = (m, k, tbv) => out.push({ lvl: 'err', m, k, tbv }), warn = (m, k, tbv) => out.push({ lvl: 'warn', m, k, tbv });
  const ds = s.d.filter(x => x[0]);
  const v = parseFloat(s.val);
  if (!(v > 0)) err('Enter a tolerance value greater than zero.');
  if (!c.asme && s.std === 'asme') err(c.name + ' is not in ASME Y14.5-2018 (removed from the 2009 set). Use position, runout or profile, or mark the drawing to ISO.', ['MIT', 'GLS']);
  if (c.datums === 'never' && ds.length) err('Form tolerances (' + c.name.toLowerCase() + ') never take datum references.', ['GLS', 'GDTB']);
  if (c.datums === 'required' && !ds.length) {
    if (s.ch === 'position') warn('Position normally needs datum references. The GLS chart lists coaxial holes as the exception.', ['GLS', 'GDTB'], true);
    else err(c.cat + ' tolerances need at least one datum reference.', ['GLS', 'GDTB']);
  }
  // datum letters: contiguous, unique, not I/O/Q
  const letters = s.d.map(x => x[0]);
  if (letters[1] && !letters[0] || letters[2] && !letters[1]) err('Fill the datum cells in order: primary, then secondary, then tertiary.');
  const seen = {};
  ds.forEach(([l]) => { if (seen[l]) err('Datum ' + l + ' is used twice.'); seen[l] = 1; });
  ds.forEach(([l]) => { if (/^[IOQ]$/.test(l)) warn('Datum letters I, O and Q are commonly avoided because they look like 1 and 0.', [], true); });
  if (ds.some(x => x[1])) warn('MMB/LMB after a datum letter only means something if that datum feature is a feature of size (hole, pin, slot, tab).', ['GLS', 'GDTB']);
  if (s.mc && !s.fos) err('MMC and LMC apply only to features of size (axis or median plane), not to a plain surface.', ['GDTB', 'GLS', 'KEY']);
  if (s.mc && s.ch.startsWith('profile')) warn('Material condition on profile: sources differ (GD&T Basics says not applicable; Skill-Lync notes a Y14.5-2018 use). Check the standard before using it.', ['GDTB', 'SKL'], true);
  else if (s.mc && !c.mc) err(c.name + ' cannot take MMC or LMC' + (c.cat === 'Runout' ? ': runout is always regardless of feature size.' : '.'), ['GLS', 'GDTB']);
  if (s.fos && !c.fos) err(c.name + ' applies to surfaces, not to a derived axis or median plane.', ['GLS']);
  if (s.zone === 'dia' && !c.dia) err('A diameter zone does not apply to ' + c.name.toLowerCase() + '; its zone is a width between lines, planes, circles or cylinders.', ['UIUC', 'GDTB']);
  if ((s.zone === 'dia' || s.zone === 'sdia') && !s.fos) err('A diameter (cylindrical or spherical) zone needs an axis or centre point, so the toleranced feature must be a feature of size.', ['UIUC', 'GDTB']);
  if (s.zone === 'sdia' && s.ch !== 'position') warn('A spherical diameter zone is normally used to locate a sphere centre with position.', ['GDTB'], true);
  if (s.ch === 'position' && !s.fos) err('In ASME Y14.5 position locates features of size only. Locate a plain surface with profile of a surface. (ISO allows position on planes.)', ['HZ', 'GDTB']);
  if (s.fos && s.zone === 'width' && ['position', 'straightness', 'perpendicularity', 'parallelism', 'angularity'].includes(s.ch)) warn('With no diameter symbol the zone is two parallel planes: right for a slot or tab (median plane), wrong if you meant a hole or pin axis.', ['GDTB', 'KEY']);
  if (s.u && !s.ch.startsWith('profile')) err('The unequal (U) modifier is used only with profile tolerances.', ['GDTB', 'KEY']);
  if (s.u && !(parseFloat(s.uv) >= 0 && parseFloat(s.uv) <= v)) err('Unequal profile: the offset must be between 0 and the total tolerance.');
  if (s.p && !['position', 'perpendicularity', 'parallelism', 'angularity'].includes(s.ch)) warn('A projected tolerance zone is normally used with position (and orientation) of threaded or press-fit holes.', ['GDTB', 'UIUC'], true);
  if (s.p && !s.fos) err('A projected tolerance zone projects the axis of a hole or pin, so it needs a feature of size.', ['GDTB', 'UIUC'], true);
  if (s.p && !(parseFloat(s.ph) > 0)) warn('Give the projection height (usually where the mating part sits).', ['GDTB', 'UIUC']);
  if (s.t && c.cat !== 'Orientation') warn('The tangent plane modifier is normally used with orientation tolerances on a surface.', ['KEY', 'GDTB'], true);
  if (s.t && s.fos) err('Tangent plane applies to a surface, not to an axis or median plane.', ['KEY', 'GDTB']);
  if (s.st) warn('Statistical tolerance: the drawing is expected to state the statistical process control requirement in a note.', ['KEY'], true);
  if (s.ch === 'flatness' && s.mc && s.fos) warn('Flatness (or straightness) on a feature of size controls the derived median plane (or line) and overrides Rule #1; at MMC its boundary is the virtual condition.', ['GDTB', 'HZ']);
  return out;
}

function fcfHtml(s) {
  const c = CHAR[s.ch];
  let tol = '';
  if (s.zone === 'dia') tol += sym('dia', 'in');
  if (s.zone === 'sdia') tol += '<span class="gtx">S</span>' + sym('dia', 'in');
  tol += '<span class="gtx">' + gesc(s.val || '?') + '</span>';
  if (s.u) tol += circled('U') + '<span class="gtx">' + gesc(s.uv || '?') + '</span>';
  if (s.mc) tol += circled(s.mc);
  if (s.p) tol += circled('P') + (s.ph ? '<span class="gtx">' + gesc(s.ph) + '</span>' : '');
  if (s.f) tol += circled('F');
  if (s.t) tol += circled('T');
  if (s.st) tol += stBox();
  const cells = ['<span class="fc fs">' + sym(c.id) + '</span>', '<span class="fc">' + tol + '</span>'];
  s.d.filter(x => x[0]).forEach(([l, m]) => cells.push('<span class="fc"><span class="gtx">' + gesc(l) + '</span>' + (m ? circled(m) : '') + '</span>'));
  return (s.cf ? '<div class="gtx gcf">CF</div>' : '') + '<div class="fcf">' + cells.join('') + '</div>';
}

function fcfExplain(s) {
  const c = CHAR[s.ch], ds = s.d.filter(x => x[0]);
  const v = s.val || '?';
  const what = s.fos ? (s.zone === 'width' ? 'The derived median plane of the feature' : 'The axis (derived median line) of the feature') : 'Every point of the surface';
  let zone;
  if (s.zone === 'dia') zone = 'a cylindrical zone ' + v + ' in diameter';
  else if (s.zone === 'sdia') zone = 'a spherical zone ' + v + ' in diameter';
  else if (s.ch === 'circularity') zone = 'two concentric circles ' + v + ' apart (radially) in each cross-section';
  else if (s.ch === 'cylindricity') zone = 'two coaxial cylinders ' + v + ' apart (radially)';
  else if (s.ch.startsWith('profile')) zone = 'a zone ' + v + ' wide around the true profile' + (s.u ? ', unequally disposed (' + (s.uv || '?') + ' of it on the side named by the U modifier convention)' : ', split equally each side');
  else if (s.ch.endsWith('runout')) zone = 'a full indicator movement of ' + v;
  else zone = 'two parallel ' + (s.ch === 'straightness' && !s.fos ? 'lines' : 'planes') + ' ' + v + ' apart';
  const rel = {
    straightness: '', flatness: '', circularity: '', cylindricity: '',
    profile_line: ds.length ? ', positioned and oriented by the basic dimensions from the datums' : ', with no datums, so it controls form (shape) only',
    profile_surface: ds.length ? ', positioned and oriented by the basic dimensions from the datums' : ', with no datums, so it controls form (shape) only',
    perpendicularity: ', at 90 degrees to the datum', parallelism: ', parallel to the datum', angularity: ', at the basic angle to the datum',
    position: ', centred on the true position set by basic dimensions from the datums',
    circular_runout: ' at each circular element while the part turns about the datum axis',
    total_runout: ' over the whole surface while the part turns about the datum axis',
    concentricity: ', centred on the datum axis', symmetry: ', centred on the datum centre plane',
  }[s.ch];
  const verb = s.ch.endsWith('runout') ? 'must show no more than ' : 'must lie within ';
  let t = '<p>' + what + ' ' + verb + zone + rel + '.</p>';
  if (ds.length) t += '<p>Datum reference frame: ' + ds.map(([l, m], i) => '<b>' + gesc(l) + '</b> ' + ['primary', 'secondary', 'tertiary'][i] + (m === 'M' ? ' (at MMB: the part may shift if the datum feature departs from its MMB)' : m === 'L' ? ' (at LMB)' : '')).join(', ') + '. Set the part up on them in this order, not in alphabetical order.</p>';
  if (s.mc === 'M') t += '<p>At MMC: the ' + v + ' applies when the feature is at its maximum material size. Every bit the actual size moves towards LMC is added as bonus tolerance. A functional gauge at the virtual condition can check it.</p>';
  if (s.mc === 'L') t += '<p>At LMC: the ' + v + ' applies at the least material size; bonus grows as the feature moves towards MMC. Typically protects a minimum wall.</p>';
  if (!s.mc && s.fos && c.mc) t += '<p>No material condition modifier: the tolerance applies at any actual size (RFS), with no bonus.</p>';
  if (s.p) t += '<p>Projected: the zone extends ' + (s.ph ? gesc(s.ph) + ' ' : '') + 'above the part, where the mating part sits.</p>';
  if (s.f) t += '<p>Free state: checked with the part unrestrained.</p>';
  if (s.t) t += '<p>Tangent plane: only the plane touching the high points must lie in the zone.</p>';
  if (s.cf) t += '<p>CF: the interrupted features are treated as one continuous feature.</p>';
  if (s.st) t += '<p>Statistical: the tolerance relies on statistical process control.</p>';
  return t;
}

function renderFcfBuilder(el) {
  const s = FCF_STATE;
  const opt = (arr, cur) => arr.map(([v, t]) => '<option value="' + v + '"' + (String(v) === String(cur) ? ' selected' : '') + '>' + t + '</option>').join('');
  const letters = [['', '-']].concat('ABCDEFGHJKLMNPRSTUVWXYZ'.split('').map(x => [x, x]));
  el.innerHTML = '<div class="grid">' +
    '<label class="f"><span>Standard</span><div class="row"><select data-k="std">' + opt([['asme', 'ASME Y14.5-2018'], ['iso', 'ISO 1101:2017']], s.std) + '</select></div></label>' +
    '<label class="f"><span>Characteristic</span><div class="row"><select data-k="ch">' + ['Form', 'Profile', 'Orientation', 'Location', 'Runout'].map(cat => '<optgroup label="' + cat + '">' + opt(CHARS.filter(c => c.cat === cat).map(c => [c.id, c.name + (c.asme ? '' : ' (ISO only)')]), s.ch) + '</optgroup>').join('') + '</select></div></label>' +
    '<label class="f"><span>Applied to</span><div class="row"><select data-k="fos">' + opt([[0, 'Surface'], [1, 'Feature of size (axis / mid-plane)']], s.fos) + '</select></div></label>' +
    '<label class="f"><span>Zone shape</span><div class="row"><select data-k="zone">' + opt([['width', 'Width (no symbol)'], ['dia', 'Diameter'], ['sdia', 'Spherical diameter']], s.zone) + '</select></div></label>' +
    '<label class="f"><span>Tolerance value</span><div class="row"><input data-k="val" type="text" inputmode="decimal" value="' + gesc(s.val) + '"></div></label>' +
    '<label class="f"><span>Material condition</span><div class="row"><select data-k="mc">' + opt([['', 'None (RFS)'], ['M', 'MMC (M)'], ['L', 'LMC (L)']], s.mc) + '</select></div></label>' +
    [0, 1, 2].map(i => '<label class="f"><span>' + ['Primary', 'Secondary', 'Tertiary'][i] + ' datum</span><div class="row"><select data-dl="' + i + '">' + opt(letters, s.d[i][0]) + '</select><select data-dm="' + i + '">' + opt([['', 'RMB'], ['M', 'MMB'], ['L', 'LMB']], s.d[i][1]) + '</select></div></label>').join('') +
    '</div><div class="mfilter gmods">' +
    [['p', 'Projected (P)'], ['f', 'Free state (F)'], ['t', 'Tangent plane (T)'], ['u', 'Unequal profile (U)'], ['st', 'Statistical (ST)'], ['cf', 'Continuous feature (CF)']].map(([k, t]) => '<label class="chk"><input type="checkbox" data-k="' + k + '"' + (s[k] ? ' checked' : '') + '>' + t + '</label>').join('') +
    '<label class="chk">Projection height <input data-k="ph" type="text" inputmode="decimal" style="width:70px" value="' + gesc(s.ph) + '"></label>' +
    '<label class="chk">Unequal offset <input data-k="uv" type="text" inputmode="decimal" style="width:70px" value="' + gesc(s.uv) + '"></label>' +
    '</div><div class="res" style="max-width:none"><div class="h">Frame</div><div class="gframe" id="fcfout"></div></div>' +
    '<div class="res" style="max-width:none;margin-top:12px"><div class="h">Checks</div><div id="fcfchk"></div></div>' +
    '<div class="res" style="max-width:none;margin-top:12px"><div class="h">In plain English</div><div class="gexp" id="fcfexp"></div></div>';
  const draw = () => {
    el.querySelector('#fcfout').innerHTML = fcfHtml(s);
    const chk = fcfCheck(s);
    el.querySelector('#fcfchk').innerHTML = '<table>' + (chk.length ? chk.map(x => '<tr class="' + (x.lvl === 'err' ? 'over' : '') + '"><td style="width:70px" class="' + (x.lvl === 'err' ? 'gerr' : 'warn') + '">' + (x.lvl === 'err' ? 'Invalid' : 'Note') + '</td><td>' + gesc(x.m) + ' ' + srcTags(x.k || [], x.tbv) + '</td></tr>').join('') : '<tr><td class="gok">No problems found by the checks BenchMate knows. This is not a full standards review.</td></tr>') + '</table>';
    el.querySelector('#fcfexp').innerHTML = chk.some(x => x.lvl === 'err') ? '<p class="warn">Fix the invalid items first; an invalid frame has no defined meaning.</p>' + fcfExplain(s) : fcfExplain(s);
  };
  el.querySelectorAll('[data-k]').forEach(i => {
    i.oninput = i.onchange = () => {
      const k = i.dataset.k;
      s[k] = i.type === 'checkbox' ? i.checked : (k === 'fos' ? +i.value : i.value);
      if (k === 'ch') { // sensible defaults when the characteristic changes
        const c = CHAR[s.ch];
        if (!c.mc) s.mc = '';
        if (!c.dia && s.zone !== 'width') s.zone = 'width';
        if (!c.fos) s.fos = 0;
        if (c.datums === 'never') s.d = [['', ''], ['', ''], ['', '']];
        else if (!s.d[0][0]) s.d = [['A', ''], ['', ''], ['', '']];
        renderFcfBuilder(el); return;
      }
      draw();
    };
  });
  el.querySelectorAll('[data-dl]').forEach(i => i.onchange = () => { s.d[+i.dataset.dl][0] = i.value; draw(); });
  el.querySelectorAll('[data-dm]').forEach(i => i.onchange = () => { s.d[+i.dataset.dm][1] = i.value; draw(); });
  draw();
}

// ---------- Tolerance stack (1D, worst case and RSS) ----------
const STACK_STATE = { rows: [[50, 0.1, 0.1, 1], [30, 0.05, 0.15, -1], [19.5, 0.05, 0.05, -1]] };
function renderStack(el) {
  const s = STACK_STATE, W = state.W, u = lenU(state.sys);
  const draw = () => {
    el.innerHTML = '<div class="res" style="max-width:820px"><table class="gtab"><tr><th>#</th><th>Direction</th><th>Nominal (' + u + ')</th><th>+ tolerance</th><th>- tolerance</th><th></th></tr>' +
      s.rows.map((r, i) => '<tr><td>' + (i + 1) + '</td><td><select data-i="' + i + '" data-j="3"><option value="1"' + (r[3] > 0 ? ' selected' : '') + '>+ adds to gap</option><option value="-1"' + (r[3] < 0 ? ' selected' : '') + '>- subtracts</option></select></td>' +
        [0, 1, 2].map(j => '<td><input type="number" step="any" inputmode="decimal" data-i="' + i + '" data-j="' + j + '" value="' + r[j] + '" style="width:110px;font-family:var(--mono)"></td>').join('') +
        '<td><button class="btn" data-del="' + i + '">Remove</button></td></tr>').join('') + '</table></div>' +
      '<div class="mfilter" style="margin-top:8px"><button class="btn" id="sadd"' + (s.rows.length >= 10 ? ' disabled' : '') + '>Add dimension</button><span class="desc" style="margin:0">Up to 10 dimensions. Enter both tolerances as positive numbers.</span></div>' +
      '<div class="res" id="sres" style="margin-top:12px"></div>';
    el.querySelectorAll('[data-i]').forEach(inp => inp.oninput = inp.onchange = () => { const v = parseFloat(inp.value); s.rows[+inp.dataset.i][+inp.dataset.j] = isNaN(v) ? '' : v; calc(); });
    el.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { s.rows.splice(+b.dataset.del, 1); draw(); });
    el.querySelector('#sadd').onclick = () => { s.rows.push([0, 0, 0, 1]); draw(); };
    calc();
  };
  const calc = () => {
    const a = [];
    for (let i = 0; i < 10; i++) { const r = s.rows[i]; if (r) a.push(+r[0] || 0, +r[1] || 0, +r[2] || 0, +r[3] || 1); else a.push(0, 0, 0, 1); }
    const o = k => W.gdt_stack(...a, k), dp = state.sys === 'inch' ? 4 : 3, f = x => fmt(x, dp);
    const rows = [['Gap at nominal', o(0)], ['Gap at mean (centre of each tolerance)', o(1)], ['Worst case: plus/minus', o(2)], ['Worst case: minimum gap', o(4)], ['Worst case: maximum gap', o(5)], ['RSS: plus/minus', o(3)], ['RSS: minimum gap', o(6)], ['RSS: maximum gap', o(7)]];
    el.querySelector('#sres').innerHTML = '<div class="h">Results (' + o(8) + ' dimensions)</div><table>' + rows.map(([l, v]) => '<tr' + ((l.includes('minimum') && v < 0) ? ' class="over"' : '') + '><td>' + l + (l.includes('minimum') && v < 0 ? '<div class="wmsg">Negative: interference is possible</div>' : '') + '</td><td class="v">' + f(v) + '</td><td class="u">' + u + '</td></tr>').join('') + '</table>';
  };
  draw();
}
