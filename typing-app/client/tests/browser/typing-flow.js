// Playwright MCP browser_run_code_unsafe function; see README.md in this directory.
async (page, base = 'http://127.0.0.1:5324') => {
  const browser = page.context().browser();
  // Storage isolation: before any app code, indexedDB.open('typeforge') is redirected to a UUID synthetic name;
  // other names and deleteDatabase are refused. Saved sources live in C's `currentResults` store.
  const synthetic = name => {
    const target = globalThis.indexedDB;
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: new Proxy(target, { get(t, property) {
      if (property === 'open') return (requested, version) => {
        if (requested !== 'typeforge') throw new Error(`synthetic fixture refused database ${requested}`);
        return version === undefined ? t.open(name) : t.open(name, version);
      };
      if (property === 'deleteDatabase') return () => { throw new Error('synthetic fixture refuses deleteDatabase'); };
      const value = Reflect.get(t, property, t); return typeof value === 'function' ? value.bind(t) : value; } }) });
    Object.defineProperty(globalThis, '__synthetic', { value: name });
  };

  const results = [], errors = [];
  const check = (name, ok, details) => {
    results.push({name, status: ok ? 'PASS' : 'FAIL', ...(details === undefined ? {} : {details})});
    if (!ok) throw new Error(name);
  };
  // SDK settings expose their state as element properties, not native form values.
  const value = (p, selector) => p.locator(selector).evaluate(e => String(e.value));
  const savedInPlace = p => p.waitForFunction(() => document.querySelector('#save-state')?.textContent?.startsWith('Saved in this browser'), null, {polling: 100});
  const target = p => p.locator('#target-description').innerText().then(text => text.replace('Passage to copy: ', ''));
  const saved = p => p.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open('typeforge');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains('currentResults')) { db.close(); resolve([]); return; }
      const request = db.transaction('currentResults').objectStore('currentResults').getAll();
      request.onsuccess = () => { db.close(); resolve(request.result); };
      request.onerror = () => { db.close(); reject(request.error); };
    };
  }));
  async function run(name, path, test) {
    // Every case gets a fresh database without touching the runner's real context.
    const context = await browser.newContext();
    const database = `typeforge-ui-synthetic-${crypto.randomUUID()}`;
    await context.addInitScript(synthetic, database);
    const p = await context.newPage();
    p.setDefaultTimeout(10000);
    p.on('pageerror', error => errors.push({case: name, message: error.message}));
    try {
      await p.clock.install();
      await p.clock.pauseAt(new Date(Date.now() + 1000)); // a lead: the page clock started at install and may already be past Node's now
      await p.goto(base + path);
      const input = p.locator('#typing-input');
      await input.waitFor();
      if (await p.evaluate(() => globalThis.__synthetic) !== database) throw new Error('synthetic database interception missing');
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
      check(`${seconds}s URL selects duration`, await value(p, '#duration') === String(seconds));
      check(`${seconds}s timer starts idle`, await p.locator('#remaining').innerText() === String(seconds));
      await input.press('a');
      // Settings stay focusable but refuse changes while a block runs (no disabled-state focus loss).
      const refused = await p.locator('#duration').evaluate((e, next) => { e.api.setValue(next); return String(e.value); }, seconds === 15 ? '30' : '15');
      check(`${seconds}s refuses duration changes after native input`, refused === String(seconds)
        && (await p.locator('#settings-status').innerText()).includes('refused'));
      if (seconds !== 15) return;
      await p.clock.fastForward(15000);
      await savedInPlace(p);
      check('15s result renders in place without navigation', new URL(p.url()).pathname.endsWith('/practice.html'));
      const rows = await saved(p);
      check('accelerated 15s deadline saves exactly one result', rows.length === 1);
      check('saved result retains 15s duration and frozen elapsed', rows[0].settings.durationMs === 15000 && rows[0].metrics.elapsedMs === 15000);
      await p.clock.fastForward(30000);
      check('later accelerated ticks do not duplicate save', (await saved(p)).length === 1);
    });
  }
  await run('transient storage failure', '/practice.html?duration=15', async (p, input) => {
    // As in the app, the load-time status check creates the database before any save; the fault starts after it.
    await p.clock.runFor(100);
    await p.waitForFunction(async () => (await indexedDB.databases()).some(d => d.name === globalThis.__synthetic), null, {polling: 50});
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
    await savedInPlace(p);
    check('retry after storage recovery saves exactly once', (await saved(p)).length === 1);
  });
  await run('direct practice at /', '/', async (p, input) => {
    check('/ is ready practice with 30 s default and native focus', await p.locator('#remaining').innerText() === '30'
      && await value(p, '#duration') === '30' && await input.evaluate(e => e === document.activeElement));
    check('/ shows no landing gate', await p.locator('#stage').isVisible() && await p.locator('.hero, .page-intro, .page-heading').count() === 0 && new URL(p.url()).search === '');
    await input.press('a');
    check('first accepted key starts the block', await p.locator('#stage').evaluate(e => e.dataset.state) === 'running');
    await p.clock.fastForward(30000);
    await savedInPlace(p);
    check('practice result is in place with Again focused', await p.locator('#again').evaluate(e => e === document.activeElement));
    const rows = await saved(p);
    check('practice block saved once as practice', rows.length === 1 && rows[0].mode === 'practice' && rows[0].settings.durationMs === 30000);
    await p.keyboard.press('Enter');
    await p.waitForFunction(() => document.querySelector('#stage').dataset.state === 'idle' && !document.querySelector('#typing-input').disabled);
    check('Enter on Again starts a fresh ready block with native focus', await input.evaluate(e => e === document.activeElement && e.value === ''));
  });
  await run('legacy fallback explanations', '/TypingDrill.html?duration=bogus&practice=manual&pair=zz', async (p) => {
    check('legacy invalid duration visibly explains fallback',
      await value(p, '#duration') === '60' && (await p.locator('#exercise-warning').innerText()).includes('Unsupported duration'));
    check('legacy invalid manual pair visibly explains fallback',
      await value(p, '#practice-kind') === 'general' && (await p.locator('#focus-state').textContent()).includes('Unsupported manual pair'));
  });
  return {suite: 'committed-native-typing-flow', browser: browser.version(), base,
    assertions: results.filter(r => !r.name.endsWith(': execution')).length,
    passed: results.filter(r => r.status === 'PASS').length, failed: results.filter(r => r.status === 'FAIL').length,
    results, errors, limits: ['Accelerated Playwright clock; not wall-clock duration evidence',
      'One engine per run; physical AT, OS IME, devices and browser UI zoom remain unverified']};
}
