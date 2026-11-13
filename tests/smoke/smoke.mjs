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
const NO_DRAWING = new Set(['drillchart', 'gritconv', 'prefnum', 'gmcodes', 'macroref', 'abbrev', 'units', 'symbols', 'gauges', 'calc', 'formulas',
  'machines', 'toollib', 'setupsheet', 'materials', 'tempercolours', 'heattreat', 'plastics', 'metalid',
  'gsim', 'sketch', 'insertcode', 'gdtfcf', 'boltgrade', 'holdertorque', 'glossary']);
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
// Grinding: wheel to work rpm ratio. The two published examples, the three verdicts, wear at constant surface
// speed against constant rpm, and the drawing (waves only when the ratio is a bad one).
where = 'grindratio';
{
  await units('mm');
  await open('grindratio', 80);
  const set = async (k, v) => { const q = `#main [data-id="${k}"]`; await page.fill(q, String(v)); await page.dispatchEvent(q, 'input'); await page.waitForTimeout(30); };
  const rows = () => page.$eval('#res', e => [...e.querySelectorAll('.rrow')].map(t => t.innerText.replace(/\s+/g, ' ')).join(' ; '));
  const has = async (re, what) => { const t = await rows(); if (!re.test(t)) problems.push(`[${where}] ${what}: ${t}`); };
  const cap = () => page.$eval('#main .tdia svg', e => e.textContent.replace(/\s+/g, ' '));
  // Badger 2010: 500 mm wheel at 40 m/s, work 200 rpm: 1,528 rpm, ratio 7.64 (printed 7.63); worn to 350 mm: 2,182 rpm, 10.91, passing 8, 9, 10
  await has(/rpm ratio \(wheel rpm \/ work rpm\) 7\.6394 ; Verdict Not close/i, 'the default example should give 7.6394, not close');
  await has(/Wheel rpm for that surface speed 1,527\.9 RPM/, 'wheel rpm 1,527.9');
  await has(/ratio 8: 191\.0 rpm; .*ratio 7 1\/2: 203\.7 rpm; .*ratio 7: 218\.3 rpm/, 'work speeds to stay away from');
  await set('dmin', 350);
  await has(/Wheel rpm when worn 2,182\.7 RPM ; Rpm ratio when worn 10\.9135 +; Whole numbers passed as the wheel wears 8, 9, 10\./, 'worn to 350 mm should give 2,182.7 rpm, 10.9135 and pass 8, 9, 10');
  let c = await cap();
  if (!/long decimal: ?waves wiped out/.test(c) || /waves drawn/.test(c) || !/7\.6394/.test(c)) problems.push(`[${where}] the drawing of a good ratio should be round and say so: ${c}`);
  // whole number: work at 191 rpm with the wheel at 1528 rpm is exactly 8
  await set('ns', 1528); await set('nw', 191);
  await has(/ratio \(wheel rpm \/ work rpm\) 8\.0000 ; Verdict Close to a whole number \(8\)/i, '1528 / 191 is 8, a whole number');
  await has(/As the wheel wears At a constant wheel rpm the ratio stays where it is\. The surface speed falls to 28\.00 m\/s/, 'at constant rpm the ratio stays and the surface speed falls to 28.00 m/s');
  c = await cap();
  if (!/whole number: ?waves build up/.test(c) || !/8 waves drawn/.test(c)) problems.push(`[${where}] the drawing of a whole-number ratio should show 8 waves: ${c}`);
  // simple fraction: 1528 / 203.7333 = 7.5
  await set('nw', 203.7333);
  await has(/Verdict Close to 7 1\/2: .*scallops/, '7.5 should be called a simple fraction');
  // the author's own examples of bad and good ratios (wheel rpm chosen as ratio x 100)
  for (const [ns, bad] of [[901.3, true], [899.24, true], [936.488, false], [891.6742, false]]) {
    await set('ns', ns); await set('nw', 100);
    const t = await rows();
    if (bad !== /Verdict Close to a whole number/.test(t) || (!bad && !/Verdict Not close/.test(t))) problems.push(`[${where}] ratio ${ns / 100} should be ${bad ? 'bad' : 'good'}: ${t}`);
  }
  // Badger 2011, inch: 16 in wheel at 12,000 sfm, work 40 rpm, 70 marks: ratio 71.62 (printed 71.65 with pi = 3.14), 46.7 Hz
  await units('inch'); await open('grindratio', 80);
  await set('ds', 16); await set('ns', ''); await set('vs', 12000); await set('nw', 40); await set('marks', 70); await set('dw', 2); await set('dmin', '');
  await has(/ratio \(wheel rpm \/ work rpm\) 71\.6197/i, '12,000 sfm on 16 in at 40 rpm is 71.6197');
  await has(/Frequency of the marks 46\.7 Hz ; Marks counted against the rpm ratio -2\.3 % +; What the count points to .*self-excited chatter/, '70 marks at 40 rpm is 46.7 Hz, 2.3 % under the ratio');
  await has(/Spacing of those waves round the work 0\.0877 in/, 'spacing of 71.62 waves on 2 in is 0.0877 in');
  await has(/Wheel, once per revolution 47\.75 Hz/, 'the wheel turns at 47.75 Hz');
}
// Gun drilling: the maker's table values, straight-line values between table sizes, nothing outside the table,
// the second maker's ranges beside them, the 20 % cut over 30 diameters and the percentage speed adjustments.
where = 'gundrill';
{
  await units('inch');
  await open('gundrill', 150);
  const set = async (id, v) => { const q = `#main #${id}`; await page.fill(q, String(v)); await page.dispatchEvent(q, 'input'); await page.waitForTimeout(30); };
  const pick = async (id, v) => { await page.selectOption(`#main #${id}`, v); await page.waitForTimeout(40); };
  const res = () => page.$eval('#main #gdres', e => e.innerText.replace(/\s+/g, ' '));
  const has = async (re, what) => { const t = await res(); if (!re.test(t)) problems.push(`[${where}] ${what}: ${t}`); };
  // 1/2 in drill, low to medium carbon steel 12-17 HRC, high pressure: Sterling 330 SFM, 0.0008 in/rev, 525 psi, 7.0 gal/min
  await has(/Cutting speed 330 SFM 100\.6 m\/min Sterling Gun Drills: 12-17 HRC/, 'default speed 330 SFM');
  await has(/botek, for comparison 230 to 328 SFM 70 to 100 m\/min guide range for: Structural and carbon steel/, 'botek speed range 70 to 100 m/min');
  await has(/Spindle speed 2521 rpm/, '330 SFM on 0.5 in is 2521 rpm');
  await has(/Feed per revolution 0\.00080 in\/rev 0\.0203 mm\/rev Sterling Gun Drills, column "Steels, low and medium carbon"/, 'feed 0.0008 in/rev');
  await has(/botek, for comparison 0\.00106 to 0\.00299 in\/rev 0\.0270 to 0\.0760 mm\/rev guide range for 12\.00 to 13\.99 mm/, 'botek feed range for 12.7 mm');
  await has(/Feed rate 2\.02 in\/min 51\.2 mm\/min/, 'feed rate 2.02 in/min');
  await has(/Coolant pressure 525 psi 36\.2 bar .*one source.*Coolant flow, single flute 7\.0 gal\/min 26\.5 l\/min .*Coolant flow, twin flute 7\.5 gal\/min .*Longest unsupported drill length 16\.0 in 406 mm at high SFM 32\.0 in 813 mm at low SFM/, 'coolant row of the 0.500 in size');
  await has(/UNISIG starting flow, any deep hole tool 12\.5 to 15\.0 gal\/min 47\.0 to 57\.1 l\/min/, 'UNISIG 25 to 30 gal/min per inch');
  if (/Time to drill|Depth in diameters/.test(await res())) problems.push(`[${where}] no depth entered: no depth rows expected`);
  // between two table sizes: 0.300 in is 0.4 of the way from 0.250 to 0.375: 0.00055 in/rev, 825 psi, 3.2 gal/min
  await set('gdd', 0.3);
  await has(/Feed per revolution 0\.00055 in\/rev/, '0.300 in should give 0.00055 in/rev');
  await has(/Coolant pressure 825 psi .*single flute 3\.2 gal\/min/, '0.300 in should give 825 psi and 3.2 gal/min');
  // outside the table nothing is made up
  await set('gdd', 1.5);
  await has(/Feed per revolution Outside Sterling Gun Drills's table .*Coolant pressure and flow Outside Sterling Gun Drills's table/, '1.5 in is outside the table');
  if (/Feed rate|single flute/.test(await res())) problems.push(`[${where}] outside the table there should be no feed rate or flow`);
  await set('gdd', 0.1);
  await has(/Feed per revolution Outside/, '0.100 in is under the table');
  // deep hole: 0.5 in x 16 in is 32 diameters, the feed is cut by 20 % to 0.00064, 16 / (0.00064 x 2521) = 9.92 min
  await set('gdd', 0.5); await set('gdl', 16);
  await has(/Depth in diameters 32\.0 x D .*Feed per revolution 0\.00064 in\/rev .*cut by 20 % because the hole is over 30 diameters deep.*Time to drill the depth 9\.92 min/, '32 diameters deep: 0.00064 in/rev and 9.92 min');
  await set('gdl', 15);
  await has(/Depth in diameters 30\.0 x D .*Feed per revolution 0\.00080 in\/rev 0\.0203 mm\/rev Sterling Gun Drills, column "Steels, low and medium carbon" botek/, 'exactly 30 diameters: no cut');
  // stainless 300, free machining +30 %, spray mist: 150 x 1.3 = 195 SFM; the feed column follows the material; the maker's warning shows
  await pick('gdm', 'ss300'); await pick('gda', '0'); await pick('gdc', 'mist');
  await has(/Cutting speed 195 SFM .*17-17 \(as printed; probably 12-17\) HRC, free machining \+30 %/, 'stainless 300 free machining on spray mist is 195 SFM');
  await has(/guide range for: Stainless steel, austenitic.*column "Stainless 300 series, titanium, high temperature nickel alloys".*marks this material.*Spray mist:/, 'stainless: feed column, botek group, verify note and mist note');
  if (await page.inputValue('#main #gdf') !== 'c3') problems.push(`[${where}] the feed column should follow the material`);
  // grey cast iron has no botek rows and its own adjustments
  await pick('gdm', 'gci'); await pick('gdc', 'hp'); await pick('gda', '1');
  await has(/Cutting speed 160 SFM .*ni-resist -60 %/, 'grey iron Ni-Resist is 400 less 60 % = 160 SFM');
  if (/botek/.test(await res())) problems.push(`[${where}] no botek rows expected for cast iron`);
  // mm: 6 mm in low carbon steel: botek row 6.00 to 6.99 mm
  await units('mm'); await open('gundrill', 150);
  await pick('gdm', 'lc'); await set('gdd', 6); await set('gdl', '');
  await has(/botek, for comparison 0\.0110 to 0\.0364 mm\/rev .*guide range for 6\.00 to 6\.99 mm/, 'botek row for 6 mm');
  await has(/Coolant pressure 67\.2 bar 974 psi/, '6 mm is 974 psi by the straight line between 0.187 and 0.250 in');
  const rules = await page.$$eval('#main ul.gdrules li', a => a.map(li => li.innerText.replace(/\s+/g, ' ')));
  if (rules.length !== 7 || rules.some(t => !/\[[^\]]+\]$/.test(t))) problems.push(`[${where}] seven rules, each naming its sources: ${rules.length}`);
  const txt = await page.$eval('#main', e => e.innerText);
  for (const w of ['Read and not used', 'Master Fluid Solutions', 'UNISIG', 'botek', 'Hartner', 'Ingersoll', 'ISCAR']) if (!txt.includes(w)) problems.push(`[${where}] the sources note should name ${w}`);
}
// Tool wear guide: ten wear types, each with its own drawing, causes and remedies; the picture index jumps to
// the card; an entry that only one maker describes is marked. The CNC guide shows the same ten.
where = 'toolwear';
{
  await open('toolwear', 120);
  const g = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('#main .wearc')];
    return { tiles: document.querySelectorAll('#main a.weart svg.dk').length, cards: cards.length,
      bad: cards.filter(c => !c.querySelector('.weard svg.dk') || !/What you see/.test(c.innerText) || !/Causes/.test(c.innerText) || !/What to try/.test(c.innerText) || !c.querySelector('abbr.gsrc')).map(c => c.id),
      single: cards.filter(c => /to be verified/.test(c.innerText)).map(c => c.id).join(','),
      gradual: cards.filter(c => /Gradual wear/i.test(c.innerText)).map(c => c.id).join(','),
      marks: cards.map(c => c.querySelectorAll('.weard svg .tool, .weard svg .hot').length) };
  });
  if (g.tiles !== 10 || g.cards !== 10) problems.push(`[${where}] expected 10 tiles and 10 cards, got ${g.tiles} and ${g.cards}`);
  if (g.bad.length) problems.push(`[${where}] cards without a drawing, the three headings or a source: ${g.bad.join(', ')}`);
  if (g.single !== 'wear-flaking,wear-hammer') problems.push(`[${where}] flaking and chip hammering have one source each and should say so: ${g.single}`);
  if (g.gradual !== 'wear-flank,wear-crater') problems.push(`[${where}] only flank and crater wear are gradual wear: ${g.gradual}`);
  if (g.marks.some(n => n < 1)) problems.push(`[${where}] a drawing shows no wear mark: ${g.marks.join(' ')}`);
  await page.click('#main a.weart[data-w="notch"]'); await page.waitForTimeout(80);
  if (!(await page.$('#main #wear-notch.on')) || (await page.$$('#main .wearc.on')).length !== 1) problems.push(`[${where}] the picture index should mark the notch wear card`);
  await open('cncguide', 120);
  const n = await page.$$eval('#main .cnwd svg.dk', a => a.length);
  if (n !== 10) problems.push(`[${where}] the CNC guide should show the same ten wear drawings, got ${n}`);
}
// Macro system variables: searchable by number per control; a one-source row says so; a number that is not
// listed is not borrowed from another control. Builders' M-code lists (Doosan, DMG MORI, Mazak) are separate.
where = 'sysvars';
{
  await open('macroref', 300);
  const sv = async (ctrl, q) => {
    await page.selectOption('#mrc', ctrl);
    await page.fill('#mrq', q); await page.dispatchEvent('#mrq', 'input'); await page.waitForTimeout(60);
    return page.$eval('#mrsv', e => e.innerText.replace(/\s+/g, ' '));
  };
  let t = await sv('haas', '5023');
  if (!/\(1 of 70\)/i.test(t) || !/#5021 to #5025 Present machine position/.test(t) || !/Maker/.test(t)) problems.push(`[${where}] Haas 5023 should find the machine position row: ${t.slice(0, 160)}`);
  t = await sv('haas', '#2001');
  if (!/#2001 to #2200 Tool length offsets \(H\)/.test(t)) problems.push(`[${where}] Haas #2001 is the tool length offset block: ${t.slice(0, 160)}`);
  t = await sv('fanuc', '2001');
  if (!/\(#2001 to #2200\) Machining centre: tool length wear/.test(t) || !/Two sources/.test(t)) problems.push(`[${where}] Fanuc #2001 is the tool length wear block, from two sources: ${t.slice(0, 200)}`);
  t = await sv('fanuc', '#3901');
  if (!/Number of parts machined/.test(t) || !/One source/.test(t)) problems.push(`[${where}] Fanuc #3901 has one source and should say so: ${t.slice(0, 160)}`);
  t = await sv('fanuc', '8500');
  if (!/\(0 of \d+\)/i.test(t) || !/not borrowed from another control/.test(t)) problems.push(`[${where}] a Haas-only number must not show for Fanuc: ${t.slice(0, 160)}`);
  t = await sv('haas', 'timer');
  if (!/#3001 Millisecond timer/.test(t) || /#5021/.test(t)) problems.push(`[${where}] a word search should filter the Haas list: ${t.slice(0, 160)}`);
  t = await sv('okuma', '');
  if (!/No system variables confirmed for Okuma/.test(t) && t.trim() !== '') problems.push(`[${where}] Okuma has no system variable rows: ${t.slice(0, 120)}`);
  await sv('fanuc', '');
  const disF = await page.$eval('#mrnotes', e => e.innerText.replace(/\s+/g, ' '));
  if (!/Macro variable number for one tool offset/i.test(disF) || !/#11201/.test(disF)) problems.push(`[${where}] the tool offset numbering difference should be shown for Fanuc`);
  await page.fill('#mrq', ''); await page.dispatchEvent('#mrq', 'input');

  await open('gmcodes', 300);
  const mrow = async (ctrl, q) => {
    await page.selectOption('#gmc', ctrl);
    await page.fill('#gmq', q); await page.dispatchEvent('#gmq', 'input'); await page.waitForTimeout(60);
    return page.$$eval('#gmres tr.gmrow', rs => rs.map(r => r.innerText.replace(/\s+/g, ' ')).join(' ; '));
  };
  const want = [['doosan', 'M29', /Rigid tapping mode on/], ['dmg', 'M29', /In-position check invalid/], ['mazak', 'M203', /Turning spindle 1 start, forward/],
    ['doosan', 'M60', /Pallet change/], ['dmg', 'M25', /Tailstock spindle out/], ['mazak', 'M08', /Flood coolant on/]];
  for (const [ctrl, code, re] of want) {
    const r = await mrow(ctrl, code);
    if (!re.test(r)) problems.push(`[${where}] ${ctrl} ${code}: ${r.slice(0, 140)}`);
  }
  const counts = await page.evaluate(async () => { const G = (await (await fetch('data/refdata.json')).json()).gcodes; const n = c => G.codes.filter(r => r.ctrl === c && r.kind === 'M').length; return [n('doosan'), n('dmg'), n('mazak'), G.sysvars.length].join(','); });
  if (counts !== '118,44,47,89') problems.push(`[${where}] M rows for Doosan, DMG MORI, Mazak and system variable rows: ${counts}`);
  await page.fill('#gmq', ''); await page.dispatchEvent('#gmq', 'input');
  await page.selectOption('#gmc', 'haas');
}
// Material card: composition chart (limits as printed, per element, with the publisher count), machinability
// rings (one per printed rating, never merged across conditions) and the property table.
where = 'material card';
{
  await open('materials', 300);
  const card = async grade => {
    await page.fill('#msearch', grade); await page.dispatchEvent('#msearch', 'input'); await page.waitForTimeout(80);
    await page.evaluate(g => [...document.querySelectorAll('#main .mrow')].find(r => r.querySelector('b').textContent === g).click(), grade);
    await page.waitForTimeout(120);
    return page.evaluate(() => ({
      comp: [...document.querySelectorAll('#mcomp tr[data-el]')].map(r => r.dataset.el + ': ' + r.cells[1].innerText.replace(/\s+/g, ' ') + ' [' + r.cells[3].innerText.trim() + ']' + (r.querySelector('svg.cbar rect.cb-rng') ? ' bar' : '')).join(' ; '),
      none: document.querySelector('#mcomp') ? document.querySelector('#mcomp').innerText.replace(/\s+/g, ' ') : '',
      rings: [...document.querySelectorAll('#mmach .mrc')].map(c => c.innerText.replace(/\s+/g, ' ')).join(' ; '),
      arcs: [...document.querySelectorAll('#mmach circle.mr-arc')].map(c => c.getAttribute('stroke-dasharray').split(' ')[0]).join(','),
      props: !!document.querySelector('#mev .mprops'), head: document.querySelector('#mcard') ? document.querySelector('#mcard').innerText : '' }));
  };
  let c = await card('4140');
  if (!/C: 0\.38 to 0\.43 2 \[Confirmed\] bar/.test(c.comp) || !/Si: 0\.15 to 0\.35 1 TimkenSteel 0\.2 to 0\.35 1 Nickel Institute \[Sources differ\]/.test(c.comp) || !/Mo: 0\.15 to 0\.25 2 \[Confirmed\]/.test(c.comp) || !/P: 0\.035 max 2/.test(c.comp))
    problems.push(`[${where}] 4140 composition: ${c.comp}`);
  if (c.comp.split(' ; ').length !== 7 || !c.props || !/Material card: 4140/i.test(c.head)) problems.push(`[${where}] 4140 should have 7 elements, the property table and the card heading: ${c.comp.split(' ; ').length} ${c.props} ${c.head}`);
  if (!/^66 66 % 1 Annealed AISI 1212 = 100 % Engineers Edge ; 66 66 % 1 Annealed, cold drawn AISI 1212 = 100 % Metals Service Center Institute$/.test(c.rings)) problems.push(`[${where}] 4140 machinability rings: ${c.rings}`);
  if (c.arcs !== '62.2,62.2') problems.push(`[${where}] a 66 % ring should be drawn a third of the way round (62.2 of 188.5): ${c.arcs}`);
  c = await card('304');
  if (!/C: 0\.08 max 1 Specialty Steel Industry of North America 0\.07 max 1 Atlas Steels \[Sources differ\]/.test(c.comp) || !/Ni: 8 to 10\.5 2 \[Confirmed\]/.test(c.comp) || !/Si: 0\.75 max 1 \[Needs 2nd source\]/.test(c.comp))
    problems.push(`[${where}] 304 composition: ${c.comp}`);
  c = await card('1018');
  if (!/70 % 1 Cold drawn/.test(c.rings) || !/78 % 1 Not stated/.test(c.rings)) problems.push(`[${where}] 1018 has two ratings that must both show: ${c.rings}`);
  c = await card('12L14');
  if (!/Pb: 0\.15 to 0\.35 1 \[Needs 2nd source\]/.test(c.comp) || !/170 %/.test(c.rings)) problems.push(`[${where}] 12L14: ${c.comp} / ${c.rings}`);
  c = await card('321');
  if (!/Ti: 5x\(C\+N\) min 1 Specialty Steel Industry of North America 5x\(C\+N\) min, 0\.70 max 1 Atlas Steels \[Sources differ\]/.test(c.comp)) problems.push(`[${where}] 321 titanium rule: ${c.comp}`);
  c = await card('6082');
  if (!/No source with a composition table/.test(c.none) || c.rings) problems.push(`[${where}] 6082 has no composition yet and should say so: ${c.none.slice(0, 120)}`);
  const nComp = await page.evaluate(async () => (await (await fetch('data/materials.json')).json()).materials.filter(m => m.composition).length);
  if (nComp !== 37) problems.push(`[${where}] grades with a composition: ${nComp}`);
  await page.fill('#msearch', ''); await page.dispatchEvent('#msearch', 'input');
}
// Collet nut and pull stud torque: the maker's table by size, bore and nut, the 25 % ceiling from the core,
// the second maker beside it, and the pull stud table with every maker's figure and nothing merged.
where = 'holdertorque';
{
  await units('mm'); await open('holdertorque', 200);
  const pick = async (id, v) => { await page.selectOption(`#main #${id}`, v); await page.waitForTimeout(50); };
  const res = async () => (await page.innerText('#main #htres')).replace(/\s+/g, ' ');
  const nuts = () => page.$$eval('#main #htn option', o => o.map(x => x.value).join(','));
  await pick('htz', 'ER 16'); await pick('htn', 'std');
  let t = await res();
  if (!/Recommended torque 56 N·m 41\.3 lbf·ft REGO-FIX: ER 16, bore 5 to 10 mm, Standard nut .*printed as 56 Nm Do not go over 70 N·m 51\.6 lbf·ft recommended \+ 25 %/.test(t) || !/Techniks, for comparison 61 N·m 45 lbf·ft slotted or hex nut; printed as 45 ft\/lbs/.test(t))
    problems.push(`[${where}] ER 16, 5 to 10 mm, standard nut: ${t}`);
  await pick('htb', String(await page.$$eval('#main #htb option', o => o.find(x => /^1\.5 to 3\.5 mm/.test(x.textContent)).value)));
  t = await res();
  if (!/Recommended torque 20 N·m 14\.8 lbf·ft/.test(t) || !/Do not go over 25 N·m 18\.4 lbf·ft/.test(t)) problems.push(`[${where}] a small bore takes less torque (ER 16, 1.5 to 3.5 mm is 20 N·m): ${t}`);
  await pick('htn', 'mini'); t = await res();
  if (!/Recommended torque 24 N·m 17\.7 lbf·ft/.test(t) || !/Do not go over 30 N·m 22\.1 lbf·ft/.test(t)) problems.push(`[${where}] ER 16 mini nut, largest bore: ${t}`);
  await pick('htz', 'ER 32'); t = await res();
  if (await nuts() !== 'std' || !/Recommended torque 136 N·m 100\.3 lbf·ft/.test(t) || !/Do not go over 170 N·m 125\.4 lbf·ft/.test(t) || !/Techniks, for comparison 151\.9 N·m 112 lbf·ft/.test(t))
    problems.push(`[${where}] ER 32 has no mini nut figure and takes 136 N·m: ${await nuts()} ${t}`);
  await pick('htz', 'ER 8'); t = await res();
  if (await nuts() !== 'mini' || !/Recommended torque 6 N·m 4\.4 lbf·ft/.test(t) || !/Do not go over 7\.5 N·m 5\.5 lbf·ft/.test(t)) problems.push(`[${where}] ER 8 is printed for the mini nut only, 6 N·m: ${await nuts()} ${t}`);
  await pick('htz', 'ER 50'); t = await res();
  if (!/Recommended torque 240 N·m 177 lbf·ft/.test(t) || !/Techniks, for comparison No figure for this size/.test(t)) problems.push(`[${where}] ER 50: ${t}`);
  const all = await page.evaluate(() => ({ n: document.querySelectorAll('#htallt tr').length - 1, hit: [...document.querySelectorAll('#htallt tr.hit')].map(r => r.innerText.replace(/\s+/g, ' ')).join('|'),
    stud: [...document.querySelectorAll('#htstud tr[data-taper]')].map(r => r.innerText.replace(/\s+/g, ' ')).join(' ; ') }));
  if (all.n !== 22 || !/^ER 50 6 to 36 mm 240 N·m 177 lbf·ft not printed$/.test(all.hit)) problems.push(`[${where}] full table: ${all.n} rows, marked row: ${all.hit}`);
  if (!/40 taper 50 N·m 36\.9 lbf·ft as printed: 50 Nm, maximum 103 N·m 76 lbf·ft as printed: 76 ft-lb 61 to 74\.6 N·m 45 to 55 lbf·ft as printed: 45 to 55 ft-lb Sources differ/.test(all.stud) ||
      !/ISO 20 not printed 27\.1 N·m 20 lbf·ft as printed: 20 ft-lb not printed One source/.test(all.stud) || !/50 taper 100 N·m 73\.8 lbf·ft as printed: 100 Nm, maximum 134\.2 N·m 99 lbf·ft/.test(all.stud))
    problems.push(`[${where}] pull stud table must show each maker's figure as printed: ${all.stud}`);
  await pick('htz', 'ER 16');
  await units('inch'); await open('holdertorque', 200);
  t = await res();
  const opt = await page.$eval('#main #htb', e => e.options[e.selectedIndex].textContent);
  if (!/Recommended torque 41\.3 lbf·ft 56 N·m/.test(t) || !/Do not go over 51\.6 lbf·ft 70 N·m/.test(t) || opt !== '5 to 10 mm (0.197 to 0.394 in)') problems.push(`[${where}] inch: ${opt} / ${t}`);
}
// Gauge R&R: the example study against an independent calculation (Python, outside the core), the hand-worked
// study of the core test, the negative root that sets AV to zero, and the input errors.
where = 'grr';
{
  await units('mm'); await open('grr', 250);
  const res = async () => (await page.innerText('#main #grres')).replace(/\s+/g, ' ');
  const put = async txt => { await page.fill('#main #grtext', txt); await page.dispatchEvent('#main #grtext', 'input'); await page.waitForTimeout(60); };
  await page.click('#main #grex'); await page.waitForTimeout(120);
  let t = await res();
  if (!/10 parts, 3 appraisers, 2 trials \(60 readings\)/i.test(t) || !/Repeatability, EV R-bar 0\.00353 x K1 0\.8862 0\.00313 10\.8 %/.test(t) || !/Reproducibility, AV X-diff 0\.00720 x K2 0\.5231 0\.00370 12\.8 %/.test(t) ||
      !/Gauge R&R, GRR May be acceptable \(10 to 30 %\).* 0\.00485 16\.7 %/.test(t) || !/Part variation, PV Rp 0\.09083 x K3 0\.3146 0\.02857 98\.6 %/.test(t) || !/Total variation, TV sqrt\(GRR\^2 \+ PV\^2\) 0\.02898/.test(t) ||
      !/5 or more wanted 8 GRR against the tolerance .* 0\.02909 29\.1 %/.test(t))
    problems.push(`[${where}] example study: ${t}`);
  const bars = await page.$$eval('#main #grplot rect.bar', b => b.length);
  const avg = (await page.innerText('#main #grapp')).replace(/\s+/g, ' ');
  if (bars !== 4 || !/25\.00490 25\.00920 25\.00200 25\.00537/.test(avg)) problems.push(`[${where}] chart bars ${bars}, appraiser averages: ${avg}`);
  await page.fill('#main [data-k="tol"]', ''); await page.dispatchEvent('#main [data-k="tol"]', 'input'); await page.waitForTimeout(60);
  if (/against the tolerance/.test(await res())) problems.push(`[${where}] no tolerance entered, but a tolerance row is shown`);
  await page.selectOption('#main [data-k="ap"]', '2');
  await put('10.0 12.0 11.0\n10.2 12.1 11.3\n10.4 12.5 11.4\n10.3 12.3 11.6');
  t = await res();
  if (!/3 parts, 2 appraisers, 2 trials \(12 readings\)/i.test(t) || !/EV R-bar 0\.183 x K1 0\.8862 0\.162 15\.0 %/.test(t) || !/AV X-diff 0\.317 x K2 0\.7071 0\.214 19\.8 %/.test(t) || !/ 0\.269 24\.9 %/.test(t) ||
      !/PV Rp 2\.000 x K3 0\.5231 1\.046 96\.9 %/.test(t) || !/ 1\.080 Number of distinct categories.* wanted 5$/.test(t.trim()))
    problems.push(`[${where}] hand-worked study (2 appraisers, 2 trials, 3 parts): ${t}`);
  await put('10.0 12.0 11.0\n10.2 12.1 11.3\n10.2 12.1 11.3\n10.0 12.0 11.0');
  t = await res();
  if (!/the value under the root is negative, so AV is set to zero/.test(t) || !/AV is set to zero[^%]* 0\.000 0\.0 %/.test(t)) problems.push(`[${where}] appraisers with the same average: AV must be zero and say why: ${t}`);
  await put('10.0 12.0 11.0\n10.2 12.1\n10.4 12.5 11.4\n10.3 12.3 11.6');
  if (!/Every line needs the same number of readings.*line 2 has 2, the first has 3/.test(await res())) problems.push(`[${where}] a short line must be named: ${await res()}`);
  await put('10.0 12.0 11.0\n10.2 12.1 11.3\n10.4 12.5 11.4');
  if (!/3 lines for 2 appraisers/.test(await res())) problems.push(`[${where}] 3 lines for 2 appraisers must be refused: ${await res()}`);
  await put('10.0 12.0 abc\n10.2 12.1 11.3');
  if (!/Not a number: abc/.test(await res())) problems.push(`[${where}] a reading that is not a number must be named: ${await res()}`);
  await page.click('#main #grex'); await page.waitForTimeout(100);
}
// Thread gauge limits: the member is made to the right limit with the X tolerance on the right side, the X
// tolerance follows pitch and diameter, the published chart is shown beside (agreeing or differing), and a
// pitch with no X tolerance at that diameter says so.
where = 'threadgauge';
{
  await units('inch'); await open('threadgauge', 250);
  const pick = async (id, v) => { await page.selectOption(`#main #${id}`, v); await page.waitForTimeout(60); };
  const mrow = async k => (await page.innerText(`#main tr[data-m="${k}"]`)).replace(/\s+/g, ' ');
  const xtol = async () => (await page.innerText('#main #tgx')).replace(/\s+/g, ' ');
  await pick('tgk', '1/4-20 UNC'); await pick('tgc', '2');
  let t = [await xtol(), await mrow('plug-go'), await mrow('plug-nogo'), await mrow('ring-go'), await mrow('ring-nogo')];
  if (!/0\.0003 in 0\.0076 mm 20 threads per inch, to and including 1 1\/2 in; Thread Check Inc\., Royal Oak Gage/.test(t[0]) ||
      !/GO plug made to the smallest pitch diameter, tolerance plus 0\.2175 in 5\.5245 mm 0\.2175 in 5\.5245 mm 0\.2178 in 5\.5321 mm Chart agrees 0\.2175 in/.test(t[1]) ||
      !/NOT GO \(HI\) plug made to the largest pitch diameter, tolerance minus 0\.2223 in .* 0\.2220 in .* 0\.2223 in .* Chart differs the chart prints 0\.2224 in; the limit worked out here is 0\.2223 in/.test(t[2]) ||
      !/GO ring made to the largest pitch diameter, tolerance minus 0\.2164 in .* 0\.2161 in .* 0\.2164 in .* Chart agrees 0\.2164 in/.test(t[3]) ||
      !/NOT GO \(LO\) ring made to the smallest pitch diameter, tolerance plus 0\.2127 in .* 0\.2127 in .* 0\.2130 in .* Chart agrees 0\.2127 in/.test(t[4]))
    problems.push(`[${where}] 1/4-20 UNC class 2: ${t.join(' | ')}`);
  const zones = await page.evaluate(() => [document.querySelectorAll('#tgplot rect.bar').length, document.querySelectorAll('#tgplot rect.tgz').length, document.querySelectorAll('#tgplot rect.tgn').length].join(','));
  if (zones !== '2,2,2') problems.push(`[${where}] the drawing should show two thread zones with a GO and a NOT GO zone each: ${zones}`);
  await pick('tgc', '3');
  t = [await mrow('plug-nogo'), await mrow('ring-nogo')];
  if (!/tolerance minus 0\.2211 in .* 0\.2208 in .* 0\.2211 in .* Chart agrees 0\.2211 in/.test(t[0]) || !/tolerance plus 0\.2147 in .* 0\.2147 in .* 0\.2150 in .* Chart agrees 0\.2147 in/.test(t[1])) problems.push(`[${where}] 1/4-20 UNC class 3: ${t.join(' | ')}`);
  await pick('tgk', '1-8 UNC'); await pick('tgc', '2');
  t = [await xtol(), await mrow('plug-go'), await mrow('plug-nogo')];
  if (!/0\.0004 in 0\.0102 mm 8 threads per inch, to and including 1 1\/2 in/.test(t[0]) || !/0\.9188 in .* 0\.9188 in .* 0\.9192 in .* Chart agrees/.test(t[1]) || !/0\.9276 in .* 0\.9272 in .* 0\.9276 in .* Chart agrees 0\.9276 in/.test(t[2])) problems.push(`[${where}] 1-8 UNC takes 0.0004 in: ${t.join(' | ')}`);
  await pick('tgk', '2-4.5 UNC');
  t = [await xtol(), await mrow('plug-go')];
  if (!/0\.0005 in 0\.0127 mm 4\.5 threads per inch, above 1 1\/2 in to 4 in/.test(t[0]) || !/size not in the chart/.test(t[1])) problems.push(`[${where}] 2-4.5 UNC is in the second diameter range and not in the chart: ${t.join(' | ')}`);
  await pick('tgk', '1-1/2-6 UNC');
  if (!/0\.0004 in .* 6 threads per inch, to and including 1 1\/2 in/.test(await xtol())) problems.push(`[${where}] 1 1/2 in is still in the first range: ${await xtol()}`);
  await units('mm'); await open('threadgauge', 250);
  await pick('tgk', '1/4-20 UNC');
  t = await mrow('plug-go');
  if (!/5\.5245 mm 0\.2175 in 5\.5245 mm 0\.2175 in 5\.5321 mm 0\.2178 in/.test(t)) problems.push(`[${where}] mm first in metric mode: ${t}`);
}
// Wire EDM: kerf, offsets and corner radius against the handbook's figures, the taper both ways, and cut time
// from the rate in both unit systems.
where = 'wireedm';
{
  const rows = async () => (await page.$$eval('#main #res .rrow', r => r.map(t => t.innerText.replace(/\s+/g, ' ').trim()))).join(' | ');
  const put = async (k, v) => { await page.fill(`#main [data-id="${k}"]`, v); await page.dispatchEvent(`#main [data-id="${k}"]`, 'input'); await page.waitForTimeout(40); };
  await units('mm'); await open('edmoffset', 150);
  let t = await rows();
  if (!/Kerf of the first cut 0\.350 mm/i.test(t) || !/Wire offset, first cut 0\.175 mm/i.test(t) || !/Smallest inside corner radius 0\.175 mm/i.test(t)) problems.push(`[${where}] 0.25 mm wire, 0.05 mm gap: ${t}`);
  await put('st', '0.03'); t = await rows();
  if (!/first cut \(with the stock left on\) 0\.205 mm/i.test(t) || !/enter the spark gap of the final skim cut/i.test(t)) problems.push(`[${where}] stock left on with no skim gap: ${t}`);
  await put('gf', '0.008'); t = await rows();
  if (!/Wire offset, final skim cut 0\.133 mm/i.test(t) || !/Smallest inside corner radius \(after the final skim\) 0\.133 mm/i.test(t) || /Note/i.test(t)) problems.push(`[${where}] with a final skim: ${t}`);
  const dia = await page.$eval('#main .tdia svg', g => g.textContent.replace(/\s+/g, ' '));
  if (!/offset 0\.205 mm/.test(dia) || !/stock 0\.03 mm per side/.test(dia) || !/radius 0\.133 mm/.test(dia)) problems.push(`[${where}] offset drawing: ${dia}`);
  await units('inch'); await open('edmoffset', 150);
  await put('d', '0.012'); await put('gf', '0.0003'); t = await rows();
  if (!/Kerf of the first cut 0\.0160 in/i.test(t) || !/after the final skim\) 0\.0063 in/i.test(t)) problems.push(`[${where}] handbook figures for 0.012 in wire (kerf 0.016, radius 0.0063): ${t}`);
  await put('g', '0.02'); t = await rows();
  if (!/gap entered is larger than the wire diameter/i.test(t)) problems.push(`[${where}] a gap larger than the wire must be questioned: ${t}`);

  await units('mm'); await open('edmtaper', 150);
  await put('zg', '200'); t = await rows();
  if (!/per side 0\.655 mm/i.test(t) || !/\(both sides\) 1\.309 mm/i.test(t) || !/upper and lower guide 5\.237 mm/i.test(t)) problems.push(`[${where}] 1.5 degrees over 25 mm, guides 200 mm apart: ${t}`);
  await put('a', '50'); t = await rows();
  if (!/angles up to 45 degrees/i.test(t)) problems.push(`[${where}] above 45 degrees needs the note: ${t}`);
  await put('a', '90'); t = await rows();
  if (!/Enter an angle from 0 to less than 90 degrees/i.test(t)) problems.push(`[${where}] 90 degrees must be refused: ${t}`);
  await page.selectOption('#main [data-id="find"]', '2'); await page.waitForTimeout(80);
  await put('land', '25'); t = await rows();
  if (!/Taper angle per side 45(\.000)? deg/i.test(t) || !/\(both sides\) 50(\.000)? mm/i.test(t)) problems.push(`[${where}] 25 mm sideways over 25 mm is 45 degrees: ${t}`);
  await page.selectOption('#main [data-id="find"]', '1');

  await units('inch'); await open('edmtime', 150);
  t = await rows();
  if (!/Area of one pass 26(\.00)? in2/i.test(t) || !/Enter the cutting rate/i.test(t) || /Total/i.test(t)) problems.push(`[${where}] no rate entered: ${t}`);
  await put('h', '10'); await put('rate', '3'); t = await rows();
  if (!/Area of one pass 130(\.00)? in2/i.test(t) || !/Time, first cut 2,?600(\.0)? min/i.test(t) || !/first cut 0\.0050 in\/min/i.test(t) || !/Total cutting time 43\.33 h/i.test(t)) problems.push(`[${where}] 13 in through 10 in at 3 in2/h: ${t}`);
  await page.selectOption('#main [data-id="n"]', '2'); await page.waitForTimeout(80); t = await rows();
  if (!/Enter the cutting rate of the skim cuts/i.test(t) || /Total/i.test(t)) problems.push(`[${where}] skims with no rate must not give a total: ${t}`);
  await put('srate', '8'); t = await rows();
  if (!/Time, 2 skim cuts 1,?950(\.0)? min/i.test(t) || !/Total cutting time 4,?550(\.0)? min/i.test(t) || !/Total cutting time 75\.83 h/i.test(t)) problems.push(`[${where}] two skims at 8 in2/h: ${t}`);
  await page.selectOption('#main [data-id="n"]', '0');
  await units('mm'); await open('edmtime', 150);
  await put('rate', '120'); t = await rows();
  if (!/Area of one pass 16,?500 mm2/i.test(t) || !/Time, first cut 137\.5 min/i.test(t) || !/first cut 2\.40? mm\/min/i.test(t) || !/Total cutting time 2\.29 h/i.test(t)) problems.push(`[${where}] 330 mm through 50 mm at 120 mm2/min: ${t}`);
}
// Rolled thread blank: the maker's rule on the core's maximum pitch diameter, the handbook rows for the size,
// the correction after a trial, and the hole check on the tap drill page.
where = 'rollblank';
{
  const txt = async id => (await page.innerText('#main #' + id)).replace(/\s+/g, ' ');
  const pick = async (id, v) => { await page.selectOption('#main #' + id, v); await page.waitForTimeout(80); };
  const meas = async v => { await page.fill('#main #rbm', v); await page.dispatchEvent('#main #rbm', 'input'); await page.waitForTimeout(60); };
  await units('mm'); await open('rollblank', 250);
  await pick('rbk', 'M10x1.5'); await pick('rbc', '6g');
  let t = await txt('rbmain');
  if (!/Blank for M10 x 1\.5 \(coarse\) 6g Blank diameter before rolling 8\.943 mm 0\.3521 in maximum pitch diameter less 0\.051 mm; CJWinter/i.test(t) || !/Pitch diameter, maximum 8\.994 mm/.test(t) || !/Major diameter after rolling, minimum 9\.732 mm/.test(t))
    problems.push(`[${where}] M10 x 1.5 6g: ${t}`);
  t = await txt('rbhb');
  if (!/1\/4 to 1\/2 in larger by 0\.0020 to 0\.0025 in \(0\.051 to 0\.064 mm\) not stated 1\/4 to 1\/2 in less by 0\.0020 to 0\.0030 in/.test(t) || /1\/2 to 1 in/.test(t)) problems.push(`[${where}] handbook rows for M10: ${t}`);
  if (await page.$('#main #rbtrial')) problems.push(`[${where}] no trial entered, but a trial block is shown`);
  const plot = await page.$eval('#main #rbplot svg', g => g.textContent.replace(/\s+/g, ' '));
  if (!/blank 8\.943/.test(plot) || !/8\.862/.test(plot) || !/9\.968/.test(plot)) problems.push(`[${where}] drawing: ${plot}`);
  await meas('9.80'); t = await txt('rbtrial');
  if (!/Major diameter measured 9\.800 mm 0\.3858 in Inside the limits Change the blank by \+0\.017 mm/.test(t) || !/next trial 8\.959 mm/.test(t)) problems.push(`[${where}] trial at 9.80 mm: ${t}`);
  await meas('10.1'); t = await txt('rbtrial');
  if (!/Above the maximum Change the blank by −0\.083 mm/.test(t) || !/next trial 8\.859 mm/.test(t)) problems.push(`[${where}] trial at 10.1 mm: ${t}`);
  await meas('');
  await pick('rbc', '6h'); t = await txt('rbmain');
  if (!/6h Blank diameter before rolling 8\.975 mm/i.test(t)) problems.push(`[${where}] M10 x 1.5 6h: ${t}`);
  await pick('rbc', '6g');
  await units('inch'); await open('rollblank', 250);
  await pick('rbk', '1/4-20 UNC'); await pick('rbc', '2'); t = await txt('rbmain');
  if (!/1\/4-20 UNC-2A Blank diameter before rolling 0\.2144 in 5\.446 mm maximum pitch diameter less 0\.002 in/i.test(t) || !/Pitch diameter, maximum 0\.2164 in/.test(t)) problems.push(`[${where}] 1/4-20 UNC-2A: ${t}`);
  await pick('rbc', '3'); t = await txt('rbmain');
  if (!/UNC-3A Blank diameter before rolling 0\.2155 in/i.test(t)) problems.push(`[${where}] 1/4-20 UNC-3A: ${t}`);
  await pick('rbc', '2');
  await pick('rbk', '#4-40 UNC'); t = await txt('rbhb');
  if (!/smaller than 1\/4 in less by 0\.0010 to 0\.0015 in .* ordinary grades of work/.test(t) || /larger by/.test(t)) problems.push(`[${where}] handbook row below 1/4 in: ${t}`);
  await pick('rbk', '1-8 UNC'); t = await txt('rbhb');
  if (!/1\/2 to 1 in or larger larger by 0\.0025 to 0\.0030 in .* above 1\/2 in less by 0\.0030 to 0\.0050 in/.test(t) || /1\/4 to 1\/2/.test(t)) problems.push(`[${where}] handbook rows above 1/2 in: ${t}`);
  await pick('rbk', '1/4-20 UNC');

  await units('mm'); await open('tapdrill', 250);
  await pick('tk', 'M10x1.5');
  const hole = async v => { await page.fill('#main #thm', v); await page.dispatchEvent('#main #thm', 'input'); await page.waitForTimeout(60); };
  if (await page.$('#main #thole')) problems.push(`[${where}] tap drill: no hole entered, but a hole block is shown`);
  await hole('8.5'); t = await txt('thole');
  if (!/Your hole of 8\.500 mm 0\.3346 in: thread engagement Cutting tap .* 77\.0 % Forming tap/i.test(t)) problems.push(`[${where}] tap drill, 8.5 mm hole in M10 x 1.5 (cutting tap 77.0 %): ${t}`);
  await hole('8.7'); t = await txt('thole');
  if (!/Cutting tap .* 66\.7 % Forming tap .* 127\.5 % over 100 %/i.test(t)) problems.push(`[${where}] tap drill, 8.7 mm hole: ${t}`);
  await hole('10.2'); t = await txt('thole');
  if (!/none larger than the thread: no engagement/i.test(t)) problems.push(`[${where}] tap drill, a hole larger than the thread: ${t}`);
  await hole('');
}
// CNC guide: drilling, tapping and grinding troubleshooting tables, each row with its source keys; a row with
// one publisher is marked to be verified, a row with two is not.
where = 'trouble';
{
  await open('cncguide', 150);
  const tabs = await page.evaluate(() => ['c-trd', 'c-trtap', 'c-trg'].map(id => {
    const h = document.querySelector('#main #' + id); let t = h && h.nextElementSibling;
    while (t && !t.querySelector('table.gtab')) t = t.nextElementSibling;
    const rows = t ? [...t.querySelectorAll('tr')].slice(1) : [];
    return { n: rows.length, noSrc: rows.filter(r => !r.querySelector('abbr.gsrc')).length,
      rows: rows.map(r => r.cells[0].innerText.trim() + '|' + [...r.querySelectorAll('abbr.gsrc')].map(a => a.textContent).join(',') + '|' + (r.querySelector('.gtbv') ? 'tbv' : 'ok')) };
  }));
  if (tabs[0].n !== 10 || tabs[1].n !== 8 || tabs[2].n !== 8 || tabs.some(t => t.noSrc)) problems.push(`[${where}] drilling, tapping, grinding tables should have 10, 8 and 8 rows, each with a source: ${tabs.map(t => t.n + '/' + t.noSrc).join(' ')}`);
  const has = (i, row) => tabs[i].rows.includes(row);
  if (!has(0, 'Hole oversize|MMC68,PTD,FMC_D|ok') || !has(0, 'Burrs where the drill comes out|MMC68|tbv') || !has(1, 'Thread oversize|FMC_T,REGAL|ok') || !has(1, 'Bell-mouthed thread (larger at the start)|FMC_T|tbv') ||
      !has(2, 'Chatter marks|RADIAC,OKUMA_G|ok') || !has(2, 'Wheel loads or glazes|RADIAC|tbv'))
    problems.push(`[${where}] source keys or the to-be-verified mark are wrong: ${tabs.map(t => t.rows.join(' ; ')).join(' || ')}`);
  const toc = await page.$$eval('#main nav.gtoc a', a => a.map(x => x.getAttribute('href')).join(' '));
  if (!/#c-trd #c-trtap #c-trg/.test(toc)) problems.push(`[${where}] the contents list should link the three new tables: ${toc}`);
}
// SAE parallel side splines: the handbook's printed sizes for 6A at 1.5 in and 10C at 2 in, the torque over a
// bearing length, no fit C for 4 splines, the note outside the tabulated range, and the drawing's own figures.
where = 'saespline';
{
  const rows = async () => (await page.$$eval('#main #res .rrow', r => r.map(t => t.innerText.replace(/\s+/g, ' ').trim()))).join(' | ');
  const put = async (k, v) => { await page.fill(`#main [data-id="${k}"]`, v); await page.dispatchEvent(`#main [data-id="${k}"]`, 'input'); await page.waitForTimeout(40); };
  const pick = async (k, v) => { await page.selectOption(`#main [data-id="${k}"]`, v); await page.waitForTimeout(60); };
  await mode('expert');
  await units('inch'); await open('saespline', 150);
  await pick('n', '6'); await pick('fit', '1'); await put('D', '1.5'); await put('len', '');
  let t = await rows();
  if (!/Width of spline W 0\.375 in/i.test(t) || !/Depth of spline h 0\.075 in/i.test(t) || !/Small diameter d 1\.350 in/i.test(t) || !/at 1000 psi on the sides 321 in lbf/i.test(t) || /Note/i.test(t) || /bearing length/i.test(t))
    problems.push(`[${where}] 6 splines, fit A, 1.5 in (W 0.375, h 0.075, d 1.350, T 321): ${t}`);
  let dia = await page.$eval('#main .tdia svg', g => g.textContent.replace(/\s+/g, ' '));
  if (!/W 0\.375/.test(dia) || !/D 1\.5 in/.test(dia) || !/d 1\.35 in/.test(dia) || !/6 splines/.test(dia) || !/T 321 in lbf/.test(dia)) problems.push(`[${where}] drawing, 6A at 1.5 in: ${dia}`);
  await pick('n', '10'); await pick('fit', '3'); await put('D', '2'); await put('len', '2'); t = await rows();
  if (!/Width of spline W 0\.312 in/i.test(t) || !/Small diameter d 1\.620 in/i.test(t) || !/on the sides 1,?720 in lbf/i.test(t) || !/over the bearing length, at 1000 psi 3,?439 in lbf/i.test(t))
    problems.push(`[${where}] 10 splines, fit C, 2 in, 2 in long (W 0.312, d 1.620, T 1720 from 1719.5, 3439 over the length): ${t}`);
  await pick('n', '4'); t = await rows();
  if (!/no fit C \(to slide under load\) for 4 splines/i.test(t) || /Width of spline/i.test(t)) problems.push(`[${where}] 4 splines with fit C must be refused: ${t}`);
  await pick('fit', '2'); await put('D', '1'); await put('len', ''); t = await rows();
  if (!/Width of spline W 0\.241 in/i.test(t) || !/Depth of spline h 0\.125 in/i.test(t) || !/Small diameter d 0\.750 in/i.test(t) || !/on the sides 219 in lbf/i.test(t)) problems.push(`[${where}] 4 splines, fit B, 1 in (W 0.241, h 0.125, d 0.750, T 219): ${t}`);
  await units('mm'); await open('saespline', 150);
  await pick('n', '16'); await pick('fit', '1'); await put('D', '38.1'); await put('len', ''); t = await rows();
  if (!/Width of spline W 3\.73 mm/i.test(t) || !/Small diameter d 34\.67 mm/i.test(t) || !/on the sides 87\.4 N m/i.test(t) || !/16-spline fittings from 2 to 6 in nominal diameter\. This size is outside that range/i.test(t))
    problems.push(`[${where}] 16 splines, fit A, 38.1 mm (W 3.73, d 34.67, 87.4 N m, range note): ${t}`);
  await put('D', '76.2'); t = await rows();
  if (/Note/i.test(t) || !/Small diameter d 69\.34 mm/i.test(t)) problems.push(`[${where}] 16 splines at 76.2 mm is inside the tabulated range: ${t}`);
  dia = await page.$eval('#main .tdia svg', g => g.textContent.replace(/\s+/g, ' '));
  if (!/16 splines/.test(dia) || !/D 76\.2 mm/.test(dia) || !/d 69\.34 mm/.test(dia)) problems.push(`[${where}] drawing, 16A at 76.2 mm: ${dia}`);
  await pick('n', '6'); await put('D', '38.1');
  await units('inch'); await open('saespline', 80);
  await pick('n', '6'); await pick('fit', '1'); await put('D', '1.5');
  await mode('advanced');
}
// Prefixes and symbols page (24 prefixes, 7 constants, 24 Greek letters, all confirmed by two publishers), and the
// unit converter's acceleration, rotational speed and viscosity against NIST SP 811 factors.
where = 'symbols';
{
  await units('mm'); await open('symbols', 250);
  const tab = async id => page.$$eval('#main #' + id + ' tr', r => r.slice(1).map(t => t.innerText.replace(/\s+/g, ' ').trim()));
  let r = await tab('sympre');
  if (r.length !== 24 || !/^quetta Q 1030 Confirmed BIPM, NIST$/.test(r[0]) || !r.includes('deca or deka da 101 Confirmed BIPM, NIST') || !r.includes('micro µ 10−6 Confirmed BIPM, NIST') || r.some(x => !/Confirmed/.test(x)))
    problems.push(`[${where}] SI prefixes: ${r.length} rows: ${r.join(' ; ')}`);
  r = await tab('symcon');
  if (r.length !== 7 || !r.some(x => /Speed of light in vacuum c 299 792 458 m\/s Confirmed BIPM, NIST/.test(x)) || !r.some(x => /Planck constant h 6\.626 070 15 × 10−34 J s Confirmed/.test(x))) problems.push(`[${where}] defining constants: ${r.join(' ; ')}`);
  r = await tab('symgrk');
  if (r.length !== 24 || !r.some(x => /^kappa Κ κ κ: entering angle of a cutting edge Confirmed$/.test(x)) || !r.some(x => /^omicron Ο ο not used Confirmed$/.test(x))) problems.push(`[${where}] Greek alphabet: ${r.length} rows: ${r.join(' ; ')}`);

  await open('units', 150);
  const conv = async (qname, from, x) => {
    await page.selectOption('#main [data-k="q"]', { label: qname }); await page.waitForTimeout(60);
    await page.selectOption('#main [data-k="from"]', String(from)); await page.waitForTimeout(40);
    await page.fill('#main [data-k="x"]', x); await page.dispatchEvent('#main [data-k="x"]', 'input'); await page.waitForTimeout(60);
    return (await page.innerText('#main #ures')).replace(/\s+/g, ' ');
  };
  let t = await conv('Acceleration', 2, '1');
  if (!/metre per second squared 9\.80665 m\/s²/.test(t) || !/foot per second squared 32\.17404856 ft\/s²/.test(t)) problems.push(`[${where}] 1 g in m/s² and ft/s²: ${t}`);
  t = await conv('Rotational speed', 1, '1000');
  if (!/radian per second 104\.7197551 rad\/s/.test(t) || !/degree per second 6,000 °\/s/.test(t)) problems.push(`[${where}] 1000 rpm: ${t}`);
  t = await conv('Viscosity, dynamic', 1, '100');
  if (!/pascal second 0\.1 Pa·s/.test(t) || !/poise 1 P/.test(t) || !/per square foot 0\.0020885434 lbf·s\/ft²/.test(t)) problems.push(`[${where}] 100 cP: ${t}`);
  t = await conv('Viscosity, kinematic', 1, '32');
  if (!/square metre per second 3\.200000e-5 m²\/s/.test(t) || !/stokes 0\.32 St/.test(t)) problems.push(`[${where}] 32 cSt: ${t}`);
  await conv('Length', 1, '');
}
// Compression spring (the AMES example and the makers' modulus), belt drive (Omni's two examples, the centre distance
// back from the length) and roller chain drive (even number of pitches, centre distance for it, pitch diameters, notes).
where = 'spring';
{
  const rows = async () => (await page.$$eval('#main #res .rrow', r => r.map(t => t.innerText.replace(/\s+/g, ' ').trim()))).join(' | ');
  const put = async (k, v) => { await page.fill(`#main [data-id="${k}"]`, v); await page.dispatchEvent(`#main [data-id="${k}"]`, 'input'); await page.waitForTimeout(40); };
  const pick = async (k, v) => { await page.selectOption(`#main [data-id="${k}"]`, v); await page.waitForTimeout(60); };
  const dia = async () => page.$eval('#main .tdia svg', g => g.textContent.replace(/\s+/g, ' '));
  await units('inch'); await open('spring', 150);
  await put('d', '0.08'); await put('od', '0.625'); await put('na', '22'); await pick('end', '3'); await pick('mat', '1'); await put('lf', '4'); await put('f', ''); await put('lw', '');
  let t = await rows();
  if (!/Spring rate k 16\.53 lbf\/in/i.test(t) || !/Mean diameter D 0\.545 in/i.test(t) || !/Spring index C = D \/ d 6\.81/i.test(t) || !/Kw 1\.219/i.test(t) || !/G used 11,500,000 psi/i.test(t) || !/Total coils 24\.0/i.test(t) ||
      !/Solid length 1\.920 in/i.test(t) || !/Pitch of the coils 0\.175 in/i.test(t) || !/Travel from free to solid 2\.080 in/i.test(t) || !/Load at solid 34\.39 lbf/i.test(t)) problems.push(`[${where}] music wire spring, makers' modulus: ${t}`);
  let d = await dia();
  if (!/free length 4 in/.test(d) || !/solid 1\.92 in/.test(d) || !/OD 0\.625/.test(d) || !/24 coils in all/.test(d) || !/rate 16\.53 lbf\/in/.test(d)) problems.push(`[${where}] spring drawing: ${d}`);
  await pick('mat', '0'); await put('g', '11750000'); await put('f', '7'); t = await rows();
  if (!/Spring rate k 16\.89 lbf\/in/i.test(t) || !/Shear stress at the load \(with Kw\) 23,13\d psi/i.test(t) || !/Length under the load 3\.586 in/i.test(t)) problems.push(`[${where}] the published example (k 16.89, 23.14 ksi at 7 lbf): ${t}`);
  await put('f', '40'); t = await rows();
  if (!/goes solid before it carries this load/i.test(t)) problems.push(`[${where}] a load beyond solid must be said: ${t}`);
  await put('f', ''); await put('lw', '3'); t = await rows();
  if (!/Load at the length under load 16\.89 lbf/i.test(t)) problems.push(`[${where}] load at 3 in (1 in of travel = the rate): ${t}`);
  await put('lw', '1.5'); t = await rows();
  if (!/shorter than the solid length/i.test(t)) problems.push(`[${where}] a length under solid must be refused: ${t}`);
  await put('lw', ''); await pick('end', '2'); t = await rows();
  if (!/Solid length 2\.000 in/i.test(t) || !/Pitch of the coils 0\.171 in/i.test(t)) problems.push(`[${where}] closed ends not ground (solid d(Nt+1) = 2.000, pitch (4 - 0.24)/22): ${t}`);
  await pick('end', '0'); t = await rows();
  if (!/Total coils 22\.0/i.test(t) || !/Solid length 1\.840 in/i.test(t)) problems.push(`[${where}] plain ends: ${t}`);
  await pick('end', '3'); await pick('mat', '1'); await put('od', '0.15'); t = await rows();
  if (!/must be more than twice the wire diameter/i.test(t)) problems.push(`[${where}] an outside diameter under 2 d must be refused: ${t}`);
  await put('od', '0.3'); t = await rows();
  if (!/Spring index below 3/i.test(t)) problems.push(`[${where}] spring index 2.75 should be noted: ${t}`);
  await put('od', '0.625');
  await units('mm'); await open('spring', 150);
  await put('d', '2'); await put('od', '16'); await put('na', '10'); await pick('end', '3'); await pick('mat', '1'); await put('lf', ''); t = await rows();
  if (!/Spring rate k 5\.779 N\/mm/i.test(t) || !/G used 79,290 MPa/i.test(t) || !/Solid length 24\.00 mm/i.test(t)) problems.push(`[${where}] 2 mm wire, 16 mm outside, 10 coils: ${t}`);

  await units('mm'); await open('beltdrive', 150);
  await put('d1', '150'); await put('d2', '300'); await pick('find', '0'); await put('c', '1500'); await put('n', ''); t = await rows();
  if (!/Belt length 3,710\.6 mm/i.test(t) || !/By the short formula 3,710\.6 mm/i.test(t) || !/Speed ratio \(driving speed \/ driven speed\) 2\.000 : 1/i.test(t) || !/Wrap on the small pulley 174\.3 °/i.test(t) || !/Wrap on the large pulley 185\.7 °/i.test(t)) problems.push(`[${where}] belt, 150 and 300 mm at 1500 mm (3.71 m): ${t}`);
  await put('n', '1450'); t = await rows();
  if (!/Driven speed 725 RPM/i.test(t) || !/Belt speed 11\.4 m\/s/i.test(t)) problems.push(`[${where}] belt speeds at 1450 rpm: ${t}`);
  await pick('find', '1'); await put('len', '3710.6'); t = await rows();
  if (!/Centre distance 1,500\.0 mm/i.test(t)) problems.push(`[${where}] centre distance back from the belt length: ${t}`);
  d = await dia();
  if (!/centres 1500 mm/.test(d) || !/driving 150/.test(d) || !/driven 300/.test(d) || !/wrap on the small wheel 174\.3°/.test(d)) problems.push(`[${where}] belt drawing: ${d}`);
  await put('len', '600'); t = await rows();
  if (!/too short to go round both pulleys/i.test(t)) problems.push(`[${where}] a belt that is too short: ${t}`);
  await put('len', '3710'); await pick('find', '0'); await put('c', '200'); t = await rows();
  if (!/the pulleys would touch/i.test(t)) problems.push(`[${where}] pulleys that overlap: ${t}`);
  await put('c', '1500'); await put('n', '');
  await units('inch'); await open('beltdrive', 150);
  await put('d1', '6'); await put('d2', '20'); await pick('find', '0'); await put('c', '56'); t = await rows();
  if (!/Belt length 153\.72 in/i.test(t) || !/By the short formula 153\.72 in/i.test(t)) problems.push(`[${where}] belt, 6 and 20 in at 56 in (153.72 in): ${t}`);

  await open('chaindrive', 150);
  await pick('no', '40'); await put('n1', '17'); await put('n2', '51'); await put('c', '20'); await put('n', ''); t = await rows();
  if (!/Chain length, even number of pitches 116 pitches/i.test(t) || !/as calculated 114\.73 pitches/i.test(t) || !/Chain pitch 0\.500 in/i.test(t) || !/Centre distance for the even length 20\.320 in/i.test(t) || !/in pitches 40\.0 pitches/i.test(t) ||
      !/driving sprocket 2\.721 in/i.test(t) || !/driven sprocket 8\.122 in/i.test(t) || !/3\.000 : 1/i.test(t) || !/Wrap on the small sprocket 164\.7 °/i.test(t) || /Note/i.test(t)) problems.push(`[${where}] No. 40 chain, 17 and 51 teeth, 20 in centres: ${t}`);
  d = await dia();
  if (!/centres 20\.32 in/.test(d) || !/chain 116 pitches/.test(d)) problems.push(`[${where}] chain drawing: ${d}`);
  await put('n', '900'); t = await rows();
  if (!/Driven speed 300 RPM/i.test(t)) problems.push(`[${where}] driven sprocket speed: ${t}`);
  await put('n', ''); await put('c', '8'); t = await rows();
  if (!/16\.0 pitches: two sources recommend 30 to 50 pitches/i.test(t) || /under 120°/i.test(t)) problems.push(`[${where}] a short centre distance should be noted: ${t}`);
  await put('n1', '11'); await put('n2', '80'); await put('c', '10'); t = await rows();
  if (!/Wrap on the small sprocket 114\.6 °/i.test(t) || !/under 120°/i.test(t) || !/more than 15 teeth on the small sprocket/i.test(t)) problems.push(`[${where}] 11 and 80 teeth close together: wrap and tooth notes: ${t}`);
  await put('n1', '17'); await put('n2', '51');
  await put('c', '4'); t = await rows();
  if (!/the sprockets would touch/i.test(t)) problems.push(`[${where}] sprockets that overlap: ${t}`);
  await put('c', '20'); await pick('no', '100'); t = await rows();
  if (!/Chain pitch 1\.250 in/i.test(t)) problems.push(`[${where}] No. 100 chain is 1 1/4 in pitch: ${t}`);
  await pick('no', '40');
  await units('mm'); await open('chaindrive', 150);
  await pick('no', '40'); await put('n1', '17'); await put('n2', '51'); await put('c', '508'); t = await rows();
  if (!/Chain pitch 12\.700 mm/i.test(t) || !/even number of pitches 116 pitches/i.test(t) || !/Centre distance for the even length 516\.12 mm/i.test(t)) problems.push(`[${where}] the same chain drive in mm: ${t}`);
  await put('c', '500');
}
// Jarno tapers follow N/8, N/10, N/2 and are confirmed by two tables; Brown & Sharpe sizes where the two publishers
// print different lengths show both.
// Sheet metal and wire gauges: each value as two publishers print it, differences shown, AWG from the core's rule.
where = 'gauges';
{
  const rows = async () => page.$$eval('#main #gres tr', t => t.slice(1).map(x => x.innerText.replace(/\s+/g, ' ').trim()));
  const row = (r, g) => r.find(x => x.startsWith(g + ' ')) || '';
  await units('inch'); await open('gauges', 250);
  await page.selectOption('#main #gf', 'sheet'); await page.waitForTimeout(80);
  let r = await rows();
  if (r.length !== 45 || !/^10 0\.1345 in 3\.416 mm Confirmed 0\.1382 in 3\.510 mm Confirmed 0\.1406 in 3\.571 mm Confirmed 0\.1019 in 2\.588 mm Confirmed 0\.1406 in 3\.571 mm Confirmed$/.test(row(r, '10')))
    problems.push(`[${where}] sheet gauges: ${r.length} rows; No. 10: ${row(r, '10')}`);
  if (!/0\.1563 in 3\.970 mm Sources differ also 0\.1562 0\.1144 in/.test(row(r, '9'))) problems.push(`[${where}] stainless No. 9 (5/32 in rounded two ways) must show both: ${row(r, '9')}`);
  if (!/Sources differ also 0\.0641/.test(row(r, '14')) || !/Sources differ also 0\.0159/.test(row(r, '26'))) problems.push(`[${where}] aluminium No. 14 and 26 must show both printings: ${row(r, '14')} ; ${row(r, '26')}`);
  if (!/^7\/0 - - - - 0\.5000 in 12\.700 mm Confirmed$/.test(row(r, '7/0')) || !/^38 0\.0060 in 0\.152 mm Confirmed - 0\.0062 in 0\.157 mm One source/.test(row(r, '38'))) problems.push(`[${where}] ends of the sheet table: ${row(r, '7/0')} ; ${row(r, '38')}`);
  if (!/A gauge number is not one thickness/.test(await page.innerText('#main #gnote'))) problems.push(`[${where}] the sheet gauge note is missing`);
  await page.selectOption('#main #gf', 'wire'); await page.waitForTimeout(80);
  r = await rows();
  if (r.length !== 57 || !/^10 0\.1019 in 2\.588 mm by the rule 0\.1280 in 3\.251 mm Confirmed 0\.1340 in 3\.404 mm Confirmed$/.test(row(r, '10')))
    problems.push(`[${where}] wire gauges: ${r.length} rows; No. 10: ${row(r, '10')}`);
  if (!/^4\/0 0\.4600 in 11\.684 mm by the rule 0\.4000 in 10\.160 mm Confirmed 0\.4540 in 11\.532 mm One source$/.test(row(r, '4/0')) || !/^36 0\.0050 in 0\.127 mm by the rule 0\.0076 in/.test(row(r, '36')))
    problems.push(`[${where}] the two defined AWG sizes (4/0 = 0.46 in, No. 36 = 0.005 in): ${row(r, '4/0')} ; ${row(r, '36')}`);
  if (!/^7\/0 - 0\.5000 in 12\.700 mm Confirmed -$/.test(row(r, '7/0')) || !/^50 - 0\.0010 in 0\.025 mm Confirmed -$/.test(row(r, '50')) || !/^40 0\.0031 in 0\.080 mm by the rule/.test(row(r, '40')) || !/^41 - /.test(row(r, '41')))
    problems.push(`[${where}] ends of the wire table: ${row(r, '7/0')} ; ${row(r, '40')} ; ${row(r, '41')} ; ${row(r, '50')}`);
  await units('mm'); await open('gauges', 200); r = await rows();
  if (!/^16 1\.291 mm 0\.0508 in by the rule 1\.626 mm 0\.0640 in Confirmed 1\.651 mm 0\.0650 in Confirmed$/.test(row(r, '16'))) problems.push(`[${where}] No. 16 wire in mm: ${row(r, '16')}`);
  await page.selectOption('#main #gf', 'sheet'); await page.waitForTimeout(60);
  await units('inch');
}
// Taper pins (inch series) and the involute cutter number on the spur gear page.
where = 'taperpin';
{
  const rows = async () => (await page.$$eval('#main #res .rrow', r => r.map(t => t.innerText.replace(/\s+/g, ' ').trim()))).join(' | ');
  const pick = async (k, v) => { await page.selectOption(`#main [data-id="${k}"]`, v); await page.waitForTimeout(60); };
  const put = async (k, v) => { await page.fill(`#main [data-id="${k}"]`, v); await page.dispatchEvent(`#main [data-id="${k}"]`, 'input'); await page.waitForTimeout(40); };
  await units('inch'); await mode('expert'); await open('taperpin', 150);
  await pick('no', '4'); await put('l', '2');
  let t = await rows();
  if (!/Small end diameter at this length 0\.2083 in/i.test(t) || !/Large end diameter \(basic\) 0\.2500 in/.test(t) || !/commercial class, largest 0\.2513 in/.test(t) || !/commercial class, smallest 0\.2493 in/.test(t) ||
      !/precision class, largest 0\.2510 in/.test(t) || !/Included angle 1\.1936 deg/.test(t)) problems.push(`[${where}] No. 4 pin, 2 in long: ${t}`);
  const d = await page.$eval('#main .tdia svg', g => g.textContent.replace(/\s+/g, ' '));
  if (!/D 0\.25/.test(d) || !/d 0\.2083/.test(d) || !/length 2 in/.test(d)) problems.push(`[${where}] drawing: ${d}`);
  await pick('no', '-6'); await put('l', '1'); t = await rows();
  if (!/Small end diameter at this length 0\.0417 in/i.test(t) || !/Large end diameter \(basic\) 0\.0625 in/.test(t)) problems.push(`[${where}] No. 7/0 pin, 1 in long (0.0625 and 0.0417): ${t}`);
  await put('l', '4'); t = await rows();
  if (!/would taper to nothing/i.test(t)) problems.push(`[${where}] a 7/0 pin 4 in long must be refused: ${t}`);
  await pick('no', '12'); await put('l', '2'); t = await rows();
  if (!/Large end diameter \(basic\) 1\.0320 in/.test(t) || !/Precision class listed up to No\. 10 only/.test(t)) problems.push(`[${where}] No. 12 has no precision class: ${t}`);
  await pick('no', '4');
  await units('mm'); await open('taperpin', 150); await pick('no', '4'); await put('l', '50'); t = await rows();
  if (!/Small end diameter at this length 5\.308 mm/i.test(t) || !/Large end diameter \(basic\) 6\.350 mm/.test(t) || !/inch series shown in mm/.test(t)) problems.push(`[${where}] No. 4 pin in mm: ${t}`);
  await open('spurgear', 150); await put('z1', '12'); await put('z2', '24'); t = await rows();
  if (!/Gear 1: involute form cutter number \(module set of eight\) 1 /.test(t + ' ') || !/Gear 2: involute form cutter number \(module set of eight\) 4 /.test(t + ' ')) problems.push(`[${where}] module cutters for 12 and 24 teeth are No. 1 and No. 4: ${t.slice(0, 1400)}`);
  await units('inch'); await open('spurgear', 150); await put('z1', '20'); await put('z2', '135'); t = await rows();
  if (!/Gear 1: involute form cutter number \(diametral pitch set of eight\) 6 /.test(t + ' ') || !/Gear 2: involute form cutter number \(diametral pitch set of eight\) 1 /.test(t + ' ')) problems.push(`[${where}] diametral pitch cutters for 20 and 135 teeth are No. 6 and No. 1: ${t.slice(0, 1400)}`);
  await put('z1', '10'); t = await rows();
  if (/Gear 1: involute form cutter number/.test(t)) problems.push(`[${where}] no cutter of the set of eight cuts 10 teeth`);
  await put('z1', '20'); await put('z2', '40');
  await mode('advanced');
}
// Shop maths from the books: prismoidal formula, tank contents, irregular areas, equal-area circle and square, old trig functions.
where = 'prismoid';
{
  const rows = async () => (await page.$$eval('#main #res .rrow', r => r.map(t => t.innerText.replace(/\s+/g, ' ').trim()))).join(' | ');
  const put = async (k, v) => { await page.fill(`#main [data-id="${k}"]`, v); await page.dispatchEvent(`#main [data-id="${k}"]`, 'input'); await page.waitForTimeout(40); };
  const pick = async (k, v) => { await page.selectOption(`#main [data-id="${k}"]`, v); await page.waitForTimeout(60); };
  const dia = async () => page.$eval('#main .tdia svg', g => g.textContent.replace(/\s+/g, ' '));
  await units('inch'); await open('prismoid', 150);
  await put('a1', '56'); await put('am', '99'); await put('a2', '154'); await put('h', '12');
  let t = await rows();
  if (!/Volume 1,212\.000 in³/i.test(t) || !/Volume 19\.8611 L/.test(t)) problems.push(`[${where}] the storage bin (56, 99, 154 ft² over 12 ft is 1212): ${t}`);
  let d = await dia();
  if (!/A1 = 56 in²/.test(d) || !/Am = 99 in²/.test(d) || !/A2 = 154 in²/.test(d) || !/h 12/.test(d)) problems.push(`[${where}] drawing: ${d}`);
  await put('h', '0'); t = await rows();
  if (/Volume/.test(t)) problems.push(`[${where}] no volume without a height: ${t}`);
  await put('h', '12');
  await open('tankvol', 150); await pick('orient', '0'); await put('d', '20'); await put('l', '30'); await put('h', '10'); t = await rows();
  // Half full: pi x 100 x 30 / 2 = 4712.39 in³ = 77.22 L = 20.40 US gal.
  if (!/Liquid in the tank 77\.22 L/i.test(t) || !/Liquid in the tank 20\.40 gal \(US\)/.test(t) || !/Full 50\.0 %/.test(t) || !/Tank when full 154\.44 L/.test(t)) problems.push(`[${where}] a lying tank half full: ${t}`);
  d = await dia();
  if (!/depth 10/.test(d) || !/diameter 20 in/.test(d) || !/50 % full/.test(d)) problems.push(`[${where}] tank drawing: ${d}`);
  await put('h', '5'); t = await rows();
  // A quarter of the diameter deep is 19.55 % of the circle.
  if (!/Full 19\.6 %/.test(t)) problems.push(`[${where}] a lying tank a quarter deep holds 19.6 %: ${t}`);
  await put('h', '21'); t = await rows();
  if (!/more than the diameter of the tank/.test(t)) problems.push(`[${where}] a depth over the diameter must be refused: ${t}`);
  await pick('orient', '1'); await put('h', '15'); t = await rows();
  if (!/Full 50\.0 %/.test(t) || !/Liquid in the tank 77\.22 L/i.test(t)) problems.push(`[${where}] a standing tank half full: ${t}`);
  await pick('orient', '0'); await put('h', '8');
  await open('irregular', 150);
  const irr = async (txt, step) => {
    await page.fill('#main [data-k="text"]', txt); await page.dispatchEvent('#main [data-k="text"]', 'input');
    await page.fill('#main [data-k="d"]', step); await page.dispatchEvent('#main [data-k="d"]', 'input'); await page.waitForTimeout(60);
    return (await page.innerText('#main #ires')).replace(/\s+/g, ' ');
  };
  t = await irr('3.6 5.0 6.5 5.5 7.3 6.0 4.0', '25');
  if (!/Widths entered 7/.test(t) || !/Simpson's rule 843\.3333 in²/.test(t) || !/trapezoidal rule 852\.5000 in²/.test(t)) problems.push(`[${where}] published offsets at 25 (Simpson 843.33): ${t}`);
  if (!(await page.$('#main #idia svg'))) problems.push(`[${where}] the irregular area figure is missing`);
  t = await irr('12, 24, 16', '20');
  if (!/trapezoidal rule 760\.0000 in²/.test(t)) problems.push(`[${where}] published offsets 12, 24, 16 at 20 (trapezoidal 760): ${t}`);
  t = await irr('1 2 3 4', '1');
  if (!/needs an odd number of widths/.test(t) || !/trapezoidal rule 7\.5000/.test(t)) problems.push(`[${where}] four widths: Simpson's rule must say why not: ${t}`);
  t = await irr('3.6 5.0 6.5 5.5 7.3 6.0 4.0', '25');
  await open('figures', 150);
  const fig = async (k, a) => { await page.selectOption('#main [data-k="kind"]', k); await page.waitForTimeout(60); await page.fill('#main [data-k="a"]', a); await page.dispatchEvent('#main [data-k="a"]', 'input'); await page.waitForTimeout(60); return (await page.innerText('#main #fres')).replace(/\s+/g, ' '); };
  t = await fig('p4', '4');
  if (!/Side of the square of equal area 3\.5449 in/.test(t)) problems.push(`[${where}] circle of diameter 4: square of equal area 3.5449: ${t}`);
  t = await fig('p0', '3.5449');
  if (!/Diameter of the circle of equal area 4\.0000 in/.test(t)) problems.push(`[${where}] and back: ${t}`);
  await fig('p0', '4');
  // Taper: compound slide setting and tailstock set-over (shown from Advanced mode up).
  await units('mm'); await open('taper', 150);
  await put('D', '30'); await put('d', '25'); await put('L', '250'); await put('Lw', '500'); t = await rows();
  if (!/Tailstock set-over 5\.000 mm/.test(t) || !/Half angle \(slide setting\) 0\.5729 deg/.test(t)) problems.push(`[${where}] 1:50 taper 250 long on a 500 bar: set-over 5 mm: ${t}`);
  await put('Lw', '200'); t = await rows();
  if (!/the work cannot be shorter than the taper/.test(t)) problems.push(`[${where}] a work length under the taper length must be refused: ${t}`);
  await put('Lw', ''); await put('D', '80'); await put('d', '50'); await put('L', '80'); t = await rows();
  if (!/Half angle \(slide setting\) 10\.6197 deg/.test(t) || /Tailstock/.test(t)) problems.push(`[${where}] published example 80, 50 over 80: 10.62 deg: ${t}`);
  await put('D', '25'); await put('d', '12'); await put('L', '60');
  await units('inch');
}
// CNC mill setup guide: eleven steps, three drawings, the key table and the four tool length methods; every
// statement carries source keys, and one that rests on a single publisher says so. The CNC guide gained units,
// program characters, spindle direction, constant surface speed and chip load.
where = 'millsetup';
{
  await open('millsetup', 200);
  const g = await page.evaluate(() => {
    const ps = [...document.querySelectorAll('#main p')].filter(p => !p.classList.contains('desc') && !p.closest('.whyb'));
    const txt = p => p.innerText.replace(/\s+/g, ' ');
    const find = re => ps.find(p => re.test(txt(p)));
    const flagged = re => { const p = find(re); return p ? /to be verified/.test(txt(p)) : null; };
    return { h2: document.querySelectorAll('#main h2').length, svgs: [...document.querySelectorAll('#main svg.geo')].map(v => v.getAttribute('aria-label')).join(' | '),
      steps: (document.querySelector('#main svg.geo')?.querySelectorAll('text.gv').length) || 0,
      tabs: [...document.querySelectorAll('#main table.gtab')].map(t => t.querySelectorAll('tr').length).join(','),
      untagged: ps.filter(p => !p.querySelector('abbr.gsrc') && !p.querySelector('a')).length, tagged: ps.filter(p => p.querySelector('abbr.gsrc')).length,
      home: flagged(/^Home\./), limits: flagged(/^Limits\./), clear: flagged(/^Check the way is clear/), kick: flagged(/^The kick\./), half: txt(find(/^Half the tip/) || document.body).slice(0, 400),
      methods: [...document.querySelectorAll('#main table.gtab')][1]?.innerText.replace(/\s+/g, ' ') || '', srcs: document.querySelectorAll('#main ul.gsl li').length };
  });
  if (g.h2 !== 12) problems.push(`[${where}] expected 12 sections, got ${g.h2}`);
  if (!/eleven steps/i.test(g.svgs) || !/tool length/i.test(g.svgs) || !/Edge finder/i.test(g.svgs) || g.steps !== 11) problems.push(`[${where}] three drawings and eleven numbered steps: ${g.svgs} (${g.steps})`);
  if (g.tabs !== '9,5') problems.push(`[${where}] the key table has 8 rows and the tool length table 4: ${g.tabs}`);
  if (g.untagged !== 0 || g.tagged < 45) problems.push(`[${where}] every statement needs source keys: ${g.untagged} without, ${g.tagged} with`);
  if (g.home !== false || g.kick !== false) problems.push(`[${where}] homing and the kick are confirmed by two publishers and must not be flagged: ${g.home} ${g.kick}`);
  if (g.limits !== true || g.clear !== true) problems.push(`[${where}] one-source statements (edge finder limits, clear path) must say to be verified: ${g.limits} ${g.clear}`);
  if (!/0\.200 in tip that is 0\.100 in/.test(g.half) || !/2 mm or 5 mm/.test(g.half)) problems.push(`[${where}] half the tip diameter: ${g.half}`);
  for (const m of ['A. On the part', 'B. On a block of known height', 'C. On a tool setting probe', 'D. True length from the spindle nose']) if (!g.methods.includes(m)) problems.push(`[${where}] tool length method missing: ${m}`);
  if (g.srcs !== 13) problems.push(`[${where}] expected 13 sources listed, got ${g.srcs}`);
  await open('cncguide', 200);
  const c = await page.evaluate(() => {
    const ps = [...document.querySelectorAll('#main p')]; const txt = p => p.innerText.replace(/\s+/g, ' ');
    const flagged = re => { const p = ps.find(q => re.test(txt(q))); return p ? /to be verified/.test(txt(p)) : null; };
    const spin = document.querySelector('#main #c-spin');
    return { spin: spin ? spin.nextElementSibling.getAttribute('aria-label') : '', chars: [...document.querySelectorAll('#main table.gtab')].map(t => t.innerText.replace(/\s+/g, ' ')).find(t => /Block delete/.test(t) && /Program number/.test(t)) || '',
      units: flagged(/^Inch or millimetre\. G20 sets the program to inches and G21 to millimetres/), m3: flagged(/^M03, M04, M05\./), seen: flagged(/^Seen from where\./), css: flagged(/^Constant surface speed \(lathe\)\./),
      limit: flagged(/^Always with a speed limit\./), chip: flagged(/^Chip load \(feed per tooth\)/) };
  });
  if (!/M03 clockwise and M04 counterclockwise/.test(c.spin)) problems.push(`[${where}] the spindle direction drawing is missing: ${c.spin}`);
  for (const w of ['%', 'O and a number', 'N and a number', '( )', 'End of block, or a comment', 'Block delete', 'Spaces, capitals']) if (!c.chars.includes(w)) problems.push(`[${where}] program characters table lacks ${w}`);
  if (c.units !== false || c.m3 !== false || c.css !== false || c.limit !== false || c.chip !== false) problems.push(`[${where}] units, M03, surface speed, the speed limit and chip load each have two publishers: ${JSON.stringify(c)}`);
  if (c.seen !== true) problems.push(`[${where}] the viewpoint for clockwise has one source and must say so: ${c.seen}`);
}
// Milling toolpath guide and workholding guide: every statement carries source keys and a one-publisher
// statement says so; the chamfer mill calculator (own cone geometry, tested in the core) with its drawing.
where = 'toolpaths';
{
  const guide = async id => { await open(id, 200); return page.evaluate(() => {
    const ps = [...document.querySelectorAll('#main p')].filter(p => !p.classList.contains('desc') && !p.closest('.whyb'));
    const txt = p => p.innerText.replace(/\s+/g, ' ');
    const flag = ps.map(p => [txt(p).slice(0, 120), /to be verified/.test(txt(p))]);
    return { h2: document.querySelectorAll('#main h2').length, svgs: document.querySelectorAll('#main svg.geo').length, untagged: ps.filter(p => !p.querySelector('abbr.gsrc') && !p.querySelector('a')).length, tagged: ps.filter(p => p.querySelector('abbr.gsrc')).length,
      tabs: [...document.querySelectorAll('#main table.gtab')].map(t => t.querySelectorAll('tr').length).join(','), srcs: document.querySelectorAll('#main ul.gsl li').length, flag, code: document.querySelector('#main pre.gcode')?.innerText || '', all: document.querySelector('#main').innerText.replace(/\s+/g, ' ') };
  }); };
  // Is the statement that starts with these words marked "to be verified"? undefined when there is no such statement.
  const tbv = (g, start) => (g.flag.find(f => f[0].startsWith(start)) || [])[1];
  let g = await guide('toolpaths');
  if (g.h2 !== 12 || g.svgs !== 3 || g.tabs !== '9,8' || g.srcs !== 11) problems.push(`[${where}] 12 sections, 3 drawings, tables of 8 and 7 rows, 11 sources: ${g.h2} ${g.svgs} ${g.tabs} ${g.srcs}`);
  if (g.untagged !== 0 || g.tagged < 32) problems.push(`[${where}] every statement needs source keys: ${g.untagged} without, ${g.tagged} with`);
  for (const k of ['Stepover is how far', 'Rules for G41 and G42', 'Getting in', 'Slots', 'Steep or shallow decides']) if (tbv(g, k) !== false) problems.push(`[${where}] a two-publisher statement must not be flagged: ${k} (${tbv(g, k)})`);
  for (const k of ['The chain', 'Pencil passes run a small tool', 'Inside corners', 'Deep pockets']) if (tbv(g, k) !== true) problems.push(`[${where}] a one-publisher statement must say to be verified: ${k} (${tbv(g, k)})`);
  if (!/G41 D1 X0\. Y-6\. F300\./.test(g.code) || !/G40 X-12\. Y-12\./.test(g.code) || g.code.split('\n').length !== 8) problems.push(`[${where}] the cutter compensation example: ${g.code}`);
  if (!/110 to 120 %/.test(g.all) || !/1 to 3 degrees/.test(g.all) || !/55 to 65 %/.test(g.all) || !/2 to 5 %/.test(g.all)) problems.push(`[${where}] the tool maker's starting figures are missing`);
  where = 'workholding';
  g = await guide('workholding');
  if (g.h2 !== 11 || g.svgs !== 2 || g.tabs !== '6,7' || g.srcs !== 10) problems.push(`[${where}] 11 sections, 2 drawings, 5 jaw types, 6 squaring steps, 10 sources: ${g.h2} ${g.svgs} ${g.tabs} ${g.srcs}`);
  if (g.untagged !== 0 || g.tagged < 40) problems.push(`[${where}] every statement needs source keys: ${g.untagged} without, ${g.tagged} with`);
  for (const k of ['Parallels are ground steel strips', 'Heel height', 'Vacuum', 'Take the handle off the vise']) if (tbv(g, k) !== false) problems.push(`[${where}] a two-publisher statement must not be flagged: ${k} (${tbv(g, k)})`);
  // The Tormach article and the CNC Cookbook guide have one author, so together they count once.
  for (const k of ['Grip high and little', 'Locate, then clamp', 'Tabs', 'Thin walls', 'Angle plate', 'Two-sided plate parts on dowels', 'Several parts from one bar', 'Same pressure each time']) if (tbv(g, k) !== true) problems.push(`[${where}] a one-publisher statement must say to be verified: ${k} (${tbv(g, k)})`);
  if (!/the sources differ/.test(g.all) || !/a step or two above level/.test(g.all) || !/about 14 psi/.test(g.all)) problems.push(`[${where}] heel height difference or vacuum figure missing`);
  // CNC lathe guide: the two trade magazines have one publisher and the two Haas documents count once.
  where = 'latheguide';
  g = await guide('latheguide');
  if (g.h2 !== 10 || g.svgs !== 4 || g.tabs !== '9,8,8' || g.srcs !== 17) problems.push(`[${where}] 10 sections, 4 drawings, tables of 8, 7 and 7 rows, 17 sources: ${g.h2} ${g.svgs} ${g.tabs} ${g.srcs}`);
  if (g.untagged !== 0 || g.tagged < 38) problems.push(`[${where}] every statement needs source keys: ${g.untagged} without, ${g.tagged} with`);
  for (const k of ['Spindle and chuck', 'Chuck or collet', 'Through the spindle', 'On centre', 'Slow the feed near the centre', 'Coolant: the sources differ', 'Axial and radial', 'Milling a shape on the face', 'Feed per minute'])
    if (tbv(g, k) !== false) problems.push(`[${where}] a two-publisher statement must not be flagged: ${k} (${tbv(g, k)})`);
  for (const k of ['Turret', 'Bar puller', 'Puller or feeder', 'Round inserts', 'Do not cross the centre', 'Y axis', 'Codes on Haas', 'Nose radius compensation'])
    if (tbv(g, k) !== true) problems.push(`[${where}] a one-publisher statement must say to be verified: ${k} (${tbv(g, k)})`);
  {
    const rows = await page.$$eval('#main table.gtab tr', r => r.map(t => t.innerText.replace(/\s+/g, ' ')));
    const row = k => rows.find(t => t.startsWith(k)) || '';
    if (!/to be verified/.test(row('Four-jaw chuck')) || /to be verified/.test(row('Collet chuck')) || /to be verified/.test(row('Rough turning and facing'))) problems.push(`[${where}] table rows: one source is flagged, two are not: ${row('Four-jaw chuck')} / ${row('Collet chuck')}`);
    if (!/G71, the shape between blocks P and Q/.test(row('2 Rough turn')) || !/G75 \(outside or inside\), G74 \(in the face\)/.test(row('4 Groove')) || !/G76 \(the whole thread\), G92/.test(row('5 Thread'))) problems.push(`[${where}] the Haas cycles in the toolpath table: ${row('2 Rough turn')}`);
  }
  if (!/within 0\.1 mm \(0\.004 in\)/.test(g.all) || !/within 0\.005 in/.test(g.all) || !/8 to 10 times/.test(g.all) || !/G112/.test(g.all) || !/M133/.test(g.all) || !/1\/16 in to 2\.5 in/.test(g.all)) problems.push(`[${where}] parting off, live tool or collet figures are missing`);
  // Shop tools guide: two chapters of one textbook and two articles of one magazine each count once; the
  // hole saw table prints both charts' figures side by side.
  where = 'shoptools';
  g = await guide('shoptools');
  if (g.h2 !== 8 || g.svgs !== 3 || g.tabs !== '6,6,8,5,5,8' || g.srcs !== 35) problems.push(`[${where}] 8 sections, 3 drawings, tables of 5, 5, 7, 4, 4 and 7 rows, 35 sources: ${g.h2} ${g.svgs} ${g.tabs} ${g.srcs}`);
  if (g.untagged !== 0 || g.tagged < 46) problems.push(`[${where}] every statement needs source keys: ${g.untagged} without, ${g.tagged} with`);
  for (const k of ['Four things have to be right', 'Lip clearance', 'Drill point gauge', 'Order', 'Hacksaw blades', 'Break in a new band saw blade', 'Fluid and brush', 'Bigger saw, slower', 'Speed falls with size', 'The rule', 'Dressing and truing are two jobs'])
    if (tbv(g, k) !== false) problems.push(`[${where}] a two-publisher statement must not be flagged: ${k} (${tbv(g, k)})`);
  for (const k of ['Flat point', 'Web thinning', 'Three teeth in the cut', 'Band saw blades', 'Chips tell', 'Deep cuts', 'Long shanks', 'Copper', 'Shapes by number', 'Open or closed'])
    if (tbv(g, k) !== true) problems.push(`[${where}] a one-publisher statement must say to be verified: ${k} (${tbv(g, k)})`);
  {
    const rows = await page.$$eval('#main table.gtab tr', r => r.map(t => t.innerText.replace(/\s+/g, ' ')));
    const row = k => rows.find(t => t.startsWith(k)) || '';
    if (!/350 \/ 382 175 \/ 255 470 \/ 382 470 \/ 446 235 \/ 127/.test(row('25 mm (1 in)')) || !/85 \/ 94 40 \/ 62 110 \/ 94 110 \/ 109 55 \/ 31/.test(row('102 mm (4 in)'))) problems.push(`[${where}] hole saw speeds from the two charts: ${row('25 mm (1 in)')} | ${row('102 mm (4 in)')}`);
    if (/to be verified/.test(row('Neat (straight) oil')) || !/to be verified/.test(row('Semi-synthetic')) || !/to be verified/.test(row('Point too flat'))) problems.push(`[${where}] table rows: one source is flagged, two are not`);
  }
  if (!/8 to 12 degrees/.test(g.all) || !/6 to 9 degrees/.test(g.all) || !/20 to 50 %/.test(g.all) || !/first 100 square inches/.test(g.all) || !/about 27 to 30 m\/min/.test(g.all) || !/12 000 to 18 000 against 4 000 to 10 000/.test(g.all)) problems.push(`[${where}] drill clearance, break-in, hole saw or burr figures are missing`);
  where = 'matguide';
  g = await guide('matguide');
  if (g.h2 !== 17 || g.svgs !== 4 || g.tabs !== '18,12,6,5,9,6,11,8,9,5,8,7,11,9,5' || g.srcs !== 59) problems.push(`[${where}] 17 sections, 4 drawings, 15 tables, 59 sources: ${g.h2} ${g.svgs} ${g.tabs} ${g.srcs}`);
  if (g.untagged !== 0 || g.tagged < 77) problems.push(`[${where}] every statement needs source keys: ${g.untagged} without, ${g.tagged} with`);
  for (const k of ['Four digits', 'First digit', 'A letter in the middle', 'Low, medium and high carbon', 'W, O and A name the quench', 'Austenitic grades are not hardened', 'Two ways to strength', 'H tempers, second digit', 'T651 is', 'On extrusions a fourth digit', 'Grain size tempers', 'Titanium grade 5', 'The letters', 'The number in a ZA name', 'Rockwell scales', 'Vickers angle, sources differ', 'Check the heat number first'])
    if (tbv(g, k) !== false) problems.push(`[${where}] a two-publisher statement must not be flagged: ${k} (${tbv(g, k)})`);
  for (const k of ['Lead content', 'H at the end', 'Carbon. Tool steels', 'Machinability falls', 'What makes it stainless', 'Grades. Ferritic', 'Silicon decides', 'The other digits', 'T73 is', 'Grade 23', 'Order and serial letter', 'Monel holds', 'Machining nickel alloys', 'Zamak 3 and Zamak 5', 'Crevices', 'Then compare with the order'])
    if (tbv(g, k) !== true) problems.push(`[${where}] a one-publisher statement must say to be verified: ${k} (${tbv(g, k)})`);
  {
    const rows = await page.$$eval('#main table.gtab tr', r => r.map(t => t.innerText.replace(/\s+/g, ' ')));
    const row = k => rows.find(t => t.startsWith(k)) || '';
    if (!/chromium-molybdenum Cr 0\.50 to 0\.95 %, Mo 0\.12 to 0\.30 %/.test(row('41xx')) || !/Ni 1\.82 %, Cr 0\.50 to 0\.80 %, Mo 0\.25 %/.test(row('43xx')) || !/Cr 1\.45 %/.test(row('52xxx'))) problems.push(`[${where}] steel series: ${row('41xx')} | ${row('43xx')} | ${row('52xxx')}`);
    if (!/solution heat treated, artificially aged/.test(row('T6 ')) || !/1\/2 hard/.test(row('H02')) || !/sources differ/.test(row('4xxx')) || !/136 degrees between opposite faces/.test(row('Vickers')) || !/10 kgf minor load, then 60, 100 or 150 kgf/.test(row('Rockwell'))) problems.push(`[${where}] tempers and hardness rows: ${row('T6 ')} | ${row('H02')} | ${row('4xxx')}`);
    if (/to be verified/.test(row('W water hardening')) || !/to be verified/.test(row('P mould steels')) || !/to be verified/.test(row('8xxx')) || !/to be verified/.test(row('Leeb')) || !/to be verified/.test(row('Erosion corrosion')) || /to be verified/.test(row('3.1'))) problems.push(`[${where}] table rows: one source is flagged, two are not`);
  }
  if (!/under 0\.25 % in one, 0\.05 to 0\.30 % in the other/.test(g.all) || !/0\.0005 to 0\.003 %/.test(g.all) || !/OS025 is 0\.025 mm/.test(g.all) || !/apex angle of 120 degrees/.test(g.all) || !/about 6 % aluminium and 4 % vanadium/.test(g.all)) problems.push(`[${where}] figures from the sources`);
  where = 'measguide';
  g = await guide('measguide');
  if (g.h2 !== 8 || g.svgs !== 3 || g.tabs !== '5,11,4,8' || g.srcs !== 24) problems.push(`[${where}] 8 sections, 3 drawings, tables of 4, 10, 3 and 7 rows, 24 sources: ${g.h2} ${g.svgs} ${g.tabs} ${g.srcs}`);
  if (g.untagged !== 0 || g.tagged < 54) problems.push(`[${where}] every statement needs source keys: ${g.untagged} without, ${g.tagged} with`);
  for (const k of ['Limit dimensions', 'A unilateral tolerance', 'Three kinds of fit', 'Three grades', 'Overall flatness', 'Repeat reading', 'The standard', 'Micrometer, five points', 'Caliper, outside jaws', 'Total indicator reading', 'Indicator. Fix it', 'How much is too much', 'Lay is the direction'])
    if (tbv(g, k) !== false) problems.push(`[${where}] a two-publisher statement must not be flagged: ${k} (${tbv(g, k)})`);
  // Starrett and the magazine article that repeats its text count once.
  for (const k of ['Which limit on top', 'Putting them together', 'Grade names and the flatness rule', 'Three supports', 'How often to calibrate', '1-2-3 blocks', 'Flat and parallel, in figures', 'Along the jaw', 'Half the reading', 'Shaft or coupling', 'Three profiles', 'Accepting a surface'])
    if (tbv(g, k) !== true) problems.push(`[${where}] a one-publisher statement must say to be verified: ${k} (${tbv(g, k)})`);
  {
    const rows = await page.$$eval('#main table.gtab tr', r => r.map(t => t.innerText.replace(/\s+/g, ' ')));
    const row = k => rows.find(t => t.startsWith(k)) || '';
    if (!/H7\/g6 G7\/h6 sliding/.test(row('H7/g6')) || !/H8\/f7 F8\/h7 close running/.test(row('H8/f7')) || !/H7\/u6 U7\/h6 force/.test(row('H7/u6')) || !/H7\/s6 S7\/h6 medium drive/.test(row('H7/s6'))) problems.push(`[${where}] preferred fits: ${row('H7/g6')} | ${row('H8/f7')}`);
    if (!/2\.000 \+0 −0\.005 1\.995 to 2\.000/.test(row('Unilateral')) || !/1\.998 to 2\.001/.test(row('Unequal bilateral')) || !/material removal is required/.test(row('Bar closing the V')) || !/roughly circular/.test(row('C '))) problems.push(`[${where}] tolerance and symbol rows: ${row('Unilateral')} | ${row('C ')}`);
    if (rows.some(t => /to be verified/.test(t))) problems.push(`[${where}] every table row has two publishers`);
  }
  if (!/40 plus the square of the diagonal in inches divided by 25/.test(g.all) || !/0\.210, 0\.420, 0\.605, 0\.815 and 1\.000 in/.test(g.all) || !/0\.08 mm TIR is 0\.04 mm/.test(g.all) || !/0\.05 mm TIR at 1500 rpm/.test(g.all) || !/at least 90 % of the range/.test(g.all)) problems.push(`[${where}] figures from the sources`);
  where = 'cutguide';
  g = await guide('cutguide');
  if (g.h2 !== 7 || g.svgs !== 5 || g.tabs !== '17,8,15,5,8,6' || g.srcs !== 16) problems.push(`[${where}] 7 sections, 5 drawings, tables of 16, 7, 14, 4, 7 and 5 rows, 16 sources: ${g.h2} ${g.svgs} ${g.tabs} ${g.srcs}`);
  if (g.untagged !== 0 || g.tagged < 77) problems.push(`[${where}] every statement needs source keys: ${g.untagged} without, ${g.tagged} with`);
  for (const k of ['Arbor or shank', 'Shell mills', 'Slab mill', 'Plunging', 'The tough end', 'The hardest', 'High speed steel, how hot', 'Carbide, how hot', 'CBN is used on cast iron', 'Diamond is for', 'Point angle', 'Parts. A file', 'Grades', 'Length counts', 'The push stroke cuts', 'Draw filing', 'Pinning', 'What a broach is', 'Three runs of teeth', 'Pitch. The tooth spacing', 'One pitch or several', 'Push broaches are worked', 'Starting hole', 'Overhang of a steel bar', 'Against chatter, first'])
    if (tbv(g, k) !== false) problems.push(`[${where}] a two-publisher statement must not be flagged: ${k} (${tbv(g, k)})`);
  // Several pages of one publisher count once; the Engineers Edge broaching page follows the Wikipedia text.
  for (const k of ['Plain cutters, narrow and wide', 'Helical teeth', 'Gear tooth cutters', 'The brittle end', 'Second hardest', 'Cermet', 'Never diamond on steel', 'Helix angle', 'Lip clearance', 'Swiss pattern files', 'Chalk', 'Rise per tooth, in figures', 'Tooth proportions and angles', 'Chip breakers', 'Rotary broaching', 'Broach material', 'Why bore', 'Stiffer bars', 'The insert'])
    if (tbv(g, k) !== true) problems.push(`[${where}] a one-publisher statement must say to be verified: ${k} (${tbv(g, k)})`);
  {
    const rows = await page.$$eval('#main table.gtab tr', r => r.map(t => t.innerText.replace(/\s+/g, ' ')));
    const row = k => rows.find(t => t.startsWith(k)) || '';
    const flagged = k => /to be verified/.test(row(k));
    if (!/On the rim and on the sides Slots and grooves/.test(row('Side milling cutter')) || !/Small disc on a shank The seat for a Woodruff key/.test(row('Woodruff')) || !/On the inside, like a thick-walled pipe/.test(row('Hollow mill'))) problems.push(`[${where}] cutter rows: ${row('Side milling cutter')} | ${row('Woodruff')}`);
    if (!/850 HV 200 HV about 550 °C High/.test(row('High speed steel (M2)')) || !/8000 to 10000 HV breaks down above 600 °C about 600 °C Low/.test(row('Diamond (PCD)')) || !/3500 HV 3200 HV/.test(row('CBN'))) problems.push(`[${where}] hardness rows: ${row('High speed steel (M2)')} | ${row('Diamond (PCD)')}`);
    if (!/TEP calls it the land, TTE the margin/.test(row('Land or margin')) || !/also called the dead centre/.test(row('Chisel edge')) || !/0\.0001 in \(0\.0025 mm\)/.test(row('Fine boring head'))) problems.push(`[${where}] drill and boring rows: ${row('Land or margin')} | ${row('Fine boring head')}`);
    for (const k of ['Side milling cutter', 'Face mill', 'End mill', 'T-slot cutter', 'Fly cutter', 'Shank', 'Lip', 'Single cut', 'Double cut', 'Rasp', 'Plain boring bar', 'Fine boring head']) if (flagged(k)) problems.push(`[${where}] a two-publisher row must not be flagged: ${k}`);
    for (const k of ['Staggered-tooth', 'Slitting saw', 'Angle cutter', 'High speed steel (M2)', 'Cermet', 'Neck', 'Web', 'Curved cut', 'Half round', 'Twin cutter head', 'Damped bar']) if (!flagged(k)) problems.push(`[${where}] a one-publisher row must say to be verified: ${k}`);
    if (rows.filter(t => /to be verified/.test(t)).length !== 29) problems.push(`[${where}] 29 one-publisher rows: ${rows.filter(t => /to be verified/.test(t)).length}`);
  }
  if (!/about 550 °C at the cutting edge by AIMS; CNCC has it keep its hardness to between 600 and 650 °C/.test(g.all) || !/coated carbide 4\.58 times and PCD 5\.24 times/.test(g.all) || !/118° for general work, so each lip stands at 59° to the axis/.test(g.all) || !/00, 0, 1, 2, 3, 4 and 6/.test(g.all) || !/0\.003 to 0\.006 in \(0\.076 to 0\.152 mm\) for surface broaching/.test(g.all) || !/at least two teeth are in the work/.test(g.all) || !/6 diameters or more and a carbide bar 8 or more/.test(g.all) || !/lead angle of 0°, never more than 15°/.test(g.all)) problems.push(`[${where}] figures from the sources`);
  {
    const d = await page.$$eval('#main svg.geo', s => s.map(e => e.textContent.replace(/\s+/g, ' ')));
    if (!/on an arbor/.test(d[0]) || !/Woodruff/.test(d[0]) || !/8000 to 10000/.test(d[1]) || !/rated brittle/.test(d[1]) || !/land \(margin\)/.test(d[2]) || !/118°/.test(d[2]) || !/double cut/.test(d[3]) || !/rise per tooth/.test(d[4]) || !/front pilot/.test(d[4])) problems.push(`[${where}] drawings: ${d.map(t => t.slice(0, 40)).join(' | ')}`);
    const bad = await page.$$eval('#main a[href^="#/t/"]', a => a.map(e => e.getAttribute('href').slice(4)).filter(id => !TOOLS.find(t => t.id === id)));
    if (bad.length) problems.push(`[${where}] links to pages that do not exist: ${bad.join(', ')}`);
  }
  where = 'bearguide';
  g = await guide('bearguide');
  if (g.h2 !== 12 || g.svgs !== 3 || g.tabs !== '10,10,14,6,5,5,5' || g.srcs !== 30) problems.push(`[${where}] 12 sections, 3 drawings, tables of 9, 9, 13, 5, 4, 4 and 4 rows, 30 sources: ${g.h2} ${g.svgs} ${g.tabs} ${g.srcs}`);
  if (g.untagged !== 0 || g.tagged < 57) problems.push(`[${where}] every statement needs source keys: ${g.untagged} without, ${g.tagged} with`);
  for (const k of ['Thrust bearings take no radial load', 'How it is built', 'Bore number', 'The four small ones', 'Below 10 mm', 'The example above', 'Medium series', 'Makers differ', 'Which way they run', 'The rule', 'The usual case', 'Too loose', 'Too tight', 'When to ask for C3', 'Leave it wrapped', 'Where to push', 'Press, not hammer', 'How large for cold mounting', 'How hot', 'Never hotter than', 'Sealed and greased bearings', 'No oil bath', 'No flame', 'Induction heaters', 'Roughness', 'Rz, sources differ', 'No spiral'])
    if (tbv(g, k) !== false) problems.push(`[${where}] a two-publisher statement must not be flagged: ${k} (${tbv(g, k)})`);
  // Three NSK documents count as one publisher.
  for (const k of ['Balls or rollers', 'Axial load, one way or both', 'Odd and large bores', 'Series digit', 'Inch bearings', 'What a class controls', 'What it does not', 'Normal is enough', 'Light, normal, heavy', 'Aluminium housings', 'Check the seats', 'The lower limit, in figures', 'Oil bath', 'Once it is hot', 'Plunge grinding', 'Hardness', 'Housing bore', 'How it sets', 'Colours are a habit'])
    if (tbv(g, k) !== true) problems.push(`[${where}] a one-publisher statement must say to be verified: ${k} (${tbv(g, k)})`);
  {
    const rows = await page.$$eval('#main table.gtab tr', r => r.map(t => t.innerText.replace(/\s+/g, ' ')));
    const row = k => rows.find(t => t.startsWith(k)) || '';
    if (!/Mainly radial load High speeds; tolerates little misalignment/.test(row('Deep groove ball')) || !/Axial load only/.test(row('Thrust ball')) || !/The one thrust bearing that also takes radial load/.test(row('Spherical roller thrust'))) problems.push(`[${where}] type rows: ${row('Deep groove ball')} | ${row('Thrust ball')}`);
    if (!/^6 Single-row deep groove ball bearing/.test(row('6 ')) || !/^7 Single-row angular contact ball bearing/.test(row('7 ')) || !/^NA Needle roller bearing/.test(row('NA ')) || !/Contact rubber seal on one side, on both sides KOYO/.test(row('RS, 2RS')) || !/Internal clearance larger than normal/.test(row('C3 '))) problems.push(`[${where}] code and suffix rows: ${row('6 ')} | ${row('RS, 2RS')} | ${row('C3 ')}`);
    if (!/^Normal P0 ABEC 1/.test(row('Normal')) || !/^Class 4 P4 ABEC 7/.test(row('Class 4')) || !/^Class 2 P2 ABEC 9/.test(row('Class 2'))) problems.push(`[${where}] class rows: ${row('Normal')} | ${row('Class 4')}`);
    if (!/Tight on the shaft k6 or m6 \(NRB\); j5, k5, m5 or m6 \(TFL\)/.test(row('Inner ring turns with the shaft')) || !/Sliding fit in the housing H7/.test(row('Outer ring stands still')) || !/N6 \(NHBB\)/.test(row('Outer ring turns'))) problems.push(`[${where}] fit rows: ${row('Inner ring turns with the shaft')} | ${row('Outer ring turns')}`);
    if (!/^Blue Medium Up to 3\/4 in With hand tools/.test(row('Blue')) || !/above 550 °F/.test(row('Red'))) problems.push(`[${where}] threadlocker rows: ${row('Blue')} | ${row('Red')}`);
    const fl = rows.filter(t => /to be verified/.test(t)).map(t => t.split(' ')[0]).join(' ');
    if (fl !== 'K DB, Cyanoacrylate') problems.push(`[${where}] only the K, the DB, DF, DT and the cyanoacrylate rows have one publisher: ${fl}`);
  }
  if (!/04 is 20 mm, 05 is 25 mm/.test(g.all) || !/00 is 10 mm, 01 is 12 mm, 02 is 15 mm and 03 is 17 mm/.test(g.all) || !/05 times 5 is a 25 mm bore/.test(g.all) || !/120 °C by Schaeffler and Fabrico; Processing Magazine gives 125 °C \(257 °F\)/.test(g.all) || !/about 100 to 110 °C in a workshop at 20 °C/.test(g.all) || !/Ra 0\.2 to 0\.8 micrometres, with Rmax no more than 6\.3/.test(g.all) || !/55 HRC \(600 HV\), hardened at least 0\.3 mm deep/.test(g.all) || !/10 micrometres in ABEC 1, 7 in ABEC 3, 4 in ABEC 5, 2\.5 in ABEC 7 and 1\.5 in ABEC 9/.test(g.all)) problems.push(`[${where}] figures from the sources`);
  {
    const d = await page.$$eval('#main svg.geo', s => s.map(e => e.textContent.replace(/\s+/g, ' ')));
    if (!/6205-2RS C3/.test(d[0]) || !/= 25 mm/.test(d[0]) || !/sliding fit, the ring stands still/.test(d[1]) || !/tight fit, the ring turns/.test(d[1]) || !/sleeve on the ring being fitted/.test(d[2]) || !/the force crosses the balls/.test(d[2])) problems.push(`[${where}] drawings: ${d.map(t => t.slice(0, 40)).join(' | ')}`);
    const bad = await page.$$eval('#main a[href^="#/t/"]', a => a.map(e => e.getAttribute('href').slice(4)).filter(id => !TOOLS.find(t => t.id === id)));
    if (bad.length) problems.push(`[${where}] links to pages that do not exist: ${bad.join(', ')}`);
  }
  where = 'abrasguide';
  g = await guide('abrasguide');
  if (g.h2 !== 11 || g.svgs !== 3 || g.tabs !== '9,4,4,4,33' || g.srcs !== 31) problems.push(`[${where}] 11 sections, 3 drawings, tables of 8, 3, 3, 3 and 32 rows, 31 sources: ${g.h2} ${g.svgs} ${g.tabs} ${g.srcs}`);
  if (g.untagged !== 0 || g.tagged < 69) problems.push(`[${where}] every statement needs source keys: ${g.untagged} without, ${g.tagged} with`);
  for (const k of ['Mesh number. Sieve numbers', 'The sources do not all print', 'Grinding ratio (G ratio)', 'No centres, no chuck', 'Above centre', 'What it is. A slow abrasive process', 'Crosshatch', 'How slow', 'What it is for', 'What it holds. Under 0.001 in', 'Abrasives', 'Single-pass honing', 'Plateau honing', 'What it is. Rubbing the work', 'The lap is the softer one', 'Lap material', 'Silicon carbide', 'Diamond cuts faster', 'Conditioning rings', 'Bright is not flat', 'Checking flatness', 'Diamond wheels grind carbide', 'One carat', 'More is not always better', 'Belt speed', 'Grit by stage', 'The speed limit is not one number'])
    if (tbv(g, k) !== false) problems.push(`[${where}] a two-publisher statement must not be flagged: ${k} (${tbv(g, k)})`);
  for (const k of ['Not an exact size', 'Standards. ASTM E11', 'How large', 'An example', 'Less wheel wear', 'Wheel speed. Most surface grinding', 'Spark-out', 'What grinding holds', 'Regulating wheel', 'What it is. A rubber-bonded', 'On centre', 'How far above', 'Lobing', 'Against lobing and chatter', 'Bores', 'What it holds. Diameter', 'Stock. Usually', 'Which abrasive', 'Hard and soft stones', 'Honing oil', 'Plateau finish, in figures', 'Hard and soft work', 'Stock, pressure, speed', 'Grit. 100 to 280', 'One light band', 'What lapping does not do', 'CBN wheels grind hardened steel', 'Bond', 'Shape code', 'Where the layer sits', 'Wheel speed. Diamond 1200', 'Contact wheel hardness', 'Serrated wheels', 'Backing', 'Cut-off wheels', 'Thin or thick', 'Hard or soft bond', 'Speed marking', 'Overhang', 'Grip', 'Shapes', 'Grit. 36 and coarser'])
    if (tbv(g, k) !== true) problems.push(`[${where}] a one-publisher statement must say to be verified: ${k} (${tbv(g, k)})`);
  {
    const rows = await page.$$eval('#main table.gtab tr', r => r.map(t => t.innerText.replace(/\s+/g, ' ')));
    const row = k => rows.find(t => t.startsWith(k)) || '';
    if (!/tilted a few degrees and draws the work through between the wheels Plain cylinders of any length, bar stock/.test(row('Through-feed')) || !/Headed, stepped and profiled work/.test(row('Infeed (plunge)')) || !/fed endways up to a stop/.test(row('End-feed'))) problems.push(`[${where}] centerless rows: ${row('Through-feed')} | ${row('End-feed')}`);
    if (!/^50 2\.2 12\.5 %/.test(row('50 ')) || !/^75 3\.3 18\.8 %/.test(row('75 ')) || !/^100 4\.4 25 %/.test(row('100 '))) problems.push(`[${where}] concentration rows: ${row('50 ')} | ${row('75 ')} | ${row('100 ')}`);
    if (!/Most work \(EMI\); contours and hollow grinding \(Xometry\)/.test(row('Contact wheel')) || !/A fixed flat plate Flat surfaces/.test(row('Platen')) || !/the free span between two wheels/.test(row('Slack belt'))) problems.push(`[${where}] belt rows: ${row('Contact wheel')} | ${row('Platen')}`);
    const fl = rows.filter(t => /to be verified/.test(t)).map(t => t.split(' ')[0]).join(' ');
    if (fl !== 'Out Thread Spiral Comma-shaped Flat Mirror End-feed 50 No. No. No.') problems.push(`[${where}] only six fault rows, the end-feed and concentration 50 rows and the three finest sieves have one publisher: ${fl}`);
    if (!/^No\. 4 4\.75 mm 4\.75 mm \(0\.187 in\) 4\.76 mm \(0\.187 in\)/.test(row('No. 4 ')) || !/^No\. 20 850 µm 0\.85 mm \(0\.0331 in\) 0\.841 mm \(0\.0331 in\)/.test(row('No. 20 ')) || !/^No\. 140 106 µm 0\.105 mm \(0\.0041 in\) 0\.105 mm \(0\.0041 in\)/.test(row('No. 140 ')) || !/^No\. 400 38 µm 0\.037 mm \(0\.0015 in\) 0\.037 mm \(0\.0015 in\)/.test(row('No. 400 ')) || !/^No\. 635 20 µm not listed not listed/.test(row('No. 635 '))) problems.push(`[${where}] sieve rows as each source prints them: ${row('No. 4 ')} | ${row('No. 20 ')} | ${row('No. 140 ')} | ${row('No. 400 ')} | ${row('No. 635 ')}`);
  }
  if (!/Values run from 2 to 200/.test(g.all) || !/12 to 25 % of the work diameter, on a blade with a 30° top face/.test(g.all) || !/100 to 250 ft\/min for the turning hone/.test(g.all) || !/start at about 65 ft\/min/.test(g.all) || !/Rz 3 to 6, Rpk at most 0\.3, Rk 0\.3 to 1\.5 and Rvk 0\.8 to 2\.0 micrometres/.test(g.all) || !/about 280 nanometres \(0\.000011 in\)/.test(g.all) || !/1A1, 6A2C/.test(g.all) || !/4000 to 6000 ft\/min/.test(g.all) || !/At least 10 mm of the shank/.test(g.all) || !/70 to 95 Shore A/.test(g.all)) problems.push(`[${where}] figures from the sources`);
  {
    const d = await page.$$eval('#main svg.geo', s => s.map(e => e.textContent.replace(/\s+/g, ' ')));
    if (!/regulating wheel/.test(d[0]) || !/work rest blade/.test(d[0]) || !/its centre above/.test(d[0]) || !/leave a crosshatch/.test(d[1]) || !/stone/.test(d[1]) || !/lap, softer than the work/.test(d[2]) || !/loose abrasive/.test(d[2])) problems.push(`[${where}] drawings: ${d.map(t => t.slice(0, 40)).join(' | ')}`);
    const bad = await page.$$eval('#main a[href^="#/t/"]', a => a.map(e => e.getAttribute('href').slice(4)).filter(id => !TOOLS.find(t => t.id === id)));
    if (bad.length) problems.push(`[${where}] links to pages that do not exist: ${bad.join(', ')}`);
  }
  where = 'drawguide';
  g = await guide('drawguide');
  if (g.h2 !== 9 || g.svgs !== 3 || g.tabs !== '8,6,6,10,6,8,8,14' || g.srcs !== 26) problems.push(`[${where}] 9 sections, 3 drawings, tables of 7, 5, 5, 9, 5, 7, 7 and 13 rows, 26 sources: ${g.h2} ${g.svgs} ${g.tabs} ${g.srcs}`);
  if (g.untagged !== 0 || g.tagged < 91) problems.push(`[${where}] every statement needs source keys: ${g.untagged} without, ${g.tagged} with`);
  for (const k of ['Few dimensions on an assembly', 'Balloons', 'Leaders', 'Parts list (bill of materials)', 'Title block', 'What is in it', 'Also there', 'General tolerance', 'Revision', 'Scale is stated', 'Preferred scales', 'NTS', 'First angle', 'Third angle', 'Who uses which', 'The symbol', 'Reading the symbol, first angle', 'Reading the symbol, third angle', 'Detail view', 'What a section is for', 'How it is marked', 'Hatching', 'Parts that touch', 'Thin parts', 'Not sectioned', 'Two standards', 'The parts', 'Arrow side and other side (AWS)', 'Fillet weld', 'Intermittent welds. Length', 'Groove figures', 'Weld all around', 'Field weld', 'Backing and melt-through', 'ISO 2553: the dashed line', 'ISO system A', 'Fillet size, ISO', 'Units', 'STEP versions', 'IGES trouble', 'Model-based definition (MBD)', 'PMI', 'Its standards', 'Passing it on', 'What it buys', 'Drawings do not vanish', 'Technical data package', 'It covers'])
    if (tbv(g, k) !== false) problems.push(`[${where}] a two-publisher statement must not be flagged: ${k} (${tbv(g, k)})`);
  // Four Wikipedia articles, two McGill pages and two DraftAid posts count once each.
  for (const k of ['Working drawings', 'Bought parts', 'Hidden lines', 'A long parts list', 'How the A sizes are built', 'Which way up', 'Border, metric sheets', 'Halving', 'Border, inch sheets', 'ISO 7200', 'ISO 2768', 'Reading a scale', 'Several scales on one sheet', 'Do not scale the drawing', 'Notes', 'ISO line widths', 'Where lines fall on top of each other', 'Phantom lines', 'Views', 'How many', 'Auxiliary view', 'Ribs and spokes', 'Keys', 'Both sides', 'Sides of the joint, not of the sheet', 'The fillet symbol', 'No length given', 'Broken arrow', 'Groove angle', 'No depth given', 'CJP', 'Contour and finish', 'ISO system B', 'Process, ISO', 'Intermittent welds, ISO', 'STEP, in detail', 'Parasolid', 'STL cannot', 'DXF is plain text', 'DXF for cutting', 'Machine-readable', 'For reference only', 'BS 8888'])
    if (tbv(g, k) !== true) problems.push(`[${where}] a one-publisher statement must say to be verified: ${k} (${tbv(g, k)})`);
  {
    const rows = await page.$$eval('#main table.gtab tr', r => r.map(t => t.innerText.replace(/\s+/g, ' ')));
    const row = k => rows.find(t => t.startsWith(k)) || '';
    if (!/^A0 841 × 1189/.test(row('A0')) || !/^A3 297 × 420/.test(row('A3')) || !/^A4 210 × 297/.test(row('A4')) || !/^A 8\.5 × 11/.test(row('A 8')) || !/^D 22 × 34/.test(row('D ')) || !/^E 34 × 44/.test(row('E '))) problems.push(`[${where}] sheet sizes: ${row('A0')} | ${row('A4')} | ${row('A 8')} | ${row('E ')}`);
    if (!/Thick, continuous Edges and outlines that can be seen/.test(row('Visible edge')) || !/Thin, long and short dashes in turn/.test(row('Centre line')) || !/Thick chain line with an arrow at each end/.test(row('Cutting plane')) || !/one long and two short dashes/.test(row('Phantom'))) problems.push(`[${where}] line rows: ${row('Visible edge')} | ${row('Cutting plane')}`);
    if (!/Only a quarter is cut away/.test(row('Half section')) || !/stepped to pass through features/.test(row('Offset (stepped) section')) || !/Both edges bevelled/.test(row('V ')) || !/the arrow points to the piece that is bevelled/.test(row('Bevel')) || !/Between a rounded edge and a flat one/.test(row('Flare bevel'))) problems.push(`[${where}] section and groove rows: ${row('Half section')} | ${row('Bevel')}`);
    if (!/owned by no CAD maker/.test(row('STEP')) || !/A mesh of flat triangles, not exact surfaces/.test(row('STL')) || !/AutoCAD's own format/.test(row('DWG')) || !/^ISO 128 How a drawing is presented/.test(row('ISO 128')) || !/^ASME Y14\.41 Annotated 3D models/.test(row('ASME Y14.41')) || !/^AWS A2\.4 Welding symbols/.test(row('AWS A2.4')) || !/gathers and indexes the ISO standards/.test(row('BS 8888'))) problems.push(`[${where}] file and standard rows: ${row('STEP')} | ${row('ISO 128')} | ${row('BS 8888')}`);
    const fl = rows.filter(t => /to be verified/.test(t)).map(t => t.split(' ').slice(0, 2).join(' ')).join(', ');
    if (fl !== 'Outline assembly, Weldment drawing, Revolved section, Square Edges, ISO 5457, ISO 5455, ISO 7200, ISO 2768, ASME Y14.1, ASME Y14.5') problems.push(`[${where}] the rows with one publisher: ${fl}`);
  }
  if (!/0\.13, 0\.18, 0\.25, 0\.35, 0\.5, 0\.7, 1\.0, 1\.4 and 2\.0 mm/.test(g.all) || !/Enlarged 2:1, 5:1, 10:1, 20:1 and 50:1; reduced 1:2, 1:5, 1:10, 1:20, 1:50 and 1:100/.test(g.all) || !/20 mm on the edge that is bound and 10 mm on the other three/.test(g.all) || !/The top view goes below the front view, and the view from the right goes on the left/.test(g.all) || !/The top view goes above the front view, and the view from the right goes on the right/.test(g.all) || !/a for the throat, z for the leg\. a4 is a throat of 4 mm/.test(g.all) || !/135 for MAG welding/.test(g.all) || !/ASME Y14\.41 and ISO 16792/.test(g.all) || !/Xometry Pro words it the other way round/.test(g.all) || !/Material Welding puts it as the arrow side above the line/.test(g.all)) problems.push(`[${where}] figures and differing statements from the sources`);
  {
    const d = await page.$$eval('#main svg.geo', s => s.map(e => e.textContent.replace(/\s+/g, ' ')));
    if (!/visible edge: thick, continuous/.test(d[0]) || !/cutting plane: thick chain, arrows/.test(d[0]) || !/first angle/.test(d[1]) || !/third angle/.test(d[1]) || !/reference line/.test(d[2]) || !/other side/.test(d[2]) || !/arrow side/.test(d[2]) || !/50-150/.test(d[2])) problems.push(`[${where}] drawings: ${d.map(t => t.slice(0, 40)).join(' | ')}`);
    // The view boxes: first angle has the top view below the front view, third angle above it.
    const b = await page.$$eval('#main svg.geo', s => [...s[1].querySelectorAll('text')].map(t => [t.textContent, +t.getAttribute('x'), +t.getAttribute('y')]));
    const at = (name, left) => b.find(t => t[0] === name && (t[1] < 235) === left);
    if (!(at('top', true)[2] > at('front', true)[2] && at('right', true)[1] < at('front', true)[1] && at('top', false)[2] < at('front', false)[2] && at('right', false)[1] > at('front', false)[1])) problems.push(`[${where}] the views are laid out wrongly: ${JSON.stringify(b)}`);
    const bad = await page.$$eval('#main a[href^="#/t/"]', a => a.map(e => e.getAttribute('href').slice(4)).filter(id => !TOOLS.find(t => t.id === id)));
    if (bad.length) problems.push(`[${where}] links to pages that do not exist: ${bad.join(', ')}`);
  }
  where = 'procguide';
  g = await guide('procguide');
  if (g.h2 !== 8 || g.svgs !== 3 || g.tabs !== '6,5,4,7,4,4' || g.srcs !== 34) problems.push(`[${where}] 8 sections, 3 drawings, tables of 5, 4, 3, 6, 3 and 3 rows, 34 sources: ${g.h2} ${g.svgs} ${g.tabs} ${g.srcs}`);
  if (g.untagged !== 0 || g.tagged < 106) problems.push(`[${where}] every statement needs source keys: ${g.untagged} without, ${g.tagged} with`);
  for (const k of ['Cold or hot', 'Laser and plasma', 'The cutting head', 'The orifice', 'Pressure', 'Width of the cut', 'Taper', 'The cut face', 'Speed', 'How it cuts. A focused beam', 'Assist gas', 'Kinds of laser', 'Finish of the cut face', 'How it cuts. An arc', 'Gases', 'Against laser', 'A laser machine costs more', 'How it cuts. Sparks', 'Recast layer', 'How it cuts. A tool', 'Slurry and tool', 'What it is for', 'For and against', 'Abrasive flow machining', 'Steps', 'Why use it', 'Thickness. 0.013', 'Polishing, then buffing', 'Cut buff, then colour buff', 'Wire brushing', 'Thicker wire', 'Use a stainless steel brush', 'A chromate coating on aluminium is a good base', 'Growth', 'Dye and seal', 'Sealing can soften', 'The anodic layer', 'Decorative chrome', 'Hard chrome is plated', 'Hard chrome figures differ', 'Zinc plating', 'Nickel plating', 'Electroless nickel', 'It plates evenly', 'Processes', 'The bond is mechanical', 'Use. Building'])
    if (tbv(g, k) !== false) problems.push(`[${where}] a two-publisher statement must not be flagged: ${k} (${tbv(g, k)})`);
  // Four Open University pages, seven Wikipedia articles and two Protolabs pages count once each.
  for (const k of ['One source puts figures on that', 'Oxyfuel needs time', 'The grit joins the water', 'The Open University page on abrasive jets', 'A jet of plain water', 'Doubling the thickness', 'One maker gives a tolerance', 'A plain water jet can delaminate', 'Argon and nitrogen', 'Cutting with oxygen', 'A fibre laser', 'The edge, in one source: a recast', 'The kerf can be as narrow', 'Safety', 'The edge, in one source: the sides', 'The fluid insulates', 'Sinker electrodes', 'What a sinker is for', 'Finishing passes at lower energy', 'Also in one source', 'It works on materials that do not conduct', 'One source gives a frequency', 'Rotary ultrasonic machining', 'It removes most', 'It is also used to take off', 'A narrow beam of fast electrons', 'The etchant also cuts sideways', 'The hardness of the metal', 'Grit steps', 'Run each finer polishing step', 'One source adds the motion', 'The colour of the bar', 'Buffing wheels', 'Wheel speed', 'Electropolishing', 'Knotted (twisted) wire', 'Never use the same brush', 'Never run a brush', 'What it is. The outer surface', 'Thickness. Black oxide', 'Phosphate is 5 to 15', 'Passivation', 'How it is done', 'An outside diameter therefore', 'A hardcoat meant for wear', 'Alloys', 'It is 0.05 to 0.5', 'Hard chrome does not level', 'Outside edges plate thicker', 'Zinc is not for parts', 'Cadmium', 'Bright nickel is', 'Electroplating builds unevenly', 'Phosphorus content', 'Hydrogen embrittlement', 'What it is. The coating material', 'Flame and arc spraying', 'Plasma, HVOF and detonation', 'The spray reaches only'])
    if (tbv(g, k) !== true) problems.push(`[${where}] a one-publisher statement must say to be verified: ${k} (${tbv(g, k)})`);
  {
    const rows = await page.$$eval('#main table.gtab tr', r => r.map(t => t.innerText.replace(/\s+/g, ' ')));
    const row = k => rows.find(t => t.startsWith(k)) || '';
    if (!/Soft materials\. Hard materials need abrasive in the jet/.test(row('Water jet, water only')) || !/Nearly any material/.test(row('Abrasive water jet Nearly')) || !/Materials that conduct electricity/.test(row('Plasma Materials')) || !/"carbon steel" in one source, "ferrous metals" in the other/.test(row('Oxyfuel (flame cutting)'))) problems.push(`[${where}] what each process cuts: ${row('Water jet, water only')} | ${row('Oxyfuel (flame cutting)')}`);
    if (!/Hypertherm: typically 6 mm and less, up to 30 mm in some cases\. Fractory: a limit of about 25 to 30 mm\. Open University: up to 25 mm/.test(row('Laser Hypertherm')) || !/Hypertherm: best from 6 to 80 mm\. Fractory: 15 to 50 mm recommended, 150 mm at most\. Open University: 0\.75 to 200 mm, usually 5 to 25 mm/.test(row('Plasma Hypertherm')) || !/Hypertherm: 50 mm and above/.test(row('Oxyfuel Hypertherm')) || !/up to 305 mm \(12 in\)\. Techni Waterjet: up to 304 mm for most materials\. The Fabricator: flat parts from shim to about 2 in\. Open University: foil to 50 mm of steel/.test(row('Abrasive water jet Hypertherm'))) problems.push(`[${where}] thickness source by source: ${row('Laser Hypertherm')} | ${row('Abrasive water jet Hypertherm')}`);
    if (!/A shaped electrode of graphite or copper sinks its form into the work/.test(row('Sinker (ram) EDM')) || !/brass or coated copper/.test(row('Wire EDM')) || !/hollow tube electrode/.test(row('Hole drilling EDM'))) problems.push(`[${where}] EDM rows: ${row('Sinker (ram) EDM')} | ${row('Wire EDM')}`);
    if (!/^Black \(emery\) Coarse: cut buffing/.test(row('Black (emery)')) || !/^Brown \(tripoli\) Cut buffing/.test(row('Brown')) || !/^Green Colour buffing\. One source: stainless steel/.test(row('Green')) || !/^Red \(rouge\) Polishes without cutting/.test(row('Red'))) problems.push(`[${where}] compound rows: ${row('Black (emery)')} | ${row('Green')}`);
    if (!/^Black oxide Steel and stainless steel A black finish, sealed with oil/.test(row('Black oxide')) || !/Manganese phosphate is the one for wear/.test(row('Phosphate')) || !/Conducts electricity better than an anodised surface/.test(row('Chromate'))) problems.push(`[${where}] conversion coating rows: ${row('Black oxide')} | ${row('Chromate')}`);
    if (!/^Type I Chromic acid Gleco: the thinnest\. Finishing\.com: usually under 0\.0001 in/.test(row('Type I ')) || !/^Type II Sulfuric acid Gleco: typically 0\.0001 to 0\.0005 in\. Finishing\.com: about 0\.0001 to 0\.0008 in\. PCI Magazine: 5 to 30 µm/.test(row('Type II ')) || !/^Type III \(hardcoat\) Run cold Gleco: typically 0\.001 to 0\.002 in\. Finishing\.com: about 0\.002 in\. PCI Magazine: 25 to 100 µm/.test(row('Type III'))) problems.push(`[${where}] anodising rows: ${row('Type I ')} | ${row('Type II ')} | ${row('Type III')}`);
    const fl = rows.filter(t => /to be verified/.test(t)).map(t => t.split(' ').slice(0, 2).join(' ')).join(', ');
    if (fl !== 'Oxyfuel Hypertherm:, Wire EDM, Hole drilling, Blue Colour, Red (rouge), Phosphate Carbon') problems.push(`[${where}] the rows with one publisher: ${fl}`);
  }
  if (!/0\.025 to 0\.075 mm for laser and of up to 5 mm for plasma/.test(g.all) || !/40 000 to 60 000 psi and another says above 40 000 psi; the Open University gives 70 to 415 MPa/.test(g.all) || !/gives 50 to 70 MPa, far below the figures above\. Not resolved here/.test(g.all) || !/0\.020 to 0\.050 in across/.test(g.all) || !/usually 3 to 8 mm/.test(g.all) || !/0\.001 to 0\.003 in on 2 in steel against 0\.005 to 0\.008 in on 1\/8 in material/.test(g.all) || !/3\.2 to 6\.3 µm Ra in one source, 125 to 250 microinch in the other/.test(g.all) || !/2 to 7°, or 1 to 2° with care/.test(g.all) || !/18 to 40 kHz and an amplitude of 0\.05 to 0\.125 mm/.test(g.all) || !/0\.013 to 2\.032 mm \(0\.0005 to 0\.080 in\) in one source; typically 1\.5 mm or less in the other/.test(g.all) || !/Start at 60 or 80, then 120, 180, 220 or 240, 320, 400 and finer/.test(g.all) || !/each surface moves out by about half the coating thickness/.test(g.all) || !/about four times the growth of one surface/.test(g.all) || !/usually 20 to 40 µm thick, 100 µm or more for extreme wear, 65 to 69 HRC\. The other: 0\.020 to 0\.127 mm thick, 68 to 72 HRC/.test(g.all) || !/0\.0001 to 0\.001 in thick/.test(g.all) || !/harder than 35 HRC/.test(g.all) || !/191 °C \(375 °F\) for four hours/.test(g.all)) problems.push(`[${where}] figures and differing statements from the sources`);
  {
    const d = await page.$$eval('#main svg.geo', s => s.map(e => e.textContent.replace(/\s+/g, ' ')));
    if (!/high-pressure water/.test(d[0]) || !/orifice \(a jewel\)/.test(d[0]) || !/mixing tube/.test(d[0]) || !/kerf/.test(d[0]) || !/tool \(sonotrode\)/.test(d[1]) || !/abrasive slurry/.test(d[1]) || !/about half builds out/.test(d[2]) || !/about half grows in/.test(d[2])) problems.push(`[${where}] drawings: ${d.map(t => t.slice(0, 40)).join(' | ')}`);
    // Anodising drawing: the coating must sit half above and half below the line of the surface before.
    const a = await page.$$eval('#main svg.geo', s => { const n = t => t.match(/-?\d+(\.\d+)?/g).map(Number); const c = n(s[2].querySelector('path.gacc').getAttribute('d')); const l = n(s[2].querySelector('path[stroke-dasharray]').getAttribute('d')); return { top: c[1], bottom: c[3], line: l[1] }; });
    if (!(a.line - a.top === a.bottom - a.line && a.bottom > a.top)) problems.push(`[${where}] the anodising drawing does not split the coating in half: ${JSON.stringify(a)}`);
    const bad = await page.$$eval('#main a[href^="#/t/"]', a => a.map(e => e.getAttribute('href').slice(4)).filter(id => !TOOLS.find(t => t.id === id)));
    if (bad.length) problems.push(`[${where}] links to pages that do not exist: ${bad.join(', ')}`);
    const links = await page.$$eval('#main a[href^="#/t/"]', a => a.map(e => e.getAttribute('href').slice(4)).join(','));
    if (links !== 'edmoffset,edmtaper,edmtime,abrasguide,surface,coating') problems.push(`[${where}] links to other pages: ${links}`);
  }
  where = 'elemguide';
  g = await guide('elemguide');
  if (g.h2 !== 10 || g.svgs !== 4 || g.tabs !== '11,8,5,7,6,6,5,6,7,9' || g.srcs !== 24) problems.push(`[${where}] 10 sections, 4 drawings, tables of 10, 7, 4, 6, 5, 5, 4, 5, 6 and 8 rows, 24 sources: ${g.h2} ${g.svgs} ${g.tabs} ${g.srcs}`);
  if (g.untagged !== 0 || g.tagged < 62) problems.push(`[${where}] every statement needs source keys: ${g.untagged} without, ${g.tagged} with`);
  for (const k of ['The basic law', 'Coefficient of friction', 'It belongs to the pair', 'Static and kinetic', 'A rough guide only', 'What it is. Backlash', 'Why gears need some', 'Accuracy', 'How it is made', 'Sharing it', 'What a cam does', 'Followers are named', 'PV. Pressure times sliding speed', 'The shaft counts too', 'Allow for heat', 'Self-locking depends', 'Friction in the nut', 'Not for running all day', 'Rolled or ground'])
    if (tbv(g, k) !== false) problems.push(`[${where}] a two-publisher statement must not be flagged: ${k} (${tbv(g, k)})`);
  // Six Wikipedia articles and two KHK papers count once each.
  for (const k of ['Two more laws', 'Typical size', 'Angle of friction', 'A third source gives', 'Rule of thumb', 'Centre distance', 'Do not close the centres', 'What usually matters', 'In a gear train', 'Anti-backlash gear', 'On a manual machine', 'On a CNC machine', 'Carbon steel is normalised', 'Worm and wheel', 'Plastics. Nylon', 'A plastic gear is often the pinion', 'Heat treatment', 'Hardness', 'The roller has the least friction', 'A follower either slides', 'Displacement diagram', 'Motions used', 'The size of the base circle', 'A grooved cam', 'What it is. A bearing', 'Plastics have limits', 'One source: 0.2 to 0.4', 'Press fit', 'The press fit in the housing', 'Lubrication', 'Grease suits pivots', 'What goes wrong', 'What they do', 'The rule in one source', "A screw maker's example", 'Vibration or shock', 'A ball screw that is well chosen', 'Hand feeds', 'Thread forms', 'Wear', 'Rolled screws hold', 'Keep dirt out', 'Speed'])
    if (tbv(g, k) !== true) problems.push(`[${where}] a one-publisher statement must say to be verified: ${k} (${tbv(g, k)})`);
  {
    const rows = await page.$$eval('#main table.gtab tr', r => r.map(t => t.innerText.replace(/\s+/g, ' ')));
    const row = k => rows.find(t => t.startsWith(k)) || '';
    if (!/Wikipedia: 0\.74 to 0\.80\. MISUMI: 0\.5 to 0\.8 Wikipedia: 0\.42 to 0\.62\. MISUMI: 0\.42/.test(row('Steel on steel, dry')) || !/Wikipedia: 0\.005 to 0\.23\. MISUMI: 0\.11 to 0\.23 with oil, 0\.16 with grease Wikipedia: 0\.029 to 0\.19\. MISUMI: 0\.081 to 0\.084 with oil/.test(row('Steel on steel, lubricated')) || !/^Aluminium on steel 0\.61 0\.47/.test(row('Aluminium on steel')) || !/^Brass on steel Wikipedia: 0\.35 to 0\.51\. MISUMI: 0\.51 0\.44/.test(row('Brass on steel')) || !/^Copper on steel 0\.53 0\.36/.test(row('Copper on steel')) || !/^PTFE on PTFE 0\.04 0\.04/.test(row('PTFE on PTFE')) || !/^Cast iron on cast iron 1\.1 0\.15/.test(row('Cast iron on cast iron')) || !/^Cast iron on steel 0\.4 0\.23/.test(row('Cast iron on steel')) || !/^Tungsten carbide on steel 0\.4 to 0\.6/.test(row('Tungsten carbide'))) problems.push(`[${where}] friction rows: ${row('Steel on steel, dry')} | ${row('Brass on steel')} | ${row('Cast iron on steel')}`);
    if (!/The usual choice\. It can be heat-treated/.test(row('Carbon steel')) || !/for high loads and high speeds/.test(row('Alloy steel')) || !/^Bronze, aluminium bronze Worm wheels/.test(row('Bronze, aluminium bronze')) || !/Light and self-lubricating/.test(row('Plastics: acetal, nylon'))) problems.push(`[${where}] gear material rows: ${row('Carbon steel')} | ${row('Bronze, aluminium bronze')}`);
    if (!/The follower moves in a plane square to the camshaft/.test(row('Plate (disc, radial) cam')) || !/A groove cut round a cylinder/.test(row('Cylindrical (barrel) cam')) || !/smallest circle that can be drawn to the cam profile/.test(row('Base circle')) || !/base circle radius plus the roller radius/.test(row('Prime circle')) || !/the normal to the pitch curve/.test(row('Pressure angle')) || !/Dwell: it stays still/.test(row('Rise, dwell, return'))) problems.push(`[${where}] cam rows: ${row('Plate (disc, radial) cam')} | ${row('Prime circle')}`);
    if (!/^Bronze SAE 841 14 MPa \(2000 psi\) 6\.1 m\/s \(1200 sfm\) 1\.75 MPa·m\/s \(50 000 psi·sfm\)/.test(row('Bronze SAE 841')) || !/^Bronze SAE 660 28 MPa \(4000 psi\) 3\.8 m\/s \(750 sfm\) 2\.6 MPa·m\/s \(75 000 psi·sfm\)/.test(row('Bronze SAE 660')) || !/^Nylon 3 MPa \(400 psi\) 1\.83 m\/s \(360 sfm\) 0\.11 MPa·m\/s \(3000 psi·sfm\)/.test(row('Nylon')) || !/^PTFE 3 MPa \(500 psi\) 0\.5 m\/s \(100 sfm\) 0\.04 MPa·m\/s \(1000 psi·sfm\)/.test(row('PTFE 3'))) problems.push(`[${where}] PV rows: ${row('Bronze SAE 841')} | ${row('PTFE 3')}`);
    if (!/Wikipedia: 20 to 25 % for an Acme screw\. Roton: 45 % at a lead angle of 8°, 65 % at 20° About 90 %/.test(row('Efficiency')) || !/Many are self-locking: the load cannot turn the screw Back-drives: the load can turn the screw/.test(row('Holding a load')) || !/Balls roll between the screw and the nut/.test(row('How it works')) || !/Can be preloaded so that there is no play/.test(row('Backlash'))) problems.push(`[${where}] screw rows: ${row('Efficiency')} | ${row('Holding a load')}`);
    const fl = rows.filter(t => /to be verified/.test(t)).map(t => t.split(' ').slice(0, 2).join(' ')).join(', ');
    if (fl !== 'Cast iron, Cast iron, Tungsten carbide, Cast iron, Bronze, aluminium, Aluminium Light,, Face cam, Lift The, Thrust washer, Two half, Babbitt Soft,, Cast iron, Bronze SAE, Bronze SAE, Nylon 3, PTFE 3, Backlash A, Steady load,, Part of, Load put, Stress swings, Repeated shock, Stresses that, Automobiles 3.0, Bolts no, Heavy-duty shafting, Lifting hooks, Wire ropes') problems.push(`[${where}] the rows with one publisher: ${fl}`);
  }
  if (!/Most dry pairs lie between 0\.3 and 0\.6\. PTFE can be as low as 0\.04/.test(g.all) || !/0\.1 to 0\.4 for steel on steel/.test(g.all) || !/0\.04 in divided by the diametral pitch on average, with 0\.03 as the least and 0\.05 as the most/.test(g.all) || !/a 20° gear gains 41 % more backlash than a 14\.5° gear/.test(g.all) || !/about one sixth of the bending strength/.test(g.all) || !/glass fibre adds about 30 % and carbon fibre about 90 %/.test(g.all) || !/up to 350 HB\. Hardened gears are typically 58 to 65 HRC/.test(g.all) || !/a difference of 30 to 50 HB or more/.test(g.all) || !/0\.2 to 0\.4 µm Ra or better/.test(g.all) || !/about 0\.5 to 1\.0 times the diameter/.test(g.all) || !/greater than the tangent of the lead angle/.test(g.all) || !/at a lead angle of 8° the screw locks; at 20° the load drives it back/.test(g.all) || !/0\.15 to 0\.23 dry and 0\.10 to 0\.16 with machine oil in one source; a screw maker works with 0\.15/.test(g.all) || !/about a third of the driving torque/.test(g.all) || !/29° thread angle/.test(g.all) || !/from C0, the most precise, to C10/.test(g.all) || !/no more than 80 % of its critical speed/.test(g.all)) problems.push(`[${where}] figures from the sources`);
  {
    const d = await page.$$eval('#main svg.geo', s => s.map(e => e.textContent.replace(/\s+/g, ' ')));
    if (!/static limit/.test(d[0]) || !/sliding: kinetic/.test(d[0]) || !/backlash/.test(d[1]) || !/flanks touch/.test(d[1]) || !/roller follower/.test(d[2]) || !/base circle/.test(d[2]) || !/lift/.test(d[2])) problems.push(`[${where}] drawings: ${d.map(t => t.slice(0, 40)).join(' | ')}`);
    // Friction graph: the kinetic level must lie below the static peak (a larger y is lower on the screen). Cam diagram: rise, dwell, return from left to right.
    const f = await page.$$eval('#main svg.geo', s => { const n = t => t.match(/-?\d+(\.\d+)?/g).map(Number); const c = [...s[0].querySelectorAll('path.gc')].map(p => n(p.getAttribute('d'))).find(a => a.length === 7); const x = w => +[...s[2].querySelectorAll('text')].find(t => t.textContent === w).getAttribute('x'); return { start: c[1], peak: c[3], kin: c[5], rise: x('rise'), dwell: x('dwell'), ret: x('return') }; });
    if (!(f.peak < f.kin && f.kin < f.start && f.rise < f.dwell && f.dwell < f.ret)) problems.push(`[${where}] the friction graph or the cam diagram is drawn wrongly: ${JSON.stringify(f)}`);
    const bad = await page.$$eval('#main a[href^="#/t/"]', a => a.map(e => e.getAttribute('href').slice(4)).filter(id => !TOOLS.find(t => t.id === id)));
    if (bad.length) problems.push(`[${where}] links to pages that do not exist: ${bad.join(', ')}`);
    const links = await page.$$eval('#main a[href^="#/t/"]', a => a.map(e => e.getAttribute('href').slice(4)).join(','));
    if (links !== 'bolttorque,spurgear,gearmeasure,worm,heattreat,bearguide,fits,acme,trapezoidal,geartrain,planetary,fatigue,column,threadstrip') problems.push(`[${where}] links to other pages: ${links}`);
  }
  where = 'driveguide';
  g = await guide('driveguide');
  if (g.h2 !== 6 || g.svgs !== 4 || g.tabs !== '10,15,5,6,10,4,8,10,5,5,5' || g.srcs !== 23) problems.push(`[${where}] 6 sections, 4 drawings, tables of 9, 14, 4, 5, 9, 3, 7, 9, 4, 4 and 4 rows, 23 sources: ${g.h2} ${g.svgs} ${g.tabs} ${g.srcs}`);
  if (g.untagged !== 0 || g.tagged < 52) problems.push(`[${where}] every statement needs source keys: ${g.untagged} without, ${g.tagged} with`);
  for (const k of ['Stator and rotor', 'Rotating field', 'Induction', 'Synchronous speed is', 'Slip. An induction motor', 'How much slip', 'Offset and angle', 'What misalignment does', 'Soft foot first', 'Bracket sag', 'Thermal growth', 'The limits of the maker', 'Small piston, big load', 'Force of a cylinder', 'The pump makes flow', 'Air preparation', 'What is measured', 'Frequency range', 'Where. At each bearing', 'Two groups of machines', 'Rigid or flexible', 'Standard numbers'])
    if (tbv(g, k) !== false) problems.push(`[${where}] a two-publisher statement must not be flagged: ${k} (${tbv(g, k)})`);
  // The two Fabrico pages, the two OpenExamPrep pages, and Machine Design with Power & Motion count once each.
  for (const k of ['Squirrel cage', 'One source gives the rule', 'Control Engineering gives', 'Which way it turns', 'Single phase', 'Variable frequency drive', 'Enclosures', 'Bearings. Some nameplates', 'The aim', 'To find a soft foot', 'Which machine moves', 'Correct the vertical plane', 'Reading the dials', 'To measure the sag', 'Check the readings', 'Before aligning', 'The same source calls', 'The law of Pascal', 'Pulling back', 'Power, in one source', 'Open and closed centre', 'Oil. Hydraulic fluid', 'About 1 % of air', 'Running cost', 'The filter also takes out', 'Pipe threads are screwed', 'Soft seals', 'Hoses are graded', 'One source adds shaft heights', 'ISO 20816-3 took over'])
    if (tbv(g, k) !== true) problems.push(`[${where}] a one-publisher statement must say to be verified: ${k} (${tbv(g, k)})`);
  {
    const rows = await page.$$eval('#main table.gtab tr', r => r.map(t => t.innerText.replace(/\s+/g, ' ')));
    const row = k => rows.find(t => t.startsWith(k)) || '';
    if (!/a 445T frame is 11 in/.test(row('Frame')) || !/1\.15 is standard for open motors and 1\.0 for totally enclosed/.test(row('Service factor')) || !/torque in lb-ft times rpm, divided by 5250/.test(row('Power')) || !/A to V: the locked-rotor kVA per horsepower/.test(row('Code letter')) || !/460 V motor is meant for a 480 V network/.test(row('Voltage')) || !/ODP \(open drip-proof\), TEFC \(totally enclosed, fan cooled\) or TENV/.test(row('Enclosure'))) problems.push(`[${where}] nameplate rows: ${row('Frame')} | ${row('Service factor')} | ${row('Power')}`);
    if (!/Axial end float upsets the face readings/.test(row('Rim and face')) || !/Not upset by axial float/.test(row('Reverse dial')) || !/about 0\.010 in/.test(row('Straightedge')) || !/about 0\.1 mil/.test(row('Laser'))) problems.push(`[${where}] alignment methods: ${row('Rim and face')} | ${row('Reverse dial')}`);
    if (!/^Up to 1000 rpm 0\.09 mm 0\.09 mm per 100 mm/.test(row('Up to 1000')) || !/^1000 to 2000 rpm 0\.07 mm 0\.07 mm per 100 mm/.test(row('1000 to 2000')) || !/^2000 to 3000 rpm 0\.05 mm 0\.05 mm per 100 mm/.test(row('2000 to 3000')) || !/^3000 to 4000 rpm 0\.03 mm 0\.03 mm per 100 mm/.test(row('3000 to 4000')) || !/^Above 4000 rpm 0\.02 mm not given/.test(row('Above 4000'))) problems.push(`[${where}] alignment tolerances: ${row('Up to 1000')} | ${row('Above 4000')}`);
    if (!/sets the highest pressure/.test(row('Relief valve')) || !/below 20 MPa \(3000 psi\)\. OpenExamPrep: up to 250 bar/.test(row('Gear pump')) || !/OpenExamPrep: up to 200 bar/.test(row('Vane pump')) || !/up to 420 bar \(about 6000 psi\)/.test(row('Piston pump'))) problems.push(`[${where}] circuit and pump rows: ${row('Relief valve')} | ${row('Gear pump')}`);
    if (!/typically 1500 to 2500 psi\. OpenExamPrep: can be over 350 bar \(about 5000 psi\) AutomationPrimer: 60 to 80 psi at the cylinder\. OpenExamPrep: 6 to 10 bar \(90 to 150 psi\)/.test(row('Pressure')) || !/^Speed Slower Fast/.test(row('Speed Slower')) || !/^Holding a load Holds a position rigidly Gives under load/.test(row('Holding a load'))) problems.push(`[${where}] hydraulics against pneumatics: ${row('Pressure')} | ${row('Speed Slower')}`);
    if (!/good for up to 10 000 psi/.test(row('37 degree flare')) || !/Brennan: up to 6000 psi/.test(row('O-ring face seal')) || !/Code 62 is the 6000 psi series/.test(row('Four-bolt flange')) || !/Brennan: required; MISUMI: recommended/.test(row('Tapered pipe thread')) || !/a mixed pair leaks/.test(row('45 degree flare')) || !/24 degree throat/.test(row('Bite type'))) problems.push(`[${where}] fitting rows: ${row('37 degree flare')} | ${row('O-ring face seal')}`);
    if (!/^A A newly commissioned machine/.test(row('A A')) || !/^B Fit to run for a long time/.test(row('B Fit')) || !/^C Not fit for long continuous running/.test(row('C Not')) || !/^D Severe enough to damage/.test(row('D Severe'))) problems.push(`[${where}] zone rows: ${row('A A')} | ${row('D Severe')}`);
    if (!/^Group 1, rigid support 2\.3 4\.5 7\.1/.test(row('Group 1, rigid')) || !/^Group 1, flexible support 3\.5 7\.1 11\.0/.test(row('Group 1, flexible')) || !/^Group 2, rigid support 1\.4 2\.8 4\.5/.test(row('Group 2, rigid')) || !/^Group 2, flexible support 2\.3 4\.5 7\.1/.test(row('Group 2, flexible'))) problems.push(`[${where}] zone boundaries: ${row('Group 1, rigid')} | ${row('Group 1, flexible')} | ${row('Group 2, rigid')} | ${row('Group 2, flexible')}`);
    if (!/Vibromera: at two and three times the running speed, with axial vibration more than half the radial\. Fabrico and Tractian: at once and twice the running speed/.test(row('Misalignment')) || !/mostly at once the running speed/.test(row('Unbalance'))) problems.push(`[${where}] fault rows: ${row('Misalignment')}`);
    const fl = rows.filter(t => /to be verified/.test(t)).map(t => t.split(' ').slice(0, 2).join(' ')).join(', ');
    if (fl !== 'Oil and, Voltage The, Frequency and, Full-load amps, Power The, Code letter, Service factor, Efficiency The, Duty Usually, Insulation class, Ambient The, Frame The, Straightedge and, Up to, 1000 to, 2000 to, 3000 to, Above 4000, Reservoir Holds, Check valve, Accumulator Stores, Flow control, 45 degree, Parallel pipe, Push-to-connect A, Unbalance Vibration, Looseness At, Rolling bearing') problems.push(`[${where}] the rows with one publisher: ${fl}`);
  }
  if (!/1760 rpm \(AutomationDirect\), 1748 rpm \(Machine Design\) and 1746 rpm \(Control Engineering, at 3 % slip\)/.test(g.all) || !/120 times the frequency, divided by the number of poles/.test(g.all) || !/synchronous speed of 1800 rpm/.test(g.all) || !/2 to 5 % as the usual slip/.test(g.all) || !/within 15 degrees of the vertical/.test(g.all) || !/more than 0\.001 in \(0\.025 mm\), look for loose hardware/.test(g.all) || !/no more than 0\.001 in \(0\.025 mm\) runout/.test(g.all) || !/more than 0\.002 in \(0\.05 mm\) as a flange is loosened/.test(g.all) || !/API 686 as 0\.02 mm offset and 0\.03 degrees/.test(g.all) || !/divided by 1714; kilowatts are bar times litres a minute divided by 600/.test(g.all) || !/5 to 10 times that of a hydraulic one/.test(g.all) || !/about 1 hp for every 4 cubic feet a minute/.test(g.all) || !/above 6000 psi \(41 MPa\)/.test(g.all) || !/every five to seven years/.test(g.all) || !/covers 10 to 1000 Hz/.test(g.all) || !/above 300 kW, Group 2 machines from 15 to 300 kW/.test(g.all) || !/at least 25 % above/.test(g.all) || !/above 15 kW running at 120 to 30 000 rpm/.test(g.all) || !/315 mm and more for Group 1, 160 to 315 mm for Group 2/.test(g.all) || !/not from the standards themselves/.test(g.all)) problems.push(`[${where}] figures from the sources`);
  {
    const d = await page.$$eval('#main svg.geo', s => s.map(e => e.textContent.replace(/\s+/g, ' ')));
    if (!/stator: fixed/.test(d[0]) || !/slip/.test(d[0]) || !/offset/.test(d[1]) || !/angle/.test(d[1]) || !/bracket/.test(d[1]) || !/relief valve/.test(d[2]) || !/directional valve/.test(d[2]) || !/reservoir/.test(d[2]) || !/long-term ok/.test(d[3]) || !/damage/.test(d[3])) problems.push(`[${where}] drawings: ${d.map(t => t.slice(0, 40)).join(' | ')}`);
    // Motor drawing: the rotor bar must be shorter than the field bar. Zone drawing: A, B, C, D from left to right.
    const f = await page.$$eval('#main svg.geo', s => { const end = (sel, start) => { const p = [...s[0].querySelectorAll(sel)].map(e => e.getAttribute('d')).find(t => t.startsWith(start)); return +p.split('H')[1]; }; const x = w => +[...s[3].querySelectorAll('text')].find(t => t.textContent === w).getAttribute('x'); return { field: end('path.gc', 'M222 124'), rotor: end('path.gp', 'M222 146'), a: x('A'), b: x('B'), c: x('C'), d: x('D') }; });
    if (!(f.rotor < f.field && f.a < f.b && f.b < f.c && f.c < f.d)) problems.push(`[${where}] the motor speed bars or the zone bands are drawn wrongly: ${JSON.stringify(f)}`);
    const bad = await page.$$eval('#main a[href^="#/t/"]', a => a.map(e => e.getAttribute('href').slice(4)).filter(id => !TOOLS.find(t => t.id === id)));
    if (bad.length) problems.push(`[${where}] links to pages that do not exist: ${bad.join(', ')}`);
    const links = await page.$$eval('#main a[href^="#/t/"]', a => a.map(e => e.getAttribute('href').slice(4)).join(','));
    if (links !== 'beltdrive,chaindrive,geartrain,bearguide,torsion,measguide,pipethreads,oring,balance,chatter') problems.push(`[${where}] links to other pages: ${links}`);
  }
  where = 'fastguide';
  g = await guide('fastguide');
  if (g.h2 !== 12 || g.svgs !== 4 || g.tabs !== '11,9,12,7,8,8,8' || g.srcs !== 31) problems.push(`[${where}] 12 sections, 4 drawings, tables of 10, 8, 11, 6, 7, 7 and 7 rows, 31 sources: ${g.h2} ${g.svgs} ${g.tabs} ${g.srcs}`);
  if (g.untagged !== 0 || g.tagged < 42) problems.push(`[${where}] every statement needs source keys: ${g.untagged} without, ${g.tagged} with`);
  for (const k of ['The aim. Engage enough', 'Rule of thumb. Nord-Lock', 'Vibration tests named after Junker', 'What it does. Safety wire', 'Torque first', 'Direction. Lead the wire', 'Twists. About 6 to 8', 'Once only', 'The wire is usually stainless', 'What it is. A set screw', 'What they are. A tapping screw', 'Thread-forming screws push', 'Thread-cutting screws have', 'What it is. A retaining ring', 'Whitworth. Joseph Whitworth', 'BSW and BSF', 'BA. The British Association', 'BSP is the British pipe thread', 'Spanners. A Whitworth', 'Two markings', 'Not Unified'])
    if (tbv(g, k) !== false) problems.push(`[${where}] a two-publisher statement must not be flagged: ${k} (${tbv(g, k)})`);
  // Four Wikipedia articles, three Machine Design articles, three Essentra pages and two Fastener Engineering articles count once each.
  for (const k of ['Fastenal: about 1 times the diameter', 'The same shop gives three', 'Softer materials', 'Galling is most common', 'Why they come loose', 'Torque and friction', 'One article, written by a washer maker', 'Common diameters are 0.5 to 1 mm', 'Hard or soft', 'A flat on the shaft', 'Marks. A hardened point', 'Not for high torque', 'That tight fit resists', 'They drive with less torque', 'The hole matters', 'Material. Tapping screws', 'Shear. Pins are loaded', 'Standards. ASME B18.27', 'The largest is 0 BA', 'Cycle thread', 'The Unified thread was agreed'])
    if (tbv(g, k) !== true) problems.push(`[${where}] a one-publisher statement must say to be verified: ${k} (${tbv(g, k)})`);
  {
    const rows = await page.$$eval('#main table.gtab tr', r => r.map(t => t.innerText.replace(/\s+/g, ' ')));
    const row = k => rows.find(t => t.startsWith(k)) || '';
    if (!/good up to 120 °C \(248 °F\)/.test(row('Nylon insert nut')) || !/it does little or nothing against vibration/.test(row('Split (helical spring) washer')) || !/the bolt would have to stretch for the nut to turn back/.test(row('Wedge-locking washers')) || !/cross hole in the bolt/.test(row('Castle nut'))) problems.push(`[${where}] locking rows: ${row('Nylon insert nut')} | ${row('Split (helical spring) washer')}`);
    if (!/The most common point/.test(row('Cup')) || !/not to be used twice/.test(row('Knurled cup')) || !/Goes in deepest, holds hardest and leaves a mark/.test(row('Cone')) || !/enters a hole or a slot/.test(row('Dog')) || !/about half as long/.test(row('Half dog'))) problems.push(`[${where}] set screw rows: ${row('Cup')} | ${row('Cone')}`);
    if (!/sits flush in a countersink/.test(row('Countersunk (flat)')) || !/Essentra: sheet metal\. Accu: not for heavy loads/.test(row('Truss (mushroom)')) || !/A Phillips driver fits a Pozidriv head, but not the other way round/.test(row('Pozidriv')) || !/not for structural joints/.test(row('Thumb and wing'))) problems.push(`[${where}] head and drive rows: ${row('Countersunk (flat)')} | ${row('Pozidriv')}`);
    if (!/Pointed \(gimlet point\), thread-forming\. Thin sheet metal/.test(row('Type AB')) || !/Blunt point, thread-forming/.test(row('Type B')) || !/Hard plastics and die castings/.test(row('Type 25')) || !/No\. 2 for light gauge sheet, No\. 3 for medium, No\. 4 or 5 for heavier/.test(row('Self-drilling screw'))) problems.push(`[${where}] tapping screw rows: ${row('Type AB')} | ${row('Self-drilling screw')}`);
    if (!/0\.0002 in over the nominal size, oversize pins 0\.001 in over/.test(row('Dowel pin')) || !/large end less 0\.02083 times the length/.test(row('Taper pin')) || !/18 standard sizes from 1\/32 in/.test(row('Split pin')) || !/3\/16 to 1 in/.test(row('Clevis pin')) || !/drill the hole to the nominal size and never undersize/.test(row('Grooved pin'))) problems.push(`[${where}] pin rows: ${row('Dowel pin')} | ${row('Taper pin')}`);
    if (!/pliers that fit the lug holes/.test(row('Axial ring')) || !/needs no groove/.test(row('Self-locking')) || !/three points or more/.test(row('Constant section ring')) || !/A 15 degree edge/.test(row('Bevelled ring'))) problems.push(`[${where}] ring rows: ${row('Axial ring')} | ${row('Bevelled ring')}`);
    const fl = rows.filter(t => /to be verified/.test(t)).map(t => t.split(' ').slice(0, 2).join(' ')).join(', ');
    if (fl !== 'Toothed (star), Thread-locking adhesive, Oval A, Half dog, Nylon tip, Cheese A, Button A, Flanged A, Slotted The, Phillips Works, Pozidriv A, Hexagon socket, Six-lobe (Torx), Square (Robertson), Type 25, Three-lobed thread-rolling, Taper pin, Clevis pin, Bevelled ring') problems.push(`[${where}] the rows with one publisher: ${fl}`);
  }
  if (!/about 1 times the screw diameter in steel and about 2 times in aluminium/.test(g.all) || !/about 1\.5 times the diameter as the best length/.test(g.all) || !/a 1\/4-20 screw wants 0\.375 in, about 7\.5 threads/.test(g.all) || !/About 90 % of the tightening torque goes into friction and only about 10 % into clamp load/.test(g.all) || !/About 6 to 8 twists to the inch/.test(g.all) || !/0\.5 to 1 mm \(0\.020 to 0\.041 in\); 0\.8 mm \(0\.032 in\)/.test(g.all) || !/at least 100 000 psi/.test(g.all) || !/at least one pin diameter from the end/.test(g.all) || !/ASME B18\.27, DIN 471 and DIN 472/.test(g.all) || !/in 1841\. It has an angle of 55 degrees/.test(g.all) || !/an angle of 47\.5 degrees/.test(g.all) || !/0 BA, 6 mm in diameter with a pitch of 1\.0 mm/.test(g.all) || !/0\.9 times the one before/.test(g.all) || !/1\/4 W with 5\/16 BSF in White, 3\/8 W with 7\/16 BSF in Wikipedia/.test(g.all) || !/12 to the inch in BSW and 13 in UNC/.test(g.all) || !/formalised in 1929/.test(g.all)) problems.push(`[${where}] figures from the sources`);
  {
    const d = await page.$$eval('#main svg.geo', s => s.map(e => e.textContent.replace(/\s+/g, ' ')));
    if (!/engagement/.test(d[0]) || !/tapped part/.test(d[0]) || !/tightens/.test(d[1]) || !/half dog/.test(d[2]) || !/split pin/.test(d[3]) || !/grooved/.test(d[3])) problems.push(`[${where}] drawings: ${d.map(t => t.slice(0, 40)).join(' | ')}`);
    // Safety wire drawing: the wire must leave the left bolt above its centre and reach the right bolt below its centre, so that its pull tightens both (right-hand threads, seen from above). Set screw points in the order of the table.
    const f = await page.$$eval('#main svg.geo', s => { const n = s[1].querySelector('#fgw').getAttribute('d').match(/-?\d+(\.\d+)?/g).map(Number); const x = w => +[...s[2].querySelectorAll('text')].find(t => t.textContent === w).getAttribute('x'); return { x1: n[0], y1: n[1], x2: n[2], y2: n[3], cup: x('cup'), flat: x('flat'), cone: x('cone'), dog: x('dog') }; });
    if (!(f.x1 < f.x2 && f.y1 < 72 && f.y2 > 72 && f.cup < f.flat && f.flat < f.cone && f.cone < f.dog)) problems.push(`[${where}] the safety wire or the set screw points are drawn wrongly: ${JSON.stringify(f)}`);
    const bad = await page.$$eval('#main a[href^="#/t/"]', a => a.map(e => e.getAttribute('href').slice(4)).filter(id => !TOOLS.find(t => t.id === id)));
    if (bad.length) problems.push(`[${where}] links to pages that do not exist: ${bad.join(', ')}`);
    const links = await page.$$eval('#main a[href^="#/t/"]', a => a.map(e => e.getAttribute('href').slice(4)).join(','));
    if (links !== 'threadstrip,boltgrade,bolttorque,sti,bearguide,bolttorque,spanner,shcs,clearance,taperpin,shcs,boltgrade,whitworth,pipethreads') problems.push(`[${where}] links to other pages: ${links}`);
  }
  where = 'threadguide';
  g = await guide('threadguide');
  if (g.h2 !== 6 || g.svgs !== 2 || g.tabs !== '11,25' || g.srcs !== 12) problems.push(`[${where}] 6 sections, 2 drawings, tables of 10 and 24 rows, 12 sources: ${g.h2} ${g.svgs} ${g.tabs} ${g.srcs}`);
  if (g.untagged !== 0 || g.tagged < 24) problems.push(`[${where}] every statement needs source keys: ${g.untagged} without, ${g.tagged} with`);
  for (const k of ['Major diameter. The largest', 'Minor diameter. The smallest', 'Pitch diameter. The diameter', 'Pitch. The distance along', 'Crest and root', 'Thread angle. The angle between', 'Depth of thread', 'Lead. The distance the nut', 'On a single-start thread', 'ACME against square'])
    if (tbv(g, k) !== false) problems.push(`[${where}] a two-publisher statement must not be flagged: ${k} (${tbv(g, k)})`);
  // Seven Wikipedia articles count once.
  for (const k of ['On a sharp V it lies midway', 'Flank. The surface between', 'A sharp 60° V is 0.866', 'Starts. With more than one', 'Multi-start threads are used', 'Hand. A right-hand thread', 'The price is more friction', 'How a trapezoidal thread is written', 'How a knuckle thread is written', 'Coarse and fine say only', 'Straight and tapered', 'Classes of Unified threads', 'AFT Fasteners lists 2A and 3A', 'How a Unified thread is written'])
    if (tbv(g, k) !== true) problems.push(`[${where}] a one-publisher statement must say to be verified: ${k} (${tbv(g, k)})`);
  {
    const rows = await page.$$eval('#main table.gtab tr', r => r.map(t => t.innerText.replace(/\s+/g, ' ')));
    const row = k => rows.find(t => t.startsWith(k)) || '';
    if (!/^V \(ISO metric, Unified\) 60° A triangle with the tips cut off/.test(row('V (ISO')) || !/^Whitworth \(BSW, BSF\) 55° Rounded crests and roots/.test(row('Whitworth')) || !/^British Association \(BA\) 47\.5°/.test(row('British Association')) || !/^ACME 29° Leadscrews and other power screws; works with a split nut\. Wikipedia: flat crests and roots, a basic height of half the pitch/.test(row('ACME 29')) || !/basic height of 0\.3 of the pitch/.test(row('Stub ACME')) || !/^Metric trapezoidal \(Tr\) 30°/.test(row('Metric trapezoidal')))
      problems.push(`[${where}] form rows: ${row('V (ISO')} | ${row('Whitworth')} | ${row('ACME 29')} | ${row('Stub ACME')}`);
    if (!/The least friction of all forms/.test(row('Square')) || !/Engineers Post: depth and thickness are each half the pitch/.test(row('Square')) || !/up to 7° off; the other flank often 45° Takes thrust in one direction/.test(row('Buttress')) || !/30° \(DIN 405\) Fully rounded crests and roots/.test(row('Knuckle')))
      problems.push(`[${where}] square, buttress and knuckle rows: ${row('Square')} | ${row('Buttress')} | ${row('Knuckle')}`);
    if (!/^UNC Unified coarse/.test(row('UNC')) || !/^UNEF Unified extra fine/.test(row('UNEF')) || !/AFT Fasteners: Unified with a rounded root\. Wikipedia: external threads only/.test(row('UNR')) || !/^NPT American taper pipe thread/.test(row('NPT ')) || !/^NPTF Dryseal taper pipe thread/.test(row('NPTF')) || !/^ACME-G, ACME-C ACME general purpose and ACME centralizing/.test(row('ACME-G')) || !/^Pg Steel conduit thread \(Panzergewinde\), 80°/.test(row('Pg')) || !/^TPI Threads per inch/.test(row('TPI')))
      problems.push(`[${where}] abbreviation rows: ${row('UNC')} | ${row('UNR')} | ${row('NPT ')} | ${row('Pg')}`);
    const fl = rows.filter(t => /to be verified/.test(t)).map(t => t.split(' ')[0]).join(' ');
    if (fl !== 'Pipe Stub Metric Buttress Knuckle UNEF UNS NF NPTF NPSC NPSM NGT BA M Tr Rd G Pg ET,') problems.push(`[${where}] the rows with one publisher: ${fl}`);
  }
  if (!/Tr 60×18\(P9\)LH has a lead of 18 mm and a pitch of 9 mm, so two starts, and is left-hand/.test(g.all) || !/Rd 20 × 1\/8"/.test(g.all) || !/#6-32 UNC 2B/.test(g.all) || !/0\.866 of the pitch deep/.test(g.all) || !/lead = pitch × number of starts/.test(g.all) || !/the left pedal of a bicycle/.test(g.all))
    problems.push(`[${where}] figures and examples quoted from the sources are missing`);
  {
    const d = await page.$$eval('#main svg.geo', s => s.map(e => e.textContent.replace(/\s+/g, ' ')));
    if (!/pitch/.test(d[0]) || !/crest/.test(d[0]) || !/root/.test(d[0]) || !/flank/.test(d[0]) || !/thread angle/.test(d[0]) || !/half of the major \(M\), pitch \(P\) and minor \(m\) diameters/.test(d[0]) || !/Whitworth/.test(d[1]) || !/Buttress/.test(d[1]) || !/Knuckle \(round\)/.test(d[1]) || !/Square/.test(d[1])) problems.push(`[${where}] drawings: ${d.map(t => t.slice(0, 60)).join(' | ')}`);
    // The crests of the terms drawing must lie above the pitch line and the roots below it, and the pitch dimension must span exactly one tooth.
    const f = await page.$$eval('#main svg.geo', s => { const p = [...s[0].querySelectorAll('path')]; const prof = p[1].getAttribute('d'), pl = p[2].getAttribute('d'), dim = p[4].getAttribute('d'); return { crest: +prof.match(/^M30 (\d+)/)[1], depth: +prof.match(/l22 (\d+)/)[1], line: +pl.match(/M22 (\d+)/)[1], span: dim.match(/M(\d+) \d+H(\d+)/).slice(1).map(Number) }; });
    if (!(f.crest < f.line && f.line < f.crest + f.depth && f.span[1] - f.span[0] === 60)) problems.push(`[${where}] the terms drawing is drawn wrongly: ${JSON.stringify(f)}`);
    const bad = await page.$$eval('#main a[href^="#/t/"]', a => a.map(e => e.getAttribute('href').slice(4)).filter(id => !TOOLS.find(t => t.id === id)));
    if (bad.length) problems.push(`[${where}] links to pages that do not exist: ${bad.join(', ')}`);
    const links = await page.$$eval('#main a[href^="#/t/"]', a => a.map(e => e.getAttribute('href').slice(4)).join(','));
    if (links !== 'threaddata,wires,threadid,multistart,whitworth,pipethreads,acme,trapezoidal,buttress,unseries,unjunr,fastguide') problems.push(`[${where}] links to other pages: ${links}`);
  }
  // Hexagon screws, nuts and washers: the published rows, both disagreements shown, the drawing, inch nuts.
  where = 'hexhw';
  {
    const txt = async sel => (await page.$eval(sel, e => e.innerText)).replace(/\s+/g, ' ');
    await units('mm'); await mode('expert'); await open('hexhw', 300);
    await page.selectOption('#main #hs', 'metric'); await page.selectOption('#main #hz', 'M10'); await page.waitForTimeout(80);
    let t = await txt('#main #hres');
    if (!/across flats s 16\.00 mm Confirmed/.test(t) || !/Head height k \(nominal\) 6\.40 mm Confirmed/.test(t) || !/Nut height m, max 8\.40 mm Confirmed/.test(t) || !/Nut height m, min 8\.04 mm Confirmed/.test(t)) problems.push(`[${where}] M10 head and nut (BOLTS, fasteners.eu; Wermac, omdl, fasten.it): ${t}`);
    if (!/hole d1 10\.00 mm Sources differ also printed: 10\.5 \(fasteners\.eu\)/.test(t) || !/outside diameter d2 20\.00 mm Confirmed/.test(t) || !/thickness h \(nominal\) 2\.00 mm One source/.test(t) || !/least to greatest 1\.80 mm to 2\.20 mm/.test(t)) problems.push(`[${where}] M10 washer, the two printed holes side by side: ${t}`);
    const dr = await page.$eval('#main #hres .tdia svg', g => g.textContent.replace(/\s+/g, ' '));
    if (!/clamped parts/.test(dr) || !/d2/.test(dr) || !/to scale/.test(dr)) problems.push(`[${where}] drawing: ${dr}`);
    await page.selectOption('#main #hz', 'M24'); await page.waitForTimeout(80); t = await txt('#main #hres');
    if (!/Nut height m, max 21\.50 mm One source differs also printed: 19 \(fasten\.it\)/.test(t) || !/Nut height m, min 20\.20 mm One source differs also printed: 17\.7 \(fasten\.it\)/.test(t) || !/Head height k \(nominal\) 15\.00 mm Confirmed/.test(t)) problems.push(`[${where}] M24: the differing nut height must be shown, not hidden: ${t}`);
    const tabs = await page.$$eval('#main .mtab table', a => a.map(x => x.rows.length).join(','));
    if (tabs !== '13,13,13,10') problems.push(`[${where}] table rows (head, nut, washer, inch nut): ${tabs}`);
    const srcs = await page.$$eval('#main #hsrc b', a => a.length - 1);
    if (srcs !== 11) problems.push(`[${where}] publishers listed: ${srcs}`);
    await page.selectOption('#main #hs', 'inch'); await page.selectOption('#main #hz', '1/2'); await page.waitForTimeout(80); t = await txt('#main #hres');
    if (!/Width across flats 3\/4 in = 19\.05 mm One source/.test(t) || !/Thickness 7\/16 in = 11\.11 mm One source/.test(t) || !/Eugene Fastener/i.test(t)) problems.push(`[${where}] 1/2 inch nut (Eugene Fastener: 3/4 and 7/16): ${t}`);
    await units('inch'); await open('hexhw', 300); await page.selectOption('#main #hs', 'metric'); await page.selectOption('#main #hz', 'M10'); await page.waitForTimeout(80); t = await txt('#main #hres');
    if (!/across flats s 0\.6299 in Confirmed/.test(t) || !/Head height k \(nominal\) 0\.2520 in/.test(t)) problems.push(`[${where}] M10 in inch units: ${t}`);
    await units('mm');
  }

  // Spanner sizes: metric and inch widths in one list, in order of size.
  where = 'spanner';
  {
    await units('mm'); await open('spanner', 300);
    const r = await page.$$eval('#main #spx tr', a => a.map(x => x.innerText.replace(/\s+/g, ' ').trim()));
    const i19 = r.findIndex(x => /^19 mm 19 0\.748 M12 \(old DIN\)/.test(x)), i34 = r.findIndex(x => /^3\/4" 19\.0500 0\.7500 1\/2" \(ASME\)/.test(x)), i13 = r.findIndex(x => /^13 mm 13 0\.512 M8 \(ISO, old DIN\)/.test(x)), i12 = r.findIndex(x => /^1\/2" 12\.7000 0\.5000 5\/16" \(ASME\)/.test(x));
    if (i19 < 0 || i34 !== i19 + 1 || i13 < 0 || i12 !== i13 - 1) problems.push(`[${where}] order of sizes: 1/2 in before 13 mm, 19 mm before 3/4 in: ${r.slice(10, 26).join(' / ')}`);
    const mmv = r.slice(1).map(x => parseFloat(x.replace(/^.*?(mm|") /, '')));
    if (mmv.some((v, i) => i && !(v > mmv[i - 1]))) problems.push(`[${where}] the list must rise in size: ${mmv.join(' ')}`);
  }

  // Thread engagement and breaking force: the published M10 row, the Grade 5 example, both aluminium rules side by side.
  where = 'threadstrip';
  {
    const rows = async () => (await page.$$eval('#main #res .rrow', r => r.map(t => t.innerText.replace(/\s+/g, ' ').trim()))).join(' | ');
    const put = async (k, v) => { await page.fill(`#main [data-id="${k}"]`, v); await page.dispatchEvent(`#main [data-id="${k}"]`, 'input'); await page.waitForTimeout(40); };
    await units('mm'); await mode('expert'); await open('threadstrip', 150);
    await put('d', '10'); await put('p', '1.5'); await put('uts', ''); await put('le', '');
    let t = await rows();
    if (!/Tensile stress area As 57\.99 mm2/i.test(t) || !/Basic pitch diameter 9\.026 mm/.test(t) || !/\(simplified\) 14\.178 mm2\/mm/.test(t) || !/\(one source, to be verified\) 8\.180 mm/.test(t)) problems.push(`[${where}] M10 x 1.5 (Roymech row: 57.9896, 9.0257, 14.1776, 8.1805): ${t}`);
    if (!/Breaking force enter the tensile strength of the screw/.test(t)) problems.push(`[${where}] the tensile strength must never be filled in: ${t}`);
    if (!/in steel: 1 × diameter 10\.000 mm/.test(t) || !/\(Roymech only\) 15\.000 mm/.test(t) || !/2 × diameter \(Nord-Lock, Roymech\) 20\.000 mm/.test(t) || !/1\.5 × diameter \(Fastenal\) 15\.000 mm/.test(t)) problems.push(`[${where}] rules of thumb, both aluminium figures with their sources: ${t}`);
    if (!/holds only where the tapped part is as strong as the screw/.test(t) || /Your engagement/.test(t)) problems.push(`[${where}] note, and no verdict without a length: ${t}`);
    await put('uts', '800'); await put('le', '6'); t = await rows();
    if (!/Breaking force of the screw in tension 46,392 N/.test(t) || !/Your engagement below the simplified least length/.test(t)) problems.push(`[${where}] 800 MPa and 6 mm engaged: ${t}`);
    await put('le', '9'); t = await rows();
    if (!/Your engagement at or above the simplified least length/.test(t)) problems.push(`[${where}] 9 mm engaged is above 8.18 mm: ${t}`);
    const dr = await page.$eval('#main .tdia svg', g => g.textContent.replace(/\s+/g, ' '));
    if (!/d 10/.test(dr) || !/your engagement 9/.test(dr) || !/simplified least 8\.18/.test(dr) || !/threads not drawn/.test(dr)) problems.push(`[${where}] drawing: ${dr}`);
    await put('p', '12'); t = await rows();
    if (!/Pitch too coarse for this diameter/i.test(t) || /Tensile stress area/i.test(t)) problems.push(`[${where}] a 12 mm pitch on a 10 mm thread must be refused: ${t}`);
    await put('p', '1.5'); await put('uts', ''); await put('le', '');
    await units('inch'); await open('threadstrip', 150); await put('d', '0.75'); await put('tpi', '10'); await put('uts', '120000'); t = await rows();
    if (!/Tensile stress area As 0\.3345 in2/i.test(t) || !/Breaking force of the screw in tension 40,135 lbf/.test(t) || !/Basic pitch diameter 0\.6850 in/.test(t) || !/in steel: 1 × diameter 0\.7500 in/.test(t)) problems.push(`[${where}] 3/4-10 at 120 000 psi (Fastenal: 40 080 lb with the area rounded to 0.3340): ${t}`);
    await put('uts', '');
    const src = await page.innerText('#main');
    if (!/Roymech/.test(src) || !/Fastenal/.test(src) || !/FED-STD-H28 was not readable/.test(src)) problems.push(`[${where}] the source note must name Roymech and Fastenal and say what is not built`);
    await mode('advanced');
  }
  // Shop maths 2: depreciation schedule, block and tackle, squaring a corner. Published examples reproduced.
  where = 'depreciation';
  {
    const rows = async () => (await page.$$eval('#main #res .rrow', r => r.map(t => t.innerText.replace(/\s+/g, ' ').trim()))).join(' | ');
    const put = async (k, v) => { await page.fill(`#main [data-id="${k}"]`, v); await page.dispatchEvent(`#main [data-id="${k}"]`, 'input'); await page.waitForTimeout(40); };
    const pick = async (k, v) => { await page.selectOption(`#main [data-id="${k}"]`, v); await page.waitForTimeout(60); };
    await units('mm'); await mode('expert'); await open('depreciation', 150);
    await put('cost', '1000'); await put('salv', '100'); await put('life', '5'); await pick('m', '2'); await put('yr', '2');
    let t = await rows();
    if (!/Depreciation in year 2 240\.00/i.test(t) || !/Book value at the end of year 2 460\.00/.test(t) || !/Year 1: depreciation 300\.00/.test(t) || !/Year 5: depreciation 60\.00/.test(t) || !/Year 5: book value at the year end 100\.00/.test(t) || /Year 6:/.test(t)) problems.push(`[${where}] sum of the years' digits (Wikipedia: 300, 240, 180, 120, 60): ${t}`);
    await pick('m', '1'); await put('fac', '2'); await put('yr', '5'); t = await rows();
    if (!/Depreciation in year 5 29\.60/i.test(t) || !/Year 4: depreciation 86\.40/.test(t) || !/Year 4: book value at the year end 129\.60/.test(t) || !/Year 5: book value at the year end 100\.00/.test(t) || /does not reach the salvage value/.test(t)) problems.push(`[${where}] declining balance at 40 % (Wikipedia: 400, 240, 144, 86.40, 29.60): ${t}`);
    await put('salv', '0'); t = await rows();
    if (!/Year 5: book value at the year end 77\.76/.test(t) || !/does not reach the salvage value by itself/.test(t)) problems.push(`[${where}] with no salvage value the declining balance leaves 77.76 and says so: ${t}`);
    await pick('m', '0'); await put('cost', '25000'); await put('life', '8'); await put('yr', '1'); t = await rows();
    if (!/Depreciation in year 1 3,125\.00/i.test(t)) problems.push(`[${where}] straight line (CFI: 3125 a year): ${t}`);
    const dr = await page.$eval('#main .tdia svg', g => g.textContent.replace(/\s+/g, ' '));
    if (!/book value at the end of each year/.test(dr) || !/25000/.test(dr) || (await page.$$eval('#main .tdia svg rect.part', r => r.length)) !== 7) problems.push(`[${where}] drawing: seven bars above zero for eight years down to nothing: ${dr}`);
    await put('life', '2.5'); t = await rows();
    if (!/whole number of years/.test(t)) problems.push(`[${where}] a life of 2.5 years must be refused: ${t}`);
    await put('life', '8'); await put('salv', '2500');
    where = 'tackle';
    await open('tackle', 150); await put('load', '981'); await put('n', '4'); await put('eff', ''); await put('lift', ''); t = await rows();
    if (!/Pull on the rope, ideal \(no friction\) 245\.3 N/i.test(t) || /at your efficiency/.test(t) || /hauled in/.test(t) || !/rove to advantage/.test(t)) problems.push(`[${where}] ideal pull only when no efficiency is entered: ${t}`);
    await put('eff', '0.8'); await put('lift', '1'); t = await rows();
    if (!/Pull on the rope at your efficiency \(one source, to be verified\) 306\.6 N/.test(t) || !/Rope hauled in for this lift \(one source, to be verified\) 4\.00 m/.test(t)) problems.push(`[${where}] Engineering ToolBox example (307 N) and 4 m of rope for 1 m of lift: ${t}`);
    const dt = await page.$eval('#main .tdia svg', g => g.textContent.replace(/\s+/g, ' '));
    if (!/4 rope parts carry the moving block/.test(dt) || !/306\.6 N/.test(dt) || !/not to scale/.test(dt)) problems.push(`[${where}] drawing: ${dt}`);
    await put('eff', '1.2'); t = await rows();
    if (!/Efficiency must be more than 0 and not more than 1/.test(t)) problems.push(`[${where}] an efficiency above 1 must be refused: ${t}`);
    await put('n', '2.5'); t = await rows();
    if (!/must be a whole number/.test(t)) problems.push(`[${where}] 2.5 rope parts must be refused: ${t}`);
    await put('n', '4'); await put('eff', ''); await put('lift', '');
    where = 'squaring';
    await open('squaring', 150); await put('a', '900'); await put('b', '1200'); await put('c', ''); await put('run', ''); t = await rows();
    if (!/Diagonal for a square corner 1,500\.00 mm/i.test(t) || !/6-8-10, 9-12-15/.test(t) || /Angle of the corner/.test(t)) problems.push(`[${where}] 900 and 1200 give 1500: ${t}`);
    await put('c', '1500'); t = await rows();
    if (!/Angle of the corner from your diagonal 90\.000 deg/.test(t) || !/Corner square, to the three decimals shown/.test(t)) problems.push(`[${where}] a diagonal of 1500 is square: ${t}`);
    await put('c', '1510'); t = await rows();
    if (!/Angle of the corner from your diagonal 90\.(7|8)\d\d deg/.test(t) || !/wider than square/.test(t)) problems.push(`[${where}] a long diagonal means a wide corner: ${t}`);
    await put('c', '5000'); t = await rows();
    if (!/cannot make a triangle/.test(t)) problems.push(`[${where}] an impossible diagonal must be refused: ${t}`);
    await put('c', ''); await put('run', '100'); t = await rows();
    if (!/Rise over that length at the angle 1\.75 mm/.test(t)) problems.push(`[${where}] 1 degree over 100 mm rises 1.75 mm: ${t}`);
    await put('run', '');
    const ds = await page.$eval('#main .tdia svg', g => g.textContent.replace(/\s+/g, ' '));
    if (!/diagonal 1500/.test(ds) || !/to scale/.test(ds)) problems.push(`[${where}] drawing: ${ds}`);
    await mode('advanced');
  }
  // Shop maths 3: interpolation, normal shares, line and circle, conics; each against a published example.
  where = 'interp';
  {
    const rows = async () => (await page.$$eval('#main #res .rrow', r => r.map(t => t.innerText.replace(/\s+/g, ' ').trim()))).join(' | ');
    const put = async (k, v) => { await page.fill(`#main [data-id="${k}"]`, v); await page.dispatchEvent(`#main [data-id="${k}"]`, 'input'); await page.waitForTimeout(40); };
    const pick = async (k, v) => { await page.selectOption(`#main [data-id="${k}"]`, String(v)); await page.waitForTimeout(80); };
    const drawing = async () => page.$eval('#main .tdia svg', g => g.textContent.replace(/\s+/g, ' '));
    await units('mm'); await mode('expert'); await open('interp', 150);
    await pick('m', 0); await put('x1', '2'); await put('y1', '4'); await put('x2', '8'); await put('y2', '16'); await put('x', '5');
    let t = await rows();
    if (!/y at x 10\.0000/i.test(t) || !/first x to the second 0\.5000/.test(t) || /Warning/.test(t)) problems.push(`[${where}] (2, 4) and (8, 16) at 5 give 10 (FIRGELLI): ${t}`);
    await put('x', '11'); t = await rows();
    if (!/y at x 22\.0000/i.test(t) || !/Warning x lies outside the two known values/.test(t)) problems.push(`[${where}] outside the two rows must warn: ${t}`);
    await put('x2', '2'); t = await rows();
    if (!/the two x values must differ/.test(t)) problems.push(`[${where}] equal x values must be refused: ${t}`);
    await put('x1', '20'); await put('y1', '5'); await put('x2', '30'); await put('y2', '7'); await put('x', '25');
    let d = await drawing();
    if (!/\(20, 5\)/.test(d) || !/\(30, 7\)/.test(d) || !/y 6/.test(d)) problems.push(`[${where}] drawing, one-way: ${d}`);
    await pick('m', 1); await put('yg', '6'); t = await rows();
    if (!/x at y 25\.0000/i.test(t)) problems.push(`[${where}] reverse, y = 6 gives x = 25: ${t}`);
    await pick('m', 2); t = await rows();
    if (!/Value at x and y 8\.2500/i.test(t) || !/first-y edge, at x 6\.0000/.test(t) || !/second-y edge, at x 10\.5000/.test(t) || !/along y first gives the same value/.test(t)) problems.push(`[${where}] two-way table 5, 7, 9, 12 at (25, 150) gives 8.25 (mathcheck): ${t}`);
    d = await drawing();
    if (!/8\.25/.test(d) || !/10\.5/.test(d) || !/not to scale/.test(d)) problems.push(`[${where}] drawing, two-way: ${d}`);
    await put('x', '35'); t = await rows();
    if (!/Warning The point lies outside the cell/.test(t)) problems.push(`[${where}] a point outside the cell must warn: ${t}`);
    await put('x', '25'); await pick('m', 0);

    where = 'normdist';
    await open('normdist', 150); await put('mean', '20.05'); await put('sd', '0.02'); await put('lo', '20.03'); await put('hi', '20.08'); await put('p', '');
    t = await rows();
    if (!/Share between the limits 77\.45\d\d %/i.test(t) || !/z of the lower limit -1\.000/.test(t) || !/z of the upper limit 1\.500/.test(t) || !/Within 2 standard deviations of the mean 95\.45 %/.test(t) || !/Within 3 standard deviations of the mean 99\.73 %/.test(t)) problems.push(`[${where}] lathe parts 20.03 to 20.08 (IntMath: 0.7745): ${t}`);
    d = await drawing();
    if (!/lower 20\.03/.test(d) || !/upper 20\.08/.test(d) || !/77\.45 %/.test(d) || !/between the limits/.test(d)) problems.push(`[${where}] drawing: ${d}`);
    await put('lo', '20.01'); await put('hi', ''); t = await rows();
    if (!/Share below the lower limit 2\.275\d %/i.test(t) || /between the limits/i.test(t)) problems.push(`[${where}] below 20.01 (IntMath: 0.0228): ${t}`);
    await put('lo', ''); await put('mean', '3.25'); await put('sd', '0.6'); await put('p', '95'); t = await rows();
    if (!/Value with 95 % of the parts below it 4\.23\d\d/i.test(t) || !/z for that share 1\.645/.test(t)) problems.push(`[${where}] the top 5 % starts at about 4.237 (IntMath): ${t}`);
    await put('p', '100'); t = await rows();
    if (!/must be more than 0 % and less than 100 %/.test(t)) problems.push(`[${where}] a share of 100 % must be refused: ${t}`);
    await put('sd', '0'); t = await rows();
    if (!/standard deviation must be more than 0/.test(t)) problems.push(`[${where}] a zero standard deviation must be refused: ${t}`);
    await put('mean', '20.05'); await put('sd', '0.02'); await put('lo', '20.03'); await put('hi', '20.08'); await put('p', '');

    where = 'linecirc';
    await open('linecirc', 150); await put('x1', '-10'); await put('y1', '11'); await put('x2', '10'); await put('y2', '-9'); await put('cx', '3'); await put('cy', '-5'); await put('r', '3');
    t = await rows();
    if (!/First point, X 3\.000 mm/.test(t) || !/First point, Y -2\.000 mm/.test(t) || !/Second point, X 6\.000 mm/.test(t) || !/Second point, Y -5\.000 mm/.test(t) || !/Angle of the line from the X axis -45\.0000 deg/.test(t) || !/Chord between the two points 4\.243 mm/.test(t)) problems.push(`[${where}] Rosetta Code case (3, -2) and (6, -5): ${t}`);
    d = await drawing();
    if (!/\(3, -2\)/.test(d) || !/\(6, -5\)/.test(d) || !/to scale, mm, Y upwards/.test(d)) problems.push(`[${where}] drawing: ${d}`);
    await put('x1', '5'); await put('y1', '0'); await put('x2', '5'); await put('y2', '20'); await put('cx', '10'); await put('cy', '10'); await put('r', '5'); t = await rows();
    if (!/the line touches the circle \(tangent\)/.test(t) || !/Tangent point, X 5\.000 mm/.test(t) || !/Tangent point, Y 10\.000 mm/.test(t) || !/parallel to the Y axis/.test(t)) problems.push(`[${where}] the line x = 5 touches the circle at (5, 10) (Rosetta Code): ${t}`);
    await put('x1', '0'); await put('y1', '10'); await put('x2', '1'); await put('y2', '13'); await put('cx', '0'); await put('cy', '0'); await put('r', '3'); t = await rows();
    if (!/Distance from the circle centre to the line 3\.162 mm/.test(t) || !/the line misses the circle/.test(t) || /First point/.test(t)) problems.push(`[${where}] y = 3x + 10 misses the circle of radius 3 (Mathwords): ${t}`);
    await put('x2', '0'); await put('y2', '10'); t = await rows();
    if (!/the two points must not be the same/.test(t)) problems.push(`[${where}] two equal points must be refused: ${t}`);
    await put('x1', '-10'); await put('y1', '11'); await put('x2', '10'); await put('y2', '-9'); await put('cx', '3'); await put('cy', '-5'); await put('r', '3');

    where = 'conics';
    await open('conics', 150); await pick('k', 0); await put('a', '5'); await put('b', '3'); await put('x', '4'); t = await rows();
    if (!/Centre to each focus, c 4\.000 mm/i.test(t) || !/Eccentricity c \/ a 0\.80000/.test(t) || !/Y of the curve at X \(above and below the long axis\) 1\.800 mm/.test(t)) problems.push(`[${where}] ellipse 5 and 3 has c = 4 (NUM8ERS): ${t}`);
    d = await drawing();
    if (!/focus/.test(d) || !/a 5/.test(d) || !/c 4/.test(d)) problems.push(`[${where}] ellipse drawing: ${d}`);
    await put('a', '2'); t = await rows();
    if (!/enter the longer half-axis as a/.test(t)) problems.push(`[${where}] a shorter than b must be refused for an ellipse: ${t}`);
    await put('a', '4'); await pick('k', 2); await put('x', ''); t = await rows();
    if (!/Centre to each focus, c 5\.000 mm/i.test(t) || !/Eccentricity c \/ a 1\.25000/.test(t) || !/Slope of the asymptotes, b \/ a 0\.75000/.test(t)) problems.push(`[${where}] hyperbola 4 and 3 has c = 5 and slope 3/4 (NUM8ERS): ${t}`);
    d = await drawing();
    if (!/asymptote/.test(d) || !/focus/.test(d)) problems.push(`[${where}] hyperbola drawing: ${d}`);
    await put('x', '2'); t = await rows();
    if (!/lies between the two branches/.test(t)) problems.push(`[${where}] a point between the branches must be refused: ${t}`);
    await put('x', ''); await pick('k', 1); await put('w', '2'); await put('d', '2'); t = await rows();
    if (!/Focal length \(vertex to focus\) 0\.125 mm/i.test(t) || !/latus rectum\) 0\.500 mm/.test(t) || !/rim to rim \(one source\) 4\.647 mm/.test(t)) problems.push(`[${where}] the dish of y = 2x² has the focal length 1/8 (NUM8ERS): ${t}`);
    d = await drawing();
    if (!/width 2/.test(d) || !/depth 2/.test(d) || !/focus, 0\.125 above the vertex/.test(d)) problems.push(`[${where}] parabola drawing: ${d}`);
    await pick('k', 0); await put('a', '5'); await put('b', '3');

    // Formula library: the trig identities can be found by name.
    where = 'formulas';
    await open('formulas', 200);
    const fq = await page.$('#main input[type="search"]');
    if (fq) { await fq.fill('Trig identities'); await fq.dispatchEvent('input'); await page.waitForTimeout(150); const ft = (await page.$eval('#main', e => e.innerText)).replace(/\s+/g, ' '); if (!/sum and difference of two angles/i.test(ft) || !/sin 2A = 2 sin A cos A/.test(ft) || !/Joyce/.test(ft)) problems.push(`[${where}] trig identities in the formula library: ${ft.slice(0, 400)}`); await fq.fill(''); await fq.dispatchEvent('input'); }
    else problems.push(`[${where}] no search box in the formula library`);
    await mode('advanced');
  }

  // Binomial and Poisson (0.7.0, sixth batch): published examples, refusals, the bar chart; coordinates in the CNC guide; families of plastics.
  where = 'distrib';
  {
    const rows = async () => (await page.$$eval('#main #res .rrow', r => r.map(t => t.innerText.replace(/\s+/g, ' ').trim()))).join(' | ');
    const put = async (k, v) => { await page.fill(`#main [data-id="${k}"]`, v); await page.dispatchEvent(`#main [data-id="${k}"]`, 'input'); await page.waitForTimeout(40); };
    const pick = async (k, v) => { await page.selectOption(`#main [data-id="${k}"]`, String(v)); await page.waitForTimeout(80); };
    const drawing = async () => page.$eval('#main .tdia svg', g => g.textContent.replace(/\s+/g, ' '));
    await units('mm'); await mode('expert'); await open('distrib', 150);
    await pick('m', 0); await put('n', '10'); await put('p', '40'); await put('k', '4'); await put('k2', '');
    let t = await rows();
    if (!/Chance of exactly 4 25\.0823 %/i.test(t) || !/Mean count 4\.0000/.test(t) || !/Standard deviation of the count 1\.5492/.test(t)) problems.push(`[${where}] Bin(10, 0.4), count 4 (Newcastle: 0.251, mean 4): ${t}`);
    await put('k', '2'); t = await rows();
    if (!/Chance of 2 or fewer 16\.7290 %/.test(t) || !/Chance of 2 or more 95\.3643 %/.test(t)) problems.push(`[${where}] Bin(10, 0.4), count 2 (Newcastle: 0.167 and 0.954): ${t}`);
    await put('n', '300'); await put('p', '1'); await put('k', '5'); t = await rows();
    if (!/Chance of exactly 5 10\.0985 %/i.test(t) || !/Poisson estimate of exactly 5 \(mean = trials × chance\) 10\.0819 %/.test(t)) problems.push(`[${where}] 300 trials at 1 %, count 5 (IntMath: 0.10099 and 0.10082): ${t}`);
    let d = await drawing();
    if (!/10\.1 %/.test(d) || !/exactly 5 \(filled bar\)/.test(d) || !/Binomial, 300 trials at 1 %/.test(d) || !/mean 3/.test(d)) problems.push(`[${where}] drawing, binomial: ${d}`);
    if ((await page.$$eval('#main .tdia svg rect.hotf', r => r.length)) !== 1) problems.push(`[${where}] exactly one filled bar expected for a single count`);
    await put('k', '301'); t = await rows();
    if (!/cannot happen/.test(t) || !/Chance of exactly 301 0\.0000 %/i.test(t)) problems.push(`[${where}] a count above the number of trials: ${t}`);
    await put('k', '5'); await put('n', '10.5'); t = await rows();
    if (!/whole number from 1 to 100 000/.test(t)) problems.push(`[${where}] 10.5 trials must be refused: ${t}`);
    await put('n', '300'); await put('p', '120'); t = await rows();
    if (!/the chance must be from 0 to 100 %/.test(t)) problems.push(`[${where}] a chance of 120 % must be refused: ${t}`);
    await put('p', '1'); await put('k2', '3'); t = await rows();
    if (!/not below the count/.test(t)) problems.push(`[${where}] an upper count below the count must be refused: ${t}`);
    await pick('m', 1); await put('mu', '3'); await put('k', '2'); await put('k2', '4'); t = await rows();
    if (!/Chance of 2 to 4 61\.6115 %/.test(t) || !/Chance of 2 or more 80\.0852 %/.test(t) || !/Standard deviation of the count 1\.7321/.test(t) || /Poisson estimate/.test(t)) problems.push(`[${where}] Poisson, mean 3, 2 to 4 (IntMath: 0.61611): ${t}`);
    d = await drawing();
    if (!/61\.61 %/.test(d) || !/count 2 to 4 \(filled bars\)/.test(d) || !/Poisson, mean 3/.test(d)) problems.push(`[${where}] drawing, Poisson: ${d}`);
    if ((await page.$$eval('#main .tdia svg rect.hotf', r => r.length)) !== 3) problems.push(`[${where}] three filled bars expected for counts 2 to 4`);
    await put('mu', '2.3'); await put('k', '3'); await put('k2', ''); t = await rows();
    if (!/Chance of 3 or more 40\.396\d %/.test(t)) problems.push(`[${where}] Poisson, mean 2.3, 3 or more (IntMath: 0.40396): ${t}`);
    await put('mu', '-1'); t = await rows();
    if (!/the mean count must be from 0 to 100 000/.test(t)) problems.push(`[${where}] a negative mean must be refused: ${t}`);
    await put('mu', '3'); await put('k', '2'); await pick('m', 0); await put('n', '50'); await put('p', '2');

    where = 'cncguide';
    await open('cncguide', 250);
    const ex = (await page.$eval('#main #cgex', e => e.innerText)).replace(/\s+/g, ' ');
    if (!/length 50\.000, angle 36\.87°/.test(ex) || !/X18\.549 Y6\.412 and X36\.651 Y19\.988/.test(ex) || !/5\.359 on the radius/.test(ex)) problems.push(`[${where}] worked coordinate examples: ${ex}`);
    if (!(await page.$('#main h2#c-geo')) || !(await page.$('#main .gtoc a[href="#c-geo"]'))) problems.push(`[${where}] no "Working out coordinates" section or contents entry`);
    const dead = await page.evaluate(() => [...document.querySelectorAll('#main a[href^="#/t/"]')].map(a => a.getAttribute('href').slice(4)).filter(i => !TOOLS.find(x => x.id === i)));
    if (dead.length) problems.push(`[${where}] links to pages that do not exist: ${dead.join(', ')}`);
    const geoLinks = await page.$$eval('#main a[href^="#/t/"]', a => a.map(x => x.getAttribute('href').slice(4)));
    for (const id of ['triangle', 'linecirc', 'fillet', 'arc', 'bolt', 'tnrc']) if (!geoLinks.includes(id)) problems.push(`[${where}] no link to ${id}`);

    where = 'plastics';
    await open('plastics', 350);
    await page.selectOption('#main #plp', 'POM'); await page.waitForTimeout(80);
    let pt = (await page.$eval('#main #plres', e => e.innerText)).replace(/\s+/g, ' ');
    if (!/Family Semi-crystalline thermoplastic Polymershapes, Xometry Confirmed/.test(pt)) problems.push(`[${where}] acetal must show its family with two publishers: ${pt.slice(0, 300)}`);
    await page.selectOption('#main #plp', 'PEI'); await page.waitForTimeout(80);
    pt = (await page.$eval('#main #plres', e => e.innerText)).replace(/\s+/g, ' ');
    if (!/Family Amorphous thermoplastic Ensinger[^|]*Mitsubishi/.test(pt)) problems.push(`[${where}] PEI must show as amorphous from Ensinger and Mitsubishi: ${pt.slice(0, 300)}`);
    await page.selectOption('#main #plp', 'PTFE'); await page.waitForTimeout(80);
    pt = (await page.$eval('#main #plres', e => e.innerText)).replace(/\s+/g, ' ');
    if (!/Family Semi-crystalline thermoplastic Polymershapes One source/.test(pt)) problems.push(`[${where}] PTFE rests on one publisher and must say so: ${pt.slice(0, 300)}`);
    await page.selectOption('#main #plp', 'POM'); await page.waitForTimeout(60);
    const fam = await page.evaluate(() => ({ rows: document.querySelectorAll('#main #plfam tr').length - 1, differ: document.querySelectorAll('#main #plfam .badge.differs').length, all: document.querySelectorAll('#main #plfamall tr').length - 1, one: document.querySelectorAll('#main #plfamall .badge.review').length, text: document.querySelector('#main #plfam').innerText.replace(/\s+/g, ' ') }));
    if (fam.rows !== 14 || fam.differ !== 2 || fam.all !== 12 || fam.one !== 3) problems.push(`[${where}] families: ${fam.rows} rows (14), ${fam.differ} differing (2), ${fam.all} plastics (12), ${fam.one} on one source (3)`);
    if (!/TWI: thermoplastics are typically more expensive/.test(fam.text) || !/Xometry: most thermoplastics are priced lower/.test(fam.text) || !/sharp melting point/.test(fam.text)) problems.push(`[${where}] families text: ${fam.text.slice(0, 400)}`);
    if (await page.evaluate(() => document.querySelector('#main').scrollWidth > document.querySelector('#main').clientWidth + 1)) problems.push(`[${where}] the page scrolls sideways`);

    where = 'formulas';
    await open('formulas', 200);
    const fq2 = await page.$('#main input[type="search"]');
    if (fq2) { await fq2.fill('Poisson'); await fq2.dispatchEvent('input'); await page.waitForTimeout(150); const ft = (await page.$eval('#main', e => e.innerText)).replace(/\s+/g, ' '); if (!/Poisson: chance of exactly k/i.test(ft) || !/IntMath/.test(ft)) problems.push(`[${where}] Poisson in the formula library: ${ft.slice(0, 400)}`); await fq2.fill(''); await fq2.dispatchEvent('input'); }
    await mode('advanced');
  }

  // Seventh batch of 0.7.0: units, signs and letters for quantities on the symbols page; the decimal places setting for all
  // calculators; broken tap removal with two publishers for each method; algebra in the formula library.
  where = 'symbols-2';
  {
    await units('mm'); await mode('expert'); await open('symbols', 300);
    const tab = async id => page.$$eval('#main #' + id + ' tr', r => r.slice(1).map(t => t.innerText.replace(/\s+/g, ' ').trim()));
    let r = await tab('symsys');
    if (r.length !== 3 || !/yard is exactly 0\.9144 m and the avoirdupois pound exactly 0\.45359237 kg, so the inch is exactly 25\.4 mm\. Confirmed Wikipedia, NIST$/.test(r[1]) || !/One source Wikipedia$/.test(r[2])) problems.push(`[${where}] systems of units: ${r.join(' ; ')}`);
    r = await tab('symbase');
    if (r.length !== 7 || r[0] !== 'length metre m Confirmed NIST, Wikipedia' || !r.includes('thermodynamic temperature kelvin K Confirmed NIST, Wikipedia') || r.some(x => !/Confirmed/.test(x))) problems.push(`[${where}] base units: ${r.join(' ; ')}`);
    r = await tab('symder');
    if (r.length !== 22 || !r.includes('pressure, stress pascal Pa N/m² Confirmed NIST, Wikipedia') || !r.includes('force newton N m·kg·s−2 (base units, NIST) Confirmed NIST, Wikipedia') || !r.includes('power, radiant flux watt W J/s Confirmed NIST, Wikipedia') || r.some(x => !/Confirmed/.test(x))) problems.push(`[${where}] derived units: ${r.length} rows: ${r.join(' ; ')}`);
    r = await tab('symsig');
    if (r.length !== 26 || !r.includes('≈ is approximately equal to Confirmed Electronics Notes, mathcentre (Loughborough University), Wikipedia') || !r.includes('∥ is parallel to One source Wikipedia') || r.filter(x => /One source/.test(x)).length !== 3) problems.push(`[${where}] mathematical signs: ${r.length} rows: ${r.join(' ; ')}`);
    r = await tab('symqty');
    if (r.length !== 37 || !r.some(x => /^Pressure p: Wikipedia and BYJU'S; P: The Physics Hypertextbook p or P Pa Sources differ/.test(x)) || !r.some(x => /^Force F N Confirmed/.test(x)) || !r.some(x => /^Stress σ Pa One source The Physics Hypertextbook$/.test(x)) || r.filter(x => /Sources differ/.test(x)).length !== 3) problems.push(`[${where}] letters for quantities: ${r.length} rows: ${r.join(' ; ')}`);
    if (await page.evaluate(() => ['symsys', 'symbase', 'symder', 'symsig', 'symqty'].some(id => { const e = document.querySelector('#main #' + id); return e.scrollWidth > e.clientWidth + 1; }))) problems.push(`[${where}] a table is wider than its frame`);
    if (!(await page.$('#main a[href="#/t/units"]'))) problems.push(`[${where}] no link to the unit converter`);

    where = 'decimal places';
    await open('taper', 200);
    const first = async () => (await page.$$eval('#main #res .rrow', x => x.slice(0, 1).map(t => t.innerText.replace(/\s+/g, ' ').trim()))).join('');
    const std = await first();
    await page.click('#menubtn'); await page.waitForTimeout(100);
    await page.click('#menupop #mdp button[data-v="2"]'); await page.waitForTimeout(150);
    const more = await first();
    await page.click('#menupop #mdp button[data-v="-1"]'); await page.waitForTimeout(150);
    const fewer = await first();
    await page.click('#menupop #mdp button[data-v="0"]'); await page.waitForTimeout(150);
    const back = await first();
    const places = s => ((s.match(/\d+\.(\d+)/) || [])[1] || '').length;
    if (!(places(std) > 0) || places(more) !== places(std) + 2 || places(fewer) !== places(std) - 1 || back !== std) problems.push(`[${where}] the setting for all calculators: standard "${std}", two more "${more}", one fewer "${fewer}", back "${back}"`);
    await page.evaluate(() => { document.querySelector('#menupop').hidden = true; });

    where = 'toolguide broken taps';
    await open('toolguide', 300);
    const bt = await page.evaluate(() => { const h = document.querySelector('#main #t-brk'); const out = []; let n = h.nextElementSibling; while (n && n.tagName !== 'H2') { if (n.querySelector('abbr.gsrc')) out.push({ t: n.innerText.replace(/\s+/g, ' '), k: n.querySelectorAll('abbr.gsrc').length, need: !!n.querySelector('.gtbv') }); n = n.nextElementSibling; } return out; });
    if (bt.length !== 7 || bt.some(x => x.k < 2 || x.need)) problems.push(`[${where}] each of the seven statements needs two publishers: ${bt.map(x => x.k + (x.need ? '!' : '')).join(',')}`);
    if (!bt.some(x => /^Chemical/.test(x.t) && /for aluminium parts only/.test(x.t)) || !bt.some(x => /^EDM/.test(x.t) && /must conduct electricity/.test(x.t))) problems.push(`[${where}] text: ${bt.map(x => x.t.slice(0, 60)).join(' ; ')}`);

    where = 'formulas algebra';
    await open('formulas', 200);
    const fq3 = await page.$('#main input[type="search"]');
    if (fq3) { await fq3.fill('Algebra'); await fq3.dispatchEvent('input'); await page.waitForTimeout(150); const ft = (await page.$eval('#main', e => e.innerText)).replace(/\s+/g, ' '); if (!/6 of \d+ formulas/.test(ft) || !/x = \(−b ± √\(b² − 4ac\)\) \/ \(2a\)/.test(ft) || !/log_b x = ln x \/ ln b/.test(ft) || !/single source/i.test(ft)) problems.push(`[${where}] algebra in the formula library: ${ft.slice(0, 500)}`); await fq3.fill(''); await fq3.dispatchEvent('input'); }
    await mode('advanced');
  }

  // Eighth batch of 0.7.0: thread and ball micrometers, thread mills, threading on a CNC lathe, subprograms with worked
  // examples, and belt against chain against gears. Each section is read back with its source tags.
  where = 'guides-8';
  {
    await units('mm'); await mode('expert');
    const sect = async (tool, id) => { await open(tool, 300); return page.evaluate(i => { const h = document.querySelector('#main #' + i); if (!h) return []; const out = []; let n = h.nextElementSibling; while (n && n.tagName !== 'H2') { out.push({ t: n.innerText.replace(/\s+/g, ' ').trim(), k: n.querySelectorAll('abbr.gsrc').length, need: !!n.querySelector('.gtbv'), tag: n.tagName }); n = n.nextElementSibling; } return out; }, id); };
    const has = (s, re, k, need) => s.some(x => re.test(x.t) && x.k === k && x.need === need);
    const linksOk = async id => page.evaluate(i => { const h = document.querySelector('#main #' + i); let n = h && h.nextElementSibling, ok = !!h; while (n && n.tagName !== 'H2') { n.querySelectorAll('a[href^="#/t/"]').forEach(a => { if (!TOOLS.some(t => t.id === a.getAttribute('href').slice(4))) ok = false; }); n = n.nextElementSibling; } return ok; }, id);

    let s = await sect('measguide', 'mz-thr');
    if (s.filter(x => x.k > 0).length !== 10 || !has(s, /^Thread micrometer\..*reads the pitch diameter/, 2, false) || !has(s, /^It will not agree with wires/, 1, true) || !has(s, /^Ball micrometer/, 2, false) || !(await linksOk('mz-thr'))) problems.push(`[${where}] thread and ball micrometers: ${s.map(x => x.k + (x.need ? '!' : '') + ' ' + x.t.slice(0, 30)).join(' ; ')}`);

    s = await sect('toolguide', 't-tm');
    if (s.filter(x => x.k > 0).length !== 18 || !has(s, /^Climb milling a right-hand internal thread: start at the bottom and go round counter-clockwise/, 3, false) || !has(s, /^Partial-profile cutters/, 1, true) || !has(s, /^Blind holes\..*within half a pitch/, 2, false) || !(await page.$('#main button.tglink[data-id="cyctmill"]'))) problems.push(`[${where}] thread mills: ${s.map(x => x.k + (x.need ? '!' : '') + ' ' + x.t.slice(0, 30)).join(' ; ')}`);

    s = await sect('latheguide', 'l-thread');
    if (s.filter(x => x.k > 0).length !== 18 || !has(s, /^G32, one move per block/, 2, false) || !has(s, /^More than one start\. The lead is the pitch times the number of starts/, 3, false) || !has(s, /Q180000 is 180°/, 1, true) || !has(s, /^An ordinary outside taper thread, small at the front, takes a negative value/, 2, false) || !(await linksOk('l-thread'))) problems.push(`[${where}] lathe threading: ${s.map(x => x.k + (x.need ? '!' : '') + ' ' + x.t.slice(0, 30)).join(' ; ')}`);

    s = await sect('cncguide', 'c-sub');
    const pre = await page.$$eval('#main pre.gcode', a => a.filter(e => /^csub/.test(e.id)).map(e => e.textContent));
    if (s.filter(x => x.k > 0).length !== 11 || !has(s, /^Call and return\. M98 with P/, 3, false) || !has(s, /^M99 in the main program/, 1, true) || pre.length !== 3 || !/M98 P2000[\s\S]*O2000[\s\S]*G91 G01 Z-7\. F100\.[\s\S]*G90[\s\S]*M99/.test(pre[0]) || !/M98 P3000 L4/.test(pre[1]) || !/M97 P500 L4[\s\S]*M30\nN500 G91/.test(pre[2]) || !(await linksOk('c-sub'))) problems.push(`[${where}] subprograms: ${s.map(x => x.k + (x.need ? '!' : '') + ' ' + x.t.slice(0, 30)).join(' ; ')} | ${pre.length} examples`);

    s = await sect('driveguide', 'dv-cmp');
    const cmp = await page.$$eval('#main #dvcmp tr', r => r.map(t => Array.from(t.children).map(c => c.innerText.replace(/\s+/g, ' ').trim())));
    if (cmp.length !== 10 || cmp[0].join('|') !== '|Belt|Chain|Gears|Sources' || !/^Slip$/.test(cmp[1][0]) || !/No slip/.test(cmp[1][2]) || !/up to 98 % \(UNC Charlotte\)/.test(cmp[2][2]) || !/The sources differ/.test(cmp[8][2]) || !/to be verified/.test(cmp[9][4]) || /to be verified/.test(cmp[1][4]) || !(await linksOk('dv-cmp'))) problems.push(`[${where}] belt, chain or gears: ${cmp.map(r => r.join(' / ').slice(0, 80)).join(' ; ')}`);
    if (await page.evaluate(() => { const e = document.querySelector('#main #dvcmp .cntab'); return e.scrollWidth > e.clientWidth + 1; })) problems.push(`[${where}] the drives table is wider than its frame`);
    await mode('advanced');
  }

  // Ninth batch of 0.7.0: sump care and the mist limit, bench grinder checks, tap rake and tapping fluids, counterbores,
  // counterfeit fasteners, and the chemical spot tests on the metal identification page.
  where = 'guides-9';
  {
    await units('mm'); await mode('expert');
    const sect = async (tool, id, stop) => { await open(tool, 300); return page.evaluate(([i, st]) => { const h = document.querySelector('#main #' + i); if (!h) return []; const out = []; let n = h.nextElementSibling; while (n && !st.includes(n.tagName)) { out.push({ t: n.innerText.replace(/\s+/g, ' ').trim(), k: n.querySelectorAll('abbr.gsrc').length, need: !!n.querySelector('.gtbv') }); n = n.nextElementSibling; } return out; }, [id, stop]); };
    const has = (s, re, k, need) => s.some(x => re.test(x.t) && x.k === k && x.need === need);
    const brief = s => s.map(x => x.k + (x.need ? '!' : '') + ' ' + x.t.slice(0, 28)).join(' ; ');

    let s = await sect('shoptools', 'st-sump', ['H2', 'H3']);
    if (s.length !== 10 || !has(s, /^Mixing\. Concentrate goes into the water/, 2, false) || !has(s, /^Topping up\. Never plain water/, 1, true) || !has(s, /^Tramp oil/, 3, false)) problems.push(`[${where}] sump care: ${brief(s)}`);
    s = await sect('shoptools', 'st-mist', ['H2', 'H3']);
    if (s.length !== 5 || !has(s, /^A limit for mist\. NIOSH recommends no more than 0\.4 mg\/m³ .* or 0\.5 mg\/m³ as total particulate, averaged over a working day of up to 10 hours/, 2, false) || !has(s, /^No compressed air/, 1, true)) problems.push(`[${where}] mist and skin: ${brief(s)}`);
    s = await sect('shoptools', 'st-bench', ['H2', 'H3']);
    if (s.filter(x => x.k > 0).length !== 11 || !has(s, /^Ring test\..*A cracked wheel sounds dead and must not be used/, 2, false) || !has(s, /^Work rest\. No more than 1\/8 in \(3\.2 mm\)/, 3, false) || !has(s, /^Tongue guard\..*no more than 1\/4 in \(6\.4 mm\)/, 3, false) || !has(s, /^Stand to one side/, 1, true)) problems.push(`[${where}] bench grinders: ${brief(s)}`);

    s = await sect('toolguide', 't-rake', ['H2', 'H3']);
    if (s.filter(x => x.k > 0).length !== 5 || !has(s, /^Rake \(hook\)\. The angle of the cutting face is matched to the work material/, 2, false) || !has(s, /^Negative hook/, 1, true) || !s.some(x => /No rake angles in degrees are given here/.test(x.t))) problems.push(`[${where}] tap rake: ${brief(s)}`);
    s = await sect('toolguide', 't-tfluid', ['H2', 'H3']);
    if (s.filter(x => x.k > 0).length !== 2 || !has(s, /^By material \(AIMS\)\..*Cast iron: dry where possible/, 1, true) || !(await page.$('#main button.tglink[data-id="shoptools"]'))) problems.push(`[${where}] tapping fluids: ${brief(s)}`);

    s = await sect('fastguide', 'fg-cb', ['H2']);
    if (s.filter(x => x.k > 0).length !== 8 || !has(s, /^Counterbore\. A larger hole with a flat bottom/, 3, false) || !has(s, /^A spotface has no symbol of its own/, 1, true) || !s.some(x => /⌴/.test(x.t))) problems.push(`[${where}] counterbores: ${brief(s)}`);
    s = await sect('fastguide', 'fg-fake', ['H2']);
    if (s.filter(x => x.k > 0).length !== 8 || !has(s, /^Two marks on the head/, 2, false) || !has(s, /^The US law\. The Fastener Quality Act of 1990/, 2, false) || !has(s, /^It covers metal bolts, nuts, screws and studs of 6 mm \(1\/4 in\) and larger/, 1, true)) problems.push(`[${where}] counterfeit fasteners: ${brief(s)}`);

    await open('metalid', 300);
    const mt = await page.$$eval('#main .mtab', t => Array.from(t[0].querySelectorAll('tr')).map(r => r.innerText.replace(/\s+/g, ' ').trim()));
    const mrow = k => mt.find(t => t.startsWith(k)) || '';
    if (mt.length !== 11 || !/Sources differ/.test(mrow('Nitric acid: stainless or not')) || !/Atlas Steels.*EngineerExcel/.test(mrow('Nitric acid: stainless or not')) || !/darkens within 2 to 4 minutes.*One source/.test(mrow('Molybdenum spot test: 304 from 316')) || !/One source/.test(mrow('Sulphur print: free-machining steel')) || !/Confirmed/.test(mrow('Magnet and stainless')) || !/Confirmed/.test(mrow('When it matters'))) problems.push(`[${where}] metal identification tests: ${mt.length} rows: ${mt.map(t => t.slice(0, 50)).join(' ; ')}`);
    await mode('advanced');
  }

  // Tenth batch of 0.7.0: retaining compounds, sealants and structural adhesives, ratchets, elliptical gears, factors of safety,
  // and the fourth axis in the toolpath guide.
  where = 'guides-10';
  {
    await units('mm'); await mode('expert');
    const sect = async (tool, id, stop) => { await open(tool, 300); return page.evaluate(([i, st]) => { const h = document.querySelector('#main #' + i); if (!h) return []; const out = []; let n = h.nextElementSibling; while (n && !st.includes(n.tagName)) { out.push({ t: (n.innerText || n.textContent || "").replace(/\s+/g, ' ').trim(), k: n.querySelectorAll('abbr.gsrc').length, need: !!n.querySelector('.gtbv') }); n = n.nextElementSibling; } return out; }, [id, stop]); };
    const has = (s, re, k, need) => s.some(x => re.test(x.t) && x.k === k && x.need === need);
    const brief = s => s.map(x => x.k + (x.need ? '!' : '') + ' ' + x.t.slice(0, 28)).join(' ; ');

    let s = await sect('bearguide', 'bg-ret', ['H2']);
    if (s.filter(x => x.k > 0).length !== 11 || !has(s, /^What they are\. Anaerobic adhesives for plain round joints, not for threads/, 2, false) || !has(s, /^The gap\. Typically up to 0\.25 mm .*Incure adds up to 0\.5 mm for some grades/, 2, false) || !has(s, /^Heat\. Grades differ/, 1, true)) problems.push(`[${where}] retaining compounds: ${brief(s)}`);
    s = await sect('bearguide', 'bg-tseal', ['H2']);
    if (s.filter(x => x.k > 0).length !== 17 || !has(s, /^PTFE tape and fluid power\..*AIMS: never on hydraulic fittings/, 2, false) || !has(s, /^Flange gap\. Up to 0\.5 mm at most/, 2, false) || !has(s, /^Tape colours \(AIMS, Australia\)/, 1, true) || !has(s, /^Cut gaskets/, 1, true)) problems.push(`[${where}] thread and flange sealants: ${brief(s)}`);
    s = await sect('bearguide', 'bg-struct', ['H2']);
    {
      const rows = await page.$$eval('#main table.gtab', t => Array.from(t[t.length - 1].querySelectorAll('tr')).map(r => r.innerText.replace(/\s+/g, ' ').trim()));
      const row = k => rows.find(t => t.startsWith(k)) || '';
      if (rows.length !== 5 || !/best all-round strength on metals/.test(row('Epoxy')) || /to be verified/.test(row('Epoxy')) || !/Smell and heat while it cures \(Gluegun\.com\)/.test(row('Acrylic (MMA)')) || !/sensitive to moisture/.test(row('Polyurethane')) || !/white bloom.*to be verified/.test(row('Cyanoacrylate'))) problems.push(`[${where}] structural adhesive rows: ${rows.join(' | ')}`);
    }
    if (s.filter(x => x.k > 0).length !== 7 || !has(s, /^Preparation decides/, 2, false) || !has(s, /^Temperature\. Two-part adhesives cure faster when warm.*60 to 80 °F/, 1, true)) problems.push(`[${where}] structural adhesives: ${brief(s)}`);

    s = await sect('elemguide', 'me-rat', ['H2']);
    if (s.filter(x => x.k > 0).length !== 9 || !has(s, /^Lopsided teeth\. One flank of each tooth is a gentle slope, the other is steep/, 2, false) || !has(s, /^Running back\..*up to one tooth spacing/, 2, false) || !has(s, /^Tooth count\..*72 teeth needs a swing of 5°/, 1, true)) problems.push(`[${where}] ratchets: ${brief(s)}`);
    if (!(await page.$('#main svg.geo[aria-label^="A ratchet wheel with twelve lopsided teeth"]'))) problems.push(`[${where}] the ratchet drawing is missing`);
    s = await sect('elemguide', 'me-ell', ['H2']);
    if (s.filter(x => x.k > 0).length !== 7 || !has(s, /^About a focus\./, 2, false) || !has(s, /^How far the ratio swings\. Between 1\/K and K.*up to 3 for a unilobe and up to 2 for a bilobe/, 1, true) || !s.some(x => /No formula for the speed at each angle is given here/.test(x.t))) problems.push(`[${where}] elliptical gears: ${brief(s)}`);
    s = await sect('elemguide', 'me-fos', ['H2']);
    {
      const rows = await page.$$eval('#main table.gtab', t => t.slice(-2).map(x => Array.from(x.querySelectorAll('tr')).map(r => r.innerText.replace(/\s+/g, ' ').trim())));
      const row = (i, k) => rows[i].find(t => t.startsWith(k)) || '';
      if (rows[0].length !== 7 || rows[1].length !== 9 || !/not less than 10 EE_FOS ?to be verified/.test(row(0, 'Repeated shock')) || !/^Buildings 2\.0 for each structural member 4 to 6 \(structural steel work\) WP_FOS ?ETB_FOS$/.test(row(1, 'Buildings')) || !/^Pressure vessels 3\.5 to 4\.0 3\.5 to 6 /.test(row(1, 'Pressure vessels')) || !/^Bolts no figure 8\.5 ETB_FOS ?to be verified/.test(row(1, 'Bolts'))) problems.push(`[${where}] factor of safety tables: ${rows[0].join(' | ')} || ${rows[1].join(' | ')}`);
    }
    if (s.filter(x => x.k > 0).length !== 10 || !has(s, /^What the factor is\..*the load at failure divided by the load allowed/, 2, false) || !has(s, /^Typical figures, two publishers side by side\. Where both print a figure they do not agree/, 2, false) || !has(s, /^Codes come first/, 1, true)) problems.push(`[${where}] factors of safety: ${brief(s)}`);

    s = await sect('toolpaths', 'tp-4ax', ['H2', 'H3']);
    if (s.filter(x => x.k > 0).length !== 7 || !has(s, /^Indexing \(3\+1\)\. The rotary axis turns the part to an angle and stops/, 2, false) || !has(s, /^Continuous 4-axis\..*a cam lobe is the usual example/, 2, false) || !has(s, /^Wrapping\./, 2, false) || !has(s, /^Feed on a move that turns the axis/, 1, true)) problems.push(`[${where}] fourth axis: ${brief(s)}`);
    await open('toolguide', 300);
    const taps = await page.$$eval('#main p', ps => ps.map(p => ({ t: p.innerText.replace(/\s+/g, ' ').trim(), k: p.querySelectorAll('abbr.gsrc').length, need: !!p.querySelector('.gtbv') })));
    if (!has(taps, /^Pipe taps cut the internal threads of pipe fittings/, 2, false) || !has(taps, /^Extension taps are taps with a long shank/, 2, false) || !has(taps, /^Interrupted thread taps have a tooth on every other thread only/, 2, false) || !has(taps, /^Combined drill and tap/, 1, true)) problems.push(`[${where}] other kinds of tap: ${brief(taps.filter(x => /taps? /.test(x.t.slice(0, 30))))}`);
    await mode('advanced');
  }

  // Eleventh batch of 0.7.0: hardenability, case hardening and machinability, vibration in general and balancing in place,
  // tightening methods, and which of speed, feed and depth to change.
  where = 'guides-11';
  {
    await units('mm'); await mode('expert');
    const sect = async (tool, id, stop) => { await open(tool, 300); return page.evaluate(([i, st]) => { const h = document.querySelector('#main #' + i); if (!h) return []; const out = []; let n = h.nextElementSibling; while (n && !st.includes(n.tagName)) { out.push({ t: (n.innerText || n.textContent || '').replace(/\s+/g, ' ').trim(), k: n.querySelectorAll('abbr.gsrc').length, need: !!n.querySelector('.gtbv') }); n = n.nextElementSibling; } return out; }, [id, stop]); };
    const has = (s, re, k, need) => s.some(x => re.test(x.t) && x.k === k && x.need === need);
    const brief = s => s.map(x => x.k + (x.need ? '!' : '') + ' ' + x.t.slice(0, 28)).join(' ; ');

    let s = await sect('matguide', 'mg-harden', ['H2']);
    if (s.filter(x => x.k > 0).length !== 8 || !has(s, /^Hardness and hardenability are two things/, 2, false) || !has(s, /^The Jominy end-quench test\. A standard bar 25\.4 mm in diameter and 102 mm long/, 3, false) || !has(s, /^From the bar to a part/, 1, true)) problems.push(`[${where}] hardenability: ${brief(s)}`);
    s = await sect('matguide', 'mg-case', ['H2']);
    {
      const rows = await page.$$eval('#main #mg-case + p + div table.gtab tr', r => r.map(t => t.innerText.replace(/\s+/g, ' ').trim()));
      const row = k => rows.find(t => t.startsWith(k)) || '';
      if (rows.length !== 7 || !/815 to 980 °C in gas or liquid.*usually below 950 °C.*up to 1\.5 mm.*0\.2 to 2 mm TM_SH ?OU_PNC$/.test(row('Carburising')) || !/480 to 590 °C in gas/.test(row('Nitriding')) || /to be verified/.test(row('Nitriding')) || !/975 to 1125 °F.*to be verified/.test(row('Ferritic nitrocarburising')) || !/no figure in the sources read/.test(row('Induction hardening'))) problems.push(`[${where}] case hardening rows: ${rows.join(' | ')}`);
    }
    if (s.filter(x => x.k > 0).length !== 12 || !has(s, /^Quench or not\..*Nitrided parts are not quenched/, 2, false) || !has(s, /^Frequency and depth/, 1, true) || !s.some(x => /only cells that read cleanly are quoted/.test(x.t))) problems.push(`[${where}] case hardening: ${brief(s)}`);
    s = await sect('matguide', 'mg-mach', ['H2']);
    if (s.filter(x => x.k > 0).length !== 9 || !has(s, /^The rating in per cent\. The free-cutting steel B1112 is set at 100 %/, 2, false) || !has(s, /^No agreed measure/, 1, true)) problems.push(`[${where}] machinability: ${brief(s)}`);

    s = await sect('driveguide', 'dv-vth', ['H2', 'H3']);
    if (s.filter(x => x.k > 0).length !== 8 || !has(s, /^Resonance\. When the forcing frequency comes close to a natural frequency/, 2, false) || !has(s, /^Damping takes energy out/, 1, true) || !s.some(x => /No formula for the natural frequency is printed here/.test(x.t))) problems.push(`[${where}] vibration in general: ${brief(s)}`);
    s = await sect('driveguide', 'dv-bal', ['H2', 'H3']);
    if (s.filter(x => x.k > 0).length !== 9 || !has(s, /^Is it unbalance\?.*80 % or more of the total/, 2, false) || !has(s, /^The runs\. 1\. A reference run/, 2, false) || !has(s, /^Size of the trial weight\..*30\/30 rule/, 2, false) || !has(s, /^Trim runs\. Reliable Plant: no more than two/, 1, true)) problems.push(`[${where}] balancing in place: ${brief(s)}`);

    s = await sect('fastguide', 'fg-tight', ['H2']);
    if (s.filter(x => x.k > 0).length !== 10 || !has(s, /^Torque plus angle\..*30 Nm, then 90 degrees/, 2, false) || !has(s, /^Tightening to yield/, 2, false) || !has(s, /^Where the torque goes\. Usually 85 to 95 %/, 1, true) || !s.some(x => /Neither source prints the scatter/.test(x.t))) problems.push(`[${where}] tightening methods: ${brief(s)}`);

    s = await sect('cncguide', 'c-cond', ['H2']);
    if (s.filter(x => x.k > 0).length !== 8 || !has(s, /^Speed wears the tool fastest\..*20 % more speed halves the tool life, 50 % more leaves a fifth/, 2, false) || !has(s, /^The order \(Seco\)\. Take the largest depth of cut/, 1, true) || !(await page.$('#main .gtoc a[href="#c-cond"]'))) problems.push(`[${where}] speed, feed and depth: ${brief(s)}`);
    await mode('advanced');
  }

  // Twelfth batch of 0.7.0: the tensile test, heat and cold, steels by use, band speeds, grinding carbide and turning holders.
  where = 'guides-12';
  {
    await units('mm'); await mode('expert');
    const sect = async (tool, id, stop) => { await open(tool, 300); return page.evaluate(([i, st]) => { const h = document.querySelector('#main #' + i); if (!h) return []; const out = []; let n = h.nextElementSibling; while (n && !st.includes(n.tagName)) { out.push({ t: (n.innerText || n.textContent || '').replace(/\s+/g, ' ').trim(), k: n.querySelectorAll('abbr.gsrc').length, need: !!n.querySelector('.gtbv') }); n = n.nextElementSibling; } return out; }, [id, stop]); };
    const has = (s, re, k, need) => s.some(x => re.test(x.t) && x.k === k && x.need === need);
    const brief = s => s.map(x => x.k + (x.need ? '!' : '') + ' ' + x.t.slice(0, 28)).join(' ; ');
    const rowsOf = async sel => page.$$eval(sel, r => r.map(t => t.innerText.replace(/\s+/g, ' ').trim()));

    let s = await sect('matguide', 'mg-tens', ['H2']);
    if (s.filter(x => x.k > 0).length !== 12 || !has(s, /^The straight part\..*Young's modulus/, 3, false) || !has(s, /^Proof stress\..*0\.2 %, written Rp0\.2/, 1, true) || !has(s, /^Tensile strength\. The highest stress on the curve/, 3, false) || !(await page.$('#main #mg-tens + svg.geo'))) problems.push(`[${where}] tensile test: ${brief(s)}`);
    s = await sect('matguide', 'mg-temp', ['H2']);
    if (s.filter(x => x.k > 0).length !== 8 || !has(s, /^But steel turns brittle\./, 2, false) || !has(s, /^Which steels\..*around 0 °C.*Below -100 °C/, 1, true) || !has(s, /^Creep\..*450 to 550 °C/, 1, true)) problems.push(`[${where}] heat and cold: ${brief(s)}`);
    {
      const rows = await rowsOf('#main #mg-use + div table.gtab tr');
      const row = k => rows.find(t => t.startsWith(k)) || '';
      if (rows.length !== 11 || !/^4340 Crankshafts, heavy-duty axles, aircraft parts 4330, 4340: aerospace, defence, high-stress parts AIMS_SG ?CS_SG$/.test(row('4340')) || !/to be verified/.test(row('52100')) || /to be verified/.test(row('8620'))) problems.push(`[${where}] steels by use: ${rows.join(' | ')}`);
    }

    s = await sect('shoptools', 'st-band', ['H2', 'H3']);
    {
      const rows = await rowsOf('#main #st-band + div table.gtab tr');
      const row = k => rows.find(t => t.startsWith(k)) || '';
      if (rows.length !== 8 || !/^Cast iron 46 to 75 33 to 75 \(grey iron\) 80 to 100 EXC_BS ?LFC_BS ?NILS_BS$/.test(row('Cast iron')) || !/to be verified/.test(row('Alloy steel')) || /to be verified/.test(row('Tool steel'))) problems.push(`[${where}] band speeds: ${rows.join(' | ')}`);
    }
    if (s.filter(x => x.k > 0).length !== 5 || !has(s, /^Short, hard chips: the sources differ\./, 2, false) || !has(s, /^With fluid LFC allows up to 15 % more feed/, 1, true) || !s.some(x => /None of them says which kind of blade/.test(x.t))) problems.push(`[${where}] band speed notes: ${brief(s)}`);
    s = await sect('shoptools', 'st-carb', ['H2', 'H3']);
    if (s.filter(x => x.k > 0).length !== 10 || !has(s, /^Green silicon carbide is the bench grinder wheel for tungsten carbide/, 3, false) || !has(s, /^Grit \(UKAM\)\. 80 to 120 .* 230 to 325/, 1, true) || !s.some(x => /Not found in the pages read/.test(x.t))) problems.push(`[${where}] grinding carbide: ${brief(s)}`);

    s = await sect('toolguide', 't-hold', ['H2']);
    if (s.filter(x => x.k > 0).length !== 12 || !has(s, /^Shank\. Take the largest shank/, 2, false) || !has(s, /^The letter M is described in two ways/, 2, false) || !has(s, /^Hand\. A right-hand holder/, 1, true) || !(await page.$('#main button.tglink[data-id="holdercode"]'))) problems.push(`[${where}] turning holders: ${brief(s)}`);
    await mode('advanced');
  }

  // Thirteenth batch of 0.7.0: back-up rings, surface grinding, faults in cylindrical grinding, dressing diamonds, choosing a tool steel.
  where = 'guides-13';
  {
    await units('mm'); await mode('expert');
    const sect = async (tool, id, stop) => { await open(tool, 300); return page.evaluate(([i, st]) => { const h = document.querySelector('#main #' + i); if (!h) return []; const out = []; let n = h.nextElementSibling; while (n && !st.includes(n.tagName)) { out.push({ t: (n.innerText || n.textContent || '').replace(/\s+/g, ' ').trim(), k: n.querySelectorAll('abbr.gsrc').length, need: !!n.querySelector('.gtbv') }); n = n.nextElementSibling; } return out; }, [id, stop]); };
    const has = (s, re, k, need) => s.some(x => re.test(x.t) && x.k === k && x.need === need);
    const brief = s => s.map(x => x.k + (x.need ? '!' : '') + ' ' + x.t.slice(0, 28)).join(' ; ');
    const rowsOf = async sel => page.$$eval(sel, r => r.map(t => t.innerText.replace(/\s+/g, ' ').trim()));

    let s = await sect('bearguide', 'bg-bu', ['H2']);
    if (s.filter(x => x.k > 0).length !== 10 || !has(s, /^What they are for\./, 3, false) || !has(s, /^When, the sources differ\. Marco Rubber: above 1500 psi.*about 5 MPa \(50 bar\)/, 2, false) || !has(s, /^An example \(Apple Rubber\)\. At 1000 psi .* 0\.016 in/, 1, true) || !(await page.$('#main #bg-bu ~ p a[href="#/t/oring"]'))) problems.push(`[${where}] back-up rings: ${brief(s)}`);

    s = await sect('abrasguide', 'ag-surf', ['H2']);
    if (s.filter(x => x.k > 0).length !== 11 || !has(s, /^The wheel for the work\. Aluminium oxide for steel/, 2, false) || !has(s, /^Down feed, the sources differ\..*0\.001 in \(0\.025 mm\).*0\.1 to 0\.4 mm/, 2, false) || !has(s, /^Cross feed, the sources differ\..*1\/4 to 1\/12.*75 to 90 %/, 3, false) || !has(s, /^Table speed\. Most often 50 to 100 ft\/min/, 1, true)) problems.push(`[${where}] surface grinding: ${brief(s)}`);
    s = await sect('abrasguide', 'ag-fault', ['H2']);
    {
      const rows = await rowsOf('#main #ag-fault + div table.gtab tr');
      const row = k => rows.find(t => t.startsWith(k)) || '';
      if (rows.length !== 9 || !/RAD_CG ?OKU_CH ?UG_ERR$/.test(row('Chatter marks')) || /to be verified/.test(row('Burn marks')) || !/to be verified/.test(row('Flat spots'))) problems.push(`[${where}] grinding faults: ${rows.join(' | ')}`);
    }
    if (s.filter(x => x.k > 0).length !== 6 || !has(s, /^Why work burns\./, 1, true) || !s.some(x => /could not be paired with certainty/.test(x.t))) problems.push(`[${where}] grinding fault notes: ${brief(s)}`);

    s = await sect('shoptools', 'st-dd', ['H2', 'H3']);
    {
      const rows = await rowsOf('#main #st-dd ~ div table.gtab tr');
      const row = k => rows.find(t => t.startsWith(k)) || '';
      if (!/^0\.50 ct 3000 to 12000 7000 FLEX_DD ?ORG_DD$/.test(row('0.50 ct')) || !/to be verified/.test(row('3 ct'))) problems.push(`[${where}] dressing diamonds: ${row('0.50 ct')} | ${row('3 ct')}`);
    }
    if (s.filter(x => x.k > 0).length !== 5 || !has(s, /^Drag angle\..*5 to 15 degrees/, 3, false) || !has(s, /^Turn the diamond/, 1, true) || !s.some(x => /a 200 x 25 mm wheel \(5000\)/.test(x.t))) problems.push(`[${where}] dressing diamonds: ${brief(s)}`);

    s = await sect('matguide', 'mg-tsel', ['H2', 'H3']);
    if (s.filter(x => x.k > 0).length !== 9 || !has(s, /^Wear against toughness\./, 2, false) || !has(s, /^General cold work\. O1, A2 and D2/, 3, false) || !has(s, /^When the tool fails \(Crucible\)\..*after EDM/, 1, true)) problems.push(`[${where}] choosing a tool steel: ${brief(s)}`);
    await mode('advanced');
  }

  // Glossary: own wording, every link opens a page that exists, and the search narrows the list.
  where = 'glossary';
  await open('glossary', 150);
  {
    const q = async v => { await page.fill('#main [data-k="q"]', v); await page.waitForTimeout(60); return page.evaluate(() => ({ note: document.querySelector('#glres p.desc').innerText, terms: [...document.querySelectorAll('#glres tr td:first-child')].map(t => t.innerText), bad: [...document.querySelectorAll('#glres a[href^="#/t/"]')].map(a => a.getAttribute('href').slice(4)).filter(id => !TOOLS.find(t => t.id === id)), links: document.querySelectorAll('#glres a').length })); };
    let r = await q('');
    if (r.note !== '108 of 108 terms shown.' || r.terms.length !== 108 || new Set(r.terms).size !== 108) problems.push(`[${where}] 108 different terms: ${r.note} ${r.terms.length}`);
    if (r.bad.length || r.links < 90) problems.push(`[${where}] every link must open a page: ${r.bad.join(', ')} (${r.links} links)`);
    r = await q('turret');
    if (r.terms.join(' | ') !== 'Bar feeder, bar puller | Live tool (driven tool) | Turret') problems.push(`[${where}] search for turret: ${r.terms.join(' | ')}`);
    r = await q('no such word');
    if (r.note !== '0 of 108 terms shown.') problems.push(`[${where}] a search with no match: ${r.note}`);
    await q('');
  }
  where = 'chamfermill';
  const rows = async () => (await page.$$eval('#main #res .rrow', r => r.map(t => t.innerText.replace(/\s+/g, ' ').trim()))).join(' | ');
  const put = async (k, v) => { await page.fill(`#main [data-id="${k}"]`, v); await page.dispatchEvent(`#main [data-id="${k}"]`, 'input'); await page.waitForTimeout(40); };
  await units('mm'); await open('chamfermill', 150);
  await put('w', '1.5'); await page.selectOption('#main [data-id="ang"]', '90'); await put('tip', '2'); await put('c', '0.5'); await put('d', '10');
  let t = await rows();
  if (!/Tip below the top face \(Z depth\) 2\.0000 mm/i.test(t) || !/Tool centre out from the wall 1\.5000 mm/.test(t) || !/Chamfer depth down the wall 1\.5000 mm/.test(t) || !/Cutting diameter at the top of the chamfer 6\.0000 mm/.test(t) || !/Widest chamfer this cutter reaches 3\.5000 mm/.test(t))
    problems.push(`[${where}] 1.5 chamfer, 90 deg, tip 2, clearance 0.5, cutter 10: ${t}`);
  let d = await page.$eval('#main .tdia svg', e => e.textContent.replace(/\s+/g, ' '));
  if (!/Z 2/.test(d) || !/w 1\.5/.test(d) || !/1\.5/.test(d)) problems.push(`[${where}] drawing: ${d}`);
  await page.selectOption('#main [data-id="ang"]', '60'); await put('tip', '0'); await put('c', '0'); await put('w', '1'); t = await rows();
  // A 60 degree tool: depth = 1 / tan 30 = 1.7321.
  if (!/Tip below the top face \(Z depth\) 1\.7321 mm/i.test(t)) problems.push(`[${where}] 60 degree tool, 1 mm chamfer is 1.7321 deep: ${t}`);
  await put('w', '6'); t = await rows();
  if (!/wider than this cutter can reach/.test(t)) problems.push(`[${where}] a chamfer wider than the cutter reaches must be flagged: ${t}`);
  await put('w', '0'); t = await rows();
  if (/Tip below/i.test(t)) problems.push(`[${where}] no result without a width: ${t}`);
  await put('w', '1'); await page.selectOption('#main [data-id="ang"]', '90'); await put('c', '0.5'); await put('d', '');
  await units('inch');
}
where = 'machinetapers jarno';
{
  await units('inch'); await open('machinetapers', 200);
  await page.selectOption('#main #tf', 'jarno'); await page.waitForTimeout(80);
  let r = await page.$$eval('#main #tres tr', t => t.slice(1).map(x => x.innerText.replace(/\s+/g, ' ').trim()));
  if (r.length !== 19 || !/^No\. 8 1\.0000 in .* Confirmed 0\.8000 in .* Confirmed 4\.0000 in .* Confirmed 0\.6000 in\/ft included angle 2\.86\d+ deg Confirmed$/.test(r[6]) || r.some(x => /Differs|One source/i.test(x)))
    problems.push(`[${where}] Jarno table: ${r.length} rows; No. 8: ${r[6]}`);
  if (!/large end is N\/8 in, the small end N\/10 in and the length N\/2 in/.test(await page.innerText('#main #tnote'))) problems.push(`[${where}] the Jarno rule is not stated`);
  await page.selectOption('#main #tf', 'brownsharpe'); await page.waitForTimeout(80);
  r = await page.$$eval('#main #tres tr', t => t.slice(1).map(x => x.innerText.replace(/\s+/g, ' ').trim()));
  if (r.length !== 18 || !/^No\. 4 0\.4207 in .* also 0\.40233 0\.3500 in .* Confirmed 1\.6900 in .* also 1\.2500/.test(r[3]) || !/^No\. 10 .* 0\.5161 in\/ft/.test(r[9]) || !/^No\. 1 0\.2392 in .* Confirmed 0\.2000 in .* Confirmed 0\.9375 in .* Confirmed/.test(r[0]))
    problems.push(`[${where}] Brown & Sharpe table: ${r.length} rows; No. 1: ${r[0]} ; No. 4: ${r[3]} ; No. 10: ${r[9]}`);
  await page.selectOption('#main #tf', 'morse'); await page.waitForTimeout(60);
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
// The old shop trig functions: versed sine 1 - cos, exsecant sec - 1, and the reciprocals.
for (const [ex, want] of [['versin(60)', '0.5'], ['exsec(60) + cot(45)', '2'], ['sec(60) * csc(30)', '4'], ['coversin(30)', '0.5']]) {
  await page.fill(ce, ex);
  const got = ((await page.textContent('#main .bcalc .bc-res')) || '').trim();
  if (got !== '= ' + want) problems.push(`[${where}] ${ex}: expected "= ${want}", got "${got}"`);
}
await page.fill(ce, '3-7/16 * 2');
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
