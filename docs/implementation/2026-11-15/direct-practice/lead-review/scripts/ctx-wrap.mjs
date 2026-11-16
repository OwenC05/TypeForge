const { chromium } = await import('file:///C:/Users/Owenc/AppData/Local/Temp/claude/bcbd159d70604b2a/f03e56f4-5efe-412b-b4ab-78aa0106925c/scratchpad/pw/node_modules/playwright-core/index.mjs');
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const out = {};
for (const [w, h] of [[390, 844], [320, 640]]) {
  let split = 0, overflow = 0, checked = 0, activeTop = new Set(), errors = [];
  for (let seed = 1; seed <= 25; seed++) {
    const page = await b.newPage({ viewport: { width: w, height: h } });
    page.on('pageerror', e => errors.push(String(e)));
    await page.addInitScript(s => { let x = s; Math.random = () => ((x = (x * 16807) % 2147483647) / 2147483647); }, seed * 7919);
    await page.goto('http://localhost:5303/'); await page.waitForSelector('#typing-input'); await page.waitForTimeout(250);
    const r = await page.evaluate(() => {
      const el = document.querySelector('#next-prompt'); const node = el.firstChild; const text = node?.textContent ?? '';
      const tops = [...text].map((_, i) => { const rg = document.createRange(); rg.setStart(node, i); rg.setEnd(node, i + 1); return Math.round(rg.getBoundingClientRect().top); });
      let splits = 0; let i = 0;
      for (const word of text.split(' ')) { const t = tops.slice(i, i + word.length); if (new Set(t).size > 1) splits++; i += word.length + 1; }
      return { splits, text, overflow: document.documentElement.scrollWidth > innerWidth, activeTop: Math.round(document.querySelector('#typing-input').getBoundingClientRect().top) };
    });
    checked++; split += r.splits; overflow += r.overflow ? 1 : 0; activeTop.add(r.activeTop);
    if (seed === 3) await page.screenshot({ path: `lead-review/ctxwrap-${w}.png` });
    await page.close();
  }
  out[w] = { checked, wordsSplitInNextLine: split, overflowPages: overflow, activeLineTops: [...activeTop], errors };
}
console.log(JSON.stringify(out)); await b.close();
