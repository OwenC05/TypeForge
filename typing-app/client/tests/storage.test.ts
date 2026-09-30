import assert from 'node:assert/strict';
import test from 'node:test';
import type { SessionResult } from '../src/engine.ts';
import { validateResult } from '../src/storage.ts';

function result(): SessionResult {
  return {
    id: 'eed705bf-e344-4660-af71-ac5a48cacb9f',
    owner: 'guest',
    schemaVersion: 1,
    metricVersion: 1,
    completedAt: '2026-09-30T12:00:00.000Z',
    mode: 'assessment',
    settings: { durationMs: 60000, language: 'en', qwerty: true, corpusVersion: '1' },
    qualityFlags: [],
    eligibleForProgress: true,
    metrics: { elapsedMs: 60000, correctCharacters: 3, attemptedCharacters: 3, correctAttempts: 3, accuracy: 100, deletedCharacters: 0, wpm: 0.6 },
    sentences: [{
      promptId: 'assessment-001',
      promptText: 'the',
      response: 'the',
      submitted: true,
      eligible: true,
      diagnosticsAvailable: true,
      qualityFlags: [],
      keys: { t: { attempts: 1, correct: 1, firstAttempts: 1, firstErrors: 0 } },
      pairs: { th: { count: 1, logSum: Math.log(0.5) } },
    }],
    chartSamples: [{ elapsedMs: 60000, wpm: 0.6, accuracy: 100 }],
  };
}

test('accepts bounded guest results including sub-millisecond timing and unknown accuracy', () => {
  assert.doesNotThrow(() => validateResult(result()));
  const invalidInput = result();
  invalidInput.qualityFlags = ['invalid-input'];
  invalidInput.eligibleForProgress = false;
  invalidInput.metrics.accuracy = null;
  assert.doesNotThrow(() => validateResult(invalidInput));
});

test('rejects corrupt shapes, unsupported versions, impossible counts and unsafe chart data', () => {
  const corruptions: Array<(value: any) => void> = [
    (value) => { value.schemaVersion = 2; },
    (value) => { value.owner = 'someone-else'; },
    (value) => { value.completedAt = 'yesterday'; },
    (value) => { value.metrics.wpm = Infinity; },
    (value) => { value.metrics.attemptedCharacters = -1; },
    (value) => { value.metrics.correctAttempts = 4; },
    (value) => { value.metrics.accuracy = 101; },
    (value) => { value.sentences[0].keys.t.firstErrors = 2; },
    (value) => { value.sentences[0].pairs.th.count = 0; },
    (value) => { value.sentences[0].pairs.th.logSum = NaN; },
    (value) => { value.sentences[0].pairs.th.logSum = Math.log(5001); },
    (value) => { value.sentences[0].submitted = false; },
    (value) => { value.sentences[0].response = 'x'.repeat(601); },
    (value) => { value.chartSamples = []; },
    (value) => { value.chartSamples[0].elapsedMs = 59999; },
    (value) => { value.chartSamples.unshift({ elapsedMs: 60000, wpm: 1, accuracy: null }); },
    (value) => { value.extra = new Uint8Array(2 * 1024 * 1024); },
  ];
  for (const corrupt of corruptions) {
    const value = result();
    corrupt(value);
    assert.throws(() => validateResult(value), /Invalid saved result/);
  }
  for (const value of [null, [], {}, 'text']) {
    assert.throws(() => validateResult(value), /Invalid saved result/);
  }
});

test('rejects an otherwise bounded record larger than the 1 MiB persistence limit', () => {
  const value = result();
  const pairs = Object.fromEntries(Array.from({ length: 299 }, (_, index) => [
    String.fromCharCode(97 + Math.floor(index / 26), 97 + index % 26),
    { count: 1, logSum: Math.log(1234.56789) },
  ]));
  value.sentences = Array.from({ length: 120 }, () => ({ ...value.sentences[0]!, pairs }));
  assert.throws(() => validateResult(value), /record exceeds 1 MiB/);
});
