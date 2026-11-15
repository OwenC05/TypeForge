import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

assert.ok(process.env.PLAYWRIGHT_MODULE, 'Set PLAYWRIGHT_MODULE to the scratchpad playwright-core/index.mjs');
const { chromium } = await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE)).href);
const profile = mkdtempSync(path.join(process.env.SDK_SCRATCHPAD || tmpdir(), 'dp-sdk-agent-'));
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5302', '--strictPort'], {
  cwd: process.cwd(), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
});
let serverOutput = '', serverExited = false, browser;
server.stdout.on('data', chunk => { serverOutput += chunk; });
server.stderr.on('data', chunk => { serverOutput += chunk; });
server.on('exit', () => { serverExited = true; });
let assertions = 0;
const check = (value, message) => { assert.ok(value, message); assertions++; };
const errors = [];
try {
  for (let attempt = 0; !serverOutput.includes('http://127.0.0.1:5302/'); attempt++) {
    assert.ok(!serverExited && attempt < 100, `Own strict-port server did not start: ${serverOutput}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launchPersistentContext(profile, {
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.editorEvents = [];
    for (const type of ['keydown', 'beforeinput', 'input']) document.addEventListener(type, event => {
      if (event.target.id === 'typing-input') window.editorEvents.push({ type, trusted: event.isTrusted });
    }, true);
  });
  await page.clock.install();
  await page.goto('http://127.0.0.1:5302/tests/browser/ui-sdk-proof.html?mode=practice&duration=30');
  await page.waitForFunction(() => window.sdkProof?.ready && !document.querySelector('#duration').disabled);
  const snapshot = () => page.evaluate(() => window.sdkProof.agent.snapshot());
  const act = (ref, action, args = []) => page.evaluate(async ({ ref, action, args }) =>
    window.sdkProof.agent.act({ steps: [{ ref, action, args }] }), { ref, action, args });
  const ready = () => page.waitForFunction(() => !document.querySelector('#duration').disabled);
  check((await act('Proof options', 'setOpen', [true])).ok, 'Agent opens disclosure');
  check(await page.locator('ui-collapsible-panel').isVisible(), 'Disclosure opens in DOM');
  const initial = await snapshot();
  check(initial.filter(entry => !entry.offPage && entry.component !== 'more').every(entry => entry.label), 'Every agent entry is named');
  for (const label of ['Proof options', 'Block length', 'Exercise category', 'Letter pair', 'Physical QWERTY', 'Close proof panel']) {
    check(initial.some(entry => entry.label === label), `Snapshot exposes ${label}`);
  }
  check(!initial.some(entry => /textarea|input/.test(entry.component)), 'Native timed editor is excluded');
  await page.getByRole('button', { name: 'Proof options', exact: true }).focus();
  for (const selector of ['#sdk-duration [data-checked]', '#sdk-kind [data-checked]', '#sdk-pair ui-select-trigger button', '#sdk-qwerty', '#sdk-done button']) {
    await page.keyboard.press('Tab');
    check(await page.locator(selector).evaluate(el => el === document.activeElement), `Tab reaches ${selector}`);
  }
  const length = initial.find(entry => entry.label === 'Block length');
  const fifteen = length.items.find(item => item.value === '15');
  check(Boolean(fifteen), 'Duration comes from agent-discovered choices');
  for (const item of length.items) {
    check((await act('Block length', 'setValue', [item.label])).ok, `Agent selects ${item.label}`);
    await ready();
    check(await page.locator('#duration').inputValue() === item.value, `Real app adopts ${item.label}`);
  }
  check((await act('Block length', 'setValue', [fifteen.label])).ok, 'Agent sets duration by discovered label');
  await ready();
  check(await page.locator('#duration').inputValue() === '15' && await page.locator('#remaining').innerText() === '15', 'Real app and timer adopt duration');
  const kind = initial.find(entry => entry.label === 'Exercise category');
  const manual = kind.items.find(item => item.label === 'Manual pair');
  check((await act('Exercise category', 'setValue', [manual.label])).ok, 'Agent chooses Manual pair');
  await ready();
  check(await page.locator('#practice-kind').inputValue() === 'manual', 'Real practice kind changed');
  check((await act('Exercise category', 'setValue', [kind.items.find(item => item.value === 'general').label])).ok, 'Agent chooses General');
  await ready();
  check(await page.locator('#practice-kind').inputValue() === 'general', 'Real app returns to General');
  await act('Exercise category', 'setValue', [manual.label]);
  await ready();
  const pairQuery = await page.evaluate(() => window.sdkProof.agent.query({ within: 'Letter pair' }));
  check(Array.isArray(pairQuery) && pairQuery[0].items.length > 1, 'Agent discovers actual supported pairs');
  const chosenPair = pairQuery[0].items[1];
  check((await act('Letter pair', 'setValue', [chosenPair.label])).ok, 'Agent chooses pair from query');
  await ready();
  check(await page.locator('#manual-pair').inputValue() === chosenPair.value, 'Real pair changed');
  check((await act('Physical QWERTY', 'setChecked', [true])).ok, 'Agent declares QWERTY');
  await ready();
  check(await page.locator('#qwerty').isChecked(), 'Real keyboard declaration changed');
  const invalid = await act('Block length', 'setValue', ['999']);
  check(!invalid.ok && await page.locator('#duration').inputValue() === '15', 'Unsupported agent duration refused');
  const recommended = await act('Exercise category', 'setValue', ['Recommended']);
  check(await page.locator('#practice-kind').inputValue() === 'manual', 'Unavailable recommendation remains refused');
  check(!(await act('Physical QWERTY', 'setChecked', ['yes'])).ok, 'Wrong boolean type refused');
  check((await page.locator('#sdk-source').innerText()).startsWith('agent:'), 'Source is labelled visibly');
  const propertyProbe = await page.evaluate(() => {
    const element = document.querySelector('#sdk-duration');
    const before = window.sdkProof.changes.length;
    const original = element.value;
    element.value = '60';
    const property = { value: element.value, callbacks: window.sdkProof.changes.length - before };
    element.value = original;
    const apiAccepted = element.api.setValue('999');
    return { property, apiAccepted, value: element.value };
  });
  check(propertyProbe.property.value === '60' && propertyProbe.property.callbacks === 0, 'Live property assignment emits no validation event (documented difference)');
  check(!propertyProbe.apiAccepted && propertyProbe.value === '15', 'API refuses unsupported duration without committing it');
  check(!(await act('typing-input', 'setValue', ['injected'])).ok, 'ID cannot target native editor');
  check(!(await act('Type the moving passage', 'setValue', ['injected'])).ok, 'Accessible label cannot target native editor');
  check(await page.locator('#typing-input').inputValue() === '', 'Agent writes insert no native text');
  check((await page.evaluate(() => window.editorEvents)).length === 0, 'Agent writes fire no editor key/beforeinput/input events');
  check(await page.locator('#remaining').innerText() === '15' && !await page.locator('#duration').isDisabled(), 'Agent writes do not start timed block');
  const changes = await page.evaluate(() => window.sdkProof.changes);
  check(['duration', 'practice', 'pair', 'qwerty'].every(setting => changes.some(change => change.setting === setting && change.source === 'agent' && change.accepted)), 'Accepted changes retain agent source');
  check((await act('Close proof panel', 'press')).ok, 'Agent invokes Button action');
  check(!await page.locator('ui-collapsible-panel').isVisible(), 'Button closes disclosure');
  await page.getByRole('button', { name: 'Proof options', exact: true }).press('Enter');
  check(await page.locator('ui-collapsible-panel').isVisible(), 'Native Enter opens disclosure');
  const pairTrigger = page.locator('#sdk-pair ui-select-trigger button');
  await pairTrigger.press('Enter');
  check(await page.locator('ui-select-content').isVisible(), 'Pair chooser opens from keyboard');
  await page.keyboard.press('Escape');
  check(!await page.locator('ui-select-content').isVisible() && await pairTrigger.evaluate(el => el === document.activeElement), 'Pair chooser Escape closes and returns focus');
  await page.locator('#sdk-duration [data-checked]').focus();
  await page.keyboard.press('ArrowRight');
  await ready();
  check(await page.locator('#duration').inputValue() === '30', 'Arrow navigation changes real duration');
  await page.locator('#sdk-duration [data-checked]').focus();
  await page.keyboard.press('ArrowLeft');
  await ready();
  check(await page.locator('#duration').inputValue() === '15', 'Reverse arrow navigation changes real duration');
  await act('Block length', 'setValue', [fifteen.label]);
  await ready();
  await page.locator('#sdk-qwerty').focus();
  await page.keyboard.press('Space');
  await ready();
  check(!await page.locator('#qwerty').isChecked(), 'Native Space toggles switch');
  check((await page.evaluate(() => window.sdkProof.changes)).some(change => change.setting === 'qwerty' && change.source === 'keyboard'), 'Keyboard source distinguished from agent');
  await page.locator('#sdk-kind [data-checked]').focus();
  await act('Proof options', 'setOpen', [false]);
  check(await page.getByRole('button', { name: 'Proof options', exact: true }).evaluate(el => el === document.activeElement), 'Closing disclosure restores trigger focus');
  await act('Proof options', 'setOpen', [true]);
  const before = await page.evaluate(() => window.editorEvents.length);
  await page.locator('#typing-input').press('a');
  check(await page.locator('#typing-input').inputValue() === 'a' && await page.locator('#duration').isDisabled(), 'First native insertion starts real block once');
  for (const label of ['Block length', 'Exercise category', 'Letter pair', 'Physical QWERTY']) {
    const entry = label === 'Letter pair' ? pairQuery[0] : initial.find(item => item.label === label);
    check(!(await act(label, label === 'Physical QWERTY' ? 'setChecked' : 'setValue', [label === 'Physical QWERTY' ? true : entry.items[0].label])).ok, `Agent denied during running block: ${label}`);
  }
  const canceled = await page.evaluate(() => document.querySelector('#sdk-duration').api.setValue('120'));
  check(canceled === false && await page.locator('#duration').inputValue() === '15', 'Callback also refuses direct API changes while running');
  check(await page.locator('#typing-input').inputValue() === 'a', 'Refused agent writes preserve native text');
  await page.clock.fastForward(15000);
  await page.waitForURL('**/results.html?*');
  const saved = await page.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open('typeforge');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const request = db.transaction('results').objectStore('results').getAll();
      request.onerror = () => { db.close(); reject(request.error); };
      request.onsuccess = () => { db.close(); resolve(request.result); };
    };
  }));
  check(saved.length === 1 && saved[0].metrics.attemptedCharacters === 1, 'Saved metrics count exactly one native insertion, zero agent keystrokes');
  check(saved[0].settings.durationMs === 15000 && saved[0].metrics.elapsedMs === 15000, 'Saved duration and elapsed are genuine engine values');
  check(errors.length === 0, `No page errors: ${errors}`);
  console.log(JSON.stringify({ assertions, failed: 0, browser: browser.browser().version(), serverPid: server.pid, nativeEventsBeforeFirstKey: before, propertyProbe, initialSnapshot: initial, recommendationResult: recommended, errors }, null, 2));
} finally {
  await browser?.close();
  if (!serverExited) {
    const exited = new Promise(resolve => server.once('exit', resolve));
    server.kill();
    await exited;
  }
  assert.ok(profile.startsWith(path.resolve(process.env.SDK_SCRATCHPAD || tmpdir())) && path.basename(profile).startsWith('dp-sdk-'));
  rmSync(profile, { recursive: true, force: true });
}
