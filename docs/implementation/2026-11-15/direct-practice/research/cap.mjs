// Lead research capture: node cap.mjs <outName> <url> [w] [h] [fullPage]
import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('./pw/node_modules/playwright-core');
const [name, url, w = '1440', h = '900', full = '0'] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ctx = await b.newContext({ viewport: { width: +w, height: +h }, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36' });
const p = await ctx.newPage();
let status = null; try { const r = await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }); status = r?.status(); } catch (e) { status = String(e).slice(0, 120); }
await p.waitForTimeout(5000);
const file = path.resolve('research', `${name}.png`);
await p.screenshot({ path: file, fullPage: full === '1' }).catch(e => console.log('shot fail', String(e).slice(0, 100)));
const meta = { name, url, finalUrl: p.url(), status, viewport: `${w}x${h}`, fullPage: full === '1', capturedAt: new Date().toISOString(), title: await p.title().catch(() => null) };
if (process.env.LINKS) meta.links = await p.$$eval('a', as => as.map(a => ({ t: (a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60), h: a.href })).filter(x => /\/sites\//.test(x.h)).slice(0, 60));
fs.writeFileSync(path.resolve('research', `${name}.json`), JSON.stringify(meta, null, 1));
console.log(JSON.stringify({ ...meta, links: meta.links?.length }));
await b.close();
