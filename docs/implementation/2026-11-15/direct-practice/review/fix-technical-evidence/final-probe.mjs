import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { TypingEngine } from '../../../../../../typing-app/client/src/engine.ts';
import { parseModelArtifact, predictSentence } from '../../../../../../typing-app/client/src/model.ts';
import { buildHistory } from '../../../../../../typing-app/client/src/profile.ts';

const revision = '91ca6bc3a232ed8a26a93bc59c71029ff27346e7';
const show = spec => execFileSync('git', ['show', spec], { encoding: 'utf8', windowsHide: true }).replace(/\r\n/g, '\n');
const source = show(`${revision}:typing-app/client/src/app.ts`);
const tests = show(`${revision}:typing-app/client/tests/continuation.test.ts`);
const helperSource = show(`${revision}:typing-app/client/src/unsaved.ts`);
const { UnsavedResults, newSaveRecord } = runInNewContext(stripTypeScriptTypes(helperSource).replace(/^export /gm, '') + '; ({UnsavedResults,newSaveRecord})');
for (const name of ['engine.ts', 'model.ts', 'profile.ts', 'generated/model.json']) {
  assert.equal(show(`${revision}:typing-app/client/src/${name}`), show(`HEAD:typing-app/client/src/${name}`), `local real dependency must match ${revision}: ${name}`);
}
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const factory = runInNewContext(stripTypeScriptTypes(tests.slice(tests.indexOf('const extract ='), tests.indexOf("\ntest('ET-1:")) + '; continuationHost'), {
  source, assert, runInNewContext, stripTypeScriptTypes, UnsavedResults, setTimeout, URLSearchParams,
});
console.log(`Actual committed app/helper at ${revision}; VM host + unchanged real engine; no browser.`);

for (const leave of ['again', 'setting', 'replacement', 'dispose']) for (const outcome of ['saved', 'failed', 'rejected']) {
  const host = factory();
  const first = host.complete(`stale-${leave}-${outcome}`);
  const record = host.context.currentSave;
  host.saves[0].reject(new Error('quota')); await first.finishing;
  host.node('#retry-save').onclick();
  if (leave === 'again') await host.again();
  else if (leave === 'setting') await host.settingChange();
  else if (leave === 'replacement') {
    await host.again(); const next = host.complete('replacement'); host.saves[2].resolve(); await next.finishing;
    host.node('#retry-save').hidden = true; // saved replacement DOM, not absent old controls
  } else host.context.disposed = true;
  let queries = 0, focusAttempts = 0;
  const original = host.context.$;
  host.context.$ = selector => { queries++; return leave === 'replacement' ? original(selector) : null; };
  host.context.mayFocusInput = () => { focusAttempts++; return true; };
  let rejection;
  const unhandled = error => { rejection = error; }; process.on('unhandledRejection', unhandled);
  if (outcome === 'saved') host.saves[1].resolve();
  else host.saves[1].reject(outcome === 'rejected' ? new host.context.ResultValidationError('invalid') : new Error('quota'));
  await tick(); await tick(); process.off('unhandledRejection', unhandled);
  assert.equal(queries, 0); assert.equal(focusAttempts, 0); assert.equal(rejection, undefined);
  assert.equal(record.state, outcome);
  if (outcome === 'rejected') assert.match(record.reason, /validation/);
  if (leave !== 'dispose') assert.equal(host.context.unsaved.unsaved.length, outcome === 'saved' ? 0 : 1);
  console.log(JSON.stringify({ F3: leave, outcome, queries, focusAttempts, unhandled: false, record: record.state }));
}

{
  const calls = [], notifications = []; let list;
  list = new UnsavedResults({ save: async result => { calls.push(result.id); if (result.id === 'bad') throw new Error('permanent'); }, exists: async () => false,
    isPermanent: () => true, onChange: () => notifications.push({ retrying: list.retrying, states: Array.from(list.listed, x => [x.result.id, x.state, x.saving]) }) });
  for (const id of ['bad', 'next', 'last']) list.adopt(Object.assign(newSaveRecord(Object.freeze({ id })), { state: 'failed' }));
  await list.retry();
  assert.deepEqual(calls, ['bad']); assert.equal(notifications.at(-1).retrying, false);
  assert.deepEqual(notifications.at(-1).states, [['bad', 'rejected', false], ['next', 'failed', false], ['last', 'failed', false]]);
  const finalNotification = notifications.at(-1);
  await list.retry(); assert.deepEqual(calls, ['bad', 'next', 'last']); assert.equal(list.listed.length, 1);
  console.log(JSON.stringify({ F4: 'permanent head of three-entry queue', finalNotification, subsequentCalls: calls }));
}

{
  const host = factory(); const first = host.complete('late-rejection'); await host.again();
  const record = host.context.unsaved.unsaved[0], notifications = [], original = record.onSettled;
  record.onSettled = () => { notifications.push([record.state, record.reason]); original(); };
  host.saves[0].reject(new host.context.ResultValidationError('invalid')); await first.finishing;
  assert.equal(notifications[0][0], 'rejected'); assert.match(notifications[0][1], /validation/);
  console.log(JSON.stringify({ F2: 'first notification after Again', notifications }));
}

{
  const callbacks = {}; let accepted = false;
  const line = { dataset: {}, contains: () => false, replaceChildren() {}, toggleAttribute() {}, querySelector: () => ({ textContent: '' }), addEventListener: (type, cb) => { callbacks.carried = cb; } };
  const context = { disposed: false, leavingTo: null, leaveConfirmed: false, currentSave: null, engine: { state: 'running' },
    unsavedLine: (list, retrying, leaving) => `${list.length} ${leaving}`, input: { addEventListener: (type, cb) => { callbacks.focus = cb; } },
    document: { activeElement: null, addEventListener: (type, cb) => { callbacks.anchor = cb; } },
    location: { href: 'https://example.test/', origin: 'https://example.test', pathname: '/', search: '', assign() {} }, URL, download() {}, returnFocus() {},
    $: selector => selector === '#carried' ? line : { focus: () => { accepted = !line.inert; } },
  };
  const list = new UnsavedResults({ save: async () => {}, exists: async () => false, isPermanent: () => false, onChange: () => {} });
  list.adopt(Object.assign(newSaveRecord(Object.freeze({ id: 'older' })), { state: 'failed' })); context.unsaved = list;
  const start = source.indexOf('  function renderUnsaved()');
  runInNewContext(stripTypeScriptTypes(source.slice(start, source.indexOf('  function returnFocus()', start))), context);
  let held = false;
  callbacks.anchor({ button: 0, target: { closest: () => ({ href: 'https://example.test/progress.html', target: '', hasAttribute: () => false }) }, preventDefault: () => { held = true; } });
  assert.equal(held, true); assert.equal(accepted, true); assert.equal(line.inert, false);
  callbacks.focus(); assert.equal(context.leavingTo, null); assert.equal(line.inert, true);
  console.log(JSON.stringify({ F1: 'running held departure', held, exportFocusAccepted: accepted, canceledOnInputFocus: true }));
}

{
  const artifact = parseModelArtifact(JSON.parse(show(`${revision}:typing-app/client/src/generated/model.json`)));
  const extract = (start, end) => { const a = source.indexOf(start), b = source.indexOf(end, a + start.length); assert.ok(a >= 0 && b > a); return source.slice(a, b); };
  const code = tests.slice(tests.indexOf('function preparationHost('), tests.indexOf("\ntest('ET-2:"));
  const prepareFactory = runInNewContext(stripTypeScriptTypes(code + '; preparationHost'), { TypingEngine, artifact, predictSentence, buildHistory, runInNewContext, stripTypeScriptTypes, WeakMap, URLSearchParams, extract });
  for (const scenario of ['idle', 'no-op', 'input', 'next', 'restart', 'optional rejection']) {
    const host = prepareFactory(undefined, scenario === 'optional rejection' ? Promise.reject(new Error('unreadable')) : undefined);
    if (scenario === 'no-op') host.engine.edit({ start: 0, end: 0, text: '', tracked: true }, 10);
    if (scenario === 'input') host.engine.edit({ start: 0, end: 0, text: 't', tracked: true, pressTime: 10 }, 10);
    if (scenario === 'next') {
      const typed = 'the short path ';
      for (let i = 0; i < typed.length; i++) host.engine.edit({ start: i, end: i, text: typed[i], tracked: true, pressTime: 10 + i }, 10 + i);
      host.context.prepare(40);
    }
    let replacementInstalls = 0;
    if (scenario === 'restart') {
      const engine = new TypingEngine({ id: '00000000-0000-4000-8000-000000000002', prompts: [{ id: 'fresh', text: 'the short path' }], mode: 'practice', durationMs: 30000, inputMode: 'flow-v1', corpusVersion: 'original-v1', qwerty: true });
      const install = engine.setSentencePredictions.bind(engine);
      engine.setSentencePredictions = (index, values) => { replacementInstalls++; install(index, values); };
      host.context.engine = engine; host.context.restartGeneration++; host.context.prepare(); host.context.prepare();
    }
    host.late(); await tick(); await tick();
    assert.deepEqual(Array.from(host.installs), scenario === 'next' ? [0, 1] : [0]);
    if (scenario === 'restart') assert.equal(replacementInstalls, 1);
    console.log(JSON.stringify({ ET2: scenario, installs: Array.from(host.installs), replacementInstalls }));
  }
}
console.log('PASS: 12 stale retry outcomes, final queue notification/retry, F1/F2, and six ET-2 scenarios at exact required source.');
