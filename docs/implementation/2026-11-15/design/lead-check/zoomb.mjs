// Same method as prototype A harness/zoom.mjs: Chrome profile default zoom preference (real browser zoom).
import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('./pw/node_modules/playwright-core');
const [label, port] = process.argv.slice(2);
const dir = path.resolve(`lead-zoom-${label}`); fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(path.join(dir, 'Default'), { recursive: true });
const level = Math.log(2) / Math.log(1.2);
fs.writeFileSync(path.join(dir, 'Default', 'Preferences'), JSON.stringify({ partition: { default_zoom_level: { x: level } } }));
const ctx = await chromium.launchPersistentContext(dir, { executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, viewport: null, args: ['--window-size=1440,900'] });
const p = ctx.pages()[0] ?? await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.goto(`http://127.0.0.1:${port}/practice.html?practice=general&duration=30`);
await p.waitForFunction(() => !document.querySelector('#typing-input').disabled, null, { timeout: 15000 });
await p.locator('#typing-input').focus();
const t = await p.evaluate(() => (document.querySelector('#target-description')?.textContent || '').replace(/^Passage to copy:\s*/, ''));
await p.keyboard.type(t.slice(0, 4) + (t[4] === 'q' ? 'z' : 'q') + t.slice(5, 9), { delay: 40 });
await p.waitForTimeout(200);
const m = await p.evaluate(() => { const ta = document.querySelector('#typing-input').getBoundingClientRect();
  return { devicePixelRatio, innerWidth, innerHeight, outerWidth, inputTop: Math.round(ta.top), inputBottom: Math.round(ta.bottom), scrollY, horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
    value: document.querySelector('#typing-input').value, sel: document.querySelector('#typing-input').selectionStart }; });
const cdp = await ctx.newCDPSession(p); const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync(path.resolve(`lead-evidence/${label}-zoom200-running.png`), Buffer.from(shot.data, 'base64'));
const out = { method: 'Chrome profile partition.default_zoom_level (same as prototype A zoom.mjs)', label, measured: m, zoomApplied: m.devicePixelRatio >= 1.9, errors: errs };
fs.writeFileSync(path.resolve(`lead-evidence/${label}-zoom200.json`), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out)); await ctx.close(); fs.rmSync(dir, { recursive: true, force: true });
