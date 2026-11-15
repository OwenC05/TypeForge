// Agent contract for the production settings rail (T4; extends the T1 wiring test).
// Starts its own Vite dev server (strict port, hidden), drives system Chrome headless through the
// test-only createAgent page, and removes its own dp-impl-agent-* profile afterwards.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

assert.ok(process.env.PLAYWRIGHT_MODULE, 'Set PLAYWRIGHT_MODULE to the scratchpad playwright-core/index.mjs');
const { chromium } = await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE)).href);
const port = Number(process.env.SDK_PORT || 5301);
const scratch = path.resolve(process.env.SDK_SCRATCHPAD || tmpdir());
const profile = mkdtempSync(path.join(scratch, 'dp-impl-agent-'));
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: process.cwd(), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
});
let serverOutput = '', serverExited = false, context;
server.stdout.on('data', chunk => { serverOutput += chunk; });
server.stderr.on('data', chunk => { serverOutput += chunk; });
server.on('exit', () => { serverExited = true; });
const results = [];
const check = (value, message, details) => { results.push({ name: message, ok: Boolean(value), ...(details === undefined ? {} : { details }) }); assert.ok(value, message); };
const errors = [];
const observed = {};
try {
  // Vite colours its banner; strip ANSI escapes before looking for the strict-port URL.
  for (let attempt = 0; !serverOutput.replace(/\u001b\[[0-9;]*m/g, '').includes(`http://127.0.0.1:${port}/`); attempt++) {
    assert.ok(!serverExited && attempt < 150, `Own strict-port server did not start: ${serverOutput}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  context = await chromium.launchPersistentContext(profile, { executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  async function open(query) {
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.editorEvents = [];
      for (const type of ['keydown', 'beforeinput', 'input']) document.addEventListener(type, event => {
        if (event.target.id === 'typing-input') window.editorEvents.push({ type, trusted: event.isTrusted });
      }, true);
    });
    await page.clock.install();
    await page.goto(`http://127.0.0.1:${port}/tests/browser/ui-sdk-proof.html${query}`);
    await page.waitForFunction(() => window.sdkProof?.ready && document.querySelector('#prompt span'));
    return page;
  }
  const api = page => ({
    snapshot: () => page.evaluate(() => window.sdkProof.agent.snapshot()),
    query: input => page.evaluate(input => window.sdkProof.agent.query(input), input),
    act: (ref, action, args = []) => page.evaluate(({ ref, action, args }) => window.sdkProof.agent.act({ steps: [{ ref, action, args }] }), { ref, action, args }),
    state: () => page.evaluate(() => ({
      duration: String(document.querySelector('#duration').value), kind: String(document.querySelector('#practice-kind').value),
      pair: customElements.get('ui-select') ? String(document.querySelector('#manual-pair').value) : null, qwerty: document.querySelector('#qwerty').checked,
      remaining: document.querySelector('#remaining').textContent, label: document.querySelector('#block-identity').textContent,
      run: document.querySelector('#stage').dataset.state, status: document.querySelector('#settings-status').textContent,
      value: document.querySelector('#typing-input').value, editorEvents: window.editorEvents.length, prompts: document.querySelector('#stage').dataset.promptIds,
    })),
    idle: () => page.waitForFunction(() => document.querySelector('#stage').dataset.state === 'idle' && !document.querySelector('#typing-input').disabled),
  });

  // ---- Idle: the agent reads and changes every setting through the same component APIs ----
  const page = await open('');
  const agent = api(page);
  const initial = await agent.snapshot();
  observed.initialSnapshot = initial;
  check(initial.filter(entry => !entry.offPage && entry.component !== 'more').every(entry => entry.label), 'Every agent entry is named');
  for (const label of ['Duration in seconds', 'Practice', 'Physical QWERTY keyboard']) check(initial.some(entry => entry.label === label), `Snapshot exposes ${label}`);
  check(!initial.some(entry => /textarea|input/.test(entry.component)), 'Native timed editor is not an agent component');
  const durationEntry = initial.find(entry => entry.label === 'Duration in seconds');
  check(durationEntry.items?.map(item => item.value).join() === '15,30,60,120', 'Duration choices are discovered from the rail', durationEntry.items);
  for (const item of durationEntry.items) {
    const result = await agent.act('Duration in seconds', 'setValue', [item.label]);
    await agent.idle();
    const state = await agent.state();
    check(result.ok && state.duration === item.value && state.remaining === item.value && state.label.endsWith(`${item.value}\u00a0s`), `Agent sets duration ${item.value}; stage re-prepares idle`, state);
    check(state.status === `Agent set duration to ${item.value}.`, `Accepted change keeps agent source (${item.value})`, state.status);
  }
  await agent.act('Duration in seconds', 'setValue', ['15']); await agent.idle();
  const kindEntry = (await agent.snapshot()).find(entry => entry.label === 'Practice');
  check(kindEntry.items?.some(item => item.value === 'recommended'), 'Suggested is listed among practice choices');
  const suggested = await agent.act('Practice', 'setValue', ['suggested']);
  check(!suggested.ok || (await agent.state()).kind === 'general', 'Unavailable Suggested is refused', suggested);
  check((await agent.state()).kind === 'general', 'Practice kind stays General after refused Suggested');
  check((await agent.act('Practice', 'setValue', ['pair'])).ok, 'Agent chooses pair practice');
  await page.waitForFunction(() => customElements.get('ui-select') && !document.querySelector('#manual-pair').hidden);
  await agent.idle();
  const pairQuery = await agent.query({ within: 'Pair' });
  observed.pairQuery = pairQuery;
  check(Array.isArray(pairQuery) && pairQuery[0]?.items?.length > 1, 'Agent discovers supported pairs after the list loads on demand', pairQuery?.[0]?.items?.length);
  const chosen = pairQuery[0].items[1];
  check((await agent.act('Pair', 'setValue', [chosen.label])).ok, `Agent chooses pair ${chosen.value}`);
  await agent.idle();
  let state = await agent.state();
  check(state.kind === 'manual' && state.pair === chosen.value && state.label.startsWith(`Pair practice · ${chosen.value}`), 'Pair practice block re-prepared with the chosen pair', state);
  check((await agent.act('Physical QWERTY keyboard', 'setChecked', [true])).ok, 'Agent declares QWERTY');
  await agent.idle();
  check((await agent.state()).qwerty === true, 'Real keyboard declaration changed');
  const invalid = await agent.act('Duration in seconds', 'setValue', ['999']);
  check(!invalid.ok && (await agent.state()).duration === '15', 'Unsupported agent duration refused', invalid.error);
  check(!(await agent.act('Physical QWERTY keyboard', 'setChecked', ['yes'])).ok, 'Wrong boolean type refused');
  const remembered = await page.evaluate(() => JSON.parse(localStorage.getItem('typeforge-preferences')));
  check(remembered.practice.durationSeconds === 15 && remembered.practice.kind === 'manual' && remembered.practice.pair === chosen.value && remembered.practice.qwerty === true, 'Agent choices are remembered like a person’s', remembered);
  check(!(await agent.act('typing-input', 'setValue', ['injected'])).ok, 'ID cannot target native editor');
  check(!(await agent.act('Type the passage', 'setValue', ['injected'])).ok, 'Accessible label cannot target native editor');
  state = await agent.state();
  check(state.value === '' && state.editorEvents === 0 && state.run === 'idle' && state.remaining === '15', 'Agent writes insert no text, fire no editor events and start no timing', state);

  // ---- Keyboard sources are distinguished from agent sources ----
  await page.locator('#duration [data-checked]').focus();
  await page.keyboard.press('ArrowRight'); await agent.idle();
  state = await agent.state();
  check(state.duration === '30' && state.status === 'Keyboard set duration to 30.', 'Arrow key changes duration with keyboard source', state.status);
  check(await page.locator('#duration [data-checked]').evaluate(el => el === document.activeElement), 'Focus stays on the rail after a keyboard change (no theft to the editor)');
  await page.locator('#qwerty').focus(); await page.keyboard.press('Space'); await agent.idle();
  state = await agent.state();
  check(state.qwerty === false && state.status === 'Keyboard set qwerty to false.', 'Space toggles the switch with keyboard source', state.status);
  const pairTrigger = page.locator('#manual-pair ui-select-trigger button');
  await pairTrigger.focus(); await page.keyboard.press('Enter');
  check(await page.locator('#manual-pair ui-select-content').isVisible(), 'Pair list opens from keyboard');
  await page.keyboard.press('Escape');
  check(!await page.locator('#manual-pair ui-select-content').isVisible() && await pairTrigger.evaluate(el => el === document.activeElement), 'Escape closes the pair list and returns focus');

  // ---- Running: bridge lock denies every settings step; native typing is unaffected ----
  await page.locator('#typing-input').focus();
  await page.keyboard.press('a');
  state = await agent.state();
  check(state.run === 'running' && state.value === 'a', 'First native insertion starts the block once', state);
  const runningPrompts = state.prompts;
  for (const [label, action, value] of [['Duration in seconds', 'setValue', '60'], ['Practice', 'setValue', 'general'], ['Pair', 'setValue', pairQuery[0].items[0].label], ['Physical QWERTY keyboard', 'setChecked', true]]) {
    const result = await agent.act(label, action, [value]);
    check(!result.ok, `Agent denied during running block: ${label}`, result.error);
  }
  const programmatic = await page.evaluate(() => [document.querySelector('#duration').api.setValue('120'), String(document.querySelector('#duration').value), document.querySelector('#settings-status').textContent]);
  check(programmatic[0] === false && programmatic[1] === '30' && programmatic[2] === 'Programmatic change to duration refused: a block is running. Finish it or restart first.', 'App guard refuses direct API change with a source-aware reason', programmatic);
  state = await agent.state();
  check(state.value === 'a' && state.prompts === runningPrompts && state.run === 'running', 'Refused writes preserve native text, prompts and timing', state);
  await page.clock.fastForward(30000);
  await page.waitForFunction(() => document.querySelector('#save-state')?.textContent?.startsWith('Saved'));
  const saved = await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('typeforge');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => { const db = request.result; const all = db.transaction('results').objectStore('results').getAll(); all.onsuccess = () => { db.close(); resolve(all.result); }; all.onerror = () => { db.close(); reject(all.error); }; };
  }));
  check(saved.length === 1 && saved[0].metrics.attemptedCharacters === 1, 'Saved metrics count exactly one native insertion, zero agent keystrokes', saved[0]?.metrics);
  check(saved[0].settings.durationMs === 30000 && saved[0].metrics.elapsedMs === 30000 && saved[0].manualDrill?.pair === chosen.value, 'Saved duration, elapsed and pair are genuine engine values');

  // ---- Result: settings unlock; an agent change starts a fresh ready block in place ----
  check((await agent.act('Duration in seconds', 'setValue', ['15'])).ok, 'Agent may change settings from the result');
  await agent.idle();
  state = await agent.state();
  check(state.run === 'idle' && state.duration === '15' && state.remaining === '15' && state.value === '', 'Result-state change prepares a new 15 s block', state);
  await page.close();

  // ---- Bridge open: the app guard alone refuses agent changes during a run ----
  const open2 = await open('?bridge=open');
  const agent2 = api(open2);
  await open2.locator('#typing-input').focus();
  await open2.keyboard.press('b');
  const before = await agent2.state();
  const attempt = await agent2.act('Duration in seconds', 'setValue', ['60']);
  const after = await agent2.state();
  observed.bridgeOpenAttempt = { attempt, after };
  check(after.duration === before.duration && after.run === 'running' && after.value === 'b', 'With the bridge open, the running block still keeps its settings', { before: before.duration, after: after.duration, ok: attempt.ok, error: attempt.error });
  check(!attempt.ok || after.status.startsWith('Agent change to duration refused: a block is running'), 'Refusal is either a bridge/visibility failure or the app’s agent-sourced reason', { ok: attempt.ok, status: after.status, error: attempt.error });
  check(after.editorEvents === 3, 'Only the one real key reached the editor (keydown, beforeinput, input)', after.editorEvents);
  await open2.close();
  check(errors.length === 0, `No page errors: ${errors}`);
  const summary = { assertions: results.length, failed: results.filter(r => !r.ok).length, port, serverPid: server.pid, browser: context.browser()?.version() ?? null, results, observed, errors };
  if (process.env.SDK_AGENT_OUT) writeFileSync(process.env.SDK_AGENT_OUT, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ assertions: summary.assertions, failed: summary.failed, serverPid: server.pid, bridgeOpen: { ok: observed.bridgeOpenAttempt.attempt.ok, error: observed.bridgeOpenAttempt.attempt.error, status: observed.bridgeOpenAttempt.after.status } }, null, 1));
} catch (error) {
  console.log(JSON.stringify({ failedAt: results.length, last: results.at(-1), error: String(error), errors }, null, 1));
  if (process.env.SDK_AGENT_OUT) writeFileSync(process.env.SDK_AGENT_OUT, JSON.stringify({ results, observed, error: String(error), errors }, null, 2));
  process.exitCode = 1;
} finally {
  await context?.close();
  if (!serverExited) {
    const exited = new Promise(resolve => server.once('exit', resolve));
    server.kill();
    await exited;
  }
  assert.ok(profile.startsWith(scratch) && path.basename(profile).startsWith('dp-impl-agent-'));
  rmSync(profile, { recursive: true, force: true });
}
