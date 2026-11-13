'use strict';
// Cutting force tools (0.3.0): specific cutting force, drill thrust and torque, tap torque,
// chip thickness with an entering angle or a round insert, slender part deflection.
// Data tables here are as printed by each publisher (docs/sources.md, "Cutting forces").
// Every formula is in the Rust core (core/src/cutforce.rs); this file only converts units.

// Iscar, "Materials and grades" (after DIN / ISO 513 and VDI 3323):
// [group, ISO class, material, condition, strength or hardness as printed, kc1.1 N/mm2, mc (null: not printed)]
const KC_GROUPS = [
  [1, 'P', 'Non-alloy steel, under 0.25 % C', 'annealed', '420 N/mm2, 125 HB', 1350, 0.21],
  [2, 'P', 'Non-alloy steel, 0.25 % C or more', 'annealed', '650 N/mm2, 190 HB', 1500, 0.22],
  [3, 'P', 'Non-alloy steel, under 0.55 % C', 'quenched and tempered', '850 N/mm2, 250 HB', 1675, 0.24],
  [4, 'P', 'Non-alloy steel, 0.55 % C or more', 'annealed', '750 N/mm2, 220 HB', 1700, 0.24],
  [5, 'P', 'Non-alloy steel, 0.55 % C or more', 'quenched and tempered', '1000 N/mm2, 300 HB', 1900, 0.24],
  [6, 'P', 'Low alloy steel', 'annealed', '600 N/mm2, 200 HB', 1775, 0.24],
  [7, 'P', 'Low alloy steel', 'quenched and tempered', '930 N/mm2, 275 HB', 1675, 0.24],
  [8, 'P', 'Low alloy steel', 'quenched and tempered', '1000 N/mm2, 300 HB', 1725, 0.24],
  [9, 'P', 'Low alloy steel', 'quenched and tempered', '1200 N/mm2, 350 HB', 1800, 0.24],
  [10, 'P', 'High alloy steel, cast steel, tool steel', 'annealed', '680 N/mm2, 200 HB', 2450, 0.23],
  [11, 'P', 'High alloy steel, cast steel, tool steel', 'quenched and tempered', '1100 N/mm2, 325 HB', 2500, 0.23],
  [12, 'M', 'Stainless steel', 'ferritic or martensitic', '680 N/mm2, 200 HB', 1875, 0.21],
  [13, 'M', 'Stainless steel', 'martensitic', '820 N/mm2, 240 HB', 1875, 0.21],
  [14, 'M', 'Stainless steel', 'austenitic or duplex', '600 N/mm2, 180 HB', 2150, 0.20],
  [15, 'K', 'Grey cast iron', 'ferritic or pearlitic', '180 HB', 1150, 0.20],
  [16, 'K', 'Grey cast iron', 'pearlitic', '260 HB', 1350, 0.28],
  [17, 'K', 'Nodular cast iron', 'ferritic', '160 HB', 1225, 0.25],
  [18, 'K', 'Nodular cast iron', 'pearlitic', '250 HB', 1350, 0.28],
  [19, 'K', 'Malleable cast iron', 'ferritic', '130 HB', 1225, 0.25],
  [20, 'K', 'Malleable cast iron', 'pearlitic', '230 HB', 1420, 0.30],
  [21, 'N', 'Wrought aluminium alloy', 'not hardenable', '60 HB', 700, 0.25],
  [22, 'N', 'Wrought aluminium alloy', 'hardenable', '100 HB', 800, 0.25],
  [23, 'N', 'Cast aluminium, 12 % Si or less', 'not hardenable', '75 HB', 700, 0.25],
  [24, 'N', 'Cast aluminium, 12 % Si or less', 'hardenable', '90 HB', 700, 0.25],
  [25, 'N', 'Cast aluminium, over 12 % Si', 'high temperature', '130 HB', 750, 0.25],
  [26, 'N', 'Copper alloy, over 1 % Pb', 'free cutting', '110 HB', 700, 0.27],
  [27, 'N', 'Brass', '', '90 HB', 700, 0.27],
  [28, 'N', 'Electrolytic copper', '', '100 HB', 700, 0.27],
  [31, 'S', 'High temperature alloy, iron based', 'annealed', '200 HB', 2600, 0.24],
  [32, 'S', 'High temperature alloy, iron based', 'hardened', '280 HB', 3100, 0.24],
  [33, 'S', 'High temperature alloy, nickel or cobalt based', 'annealed', '250 HB', 3300, 0.24],
  [34, 'S', 'High temperature alloy, nickel or cobalt based', 'hardened', '350 HB', 3300, 0.24],
  [35, 'S', 'High temperature alloy, nickel or cobalt based', 'cast', '320 HB', 3300, 0.24],
  [36, 'S', 'Titanium, pure', '', 'Rm 400 N/mm2', 1700, 0.23],
  [37, 'S', 'Titanium, alpha + beta alloys', 'hardened', 'Rm 1050 N/mm2', 2110, 0.22],
  [38, 'H', 'Hardened steel', 'hardened', '55 HRC', 4600, null],
  [39, 'H', 'Hardened steel', 'hardened', '60 HRC', 4700, null],
  [40, 'H', 'Chilled cast iron', 'cast', '400 HB', 4600, null],
  [41, 'H', 'Cast iron', 'hardened', '55 HRC', 4500, null],
];
const kcGroup = no => KC_GROUPS.find(g => g[0] === no);
const kcGroupName = g => g[1] + g[0] + ': ' + g[2] + (g[3] ? ', ' + g[3] : '') + ' (' + g[4] + ')';
const kcGroupOptions = own => (own ? [[0, 'Other: type kc yourself']] : []).concat(KC_GROUPS.map(g => [g[0], kcGroupName(g)]));

// What two other publishers print for a similar material, shown beside the Iscar figure and never mixed into it.
// Sandvik Coromant values are those listed in Wikipedia, "Cutting force (machining)", which says they were collected
// from Sandvik Coromant manuals. Mitsubishi Materials prints kc against the feed per tooth, 0.1 to 0.6 mm.
const KC_SAN = {
  lowc: 'Sandvik Coromant (as listed on Wikipedia), unalloyed steel under 0.55 % C: kc1 1500 N/mm2, mc 0.25',
  highc: 'Sandvik Coromant (as listed on Wikipedia), unalloyed steel over 0.55 % C: kc1 1700 N/mm2, mc 0.25',
  lowalloy: 'Sandvik Coromant (as listed on Wikipedia), low-alloy steel, not hardened: kc1 1700 N/mm2, mc 0.25',
  tool: 'Sandvik Coromant (as listed on Wikipedia), high-alloy and tool steel: kc1 2900 N/mm2, mc 0.25',
  stainless: 'Sandvik Coromant (as listed on Wikipedia), stainless steel: kc1 2800 N/mm2, mc 0.21',
  grey: 'Sandvik Coromant (as listed on Wikipedia), grey cast iron: kc1 1100 N/mm2, mc 0.28',
  alu: 'Sandvik Coromant (as listed on Wikipedia), aluminium over 99 % Al: kc1 350 N/mm2, mc 0.25',
  ti: 'Sandvik Coromant (as listed on Wikipedia), titanium over 99 % Ti: kc1 1300 N/mm2, mc 0.23',
};
const kcMit = (name, a) => 'Mitsubishi Materials, ' + name + ': kc ' + a.join(', ') + ' N/mm2 at 0.1, 0.2, 0.3, 0.4, 0.6 mm per tooth';
const KC_MIT = {
  mild: kcMit('mild steel 520 MPa', [2200, 1950, 1820, 1700, 1580]),
  medium: kcMit('medium steel 620 MPa', [1980, 1800, 1730, 1600, 1570]),
  hard: kcMit('hard steel 720 MPa', [2520, 2200, 2040, 1850, 1740]),
  tool: kcMit('tool steel 670 MPa', [1980, 1800, 1730, 1700, 1600]),
  crmo: kcMit('chrome molybdenum steel 730 MPa', [2540, 2250, 2140, 2000, 1800]),
  nicrmo: kcMit('nickel chrome molybdenum steel 940 MPa', [2000, 1800, 1680, 1600, 1500]),
  aust: kcMit('austenitic stainless steel 155 HB', [2030, 1970, 1900, 1770, 1710]),
  grey: kcMit('grey cast iron 200 HB', [1750, 1400, 1240, 1050, 970]),
  brass: kcMit('brass 500 MPa', [1150, 950, 800, 700, 630]),
  almg: kcMit('light alloy Al-Mg 160 MPa', [580, 480, 400, 350, 320]),
  alsi: kcMit('light alloy Al-Si 200 MPa', [700, 600, 490, 450, 390]),
  alzn: kcMit('light alloy Al-Zn-Mg-Cu 570 MPa', [880, 840, 840, 810, 720]),
};
const KC_OTHER = {
  1: [KC_SAN.lowc, KC_MIT.mild], 2: [KC_SAN.lowc, KC_MIT.medium], 3: [KC_SAN.lowc], 4: [KC_SAN.highc, KC_MIT.hard], 5: [KC_SAN.highc],
  6: [KC_SAN.lowalloy, KC_MIT.crmo], 7: [KC_MIT.nicrmo], 10: [KC_SAN.tool, KC_MIT.tool],
  12: [KC_SAN.stainless], 13: [KC_SAN.stainless], 14: [KC_SAN.stainless, KC_MIT.aust],
  15: [KC_SAN.grey, KC_MIT.grey], 16: [KC_SAN.grey],
  21: [KC_SAN.alu, KC_MIT.almg], 22: [KC_MIT.alzn], 23: [KC_MIT.alsi], 27: [KC_MIT.brass], 36: [KC_SAN.ti],
};

// Lubero, "Calculation formulas: tapping and thread forming": kc for the tap torque formula. [id, material, Rm as printed, kc N/mm2]
const TAP_KC = [
  [1, 'Unalloyed structural steel', 'up to 700 N/mm2', 2300], [2, 'Free-cutting steel', 'up to 700 N/mm2', 2300],
  [3, 'Structural steel', '500 to 950 N/mm2', 2500], [4, 'Quenched and tempered steel, medium strength', '500 to 950 N/mm2', 2600],
  [5, 'Nitriding steel, quenched and tempered', '950 to 1400 N/mm2', 3600], [6, 'Tool steel', '950 to 1400 N/mm2', 3600],
  [7, 'Austenitic stainless and acid-resistant steel', '500 to 950 N/mm2', 3200],
  [8, 'Aluminium alloys, long-chipping', 'up to 550 N/mm2', 800], [9, 'Aluminium alloys, short-chipping', 'up to 400 N/mm2', 680],
  [10, 'Copper alloys, long-chipping', '300 to 700 N/mm2', 1100], [11, 'Copper alloys, short-chipping', 'up to 500 N/mm2', 720],
  [12, 'Grey cast iron', '120 to 260 HB', 1250], [13, 'Alloyed grey cast iron', '160 to 230 HB', 1600], [14, 'Malleable cast iron', '150 to 280 HB', 1100],
];
// Yamawa, European catalogue YEU21, p. 644: deforming resistance Kf for forming taps. [id, material, low, high N/mm2]
const TAP_KF = [
  [1, 'General structural and low carbon steels', 750, 850], [2, 'Medium carbon and alloy steels', 1150, 1350], [3, 'Stainless steels', 1100, 1300],
  [4, 'Wrought aluminium', 250, 350], [5, 'Aluminium die castings', 380, 530], [6, 'Copper and wrought copper alloys', 750, 1050],
];
// Young's modulus of the part, from the BenchMate material data (docs/material-sources.md).
const WORK_E = {
  1: { gpa: 210, name: 'Steel', src: 'Ovako, 4140 / 42CrMo4' },
  2: { gpa: 193, name: 'Stainless steel 304 / 316', src: 'Aalco and Atlas Steels; Outokumpu prints 200' },
  3: { gpa: 70, name: 'Aluminium 6082', src: 'Aalco; MakeItFrom prints 69' },
  4: { gpa: 97, name: 'Brass CW614N (CZ121)', src: 'Aalco' },
  5: { gpa: 110, name: 'Titanium Ti-6Al-4V', src: 'MakeItFrom; TIMET prints 107 to 122, Aerospace Metals 113.8' },
};
const NM_LBFIN = 1000 / (LBF_N * IN_MM); // 1 N m = 8.8507 lbf in (exact definitions of the inch and the pound-force)
const cfNote = t => R('<span class="warn">' + t + '</span>', '', '');
// kc from a material group at chip thickness h (mm), or the typed value. Returns { kc, rows } or null.
function cfKc(v, W, h, sys) {
  if (v.kc > 0) return { kc: v.kc, rows: [R('Specific cutting force kc (as entered)', v.kc, 'N/mm2', 0)] };
  const g = kcGroup(v.grp);
  if (!g) return null;
  const kc = W.kienzle_kc(g[5], g[6] == null ? 0 : g[6], h);
  if (!isFinite(kc)) return null;
  const rows = [R('Specific cutting force kc at this chip thickness', kc, 'N/mm2', 0),
    R('Chip thickness used', sys === 'inch' ? h / IN_MM : h, lenU(sys), sys === 'inch' ? 5 : 3),
    R('kc1.1 and mc (Iscar, group ' + g[0] + ')', g[5] + ' N/mm2, mc ' + (g[6] == null ? 'not printed: kc1.1 used unchanged' : g[6]), '', 0)];
  return { kc, rows };
}

TOOLS.push(
{
  id: 'kcforce', level: 'advanced', group: 'Speeds and feeds', title: 'Specific cutting force (kc)',
  desc: 'The force needed to cut one square millimetre of chip in a work material, at the chip thickness of your cut. It is the number the power, torque and deflection tools ask for. One publisher\'s table by material group, with what two other publishers print beside it.',
  fields: s => [
    { id: 'grp', label: 'Work material (VDI 3323 group)', unit: '', def: 2, options: kcGroupOptions(false) },
    { id: 'op', label: 'Chip thickness from', unit: '', def: 1, options: [[1, 'Turning or boring: feed and entering angle'], [3, 'Drilling: feed and point angle'], [2, 'A chip thickness you type (milling: hm)']] },
    { id: 'f', label: 'Feed per revolution', unit: feedRevU(s), def: s === 'inch' ? 0.008 : 0.2, when: v => v.op !== 2 },
    { id: 'kap', label: 'Entering angle (90 = square shoulder)', unit: 'deg', def: 95, when: v => v.op === 1 },
    { id: 'pt', label: 'Drill point angle', unit: 'deg', def: 140, when: v => v.op === 3 },
    { id: 'h', label: 'Chip thickness', unit: lenU(s), def: s === 'inch' ? 0.004 : 0.1, when: v => v.op === 2 },
  ],
  calc: (v, W, s) => {
    const k = s === 'inch' ? IN_MM : 1, g = kcGroup(v.grp);
    if (!g) return [];
    const h = v.op === 1 ? W.lead_chip_thickness(v.f * k, v.kap) : v.op === 3 ? W.drill_chip_thickness(v.f * k, v.pt) : v.h * k;
    if (!(h > 0)) return [];
    const r = cfKc({ grp: v.grp }, W, h, s);
    if (!r) return [];
    const rows = r.rows.concat([R('At 1 mm chip thickness (kc1.1)', g[5], 'N/mm2', 0), R('Material group', kcGroupName(g), '', 0)]);
    (KC_OTHER[g[0]] || []).forEach(t => rows.push(R('Another publisher, similar material', t, '', 0)));
    rows.push(R('Note', 'A starting figure. Publishers differ for the same material, by half as much again for stainless steel, and a worn edge or a negative rake raises the force. Use it to estimate power and force, then watch the load meter.', '', 0));
    return rows;
  },
  working: 'Kienzle: kc = kc1.1 x h^(-mc), h in mm. kc1.1 is the force per mm2 of chip at 1 mm chip thickness and mc says how fast it rises as the chip gets thinner. Turning and boring: h = fn sin(entering angle). Drilling (two lips): h = (fn / 2) sin(point angle / 2). Milling: type the mean chip thickness hm, which the Cut check tool shows. Hardened groups 38 to 41: the table prints no mc, so kc1.1 is used unchanged, which is low for thin chips. No rake angle or wear correction is applied.',
  source: 'kc1.1 and mc: Iscar, "Materials and grades" table after DIN / ISO 513 and VDI 3323. Beside it: Sandvik Coromant values as listed in Wikipedia, "Cutting force (machining)"; Mitsubishi Materials, "Cutting power for face milling" (kc by feed per tooth), whose rows follow the same power law (core test). See docs/sources.md.',
},
{
  id: 'drillforce', level: 'advanced', group: 'Drilling and tapping', title: 'Drill thrust, torque and power',
  pick: { map: { d: 'dia' }, types: ['Drill'] },
  desc: 'Torque, feed force (thrust) and power for a twist drill or solid carbide drill from its diameter and feed, with the specific cutting force taken from the work material at the chip thickness of each lip, checked against the active machine.',
  fields: s => [
    { id: 'd', label: 'Drill diameter', unit: lenU(s), def: s === 'inch' ? 0.375 : 10 },
    { id: 'f', label: 'Feed per revolution', unit: feedRevU(s), def: s === 'inch' ? 0.006 : 0.15 },
    { id: 'speed', label: s === 'inch' ? 'Surface speed (for power)' : 'Cutting speed Vc (for power)', unit: spdU(s), def: s === 'inch' ? 260 : 80 },
    { id: 'pt', label: 'Point angle', unit: 'deg', def: 140 },
    { id: 'grp', label: 'Work material (VDI 3323 group)', unit: '', def: 2, options: kcGroupOptions(true) },
    { id: 'kc', label: 'Or specific cutting force kc', unit: 'N/mm2', def: '' },
    { level: 'advanced', id: 'eta', label: 'Machine efficiency', unit: '0-1', def: 0.8 },
  ],
  calc: (v, W, s) => {
    const inch = s === 'inch', k = inch ? IN_MM : 1;
    if (!(v.d > 0 && v.f > 0 && v.pt > 0)) return [];
    const d = v.d * k, f = v.f * k, h = W.drill_chip_thickness(f, v.pt), c = cfKc(v, W, h, s);
    if (!c) return [R('Specific cutting force', 'Pick a work material or type kc', '', 0)];
    const tq = W.drill_torque_nm(d, f, c.kc), ff = W.drill_thrust_n(c.kc, d, f, v.pt);
    const rows = [R('Torque', inch ? tq * NM_LBFIN : tq, inch ? 'lbf in' : 'N m', inch ? 1 : 2), R('Feed force (thrust)', inch ? ff / LBF_N : ff, inch ? 'lbf' : 'N', 0)];
    if (v.speed > 0) {
      const vc = inch ? v.speed * FT_M : v.speed, n = W.rpm_from_vc(vc, d), pc = W.drill_power_kw(vc, d, f, c.kc);
      rows.push(R('Net power at the drill', pc, 'kW', 2), R('Net power at the drill', pc * KW_HP, 'hp', 2));
      if (v.eta > 0) rows.push(R('Power at the spindle motor', pc / v.eta, 'kW', 2));
      rows.push(R('Spindle speed', n, 'RPM', 0, 'rpm'), R('Penetration rate', n * v.f, feedMinU(s), inch ? 2 : 0, 'feed'));
      const m = typeof Profiles !== 'undefined' ? Profiles.active() : null, pm = m && Number(m.power_kw) > 0 ? Number(m.power_kw) : 0, tm = m && Number(m.torque_nm) > 0 ? Number(m.torque_nm) : 0;
      if (pm > 0 && v.eta > 0) {
        const av = W.spindle_power_available_kw(n, pm, tm), use = pc / v.eta / av;
        rows.push(R('Share of the power ' + m.name + ' has at this speed', 100 * use, '%', 0));
        if (use > 1) rows.push(cfNote('More power than the active machine has at this speed. Lower the feed, drill a pilot hole, or use a smaller drill first.'));
      }
    }
    return rows.concat(c.rows, [cfNote('An estimate for a sharp drill in solid material. The chisel edge, a worn drill and a deep hole full of chips all raise the thrust.')]);
  },
  working: 'Chip thickness on each lip h = (fn / 2) sin(point angle / 2). kc = kc1.1 x h^(-mc) for the material group (Specific cutting force tool), or as typed. Net power Pc = Vc x Dc x fn x kc / 240 000 (kW). Torque Mc = Pc x 30 000 / (pi n), which is Dc^2 x fn x kc / 8000 and does not depend on the speed. Feed force Ff = 0.5 x kc x (Dc / 2) x fn x sin(point angle / 2). Spindle power = Pc / efficiency. Mitsubishi Materials prints one figure for comparison, with no material named: a 10 mm drill at 0.3 mm/rev gives 15 N m and 2500 N.',
  source: 'Sandvik Coromant, "Formulas and definitions" for drilling (net power, torque, feed force). kc1.1 and mc: Iscar, "Materials and grades". Comparison figure: Mitsubishi Materials, "Basic drilling: drilling forces". See docs/sources.md.',
},
{
  id: 'taptorque', level: 'advanced', group: 'Drilling and tapping', title: 'Tap torque and power',
  desc: 'Torque a cutting tap or a forming tap needs for a thread size and material, and the spindle power at your tapping speed. Use it to see whether a small machine, a tapping head or a torque-limiting holder is up to the thread.',
  fields: s => [
    { id: 'kind', label: 'Tap', unit: '', def: 1, options: [[1, 'Cutting tap'], [2, 'Forming (roll) tap']] },
    { id: 'd', label: 'Thread nominal diameter', unit: lenU(s), def: s === 'inch' ? 0.375 : 10 },
    s === 'inch' ? { id: 'tpi', label: 'Threads per inch', unit: 'tpi', def: 16 } : { id: 'p', label: 'Pitch', unit: 'mm', def: 1.5 },
    { id: 'mat', label: 'Work material', unit: '', def: 3, options: [[0, 'Other: type kc yourself']].concat(TAP_KC.map(m => [m[0], m[1] + ' (' + m[2] + ')'])), when: v => v.kind !== 2 },
    { id: 'kc', label: 'Or specific cutting force kc', unit: 'N/mm2', def: '', when: v => v.kind !== 2 },
    { id: 'fmat', label: 'Work material', unit: '', def: 1, options: TAP_KF.map(m => [m[0], m[1]]), when: v => v.kind === 2 },
    { id: 'rpm', label: 'Tapping speed (for power)', unit: 'RPM', def: 500 },
  ],
  calc: (v, W, s) => {
    const inch = s === 'inch', d = v.d * (inch ? IN_MM : 1), p = inch ? W.pitch_tpi(v.tpi) : v.p;
    if (!(d > 0 && p > 0)) return [];
    const tU = inch ? 'lbf in' : 'N m', tk = inch ? NM_LBFIN : 1, tdp = inch ? 1 : 2, rows = [];
    if (v.kind === 2) {
      const m = TAP_KF.find(x => x[0] === v.fmat); if (!m) return [];
      const lo = W.form_tap_torque_nm(m[2], p, d), hi = W.form_tap_torque_nm(m[3], p, d);
      rows.push(R('Torque, forming tap, upper figure', hi * tk, tU, tdp), R('Torque, forming tap, lower figure', lo * tk, tU, tdp));
      if (v.rpm > 0) rows.push(R('Power at the tap, upper figure', W.power_from_torque_kw(hi, v.rpm), 'kW', 2));
      rows.push(R('Deforming resistance Kf (Yamawa)', m[2] + ' to ' + m[3] + ' N/mm2', '', 0), R('Pitch', p, 'mm', 4));
      rows.push(cfNote('For a thread 1.5 diameters long at 75 % thread height, as the source states. One publisher only. A hole drilled small raises the torque sharply.'));
      return rows;
    }
    const m = TAP_KC.find(x => x[0] === v.mat), kc = v.kc > 0 ? v.kc : (m ? m[3] : NaN);
    if (!(kc > 0)) return [R('Specific cutting force', 'Pick a work material or type kc', '', 0)];
    const md = W.tap_torque_nm(kc, p, d);
    rows.push(R('Torque, cutting tap', md * tk, tU, tdp));
    if (v.rpm > 0) rows.push(R('Power at the tap', W.power_from_torque_kw(md, v.rpm), 'kW', 2), R('Power at the tap', W.power_from_torque_kw(md, v.rpm) * KW_HP, 'hp', 2));
    rows.push(R('kc used (' + (v.kc > 0 ? 'as entered' : 'Lubero, ' + m[1]) + ')', kc, 'N/mm2', 0), R('Pitch', p, 'mm', 4));
    rows.push(cfNote('For a new tap at full thread depth. A worn tap, packed chips or a small tap drill can double it; set a torque-limiting holder above this figure, not at it.'));
    return rows;
  },
  working: 'Cutting tap: Md = kc x P^2 x d / 8000 (N m; pitch P and nominal diameter d in mm). It is the force kc x (area of one thread groove, about P^2 / 4; the exact ISO groove is 0.237 P^2) acting at the radius d / 2. Forming tap: T = Kf x d x P^2 / 1000, for a thread 1.5 d long at 75 % thread height. Power = 2 pi n M / 60 000 (kW), which is M x n / 9549. Inch threads: P = 25.4 / threads per inch. Another publisher (ECL taps) prints Md = 0.2 x P x Ks x D / 1000 with its own Ks table, which is linear in the pitch and gives less for coarse threads; BenchMate keeps the P^2 form because it follows from the thread section.',
  source: 'Cutting tap formula and kc table: Lubero, "Calculation formulas: tapping and thread forming" (one publisher; the P^2 / 4 section is checked against the ISO thread form in the core tests). Forming tap formula and Kf: Yamawa, European catalogue YEU21, p. 644 (one publisher). Disagreement shown: ECL taps technical information. See docs/sources.md.',
},
{
  id: 'leadthin', level: 'advanced', group: 'Milling', title: 'Chip thinning: entering angle and round inserts',
  desc: 'A 45 degree face mill, a high-feed cutter or a round insert spreads the feed over a longer edge, so the chip is thinner than the feed per tooth. Type the chip thickness the insert maker gives and get the feed per tooth to program, or the other way round.',
  fields: s => [
    { id: 'kind', label: 'Cutting edge', unit: '', def: 1, options: [[1, 'Straight edge at an entering angle'], [2, 'Round insert or button cutter']] },
    { id: 'kap', label: 'Entering angle (90 = square shoulder, 45 = face mill, 10 to 20 = high feed)', unit: 'deg', def: 45, when: v => v.kind !== 2 },
    { id: 'ic', label: 'Insert diameter', unit: lenU(s), def: s === 'inch' ? 0.5 : 12, when: v => v.kind === 2 },
    { id: 'ap', label: 'Depth of cut ap', unit: lenU(s), def: s === 'inch' ? 0.06 : 1.5, when: v => v.kind === 2 },
    { id: 'hex', label: 'Chip thickness wanted (hex)', unit: lenU(s), def: s === 'inch' ? 0.004 : 0.1 },
    { id: 'fz', label: 'Feed per tooth', unit: lenU(s), def: '' },
    { id: 'z', label: 'Number of teeth (for table feed)', unit: '', def: '' },
    { id: 'rpm', label: 'Spindle speed (for table feed)', unit: 'RPM', def: '' },
  ],
  pairs: [['hex', 'fz', (v, W) => v.kind === 2 ? W.round_insert_fz_for_hex(v.hex, v.ic, v.ap) : W.lead_feed_for_chip(v.hex, v.kap),
    (v, W) => v.kind === 2 ? W.round_insert_hex(v.fz, v.ic, v.ap) : W.lead_chip_thickness(v.fz, v.kap)]],
  calc: (v, W, s) => {
    const dp = s === 'inch' ? 5 : 4, round = v.kind === 2;
    if (round ? !(v.ic > 0 && v.ap > 0) : !(v.kap > 0 && v.kap < 180)) return [];
    const kap = round ? W.round_insert_kappa_deg(v.ic, v.ap) : v.kap, fac = W.lead_feed_for_chip(1, kap), rows = [];
    let fz = NaN;
    if (v.hex > 0) { fz = round ? W.round_insert_fz_for_hex(v.hex, v.ic, v.ap) : W.lead_feed_for_chip(v.hex, v.kap); rows.push(R('Feed per tooth for that chip', fz, lenU(s), dp)); }
    else if (v.fz > 0) { fz = v.fz; rows.push(R('Largest chip thickness (hex)', round ? W.round_insert_hex(v.fz, v.ic, v.ap) : W.lead_chip_thickness(v.fz, v.kap), lenU(s), dp)); }
    else rows.push(R('Feed per tooth', 'Type the chip thickness or the feed per tooth', '', 0));
    rows.push(R('Feed factor (feed per tooth / chip thickness)', fac, 'x', 3));
    if (round) rows.push(R('Entering angle where the edge leaves the work', kap, 'deg', 1));
    if (round && v.ap >= v.ic / 2) rows.push(R('Chip thinning', 'None: at a depth of half the insert or more the chip reaches the feed per tooth', '', 0));
    if (fz > 0 && v.z > 0 && v.rpm > 0) rows.push(R('Table feed', W.table_feed(v.rpm, fz, v.z), feedMinU(s), 2, 'feed'));
    rows.push(cfNote('For a width of cut of half the cutter diameter or more. Narrower cuts thin the chip again: use Radial chip thinning as well. Keep inside the insert maker\'s largest feed.'));
    return rows;
  },
  working: 'Straight edge: hex = fz x sin(entering angle), so fz = hex / sin(entering angle): 1.41 x at 45 degrees, 2 x at 30, 5.76 x at 10. Round insert of diameter iC at depth ap: the edge leaves the work where cos(angle) = (iC / 2 - ap) / (iC / 2), and hex = fz x sin(angle) = fz x sqrt(iC^2 - (iC - 2 ap)^2) / iC. At ap = iC / 2 and deeper the chip reaches fz. Vf = n x z x fz.',
  source: 'Straight edge: Iscar, "Machining titanium" user guide (05/2019), equation 7 and table 19 (feed per tooth = basic feed x 1 / sin of the cutting edge angle; 1.4 at 45 degrees, 2 at 30). Mitsubishi Materials, "Lead angle and cutting characteristics", states the thinner chip at 45 degrees in words. Round insert: the same rule at the angle where the edge leaves the work; it is the axial chip thinning factor D / sqrt(D^2 - (D - 2 ap)^2) that Machining Doctor prints for a ball nose (checked in the core tests). See docs/sources.md.',
},
{
  id: 'slender', level: 'advanced', group: 'Turning', title: 'Slender part deflection',
  desc: 'How far a long, thin part bends away from the tool in the lathe, and the taper or barrel shape that leaves on the diameter, held in the chuck only, with a tailstock centre, or between centres. Shows what a centre or a lighter cut buys.',
  fields: s => [
    { id: 'sup', label: 'Held', unit: '', def: 0, options: [[0, 'In the chuck only'], [1, 'Chuck and tailstock centre'], [2, 'Between centres']] },
    { id: 'd', label: 'Part diameter at the cut', unit: lenU(s), def: s === 'inch' ? 0.5 : 12 },
    { level: 'advanced', id: 'di', label: 'Bore (blank = solid)', unit: lenU(s), def: '' },
    { id: 'L', label: 'Length out of the jaws (or between centres)', unit: lenU(s), def: s === 'inch' ? 4 : 100 },
    { id: 'mat', label: 'Part material (sets E)', unit: '', def: 1, options: Object.keys(WORK_E).map(i => [Number(i), WORK_E[i].name]).concat([[0, 'Other: enter E below']]) },
    { level: 'advanced', id: 'E', label: "Young's modulus E (blank = preset)", unit: eField(s).u, def: '' },
    { id: 'Fr', label: 'Radial force pushing the part away', unit: s === 'inch' ? 'lbf' : 'N', def: s === 'inch' ? 20 : 100 },
    { level: 'advanced', id: 'a', label: 'Tool position from the jaws (blank = worst place)', unit: lenU(s), def: '' },
  ],
  calc: (v, W, s) => {
    const inch = s === 'inch', k = inch ? IN_MM : 1, fk = inch ? LBF_N : 1, ef = eField(s);
    if (!(v.d > 0 && v.L > 0)) return [];
    const p = WORK_E[v.mat], e = v.E > 0 ? v.E * ef.k : (p ? p.gpa : NaN);
    if (!(e > 0)) return [R("Young's modulus", 'Enter E for the part material', '', 0)];
    const d = v.d * k, L = v.L * k, di = v.di > 0 ? v.di * k : 0;
    if (di >= d) return [R('Bore', 'Must be smaller than the part', '', 0)];
    if (!(v.Fr > 0)) return [R('Radial force', 'Type the radial force on the part', '', 0)];
    const F = v.Fr * fk, dU = inch ? 'thou' : 'um', dk = inch ? 1000 / IN_MM : 1000, dp = inch ? 2 : 1;
    const mx = i => W.turn_work_deflection_max(v.sup, F, L, d, di, e, i), rows = [];
    rows.push(R('Diameter comes out oversize by, at the worst place', 2 * mx(0) * dk, dU, dp));
    rows.push(R('Part pushed away from the tool by', mx(0) * dk, dU, dp));
    rows.push(R('Worst place, from the jaws', mx(1) / k, lenU(s), inch ? 3 : 1));
    if (v.a > 0 && v.a <= v.L) { const da = W.turn_work_deflection(v.sup, F, v.a * k, L, d, di, e); rows.push(R('Diameter oversize with the tool at ' + v.a + ' ' + lenU(s), 2 * da * dk, dU, dp)); }
    rows.push(R('Length / diameter', v.L / v.d, 'x D', 1));
    rows.push(R("Young's modulus used (" + (v.E > 0 ? 'as entered' : p.name + ', ' + p.src) + ')', e / ef.k, ef.u, ef.dp));
    [0, 1, 2].filter(i => i !== v.sup).forEach(i => rows.push(R(['In the chuck only', 'With chuck and tailstock centre', 'Between centres'][i] + ' it would be', 2 * W.turn_work_deflection_max(i, F, L, d, di, e, 0) * dk, dU + ' on diameter', dp)));
    rows.push(cfNote('The chuck is taken as rigid and the centre as unyielding, so a real set-up gives a little more. The part also springs back as the cut gets lighter, which is why a spring pass removes metal.'));
    return rows;
  },
  working: 'The part is a round beam, I = pi (d^4 - di^4) / 64, and the tool pushes it away with the radial force F at the distance a from the jaws (b = L - a). Chuck only: F a^3 / (3 E I), worst at the free end. Chuck and centre (fixed at the chuck, simply supported at the centre): F a^3 b^2 (3 L + b) / (12 L^3 E I), worst at 0.586 L from the jaws. Between centres: F a^2 b^2 / (3 E I L), worst in the middle. The diameter comes out oversize by twice the deflection, because the part moves away from the tool on the radius. The main (tangential) cutting force pushes the part down, not away, and changes the diameter far less; it is not included.',
  source: 'Beam formulas: Roark\'s Formulas for Stress and Strain, Table 8.1, and Gere and Goodno, Mechanics of Materials (the same cases as the Beam deflection tool; the propped cantilever is checked in the core tests against 7 F L^3 / (768 E I) at mid-span). E presets: the BenchMate material data. See docs/sources.md.',
});
