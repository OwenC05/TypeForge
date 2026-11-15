import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('./pw/node_modules/playwright-core');
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const res = [];
for (const u of ['/', '/results.html', '/results.html?id=missing', '/TypingDrill.html', '/TypingTest.html', '/progress.html', '/lab.html', '/practice.html?retest=missing&duration=15']) {
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('http://127.0.0.1:5294' + u); await p.waitForTimeout(1200);
  res.push({ u, final: p.url().replace('http://127.0.0.1:5294', ''), h1: (await p.locator('h1,h2').first().textContent().catch(() => null))?.trim().slice(0, 60), errs });
  await p.close();
}
console.log(JSON.stringify(res, null, 1)); await b.close();
