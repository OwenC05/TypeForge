import { launch, note } from './klib.mjs';
const c = await launch(process.argv[2], { width: 1440, height: 900 });
const p = c.pages()[0] ?? await c.newPage();
await p.goto('https://www.keybr.com/', { waitUntil: 'domcontentloaded', timeout: 60000 }); await p.waitForTimeout(4000);
const info = await p.evaluate(() => { const ta = document.querySelector('textarea'); let n = ta; for (let i = 0; i < 3; i++) n = n.parentElement; return { taAttrs: [...ta.attributes].map(a => a.name + '=' + a.value).join(' '), parentHtml: n.outerHTML.slice(0, 3000) }; });
console.log(info.taAttrs); console.log(info.parentHtml);
await c.close();
