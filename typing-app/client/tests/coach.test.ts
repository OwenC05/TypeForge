import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { coachSentences, evaluateCoach, HISTORY_LIMIT, FIT_WINDOW, FIT_MIN_SENTENCES } from '../src/coach.ts';
import { foldCoachHistory, laterMeanRange, loadCoachModel, update } from '../src/coach-model.ts';
import { validateResult } from '../src/storage.ts';
import type { SessionResult } from '../src/engine.ts';

const model = await loadCoachModel();
interface FitCase {
  name: string;
  sentences: SentencePairs[];
  expected: { checks: number; inside: number }[];
}
type SentencePairs = SessionResult['sentences'][number]['pairs'];
const parity = JSON.parse(readFileSync(new URL('../../../ml/fixtures/fit-check-parity.json', import.meta.url), 'utf8')) as { modelSha256: string; cases: FitCase[] };
test('fit-check fixture pins the shipped model', () => assert.equal(parity.modelSha256, model.modelSha256));
for (const c of parity.cases) {
  test('Python fit-check parity: ' + c.name, () => {
    let checks = 0, inside = 0;
    const history = c.sentences.map(pairs => ({ eligible: true, submitted: true, pairs }));
    for (let i = 0; i < history.length; i++) {
      const { fit } = evaluateCoach(model, history.slice(0, i + 1));
      assert.deepEqual({ checks: fit.checks - checks, inside: fit.inside - inside }, c.expected[i]);
      ({ checks, inside } = fit);
    }
  });
}

const mainShape = JSON.parse(readFileSync(new URL('./fixtures/legacy-v1.json', import.meta.url), 'utf8')) as SessionResult;

test('existing assessments and unmarked General contribute from their saved QWERTY settings and pair summaries', () => {
  for (const mode of ['assessment', 'practice'] as const) {
    const source = { ...mainShape, mode };
    validateResult(source);
    assert.deepEqual(coachSentences(source).map(s => s.pairs), source.sentences.map(s => s.pairs));
    assert.deepEqual(coachSentences({ ...source, settings: { ...source.settings, qwerty: false } }), []);
    for (const flag of ['interrupted', 'invalid-input'] as const) {
      assert.deepEqual(coachSentences({ ...source, qualityFlags: [flag] }), []);
    }
  }
});

test('both generations of Suggested and manual Pair are drills, and current-format siblings survive the sentence filter', () => {
  const general = { ...mainShape, mode: 'practice' as const };
  for (const marker of [
    { practiceFocus: { source: 'model', pair: 'th' } },
    { practiceFocus: { source: 'baseline', pair: 'th', score: 1, baselineVersion: 'v1', evidenceCount: 8 } },
    { manualDrill: { source: 'manual', pair: 'th' } },
  ] as const) {
    validateResult({ ...general, ...marker });
    assert.deepEqual(coachSentences({ ...general, ...marker }), []);
  }
  const s = general.sentences[0]!;
  const bad = { ...s, pairs: { th: { count: 1, sum: 123 } } };
  assert.deepEqual(coachSentences({ ...general, sentences: [s, { ...s, submitted: false }, { ...s, eligible: false }, bad as unknown as typeof s] }).map(sentence => sentence.pairs), [s.pairs]);
});

test('exactly 70% coverage permits suggestions and below 70% stops them', () => {
  for (const hits of [6, 7]) {
    const history = [{ eligible: true, submitted: true, pairs: { th: { count: 1, logSum: model.center } } }];
    for (let i = 0; i < 10; i++) {
      const state = update(model, foldCoachHistory(history));
      const [low, high] = laterMeanRange(model, state, 'th', 1);
      history.push({ eligible: true, submitted: true, pairs: { th: { count: 1, logSum: i < hits ? (low + high) / 2 : high + 1 } } });
    }
    assert.deepEqual(evaluateCoach(model, history).fit,
      { inside: hits, checks: 10, sentences: 10, coverage: hits / 10, stopped: hits < 7 });
  }
});

test('empty pairs supply no check and the earliest recent check sees all 200 previous evidence sentences', () => {
  const row = (pairs: SentencePairs) => ({ eligible: true, submitted: true, pairs });
  const history = Array.from({ length: 200 }, (_, i) => row({ th: { count: 20, logSum: 20 * (i < 55 ? 2 : 6) } }));
  const [low, high] = laterMeanRange(model, update(model, foldCoachHistory(history)), 'th', 1);
  const mean = (low + high) / 2;
  const [truncatedLow] = laterMeanRange(model, update(model, foldCoachHistory(history.slice(39))), 'th', 1);
  assert.ok(mean < truncatedLow, 'cutting the entire input to 200 would miss this checked sentence');
  history.push(row({ th: { count: 1, logSum: mean } }));
  for (let i = 0; i < 19; i++) {
    history.push(row({}));
    const range = laterMeanRange(model, update(model, foldCoachHistory(history.slice(-200))), 'er', 1);
    history.push(row({ er: { count: 1, logSum: range[1] + 1 } }));
  }
  assert.deepEqual(evaluateCoach(model, history).fit, { inside: 1, checks: 20, sentences: 20, coverage: 0.05, stopped: true });
});

test('decision uses exactly the latest 200 sentences and displays up to three positive gaps with two observations', () => {
  const history = Array.from({ length: HISTORY_LIMIT + 15 }, (_, index) => ({
    eligible: true, submitted: true, pairs: { th: { count: 8, logSum: 8 * (index < 15 ? 1 : 6) }, er: { count: 9, logSum: 40 } },
  }));
  const actual = evaluateCoach(model, history);
  const last = foldCoachHistory(history.slice(-200));
  assert.equal(actual.speed, update(model, last).speed);
  assert.ok(actual.gaps.length <= 3 && actual.gaps.every(g => g.gap > 0 && g.count >= 2));
  assert.equal(actual.fit.sentences, FIT_WINDOW);
  assert.equal(actual.fit.checks, 2 * FIT_WINDOW);
  const short = evaluateCoach(model, history.slice(0, FIT_MIN_SENTENCES));
  assert.equal(short.fit.sentences, FIT_MIN_SENTENCES - 1);
  assert.equal(short.fit.stopped, false);
  assert.equal(evaluateCoach(model, []).speed, null);
});
