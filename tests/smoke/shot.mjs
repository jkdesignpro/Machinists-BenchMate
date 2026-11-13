// Take a screenshot of one screen of the web UI (for checking layouts and drawings by eye).
// Serves app/ from this checkout on a free port, so it works in any worktree.
// Usage: node tests/smoke/shot.mjs '#/t/rpm' out.png [--w 1360] [--h 900] [--mode advanced] [--theme light]
//        [--sys inch] [--sel '.tdia'] [--set speed=250,dia=1.5] [--wait 600] [--scale 2]
//   --sel  screenshot only that element          --set  type values into inputs by data-id first
//   --select '#ssf=flat' picks a select option
//   --print  the page as it prints (print styles, sources opened, footer), full length
// Needs app/benchmate.wasm and app/data (run scripts/build-web.sh, or copy them from a built checkout).
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

let chromium;
try { ({ chromium } = await import('playwright')); }
catch { const g = execSync('npm root -g').toString().trim(); ({ chromium } = await import(pathToFileURL(path.join(g, 'playwright/index.mjs')).href)); }
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), appDir = path.join(root, 'app');
const args = process.argv.slice(2), hash = args[0] || '#/home', out = args[1] || 'shot.png';
const opt = k => { const i = args.indexOf('--' + k); return i > 0 ? args[i + 1] : undefined; };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml' };
const server = http.createServer(async (req, res) => {
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
  try { const body = await readFile(path.join(appDir, rel)); res.writeHead(200, { 'Content-Type': TYPES[path.extname(rel)] || 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: +(opt('w') || 1360), height: +(opt('h') || 900) }, deviceScaleFactor: +(opt('scale') || 1) });
const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', e => errs.push('uncaught: ' + e.message));
await page.addInitScript(([mode, theme, sys, accent]) => {
  localStorage.setItem('bm.mode', mode); localStorage.setItem('bm.theme', theme); localStorage.setItem('bm.units', sys);
  if (accent) localStorage.setItem('bm.accent', accent);
  if (!localStorage.getItem('bm.dash')) localStorage.setItem('bm.dash', JSON.stringify({ v: 1, items: [{ k: 'tool', id: 'rpm', size: 'm' }, { k: 'tool', id: 'feed', size: 'm' }, { k: 'tool', id: 'bolt', size: 'm' }, { k: 'pins', size: 'm' }, { k: 'favs', size: 's' }, { k: 'recent', size: 's' }, { k: 'tip', size: 'm' }] }));
}, [opt('mode') || 'advanced', opt('theme') || 'dark', opt('sys') || 'inch', opt('accent') || '']);
await page.goto(`http://127.0.0.1:${server.address().port}/${hash}`);
await page.waitForTimeout(+(opt('wait') || 600));
for (const kv of (opt('set') || '').split(',').filter(Boolean)) {
  const [k, v] = kv.split('='); const sel = `#main [data-id="${k}"]`;
  const tag = await page.$eval(sel, e => e.tagName);
  if (tag === 'SELECT') await page.selectOption(sel, v); else await page.fill(sel, v);
  await page.dispatchEvent(sel, 'input');
}
// --select '#id=value;;#id2=value': pick an option of a select by its CSS selector (fires change).
for (const kv of (opt('select') || '').split(';;').filter(Boolean)) { const i = kv.lastIndexOf('='); await page.selectOption(kv.slice(0, i), kv.slice(i + 1)); await page.waitForTimeout(150); }
for (const c of (opt('click') || '').split(';;').filter(Boolean)) { await page.click(c); await page.waitForTimeout(150); }
await page.waitForTimeout(150);
// --print: the page as it goes to paper (print styles, sources opened, dated footer), full length.
const asPrint = args.includes('--print');
if (asPrint) { await page.evaluate(() => printSetup()); await page.emulateMedia({ media: 'print' }); await page.waitForTimeout(100); }
const sel = opt('sel');
if (sel) await (await page.$(sel)).screenshot({ path: out }); else await page.screenshot({ path: out, fullPage: asPrint });
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'ok, no console errors: ' + out);
await browser.close(); server.close();
process.exit(errs.length ? 1 : 0);
