// Health watchdog for one native JSON operation; this is not a latency benchmark.
async (page) => {
  const browser = page.context().browser();
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const fixture = await context.newPage();
  const events = [];
  fixture.on('console', message => events.push(message.text()));
  try {
    await fixture.goto('http://127.0.0.1:5317/tests/browser/bounded-history.html');
    let timer;
    const work = fixture.evaluate(async () => {
      const row = { id: 'native-cycle', completedAt: 'z', pad: 'x'.repeat(1048576) };
      row.self = row;
      try { JSON.stringify(row); } catch { console.log('pure JS cycle rejected'); }
      const pending = indexedDB.open('native-cycle-h3', 1);
      const database = await new Promise((resolve, reject) => {
        pending.onupgradeneeded = () => pending.result.createObjectStore('rows', { keyPath: 'id' });
        pending.onsuccess = () => resolve(pending.result);
        pending.onerror = () => reject(pending.error);
      });
      await new Promise(resolve => {
        const transaction = database.transaction('rows', 'readwrite');
        transaction.objectStore('rows').put(row); transaction.oncomplete = resolve;
      });
      const clone = await new Promise(resolve => {
        const request = database.transaction('rows').objectStore('rows').get(row.id);
        request.onsuccess = () => resolve(request.result);
      });
      database.close();
      console.log(`native clone read; identity=${clone.self === clone}; pad=${clone.pad.length}`);
      try { JSON.stringify(clone); } catch { console.log('native clone cycle rejected'); }
      return 'settled';
    });
    const outcome = await Promise.race([work, new Promise(resolve => { timer = setTimeout(() => resolve('watchdog expired during native operation'), 5000); })]).finally(() => clearTimeout(timer));
    return { outcome, events, browserVersion: browser.version(), storageModuleUsed: false, timingClaim: 'none; concurrent machine; nonpreemptible operation only', contextClosedInFinally: true };
  } finally { await context.close(); }
}
