import test from 'node:test';
import assert from 'node:assert/strict';
import { UnsavedResults, newSaveRecord, unsavedLine, applyOutcome, exportDocument, rejectedReason, type SaveRecord } from '../src/unsaved.ts';
import type { Capture, Persistence, SavedSource } from '../src/coach-types.ts';

// ET-1: document-scoped, in-memory list of completed sources whose save is not confirmed.
// The fake stands in for C's fenced saveSource: it reports a Persistence and never throws.
const result = (id: string) => Object.freeze({ id, mode: 'practice' }) as unknown as SavedSource;
const finite = (id: string) => Object.freeze({ id, schemaId: 'typeforge-finite-practice-result-v1', mode: 'practice' }) as unknown as SavedSource;
const capture = Object.freeze({ databaseId: 'db', contextId: 'ctx', epochId: 'ep', capturedAt: '2026-11-18T09:00:00.000Z', purpose: 'ordinary' }) as unknown as Capture;
const saved = (source: SavedSource, membershipReady = true): Persistence => ({ state: 'saved', pendingIds: [], sourceId: source.id, sourceHash: `hash:${source.id}`, sourceSaved: true, membershipReady });
const failure = (source: SavedSource, retryable: boolean, cap: Capture | null = null): Persistence => ({ state: 'failed', pendingIds: [source.id], sourceId: source.id, capture: cap, sourceSaved: false, membershipReady: false, retryable });
type Save = (source: SavedSource, capture: Capture | null) => Promise<Persistence>;
function list(save: Save) {
  let changes = 0;
  const unsaved = new UnsavedResults({ save, onChange: () => { changes++; } });
  return { unsaved, changes: () => changes };
}
const failed = (id: string, cap: Capture | null = null): SaveRecord => Object.assign(newSaveRecord(result(id), cap), { state: 'failed' as const });
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
    const records = { x: newSaveRecord(result('x')), y: newSaveRecord(finite('y')) };
    unsaved.adopt(records.x); unsaved.adopt(records.y);
    const outcome = { x: saved(records.x.source), y: failure(records.y.source, true) };
    for (const id of order as ('x' | 'y')[]) { applyOutcome(records[id], outcome[id]); records[id].onSettled?.(); }
    assert.deepEqual(unsaved.listed.map(entry => entry.source.id), ['y'], `order ${order}`);
    assert.deepEqual(unsaved.unsaved.map(entry => entry.source.id), ['y']);
  }
});

test('retry is sequential oldest first, single-flight per entry, and always reuses the original capture', async () => {
  const calls: [string, Capture | null][] = [];
  const gates = new Map<string, ReturnType<typeof deferred>>();
  const { unsaved } = list((source, cap) => { calls.push([source.id, cap]); const gate = deferred(); gates.set(source.id, gate); return gate.promise; });
  unsaved.adopt(failed('old', capture)); unsaved.adopt(failed('new'));
  const first = unsaved.retry();
  const second = unsaved.retry(); // concurrent activation: nothing new starts
  await Promise.resolve();
  assert.deepEqual(calls.map(call => call[0]), ['old'], 'only the oldest save is in flight');
  assert.equal(calls[0]![1], capture, 'the very capture taken before the first insertion, never a fresh one');
  assert.equal(unsaved.retrying, true);
  assert.equal(unsavedLine(unsaved.listed, unsaved.retrying), '2 results not saved · saving…');
  gates.get('old')!.resolve(saved(result('old')));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(calls.map(call => call[0]), ['old', 'new']);
  assert.equal(calls[1]![1], null, 'an uncaptured run stays uncaptured on retry');
  gates.get('new')!.resolve(failure(result('new'), true));
  await Promise.all([first, second]);
  assert.deepEqual(calls.map(call => call[0]), ['old', 'new'], 'each entry saved at most once per retry');
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

// Replaces the old exists(id)-after-error shortcut: whether a stored copy counts as this save is decided
// by the fenced save's content/hash and membership checks, never by the id alone.
test('reconciliation comes from the fenced save outcome, never from an id lookup', async () => {
  const stored = new Map<string, string>([['landed', 'same'], ['clash', 'other']]);
  const calls: string[] = [];
  const { unsaved } = list(async source => {
    calls.push(source.id);
    const prior = stored.get(source.id);
    if (prior === undefined || prior === 'same') return saved(source, prior !== 'same');
    return failure(source, false); // a different stored copy under the same id is refused, not adopted
  });
  const landed = failed('landed', capture), clash = failed('clash', capture);
  unsaved.adopt(landed); unsaved.adopt(clash);
  await unsaved.retry();
  assert.deepEqual(calls, ['landed', 'clash'], 'one fenced attempt each');
  assert.equal(landed.state, 'saved', 'an identical stored copy reconciles as saved');
  assert.deepEqual([landed.persistence?.state, landed.persistence?.state === 'saved' && landed.persistence.membershipReady], ['saved', false],
    'source saved is kept distinct from membership ready');
  assert.equal(clash.state, 'rejected', 'an id that exists with other content is never treated as this save');
  assert.equal(clash.reason, rejectedReason);
  assert.deepEqual(unsaved.listed.map(entry => entry.source.id), ['clash']);
});

test('a save that throws (outside the fence contract) is a retryable failure, not a silent success', async () => {
  const { unsaved } = list(async () => { throw new Error('unexpected'); });
  const entry = failed('throws');
  unsaved.adopt(entry);
  await unsaved.retry();
  assert.equal(entry.state, 'failed');
  assert.equal(entry.persistence, null);
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

test('mixed exports use the separate source envelope; timed-only exports keep the existing array', () => {
  const timed = [result('t1'), result('t2')];
  assert.deepEqual(exportDocument(timed), timed);
  const mixed = exportDocument([result('t1'), finite('f1')]);
  assert.ok(!Array.isArray(mixed));
  if (!Array.isArray(mixed)) {
    assert.equal(mixed.schemaId, 'typeforge-saved-sources-export-v1');
    assert.deepEqual(mixed.sources.map(source => source.id), ['t1', 'f1']);
    assert.deepEqual(Object.keys(mixed).sort(), ['schemaId', 'sources'], 'no authority metadata');
  }
});

test('pending sources carry the original capture and never claim durability', () => {
  const { unsaved } = list(async source => saved(source));
  const carried = failed('carried', capture);
  const current = newSaveRecord(finite('current'), null);
  unsaved.adopt(carried);
  const pending = unsaved.pendingSources(current);
  assert.deepEqual(pending.map(entry => [entry.source.id, entry.state, entry.capture, entry.durablySaved]),
    [['carried', 'failed', capture, false], ['current', 'pending', null, false]]);
});

test('an unsaved baseline test says it does not count, with its frozen ordinal', () => {
  const test4 = Object.assign(newSaveRecord(result('b4'), capture, { test: 4, baseline: true }), { state: 'failed' as const });
  assert.equal(unsavedLine([test4], false), 'Test 4 isn’t saved yet, so it doesn’t count');
  const unnumbered = Object.assign(newSaveRecord(result('b'), capture, { baseline: true }), { state: 'failed' as const });
  assert.equal(unsavedLine([unnumbered], false), 'Your last test isn’t saved yet, so it doesn’t count');
  assert.equal(unsavedLine([test4, unnumbered], false), '2 tests aren’t saved yet, so they don’t count');
  assert.equal(unsavedLine([test4, failed('practice')], false), '2 results not saved');
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
