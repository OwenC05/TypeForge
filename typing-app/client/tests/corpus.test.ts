import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CORPUS_VERSION,
  assessmentPrompts,
  practicePrompts,
  selectPrompts,
} from '../src/corpus.ts';

test('versioned banks contain unique original sentence text and stable IDs', () => {
  assert.equal(CORPUS_VERSION, '1');
  assert.equal(practicePrompts.length, 80);
  assert.equal(assessmentPrompts.length, 40);
  const prompts = [...practicePrompts, ...assessmentPrompts];
  assert.equal(new Set(prompts.map((prompt) => prompt.id)).size, 120);
  assert.equal(new Set(prompts.map((prompt) => prompt.text)).size, 120);
  for (const [mode, bank] of [
    ['practice', practicePrompts],
    ['assessment', assessmentPrompts],
  ] as const) {
    bank.forEach((prompt, index) => {
      assert.equal(prompt.id, `${mode}-${String(index + 1).padStart(3, '0')}`);
      assert.match(prompt.text, /^[a-z]+(?: [a-z]+)+$/);
      assert.ok(prompt.text.length <= 80, prompt.id);
    });
  }
});

test('selection shuffles deterministically without replacement or bank mutation', () => {
  for (const mode of ['practice', 'assessment'] as const) {
    const bank = mode === 'practice' ? practicePrompts : assessmentPrompts;
    const originalIds = bank.map((prompt) => prompt.id);
    const selected = selectPrompts(mode, [], () => 0);
    assert.deepEqual(selected, selectPrompts(mode, [], () => 0));
    assert.notDeepEqual(selected.map((prompt) => prompt.id), originalIds);
    assert.deepEqual(selected.map((prompt) => prompt.id).sort(), [...originalIds].sort());
    assert.deepEqual(bank.map((prompt) => prompt.id), originalIds);
    assert.equal(new Set(selected.map((prompt) => prompt.id)).size, bank.length);
    assert.deepEqual(selectPrompts(mode, [], () => 0.999), bank);
  }
});

test('fresh retests exclude prior passages and report an exhausted bank honestly', () => {
  const firstRun = selectPrompts('assessment', [], () => 0).slice(0, 10);
  const usedIds = firstRun.map((prompt) => prompt.id);
  const retest = selectPrompts('assessment', usedIds, () => 0);
  assert.equal(retest.length, 30);
  assert.ok(retest.every((prompt) => !usedIds.includes(prompt.id)));
  assert.deepEqual(selectPrompts('assessment', assessmentPrompts.map((prompt) => prompt.id)), []);
  const lastPromptId = practicePrompts.at(-1)!.id;
  const nextCycle = selectPrompts('practice', [lastPromptId, 'unknown-id'], () => 0);
  assert.equal(nextCycle.length, 79);
  assert.ok(nextCycle.every((prompt) => prompt.id !== lastPromptId));
});
