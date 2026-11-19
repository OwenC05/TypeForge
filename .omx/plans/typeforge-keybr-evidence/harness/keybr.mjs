// Live Keybr journeys in fresh owned profiles. Synthetic Playwright key events, not human typing.
import { launch, shot, note, saveLog, active, OUT } from './klib.mjs';
import fs from 'node:fs';
const [udDesk, udMob] = process.argv.slice(2);
const lessonWords = p => p.evaluate(() => {
  const ta = document.querySelector('textarea'); if (!ta) return null;
  const textDiv = ta.parentElement.nextElementSibling?.querySelector('div[dir]'); if (!textDiv) return null;
  return [...textDiv.children].map(w => [...w.children].filter(s => !(s.getAttribute('style') || '').includes('special')).map(s => s.textContent).join(''));
});
const metrics = p => p.evaluate(() => { const m = document.querySelector('main'); return m ? m.innerText.split('\n').slice(0, 12).join(' | ') : null; });
const storageKeys = p => p.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = (localStorage.getItem(k) || '').length; } return o; });

const c = await launch(udDesk, { width: 1440, height: 900 });
const p = c.pages()[0] ?? await c.newPage();
const errors = []; p.on('pageerror', e => errors.push(e.message));
const t0 = Date.now();
const resp = await p.goto('https://www.keybr.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('textarea', { timeout: 30000 }); await p.waitForTimeout(3000);
note('keybr first visit', { ms: Date.now() - t0, status: resp?.status(), active: await active(p), date: resp?.headers()['date'], server: resp?.headers()['server'] });
await shot(p, 'k01-first-visit-tour-1440.png');
// Tour slides (first-run guidance)
for (let i = 2; i <= 12; i++) {
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(500);
  const dialog = p.locator('[role=dialog], .dialog, [class*=Popup], [class*=popup]').first();
  const txt = await p.evaluate(() => { const d = [...document.querySelectorAll('div')].find(x => /Next|Close|Previous/.test(x.innerText) && x.innerText.length < 1600 && x.getBoundingClientRect().width > 300 && x.getBoundingClientRect().width < 600); return d ? d.innerText.slice(0, 700) : null; });
  note(`tour slide ${i}`, { text: txt });
  if (i <= 12) await shot(p, `k02-tour-slide-${String(i).padStart(2, '0')}.png`, { clip: { x: 300, y: 120, width: 840, height: 640 } });
  if (!txt) break;
}
await p.keyboard.press('Escape'); await p.waitForTimeout(800);
await shot(p, 'k03-practice-idle-after-tour-1440.png');
note('after tour closed', { active: await active(p), metrics: await metrics(p) });
fs.writeFileSync(OUT + '/aria-keybr-practice.yml', await p.locator('body').ariaSnapshot());
// Errors/correction
let words = await lessonWords(p);
note('lesson 1 text', { words });
await p.keyboard.type(words[0].slice(0, 1), { delay: 120 });
await p.keyboard.type('q', { delay: 120 }); await p.waitForTimeout(200);
await shot(p, 'k04-error-feedback-1440.png'); await shot(p, 'k04b-error-feedback-zoom.png', { clip: { x: 330, y: 260, width: 800, height: 120 } });
await p.keyboard.press('Backspace'); await p.waitForTimeout(200);
await shot(p, 'k05-after-backspace-zoom.png', { clip: { x: 330, y: 260, width: 800, height: 120 } });
note('after error + backspace', { metrics: await metrics(p) });
// Complete lessons with real key events.
async function typeLesson(n, midShot) {
  const ws = await lessonWords(p); const text = ws.join(' ');
  const typedSoFar = n === 1 ? 1 : 0; // first char of lesson 1 already typed
  const rest = text.slice(typedSoFar);
  const start = Date.now();
  for (let i = 0; i < rest.length; i++) {
    await p.keyboard.type(rest[i], { delay: 100 });
    if (midShot && i === Math.floor(rest.length / 2)) await shot(p, `k06-lesson-running-1440.png`);
  }
  await p.waitForTimeout(1500);
  note(`lesson ${n} complete`, { chars: text.length, ms: Date.now() - start, newLesson: (await lessonWords(p))?.slice(0, 6), metrics: await metrics(p) });
}
await typeLesson(1, true);
await shot(p, 'k07-after-lesson-1-1440.png');
for (let n = 2; n <= 4; n++) await typeLesson(n, false);
await shot(p, 'k08-after-lesson-4-1440.png');
await shot(p, 'k08b-after-lesson-4-metrics-zoom.png', { clip: { x: 340, y: 120, width: 800, height: 140 } });
// Hover/explain key progression: click "Current key" info? Capture profile page.
await p.goto('https://www.keybr.com/profile', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(3000);
await shot(p, 'k09-profile-after-4-lessons-1440.png'); await shot(p, 'k09b-profile-full.png', { fullPage: true });
await p.goto('https://www.keybr.com/', { waitUntil: 'domcontentloaded' }); await p.waitForSelector('textarea'); await p.waitForTimeout(2500);
// Settings
await p.getByText('SETTINGS', { exact: false }).first().click().catch(e => note('settings click fail', { e: e.message.slice(0, 200) }));
await p.waitForTimeout(2000);
await shot(p, 'k10-settings-1440.png'); await shot(p, 'k10b-settings-full.png', { fullPage: true });
note('settings page', { url: p.url(), text: (await p.locator('main').innerText().catch(() => '')).slice(0, 1500) });
await p.goto('https://www.keybr.com/', { waitUntil: 'domcontentloaded' }); await p.waitForSelector('textarea'); await p.waitForTimeout(2000);
// Focus loss
await p.mouse.click(1300, 800); await p.waitForTimeout(600);
note('click outside', { active: await active(p) });
await shot(p, 'k11-focus-lost-1440.png');
await p.keyboard.press('a'); await p.waitForTimeout(400);
note('press key after focus loss', { active: await active(p) });
note('local storage keys (lengths only)', { keys: await storageKeys(p) });
await c.close();
// Returning visit: new browser session, same profile.
const c2 = await launch(udDesk, { width: 1440, height: 900 });
const p2 = c2.pages()[0] ?? await c2.newPage();
await p2.goto('https://www.keybr.com/', { waitUntil: 'domcontentloaded', timeout: 60000 }); await p2.waitForSelector('textarea'); await p2.waitForTimeout(3500);
note('returning visit', { active: await active(p2), tourVisible: await p2.getByText('Learn to Type Faster').isVisible().catch(() => false), metrics: await metrics(p2) });
await shot(p2, 'k12-returning-visit-1440.png');
await c2.close();
// Mobile viewport
const m = await launch(udMob, { width: 390, height: 844 }, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const q = m.pages()[0] ?? await m.newPage();
await q.goto('https://www.keybr.com/', { waitUntil: 'domcontentloaded', timeout: 60000 }); await q.waitForSelector('textarea', { timeout: 30000 }).catch(() => {}); await q.waitForTimeout(3500);
await shot(q, 'k13-mobile-first-visit-390.png'); await shot(q, 'k13b-mobile-first-visit-390-full.png', { fullPage: true });
await q.keyboard.press('Escape'); await q.waitForTimeout(800);
await shot(q, 'k14-mobile-after-tour-390.png'); await shot(q, 'k14b-mobile-after-tour-390-full.png', { fullPage: true });
note('mobile geometry', await q.evaluate(() => { const ta = document.querySelector('textarea'); const t = ta?.parentElement.nextElementSibling?.getBoundingClientRect(); return { textTop: t ? Math.round(t.top) : null, textBottom: t ? Math.round(t.bottom) : null, scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth }; }));
const mw = await lessonWords(q);
if (mw) { await q.keyboard.type(mw.slice(0, 3).join(' '), { delay: 110 }); await q.waitForTimeout(300); await shot(q, 'k15-mobile-typing-390.png'); }
await m.close();
note('errors', { errors });
saveLog('keybr-log.json');
