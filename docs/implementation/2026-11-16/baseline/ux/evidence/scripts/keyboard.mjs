// Keyboard and flow checks on the baseline prototype: real key presses into the native textarea
// and controls. fast=1 runs the 30 s clock 10x faster (labelled in every record); nothing else is faked.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const { chromium } = await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE)).href);
const BASE = process.env.BASE ?? 'http://127.0.0.1:5312';
const OUT = path.resolve(here, '..');
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const checks = [];
const check = (id, width, pass, observed) => { checks.push({ id, width, pass: Boolean(pass), observed }); console.log(pass ? 'PASS' : 'FAIL', width, id, JSON.stringify(observed)); };

async function open(context, query) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`${BASE}/index.html?${query}`);
  await page.waitForSelector('body[data-ready="1"]');
  await page.waitForTimeout(200);
  return { page, errors };
}
const active = page => page.evaluate(() => { const a = document.activeElement; return a?.id || `${a?.tagName.toLowerCase()}:${(a?.textContent ?? '').trim().slice(0, 30)}`; });
const stageState = page => page.evaluate(() => document.querySelector('#stage')?.dataset.state);
const label = page => page.evaluate(() => document.querySelector('#block-identity')?.textContent);
const slot = page => page.evaluate(() => document.querySelector('#exercise-warning')?.textContent ?? '');
const progressNow = page => page.evaluate(() => [...document.querySelectorAll('ui-progress.baseline-progress')].map(p => p.getAttribute('aria-valuenow')));
async function finishRun(page) {
  await page.keyboard.type('the w', { delay: 40 });
  await page.waitForFunction(() => document.querySelector('#stage')?.dataset.state === 'completed', null, { timeout: 8000 });
  await page.waitForTimeout(600);
}

for (const [width, height] of [[1440, 900], [390, 844], [320, 640]]) {
  const context = await browser.newContext({ viewport: { width, height } });

  // K1 first visit: focused native textarea, first key starts the run, nothing intercepted.
  { const { page, errors } = await open(context, 'page=practice&fx=s0&qwerty=0');
    const focus = await active(page); await page.keyboard.press('t');
    check('K1 first visit ready, first key starts', width, focus === 'typing-input' && await stageState(page) === 'running' && !errors.length, { focus, stage: await stageState(page), value: await page.inputValue('#typing-input'), errors });
    await page.close(); }

  // K2 locked Suggested is keyboard-reachable; arrowing onto it cancels the change and explains.
  { const { page } = await open(context, 'page=practice&fx=s4');
    await page.focus('#practice-kind ui-segmented-control-item[value="general"]');
    await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
    const observed = await page.evaluate(() => ({ focus: document.activeElement?.getAttribute('value') ?? document.activeElement?.id, kindValue: document.querySelector('#practice-kind')?.value, suggestedChecked: document.querySelector('#suggested-item')?.hasAttribute('data-checked'), ariaDisabled: document.querySelector('#suggested-item')?.getAttribute('aria-disabled') }));
    const said = await slot(page);
    check('K2 locked suggested reachable by arrow, change cancelled, slot explains', width, observed.focus === 'recommended' && !observed.suggestedChecked && /10 baseline tests/.test(said), { ...observed, slot: said });
    // Enter/Space on the focused locked key also explains and keeps the value.
    await page.keyboard.press('Space');
    check('K2b Space on locked key keeps value', width, !(await page.evaluate(() => document.querySelector('#suggested-item')?.hasAttribute('data-checked'))), { slot: await slot(page) });
    // The slot action is reachable by Tab and leads to the assessment page.
    const action = page.locator('#exercise-warning a.key');
    check('K2c slot action present', width, await action.count() === 1, { text: await action.textContent().catch(() => null) });
    await page.close(); }

  // K2d pointer press on the locked key explains too and leaves General selected.
  { const { page } = await open(context, 'page=practice&fx=s0&qwerty=0');
    await page.click('#suggested-item', { force: true }); // aria-disabled fails Playwright actionability; a real mouse click still lands await page.waitForTimeout(100);
    const observed = await page.evaluate(() => ({ kindValue: document.querySelector('#practice-kind')?.value, checked: document.querySelector('#suggested-item')?.hasAttribute('data-checked') }));
    check('K2d pointer press on locked suggested explains, General kept', width, observed.kindValue === 'general' && !observed.checked && /10 baseline tests/.test(await slot(page)), { ...observed, slot: await slot(page) });
    await page.close(); }

  // K3 why? opens by keyboard, panel names the count.
  { const { page } = await open(context, 'page=practice&fx=s4');
    await page.focus('#why button'); await page.keyboard.press('Enter'); await page.waitForTimeout(150);
    const text = await page.evaluate(() => document.querySelector('#why-panel')?.hidden ? '' : document.querySelector('#why-panel')?.textContent ?? '');
    check('K3 why? opens with Enter and explains progress', width, /4 of 10/.test(text) && /mistakes included/.test(text), { excerpt: text.trim().slice(0, 120) });
    await page.close(); }

  // K4 baseline test flow: type -> result in place, focus on next test, Enter -> test 6 ready and focused.
  { const { page, errors } = await open(context, 'page=assessment&fx=s4&fast=1');
    const before = await label(page);
    await finishRun(page);
    const after = { focus: await active(page), label: await page.evaluate(() => document.querySelector('.result-label')?.textContent), progress: await progressNow(page) };
    check('K4 test 5 completes in place, counted after save, next test focused', width, /Baseline test 5 of 10/.test(before ?? '') && after.focus === 'primary' && after.progress.includes('5'), { before, ...after, clock: 'accelerated 10x' });
    await page.keyboard.press('Enter'); await page.waitForTimeout(250);
    const next = { focus: await active(page), label: await label(page), stage: await stageState(page) };
    check('K4b Enter continues to test 6, focus in textarea', width, next.focus === 'typing-input' && /6 of 10/.test(next.label ?? '') && next.stage === 'idle', next);
    await page.keyboard.press('a');
    check('K4c first key starts test 6', width, await stageState(page) === 'running' && !errors.length, { stage: await stageState(page), errors });
    await page.close(); }

  // K5 focus lost during a test: flagged, not counted, nothing subtracted.
  { const { page } = await open(context, 'page=assessment&fx=s4&fast=1');
    await page.keyboard.type('th', { delay: 40 }); await page.keyboard.press('Tab');
    await page.waitForFunction(() => document.querySelector('#stage')?.dataset.state === 'completed', null, { timeout: 8000 });
    await page.waitForTimeout(300);
    const text = await page.evaluate(() => document.querySelector('#baseline-result')?.textContent ?? '');
    check('K5 interrupted test not counted, count unchanged', width, /Not counted/.test(text) && (await progressNow(page)).includes('4') && await active(page) === 'primary', { text: text.trim().slice(0, 100), primary: await page.textContent('#primary') });
    await page.close(); }

  // K6 failed save: pending, Tab order, retry counts it.
  { const { page } = await open(context, 'page=assessment&fx=s4&view=result&outcome=savefail');
    const order = [await active(page)];
    for (let i = 0; i < 4; i++) { await page.keyboard.press('Tab'); order.push(await active(page)); }
    const pending = await progressNow(page);
    // r2: retry saving is the result's focused primary (review finding 6), so Enter retries.
    await page.focus('#primary'); const primaryText = await page.textContent('#primary'); await page.keyboard.press('Enter'); await page.waitForTimeout(500);
    check('K6 save failure: retry saving primary, Enter retries, then counts', width, /retry saving/.test(primaryText ?? '') && order[0] === 'primary' && pending.includes('4') && (await progressNow(page)).includes('5'), { primary: primaryText, tabOrder: order, before: pending, after: await progressNow(page) });
    await page.close(); }

  // K7 final test to Suggested: Enter on try suggested lands on / ready, Suggested checked, focused.
  { const { page } = await open(context, 'page=assessment&fx=s9&fast=1&final=ready');
    await finishRun(page);
    const primary = await page.textContent('#primary');
    await page.keyboard.press('Enter'); await page.waitForURL(/page=practice/); await page.waitForSelector('body[data-ready="1"]'); await page.waitForTimeout(200);
    const after = { focus: await active(page), label: await label(page), checked: await page.evaluate(() => document.querySelector('#suggested-item')?.hasAttribute('data-checked')) };
    check('K7 test 10 -> try suggested -> ready Suggested practice', width, /try suggested/.test(primary ?? '') && after.focus === 'typing-input' && /Suggested practice · th/i.test(after.label ?? '') && after.checked, { primary, ...after });
    await page.close(); }

  // K8 final test with no supported focus: General is primary and nothing reads as failure.
  { const { page } = await open(context, 'page=assessment&fx=s9&fast=1&final=insufficient');
    await finishRun(page);
    const text = await page.evaluate(() => document.querySelector('#baseline-result')?.textContent ?? '');
    check('K8 complete-insufficient keeps General primary', width, /practise general/.test(await page.textContent('#primary') ?? '') && !/fail|level|weak/i.test(text), { primary: await page.textContent('#primary'), text: text.trim().slice(0, 120) });
    await page.close(); }

  // K9 no global key interception on the result: letters do nothing; Enter only acts on the focused key.
  { const { page } = await open(context, 'page=assessment&fx=s4&view=result&outcome=saved');
    await page.keyboard.press('x');
    check('K9 letter on result is not intercepted', width, await stageState(page) === 'completed' && await active(page) === 'primary', { stage: await stageState(page) });
    await page.close(); }

  // K10 reset: confirm focuses the safe choice; Tab + Enter starts over; status announced.
  { const { page } = await open(context, 'page=progress&fx=s4');
    await page.focus('#reset'); await page.keyboard.press('Enter');
    const safe = await active(page);
    await page.keyboard.press('Tab'); await page.keyboard.press('Enter'); await page.waitForTimeout(100);
    const after = { focus: await active(page), status: await page.textContent('#baseline-status'), progress: await progressNow(page) };
    check('K10 reset confirm safe-first, start over -> 0 of 10', width, safe === 'keep' && after.focus === 'baseline-heading' && after.progress.includes('0') && /0 of 10/.test(after.status ?? ''), { safe, ...after });
    await page.close(); }

  await context.close();
}
await browser.close();
fs.writeFileSync(path.join(OUT, 'keyboard.json'), JSON.stringify({ base: BASE, chrome: 'system Chrome headless via playwright-core 1.65.1', ranAt: new Date().toISOString(), note: 'fast=1 accelerates the prototype clock 10x; all data simulated', passed: checks.filter(c => c.pass).length, total: checks.length, checks }, null, 2));
console.log(`${checks.filter(c => c.pass).length}/${checks.length} passed`);
