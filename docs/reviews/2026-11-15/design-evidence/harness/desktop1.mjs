// Desktop 1440x900 first use: home -> Just practise -> 15s general practice; then assessment 15s; results; progress; lab.
import { BASE, launch, shot, note, saveLog, active, target, typeRun, savedResults } from './lib.mjs';
const UD = process.argv[2];
const ctx = await launch(UD, { width: 1440, height: 900 });
const p = ctx.pages()[0] ?? await ctx.newPage();
const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
note('runtime', { browser: ctx.browser()?.version?.() ?? 'persistent-chrome', ua: await p.evaluate(() => navigator.userAgent).catch(() => null) });
const t0 = Date.now();
await p.goto(BASE + '/index.html'); await p.waitForSelector('.hero');
note('home loaded', { ms: Date.now() - t0, active: await active(p), ua: await p.evaluate(() => navigator.userAgent) });
await shot(p, 'd01-home-first-visit-1440.png');
await shot(p, 'd02-home-first-visit-1440-full.png', { fullPage: true });
// Keyboard-only path to first typing from home: count tabs to reach "Just practise".
let tabs = 0, reached = null;
for (; tabs < 15; tabs++) { await p.keyboard.press('Tab'); const a = await active(p); if (a && a.includes('Just practise')) { reached = a; tabs++; break; } }
note('tabs to Just practise from home', { tabs, reached });
await shot(p, 'd03-home-focus-ring-just-practise.png');
await p.keyboard.press('Enter'); await p.waitForSelector('#typing-input');
await p.waitForTimeout(500);
note('practice page loaded via keyboard', { url: p.url(), active: await active(p), target: await target(p) });
await shot(p, 'd04-practice-idle-first-visit-1440.png');
await shot(p, 'd05-practice-idle-first-visit-1440-full.png', { fullPage: true });
// Does typing work immediately without focusing? Press a key and check.
await p.keyboard.type('a');
note('typed "a" without explicit focus', { value: await p.locator('#typing-input').inputValue(), active: await active(p), state: await p.locator('#exercise-state').innerText() });
// Count tabs from page top to textarea.
await p.reload(); await p.waitForSelector('#typing-input'); await p.waitForTimeout(300);
let tabs2 = 0; const order = [];
for (; tabs2 < 25; tabs2++) { await p.keyboard.press('Tab'); const a = await active(p); order.push(a); if (a === 'textarea#typing-input') { tabs2++; break; } }
note('tab order from practice page load to textarea', { tabs: tabs2, order });
await shot(p, 'd06-practice-textarea-focused-idle.png');
// Choose 15s via keyboard: shift-tab back to duration select is long; use the select directly (counts as a click).
await p.selectOption('#duration', '15');
await p.waitForFunction(() => document.querySelector('#remaining')?.textContent === '15');
await p.waitForTimeout(400);
note('after selecting 15s', { url: p.url(), active: await active(p), target: await target(p) });
// Real typing: error at char 6, Enter press, screenshots mid-run.
let midShot = false;
const run = typeRun(p, { delay: 110, errorAt: 6, onError: async (pp) => {
  await shot(pp, 'd07-practice-error-feedback.png');
  note('error state', { help: await pp.locator('#typing-help').innerText(), wpm: await pp.locator('#live-wpm').innerText(), acc: await pp.locator('#live-accuracy').innerText() });
  await pp.keyboard.press('Enter'); await pp.waitForTimeout(150);
  await shot(pp, 'd08-practice-enter-warning.png');
  note('enter warning', { warning: await pp.locator('#exercise-warning').innerText() });
} });
setTimeout(async () => { try { await shot(p, 'd09-practice-running-mid-1440.png'); note('mid run', { remaining: await p.locator('#remaining').innerText(), prev: await p.locator('#previous-prompt').innerText(), next: await p.locator('#next-prompt').innerText() }); midShot = true; } catch (e) { note('mid shot failed', { e: e.message }); } }, 9000);
const r = await run;
note('15s general practice finished', r);
await p.waitForSelector('#coach-title', { timeout: 10000 }).catch(() => {});
await p.waitForTimeout(500);
await shot(p, 'd10-results-general-practice-1440.png');
await shot(p, 'd11-results-general-practice-1440-full.png', { fullPage: true });
note('results content', { coach: await p.locator('#coach-title').innerText().catch(() => null), next: await p.locator('#next-action').innerText().catch(() => null), nextHref: await p.locator('#next-action').getAttribute('href').catch(() => null), active: await active(p) });
// Keyboard: is there a shortcut to repeat? Try Tab count to next action.
let tabs3 = 0; for (; tabs3 < 30; tabs3++) { await p.keyboard.press('Tab'); const a = await active(p); if (a && a.includes('next-action')) { tabs3++; break; } }
note('tabs from results load to primary next action', { tabs: tabs3, active: await active(p) });
// Assessment journey: nav Assessment, declare QWERTY, 15s.
await p.goto(BASE + '/practice.html'); await p.waitForSelector('#typing-input'); await p.waitForTimeout(300);
note('assessment page defaults', { duration: await p.locator('#duration').inputValue(), qwerty: await p.locator('#qwerty').isChecked(), url: p.url() });
await shot(p, 'd12-assessment-idle-returning-defaults.png');
await p.check('#qwerty'); await p.waitForTimeout(300);
await p.selectOption('#duration', '15'); await p.waitForFunction(() => document.querySelector('#remaining')?.textContent === '15'); await p.waitForTimeout(400);
note('assessment configured', { url: p.url(), prediction: await p.locator('#prediction-state').innerText(), focus: await p.locator('#focus-state').innerText() });
await shot(p, 'd13-assessment-configured-15s-qwerty.png');
const r2 = await typeRun(p, { delay: 100 });
note('15s assessment finished', r2);
await p.waitForSelector('#coach-title', { timeout: 10000 }).catch(() => {}); await p.waitForTimeout(500);
await shot(p, 'd14-results-assessment-1440.png');
await shot(p, 'd15-results-assessment-1440-full.png', { fullPage: true });
note('assessment results', { coach: await p.locator('#coach-title').innerText().catch(() => null), explanation: await p.locator('#coach-explanation').innerText().catch(() => null), next: await p.locator('#next-action').innerText().catch(() => null), href: await p.locator('#next-action').getAttribute('href').catch(() => null) });
// Follow primary next action.
await p.click('#next-action'); await p.waitForSelector('#typing-input'); await p.waitForTimeout(500);
note('next action landing', { url: p.url(), active: await active(p), duration: await p.locator('#duration').inputValue(), qwerty: await p.locator('#qwerty').isChecked(), kind: await p.locator('#practice-kind').inputValue().catch(() => null), reason: await p.locator('#recommendation-reason').innerText().catch(() => null), focus: await p.locator('#focus-state').innerText() });
await shot(p, 'd16-next-action-practice-landing.png');
// Progress + Lab.
await p.goto(BASE + '/progress.html'); await p.waitForTimeout(800);
await shot(p, 'd17-progress-1440.png'); await shot(p, 'd18-progress-1440-full.png', { fullPage: true });
await p.goto(BASE + '/lab.html'); await p.waitForTimeout(800);
await shot(p, 'd19-lab-1440.png'); await shot(p, 'd20-lab-1440-full.png', { fullPage: true });
note('saved results (typed by reviewer, not seeded)', { results: await savedResults(p) });
note('page errors', { errors });
await ctx.close();
saveLog('desktop-first-use-log.json');
