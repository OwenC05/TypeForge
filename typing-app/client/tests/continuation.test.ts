import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { TypingEngine } from '../src/engine.ts';
import { parseModelArtifact, predictSentence } from '../src/model.ts';
import { buildHistory } from '../src/profile.ts';
import { UnsavedResults } from '../src/unsaved.ts';

// Review ET-1/ET-2 regressions against the actual app source (adapted from the independent
// reviewer's probe, e2417c3 early-technical-evidence/probe.mjs). Host fakes only; no browser.
const source = readFileSync(new URL('../src/app.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const extract = (start: string, end: string) => {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `ordered boundaries: ${start}`);
  return source.slice(a, b);
};
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

// ---------- ET-1: continuation never loses an unsaved completed result ----------
function continuationHost() {
  const nodes = new Map<string, any>();
  const node = (key: string) => { if (!nodes.has(key)) nodes.set(key, { hidden: false, disabled: false, textContent: '', onclick: null, dataset: {} }); return nodes.get(key); };
  const completion = node('#completion');
  Object.defineProperty(completion, 'innerHTML', { set(value: string) { this.markup = value; if (!value) for (const id of ['#again', '#export-current', '#retry-save', '#save-state']) nodes.delete(id); } });
  const saves: { result: any; resolve: () => void; reject: (error: Error) => void }[] = [];
  const downloads: unknown[] = [];
  let restartDone: Promise<void> | undefined;
  const context: any = {
    finished: false, timer: 1, before: null, key: null, input: { value: 't', disabled: false, readOnly: false, focus: () => {} },
    clearInterval: () => {}, setInterval: () => 1, performance: { now: () => 30000 },
    engine: null, resultPanel: () => '<result>', mayFocusInput: () => false,
    document: { getElementById: (id: string) => node(`#${id}`), querySelector: () => null }, $: node,
    download: (value: unknown) => { downloads.push(value); }, restartGeneration: 0, disposed: false, repeatRequested: false,
    saveResult: (result: any) => new Promise<void>((resolve, reject) => { saves.push({ result, resolve, reject }); }),
    refreshToday: () => {}, ResultValidationError: class extends Error {}, PointerEvent: class {}, stage: {}, restarting: false,
    paint: () => ({ state: 'completed' }), composing: false, settings: () => ({}), qwerty: { checked: false }, durationMs: 30000,
    calibration: async () => ({ sentences: [], diagnostics: [] }), originId: undefined, history: [], evidencePending: false, mode: 'practice',
    buildHistory: () => ({}), selectPracticeFocus: () => null, practicePrompts: [], artifact: null, parsePracticeChoice: () => ({ kind: 'general' }),
    params: new URLSearchParams(), manualPairs: [], recommendedFocus: null, practiceChoice: null, recommendationReason: () => '', focus: null,
    practiceKind: null, manualPair: null, choosePrompts: () => [], prompts: [], makeEngine: () => ({ state: 'idle' }), previousPromptText: '',
    previousResponse: '', undoUsed: false, lastPromptKey: '', lastState: '', slotLevel: 0, hintMark: '', storageNotice: () => {}, prepare: () => {},
    settingsPending: false, currentSave: null,
  };
  context.unsaved = new UnsavedResults({ save: async () => {}, exists: async () => false, isPermanent: () => false, onChange: () => {} });
  const code = extract('  function carryUnsaved()', '\n') + '\n' + extract('  function afterResultRendered()', "  input.addEventListener('keydown'")
    + extract("  $('#restart').onclick = async () => {", '  prepare();\n  const initialEngine');
  runInNewContext(`${stripTypeScriptTypes(code)}; globalThis.finishBlock = finish`, context);
  const restart = node('#restart').onclick;
  node('#restart').onclick = (...args: unknown[]) => (restartDone = restart(...args));
  return {
    context, node, saves, downloads,
    complete(id: string) { const result = Object.freeze({ id }); context.finished = false; context.engine = { snapshot: () => ({ value: 't' }), result: () => result, abort: () => {} }; return { result, finishing: context.finishBlock() as Promise<void> }; },
    async again() { node('#again').onclick(); await restartDone; },
    async settingChange() { context.repeatRequested = true; node('#restart').onclick(); await restartDone; }, // changeSettings' completed-state path
    listed: () => context.unsaved.listed.map((entry: any) => entry.result.id),
  };
}

test('ET-1: a failed save before Again stays listed with its immutable payload', async () => {
  const host = continuationHost();
  const { result, finishing } = host.complete('failed-first');
  host.saves[0]!.reject(new Error('storage unavailable'));
  await finishing;
  await host.again();
  assert.equal(host.context.restartGeneration, 1);
  assert.deepEqual(host.listed(), ['failed-first']);
  assert.equal(host.context.unsaved.listed[0].result, result, 'the very same completed payload, never re-derived');
  assert.deepEqual(host.context.unsaved.exportPayload(), [result]);
});

test('ET-1: a pending save that fails after Again appears then; one that succeeds is dropped quietly', async () => {
  for (const outcome of ['fail', 'succeed'] as const) {
    const host = continuationHost();
    const { finishing } = host.complete(`pending-${outcome}`);
    await host.again();
    assert.equal(host.listed().length, 0, 'pending is not shown');
    assert.equal(host.context.unsaved.unsaved.length, 1, 'but is still tracked');
    if (outcome === 'fail') host.saves[0]!.reject(new Error('storage unavailable')); else host.saves[0]!.resolve();
    await finishing;
    assert.deepEqual(host.listed(), outcome === 'fail' ? ['pending-fail'] : []);
    assert.equal(host.context.unsaved.unsaved.length, outcome === 'fail' ? 1 : 0);
    assert.equal(host.node('#save-state').textContent, '', 'the stale block UI is not written (generation guard kept)');
  }
});

test('ET-1 (LR-2): a validation refusal that arrives after Again lists as rejected at once, without retry', async () => {
  const host = continuationHost();
  const { finishing } = host.complete('invalid-late');
  await host.again();
  host.saves[0]!.reject(new host.context.ResultValidationError('invalid result'));
  await finishing;
  const [entry] = host.context.unsaved.listed;
  assert.equal(entry.state, 'rejected');
  assert.match(entry.reason, /validation/);
  await host.context.unsaved.retry();
  assert.equal(host.saves.length, 1, 'a refused entry is never retried');
  assert.equal(host.node('#save-state').textContent, '', 'the stale block UI is not written');
});

test('ET-1: a stale in-place retry settling after Again, a setting, a replacement result or disposal touches nothing of the old block', async () => {
  for (const leave of ['again', 'setting', 'replacement', 'dispose'] as const) {
    const host = continuationHost();
    const { finishing } = host.complete(`stale-${leave}`);
    host.saves[0]!.reject(new Error('storage unavailable'));
    await finishing;
    host.node('#retry-save').onclick();
    if (leave === 'again') await host.again();
    else if (leave === 'setting') await host.settingChange();
    else if (leave === 'replacement') { await host.again(); const next = host.complete('replacement-result'); host.saves[2]!.resolve(); await next.finishing; }
    else host.context.disposed = true;
    // From here the old block's controls are gone, as in the page: lookups return null.
    let focusAttempts = 0;
    host.context.mayFocusInput = () => { focusAttempts++; return true; };
    host.context.$ = () => null;
    host.context.document = { getElementById: () => null, querySelector: () => null };
    host.saves[1]!.resolve();
    await tick(); await tick();
    assert.equal(focusAttempts, 0, `${leave}: afterResultRendered is not called for a replaced or disposed block`);
    if (leave !== 'dispose') assert.equal(host.context.unsaved.unsaved.length, 0, `${leave}: the retried save still reaches its carried record`);
    else assert.equal(host.context.currentSave.state, 'saved', 'dispose: the retried save still reaches its record');
  }
});

test('ET-1: a result-state setting change carries the unsaved result like Again', async () => {
  const host = continuationHost();
  const { finishing } = host.complete('settings-path');
  host.saves[0]!.reject(new Error('storage unavailable'));
  await finishing;
  await host.settingChange();
  assert.deepEqual(host.listed(), ['settings-path']);
});

test('ET-1: two consecutive unsaved blocks are both kept, in order, and overlapping saves settle in either order', async () => {
  for (const order of [[0, 1], [1, 0]]) {
    const host = continuationHost();
    const first = host.complete('block-1');
    await host.again();
    const second = host.complete('block-2');
    await host.again();
    for (const index of order) host.saves[index]!.reject(new Error('storage unavailable'));
    await Promise.all([first.finishing, second.finishing]);
    assert.deepEqual(host.listed(), ['block-1', 'block-2'], `settled ${order}`);
    assert.deepEqual(host.context.unsaved.exportPayload(), [first.result, second.result]);
  }
  const host = continuationHost();
  const first = host.complete('ok'); await host.again();
  const second = host.complete('bad'); await host.again();
  host.saves[1]!.reject(new Error('storage unavailable')); host.saves[0]!.resolve();
  await Promise.all([first.finishing, second.finishing]);
  assert.deepEqual(host.listed(), ['bad'], 'only the failing entry remains');
});

test('ET-1: an exported result is still carried, marked exported; the in-place retry stays single-flight', async () => {
  const host = continuationHost();
  const { finishing } = host.complete('exported');
  host.saves[0]!.reject(new Error('storage unavailable'));
  await finishing;
  host.node('#export-current').onclick();
  assert.equal(host.downloads.length, 1);
  host.node('#retry-save').onclick(); host.node('#retry-save').onclick();
  assert.equal(host.saves.length, 2, 'two activations, one retry in flight');
  host.saves[1]!.reject(new Error('still unavailable'));
  await tick();
  await host.again();
  assert.deepEqual(host.listed(), ['exported'], 'exporting never removes an entry; Discard does');
  assert.equal(host.context.unsaved.listed[0].exported, true);
});

// ---------- ET-2: predictions install at most once per sentence, before any edit ----------
const artifact = parseModelArtifact(JSON.parse(readFileSync(new URL('../src/generated/model.json', import.meta.url), 'utf8')));
function preparationHost(prompts = [{ id: 'one', text: 'the short path' }, { id: 'two', text: 'a quiet lane' }], loaded: Promise<any> = Promise.resolve({ sentences: [], diagnostics: [] })) {
  const engine = new TypingEngine({ id: '00000000-0000-4000-8000-000000000001', prompts, mode: 'practice', durationMs: 30000, inputMode: 'flow-v1', corpusVersion: 'original-v1', qwerty: true });
  const installs: number[] = [];
  const install = engine.setSentencePredictions.bind(engine);
  engine.setSentencePredictions = (index, predictions) => { installs.push(index); install(index, predictions); };
  const nodes = new Map<string, any>();
  const node = (key: string) => { if (!nodes.has(key)) nodes.set(key, { textContent: '' }); return nodes.get(key); };
  const context: any = { engine, initialEngine: engine, evidencePending: true, restartGeneration: 0, disposed: false, restarting: false,
    performance: { now: () => 10 }, qwerty: { checked: true }, history: [], buildHistory, artifact, predictSentence, WeakMap,
    lineageMessage: '', practiceChoice: { kind: 'general', reason: '' }, mode: 'practice', focus: null, sourceAssessmentId: undefined,
    durationMs: 30000, declaredQwerty: true, settings: () => ({}), stage: { dataset: {} }, prompts, suggestedItem: null, params: new URLSearchParams('qwerty=1'),
    $: node, storageNotice: () => {}, recommendationReason: () => 'reason', selectPracticeFocus: () => null, practicePrompts: [],
    parsePracticeChoice: () => ({ kind: 'general', reason: '' }), manualPairs: [], calibration: () => loaded };
  runInNewContext(`${stripTypeScriptTypes(extract('  // Predictions freeze once per sentence.', '  const input = $<HTMLTextAreaElement>'))}; globalThis.prepareStage = prepare`, context);
  context.prepare = context.prepareStage;
  context.prepare();
  return { engine, context, installs, node, late: () => runInNewContext(stripTypeScriptTypes(extract('  if (evidencePending) {', '  const configurationWarning =')), context) };
}

test('ET-2: late calibration never re-freezes predictions (idle, no-op edit, accepted input, passage advance)', async () => {
  for (const scenario of ['idle', 'no-op edit', 'accepted insertion', 'passage advance']) {
    const host = preparationHost();
    assert.deepEqual(host.installs, [0], `${scenario}: installed once before any edit`);
    if (scenario === 'no-op edit') host.engine.edit({ start: 0, end: 0, text: '', tracked: true }, 10);
    if (scenario === 'accepted insertion') host.engine.edit({ start: 0, end: 0, text: 't', tracked: true, pressTime: 10 }, 10);
    if (scenario === 'passage advance') {
      const typed = 'the short path ';
      for (let index = 0; index < typed.length; index++) host.engine.edit({ start: index, end: index, text: typed[index]!, tracked: true, pressTime: 10 + index }, 10 + index);
      assert.equal(host.engine.snapshot(40).sentenceIndex, 1);
      host.context.prepare(40); // what acceptInput does after a commit
    }
    host.late();
    await tick(); await tick();
    assert.deepEqual(host.installs, scenario === 'passage advance' ? [0, 1] : [0], `${scenario}: at most once per sentence`);
    assert.equal(host.context.evidencePending, false);
    assert.ok(host.node('#prediction-state').textContent.length > 0, `${scenario}: informational refresh still runs`);
  }
});

test('ET-2: a rejected optional calibration is handled quietly and leaves General practice untouched', async () => {
  const host = preparationHost(undefined, Promise.reject(new Error('history unreadable')));
  host.late();
  await tick(); await tick();
  assert.equal(host.context.evidencePending, false);
  assert.match(host.node('#recommendation-reason').textContent, /general practice is unaffected/);
  assert.equal(host.engine.state, 'idle');
  assert.deepEqual(host.installs, [0]);
});
