import test from 'node:test';
import assert from 'node:assert/strict';
import { UnsavedResults, newSaveRecord, unsavedLine, applyOutcome, rejectedReason, type SaveRecord } from '../src/unsaved.ts';
import type { Persistence } from '../src/storage.ts';
import type { SessionResult } from '../src/engine.ts';

const result = (id: string) => Object.freeze({ id, mode: 'practice' }) as unknown as SessionResult;
const saved = (source: SessionResult): Persistence => ({ state: 'saved', sourceId: source.id });
const failure = (source: SessionResult, retryable: boolean): Persistence => ({ state: 'failed', sourceId: source.id, retryable });
type Save = (source: SessionResult) => Promise<Persistence>;
function list(save: Save) {
  let changes = 0;
  const unsaved = new UnsavedResults({ save, onChange: () => { changes++; } });
  return { unsaved, changes: () => changes };
}
const failed = (id: string): SaveRecord => Object.assign(newSaveRecord(result(id)), { state: 'failed' as const });
const deferred = () => { let resolve!: (value: Persistence) => void; const promise = new Promise<Persistence>(yes => { resolve = yes; }); return { promise, resolve }; };

test('consecutive unsaved sources are kept in order, never overwritten, with immutable payloads', () => {
  const { unsaved } = list(async source => saved(source));
  const first = failed('a'), second = failed('b');
  unsaved.adopt(first); unsaved.adopt(second); unsaved.adopt(first); unsaved.adopt(Object.assign(failed('a')));
  assert.deepEqual(unsaved.listed.map(entry => entry.source.id), ['a', 'b']);
  assert.equal(unsaved.listed[0]!.source, first.source);
  assert.deepEqual(unsaved.exportPayload(), [first.source, second.source]);
  assert.equal(unsavedLine(unsaved.listed, false), '2 results not saved');
  assert.equal(unsavedLine([first], false), '1 result not saved');
  assert.equal(unsavedLine([first, second], false, true), '2 results not saved. Leaving this page loses them.');
});

test('a saved record is never listed; adopting a pending record lists it only if it fails', () => {
  const { unsaved } = list(async source => saved(source));
  const done = Object.assign(newSaveRecord(result('s')), { state: 'saved' as const });
  unsaved.adopt(done);
  assert.equal(unsaved.unsaved.length, 0);
  const pending = newSaveRecord(result('p'));
  unsaved.adopt(pending);
  assert.equal(unsaved.listed.length, 0, 'pending is not shown');
  assert.equal(unsaved.unsaved.length, 1, 'pending still counts as at risk');
  pending.state = 'failed'; pending.onSettled?.();
  assert.deepEqual(unsaved.listed.map(entry => entry.source.id), ['p']);
});

test('overlapping pending saves settle in either order and update only their own entry', () => {
  for (const order of [['x', 'y'], ['y', 'x']]) {
    const { unsaved } = list(async source => saved(source));
    const records = { x: newSaveRecord(result('x')), y: newSaveRecord(result('y')) };
    unsaved.adopt(records.x); unsaved.adopt(records.y);
    const outcome = { x: saved(records.x.source), y: failure(records.y.source, true) };
    for (const id of order as ('x' | 'y')[]) { applyOutcome(records[id], outcome[id]); records[id].onSettled?.(); }
    assert.deepEqual(unsaved.listed.map(entry => entry.source.id), ['y'], `order ${order}`);
    assert.deepEqual(unsaved.unsaved.map(entry => entry.source.id), ['y']);
  }
});

test('retry is sequential oldest first, single-flight per entry, and always reuses the saved payload', async () => {
  const calls: string[] = [];
  const gates = new Map<string, ReturnType<typeof deferred>>();
  const { unsaved } = list(source => { calls.push(source.id); const gate = deferred(); gates.set(source.id, gate); return gate.promise; });
  unsaved.adopt(failed('old')); unsaved.adopt(failed('new'));
  const first = unsaved.retry();
  const second = unsaved.retry(); // concurrent activation: nothing new starts
  await Promise.resolve();
  assert.deepEqual(calls, ['old'], 'only the oldest save is in flight');
  assert.equal(unsaved.retrying, true);
  assert.equal(unsavedLine(unsaved.listed, unsaved.retrying), '2 results not saved · saving…');
  gates.get('old')!.resolve(saved(result('old')));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(calls, ['old', 'new']);
  gates.get('new')!.resolve(failure(result('new'), true));
  await Promise.all([first, second]);
  assert.deepEqual(calls, ['old', 'new'], 'each entry saved at most once per retry');
  assert.deepEqual(unsaved.listed.map(entry => entry.source.id), ['new']);
  assert.equal(unsaved.retrying, false);
});

test('retry stops at the first permanent refusal, which stays listed with its reason', async () => {
  const calls: string[] = [];
  const { unsaved } = list(async source => { calls.push(source.id); return failure(source, source.id !== 'bad'); });
  unsaved.adopt(failed('bad')); unsaved.adopt(failed('later'));
  await unsaved.retry();
  assert.deepEqual(calls, ['bad']);
  assert.deepEqual(unsaved.listed.map(entry => [entry.source.id, entry.state]), [['bad', 'rejected'], ['later', 'failed']]);
  assert.match(unsaved.listed[0]!.reason, /validation/);
  assert.equal(unsavedLine(unsaved.listed, false), '2 results not saved · 1 failed validation; export only');
  await unsaved.retry();
  assert.deepEqual(calls, ['bad', 'later'], 'a refused entry is not retried; the next one is');
});

test('reconciliation comes from the storage outcome, never from an id lookup', async () => {
  const stored = new Map<string, string>([['landed', 'same'], ['clash', 'other']]);
  const calls: string[] = [];
  const { unsaved } = list(async source => {
    calls.push(source.id);
    const prior = stored.get(source.id);
    if (prior === undefined || prior === 'same') return saved(source);
    return failure(source, false); // a different stored copy under the same id is refused, not adopted
  });
  const landed = failed('landed'), clash = failed('clash');
  unsaved.adopt(landed); unsaved.adopt(clash);
  await unsaved.retry();
  assert.deepEqual(calls, ['landed', 'clash'], 'one save attempt each');
  assert.equal(landed.state, 'saved', 'an identical stored copy reconciles as saved');
  assert.equal(clash.state, 'rejected', 'an id that exists with other content is never treated as this save');
  assert.equal(clash.reason, rejectedReason);
  assert.deepEqual(unsaved.listed.map(entry => entry.source.id), ['clash']);
});

test('an unexpected save exception keeps the entry retryable', async () => {
  const { unsaved } = list(async () => { throw new Error('unexpected'); });
  const entry = failed('throws');
  unsaved.adopt(entry);
  await unsaved.retry();
  assert.equal(entry.state, 'failed');
  assert.equal(entry.state, 'failed');
  assert.equal(unsaved.retrying, false);
});

test('export marks entries exported without removing them; discard removes exactly the listed entries', () => {
  const { unsaved } = list(async source => saved(source));
  const pending = newSaveRecord(result('pending'));
  unsaved.adopt(failed('one')); unsaved.adopt(pending); unsaved.adopt(failed('two'));
  unsaved.markExported();
  assert.equal(unsaved.listed.length, 2);
  assert.equal(unsavedLine(unsaved.listed, false), '2 results not saved · exported');
  assert.equal(unsaved.discard(), 2);
  assert.equal(unsaved.listed.length, 0);
  assert.deepEqual(unsaved.unsaved.map(entry => entry.source.id), ['pending'], 'discard never drops a pending save');
});

test('the departure check counts the current unsaved block once', () => {
  const { unsaved } = list(async source => saved(source));
  const current = newSaveRecord(result('current'));
  assert.equal(unsaved.atRisk(null).length, 0);
  assert.deepEqual(unsaved.atRisk(current).map(entry => entry.source.id), ['current']);
  unsaved.adopt(current);
  assert.equal(unsaved.atRisk(current).length, 1);
  current.state = 'saved'; current.onSettled?.();
  assert.equal(unsaved.atRisk(current).length, 0, 'a save settling while held empties the list');
});

test('a permanent refusal at the head of a retry leaves the rest retryable and announces it', async () => {
  const seen: boolean[] = [];
  const unsaved: UnsavedResults = new UnsavedResults({ save: async source => source.id === 'bad' ? failure(source, false) : saved(source),
    onChange: () => { seen.push(unsaved.retrying); } });
  unsaved.adopt(failed('bad')); unsaved.adopt(failed('next')); unsaved.adopt(failed('last'));
  await unsaved.retry();
  assert.equal(unsaved.retrying, false);
  assert.equal(seen.at(-1), false, 'the last notification already shows no save in flight (Retry re-enabled)');
  assert.deepEqual(unsaved.listed.map(entry => [entry.source.id, entry.state, entry.saving]), [['bad', 'rejected', false], ['next', 'failed', false], ['last', 'failed', false]]);
  await unsaved.retry();
  assert.equal(unsaved.listed.length, 1, 'the remaining entries retry normally afterwards');
});
