import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { foldCoachHistory, laterMeanRange, loadCoachModel, parseCoachModel, suggestion, update } from '../src/coach-model.ts';
import type { PairCounts } from '../src/engine.ts';

interface Case {
  name: string;
  sentences: { pairs: Record<string, PairCounts> }[];
  speed: number;
  ownMean: number;
  suggestion: string | null;
  laterCount: number;
  pairs: Record<string, { expected: number; gap: number; variance: number; range: [number, number] }>;
}

const model = await loadCoachModel();
const fixture: { modelSha256: string; cases: Case[] } = JSON.parse(
  readFileSync(new URL('../../../ml/fixtures/coach-parity.json', import.meta.url), 'utf8'),
);

function close(actual: number, expected: number, label: string) {
  assert.ok(Math.abs(actual - expected) <= 1e-9, `${label}: ${actual} differs from ${expected}`);
}

for (const c of fixture.cases) {
  test(`L5 Python parity: ${c.name}`, () => {
    const history = foldCoachHistory(c.sentences.map(s => ({ ...s, eligible: true, submitted: true })));
    const state = update(model, history);
    close(state.speed, c.speed, 'speed');
    close(state.ownMean, c.ownMean, 'own mean');
    assert.equal(suggestion(state, model, history.counts), c.suggestion);
    for (let p = 0; p < 676; p++) {
      const pair = String.fromCharCode(97 + Math.floor(p / 26), 97 + p % 26);
      const reference = c.pairs[pair];
      if (reference) {
        close(state.expected[p], reference.expected, pair + ' expected');
        close(state.gap[p], reference.gap, pair + ' gap');
        close(state.variance[p], reference.variance, pair + ' variance');
        const [low, high] = laterMeanRange(model, state, pair, c.laterCount);
        close(low, reference.range[0], pair + ' lower bound');
        close(high, reference.range[1], pair + ' upper bound');
      } else {
        // Omitted pairs have no observations. Their full posterior is the fitted prior at Python's pace.
        assert.equal(history.counts[p], 0, pair);
        const bound = Math.max(model.low, Math.min(model.high, c.speed));
        close(state.expected[p], model.a[p] + model.b[p] * (bound - model.center) + (c.speed - bound), pair);
        assert.equal(state.gap[p], 0, pair);
        close(state.variance[p], model.tau2[p], pair);
      }
    }
    if (c.name === 'exact-ranking-tie') {
      const scores = [13, 19].map(p => { // an and at
        assert.ok(state.gap[p] - model.COACH_Z * Math.sqrt(state.variance[p]) > model.GAP);
        return model.frequency[p] * Math.exp(state.expected[p] + model.sigma2[p] / 2) * Math.expm1(state.gap[p]);
      });
      assert.equal(scores[0], scores[1]);
      assert.equal(c.suggestion, 'an');
    }
  });
}

test('fixtures use the shipped fit and exercise support, issuance and exclusion', () => {
  assert.equal(fixture.modelSha256, model.modelSha256);
  const cases = new Map(fixture.cases.map(c => [c.name, c]));
  for (const wpm of [20, 40, 80, 120, 190]) {
    close(cases.get(`pace-${wpm}-wpm`)!.speed, Math.log(12_000 / wpm), wpm + ' WPM');
  }
  assert.ok(cases.get('pace-190-wpm')!.speed < model.low);
  assert.ok(cases.get('pace-20-wpm')!.speed > model.high);
  for (const name of ['weak-bank-pair', 'minimum-count', 'split-across-sentences']) {
    assert.equal(cases.get(name)!.suggestion, 'st');
  }
  for (const name of ['empty', 'weak-outside-bank', 'one-observation', 'small-gap']) {
    assert.equal(cases.get(name)!.suggestion, null);
  }
  assert.equal(cases.get('two-actionable')!.suggestion, 'th');
});

test('folds qualifying saved sentences and ignores malformed pair keys', () => {
  const observation = { count: 2, logSum: 8.2 };
  const pairs = {
    aa: observation, zz: observation, '': observation, a: observation, 'ab ': observation,
    'ab\n': observation, 'Ab': observation, 'aé': observation, constructor: observation,
  };
  const saved = { eligible: true, submitted: true, pairs };
  const history = foldCoachHistory([saved, { ...saved, eligible: false }, { ...saved, submitted: false }, saved]);
  assert.equal(history.counts[0], 4);
  assert.equal(history.counts[675], 4);
  close(history.logSums[0], 16.4, 'aa');
  close(history.logSums[675], 16.4, 'zz');
  assert.equal(history.counts.reduce((a, b) => a + b, 0), 8);
  close(history.logSums.reduce((a, b) => a + b, 0), 32.8, 'all log sums');
});

test('validates table shape, provenance, finite scalar and pair values', () => {
  const sparse = [...model.a];
  delete sparse[10];
  for (const invalid of [
    null, [], {}, { ...model, version: 2 }, { ...model, extra: 0 }, { ...model, modelSha256: 'oops' },
    { ...model, low: model.high + 1 }, { ...model, center: NaN }, { ...model, GAP: undefined },
    { ...model, MIN_COUNT: 1.5 }, { ...model, RANGE_Z: 0 }, { ...model, a: sparse },
    { ...model, b: model.b.slice(1) }, { ...model, a: model.a.with(675, Infinity) },
    { ...model, sigma2: model.sigma2.with(30, 0) }, { ...model, tau2: model.tau2.with(5, -1) },
    { ...model, frequency: model.frequency.with(11, -1) },
  ]) assert.throws(() => parseCoachModel(invalid));
  const raw = structuredClone(model);
  const parsed = parseCoachModel(raw);
  raw.b[0] = 999;
  assert.equal(parsed.b[0], model.b[0]);
});

test('later means require a valid pair and a positive whole number of observations', () => {
  const state = update(model, foldCoachHistory([]));
  for (const m of [0, -1, 1.5, NaN, Infinity]) {
    assert.throws(() => laterMeanRange(model, state, 'at', m), RangeError);
  }
  assert.throws(() => laterMeanRange(model, state, 'aT', 2), RangeError);
});
