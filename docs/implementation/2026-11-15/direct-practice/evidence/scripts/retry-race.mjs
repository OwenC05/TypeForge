// ET-1 browser evidence for a delayed in-place retry (root review F3) and a result-state setting
// chosen on the real rail. Fault injection stays at the browser storage boundary: IDBObjectStore.add
// throws to fail a save, and one armed read-write IDBTransaction delivers its oncomplete only when the
// test releases it (the write itself commits; the app learns of it late, as with slow storage).
// Playwright clock for the 15 s blocks. -> ../retry-race.json
import { launch, BASE, VIEWPORTS, target, active, saved, seededRandom, writeJson } from './lib.mjs';
import { buildIdentity, finish } from './lib.mjs';

const boundary = `(() => {
  const add = IDBObjectStore.prototype.add;
  window.__failAdds = on => { IDBObjectStore.prototype.add = on ? function () { throw new DOMException('Injected quota failure', 'QuotaExceededError'); } : add; };
  window.__armWrite = () => { window.__holdNext = true; window.__writeGate = new Promise(resolve => { window.__releaseWrite = resolve; }); };
  const descriptor = Object.getOwnPropertyDescriptor(IDBTransaction.prototype, 'oncomplete');
  Object.defineProperty(IDBTransaction.prototype, 'oncomplete', { configurable: true, get: descriptor.get, set(handler) {
    if (this.mode === 'readwrite' && window.__holdNext) { window.__holdNext = false; window.__held = true; const gate = window.__writeGate; const tx = this;
      descriptor.set.call(this, event => gate.then(() => { window.__held = false; handler?.call(tx, event); }));
    } else descriptor.set.call(this, handler);
  } });
})();`;
const results = [];
const check = (name, ok, details) => { results.push({ name, ok: Boolean(ok), ...(details === undefined ? {} : { details }) }); if (!ok) console.log('FAIL', name, JSON.stringify(details ?? null).slice(0, 400)); };
async function open(label) {
  const run = await launch(label, VIEWPORTS[1440]);
  await run.page.addInitScript(seededRandom(20261115));
  await run.page.addInitScript(boundary);
  await run.page.clock.install();
  await run.page.clock.pauseAt(new Date(Date.now() + 1000));
  await run.page.goto(`${BASE}/?duration=15`);
  await run.page.locator('#prompt span').first().waitFor();
  return run;
}
async function completeBlock(page) {
  if (await page.locator('#continue-typing').isVisible()) await page.locator('#continue-typing').click();
  await page.keyboard.type((await target(page)).slice(0, 10), { delay: 5 });
  await page.clock.fastForward(16000);
  await page.waitForFunction(() => /could not be saved|Saved in this browser/.test(document.querySelector('#save-state')?.textContent ?? ''));
}
const ready = page => page.waitForFunction(() => document.querySelector('#stage').dataset.state === 'idle' && !document.querySelector('#typing-input').disabled);
const line = page => page.evaluate(() => ({ hidden: document.querySelector('#carried').hidden, text: document.querySelector('#carried .carried-text')?.textContent ?? '' }));
/** Fail the first save, then start an in-place retry whose completion is held. */
async function pendingRetry(page) {
  await page.evaluate(() => window.__failAdds(true));
  await completeBlock(page);
  await page.evaluate(() => { window.__failAdds(false); window.__armWrite(); });
  await page.locator('#retry-save').click();
  await page.waitForFunction(() => window.__held === true);
}
const report = { generatedAt: new Date().toISOString(), base: BASE, build: await buildIdentity(), flows: {} };

for (const leave of ['Again', 'rail setting (30 s)', 'saved replacement result']) {
  const { context, page, errors } = await open(`race-${leave.split(' ')[0].toLowerCase()}`);
  await pendingRetry(page);
  if (leave === 'rail setting (30 s)') await page.locator('#duration ui-segmented-control-item[value="30"]').click();
  else await page.locator('#again').click();
  await ready(page);
  const duringHold = await line(page);
  check(`${leave}: continues immediately while the retry is still pending (pending is tracked, not listed)`, duringHold.hidden, duringHold);
  let expectFocus = 'textarea#typing-input';
  if (leave === 'saved replacement result') {
    await completeBlock(page);
    await page.waitForFunction(() => document.querySelector('#save-state')?.textContent?.startsWith('Saved in this browser'));
    await page.evaluate(() => document.activeElement?.blur()); // neutral focus: a stale handoff would move it
    expectFocus = 'body';
  } else await page.locator('#typing-input').focus();
  await page.evaluate(() => window.__releaseWrite());
  await page.waitForFunction(() => window.__held === false);
  await page.waitForTimeout(300);
  const after = { focused: await active(page), line: await line(page), rows: (await saved(page)).length, duration: await page.locator('#duration').evaluate(e => e.value) };
  report.flows[leave] = { duringHold, after, errors };
  check(`${leave}: the late retry raises no page error`, errors.length === 0, errors);
  check(`${leave}: the late retry moves no focus`, after.focused === expectFocus, after);
  check(`${leave}: the retried result is saved once and leaves nothing listed`, after.line.hidden && after.rows === (leave === 'saved replacement result' ? 2 : 1), after);
  if (leave === 'rail setting (30 s)') check('rail setting: the new duration applies', after.duration === '30', after);
  await context.close();
}

// A result-state setting chosen on the real rail carries a failed result like Again.
{
  const { context, page, errors } = await open('rail-carry');
  await page.evaluate(() => window.__failAdds(true));
  await completeBlock(page);
  await page.locator('#duration ui-segmented-control-item[value="30"]').click();
  await ready(page);
  const carried = await line(page);
  check('rail setting after a failed save: continues at 30 s and lists 1 result', carried.text === '1 result not saved' && await page.locator('#duration').evaluate(e => e.value) === '30', carried);
  check('rail setting after a failed save: no page error', errors.length === 0, errors);
  report.flows['rail setting carries a failed result'] = { carried, errors };
  await context.close();
}

report.boundary = 'Fault injection only at IDBObjectStore.add (throw) and IDBTransaction.oncomplete (late delivery). Not covered in the browser: disposal between retry and settlement (the document is destroyed; actual-handler test in continuation.test.ts) and ResultValidationError (production input is validated before save; actual-handler tests only).';
report.results = results;
report.summary = { checks: results.length, failed: results.filter(r => !r.ok).length, pageErrors: Object.values(report.flows).reduce((n, f) => n + (f.errors?.length ?? 0), 0) };
writeJson('retry-race.json', report);
console.log(JSON.stringify(report.summary));
finish(report.summary);
