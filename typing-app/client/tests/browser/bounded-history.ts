import {
  readHistorySlice, scanHistory, listResultsPage, getStorageDiagnostics,
  HISTORY_SLICE_BYTES, HISTORY_SCAN_BYTES, validateResult, type HistoryRead,
  openDatabase,
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
  return openDatabase();
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
    assert(output.diagnostics.oversizedSerializedBytes === (bytes > MIB ? null : 0), 'unmeasured oversized total is unknown');
    assert(output.diagnostics.oversizedByteLowerBound === (bytes > MIB ? MIB + 1 : 0), 'explicit oversized lower bound');
    if (bytes > MIB) assert(output.reason === 'record-limit' && output.costs.slices === 1, 'record stop carries through automatic continuation');
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
  assert(!unusual.complete && unusual.reason === 'record-limit' && unusual.examinedRows === 1 && unusual.diagnostics.unindexableRows === 1, 'unindexable count and cyclic explicit stop');
  assert(unusual.diagnostics.unserializableRows === 1 && unusual.diagnostics.invalidRows === 1, 'cyclic exclusion retained');
  const unusualTail = await scanHistory({ before: unusual.cursor });
  assert(unusualTail.complete && unusualTail.examinedRows === 2 && unusualTail.diagnostics.invalidRows === 1, 'explicit continuation after cyclic row');
  assert(unusualTail.results.length === 1 && await storedCount() === 4, 'unusual rows retained');
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

/** Independently observe actual native serialization/UTF-8 allocation, not reported charges. */
export async function runHistoryByteRepairChecks() {
  const failures: string[] = [];
  const cases: unknown[] = [];
  let assertions = 0;
  const assert = (condition: unknown, message: string) => {
    assertions++;
    if (!condition) failures.push(message);
  };
  const fixtures = Array.from({ length: 17 }, (_, n) => padded(n + 1, 2 * MIB));
  assert(fixtures.every(value => size(value) === 2 * MIB), 'fixture is exactly 2 MiB per row');
  await seed(fixtures);
  for (const fixedClock of [true, false]) {
    for (const automatic of [false, true]) {
      const nativeStringify = JSON.stringify;
      const nativeEncode = TextEncoder.prototype.encode;
      const nativeCharCodeAt = String.prototype.charCodeAt;
      let stringifyBytes = 0;
      let encodedBytes = 0;
      let wholeRecordCalls = 0;
      let largeStringInspections = 0;
      let output: HistoryRead;
      try {
        (JSON as any).stringify = (...args: any[]) => {
          const json = (nativeStringify as any)(...args);
          if (typeof json === 'string') stringifyBytes += nativeEncode.call(new TextEncoder(), json).length;
          if (args[0] && typeof args[0] === 'object' && 'id' in args[0]) wholeRecordCalls++;
          return json;
        };
        TextEncoder.prototype.encode = function(input?: string) {
          const bytes = nativeEncode.call(this, input);
          encodedBytes += bytes.length;
          return bytes;
        };
        String.prototype.charCodeAt = function(this: string, position: number) {
          if (this.length >= MIB - 512) largeStringInspections++;
          return nativeCharCodeAt.call(this, position);
        };
        const read = () => automatic ? scanHistory() : readHistorySlice();
        output = await (fixedClock ? withFixedWorkClock(read) : read());
      } finally {
        JSON.stringify = nativeStringify;
        TextEncoder.prototype.encode = nativeEncode;
        String.prototype.charCodeAt = nativeCharCodeAt;
      }
      const limit = automatic ? HISTORY_SCAN_BYTES : HISTORY_SLICE_BYTES;
      const label = `${fixedClock ? 'fixed' : 'ordinary'} ${automatic ? 'automatic' : 'slice'}`;
      cases.push({ label, limit, stringifyBytes, encodedBytes, wholeRecordCalls, largeStringInspections, output });
      assert(stringifyBytes <= limit, `${label}: actual JSON serialization exceeds byte budget`);
      assert(encodedBytes <= limit, `${label}: actual UTF-8 allocation exceeds byte budget`);
      assert(!output.complete, `${label}: corrupt budget stop must not fabricate exhaustion`);
      assert(await storedCount() === 17, `${label}: source corruption retained`);
      assert(output.reason === 'record-limit' && output.examinedRows === 1 && output.costs.slices === 1, `${label}: automatic continuation does not repeat materialization exceptions`);
      assert(wholeRecordCalls === 0 && encodedBytes === 0, `${label}: corrupt payload is never fully serialized or encoded`);
      assert(output.examinedBytes === MIB && output.diagnostics.oversizedSerializedBytes === null && output.diagnostics.oversizedByteLowerBound === MIB + 1, `${label}: prefix bound and unknown total are truthful`);
      assert(largeStringInspections > 0 && largeStringInspections <= MIB, `${label}: actual long-string traversal stops within bounded prefix`);
    }
  }

  // Differential oracle: exercise every JSON escape class, lone/paired
  // surrogates, non-ASCII keys, native number formatting, holes and aliases.
  const scalars = [null, true, false, 0, -0, 1e-7, 1e21, Number.MIN_VALUE, Number.MAX_VALUE, NaN, Infinity, -Infinity,
    '', '"\\\b\t\n\f\r', Array.from({ length: 32 }, (_, n) => String.fromCharCode(n)).join(''),
    '\u007f\u0080\u07ff\u0800\uffff\ud800\udfff\ud800\udc00', 'é𝄞'];
  const shared = { escaped: '\ud800"\u0000', number: 0.125 };
  const sparse = new Array(5); sparse[2] = 'middle';
  const payloads: unknown[] = [...scalars, scalars, sparse, { a: shared, b: shared }];
  let state = 179;
  const random = () => { state = (state * 1664525 + 1013904223) >>> 0; return state; };
  for (let n = 0; n < 120; n++) {
    const payload: Record<string, unknown> = {};
    for (let k = 0; k < 1 + n % 9; k++) payload[`key-${k}-\u0080\ud800`] = [scalars[random() % scalars.length], { nested: scalars[random() % scalars.length] }];
    payloads.push(payload);
  }
  const jsonValues = payloads.map((payload, n) => ({ id: id(n + 1), completedAt: valid(1).completedAt, payload }));
  await seed(jsonValues);
  let differentialCursor: IDBValidKey | null = null;
  for (const expected of jsonValues.toReversed()) {
    const output = await readHistorySlice({ before: differentialCursor, rowLimit: 1 });
    assert(output.examinedRows === 1 && output.examinedBytes === size(expected), `native JSON byte oracle for ${expected.id}`);
    assert(output.diagnostics.invalidRows === 1 && output.diagnostics.unserializableRows === 0, 'bounded JSON trees measured before strict invalid-shape exclusion');
    differentialCursor = output.cursor;
  }
  assert((await readHistorySlice({ before: differentialCursor })).complete, 'differential traversal exhausted exactly');
  cases.push({ label: 'native JSON byte differential', records: jsonValues.length });

  // Build truly valid exact-size records. Per-sentence pair payloads provide
  // capacity; bounded prompt IDs fill the final small remainder legally.
  const largeValid = (n: number, target: number): SessionResult => {
    const value = valid(n);
    const pairs = Object.fromEntries(Array.from({ length: 299 }, (_, p) => [
      String.fromCharCode(97 + Math.floor(p / 26), 97 + p % 26), { count: 1, logSum: Math.log(1234.56789) },
    ]));
    const sentence = { promptId: 'fixture', promptText: 'a'.repeat(300), response: 'a'.repeat(300), submitted: true,
      eligible: true, diagnosticsAvailable: true, qualityFlags: [], keys: {}, pairs };
    let bytes = size(value);
    const fullSize = size(sentence);
    while (bytes + fullSize + (value.sentences.length ? 1 : 0) <= target) {
      bytes += fullSize + (value.sentences.length ? 1 : 0);
      value.sentences.push(structuredClone(sentence));
    }
    const partial = { ...sentence, pairs: {} as typeof pairs };
    if (bytes + size(partial) + 1 <= target) {
      bytes += size(partial) + 1;
      value.sentences.push(partial);
      for (const [pair, stats] of Object.entries(pairs)) {
        const added = size(pair) + 1 + size(stats) + (Object.keys(partial.pairs).length ? 1 : 0);
        if (bytes + added > target) break;
        partial.pairs[pair] = stats;
        bytes += added;
      }
    }
    for (const item of value.sentences) {
      const extra = Math.min(target - bytes, 128 - item.promptId.length);
      item.promptId += 'x'.repeat(extra);
      bytes += extra;
    }
    assert(bytes === target && size(value) === target, 'valid fixture has independently measured exact size');
    if (target <= MIB) validateResult(value);
    return value;
  };
  const large = [largeValid(3, MIB - 1), largeValid(2, MIB), largeValid(1, MIB + 1)];
  await seed(large);
  const nativeStringify = JSON.stringify;
  const nativeEncode = TextEncoder.prototype.encode;
  let measuredLarge: HistoryRead;
  try {
    (JSON as any).stringify = (...args: any[]) => {
      if (args[0] && typeof args[0] === 'object') throw new Error('Whole-record serialization forbidden during bounded read.');
      return (nativeStringify as any)(...args);
    };
    TextEncoder.prototype.encode = () => { throw new Error('Whole-buffer UTF-8 encoding forbidden during bounded read.'); };
    measuredLarge = await withFixedWorkClock(() => scanHistory());
  } finally { JSON.stringify = nativeStringify; TextEncoder.prototype.encode = nativeEncode; }
  assert(measuredLarge.examinedRows === 3 && measuredLarge.results.length === 2 && measuredLarge.reason === 'record-limit', 'valid below/at record ceiling accepted; over-ceiling structure excluded');
  assert(measuredLarge.examinedBytes === 3 * MIB - 1, 'valid size accounting has no duplicate serialization charge');
  assert(measuredLarge.diagnostics.oversizedRows === 1 && measuredLarge.diagnostics.oversizedSerializedBytes === null, 'over-ceiling total remains unknown');
  assert((await scanHistory({ before: measuredLarge.cursor })).complete, 'explicit continuation proves exhaustion after last oversized record');
  cases.push({ label: 'valid below/at/over record ceiling', examinedRows: measuredLarge.examinedRows, bytes: measuredLarge.examinedBytes, reason: measuredLarge.reason });

  await seed(Array.from({ length: 5 }, (_, n) => ({ ...large[1], id: id(n + 1) })));
  const exactValidSlice = await withFixedWorkClock(() => readHistorySlice());
  assert(exactValidSlice.examinedRows === 4 && exactValidSlice.examinedBytes === 4 * MIB && exactValidSlice.results.length === 4 && exactValidSlice.reason === 'byte-budget', 'exact 4 MiB of valid results stops before fifth value');
  const exactValidTail = await scanHistory({ before: exactValidSlice.cursor });
  assert(exactValidTail.complete && exactValidTail.examinedRows === 1 && exactValidTail.results[0].id === id(1), 'valid byte-limit cursor neither skips nor repeats fifth value');
  cases.push({ label: 'five valid exact-1-MiB records', sliceRows: exactValidSlice.examinedRows, sliceBytes: exactValidSlice.examinedBytes, tailRows: exactValidTail.examinedRows });

  // More than one slice of mixed valid/invalid/incompatible rows before a
  // record stop, then explicit continuation through every intended valid row.
  const mixedValues: unknown[] = [valid(1), padded(2, 2 * MIB), valid(3)];
  for (let n = 4; n <= 90; n++) mixedValues.push(n % 3 === 0 ? { ...valid(n), metricVersion: 999 } : valid(n));
  await seed(mixedValues);
  const mixed = await withFixedWorkClock(() => scanHistory({ compatible: value => Number(value.id.slice(-12)) % 2 === 1 }));
  assert(mixed.reason === 'record-limit' && mixed.examinedRows === 89 && mixed.costs.slices >= 4 && !mixed.complete, 'record stop carried after cumulative multi-slice mixed history');
  const expectedIds = Array.from({ length: 87 }, (_, k) => 90 - k).filter(n => n % 3 !== 0 && n % 2 === 1).map(id).concat(id(3));
  assert(mixed.results.map(value => value.id).join() === expectedIds.join(), 'mixed excluded/cohort rows do not skip or duplicate valid results');
  const continued = await scanHistory({ before: mixed.cursor });
  assert(continued.complete && continued.examinedRows === 1 && continued.results[0].id === id(1), 'explicit continuation keeps following valid row');
  assert(await storedCount() === 90, 'mixed source data retained');
  cases.push({ label: 'mixed multi-slice stop and explicit continuation', rows: mixed.examinedRows, slices: mixed.costs.slices, returned: mixed.results.length });

  for (const { prefix, cyclic } of [{ prefix: MIB - 256, cyclic: true }, { prefix: 16 * MIB, cyclic: true }, { prefix: 16 * MIB, cyclic: false }]) {
    const lateCycle: any = { id: id(2), completedAt: valid(1).completedAt, pad: 'x'.repeat(prefix) };
    if (cyclic) lateCycle.self = lateCycle;
    await seed([lateCycle, valid(1)]);
    // Never call native stringify on the cyclic IDB clone: fail fast if the
    // corrected path accidentally regresses to that hazardous native operation.
    const originalStringify = JSON.stringify;
    const originalCharCodeAt = String.prototype.charCodeAt;
    let inspected = 0;
    let output: HistoryRead;
    try {
      (JSON as any).stringify = () => { throw new Error('Native serialization forbidden for late-cycle fixture.'); };
      String.prototype.charCodeAt = function(this: string, position: number) {
        if (this.length >= MIB - 512) inspected++;
        return originalCharCodeAt.call(this, position);
      };
      output = await scanHistory();
    } finally { JSON.stringify = originalStringify; String.prototype.charCodeAt = originalCharCodeAt; }
    assert(output.reason === 'record-limit' && output.examinedRows === 1 && output.costs.slices === 1, 'late-cycle/large native exception never repeats automatically');
    assert(output.examinedBytes > MIB - 512 && output.examinedBytes <= MIB, 'large prefix work is charged even on later cycle/overflow');
    assert(inspected >= MIB - 256 && inspected <= MIB, 'independent scalar inspection counter bounds late-cycle/large-prefix work');
    const tail = await scanHistory({ before: output.cursor });
    assert(tail.complete && tail.results.length === 1 && tail.results[0].id === id(1), 'late-cycle/large-record continuation retains the following valid row');
    cases.push({ label: cyclic ? 'late cycle with guarded native serialization' : 'large JSON tree with guarded native serialization', nativeStringCodeUnits: prefix, inspected, chargedBytes: output.examinedBytes, diagnostics: output.diagnostics });
  }

  const cycle: any = { id: id(8), completedAt: valid(1).completedAt }; cycle.self = cycle;
  let deep: unknown = 'leaf'; for (let n = 0; n < 40; n++) deep = { deep };
  const unsupported: unknown[] = [cycle, ...[new Map([['a', 1]]), new Date(), 1n, new Uint8Array(2 * MIB), deep].map((payload, n) => ({ id: id(7 - n), completedAt: valid(1).completedAt, payload })), valid(1)];
  await seed(unsupported);
  let cursor: IDBValidKey | null = null;
  for (let n = 0; n < unsupported.length - 1; n++) {
    const output = await scanHistory({ before: cursor });
    assert(output.reason === 'record-limit' && output.examinedRows === 1 && output.costs.slices === 1 && !output.complete, 'unsupported clone/tree stops automatic work');
    assert(output.diagnostics.unserializableRows === 1 && output.examinedBytes <= MIB, 'unsupported prefix work remains accounted and bounded');
    cursor = output.cursor;
  }
  const supportedTail = await scanHistory({ before: cursor });
  assert(supportedTail.complete && supportedTail.results[0].id === id(1) && await storedCount() === unsupported.length, 'unsupported explicit continuations preserve the valid tail and retained corrupt source');
  cases.push({ label: 'cyclic, Map, Date, bigint, binary and depth stops', excluded: unsupported.length - 1 });

  await seed(Array.from({ length: 50 }, (_, n) => valid(n + 1)));
  const abortController = new AbortController();
  let examined = 0;
  const cancelled = await scanHistory({ signal: abortController.signal, compatible: () => {
    examined++;
    if (examined === 26) abortController.abort(new Error('superseded second slice'));
    return true;
  } });
  assert(cancelled.reason === 'aborted' && !cancelled.complete && cancelled.examinedRows === 26 && cancelled.costs.slices >= 2, 'cancellation stops an automatic multi-slice read');
  assert((await scanHistory()).complete, 'new read succeeds after cancelled multi-slice cleanup');
  cases.push({ label: 'multi-slice abort and recovery', rows: cancelled.examinedRows, slices: cancelled.costs.slices });
  await seed([]);
  return { passed: failures.length === 0, failures, assertions, cases, fixtureDatabaseCleared: await storedCount() === 0 };
}
