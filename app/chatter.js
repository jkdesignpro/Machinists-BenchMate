'use strict';
// Chatter finder: microphone capture (Web Audio), spectrum and peak search in the
// Rust core (chat_* exports, FFT over a shared sample buffer), tooth passing
// frequency and rule-of-thumb stable speeds n = 60 fc / (z (N + 1)).
// Nothing is recorded or stored: samples live in this page while listening and are
// overwritten by the next frame; the microphone is released when listening stops.

const CHAT = { mode: 'manual', fc: '', rpm: '', z: '', lathe: 0, fmin: 50, fmax: 5000, tol: 3, lobes: 6, peaks: [], fs: 0, bins: 0, df: 0, status: '', err: false };
let chatAudio = null; // { ctx, stream, an, timer, frames }

function chatStop() {
  if (!chatAudio) return;
  clearInterval(chatAudio.timer);
  try { chatAudio.stream.getTracks().forEach(t => t.stop()); } catch (e) {}
  try { chatAudio.ctx.close(); } catch (e) {}
  chatAudio = null;
}

function chatMicError(e) {
  const n = e && e.name;
  if (n === 'NotAllowedError' || n === 'SecurityError') return 'Microphone permission was refused. Allow it for this page in the browser (or system) settings, or type the frequency in manual mode.';
  if (n === 'NotFoundError' || n === 'OverconstrainedError') return 'No microphone was found. Plug one in, or type the frequency in manual mode.';
  if (n === 'NotReadableError') return 'The microphone is in use by another program or could not be opened.';
  return 'Could not open the microphone' + (e && e.message ? ': ' + e.message : '') + '. Type the frequency in manual mode instead.';
}

function renderChatter(el) {
  chatStop();
  const s = CHAT, W = state.W;
  const draw = () => {
    el.innerHTML = '<div class="mfilter"><span>Frequency from:</span>' + gseg('chmode', [['manual', 'Type it'], ['mic', 'Microphone']], s.mode) + '</div>' +
      '<div class="grid">' +
      sfield('Spindle speed (running, not commanded)', sinp('rpm', s.rpm, 120), 'RPM') +
      sfield('Teeth on the cutter (1 for turning and boring)', sinp('z', s.z, 80), '') +
      (s.mode === 'manual' ? sfield('Chatter frequency fc', sinp('fc', s.fc, 120), 'Hz') : '') +
      sfield('Lobes to list', sinp('lobes', s.lobes, 80), '') +
      (s.mode === 'mic' ? sfield('Search from', sinp('fmin', s.fmin, 90), 'Hz') + sfield('Search to', sinp('fmax', s.fmax, 90), 'Hz') + sfield('Harmonic tolerance', sinp('tol', s.tol, 80), 'Hz') : '') +
      '</div>' +
      (s.mode === 'mic' ? '<div class="chbtns"><button class="btn" id="chgo">' + (chatAudio ? 'Stop listening' : 'Listen (about 3 s)') + '</button><span class="chstat' + (s.err ? ' err' : '') + '" id="chstat">' + sesc(s.status || 'Hold the device near the cut while it chatters. Audio is analysed in this page only; nothing is recorded, saved or sent.') + '</span></div><div id="chspec"></div><div id="chpk"></div>' : '') +
      '<div class="res" id="chres"></div>';
    el.querySelectorAll('#chmode button').forEach(b => b.onclick = () => { if (b.dataset.v !== s.mode) { chatStop(); s.mode = b.dataset.v; s.status = ''; s.err = false; draw(); } });
    gbind(el, s, () => { if (s.mode === 'mic') spectrum(); calc(); });
    const go = $('#chgo', el);
    if (go) go.onclick = () => { if (chatAudio) { chatStop(); s.status = 'Stopped.'; s.err = false; draw(); } else listen(); };
    calc(); if (s.mode === 'mic') spectrum();
  };
  async function listen() {
    s.err = false;
    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) { s.status = 'This browser does not give pages microphone access here (it needs a secure page: https or localhost). Type the frequency in manual mode.'; s.err = true; draw(); return; }
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }); }
    catch (e) { s.status = chatMicError(e); s.err = true; draw(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { stream.getTracks().forEach(t => t.stop()); s.status = 'This browser has no Web Audio support.'; s.err = true; draw(); return; }
    const ctx = new AC(), src = ctx.createMediaStreamSource(stream), an = ctx.createAnalyser();
    an.fftSize = 16384; an.smoothingTimeConstant = 0; src.connect(an);
    chatAudio = { ctx, stream, an, frames: 0, timer: 0 };
    W.chat_reset(); s.fs = ctx.sampleRate; s.status = 'Listening at ' + s.fs + ' Hz...'; draw();
    const buf = new Float32Array(an.fftSize);
    chatAudio.timer = setInterval(() => {
      if (!chatAudio) return;
      if (!el.isConnected) { chatStop(); return; }
      an.getFloatTimeDomainData(buf);
      const n = Math.min(buf.length, W.chat_buf_len());
      new Float64Array(W.memory.buffer, W.chat_buf_ptr(), n).set(buf.subarray(0, n));
      s.bins = W.chat_add(n); s.df = s.fs / (2 * s.bins);
      chatAudio.frames++;
      spectrum(); calc();
      if (chatAudio.frames >= 9) { chatStop(); s.status = 'Done: spectrum averaged over 9 frames of ' + n + ' samples (' + s.df.toFixed(2) + ' Hz per bin). Listen again after changing speed.'; const st = $('#chstat', el); if (st) st.textContent = s.status; const g = $('#chgo', el); if (g) g.textContent = 'Listen (about 3 s)'; }
    }, 350);
  }
  function spectrum() {
    const box = $('#chspec', el), pk = $('#chpk', el); if (!box) return;
    if (!(s.bins > 0)) { box.innerHTML = ''; pk.innerHTML = ''; s.peaks = []; return; }
    const rpm = snum(s.rpm), fmin = snum(s.fmin) > 0 ? snum(s.fmin) : 20, fmax = snum(s.fmax) > fmin ? snum(s.fmax) : s.fs / 2, tol = snum(s.tol) >= 0 ? snum(s.tol) : 3;
    const k = W.chat_peaks(s.df, fmin, fmax, rpm > 0 ? rpm : 0, tol, 6);
    s.peaks = []; for (let i = 0; i < k; i++) s.peaks.push({ f: W.list_out(3 * i), a: W.list_out(3 * i + 1), h: W.list_out(3 * i + 2) });
    // spectrum plot, dB re the largest bin in range
    const Wd = 760, Hd = 214, L = 40, Rr = 10, T = 24, B = 26;
    const i0 = Math.max(1, Math.floor(fmin / s.df)), i1 = Math.min(s.bins - 1, Math.ceil(fmax / s.df));
    let mx = 1e-12; for (let i = i0; i <= i1; i++) mx = Math.max(mx, W.chat_bin(i));
    const X = f => L + (f - fmin) / (fmax - fmin) * (Wd - L - Rr), Y = db => T + (-db) / 60 * (Hd - T - B);
    const step = Math.max(1, Math.floor((i1 - i0) / 700)); let path = '';
    for (let i = i0; i <= i1; i += step) { let m = 0; for (let j = i; j < Math.min(i + step, i1 + 1); j++) m = Math.max(m, W.chat_bin(j)); const db = Math.max(-60, 20 * Math.log10(m / mx)); path += (path ? 'L' : 'M') + X(i * s.df).toFixed(1) + ' ' + Y(db).toFixed(1); }
    let g = '<path class="ax" d="M' + L + ' ' + (Hd - B) + 'H' + (Wd - Rr) + 'M' + L + ' ' + T + 'V' + (Hd - B) + '"/>';
    const tick = Math.pow(10, Math.floor(Math.log10((fmax - fmin) / 5))), tk = (fmax - fmin) / tick > 10 ? tick * 2 : tick;
    for (let f = Math.ceil(fmin / tk) * tk; f <= fmax; f += tk) g += '<text x="' + X(f).toFixed(1) + '" y="' + (Hd - 8) + '" text-anchor="middle">' + f + '</text>';
    [0, -20, -40, -60].forEach(db => { g += '<text x="' + (L - 4) + '" y="' + (Y(db) + 3).toFixed(1) + '" text-anchor="end">' + db + '</text>'; });
    if (rpm > 0) for (let f = rpm / 60; f <= fmax; f += rpm / 60) if (f >= fmin) g += '<path class="hm" d="M' + X(f).toFixed(1) + ' ' + T + 'V' + (Hd - B) + '"/>';
    g += '<path class="ln" d="' + path + '"/>';
    const ch = s.peaks.find(p => !p.h);
    if (ch) g += '<circle class="pk" cx="' + X(ch.f).toFixed(1) + '" cy="' + Y(Math.max(-60, 20 * Math.log10(ch.a / mx))).toFixed(1) + '" r="4"/>';
    box.innerHTML = '<svg class="spec" viewBox="0 0 ' + Wd + ' ' + Hd + '" role="img" aria-label="Sound spectrum"><text x="' + L + '" y="13">dB (top bin = 0), Hz across; dashed: spindle harmonics; dot: chatter candidate</text>' + g + '</svg>';
    pk.innerHTML = '<div class="res"><div class="h">Largest peaks</div><table>' + (s.peaks.length ? s.peaks.map(p => '<tr><td>' + (p.h ? 'Spindle harmonic ' + p.h + (snum(s.z) >= 1 && p.h % snum(s.z) === 0 ? ' (tooth passing x ' + p.h / snum(s.z) + ')' : '') : '<b>Not a spindle harmonic: chatter candidate</b>') + '</td><td class="v">' + fmt(p.f, 1) + '</td><td class="u">Hz</td></tr>').join('') : '<tr><td class="warn">No peaks in the range.</td></tr>') + '</table></div>';
    if (ch && s.mode === 'mic') s.fc = String(+ch.f.toFixed(1));
  }
  function calc() {
    const out = $('#chres', el); if (!out) return;
    const rpm = snum(s.rpm), z = Math.round(snum(s.z)), fc = snum(s.fc), nl = Math.min(Math.max(Math.round(snum(s.lobes)) || 6, 1), 30);
    const rows = [];
    if (rpm > 0 && z >= 1) rows.push(['Tooth passing frequency', fmt(W.tooth_pass_hz(rpm, z), 2), 'Hz'], ['Spindle frequency', fmt(rpm / 60, 2), 'Hz']);
    if (!(fc > 0)) { out.innerHTML = stable('Results', rows.concat([[s.mode === 'mic' ? 'Listen to find the chatter frequency' : 'Enter the chatter frequency', '', '']])); return; }
    rows.push(['Chatter frequency used', fmt(fc, 1), 'Hz']);
    if (!(z >= 1)) { out.innerHTML = stable('Results', rows.concat([['Enter the number of teeth', '', '']])); return; }
    let cur = NaN;
    if (rpm > 0) { const q = W.chatter_ratio(fc, rpm, z); cur = Math.floor(q); rows.push(['Chatter / tooth passing frequency', fmt(q, 3), ''], ['Lobe the cut is in now (N)', fmt(cur, 0), '']); const h = W.harmonic_order(fc, rpm / 60, snum(s.tol) >= 0 ? snum(s.tol) : 3); if (h) rows.push(['Check', 'This frequency is spindle harmonic ' + h + ': it is forced by runout or tooth impacts, not chatter', '']); }
    const m = Profiles.active(), mx = m && Number(m.rpm_max) > 0 ? Number(m.rpm_max) : 0, mn = m && Number(m.rpm_min) > 0 ? Number(m.rpm_min) : 0;
    const list = [];
    for (let N = 0; N < nl; N++) { const n = W.stable_rpm(fc, z, N); list.push([N, n]); }
    let near = '';
    if (rpm > 0) { const up = list.filter(x => x[1] >= rpm).pop(), dn = list.find(x => x[1] < rpm); near = (dn ? 'Nearest below: ' + fmt(dn[1], 0) + ' RPM (N = ' + dn[0] + ')' : '') + (dn && up ? '; ' : '') + (up ? 'nearest above: ' + fmt(up[1], 0) + ' RPM (N = ' + up[0] + ')' : ''); }
    let h = stable('Results', rows);
    h += '<div class="h">Stable speed estimates n = 60 fc / (z (N + 1))</div><table>' + list.map(([N, n]) => {
      const w = (mx && n > mx) ? 'Above ' + sesc(m.name) + ' max ' + mx + ' RPM' : (mn && n < mn) ? 'Below ' + sesc(m.name) + ' min ' + mn + ' RPM' : '';
      return '<tr' + (w ? ' class="over"' : '') + '><td>Lobe N = ' + N + (N === cur ? ' (the lobe you are in)' : '') + (w ? '<div class="wmsg">' + w + '</div>' : '') + '</td><td class="v">' + fmt(n, 0) + '</td><td class="u">RPM</td></tr>';
    }).join('') + '</table>' + (near ? '<p class="desc" style="padding:6px 10px;margin:0">' + near + '. Keep the feed per tooth the same when you change speed. Higher lobes (larger N) are narrower and less forgiving; N = 0 and 1 give the most room.</p>' : '');
    out.innerHTML = h;
  }
  draw();
}
