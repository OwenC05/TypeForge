const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const pwPath = process.env.P4_PLAYWRIGHT || 'C:/Users/Owenc/.codex/tools/mcp-node/node_modules/playwright';
const { chromium, firefox, webkit } = require(pwPath);
const root = process.cwd();
const out = __dirname;
const base = 'http://127.0.0.1:5314';
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const report = { at: new Date().toISOString(), commit: git('rev-parse', 'HEAD'), node: process.version,
  playwright: require(pwPath + '/package.json').version, base,
  source: Object.fromEntries(['src/app.ts', 'src/style.css', 'src/engine.ts', 'src/storage.ts', 'package-lock.json'].map(f => [f, sha(path.join(root, 'typing-app/client', f))])),
  assets: Object.fromEntries(fs.readdirSync(path.join(root, 'typing-app/client/dist/assets')).map(f => [f, sha(path.join(root, 'typing-app/client/dist/assets', f))])),
  availability: Object.fromEntries(Object.entries({chromium, firefox, webkit}).map(([name, engine]) => [name, {path: engine.executablePath(), exists: fs.existsSync(engine.executablePath())}])), runs: [] };
const regression = eval('(' + fs.readFileSync(path.join(root, 'typing-app/client/tests/browser/typing-flow.js'), 'utf8').replace('http://127.0.0.1:5301', base) + ')');

(async () => {
  for (const channel of ['chrome', 'msedge']) {
    const run = {channel, checks: [], errors: []}; report.runs.push(run);
    let browser;
    const check = (name, pass, detail) => run.checks.push({name, pass: Boolean(pass), detail});
    try {
      browser = await chromium.launch({channel, headless: true});
      run.version = browser.version();
      const temp = await browser.newPage();
      run.regression = await regression(temp);
      await temp.close();
      const context = await browser.newContext();
      const page = await context.newPage();
      page.on('pageerror', e => run.errors.push(String(e)));
      await page.clock.install();
      await page.clock.pauseAt(new Date(Date.now() + 1000));
      await page.goto(base);
      const input = page.locator('#typing-input');
      await input.waitFor();
      await page.waitForFunction(() => document.activeElement?.id === 'typing-input');
      run.userAgent = await page.evaluate(() => navigator.userAgent);
      fs.writeFileSync(path.join(out, channel + '-ready.aria.txt'), await page.locator('body').ariaSnapshot());
      check('named textarea role', await page.getByRole('textbox', {name: 'Type the passage', exact: true}).count() === 1);
      check('described passage and native help', await input.getAttribute('aria-describedby') === 'target-description typing-help' && (await page.locator('#target-description').textContent()).startsWith('Passage to copy: '));
      check('named navigation and timer', await page.getByRole('navigation', {name:'Main navigation'}).count() >= 1 && await page.getByRole('timer', {name:'Seconds left'}).count() === 1);
      run.readyControls = await page.locator('button, a, textarea, [role]').evaluateAll(es => es.filter(e => e.getClientRects().length).map(e => ({tag:e.tagName,id:e.id,role:e.getAttribute('role'),label:e.getAttribute('aria-label'),text:e.textContent.trim().slice(0,80),tabIndex:e.tabIndex})));
      await input.pressSequentially('abcde');
      await input.press('Home'); await input.press('ArrowRight'); await input.press('Shift+ArrowRight');
      check('middle native selection', await input.evaluate(e => e.selectionStart === 1 && e.selectionEnd === 2));
      await input.press('x');
      check('middle selection replacement', await input.inputValue() === 'axcde');
      await input.press('Backspace');
      check('middle native backspace preserves suffix', await input.inputValue() === 'acde');
      await input.press('Tab');
      check('running Tab reaches Restart', await page.locator('#restart').evaluate(e => e === document.activeElement));
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.querySelector('#stage').dataset.state === 'idle');
      check('keyboard restart returns textarea focus', await input.evaluate(e => e === document.activeElement && !e.value));
      run.tabOrder = [];
      for (let i=0;i<15;i++) {
        await page.keyboard.press('Tab');
        run.tabOrder.push(await page.evaluate(() => ({tag:document.activeElement.tagName,id:document.activeElement.id,text:document.activeElement.textContent.trim().slice(0,60),role:document.activeElement.getAttribute('role')})));
      }
      const duration60 = page.locator('#duration ui-segmented-control-item[value="60"]');
      await duration60.focus(); await page.keyboard.press('Space');
      check('keyboard changes idle duration', await page.locator('#duration').evaluate(e => String(e.value)) === '60');
      await page.locator('#qwerty').focus(); await page.keyboard.press('Space');
      const declared = await page.locator('#qwerty').evaluate(e => e.checked);
      check('keyboard switch toggles checked state', declared === true);
      await page.goto(base);
      await input.waitFor();
      check('duration and keyboard persist without query', await page.locator('#duration').evaluate(e => String(e.value)) === '60' && await page.locator('#qwerty').evaluate(e => e.checked) === declared);
      const pair = page.locator('#practice-kind ui-segmented-control-item[value="manual"]');
      await pair.focus(); await page.keyboard.press('Space');
      check('keyboard reaches manual pair control', await page.locator('#manual-pair').isVisible());
      const trigger = page.locator('#manual-pair button');
      await trigger.focus(); await page.keyboard.press('Enter');
      fs.writeFileSync(path.join(out, channel + '-pair.aria.txt'), await page.locator('body').ariaSnapshot());
      await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
      const selected = await page.locator('#manual-pair').evaluate(e => e.value);
      await page.goto(base);
      await input.waitFor();
      check('manual choice and selected pair persist', await page.locator('#practice-kind').evaluate(e => e.value) === 'manual' && await page.locator('#manual-pair').evaluate(e => e.value) === selected, {selected});
      await page.emulateMedia({reducedMotion: 'reduce'});
      run.reducedMotion = await page.evaluate(() => ({matches:matchMedia('(prefers-reduced-motion: reduce)').matches,transition:getComputedStyle(document.querySelector('.topbar')).transitionDuration, animation:getComputedStyle(document.querySelector('.topbar')).animationName}));
      check('reduced motion disables topbar transition', run.reducedMotion.matches && run.reducedMotion.transition === '0s');
      await page.emulateMedia({forcedColors:'active'});
      run.forcedColors = await input.evaluate(e => {e.focus(); const c=getComputedStyle(e); return {matches:matchMedia('(forced-colors: active)').matches,adjust:c.forcedColorAdjust,color:c.color,background:c.backgroundColor,outlineStyle:c.outlineStyle,outlineWidth:c.outlineWidth,caret:c.caretColor};});
      check('forced colors active with native textarea reachable', run.forcedColors.matches && await input.evaluate(e => e === document.activeElement && !e.disabled));
      await page.screenshot({path:path.join(out, channel+'-forced-colors.png')});
      await context.close();
    } catch (error) { run.executionError = String(error.stack || error); }
    finally { if (browser) await browser.close(); }
    fs.writeFileSync(path.join(out, 'browser-evidence.json'), JSON.stringify(report, null, 2));
  }
  console.log(JSON.stringify(report.runs.map(r => ({channel:r.channel,version:r.version,regression:r.regression && {passed:r.regression.passed,failed:r.regression.failed,errors:r.regression.errors},checks:r.checks,executionError:r.executionError})),null,2));
  process.exitCode = report.runs.some(r => r.executionError || r.checks.some(c => !c.pass) || r.regression?.failed || r.regression?.errors.length) ? 1 : 0;
})();
