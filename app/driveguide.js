// Drives and maintenance guide (parity MH292, MH298, MH299, ED25).
// All wording and drawings are BenchMate's own. Every statement carries the keys of the public sources read for
// it (docs/sources.md, "Drives and maintenance guide"); one with fewer than two independent publishers is shown
// as "to be verified". Where two sources give different figures both are shown with the source named.
'use strict';

const DV_SOURCES = {
  LM_DRV: 'LearnMech, S. Thorat, "Mechanical drives: belt, chain, gear. Advantages and disadvantages", 2016-06-23, modified 2020-05-10',
  UNCC_BC: 'University of North Carolina at Charlotte, engineering toolkit, "Belts & chains" (no author or date shown; its statements on service life contradict each other and are not used)',
  DE_DRV: 'Design Engineering, L. Burgess, "Which is better: gear drive or belt and pulley drive system?", 2022-03-01',
  MD_NP: 'Machine Design, D. Basso, "Basics of motor nameplates", 2000-05-01',
  AD_AC: 'AutomationDirect library, C. McDaniel, "How do AC motors work?", 2018-01-02',
  CE_AC: 'Control Engineering, F. J. Bartos, "Anatomy of an AC induction motor"',
  FAB_AL: 'Fabrico blog, "Coupling alignment", 2026-07-07, updated 2026-11-02 (no author shown)',
  OEP_AL: 'OpenExamPrep, R. Chen, "Precision shaft alignment: rim-and-face and reverse-dial", updated August 2026',
  TRAC: 'Tractian glossary, "Shaft alignment" (no author or date shown)',
  CUND: 'Slides "Brief overview of fluid power", chapter 1, after J. S. Cundiff, Fluid Power Circuits and Controls (University of Florida course page)',
  OEP_FP: 'OpenExamPrep, R. Chen, "Fluid power: hydraulics and pneumatics"',
  WP_HM: 'Wikipedia, "Hydraulic machinery" (CC BY-SA)',
  PMT: 'Power & Motion, "Chapter 5: Pneumatic and hydraulic systems", 2006-10-16 (no author shown)',
  AP: 'AutomationPrimer, "Fluid power" (no author shown)',
  BREN: 'Brennan Industries blog, C. Mills, "13 hydraulic fittings", 2023-10-13',
  MIS_FIT: 'MISUMI Mech Lab blog, C. Layosa, "Introduction to fittings: connection types", 2020-11-10, modified 2024-03-11',
  FAB_VIB: 'Fabrico blog, "ISO 20816 vibration severity zones", 2026-07-07, updated 2026-11-09 (no author shown)',
  VIBRO: 'Vibromera, "ISO 10816 and ISO 20816 vibration standards", 2025-10-31, modified 2026-07-17',
  IMD_VIB: 'Industrial Monitor Direct, "ISO 10816 vibration severity standards for rotating machines", 2026-06-10',
  WP_VIB: 'Wikipedia, "Vibration" (CC BY-SA)',
  MDI_VIB: 'V. Wowk, Machine Dynamics, Inc., "A brief tutorial on machine vibration"',
  RW_FB: 'Reliabilityweb, D. H. Shreve, "Fundamentals for successful field balancing", 2012-07-30',
  RP_FB: 'Reliable Plant, "Field balancing rotors" (no author or date in the text read)',
};
// Several pages of one publisher count once. Machine Design and Power & Motion are magazines of one publisher.
const DV_FAMILY = { WP_VIB: 'WP_HM', MD_NP: 'ENDEAVOR', PMT: 'ENDEAVOR', FAB_AL: 'FABRICO', FAB_VIB: 'FABRICO', OEP_AL: 'OEP', OEP_FP: 'OEP' };
const dvTags = keys => guideTags(keys, DV_SOURCES, DV_FAMILY);
const dvP = (html, keys) => '<p>' + html + (keys === null ? '' : ' ' + dvTags(keys)) + '</p>';
const dvBox = d => '<path class="gfill" d="' + d + '"/><path class="gp" d="' + d + '"/>';
// Arrow head at (x, y) pointing along (dx, dy), a unit step along one axis.
const dvHead = (x, y, dx, dy) => 'M' + x + ' ' + y + 'L' + (x - 8 * dx - 4 * dy) + ' ' + (y - 8 * dy + 4 * dx) + 'M' + x + ' ' + y + 'L' + (x - 8 * dx + 4 * dy) + ' ' + (y - 8 * dy - 4 * dx);

// End view of an induction motor, and the field outrunning the rotor.
function dvMotor() {
  const cx = 96, cy = 92;
  const slots = Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6, c = Math.cos(a), s = Math.sin(a); return 'M' + (cx + 47 * c).toFixed(1) + ' ' + (cy + 47 * s).toFixed(1) + 'L' + (cx + 59 * c).toFixed(1) + ' ' + (cy + 59 * s).toFixed(1); }).join('');
  const bars = Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4; return '<circle class="gp" cx="' + (cx + 30 * Math.cos(a)).toFixed(1) + '" cy="' + (cy + 30 * Math.sin(a)).toFixed(1) + '" r="3" style="fill:none"/>'; }).join('');
  return cnSvg(420, 176,
    '<path class="gfill" fill-rule="evenodd" d="M34 92a62 62 0 1 0 124 0a62 62 0 1 0 -124 0ZM52 92a44 44 0 1 0 88 0a44 44 0 1 0 -88 0Z"/>' +
    '<circle class="gp" cx="96" cy="92" r="62" style="fill:none"/><circle class="gp" cx="96" cy="92" r="44" style="fill:none"/>' +
    '<path class="gm" d="' + slots + '"/>' +
    '<circle class="gfill" cx="96" cy="92" r="38"/><circle class="gp" cx="96" cy="92" r="38" style="fill:none"/>' + bars +
    '<circle class="gp" cx="96" cy="92" r="9" style="fill:none"/>' +
    '<path class="gc" d="M30.2 68.1A70 70 0 0 1 72.1 26.2M72.1 26.2L63.2 25.1M72.1 26.2L66 32.7"/>' +
    '<path class="gm" d="M148 58L172 48M122 100L172 84"/>' +
    cnT(2, 16, 'rotating field', 'gs') +
    cnT(176, 52, 'stator: fixed, carries the windings', 'gs') + cnT(176, 88, 'rotor: bars shorted at both ends', 'gs') +
    '<path class="gc" d="M222 124H400"/><path class="gp" d="M222 146H388"/>' +
    '<path class="gm" stroke-dasharray="3 3" d="M388 118V152M400 118V152"/>' +
    cnT(176, 128, 'field', 'gs') + cnT(176, 150, 'rotor', 'gs') + cnT(394, 166, 'slip', 'gs', 'middle') + cnT(222, 166, 'speed', 'gs'),
    'Left: end view of an induction motor; the fixed outer ring is the stator with its windings, the inner part is the rotor with its bars, turning on the shaft, and an arrow shows the magnetic field going round. Right: two bars compare the speeds; the rotor bar is a little shorter than the field bar, and the difference is the slip');
}
// Offset and angular misalignment, and a rim-and-face set-up.
function dvAlign() {
  return cnSvg(420, 200,
    dvBox('M20 40H90V56H20Z') + dvBox('M90 30H100V66H90Z') + dvBox('M104 36H114V72H104Z') + dvBox('M114 46H184V62H114Z') +
    '<path class="gk" d="M14 48H104M100 54H190"/>' + cnT(102, 22, 'offset', 'gs', 'middle') +
    dvBox('M230 40H300V56H230Z') + dvBox('M300 30H310V66H300Z') + '<path class="gk" d="M224 48H312"/>' +
    '<g transform="rotate(6 314 48)">' + dvBox('M314 30H324V66H314Z') + dvBox('M324 40H394V56H324Z') + '<path class="gk" d="M312 48H400"/></g>' +
    cnT(312, 22, 'angle', 'gs', 'middle') +
    dvBox('M40 140H150V160H40Z') + dvBox('M150 118H166V182H150Z') + dvBox('M172 118H188V182H172Z') + dvBox('M188 140H300V160H188Z') +
    '<path class="gp" style="stroke-width:2.4" d="M120 140V96H204V123M180 96V100"/>' +
    '<circle class="gfill" cx="180" cy="107" r="7"/><circle class="gc" cx="180" cy="107" r="7" style="fill:none"/><path class="gc" d="M180 114V118"/>' +
    '<circle class="gfill" cx="204" cy="130" r="7"/><circle class="gc" cx="204" cy="130" r="7" style="fill:none"/><path class="gc" d="M197 130H188"/>' +
    cnT(180, 88, 'rim', 'gs', 'middle') + cnT(218, 134, 'face', 'gs') + cnT(114, 114, 'bracket', 'gs', 'end') +
    cnT(40, 197, 'rim reading: offset. face reading: angle', 'gs'),
    'Top left: two coupled shafts whose centrelines are parallel but not in line, the offset. Top right: two shafts whose centrelines meet at an angle. Bottom: a rim-and-face set-up; a bracket clamped to one shaft carries two dial indicators over the coupling, one touching the rim of the other hub to read the offset and one touching its face to read the angle');
}
// A simple hydraulic circuit as blocks.
function dvCircuit() {
  return cnSvg(420, 204,
    '<path class="gfill" d="M30 170H390V196H30Z"/><path class="gp" d="M30 160V196H390V160"/>' +
    dvBox('M50 118H110V146H50Z') + dvBox('M118 94H204V114H118Z') + dvBox('M170 62H290V90H170Z') + dvBox('M244 120H296V142H244Z') +
    dvBox('M176 10H284V38H176Z') + '<path class="gp" style="stroke-width:3" d="M216 10V38"/>' + dvBox('M216 21H310V27H216Z') +
    '<path class="gc" d="M80 176V146M80 118V76H170M80 104H118M190 62V38' + dvHead(80, 146, 0, -1) + dvHead(170, 76, 1, 0) + dvHead(190, 38, 0, -1) + '"/>' +
    '<path class="gp" d="M270 38V62M270 90V120M270 142V176M204 104H222V176' + dvHead(270, 176, 0, 1) + dvHead(222, 176, 0, 1) + dvHead(270, 62, 0, 1) + '"/>' +
    cnT(80, 136, 'pump', 'gs', 'middle') + cnT(161, 108, 'relief valve', 'gs', 'middle') + cnT(230, 80, 'directional valve', 'gs', 'middle') +
    cnT(270, 135, 'filter', 'gs', 'middle') + cnT(322, 28, 'cylinder', 'gs') + cnT(330, 188, 'reservoir', 'gs', 'middle') +
    cnT(96, 70, 'pressure', 'gs') + cnT(278, 110, 'return', 'gs'),
    'Block diagram of a simple hydraulic circuit: the pump draws oil from the reservoir and sends it under pressure to the directional valve, which passes it to one end of the cylinder; oil from the other end returns through the valve and a filter to the reservoir; a relief valve on the pressure line opens a path straight back to the reservoir when the pressure gets too high');
}
// The four vibration severity zones.
function dvZones() {
  return cnSvg(420, 104,
    dvBox('M20 24H110V54H20Z') + dvBox('M110 24H200V54H110Z') + dvBox('M200 24H290V54H200Z') + dvBox('M290 24H400V54H290Z') +
    '<path class="gw" d="M290 54H400"/>' +
    cnT(65, 44, 'A', 'gv', 'middle') + cnT(155, 44, 'B', 'gv', 'middle') + cnT(245, 44, 'C', 'gv', 'middle') + cnT(345, 44, 'D', 'gv', 'middle') +
    cnT(65, 70, 'new machine', 'gs', 'middle') + cnT(155, 70, 'long-term ok', 'gs', 'middle') + cnT(245, 70, 'limited time', 'gs', 'middle') + cnT(345, 70, 'damage', 'gs', 'middle') +
    '<path class="gm" d="M222 92H400' + dvHead(400, 92, 1, 0) + '"/>' + cnT(20, 96, 'vibration velocity, mm/s RMS', 'gs'),
    'Four bands side by side along a scale of rising vibration velocity: zone A, a newly commissioned machine; zone B, fit for long-term running; zone C, fit for a limited time only; zone D, vibration severe enough to cause damage');
}

const DV_PLATE = [
  ['Voltage', 'The supply the motor is built for. A 460 V motor is meant for a 480 V network. A 230/460 V motor will run on 208 V, with poorer performance.', ['MD_NP']],
  ['Frequency and phase', '50 or 60 Hz, single phase or three phase.', ['MD_NP']],
  ['Full-load amps', 'The current drawn at the rated power, voltage and frequency.', ['MD_NP']],
  ['Full-load speed', 'The speed at rated load. For an induction motor it is always below the synchronous speed.', ['MD_NP', 'AD_AC']],
  ['Power', 'The rated output. Machine Design gives horsepower as torque in lb-ft times rpm, divided by 5250.', ['MD_NP']],
  ['Code letter', 'A to V: the locked-rotor kVA per horsepower. A later letter means more inrush current at starting.', ['MD_NP']],
  ['Design letter', 'A NEMA design letter (AutomationDirect lists A to D). Machine Design: most motors are Design B, which limits the inrush current.', ['MD_NP', 'AD_AC']],
  ['Service factor', '1.15 is standard for open motors and 1.0 for totally enclosed ones. Running above 1.0 all the time is not good practice.', ['MD_NP']],
  ['Efficiency', 'The NEMA nominal efficiency is the average of many motors of the same kind.', ['MD_NP']],
  ['Duty', 'Usually continuous. An intermittent rating is given in minutes (cranes, hoists).', ['MD_NP']],
  ['Insulation class', 'A, B or F: a later letter stands more heat.', ['MD_NP']],
  ['Ambient', 'The highest surrounding temperature, in degrees Celsius. At high altitude the motor has to be derated.', ['MD_NP']],
  ['Enclosure', 'ODP (open drip-proof), TEFC (totally enclosed, fan cooled) or TENV.', ['MD_NP', 'AD_AC', 'CE_AC']],
  ['Frame', 'The first two digits divided by 4 give the height of the shaft centre above the feet in inches: a 445T frame is 11 in. The third digit stands for the spacing of the foot holes. Suffix TC is a C-face, TD a D-flange.', ['MD_NP']],
];
const DV_METH = [
  ['Straightedge and feeler gauge', 'Laid across the coupling.', 'Gross error only, about 0.010 in. For slow machines that are not critical.', ['TRAC']],
  ['Rim and face', 'One indicator on the rim of the other hub reads the offset, a second on its face reads the angle. Both shafts are turned together.', 'Axial end float upsets the face readings.', ['FAB_AL', 'OEP_AL', 'TRAC']],
  ['Reverse dial', 'Two indicators, one carried by each shaft, each reading the rim on the other shaft.', 'Not upset by axial float. More setting up and more calculation.', ['FAB_AL', 'OEP_AL', 'TRAC']],
  ['Laser', 'A laser alignment system.', 'Fabrico: the standard for critical machines. Tractian: resolves about 0.1 mil and works out the shims.', ['FAB_AL', 'TRAC']],
];
const DV_TOL = [
  ['Up to 1000 rpm', '0.09 mm', '0.09 mm per 100 mm', ['FAB_AL']],
  ['1000 to 2000 rpm', '0.07 mm', '0.07 mm per 100 mm', ['FAB_AL']],
  ['2000 to 3000 rpm', '0.05 mm', '0.05 mm per 100 mm', ['FAB_AL']],
  ['3000 to 4000 rpm', '0.03 mm', '0.03 mm per 100 mm', ['FAB_AL']],
  ['Above 4000 rpm', '0.02 mm', 'not given', ['FAB_AL']],
];
const DV_CIRC = [
  ['Reservoir', 'Holds the spare oil, and gives air time to separate and dirt time to settle.', ['WP_HM']],
  ['Pump', 'Turns the torque and speed of its shaft into a flow of oil.', ['CUND', 'OEP_FP', 'WP_HM']],
  ['Relief valve', 'Opens when the pressure gets too high and sends oil back to the reservoir. It sets the highest pressure the circuit can reach.', ['CUND', 'WP_HM', 'PMT']],
  ['Directional control valve', 'Sends the oil to one side of the actuator or the other, to extend or retract it.', ['CUND', 'WP_HM', 'PMT']],
  ['Cylinder or motor', 'Turns pressure and flow back into force and movement.', ['CUND', 'PMT']],
  ['Filter', 'Cleans the oil, usually on its way back to the reservoir.', ['WP_HM', 'PMT']],
  ['Check valve', 'Lets oil through one way only.', ['WP_HM']],
  ['Accumulator', 'Stores energy against a charge of pressurised gas, behind a piston or a bladder.', ['WP_HM']],
  ['Flow control valve', 'Sets the speed of an actuator: meter-in, meter-out or bleed-off.', ['OEP_FP']],
];
const DV_PUMP = [
  ['Gear pump', 'Cheap, simple and durable, with a fixed displacement. Wikipedia: for pressures below 20 MPa (3000 psi). OpenExamPrep: up to 250 bar.', ['WP_HM', 'OEP_FP']],
  ['Vane pump', 'Wikipedia: cheap and simple, good for a high flow at low pressure. OpenExamPrep: up to 200 bar.', ['WP_HM', 'OEP_FP']],
  ['Piston pump', 'Wikipedia: often of variable displacement, dearer, and longer lived at high pressure. OpenExamPrep: up to 420 bar (about 6000 psi).', ['WP_HM', 'OEP_FP']],
];
const DV_HP = [
  ['Fluid', 'Oil, almost incompressible', 'Air, which is compressible', ['PMT', 'AP']],
  ['Pressure', 'Power & Motion: typically 1500 to 2500 psi. OpenExamPrep: can be over 350 bar (about 5000 psi)', 'AutomationPrimer: 60 to 80 psi at the cylinder. OpenExamPrep: 6 to 10 bar (90 to 150 psi)', ['PMT', 'AP', 'OEP_FP']],
  ['Force', 'High force from a small actuator', 'Lower', ['PMT', 'AP', 'OEP_FP']],
  ['Holding a load', 'Holds a position rigidly', 'Gives under load', ['PMT', 'OEP_FP']],
  ['Speed', 'Slower', 'Fast', ['AP', 'OEP_FP']],
  ['Cleanliness', 'Oil leaks make a mess', 'Clean', ['PMT', 'AP', 'OEP_FP']],
  ['Cost to buy', 'Dearer', 'Cheaper', ['PMT', 'AP']],
];
const DV_FIT = [
  ['Tapered pipe thread (NPT, BSPT)', 'The tapered threads wedge and deform into each other.', 'BSPT is used with thread sealant (Brennan: required; MISUMI: recommended).', ['BREN', 'MIS_FIT']],
  ['37 degree flare (JIC, SAE J514)', 'Metal to metal: a 37 degree flared seat on a cone, held by straight threads.', 'Brennan: no O-ring, and good for up to 10 000 psi.', ['BREN', 'MIS_FIT', 'WP_HM']],
  ['45 degree flare (SAE J512)', 'As the 37 degree flare, with 45 degree seats.', 'Usually brass; automotive and refrigeration lines. Some sizes have the same thread as a 37 degree fitting, but the seats do not match and a mixed pair leaks.', ['MIS_FIT']],
  ['O-ring boss (straight thread)', 'An O-ring at the root of the male thread is squeezed into a seat in the port.', 'MISUMI: recommended for medium and high pressure hydraulics.', ['BREN', 'MIS_FIT', 'WP_HM']],
  ['O-ring face seal (SAE J1453)', 'An O-ring in a groove is squeezed against a flat face.', 'MISUMI: the threads only hold the joint together. Brennan: up to 6000 psi, and suited to vibration and shock.', ['BREN', 'MIS_FIT', 'WP_HM']],
  ['Bite type (flareless, ferrule)', 'Tightening the nut drives a ferrule that bites into the plain tube.', 'The tube needs no flare. Brennan: the body has a 24 degree throat.', ['BREN', 'MIS_FIT']],
  ['Four-bolt flange (Code 61, Code 62)', 'A bolted flange. The sources read do not describe the seal.', 'For the larger sizes and pressures. Code 62 is the 6000 psi series.', ['BREN', 'MIS_FIT', 'WP_HM']],
  ['Parallel pipe thread (BSPP)', 'An O-ring or a bonded washer.', 'The thread itself does not seal.', ['BREN']],
  ['Push-to-connect', 'A quick connection: the collar is pushed back and the tube put in.', 'Air and water lines.', ['BREN']],
];
const DV_ZONE = [
  ['A', 'A newly commissioned machine.', ['FAB_VIB', 'VIBRO']],
  ['B', 'Fit to run for a long time without restriction.', ['FAB_VIB', 'VIBRO']],
  ['C', 'Not fit for long continuous running. The machine may run for a limited time until it can be put right.', ['FAB_VIB', 'VIBRO']],
  ['D', 'Severe enough to damage the machine.', ['FAB_VIB', 'VIBRO']],
];
const DV_LIM = [
  ['Group 1, rigid support', '2.3', '4.5', '7.1', ['FAB_VIB', 'VIBRO']],
  ['Group 1, flexible support', '3.5', '7.1', '11.0', ['FAB_VIB', 'VIBRO']],
  ['Group 2, rigid support', '1.4', '2.8', '4.5', ['FAB_VIB', 'VIBRO']],
  ['Group 2, flexible support', '2.3', '4.5', '7.1', ['FAB_VIB', 'VIBRO']],
];
// Belt, chain and gear drives side by side. A cell that rests on one of the three publishers names it.
const DV_CMP = [
  ['Slip', 'A flat belt or V-belt slips a little, so the speed ratio is not exact.', 'No slip: the ratio stays constant.', 'No slip: the ratio stays constant.', ['LM_DRV', 'UNCC_BC', 'DE_DRV']],
  ['Efficiency', 'Lower than that of a chain or of gears.', 'Higher than a belt; up to 98 % (UNC Charlotte).', 'High.', ['LM_DRV', 'UNCC_BC', 'DE_DRV']],
  ['Lubrication', 'None.', 'Regular lubrication (UNC Charlotte).', 'Regular lubrication.', ['LM_DRV', 'UNCC_BC', 'DE_DRV']],
  ['Noise', 'Quiet; damps noise and vibration.', 'Noisier than a belt.', 'Noisy when not lubricated (LearnMech).', ['LM_DRV', 'UNCC_BC', 'DE_DRV']],
  ['First cost', 'Low.', 'Higher than a belt.', 'Small drives: cheaper than a belt drive. Large drives: a timing belt is cheaper (Design Engineering).', ['LM_DRV', 'UNCC_BC', 'DE_DRV']],
  ['Space', 'Not compact (Design Engineering); for shafts far apart (UNC Charlotte).', 'Takes less room than a belt (LearnMech); shafts closer together than with a belt (UNC Charlotte).', 'The most compact; not for shafts far apart (Design Engineering).', ['LM_DRV', 'UNCC_BC', 'DE_DRV']],
  ['Overload and shock', 'Slips or breaks when overloaded, which protects the machine (LearnMech); takes up swings in the load (Design Engineering).', 'Not stated in the sources read.', 'Can lock up if the tooth form is not kept (LearnMech).', ['LM_DRV', 'DE_DRV']],
  ['Wear and upkeep', 'Wears and stretches; the tension has to be set again from time to time (LearnMech).', 'The sources differ: upkeep costs more than a belt (LearnMech); low upkeep cost, as for a belt (UNC Charlotte).', 'The longest life of the three (LearnMech).', ['LM_DRV', 'UNCC_BC', 'DE_DRV']],
  ['Oil and wet', 'Not for oily, greasy or wet places.', 'Works dry or wet.', 'Not stated in the sources read.', ['UNCC_BC']],
];
const DV_SIG = [
  ['Unbalance', 'Vibration mostly at once the running speed.', ['VIBRO']],
  ['Misalignment', 'Vibromera: at two and three times the running speed, with axial vibration more than half the radial. Fabrico and Tractian: at once and twice the running speed; Fabrico adds raised axial vibration.', ['VIBRO', 'FAB_AL', 'TRAC']],
  ['Looseness', 'At two and three times the running speed. Horizontal vibration much higher than vertical points to a soft foot or loose bolts.', ['VIBRO']],
  ['Rolling bearing damage', 'High-frequency noise.', ['VIBRO']],
];
function renderDriveGuide(el) {
  const toc = [['dv-cmp', 'Belt, chain or gears'], ['dv-mot', 'Electric motors'], ['dv-al', 'Shaft alignment'], ['dv-fp', 'Fluid power'], ['dv-vib', 'Machine vibration']];
  const two = (head, rows) => '<div class="res cntab" style="max-width:none"><table class="gtab"><tr>' + head.map(h => '<th>' + h + '</th>').join('') + '<th>Sources</th></tr>' +
    rows.map(r => '<tr><td><b>' + gesc(r[0]) + '</b></td><td>' + gesc(r[1]) + '</td><td>' + dvTags(r[2]) + '</td></tr>').join('') + '</table></div>';
  el.innerHTML =
    '<nav class="gtoc">' + toc.map(([a, t]) => '<a href="#' + a + '">' + t + '</a>').join('') + '</nav>' +
    '<p class="desc">What drives a machine and what keeps it running, in our own words: induction motors and their nameplate, lining up two coupled shafts with dial indicators, hydraulics and pneumatics with their fittings, and how machine vibration is judged. The small grey keys after each statement name the public sources it was checked against (list at the bottom). <span class="gtbv">to be verified</span> marks a statement not yet confirmed by two independent publishers. Where the sources give different figures, each figure is shown with its source.</p>' +

    '<h2 id="dv-cmp">Belt, chain or gears</h2>' +
    '<div id="dvcmp">' + guideTable(['', 'Belt', 'Chain', 'Gears'], DV_CMP, dvTags) + '</div>' +
    dvP('<b>Timing belts</b> have teeth that keep the two shafts in step.', ['UNCC_BC', 'DE_DRV']) +
    dvP('Design Engineering prefers a timing belt for high torque and a V-belt for high speed.', ['DE_DRV']) +
    dvP('UNC Charlotte gives about 35 m/s as the limit of belt speed and a ratio of up to 8 : 1 for a chain.', ['UNCC_BC']) +
    dvP('Neither a belt nor a chain is the better one in general: it depends on the job.', ['UNCC_BC']) +
    dvP('Each drive has its calculator: <a href="#/t/beltdrive">belt drive</a>, <a href="#/t/chaindrive">chain drive</a> and <a href="#/t/geartrain">gear train</a>.', null) +

    '<h2 id="dv-mot">Electric motors</h2>' + dvMotor() +
    dvP('<b>Stator and rotor.</b> The stator is the fixed outer part of an AC motor. The rotor is the inner part that turns with the shaft.', ['AD_AC', 'CE_AC']) +
    dvP('<b>Rotating field.</b> Alternating current in the stator windings makes a magnetic field that goes round.', ['AD_AC', 'CE_AC']) +
    dvP('<b>Induction.</b> The field of the stator induces the current in the rotor, which is where the induction motor has its name from.', ['AD_AC', 'CE_AC']) +
    dvP('<b>Squirrel cage.</b> The usual rotor is a stack of steel laminations on the shaft, with bars of cast aluminium or copper joined at both ends.', ['CE_AC']) +
    dvP('<b>Synchronous speed</b> is the speed of the rotating field. A four-pole motor on 60 Hz has a synchronous speed of 1800 rpm.', ['CE_AC', 'AD_AC']) +
    dvP('One source gives the rule: synchronous speed in rpm is 120 times the frequency, divided by the number of poles.', ['CE_AC']) +
    dvP('<b>Slip.</b> An induction motor always turns a little slower than its field. The difference is the slip, and it grows with the load.', ['MD_NP', 'AD_AC', 'CE_AC']) +
    dvP('<b>How much slip.</b> For an 1800 rpm field the sources print full-load speeds of 1760 rpm (AutomationDirect), 1748 rpm (Machine Design) and 1746 rpm (Control Engineering, at 3 % slip).', ['AD_AC', 'MD_NP', 'CE_AC']) +
    dvP('Control Engineering gives 2 to 5 % as the usual slip.', ['CE_AC']) +
    dvP('<b>Which way it turns.</b> The direction of a three-phase motor depends on the order of the phases.', ['CE_AC']) +
    dvP('<b>Single phase.</b> A single-phase induction motor needs a starting circuit, such as a start capacitor with a centrifugal switch.', ['AD_AC']) +
    dvP('<b>Variable frequency drive.</b> The drive turns the supply into direct current and builds from it, by pulse width modulation, an alternating current of the frequency that gives the wanted speed.', ['AD_AC']) +
    '<h3 class="gcat">Reading the nameplate</h3>' +
    two(['On the plate', 'What it tells you'], DV_PLATE) +
    dvP('<b>Enclosures.</b> A TEFC motor is not airtight: its fan cools the outside of the frame. An open drip-proof motor keeps out drops that fall within 15 degrees of the vertical.', ['MD_NP']) +
    dvP('<b>Bearings.</b> Some nameplates list the bearing numbers, for example 6309.', ['MD_NP']) +
    dvP('Bearing numbers are explained in the <a href="#/t/bearguide">bearings and seals guide</a>; power, torque and speed of a shaft are under <a href="#/t/torsion">shaft torsion and power</a>.', null) +

    '<h2 id="dv-al">Shaft alignment</h2>' + dvAlign() +
    dvP('<b>The aim.</b> The centrelines of two coupled shafts should lie in one line when the machine is running.', ['TRAC']) +
    dvP('<b>Offset and angle.</b> In parallel misalignment the centrelines are parallel but apart: the offset. In angular misalignment they meet at an angle, which shows as a gap that is wider on one side of the coupling. A real machine has both, in the vertical and in the horizontal plane.', ['FAB_AL', 'OEP_AL', 'TRAC']) +
    dvP('<b>What misalignment does.</b> It loads the bearings, which run hotter, wears the coupling and makes seals leak.', ['FAB_AL', 'TRAC']) +
    dvP('<b>Soft foot first.</b> A soft foot is a machine foot that does not sit flat on its base. Tightening its bolt distorts the frame. Find and cure it before aligning.', ['FAB_AL', 'TRAC']) +
    dvP('To find a soft foot, loosen one foot at a time and measure how far it lifts; shim it, tighten and check again.', ['TRAC']) +
    dvP('<b>Which machine moves.</b> One machine stays where it is. The other is moved, with shims under its feet and jack bolts.', ['OEP_AL']) +
    dvP('Correct the vertical plane first, with shims, then the horizontal.', ['TRAC']) +
    guideTable(['Method', 'How it reads', 'Limits'], DV_METH, dvTags) +
    dvP('<b>Reading the dials.</b> The total indicator reading is the whole sweep of the needle. The offset is half of the corrected rim reading.', ['OEP_AL']) +
    dvP('<b>Bracket sag.</b> The bracket that carries the indicator bends under its own weight, so the reading changes between top and bottom. The sag has to be measured and allowed for.', ['OEP_AL', 'TRAC']) +
    dvP('To measure the sag, clamp the bracket at the same span on a stiff pipe or mandrel, set zero at the top and read at the bottom. Take that figure off the bottom reading on the machine.', ['OEP_AL']) +
    dvP('<b>Check the readings.</b> Top plus bottom should equal left plus right. If the sums differ by more than 0.001 in (0.025 mm), look for loose hardware, a sticking indicator or a shaft that has shifted.', ['OEP_AL']) +
    dvP('<b>Before aligning,</b> one source wants no more than 0.001 in (0.025 mm) runout on shaft and hub, and calls pipe strain excessive when the shaft moves more than 0.002 in (0.05 mm) as a flange is loosened.', ['OEP_AL']) +
    dvP('<b>Thermal growth.</b> The height of a shaft changes as the machine warms up. A machine that runs hot is aligned cold to a deliberate offset taken from the figures of its maker, not to zero.', ['FAB_AL', 'TRAC']) +
    '<h3 class="gcat">Tolerances in one source</h3>' +
    '<p class="desc">Fabrico prints these as its "excellent" values, as typical field guidance.</p>' +
    guideTable(['Speed', 'Offset', 'Angle'], DV_TOL, dvTags) +
    dvP('The same source calls two to three times these values acceptable, and quotes API 686 as 0.02 mm offset and 0.03 degrees.', ['FAB_AL']) +
    dvP('<b>The limits of the maker come first.</b> A general table is field guidance only.', ['FAB_AL', 'TRAC']) +
    dvP('Checking a shaft for runout is in the <a href="#/t/measguide">measurement guide</a>.', null) +

    '<h2 id="dv-fp">Fluid power</h2>' + dvCircuit() +
    dvP('<b>Small piston, big load.</b> The force grows with the ratio of the two piston areas, and the travel shrinks in the same proportion.', ['OEP_FP', 'WP_HM']) +
    dvP('The law of Pascal: pressure put on an enclosed fluid at rest is passed on undiminished in every direction.', ['OEP_FP']) +
    dvP('<b>Force of a cylinder.</b> The force is the pressure times the area of the piston.', ['CUND', 'OEP_FP']) +
    dvP('<b>Pulling back.</b> On the return stroke the rod takes up part of the piston area, so the cylinder pulls with less force and moves faster for the same flow. The speed is the flow divided by the working area.', ['OEP_FP']) +
    dvP('<b>The pump makes flow, the load makes pressure.</b> The pressure rises only as far as the load resists the flow.', ['OEP_FP', 'WP_HM']) +
    dvP('<b>Power,</b> in one source: horsepower is psi times US gallons a minute divided by 1714; kilowatts are bar times litres a minute divided by 600.', ['OEP_FP']) +
    two(['Part', 'What it does'], DV_CIRC) +
    dvP('<b>Open and closed centre.</b> In an open-centre circuit the pump delivers all the time, and with the valve centred the oil flows back to the reservoir without pressure. In a closed-centre circuit full pressure stands at the valves all the time, and the pump delivers very little until a valve is worked.', ['WP_HM']) +
    two(['Pump', 'What the sources say'], DV_PUMP) +
    dvP('<b>Oil.</b> Hydraulic fluid is usually petroleum oil with additives. Besides carrying the power it lubricates the parts and carries dirt to the filter.', ['WP_HM']) +
    dvP('About 1 % of air mixed into the oil can halve its stiffness.', ['OEP_FP']) +
    '<h3 class="gcat">Hydraulics against pneumatics</h3>' +
    guideTable(['Point', 'Hydraulics', 'Pneumatics'], DV_HP, dvTags) +
    dvP('<b>Running cost.</b> One source puts the cost of running an air circuit at 5 to 10 times that of a hydraulic one: compressing air to 100 psi takes about 1 hp for every 4 cubic feet a minute. Air leaks make no mess, but they are expensive.', ['PMT']) +
    dvP('<b>Air preparation.</b> Before it is used the air passes a filter, then a regulator that sets the pressure, and often a lubricator that adds a little oil.', ['PMT', 'AP']) +
    dvP('The filter also takes out condensed water and has to be drained regularly. Set the regulator to the lowest pressure that does the job.', ['PMT']) +
    '<h3 class="gcat">Tube and hose fittings</h3>' +
    guideTable(['Fitting', 'How it seals', 'Notes'], DV_FIT, dvTags) +
    dvP('<b>Pipe threads</b> are screwed in until tight, so an elbow is hard to point the right way.', ['WP_HM']) +
    dvP('<b>Soft seals.</b> Fittings sealed by an O-ring are the most common on heavy equipment and seal reliably above 6000 psi (41 MPa).', ['WP_HM']) +
    dvP('<b>Hoses</b> are graded by pressure, temperature and fluid. Keep to the bend radius. One source has hoses replaced every five to seven years.', ['WP_HM']) +
    dvP('Thread sizes are under <a href="#/t/pipethreads">pipe threads (BSP and NPT)</a>; grooves for O-rings under <a href="#/t/oring">O-ring glands</a>.', null) +

    '<h2 id="dv-vib">Machine vibration</h2>' + dvZones() +
    '<p class="desc">The figures in this section were read from two web pages about the ISO standards, not from the standards themselves. Get the standard before judging a machine by them.</p>' +
    dvP('<b>What is measured.</b> The overall vibration velocity as an RMS value in mm/s, taken on parts that do not turn, such as the bearing housings.', ['FAB_VIB', 'VIBRO', 'IMD_VIB']) +
    dvP('<b>Frequency range.</b> The reading covers 10 to 1000 Hz.', ['FAB_VIB', 'VIBRO']) +
    dvP('<b>Where.</b> At each bearing, in more than one direction (Fabrico: two radial directions at right angles; Vibromera: vertical, horizontal and axial). The highest reading counts.', ['FAB_VIB', 'VIBRO']) +
    two(['Zone', 'Meaning'], DV_ZONE) +
    dvP('<b>Two groups of machines.</b> Group 1 is machines above 300 kW, Group 2 machines from 15 to 300 kW.', ['FAB_VIB', 'VIBRO']) +
    dvP('One source adds shaft heights: 315 mm and more for Group 1, 160 to 315 mm for Group 2.', ['FAB_VIB']) +
    dvP('<b>Rigid or flexible.</b> A support counts as rigid when its lowest natural frequency lies above the running speed (Fabrico: at least 25 % above). Otherwise it is flexible.', ['FAB_VIB', 'VIBRO']) +
    guideTable(['Machine and support', 'A to B', 'B to C', 'C to D'], DV_LIM, dvTags) +
    '<p class="desc">Zone boundaries in mm/s RMS, as both sources quote them from ISO 10816-3.</p>' +
    dvP('<b>Standard numbers.</b> The ISO 10816 series has been replaced by ISO 20816.', ['FAB_VIB', 'VIBRO']) +
    dvP('ISO 20816-3 took over from ISO 10816-3 with the zones and values unchanged. It covers machines above 15 kW running at 120 to 30 000 rpm.', ['FAB_VIB']) +
    '<h3 class="gcat" id="dv-vth">Vibration in general</h3>' +
    dvP('<b>Free and forced.</b> Free vibration: a system is set moving once and left to itself. Forced vibration: a disturbance that keeps coming drives it.', ['WP_VIB', 'MDI_VIB']) +
    dvP('<b>In a machine</b> the forcing comes from the parts that turn: unbalance, misalignment, uneven friction, the meshing of gear teeth.', ['WP_VIB', 'MDI_VIB']) +
    dvP('<b>Resonance.</b> When the forcing frequency comes close to a natural frequency the movement can grow very large and end in failure. A machine may rumble as it passes through a natural frequency while running up or coasting down.', ['WP_VIB', 'MDI_VIB']) +
    dvP('<b>Curing a resonance.</b> Move the natural frequency by adding mass or stiffness to the part that responds, or add damping.', ['MDI_VIB']) +
    dvP('<b>Damping</b> takes energy out of the vibration through friction and other resistance. With little damping the system still swings but dies away; at critical damping it just no longer swings; beyond that it is overdamped. The damped natural frequency lies below the undamped one.', ['WP_VIB']) +
    dvP('<b>Frequency and amplitude.</b> The frequency points to the cause; the amplitude tells how bad it is.', ['MDI_VIB']) +
    dvP('<b>Which quantity.</b> Displacement matters most at low frequencies, velocity is the useful middle measure for trending, and acceleration matters most at high frequencies.', ['MDI_VIB']) +
    dvP('<b>It adds up.</b> Vibration wears by fatigue: the damage accumulates with time and cycles.', ['MDI_VIB']) +
    '<p class="desc">No formula for the natural frequency is printed here: it did not come through from the source read. The chatter finder and the critical speed page work natural frequencies out.</p>' +
    '<h3 class="gcat">What the vibration points to</h3>' +
    two(['Fault', 'What shows'], DV_SIG) +
    '<h3 class="gcat" id="dv-bal">Balancing a rotor in place</h3>' +
    dvP('<b>Is it unbalance?</b> Unbalance shows as vibration at once per turn (1x). If the 1x part is 80 % or more of the total, unbalance is the likely cause; below that, look for other faults as well.', ['RW_FB', 'RP_FB']) +
    dvP('<b>Rule the rest out first.</b> Many faults vibrate at 1x: dirt built up on the rotor, looseness, resonance, misalignment, a bent shaft. Clean and inspect the rotor and put other faults right before balancing.', ['RW_FB', 'RP_FB', 'MDI_VIB']) +
    dvP('<b>The runs.</b> 1. A reference run: note amplitude and phase. 2. Stop and fix a known trial weight at a known place. 3. A trial run: note amplitude and phase again. 4. Take the trial weight off and fit the correction weight the instrument works out. 5. A trim run, and a trim weight if needed.', ['RW_FB', 'RP_FB']) +
    dvP('<b>Size of the trial weight.</b> It has to change the reading enough to calculate with. The 30/30 rule asks for a change of 30 % in amplitude or 30 degrees in phase. Too light gives no usable answer; too heavy can wreck the machine.', ['RW_FB', 'RP_FB']) +
    dvP('<b>A first size.</b> Reliable Plant aims for a force from the trial weight of 10 % of the rotor weight. Reliabilityweb gives, for 1200 to 3600 rpm: ounces = 0.004 x rotor weight in pounds / radius in inches.', ['RW_FB', 'RP_FB']) +
    dvP('<b>Steady readings.</b> Amplitude and phase must both hold steady. If either wanders, do not call it unbalance.', ['RP_FB']) +
    dvP('<b>Trim runs.</b> Reliable Plant: no more than two.', ['RP_FB']) +
    dvP('<b>One plane or two.</b> Reliable Plant advises two planes for every rotor. A narrow overhung rotor, with a diameter at least four times its width, can sometimes be brought within the limit in one.', ['RP_FB']) +
    dvP('<b>Safety while balancing.</b> Lock the machine out while you work on the rotor, and run at a safe speed with a safe trial weight: the force from unbalance grows with the square of the speed.', ['RW_FB']) +
    '<p class="desc">How the correction weight is worked out from the two runs is not described in the sources read; balancing instruments do the vector arithmetic.</p>' +
    dvP('Permissible unbalance and the split between two planes are in <a href="#/t/balance">balancing</a>.', null) +
    dvP('For vibration of the cut itself see the <a href="#/t/chatter">chatter finder</a>.', null) +

    '<h2 id="dv-src">Sources</h2><ul class="gsl">' + Object.entries(DV_SOURCES).map(([k, v]) => '<li><b>' + k + '</b> ' + gesc(v) + '</li>').join('') + '</ul>' +
    '<p class="desc">Full URLs and access dates are in docs/sources.md, "Drives and maintenance guide". No text, figures or tables were copied from the sources.</p>';
  guideToc(el);
}
