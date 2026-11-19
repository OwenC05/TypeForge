// Lead (actual Claude) independent acceptance walk on the frozen 1e29064 build served at :5303.
// Real time (no Playwright clock), real keyboard events into the native textarea, fresh profiles.
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
const PW = 'C:/Users/Owenc/AppData/Local/Temp/claude/bcbd159d70604b2a/f03e56f4-5efe-412b-b4ab-78aa0106925c/scratchpad/pw/node_modules/playwright-core/index.mjs';
const { chromium } = await import('file:///' + PW);
const S = 'C:/Users/Owenc/AppData/Local/Temp/claude/bcbd159d70604b2a/0d0b2df5-2f24-48bd-b0cf-157192eff94c/scratchpad';
const OUT = join(S, 'lead-review'); mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:5303';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const log = []; const note = (k, v) => { log.push({ k, v }); console.log(k, JSON.stringify(v)); };
const only = process.argv[2] && process.argv[2] !== 'fail' ? process.argv[2].split(',') : null;

async function ctx(name, viewport, { failSave = false } = {}) {
  const dir = mkdtempSync(join(S, `dp-lead-${name}-`));
  const c = await chromium.launchPersistentContext(dir, { executablePath: CHROME, headless: true, viewport, deviceScaleFactor: 1 });
  if (failSave) await c.addInitScript(() => {
    const orig = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (...a) {
      if (this.name && /result/i.test(this.name) && window.__failSave !== false) throw new DOMException('injected', 'QuotaExceededError');
      return orig.apply(this, a);
    };
  });
  const page = c.pages()[0] ?? await c.newPage();
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  return { c, page, errors };
}
const state = page => page.evaluate(() => ({
  active: document.activeElement?.id || document.activeElement?.tagName,
  stage: document.querySelector('#stage')?.dataset.state,
  duration: document.querySelector('#duration')?.value,
  kind: document.querySelector('#practice-kind')?.value,
  remaining: document.querySelector('#remaining')?.textContent,
  slot: document.querySelector('#slot')?.innerText.trim(),
  scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth,
  cover: getComputedStyle(document.querySelector('.stage-cover') ?? document.body).display,
}));
const expected = page => page.evaluate(() => document.querySelector('#target-description').textContent.replace(/^Passage to copy: /, ''));
const typed = page => page.evaluate(() => document.querySelector('#typing-input').value);
async function typeCorrect(page, n) { const t = await expected(page); const v = await typed(page); await page.keyboard.type(t.slice(v.length, v.length + n), { delay: 35 }); }
async function finishBlock(page, ms) { const end = Date.now() + ms; while (Date.now() < end) { await typeCorrect(page, 6); if ((await state(page)).stage === 'completed') break; } await page.waitForFunction(() => document.querySelector('#stage')?.dataset.state === 'completed' || document.querySelector('#again,#practice-next'), null, { timeout: 30000 }); await page.waitForTimeout(400); }
const shot = (page, n) => page.screenshot({ path: join(OUT, n + '.png') });

const VP = { 1440: { width: 1440, height: 900 }, 390: { width: 390, height: 844 }, 320: { width: 320, height: 640 } };

// 1. Clean first visit, all widths: no gate, focused, 30 s general, no horizontal scroll.
for (const w of (process.argv[2] === 'fail' ? [] : (only ?? ['1440', '390', '320']))) {
  const { c, page, errors } = await ctx(`first-${w}`, VP[w]);
  await page.goto(BASE + '/'); await page.waitForSelector('#typing-input'); await page.waitForTimeout(600);
  note(`first-${w}`, { url: page.url(), ...(await state(page)), errors });
  await shot(page, `first-${w}`);
  // first keystroke starts the run (no click needed)
  const t = await expected(page); await page.keyboard.type(t.slice(0, 1));
  await page.waitForTimeout(150);
  note(`first-${w}-after1key`, { value: await typed(page), stage: (await state(page)).stage });
  await c.close();
}

if (!only || process.argv[2] === 'fail') {
  if (process.argv[2] !== 'fail') {
  // 2. Running with an error at 1440 (vs target-1440-running), then correction.
  {
    const { c, page, errors } = await ctx('run-1440', VP[1440]);
    await page.goto(BASE + '/'); await page.waitForSelector('#typing-input'); await page.waitForTimeout(500);
    await typeCorrect(page, 18); await page.keyboard.type('#'); await page.waitForTimeout(250);
    await shot(page, 'running-error-1440'); note('running-error-1440', { ...(await state(page)), value: await typed(page) });
    await page.keyboard.press('Backspace'); await typeCorrect(page, 4); await page.waitForTimeout(250);
    await shot(page, 'running-corrected-1440'); note('running-corrected-1440', await state(page));
    note('run-errors', errors); await c.close();
  }
  // 3. 15 s block -> in-place result -> Enter on Again -> next block, remembered on reload.
  for (const w of ['1440', '390']) {
    const { c, page, errors } = await ctx(`loop-${w}`, VP[w]);
    await page.goto(BASE + '/'); await page.waitForSelector('#typing-input'); await page.waitForTimeout(500);
    await page.click('#duration ui-segmented-control-item[value="15"]');
    await page.waitForTimeout(300);
    note(`loop-${w}-after-15`, await state(page));
    // contextual return: Enter on 'start typing' or click passage
    await page.keyboard.press('Tab').catch(() => {});
    await page.click('#stage'); await page.waitForTimeout(200);
    note(`loop-${w}-refocus`, await state(page));
    await finishBlock(page, 17000);
    await shot(page, `result-${w}`); note(`result-${w}`, await state(page));
    await page.keyboard.press('Enter'); await page.waitForTimeout(700);
    note(`again-${w}`, await state(page)); await shot(page, `again-${w}`);
    await page.goto(BASE + '/'); await page.waitForSelector('#typing-input'); await page.waitForTimeout(500);
    note(`return-${w}`, await state(page));
    note(`loop-${w}-errors`, errors); await c.close();
  }
  }
  // 4. Save failure -> Again -> carried line -> held departure during a run -> export focused.
  for (const w of ['1440', '320']) {
    const { c, page, errors } = await ctx(`fail-${w}`, VP[w], { failSave: true });
    await page.goto(BASE + '/?duration=15'); await page.waitForSelector('#typing-input'); await page.waitForTimeout(500);
    await finishBlock(page, 17000); await page.waitForTimeout(500);
    await shot(page, `savefail-${w}`); note(`savefail-${w}`, { ...(await state(page)), save: await page.locator('#save-state').innerText() });
    await page.keyboard.press('Enter'); await page.waitForTimeout(700);
    await shot(page, `carried-ready-${w}`); note(`carried-ready-${w}`, await state(page));
    const t = await expected(page); await page.keyboard.type(t.slice(0, 5), { delay: 40 });
    await shot(page, `carried-running-${w}`); note(`carried-running-${w}`, await state(page));
    const link = w === '1440' ? page.getByRole('link', { name: 'progress', exact: true }).first() : null;
    if (link) {
      await link.click(); await page.waitForTimeout(300);
      await shot(page, `held-${w}`); note(`held-${w}`, { url: page.url(), ...(await state(page)) });
      await page.keyboard.press('Tab'); await page.waitForTimeout(100);
      note(`held-${w}-tab`, (await state(page)).active);
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 3000 }).catch(() => null), page.click('#carried [data-act="export"]')]);
      note(`held-${w}-export`, { download: dl ? await dl.suggestedFilename() : null, ...(await state(page)) });
      await shot(page, `held-exported-${w}`);
      await page.click('#carried [data-act="leave"]').catch(e => note('leave-click', String(e).slice(0, 120)));
      await page.waitForTimeout(800); note(`held-${w}-left`, page.url());
    }
    note(`fail-${w}-errors`, errors); await c.close();
  }
}
writeFileSync(join(OUT, 'lead-review.json'), JSON.stringify(log, null, 1));
