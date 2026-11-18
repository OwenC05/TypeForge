// Author follow-up driver. Independent assertions are replayed, not reauthored.
module.exports = async (page) => {
  const browser = page.context().browser();
  const base = 'http://127.0.0.1:5321';
  const specs = [
    { group: 'independent-probe-replay', which: 'upgrade-add-throw' },
    { group: 'independent-probe-replay', which: 'delete-sync-throw' },
    { group: 'independent-probe-replay', which: 'mixed-ledger-failed-member' },
    { group: 'author-regression', which: 'upgrade' },
    { group: 'author-regression', which: 'delete' },
    { group: 'author-regression', which: 'membership' },
  ];
  const results = [];
  for (const spec of specs) {
    const context = await browser.newContext(), p = await context.newPage(), errors = [];
    p.on('pageerror', error => errors.push(String(error)));
    let result, cleanup, harnessError;
    try {
      if (spec.group === 'independent-probe-replay') {
        await p.goto(`${base}/docs/implementation/2026-11-16/baseline/implementation/storage/containment-follow-up/probe.html`);
        await p.evaluate(async () => {
          window.probe = await import('./independent-probes.js');
          await window.probe.install('typeforge-c-independent-' + crypto.randomUUID(), true);
        });
        result = await p.evaluate(which => window.probe.run(which), spec.which);
      } else {
        await p.goto(`${base}/typing-app/client/tests/browser/coach-storage.html`);
        result = await p.evaluate(which => window.runStorageContainmentCheck(which), spec.which);
      }
      await p.evaluate(() => new Promise(resolve => setTimeout(resolve, 0)));
    } catch (error) { harnessError = String(error); }
    finally {
      try {
        cleanup = spec.group === 'independent-probe-replay'
          ? await p.evaluate(() => window.probe.cleanup()) : result?.cleanup;
      } catch (error) { cleanup = { error: String(error) }; }
      await context.close();
    }
    results.push({ ...spec, result, externalPageErrors: errors, cleanup, harnessError });
  }
  return {
    browser: browser.version(), freshContexts: specs.length, ownedPagesClosed: specs.length,
    assertions: results.reduce((sum, item) => sum + (item.result?.assertions || 0), 0),
    failedAssertions: results.reduce((sum, item) => sum + (item.result?.failures?.length || 0), 0),
    externalPageErrorCount: results.reduce((sum, item) => sum + item.externalPageErrors.length, 0),
    results,
  };
};
