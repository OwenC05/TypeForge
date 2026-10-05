// Playwright MCP browser_run_code_unsafe function; see README.md in this directory.
async (page) => {
  const browser = page.context().browser();
  const base = 'http://127.0.0.1:5183';
  const results = [], errors = [];
  const check = (name, ok, details) => {
    results.push({name, status: ok ? 'PASS' : 'FAIL', ...(details === undefined ? {} : {details})});
    if (!ok) throw new Error(name);
  };
  const target = p => p.locator('#target-description').innerText().then(text => text.replace('Passage to copy: ', ''));
  const saved = p => p.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open('typeforge');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains('results')) { db.close(); resolve([]); return; }
      const request = db.transaction('results').objectStore('results').getAll();
      request.onsuccess = () => { db.close(); resolve(request.result); };
      request.onerror = () => { db.close(); reject(request.error); };
    };
  }));
  async function run(name, path, test) {
    // Every case gets a fresh database without touching the runner's real context.
    const context = await browser.newContext();
    const p = await context.newPage();
    p.setDefaultTimeout(10000);
    p.on('pageerror', error => errors.push({case: name, message: error.message}));
    try {
      await p.clock.install();
      await p.clock.pauseAt(new Date());
      await p.goto(base + path);
      const input = p.locator('#typing-input');
      await input.waitFor();
      await test(p, input);
    } catch (error) {
      results.push({name: `${name}: execution`, status: 'FAIL', details: String(error)});
    } finally { await context.close(); }
  }
  await run('native safety stop', '/practice.html?duration=120', async (p, input) => {
    await input.focus();
    // Native key/beforeinput/input sequences, never a bulk value assignment.
    // This deliberately performs 600 native edits/renders, unlike short control actions.
    await input.pressSequentially('x'.repeat(600), {timeout: 120000});
    check('600 native characters remain accepted', (await input.inputValue()).length === 600);
    check('600 characters do not stop prematurely', !await input.evaluate(e => e.readOnly));
    // A native blur flags the run; later paints must retain the partial-only warning.
    await input.press('Tab');
    await p.keyboard.press('Shift+Tab');
    await input.press('x');
    check('601st native character safely stops without overwriting',
      (await input.inputValue()) === 'x'.repeat(600) && await input.evaluate(e => e.readOnly));
    check('safety stop does not save progress', (await saved(p)).length === 0);
    await input.press('Shift+Tab');
    check('stopped textarea allows Shift+Tab navigation', !await input.evaluate(e => e === document.activeElement));
    await input.focus();
    await input.press('Tab');
    check('stopped textarea Tab reaches Restart', await p.locator('#restart').evaluate(e => e === document.activeElement));
    await p.keyboard.press('Tab');
    check('keyboard reaches diagnostic Export', await p.locator('#export-stopped').evaluate(e => e === document.activeElement));
    check('flagged stopped warning stays partial-only after keyboard navigation',
      (await p.locator('#exercise-warning').innerText()).includes('will not be saved')
      && !(await p.locator('#exercise-warning').innerText()).includes('It will be saved'));
    const download = p.waitForEvent('download');
    await p.keyboard.press('Enter');
    check('keyboard Export downloads diagnostic', (await download).suggestedFilename().startsWith('typeforge-stopped-'));
    await p.keyboard.press('Shift+Tab');
    check('Shift+Tab from Export reaches Restart', await p.locator('#restart').evaluate(e => e === document.activeElement));
    await p.keyboard.press('Enter');
    await p.waitForFunction(() => !document.querySelector('#typing-input').readOnly && !document.querySelector('#typing-input').disabled);
    check('keyboard restart clears response and returns native focus',
      await input.inputValue() === '' && await input.evaluate(e => e === document.activeElement));
  });
  await run('native editing and rolling passage', '/practice.html', async (p, input) => {
    await input.focus();
    const prompt = await target(p);
    const wrong = prompt[0] === 'x' ? 'z' : 'x';
    await input.press(wrong);
    check('mistake exposes expected character correction',
      (await p.locator('#typing-help').innerText()).includes(`expected ${JSON.stringify(prompt[0])}`));
    await input.press('Home');
    await input.press('Shift+ArrowRight');
    check('native selection is retained and mirrored', await input.evaluate(e => e.selectionStart === 0 && e.selectionEnd === 1)
      && await p.locator('#prompt .selected').count() === 1);
    await input.press(prompt[0]);
    check('selection replacement corrects response', await input.inputValue() === prompt[0]);
    check('corrected character clears correction hint', !(await p.locator('#typing-help').innerText()).includes('Correction at'));
    await input.press('End');
    await input.pressSequentially(prompt.slice(1));
    await input.press('Enter');
    check('Enter neither adds text nor advances', await input.inputValue() === prompt && await target(p) === prompt);
    await input.press('Space');
    check('terminal Space rolls previous/current without Enter', await input.inputValue() === ''
      && await p.locator('#previous-prompt').innerText() === prompt && await target(p) !== prompt);
    check('rolling passage keeps native focus', await input.evaluate(e => e === document.activeElement));
  });
  for (const seconds of [15, 30, 60, 120]) {
    await run(`duration ${seconds}`, `/practice.html?duration=${seconds}`, async (p, input) => {
      check(`${seconds}s URL selects duration`, await p.locator('#duration').inputValue() === String(seconds));
      check(`${seconds}s timer starts idle`, await p.locator('#remaining').innerText() === String(seconds));
      await input.press('a');
      check(`${seconds}s locks selector after native input`, await p.locator('#duration').isDisabled());
      if (seconds !== 15) return;
      await p.clock.fastForward(15000);
      await p.waitForURL('**/results.html?*');
      const rows = await saved(p);
      check('accelerated 15s deadline saves exactly one result', rows.length === 1);
      check('saved result retains 15s duration and frozen elapsed', rows[0].settings.durationMs === 15000 && rows[0].metrics.elapsedMs === 15000);
      await p.clock.fastForward(30000);
      check('later accelerated ticks do not duplicate save', (await saved(p)).length === 1);
    });
  }
  await run('transient storage failure', '/practice.html?duration=15', async (p, input) => {
    await p.evaluate(() => {
      window.__originalAdd = IDBObjectStore.prototype.add;
      IDBObjectStore.prototype.add = function () { throw new DOMException('Test quota failure', 'QuotaExceededError'); };
    });
    try {
      await input.press('a');
      await p.clock.fastForward(15000);
      await p.locator('#retry-save').waitFor();
      check('transient failed save retains readable result', await p.locator('#completion').isVisible()
        && (await p.locator('#save-state').innerText()).includes('could not be saved'));
      check('transient failed save offers retry', await p.locator('#retry-save').isVisible());
      const download = p.waitForEvent('download');
      await p.locator('#export-current').click();
      check('unsaved result remains exportable', (await download).suggestedFilename().endsWith('.json'));
    } finally {
      await p.evaluate(() => { IDBObjectStore.prototype.add = window.__originalAdd; delete window.__originalAdd; });
    }
    await p.locator('#retry-save').click();
    await p.waitForURL('**/results.html?*');
    check('retry after storage recovery saves exactly once', (await saved(p)).length === 1);
  });
  await run('legacy fallback explanations', '/TypingDrill.html?duration=bogus&practice=manual&pair=zz', async (p) => {
    check('legacy invalid duration visibly explains fallback',
      await p.locator('#duration').inputValue() === '60' && (await p.locator('#exercise-warning').innerText()).includes('Unsupported duration'));
    check('legacy invalid manual pair visibly explains fallback',
      await p.locator('#practice-kind').inputValue() === 'general' && (await p.locator('#focus-state').innerText()).includes('Unsupported manual pair'));
  });
  return {suite: 'committed-native-typing-flow', browser: browser.version(), base,
    assertions: results.filter(r => !r.name.endsWith(': execution')).length,
    passed: results.filter(r => r.status === 'PASS').length, failed: results.filter(r => r.status === 'FAIL').length,
    results, errors, limits: ['Accelerated Playwright clock; not wall-clock duration evidence',
      'Single available browser engine; no physical AT, OS IME, device or browser UI zoom certification']};
}
