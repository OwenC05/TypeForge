// State captures and geometry checks for the baseline prototype.
// playwright-core is not a project dependency: PLAYWRIGHT_MODULE points at a scratch install.
// Usage: PLAYWRIGHT_MODULE=<scratch>/pw/node_modules/playwright-core/index.mjs BASE=http://127.0.0.1:5312 node capture.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const { chromium } = await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE)).href);
const BASE = process.env.BASE ?? 'http://127.0.0.1:5312';
const OUT = path.resolve(here, '..');
const SHOTS = path.join(OUT, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });
const states = JSON.parse(fs.readFileSync(path.join(OUT, 'states-list.json'), 'utf8'));
const widths = [[1440, 900], [390, 844], [320, 640]];
// r2: forced-colours emulation for the states where colour could carry meaning.
const forced = ['02-practice-locked-press', '07-result-intermediate', '09-result-save-failed', '11-result-final-ready', '28-progress-summary', '35-assessment-recovery-ready'];

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const records = [];
const runs = [];
for (const [width, height] of widths) {
  for (const state of states) runs.push({ width, height, state, mode: 'normal' });
  for (const id of forced) runs.push({ width, height, state: states.find(s => s.id === id), mode: 'forced' });
}
for (const [width, height] of widths) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const forcedContext = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, forcedColors: 'active' });
  for (const { state, mode } of runs.filter(r => r.width === width)) {
    const page = await (mode === 'forced' ? forcedContext : context).newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`${BASE}/index.html?${state.query}`);
    await page.waitForSelector('body[data-ready="1"]');
    await page.waitForTimeout(450);
    const metrics = await page.evaluate(() => {
      const active = document.activeElement;
      const line = document.querySelector('.active-passage');
      const slot = document.querySelector('#slot');
      const stage = document.querySelector('#stage');
      const label = document.querySelector('#block-identity');
      return {
        focus: active ? (active.id || active.tagName.toLowerCase() + (active.textContent ? `:${active.textContent.trim().slice(0, 40)}` : '')) : null,
        overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        activeLineTopPct: line && stage?.dataset.state === 'idle' ? Math.round(line.getBoundingClientRect().top / innerHeight * 1000) / 10 : null,
        slotClipped: slot && stage?.dataset.state === 'idle' ? slot.scrollHeight > slot.clientHeight + 1 : null,
        slotText: slot ? slot.textContent.trim() : null,
        label: label?.textContent ?? null,
        stage: stage?.dataset.state ?? null,
        progress: [...document.querySelectorAll('ui-progress.baseline-progress')].map(p => ({ now: p.getAttribute('aria-valuenow'), max: p.getAttribute('aria-valuemax'), text: p.querySelector('ui-progress-value')?.textContent ?? '' })),
        suggested: (() => { const s = document.querySelector('#suggested-item'); return s ? { role: s.getAttribute('role'), ariaDisabled: s.getAttribute('aria-disabled'), tabindex: s.getAttribute('tabindex'), locked: s.hasAttribute('data-locked'), checked: s.hasAttribute('data-checked') } : null; })(),
        resultPrimary: document.querySelector('#primary')?.textContent ?? null,
        primaryInView: (() => { const p = document.querySelector('#primary'); if (!p) return null; const r = p.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; })(),
        scrollY: Math.round(scrollY),
        undefinedText: /undefined|NaN|\[object/.test(document.querySelector('#app')?.innerText ?? ''),
      };
    });
    const file = `${width}-${mode === 'forced' ? 'FC-' : ''}${state.id}.png`;
    await page.screenshot({ path: path.join(SHOTS, file), fullPage: false });
    if (state.full && mode === 'normal' && width !== 1440) await page.screenshot({ path: path.join(SHOTS, `${width}-${state.id}-full.png`), fullPage: true });
    const sha256 = crypto.createHash('sha256').update(fs.readFileSync(path.join(SHOTS, file))).digest('hex');
    records.push({ id: state.id, mode, width, height, file, sha256, errors, ...metrics });
    await page.close();
  }
  await context.close(); await forcedContext.close();
}
await browser.close();
fs.writeFileSync(path.join(OUT, 'states.json'), JSON.stringify({ base: BASE, chrome: 'system Chrome (headless, playwright-core 1.65.1)', capturedAt: new Date().toISOString(), fixture: 'all data simulated', records }, null, 2));
const bad = records.filter(r => r.errors.length || r.overflowX || r.slotClipped || r.undefinedText);
console.log(`${records.length} captures; ${bad.length} with errors/overflow/clipped slot`);
for (const r of bad) console.log(r.width, r.mode, r.id, { errors: r.errors, overflowX: r.overflowX, slotClipped: r.slotClipped, undefinedText: r.undefinedText });
