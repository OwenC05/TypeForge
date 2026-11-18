import assert from 'node:assert/strict';
import test from 'node:test';
import { createPreparationLedger, canonicalJSON, sourceHash, captureContext, resetEpoch,
  listSavedSourcesPage, invalidatePreparations, subscribeStorageInvalidation } from '../src/coach-storage.ts';
import { historyJsonBytes } from '../src/storage.ts';
import type { SavedSource } from '../src/coach-types.ts';

test('canonical source hashes bind complete values with stable property order', async () => {
  assert.equal(canonicalJSON({ b: 2, a: [null, 'é'] }), '{"a":[null,"é"],"b":2}');
  const first = await sourceHash({ a: 1, b: [2] } as unknown as SavedSource);
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(first, await sourceHash({ b: [2], a: 1 } as unknown as SavedSource));
  assert.notEqual(first, await sourceHash({ b: [3], a: 1 } as unknown as SavedSource));
});

test('one ledger charges missing and failed attempts and never resets a terminal stop', () => {
  const ledger = createPreparationLedger({ rowLimit: 3 });
  assert(ledger.reserve('metadata', 4096)); ledger.settle(0, null);
  assert(ledger.reserve('membership', 4096)); ledger.settle(0, null);
  assert.equal(ledger.work.examinedRows, 2);
  assert(ledger.reserve('source', 1048576)); ledger.settle(17, 'record-limit');
  assert.equal(ledger.terminal, 'record-limit');
  assert.equal(ledger.work.examinedBytes, 17);
  for (let n = 0; n < 4; n++) assert.equal(ledger.reserve('metadata', 4096), false);
  assert.equal(ledger.work.examinedRows, 3);
});

test('reservations include concurrent companion capacity and release unused bytes', () => {
  const ledger = createPreparationLedger({ byteLimit: 8192 });
  assert(ledger.reserve('metadata', 4096));
  assert(ledger.reserve('membership', 4096));
  ledger.settle(64, null); ledger.settle(64, null);
  assert(ledger.reserve('metadata', 4096)); ledger.settle(0, 'failure');
  assert.equal(ledger.work.examinedBytes, 128);
  assert.equal(ledger.work.examinedRows, 3);
  assert.equal(ledger.terminal, 'failure');
});

test('a cooperative slice cannot issue a 26th point even with zero-byte results', () => {
  const ledger = createPreparationLedger();
  for (let n = 0; n < 25; n++) { assert(ledger.reserve('membership', 4096)); ledger.settle(0, null); }
  assert.equal(ledger.reserve('metadata', 4096), false);
  assert.equal(ledger.terminal, null, 'slice limit is resumable within the existing ledger');
  assert.equal(ledger.work.examinedRows, 25);
});

test('prefix traversal matches native JSON bytes and stops actual inspection at either ceiling', () => {
  for (const value of [{ a: '\u0000\n"\\é😀\ud800' }, [1, -0, 1e100, null], { z: [] }]) {
    const measured = historyJsonBytes(value);
    assert.equal(measured.bytes, new TextEncoder().encode(JSON.stringify(value)).length);
    assert.equal(measured.oversized, false);
  }
  const huge = { a: 'x'.repeat(2 * 1048576) };
  assert.deepEqual(historyJsonBytes(huge, 4096), { bytes: 4096, oversized: true, error: null });
  assert.deepEqual(historyJsonBytes(huge), { bytes: 1048576, oversized: true, error: null });
  const cycle: any = {}; cycle.a = cycle;
  assert.match(historyJsonBytes(cycle).error!, /cyclic/);
  assert.match(historyJsonBytes({ value: new Date() }).error!, /non-JSON object/);
});

test('invalid custom allowances and invalid point settlements fail explicitly', () => {
  for (const options of [{ rowLimit: 0 }, { rowLimit: 501 }, { byteLimit: 4095 }, { byteLimit: Infinity }])
    assert.throws(() => createPreparationLedger(options), RangeError);
  const ledger = createPreparationLedger();
  assert.throws(() => ledger.settle(0, null));
  assert.throws(() => ledger.reserve('source', 1048577), RangeError);
  assert(ledger.reserve('metadata', 4096));
  assert.throws(() => ledger.settle(4097, null));
});

test('unavailable and cancelled storage cannot synthesize capture, reset or exhaustion', async () => {
  assert.equal(await captureContext(), null);
  assert.equal(await captureContext(AbortSignal.abort()), null);
  const reset = await resetEpoch('missing');
  assert.equal(reset.committed, false); assert.equal(reset.authority, null);
  const ledger = createPreparationLedger();
  const page = await listSavedSourcesPage({ cursor: null, ledger, signal: AbortSignal.abort() });
  assert.equal(page.stop, 'aborted'); assert.equal(page.complete, false);
  assert.equal(ledger.work.examinedRows, 0);
});

test('invalidation subscribers receive local lifecycle invalidation without a browser', () => {
  let calls = 0; const dispose = subscribeStorageInvalidation(() => { calls++; });
  invalidatePreparations(); assert.equal(calls, 1);
  dispose(); invalidatePreparations(); assert.equal(calls, 1);
});
