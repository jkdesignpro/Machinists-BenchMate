// Contact sheet of tool drawings, for checking them by eye, plus an automatic
// check that no text or shape leaves its drawing's frame.
// Usage: node tests/smoke/sheet.mjs out.png id1,id2,... [--sys inch] [--theme light] [--cols 3]
//        ids "all" = every tool that has a drawing. Exits 1 on console errors or frame overflows.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

let chromium;
try { ({ chromium } = await import('playwright')); }
catch { const g = execSync('npm root -g').toString().trim(); ({ chromium } = await import(pathToFileURL(path.join(g, 'playwright/index.mjs')).href)); }
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), appDir = path.join(root, 'app');
const args = process.argv.slice(2), out = args[0] || 'sheet.png', idArg = args[1] || 'all';
const opt = k => { const i = args.indexOf('--' + k); return i > 0 ? args[i + 1] : undefined; };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml' };
const server = http.createServer(async (req, res) => {
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
  try { const body = await readFile(path.join(appDir, rel)); res.writeHead(200, { 'Content-Type': TYPES[path.extname(rel)] || 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const cols = +(opt('cols') || 3);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: cols * 540 + 20, height: 900 } });
const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', e => errs.push('uncaught: ' + e.message));
await page.addInitScript(([theme, sys]) => {
  localStorage.setItem('bm.mode', 'expert'); localStorage.setItem('bm.theme', theme); localStorage.setItem('bm.units', sys);
  localStorage.setItem('bm.dash', JSON.stringify({ v: 1, items: [] }));
}, [opt('theme') || 'light', opt('sys') || 'inch']);
await page.goto(`http://127.0.0.1:${server.address().port}/#/home`);
await page.waitForTimeout(700);
const report = await page.evaluate(([idArg, cols]) => {
  const ids = idArg === 'all' ? TOOLS.filter(t => t.diagram || DIAGRAMS[t.id]).map(t => t.id) : idArg.split(',');
  const sheet = document.createElement('div');
  sheet.id = 'sheet'; sheet.style.cssText = 'position:absolute;left:0;top:0;z-index:9999;background:var(--bg);display:grid;gap:8px;padding:8px;grid-template-columns:repeat(' + cols + ',1fr);width:' + (cols * 540) + 'px';
  document.body.style.overflow = 'visible'; document.body.appendChild(sheet);
  const bad = [], missing = [];
  for (const id of ids) {
    const t = TOOLS.find(x => x.id === id);
    let h = '';
    if (!t) { missing.push(id + ' (no such tool)'); continue; }
    if (t.render) { const d = DIAGRAMS[id]; h = d ? d({}, state.sys, []) : ''; }
    else { const host = document.createElement('div'); mountTool(host, t, {}); const d = host.querySelector('.tdia'); h = d ? d.innerHTML : ''; }
    if (!h) { missing.push(id); continue; }
    const card = document.createElement('div');
    card.style.cssText = 'background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:6px 8px;overflow:hidden';
    card.innerHTML = '<div style="font:600 12px var(--mono);color:var(--muted);margin-bottom:4px">' + id + '</div><div class="tdia" style="border:0;padding:0">' + h + '</div>';
    sheet.appendChild(card);
    const svg = card.querySelector('svg'); if (!svg) continue;
    // Compare on-screen boxes (so rotated text is measured as drawn) with the drawing's own frame.
    const fr = svg.getBoundingClientRect(), k = svg.viewBox.baseVal.width / fr.width, vbw = svg.viewBox.baseVal.width, vbh = svg.viewBox.baseVal.height;
    for (const el of svg.querySelectorAll('text, path, line, circle, rect')) {
      if (el.closest('defs, [clip-path]')) continue; // clipped shapes are cut at their clip, not at their own box
      const r = el.getBoundingClientRect(); if (!r.width && !r.height) continue;
      const x0 = (r.left - fr.left) * k, y0 = (r.top - fr.top) * k, x1 = (r.right - fr.left) * k, y1 = (r.bottom - fr.top) * k, pad = 2;
      if (x0 < -pad || y0 < -pad || x1 > vbw + pad || y1 > vbh + pad)
        bad.push(id + ': ' + el.tagName + (el.tagName === 'text' ? ' "' + el.textContent.slice(0, 40) + '"' : '') + ' leaves the frame (' + [x0, y0, x1, y1].map(v => Math.round(v)).join(', ') + ' in ' + vbw + ' x ' + vbh + ')');
    }
  }
  return { n: sheet.children.length, bad, missing, h: sheet.scrollHeight };
}, [idArg, cols]);
await page.waitForTimeout(150);
await (await page.$('#sheet')).screenshot({ path: out });
if (report.missing.length) console.log('no drawing: ' + report.missing.join(', '));
if (report.bad.length) console.log('OUT OF FRAME:\n' + report.bad.join('\n'));
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : report.n + ' drawings: ' + out);
await browser.close(); server.close();
process.exit(errs.length || report.bad.length ? 1 : 0);
