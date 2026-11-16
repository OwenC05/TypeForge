import {
  readHistorySlice, scanHistory, listResultsPage, getStorageDiagnostics,
  HISTORY_SLICE_BYTES, HISTORY_SCAN_BYTES, type HistoryRead,
} from '../../src/storage.ts';
import type { SessionResult } from '../../src/engine.ts';

const MIB = 1048576;
const size = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;
const id = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;
function valid(n: number): SessionResult {
  return {
    id: id(n), owner: 'guest', schemaVersion: 1, metricVersion: 1,
    completedAt: '2026-11-16T00:00:00.000Z', mode: 'practice',
    settings: { durationMs: 30000, inputMode: 'flow-v1', language: 'en', qwerty: true, corpusVersion: 'fixture' },
    qualityFlags: [], eligibleForProgress: true,
    metrics: { elapsedMs: 30000, correctCharacters: 0, attemptedCharacters: 0, correctAttempts: 0, accuracy: null, deletedCharacters: 0, wpm: 0 },
    sentences: [], chartSamples: [{ elapsedMs: 30000, wpm: 0, accuracy: null }],
  };
}
function padded(n: number, bytes: number) {
  const value = { id: id(n), completedAt: valid(n).completedAt, pad: '' };
  value.pad = 'x'.repeat(bytes - size(value));
  return value;
}
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const pending = indexedDB.open('typeforge', 2);
    pending.onupgradeneeded = () => {
      const store = pending.result.createObjectStore('results', { keyPath: 'id' });
      store.createIndex('completedAt-id', ['completedAt', 'id']);
    };
    pending.onerror = () => reject(pending.error);
    pending.onsuccess = () => resolve(pending.result);
  });
}
async function seed(values: unknown[]) {
  const database = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('results', 'readwrite');
      const store = transaction.objectStore('results');
      store.clear();
      values.forEach(value => store.put(value));
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
    });
  } finally { database.close(); }
}
async function storedCount() {
  const database = await open();
  try {
    return await new Promise<number>((resolve, reject) => {
      const pending = database.transaction('results', 'readonly').objectStore('results').count();
      pending.onsuccess = () => resolve(pending.result);
      pending.onerror = () => reject(pending.error);
    });
  } finally { database.close(); }
}

async function withFixedWorkClock<T>(operation: () => Promise<T>): Promise<T> {
  // Isolate row/byte budgets from the independent elapsed-work yield policy.
  const original = Object.getOwnPropertyDescriptor(performance, 'now');
  Object.defineProperty(performance, 'now', { configurable: true, value: () => 0 });
  try { return await operation(); }
  finally {
    if (original) Object.defineProperty(performance, 'now', original);
    else Reflect.deleteProperty(performance, 'now');
  }
}

/** Isolated, fresh loopback origin/profile only: clears this fixture database. */
export async function runHistoryChecks() {
  const checks: string[] = [];
  const observations: HistoryRead['costs'][] = [];
  let assertions = 0;
  function assert(condition: unknown, message: string): asserts condition {
    assertions++;
    if (!condition) throw new Error(message);
  }
  function inspect(output: HistoryRead, rows = 25, bytes = HISTORY_SLICE_BYTES) {
    assert(output.examinedRows <= rows, 'examined row bound');
    assert(output.examinedBytes <= bytes, 'examined byte bound');
    assert(output.costs.maxOperationMs >= 0, 'observed operation cost');
    assert(output.costs.maxOperationOvershootMs === Math.max(0, output.costs.maxOperationMs - 8), 'honest overshoot');
    observations.push(output.costs);
  }
  async function allSlices() {
    let before: IDBValidKey | null = null;
    const values: SessionResult[] = [];
    let examined = 0;
    const pages: HistoryRead[] = [];
    do {
      const output = await readHistorySlice({ before });
      inspect(output);
      assert(output.reason !== 'failed' && output.reason !== 'aborted', 'successful slice');
      values.push(...output.results);
      examined += output.examinedRows;
      pages.push(output);
      before = output.cursor;
      if (output.complete) return { values, examined, pages };
      assert(output.examinedRows > 0, 'each continuation progresses');
      assert(pages.length < 100, 'finite continuation');
    } while (true);
  }

  await seed([]);
  const empty = await readHistorySlice();
  inspect(empty);
  assert(empty.complete && empty.reason === 'exhausted' && empty.cursor === null, 'empty completion');
  checks.push('empty indexed history');

  for (const count of [24, 25, 26, 50, 61]) {
    await seed(Array.from({ length: count }, (_, n) => valid(n + 1)));
    const traversal = await allSlices();
    assert(traversal.examined === count, 'exact examined row count');
    assert(traversal.values.map(v => v.id).join() === Array.from({ length: count }, (_, n) => id(count - n)).join(), 'ties ordered once without gaps');
    assert(traversal.pages.at(-1)!.complete, 'exact boundary exhausted, not false incomplete');
    const legacy = await listResultsPage(null, 100);
    assert(legacy.length === count && getStorageDiagnostics().length === 0, 'legacy valid-result pagination unchanged');
  }
  checks.push('24/25/26/50/61 rows, equal timestamps, exact exhaustion, legacy API');
  await seed(Array.from({ length: 26 }, (_, n) => valid(n + 1)));
  const rowSlice = await withFixedWorkClock(() => readHistorySlice());
  assert(rowSlice.examinedRows === 25 && rowSlice.reason === 'row-budget' && !rowSlice.complete, 'exact 25-row slice stop independent of time policy');

  await seed(Array.from({ length: 81 }, (_, n) => n % 3 === 0 ? valid(n + 1) : { ...valid(n + 1), metricVersion: 999 }));
  const mixed = await allSlices();
  assert(mixed.examined === 81 && mixed.values.map(v => v.id).join() === Array.from({ length: 27 }, (_, n) => id(79 - 3 * n)).join(), 'interleaved invalid rows preserve every valid result once');
  for (const count of [499, 500, 501]) {
    await seed(Array.from({ length: count }, (_, n) => valid(n + 1)));
    const output = await scanHistory();
    assert(output.examinedRows === Math.min(count, 500) && output.complete === (count <= 500), 'automatic row boundary completeness');
    assert(output.results.length === Math.min(count, 500), 'all valid rows within automatic boundary retained');
  }
  checks.push('interleaved invalids and exact 499/500/501 automatic boundary');

  await seed([valid(1), ...Array.from({ length: 501 }, (_, n) => ({ ...valid(n + 2), metricVersion: 999 }))]);
  const invalid = await scanHistory();
  inspect(invalid, 500, HISTORY_SCAN_BYTES);
  assert(!invalid.complete && invalid.reason === 'row-budget' && invalid.examinedRows === 500, 'invalid majority respects automatic examined limit');
  assert(invalid.results.length === 0 && invalid.diagnostics.invalidRows === 500, 'invalid rows consume budget');
  const tail = await scanHistory({ before: invalid.cursor });
  assert(tail.complete && tail.examinedRows === 2 && tail.results[0].id === id(1), 'valid oldest row survives explicit continuation');
  assert(invalid.costs.yields >= 19, 'automatic reader yields between slices');
  assert(await storedCount() === 502, 'corrupt history retained');
  checks.push('mostly invalid, 500 automatic cap, retained rows, continuation/yields');

  await seed(Array.from({ length: 501 }, (_, n) => valid(n + 1)));
  const incompatible = await scanHistory({ compatible: value => value.id === id(1) });
  assert(incompatible.examinedRows === 500 && incompatible.diagnostics.incompatibleRows === 500 && !incompatible.complete, 'incompatible majority charged');
  const compatibleTail = await scanHistory({ before: incompatible.cursor, compatible: value => value.id === id(1) });
  assert(compatibleTail.complete && compatibleTail.results.length === 1, 'compatible tail retained');
  checks.push('mostly incompatible counted, exact requested cohort');

  await seed([valid(1), ...Array.from({ length: 17 }, (_, n) => padded(n + 2, MIB))]);
  const byteSlice = await withFixedWorkClock(() => readHistorySlice());
  assert(byteSlice.examinedRows === 4 && byteSlice.examinedBytes === 4 * MIB && byteSlice.reason === 'byte-budget' && !byteSlice.complete, 'exact 4 MiB slice stop independent of time policy');
  const byteSlices = await allSlices();
  assert(byteSlices.examined === 18 && byteSlices.values[0].id === id(1), 'byte continuations preserve valid tail');
  assert(byteSlices.pages.every(p => p.reason !== 'byte-budget' || p.examinedBytes === 4 * MIB), 'exact 4 MiB boundary');
  const byteScan = await scanHistory();
  inspect(byteScan, 500, HISTORY_SCAN_BYTES);
  assert(!byteScan.complete && byteScan.reason === 'byte-budget' && byteScan.examinedBytes === 16 * MIB && byteScan.examinedRows === 16, 'exact 16 MiB automatic boundary');
  const byteTail = await scanHistory({ before: byteScan.cursor });
  assert(byteTail.complete && byteTail.results[0].id === id(1), 'automatic byte continuation has no skipped valid result');
  checks.push('exact 4/16 MiB boundaries including invalid payloads');

  for (const bytes of [MIB - 1, MIB, MIB + 1]) {
    await seed([padded(2, bytes), valid(1)]);
    const output = await scanHistory({ byteLimit: MIB });
    assert(output.examinedRows === 1 && output.examinedBytes === Math.min(bytes, MIB), 'reservation pre-admission and exact record bytes');
    assert(output.diagnostics.oversizedRows === (bytes > MIB ? 1 : 0), 'oversized exclusion boundary');
    assert(output.diagnostics.oversizedSerializedBytes === (bytes > MIB ? bytes : 0), 'actual oversize disclosed');
    const next = await scanHistory({ before: output.cursor });
    assert(next.complete && next.results.length === 1, 'underfilled reservation resumes without loss');
  }
  await seed([padded(2, MIB), padded(1, MIB)]);
  const exact = await scanHistory({ byteLimit: 2 * MIB });
  assert(exact.complete && exact.examinedBytes === 2 * MIB, 'exact byte exhaustion complete');
  checks.push('below/at/over 1 MiB; reservation underfill; exact exhausted byte limit');

  const unicode = { id: id(2), completedAt: valid(2).completedAt, pad: 'é𝄞'.repeat(50) };
  await seed([unicode]);
  const utf8 = await readHistorySlice();
  assert(utf8.complete && utf8.examinedBytes === size(unicode) && size(unicode) > JSON.stringify(unicode).length, 'budgets use serialized UTF-8 bytes rather than code units');
  checks.push('UTF-8 serialized byte accounting');

  const cyclic: any = { id: id(4), completedAt: valid(4).completedAt }; cyclic.self = cyclic;
  await seed([valid(1), { id: id(2), completedAt: {} }, { id: id(3), completedAt: 123 }, cyclic]);
  const unusual = await scanHistory();
  assert(unusual.complete && unusual.examinedRows === 3 && unusual.diagnostics.unindexableRows === 1, 'unindexable excluded and counted');
  assert(unusual.diagnostics.unserializableRows === 1 && unusual.diagnostics.invalidRows === 2, 'cyclic/indexable invalid retained');
  assert(unusual.results.length === 1 && await storedCount() === 4, 'unusual rows retained');
  const rawPages = await allSlices();
  assert(rawPages.examined === 3, 'non-string raw key continuity');
  // Force the numeric date key to be the only row on the first slice.
  await seed([{ id: id(3), completedAt: 123 }, { id: id(2), completedAt: 122 }]);
  const raw = await readHistorySlice({ rowLimit: 1 });
  const rawNext = await readHistorySlice({ before: raw.cursor, rowLimit: 1 });
  assert(JSON.stringify(raw.cursor) === JSON.stringify([123, id(3)]) && rawNext.complete && rawNext.examinedRows === 1, 'opaque corrupt compound cursor resumes');
  checks.push('unindexable, cyclic and non-string compound keys with retention');

  await seed([valid(2), valid(1)]);
  const controller = new AbortController();
  const aborted = await readHistorySlice({ signal: controller.signal, compatible: () => { controller.abort(new Error('superseded')); return true; } });
  assert(aborted.reason === 'aborted' && !aborted.complete && aborted.examinedRows === 1, 'in-transaction abort stops next value');
  const failed = await readHistorySlice({ compatible: () => { throw new Error('fixture predicate failure'); } });
  assert(failed.reason === 'failed' && !failed.complete && failed.diagnostics.error === 'fixture predicate failure', 'predicate error settles with failure');
  const badCursor = await readHistorySlice({ before: NaN });
  assert(badCursor.reason === 'failed' && !badCursor.complete, 'invalid key fails honestly');
  assert((await scanHistory()).complete && await storedCount() === 2, 'abort/failure leave database usable');
  checks.push('real transaction abort, predicate failure, bad cursor, recovery');

  // Deterministic cost injection tests scheduling, not device performance.
  const originalNow = Object.getOwnPropertyDescriptor(performance, 'now');
  let clock = 0;
  Object.defineProperty(performance, 'now', { configurable: true, value: () => { clock += 9; return clock; } });
  try {
    const yielded = await readHistorySlice();
    assert(yielded.reason === 'yield' && yielded.examinedRows === 1 && yielded.costs.maxOperationMs === 9 && yielded.costs.maxOperationOvershootMs === 1, '8 ms cooperative stop with recorded overshoot');
    const resumed = await scanHistory();
    assert(resumed.complete && resumed.costs.slices === 2 && resumed.costs.yields === 1, 'time-limited slices resume across real event loop yield');
  } finally {
    if (originalNow) Object.defineProperty(performance, 'now', originalNow);
    else Reflect.deleteProperty(performance, 'now');
  }
  checks.push('injected 8 ms scheduling and nonpreemptible operation observation');

  await seed([]);
  return { checks, assertions, observations, userAgent: navigator.userAgent, fixtureDatabaseCleared: await storedCount() === 0 };
}
