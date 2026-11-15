// Returning visit (same persistent profile as desktop1) + interaction probes.
import { BASE, launch, shot, note, saveLog, active, target, typeRun, savedResults } from './lib.mjs';
const ctx = await launch(process.argv[2], { width: 1440, height: 900 });
const p = ctx.pages()[0] ?? await ctx.newPage();
const errors = []; p.on('pageerror', e => errors.push(e.message));
await p.goto(BASE + '/index.html'); await p.waitForSelector('.hero');
note('returning home', { saved: (await savedResults(p)).length, heroText: await p.locator('.hero h1').innerText(), actions: await p.locator('.hero .actions').innerText() });
await shot(p, 'r01-home-returning-visit-1440.png');
await p.click('text=Just practise'); await p.waitForSelector('#typing-input'); await p.waitForTimeout(400);
note('returning practice defaults', { url: p.url(), duration: await p.locator('#duration').inputValue(), qwerty: await p.locator('#qwerty').isChecked(), kind: await p.locator('#practice-kind').inputValue(), active: await active(p) });
await shot(p, 'r02-practice-returning-defaults-1440.png');
// Probe: click into surface, type a few chars, then Tab (common restart habit) -> interruption?
await p.click('#typing-viewport'); await p.waitForTimeout(100);
note('after click on surface', { active: await active(p) });
const t = await target(p);
await p.keyboard.type(t.slice(0, 10), { delay: 90 });
await p.keyboard.down('Shift'); for (let i = 0; i < 4; i++) await p.keyboard.press('ArrowLeft'); await p.keyboard.up('Shift');
await p.waitForTimeout(150);
await shot(p, 'r03-selection-shift-arrow.png', { clip: { x: 180, y: 400, width: 1080, height: 420 } });
note('selection probe', { selStart: await p.locator('#typing-input').evaluate(e => e.selectionStart), selEnd: await p.locator('#typing-input').evaluate(e => e.selectionEnd) });
await p.keyboard.press('End');
await p.keyboard.press('Control+Backspace'); await p.waitForTimeout(150);
note('ctrl+backspace probe', { value: await p.locator('#typing-input').inputValue(), warning: await p.locator('#exercise-warning').isVisible() ? await p.locator('#exercise-warning').innerText() : null });
await p.keyboard.press('Escape'); await p.waitForTimeout(100);
note('escape probe', { active: await active(p), state: await p.locator('#exercise-state').innerText() });
await p.keyboard.press('Tab'); await p.waitForTimeout(300);
const warnBox = await p.locator('#exercise-warning').boundingBox();
note('tab during run', { active: await active(p), state: await p.locator('#exercise-state').innerText(), warningVisible: await p.locator('#exercise-warning').isVisible(), warning: await p.locator('#exercise-warning').innerText(), warningBox: warnBox, viewportH: 900 });
await shot(p, 'r04-tab-during-run-interruption-viewport.png');
await shot(p, 'r05-tab-during-run-interruption-full.png', { fullPage: true });
await p.keyboard.press('Enter'); // focus is on restart button?
await p.waitForTimeout(800);
note('enter after tab', { active: await active(p), remaining: await p.locator('#remaining').innerText(), value: await p.locator('#typing-input').inputValue() });
// Measure completion -> results navigation and final-second behavior at 15s
await p.selectOption('#duration', '15'); await p.waitForFunction(() => document.querySelector('#remaining')?.textContent === '15'); await p.waitForTimeout(300);
let completedAt = null;
p.on('framenavigated', f => { if (f === p.mainFrame() && f.url().includes('results')) note('navigated to results', { url: f.url() }); });
const r = await typeRun(p, { delay: 105 });
note('returning 15s practice', r);
await p.waitForSelector('#coach-title').catch(() => {}); await p.waitForTimeout(400);
note('returning results', { coach: await p.locator('#coach-title').innerText().catch(() => null), next: await p.locator('#next-action').innerText().catch(() => null), originComparison: await p.locator('#origin-comparison').innerText().catch(() => null) });
await shot(p, 'r06-results-returning-practice-1440.png');
// Keep practising -> does it autofocus? Can I just start typing?
await p.click('text=Keep practising'); await p.waitForSelector('#typing-input'); await p.waitForTimeout(400);
await p.keyboard.type('abc');
note('after Keep practising, typing without click', { active: await active(p), value: await p.locator('#typing-input').inputValue(), url: p.url() });
// Reduced motion emulation check + aria snapshot of practice page
await p.emulateMedia({ reducedMotion: 'reduce' });
note('reduced motion', { matches: await p.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), anyAnimations: await p.evaluate(() => document.getAnimations().length) });
const fs = await import('node:fs');
fs.writeFileSync('C:/Users/Owenc/orca/workspaces/TypeForge/typeforge-daily-practice/docs/reviews/2026-11-15/design-evidence/aria-practice.yml', await p.locator('body').ariaSnapshot());
await p.goto(BASE + '/progress.html'); await p.waitForTimeout(600);
await shot(p, 'r07-progress-returning-full.png', { fullPage: true });
const results = await savedResults(p);
await p.goto(BASE + '/results.html?id=' + results.find(x => x.mode === 'assessment').id); await p.waitForTimeout(800);
fs.writeFileSync('C:/Users/Owenc/orca/workspaces/TypeForge/typeforge-daily-practice/docs/reviews/2026-11-15/design-evidence/aria-results.yml', await p.locator('body').ariaSnapshot());
// Contrast of key colours
note('saved results after returning visit', { results });
note('errors', { errors });
await ctx.close(); saveLog('desktop-returning-log.json');
