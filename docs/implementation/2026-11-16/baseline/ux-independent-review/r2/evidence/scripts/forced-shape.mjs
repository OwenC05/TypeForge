// Forced-colours progress shape (finding 7) on the composed build: per-row pixel profile of a filled,
// a pending and an empty segment in Chromium forced-colours emulation. capture.mjs's inline probe
// was skipped (it read box.top from a bounding box that only has y), so this is the shape evidence.
// Output: ../forced-shape.json
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const base = 'http://127.0.0.1:5318/index.html?';
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const cases = [
  ['in-progress result 5 saved', 'page=assessment&fx=s4&view=result&outcome=saved'],
  ['save failed (pending segment)', 'page=assessment&fx=s4&view=result&outcome=savefail'],
  ['Progress 4 of 10', 'page=progress&fx=s4'],
];
const out = [];
for (const [name, query] of cases) for (const [w, h] of [[1440, 900], [390, 844], [320, 640]]) for (const forced of [false, true]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, forcedColors: forced ? 'active' : 'none', reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(base + query); await page.waitForSelector('body[data-ready="1"]'); await page.waitForTimeout(500);
  const scope = query.startsWith('page=progress') ? '.baseline-section' : '#baseline-result';
  const track = page.locator(`${scope} ui-progress-track`).first();
  await track.scrollIntoViewIfNeeded();
  const box = await track.boundingBox();
  const png = await page.screenshot({ clip: { x: box.x, y: box.y - 3, width: box.width, height: box.height + 6 } });
  const seg = w > 760 ? 20 : 16;
  const meta = await page.evaluate((scope) => { const p = document.querySelector(`${scope} ui-progress.baseline-progress`); return { counted: Number(p.getAttribute('value')), pending: p.hasAttribute('data-pending') }; }, scope);
  const r = await page.evaluate(async ([b64, seg, counted, pending]) => {
    const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const lum = x => { const d = g.getImageData(x, 0, 1, img.height).data; const v = []; for (let i = 0; i < d.length; i += 4) v.push(Math.round(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2])); return v; };
    const bg = lum(seg - 1)[0]; // the 2px gap between segments is background
    const profile = x => lum(x).map(v => (Math.abs(v - bg) > 40 ? '#' : '.')).join('');
    const mid = i => i * seg + Math.floor((seg - 2) / 2);
    return { bgLum: bg, filled: counted ? profile(mid(0)) : null, pendingSeg: pending ? profile(mid(counted)) : null, empty: profile(mid(counted + (pending ? 1 : 0))), pendingEdge: pending ? profile(counted * seg + 1) : null };
  }, [png.toString('base64'), seg, meta.counted, meta.pending]);
  out.push({ name, viewport: `${w}x${h}`, forced, ...meta, ...r });
  await ctx.close();
}
await browser.close();
writeFileSync(resolve(import.meta.dirname, '../forced-shape.json'), JSON.stringify(out, null, 1));
for (const o of out) console.log(o.name.padEnd(30), o.viewport.padEnd(8), o.forced ? 'FC ' : 'std', 'filled', o.filled, 'pending', o.pendingSeg, 'edge', o.pendingEdge, 'empty', o.empty);
