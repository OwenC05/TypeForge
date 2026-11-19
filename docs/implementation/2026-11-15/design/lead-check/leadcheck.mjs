// Lead L1 spot check: independent, bounded. Usage: node leadcheck.mjs <label> <port> <outdir>
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('./pw/node_modules/playwright-core');
const [label, port, outDir] = process.argv.slice(2);
const BASE = `http://127.0.0.1:${port}`;
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
fs.mkdirSync(outDir, { recursive: true });
const profRoot = path.join(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1'), `lead-${label}-profiles`);
const out = { label, base: BASE, runs: [] };
const widths = [[1440, 900], [390, 844], [320, 640]];
for (const [w, h] of widths) {
  const dir = path.join(profRoot, `${w}`);
  fs.rmSync(dir, { recursive: true, force: true });
  const ctx = await chromium.launchPersistentContext(dir, { executablePath: CHROME, headless: true, viewport: { width: w, height: h } });
  const page = ctx.pages()[0] ?? await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  const run = { width: w, height: h, errors };
  // Direct practice entry (both prototypes keep practice.html as an entry).
  await page.goto(`${BASE}/practice.html?practice=general&duration=30`);
  await page.waitForSelector('#typing-input', { state: 'attached', timeout: 15000 });
  await page.waitForFunction(() => !document.querySelector('#typing-input').disabled, null, { timeout: 15000 });
  await page.waitForTimeout(300);
  run.readyActive = await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
  await page.locator('#typing-input').focus();
  const target = await page.evaluate(() => (document.querySelector('#target-description')?.textContent || '').replace(/^Passage to copy:\s*/, ''));
  run.targetPrefix = target.slice(0, 24);
  // Type 6 correct chars, then one wrong char, then 4 correct-position chars.
  const wrong = target[6] === 'q' ? 'z' : 'q';
  await page.keyboard.type(target.slice(0, 6), { delay: 40 });
  await page.keyboard.type(wrong, { delay: 40 });
  await page.keyboard.type(target.slice(7, 11), { delay: 40 });
  await page.waitForTimeout(150);
  const g = await page.evaluate(() => {
    const ta = document.querySelector('#typing-input');
    const stage = ta.getBoundingClientRect();
    const cs = getComputedStyle(ta);
    return { value: ta.value, selStart: ta.selectionStart, selEnd: ta.selectionEnd, fontSize: cs.fontSize,
      stageTopPct: +(100 * stage.top / innerHeight).toFixed(1), scrollY,
      docOverflowX: document.documentElement.scrollWidth > innerWidth,
      liveRegions: [...document.querySelectorAll('[aria-live]')].map(n => `${n.id || n.className}:${n.getAttribute('aria-live')}`),
      ariaHiddenMirror: [...document.querySelectorAll('[aria-hidden="true"]')].length };
  });
  Object.assign(run, g);
  await page.screenshot({ path: path.join(outDir, `${label}-${w}-mismatch.png`) });
  // Backspace x5 corrects back to the mismatch index and below.
  for (let i = 0; i < 5; i++) await page.keyboard.press('Backspace');
  run.afterBackspace = await page.evaluate(() => { const t = document.querySelector('#typing-input'); return { value: t.value, sel: t.selectionStart }; });
  // Ctrl+Backspace removes the remaining partial word.
  await page.keyboard.press('Control+Backspace');
  run.afterCtrlBackspace = await page.evaluate(() => { const t = document.querySelector('#typing-input'); return { value: t.value, sel: t.selectionStart }; });
  // Why? must not be an enabled focusable control during a run.
  run.whyDuringRun = await page.evaluate(() => {
    const els = [...document.querySelectorAll('a,button')].filter(e => /why\?/i.test(e.textContent || ''));
    return els.map(e => ({ tag: e.tagName, disabled: e.disabled ?? null, tabIndex: e.tabIndex, visible: !!(e.offsetWidth || e.offsetHeight) }));
  });
  // No global printable-key capture: blur to body, press a letter, value must not change.
  await page.evaluate(() => document.activeElement.blur());
  const before = await page.locator('#typing-input').inputValue();
  await page.keyboard.press('k');
  run.printableOnBodyChangedInput = (await page.locator('#typing-input').inputValue()) !== before;
  await page.screenshot({ path: path.join(outDir, `${label}-${w}-blurred.png`) });
  out.runs.push(run);
  await ctx.close();
  fs.rmSync(dir, { recursive: true, force: true });
}
fs.rmSync(profRoot, { recursive: true, force: true });
fs.writeFileSync(path.join(outDir, `${label}-leadcheck.json`), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
