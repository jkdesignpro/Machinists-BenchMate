// CNC mill setup guide (parity CN5, CN17, CN18, CN25 to CN34, CN77 to CN79): the order of work from a cold
// machine to a proven first part. All wording and drawings are BenchMate's own. Every statement carries the
// keys of the public sources that were read for it (SETUP_SOURCES, and docs/sources.md section "CNC mill
// setup guide"); a statement with fewer than two independent publishers is shown as "to be verified".
'use strict';

const SETUP_SOURCES = {
  HFO_M: 'Haas Factory Outlet (Productivity Inc.), Haas Mill Operator manual, revised 8/2022',
  HFO_MP: 'Haas Factory Outlet (Productivity Inc.), Haas Mill Programming manual, revised 06/26',
  WPI: 'W. Tian, J. Loiselle, A. Sears, T. Bergstrom, HAAS Machine WPI Quick Guide, Worcester Polytechnic Institute, June 2012',
  UIDAHO: 'University of Idaho, Mindworks machine shop, "Manufacturing plan for CNC mill: basic Haas mill operations" (undated)',
  VIRASAK: 'L. Virasak, Manufacturing Processes 4-5, unit 5 "CNC operation" (Open Oregon, on LibreTexts; CC BY)',
  HILL: 'L. Hillyard, Support for CNC, 2024 (Mt. Hood Community College; CC BY 4.0; adapted in part from Virasak)',
  CAMI: 'M. Wearne, camInstructor blog, "Tool length offsets explained", 2019-09-05',
  HURCO: 'Hurco Companies, WinMax Mill help, "Tool calibration modes" (support.hurco.com)',
  TRAV: 'K. Repsher, Travers Tool, "How to select and use an edge finder", 2025-06-06 (solutions.travers.com)',
  PROTOOL: 'Protool Ltd, "How to use an edge finder on a milling machine", 2026-08-17 (protool-ltd.co.uk)',
  CIMCO: 'CIMCO, CNC programming book, chapter 6 "Machine and tool offsets" and appendix B "Use 1-2-3 block on finished face of part" (cimco.com/docs/cncbook)',
  LCNC_TC: 'LinuxCNC documentation, "Tool compensation": touch off, tool table, G43, cutter compensation (linuxcnc.org)',
  OWN: 'BenchMate reasoning from the sources beside it',
};
// Same publisher family counts once: the two Haas Factory Outlet manuals; Hillyard's book is adapted from Virasak's,
// and Virasak's unit and the CIMCO book follow the same course text.
const SETUP_FAMILY = { HFO_M: 'HAAS', HFO_MP: 'HAAS', VIRASAK: 'COURSE', HILL: 'COURSE', CIMCO: 'COURSE' };
function suTags(keys) {
  const ks = keys || [];
  const pubs = new Set(ks.filter(k => k !== 'OWN').map(k => SETUP_FAMILY[k] || k));
  return ks.map(k => '<abbr class="gsrc" title="' + gesc(SETUP_SOURCES[k] || k) + '">' + k + '</abbr>').join('') +
    (pubs.size >= 2 ? '' : '<span class="gtbv" title="Not yet confirmed in two independent public sources">to be verified</span>');
}
const sp = (html, keys) => '<p>' + html + (keys === null ? '' : ' ' + suTags(keys)) + '</p>';

// ---------- Drawings (own, schematic) ----------
const SETUP_STEPS = [['su-start', 'Power on'], ['su-start', 'Home'], ['su-tools', 'Load tools'], ['su-tools', 'Mount part'], ['su-tlo', 'Tool lengths'], ['su-xy', 'Work offset'],
  ['su-prog', 'Load program'], ['su-run', 'Prove it'], ['su-run', 'First part'], ['su-adj', 'Adjust'], ['su-end', 'Shut down']];
function suFlow() {
  let b = '';
  SETUP_STEPS.forEach(([, t], i) => {
    const c = i % 4, r = Math.floor(i / 4), x = 12 + c * 106, y = 14 + r * 62;
    b += '<path class="' + (i === 7 || i === 8 ? 'gfill' : '') + '" d="M' + x + ' ' + y + 'H' + (x + 96) + 'V' + (y + 40) + 'H' + x + 'Z"/><path class="gp" d="M' + x + ' ' + y + 'H' + (x + 96) + 'V' + (y + 40) + 'H' + x + 'Z"/>' +
      cnT(x + 6, y + 15, String(i + 1), 'gv') + cnT(x + 48, y + 32, t, 'gs', 'middle');
    if (i < SETUP_STEPS.length - 1) b += c < 3 ? cnArrow(x + 96, y + 20, x + 106, y + 20, 'gc') : '<path class="gc" d="M' + (x + 48) + ' ' + (y + 40) + 'V' + (y + 51) + 'H60"/>' + cnArrow(60, y + 51, 60, y + 61, 'gc');
  });
  return cnSvg(440, 200, b, 'The eleven steps of a mill setup in order');
}
function suTlo() {
  const tool = (x, tip) => '<path class="gm" d="M' + (x - 13) + ' 22H' + (x + 13) + 'V44H' + (x - 13) + 'Z"/><path class="gp" d="M' + (x - 6) + ' 44H' + (x + 6) + 'V' + tip + 'H' + (x - 6) + 'Z"/>';
  return cnSvg(440, 210,
    '<path class="gm" d="M10 170H430"/>' +
    // a: on the part
    tool(70, 118) + '<path class="gfill" d="M30 122H110V170H30Z"/><path class="gp" d="M30 122H110V170H30Z"/><path class="gw" d="M52 120H88"/>' + cnT(70, 150, 'part', 'gv', 'middle') +
    cnT(70, 188, 'A on the part', 'gs', 'middle') + cnT(70, 202, 'work Z = 0', 'gs', 'middle') + cnT(92, 114, 'paper', 'gs') +
    // b: on a block of known height
    tool(200, 110) + '<path class="gp" d="M180 110H220V170H180Z"/>' + cnT(200, 144, 'block', 'gs', 'middle') + '<path class="gfill" d="M232 134H286V170H232Z"/><path class="gp" d="M232 134H286V170H232Z"/>' + cnT(259, 157, 'part', 'gv', 'middle') +
    '<path class="gk" d="M220 110H300"/><path class="gk" d="M286 134H300"/>' + cnArrow(296, 111, 296, 133, 'gc') + cnT(302, 126, 'work Z', 'gs') +
    cnT(230, 188, 'B on a known block', 'gs', 'middle') + cnT(230, 202, 'work Z = block to part', 'gs', 'middle') +
    // c: on a tool setting probe
    tool(380, 126) + '<path class="gp" d="M368 130H392V140H368Z"/><path class="gm" d="M360 140H400V170H360Z"/>' + cnT(380, 159, 'probe', 'gs', 'middle') +
    cnT(380, 188, 'C on a probe', 'gs', 'middle') + cnT(380, 202, 'a cycle measures', 'gs', 'middle'),
    'Three ways to measure a tool length: on the part, on a block of known height, on a tool setting probe');
}
function suEdge() {
  return cnSvg(440, 190,
    '<path class="gfill" d="M190 30H420V160H190Z"/><path class="gp" d="M190 160V30H420"/>' + cnT(300, 100, 'part (seen from above)', 'gs', 'middle') +
    '<circle class="gp" cx="162" cy="95" r="28"/><path class="gm" d="M152 95H172M162 85V105"/>' + cnT(162, 140, 'tip', 'gs', 'middle') +
    cnArrow(24, 95, 128, 95, 'gm') + cnT(20, 86, 'approach slowly', 'gs') +
    '<path class="gk" d="M162 95V60M190 30V60"/>' + cnArrow(164, 60, 188, 60, 'gc') + cnT(16, 52, 'half the tip diameter', 'gs') +
    '<circle class="gdot" cx="190" cy="30" r="4"/>' + cnT(196, 22, 'part zero', 'gs') +
    cnT(20, 180, 'At the kick the centre is half a tip outside the edge.', 'gs'),
    'Edge finder touching the edge of a part: the spindle centre is half the tip diameter from the edge');
}

const SETUP_KEYS = [
  ['Power', 'POWER ON, POWER OFF, EMERGENCY STOP', 'Starts and stops the control. The emergency stop is reset by twisting it until it pops out, not by pulling.', ['HFO_M', 'WPI']],
  ['Start-up', 'RESET, POWER UP / RESTART', 'Clears alarms; sends every axis to its reference position (machine zero).', ['HFO_M', 'WPI']],
  ['Modes', 'MEM, MDI, EDIT, HANDLE JOG, ZERO RETURN, LIST PROGRAM', 'MEM runs the stored program; MDI runs a few blocks you type (a tool change, a spindle start); HANDLE JOG moves one axis with the handwheel in steps from .0001 to .1; LIST PROGRAM shows the stored programs and devices.', ['HFO_M', 'WPI']],
  ['Displays', 'POSITION, OFFSET, CURRENT COMMANDS, ALARMS, SETTING / GRAPHICS', 'Axis positions; the tool and work offset tables; the active codes and the distance still to go in the block; alarms; settings and the on-screen plot of the program.', ['HFO_M', 'WPI']],
  ['Running', 'CYCLE START, FEED HOLD, SINGLE BLOCK', 'CYCLE START runs the active program. FEED HOLD stops the axes while the spindle keeps turning; CYCLE START carries on. With SINGLE BLOCK on, one block runs for each press of CYCLE START.', ['HFO_M', 'WPI']],
  ['Rapid override', '5 %, 25 %, 50 %, 100 % RAPID', 'Limits rapid moves to that share of full speed.', ['HFO_M', 'WPI']],
  ['Tools', 'TOOL RELEASE, ATC FWD, ATC REV', 'Releases or draws in the tool holder; turns the tool changer one pocket, or to the tool typed first.', ['HFO_M', 'WPI', 'UIDAHO']],
  ['Offsets', 'TOOL OFFSET MEASURE, NEXT TOOL, PART ZERO SET', 'Stores the present Z position as the length of the tool under the cursor; changes to the next tool; stores the present axis position as the work offset under the cursor.', ['HFO_M', 'WPI']],
];
const SETUP_TLO = [
  ['A. On the part, with paper or a feeler', 'The tool tip is brought down to the part zero surface with a slip of paper or a feeler gauge between, and that position is stored as the tool length. The work offset Z stays at zero. Allow for the thickness of the feeler.',
    'Quick: one touch for each tool and none for the work. But the lengths are good for this part height only, the surface must already be at size, and once it has been machined away a broken tool cannot be reset on it.', ['HFO_M', 'CAMI', 'HILL', 'UIDAHO']],
  ['B. On a block of known height', 'Every tool touches the same known surface: the top of a 1-2-3 block or gauge block standing on the table, or on a face of the part that has been milled flat. The work offset Z then holds the distance from that surface to part zero, with the right sign.',
    'The tools do not need touching again for the next part, only the work offset Z. A worn or broken tool is easy to reset. One more measurement to make, and the sign of the work offset matters.', ['HILL', 'CIMCO', 'CAMI', 'WPI', 'HURCO']],
  ['C. On a tool setting probe', 'A probing cycle brings each tool down slowly onto a probe fixed to the table and writes the length into the table by itself.',
    'Fast and the same every time. The probe is costly: never crash a tool onto it.', ['HILL', 'WPI', 'HURCO']],
  ['D. True length from the spindle nose', 'The real length of each tool, spindle nose to tip, is stored. The work offset Z holds the machine position of part zero, found with the spindle nose or a gauge of known length.',
    'Lengths are positive numbers you can check with a rule, and they stay true on another machine. Each tool and the work both need a measurement.', ['CAMI', 'HURCO']],
];
function suTable(head, rows) {
  return '<div class="res cntab" style="max-width:none"><table class="gtab"><tr>' + head.map(h => '<th>' + h + '</th>').join('') + '<th>Sources</th></tr>' +
    rows.map(r => '<tr>' + r.slice(0, head.length).map((c, i) => '<td>' + (i ? '' : '<b>') + gesc(c) + (i ? '' : '</b>') + '</td>').join('') + '<td>' + suTags(r[head.length]) + '</td></tr>').join('') + '</table></div>';
}

function renderMillSetup(el) {
  const toc = [['su-order', 'The order'], ['su-start', 'Start and home'], ['su-panel', 'Control panel'], ['su-tools', 'Load tools'], ['su-tlo', 'Tool lengths'], ['su-xy', 'Work offset X, Y'], ['su-z', 'Work offset Z'],
    ['su-prog', 'Load the program'], ['su-run', 'First run'], ['su-adj', 'Adjust for size'], ['su-end', 'Shut down'], ['su-src', 'Sources']];
  el.innerHTML =
    '<nav class="gtoc">' + toc.map(([a, t]) => '<a href="#' + a + '">' + t + '</a>').join('') + '</nav>' +
    '<p class="desc">From a cold machine to a proven first part on a vertical machining centre, in our own words with our own drawings. Key names are those of the Haas control, because the public guides read for this page describe it; other controls have the same steps under other names. Each statement shows the keys of the sources that confirm it (hover a key); anything not confirmed by two independent publishers is marked <span class="gtbv">to be verified</span>. Your machine manual and your shop\'s rules always win over this page.</p>' +

    '<h2 id="su-order">The order of work</h2>' + suFlow() +
    sp('<b>Eleven steps.</b> Check the machine and switch it on; home it; load the tools; mount the vise or fixture and the part; measure the tool lengths; set the work offset; load the program; prove the program; run the first part with care; measure it and adjust the offsets; clean up and shut down.', ['VIRASAK', 'HFO_M']) +
    sp('The <a href="#/t/setupsheet">setup sheet</a> says which tools go in which pockets and where part zero is. For what machine, work and tool coordinates mean, see the <a href="#/t/cncguide">CNC knowledge guide</a>.', null) +

    '<h2 id="su-start">Before you start, power on and home</h2>' +
    sp('<b>Look first.</b> Check the lubricant and coolant levels and clear loose tools from the work area.', ['VIRASAK']) +
    sp('If the machine uses compressed air, check that the supply is on and up to pressure.', ['VIRASAK', 'HFO_M']) +
    sp('<b>Power on.</b> Switch on the main breaker (on the back of the machine or its cabinet), then press POWER ON at the control and wait for it to load.', ['VIRASAK', 'HFO_M']) +
    sp('<b>Reset.</b> Release the emergency stop by twisting it, then clear the alarms with RESET.', ['WPI', 'HFO_M']) +
    sp('<b>Home.</b> POWER UP / RESTART sends the axes to their reference positions: Z goes first, then X and Y. Until this is done the control does not know where machine zero is.', ['HFO_M', 'WPI']) +
    sp('<b>Check the way is clear.</b> If a tool, the vise or a fixture stands in the path, jog clear first and home one axis at a time.', ['WPI']) +

    '<h2 id="su-panel">The control panel</h2>' +
    '<p class="desc">The keys you need for a setup, grouped by what they do, with the names printed on a Haas mill control.</p>' +
    suTable(['Group', 'Keys', 'What they do'], SETUP_KEYS) +

    '<h2 id="su-tools">Load the tools and mount the part</h2>' +
    sp('<b>In program order.</b> Load each tool into the pocket whose number the program calls, working down the tool list. Call the pocket first (in MDI, the tool number and a tool change), then put the tool in the spindle.', ['VIRASAK', 'HFO_M']) +
    sp('<b>Through the spindle.</b> Tools go into the changer by way of the spindle, never straight into the carousel.', ['HFO_M', 'WPI']) +
    sp('<b>Putting a tool in.</b> Hold the holder with its slots in line with the drive dogs of the spindle, push it up, press TOOL RELEASE until the holder is drawn in, and check that it is held before you let go.', ['WPI', 'UIDAHO']) +
    sp('<b>Taking a tool out.</b> Take hold of the tool before you press TOOL RELEASE: it drops as soon as it is released.', ['WPI', 'UIDAHO']) +
    sp('<b>Mount the part.</b> Fit and line up the vise or fixture, then seat the part and tighten. Workholding practice is in the <a href="#/t/cncguide">CNC knowledge guide</a>.', ['VIRASAK']) +

    '<h2 id="su-tlo">Measure the tool lengths</h2>' + suTlo() +
    sp('<b>What it is.</b> Every tool sticks out of the spindle by a different amount. The control keeps a length for each tool in its offset table, and G43 with an H number (the same number as the tool) applies it, so that a programmed Z is where the tip of that tool is.', ['LCNC_TC', 'HILL']) +
    sp('<b>On the control.</b> In HANDLE JOG, open the OFFSET page and put the cursor on the tool. Jog the tip down to the reference surface, in smaller steps as it gets close. Press TOOL OFFSET MEASURE to store the Z position as that tool\'s length, then NEXT TOOL, and repeat for every tool.', ['HFO_M', 'WPI']) +
    sp('<b>Never jog down onto a hard gauge.</b> Stop above it, then raise the tool a step at a time and try the block or feeler under the tip until it just slides in. Use the finest steps near the surface, with the spindle stopped.', ['WPI', 'CIMCO', 'UIDAHO']) +
    sp('<b>Longest tooth.</b> Set a milling cutter on its longest tooth: turn the spindle by hand and try each tooth, since they can differ by several thousandths of an inch.', ['CIMCO']) +
    sp('<b>Allow for the gauge.</b> When a block, pin or feeler was between the tool and the surface, its size has to come off the stored value: on the Haas control, type the size as a minus number and enter it after measuring.', ['WPI', 'UIDAHO']) +
    '<p class="desc">Four methods in use. What goes in the work offset Z depends on which one you choose.</p>' +
    suTable(['Method', 'How', 'For and against'], SETUP_TLO) +
    sp('<b>One method for the whole job.</b> Touch every tool on the same surface in the same way, and be sure what the work offset Z is meant to hold. Mixing two methods in one setup is how tools end up cutting too deep or cutting air.', ['CAMI', 'HURCO']) +

    '<h2 id="su-xy">Set the work offset in X and Y</h2>' + suEdge() +
    sp('<b>What it is.</b> The work offset (G54 and the others) is the machine position of part zero. Put the centre line of the spindle over the zero point, open the work offset page, and press PART ZERO SET with the cursor on X, then again on Y.', ['HFO_M', 'WPI']) +
    sp('<b>With an edge finder.</b> Clamp the part and take the burr off the edge. Hold the edge finder in a good collet or chuck and run the spindle at a modest speed: one guide gives about 1000 rpm, another says to stay under 750 rpm. Bring the tip to about half the height of the face, away from corners and chamfers.', ['TRAV', 'WPI', 'PROTOOL']) +
    sp('<b>The kick.</b> Move toward the edge slowly. The tip runs true for a moment and then jumps to one side: stop at the first jump. Back away and come in again with a smaller step to confirm it.', ['TRAV', 'WPI', 'PROTOOL']) +
    sp('<b>Half the tip.</b> At the kick the spindle centre is half the tip diameter outside the edge. Lift clear, move toward the material by that amount, and set zero there. For a 0.200 in tip that is 0.100 in; metric edge finders with a 4 mm or 10 mm tip need 2 mm or 5 mm. Zeroing at the kick without this move is the usual mistake.', ['TRAV', 'PROTOOL', 'WPI']) +
    sp('<b>The centre of a part, boss or bore.</b> Find the two opposite sides and set zero half way between them. A dial indicator held in the spindle and turned by hand does the same more finely: move the axis until both sides read alike.', ['TRAV', 'WPI']) +
    sp('<b>Limits.</b> An edge finder is for X and Y only, and its result is only as good as the run-out of the holder, the backlash of the axis and the true size of the tip. For tight positions use an indicator or a probe.', ['PROTOOL']) +
    sp('A spindle probe does the same job with a cycle: it touches the edges, bore or boss and writes the work offset by itself.', ['WPI']) +

    '<h2 id="su-z">Set the work offset in Z</h2>' +
    sp('<b>Tools touched on the part (method A):</b> the work offset Z stays at zero.', ['HFO_M', 'CAMI']) +
    sp('<b>Tools touched on a block, the table or a probe (methods B and C):</b> the work offset Z is the height from that reference surface to part zero. The control adds it to each tool length.', ['CAMI', 'HURCO', 'CIMCO']) +
    sp('<b>Measuring it with the block.</b> With a tool at the point where the block just fits over the reference surface, set the Z of the operator position display to zero. Move over the zero surface of the part, find the point where the block just fits again, and read the display: that is the work offset Z.', ['WPI']) +
    sp('<b>Measuring it with a dial indicator.</b> Fix the indicator to the spindle head, lower it onto the reference surface to a set reading and zero the display. Bring it onto the part surface to the same reading: the display shows the work offset Z.', ['WPI']) +

    '<h2 id="su-prog">Load the program</h2>' +
    sp('<b>Copy, then select.</b> Bring the program into the memory of the control from a USB stick or the network (LIST PROGRAM, choose the device, mark the file and copy it to memory). Then select it: the active program is the one that runs at CYCLE START, and the list marks it.', ['HFO_M', 'WPI']) +
    sp('Check the program name and revision against the setup sheet, and the tool list in the program against the tools you loaded.', ['OWN']) +

    '<h2 id="su-run">Run a new program safely</h2>' +
    sp('<b>Plot it first.</b> Run the program in graphics (MEM, then SETTING / GRAPHICS twice, then CYCLE START). Nothing moves. Look for alarms and for a path that is not what you expect.', ['HFO_M', 'WPI']) +
    sp('<b>Cut air.</b> Where the control has no plot, or for more confidence, run the program with Z shifted up so that the tools pass about 2 in (50 mm) above the part, and put the shift back afterwards.', ['VIRASAK', 'HILL']) +
    sp('<b>Slow the rapids.</b> Set the rapid override to 25 % or 5 % before the first run.', ['HFO_M', 'WPI']) +
    sp('<b>Stop above the part.</b> As each tool comes down, press FEED HOLD about 1 in (25 mm) above the part and compare the gap you see with the distance to go on the display. If they do not agree, stop and find out why before going on.', ['HFO_M', 'WPI']) +
    sp('<b>Single block for the approach.</b> Switch SINGLE BLOCK on for the moves down to the part and off once the tool is in its first feed move or cycle.', ['HFO_M']) +
    sp('<b>Every tool, the first time.</b> Do the same for each tool. Check that the coolant comes on. Only after a clean run of the whole program goes the rapid override back to 100 %.', ['HFO_M', 'WPI']) +
    sp('<b>Again after any change.</b> After a change to the program or the setup, or after time away from the machine, go through the checks again.', ['WPI']) +

    '<h2 id="su-adj">Measure the part and adjust</h2>' +
    sp('<b>Offsets, not edits.</b> Measure the first part. Bring a size in with the offset tables: the cutter diameter (or radius) register for the position of walls cut with cutter compensation, the tool length register for depths.', ['VIRASAK', 'HFO_MP']) +
    sp('<b>Wear column.</b> On the Haas control the compensation used is the geometry value plus the wear value, so small corrections go in wear and the measured value stays as it was.', ['HFO_MP']) +
    sp('<b>Which way.</b> With G41 or G42 on, a smaller diameter value brings the cutter closer to the programmed outline, so it takes more off the wall; a larger value leaves more on. Change it by the error you measured (per side for a radius value) and cut again.', ['HFO_MP', 'LCNC_TC', 'OWN']) +
    sp('<b>Deflection.</b> A long or slender cutter bends away from the wall and leaves it oversize, most at the bottom. An offset corrects the size but not the taper; a light finishing pass or a shorter stick-out does. See the <a href="#/t/deflection">tool deflection</a> calculator.', ['OWN']) +

    '<h2 id="su-end">Shut down</h2>' +
    sp('<b>Leave it as you found it.</b> Take the part out of the vise and the tool out of the spindle, clear the chips, wipe down and put the tools away.', ['VIRASAK', 'WPI']) +
    sp('<b>Chips.</b> Brush chips off, wash them toward the chip tray with the coolant hose and rake them out. An air hose is for blowing coolant off the part gently, never for blowing chips off the part or the table. Take the vise handle out of the machine.', ['WPI']) +
    sp('<b>Power off</b> the way the machine manual says; on the Haas control the POWER OFF key shuts the machine down.', ['HFO_M']) +

    '<h2 id="su-src">Sources</h2><ul class="gsl">' + Object.entries(SETUP_SOURCES).map(([k, v]) => '<li><b>' + k + '</b> ' + gesc(v) + '</li>').join('') + '</ul>' +
    '<p class="desc">Full URLs and access dates are in docs/sources.md, "CNC mill setup guide". No text, figures or tables were copied from the sources.</p>';
  el.querySelectorAll('.gtoc a').forEach(a => a.onclick = e => { e.preventDefault(); const t = el.querySelector(a.getAttribute('href')); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
}
