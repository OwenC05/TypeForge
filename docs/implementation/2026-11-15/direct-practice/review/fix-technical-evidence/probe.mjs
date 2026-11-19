import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { UnsavedResults, newSaveRecord } from '../../../../../../typing-app/client/src/unsaved.ts';
import { TypingEngine } from '../../../../../../typing-app/client/src/engine.ts';
import { parseModelArtifact, predictSentence } from '../../../../../../typing-app/client/src/model.ts';
import { buildHistory } from '../../../../../../typing-app/client/src/profile.ts';

const source = readFileSync(new URL('../../../../../../typing-app/client/src/app.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const tests = readFileSync(new URL('../../../../../../typing-app/client/tests/continuation.test.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const harness = tests.slice(tests.indexOf('const extract ='), tests.indexOf("\ntest('ET-1:"));
const factory = runInNewContext(stripTypeScriptTypes(harness + '; continuationHost'), {
  source, assert, runInNewContext, stripTypeScriptTypes, UnsavedResults, setTimeout, URLSearchParams,
});
console.log('Frozen source handlers + existing host fake; no browser execution.');

for (const action of ['again', 'settingChange', 'dispose', 'replacement']) {
  const host = factory();
  const first = host.complete('old');
  host.saves[0].reject(new Error('quota')); await first.finishing;
  host.node('#retry-save').onclick();
  let focusCalls = 0;
  host.context.mayFocusInput = () => true;
  host.context.document.querySelector = () => ({ focus: () => focusCalls++ });
  if (action === 'again' || action === 'settingChange' || action === 'replacement') await host.again();
  if (action === 'replacement') {
    const next = host.complete('replacement');
    host.saves[2].resolve(); await next.finishing;
    host.node('#retry-save').hidden = true; // saved replacement DOM state; host's node factory is not a DOM parser.
    focusCalls = 0;
  }
  let disposedQueries = 0;
  if (action === 'dispose') {
    host.context.disposed = true; host.context.restartGeneration++;
    const original = host.context.$;
    host.context.$ = selector => { if (selector === '#retry-save') disposedQueries++; return original(selector); };
  }
  if (action === 'again' || action === 'settingChange') {
    const original = host.context.$;
    host.context.$ = selector => selector === '#retry-save' ? null : original(selector);
  }
  let rejection = null;
  const onUnhandled = error => { rejection = error; };
  process.on('unhandledRejection', onUnhandled);
  host.saves[1].resolve(); await tick(); await tick();
  process.off('unhandledRejection', onUnhandled);
  if (action === 'again' || action === 'settingChange') assert.match(String(rejection), /hidden/);
  else if (action === 'replacement') assert.equal(focusCalls, 1, 'stale retry called actual afterResultRendered against saved replacement DOM fixture');
  else { assert.equal(disposedQueries, 1); assert.equal(focusCalls, 0); }
  console.log(JSON.stringify({ scenario: `delayed retry then ${action}`, unhandled: rejection?.message ?? null, focusCalls, disposedQueries }));
}

{
  const host = factory();
  const first = host.complete('permanent-after-again'); await host.again();
  host.saves[0].reject(new host.context.ResultValidationError('invalid')); await first.finishing;
  assert.equal(host.context.unsaved.listed[0].state, 'failed');
  console.log(JSON.stringify({ scenario: 'permanent rejection after Again', actual: host.context.unsaved.listed[0].state, expected: 'rejected' }));
}

// Execute actual recovery rendering, anchor and action callbacks with an inert-aware focus fake.
{
  const callbacks = {}, nodes = new Map();
  let focusAccepted = false;
  const line = { dataset: {}, contains: () => false, replaceChildren() {}, querySelector: () => ({ textContent: '' }), addEventListener: (type, cb) => { callbacks.carried = cb; } };
  const context = { disposed: false, leavingTo: null, leaveConfirmed: false, currentSave: null,
    engine: { state: 'running' }, unsavedLine: (list, retrying, leaving) => `${list.length} ${leaving}`,
    document: { activeElement: null, addEventListener: (type, cb) => { callbacks.anchor = cb; } },
    location: { href: 'https://example.test/', origin: 'https://example.test', pathname: '/', search: '', assign() {} },
    URL, download() {}, returnFocus() {},
    $: selector => selector === '#carried' ? line : { focus: () => { focusAccepted = !line.inert; } },
  };
  const list = new UnsavedResults({ save: async () => {}, exists: async () => false, isPermanent: () => false, onChange: () => {} });
  const entry = Object.assign(newSaveRecord(Object.freeze({ id: 'older' })), { state: 'failed' }); list.adopt(entry); context.unsaved = list;
  const start = source.indexOf('  function renderUnsaved()');
  const end = source.indexOf('  function returnFocus()', start);
  runInNewContext(stripTypeScriptTypes(source.slice(start, end)), context);
  let held = false;
  const link = { href: 'https://example.test/progress.html', target: '', hasAttribute: () => false };
  callbacks.anchor({ button: 0, target: { closest: () => link }, preventDefault: () => { held = true; } });
  assert.equal(held, true); assert.equal(line.inert, true); assert.equal(focusAccepted, false);
  console.log(JSON.stringify({ scenario: 'navigation with carried recovery while running', held, inert: line.inert, focusAccepted }));
}

{
  const notifications = [];
  let list;
  list = new UnsavedResults({ save: async () => { throw new Error('permanent'); }, exists: async () => false,
    isPermanent: () => true, onChange: () => notifications.push({ retrying: list.retrying, states: list.listed.map(x => x.state) }) });
  for (const id of ['bad', 'later']) list.adopt(Object.assign(newSaveRecord(Object.freeze({ id })), { state: 'failed' }));
  await list.retry();
  assert.equal(list.retrying, false); assert.equal(notifications.at(-1).retrying, true);
  console.log(JSON.stringify({ scenario: 'permanent refusal at head of multi-entry retry', lastNotification: notifications.at(-1), actualRetrying: list.retrying }));
}
console.log('All defect-characterization assertions passed; this is not a product pass.');

// Same prepare closure and WeakMap, two real engines: replacement is independently prepared once.
{
  const artifact = parseModelArtifact(JSON.parse(readFileSync(new URL('../../../../../../typing-app/client/src/generated/model.json', import.meta.url), 'utf8')));
  const extract = (start, end) => { const a = source.indexOf(start), b = source.indexOf(end, a + start.length); assert.ok(a >= 0 && b > a); return source.slice(a, b); };
  const factoryCode = tests.slice(tests.indexOf('function preparationHost('), tests.indexOf("\ntest('ET-2:"));
  const preparationFactory = runInNewContext(stripTypeScriptTypes(factoryCode + '; preparationHost'), { TypingEngine, artifact, predictSentence, buildHistory, readFileSync, runInNewContext, stripTypeScriptTypes, WeakMap, URLSearchParams, extract });
  const first = preparationFactory();
  const replacement = new TypingEngine({ id: '00000000-0000-4000-8000-000000000002', prompts: [{ id: 'fresh', text: 'the short path' }], mode: 'practice', durationMs: 30000, inputMode: 'flow-v1', corpusVersion: 'original-v1', qwerty: true });
  const installs = [];
  const install = replacement.setSentencePredictions.bind(replacement);
  replacement.setSentencePredictions = (index, predictions) => { installs.push(index); install(index, predictions); };
  first.context.engine = replacement;
  first.context.restartGeneration++;
  first.context.prepare(); first.context.prepare();
  assert.deepEqual(Array.from(first.installs), [0]);
  assert.deepEqual(installs, [0]);
  first.late(); await tick(); await tick();
  assert.deepEqual(installs, [0], 'old optional callback cannot reprepare replacement');
  console.log(JSON.stringify({ scenario: 'ET-2 same prepare closure across replacement engine', originalInstalls: first.installs, replacementInstalls: installs }));
}
