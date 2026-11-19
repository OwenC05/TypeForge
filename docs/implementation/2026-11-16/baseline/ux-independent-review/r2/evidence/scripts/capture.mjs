// Independent r2 visual/accessibility capture of the composed build (author prototype 3ad71b6 +
// root style 1b10cbea…, Vite 8.3.3) on 127.0.0.1:5318. Fresh headless Chrome context per capture.
// States: the author's own state list (imported read-only from the prototype) plus review states.
// Output: ../screenshots/*.png and ../captures.json
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const here = import.meta.dirname;
const shots = resolve(here, '../screenshots');
mkdirSync(shots, { recursive: true });
const base = 'http://127.0.0.1:5318/index.html?';
const { states: authorStates } = await import(pathToFileURL(resolve(here, '../../../../ux/prototype/fixtures.ts')).href);
const viewports = [[1440, 900], [390, 844], [320, 640]];
const forcedIds = ['01', '02', '05', '07', '09', '11', '21', '28', '31', '33', '35', '36', '37'];
const states = [
  ...authorStates.map(s => ({ id: s.id, query: s.query, forced: false })),
  ...authorStates.filter(s => forcedIds.includes(s.id.slice(0, 2))).map(s => ({ id: `FC-${s.id}`, query: s.query, forced: true })),
  // Review-only states (same URL contract).
  { id: 'RV-01-practice-ready-why-general', query: 'page=practice&fx=s10ready&view=why', forced: false },
  { id: 'RV-02-assessment-declared', query: 'page=assessment&fx=s0&qwerty=0', keys: ['Tab', 'Enter'], forced: false },
  { id: 'RV-03-plan-end-30s', query: 'page=practice&fx=s10ready&kind=recommended&plan=finite&dur=30&view=planend', forced: false },
];

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const out = [];
for (const st of states) {
  for (const [w, h] of viewports) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, forcedColors: st.forced ? 'active' : 'none', reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    const t0 = Date.now();
    await page.goto(base + st.query, { waitUntil: 'load' });
    await page.waitForSelector('body[data-ready="1"]');
    const readyMs = Date.now() - t0;
    if (st.keys) for (const k of st.keys) { await page.keyboard.press(k); await page.waitForTimeout(80); }
    await page.waitForTimeout(300);
    const m = await page.evaluate(() => {
      const q = s => document.querySelector(s);
      const a = document.activeElement;
      const rect = el => { if (!el) return null; const r = el.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), inView: r.top >= 0 && r.bottom <= innerHeight && r.right <= innerWidth }; };
      const slot = q('#slot');
      const pv = q('ui-progress.baseline-progress');
      const sug = q('#suggested-item');
      const active = q('.active-passage');
      return {
        focus: a ? (a.id || a.tagName.toLowerCase()) + (a.id !== 'typing-input' && a.textContent ? ` "${a.textContent.trim().slice(0, 40)}"` : '') : null,
        focusRect: rect(a && a !== document.body ? a : null),
        label: q('#block-identity')?.textContent ?? null,
        slotText: q('#exercise-warning')?.textContent ?? null,
        slotClipped: slot ? slot.scrollHeight > slot.clientHeight + 1 || slot.scrollWidth > slot.clientWidth + 1 : null,
        hOverflow: document.documentElement.scrollWidth > innerWidth,
        undefinedText: /undefined|NaN/.test(document.body.innerText),
        scrollY: Math.round(scrollY),
        activeLineTopPct: active ? +(100 * active.getBoundingClientRect().top / innerHeight).toFixed(1) : null,
        progress: pv ? (pv.getAttribute('aria-valuetext') ?? pv.querySelector('[role=progressbar]')?.getAttribute('aria-valuetext')) : null,
        suggested: sug ? { ariaDisabled: sug.getAttribute('aria-disabled'), locked: sug.hasAttribute('data-locked'), checked: sug.hasAttribute('data-checked'), description: q('#suggested-status')?.textContent } : null,
        resultLabel: q('.result-label')?.textContent ?? null,
        resultLabelRect: rect(q('.result-label')),
        heroRect: rect(q('.result-figures')),
        leadLine: q('#baseline-result .lead-line')?.textContent ?? null,
        leadLineRect: rect(q('#baseline-result .lead-line')),
        primary: q('#primary')?.textContent ?? null,
        primaryRect: rect(q('#primary')),
        secondary: q('#secondary')?.textContent ?? null,
        saveStateRect: rect(q('#save-state')),
        whyText: q('#why-panel:not([hidden])')?.innerText.split('\n\nEnglish')[0] ?? null,
        progressPage: q('.baseline-section')?.innerText ?? null,
        tally: document.querySelectorAll('.tally').length,
      };
    });
    // Forced-colours progress shape: dark-pixel rows in a filled vs an empty segment column.
    let shape = null;
    if (st.forced) {
      const track = await page.$('ui-progress.baseline-progress ui-progress-track');
      const box = track && await track.boundingBox();
      if (box && box.width > 0 && box.top >= 0) {
        const png = await page.screenshot({ clip: { x: box.x, y: box.y - 2, width: box.width, height: box.height + 4 } });
        shape = await page.evaluate(async ([b64, counted, seg]) => {
          const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode();
          const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
          const g = c.getContext('2d'); g.drawImage(img, 0, 0);
          const col = x => { const d = g.getImageData(x, 0, 1, img.height).data; const lum = []; for (let i = 0; i < d.length; i += 4) lum.push(Math.round(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2])); return lum; };
          const bg = col(0)[0];
          const darkRows = lum => lum.filter(v => Math.abs(v - bg) > 60).length;
          const filledX = counted > 0 ? Math.floor(seg / 2) : null;
          const emptyX = Math.min(img.width - 2, (counted + 1) * seg + Math.floor(seg / 2));
          return { counted, filledRows: filledX === null ? null : darkRows(col(filledX)), emptyRows: darkRows(col(emptyX)), heightPx: img.height };
        }, [png.toString('base64'), await page.evaluate(() => Number(document.querySelector('ui-progress.baseline-progress')?.getAttribute('value') ?? 0)), w > 760 ? 20 : 16]);
      }
    }
    const file = `${w}-${st.id}.png`;
    await page.screenshot({ path: resolve(shots, file) });
    out.push({ id: st.id, viewport: `${w}x${h}`, forced: st.forced, query: st.query, keys: st.keys ?? [], readyMs, errors, file, shape, ...m });
    await ctx.close();
  }
}
await browser.close();
writeFileSync(resolve(here, '../captures.json'), JSON.stringify(out, null, 1));
const badRows = out.filter(r => r.errors.length || r.hOverflow || r.slotClipped || r.undefinedText);
console.log(`${out.length} captures; ${badRows.length} with error/overflow/clipped slot/undefined`);
for (const r of badRows) console.log(r.file, r.errors, r.hOverflow, r.slotClipped, r.undefinedText);
