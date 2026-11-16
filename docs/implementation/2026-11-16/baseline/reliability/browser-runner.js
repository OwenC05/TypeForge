async (page) => {
  const browser = page.context().browser();
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const fixture = await context.newPage();
  const errors = [];
  fixture.on('pageerror', error => errors.push(error.message));
  try {
    await fixture.goto('http://127.0.0.1:5313/tests/browser/bounded-history.html');
    await fixture.waitForFunction(() => typeof window.runHistoryChecks === 'function');
    const result = await fixture.evaluate(() => window.runHistoryChecks());
    return {
      ...result, errors, url: fixture.url(),
      isolation: 'fresh nonpersistent BrowserContext with empty storageState',
      browserVersion: browser.version(),
    };
  } finally { await context.close(); }
}
