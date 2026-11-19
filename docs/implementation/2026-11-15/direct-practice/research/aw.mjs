// Fetch an Awwwards site detail page: live URL, award, colors, fonts/tags text (public page).
import { createRequire } from 'node:module'; import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('./pw/node_modules/playwright-core');
const slugs = process.argv.slice(2);
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36' });
const out = [];
for (const s of slugs) {
  const p = await ctx.newPage();
  await p.goto(`https://www.awwwards.com/sites/${s}`, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await p.waitForTimeout(3000);
  const d = await p.evaluate(() => {
    const visit = [...document.querySelectorAll('a')].find(a => /visit/i.test(a.textContent || ''))?.href || null;
    const body = document.body.innerText.replace(/\s+/g, ' ');
    const grab = (k, n = 260) => { const i = body.indexOf(k); return i < 0 ? null : body.slice(i, i + n); };
    return { title: document.title, visit, colors: grab('Colors', 160), typography: grab('Typography', 200), tags: grab('Tags', 220), awards: grab('Site of the Day', 80) };
  });
  out.push({ slug: s, fetchedAt: new Date().toISOString(), ...d });
  await p.close();
}
fs.writeFileSync('research/awwwards-details.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1)); await b.close();
