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
  HARVEY: 'Harvey Tool (Harvey Performance Company), "Tool coatings" resource page, harveytool.com/resources/tool-coatings, read 2026-11-13 (a tool maker)',
  UNIMERCO: 'Kyocera Unimerco, "Coating types, end mills" (HPMT and Fraisa coatings), imageservice.kyocera-unimerco.com, read 2026-11-13 (a tool maker and seller)',
  PLATIT: 'PLATIT AG, nACRo coating sheet (Compendium p. 65), platit.com, read 2026-11-13 (a coating equipment maker)',
  MMC_EM: 'Mitsubishi Materials, "Solid end mills: coating technology", mmc-carbide.com, read 2026-11-13 (a tool maker)',
  PAULIMOT: 'Paulimot GmbH, guidebook "Milling cutter coatings", paulimot.de, read 2026-11-13 (a tool seller)',
  CUTWEL_AL: 'Cutwel, "A aluminium milling cutters" range page, cutwel.co.uk, read 2026-11-13 (a tool seller)',
  KYO_TP: 'Kyocera, turning parameters for negative inserts, catalogue pages D46 and D47 (as hosted by a tool seller), read 2026-11-13 (an insert maker)',
  KYO_CP: 'Kyocera, CBN and PCD recommended cutting conditions, catalogue pages C3 and C29 (as hosted by a tool seller), read 2026-11-13 (an insert maker)',
  KYO_TN60: 'Kyocera Precision Tools, cermet grade TN60 page, kyoceraprecisiontools.com, read 2026-11-13 (an insert maker)',
  CUTWEL_CM: 'Cutwel, "Cermet turning inserts" sheet, cutwel.co.uk, read 2026-11-13 (a tool seller)',
  TUNG_HT: 'Tungaloy, "Feed the speed! Hard turning series", Oct. 2020 (an insert maker)',
  CTE_HT: 'K. Hanson, Cutting Tool Engineering, "Turning hardened materials presents challenges, opportunities", 2016-12-01 (quotes Seco Tools and Greenleaf)',
  SME_CER: 'E. Sinkora, SME Media, "Pushing the limits with ceramics", 2023 (quotes Iscar and Greenleaf)',
  MMC_PCD: 'Mitsubishi Materials, "Sintered diamond PCD grade MD220" recommended turning conditions, mitsubishicarbide.net, read 2026-11-13 (a tool maker)',
};
// Where each source added on 2026-11-13 was read (the older keys have their URLs in tooling-evidence.json).
const TC_URLS = {
  HARVEY: 'https://harveytool.com/resources/tool-coatings',
  UNIMERCO: 'https://imageservice.kyocera-unimerco.com/imageandfile/getpdf/coating_types_endmill.pdf',
  PLATIT: 'https://www.platit.com/filer/sharing/1757056211/1308/',
  MMC_EM: 'https://www.mmc-carbide.com/us/technical_information/tec_rotating_tools/tec_solid_end_mills/coating/tec_solid_end_mills_coating',
  PAULIMOT: 'https://www.paulimot.de/en-gb/this-is-how-it-works/guidebook/milling/milling-cutter-coatings/',
  CUTWEL_AL: 'https://www.cutwel.co.uk/milling-tools/milling-cutters/aluminium-milling-cutters/a-milling-cutters',
  KYO_TP: 'https://cdn.shopify.com/s/files/1/0612/0733/files/Kyocera_Turning_Parameters-Negative_Inserts.pdf',
  KYO_CP: 'https://cdn.shopify.com/s/files/1/0612/0733/files/Kyocera_CBN-PCD_Parameters.pdf',
  KYO_TN60: 'https://kyoceraprecisiontools.com/indexable/milling/grades/steel/tn60',
  CUTWEL_CM: 'https://www.cutwel.co.uk/media/product-pdfs/downloads/Cermet%20Turning%20Inserts.pdf',
  TUNG_HT: 'https://tungaloy.com/wpdata/wp-content/uploads/HardTurning.pdf',
  CTE_HT: 'https://ctemag.com/node/24285',
  SME_CER: 'https://www.sme.org/technologies/articles/2023/april/pushing-the-limits-with-ceramics/',
  MMC_PCD: 'https://mitsubishicarbide.net/contents/mmus/enus/html/product/technical_information/grade/turning/pcd.html',
  NTK_TM: 'https://ntkcuttingtools.com/wpdata/wp-content/uploads/2024/11/C_ToolMaterials_SelectionGuide_ntk_en.pdf',
};
// AIMS_CT and AIMS_TM are one publisher; so are the two Oerlikon documents, the Mitsubishi pages, the Kyocera
// pages and the two Cutwel pages.
const TC_FAMILY = { AIMS_CT: 'AIMS', AIMS_TM: 'AIMS', MMC_TM: 'MMC', MMC_EM: 'MMC', MMC_PCD: 'MMC', KYO_TP: 'KYO', KYO_CP: 'KYO', KYO_TN60: 'KYO', CUTWEL_AL: 'CUTWEL', CUTWEL_CM: 'CUTWEL' };
const tcTags = keys => guideTags(keys, TC_SOURCES, TC_FAMILY);

// Tool materials: the advisors' value, the name, and whether the built-in speed tables cover it.
const TOOLMAT_OPTIONS = [[1, 'Carbide'], [2, 'High speed steel (HSS)'], [3, 'Cermet'], [4, 'Ceramic'], [5, 'CBN (cubic boron nitride)'], [6, 'PCD (polycrystalline diamond)']];
const toolMatTabled = tm => tm === 1 || tm === 2;

// Coatings, the common ones first. [value, name, common, max temperature as printed [[°C text, key], ...]]
// No colours in the names: makers tint and layer their coatings differently (see TC_COLOUR), so a colour
// does not tell you the coating.
const COATINGS = [
  [0, 'Not chosen', 1, []],
  [1, 'Uncoated (bright)', 1, []],
  [17, 'Polished or lapped flutes, uncoated', 1, []],
  [2, 'TiN, titanium nitride', 1, [['600', 'BALZERS'], ['under 600', 'HARTNER'], ['600', 'BRYCOAT'], ['about 600', 'AIMS_CT'], ['500', 'GWS'], ['500', 'IJS'], ['about 1000 °F', 'PMPA_CT'], ['1000 °F', 'HARVEY']]],
  [3, 'TiCN, titanium carbonitride', 1, [['400', 'BALZERS'], ['400', 'BRYCOAT'], ['about 400', 'AIMS_CT'], ['under 450', 'HARTNER']]],
  [4, 'TiAlN, titanium aluminium nitride', 1, [['under 800', 'HARTNER'], ['800', 'BRYCOAT'], ['900', 'IJS'], ['about 900', 'AIMS_CT'], ['up to 900 (one grade)', 'UNIMERCO'], ['1100 (TiAlN-based grade)', 'BALZERS']]],
  [5, 'AlTiN, aluminium titanium nitride', 1, [['800', 'GWS'], ['800', 'BRYCOAT'], ['under 900', 'HARTNER'], ['up to 1000 (one grade)', 'UNIMERCO'], ['1000 (AlTiN-based grade)', 'BALZERS'], ['1100 (AlTiN/TiN nano-layer)', 'IJS'], ['about 1400 °F', 'PMPA_CT'], ['1400 °F', 'HARVEY']]],
  [6, 'AlCrN, aluminium chromium nitride', 1, [['1100 (AlCrN-based grade)', 'BALZERS'], ['about 1100', 'AIMS_CT'], ['up to 1100 (one grade)', 'UNIMERCO']]],
  [7, 'ZrN, zirconium nitride', 1, [['under 700', 'HARTNER'], ['600', 'BRYCOAT'], ['1100 °F', 'HARVEY']]],
  [8, 'DLC, diamond-like carbon', 1, [['under 500', 'HARTNER'], ['over 500 (ta-C grade)', 'BALZERS'], ['about 750 °F', 'PMPA_CT'], ['750 °F (amorphous diamond)', 'HARVEY']]],
  [9, 'Diamond, CVD film', 1, [['600', 'BALZERS'], ['under 600', 'HARTNER'], ['about 600', 'AIMS_CT'], ['up to 600', 'UNIMERCO'], ['1100 °F', 'HARVEY']]],
  [10, 'CVD multilayer on inserts (TiCN, Al2O3, TiN)', 0, []],
  [11, 'TiSiN or AlTiSiN nanocomposite', 0, [['under 800 (TiSiN, TiAlSiN)', 'HARTNER'], ['1000 to 1100 (AlTiN/TiSiN grades)', 'BALZERS'], ['up to 1200 (TiSi-based), over 1100 (AlTiSiN)', 'UNIMERCO']]],
  [16, 'AlCrSiN, aluminium chromium silicon nitride', 0, [['1100 (nACRo, AlCrSiN top layer)', 'PLATIT']]],
  [12, 'TiB2, titanium diboride', 0, [['about 900 °F', 'PMPA_CT'], ['900 °F', 'HARVEY'], ['700 (one grade)', 'UNIMERCO']]],
  [13, 'CrN, chromium nitride', 0, [['700', 'BRYCOAT'], ['about 700', 'AIMS_CT'], ['750', 'IJS']]],
  [14, 'MoS2 lubricating layer', 0, [['under 800', 'HARTNER']]],
  [15, 'Steam oxide (surface treatment)', 0, []],
];
// What colour says: nothing reliable. The same chemistry is sold in different colours by different makers.
const TC_COLOUR = ['', 'Colour is no guide to the coating. Makers tint and layer their coatings, so one chemistry comes in several colours and one colour covers several chemistries: AlTiN is listed as dark grey to black by one maker and blue-black by another, and TiB2 as light grey or silver by one and gold by another. Go by the coating name on the box or the maker\'s data.', ['HARVEY', 'UNIMERCO']];
const COAT_OPTIONS = COATINGS.map(c => [c[0], c[1]]);
const COAT_COMMON = COATINGS.filter(c => c[2]).map(c => c[0]);

// Work material groups from the advisors' list (ADV_MATS ids).
const TC_GROUP = id => ({
  al: [15, 16].includes(id), nonfe: [13, 14, 15, 16].includes(id), plastic: id === 19,
  ferrous: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 20, 21, 22].includes(id), ci: id === 12, hard: id === 6,
  ss: [9, 10, 11].includes(id), ti: id === 17, ni: id === 18,
});

// [band, text, keys]: band is good, caution, over (do not) or '' (a plain note).
// Makers' starting speeds for the tool materials without a built-in table, as each one prints them (units as
// printed, ranges across the maker's grades, mostly turning). Shown side by side, never averaged.
const TM_SPEEDS = {
  3: [
    [g => g.ferrous && !g.ss && !g.ci && !g.hard, 'steel', [['carbon steel, finishing: 830 to 1250 sfm in a continuous cut, 660 to 1060 sfm interrupted; tool steels such as D2 and H13: 400 to 830 sfm', 'KYO_TP'], ['P steels: low carbon 130 to 400 m/min, alloy 130 to 350 m/min, pre-hardened 100 to 300 m/min (two grades)', 'CUTWEL_CM']]],
    [g => g.ss, 'stainless steel', [['AISI 303, 304, 316 and 420, finishing: 400 to 660 sfm continuous, 330 to 500 sfm interrupted', 'KYO_TP']]],
    [g => g.ci, 'cast iron', [['grey iron, finishing: 990 to 1320 sfm continuous; nodular iron 500 to 990 sfm', 'KYO_TP']]],
  ],
  4: [
    [g => g.ci, 'cast iron', [['grey iron: 830 to 2310 sfm over its grades, finishing to medium', 'KYO_TP'], ['grey iron: about 700 m/min with its alumina grades, up to about 1200 m/min with a silicon nitride grade; ductile iron about 400 m/min', 'NTK_TM']]],
    [g => g.ni, 'nickel alloys', [['heat-resistant alloys: turning 600 to 1100 sfm, milling 2800 to 4400 sfm (Iscar); one whisker grade up to 1500 sfm (Greenleaf)', 'SME_CER'], ['worked examples on Inconel 718 and Waspaloy, turning: 180 to 240 m/min', 'NTK_TM']]],
    [g => g.hard, 'hardened steel', [['40 to 50 HRC: 200 to 330 sfm; 50 to 65 HRC: 100 to 200 sfm', 'KYO_TP'], ['one ceramic grade: 60 to 180 m/min', 'TUNG_HT'], ['about 700 sfm on A2 at 55 HRC (Greenleaf)', 'CTE_HT']]],
  ],
  5: [
    [g => g.hard, 'hardened steel', [['over 55 HRC: 200 to 660 sfm over its grades, finishing, continuous to interrupted; under 55 HRC: 200 to 390 sfm', 'KYO_CP'], ['50 to 350 m/min over its CBN grades (hard turning, over 50 HRC)', 'TUNG_HT'], ['about 600 sfm as a starting point (Seco Tools)', 'CTE_HT']]],
    [g => g.ci, 'cast iron', [['grey iron under 250 HB: 980 to 3940 sfm over its grades; chilled iron rolls over 55 HRC: 230 to 520 sfm', 'KYO_CP'], ['grey iron: up to about 1200 m/min', 'NTK_TM']]],
  ],
  6: [
    [g => g.nonfe, 'aluminium and other non-ferrous metals', [['aluminium, zinc and copper alloys: 990 to 3300 sfm; magnesium alloys 1320 to 3960 sfm', 'KYO_CP'], ['aluminium 650 to 4920 sfm; aluminium alloys up to 16 % silicon 650 to 3940 sfm, over 16 % silicon 650 to 3280 sfm; copper alloys 650 to 3940 sfm', 'MMC_PCD']]],
    [g => g.plastic, 'plastics and composites', [['fibre-reinforced plastics: 330 to 1980 sfm, dry', 'KYO_CP'], ['reinforced plastic 330 to 3280 sfm; glass-fibre reinforced plastic 330 to 2630 sfm', 'MMC_PCD']]],
    [g => g.ti, 'titanium', [['titanium alloys: 330 to 660 sfm, wet', 'KYO_CP']]],
  ],
};
function toolMatSpeeds(tm, matId) {
  const g = TC_GROUP(matId), sets = (TM_SPEEDS[tm] || []).filter(x => x[0](g));
  return sets.map(([, what, rows]) => ['', 'Makers\' starting speeds on ' + what + ', as each prints them: ' + rows.map(([t, k]) => t + ' <abbr class="gsrc" title="' + gesc(TC_SOURCES[k] || k) + '">' + k + '</abbr>').join('; ') + '. Each range covers that maker\'s own grades; start low and use the chart for the grade in your hand.', rows.map(r => r[1])]);
}
function toolMatFit(tm, matId) {
  const g = TC_GROUP(matId), out = [];
  if (tm === 3) {
    out.push([g.ferrous && !g.ci ? 'good' : '', 'Cermet is for steels and stainless steels, at higher speed for semi-finishing and finishing, with a very good finish.', ['KMT_GR', 'AIMS_TM', 'KYO_TN60']]);
    out.push(['caution', 'Finishing and light cuts: it is less suited than carbide to heavy roughing. One seller names it for a small depth of cut.', ['KMT_GR', 'AIMS_TM', 'CUTWEL_CM']]);
  } else if (tm === 4) {
    out.push([g.ci || g.ni || g.hard ? 'good' : '', 'Ceramics are for cast iron, heat-resistant nickel alloys and hardened steel, where a high speed can be used.', ['NTK_TM', 'KMT_GR']]);
    out.push(['', 'Ceramics are usually run dry in hardened steel and heat-resistant alloys.', ['CTE_HT', 'SME_CER']]);
    out.push(['caution', 'Ceramics are very sensitive to shock: program the entry and exit for them, and do not run a ceramic tool in a program written for carbide.', ['SME_CER']]);
  } else if (tm === 5) {
    out.push([g.hard || g.ci ? 'good' : '', 'CBN is for hardened steel and cast iron.', ['NTK_TM', 'KMT_GR', 'AIMS_TM']]);
    if (g.hard) out.push(['', 'Mostly a finishing tool: CBN is generally used for finishing, and many shops hard turn to semi-finish before grinding.', ['TUNG_HT', 'CTE_HT']]);
    if (g.hard) out.push(['', 'It needs a rigid setup. One maker: wet cutting gives longer life in a continuous cut, dry in an interrupted cut.', ['CTE_HT', 'TUNG_HT']]);
    if (g.nonfe || g.plastic) out.push(['caution', 'One seller says CBN gains nothing over carbide on non-ferrous metals.', ['AIMS_TM']]);
  } else if (tm === 6) {
    if (g.ferrous) out.push(['over', 'PCD is not for steel or cast iron: diamond reacts with iron at cutting heat. Use carbide, cermet, ceramic or CBN.', ['KMT_GR', 'AIMS_TM', 'MMC_TM', 'MMC_PCD']]);
    else out.push([g.nonfe || g.plastic ? 'good' : '', 'PCD is for aluminium, copper alloys and other non-ferrous metals, plastics and composites, at very high speed.', ['NTK_TM', 'KMT_GR', 'AIMS_TM']]);
    out.push(['', 'PCD tools need a rigid machine and rigid workholding.', ['KMT_GR']]);
  }
  // The advisors' "hardened" steel is the heat treated alloy steel of 300 to 400 HB, softer than the hard turning
  // range the CBN and ceramic figures are printed for.
  if ((tm === 4 || tm === 5) && g.hard) out.push(['caution', 'The work material picked here is alloy steel heat treated to 300 to 400 HB. The makers\' hardened steel ranges below are printed for harder steel (from 40 HRC for ceramic, from 50 HRC for most CBN grades): ask the maker for this hardness.', ['KYO_TP', 'KYO_CP', 'TUNG_HT']]);
  out.push(...toolMatSpeeds(tm, matId));
  if (!toolMatTabled(tm)) out.push(['', 'No speed table for this tool material is built in: type the maker\'s cutting speed for the grade, and for milling its chip load (Advanced, "Your own").', []]);
  return out;
}
// Each coating: what it is recommended for, and what not, per work group. Sources differ: shown side by side.
function coatFit(coat, matId) {
  const g = TC_GROUP(matId), out = [];
  if (coat === 1) out.push([g.nonfe ? 'good' : '', 'Bright, uncoated carbide suits non-ferrous metals and short runs.', ['KMT_GR', 'AIMS_CT']]);
  if (coat === 17) {
    out.push([g.al || g.nonfe ? 'good' : '', 'Polished or lapped flutes and sharp edges, uncoated, are for aluminium: the smooth flute holds back built-up edge and lets the chip slide out, and gives a bright finish.', ['PAULIMOT', 'CUTWEL_AL']]);
    if (g.ferrous || g.ti || g.ni) out.push(['caution', 'The sources name polished uncoated tools for aluminium only; for this material a coated tool is the usual choice.', ['PAULIMOT', 'CUTWEL_AL']]);
  }
  if (coat === 2) out.push([g.ferrous ? 'good' : '', 'TiN is the general purpose coating, mainly for ferrous metals.', ['HARTNER', 'PMPA_CT', 'AIMS_CT', 'HARVEY']]);
  if (coat === 3) out.push(['', 'TiCN suits edges under high load and interrupted cuts, with a lower heat limit than TiN.', ['HARTNER', 'BALZERS', 'AIMS_CT']]);
  if (coat === 4 || coat === 5) {
    if (g.al) out.push(['caution', 'Aluminium-bearing coatings (TiAlN, AlTiN) are not advised for aluminium: aluminium sticks to the coating. Use DLC, ZrN, polished or bright carbide.', ['PRODINC', 'HARTNER', 'PMPA_CT', 'HARVEY']]);
    else if (coat === 5 && (g.hard || g.ti || g.ni || g.ss || g.ferrous)) out.push(['good', 'AlTiN suits alloy, tool and hardened steels, stainless, titanium and nickel alloys.', ['HARTNER', 'PRODINC', 'HARVEY']]);
    else if (coat === 4 && (g.ferrous || g.ti)) out.push(['good', 'TiAlN suits steels, stainless, cast iron and titanium.', ['HARTNER', 'PRODINC', 'AIMS_CT']]);
    if (coat === 4 && !g.al) out.push(['', 'The sources differ on how to run it: one tool maker names TiAlN for dry or near-dry cutting at high speed; another maker\'s TiAlN grade is for low and medium speeds, wet.', ['HARTNER', 'UNIMERCO']]);
    if (coat === 5 && !g.al) out.push(['', 'One maker\'s AlTiN grade is for steel up to 52 HRC, at medium and high speed, wet or dry.', ['UNIMERCO']]);
  }
  if (coat === 6) {
    if (g.al) out.push(['caution', 'The sources differ: one end mill guide says to avoid aluminium-bearing coatings for aluminium; one tool seller lists AlCrN for aluminium.', ['PRODINC', 'AIMS_CT']]);
    else out.push([g.hard || g.ferrous || g.ni ? 'good' : '', 'AlCrN is for very hot cutting: steels, hardened steels and heat-resistant alloys, wet or dry.', ['BALZERS', 'AIMS_CT', 'UNIMERCO']]);
  }
  if (coat === 7) out.push([g.nonfe ? 'good' : '', 'ZrN is for aluminium, titanium and other non-ferrous work, including the abrasive ones: brass, bronze, copper and abrasive aluminium alloys.', ['HARTNER', 'PRODINC', 'HARVEY']]);
  if (coat === 8) {
    if (g.ferrous) out.push(['caution', 'One tool maker says its amorphous diamond (a DLC) is not for ferrous work: its heat limit is too low.', ['HARVEY']]);
    else out.push([g.nonfe || g.plastic ? 'good' : '', 'DLC is for aluminium and other non-ferrous metals, against built-up edge, and for plastics, graphite and composites.', ['HARTNER', 'PMPA_CT', 'BALZERS', 'HARVEY']]);
  }
  if (coat === 9) {
    if (g.ferrous) out.push(['over', 'Diamond is never for steel or cast iron: carbon dissolves into iron when hot.', ['HARTNER', 'BALZERS', 'AIMS_CT', 'HARVEY']]);
    else out.push([g.al || g.plastic ? 'good' : '', 'Diamond film is for graphite, fibre-reinforced plastics and composites, and high-silicon aluminium; also green (unsintered) carbide and ceramics.', ['HARTNER', 'AIMS_CT', 'HARVEY', 'UNIMERCO']]);
  }
  if (coat === 10) out.push([g.ferrous ? 'good' : '', 'Thick CVD layers on inserts (TiCN for wear, aluminium oxide against heat) are for most steel and cast iron cutting; they need a honed edge and a heavier chip.', ['KMT_GR', 'WIDIA_MC']]);
  if (coat === 11) out.push([g.hard || g.ss || g.ni || g.ti ? 'good' : '', 'Silicon-bearing nanocomposite coatings are for hard work: hardened and alloyed steels and cast iron, materials over about 50 HRC (one maker: hardened steel over 60 HRC, dry, high speed), and stainless, nickel and titanium alloys.', ['HARTNER', 'BALZERS', 'UNIMERCO', 'PAULIMOT']]);
  if (coat === 16) {
    out.push(['', 'The sources name AlCrSiN for different work. A tool maker uses it, with AlTiSiN layers, for hardened steel (high oxidation temperature and lubricity). A coating maker names its AlCrSiN-topped coating for abrasive aluminium alloys over 12 % silicon, titanium alloys such as Ti-6Al-4V, and wood.', ['MMC_EM', 'PLATIT']]);
    if (g.hard || (g.al) || g.ti) out.push(['good', g.hard ? 'Hardened steel is one of the uses named.' : g.ti ? 'Titanium alloys are one of the uses named.' : 'Abrasive (high-silicon) aluminium is one of the uses named; for ordinary aluminium the sources prefer non-aluminium coatings or polished tools.', g.hard ? ['MMC_EM'] : ['PLATIT']]);
  }
  if (coat === 12) out.push([g.al ? 'good' : '', 'TiB2 is for aluminium and magnesium alloys and other sticky materials, against built-up edge; one maker says not the abrasive (high-silicon) aluminium alloys.', ['PMPA_CT', 'HARVEY', 'UNIMERCO']]);
  if (coat === 13) out.push([g.nonfe ? 'good' : '', 'CrN is for non-ferrous metals (one seller names copper, nickel and Monel) and for forming and moulding tools.', ['BRYCOAT', 'IJS', 'AIMS_CT']]);
  if (coat === 14) out.push(['', 'A soft lubricating layer for dry or minimum-lubrication cutting and against galling.', ['HARTNER']]);
  if (coat === 15) out.push(['', 'Steam oxide is a surface treatment, not a hard coating; named for low carbon steel against chip build-up.', ['AIMS_CT']]);
  const c = COATINGS.find(x => x[0] === coat);
  if (c && c[3].length) out.push(['', 'Highest working temperature as each source prints it, °C unless marked: ' + c[3].map(([t, k]) => t + ' <abbr class="gsrc" title="' + gesc(TC_SOURCES[k] || k) + '">' + k + '</abbr>').join('; ') + '. Brands differ, so read it as a rough guide, and keep the cut below it: coolant and speed decide the heat.', c[3].map(x => x[1])]);
  if (coat > 1 && coat !== 17) out.push(TC_COLOUR);
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
