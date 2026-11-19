import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { TypingEngine } from '../src/engine.ts';
import { parseModelArtifact, predictSentence } from '../src/model.ts';
import { buildHistory, appendHistory } from '../src/profile.ts';
import { UnsavedResults, newSaveRecord, applyOutcome, isFiniteSource, unsavedLine } from '../src/unsaved.ts';
import * as coachUi from '../src/coach-ui.ts';

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
// Migration (F, lease msg_2f1d0dd3484f): the host fakes C's fenced saveSource, which reports a discriminated
// Persistence and never throws for storage faults; success is never recovered from an id lookup. Every save
// (in place or carried) must receive the very same source object and the capture frozen at the first insertion.
const CAPTURE = Object.freeze({ databaseId: 'db', contextId: 'ctx', epochId: 'epoch', capturedAt: '2026-11-18T00:00:00.000Z', purpose: 'practice' });
const savedOutcome = (source: any) => ({ state: 'saved', pendingIds: [], sourceId: source.id, sourceHash: '0'.repeat(64), sourceSaved: true, membershipReady: true });
const failedOutcome = (source: any, capture: unknown, retryable: boolean) => ({ state: 'failed', pendingIds: [source.id], sourceId: source.id, capture, sourceSaved: false, membershipReady: false, retryable });
type SaveCall = { source: any; capture: unknown; succeed(): void; fail(): void; refuse(): void; throws(error: Error): void };
function continuationHost() {
  const nodes = new Map<string, any>();
  const node = (key: string) => { if (!nodes.has(key)) nodes.set(key, { hidden: false, disabled: false, textContent: '', onclick: null, dataset: {}, innerHTML: '', contains: () => false, querySelector: () => null, focus: () => {} }); return nodes.get(key); };
  const completion = node('#completion');
  Object.defineProperty(completion, 'innerHTML', { set(value: string) { this.markup = value; if (!value) for (const id of ['#again', '#export-current', '#retry-save', '#save-state', '#result-actions', '#baseline-result']) nodes.delete(id); } });
  const saves: SaveCall[] = [];
  const downloads: unknown[] = [];
  let restartDone: Promise<void> | undefined;
  const saveSource = (source: any, capture: unknown) => new Promise<any>((resolve, reject) => {
    saves.push({ source, capture, succeed: () => resolve(savedOutcome(source)), fail: () => resolve(failedOutcome(source, capture, true)),
      refuse: () => resolve(failedOutcome(source, capture, false)), throws: reject });
  });
  const context: any = {
    finished: false, timer: 1, before: null, key: null, input: { value: 't', disabled: false, readOnly: false, focus: () => {} },
    clearInterval: () => {}, setInterval: () => 1, performance: { now: () => 30000 }, queueMicrotask,
    engine: null, resultPanel: () => '<result>', mayFocusInput: () => false, esc: (text: string) => text,
    document: { getElementById: (id: string) => node(`#${id}`), querySelector: () => null }, $: node,
    download: (value: unknown) => { downloads.push(value); }, restartGeneration: 0, disposed: false, repeatRequested: false,
    saveSource, newSaveRecord, applyOutcome, isFiniteSource, unsavedLine, coachUi, coach: coachUi.baselineView(null), readyCapture: CAPTURE,
    prepGeneration: 0, prepCompleted: 0, frozen: null, freezeRun: () => (context.frozen = { label: 'General practice', baseline: false, test: null, capture: CAPTURE, pair: null }),
    progressMarkup: () => '', summaryMarkup: () => '', formatProgress: () => {}, failedBaseline: () => [], declareQwerty: () => {},
    todayActivity: () => new Promise(() => {}), PointerEvent: class {}, stage: {}, restarting: false,
    paint: () => ({ state: 'completed' }), composing: false, settings: () => ({}), qwerty: { checked: false }, durationMs: 30000,
    originId: undefined, history: [], historyKey: 'false|30000', mode: 'practice', params: new URLSearchParams(), manualPairs: [],
    parsePracticeChoice: () => ({ kind: 'general', reason: '' }), practiceChoice: null, suggestedRequested: false, pilot: () => false,
    prepAbort: null, shown: null, fellBack: false, admitted: null, lastAdmittedPair: null, changeNote: '',
    prepareCoach: async () => null, finiteRuntime: async () => { throw new Error('a General restart never loads the finite runtime'); }, admittedBlock: () => null,
    practiceKind: null, manualPair: null, showPair: () => {}, choosePrompts: () => [], prompts: [], makeEngine: () => ({ state: 'idle' }), previousPromptText: '',
    previousResponse: '', undoUsed: false, lastPromptKey: '', lastState: '', clearSlot: () => {}, prepare: () => {}, startTimer: () => {},
    refreshCoachSurfaces: () => {}, loadEvidence: () => {}, settingsPending: false, changeSettings: () => {}, currentSave: null,
  };
  context.unsaved = new UnsavedResults({ save: saveSource, onChange: () => {} });
  const code = extract('  function carryUnsaved()', '\n') + '\n' + extract('  // ---- Completed result:', "  input.addEventListener('keydown'")
    + extract("  $('#restart').onclick = async () => {", '  // Saved timing history arrives');
  runInNewContext(`${stripTypeScriptTypes(code)}; globalThis.finishBlock = finish`, context);
  const restart = node('#restart').onclick;
  node('#restart').onclick = (...args: unknown[]) => (restartDone = restart(...args));
  return {
    context, node, saves, downloads,
    complete(id: string) {
      const result = Object.freeze({ id, mode: 'practice', eligibleForProgress: true, settings: Object.freeze({ durationMs: 30000, qwerty: false }) });
      context.finished = false; context.frozen = null;
      context.engine = { snapshot: () => ({ value: 't' }), result: () => result, abort: () => {} };
      return { result, finishing: context.finishBlock() as Promise<void> };
    },
    async again() { node('#again').onclick(); await restartDone; },
    async settingChange() { context.repeatRequested = true; node('#restart').onclick(); await restartDone; }, // changeSettings' completed-state path
    listed: () => context.unsaved.listed.map((entry: any) => entry.source.id),
  };
}

test('ET-1: a failed save before Again stays listed with its immutable payload', async () => {
  const host = continuationHost();
  const { result, finishing } = host.complete('failed-first');
  host.saves[0]!.fail();
  await finishing;
  await host.again();
  assert.equal(host.context.restartGeneration, 1);
  assert.deepEqual(host.listed(), ['failed-first']);
  assert.equal(host.context.unsaved.listed[0].source, result, 'the very same completed payload, never re-derived');
  assert.equal(host.context.unsaved.listed[0].capture, CAPTURE, 'the capture frozen before the first insertion travels with it');
  assert.deepEqual(host.context.unsaved.exportPayload(), [result]);
  // A carried retry re-sends the original source and capture; an unexpected throw stays retryable, not lost.
  const retried = host.context.unsaved.retry();
  assert.equal(host.saves[1]!.source, result); assert.equal(host.saves[1]!.capture, CAPTURE);
  host.saves[1]!.throws(new Error('unexpected'));
  await retried;
  assert.deepEqual(host.listed(), ['failed-first']);
  assert.equal(host.context.unsaved.listed[0].state, 'failed');
});

test('ET-1: a pending save that fails after Again appears then; one that succeeds is dropped quietly', async () => {
  for (const outcome of ['fail', 'succeed'] as const) {
    const host = continuationHost();
    const { finishing } = host.complete(`pending-${outcome}`);
    await host.again();
    assert.equal(host.listed().length, 0, 'pending is not shown');
    assert.equal(host.context.unsaved.unsaved.length, 1, 'but is still tracked');
    if (outcome === 'fail') host.saves[0]!.fail(); else host.saves[0]!.succeed();
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
  const carried = host.context.unsaved.unsaved[0];
  const notified: [string, string][] = [];
  const announce = carried.onSettled;
  carried.onSettled = () => { notified.push([carried.state, carried.reason]); announce(); };
  host.saves[0]!.refuse(); // C's fenced save reports a validation refusal as failed and not retryable
  await finishing;
  assert.equal(notified.length, 1);
  assert.equal(notified[0]![0], 'rejected', 'the one notification already carries the final state');
  assert.match(notified[0]![1], /validation/);
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
    host.saves[0]!.fail();
    await finishing;
    host.node('#retry-save').onclick();
    if (leave === 'again') await host.again();
    else if (leave === 'setting') await host.settingChange();
    else if (leave === 'replacement') { await host.again(); const next = host.complete('replacement-result'); host.saves[2]!.succeed(); await next.finishing; }
    else host.context.disposed = true;
    // From here the old block's controls are gone (Again, setting: lookups return null), replaced by a
    // saved replacement result (hidden retry, a focusable primary action) or retained after disposal.
    let focusAttempts = 0, lookups = 0;
    const replacementDom = leave === 'replacement' || leave === 'dispose';
    host.context.mayFocusInput = () => { focusAttempts++; return true; };
    host.context.$ = (key: string) => { lookups++; return replacementDom ? (key === '#retry-save' ? { hidden: leave === 'replacement' } : { focus: () => { focusAttempts++; } }) : null; };
    host.context.document = { getElementById: () => { lookups++; return replacementDom ? { onclick: null } : null; }, querySelector: () => { lookups++; return replacementDom ? { focus: () => { focusAttempts++; } } : null; } };
    host.saves[1]!.succeed();
    await tick(); await tick();
    assert.equal(lookups, 0, `${leave}: the settled retry looks up nothing of the page`);
    assert.equal(focusAttempts, 0, `${leave}: no focus handoff for a replaced or disposed block`);
    if (leave !== 'dispose') assert.equal(host.context.unsaved.unsaved.length, 0, `${leave}: the retried save still reaches its carried record`);
    else assert.equal(host.context.currentSave.state, 'saved', 'dispose: the retried save still reaches its record');
  }
});

test('ET-1: a result-state setting change carries the unsaved result like Again', async () => {
  const host = continuationHost();
  const { finishing } = host.complete('settings-path');
  host.saves[0]!.fail();
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
    for (const index of order) host.saves[index]!.fail();
    await Promise.all([first.finishing, second.finishing]);
    assert.deepEqual(host.listed(), ['block-1', 'block-2'], `settled ${order}`);
    assert.deepEqual(host.context.unsaved.exportPayload(), [first.result, second.result]);
  }
  const host = continuationHost();
  const first = host.complete('ok'); await host.again();
  const second = host.complete('bad'); await host.again();
  host.saves[1]!.fail(); host.saves[0]!.succeed();
  await Promise.all([first.finishing, second.finishing]);
  assert.deepEqual(host.listed(), ['bad'], 'only the failing entry remains');
});

test('ET-1: an exported result is still carried, marked exported; the in-place retry stays single-flight', async () => {
  const host = continuationHost();
  const { finishing } = host.complete('exported');
  host.saves[0]!.fail();
  await finishing;
  host.node('#export-current').onclick();
  assert.equal(host.downloads.length, 1);
  host.node('#retry-save').onclick(); host.node('#retry-save').onclick();
  assert.equal(host.saves.length, 2, 'two activations, one retry in flight');
  host.saves[1]!.fail();
  await tick();
  await host.again();
  assert.deepEqual(host.listed(), ['exported'], 'exporting never removes an entry; Discard does');
  assert.equal(host.context.unsaved.listed[0].exported, true);
});

// ---------- ET-2: predictions install at most once per sentence, before any edit ----------
// Migration: saved timing now loads through loadEvidence() after first paint (and after each restart),
// never as a step that blocks General; the quiet failure note moved from the old selector's
// #recommendation-reason line to #prediction-state. Once-per-sentence freezing is unchanged.
const artifact = parseModelArtifact(JSON.parse(readFileSync(new URL('../src/generated/model.json', import.meta.url), 'utf8')));
function preparationHost(prompts = [{ id: 'one', text: 'the short path' }, { id: 'two', text: 'a quiet lane' }], loaded: () => Promise<any> = async () => ({ sentences: [], diagnostics: [] })) {
  const engine = new TypingEngine({ id: '00000000-0000-4000-8000-000000000001', prompts, mode: 'practice', durationMs: 30000, inputMode: 'flow-v1', corpusVersion: 'original-v1', qwerty: true });
  const installs: number[] = [];
  const install = engine.setSentencePredictions.bind(engine);
  engine.setSentencePredictions = (index, predictions) => { installs.push(index); install(index, predictions); };
  const nodes = new Map<string, any>();
  const node = (key: string) => { if (!nodes.has(key)) nodes.set(key, { textContent: '' }); return nodes.get(key); };
  const context: any = { engine, evidencePending: true, restartGeneration: 0, disposed: false, restarting: false,
    performance: { now: () => 10 }, qwerty: { checked: true }, history: [], buildHistory, appendHistory, artifact, predictSentence, WeakMap,
    lineageMessage: '', practiceChoice: { kind: 'general', reason: '' }, mode: 'practice', sourceAssessmentId: undefined,
    durationMs: 30000, settings: () => ({}), stage: { dataset: {} }, prompts, frozen: null, blockIdentity: () => 'General practice',
    isFiniteBlock: () => false, $: node, storageNotice: () => {}, calibration: loaded };
  runInNewContext(`${stripTypeScriptTypes(extract('  // Predictions freeze once per sentence.', '  const input = $<HTMLTextAreaElement>'))}; globalThis.prepareStage = prepare`, context);
  context.prepare = context.prepareStage;
  runInNewContext(`${stripTypeScriptTypes(extract('  function loadEvidence() {', '\n  prepare();\n  startTimer();\n  paint();'))}; globalThis.loadStage = loadEvidence`, context);
  context.prepare();
  return { engine, context, installs, node, late: () => context.loadStage() };
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

test('ET-2: calibration that settles after a restart or disposal touches nothing of the new block', async () => {
  for (const leave of ['restart', 'dispose'] as const) {
    let release!: (value: unknown) => void;
    const host = preparationHost(undefined, () => new Promise(resolve => { release = resolve; }));
    host.late();
    if (leave === 'restart') { host.context.restartGeneration++; host.context.history = ['kept']; } else host.context.disposed = true;
    release({ sentences: [{ promptId: 'late' }], diagnostics: [] });
    await tick(); await tick();
    assert.deepEqual(host.installs, [0], `${leave}: no new predictions`);
    assert.equal(host.context.evidencePending, true, `${leave}: the stale load is ignored`);
    if (leave === 'restart') assert.deepEqual(host.context.history, ['kept']);
  }
});

test('ET-2: a rejected optional calibration is handled quietly and leaves General practice untouched', async () => {
  const host = preparationHost(undefined, () => Promise.reject(new Error('history unreadable')));
  host.late();
  await tick(); await tick();
  assert.equal(host.context.evidencePending, false);
  assert.match(host.node('#prediction-state').textContent, /practice is unaffected/);
  assert.equal(host.engine.state, 'idle');
  assert.deepEqual(host.installs, [0]);
});

test('ET-2: suggested blocks and an undeclared keyboard skip optional calibration entirely', () => {
  for (const scenario of ['finite', 'qwerty off'] as const) {
    let reads = 0;
    const host = preparationHost(undefined, async () => { reads++; return { sentences: [], diagnostics: [] }; });
    if (scenario === 'finite') host.context.isFiniteBlock = () => true; else host.context.qwerty.checked = false;
    host.late();
    assert.equal(reads, 0, scenario);
    assert.equal(host.context.evidencePending, false, scenario);
  }
});
