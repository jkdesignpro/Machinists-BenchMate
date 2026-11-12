// Tool registry. Each tool: id, level ('simple' | 'advanced' | 'expert': the lowest mode that lists it), group, title, desc, fields(sys) -> [{id,label,unit,def}],
// A field may also carry level: 'advanced' (hidden in Simple mode; its default is used).
// calc(v, W, sys) -> [{label,value,unit,dp}], working (string), source (string).
// `W` is the Rust (WebAssembly) formula module; no formulas are duplicated in JS.
const R = (label, value, unit, dp = 3, chk, extra) => Object.assign({ label, value, unit, dp, chk }, extra || {});
const lenU = s => (s === 'inch' ? 'in' : 'mm');
const spdU = s => (s === 'inch' ? 'SFM' : 'm/min');
const feedRevU = s => (s === 'inch' ? 'in/rev' : 'mm/rev');
const feedMinU = s => (s === 'inch' ? 'in/min' : 'mm/min');

// Unit conversion only (exact or defined factors).
const IN_MM = 25.4, FT_M = 0.3048, LBF_N = 4.4482216152605, MPSI_GPA = 6.894757293168, IN3_CM3 = 16.387064, KW_HP = 1.34102;

// Young's modulus presets for the tool body. Data, each with its source (see docs/sources.md).
const E_PRESETS = {
  1: { gpa: 580, name: 'Solid carbide', src: 'Ceratizit grade CTS20L, 10% Co' },
  2: { gpa: 219, name: 'HSS (M2, 1.3343)', src: 'voestalpine data sheet HSS M2 1.3343, at 20 C' },
};
// Boring bar E presets (see docs/sources.md) and published overhang guidance (L/D) per bar maker.
const BAR_E = {
  1: { gpa: 210, name: 'Steel', src: 'Ovako data for 4140 / 42CrMo4' },
  2: { gpa: 580, name: 'Solid carbide', src: 'Ceratizit grade CTS20L, 10% Co' },
  3: { gpa: 360, name: 'Tungsten heavy metal', src: 'Plansee Densimet D176' },
};
const BAR_LD = {
  1: [['Seco Tools', '4'], ['Kennametal', '3'], ['Cutwel', '4']],
  2: [['Seco Tools', '8'], ['Kennametal', '6'], ['Cutwel', '6-8']],
  3: [['Seco Tools', '6'], ['Kennametal', '6']],
  damped: [['Seco Tools (Steadyline)', '10'], ['Kennametal', '10 or more']],};
BAR_E[4] = { gpa: 210, name: 'Steel (plain bar of the same size)', src: 'Ovako data for 4140 / 42CrMo4' };
BAR_LD[4] = BAR_LD.damped;
// One evaluation of the boring bar page, shared by the rows, the suggestions, the panel and the send buttons.
// The material table, kc groups and card helpers are in app/advisor.js and app/cutforce.js (loaded later, used at run time).
function bbRun(v, W, s) {
  const inch = s === 'inch', k = inch ? IN_MM : 1, fk = inch ? LBF_N : 1, ef = eField(s);
  if (!(v.d > 0 && v.L > 0)) return null;
  const p = BAR_E[v.mat], e = v.E > 0 ? v.E * ef.k : (p ? p.gpa : NaN);
  if (!(e > 0)) return { err: ["Young's modulus", 'Enter E for your bar (from its maker)'] };
  const di = v.di > 0 ? v.di * k : 0, d = v.d * k, L = v.L * k;
  if (di >= d) return { err: ['Coolant hole', 'Must be smaller than the bar'] };
  const m = v.wm > 0 ? advMat(v.wm) : null, g = m ? kcGroup(m.kc) : null, kap = v.kap > 0 ? v.kap : 95;
  const re = v.re > 0 ? v.re * k : NaN, tA = (isFinite(v.ag) ? v.ag : 50) / 100;
  const fSug = W.range_pick(W.apply_factor(re, 1 / 3), W.apply_factor(re, 1 / 2), tA), fL = v.f > 0, f = fL ? v.f * k : fSug;
  const kc = v.kc > 0 ? v.kc : (g && f > 0 ? W.kienzle_kc(g[5], g[6] != null ? g[6] : 0, W.lead_chip_thickness(f, kap)) : NaN);
  const lim = v.lim > 0 ? v.lim * k : advDeflDefault(v.cut === 3 ? 3 : 1);
  const guide = BAR_LD[p ? v.mat : 0] || [], ldG = guide.length ? Math.min(...guide.map(x => parseFloat(x[1]))) : 0;
  const apL = v.ap > 0, apStart = 0.040 * IN_MM, ap0 = apL ? v.ap * k : apStart, Fk = v.F > 0 ? v.F * fk : 0;
  const kcA = kc > 0 ? kc : 0, fA = f > 0 ? f : 0;
  const B = i => W.advise_bore(L, d, di, e, kcA, fA, ap0, apL ? 1 : 0, Fk, lim, ldG, i);
  const sAp = W.advise_bore(L, d, di, e, kcA, fA, apStart, 0, 0, lim, ldG, 6);
  return { inch, k, p, e, d, di, L, m, g, kc, f, fL, fSug, lim, limOwn: v.lim > 0, guide, ldG, apL, ap0, typed: Fk > 0, sAp: isFinite(sAp) ? sAp : apStart,
    wmNone: !(v.wm > 0) && !(v.kc > 0), noKc: !!m && !g && !(v.kc > 0),
    force: B(0), defl: B(1), shareD: B(2), ld: B(3), shareL: B(4), limit: B(5), ap: B(6), apMax: B(7), reduced: B(8) > 0, lFit: B(9) };
}
const eField = s => s === 'inch' ? { u: 'Mpsi', k: MPSI_GPA, dp: 1 } : { u: 'GPa', k: 1, dp: 0 };
// Effective (equivalent solid) diameter of the fluted part as a fraction of D.
// Blank by default unless a verified source is recorded in docs/sources.md.
const FLUTE_FACTOR_DEF = '';

// Shared tool-geometry fields for the deflection and cut tools.
const toolGeomFields = s => [
  { id: 'd', label: 'Tool (cutting) diameter D', unit: lenU(s), def: s === 'inch' ? 0.5 : 12 },
  { level: 'advanced', id: 'dsh', label: 'Shank diameter (blank = D)', unit: lenU(s), def: '' },
  { id: 'L', label: 'Stick-out (holder face to tip)', unit: lenU(s), def: s === 'inch' ? 1.5 : 40 },
  { id: 'lf', label: 'Flute length (blank = treat as solid)', unit: lenU(s), def: s === 'inch' ? 1 : 26 },
  { level: 'advanced', id: 'kf', label: 'Effective flute diameter / D (approximation)', unit: 'x D', def: FLUTE_FACTOR_DEF },
  { id: 'mat', label: 'Tool material (sets E)', unit: '', def: 1, options: [[1, 'Solid carbide'], [2, 'HSS (M2)'], [0, 'Other: enter E below']] },
  { level: 'advanced', id: 'E', label: "Young's modulus E (blank = preset)", unit: eField(s).u, def: '' },
];
// Returns metric geometry {d, dsh, L, lf, kf, e} plus E notes, or an error string.
function toolGeom(v, s) {
  const k = s === 'inch' ? IN_MM : 1, ef = eField(s);
  const p = E_PRESETS[v.mat];
  const e = v.E > 0 ? v.E * ef.k : (p ? p.gpa : NaN);
  return { d: v.d * k, dsh: v.dsh > 0 ? v.dsh * k : 0, L: v.L * k, lf: v.lf > 0 ? v.lf * k : 0, kf: v.kf > 0 ? v.kf : 0, e,
    eSrc: v.E > 0 ? 'as entered' : (p ? p.name + ' preset, ' + p.src : ''), eShow: e / ef.k, eU: ef.u, eDp: ef.dp };
}
const LIMIT_NAMES = { 1: 'Tool deflection', 2: 'Spindle power', 3: 'Spindle torque (below base speed)', 4: 'Flute length', 5: 'Tool diameter (ae = D)', 6: 'Stick-out (no flute length entered)' };

// Shared note for the DXF screens (see docs/cad-dxf.md).
const DXF_NOTE = 'Geometry and the DXF text are made in the Rust core. Layers: OUTLINE (outer profile), HOLES (round holes), CENTRE (centre marks, pitch circle, slot centreline). Outer profiles are closed polylines, counter-clockwise; arcs inside a polyline are stored as bulges, bulge = tan(included angle / 4). R2000 files store the units in $INSUNITS (1 = inches, 4 = millimetres); R12 files cannot, so set the units when you import them. "Outlines as separate lines and arcs" writes each outline as LINE and ARC entities end to end instead of one polyline, for programs that draw polyline arcs as straight lines (OpenSCAD does) or do not read polylines. All values are in the units chosen in the title bar.';
const DXF_SOURCE = 'Autodesk DXF Reference (HEADER $INSUNITS and $MEASUREMENT; LINE, CIRCLE, ARC, LWPOLYLINE, POLYLINE/VERTEX bulge). Output checked with the open-source ezdxf reader (audit) and by opening the files in LibreCAD, Inkscape and OpenSCAD and comparing the sizes they measure. See docs/cad-dxf.md.';

const TOOLS = [
{
  id: 'rpm', level: 'simple', group: 'Speeds and feeds', title: 'Spindle speed',
  pick: { map: { dia: 'dia' } },
  desc: 'Convert between spindle RPM and surface (cutting) speed.',
  fields: s => [
    { id: 'speed', label: s === 'inch' ? 'Surface speed' : 'Cutting speed Vc', unit: spdU(s), def: s === 'inch' ? 300 : 90 },
    { id: 'dia', label: 'Diameter', unit: lenU(s), def: s === 'inch' ? 0.5 : 12 },
    { id: 'rpm', label: 'Spindle speed', unit: 'RPM', def: '' },
  ],
  // Linked pair: type the surface speed or the RPM; the other is worked out.
  pairs: [['speed', 'rpm', (v, W, s) => s === 'inch' ? W.rpm_from_sfm(v.speed, v.dia) : W.rpm_from_vc(v.speed, v.dia), (v, W, s) => s === 'inch' ? W.sfm_from_rpm(v.rpm, v.dia) : W.vc_from_rpm(v.rpm, v.dia)]],
  calc: (v, W, s) => {
    const rows = [];
    if (v.speed > 0 && v.dia > 0) rows.push(R('Spindle speed', s === 'inch' ? W.rpm_from_sfm(v.speed, v.dia) : W.rpm_from_vc(v.speed, v.dia), 'RPM', 1, 'rpm'));
    if (v.rpm > 0 && v.dia > 0) rows.push(R(s === 'inch' ? 'Surface speed at that RPM' : 'Cutting speed at that RPM', s === 'inch' ? W.sfm_from_rpm(v.rpm, v.dia) : W.vc_from_rpm(v.rpm, v.dia), spdU(s), 1));
    return rows;
  },
  // G-code: the spindle start for this speed (a lathe can also take the surface speed with G96).
  snip: (v, W, s, rows) => { const r = rows.find(x => x.label === 'Spindle speed'), n = r ? r.value : v.rpm; return n > 0 ? { kind: 'words', rpm: n, v: v.speed > 0 ? v.speed : undefined } : null; },
  working: 'Inch: n = 12 x SFM / (pi x D). Metric: n = 1000 x Vc / (pi x D).',
  source: "Machinery's Handbook (speeds and feeds); ISO cutting-speed symbols",
},
{
  id: 'feed', level: 'simple', group: 'Speeds and feeds', title: 'Milling feed rate',
  pick: { map: { z: 'flutes' } },
  desc: 'Table feed from feed per tooth, or the reverse.',
  fields: s => [
    { id: 'rpm', label: 'Spindle speed', unit: 'RPM', def: 3000 },
    { id: 'z', label: 'Number of teeth', unit: '', def: 4 },
    { id: 'fz', label: 'Feed per tooth', unit: lenU(s), def: s === 'inch' ? 0.002 : 0.05 },
    { id: 'vf', label: 'Table feed', unit: feedMinU(s), def: '' },
  ],
  pairs: [['fz', 'vf', (v, W) => W.table_feed(v.rpm, v.fz, v.z), (v, W) => W.feed_per_tooth(v.vf, v.rpm, v.z)]],
  calc: (v, W, s) => {
    const rows = [];
    if (v.rpm > 0 && v.z > 0 && v.fz > 0) rows.push(R('Table feed', W.table_feed(v.rpm, v.fz, v.z), feedMinU(s), 2, 'feed'));
    if (v.rpm > 0 && v.z > 0 && v.vf > 0) rows.push(R('Feed per tooth', W.feed_per_tooth(v.vf, v.rpm, v.z), lenU(s), 4));
    return rows;
  },
  // G-code: spindle start and the feed word for this table feed.
  snip: (v, W, s, rows) => { const r = rows.find(x => x.label === 'Table feed'), f = r ? r.value : v.vf; return f > 0 ? { kind: 'words', lathe: false, rpm: v.rpm, feed: f } : null; },
  working: 'Vf = n x fz x z.',
  source: "Machinery's Handbook; Sandvik Coromant formulas and definitions",
},
{
  id: 'mrr', level: 'advanced', group: 'Speeds and feeds', title: 'Material removal rate and power',
  desc: 'Removal rate in turning, with the power it takes when you enter the specific cutting force kc (the Specific cutting force page gives it for a material). With a machine picked, the power is compared with what its spindle has at the speed of the cut.',
  fields: s => s === 'inch' ? [
    { id: 'speed', label: 'Surface speed', unit: 'SFM', def: 300 },
    { id: 'doc', label: 'Depth of cut', unit: 'in', def: 0.05 },
    { id: 'f', label: 'Feed', unit: 'in/rev', def: 0.005 },
    { id: 'kc', label: 'Specific cutting force kc (optional)', unit: 'N/mm2', def: '' },
    { id: 'eta', label: 'Machine efficiency', unit: '0-1', def: 0.8 },
    { id: 'dia', label: 'Diameter being cut (optional: checks the active machine at that speed)', unit: 'in', def: '' },
  ] : [
    { id: 'speed', label: 'Cutting speed Vc', unit: 'm/min', def: 200 },
    { id: 'doc', label: 'Depth of cut ap', unit: 'mm', def: 2 },
    { id: 'f', label: 'Feed fn', unit: 'mm/rev', def: 0.2 },
    { id: 'kc', label: 'Specific cutting force kc (optional)', unit: 'N/mm2', def: '' },
    { id: 'eta', label: 'Machine efficiency', unit: '0-1', def: 0.8 },
    { id: 'dia', label: 'Diameter being cut (optional: checks the active machine at that speed)', unit: 'mm', def: '' },
  ],
  calc: (v, W, s) => {
    if (!(v.speed > 0 && v.doc > 0 && v.f > 0)) return [];
    const rows = [];
    let q;
    if (s === 'inch') { q = W.mrr_turning_in3_min(v.speed, v.doc, v.f); rows.push(R('Material removal rate', q, 'in3/min', 3)); q = q * 16.387064; }
    else { q = W.mrr_turning_cm3_min(v.speed, v.doc, v.f); rows.push(R('Material removal rate', q, 'cm3/min', 2)); }
    if (v.kc > 0 && v.eta > 0) { const kw = W.power_kw(q, v.kc, v.eta); rows.push(R('Power at the spindle', kw, 'kW', 2, 'power_kw')); rows.push(R('Power at the spindle', kw * 1.34102, 'hp', 2));
      // The active machine: its power at the speed this diameter needs (constant torque up to the base speed, constant power above it).
      const m = typeof advMachine === 'function' ? advMachine(v, false) : null;
      if (m && m.p > 0) {
        const n = v.dia > 0 ? (s === 'inch' ? W.rpm_from_sfm(v.speed, v.dia) : W.rpm_from_vc(v.speed, v.dia)) : NaN;
        const pAv = n > 0 ? W.spindle_power_available_kw(n, m.p, m.t) : m.p, use = W.share_of(kw, pAv);
        if (n > 0) rows.push(R('Spindle speed at that diameter', n, 'RPM', 0));
        rows.push(R(n > 0 ? 'Power ' + m.name + ' has at that speed' : 'Rated spindle power of ' + m.name + ' (enter the diameter to check it at the speed of the cut)', pAv, 'kW', 2));
        rows.push(R('Share of that power', use * 100, '%', 0));
        if (n > 0 && m.n > 0 && n > m.n) rows.push(R('Top speed', 'This diameter needs ' + fmt(n, 0) + ' RPM, more than the top speed of ' + m.name + ' (' + fmt(m.n, 0) + ' RPM): the cut will run slower and take less power than shown', '', 0));
        if (use > 1.0005) rows.push(R('Over the limit', n > 0 && pAv < m.p ? 'Below the base speed the spindle gives torque, not full power: ' + fmt(pAv, 2) + ' kW here. Reduce the depth of cut or the feed, or cut at a higher speed if the tool allows.' : 'The cut needs more power than the spindle has. Reduce the depth of cut or the feed.', '', 0));
      } else rows.push(R('Machine check', 'Pick a machine with its spindle power in the title bar to see the share of its power this cut uses', '', 0));
    }
    return rows;
  },
  working: 'Metric Q = Vc x ap x f (cm3/min). Inch Q = 12 x SFM x DOC x IPR. Power Pc = Q x kc / (60 000 x eta), Q in cm3/min, kc in N/mm2. Machine check: n = 1000 Vc / (pi D) at the diameter being cut; the spindle has P(n) = min(P_max, T_max x 2 pi n / 60 000) kW at that speed; the share is the power at the spindle over P(n).',
  source: "Sandvik Coromant formulas and definitions; Machinery's Handbook",
},
{
  id: 'toollife', level: 'expert', group: 'Speeds and feeds', title: 'Tool life and cost per part',
  desc: 'Taylor tool life (V x T^n = C), cost per part and the tool life for lowest cost. The Taylor exponent n and constant C come from your tool maker or your own shop records; BenchMate does not guess them. Leave them blank and enter a known tool life instead if you have one.',
  fields: s => [
    { id: 'v', label: s === 'inch' ? 'Surface speed V' : 'Cutting speed Vc', unit: spdU(s), def: s === 'inch' ? 600 : 180 },
    { id: 'n', label: 'Taylor exponent n', unit: '', def: '' },
    { id: 'c', label: 'Taylor constant C (speed for 1 min life)', unit: spdU(s), def: '' },
    { id: 't', label: 'Or known tool life at that speed', unit: 'min', def: '' },
    { id: 'tt', label: 'Target tool life (for speed)', unit: 'min', def: '' },
    { id: 'cycle', label: 'Cycle time per part', unit: 'min', def: 3 },
    { id: 'cut', label: 'Cutting time per part (this tool)', unit: 'min', def: 2 },
    { id: 'rate', label: 'Machine and labour rate', unit: 'per hour', def: 60 },
    { id: 'edge', label: 'Tool cost per edge', unit: 'per edge', def: 5 },
    { id: 'tc', label: 'Tool change time', unit: 'min', def: 2 },
    { id: 'mat', label: 'Material cost per part', unit: 'per part', def: 0 },
  ],
  calc: (v, W, s) => {
    const rows = [];
    const taylor = v.n > 0 && v.n < 1 && v.c > 0;
    let life = NaN;
    if (taylor && v.v > 0) { life = W.taylor_life(v.v, v.n, v.c); rows.push(R('Tool life at this speed (Taylor)', life, 'min', 2)); }
    else if (v.t > 0) life = v.t;
    if (taylor && v.tt > 0) rows.push(R('Speed for target tool life', W.taylor_speed(v.tt, v.n, v.c), spdU(s), 1));
    const ratePerMin = v.rate / 60;
    if (life > 0 && v.cycle > 0 && v.cut > 0 && v.rate >= 0 && v.edge >= 0) {
      rows.push(R('Parts per edge', Math.floor(life / v.cut), '', 0));
      rows.push(R('Cost per part', W.cost_per_part(v.cycle, ratePerMin, v.edge, v.cut, life, v.mat > 0 ? v.mat : 0), 'per part', 2));
    }
    if (v.n > 0 && v.n < 1 && ratePerMin > 0 && v.edge >= 0 && v.tc >= 0) {
      const te = W.economic_tool_life(v.n, v.edge, ratePerMin, v.tc);
      rows.push(R('Tool life for lowest cost', te, 'min', 2));
      if (v.c > 0) rows.push(R('Speed for lowest cost', W.taylor_speed(te, v.n, v.c), spdU(s), 1));
      const tp = W.max_production_tool_life(v.n, v.tc);
      rows.push(R('Tool life for fastest production', tp, 'min', 2));
      if (v.c > 0 && tp > 0) rows.push(R('Speed for fastest production', W.taylor_speed(tp, v.n, v.c), spdU(s), 1));
    }
    return rows;
  },
  working: 'Taylor: V x T^n = C, so T = (C / V)^(1/n) and V = C / T^n. Cost per part = cycle time x rate + tool cost per edge x cutting time / tool life + material. Lowest-cost tool life T = (1/n - 1) x (tool cost per edge / rate per min + tool change time); fastest-production T = (1/n - 1) x tool change time. Cycle time is taken as entered: if you change speed, re-enter the new cycle and cutting times.',
  source: "F. W. Taylor (1907); W. W. Gilbert, Economics of Machining (ASM, 1950); Machinery's Handbook (machining econometrics)",
},
{
  id: 'arcfeed', level: 'advanced', group: 'Milling', title: 'Arc feed correction',
  pick: { map: { d: 'dia' } },
  desc: 'Programmed tool-centre feed so the cutting edge runs at the feed you want on an arc. Inside arcs need a slower centre feed, outside arcs a faster one.',
  fields: s => [
    { id: 'fe', label: 'Desired feed at the cutting edge', unit: feedMinU(s), def: s === 'inch' ? 20 : 500 },
    { id: 'R', label: 'Part arc radius', unit: lenU(s), def: s === 'inch' ? 0.75 : 20 },
    { id: 'd', label: 'Tool diameter', unit: lenU(s), def: s === 'inch' ? 0.5 : 12 },
  ],
  calc: (v, W, s) => {
    if (!(v.fe > 0 && v.R > 0 && v.d > 0)) return [];
    const r = v.d / 2, rows = [];
    if (v.R > r) {
      rows.push(R('Internal arc: tool-centre feed', W.arc_feed_internal(v.fe, v.R, r), feedMinU(s), 2));
      rows.push(R('Internal arc: ratio (R - r) / R', W.arc_feed_internal(1, v.R, r), '', 4));
    } else rows.push(R('Internal arc', 'Tool radius must be smaller than the arc radius', '', 0));
    rows.push(R('External arc: tool-centre feed', W.arc_feed_external(v.fe, v.R, r), feedMinU(s), 2));
    rows.push(R('External arc: ratio (R + r) / R', W.arc_feed_external(1, v.R, r), '', 4));
    return rows;
  },
  working: 'r = tool diameter / 2. Internal arc Fc = Fe x (R - r) / R. External arc Fc = Fe x (R + r) / R. R is the radius the cutting edge follows on the part.',
  source: "Sandvik Coromant milling formulas (circular and helical interpolation); Machinery's Handbook",
},
{
  id: 'helix', level: 'advanced', group: 'Milling', title: 'Helical interpolation and ramping',
  pick: { map: { d: 'dia' } },
  desc: 'Helix pitch per turn from a ramp angle, or the ramp angle from a pitch, and the axial (Z) feed. Angles are at the tool-centre path.',
  fields: s => [
    { id: 'mode', label: 'Feature', unit: '', def: 1, options: [[1, 'Hole (inside)'], [2, 'Boss (outside)']] },
    { id: 'D', label: 'Hole or boss diameter', unit: lenU(s), def: s === 'inch' ? 0.75 : 20 },
    { id: 'd', label: 'Tool diameter', unit: lenU(s), def: s === 'inch' ? 0.5 : 12 },
    { id: 'ang', label: 'Ramp angle', unit: 'deg', def: 3 },
    { id: 'pitch', label: 'Or known pitch per turn', unit: lenU(s), def: '' },
    { id: 'vf', label: 'Programmed feed (tool centre)', unit: feedMinU(s), def: s === 'inch' ? 20 : 500 },
  ],
  calc: (v, W, s) => {
    if (!(v.D > 0 && v.d > 0)) return [];
    const path = v.mode === 2 ? W.helix_path_dia_external(v.D, v.d) : W.helix_path_dia_internal(v.D, v.d);
    if (!(path > 0)) return [R('Tool path', 'Tool must be smaller than the hole', '', 0)];
    const rows = [R('Tool-centre path diameter', path, lenU(s), 4)];
    let ang = NaN;
    if (v.pitch > 0) { ang = W.helix_ramp_deg(path, v.pitch); rows.push(R('Ramp angle for that pitch', ang, 'deg', 3)); }
    else if (v.ang > 0 && v.ang < 90) { ang = v.ang; rows.push(R('Pitch per turn', W.helix_pitch(path, ang), lenU(s), 4)); }
    if (ang > 0 && v.vf > 0) {
      rows.push(R('Axial feed (F applies to the arc in the plane)', W.helix_axial_feed_plane(v.vf, ang), feedMinU(s), 3));
      rows.push(R('Axial feed (F applies along the helix path)', W.helix_axial_feed_path(v.vf, ang), feedMinU(s), 3));
    }
    return rows;
  },
  working: 'Hole: Dpath = Dhole - Dtool. Boss: Dpath = Dboss + Dtool. Pitch = pi x Dpath x tan(angle); angle = atan(pitch / (pi x Dpath)). Axial feed = F x tan(angle) when the control applies F to the circular move in the plane (usual ISO/Fanuc default), or F x sin(angle) when F applies along the full helix path. Check your control manual. For the cutting-edge feed in a hole, use Arc feed correction.',
  source: "Sandvik Coromant milling formulas (circular ramping, helical interpolation); Machinery's Handbook (helix geometry)",
},
{
  id: 'deflection', level: 'advanced', group: 'Milling', title: 'Tool deflection',
  pick: { map: { d: 'dia', dsh: 'shank', L: 'stick', lf: 'flute_len', mat: 'material' }, clear: ['dsh', 'lf'] },
  desc: 'Tip deflection of an end mill under a side (radial) force, modelled as a cantilever clamped at the holder face: solid shank, then the fluted length at an effective diameter. Enter the force, or estimate it from cutting power. The radial-to-tangential force ratio depends on engagement and tool geometry; it is yours to enter, BenchMate does not guess it.',
  fields: s => toolGeomFields(s).concat([
    { id: 'F', label: 'Radial force (if known)', unit: s === 'inch' ? 'lbf' : 'N', def: '' },
    { id: 'pc', label: 'Or net cutting power at the cut', unit: 'kW', def: '' },
    { id: 'vc', label: s === 'inch' ? 'Surface speed' : 'Cutting speed Vc', unit: spdU(s), def: '' },
    { id: 'ratio', label: 'Radial / tangential force ratio Fr/Ft', unit: '', def: '' },
    { level: 'advanced', id: 'kh', label: 'Holder and spindle stiffness at the holder face (blank = active machine, else rigid)', unit: 'N/µm', def: '' },
    { level: 'advanced', id: 'pf', label: 'Or a push test: force on the holder', unit: s === 'inch' ? 'lbf' : 'N', def: '' },
    { level: 'advanced', id: 'pd', label: 'Push test: indicator reading at the holder', unit: lenU(s), def: '' },
  ]),
  calc: (v, W, s) => {
    const g = toolGeom(v, s), k = s === 'inch' ? IN_MM : 1, fU = s === 'inch' ? 'lbf' : 'N', fk = s === 'inch' ? LBF_N : 1;
    if (!(g.d > 0 && g.L > 0 && g.e > 0)) return [];
    const khT = v.pf > 0 && v.pd > 0 ? W.stiffness_n_um(v.pf * fk, v.pd * k) : NaN, khA = advHolderK(v), kh = v.kh > 0 ? v.kh : khT > 0 ? khT : khA[0];
    const rows = [R("Young's modulus used (" + g.eSrc + ')', g.eShow, g.eU, g.eDp)];
    const ds = g.dsh || g.d;
    if (g.lf > 0 && !(g.kf > 0)) return rows.concat([R('Flute section', 'Enter the effective flute diameter / D (see the note below), or blank the flute length to treat the tool as solid', '', 0)]);
    const df = g.lf > 0 ? g.kf * g.d : ds;
    rows.push(R(g.lf > 0 ? 'Effective flute diameter (approximation)' : 'Section diameter (solid)', df / k, lenU(s), 4));
    let F = NaN;
    if (v.F > 0) F = v.F * fk;
    else if (v.pc > 0 && v.vc > 0) {
      const ft = W.tangential_force_n(v.pc, s === 'inch' ? v.vc * FT_M : v.vc);
      rows.push(R('Mean tangential force Ft', ft / fk, fU, 1));
      if (v.ratio > 0) { F = v.ratio * ft; rows.push(R('Radial force Fr = ratio x Ft', F / fk, fU, 1)); }
      else rows.push(R('Radial force', 'Enter the Fr/Ft ratio for your cut', '', 0));
    }
    if (F > 0) {
      const dT = W.tool_deflection_mm(F, g.L, g.lf, ds, df, g.e), d = W.tool_and_holder_deflection_mm(F, g.L, g.lf, ds, df, g.e, kh);
      rows.push(R(kh > 0 ? 'Tip deflection (tool and holder)' : 'Tip deflection', d / k, lenU(s), s === 'inch' ? 5 : 4));
      rows.push(R('Tip deflection', s === 'inch' ? d / k * 1000 : d * 1000, s === 'inch' ? 'thou' : 'um', s === 'inch' ? 2 : 1));
      if (kh > 0) {
        rows.push(R('Of which the tool bending', dT / k, lenU(s), s === 'inch' ? 5 : 4), R('Of which the holder and spindle giving way', W.holder_deflection_mm(F, kh) / k, lenU(s), s === 'inch' ? 5 : 4));
        rows.push(R('Holder and spindle stiffness used (' + (v.kh > 0 ? 'entered' : khT > 0 ? 'from the push test' : 'from ' + khA[1]) + ')', kh, 'N/µm', 1));
      }
    }
    if (!(kh > 0)) rows.push(R('Holder and spindle', 'Taken as rigid. A real holder and spindle give a little: in Advanced enter their stiffness, or a push test (pull on the holder with a known force and read an indicator on it).', '', 0));
    return rows;
  },
  working: 'I = pi d^4 / 64. Two-section cantilever, load F at the tip, stick-out L, fluted length a from the tip: deflection = F / (3 E) x [ (L^3 - a^3) / I_shank + a^3 / I_flute ]. With no flutes (or equal diameters) this is F L^3 / (3 E I). Force from power: Ft = Pc x 60 000 / Vc (Pc in kW at the cut, Vc in m/min, Ft in N); Fr = (Fr/Ft) x Ft. The effective flute diameter is an approximation for the reduced section of the fluted part. Holder, collet and spindle flex are left out unless you enter a stiffness k for them (N/um at the holder face): then the holder face moves F / k and that is added to the bending of the tool (springs in series). A push test gives k = force / indicator reading. Only the sideways give is covered, not the tilt of the holder, so a real setup still deflects a little more. The load is put at the tip, which overstates deflection a little for shallow cuts. E presets: solid carbide 580 GPa (Ceratizit grade CTS20L, 10% Co; carbide grades span about 490-670 GPa in Tungaloy and Ceratizit grade tables, so use your tool maker\'s figure if you have it); HSS 219 GPa (voestalpine data sheet for M2, 1.3343, at 20 C). The effective flute diameter / D is left blank: enter your tool maker\'s figure or your own measured value.',
  source: "Cantilever and stepped (nonprismatic) beam deflection: Gere and Goodno, Mechanics of Materials; Roark's Formulas for Stress and Strain (Ch. 8). Equivalent flute diameter concept: Kops and Vo, CIRP Annals 1990. Force from power: Sandvik Coromant milling formulas. E presets: Ceratizit and voestalpine grade data (docs/sources.md).",
},
{
  id: 'cutopt', level: 'expert', group: 'Milling', title: 'Cut check and optimiser',
  pick: { map: { d: 'dia', dsh: 'shank', L: 'stick', lf: 'flute_len', mat: 'material', z: 'flutes' }, clear: ['dsh', 'lf'] },
  desc: 'Checks a milling cut for speed, feed, removal rate, power, torque and tool deflection against your limits and the active machine, shows which limit binds first, then finds the largest depth (ap) for your width (ae), or the largest width for your depth, inside every limit. kc and the Fr/Ft ratio are yours to enter; BenchMate does not guess them.',
  fields: s => [
    { id: 'mode', label: 'Optimise', unit: '', def: 0, options: [[0, 'Largest ap for this ae'], [1, 'Largest ae for this ap']] },
  ].concat(toolGeomFields(s), [
    { id: 'z', label: 'Number of flutes', unit: '', def: 3 },
    { id: 'ae', label: 'Radial width ae', unit: lenU(s), def: s === 'inch' ? 0.1 : 2.4 },
    { id: 'ap', label: 'Axial depth ap', unit: lenU(s), def: s === 'inch' ? 0.5 : 12 },
    { id: 'fz', label: 'Feed per tooth fz', unit: lenU(s), def: s === 'inch' ? 0.002 : 0.05 },
    { id: 'speed', label: s === 'inch' ? 'Surface speed' : 'Cutting speed Vc', unit: spdU(s), def: s === 'inch' ? 500 : 150 },
    { id: 'rpm', label: 'Or spindle speed (wins over speed)', unit: 'RPM', def: '' },
    { id: 'kc', label: 'Specific cutting force kc', unit: 'N/mm2', def: '' },
    { id: 'eta', label: 'Machine efficiency', unit: '0-1', def: 0.8 },
    { id: 'ratio', label: 'Radial / tangential force ratio Fr/Ft', unit: '', def: '' },
    { id: 'F', label: 'Or radial force at this cut', unit: s === 'inch' ? 'lbf' : 'N', def: '' },
    { id: 'lim', label: 'Deflection limit', unit: lenU(s), def: '' },
    { id: 'pmax', label: 'Spindle power limit (blank = active machine)', unit: 'kW', def: '' },
    { id: 'tmax', label: 'Spindle torque limit (blank = active machine)', unit: 'N·m', def: '' },
    { id: 'kh', label: 'Holder and spindle stiffness at the holder face (blank = active machine, else rigid)', unit: 'N/µm', def: '' },
  ]),
  calc: (v, W, s) => {
    const g = toolGeom(v, s), k = s === 'inch' ? IN_MM : 1, fk = s === 'inch' ? LBF_N : 1, fU = s === 'inch' ? 'lbf' : 'N';
    if (!(g.d > 0 && v.z > 0 && v.ae > 0 && v.ap > 0 && v.fz > 0)) return [];
    const vc = v.rpm > 0 ? W.vc_from_rpm(v.rpm, g.d) : (s === 'inch' ? v.speed * FT_M : v.speed);
    if (!(vc > 0)) return [];
    const m = typeof Profiles !== 'undefined' ? Profiles.active() : null;
    const mnum = x => (x === '' || x == null) ? 0 : (Number(x) > 0 ? Number(x) : 0);
    const pmax = v.pmax > 0 ? v.pmax : (m ? mnum(m.power_kw) : 0);
    const tmax = v.tmax > 0 ? v.tmax : (m ? mnum(m.torque_nm) : 0);
    const pSrc = v.pmax > 0 ? 'entered' : (m && pmax > 0 ? m.name : '');
    const z0 = x => x > 0 ? x : 0;
    const args = ap => [g.d, g.dsh, z0(g.L), g.lf, g.kf, z0(g.e), v.z, v.ae * k, ap, v.fz * k, vc, z0(v.kc), z0(v.eta), z0(v.ratio), z0(v.F) * fk, z0(v.lim) * k, pmax, tmax, advHolderK(v)[0]];
    const a = args(v.ap * k), C = i => W.cut_check(...a, i);
    const rpm = C(0), vf = C(1), q = C(2), pNet = C(3), pSp = C(4), tq = C(5), ft = C(6), fr = C(7), defl = C(8), pAv = C(9), bind = C(10);
    const rows = [
      R('Spindle speed', rpm, 'RPM', 0, 'rpm'),
      R('Table feed', vf / k, feedMinU(s), s === 'inch' ? 2 : 0, 'feed'),
      R('Material removal rate', s === 'inch' ? q / IN3_CM3 : q, s === 'inch' ? 'in3/min' : 'cm3/min', 2),
      R('Mean chip thickness hm (exact arc average)', W.chip_thickness_mean(v.fz, v.ae, v.d), lenU(s), s === 'inch' ? 5 : 4),
      R('Max chip thickness hex', W.chip_thickness_max(v.fz, v.ae, v.d), lenU(s), s === 'inch' ? 5 : 4),
    ];
    if (v.kc > 0) {
      rows.push(R('Power at the cut (net)', pNet, 'kW', 3));
      if (v.eta > 0) {
        rows.push(R('Power at the spindle', pSp, 'kW', 3, 'power_kw', { rpm }));
        if (s === 'inch') rows.push(R('Power at the spindle', pSp * KW_HP, 'hp', 3));
        rows.push(R('Spindle torque', tq, 'N·m', 2));
      }
      rows.push(R('Mean tangential force Ft', ft / fk, fU, 1));
    } else rows.push(R('Power, torque, force', 'Enter kc for your material (tool maker or handbook)', '', 0));
    if (isFinite(fr)) rows.push(R('Radial force used', fr / fk, fU, 1));
    if (g.lf > 0 && !(g.kf > 0)) rows.push(R('Deflection', 'Enter the effective flute diameter / D, or blank the flute length', '', 0));
    else if (isFinite(defl)) {
      rows.push(R("Young's modulus used (" + g.eSrc + ')', g.eShow, g.eU, g.eDp));
      rows.push(R(advHolderK(v)[0] > 0 ? 'Tool tip deflection (tool bending and the holder giving way)' : 'Tool tip deflection (holder and spindle taken as rigid)', defl / k, lenU(s), s === 'inch' ? 5 : 4));
    }
    else if (!(v.F > 0 || v.ratio > 0)) rows.push(R('Deflection', 'Enter the Fr/Ft ratio or the radial force', '', 0));
    if (pmax > 0) rows.push(R('Spindle power available at this speed (' + pSrc + ')', pAv, 'kW', 3));
    [1, 2, 3].forEach(i => { const u = C(10 + i); if (isFinite(u)) rows.push(R(LIMIT_NAMES[i] + ': share of limit used', u * 100, '%', 1)); });
    rows.push(R('Binds first', bind > 0 ? LIMIT_NAMES[bind] : 'No limits to check (enter a deflection limit or machine power)', '', 0));
    // Optimiser: largest ap (or ae) inside every limit.
    const vary = v.mode === 1 ? 1 : 0;
    const x = W.cut_optimise(...a, vary, 0), lk = W.cut_optimise(...a, vary, 1);
    if (isFinite(x) && lk > 0) {
      const name = vary ? 'ae' : 'ap';
      rows.push(R('Largest ' + name + ' inside the limits', x / k, lenU(s), s === 'inch' ? 4 : 2));
      rows.push(R('Set by', LIMIT_NAMES[lk], '', 0));
      const b = vary ? [...a.slice(0, 7), x, ...a.slice(8)] : args(x);
      const Cb = i => W.cut_check(...b, i);
      const qb = Cb(2);
      rows.push(R('Removal rate at that ' + name, s === 'inch' ? qb / IN3_CM3 : qb, s === 'inch' ? 'in3/min' : 'cm3/min', 2));
      if (v.kc > 0 && v.eta > 0) rows.push(R('Power at the spindle at that ' + name, Cb(4), 'kW', 3, 'power_kw', { rpm }));
      if (isFinite(Cb(8))) rows.push(R('Deflection at that ' + name, Cb(8) / k, lenU(s), s === 'inch' ? 5 : 4));
    }
    return rows;
  },
  working: 'n = 1000 Vc / (pi D). Vf = n x fz x z. Q = ae x ap x Vf. Pc = Q x kc / 60 000 (Q cm3/min, kc N/mm2, kW); spindle power = Pc / efficiency; torque T = P x 60 000 / (2 pi n). Ft = Pc x 60 000 / Vc; Fr = (Fr/Ft) x Ft or as entered. Deflection: two-section cantilever as in Tool deflection. Power available P(n) = min(P_max, T_max x 2 pi n / 60 000); below base speed the torque limit is the one that binds. Chip thickness, engagement angle phi = acos(1 - 2 ae / D): hex = fz sin(phi) (fz when ae >= D/2), hm = fz (1 - cos phi) / phi (exact arc average; tends to fz sqrt(ae/D) for small ae). Optimiser: with kc taken as constant, removal rate, power, torque, force and deflection are all proportional to ap at fixed ae (and to ae at fixed ap), so each limit allows (current value) / (share of the limit used); the smallest wins. Caps: ap <= flute length, ae <= D. The force you enter directly is scaled the same way. Real kc rises as chips get thinner, so check the result. E presets: solid carbide 580 GPa (Ceratizit grade CTS20L, 10% Co; carbide grades span about 490-670 GPa in Tungaloy and Ceratizit grade tables, so use your tool maker\'s figure if you have it); HSS 219 GPa (voestalpine data sheet for M2, 1.3343, at 20 C). The effective flute diameter / D is left blank: enter your tool maker\'s figure or your own measured value.',
  source: "Sandvik Coromant milling formulas (n, Vf, Q, Pc, hm); Machinery's Handbook; Altintas, Manufacturing Automation, Ch. 2 (chip thickness); Gere and Goodno / Roark (beam deflection); machine limits from the active machine profile or entered here.",
},
{
  id: 'chipthin', level: 'advanced', group: 'Milling', title: 'Radial chip thinning feed',
  pick: { map: { d: 'dia', z: 'flutes' } },
  desc: 'With a radial width (stepover) below half the diameter the chip is thinner than the feed per tooth. Enter the chip thickness your tool maker recommends and get the feed per tooth that gives it at your stepover.',
  fields: s => [
    { id: 'd', label: 'Tool diameter D', unit: lenU(s), def: s === 'inch' ? 0.5 : 12 },
    { id: 'ae', label: 'Radial width ae (stepover)', unit: lenU(s), def: s === 'inch' ? 0.05 : 1.2 },
    { id: 'hex', label: 'Target max chip thickness hex (tool maker\'s chip load)', unit: lenU(s), def: '' },
    { id: 'z', label: 'Number of teeth (for table feed)', unit: '', def: '' },
    { id: 'rpm', label: 'Spindle speed (for table feed)', unit: 'RPM', def: '' },
  ],
  calc: (v, W, s) => {
    if (!(v.d > 0 && v.ae > 0)) return [];
    const k = W.rctf(v.ae, v.d), dp = s === 'inch' ? 5 : 4;
    const rows = [R('Engagement angle', W.mt_engagement_deg(v.ae, v.d), 'deg', 2), R('ae / D', 100 * v.ae / v.d, '%', 1), R('Chip thinning factor (RCTF)', k, 'x', 3)];
    if (v.ae >= v.d / 2) rows.push(R('Chip thinning', 'None: at ae >= D/2 the chip reaches the feed per tooth', '', 0));
    if (v.hex > 0) {
      const fz = v.hex * k; rows.push(R('Feed per tooth for that chip', fz, lenU(s), dp));
      if (v.z > 0 && v.rpm > 0) rows.push(R('Table feed', W.table_feed(v.rpm, fz, v.z), feedMinU(s), 2, 'feed'));
    } else rows.push(R('Feed per tooth', 'Enter the target chip thickness', '', 0));
    return rows;
  },
  working: 'Engagement phi = acos(1 - 2 ae / D). Max chip hex = fz sin(phi) for ae < D/2, so fz = hex x RCTF with RCTF = 1 / sin(phi) = 1 / sqrt(1 - (1 - 2 ae / D)^2). At ae >= D/2 the chip reaches fz and RCTF = 1. Vf = n x z x fz. Very large factors at tiny stepovers push the tool hard on entry and amplify any runout; check the result against the tool maker\'s maximum feed.',
  source: 'Machining Doctor chip thinning calculator (RCTF); Altintas, Manufacturing Automation, Ch. 2 (h = c sin phi). See docs/sources.md.',
},
{
  id: 'cornerfeed', level: 'advanced', group: 'Milling', title: 'Corner engagement and feed',
  pick: { map: { d: 'dia', z: 'flutes' } },
  desc: 'In an inside corner (or round a boss) the same stepover wraps more (or less) of the tool. Shows the engagement on the arc against the straight wall, and the feed per tooth that keeps the chip the same as on the straight wall.',
  fields: s => [
    { id: 'mode', label: 'Wall', unit: '', def: 1, options: [[1, 'Inside corner (pocket)'], [0, 'Outside (boss, convex arc)']] },
    { id: 'd', label: 'Tool diameter D', unit: lenU(s), def: s === 'inch' ? 0.5 : 12 },
    { id: 'Rw', label: 'Corner (arc) radius of the finished wall', unit: lenU(s), def: s === 'inch' ? 0.375 : 10 },
    { id: 'ae', label: 'Radial width ae on the straight wall', unit: lenU(s), def: s === 'inch' ? 0.05 : 1.2 },
    { id: 'fz', label: 'Feed per tooth on the straight wall', unit: lenU(s), def: '' },
    { id: 'z', label: 'Number of teeth (for table feed)', unit: '', def: '' },
    { id: 'rpm', label: 'Spindle speed (for table feed)', unit: 'RPM', def: '' },
  ],
  calc: (v, W, s) => {
    if (!(v.d > 0 && v.ae > 0 && v.Rw > 0)) return [];
    const inside = v.mode === 1, dp = s === 'inch' ? 5 : 4;
    const p0 = W.mt_engagement_deg(v.ae, v.d), p1 = W.engagement_arc_deg(v.ae, v.d, v.Rw, inside ? 1 : 0);
    if (!isFinite(p1)) return [R('Corner', 'The tool radius must be smaller than the corner radius', '', 0)];
    const rows = [R('Engagement on the straight wall', p0, 'deg', 2), R('Engagement on the arc', p1, 'deg', 2)];
    const r = rad => rad * Math.PI / 180;
    const h0 = Math.min(1, Math.sin(r(Math.min(p0, 90)))), h1 = Math.min(1, Math.sin(r(Math.min(p1, 90))));
    rows.push(R('Chip on the arc / chip on the straight', h1 / h0, 'x', 3));
    if (v.fz > 0) {
      const hex = W.hex_for_engagement(v.fz, r(p0)), fz1 = hex / h1;
      rows.push(R('Max chip on the straight wall', hex, lenU(s), dp));
      rows.push(R('Feed per tooth on the arc for the same chip', fz1, lenU(s), dp));
      if (v.z > 0 && v.rpm > 0) {
        const fe = W.table_feed(v.rpm, fz1, v.z), rt = v.d / 2;
        rows.push(R('Feed at the cutting edge on the arc', fe, feedMinU(s), 2));
        rows.push(R('Programmed tool-centre feed on the arc', inside ? W.arc_feed_internal(fe, v.Rw, rt) : W.arc_feed_external(fe, v.Rw, rt), feedMinU(s), 2, 'feed'));
      }
    }
    if (p1 > 120) rows.push(R('Note', 'Engagement over 120 deg: consider a smaller tool, a larger corner radius or a roll-in (trochoidal) path', '', 0));
    return rows;
  },
  working: 'Straight wall: phi = acos(1 - 2 ae / D). Arc of radius R at the finished wall, tool radius r: inside corner, tool centre at R - r and the previous wall at R - ae: cos phi = ((R - ae)^2 - (R - r)^2 - r^2) / (2 r (R - r)); outside, centre at R + r and previous wall at R + ae: cos phi = ((R + r)^2 + r^2 - (R + ae)^2) / (2 r (R + r)) (law of cosines in the triangle arc centre, tool centre, edge of the previous wall; both tend to the straight-wall angle as R grows). Max chip = fz sin(phi), fz once phi >= 90 deg, so the feed per tooth for the same chip is fz x sin(phi_straight) / sin(phi_arc). The tool-centre feed then uses the arc feed correction (R - r) / R inside, (R + r) / R outside. A sharp corner entered on a straight line is not an arc: there the engagement peaks briefly higher.',
  source: 'Engagement and chip thickness: Altintas, Manufacturing Automation, Ch. 2; arc feed: Sandvik Coromant milling formulas (circular interpolation). The arc engagement is derived here by the law of cosines and checked in the core tests against a brute-force sample of the tool circle.',
},
{
  id: 'chamfermill', level: 'advanced', group: 'Milling', title: 'Chamfer mill: depth and offset',
  desc: 'Where to put a chamfer mill to cut a chamfer of a given width on an outside edge: the depth of the tip below the top face and the distance of the tool centre from the wall, keeping the tip clear of the cut, with the cutting diameter for the speed and the widest chamfer the tool can reach.',
  fields: s => [
    { id: 'w', label: 'Chamfer width (along the top face)', unit: lenU(s), def: s === 'inch' ? 0.03 : 1 },
    { id: 'ang', label: 'Tool included angle', unit: 'deg', def: 90, options: [[60, '60 deg'], [82, '82 deg'], [90, '90 deg (45 deg chamfer)'], [100, '100 deg'], [120, '120 deg']] },
    { id: 'tip', label: 'Tip flat diameter (0 for a sharp point)', unit: lenU(s), def: 0 },
    { id: 'c', label: 'Clearance past the tip', unit: lenU(s), def: s === 'inch' ? 0.02 : 0.5 },
    { id: 'd', label: 'Cutter diameter (optional)', unit: lenU(s), def: '', level: 'advanced' },
  ],
  calc: (v, W, s) => {
    const c = v.c > 0 ? v.c : 0, tip = v.tip > 0 ? v.tip : 0, d = v.d > 0 ? v.d : 0;
    const z = W.chamfer_mill(v.w, v.ang, tip, c, d, 0);
    if (!isFinite(z)) return [];
    const rows = [R('Tip below the top face (Z depth)', z, lenU(s), 4), R('Tool centre out from the wall', W.chamfer_mill(v.w, v.ang, tip, c, d, 1), lenU(s), 4),
      R('Chamfer depth down the wall', W.chamfer_mill(v.w, v.ang, tip, c, d, 4), lenU(s), 4), R('Cutting diameter at the top of the chamfer', W.chamfer_mill(v.w, v.ang, tip, c, d, 3), lenU(s), 4)];
    if (d > 0) {
      const max = W.chamfer_mill(v.w, v.ang, tip, c, d, 2);
      if (isFinite(max)) {
        rows.push(R('Widest chamfer this cutter reaches', max, lenU(s), 4));
        if (v.w > max) rows.push(R('Note', 'The chamfer is wider than this cutter can reach with that clearance: use a larger cutter or less clearance', '', 0));
      } else rows.push(R('Note', 'The cutter diameter must be larger than the tip flat', '', 0));
    }
    rows.push(R('Note', 'Work out the speed from the cutting diameter shown, not the cutter diameter. With cutter compensation, program the wall and put the centre distance in as the tool radius', '', 0));
    return rows;
  },
  working: 'A chamfer mill is a cone. Its radius at a height z above the tip is tip/2 + z tan(angle/2). Put the bottom of the chamfer on the cone a clearance c out from the edge of the tip flat, so the tip itself does not cut: the tool centre is then tip/2 + c out from the wall, and the tip is (w + c) / tan(angle/2) below the top face. The chamfer runs w / tan(angle/2) down the wall; the cone is tip + 2 (w + c) across where it meets the top face.',
  source: 'BenchMate geometry of a cone, with tests in core/src/millturn.rs. The limit radius - tip radius - clearance for the chamfer width matches the depth rule printed in M. Deans, "10 milling toolpaths for your first 2D CNC machining project", Autodesk Fusion blog, 2018.',
  proof: [{ name: '1.5 mm chamfer, 90 degree tool with a 2 mm tip flat, 0.5 mm clearance, 10 mm cutter', sys: 'mm', vals: { w: 1.5, ang: 90, tip: 2, c: 0.5, d: 10 },
    expect: [['Tip below the top face (Z depth)', 'mm', 2, 1e-9], ['Tool centre out from the wall', 'mm', 1.5, 1e-9], ['Cutting diameter at the top of the chamfer', 'mm', 6, 1e-9], ['Widest chamfer this cutter reaches', 'mm', 3.5, 1e-9]],
    source: 'Cone geometry: at 45 degrees a side the tool is as wide as it is deep.', note: 'Radius at the bottom of the chamfer 1 + 0.5 = 1.5 mm (the centre distance); at the top 1.5 + 1.5 = 3 mm, so 6 mm across; depth (1.5 + 0.5) / tan 45 = 2 mm; reach 5 - 1 - 0.5 = 3.5 mm.' }],
},
{
  id: 'ballcusp', level: 'advanced', group: 'Milling', title: 'Ball-nose cusp height and stepover',
  pick: { map: { d: 'dia' }, types: ['Ball end mill', 'Other'] },
  desc: 'Scallop (cusp) height left between passes of a ball-nose tool on a flat or gently curved surface, or the stepover for the cusp you want.',
  fields: s => [
    { id: 'd', label: 'Ball diameter D', unit: lenU(s), def: s === 'inch' ? 0.25 : 6 },
    { id: 'st', label: 'Stepover', unit: lenU(s), def: s === 'inch' ? 0.01 : 0.25 },
    { id: 'h', label: 'Cusp height', unit: s === 'inch' ? 'in' : 'mm', def: '' },
  ],
  pairs: [['st', 'h', (v, W) => W.cusp_height(v.d / 2, v.st), (v, W) => W.stepover_for_cusp(v.d / 2, v.h)]],
  calc: (v, W, s) => {
    if (!(v.d > 0)) return [];
    const r = v.d / 2, rows = [], k = s === 'inch' ? 1e6 : 1000, mu = s === 'inch' ? 'uin' : 'um';
    if (v.st > 0) {
      const h = W.cusp_height(r, v.st);
      if (isFinite(h)) { rows.push(R('Cusp height', h, lenU(s), s === 'inch' ? 6 : 5)); rows.push(R('Cusp height', h * k, mu, 2)); rows.push(R('Stepover / D', 100 * v.st / v.d, '%', 1)); }
      else rows.push(R('Cusp height', 'Stepover larger than the ball diameter', '', 0));
    }
    if (v.h > 0) {
      const st = W.stepover_for_cusp(r, v.h);
      if (isFinite(st)) { rows.push(R('Stepover for the target cusp', st, lenU(s), s === 'inch' ? 5 : 4)); rows.push(R('Stepover / D', 100 * st / v.d, '%', 1)); }
      else rows.push(R('Stepover', 'Cusp height larger than the ball radius', '', 0));
    }
    return rows;
  },
  working: 'Cusp h = R - sqrt(R^2 - (s/2)^2), R = D/2, s = stepover; stepover for a cusp h: s = 2 sqrt(2 R h - h^2). For small stepovers h is close to s^2 / (8 R). This is for passes side by side on a flat surface; on a slope across the stepover the cusp grows, on a slope along the feed it does not.',
  source: 'Circle geometry; the small-stepover form s^2 / (8 R) as printed by IMCO Carbide Tool (Adjustments for ball nose endmills). See docs/sources.md.',
},
{
  id: 'balleff', level: 'advanced', group: 'Milling', title: 'Ball-nose effective diameter, speed and feed',
  pick: { map: { d: 'dia', z: 'flutes' }, types: ['Ball end mill', 'Other'] },
  desc: 'At a shallow depth a ball-nose tool cuts on a smaller diameter than its size. Gives that effective diameter (with the tool tilted, if it is), the spindle speed for your cutting speed at it, and the feed per tooth that restores the chip.',
  fields: s => [
    { id: 'd', label: 'Ball diameter D', unit: lenU(s), def: s === 'inch' ? 0.5 : 12 },
    { id: 'ap', label: 'Depth of cut ap (normal to the surface)', unit: lenU(s), def: s === 'inch' ? 0.02 : 0.5 },
    { id: 'tilt', label: 'Tool tilt from the surface normal (0 = axis square to the surface)', unit: 'deg', def: 0 },
    { id: 'speed', label: s === 'inch' ? 'Surface speed wanted at the effective diameter' : 'Cutting speed Vc wanted at the effective diameter', unit: spdU(s), def: '' },
    { id: 'fz', label: 'Chip load wanted (tool maker\'s fz)', unit: lenU(s), def: '' },
    { id: 'z', label: 'Number of teeth', unit: '', def: '' },
  ],
  calc: (v, W, s) => {
    if (!(v.d > 0 && v.ap > 0)) return [];
    const t = v.tilt > 0 ? v.tilt : 0, de = W.ball_eff_dia(v.d, v.ap, t), dmin = W.ball_min_dia(v.d, v.ap, t), dp = s === 'inch' ? 4 : 3;
    if (!isFinite(de)) return [R('Tilt', 'Enter a tilt from 0 to under 90 deg', '', 0)];
    const rows = [R('Effective (largest) cutting diameter', de, lenU(s), dp), R('Smallest diameter in the cut', dmin, lenU(s), dp)];
    if (dmin === 0) rows.push(R('Tool centre', 'In the cut: the centre point (zero speed) rubs; tilt the tool more than ' + (Math.acos(1 - 2 * Math.min(v.ap / v.d, 1)) * 180 / Math.PI).toFixed(1) + ' deg to lift it out', '', 0));
    let rpm = NaN;
    if (v.speed > 0) { rpm = s === 'inch' ? W.rpm_from_sfm(v.speed, de) : W.rpm_from_vc(v.speed, de); rows.push(R('Spindle speed for that speed at the effective diameter', rpm, 'RPM', 0, 'rpm')); rows.push(R('Spindle speed if the full diameter were used', s === 'inch' ? W.rpm_from_sfm(v.speed, v.d) : W.rpm_from_vc(v.speed, v.d), 'RPM', 0)); }
    if (v.fz > 0) {
      const fa = v.fz * v.d / de; rows.push(R('Feed per tooth to restore the chip (fz x D / De)', fa, lenU(s), s === 'inch' ? 5 : 4));
      if (rpm > 0 && v.z > 0) rows.push(R('Table feed', W.table_feed(rpm, fa, v.z), feedMinU(s), 2, 'feed'));
    }
    return rows;
  },
  working: 'Band in the cut, measured from the tool axis: theta0 = acos(1 - 2 ap / D). A point at angle psi from the axis turns on diameter D sin(psi). With the axis tilted by beta from the surface normal the band spans beta - theta0 to beta + theta0, so the largest effective diameter is De = D sin(min(theta0 + beta, 90 deg)) and the smallest is D sin(beta - theta0), or 0 when beta <= theta0 (the centre cuts). With no tilt De = 2 sqrt(ap (D - ap)). n = 1000 Vc / (pi De) (inch: 12 SFM / (pi De)). The chip at the largest diameter is fz x De / D, so fz_adj = fz x D / De. The spindle speed is the one that gives your speed at the largest diameter; the rest of the edge runs slower.',
  source: 'ISCAR, Machining Titanium guide (2019), Table 28 (de = 2 sqrt(d ap - ap^2)); IMCO Carbide Tool and Machining Doctor (feed factor D / De). The tilted form is derived from the sphere and reduces to ISCAR\'s at zero tilt (core tests).',
},
{
  id: 'runout', level: 'expert', group: 'Milling', title: 'Runout and chip load',
  pick: { map: { z: 'flutes' } },
  desc: 'Radial runout (TIR at the cutting edges) makes one tooth cut more than the rest. Shows each tooth\'s chip, how much the worst tooth is overloaded, and the feed per tooth that keeps the worst tooth at the chip you want.',
  fields: s => [
    { id: 'z', label: 'Number of teeth', unit: '', def: 4 },
    { id: 'fz', label: 'Programmed feed per tooth', unit: lenU(s), def: s === 'inch' ? 0.002 : 0.05 },
    { id: 'tir', label: 'Runout, total indicator reading at the edges', unit: lenU(s), def: '' },
    { id: 'tgt', label: 'Largest chip allowed (blank = the programmed fz)', unit: lenU(s), def: '' },
  ],
  calc: (v, W, s) => {
    if (!(v.z >= 1 && v.fz > 0 && v.tir >= 0)) return [];
    const z = Math.round(v.z), n = W.runout_chips(v.fz, v.tir, z), dp = s === 'inch' ? 5 : 4, rows = [];
    let mx = 0;
    for (let i = 0; i < n; i++) { const c = W.list_out(i); mx = Math.max(mx, c); if (i < 12) rows.push(R('Tooth ' + (i + 1) + ' chip', c, lenU(s), dp)); }
    if (n > 12) rows.push(R('Other teeth', 'not listed', '', 0));
    rows.push(R('Worst tooth / programmed fz', 100 * mx / v.fz, '%', 1));
    if (z > 1 && v.tir > 0 && v.fz < v.tir * Math.sin(Math.PI / z)) rows.push(R('Note', 'Runout is larger than the feed per tooth: some teeth do not cut at all', '', 0));
    const tgt = v.tgt > 0 ? v.tgt : v.fz, f = W.runout_fz_for_max(tgt, v.tir, z);
    rows.push(R('Feed per tooth so the worst tooth carries ' + fmt(tgt, dp), isFinite(f) ? f : 'Runout too large for that chip', isFinite(f) ? lenU(s) : '', dp));
    return rows;
  },
  working: 'Tooth radii r_i = (TIR/2) cos(lambda - 2 pi i / z) for runout as an offset of the tool axis. Tooth i removes the least of (k fz + r_i - r_(i-k)) over k = 1..z, never less than zero: normally fz + r_i - r_(i-1), but a tooth that falls inside the surface left by an earlier tooth cuts nothing and the next tooth takes more. The phase lambda is set so the worst tooth is as large as it can be: fz + TIR sin(pi / z) (fz + TIR on two flutes). Feed per tooth for a largest chip c: fz = c - TIR sin(pi / z). Measure TIR on the cutting edges in the holder; tilt of the tool axis and holder runout at speed are not modelled.',
  source: 'Kline and DeVor, Int. J. Mach. Tool Des. Res. 23 (1983) (runout model for end milling); Altintas, Manufacturing Automation, Ch. 2. Checked in the core tests against a brute-force scan of the runout phase.',
},
{
  id: 'finish', level: 'simple', group: 'Turning', title: 'Surface finish from nose radius',
  pick: { map: { r: 'cr' }, types: ['Turning insert', 'Grooving', 'Threading', 'Boring bar', 'Other'] },
  desc: 'Theoretical roughness for a given feed and nose radius, or the feed for a target Ra. A geometric ideal: real finish is usually worse.',
  fields: s => [
    { id: 'f', label: 'Feed per rev', unit: feedRevU(s), def: s === 'inch' ? 0.004 : 0.1 },
    { id: 'r', label: 'Nose radius', unit: lenU(s), def: s === 'inch' ? 0.0157 : 0.4 },
    { id: 'ra', label: 'Or target Ra', unit: s === 'inch' ? 'uin' : 'um', def: '' },
  ],
  calc: (v, W, s) => {
    const rows = [];
    const k = s === 'inch' ? 1e6 : 1000; // in -> microinch, mm -> micrometre
    const u = s === 'inch' ? 'uin' : 'um';
    if (v.f > 0 && v.r > 0) { const dp = s === 'inch' ? 1 : 2; rows.push(R('Theoretical Ra', W.ra_theoretical(v.f, v.r) * k, u, dp)); rows.push(R('Theoretical Rt (peak to valley)', W.rt_theoretical(v.f, v.r) * k, u, dp)); }
    if (v.ra > 0 && v.r > 0) rows.push(R('Feed for target Ra', W.feed_for_ra(v.ra / k, v.r), feedRevU(s), 4));
    return rows;
  },
  working: 'Rt = f^2 / (8 r). Ra = f^2 / (32 r). Valid for f < 2r.',
  source: "Machinery's Handbook; Sandvik Coromant formulas",
},
{
  id: 'millfinish', level: 'advanced', group: 'Milling', title: 'Milling surface finish',
  pick: { map: { z: 'flutes', d: 'dia' } },
  desc: 'Theoretical roughness a milling cutter leaves on a floor (from its corner radius) or on a wall (from its diameter), with every tooth cutting alike and with one tooth marking the surface because of runout. A geometric ideal: real finish is usually worse.',
  fields: s => [
    { id: 'surf', label: 'Surface', unit: '', def: 1, options: [[1, 'Floor: corner radius'], [2, 'Wall: side of the cutter']] },
    { id: 'fz', label: 'Feed per tooth', unit: s === 'inch' ? 'in/tooth' : 'mm/tooth', def: s === 'inch' ? 0.002 : 0.05 },
    { id: 'z', label: 'Teeth', unit: '', def: 4 },
    { id: 'r', label: 'Corner radius of the end mill or insert', unit: lenU(s), def: s === 'inch' ? 0.03 : 0.8, when: v => v.surf !== 2 },
    { id: 'd', label: 'Cutter diameter', unit: lenU(s), def: s === 'inch' ? 0.5 : 12, when: v => v.surf === 2 },
  ],
  calc: (v, W, s) => {
    const r = v.surf === 2 ? v.d / 2 : v.r;
    if (!(v.fz > 0 && v.z >= 1 && r > 0)) return [];
    const k = s === 'inch' ? 1e6 : 1000, u = s === 'inch' ? 'uin' : 'um', dp = s === 'inch' ? 1 : 3, t = i => W.mill_finish(v.fz, v.z, r, i);
    const rows = [R('Theoretical Ra, every tooth cutting alike', t(1) * k, u, dp), R('Theoretical Rt, every tooth cutting alike', t(0) * k, u, dp)];
    if (isFinite(t(3))) rows.push(R('Theoretical Ra, one tooth marking (runout)', t(3) * k, u, dp), R('Theoretical Rt, one tooth marking (runout)', t(2) * k, u, dp));
    else rows.push(R('One tooth marking (runout)', 'The feed per revolution is more than twice the radius: the marks no longer overlap', '', 0));
    rows.push(R('Feed per revolution', t(4), feedRevU(s), s === 'inch' ? 4 : 3));
    return rows;
  },
  working: 'The feed marks are arcs of radius r, a feed f apart: Rt = r - sqrt(r^2 - (f / 2)^2), close to f^2 / (8 r), and Ra = f^2 / (32 r). Floor: r is the corner radius. Wall: r is the cutter radius D / 2, so Rt is close to fz^2 / (4 D). Every tooth cutting alike: f = feed per tooth. One tooth marking: f = feed per revolution = fz x teeth, which is what runout or one long insert gives when a single tooth cuts the finished surface; the real surface lies between the two. Valid for f < 2 r. Not covered: a sharp-cornered end mill on a floor (the marks depend on the dish angle of the end teeth) and wiper flats (which wipe the marks out when the feed per revolution is under the flat width). Deflection, chatter and built-up edge make the real surface rougher.',
  source: 'Floor: Rth = fz^2 / (8 r) in I. M. Soltan, "Surface roughness prediction in end-milling process", M.Sc. thesis, Assiut University, 2008, and in JM CNC, "What are milling cutter marks?". Wall: S. Wojciechowski, "Machined surface roughness including cutter displacements in milling of hardened steel", Metrology and Measurement Systems 18 (2011) no. 3, Rt0 = R - sqrt(R^2 - fz^2 / 4); the Martellotti form fz^2 / (8 (R - fz z / pi)), printed in J. Manuf. Mater. Process. 3 (2019) 70, differs by less than 1 % at finishing feeds and is not used. Ra = f^2 / (32 r) as for turning; the thesis prints fz^2 / (18 sqrt 3 r), the exact average for arc-shaped marks, 2.6 % higher. The one-tooth case is the same geometry with the marks a feed per revolution apart (BenchMate derivation; tests in core/src/millturn.rs).',
},
{
  id: 'insertcode', level: 'advanced', group: 'Turning', title: 'Insert designation (ISO 1832)',
  desc: 'Decode a metric turning insert code or tap one together key by key (shape, clearance, tolerance class, type, size, thickness, corner, hand, maker chipbreaker). The insert is drawn to scale from above and in section, with its edge length, nose radius and corner height, and the nose radius goes to the turning advisor or the outline to the sketcher with one key.',
  render: el => renderInsertCode(el),
  working: 'See the note under the tool. Size = cutting edge length in whole mm, l = (d/2)(cot(a1/2) + cot(a2/2)). Outline: corner at (d/2) / sin(a/2) from the centre, radius meeting each side r / tan(a/2) from the sharp corner.',
  source: 'ISO 1832:2017; code meanings from the Walter, Mitsubishi Materials, Korloy, Kennametal, YG-1, ISCAR and Dormer Pramet code keys listed under the tool. Outline checked against the corner heights printed in ISO 3364:1997; fixing hole sizes from ISO 3364:1997 and Tungaloy.',
},
{
  id: 'holdercode', level: 'advanced', group: 'Turning', title: 'Toolholder designation (ISO 5608)',
  desc: 'Decode an external turning toolholder code: clamping system, insert shape, style and approach angle, clearance, hand, shank size, length and insert size.',
  render: el => renderHolderCode(el),
  working: 'See the note under the tool.',
  source: 'ISO 5608:2012; code meanings from the Mitsubishi Materials, YG-1, ZCC Cutting Tools and Dormer Pramet keys and catalogues listed under the tool.',
},
{
  id: 'iso513', level: 'advanced', group: 'Turning', title: 'Cutting material groups (ISO 513)',
  desc: 'The P, M, K, N, S and H application groups: colour, workpiece materials, and what the number after the letter means.',
  render: el => renderIso513(el),
  working: 'Reference only.',
  source: 'ISO 513:2012; colours from Dormer Pramet, FM Carbide and Cutting Tool Engineering; numbering from Seco Tools.',
},
{
  id: 'knurl', level: 'advanced', group: 'Turning', title: 'Knurling blank diameter',
  desc: 'Blank diameter for a whole number of knurl teeth by four methods: diametral pitch, circular pitch (mm or TPI), measuring the knurl you have, and trial and error with a tick-off procedure. Straight or 30 degree diagonal and diamond.',
  render: el => renderKnurl(el),
  working: 'D = n p / (pi cos h); p = 25.4 / TPI mm or pi / DP in; from a print p = span / spaces; from a wheel p = pi d / teeth. See the note under the tool.',
  source: 'Dorian Tool and Hommel+Keller (Zeus) knurling catalogues; Sherline and GenSwiss knurling instructions; C. Hoffman and pjsminilathe (quoting ANSI/ASME B94.6-1984); DIN 82:1973-01, DIN 403.',
},
{
  id: 'passtime', level: 'simple', group: 'Turning', title: 'Cut time for a pass',
  desc: 'Time for one turning pass.',
  fields: s => [
    { id: 'len', label: 'Length of cut', unit: lenU(s), def: s === 'inch' ? 1.5 : 40 },
    { id: 'f', label: 'Feed per rev', unit: feedRevU(s), def: s === 'inch' ? 0.004 : 0.1 },
    { id: 'rpm', label: 'Spindle speed', unit: 'RPM', def: 3000 },
  ],
  calc: (v, W) => (v.len > 0 && v.f > 0 && v.rpm > 0)
    ? (t => [R('Cut time', t, 'min', 3), R('Cut time', t * 60, 's', 1)])(W.pass_time_min(v.len, v.f, v.rpm)) : [],
  working: 'T = L / (f x n).',
  source: "Machinery's Handbook",
},
{
  id: 'taper', level: 'simple', group: 'Turning', title: 'Taper',
  desc: 'Included angle and taper per unit length from two diameters and a length.',
  fields: s => [
    { id: 'D', label: 'Large diameter', unit: lenU(s), def: s === 'inch' ? 1 : 25 },
    { id: 'd', label: 'Small diameter', unit: lenU(s), def: s === 'inch' ? 0.5 : 12 },
    { id: 'L', label: 'Length', unit: lenU(s), def: s === 'inch' ? 2.5 : 60 },
    { id: 'Lw', label: 'Whole length of the work between centres (optional, for tailstock set-over)', unit: lenU(s), def: '', level: 'advanced' },
  ],
  calc: (v, W, s) => {
    if (!(v.L > 0 && v.D > v.d)) return [];
    const rows = [
      R('Included angle', W.taper_included_angle_deg(v.D, v.d, v.L), 'deg', 4),
      R('Half angle (slide setting)', W.taper_half_angle_deg(v.D, v.d, v.L), 'deg', 4),
      R('Taper per unit length (diameter)', W.taper_per_length(v.D, v.d, v.L), s === 'inch' ? 'in/in' : 'mm/mm', 5),
    ];
    if (v.Lw > 0) {
      const so = W.taper_tailstock_setover(v.D, v.d, v.L, v.Lw);
      rows.push(isFinite(so) ? R('Tailstock set-over', so, lenU(s), s === 'inch' ? 4 : 3) : R('Tailstock set-over', 'the work cannot be shorter than the taper', '', 0));
    }
    return rows;
  },
  working: 'tan(half angle) = (D - d) / (2 L). Turning with the compound slide: swivel it to the half angle. Turning between centres with the tailstock set over: set-over = whole length of the work × (D - d) / (2 × length of the taper); only for slow tapers, since the centres no longer sit square in their holes.',
  source: "Machinery's Handbook (tapers); tailstock set-over and compound slide angle as printed in two sets of lathe notes (see docs/sources.md, Taper turning).",
  proof: [{ name: 'The NPT pipe taper, 3/4 in per foot on the diameter', sys: 'inch', vals: { D: 1.75, d: 1, L: 12 }, expect: [['Half angle', 'deg', 1.79, 0.0002]],
    source: 'Wikipedia, "National pipe thread": the taper of 3/4 in per foot is printed with its half angle, 1° 47′ 24″, which is 1.7900°. ASME B1.20.1 by name.', note: 'Any two diameters 0.75 in apart over a length of 12 in have this taper.' }],
},
{
  id: 'bar', level: 'advanced', group: 'Turning', title: 'Bar stock planner',
  desc: 'Parts per bar, scrap, weight and cost for bar-fed and Swiss-type lathes. Density is yours to enter for your material; BenchMate does not guess it.',
  fields: s => [
    { id: 'shape', label: 'Bar shape', unit: '', def: 1, options: [[1, 'Round'], [2, 'Hex (across flats)'], [3, 'Square']] },
    { id: 'size', label: 'Diameter or across flats', unit: lenU(s), def: s === 'inch' ? 0.75 : 20 },
    { id: 'bar', label: 'Bar length', unit: lenU(s), def: s === 'inch' ? 144 : 3000 },
    { id: 'part', label: 'Part length', unit: lenU(s), def: s === 'inch' ? 1 : 25 },
    { id: 'cut', label: 'Cut-off (parting) width', unit: lenU(s), def: s === 'inch' ? 0.093 : 2 },
    { id: 'face', label: 'Facing allowance per part', unit: lenU(s), def: s === 'inch' ? 0.01 : 0.5 },
    { id: 'rem', label: 'Remnant (unusable end)', unit: lenU(s), def: s === 'inch' ? 6 : 150 },
    { id: 'start', label: 'Start-of-bar facing', unit: lenU(s), def: 0 },
    { id: 'rho', label: 'Material density (optional)', unit: s === 'inch' ? 'lb/in3' : 'g/cm3', def: '' },
    { id: 'price', label: 'Bar price (optional)', unit: 'per bar', def: '' },
  ],
  calc: (v, W, s) => {
    if (!(v.bar > 0 && v.part > 0 && v.cut >= 0)) return [];
    const face = v.face > 0 ? v.face : 0, rem = v.rem > 0 ? v.rem : 0, start = v.start > 0 ? v.start : 0;
    const per = W.bar_length_per_part(v.part, v.cut, face);
    const n = W.bar_parts_per_bar(v.bar, v.part, v.cut, face, rem, start);
    const scrap = W.bar_scrap_len(v.bar, n, per);
    const rows = [
      R('Parts per bar', n, '', 0),
      R('Bar used per part', per, lenU(s), 4),
      R('Scrap per bar', scrap, lenU(s), 3),
      R('Scrap per bar', 100 * scrap / v.bar, '%', 1),
    ];
    if (v.size > 0 && v.rho > 0) {
      // inch: in2 x in x lb/in3 = lb. metric: mm2 x mm = mm3; x 1e-3 = cm3; x g/cm3 = g; / 1000 = kg.
      const a = W.bar_section_area(v.shape, v.size), k = s === 'inch' ? 1 : 1e-6, wu = s === 'inch' ? 'lb' : 'kg';
      rows.push(R('Bar weight', a * v.bar * v.rho * k, wu, 3));
      rows.push(R('Material per part (incl. cut-off and facing)', a * per * v.rho * k, wu, 4));
      if (n > 0) rows.push(R('Bar weight per part (incl. scrap share)', a * v.bar * v.rho * k / n, wu, 4));
    }
    if (v.price > 0 && n > 0) rows.push(R('Material cost per part', v.price / n, 'per part', 3));
    return rows;
  },
  working: 'Bar used per part = part + cut-off + facing. Parts = floor((bar - remnant - start facing) / bar used per part). Scrap = bar - parts x bar used per part. Area: round pi d^2 / 4, hex 0.866025 s^2 (s across flats), square s^2. Weight = area x length x density. Cost per part = bar price / parts.',
  source: "Machinery's Handbook (areas of plane figures, weights of bar stock)",
},
{
  id: 'lathefeed', level: 'simple', group: 'Turning', title: 'Lathe feed: per rev and per minute',
  desc: 'Convert a turning feed between per revolution (G95 / G99) and per minute (G94 / G98) at a spindle speed, or at the speed set by a cutting speed and diameter.',
  fields: s => [
    { id: 'f', label: 'Feed per revolution', unit: feedRevU(s), def: s === 'inch' ? 0.006 : 0.15 },
    { id: 'rpm', label: 'Spindle speed', unit: 'RPM', def: '' },
    { id: 'speed', label: s === 'inch' ? 'Or surface speed' : 'Or cutting speed Vc', unit: spdU(s), def: '' },
    { id: 'dia', label: 'with the diameter being cut', unit: lenU(s), def: '' },
    { id: 'vf', label: 'Feed per minute', unit: feedMinU(s), def: '' },
  ],
  pairs: [['f', 'vf',
    (v, W, s) => W.table_feed(v.rpm > 0 ? v.rpm : (s === 'inch' ? W.rpm_from_sfm(v.speed, v.dia) : W.rpm_from_vc(v.speed, v.dia)), v.f, 1),
    (v, W, s) => W.feed_per_tooth(v.vf, v.rpm > 0 ? v.rpm : (s === 'inch' ? W.rpm_from_sfm(v.speed, v.dia) : W.rpm_from_vc(v.speed, v.dia)), 1)]],
  calc: (v, W, s) => {
    let n = v.rpm > 0 ? v.rpm : NaN;
    const rows = [];
    if (!(n > 0) && v.speed > 0 && v.dia > 0) { n = s === 'inch' ? W.rpm_from_sfm(v.speed, v.dia) : W.rpm_from_vc(v.speed, v.dia); rows.push(R('Spindle speed at that diameter', n, 'RPM', 0, 'rpm')); }
    if (!(n > 0)) return rows.concat([R('Spindle speed', 'Enter the spindle speed, or a cutting speed and diameter', '', 0)]);
    if (v.f > 0) rows.push(R('Feed per minute', W.table_feed(n, v.f, 1), feedMinU(s), s === 'inch' ? 3 : 1, 'feed'));
    if (v.vf > 0) rows.push(R('Feed per revolution for that feed per minute', W.feed_per_tooth(v.vf, n, 1), feedRevU(s), s === 'inch' ? 5 : 4));
    return rows;
  },
  // G-code: spindle start (fixed rpm, or the surface speed with G96 and a G50 clamp) and the feed word per revolution or per minute.
  snip: (v, W, s, rows) => {
    const val = l => { const r = rows.find(x => x.label.startsWith(l)); return r && typeof r.value === 'number' ? r.value : NaN; };
    const n = v.rpm > 0 ? v.rpm : val('Spindle speed at that diameter'), fr = v.f > 0 ? v.f : val('Feed per revolution for'), fm = v.vf > 0 ? v.vf : val('Feed per minute');
    return n > 0 && (fr > 0 || fm > 0) ? { kind: 'words', lathe: true, rpm: n, v: v.speed > 0 && v.dia > 0 && !(v.rpm > 0) ? v.speed : undefined, feedRev: fr, feed: fm } : null;
  },
  working: 'Vf = fn x n; fn = Vf / n. With constant surface speed (G96) the rpm, and so the feed per minute, change with the diameter: convert at the diameter you care about.',
  source: "Sandvik Coromant turning formulas; Machinery's Handbook (feeds).",
},
{
  id: 'roughtime', level: 'advanced', group: 'Turning', title: 'Multi-pass turning time',
  desc: 'Number of roughing passes from the stock and the largest depth of cut, and the cutting time of each, at constant spindle speed or constant surface speed with an rpm limit. Approach and retract moves are not included; add them to the length if you want them counted.',
  fields: s => [
    { id: 'd0', label: 'Stock diameter', unit: lenU(s), def: s === 'inch' ? 2 : 50 },
    { id: 'd1', label: 'Finished diameter (after roughing)', unit: lenU(s), def: s === 'inch' ? 1.5 : 38 },
    { id: 'ap', label: 'Largest depth of cut per pass (radial)', unit: lenU(s), def: s === 'inch' ? 0.08 : 2 },
    { id: 'len', label: 'Length of each pass', unit: lenU(s), def: s === 'inch' ? 3 : 75 },
    { id: 'f', label: 'Feed per revolution', unit: feedRevU(s), def: s === 'inch' ? 0.01 : 0.25 },
    { id: 'mode', label: 'Spindle', unit: '', def: 1, options: [[1, 'Constant surface speed (G96)'], [0, 'Constant rpm (G97)']] },
    { id: 'speed', label: s === 'inch' ? 'Surface speed (CSS)' : 'Cutting speed Vc (CSS)', unit: spdU(s), def: s === 'inch' ? 600 : 180 },
    { id: 'rpm', label: 'Spindle speed (constant rpm)', unit: 'RPM', def: '' },
    { id: 'nmax', label: 'Max spindle speed (G50 / G92 clamp; blank = active machine)', unit: 'RPM', def: '' },
  ],
  calc: (v, W, s) => {
    const k = s === 'inch' ? IN_MM : 1;
    if (!(v.d0 > v.d1 && v.d1 >= 0 && v.ap > 0 && v.len > 0 && v.f > 0)) return [];
    const m = typeof Profiles !== 'undefined' ? Profiles.active() : null;
    const nmax = v.nmax > 0 ? v.nmax : (m && Number(m.rpm_max) > 0 ? Number(m.rpm_max) : 0);
    const css = v.mode === 1;
    const vc = css ? (s === 'inch' ? v.speed * FT_M : v.speed) : 0;
    if (css && !(vc > 0)) return [R('Speed', 'Enter the cutting speed', '', 0)];
    if (!css && !(v.rpm > 0)) return [R('Speed', 'Enter the spindle speed', '', 0)];
    const n = W.turn_rough(v.d0 * k, v.d1 * k, v.ap * k, v.len * k, v.f * k, vc, css ? 0 : v.rpm, css ? nmax : 0);
    if (!(n > 0)) return [];
    const rows = [R('Passes', n, '', 0), R('Depth of cut per pass', (v.d0 - v.d1) / 2 / n, lenU(s), s === 'inch' ? 4 : 3)];
    let tot = 0;
    for (let i = 0; i < n; i++) {
      const d = W.list_out(3 * i), rpm = W.list_out(3 * i + 1), t = W.list_out(3 * i + 2); tot += t;
      if (i < 15) rows.push(R('Pass ' + (i + 1) + ' to ' + fmt(d / k, s === 'inch' ? 4 : 2) + ' ' + lenU(s) + ' at ' + fmt(rpm, 0) + ' RPM', t * 60, 's', 1));
    }
    if (n > 15) rows.push(R('Passes 16 and on', 'not listed', '', 0));
    rows.push(R('Total cutting time', tot, 'min', 3), R('Total cutting time', tot * 60, 's', 1));
    if (css && nmax > 0) rows.push(R('Speed limit used', nmax, 'RPM', 0));
    if (css) rows.push(R('Highest spindle speed', W.list_out(3 * (n - 1) + 1), 'RPM', 0, 'rpm'));
    return rows;
  },
  working: 'Passes N = ceil((D0 - D1) / 2 / ap_max), all at the same depth (D0 - D1) / (2N). Pass i finishes at Di = D0 - 2 i ap. Time per pass = L / (f x n). With constant surface speed n is taken at the finished diameter of the pass, n = 1000 Vc / (pi Di) (inch: 12 SFM / (pi Di)), limited to the rpm clamp; with constant rpm n is fixed. Finishing, approach, retract and rapid moves are not included.',
  source: "Sandvik Coromant turning formulas (n, machining time); Machinery's Handbook.",
},
{
  id: 'partofftime', level: 'advanced', group: 'Turning', title: 'Part-off and groove time',
  desc: 'Time to part off, face or plunge a groove from a start diameter to an end diameter with feed per revolution, at constant surface speed with a maximum spindle speed (G50 / G92 clamp) or at constant rpm. Below the diameter where the clamp is reached the rpm stays constant, and the time there is worked out separately.',
  fields: s => [
    { id: 'd0', label: 'Start diameter', unit: lenU(s), def: s === 'inch' ? 2 : 50 },
    { id: 'd1', label: 'End diameter (0 = to the centre)', unit: lenU(s), def: 0 },
    { id: 'f', label: 'Feed per revolution', unit: feedRevU(s), def: s === 'inch' ? 0.003 : 0.08 },
    { id: 'mode', label: 'Spindle', unit: '', def: 1, options: [[1, 'Constant surface speed (G96)'], [0, 'Constant rpm (G97)']] },
    { id: 'speed', label: s === 'inch' ? 'Surface speed (CSS)' : 'Cutting speed Vc (CSS)', unit: spdU(s), def: s === 'inch' ? 400 : 120, when: v => v.mode === 1 },
    { id: 'nmax', label: 'Max spindle speed (G50 / G92 clamp; blank = active machine, else none)', unit: 'RPM', def: '', when: v => v.mode === 1 },
    { id: 'rpm', label: 'Spindle speed', unit: 'RPM', def: '', when: v => v.mode === 0 },
  ],
  calc: (v, W, s) => {
    if (!(v.d0 > 0 && v.d1 >= 0 && v.f > 0)) return [];
    if (!(v.d0 > v.d1)) return [R('Diameters', 'The end diameter must be smaller than the start diameter', '', 0)];
    const dp = s === 'inch' ? 4 : 2, rows = [];
    if (v.mode === 0) {
      if (!(v.rpm > 0)) return [R('Speed', 'Enter the spindle speed', '', 0)];
      const t = W.partoff_time_rpm(v.d0, v.d1, v.f, v.rpm);
      return [R('Cutting time', t * 60, 's', 1), R('Cutting time', t, 'min', 3), R('Feed per minute', v.f * v.rpm, feedMinU(s), 2, 'feed')];
    }
    if (!(v.speed > 0)) return [R('Speed', 'Enter the cutting speed', '', 0)];
    const m = typeof Profiles !== 'undefined' ? Profiles.active() : null;
    const nmax = v.nmax > 0 ? v.nmax : (m && Number(m.rpm_max) > 0 ? Number(m.rpm_max) : 0);
    const k = s === 'inch' ? 12 : 1000, P = w => W.partoff_time(v.d0, v.d1, v.f, v.speed, nmax, k, w);
    const t = P(0), t1 = P(1), t2 = P(2), dc = P(3);
    rows.push(R('Cutting time', t * 60, 's', 1), R('Cutting time', t, 'min', 3));
    rows.push(R('Spindle speed at the start diameter', P(4), 'RPM', 0, 'rpm'));
    if (nmax > 0) {
      rows.push(R('Speed limit used' + (v.nmax > 0 ? '' : ' (active machine)'), nmax, 'RPM', 0));
      rows.push(R('Diameter where the limit is reached', dc, lenU(s), dp));
      rows.push(R('Time at constant surface speed (above that diameter)', t1 * 60, 's', 1));
      rows.push(R('Time at the speed limit (below that diameter)', t2 * 60, 's', 1));
      rows.push(R('Spindle speed at the end diameter', P(5), 'RPM', 0, 'rpm'));
    } else {
      if (v.d1 > 0) rows.push(R('Spindle speed at the end diameter', P(5), 'RPM', 0, 'rpm'));
      else rows.push(R('Spindle speed at the centre', 'No limit entered: the rpm would rise without end. Enter the G50 / G92 limit or set up a machine.', '', 0));
    }
    rows.push(R('Same cut at the start-diameter rpm held constant', W.partoff_time_rpm(v.d0, v.d1, v.f, P(4)) * 60, 's', 1));
    return rows;
  },
  working: 'The tool moves in f x n per minute on the radius, so the diameter falls at 2 f n and t = ∫ dD / (2 f n(D)) from the end to the start diameter. At constant surface speed n = 1000 Vc / (π D) (inch: 12 SFM / (π D)) down to the clamp diameter Dc = 1000 Vc / (π nmax) (inch: 12 SFM / (π nmax)); below Dc the spindle runs at nmax. Integrating each region: above Dc, t1 = π (Da² − Db²) / (4000 f Vc) (inch: π (Da² − Db²) / (48 f SFM)); below Dc, t2 = (Da − Db) / (2 f nmax). Total t = t1 + t2. With no clamp and no limit to the centre the rpm at the centre would be infinite, but the time is still finite (t1 alone). Constant rpm: t = (D0 − D1) / (2 f n). Approach, retract and dwell are not included; add the clearance to the start diameter if you want it counted.',
  source: 'n = 1000 Vc / (π D): Sandvik Coromant turning formulas. Two regions (constant surface speed down to the radius where the spindle reaches nmax, then nmax): E. Isakov, "Cutting time for facing", Cutting Tool Engineering, 15 Mar 2011 (also: constant surface speed facing takes about half the constant-rpm time); SmartLathe, "Calculation of machining time for facing, parting off and deep grooving on a CNC lathe" (time by integration, separate formula below the clamping diameter). Closed form: own derivation, checked in the Rust core against numerical integration.',
},
{
  id: 'boringbar', level: 'advanced', group: 'Turning', title: 'Boring bar: overhang and deflection',
  pick: { map: { d: 'shank', L: 'stick', re: 'cr' }, types: ['Boring bar'] },
  desc: 'How far a boring bar bends under the cut and how that compares with the overhang the bar makers allow, for steel, carbide, heavy metal and damped bars. Pick the work material and the advisor works out the cutting force, suggests a feed and the deepest cut the bar will take, and says what limits the cut. Drag the overhang and watch the bar bend.',
  fields: s => [
    { id: 'mat', label: 'Bar (sets E and the overhang guidance)', unit: '', def: 1, options: [[1, 'Steel'], [2, 'Solid carbide'], [3, 'Tungsten heavy metal'], [4, 'Damped (anti-vibration) steel bar'], [0, 'Other: enter E below']], wide: true },
    { id: 'd', label: 'Bar diameter', unit: lenU(s), def: s === 'inch' ? 0.75 : 20 },
    { id: 'di', label: 'Coolant hole diameter (blank = none)', unit: lenU(s), def: '' },
    { id: 'L', label: 'Overhang (holder face to cutting edge)', unit: lenU(s), def: s === 'inch' ? 2.25 : 60 },
    { id: 'ld', label: 'Overhang in bar diameters', unit: '', def: '', slider: { min: 1, max: 14, step: 0.1, suffix: ' x D' } },
    { id: 'wm', label: 'Work material (for the cutting force)', unit: '', def: 3, options: [[0, 'Not picked: type the force or kc (Advanced)']].concat(ADV_MAT_OPTIONS), wide: true },
    { id: 're', label: 'Nose radius of the insert', unit: lenU(s), def: s === 'inch' ? 0.0156 : 0.4 },
    { id: 'cut', label: 'Kind of cut', unit: '', def: 1, options: s === 'inch' ? [[1, 'Roughing: 0.05 mm (about 0.002 in) allowed at the tip'], [3, 'Finishing: 0.01 mm (about 0.0004 in) allowed at the tip']] : [[1, 'Roughing: 0.05 mm allowed at the tip'], [3, 'Finishing: 0.01 mm allowed at the tip']], wide: true },
    { id: 'f', label: 'Feed per revolution (blank = suggested)', unit: feedRevU(s), def: '', lock: true },
    { id: 'ap', label: 'Depth of cut (blank = suggested)', unit: lenU(s), def: '', lock: true },
    { id: 'ag', label: 'Feed for the nose radius (fine finish: low)', unit: '', def: 50, slider: { min: 0, max: 100, step: 5, labels: ['A third of the radius', 'Middle', 'Half the radius'] } },
    { level: 'advanced', id: 'lim', label: 'Deflection allowed at the tip (blank = by kind of cut)', unit: lenU(s), def: '' },
    { level: 'advanced', id: 'kap', label: 'Entering angle', unit: 'deg', def: 95 },
    { level: 'advanced', id: 'kc', label: 'Your own specific cutting force kc (wins over the material)', unit: 'N/mm2', def: '' },
    { level: 'advanced', id: 'F', label: 'Tangential cutting force, if known (wins over all)', unit: s === 'inch' ? 'lbf' : 'N', def: '' },
    { level: 'advanced', id: 'Fr', label: 'Radial force (optional)', unit: s === 'inch' ? 'lbf' : 'N', def: '' },
    { level: 'advanced', id: 'E', label: "Young's modulus E (blank = preset)", unit: eField(s).u, def: '' },
  ],
  pairs: [['L', 'ld', v => v.L / v.d, (v, W) => W.apply_factor(v.ld, v.d), 'both']],
  suggest: (v, W, s) => { const r = bbRun(v, W, s); return r && !r.err ? { f: r.fSug / r.k, ap: r.sAp / r.k } : {}; },
  calc: (v, W, s) => {
    const r = bbRun(v, W, s);
    if (!r) return [];
    if (r.err) return [R(r.err[0], r.err[1], '', 0)];
    const inch = r.inch, k = r.k, fk = inch ? LBF_N : 1, fU = inch ? 'lbf' : 'N', ef = eField(s), lu = lenU(s), dpF = inch ? 4 : 3;
    const dU = inch ? 'thou' : 'um', dk = inch ? 1000 / IN_MM : 1000, dd = inch ? 2 : 1, rows = [];
    if (isFinite(r.defl)) {
      rows.push(R('Tip deflection, tangential (edge drops below centre)', r.defl * dk, dU, dd));
      rows.push(R('Share of the allowed deflection (' + fmt(r.lim * dk, dd) + ' ' + dU + (r.limOwn ? '' : ", BenchMate's starting figure") + ')', r.shareD * 100, '%', 0));
    } else rows.push(R('Deflection', r.wmNone ? 'Pick the work material, or type kc or the force (Advanced)' : r.noKc ? 'No specific cutting force is published for this material group: type kc or the force (Advanced)' : 'Enter the nose radius, or type the feed', '', 0));
    rows.push(R('Overhang L/D', r.ld, 'x D', 2));
    if (!r.typed && isFinite(r.ap)) {
      rows.push(R('Depth of cut (' + (r.apL ? 'yours, locked' : r.reduced ? 'reduced from ' + fmt(r.ap0 / k, dpF) + ' ' + lu + ' to fit the deflection' : 'suggested: the depth the turning speed table is based on') + ')', r.ap / k, lu, dpF));
      rows.push(R('Feed per revolution (' + (r.fL ? 'yours, locked' : 'suggested: nose radius rule, Mitsubishi Materials') + ')', r.f / k, feedRevU(s), dpF));
    }
    if (isFinite(r.force)) rows.push(R(r.typed ? 'Tangential force (as entered)' : 'Tangential force Fc = kc ap fn', r.force / fk, fU, 1));
    if (!r.typed && isFinite(r.apMax)) rows.push(R('Deepest cut inside the allowed deflection, at this feed', r.apMax / k, lu, dpF));
    if (!r.typed && isFinite(r.kc)) rows.push(R(v.kc > 0 ? 'Specific cutting force kc (your own)' : 'Specific cutting force kc at this chip (Iscar group ' + r.g[0] + ')', r.kc, 'N/mm2', 0));
    if (isFinite(r.defl) && v.Fr > 0) { const dr = W.boring_bar_deflection(v.Fr * fk, r.L, r.d, r.di, r.e); rows.push(R('Tip deflection, radial (bore comes out small)', dr * dk, dU, dd)); rows.push(R('Combined tip deflection', Math.hypot(r.defl, dr) * dk, dU, dd)); }
    rows.push(R("Young's modulus used (" + (v.E > 0 ? 'as entered' : r.p.name + ' preset, ' + r.p.src) + ')', r.e / ef.k, ef.u, ef.dp));
    r.guide.forEach(([who, ld]) => rows.push(R('Overhang guidance: ' + who, 'up to ' + ld + ' x D', '', 0)));
    if (r.ldG > 0 && r.ld > r.ldG) rows.push(R('Check', 'Overhang is past the smallest published guidance for this bar (' + r.ldG + ' x D)' + (v.mat === 4 ? '' : '; damped bars are made for ' + BAR_LD.damped.map(x => x[0] + ' ' + x[1] + ' x D').join(', ')), '', 0));
    if (v.mat === 4) rows.push(cfNote('Damped bar: the deflection is worked out as for a plain steel bar of the same diameter. The damper is there to stop chatter at a long overhang; ask the maker for the stiffness of your bar.'));
    if (!r.typed && isFinite(r.defl)) rows.push(R('Note', ADV_START_NOTE, '', 0));
    return rows;
  },
  panel: (v, W, s) => {
    const r = bbRun(v, W, s);
    if (!r || r.err) return '';
    const inch = r.inch, k = r.k, lu = lenU(s), dU = inch ? 'thou' : 'um', dk = inch ? 1000 / IN_MM : 1000, dd = inch ? 2 : 1, f = (x, dp) => fmt(x, dp), L3 = inch ? 3 : 1;
    let tiles = advTile('Overhang', f(r.ld, 1) + ' x D', r.ldG > 0 ? advPct(r.shareL) + ' of ' + r.ldG + ' x D, the lowest figure the makers print for this bar' : 'no published guidance for this bar', r.ldG > 0 ? advBand(r.shareL) : '');
    tiles += isFinite(r.shareD) ? advTile('Deflection', f(r.defl * dk, dd) + ' ' + dU, advPct(r.shareD) + ' of ' + f(r.lim * dk, dd) + ' ' + dU + (r.limOwn ? '' : ' (starting figure)'), advBand(r.shareD)) : advTile('Deflection', 'not worked out', 'needs the cutting force', '');
    const shorter = r.ldG > 0 ? f(W.apply_factor(r.ldG, r.d) / k, L3) + ' ' + lu : '', alt = v.mat === 1 ? ' or change to a carbide bar (' + BAR_LD[2].map(x => x[0] + ' ' + x[1]).join(', ') + ' x D) or a damped bar.' : v.mat === 4 ? '. Use the largest bar that fits the bore.' : ' or change to a damped bar (' + BAR_LD.damped.map(x => x[0] + ' ' + x[1]).join(', ') + ' x D).';
    let card;
    if (r.limit === 9) card = advCard('Overhang', 'The bar sticks out ' + f(r.ld, 1) + ' times its diameter. The lowest figure the bar makers print for this kind of bar is ' + r.ldG + ' x D: past that, expect chatter.' + (r.reduced ? ' The depth of cut was also reduced to ' + f(r.ap / k, inch ? 4 : 3) + ' ' + lu + ' to hold the deflection.' : ''), 'Shorten the overhang to ' + shorter + ' or less,' + alt, r.shareL > 1.0005);
    else if (r.limit === 1 && r.reduced) card = advCard('Bar deflection', 'At ' + f(r.ap0 / k, inch ? 4 : 3) + ' ' + lu + ' deep the tip would be pushed more than the ' + f(r.lim * dk, dd) + ' ' + dU + ' allowed, so the depth of cut was reduced to ' + f(r.ap / k, inch ? 4 : 3) + ' ' + lu + '.', 'Shorten the overhang: deflection goes with its cube. At ' + f(r.lFit / k, L3) + ' ' + lu + ' the full depth fits.');
    else if (r.limit === 1) card = advCard('Bar deflection', (r.typed ? 'With this force' : 'Your depth is locked, so nothing was changed:') + ' the tip is pushed ' + f(r.defl * dk, dd) + ' ' + dU + ', more than the ' + f(r.lim * dk, dd) + ' ' + dU + ' allowed.', (r.typed ? '' : 'Unlock the depth (the deepest cut inside the limit is ' + f(r.apMax / k, inch ? 4 : 3) + ' ' + lu + '), or shorten ') + (r.typed ? 'Shorten ' : '') + 'the overhang to ' + f(r.lFit / k, L3) + ' ' + lu + '.', true);
    else card = advCard('Nothing', isFinite(r.shareD) ? 'The overhang is inside the bar makers\' guidance and the tip deflection is inside the ' + f(r.lim * dk, dd) + ' ' + dU + ' allowed.' : 'The overhang is inside the bar makers\' guidance. The deflection is not worked out without a cutting force.', '');
    return '<div class="tiles">' + tiles + '</div>' + card;
  },
  sends: (v, W, s) => { const r = bbRun(v, W, s); return r && !r.err && !r.typed && isFinite(r.ap) && v.wm > 0 ? [['Turning advisor: speed for this cut', 'advturn', { mat: v.wm, re: v.re, f: r.f / r.k, ap: r.ap / r.k }]] : []; },
  working: 'I = pi (d^4 - di^4) / 64 (solid round bar, optional coolant hole; flats ground on the bar are ignored, so a real bar is a little softer). Tip deflection = F L^3 / (3 E I), clamped rigidly at the holder face: holder, clamping and spindle flex are not included, so the real bar deflects more. Force: Fc = kc x ap x fn, with kc = kc1.1 x h^(-mc) at the chip thickness h = fn sin(entering angle) for the work material, or your own kc or force. Feed suggested from the nose radius (a corner radius of 2 to 3 times the feed). Depth suggested: the 0.040 in (1.0 mm) the turning speed table is based on, reduced to the deepest cut that keeps the tip inside the allowed deflection, ap = allowed deflection / (deflection for 1 mm of depth). A depth you type is locked and never changed. Overhang that fits a depth: L = cube root of (3 E I x allowed deflection / F). The card names the overhang when L/D is past the lowest figure the bar makers print for that kind of bar, the deflection when the tip is pushed more than allowed, and the larger share when both are passed. E presets: steel 210 GPa (Ovako data for 4140 / 42CrMo4, in the BenchMate material data), solid carbide 580 GPa (Ceratizit grade CTS20L, 10% Co; use your bar maker\'s figure), tungsten heavy metal 360 GPa (Plansee Densimet D176); a damped bar is taken as a plain steel bar. The guidance values are each maker\'s own rule of thumb for chatter-free boring, shown side by side because they differ. The allowed deflection (0.05 mm roughing, 0.01 mm finishing) is BenchMate\'s own starting figure.',
  source: "Gere and Goodno, Mechanics of Materials (cantilever); Sandvik Coromant (Fc = kc ap fn); kc: Iscar material groups; feed from nose radius: Mitsubishi Materials, Corner radius; E: Ovako, Ceratizit, Plansee W-MMC brochure 09.2021; overhang guidance: Seco Tools (2019), Kennametal (The basics of boring), Cutwel (Expert guide to boring bars). See docs/sources.md.",
},
{
  id: 'caxis', level: 'advanced', group: 'Turning', title: 'C-axis (polar) feed',
  desc: 'Mill-turn and live tooling: angular feed of the C axis for a feed along the part surface at a diameter, and the inverse time feed number (G93) for a move that combines a linear axis and C.',
  fields: s => [
    { id: 'd', label: 'Diameter the tool cuts at', unit: lenU(s), def: s === 'inch' ? 2 : 50 },
    { id: 'vf', label: 'Feed along the surface', unit: feedMinU(s), def: s === 'inch' ? 10 : 250 },
    { id: 'deg', label: 'C-axis feed', unit: 'deg/min', def: '' },
    { id: 'lin', label: 'G93 move: linear distance (X, Y or Z)', unit: lenU(s), def: '' },
    { id: 'ang', label: 'G93 move: C rotation', unit: 'deg', def: '' },
  ],
  pairs: [['vf', 'deg', (v, W) => W.c_axis_deg_min(v.vf, v.d), (v, W) => W.c_axis_feed_from_deg(v.deg, v.d), 'both']],
  calc: (v, W, s) => {
    if (!(v.d > 0)) return [];
    const rows = [];
    if (v.vf > 0) { const dm = W.c_axis_deg_min(v.vf, v.d); rows.push(R('C-axis feed', dm, 'deg/min', 1)); rows.push(R('C-axis speed', dm / 360, 'rev/min', 4)); }
    if (v.vf > 0 && (v.lin > 0 || v.ang > 0)) {
      const F = W.inverse_time_f(v.lin > 0 ? v.lin : 0, v.ang > 0 ? v.ang : 0, v.d, v.vf);
      rows.push(R('G93 inverse time F (1 / minutes for the move)', F, '', 4));
      rows.push(R('Move time', 60 / F, 's', 2));
    }
    return rows;
  },
  working: 'deg/min = Vf x 360 / (pi D); Vf = deg/min x pi D / 360. G93: the move should take 1/F minutes, so F = Vf / path length, path = sqrt(linear^2 + (pi D x angle / 360)^2) for the tool running at Vf over the part surface. How a control reads F on a move with a rotary axis in G94 differs between makers (degrees per minute, or a blend of linear and rotary): check your control manual. Polar coordinate interpolation (G12.1 / G112) converts the feed itself.',
  source: 'Circle geometry; inverse time feed: NIST RS274NGC Interpreter, version 3 (Kramer, Proctor, Messina, NISTIR 6556, 2000). Check your control manual.',
},
{
  id: 'tnrc', level: 'advanced', group: 'Turning', title: 'Tool nose radius compensation (TNRC)',
  desc: 'Where to program the imaginary tool tip so a chamfer, taper or corner radius comes out to size without G41/G42: Z and X shifts, the tip path for any element and tip number 0 to 9 (each drawn), and what G41/G42 does instead.',
  render: el => renderTnrc(el),
  working: 'Chamfer at angle θ to Z, tip 3 or 2: dz = r (1 - tan(θ/2)) where it meets a diameter, dx = r (1 - tan((90° - θ)/2)) radial where it meets a face (2 dx on diameter). General element: the tip path is the part line moved by r n + r t (n = unit normal toward the tool, t = tip direction), ended where it meets the moved neighbour line; arcs: radius R + r convex, R - r concave, centre moved by r t. All in the Rust core (core/src/tnrc.rs).',
  source: 'Kentech Inc. / TWI Press (2000, reprinted by Florida International University) and the Industry Arena forum formulas; Haas operator manual (tip 3 OD, tip 2 boring); Haas lathe programming manual (G41/G42, approach move); NIST RS274NGC. See docs/sources.md.',
},
{
  id: 'changegears', level: 'advanced', group: 'Turning', title: 'Lathe change gears',
  desc: 'Gear trains from your own change gears for a thread (TPI, mm pitch, module or diametral pitch worm) on your leadscrew: simple and compound trains, closest first, with the pitch error.',
  render: el => renderChangeGears(el),
  working: 'Ratio needed = thread lead / (leadscrew lead x fixed ratio). Simple train a/b (any idler); compound (a/b) x (c/d). Error = ratio found / ratio needed - 1. Every pair (and every four) of different gears from your list is tried.',
  source: "Gear-train ratio arithmetic; Machinery's Handbook 'Lathe change gears' (by name). 127 = 5 x 25.4 (inch defined as 25.4 mm, NIST SP 811). See docs/sources.md.",
},
{
  id: 'slitsaw', level: 'advanced', group: 'Sawing', title: 'Slitting saw speeds and feeds',
  pick: { map: { D: 'dia', z: 'flutes' } },
  desc: 'Spindle speed, table feed, chip thickness and cut time for a slitting or slotting saw. Pick the work material and the saw material for a starting speed and feed per tooth from a saw maker\'s sheet, or type your saw maker\'s own figures: a typed value is locked. A slot shallower than half the saw diameter thins the chip; the screen shows how much.',
  fields: s => [
    { id: 'wm', label: 'Work material', unit: '', def: 3, options: [[0, 'Not picked: type the saw maker\'s speed and feed']].concat(ADV_MAT_OPTIONS), wide: true },
    { id: 'tm', label: 'Saw material', unit: '', def: 2, options: [[2, 'High speed steel (HSS)'], [1, 'Solid carbide or carbide-tipped']] },
    { id: 'D', label: 'Saw diameter', unit: lenU(s), def: s === 'inch' ? 3 : 80 },
    { id: 'z', label: 'Number of teeth', unit: '', def: 32 },
    { id: 'ae', label: 'Depth of slot (radial)', unit: lenU(s), def: s === 'inch' ? 0.25 : 6 },
    { id: 'speed', label: (s === 'inch' ? 'Surface speed' : 'Cutting speed Vc') + ' (blank = suggested)', unit: spdU(s), def: '', lock: true },
    { id: 'fz', label: 'Feed per tooth (blank = suggested)', unit: lenU(s), def: '', lock: true },
    { id: 'sp', label: 'Speed in the printed range (soft stock: high, hard: low)', unit: '', def: 50, slider: { min: 0, max: 100, step: 5, labels: ['Low', 'Middle', 'High'] } },
    { id: 'ag', label: 'Feed per tooth in the printed range', unit: '', def: 50, slider: { min: 0, max: 100, step: 5, labels: ['Gentle', 'Middle', 'Aggressive'] } },
    { id: 'hex', label: 'Or target chip thickness hex', unit: lenU(s), def: '' },
    { id: 'L', label: 'Length of slot (for time)', unit: lenU(s), def: '' },
  ],
  suggest: (v, W, s) => { const a = v.wm > 0 ? advSaw(W, v.wm, v.tm, v.sp, v.ag) : null; return a ? { speed: s === 'inch' ? a.vc / FT_M : a.vc, fz: s === 'inch' ? a.chip / IN_MM : a.chip } : {}; },
  calc: (v, W, s) => {
    if (!(v.D > 0 && v.ae > 0)) return [];
    const inch = s === 'inch', rows = [], dp = inch ? 5 : 4, a = v.wm > 0 ? advSaw(W, v.wm, v.tm, v.sp, v.ag) : null;
    const speed = v.speed > 0 ? v.speed : a ? (inch ? a.vc / FT_M : a.vc) : NaN, fzIn = v.fz > 0 ? v.fz : a ? (inch ? a.chip / IN_MM : a.chip) : NaN;
    const n = speed > 0 ? (inch ? W.rpm_from_sfm(speed, v.D) : W.rpm_from_vc(speed, v.D)) : NaN;
    if (n > 0) rows.push(R('Spindle speed', n, 'RPM', 0, 'rpm'));
    const k = W.rctf(v.ae, v.D), fz = v.hex > 0 ? v.hex * k : fzIn;
    let vf = NaN;
    if (fz > 0 && n > 0 && v.z > 0) { vf = W.table_feed(n, fz, v.z); rows.push(R('Table feed', vf, feedMinU(s), 2, 'feed')); }
    if (speed > 0) rows.push(R((inch ? 'Surface speed' : 'Cutting speed') + ' (' + (v.speed > 0 ? 'yours, locked' : 'suggested: Gaylee, ' + a.row[0]) + ')', speed, spdU(s), 0));
    if (fz > 0) {
      if (v.hex > 0) rows.push(R('Feed per tooth for that chip', fz, lenU(s), dp));
      else { rows.push(R('Feed per tooth (' + (v.fz > 0 ? 'yours, locked' : 'suggested: Gaylee, ' + (v.tm === 1 ? 'carbide' : 'HSS') + ' saws') + ')', fz, lenU(s), dp)); rows.push(R('Max chip thickness hex', fz / k, lenU(s), dp)); }
    }
    rows.push(R('Chip thinning factor (RCTF)', k, 'x', 3));
    if (v.z > 0) rows.push(R('Teeth in the cut at once', W.teeth_engaged(v.z, v.ae, v.D), '', 2));
    if (vf > 0) {
      const app = W.cutter_approach(v.D, v.ae); rows.push(R('Approach to full depth', app, lenU(s), inch ? 3 : 2));
      if (v.L > 0) rows.push(R('Cut time (slot plus approach)', (v.L + app) / vf, 'min', 3));
    }
    if (!(speed > 0)) rows.push(R('Speed and feed', v.wm > 0 ? 'The saw sheet has no row for this material: type your saw maker\'s speed and feed per tooth' : 'Pick the work material, or type your saw maker\'s speed and feed per tooth', '', 0));
    if (a && !(v.speed > 0 && (v.fz > 0 || v.hex > 0))) {
      rows.push(cfNote('The saw sheet prints one wide speed range for the whole hardness range of a material group (' + a.row[0] + (a.row[1] ? ', ' + a.row[1] : '') + '): soft stock takes the high end, hard stock the low end. One publisher. Your saw maker\'s own figures are better: type them in.'));
      rows.push(R('Note', ADV_START_NOTE, '', 0));
    }
    return rows;
  },
  table: (v, W, s) => {
    const a = v.wm > 0 ? advSaw(W, v.wm, v.tm, v.sp, v.ag) : null;
    if (!a) return null;
    const inch = s === 'inch', sp = x => fmt(inch ? x : x * FT_M, 0), fd = x => fmt(inch ? x : x * IN_MM, inch ? 4 : 3), r = a.row, t = v.tm === 1 ? 1 : 2;
    const line = (name, lo, hi, tt) => ['Gaylee Corporation', r[0] + (r[1] ? ' (' + r[1] + ')' : '') + ', ' + name, sp(lo) + ' to ' + sp(hi) + ' ' + spdU(s), fd(ADV_SAW_FZ[tt][0]) + ' to ' + fd(ADV_SAW_FZ[tt][1]) + ' ' + lenU(s), tt === t && !(v.speed > 0) ? 'used' : ''];
    return { title: 'What the saw sheet prints for this material', head: ['Publisher', 'Row as printed', 'Speed', 'Feed per tooth (all materials)', ''], rows: [line('carbide saws', r[2], r[3], 1), line('HSS saws', r[4], r[5], 2)], text: true };
  },
  working: 'Starting speed: the saw maker\'s sheet prints a speed range for each material group, for carbide and for HSS saws; the slider picks a place inside it. Feed per tooth: the sheet prints one range for all materials (carbide saws 0.0002 to 0.0015 in, HSS saws 0.002 to 0.006 in); the slider picks a place inside it. A speed or feed you type is locked and used as it is. n = 1000 Vc / (pi D) (inch 12 SFM / (pi D)). Vf = n x z x fz. Engagement phi = acos(1 - 2 ae / D), hex = fz sin(phi) for ae < D/2, so fz = hex / sin(phi) for a target chip. Teeth in the cut = z phi / 360 deg. Approach = sqrt(ae (D - ae)), the distance the saw centre travels from first touch to full depth.',
  source: 'Starting speeds and feeds: Gaylee Corporation, "Cutting speed recommendations: circular saws" (solid carbide, carbide-tipped and HSS saws; material groups after the Machining Data Handbook); the carbide column is reprinted by Kyocera as "Slitting saw parameters". One publisher. Sandvik Coromant milling formulas (n, Vf); Machining Doctor (RCTF); Altintas, Ch. 2 (chip thickness); approach by circle geometry. See docs/sources.md, "Advisor".',
},
{
  id: 'bandsaw', level: 'advanced', group: 'Sawing', title: 'Bandsaw cut time',
  desc: 'Time to cut through a round, rectangular or tube section, one piece or a bundle (pieces across and layers high), from the down-feed rate or the cutting rate (area per minute) your saw or blade maker gives, and the chip per tooth from the blade speed and pitch.',
  fields: s => [
    { id: 'shape', label: 'Section', unit: '', def: 1, options: [[1, 'Round bar'], [2, 'Rectangle (cut through the height)'], [3, 'Tube']] },
    { id: 'a', label: 'Diameter, or width of the rectangle', unit: lenU(s), def: s === 'inch' ? 4 : 100 },
    { id: 'b', label: 'Rectangle height, or tube wall', unit: lenU(s), def: '', when: v => v.shape !== 1 },
    { id: 'bundle', label: 'Cut', unit: '', def: 0, options: [[0, 'Single piece'], [1, 'Bundle']] },
    { id: 'nx', label: 'Pieces across (side by side, across the blade)', unit: '', def: 3, when: v => v.bundle === 1 },
    { id: 'ny', label: 'Layers high (stacked in the feed direction)', unit: '', def: 2, when: v => v.bundle === 1 },
    { id: 'vf', label: 'Down-feed rate', unit: feedMinU(s), def: '' },
    { id: 'rate', label: 'Or cutting rate', unit: s === 'inch' ? 'in2/min' : 'cm2/min', def: '' },
    { id: 'vb', label: 'Blade speed (for chip per tooth)', unit: s === 'inch' ? 'ft/min' : 'm/min', def: '' },
    { id: 'tpi', label: 'Blade pitch', unit: 'TPI', def: '' },
  ],
  calc: (v, W, s) => {
    if (!(v.a > 0)) return [];
    const bun = v.bundle === 1, nx = bun ? v.nx : 1, ny = bun ? v.ny : 1;
    if (bun && !(nx >= 1 && ny >= 1)) return [R('Bundle', 'Enter at least 1 piece across and 1 layer', '', 0)];
    if (bun && (nx % 1 || ny % 1)) return [R('Bundle', 'Pieces and layers are whole numbers', '', 0)];
    const S = k => W.saw_section(v.shape, v.a, v.b > 0 ? v.b : 0, nx, ny, k);
    const area = S(0), h = S(1), wid = S(2);
    if (!isFinite(area)) return [R('Section', v.shape === 3 ? 'Enter a wall thinner than half the diameter' : 'Enter the height', '', 0)];
    const au = s === 'inch' ? 'in2' : 'cm2', ak = s === 'inch' ? 1 : 0.01;
    const rows = [R(bun ? 'Metal area cut (' + S(3) + ' pieces)' : 'Area cut', area * ak, au, 2), R('Height the blade feeds through', h, lenU(s), 2), R('Effective width (longest path of the blade in the work)', wid, lenU(s), 2)];
    if (v.vf > 0) rows.push(R('Cut time from the down-feed', h / v.vf, 'min', 2));
    if (v.rate > 0) { const t = W.saw_cut_time(area * ak, v.rate); rows.push(R('Cut time from the cutting rate', t, 'min', 2)); rows.push(R('Average down-feed at that rate', h / t, feedMinU(s), 2)); if (bun) rows.push(R('Cut time per piece', t / S(3), 'min', 3)); }
    if (bun && v.vf > 0) rows.push(R('Cut time per piece (down-feed)', h / v.vf / S(3), 'min', 3));
    if (bun && v.shape !== 2) rows.push(R('Note', 'Rounds and tubes leave gaps: the blade cuts metal only part of the way down, so the down-feed time and the cutting-rate time differ. Makers quote rates for solid sections; a bundle usually cuts slower than the rate suggests.', '', 0));
    if (v.vf > 0 && v.vb > 0 && v.tpi > 0) {
      const c = s === 'inch' ? W.bandsaw_chip_per_tooth(v.vf * IN_MM, v.vb * FT_M, v.tpi) / IN_MM : W.bandsaw_chip_per_tooth(v.vf, v.vb, v.tpi);
      rows.push(R('Feed per tooth (depth each tooth takes)', c, lenU(s), s === 'inch' ? 6 : 5));
    }
    return rows;
  },
  working: 'Time = height / down-feed rate, or metal area / cutting rate (the square inches or cm2 per minute figure saw makers quote: the cut area divided by the minutes per cut). Round area pi D^2 / 4, tube pi (D^2 - (D - 2t)^2) / 4, rectangle W x H. Bundle of n across and m high, packed square: metal area = n m x piece area, height = m x piece height (D for rounds and tubes), effective width = n x piece width. Teeth per minute = blade speed x teeth per foot (or per metre); feed per tooth = down-feed / teeth per minute. Down-feed and cutting rates depend on the material, blade and machine: take them from your saw or blade maker. For a bundle the makers base the blade pitch on the average section (Fabricating and Metalworking, 2020) and keep at least three teeth in the work (The Tube and Pipe Journal, 2007).',
  source: "Starrett Bulletin 193 (cutting rate in square inches per minute, minutes per cut for each bar area); Machinery's Handbook 31st ed., band saw blades, p. 1245 (cutting time = area / cutting rate, by name); KASCO (teeth per minute = teeth per foot x blade speed); bundles: A. Popson, 'Bundles of joy', The Tube and Pipe Journal, 2007; 'How to optimize sawing operations', Fabricating and Metalworking, 2020. See docs/sources.md.",
  proof: [{ name: 'A 5.5 in2 section at 4 in2 per minute', sys: 'inch', vals: { shape: 2, a: 2.75, b: 2, rate: 4 }, expect: [['Cut time from the cutting rate', 'min', 1.375, 1e-9]],
    source: "Machinery's Handbook, 31st ed., band saw blades (by name): cutting time = area / cutting rate, 5.5 in2 at 4 in2 per minute is 1.375 minutes.", note: 'The 2.75 x 2 in rectangle is only a way to enter 5.5 in2.' }],
},
{
  id: 'sawtpi', level: 'simple', group: 'Sawing', title: 'Saw blade pitch (TPI)',
  desc: 'Coarsest blade pitch that keeps at least three teeth in the thinnest wall the blade crosses, and how many teeth a given pitch puts in the thickest part of the cut, against the makers\' upper rules of thumb.',
  fields: s => [
    { id: 'thin', label: 'Thinnest section the blade crosses (tube or angle wall)', unit: lenU(s), def: s === 'inch' ? 0.125 : 3 },
    { id: 'thick', label: 'Longest cut through the work (diameter or width)', unit: lenU(s), def: s === 'inch' ? 1 : 25 },
    { id: 'tpi', label: 'Blade pitch to check (optional)', unit: 'TPI', def: '' },
  ],
  calc: (v, W, s) => {
    if (!(v.thin > 0)) return [];
    const k = s === 'inch' ? 1 : 1 / IN_MM, thin = v.thin * k, thick = v.thick > 0 ? v.thick * k : NaN;
    const minTpi = W.saw_min_tpi(thin, 3);
    const rows = [R('Fewest teeth per inch for 3 teeth in the thinnest section', minTpi, 'TPI', 1),
      R('Coarsest tooth pitch', s === 'inch' ? thin / 3 : thin / 3 * IN_MM, lenU(s), s === 'inch' ? 4 : 2)];
    if (thick > 0) {
      rows.push(R('Most TPI for 14 teeth in the longest cut (Starrett 10 to 14, soft materials)', 14 / thick, 'TPI', 1));
      rows.push(R('Most TPI for 12 teeth in the longest cut (RMT prefers 6 to 12)', 12 / thick, 'TPI', 1));
      if (minTpi > 14 / thick) rows.push(R('Range', 'No single pitch meets both: use a variable pitch blade or favour the thin wall (3 teeth minimum)', '', 0));
    }
    if (v.tpi > 0) {
      const tThin = W.saw_teeth_in_cut(thin, v.tpi);
      rows.push(R('Teeth in the thinnest section at that pitch', tThin, '', 1));
      if (tThin < 3) rows.push(R('Check', 'Fewer than 3 teeth in the thin wall: use a finer pitch', '', 0));
      if (thick > 0) { const tThick = W.saw_teeth_in_cut(thick, v.tpi); rows.push(R('Teeth in the longest cut at that pitch', tThick, '', 1)); if (tThick > 14) rows.push(R('Check', 'More than 14 teeth in the longest cut: gullets may pack, consider a coarser pitch', '', 0)); }
    }
    return rows;
  },
  working: 'Teeth in the cut = length of cut x TPI. Fewest TPI = 3 / thinnest section (in); coarsest pitch = section / 3. Upper limits: TPI = 14 / longest cut (Starrett, about 10 to 14 teeth in soft materials) or 12 / longest cut (RMT, preferably 6 to 12). The minimum of 3 teeth is confirmed by both; the upper figures differ and both are shown. Variable pitch blades are given by their mean pitch.',
  source: 'L.S. Starrett, Sawing starts with the material (2023); Revolution Machine Tools, Do I have the right TPI (accessed 2026-11-11). See docs/tooling.md.',
},
{
  id: 'edmoffset', level: 'advanced', group: 'EDM', title: 'Wire EDM: kerf, wire offset and corner radius',
  desc: 'Width of the slot a wire leaves, the wire offset for the first cut and for the final skim cut, and the smallest inside corner radius, from the wire diameter and the spark gap in your machine\'s cutting tables.',
  fields: s => [
    { id: 'd', label: 'Wire diameter', unit: lenU(s), def: s === 'inch' ? 0.01 : 0.25 },
    { id: 'g', label: 'Spark gap on the first cut, per side', unit: lenU(s), def: s === 'inch' ? 0.002 : 0.05 },
    { id: 'st', label: 'Stock left for skim cuts, per side (blank for none)', unit: lenU(s), def: '' },
    { id: 'gf', label: 'Spark gap on the final skim cut, per side (blank for one cut only)', unit: lenU(s), def: '' },
  ],
  calc: (v, W, s) => {
    if (!(v.d > 0) || !(v.g >= 0)) return [];
    const dp = s === 'inch' ? 4 : 3, u = lenU(s), st = v.st > 0 ? v.st : 0, skim = v.gf > 0;
    const rows = [R('Kerf of the first cut', W.edm_kerf(v.d, v.g), u, dp), R(st > 0 ? 'Wire offset, first cut (with the stock left on)' : 'Wire offset, first cut', W.edm_offset(v.d, v.g, st), u, dp)];
    if (skim) rows.push(R('Wire offset, final skim cut', W.edm_offset(v.d, v.gf, 0), u, dp));
    rows.push(R(skim ? 'Smallest inside corner radius (after the final skim)' : 'Smallest inside corner radius', W.edm_min_inside_radius(v.d, skim ? v.gf : v.g), u, dp));
    if (st > 0 && !skim) rows.push(R('Note', 'Stock is left on, so skim cuts follow: enter the spark gap of the final skim cut to get its offset and the corner radius it leaves.', '', 0));
    if (v.g > v.d) rows.push(R('Note', 'The gap entered is larger than the wire diameter. The published gaps are a small fraction of the wire: check the entry.', '', 0));
    return rows;
  },
  working: 'Kerf = wire diameter + 2 x spark gap. Wire offset (the distance from the wire centre to the finished profile) = wire radius + spark gap + stock left for later cuts; with no stock it is half the kerf. Smallest inside corner radius = wire radius + spark gap of the cut that finishes the corner: the wire cannot leave a sharper inside corner. The spark gap is not a fixed number: it depends on the wire, the power setting, the material and the flushing, so take it from the machine\'s cutting tables or measure a test cut (offset = half the measured slot width). ' +
    'Published gaps for the first cut differ: Cutting Tool Engineering (2013) gives 0.001 to 0.002 in (0.025 to 0.05 mm) with 0.010 or 0.012 in wire, the Complete EDM Handbook 0.002 to 0.003 in (0.05 to 0.076 mm). For skim cuts Cutting Tool Engineering gives 0.0005 down to 0.0001 in (0.013 to 0.0025 mm). The handbook\'s smallest inside radii (0.0063 in for 0.012 in wire, 0.0053 in for 0.010 in wire) are the wire radius plus 0.0003 in. The default gap of 0.002 in (0.05 mm) lies in both published ranges; it is an example, not a setting.',
  source: "Complete EDM Handbook (C. Sommer and S. Sommer, Reliable EDM), chapters 2 and 5; Cimatron wire EDM help (cut width); Autodesk FeatureCAM help, \'Offset method\'; S. Woods, \'Gap guidance\', Cutting Tool Engineering, March 2013; University of Minnesota AEM wire EDM notes (taper angle); Industrial Monitor Direct knowledge base (no author named). See docs/sources.md, Wire EDM.",
  proof: [{ name: 'A 0.012 in wire with a 0.002 in gap', sys: 'inch', vals: { d: 0.012, g: 0.002 }, expect: [['Kerf of the first cut', 'in', 0.016, 1e-9]],
    source: 'Complete EDM Handbook, chapter 5, p. 82: a 0.012 in wire usually creates a 0.016 in kerf; p. 84: the gap between the wire and the workpiece is 0.002 to 0.003 in.' },
  { name: 'Smallest inside radius for 0.010 in wire after skimming', sys: 'inch', vals: { d: 0.01, g: 0.002, gf: 0.0003 }, expect: [['Smallest inside corner radius (after the final skim)', 'in', 0.0053, 1e-9]],
    source: 'Complete EDM Handbook, chapter 5, p. 83: the minimum inside radius for 0.010 in wire is 0.0053 in, achieved by skimming.', note: 'The gap of 0.0003 in is the handbook figure less the wire radius.' }],
},
{
  id: 'edmtaper', level: 'advanced', group: 'EDM', title: 'Wire EDM: taper cut',
  desc: 'How far a tapered wall moves sideways over the height of the part, the taper angle from that distance, and how far apart sideways the wire guides have to be, to check against the U and V travel of the machine.',
  fields: s => [
    { id: 'find', label: 'Find', unit: '', def: 1, options: [[1, 'Sideways distance from the angle'], [2, 'Angle from the sideways distance']] },
    { id: 'h', label: 'Height of the tapered wall', unit: lenU(s), def: s === 'inch' ? 1 : 25 },
    { id: 'a', label: 'Taper angle per side, from the vertical', unit: 'deg', def: 1.5, when: v => v.find !== 2 },
    { id: 'land', label: 'Sideways distance over the height, per side', unit: lenU(s), def: s === 'inch' ? 0.026 : 0.655, when: v => v.find === 2 },
    { id: 'zg', label: 'Length of wire between the guides (optional)', unit: lenU(s), def: '' },
  ],
  calc: (v, W, s) => {
    if (!(v.h > 0)) return [];
    const u = lenU(s), dp = s === 'inch' ? 4 : 3;
    let a = v.a;
    const rows = [];
    if (v.find === 2) { if (!(v.land >= 0)) return []; a = W.edm_taper_angle(v.land, v.h); rows.push(R('Taper angle per side', a, 'deg', 3)); }
    if (!(a >= 0 && a < 90)) return [R('Angle', 'Enter an angle from 0 to less than 90 degrees', '', 0)];
    if (v.find !== 2) rows.push(R('Sideways distance over the height, per side', W.edm_taper(v.h, a, 0), u, dp));
    rows.push(R('Difference in size between top and bottom (both sides)', W.edm_taper(v.h, a, 1), u, dp));
    if (v.zg > 0) rows.push(R('Sideways distance between the upper and lower guide', W.edm_taper(v.zg, a, 0), u, dp));
    if (a > 45) rows.push(R('Note', 'The Complete EDM Handbook says machines cut angles up to 45 degrees. Check what your machine and its guides allow.', '', 0));
    return rows;
  },
  working: 'Sideways distance = height x tan(angle); angle = atan(sideways distance / height). An opening or a punch tapered the same on two opposite sides differs in size between top and bottom by twice that. The same relation gives the sideways distance between the two wire guides when the height is the length of wire between them (the U and V travel the cut needs: for a taper in both U and V it is sqrt(U^2 + V^2)). Which surface the programmed size lies on (the programme plane) and the guide heights are machine settings: take them from the machine manual. Tall parts and steep angles are limited by the U and V travel and by the guides.',
  source: "Complete EDM Handbook (C. Sommer and S. Sommer, Reliable EDM), chapters 2 and 5; Cimatron wire EDM help (cut width); Autodesk FeatureCAM help, \'Offset method\'; S. Woods, \'Gap guidance\', Cutting Tool Engineering, March 2013; University of Minnesota AEM wire EDM notes (taper angle); Industrial Monitor Direct knowledge base (no author named). See docs/sources.md, Wire EDM.",
  proof: [{ name: 'A 1.5 degree taper over 25 mm', sys: 'metric', vals: { find: 1, h: 25, a: 1.5 }, expect: [['Sideways distance over the height, per side', 'mm', 0.655, 5e-4]],
    source: 'Industrial Monitor Direct knowledge base, Mitsubishi FX10 taper cutting (no author named): tan(1.5 deg) = 0.02619; land per side = 0.02619 x 25 = 0.655 mm.' }],
},
{
  id: 'edmtime', level: 'advanced', group: 'EDM', title: 'Wire EDM: cut time',
  desc: 'Time for a wire cut from the cutting rate the machine maker gives (area per hour or per minute): area of the cut, time of the first cut and of the skim cuts, and the speed along the path.',
  fields: s => [
    { id: 'len', label: 'Length of the cut path', unit: lenU(s), def: s === 'inch' ? 13 : 330 },
    { id: 'h', label: 'Thickness of the work', unit: lenU(s), def: s === 'inch' ? 2 : 50 },
    { id: 'rate', label: 'Cutting rate, first cut', unit: s === 'inch' ? 'in2/h' : 'mm2/min', def: '' },
    { id: 'n', label: 'Skim cuts', unit: '', def: 0, options: [[0, 'None'], [1, '1'], [2, '2'], [3, '3'], [4, '4']] },
    { id: 'srate', label: 'Cutting rate, skim cuts', unit: s === 'inch' ? 'in2/h' : 'mm2/min', def: '', when: v => v.n > 0 },
  ],
  calc: (v, W, s) => {
    if (!(v.len > 0 && v.h > 0)) return [];
    const inch = s === 'inch', n = v.n > 0 ? v.n : 0, C = k => W.edm_cut(v.len, v.h, v.rate > 0 ? v.rate : 0, n, v.srate > 0 ? v.srate : 0, k);
    // The core returns times in the time unit of the rate: hours in inch mode, minutes in mm mode.
    const mins = t => (inch ? t * 60 : t), hrs = t => (inch ? t : t / 60), fmin = f => (inch ? f / 60 : f);
    const rows = [R('Area of one pass', C(0), inch ? 'in2' : 'mm2', inch ? 2 : 0)];
    if (!(v.rate > 0)) { rows.push(R('Note', 'Enter the cutting rate for this material and thickness from the machine\'s cutting tables.', '', 0)); return rows; }
    rows.push(R('Time, first cut', mins(C(1)), 'min', 1), R('Speed along the path, first cut', fmin(C(2)), feedMinU(s), inch ? 4 : 2));
    if (n > 0 && v.srate > 0) rows.push(R('Time, ' + n + (n === 1 ? ' skim cut' : ' skim cuts'), mins(C(3)), 'min', 1), R('Speed along the path, skim cuts', fmin(C(5)), feedMinU(s), inch ? 4 : 2));
    if (n > 0 && !(v.srate > 0)) rows.push(R('Note', 'Enter the cutting rate of the skim cuts to add their time.', '', 0));
    else rows.push(R('Total cutting time', mins(C(4)), 'min', 1), R('Total cutting time', hrs(C(4)), 'h', 2));
    return rows;
  },
  working: 'Area of one pass = length of the cut path x thickness of the work. Time = area / cutting rate; each skim cut goes round the same path, so it adds the same area at its own rate. Speed along the path = cutting rate / thickness. Makers rate their machines in area per time (square inches per hour, or mm2 per minute) under ideal conditions: the Complete EDM Handbook names 2 1/4 in thick hardened D2 with perfect flushing. Real rates depend on the wire, the material, the thickness and the flushing, so use the rate from the machine\'s cutting tables for the job. Threading, moving between openings and slug removal are not included. 1 in2/h = 10.75 mm2/min.',
  source: "Complete EDM Handbook (C. Sommer and S. Sommer, Reliable EDM), chapters 2 and 5; Cimatron wire EDM help (cut width); Autodesk FeatureCAM help, \'Offset method\'; S. Woods, \'Gap guidance\', Cutting Tool Engineering, March 2013; University of Minnesota AEM wire EDM notes (taper angle); Industrial Monitor Direct knowledge base (no author named). See docs/sources.md, Wire EDM.",
  proof: [{ name: 'A 13 in cut through 10 in at 3 in2 per hour', sys: 'inch', vals: { len: 13, h: 10, rate: 3, n: 0 }, expect: [['Area of one pass', 'in2', 130, 1e-9], ['Total cutting time', 'h', 43, 0.5]],
    source: 'Industrial Monitor Direct knowledge base, wire EDM job pricing (no author named): cut area = cut length x workpiece height, 13 x 10 = 130 sq in; roughing at about 3 sq in per hour, about 43 hours.' }],
},
{
  id: 'drillpoint', level: 'simple', group: 'Drilling and tapping', title: 'Drill point length',
  pick: { map: { dia: 'dia', ang: 'point' }, types: ['Drill', 'Spot', 'Other'] },
  desc: 'Axial length of the drill point, and the depth to program for a hole that must be a given depth at its full diameter.',
  fields: s => [
    { id: 'dia', label: 'Drill diameter', unit: lenU(s), def: s === 'inch' ? 0.25 : 6 },
    { id: 'ang', label: 'Point angle', unit: 'deg', def: 118 },
    { id: 'depth', label: 'Hole depth at full diameter (optional)', unit: lenU(s), def: '' },
  ],
  calc: (v, W, s) => {
    if (!(v.dia > 0 && v.ang > 0 && v.ang < 180)) return [];
    const rows = [R('Point length', W.drill_point_length(v.dia, v.ang), lenU(s), 4)];
    if (v.depth > 0) rows.push(R('Depth to program, to the drill point', W.drill_tip_depth(v.depth, v.dia, v.ang), lenU(s), 4));
    return rows;
  },
  // G-code: a drilling cycle to that depth (Z0 on the surface the depth is measured from).
  snip: (v, W, s, rows) => { const r = rows.find(x => x.label.startsWith('Depth to program')); return r ? { kind: 'holes', from: 'the drill point page', set: { z: -(+r.value.toFixed(s === 'inch' ? 4 : 3)) } } : null; },
  working: 'h = (d / 2) / tan(point angle / 2). Depth to program = depth at full diameter + h.',
  source: "Machinery's Handbook (drills)",
},
{
  id: 'spotdepth', level: 'simple', group: 'Drilling and tapping', title: 'Spot and centre drill depth',
  desc: 'Depth to program a spot drill, chamfer tool point or centre drill to for a given chamfer (countersink) diameter, or the diameter a depth gives. Standard centre drills (inch plain and bell type #000 to #20, metric ISO 866 type A, ISO 2540 type B, ISO 2541 type R) can be picked by size, with every dimension\'s sources.',
  render: el => renderSpotDepth(el),
  ownDrawing: true, // the screen draws the live picture itself
  working: 'Pointed tool: depth from the tip z = (Dc / 2) / tan(angle / 2); diameter at depth z: Dc = 2 z tan(angle / 2). Centre drill: z = l + (Dc - d) / (2 tan(angle / 2)), with d the pilot diameter and l the length from the tip to where the countersink cone starts. Standard sizes: see the note under the tool.',
  source: 'Right-triangle geometry of a cone (as in the Drill point length tool). Centre drill sizes: ICS Cutting Tools, Greenfield (Cleveland), Michigan Drill, Exact Tooling, Linear Tools, ZPS-FN, TECWERK; ISO 2540:2016 and ISO 2541:2016 (public previews); ISO 866, DIN 333 cited by name. See docs/sources.md.',
},
{
  id: 'drillchart', level: 'simple', group: 'Drilling and tapping', title: 'Drill size chart',
  desc: 'Fractional, number, letter and metric drills in decimal inch and mm, searchable, with a nearest-drill finder. Number and letter sizes show how many independent publishers print each value.',
  render: el => renderDrillChart(el),
  working: 'Number and letter drill sizes are a convention (ASME B94.11M-1993 lists them; they are not given by a formula), so each value is what the publishers listed under the table print. Fractional sizes are n/64 in, exact. mm = inch x 25.4 (exact). The nearest-drill finder takes a diameter in inch or mm (whatever the unit setting) and lists, for each series (number, letter, fractional, metric), the nearest drill at or below and the nearest above, with the difference (drill minus your size) in inch and mm.',
  source: 'Wikipedia "Drill bit sizes"; Stoody Industrial & Welding Supply decimal equivalents chart; P. Lobben, Machinists\' and Draftsmen\'s Handbook (1910, public domain). Standards cited, not read: ASME B94.11M-1993 (twist drills, current per ASME catalogue), ISO 235:2016 (metric jobber drill sizes).',
},
{
  id: 'tapdrill', level: 'simple', group: 'Drilling and tapping', title: 'Tap drill size',
  desc: 'Hole size for a chosen thread engagement (55 to 85 %) with a cutting tap or a forming (roll) tap, for ISO metric and Unified threads or any size you enter, with the nearest number, letter, fractional and metric drills and the engagement each one gives.',
  render: el => renderTapDrill(el),
  working: 'See the note under the tool.',
  source: 'OSG USA Tapping Guide vol. 3 (2024); FM Carbide TechTips; Engineers Edge; forming taps also North American Tool, Besly (Cutting Tool Engineering 1995) and MSC; suggested engagement USCTI tapping tip, FM Carbide, Besly. ISO 68-1:2023, ASME B1.1-2024.',
},
{
  id: 'taplimits', level: 'expert', group: 'Drilling and tapping', title: 'Tap pitch diameter limits (H and D numbers)',
  desc: 'Pitch diameter band of an inch H (and L) or metric D limit tap, checked against the internal thread class (2B, 3B, 1B, 6H, 5H, 7H, 6G), with a suggested limit number and the makers\' printed recommendation where one is in hand.',
  render: el => renderTapLimits(el),
  working: 'See the note under the tool. H n: max = basic + n x 0.0005 in, band 0.0005 in through 1 in; D n: max = basic + n x 0.0005 in (OSG) or n x 0.013 mm (USCTI).',
  source: 'OSG USA tap drill and pitch diameter limit chart vol. 3 (2024); USCTI / GWS Tool Group; MSC; Cutting Tool Supply. Internal thread limits: ASME B1.1, ISO 965-1 formulas (Thread data tool).',
},
{
  id: 'chatter', level: 'expert', group: 'Chatter and vibration', title: 'Chatter finder (stable speeds)',
  desc: 'Listen to a cut through the microphone, or type the chatter frequency, and get the tooth passing frequency and the spindle speeds where a whole number of chatter waves fit between teeth. A rule-of-thumb lobe estimate, not a full stability lobe diagram.',
  render: el => renderChatter(el),
  working: 'Tooth passing frequency f_t = n z / 60 (lathe: z = 1). Stable speed estimate for lobe N = 0, 1, 2 ...: n = 60 fc / (z (N + 1)): the tooth period then holds a whole number of chatter waves, so the wavy surface left by one tooth lines up with the next and does not feed the vibration. fc / f_t gives the lobe the cut is in now. Spectrum: Hann window, radix-2 FFT in the Rust core, averaged over a few frames; peaks within the tolerance of a spindle harmonic (runout, tooth passing and their multiples) are marked and skipped. The chatter frequency sits a little above the natural frequency it comes from, so after a change of speed listen again (Smith and Tlusty repeat the step until it settles). Use the running spindle speed, not the commanded one. Nothing is recorded or stored: the audio stays in this page while you listen and is dropped when you stop.',
  source: 'S. Smith, Finding harmony in stable cutting, Cutting Tool Engineering, Dec. 2010; S. Smith and J. Tlusty, CIRP Annals 41(1), 1992; Y. Altintas, Manufacturing Automation, 2nd ed., Ch. 3; Cooley and Tukey (1965), FFT. See docs/sources.md.',
},
{
  id: 'grindspeed', level: 'advanced', group: 'Grinding', title: 'Wheel and work speed, equivalent diameter',
  desc: 'Wheel surface speed or rpm, work speed and the speed ratio, equivalent wheel diameter for external, internal and surface grinding, contact length, specific removal rate and equivalent chip thickness. Always obey the maximum operating speed marked on the wheel; BenchMate never assumes one.',
  fields: s => [
    { id: 'mode', label: 'Operation', unit: '', def: 0, options: [[0, 'External cylindrical'], [1, 'Internal'], [2, 'Surface']] },
    { id: 'ds', label: 'Wheel diameter', unit: lenU(s), def: s === 'inch' ? 14 : 350 },
    { id: 'ns', label: 'Wheel speed', unit: 'RPM', def: '' },
    { id: 'vs', label: 'Or wheel surface speed wanted', unit: s === 'inch' ? 'SFPM' : 'm/s', def: '' },
    { id: 'vmax', label: 'Max operating speed marked on the wheel', unit: s === 'inch' ? 'SFPM' : 'm/s', def: '' },
    { id: 'nmax', label: 'Or max rpm marked on the wheel', unit: 'RPM', def: '' },
    { id: 'dw', label: 'Work diameter (cylindrical, internal: bore)', unit: lenU(s), def: s === 'inch' ? 2 : 50 },
    { id: 'nw', label: 'Work speed (cylindrical)', unit: 'RPM', def: '' },
    { id: 'vt', label: 'Or table speed (surface)', unit: s === 'inch' ? 'ft/min' : 'm/min', def: '' },
    { id: 'ae', label: 'Depth of cut per pass', unit: lenU(s), def: '' },
  ],
  calc: (v, W, s) => {
    if (!(v.ds > 0)) return [];
    const k = s === 'inch' ? IN_MM : 1, inch = s === 'inch', rows = [];
    const toMs = x => inch ? x * FT_M / 60 : x, fromMs = x => inch ? x * 60 / FT_M : x, vU = inch ? 'SFPM' : 'm/s';
    let ns = v.ns > 0 ? v.ns : NaN;
    if (!(ns > 0) && v.vs > 0) { ns = W.wheel_rpm_ms(toMs(v.vs), v.ds * k); rows.push(R('Wheel rpm for that surface speed', ns, 'RPM', 0, 'rpm')); }
    let vs = NaN;
    if (ns > 0) { vs = W.wheel_speed_ms(v.ds * k, ns); rows.push(R('Wheel surface speed', fromMs(vs), vU, inch ? 0 : 2)); if (inch) rows.push(R('Wheel surface speed', vs, 'm/s', 2)); }
    if (v.vmax > 0 || v.nmax > 0) {
      const over = (v.vmax > 0 && vs > toMs(v.vmax) * (1 + 1e-12)) || (v.nmax > 0 && ns > v.nmax);
      rows.push(R('Marked maximum', !(ns > 0) ? 'Enter the wheel rpm or surface speed to compare' : over ? 'OVER the maximum marked on the wheel: do not run it' : 'Within the marked maximum', '', 0));
      if (v.vmax > 0) rows.push(R('Highest rpm allowed by the marked speed at this diameter', W.wheel_rpm_ms(toMs(v.vmax), v.ds * k), 'RPM', 0));
    } else rows.push(R('Marked maximum', 'Not entered: read the maximum operating speed on the wheel (or its label) and never exceed it', '', 0));
    const de = W.equiv_dia(v.dw > 0 ? v.dw * k : 0, v.ds * k, v.mode);
    if (isFinite(de)) rows.push(R('Equivalent wheel diameter de', de / k, lenU(s), inch ? 3 : 2));
    else if (v.mode === 1) rows.push(R('Equivalent diameter', 'Internal: the wheel must be smaller than the bore', '', 0));
    let vw = NaN; // m/min
    if (v.mode !== 2 && v.dw > 0 && v.nw > 0) { vw = W.vc_from_rpm(v.nw, v.dw * k); rows.push(R('Work surface speed', inch ? vw / FT_M : vw, inch ? 'SFM' : 'm/min', 1)); }
    if (v.mode === 2 && v.vt > 0) vw = inch ? v.vt * FT_M : v.vt;
    if (vs > 0 && vw > 0) rows.push(R('Speed ratio q = vs / vw', W.speed_ratio(vs, vw), '', 1));
    if (v.ae > 0 && isFinite(de)) {
      rows.push(R('Contact length sqrt(ae de)', W.contact_length(v.ae * k, de) / k, lenU(s), inch ? 4 : 3));
      if (vw > 0) { const q = W.specific_mrr(v.ae * k, vw); rows.push(R("Specific removal rate Q'w", inch ? q * 60 / 645.16 : q, inch ? 'in3/min per in' : 'mm3/mm/s', 3)); if (vs > 0) rows.push(R('Equivalent chip thickness heq', W.equiv_chip_um(v.ae * k, vw, vs) * (inch ? 1000 / IN_MM : 1), inch ? 'uin' : 'um', 4)); }
    }
    return rows;
  },
  working: 'Wheel speed vs = pi ds ns / 60 000 m/s (ds in mm), SFPM = pi ds(in) ns / 12. Work speed vw = pi dw nw / 1000 m/min. Speed ratio q = vs x 60 / vw. Equivalent diameter de = dw ds / (dw + ds) external, dw ds / (dw - ds) internal, ds surface. Contact length lg = sqrt(ae de). Specific removal rate Q\'w = ae vw (mm3/mm/s with vw in mm/s); equivalent chip thickness heq = ae vw / vs. The maximum operating speed is marked on every wheel larger than 80 mm (or on its label or a notice) and must not be exceeded; it depends on the wheel, not on anything BenchMate can work out.',
  source: 'D. S. Goetz, Cutting Tool Engineering, 24 Oct 2017 (sfpm, de external, contact length); S. Malkin and C. Guo, Grinding Technology, 2nd ed., 2008 (de internal and surface, Q\'w, heq); W. B. Rowe, Principles of Modern Grinding Technology, 2nd ed., 2014 (speed ratio). Wheel marking: ISO 525:2020, EN 12413, ANSI B7.1 (cited by name). See docs/sources.md.',
},
{
  id: 'gundrill', level: 'advanced', group: 'Drilling and tapping', title: 'Gun drilling: speed, feed, coolant pressure and flow',
  desc: 'Starting values for a single-flute gundrill: cutting speed by material and hardness, feed per revolution by diameter, coolant pressure and flow, the longest unsupported drill length and the time to drill. One maker\'s tables with a second maker\'s ranges beside them for the steels.',
  render: el => renderGunDrill(el),
  working: 'rpm = 12 x SFM / (pi x D in); feed rate = feed per revolution x rpm; over 30 diameters deep the feed is cut by 20 %; table values between two sizes are taken on a straight line. See the note under the tool.',
  source: 'Sterling Gun Drills catalogue (speed chart, feed table, oil pressure and flow); botek catalogue ELB/ZLB, Type 110 guide values (steels, for comparison); UNISIG deep hole drilling technical reference; Master Fluid Solutions technical bulletin 109; Cutting Tool Engineering, "Conventional thinking", 2016; Hartner, Ingersoll and ISCAR catalogue notes. See docs/sources.md, Gun drilling.',
},
{
  id: 'threadgauge', level: 'advanced', group: 'Threads', title: 'Thread gauge limits (GO and NOT GO)',
  desc: 'Pitch diameter limits of GO and NOT GO thread plug and ring gauges for Unified threads, classes 2A, 2B, 3A and 3B: which limit of the thread each member is made to, the gauge maker\'s X tolerance and which side it lies on, with a published gauge chart beside the result.',
  render: el => renderThreadGauge(el),
  working: 'GO plug: smallest internal pitch diameter, tolerance plus. NOT GO plug: largest, tolerance minus. GO ring: largest external pitch diameter, tolerance minus. NOT GO ring: smallest, tolerance plus. See the note under the tool.',
  source: 'Thread Check Inc., catalogue p. 52 (X tolerances) and fixed limit gage fact sheet; Royal Oak Gage, class X tolerances; Vermont Gage and Westport standard pitch diameter charts. Thread limits: ASME B1.1 formulas (Thread data tool). ASME B1.2 cited by name. See docs/sources.md, Thread gauge limits.',
},
{
  id: 'rollblank', level: 'advanced', group: 'Threads', title: 'Rolled thread blank diameter',
  desc: 'Diameter to turn a blank to before thread rolling, for ISO metric and Unified external threads: a thread roll maker\'s rule from the maximum pitch diameter, the handbook\'s amounts beside it, and the correction to the blank after measuring a trial.',
  render: el => renderRollBlank(el),
  working: 'Blank = maximum pitch diameter less 0.002 in (0.051 mm). After a trial: change of blank = (middle of the major diameter limits less the measured major diameter) / 3. See the note under the tool.',
  source: 'CJWinter, "Pitch diameter, major diameter, blank diameter" (2017) and Engineering bulletin: blank design (2016); Machinery\'s Handbook, 31st ed., thread rolling, p. 2188. Thread limits: ISO 965-1 and ASME B1.1 formulas (Thread data tool). See docs/sources.md, Rolled thread blank.',
},
{
  id: 'holdertorque', level: 'advanced', group: 'Setup', title: 'Collet nut and pull stud torque',
  desc: 'How tight to pull an ER collet nut, by collet size, bore and nut, with the most the maker allows, and pull stud (retention knob) torque for 30, 40 and 50 taper holders. Each maker\'s printed figures side by side; they differ, and nothing is averaged.',
  render: el => renderHolderTorque(el),
  working: 'The recommended torque is read from the maker\'s table (N·m); the ceiling is the recommended torque plus 25 %; N·m and lbf·ft are converted with 1 lbf·ft = 1.3558 N·m. See the note under the tool.',
  source: 'REGO-FIX, recommended tightening torque for Hi-Q/ER clamping nuts and maximum torques for retention knobs (catalogue pp. 293 to 294); REGO-FIX, ER Technical Information, Section 14, Edition 9/2009 (the 25 % rule); Techniks torque specifications chart; MariTool retention knob FAQ. See docs/sources.md, Collet nut and pull stud torque.',
},
{
  id: 'grindratio', level: 'advanced', group: 'Grinding', title: 'Wheel to work rpm ratio (waviness check)',
  desc: 'Cylindrical grinding: the wheel rpm divided by the work rpm. At a whole-number ratio a wheel that runs out or is out of balance puts its waves in the same place on every turn of the work. Shows the ratio, how close it is to a whole number or a simple fraction, the work speeds to stay away from, what happens as the wheel wears, and what a count of chatter marks points to.',
  fields: s => [
    { id: 'ds', label: 'Wheel diameter', unit: lenU(s), def: s === 'inch' ? 20 : 500 },
    { id: 'ns', label: 'Wheel speed', unit: 'RPM', def: '' },
    { id: 'vs', label: 'Or wheel surface speed (held as the wheel wears)', unit: s === 'inch' ? 'SFPM' : 'm/s', def: s === 'inch' ? 8000 : 40 },
    { id: 'nw', label: 'Work speed', unit: 'RPM', def: 200 },
    { id: 'dmin', label: 'Wheel diameter when worn (optional)', unit: lenU(s), def: '' },
    { id: 'dw', label: 'Work diameter (optional)', unit: lenU(s), def: '' },
    { id: 'marks', label: 'Chatter marks counted round the work (optional)', unit: '', def: '' },
  ],
  calc: (v, W, s) => {
    if (!(v.ds > 0 && v.nw > 0)) return [];
    const inch = s === 'inch', k = inch ? IN_MM : 1, toMs = x => inch ? x * FT_M / 60 : x, fromMs = x => inch ? x * 60 / FT_M : x, vU = inch ? 'SFPM' : 'm/s';
    const byRpm = v.ns > 0, ns = byRpm ? v.ns : (v.vs > 0 ? W.wheel_rpm_ms(toMs(v.vs), v.ds * k) : NaN);
    if (!(ns > 0)) return [];
    const ratio = W.rpm_ratio(ns, v.nw), tol = W.rpm_ratio_tol(), cls = W.rpm_ratio_class(ratio, tol), n = Math.floor(ratio);
    const FR = [[1, 4], [1, 3], [1, 2], [2, 3], [3, 4]], fr = FR[W.rpm_ratio_near_fraction(ratio)];
    const rows = [R('Rpm ratio (wheel rpm / work rpm)', ratio, '', 4)];
    rows.push(R('Verdict', cls === 1 ? 'Close to a whole number (' + Math.round(ratio) + '): a wheel that runs out or is out of balance puts its waves in the same place on every turn of the work, and they build up. Change the work speed.'
      : cls === 2 ? 'Close to ' + (n ? n + ' ' : '') + fr[0] + '/' + fr[1] + ': the waves of one turn fall between those of the turns before in a pattern that repeats, which leaves scallops. Change the work speed.'
        : 'Not close to a whole number or a simple fraction: each turn of the work wipes out the waves of the turn before. This is what to aim for.', '', 0));
    rows.push(R('From the nearest whole number', W.rpm_ratio_off_whole(ratio), '', 4), R('From the nearest of 1/4, 1/3, 1/2, 2/3, 3/4', W.rpm_ratio_off_fraction(ratio), '', 4),
      R('Limit used for "close to" (BenchMate\'s choice, see Working)', tol, '', 2));
    if (byRpm) rows.push(R('Wheel surface speed', fromMs(W.wheel_speed_ms(v.ds * k, ns)), vU, inch ? 0 : 2)); else rows.push(R('Wheel rpm for that surface speed', ns, 'RPM', 1));
    rows.push(R('Wheel, once per revolution', W.rev_frequency_hz(ns), 'Hz', 2), R('Waves per turn of the work from wheel runout or unbalance', ratio, '', 2));
    if (v.dw > 0) rows.push(R('Spacing of those waves round the work', W.wave_spacing(v.dw, ratio), lenU(s), inch ? 4 : 3));
    const avoid = [[1, 1], [3, 4], [2, 3], [1, 2], [1, 3], [1, 4], [0, 1]].map(([a, b]) => ({ r: n + a / b, t: a === 0 ? String(n) : a === b ? String(n + 1) : (n ? n + ' ' : '') + a + '/' + b })).filter(x => x.r > 0);
    rows.push(R('Work speeds to stay away from', avoid.map(x => 'ratio ' + x.t + ': ' + W.work_rpm_for_ratio(ns, x.r).toFixed(1) + ' rpm').join('; '), '', 0));
    if (v.dmin > 0 && v.dmin < v.ds) {
      if (byRpm) rows.push(R('As the wheel wears', 'At a constant wheel rpm the ratio stays where it is. The surface speed falls to ' + fromMs(W.wheel_speed_ms(v.dmin * k, ns)).toFixed(inch ? 0 : 2) + ' ' + vU + ' at the worn diameter.', '', 0));
      else {
        const ns2 = W.wheel_rpm_ms(toMs(v.vs), v.dmin * k), r2 = W.rpm_ratio(ns2, v.nw), pass = [];
        for (let i = Math.ceil(ratio); i <= Math.floor(r2) && pass.length < 40; i++) pass.push(i);
        rows.push(R('Wheel rpm when worn', ns2, 'RPM', 1), R('Rpm ratio when worn', r2, '', 4),
          R('Whole numbers passed as the wheel wears', pass.length ? pass.join(', ') + '. At a constant surface speed the wheel rpm rises as the wheel wears, so the ratio passes through these (and the fractions between). Holding the wheel rpm, or setting the work rpm from the wheel rpm so that the ratio stays the same, avoids it.' : 'None between the new and the worn diameter.', '', 0));
      }
    }
    if (v.marks > 0) rows.push(R('Frequency of the marks', W.marks_frequency_hz(v.marks, v.nw), 'Hz', 1), R('Marks counted against the rpm ratio', W.marks_vs_ratio_pct(v.marks, ratio), '%', 1),
      R('What the count points to', 'A count close to the rpm ratio points to the wheel (out of true or out of balance). To be sure, change the wheel speed and count again: marks that follow the new ratio come from the wheel; marks that stay at the same frequency are self-excited chatter.', '', 0));
    return rows;
  },
  working: 'Rpm ratio = wheel rpm / work rpm. A wheel that runs out or is out of balance touches the work hardest once per wheel revolution, so it leaves that many waves per turn of the work. At a whole-number ratio the waves land in the same place on every turn and build up; at a simple fraction (1/4, 1/3, 1/2, 2/3, 3/4) they land in a pattern that repeats after a few turns; at a "long decimal" each turn wipes out the last. Work rpm for a ratio = wheel rpm / ratio. Frequency of marks = marks per turn x work rpm / 60 Hz; spacing = pi x work diameter / waves. No source gives a figure for "close to": BenchMate uses 0.02, which sits between the author\'s examples (8.0000, 9.013 and 8.9924 called bad; 9.36488 and 8.916742 called good). Varying the work rpm a few percent during the cut is the other remedy the author gives. All numbers come from the Rust core.',
  source: 'J. Badger, "Ask the Grinding Doc", Cutting Tool Engineering: "Overcoming waviness" (15 Jun 2010), "Origins of chatter" (15 Apr 2011), "Varying the workpiece rpm" (18 Apr 2025). One author, so the rule is single-source. T. R. A. Pearce, D. C. Fricker, A. Speight, Proc. IMechE Part B, vol. 220 no. 8, 2006 (abstract only read) supports the mechanism: wheel run-out, the rpm ratio of wheel to workpiece and the shift of the waves from one work revolution to the next decide the roundness. See docs/sources.md, Grinding.',
  proof: [{ name: 'Wheel worn from 500 to 350 mm at 40 m/s, work at 200 rpm', sys: 'mm', vals: { ds: 500, ns: '', vs: 40, nw: 200, dmin: 350, dw: '', marks: '' }, expect: [['Wheel rpm for that surface speed', 'RPM', 1528, 0.5], ['Rpm ratio (wheel', '', 7.63, 0.011], ['Wheel rpm when worn', 'RPM', 2182, 1], ['Rpm ratio when worn', '', 10.91, 0.005]],
    source: 'J. Badger, "Overcoming waviness", Cutting Tool Engineering, 2010: 1,528 to 2,182 rpm, ratio 7.63 to 10.91, passing eight, nine and ten. (1,528 / 200 is 7.64; the article prints 7.63.)' },
  { name: '16 in wheel at 12,000 sfm, work at 40 rpm, 70 marks counted', sys: 'inch', vals: { ds: 16, ns: '', vs: 12000, nw: 40, dmin: '', dw: '', marks: 70 }, expect: [['Rpm ratio (wheel', '', 71.65, 0.04], ['Frequency of the marks', 'Hz', 47, 0.5]],
    source: 'J. Badger, "Origins of chatter", Cutting Tool Engineering, 2011: 2,866 rpm, ratio 71.65, 47 Hz. The article works with pi = 3.14; with pi the wheel turns 2,864.8 rpm and the ratio is 71.62.' }],
},
{
  id: 'grindtime', level: 'advanced', group: 'Grinding', title: 'Cylindrical traverse and plunge time',
  desc: 'Traverse rate from the cross-feed per work revolution (a fraction of the wheel width that you choose), overlap ratio and traverse grinding time, and plunge grinding time with spark-out.',
  fields: s => [
    { id: 'bs', label: 'Wheel width', unit: lenU(s), def: s === 'inch' ? 1 : 25 },
    { id: 'fa', label: 'Traverse per work revolution', unit: lenU(s), def: '' },
    { id: 'frac', label: 'Or traverse as a fraction of the wheel width', unit: 'x bs', def: '' },
    { id: 'nw', label: 'Work speed', unit: 'RPM', def: '' },
    { id: 'L', label: 'Traverse length (with overrun)', unit: lenU(s), def: '' },
    { id: 'passes', label: 'Number of traverse passes (incl. spark-out)', unit: '', def: '' },
    { id: 'stock', label: 'Plunge: radial stock', unit: lenU(s), def: '' },
    { id: 'vfr', label: 'Plunge: radial infeed rate', unit: feedMinU(s), def: '' },
    { id: 'dw', label: 'Plunge: work diameter (for removal rate)', unit: lenU(s), def: '' },
    { id: 'spark', label: 'Plunge: spark-out time', unit: 's', def: '' },
  ],
  calc: (v, W, s) => {
    const k = s === 'inch' ? IN_MM : 1, rows = [];
    const fa = v.fa > 0 ? v.fa : (v.frac > 0 && v.bs > 0 ? v.frac * v.bs : NaN);
    if (fa > 0) {
      if (!(v.fa > 0)) rows.push(R('Traverse per work revolution', fa, lenU(s), s === 'inch' ? 4 : 3));
      if (v.bs > 0) rows.push(R('Overlap ratio bs / fa', W.overlap_ratio(v.bs, fa), '', 2));
      if (v.nw > 0) { rows.push(R('Traverse rate', W.traverse_speed(fa, v.nw), feedMinU(s), s === 'inch' ? 2 : 0, 'feed'));
        if (v.L > 0 && v.passes > 0) rows.push(R('Traverse grinding time', W.traverse_time(v.L, fa, v.nw, v.passes), 'min', 3)); }
    }
    if (v.stock > 0 && v.vfr > 0) {
      const t = W.plunge_time(v.stock, v.vfr, v.spark > 0 ? v.spark : 0);
      rows.push(R('Plunge grinding time', t, 'min', 3), R('Plunge grinding time', t * 60, 's', 1));
      if (v.dw > 0) { const q = W.plunge_specific_mrr(v.dw * k, v.vfr * k); rows.push(R("Specific removal rate Q'w", s === 'inch' ? q * 60 / 645.16 : q, s === 'inch' ? 'in3/min per in' : 'mm3/mm/s', 3)); }
    }
    return rows;
  },
  working: 'Traverse per work revolution fa (or a chosen fraction of the wheel width bs); traverse rate = fa x nw; overlap ratio = bs / fa (how many times each point is passed by the wheel width). Traverse time = L / (fa nw) x passes. Plunge: time = radial stock / radial infeed rate + spark-out; Q\'w = pi dw vfr / 60 (mm3/mm/s). The fraction of wheel width, infeed rates and spark-out are process choices: take them from your wheel maker or your own records.',
  source: 'W. B. Rowe, Principles of Modern Grinding Technology (overlap ratio); S. Malkin and C. Guo, Grinding Technology (removal rate). Times are distance / rate.',
},
{
  id: 'grindsurf', level: 'advanced', group: 'Grinding', title: 'Surface grinding time',
  desc: 'Number of strokes and passes and the grinding time on a reciprocating surface grinder, from the table speed, cross-feed per stroke and down-feed per pass.',
  fields: s => [
    { id: 'L', label: 'Length of the part (along the table)', unit: lenU(s), def: s === 'inch' ? 8 : 200 },
    { id: 'ot', label: 'Overtravel at each end', unit: lenU(s), def: s === 'inch' ? 0.75 : 20 },
    { id: 'ct', label: 'Cross travel per layer (part width - wheel width + overrun)', unit: lenU(s), def: s === 'inch' ? 2 : 50 },
    { id: 'cf', label: 'Cross-feed per stroke', unit: lenU(s), def: '' },
    { id: 'vt', label: 'Table speed', unit: s === 'inch' ? 'ft/min' : 'm/min', def: '' },
    { id: 'stock', label: 'Stock to remove (depth)', unit: lenU(s), def: '' },
    { id: 'down', label: 'Down-feed per pass (layer)', unit: lenU(s), def: '' },
    { id: 'spark', label: 'Spark-out passes', unit: '', def: '' },
    { id: 'both', label: 'Grinding', unit: '', def: 1, options: [[1, 'Both directions (cross-feed at each end)'], [0, 'One direction only']] },
  ],
  calc: (v, W, s) => {
    const k = s === 'inch' ? IN_MM : 1;
    if (!(v.L > 0 && v.cf > 0 && v.vt > 0 && v.stock > 0 && v.down > 0)) return [];
    const vt = s === 'inch' ? v.vt * FT_M : v.vt, a = [v.L * k, (v.ot > 0 ? v.ot : 0) * k, (v.ct > 0 ? v.ct : 0) * k, v.cf * k, vt, v.stock * k, v.down * k, v.spark > 0 ? v.spark : 0, v.both];
    const t = W.surface_grind(...a, 0);
    return [R('Strokes per layer', W.surface_grind(...a, 1), '', 0), R('Layers (passes, incl. spark-out)', W.surface_grind(...a, 2), '', 0),
      R('Time per stroke', (v.L + 2 * (v.ot > 0 ? v.ot : 0)) * k / (vt * 1000) * 60, 's', 2), R('Grinding time', t, 'min', 2), R('Grinding time', t * 60, 's', 0)];
  },
  working: 'Stroke length = L + 2 x overtravel; time per stroke = stroke / table speed (twice that when grinding one way only, as the table returns empty). Strokes per layer = ceil(cross travel / cross-feed) + 1. Layers = ceil(stock / down-feed) + spark-out passes. Time = strokes x layers x time per stroke. Table reversal, wheel dressing and loading are not included.',
  source: 'Distance / rate arithmetic; surface grinding kinematics as in W. B. Rowe, Principles of Modern Grinding Technology.',
},
{
  id: 'gritconv', level: 'advanced', group: 'Grinding', title: 'Grit size conversion',
  desc: 'FEPA F (grinding wheels), ANSI / US mesh and FEPA P (coated) grit sizes in micrometres, as printed by two publishers each, with the nearest sizes in the other systems. Disagreements between publishers are shown.',
  render: el => renderGritConv(el),
  working: 'Sizes are what the publishers print (see the note under the tool for what each number means). Coarse grits are graded with sieves and fine grits by sedimentation, so a coarse grit size is a sieve opening, not a mean grain size. Nearest equivalents compare the first printed size of each grit and are only approximate.',
  source: 'Noritake (JIS R6001 tables), Hapstone, Ted Pella (3M), Steel Data. Standards cited by name: ISO 8486-1:1996 and ISO 8486-2:2007 (F grits), ISO 6344-2/-3:2021 (P grits), FEPA 42 and 43, ANSI B74.12 / B74.10 / B74.18.',
},
{
  id: 'wheelcode', level: 'advanced', group: 'Grinding', title: 'Grinding wheel marking decoder',
  desc: 'Decode a conventional (aluminium oxide or silicon carbide) grinding wheel specification such as A46-K8V or WA 60 K 7 V: abrasive, grit size, grade, structure, bond and the maker\'s record, with how many publishers print each meaning.',
  render: el => renderWheelCode(el),
  working: 'Order: abrasive (letters, often with a maker\'s number in front), grit (number), grade (letter A soft to Z hard), structure (number, low dense, high open; optional), bond (letters), maker\'s record. Letter meanings come from wheel makers and training publishers; where they differ (E, O, AZ), all are shown. Diamond and CBN wheels use a different marking and are not decoded here.',
  source: 'ISO 525:2020 (confirmed 2026) and ANSI B74.13-2016, cited by name; meanings as printed by United Abrasives, CGW, the US Navy Machinery Repairman manual and High Speed Training.',
},
{
  id: 'wires', level: 'advanced', group: 'Threads', title: 'Thread measurement over wires',
  desc: 'Pitch diameter, best wire size and the measurement over three wires for 60 degree (UN, metric), 55 degree (Whitworth), 29 degree (ACME) and 30 degree (trapezoidal) threads.',
  fields: s => [
    { id: 'form', label: 'Thread form', unit: '', def: 60, options: [[60, '60 deg: UN, ISO metric'], [55, '55 deg: Whitworth, BSP'], [29, '29 deg: ACME'], [30, '30 deg: trapezoidal'], [291, '29 deg: Stub ACME']] },
    { id: 'major', label: 'Major diameter', unit: lenU(s), def: s === 'inch' ? 0.5 : 10 },
    { id: 'pitch', label: s === 'inch' ? 'Threads per inch (TPI)' : 'Pitch', unit: s === 'inch' ? 'TPI' : 'mm', def: s === 'inch' ? 13 : 1.5 },
    { id: 'wire', label: 'Wire diameter (blank = best size)', unit: lenU(s), def: '' },
    { id: 'pd', label: 'Or known pitch diameter (wins over the basic)', unit: lenU(s), def: '' },
  ],
  calc: (v, W, s) => {
    if (!(v.major > 0 && v.pitch > 0)) return [];
    const p = s === 'inch' ? 1 / v.pitch : v.pitch, f = v.form || 60, a = f === 291 ? 29 : f;
    // Basic pitch diameter of each form: D - 0.649519 P (60), D - 0.640327 P (55), D - 0.5 P (ACME, Tr), D - 0.3 P (Stub ACME).
    const e = v.pd > 0 ? v.pd : f === 60 ? W.thread_pitch_dia_basic(v.major, p) : f === 55 ? W.whitworth_value(v.major, p, 0) : f === 291 ? v.major - 0.3 * p : v.major - 0.5 * p;
    const best = W.thread_misc(p, a, 1);
    const w = v.wire > 0 ? v.wire : best;
    return [
      R(v.pd > 0 ? 'Pitch diameter (entered)' : 'Basic pitch diameter', e, lenU(s), 5),
      R('Best wire size', best, lenU(s), 5),
      R('Measurement over three wires', W.wire_measurement(e, w, p, a, 0), lenU(s), 5),
    ];
  },
  working: 'Best wire w = P / (2 cos(a/2)): 0.57735 P (60 deg), 0.56368 P (55), 0.51645 P (29), 0.51764 P (30). M = E + w (1 + 1 / sin(a/2)) - (P/2) cot(a/2): for 60 deg M = E + 3w - 0.866025 P; 55 deg E + 3.1657 w - 0.9605 P; 29 deg E + 4.9939 w - 1.9334 P. Basic E = D - 0.649519 P (60), D - 0.640327 P (55), D - 0.5 P (ACME, trapezoidal), D - 0.3 P (Stub ACME). Lead-angle correction neglected: on ACME and other coarse or multi-start threads it is not small, and the measurement should be corrected as the standard (or the wire maker) describes.',
  source: "Machinery's Handbook (screw thread measurement), NBS Handbook H28 (wire method); the general angle form is geometry (docs/sources.md, Threads round 3).",
},
{
  id: 'threaddata', level: 'simple', group: 'Threads', title: 'Thread data and limits',
  desc: 'Basic dimensions of ISO metric (coarse and fine) and Unified (UNC, UNF, UNEF) threads from the basic profile, with ISO 6g/6H and Unified 2A/3A/2B/3B limits computed from the standards\' formulas and checked against published tables.',
  render: el => renderThreadData(el),
  working: 'See the note under the tool.',
  source: 'ISO 68-1:2023, ISO 261:1998, ISO 262:2023, ISO 965-1:2013 (revised 2026), ASME B1.1-2024; series and published limits from the publishers listed under the tool.',
},
{
  id: 'threadid', level: 'advanced', group: 'Threads', title: 'Thread identifier',
  desc: 'Measure the diameter and the pitch of an unknown screw, nut or tapped hole and it lists the closest standard threads: ISO metric, Unified, Whitworth, BSP, NPT, BA, ACME, trapezoidal and miniature.',
  render: el => renderThreadId(el),
  working: 'See the note under the tool.',
  source: "The sizes, pitches and basic diameters are those of the thread tools, with their standards and publishers. The search rule is BenchMate's own (tests in core/src/thread_forms.rs).",
},
{
  id: 'pipethreads', level: 'simple', group: 'Threads', title: 'Pipe threads (BSP and NPT)',
  desc: 'BSP parallel (G, ISO 228-1) and taper (R / Rc / Rp, ISO 7-1) and NPT (ASME B1.20.1): threads per inch, diameters, pitch diameters, gauge and engagement lengths.',
  render: el => renderPipeThreads(el),
  working: 'See the note under the tool.',
  source: 'ISO 228-1:2000, ISO 7-1:1994 (with Cor 1:2007), ASME B1.20.1-2013 (reaffirmed 2018); series values from the publishers listed under the tool.',
},
{
  id: 'whitworth', level: 'advanced', group: 'Threads', title: 'Whitworth and BA threads',
  desc: 'BSW, BSF (BS 84) and BA (BS 93) threads: threads per inch, pitch, major, effective and minor diameters, thread depth and radius.',
  render: el => renderWhitworth(el),
  working: 'See the note under the tool.',
  source: 'BS 84:2007, BS 93:2008; series values from the publishers listed under the tool.',
},
{
  id: 'acme', level: 'advanced', group: 'Threads', title: 'ACME and Stub ACME threads',
  desc: 'ACME general purpose (2G, 3G, 4G) and centralizing (2C, 3C, 4C) threads to ASME B1.5, and Stub ACME to ASME B1.8: basic dimensions, limits of size for screw and nut, lead angle and best wire.',
  render: el => renderAcme(el),
  working: 'See the note under the tool.',
  source: 'ASME B1.5-1997 (R2024), ASME B1.8-1988 (R2021); formulas confirmed in NBS Handbook H28 (1957) and the publishers listed under the tool.',
},
{
  id: 'trapezoidal', level: 'advanced', group: 'Threads', title: 'Metric trapezoidal threads (Tr)',
  desc: 'ISO metric trapezoidal threads: clearance, pitch, minor and major diameters of screw and nut from the ISO 2904 basic profile, with lead for multi-start threads and best wire.',
  render: el => renderTrapezoidal(el),
  working: 'See the note under the tool.',
  source: 'ISO 2904:2020 (confirmed 2025), ISO 2901:2016, ISO 2903 (tolerances; BS ISO 2903:2016) (cited by name); published rows from the publishers listed under the tool.',
},
{
  id: 'buttress', level: 'expert', group: 'Threads', title: 'Buttress threads (7/45)',
  desc: 'ASME B1.9 inch buttress threads, 7 degree load flank and 45 degree clearance flank: basic thread heights, crest and root, pitch, minor and major diameters at maximum material.',
  render: el => renderButtress(el),
  working: 'See the note under the tool.',
  source: 'ASME B1.9-1973 (R2025), cited by name; constants as printed by AMESweb and derived from the geometry.',
},
{
  id: 'unseries', level: 'advanced', group: 'Threads', title: 'Constant-pitch UN series and UNS',
  desc: '8-UN, 12-UN and 16-UN constant-pitch series up to 2 in, with basic pitch and minor diameters, and how UNS (special) threads are designated.',
  render: el => renderUnSeries(el),
  working: 'See the note under the tool.',
  source: 'ASME B1.1-2024 (cited by name); series lists from AMESweb and Torqbolt.',
},
{
  id: 'unm', level: 'advanced', group: 'Threads', title: 'Unified miniature threads (UNM)',
  desc: 'UNM threads 0.30 to 1.40 mm (ASME B1.10M): pitch, basic and design diameters, root radii and published limits of size.',
  render: el => renderUnm(el),
  working: 'See the note under the tool.',
  source: 'ASME B1.10M-2004 (cited by name); Thread Check Inc. and AMESweb.',
},
{
  id: 'unjunr', level: 'expert', group: 'Threads', title: 'UNJ and UNR threads',
  desc: 'UNJ controlled root radius and increased internal minor diameter (ASME B1.15), and the UNR rounded-root rule for external Unified threads (ASME B1.1).',
  render: el => renderUnjUnr(el),
  working: 'See the note under the tool.',
  source: 'ASME B1.15-1995, ASME B1.1-2024 (cited by name); publishers listed under the tool.',
},
{
  id: 'sti', level: 'advanced', group: 'Threads', title: 'Helical insert (STI) tapped holes',
  desc: 'Tapped-hole thread for helical coil (wire) inserts: STI major, pitch and minor diameters from the nominal thread, with the insert makers\' published limits side by side.',
  render: el => renderSti(el),
  working: 'See the note under the tool.',
  source: 'Recoil (Alcoa Fastening Systems), Kato Fastening Systems and Heli-Coil data as reprinted by Vargus; NASM33537 and MA1567 cited by name.',
},
{
  id: 'coating', level: 'advanced', group: 'Threads', title: 'Plating and coating allowance on threads',
  desc: 'Pitch diameter change from a coating on the flanks (4 x thickness for 60 degree threads) and the before-coating pitch diameter limits, for screws, nuts and helical inserts.',
  render: el => renderCoating(el),
  working: 'See the note under the tool.',
  source: 'Thread Check Inc. and Kato Fastening Systems (4 x thickness rule); geometry for other thread angles.',
},
{
  id: 'multistart', level: 'advanced', group: 'Threads', title: 'Multi-start thread lead and pitch',
  desc: 'Lead from pitch and number of starts (or pitch from lead), lead angle at the pitch diameter, and how far to index or shift the tool between starts.',
  fields: s => [
    { id: 'pitch', label: s === 'inch' ? 'Pitch (distance between adjacent threads)' : 'Pitch P', unit: lenU(s), def: s === 'inch' ? 0.1 : 2 },
    { id: 'n', label: 'Number of starts', unit: '', def: 2 },
    { id: 'lead', label: 'Or known lead (wins over pitch)', unit: lenU(s), def: '' },
    { id: 'e', label: 'Pitch diameter (for the lead angle)', unit: lenU(s), def: s === 'inch' ? 0.9 : 18 },
  ],
  calc: (v, W, s) => {
    const n = Math.round(v.n);
    if (!(n >= 1)) return [];
    const lead = v.lead > 0 ? v.lead : v.pitch * n, p = lead / n;
    if (!(lead > 0)) return [];
    const r = [R('Lead L (axial advance per turn)', lead, lenU(s), 4), R('Pitch P = L / starts', p, lenU(s), 4),
      R(s === 'inch' ? 'Threads per inch (1 / P)' : 'Leads per 25.4 mm', s === 'inch' ? 1 / p : 25.4 / lead, s === 'inch' ? 'TPI' : '', 3),
      R('Index between starts (rotate the work)', 360 / n, 'deg', 2), R('Or shift the tool axially between starts', p, lenU(s), 4)];
    if (v.e > 0) r.push(R('Lead angle at the pitch diameter', W.thread_misc(lead, v.e, 2), 'deg', 3));
    return r;
  },
  working: 'L = n x P (n starts). Lead angle = atan(L / (pi E)). To cut the next start, either rotate the work 360 / n degrees with the tool where it is, or move the tool one pitch P along the axis (a G76 or G92 cycle started one pitch later in Z). Feed per revolution on the lathe is the lead, not the pitch.',
  source: 'Thread geometry (lead, pitch and helix angle); see docs/sources.md, Threads round 3.',
},
// ---------- Gears and splines (core/src/gears.rs, drawings in app/diagrams-eng.js) ----------
{
  id: 'spurgear', level: 'advanced', group: 'Gears and splines', title: 'Spur gear data',
  desc: 'Involute spur gear dimensions from the module (mm) or diametral pitch (inch): reference, base, tip and root diameters, addendum and dedendum, circular and base pitch, tooth thickness, undercut limit; give a second tooth count for the centre distance and contact ratio of the pair, with profile shift if used. Standard full-depth proportions (addendum 1, dedendum 1.25 times the module) are filled in; change them if your gear uses another basic rack.',
  fields: s => [
    s === 'inch' ? { id: 'mp', label: 'Diametral pitch P', unit: 'teeth/in', def: 10 } : { id: 'mp', label: 'Module m', unit: 'mm', def: 3 },
    { id: 'z1', label: 'Teeth, gear 1 (pinion)', unit: '', def: s === 'inch' ? 20 : 12 },
    { id: 'z2', label: 'Teeth, gear 2 (blank = one gear only)', unit: '', def: s === 'inch' ? 40 : 24 },
    { id: 'pa', label: 'Pressure angle', unit: 'deg', def: 20, options: [[20, '20°'], [14.5, '14.5°'], [25, '25°']] },
    { id: 'x1', label: 'Profile shift x, gear 1', unit: 'x m', def: 0 },
    { id: 'x2', label: 'Profile shift x, gear 2', unit: 'x m', def: 0 },
    { id: 'ha', label: 'Addendum factor ha*', unit: 'x m', def: 1 },
    { id: 'hf', label: 'Dedendum factor hf*', unit: 'x m', def: 1.25 },
  ],
  calc: (v, W, s) => {
    const m = gearMod(v.mp, s), u = lenU(s), x1 = isFinite(v.x1) ? v.x1 : 0, x2 = isFinite(v.x2) ? v.x2 : 0;
    if (!(m > 0 && v.z1 >= 3 && v.pa > 0 && v.ha > 0 && v.hf > 0)) return [];
    const g = i => W.gear_spur(m, v.z1, v.pa, x1, v.ha, v.hf, i), dp = s === 'inch' ? 4 : 3;
    const rows = [];
    if (s === 'inch') rows.push(R('Module equivalent (25.4 / P)', 25.4 / v.mp, 'mm', 4));
    rows.push(R('Involute function of the pressure angle', W.gear_involute(v.pa), '', 6));
    rows.push(R('Circular pitch p = π m', g(7), u, dp + 1), R('Base pitch pb = p cos α', g(8), u, dp + 1));
    const one = (n, gi, z) => {
      rows.push(R(n + ': reference (pitch) diameter', gi(0), u, dp), R(n + ': base diameter', gi(1), u, dp),
        R(n + ': tip (outside) diameter', gi(2), u, dp), R(n + ': root diameter', gi(3), u, dp),
        R(n + ': addendum', gi(4), u, dp), R(n + ': dedendum', gi(5), u, dp), R(n + ': whole depth', gi(6), u, dp),
        R(n + ': tooth thickness on the reference circle (arc)', gi(9), u, dp + 1),
        R(n + ': tooth thickness at the tip (arc)', gi(13), u, dp + 1));
      const xm = gi(12);
      rows.push(R(n + ': smallest profile shift without undercut', xm, 'x m', 3));
      const cn = W.involute_cutter_no(z, s === 'inch' ? 0 : 1);
      if (isFinite(cn)) rows.push(R(n + ': involute form cutter number (' + (s === 'inch' ? 'diametral pitch' : 'module') + ' set of eight)', cn, '', 0));
    };
    one('Gear 1', g, v.z1);
    rows.push(R('Fewest teeth without undercut (x = 0)', g(11), '', 2));
    if (v.z2 >= 3) {
      const g2 = i => W.gear_spur(m, v.z2, v.pa, x2, v.ha, v.hf, i);
      const p = i => W.gear_spur_pair(m, v.z1, v.z2, v.pa, x1, x2, v.ha, v.hf, i);
      one('Gear 2', g2, v.z2);
      rows.push(R('Ratio z2 / z1', v.z2 / v.z1, '', 4));
      rows.push(R('Standard centre distance (no shift)', p(3), u, dp));
      if (x1 !== 0 || x2 !== 0) {
        rows.push(R('Involute of the working pressure angle', p(0), '', 6), R('Working pressure angle', p(1), 'deg', 4),
          R('Centre distance modification coefficient y', p(2), '', 5));
      }
      rows.push(R('Centre distance', p(4), u, dp), R('Working pitch diameter, gear 1', p(5), u, dp), R('Working pitch diameter, gear 2', p(6), u, dp));
      if (x1 !== 0 || x2 !== 0) rows.push(R('Tip diameter for standard clearance, gear 1', p(10), u, dp), R('Tip diameter for standard clearance, gear 2', p(11), u, dp));
      rows.push(R('Transverse contact ratio', p(14), '', 3));
    }
    return rows;
  },
  working: 'm = 1 / P in inch mode. d = z m; db = d cos α; p = π m; pb = p cos α; ha = (ha* + x) m; hf = (hf* − x) m; da = d + 2 ha; df = d − 2 hf; s = m (π/2 + 2 x tan α); thickness at diameter dy: sy = dy (s/d + inv α − inv αy), cos αy = db/dy. Undercut: z_min = 2 ha*/sin²α, x_min = ha* − z sin²α / 2. Pair: inv αw = 2 tan α (x1 + x2)/(z1 + z2) + inv α; y = (z1 + z2)/2 · (cos α / cos αw − 1); a = ((z1 + z2)/2 + y) m; dw = db / cos αw; tips for standard clearance: ha1 = (ha* + y − x2) m, ha2 = (ha* + y − x1) m. Contact ratio εα = [√(ra1² − rb1²) + √(ra2² − rb2²) − a sin αw] / pb. inv α = tan α − α (radians). The drawing below the root circle uses a radial flank instead of the real fillet, which depends on the cutter. Form milling cutter for a gear cut one tooth space at a time: diametral pitch cutters are No. 1 (135 teeth to a rack), 2 (55 to 134), 3 (35 to 54), 4 (26 to 34), 5 (21 to 25), 6 (17 to 20), 7 (14 to 16), 8 (12 and 13); module cutters are numbered the other way round (No. 1 cuts 12 and 13 teeth). Check the range marked on the cutter: one brand marks its module cutters in the diametral pitch order, and half-number cutters split these ranges.',
  source: 'Basic rack: ISO 53:1998 and AGMA full-depth system (cited by name: addendum 1 m, dedendum 1.25 m). Formulas and the worked example in the tests (m 3, z 12 and 24, x 0.6 and 0.36: a = 56.4999, αw = 26.0886°) from the KHK Gear Technical Reference, calculation of gear dimensions; SDP/SI Elements of Metric Gear Technology; MESYS AG online helical gear calculation. See docs/gears.md. Cutter numbers: Victor Machinery Exchange, the All Industrial Tool Supply catalogue (TTC brand) and Evolvent Design print the same ranges; see docs/sources.md.',
},
{
  id: 'gearmeasure', level: 'expert', group: 'Gears and splines', title: 'Gear measurement: span, pins, chordal',
  desc: 'Inspection sizes for a spur or helical gear: span (base tangent length) over k teeth, measurement over pins or balls (external) or between pins (internal) with the ideal pin size, and chordal tooth thickness and chordal height for a gear tooth vernier. Nominal values for the basic tooth thickness; subtract your backlash allowance. For a helical gear give the normal module and normal pressure angle.',
  fields: s => [
    s === 'inch' ? { id: 'mp', label: 'Normal diametral pitch P', unit: 'teeth/in', def: 10 } : { id: 'mp', label: 'Normal module m', unit: 'mm', def: 1 },
    { id: 'z', label: 'Number of teeth', unit: '', def: s === 'inch' ? 30 : 20 },
    { id: 'pa', label: 'Normal pressure angle', unit: 'deg', def: 20, options: [[20, '20°'], [14.5, '14.5°'], [25, '25°']] },
    { id: 'beta', label: 'Helix angle (0 = spur)', unit: 'deg', def: 0 },
    { id: 'x', label: 'Profile shift x', unit: 'x m', def: 0 },
    { id: 'int', label: 'Gear type', unit: '', def: 0, options: [[0, 'External'], [1, 'Internal (pins between)']] },
    { id: 'dp', label: 'Pin or ball diameter (blank = ideal)', unit: lenU(s), def: s === 'inch' ? '' : 1.7 },
    { id: 'k', label: 'Teeth spanned k (blank = suggested)', unit: '', def: '' },
    { id: 'ha', label: 'Addendum factor ha*', unit: 'x m', def: 1 },
  ],
  calc: (v, W, s) => {
    const m = gearMod(v.mp, s), u = lenU(s), x = isFinite(v.x) ? v.x : 0, b = isFinite(v.beta) ? v.beta : 0, int = v.int === 1 ? 1 : 0;
    if (!(m > 0 && v.z >= 3 && v.pa > 0 && v.ha > 0)) return [];
    const q = i => W.gear_measure(m, v.z, v.pa, b, x, v.dp > 0 ? v.dp : 0, int, v.k > 0 ? v.k : 0, v.ha, i), dp = s === 'inch' ? 4 : 3;
    const rows = [];
    if (!int) {
      rows.push(R('Tip diameter', q(14), u, dp));
      if (b !== 0) rows.push(R('Virtual number of teeth zv = z / cos³β', q(13), '', 3));
      rows.push(R('Span: teeth spanned k', q(6), '', 0), R('Span: k from the formula (before rounding)', q(9), '', 3),
        R('Span measurement W over k teeth', q(7), u, dp + 1), R('Span: anvils touch at diameter', q(8), u, dp));
      if (b !== 0) rows.push(R('Span: least face width for the anvils (W sin βb, plus margin)', q(10), u, dp));
    }
    rows.push(R((b !== 0 ? 'Ball' : 'Pin') + ' diameter used', q(1), u, dp + 1), R('Ideal ' + (b !== 0 ? 'ball' : 'pin') + ' (touches near d + 2xm)', q(2), u, dp + 1),
      R(int ? 'Measurement between pins' : 'Measurement over ' + (b !== 0 ? 'balls' : 'pins'), q(0), u, dp + 1),
      R('Pin centres on diameter', q(3), u, dp));
    if (b === 0) rows.push(R('Pins touch the flanks at diameter', q(4), u, dp));
    if (Math.round(v.z) % 2) rows.push(R('Odd tooth count', 'pins on opposite spaces are not on one diameter; the cos(90°/z) form is used', '', 0));
    if (b !== 0 && Math.round(v.z) % 2) rows.push(R('Helical, odd teeth', 'the true two-ball reading is a little smaller than this formula (balls not in one transverse plane)', '', 0));
    if (!int) rows.push(R('Chordal tooth thickness at the reference circle', q(11), u, dp + 1), R('Chordal height (from the tip)', q(12), u, dp + 1));
    return rows;
  },
  working: 'm = 1 / P in inch mode. Span: W = mn cos αn [π (k − 0.5) + z inv αt] + 2 x mn sin αn; tan αt = tan αn / cos β. Suggested k makes the anvils touch near d + 2 x m: k = [(W′ − 2 x mn sin αn)/(mn cos αn) − z inv αt]/π + 0.5, W′ = 2 √(rx² − rb²)/cos βb, rounded. Pins (external): inv φ = st/d + inv αt + dp/(z mn cos αn) − π/z, st = mt (π/2 + 2 x tan αn); M = db / cos φ + dp (even z), db cos(90°/z) / cos φ + dp (odd z). Internal: inv φ = et/d + inv αt − dp/(z mn cos αn); M = db / cos φ − dp (odd: × cos(90°/z) before − dp). Ideal pin (KHK): ψ = π/(2z) − inv α − 2 x tan α / z, cos αx = db/(d + 2xm), φ = tan αx + ψ, dp = z m cos α (inv φ + ψ); internal ψ = π/(2z) + inv α + 2 x tan α / z, φ = tan αx − ψ, dp = z m cos α (ψ − inv φ); helical: same with zv = z / cos³β. Chordal: ψ = π/(2z) + 2 x tan α / z, s̄ = z m sin ψ, h̄ = ha + (z m / 2)(1 − cos ψ) (helical: zv and mn). Internal gears: profile shift sign as in the KHK reference (positive x widens the space).',
  source: 'ISO 21771-1:2024 and DIN 3960 (span measurement, cited by name). KHK Gear Technical Reference, tooth thickness (span, over pins, chordal; internal gears); SDP/SI Elements of Metric Gear Technology, section 10; MESYS AG online gear calculation (worked values m 1, z 20, dp 1.7: MdK 22.2941, W2 4.7083); A. Kapelevich, Gear Technology, Jan/Feb 2011 (span form); FRENCO (two-ball size of odd helical gears, 2015). See docs/gears.md.',
},
{
  id: 'helicalgear', level: 'advanced', group: 'Gears and splines', title: 'Helical gears',
  desc: 'Parallel-axis helical gear pair in the normal system: transverse module and pressure angle, base helix angle, pitch, base, tip and root diameters, lead, axial pitch, centre distance (with profile shift) and contact ratios. The two gears of an external pair have opposite hands.',
  fields: s => [
    s === 'inch' ? { id: 'mp', label: 'Normal diametral pitch Pn', unit: 'teeth/in', def: 8 } : { id: 'mp', label: 'Normal module mn', unit: 'mm', def: 3 },
    { id: 'z1', label: 'Teeth, gear 1', unit: '', def: s === 'inch' ? 20 : 12 },
    { id: 'z2', label: 'Teeth, gear 2', unit: '', def: s === 'inch' ? 40 : 60 },
    { id: 'pa', label: 'Normal pressure angle', unit: 'deg', def: 20, options: [[20, '20°'], [14.5, '14.5°'], [25, '25°']] },
    { id: 'beta', label: 'Helix angle β', unit: 'deg', def: s === 'inch' ? 15 : 30 },
    { id: 'x1', label: 'Normal profile shift, gear 1', unit: 'x mn', def: 0 },
    { id: 'x2', label: 'Normal profile shift, gear 2', unit: 'x mn', def: 0 },
    { id: 'b', label: 'Face width (for the overlap ratio)', unit: lenU(s), def: s === 'inch' ? 1 : 30 },
    { id: 'ha', label: 'Addendum factor ha*', unit: 'x mn', def: 1 },
    { id: 'hf', label: 'Dedendum factor hf*', unit: 'x mn', def: 1.25 },
  ],
  calc: (v, W, s) => {
    const m = gearMod(v.mp, s), u = lenU(s), x1 = isFinite(v.x1) ? v.x1 : 0, x2 = isFinite(v.x2) ? v.x2 : 0, dp = s === 'inch' ? 4 : 3;
    if (!(m > 0 && v.z1 >= 3 && v.pa > 0 && v.beta >= 0 && v.beta < 60 && v.ha > 0 && v.hf > 0)) return [];
    const h1 = i => W.gear_helical(m, v.z1, v.pa, v.beta, x1, v.ha, v.hf, i);
    const rows = [R('Transverse module mt = mn / cos β', h1(0), u, dp + 1)];
    if (s === 'inch') rows.push(R('Transverse diametral pitch Pt = Pn cos β', 1 / h1(0), 'teeth/in', 4));
    rows.push(R('Transverse pressure angle', h1(1), 'deg', 4), R('Base helix angle', h1(6), 'deg', 4),
      R('Normal circular pitch', h1(9), u, dp + 1), R('Transverse circular pitch', h1(10), u, dp + 1));
    if (v.beta > 0) rows.push(R('Axial pitch', h1(8), u, dp + 1));
    const gear = (n, h, z) => {
      rows.push(R(n + ': pitch (reference) diameter', h(2), u, dp), R(n + ': base diameter', h(3), u, dp));
      if (v.beta > 0) rows.push(R(n + ': lead', h(7), u, dp - 1));
      rows.push(R(n + ': virtual number of teeth', h(11), '', 2));
    };
    gear('Gear 1', h1, v.z1);
    if (v.z2 >= 3) {
      const h2 = i => W.gear_helical(m, v.z2, v.pa, v.beta, x2, v.ha, v.hf, i);
      const p = i => W.gear_helical_pair(m, v.z1, v.z2, v.pa, v.beta, x1, x2, v.ha, v.hf, i);
      gear('Gear 2', h2, v.z2);
      rows.push(R('Ratio z2 / z1', v.z2 / v.z1, '', 4), R('Standard centre distance (no shift)', p(8), u, dp));
      if (x1 !== 0 || x2 !== 0) rows.push(R('Working transverse pressure angle', p(1), 'deg', 4), R('Centre distance modification coefficient y', p(2), '', 5));
      rows.push(R('Centre distance', p(0), u, dp), R('Gear 1: tip diameter', p(3), u, dp), R('Gear 2: tip diameter', p(4), u, dp),
        R('Gear 1: root diameter', p(5), u, dp), R('Gear 2: root diameter', p(6), u, dp));
      const ea = p(7), eb = v.b > 0 ? W.gear_overlap_ratio(v.b, m, v.beta) : NaN;
      rows.push(R('Transverse contact ratio εα', ea, '', 3));
      if (isFinite(eb)) rows.push(R('Overlap ratio εβ', eb, '', 3), R('Total contact ratio εγ = εα + εβ', ea + eb, '', 3));
    } else rows.push(R('Gear 1: tip diameter', h1(4), u, dp), R('Gear 1: root diameter', h1(5), u, dp));
    return rows;
  },
  working: 'mt = mn / cos β; tan αt = tan αn / cos β; d = z mt; db = d cos αt; tan βb = tan β cos αt; lead = π d / tan β; axial pitch px = π mn / sin β; zv = z / cos³β. Single gear: da = d + 2 (ha* + xn) mn, df = d − 2 (hf* − xn) mn. Pair: inv αwt = 2 tan αn (xn1 + xn2)/(z1 + z2) + inv αt; y = (z1 + z2)/(2 cos β) · (cos αt / cos αwt − 1); a = ((z1 + z2)/(2 cos β) + y) mn; tips for standard clearance da1 = d1 + 2 (ha* + y − xn2) mn; df = da − 2 (ha* + hf* + y − xn1 − xn2) mn. εα in the transverse plane with pbt = π mt cos αt; εβ = b sin β / (π mn).',
  source: 'KHK Gear Technical Reference, helical gears in the normal and transverse systems (worked example in the tests: mn 3, β 30°, z 12 and 60, xn1 0.09809: a = 125.000, da 48.153 / 213.842, df 34.657 / 200.346); SDP/SI Elements of Metric Gear Technology, section 6. See docs/gears.md.',
},
{
  id: 'geartrain', level: 'advanced', group: 'Gears and splines', title: 'Gear train ratio',
  desc: 'Simple and compound trains: give each driver and driven gear that mesh, up to four pairs (two gears on one shaft make the next pair). An idler only changes the direction; count it below. Output speed = input speed / ratio. To find a train for a wanted ratio from a gear set, give the ratio (input / output speed) and the set.',
  fields: s => [
    { id: 'n', label: 'Input speed', unit: 'RPM', def: 1500 },
    { id: 'a1', label: 'Pair 1: driver teeth', unit: '', def: 20 }, { id: 'b1', label: 'Pair 1: driven teeth', unit: '', def: 60 },
    { id: 'a2', label: 'Pair 2: driver teeth', unit: '', def: 18 }, { id: 'b2', label: 'Pair 2: driven teeth', unit: '', def: 54 },
    { id: 'a3', label: 'Pair 3: driver teeth', unit: '', def: '' }, { id: 'b3', label: 'Pair 3: driven teeth', unit: '', def: '' },
    { id: 'a4', label: 'Pair 4: driver teeth', unit: '', def: '' }, { id: 'b4', label: 'Pair 4: driven teeth', unit: '', def: '' },
    { id: 'idl', label: 'Idlers (external gears between)', unit: '', def: 0 },
    { id: 'tr', label: 'Find trains for ratio (blank = off)', unit: ': 1', def: '' },
    { id: 'g0', label: 'Gear set: smallest', unit: 'teeth', def: 20 },
    { id: 'g1', label: 'Gear set: largest', unit: 'teeth', def: 80 },
    { id: 'gs', label: 'Gear set: step', unit: 'teeth', def: 5 },
    { id: 'gc', label: 'Trains to try', unit: '', def: 1, options: [[1, 'Simple and compound'], [0, 'Simple only']] },
  ],
  calc: (v, W, s) => {
    const p = [];
    for (let i = 1; i <= 4; i++) if (v['a' + i] > 0 && v['b' + i] > 0) p.push(v['a' + i], v['b' + i]);
    if (!p.length) return [];
    const nb = toBuf(W, p), r = W.gear_train_ratio(nb), ext = p.length / 2 + (v.idl > 0 ? Math.round(v.idl) : 0);
    const rows = [R('Train ratio (input / output speed)', r, ': 1', 5), R('Output turns per input turn', 1 / r, '', 6)];
    if (v.n > 0) rows.push(R('Output speed', v.n / r, 'RPM', 2));
    rows.push(R('Output direction (external gears only)', W.gear_train_sign(ext) > 0 ? 'same as the input' : 'opposite to the input', '', 0));
    if (v.tr > 0) {
      // Change-gear finder: the user's gear set from smallest to largest by step; the
      // search (core change_gear_trains) works with driver/driven, so ask for 1 / ratio.
      const set = [], st = v.gs >= 1 ? Math.round(v.gs) : 1;
      for (let t = Math.round(v.g0); t <= Math.round(v.g1) && set.length < 60; t += st) if (t >= 8) set.push(t);
      if (set.length < 2) rows.push(R('Train finder', 'give a gear set of at least two sizes', '', 0));
      else {
        const n = W.change_gears(toBuf(W, set), 1 / v.tr, v.gc === 0 ? 0 : 1, 6), L = listOut(W, n * 5);
        for (let i = 0; i < n; i++) {
          const [a, b, c, d, q] = L.slice(5 * i, 5 * i + 5), e = (1 / q) / v.tr - 1;
          rows.push(R('Train ' + (i + 1) + (c ? ' (compound, driver/driven)' : ' (driver/driven)'),
            (c ? a + '/' + b + ' × ' + c + '/' + d : a + '/' + b) + ' = ' + fmt(1 / q, 6) + ' : 1, error ' + (Math.abs(e) < 1e-12 ? 'exact' : fmt(e * 100, 4) + ' %'), '', 0));
        }
      }
    }
    return rows;
  },
  working: 'Ratio = (driven1 / driver1) × (driven2 / driver2) × ... ; n_out = n_in / ratio. Each external mesh reverses the direction, so the output turns the same way as the input when the number of external meshes (pairs plus idlers) is even. An internal (ring) gear mesh does not reverse; allow for it yourself. Train finder: every simple pair a/b and compound train (a/b)(c/d) of different gears from the set (one of each size) is tried and the closest ratios are listed, error = found / wanted − 1. Check that the gears fit the centre distances.',
  source: 'Gear-train ratio arithmetic; KHK Gear Technical Reference and SDP/SI Elements of Metric Gear Technology, section 13 (gear trains). See docs/gears.md.',
},
{
  id: 'planetary', level: 'expert', group: 'Gears and splines', title: 'Planetary gear set',
  desc: 'Simple planetary set (sun, planets, ring, carrier) by Willis\' formula: give two of the three speeds (0 for a held member) and leave the third blank. Also the planet tooth count, the three usual ratios and the equal-spacing check.',
  fields: s => [
    { id: 'zs', label: 'Sun teeth', unit: '', def: 24 },
    { id: 'zr', label: 'Ring teeth', unit: '', def: 72 },
    { id: 'np', label: 'Number of planets', unit: '', def: 3 },
    { id: 'ns', label: 'Sun speed (blank = solve)', unit: 'RPM', def: 1000 },
    { id: 'nr', label: 'Ring speed (blank = solve)', unit: 'RPM', def: 0 },
    { id: 'nc', label: 'Carrier speed (blank = solve)', unit: 'RPM', def: '' },
  ],
  calc: (v, W, s) => {
    if (!(v.zs > 0 && v.zr > v.zs)) return [];
    const rows = [R('Planet teeth for unshifted gears (zr − zs)/2', W.gear_planet_teeth(v.zs, v.zr), '', 1)];
    const blank = ['ns', 'nr', 'nc'].filter(k => !isFinite(v[k]));
    if (blank.length === 1) {
      const out = W.gear_willis(v.zs, v.zr, v.ns, v.nr, v.nc);
      rows.push(R({ ns: 'Sun speed', nr: 'Ring speed', nc: 'Carrier speed' }[blank[0]], out, 'RPM', 2));
    } else rows.push(R('Speeds', 'leave exactly one of the three speeds blank', '', 0));
    rows.push(R('Ring held: sun in, carrier out', 1 / W.gear_willis(v.zs, v.zr, 1, 0, NaN), ': 1', 4),
      R('Sun held: ring in, carrier out', 1 / W.gear_willis(v.zs, v.zr, 0, 1, NaN), ': 1', 4),
      R('Carrier held: sun in, ring out (reverses)', 1 / W.gear_willis(v.zs, v.zr, 1, NaN, 0), ': 1', 4));
    if (v.np >= 1) rows.push(R('Equal planet spacing', W.gear_planets_assemble(v.zs, v.zr, Math.round(v.np)) ? 'yes: (zs + zr) / n is a whole number' : 'no: (zs + zr) / n is not a whole number', '', 0));
    return rows;
  },
  working: "Willis: (ns − nc) / (nr − nc) = −zr / zs, so ns + (zr/zs) nr − (1 + zr/zs) nc = 0; solved for the blank speed. Ring held: ratio 1 + zr/zs; sun held: 1 + zs/zr; carrier held: −zr/zs. Unshifted planets: zp = (zr − zs)/2. Equal spacing of n planets needs (zs + zr)/n to be a whole number.",
  source: "R. Willis, Principles of Mechanism (1841), relative-speed method (by name); KHK Gear Technical Reference and SDP/SI Elements of Metric Gear Technology, section 13 (planetary gear trains). See docs/gears.md.",
},
{
  id: 'saespline', level: 'expert', group: 'Gears and splines', title: 'SAE parallel side splines (4, 6, 10 and 16 splines)',
  desc: 'Width, depth and small diameter of the old SAE straight-sided spline fittings for a nominal diameter, for a permanent fit, a fit that slides when not under load and one that slides under load, with the torque capacity per inch of length, and the section drawn to scale. For repairs and existing parts: the standard is obsolete for new designs.',
  fields: s => [
    { id: 'n', label: 'Number of splines', unit: '', def: 6, options: [[4, '4'], [6, '6'], [10, '10'], [16, '16']] },
    { id: 'fit', label: 'Fit', unit: '', def: 1, options: [[1, 'A: permanent fit'], [2, 'B: to slide when not under load'], [3, 'C: to slide when under load']] },
    { id: 'D', label: 'Nominal (large) diameter D', unit: lenU(s), def: s === 'inch' ? 1.5 : 38.1 },
    { id: 'len', label: 'Bearing length of the splines (optional)', unit: lenU(s), def: '' },
  ],
  calc: (v, W, s) => {
    if (!(v.D > 0)) return [];
    if (v.n === 4 && v.fit === 3) return [R('Fit', 'The standard has no fit C (to slide under load) for 4 splines: choose A or B, or 6 splines or more', '', 0)];
    const inch = s === 'inch', u = lenU(s), dp = inch ? 3 : 2, G = k => W.sae_spline(v.n, v.fit, v.D, k), Din = inch ? v.D : v.D / IN_MM;
    // Torque: the core works in inches (inch-pounds per inch of length at 1000 psi); N m is a unit conversion.
    const T = W.sae_spline(v.n, v.fit, Din, 3), NM = 0.1129848;
    const rows = [R('Width of spline W', G(0), u, dp), R('Depth of spline h', G(1), u, dp), R('Small diameter d', G(2), u, dp),
      R('Torque capacity per inch of length at 1000 psi on the sides', inch ? T : T * NM, inch ? 'in lbf' : 'N m', inch ? 0 : 1)];
    if (v.len > 0) { const L = inch ? v.len : v.len / IN_MM; rows.push(R('Torque capacity over the bearing length, at 1000 psi', inch ? T * L : T * L * NM, inch ? 'in lbf' : 'N m', inch ? 0 : 1)); }
    const lo = v.n === 16 ? 2 : 0.75, hi = v.n <= 6 ? 3 : 6;
    if (Din < lo - 1e-9 || Din > hi + 1e-9) rows.push(R('Note', 'The handbook tabulates ' + v.n + '-spline fittings from ' + (lo === 2 ? '2' : '3/4') + ' to ' + hi + ' in nominal diameter. This size is outside that range: the proportions are applied as formulas.', '', 0));
    return rows;
  },
  working: 'W, h and d are fixed fractions of the nominal diameter D. W: 0.241 D (4 splines), 0.250 D (6), 0.156 D (10), 0.098 D (16). Permanent fit (A): h = 0.075 D, d = 0.850 D (4 splines); 0.050 D, 0.900 D (6); 0.045 D, 0.910 D (10 and 16). To slide when not under load (B): 0.125 D, 0.750 D (4); 0.075 D, 0.850 D (6); 0.070 D, 0.860 D (10 and 16). To slide under load (C): 0.100 D, 0.800 D (6); 0.095 D, 0.810 D (10 and 16); none for 4 splines. Torque capacity T = 1000 N R h per inch of bearing length, at 1000 psi on the sides of the splines, with R = (D + d) / 4 the mean radius: scale it by the pressure your materials allow. ' +
    'The figures are the largest size of each dimension; the handbook tables give a minus tolerance of 0.001 to 0.003 in on them, depending on size. The dimensions apply to the soft broached hole; corner radii are not over 0.015 in and the splines are parallel to the axis within 0.006 in per foot. SAE lists the standard (J499, issued January 1914, stabilized 2014; the revision known as J499a is dated 1975) as technically obsolete for new designs, and points to involute splines (ANSI B92.1) instead: see the involute spline tool.',
  source: "Machinery's Handbook, 31st ed., SAE standard spline fittings, Tables 18 to 22, pp. 2358 to 2360 (formulas and torque capacity; one publisher, checked against 37 printed values). SAE J499, Parallel side splines for soft broached holes in fittings (SAE's public summary: scope, status, corner radii, parallelism). See docs/sources.md, SAE parallel side splines.",
  proof: [{ name: 'A 2 in 10-spline fitting, to slide under load (10C)', sys: 'inch', vals: { n: 10, fit: 3, D: 2 }, expect: [['Width of spline W', 'in', 0.312, 5e-4], ['Small diameter d', 'in', 1.620, 5e-4], ['Torque capacity per inch of length at 1000 psi on the sides', 'in lbf', 1720, 0.6]],
    source: "Machinery's Handbook, 31st ed., Table 20, SAE standard 10-spline fittings, p. 2360: nominal diameter 2, W 0.309 to 0.312, 10C d 1.618 to 1.620, T 1720.", note: 'The table prints each dimension as a smallest and a largest size; BenchMate gives the largest.' }],
},
{
  id: 'spline', level: 'expert', group: 'Gears and splines', title: 'Involute splines (ANSI B92.1, ISO 4156)',
  desc: '30° flat root side fit involute splines: pitch and base diameters, circular pitch, basic tooth thickness and space width, major and minor diameters, measurement over pins (external) and between pins (internal), with one tooth space of the shaft and of the hub drawn enlarged with its pin. Basic (nominal) values only: the standards then apply fit class tolerances and deviations, which are not shown.',
  fields: s => [
    { id: 'std', label: 'Standard', unit: '', def: s === 'inch' ? 1 : 2, options: [[1, 'ANSI B92.1 (inch, P/2P pitch)'], [2, 'ISO 4156 (metric module)']] },
    { id: 'mp', label: 'Pitch P (ANSI, e.g. 8 for 8/16) or module m (ISO, mm)', unit: '', def: s === 'inch' ? 8 : 2 },
    { id: 'z', label: 'Number of teeth', unit: '', def: s === 'inch' ? 24 : 20 },
    { id: 'dpe', label: 'Pin diameter, external (blank = ideal)', unit: lenU(s), def: '' },
    { id: 'dpi', label: 'Pin diameter, internal (blank = ideal)', unit: lenU(s), def: '' },
    { id: 'st', label: 'Actual tooth thickness (blank = basic)', unit: lenU(s), def: '' },
    { id: 'et', label: 'Actual space width (blank = basic)', unit: lenU(s), def: '' },
  ],
  calc: (v, W, s) => {
    if (!(v.mp > 0 && v.z >= 6 && (v.std === 1 || v.std === 2))) return [];
    // Module in the current length unit: ANSI m = 1/P inch; ISO m in mm.
    const m = v.std === 1 ? (s === 'inch' ? 1 / v.mp : 25.4 / v.mp) : (s === 'inch' ? v.mp / 25.4 : v.mp);
    const u = lenU(s), dp = s === 'inch' ? 4 : 3, g = i => W.gear_spline(v.std, m, v.z, i);
    const rows = [];
    if (v.std === 1) rows.push(R('Pitch', v.mp + '/' + 2 * v.mp + ' (stub pitch 2P sets the depth)', '', 0));
    rows.push(R('Pitch diameter D', g(0), u, dp), R('Base diameter Db = D cos 30°', g(1), u, dp), R('Circular pitch p', g(2), u, dp + 1),
      R('Basic tooth thickness = basic space width (p / 2)', g(3), u, dp + 1),
      R('Major diameter, external (basic)', g(4), u, dp),
      v.std === 1 && v.mp > 12 ? R('Minor diameter, external (flat root)', 'the (N − 1.35)/P rule is for 2.5/5 to 12/24 pitch; finer pitches use another factor (see ANSI B92.1)', '', 0) : R('Minor diameter, external (flat root, basic)', g(7), u, dp),
      R('Major diameter, internal (flat root, basic)', g(6), u, dp));
    if (isFinite(g(5))) rows.push(R('Minor diameter, internal (basic)', g(5), u, dp));
    else rows.push(R('Minor diameter, internal', 'from the external form diameter and form clearance in ISO 4156 (not given here)', '', 0));
    const d = g(0), st = v.st > 0 ? v.st : g(3), et = v.et > 0 ? v.et : g(3);
    const pe = v.dpe > 0 ? v.dpe : W.gear_ideal_pin_ext(m, v.z, 30, 0), pi = v.dpi > 0 ? v.dpi : W.gear_ideal_pin_int(m, v.z, 30, 0);
    rows.push(R('Pin diameter, external', pe, u, dp + 1), R('Measurement over pins, external', W.gear_over_pins_ext(v.z, d, 30, st, pe), u, dp + 1),
      R('Pin diameter, internal', pi, u, dp + 1), R('Measurement between pins, internal', W.gear_between_pins_int(v.z, d, 30, et, pi), u, dp + 1));
    // Where each pin touches, and whether it measures at all: from the tooth space the core draws (gears::space_view).
    const minE = isFinite(g(7)) && !(v.std === 1 && v.mp > 12) ? g(7) : NaN, minI = g(5);
    [[0, st, g(4), minE, pe, 'external'], [1, et, minI, g(6), pi, 'internal']].forEach(([inn, t, tip, root, pin, name]) => {
      if (!(tip > 0 && root > 0 && pin > 0) || !(W.gear_space_view(inn, v.z, d, 30, t, tip, root, pin, 8) > 6)) return;
      const dk = W.list_out(1), fl = W.list_out(4);
      if (isFinite(dk) && !(fl & 1)) rows.push(R('Pins touch the flanks on diameter, ' + name, dk, u, dp + 1));
      SPLINE_PIN_MSG.forEach((msg, i) => { if (fl & (1 << i)) rows.push(R('Check the ' + name + ' pin', msg + [': it is too large for this tooth space, or too small to reach the flanks', ': it is too small', ', so the measuring faces would touch the teeth first: it is too small'][i], '', 0)); });
    });
    rows.push(R('Major and minor diameter factors', v.std === 1 ? 'one free source so far (Engineers Edge)' : 'one free source so far (ISO 4156:1981 preview)', '', 0));
    rows.push(R('Pin size', 'the pins shown touch at the pitch diameter; the standards list their own measuring pin sizes: enter the size on your inspection sheet', '', 0));
    return rows;
  },
  working: 'm = 1/P (ANSI) or the module (ISO). D = m z; Db = D cos 30°; p = π m; basic s = e = p/2. ANSI B92.1 30° flat root side fit: Do = (N + 1)/P, Di = (N − 1)/P, Dri = (N + 1.35)/P, Dre = (N − 1.35)/P (Dre rule for 2.5/5 to 12/24 pitch). ISO 4156 30° flat root: Dee = m (z + 1), Dei = m (z + 1.5), Die = m (z − 1.5) (basic, before deviations). Pins: external inv φ = s/D + inv 30° + dp/Db − π/z, M = Db / cos φ + dp (even z; odd z × cos(90°/z) before + dp); internal inv φ = e/D + inv 30° − dp/Db, M = Db / cos φ − dp. Ideal pins touch at the pitch diameter (as for a gear with x = 0). Tooth space drawing: half angle of a tooth of thickness s at radius r, ψ = s/D + inv 30° − inv α_r with cos α_r = Db / (2r); the pin centre is on Db / cos φ and touches the flank where the line from its centre, tangent to the base circle, is dp/2 shorter (external) or longer (internal).',
  source: 'ANSI B92.1-1996 and ISO 4156-1:2021 (second edition, replaces ISO 4156-1:2005), cited by name. Factors: Engineers Edge, involute spline basic formulas (ANSI); ISO 4156:1981 table 2 in the iTeh free preview (ISO). Pin formulas as for gears (KHK). Each status is in docs/gears.md.',
},
{
  id: 'worm', level: 'expert', group: 'Gears and splines', title: 'Worm and wheel basics',
  desc: 'Cylindrical worm and worm wheel at 90°: lead, lead angle, ratio, wheel pitch diameter and centre distance from the axial module (or axial diametral pitch), number of starts and the worm pitch diameter.',
  fields: s => [
    s === 'inch' ? { id: 'mp', label: 'Axial diametral pitch', unit: 'teeth/in', def: 8 } : { id: 'mp', label: 'Axial module mx', unit: 'mm', def: 3 },
    { id: 'z1', label: 'Worm starts (threads)', unit: '', def: 1 },
    { id: 'z2', label: 'Wheel teeth', unit: '', def: s === 'inch' ? 40 : 30 },
    { id: 'd1', label: 'Worm pitch diameter', unit: lenU(s), def: s === 'inch' ? 1 : 44 },
    { id: 'n', label: 'Worm speed (optional)', unit: 'RPM', def: '' },
  ],
  calc: (v, W, s) => {
    const m = gearMod(v.mp, s), u = lenU(s), dp = s === 'inch' ? 4 : 3;
    if (!(m > 0 && v.z1 >= 1 && v.z2 >= 1 && v.d1 > 0)) return [];
    const w = i => W.gear_worm(m, v.z1, v.z2, v.d1, i);
    const rows = [R('Axial pitch (= wheel circular pitch)', w(6), u, dp + 1), R('Lead = starts × axial pitch', w(0), u, dp + 1),
      R('Lead angle (at the worm pitch diameter)', w(1), 'deg', 4), R('Ratio z2 / z1', w(2), ': 1', 3),
      R('Wheel pitch diameter', w(4), u, dp), R('Centre distance', w(3), u, dp), R('Normal module mn = mx cos γ', w(5), u, dp + 1)];
    if (s === 'inch') rows.push(R('Normal diametral pitch', 1 / w(5), 'teeth/in', 4));
    if (v.n > 0) rows.push(R('Wheel speed', v.n / w(2), 'RPM', 2));
    return rows;
  },
  working: 'm = 1 / P in inch mode. px = π mx; lead L = z1 px; tan γ = z1 mx / d1; ratio = z2 / z1; d2 = z2 mx; a = (d1 + d2)/2; mn = mx cos γ.',
  source: 'KHK Gear Technical Reference, cylindrical worm gear pair; SDP/SI Elements of Metric Gear Technology, section 9 (worm mesh). See docs/gears.md.',
},
{
  id: 'machinetapers', level: 'simple', group: 'Setup', title: 'Machine tapers',
  desc: 'Morse, Jacobs, Jarno, Brown & Sharpe, 7:24 steep tapers (ISO 7388-1 / SK, BT, CAT), HSK-A and R8: gauge diameters, lengths, taper per foot and angle, with pull stud (retention knob) references.',
  render: el => renderMachineTapers(el),
  working: 'Included angle = 2 atan(taper per unit length / 2). Values come from published tables, each with its publisher count.',
  source: 'ISO 296:1991 (Morse), ISO 7388-1:2007 and ISO 7388-2:2007 (7/24 shanks), ISO 7388-3:2016 (retention knobs), ISO 12164-1:2023 (HSK), ASME B5.50-2015 (R2025) (CAT), JIS B 6339 (BT, edition not confirmed); publishers listed under the tool.',
},
{
  id: 'fits', level: 'simple', group: 'Limits and fits', title: 'ISO limits and fits',
  desc: 'IT grades, fundamental deviations and limits of any hole and shaft tolerance class up to 3150 mm (hole basis or shaft basis), including j5 to j7 and J6 to J8, with the clearance or interference of the fit.',
  render: el => renderFits(el),
  working: 'See the note under the tool.',
  source: 'ISO 286-1:2010 (with Cor 1:2013) and ISO 286-2:2010; table values from Wikipedia, Ganter, GOST 25346-89, RoyMech, Simply Bearings and OSG (JIS B 0401); over 500 mm checked against the ISO 286-1 annex formulas.',
},
{
  id: 'surface', level: 'simple', group: 'Limits and fits', title: 'Surface texture: Ra, N grades and symbols',
  desc: 'Ra in micrometres and microinches with the N grade, why Ra and Rz do not convert, ISO 21920-1 and ISO 1302 drawing symbols in plain words, and typical Ra by process from two publishers.',
  render: el => renderSurface(el),
  working: 'See the notes under the tool. 1 um = 39.37 uin.',
  source: 'ISO 21920-1:2021, ISO 21920-2:2021, ISO 21920-3:2021 (ISO 1302:2002 withdrawn); N grades from CERATIZIT, Werk24, Mechanical-Engineering.com and Engineers Edge; process ranges from Autodesk and Mechanical-Engineering.com.',
},
{
  id: 'hardness', level: 'simple', group: 'Limits and fits', title: 'Hardness conversion (steel, approximate)',
  desc: 'Convert between HV, HB, HRC, HRB, HRA and tensile strength for unalloyed and low alloy steels, interpolated between published table rows, with the working shown.',
  render: el => renderHardness(el),
  working: 'Linear interpolation between adjacent rows of the ISO 18265 steel table. See the caveats under the tool.',
  source: 'ISO 18265:2013, ASTM E140-26; table as printed by Optimas and Bossard.',
},
{
  id: 'shrinkfit', level: 'advanced', group: 'Limits and fits', title: 'Shrink and press fits',
  desc: "Temperature to heat a hub (or cool a shaft) to assemble an interference fit with a clearance, and the press-fit contact pressure, hub stress and holding torque. Expansion coefficient, E, Poisson's ratio and friction are your entries.",
  render: el => renderShrinkFit(el),
  working: 'Shrink: dT = (interference + clearance) / (alpha d). Hub with a cooled shaft: T_hub = T0 + (i + c - alpha_s d (T0 - T_s)) / (alpha_h d). Press fit (Lame): p = delta / (d/Eo ((do²+d²)/(do²-d²) + nu_o) + d/Ei ((d²+di²)/(d²-di²) - nu_i)); hub hoop stress p (do²+d²)/(do²-d²); torque mu p pi d² L / 2.',
  source: "Linear expansion dL = alpha L dT; Lame thick-cylinder interference fit as in Shigley's Mechanical Engineering Design (by name). See docs/sources.md.",
},
{
  id: 'gentol', level: 'simple', group: 'Limits and fits', title: 'General tolerances (ISO 2768-1)',
  desc: 'Tolerance of a dimension with no tolerance of its own on an ISO 2768-f, m, c or v drawing: linear sizes, outside radii and chamfers, and angles.',
  render: el => renderGenTol(el),
  working: 'Table lookup by range (over the lower size, up to and including the upper). Angle offset = shorter side x tan(tolerance).',
  source: 'ISO 2768-1:1989 (by name; confirmed current on iso.org). Values from AmesWeb, Star Rapid, Modulus Metal, CamCut and Wevolver.',
},
{
  id: 'ansifits', level: 'advanced', group: 'Limits and fits', title: 'ANSI inch fits (RC, LC, LT, LN, FN)',
  desc: 'ANSI B4.1 preferred limits and fits, 0 to 19.69 in: hole and shaft limits and the limits of clearance or interference for RC1 to RC9, LC1 to LC11, LT1 to LT6, LN1 to LN3 and FN1 to FN5, with every class of the family at that size.',
  render: el => renderAnsiFits(el),
  working: 'Limits = basic size + deviation / 1000 (deviations in thousandths). Max clearance = hole upper - shaft lower; min clearance = hole lower - shaft upper (negative = interference).',
  source: 'ANSI B4.1-1967 (R1999, R2004), by name; table as reprinted by King Saud University course material (one full source: marked "needs 2nd source"); RC5 example from Engineers Edge; symbols and descriptions from AmesWeb. See docs/inspection.md.',
},
{
  id: 'prefnum', level: 'expert', group: 'Limits and fits', title: 'Preferred numbers (Renard R5 to R80)',
  desc: 'List the ISO 3 preferred numbers of a Renard series between two values, with the theoretical value, the step and the rounding, or find the preferred number nearest to yours.',
  render: el => renderPrefNum(el),
  working: 'Term i = 10^(i/R) (theoretical); rounded values from the published series; nearest term i = round(R log10 x).',
  source: 'ISO 3:1973 (by name); values from the iTeh Standards preview of ISO 3:1973 and Wikipedia (Renard series). See docs/inspection.md.',
},
{
  id: 'bolt', level: 'simple', group: 'Geometry', title: 'Bolt circle',
  desc: 'X and Y coordinates of equally spaced holes on a circle.',
  fields: s => [
    { id: 'dia', label: 'Bolt circle diameter', unit: lenU(s), def: s === 'inch' ? 4 : 100 },
    { id: 'n', label: 'Number of holes', unit: '', def: 6 },
    { id: 'start', label: 'Start angle', unit: 'deg', def: 0 },
    { level: 'advanced', id: 'cx', label: 'Center X', unit: lenU(s), def: 0 },
    { level: 'advanced', id: 'cy', label: 'Center Y', unit: lenU(s), def: 0 },
  ],
  calc: (v, W, s) => {
    if (!(v.dia > 0 && Number.isInteger(v.n) && v.n >= 1 && v.n <= 360)) return [];
    const rows = [R('Angle between holes', 360 / v.n, 'deg', 3)];
    if (v.n >= 2) rows.push(R('Centre to centre of neighbouring holes (chord)', W.arc_solve(1, v.dia / 2, 360 / v.n, 2), lenU(s), s === 'inch' ? 4 : 3));
    rows.push(R('Bolt circle radius', v.dia / 2, lenU(s), s === 'inch' ? 4 : 3));
    return rows;
  },
  // Every hole: angle and X, Y, with copies for a spreadsheet and for a program.
  table: (v, W, s, dpAdj) => {
    const dp = Math.max(0, Math.min(8, (s === 'inch' ? 4 : 3) + (dpAdj || 0))), a0 = v.start || 0, cx = v.cx || 0, cy = v.cy || 0;
    const z = x => (Math.abs(x) < 0.5 * Math.pow(10, -dp) ? 0 : x).toFixed(dp); // no "-0.0000"
    const rows = [];
    for (let i = 0; i < v.n; i++) rows.push([String(i + 1), (+(a0 + 360 * i / v.n).toFixed(4)).toString() + '°', z(W.bolt_x(v.n, v.dia, a0, cx, cy, i)), z(W.bolt_y(v.n, v.dia, a0, cx, cy, i))]);
    return {
      title: 'Hole positions (' + lenU(s) + ')', head: ['Hole', 'Angle', 'X', 'Y'], rows,
      copies: [
        ['Copy table', 'Hole\tAngle\tX\tY\n' + rows.map(r => r.join('\t')).join('\n')],
        ['Copy as X Y lines', rows.map(r => 'X' + r[2] + ' Y' + r[3]).join('\n')],
      ],
    };
  },
  // G-code: a drilling or tapping cycle at these holes.
  snip: (v, W) => {
    const h = []; for (let i = 0; i < v.n; i++) h.push([W.bolt_x(v.n, v.dia, v.start || 0, v.cx || 0, v.cy || 0, i), W.bolt_y(v.n, v.dia, v.start || 0, v.cx || 0, v.cy || 0, i)]);
    return h.length ? { kind: 'holes', holes: h, from: 'the bolt circle' } : null;
  },
  working: 'x = cx + (D/2) cos(a0 + 360 i / n), y = cy + (D/2) sin(a0 + 360 i / n). Angles measured counter-clockwise from +X.',
  source: "Machinery's Handbook (hole circles)",
},
{
  id: 'holegrid', level: 'simple', group: 'Geometry', title: 'Rectangular hole grid',
  desc: 'X and Y coordinates of holes in rows and columns (or a single line of holes), listed in the order a machine would drill them.',
  fields: s => [
    { id: 'nx', label: 'Holes along X (columns)', unit: '', def: 4 },
    { id: 'ny', label: 'Rows along Y', unit: '', def: 3 },
    { id: 'dx', label: 'Spacing in X', unit: lenU(s), def: s === 'inch' ? 1 : 25 },
    { id: 'dy', label: 'Spacing in Y', unit: lenU(s), def: s === 'inch' ? 0.75 : 20 },
    { level: 'advanced', id: 'x0', label: 'First hole X', unit: lenU(s), def: 0 },
    { level: 'advanced', id: 'y0', label: 'First hole Y', unit: lenU(s), def: 0 },
  ],
  // The core lays the grid out (back and forth, row by row); the screen only reads the list.
  holes: (v, W) => {
    if (!(Number.isInteger(v.nx) && Number.isInteger(v.ny) && v.nx >= 1 && v.ny >= 1 && v.nx * v.ny <= 2000 && isFinite(v.dx) && isFinite(v.dy))) return [];
    const n = W.pattern_grid(v.x0 || 0, v.y0 || 0, v.nx, v.ny, v.nx > 1 ? v.dx : 0, v.ny > 1 ? v.dy : 0), o = [];
    for (let i = 0; i < n; i++) o.push([W.list_out(2 * i), W.list_out(2 * i + 1)]);
    return o;
  },
  calc: (v, W, s) => {
    const h = TOOLS.find(t => t.id === 'holegrid').holes(v, W); if (!h.length) return [];
    const xs = h.map(p => p[0]), ys = h.map(p => p[1]), dp = s === 'inch' ? 4 : 3;
    return [R('Number of holes', h.length, '', 0), R('First to last hole in X', Math.max(...xs) - Math.min(...xs), lenU(s), dp), R('First to last hole in Y', Math.max(...ys) - Math.min(...ys), lenU(s), dp)];
  },
  // G-code: a drilling or tapping cycle at these holes, in the order listed.
  snip: (v, W) => { const h = TOOLS.find(t => t.id === 'holegrid').holes(v, W); return h.length ? { kind: 'holes', holes: h, from: 'the hole grid' } : null; },
  table: (v, W, s, dpAdj) => {
    const dp = Math.max(0, Math.min(8, (s === 'inch' ? 4 : 3) + (dpAdj || 0)));
    const z = x => (Math.abs(x) < 0.5 * Math.pow(10, -dp) ? 0 : x).toFixed(dp);
    const rows = TOOLS.find(t => t.id === 'holegrid').holes(v, W).map((p, i) => [String(i + 1), z(p[0]), z(p[1])]);
    return {
      title: 'Hole positions (' + lenU(s) + '), in drilling order', head: ['Hole', 'X', 'Y'], rows,
      copies: [['Copy table', 'Hole\tX\tY\n' + rows.map(r => r.join('\t')).join('\n')], ['Copy as X Y lines', rows.map(r => 'X' + r[1] + ' Y' + r[2]).join('\n')]],
    };
  },
  working: 'Hole (i, j) is at x = x0 + i dx, y = y0 + j dy. Rows are listed back and forth (left to right, then right to left) so the machine never rapids the full width between rows.',
  source: 'Plane geometry (rectangular array); the order is the usual zigzag drilling path.',
},
{
  id: 'triangle', level: 'simple', group: 'Geometry', title: 'Triangle solver',
  desc: 'Right or any triangle from three known sides and angles, including the two-solution case (two sides and an angle that is not between them).',
  render: el => renderTriangle(el),
  working: 'Angles add to 180°. Law of sines: a / sin A = b / sin B = c / sin C. Law of cosines: a² = b² + c² - 2bc cos A. Side-side-angle: sin B = b sin A / a gives no triangle (> 1), one, or two (B and 180° - B, when both leave room for C). Area = ½ ab sin C.',
  source: 'OpenStax, Algebra and Trigonometry 2e, ch. 10 (non-right triangles: law of sines incl. the ambiguous case, law of cosines). See docs/geometry.md.',
},
{
  id: 'arc', level: 'advanced', group: 'Geometry', title: 'Chord, arc, sagitta and 3-point circle',
  desc: 'Solve an arc from any two of radius, included angle, chord, sagitta (height) and arc length (all ten pairs, with both arcs where two fit); segment and sector areas; centre and radius of the circle through three points.',
  render: el => renderArc(el),
  working: 'Chord c = 2R sin(θ/2); arc L = Rθ (radians); sagitta s = R(1 - cos(θ/2)); R from c and s = (c²/4 + s²) / 2s; R from θ and c = c / (2 sin(θ/2)); from θ and s = s / (1 - cos(θ/2)); from θ and L = L / θ; segment area = R²/2 (θ - sin θ); sector = R²θ/2. Radius and chord fit the minor and the major arc. Chord and arc length: sin(u)/u = c/L with u = θ/2, which falls steadily from 1 to 0 on 0 < u ≤ π, so one arc, found by bisection. Sagitta and arc length: s/L = (1 - cos u)/(2u) rises to a peak of about 0.362 at u sin u = 1 - cos u (θ about 267°) and falls to 1/π at 360°, so it is solved by bisection on each side of the peak: one arc below 1/π, two between 1/π and the peak, none above. Three points: centre where the perpendicular bisectors of two chords cross.',
  source: 'Plane geometry: OpenStax Algebra and Trigonometry 2e (circle and arc relations); Wikipedia "Circular segment" (chord, sagitta, arc length, segment area). Bracketed solves: own derivation, tested in the Rust core. See docs/geometry.md.',
},
{
  id: 'fillet', level: 'advanced', group: 'Geometry', title: 'Fillet and tangent points',
  desc: 'Tangent points and centre of a fillet in a corner between two lines, or blending a line into an arc, for programming.',
  render: el => renderFillet(el),
  working: 'Corner: tangent distance = r / tan(α/2), centre on the bisector at r / sin(α/2), α the angle between the legs. Line and arc: the fillet centre lies on the line offset by r and on the circle of radius R + r (outside) or R - r (inside) about the arc centre; tangent points are the foot of the perpendicular on the line and the point on the arc in line with both centres.',
  source: 'Plane geometry (BenchMate derivation; tests check each tangent point lies at r from the fillet centre). See docs/geometry.md.',
},
{
  id: 'dovetail', level: 'advanced', group: 'Geometry', title: 'Dovetail and V-groove over pins',
  desc: 'Measurement over (or between) pins for male and female dovetails, and pin height in a V-groove.',
  render: el => renderDovetail(el),
  working: 'A pin in a corner of angle α touches base and flank; its centre is (d/2) cot(α/2) from the sharp corner along the base. Male: M = W + d (1 + cot(α/2)). Female: M = W - d (1 + cot(α/2)). W from the other face: W = top ∓ 2h cot α. V-groove: pin top above face = (d/2)/sin(β/2) + d/2 - (W/2)/tan(β/2).',
  source: 'Plane geometry (BenchMate derivation, checked in tests by constructing the pin position). See docs/geometry.md.',
},
{
  id: 'figures', level: 'advanced', group: 'Geometry', title: 'Areas and volumes',
  desc: 'Area and perimeter of plane figures (squares, rectangles, trapezoids, circles, rings, ellipses, regular polygons by across flats or corners, sectors) and volume and surface of solids (box, cylinder, tube, cone, frustum, sphere, cap, pyramid, torus, hex bar), with a drawing.',
  render: el => renderFigures(el),
  working: 'Standard mensuration formulas (listed in docs/sources.md). Polygon: side = AF tan(180°/n), AC = AF / cos(180°/n), area = n side AF / 4. Ellipse perimeter: Ramanujan II approximation.',
  source: "Machinery's Handbook 'areas and volumes' (by name); see docs/sources.md.",
},
{
  id: 'prismoid', level: 'advanced', group: 'Geometry', title: 'Prismoidal formula: volume from three sections',
  desc: 'Volume of a tapering solid (a hopper, a tapered block, a casting) from the areas of its two parallel end faces and of the section halfway between them.',
  fields: s => [
    { id: 'a1', label: 'Area of one end face A1', unit: lenU(s) + '²', def: s === 'inch' ? 56 : 5600 },
    { id: 'am', label: 'Area of the section halfway Am', unit: lenU(s) + '²', def: s === 'inch' ? 99 : 9900 },
    { id: 'a2', label: 'Area of the other end face A2', unit: lenU(s) + '²', def: s === 'inch' ? 154 : 15400 },
    { id: 'h', label: 'Distance between the end faces h', unit: lenU(s), def: s === 'inch' ? 12 : 120 },
  ],
  calc: (v, W, s) => {
    const V = W.prismoid_volume(v.a1, v.am, v.a2, v.h);
    if (!isFinite(V)) return [];
    const inch = s === 'inch';
    return [R('Volume', V, lenU(s) + '³', inch ? 3 : 1), R('Volume', W.unit_convert(2, inch ? 4 : 3, 1, V), 'L', 4),
      R('Note', 'The halfway section is measured, not averaged: for a tapering solid its area is not the mean of the two ends. For a rectangular hopper each of its sides is the mean of the matching sides of the two ends.', '', 0)];
  },
  working: 'V = h (A1 + 4 Am + A2) / 6. Exact for prisms, pyramids, cones, frustums, wedges and spheres (any solid whose section area is at most a cubic in the height); elsewhere an approximation, the same as Simpson\'s rule with two strips.',
  source: 'Wolfram MathWorld, Prismatoid (the prismoidal formula); MATHalino, solid mensuration: prismatoid. See docs/sources.md, Areas and volumes by rule.',
},
{
  id: 'tankvol', level: 'advanced', group: 'Geometry', title: 'Tank contents: cylinder lying or standing',
  desc: 'How much liquid is in a cylindrical tank with flat ends (a coolant or oil drum, a sump made from pipe) from the depth on a dipstick, lying on its side or standing on end.',
  fields: s => [
    { id: 'orient', label: 'Tank', unit: '', def: 0, options: [[0, 'Lying on its side'], [1, 'Standing on end']] },
    { id: 'd', label: 'Inside diameter', unit: lenU(s), def: s === 'inch' ? 22.5 : 570 },
    { id: 'l', label: 'Inside length (height when standing)', unit: lenU(s), def: s === 'inch' ? 33.5 : 850 },
    { id: 'h', label: 'Depth of liquid', unit: lenU(s), def: s === 'inch' ? 8 : 200 },
  ],
  calc: (v, W, s) => {
    const T = k => W.tank_contents(v.orient, v.d, v.l, v.h, k), inch = s === 'inch', from = inch ? 4 : 3;
    if (!(v.d > 0 && v.l > 0 && v.h >= 0)) return [];
    if (!isFinite(T(0))) return [R('Depth of liquid', v.orient === 1 ? 'is more than the height of the tank' : 'is more than the diameter of the tank', '', 0)];
    const vol = (n, x) => [R(n, W.unit_convert(2, from, 1, x), 'L', 2), R(n, W.unit_convert(2, from, 6, x), 'gal (US)', 2), R(n, W.unit_convert(2, from, 9, x), 'gal (UK)', 2)];
    return [...vol('Liquid in the tank', T(0)), R('Full', 100 * T(2), '%', 1), ...vol('Tank when full', T(1)),
      R('Note', 'Flat ends only: dished or domed ends hold more. A drum with ribs or a tank that is not level reads differently.', '', 0)];
  },
  working: 'Lying down: V = L [R² acos((R − h) / R) − (R − h) √(2 R h − h²)], the area of the circular segment times the length. Standing: V = π R² h.',
  source: 'Wolfram MathWorld, Horizontal cylindrical segment; Math is Fun, Volume of a horizontal cylinder. Litres and gallons from the unit converter (NIST SP 811). See docs/sources.md, Areas and volumes by rule.',
},
{
  id: 'irregular', level: 'advanced', group: 'Geometry', title: 'Irregular area from equally spaced widths',
  desc: 'Area of an irregular outline (a gasket, a cam plate, a casting section) from widths measured at equal steps across it, by the trapezoidal rule and by Simpson\'s rule.',
  render: el => renderIrregular(el),
  working: 'Trapezoidal rule: A = d [(first + last) / 2 + all the widths between]. Simpson\'s rule: A = d/3 [first + last + 4 (2nd, 4th, …) + 2 (3rd, 5th, …)], which needs an odd number of widths (an even number of strips).',
  source: 'Geosurab surveying notes, calculation of area of irregular figures (worked example 843.33 m²); Maths at Home, Simpson\'s 1/3 rule (worked example 4053 m²); Class Mathematics, the trapezoidal rule (worked example 760 m²). See docs/sources.md, Areas and volumes by rule.',
},
{
  id: 'compound', level: 'advanced', group: 'Geometry', title: 'Compound angles',
  desc: 'True angle and slope direction of a face tilted two ways, from the two drawing (apparent) angles or two successive tilts, and the settings for a swivel and tilt, a compound sine plate or the two views.',
  render: el => renderCompound(el),
  working: 'Face normal n = (sin C cos b, sin C sin b, cos C). Apparent angles: tan ax = tan C cos b, tan ay = tan C sin b, so tan C = sqrt(tan² ax + tan² ay). Two tilts (about X, then the tilted Y): cos C = cos a1 cos a2, sin a2 = sin C cos b, tan a1 = tan C sin b.',
  source: "Vector geometry (rotation of the face normal), BenchMate derivation with round-trip tests; Machinery's Handbook 'compound angles' (by name). See docs/sources.md.",
},
{
  id: 'cycdrill', level: 'advanced', group: 'G-code cycles', title: 'Drilling and tapping cycles',
  desc: 'G81, G82, G83, G73 drilling and G84 rigid or floating tapping for a bolt circle, a grid or pasted coordinates. Backplot, cycle time, hole CSV.',
  render: el => renderDrillCycles(el),
  working: 'Holes: bolt circle x = cx + (D/2) cos(a0 + 360 i/n); grid in zigzag rows. Tapping feed per minute = pitch x rpm (feed per rev = lead). Dwell: Fanuc-style P in milliseconds without a decimal point, Haas P in seconds. Time: feed moves at F, rapids at the rapid rate, peck clearance assumed 0.5 mm (0.02 in) because the real value is a control parameter.',
  source: 'Cycle formats: FANUC Series 0i-F Plus Operator\'s Manual B-64694EN-2/01 (canned cycles); Haas Mill Programming Workbook and Haas G84 Tapping guide (haascnc.com); CIMCO CNC programming book ch. 5; makeitfrommetal.com Fanuc canned cycles (dwell P in ms, M29 rigid tapping). See docs/cycles.md.',
},
{
  id: 'cyctmill', level: 'advanced', group: 'G-code cycles', title: 'Thread milling program',
  desc: 'Helical thread milling program for internal or external, right or left hand threads, climb or conventional, with arc-in and arc-out, optional G41/G42 and several radial passes.',
  render: el => renderThreadMillCycle(el),
  working: 'Tool centre path radius: internal (D - d)/2, external (Dr + d)/2 with Dr the root diameter. Tool centre feed = edge feed x (D - d)/D inside, x (D + d)/D outside. Internal climb milling with M03 runs counter-clockwise (G03); external climb runs clockwise (G02). A right-hand helix rises when it turns counter-clockwise. Lead arcs: 90 degrees, tangent to the thread circle, a quarter pitch of Z each. Feed along the helix = F x sqrt(1 + (P / 2 pi r)^2) if a control applies F in 3D.',
  source: 'Feed adjustment: Harvey Performance (In The Loupe, internal and external adjusted feed, 9/16-18 example) and Travers Tool thread mill speeds and feeds (3/8-16 example). Helical G02/G03 with Z: Haas Mill Programming Workbook, P. Smid CNC Programming Handbook ch. 45. Direction rules: BenchMate derivation, checked in core tests. See docs/cycles.md.',
},
{
  id: 'cycthread', level: 'advanced', group: 'G-code cycles', title: 'Lathe threading (G76 / G92)',
  desc: 'G76 multi-pass threading or one G92 block per pass, with an infeed table: constant volume, constant depth or your own pass depths, minimum cut, finish allowance and spring passes.',
  render: el => renderLatheThreadCycle(el),
  working: 'Depth: external 0.613435 P (to d3), internal 0.541266 P (5/8 H). Constant volume from the first cut: depth after pass n = d1 sqrt(n), each step at least the minimum cut. Over n passes: depth after pass i = ap sqrt(c_i / (n - 1)), c_1 = 0.3, c_i = i - 1. Fanuc-style G76 two blocks: P(finish passes)(pull-out x 0.1 lead)(tool angle) Q(min cut) R(finish), then X Z P(thread depth) Q(first cut) F(lead); P and Q in the least input increment without a decimal point.',
  source: 'Haas G76 page (haascnc.com: D*sqrt(N), P1-P4); ISCAR threading catalogue (infeed formula and worked example); CTE magazine "Single-point thread programming can be fun and easy" and CIMCO Edit Fanuc turning exercise (G76 two-block format); Haas Factory Outlet lathe programming (G92). See docs/cycles.md.',
},
{
  id: 'cyctaper', level: 'advanced', group: 'G-code cycles', title: 'Lathe taper program',
  desc: 'Roughing passes that follow the taper, then a finish pass along the cone, external or internal, with CSS and optional nose radius compensation.',
  render: el => renderTaperCycle(el),
  working: 'Each roughing pass cuts to where the cone (plus the finish allowance) meets its diameter, then follows the cone back up so the finish allowance is even. Half angle = atan((D - d) / 2L). Finish enters on the cone extended in front of the part. Time is integrated along each move with the rpm from CSS at that diameter.',
  source: 'Taper geometry: Machinery\'s Handbook (tapers). G96/G97/G50, G41/G42: Haas Factory Outlet lathe programming; CIMCO CNC programming book, appendix D. See docs/cycles.md.',
},
{
  id: 'cycgroove', level: 'advanced', group: 'G-code cycles', title: 'Groove and cut-off (CSS)',
  desc: 'Groove (several plunges for a wide groove, optional pecking) or cut-off program with constant surface speed, a G50 speed clamp and G97 at the end, plus the cut time with CSS.',
  render: el => renderGrooveCycle(el),
  working: 'n = 1000 Vc / (pi D) (metric) or 12 V / (pi D) (inch), limited to the G50 clamp. Plunge time with CSS from D0 to D1: (D0² - D1²) / (4 f k) with k = 1000 Vc / pi, and below the clamp diameter k / n_max the time is (D/2) / (f n_max).',
  source: 'CSS rpm: Sandvik Coromant turning formulas [SAN]. Time: BenchMate integration of dr / (f n), checked against numerical integration in core tests. G50/G96/G97: Haas Factory Outlet lathe programming; Fanuc G-code system A article (industrialmonitordirect). See docs/cycles.md.',
},
{
  id: 'gsim', level: 'advanced', group: 'G-code cycles', title: 'G-code editor and simulator',
  desc: 'Paste, type or load a G-code program (Generic ISO / Fanuc-style or Haas; lathe or mill is told from the program) and see the programmed path: rapids dashed, feeds solid, from the top, front, side or in 3D with a view cube. Step through it block by block. Edit with undo, insert and delete lines, renumber, strip comments, and convert between inch and mm. Distances, extents, an estimated cycle time and every error with its line number. A backplot, not a machine verification.',
  render: el => renderGsim(el),
  working: 'Parsed and run in the Rust core (core/src/gsim.rs). G0/G1/G2/G3 with I/J/K or R (helical arcs too), G17/G18/G19, G20/G21, G90/G91 on the mill, G94/G95 (mill) and G98/G99 (lathe) feed modes, G96/G97 with the G50 clamp, G4, G28 to the intermediate point, F/S/T/M/N words and comments. An arc whose start and end radius differ by more than the tolerance is an error. Mill G73, G74, G81-G86 and G89 are drawn hole by hole (G83/G73 re-entry 0.5 mm or 0.02 in, as in the cycle generators); lathe G70 runs its P..Q contour, G90/G92/G94 are drawn as single cycles. G71-G76 roughing and threading, mill G76/G87/G88, macros and subprograms are listed as not simulated. Lathe X is a diameter, plotted as a radius. Time = length / F (per rev: / (F x rpm)); acceleration is ignored. Other controls are not yet supported. Lathe or mill (Auto): told from words only one of them uses (a four-digit T word, G50 S, G96, G71 or G72 with P and Q, G92 with F, G32, U and W against G43 H, M06, Y words, G17, a drilling cycle with an R plane, G41 or G42 with D); when the signs are too few the active machine decides. Tidy (core/src/gtidy.rs): renumbering gives new N numbers from a start by a step and carries them into the blocks that name other blocks (P and Q of the lathe cycles G70 to G73, P of M97 and M99, GOTO n); removing N numbers keeps the ones that are named. Inch / mm: X Y Z U V W I J K R, a peck Q and F are multiplied or divided by 25.4 (R stays on a G68 rotation, F stays under G93), S under G96 by 3.28084 (m/min and ft/min), and on a lathe the whole-number P and Q of G74, G75 and G76 are converted as counts of 0.001 mm or 0.0001 in. A length with no decimal point is read the way you choose (whole units, or least input increments) and written with a decimal point. Macro statements are left alone and listed.',
  source: 'FANUC Series 0i-F Plus Operator\'s Manual B-64694EN (interpolation, canned cycles, G-code system A for lathes, helical feed along the arc); Haas Mill and Lathe Operator\'s Manuals (G-code chapters); NIST RS274NGC interpreter version 3 report (arc radius check, word order). See docs/gsim.md. Decimal point reading (pocket calculator type or least input increment, parameter 3401 bit 0): FANUC decimal point programming as reprinted by mfgrobots.com; least input increment 0.001 mm or 0.0001 in: Modern Machine Shop, "Reducing a CNC\'s least input increment value"; G76 P and Q without a decimal point: CNC Training Centre, "G76 threading cycle". 1 in = 25.4 mm and 1 ft = 0.3048 m exactly (NIST SP 811).',
},
{
  id: 'sketch', level: 'advanced', group: 'CAD / DXF', title: '2D sketcher',
  desc: 'Draw points, lines, arcs, circles, rectangles and text on layers, with snaps to ends, crossings, middles, centres, quadrants, tangents and square, a grid, typed coordinates, measuring, undo and redo. Open a DXF file to look at it, measure it or change it, and save the drawing as DXF (R2000 or R12).',
  render: el => renderSketch(el),
  working: 'The drawing is kept and worked on in the Rust core (core/src/sketch.rs); the page only draws it. Arc through three points: the centre is the circumcentre of the three points (where the perpendicular bisectors meet); the arc runs counter-clockwise when the points turn left. Crossings: two lines by solving the two parametric equations; a line with a circle from the quadratic in the line parameter; two circles from the distance between centres d, a = (r1\u00b2 - r2\u00b2 + d\u00b2) / (2 d), h = sqrt(r1\u00b2 - a\u00b2). Tangent from the last point: the touching points lie at acos(r / d) either side of the line from the centre to that point. Square: the foot of the perpendicular from the last point. Snaps: the nearest snap point in reach wins (end, crossing, middle, centre, quadrant, tangent, square); where two are at the same place it is named in that order. A point on a line counts only when none of those is in reach, and the grid only when nothing is. Two lines selected: the angle between their directions folded into 0 to 90 degrees, and where they meet. Polyline arcs use the DXF bulge (tan of a quarter of the included angle). Text is taken as 0.7 x height wide per character for picking and extents; the program that opens the DXF uses its own font. DXF reading: LINE, CIRCLE, ARC, POINT, TEXT, MTEXT (as one line), LWPOLYLINE and 2D POLYLINE in model space with their layers; anything else (splines, ellipses, blocks, dimensions, hatches) is counted and listed, not drawn. Units come from $INSUNITS when the file has it.',
  source: 'Autodesk DXF Reference (TEXT, POINT, LWPOLYLINE and POLYLINE group codes, bulge, arbitrary axis algorithm, ASCII control characters, $INSUNITS) with the ezdxf documentation as the second reading; Wolfram MathWorld: Circumcircle, Circle-Circle Intersection. Each geometry routine is tested against hand values (3-4-5 triangles, unit circle). DXF files checked by reading them back and by opening them in LibreCAD, Inkscape and OpenSCAD: see docs/cad-dxf.md.',
},
{
  id: 'engrave', level: 'advanced', group: 'G-code cycles', title: 'Text engraving',
  desc: 'Type a text, pick one of nine stroke (single line) letter styles and see it to scale: on a straight line at any angle or round a circle, mirrored if wanted. Gives the size, the length engraved, the line width of a pointed cutter and the program, and sends the strokes to the simulator, the sketcher or a DXF file.',
  render: el => renderEngrave(el),
  working: 'The letters are stroke fonts: each letter is a few open lines for the centre of the cutter to follow, so the line width is the cutter width. The height typed is the height of the capital letters, measured on the letter H of the font. Round a circle, a distance along the foot of the letters becomes an angle = distance / radius, and long strokes are cut into short pieces so they follow the circle. Each stroke is one rapid above its start, a plunge at the plunge feed, the stroke at the cutting feed and a rapid lift; strokes that carry on from each other are joined so the cutter is not lifted. Z0 is the surface. Pointed cutter: line width = tip flat + 2 x depth x tan(half the included angle). The layout, the lengths and the program come from the Rust core.',
  source: 'Letters: the Hershey fonts (Dr. A. V. Hershey; data format by James Hurt, Cognition, Inc.), as SVG fonts prepared by Windell H. Oskay and shipped with Inkscape; use notice in each file in data/fonts/hershey and on the Fedora licensing wiki (Hershey font licence). Program: plain G00/G01 moves, the same header as the drilling cycles (FANUC Series 0i-F Plus Operator\'s Manual; Haas Mill Programming Workbook). Pointed cutter line width: BenchMate geometry, checked against the FlatCAM groove table (60 degrees, 0.1 flat, 0.05 deep: 0.158) and the Calculator Academy chamfer example (82 degrees, 5.0 to 9.4 at 2.53 deep). See docs/engraving.md.',
},
{
  id: 'rotpoint', level: 'advanced', group: 'G-code cycles', title: 'Rotary axis: where a point goes',
  desc: 'A point on the part at A0 (or B0, C0): where it is after the rotary axis turns. For picking up a feature on another face, moving a work offset, or checking a program. All lengths in one unit.',
  fields: s => [
    { id: 'axis', label: 'Rotary axis', unit: '', def: 0, options: [[0, 'A (turns about X)'], [1, 'B (turns about Y)'], [2, 'C (turns about Z)']] },
    { id: 'deg', label: 'Angle the axis is sent to (from 0)', unit: 'deg', def: 90 },
    { id: 'x', label: 'Point on the part at 0: X', unit: lenU(s), def: s === 'inch' ? 1 : 25 },
    { id: 'y', label: 'Point Y', unit: lenU(s), def: s === 'inch' ? 0.5 : 10 },
    { id: 'z', label: 'Point Z', unit: lenU(s), def: s === 'inch' ? 1.5 : 40 },
    { id: 'cx', label: 'Centre line of the rotary axis: X', unit: lenU(s), def: 0, when: v => v.axis !== 0 },
    { id: 'cy', label: 'Centre line of the rotary axis: Y', unit: lenU(s), def: 0, when: v => v.axis !== 1 },
    { id: 'cz', label: 'Centre line of the rotary axis: Z', unit: lenU(s), def: 0, when: v => v.axis !== 2 },
    { id: 'dir', label: 'A positive angle turns the part', unit: '', def: 0, options: [[0, 'against the right-hand rule (table carries the part)'], [1, 'by the right-hand rule']] },
  ],
  calc: (v, W, s) => {
    if (![v.deg, v.x, v.y, v.z].every(isFinite)) return [];
    const c = k => (isFinite(v[k]) ? v[k] : 0), dp = s === 'inch' ? 4 : 3, u = lenU(s);
    const t = i => W.rot_part_point(v.axis, v.deg, v.x, v.y, v.z, c('cx'), c('cy'), c('cz'), v.dir, i);
    const ax = 'XYZ'[v.axis], name = 'ABC'[v.axis];
    const cw = (v.dir === 1) === (v.deg < 0);   // how the part turns as seen from the + end of the axis
    return [R('Point after the move: X', t(0), u, dp), R('Point after the move: Y', t(1), u, dp), R('Point after the move: Z', t(2), u, dp),
      R('Distance of the point from the axis (does not change)', t(3), u, dp), R('Straight-line distance the point moved', t(4), u, dp),
      R('In words', v.deg === 0 ? 'No move' : 'Seen from the + end of ' + ax + ' looking back along it, the part turns ' + (cw ? 'clockwise' : 'counter-clockwise') + ' by ' + DK.n(Math.abs(v.deg), 3) + ' degrees', '', 0),
      R('Check on the machine', 'Jog ' + name + ' a few degrees plus and watch the part. If it turns the other way from the drawing, change the last box.', '', 0)];
  },
  working: 'The point turns about the centre line of the rotary axis; its coordinate along that axis and its distance from the axis do not change. Right-hand rule about X by an angle a: Y\' = Y cos a - Z sin a, Z\' = Y sin a + Z cos a (about Y: Z, X in place of Y, Z; about Z: X, Y), with Y and Z measured from the centre line. ISO 841 defines positive A, B and C by the right-hand screw rule for the tool relative to the work, so a table that carries the work turns the other way: the part point turns by minus the angle. Machine builders do not always follow the standard, so the direction is a box you set and check by jogging.',
  source: 'Axis names and directions: ISO 841:1974 (public preview; clauses 2.1, 2.6, 6.1, 6.2, 10) and the BobCAD-CAM help page on the right-hand rule (which also says builders do not always follow it). Rotation about an axis: Wikipedia, "Rotation matrix" (basic 3D rotations, counter-clockwise when the axis points at the observer) and MathWorks rotx (matrix and a worked example, reproduced by the core tests). See docs/rotary.md.',
  proof: [{ name: 'A 30 degree right-hand turn about X', sys: 'mm', vals: { axis: 0, deg: 30, x: 2, y: -2, z: 4, cy: 0, cz: 0, dir: 1 }, expect: [['Point after the move: Y', 'mm', -3.7321, 5e-5], ['Point after the move: Z', 'mm', 2.4641, 5e-5]],
    source: 'MathWorks documentation, rotx: rotx(30) applied to the vector (2, -2, 4) gives (2.0000, -3.7321, 2.4641).', note: 'The example turns the point itself by the right-hand rule, so the last box is set that way.' }],
},
{
  id: 'rotfeed', level: 'advanced', group: 'G-code cycles', title: 'Rotary axis feed',
  desc: 'Feed for a block that turns a rotary axis: degrees per minute for the surface feed you want at a diameter, the length of a cut that turns and moves along the axis at once, its time, and the inverse time (G93) feed word.',
  fields: s => [
    { id: 'd', label: 'Diameter where the tool cuts', unit: lenU(s), def: s === 'inch' ? 4 : 100 },
    { id: 'feed', label: 'Feed wanted along the surface', unit: feedMinU(s), def: s === 'inch' ? 25 : 600 },
    { id: 'dpm', label: 'Rotary feed, turn-only block', unit: 'deg/min', def: '' },
    { id: 'deg', label: 'Angle turned in the block', unit: 'deg', def: 90 },
    { id: 'lin', label: 'Move along the rotary axis in the same block (0 = none)', unit: lenU(s), def: s === 'inch' ? 3 : 75 },
  ],
  pairs: [['feed', 'dpm', (v, W) => W.rot_deg_per_min(v.feed, v.d / 2), (v, W) => W.rot_surface_feed(v.dpm, v.d / 2)]],
  calc: (v, W, s) => {
    if (!(v.d > 0)) return [];
    const r = v.d / 2, dp = s === 'inch' ? 4 : 3, u = lenU(s), rows = [];
    const feed = v.feed > 0 ? v.feed : (v.dpm > 0 ? W.rot_surface_feed(v.dpm, r) : NaN);
    if (feed > 0) rows.push(R('Rotary feed for a block that only turns', W.rot_deg_per_min(feed, r), 'deg/min', 2), R('Feed along the surface', feed, feedMinU(s), s === 'inch' ? 3 : 1));
    rows.push(R('One degree on this diameter is', W.rot_arc_length(r, 1), u, dp + 1));
    if (!(isFinite(v.deg) && v.deg !== 0)) return rows;
    const lin = isFinite(v.lin) ? v.lin : 0, len = W.rot_move_length(r, v.deg, lin);
    rows.push(R('Length round the part', W.rot_arc_length(r, v.deg), u, dp));
    if (lin !== 0) rows.push(R('Length of the cut (round and along at once)', len, u, dp));
    if (!(feed > 0)) return rows;
    rows.push(R('Time for the block', W.rot_move_time_s(feed, len), 's', 2), R('Inverse time feed word (G93): F', W.rot_inverse_time_f(feed, len), '1/min', 3));
    if (lin !== 0) rows.push(R('Rotary speed during the block', W.rot_rotary_rate(feed, len, v.deg), 'deg/min', 2),
      R('Feed word in G94 for this block', 'Controls differ. The Fadal manual reads F as the degrees per minute above; other controls read it in other ways. The inverse time word means the same on every control that has G93. Check your manual.', '', 0));
    return rows;
  },
  working: 'Round the part, a length s at radius r is an angle s / r (radians), so a surface feed f is f x 180 / (pi x r) degrees per minute. A block that turns the part by an angle while the tool moves a length L along the rotary axis cuts a helix: length = sqrt((r x angle)^2 + L^2). Time = length / feed. In inverse time mode (G93) the F word is 1 / minutes the block takes = feed / length, and every cutting block needs its own F. The diameter is where the tool tip cuts, not the stock size.',
  source: 'Fadal user manual, section 12 "Rotary axes" (actual move distance, degrees per minute and inverse time feed, with a worked example); Industrial Monitor Direct knowledge base, "CNC rotary axis feedrate sync with linear axis" (the same distance formula and X feed = A deg/min x pi x D / 360); CNC Cookbook, "Feed rate mode G-codes G93, G94 and G95" (a G93 block takes 1/F minutes; F on every cutting block); Haas UK, "Inverse time feed mode (G93)" (60 / F seconds). See docs/rotary.md.',
  proof: [{ name: 'A 4 in diameter, A turns 90 degrees while X moves 3 in, at 25 in/min', sys: 'inch', vals: { d: 4, feed: 25, dpm: '', deg: 90, lin: 3 }, expect: [['Length of the cut', 'in', 4.3439, 5e-5], ['Inverse time feed word', '1/min', 5.755, 0.0005], ['Rotary speed during the block', 'deg/min', 517.97, 0.01]],
    source: 'Fadal user manual, section 12, Rotary axes: actual move distance 4.3439, feed 517.97 degrees per minute, inverse time feed 5.755 (the sample program rounds it to F5.76).' }],
},
{
  id: 'cycbroach', level: 'expert', group: 'G-code cycles', title: 'Keyway broaching program',
  desc: 'Keyway broaching (slotting) strokes on a lathe or a mill with the spindle locked: stroke, depth per stroke, lift on the return stroke and spring strokes.',
  render: el => renderBroachCycle(el),
  working: 'Strokes = depth / depth per stroke (rounded up), then spring strokes at full depth. Each stroke: position, feed along Z to the end, lift off the cut, rapid back. Lathe X is the diameter at the cutting edge; on a mill the spindle centre is offset by the edge distance from the axis.',
  source: 'Plain G00/G01 (G98 feed per minute on the lathe, G94 on the mill): Haas Factory Outlet lathe programming; Haas Mill Programming Workbook. Spindle orientation is machine specific and not output. See docs/cycles.md.',
},
{
  id: 'cycg71', level: 'advanced', group: 'G-code cycles', title: 'G71 / G70 rough and finish',
  desc: 'G71 roughing and G70 finishing from a simple profile of points (straight lines, no undercuts), outside or inside, Fanuc-style two-block or Haas one-block format.',
  render: el => renderG71Cycle(el),
  working: 'Fanuc-style: G71 U(depth) R(retract); G71 P Q U(X allowance on diameter) W F. Haas: G71 P Q U W D(depth) F. The profile blocks carry the finish feed for G70. Type I needs a profile that only grows (outside) or shrinks (inside) toward the chuck. The backplot and time use BenchMate\'s model of the roughing passes.',
  source: 'NPTEL Module 7 CNC programming (G71/G70 parameters); industrialmonitordirect Fanuc G71 parameter reference; Haas Factory Outlet lathe programming (one-block G71 D, G70). See docs/cycles.md.',
},
{
  id: 'gmcodes', level: 'simple', group: 'G-code reference', title: 'G and M codes',
  desc: 'G and M codes per control: generic ISO 6983 / RS-274, Fanuc (lathe systems A/B/C), Haas, Mitsubishi M70/M80 and MELDAS 60, Siemens 840D native and ISO mode, Heidenhain DIN/ISO, Okuma OSP and Mazak EIA/ISO, and the M-code lists machine builders print for a Doosan machining centre, Mori Seiki (DMG MORI) NL lathes and the Mazak INTEGREX e. Search by code or word, filter mill or lathe, compare two controls side by side. Every row shows its source.',
  render: el => renderGmCodes(el),
  working: 'Nothing is calculated. A code is listed for a control only when the maker\'s (or machine builder\'s) public document prints it, or two independent public sources agree; otherwise it shows as not confirmed for that control. Meanings are BenchMate\'s own short wording. The default control comes from the active machine profile. The same number can mean different things on different controls (G70 is a lathe finishing cycle on Fanuc, a bolt circle on a Haas mill and inch mode on Siemens): always check your machine\'s own manual. M codes above all: the machine builder assigns most of them (M29 is rigid tapping on the Doosan list and switches the in-position check off on the Mori Seiki list).',
  source: 'NIST RS274NGC v3 (NISTIR 6556, public domain); ISO 6983-1:2009 cited by name; LinuxCNC docs; FANUC 0i-F and 0i-F Plus manuals; Haas operator manual, mill workbook, lathe card and Haas Factory Outlet lathe manual; Mitsubishi M70L manual, MELDAS 60 manual and training texts; Siemens SINUMERIK G/M handbook and ISO Milling manual; HEIDENHAIN TNC 320 ISO manual; Okuma OSP-P200L manual; Mazak EIA/ISO turning manual and INTEGREX e programming manual; Doosan HP5100 maintenance manual; Mori Seiki NL user\'s manual. Full list under the table and in docs/gm-codes.md.',
},
{
  id: 'macroref', level: 'expert', group: 'G-code reference', title: 'Macro reference',
  desc: 'Macro and parameter programming per control: Fanuc Custom Macro B variables and IF / WHILE, Haas macros, Siemens R parameters and control structures, Heidenhain Q-parameter jumps, Okuma VC variables and IF branches. System variables for Haas and Fanuc that can be searched by number (type 5023 or #3000). With sources and the places where sources disagree.',
  render: el => renderMacroRef(el),
  working: 'Nothing is calculated. Statements are in BenchMate\'s own words with the source section beside each. Variable ranges and system variable numbers depend on the control model, its options and the machine builder: check your manual before writing to any variable.',
  source: 'Tornos B Macro guide (2017); CNCCookbook; Haas Macro Programming Information (2017); Siemens SINUMERIK Job Planning manual (03/2013) and ISO Milling manual; HEIDENHAIN TNC 426 B ISO manual; ICAM pre-processor syntax pages; Okuma OSP-P200L manual and Okuma America blog. System variables: Haas Mill Operator\'s Manual 96-8000 Rev AC (2010); for Fanuc, Tornos, CNCCookbook and cncmacrosimulator.com. See docs/gm-codes.md.',
},
{
  id: 'dxfbolt', level: 'advanced', group: 'CAD / DXF', title: 'Bolt circle DXF',
  desc: 'Equally spaced holes on a circle, with an optional outside diameter and centre bore, as a DXF file for CAM. Live preview with overall size and hole positions.',
  render: el => renderDxf(el, 'dxfbolt'),
  working: DXF_NOTE + ' Hole positions: x = (D/2) cos(a0 + 360 i / n), y = (D/2) sin(a0 + 360 i / n), the same function as the Bolt circle calculator.',
  source: DXF_SOURCE + " Hole circles: Machinery's Handbook.",
},
{
  id: 'dxfgrid', level: 'advanced', group: 'CAD / DXF', title: 'Hole grid (rectangular pattern) DXF',
  desc: 'A rectangular grid of holes at a pitch in X and Y, optionally on a plate with a margin and corner radius, as a DXF file.',
  render: el => renderDxf(el, 'dxfgrid'),
  working: DXF_NOTE + ' The grid is centred on the origin (or put at the lower-left corner with the origin option). Plate size = (columns - 1) x pitch X + 2 x margin, by (rows - 1) x pitch Y + 2 x margin.',
  source: DXF_SOURCE,
},
{
  id: 'dxfslot', level: 'advanced', group: 'CAD / DXF', title: 'Slot DXF (straight and arc)',
  desc: 'A straight slot from its centre distance and width, at any angle, or an arc slot on a centreline radius with start and sweep angles, as one closed outline.',
  render: el => renderDxf(el, 'dxfslot'),
  working: DXF_NOTE + ' Straight slot: two straight sides and two half-circle ends (bulge 1); overall length = centre distance + width. Arc slot: outer arc (R + w/2) and inner arc (R - w/2) with bulge tan(sweep / 4), joined by half-circle ends.',
  source: DXF_SOURCE,
},
{
  id: 'dxfrect', level: 'advanced', group: 'CAD / DXF', title: 'Rectangle with corner radii DXF',
  desc: 'A rectangular plate with an optional corner radius and four corner holes at an inset from the edges, as a DXF file.',
  render: el => renderDxf(el, 'dxfrect'),
  working: DXF_NOTE + ' Corner arcs are 90° polyline arcs (bulge tan 22.5° = 0.414214). Corner holes are checked against the edges and the corner radius.',
  source: DXF_SOURCE,
},
{
  id: 'dxfpoly', level: 'advanced', group: 'CAD / DXF', title: 'Polygon (hex, square, n sides) DXF',
  desc: 'A regular polygon of any number of sides from its size across flats or across corners, with rotation and an optional centre bore, as a DXF file. Shows across corners, across flats and side length.',
  render: el => renderDxf(el, 'dxfpoly'),
  working: DXF_NOTE + ' Across corners = 2R; across flats = 2R cos(180°/n) (even n); for odd n the flat-to-opposite-corner size is R (1 + cos(180°/n)); side = 2R sin(180°/n); area = n R² sin(360°/n) / 2.',
  source: DXF_SOURCE + " Regular polygons: Machinery's Handbook.",
},
{
  id: 'dxfring', level: 'advanced', group: 'CAD / DXF', title: 'Circle and ring (washer) DXF',
  desc: 'A disc or a ring (washer, spacer) from its outside and inside diameters, as a DXF file.',
  render: el => renderDxf(el, 'dxfring'),
  working: DXF_NOTE,
  source: DXF_SOURCE,
},
{
  id: 'dxfprofile', level: 'advanced', group: 'CAD / DXF', title: 'Keyhole, D-flat and double-D DXF',
  desc: 'Simple profiles as one closed outline: a keyhole (head circle and slot), a D-flat (a circle with one flat) and a double-D (two parallel flats), with rotation.',
  render: el => renderDxf(el, 'dxfprofile'),
  working: DXF_NOTE + ' Keyhole: the slot sides meet the head circle at y = -sqrt(R² - (w/2)²). D-flat: the flat is at A - R from the centre (A = across flat). Double-D: flats at ±A/2. The arcs are polyline arcs with bulge tan(included angle / 4).',
  source: DXF_SOURCE,
},
{
  id: 'gdtguide', level: 'advanced', group: 'GD&T', title: 'GD&T reference guide',
  desc: 'Datums, Rule #1 versus ISO independency, every geometric characteristic with its tolerance zone, inspection and common mistakes, modifiers, and an ASME Y14.5-2018 / ISO comparison.',
  render: el => renderGdtGuide(el),
  working: 'Reference only. Your drawing\'s standard and edition govern. Source keys next to each rule resolve to the list at the bottom; statements marked "to be verified" were not confirmed in two independent public sources.',
  source: 'ASME Y14.5-2018 (R2024); ISO 1101:2017, ISO 5459:2024, ISO 2692:2021, ISO 8015:2011, ISO 22081:2021 (cited by name only). Public explanations from Mitutoyo, KEYENCE, Geometric Learning Systems, GD&T Basics, University of Illinois ME 170 notes, Humienny and Zdrojewski (2023) and others: see docs/gdt.md.',
},
{
  id: 'gdtfcf', level: 'advanced', group: 'GD&T', title: 'Feature control frame builder',
  desc: 'Build a feature control frame, see it drawn, and have it read out in plain words: said aloud, the demand in one sentence, each box in turn, the tolerance at each size, how it is checked. Warns about combinations that are invalid or doubtful.',
  render: el => renderFcfBuilder(el),
  working: 'The read-out is built from the boxes of the frame, left to right, using the same confirmed statements as the reference guide. With the size limits typed, the bonus, the tolerance allowed at each limit and the virtual condition come from the same formulas as the bonus calculator. The checks cover the common rules (datums on form tolerances, MMC on surfaces, runout at MMC, diameter zones, modifier use, datum order). They are not a full standards review.',
  source: 'Rules as confirmed in docs/gdt.md (Geometric Learning Systems Y14.5-2018 chart, GD&T Basics, KEYENCE, University of Illinois ME 170 notes, Mitutoyo, Skill-Lync).',
},
{
  id: 'gdttp', level: 'advanced', group: 'GD&T', title: 'True position check',
  desc: 'Diametral position deviation from measured X and Y (and Z) deviations, compared with the position tolerance plus any bonus. All lengths in one unit.',
  fields: s => [
    { id: 'dx', label: 'Measured deviation dX from true position', unit: lenU(s), def: s === 'inch' ? 0.003 : 0.05 },
    { id: 'dy', label: 'Measured deviation dY', unit: lenU(s), def: s === 'inch' ? 0.004 : 0.04 },
    { id: 'dz', label: 'dZ (spherical zone only, else blank)', unit: lenU(s), def: '' },
    { id: 'tol', label: 'Position tolerance (diameter)', unit: lenU(s), def: s === 'inch' ? 0.010 : 0.1 },
    { id: 'mc', label: 'Material condition', unit: '', def: 1, options: [[0, 'RFS (no modifier)'], [1, 'MMC'], [2, 'LMC']] },
    { id: 'int', label: 'Feature', unit: '', def: 1, options: [[1, 'Internal (hole, slot)'], [0, 'External (pin, boss)']] },
    { id: 'lo', label: 'Size lower limit', unit: lenU(s), def: s === 'inch' ? 0.250 : 6.0 },
    { id: 'hi', label: 'Size upper limit', unit: lenU(s), def: s === 'inch' ? 0.255 : 6.1 },
    { id: 'act', label: 'Actual (mating) size', unit: lenU(s), def: s === 'inch' ? 0.253 : 6.04 },
  ],
  calc: (v, W, s) => {
    if (!(isFinite(v.dx) && isFinite(v.dy))) return [];
    const dp = s === 'inch' ? 4 : 3, u = lenU(s);
    const tp = isFinite(v.dz) ? W.gdt_true_position_3d(v.dx, v.dy, v.dz) : W.gdt_true_position(v.dx, v.dy);
    const rows = [R(isFinite(v.dz) ? 'Position deviation (spherical diameter)' : 'Position deviation (diameter)', tp, u, dp), R('Radial offset from true position', tp / 2, u, dp)];
    if (!(v.tol >= 0)) return rows;
    let allowed = v.tol;
    if (v.mc > 0) {
      if (!(v.lo > 0 && v.hi >= v.lo && v.act > 0)) return rows.concat([R('Bonus', 'Enter the size limits and actual size', '', 0)]);
      const b = W.gdt_bonus(v.lo, v.hi, v.act, v.int, v.mc);
      if (!isFinite(b)) return rows.concat([R('Size', 'Actual size is outside the size limits: reject for size', '', 0)]);
      rows.push(R('Bonus tolerance', b, u, dp));
      allowed = W.gdt_total_tol(v.tol, v.lo, v.hi, v.act, v.int, v.mc);
    }
    rows.push(R('Position tolerance allowed at this size', allowed, u, dp));
    rows.push(R('Used', allowed > 0 ? 100 * tp / allowed : NaN, '%', 1));
    rows.push(R('Result', tp <= allowed + 1e-12 ? 'PASS' : 'FAIL (over by ' + (tp - allowed).toFixed(dp) + ' ' + u + ')', '', 0));
    return rows;
  },
  working: 'Position deviation (diameter) = 2 x sqrt(dX^2 + dY^2); with dZ for a spherical zone, 2 x sqrt(dX^2 + dY^2 + dZ^2). The factor 2 is because the tolerance is a diameter and sqrt(...) is the radial offset. Bonus (MMC) = |actual size - MMC size|; (LMC) = |actual size - LMC size|; none at RFS. Allowed = stated tolerance + bonus. Hole MMC = smallest size, pin MMC = largest size. Measure dX, dY in the datum reference frame. Datum feature shift (MMB) is not included.',
  source: 'GD&T Basics (true position, MMC); Wevolver (true position formula); Skill-Lync and JLCCNC (bonus at MMC and LMC). Standard: ASME Y14.5-2018 (position). See docs/gdt.md.',
},
{
  id: 'gdtbonus', level: 'advanced', group: 'GD&T', title: 'Bonus, virtual and resultant condition',
  desc: 'MMC and LMC sizes, bonus tolerance at an actual size, virtual condition and resultant condition for internal and external features of size.',
  fields: s => [
    { id: 'int', label: 'Feature', unit: '', def: 1, options: [[1, 'Internal (hole, slot)'], [0, 'External (pin, boss)']] },
    { id: 'mc', label: 'Material condition modifier', unit: '', def: 1, options: [[1, 'MMC'], [2, 'LMC'], [0, 'RFS (no modifier)']] },
    { id: 'lo', label: 'Size lower limit', unit: lenU(s), def: s === 'inch' ? 0.500 : 10.0 },
    { id: 'hi', label: 'Size upper limit', unit: lenU(s), def: s === 'inch' ? 0.510 : 10.2 },
    { id: 'tol', label: 'Geometric tolerance', unit: lenU(s), def: s === 'inch' ? 0.010 : 0.1 },
    { id: 'act', label: 'Actual (mating) size (optional)', unit: lenU(s), def: s === 'inch' ? 0.506 : '' },
  ],
  calc: (v, W, s) => {
    if (!(v.lo > 0 && v.hi >= v.lo && v.tol >= 0)) return [];
    const dp = s === 'inch' ? 4 : 3, u = lenU(s);
    const rows = [R('MMC size', W.gdt_mmc_size(v.lo, v.hi, v.int), u, dp), R('LMC size', W.gdt_lmc_size(v.lo, v.hi, v.int), u, dp),
      R('Maximum possible bonus (size tolerance)', v.mc > 0 ? v.hi - v.lo : 0, u, dp)];
    if (v.act > 0) {
      const b = W.gdt_bonus(v.lo, v.hi, v.act, v.int, v.mc);
      if (isFinite(b)) { rows.push(R('Bonus at actual size', b, u, dp)); rows.push(R('Total geometric tolerance at actual size', v.tol + b, u, dp)); }
      else rows.push(R('Actual size', 'Outside the size limits: reject for size', '', 0));
    }
    if (v.mc > 0) {
      rows.push(R('Virtual condition', W.gdt_virtual_condition(v.lo, v.hi, v.tol, v.int, v.mc), u, dp));
      rows.push(R('Resultant condition' + (v.mc === 2 ? ' (derived, see note)' : ''), W.gdt_resultant_condition(v.lo, v.hi, v.tol, v.int, v.mc), u, dp));
      if (v.mc === 1) rows.push(R(v.int ? 'Functional gauge pin size' : 'Functional gauge hole size', W.gdt_virtual_condition(v.lo, v.hi, v.tol, v.int, 1), u, dp));
    } else {
      rows.push(R(v.int ? 'Inner boundary (RFS)' : 'Outer boundary (RFS)', v.int ? v.lo - v.tol : v.hi + v.tol, u, dp));
      rows.push(R(v.int ? 'Outer boundary (RFS)' : 'Inner boundary (RFS)', v.int ? v.hi + v.tol : v.lo - v.tol, u, dp));
    }
    return rows;
  },
  working: 'MMC: hole = smallest size, pin = largest. LMC: the opposite. Bonus = |actual - MMC| (MMC modifier) or |actual - LMC| (LMC modifier); none at RFS. Virtual condition: MMC hole = MMC - tol; MMC pin = MMC + tol; LMC hole = LMC + tol; LMC pin = LMC - tol. Resultant condition (the other worst case, with the full bonus used): MMC hole = LMC + tol + size tolerance; MMC pin = LMC - tol - size tolerance. For the LMC modifier BenchMate derives it the same way (hole = MMC - tol - size tolerance; pin = MMC + tol + size tolerance): this LMC case is to be verified against a second published source. At RFS the inner and outer boundaries are shown instead (same arithmetic, but not a virtual condition).',
  source: 'GD&T Basics (virtual condition, inner/outer boundary at RFS); Skill-Lync and JLCCNC (MMC/LMC virtual condition, bonus); Open Exam Prep GDTP study guide (resultant condition at MMC). Standard: ASME Y14.5-2018. See docs/gdt.md.',
},
{
  id: 'gdtconv', level: 'advanced', group: 'GD&T', title: 'Position and plus/minus conversion',
  desc: 'Diameter position zone that just contains a plus/minus coordinate zone, and the plus/minus zone that fits inside a position diameter.',
  fields: s => [
    { id: 'tx', label: 'Plus/minus tolerance in X', unit: lenU(s), def: s === 'inch' ? 0.005 : 0.1 },
    { id: 'ty', label: 'Plus/minus tolerance in Y (blank = same as X)', unit: lenU(s), def: '' },
    { id: 'd', label: 'Or position tolerance (diameter)', unit: lenU(s), def: s === 'inch' ? 0.014 : 0.28 },
  ],
  calc: (v, W, s) => {
    const dp = s === 'inch' ? 4 : 3, u = lenU(s), rows = [];
    if (v.tx > 0) {
      const ty = v.ty > 0 ? v.ty : v.tx;
      rows.push(R('Position diameter containing the +/- zone', W.gdt_pos_from_pm(v.tx, ty), u, dp));
      rows.push(R('Area gain of that circle over the +/- zone', 100 * (Math.PI * (v.tx * v.tx + ty * ty) / (4 * v.tx * ty) - 1), '%', 1));
    }
    if (v.d > 0) rows.push(R('Equal +/- that fits inside the diameter', W.gdt_pm_from_pos(v.d), u, dp));
    return rows;
  },
  working: 'Circle round a +/-tx by +/-ty rectangle: diameter = 2 x sqrt(tx^2 + ty^2) (equal tx = ty: 2.828 x tx). Square inside a circle of diameter d: +/- d / (2 x sqrt 2) = +/- 0.3536 d. Converting a +/- drawing to position with the circumscribing circle accepts parts in the circle outside the original square, so only do it where function allows. Converting position to +/- with the inscribed square is conservative.',
  source: 'Geometry (BenchMate derivation, tests in core/src/gdt.rs); square versus round zone explained by GD&T Basics and Wevolver (about 57% more area).',
},
{
  id: 'gdtfast', level: 'advanced', group: 'GD&T', title: 'Fastener position tolerance',
  desc: 'Position tolerance (at MMC) for clearance holes from the floating and fixed fastener formulas, or the clearance hole size for given tolerances.',
  fields: s => [
    { id: 'mode', label: 'Case', unit: '', def: 1, options: [[1, 'Floating (clearance holes in both parts)'], [2, 'Fixed (fastener held in one part)']] },
    { id: 'H', label: 'Clearance hole MMC (smallest hole)', unit: lenU(s), def: s === 'inch' ? 0.28 : 9.0 },
    { id: 'F', label: 'Fastener MMC (largest diameter)', unit: lenU(s), def: s === 'inch' ? 0.25 : 8.0 },
    { id: 't1', label: 'Fixed: tolerance already given to the threaded/pinned part (optional)', unit: lenU(s), def: '' },
  ],
  calc: (v, W, s) => {
    if (!(v.H > 0 && v.F > 0)) return [];
    const dp = s === 'inch' ? 4 : 3, u = lenU(s);
    if (v.H <= v.F) return [R('Clearance', 'Hole MMC must be larger than fastener MMC', '', 0)];
    if (v.mode === 2) {
      const rows = [R('Total for both parts (t1 + t2 = H - F)', v.H - v.F, u, dp), R('Equal split, each part', W.gdt_fixed_tol(v.H, v.F), u, dp)];
      if (v.t1 >= 0 && isFinite(v.t1)) {
        const t2 = W.gdt_fixed_tol_other(v.H, v.F, v.t1);
        rows.push(t2 >= 0 ? R('Left for the clearance-hole part', t2, u, dp) : R('Left for the clearance-hole part', 'None: t1 uses more than H - F', '', 0));
      }
      rows.push(R('Note', 'Use a projected tolerance zone on the threaded or pinned hole, or allow for its perpendicularity', '', 0));
      return rows;
    }
    return [R('Position tolerance at MMC, each part', W.gdt_floating_tol(v.H, v.F), u, dp)];
  },
  working: 'H = clearance hole MMC, F = fastener MMC, both position tolerances at MMC. Floating fastener: T = H - F for each part. Fixed fastener: t1 + t2 = H - F, equal split T = (H - F) / 2. Reverse: H = F + T (floating), H = F + t1 + t2 (fixed). Worst case, zero clearance at the limits: add margin where needed. The fixed formula assumes the fastener is square to the mating face; a projected tolerance zone covers the tilt.',
  source: 'ASME Y14.5 nonmandatory appendix on fastener formulas (cited, not reproduced); Open Exam Prep GDTP study guide and Skill-Lync (formulas); GD&T Basics (appendix covers fixed and floating fasteners). See docs/gdt.md.',
},
{
  id: 'gdtcomp', level: 'expert', group: 'GD&T', title: 'Composite position checker',
  desc: 'Check a hole pattern against a composite position frame: the upper row (PLTZF) locates each hole to the datums, the lower row (FRTZF) relates the holes to each other after the best allowed shift (and rotation) of the whole group.',
  render: el => renderComposite(el),
  working: 'Upper row: each hole, diameter = 2 x sqrt(dX^2 + dY^2) from its basic location, must be within the upper tolerance plus its bonus. Lower row: BenchMate finds the shift (and, with only the primary datum in the lower row, the small rotation) of the group of lower-row zones that minimises the worst hole, max over holes of (2 x distance to its moved zone centre - bonus), and compares it with the lower tolerance. The minimisation is exact for this convex problem (nested golden-section search, checked against grid searches in the tests). Perpendicularity to datum A (the orientation the lower row also controls) is not checked here: measure it separately. Datum feature shift is not included.',
  source: 'FARO (O. Ekinci) and 3DCS help on composite position; GD&T Basics (composite vs multiple single-segment). Standard: ASME Y14.5-2018 (composite positional tolerancing, cited only). See docs/gdt.md.',
},
{
  id: 'gdtprofu', level: 'expert', group: 'GD&T', title: 'Unequal profile (U) zone',
  desc: 'Zone limits for a profile tolerance with the unequally disposed (U) modifier, the equivalent offset for CMM software, and a check of a measured deviation.',
  fields: s => [
    { id: 't', label: 'Total profile tolerance (first value)', unit: lenU(s), def: s === 'inch' ? 0.024 : 0.6 },
    { id: 'u', label: 'Value after U (outside the material)', unit: lenU(s), def: s === 'inch' ? 0.008 : 0.2 },
    { id: 'e', label: 'Measured deviation (+ outside material, - into material)', unit: lenU(s), def: '' },
  ],
  calc: (v, W, s) => {
    if (!(v.t > 0 && v.u >= 0)) return [];
    if (v.u > v.t) return [R('U value', 'Must not be more than the total tolerance: invalid callout', '', 0)];
    const dp = s === 'inch' ? 4 : 3, u = lenU(s);
    const rows = [R('Zone limit on the material-adding side (outside)', W.gdt_profile_u_outside(v.t, v.u), u, dp),
      R('Zone limit on the material-removing side (inside)', W.gdt_profile_u_inside(v.t, v.u), u, dp),
      R('As an equal zone of +/- t/2 about an offset profile: offset', W.gdt_profile_u_offset(v.t, v.u), u, dp),
      R('Half width of that equal zone', v.t / 2, u, dp)];
    if (isFinite(v.e)) { const m = W.gdt_profile_u_margin(v.t, v.u, v.e); rows.push(R('Margin left', m, u, dp)); rows.push(R('Result', m >= -1e-12 ? 'PASS' : 'FAIL', '', 0)); }
    return rows;
  },
  working: 'Frame: profile symbol, total tolerance t, U, value u. u is the part of the zone on the side that adds material (outside the material: away from the solid on an outside surface, towards the centre of a pocket or hole); t - u lies on the side that removes material. u = t: all outside; u = 0: all inside; u = t/2 is the ordinary equal zone. Equal-zone form for CMM software: offset the profile by (u - (t - u)) / 2 = u - t/2 towards the outside and apply +/- t/2. Example: t 0.6, u 0.2 on an outside surface at 50.0: limits 50.2 and 49.6.',
  source: 'GD&T Basics (unequally disposed profile, citing Y14.5-2018 6.3.22); Open Exam Prep GDTP study guide (disposition, citing Y14.5-2009 8.3.1.2). ISO 1101:2017 writes the same idea as UZ with a signed offset (KEYENCE). See docs/gdt.md.',
},
{
  id: 'gdtdof', level: 'expert', group: 'GD&T', title: 'Datum reference frame and degrees of freedom',
  desc: 'Step through a three-plane datum reference frame and see which of the six degrees of freedom each datum removes.',
  render: el => renderDof(el),
  working: 'Primary plane A: three or more contact points, removes Tz, Rx, Ry. Secondary plane B, square to A: two or more points, removes Tx, Rz. Tertiary plane C, square to both: one or more point, removes Ty.',
  source: 'GD&T Basics (datums and degrees of freedom); CNCCookbook (3-2-1); University of Illinois ME 170 notes (datum order). Axis assignment: BenchMate geometry. See docs/gdt.md.',
},
{
  id: 'gdtstack', level: 'expert', group: 'GD&T', title: 'Tolerance stack (worst case and RSS)',
  desc: 'One-dimensional stack of up to 10 dimensions: gap at nominal and mean, worst-case and root-sum-square (RSS) limits.',
  render: el => renderStack(el),
  working: 'Each dimension is centred on its mean, nominal + (plus - minus) / 2, with half tolerance (plus + minus) / 2. Gap = sum of (+/-) means. Worst case = sum of half tolerances. RSS = sqrt(sum of squared half tolerances), which assumes independent, normally distributed dimensions centred in their tolerance and made at the same capability (each half tolerance = 3 sigma). Use RSS only where that is true; otherwise use worst case. Geometric tolerances (position, profile) enter a stack as plus/minus half their zone.',
  source: 'Accendo Reliability (F. Schenkelberg) and Five Flute RSS tolerance analysis guides; BenchMate arithmetic with tests in core/src/gdt.rs.',
},
{
  id: 'abbrev', level: 'advanced', group: 'Drawings', title: 'Drawing abbreviations',
  desc: 'Common abbreviations on engineering drawings (CSK, CBORE, THRU, PCD, TYP, MMC...) in plain words, with how many free publishers list each.',
  render: el => renderAbbrev(el),
  working: "No calculation: BenchMate's own list and wording.",
  source: 'ASME Y14.38 and ISO 128 (by name only); Wikipedia and IS 11670:1993 (Public.Resource.Org). See docs/sources.md.',
},
{
  id: 'weight', level: 'simple', group: 'Stock and sheet metal', title: 'Stock weight',
  desc: 'Weight of round, hex, square, tube, flat bar, plate and sheet stock, per piece, per batch and per metre or foot.',
  render: el => renderWeight(el),
  working: 'Weight = section area x length x density. Round πd²/4; hex (√3/2)s² across flats s; square s²; tube π/4 (D² - (D - 2t)²); flat, plate or sheet width x thickness. Sharp corners assumed (no corner radii on hex, square or flat).',
  source: 'Areas of plane figures; densities from the material data where Confirmed, else from your data sheet. See docs/geometry.md.',
},
{
  id: 'gauges', level: 'advanced', group: 'Stock and sheet metal', title: 'Sheet metal and wire gauges',
  desc: 'What a gauge number means in inches and mm: steel, galvanized, stainless and aluminium sheet, and the American (AWG), British (SWG) and tube wall wire gauges side by side.',
  render: el => renderGauges(el),
  working: 'Sheet gauges and the SWG are tables, each value as two publishers print it. AWG diameter = 0.005 in × 92^((36 − n) / 39); 0, 2/0, 3/0 and 4/0 are n = 0, −1, −2 and −3.',
  source: 'Wikipedia, Sheet metal and Standard wire gauge; The Engineering ToolBox, gauge and weight chart and SWG table. AWG rule: Wikipedia, American wire gauge (after ASTM B258), RapidTables and Omni Calculator. See docs/sources.md, Wire and sheet metal gauges.',
},
{
  id: 'bend', level: 'advanced', group: 'Stock and sheet metal', title: 'Sheet-metal bend allowance',
  desc: 'Bend allowance, outside setback and bend deduction for a bend, flat length of a two-flange part, and the K-factor from a test bend.',
  fields: s => [
    { id: 't', label: 'Material thickness', unit: lenU(s), def: '' },
    { id: 'r', label: 'Inside bend radius', unit: lenU(s), def: '' },
    { id: 'a', label: 'Bend angle (angle bent through; 90 for a right angle)', unit: 'deg', def: 90 },
    { id: 'k', label: 'K-factor (from your tooling or a test bend)', unit: '', def: '' },
    { id: 'f1', label: 'Flange 1 length to the outside mould line (optional)', unit: lenU(s), def: '' },
    { id: 'f2', label: 'Flange 2 length to the outside mould line (optional)', unit: lenU(s), def: '' },
    { id: 'ba', label: 'Or: measured bend allowance from a test bend (for K)', unit: lenU(s), def: '' },
  ],
  calc: (v, W, s) => {
    const u = lenU(s), dp = s === 'inch' ? 4 : 3, rows = [];
    if (!(v.t > 0) || !(v.r >= 0) || !(v.a > 0 && v.a < 180)) return [];
    rows.push(R('Outside setback, tan(angle/2) x (R + t)', W.outside_setback(v.a, v.r, v.t), u, dp));
    if (v.k >= 0 && v.k <= 1) {
      const ba = W.bend_allowance(v.a, v.r, v.k, v.t), bd = W.bend_deduction(v.a, v.r, v.k, v.t);
      rows.push(R('Bend allowance', ba, u, dp), R('Bend deduction', bd, u, dp));
      if (v.f1 > 0 && v.f2 > 0) rows.push(R('Flat length = flange 1 + flange 2 - bend deduction', v.f1 + v.f2 - bd, u, dp));
      const os = W.outside_setback(v.a, v.r, v.t);
      if ((v.f1 > 0 && v.f1 < os) || (v.f2 > 0 && v.f2 < os)) rows.push(R('Check', 'A flange is shorter than the outside setback: the bend does not fit inside it, so the flat length is not usable', '', 0));
    } else rows.push(R('K-factor needed: from your press brake tooling chart or a test bend', 'not entered', '', 0));
    if (v.ba > 0) rows.push(R('K-factor from the measured bend allowance', W.k_from_bend_allowance(v.a, v.r, v.t, v.ba), '', 3));
    return rows;
  },
  working: 'Bend allowance BA = angle (radians) x (R + K t): the length of the neutral axis through the bend. Outside setback OSSB = tan(angle/2) x (R + t). Bend deduction BD = 2 OSSB - BA. Flat length = sum of flanges to the outside mould lines - BD per bend. K = (BA / angle - R) / t. K depends on material, thickness, radius and tooling; BenchMate has no default. Flanges are measured to the virtual sharp; for bends over 90° some CAD systems measure flanges differently, so check which convention your drawing uses.',
  source: 'KETIV Technologies, Sheet metal unfold rule equations (BA, OSSB, BD, K); Aircraft Systems Tech, Making straight line bends (FAA-based: bend allowance, setback = K(R + T) with K = 1 at 90°, flat = mould line dimensions - setbacks + bend allowances). See docs/geometry.md.',
},
{
  id: 'capability', level: 'expert', group: 'Inspection and quality', title: 'Process capability (Cp, Cpk, Pp, Ppk)',
  desc: 'Paste measurements (in production order) or enter a mean and sigma. Gives Cp, Cpk, Pp, Ppk, expected parts per million out of spec and a histogram with the fitted normal curve.',
  render: el => renderCapability(el),
  working: 'Cp = (USL - LSL) / 6 sigma; Cpk = min((USL - mean) / 3 sigma, (mean - LSL) / 3 sigma); one-sided: only the index for the limit given. Cp and Cpk use the within (short-term) sigma: average moving range / d2 (d2 = 1.128 for ranges of two consecutive values), or for subgroups of k consecutive values the mean range / d2(k). Pp and Ppk use the same formulas with the overall sample standard deviation (divisor n - 1). Expected ppm: normal tail areas beyond each limit. Histogram bins: Sturges (ceil(log2 n) + 1).',
  source: 'NIST/SEMATECH e-Handbook of Statistical Methods, 6.1.6 (capability indices, ppm table, ~50 values) and 6.3.2 (d2) (public domain); Minitab support, methods and formulas for normal capability analysis (within and overall sigma). Pp/Ppk as the same formulas on the overall sigma: one source read, to be verified. Normal tail: Numerical Recipes erfc. See docs/shop-helpers.md.',
},
{
  id: 'ctrlchart', level: 'expert', group: 'Inspection and quality', title: 'Control charts (X-bar/R, individuals)',
  desc: 'Individuals and moving range, or X-bar and R charts for subgroups of 2 to 10, from pasted measurements: centre lines, control limits, the charts with points beyond a limit marked, and the A2, D3, D4 constants checked against two tables.',
  render: el => renderCtrlChart(el),
  working: 'Individuals: mean +/- 3 MR-bar / 1.128; MR UCL = 3.267 MR-bar. X-bar: grand mean +/- A2 R-bar; R: D3 R-bar to D4 R-bar. See the note under the tool.',
  source: 'NIST/SEMATECH e-Handbook of Statistical Methods 6.3.2.1 and 6.3.2.2; University of York factors for control charts; d2 and d3 computed by numerical integration (core tests). See docs/inspection.md.',
},
{
  id: 'grr', level: 'expert', group: 'Inspection and quality', title: 'Gauge R&R (average and range method)',
  desc: 'Paste the readings of a gauge study (2 to 5 appraisers, 2 to 4 trials, 2 to 10 parts): repeatability, reproducibility, gauge R&R and part variation as a share of the total variation and of the tolerance, the number of distinct categories, and a chart against the 10 % and 30 % guidelines.',
  render: el => renderGrr(el),
  working: 'EV = R-bar K1; AV = sqrt((X-diff K2)^2 - EV^2 / (n r)), zero when negative; GRR = sqrt(EV^2 + AV^2); PV = Rp K3; TV = sqrt(GRR^2 + PV^2); ndc = 1.41 PV / GRR cut to a whole number; percent of tolerance = 6 GRR / tolerance. K1 = 1 / d2, K2 and K3 = 1 / d2*. See the note under the tool.',
  source: 'OriginLab, Algorithm for Gage R&R Study; Minitab support, methods and formulas for the crossed gage R&R study; sixsigmastudyguide.com, Repeatability and reproducibility; spcforexcel.com, Three Methods to Analyze Gage R&R Studies (2015); SAS/QC GAGE application. AIAG Measurement Systems Analysis, 4th ed., cited by name. See docs/inspection.md.',
},
{
  id: 'sampling', level: 'expert', group: 'Inspection and quality', title: 'Sampling plan OC curve',
  desc: 'For a single sampling plan (sample n, accept on c or fewer defectives): chance of accepting a lot at any percent defective, the OC curve, the 95 % and 10 % points and the AOQL, plus how ISO 2859-1 / ANSI Z1.4 choose plans (tables not reproduced).',
  render: el => renderSampling(el),
  working: 'Pa = sum_{k=0..c} C(n,k) p^k (1-p)^(n-k) (binomial), Poisson with lambda = n p; AOQ = p Pa (N - n) / N.',
  source: 'Binomial and Poisson distributions; NIST/SEMATECH e-Handbook 6.2.3 (by name); ISO 2859-1:1999 and ANSI/ASQ Z1.4-2003 described by name only. See docs/inspection.md.',
},
{
  id: 'tolmid', level: 'advanced', group: 'Inspection and quality', title: 'Limits and middle of a tolerance',
  desc: 'Type a toleranced size the way the drawing gives it: a size with two deviations, a size with an equal plus and minus, or two limits. It gives both limits and the middle, which is the size to program or aim for so the same tolerance is left on both sides.',
  fields: s => [
    { id: 'form', label: 'The drawing gives', unit: '', def: 1, options: [[1, 'Size, two deviations'], [2, 'Size, equal + and -'], [3, 'Two limits']] },
    { id: 'nom', label: 'Size', unit: lenU(s), def: s === 'inch' ? 1 : 25, when: v => v.form !== 3 },
    { id: 'up', label: 'First deviation, with its sign', unit: lenU(s), def: s === 'inch' ? 0.002 : 0.05, when: v => v.form === 1 },
    { id: 'lo', label: 'Second deviation, with its sign', unit: lenU(s), def: s === 'inch' ? -0.001 : -0.02, when: v => v.form === 1 },
    { id: 'pm', label: 'Plus and minus', unit: lenU(s), def: s === 'inch' ? 0.002 : 0.05, when: v => v.form === 2 },
    { id: 'l1', label: 'One limit', unit: lenU(s), def: s === 'inch' ? 1.002 : 25.05, when: v => v.form === 3 },
    { id: 'l2', label: 'Other limit', unit: lenU(s), def: s === 'inch' ? 0.999 : 24.98, when: v => v.form === 3 },
  ],
  calc: (v, W, s) => {
    const a = v.form === 3 ? [0, v.l1, v.l2] : v.form === 2 ? [v.nom, Math.abs(v.pm), -Math.abs(v.pm)] : [v.nom, v.up, v.lo];
    if (!a.every(isFinite)) return [];
    const t = k => W.tol_limits(a[0], a[1], a[2], k), dp = s === 'inch' ? 5 : 4, inch = s === 'inch';
    const other = x => W.unit_convert(0, inch ? 5 : 1, inch ? 1 : 5, x);
    const rows = [R('Middle of the tolerance (program this)', t(2), lenU(s), dp), R('Upper limit', t(0), lenU(s), dp), R('Lower limit', t(1), lenU(s), dp),
      R('Tolerance (upper limit minus lower limit)', t(3), lenU(s), dp), R('Equal plus and minus about the middle', t(4), lenU(s), dp)];
    if (v.form !== 3) rows.push(R('Middle minus the drawing size', t(5), lenU(s), dp));
    rows.push(R('Middle in ' + (inch ? 'mm' : 'inches'), other(t(2)), inch ? 'mm' : 'in', inch ? 4 : 5),
      R('Limits in ' + (inch ? 'mm' : 'inches'), DK.n(other(t(1)), inch ? 4 : 5) + ' to ' + DK.n(other(t(0)), inch ? 4 : 5), inch ? 'mm' : 'in', 0));
    return rows;
  },
  working: 'upper limit = size + larger deviation; lower limit = size + smaller deviation; middle = (upper limit + lower limit) / 2; tolerance = upper limit - lower limit. 1 in = 25.4 mm exactly.',
  source: 'Definitions of limits of size, deviations and tolerance as in ISO 286-1:2010 clause 3 and ASME Y14.5-2018 (cited by name; nothing reproduced). The middle is plain arithmetic; worked examples in the core tests.',
  proof: [{ name: 'A 25 g6 shaft', sys: 'mm', vals: { form: 1, nom: 25, up: -0.007, lo: -0.02 }, expect: [['Upper limit', 'mm', 24.993, 1e-9], ['Lower limit', 'mm', 24.98, 1e-9]],
    source: 'ISO 286 limit deviations for g6 over 18 up to 30 mm, -0.007 and -0.020 mm, as in the Limits and fits tool (each value printed by two publishers). The limits of size are 24.993 and 24.980 mm.' }],
},
{
  id: 'offsetadj', level: 'advanced', group: 'Inspection and quality', title: 'Wear offset adjustment',
  desc: 'Type what the part measures and what it should be. It gives the change to make to the wear offset, with its sign, and the new offset value: for turned diameters and bores, sizes milled with cutter compensation, depths and heights.',
  fields: s => [
    { id: 'kind', label: 'What was cut', unit: '', def: 1, options: [[1, 'Lathe: diameter or bore'], [2, 'Mill: outside, cutter comp'], [3, 'Mill: inside, cutter comp'], [4, 'Depth below Z zero'], [5, 'Height or length left']] },
    { id: 'meas', label: 'Measured size', unit: lenU(s), def: s === 'inch' ? 1.002 : 25.04 },
    { id: 'targ', label: 'Target size', unit: lenU(s), def: s === 'inch' ? 1 : 25 },
    { id: 'xval', label: 'The X offset is a', unit: '', def: 1, options: [[1, 'Diameter value'], [2, 'Radius value']], when: v => v.kind === 1 },
    { id: 'dval', label: 'The D offset is a', unit: '', def: 2, options: [[2, 'Radius value'], [1, 'Diameter value']], when: v => v.kind === 2 || v.kind === 3 },
    { id: 'cur', label: 'Wear offset now', unit: lenU(s), def: 0 },
  ],
  calc: (v, W, s) => {
    if (![v.meas, v.targ].every(isFinite)) return [];
    const k = v.kind, sense = k === 3 || k === 4 ? 1 : -1, half = (k === 1 && v.xval === 2) || ((k === 2 || k === 3) && v.dval === 2) ? 1 : 0;
    const t = i => W.offset_adjust(v.meas, v.targ, sense, half, isFinite(v.cur) ? v.cur : 0, i), inch = s === 'inch', dp = inch ? 5 : 4, u = lenU(s);
    const name = k === 1 ? 'X wear' : k <= 3 ? 'D (cutter) wear' : 'Z or tool length wear', c = +t(1).toFixed(dp + 2);
    const eff = k === 1 ? ['toward X minus: a smaller diameter', 'toward X plus: a larger diameter'] : k <= 3 ? ['toward the wall: more is removed', 'away from the wall: less is removed'] : ['toward Z minus: deeper', 'toward Z plus: shallower'];
    const words = c === 0 ? 'On target: no change needed' : (c > 0 ? 'Add ' : 'Subtract ') + DK.n(Math.abs(c), dp) + ' ' + u + '. The ' + (k === 2 || k === 3 ? 'cutter' : 'tool') + ' moves ' + eff[c > 0 ? 1 : 0];
    return [R('Change the ' + name + ' offset by', t(1), u, dp), R('New ' + name + ' offset value', t(2), u, dp), R('In words', words, '', 0),
      R('Error (measured minus target)', t(0), u, dp), R('Change in ' + (inch ? 'mm' : 'inches'), W.unit_convert(0, inch ? 5 : 1, inch ? 1 : 5, t(1)), inch ? 'mm' : 'in', inch ? 4 : 5)];
  },
  working: 'error = measured - target. Lathe diameter or bore: change = -error when the X offset is a diameter value, -error / 2 when it is a radius value. Mill with cutter compensation, D as a radius value: outside size change = -error / 2, inside size change = +error / 2 (a smaller D value lets the cutter remove more on both); as a diameter value, -error and +error. Depth below Z zero: change = +error. Height or length left: change = -error. New value = wear offset now + change. This assumes the control adds the wear value to the tool position (X and Z wear on a lathe, the G43 length offset on a mill) and that G41 / G42 hold the cutter away from the programmed part outline by the D value. Controls, posts and shops differ (G44, wear kept on the work offset, "inverse wear" from a CAM post, a boring bar set on the far side), and tool pressure changes the size too: make the change, cut and measure again before you trust the sign.',
  source: 'Turned diameter: Modern Machine Shop, "Taking full advantage of geometry and wear offsets" (0.002 in oversize, -0.002 in the X wear offset). Outside size with cutter compensation: Autodesk Fusion blog, "Cutter compensation for beginners" (boss 1.001 for 1.000, -0.001 in a diameter table) and CIMCO CNC Handbook chapter 6, "Adjusting CDC offsets" (1.0120 for 1.0000, -0.0120). G43 adds the length offset to the Z position: Machinist Guides, "G43 G-code". The inside size, radius value, depth and height rules are BenchMate\'s own arithmetic from those and have no second publisher yet (tests in core/src/measure.rs).',
  proof: [{ name: 'A turned diameter 0.002 in oversize', sys: 'inch', vals: { kind: 1, meas: 1.002, targ: 1, xval: 1, cur: 0 }, expect: [['Change the X wear', 'in', -0.002, 1e-9]],
    source: 'Modern Machine Shop, "Taking full advantage of geometry and wear offsets": a finish turning tool cutting a diameter 0.002 in oversize is corrected with -0.002 in the X register of its wear offset.' }],
},
{
  id: 'tempcomp', level: 'expert', group: 'Inspection and quality', title: 'Temperature compensation',
  desc: 'Correct a measurement taken away from the 20 °C (68 °F) reference temperature to the length at 20 °C, allowing for both the part and the gauge expanding.',
  render: el => renderTempComp(el),
  working: 'L20 = reading x (1 + a_gauge x (T_gauge - 20)) / (1 + a_part x (T_part - 20)), temperatures in °C, a in 1/K. The gauge graduations grow with its temperature; the part grows with its own. Inverse for the reading a to-size part gives. Coefficient uncertainty: L x u(a) x |T_part - 20|.',
  source: 'ISO 1:2022 (reference temperature 20 °C, cited only); T. Doiron, J. Res. NIST 112(1), 2007 (history and use of 20 °C); expansion formula dL = L a dT. See docs/shop-helpers.md.',
},
{
  id: 'ballcone', level: 'advanced', group: 'Inspection and quality', title: 'Ball in a countersink or tapered bore',
  desc: 'Height of a gauge ball over the face of a countersink or tapered bore, the face diameter from a ball reading, and the angle and diameter of a tapered bore from two balls.',
  render: el => renderBallCone(el),
  working: 'a = half the included angle, r = ball radius, D = diameter at the face, h = height of the ball top over the face. h = r + r / sin a - D / (2 tan a); D = 2 (r / cos a - (h - r) tan a). Two balls: sin a = (r2 - r1) / ((h2 - r2) - (h1 - r1)).',
  source: "Plane geometry (circle tangent to two lines), BenchMate derivation checked in tests by round trips; method as in Machinery's Handbook 'measuring tapers with balls' (by name). See docs/sources.md.",
},
{
  id: 'taperrolls', level: 'advanced', group: 'Inspection and quality', title: 'Taper over rolls',
  desc: 'External taper measured over a pair of rolls on gauge blocks: the measurement for a known taper, or the included angle and small-end diameter from two readings at two block heights.',
  render: el => renderTaperRolls(el),
  working: 'M = D_H + d (1 + tan(45° + a/2)), D_H = D0 + 2 H tan a (a = half angle, d = roll diameter, H = block height). Two readings: tan a = (M2 - M1) / (2 (H2 - H1)).',
  source: "Plane geometry; the same relation as Machinery's Handbook 'measuring tapers with rolls' (by name); 1 + tan(45° + a/2) = 1 + tan a + sec a checked in tests. See docs/sources.md.",
},
{
  id: 'scales', level: 'simple', group: 'Inspection and quality', title: 'Micrometer and vernier reading',
  desc: 'A reading aid: shows a micrometer (0.01 mm, 0.001 mm, 0.001 in, 0.0001 in) or vernier caliper (0.02 mm, 0.05 mm, 0.001 in) scale at a value, and how the reading is made up.',
  render: el => renderScales(el),
  working: 'Micrometer: sleeve value + thimble division x (pitch / divisions) + vernier line x resolution. Caliper: main scale value + coinciding vernier line x resolution.',
  source: "Instrument makers' reading guides (see docs/sources.md); Machinery's Handbook 'reading verniers and micrometers' (by name).",
},
{
  id: 'coolconc', level: 'simple', group: 'Shop helpers', title: 'Coolant concentration (refractometer)',
  desc: 'Concentration of a water-miscible coolant from the refractometer reading and the fluid\'s refractometer factor.',
  fields: s => [
    { id: 'brix', label: 'Refractometer reading', unit: '°Brix', def: '' },
    { id: 'k', label: 'Refractometer factor (from the fluid data sheet)', unit: 'x', def: '' },
    { level: 'advanced', id: 'lo', label: 'Recommended range, low (optional)', unit: '%', def: '' },
    { level: 'advanced', id: 'hi', label: 'Recommended range, high (optional)', unit: '%', def: '' },
  ],
  calc: (v, W) => {
    if (!(v.k > 0)) return [R('Refractometer factor needed: copy it from the fluid\'s data sheet (it differs between fluids)', 'not entered', '', 0)];
    const c = W.coolant_conc(v.brix, v.k); if (!isFinite(c)) return [];
    const rows = [R('Concentration', c, '%', 2)];
    if (v.lo > 0 && c < v.lo) rows.push(R('Below the range: add concentrate (see Coolant mix and top-up)', 'low', '', 0));
    else if (v.hi > 0 && c > v.hi) rows.push(R('Above the range: add water (see Coolant mix and top-up)', 'high', '', 0));
    else if (v.lo > 0 || v.hi > 0) rows.push(R('Within the range', 'OK', '', 0));
    return rows;
  },
  working: 'Concentration % = refractometer reading (°Brix) x refractometer factor. The factor depends on the fluid and is printed on its data sheet; BenchMate has no default. If the reading is off the scale, divide the concentration you need by the factor to see which refractometer range you need. A blurred line on the refractometer usually means the fluid is due for replacement.',
  source: 'Fastenal, Tool Talk: Refractometers; Zebra Skimmers, refractometer product profile. See docs/shop-helpers.md.',
},
{
  id: 'coolmix', level: 'advanced', group: 'Shop helpers', title: 'Coolant mix and top-up',
  desc: 'How much concentrate or water to add to reach a target concentration, what mix to top up with, or what goes into a fresh fill.',
  fields: s => [
    { id: 'v', label: 'Volume in the sump now', unit: s === 'inch' ? 'US gal' : 'L', def: '' },
    { id: 'c', label: 'Concentration now (blank for a fresh fill)', unit: '%', def: '' },
    { id: 't', label: 'Target concentration', unit: '%', def: '' },
    { id: 'full', label: 'Sump volume when full (optional, for top-up)', unit: s === 'inch' ? 'US gal' : 'L', def: '' },
    { id: 'cc', label: 'Concentrate strength (100 unless pre-diluted)', unit: '%', def: 100 },
  ],
  calc: (v, W, s) => {
    const u = s === 'inch' ? 'US gal' : 'L', cc = v.cc > 0 ? v.cc : 100, rows = [];
    if (!(v.t > 0) || !(v.t < cc)) return v.t >= cc ? [R('Target must be below the concentrate strength', 'check', '', 0)] : [];
    if (!isFinite(v.c)) {
      if (!(v.v > 0)) return [];
      const k = W.coolant_concentrate_in(v.v, v.t, cc);
      return [R('Fresh fill: concentrate', k, u, 2), R('Fresh fill: water', v.v - k, u, 2)];
    }
    if (!(v.v > 0)) return [];
    if (v.t > v.c) { const x = W.coolant_add_concentrate(v.v, v.c, v.t, cc); rows.push(R('Concentrate to add (no top-up limit)', x, u, 2), R('Volume after', v.v + x, u, 1)); if (v.full > 0 && v.v + x > v.full) rows.push(R('More than the sump holds: drain some first or use the top-up mix below', 'check', '', 0)); }
    else if (v.t < v.c) { const w = W.coolant_add_water(v.v, v.c, v.t); rows.push(R('Water to add', w, u, 2), R('Volume after', v.v + w, u, 1)); if (v.full > 0 && v.v + w > v.full) rows.push(R('More than the sump holds: drain some first or use the top-up mix below', 'check', '', 0)); }
    else rows.push(R('Already at target', 'no change', '', 0));
    if (v.full > v.v) {
      const m = W.coolant_topup_mix(v.v, v.c, v.full, v.t), add = v.full - v.v;
      if (m < 0) rows.push(R('Top-up to full not possible: even plain water leaves it above target; drain some first', 'n/a', '', 0));
      else if (m > cc) rows.push(R('Top-up to full not possible: even neat concentrate leaves it below target', 'n/a', '', 0));
      else { const k = W.coolant_concentrate_in(add, m, cc); rows.push(R('Top-up to full: mix strength', m, '%', 2), R('Top-up: concentrate', k, u, 2), R('Top-up: water', add - k, u, 2)); }
    }
    return rows;
  },
  working: 'Mass balance of concentrate, by volume. Raise: x = V (c_target - c_now) / (c_conc - c_target). Lower: water = V (c_now - c_target) / c_target. Top-up to full: mix % = (c_target x V_full - c_now x V_now) / (V_full - V_now). Fresh fill: concentrate = V x c_target / c_conc. Always add concentrate to water, not water to concentrate, unless the supplier says otherwise.',
  source: 'Volume mass balance (BenchMate derivation, checked in tests); add concentrate to water: Fastenal Tool Talk. See docs/shop-helpers.md.',
},
{
  id: 'fraction', level: 'simple', group: 'Shop helpers', title: 'Fraction, decimal and mm',
  desc: 'Convert fractions, decimal inches and millimetres; nearest fraction (to 1/64 or another denominator) and the error.',
  render: el => renderFraction(el),
  working: '1 in = 25.4 mm exactly. Nearest fraction: numerator = round(value x denominator), then reduced by the greatest common divisor. Error = value - fraction.',
  source: 'NIST SP 811, appendix B: inch = 0.0254 m exactly (1959 definition). See docs/shop-helpers.md.',
},
{
  id: 'symbols', level: 'advanced', group: 'Shop helpers', title: 'SI prefixes, constants and Greek letters',
  desc: 'The 24 SI prefixes from quecto to quetta, the seven constants that define the SI, and the Greek alphabet with what each letter stands for in BenchMate\'s formulas.',
  render: el => renderSymbols(el),
  working: 'No calculation: the values are shown as the publishers print them.',
  source: 'BIPM, SI prefixes and SI defining constants; NIST, Metric (SI) prefixes and SP 330 Table 1; University of Warwick and The Engineering ToolBox (Greek alphabet). See docs/sources.md, Units and symbols.',
},
{
  id: 'units', level: 'simple', group: 'Shop helpers', title: 'Unit converter',
  desc: 'Length, area, volume, mass, force, torque, pressure and stress, power, energy, speed, feed rate, feed per rev, temperature, temperature difference, density, flow, angle, acceleration, rotational speed and viscosity (dynamic and kinematic). Every unit of the quantity at once. Angles also convert to and from degrees-minutes-seconds, % slope, slope 1 in n, taper per foot, taper ratio 1:x and rate of taper.',
  render: el => renderUnits(el),
  working: 'value_SI = (value + offset) x factor; then divided by the target factor. Offsets only for temperature (°C +273.15, °F +459.67 then x 5/9). Angle forms: % slope = 100 tan a, 1 in n = 1 / tan a (a from the horizontal); taper C = 2 tan(a/2) = 1 : x, taper per foot = 12 C (a the included angle).',
  source: 'NIST SP 811 (2008), Appendix B.8 and B.9: exact definitions (bold factors) and printed values checked in tests. Slope: Wikipedia "Grade (slope)". Taper: ISO/R 1119 (public preview), Omni Calculator taper. See docs/sources.md.',
},
{
  id: 'calc', level: 'simple', group: 'Shop helpers', title: 'Calculator',
  desc: 'Type an expression with brackets, powers, trig (degrees or radians, with secant, cosecant, cotangent, versed sine and exsecant), roots, logs and factorials. Also degrees-minutes-seconds, prime factors and linear interpolation.',
  render: el => renderCalc(el),
  working: "BenchMate's own recursive-descent parser in the Rust core (no eval): + - * / % ^ ! and functions. Powers bind right to left and above unary minus. Involute inv a = tan a - a; versed sine versin a = 1 - cos a; coversed sine 1 - sin a; exsecant sec a - 1.",
  source: 'Operator precedence as in common mathematical convention; functions from the Rust standard library (IEEE 754 double precision). See docs/sources.md.',
},
{
  id: 'economics', level: 'advanced', group: 'Shop helpers', title: 'Shop economics',
  desc: 'Machine hourly rate from price, resale, life, interest and running costs; break-even quantity for a job; simple and discounted payback and net present value. All inputs are yours.',
  render: el => renderEconomics(el),
  working: 'CRF = i(1+i)^n / ((1+i)^n - 1); capital per year = (P - S) CRF + S i. Break-even = fixed / (price - variable). Payback = I / A; discounted n = -ln(1 - I i / A) / ln(1 + i); NPV = A (1 - (1+i)^-n) / i + S (1+i)^-n - I.',
  source: "Engineering economy interest formulas (Machinery's Handbook 'engineering economics', by name); see docs/sources.md.",
},
{
  id: 'machines', level: 'simple', group: 'Setup', title: 'Machine profiles',
  desc: 'Add your machines once. The active machine (top bar) is used to check every result: spindle speed range, power (with the torque curve at low speed), live tool speed and max feed.',
  render: el => renderMachines(el),
  working: 'Power available at speed n: P(n) = min(P_max, T_max x 2 pi n / 60 000). Constant torque below base speed, constant power above it.',
  source: 'Standard spindle power/torque characteristic [SAN]. Machine limits come from the builder\'s spec sheet or manual.',
},
{
  id: 'toollib', level: 'simple', group: 'Setup', title: 'Tool library',
  desc: 'Save your end mills, drills, taps, reamers and inserts once: type, diameter, flutes, flute length, overall length, stick-out, corner radius, material and coating, maker and part number. Then fill them into the speed, feed, cut, deflection, helix, drill point, tap drill and finish calculators. Saved in this browser; export and import as a JSON file.',
  render: el => renderToolLibrary(el),
  working: "Nothing is calculated here. Each tool keeps the units it was entered in; when it is filled into a calculator set to the other units, lengths are converted with 1 in = 25.4 mm (exact). A tap's pitch is mm for a metric tool and TPI for an inch tool. Import adds new tools and skips tools that are already in the library; it never overwrites one. Only a tool marked Solid carbide sets the carbide E preset in the deflection screens; other materials leave E as it is.",
  source: 'BenchMate design. Inch definition: NIST SP 811, appendix B.',
},
{
  id: 'setupsheet', level: 'advanced', group: 'Setup', title: 'Setup sheet',
  desc: 'A printable setup sheet: job, machine, tool list with stick-out and offsets, work offsets and notes. Saved in this browser; export and import as JSON.',
  render: el => renderSetupSheet(el),
  working: 'Nothing is calculated here. Sheets are kept in this browser (localStorage) and can be moved by exporting a JSON file. Print uses a print layout without the app frame.',
  source: 'BenchMate layout.',
},
{
  id: 'sinebar', level: 'simple', group: 'Setup', title: 'Sine bar and gauge-block stack',
  desc: 'Gauge-block height for a sine bar angle (or the angle from a stack) and the stack with the fewest blocks from a standard or your own block set.',
  render: el => renderSineBar(el),
  working: 'H = L sin(angle); angle = asin(H / L), L the centre distance of the rolls. Stack: an exact search for the fewest blocks (each block used once) that add up to the size, in steps of the set\'s finest block (0.0005 mm or 0.00005 in).',
  source: 'Set compositions as printed by Mitutoyo (via Cutwel and Transcat), Starrett and Insize; see docs/geometry.md. Sine relation: right-triangle trigonometry.',
},
{
  id: 'indexing', level: 'advanced', group: 'Setup', title: 'Dividing head and rotary table indexing',
  desc: 'Simple, angular and differential indexing with your own index plate hole circles and change gears.',
  render: el => renderIndexing(el),
  working: 'Simple: crank turns per division = ratio / N (ratio 40 on most dividing heads); the fraction must come out exactly on a hole circle. Angle: turns = ratio x angle / 360°. Differential: index as if for a nearby A\' that the plates can do, and gear the plate to the spindle with ratio x (A\' - N) / A\'; idlers: with A\' above N use 1 or 3 in a simple train, below N none or 2; a compound train reverses this.',
  source: 'US Navy Machinery Repairman training manual, ch. 7 Indexing (differential indexing ratio and idlers; public domain). Plates and gears are never defaulted: enter your own. See docs/geometry.md.',
},
{
  id: 'materials', level: 'simple', group: 'Materials', title: 'Material equivalents',
  desc: 'Find comparable grades for steels, aluminium, copper alloys, titanium, nickel alloys and cast irons across US, European, UK, Japanese and Chinese systems. Every value shows how many independent publishers print it, and you can see exactly what each source says. Click a grade for its material card: composition chart, machinability rings and properties.',
  render: el => renderMaterials(el),
  working: 'Equivalents are comparable grades, not identical: chemistry and properties differ between standards. Check the actual standard or mill certificate before substituting.',
  source: 'Listed under the table and in docs/sources.md. Confirmed = two or more independent publishers agree on the key designation and none disagree with equal support.',
},
{
  id: 'tempercolours', level: 'advanced', group: 'Materials', title: 'Temper and heat-tint colours',
  desc: 'Oxide colours of plain carbon steel against temperature, and the heat-tint colours of stainless steel, with each publisher\'s temperature. Colours are approximate and depend on time.',
  render: el => renderTemperColours(el),
  working: 'No calculation: colours and temperatures as printed; °C and °F by the unit converter. Confirmed = two independent publishers within 10 °C.',
  source: 'US Navy AM training manual, West Yorkshire Steel, Wikipedia (Kraemer 1983; BSSA chart), Heat Treat Today. See docs/materials-reference.md.',
},
{
  id: 'heattreat', level: 'advanced', group: 'Materials', title: 'Heat treatment reference',
  desc: 'Heat treatment terms in plain words, and annealing, hardening, quench and tempering temperatures for 1045, 4140, 4340, O1, A2, D2, S7, H13, M2, 416, 420, 440C and 17-4PH H900 to H1150, side by side from the steel makers.',
  render: el => renderHeatTreat(el),
  working: 'No calculation: temperatures as printed by each publisher, °F and °C by the unit converter. Confirmed = two independent publishers print the same range within 3 °C. Follow the data sheet of your steel.',
  source: 'Uddeholm, Doerrenberg, Lucefin, Hudson Tool Steel, GMH Gruppe, Atlas Steels, Aalco, ATI data sheets. See docs/materials-reference.md.',
},
{
  id: 'galvanic', level: 'advanced', group: 'Materials', title: 'Galvanic series and two-metal check',
  desc: 'The galvanic series in seawater and an anodic index table: pick two metals to see the potential difference, which one corrodes and whether the pair passes the common rule of thumb.',
  render: el => renderGalvanic(el),
  working: 'ΔE = |E_A − E_B| (Rust core). Seawater: the more negative metal is the anode; limit 0.20 V (Gerr). Anodic index: the larger index is the anode; limits 0.15 V harsh, 0.25 V normal, 0.50 V controlled (Engineers Edge, Carr Lane).',
  source: 'D. Gerr, Controlling Galvanic Corrosion; Wikipedia, Galvanic series (MIL-STD-889C order); Engineers Edge; Carr Lane. See docs/materials-reference.md.',
},
{
  id: 'plastics', level: 'advanced', group: 'Materials', title: 'Machining plastics',
  desc: 'Acetal, nylon 6 and 66, PEEK, UHMW-PE, PTFE, PC, acrylic, PVC, PP, ABS and PEI: maximum service temperature, expansion, annealing and each maker\'s starting turning data side by side, with practical notes.',
  render: el => renderPlastics(el),
  working: 'No calculation: values as printed, converted between ft/min, in/rev, °F and metric units. Makers\' cutting data differ; start low and test on scrap.',
  source: 'Mitsubishi Chemical Advanced Materials, Ensinger, Boedeker Plastics, W.S. Hampshire, Professional Plastics; density and expansion from the material data. See docs/materials-reference.md.',
},
{
  id: 'metalid', level: 'advanced', group: 'Materials', title: 'Metal identification',
  desc: 'Spark, magnet, chip and file tests to sort an unknown bar into a family of metals, in plain words.',
  render: el => renderMetalId(el),
  working: 'No calculation. These tests sort metals into families only; a mill certificate or PMI analysis identifies a grade.',
  source: 'US Navy Steelworker training manual (spark, chip and magnetic tests). See docs/materials-reference.md.',
},
{
  id: 'boltgrade', level: 'advanced', group: 'Fasteners', title: 'Bolt grades and property classes',
  desc: 'ISO 898-1 property classes 4.6 to 12.9, SAE J429 grades 2, 5 and 8 and ASTM A574 socket head cap screws: proof, yield and tensile minimums with the publishers that print them, and how to read the head marks.',
  render: el => renderBoltGrades(el),
  working: 'No calculation: minimum values as printed, with the number of independent publishers that agree. Inch mode shows MPa values in ksi (1 ksi = 6.894757 MPa).',
  source: 'ISO 898-1:2013 and SAE J429, ASTM A574 (by name only); Optimas, Westfield Fasteners, Mutual Screw, Bossard, MSC, AFT Fasteners. See docs/sources.md.',
},
{
  id: 'bolttorque', level: 'simple', group: 'Fasteners', title: 'Bolt torque and preload',
  desc: 'Tightening torque from preload with the VDI 2230 relation, preload from yield utilisation or percent of proof load. Thread and head friction are yours to enter; BenchMate shows the cited typical ranges but never fills them in.',
  render: el => renderBoltTorque(el),
  working: 'MA = F (0.16 P + 0.58 d2 muG + DKm/2 muK); FM = As nu Rp0.2 / sqrt(1 + 3 [3/2 d2/d0 (P/(pi d2) + 1.155 muG)]^2). See the note under the tool.',
  source: 'VDI 2230 Part 1:2015 (R7, R13), by name only; formula also printed by FVA and by Hameedi and Völgyi (2025); friction classes from Bossard. See docs/sources.md.',
},
{
  id: 'shcs', level: 'simple', group: 'Fasteners', title: 'Socket head cap screws',
  desc: 'Head diameter, head height and hex key of metric (ISO 4762) and inch (ASME B18.3) socket head cap screws, with clearance holes and counterbores.',
  render: el => renderShcs(el),
  working: 'No calculation: values as printed, each with its publisher count. Counterbores are maker recommendations and differ between publishers; both are shown.',
  source: 'ISO 4762:2004, ASME B18.3 (by name only); MSC, MISUMI, AFT Fasteners, American Fastener, NBK, TR Fastenings, Optimas, Fractory.',
},
{
  id: 'clearance', level: 'simple', group: 'Fasteners', title: 'Clearance holes',
  desc: 'Clearance holes for bolts and screws: ISO 273 fine, medium and coarse (M1.6 to M48) and inch close, normal and free fits, with every publisher disagreement shown.',
  render: el => renderClearance(el),
  working: 'No calculation: values as printed. Inch drill names are converted with the drill chart.',
  source: 'ISO 273:1979, ASME B18.2.8 (by name only); NBK (JIS B 1001), TR Fastenings, Optimas, Fractory, MSC.',
},
{
  id: 'spanner', level: 'simple', group: 'Fasteners', title: 'Spanner and hex key sizes',
  desc: 'Width across flats for metric (ISO 272, old DIN, JIS) and inch hex heads, and the hex key for socket head cap screws. Type a spanner size to see which threads it fits.',
  render: el => renderSpanner(el),
  working: 'No calculation: values as printed. The lookup matches within 0.05 mm or 0.001 in.',
  source: 'ISO 272:1982, ASME B18.2.1, ASME B18.3 (by name only); Wikipedia, Accu, SLS Bearings and the socket screw publishers.',
},
{
  id: 'tslots', level: 'advanced', group: 'Fasteners', title: 'T-slots',
  desc: 'T-slot dimensions for machine tool tables (ISO 299 / DIN 650): head space width and height, total depth, bolt size and slot pitch, with a section drawing.',
  render: el => renderTslots(el),
  working: 'No calculation: values as printed (min to max).',
  source: 'ISO 299:1987, DIN 650 (by name only); Engineers Edge (ASME B5.1M mm columns), iTeh preview of ISO 299.',
},
{
  id: 'spring', level: 'advanced', group: 'Machine elements', title: 'Compression spring: rate, load and stress',
  desc: 'A helical compression spring of round wire from what you can measure: wire diameter, outside diameter, coils and the kind of ends. Gives the spring rate, the solid length, the pitch, and the load and shear stress at a length or for a load, with the spring drawn to scale.',
  fields: s => [
    { id: 'd', label: 'Wire diameter d', unit: lenU(s), def: s === 'inch' ? 0.08 : 2 },
    { id: 'od', label: 'Outside diameter of the coil', unit: lenU(s), def: s === 'inch' ? 0.625 : 16 },
    { id: 'na', label: 'Active coils Na', unit: '', def: s === 'inch' ? 22 : 10 },
    { id: 'end', label: 'Ends', unit: '', def: 3, options: [[0, 'Plain (open)'], [1, 'Plain and ground'], [2, 'Closed (squared)'], [3, 'Closed and ground']] },
    { id: 'mat', label: 'Material', unit: '', def: 1, options: [[1, 'Carbon and alloy spring steel (music wire, hard drawn, oil tempered, CrV, CrSi)'], [2, 'Stainless steel 302, 304, 316'], [3, 'Stainless steel 17-7 PH'], [4, 'Phosphor bronze (one maker)'], [5, 'Beryllium copper (one maker)'], [0, 'Own modulus of rigidity']] },
    { id: 'g', label: 'Modulus of rigidity G', unit: s === 'inch' ? 'psi' : 'MPa', def: '', when: v => v.mat === 0 },
    { id: 'lf', label: 'Free length (optional)', unit: lenU(s), def: s === 'inch' ? 4 : '' },
    { id: 'f', label: 'Load (optional)', unit: s === 'inch' ? 'lbf' : 'N', def: '' },
    { id: 'lw', label: 'Length under load (optional, needs the free length)', unit: lenU(s), def: '' },
  ],
  calc: (v, W, s) => {
    if (!(v.d > 0 && v.od > 0 && v.na > 0)) return [];
    const inch = s === 'inch', u = lenU(s), dp = inch ? 3 : 2, fu = inch ? 'lbf' : 'N', ku = inch ? 'lbf/in' : 'N/mm', su = inch ? 'psi' : 'MPa';
    const D = W.spring_mean_dia(v.od, v.d);
    if (!isFinite(D)) return [R('Outside diameter', 'must be more than twice the wire diameter', '', 0)];
    // Modulus: the core holds the makers' figures in psi; MPa is a unit conversion.
    const G = v.mat === 0 ? v.g : (inch ? W.spring_g_psi(v.mat) : W.unit_convert(6, 6, 2, W.spring_g_psi(v.mat)));
    const C = W.spring_index(D, v.d), E = k => W.spring_ends(v.end, v.na, v.d, v.lf, k), Ls = E(1);
    const rows = [], ok = G > 0, St = (x, k) => W.spring_state(v.d, D, v.na, G, v.end, v.lf, x, k);
    rows.push(ok ? R('Spring rate k', W.spring_rate(v.d, D, v.na, G), ku, inch ? 2 : 3) : R('Spring rate k', 'enter the modulus of rigidity', '', 0));
    rows.push(R('Mean diameter D', D, u, dp), R('Spring index C = D / d', C, '', 2), R('Stress factor (Wahl) Kw', W.spring_wahl(C), '', 3));
    if (v.mat !== 0) rows.push(R('Modulus of rigidity G used', G, su, 0));
    rows.push(R('Total coils', E(0), '', 1), R('Solid length', Ls, u, dp));
    const at = (name, F) => { rows.push(R('Load ' + name, F, fu, inch ? 2 : 1), R('Shear stress ' + name + ' (with Kw)', W.spring_stress(F, D, v.d), su, 0)); };
    const free = v.lf > Ls;
    if (v.lf > 0) {
      if (!free) rows.push(R('Free length', 'is not longer than the solid length: check the coils and the ends', '', 0));
      else {
        rows.push(R('Pitch of the coils', E(2), u, dp), R('Travel from free to solid', St(0, 0), u, dp));
        if (ok) at('at solid', St(0, 1));
      }
    }
    if (v.f > 0 && ok) {
      rows.push(R('Deflection for the load', St(v.f, 2), u, dp));
      if (free) rows.push(isFinite(St(v.f, 3)) ? R('Length under the load', St(v.f, 3), u, dp) : R('Length under the load', 'the spring goes solid before it carries this load', '', 0));
      rows.push(R('Shear stress at the load (with Kw)', W.spring_stress(v.f, D, v.d), su, 0));
    }
    if (v.lw > 0 && free && ok) {
      if (v.lw >= v.lf) rows.push(R('Length under load', 'is not shorter than the free length', '', 0));
      else if (!isFinite(St(v.lw, 4))) rows.push(R('Length under load', 'is shorter than the solid length', '', 0));
      else at('at the length under load', St(v.lw, 4));
    }
    if (C < 3 || C > 12) rows.push(R('Note', 'Spring index ' + (C < 3 ? 'below 3' : 'above 12') + ': one source gives 3 to 12 as the range of most helical springs. ' + (C < 3 ? 'A tight coil is hard to wind and highly stressed on the inside.' : 'A loose coil tangles and buckles easily.'), '', 0));
    return rows;
  },
  working: 'Mean diameter D = outside diameter − d. Spring index C = D / d. Rate k = G d⁴ / (8 D³ Na). Load F = k × deflection. Shear stress τ = Kw × 8 F D / (π d³), with the Wahl factor Kw = (4C − 1) / (4C − 4) + 0.615 / C for the curvature of the wire and the direct shear. ' +
    'Total coils and solid length by the ends: plain Na and d (Nt + 1); plain and ground Na + 1 and d Nt; closed Na + 2 and d (Nt + 1); closed and ground Na + 2 and d Nt. Pitch from the free length Lf: plain (Lf − d) / Na; plain and ground Lf / (Na + 1); closed (Lf − 3d) / Na; closed and ground (Lf − 2d) / Na (one source for the pitch). ' +
    'Modulus of rigidity as two spring makers print it: carbon and alloy spring steels 11.5 × 10⁶ psi, stainless 302, 304 and 316 10 × 10⁶ psi, 17-7 PH 11 × 10⁶ psi; phosphor bronze 6.25 and beryllium copper 7 × 10⁶ psi from one maker. The allowable stress is not given here: it depends on the wire size, the material and whether the load is steady or repeated, so compare the stress with the wire maker\'s figures. Buckling and surge are not checked.',
  source: 'AMES (amesweb.info), Compression spring formulas; MechRef (University of Illinois), Springs; RoyMech, Helical springs (rate, Wahl factor, coils and solid length by end type). Modulus of rigidity: Lee Spring and Acxess Spring. See docs/sources.md, Springs.',
  proof: [{ name: 'Music wire spring, 0.080 in wire, 0.625 in outside, 22 active coils, closed and ground, 4 in free, 7 lbf', sys: 'inch', vals: { d: 0.08, od: 0.625, na: 22, end: 3, mat: 0, g: 11750000, lf: 4, f: 7 },
    expect: [['Spring rate k', 'lbf/in', 16.89, 0.005], ['Spring index C = D / d', '', 6.81, 0.005], ['Stress factor (Wahl) Kw', '', 1.22, 0.005], ['Solid length', 'in', 1.92, 0.0005], ['Travel from free to solid', 'in', 2.08, 0.0005], ['Shear stress at the load (with Kw)', 'psi', 23140, 6]],
    source: 'AMES, Compression spring fatigue design example: k 16.89 lbf/in, C 6.81, Kw 1.22, solid height 1.92, maximum deflection 2.08, stress amplitude 23.14 ksi for loads of 22 and 8 lbf (an amplitude of 7 lbf).', note: 'The page does not print its shear modulus; 11.75 × 10⁶ psi reproduces its rate, where the two spring makers print 11.5 × 10⁶ psi for music wire.' }],
},
{
  id: 'beltdrive', level: 'advanced', group: 'Machine elements', title: 'Belt drive: length, ratio and wrap',
  desc: 'An open belt round two pulleys: the belt length for a centre distance, or the centre distance a belt of a known length gives, with the speed ratio, the driven speed, the belt speed and the angle of wrap on each pulley, drawn to scale.',
  fields: s => [
    { id: 'd1', label: 'Driving pulley diameter', unit: lenU(s), def: s === 'inch' ? 6 : 150 },
    { id: 'd2', label: 'Driven pulley diameter', unit: lenU(s), def: s === 'inch' ? 20 : 300 },
    { id: 'find', label: 'Find', unit: '', def: 0, options: [[0, 'Belt length from the centre distance'], [1, 'Centre distance from the belt length']] },
    { id: 'c', label: 'Centre distance', unit: lenU(s), def: s === 'inch' ? 56 : 1500, when: v => v.find === 0 },
    { id: 'len', label: 'Belt length', unit: lenU(s), def: s === 'inch' ? 153.72 : 3710, when: v => v.find === 1 },
    { id: 'n', label: 'Driving speed (optional)', unit: 'RPM', def: '' },
  ],
  calc: (v, W, s) => {
    if (!(v.d1 > 0 && v.d2 > 0)) return [];
    const inch = s === 'inch', u = lenU(s), dp = inch ? 2 : 1, rows = [];
    let c = v.c;
    if (v.find === 1) {
      if (!(v.len > 0)) return [];
      c = W.belt_centre(v.d1, v.d2, v.len);
      if (!isFinite(c)) return [R('Belt length', 'is too short to go round both pulleys with a gap between them', '', 0)];
      rows.push(R('Centre distance', c, u, dp));
    } else {
      if (!(c > 0)) return [];
      const L = W.belt_length(v.d1, v.d2, c);
      if (!isFinite(L)) return [R('Centre distance', 'the pulleys would touch: it must be more than half the sum of the diameters', '', 0)];
      rows.push(R('Belt length', L, u, dp), R('By the short formula', W.belt_length_approx(v.d1, v.d2, c), u, dp));
    }
    const small = W.belt_wrap_deg(v.d1, v.d2, c, 0);
    rows.push(R('Speed ratio (driving speed / driven speed)', W.drive_driven_rpm(1, v.d2, v.d1), ': 1', 3),
      R('Wrap on the small pulley', small, '°', 1), R('Wrap on the large pulley', W.belt_wrap_deg(v.d1, v.d2, c, 1), '°', 1));
    if (v.n > 0) {
      rows.push(R('Driven speed', W.drive_driven_rpm(v.n, v.d1, v.d2), 'RPM', 0));
      // Belt speed is the surface speed of the driving pulley: the same core function as cutting speed.
      rows.push(inch ? R('Belt speed', W.sfm_from_rpm(v.n, v.d1), 'ft/min', 0) : R('Belt speed', W.unit_convert(9, 1, 0, W.vc_from_rpm(v.n, v.d1)), 'm/s', 1));
    }
    if (v.d1 !== v.d2) rows.push(R('Note', 'Use the pitch (datum) diameters of V-belt and timing pulleys and the pitch length of the belt, not the outside sizes. Slip and belt thickness are not included.', '', 0));
    return rows;
  },
  working: 'Belt length, exact: L = (D + d) π/2 + (D − d) asin((D − d) / 2C) + 2 √(C² − (D − d)² / 4), with D the large and d the small pulley diameter and C the centre distance. Short formula: L ≈ 2C + π/2 (D + d) + (D − d)² / (4C). ' +
    'Wrap on the small pulley = 180° − 2 asin((D − d) / 2C); the large pulley has the rest of the full turn. Centre distance from a belt length: the exact length formula solved for C. Speed ratio = driven diameter / driving diameter; driven speed = driving speed × driving diameter / driven diameter; belt speed = π × driving diameter × speed.',
  source: 'tec-science, Calculation of the belt length for belt drives (exact and short formulas, wrap angle); Omni Calculator, Belt length (the same two formulas, worked examples). See docs/sources.md, Belts and chains.',
  proof: [{ name: 'Pulleys of 300 and 150 mm, 1500 mm apart', sys: 'mm', vals: { d1: 150, d2: 300, find: 0, c: 1500 }, expect: [['Belt length', 'mm', 3710, 5]],
    source: 'Omni Calculator, Belt length: pulleys of 30 cm and 15 cm, 1.5 m apart, belt length 3.71 m.' },
  { name: 'Pulleys of 6 and 20 in, 56 in apart, by the short formula', sys: 'inch', vals: { d1: 6, d2: 20, find: 0, c: 56 }, expect: [['By the short formula', 'in', 153.72, 0.005]],
    source: 'Omni Calculator, Belt length: 6 and 20 in pulleys, 56 in apart, 153.72 in by the approximate formula.' }],
},
{
  id: 'chaindrive', level: 'advanced', group: 'Machine elements', title: 'Roller chain drive: length and sprockets',
  desc: 'A roller chain round two sprockets: the chain length in pitches for a centre distance, rounded up to an even number of pitches, the centre distance that length then needs, the sprocket pitch diameters, the ratio and the wrap on the small sprocket.',
  fields: s => [
    { id: 'no', label: 'Chain', unit: '', def: 40, options: [[25, 'No. 25 (1/4 in pitch)'], [35, 'No. 35 (3/8 in)'], [40, 'No. 40 (1/2 in)'], [41, 'No. 41 (1/2 in, light)'], [50, 'No. 50 (5/8 in)'], [60, 'No. 60 (3/4 in)'], [80, 'No. 80 (1 in)'], [100, 'No. 100 (1 1/4 in)'], [120, 'No. 120 (1 1/2 in)'], [140, 'No. 140 (1 3/4 in)'], [160, 'No. 160 (2 in)'], [180, 'No. 180 (2 1/4 in)'], [200, 'No. 200 (2 1/2 in)'], [240, 'No. 240 (3 in)'], [0, 'Own pitch']] },
    { id: 'p', label: 'Chain pitch', unit: lenU(s), def: s === 'inch' ? 0.5 : 12.7, when: v => v.no === 0 },
    { id: 'n1', label: 'Teeth on the driving sprocket', unit: '', def: 17 },
    { id: 'n2', label: 'Teeth on the driven sprocket', unit: '', def: 51 },
    { id: 'c', label: 'Centre distance wanted', unit: lenU(s), def: s === 'inch' ? 20 : 500 },
    { id: 'n', label: 'Driving speed (optional)', unit: 'RPM', def: '' },
  ],
  calc: (v, W, s) => {
    if (!(v.n1 >= 3 && v.n2 >= 3 && v.c > 0)) return [];
    const inch = s === 'inch', u = lenU(s), dp = inch ? 3 : 2;
    // Chain pitch: the core gives inches from the chain number; mm is a unit conversion. Lengths in pitches are the length divided by the pitch.
    const p = v.no === 0 ? v.p : (inch ? W.chain_pitch_in(v.no) : W.unit_convert(0, 5, 1, W.chain_pitch_in(v.no)));
    if (!(p > 0)) return [];
    const cp = v.c / p, L = W.chain_length_pitches(v.n1, v.n2, cp), Le = W.chain_even_links(L), ce = W.chain_centre_pitches(v.n1, v.n2, Le);
    const d1 = W.sprocket_pitch_dia(p, v.n1), d2 = W.sprocket_pitch_dia(p, v.n2), rows = [];
    if (!(v.c > (d1 + d2) / 2)) return [R('Centre distance', 'the sprockets would touch: it must be more than half the sum of the pitch diameters, ' + fmt((d1 + d2) / 2, dp) + ' ' + u, '', 0)];
    rows.push(R('Chain length, even number of pitches', Le, 'pitches', 0), R('Chain length as calculated', L, 'pitches', 2), R('Chain pitch', p, u, inch ? 3 : 3),
      R('Centre distance for the even length', ce * p, u, dp), R('Centre distance wanted, in pitches', cp, 'pitches', 1),
      R('Pitch diameter, driving sprocket', d1, u, dp), R('Pitch diameter, driven sprocket', d2, u, dp),
      R('Speed ratio (driving speed / driven speed)', W.drive_driven_rpm(1, v.n2, v.n1), ': 1', 3));
    const wrap = W.belt_wrap_deg(d1, d2, ce * p, 0);
    rows.push(R('Wrap on the small sprocket', wrap, '°', 1));
    if (v.n > 0) rows.push(R('Driven speed', W.drive_driven_rpm(v.n, v.n1, v.n2), 'RPM', 0));
    const notes = [];
    if (cp < 30 || cp > 50) notes.push('The centre distance is ' + fmt(cp, 1) + ' pitches: two sources recommend 30 to 50 pitches for ordinary drives' + (cp >= 80 ? ', and guides or an idler at 80 pitches or more' : '') + '.');
    if (wrap < 120) notes.push('The wrap on the small sprocket is under 120°: two sources ask for at least 120° so that enough teeth share the load.');
    if (Math.min(v.n1, v.n2) < 15) notes.push('One chain maker suggests more than 15 teeth on the small sprocket.');
    if (notes.length) rows.push(R('Note', notes.join(' '), '', 0));
    return rows;
  },
  working: 'Chain pitch from the ANSI chain number: the digits before the last are eighths of an inch (No. 40 = 4/8 in, No. 100 = 10/8 in); the last digit is 0 for standard chain, 1 for light chain, 5 for bushed chain without rollers. Chain length in pitches: L = 2C + (N1 + N2)/2 + (N2 − N1)² / (4π² C), with C the centre distance in pitches. ' +
    'The length is rounded up to an even number of pitches, because an odd number needs an offset link. Centre distance for a length: C = 1/8 [2L − (N1 + N2) + √((2L − (N1 + N2))² − (8/π²)(N2 − N1)²)] pitches. Sprocket pitch diameter = pitch / sin(180° / N). Wrap on the small sprocket = 180° − 2 asin((D2 − D1) / 2C), the geometry of a belt on the pitch circles. Chain sag, wear elongation and the load rating are not covered.',
  source: 'Martin Sprocket & Gear, Sprocket engineering data (chain length with the constant 0.1013, pitch diameter, pitches by chain number, 30 to 50 pitches, 120° wrap); U.S. Tsubaki, RS chain drive selection (length and centre distance, small sprocket teeth); a summary of Mott, Machine Elements in Mechanical Design (the same formulas, even number of pitches); Wikipedia, Roller chain (the chain number rule). See docs/sources.md, Belts and chains.',
},
{
  id: 'taperpin', level: 'advanced', group: 'Machine elements', title: 'Taper pins (inch series)',
  desc: 'Standard inch taper pins No. 7/0 to No. 14 (taper 1/4 in per foot): large end diameter with its limits, and the small end diameter for the length of pin, which is the size of the hole before reaming.',
  fields: s => [
    { id: 'no', label: 'Pin number', unit: '', def: 4, options: [[-6, '7/0'], [-5, '6/0'], [-4, '5/0'], [-3, '4/0'], [-2, '3/0'], [-1, '2/0'], [0, '0'], [1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5'], [6, '6'], [7, '7'], [8, '8'], [9, '9'], [10, '10'], [11, '11'], [12, '12'], [13, '13'], [14, '14']] },
    { id: 'l', label: 'Length of the pin', unit: lenU(s), def: s === 'inch' ? 2 : 50 },
  ],
  calc: (v, W, s) => {
    const inch = s === 'inch', u = lenU(s), dp = inch ? 4 : 3, k = inch ? 1 : 25.4;   // the table is in inches; mm is a unit conversion
    const D = i => W.taper_pin_dia_in(v.no, i) * k;
    if (!isFinite(D(0))) return [];
    const rows = [];
    if (v.l > 0) {
      const sm = W.taper_pin_small(D(0), v.l, 0.25);
      rows.push(isFinite(sm) ? R('Small end diameter at this length', sm, u, dp) : R('Small end diameter', 'the pin is too long for this size: it would taper to nothing', '', 0));
    }
    rows.push(R('Large end diameter (basic)', D(0), u, dp), R('Large end, commercial class, largest', D(1), u, dp), R('Large end, commercial class, smallest', D(2), u, dp));
    if (isFinite(D(3))) rows.push(R('Large end, precision class, largest', D(3), u, dp), R('Large end, precision class, smallest', D(4), u, dp));
    else rows.push(R('Precision class', 'listed up to No. 10 only', '', 0));
    rows.push(R('Taper on the diameter', 0.25, 'in/ft', 3), R('Included angle', W.taper_included_angle_deg(0.25, 0, 12), 'deg', 4));
    if (!inch) rows.push(R('Note', 'This is the inch series shown in mm. Metric taper pins (ISO 2339, taper 1:50) are a different series and are not included.', '', 0));
    return rows;
  },
  working: 'Small end = large end − length × 0.25 / 12 (0.02083 per unit of length). Commercial class: +0.0013 / −0.0007 in on the large end; precision class: +0.0010 / −0 in, up to No. 10. Included angle = 2 atan(0.25 / 24).',
  source: 'Large end diameters, limits and the small end rule: a supplier\'s cut sheet of ASME B18.8.2-2000 (hbbolt.com), the only full table found, so the sizes rest on one publisher; two other suppliers print the same large end for No. 7/0, 7, 9 and 14. See docs/sources.md, Pins.',
  proof: [{ name: 'No. 3/0 taper pin, 1 in long', sys: 'inch', vals: { no: -2, l: 1 },
    expect: [['Small end diameter at this length', 'in', 0.1042, 0.00005], ['Large end diameter (basic)', 'in', 0.125, 0.00005]],
    source: 'Albany County Fasteners, pin size chart: No. 3/0 taper pin, large end 0.1250 in, small end at 1 in of length 0.1042 in.', note: 'Only the rows of that chart that match the standard\'s cut sheet are used; its sizes from 2/0 up do not.' }],
},
{
  id: 'keys', level: 'advanced', group: 'Machine elements', title: 'Keys and keyways',
  desc: 'Parallel key size, shaft and hub keyway depths and check dimensions from the shaft diameter: metric (DIN 6885-1 / ISO 773) and inch (ASME B17.1).',
  render: el => renderKeys(el),
  working: 'Metric: d - t1 and d + t2. Inch: Y = (D - sqrt(D^2 - W^2))/2, shaft D - Y - H/2, hub D - Y + H/2. See the note under the tool.',
  source: 'DIN 6885-1, ISO 773, JIS B 1301, ASME B17.1 (by name only); fasten.it, AIMS Industrial, MISUMI, Engineers Edge, AMES.',
},
{
  id: 'oring', level: 'advanced', group: 'Machine elements', title: 'O-ring glands',
  desc: 'AS568 O-ring sizes and a gland check for piston, rod and face seals: gland depth, squeeze, stretch and gland fill against two seal makers\' guidance, and a groove suggested from your own targets.',
  render: el => renderOring(el),
  working: 'Squeeze = (CS - depth)/CS; stretch = (seat - ID)/ID; fill = ring volume / groove volume. See the note under the tool.',
  source: 'SAE AS568, ISO 3601-1:2012 (by name only); Parker ORD 5700 (cited); Global O-Ring and Seal, Apple Rubber; sizes from Greene Tweed, eFunda, O-Rings Inc.',
},
{
  id: 'bearinglife', level: 'advanced', group: 'Machine elements', title: 'Bearing rating life (L10)',
  desc: 'Basic rating life of a rolling bearing in revolutions and hours from its dynamic load rating C and the equivalent load P, and the C needed for a life.',
  render: el => renderBearingLife(el),
  working: 'L10 = (C/P)^p, p = 3 ball, 10/3 roller; L10h = 10^6 L10 / (60 n); P = X Fr + Y Fa.',
  source: 'ISO 281:2007 clause 6 (by name only). See docs/sources.md.',
},
{
  id: 'section', level: 'advanced', group: 'Mechanics', title: 'Section properties',
  desc: 'Area, centroid, second moments (Ix, Iy, product and principal), section moduli and radii of gyration of a rectangle, box tube, round bar, tube, I-beam, channel, angle or tee, built up from rectangles (sharp corners).',
  fields: s => mkSecFields(s),
  calc: (v, W, s) => {
    const a = mkSecArgs(v), u = mku(s), q = i => mkSec(W, a, i);
    if (!(q(0) > 0)) return [];
    const rows = [R('Area A', q(0), u.A, u.adp), R('Centroid x (from the left edge)', q(1), u.L, u.dp), R('Centroid y (from the bottom)', q(2), u.L, u.dp),
      R('Ix (about the horizontal centroidal axis)', q(3), u.I, u.idp), R('Iy (about the vertical centroidal axis)', q(4), u.I, u.idp)];
    if (Math.abs(q(5)) > 1e-9 * q(3)) rows.push(R('Product of inertia Ixy', q(5), u.I, u.idp), R('Principal I1 (largest)', q(6), u.I, u.idp), R('Principal I2 (smallest)', q(7), u.I, u.idp), R('Angle of the I1 axis from x', q(8), 'deg', 2));
    rows.push(R('Section modulus Sx, top fibre', q(9), u.Z, u.idp), R('Section modulus Sx, bottom fibre', q(10), u.Z, u.idp),
      R('Section modulus Sy, left fibre', q(11), u.Z, u.idp), R('Section modulus Sy, right fibre', q(12), u.Z, u.idp),
      R('Radius of gyration rx', q(13), u.L, u.dp), R('Radius of gyration ry', q(14), u.L, u.dp), R('Least radius of gyration (for buckling)', q(15), u.L, u.dp));
    if (v.sec === 2 || v.sec === 3) rows.push(R('Polar moment J (torsion)', q(16), u.I, u.idp), R('Torsion section modulus J / (D/2)', q(19), u.Z, u.idp));
    if (v.sec >= 4) rows.push(mkNote('Sharp corners: the root fillets of rolled sections are ignored, so catalogue values differ slightly. Use the maker\'s table for a rolled section.'));
    if (v.sec === 6) rows.push(mkNote('An angle bends about its principal axes: a load parallel to a leg also bends it sideways. Use I2 and the least radius of gyration for buckling.'));
    return rows;
  },
  working: 'Built up from rectangles: A = sum Ai; centroid = sum(Ai ci) / A; I = sum(Ii + Ai d^2) (parallel-axis theorem), rectangle Ii = b h^3 / 12; round I = pi (D^4 - d^4) / 64, J = 2 I. Principal I1,2 = (Ix + Iy)/2 +- sqrt(((Ix - Iy)/2)^2 + Ixy^2), tan 2 theta = -2 Ixy / (Ix - Iy). S = I / c (c = distance from the centroid to the fibre); r = sqrt(I / A). Origin at the lower-left corner of the bounding box; the angle has its corner at the lower left, the channel its web on the left, the tee its flange on top.',
  source: 'Gere and Goodno, Mechanics of Materials, ch. 12 (relations, by name); checked against closed forms and the AISC Manual area of L4x4x1/2. See docs/mechanics.md.',
},
{
  id: 'beam', level: 'advanced', group: 'Mechanics', title: 'Beam deflection and bending stress',
  desc: 'Cantilever, simply supported or fixed-both-ends beam with a point load anywhere and a uniform load over the whole span (either or both): deflection, slope, reactions, shear, bending moment and bending stress, with a drawing.',
  fields: s => {
    const u = mku(s), inch = s === 'inch';
    return [
      { id: 'sup', label: 'Supports', unit: '', def: 1, options: [[1, 'Simply supported (pinned both ends)'], [0, 'Cantilever (fixed at the left)'], [2, 'Fixed both ends']] },
      { id: 'L', label: 'Span L', unit: u.L, def: inch ? 24 : 600 },
      { id: 'P', label: 'Point load P (blank = none)', unit: u.F, def: inch ? 500 : 2000 },
      { id: 'a', label: 'Load position a from the left end (blank = mid-span, cantilever: free end)', unit: u.L, def: '' },
      { id: 'w', label: 'Uniform load w over the span (blank = none)', unit: u.w, def: '' },
      { id: 'E', label: "Young's modulus E", unit: u.E, def: '' },
    ].concat(mkSecFields(s, [[8, 'Enter I and c yourself']]), [
      { id: 'I', label: 'Second moment I about the bending axis', unit: u.I, def: '', when: v => v.sec === 8 },
      { id: 'c', label: 'Distance c from the neutral axis to the outer fibre', unit: u.L, def: '', when: v => v.sec === 8 },
    ]);
  },
  calc: (v, W, s) => {
    const u = mku(s), L = v.L, P = v.P > 0 || v.P < 0 ? v.P : 0, wl = v.w > 0 || v.w < 0 ? v.w : 0, sup = v.sup;
    if (!(L > 0) || !(P || wl)) return [];
    const a = P ? (v.a >= 0 && v.a <= L ? v.a : (sup === 0 ? L : L / 2)) : 0;
    let I, c;
    if (v.sec === 8) { I = v.I; c = v.c; } else { const g = mkSecArgs(v); I = mkSec(W, g, 3); const yc = mkSec(W, g, 2); c = Math.max(yc, mkSec(W, g, 18) - yc); }
    const rows = [];
    if (I > 0) rows.push(R('Second moment I used', I, u.I, u.idp));
    if (!(v.E > 0 && I > 0)) { rows.push(mkNote('Enter E and the section to get deflection and stress. Reactions and moments below do not need them.')); }
    const ei = v.E > 0 && I > 0 ? v.E * u.eK * I : 1, b = i => W.mech_beam(sup, L, a, P, wl, ei, i);
    if (P) rows.push(R('Point load at a', a, u.L, u.dp));
    rows.push(R('Left reaction (force)', b(7), u.F, 1));
    if (sup !== 1) rows.push(R('Left end moment', b(8) * u.mK, u.M, 2));
    if (sup !== 0) rows.push(R('Right reaction (force)', b(9), u.F, 1));
    if (sup === 2) rows.push(R('Right end moment', b(10) * u.mK, u.M, 2));
    rows.push(R('Largest shear force', b(6), u.F, 1), R('Largest bending moment (sagging +, hogging -)', b(4) * u.mK, u.M, 2), R('at x from the left end', b(5), u.L, u.dp));
    if (v.E > 0 && I > 0) {
      const y = Math.abs(b(0));
      rows.push(R('Largest deflection', y, u.L, s === 'inch' ? 5 : 4), R('at x from the left end', b(1), u.L, u.dp), R('Span / deflection', L / y, '', 0),
        R('Largest slope', Math.abs(b(2)) * 180 / Math.PI, 'deg', 4), R('at x from the left end', b(3), u.L, u.dp));
      if (c > 0) rows.push(R('Largest bending stress M c / I', Math.abs(W.mech_bending_stress(b(4), I, c)) / u.sK, u.S, u.sdp));
    }
    rows.push(mkNote('Linear elastic, small deflection, shear deformation ignored (it adds noticeably when the span is under about 10 times the depth). Self-weight only if you include it in w. Supports are taken as ideal: real clamps and fixtures give a little, so a "fixed" end deflects more.'));
    return rows;
  },
  working: 'Sign convention E I y\'\' = -M, deflection positive in the direction of the load. Simply supported, point load at a (b = L - a): y = P b x (L^2 - b^2 - x^2) / (6 E I L) for x <= a; uniform: y = w x (L^3 - 2 L x^2 + x^3) / (24 E I). Cantilever fixed at x = 0: y = P x^2 (3a - x) / (6 E I) for x <= a; uniform: y = w x^2 (6 L^2 - 4 L x + x^2) / (24 E I). Fixed both ends: y = P b^2 x^2 (3 a L - 3 a x - b x) / (6 E I L^3) for x <= a; uniform: y = w x^2 (L - x)^2 / (24 E I). Mirror image beyond the load; both loads add (superposition). Maxima found along the span. Stress = M c / I. Checks: centre load P L^3/48EI, uniform 5wL^4/384EI, cantilever PL^3/3EI and wL^4/8EI, fixed wL^4/384EI and PL^3/192EI.',
  source: "Roark's Formulas for Stress and Strain, Table 8.1, and Gere and Goodno, ch. 9 (relations, by name); maxima checked against American Wood Council Design Aid No. 6, Beam Design Formulas (free). See docs/mechanics.md.",
},
{
  id: 'torsion', level: 'advanced', group: 'Mechanics', title: 'Shaft torsion and power',
  desc: 'Shear stress and angle of twist of a solid or hollow round shaft, torque from power and speed (or power from torque), and the solid diameter for an allowable shear stress.',
  fields: s => {
    const u = mku(s), inch = s === 'inch';
    return [
      { id: 'D', label: 'Outside diameter D', unit: u.L, def: inch ? 1 : 25 },
      { id: 'd', label: 'Bore d (blank = solid)', unit: u.L, def: '' },
      { id: 'L', label: 'Length between the torque points (for twist)', unit: u.L, def: inch ? 12 : 300 },
      { id: 'T', label: 'Torque T', unit: inch ? 'lbf·in' : 'N·m', def: inch ? 1000 : 100 },
      { id: 'P', label: 'Or power transmitted', unit: inch ? 'hp' : 'kW', def: '' },
      { id: 'n', label: 'Speed (for power or torque)', unit: 'rpm', def: '' },
      { id: 'G', label: 'Shear modulus G', unit: u.E, def: '' },
      { id: 'E', label: "Or Young's modulus E", unit: u.E, def: '' },
      { id: 'nu', label: "with Poisson's ratio", unit: '', def: '' },
      { id: 'tau', label: 'Allowable shear stress (for the diameter needed)', unit: u.S, def: '' },
    ];
  },
  calc: (v, W, s) => {
    const u = mku(s), inch = s === 'inch', di = v.d > 0 ? v.d : 0, rows = [];
    // Torque in the core's units: lbf·in (inch) or N·mm (mm).
    let T = v.T, tSrc = 'as entered';
    if (!(T > 0) && v.P > 0 && v.n > 0) { const tnm = W.mech_shaft_torque_nm(v.P * (inch ? MK_HP_W : 1000), v.n); T = inch ? tnm / MK_LBFIN_NM : tnm; tSrc = 'from power and speed'; }
    if (!(T > 0)) return [];
    const Tc = inch ? T : T * 1000, Tnm = inch ? T * MK_LBFIN_NM : T;
    rows.push(R('Torque (' + tSrc + ')', T, inch ? 'lbf·in' : 'N·m', 2));
    if (v.n > 0) { const pw = W.mech_shaft_power_w(Tnm, v.n); rows.push(R('Power at ' + v.n + ' rpm', inch ? pw / MK_HP_W : pw / 1000, inch ? 'hp' : 'kW', 3)); }
    if (v.D > 0 && di < v.D) {
      rows.push(R('Polar moment J', W.mech_polar_moment(v.D, di), u.I, u.idp));
      rows.push(R('Largest shear stress (outside)', W.mech_torsion_stress(Tc, v.D, di, v.D / 2) / u.sK, u.S, u.sdp));
      if (di > 0) rows.push(R('Shear stress at the bore', W.mech_torsion_stress(Tc, v.D, di, di / 2) / u.sK, u.S, u.sdp));
      let G = v.G > 0 ? v.G : (v.E > 0 && v.nu >= 0 && v.nu < 0.5 ? W.mech_shear_modulus(v.E, v.nu) : NaN);
      if (!(v.G > 0) && G > 0) rows.push(R('Shear modulus G = E / (2 (1 + nu))', G, u.E, inch ? 2 : 1));
      if (G > 0 && v.L > 0) {
        const phi = W.mech_torsion_angle(Tc, v.L, G * u.eK, v.D, di);
        rows.push(R('Angle of twist', phi * 180 / Math.PI, 'deg', 4), R('Angle of twist in radians', phi, 'rad', 6),
          R(inch ? 'Twist per foot' : 'Twist per metre', phi * 180 / Math.PI / v.L * (inch ? 12 : 1000), 'deg', 4),
          R('Torsional stiffness T / angle', T / phi * Math.PI / 180, (inch ? 'lbf·in' : 'N·m') + '/deg', 2));
      } else rows.push(mkNote('Enter G (or E and Poisson\'s ratio) and the length for the angle of twist.'));
    }
    if (v.tau > 0) rows.push(R('Solid diameter for the allowable stress', W.mech_torsion_solid_dia(Tc, v.tau * u.sK), u.L, u.dp));
    rows.push(mkNote('Round shafts only, elastic, no keyway or shoulder (both raise the stress: see Stress concentration). Combined bending and torsion is not included.'));
    return rows;
  },
  working: 'J = pi (D^4 - d^4) / 32; tau = T r / J (largest at r = D/2); angle phi = T L / (G J) in radians; G = E / (2 (1 + nu)). P = T omega, omega = 2 pi n / 60, so kW = N·m x rpm / 9549.3 and hp = lbf·in x rpm / 63 025. Solid shaft for an allowable stress: d = (16 T / (pi tau))^(1/3). 1 hp = 550 ft·lbf/s = 745.700 W.',
  source: 'Gere and Goodno, Mechanics of Materials, ch. 3 (torsion of circular bars, power transmission; relations by name). NIST SP 811 (unit factors). See docs/mechanics.md.',
},
{
  id: 'column', level: 'expert', group: 'Mechanics', title: 'Column buckling (Euler and Johnson)',
  desc: 'Critical buckling load of a straight column from its length, end conditions, section and material: Euler for slender columns, the Johnson parabola for intermediate ones, switching at the transition slenderness.',
  fields: s => {
    const u = mku(s), inch = s === 'inch';
    return [
      { id: 'end', label: 'End conditions (theoretical K)', unit: '', def: 1, options: [[1, 'Pinned - pinned, K = 1.0'], [0.5, 'Fixed - fixed, K = 0.5'], [0.7, 'Fixed - pinned, K = 0.7'], [2, 'Fixed - free (flagpole), K = 2.0'], [0, 'Own K (enter below)']] },
      { id: 'K', label: 'Effective length factor K', unit: '', def: '', when: v => v.end === 0 },
      { id: 'L', label: 'Unsupported length L', unit: u.L, def: inch ? 24 : 600 },
      { id: 'E', label: "Young's modulus E", unit: u.E, def: '' },
      { id: 'Sy', label: 'Yield strength Sy', unit: u.S, def: '' },
      { id: 'n', label: 'Factor of safety (optional)', unit: '', def: '' },
      { id: 'F', label: 'Applied axial load (optional)', unit: u.F, def: '' },
    ].concat(mkSecFields(s, [[8, 'Enter A and r yourself']], 2), [
      { id: 'A', label: 'Area A', unit: u.A, def: '', when: v => v.sec === 8 },
      { id: 'r', label: 'Least radius of gyration r', unit: u.L, def: '', when: v => v.sec === 8 },
    ]);
  },
  calc: (v, W, s) => {
    const u = mku(s), K = v.end > 0 ? v.end : v.K;
    let A, r;
    if (v.sec === 8) { A = v.A; r = v.r; } else { const g = mkSecArgs(v); A = mkSec(W, g, 0); r = mkSec(W, g, 15); }
    if (!(K > 0 && v.L > 0 && A > 0 && r > 0)) return [];
    const rows = [R('Effective length K L', K * v.L, u.L, u.dp), R('Least radius of gyration r', r, u.L, u.dp), R('Slenderness K L / r', K * v.L / r, '', 1)];
    if (!(v.E > 0 && v.Sy > 0)) { rows.push(mkNote('Enter E and Sy for the buckling load.')); return rows; }
    const E = v.E * u.eK, Sy = v.Sy * u.sK, c = i => W.mech_column(E, Sy, K, v.L, A, r, i);
    rows.push(R('Transition slenderness sqrt(2 pi^2 E / Sy)', c(1), '', 1), R('Method', c(2) === 1 ? 'Euler (slender)' : 'Johnson (intermediate)', ''),
      R('Critical stress', c(3) / u.sK, u.S, u.sdp), R('Critical load', c(4), u.F, 0));
    if (c(2) === 2) rows.push(R('Euler alone would give (not valid here)', c(5) / u.sK, u.S, u.sdp));
    if (v.n > 0) rows.push(R('Allowable load (critical / factor of safety)', c(4) / v.n, u.F, 0));
    if (v.F > 0) rows.push(R('Factor of safety at the applied load', c(4) / v.F, '', 2));
    if (K * v.L / r < 10) rows.push(mkNote('Very short (K L / r under about 10): this is a compression block; crushing, not buckling, governs.'));
    rows.push(mkNote('Ideal straight column, load on the centroid. Real columns are a little crooked and loaded off-centre, and theoretical K values are hard to achieve: AISC recommends design K of 0.65 (fixed-fixed), 0.80 (fixed-pinned), 1.0 (pinned-pinned) and 2.1 (fixed-free). Use a design code for structures.'));
    return rows;
  },
  working: 'Slenderness lambda = K L / r, r = sqrt(I_min / A). Euler: sigma_cr = pi^2 E / lambda^2, P_cr = pi^2 E I / (K L)^2. Johnson: sigma_cr = Sy - (Sy lambda / (2 pi))^2 / E. They meet, with the same slope, at lambda_1 = sqrt(2 pi^2 E / Sy), where sigma_cr = Sy / 2; below it Johnson is used, above it Euler. K: 1.0 pinned-pinned, 0.5 fixed-fixed, 0.7 fixed-pinned, 2.0 fixed-free (theoretical).',
  source: "Euler and Johnson relations: Gere and Goodno ch. 11; Shigley's Mechanical Engineering Design, columns (by name). Effective length factors: AISC 360-16 Commentary Table C-A-7.1 (free). See docs/mechanics.md.",
},
{
  id: 'stressconc', level: 'expert', group: 'Mechanics', title: 'Stress concentration (holes)',
  desc: 'Peak stress at a round hole in a plate under tension (finite width) and at an elliptical hole in a wide plate, with the fatigue notch factor from your notch sensitivity. Only closed forms printed by a free source are included; shoulder fillets and grooves are not.',
  fields: s => {
    const u = mku(s), inch = s === 'inch';
    return [
      { id: 'case', label: 'Case', unit: '', def: 1, options: [[1, 'Round hole in a plate, tension (finite width)'], [2, 'Elliptical hole in a wide plate, tension'], [3, 'Stepped shaft, groove, keyway (not included)']] },
      { id: 'W', label: 'Plate width W', unit: u.L, def: inch ? 2 : 50, when: v => v.case === 1 },
      { id: 'd', label: 'Hole diameter d', unit: u.L, def: inch ? 0.5 : 12, when: v => v.case === 1 },
      { id: 't', label: 'Plate thickness t', unit: u.L, def: inch ? 0.25 : 6, when: v => v.case === 1 },
      { id: 'F', label: 'Tensile force F', unit: u.F, def: inch ? 2000 : 10000, when: v => v.case === 1 },
      { id: 'ea', label: 'Half-axis a across the load', unit: u.L, def: inch ? 0.25 : 6, when: v => v.case === 2 },
      { id: 'eb', label: 'Half-axis b along the load', unit: u.L, def: inch ? 0.125 : 3, when: v => v.case === 2 },
      { id: 'sg', label: 'Remote (nominal) stress', unit: u.S, def: '', when: v => v.case === 2 },
      { id: 'q', label: 'Notch sensitivity q, 0 to 1 (yours, for Kf)', unit: '', def: '', when: v => v.case !== 3 },
    ];
  },
  calc: (v, W, s) => {
    const u = mku(s), rows = [];
    if (v.case === 3) return [R('Stepped shafts, shoulder fillets, grooves, keyways', 'not included', ''), mkNote('No free public source prints a curve fit for these that we could check, so BenchMate does not give one and does not invent one. Use the charts in Peterson\'s Stress Concentration Factors, Roark (Table 17.1) or Shigley (Appendix A-15).')];
    let kt = NaN;
    if (v.case === 1) {
      if (!(v.W > 0 && v.d > 0 && v.d < v.W)) return [];
      const r = v.d / v.W; kt = W.mech_kt_plate_hole(r);
      rows.push(R('d / W', r, '', 4), R('Kt (on the net-section stress)', kt, '', 3));
      if (v.t > 0 && v.F > 0) {
        const sn = v.F / ((v.W - v.d) * v.t), sgross = v.F / (v.W * v.t);
        rows.push(R('Gross stress F / (W t)', sgross / u.sK, u.S, u.sdp), R('Net-section stress F / ((W - d) t)', sn / u.sK, u.S, u.sdp), R('Peak stress at the hole Kt x net', kt * sn / u.sK, u.S, u.sdp), R('Peak / gross stress', kt * sn / sgross, '', 3));
      }
      if (r > 0.65) rows.push(mkNote('Wide hole: the ligaments are narrow; check net-section yield as well as the peak.'));
    } else {
      if (!(v.ea > 0 && v.eb > 0)) return [];
      kt = W.mech_kt_ellipse(v.ea, v.eb);
      rows.push(R('Kt = 1 + 2 a / b (on the remote stress)', kt, '', 3));
      if (v.sg > 0) rows.push(R('Peak stress at the end of the a axis', kt * v.sg, u.S, u.sdp));
      rows.push(mkNote('Wide plate (hole small against the width). A sharp slot (b small) makes Kt very large: treat a crack-like slot as a crack.'));
    }
    if (v.q >= 0 && v.q <= 1 && isFinite(kt)) rows.push(R('Fatigue notch factor Kf = 1 + q (Kt - 1)', W.mech_notch_kf(kt, v.q), '', 3));
    rows.push(mkNote('Elastic peak stress. Ductile parts under steady load yield locally and are less sensitive; in fatigue use Kf.'));
    return rows;
  },
  working: 'Round hole, finite width, net-section basis: Kt = 3 - 3.14 (d/W) + 3.667 (d/W)^2 - 1.527 (d/W)^3, sigma_nom = F / ((W - d) t); Kt = 3 for a small hole in a wide plate (Kirsch, 1898). Elliptical hole, wide plate: Kt = 1 + 2 a / b (Inglis, 1913), a across the load. Kf = 1 + q (Kt - 1), q from your notch sensitivity data (0 = no notch effect, 1 = full Kt).',
  source: 'B. McGinty, Stress concentrations at holes, fracturemechanics.org (Kirsch solution and the finite-width fit, net-section basis); Inglis 1913 (by name); Kf relation as printed by Engineers Edge (after Marks\' Calculations for Machine Design). See docs/mechanics.md.',
},
{
  id: 'fatigue', level: 'expert', group: 'Mechanics', title: 'Fatigue: endurance limit and Goodman',
  desc: 'Estimated endurance limit of a steel part with Marin factors, then the fatigue factor of safety by the modified Goodman, Soderberg and Gerber lines and the first-cycle yield check, with a diagram. The endurance limit here is an estimate: use test data when you have it.',
  fields: s => {
    const u = mku(s), inch = s === 'inch';
    return [
      { id: 'sut', label: 'Ultimate tensile strength Sut', unit: u.S, def: inch ? 90 : 620 },
      { id: 'sy', label: 'Yield strength Sy', unit: u.S, def: inch ? 60 : 415 },
      { id: 'sep', label: "Rotating-beam endurance limit Se' (blank = estimate for steel)", unit: u.S, def: '' },
      { id: 'fin', label: 'Surface finish (surface factor ka)', unit: '', def: 1, options: [[1, 'Machined or cold-drawn'], [0, 'Ground'], [2, 'Hot-rolled'], [3, 'As forged'], [9, 'Own ka (enter below)']] },
      { id: 'ka', label: 'Own surface factor ka', unit: '', def: '', when: v => v.fin === 9 },
      { id: 'dia', label: 'Diameter, bending or torsion (for size factor kb)', unit: u.L, def: '' },
      { id: 'kb', label: 'Or own size factor kb (axial load: 1)', unit: '', def: '' },
      { id: 'kc', label: 'Load factor kc (yours; bending 1)', unit: '', def: 1 },
      { id: 'kd', label: 'Temperature factor kd (yours)', unit: '', def: 1 },
      { id: 'ke', label: 'Reliability factor ke (yours)', unit: '', def: 1 },
      { id: 'kf', label: 'Fatigue notch factor Kf on the stresses', unit: '', def: 1 },
      { id: 'smax', label: 'Largest stress in the cycle', unit: u.S, def: inch ? 30 : 200 },
      { id: 'smin', label: 'Smallest stress in the cycle', unit: u.S, def: inch ? 5 : 40 },
    ];
  },
  calc: (v, W, s) => {
    const u = mku(s), inch = s === 'inch', rows = [];
    if (!(v.sut > 0)) return [];
    let sep = v.sep, sepEst = false;
    if (!(sep > 0)) { sep = W.mech_endurance_estimate(v.sut, inch ? 1 : 0); sepEst = true; }
    rows.push(R(sepEst ? mkWarn("Se' estimated for steel = 0.504 Sut (estimate)") : "Se' as entered", sep, u.S, u.sdp));
    const ka = v.fin === 9 ? v.ka : W.mech_marin_surface(v.fin, v.sut, inch ? 1 : 0);
    let kb = v.kb > 0 ? v.kb : NaN, kbSrc = 'as entered';
    if (!(kb > 0) && v.dia > 0) { kb = W.mech_marin_size_mm(v.dia * (inch ? 25.4 : 1)); kbSrc = '(d / 7.62 mm)^-0.1133'; if (!(kb > 0)) rows.push(mkNote('Diameter outside 2.79 to 51 mm (0.11 to 2 in): the size fit does not apply. Enter your own kb.')); }
    if (!(kb > 0) && !(v.dia > 0)) { kb = 1; kbSrc = 'no size effect (axial, or not given)'; }
    rows.push(R('Surface factor ka' + (v.fin === 9 ? ' (yours)' : ' = a Sut^b (estimate)'), ka, '', 3), R('Size factor kb ' + kbSrc, kb, '', 3));
    const kc = v.kc > 0 ? v.kc : 1, kd = v.kd > 0 ? v.kd : 1, ke = v.ke > 0 ? v.ke : 1;
    const se = ka * kb * kc * kd * ke * sep;
    if (!(se > 0)) return rows;
    rows.push(R('Endurance limit Se = ka kb kc kd ke Se\'', se, u.S, u.sdp));
    if (!(isFinite(v.smax) && isFinite(v.smin))) return rows;
    const kf = v.kf > 0 ? v.kf : 1, sa = kf * W.mech_stress_alt(v.smax, v.smin), sm = kf * W.mech_stress_mean(v.smax, v.smin);
    rows.push(R('Alternating stress Kf (max - min) / 2', sa, u.S, u.sdp), R('Mean stress Kf (max + min) / 2', sm, u.S, u.sdp));
    const n = i => W.mech_fatigue_factor(i, sa, sm, se, v.sut, v.sy);
    rows.push(R('Factor of safety, modified Goodman', n(0), '', 2), R('Factor of safety, Gerber', n(2), '', 2));
    if (v.sy > 0) rows.push(R('Factor of safety, Soderberg', n(1), '', 2), R('First-cycle yield (Langer) Sy / (sa + |sm|)', n(3), '', 2));
    if (sm <= 0) rows.push(mkNote('Compressive (or zero) mean stress: the factor shown is Se / sa, the usual conservative choice.'));
    rows.push(mkNote('Estimate for infinite life of steel. Se\' and ka are fits to scattered test data (ka differs by a few percent between published fits); kc, kd and ke are yours to enter because published values differ (axial kc is 0.7 in Norton\'s text, 0.85 in Shigley\'s). Kf is applied to the stresses. Not for welded parts or corrosive service.'));
    return rows;
  },
  working: "Se' = 0.504 Sut for Sut up to 1400 MPa (200 kpsi), 700 MPa (100 kpsi) above. Se = ka kb kc kd ke Se'. ka = a Sut^b: ground 1.58, -0.085; machined or cold-drawn 4.51, -0.265; hot-rolled 57.7, -0.718; as forged 272, -0.995 (MPa; kpsi a: 1.34, 2.70, 14.4, 39.9), capped at 1. kb = (d / 7.62)^-0.1133, d in mm, 2.79 to 51 mm. sa = (max - min)/2, sm = (max + min)/2, both times Kf. Goodman 1/n = sa/Se + sm/Sut; Soderberg 1/n = sa/Se + sm/Sy; Gerber n sa/Se + (n sm/Sut)^2 = 1, n = 1/2 (Sut/sm)^2 (sa/Se) [-1 + sqrt(1 + (2 sm Se/(Sut sa))^2)]; Langer n = Sy/(sa + |sm|).",
  source: "Engineers Edge, Marin endurance limit calculator (after T. H. Brown, Marks' Calculations for Machine Design): Se', ka table, kb fit. Goodman, Soderberg, Gerber and Langer lines: Shigley's Mechanical Engineering Design, ch. 6 (by name); Goodman checked against the Penn State ME 360 fatigue notes (Norton example 6-5). See docs/mechanics.md.",
},
{
  id: 'chuckforce', level: 'advanced', group: 'Mechanics', title: 'Centrifugal force and chuck grip',
  desc: 'Centrifugal force on chuck jaws and how much grip is left at speed, or the force on any rotating mass. Jaws gripping an outside diameter are flung outward and lose grip as speed rises; jaws gripping a bore gain grip. Your chuck maker\'s speed and grip data govern.',
  fields: s => {
    const u = mku(s), inch = s === 'inch';
    return [
      { id: 'mode', label: 'Calculate', unit: '', def: 1, options: [[1, 'Chuck jaws: grip at speed'], [2, 'Any rotating mass']] },
      { id: 'z', label: 'Number of jaws', unit: '', def: 3, when: v => v.mode === 1 },
      { id: 'mj', label: 'Mass of one jaw (base jaw + top jaw + screws)', unit: u.m, def: inch ? 2.5 : 1.2, when: v => v.mode === 1 },
      { id: 'rj', label: 'Radius of the jaw\'s centre of gravity', unit: u.L, def: inch ? 3 : 75, when: v => v.mode === 1 },
      { id: 'f0', label: 'Total grip at standstill (all jaws)', unit: u.F, def: inch ? 12000 : 55000, when: v => v.mode === 1 },
      { id: 'grip', label: 'Gripping', unit: '', def: 0, options: [[0, 'An outside diameter (jaws close in)'], [1, 'A bore (jaws open out)']], when: v => v.mode === 1 },
      { id: 'freq', label: 'Grip you need for the cut (optional)', unit: u.F, def: '', when: v => v.mode === 1 },
      { id: 'm', label: 'Mass', unit: u.m, def: inch ? 1 : 0.5, when: v => v.mode === 2 },
      { id: 'r', label: 'Radius of its centre of gravity', unit: u.L, def: inch ? 4 : 100, when: v => v.mode === 2 },
      { id: 'n', label: 'Spindle speed', unit: 'rpm', def: 2500 },
    ];
  },
  calc: (v, W, s) => {
    const u = mku(s), inch = s === 'inch', mk = inch ? MK_LB_KG : 1, rk = inch ? 0.0254 : 0.001, fk = inch ? MK_LBF_N : 1;
    if (!(v.n >= 0)) return [];
    const rows = [R('Angular speed omega = pi n / 30', Math.PI * v.n / 30, 'rad/s', 2)];
    if (v.mode === 2) {
      if (!(v.m > 0 && v.r > 0)) return [];
      const F = W.mech_centrifugal_n(v.m * mk, v.r * rk, v.n);
      rows.push(R('Centrifugal force m r omega^2', F / fk, u.F, 1), R('As a multiple of its weight', F / (v.m * mk * 9.80665), 'g', 1));
      return rows;
    }
    if (!(v.z >= 1 && v.mj > 0 && v.rj > 0)) return [];
    const smr = v.z * v.mj * mk * v.rj * rk, fc1 = W.mech_centrifugal_n(v.mj * mk, v.rj * rk, v.n);
    rows.push(R('Centrifugal force, one jaw', fc1 / fk, u.F, 0), R('Centrifugal force, all jaws', v.z * fc1 / fk, u.F, 0));
    if (v.f0 > 0) {
      const f0 = v.f0 * fk, g = W.mech_chuck_grip_n(f0, smr, v.n, v.grip);
      rows.push(R('Grip at ' + v.n + ' rpm', g / fk, u.F, 0), R('Change from standstill', 100 * (g - f0) / f0, '%', 1));
      if (v.grip === 0) {
        if (g <= 0) rows.push(mkNote('No grip left at this speed: the jaws would release the part. Slow down.'));
        rows.push(R('Speed where one third of the standstill grip is left', W.mech_chuck_speed_for_grip(f0, f0 / 3, smr), 'rpm', 0), R('Speed where the grip reaches zero', W.mech_chuck_speed_for_grip(f0, 0, smr), 'rpm', 0));
        if (v.freq > 0) { const nreq = W.mech_chuck_speed_for_grip(f0, v.freq * fk, smr); rows.push(R('Highest speed that keeps the grip you need', nreq, 'rpm', 0)); if (g < v.freq * fk) rows.push(mkNote('Below the grip you need at this speed.')); }
      }
    }
    rows.push(mkNote('Rigid jaws assumed. Real chucks lose grip faster: the body and jaws flex and the actuator has limits (VDI 3106 adds factors for this). Never run above the chuck\'s marked maximum speed, and check grip with the maker\'s data and a grip-force gauge.'));
    return rows;
  },
  working: 'F = m r omega^2, omega = pi n / 30 (n in rpm, m in kg, r in m, F in N). Chuck: Fc = sum(m_jaw r_jaw) omega^2 for all jaws. Gripping an outside diameter the jaws are pulled away from the part: Fsp(n) = Fsp0 - Fc; gripping a bore: Fsp0 + Fc. Speed at which the grip falls to F: n = (30/pi) sqrt((Fsp0 - F) / sum(m r)). Chuck makers rate speed so that about one third of the standstill grip remains (Berg Spanntechnik speed notes). Moving top jaws outward, using heavier jaws, or worn and unlubricated chucks all lower the grip at speed.',
  source: 'F = m r omega^2: OpenStax University Physics Vol. 1, ch. 6.3 (by name). Grip at speed and the sign rule: VDI 3106 (by name), Optimum lathe manual section 4.23.8 (Fsp0 = Ssp (Fsp +- Fc)); one-third rule: Berg Spanntechnik speed notes (free PDF). See docs/mechanics.md.',
},
{
  id: 'balance', level: 'expert', group: 'Mechanics', title: 'Balancing (ISO 21940-11 grade G)',
  desc: 'Permissible residual unbalance of a rigid rotor for a balance grade G (ISO 21940-11, formerly ISO 1940-1), split over two correction planes, the correction mass at a radius, the force the unbalance makes at speed, and the grade a measured unbalance reaches.',
  fields: s => {
    const u = mku(s), inch = s === 'inch';
    return [
      { id: 'm', label: 'Rotor mass', unit: u.m, def: inch ? 22 : 10 },
      { id: 'n', label: 'Maximum service speed', unit: 'rpm', def: 3000 },
      { id: 'G', label: 'Balance grade', unit: 'mm/s', def: 2.5, options: [[0.4, 'G 0.4'], [1, 'G 1'], [2.5, 'G 2.5'], [6.3, 'G 6.3'], [16, 'G 16'], [40, 'G 40'], [0, 'Own G (enter below)']] },
      { id: 'Gx', label: 'Own grade G', unit: 'mm/s', def: '', when: v => v.G === 0 },
      { id: 'hl', label: 'Distance from the centre of gravity to plane L (optional)', unit: u.L, def: '' },
      { id: 'hr', label: 'Distance from the centre of gravity to plane R', unit: u.L, def: '' },
      { id: 'rc', label: 'Correction radius (optional)', unit: u.L, def: '' },
      { id: 'um', label: 'Measured residual unbalance (optional)', unit: 'g·mm', def: '' },
    ];
  },
  calc: (v, W, s) => {
    const inch = s === 'inch', m = v.m * (inch ? MK_LB_KG : 1), G = v.G > 0 ? v.G : v.Gx, lk = inch ? 25.4 : 1;
    if (!(m > 0 && v.n > 0 && G > 0)) return [];
    const U = W.mech_iso_uper_gmm(G, m, v.n), rows = [R('Permissible residual unbalance U_per', U, 'g·mm', 1)];
    if (inch) rows.push(R('U_per', U / MK_OZIN_GMM, 'oz·in', 4), R('U_per', U / 25.4, 'g·in', 3));
    rows.push(R('Permissible centre-of-mass offset e_per', W.mech_iso_eper_um(G, v.n), 'µm', 3), R('Force from U_per at this speed', W.mech_unbalance_force_n(U, v.n) / (inch ? MK_LBF_N : 1), mku(s).F, 2));
    if (v.hl > 0 && v.hr > 0) {
      const ul = W.mech_plane_share(U, v.hl, v.hr), ur = W.mech_plane_share(U, v.hr, v.hl);
      rows.push(R('Share for plane L = U hR / b', ul, 'g·mm', 1), R('Share for plane R = U hL / b', ur, 'g·mm', 1));
      if (ul < 0.3 * U || ul > 0.7 * U) rows.push(mkNote('A plane share is outside 30-70 % of U_per: the centre of gravity is close to one plane. Use the narrow or overhung rotor rules of ISO 21940-11.'));
      if (v.rc > 0) rows.push(R('Correction mass in plane L at the radius', ul / (v.rc * lk), 'g', 3), R('Correction mass in plane R at the radius', ur / (v.rc * lk), 'g', 3));
    } else if (v.rc > 0) rows.push(R('Correction mass for U_per at the radius (one plane)', U / (v.rc * lk), 'g', 3));
    if (v.um > 0) { const g = W.mech_iso_grade_from_u(v.um, m, v.n); rows.push(R('Grade reached by the measured unbalance', g, 'mm/s', 2), R(g <= G ? 'Measured unbalance' : mkWarn('Measured unbalance'), g <= G ? 'within the grade' : 'over the grade', '')); }
    rows.push(mkNote('Rigid rotors only (running well below the first critical speed). Both planes between the bearings with their spacing more than a third of the bearing span for the simple split. One plane (static) balance is enough for narrow discs; long rotors need two planes (dynamic). The grade for a machine comes from its maker or ISO 21940-11; tool holders are commonly specified as G 2.5 at a stated speed.'));
    return rows;
  },
  working: 'U_per = 1000 G m / omega = 9549 G m / n (U in g·mm, G in mm/s, m in kg, n in rpm); e_per = U_per / m in g·mm/kg = µm. Two planes between the bearings: U_L = U_per hR / b, U_R = U_per hL / b, h = distance from the centre of gravity, b = hL + hR; each should be 30 to 70 % of U_per. Correction mass = U / r. Force = U omega^2 (U in kg·m). Grade reached G = U omega / (1000 m).',
  source: 'ISO 21940-11:2016 (formerly ISO 1940-1:2003), by name; formula, plane allocation and worked example (1000 lb rotor, 900 rpm, G 6.3: 21 oz·in per plane) from IRD Balancing Technical Paper 1, Balance quality requirements of rigid rotors (free). See docs/mechanics.md.',
  proof: [{ name: 'A 1000 lb rotor at 900 rpm, grade G 6.3', sys: 'inch', vals: { m: 1000, n: 900, G: 6.3 }, expect: [['U_per', 'oz·in', 42.1, 0.05]],
    source: 'IRD Balancing, Technical Paper 1, "Balance quality requirements of rigid rotors": worked example, 6.015 G W / N = 42.1 oz·in.' }],
},
{
  id: 'critspeed', level: 'expert', group: 'Mechanics', title: 'Critical speed of a shaft',
  desc: 'First critical (whirling) speed of a round shaft between bearings or overhung, with up to three discs (pulleys, wheels, chucks) and its own mass: Rayleigh (upper estimate) and Dunkerley (lower estimate), and the exact value for the plain shaft.',
  fields: s => {
    const u = mku(s), inch = s === 'inch';
    return [
      { id: 'sup', label: 'Mounting', unit: '', def: 1, options: [[1, 'Between two bearings (simply supported)'], [0, 'Overhung from a rigid mount (cantilever)']] },
      { id: 'L', label: 'Bearing span (or overhang) L', unit: u.L, def: inch ? 30 : 800 },
      { id: 'D', label: 'Shaft diameter D', unit: u.L, def: inch ? 1.5 : 40 },
      { id: 'd', label: 'Bore (blank = solid)', unit: u.L, def: '' },
      { id: 'E', label: "Young's modulus E", unit: u.E, def: '' },
      { id: 'rho', label: 'Shaft density (blank = massless shaft)', unit: u.rho, def: '' },
      { id: 'm1', label: 'Disc 1 mass', unit: u.m, def: inch ? 20 : 10 },
      { id: 'x1', label: 'Disc 1 position from the left bearing (overhung: from the mount)', unit: u.L, def: inch ? 15 : 400 },
      { id: 'm2', label: 'Disc 2 mass (optional)', unit: u.m, def: '' },
      { id: 'x2', label: 'Disc 2 position', unit: u.L, def: '' },
      { id: 'm3', label: 'Disc 3 mass (optional)', unit: u.m, def: '' },
      { id: 'x3', label: 'Disc 3 position', unit: u.L, def: '' },
    ];
  },
  calc: (v, W, s) => {
    const inch = s === 'inch', lk = inch ? 0.0254 : 0.001, di = v.d > 0 ? v.d : 0;
    if (!(v.L > 0 && v.D > 0 && di < v.D)) return [];
    if (!(v.E > 0)) return [mkNote('Enter E.')];
    const sec = [3, v.D * lk, di * lk, 0, 0], I = mkSec(W, sec, 3), A = mkSec(W, sec, 0); // metres, for the SI call
    const E = v.E * (inch ? MK_MPSI_GPA * 1e9 : 1e9);
    const mu = v.rho > 0 ? v.rho * (inch ? MK_LB_KG / Math.pow(0.0254, 3) : 1000) * A : 0;
    const bad = [1, 2, 3].some(i => v['m' + i] > 0 && !(v['x' + i] >= 0 && v['x' + i] <= v.L));
    if (bad) return [mkNote('Every disc position must lie on the shaft, 0 to L.')];
    const n = mkCritDiscs(v, s), c = i => W.mech_critical_speed(n, v.sup, v.L * lk, E * I, mu, i);
    if (!(n > 0 || mu > 0)) return [mkNote('Enter a disc mass or the shaft density.')];
    const rows = [R('First critical speed, Rayleigh (upper estimate)', c(0), 'rpm', 0), R('First critical speed, Dunkerley (lower estimate)', c(1), 'rpm', 0)];
    if (mu > 0) rows.push(R('Plain shaft alone (exact)', c(2), 'rpm', 0), R('Shaft mass per length', mu * (inch ? 0.0254 / MK_LB_KG : 0.001), inch ? 'lb/in' : 'kg/mm', inch ? 4 : 5));
    rows.push(R('Largest static sag under its own weight and the discs', c(3) / lk, mku(s).L, inch ? 5 : 4));
    rows.push(mkNote('Assumptions: uniform round shaft, rigid bearings (real bearings and housings lower the critical speed), discs as point masses (no gyroscopic effect), no damping. The true first critical speed lies between the two estimates. Keep running speeds well away from it and confirm with the machine maker or a run-up test.'));
    return rows;
  },
  working: 'Influence coefficients from the beam formulas (simply supported or cantilever, point load). Rayleigh: static deflections y_i under the weights, omega^2 = g sum(m_i y_i) / sum(m_i y_i^2), with the shaft lumped into 100 pieces. Dunkerley: 1/omega^2 = 1/omega_shaft^2 + sum(m_i a_ii), a_ii = deflection at disc i from a unit load there. Plain shaft (Euler-Bernoulli): omega = (beta L)^2 sqrt(E I / (mu L^4)), beta L = pi between bearings, 1.8751 overhung. n = 30 omega / pi. g = 9.80665 m/s^2.',
  source: 'Rayleigh and Dunkerley methods and beam frequencies: W. T. Thomson, Theory of Vibration with Applications (by name); checks: single disc sqrt(48 E I / m L^3) and the Rayleigh static-curve result sqrt(3024/31) for a plain shaft (derived in docs/mechanics.md).',
},
{
  id: 'cncguide', level: 'advanced', group: 'Guides', title: 'CNC knowledge guide',
  desc: 'Machine axes and the right-hand rule, machine, work and tool coordinates, work, length, radius and wear offsets, program structure, climb and conventional milling, chip formation, tool wear with causes and remedies, turning and milling troubleshooting, workholding and shop safety.',
  render: el => renderCncGuide(el),
  working: 'Reference only. Your machine and control manuals govern. Source keys next to each statement resolve to the list at the bottom; statements marked "to be verified" were not confirmed in two independent public sources.',
  source: 'ISO 841:2001 and ISO 6983-1:2009 (cited by name); NIST RS274NGC v3; LinuxCNC docs; Haas Factory Outlet operator and programming manuals; others listed under the guide and in docs/sources.md.',
},
{
  id: 'millsetup', level: 'advanced', group: 'Guides', title: 'CNC mill setup guide',
  desc: 'From a cold machine to a proven first part: start and home, the control panel, loading tools, four ways to measure tool lengths (paper, 1-2-3 block, probe, true length), work offsets with an edge finder or indicator, loading the program, the first run, adjusting for size and shutting down.',
  render: el => renderMillSetup(el),
  working: 'Reference only, in our own words. Key names are those of the Haas control, which the public guides read for this page describe. Source keys next to each statement resolve to the list at the bottom; statements marked "to be verified" were not confirmed by two independent publishers. Your machine manual governs.',
  source: 'Haas Factory Outlet mill operator and programming manuals; Worcester Polytechnic Institute Haas quick guide; Virasak, Manufacturing Processes 4-5; camInstructor; Hurco WinMax help; Travers Tool and Protool on edge finders; LinuxCNC documentation; CIMCO CNC programming book. Listed under the guide and in docs/sources.md.',
},
{
  id: 'toolpaths', level: 'advanced', group: 'Guides', title: 'Milling toolpath guide',
  desc: 'What each milling toolpath is for and how to set it up: from model to part, 2D and 3D, stepover and stepdown, facing, contours with cutter compensation, pockets and slots and how to enter them, chamfer and radius milling, spot, drill and tap, 3D roughing and finishing, rest machining, pencil passes and tolerances.',
  render: el => renderToolpaths(el),
  working: 'Reference only, in our own words. Source keys next to each statement resolve to the list at the bottom; statements marked "to be verified" were not confirmed by two independent publishers. The G-code example is one to adapt, not a proven program.',
  source: 'Autodesk Fusion blog and Inventor CAM help; MIT Center for Bits and Atoms class page; Helical Solutions Machining Guidebook (2016); MecSoft, Best practices in 3 axis machining; LinuxCNC documentation; Haas Factory Outlet mill programming manual. Listed under the guide and in docs/sources.md.',
},
{
  id: 'workholding', level: 'advanced', group: 'Guides', title: 'Workholding guide',
  desc: 'Holding work on a mill: the rules, the vise and its accessories, aligning a vise, hard, step and soft jaws, making soft jaws, squaring a block, clamps and fixture plates, thin parts, tape and glue, round parts and several parts at once.',
  render: el => renderWorkholding(el),
  working: 'Reference only, in our own words. Source keys next to each statement resolve to the list at the bottom; statements marked "to be verified" were not confirmed by two independent publishers.',
  source: 'CNC Cookbook and Tormach (one author); CIMCO CNC programming book; J. A. Nilsson, Machine Shop Tutorials; M. R. Jennings, Introduction to Machining (CC BY); Autodesk Fusion blog; Helical Solutions Machining Guidebook; WPI Haas quick guide. Listed under the guide and in docs/sources.md.',
},
{
  id: 'latheguide', level: 'advanced', group: 'Guides', title: 'CNC lathe guide',
  desc: 'Turning on a CNC lathe: the machine, chucks, soft jaws and collets, bar work with a puller or feeder, the common tools and insert shapes, speeds and feeds, the toolpaths in the order they are run with the Haas cycles, parting off, and live tools with the C axis.',
  render: el => renderLatheGuide(el),
  working: 'Reference only, in our own words. Source keys next to each statement resolve to the list at the bottom; statements marked "to be verified" were not confirmed by two independent publishers. Cycle numbers are those of the Haas lathe manual read for this page.',
  source: 'CIMCO CNC programming book, chapter 8; Haas Factory Outlet lathe programming manual (12/2024); Haas cut-off tool sheet; Production Machining and Modern Machine Shop (one publisher); CNC Cookbook; CNC Training Centre; Mitsubishi Materials. See docs/sources.md, "CNC lathe guide".',
},
{
  id: 'shoptools', level: 'advanced', group: 'Guides', title: 'Shop tools guide',
  desc: 'Bench and toolroom practice: sharpening twist drills and what a badly ground point does, grinding lathe tool bits, hacksaw and band saw blades and breaking a blade in, hole saw speeds from two charts, carbide burr speeds, choosing a cutting fluid, grinding wheel shapes, dressing and truing.',
  render: el => renderShopTools(el),
  working: 'Reference only, in our own words. Source keys next to each statement resolve to the list at the bottom; statements marked "to be verified" were not confirmed by two independent publishers. Speeds are printed as the two charts give them, side by side; the cutting speed for hole saws in mild steel is our arithmetic from both charts.',
  source: 'TTE work instruction and the Machinery Repairman manual (drills); J. A. Nilsson and mini-lathe.com (tool bits); Introduction to Machining (CC BY), Tameson, Fastenal, Sawblade.com, Modern Machine Shop (saws); RUKO chart at AutomationDirect and Remora Electrical (hole saws); Klingspor and Amana Tool (burrs); American Machinist and FUCHS (fluids); Palmgren and Norton in Modern Machine Shop (dressing). See docs/sources.md, "Shop tools guide".',
},
{
  id: 'matguide', level: 'advanced', group: 'Guides', title: 'Materials guide',
  desc: 'How to read what is stamped on the bar and printed on the certificate: SAE and AISI steel numbers, tool steel letters, stainless and cast iron families, aluminium and copper tempers, titanium, magnesium, nickel and zinc alloy names, how each hardness test works, the forms of corrosion, and the mill certificate.',
  render: el => renderMatGuide(el),
  working: 'Reference only, in our own words. Source keys next to each statement resolve to the list at the bottom; statements marked "to be verified" were not confirmed by two independent publishers. Where two sources give different figures both are shown.',
  source: 'Engineering ToolBox, Machine Design and Wikipedia (steel numbers); Matmatch and Tata Steel (carbon classes); eFunda, Total Materia and the open textbook Metallurgy, CC BY (tool steels); Outokumpu and Aalco (stainless); Acme Foundry and Wikipedia (cast iron); ESAB, Hydro, AlCircle, Xometry, Total Materia and Righton Blackburns (aluminium); Total Materia and National Bronze (copper tempers); Online Metals, eFunda, White Industries, Dynacast and Aludiecasting (other metals); Matmatch, Wevolver, UNSW, Missouri S&T and Welding Advisers (hardness tests); AMPP and TWI (corrosion); Projectmaterials and What Is Piping (certificates). Full list in docs/sources.md, "Materials guide".',
},
{
  id: 'measguide', level: 'advanced', group: 'Guides', title: 'Measurement guide',
  desc: 'Inspection practice: the ways a tolerance is written, the ten preferred metric fits and what each is for, surface plate grades and care, checking a micrometer and a caliper against gauge blocks, checking a shaft for runout with V-blocks and a dial indicator, and the surface texture and lay symbols on a drawing.',
  render: el => renderMeasGuide(el),
  working: 'Reference only, in our own words. Source keys next to each statement resolve to the list at the bottom; statements marked "to be verified" were not confirmed by two independent publishers. Where two sources give different figures both are shown.',
  source: 'WisTech Open Blueprint Reading (CC BY) and Machinist Guides (tolerances); Amesweb, Engineers Edge and Fractory (fits); Starrett, Quality Magazine, Mitutoyo and Travers (surface plates and blocks); Quality Magazine, Mitutoyo and Machinist Guides (micrometers and calipers); Fabrico, Acoem and the Machining FAQ (runout); GD&T Basics, Wevolver and Digital Surf (surface texture). Full list in docs/sources.md, "Measurement guide".',
},
{
  id: 'cutguide', level: 'advanced', group: 'Guides', title: 'Cutting tools guide',
  desc: 'What the cutting tools are called and what each is for: sixteen kinds of milling cutter, the tool materials from high speed steel to diamond with what each must not cut, the parts of a twist drill, files and filing, broaches with pitch and rise per tooth, and boring tools with their overhang limits.',
  render: el => renderCutGuide(el),
  working: 'Reference only, in our own words. Source keys next to each statement resolve to the list at the bottom; statements marked "to be verified" were not confirmed by two independent publishers. Where two sources give different figures both are shown.',
  source: 'Cutting Tool Engineering, American Machinist, MachineMfg and Wikipedia (milling cutters); CNCCookbook and AIMS Industrial (tool materials); TTE and The Engineers Post (twist drills); USDA Forest Service and Crescent Nicholson (files); American Machinist, Wikipedia and Engineers Edge (broaching); American Machinist and Cutting Tool Engineering (boring). Full list in docs/sources.md, "Cutting tools guide".',
},
{
  id: 'bearguide', level: 'advanced', group: 'Guides', title: 'Bearings and seals guide',
  desc: 'Rolling bearings for the person who fits them: what each type carries, how to read a bearing number and its suffixes (2RS, ZZ, C3), tolerance classes (P0 to P2, ABEC), which ring gets the tight fit, mounting cold and with heat, what a radial shaft seal asks of the shaft, and the threadlocker colours.',
  render: el => renderBearGuide(el),
  working: 'Reference only, in our own words. Source keys next to each statement resolve to the list at the bottom; statements marked "to be verified" were not confirmed by two independent publishers. Where two sources give different figures both are shown.',
  source: 'Reliability Solutions, RapidDirect and NSK (types); JTEKT Koyo, NSK, a college hand-out and Southern Cross Bearings (numbers); Wikipedia and NSK (tolerance classes); NHBB, NRB, MinebeaMitsumi and TFL (fits); Processing Magazine, Fabrico and Schaeffler (mounting); Seals-Shop and the University of Stuttgart (shaft seals); Permabond and Fastener Engineering (threadlockers). Full list in docs/sources.md, "Bearings and seals guide".',
},
{
  id: 'abrasguide', level: 'advanced', group: 'Guides', title: 'Abrasive processes guide',
  desc: 'The abrasive processes beyond the plain grinding wheel: the grinding ratio and spark-out, centerless grinding (why the work sits above centre, through-feed and infeed, lobing), honing and the crosshatch, lapping and light bands, diamond and CBN wheels (concentration, shape code), belt grinding, cut-off wheels and mounted points.',
  render: el => renderAbrasGuide(el),
  working: 'Reference only, in our own words. Source keys next to each statement resolve to the list at the bottom; statements marked "to be verified" were not confirmed by two independent publishers. Where two sources give different figures both are shown.',
  source: 'The Open University (grinding, centreless grinding); Cutting Tool Engineering, Modern Machine Shop and Production Machining (wheel wear, centerless grinding, honing); American Machinist and Wikipedia (honing, lapping); Kemet (lapping); MISUMI, UKAM and 3M (diamond and CBN wheels); EMI Supply and Xometry (belts); Weiler (cut-off wheels); Norton and PFERD (mounted points). Full list in docs/sources.md, "Abrasive processes guide".',
},
{
  id: 'drawguide', level: 'advanced', group: 'Guides', title: 'Drawings and weld symbols guide',
  desc: 'How to read a drawing: detail and assembly drawings, sheet sizes (A0 to A4, ANSI A to E), the title block, scales, line types, first and third angle projection and its symbol, sections and hatching, welding symbols (AWS A2.4 and ISO 2553), CAD file formats (STEP, IGES, STL, DXF), model-based definition and the drawing standards.',
  render: el => renderDrawGuide(el),
  working: 'Reference only, in our own words. Source keys next to each statement resolve to the list at the bottom; statements marked "to be verified" were not confirmed by two independent publishers. Where two sources put a thing differently both are shown.',
  source: 'McGill University and DraftAid (kinds of drawing, sections); Wikipedia and a Washington State open textbook (sheet sizes); Werk24 (title block); What Is Piping and a university lecture (lines); Xometry Pro and GD&T Basics (projection); TU Darmstadt (views, sections, scales); Miller Electric, WeldGuru, Clause5, Material Welding and STRUCTURE Magazine (welding symbols); Get It Made, GibbsCAM and Industrial Monitor Direct (CAD files); Sigmetrix and ETMM (model-based definition); DEVELOP3D (BS 8888). Full list in docs/sources.md, "Drawings and weld symbols guide".',
},
{
  id: 'procguide', level: 'advanced', group: 'Guides', title: 'Special processes and finishing guide',
  desc: 'The processes a shop sends out or meets on a drawing: water jet, laser, plasma and flame cutting of plate (what each cuts, heat-affected zone, thickness), sinker, wire and hole drilling EDM, ultrasonic, abrasive flow, electron beam and photochemical machining, polishing, buffing compounds and wire brushes, black oxide, phosphate and chromate conversion coatings, anodising Types I to III and how much the part grows, decorative and hard chrome, zinc, cadmium, nickel and electroless nickel plating, hydrogen embrittlement, thermal spraying. Three drawings.',
  render: el => renderProcGuide(el),
  working: 'Reference only, in our own words. Source keys next to each statement resolve to the list at the bottom; statements marked "to be verified" were not confirmed by two independent publishers. Where the sources give different figures each is shown with its source.',
  source: 'The Open University (OpenLearn Manupedia), Hypertherm, Fractory, The Fabricator, Techni Waterjet and Wikipedia (cutting plate); Modern Machine Shop and Xometry (EDM); Wikipedia, Artizono, Extrude Hone AFM and E-Fab (other processes); Products Finishing, Empire Abrasives, Wikipedia, United Abrasives and Weiler Abrasives (polishing, buffing, brushing); PCI Magazine, eFunda, Gleco Plating and Finishing.com (conversion coatings, anodising); Wikipedia and Richconn (chrome plating); Protolabs and EPI (other plating); TWI and WeldGuru (thermal spraying). Full list with URLs in docs/sources.md.',
},
{
  id: 'glossary', level: 'advanced', group: 'Guides', title: 'Glossary',
  desc: 'Over a hundred shop and CNC words in plain language, from 1-2-3 block to work offset, each with a link to the page that explains it. Type to search.',
  render: el => renderGlossary(el),
  working: 'No calculation: BenchMate\'s own wording. Where a term is explained on another page, the link opens that page and its sources.',
  source: 'Own definitions. The choice of headwords was compared with the glossary of the CIMCO CNC programming book (appendix E, headwords only). See docs/sources.md, "Glossary".',
},
{
  id: 'toolwear', level: 'advanced', group: 'Guides', title: 'Tool wear guide',
  desc: 'Ten ways a cutting edge wears or fails, each with our own drawing, what you see, the causes and what to try: flank wear, crater wear, notch wear, built-up edge, chipping, thermal cracking, plastic deformation, fracture, flaking and chip hammering.',
  render: el => renderToolWear(el),
  working: 'Reference only, in our own words. Each entry carries its source keys; an entry described by only one of the two makers is marked "to be verified".',
  source: 'Mitsubishi Materials, "Causes of tool damage" (mmc-carbide.com, course 78); Seco Tools, "Tool wear patterns: how to recognize and to optimize them" (secotools.com/article/122073). Read again 2026-11-12.',
},
{
  id: 'toolguide', level: 'advanced', group: 'Guides', title: 'Tooling guide',
  desc: 'Tool geometry terms (rake, clearance, lead and entering angle, helix, chip breaker, edge hone), tool materials and grades, coatings with the temperatures each publisher prints, end mills, drills and points, reamers, taps and tap limits, saw blade pitch and broken tap removal.',
  render: el => renderToolGuide(el),
  working: 'Reference only, in our own words. Source keys next to each statement resolve to the list at the bottom; statements without two independent public sources are marked "needs 2nd source". Coating temperatures show every value printed.',
  source: 'Tool and coating makers and distributors listed under the guide and in docs/tooling.md (data/refdata/tooling-evidence.json).',
},
{
  id: 'formulas', level: 'advanced', group: 'Guides', title: 'Formula library',
  desc: 'Every formula BenchMate uses, searchable: the formula, its variables and units, the tool that uses it and its source. Star the ones you use; Open calculator goes to the tool.',
  render: el => renderFormulaLibrary(el),
  working: 'Built from the formula registry in app/formulas.js. The Rust core does the arithmetic in every tool; this list is for reading.',
  source: 'Source keys as listed under the library and in docs/sources.md.',
},
];
