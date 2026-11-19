// ET-2 browser evidence: saved history arriving late never re-freezes predictions.
// An init script gates IndexedDB open successes until the test releases them, so the app's optional
// calibration settles only after the chosen native interaction. Real timers (no Playwright clock);
// declared QWERTY so predictions are installed. -> ../late-history.json
import { launch, BASE, VIEWPORTS, target, active, writeJson } from './lib.mjs';
import { buildIdentity, finish } from './lib.mjs';

const gate = `(() => {
  let release; window.__historyGate = new Promise(resolve => { release = resolve; });
  window.__releaseHistory = () => { window.__releasedAt = performance.now(); release(); };
  window.__firstKeyAt = null; addEventListener('keydown', () => { window.__firstKeyAt ??= performance.now(); }, true);
  window.__deliveredAt = [];
  const setter = Object.getOwnPropertyDescriptor(IDBRequest.prototype, 'onsuccess').set;
  const open = IDBFactory.prototype.open;
  IDBFactory.prototype.open = function (...args) {
    const request = open.apply(this, args);
    Object.defineProperty(request, 'onsuccess', { configurable: true, set(handler) {
      setter.call(request, event => window.__historyGate.then(() => { window.__deliveredAt.push(performance.now()); handler?.call(request, event); }));
    } });
    return request;
  };
})();`;
const results = [];
const check = (name, ok, details) => { results.push({ name, ok: Boolean(ok), ...(details === undefined ? {} : { details }) }); if (!ok) console.log('FAIL', name, JSON.stringify(details ?? null).slice(0, 400)); };
const scenarios = {
  'idle': async () => {},
  'native no-op (Backspace at the start)': async page => { await page.keyboard.press('Backspace'); },
  'accepted input': async (page, text) => { await page.keyboard.type(text.slice(0, 3), { delay: 20 }); },
  'next sentence': async (page, text) => { await page.keyboard.type(text + ' ', { delay: 5 }); },
  'restart before history': async (page, text) => { await page.keyboard.type(text.slice(0, 2), { delay: 20 }); await page.locator('#restart').click(); await page.locator('#typing-input').focus(); },
};
const report = { generatedAt: new Date().toISOString(), base: BASE, build: await buildIdentity(), scenarios: {} };
for (const url of ['/?qwerty=1&duration=30', '/?qwerty=1&duration=30&practice=recommended']) {
  for (const [name, act] of Object.entries(scenarios)) {
    const { context, page, errors } = await launch(`late-${Object.keys(scenarios).indexOf(name)}`, VIEWPORTS[1440]);
    await page.addInitScript(gate);
    await page.goto(BASE + url);
    await page.locator('#prompt span').first().waitFor();
    await page.locator('#typing-input').focus();
    const first = await target(page);
    await act(page, first);
    const before = await page.evaluate(() => ({ value: document.querySelector('#typing-input').value, state: document.querySelector('#stage').dataset.state, prediction: document.querySelector('#prediction-state').textContent }));
    await page.evaluate(() => window.__releaseHistory());
    await page.waitForFunction(() => window.__deliveredAt.length > 0);
    await page.waitForTimeout(400); // let calibration's page reads and the late callback run
    const next = await target(page);
    await page.keyboard.type(next.slice(before.state === 'running' && name !== 'next sentence' ? before.value.length : 0).slice(0, 4), { delay: 20 });
    const after = await page.evaluate(() => ({ value: document.querySelector('#typing-input').value, state: document.querySelector('#stage').dataset.state, prediction: document.querySelector('#prediction-state').textContent, firstKeyAt: window.__firstKeyAt, releasedAt: window.__releasedAt, deliveredAt: window.__deliveredAt[0] }));
    const key = `${url} · ${name}`;
    report.scenarios[key] = { before, after, focused: await active(page), errors };
    check(`${key}: no page error (no second freeze)`, errors.length === 0, errors);
    check(`${key}: history delivered after the interaction`, name === 'idle' || after.deliveredAt > after.firstKeyAt, after);
    check(`${key}: typing continues natively after late history`, after.state === 'running' && after.value.length > 0 && await active(page) === 'textarea#typing-input', after);
    await context.close();
  }
}
report.results = results;
report.summary = { checks: results.length, failed: results.filter(r => !r.ok).length, pageErrors: Object.values(report.scenarios).reduce((n, f) => n + (f.errors?.length ?? 0), 0) };
writeJson('late-history.json', report);
console.log(JSON.stringify(report.summary));
finish(report.summary);
