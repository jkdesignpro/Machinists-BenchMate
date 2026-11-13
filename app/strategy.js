'use strict';
// Milling strategy decider (0.8.0). Which roughing strategy suits the feature, the tool reach and the machine:
// adaptive or trochoidal (high-efficiency milling), traditional roughing, plunge roughing, high-feed milling.
// Every reason is a statement from the sources below, with its key; a statement printed by one publisher only
// says so. Where the sources disagree (how rigid a machine HEM needs) both are shown. BenchMate's own choices
// (when a reach counts as long) are named as such. Nothing here is a calculation: it is a reading of the sources.
const MS_SOURCES = {
  BALL_MMT: 'J. Ball (Seco Tools), "The Hidden Complexities of Optimized Roughing", MoldMaking Technology, 14 June 2018.',
  GRANDT_PI: 'D. Grandt and S. Tiehen (Harvey Performance), "Boosting Shop Productivity by Applying High Efficiency Milling Techniques", Productivity Inc. blog, 27 February 2020.',
  LEVENTON_CTE: 'W. Leventon, "Lauding Light Cutting", Cutting Tool Engineering, 15 August 2025 (quoting machine builders, tool and CAM makers).',
  SOLIDCAM_AM: 'SolidCAM, "Adaptive Milling: Toolpath Strategies", SolidCAM blog, 27 August 2026.',
  KENNEDY_CTE: 'B. Kennedy, "Plunge Milling Improves Metal Removal in Deep Machining", Cutting Tool Engineering, 1 March 2012.',
  AM_LOWPOWER: '"Faster Chipmaking On Low-Power Machines", American Machinist, 12 August 2010.',
  TUNG_HF: 'Tungaloy, "High feed knowledge academy" (tungaloy.com, no date); and M. van den Hoonaard (Tungaloy Germany), "New tasks for high-feed milling", industrial-production.de, 27 January 2022. One publisher (Tungaloy).',
};
const MS_STATE = { feat: 3, depth: '', dia: '', reach: '', mat: 2, cam: 1, small: '', rig: '', guide: '' };
function msKeys(keys) { return keys.map(k => '<abbr class="gsrc" title="' + rEsc(MS_SOURCES[k] || k) + '">' + k + '</abbr>').join(' '); }
function renderMillStrategy(el) {
  const s = MS_STATE, m = typeof Profiles !== 'undefined' ? Profiles.active() : null;
  const opt = (id, list, v) => '<select data-k="' + id + '">' + list.map(([k, t]) => '<option value="' + k + '"' + (String(v) === String(k) ? ' selected' : '') + '>' + rEsc(t) + '</option>').join('') + '</select>';
  const fld = (label, inner, unit) => '<label class="f"><span>' + label + '</span><div class="row">' + inner + '<span class="u">' + (unit || '') + '</span></div></label>';
  const num = (id, v) => '<input data-k="' + id + '" type="number" step="any" value="' + rEsc(v) + '">';
  // Machine answers: the active machine profile unless chosen here.
  const fromProf = { small: m && m.small, rig: m && m.rigidity, guide: m && [m.gx, m.gy, m.gz].find(g => g && g !== 'Not known') };
  const smallV = s.small || (fromProf.small && fromProf.small !== 'Not known' ? fromProf.small : 'Not known');
  const rigV = s.rig || (fromProf.rig || 'Medium'), guideV = s.guide || (fromProf.guide || 'Not known');
  el.innerHTML = '<p class="desc">Answer what you know about the job and the machine. Each roughing strategy is marked as a good fit, possible, or not suited, with the reasons the sources give. It reads published advice; it does not work out speeds or feeds (use the advisors for those).</p>' +
    '<h3 class="msh">The job</h3><div class="grid" style="max-width:860px">' +
    fld('Feature', opt('feat', [[1, 'Face or open shoulder'], [3, 'Slot'], [4, 'Pocket with straight walls'], [5, '3D surface or contour'], [6, 'Thin wall or thin floor']], s.feat)) +
    fld('Depth of the feature', num('depth', s.depth), uLen()) + fld('Tool diameter', num('dia', s.dia), uLen()) +
    fld('Tool reach (out of the holder)', num('reach', s.reach), uLen()) +
    fld('Material', opt('mat', [[1, 'Aluminium, brass, plastics'], [2, 'Steel, cast iron'], [3, 'Stainless steel'], [4, 'Titanium, nickel alloys'], [5, 'Hardened steel']], s.mat)) +
    fld('Your CAM has adaptive or trochoidal toolpaths', opt('cam', [[1, 'Yes'], [0, 'No']], s.cam)) + '</div>' +
    '<h3 class="msh">The machine' + (m ? ' <small>(from ' + rEsc(m.name) + ' where it says)</small>' : ' <small>(no active machine: answer here, or fill in Machine profiles)</small>') + '</h3><div class="grid" style="max-width:860px">' +
    fld('Many short moves (3D code, trochoidal paths)', opt('small', ['Not known', 'Runs them smoothly at the programmed feed', 'Slows down but keeps going', 'Stutters or stops between moves'].map(x => [x, x]), smallV)) +
    fld('Rigidity class', opt('rig', ['Light (bench or hobby machine)', 'Medium', 'Heavy'].map(x => [x, x]), rigV)) +
    fld('Guideways', opt('guide', ['Not known', 'Linear guides (rails)', 'Box ways (hardened and ground)', 'Dovetail ways', 'Hydrostatic ways'].map(x => [x, x]), guideV)) + '</div>' +
    '<div id="msres"></div>' +
    '<p class="desc" style="margin-top:14px">See also the Toolpaths guide (which toolpath for which feature, 3D toolpaths), Radial chip thinning feed, Chip thinning: entering angle and round inserts (for high-feed cutters), and the Plunge roughing advisor.</p>' +
    '<h2 id="ms-src">Sources</h2><ul class="gsl">' + Object.entries(MS_SOURCES).map(([k, v]) => '<li><b>' + k + '</b> ' + rEsc(v) + '</li>').join('') + '</ul>';
  el.querySelectorAll('[data-k]').forEach(i => { i.oninput = i.onchange = () => { s[i.dataset.k] = i.value; draw(); }; });
  function draw() {
    const feat = +s.feat, mat = +s.mat, cam = +s.cam === 1, dia = parseFloat(s.dia), depth = parseFloat(s.depth), reach = parseFloat(s.reach);
    const small = (el.querySelector('[data-k="small"]') || {}).value, rig = (el.querySelector('[data-k="rig"]') || {}).value, guide = (el.querySelector('[data-k="guide"]') || {}).value;
    const deep = dia > 0 && depth > 0 ? depth / dia : NaN, longR = dia > 0 && reach > 0 ? reach / dia : NaN;
    const light = /^Light/.test(rig), stutter = /^Stutters/.test(small), slows = /^Slows/.test(small), smooth = /^Runs/.test(small);
    // [sign, text, keys, one publisher?]  sign: 1 for, 0 to know, -1 against, -2 rules it out
    const R = (sign, text, keys, one) => ({ sign, text, keys, one });
    const S = [];
    // Adaptive / trochoidal (high-efficiency milling)
    const a = [];
    if (!cam) a.push(R(-2, 'Your CAM cannot make these toolpaths; they are generated by CAM software.', ['GRANDT_PI', 'SOLIDCAM_AM']));
    if (feat === 3 || feat === 4) a.push(R(1, 'Trochoidal paths keep the load even in slots and pockets, where straight passes meet sudden load changes in slots and corners.', ['SOLIDCAM_AM', 'LEVENTON_CTE']));
    if (feat === 4 || feat === 3) a.push(R(1, 'Best on straight-walled cavities and simple prismatic features, starting from solid.', ['BALL_MMT'], true));
    if (feat === 5) a.push(R(-1, 'The large depths of cut leave big stair steps on 3D surfaces; it is not for complex 3D contours.', ['BALL_MMT'], true));
    if (stutter) a.push(R(-2, 'Trochoidal motion needs many more lines of code, and a control without the processing speed and look-ahead gives jerky motion that can gouge, chatter and spoil the finish.', ['BALL_MMT', 'LEVENTON_CTE', 'SOLIDCAM_AM']));
    else if (slows) a.push(R(0, 'A control that slows down on short moves will not hold the programmed feed: the cycle runs longer than the CAM says, and the sources say the operation then does not run as it should. Run a test cut first.', ['LEVENTON_CTE', 'SOLIDCAM_AM']));
    else if (smooth) a.push(R(1, 'The control keeps up with many short moves, which this needs.', ['BALL_MMT', 'LEVENTON_CTE']));
    else a.push(R(0, 'Needs a control fast enough for many short moves: the sources say an older machine may not manage it. Try it on a test cut and watch whether the feed holds.', ['BALL_MMT', 'GRANDT_PI', 'LEVENTON_CTE']));
    if (light) a.push(R(0, 'Sources differ on a light machine. Ball and Grandt write that it needs a rigid machine and good spindles; SolidCAM that the deep axial cut needs a rigid tool, holder, fixture and machine. A machine builder quoted by Leventon says it lets shops cut hard materials on machines not big and rigid enough for conventional milling.', ['BALL_MMT', 'GRANDT_PI', 'SOLIDCAM_AM', 'LEVENTON_CTE']));
    if (deep > 2) a.push(R(0, 'Ball keeps the tool diameter at least half the depth of cut (depth up to 2 x D); deeper, the cutting pressure deflects the tool and the chips form badly. This feature is ' + deep.toFixed(1) + ' x D deep.', ['BALL_MMT'], true));
    if (mat >= 3) a.push(R(1, 'Now used on stainless, nickel alloys and other hard-to-cut materials, not only aluminium and brass.', ['LEVENTON_CTE'], true));
    a.push(R(0, 'Tools: end mills with 5 to 9 flutes (Ball), or 5, 6, 7 and more (Grandt), using the whole flute length.', ['BALL_MMT', 'GRANDT_PI']));
    S.push(['Adaptive or trochoidal (high-efficiency milling)', 'Light radial step-over, deep axial cut, constant engagement.', a]);
    // Traditional roughing
    const t = [];
    t.push(R(1, 'Works on any machine and control: straight passes need far fewer lines of code than trochoidal paths.', ['BALL_MMT'], true));
    if (feat === 3 || feat === 4) t.push(R(-1, 'Straight passes are more sensitive to sudden load changes in slots, corners and heavy engagement; offset paths give lower removal rates and tool life.', ['SOLIDCAM_AM', 'GRANDT_PI']));
    if (stutter) t.push(R(1, 'Your control stutters on many short moves, so simple passes are the safe choice.', ['LEVENTON_CTE', 'SOLIDCAM_AM']));
    S.push(['Traditional roughing', 'Offset or zig-zag passes at a fixed step-over and step-down.', t]);
    // Plunge roughing
    const p = [];
    p.push(R(1, 'The cutting forces are axial, into the spindle and table, the strongest direction; the side forces on cutter, part and machine go away, which also eases the fixturing.', ['AM_LOWPOWER', 'KENNEDY_CTE']));
    if (light) p.push(R(1, 'Suits old, less rigid, light or low-power machines.', ['KENNEDY_CTE', 'AM_LOWPOWER']));
    if (longR > 3 || deep > 3) p.push(R(1, 'Suits long reach and deep features, where side milling is held back by chatter. (BenchMate counts over 3 x D as long; no source sets a line.)', ['KENNEDY_CTE'], true));
    if (longR >= 4) p.push(R(0, 'Even plunging starts to chatter at 4 to 6 diameters of reach.', ['KENNEDY_CTE'], true));
    if (/Linear/.test(guide)) p.push(R(0, 'A machine builder notes that a linear-guide machine does not take the chip load a box-way machine can when plunging.', ['KENNEDY_CTE'], true));
    if (/Box/.test(guide)) p.push(R(1, 'Box ways: a machine builder notes they take more chip load in plunging than linear guides.', ['KENNEDY_CTE'], true));
    if (mat === 3) p.push(R(1, 'Keeps the heat low, which helps in stainless steel.', ['KENNEDY_CTE'], true));
    if (feat === 5) p.push(R(-1, 'A roughing method: it leaves scallops, and the step-over must suit the cutter or it can crash.', ['KENNEDY_CTE'], true));
    else p.push(R(0, 'Roughing only: it leaves scallops to clean up. Do not retract into a scallop just cut.', ['KENNEDY_CTE'], true));
    S.push(['Plunge roughing', 'Drilling-like plunges side by side, then the walls are finished.', p]);
    // High-feed milling
    const h = [];
    h.push(R(1, 'Shallow axial depth and a very high feed per tooth; the force is mostly axial, towards the spindle, so it vibrates little.', ['TUNG_HF']));
    if (light) h.push(R(1, 'Works on low-power machines: low cutting forces, cut shallow and feed fast. On a light machine, raise the settings gradually.', ['TUNG_HF', 'AM_LOWPOWER']));
    if (longR > 3) h.push(R(1, 'Suited to long tool projection.', ['TUNG_HF'], true));
    if (feat === 6) h.push(R(-1, 'The axial force can push thin or weakly supported parts out of shape.', ['TUNG_HF'], true));
    if (feat === 1 || feat === 4) h.push(R(1, 'Fast roughing of faces, cavities and deep pockets in many shallow passes.', ['TUNG_HF'], true));
    if (feat === 3) h.push(R(0, 'Not for deep axial cuts or for finishing walls; walls are finished with another tool.', ['TUNG_HF'], true));
    if (stutter || slows) h.push(R(0, 'Needs a machine that runs a high table feed with enough acceleration and control response.', ['TUNG_HF'], true));
    S.push(['High-feed milling', 'Small entering angle (below 30 degrees), shallow depth, very high feed.', h]);
    // Verdict: anything that rules it out; otherwise for-reasons against against-reasons.
    const verdict = rs => rs.some(r => r.sign === -2) ? ['Not suited', 'over'] : rs.filter(r => r.sign === 1).length - rs.filter(r => r.sign === -1).length >= 2 ? ['Good fit', 'good'] : rs.some(r => r.sign === -1) && rs.filter(r => r.sign === 1).length <= rs.filter(r => r.sign === -1).length ? ['Less suited', 'caution'] : ['Possible', 'note'];
    const rank = { good: 0, note: 1, caution: 2, over: 3 };
    const out = S.map(x => [x, verdict(x[2])]).sort((p1, p2) => rank[p1[1][1]] - rank[p2[1][1]]);
    const mark = { 1: '+', 0: 'i', '-1': '−', '-2': '×' };
    $('#msres', el).innerHTML = '<h3 class="msh">Strategies</h3>' + out.map(([[name, what, rs], [word, cls]]) => '<div class="tmcard mscard"><div class="msv ' + cls + '"><b>' + rEsc(name) + '</b><span>' + word + '</span></div><p class="desc">' + rEsc(what) + '</p><ul>' +
      rs.map(r => '<li class="' + (r.sign > 0 ? 'good' : r.sign < 0 ? 'over' : 'note') + '"><span class="msm">' + mark[r.sign] + '</span> ' + rEsc(r.text) + (r.one ? ' <span class="gtbv">(one publisher, to be verified)</span>' : '') + ' ' + msKeys(r.keys) + '</li>').join('') + '</ul></div>').join('') +
      '<p class="desc">"Good fit" has at least two more reasons for than against; anything that rules a strategy out marks it "Not suited". This weighting is BenchMate\'s own; read the reasons.</p>';
  }
  draw();
}
