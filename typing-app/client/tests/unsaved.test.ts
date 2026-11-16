import test from 'node:test';
import assert from 'node:assert/strict';
import { UnsavedResults, newSaveRecord, unsavedLine, type SaveRecord } from '../src/unsaved.ts';
import type { SessionResult } from '../src/engine.ts';

// ET-1: document-scoped, in-memory list of completed results whose save is not confirmed.
class Permanent extends Error {}
const result = (id: string) => Object.freeze({ id, mode: 'practice' }) as unknown as SessionResult;
function list(save: (r: SessionResult) => Promise<void>, stored = new Set<string>()) {
  let changes = 0;
  const unsaved = new UnsavedResults({ save, exists: async id => stored.has(id), isPermanent: error => error instanceof Permanent, onChange: () => { changes++; } });
  return { unsaved, changes: () => changes };
}
const failed = (id: string): SaveRecord => Object.assign(newSaveRecord(result(id)), { state: 'failed' as const });
const deferred = () => { let resolve!: () => void, reject!: (error: Error) => void; const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

test('consecutive unsaved results are kept in order, never overwritten, with immutable payloads', () => {
  const { unsaved } = list(async () => {});
  const first = failed('a'), second = failed('b');
  unsaved.adopt(first); unsaved.adopt(second); unsaved.adopt(first); unsaved.adopt(Object.assign(failed('a')));
  assert.deepEqual(unsaved.listed.map(entry => entry.result.id), ['a', 'b']);
  assert.equal(unsaved.listed[0]!.result, first.result);
  assert.deepEqual(unsaved.exportPayload(), [first.result, second.result]);
  assert.equal(unsavedLine(unsaved.listed, false), '2 results not saved');
  assert.equal(unsavedLine([first], false), '1 result not saved');
  assert.equal(unsavedLine([first, second], false, true), '2 results not saved. Leaving this page loses them.');
});

test('a saved record is never listed; adopting a pending record lists it only if it fails', () => {
  const { unsaved } = list(async () => {});
  const saved = Object.assign(newSaveRecord(result('s')), { state: 'saved' as const });
  unsaved.adopt(saved);
  assert.equal(unsaved.unsaved.length, 0);
  const pending = newSaveRecord(result('p'));
  unsaved.adopt(pending);
  assert.equal(unsaved.listed.length, 0, 'pending is not shown');
  assert.equal(unsaved.unsaved.length, 1, 'pending still counts as at risk');
  pending.state = 'failed'; pending.onSettled?.();
  assert.deepEqual(unsaved.listed.map(entry => entry.result.id), ['p']);
});

test('overlapping pending saves settle in either order and update only their own entry', () => {
  for (const order of [['x', 'y'], ['y', 'x']]) {
    const { unsaved } = list(async () => {});
    const records = { x: newSaveRecord(result('x')), y: newSaveRecord(result('y')) };
    unsaved.adopt(records.x); unsaved.adopt(records.y);
    const outcome = { x: 'saved', y: 'failed' } as const;
    for (const id of order as ('x' | 'y')[]) { records[id].state = outcome[id]; records[id].onSettled?.(); }
    assert.deepEqual(unsaved.listed.map(entry => entry.result.id), ['y'], `order ${order}`);
    assert.deepEqual(unsaved.unsaved.map(entry => entry.result.id), ['y']);
  }
});

test('retry is sequential oldest first and single-flight per entry', async () => {
  const calls: string[] = [];
  const gates = new Map<string, ReturnType<typeof deferred>>();
  const { unsaved } = list(r => { calls.push(r.id); const gate = deferred(); gates.set(r.id, gate); return gate.promise; });
  unsaved.adopt(failed('old')); unsaved.adopt(failed('new'));
  const first = unsaved.retry();
  const second = unsaved.retry(); // concurrent activation: nothing new starts
  await Promise.resolve();
  assert.deepEqual(calls, ['old'], 'only the oldest save is in flight');
  assert.equal(unsaved.retrying, true);
  assert.equal(unsavedLine(unsaved.listed, unsaved.retrying), '2 results not saved · saving…');
  gates.get('old')!.resolve();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(calls, ['old', 'new']);
  gates.get('new')!.reject(new Error('quota'));
  await Promise.all([first, second]);
  assert.deepEqual(calls, ['old', 'new'], 'each entry saved at most once per retry');
  assert.deepEqual(unsaved.listed.map(entry => entry.result.id), ['new']);
  assert.equal(unsaved.retrying, false);
});

test('retry stops at the first permanent refusal, which stays listed with its reason', async () => {
  const calls: string[] = [];
  const { unsaved } = list(async r => { calls.push(r.id); if (r.id === 'bad') throw new Permanent('invalid'); throw new Error('unavailable'); });
  unsaved.adopt(failed('bad')); unsaved.adopt(failed('later'));
  await unsaved.retry();
  assert.deepEqual(calls, ['bad']);
  assert.deepEqual(unsaved.listed.map(entry => [entry.result.id, entry.state]), [['bad', 'rejected'], ['later', 'failed']]);
  assert.match(unsaved.listed[0]!.reason, /validation/);
  assert.equal(unsavedLine(unsaved.listed, false), '2 results not saved · 1 failed validation; export only');
  await unsaved.retry();
  assert.deepEqual(calls, ['bad', 'later'], 'a refused entry is not retried; the next one is');
});

test('a write that landed before its error surfaced counts as saved and is not written twice', async () => {
  let saves = 0;
  const { unsaved } = list(async () => { saves++; throw new Error('late abort'); }, new Set(['landed']));
  unsaved.adopt(failed('landed'));
  await unsaved.retry();
  assert.equal(saves, 1);
  assert.equal(unsaved.listed.length, 0);
});

test('export marks entries exported without removing them; discard removes exactly the listed entries', () => {
  const { unsaved } = list(async () => {});
  const pending = newSaveRecord(result('pending'));
  unsaved.adopt(failed('one')); unsaved.adopt(pending); unsaved.adopt(failed('two'));
  unsaved.markExported();
  assert.equal(unsaved.listed.length, 2);
  assert.equal(unsavedLine(unsaved.listed, false), '2 results not saved · exported');
  assert.equal(unsaved.discard(), 2);
  assert.equal(unsaved.listed.length, 0);
  assert.deepEqual(unsaved.unsaved.map(entry => entry.result.id), ['pending'], 'discard never drops a pending save');
});

test('the departure check counts the current unsaved block once', () => {
  const { unsaved } = list(async () => {});
  const current = newSaveRecord(result('current'));
  assert.equal(unsaved.atRisk(null).length, 0);
  assert.deepEqual(unsaved.atRisk(current).map(entry => entry.result.id), ['current']);
  unsaved.adopt(current);
  assert.equal(unsaved.atRisk(current).length, 1);
  current.state = 'saved'; current.onSettled?.();
  assert.equal(unsaved.atRisk(current).length, 0, 'a save settling while held empties the list');
});

test('a permanent refusal at the head of a retry leaves the rest retryable and announces it', async () => {
  const seen: boolean[] = [];
  const unsaved: UnsavedResults = new UnsavedResults({ save: async r => { if (r.id === 'bad') throw new Permanent('invalid'); }, exists: async () => false,
    isPermanent: error => error instanceof Permanent, onChange: () => { seen.push(unsaved.retrying); } });
  unsaved.adopt(failed('bad')); unsaved.adopt(failed('next')); unsaved.adopt(failed('last'));
  await unsaved.retry();
  assert.equal(unsaved.retrying, false);
  assert.equal(seen.at(-1), false, 'the last notification already shows no save in flight (Retry re-enabled)');
  assert.deepEqual(unsaved.listed.map(entry => [entry.result.id, entry.state, entry.saving]), [['bad', 'rejected', false], ['next', 'failed', false], ['last', 'failed', false]]);
  await unsaved.retry();
  assert.equal(unsaved.listed.length, 1, 'the remaining entries retry normally afterwards');
});
