const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
for (const forced of ['none','active']) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, forcedColors: forced });
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:5318/index.html?page=assessment&fx=s4&view=result&outcome=saved');
  await p.waitForSelector('body[data-ready="1"]'); await p.waitForTimeout(300);
  const c = await p.evaluate(() => { const on = document.querySelector('.baseline-progress ui-progress-indicator'); const tr = document.querySelector('.baseline-progress ui-progress-track'); return { on: getComputedStyle(on).backgroundColor, track: getComputedStyle(tr).backgroundColor, canvas: getComputedStyle(document.body).backgroundColor }; });
  console.log(forced, JSON.stringify(c));
  await ctx.close();
}
await b.close();
