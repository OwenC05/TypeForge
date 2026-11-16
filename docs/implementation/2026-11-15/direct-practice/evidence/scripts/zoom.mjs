// Real browser zoom at 200% (prototype A's method): Chrome's per-profile default zoom preference
// partition.default_zoom_level = log(2)/log(1.2) written into a fresh dp-impl-zoom200-* profile before
// launch. No CDP page scale, no CSS zoom; Playwright viewport emulation is off (viewport: null) and the
// window is 1440x900, so at true 200% devicePixelRatio is 2 and innerWidth is about 720 CSS px.
// Screenshots via CDP Page.captureScreenshot (page.screenshot crops under browser zoom).
// Usage: PLAYWRIGHT_MODULE=… SCRATCH=… node zoom.mjs  -> ../zoom.json + screenshots/zoom200-*.png
import fs from 'node:fs';
import path from 'node:path';
import { chromium, CHROME, SCRATCH, BASE, SHOTS, target, active, geometry, seededRandom, removeProfile, writeJson } from './lib.mjs';

const level = Math.log(2) / Math.log(1.2);
const dir = fs.mkdtempSync(path.join(SCRATCH, 'dp-impl-zoom200-'));
fs.mkdirSync(path.join(dir, 'Default'), { recursive: true });
fs.writeFileSync(path.join(dir, 'Default', 'Preferences'), JSON.stringify({ partition: { default_zoom_level: { x: level } } }));
const context = await chromium.launchPersistentContext(dir, { executablePath: CHROME, headless: true, viewport: null, reducedMotion: 'reduce', args: ['--window-size=1440,900'] });
const page = context.pages()[0] ?? await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(String(error)));
await page.addInitScript(seededRandom(20261115));
const report = { generatedAt: new Date().toISOString(), base: BASE, method: 'Chrome profile preference partition.default_zoom_level (browser zoom), headless system Chrome 1440x900 window, viewport emulation off', requestedZoomLevel: level, states: {} };
const capture = async file => { const cdp = await context.newCDPSession(page); const shot = await cdp.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(SHOTS, file), Buffer.from(shot.data, 'base64')); await cdp.detach(); return `screenshots/${file}`; };
const facts = async () => ({ ...(await geometry(page)), focused: await active(page),
  railFits: await page.evaluate(() => { const r = document.querySelector('#rail')?.getBoundingClientRect(); return r ? r.right <= innerWidth + 0.5 : null; }),
  restartVisible: await page.evaluate(() => { const r = document.querySelector('#restart').getBoundingClientRect(); return r.bottom <= innerHeight && r.right <= innerWidth; }) });
try {
  await page.goto(`${BASE}/?duration=30`);
  await page.locator('#prompt span').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  report.measured = await page.evaluate(() => ({ devicePixelRatio, innerWidth, innerHeight, outerWidth, outerHeight }));
  report.zoomApplied = report.measured.devicePixelRatio >= 1.9 && report.measured.innerWidth <= 760;
  if (report.zoomApplied) {
    report.states.ready = { ...(await facts()), screenshot: await capture('zoom200-01-ready.png') };
    const text = await target(page);
    const wrong = text[8] === 'q' ? 'z' : 'q';
    await page.keyboard.type(text.slice(0, 8) + wrong, { delay: 10 });
    await page.waitForSelector('#prompt .first-mismatch');
    report.states.error = { ...(await facts()), expectedTag: await page.evaluate(() => { const m = document.querySelector('#prompt .first-mismatch'); const r = m.getBoundingClientRect(); return { expected: m.dataset.expected, glyphTop: r.top, inView: r.top >= 0 && r.bottom <= innerHeight }; }), screenshot: await capture('zoom200-02-first-mismatch.png') };
  }
  report.pageErrors = errors;
  report.verdict = report.zoomApplied ? 'true browser zoom applied and measured' : 'GAP: the preference did not produce browser zoom; real 200% zoom is untested';
} finally {
  await context.close().catch(() => {});
  removeProfile(dir);
}
writeJson('zoom.json', report);
console.log(JSON.stringify({ measured: report.measured, verdict: report.verdict, ready: report.states.ready && { activeLineTopPct: report.states.ready.activeLineTopPct, docOverflowX: report.states.ready.docOverflowX, railFits: report.states.ready.railFits, focused: report.states.ready.focused, restartVisible: report.states.ready.restartVisible, passageFontPx: report.states.ready.passageFontPx }, error: report.states.error && { activeLineTopPct: report.states.error.activeLineTopPct, tag: report.states.error.expectedTag, docOverflowX: report.states.error.docOverflowX }, errors }, null, 1));
