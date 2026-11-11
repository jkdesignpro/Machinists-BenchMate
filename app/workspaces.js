'use strict';
// How the tools are organised: workspaces (the left rail), their sections, and
// "hub" pages that hold several related tools as tabs. Loaded after every tool
// file and before app.js. Nothing here changes a calculation.
//
//   Page   = one entry in the rail: a single tool, or a hub with tabs.
//   Hub    = { title, desc, icon, tabs: [[toolId, tabLabel, simple?], ...] }
//   Simple = the pages listed in Simple mode (SIMPLE_PAGES); inside a hub only
//            the tabs flagged simple are shown in that mode.

const HUBS = {
  feeds: { title: 'Feed conversions', icon: 'units', desc: 'Feed per tooth, per rev and per minute, for mills, lathes and rotary axes.',
    tabs: [['feed', 'Milling', 1], ['lathefeed', 'Turning', 1], ['caxis', 'Rotary / C-axis']] },
  cornerfeeds: { title: 'Arc and corner feed', icon: 'path', desc: 'Feed correction on arcs and the extra engagement in corners.',
    tabs: [['cornerfeed', 'Corner engagement'], ['arcfeed', 'Arc feed']] },
  ballnose: { title: 'Ball-nose cutters', icon: 'milling', desc: 'Cusp height and stepover, effective diameter, corrected speed and feed.',
    tabs: [['ballcusp', 'Cusp and stepover'], ['balleff', 'Effective diameter']] },
  drills: { title: 'Drill and tap drill charts', icon: 'drill', desc: 'Number, letter, fraction and metric drills, and the drill for a tap.',
    tabs: [['drillchart', 'Drill sizes', 1], ['tapdrill', 'Tap drill', 1]] },
  drilldepth: { title: 'Drill point and spot depth', icon: 'drill', desc: 'Point length to add to a drilled depth, spot and centre drill depths.',
    tabs: [['drillpoint', 'Point length'], ['spotdepth', 'Spot and centre drill']] },
  convert: { title: 'Unit and fraction conversion', icon: 'units', desc: 'Convert units, and fractions to decimals and millimetres.',
    tabs: [['units', 'Units', 1], ['fraction', 'Fractions', 1]] },
  fitlookup: { title: 'Limits and fits', icon: 'fit', desc: 'ISO 286 and ANSI inch fits, with general tolerances.',
    tabs: [['fits', 'ISO fits', 1], ['ansifits', 'ANSI inch fits', 1], ['gentol', 'General tolerances']] },
  surfacefin: { title: 'Surface finish', icon: 'surface', desc: 'Roughness conversions and symbols, and the finish a turning tool or a milling cutter will leave.',
    tabs: [['surface', 'Conversions and symbols', 1], ['finish', 'From nose radius and feed', 1], ['millfinish', 'Milling: floor and wall']] },
  holepattern: { title: 'Hole patterns', icon: 'holes', desc: 'Bolt circles and rectangular grids: a table of hole positions to copy into a program, and DXF files.',
    tabs: [['bolt', 'Bolt circle', 1], ['holegrid', 'Rectangular grid', 1], ['dxfbolt', 'Bolt circle DXF'], ['dxfgrid', 'Rectangular grid DXF']] },
  dxfshapes: { title: 'DXF shapes', icon: 'dxf', desc: 'Slots, rectangles, polygons, rings and keyed profiles as clean DXF files.',
    tabs: [['dxfslot', 'Slot'], ['dxfrect', 'Rectangle'], ['dxfpoly', 'Polygon'], ['dxfring', 'Circle and ring'], ['dxfprofile', 'Keyhole and D-flat']] },
  threadprog: { title: 'Thread programming', icon: 'code', desc: 'Thread milling and lathe threading (G76, G92) programs.',
    tabs: [['cyctmill', 'Thread mill'], ['cycthread', 'Lathe G76 / G92']] },
  turntime: { title: 'Turning cut time', icon: 'clock', desc: 'Time for one pass, a run of roughing passes, or parting off.',
    tabs: [['passtime', 'One pass', 1], ['roughtime', 'Roughing passes'], ['partofftime', 'Part-off and groove']] },
  grindtimes: { title: 'Grinding time', icon: 'clock', desc: 'Cylindrical traverse, plunge and surface grinding time.',
    tabs: [['grindtime', 'Cylindrical'], ['grindsurf', 'Surface']] },
  gdtpos: { title: 'True position', icon: 'holes', desc: 'Check a measured position, bonus tolerance, and convert to and from plus/minus.',
    tabs: [['gdttp', 'Position check', 1], ['gdtbonus', 'Bonus and virtual condition'], ['gdtconv', 'Plus/minus conversion'], ['gdtfast', 'Fastener formulas'], ['gdtcomp', 'Composite position']] },
  coolant: { title: 'Coolant', icon: 'drop', desc: 'Concentration from a refractometer reading, mixing and topping up.',
    tabs: [['coolconc', 'Concentration'], ['coolmix', 'Mix and top-up']] },
  inserts: { title: 'Inserts and holders', icon: 'insert', desc: 'Decode ISO insert and toolholder designations and cutting material groups.',
    tabs: [['insertcode', 'Insert (ISO 1832)'], ['holdercode', 'Holder (ISO 5608)'], ['iso513', 'Material groups (ISO 513)']] },
  tapergauge: { title: 'Ball and roll checks', icon: 'caliper', desc: 'Measure countersinks, tapered bores and tapers with balls and rolls.',
    tabs: [['ballcone', 'Ball in a countersink'], ['taperrolls', 'Taper over rolls']] },
  chipthinning: { title: 'Chip thinning', icon: 'path', desc: 'Feed per tooth for the chip thickness you want: narrow widths of cut, entering angles, high-feed cutters and round inserts.',
    tabs: [['chipthin', 'Narrow width of cut'], ['leadthin', 'Entering angle and round inserts']] },
  holeforce: { title: 'Drill and tap forces', icon: 'drill', desc: 'Torque, thrust and power for drilling, and the torque a tap needs.',
    tabs: [['drillforce', 'Drill thrust and torque'], ['taptorque', 'Tap torque']] },
  saws: { title: 'Bandsaw', icon: 'saw', desc: 'Cut time and the blade pitch for the section being cut.',
    tabs: [['bandsaw', 'Cut time'], ['sawtpi', 'Blade pitch']] },
};

const WORKSPACES = [
  { id: 'turning', name: 'Turning', icon: 'turning', blurb: 'Speeds, inserts, boring bars, tapers and cut times for lathe work.', sections: [
    ['Speeds and feeds', ['advturn', 'rpm', 'feeds', 'mrr', 'kcforce', 'toollife'], 'gauge'],
    ['Tooling', ['inserts', 'boringbar', 'tnrc'], 'insert'],
    ['Operations', ['turntime', 'taper', 'surfacefin', 'knurl'], 'turning'],
    ['Programs', ['cycg71', 'cycgroove', 'cyctaper', 'threadprog'], 'code'],
    ['Stock and workholding', ['bar', 'chuckforce', 'slender', 'changegears'], 'material'],
  ] },
  { id: 'milling', name: 'Milling', icon: 'milling', blurb: 'Speeds and feeds, engagement, deflection and chatter for mills.', sections: [
    ['Speeds and feeds', ['advmill', 'advplunge', 'rpm', 'feeds', 'mrr', 'kcforce', 'cutopt', 'toollife'], 'gauge'],
    ['Engagement', ['chipthinning', 'cornerfeeds', 'helix', 'ballnose'], 'path'],
    ['Tool behaviour', ['deflection', 'runout', 'chatter'], 'wave'],
    ['Other milling', ['surfacefin', 'slitsaw', 'indexing'], 'saw'],
  ] },
  { id: 'holes', name: 'Holes and threads', icon: 'threads', blurb: 'Drilling, tapping, thread data for every standard, and thread programs.', sections: [
    ['Drilling', ['advdrill', 'advream', 'advtap', 'drills', 'drilldepth', 'holeforce', 'cycdrill', 'clearance'], 'drill'],
    ['Tapping and thread data', ['threaddata', 'threadid', 'taplimits', 'wires', 'sti', 'coating', 'multistart'], 'tap'],
    ['Thread standards', ['pipethreads', 'whitworth', 'acme', 'trapezoidal', 'buttress', 'unseries', 'unm', 'unjunr'], 'thread'],
    ['Thread programs', ['threadprog'], 'code'],
  ] },
  { id: 'process', name: 'Grinding, sawing and gears', icon: 'gear', blurb: 'Grinding speeds and times, saws, gears, splines and broaching.', sections: [
    ['Grinding', ['grindspeed', 'grindtimes', 'gritconv', 'wheelcode'], 'wheel'],
    ['Sawing', ['saws', 'slitsaw'], 'saw'],
    ['Gears', ['spurgear', 'helicalgear', 'gearmeasure', 'geartrain', 'planetary', 'worm', 'changegears', 'indexing'], 'gear'],
    ['Splines and broaching', ['spline', 'cycbroach', 'keys'], 'gear'],
  ] },
  { id: 'inspect', name: 'Measure and inspect', icon: 'inspection', blurb: 'GD&T, fits, surface finish, gauge blocks and quality checks.', sections: [
    ['GD&T', ['gdtguide', 'gdtfcf', 'gdtpos', 'gdtprofu', 'gdtdof', 'gdtstack'], 'frame'],
    ['Fits and finish', ['fitlookup', 'tolmid', 'offsetadj', 'shrinkfit', 'surfacefin', 'prefnum'], 'fit'],
    ['Measuring', ['sinebar', 'scales', 'wires', 'tapergauge', 'dovetail', 'hardness', 'tempcomp'], 'caliper'],
    ['Quality', ['capability', 'ctrlchart', 'sampling'], 'chart'],
  ] },
  { id: 'maths', name: 'Shop maths', icon: 'triangle', blurb: 'Calculator, conversions, geometry, stock and engineering sums.', sections: [
    ['Calculator and conversion', ['calc', 'convert', 'formulas'], 'calc'],
    ['Geometry', ['triangle', 'arc', 'fillet', 'compound', 'figures', 'holepattern'], 'angle'],
    ['Stock and sheet metal', ['weight', 'bar', 'bend'], 'material'],
    ['Engineering', ['section', 'beam', 'torsion', 'column', 'stressconc', 'fatigue', 'balance', 'critspeed', 'bearinglife'], 'beam'],
  ] },
  { id: 'program', name: 'Programming', icon: 'programming', blurb: 'G and M codes, macros, cycle generators, backplot and DXF.', sections: [
    ['Codes', ['gmcodes', 'macroref'], 'code'],
    ['Cycle generators', ['cycdrill', 'threadprog', 'cyctaper', 'cycgroove', 'cycg71', 'cycbroach'], 'code'],
    ['Simulate and draw', ['gsim', 'sketch', 'holepattern', 'dxfshapes'], 'play'],
    ['Setup', ['setupsheet', 'tnrc', 'offsetadj'], 'sheet'],
  ] },
  { id: 'reference', name: 'Reference', icon: 'reference', blurb: 'Materials, fasteners, machine elements, guides and shop helpers.', sections: [
    ['Materials', ['materials', 'hardness', 'heattreat', 'tempercolours', 'galvanic', 'plastics', 'metalid'], 'material'],
    ['Fasteners', ['boltgrade', 'bolttorque', 'shcs', 'clearance', 'spanner', 'tslots'], 'nut'],
    ['Machine elements', ['machinetapers', 'keys', 'oring', 'bearinglife'], 'bearing'],
    ['Shop', ['coolant', 'economics', 'abbrev'], 'drop'],
    ['Guides', ['cncguide', 'toolguide'], 'book'],
  ] },
];
// Listed on the Home rail rather than in a workspace.
const MY_SHOP = ['machines', 'toollib'];

// The pages of Simple mode, in rail order.
const SIMPLE_PAGES = ['calc', 'rpm', 'feeds', 'drills', 'threaddata', 'wires', 'holepattern', 'triangle', 'convert',
  'weight', 'hardness', 'fitlookup', 'surfacefin', 'gdtpos', 'sinebar', 'turntime'];

// Icon for a page when the section icon is not specific enough.
const PAGE_ICON = {
  calc: 'calc', rpm: 'gauge', threaddata: 'thread', wires: 'thread', triangle: 'triangle', weight: 'material', hardness: 'bars',
  sinebar: 'angle', machines: 'machine', toollib: 'toollib', gsim: 'play', sketch: 'dxf', chatter: 'wave', boringbar: 'beam', deflection: 'beam',
  taper: 'angle', knurl: 'surface', formulas: 'book', gmcodes: 'code', materials: 'material', bolttorque: 'nut', oring: 'bearing',
  setupsheet: 'sheet', scales: 'caliper', gdtfcf: 'frame', gdtguide: 'book', capability: 'chart', ctrlchart: 'chart', sampling: 'chart',
  spline: 'gear', cycbroach: 'code', keys: 'fit', tempcomp: 'flame', heattreat: 'flame', tempercolours: 'flame', coolant: 'drop',
  abbrev: 'drawing', economics: 'bars', mrr: 'bars', toollife: 'clock', cutopt: 'gauge', runout: 'gauge', indexing: 'gear',
};

// ---- Derived tables ----
const PAGES = {};      // page id -> { id, title, desc, icon, tabs?, tool? }
const PAGE_OF = {};    // tool id -> page id
const PAGE_HOME = {};  // page id -> { ws, section } (first place it is listed)
(() => {
  const byId = {}; TOOLS.forEach(t => { byId[t.id] = t; });
  const inHub = {};
  Object.entries(HUBS).forEach(([id, h]) => {
    const tabs = h.tabs.filter(([tid]) => byId[tid]).map(([tid, label, simple]) => ({ id: tid, label, simple: !!simple, tool: byId[tid] }));
    PAGES[id] = { id, title: h.title, desc: h.desc, icon: h.icon, tabs };
    tabs.forEach(tb => { inHub[tb.id] = id; PAGE_OF[tb.id] = id; });
  });
  TOOLS.forEach(t => { if (!inHub[t.id]) { PAGES[t.id] = { id: t.id, title: t.title, desc: t.desc, icon: PAGE_ICON[t.id] || '', tool: t }; PAGE_OF[t.id] = t.id; } });
  WORKSPACES.forEach(w => w.sections.forEach(([name, ids, icon]) => ids.forEach(id => {
    const p = PAGES[id]; if (!p) return;
    if (!PAGE_HOME[id]) PAGE_HOME[id] = { ws: w.id, section: name };
    if (!p.icon) p.icon = PAGE_ICON[id] || icon || w.icon;
  })));
  MY_SHOP.forEach(id => { if (PAGES[id]) { PAGE_HOME[id] = { ws: 'home', section: 'My shop' }; if (!PAGES[id].icon) PAGES[id].icon = PAGE_ICON[id] || 'info'; } });
  Object.values(PAGES).forEach(p => { if (!p.icon) p.icon = 'info'; });
  // A tool is a Simple tool when its page is in SIMPLE_PAGES (and, in a hub, its tab is flagged).
  const simple = new Set();
  SIMPLE_PAGES.forEach(id => { const p = PAGES[id]; if (!p) return; if (p.tabs) p.tabs.forEach(tb => { if (tb.simple) simple.add(tb.id); }); else simple.add(id); });
  TOOLS.forEach(t => { t.level = simple.has(t.id) ? 'simple' : 'advanced'; });
})();
// Pages that no workspace lists (a mistake in the tables above); the smoke test fails on any.
const UNLISTED_PAGES = Object.keys(PAGES).filter(id => !PAGE_HOME[id]);
