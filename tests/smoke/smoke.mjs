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
  'gsim', 'sketch', 'insertcode', 'gdtfcf', 'boltgrade']);
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

// Stability chart in the milling advisor. 12 mm carbide bar, 40 mm out: k = 3 x 580000 x 1017.88 / 64000 = 27 674 N/mm, zeta 0.03,
// kc at hm 0.04495 mm = 1350 x 0.04495^-0.21 = 2590, Ks = 2590 / sin 62 = 2933, Nt* = 4 x 90 / 360 = 1:
// stable at every speed = 4 x 27674 x 0.03 x 1.03 / (2 x 2933 x cos 62) = 1.242 mm. The marker moves and can set the advisor's speed.
where = 'advmill stability chart';
await open('advmill');
await page.waitForSelector('#res .rwidget svg.lobe');
let lobeT = await page.$eval('#res .rwidget', e => e.innerText.replace(/\s+/g, ' '));
if (!/stable at every speed: 1\.242 mm/.test(lobeT) || !/At 1,617 RPM/.test(lobeT)) problems.push(`[${where}] "${lobeT.slice(0, 300)}"`);
await page.$eval('#res .lobesl', e => { e.value = '2000'; e.dispatchEvent(new Event('input', { bubbles: true })); });
lobeT = await page.$eval('#res .lobeout', e => e.innerText.replace(/\s+/g, ' '));
if (!/At 2,000 RPM/.test(lobeT)) problems.push(`[${where}] the marker did not move: "${lobeT.slice(0, 200)}"`);
await page.click('#res .lobebtn button');
await page.waitForTimeout(150);
aT = await advTxt();
if (!/Spindle speed 2,000 RPM/i.test(aT)) problems.push(`[${where}] the chart did not set the advisor's speed: "${aT.slice(0, 200)}"`);
await page.click('#main .tpa button[title^="Reset"]');

// Boring bar advisor. 20 mm steel bar, 60 mm out, low carbon steel, 0.4 mm nose radius: feed 0.1667 mm/rev, kc 1968 (as the turning
// advisor above), Fc = 1968 x 1.016 x 0.1667 = 333.3 N; I = pi 20^4 / 64 = 7853.98 mm4; delta = 333.3 x 60^3 / (3 x 210000 x 7853.98) = 0.01455 mm.
where = 'boringbar advisor';
await open('boringbar');
aT = await advTxt();
if (!/Tip deflection, tangential \(edge drops below centre\) 14\.5 um/i.test(aT) || !/Tangential force Fc = kc ap fn 333\.3 N/.test(aT) || !/What is limiting this cut Nothing/i.test(aT)) problems.push(`[${where}] defaults: "${aT.slice(0, 500)}"`);
// 130 mm out (6.5 x D against 3 x D) for a finishing cut: the overhang is named and the depth comes down to 0.01 / (0.01455 x (130/60)^3 / 1.016) = 0.069 mm.
await advSet('L', '130'); await page.selectOption('#main [data-id="cut"]', '3');
aT = await advTxt();
if (!/What is limiting this cut Overhang/i.test(aT) || !/Depth of cut \(reduced from 1\.016 mm to fit the deflection\) 0\.069 mm/.test(aT)) problems.push(`[${where}] overhang: "${aT.slice(0, 600)}"`);
// a typed depth is locked and reported over, never changed
await advSet('ap', '0.5');
aT = await advTxt();
if (!/Depth of cut \(yours, locked\) 0\.500 mm/.test(aT) || !/What is limiting this cut Bar deflection/i.test(aT)) problems.push(`[${where}] locked depth: "${aT.slice(0, 600)}"`);
// the overhang slider drives the overhang box: 8 x D on a 20 mm bar is 160 mm
await page.$eval('#main [data-id="ld"]', e => { e.value = '8'; e.dispatchEvent(new Event('input', { bubbles: true })); });
if ((await page.inputValue('#main [data-id="L"]')) !== '160') problems.push(`[${where}] the overhang slider did not set the overhang: ${await page.inputValue('#main [data-id="L"]')}`);
await page.click('#main .tpa button[title^="Reset"]');

// Slitting saw from the saw sheet: HSS saw in carbon steel, 25 to 125 ft/min, middle 75 ft/min = 22.86 m/min: n = 22860 / (pi x 80) = 91 rpm;
// feed per tooth 0.002 to 0.006 in, middle 0.004 in = 0.1016 mm; Vf = 90.96 x 32 x 0.1016 = 295.7 mm/min. A typed speed is used as it is.
where = 'slitsaw advisor';
await open('slitsaw');
aT = await advTxt();
if (!/Spindle speed 91 RPM/i.test(aT) || !/Table feed 295\.7\d mm\/min/.test(aT) || !/Feed per tooth \(suggested: Gaylee, HSS saws\) 0\.1016 mm/.test(aT)) problems.push(`[${where}] defaults: "${aT.slice(0, 500)}"`);
await advSet('speed', '40');
aT = await advTxt();
if (!/Spindle speed 159 RPM/i.test(aT) || !/Cutting speed \(yours, locked\) 40 m\/min/.test(aT)) problems.push(`[${where}] typed speed: "${aT.slice(0, 500)}"`);
await page.click('#main .tpa button[title^="Reset"]');

// Tapping advisor: M10 x 1.5 in low carbon steel, 20 to 40 ft/min, middle 30 ft/min = 9.144 m/min: n = 9144 / (pi x 10) = 291.06, run at 291 rpm;
// feed 291 x 1.5 = 436.5 mm/min; 15 mm deep in and out 30 / 436.5 min = 4.1 s. A 250 rpm limit: feed 375 mm/min, card Top spindle speed.
// A top feed of 300 mm/min: 200 rpm, feed 300 mm/min, and the feed per revolution is still the pitch.
where = 'advtap';
await open('advtap');
aT = await advTxt();
if (!/Spindle speed 291 RPM/i.test(aT) || !/Feed rate \(pitch x spindle speed\) 436\.50 mm\/min/.test(aT) || !/Time in and out [^0-9]*4\.1 s/.test(aT) || !/Nothing/.test(aT)) problems.push(`[${where}] defaults: "${aT.slice(0, 500)}"`);
await advSet('nmax', '250');
aT = await advTxt();
if (!/Spindle speed 250 RPM/i.test(aT) || !/Feed rate \(pitch x spindle speed\) 375\.00 mm\/min/.test(aT) || !/Top spindle speed/i.test(aT) || !/needs 291 RPM/.test(aT)) problems.push(`[${where}] speed limit: "${aT.slice(0, 500)}"`);
await advSet('vfmax', '300');
aT = await advTxt();
if (!/Spindle speed 200 RPM/i.test(aT) || !/Feed rate \(pitch x spindle speed\) 300\.00 mm\/min/.test(aT) || !/Top feed rate/i.test(aT) || !/Feed per revolution \(the pitch\) 1\.500 mm\/rev/.test(aT)) problems.push(`[${where}] feed limit: "${aT.slice(0, 600)}"`);
await page.click('#main .tpa button[title^="Reset"]');

// Plunge roughing: 12 mm carbide end mill, 4 flutes, low carbon steel. Harvey Tool: 100 to 300 ft/min, middle 200 = 60.96 m/min; chip load at
// 0.4724 in between 0.002 (3/8) and 0.003 (1/2) = 0.0027795 in = 0.0706 mm. University of Florida rule: 75 % speed = 45.72 m/min,
// n = 45720 / (pi x 12) = 1213 rpm; 25 % feed = 0.01765 mm; Vf = 1212.76 x 4 x 0.01765 = 85.6 mm/min. Plunges 3 mm apart: cusp 0.191 mm;
// a 50 mm row: 18 plunges. CGS rule: table speed 1617 rpm, 35 % feed = 0.02471 mm, Vf = 159.8 mm/min. Held to 1000 rpm: Vf = 98.8 mm/min.
where = 'advplunge';
await open('advplunge');
aT = await advTxt();
if (!/Spindle speed 1,213 RPM/i.test(aT) || !/Feed rate straight down 85\.6 mm\/min/.test(aT) || !/Cusp left on the wall between plunges 0\.191 mm/.test(aT) || !/Plunges in the row \(one at each end\) 18/.test(aT)) problems.push(`[${where}] defaults: "${aT.slice(0, 700)}"`);
await page.selectOption('#main [data-id="rule"]', '2');
aT = await advTxt();
if (!/Spindle speed 1,617 RPM/i.test(aT) || !/Feed rate straight down 159\.8 mm\/min/.test(aT)) problems.push(`[${where}] CGS rule: "${aT.slice(0, 500)}"`);
await advSet('nmax', '1000');
aT = await advTxt();
if (!/Spindle speed 1,000 RPM/i.test(aT) || !/Feed rate straight down 98\.8 mm\/min/.test(aT) || !/Top spindle speed/i.test(aT)) problems.push(`[${where}] speed limit: "${aT.slice(0, 500)}"`);
await page.click('#main .tpa button[title^="Reset"]');

// Holder and spindle stiffness in the tool deflection page. Solid 12 mm carbide rod, 40 mm out, 100 N: I = pi 12^4 / 64 = 1017.88 mm4,
// bending 100 x 64000 / (3 x 580000 x 1017.88) = 0.0036 mm. A holder of 20 N/um gives 100 / 20 = 5 um more: 0.0086 mm.
// A push test of 200 N moving the holder 0.01 mm is the same 20 N/um.
where = 'deflection holder';
await open('deflection');
await advSet('lf', ''); await advSet('F', '100');
aT = await advTxt();
if (!/Tip deflection 0\.0036 mm/.test(aT) || !/Taken as rigid/.test(aT)) problems.push(`[${where}] rigid: "${aT.slice(0, 500)}"`);
await advSet('kh', '20');
aT = await advTxt();
if (!/Tip deflection \(tool and holder\) 0\.0086 mm/.test(aT) || !/Of which the holder and spindle giving way 0\.0050 mm/.test(aT)) problems.push(`[${where}] stiffness: "${aT.slice(0, 500)}"`);
await advSet('kh', ''); await advSet('pf', '200'); await advSet('pd', '0.01');
aT = await advTxt();
if (!/Tip deflection \(tool and holder\) 0\.0086 mm/.test(aT) || !/from the push test\) 20\.0 N\/µm/.test(aT)) problems.push(`[${where}] push test: "${aT.slice(0, 600)}"`);
await page.click('#main .tpa button[title^="Reset"]');

// Chip breaker range in the turning advisor. Nose radius 0.4 mm suggests 0.167 mm/rev and the table depth is 1.0 mm; a range of
// 0.25 to 0.5 mm/rev and 1.5 to 4 mm holds the suggestions at 0.250 mm/rev and 1.500 mm (inside). A typed feed of 0.1 is below it.
where = 'advturn chip breaker';
await open('advturn');
await advSet('cbf0', '0.25'); await advSet('cbf1', '0.5'); await advSet('cba0', '1.5'); await advSet('cba1', '4');
aT = await advTxt();
if (!/held inside the chip breaker range\) 0\.250 mm\/rev/.test(aT) || !/Depth of cut \(suggested: held inside the chip breaker range\) 1\.500 mm/.test(aT) || !/this cut is inside it/.test(aT) || !/The nose radius rule gives 0\.167 mm\/rev/.test(aT)) problems.push(`[${where}] held: "${aT.slice(0, 700)}"`);
if (!(await page.$('#res .rwidget rect.cbwin'))) problems.push(`[${where}] no chart`);
await advSet('f', '0.1');
aT = await advTxt();
if (!/Feed per revolution \(yours, locked\) 0\.100 mm\/rev/.test(aT) || !/feed below the range/.test(aT) || !/Outside/i.test(aT) || !/Below the chip breaker range/.test(aT)) problems.push(`[${where}] below: "${aT.slice(0, 700)}"`);
await page.click('#main .tpa button[title^="Reset"]');

// Milling advisor, ball nose: 12 mm ball, depth locked at 2 mm: largest diameter in the cut 2 sqrt(2 x 10) = 8.944 mm, so the table speed
// of 60.96 m/min needs 60960 / (pi x 8.944) = 2169 rpm instead of 1617. The stick-out slider drives the stick-out box: 5 x D = 60 mm.
where = 'advmill ball nose';
await open('advmill');
await page.selectOption('#main [data-id="shape"]', '1');
await advSet('ap', '2');
aT = await advTxt();
if (!/Spindle speed 2,169 RPM/i.test(aT) || !/Ball nose: largest diameter in the cut at this depth 8\.944 mm/.test(aT) || !/Cutting speed at the largest diameter in the cut 61 m\/min/.test(aT)) problems.push(`[${where}] ball: "${aT.slice(0, 700)}"`);
for (const [, id] of await page.evaluate(() => { const t = TOOLS.find(x => x.id === 'advmill'); return t.sends({ mat: 3, tm: 1, op: 1, d: 12, z: 4, L: 40, lf: 26, shape: 1, ap: 2, sp: 50, ag: 50, hard: 50, cool: 1, src: 0, eta: 0.8 }, state.W, 'mm'); })) if (!(await page.evaluate(i => TOOLS.some(x => x.id === i), id))) problems.push(`[${where}] send button to a tool that does not exist: ${id}`);
await page.$eval('#main [data-id="ld"]', e => { e.value = '5'; e.dispatchEvent(new Event('input', { bubbles: true })); });
if ((await page.inputValue('#main [data-id="L"]')) !== '60') problems.push(`[${where}] the stick-out slider did not set the stick-out: ${await page.inputValue('#main [data-id="L"]')}`);
await page.click('#main .tpa button[title^="Reset"]');

// Milling advisor, chatter on the limit card and the wall finish. Default cut (12 mm, 4 flutes, low carbon steel): fz 0.0706 mm, so
// Ra = fz^2 / (32 r) = 0.0706^2 / (32 x 6) = 0.026 um, and with one tooth marking f = 0.2824: 0.42 um. At 1,617 RPM the best speeds are
// too close together, so the tile says the model cannot say. In aluminium the speed is high, deflection fits and the 12 mm depth is above
// the stability line: the card must name chatter and give the next best speed, which must be above the speed of the cut.
where = 'advmill chatter and finish';
await open('advmill');
aT = await advTxt();
if (!/Finish on the wall, theoretical Ra \(0\.42 if runout leaves one tooth marking\) 0\.026 um/.test(aT) || !/Chatter \(simple model\)\s+Cannot say/i.test(aT)) problems.push(`[${where}] steel: "${aT.slice(0, 900)}"`);
await page.selectOption('#main [data-id="mat"]', '15');
aT = await advTxt();
{ const mm = /at ([\d,]+) RPM the stability chart keeps the cut steady only up to ([\d.]+) mm deep, and this cut is 12\.000 mm deep[\s\S]*just above ([\d,]+) RPM/.exec(aT), num = x => Number(x.replace(/,/g, ''));
  if (!/Chatter \(simple model\)\s+Above the line/i.test(aT) || !/Chatter \(simple tool model\)/.test(aT) || !mm || !(num(mm[3]) > num(mm[1])) || !(Number(mm[2]) < 12)) problems.push(`[${where}] aluminium: "${aT.slice(0, 900)}"`);
  // a depth typed below the line: the card no longer names chatter
  if (mm) { await advSet('ap', String(Math.floor(Number(mm[2]) * 10) / 10)); aT = await advTxt(); if (!/Chatter \(simple model\)\s+Below the line/i.test(aT) || /Chatter \(simple tool model\)/.test(aT)) problems.push(`[${where}] below the line: "${aT.slice(0, 600)}"`); } }
await page.click('#main .tpa button[title^="Reset"]');

// Removal rate and power against the machine: 200 m/min, 2 mm, 0.2 mm/rev, kc 2000, efficiency 0.8: 80 cm3/min, 3.333 kW at the spindle.
// Machine 3.7 kW and 50 N m. At 50 mm: n = 200000 / (pi x 50) = 1273 RPM, 50 N m there is 6.67 kW, so 3.7 kW rules: 90 %.
// At 150 mm: 424 RPM, 50 x 2 pi x 424.4 / 60000 = 2.22 kW: 150 %, over the limit.
where = 'mrr machine';
const mrrMach = await page.evaluate(() => { const m = Profiles.upsert({ name: 'Smoke lathe', rpm_max: 4000, power_kw: 3.7, torque_nm: 50 }); Profiles.setActive(m.id); return m.id; });
await open('mrr');
await advSet('kc', '2000');
aT = await advTxt();
if (!/Rated spindle power of Smoke lathe[^\n]*\s+3\.70\s+kW/.test(aT) || !/Share of that power\s+90\s+%/.test(aT)) problems.push(`[${where}] rated: "${aT.slice(0, 600)}"`);
await advSet('dia', '50');
aT = await advTxt();
if (!/Spindle speed at that diameter\s+1,273\s+RPM/.test(aT) || !/Power Smoke lathe has at that speed\s+3\.70\s+kW/.test(aT) || !/Share of that power\s+90\s+%/.test(aT) || /Over the limit/.test(aT)) problems.push(`[${where}] 50 mm: "${aT.slice(0, 600)}"`);
await advSet('dia', '150');
aT = await advTxt();
if (!/Spindle speed at that diameter\s+424\s+RPM/.test(aT) || !/Power Smoke lathe has at that speed\s+2\.22\s+kW/.test(aT) || !/Share of that power\s+150\s+%/.test(aT) || !/Over the limit/.test(aT)) problems.push(`[${where}] 150 mm: "${aT.slice(0, 600)}"`);
await page.click('#main .tpa button[title^="Reset"]');
await page.evaluate(id => Profiles.remove(id), mrrMach);

// G-code editor and simulator (stage 2 acceptance: steps lathe and mill samples line by line).
// Mill example: 31 blocks, one per line; after line 10 (N70 G01 Z-3.) the tool is at X10 Y5 Z-3. Lathe example: told from the program
// (Auto: lathe), 30 blocks; after line 13 (N120 X24. Z-2.) the tool is at X24 Z-2. Renumbering from 100 by 5 makes the tenth numbered
// block (N100, the first profile block) N135 and the cycle that names it G71 P135 Q170 -> Q is the 15th numbered block: 100 + 14 x 5 = 170.
// N170 keeps its number, so 26 of the 27 numbered lines change. Inch conversion: X54. = 2.126 in, G96 S180 m/min = 591 ft/min, G21 -> G20. Undo brings the old text back.
where = 'gsim editor';
await units('mm');
await open('gsim');
{
  const q = sel => page.$eval(sel, e => e.textContent);
  const walk = async () => {
    await page.click('#gsfirst');
    const seen = [];
    for (let i = 0; i < 200; i++) {
      const m = /Block (\d+) of (\d+), line (\d+)/i.exec(await q('#gscur .h'));
      if (!m) break;
      seen.push([+m[1], +m[2], +m[3], await q('#gscur table')]);
      if (m[1] === m[2]) break;
      await page.click('#gsnext');
    }
    return seen;
  };
  await page.click('#gsexm'); await page.waitForTimeout(150);
  let w = await walk();
  if (w.length !== 31 || w.some((x, i) => x[0] !== i + 1 || x[2] !== i + 1)) problems.push(`[${where}] mill example did not step block by block: ${w.map(x => x[0] + ':' + x[2]).join(' ')}`);
  if (!/X10\.000 Y5\.000 Z-3\.000/.test((w[9] || [])[3] || '')) problems.push(`[${where}] mill block 10 position: "${((w[9] || [])[3] || '').slice(0, 200)}"`);
  if (!/Auto: mill/.test(await page.$eval('#gsmach', e => e.selectedOptions[0].textContent))) problems.push(`[${where}] the mill example was not told to be a mill program`);
  // the view cube and the 3D view
  await page.click('#gsview button[data-v="3d"]');
  if (!/3D view/.test(await q('#gsvlab')) || !(await page.$('#gscube'))) problems.push(`[${where}] no 3D view or view cube`);
  await page.click('#gscube', { position: { x: 48, y: 30 } }); // the top face of the cube in the 3D view
  if (!(await page.$eval('#gsview button[data-v="xy"]', e => e.classList.contains('on')))) problems.push(`[${where}] a click on the top face of the view cube did not give the top view`);
  await page.click('#gsexl'); await page.waitForTimeout(150);
  w = await walk();
  if (w.length !== 30 || w.some((x, i) => x[0] !== i + 1)) problems.push(`[${where}] lathe example did not step block by block: ${w.map(x => x[0] + ':' + x[2]).join(' ')}`);
  if (!/X24\.000 Z-2\.000/.test((w[12] || [])[3] || '')) problems.push(`[${where}] lathe block 13 position: "${((w[12] || [])[3] || '').slice(0, 200)}"`);
  if (!/Auto: lathe/.test(await page.$eval('#gsmach', e => e.selectedOptions[0].textContent)) || (await page.$('#gscube'))) problems.push(`[${where}] the lathe example was not told to be a lathe program`);
  const text = () => page.inputValue('#gstext');
  const before = await text();
  await page.click('#gstidyb');
  await page.selectOption('#gtnum', '1'); await page.fill('#gtstart', '100'); await page.fill('#gtstep', '5');
  await page.click('#gtgo'); await page.waitForTimeout(100);
  let t = await text();
  if (!/^N130 G71 P135 Q170 U0\.4 W0\.1 F0\.25$/m.test(t) || !/^N135 G00 X20\.$/m.test(t) || !/^N175 G70 P135 Q170$/m.test(t) || !/Tidy: 26 lines changed/i.test(await q('#gsrep'))) problems.push(`[${where}] renumber: "${t.slice(0, 500)}" / "${(await q('#gsrep')).slice(0, 200)}"`);
  await page.click('#gsundo'); await page.waitForTimeout(100);
  if ((await text()) !== before) problems.push(`[${where}] undo did not bring the program back`);
  await page.click('#gsredo'); await page.waitForTimeout(100);
  if ((await text()) !== t) problems.push(`[${where}] redo did not bring the renumbered program back`);
  await page.click('#gsundo'); await page.waitForTimeout(100);
  // insert a line after line 5, then delete it again
  await page.click('#gslist .gl[data-l="5"]');
  await page.click('#gsins'); await page.waitForTimeout(100);
  t = await text();
  if (t.split('\n').length !== before.split('\n').length + 1 || t.split('\n')[5] !== '' || !/Current line: 6/.test(await q('#gsline'))) problems.push(`[${where}] insert line: line 6 is "${t.split('\n')[5]}", ${await q('#gsline')}`);
  await page.click('#gsdel'); await page.waitForTimeout(100);
  if ((await text()) !== before) problems.push(`[${where}] delete line did not remove the inserted line`);
  // inch conversion
  await page.click('#gsconvb');
  if ((await page.inputValue('#gcto')) !== '0') problems.push(`[${where}] a G21 program should be offered a conversion to inch`);
  await page.click('#gcgo'); await page.waitForTimeout(100);
  t = await text();
  if (!/^N10 G20 G40 G99$/m.test(t) || !/^N40 G96 S591 M03$/m.test(t) || !/^N50 G00 X2\.126 Z0\.0787 M08$/m.test(t) || !/^N70 G71 P100 Q170 /m.test(t) || !/Converted to inch: 21 lines changed/i.test(await q('#gsrep')) || !/Lathe cycle/.test(await q('#gsrep'))) problems.push(`[${where}] inch conversion: "${t.slice(0, 500)}" / "${(await q('#gsrep')).slice(0, 300)}"`);
  if (!/0 errors/.test(await q('#gsmsgs .h'))) problems.push(`[${where}] the converted program has errors in the simulator: ${await q('#gsmsgs .h')}`);
  await page.click('#gsundo'); await page.waitForTimeout(100);
  if ((await text()) !== before) problems.push(`[${where}] undo after the conversion`);
  await page.click('#gsexm'); await page.waitForTimeout(100);
}

// 2D sketcher. Typed points: a plate 80 x 50 with two holes of 12 at (20, 25) and (60, 25), a diagonal. With the mouse: a line
// from centre to centre (snap to centre) is 40 long at 0 degrees; the two holes selected together are 40 apart; a line from
// (100, 25) tangent to the second hole (d = 40, r = 6) is sqrt(40^2 - 6^2) = 39.547 long. Measure (0,0) to (30,40): 50 at 53.130
// degrees (picked at x = 90, where it is at y = 25 + 10 x 5.93 / 39.1 = 26.52, clear of the plate). The saved DXF is read back by the sketcher itself; in inches the plate is 80 / 25.4 = 3.1496 wide.
where = 'sketch';
await units('mm');
await open('sketch', 120);
{
  const q = sel => page.$eval(sel, e => e.innerText);
  const tool = t => page.click(`#sktool button[data-v="${t}"]`);
  const type = async (...vals) => { for (const v of vals) { await page.fill('#skin', v); await page.press('#skin', 'Enter'); } };
  const at = async (x, y) => { const b = await page.$eval('#skcv', e => { e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return [r.left, r.top]; }); const p = await page.evaluate(([x, y]) => SK.px([x, y]), [x, y]); return [b[0] + p[0], b[1] + p[1]]; };
  const move = async (x, y) => { const p = await at(x, y); await page.mouse.move(p[0], p[1]); };
  const click = async (x, y, shift) => { const p = await at(x, y); await page.mouse.move(p[0], p[1]); if (shift) await page.keyboard.down('Shift'); await page.mouse.click(p[0], p[1]); if (shift) await page.keyboard.up('Shift'); };
  const count = () => page.evaluate(() => state.W.sk_count());
  if (await count()) problems.push(`[${where}] a new profile should start with an empty sketch`);
  await tool('rect'); await type('0,0', '@80,50');
  await tool('circle'); await type('20,25', 'd12', '60,25', 'r6');
  await tool('line'); await type('0,0', '@80,50'); await page.press('#skin', 'Escape');
  let sum = await q('#sksum');
  if ((await count()) !== 4 || !/Width \(X\)\s+80\.000\s+mm/.test(sum) || !/Height \(Y\)\s+50\.000\s+mm/.test(sum)) problems.push(`[${where}] typed plate: ${await count()} entities, "${sum.replace(/\s+/g, ' ').slice(0, 200)}"`);
  await page.click('#skfit');
  // centre to centre with the mouse: the pointer is a little off both centres, the snap puts it on them
  await tool('line');
  await move(20.4, 25.3);
  if (!/X 20\.000\s+Y 25\.000 mm/.test(await q('#skstat'))) problems.push(`[${where}] no snap to the centre of the first hole: "${await q('#skstat')}"`);
  await click(20.4, 25.3); await click(59.7, 24.8);
  await page.keyboard.press('Escape');
  if ((await count()) !== 5) problems.push(`[${where}] the line drawn with the mouse was not added (${await count()} entities)`);
  await tool('select');
  await click(30, 25.2);
  let info = await q('#skinfo');
  if (!/Selected: Line/i.test(info) || !/Length\s+40\.000\s+mm/.test(info) || !/Direction\s+0\.000\s+deg/.test(info)) problems.push(`[${where}] centre to centre line: "${info.replace(/\s+/g, ' ').slice(0, 300)}"`);
  await click(20, 31); await click(60, 31, true);
  info = await q('#skinfo');
  if (!/Two centres/i.test(info) || !/Centre distance\s+40\.000\s+mm/.test(info)) problems.push(`[${where}] two holes selected: "${info.replace(/\s+/g, ' ').slice(0, 300)}"`);
  // tangent from (100, 25) to the second hole
  await tool('line'); await type('100,25');
  await move(60.9, 30.93);
  await click(60.9, 30.93);
  await page.keyboard.press('Escape');
  await tool('select'); await click(90, 26.52);
  info = await q('#skinfo');
  if (!/Length\s+39\.547\s+mm/.test(info)) problems.push(`[${where}] tangent line should be 39.547 long: "${info.replace(/\s+/g, ' ').slice(0, 300)}"`);
  // measure, undo, redo, delete
  await tool('measure'); await type('0,0', '30,40');
  const meas = await q('#skmeas');
  if (!/Distance\s+50\.000\s+mm/.test(meas) || !/53\.130\s+deg/.test(meas)) problems.push(`[${where}] measure: "${meas.replace(/\s+/g, ' ').slice(0, 300)}"`);
  await page.click('#skundo');
  if ((await count()) !== 5) problems.push(`[${where}] undo should remove the tangent line (${await count()} entities)`);
  await page.click('#skredo');
  if ((await count()) !== 6) problems.push(`[${where}] redo should bring the tangent line back (${await count()} entities)`);
  await tool('select'); await click(90, 26.52); await page.click('#skdel');
  if ((await count()) !== 5) problems.push(`[${where}] delete should remove the selected line (${await count()} entities)`);
  // text on its own layer
  await page.fill('#sklnew', 'NOTES'); await page.click('#skladd'); await page.selectOption('#sklcol', '3');
  await tool('text'); await page.fill('#sktext', 'PLATE Ø12'); await type('5,-8');
  if ((await count()) !== 6 || !/NOTES/.test(await q('#sksum'))) problems.push(`[${where}] text on the layer NOTES was not added`);
  // save as DXF (R2000, R12, lines and arcs) and open the R12 file again
  await page.evaluate(() => { window.__saved = []; window.BenchMateSave = (name, data) => window.__saved.push([name, data]); });
  await page.click('#sksave');
  await page.selectOption('#skver', '12'); await page.click('#sksave');
  await page.check('#skexpl'); await page.click('#sksave');
  const saved = await page.evaluate(() => window.__saved);
  if (saved.length !== 3 || !/\.dxf$/.test(saved[0][0])) problems.push(`[${where}] save DXF gave ${saved.length} files`);
  else {
    if (!/AC1015/.test(saved[0][1]) || !/\$INSUNITS\r\n\s*70\r\n\s*4\r\n/.test(saved[0][1]) || !/LWPOLYLINE/.test(saved[0][1]) || !/\r\nTEXT\r\n/.test(saved[0][1]) || !/PLATE %%c12/.test(saved[0][1])) problems.push(`[${where}] the R2000 file misses its version, units, polyline or text`);
    if (!/AC1009/.test(saved[1][1]) || /LWPOLYLINE/.test(saved[1][1]) || !/\r\nPOLYLINE\r\n/.test(saved[1][1])) problems.push(`[${where}] the R12 file should use POLYLINE`);
    if (/POLYLINE/.test(saved[2][1]) || (saved[2][1].match(/\r\nLINE\r\n/g) || []).length !== 6) problems.push(`[${where}] the lines-and-arcs file should have 6 lines and no polyline`);
    await page.click('#skclr');
    await page.setInputFiles('#skfile', { name: 'plate-r12.dxf', mimeType: 'application/dxf', buffer: Buffer.from(saved[1][1]) });
    await page.waitForTimeout(200);
    const rep = await q('#skrep');
    sum = await q('#sksum');
    if ((await count()) !== 6 || !/Read 6 entities on 2 layers, taken as millimetres/.test(rep) || !/does not say/.test(rep) || !/Width \(X\)\s+80\.000\s+mm/.test(sum)) problems.push(`[${where}] reading the saved R12 file back: ${await count()} entities, "${rep.replace(/\s+/g, ' ').slice(0, 300)}"`);
    await page.setInputFiles('#skfile', { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('this is not a drawing\n') });
    await page.waitForTimeout(200);
    if (!/notes\.txt/.test(await q('#skerr')) || (await count()) !== 6) problems.push(`[${where}] a file that is not a DXF should be refused and the sketch kept: "${await q('#skerr')}"`);
  }
  await page.evaluate(() => { delete window.BenchMateSave; });
  // inches: the plate keeps its real size
  await page.selectOption('#skunits', '1');
  sum = await q('#sksum');
  if (!/Width \(X\)\s+3\.1496\s+in/.test(sum)) problems.push(`[${where}] in inches the plate should be 3.1496 wide: "${sum.replace(/\s+/g, ' ').slice(0, 200)}"`);
  await page.click('#skundo');
  if (!/Width \(X\)\s+80\.000\s+mm/.test(await q('#sksum'))) problems.push(`[${where}] undo should bring the millimetres back`);
  // a generator shape opened in the sketcher: the straight slot 40 between centres, 12 wide, with its centre marks
  await open('dxfslot', 80);
  await page.click('#cadsk'); await page.waitForTimeout(200);
  sum = await q('#sksum');
  if (!/2D sketcher/i.test(await page.textContent('#main')) || !/OUTLINE/.test(sum) || !/CENTRE/.test(sum) || (await count()) < 3) problems.push(`[${where}] Open in the sketcher from the slot page: "${sum.replace(/\s+/g, ' ').slice(0, 300)}"`);
  await page.click('#skclr');
}

// Insert designation: the keys build the code, the drawing is the core's outline to scale, and the
// buttons hand the nose radius to the advisor and the outline to the sketcher.
where = 'insertcode';
{
  await units('mm');
  await open('insertcode', 80);
  await page.waitForSelector('#ires table');
  const q = sel => page.$eval(sel, e => e.textContent);
  const on = i => page.$eval(`#b${i} button.on`, b => b.dataset.v).catch(() => '');
  await page.fill('#ic', 'CNMG120408');
  let dims = await q('#idims'), top = await q('#itop');
  for (const want of ['12.896', '11.271', '0.953', '0.445', '9.434', '3.084', '18.869 x 16.090', 'Fixing hole d15.160']) if (!dims.includes(want)) problems.push(`[${where}] CNMG 12 04 08 should show ${want}: "${dims.slice(0, 300)}"`);
  if (!top.includes('l 12.896') || !top.includes('80°, r 0.800') || !top.includes('d 12.700')) problems.push(`[${where}] the top view should be labelled with l, the corner and d: "${top}"`);
  const arcs = await page.$eval('#iout', e => (e.getAttribute('d').match(/A/g) || []).length);
  if (arcs !== 4) problems.push(`[${where}] a rhombic insert with a corner radius has 4 arcs, drawn ${arcs}`);
  if ((await on(1)) !== 'C' || (await on(2)) !== 'N' || (await on(5)) !== '12.7' || (await on(7)) !== '08') problems.push(`[${where}] the keys should show the typed code: ${await on(1)} ${await on(2)} ${await on(5)} ${await on(7)}`);
  // the hole of a CNMG is drawn to its ISO 3364 size: 5.16 across against 12.7 for the dashed circle
  const holeRatio = await page.$eval('#itop', e => e.querySelector('#ihole').r.baseVal.value / e.querySelector('circle[stroke-dasharray="4 3"]').r.baseVal.value);
  if (Math.abs(holeRatio - 5.16 / 12.7) > 0.005 || (await page.$('#ihole[stroke-dasharray]'))) problems.push(`[${where}] the fixing hole of a CNMG should be drawn to size, solid: ratio ${holeRatio}`);
  // the picture has the proportions the core gives: width over height of the outline
  const box = await page.$eval('#iout', e => { const b = e.getBBox(); return b.width / b.height; });
  if (Math.abs(box - 18.869 / 16.090) > 0.01) problems.push(`[${where}] the outline is not drawn to scale: width / height ${box}`);
  // tap a code together: T C (M) T, inscribed circle 9.525, thickness T3, corner 04
  for (const [i, v] of [[1, 'T'], [2, 'C'], [4, 'T'], [5, '9.525'], [6, 'T3'], [7, '04']]) await page.click(`#b${i} button[data-v="${v}"]`);
  dims = await q('#idims');
  const side = await q('#iside');
  if ((await page.inputValue('#ic')) !== 'TCMT16T304' || !dims.includes('16.498') || !dims.includes('8.550') || !side.includes('flanks 7°') || !(await page.$('#ihole[stroke-dasharray]')) || dims.includes('Fixing hole')) problems.push(`[${where}] the keys should build TCMT16T304 with edge 16.498 and bottom face 8.550: "${await page.inputValue('#ic')}" "${dims.slice(0, 200)}" "${side}"`);
  // a round insert, a shape the circle does not fix, and a radius that does not fit
  await page.fill('#ic', 'RCMT10T3M0');
  if (!(await q('#itop')).includes('Ø 9.525') || (await page.$('#iadv:not([disabled])'))) problems.push(`[${where}] a round insert is drawn as its circle and has no nose radius to send`);
  await page.fill('#ic', 'KNUX160405');
  if ((await page.$('#itop')) || !/schematic/.test(await q('#ires'))) problems.push(`[${where}] shape K should stay a sketch without dimensions`);
  await page.fill('#ic', 'CNMG040224');
  if ((await page.$('#itop')) || !/must be smaller than half the inscribed circle/.test(await q('#ires'))) problems.push(`[${where}] a 2.4 radius on a 3.97 circle should be refused with the reason: "${(await q('#ires')).slice(0, 200)}"`);
  // the outline in the sketcher: one closed polyline and the inscribed circle
  await page.fill('#ic', 'DCMT11T304');
  await page.click('#isk'); await page.waitForTimeout(200);
  const sum = await page.$eval('#sksum', e => e.innerText);
  if (!/2D sketcher/i.test(await page.textContent('#main')) || !/INSERT/.test(sum) || !/INSCRIBED/.test(sum) || (await page.evaluate(() => state.W.sk_count())) !== 2) problems.push(`[${where}] Open in the sketcher: "${sum.replace(/\s+/g, ' ').slice(0, 300)}"`);
  await page.click('#skclr');
  // the nose radius in the advisor and the finish calculator, in the units in use
  await open('insertcode', 80);
  await page.waitForSelector('#ires table');
  await page.fill('#ic', 'CNMG120408');
  await page.click('#iadv'); await page.waitForTimeout(80);
  if (!/Turning advisor/i.test(await page.textContent('#main')) || (await page.inputValue('#main [data-id="re"]')) !== '0.8') problems.push(`[${where}] the advisor should open with nose radius 0.8: ${await page.inputValue('#main [data-id="re"]').catch(() => 'no field')}`);
  await units('inch');
  await open('insertcode', 80);
  await page.waitForSelector('#ires table');
  if (!(await q('#itop')).includes('r 0.0315')) problems.push(`[${where}] in inches the corner label should read r 0.0315: "${await q('#itop')}"`);
  await page.click('#ifin'); await page.waitForTimeout(80);
  if ((await page.inputValue('#main [data-id="r"]')) !== '0.0314961') problems.push(`[${where}] the finish calculator should open with radius 0.0314961 in: ${await page.inputValue('#main [data-id="r"]').catch(() => 'no field')}`);
  await units('mm');
}

// Involute splines: the enlarged tooth space is the core's profile, and what is drawn agrees with the numbers
// in the result table: pin size against the pitch circle, the pin touching both flanks, the tooth thickness
// on the pitch circle, and a pin that cannot measure is said so.
where = 'spline';
{
  await units('inch');
  await page.evaluate(() => setMode('expert'));
  await open('spline', 80);
  const row = async label => page.$$eval('#res tr', (trs, l) => { const t = trs.find(x => x.textContent.includes(l)); return t ? t.innerText.replace(/\s+/g, ' ') : ''; }, label);
  const geo = id => page.evaluate(id => {
    const c = s => { const e = document.querySelector('#' + id + s); return e ? { x: +e.getAttribute('cx'), y: +e.getAttribute('cy'), r: +e.getAttribute('r') } : null; };
    const pitch = c('d'), pin = c('pin'), k = c('k'), path = document.querySelector('#' + id + 'p');
    if (!pitch || !path) return null;
    const pts = path.getAttribute('d').slice(1, -1).split('L').map(p => p.split(' ').map(Number));
    // profile points on the pitch circle, nearest the middle of the picture: the two flanks of the space the pin sits in
    const on = pts.filter(p => Math.abs(Math.hypot(p[0] - pitch.x, p[1] - pitch.y) - pitch.r) < 0.03).sort((a, b) => Math.abs(a[0] - pitch.x) - Math.abs(b[0] - pitch.x)).slice(0, 2);
    const space = on.length === 2 ? 2 * Math.asin(Math.hypot(on[0][0] - on[1][0], on[0][1] - on[1][1]) / 2 / pitch.r) : NaN;
    return { pinOverPitch: pin ? pin.r / pitch.r : NaN, touch: pin && k ? Math.hypot(k.x - pin.x, k.y - pin.y) / pin.r : NaN, space, kr: k ? Math.hypot(k.x - pitch.x, k.y - pitch.y) / pitch.r : NaN };
  }, id);
  // defaults: ANSI 8/16, 24 teeth, ideal pins 0.23598 and 0.21877, which touch on the pitch circle
  let e = await geo('spe'), i = await geo('spi');
  if (!e || !i) problems.push(`[${where}] the enlarged tooth spaces are not drawn`);
  else {
    if (Math.abs(e.pinOverPitch - 0.23598 / 3) > 2e-4 || Math.abs(i.pinOverPitch - 0.21877 / 3) > 2e-4) problems.push(`[${where}] pins are not drawn to scale against the pitch circle: ${e.pinOverPitch} ${i.pinOverPitch}`);
    if (Math.abs(e.touch - 1) > 2e-3 || Math.abs(i.touch - 1) > 2e-3) problems.push(`[${where}] the contact points are not on the pins: ${e.touch} ${i.touch}`);
    if (Math.abs(e.kr - 1) > 2e-4 || Math.abs(i.kr - 1) > 2e-4) problems.push(`[${where}] ideal pins should touch on the pitch circle: ${e.kr} ${i.kr}`);
    // basic thickness: tooth and space each take half the pitch, so the space spans pi / z
    if (Math.abs(e.space - Math.PI / 24) > 2e-4 || Math.abs(i.space - Math.PI / 24) > 2e-4) problems.push(`[${where}] the space drawn on the pitch circle is not half the pitch: ${e.space} ${i.space}`);
  }
  if (!/3\.00000 in/.test(await row('Pins touch the flanks on diameter, external')) || !/3\.00000 in/.test(await row('Pins touch the flanks on diameter, internal'))) problems.push(`[${where}] the contact diameter of the ideal pins should be the pitch diameter: "${await row('Pins touch the flanks on diameter, external')}"`);
  // a thinner tooth (0.18) and a wider space (0.21): the drawing follows the typed sizes
  await page.fill('#main [data-id="st"]', '0.18'); await page.fill('#main [data-id="et"]', '0.21'); await page.waitForTimeout(80);
  e = await geo('spe'); i = await geo('spi');
  const p = Math.PI / 8;
  if (!e || !i || Math.abs(e.space - (p - 0.18) / 1.5) > 2e-4 || Math.abs(i.space - 0.21 / 1.5) > 2e-4) problems.push(`[${where}] typed thickness 0.18 and space 0.21 should be what is drawn: ${e && e.space * 1.5} ${i && i.space * 1.5}`);
  if (e && (Math.abs(e.touch - 1) > 2e-3 || Math.abs(i.touch - 1) > 2e-3)) problems.push(`[${where}] with typed sizes the pins should still touch the flanks: ${e.touch} ${i.touch}`);
  // pins that cannot measure
  await page.fill('#main [data-id="st"]', ''); await page.fill('#main [data-id="et"]', '');
  await page.fill('#main [data-id="dpe"]', '0.4'); await page.fill('#main [data-id="dpi"]', '0.12'); await page.waitForTimeout(80);
  const svg = await page.$eval('#main svg.dk', s => s.textContent);
  if (!/does not touch the involute flanks/.test(await row('Check the external pin')) || !/sits on the root/.test(await row('Check the internal pin')) || !/does not touch the involute flanks/.test(svg) || !/sits on the root/.test(svg) || (await row('Pins touch the flanks on diameter, external'))) problems.push(`[${where}] a 0.4 pin outside and a 0.12 pin inside should both be refused in the table and the drawing`);
  await page.fill('#main [data-id="dpe"]', ''); await page.fill('#main [data-id="dpi"]', '');
  await page.evaluate(() => setMode('advanced'));
  await units('mm');
}

// Feature control frame builder: the frame is read out in plain words, with the sizes worked by the core,
// and hands its values on to the bonus, true position and unequal profile calculators.
where = 'gdtfcf';
{
  await units('mm');
  await mode('advanced');
  await open('gdtfcf', 80);
  const set = async (k, v) => { await page.evaluate(([k, v]) => { const i = document.querySelector('#main [data-k="' + k + '"]'); if (i.type === 'checkbox') i.checked = v; else i.value = v; i.dispatchEvent(new Event(i.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); }, [k, v]); await page.waitForTimeout(40); };
  const txt = sel => page.$eval('#main ' + sel, e => e.innerText.replace(/\s+/g, ' ')).catch(() => '');
  // default frame: position, diameter 0.25 at MMC, to A, B, C
  if ((await txt('#fcfsay')) !== '“Position, within a diameter of 0.25, at maximum material condition, to datum A, datum B and datum C.”') problems.push(`[${where}] spoken frame is wrong: ${await txt('#fcfsay')}`);
  if (!/axis .* must lie within a cylindrical zone 0\.25 in diameter, centred on the true position/.test(await txt('#fcfmain'))) problems.push(`[${where}] the demand sentence is wrong: ${await txt('#fcfmain')}`);
  const boxes = await page.$$eval('#main #fcfboxes tr', trs => trs.length - 1);
  if (boxes !== 6) problems.push(`[${where}] expected 6 boxes read out (symbol, value, M, A, B, C), got ${boxes}`);
  if (!/primary/.test(await txt('#fcfboxes')) || !/tertiary/.test(await txt('#fcfboxes')) || !/bonus tolerance/.test(await txt('#fcfboxes'))) problems.push(`[${where}] box meanings are missing`);
  if (await page.$('#main #fcfsizes')) problems.push(`[${where}] the size table should wait for the size limits`);
  if (!(await page.$('#main #fcfexp .gzone svg'))) problems.push(`[${where}] the zone sketch is missing`);
  // hole 10.0 to 10.2: MMC 10.00 with 0.25, LMC 10.20 with bonus 0.20 and 0.45; virtual condition 9.75
  await set('lo', '10.0'); await set('hi', '10.2');
  const sz = await txt('#fcfsizes'), gsz = await txt('#fcfexp .gsz');
  if (!/At maximum material 10\.00 0\.00 0\.25 At least material 10\.20 0\.20 0\.45/.test(sz)) problems.push(`[${where}] hole size table is wrong: ${sz}`);
  if (!/Virtual condition 9\.75/.test(gsz) || !/gauge pin/.test(gsz)) problems.push(`[${where}] hole virtual condition should be 9.75 with a gauge pin: ${gsz}`);
  // the same limits as a pin: MMC is the largest size, virtual condition 10.45
  await set('int', '0');
  const szp = await txt('#fcfsizes'), gszp = await txt('#fcfexp .gsz');
  if (!/At maximum material 10\.20 0\.00 0\.25 At least material 10\.00 0\.20 0\.45/.test(szp) || !/Virtual condition 10\.45/.test(gszp)) problems.push(`[${where}] pin sizes are wrong: ${szp} ${gszp}`);
  // LMC on the hole: the tolerance holds at 10.20 and grows towards 10.00; boundary 10.45
  await set('int', '1'); await set('mc', 'L');
  const szl = await txt('#fcfsizes'), gszl = await txt('#fcfexp .gsz');
  if (!/At least material 10\.20 0\.00 0\.25 At maximum material 10\.00 0\.20 0\.45/.test(szl) || !/Virtual condition 10\.45/.test(gszl)) problems.push(`[${where}] LMC sizes are wrong: ${szl} ${gszl}`);
  if (!/at least material condition/.test(await txt('#fcfsay'))) problems.push(`[${where}] LMC is not said aloud`);
  // no modifier: no bonus, said so
  await set('mc', '');
  if (await page.$('#main #fcfsizes')) problems.push(`[${where}] no size table without a material condition`);
  if (!/tolerance stays 0\.25 at every size/.test(await txt('#fcfexp .gsz')) || !/with no bonus/.test(await txt('#fcfboxes'))) problems.push(`[${where}] RFS should say there is no bonus`);
  // hand over to the bonus calculator and the true position check
  await set('mc', 'M');
  await page.click('#main #fcfbonus'); await page.waitForTimeout(80);
  const bv = await page.evaluate(() => ({ h: location.hash, lo: document.querySelector('#main [data-id="lo"]').value, hi: document.querySelector('#main [data-id="hi"]').value, tol: document.querySelector('#main [data-id="tol"]').value, mc: document.querySelector('#main [data-id="mc"]').value, int: document.querySelector('#main [data-id="int"]').value }));
  if (!/gdtbonus/.test(bv.h) || +bv.lo !== 10 || +bv.hi !== 10.2 || +bv.tol !== 0.25 || bv.mc !== '1' || bv.int !== '1') problems.push(`[${where}] bonus calculator did not get the frame values: ${JSON.stringify(bv)}`);
  await open('gdtfcf', 80);
  await page.click('#main #fcftp'); await page.waitForTimeout(80);
  const tv = await page.evaluate(() => ({ h: location.hash, tol: document.querySelector('#main [data-id="tol"]').value, mc: document.querySelector('#main [data-id="mc"]').value }));
  if (!/gdttp/.test(tv.h) || +tv.tol !== 0.25 || tv.mc !== '1') problems.push(`[${where}] true position check did not get the frame values: ${JSON.stringify(tv)}`);
  // profile of a surface with U: said aloud, read box by box, linked to the unequal zone calculator (expert tool)
  await mode('expert');
  await open('gdtfcf', 80);
  await set('ch', 'profile_surface'); await set('val', '0.4'); await set('u', true); await set('uv', '0.1');
  if (!/Profile of a surface, within 0\.4, unequally disposed, 0\.1 of it outside the material, to datum A/.test(await txt('#fcfsay'))) problems.push(`[${where}] unequal profile is not said aloud: ${await txt('#fcfsay')}`);
  if (!/of the total 0\.4, 0\.1 lies outside the material/.test(await txt('#fcfboxes')) || !(await page.$('#main #fcfunote'))) problems.push(`[${where}] unequal profile box or sketch note is missing`);
  if (await page.$('#main #fcfbonus')) problems.push(`[${where}] a surface profile has no bonus to link to`);
  await page.click('#main #fcfu'); await page.waitForTimeout(80);
  const uv = await page.evaluate(() => ({ h: location.hash, t: document.querySelector('#main [data-id="t"]').value, u: document.querySelector('#main [data-id="u"]').value }));
  if (!/gdtprofu/.test(uv.h) || +uv.t !== 0.4 || +uv.u !== 0.1) problems.push(`[${where}] unequal profile calculator did not get the frame values: ${JSON.stringify(uv)}`);
  // an invalid frame (flatness with a datum) is still read out, under a warning
  await open('gdtfcf', 80);
  await set('u', false); await set('ch', 'flatness');
  await page.evaluate(() => { const d = document.querySelector('#main [data-dl="0"]'); d.value = 'A'; d.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForTimeout(40);
  if (!/Fix the invalid items first/.test(await txt('#fcfexp')) || !/Flatness, within 0\.4, to datum A\./.test(await txt('#fcfsay'))) problems.push(`[${where}] an invalid frame should be read as it stands, under a warning: ${await txt('#fcfsay')}`);
  // total runout: the value is an indicator movement, not a diameter
  await set('ch', 'total_runout');
  if (!/full indicator movement of 0\.4 over the whole surface/.test(await txt('#fcfmain')) || !/Not a diameter/.test(await txt('#fcfboxes'))) problems.push(`[${where}] runout read-out is wrong: ${await txt('#fcfmain')}`);
  // leave the builder as it started
  await set('ch', 'position'); await set('zone', 'dia'); await set('fos', '1'); await set('val', '0.25'); await set('mc', 'M'); await set('lo', ''); await set('hi', '');
  await page.evaluate(() => { ['A', 'B', 'C'].forEach((l, i) => { const d = document.querySelector('#main [data-dl="' + i + '"]'); d.value = l; d.dispatchEvent(new Event('change', { bubbles: true })); }); });
  await mode('advanced');
}

// Text engraving: the font file loads, the text is laid out to the size typed, the drawing shows the strokes
// to scale, the program holds them, and the strokes go on to the simulator and the sketcher.
where = 'engrave';
{
  await units('mm');
  await mode('advanced');
  await open('engrave', 80);
  await page.waitForSelector('#main #engres', { timeout: 5000 }).catch(() => problems.push(`[${where}] the letters did not load`));
  const set = async (k, v) => { await page.evaluate(([k, v]) => { const i = document.querySelector('#main [data-k="' + k + '"]'); i.value = v; i.dispatchEvent(new Event(i.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); }, [k, v]); await page.waitForTimeout(60); };
  const row = async label => page.$$eval('#main #engres tr', (trs, l) => { const t = trs.find(x => x.textContent.includes(l)); return t ? t.innerText.replace(/\s+/g, ' ') : ''; }, label);
  const prog = () => page.$eval('#main #cytext', e => e.textContent).catch(() => '');
  // one capital H, 7 mm high, in the single line font: 14/21 of the height wide (the font writes 442/662), two posts and a bar
  await set('text', 'H'); await set('h', '7');
  if (!/4\.674 x 7\.000 mm/.test(await row('Overall size'))) problems.push(`[${where}] an H 7 high should be 4.674 wide: ${await row('Overall size')}`);
  if (!/ 3\s*$/.test(await row('Strokes')) || !/18\.674 mm/.test(await row('Length engraved'))) problems.push(`[${where}] an H is 3 strokes, 7 + 7 + 4.674 long: ${await row('Strokes')} / ${await row('Length engraved')}`);
  // the drawing is to scale: the two posts are as far apart on the page as the width times the scale
  const geo = await page.evaluate(() => { const svg = document.querySelector('#main #engsvg'), k = +svg.dataset.k; const xs = [...svg.querySelectorAll('path.engs')].flatMap(p => p.getAttribute('d').slice(1).split('L').map(q => +q.split(' ')[0])); return { k, w: Math.max(...xs) - Math.min(...xs), n: svg.querySelectorAll('path.engs').length }; });
  if (geo.n !== 3 || Math.abs(geo.w - 4.674 * geo.k) > 0.2) problems.push(`[${where}] drawing is not to scale: ${JSON.stringify(geo)}`);
  // the program: plunge, cut, lift for each stroke; Z0 on the surface
  let t = await prog();
  if ((t.match(/^G01 Z-0\.1 F100\.0$/gm) || []).length !== 3 || (t.match(/^G00 Z2\.0$/gm) || []).length !== 3) problems.push(`[${where}] program should plunge and lift three times`);
  if (!/^X0\.0 Y0\.0 F300\.0$/m.test(t) || !/\(TEXT: H\)/.test(t) || !/\(Z0 = THE SURFACE BEING ENGRAVED\)/.test(t) || !/^G21 G17 G40 G49 G80 G90$/m.test(t)) problems.push(`[${where}] program text is wrong:\n${t.slice(0, 600)}`);
  // position and angle: at X10 Y20 turned 90 degrees the H runs up from (10, 20) and its top is at X3
  await set('x', '10'); await set('y', '20'); await set('angle', '90');
  if (!/3\.000, 20\.000 mm/.test(await row('Lower left')) || !/10\.000, 24\.674 mm/.test(await row('Upper right'))) problems.push(`[${where}] turned text is in the wrong place: ${await row('Lower left')} / ${await row('Upper right')}`);
  // round a circle, tops outward, middle of the text at the top: a lone H is centred on X of the centre; its posts sit half its width
  // along the circle each side, so their feet are at R cos(w / 2R) above the centre and their tops at (R + height) cos(w / 2R)
  await set('lay', '1'); await set('align', '1'); await set('radius', '50');
  const ur = await row('Upper right'), ll = await row('Lower left');
  const nums = x => (x.match(/-?\d+\.\d+/g) || []).map(Number);
  if (Math.abs(nums(ll)[0] + nums(ur)[0] - 20) > 0.002 || Math.abs(nums(ur)[1] - (20 + 57 * Math.cos(4.674 / 2 / 50))) > 0.002 || Math.abs(nums(ll)[1] - (20 + 50 * Math.cos(4.674 / 2 / 50))) > 0.002 || !(await page.$('#main #engcirc'))) problems.push(`[${where}] text round a circle is wrong: ${ll} / ${ur}`);
  // a letter the font does not have is named and left out; a pointed cutter gives the line width
  await set('lay', '0'); await set('angle', '0'); await set('text', 'H中'); await set('vang', '90'); await set('depth', '0.2');
  if (!/中/.test(await row('Left out')) || !/0\.400 mm/.test(await row('Line width'))) problems.push(`[${where}] missing letter or line width row is wrong: ${await row('Left out')} / ${await row('Line width')}`);
  // every letter style loads and draws
  for (const f of ['HersheySansMed', 'HersheySerifMed', 'HersheySerifMedItalic', 'HersheySerifBold', 'HersheySerifBoldItalic', 'HersheyScript1', 'HersheyScriptMed', 'HersheyGothEnglish']) {
    await set('font', f);
    await page.waitForFunction(() => document.querySelector('#main #engres'), null, { timeout: 5000 }).catch(() => {});
    if (!/x 7\.\d{3} mm/.test(await row('Overall size'))) problems.push(`[${where}] ${f} did not draw an H 7 high: ${await row('Overall size')}`);
  }
  await set('font', 'HersheySans1'); await page.waitForTimeout(100);
  // no depth: the drawing stays, the program is refused with the reason
  await set('depth', '');
  if (!(await page.$('#main #engsvg')) || !/Enter the depth/.test(await page.$eval('#main #cyout', e => e.innerText))) problems.push(`[${where}] a missing depth should keep the drawing and refuse the program`);
  await set('depth', '0.1'); await set('text', 'H');
  // on to the simulator: it runs the same program without errors; and to the sketcher: three lines arrive
  t = await prog();
  await page.click('#main #engsim'); await page.waitForTimeout(200);
  const sim = await page.evaluate(() => ({ h: location.hash, same: (document.querySelector('#main textarea') || {}).value }));
  if (!/gsim/.test(sim.h) || sim.same !== t) problems.push(`[${where}] the simulator did not get the program`);
  await open('engrave', 120);
  await page.click('#main #engsk'); await page.waitForTimeout(200);
  const sk = await page.evaluate(() => ({ h: location.hash, n: state.W.sk_count ? state.W.sk_count() : -1 }));
  if (!/sketch/.test(sk.h) || (sk.n !== -1 && sk.n !== 3)) problems.push(`[${where}] the sketcher did not get the three strokes: ${JSON.stringify(sk)}`);
  // leave the page as it started
  await open('engrave', 120);
  await set('text', 'BENCHMATE'); await set('h', '5'); await set('x', '0'); await set('y', '0'); await set('vang', ''); await set('align', '0');
  if (!(await page.$('#main #engcredit')) || !/Dr\. A\. V\. Hershey/.test(await page.$eval('#main #engcredit', e => e.textContent)) || !/James Hurt/.test(await page.$eval('#main #engcredit', e => e.textContent))) problems.push(`[${where}] the font acknowledgement is not on the page`);
}

// Rotary axis helper: a point turned about A, B and C, both ways round, with the centre line off zero; the drawing
// keeps both points on the same circle; the feed page gives degrees per minute, the helix length and the G93 word.
where = 'rotpoint';
{
  await units('mm');
  await mode('advanced');
  await open('rotpoint', 80);
  const set = async (k, v) => { const q = `#main [data-id="${k}"]`; if (await page.$eval(q, e => e.tagName === 'SELECT')) await page.selectOption(q, String(v)); else { await page.fill(q, String(v)); await page.dispatchEvent(q, 'input'); } await page.waitForTimeout(30); };
  const rows = () => page.$eval('#res', e => [...e.querySelectorAll('.rrow')].map(t => t.innerText.replace(/\s+/g, ' ')).join(' ; '));
  const has = async (re, what) => { const t = await rows(); if (!re.test(t)) problems.push(`[${where}] ${what}: ${t}`); };
  // defaults: A to 90 with the table carrying the part; (25, 10, 40) goes to Y 40, Z -10; 41.231 from the axis; chord 58.310
  await has(/move: X 25\.000 mm ; .*move: Y 40\.000 mm ; .*move: Z -10\.000 mm/i, 'A90 on a table should give Y 40, Z -10');
  await has(/\(does not change\) 41\.231 mm/, 'distance from the axis should be 41.231');
  await has(/point moved 58\.310 mm/, 'chord should be 58.310');
  await has(/the part turns clockwise by 90 degrees/, 'a table turning plus is clockwise seen from the + end');
  // the other way round
  await set('dir', 1);
  await has(/move: Y -40\.000 mm ; .*move: Z 10\.000 mm/, 'right-hand A90 should give Y -40, Z 10');
  await has(/the part turns counter-clockwise by 90 degrees/, 'right-hand plus is counter-clockwise seen from the + end');
  // the drawing: both points on the dashed circle, the turned one where the numbers say (Y to the right, Z up)
  const g = await page.evaluate(() => { const q = i => document.querySelector('#main .tdia svg #' + i), n = (e, a) => +e.getAttribute(a); const c = q('rpcirc'), a = q('rpa'), b = q('rpb'); return c && a && b ? { cx: n(c, 'cx'), cy: n(c, 'cy'), r: n(c, 'r'), ax: n(a, 'cx'), ay: n(a, 'cy'), bx: n(b, 'cx'), by: n(b, 'cy') } : null; });
  if (!g) problems.push(`[${where}] the drawing has no points`);
  else {
    const k = g.r / Math.hypot(10, 40), d = (x, y) => Math.hypot(x - g.cx, y - g.cy);
    if (Math.abs(d(g.ax, g.ay) - g.r) > 0.2 || Math.abs(d(g.bx, g.by) - g.r) > 0.2) problems.push(`[${where}] the points are not on the circle: ${JSON.stringify(g)}`);
    if (Math.abs(g.ax - (g.cx + 10 * k)) > 0.2 || Math.abs(g.ay - (g.cy - 40 * k)) > 0.2 || Math.abs(g.bx - (g.cx - 40 * k)) > 0.2 || Math.abs(g.by - (g.cy - 10 * k)) > 0.2) problems.push(`[${where}] the points are drawn in the wrong place: ${JSON.stringify(g)}`);
  }
  // B and C by the right-hand rule: B90 takes (25, 10, 40) to X 40, Z -25; C90 takes it to X -10, Y 25
  await set('axis', 1);
  await has(/move: X 40\.000 mm ; .*move: Y 10\.000 mm ; .*move: Z -25\.000 mm/i, 'right-hand B90 should give X 40, Z -25');
  if (await page.$('#main [data-id="cy"]') && await page.isVisible('#main [data-id="cy"]')) problems.push(`[${where}] the Y of the centre line is asked for on a B axis`);
  await set('axis', 2);
  await has(/move: X -10\.000 mm ; .*move: Y 25\.000 mm ; .*move: Z 40\.000 mm/i, 'right-hand C90 should give X -10, Y 25');
  // centre line off zero: A about Y 10, Z 0 takes the point (0, 40) from the centre line to (-40, 0) from it
  await set('axis', 0); await set('cy', 10);
  await has(/move: Y -30\.000 mm ; .*move: Z 0\.000 mm ; .*\(does not change\) 40\.000 mm/, 'A90 about Y 10 should give Y -30, Z 0, 40 from the axis');
  // a full turn brings the point back; no angle is no move
  await set('deg', 360);
  await has(/move: Y 10\.000 mm ; .*move: Z 40\.000 mm ; .*point moved 0\.000 mm/, 'a full turn should bring the point back');
  await set('deg', 90); await set('cy', 0); await set('dir', 0);
}
where = 'rotfeed';
{
  await units('inch');
  await open('rotfeed', 80);
  const set = async (k, v) => { const q = `#main [data-id="${k}"]`; await page.fill(q, String(v)); await page.dispatchEvent(q, 'input'); await page.waitForTimeout(30); };
  const rows = () => page.$eval('#res', e => [...e.querySelectorAll('.rrow')].map(t => t.innerText.replace(/\s+/g, ' ')).join(' ; '));
  const has = async (re, what) => { const t = await rows(); if (!re.test(t)) problems.push(`[${where}] ${what}: ${t}`); };
  // the Fadal manual example: 4 in diameter, 90 degrees while X moves 3 in, 25 in/min
  await has(/only turns 716\.20 deg\/min/i, '25 in/min on 4 in is 716.20 deg/min');
  await has(/round the part 3\.1416 in ; .*at once\) 4\.3439 in ; Time for the block 10\.43 s ; .*F 5\.755 1\/min ; .*during the block 517\.97 deg\/min/, 'the Fadal example should give 4.3439, 10.43 s, F5.755, 517.97');
  await has(/Controls differ/, 'the G94 row should say controls differ');
  const cap = await page.$eval('#main .tdia svg', e => e.textContent.replace(/\s+/g, ' '));
  if (!/round 3\.1416/.test(cap) || !/along 3/.test(cap) || !/cut 4\.3439 in/.test(cap) || !/G93 F5\.755/.test(cap)) problems.push(`[${where}] the drawing does not carry the numbers: ${cap}`);
  // degrees per minute typed: 360 deg/min on 4 in is one turn a minute = 12.566 in/min along the surface
  await set('dpm', 360);
  const fv = await page.inputValue('#main [data-id="feed"]');
  if (Math.abs(+fv - 12.566) > 0.001) problems.push(`[${where}] 360 deg/min on 4 in should fill 12.566 in/min, got ${fv}`);
  // a block that only turns: no helix row, the time is the arc at the feed, F = feed / arc
  await set('feed', 25); await set('lin', 0);
  const t = await rows();
  if (/at once/.test(t) || /Controls differ/.test(t) || !/Time for the block 7\.54 s/.test(t) || !/F 7\.958 1\/min/.test(t)) problems.push(`[${where}] a turn-only block should take 7.54 s with F7.958: ${t}`);
  // mm: 600 mm/min on 100 mm is 687.55 deg/min
  await units('mm');
  await open('rotfeed', 80);
  await has(/only turns 687\.55 deg\/min/i, '600 mm/min on 100 mm is 687.55 deg/min');
  await units('inch'); await open('rotfeed', 60); await set('lin', 3);
  await units('mm');
}

// G-code snippets: a calculator's result as the cycle blocks only, in the dialect of the control picked or of the
// active machine; the same blocks are a fold on every generator page; unsupported controls say so and write nothing.
where = 'snippets';
{
  await units('mm');
  await mode('advanced');
  await page.evaluate(() => { SNIP_CTRL.v = null; });
  const box = '#main details.rsnip';
  const openBox = async () => { await page.waitForSelector(box, { timeout: 5000 }).catch(() => problems.push(`[${where}] no G-code box on this page`)); await page.evaluate(b => { const d = document.querySelector(b); if (d && !d.open) d.open = true; }, box); await page.waitForTimeout(80); };
  const set = async (k, v) => { await page.evaluate(([b, k, v]) => { const i = document.querySelector(b + ' [data-k="' + k + '"]'); i.value = v; i.dispatchEvent(new Event(i.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); }, [box, k, String(v)]); await page.waitForTimeout(50); };
  const snip = () => page.$eval(box + ' .snipt', e => e.textContent).catch(() => '');
  const msg = () => page.$eval(box + ' .snipout', e => e.innerText.replace(/\s+/g, ' ')).catch(() => '');
  // bolt circle: nothing is invented, so the speed, feed and depth are asked for first
  await open('bolt', 80);
  await openBox();
  if (!/Enter the spindle speed/.test(await msg())) problems.push(`[${where}] an empty box should ask for the spindle speed: ${await msg()}`);
  await set('rpm', 1200); await set('feed', 150);
  if (!/Need Z depth below the R plane/.test(await msg())) problems.push(`[${where}] no depth should be asked for: ${await msg()}`);
  await set('z', -18);
  let t = await snip();
  if (!t.startsWith('(BENCHMATE SNIPPET - CYCLE BLOCKS ONLY - GENERIC ISO 6983 / FANUC-STYLE - MM)\n') || !/\(BEFORE THESE BLOCKS: SPINDLE ON: S1200 M03\)/.test(t) || !/\nG99 G81 X50\.0 Y0\.0 Z-18\.0 R2\.0 F150\.0\nX25\.0 Y43\.301\nX-25\.0 Y43\.301\nX-50\.0 Y0\.0\nX-25\.0 Y-43\.301\nX25\.0 Y-43\.301\nG80\n$/.test(t)) problems.push(`[${where}] bolt circle blocks are wrong:\n${t}`);
  if (/M30|M06|G43|^%|^O\d/m.test(t)) problems.push(`[${where}] the snippet holds parts of a whole program:\n${t}`);
  // the dwell word differs by control: milliseconds without a point (Fanuc-style), seconds with a point (Haas)
  await set('cycle', 82);
  t = await snip();
  if (!/ P300 F150\.0\n/.test(t)) problems.push(`[${where}] Fanuc-style G82 dwell should be P300:\n${t}`);
  await set('ctrl', 1);
  t = await snip();
  if (!/ - HAAS - MM\)/.test(t) || !/ P0\.3 F150\.0\n/.test(t)) problems.push(`[${where}] Haas G82 dwell should be P0.3:\n${t}`);
  // on to the full generator: same control, cycle and holes; its program holds the same cycle blocks, and its fold shows them
  const cyc = t.split('\n').filter(l => !l.startsWith('(')).join('\n');
  await page.click(box + ' [data-a="full"]'); await page.waitForTimeout(250);
  const full = await page.evaluate(() => ({ h: location.hash, prog: (document.querySelector('#main #cytext') || {}).textContent || '', sn: (document.querySelector('#main #cysnip') || {}).textContent || '' }));
  if (!/cycdrill/.test(full.h) || !full.prog.includes('\n' + cyc) || !/\(CONTROL: HAAS\)/.test(full.prog)) problems.push(`[${where}] the full generator did not get the same job:\n${full.prog.slice(0, 700)}`);
  if (!full.sn.startsWith('(BENCHMATE SNIPPET - CYCLE BLOCKS ONLY - HAAS - MM)') || !full.sn.endsWith(cyc)) problems.push(`[${where}] the generator's "cycle blocks only" fold is wrong:\n${full.sn}`);
  // every generator page has the fold, and its blocks are lines of its own program
  for (const id of ['cyctmill', 'cycthread', 'cyctaper', 'cycgroove', 'cycbroach', 'cycg71', 'engrave']) {
    await open(id, 150);
    await page.waitForSelector('#main #cysnip', { timeout: 5000 }).catch(() => {});
    const g = await page.evaluate(() => ({ prog: (document.querySelector('#main #cytext') || {}).textContent || '', sn: (document.querySelector('#main #cysnip') || {}).textContent || '' }));
    const body = g.sn.split('\n').filter(l => !/^\((BENCHMATE SNIPPET|BEFORE THESE BLOCKS|CHECK EVERY LINE)/.test(l)).join('\n');
    if (!g.sn.startsWith('(BENCHMATE SNIPPET - CYCLE BLOCKS ONLY - ') || !/\(BEFORE THESE BLOCKS: /.test(g.sn) || body.length < 10 || !g.prog.includes('\n' + body)) problems.push(`[${where}] ${id}: the cycle blocks fold is missing or not part of the program:\n${g.sn.slice(0, 400)}`);
  }
  // the control comes from the active machine until one is picked in a box; a control with no confirmed format writes nothing
  await page.evaluate(() => { SNIP_CTRL.v = null; });
  const mid = await page.evaluate(() => { const m = Profiles.upsert({ name: 'Smoke mill', type: 'Mill / machining centre', control: 'Haas NGC', rpm_max: 8000 }); Profiles.setActive(m.id); return m.id; });
  await open('holegrid', 80); await openBox();
  await set('rpm', 900); await set('feed', 120); await set('z', -10); await set('cycle', 83);
  t = await snip();
  if (!/ - HAAS - MM\)/.test(t) || !/The control comes from the active machine/.test(await msg()) || !/\nG99 G83 X0\.0 Y0\.0 Z-10\.0 R2\.0 Q4\.0 F120\.0\n/.test(t) || (t.match(/^X-?\d/gm) || []).length !== 11) problems.push(`[${where}] hole grid on a Haas machine is wrong:\n${t}\n${await msg()}`);
  await page.evaluate(id => { Profiles.upsert({ id, name: 'Smoke mill', type: 'Mill / machining centre', control: 'Siemens 840D', rpm_max: 8000 }); }, mid);
  await open('holegrid', 80); await openBox();
  if (!/No blocks for Siemens 840D \(ISO mode\): its format is not confirmed/.test(await msg()) || (await snip())) problems.push(`[${where}] a Siemens machine should get no blocks and be told why: ${await msg()}`);
  await page.evaluate(id => Profiles.remove(id), mid);
  await page.evaluate(() => { SNIP_CTRL.v = null; });
  // drill point: a depth at full diameter gives the depth to the point, and the cycle goes there (118 degrees, 6 mm: 1.8026 + 20)
  await open('drillpoint', 80);
  await page.fill('#main [data-id="depth"]', '20'); await page.dispatchEvent('#main [data-id="depth"]', 'input'); await page.waitForTimeout(60);
  const dpRow = await page.$eval('#res', e => e.innerText.replace(/\s+/g, ' '));
  if (!/to the drill point 21\.8026 mm/i.test(dpRow)) problems.push(`[${where}] depth to the drill point should be 21.8026: ${dpRow}`);
  await openBox(); await set('rpm', 2000); await set('feed', 200);
  t = await snip();
  if (!/\nG99 G81 X0\.0 Y0\.0 Z-21\.803 R2\.0 F200\.0\nG80\n$/.test(t) || !(await page.$eval(box + ' [data-k="z"]', e => e.disabled))) problems.push(`[${where}] drill point cycle should go to Z-21.803, fixed by the page:\n${t}`);
  await page.fill('#main [data-id="depth"]', ''); await page.dispatchEvent('#main [data-id="depth"]', 'input'); await page.waitForTimeout(60);
  if (await page.$(box)) problems.push(`[${where}] no depth, no G-code box on the drill point page`);
  // tap drill: the pitch comes from the thread; Fanuc-style rigid tapping starts the spindle with M29 inside the blocks
  await open('tapdrill', 200); await openBox();
  await set('rpm', 400); await set('z', -15);
  t = await snip();
  if (!/\nM29 S400\nG99 G84 X0\.0 Y0\.0 Z-15\.0 R2\.0 F600\.0\nG80\n$/.test(t) || /SPINDLE ON/.test(t) || !/Tap feed = pitch x rpm = 600\.00 mm\/min/.test(await msg())) problems.push(`[${where}] M10 x 1.5 at 400 rpm should tap at F600 with M29:\n${t}`);
  // spot drill depth: a 90 degree spot to a 10 mm chamfer is 5 deep, with a dwell
  await open('spotdepth', 200);
  await page.selectOption('#main #sm', '1').catch(() => {});
  await page.waitForTimeout(80);
  const spotOk = await page.evaluate(() => { const a = document.querySelector('#main #sang'), d = document.querySelector('#main #sdc'); if (!a || !d) return false; a.value = '90'; a.dispatchEvent(new Event('input', { bubbles: true })); d.value = '10'; d.dispatchEvent(new Event('input', { bubbles: true })); return true; });
  if (!spotOk) problems.push(`[${where}] spot drill page inputs not found`);
  else {
    await openBox(); await set('rpm', 1500); await set('feed', 100);
    t = await snip();
    if (!/\nG99 G82 X0\.0 Y0\.0 Z-5\.0 R2\.0 P300 F100\.0\nG80\n$/.test(t)) problems.push(`[${where}] a 90 degree spot to 10 mm should dwell at Z-5.0:\n${t}`);
  }
  // spindle and feed words: mill, then a lathe with constant surface speed (clamp asked for), then the feed pages
  await open('rpm', 80); await openBox();
  t = await snip();
  if (t !== '(BENCHMATE SNIPPET - SPINDLE AND FEED WORDS - GENERIC ISO 6983 / FANUC-STYLE - MM)\n(CHECK EVERY LINE AGAINST YOUR CONTROL MANUAL)\nS2387 M03\n') problems.push(`[${where}] 90 m/min on 12 mm should be S2387 M03:\n${t}`);
  await set('mach', 1); await set('css', 1);
  if (!/Enter the maximum spindle speed for CSS/.test(await msg())) problems.push(`[${where}] constant surface speed needs the clamp: ${await msg()}`);
  await set('vmax', 3000);
  t = await snip();
  if (!/\nG50 S3000\nG96 S90 M03\n$/.test(t)) problems.push(`[${where}] lathe constant surface speed words are wrong:\n${t}`);
  await set('css', 0); await set('mach', 0);
  await open('feed', 80); await openBox();
  t = await snip();
  if (!/\nS3000 M03\n\(FEED PER MINUTE, G94: PUT THIS WORD ON THE FIRST CUTTING BLOCK\)\nF600\.0\n$/.test(t)) problems.push(`[${where}] milling feed words are wrong:\n${t}`);
  await open('lathefeed', 80);
  await page.fill('#main [data-id="rpm"]', '1000'); await page.dispatchEvent('#main [data-id="rpm"]', 'input'); await page.waitForTimeout(60);
  await openBox();
  t = await snip();
  if (!/\nG97 S1000 M03\n\(FEED PER REVOLUTION, G99: PUT THIS WORD ON THE FIRST CUTTING BLOCK\)\nF0\.15\n$/.test(t)) problems.push(`[${where}] lathe feed per revolution words are wrong:\n${t}`);
  await set('per', 0);
  t = await snip();
  if (!/\(FEED PER MINUTE, G98: PUT THIS WORD ON THE FIRST CUTTING BLOCK\)\nF150\.0\n$/.test(t)) problems.push(`[${where}] lathe feed per minute words are wrong:\n${t}`);
  await set('per', 1);
  await page.fill('#main [data-id="rpm"]', ''); await page.dispatchEvent('#main [data-id="rpm"]', 'input');
  // inch: four places and the inch header
  await units('inch');
  await open('bolt', 80); await openBox();
  await set('rpm', 1200); await set('feed', 6); await set('z', -0.75);
  t = await snip();
  if (!/ - INCH\)/.test(t) || !/\nG99 G81 X2\.0 Y0\.0 Z-0\.75 R0\.1 F6\.0\nX1\.0 Y1\.7321\n/.test(t)) problems.push(`[${where}] inch bolt circle blocks are wrong:\n${t}`);
  await units('mm');
  await page.evaluate(() => { SNIP_CTRL.v = null; });
}

// Knurling: four methods. The published examples must come out, the method fields must swap, and the
// tick-off procedure must keep its ticks and name a source (or say it has none) on every step.
where = 'knurl';
{
  await units('inch');
  await open('knurl', 150);
  const set = async (id, v) => { const q = `#main #${id}`; await page.fill(q, String(v)); await page.dispatchEvent(q, 'input'); await page.waitForTimeout(30); };
  const pick = async (id, v) => { await page.selectOption(`#main #${id}`, v); await page.waitForTimeout(40); };
  const res = () => page.$eval('#main #kres', e => e.innerText.replace(/\s+/g, ' '));
  const has = async (re, what) => { const t = await res(); if (!re.test(t)) problems.push(`[${where}] ${what}: ${t}`); };
  const shown = async id => page.$eval(`#main #${id}`, e => !!e.offsetParent);
  // 1. diametral pitch: 96 DP on 1/2 in is 48 teeth (ANSI B94.6 as quoted), 0.0327 in pitch
  await pick('km', 'dp'); await set('kdp', 96); await set('kd', 0.5);
  await has(/Circular pitch p 0\.0327 in/, '96 DP is 0.0327 in');
  await has(/Teeth on the wanted diameter 48\.00/, '96 DP on 0.5 in is 48 teeth');
  if (await shown('kp') || await shown('kl') || await shown('ktb')) problems.push(`[${where}] the DP method shows fields of another method`);
  // 2. circular pitch: Dorian, 20 TPI at 30 degrees is 17.32 TPI round the work (0.0577 in)
  await pick('km', 'cp'); await pick('ks', 'tpi'); await set('kp', 20); await pick('kf', '30');
  await has(/Pitch around the circumference 0\.0577 in/, '20 TPI at 30 deg is 0.0577 in round the work');
  if (!(await shown('kf')) || await shown('kdp')) problems.push(`[${where}] the circular pitch method shows the wrong fields`);
  // 3. measure and count, print: Hoffman, 75 spaces in 3.535 in, 5/8 in stock, 41 teeth, 0.615 in
  await pick('km', 'count'); await pick('kh', 'print'); await set('kl', 75); await set('kspan', 3.535); await set('kd', 0.625);
  await has(/Circular pitch p 0\.0471 in .*Blank for 41 teeth 0\.6151 in .*Steps between whole tooth counts 0\.0150 in/, 'the Hoffman print example should give 0.0471, 41 teeth, 0.6151, 0.0150');
  if (await shown('kf')) problems.push(`[${where}] measure and count should not ask for the pattern`);
  // wheel: 72 teeth over 0.744 in (ANSI 96 DP wheel) is 0.0325 in and 96.77 per inch of diameter
  await pick('kh', 'wheel'); await set('kl', 72); await set('kspan', 0.744);
  await has(/Circular pitch p 0\.0325 in .*Teeth per inch of wheel diameter 96\.77 .*Approximate\..*one source.*64, 96, 128, 160/, 'the ANSI wheel example should give 0.0325 and 96.77, marked approximate and single-source');
  // back to the print: its own numbers are kept
  await pick('kh', 'print');
  if (await page.inputValue('#main #kl') !== '75' || await page.inputValue('#main #kspan') !== '3.535') problems.push(`[${where}] the print values were lost when switching to the wheel and back`);
  // 4. trial and error
  await pick('km', 'trial');
  await has(/Enter the blank you tried/, 'trial with no blank should ask for it');
  await set('ktb', 0.615);
  await has(/try next 0\.6100 in .*or 0\.6200 in/, 'a 0.615 blank should offer 0.610 and 0.620');
  await set('ktk', 0.635); await set('ktf', 0.65);
  await has(/Growth on this trial piece 0\.0200 in .*Blank for the finished diameter 0\.6300 in .*try the new blank on scrap/, 'growth 0.020 and blank 0.630 for 0.650 finished');
  await set('ktk', 0.6);
  await has(/Check the two diameters/, 'a knurled diameter under the blank should be questioned');
  const steps = await page.$$eval('#main #ktick li', a => a.map(li => li.innerText.replace(/\s+/g, ' ')));
  if (steps.length !== 9) problems.push(`[${where}] expected 9 steps, got ${steps.length}`);
  for (const [n, t] of steps.entries()) if (!/\[[^\]]+\]$/.test(t)) problems.push(`[${where}] step ${n + 1} does not name its sources: ${t}`);
  if (!/no source\]$/.test(steps[8] || '')) problems.push(`[${where}] the last step should be marked as BenchMate's own advice: ${steps[8]}`);
  if (!/Dorian Tool, Sherline Products\]$/.test(steps[5] || '')) problems.push(`[${where}] the 0.005 in step should name Dorian and Sherline: ${steps[5]}`);
  await page.click('#main #ktick li:nth-child(1) input'); await page.click('#main #ktick li:nth-child(4) input');
  if (!/^2 of 9/.test(await page.textContent('#main #kdone'))) problems.push(`[${where}] two ticks should count as 2 of 9`);
  // ticks and values survive a change of units (values are kept in mm)
  await units('mm'); await open('knurl', 150);
  if (await page.inputValue('#main #km') !== 'trial' || !/^2 of 9/.test(await page.textContent('#main #kdone'))) problems.push(`[${where}] method or ticks lost on a change of units`);
  if (await page.inputValue('#main #ktb') !== '15.621') problems.push(`[${where}] 0.615 in should show as 15.621 mm, got ${await page.inputValue('#main #ktb')}`);
  await has(/try next 15\.494 mm .*or 15\.748 mm/, 'the step is 0.127 mm either way');
  await page.click('#main #kclr');
  if (!/^0 of 9/.test(await page.textContent('#main #kdone'))) problems.push(`[${where}] Clear the ticks should clear them`);
  await pick('km', 'cp'); await pick('ks', 'mm'); await pick('kf', '0'); await set('kp', 1); await set('kd', 20);
  await has(/Teeth on the wanted diameter 62\.83 .*Blank for 62 teeth 19\.735 mm/, '1 mm pitch on 20 mm is 62.83 teeth, blank 19.735 for 62');
  const src = await page.$eval('#main', e => e.innerText);
  for (const w of ['Sherline', 'GenSwiss', 'Conrad Hoffman', 'pjsminilathe', 'Read and not used', 'Industrial Monitor Direct']) if (!src.includes(w)) problems.push(`[${where}] the sources note should name ${w}`);
}
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
