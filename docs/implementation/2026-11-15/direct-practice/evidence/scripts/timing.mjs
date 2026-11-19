// Bounded input-handler timing on the production preview (run alone, nothing else on the machine's
// browser/Node workload). For each native keystroke, window capture -> window bubble listeners bracket
// the app's synchronous keydown / beforeinput / input handlers on the textarea; a requestAnimationFrame
// after input gives input-to-next-frame. Real timers (no Playwright clock), 1440x900, correct typing
// of the shown passages with Space commits.
// Usage: node timing.mjs <label> <out.json> [keystrokes=240]
import fs from 'node:fs';
import { launch, BASE, VIEWPORTS, target, buildIdentity, chromeVersion } from './lib.mjs';

const [label, outFile, count = '240'] = process.argv.slice(2);
const keystrokes = Number(count);
const probe = `(() => {
  window.__timing = { keydown: [], beforeinput: [], input: [], frame: [] };
  for (const type of ['keydown', 'beforeinput', 'input']) {
    let start = 0;
    addEventListener(type, () => { start = performance.now(); }, true);
    addEventListener(type, () => {
      window.__timing[type].push(performance.now() - start);
      if (type === 'input') { const at = start; requestAnimationFrame(() => window.__timing.frame.push(performance.now() - at)); }
    }, false);
  }
})();`;
const { context, page, errors } = await launch(`timing-${label}`, VIEWPORTS[1440]);
await page.addInitScript(probe);
await page.goto(`${BASE}/practice.html?mode=practice&duration=120`);
await page.locator('#typing-input').waitFor();
await page.locator('#typing-input').focus();
let typed = 0;
const started = Date.now();
while (typed < keystrokes) {
  const text = (await target(page)) + ' ';
  const chunk = text.slice(0, keystrokes - typed);
  await page.keyboard.type(chunk, { delay: 40 });
  typed += chunk.length;
  if (chunk.length < text.length) break;
}
await page.waitForTimeout(200);
const raw = await page.evaluate(() => window.__timing);
const stats = values => {
  const sorted = [...values].sort((a, b) => a - b);
  const at = q => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  return { n: sorted.length, median: +at(0.5).toFixed(3), p95: +at(0.95).toFixed(3), max: +sorted.at(-1).toFixed(3), mean: +(sorted.reduce((a, b) => a + b, 0) / sorted.length).toFixed(3) };
};
const result = { label, generatedAt: new Date().toISOString(), base: BASE, build: await buildIdentity(), chrome: await chromeVersion(context, page), keystrokes: typed, seconds: Math.round((Date.now() - started) / 1000),
  state: await page.evaluate(() => document.querySelector('#stage')?.dataset.state ?? null), pageErrors: errors,
  ms: Object.fromEntries(Object.entries(raw).map(([key, values]) => [key, stats(values)])) };
await context.close();
fs.writeFileSync(outFile, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ label, keystrokes: typed, state: result.state, errors: errors.length, ms: result.ms }));
