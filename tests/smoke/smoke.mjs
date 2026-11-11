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

// First run: no saved layout, so Home asks what the user mostly does.
await page.goto(base, { waitUntil: 'load' });
await page.waitForSelector('#main .onb, #main .dgrid');
const ver = await page.textContent('#ver');
if (!/^v\d+\.\d+\.\d+/.test(ver || '')) problems.push(`version label missing: "${ver}"`);
const open = async (id, wait = 40) => { await page.evaluate(i => openTool(i), id); await page.waitForTimeout(wait); };
const go = async (h, wait = 60) => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(wait); };
const units = async u => { await page.evaluate(x => setUnits(x), u); };
const mode = async m => { await page.evaluate(x => setMode(x), m); };

where = 'onboarding';
if (!(await page.isVisible('#main .onb'))) problems.push(`[${where}] first run did not ask what the user mostly does`);
await page.click('#main .onb button[data-p="milling"]');
await page.waitForSelector('#main .dgrid .wd');
const w0 = await page.$$eval('#main .dgrid .wd', ws => ws.length);
if (w0 < 5) problems.push(`[${where}] starter layout has only ${w0} widgets`);

// Dashboard: a mini calculator works, the layout can be changed, and it survives a restart.
where = 'dashboard';
const heroTxt = async () => (await page.textContent('#main .dgrid .wd .hero .hv b')) || '';
if (!/\d/.test(await heroTxt())) problems.push(`[${where}] first widget shows no result`);
await page.click('#dedit');
await page.click('#main .dgrid .wd:first-child .wded button[data-a="x"]');
const w1 = await page.$$eval('#main .dgrid .wd', ws => ws.length);
if (w1 !== w0 - 1) problems.push(`[${where}] remove widget: expected ${w0 - 1} widgets, got ${w1}`);
await page.click('#dadd');
await page.fill('#wq', 'stock weight');
await page.click('#wtools button');
const w2 = await page.$$eval('#main .dgrid .wd', ws => ws.length);
if (w2 !== w0) problems.push(`[${where}] add widget: expected ${w0} widgets, got ${w2}`);
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('#main .dgrid .wd');
const w3 = await page.$$eval('#main .dgrid .wd', ws => ws.length);
if (w3 !== w0) problems.push(`[${where}] layout not kept after a restart: ${w3} widgets, expected ${w0}`);

// Grouping: every page is listed in a workspace; Simple mode lists exactly its 16 pages.
where = 'grouping';
const meta = await page.evaluate(() => ({ unlisted: UNLISTED_PAGES, simple: SIMPLE_PAGES, pages: Object.keys(PAGES), tools: TOOLS.map(t => t.id), ws: WORKSPACES.map(w => w.id),
  missing: WORKSPACES.flatMap(w => w.sections.flatMap(s => s[1])).concat(SIMPLE_PAGES).filter(id => !PAGES[id]) }));
if (meta.unlisted.length) problems.push(`[${where}] pages in no workspace: ${meta.unlisted.join(', ')}`);
if (meta.missing.length) problems.push(`[${where}] workspace lists unknown pages: ${meta.missing.join(', ')}`);
if (meta.simple.length !== 16) problems.push(`[${where}] Simple mode should list 16 pages, the table has ${meta.simple.length}`);
await mode('simple');
const simpleRail = await page.$$eval('#list button.t', bs => [...new Set(bs.map(b => b.dataset.id))]);
if (simpleRail.length !== 16) problems.push(`[${where}] Simple rail shows ${simpleRail.length} tools, expected 16`);
await mode('advanced');
console.log(`${meta.tools.length} tools on ${meta.pages.length} pages in ${meta.ws.length} workspaces`);

// Every workspace landing page, then every tool in every mode and both unit systems.
for (const w of meta.ws) {
  where = 'workspace ' + w;
  await go('#/w/' + w);
  const n = await page.$$eval('#main .tcard', cs => cs.length);
  if (n < 3) problems.push(`[${where}] landing page shows ${n} cards`);
}
// Cards or list: the choice sticks and the list still holds every tool.
where = 'workspace list view';
await go('#/w/turning');
const nCards = await page.$$eval('#main .tcard', cs => cs.length);
await page.click('#main .wsv button[data-v="list"]');
const lv = await page.evaluate(() => [document.querySelectorAll('#main .wslist .tcard').length, localStorage.getItem('bm.wsview')]);
if (lv[0] !== nCards || lv[1] !== 'list') problems.push(`[${where}] list view: ${lv[0]} of ${nCards} tools, stored "${lv[1]}"`);
await page.click('#main .wsv button[data-v="cards"]');
for (const m of ['simple', 'advanced', 'expert']) {
  await mode(m);
  for (const sys of ['inch', 'mm']) {
    await units(sys);
    for (const id of meta.tools) {
      where = `${m}/${sys}/${id}`;
      await open(id, 25);
      const text = (await page.textContent('#main .tpb')) || '';
      if (text.trim().length < 20) problems.push(`[${where}] tool screen is empty`);
      if (/Could not load|not found \(run scripts\/build-web\.sh\)/.test(text)) problems.push(`[${where}] ${text.slice(0, 120)}`);
    }
  }
}
await mode('advanced');

// Compact view at 420 px: nothing may be wider than the window.
where = 'compact';
await page.setViewportSize({ width: 420, height: 800 });
await page.waitForTimeout(80);
if (!(await page.evaluate(() => document.body.classList.contains('compact')))) problems.push(`[${where}] Compact view did not turn on at 420 px`);
if (!(await page.isVisible('#bbar'))) problems.push(`[${where}] bottom bar not shown`);
for (const h of ['#/home', '#/w/milling', '#/t/rpm', '#/t/feeds', '#/t/holepattern', '#/t/boringbar', '#/t/cutopt', '#/t/turntime', '#/t/weight']) {
  await go(h, 80);
  const over = await page.evaluate(() => { const m = document.getElementById('main'); return Math.max(document.documentElement.scrollWidth - innerWidth, m.scrollWidth - m.clientWidth); });
  if (over > 1) problems.push(`[${where}] ${h} is ${over}px wider than a 420 px window`);
}
await page.click('#bbar button[data-b="tools"]');
if (!(await page.evaluate(() => document.body.classList.contains('railopen')))) problems.push(`[${where}] Tools button did not open the tool list`);
await page.click('#scrim');
await page.setViewportSize({ width: 1280, height: 900 });
await page.waitForTimeout(80);

// Search, theme and the linked pair on Spindle speed.
where = 'search';
await page.fill('#search', 'thread');
await page.waitForSelector('#searchpop .sh');
await page.keyboard.press('Enter');
await page.waitForTimeout(60);
if (!/#\/t\//.test(await page.evaluate(() => location.hash))) problems.push(`[${where}] Enter did not open the first result`);
where = 'theme';
await page.click('#menubtn');
await page.click('#mtheme button[data-v="dark"]');
if ((await page.evaluate(() => document.documentElement.getAttribute('data-theme'))) !== 'dark') problems.push(`[${where}] dark theme not applied`);
await page.click('#mtheme button[data-v="light"]');
await page.click('#menubtn');
where = 'pair rpm';
await units('inch');
await open('rpm');
for (const [k, v] of [['dia', '1'], ['rpm', '1000']]) { await page.fill(`#main [data-id="${k}"]`, v); await page.dispatchEvent(`#main [data-id="${k}"]`, 'input'); }
const sfm = await page.inputValue('#main [data-id="speed"]');
if (Math.abs(parseFloat(sfm) - 261.7994) > 0.001) problems.push(`[${where}] 1000 RPM at 1 in should fill 261.7994 SFM, got "${sfm}"`);
await page.click('#main .tpa button[title^="Reset"]');

// Drill chart: "#7" (the placeholder's own example) must find number drill 7 only.
where = 'drillchart #7';
await open('drillchart');
await page.fill('#dq', '#7');
await page.dispatchEvent('#dq', 'input');
const drillRows = await page.$$eval('#dres tr', trs => trs.slice(1).map(tr => tr.querySelector('td').textContent.trim()));
if (drillRows.length !== 1 || drillRows[0] !== '#7') problems.push(`[${where}] expected only #7, got ${drillRows.length} rows: ${drillRows.slice(0, 5).join(', ')}`);

// Surface finish in mm: Ra 0.33 um must not be rounded to 0.3 (10 % low).
where = 'finish mm';
await units('mm');
await open('finish');
for (const [k, v] of [['f', '0.092'], ['r', '0.8']]) { await page.fill(`#main [data-id="${k}"]`, v); await page.dispatchEvent(`#main [data-id="${k}"]`, 'input'); }
const raRow = await page.$eval('#res', e => [...e.querySelectorAll('.rrow')].map(t => t.innerText.replace(/\s+/g, ' ')).find(t => /Theoretical Ra/i.test(t)) || '');
if (!/0\.33\b/.test(raRow)) problems.push(`[${where}] expected Ra 0.33 um, got "${raRow}"`);

// Morse taper angle is the included angle and must say so (the cited table prints the half angle).
where = 'machinetapers morse';
await open('machinetapers');
await page.waitForSelector('#tres table');
const mtText = await page.textContent('#tres');
if (!/included angle 2\.98/.test(mtText)) problems.push(`[${where}] Morse angle not labelled as included angle`);

// Gauge blocks: wear blocks at both ends, the set makes the rest with the fewest blocks.
where = 'gauge blocks';
await units('inch');
await open('sinebar');
await page.selectOption('#main [data-k="set"]', 'i81');
await page.fill('#main [data-k="target"]', '1.2345');
await page.fill('#main [data-k="wear"]', '0.05');
const gbt = ((await page.textContent('#main #gbres')) || '').replace(/\s+/g, ' ');
if (!/3 blocks between two wear blocks \(fewest possible\)/.test(gbt) || !/Wear block \(bottom\)\s*0\.05000/.test(gbt) || !/Total\s*1\.23450/.test(gbt)) problems.push(`[${where}] 1.2345 in with 0.05 wear blocks: got "${gbt.slice(0, 260)}"`);
await page.fill('#main [data-k="wear"]', '');

// Bolt circle: the hole table and its program-ready copy.
where = 'bolt table';
await units('inch');
await open('bolt');
const bt = await page.$$eval('#main .rtab tbody tr', rs => rs.map(r => [...r.cells].map(c => c.textContent)));
if (bt.length !== 6 || bt[1].join(' ') !== '2 60° 1.0000 1.7321' || bt[3].join(' ') !== '4 180° -2.0000 0.0000') problems.push(`[${where}] 6 holes on 4 in: wrong table ${JSON.stringify(bt.slice(0, 4))}`);

// Calculator (app/calc.js): typed expression with a mixed number, keypad,
// fraction readout, history tape; then open it from a field and Use.
where = 'calc typed';
await units('inch');
await open('calc');
const ce = '#main .bcalc .bc-expr';
await page.fill(ce, '3-7/16 * 2');
const cres = (await page.textContent('#main .bcalc .bc-res')) || '';
if (!/^= 6\.875$/.test(cres.trim())) problems.push(`[${where}] 3-7/16 * 2: expected "= 6.875", got "${cres}"`);
const calt = (await page.textContent('#main .bcalc .bc-alt')) || '';
if (!/= 6 7\/8/.test(calt) || !/in→mm 174\.625/.test(calt)) problems.push(`[${where}] fraction/mm readout wrong: "${calt}"`);
await page.press(ce, 'Enter');
const tape0 = (await page.textContent('#main .bcalc .bc-tape .bc-hv')) || '';
if (tape0.trim() !== '6.875') problems.push(`[${where}] history tape: expected 6.875, got "${tape0}"`);
where = 'calc keypad';
for (const a of ['x:ac', 'i:2', 'o:+', 'i:3', 'o:*', 'i:4', 'x:eq']) await page.click(`#main .bcalc .bc-keys button[data-a="${a}"]`);
const kres = (await page.textContent('#main .bcalc .bc-res')) || '';
if (kres.trim() !== '= 14') problems.push(`[${where}] 2 + 3 * 4: expected "= 14", got "${kres}"`);
where = 'calc units';
// Lengths with units mix freely and come back in the app's unit; feet and
// inches, degrees-minutes-seconds and curly quotes are read as typed.
const cexpr = async txt => { await page.fill(ce, txt); return ((await page.textContent('#main .bcalc .bc-res')) || '').trim(); };
for (const [txt, want] of [['12.7mm + 1/2 in', '= 1 in'], ['5\u2019 3 1/2\u201D', '= 63.5 in'], ['29\u00B030\u2019', '= 29.5'], ['sin(29\u00B030\u203215\u2033)', '= 0.492486852854'], ['3 \u00D7 2', '= 6']]) {
  const got = await cexpr(txt);
  if (got !== want) problems.push(`[${where}] ${txt}: expected "${want}", got "${got}"`);
}
await units('mm');
const umm = await cexpr('1/2 in + 12.7mm');
if (umm !== '= 25.4 mm') problems.push(`[${where}] mm mode 1/2 in + 12.7mm: expected "= 25.4 mm", got "${umm}"`);
where = 'calc speed';
await page.click('#main .bcalc .bc-fsel button[data-f="speed"]');
await page.fill('#main .bcalc .bc-form [data-fk="d"]', '10');
await page.fill('#main .bcalc .bc-form [data-fk="v"]', '100');
const sp = (await page.textContent('#main .bcalc .bc-fout')) || '';
if (!/Spindle RPM\s*3183\.09886184/.test(sp)) problems.push(`[${where}] 100 m/min at 10 mm: expected 3183.09886184 RPM, got "${sp}"`);
await page.click('#main .bcalc .bc-fsel button[data-f="bolt"]');
await units('inch');
where = 'calc bolt circle';
const bolt = (await page.textContent('#main .bcalc .bc-fout')) || '';
if (!/Hole 6/.test(bolt)) problems.push(`[${where}] bolt circle list missing: "${bolt.slice(0, 80)}"`);
where = 'calc use';
await open('rpm');
await page.evaluate(() => { const i = document.querySelector('#main input'); window.__calcIn = 0; i.addEventListener('input', () => window.__calcIn++); window.BenchCalc.open(i); });
if (!(await page.isVisible('#bcalc-panel.bc-float'))) problems.push(`[${where}] floating panel not shown`);
await page.fill('#bcalc-panel .bc-expr', '1/2 + 1/4');
await page.click('#bcalc-panel .bc-usebtn');
const used = await page.evaluate(() => [document.querySelector('#main input').value, window.__calcIn, window.BenchCalc.isOpen]);
if (used[0] !== '0.75' || used[1] < 1 || used[2]) problems.push(`[${where}] Use: expected value 0.75, an input event and a closed panel, got ${JSON.stringify(used)}`);
where = 'calc esc';
await page.evaluate(() => window.BenchCalc.open());
await page.keyboard.press('Escape');
if (await page.evaluate(() => window.BenchCalc.isOpen)) problems.push(`[${where}] Esc did not close the panel`);
where = 'calc phone';
await page.setViewportSize({ width: 390, height: 800 });
await page.evaluate(() => window.BenchCalc.open(document.querySelector('#main input')));
if (!(await page.isVisible('#bcalc-panel.bc-modal'))) problems.push(`[${where}] modal sheet not shown at phone width`);
const over = await page.evaluate(() => document.getElementById('bcalc-panel').scrollWidth - window.innerWidth);
if (over > 0) problems.push(`[${where}] panel wider than the screen by ${over}px`);
await page.evaluate(() => window.BenchCalc.close());
await page.setViewportSize({ width: 1280, height: 900 });

// Material data: a designation a publisher prints must not also be listed as "unsourced".
where = 'materials data';
const mat = JSON.parse(await readFile(path.join(appDir, 'data/materials.json'), 'utf8'));
const mnorm = v => String(v).replace(/^UNS\s*/i, '').replace(/\s*\([^)]*\)/g, '').replace(/^(EN\s*)?AW\s*-?\s*/i, '').replace(/[\s-]/g, '').toUpperCase();
for (const m of mat.materials) for (const [k, u] of Object.entries(m.unsourced || {}))
  if (u && (m.fields[k] || []).some(v => mnorm(v.value) === mnorm(u))) problems.push(`[${where}] ${m.grade} ${k}: "${u}" is printed by a source but listed as unsourced`);

await browser.close();
server.close();
if (problems.length) {
  console.error(problems.join('\n'));
  console.error(`FAILED: ${problems.length} problem(s)`);
  process.exit(1);
}
console.log(`OK: ${meta.tools.length} tools opened in three modes, inch and mm, with no console errors`);
