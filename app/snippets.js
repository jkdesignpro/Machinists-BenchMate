'use strict';
// G-code snippets on the calculators: the few blocks a result turns into, in the dialect of the
// control picked. The blocks are written by the Rust core (core/src/gcode.rs): the same generators
// as the cycle pages, which mark their cycle blocks, and gen_words for spindle and feed words.
// This file reads the inputs, converts TPI to pitch, and shows the text. See docs/snippets.md.
// Uses cycles.js (cyState, cyRun, cyStr, CTRLS, CYC, CY_DRILL_DEFS), shop.js (sfield, sinp, sesc,
// snum, stable) and app.js (copyText, handoff, icon, fmt).

const SNIP_OPEN = {};          // which boxes are open, per tool
const SNIP_W = {};             // spindle and feed words: the choices made, per tool and unit system
const SNIP_CTRL = { v: null }; // the control picked in a box (null: taken from the active machine)

// Control id (CTRLS in cycles.js) from the free-text "Control" of the active machine, or null.
function snipCtrlFromMachine() {
  const m = typeof Profiles !== 'undefined' ? Profiles.active() : null, t = m && m.control ? String(m.control).toLowerCase() : '';
  if (!t) return null;
  if (t.includes('haas')) return 1;
  if (t.includes('mitsubishi') || t.includes('meldas')) return 2;
  if (t.includes('siemens') || t.includes('sinumerik')) return 3;
  if (t.includes('heidenhain')) return 4;
  if (t.includes('okuma')) return 5;
  if (t.includes('fanuc')) return 0;
  return null;
}
function snipCtrl() { if (SNIP_CTRL.v != null) return SNIP_CTRL.v; const c = snipCtrlFromMachine(); return c == null ? 0 : c; }
function snipMachineIsLathe() {
  const m = typeof Profiles !== 'undefined' ? Profiles.active() : null;
  return !!(m && m.type && /lathe/i.test(m.type));
}

// Draw a snippet box into host.
// spec.kind 'holes': a drilling or tapping cycle. spec.holes [[x, y], ...] in the units on screen (left out: one
//   hole at an X and Y typed in the box); spec.set { z, pitch, cycle, ... } values this page fixes (shown, not typed);
//   spec.init { ... } first values of the box; spec.from: the page name for the hand-off message.
// spec.kind 'words': spindle start and feed word. spec.rpm; spec.v surface speed (lets a lathe use G96);
//   spec.feed per minute; spec.feedRev per revolution (lathe); spec.lathe true or false (left out: asked in the box).
function snipBox(host, spec) {
  const W = state.W, sys = state.sys, inch = sys === 'inch', u = lenU(sys);
  const holesKind = spec.kind === 'holes';
  const cycleId = holesKind ? CYC.DRILL : CYC.WORDS;
  let s;
  if (holesKind) s = cyState('snip:' + spec.id, i => Object.assign(CY_DRILL_DEFS(i), { rpm: '', feed: '', z: '', hx: 0, hy: 0 }, spec.init || {}));
  else { const k = spec.id + ':' + sys; s = SNIP_W[k] || (SNIP_W[k] = { mach: snipMachineIsLathe() ? 1 : 0, css: 0, vmax: '', per: 1 }); }
  const fixed = (holesKind && spec.set) || {};
  Object.keys(fixed).forEach(k => { s[k] = String(fixed[k]); });
  const tap = () => +s.cycle === 84;
  const lathe = () => spec.lathe === undefined ? +s.mach === 1 : !!spec.lathe;
  const css = () => lathe() && spec.v > 0 && +s.css === 1;
  const bothFeeds = () => lathe() && spec.feedRev > 0 && spec.feed > 0;
  const ctrlSel = { k: 'ctrl', label: 'Control (output dialect)', sel: CTRLS.map(([v, t]) => { const ok = W.cyc_supported(v, cycleId) === 1; return [v, ok ? t : t + ' (not yet supported)', !ok]; }) };
  const fields = holesKind ? [ctrlSel,
    { k: 'cycle', label: 'Cycle', sel: [[81, 'G81 drill'], [82, 'G82 drill with dwell'], [83, 'G83 peck (full retract)'], [73, 'G73 chip break peck'], [84, 'G84 tap (right hand)']] },
    { k: 'rigid', label: 'Tapping', sel: [[1, 'Rigid'], [0, 'Floating holder']], show: tap },
    { k: 'ret', label: 'Between holes return to', sel: [[1, 'R plane (G99)'], [0, 'Initial Z (G98)']] },
    { k: 'rpm', label: 'Spindle speed', unit: 'RPM' },
    { k: 'feed', label: 'Feed', unit: feedMinU(sys), show: () => !tap() },
    { k: 'pitch', label: inch ? 'Tap threads per inch' : 'Tap pitch', unit: inch ? 'TPI' : 'mm', show: tap },
    { k: 'zi', label: 'Initial Z (clearance)', unit: u }, { k: 'r', label: 'R plane', unit: u }, { k: 'z', label: 'Hole bottom Z', unit: u },
    { k: 'q', label: 'Peck depth Q', unit: u, show: () => +s.cycle === 83 || +s.cycle === 73 },
    { k: 'dwell', label: 'Dwell at the bottom', unit: 's', show: () => +s.cycle === 82 },
    { k: 'hx', label: 'Hole X', unit: u, show: () => !spec.holes }, { k: 'hy', label: 'Hole Y', unit: u, show: () => !spec.holes },
  ] : [ctrlSel,
    { k: 'mach', label: 'Machine', sel: [[0, 'Mill'], [1, 'Lathe']], show: () => spec.lathe === undefined },
    { k: 'css', label: 'Spindle', sel: [[0, 'Fixed rpm (G97)'], [1, 'Constant surface speed (G96)']], show: () => lathe() && spec.v > 0 },
    { k: 'vmax', label: 'Max spindle speed (G50 clamp; blank = active machine)', unit: 'RPM', show: css },
    { k: 'per', label: 'Feed word', sel: [[1, 'Per revolution (G99)'], [0, 'Per minute (G98)']], show: bothFeeds },
  ];
  const val = f => f.k === 'ctrl' ? snipCtrl() : s[f.k];
  const fieldHtml = f => {
    if (f.sel) return sfield(f.label, '<select data-k="' + f.k + '"' + (f.k in fixed ? ' disabled' : '') + '>' + f.sel.map(([v, t, dis]) => '<option value="' + v + '"' + (String(v) === String(val(f)) ? ' selected' : '') + (dis ? ' disabled' : '') + '>' + sesc(t) + '</option>').join('') + '</select>', f.k in fixed ? 'from this page' : '');
    return sfield(f.label, sinp(f.k, s[f.k], 110, f.k in fixed ? ' disabled' : ''), (f.unit || '') + (f.k in fixed ? ', from this page' : ''));
  };
  const nHoles = holesKind && spec.holes ? spec.holes.length : 1;
  const title = spec.title || (holesKind ? (nHoles > 1 ? 'G-code: a drilling or tapping cycle at these ' + nHoles + ' holes' : 'G-code: a drilling or tapping cycle for this hole') : 'G-code: spindle and feed words');
  const draw = () => {
    host.innerHTML = '<details class="cysec rsnip" data-kept="1"' + (SNIP_OPEN[spec.id] ? ' open' : '') + '><summary><span class="cysh">' + sesc(title) + '</span><span class="cyst ms">the blocks only, for the control you pick</span></summary>' +
      '<div class="cysb"><div class="grid">' + fields.filter(f => !f.show || f.show()).map(fieldHtml).join('') + '</div><div class="snipout"></div></div></details>';
    const d = host.querySelector('details');
    d.addEventListener('toggle', () => { SNIP_OPEN[spec.id] = d.open; if (d.open) calc(); });
    host.querySelectorAll('[data-k]').forEach(i => {
      i.oninput = i.onchange = () => {
        const k = i.dataset.k;
        if (k === 'ctrl') { SNIP_CTRL.v = +i.value; draw(); return; }
        if (s[k] === i.value) return;
        s[k] = i.value;
        if (i.tagName === 'SELECT') draw(); else calc();
      };
    });
    if (d.open) calc();
  };
  const holes = () => spec.holes || [[snum(s.hx), snum(s.hy)]];
  const calc = () => {
    const out = host.querySelector('.snipout'); if (!out) return;
    let p, note = '';
    if (holesKind) {
      const hs = holes(), pitch = tap() ? (inch ? 1 / snum(s.pitch) : snum(s.pitch)) : NaN;
      p = [inch ? 0 : 1, snipCtrl(), 1, 1, +s.cycle, +s.rigid, +s.ret, 54, snum(s.rpm), snum(s.feed), pitch, snum(s.zi), snum(s.r), snum(s.z), snum(s.q), +s.cycle === 82 ? snum(s.dwell) : 0, 0, hs.length];
      hs.forEach(h => p.push(h[0], h[1]));
      if (tap() && pitch > 0 && snum(s.rpm) > 0) note = 'Tap feed = pitch x rpm = ' + fmt(W.tap_feed(pitch, snum(s.rpm)), inch ? 4 : 2) + ' ' + feedMinU(sys) + '. ';
    } else {
      const m = typeof Profiles !== 'undefined' ? Profiles.active() : null;
      const vmax = snum(s.vmax) > 0 ? snum(s.vmax) : (m && Number(m.rpm_max) > 0 ? Number(m.rpm_max) : NaN);
      const perRev = lathe() && spec.feedRev > 0 && (!(spec.feed > 0) || +s.per === 1);
      const feed = lathe() ? (perRev ? spec.feedRev : spec.feed) : spec.feed;
      p = [inch ? 0 : 1, snipCtrl(), 0, 0, lathe() ? 1 : 0, css() ? 1 : 0, css() ? spec.v : NaN, css() ? vmax : NaN, css() ? NaN : spec.rpm, perRev ? 1 : 0, feed > 0 ? feed : NaN];
      if (!lathe() && spec.feedRev > 0 && !(spec.feed > 0)) note = 'A mill feed word is per minute: this page has no feed per minute to give. ';
    }
    const res = cyRun(cycleId, p);
    if (!res.ok) {
      const unsup = W.cyc_supported(snipCtrl(), cycleId) !== 1;
      out.innerHTML = '<div class="res">' + stable('G-code', [[unsup ? 'No blocks for ' + sesc((CTRLS.find(c => c[0] === snipCtrl()) || [0, 'this control'])[1]) + ': its format is not confirmed from the maker\'s manual yet. Pick Generic ISO 6983 / Fanuc-style or Haas to see the blocks, and check them against your own manual.' : sesc(res.err), '', '']]) + '</div>';
      return;
    }
    out.innerHTML = '<div class="mfilter" style="margin-top:8px"><button type="button" class="btn sm" data-a="copy">' + icon('copy') + '<span>Copy the blocks</span></button>' +
      (holesKind ? '<button type="button" class="btn sm" data-a="full">' + icon('arrow') + '<span>Open in the full generator</span></button>' : '') + '</div>' +
      '<pre class="gcode snipt"></pre><div class="ms snipnote">' + sesc(note) + 'These blocks are not a whole program: the comment lines at the top say what must already be set. ' +
      (SNIP_CTRL.v == null ? (snipCtrlFromMachine() == null ? 'No control is named in the active machine, so the Generic ISO / Fanuc-style form is shown.' : 'The control comes from the active machine.') : '') + '</div>';
    out.querySelector('.snipt').textContent = res.snippet;
    out.querySelector('[data-a="copy"]').onclick = () => copyText(res.snippet);
    const full = out.querySelector('[data-a="full"]');
    if (full) full.onclick = () => {
      const n = x => String(+(+x).toFixed(inch ? 5 : 4));
      handoff('cycdrill', { label: spec.from || 'another page', ctrl: snipCtrl(), cycle: s.cycle, rigid: s.rigid, ret: s.ret, rpm: s.rpm, feed: s.feed, pitch: s.pitch, zi: s.zi, r: s.r, z: s.z, q: s.q, dwell: s.dwell,
        pat: 'list', list: holes().map(h => n(h[0]) + ' ' + n(h[1])).join('\n') });
    };
  };
  draw();
}
