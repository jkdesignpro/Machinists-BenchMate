// Tool registry. Each tool: id, group, title, desc, fields(sys) -> [{id,label,unit,def}],
// calc(v, W, sys) -> [{label,value,unit,dp}], working (string), source (string).
// `W` is the Rust (WebAssembly) formula module; no formulas are duplicated in JS.
const R = (label, value, unit, dp = 3, chk, extra) => Object.assign({ label, value, unit, dp, chk }, extra || {});
const lenU = s => (s === 'inch' ? 'in' : 'mm');
const spdU = s => (s === 'inch' ? 'SFM' : 'm/min');
const feedRevU = s => (s === 'inch' ? 'in/rev' : 'mm/rev');
const feedMinU = s => (s === 'inch' ? 'in/min' : 'mm/min');

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
