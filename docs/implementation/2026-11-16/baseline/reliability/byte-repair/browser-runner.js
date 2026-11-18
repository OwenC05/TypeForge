async (page) => {
  const browser = page.context().browser();
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  let watchdog;
  try {
    const fixture = await context.newPage();
    const errors = [];
    fixture.on('pageerror', error => errors.push(error.message));
    await fixture.goto('http://127.0.0.1:5319/tests/browser/bounded-history.html');
    await fixture.waitForFunction(() => typeof window.runHistoryByteRepairChecks === 'function');
    const tests = async () => ({
      byteRepair: await fixture.evaluate(() => window.runHistoryByteRepairChecks()),
      original: await fixture.evaluate(() => window.runHistoryChecks()),
    });
    const result = await Promise.race([
      tests(),
      new Promise((_, reject) => { watchdog = setTimeout(() => reject(new Error('Bounded repair fixture watchdog expired.')), 25000); }),
    ]);
    return { ...result, errors, browserVersion: browser.version(), isolation: 'fresh nonpersistent BrowserContext with empty storageState; closed in finally', port: 5319 };
  } finally {
    clearTimeout(watchdog);
    await context.close();
  }
}
