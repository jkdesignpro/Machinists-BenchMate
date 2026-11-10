// Tool registry. Each tool: id, group, title, desc, fields(sys) -> [{id,label,unit,def}],
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
  damped: [['Seco Tools (Steadyline)', '10'], ['Kennametal', '10 or more']],
};
const eField = s => s === 'inch' ? { u: 'Mpsi', k: MPSI_GPA, dp: 1 } : { u: 'GPa', k: 1, dp: 0 };
// Effective (equivalent solid) diameter of the fluted part as a fraction of D.
// Blank by default unless a verified source is recorded in docs/sources.md.
const FLUTE_FACTOR_DEF = '';

// Shared tool-geometry fields for the deflection and cut tools.
const toolGeomFields = s => [
  { id: 'd', label: 'Tool (cutting) diameter D', unit: lenU(s), def: s === 'inch' ? 0.5 : 12 },
  { id: 'dsh', label: 'Shank diameter (blank = D)', unit: lenU(s), def: '' },
  { id: 'L', label: 'Stick-out (holder face to tip)', unit: lenU(s), def: s === 'inch' ? 1.5 : 40 },
  { id: 'lf', label: 'Flute length (blank = treat as solid)', unit: lenU(s), def: s === 'inch' ? 1 : 26 },
  { id: 'kf', label: 'Effective flute diameter / D (approximation)', unit: 'x D', def: FLUTE_FACTOR_DEF },
  { id: 'mat', label: 'Tool material (sets E)', unit: '', def: 1, options: [[1, 'Solid carbide'], [2, 'HSS (M2)'], [0, 'Other: enter E below']] },
  { id: 'E', label: "Young's modulus E (blank = preset)", unit: eField(s).u, def: '' },
];
// Returns metric geometry {d, dsh, L, lf, kf, e} plus E notes, or an error string.
function toolGeom(v, s) {
  const k = s === 'inch' ? IN_MM : 1, ef = eField(s);
  const p = E_PRESETS[v.mat];
  const e = v.E > 0 ? v.E * ef.k : (p ? p.gpa : NaN);
  return { d: v.d * k, dsh: v.dsh > 0 ? v.dsh * k : 0, L: v.L * k, lf: v.lf > 0 ? v.lf * k : 0, kf: v.kf > 0 ? v.kf : 0, e,
    eSrc: v.E > 0 ? 'as entered' : (p ? p.name + ' preset, ' + p.src : ''), eShow: e / ef.k, eU: ef.u, eDp: ef.dp };
}
const LIMIT_NAMES = { 1: 'Tool deflection', 2: 'Spindle power', 3: 'Spindle torque (below base speed)', 4: 'Flute length', 5: 'Tool diameter (ae = D)' };

// Shared note for the DXF screens (see docs/cad-dxf.md).
const DXF_NOTE = 'Geometry and the DXF text are made in the Rust core. Layers: OUTLINE (outer profile), HOLES (round holes), CENTRE (centre marks, pitch circle, slot centreline). Outer profiles are closed polylines, counter-clockwise; arcs inside a polyline are stored as bulges, bulge = tan(included angle / 4). R2000 files store the units in $INSUNITS (1 = inches, 4 = millimetres); R12 files cannot, so set the units when you import them. All values are in the units chosen in the title bar.';
const DXF_SOURCE = 'Autodesk DXF Reference (HEADER $INSUNITS and $MEASUREMENT; LINE, CIRCLE, ARC, LWPOLYLINE, POLYLINE/VERTEX bulge). Output checked with the open-source ezdxf reader (audit). See docs/cad-dxf.md.';

const TOOLS = [
{
  id: 'rpm', group: 'Speeds and feeds', title: 'Spindle speed',
  pick: { map: { dia: 'dia' } },
  desc: 'Convert between spindle RPM and surface (cutting) speed.',
  fields: s => [
    { id: 'speed', label: s === 'inch' ? 'Surface speed' : 'Cutting speed Vc', unit: spdU(s), def: s === 'inch' ? 300 : 90 },
    { id: 'dia', label: 'Diameter', unit: lenU(s), def: s === 'inch' ? 0.5 : 12 },
    { id: 'rpm', label: 'Or known spindle speed', unit: 'RPM', def: '' },
  ],
  calc: (v, W, s) => {
    const rows = [];
    if (v.speed > 0 && v.dia > 0) rows.push(R('Spindle speed', s === 'inch' ? W.rpm_from_sfm(v.speed, v.dia) : W.rpm_from_vc(v.speed, v.dia), 'RPM', 1, 'rpm'));
    if (v.rpm > 0 && v.dia > 0) rows.push(R(s === 'inch' ? 'Surface speed at that RPM' : 'Cutting speed at that RPM', s === 'inch' ? W.sfm_from_rpm(v.rpm, v.dia) : W.vc_from_rpm(v.rpm, v.dia), spdU(s), 1));
    return rows;
  },
  working: 'Inch: n = 12 x SFM / (pi x D). Metric: n = 1000 x Vc / (pi x D).',
  source: "Machinery's Handbook (speeds and feeds); ISO cutting-speed symbols",
},
{
  id: 'feed', group: 'Speeds and feeds', title: 'Milling feed rate',
  pick: { map: { z: 'flutes' } },
  desc: 'Table feed from feed per tooth, or the reverse.',
  fields: s => [
    { id: 'rpm', label: 'Spindle speed', unit: 'RPM', def: 3000 },
    { id: 'z', label: 'Number of teeth', unit: '', def: 4 },
    { id: 'fz', label: 'Feed per tooth', unit: lenU(s), def: s === 'inch' ? 0.002 : 0.05 },
    { id: 'vf', label: 'Or known table feed', unit: feedMinU(s), def: '' },
  ],
  calc: (v, W, s) => {
    const rows = [];
    if (v.rpm > 0 && v.z > 0 && v.fz > 0) rows.push(R('Table feed', W.table_feed(v.rpm, v.fz, v.z), feedMinU(s), 2, 'feed'));
    if (v.rpm > 0 && v.z > 0 && v.vf > 0) rows.push(R('Feed per tooth', W.feed_per_tooth(v.vf, v.rpm, v.z), lenU(s), 4));
    return rows;
  },
  working: 'Vf = n x fz x z.',
  source: "Machinery's Handbook; Sandvik Coromant formulas and definitions",
},
{
  id: 'mrr', group: 'Speeds and feeds', title: 'Material removal rate and power',
  desc: 'Turning MRR with an optional power estimate. Specific cutting force kc is yours to enter; BenchMate does not guess it.',
  fields: s => s === 'inch' ? [
    { id: 'speed', label: 'Surface speed', unit: 'SFM', def: 300 },
    { id: 'doc', label: 'Depth of cut', unit: 'in', def: 0.05 },
    { id: 'f', label: 'Feed', unit: 'in/rev', def: 0.005 },
    { id: 'kc', label: 'Specific cutting force kc (optional)', unit: 'N/mm2', def: '' },
    { id: 'eta', label: 'Machine efficiency', unit: '0-1', def: 0.8 },
  ] : [
    { id: 'speed', label: 'Cutting speed Vc', unit: 'm/min', def: 200 },
    { id: 'doc', label: 'Depth of cut ap', unit: 'mm', def: 2 },
    { id: 'f', label: 'Feed fn', unit: 'mm/rev', def: 0.2 },
    { id: 'kc', label: 'Specific cutting force kc (optional)', unit: 'N/mm2', def: '' },
    { id: 'eta', label: 'Machine efficiency', unit: '0-1', def: 0.8 },
  ],
  calc: (v, W, s) => {
    if (!(v.speed > 0 && v.doc > 0 && v.f > 0)) return [];
    const rows = [];
    let q;
    if (s === 'inch') { q = W.mrr_turning_in3_min(v.speed, v.doc, v.f); rows.push(R('Material removal rate', q, 'in3/min', 3)); q = q * 16.387064; }
    else { q = W.mrr_turning_cm3_min(v.speed, v.doc, v.f); rows.push(R('Material removal rate', q, 'cm3/min', 2)); }
    if (v.kc > 0 && v.eta > 0) { const kw = W.power_kw(q, v.kc, v.eta); rows.push(R('Power at the spindle', kw, 'kW', 2, 'power_kw')); rows.push(R('Power at the spindle', kw * 1.34102, 'hp', 2)); }
    return rows;
  },
  working: 'Metric Q = Vc x ap x f (cm3/min). Inch Q = 12 x SFM x DOC x IPR. Power Pc = Q x kc / (60 000 x eta), Q in cm3/min, kc in N/mm2.',
  source: "Sandvik Coromant formulas and definitions; Machinery's Handbook",
},
{
  id: 'toollife', group: 'Speeds and feeds', title: 'Tool life and cost per part',
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
  id: 'arcfeed', group: 'Milling', title: 'Arc feed correction',
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
  id: 'helix', group: 'Milling', title: 'Helical interpolation and ramping',
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
  id: 'deflection', group: 'Milling', title: 'Tool deflection',
  pick: { map: { d: 'dia', dsh: 'shank', L: 'stick', lf: 'flute_len', mat: 'material' }, clear: ['dsh', 'lf'] },
  desc: 'Tip deflection of an end mill under a side (radial) force, modelled as a cantilever clamped at the holder face: solid shank, then the fluted length at an effective diameter. Enter the force, or estimate it from cutting power. The radial-to-tangential force ratio depends on engagement and tool geometry; it is yours to enter, BenchMate does not guess it.',
  fields: s => toolGeomFields(s).concat([
    { id: 'F', label: 'Radial force (if known)', unit: s === 'inch' ? 'lbf' : 'N', def: '' },
    { id: 'pc', label: 'Or net cutting power at the cut', unit: 'kW', def: '' },
    { id: 'vc', label: s === 'inch' ? 'Surface speed' : 'Cutting speed Vc', unit: spdU(s), def: '' },
    { id: 'ratio', label: 'Radial / tangential force ratio Fr/Ft', unit: '', def: '' },
  ]),
  calc: (v, W, s) => {
    const g = toolGeom(v, s), k = s === 'inch' ? IN_MM : 1, fU = s === 'inch' ? 'lbf' : 'N', fk = s === 'inch' ? LBF_N : 1;
    if (!(g.d > 0 && g.L > 0 && g.e > 0)) return [];
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
      const d = W.tool_deflection_mm(F, g.L, g.lf, ds, df, g.e);
      rows.push(R('Tip deflection', d / k, lenU(s), s === 'inch' ? 5 : 4));
      rows.push(R('Tip deflection', s === 'inch' ? d / k * 1000 : d * 1000, s === 'inch' ? 'thou' : 'um', s === 'inch' ? 2 : 1));
    }
    return rows;
  },
  working: 'I = pi d^4 / 64. Two-section cantilever, load F at the tip, stick-out L, fluted length a from the tip: deflection = F / (3 E) x [ (L^3 - a^3) / I_shank + a^3 / I_flute ]. With no flutes (or equal diameters) this is F L^3 / (3 E I). Force from power: Ft = Pc x 60 000 / Vc (Pc in kW at the cut, Vc in m/min, Ft in N); Fr = (Fr/Ft) x Ft. The effective flute diameter is an approximation for the reduced section of the fluted part. Holder, collet and spindle flex are not included, so a real setup deflects more. The load is put at the tip, which overstates deflection a little for shallow cuts. E presets: solid carbide 580 GPa (Ceratizit grade CTS20L, 10% Co; carbide grades span about 490-670 GPa in Tungaloy and Ceratizit grade tables, so use your tool maker\'s figure if you have it); HSS 219 GPa (voestalpine data sheet for M2, 1.3343, at 20 C). The effective flute diameter / D is left blank: enter your tool maker\'s figure or your own measured value.',
  source: "Cantilever and stepped (nonprismatic) beam deflection: Gere and Goodno, Mechanics of Materials; Roark's Formulas for Stress and Strain (Ch. 8). Equivalent flute diameter concept: Kops and Vo, CIRP Annals 1990. Force from power: Sandvik Coromant milling formulas. E presets: Ceratizit and voestalpine grade data (docs/sources.md).",
},
{
  id: 'cutopt', group: 'Milling', title: 'Cut check and optimiser',
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
    const args = ap => [g.d, g.dsh, z0(g.L), g.lf, g.kf, z0(g.e), v.z, v.ae * k, ap, v.fz * k, vc, z0(v.kc), z0(v.eta), z0(v.ratio), z0(v.F) * fk, z0(v.lim) * k, pmax, tmax];
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
      rows.push(R('Tool tip deflection', defl / k, lenU(s), s === 'inch' ? 5 : 4));
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
  id: 'chipthin', group: 'Milling', title: 'Radial chip thinning feed',
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
  diagram: (v, s) => typeof mtEngageSvg === 'function' ? mtEngageSvg(v.d, v.ae, 0, 0) : '',
  working: 'Engagement phi = acos(1 - 2 ae / D). Max chip hex = fz sin(phi) for ae < D/2, so fz = hex x RCTF with RCTF = 1 / sin(phi) = 1 / sqrt(1 - (1 - 2 ae / D)^2). At ae >= D/2 the chip reaches fz and RCTF = 1. Vf = n x z x fz. Very large factors at tiny stepovers push the tool hard on entry and amplify any runout; check the result against the tool maker\'s maximum feed.',
  source: 'Machining Doctor chip thinning calculator (RCTF); Altintas, Manufacturing Automation, Ch. 2 (h = c sin phi). See docs/sources.md.',
},
{
  id: 'cornerfeed', group: 'Milling', title: 'Corner engagement and feed',
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
  diagram: (v, s) => typeof mtEngageSvg === 'function' ? mtEngageSvg(v.d, v.ae, v.Rw, v.mode === 1 ? 1 : -1) : '',
  working: 'Straight wall: phi = acos(1 - 2 ae / D). Arc of radius R at the finished wall, tool radius r: inside corner, tool centre at R - r and the previous wall at R - ae: cos phi = ((R - ae)^2 - (R - r)^2 - r^2) / (2 r (R - r)); outside, centre at R + r and previous wall at R + ae: cos phi = ((R + r)^2 + r^2 - (R + ae)^2) / (2 r (R + r)) (law of cosines in the triangle arc centre, tool centre, edge of the previous wall; both tend to the straight-wall angle as R grows). Max chip = fz sin(phi), fz once phi >= 90 deg, so the feed per tooth for the same chip is fz x sin(phi_straight) / sin(phi_arc). The tool-centre feed then uses the arc feed correction (R - r) / R inside, (R + r) / R outside. A sharp corner entered on a straight line is not an arc: there the engagement peaks briefly higher.',
  source: 'Engagement and chip thickness: Altintas, Manufacturing Automation, Ch. 2; arc feed: Sandvik Coromant milling formulas (circular interpolation). The arc engagement is derived here by the law of cosines and checked in the core tests against a brute-force sample of the tool circle.',
},
{
  id: 'ballcusp', group: 'Milling', title: 'Ball-nose cusp height and stepover',
  pick: { map: { d: 'dia' }, types: ['Ball end mill', 'Other'] },
  desc: 'Scallop (cusp) height left between passes of a ball-nose tool on a flat or gently curved surface, or the stepover for the cusp you want.',
  fields: s => [
    { id: 'd', label: 'Ball diameter D', unit: lenU(s), def: s === 'inch' ? 0.25 : 6 },
    { id: 'st', label: 'Stepover', unit: lenU(s), def: s === 'inch' ? 0.01 : 0.25 },
    { id: 'h', label: 'Or target cusp height', unit: s === 'inch' ? 'in' : 'mm', def: '' },
  ],
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
  diagram: (v, s) => typeof mtCuspSvg === 'function' ? mtCuspSvg(v.d, v.st > 0 ? v.st : (v.h > 0 ? 2 * Math.sqrt(Math.max(0, v.d * v.h - v.h * v.h)) : 0)) : '',
  working: 'Cusp h = R - sqrt(R^2 - (s/2)^2), R = D/2, s = stepover; stepover for a cusp h: s = 2 sqrt(2 R h - h^2). For small stepovers h is close to s^2 / (8 R). This is for passes side by side on a flat surface; on a slope across the stepover the cusp grows, on a slope along the feed it does not.',
  source: 'Circle geometry; the small-stepover form s^2 / (8 R) as printed by IMCO Carbide Tool (Adjustments for ball nose endmills). See docs/sources.md.',
},
{
  id: 'balleff', group: 'Milling', title: 'Ball-nose effective diameter, speed and feed',
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
  diagram: (v, s) => typeof mtBallSvg === 'function' ? mtBallSvg(v.d, v.ap, v.tilt > 0 ? v.tilt : 0) : '',
  working: 'Band in the cut, measured from the tool axis: theta0 = acos(1 - 2 ap / D). A point at angle psi from the axis turns on diameter D sin(psi). With the axis tilted by beta from the surface normal the band spans beta - theta0 to beta + theta0, so the largest effective diameter is De = D sin(min(theta0 + beta, 90 deg)) and the smallest is D sin(beta - theta0), or 0 when beta <= theta0 (the centre cuts). With no tilt De = 2 sqrt(ap (D - ap)). n = 1000 Vc / (pi De) (inch: 12 SFM / (pi De)). The chip at the largest diameter is fz x De / D, so fz_adj = fz x D / De. The spindle speed is the one that gives your speed at the largest diameter; the rest of the edge runs slower.',
  source: 'ISCAR, Machining Titanium guide (2019), Table 28 (de = 2 sqrt(d ap - ap^2)); IMCO Carbide Tool and Machining Doctor (feed factor D / De). The tilted form is derived from the sphere and reduces to ISCAR\'s at zero tilt (core tests).',
},
{
  id: 'runout', group: 'Milling', title: 'Runout and chip load',
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
  id: 'finish', group: 'Turning', title: 'Surface finish from nose radius',
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
    if (v.f > 0 && v.r > 0) { rows.push(R('Theoretical Ra', W.ra_theoretical(v.f, v.r) * k, u, 1)); rows.push(R('Theoretical Rt (peak to valley)', W.rt_theoretical(v.f, v.r) * k, u, 1)); }
    if (v.ra > 0 && v.r > 0) rows.push(R('Feed for target Ra', W.feed_for_ra(v.ra / k, v.r), feedRevU(s), 4));
    return rows;
  },
  working: 'Rt = f^2 / (8 r). Ra = f^2 / (32 r). Valid for f < 2r.',
  source: "Machinery's Handbook; Sandvik Coromant formulas",
},
{
  id: 'insertcode', group: 'Turning', title: 'Insert designation (ISO 1832)',
  desc: 'Decode or build a metric turning insert code (shape, clearance, tolerance class, type, size, thickness, corner, edge, hand, maker chipbreaker), with the insert shape drawn and the size number computed from the inscribed circle.',
  render: el => renderInsertCode(el),
  working: 'See the note under the tool. Size = cutting edge length in whole mm, l = (d/2)(cot(a1/2) + cot(a2/2)).',
  source: 'ISO 1832:2017; code meanings from the Walter, Mitsubishi Materials, Korloy, Kennametal, YG-1, ISCAR and Dormer Pramet code keys listed under the tool.',
},
{
  id: 'holdercode', group: 'Turning', title: 'Toolholder designation (ISO 5608)',
  desc: 'Decode an external turning toolholder code: clamping system, insert shape, style and approach angle, clearance, hand, shank size, length and insert size.',
  render: el => renderHolderCode(el),
  working: 'See the note under the tool.',
  source: 'ISO 5608:2012; code meanings from the Mitsubishi Materials, YG-1, ZCC Cutting Tools and Dormer Pramet keys and catalogues listed under the tool.',
},
{
  id: 'iso513', group: 'Turning', title: 'Cutting material groups (ISO 513)',
  desc: 'The P, M, K, N, S and H application groups: colour, workpiece materials, and what the number after the letter means.',
  render: el => renderIso513(el),
  working: 'Reference only.',
  source: 'ISO 513:2012; colours from Dormer Pramet, FM Carbide and Cutting Tool Engineering; numbering from Seco Tools.',
},
{
  id: 'knurl', group: 'Turning', title: 'Knurling blank diameter',
  desc: 'Blank diameter for a whole number of knurl teeth, straight or 30 degree diagonal and diamond, with pitch in mm, TPI or diametral pitch.',
  render: el => renderKnurl(el),
  working: 'D = n p / (pi cos h); p = 25.4 / TPI mm or pi / DP in. See the note under the tool.',
  source: 'Dorian Tool and Hommel+Keller (Zeus) knurling catalogues; DIN 82:1973-01, DIN 403.',
},
{
  id: 'passtime', group: 'Turning', title: 'Cut time for a pass',
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
  id: 'taper', group: 'Turning', title: 'Taper',
  desc: 'Included angle and taper per unit length from two diameters and a length.',
  fields: s => [
    { id: 'D', label: 'Large diameter', unit: lenU(s), def: s === 'inch' ? 1 : 25 },
    { id: 'd', label: 'Small diameter', unit: lenU(s), def: s === 'inch' ? 0.5 : 12 },
    { id: 'L', label: 'Length', unit: lenU(s), def: s === 'inch' ? 2.5 : 60 },
  ],
  calc: (v, W, s) => (v.L > 0 && v.D > v.d) ? [
    R('Included angle', W.taper_included_angle_deg(v.D, v.d, v.L), 'deg', 4),
    R('Half angle (slide setting)', W.taper_included_angle_deg(v.D, v.d, v.L) / 2, 'deg', 4),
    R('Taper per unit length (diameter)', W.taper_per_length(v.D, v.d, v.L), s === 'inch' ? 'in/in' : 'mm/mm', 5),
  ] : [],
  working: 'tan(half angle) = (D - d) / (2 L).',
  source: "Machinery's Handbook (tapers)",
},
{
  id: 'bar', group: 'Turning', title: 'Bar stock planner',
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
  id: 'lathefeed', group: 'Turning', title: 'Lathe feed: per rev and per minute',
  desc: 'Convert a turning feed between per revolution (G95 / G99) and per minute (G94 / G98) at a spindle speed, or at the speed set by a cutting speed and diameter.',
  fields: s => [
    { id: 'f', label: 'Feed per revolution', unit: feedRevU(s), def: s === 'inch' ? 0.006 : 0.15 },
    { id: 'rpm', label: 'Spindle speed', unit: 'RPM', def: '' },
    { id: 'speed', label: s === 'inch' ? 'Or surface speed' : 'Or cutting speed Vc', unit: spdU(s), def: '' },
    { id: 'dia', label: 'with the diameter being cut', unit: lenU(s), def: '' },
    { id: 'vf', label: 'Or known feed per minute', unit: feedMinU(s), def: '' },
  ],
  calc: (v, W, s) => {
    let n = v.rpm > 0 ? v.rpm : NaN;
    const rows = [];
    if (!(n > 0) && v.speed > 0 && v.dia > 0) { n = s === 'inch' ? W.rpm_from_sfm(v.speed, v.dia) : W.rpm_from_vc(v.speed, v.dia); rows.push(R('Spindle speed at that diameter', n, 'RPM', 0, 'rpm')); }
    if (!(n > 0)) return rows.concat([R('Spindle speed', 'Enter the spindle speed, or a cutting speed and diameter', '', 0)]);
    if (v.f > 0) rows.push(R('Feed per minute', W.table_feed(n, v.f, 1), feedMinU(s), s === 'inch' ? 3 : 1, 'feed'));
    if (v.vf > 0) rows.push(R('Feed per revolution for that feed per minute', W.feed_per_tooth(v.vf, n, 1), feedRevU(s), s === 'inch' ? 5 : 4));
    return rows;
  },
  working: 'Vf = fn x n; fn = Vf / n. With constant surface speed (G96) the rpm, and so the feed per minute, change with the diameter: convert at the diameter you care about.',
  source: "Sandvik Coromant turning formulas; Machinery's Handbook (feeds).",
},
{
  id: 'roughtime', group: 'Turning', title: 'Multi-pass turning time',
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
  id: 'boringbar', group: 'Turning', title: 'Boring bar deflection',
  pick: { map: { d: 'shank', L: 'stick' }, types: ['Boring bar'] },
  desc: 'Tip deflection of a solid round boring bar under the cutting force, as a cantilever clamped at the holder, for steel, carbide or tungsten heavy metal bars, with the overhang (L/D) guidance published by bar makers.',
  fields: s => [
    { id: 'mat', label: 'Bar material (sets E)', unit: '', def: 1, options: [[1, 'Steel'], [2, 'Solid carbide'], [3, 'Tungsten heavy metal'], [0, 'Other: enter E below']] },
    { id: 'E', label: "Young's modulus E (blank = preset)", unit: eField(s).u, def: '' },
    { id: 'd', label: 'Bar diameter', unit: lenU(s), def: s === 'inch' ? 0.75 : 20 },
    { id: 'di', label: 'Coolant hole diameter (blank = none)', unit: lenU(s), def: '' },
    { id: 'L', label: 'Overhang (holder face to cutting edge)', unit: lenU(s), def: s === 'inch' ? 2.25 : 60 },
    { id: 'F', label: 'Tangential cutting force (if known)', unit: s === 'inch' ? 'lbf' : 'N', def: '' },
    { id: 'kc', label: 'Or specific cutting force kc', unit: 'N/mm2', def: '' },
    { id: 'ap', label: 'with depth of cut ap', unit: lenU(s), def: '' },
    { id: 'f', label: 'and feed per rev', unit: feedRevU(s), def: '' },
    { id: 'Fr', label: 'Radial force (optional)', unit: s === 'inch' ? 'lbf' : 'N', def: '' },
  ],
  calc: (v, W, s) => {
    const k = s === 'inch' ? IN_MM : 1, fk = s === 'inch' ? LBF_N : 1, fU = s === 'inch' ? 'lbf' : 'N', ef = eField(s);
    if (!(v.d > 0 && v.L > 0)) return [];
    const p = BAR_E[v.mat], e = v.E > 0 ? v.E * ef.k : (p ? p.gpa : NaN);
    if (!(e > 0)) return [R("Young's modulus", 'Enter E for your bar (from its maker)', '', 0)];
    const di = v.di > 0 ? v.di * k : 0, d = v.d * k, L = v.L * k;
    if (di >= d) return [R('Coolant hole', 'Must be smaller than the bar', '', 0)];
    const rows = [R("Young's modulus used (" + (v.E > 0 ? 'as entered' : p.name + ' preset, ' + p.src) + ')', e / ef.k, ef.u, ef.dp), R('Overhang L/D', v.L / v.d, 'x D', 2)];
    let F = v.F > 0 ? v.F * fk : NaN;
    if (!(F > 0) && v.kc > 0 && v.ap > 0 && v.f > 0) { F = W.turning_force(v.kc, v.ap * k, v.f * k); rows.push(R('Tangential force Fc = kc ap fn', F / fk, fU, 1)); }
    const dU = s === 'inch' ? 'thou' : 'um', dk = s === 'inch' ? 1000 / IN_MM : 1000;
    if (F > 0) { const dt = W.boring_bar_deflection(F, L, d, di, e); rows.push(R('Tip deflection, tangential (edge drops below centre)', dt * dk, dU, s === 'inch' ? 2 : 1)); if (v.Fr > 0) { const dr = W.boring_bar_deflection(v.Fr * fk, L, d, di, e); rows.push(R('Tip deflection, radial (bore comes out small)', dr * dk, dU, s === 'inch' ? 2 : 1)); rows.push(R('Combined tip deflection', Math.hypot(dt, dr) * dk, dU, s === 'inch' ? 2 : 1)); } }
    else rows.push(R('Deflection', 'Enter the force, or kc with ap and feed', '', 0));
    const g = BAR_LD[p ? v.mat : 0] || [];
    g.forEach(([who, ld]) => rows.push(R('Overhang guidance: ' + who, 'up to ' + ld + ' x D', '', 0)));
    const lim = g.length ? Math.min(...g.map(x => parseFloat(x[1]))) : NaN;
    if (v.L / v.d > lim) rows.push(R('Check', 'Overhang is past the smallest published guidance for this bar material (' + lim + ' x D); damped bars are made for ' + BAR_LD.damped.map(x => x[0] + ' ' + x[1] + ' x D').join(', '), '', 0));
    return rows;
  },
  diagram: (v, s) => typeof mtBarSvg === 'function' ? mtBarSvg(v.d, v.L, v.di) : '',
  working: 'I = pi (d^4 - di^4) / 64 (solid round bar, optional coolant hole; flats ground on the bar are ignored, so a real bar is a little softer). Tip deflection = F L^3 / (3 E I), clamped rigidly at the holder face: holder, clamping and spindle flex are not included, so the real bar deflects more. Fc = kc x ap x fn. E presets: steel 210 GPa (Ovako data for 4140 / 42CrMo4, in the BenchMate material data), solid carbide 580 GPa (Ceratizit grade CTS20L, 10% Co; use your bar maker\'s figure), tungsten heavy metal 360 GPa (Plansee Densimet D176). The guidance values are each maker\'s own rule of thumb for chatter-free boring, shown side by side because they differ.',
  source: "Gere and Goodno, Mechanics of Materials (cantilever); Sandvik Coromant (Fc = kc ap fn); E: Ovako, Ceratizit, Plansee W-MMC brochure 09.2021; overhang guidance: Seco Tools (2019), Kennametal (The basics of boring), Cutwel (Expert guide to boring bars). See docs/sources.md.",
},
{
  id: 'caxis', group: 'Turning', title: 'C-axis (polar) feed',
  desc: 'Mill-turn and live tooling: angular feed of the C axis for a feed along the part surface at a diameter, and the inverse time feed number (G93) for a move that combines a linear axis and C.',
  fields: s => [
    { id: 'd', label: 'Diameter the tool cuts at', unit: lenU(s), def: s === 'inch' ? 2 : 50 },
    { id: 'vf', label: 'Feed along the surface', unit: feedMinU(s), def: s === 'inch' ? 10 : 250 },
    { id: 'deg', label: 'Or C-axis feed', unit: 'deg/min', def: '' },
    { id: 'lin', label: 'G93 move: linear distance (X, Y or Z)', unit: lenU(s), def: '' },
    { id: 'ang', label: 'G93 move: C rotation', unit: 'deg', def: '' },
  ],
  calc: (v, W, s) => {
    if (!(v.d > 0)) return [];
    const rows = [];
    if (v.vf > 0) { const dm = W.c_axis_deg_min(v.vf, v.d); rows.push(R('C-axis feed', dm, 'deg/min', 1)); rows.push(R('C-axis speed', dm / 360, 'rev/min', 4)); }
    if (v.deg > 0) rows.push(R('Feed along the surface for that C feed', W.c_axis_feed_from_deg(v.deg, v.d), feedMinU(s), 2));
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
  id: 'slitsaw', group: 'Sawing', title: 'Slitting saw speeds and feeds',
  pick: { map: { D: 'dia', z: 'flutes' } },
  desc: 'Spindle speed, table feed, chip thickness and cut time for a slitting or slotting saw from the saw maker\'s cutting speed and feed per tooth. A slot shallower than half the saw diameter thins the chip; the screen shows how much.',
  fields: s => [
    { id: 'D', label: 'Saw diameter', unit: lenU(s), def: s === 'inch' ? 3 : 80 },
    { id: 'z', label: 'Number of teeth', unit: '', def: '' },
    { id: 'ae', label: 'Depth of slot (radial)', unit: lenU(s), def: s === 'inch' ? 0.25 : 6 },
    { id: 'speed', label: s === 'inch' ? 'Surface speed (saw maker)' : 'Cutting speed Vc (saw maker)', unit: spdU(s), def: '' },
    { id: 'fz', label: 'Feed per tooth (saw maker)', unit: lenU(s), def: '' },
    { id: 'hex', label: 'Or target chip thickness hex', unit: lenU(s), def: '' },
    { id: 'L', label: 'Length of slot (for time)', unit: lenU(s), def: '' },
  ],
  calc: (v, W, s) => {
    if (!(v.D > 0 && v.ae > 0)) return [];
    const rows = [], dp = s === 'inch' ? 5 : 4;
    const n = v.speed > 0 ? (s === 'inch' ? W.rpm_from_sfm(v.speed, v.D) : W.rpm_from_vc(v.speed, v.D)) : NaN;
    if (n > 0) rows.push(R('Spindle speed', n, 'RPM', 0, 'rpm'));
    const k = W.rctf(v.ae, v.D);
    rows.push(R('Chip thinning factor (RCTF)', k, 'x', 3));
    if (v.z > 0) rows.push(R('Teeth in the cut at once', W.teeth_engaged(v.z, v.ae, v.D), '', 2));
    const fz = v.hex > 0 ? v.hex * k : v.fz;
    if (fz > 0) {
      if (v.hex > 0) rows.push(R('Feed per tooth for that chip', fz, lenU(s), dp)); else rows.push(R('Max chip thickness hex', fz / k, lenU(s), dp));
      if (n > 0 && v.z > 0) {
        const vf = W.table_feed(n, fz, v.z); rows.push(R('Table feed', vf, feedMinU(s), 2, 'feed'));
        const app = W.cutter_approach(v.D, v.ae); rows.push(R('Approach to full depth', app, lenU(s), s === 'inch' ? 3 : 2));
        if (v.L > 0) rows.push(R('Cut time (slot plus approach)', (v.L + app) / vf, 'min', 3));
      }
    }
    return rows;
  },
  working: 'n = 1000 Vc / (pi D) (inch 12 SFM / (pi D)). Vf = n x z x fz. Engagement phi = acos(1 - 2 ae / D), hex = fz sin(phi) for ae < D/2, so fz = hex / sin(phi) for a target chip. Teeth in the cut = z phi / 360 deg. Approach = sqrt(ae (D - ae)), the distance the saw centre travels from first touch to full depth. Speeds and chip loads come from the saw maker; BenchMate does not guess them.',
  source: 'Sandvik Coromant milling formulas (n, Vf); Machining Doctor (RCTF); Altintas, Ch. 2 (chip thickness); approach by circle geometry.',
},
{
  id: 'bandsaw', group: 'Sawing', title: 'Bandsaw cut time',
  desc: 'Time to cut through a round, rectangular or tube section from the down-feed rate or the cutting rate (area per minute) your saw or blade maker gives, and the chip per tooth from the blade speed and pitch.',
  fields: s => [
    { id: 'shape', label: 'Section', unit: '', def: 1, options: [[1, 'Round bar'], [2, 'Rectangle (cut through the height)'], [3, 'Tube']] },
    { id: 'a', label: 'Diameter, or width of the rectangle', unit: lenU(s), def: s === 'inch' ? 4 : 100 },
    { id: 'b', label: 'Rectangle height, or tube wall', unit: lenU(s), def: '' },
    { id: 'vf', label: 'Down-feed rate', unit: feedMinU(s), def: '' },
    { id: 'rate', label: 'Or cutting rate', unit: s === 'inch' ? 'in2/min' : 'cm2/min', def: '' },
    { id: 'vb', label: 'Blade speed (for chip per tooth)', unit: s === 'inch' ? 'ft/min' : 'm/min', def: '' },
    { id: 'tpi', label: 'Blade pitch', unit: 'TPI', def: '' },
  ],
  calc: (v, W, s) => {
    if (!(v.a > 0)) return [];
    let area, h;
    if (v.shape === 2) { if (!(v.b > 0)) return [R('Section', 'Enter the height', '', 0)]; area = v.a * v.b; h = v.b; }
    else if (v.shape === 3) { if (!(v.b > 0 && v.b < v.a / 2)) return [R('Section', 'Enter a wall thinner than half the diameter', '', 0)]; area = Math.PI / 4 * (v.a ** 2 - (v.a - 2 * v.b) ** 2); h = v.a; }
    else { area = Math.PI / 4 * v.a ** 2; h = v.a; }
    const au = s === 'inch' ? 'in2' : 'cm2', ak = s === 'inch' ? 1 : 0.01;
    const rows = [R('Area cut', area * ak, au, 2), R('Height the blade feeds through', h, lenU(s), 2)];
    if (v.vf > 0) rows.push(R('Cut time from the down-feed', h / v.vf, 'min', 2));
    if (v.rate > 0) { const t = area * ak / v.rate; rows.push(R('Cut time from the cutting rate', t, 'min', 2)); rows.push(R('Average down-feed at that rate', h / t, feedMinU(s), 2)); }
    if (v.vf > 0 && v.vb > 0 && v.tpi > 0) {
      const c = s === 'inch' ? W.bandsaw_chip_per_tooth(v.vf * IN_MM, v.vb * FT_M, v.tpi) / IN_MM : W.bandsaw_chip_per_tooth(v.vf, v.vb, v.tpi);
      rows.push(R('Feed per tooth (depth each tooth takes)', c, lenU(s), s === 'inch' ? 6 : 5));
    }
    return rows;
  },
  working: 'Time = height / down-feed rate, or area / cutting rate (the square inches or cm2 per minute figure saw makers quote). Round area pi D^2 / 4, tube pi (D^2 - (D - 2t)^2) / 4, rectangle W x H. Teeth per minute = blade speed x teeth per foot (or per metre); feed per tooth = down-feed / teeth per minute. Down-feed and cutting rates depend on the material, blade and machine: take them from your saw or blade maker.',
  source: 'Starrett Bulletin 193 (cutting rate in square inches per minute, minutes per cut); KASCO (teeth per minute = teeth per foot x blade speed). See docs/sources.md.',
},
{
  id: 'drillpoint', group: 'Drilling and tapping', title: 'Drill point length',
  pick: { map: { dia: 'dia', ang: 'point' }, types: ['Drill', 'Spot', 'Other'] },
  desc: 'Axial length of the drill point.',
  fields: s => [
    { id: 'dia', label: 'Drill diameter', unit: lenU(s), def: s === 'inch' ? 0.25 : 6 },
    { id: 'ang', label: 'Point angle', unit: 'deg', def: 118 },
  ],
  calc: (v, W, s) => (v.dia > 0 && v.ang > 0 && v.ang < 180) ? [R('Point length', W.drill_point_length(v.dia, v.ang), lenU(s), 4)] : [],
  working: 'h = (d / 2) / tan(point angle / 2).',
  source: "Machinery's Handbook (drills)",
},
{
  id: 'spotdepth', group: 'Drilling and tapping', title: 'Spot and centre drill depth',
  pick: { map: { ang: 'point' }, types: ['Spot', 'Drill', 'Chamfer', 'Other'] },
  desc: 'Depth to program a spot drill, chamfer tool point or centre drill to for a given chamfer (countersink) diameter, or the diameter a depth gives. The centre drill\'s pilot length is yours to measure or take from its maker.',
  fields: s => [
    { id: 'mode', label: 'Tool', unit: '', def: 1, options: [[1, 'Spot drill or pointed chamfer tool'], [2, 'Centre drill (pilot and countersink)']] },
    { id: 'dc', label: 'Chamfer / countersink diameter wanted', unit: lenU(s), def: s === 'inch' ? 0.3 : 8 },
    { id: 'ang', label: 'Included angle of the point or countersink', unit: 'deg', def: 90 },
    { id: 'dh', label: 'Hole diameter (optional, for the chamfer width)', unit: lenU(s), def: '' },
    { id: 'dp', label: 'Centre drill pilot diameter', unit: lenU(s), def: '' },
    { id: 'lp', label: 'Centre drill: tip to start of the countersink cone', unit: lenU(s), def: '' },
    { id: 'z', label: 'Or a depth, to get the diameter', unit: lenU(s), def: '' },
  ],
  calc: (v, W, s) => {
    if (!(v.ang > 0 && v.ang < 180)) return [];
    const rows = [], dp = s === 'inch' ? 4 : 3;
    if (v.mode === 2) {
      if (!(v.dp > 0 && v.lp >= 0)) return [R('Centre drill', 'Enter the pilot diameter and the length from the tip to the countersink', '', 0)];
      if (v.dc > 0) { const z = W.centre_drill_depth(v.dc, v.dp, v.lp, v.ang); rows.push(R('Depth from the tip', isFinite(z) ? z : 'Countersink smaller than the pilot', isFinite(z) ? lenU(s) : '', dp)); }
      if (v.z > 0) { const d = W.centre_drill_dia(v.z, v.dp, v.lp, v.ang); rows.push(R('Countersink diameter at that depth', isFinite(d) ? d : 'Depth does not reach the countersink', isFinite(d) ? lenU(s) : '', dp)); }
    } else {
      if (v.dc > 0) rows.push(R('Depth from the tip', W.spot_depth(v.dc, v.ang), lenU(s), dp));
      if (v.z > 0) rows.push(R('Chamfer diameter at that depth', 2 * v.z * Math.tan(v.ang * Math.PI / 360), lenU(s), dp));
    }
    if (v.dh > 0 && v.dc > v.dh) rows.push(R('Chamfer width on the hole (each side)', (v.dc - v.dh) / 2, lenU(s), dp));
    return rows;
  },
  diagram: (v, s) => typeof mtSpotSvg === 'function' ? mtSpotSvg(v.mode, v.dc, v.ang, v.dp, v.lp) : '',
  working: 'Pointed tool: depth from the tip z = (Dc / 2) / tan(angle / 2); diameter at depth z: Dc = 2 z tan(angle / 2). Centre drill: z = l + (Dc - d) / (2 tan(angle / 2)), with d the pilot diameter and l the length from the tip to where the countersink cone starts (it includes the pilot\'s own point). Program the Z depth to the tool tip; a tip with a flat or radius cuts slightly larger at the same depth.',
  source: 'Right-triangle geometry of a cone (as in the Drill point length tool).',
},
{
  id: 'drillchart', group: 'Drilling and tapping', title: 'Drill size chart',
  desc: 'Fractional, number, letter and metric drills in decimal inch and mm, searchable, with a nearest-drill finder. Number and letter sizes show how many independent publishers print each value.',
  render: el => renderDrillChart(el),
  working: 'Number and letter drill sizes are a convention (ASME B94.11M-1993 lists them; they are not given by a formula), so each value is what the publishers listed under the table print. Fractional sizes are n/64 in, exact. mm = inch x 25.4 (exact). The nearest-drill finder lists the drills closest to your size, smaller first.',
  source: 'Wikipedia "Drill bit sizes"; Stoody Industrial & Welding Supply decimal equivalents chart; P. Lobben, Machinists\' and Draftsmen\'s Handbook (1910, public domain). Standards cited, not read: ASME B94.11M-1993 (twist drills, current per ASME catalogue), ISO 235:2016 (metric jobber drill sizes).',
},
{
  id: 'tapdrill', group: 'Drilling and tapping', title: 'Tap drill size',
  desc: 'Hole size for a chosen percent of thread with a cutting tap or a forming (roll) tap, for ISO metric and Unified threads or any size you enter, with the nearest standard drills and the percent of thread each one gives.',
  render: el => renderTapDrill(el),
  working: 'See the note under the tool.',
  source: 'OSG USA Tapping Guide vol. 3 (2024); FM Carbide TechTips; Engineers Edge. ISO 68-1:2023, ASME B1.1-2024.',
},
{
  id: 'chatter', group: 'Chatter and vibration', title: 'Chatter finder (stable speeds)',
  desc: 'Listen to a cut through the microphone, or type the chatter frequency, and get the tooth passing frequency and the spindle speeds where a whole number of chatter waves fit between teeth. A rule-of-thumb lobe estimate, not a full stability lobe diagram.',
  render: el => renderChatter(el),
  working: 'Tooth passing frequency f_t = n z / 60 (lathe: z = 1). Stable speed estimate for lobe N = 0, 1, 2 ...: n = 60 fc / (z (N + 1)): the tooth period then holds a whole number of chatter waves, so the wavy surface left by one tooth lines up with the next and does not feed the vibration. fc / f_t gives the lobe the cut is in now. Spectrum: Hann window, radix-2 FFT in the Rust core, averaged over a few frames; peaks within the tolerance of a spindle harmonic (runout, tooth passing and their multiples) are marked and skipped. The chatter frequency sits a little above the natural frequency it comes from, so after a change of speed listen again (Smith and Tlusty repeat the step until it settles). Use the running spindle speed, not the commanded one. Nothing is recorded or stored: the audio stays in this page while you listen and is dropped when you stop.',
  source: 'S. Smith, Finding harmony in stable cutting, Cutting Tool Engineering, Dec. 2010; S. Smith and J. Tlusty, CIRP Annals 41(1), 1992; Y. Altintas, Manufacturing Automation, 2nd ed., Ch. 3; Cooley and Tukey (1965), FFT. See docs/sources.md.',
},
{
  id: 'grindspeed', group: 'Grinding', title: 'Wheel and work speed, equivalent diameter',
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
  diagram: (v, s) => typeof grindDeSvg === 'function' ? grindDeSvg(v.mode, v.ds, v.dw) : '',
  working: 'Wheel speed vs = pi ds ns / 60 000 m/s (ds in mm), SFPM = pi ds(in) ns / 12. Work speed vw = pi dw nw / 1000 m/min. Speed ratio q = vs x 60 / vw. Equivalent diameter de = dw ds / (dw + ds) external, dw ds / (dw - ds) internal, ds surface. Contact length lg = sqrt(ae de). Specific removal rate Q\'w = ae vw (mm3/mm/s with vw in mm/s); equivalent chip thickness heq = ae vw / vs. The maximum operating speed is marked on every wheel larger than 80 mm (or on its label or a notice) and must not be exceeded; it depends on the wheel, not on anything BenchMate can work out.',
  source: 'D. S. Goetz, Cutting Tool Engineering, 24 Oct 2017 (sfpm, de external, contact length); S. Malkin and C. Guo, Grinding Technology, 2nd ed., 2008 (de internal and surface, Q\'w, heq); W. B. Rowe, Principles of Modern Grinding Technology, 2nd ed., 2014 (speed ratio). Wheel marking: ISO 525:2020, EN 12413, ANSI B7.1 (cited by name). See docs/sources.md.',
},
{
  id: 'grindtime', group: 'Grinding', title: 'Cylindrical traverse and plunge time',
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
  id: 'grindsurf', group: 'Grinding', title: 'Surface grinding time',
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
  diagram: (v, s) => typeof grindSurfSvg === 'function' ? grindSurfSvg() : '',
  working: 'Stroke length = L + 2 x overtravel; time per stroke = stroke / table speed (twice that when grinding one way only, as the table returns empty). Strokes per layer = ceil(cross travel / cross-feed) + 1. Layers = ceil(stock / down-feed) + spark-out passes. Time = strokes x layers x time per stroke. Table reversal, wheel dressing and loading are not included.',
  source: 'Distance / rate arithmetic; surface grinding kinematics as in W. B. Rowe, Principles of Modern Grinding Technology.',
},
{
  id: 'gritconv', group: 'Grinding', title: 'Grit size conversion',
  desc: 'FEPA F (grinding wheels), ANSI / US mesh and FEPA P (coated) grit sizes in micrometres, as printed by two publishers each, with the nearest sizes in the other systems. Disagreements between publishers are shown.',
  render: el => renderGritConv(el),
  working: 'Sizes are what the publishers print (see the note under the tool for what each number means). Coarse grits are graded with sieves and fine grits by sedimentation, so a coarse grit size is a sieve opening, not a mean grain size. Nearest equivalents compare the first printed size of each grit and are only approximate.',
  source: 'Noritake (JIS R6001 tables), Hapstone, Ted Pella (3M), Steel Data. Standards cited by name: ISO 8486-1:1996 and ISO 8486-2:2007 (F grits), ISO 6344-2/-3:2021 (P grits), FEPA 42 and 43, ANSI B74.12 / B74.10 / B74.18.',
},
{
  id: 'wheelcode', group: 'Grinding', title: 'Grinding wheel marking decoder',
  desc: 'Decode a conventional (aluminium oxide or silicon carbide) grinding wheel specification such as A46-K8V or WA 60 K 7 V: abrasive, grit size, grade, structure, bond and the maker\'s record, with how many publishers print each meaning.',
  render: el => renderWheelCode(el),
  working: 'Order: abrasive (letters, often with a maker\'s number in front), grit (number), grade (letter A soft to Z hard), structure (number, low dense, high open; optional), bond (letters), maker\'s record. Letter meanings come from wheel makers and training publishers; where they differ (E, O, AZ), all are shown. Diamond and CBN wheels use a different marking and are not decoded here.',
  source: 'ISO 525:2020 (confirmed 2026) and ANSI B74.13-2016, cited by name; meanings as printed by United Abrasives, CGW, the US Navy Machinery Repairman manual and High Speed Training.',
},
{
  id: 'wires', group: 'Threads', title: 'Thread measurement over wires',
  desc: 'Pitch diameter, best wire size and the measurement over three wires for 60 degree threads.',
  fields: s => [
    { id: 'major', label: 'Major diameter', unit: lenU(s), def: s === 'inch' ? 0.5 : 10 },
    { id: 'pitch', label: s === 'inch' ? 'Threads per inch (TPI)' : 'Pitch', unit: s === 'inch' ? 'TPI' : 'mm', def: s === 'inch' ? 13 : 1.5 },
    { id: 'wire', label: 'Wire diameter (blank = best size)', unit: lenU(s), def: '' },
  ],
  calc: (v, W, s) => {
    if (!(v.major > 0 && v.pitch > 0)) return [];
    const p = s === 'inch' ? 1 / v.pitch : v.pitch;
    const e = W.thread_pitch_dia_basic(v.major, p);
    const best = W.thread_best_wire(p);
    const w = v.wire > 0 ? v.wire : best;
    return [
      R('Basic pitch diameter', e, lenU(s), 5),
      R('Best wire size', best, lenU(s), 5),
      R('Measurement over three wires', W.thread_three_wire_m(e, w, p), lenU(s), 5),
    ];
  },
  working: 'E = D - 0.649519 P. Best wire w = 0.57735 P. M = E + 3w - 0.866025 P. Lead-angle correction neglected.',
  source: "Machinery's Handbook (screw thread measurement)",
},
{
  id: 'threaddata', group: 'Threads', title: 'Thread data and limits',
  desc: 'Basic dimensions of ISO metric (coarse and fine) and Unified (UNC, UNF, UNEF) threads from the basic profile, with ISO 6g/6H and Unified 2A/3A/2B/3B limits computed from the standards\' formulas and checked against published tables.',
  render: el => renderThreadData(el),
  working: 'See the note under the tool.',
  source: 'ISO 68-1:2023, ISO 261:1998, ISO 262:2023, ISO 965-1:2013 (revised 2026), ASME B1.1-2024; series and published limits from the publishers listed under the tool.',
},
{
  id: 'pipethreads', group: 'Threads', title: 'Pipe threads (BSP and NPT)',
  desc: 'BSP parallel (G, ISO 228-1) and taper (R / Rc / Rp, ISO 7-1) and NPT (ASME B1.20.1): threads per inch, diameters, pitch diameters, gauge and engagement lengths.',
  render: el => renderPipeThreads(el),
  working: 'See the note under the tool.',
  source: 'ISO 228-1:2000, ISO 7-1:1994 (with Cor 1:2007), ASME B1.20.1-2013 (reaffirmed 2018); series values from the publishers listed under the tool.',
},
{
  id: 'whitworth', group: 'Threads', title: 'Whitworth and BA threads',
  desc: 'BSW, BSF (BS 84) and BA (BS 93) threads: threads per inch, pitch, major, effective and minor diameters, thread depth and radius.',
  render: el => renderWhitworth(el),
  working: 'See the note under the tool.',
  source: 'BS 84:2007, BS 93:2008; series values from the publishers listed under the tool.',
},
{
  id: 'machinetapers', group: 'Setup', title: 'Machine tapers',
  desc: 'Morse, Jacobs, 7:24 steep tapers (ISO 7388-1 / SK, BT, CAT), HSK-A and R8: gauge diameters, lengths, taper per foot and angle, with pull stud (retention knob) references.',
  render: el => renderMachineTapers(el),
  working: 'Included angle = 2 atan(taper per unit length / 2). Values come from published tables, each with its publisher count.',
  source: 'ISO 296:1991 (Morse), ISO 7388-1:2007 and ISO 7388-2:2007 (7/24 shanks), ISO 7388-3:2016 (retention knobs), ISO 12164-1:2023 (HSK), ASME B5.50-2015 (R2025) (CAT), JIS B 6339 (BT, edition not confirmed); publishers listed under the tool.',
},
{
  id: 'fits', group: 'Limits and fits', title: 'ISO limits and fits',
  desc: 'IT grades, fundamental deviations and limits of any hole and shaft tolerance class up to 500 mm (hole basis or shaft basis), with the clearance or interference of the fit.',
  render: el => renderFits(el),
  working: 'See the note under the tool.',
  source: 'ISO 286-1:2010 (with Cor 1:2013) and ISO 286-2:2010; table values from Wikipedia, Ganter, GOST 25346-89, RoyMech, Simply Bearings and OSG (JIS B 0401).',
},
{
  id: 'surface', group: 'Limits and fits', title: 'Surface texture: Ra, N grades and symbols',
  desc: 'Ra in micrometres and microinches with the N grade, why Ra and Rz do not convert, ISO 21920-1 and ISO 1302 drawing symbols in plain words, and typical Ra by process from two publishers.',
  render: el => renderSurface(el),
  working: 'See the notes under the tool. 1 um = 39.37 uin.',
  source: 'ISO 21920-1:2021, ISO 21920-2:2021, ISO 21920-3:2021 (ISO 1302:2002 withdrawn); N grades from CERATIZIT, Werk24, Mechanical-Engineering.com and Engineers Edge; process ranges from Autodesk and Mechanical-Engineering.com.',
},
{
  id: 'hardness', group: 'Limits and fits', title: 'Hardness conversion (steel, approximate)',
  desc: 'Convert between HV, HB, HRC, HRB, HRA and tensile strength for unalloyed and low alloy steels, interpolated between published table rows, with the working shown.',
  render: el => renderHardness(el),
  working: 'Linear interpolation between adjacent rows of the ISO 18265 steel table. See the caveats under the tool.',
  source: 'ISO 18265:2013, ASTM E140-26; table as printed by Optimas and Bossard.',
},
{
  id: 'bolt', group: 'Geometry', title: 'Bolt circle',
  desc: 'X and Y coordinates of equally spaced holes on a circle.',
  fields: s => [
    { id: 'dia', label: 'Bolt circle diameter', unit: lenU(s), def: s === 'inch' ? 4 : 100 },
    { id: 'n', label: 'Number of holes', unit: '', def: 6 },
    { id: 'start', label: 'Start angle', unit: 'deg', def: 0 },
    { id: 'cx', label: 'Center X', unit: lenU(s), def: 0 },
    { id: 'cy', label: 'Center Y', unit: lenU(s), def: 0 },
  ],
  calc: (v, W, s) => {
    if (!(v.dia > 0 && v.n >= 1 && v.n <= 360)) return [];
    const rows = [];
    for (let i = 0; i < v.n; i++) {
      const x = W.bolt_x(v.n, v.dia, v.start || 0, v.cx || 0, v.cy || 0, i);
      const y = W.bolt_y(v.n, v.dia, v.start || 0, v.cx || 0, v.cy || 0, i);
      rows.push(R('Hole ' + (i + 1), 'X ' + x.toFixed(4) + '   Y ' + y.toFixed(4), '', 4));
    }
    return rows;
  },
  working: 'x = cx + (D/2) cos(a0 + 360 i / n), y = cy + (D/2) sin(a0 + 360 i / n). Angles measured counter-clockwise from +X.',
  source: "Machinery's Handbook (hole circles)",
},
{
  id: 'triangle', group: 'Geometry', title: 'Triangle solver',
  desc: 'Right or any triangle from three known sides and angles, including the two-solution case (two sides and an angle that is not between them).',
  render: el => renderTriangle(el),
  working: 'Angles add to 180°. Law of sines: a / sin A = b / sin B = c / sin C. Law of cosines: a² = b² + c² - 2bc cos A. Side-side-angle: sin B = b sin A / a gives no triangle (> 1), one, or two (B and 180° - B, when both leave room for C). Area = ½ ab sin C.',
  source: 'OpenStax, Algebra and Trigonometry 2e, ch. 10 (non-right triangles: law of sines incl. the ambiguous case, law of cosines). See docs/geometry.md.',
},
{
  id: 'arc', group: 'Geometry', title: 'Chord, arc, sagitta and 3-point circle',
  desc: 'Solve an arc from any two of radius, angle, chord, sagitta and arc length; segment and sector areas; centre and radius of the circle through three points.',
  render: el => renderArc(el),
  working: 'Chord = 2R sin(θ/2); arc = Rθ (radians); sagitta = R(1 - cos(θ/2)); R from chord c and sagitta s = (c²/4 + s²) / 2s; segment area = R²/2 (θ - sin θ); sector = R²θ/2. Three points: centre where the perpendicular bisectors of two chords cross.',
  source: 'Plane geometry (OpenStax Algebra and Trigonometry 2e; circle relations). Worked examples checked in core tests. See docs/geometry.md.',
},
{
  id: 'fillet', group: 'Geometry', title: 'Fillet and tangent points',
  desc: 'Tangent points and centre of a fillet in a corner between two lines, or blending a line into an arc, for programming.',
  render: el => renderFillet(el),
  working: 'Corner: tangent distance = r / tan(α/2), centre on the bisector at r / sin(α/2), α the angle between the legs. Line and arc: the fillet centre lies on the line offset by r and on the circle of radius R + r (outside) or R - r (inside) about the arc centre; tangent points are the foot of the perpendicular on the line and the point on the arc in line with both centres.',
  source: 'Plane geometry (BenchMate derivation; tests check each tangent point lies at r from the fillet centre). See docs/geometry.md.',
},
{
  id: 'dovetail', group: 'Geometry', title: 'Dovetail and V-groove over pins',
  desc: 'Measurement over (or between) pins for male and female dovetails, and pin height in a V-groove.',
  render: el => renderDovetail(el),
  working: 'A pin in a corner of angle α touches base and flank; its centre is (d/2) cot(α/2) from the sharp corner along the base. Male: M = W + d (1 + cot(α/2)). Female: M = W - d (1 + cot(α/2)). W from the other face: W = top ∓ 2h cot α. V-groove: pin top above face = (d/2)/sin(β/2) + d/2 - (W/2)/tan(β/2).',
  source: 'Plane geometry (BenchMate derivation, checked in tests by constructing the pin position). See docs/geometry.md.',
},
{
  id: 'cycdrill', group: 'G-code cycles', title: 'Drilling and tapping cycles',
  desc: 'G81, G82, G83, G73 drilling and G84 rigid or floating tapping for a bolt circle, a grid or pasted coordinates. Backplot, cycle time, hole CSV.',
  render: el => renderDrillCycles(el),
  working: 'Holes: bolt circle x = cx + (D/2) cos(a0 + 360 i/n); grid in zigzag rows. Tapping feed per minute = pitch x rpm (feed per rev = lead). Dwell: Fanuc-style P in milliseconds without a decimal point, Haas P in seconds. Time: feed moves at F, rapids at the rapid rate, peck clearance assumed 0.5 mm (0.02 in) because the real value is a control parameter.',
  source: 'Cycle formats: FANUC Series 0i-F Plus Operator\'s Manual B-64694EN-2/01 (canned cycles); Haas Mill Programming Workbook and Haas G84 Tapping guide (haascnc.com); CIMCO CNC programming book ch. 5; makeitfrommetal.com Fanuc canned cycles (dwell P in ms, M29 rigid tapping). See docs/cycles.md.',
},
{
  id: 'cyctmill', group: 'G-code cycles', title: 'Thread milling program',
  desc: 'Helical thread milling program for internal or external, right or left hand threads, climb or conventional, with arc-in and arc-out, optional G41/G42 and several radial passes.',
  render: el => renderThreadMillCycle(el),
  working: 'Tool centre path radius: internal (D - d)/2, external (Dr + d)/2 with Dr the root diameter. Tool centre feed = edge feed x (D - d)/D inside, x (D + d)/D outside. Internal climb milling with M03 runs counter-clockwise (G03); external climb runs clockwise (G02). A right-hand helix rises when it turns counter-clockwise. Lead arcs: 90 degrees, tangent to the thread circle, a quarter pitch of Z each. Feed along the helix = F x sqrt(1 + (P / 2 pi r)^2) if a control applies F in 3D.',
  source: 'Feed adjustment: Harvey Performance (In The Loupe, internal and external adjusted feed, 9/16-18 example) and Travers Tool thread mill speeds and feeds (3/8-16 example). Helical G02/G03 with Z: Haas Mill Programming Workbook, P. Smid CNC Programming Handbook ch. 45. Direction rules: BenchMate derivation, checked in core tests. See docs/cycles.md.',
},
{
  id: 'cycthread', group: 'G-code cycles', title: 'Lathe threading (G76 / G92)',
  desc: 'G76 multi-pass threading or one G92 block per pass, with an infeed table: constant volume, constant depth or your own pass depths, minimum cut, finish allowance and spring passes.',
  render: el => renderLatheThreadCycle(el),
  working: 'Depth: external 0.613435 P (to d3), internal 0.541266 P (5/8 H). Constant volume from the first cut: depth after pass n = d1 sqrt(n), each step at least the minimum cut. Over n passes: depth after pass i = ap sqrt(c_i / (n - 1)), c_1 = 0.3, c_i = i - 1. Fanuc-style G76 two blocks: P(finish passes)(pull-out x 0.1 lead)(tool angle) Q(min cut) R(finish), then X Z P(thread depth) Q(first cut) F(lead); P and Q in the least input increment without a decimal point.',
  source: 'Haas G76 page (haascnc.com: D*sqrt(N), P1-P4); ISCAR threading catalogue (infeed formula and worked example); CTE magazine "Single-point thread programming can be fun and easy" and CIMCO Edit Fanuc turning exercise (G76 two-block format); Haas Factory Outlet lathe programming (G92). See docs/cycles.md.',
},
{
  id: 'cyctaper', group: 'G-code cycles', title: 'Lathe taper program',
  desc: 'Roughing passes that follow the taper, then a finish pass along the cone, external or internal, with CSS and optional nose radius compensation.',
  render: el => renderTaperCycle(el),
  working: 'Each roughing pass cuts to where the cone (plus the finish allowance) meets its diameter, then follows the cone back up so the finish allowance is even. Half angle = atan((D - d) / 2L). Finish enters on the cone extended in front of the part. Time is integrated along each move with the rpm from CSS at that diameter.',
  source: 'Taper geometry: Machinery\'s Handbook (tapers). G96/G97/G50, G41/G42: Haas Factory Outlet lathe programming; CIMCO CNC programming book, appendix D. See docs/cycles.md.',
},
{
  id: 'cycgroove', group: 'G-code cycles', title: 'Groove and cut-off (CSS)',
  desc: 'Groove (several plunges for a wide groove, optional pecking) or cut-off program with constant surface speed, a G50 speed clamp and G97 at the end, plus the cut time with CSS.',
  render: el => renderGrooveCycle(el),
  working: 'n = 1000 Vc / (pi D) (metric) or 12 V / (pi D) (inch), limited to the G50 clamp. Plunge time with CSS from D0 to D1: (D0² - D1²) / (4 f k) with k = 1000 Vc / pi, and below the clamp diameter k / n_max the time is (D/2) / (f n_max).',
  source: 'CSS rpm: Sandvik Coromant turning formulas [SAN]. Time: BenchMate integration of dr / (f n), checked against numerical integration in core tests. G50/G96/G97: Haas Factory Outlet lathe programming; Fanuc G-code system A article (industrialmonitordirect). See docs/cycles.md.',
},
{
  id: 'cycbroach', group: 'G-code cycles', title: 'Keyway broaching program',
  desc: 'Keyway broaching (slotting) strokes on a lathe or a mill with the spindle locked: stroke, depth per stroke, lift on the return stroke and spring strokes.',
  render: el => renderBroachCycle(el),
  working: 'Strokes = depth / depth per stroke (rounded up), then spring strokes at full depth. Each stroke: position, feed along Z to the end, lift off the cut, rapid back. Lathe X is the diameter at the cutting edge; on a mill the spindle centre is offset by the edge distance from the axis.',
  source: 'Plain G00/G01 (G98 feed per minute on the lathe, G94 on the mill): Haas Factory Outlet lathe programming; Haas Mill Programming Workbook. Spindle orientation is machine specific and not output. See docs/cycles.md.',
},
{
  id: 'cycg71', group: 'G-code cycles', title: 'G71 / G70 rough and finish',
  desc: 'G71 roughing and G70 finishing from a simple profile of points (straight lines, no undercuts), outside or inside, Fanuc-style two-block or Haas one-block format.',
  render: el => renderG71Cycle(el),
  working: 'Fanuc-style: G71 U(depth) R(retract); G71 P Q U(X allowance on diameter) W F. Haas: G71 P Q U W D(depth) F. The profile blocks carry the finish feed for G70. Type I needs a profile that only grows (outside) or shrinks (inside) toward the chuck. The backplot and time use BenchMate\'s model of the roughing passes.',
  source: 'NPTEL Module 7 CNC programming (G71/G70 parameters); industrialmonitordirect Fanuc G71 parameter reference; Haas Factory Outlet lathe programming (one-block G71 D, G70). See docs/cycles.md.',
},
{
  id: 'gmcodes', group: 'G-code reference', title: 'G and M codes',
  desc: 'G and M codes per control: generic ISO 6983 / RS-274, Fanuc (lathe systems A/B/C), Haas, Mitsubishi M70/M80 and MELDAS 60, Siemens 840D native and ISO mode, Heidenhain DIN/ISO, Okuma OSP and Mazak EIA/ISO. Search by code or word, filter mill or lathe, compare two controls side by side. Every row shows its source.',
  render: el => renderGmCodes(el),
  working: 'Nothing is calculated. A code is listed for a control only when the maker\'s (or machine builder\'s) public document prints it, or two independent public sources agree; otherwise it shows as not confirmed for that control. Meanings are BenchMate\'s own short wording. The default control comes from the active machine profile. The same number can mean different things on different controls (G70 is a lathe finishing cycle on Fanuc, a bolt circle on a Haas mill and inch mode on Siemens): always check your machine\'s own manual.',
  source: 'NIST RS274NGC v3 (NISTIR 6556, public domain); ISO 6983-1:2009 cited by name; LinuxCNC docs; FANUC 0i-F and 0i-F Plus manuals; Haas operator manual, mill workbook, lathe card and Haas Factory Outlet lathe manual; Mitsubishi M70L manual, MELDAS 60 manual and training texts; Siemens SINUMERIK G/M handbook and ISO Milling manual; HEIDENHAIN TNC 320 ISO manual; Okuma OSP-P200L manual; Mazak EIA/ISO turning manual. Full list under the table and in docs/gm-codes.md.',
},
{
  id: 'macroref', group: 'G-code reference', title: 'Macro reference',
  desc: 'Macro and parameter programming per control: Fanuc Custom Macro B variables and IF / WHILE, Haas macros, Siemens R parameters and control structures, Heidenhain Q-parameter jumps, Okuma VC variables and IF branches, with sources and the places where sources disagree.',
  render: el => renderMacroRef(el),
  working: 'Nothing is calculated. Statements are in BenchMate\'s own words with the source section beside each. Variable ranges and system variable numbers depend on the control model, its options and the machine builder: check your manual before writing to any variable.',
  source: 'Tornos B Macro guide (2017); CNCCookbook; Haas Macro Programming Information (2017); Siemens SINUMERIK Job Planning manual (03/2013) and ISO Milling manual; HEIDENHAIN TNC 426 B ISO manual; ICAM pre-processor syntax pages; Okuma OSP-P200L manual and Okuma America blog. See docs/gm-codes.md.',
},
{
  id: 'dxfbolt', group: 'CAD / DXF', title: 'Bolt circle DXF',
  desc: 'Equally spaced holes on a circle, with an optional outside diameter and centre bore, as a DXF file for CAM. Live preview with overall size and hole positions.',
  render: el => renderDxf(el, 'dxfbolt'),
  working: DXF_NOTE + ' Hole positions: x = (D/2) cos(a0 + 360 i / n), y = (D/2) sin(a0 + 360 i / n), the same function as the Bolt circle calculator.',
  source: DXF_SOURCE + " Hole circles: Machinery's Handbook.",
},
{
  id: 'dxfgrid', group: 'CAD / DXF', title: 'Hole grid (rectangular pattern) DXF',
  desc: 'A rectangular grid of holes at a pitch in X and Y, optionally on a plate with a margin and corner radius, as a DXF file.',
  render: el => renderDxf(el, 'dxfgrid'),
  working: DXF_NOTE + ' The grid is centred on the origin (or put at the lower-left corner with the origin option). Plate size = (columns - 1) x pitch X + 2 x margin, by (rows - 1) x pitch Y + 2 x margin.',
  source: DXF_SOURCE,
},
{
  id: 'dxfslot', group: 'CAD / DXF', title: 'Slot DXF (straight and arc)',
  desc: 'A straight slot from its centre distance and width, at any angle, or an arc slot on a centreline radius with start and sweep angles, as one closed outline.',
  render: el => renderDxf(el, 'dxfslot'),
  working: DXF_NOTE + ' Straight slot: two straight sides and two half-circle ends (bulge 1); overall length = centre distance + width. Arc slot: outer arc (R + w/2) and inner arc (R - w/2) with bulge tan(sweep / 4), joined by half-circle ends.',
  source: DXF_SOURCE,
},
{
  id: 'dxfrect', group: 'CAD / DXF', title: 'Rectangle with corner radii DXF',
  desc: 'A rectangular plate with an optional corner radius and four corner holes at an inset from the edges, as a DXF file.',
  render: el => renderDxf(el, 'dxfrect'),
  working: DXF_NOTE + ' Corner arcs are 90° polyline arcs (bulge tan 22.5° = 0.414214). Corner holes are checked against the edges and the corner radius.',
  source: DXF_SOURCE,
},
{
  id: 'dxfpoly', group: 'CAD / DXF', title: 'Polygon (hex, square, n sides) DXF',
  desc: 'A regular polygon of any number of sides from its size across flats or across corners, with rotation and an optional centre bore, as a DXF file. Shows across corners, across flats and side length.',
  render: el => renderDxf(el, 'dxfpoly'),
  working: DXF_NOTE + ' Across corners = 2R; across flats = 2R cos(180°/n) (even n); for odd n the flat-to-opposite-corner size is R (1 + cos(180°/n)); side = 2R sin(180°/n); area = n R² sin(360°/n) / 2.',
  source: DXF_SOURCE + " Regular polygons: Machinery's Handbook.",
},
{
  id: 'dxfring', group: 'CAD / DXF', title: 'Circle and ring (washer) DXF',
  desc: 'A disc or a ring (washer, spacer) from its outside and inside diameters, as a DXF file.',
  render: el => renderDxf(el, 'dxfring'),
  working: DXF_NOTE,
  source: DXF_SOURCE,
},
{
  id: 'dxfprofile', group: 'CAD / DXF', title: 'Keyhole, D-flat and double-D DXF',
  desc: 'Simple profiles as one closed outline: a keyhole (head circle and slot), a D-flat (a circle with one flat) and a double-D (two parallel flats), with rotation.',
  render: el => renderDxf(el, 'dxfprofile'),
  working: DXF_NOTE + ' Keyhole: the slot sides meet the head circle at y = -sqrt(R² - (w/2)²). D-flat: the flat is at A - R from the centre (A = across flat). Double-D: flats at ±A/2. The arcs are polyline arcs with bulge tan(included angle / 4).',
  source: DXF_SOURCE,
},
{
  id: 'gdtguide', group: 'GD&T', title: 'GD&T reference guide',
  desc: 'Datums, Rule #1 versus ISO independency, every geometric characteristic with its tolerance zone, inspection and common mistakes, modifiers, and an ASME Y14.5-2018 / ISO comparison.',
  render: el => renderGdtGuide(el),
  working: 'Reference only. Your drawing\'s standard and edition govern. Source keys next to each rule resolve to the list at the bottom; statements marked "to be verified" were not confirmed in two independent public sources.',
  source: 'ASME Y14.5-2018 (R2024); ISO 1101:2017, ISO 5459:2024, ISO 2692:2021, ISO 8015:2011, ISO 22081:2021 (cited by name only). Public explanations from Mitutoyo, KEYENCE, Geometric Learning Systems, GD&T Basics, University of Illinois ME 170 notes, Humienny and Zdrojewski (2023) and others: see docs/gdt.md.',
},
{
  id: 'gdtfcf', group: 'GD&T', title: 'Feature control frame builder',
  desc: 'Build a feature control frame, see it drawn, read it in plain English, and get a warning for combinations that are invalid or doubtful.',
  render: el => renderFcfBuilder(el),
  working: 'The checks cover the common rules (datums on form tolerances, MMC on surfaces, runout at MMC, diameter zones, modifier use, datum order). They are not a full standards review.',
  source: 'Rules as confirmed in docs/gdt.md (Geometric Learning Systems Y14.5-2018 chart, GD&T Basics, KEYENCE, University of Illinois ME 170 notes, Mitutoyo, Skill-Lync).',
},
{
  id: 'gdttp', group: 'GD&T', title: 'True position check',
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
  id: 'gdtbonus', group: 'GD&T', title: 'Bonus, virtual and resultant condition',
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
  id: 'gdtconv', group: 'GD&T', title: 'Position and plus/minus conversion',
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
  id: 'gdtfast', group: 'GD&T', title: 'Fastener position tolerance',
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
  id: 'gdtcomp', group: 'GD&T', title: 'Composite position checker',
  desc: 'Check a hole pattern against a composite position frame: the upper row (PLTZF) locates each hole to the datums, the lower row (FRTZF) relates the holes to each other after the best allowed shift (and rotation) of the whole group.',
  render: el => renderComposite(el),
  working: 'Upper row: each hole, diameter = 2 x sqrt(dX^2 + dY^2) from its basic location, must be within the upper tolerance plus its bonus. Lower row: BenchMate finds the shift (and, with only the primary datum in the lower row, the small rotation) of the group of lower-row zones that minimises the worst hole, max over holes of (2 x distance to its moved zone centre - bonus), and compares it with the lower tolerance. The minimisation is exact for this convex problem (nested golden-section search, checked against grid searches in the tests). Perpendicularity to datum A (the orientation the lower row also controls) is not checked here: measure it separately. Datum feature shift is not included.',
  source: 'FARO (O. Ekinci) and 3DCS help on composite position; GD&T Basics (composite vs multiple single-segment). Standard: ASME Y14.5-2018 (composite positional tolerancing, cited only). See docs/gdt.md.',
},
{
  id: 'gdtprofu', group: 'GD&T', title: 'Unequal profile (U) zone',
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
  id: 'gdtdof', group: 'GD&T', title: 'Datum reference frame and degrees of freedom',
  desc: 'Step through a three-plane datum reference frame and see which of the six degrees of freedom each datum removes.',
  render: el => renderDof(el),
  working: 'Primary plane A: three or more contact points, removes Tz, Rx, Ry. Secondary plane B, square to A: two or more points, removes Tx, Rz. Tertiary plane C, square to both: one or more point, removes Ty.',
  source: 'GD&T Basics (datums and degrees of freedom); CNCCookbook (3-2-1); University of Illinois ME 170 notes (datum order). Axis assignment: BenchMate geometry. See docs/gdt.md.',
},
{
  id: 'gdtstack', group: 'GD&T', title: 'Tolerance stack (worst case and RSS)',
  desc: 'One-dimensional stack of up to 10 dimensions: gap at nominal and mean, worst-case and root-sum-square (RSS) limits.',
  render: el => renderStack(el),
  working: 'Each dimension is centred on its mean, nominal + (plus - minus) / 2, with half tolerance (plus + minus) / 2. Gap = sum of (+/-) means. Worst case = sum of half tolerances. RSS = sqrt(sum of squared half tolerances), which assumes independent, normally distributed dimensions centred in their tolerance and made at the same capability (each half tolerance = 3 sigma). Use RSS only where that is true; otherwise use worst case. Geometric tolerances (position, profile) enter a stack as plus/minus half their zone.',
  source: 'Accendo Reliability (F. Schenkelberg) and Five Flute RSS tolerance analysis guides; BenchMate arithmetic with tests in core/src/gdt.rs.',
},
{
  id: 'weight', group: 'Stock and sheet metal', title: 'Stock weight',
  desc: 'Weight of round, hex, square, tube, flat bar, plate and sheet stock, per piece, per batch and per metre or foot.',
  render: el => renderWeight(el),
  working: 'Weight = section area x length x density. Round πd²/4; hex (√3/2)s² across flats s; square s²; tube π/4 (D² - (D - 2t)²); flat, plate or sheet width x thickness. Sharp corners assumed (no corner radii on hex, square or flat).',
  source: 'Areas of plane figures; densities from the material data where Confirmed, else from your data sheet. See docs/geometry.md.',
},
{
  id: 'bend', group: 'Stock and sheet metal', title: 'Sheet-metal bend allowance',
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
    } else rows.push(R('K-factor needed: from your press brake tooling chart or a test bend', 'not entered', '', 0));
    if (v.ba > 0) rows.push(R('K-factor from the measured bend allowance', W.k_from_bend_allowance(v.a, v.r, v.t, v.ba), '', 3));
    return rows;
  },
  working: 'Bend allowance BA = angle (radians) x (R + K t): the length of the neutral axis through the bend. Outside setback OSSB = tan(angle/2) x (R + t). Bend deduction BD = 2 OSSB - BA. Flat length = sum of flanges to the outside mould lines - BD per bend. K = (BA / angle - R) / t. K depends on material, thickness, radius and tooling; BenchMate has no default. Flanges are measured to the virtual sharp; for bends over 90° some CAD systems measure flanges differently, so check which convention your drawing uses.',
  source: 'KETIV Technologies, Sheet metal unfold rule equations (BA, OSSB, BD, K); Aircraft Systems Tech, Making straight line bends (FAA-based: bend allowance, setback = K(R + T) with K = 1 at 90°, flat = mould line dimensions - setbacks + bend allowances). See docs/geometry.md.',
},
{
  id: 'capability', group: 'Inspection and quality', title: 'Process capability (Cp, Cpk, Pp, Ppk)',
  desc: 'Paste measurements (in production order) or enter a mean and sigma. Gives Cp, Cpk, Pp, Ppk, expected parts per million out of spec and a histogram with the fitted normal curve.',
  render: el => renderCapability(el),
  working: 'Cp = (USL - LSL) / 6 sigma; Cpk = min((USL - mean) / 3 sigma, (mean - LSL) / 3 sigma); one-sided: only the index for the limit given. Cp and Cpk use the within (short-term) sigma: average moving range / d2 (d2 = 1.128 for ranges of two consecutive values), or for subgroups of k consecutive values the mean range / d2(k). Pp and Ppk use the same formulas with the overall sample standard deviation (divisor n - 1). Expected ppm: normal tail areas beyond each limit. Histogram bins: Sturges (ceil(log2 n) + 1).',
  source: 'NIST/SEMATECH e-Handbook of Statistical Methods, 6.1.6 (capability indices, ppm table, ~50 values) and 6.3.2 (d2) (public domain); Minitab support, methods and formulas for normal capability analysis (within and overall sigma). Pp/Ppk as the same formulas on the overall sigma: one source read, to be verified. Normal tail: Numerical Recipes erfc. See docs/shop-helpers.md.',
},
{
  id: 'tempcomp', group: 'Inspection and quality', title: 'Temperature compensation',
  desc: 'Correct a measurement taken away from the 20 °C (68 °F) reference temperature to the length at 20 °C, allowing for both the part and the gauge expanding.',
  render: el => renderTempComp(el),
  working: 'L20 = reading x (1 + a_gauge x (T_gauge - 20)) / (1 + a_part x (T_part - 20)), temperatures in °C, a in 1/K. The gauge graduations grow with its temperature; the part grows with its own. Inverse for the reading a to-size part gives. Coefficient uncertainty: L x u(a) x |T_part - 20|.',
  source: 'ISO 1:2022 (reference temperature 20 °C, cited only); T. Doiron, J. Res. NIST 112(1), 2007 (history and use of 20 °C); expansion formula dL = L a dT. See docs/shop-helpers.md.',
},
{
  id: 'coolconc', group: 'Shop helpers', title: 'Coolant concentration (refractometer)',
  desc: 'Concentration of a water-miscible coolant from the refractometer reading and the fluid\'s refractometer factor.',
  fields: s => [
    { id: 'brix', label: 'Refractometer reading', unit: '°Brix', def: '' },
    { id: 'k', label: 'Refractometer factor (from the fluid data sheet)', unit: 'x', def: '' },
    { id: 'lo', label: 'Recommended range, low (optional)', unit: '%', def: '' },
    { id: 'hi', label: 'Recommended range, high (optional)', unit: '%', def: '' },
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
  id: 'coolmix', group: 'Shop helpers', title: 'Coolant mix and top-up',
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
  id: 'fraction', group: 'Shop helpers', title: 'Fraction, decimal and mm',
  desc: 'Convert fractions, decimal inches and millimetres; nearest fraction (to 1/64 or another denominator) and the error.',
  render: el => renderFraction(el),
  working: '1 in = 25.4 mm exactly. Nearest fraction: numerator = round(value x denominator), then reduced by the greatest common divisor. Error = value - fraction.',
  source: 'NIST SP 811, appendix B: inch = 0.0254 m exactly (1959 definition). See docs/shop-helpers.md.',
},
{
  id: 'machines', group: 'Setup', title: 'Machine profiles',
  desc: 'Add your machines once. The active machine (top bar) is used to check every result: spindle speed range, power (with the torque curve at low speed), live tool speed and max feed.',
  render: el => renderMachines(el),
  working: 'Power available at speed n: P(n) = min(P_max, T_max x 2 pi n / 60 000). Constant torque below base speed, constant power above it.',
  source: 'Standard spindle power/torque characteristic [SAN]. Machine limits come from the builder\'s spec sheet or manual.',
},
{
  id: 'toollib', group: 'Setup', title: 'Tool library',
  desc: 'Save your end mills, drills, taps, reamers and inserts once: type, diameter, flutes, flute length, overall length, stick-out, corner radius, material and coating, maker and part number. Then fill them into the speed, feed, cut, deflection, helix, drill point, tap drill and finish calculators. Saved in this browser; export and import as a JSON file.',
  render: el => renderToolLibrary(el),
  working: "Nothing is calculated here. Each tool keeps the units it was entered in; when it is filled into a calculator set to the other units, lengths are converted with 1 in = 25.4 mm (exact). A tap's pitch is mm for a metric tool and TPI for an inch tool. Import adds new tools and skips tools that are already in the library; it never overwrites one. Only a tool marked Solid carbide sets the carbide E preset in the deflection screens; other materials leave E as it is.",
  source: 'BenchMate design. Inch definition: NIST SP 811, appendix B.',
},
{
  id: 'setupsheet', group: 'Setup', title: 'Setup sheet',
  desc: 'A printable setup sheet: job, machine, tool list with stick-out and offsets, work offsets and notes. Saved in this browser; export and import as JSON.',
  render: el => renderSetupSheet(el),
  working: 'Nothing is calculated here. Sheets are kept in this browser (localStorage) and can be moved by exporting a JSON file. Print uses a print layout without the app frame.',
  source: 'BenchMate layout.',
},
{
  id: 'sinebar', group: 'Setup', title: 'Sine bar and gauge-block stack',
  desc: 'Gauge-block height for a sine bar angle (or the angle from a stack) and the stack with the fewest blocks from a standard or your own block set.',
  render: el => renderSineBar(el),
  working: 'H = L sin(angle); angle = asin(H / L), L the centre distance of the rolls. Stack: an exact search for the fewest blocks (each block used once) that add up to the size, in steps of the set\'s finest block (0.0005 mm or 0.00005 in).',
  source: 'Set compositions as printed by Mitutoyo (via Cutwel and Transcat), Starrett and Insize; see docs/geometry.md. Sine relation: right-triangle trigonometry.',
},
{
  id: 'indexing', group: 'Setup', title: 'Dividing head and rotary table indexing',
  desc: 'Simple, angular and differential indexing with your own index plate hole circles and change gears.',
  render: el => renderIndexing(el),
  working: 'Simple: crank turns per division = ratio / N (ratio 40 on most dividing heads); the fraction must come out exactly on a hole circle. Angle: turns = ratio x angle / 360°. Differential: index as if for a nearby A\' that the plates can do, and gear the plate to the spindle with ratio x (A\' - N) / A\'; idlers: with A\' above N use 1 or 3 in a simple train, below N none or 2; a compound train reverses this.',
  source: 'US Navy Machinery Repairman training manual, ch. 7 Indexing (differential indexing ratio and idlers; public domain). Plates and gears are never defaulted: enter your own. See docs/geometry.md.',
},
{
  id: 'materials', group: 'Materials', title: 'Material equivalents',
  desc: 'Find comparable grades for steels, aluminium, copper alloys, titanium, nickel alloys and cast irons across US, European, UK, Japanese and Chinese systems. Every value shows how many independent publishers print it, and you can see exactly what each source says.',
  render: el => renderMaterials(el),
  working: 'Equivalents are comparable grades, not identical: chemistry and properties differ between standards. Check the actual standard or mill certificate before substituting.',
  source: 'Listed under the table and in docs/sources.md. Confirmed = two or more independent publishers agree on the key designation and none disagree with equal support.',
},
];
