import assert from 'node:assert/strict';
import test from 'node:test';
import { findSavedPrompt, manualPairs, selectAssessmentPrompts, selectPairPrompts } from '../src/corpus-v2.ts';
import assessmentV2 from '../src/generated/assessment-bank-v2.json' with { type: 'json' };
import practiceV2 from '../src/generated/practice-bank-v2.json' with { type: 'json' };
import { resolveRetest } from '../src/profile.ts';
import { TypingEngine } from '../src/engine.ts';
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

test('shared shuffle defensively copies custom practice banks', async () => {
  const { shufflePrompts } = await import('../src/corpus.ts');
  const bank = [{id:'a',text:'aa'},{id:'b',text:'bb'}];
  const shuffled = shufflePrompts(bank, () => 0);
  assert.deepEqual(shuffled.map(p=>p.id), ['b','a']);
  shuffled[0].text='changed';assert.equal(bank[1].text,'bb');
});

test('each stored ID resolves to its original text and mode across all four banks', () => {
  for (const [mode, bank] of [
    ['assessment', [...assessmentPrompts, ...assessmentV2.sentences]],
    ['practice', [...practicePrompts, ...practiceV2.sentences]],
  ] as const) {
    for (const prompt of bank) {
      assert.deepEqual(findSavedPrompt(mode, prompt.id), prompt);
      assert.equal(findSavedPrompt(mode === 'practice' ? 'assessment' : 'practice', prompt.id), undefined);
    }
  }
  assert.equal(findSavedPrompt('assessment', 'tatoeba-unknown'), undefined);
});

test('retests keep a v1 or v2 origin, exclude its partial passage and use fresh v2 IDs', () => {
  for (const prompt of [assessmentPrompts[0]!, assessmentV2.sentences[0]!]) {
    const engine = new TypingEngine({ id: 'origin', prompts: [prompt], mode: 'assessment',
      durationMs: 30000, inputMode: 'flow-v1', corpusVersion: CORPUS_VERSION });
    engine.edit({ start: 0, end: 0, text: prompt.text[0]!, tracked: true, pressTime: 0 }, 0);
    engine.tick(30000);
    const origin = engine.result('2026-11-24T12:00:00.000Z')!;
    assert.equal(origin.sentences[0].submitted, false);
    const retest = resolveRetest(origin, origin.settings, assessmentV2.sentences);
    assert.ok(retest.kind === 'retest');
    assert.equal(retest.sourceAssessmentId, origin.id);
    assert.deepEqual(retest.excludedPromptIds, [prompt.id]);
    const next = selectAssessmentPrompts(retest.excludedPromptIds, () => 0);
    assert.deepEqual(new Set(next.map(p => p.id)), new Set(assessmentV2.sentences.filter(p => p.id !== prompt.id).map(p => p.id)));
  }
  const allIds = assessmentV2.sentences.map(p => p.id);
  assert.deepEqual(selectAssessmentPrompts([...allIds, assessmentPrompts[0]!.id]), []);
  assert.deepEqual(selectAssessmentPrompts(allIds.slice(1)), [assessmentV2.sentences[0]]);
});

test('all 100 picker choices shuffle exactly the v2 passages at twice their assessment density', () => {
  assert.equal(new Set(manualPairs).size, 100);
  assert.deepEqual(manualPairs, manualPairs.toSorted());
  const pairOnly: Readonly<Record<string, string>> = practiceV2.pairOnly;
  const characters = assessmentV2.sentences.reduce((sum, p) => sum + p.text.length, 0);
  for (const pair of manualPairs) {
    const pattern = new RegExp(`(?=${pair})`, 'g'); // count overlapping within-word pairs
    const hits = (text: string) => [...text.matchAll(pattern)].length;
    const assessed = assessmentV2.sentences.reduce((sum, p) => sum + hits(p.text), 0);
    const expected = practiceV2.sentences.filter(p => (!pairOnly[p.id] || pairOnly[p.id] === pair)
      && hits(p.text) > 0 && hits(p.text) * characters >= 2 * assessed * p.text.length);
    const selected = selectPairPrompts(pair, () => 0);
    assert.ok(expected.length >= 16, pair);
    assert.equal(selected.length, expected.length);
    assert.deepEqual(new Set(selected.map(p => p.id)), new Set(expected.map(p => p.id)));
    assert.notDeepEqual(selected, expected);
  }
  assert.deepEqual(selectPairPrompts('zz'), []);
});
