// F-1 forced-colors selected-state capture. Usage: node capture.cjs <before|after>
// Needs playwright-core@1.65.1 installed outside the repo (PW_CORE env = that folder) and
// `vite preview --host 127.0.0.1 --port 5313 --strictPort` serving the build under test.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {chromium} = require(path.join(process.env.PW_CORE, 'node_modules', 'playwright-core'));
const BASE = 'http://127.0.0.1:5313';
const label = process.argv[2];
if (!['before', 'after'].includes(label)) throw new Error('label must be before|after');
const OUT = path.join(__dirname, label);
fs.mkdirSync(OUT, {recursive: true});
const BROWSERS = [
  {name: 'chrome', executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe'},
  {name: 'msedge', executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'},
].filter(b => fs.existsSync(b.executablePath));
const VIEWPORTS = [{name: '1440', width: 1440, height: 900}, {name: '390', width: 390, height: 844}];
const SEED = 20261116;
const seeded = `(() => { let a = ${SEED} >>> 0; Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();`;
const FIXED = new Date('2026-11-16T12:00:00Z');
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const captures = [];

const rail = page => page.evaluate(() => {
  const pick = e => { const c = getComputedStyle(e); return {
    id: e.id || null, text: e.textContent.trim(), value: e.getAttribute('value'),
    dataChecked: e.hasAttribute('data-checked'), ariaChecked: e.getAttribute('aria-checked'),
    dataDisabled: e.hasAttribute('data-disabled'), ariaDisabled: e.getAttribute('aria-disabled'), tabIndex: e.tabIndex,
    background: c.backgroundColor, color: c.color, borderColor: c.borderTopColor, borderStyle: c.borderTopStyle,
    forcedColorAdjust: c.forcedColorAdjust, boxShadow: c.boxShadow,
  }; };
  return [...document.querySelectorAll('#rail ui-segmented-control-item, #rail ui-switch')].map(pick);
});
const focusInfo = page => page.evaluate(() => {
  const e = document.activeElement; const c = getComputedStyle(e);
  return {tag: e.tagName.toLowerCase(), id: e.id || null, text: e.textContent.trim(), dataChecked: e.hasAttribute('data-checked'),
    focusVisible: e.matches(':focus-visible'), outlineStyle: c.outlineStyle, outlineWidth: c.outlineWidth, outlineColor: c.outlineColor,
    outlineOffset: c.outlineOffset, background: c.backgroundColor};
});
const geometry = page => page.evaluate(() => {
  // Active line top = top of the cursor glyph (first glyph when idle); rail height = #rail box height.
  const cursor = document.querySelector('#prompt span.cursor') ?? document.querySelector('#prompt span');
  return {activeLineTop: cursor.getBoundingClientRect().top, railHeight: document.querySelector('#rail').getBoundingClientRect().height};
});
async function shot(page, run, name) {
  await page.mouse.move(2, 2);
  const file = path.join(OUT, `${run.browser}-${run.viewport}-${run.theme}-${name}.png`);
  await page.screenshot({path: file});
  captures.push({file: path.relative(__dirname, file).replace(/\\/g, '/'), sha256: sha(file)});
  return path.basename(file);
}
async function idle(page) {
  await page.waitForFunction(() => document.querySelector('#stage')?.dataset.state === 'idle' && !document.querySelector('#typing-input').disabled);
  await page.locator('#prompt span').first().waitFor();
}
async function open(browser, viewport, forced) {
  const context = await browser.newContext({viewport: {width: viewport.width, height: viewport.height}, forcedColors: forced ? 'active' : 'none', reducedMotion: 'reduce'});
  const page = await context.newPage();
  await page.addInitScript(seeded);
  await page.clock.install({time: FIXED});
  await page.clock.pauseAt(new Date(FIXED.getTime() + 1000));
  await page.goto(BASE + '/');
  await idle(page);
  return {context, page};
}

(async () => {
  const report = {label, base: BASE, generatedAt: new Date().toISOString(), seed: SEED, runs: []};
  for (const b of BROWSERS) {
    const browser = await chromium.launch({executablePath: b.executablePath, headless: true});
    const version = browser.version();
    for (const vp of VIEWPORTS) {
      // Forced colours: ready, 15 + pair, qwerty on, keyboard focus on a checked key.
      {
        const run = {browser: b.name, version, viewport: vp.name, theme: 'forced', steps: {}};
        const {context, page} = await open(browser, vp, true);
        run.matchesForcedColors = await page.evaluate(() => matchMedia('(forced-colors: active)').matches);
        run.steps.ready = {shot: await shot(page, run, 'ready'), rail: await rail(page)};
        await page.locator('#duration ui-segmented-control-item[value="15"]').click();
        await idle(page);
        await page.locator('#practice-kind ui-segmented-control-item[value="manual"]').click();
        await idle(page);
        run.steps.fifteenPair = {shot: await shot(page, run, '15-pair'), rail: await rail(page)};
        await page.locator('#qwerty').click();
        await idle(page);
        run.steps.qwertyOn = {shot: await shot(page, run, 'qwerty-on'), rail: await rail(page)};
        // Disabled suggested: a forced click must leave it unchecked and unfocused.
        const suggested = page.locator('#suggested-item');
        if (await suggested.count()) {
          await suggested.click({force: true, timeout: 2000}).catch(() => {});
          run.steps.suggestedAfterClick = await suggested.evaluate(e => ({dataChecked: e.hasAttribute('data-checked'), ariaChecked: e.getAttribute('aria-checked'), dataDisabled: e.hasAttribute('data-disabled'), tabIndex: e.tabIndex, isActive: document.activeElement === e}));
        }
        // Keyboard focus: Tab from the top of the document until a checked rail key has focus.
        await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
        const tabbed = [];
        for (let i = 0; i < 40; i++) {
          await page.keyboard.press('Tab');
          const f = await focusInfo(page); tabbed.push(`${f.tag}${f.id ? '#' + f.id : ''}:${f.text.slice(0, 12)}`);
          if (f.tag === 'ui-segmented-control-item' && f.dataChecked) break;
        }
        run.steps.focusCheckedKey = {tabPath: tabbed, focus: await focusInfo(page), shot: await shot(page, run, 'focus-checked-key')};
        // Further Tabs: next group's checked key (disabled suggested must be skipped), then qwerty.
        const after = [];
        for (let i = 0; i < 3; i++) { await page.keyboard.press('Tab'); after.push(await focusInfo(page)); }
        run.steps.focusFollowing = after;
        await context.close();
        report.runs.push(run);
      }
      // Normal theme: ready and running screenshots plus active-line top and rail height.
      {
        const run = {browser: b.name, version, viewport: vp.name, theme: 'normal', steps: {}};
        const {context, page} = await open(browser, vp, false);
        run.steps.ready = {shot: await shot(page, run, 'ready'), geometry: await geometry(page), rail: await rail(page)};
        const prompt = (await page.locator('#target-description').innerText()).replace('Passage to copy: ', '');
        await page.locator('#typing-input').pressSequentially(prompt.slice(0, 6));
        await page.waitForFunction(() => document.querySelector('#stage').dataset.state === 'running');
        run.steps.running = {typed: prompt.slice(0, 6), shot: await shot(page, run, 'running'), geometry: await geometry(page)};
        await context.close();
        report.runs.push(run);
      }
    }
    await browser.close();
  }
  report.captures = captures;
  fs.writeFileSync(path.join(OUT, 'evidence.json'), JSON.stringify(report, null, 2));
  console.log(`${label}: ${report.runs.length} runs, ${captures.length} captures, browsers ${BROWSERS.map(b => b.name).join(',')}`);
})().catch(e => { console.error(e); process.exit(1); });
