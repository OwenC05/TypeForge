import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TypingEngine, MAX_ATTEMPTS, MAX_SENTENCES, MAX_RESPONSE_LENGTH, type Prompt } from '../src/engine.ts';
import { assessmentPrompts, practicePrompts, selectPrompts } from '../src/corpus.ts';
import { assessmentPrompts as assessmentV2, selectAssessmentPrompts, selectPairPrompts } from '../src/corpus-v2.ts';
import { parseModelArtifact, predictSentence } from '../src/model.ts';
import { appendHistory, buildHistory, resolveRetest, selectHistory, type HistorySnapshot } from '../src/profile.ts';
import { validateResult } from '../src/storage.ts';

const id = '00000000-0000-4000-8000-000000000081';
const completedAt = '2026-10-04T12:00:00.000Z';
const artifact = parseModelArtifact(JSON.parse(readFileSync(new URL('../src/generated/model.json', import.meta.url), 'utf8')));
const empty: HistorySnapshot = { count: 0, logSum: 0, pairs: {} };
function make(prompts: readonly Prompt[], mode: 'assessment' | 'practice' = 'assessment') {
  return new TypingEngine({ id, prompts, mode, qwerty: true, corpusVersion: '1', inputMode: 'flow-v1', durationMs: 120000 });
}
function driver(engine: TypingEngine, stepMs = 5) {
  let now = 100;
  return {
    edit(text: string, start = engine.value.length, end = start) {
      now += stepMs;
      assert.equal(engine.edit({ start, end, text, pressTime: now }, now), true);
    },
    finish() { engine.tick(120105); const result = engine.result(completedAt)!; assert.ok(result); validateResult(result); return result; },
    get now() { return now; },
  };
}
function envelope(prompts: readonly Prompt[], corrections = false, mode: 'assessment' | 'practice' = 'assessment') {
  const engine = make(prompts, mode), input = driver(engine);
  let correct = 0, commits = 0;
  while (correct < 3000) {
    engine.setSentencePredictions(commits, predictSentence(engine.prompt.text, empty, artifact).predictions!);
    const text = engine.prompt.text;
    const count = Math.min(text.length, 3000 - correct);
    for (const character of text.slice(0, count)) {
      if (corrections) { input.edit(character === 'x' ? 'z' : 'x'); input.edit('', engine.value.length - 1, engine.value.length); }
      input.edit(character); correct++;
    }
    if (count === text.length) { input.edit(' '); commits++; assert.equal(engine.value, ''); }
  }
  const result = input.finish();
  assert.equal(result.metrics.correctCharacters, 3000);
  assert.equal(result.metrics.wpm, 300);
  assert.equal(result.metrics.attemptedCharacters, corrections ? 6000 : 3000);
  assert.equal(result.metrics.deletedCharacters, corrections ? 3000 : 0);
  assert.equal(result.sentences.filter(s => s.submitted).length, commits);
  assert.ok(result.sentences.length <= 201);
  if (!corrections) assert.ok(result.sentences.filter(s => s.submitted).every(s => s.eligible && s.prediction?.candidate));
  const bytes = Buffer.byteLength(JSON.stringify(result), 'utf8');
  assert.ok(bytes < 1024 * 1024, `result exceeds 1 MiB: ${bytes}`);
  const parsed = JSON.parse(JSON.stringify(result));
  validateResult(parsed);
  assert.deepEqual(parsed, result);
  return { bytes, commits, summaries: result.sentences.length, attempts: result.metrics.attemptedCharacters };
}
const banks: [string, readonly Prompt[], 'assessment' | 'practice'][] = [
  ['200 short commits', [{ id: 'short', text: 'abc def ghi jkl' }], 'assessment'],
  ['shuffled assessment', selectAssessmentPrompts([], () => 0.37), 'assessment'],
  ['shuffled practice', selectPrompts('practice', [], () => 0.37), 'practice'],
  ['targeted drill', selectPairPrompts('th', () => 0.37), 'practice'],
  ['shortest assessment', [assessmentV2.reduce((a, b) => a.text.length < b.text.length ? a : b)], 'assessment'],
  ['shortest practice', [practicePrompts.reduce((a, b) => a.text.length < b.text.length ? a : b)], 'practice'],
];
for (const [name, bank, mode] of banks) {
  test(`120s 300 WPM envelope preserves exhaustive shipped-model diagnostics: ${name}`, t => {
    const measured = envelope(bank, false, mode);
    if (name === '200 short commits') assert.equal(measured.commits, 200);
    t.diagnostic(JSON.stringify({ fixture: name, ...measured }));
  });
}
test('120s corrected 6000-attempt envelope retains 3000 characters without truncation', t => {
  t.diagnostic(JSON.stringify(envelope(selectAssessmentPrompts([], () => 0.37), true)));
});
test('a valid retest with one fresh prompt cycles only that remaining prompt within the envelope', t => {
  const originEngine = make(assessmentPrompts.slice(0, -1)), input = driver(originEngine);
  for (const prompt of assessmentPrompts.slice(0, -1)) for (const char of prompt.text + ' ') input.edit(char);
  const origin = input.finish();
  const retest = resolveRetest(origin, origin.settings, assessmentPrompts);
  assert.equal(retest.kind, 'retest');
  assert.ok(retest.kind === 'retest');
  const bank = selectPrompts('assessment', retest.excludedPromptIds, () => 0.37);
  assert.equal(bank.length, 1);
  assert.equal(bank[0].id, assessmentPrompts.at(-1)!.id);
  t.diagnostic(JSON.stringify(envelope(bank)));
});
test('overfull word count created by interior edit advances on a subsequent appended separator', () => {
  const engine = make([{ id: 'words', text: 'ab cd' }]), input = driver(engine);
  for (const char of 'ab cd') input.edit(char);
  input.edit(' ', 1);
  assert.equal(engine.submittedSummaries.length, 0);
  assert.equal(engine.value, 'a b cd');
  input.edit(' ');
  assert.equal(engine.value, '');
  assert.equal(engine.submittedSummaries[0].response, 'a b cd');
  assert.equal(engine.submittedSummaries[0].eligible, false);
});
test('earlier eligible passages still calibrate when the later assessment passage is interrupted', () => {
  const engine = make([{ id: 'words', text: 'ab cd' }]), input = driver(engine);
  engine.setSentencePredictions(0, predictSentence(engine.prompt.text, empty, artifact).predictions!);
  for (const char of 'ab cd ') input.edit(char);
  input.edit('a'); engine.interrupt(input.now + 1);
  const result = input.finish();
  assert.equal(result.eligibleForProgress, false);
  assert.equal(result.sentences[0].eligible, true);
  const history = selectHistory([result], result.settings);
  assert.deepEqual(history, [result.sentences[0]]);
  assert.deepEqual(buildHistory(history), buildHistory(appendHistory([], result.sentences[0])));
  assert.equal(buildHistory(history).count, 2);
});
test('capacity constants preserve the explicit bounded contract', () => {
  assert.equal(MAX_ATTEMPTS, 16384); assert.equal(MAX_SENTENCES, 256); assert.equal(MAX_RESPONSE_LENGTH, 600);
});

for (const limit of ['response', 'attempt', 'sentence'] as const) {
  test(`${limit} limit freezes accepted partial data, never a completed result`, () => {
    const engine = make([{ id: 'cap', text: 'ab' }]), input = driver(engine, 1);
    if (limit === 'response') {
      for (let i = 0; i < MAX_RESPONSE_LENGTH; i++) input.edit('a');
    } else if (limit === 'attempt') {
      for (let i = 0; i < MAX_ATTEMPTS; i++) { input.edit('a'); if (i < MAX_ATTEMPTS - 1) input.edit('', 0, 1); }
    } else {
      for (let i = 0; i < MAX_SENTENCES - 1; i++) for (const char of 'ab ') input.edit(char);
      for (const char of 'ab') input.edit(char);
    }
    assert.equal(engine.state, 'running');
    const before = engine.snapshot(input.now), text = engine.value;
    const time = input.now + 1;
    assert.equal(engine.edit({ start: text.length, end: text.length, text: limit === 'sentence' ? ' ' : 'a', pressTime: time }, time), false);
    assert.equal(engine.state, 'stopped');
    const stopped = engine.stoppedSnapshot()!;
    assert.ok(stopped);
    assert.equal(stopped.stopReason, `${limit}-limit`);
    assert.equal(stopped.value, text);
    assert.equal(stopped.metrics.attemptedCharacters, before.metrics.attemptedCharacters);
    assert.equal(stopped.metrics.correctCharacters, before.metrics.correctCharacters);
    assert.ok(stopped.elapsedMs < 120000);
    assert.ok(stopped.sentences.length <= 256);
    assert.equal(engine.result(completedAt), null);
    assert.throws(() => validateResult(stopped));
    assert.deepEqual(JSON.parse(JSON.stringify(stopped)), stopped);
    assert.ok(Buffer.byteLength(JSON.stringify(stopped)) < 1024 * 1024);
    engine.tick(200000);
    assert.equal(engine.edit({ start: 0, end: 0, text: 'z' }, 200001), false);
    assert.deepEqual(engine.stoppedSnapshot(), stopped);
    stopped.value = 'mutated caller copy';
    assert.equal(engine.stoppedSnapshot()!.value, text);
  });
}

test('shipped prediction diagnostics stop before a 9000-character result exceeds 1 MiB', t => {
  const engine = make(assessmentPrompts);
  let now = 100, accepted = 0, commits = 0;
  while (accepted < 9000 && engine.state !== 'stopped') {
    engine.setSentencePredictions(commits, predictSentence(engine.prompt.text, empty, artifact).predictions!);
    for (const character of engine.prompt.text) {
      if (accepted >= 9000) break;
      now += 4;
      assert.equal(engine.edit({ start: engine.value.length, end: engine.value.length, text: character, pressTime: now }, now), true);
      accepted++;
    }
    if (engine.value === engine.prompt.text) {
      now += 4;
      if (engine.edit({ start: engine.value.length, end: engine.value.length, text: ' ', pressTime: now }, now)) commits++;
    }
  }
  engine.tick(120104);
  assert.equal(engine.state, 'stopped');
  assert.equal(engine.result(completedAt), null);
  const stopped = engine.stoppedSnapshot()!;
  assert.equal(stopped.stopReason, 'result-limit');
  assert.equal(stopped.metrics.attemptedCharacters, accepted);
  assert.equal(stopped.metrics.correctCharacters, accepted);
  assert.equal(stopped.sentences.filter(s => s.submitted).length, commits);
  assert.equal(stopped.value, stopped.sentences.at(-1)?.response);
  assert.ok(stopped.elapsedMs < 120000);
  t.diagnostic(JSON.stringify({ accepted, commits, diagnosticBytes: Buffer.byteLength(JSON.stringify(stopped)) }));
  engine.tick(200000);
  assert.deepEqual(engine.stoppedSnapshot(), stopped);
});

test('an oversized final partial stops at the deadline, keeps escaped bytes and restarts cleanly', t => {
  const engine = make([{ id: 'xxxxxxxxxx', text: 'abcdefghijklmnopqrstuvwxyz' }]);
  const input = driver(engine, 4);
  for (let index = 0; index < 154; index++) {
    engine.setSentencePredictions(index, predictSentence(engine.prompt.text, empty, artifact).predictions!);
    for (const character of engine.prompt.text + ' ') input.edit(character);
  }
  // JSON must escape each NUL; character counts alone cannot bound serialized bytes.
  input.edit('\0'.repeat(MAX_RESPONSE_LENGTH));
  assert.equal(engine.state, 'running');
  const accepted = engine.snapshot(input.now).metrics;
  // Deadline precedence rejects the attempted extra input, even on the safety-stop path.
  assert.equal(engine.edit({ start: engine.value.length, end: engine.value.length, text: 'z' }, 120104), false);
  assert.equal(engine.state, 'stopped');
  assert.equal(engine.result(completedAt), null);
  const stopped = engine.stoppedSnapshot()!;
  assert.equal(stopped.stopReason, 'result-limit');
  assert.equal(stopped.elapsedMs, 120000);
  assert.equal(stopped.metrics.attemptedCharacters, accepted.attemptedCharacters);
  assert.equal(stopped.metrics.correctCharacters, accepted.correctCharacters);
  assert.equal(stopped.sentences.length, 155);
  assert.equal(stopped.sentences.at(-1)!.submitted, false);
  assert.equal(stopped.value, '\0'.repeat(MAX_RESPONSE_LENGTH));
  t.diagnostic(JSON.stringify({ finalPartialDiagnosticBytes: Buffer.byteLength(JSON.stringify(stopped)) }));
  engine.restart('00000000-0000-4000-8000-000000000082');
  assert.equal(engine.stoppedSnapshot(), null);
  assert.equal(engine.edit({ start: 0, end: 0, text: 'a', pressTime: 120105 }, 120105), true);
  engine.tick(240105);
  const result = engine.result(completedAt)!;
  validateResult(result);
  assert.equal(result.sentences.length, 1);
  assert.equal(result.metrics.correctCharacters, 1);
});
