import test from 'node:test';
import assert from 'node:assert/strict';
import { createFiniteAdapter } from '../src/finite-practice.ts';
import { validateFinitePracticeResult } from '../src/finite-practice-result.ts';
import { CONFIG_ID, resolveCertifiedPlan } from '../src/coach-plan.ts';
import type { FiniteAdapter, FinitePracticeResult, PracticeSnapshot, SavedSource } from '../src/coach-types.ts';
import { MAX_ATTEMPTS, MAX_RESPONSE_LENGTH, TypingEngine, type SessionResult } from '../src/engine.ts';
import { validateResult } from '../src/storage.ts';
import { selectHistory } from '../src/profile.ts';
import { pairPositions } from '../src/model.ts';

const id = '00000000-0000-4000-8000-000000000001';
const completedAt = '2026-11-18T12:00:00.000Z';
function snapshot(pair = 'he'): PracticeSnapshot {
  const plan = resolveCertifiedPlan(pair)!;
  const authority = { databaseId: 'synthetic-db', contextId: 'synthetic-context', epochId: 'synthetic-epoch', revision: 0 };
  const metadata = { schemaId: 'typeforge-coach-metadata-v3' as const, databaseId: authority.databaseId,
    defaultContextId: authority.contextId, activeEpochId: authority.epochId, legacyEpochId: 'legacy',
    legacyCutoffCompletedAt: completedAt, sourceRevision: 0 };
  const range = { complete: true as const, stop: 'exhausted' as const, orderedSourceIds: [], authority };
  const contrast = { targetCount: 20, referenceCount: 80, targetLogSum: 100, referenceLogSum: 300, sourceRuns: 4 };
  // Synthetic already-admitted input to the engine seam; this is not a storage/admission proof test.
  return { schemaId: 'typeforge-practice-snapshot-v2', policyId: 'clean-pair-contrast-v1-r2-enabled', configId: CONFIG_ID,
    now: completedAt, generation: 0, capture: { ...authority, capturedAt: completedAt, purpose: 'ordinary' },
    proof: { authority, admittedAt: completedAt, configId: CONFIG_ID, method: 'all-writer-revision', selection: {
      metadata, now: completedAt, sourceBindings: [], participationRange: range, summaryRange: range, coachRange: range } },
    witnesses: [], sources: [], focus: { ...contrast, pair, promptContexts: 4, wordContexts: 3,
      halves: [contrast, contrast], certificateId: plan.certificateId }, plan, actualExposure: null };
}
function key(adapter: FiniteAdapter, text: string, now: number, extra = {}) {
  const start = adapter.tick(now).engine.value.length;
  return adapter.edit({ start, end: start, text, pressTime: now, ...extra }, now);
}
function finish(input = snapshot(), options: { step?: number; finalAt?: number;
  variant?: 'edited' | 'incorrect' | 'repeat' | 'interrupted' | 'invalid-input' | 'missing-timing' | 'malformed-timing' } = {}) {
  const adapter = createFiniteAdapter({ id, snapshot: input });
  let now = 100;
  const step = options.step ?? 1;
  for (const [sentenceIndex, prompt] of input.plan.prompts.entries()) {
    assert.deepEqual(adapter.tick(now).engine.prompt, prompt);
    assert.deepEqual(adapter.tick(now).next, input.plan.prompts[sentenceIndex + 1] ?? null);
    for (const [index, char] of [...prompt.text].entries()) {
      if (sentenceIndex === 0 && index === 0 && options.variant === 'edited') {
        key(adapter, 'x', now); now += step;
        adapter.edit({ start: 0, end: 1, text: '' }, now); now += step;
      }
      const extra = sentenceIndex === 0 && index === 0 ? {
        repeat: options.variant === 'repeat', tracked: options.variant !== 'invalid-input',
        ...(options.variant === 'missing-timing' ? { pressTime: undefined } : {}),
        ...(options.variant === 'malformed-timing' ? { pressTime: -1 } : {}),
      } : {};
      key(adapter, sentenceIndex === 0 && index === 0 && options.variant === 'incorrect' ? 'x' : char, now, extra);
      if (sentenceIndex === 0 && index === 0 && options.variant === 'interrupted') adapter.interrupt(now);
      now += step;
    }
    const last = sentenceIndex === input.plan.prompts.length - 1;
    key(adapter, ' ', last && options.finalAt !== undefined ? options.finalAt : now);
    now = last && options.finalAt !== undefined ? options.finalAt : now + step;
  }
  return { adapter, now, source: adapter.result(completedAt) };
}
function finite(source: SavedSource | null): FinitePracticeResult {
  assert.ok(source && 'schemaId' in source);
  return source;
}

for (const [pair, characters] of [['he', 501], ['in', 491], ['le', 502], ['th', 480]] as const) {
  test(`actual ${pair} adapter submits exactly ${characters} certified characters and rejects overrun`, () => {
    const input = snapshot(pair);
    const { adapter, now, source } = finish(input);
    const result = finite(source);
    const original = structuredClone(result);
    assert.equal(result.metrics.correctCharacters, characters);
    assert.equal(result.metrics.attemptedCharacters, characters);
    assert.equal(result.metrics.accuracy, 100);
    assert.equal(result.metrics.elapsedMs, characters + input.plan.prompts.length - 1);
    assert.equal(result.metrics.wpm, characters * 12000 / result.metrics.elapsedMs);
    assert.deepEqual(result.sentences.map(s => ({ id: s.promptId, text: s.promptText })), input.plan.prompts);
    assert.deepEqual(validateFinitePracticeResult(result, input.plan), result);
    assert.throws(() => validateResult(result));
    const terminal = adapter.tick(now);
    for (let i = 1; i <= 20; i++) assert.equal(key(adapter, 'x', now + i), false);
    adapter.interrupt(now + 21); adapter.abort(now + 22);
    assert.deepEqual(adapter.tick(999999), terminal);
    assert.equal(terminal.terminal, 'plan-exhausted');
    assert.equal(terminal.next, null);
    assert.deepEqual(terminal.engine.prompt, input.plan.prompts.at(-1));
    result.sentences[0].response = 'mutated'; result.metrics.wpm = -1;
    assert.notDeepEqual(adapter.result(completedAt), result);
    assert.deepEqual(adapter.result('2027-01-01T00:00:00.000Z'), original);
  });
  test(`actual ${pair} final boundary timeout wins at and after the deadline`, () => {
    for (const offset of [-0.001, 0, 0.001]) {
      const { adapter, source } = finish(snapshot(pair), { finalAt: 30100 + offset });
      if (offset < 0) {
        const result = finite(source);
        assert.equal(result.metrics.elapsedMs, 30000 + offset);
        assert.equal(adapter.tick(30100).terminal, 'plan-exhausted');
      } else {
        assert.ok(source && !('schemaId' in source));
        validateResult(source);
        assert.equal(source.metrics.elapsedMs, 30000);
        assert.equal(source.sentences.at(-1)!.submitted, false);
        assert.equal(source.sentences.length, 12);
        assert.equal(source.mode, 'practice');
        assert.equal(source.practiceFocus, undefined);
        assert.equal(source.manualDrill, undefined);
        assert.equal(source.sourceAssessmentId, undefined);
        assert.equal(adapter.tick(30101).terminal, 'timeout');
      }
    }
  });
}

for (const pair of ['he', 'in', 'le', 'th']) test(`${pair} actual-engine edits, backspace, incorrect/repeated/flagged/timing input preserve metric1 semantics`, () => {
  for (const variant of ['edited', 'incorrect', 'repeat', 'interrupted', 'invalid-input', 'missing-timing', 'malformed-timing'] as const) {
    const { source } = finish(snapshot(pair), { variant });
    const result = finite(source);
    validateFinitePracticeResult(result, snapshot(pair).plan);
    assert.equal(result.sentences[0].eligible, false, variant);
    assert.deepEqual(result.sentences[0].pairs, {}, variant);
    assert.equal(result.eligibleForProgress, false);
    assert.equal(result.metrics.deletedCharacters, variant === 'edited' ? 1 : 0);
    assert.equal(result.metrics.accuracy === null, variant === 'invalid-input');
    assert.deepEqual(result.qualityFlags, ['interrupted', 'invalid-input'].includes(variant) ? [variant] : []);
  }
});

test('very fast valid finite output exceeds the timed WPM ceiling and remains valid', () => {
  const { source } = finish(snapshot(), { step: 0.000001 });
  const result = finite(source);
  assert.ok(result.metrics.wpm > 256 * 300 * 12000 / 30000);
  validateFinitePracticeResult(result, snapshot().plan);
});

test('zero elapsed and nonfinite figures never become a saved finite source', () => {
  assert.throws(() => finish(snapshot(), { step: 0 }), /elapsed/);
  const clean = finite(finish().source);
  for (const value of [0, -1, NaN, Infinity, 30000]) {
    const result = structuredClone(clean); result.metrics.elapsedMs = value;
    assert.throws(() => validateFinitePracticeResult(result, snapshot().plan));
  }
});

test('abort and response/attempt safety stops remain distinct and cannot yield an early result', () => {
  const input = snapshot();
  const aborted = createFiniteAdapter({ id, snapshot: input });
  key(aborted, 'a', 100); aborted.abort(101);
  assert.equal(aborted.tick(102).terminal, 'aborted');
  assert.equal(aborted.result(completedAt), null);
  const response = createFiniteAdapter({ id, snapshot: input });
  key(response, 'x'.repeat(MAX_RESPONSE_LENGTH), 100); key(response, 'x', 101);
  assert.equal(response.tick(102).terminal, 'stopped');
  assert.equal(response.stoppedSnapshot()!.stopReason, 'response-limit');
  assert.equal(response.result(completedAt), null);
  const attempts = createFiniteAdapter({ id, snapshot: input });
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    attempts.edit({ start: 0, end: Number(i > 0), text: 'x', pressTime: 100 + i }, 100 + i);
  }
  assert.equal(attempts.edit({ start: 0, end: 1, text: 'x' }, 100 + MAX_ATTEMPTS), false);
  assert.equal(attempts.stoppedSnapshot()!.stopReason, 'attempt-limit');
  assert.equal(attempts.result(completedAt), null);
});

test('adapter binds only a defensive exact supported plan and never reads later snapshot mutations', () => {
  const input = structuredClone(snapshot());
  assert.throws(() => createFiniteAdapter({ id: 'bad', snapshot: input }));
  const adapter = createFiniteAdapter({ id, snapshot: input });
  input.plan.prompts[0].text = 'corrupt'; input.configId = '0'.repeat(64); input.focus.pair = 'zz';
  assert.deepEqual(adapter.tick(0).engine.prompt, snapshot().plan.prompts[0]);
  for (const mutate of [
    (s: PracticeSnapshot) => { s.configId = '0'.repeat(64); },
    (s: PracticeSnapshot) => { s.focus.pair = 'zz'; },
    (s: PracticeSnapshot) => { s.plan.prompts[0].text = 'fake'; },
    (s: PracticeSnapshot) => { s.plan.planHash = '0'.repeat(64); },
    (s: PracticeSnapshot) => { s.plan.prompts = [...s.plan.prompts].reverse(); },
  ]) {
    const invalid = structuredClone(snapshot()); mutate(invalid);
    assert.throws(() => createFiniteAdapter({ id, snapshot: invalid }));
  }
});

test('strict source validator rejects corrupted envelope, metrics, diagnostics, chart and immutable identity', () => {
  const clean = finite(finish().source);
  const mutations: ((r: FinitePracticeResult) => void)[] = [
    r => { r.id = 'bad'; }, r => { r.owner = 'other' as 'guest'; },
    r => { r.completedAt = '2026-02-30T12:00:00.000Z'; }, r => { r.completedAt = '2026-11-18T12:00:00Z'; },
    r => { r.mode = 'assessment' as 'practice'; }, r => { r.metricVersion = 2 as 1; },
    r => { r.termination = 'timeout' as 'plan-exhausted'; }, r => { r.eligibleForProgress = true as false; },
    r => { r.settings.durationMs = 60000; }, r => { r.settings.qwerty = false; },
    r => { delete r.settings.inputMode; }, r => { r.settings.corpusVersion = 'other'; },
    r => { r.metrics.correctCharacters++; }, r => { r.metrics.attemptedCharacters++; },
    r => { r.metrics.correctAttempts = r.metrics.attemptedCharacters + 1; }, r => { r.metrics.deletedCharacters++; },
    r => { r.metrics.accuracy = null; }, r => { r.metrics.wpm = Infinity; }, r => { r.metrics.wpm++; },
    r => { r.metrics.correctCharacters = NaN; }, r => { r.metrics.deletedCharacters = .5; },
    r => { r.qualityFlags.push('interrupted'); }, r => { r.qualityFlags.push('invalid-input'); },
    r => { r.sentences.pop(); }, r => { r.sentences.reverse(); }, r => { r.sentences.push(r.sentences[0]); },
    r => { r.sentences[0].promptText = 'fake'; }, r => { r.sentences[0].promptId = 'fake'; },
    r => { r.sentences[0].submitted = false; }, r => { r.sentences[0].eligible = false; },
    r => { r.sentences[0].diagnosticsAvailable = false; }, r => { r.sentences[0].qualityFlags.push('repeat'); },
    r => { r.sentences[0].response = 'x'.repeat(601); }, r => { r.sentences[0].keys.z = { attempts: 1, correct: 1, firstAttempts: 1, firstErrors: 0 }; },
    r => { r.sentences[0].pairs.zz = { count: 1, logSum: 1 }; },
    r => { Object.values(r.sentences[0].pairs)[0].logSum = Infinity; },
    r => { Object.values(r.sentences[0].pairs)[0].logSum = -1e12; },
    r => { Object.values(r.sentences[0].pairs)[0].count = 999; },
    r => { Object.values(r.sentences[0].keys)[0].firstErrors = 1; },
    r => { r.chartSamples = []; }, r => { r.chartSamples[0].elapsedMs = 0; },
    r => { r.chartSamples[0].wpm++; }, r => { r.chartSamples[0].accuracy = null; },
    r => { r.chartSamples.push(r.chartSamples[0]); },
    r => { r.plan.configId = '0'.repeat(64); }, r => { r.plan.catalogueId = '0'.repeat(64); },
    r => { r.plan.planHash = '0'.repeat(64); }, r => { r.plan.pair = 'in'; }, r => { r.plan.sentenceCount++; },
  ];
  for (const [index, mutate] of mutations.entries()) {
    const result = structuredClone(clean); mutate(result);
    assert.throws(() => validateFinitePracticeResult(result, snapshot().plan), `mutation ${index}`);
  }
  for (const target of ['root', 'settings', 'metrics', 'plan', 'sentence', 'keys', 'pair', 'chart'] as const) {
    const result = structuredClone(clean);
    const objects = { root: result, settings: result.settings, metrics: result.metrics, plan: result.plan,
      sentence: result.sentences[0], keys: Object.values(result.sentences[0].keys)[0],
      pair: Object.values(result.sentences[0].pairs)[0], chart: result.chartSamples[0] };
    Object.assign(objects[target], { surprise: true });
    assert.throws(() => validateFinitePracticeResult(result, snapshot().plan), target);
  }
  for (const legacy of ['practiceFocus', 'manualDrill', 'sourceAssessmentId']) {
    assert.throws(() => validateFinitePracticeResult({ ...clean, [legacy]: {} }, snapshot().plan));
  }
  const plan = structuredClone(snapshot().plan); plan.prompts[0].text = 'fake';
  assert.throws(() => validateFinitePracticeResult(clean, plan));
});

test('charts use actual observation times, ordered bounded samples and a final metric match', () => {
  const input = snapshot();
  const clean = finite(finish(input, { step: 25 }).source);
  assert.ok(clean.chartSamples.length > 5);
  validateFinitePracticeResult(clean, input.plan);
  for (const mutation of ['reverse', 'duplicate', 'beyond', 'nonfinite', 'null-accuracy', 'too-many'] as const) {
    const r = structuredClone(clean);
    if (mutation === 'reverse') r.chartSamples.reverse();
    if (mutation === 'duplicate') r.chartSamples[1].elapsedMs = r.chartSamples[0].elapsedMs;
    if (mutation === 'beyond') r.chartSamples[0].elapsedMs = r.metrics.elapsedMs + 1;
    if (mutation === 'nonfinite') r.chartSamples[0].wpm = NaN;
    if (mutation === 'null-accuracy') r.chartSamples[0].accuracy = null;
    if (mutation === 'too-many') r.chartSamples = Array(31).fill(r.chartSamples[0]);
    assert.throws(() => validateFinitePracticeResult(r, input.plan), mutation);
  }
});

test('real finite envelope stays outside the timed history/calibration type boundary', () => {
  const result = finite(finish().source);
  const sources: SavedSource[] = [result];
  const timed = sources.filter((source): source is SessionResult => !('schemaId' in source));
  assert.deepEqual(selectHistory(timed, result.settings), []);
  assert.equal(result.mode, 'practice');
  assert.equal(result.eligibleForProgress, false);
  assert.throws(() => validateResult(result));
  // Compile-time contract test: a consumer cannot treat a finite source as schema1.
  const typeBoundary = () => {
    // @ts-expect-error FinitePracticeResult has no schemaVersion and is not a timed result.
    selectHistory([result], result.settings);
  };
  assert.equal(typeof typeBoundary, 'function');
});

test('finite engine default remains opt-in: timed two-prompt runs continue wrapping', () => {
  const engine = new TypingEngine({ id, prompts: [{ id: 'one', text: 'a' }, { id: 'two', text: 'b' }],
    inputMode: 'flow-v1', durationMs: 30000 });
  for (const [i, text] of [...'a b a '].entries()) engine.edit({ start: engine.value.length, end: engine.value.length, text }, 100 + i);
  assert.equal(engine.state, 'running'); assert.equal(engine.submittedSummaries.length, 3);
  assert.equal(engine.prompt.id, 'two');
});

test('optional existing metric1 predictions retain their strict sentence shape and observation binding', () => {
  const input = snapshot();
  const engine = new TypingEngine({ id, prompts: input.plan.prompts, finite: true,
    inputMode: 'flow-v1', durationMs: 30000, corpusVersion: '1', qwerty: true, mode: 'practice' });
  engine.setSentencePredictions(0, { featureVersion: 1, baseline: { kind: 'population', version: 'v1' },
    candidate: { modelVersion: 'm1', status: 'experimental' },
    occurrences: pairPositions(input.plan.prompts[0].text).map(position => ({ position, baselineLogMs: 1, candidateLogMs: 2 })) });
  let now = 100;
  for (const prompt of input.plan.prompts) for (const text of [...prompt.text, ' ']) {
    engine.edit({ start: engine.value.length, end: engine.value.length, text, pressTime: now }, now++);
  }
  const source = { ...finite(finish(input).source), ...engine.finiteResult()! };
  assert.ok(source.sentences[0].prediction);
  validateFinitePracticeResult(source, input.plan);
  for (const mutate of [
    (r: FinitePracticeResult) => { r.sentences[0].prediction!.baseline.version = ''; },
    (r: FinitePracticeResult) => { r.sentences[0].prediction!.candidate!.status = 'wrong' as 'experimental'; },
    (r: FinitePracticeResult) => { Object.values(r.sentences[0].prediction!.pairs)[0].count++; },
    (r: FinitePracticeResult) => { Object.values(r.sentences[0].prediction!.pairs)[0].observedLogSum++; },
    (r: FinitePracticeResult) => { Object.values(r.sentences[0].prediction!.pairs)[0].baselinePredictedLogSum = Infinity; },
    (r: FinitePracticeResult) => { Object.values(r.sentences[0].prediction!.pairs)[0].candidatePredictedLogSum = -1e10; },
    (r: FinitePracticeResult) => { Object.assign(r.sentences[0].prediction!, { extra: true }); },
  ]) {
    const corrupt = structuredClone(source); mutate(corrupt);
    assert.throws(() => validateFinitePracticeResult(corrupt, input.plan));
  }
});
