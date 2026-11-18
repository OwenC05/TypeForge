import assert from 'node:assert/strict';
import test from 'node:test';
import { readHistorySlice, scanHistory, HISTORY_SLICE_ROWS, HISTORY_SCAN_ROWS, HISTORY_SLICE_BYTES, HISTORY_SCAN_BYTES } from '../src/storage.ts';

test('optional history rejects invalid budgets before opening IndexedDB', async () => {
  for (const [reader, rows, bytes] of [
    [readHistorySlice, HISTORY_SLICE_ROWS, HISTORY_SLICE_BYTES],
    [scanHistory, HISTORY_SCAN_ROWS, HISTORY_SCAN_BYTES],
  ] as const) {
    for (const rowLimit of [0, -1, 1.5, rows + 1, NaN, Infinity]) {
      await assert.rejects(reader({ rowLimit }), RangeError);
    }
    for (const byteLimit of [0, 1048575, 1048576.5, bytes + 1, NaN, Infinity]) {
      await assert.rejects(reader({ byteLimit }), RangeError);
    }
  }
});

test('unavailable optional storage returns explicit incomplete state and retained cursor', async () => {
  const before = ['2026-11-16T00:00:00.000Z', 'last-examined'];
  const output = await scanHistory({ before });
  assert.equal(output.complete, false);
  assert.equal(output.reason, 'failed');
  assert.equal(output.cursor, before);
  assert.equal(output.examinedRows, 0);
  assert.equal(output.diagnostics.unindexableRows, null, 'unavailable count is unknown, not zero');
  assert.match(output.diagnostics.error!, /unavailable/);
});

test('pre-aborted optional reads do not open storage and remain distinguishable from failure', async () => {
  const signal = AbortSignal.abort(new Error('superseded preparation'));
  for (const reader of [readHistorySlice, scanHistory]) {
    const output = await reader({ signal });
    assert.equal(output.reason, 'aborted');
    assert.equal(output.complete, false);
    assert.equal(output.examinedRows, 0);
    assert.match(output.diagnostics.error!, /superseded/);
  }
});

test('history diagnostics are per request rather than a shared mutable source', async () => {
  const first = await readHistorySlice();
  first.diagnostics.invalidRows = 123;
  const second = await readHistorySlice();
  assert.equal(second.diagnostics.invalidRows, 0);
  assert.notEqual(first.diagnostics, second.diagnostics);
});

// Narrow open-request doubles verify failure/cleanup branches. Payload traversal
// and index semantics are tested with real IndexedDB in bounded-history.ts.
function fakeOpen(t: test.TestContext) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
  const pending: any = {};
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: { open: () => pending } });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'indexedDB', original);
    else Reflect.deleteProperty(globalThis, 'indexedDB');
  });
  return pending;
}

test('abort during open settles immediately and closes a late connection', async t => {
  const pending = fakeOpen(t);
  const controller = new AbortController();
  const operation = readHistorySlice({ signal: controller.signal });
  controller.abort(new Error('navigation'));
  assert.equal((await operation).reason, 'aborted');
  let closed = 0;
  pending.result = { close: () => closed++ };
  pending.onsuccess();
  assert.equal(closed, 1);
});

test('blocked open is unavailable and any later connection is closed', async t => {
  const pending = fakeOpen(t);
  const operation = readHistorySlice();
  pending.onblocked();
  const output = await operation;
  assert.equal(output.reason, 'failed');
  assert.match(output.diagnostics.error!, /Close other TypeForge tabs/);
  let closed = 0;
  pending.result = { close: () => closed++ };
  pending.onsuccess();
  assert.equal(closed, 1);
});

test('open failure is reported without returning a complete empty history', async t => {
  const pending = fakeOpen(t);
  const operation = scanHistory();
  pending.error = new Error('fixture open error');
  pending.onerror();
  const output = await operation;
  assert.equal(output.complete, false);
  assert.equal(output.reason, 'failed');
  assert.equal(output.diagnostics.error, 'fixture open error');
});

test('transaction setup failure closes its database and preserves failure status', async t => {
  const pending = fakeOpen(t);
  let closed = 0;
  const operation = readHistorySlice();
  pending.result = { close: () => closed++, transaction: () => { throw new Error('fixture transaction error'); } };
  pending.onsuccess();
  const output = await operation;
  assert.equal(output.reason, 'failed');
  assert.equal(output.diagnostics.error, 'fixture transaction error');
  assert.equal(closed, 1);
});
