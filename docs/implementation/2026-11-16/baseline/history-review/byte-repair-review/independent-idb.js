async (page) => {
  const browser = page.context().browser();
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const fixture = await context.newPage();
  const errors = [];
  fixture.on('pageerror', error => errors.push(error.message));
  try {
    await fixture.goto('http://127.0.0.1:5317/tests/browser/bounded-history.html');
    let timer;
    const work = fixture.evaluate(async () => {
      const { readHistorySlice, scanHistory, validateResult, listResults, getStorageDiagnostics } = await import('/src/storage.ts');
      const MIB = 1048576, date = '2026-11-16T00:00:00.000Z';
      const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
      const valid = n => ({ id: id(n), owner: 'guest', schemaVersion: 1, metricVersion: 1, completedAt: date, mode: 'practice', settings: { durationMs: 30000, inputMode: 'flow-v1', language: 'en', qwerty: true, corpusVersion: 'fixture' }, qualityFlags: [], eligibleForProgress: true, metrics: { elapsedMs: 30000, correctCharacters: 0, attemptedCharacters: 0, correctAttempts: 0, accuracy: null, deletedCharacters: 0, wpm: 0 }, sentences: [], chartSamples: [{ elapsedMs: 30000, wpm: 0, accuracy: null }] });
      const size = value => new TextEncoder().encode(JSON.stringify(value)).length;
      const open = () => new Promise((resolve, reject) => {
        const r = indexedDB.open('typeforge', 2);
        r.onupgradeneeded = () => r.result.createObjectStore('results', { keyPath: 'id' }).createIndex('completedAt-id', ['completedAt', 'id']);
        r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
      });
      const seed = async values => {
        const db = await open();
        try { await new Promise((resolve, reject) => { const t = db.transaction('results', 'readwrite'), s = t.objectStore('results'); s.clear(); values.forEach(v => s.put(v)); t.oncomplete = resolve; t.onabort = () => reject(t.error); }); }
        finally { db.close(); }
      };
      const count = async () => { const db = await open(); try { return await new Promise(resolve => { const r = db.transaction('results').objectStore('results').count(); r.onsuccess = () => resolve(r.result); }); } finally { db.close(); } };
      const clocked = async (step, run) => {
        const original = Object.getOwnPropertyDescriptor(performance, 'now'); let time = 0;
        if (step !== null) Object.defineProperty(performance, 'now', { configurable: true, value: () => time += step });
        try { return await run(); } finally { if (step !== null) { if (original) Object.defineProperty(performance, 'now', original); else delete performance.now; } }
      };
      const observed = async run => {
        const stringify = JSON.stringify, encode = TextEncoder.prototype.encode, charCode = String.prototype.charCodeAt, get = IDBObjectStore.prototype.get;
        let wholeStringifies = 0, encodedBuffers = 0, charInspections = 0, valueRequests = 0;
        try {
          JSON.stringify = () => { wholeStringifies++; throw Error('Independent forbidden whole serialization'); };
          TextEncoder.prototype.encode = () => { encodedBuffers++; throw Error('Independent forbidden whole encoding'); };
          String.prototype.charCodeAt = function(i) { charInspections++; return charCode.call(this, i); };
          IDBObjectStore.prototype.get = function(...args) { valueRequests++; return get.apply(this, args); };
          const output = await run();
          return { output, wholeStringifies, encodedBuffers, charInspections, valueRequests };
        } finally { JSON.stringify = stringify; TextEncoder.prototype.encode = encode; String.prototype.charCodeAt = charCode; IDBObjectStore.prototype.get = get; }
      };
      let assertions = 0; const records = [];
      const check = (condition, message) => { assertions++; if (!condition) throw Error(message); };
      const oversized = n => { const value = { id: id(n), completedAt: date, pad: '' }; value.pad = 'x'.repeat(2 * MIB - size(value)); return value; };
      const original17 = Array.from({ length: 17 }, (_, n) => oversized(n + 1));
      check(original17.every(row => size(row) === 2 * MIB), 'original exact 17 x 2 MiB input');
      await seed(original17);
      for (const step of [0, null]) for (const automatic of [false, true]) {
        const seen = await observed(() => clocked(step, () => automatic ? scanHistory() : readHistorySlice()));
        const out = seen.output;
        check(out.reason === 'record-limit' && !out.complete && out.examinedRows === 1 && out.costs.slices === 1, 'one terminal exception per entire lookup');
        check(seen.valueRequests === 1 && seen.wholeStringifies === 0 && seen.encodedBuffers === 0, 'one real native value request and no full JSON/encoding');
        check(seen.charInspections >= MIB - 512 && seen.charInspections <= MIB + 3, 'observed scalar inspections bound actual prefix work');
        check(out.examinedBytes === MIB && out.diagnostics.oversizedSerializedBytes === null && out.diagnostics.oversizedByteLowerBound === MIB + 1, 'honest prefix/unknown size/lower bound');
        check(await count() === 17, 'all original corrupt rows retained');
        records.push({ label: `${step === null ? 'ordinary' : 'fixed'} ${automatic ? 'automatic' : 'slice'}`, ...seen });
      }
      await seed([valid(0), ...original17]);
      let cursor = null;
      for (let n = 17; n >= 1; n--) {
        const out = await scanHistory({ before: structuredClone(cursor) });
        check(out.reason === 'record-limit' && out.examinedRows === 1 && out.cursor[1] === id(n) && !out.complete, 'each explicit continuation advances exactly one excluded row');
        cursor = out.cursor;
      }
      const tail = await scanHistory({ before: structuredClone(cursor) });
      check(tail.complete && tail.results.length === 1 && tail.results[0].id === id(0) && await count() === 18, 'valid tail untouched until explicit continuation; retained source');

      const mixed = [valid(1), oversized(2), ...Array.from({ length: 62 }, (_, n) => valid(n + 3))];
      for (const step of [0, 5]) {
        await seed(mixed);
        const seen = await observed(() => clocked(step, () => scanHistory()));
        check(seen.output.reason === 'record-limit' && seen.output.examinedRows === 63 && seen.output.results.length === 62 && seen.valueRequests === 63, 'terminal exception propagates after earlier row/time slices');
        check(seen.output.costs.slices >= (step === 0 ? 3 : 32) && seen.output.examinedBytes === 62 * size(valid(3)) + MIB, 'cumulative prefix allowance never replenishes');
        const explicit = await scanHistory({ before: seen.output.cursor });
        check(explicit.complete && explicit.results[0].id === id(1), 'mixed stop retains following valid tail');
        records.push({ label: `mixed step=${step}`, ...seen });
      }
      // Real IndexedDB clones; never invoke native JSON on a cycle or unsupported graph.
      let deep = 0; for (let n = 0; n < 60; n++) deep = { value: deep };
      const cycle = { pad: 'x'.repeat(MIB - 256) }; cycle.self = cycle;
      const wide = Object.fromEntries(Array.from({ length: 120000 }, (_, n) => [`key${n}`, false]));
      const unusual = [['late cycle', cycle], ['deep', deep], ['Map', new Map([['key', 1]])], ['Set', new Set([1])], ['Date', new Date(date)], ['binary', new Uint8Array(2 * MIB)], ['bigint', 1n], ['huge key', { ['é'.repeat(2 * MIB)]: 0 }], ['wide', wide]];
      for (const [label, payload] of unusual) {
        await seed([{ id: id(2), completedAt: date, payload }, valid(1)]);
        const seen = await observed(() => scanHistory());
        check(seen.output.reason === 'record-limit' && seen.output.examinedRows === 1 && seen.valueRequests === 1 && !seen.output.complete, 'unsupported/overflow graph terminal without native whole serialization');
        check(seen.wholeStringifies === 0 && seen.encodedBuffers === 0 && seen.output.examinedBytes <= MIB && seen.charInspections <= MIB + 3, 'native graph avoids whole buffers and bounds scalar prefix');
        if (label === 'late cycle') check(seen.output.examinedBytes >= MIB - 256 && seen.output.diagnostics.unserializableRows === 1, 'large cycle prefix charged before detection');
        const explicit = await scanHistory({ before: seen.output.cursor });
        check(explicit.complete && explicit.results[0].id === id(1), 'unusual explicit tail retained');
        records.push({ label, ...seen });
      }
      const shared = { x: 'é𝄞\ud800', n: Number.MIN_VALUE };
      const sparse = new Array(8); sparse[4] = 0;
      const jsonRows = [sparse, { a: shared, b: shared }, { '\u0000"𝄞': '\b\t\n\f\r\\' }, NaN, Infinity, -0].map((payload, n) => ({ id: id(n + 1), completedAt: date, payload }));
      await seed(jsonRows);
      cursor = null;
      for (const row of jsonRows.toReversed()) {
        const out = await readHistorySlice({ before: cursor, rowLimit: 1 });
        check(out.examinedBytes === size(row) && out.diagnostics.invalidRows === 1 && out.diagnostics.unserializableRows === 0, 'native clone JSON bytes equal independent oracle'); cursor = out.cursor;
      }
      const unicodeValid = valid(1);
      unicodeValid.settings.corpusVersion = 'en\u0080\ud800\ud834\udd1e\u0000"';
      unicodeValid.sentences.push({ promptId: 'unicode\ud800\ud834\udd1e', promptText: 'a', response: '\ud834\udd1e\ud800\u0000', submitted: true, eligible: false, diagnosticsAvailable: true, qualityFlags: ['edited'], keys: {}, pairs: {} });
      validateResult(unicodeValid);
      await seed([unicodeValid]);
      const unicodeSeen = await observed(() => scanHistory());
      check(unicodeSeen.output.complete && unicodeSeen.output.results.length === 1 && unicodeSeen.output.examinedBytes === size(unicodeValid), 'accepted Unicode/lone-surrogate record retains exact legacy native-size semantics');
      check(unicodeSeen.wholeStringifies === 0 && unicodeSeen.encodedBuffers === 0, 'accepted Unicode record avoids duplicate native size passes');
      await seed([{ id: id(1), completedAt: new Date(date) }, { id: id(2), completedAt: new Uint8Array([1, 2]).buffer }, { id: id(3), completedAt: ['array', 1] }]);
      cursor = null; let rawExamined = 0;
      for (let n = 0; n < 4; n++) {
        const out = await readHistorySlice({ before: structuredClone(cursor), rowLimit: 1 });
        rawExamined += out.examinedRows; cursor = out.cursor;
        check(out.reason !== 'failed' && out.reason !== 'aborted', 'opaque Date/binary/array key continuity survives record-limit');
        if (out.complete) break;
      }
      check(rawExamined === 3, 'all native-key records visited exactly once through explicit continuations');
      await seed([valid(1), valid(2)]);
      validateResult(valid(1));
      const failed = await scanHistory({ compatible: () => { throw Error('independent repaired predicate failure'); } });
      check(failed.reason === 'failed' && !failed.complete && failed.examinedRows === 1 && failed.diagnostics.error === 'independent repaired predicate failure', 'failed predicate preserves incomplete partial envelope');
      const abort = new AbortController();
      const aborted = await scanHistory({ signal: abort.signal, compatible: () => { abort.abort(); return true; } });
      check(aborted.reason === 'aborted' && !aborted.complete && aborted.examinedRows === 1, 'cancellation stops repaired path');
      const recovered = await scanHistory();
      check(recovered.complete && recovered.results.length === 2 && recovered.diagnostics.oversizedSerializedBytes === 0, 'cleanup and diagnostics recover independently');
      await listResults(); const legacyWarnings = getStorageDiagnostics();
      await readHistorySlice(); check(JSON.stringify(getStorageDiagnostics()) === JSON.stringify(legacyWarnings), 'bounded diagnostic independence preserved');
      await seed([oversized(1)]);
      const last = await scanHistory();
      check(last.reason === 'record-limit' && !last.complete && last.examinedRows === 1, 'last record limit never fabricates exhaustion');
      const exhausted = await scanHistory({ before: last.cursor });
      check(exhausted.complete && exhausted.examinedRows === 0 && exhausted.reason === 'exhausted', 'only explicit continuation proves exhaustion');
      await new Promise((resolve, reject) => { const r = indexedDB.deleteDatabase('typeforge'); r.onsuccess = resolve; r.onerror = () => reject(r.error); });
      return { assertions, records, fixtureDatabaseDeleted: true, nativeWholeCycleSerializationAttempted: false, timingClaim: 'none' };
    });
    const result = await Promise.race([work, new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Independent repaired-path watchdog')), 45000); })]).finally(() => clearTimeout(timer));
    return { ...result, errors, browserVersion: browser.version(), isolation: 'fresh nonpersistent context with empty storageState; strict owned5317; source3e314258' };
  } finally { await context.close(); }
}
