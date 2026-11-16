// Full state captures at 1440x900, 390x844 and 320x640 on the production preview -> states.json
// Real key/pointer events through the native textarea; Playwright clock paused and advanced
// explicitly (accelerated clock, not wall-clock evidence). Reduced motion keeps the run-state
// opacity change immediate so a paused clock cannot freeze a transition mid-way.
import { launch, BASE, VIEWPORTS, target, active, shot, saved, savedInPlace, geometry, chromeVersion, seededRandom, writeJson } from './lib.mjs';

const only = process.argv[2] ? process.argv[2].split(',') : Object.keys(VIEWPORTS);
const report = { generatedAt: new Date().toISOString(), base: BASE, chrome: null, notes: [], viewports: {} };
const SEED = 20261115;

async function open(label, viewport, url, { seed = SEED } = {}) {
  const run = await launch(label, viewport);
  if (seed !== null) await run.page.addInitScript(seededRandom(seed));
  await run.page.clock.install();
  await run.page.clock.pauseAt(new Date(Date.now() + 1000));
  await run.page.goto(BASE + url);
  await run.page.locator('#typing-input, #main').first().waitFor();
  report.chrome ??= await chromeVersion(run.context, run.page);
  return run;
}
const blankPoint = vp => ({ x: Math.round(vp.width / 2), y: 28 }); // empty middle of the top bar, never inside the stage
/** Move focus off the passage with a real click on blank page, then wait for the recovery key (diagnostic on timeout). */
async function blurStage(page, viewport) {
  await page.mouse.click(blankPoint(viewport).x, blankPoint(viewport).y);
  try { await page.locator('#continue-typing').waitFor({ state: 'visible', timeout: 5000 }); }
  catch (error) {
    const dump = await page.evaluate(() => ({ active: document.activeElement?.outerHTML.slice(0, 80), stage: { ...document.querySelector('#stage').dataset }, disabled: document.querySelector('#typing-input').disabled }));
    throw new Error(`continue-typing not visible after blur: ${JSON.stringify(dump)}`, { cause: error });
  }
}

for (const vp of only) {
  const viewport = VIEWPORTS[vp];
  const states = [];
  report.viewports[vp] = { viewport, states };
  const capture = async (page, id, slug, state, extra = {}) => {
    const file = await shot(page, `${vp}-${id}-${slug}.png`, extra.fullPage ? { fullPage: true } : {});
    const facts = await page.evaluate(() => ({
      url: location.pathname + location.search, run: document.querySelector('#stage')?.dataset.state ?? null,
      slot: document.querySelector('#exercise-warning')?.textContent ?? null, saveState: document.querySelector('#save-state')?.textContent ?? null,
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }));
    const entry = { id: `${vp}-${id}`, slug, state, file, active: await active(page), ...facts, ...(extra.facts ?? {}) };
    states.push(entry);
    return entry;
  };

  // ---------- Practice journey on one profile: first visit through result ----------
  const { context, page, errors } = await open(`states-${vp}`, viewport, '/');
  await page.waitForFunction(() => document.activeElement?.id === 'typing-input');
  await capture(page, '01', 'ready-focused-first-visit', 'Clean first visit to /: 30 s General ready, native focus, no gate', { facts: { geometry: await geometry(page) } });
  await blurStage(page, viewport);
  await capture(page, '02', 'ready-unfocused', 'Ready, focus moved away: start-typing button over the passage');
  await page.locator('#continue-typing').click();
  const passage = await target(page);
  await page.keyboard.type(passage.slice(0, 9), { delay: 10 });
  await page.clock.fastForward(6000);
  await capture(page, '03', 'running', 'Running, correct prefix typed, 6 s elapsed', { facts: { geometry: await geometry(page) } });
  await page.keyboard.type(passage[9] === 'x' ? 'z' : 'x');
  await page.clock.fastForward(1000);
  await capture(page, '04', 'running-error', 'Running with a first mismatch: expected-glyph tag above the wrong glyph', { facts: { expected: await page.locator('.first-mismatch').getAttribute('data-expected'), geometry: await geometry(page) } });
  await page.keyboard.press('Backspace');
  await page.keyboard.type(passage[9]);
  await capture(page, '05', 'corrected', 'Mismatch corrected with Backspace + expected glyph');
  // Pointer off-line: error at the second glyph, then type on until the caret leaves the mismatch line.
  await page.keyboard.press('Control+a'); await page.keyboard.press('Backspace');
  await page.keyboard.type(passage[0] + (passage[1] === 'x' ? 'z' : 'x') + passage.slice(2), { delay: 5 });
  let extras = 0;
  while (!await page.locator('#prompt .cursor[data-pointer]').count() && extras < 80) { await page.keyboard.type('z'); extras++; }
  await capture(page, '06', 'pointer-off-line', 'Earlier error off the caret line: caret-side pointer names the expected glyph', { facts: { pointer: await page.locator('#prompt .cursor').getAttribute('data-pointer'), extras } });
  await page.keyboard.press('Control+a'); await page.keyboard.press('Backspace');
  await page.keyboard.type(passage, { delay: 5 });
  await page.keyboard.press('Space');
  await capture(page, '07', 'committed', 'Passage committed with Space: previous line above, next passage active');
  await blurStage(page, viewport);
  await capture(page, '08', 'focus-lost', 'Focus lost mid-run: integrity notice in the reserved slot, continue-typing button');
  await page.locator('#continue-typing').click();
  await page.locator('#restart').click();
  await page.waitForFunction(() => document.querySelector('#stage').dataset.state === 'idle' && !document.querySelector('#typing-input').disabled);
  const second = await target(page);
  await page.keyboard.type(second.slice(0, 5), { delay: 5 });
  await page.keyboard.press('Control+z');
  await capture(page, '09', 'undo', 'Native Undo during a run: Undo notice, run continues unscored');
  await page.locator('#restart').click();
  await page.waitForFunction(() => document.querySelector('#stage').dataset.state === 'idle' && !document.querySelector('#typing-input').disabled);
  const third = await target(page);
  await page.keyboard.type(third.slice(0, 12), { delay: 5 });
  await page.keyboard.type(third[12] === 'x' ? 'z' : 'x');
  await page.keyboard.press('Backspace');
  await page.keyboard.type(third.slice(12), { delay: 5 });
  await page.keyboard.press('Space');
  await page.clock.fastForward(31000);
  await savedInPlace(page);
  await page.waitForFunction(() => document.querySelector('#today-summary').textContent.length > 0);
  await capture(page, '10', 'practice-result', 'Practice result in place, saved, Again focused, today line above');
  // Remember settings: 60 s + pair practice (default pair th), then return to /.
  await page.locator('#duration ui-segmented-control-item[value="60"]').click();
  await page.waitForFunction(() => document.querySelector('#stage').dataset.state === 'idle');
  await page.locator('#practice-kind ui-segmented-control-item[value="manual"]').click();
  await page.waitForFunction(() => customElements.get('ui-select') && !document.querySelector('#manual-pair').hidden && document.querySelector('#stage').dataset.state === 'idle');
  await page.goto(BASE + '/');
  await page.locator('#prompt span').first().waitFor();
  await page.waitForFunction(() => customElements.get('ui-select') && !document.querySelector('#manual-pair').hidden);
  await capture(page, '11', 'returning-remembered', 'Returning visit to /: remembered 60 s pair practice (today line shows above results only)', { facts: { duration: await page.locator('#duration').evaluate(e => e.value), kind: await page.locator('#practice-kind').evaluate(e => e.value) } });
  await page.locator('#manual-pair ui-select-trigger button').click();
  await page.locator('#manual-pair ui-select-content').waitFor();
  await capture(page, '12', 'pair-popover', 'Pair list open (lazy Select), current pair highlighted');
  await page.keyboard.press('Escape');
  // Assessment result.
  await page.goto(BASE + '/practice.html?duration=15');
  await page.locator('#prompt span').first().waitFor();
  const assess = await target(page);
  await page.keyboard.type(assess, { delay: 5 });
  await page.keyboard.press('Space');
  await page.clock.fastForward(16000);
  await savedInPlace(page);
  await capture(page, '13', 'assessment-result', 'Assessment result in place: Practice next focused, fresh retest secondary');
  // Insufficient evidence: QWERTY declared, Suggested requested, no compatible assessment yet.
  await page.goto(BASE + '/?qwerty=1&practice=recommended');
  await page.locator('#prompt span').first().waitFor();
  await page.waitForFunction(() => !document.querySelector('#recommendation-reason').textContent.startsWith('Checking'));
  await page.locator('#suggested-item').click({ force: true });
  await page.locator('#why button').click();
  await capture(page, '14', 'insufficient-evidence', 'Suggested requested without supporting evidence: general practice, reason in Why? and the slot');
  await page.goto(BASE + '/progress.html');
  await page.locator('#activity-grid div').first().waitFor();
  await capture(page, '15', 'progress', 'Progress with saved practice and assessment history', { fullPage: true });
  await page.goto(BASE + '/lab.html');
  await page.locator('#lab-report > *').first().waitFor();
  await capture(page, '16', 'lab', 'Lab page, lighter pass', { fullPage: true });
  report.viewports[vp].savedRows = (await saved(page)).map(row => ({ mode: row.mode, durationMs: row.settings.durationMs, eligible: row.eligibleForProgress, manualPair: row.manualDrill?.pair ?? null }));
  report.viewports[vp].pageErrors = errors;
  await context.close();

  // ---------- Empty progress and save failure in isolated profiles ----------
  const empty = await open(`empty-${vp}`, viewport, '/progress.html');
  await empty.page.locator('.empty').waitFor();
  await capture(empty.page, '17', 'progress-empty', 'Progress, first visit: nothing saved yet', { fullPage: true });
  await empty.context.close();
  const failing = await open(`savefail-${vp}`, viewport, '/?duration=15');
  await failing.page.evaluate(() => { window.__add = IDBObjectStore.prototype.add; IDBObjectStore.prototype.add = function () { throw new DOMException('Test quota failure', 'QuotaExceededError'); }; });
  await failing.page.keyboard.type((await target(failing.page)).slice(0, 10), { delay: 5 });
  await failing.page.clock.fastForward(16000);
  await failing.page.locator('#retry-save:not([hidden])').waitFor();
  await capture(failing.page, '18', 'save-failure', 'Save failure (isolated profile, injected quota error): result kept, retry + export');
  await failing.page.evaluate(() => { IDBObjectStore.prototype.add = window.__add; });
  await failing.page.locator('#retry-save').click();
  await savedInPlace(failing.page);
  await capture(failing.page, '19', 'save-retried', 'Retry after storage recovers: saved once', { facts: { rows: (await saved(failing.page)).length } });
  report.viewports[vp].pageErrors.push(...empty.errors, ...failing.errors);
  await failing.context.close();
  console.log(vp, states.map(s => `${s.id}:${s.active}:${s.run}`).join(' | '), 'errors', report.viewports[vp].pageErrors.length);
}
report.notes.push('Seeded Math.random (seed 20261115) is installed before app scripts so passages are reproducible.',
  'Reduced motion emulated; Playwright clock installed and paused one second after the real launch time, then advanced with fastForward (accelerated clock, not wall-clock evidence).');
writeJson(only.length === 3 ? 'states.json' : `states-${only.join('-')}.json`, report);
