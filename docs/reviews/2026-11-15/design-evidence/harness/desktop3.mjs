// Interaction probes with the textarea actually focused (separate fresh profile so history is not polluted).
import { BASE, launch, shot, note, saveLog, active, target } from './lib.mjs';
const ctx = await launch(process.argv[2], { width: 1440, height: 900 });
const p = ctx.pages()[0] ?? await ctx.newPage();
await p.goto(BASE + '/practice.html?mode=practice'); await p.waitForSelector('#typing-input'); await p.waitForTimeout(300);
const surf = await p.locator('#typing-viewport').boundingBox(); const ta = await p.locator('#typing-input').boundingBox();
note('click target geometry', { surface: surf, textarea: ta });
await p.mouse.click(surf.x + surf.width / 2, surf.y + surf.height - 30); await p.waitForTimeout(100);
note('click lower blank area of surface', { active: await active(p) });
await p.mouse.click(ta.x + 20, ta.y + 10); await p.waitForTimeout(100);
note('click on active passage line', { active: await active(p) });
await shot(p, 'p01-focused-idle-caret.png', { clip: { x: 180, y: 400, width: 1080, height: 420 } });
const t = await target(p);
await p.keyboard.type(t.slice(0, 12), { delay: 90 });
await p.keyboard.down('Shift'); for (let i = 0; i < 5; i++) await p.keyboard.press('ArrowLeft'); await p.keyboard.up('Shift');
await p.waitForTimeout(150);
note('selection', { s: await p.locator('#typing-input').evaluate(e => [e.selectionStart, e.selectionEnd]) });
await shot(p, 'p02-selection-shift-arrow.png', { clip: { x: 180, y: 400, width: 1080, height: 420 } });
await p.keyboard.press('End');
await p.keyboard.type('xyz', { delay: 90 }); // extra wrong letters
await p.waitForTimeout(150);
await shot(p, 'p03-wrong-letters-mirror.png', { clip: { x: 180, y: 400, width: 1080, height: 470 } });
note('wrong letters', { value: await p.locator('#typing-input').inputValue(), help: await p.locator('#typing-help').innerText() });
await p.keyboard.press('Control+Backspace'); await p.waitForTimeout(150);
note('ctrl+backspace', { value: await p.locator('#typing-input').inputValue(), warnVisible: await p.locator('#exercise-warning').isVisible() });
await p.keyboard.press('Enter'); await p.waitForTimeout(150);
const wb = await p.locator('#exercise-warning').boundingBox();
note('enter warning geometry', { box: wb, inViewport: wb ? wb.y + wb.height <= 900 : null, text: await p.locator('#exercise-warning').innerText() });
await p.keyboard.press('Escape'); await p.waitForTimeout(100);
note('escape', { active: await active(p) });
await p.keyboard.press('Tab'); await p.waitForTimeout(300);
const wb2 = await p.locator('#exercise-warning').boundingBox();
note('tab during run', { active: await active(p), warning: await p.locator('#exercise-warning').innerText(), box: wb2, state: await p.locator('#exercise-state').innerText() });
await shot(p, 'p04-tab-during-run-viewport.png');
await p.keyboard.press('Enter'); await p.waitForTimeout(1000);
note('enter on focused restart', { active: await active(p), remaining: await p.locator('#remaining').innerText(), warnHidden: await p.locator('#exercise-warning').isHidden() });
// Long-run scroll check: type 4 passages at 60s, check active line stays visible
for (let k = 0; k < 4; k++) { const tt = await target(p); const v = await p.locator('#typing-input').inputValue(); await p.keyboard.type(tt.slice(v.length), { delay: 25 }); await p.keyboard.press('Space'); await p.waitForTimeout(80); }
const cur = await p.evaluate(() => { const c = document.querySelector('.prompt .cursor').getBoundingClientRect(); const v = document.querySelector('#typing-viewport').getBoundingClientRect(); return { cursorTop: c.top, vpTop: v.top, vpBottom: v.bottom, scrollTop: document.querySelector('#typing-viewport').scrollTop }; });
note('after 4 passages scroll', cur);
await shot(p, 'p05-after-four-passages.png', { clip: { x: 180, y: 400, width: 1080, height: 420 } });
// Window blur interruption
await p.evaluate(() => window.dispatchEvent(new Event('blur'))); await p.waitForTimeout(200);
note('window blur', { warning: await p.locator('#exercise-warning').innerText() });
await ctx.close(); saveLog('desktop-interaction-probes-log.json');
