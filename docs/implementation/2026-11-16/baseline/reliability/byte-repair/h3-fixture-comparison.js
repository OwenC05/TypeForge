// Adapted comparison only: unchanged H3 17 x 2 MiB seeding from 903e47f;
// owned port and expected repaired-state assertions changed; independent frozen receipt is untouched.
// Execute through Playwright browser_run_code in a fresh context against this frozen checkout.
// Expected failure is the Stage 1C payload contract, not the assertions documenting it.
async (page) => {
  const browser = page.context().browser();
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const fixture = await context.newPage();
  try {
    await fixture.goto('http://127.0.0.1:5319/tests/browser/bounded-history.html');
    let timer;
    const work = fixture.evaluate(async () => {
      const { readHistorySlice, scanHistory } = await import('/src/storage.ts');
      const MIB = 1048576;
      const opening = indexedDB.open('typeforge', 2);
      const database = await new Promise((resolve, reject) => {
        opening.onupgradeneeded = () => {
          const store = opening.result.createObjectStore('results', { keyPath: 'id' });
          store.createIndex('completedAt-id', ['completedAt', 'id']);
        };
        opening.onsuccess = () => resolve(opening.result);
        opening.onerror = () => reject(opening.error);
      });
      await new Promise((resolve, reject) => {
        const transaction = database.transaction('results', 'readwrite');
        const store = transaction.objectStore('results');
        for (let n = 1; n <= 17; n++) {
          const row = { id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`, completedAt: '2026-11-16T00:00:00.000Z', pad: '' };
          row.pad = 'x'.repeat(2 * MIB - new TextEncoder().encode(JSON.stringify(row)).length);
          store.put(row);
        }
        transaction.oncomplete = resolve;
        transaction.onabort = () => reject(transaction.error);
      });
      database.close();
      const original = Object.getOwnPropertyDescriptor(performance, 'now');
      Object.defineProperty(performance, 'now', { configurable: true, value: () => 0 });
      let controlledSlice, controlledScan;
      try { controlledSlice = await readHistorySlice(); controlledScan = await scanHistory(); }
      finally { if (original) Object.defineProperty(performance, 'now', original); else delete performance.now; }
      const ordinaryScan = await scanHistory();
      const summarize = value => ({ rows: value.examinedRows, chargedBytes: value.examinedBytes, actualSerializedBytes: value.diagnostics.oversizedSerializedBytes, complete: value.complete, reason: value.reason, slices: value.costs.slices });
      for (const value of [controlledSlice, controlledScan, ordinaryScan]) {
        if (value.examinedRows !== 1 || value.examinedBytes !== MIB || value.diagnostics.oversizedSerializedBytes !== null || value.diagnostics.oversizedByteLowerBound !== MIB + 1 || value.complete || value.reason !== 'record-limit' || value.costs.slices !== 1) {
          throw Error('Repaired H3 fixture did not stop conservatively at one bounded record prefix.');
        }
      }
      const retained = await new Promise((resolve, reject) => {
        const r = indexedDB.open('typeforge', 2);
        r.onerror = () => reject(r.error);
        r.onsuccess = () => { const count = r.result.transaction('results').objectStore('results').count(); count.onsuccess = () => { r.result.close(); resolve(count.result); }; };
      });
      await new Promise((resolve, reject) => { const r = indexedDB.deleteDatabase('typeforge'); r.onsuccess = resolve; r.onerror = () => reject(r.error); });
      return { repairedDeltaChecksPassed: true, fixture: { rows: 17, serializedBytesPerRow: 2 * MIB, retained }, controlledSlice: summarize(controlledSlice), controlledScan: summarize(controlledScan), ordinaryScan: summarize(ordinaryScan), databaseDeleted: true };
    });
    const result = await Promise.race([work, new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Independent repro timeout')), 20000); })]).finally(() => clearTimeout(timer));
    return { ...result, browserVersion: browser.version(), isolation: 'fresh nonpersistent context; empty storageState; strict owned port 5319', timingClaim: 'none' };
  } finally { await context.close(); }
}
