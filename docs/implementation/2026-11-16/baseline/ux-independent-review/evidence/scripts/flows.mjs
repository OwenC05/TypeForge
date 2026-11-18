// Independent keyboard / semantics flow checks against the frozen prototype on 127.0.0.1:5318.
// Records observations, not pass/fail against the author's criteria. Output: ../flows.json
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const base = 'http://127.0.0.1:5318/index.html?';
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const results = [];
const viewports = [[1440, 900], [390, 844], [320, 640]];

async function open(query, [w, h]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  const t0 = Date.now();
  await page.goto(base + query);
  await page.waitForSelector('body[data-ready="1"]');
  return { ctx, page, errors, loadMs: Date.now() - t0 };
}
const snap = page => page.evaluate(() => {
  const a = document.activeElement;
  const q = s => document.querySelector(s);
  return {
    focus: a?.id || a?.getAttribute('value') || a?.tagName.toLowerCase(),
    focusText: a?.textContent?.trim().slice(0, 50),
    checked: q('#practice-kind ui-segmented-control-item[data-checked]')?.getAttribute('value') ?? null,
    label: q('#block-identity')?.textContent ?? null,
    slot: q('#exercise-warning')?.textContent ?? null,
    stageState: q('#stage')?.dataset.state ?? null,
    url: location.search.slice(0, 40),
  };
});
const record = (flow, vp, data) => results.push({ flow, viewport: `${vp[0]}x${vp[1]}`, ...data });

for (const vp of viewports) {
  // F1: first visit — readiness and first key.
  {
    const { ctx, page, errors, loadMs } = await open('page=practice&fx=s0&qwerty=0', vp);
    const before = await snap(page);
    await page.keyboard.type('t');
    await page.waitForTimeout(150);
    const after = await snap(page);
    record('F1 first visit: focus then first key', vp, { loadToReadyMs: loadMs, before, after, errors });
    await ctx.close();
  }
  // F2: keyboard route to locked Suggested from the textarea (Shift+Tab back to the kind control), then arrows.
  {
    const { ctx, page, errors } = await open('page=practice&fx=s4&qwerty=1', vp);
    const steps = [];
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Shift+Tab');
      const s = await snap(page);
      steps.push(`${s.focus}`);
      if (s.focus === 'general') break;
    }
    const atGeneral = await snap(page);
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(120);
    const arrowLeft = await snap(page);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(120);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(120);
    const arrowRightTwice = await snap(page);
    const aria = await page.locator('#practice-kind').ariaSnapshot();
    const ax = await page.evaluate(() => { const s = document.querySelector('#suggested-item'); return { role: s.getAttribute('role'), ariaDisabled: s.getAttribute('aria-disabled'), ariaChecked: s.getAttribute('aria-checked'), describedBy: s.getAttribute('aria-describedby'), description: document.getElementById(s.getAttribute('aria-describedby'))?.textContent }; });
    await page.keyboard.press('Space');
    await page.waitForTimeout(120);
    const space = await snap(page);
    record('F2 keyboard to locked Suggested', vp, { shiftTabPath: steps, atGeneral, arrowLeft, arrowRightTwice, space, aria, ax, errors });
    await ctx.close();
  }
  // F3: locked press action -> test page; QWERTY friction on a clean visit (qwerty off).
  {
    const { ctx, page, errors } = await open('page=practice&fx=s0&qwerty=0&view=press', vp);
    await page.waitForTimeout(200);
    const press = await snap(page);
    await page.click('#exercise-warning a');
    await page.waitForSelector('body[data-ready="1"]');
    const landed = await snap(page);
    record('F3 locked press -> take test 1 (qwerty off)', vp, { press, landed, errors });
    await ctx.close();
  }
  // F4: a full test on an undeclared keyboard (accelerated clock) is silently spent.
  {
    const { ctx, page, errors } = await open('page=assessment&fx=s0&qwerty=0&fast=1', vp);
    await page.keyboard.type('the weather', { delay: 30 });
    await page.waitForSelector('#completion:not([hidden])', { timeout: 10000 });
    await page.waitForTimeout(600);
    const result = await page.evaluate(() => ({ label: document.querySelector('.result-label')?.textContent, baseline: document.querySelector('#baseline-result')?.innerText, primary: document.querySelector('#primary')?.textContent }));
    record('F4 undeclared keyboard test completes (fast clock)', vp, { result, errors });
    await ctx.close();
  }
  // F5: test 10 -> complete-ready -> Enter -> Suggested ready (fast clock).
  {
    const { ctx, page, errors } = await open('page=assessment&fx=s9&qwerty=1&fast=1&final=ready', vp);
    await page.keyboard.type('the weather', { delay: 30 });
    await page.waitForSelector('#completion:not([hidden])', { timeout: 10000 });
    await page.waitForTimeout(700);
    const result = await snap(page);
    await page.keyboard.press('Enter');
    await page.waitForSelector('body[data-ready="1"]');
    await page.waitForTimeout(200);
    const after = await snap(page);
    record('F5 test 10 ready -> try suggested', vp, { result, after, errors });
    await ctx.close();
  }
  // F6: interruption (focus loss) mid-test, then retry.
  {
    const { ctx, page, errors } = await open('page=assessment&fx=s4&qwerty=1&fast=1', vp);
    await page.keyboard.type('the', { delay: 30 });
    await page.evaluate(() => document.querySelector('#typing-input').blur());
    await page.waitForSelector('#completion:not([hidden])', { timeout: 10000 });
    await page.waitForTimeout(200);
    const result = await page.evaluate(() => ({ baseline: document.querySelector('#baseline-result')?.innerText, primary: document.activeElement?.textContent }));
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    const after = await snap(page);
    record('F6 focus loss -> not counted -> retry', vp, { result, after, errors });
    await ctx.close();
  }
  // F7: reset confirm and focus restoration.
  {
    const { ctx, page, errors } = await open('page=progress&fx=s9', vp);
    await page.focus('#reset');
    await page.keyboard.press('Enter');
    const confirm = await snap(page);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    const done = await page.evaluate(() => ({ focus: document.activeElement?.id, status: document.querySelector('#baseline-status')?.textContent, section: document.querySelector('.baseline-section')?.innerText }));
    record('F7 reset -> confirm -> start over', vp, { confirm, done, errors });
    await ctx.close();
  }
}
await browser.close();
writeFileSync(resolve(import.meta.dirname, '../flows.json'), JSON.stringify(results, null, 1));
console.log(`${results.length} flow records; errors: ${results.reduce((n, r) => n + r.errors.length, 0)}`);
