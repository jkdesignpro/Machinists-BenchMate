'use strict';
// Stability chart (stability lobes) with a draggable speed marker, shown inside the milling advisor.
// All the maths is in the Rust core (core/src/lobes.rs); this file samples the limit across the
// speed axis, draws it and words the result. Sources: docs/sources.md, "Stability chart".

// Density of the tool material, kg/m3: solid carbide (Ceratizit CTS20L, 14.45 g/cm3), HSS M2 (voestalpine data sheet, 8.07 kg/dm3).
const LOBE_RHO = { 1: 14450, 2: 8070 };
// Used when nothing is measured: the damping ratio of the worked milling example in Tyler and Schmitz (2013),
// and the force angle they measured for a 19 mm cutter. Both are stand-ins and the chart says so.
const LOBE_ZETA = 0.03, LOBE_BETA = 62;
const LOBE_MARK = {};

// o: { d, L (mm), e (GPa), tm, z, ae, D (mm), kc (N/mm2), fnat (Hz), ktip (N/mm), zeta, beta (deg) }
function lobeModel(W, o) {
  const fn = o.fnat > 0 ? o.fnat : W.cantilever_fn_hz(o.d, o.L, o.e, LOBE_RHO[o.tm] || LOBE_RHO[1]);
  const k = o.ktip > 0 ? o.ktip : W.cantilever_tip_stiffness(o.d, o.L, o.e);
  const zeta = o.zeta > 0 ? o.zeta : LOBE_ZETA, beta = o.beta > 0 && o.beta < 90 ? o.beta : LOBE_BETA;
  const ks = W.ks_resultant(o.kc, beta), nts = W.teeth_engaged(o.z, Math.min(o.ae, o.D), o.D);
  if (!(fn > 0 && k > 0 && ks > 0 && nts > 0 && o.z > 0)) return null;
  return { fn, k, zeta, beta, ks, nts, z: o.z, own: { fn: o.fnat > 0, k: o.ktip > 0, zeta: o.zeta > 0, beta: o.beta > 0 },
    crit: W.lobe_critical_depth(k, zeta, ks, beta, nts),
    lim: rpm => W.lobe_limit_at_rpm(k, zeta, fn, ks, beta, nts, o.z, rpm, 0),
    at: rpm => [0, 1, 2].map(i => W.lobe_limit_at_rpm(k, zeta, fn, ks, beta, nts, o.z, rpm, i)),
    // best speeds either side of a speed: tooth passing frequency = natural frequency / whole number
    pockets: rpm => { const q = W.chatter_ratio(fn, rpm, o.z), lo = Math.ceil(q) - 1, hi = Math.floor(q) - 1; return [lo >= 0 ? W.stable_rpm(fn, o.z, lo) : NaN, hi >= 0 ? W.stable_rpm(fn, o.z, hi) : NaN]; },
    ratio: rpm => W.chatter_ratio(fn, rpm, o.z) };
}

// Fill `el` with the chart. opt: { key, rpm (the advisor's speed), ap (mm), nmax, inch, use(rpm) }.
function lobeChartMount(el, m, opt) {
  const Wd = 520, H = 250, x0 = 56, x1 = 506, y0 = 206, y1 = 22, k = opt.inch ? IN_MM : 1, lu = opt.inch ? 'in' : 'mm', dp = opt.inch ? 4 : 3;
  const top = opt.nmax > 0 ? opt.nmax : Math.max(opt.rpm * 2.5, 6000);
  const xmax = Math.min(top, Math.max(opt.rpm * 1.6, 1000)), xmin = Math.max(100, Math.min(opt.rpm * 0.5, xmax * 0.5));
  const ymax = Math.max(m.crit * 4, opt.ap * 1.25);
  const X = n => x0 + (x1 - x0) * (n - xmin) / (xmax - xmin), Y = b => y0 - (y0 - y1) * Math.min(b, ymax) / ymax;
  const pts = [], NS = 900;
  for (let i = 0; i <= NS; i++) { const n = xmin + (xmax - xmin) * i / NS, b = m.lim(n); if (isFinite(b)) pts.push([X(n), Y(b)]); }
  let s = DK.line(x0, y0, x1, y0, 'thin') + DK.line(x0, y0, x0, y1 - 6, 'thin');
  // unstable region above the boundary, stable below
  if (pts.length > 1) s += DK.path('M' + x0 + ' ' + y1 + 'L' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L') + 'L' + x1 + ' ' + y1 + 'Z', 'lobeun') + DK.path('M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L'), 'ln');
  s += DK.line(x0, Y(m.crit), x1, Y(m.crit), 'dim ext') + DK.text(x1 - 4, Y(m.crit) + 13, 'stable at every speed: ' + fmt(m.crit / k, dp) + ' ' + lu, { cls: 'dimt', anchor: 'end' });
  s += DK.text(x0 + 6, y1 + 12, 'chatter', { cls: 'mut', anchor: 'start' }) + DK.text(x0 - 6, y1 + 4, fmt(ymax / k, opt.inch ? 3 : 1), { cls: 'mut', anchor: 'end' }) + DK.text(x0 - 6, y0 + 4, '0', { cls: 'mut', anchor: 'end' });
  s += DK.text(x0, y0 + 16, fmt(xmin, 0), { cls: 'mut', anchor: 'start' }) + DK.text(x1, y0 + 16, fmt(xmax, 0) + ' RPM', { cls: 'mut', anchor: 'end' }) + DK.text(14, (y0 + y1) / 2, 'depth of cut, ' + lu, { cls: 'mut', rot: -90 });
  // the advisor's own cut
  if (opt.rpm >= xmin && opt.rpm <= xmax) s += DK.circle(X(opt.rpm), Y(opt.ap), 4, 'dimf') + DK.text(X(opt.rpm) + 7, Y(opt.ap) - 6, 'this cut', { cls: 'dimt', anchor: 'start' });
  s += '<g class="lobemk"><line class="hot" x1="0" y1="' + (y1 - 4) + '" x2="0" y2="' + y0 + '"/><circle class="hotf" cx="0" cy="' + (y1 - 4) + '" r="6"/><circle class="hotf lobedot" cx="0" cy="0" r="3.5"/></g>';
  el.innerHTML = '<div class="rtabh"><span>Stability chart: where chatter starts (simple tool model)</span></div>' + DK.svg(Wd, H, s, 'Stability chart: limiting depth of cut against spindle speed, with a marker you can drag') +
    '<input type="range" class="lobesl" min="' + Math.ceil(xmin) + '" max="' + Math.floor(xmax) + '" step="1" aria-label="Spindle speed marker"><div class="lobeout" aria-live="polite"></div><div class="lobebtn"></div><p class="lobenote"></p>';
  const svg = el.querySelector('svg'), mk = el.querySelector('.lobemk'), dot = el.querySelector('.lobedot'), sl = el.querySelector('.lobesl'), out = el.querySelector('.lobeout'), btn = el.querySelector('.lobebtn');
  svg.classList.add('lobe');
  let cur = LOBE_MARK[opt.key];
  if (!(cur >= xmin && cur <= xmax)) cur = Math.min(xmax, Math.max(xmin, opt.rpm));
  const show = n => {
    cur = Math.min(xmax, Math.max(xmin, n)); LOBE_MARK[opt.key] = cur; sl.value = Math.round(cur);
    const a = m.at(cur), b = a[0], pk = m.pockets(cur), gap = pk[1] - pk[0];
    mk.setAttribute('transform', 'translate(' + X(cur).toFixed(1) + ' 0)'); dot.setAttribute('cy', Y(b).toFixed(1));
    const ok = opt.ap <= b * (1 + 1e-9), slow = isFinite(gap) && gap < 0.05 * cur;
    let t = '<b>At ' + fmt(cur, 0) + ' RPM</b> the model keeps the cut steady up to <b>' + fmt(b / k, dp) + ' ' + lu + '</b> deep (chatter would start near ' + fmt(a[1], 0) + ' Hz). ' +
      'This cut is ' + fmt(opt.ap / k, dp) + ' ' + lu + ' deep: <b class="' + (ok ? 'lobeok' : slow ? '' : 'lobebad') + '">' + (ok ? 'inside' : 'above') + '</b> that line.';
    if (slow) t += '<br>The best speeds here (just above ' + [pk[0], pk[1]].filter(x => isFinite(x)).map(x => fmt(x, 0)).join(' and ') + ' RPM) are only ' + fmt(gap, 0) + ' RPM apart, too close to aim for.' +
      (ok ? '' : ' Cuts above the line are common at low speeds: the flank of the tool rubs out short chatter waves (process damping, which grows as the cutting speed falls), and this simple model leaves that out. It cannot say whether this cut will chatter: listen to it.');
    else if (isFinite(pk[0]) || isFinite(pk[1])) t += '<br>Nearest best speeds: ' + [pk[0], pk[1]].filter(x => isFinite(x)).map(x => 'just above ' + fmt(x, 0) + ' RPM').join(' and ') + '.' + (ok ? '' : ' Drag the marker into a pocket, or take a shallower cut.');
    out.innerHTML = t;
    btn.innerHTML = '';
    if (opt.use && Math.abs(cur - opt.rpm) > 0.5) { const bt = document.createElement('button'); bt.type = 'button'; bt.className = 'btn sm'; bt.innerHTML = icon('arrow') + '<span>Run the advisor at ' + fmt(cur, 0) + ' RPM</span>'; bt.onclick = () => opt.use(cur); btn.appendChild(bt); }
  };
  const fromEvent = e => { const r = svg.getBoundingClientRect(), xv = (e.clientX - r.left) * Wd / r.width; return xmin + (xmax - xmin) * (xv - x0) / (x1 - x0); };
  let drag = false;
  svg.addEventListener('pointerdown', e => { drag = true; try { svg.setPointerCapture(e.pointerId); } catch (x) {} show(fromEvent(e)); e.preventDefault(); });
  svg.addEventListener('pointermove', e => { if (drag) show(fromEvent(e)); });
  const stop = () => { drag = false; };
  svg.addEventListener('pointerup', stop); svg.addEventListener('pointercancel', stop);
  sl.addEventListener('input', () => show(Number(sl.value)));
  el.querySelector('.lobenote').textContent = 'A simple model: ' + (m.own.fn && m.own.k ? 'your tap test figures' : 'the tool alone as a round bar clamped at the holder face') + ', one vibration mode at ' + fmt(m.fn, 0) + ' Hz, stiffness ' +
    fmt(m.k, 0) + ' N/mm, damping ratio ' + m.zeta + (m.own.zeta ? '' : ' (assumed)') + ', force angle ' + m.beta + ' degrees' + (m.own.beta ? '' : ' (assumed)') +
    '. The holder and spindle are left out and often set the real chatter frequency, and at low speeds real cuts are steadier than this (process damping). Use it to see how stick-out, teeth and width move the limit; for your own machine record the chatter in the Chatter finder, or enter a tap test in Expert mode. Drag the marker, or use the slider.';
  show(cur);
}
