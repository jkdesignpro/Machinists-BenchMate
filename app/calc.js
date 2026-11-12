'use strict';
// BenchCalc: the machinist's calculator. A keypad-and-typing calculator with
// a history tape, memory, DEG/RAD, fractions in and out, inch <-> mm and a
// drawer of shop functions (bolt circle, chord, sine bar, right triangle).
//
//   BenchCalc.open(input?)  open the floating panel (a modal sheet on narrow
//                           screens). With an <input>, "Use" puts the result
//                           into it and fires an 'input' event.
//   BenchCalc.close()       close the panel.
//   BenchCalc.render(el)    render the same calculator inline into `el`
//                           (the Calculator tool page).
//
// All maths runs in the Rust core through the WebAssembly module (state.W
// from app.js): expressions by core/src/expr.rs (no eval or Function), the
// nearest fraction by core/src/shop.rs, the drawer by core/src/geometry.rs
// and core/src/lib.rs. Nothing is computed with JavaScript maths here except
// assembling text.
(() => {
  const KEY = 'bm.calc';
  const S = { deg: 1, ans: 0, mem: 0, hist: [], fn: 'bolt', f: {} };
  try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
  if (!Array.isArray(S.hist)) S.hist = [];
  if (!S.f || typeof S.f !== 'object') S.f = {};
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ deg: S.deg, ans: S.ans, mem: S.mem, hist: S.hist.slice(0, 50), fn: S.fn, f: S.f })); } catch (e) {} };
  const live = new Set();
  const W = () => (typeof state !== 'undefined' && state.W) || null;
  const sys = () => (typeof state !== 'undefined' && state.sys) || 'inch';
  // Typed and pasted text: curly quotes, primes and the printed operator signs
  // become the plain characters the parser reads (same length, so error
  // positions still line up).
  const tidy = t => String(t).replace(/[\u2018\u2019\u2032]/g, "'").replace(/[\u201C\u201D\u2033]/g, '"').replace(/\u00D7/g, '*').replace(/\u00F7/g, '/').replace(/[\u2212\u2013]/g, '-').replace(/\u00BA/g, '\u00B0');
  const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  // ---- Rust calls ----
  function evaluate(txt) {
    const w = W();
    if (!w) return { err: 'Calculation module is still loading', pos: 0 };
    const codes = Array.from(tidy(txt)).map(ch => ch.codePointAt(0));
    const n = Math.min(codes.length, w.buf_len());
    new Float64Array(w.memory.buffer, w.buf_ptr(), n).set(codes.slice(0, n));
    // Lengths typed with a unit (1/2 in, 12.7mm, 5' 3 1/2") come back in the app's unit.
    const v = w.expr_eval_u(n, S.deg, S.ans, sys() === 'inch' ? 25.4 : 1);
    if (isFinite(v)) return { v, len: w.expr_len_used() === 1 };
    const len = w.expr_err_len();
    return { err: new TextDecoder().decode(new Uint8Array(w.memory.buffer, w.str_ptr(), len)), pos: w.expr_err_pos() };
  }
  const num = txt => { if (String(txt).trim() === '') return NaN; const r = evaluate(txt); return 'v' in r ? r.v : NaN; };
  function fraction(v, den) {
    const w = W(), f = [0, 1, 2, 3, 4].map(i => w.frac_nearest(v, den, i));
    if (!isFinite(f[0])) return null;
    const [sg, wh, nu, de, er] = f;
    const t = (sg < 0 ? '-' : '') + (nu ? (wh ? wh + ' ' : '') + nu + '/' + de : String(wh));
    return { t, err: er, exact: Math.abs(er) < 1e-12 };
  }

  // ---- Number text ----
  const fmt = v => {
    if (!isFinite(v)) return 'n/a';
    const a = Math.abs(v);
    if (a !== 0 && (a >= 1e12 || a < 1e-7)) return v.toExponential(9).replace(/\.?0+e/, 'e');
    return String(+v.toPrecision(12));
  };
  const full = v => String(+v.toPrecision(15));

  // ---- Keypad ----
  // [label, action, title, class]. Actions: i:text (insert), o:text (operator,
  // spaced), f:name (function call), x:name (special).
  const KEYS = [
    ['MC', 'x:mc', 'Memory clear', 'mem'], ['MR', 'x:mr', 'Memory recall: insert the memory value', 'mem'], ['M+', 'x:m+', 'Add the result to memory', 'mem'], ['M\u2212', 'x:m-', 'Subtract the result from memory', 'mem'], ['ANS', 'i:ans', 'Last result', 'fnk'], ['\u232B', 'x:bs', 'Backspace', 'ctl'],
    ['sin', 'f:sin', 'Sine', 'fnk'], ['cos', 'f:cos', 'Cosine', 'fnk'], ['tan', 'f:tan', 'Tangent', 'fnk'], ['(', 'i:(', 'Open bracket', 'fnk'], [')', 'i:)', 'Close bracket', 'fnk'], ['AC', 'x:ac', 'Clear the expression', 'ctl'],
    ['sin\u207B\u00B9', 'f:asin', 'Inverse sine', 'fnk'], ['cos\u207B\u00B9', 'f:acos', 'Inverse cosine', 'fnk'], ['tan\u207B\u00B9', 'f:atan', 'Inverse tangent', 'fnk'], ['\u221A', 'f:sqrt', 'Square root', 'fnk'], ['x\u00B2', 'x:sq', 'Square', 'fnk'], ['x\u02B8', 'x:pow', 'Power', 'fnk'],
    ['7', 'i:7', '', 'num'], ['8', 'i:8', '', 'num'], ['9', 'i:9', '', 'num'], ['\u00F7', 'o:/', 'Divide', 'op'], ['1/x', 'x:inv', 'Reciprocal of the expression', 'fnk'], ['\u03C0', 'i:pi', 'Pi', 'fnk'],
    ['4', 'i:4', '', 'num'], ['5', 'i:5', '', 'num'], ['6', 'i:6', '', 'num'], ['\u00D7', 'o:*', 'Multiply', 'op'], ['%', 'x:pct', 'Percent (divide by 100)', 'fnk'], ['EE', 'x:ee', 'Times ten to the power (1.5E3 = 1500)', 'fnk'],
    ['1', 'i:1', '', 'num'], ['2', 'i:2', '', 'num'], ['3', 'i:3', '', 'num'], ['\u2212', 'o:-', 'Subtract', 'op'], ['\u00B1', 'x:neg', 'Change sign', 'fnk'], ['a b/c', 'x:frac', 'Fraction: 3 [a b/c] 7 [a b/c] 16 makes 3 7/16', 'fnk'],
    ['0', 'i:0', '', 'num'], ['.', 'i:.', 'Decimal point', 'num'], ['in\u2192mm', 'x:tomm', 'Inch to millimetre (\u00D7 25.4)', 'fnk'], ['+', 'o:+', 'Add', 'op'], ['=', 'x:eq', 'Evaluate (Enter)', 'eq'], ['mm\u2192in', 'x:toin', 'Millimetre to inch (\u00F7 25.4)', 'fnk'],
  ];

  const FN = {
    bolt: ['Bolt circle', [['n', 'Holes', 6], ['pcd', 'Circle dia (PCD)', 4], ['a0', 'Start angle \u00B0', 0], ['cx', 'Centre X', 0], ['cy', 'Centre Y', 0]]],
    chord: ['Chord', [['d', 'Circle dia', 4], ['th', 'Included angle \u00B0', 60], ['n', 'or equal spaces', '']]],
    sine: ['Sine bar', [['l', 'Bar length', 5], ['th', 'Angle \u00B0', 30], ['h', 'or stack height', '']]],
    speed: ['Speed', [['d', 'Diameter', ''], ['v', s => s === 'inch' ? 'Surface speed ft/min' : 'Cutting speed m/min', ''], ['n', 'or spindle RPM', '']]],
    tri: ['Right triangle', [['a', 'Side a (opposite A)', 3], ['b', 'Side b (adjacent A)', 4], ['c', 'Hypotenuse c', ''], ['A', 'Angle A \u00B0', ''], ['B', 'Angle B \u00B0', '']]],
  };
  const fv = (fn, k, dflt) => (S.f[fn + '.' + k] !== undefined ? S.f[fn + '.' + k] : dflt);

  // ---- One calculator instance ----
  function build(root, opts) {
    const inline = !!opts.inline;
    root.classList.add('bcalc');
    root.innerHTML =
      '<div class="bc-head"' + (inline ? '' : ' title="Drag to move"') + '><b>Calculator</b><span class="bc-tgt"></span><span class="sp"></span>' +
      '<div class="seg bc-deg" role="group" aria-label="Angle unit"><button type="button" data-d="1">DEG</button><button type="button" data-d="0">RAD</button></div>' +
      (inline ? '' : '<button type="button" class="bc-x" aria-label="Close calculator" title="Close (Esc)"><svg class="i" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg></button>') + '</div>' +
      '<div class="bc-main"><div class="bc-left">' +
      '<div class="bc-disp"><input class="bc-expr" type="text" spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="Expression" placeholder="e.g. 3-7/16 * 2  or  12.7mm + 1/2 in">' +
      '<div class="bc-res" aria-live="polite"></div><div class="bc-alt"></div><div class="bc-mem"></div></div>' +
      '<div class="bc-keys">' + KEYS.map(k => '<button type="button" class="' + k[3] + '" data-a="' + esc(k[1]) + '"' + (k[2] ? ' title="' + esc(k[2]) + '"' : '') + '>' + esc(k[0]) + '</button>').join('') + '</div>' +
      '<div class="bc-use"><button type="button" class="btn bc-usebtn"></button></div>' +
      '</div><div class="bc-right">' +
      '<div class="bc-sec"><div class="bc-sh"><span>History</span><button type="button" class="bc-link bc-clr">Clear</button></div><div class="bc-tape"></div></div>' +
      '<details class="bc-sec bc-fns"' + (inline ? ' open' : '') + '><summary class="bc-sh">Functions</summary>' +
      '<div class="seg bc-fsel" role="group" aria-label="Function">' + Object.entries(FN).map(([k, f]) => '<button type="button" data-f="' + k + '">' + f[0] + '</button>').join('') + '</div>' +
      '<div class="bc-form"></div><div class="bc-fout"></div><p class="bc-hint">Fields take expressions, fractions and units (1/2 in, 12.7mm, 29\u00B030\u2019). Lengths without a unit are in the app\u2019s unit; angles in degrees. Click a result to put it in the expression.</p></details>' +
      '</div></div>';
    const q = s => root.querySelector(s);
    const inp = q('.bc-expr');
    if (matchMedia('(pointer: coarse)').matches) inp.setAttribute('inputmode', 'none');
    let done = false; // the expression on show has just been evaluated
    let target = null;
    let last = null;

    const show = () => {
      const txt = inp.value, r = txt.trim() ? evaluate(txt) : null;
      const res = q('.bc-res'), alt = q('.bc-alt');
      last = r && 'v' in r ? r.v : null;
      if (!r) { res.className = 'bc-res'; res.textContent = '= ' + fmt(S.ans); alt.innerHTML = '<span>ANS</span>'; }
      else if ('v' in r) {
        const inch = sys() === 'inch';
        res.className = 'bc-res ok'; res.textContent = '= ' + fmt(r.v) + (r.len ? (inch ? ' in' : ' mm') : '');
        const f = fraction(r.v, 64);
        alt.innerHTML = (f && (inch || !r.len) ? '<span title="Nearest 1/64">' + (f.exact ? '= ' : '\u2248 ') + esc(f.t) + (r.len ? ' in' : '') + (f.exact ? '' : ' <i>err ' + (f.err > 0 ? '+' : '') + esc(f.err.toFixed(6)) + '</i>') + '</span>' : '') +
          (r.len ? '<span title="The same length in the other unit">= ' + esc(fmt(inch ? r.v * 25.4 : r.v / 25.4)) + (inch ? ' mm' : ' in') + '</span><span class="bc-un" title="A length unit was typed, so the answer is in the app\u2019s unit (change it with the in / mm switch)">length</span>'
            : '<span title="Value \u00D7 25.4">in\u2192mm ' + esc(fmt(r.v * 25.4)) + '</span><span title="Value \u00F7 25.4">mm\u2192in ' + esc(fmt(r.v / 25.4)) + '</span>');
      } else {
        res.className = 'bc-res bad'; res.textContent = r.err;
        alt.innerHTML = '<span class="bc-caret">' + esc(txt) + '\n' + ' '.repeat(Math.min(r.pos, txt.length)) + '^</span>';
      }
      q('.bc-mem').textContent = S.mem ? 'M = ' + fmt(S.mem) : '';
      root.querySelectorAll('.bc-deg button').forEach(b => b.classList.toggle('on', +b.dataset.d === S.deg));
      const ub = q('.bc-usebtn');
      q('.bc-use').hidden = !target;
      if (target) ub.textContent = 'Use ' + (last !== null ? fmt(last) : '') + ' in ' + targetName(target);
      ub.disabled = last === null;
    };
    const tape = () => {
      const t = q('.bc-tape');
      t.innerHTML = S.hist.length ? S.hist.map((h, i) => '<div class="bc-row"><button type="button" class="bc-he" data-i="' + i + '" title="Reuse this expression">' + esc(h[0]) + '</button><button type="button" class="bc-hv" data-i="' + i + '" title="Insert this result">' + esc(fmt(h[1])) + '</button></div>').join('') : '<div class="bc-empty">Results you evaluate are listed here.</div>';
    };
    const focus = () => { if (!matchMedia('(pointer: coarse)').matches) inp.focus(); };
    const insert = text => {
      if (done) { inp.value = ''; done = false; }
      const a = inp.selectionStart ?? inp.value.length, b = inp.selectionEnd ?? a;
      inp.setRangeText(text, a, b, 'end');
      show();
    };
    const operator = o => {
      if (done) { inp.value = full(S.ans); inp.setSelectionRange(inp.value.length, inp.value.length); done = false; }
      if (!inp.value.trim() && o !== '-') inp.value = full(S.ans);
      insert(o === '-' && !inp.value.trim() ? '-' : ' ' + o + ' ');
    };
    const whole = () => { if (done) { done = false; return full(S.ans); } return inp.value.trim() ? '(' + inp.value.trim() + ')' : 'ans'; };
    const commit = () => {
      const txt = inp.value.trim();
      if (!txt) return null;
      const r = evaluate(txt);
      if (!('v' in r)) { show(); return null; }
      S.ans = r.v;
      if (!S.hist.length || S.hist[0][0] !== txt || S.hist[0][1] !== r.v) S.hist.unshift([txt, r.v]);
      S.hist = S.hist.slice(0, 50); save();
      done = true; show(); refreshAll();
      return r.v;
    };
    const current = () => { const r = inp.value.trim() ? evaluate(inp.value) : { v: S.ans }; return 'v' in r ? r.v : null; };
    const special = a => {
      const v = inp.value, end = inp.value.length;
      switch (a) {
        case 'eq': commit(); break;
        case 'ac': inp.value = ''; done = false; show(); break;
        case 'bs': done = false; { const s = inp.selectionStart ?? end, e = inp.selectionEnd ?? end; if (s !== e) inp.setRangeText('', s, e, 'end'); else if (s > 0) inp.setRangeText('', s - 1, s, 'end'); } show(); break;
        case 'mc': S.mem = 0; save(); refreshAll(); break;
        case 'mr': insert(full(S.mem)); break;
        case 'm+': case 'm-': { const c = current(); if (c !== null) { S.mem += a === 'm+' ? c : -c; save(); refreshAll(); } break; }
        case 'sq': if (done || !v.trim()) { inp.value = whole() + '^2'; done = false; show(); } else insert('^2'); break;
        case 'pow': if (done || !v.trim()) { inp.value = whole(); done = false; } inp.setSelectionRange(inp.value.length, inp.value.length); insert('^'); break;
        case 'pct': if (done) { inp.value = full(S.ans); done = false; } inp.setSelectionRange(inp.value.length, inp.value.length); insert('%'); break;
        case 'ee': if (done) { inp.value = ''; done = false; } insert(/[\d.]$/.test(inp.value.slice(0, inp.selectionStart ?? end)) ? 'E' : '1E'); break;
        case 'inv': inp.value = '1 / ' + whole(); commit(); break;
        case 'tomm': inp.value = whole() + ' * 25.4'; commit(); break;
        case 'toin': inp.value = whole() + ' / 25.4'; commit(); break;
        case 'neg': {
          if (done) { inp.value = full(S.ans); done = false; }
          const t = inp.value;
          if (/E$/.test(t)) { inp.value = t + '-'; }
          else {
            const m = /(^|[\s(,*/^+-])(-?)(\d*\.?\d+(?:E-?\d+)?|ans|pi|M)$/.exec(t);
            if (m && (m[1] !== '-' || m.index === 0)) { const st = m.index + m[1].length; inp.value = t.slice(0, st) + (m[2] ? '' : '-') + m[3]; }
            else if (t.trim()) inp.value = /^-\(.*\)$/.test(t.trim()) ? t.trim().slice(2, -1) : '-(' + t.trim() + ')';
            else inp.value = '-';
          }
          inp.setSelectionRange(inp.value.length, inp.value.length); show(); break;
        }
        case 'frac': {
          if (done) { inp.value = ''; done = false; }
          const t = inp.value.slice(0, inp.selectionStart ?? end);
          if (/(^|[^\d.])\d+ \d+$/.test(t)) insert('/');
          else if (/(^|[^\d.\s])\s*\d+$/.test(t) || /^\d+$/.test(t)) insert(' ');
          else insert('/');
          break;
        }
      }
    };
    root.querySelector('.bc-keys').addEventListener('click', e => {
      const b = e.target.closest('button[data-a]'); if (!b) return;
      const [k, t] = [b.dataset.a.slice(0, 1), b.dataset.a.slice(2)];
      if (k === 'i') insert(t);
      else if (k === 'o') operator(t);
      else if (k === 'f') { if (done) { const v = full(S.ans); inp.value = ''; done = false; insert(t + '(' + v + ')'); } else insert(t + '('); }
      else special(t);
      focus();
    });
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); if ((e.ctrlKey || e.metaKey) && target) use(); else commit(); return; }
      if (e.key === 'Escape') return; // handled by the panel
      if (done && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        if ('+-*/^%'.includes(e.key)) operator(e.key === '%' ? '%' : e.key);
        else { inp.value = ''; done = false; insert(e.key); }
        return;
      }
      if (done && (e.key === 'Backspace' || e.key === 'Delete' || e.key.startsWith('Arrow'))) done = false;
    });
    inp.addEventListener('input', () => { done = false; show(); });
    root.querySelector('.bc-deg').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S.deg = +b.dataset.d; save(); refreshAll(); focus(); });
    root.querySelector('.bc-tape').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const h = S.hist[+b.dataset.i]; if (!h) return;
      if (b.classList.contains('bc-he')) { inp.value = h[0]; done = false; inp.setSelectionRange(inp.value.length, inp.value.length); show(); }
      else insert(full(h[1]));
      focus();
    });
    q('.bc-clr').onclick = () => { S.hist = []; save(); refreshAll(); };
    if (!inline) q('.bc-x').onclick = () => api.close();

    // Functions drawer
    const fsel = () => {
      root.querySelectorAll('.bc-fsel button').forEach(b => b.classList.toggle('on', b.dataset.f === S.fn));
      const [, fields] = FN[S.fn];
      q('.bc-form').innerHTML = fields.map(([k, l, d]) => '<label><span>' + esc(typeof l === 'function' ? l(sys()) : l) + '</span><input type="text" spellcheck="false" autocomplete="off" data-fk="' + k + '" value="' + esc(fv(S.fn, k, d)) + '"></label>').join('');
      fcalc();
    };
    const fout = (rows, msg) => {
      // Trig leaves dust such as 6e-17 where the answer is 0; show it as 0.
      rows = rows.map(r => r.map((c, i) => i > 0 && Math.abs(c) < 1e-12 ? 0 : c));
      q('.bc-fout').innerHTML = (msg ? '<p class="bc-fmsg">' + esc(msg) + '</p>' : '') + (rows.length ? '<table>' + rows.map(r => '<tr>' + r.map((c, i) => i === 0 ? '<td>' + esc(c) + '</td>' : '<td><button type="button" class="bc-fv" data-v="' + esc(full(c)) + '">' + esc(fmt(c)) + '</button></td>').join('') + '</tr>').join('') + '</table>' : '');
    };
    const fcalc = () => {
      const w = W(); if (!w) return;
      const g = k => { const inp2 = q('.bc-form [data-fk="' + k + '"]'); return inp2 ? num(inp2.value) : NaN; };
      const blank = k => { const inp2 = q('.bc-form [data-fk="' + k + '"]'); return !inp2 || !inp2.value.trim(); };
      if (S.fn === 'bolt') {
        const n = g('n'), d = g('pcd'), a0 = g('a0') || 0, cx = g('cx') || 0, cy = g('cy') || 0;
        if (!(Number.isInteger(n) && n >= 1 && n <= 360)) return fout([], 'Holes: a whole number from 1 to 360.');
        if (!(d > 0)) return fout([], 'Enter the bolt circle diameter.');
        const rows = [];
        for (let i = 0; i < n; i++) rows.push(['Hole ' + (i + 1) + ' (' + fmt(+(a0 + 360 * i / n).toFixed(9)) + '\u00B0)', w.bolt_x(n, d, a0, cx, cy, i), w.bolt_y(n, d, a0, cx, cy, i)]);
        q('.bc-fout').innerHTML = '';
        fout(rows.map(r => r), 'X, Y of each hole. Angles from +X, counter-clockwise. Hole spacing (chord) ' + fmt(w.arc_solve(1, d / 2, 360 / n, 2)) + '.');
        q('.bc-fout table').insertAdjacentHTML('afterbegin', '<tr><th></th><th>X</th><th>Y</th></tr>');
      } else if (S.fn === 'chord') {
        const d = g('d'), n = g('n'), th = blank('n') ? g('th') : (n >= 1 ? 360 / n : NaN);
        if (!(d > 0) || !(th > 0 && th <= 360)) return fout([], 'Enter the diameter and an angle up to 360\u00B0 (or a number of equal spaces).');
        fout([['Chord length', w.arc_solve(1, d / 2, th, 2)], ['Arc length', w.arc_solve(1, d / 2, th, 3)], ['Arc height (sagitta)', w.arc_solve(1, d / 2, th, 4)], ['Angle used \u00B0', th]]);
      } else if (S.fn === 'sine') {
        const l = g('l');
        if (!(l > 0)) return fout([], 'Enter the bar length (centre distance of the rolls).');
        if (!blank('h')) { const a = w.sine_bar_angle(l, g('h')); return isFinite(a) ? fout([['Angle \u00B0', a], ['Stack height', g('h')]]) : fout([], 'The stack must be from 0 to the bar length.'); }
        const h = w.sine_bar_height(l, g('th'));
        isFinite(h) ? fout([['Stack height', h], ['Angle \u00B0', g('th')]]) : fout([], 'Angle from 0 to 90\u00B0.');
      } else if (S.fn === 'speed') {
        const d = g('d'), inch = sys() === 'inch', u = inch ? 'ft/min' : 'm/min';
        if (!(d > 0)) return fout([], 'Enter the diameter (' + (inch ? 'in' : 'mm') + '), then the ' + (inch ? 'surface' : 'cutting') + ' speed or the RPM.');
        if (!blank('n')) { const n = g('n'); return n > 0 ? fout([[(inch ? 'Surface speed ' : 'Cutting speed ') + u, inch ? w.sfm_from_rpm(n, d) : w.vc_from_rpm(n, d)], ['Spindle RPM', n]]) : fout([], 'Enter an RPM above 0.'); }
        const v = g('v');
        v > 0 ? fout([['Spindle RPM', inch ? w.rpm_from_sfm(v, d) : w.rpm_from_vc(v, d)], [(inch ? 'Surface speed ' : 'Cutting speed ') + u, v]]) : fout([], 'Enter the ' + (inch ? 'surface speed in ft/min' : 'cutting speed in m/min') + ' or the RPM.');
      } else {
        const v = ['a', 'b', 'c', 'A', 'B'].map(k => blank(k) ? NaN : g(k)), known = v.filter(x => isFinite(x)).length;
        if (known !== 2) return fout([], 'Fill in exactly two values (at least one side); the right angle C is 90\u00B0.');
        const cnt = w.tri_solve(v[0], v[1], v[2], v[3], v[4], 90, 0, 9);
        if (!(cnt >= 1)) return fout([], 'No right triangle has these values.');
        const t = [0, 1, 2, 3, 4, 6].map(i => w.tri_solve(v[0], v[1], v[2], v[3], v[4], 90, 0, i));
        fout([['Side a', t[0]], ['Side b', t[1]], ['Hypotenuse c', t[2]], ['Angle A \u00B0', t[3]], ['Angle B \u00B0', t[4]], ['Area', t[5]]]);
      }
    };
    root.querySelector('.bc-fsel').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S.fn = b.dataset.f; save(); fsel(); });
    q('.bc-form').addEventListener('input', e => {
      const k = e.target.dataset.fk; if (!k) return;
      S.f[S.fn + '.' + k] = e.target.value;
      // Alternatives: an entry in "or ..." clears the field it replaces, and back.
      const pair = { chord: { n: 'th', th: 'n' }, sine: { h: 'th', th: 'h' }, speed: { n: 'v', v: 'n' } }[S.fn];
      if (pair && pair[k] && e.target.value.trim()) { const o = q('.bc-form [data-fk="' + pair[k] + '"]'); if (o) { o.value = ''; S.f[S.fn + '.' + pair[k]] = ''; } }
      save(); fcalc();
    });
    q('.bc-fout').addEventListener('click', e => { const b = e.target.closest('.bc-fv'); if (b) { insert(b.dataset.v); focus(); } });

    const use = () => {
      if (!target) return;
      let v = last;
      if (!done && inp.value.trim()) { const c = commit(); if (c !== null) v = c; }
      if (v === null) return;
      target.value = full(v);
      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
      const t = target; api.close(); try { t.focus(); } catch (e) {}
    };
    q('.bc-usebtn').onclick = use;

    const inst = {
      root, inp, show, tape, fsel: () => fsel(),
      setTarget(t) {
        target = t || null; done = false;
        q('.bc-tgt').textContent = target ? 'for ' + targetName(target) : '';
        if (target && String(target.value).trim()) { inp.value = String(target.value).trim(); } else if (target) inp.value = '';
        show();
      },
      focus() { inp.focus(); inp.select(); },
    };
    live.add(inst);
    fsel(); tape(); show();
    return inst;
  }

  function targetName(t) {
    const lab = t.closest('label');
    const s = (lab && (lab.querySelector('span') || lab).textContent) || t.getAttribute('aria-label') || t.title || t.placeholder || 'the field';
    return s.trim().replace(/\s+/g, ' ').slice(0, 40);
  }
  function refreshAll(units) { for (const i of live) { if (!i.root.isConnected && i !== panel) { live.delete(i); continue; } i.tape(); i.show(); if (units) i.fsel(); } }

  // ---- Floating panel / modal sheet ----
  let panel = null, back = null, pos = null, lastFocus = null;
  const narrow = () => matchMedia('(max-width: 720px)').matches;
  function place() {
    const el = panel.root;
    const modal = narrow();
    el.classList.toggle('bc-modal', modal); el.classList.toggle('bc-float', !modal);
    back.hidden = !modal || el.hidden;
    if (modal) { el.style.left = el.style.top = ''; return; }
    if (pos) {
      const x = Math.max(0, Math.min(pos.x, innerWidth - el.offsetWidth)), y = Math.max(0, Math.min(pos.y, innerHeight - 40));
      el.style.left = x + 'px'; el.style.top = y + 'px';
    } else { el.style.left = Math.max(0, innerWidth - el.offsetWidth - 16) + 'px'; el.style.top = Math.max(0, Math.min(56, innerHeight - el.offsetHeight - 16)) + 'px'; }
  }
  function ensure() {
    if (panel) return;
    back = document.createElement('div'); back.className = 'bc-back'; back.hidden = true; back.onclick = () => api.close();
    const el = document.createElement('div'); el.id = 'bcalc-panel'; el.hidden = true;
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Calculator');
    document.body.append(back, el);
    panel = build(el, { inline: false });
    el.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); api.close(); } });
    // Drag by the title row (floating mode only).
    const head = el.querySelector('.bc-head');
    head.addEventListener('pointerdown', e => {
      if (narrow() || e.target.closest('button')) return;
      const r = el.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
      head.setPointerCapture(e.pointerId);
      const mv = ev => { pos = { x: ev.clientX - dx, y: ev.clientY - dy }; place(); };
      const up = () => { head.removeEventListener('pointermove', mv); head.removeEventListener('pointerup', up); head.removeEventListener('pointercancel', up); };
      head.addEventListener('pointermove', mv); head.addEventListener('pointerup', up); head.addEventListener('pointercancel', up);
    });
    addEventListener('resize', () => { if (!panel.root.hidden) place(); });
  }

  const api = {
    open(target) {
      ensure();
      lastFocus = document.activeElement;
      const t = target && target.nodeType === 1 && 'value' in target ? target : null;
      panel.setTarget(t);
      panel.root.hidden = false; place();
      panel.focus();
    },
    close() {
      if (!panel || panel.root.hidden) return;
      panel.root.hidden = true; back.hidden = true;
      panel.setTarget(null);
      if (lastFocus && lastFocus.isConnected && !panel.root.contains(lastFocus)) { try { lastFocus.focus(); } catch (e) {} }
    },
    render(el) {
      const host = document.createElement('div'); host.className = 'bc-inline';
      el.appendChild(host);
      return build(host, { inline: true });
    },
    // The app's in / mm switch changed: redo results and the drawer labels.
    unitsChanged() { refreshAll(true); },
    get isOpen() { return !!panel && !panel.root.hidden; },
  };
  window.BenchCalc = api;
})();
