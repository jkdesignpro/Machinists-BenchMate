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

const TOOLS = [
{
  id: 'rpm', group: 'Speeds and feeds', title: 'Spindle speed',
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
  id: 'finish', group: 'Turning', title: 'Surface finish from nose radius',
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
  id: 'drillpoint', group: 'Drilling and tapping', title: 'Drill point length',
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
  id: 'fits', group: 'Limits and fits', title: 'ISO limits and fits',
  desc: 'IT grades, fundamental deviations and limits of any hole and shaft tolerance class up to 500 mm (hole basis or shaft basis), with the clearance or interference of the fit.',
  render: el => renderFits(el),
  working: 'See the note under the tool.',
  source: 'ISO 286-1:2010 (with Cor 1:2013) and ISO 286-2:2010; table values from Wikipedia, Ganter, GOST 25346-89, RoyMech, Simply Bearings and OSG (JIS B 0401).',
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
  id: 'machines', group: 'Setup', title: 'Machine profiles',
  desc: 'Add your machines once. The active machine (top bar) is used to check every result: spindle speed range, power (with the torque curve at low speed), live tool speed and max feed.',
  render: el => renderMachines(el),
  working: 'Power available at speed n: P(n) = min(P_max, T_max x 2 pi n / 60 000). Constant torque below base speed, constant power above it.',
  source: 'Standard spindle power/torque characteristic [SAN]. Machine limits come from the builder\'s spec sheet or manual.',
},
{
  id: 'materials', group: 'Materials', title: 'Material equivalents',
  desc: 'Find comparable grades for steels, aluminium, copper alloys, titanium, nickel alloys and cast irons across US, European, UK, Japanese and Chinese systems. Every value shows how many independent publishers print it, and you can see exactly what each source says.',
  render: el => renderMaterials(el),
  working: 'Equivalents are comparable grades, not identical: chemistry and properties differ between standards. Check the actual standard or mill certificate before substituting.',
  source: 'Listed under the table and in docs/sources.md. Confirmed = two or more independent publishers agree on the key designation and none disagree with equal support.',
},
];
