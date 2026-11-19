// Renders P1 r1's first-increment outcome (ten tests, automatic coaching disabled:
// complete-insufficient / coaching-deferred) through the frozen prototype's own copy paths.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const status = { policyId: 'r1-fixture', target: 10, counted: 10, exact: true, evidenceScanComplete: true, pending: 0, otherContextCount: null, state: 'complete-insufficient', reason: 'coaching-deferred' };
const s = Buffer.from(JSON.stringify(status)).toString('base64');
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const out = [];
for (const [view, w, h] of [['press', 390, 844], ['why', 390, 844], ['press', 1440, 900]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:5318/index.html?page=practice&s=${encodeURIComponent(s)}&view=${view}`);
  await page.waitForSelector('body[data-ready="1"]'); await page.waitForTimeout(300);
  const text = await page.evaluate(() => ({ slot: document.querySelector('#exercise-warning')?.textContent, why: document.querySelector('#why-panel:not([hidden])')?.innerText, srDescription: document.querySelector('#suggested-status')?.textContent }));
  const file = `${w}-R1-coaching-deferred-${view}.png`;
  await page.screenshot({ path: resolve(import.meta.dirname, '../screenshots', file) });
  out.push({ view, viewport: `${w}x${h}`, file, ...text, errors });
  await ctx.close();
}
await browser.close();
writeFileSync(resolve(import.meta.dirname, '../r1-deferred.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
