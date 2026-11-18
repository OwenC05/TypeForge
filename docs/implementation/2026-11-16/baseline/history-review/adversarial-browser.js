async (page) => {
  const browser = page.context().browser();
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const fixture = await context.newPage();
  const errors = [];
  const phases = [];
  fixture.on('pageerror', error => errors.push(error.message));
  fixture.on('console', message => { if (message.text().startsWith('H3:')) phases.push(message.text()); });
  try {
    await fixture.goto('http://127.0.0.1:5317/tests/browser/bounded-history.html');
    const work = fixture.evaluate(async () => {
      const phase = name => console.log(`H3:${name}`);
      phase('import');
      const storage = await import('/src/storage.ts');
      const MIB = 1048576;
      const date = '2026-11-16T00:00:00.000Z';
      const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
      let assertions = 0;
      const assert = (condition, message) => { assertions++; if (!condition) throw Error(message); };
      const open = (version = 2) => new Promise((resolve, reject) => {
        const request = indexedDB.open('typeforge', version);
        request.onupgradeneeded = () => {
          const store = request.result.createObjectStore('results', { keyPath: 'id' });
          if (version === 2) store.createIndex('completedAt-id', ['completedAt', 'id']);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const seed = async values => {
        const database = await open();
        try { await new Promise((resolve, reject) => {
          const transaction = database.transaction('results', 'readwrite');
          const store = transaction.objectStore('results'); store.clear();
          values.forEach(value => store.put(value));
          transaction.oncomplete = resolve; transaction.onabort = () => reject(transaction.error);
        }); } finally { database.close(); }
      };
      const fixedClock = async operation => {
        const descriptor = Object.getOwnPropertyDescriptor(performance, 'now');
        Object.defineProperty(performance, 'now', { configurable: true, value: () => 0 });
        try { return await operation(); }
        finally { if (descriptor) Object.defineProperty(performance, 'now', descriptor); else delete performance.now; }
      };
      const summary = output => ({
        examinedRows: output.examinedRows, examinedBytes: output.examinedBytes,
        complete: output.complete, reason: output.reason, cursor: output.cursor,
        results: output.results.length, diagnostics: output.diagnostics, costs: output.costs,
      });
      const valid = n => ({
        id: id(n), owner: 'guest', schemaVersion: 1, metricVersion: 1, completedAt: date, mode: 'practice',
        settings: { durationMs: 30000, inputMode: 'flow-v1', language: 'en', qwerty: true, corpusVersion: 'fixture' },
        qualityFlags: [], eligibleForProgress: true,
        metrics: { elapsedMs: 30000, correctCharacters: 0, attemptedCharacters: 0, correctAttempts: 0, accuracy: null, deletedCharacters: 0, wpm: 0 },
        sentences: [], chartSamples: [{ elapsedMs: 30000, wpm: 0, accuracy: null }],
      });
      const oversized = n => {
        const row = { id: id(n), completedAt: date, pad: '' };
        row.pad = 'x'.repeat(2 * MIB - new TextEncoder().encode(JSON.stringify(row)).length);
        return row;
      };
      phase('oversize');
      await seed(Array.from({ length: 17 }, (_, n) => oversized(n + 1)));
      const oversizeSlice = await fixedClock(() => storage.readHistorySlice());
      const oversizeScan = await fixedClock(() => storage.scanHistory());
      assert(oversizeSlice.examinedRows === 4 && oversizeSlice.examinedBytes === 4 * MIB, 'reproduce charged slice cap');
      assert(oversizeSlice.diagnostics.oversizedSerializedBytes === 8 * MIB, 'reproduce 8 MiB actual payload in 4 MiB slice');
      assert(oversizeScan.examinedRows === 16 && oversizeScan.examinedBytes === 16 * MIB, 'reproduce charged lookup cap');
      assert(oversizeScan.diagnostics.oversizedSerializedBytes === 32 * MIB && !oversizeScan.complete, 'reproduce repeated actual payload overrun');
      const oversizeTail = await storage.scanHistory({ before: structuredClone(oversizeScan.cursor) });
      assert(oversizeTail.complete && oversizeTail.examinedRows === 1, 'oversize continuation retains final row');
      // Ordinary clock independently proves aggregate lookup overrun; no latency claim.
      const oversizeRealClock = await storage.scanHistory();
      assert(oversizeRealClock.diagnostics.oversizedSerializedBytes === 32 * MIB, 'real clock does not enforce actual automatic bytes');
      phase('oversize verified');
      // Confirm normal result bounds, filter counts, deterministic repeated calls and isolation.
      await seed([valid(1), valid(2), valid(3), { ...valid(4), metricVersion: 999 }, { id: id(5) }]);
      const first = await storage.readHistorySlice({ rowLimit: 2, compatible: row => row.id === id(2) });
      assert(first.examinedRows === 2 && first.results.length === 0 && first.diagnostics.invalidRows === 1 && first.diagnostics.incompatibleRows === 1 && first.diagnostics.unindexableRows === 1, 'invalid/filter/global unindexable semantics');
      const second = await storage.readHistorySlice({ before: structuredClone(first.cursor), rowLimit: 2 });
      assert(second.complete && second.results.map(row => row.id).join() === [id(2), id(1)].join(), 'last examined exclusive continuation and exact exhaustion');
      const repeat = await storage.readHistorySlice({ before: structuredClone(first.cursor), rowLimit: 2 });
      assert(JSON.stringify(repeat.results) === JSON.stringify(second.results), 'independent repeated calls deterministic');
      first.diagnostics.invalidRows = 999;
      await storage.listResults();
      const legacyWarnings = storage.getStorageDiagnostics();
      const independent = await storage.readHistorySlice();
      assert(independent.diagnostics.invalidRows === 1 && JSON.stringify(storage.getStorageDiagnostics()) === JSON.stringify(legacyWarnings), 'new diagnostics never overwrite legacy warnings');
      const underfill = await storage.readHistorySlice({ byteLimit: MIB });
      assert(underfill.examinedRows === 1 && underfill.reason === 'byte-budget' && underfill.examinedBytes < MIB, 'documented conservative byte underfill');
      // Opaque Date/binary/array key continuity, structured clone rather than JSON.
      phase('normal verified');
      await seed([
        { id: id(1), completedAt: new Date(date) },
        { id: id(2), completedAt: new Uint8Array([1, 2]).buffer },
        { id: id(3), completedAt: ['nested', 1] },
      ]);
      let cursor = null, count = 0;
      const nativeKeys = [];
      while (true) {
        const output = await storage.readHistorySlice({ before: structuredClone(cursor), rowLimit: 1 });
        assert(output.reason !== 'failed' && output.examinedRows === 1, 'native corrupt key makes progress');
        nativeKeys.push(Object.prototype.toString.call(output.cursor[0]));
        cursor = output.cursor; count += output.examinedRows;
        if (output.complete) break;
        assert(count < 4, 'finite native key continuation');
      }
      assert(count === 3, 'three raw native compound keys exactly once');
      phase('native keys verified');
      await seed([valid(1), valid(2)]);
      const controller = new AbortController();
      let adds = 0, removes = 0;
      const activeListeners = new Set();
      const add = controller.signal.addEventListener.bind(controller.signal);
      const remove = controller.signal.removeEventListener.bind(controller.signal);
      controller.signal.addEventListener = (...args) => { adds++; activeListeners.add(args[1]); return add(...args); };
      controller.signal.removeEventListener = (...args) => { removes++; activeListeners.delete(args[1]); return remove(...args); };
      const failed = await storage.readHistorySlice({ signal: controller.signal, compatible: () => { throw Error('independent predicate'); } });
      assert(failed.reason === 'failed' && !failed.complete && failed.examinedRows === 1 && failed.diagnostics.error === 'independent predicate', 'failed predicate returns diagnostic partial work');
      assert(activeListeners.size === 0, 'abort listeners removed after predicate failure');
      assert((await storage.scanHistory()).complete, 'recovery after predicate failure');
      phase('predicate verified');
      await seed([]);
      // Real blocked version upgrade plus late-close and legacy migration regression.
      await new Promise((resolve, reject) => { const r = indexedDB.deleteDatabase('typeforge'); r.onsuccess = resolve; r.onerror = () => reject(r.error); });
      phase('initial delete done');
      const legacy = await open(1); legacy.onversionchange = () => {};
      const blocked = await storage.readHistorySlice();
      assert(blocked.reason === 'failed' && !blocked.complete && /Close other/.test(blocked.diagnostics.error), 'real blocked upgrade returns failure promptly');
      phase('blocked verified');
      legacy.close();
      const afterBlock = await storage.readHistorySlice();
      assert(afterBlock.complete, 'late upgrade unlocks subsequent read');
      const deleted = await new Promise(resolve => {
        const r = indexedDB.deleteDatabase('typeforge');
        r.onblocked = () => resolve(false); r.onsuccess = () => resolve(true); r.onerror = () => resolve(false);
      });
      assert(deleted, 'blocked/late/current connections closed, deletion unblocked');
      return {
        assertions, oversizeSlice: summary(oversizeSlice), oversizeScan: summary(oversizeScan),
        oversizeRealClock: summary(oversizeRealClock),
        nativeKeys, failedPredicateListeners: { adds, removes, active: activeListeners.size }, blocked: summary(blocked),
        expectedContractFailures: [
          'actual oversized serialized payload exceeds 4/16 MiB despite capped charged counter',
        ],
        fixtureDatabaseDeleted: deleted,
        clockPolicy: 'Fixed clock isolates deterministic byte/row work; ordinary-clock oversized scan also reproduced. No timed-performance claim.',
      };
    });
    let timer;
    const result = await Promise.race([work, new Promise((_, reject) => { timer = setTimeout(() => reject(Error(`Probe timeout; phases=${phases.join(',')}`)), 30000); })]).finally(() => clearTimeout(timer));
    return { ...result, errors, phases, browserVersion: browser.version(), isolation: 'fresh nonpersistent context with empty storageState; dedicated strict loopback port 5317' };
  } finally { await context.close(); }
}
