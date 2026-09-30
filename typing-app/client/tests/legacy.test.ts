import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { DURATION_MS, TypingEngine } from '../src/engine.ts';
import { validateResult } from '../src/storage.ts';

// Regression contract: recruiter-platform PRD r2, SHA-256
// fe9c8644c57186100b7cc634e02026816f2cccf1cde0017adb30a0fa30e2b6bf.
// Optional-extension behavior belongs to the subsequent domain implementation.
const completedAt = '2026-09-30T12:00:00.000Z';
function make(prompt = 'cat') {
  return new TypingEngine({
    id: '00000000-0000-4000-8000-000000000001',
    prompts: [{ id: 'legacy-cat', text: prompt }], qwerty: true, corpusVersion: '1',
  });
}
function append(engine: TypingEngine, text: string, now: number) {
  const start = engine.value.length;
  assert.equal(engine.edit({ start, end: start, text, pressTime: now }, now), true);
}
function finish(engine: TypingEngine) {
  engine.tick(100 + DURATION_MS);
  const result = engine.result(completedAt);
  assert.ok(result);
  validateResult(result);
  return result;
}

test('legacy v1 JSON loads, validates and exports unchanged without optional extensions', () => {
  const value: unknown = JSON.parse(readFileSync(new URL('./fixtures/legacy-v1.json', import.meta.url), 'utf8'));
  const original = structuredClone(value);
  validateResult(value);
  assert.equal(Object.hasOwn(value, 'practiceFocus'), false);
  assert.equal(Object.hasOwn(value, 'sourceAssessmentId'), false);
  assert.equal(Object.hasOwn(value.sentences[0]!, 'prediction'), false);
  const exported: unknown = JSON.parse(JSON.stringify(value));
  validateResult(exported);
  assert.deepEqual(exported, original);
  assert.deepEqual(value, original, 'validation must not migrate or rewrite old data');
});

test('a submitted correction keeps attempt accuracy but cannot regain timing eligibility', () => {
  const engine = make('cat ');
  append(engine, 'c', 100);
  append(engine, 'x', 200);
  assert.equal(engine.edit({ start: 1, end: 2, text: '' }, 250), true);
  append(engine, 'a', 300);
  append(engine, 't', 400);
  append(engine, ' ', 500);
  assert.equal(engine.submit(600), true);
  const result = finish(engine);
  assert.deepEqual(result.metrics, {
    elapsedMs: 60000, correctCharacters: 4, attemptedCharacters: 5,
    correctAttempts: 4, accuracy: 80, deletedCharacters: 1, wpm: 0.8,
  });
  const sentence = result.sentences[0]!;
  assert.equal(sentence.response, 'cat ');
  assert.equal(sentence.submitted, true);
  assert.equal(sentence.eligible, false);
  assert.ok(sentence.qualityFlags.includes('edited'));
  assert.ok(sentence.qualityFlags.includes('incorrect'));
  assert.deepEqual(sentence.pairs, {});
});

test('a partial final word adds positional WPM without adding timing observations', () => {
  const engine = make();
  for (const [index, character] of [...'cat'].entries()) append(engine, character, 100 + index * 100);
  assert.equal(engine.submit(400), true);
  append(engine, 'c', 500);
  append(engine, 'a', 600);
  const result = finish(engine);
  assert.equal(result.metrics.correctCharacters, 5);
  assert.equal(result.metrics.wpm, 1);
  assert.equal(result.metrics.accuracy, 100);
  assert.equal(result.sentences[0]!.eligible, true);
  assert.equal(result.sentences[0]!.pairs.ca!.count, 1);
  assert.equal(result.sentences[1]!.response, 'ca');
  assert.equal(result.sentences[1]!.submitted, false);
  assert.deepEqual(result.sentences[1]!.qualityFlags, ['unfinished']);
  assert.deepEqual(result.sentences[1]!.pairs, {});
});

test('interruption invalidates only the affected sentence while preserving earlier eligible evidence', () => {
  const engine = make();
  for (const [index, character] of [...'cat'].entries()) append(engine, character, 100 + index * 100);
  assert.equal(engine.submit(400), true);
  append(engine, 'c', 500);
  engine.interrupt(600);
  append(engine, 'a', 700);
  append(engine, 't', 800);
  assert.equal(engine.submit(900), true);
  const result = finish(engine);
  assert.equal(result.eligibleForProgress, false);
  assert.deepEqual(result.qualityFlags, ['interrupted']);
  assert.equal(result.sentences[0]!.eligible, true);
  assert.deepEqual(result.sentences[0]!.pairs, {
    ca: { count: 1, logSum: Math.log(100) }, at: { count: 1, logSum: Math.log(100) },
  });
  assert.equal(result.sentences[1]!.submitted, true);
  assert.equal(result.sentences[1]!.eligible, false);
  assert.deepEqual(result.sentences[1]!.qualityFlags, ['interrupted']);
  assert.deepEqual(result.sentences[1]!.pairs, {});
});

test('a pre-deadline press committed at the exact deadline cannot change the frozen result', () => {
  const engine = make();
  append(engine, 'c', 100);
  assert.equal(engine.tick(60099).state, 'running');
  assert.equal(engine.edit({ start: 1, end: 1, text: 'a', pressTime: 60099 }, 60100), false);
  const frozen = engine.result(completedAt);
  assert.ok(frozen);
  assert.equal(frozen.metrics.elapsedMs, 60000);
  assert.equal(frozen.metrics.attemptedCharacters, 1);
  assert.equal(frozen.sentences[0]!.response, 'c');
  assert.equal(engine.submit(60101), false);
  engine.interrupt(60102);
  engine.tick(90000);
  assert.deepEqual(engine.result('2026-10-01T12:00:00.000Z'), frozen);
});

test('completed results defensively copy nested evidence, settings and charts on every read', () => {
  const engine = make();
  for (const [index, character] of [...'cat'].entries()) append(engine, character, 100 + index * 100);
  assert.equal(engine.submit(400), true);
  const result = finish(engine);
  const expected = structuredClone(result);
  result.settings.qwerty = false;
  result.metrics.wpm = 999;
  result.qualityFlags.push('interrupted');
  result.sentences[0]!.keys.c!.attempts = 999;
  result.sentences[0]!.pairs.ca!.logSum = 999;
  result.sentences[0]!.qualityFlags.push('edited');
  result.sentences[0]!.response = 'changed';
  result.chartSamples[0]!.wpm = 999;
  result.sentences.length = 0;
  const reread = engine.result(completedAt);
  assert.deepEqual(reread, expected);
  validateResult(reread);
});
