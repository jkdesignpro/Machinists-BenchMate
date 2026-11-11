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

// Every calculator has a drawing. A calculator built from fields must show its drawing with the
// default inputs. A custom screen must have a registered drawing (the Drawing panel), or draw its
// own figure, or be on this list of screens with nothing to draw: reference tables, converters,
// managers, and three that draw a small figure of their own once something is picked.
where = 'drawings';
const NO_DRAWING = new Set(['drillchart', 'gritconv', 'prefnum', 'gmcodes', 'macroref', 'abbrev', 'units', 'calc', 'formulas',
  'machines', 'toollib', 'setupsheet', 'materials', 'tempercolours', 'heattreat', 'plastics', 'metalid',
  'gsim', 'insertcode', 'gdtfcf', 'boltgrade']);
await units('inch');
const noDrawing = [];
for (const id of meta.tools) {
  if (NO_DRAWING.has(id)) continue;
  await open(id, 70);
  const ok = await page.evaluate(i => {
    const t = TOOLS.find(x => x.id === i), m = document.querySelector('#main .tpb');
    const kit = [...m.querySelectorAll('.tdia')].some(d => !d.hidden && d.querySelector('svg'));
    if (!t.render) return kit;
    return kit || [...m.querySelectorAll('svg')].some(g => g.viewBox && g.viewBox.baseVal.width > 150);
  }, id);
  if (!ok) noDrawing.push(id);
}
if (noDrawing.length) problems.push(`[${where}] no drawing with the default inputs: ${noDrawing.join(', ')}`);

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
const themeNow = () => page.evaluate(() => document.documentElement.getAttribute('data-theme'));
if ((await themeNow()) !== 'dark') problems.push(`[${where}] the look should start dark, got "${await themeNow()}"`);
await page.click('#menubtn');
for (const t of ['auto', 'light', 'dark']) {
  await page.click(`#mtheme button[data-v="${t}"]`);
  if ((await themeNow()) !== t) problems.push(`[${where}] ${t} theme not applied`);
}
// Accent colour: a swatch sets --key and is remembered; a dark colour gets white lettering; amber puts it back.
where = 'accent';
const keyNow = () => page.evaluate(() => [document.documentElement.style.getPropertyValue('--key'), document.documentElement.style.getPropertyValue('--key-ink'), localStorage.getItem('bm.accent')].join(' '));
await page.click('#maccent button[data-c="#35c5f0"]');
if ((await keyNow()) !== '#35c5f0 #141414 #35c5f0') problems.push(`[${where}] cyan swatch gave "${await keyNow()}"`);
if (!(await page.$('#maccent button[data-c="#35c5f0"].on'))) problems.push(`[${where}] the chosen swatch is not marked`);
await page.$eval('#maccentpick', e => { e.value = '#203a8f'; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); });
if ((await keyNow()) !== '#203a8f #ffffff #203a8f') problems.push(`[${where}] picked navy gave "${await keyNow()}"`);
const lift = await page.evaluate(() => document.documentElement.style.getPropertyValue('--key-lift'));
if (lift === '#203a8f' || !/^#[0-9a-f]{6}$/.test(lift)) problems.push(`[${where}] navy was not lightened for text on the dark panel, got "${lift}"`);
if (!(await page.$('.swpick.on'))) problems.push(`[${where}] the picker is not marked for a custom colour`);
await page.reload(); await page.waitForSelector('#main h1, #main .wshead, #main .dhead');
if ((await keyNow()) !== '#203a8f #ffffff #203a8f') problems.push(`[${where}] accent not kept after a reload, got "${await keyNow()}"`);
await page.click('#menubtn');
await page.click('#maccent button[data-c="#ffb000"]');
if ((await keyNow()) !== '#ffb000 #141414 #ffb000') problems.push(`[${where}] amber swatch gave "${await keyNow()}"`);
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

// Thread identifier: a 9.85 mm screw with a 1.5 mm pitch is M10 x 1.5, with 3/8-16 UNC only possible;
// an 8.4 mm bore with the same pitch is M10 x 1.5 too, and the link opens that thread.
where = 'threadid';
await open('threadid');
await page.waitForSelector('#ires table');
const tidRows = () => page.$$eval('#ires tr', trs => trs.slice(1).map(tr => [...tr.querySelectorAll('td')].slice(0, 2).map(td => td.textContent.trim()).join(' | ')));
for (const [k, v] of [['#idv', '9.85'], ['#ipv', '1.5']]) { await page.fill(k, v); await page.dispatchEvent(k, 'input'); }
let tid = await tidRows();
if (tid[0] !== 'M10 x 1.5 | Closest' || !tid.includes('3/8-16 UNC | possible')) problems.push(`[${where}] screw 9.85 x 1.5: got ${tid.join('; ')}`);
await page.selectOption('#ipu', 'tpi');
if (Math.abs(parseFloat(await page.inputValue('#ipv')) - 16.9333) > 0.001) problems.push(`[${where}] 1.5 mm should become 16.9333 TPI, got ${await page.inputValue('#ipv')}`);
await page.selectOption('#ipu', 'mm');
await page.click('#ib button[data-v="1"]');
await page.fill('#idv', '8.4'); await page.dispatchEvent('#idv', 'input');
tid = await tidRows();
if (tid[0] !== 'M10 x 1.5 | Closest') problems.push(`[${where}] bore 8.4 x 1.5: got ${tid.join('; ')}`);
await page.fill('#ipv', '9'); await page.dispatchEvent('#ipv', 'input');
if (!/No standard thread/.test(await page.textContent('#ires'))) problems.push(`[${where}] an 8.4 mm bore with a 9 mm pitch should match nothing`);
await page.fill('#ipv', '1.5'); await page.dispatchEvent('#ipv', 'input');
await page.click('#ires a[data-i="0"]');
await page.waitForSelector('#hk');
if ((await page.inputValue('#hk')) !== 'M10x1.5') problems.push(`[${where}] the link should open M10 x 1.5 in Thread data, got ${await page.inputValue('#hk')}`);
await open('threadid');
await page.waitForSelector('#ib');
await page.click('#ib button[data-v="0"]');
for (const [k, v] of [['#idv', '9.85'], ['#ipv', '1.5']]) { await page.fill(k, v); await page.dispatchEvent(k, 'input'); }

// Middle of a tolerance: 25 +0.05 / -0.02 is 25.05 to 24.98, middle 25.015.
where = 'tolmid';
await open('tolmid');
for (const [k, v] of [['nom', '25'], ['up', '0.05'], ['lo', '-0.02']]) { await page.fill(`#main [data-id="${k}"]`, v); await page.dispatchEvent(`#main [data-id="${k}"]`, 'input'); }
const tolRows = await page.$eval('#res', e => [...e.querySelectorAll('.rrow')].map(t => t.innerText.replace(/\s+/g, ' ')).join(' ; '));
if (!/Middle of the tolerance[^;]*25\.0150 mm/i.test(tolRows) || !/Upper limit[^;]*25\.0500 mm/i.test(tolRows) || !/Lower limit[^;]*24\.9800 mm/i.test(tolRows)) problems.push(`[${where}] 25 +0.05/-0.02: got "${tolRows}"`);
await page.click('#main .tpa button[title^="Reset"]');

// Wear offset adjustment: a 25.04 mm diameter for 25.00 needs -0.04 on a lathe; the same as a pocket
// with a radius-type D offset needs +0.02.
where = 'offsetadj';
await open('offsetadj');
for (const [k, v] of [['meas', '25.04'], ['targ', '25'], ['cur', '0']]) { await page.fill(`#main [data-id="${k}"]`, v); await page.dispatchEvent(`#main [data-id="${k}"]`, 'input'); }
const offRows = () => page.$eval('#res', e => [...e.querySelectorAll('.rrow')].map(t => t.innerText.replace(/\s+/g, ' ')).join(' ; '));
let off = await offRows();
if (!/Change the X wear offset by -0\.0400 mm/i.test(off) || !/Subtract 0\.04 mm/.test(off)) problems.push(`[${where}] lathe 25.04 for 25: got "${off}"`);
await page.selectOption('#main [data-id="kind"]', '3');
off = await offRows();
if (!/Change the D \(cutter\) wear offset by 0\.0200 mm/i.test(off) || !/Add 0\.02 mm/.test(off)) problems.push(`[${where}] pocket 25.04 for 25, radius value: got "${off}"`);
await page.click('#main .tpa button[title^="Reset"]');

// Worked examples: every one must agree with its published value, and the panel shows on the page.
where = 'worked examples';
const proofs = await page.evaluate(() => TOOLS.filter(t => t.proof).map(t => ({ id: t.id, bad: t.proof.flatMap(ex => proofRun(t, ex).filter(r => !r.ok).map(r => ex.name + ': ' + r.label + ' published ' + r.val + ', got ' + r.got)) })));
if (proofs.length < 5) problems.push(`[${where}] expected at least 5 tools with a worked example, found ${proofs.length}`);
for (const p of proofs) if (p.bad.length) problems.push(`[${where}] ${p.id}: ${p.bad.join('; ')}`);
await units('mm');
await open('taper');
if (!(await page.$('#main details.proof .badge.confirmed'))) problems.push(`[${where}] the taper page does not show its worked example as agreeing`);
await page.click('#main details.proof summary');
await page.click('#main details.proof button[data-ex="0"]');
await page.waitForTimeout(80);
const taperHalf = await page.$eval('#res', e => [...e.querySelectorAll('.rrow')].map(t => t.innerText.replace(/\s+/g, ' ')).find(t => /Half angle/.test(t)) || '');
if (!/1\.7899/.test(taperHalf) || (await page.evaluate(() => state.sys)) !== 'inch') problems.push(`[${where}] loading the taper example should switch to inch and give 1.7899 deg, got "${taperHalf}"`);
await page.click('#main .tpa button[title^="Reset"]');

// A link with numbers: opens the calculator in the link's units with those numbers, then drops them from the address.
where = 'link with numbers';
await page.evaluate(() => { location.hash = '#/t/rpm?_sys=mm&speed=120&dia=20&_src_speed=speed'; });
await page.waitForTimeout(150);
const linkRpm = await page.$eval('#res', e => e.innerText.replace(/\s+/g, ' '));
if (!/1,909\.9/.test(linkRpm)) problems.push(`[${where}] 120 m/min at 20 mm should give 1,909.9 RPM, got "${linkRpm}"`);
if ((await page.evaluate(() => location.hash)) !== '#/t/rpm') problems.push(`[${where}] the numbers should be dropped from the address, got ${await page.evaluate(() => location.hash)}`);
const linkQ = await page.evaluate(() => { const b = document.querySelector('#main .tpa button[title^="Copy a link"]'); return !!b; });
if (!linkQ) problems.push(`[${where}] no link button on the calculator`);
if (!(await page.$('#main .tpa button[title^="Print this page"]'))) problems.push(`[${where}] no print button on the calculator`);
await page.click('#main .tpa button[title^="Reset"]');
await units('mm');

// Milling surface finish: 0.05 mm per tooth, 4 teeth, corner radius 0.8 mm: Ra 0.098 um, 16 times that for one tooth.
where = 'millfinish';
await units('mm');
await open('millfinish');
for (const [k, v] of [['fz', '0.05'], ['z', '4'], ['r', '0.8']]) { await page.fill(`#main [data-id="${k}"]`, v); await page.dispatchEvent(`#main [data-id="${k}"]`, 'input'); }
const mfRows = await page.$eval('#res', e => [...e.querySelectorAll('.rrow')].map(t => t.innerText.replace(/\s+/g, ' ')).join(' ; '));
if (!/every tooth cutting alike 0\.098 um/i.test(mfRows) || !/Ra, one tooth marking \(runout\) 1\.563 um/.test(mfRows)) problems.push(`[${where}] got "${mfRows}"`);
await page.click('#main .tpa button[title^="Reset"]');
// RMS on the conversions page: Ra 1.6 um is 1.78 um RMS for a sine profile.
where = 'surface rms';
await open('surface');
await page.waitForSelector('#sr');
await page.fill('#sr', '1.6'); await page.dispatchEvent('#sr', 'input');
const rmsTxt = ((await page.textContent('#sres')) || '').replace(/\s+/g, ' ');
if (!/RMS \(Rq\), if the profile were a pure sine wave\s*1\.78 um/.test(rmsTxt)) problems.push(`[${where}] got "${rmsTxt.slice(0, 200)}"`);

// Cutting forces (0.3.0). Hand values are in core/src/cutforce.rs and docs/sources.md.
await units('mm');
for (const [id, re] of [
  ['kcforce', /Specific cutting force kc at this chip thickness 2,139 N\/mm2/i],   // group 2, 0.2 mm/rev at 95 deg: 1500 x 0.19924^-0.22
  ['drillforce', /Torque 5\.04 N m ; Feed force \(thrust\) 947 N/i],               // 10 mm, 0.15 mm/rev, 140 deg point, group 2
  ['taptorque', /Torque, cutting tap 7\.03 N m/i],                                 // M10 x 1.5, kc 2500: 2500 x 2.25 x 10 / 8000
  ['leadthin', /Feed per tooth for that chip 0\.1414 mm/i],                        // 0.1 mm chip at 45 deg
  ['slender', /oversize by, at the worst place 311\.9 um/i],                       // 12 mm steel, 100 mm, 100 N, chuck only
]) {
  where = id;
  await open(id);
  const t = await page.$eval('#res', e => [...e.querySelectorAll('.rrow')].map(x => x.innerText.replace(/\s+/g, ' ')).join(' ; '));
  if (!re.test(t)) problems.push(`[${where}] got "${t.slice(0, 300)}"`);
}
// A tailstock centre cuts the oversize of the same part to about a thirty-fourth: 311.9 / 33.97 = 9.2 um.
where = 'slender centre';
await page.selectOption('#main [data-id="sup"]', '1');
const slT = await page.$eval('#res', e => e.innerText.replace(/\s+/g, ' '));
if (!/worst place 9\.2 um/i.test(slT) || !/In the chuck only it would be 311\.9/i.test(slT)) problems.push(`[${where}] got "${slT.slice(0, 300)}"`);
await page.click('#main .tpa button[title^="Reset"]');

// Speeds and feeds advisor (0.3.0). Hand values from the publishers' tables (docs/sources.md, "Advisor"):
// milling: 12 mm carbide in low carbon steel, Harvey Tool 100 to 300 ft/min, middle 200 ft/min = 60.96 m/min: n = 1617 rpm;
//   chip load between 3/8 in (0.002) and 1/2 in (0.003) at 0.4724 in = 0.00278 in = 0.0706 mm; Vf = 1617 x 4 x 0.0706 = 457 mm/min.
// drilling: 10 mm HSS, LittleMachineShop 60 to 100 ft/min, middle 80 = 24.38 m/min: 776 rpm; feed 0.004 to 0.008 in/rev, middle 0.152 mm/rev;
//   kc = 1350 x (0.0762 sin 59)^-0.21 = 2394; torque = 100 x 0.1524 x 2394 / 8000 = 4.56 N m.
// reaming: 10 mm, 40 to 65 ft/min, middle 52.5 = 16.0 m/min: 509 rpm; ICS stock 0.010 to 0.015 in; Gammons 3 % = 0.3 mm, drill 9.7 mm.
// turning: 25 mm, carbide 800 to 885 ft/min, middle 842.5 = 256.8 m/min: 3270 rpm; feed (0.4 / 3 + 0.4 / 2) / 2 = 0.1667 mm/rev;
//   kc = 1350 x (0.1667 sin 95)^-0.21 = 1968; Fc = 1968 x 1.016 x 0.1667 = 333 N; Ra = 0.1667^2 / (32 x 0.4) x 1000 = 2.17 um.
for (const [id, res] of [
  ['advmill', [/Spindle speed 1,617 RPM/i, /Table feed 457 mm\/min/, /Feed per tooth 0\.0706 mm/, /From the table: chip load \(Harvey Tool, between two printed sizes/]],
  ['advdrill', [/Spindle speed 776 RPM/i, /0\.152 mm\/rev/, /Torque 4\.56 N m/, /Point length to add to the depth 3\.004 mm/]],
  ['advream', [/Spindle speed 509 RPM/i, /0\.254 to 0\.381 mm/, /Hole to drill first, Gammons 9\.700 mm/]],
  ['advturn', [/Spindle speed 3,270 RPM/i, /Cutting force 333 N/, /theoretical Ra\) 2\.17 um/]],
]) {
  where = id;
  await open(id);
  const t = await page.$eval('#res', e => [...e.querySelectorAll('.rrow')].map(x => x.innerText.replace(/\s+/g, ' ')).join(' ; '));
  for (const re of res) if (!re.test(t)) problems.push(`[${where}] ${re} not in "${t.slice(0, 400)}"`);
  if (!(await page.$('#res .limcard'))) problems.push(`[${where}] no limit card`);
  if (!(await page.$('#res .rtab.text'))) problems.push(`[${where}] no table of publishers`);
}
// Locks and the limit card on the milling advisor: a 0.5 kW spindle limits the cut, and a typed depth is never changed.
where = 'advmill locks';
await open('advmill');
const advSet = async (k, v) => { await page.fill(`#main [data-id="${k}"]`, v); await page.dispatchEvent(`#main [data-id="${k}"]`, 'input'); };
const advTxt = async () => (await page.$eval('#res', e => e.innerText.replace(/\s+/g, ' ')));
if ((await page.getAttribute('#main [data-id="ae"]', 'placeholder')) !== '6' || (await page.getAttribute('#main [data-id="ap"]', 'placeholder')) !== '12') problems.push(`[${where}] suggested width and depth are not shown in the empty boxes`);
await advSet('pmax', '0.5');
let aT = await advTxt();
if (!/What is limiting this cut Spindle power/i.test(aT) || !/Depth of cut ap \(reduced from 12\.000 mm to fit spindle power\)/.test(aT)) problems.push(`[${where}] power limit: "${aT.slice(0, 500)}"`);
await advSet('ap', '12');
aT = await advTxt();
if (!/Depth of cut ap \(yours, locked\) 12\.000 mm/.test(aT) || !/Width of cut ae \(reduced from 6\.000 mm to fit spindle power\)/.test(aT)) problems.push(`[${where}] locked depth: "${aT.slice(0, 500)}"`);
await advSet('ae', '6');
aT = await advTxt();
if (!/Width of cut ae \(yours, locked\) 6\.000 mm/.test(aT) || !/Depth of cut ap \(yours, locked\) 12\.000 mm/.test(aT) || !/Your width and depth are locked, so the feed per tooth was reduced/.test(aT)) problems.push(`[${where}] both locked: "${aT.slice(0, 500)}"`);
if (!(await page.$('#main label.f.locked [data-id="ap"]'))) problems.push(`[${where}] the lock is not shown closed`);
// the lock button clears a locked box
await page.click('#main label.f.locked:has([data-id="ap"]) .flock');
if ((await page.inputValue('#main [data-id="ap"]')) !== '') problems.push(`[${where}] the lock button did not unlock the depth`);
await page.click('#main .tpa button[title^="Reset"]');
// Top spindle speed named: a 3 mm cutter in aluminium wants far more than 8000 rpm.
where = 'advmill top speed';
await open('advmill');
await page.selectOption('#main [data-id="mat"]', '15');
await advSet('d', '3'); await advSet('L', '12'); await advSet('lf', '8'); await advSet('nmax', '8000');
aT = await advTxt();
if (!/Spindle speed 8,000 RPM/i.test(aT) || !/What is limiting this cut Top spindle speed/i.test(aT)) problems.push(`[${where}] "${aT.slice(0, 400)}"`);
await page.click('#main .tpa button[title^="Reset"]');

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

// Thread data: a looked-up thread goes to the top of Recent threads, each value row has a copy button,
// and "Thread mill this" / "Lathe G76 for this" fill the program generators.
where = 'threaddata history';
await mode('advanced');
await units('mm');
await page.evaluate(() => localStorage.removeItem('bm.thrhist'));
await open('threaddata', 300);
await page.waitForSelector('#hk');
await page.selectOption('#hk', 'M12x1.75');
await page.waitForTimeout(60);
const th0 = await page.evaluate(() => [(JSON.parse(localStorage.getItem('bm.thrhist') || '[]')[0] || {}).key, (document.querySelector('#hhist .fchip') || {}).textContent || '']);
if (th0[0] !== 'M12x1.75' || !/M12 x 1\.75/.test(th0[1])) problems.push(`[${where}] last thread not first in Recent threads: ${JSON.stringify(th0)}`);
const thCopy = await page.$$eval('#hres button.cpy', bs => bs.map(b => b.dataset.copy));
if (thCopy.length < 15 || thCopy[0] !== '12.000') problems.push(`[${where}] copy buttons: expected 15 or more, the first copying "12.000", got ${thCopy.length}, first "${thCopy[0]}"`);
where = 'threaddata to thread mill';
await page.click('#hint button[data-v="1"]');
await page.click('#hgomill');
await page.waitForSelector('#main [data-k="major"]');
await page.waitForTimeout(150);
const tm = await page.evaluate(() => ({ hash: location.hash, major: document.querySelector('#main [data-k="major"]').value, pitch: document.querySelector('#main [data-k="pitch"]').value, internal: document.querySelector('#main [data-k="internal"]').value,
  from: (document.querySelector('#cystdmsg') || {}).textContent || '', prog: (document.querySelector('#cytext') || {}).textContent || '' }));
if (!/cyctmill/.test(tm.hash) || tm.major !== '12' || tm.pitch !== '1.75' || tm.internal !== '1' || !/M12 x 1\.75/.test(tm.from) || !/G0?3/.test(tm.prog)) problems.push(`[${where}] hand-off did not fill the thread mill: ${JSON.stringify(tm).slice(0, 300)}`);
where = 'thread mill sections';
await page.fill('#main [data-k="major"]', '');
await page.dispatchEvent('#main [data-k="major"]', 'input');
const tmNeed = await page.evaluate(() => [document.querySelector('details[data-sec="thread"] .rdy.no') ? 1 : 0, document.querySelectorAll('details.cysec .rdy:not(.no)').length, document.querySelector('#cytext') ? 1 : 0]);
if (tmNeed[0] !== 1 || tmNeed[1] !== 4 || tmNeed[2] !== 0) problems.push(`[${where}] blank major diameter: expected Thread "Needs input", 4 sections Ready and no program, got ${JSON.stringify(tmNeed)}`);
await page.waitForSelector('#cystd option[value="M16x2"]', { state: 'attached' });
await page.selectOption('#cystd', 'M16x2');
await page.waitForTimeout(60);
const tmStd = await page.evaluate(() => [document.querySelector('#main [data-k="major"]').value, document.querySelector('#main [data-k="pitch"]').value, document.querySelectorAll('details.cysec .rdy.no').length, document.querySelector('#cytext') ? 1 : 0]);
if (tmStd.join(' ') !== '16 2 0 1') problems.push(`[${where}] Fill from a standard thread M16 x 2: got ${JSON.stringify(tmStd)}`);
where = 'threaddata to lathe G76 (inch)';
await units('inch');
await open('threaddata', 200);
await page.waitForSelector('#hk');
await page.selectOption('#hk', '1/2-13 UNC');
await page.click('#hgolathe');
await page.waitForSelector('#main [data-k="major"]');
const lt = await page.evaluate(() => [location.hash, document.querySelector('#main [data-k="major"]').value, document.querySelector('#main [data-k="pitch"]').value]);
if (!/cycthread/.test(lt[0]) || lt[1] !== '0.5' || lt[2] !== '13') problems.push(`[${where}] hand-off did not fill G76: ${JSON.stringify(lt)}`);

// G and M codes: an operation chip narrows the list, and a row opens its info drawer.
where = 'gmcodes tags';
await open('gmcodes', 300);
await page.waitForSelector('#gmt .fchip');
await page.selectOption('#gmc', 'haas');
const gmAll = await page.$$eval('#gmres tr.gmrow', rs => rs.length);
await page.click('#gmt .fchip[data-t="coolant"]');
const gmCool = await page.$$eval('#gmres tr.gmrow', rs => rs.map(r => r.cells[1].textContent));
if (!(gmCool.length > 0 && gmCool.length < gmAll) || !gmCool.every(t => /coolant|air/i.test(t))) problems.push(`[${where}] Coolant chip: ${gmCool.length} of ${gmAll} rows: ${gmCool.slice(0, 4).join(' | ')}`);
await page.click('#gmres tr.gmrow td:first-child');
const gmDr = await page.evaluate(() => { const d = document.querySelector('#gmres .gmdrawer'); return d ? d.innerText : ''; });
if (!/Meaning/i.test(gmDr) || !/Sources/i.test(gmDr) || !/Other controls/i.test(gmDr)) problems.push(`[${where}] info drawer did not open with meaning, other controls and sources`);
await page.click('#gmt .fchip[data-t=""]');
await page.click('#gmres .gmdx');

// Keyway broaching: a saved preset survives a reload and fills the form; it can be deleted.
where = 'broach preset';
await units('mm');
await page.evaluate(() => localStorage.removeItem('bm.broachpresets'));
await open('cycbroach', 200);
await page.fill('#main [data-k="bore"]', '31.5');
await page.dispatchEvent('#main [data-k="bore"]', 'input');
await page.fill('#bpname', 'Smoke 8 mm key');
await page.click('#bpsave');
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => state && state.W);
await open('cycbroach', 200);
await page.fill('#main [data-k="bore"]', '40');
await page.dispatchEvent('#main [data-k="bore"]', 'input');
const bpOpt = await page.$$eval('#bpsel option', os => os.filter(o => /Smoke 8 mm key/.test(o.textContent)).map(o => o.value));
if (bpOpt.length !== 1) problems.push(`[${where}] saved preset not listed after a reload`);
else {
  await page.selectOption('#bpsel', bpOpt[0]);
  const bore = await page.inputValue('#main [data-k="bore"]');
  if (bore !== '31.5') problems.push(`[${where}] preset did not fill the bore: "${bore}"`);
  await page.click('#bpdel');
  if (await page.evaluate(() => JSON.parse(localStorage.getItem('bm.broachpresets') || '[]').length)) problems.push(`[${where}] preset not deleted`);
}

// Formula library: a starred formula shows under the Favourites chip.
where = 'formula favourite';
await page.evaluate(() => localStorage.removeItem('bm.formfav'));
await open('formulas', 200);
await page.click('#fg .fchip[data-g=""]');
const fName = await page.$eval('#flist .frow b', b => b.textContent);
await page.click('#flist .frow .fstar');
await page.click('#fg .fchip:nth-child(2)');
const favRows = await page.$$eval('#flist .frow b', bs => bs.map(b => b.textContent));
if (favRows.length !== 1 || favRows[0] !== fName) problems.push(`[${where}] Favourites shows ${JSON.stringify(favRows)}, expected only "${fName}"`);
const openBtns = await page.$$eval('#flist .frow .flink', bs => bs.map(b => b.textContent));
if (openBtns[0] !== 'Open calculator') problems.push(`[${where}] no "Open calculator" button`);
await page.click('#flist .frow .fstar');
await page.click('#fg .fchip[data-g=""]');
await units('inch');

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
