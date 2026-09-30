import test from 'node:test';
import assert from 'node:assert/strict';
import { TypingEngine, DURATION_MS, MAX_RESPONSE_LENGTH } from '../src/engine.ts';
import { validateResult } from '../src/storage.ts';

const id = '00000000-0000-4000-8000-000000000001';
const completedAt = '2026-09-30T12:00:00.000Z';
function make(prompt = 'cat ', qwerty = true) {
  return new TypingEngine({ id, prompts: [{ id: 'test', text: prompt }], qwerty, corpusVersion: '1' });
}
function insert(engine: TypingEngine, text: string, time: number, start = engine.value.length, end = start) {
  return engine.edit({ start, end, text, pressTime: time }, time);
}
function complete(engine: TypingEngine, start = 100) {
  engine.tick(start + DURATION_MS);
  const result = engine.result(completedAt)!;
  validateResult(result);
  return result;
}

test('corrected errors retain attempts; incomplete final text contributes positional WPM', () => {
  const engine = make();
  assert.equal(engine.snapshot(0).metrics.accuracy, null);
  assert.equal(engine.submit(1), false);
  insert(engine, 'c', 100);
  insert(engine, 'x', 200);
  engine.edit({ start: 1, end: 2, text: '' }, 250);
  insert(engine, 'a', 300);
  insert(engine, 't', 400);
  insert(engine, ' ', 500);
  const result = complete(engine);
  assert.equal(result.metrics.correctCharacters, 4);
  assert.equal(result.metrics.attemptedCharacters, 5);
  assert.equal(result.metrics.accuracy, 80);
  assert.equal(result.metrics.deletedCharacters, 1);
  assert.equal(result.metrics.wpm, 0.8);
  assert.equal(result.sentences[0].keys.a.firstErrors, 1);
  assert.equal(result.sentences[0].keys.a.firstAttempts, 1);
  assert.deepEqual(result.sentences[0].pairs, {});
});

test('native middle insertion and selection replacement do not invent shifted attempts', () => {
  const engine = make('cat');
  insert(engine, 'c', 100);
  insert(engine, 't', 200);
  insert(engine, 'a', 300, 1);
  assert.equal(engine.snapshot(301).metrics.accuracy, 2 / 3 * 100);
  assert.equal(engine.snapshot(302).metrics.correctCharacters, 3);
  assert.equal(engine.submit(400), true);
  const result = complete(engine);
  assert.deepEqual(result.sentences[0].pairs, {});
  assert.equal(result.sentences[0].keys.t, undefined);
  const replace = make('cat');
  insert(replace, 'c', 100);
  insert(replace, 'a', 200);
  insert(replace, 't', 300);
  insert(replace, 'a', 400, 1, 2);
  const replacement = complete(replace);
  assert.equal(replacement.metrics.attemptedCharacters, 4);
  assert.equal(replacement.metrics.deletedCharacters, 1);
  assert.equal(replacement.metrics.accuracy, 100);
});

test('all wrong input has zero accuracy; deadline rejects edits and late Enter', () => {
  const engine = make('cat');
  insert(engine, 'x', 100);
  assert.equal(engine.snapshot(200).metrics.accuracy, 0);
  assert.equal(engine.edit({ start: 1, end: 1, text: 'a', pressTime: 60099 }, 60100), false);
  assert.equal(engine.submit(60101), false);
  const result = engine.result(completedAt)!;
  validateResult(result);
  assert.equal(result.metrics.elapsedMs, 60000);
  assert.equal(result.metrics.wpm, 0);
  assert.equal(result.metrics.accuracy, 0);
  assert.equal(result.sentences[0].response, 'x');
  assert.equal(result.sentences[0].submitted, false);
  assert.equal(result.chartSamples.at(-1)!.elapsedMs, 60000);
});

test('only correct submitted first passes retain within-word timing; later interruptions stay local', () => {
  const engine = make('cat dog');
  [...'cat dog'].forEach((character, index) => insert(engine, character, 100 + index * 100));
  assert.equal(engine.submit(900), true);
  insert(engine, 'c', 1000);
  engine.interrupt(1100);
  const result = complete(engine);
  assert.equal(result.sentences[0].eligible, true);
  assert.equal(result.sentences[0].pairs.ca.count, 1);
  assert.equal(result.sentences[0].pairs.ca.logSum, Math.log(100));
  assert.deepEqual(Object.keys(result.sentences[0].pairs).sort(), ['at', 'ca', 'do', 'og']);
  assert.equal(result.sentences[1].eligible, false);
  assert.equal(result.eligibleForProgress, false);
  assert.equal(result.metrics.elapsedMs, 60000);
});

test('repeat, missing timestamps, corrections and undeclared layouts exclude timing', () => {
  for (const reason of ['repeat', 'missing', 'layout', 'zero-interval']) {
    const engine = make('cat', reason !== 'layout');
    engine.edit({ start: 0, end: 0, text: 'c', pressTime: 100, repeat: reason === 'repeat' }, 100);
    engine.edit({ start: 1, end: 1, text: 'a', pressTime: reason === 'missing' ? undefined : reason === 'zero-interval' ? 100 : 200 }, 200);
    insert(engine, 't', 300);
    engine.submit(400);
    const result = complete(engine);
    assert.equal(result.sentences[0].eligible, false, reason);
    assert.deepEqual(result.sentences[0].pairs, {}, reason);
  }
});

test('long gaps are excluded without shortening duration or bridging word boundaries', () => {
  const engine = make('cat');
  insert(engine, 'c', 100);
  insert(engine, 'a', 6000);
  insert(engine, 't', 6100);
  engine.submit(6200);
  const result = complete(engine);
  assert.deepEqual(Object.keys(result.sentences[0].pairs), ['at']);
  assert.equal(result.metrics.elapsedMs, DURATION_MS);
});

test('untracked/composed bulk input is visible but invalid; limits reject oversized edits', () => {
  const engine = make('cat');
  engine.edit({ start: 0, end: 0, text: 'cat', tracked: false, composing: true }, 100);
  assert.equal(engine.value, 'cat');
  const result = complete(engine);
  assert.equal(result.metrics.accuracy, null);
  assert.equal(result.eligibleForProgress, false);
  assert.equal(result.sentences[0].diagnosticsAvailable, false);
  const limited = make();
  assert.equal(limited.edit({ start: 0, end: 0, text: 'x'.repeat(MAX_RESPONSE_LENGTH + 1) }, 100), false);
  assert.equal(limited.value, '');
  const unchanged = make('cat');
  insert(unchanged, 'c', 100);
  unchanged.edit({ start: 1, end: 1, text: '', tracked: false }, 200);
  assert.equal(complete(unchanged).metrics.accuracy, null);
});

test('abort/restart discard prior state; result snapshots are immutable copies', () => {
  const engine = make('cat');
  insert(engine, 'x', 100);
  engine.abort(200);
  assert.equal(engine.result(completedAt), null);
  assert.equal(insert(engine, 'y', 300), false);
  assert.throws(() => engine.restart(id), /fresh/);
  engine.restart('00000000-0000-4000-8000-000000000002');
  insert(engine, 'c', 400);
  const result = complete(engine, 400);
  assert.equal(result.metrics.attemptedCharacters, 1);
  assert.equal(result.metrics.accuracy, 100);
  result.metrics.wpm = 999;
  assert.equal(engine.result(completedAt)!.metrics.wpm, .2);
  assert.throws(() => engine.tick(0), /monotonic/);
});

test('delayed callbacks do not backfill chart samples, and regular samples fit persistence bounds', () => {
  const delayed = make();
  insert(delayed, 'c', 100);
  assert.equal(complete(delayed).chartSamples.length, 1);
  const regular = make();
  insert(regular, 'c', 100);
  for (let now = 1100; now < 60100; now += 1000) regular.tick(now);
  assert.equal(complete(regular).chartSamples.length, 60);
});
