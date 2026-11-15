import { launch, shot, note, saveLog, active } from './lib.mjs';
const ud = process.argv[2];
const ctx = await launch(ud, { width: 1440, height: 900 });
const p = ctx.pages()[0] ?? await ctx.newPage();
const t0 = Date.now();
await p.goto('https://monkeytype.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#words .word', { timeout: 60000 }).catch(e => note('words wait failed', { e: e.message }));
await p.waitForTimeout(2500);
note('mt loaded', { ms: Date.now() - t0, active: await active(p), url: p.url() });
await shot(p, 'mt01-first-visit-1440-consent-dialog.png');
await p.evaluate(() => { const e = document.querySelector('#cmpbntnotxt'); const t = e?.closest('a,button,[onclick],[role=button]') ?? e; t?.click(); return !!e; }).then(() => note('cmp reject all clicked')).catch(e => note('cmp reject fail', { e: e.message.slice(0, 200) }));
await p.waitForTimeout(1500);
// Cookie consent: choose the minimal option if present.
note('cmp still visible?', { v: await p.locator('#cmpbox').isVisible().catch(() => null) });
for (const label of ['reject non-essential']) {
  const b = p.getByRole('button', { name: new RegExp(label, 'i') });
  const n = await b.count().catch(() => 0); for (let i = 0; i < n; i++) { if (await b.nth(i).isVisible().catch(() => false)) { note('consent click', { label }); await b.nth(i).click().catch(() => {}); await p.waitForTimeout(800); } }
}
await p.waitForTimeout(1200);
await shot(p, 'mt02-first-visit-1440.png');
note('after consent', { active: await active(p), version: await p.evaluate(() => (document.body.innerText.match(/v\d{2}\.\d+\.\d+/) || [null])[0]) });
// Does typing work immediately?
await p.keyboard.type('x'); await p.waitForTimeout(300);
note('typed x immediately', { active: await active(p), typed: await p.evaluate(() => document.querySelector('#words .word.active')?.innerText ?? null), activeWordHtmlLen: await p.evaluate(() => document.querySelector('#words .word.active')?.querySelectorAll('letter.incorrect, letter.extra').length ?? null) });
await shot(p, 'mt03-error-feedback-1440.png');
// Restart with Tab + Enter (key tip) to clear, choose 15s.
await p.keyboard.press('Tab'); await p.keyboard.press('Enter'); await p.waitForTimeout(800);
note('after tab+enter', { active: await active(p) });
const fifteen = p.locator('.time button[timeconfig="15"], button[timeconfig="15"], .textButton[timeconfig="15"]');
note('15 button count', { n: await fifteen.count() });
{ const c = p.getByRole('button', { name: /^15$/ }); const n = await c.count(); let ok = false; for (let i = 0; i < n; i++) { if (await c.nth(i).isVisible()) { await c.nth(i).click(); ok = true; break; } } note('15 clicked', { ok, n }); }
await p.waitForTimeout(800);
note('after choosing 15', { active: await active(p) });
await shot(p, 'mt04-15s-idle-1440.png');
// Type the test for real with key events.
const start = Date.now(); let words = 0; let midShot = false;
while (Date.now() - start < 25000) {
  const done = await p.evaluate(() => !!document.querySelector('#result:not(.hidden)') && getComputedStyle(document.querySelector('#result')).display !== 'none' && document.querySelector('#result').offsetParent !== null).catch(() => false);
  if (done) break;
  const w = await p.evaluate(() => { const a = document.querySelector('#words .word.active'); return a ? [...a.querySelectorAll('letter')].map(l => l.textContent).join('') : null; }).catch(() => null);
  if (!w) { await p.waitForTimeout(200); continue; }
  await p.keyboard.type(w, { delay: 95 }); await p.keyboard.press('Space'); words++;
  if (!midShot && Date.now() - start > 6000) { midShot = true; await shot(p, 'mt05-running-1440.png'); }
}
await p.waitForTimeout(2500);
note('mt 15s test typed', { words, ms: Date.now() - start });
await shot(p, 'mt06-result-1440.png');
await shot(p, 'mt07-result-1440-full.png', { fullPage: true });
note('result text', { text: (await p.locator('#result').innerText().catch(() => '')).slice(0, 600) });
// Returning visit: reload, is 15 remembered?
await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForSelector('#words .word', { timeout: 60000 }).catch(() => {}); await p.waitForTimeout(2000);
note('mt returning', { active: await active(p), selectedTime: await p.evaluate(() => document.querySelector('button[timeconfig].active, .textButton.active[timeconfig]')?.getAttribute('timeconfig') ?? null) });
await shot(p, 'mt08-returning-visit-1440.png');
await ctx.close();
// Mobile viewport
const m = await launch(ud + '-m', { width: 390, height: 844 }, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const q = m.pages()[0] ?? await m.newPage();
await q.goto('https://monkeytype.com/', { waitUntil: 'domcontentloaded', timeout: 60000 }); await q.waitForSelector('#words .word', { timeout: 60000 }).catch(() => {}); await q.waitForTimeout(2500);
await q.evaluate(() => { const e = document.querySelector('#cmpbntnotxt'); (e?.closest('a,button,[onclick],[role=button]') ?? e)?.click(); }).catch(() => {}); await q.waitForTimeout(1500);
for (const label of ['^\s*reject all\s*$', 'reject non-essential']) { const b = q.getByRole('button', { name: new RegExp(label, 'i') }); const n = await b.count().catch(() => 0); for (let i = 0; i < n; i++) { if (await b.nth(i).isVisible().catch(() => false)) { await b.nth(i).click().catch(() => {}); await q.waitForTimeout(800); } } }
await q.waitForTimeout(1000);
await shot(q, 'mt09-mobile-390.png'); await q.tap('#words').catch(()=>{}); await q.waitForTimeout(800); await shot(q, 'mt10-mobile-390-after-tap.png');
note('mt mobile geometry', await q.evaluate(() => { const w = document.querySelector('#words'); const b = w?.getBoundingClientRect(); return { wordsTop: b ? Math.round(b.top) : null, wordsBottom: b ? Math.round(b.bottom) : null, scrollW: document.documentElement.scrollWidth }; }));
await m.close();
saveLog('monkeytype-log.json');
