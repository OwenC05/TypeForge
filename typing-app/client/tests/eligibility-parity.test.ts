import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { DURATION_MS, TypingEngine, type PairCounts } from '../src/engine.ts';

interface Event {
  kind: string;
  t?: number;
  text?: string;
  repeat?: boolean;
  start?: number;
  end?: number;
}

interface Fixture {
  name: string;
  target: string;
  final: string;
  qwerty?: boolean;
  submitted?: boolean;
  events: Event[];
  expected: { reason: string | null; intervals: { pair: string; ms: number }[] };
}

const { cases }: { cases: Fixture[] } = JSON.parse(
  readFileSync(new URL('../../../ml/fixtures/eligibility-v2.json', import.meta.url), 'utf8'),
);

const knownDifferences: Record<string, { a2Reason: string; savedPairs: string[] }> = {
  // A2 drops the sentence after a physical Backspace on an empty buffer.
  'backspace-on-empty-buffer': { a2Reason: 'clean-copy-required', savedPairs: ['su', 'un'] },
  // A2 drops the sentence after a forward Delete at the end of the response.
  'forward-delete': { a2Reason: 'unsupported-edit', savedPairs: ['sa', 'an', 'nd'] },
};

for (const fixture of cases) {
  const difference = knownDifferences[fixture.name];
  test(`${difference ? 'Known A2 difference' : 'A2 eligibility'}: ${fixture.name}`, t => {
    const options = {
      id: fixture.name, prompts: [{ id: 'fixture', text: fixture.target }], qwerty: fixture.qwerty ?? true,
    };
    if (!fixture.target || /[^a-z ]/.test(fixture.target)) {
      assert.throws(() => new TypingEngine(options), RangeError);
      return t.skip('The engine admits only nonempty lowercase ASCII prompts and spaces.');
    }
    if (fixture.name === 'replay-conflicts-with-final') {
      return t.skip('The engine has no independently recorded final string.');
    }
    if (fixture.events.some(e => e.kind === 'moveCursor' || e.kind === 'modifier')) {
      return t.skip('The engine receives text edits, with no standalone caret or modifier event.');
    }

    const engine = new TypingEngine(options);
    let now = 0;
    for (const e of fixture.events) {
      // The delivery clock is monotonic even when the recorded keydown is missing or out of order.
      now = Math.max(now, e.t ?? now);
      const tail = engine.value.length;
      switch (e.kind) {
        case 'insert':
        case 'replaceSelection':
          engine.edit({ start: e.start ?? tail, end: e.end ?? tail, text: e.text!, pressTime: e.t, repeat: e.repeat }, now);
          break;
        case 'deleteBackward':
          engine.edit({ start: Math.max(0, tail - 1), end: tail, text: '' }, now);
          break;
        case 'deleteWordBackward':
        case 'deleteForward':
          engine.edit({ start: e.start!, end: e.end!, text: '' }, now);
          break;
        case 'untracked':
          if (e.text === undefined) engine.interrupt(now);
          else engine.edit({ start: tail, end: tail, text: e.text, tracked: false, composing: true }, now);
          break;
        case 'shift':
          break;
        default:
          assert.fail(`Unmapped fixture event: ${e.kind}`);
      }
    }
    assert.equal(engine.value, fixture.final);
    if (fixture.submitted !== false) assert.equal(engine.submit(now + 1), true);
    engine.tick(now + DURATION_MS + 1);
    const sentence = engine.result('2026-01-01T00:00:00Z')!.sentences[0];
    if (difference) {
      assert.deepEqual(fixture.expected, { reason: difference.a2Reason, intervals: [] });
      assert.equal(sentence.eligible, true);
      assert.deepEqual(sentence.pairs, Object.fromEntries(
        difference.savedPairs.map(pair => [pair, { count: 1, logSum: Math.log(100) }]),
      ));
      return;
    }
    assert.equal(sentence.eligible, fixture.expected.reason === null);
    const expected: Record<string, PairCounts> = {};
    for (const { pair, ms } of fixture.expected.intervals) {
      const stats = expected[pair] ??= { count: 0, logSum: 0 };
      stats.count++;
      stats.logSum += Math.log(ms);
    }
    assert.deepEqual(Object.keys(sentence.pairs).sort(), Object.keys(expected).sort());
    for (const [pair, stats] of Object.entries(expected)) {
      assert.equal(sentence.pairs[pair].count, stats.count, pair);
      assert.ok(Math.abs(sentence.pairs[pair].logSum - stats.logSum) <= 1e-9, pair);
    }
  });
}
