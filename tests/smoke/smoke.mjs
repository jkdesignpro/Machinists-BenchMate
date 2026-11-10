// Headless smoke test of the web UI in app/ (Chromium via Playwright).
// Opens every tool in the side list, in inch and in mm, and fails on any
// console error, uncaught exception, failed request or empty tool screen.
// The page is served by a small built-in static server that sends the same
// Content-Security-Policy as the desktop app (desktop/tauri.conf.json), so a
// CSP violation shows up here as a console error.
// Usage: node tests/smoke/smoke.mjs        (run scripts/build-web.sh first)
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const appDir = path.join(root, 'app');
const conf = JSON.parse(await readFile(path.join(root, 'desktop/tauri.conf.json'), 'utf8'));
const csp = Object.entries(conf.app.security.csp).map(([k, v]) => `${k} ${v}`).join('; ');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer(async (req, res) => {
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
  const file = path.join(appDir, rel);
  if (!file.startsWith(appDir)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Content-Security-Policy': csp });
    res.end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;
console.log(`serving app/ at ${base} with CSP: ${csp}`);
const problems = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
let where = 'load';
page.on('console', m => { if (m.type() === 'error') problems.push(`[${where}] console error: ${m.text()}`); });
page.on('pageerror', e => problems.push(`[${where}] uncaught: ${e.message}`));
page.on('requestfailed', r => problems.push(`[${where}] request failed: ${r.url()} ${r.failure()?.errorText}`));
page.on('response', r => { if (r.status() >= 400) problems.push(`[${where}] HTTP ${r.status()}: ${r.url()}`); });
// Dialogs (confirm/alert) would block; accept them and note them.
page.on('dialog', d => { problems.push(`[${where}] unexpected dialog: ${d.message()}`); d.dismiss(); });

await page.goto(base, { waitUntil: 'load' });
await page.waitForSelector('#list button.t');
const ver = await page.textContent('#ver');
if (!/^v\d+\.\d+\.\d+/.test(ver || '')) problems.push(`version label missing: "${ver}"`);

const ids = await page.$$eval('#list button.t', bs => [...new Set(bs.map(b => b.dataset.id))]);
console.log(`${ids.length} tools`);
for (const sys of ['inch', 'mm']) {
  await page.click(`#units button[data-u="${sys}"]`);
  for (const id of ids) {
    where = `${sys}/${id}`;
    await page.click(`#list button.t[data-id="${id}"]`);
    await page.waitForTimeout(60);
    const text = (await page.textContent('#main')) || '';
    if (text.trim().length < 20) problems.push(`[${where}] tool screen is empty`);
    if (/Could not load|not found \(run scripts\/build-web\.sh\)/.test(text)) problems.push(`[${where}] ${text.slice(0, 120)}`);
  }
}
// Theme toggle and search should not throw either.
where = 'theme';
await page.click('#theme');
where = 'search';
await page.fill('#search', 'thread');
await page.waitForTimeout(50);

await browser.close();
server.close();
if (problems.length) {
  console.error(problems.join('\n'));
  console.error(`FAILED: ${problems.length} problem(s)`);
  process.exit(1);
}
console.log(`OK: ${ids.length} tools opened in inch and mm with no console errors`);
