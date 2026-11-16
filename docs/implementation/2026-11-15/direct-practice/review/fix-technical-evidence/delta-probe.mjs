import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { UnsavedResults, newSaveRecord } from '../../../../../../typing-app/client/src/unsaved.ts';

const show = spec => execFileSync('git', ['show', spec], { encoding: 'utf8', windowsHide: true }).replace(/\r\n/g, '\n');
const revision = 'a36a6e37efc2f7b28847c53db16c9e826b1bd096';
const source = show(`${revision}:typing-app/client/src/app.ts`);
const tests = show(`${revision}:typing-app/client/tests/continuation.test.ts`);
assert.equal(show(`${revision}:typing-app/client/src/unsaved.ts`), show('71201b7:typing-app/client/src/unsaved.ts'), 'imported frozen helper matches delta exactly');
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const factory = runInNewContext(stripTypeScriptTypes(tests.slice(tests.indexOf('const extract ='), tests.indexOf("\ntest('ET-1:")) + '; continuationHost'), {
  source, assert, runInNewContext, stripTypeScriptTypes, UnsavedResults, setTimeout, URLSearchParams,
});
console.log(`Actual committed handler probes at ${revision}; host fakes, no browser or npm run.`);
{
  const host = factory();
  const first = host.complete('permanent-after-again'); await host.again();
  const notifications = [];
  host.context.unsaved.listed; // collection currently retains the pending record
  const record = host.context.unsaved.unsaved[0];
  const notify = record.onSettled;
  record.onSettled = () => { notifications.push({ state: record.state, reason: record.reason }); notify(); };
  host.saves[0].reject(new host.context.ResultValidationError('invalid')); await first.finishing;
  assert.equal(record.state, 'rejected'); assert.match(record.reason, /validation/);
  assert.equal(notifications[0].state, 'rejected');
  console.log(JSON.stringify({ scenario: 'LR-2 classification and first notification after Again', notifications }));
}
{
  const callbacks = {};
  let focusAccepted = false;
  const line = { dataset: {}, contains: () => false, replaceChildren() {}, toggleAttribute() {}, querySelector: () => ({ textContent: '' }), addEventListener: (type, cb) => { callbacks.carried = cb; } };
  const context = { disposed: false, leavingTo: null, leaveConfirmed: false, currentSave: null,
    engine: { state: 'running' }, unsavedLine: (list, retrying, leaving) => `${list.length} ${leaving}`,
    input: { addEventListener: (type, cb) => { callbacks.inputFocus = cb; } },
    document: { activeElement: null, addEventListener: (type, cb) => { callbacks.anchor = cb; } },
    location: { href: 'https://example.test/', origin: 'https://example.test', pathname: '/', search: '', assign() {} },
    URL, download() {}, returnFocus() {}, $: selector => selector === '#carried' ? line : { focus: () => { focusAccepted = !line.inert; } },
  };
  const list = new UnsavedResults({ save: async () => {}, exists: async () => false, isPermanent: () => false, onChange: () => {} });
  list.adopt(Object.assign(newSaveRecord(Object.freeze({ id: 'older' })), { state: 'failed' })); context.unsaved = list;
  const start = source.indexOf('  function renderUnsaved()');
  runInNewContext(stripTypeScriptTypes(source.slice(start, source.indexOf('  function returnFocus()', start))), context);
  let held = false;
  callbacks.anchor({ button: 0, target: { closest: () => ({ href: 'https://example.test/progress.html', target: '', hasAttribute: () => false }) }, preventDefault: () => { held = true; } });
  assert.equal(held, true); assert.equal(line.inert, false); assert.equal(focusAccepted, true);
  callbacks.inputFocus(); assert.equal(context.leavingTo, null); assert.equal(line.inert, true);
  console.log(JSON.stringify({ scenario: 'LR-1 running hold operable and input focus cancels', held, focusAccepted, canceled: context.leavingTo === null, inertAfterCancel: line.inert }));
}
{
  const host = factory();
  const first = host.complete('old'); host.saves[0].reject(new Error('quota')); await first.finishing;
  host.node('#retry-save').onclick(); await host.again();
  const original = host.context.$; host.context.$ = selector => selector === '#retry-save' ? null : original(selector);
  let rejection;
  const onUnhandled = error => { rejection = error; }; process.on('unhandledRejection', onUnhandled);
  host.saves[1].resolve(); await tick(); await tick(); process.off('unhandledRejection', onUnhandled);
  assert.match(String(rejection), /hidden/);
  console.log(JSON.stringify({ scenario: 'F3 still present at a36a6e3', rejection: rejection.message }));
}
{
  const notifications = []; let list;
  list = new UnsavedResults({ save: async () => { throw new Error('permanent'); }, exists: async () => false, isPermanent: () => true,
    onChange: () => notifications.push(list.retrying) });
  for (const id of ['bad', 'later']) list.adopt(Object.assign(newSaveRecord(Object.freeze({ id })), { state: 'failed' }));
  await list.retry(); assert.equal(notifications.at(-1), true); assert.equal(list.retrying, false);
  console.log(JSON.stringify({ scenario: 'F4 still present at a36a6e3', lastNotifiedRetrying: notifications.at(-1), finalRetrying: list.retrying }));
}
console.log('Delta assertions passed: LR-1/LR-2 repaired; F3/F4 remain on this exact delta.');
