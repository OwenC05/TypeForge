// F8: press Enter on "next test" immediately, before the simulated 400 ms save resolves.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const out = [];
for (const delay of [0, 800]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto('http://127.0.0.1:5318/index.html?page=assessment&fx=s4&qwerty=1&fast=1');
  await page.waitForSelector('body[data-ready="1"]');
  await page.keyboard.type('the weather', { delay: 30 });
  await page.waitForSelector('#completion:not([hidden])', { timeout: 10000 });
  const atResult = await page.evaluate(() => ({ focus: document.activeElement?.textContent, save: document.querySelector('#save-state')?.textContent, baseline: document.querySelector('#baseline-result')?.innerText }));
  await page.waitForTimeout(delay);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(700);
  const next = await page.evaluate(() => ({ label: document.querySelector('#block-identity')?.textContent, slot: document.querySelector('#exercise-warning')?.textContent }));
  out.push({ flow: `F8 Enter on next test after ${delay} ms`, atResult, next, errors });
  await ctx.close();
}
await browser.close();
writeFileSync(resolve(import.meta.dirname, '../fast-enter.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
