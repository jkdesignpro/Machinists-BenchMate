// Tool materials and coatings for the advisors (0.8.0). What each one suits and what it should not be used on,
// in our own words, from the public sources below (the same keys as in the Tooling guide and
// data/refdata/tooling-evidence.json). Nothing here changes a speed or a feed: the advisors' tables are for
// carbide and HSS tools, and the maker's chart for the tool in your hand comes first.
// A statement with fewer than two independent publishers is marked "to be verified" (guideTags).
'use strict';

const TC_SOURCES = {
  HARTNER: 'Hartner GmbH, coatings sheet (HARTNER_Beschichtungen_EN, a drill and tool maker)',
  BALZERS: 'Oerlikon Balzers, "Cutting tools" coating overview HQ189EN (2509) (a coating maker)',
  PRODINC: 'Productivity Inc (S. Hudis), "Selecting the right end mill for your machining set up", 2026-04-21',
  PMPA_CT: 'D. Wynn (PMPA), Production Machining, "The power of the coating", 2024-12-30',
  AIMS_CT: 'AIMS Industrial Supplies, "Cutting tool coatings guide", 2026-09-29 (a tool seller; typical values)',
  AIMS_TM: 'AIMS Industrial Supplies, "Cutting tool materials guide", 2026-09-29 (a tool seller)',
  NTK_TM: 'NTK Cutting Tools, tool materials and selection guide, pages C1 to C58 (an insert maker; 2024)',
  KMT_GR: 'Kennametal, "Metalcutting grades" selection pages (a tool maker; hosted by MSC Industrial Supply, undated)',
  MMC_TM: 'Mitsubishi Materials, "Cutting tool materials" (a tool maker; property table)',
  GWS: 'GWS Tool Group, "Tool coatings" (a tool maker)',
  BRYCOAT: 'Brycoat, "PVD coating properties" (a coating service)',
  IJS: 'Jozef Stefan Institute, Department of thin films, "Coating types"',
  WIDIA_MC: 'R. Iyer (WIDIA), Modern Machine Shop, "A new milling 101: selecting tool materials and coatings", 2011, updated 2025-03-10',
};
// AIMS_CT and AIMS_TM are one publisher; so are the two Oerlikon documents.
const TC_FAMILY = { AIMS_CT: 'AIMS', AIMS_TM: 'AIMS' };
const tcTags = keys => guideTags(keys, TC_SOURCES, TC_FAMILY);

// Tool materials: the advisors' value, the name, and whether the built-in speed tables cover it.
const TOOLMAT_OPTIONS = [[1, 'Carbide'], [2, 'High speed steel (HSS)'], [3, 'Cermet'], [4, 'Ceramic'], [5, 'CBN (cubic boron nitride)'], [6, 'PCD (polycrystalline diamond)']];
const toolMatTabled = tm => tm === 1 || tm === 2;

// Coatings, the common ones first. [value, name, common, max temperature as printed [[°C text, key], ...]]
const COATINGS = [
  [0, 'Not chosen', 1, []],
  [1, 'Uncoated (bright)', 1, []],
  [2, 'TiN, titanium nitride (gold)', 1, [['600', 'BALZERS'], ['under 600', 'HARTNER'], ['600', 'BRYCOAT'], ['about 600', 'AIMS_CT'], ['500', 'GWS'], ['500', 'IJS'], ['about 1000 °F', 'PMPA_CT']]],
  [3, 'TiCN, titanium carbonitride (blue-grey)', 1, [['400', 'BALZERS'], ['400', 'BRYCOAT'], ['about 400', 'AIMS_CT'], ['under 450', 'HARTNER']]],
  [4, 'TiAlN, titanium aluminium nitride (violet-grey)', 1, [['under 800', 'HARTNER'], ['800', 'BRYCOAT'], ['900', 'IJS'], ['about 900', 'AIMS_CT'], ['1100 (TiAlN-based grade)', 'BALZERS']]],
  [5, 'AlTiN, aluminium titanium nitride (grey to black)', 1, [['800', 'GWS'], ['800', 'BRYCOAT'], ['under 900', 'HARTNER'], ['1000 (AlTiN-based grade)', 'BALZERS'], ['1100 (AlTiN/TiN nano-layer)', 'IJS'], ['about 1400 °F', 'PMPA_CT']]],
  [6, 'AlCrN, aluminium chromium nitride (grey)', 1, [['1100 (AlCrN-based grade)', 'BALZERS'], ['about 1100', 'AIMS_CT']]],
  [7, 'ZrN, zirconium nitride (pale gold)', 1, [['under 700', 'HARTNER'], ['600', 'BRYCOAT']]],
  [8, 'DLC, diamond-like carbon (black)', 1, [['under 500', 'HARTNER'], ['over 500 (ta-C grade)', 'BALZERS'], ['about 750 °F', 'PMPA_CT']]],
  [9, 'Diamond, CVD film (grey-black)', 1, [['600', 'BALZERS'], ['under 600', 'HARTNER'], ['about 600', 'AIMS_CT']]],
  [10, 'CVD multilayer on inserts (TiCN, Al2O3, TiN)', 0, []],
  [11, 'TiSiN or AlTiSiN nanocomposite (bronze to copper)', 0, [['under 800 (TiSiN, TiAlSiN)', 'HARTNER'], ['1000 to 1100 (AlTiN/TiSiN grades)', 'BALZERS']]],
  [12, 'TiB2, titanium diboride (grey-white)', 0, [['about 900 °F', 'PMPA_CT']]],
  [13, 'CrN, chromium nitride (silver-grey)', 0, [['700', 'BRYCOAT'], ['about 700', 'AIMS_CT'], ['750', 'IJS']]],
  [14, 'MoS2 lubricating layer (grey)', 0, [['under 800', 'HARTNER']]],
  [15, 'Steam oxide (blue-black surface treatment)', 0, []],
];
const COAT_OPTIONS = COATINGS.map(c => [c[0], c[1]]);
const COAT_COMMON = COATINGS.filter(c => c[2]).map(c => c[0]);

// Work material groups from the advisors' list (ADV_MATS ids).
const TC_GROUP = id => ({
  al: [15, 16].includes(id), nonfe: [13, 14, 15, 16].includes(id), plastic: id === 19,
  ferrous: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 20, 21, 22].includes(id), ci: id === 12, hard: id === 6,
  ss: [9, 10, 11].includes(id), ti: id === 17, ni: id === 18,
});

// [band, text, keys]: band is good, caution, over (do not) or '' (a plain note).
function toolMatFit(tm, matId) {
  const g = TC_GROUP(matId), out = [];
  if (tm === 3) {
    out.push([g.ferrous && !g.ci ? 'good' : '', 'Cermet is for steels and stainless steels, at higher speed for semi-finishing and finishing, with a very good finish.', ['KMT_GR', 'AIMS_TM']]);
    out.push(['caution', 'It is less suited than carbide to heavy roughing.', ['KMT_GR', 'AIMS_TM']]);
  } else if (tm === 4) {
    out.push([g.ci || g.ni || g.hard ? 'good' : '', 'Ceramics are for cast iron, heat-resistant nickel alloys and hardened steel, where a high speed can be used.', ['NTK_TM', 'KMT_GR']]);
  } else if (tm === 5) {
    out.push([g.hard || g.ci ? 'good' : '', 'CBN is for hardened steel and cast iron.', ['NTK_TM', 'KMT_GR', 'AIMS_TM']]);
    if (g.nonfe || g.plastic) out.push(['caution', 'One seller says CBN gains nothing over carbide on non-ferrous metals.', ['AIMS_TM']]);
  } else if (tm === 6) {
    if (g.ferrous) out.push(['over', 'PCD is not for steel or cast iron: diamond reacts with iron at cutting heat. Use carbide, cermet, ceramic or CBN.', ['KMT_GR', 'AIMS_TM', 'MMC_TM']]);
    else out.push([g.nonfe || g.plastic ? 'good' : '', 'PCD is for aluminium, copper alloys and other non-ferrous metals, plastics and composites, at very high speed.', ['NTK_TM', 'KMT_GR', 'AIMS_TM']]);
    out.push(['', 'PCD tools need a rigid machine and rigid workholding.', ['KMT_GR']]);
  }
  if (!toolMatTabled(tm)) out.push(['', 'No speed table for this tool material is built in: type the maker\'s cutting speed for the grade, and for milling its chip load (Advanced, "Your own").', []]);
  return out;
}
function coatFit(coat, matId) {
  const g = TC_GROUP(matId), out = [];
  if (coat === 1) out.push([g.nonfe ? 'good' : '', 'Bright, uncoated carbide suits non-ferrous metals and short runs.', ['KMT_GR', 'AIMS_CT']]);
  if (coat === 2) out.push(['', 'TiN is the general purpose coating.', ['HARTNER', 'PMPA_CT', 'AIMS_CT']]);
  if (coat === 3) out.push(['', 'TiCN suits edges under high load and interrupted cuts, with a lower heat limit than TiN.', ['HARTNER', 'BALZERS', 'AIMS_CT']]);
  if (coat === 4 || coat === 5) {
    if (g.al) out.push(['caution', 'Aluminium-bearing coatings (TiAlN, AlTiN) are not advised for aluminium: aluminium sticks to the coating. Use DLC, ZrN or bright carbide.', ['PRODINC', 'HARTNER', 'PMPA_CT']]);
    else if (coat === 5 && (g.hard || g.ti || g.ni || g.ss)) out.push(['good', 'AlTiN suits hardened steel, stainless, titanium and nickel alloys.', ['HARTNER', 'PRODINC']]);
    else if (coat === 4 && (g.ferrous || g.ti)) out.push(['good', 'TiAlN suits steels, stainless, cast iron and titanium, and dry or near-dry cutting at high speed.', ['HARTNER', 'PRODINC', 'AIMS_CT']]);
  }
  if (coat === 6) {
    if (g.al) out.push(['caution', 'The sources differ: one end mill guide says to avoid aluminium-bearing coatings for aluminium; one tool seller lists AlCrN for aluminium.', ['PRODINC', 'AIMS_CT']]);
    else out.push([g.hard || g.ferrous ? 'good' : '', 'AlCrN is for very hot cutting: steels, hardened steels, dry cutting.', ['BALZERS', 'AIMS_CT']]);
  }
  if (coat === 7) out.push([g.nonfe ? 'good' : '', 'ZrN is for aluminium, titanium and other non-ferrous work.', ['HARTNER', 'PRODINC']]);
  if (coat === 8) out.push([g.nonfe || g.plastic ? 'good' : '', 'DLC is for aluminium and other non-ferrous metals, against built-up edge.', ['HARTNER', 'PMPA_CT', 'BALZERS']]);
  if (coat === 9) {
    if (g.ferrous) out.push(['over', 'Diamond is never for steel or cast iron: carbon dissolves into iron when hot.', ['HARTNER', 'BALZERS', 'AIMS_CT']]);
    else out.push([g.al || g.plastic ? 'good' : '', 'Diamond film is for graphite, fibre-reinforced plastics and high-silicon aluminium.', ['HARTNER', 'AIMS_CT']]);
  }
  if (coat === 10) out.push([g.ferrous ? 'good' : '', 'Thick CVD layers on inserts (TiCN for wear, aluminium oxide against heat) are for most steel and cast iron cutting; they need a honed edge and a heavier chip.', ['KMT_GR', 'WIDIA_MC']]);
  if (coat === 11) out.push([g.hard || g.ss || g.ni || g.ti ? 'good' : '', 'Silicon-bearing nanocomposite coatings are named for hardened and high-tensile steels (TiAlSiN) and for stainless, nickel and titanium alloys (AlTiN/TiSiN grades).', ['HARTNER', 'BALZERS']]);
  if (coat === 12) out.push([g.nonfe ? 'good' : '', 'TiB2 is named for non-ferrous metals.', ['PMPA_CT']]);
  if (coat === 13) out.push([g.nonfe ? 'good' : '', 'CrN is for non-ferrous metals (one seller names copper, nickel and Monel) and for forming and moulding tools.', ['BRYCOAT', 'IJS', 'AIMS_CT']]);
  if (coat === 14) out.push(['', 'A soft lubricating layer for dry or minimum-lubrication cutting and against galling.', ['HARTNER']]);
  if (coat === 15) out.push(['', 'Steam oxide is a surface treatment, not a hard coating; named for low carbon steel against chip build-up.', ['AIMS_CT']]);
  const c = COATINGS.find(x => x[0] === coat);
  if (c && c[3].length) out.push(['', 'Highest working temperature as each source prints it, °C unless marked: ' + c[3].map(([t, k]) => t + ' <abbr class="gsrc" title="' + gesc(TC_SOURCES[k] || k) + '">' + k + '</abbr>').join('; ') + '. Brands differ, so read it as a rough guide, and keep the cut below it: coolant and speed decide the heat.', c[3].map(x => x[1])]);
  return out;
}
// The card under the advisor's headline: one line per finding, worst first.
function toolMatCard(tm, coat, matId) {
  const rows = toolMatFit(tm, matId).concat(coatFit(coat, matId));
  if (!rows.length) return '';
  const rank = { over: 0, caution: 1, good: 2, '': 3 };
  rows.sort((a, b) => rank[a[0]] - rank[b[0]]);
  const name = (TOOLMAT_OPTIONS.find(o => o[0] === tm) || ['', ''])[1] + (coat > 0 ? ', ' + (COATINGS.find(x => x[0] === coat) || ['', ''])[1].split(',')[0].replace(/ \(.*\)$/, '') : '');
  return '<div class="tmcard"><div class="tmh">Tool material and coating: ' + hesc(name) + '</div>' +
    rows.map(([b, t, k]) => '<div class="tmrow' + (b ? ' ' + b : '') + '">' + t + (k.length ? ' ' + tcTags(k) : '') + '</div>').join('') +
    '<div class="tmrow note">A coating does not change the speeds and feeds worked out here. The maker\'s chart for the coated tool comes first.</div></div>';
}
