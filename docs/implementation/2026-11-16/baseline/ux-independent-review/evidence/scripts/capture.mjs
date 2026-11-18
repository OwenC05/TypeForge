// Independent capture of the frozen P2 prototype served by the review runner on 127.0.0.1:5318.
// Each capture uses a fresh headless Chrome context. Output: ../screenshots/*.png and ../captures.json.
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const here = import.meta.dirname;
const shots = resolve(here, '../screenshots');
mkdirSync(shots, { recursive: true });
const base = 'http://127.0.0.1:5318/index.html?';
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const viewports = [[1440, 900], [390, 844], [320, 640]];

// Every gallery state, plus review-only states built from the same fixtures/URL contract.
const { states } = await import('file:///' + resolve(here, 'states.mjs').replace(/\\/g, '/'));

const browser = await chromium.launch({ executablePath: chrome, headless: true });
const out = [];
for (const st of states) {
  for (const [w, h] of (st.viewports ?? viewports)) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, forcedColors: st.forced ? 'active' : 'none', reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    const t0 = Date.now();
    await page.goto(base + st.query, { waitUntil: 'load' });
    await page.waitForSelector('body[data-ready="1"]');
    const readyMs = Date.now() - t0;
    if (st.keys) for (const k of st.keys) { await page.keyboard.press(k); await page.waitForTimeout(60); }
    await page.waitForTimeout(250);
    const m = await page.evaluate(() => {
      const q = s => document.querySelector(s);
      const a = document.activeElement;
      const rect = el => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
      const slot = q('#slot'), text = q('#exercise-warning');
      const sug = q('#suggested-item');
      const checked = q('#practice-kind ui-segmented-control-item[data-checked], #practice-kind ui-segmented-control-item[aria-checked="true"]');
      const prog = q('ui-progress.baseline-progress');
      const active = q('.active-passage');
      return {
        focus: a ? (a.id || a.tagName.toLowerCase()) + (a.textContent && a.id !== 'typing-input' ? ` "${a.textContent.trim().slice(0, 40)}"` : '') : null,
        label: q('#block-identity')?.textContent ?? null,
        slotText: text?.textContent ?? null,
        slotClipped: slot ? slot.scrollHeight > slot.clientHeight + 1 || slot.scrollWidth > slot.clientWidth + 1 : null,
        hOverflow: document.documentElement.scrollWidth > window.innerWidth,
        pageHeight: document.documentElement.scrollHeight,
        activeLineTopPct: active ? +(100 * active.getBoundingClientRect().top / window.innerHeight).toFixed(1) : null,
        suggested: sug ? { ariaDisabled: sug.getAttribute('aria-disabled'), role: sug.getAttribute('role'), tabindex: sug.getAttribute('tabindex'), describedBy: q('#suggested-status')?.textContent, tally: !!sug.querySelector('.tally'), rect: rect(sug) } : null,
        checkedKind: checked?.getAttribute('value') ?? null,
        progress: prog ? { valuenow: prog.getAttribute('aria-valuenow') ?? prog.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow'), valuetext: prog.getAttribute('aria-valuetext') ?? prog.querySelector('[role=progressbar]')?.getAttribute('aria-valuetext'), visible: prog.querySelector('ui-progress-value')?.textContent } : null,
        primary: q('#primary')?.textContent ?? null,
        primaryRect: rect(q('#primary')),
        baselineResult: q('#baseline-result')?.innerText ?? null,
        whyText: q('#why-panel:not([hidden])')?.innerText ?? null,
        progressPage: q('.baseline-section')?.innerText ?? null,
      };
    });
    const file = `${w}-${st.id}.png`;
    await page.screenshot({ path: resolve(shots, file), fullPage: !!st.full });
    out.push({ id: st.id, viewport: `${w}x${h}`, forced: !!st.forced, query: st.query, keys: st.keys ?? [], readyMs, errors, file, ...m });
    await ctx.close();
  }
}
await browser.close();
writeFileSync(resolve(here, '../captures.json'), JSON.stringify(out, null, 1));
const bad = out.filter(r => r.errors.length || r.hOverflow || r.slotClipped);
console.log(`${out.length} captures; ${bad.length} with error/overflow/clipped slot`);
for (const r of bad) console.log(r.file, r.errors, r.hOverflow, r.slotClipped);
