import { launch, shot, note, saveLog, active, OUT, log } from './klib.mjs';
import fs from 'node:fs';
const prev = JSON.parse(fs.readFileSync(OUT + '/keybr-log.json', 'utf8')); log.push(...prev);
const c = await launch(process.argv[2], { width: 1440, height: 900 });
const p = c.pages()[0] ?? await c.newPage();
await p.goto('https://www.keybr.com/', { waitUntil: 'domcontentloaded', timeout: 60000 }); await p.waitForSelector('textarea'); await p.waitForTimeout(3000);
const btns = await p.evaluate(() => [...document.querySelectorAll('button,[role=button],a')].filter(e => /settings/i.test(e.innerText + (e.title || '') + (e.getAttribute('aria-label') || ''))).map(e => ({ tag: e.tagName, text: e.innerText.trim(), title: e.title, href: e.getAttribute('href') })));
note('settings candidates', { btns });
await p.evaluate(() => { const e = [...document.querySelectorAll('button,[role=button]')].find(x => /settings/i.test(x.innerText + (x.title || ''))); e?.click(); });
await p.waitForTimeout(2500);
note('after settings click', { url: p.url(), text: (await p.locator('body').innerText()).slice(0, 2500) });
await shot(p, 'k10-settings-1440.png'); await shot(p, 'k10b-settings-full.png', { fullPage: true });
// Keyboard-only: from load, how is focus? Tab order first stops
await p.goto('https://www.keybr.com/', { waitUntil: 'domcontentloaded' }); await p.waitForSelector('textarea'); await p.waitForTimeout(2500);
const order = []; for (let i = 0; i < 8; i++) { await p.keyboard.press('Tab'); order.push(await active(p)); }
note('tab order from typing focus', { order });
await shot(p, 'k16-after-tabs-focus-visibility.png');
await c.close(); saveLog('keybr-log.json');
