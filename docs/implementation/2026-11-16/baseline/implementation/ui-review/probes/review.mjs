// Independent actual-Claude review probe (task_a5b737f7f6e0). Reviewer-owned; not an author script.
// Oracles come from ux/contract.md, ux/handoff.md, ux/finite-plan-end.md and ux/delta-r2.1.md, not from F's tests.
//
// REVIEW_PHASE=prod : the production build under its own hidden `vite preview` on strict 127.0.0.1:5326.
//                     Every flow is real native key presses into the textarea with real C/D/E. The only
//                     non-typed fault is a labelled `real-fault` (IDB readwrite transactions throw) for the
//                     failed tenth save. Nothing injects a status, admission, proof or fixture.
// REVIEW_PHASE=dev  : the dev server (unminified, for page-error stacks) for the abort race observation.
//
// Every context is fresh. An init script redirects indexedDB.open('typeforge') to a UUID synthetic name and
// refuses every other name and deleteDatabase; each world verifies the interception before relying on storage.
import { spawn } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, '..');
const CLIENT = path.resolve(here, '../../../../../../../typing-app/client');
const PORT = 5326;
const PHASE = process.env.REVIEW_PHASE ?? 'prod';
const { chromium } = await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE)).href);
const corpus = JSON.parse(readFileSync(path.join(here, 'plans.json'), 'utf8'));
const SCREENS = path.join(OUT, 'screens');
mkdirSync(SCREENS, { recursive: true });

const checks = [];
const observations = [];
const pageErrors = [];
const databases = [];
function check(id, kind, ok, detail = {}) { checks.push({ id, kind, ok: Boolean(ok), ...(Object.keys(detail).length ? { detail } : {}) }); if (!ok) console.error('FAIL', id, JSON.stringify(detail).slice(0, 400)); }
function observe(id, detail) { observations.push({ id, ...detail }); }
const norm = s => (s ?? '').replace(/[\s\u00a0\u202f]+/g, ' ').trim();

// ---- Hidden owned server ----
const free = () => new Promise(resolve => { const s = net.createServer(); s.once('error', () => resolve(false)); s.listen(PORT, '127.0.0.1', () => s.close(() => resolve(true))); });
if (!(await free())) throw new Error(`port ${PORT} is not free`);
const PREVIEW = PHASE === 'prod' || PHASE === 'native320' || PHASE === 'firstkey';
const args = PREVIEW ? ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort']
  : ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'];
const server = spawn(process.execPath, args, { cwd: CLIENT, windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
let serverLog = ''; server.stdout.on('data', d => { serverLog += d; }); server.stderr.on('data', d => { serverLog += d; });
const receipt = { phase: PHASE, port: PORT, node: process.execPath, started: new Date().toISOString(),
  server: { pid: server.pid, executable: process.execPath, args, cwd: CLIENT, windowsHide: true, shell: false } };
const BASE = `http://127.0.0.1:${PORT}`;
for (let i = 0; ; i++) {
  try { const r = await fetch(`${BASE}/`); if (r.ok) break; } catch { /* starting */ }
  if (i > 200) throw new Error(`server did not start: ${serverLog}`);
  await new Promise(r => setTimeout(r, 100));
}
if (PREVIEW) {
  const assets = readdirSync(path.join(CLIENT, 'dist/assets'));
  receipt.dist = { app: assets.filter(a => /^app-.*\.(js|css)$/.test(a)),
    appJsSha256: createHash('sha256').update(readFileSync(path.join(CLIENT, 'dist/assets', assets.find(a => /^app-.*\.js$/.test(a))))).digest('hex') };
}

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
receipt.browser = { executable: 'C:/Program Files/Google/Chrome/Application/chrome.exe', version: browser.version(), headless: true, launchedBy: 'playwright-core 1.65.1 launch (temporary profile)' };
const START = new Date('2026-11-18T09:00:00Z');

function installSyntheticDatabase(name) {
  const factory = globalThis.indexedDB;
  const open = factory.open.bind(factory);
  let redirected = 0;
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: new Proxy(factory, { get(target, property) {
    if (property === 'open') return (requested, version) => {
      if (requested !== 'typeforge') throw new Error(`review fixture refused database ${requested}`);
      redirected++; return version === undefined ? open(name) : open(name, version);
    };
    if (property === 'deleteDatabase') return () => { throw new Error('review fixture refuses deleteDatabase'); };
    const value = Reflect.get(target, property, target); return typeof value === 'function' ? value.bind(target) : value;
  } }) });
  Object.defineProperty(globalThis, '__review', { value: { name, redirected: () => redirected } });
}

const worlds = [];
async function world(label, { viewport = { width: 1440, height: 900 }, clock = true, reducedMotion = 'no-preference' } = {}) {
  const name = `typeforge-review-synthetic-${randomUUID()}`;
  databases.push(name);
  const context = await browser.newContext({ viewport, reducedMotion, deviceScaleFactor: 1 });
  await context.addInitScript(installSyntheticDatabase, name);
  if (clock) { await context.clock.install({ time: START }); await context.clock.pauseAt(new Date(START.getTime() + 1000)); }
  const w = { label, name, context, pages: [] };
  worlds.push(w);
  return w;
}
async function open(w, url) {
  const page = await w.context.newPage();
  page.on('pageerror', error => pageErrors.push({ world: w.label, url: page.url(), message: error.message, stack: (error.stack ?? '').split('\n').slice(0, 6).join(' | ') }));
  page.on('console', message => { if (message.type() === 'error') pageErrors.push({ world: w.label, url: page.url(), console: message.text() }); });
  page.on('dialog', dialog => dialog.accept());
  w.pages.push(page);
  await page.goto(`${BASE}${url}`);
  return page;
}
async function verifyIsolation(w, page) {
  const state = await page.evaluate(async () => ({ name: globalThis.__review?.name, redirected: globalThis.__review?.redirected(), list: (await indexedDB.databases()).map(d => d.name) }));
  check(`isolation/${w.label}: synthetic interception installed before app storage use`, 'harness', state.name === w.name && state.redirected > 0 && state.list.every(n => n === w.name), state);
}
const settle = async (page, rounds = 10) => { for (let i = 0; i < rounds; i++) { await page.clock.runFor(40); await page.waitForTimeout(25); } };
// Source text, not innerText: the design uppercases micro labels with CSS, and the oracle is the copy itself.
// Block boundaries become spaces so sentences in sibling elements never run together.
const text = (page, selector) => page.evaluate(s => {
  const root = document.querySelector(s); if (!root) return null;
  const parts = []; const walk = node => { for (const child of node.childNodes) {
    if (child.nodeType === 3) parts.push(child.textContent); else if (child.nodeType === 1 && !['SCRIPT', 'STYLE'].includes(child.tagName)) { parts.push(' '); walk(child); if (child.shadowRoot) walk(child.shadowRoot); parts.push(' '); }
  } }; walk(root); return parts.join('');
}, selector);
const label = async page => norm(await text(page, '#block-identity'));
const slot = async page => norm(await text(page, '#slot'));
const active = page => page.evaluate(() => { const a = document.activeElement; return a ? (a.id || a.tagName.toLowerCase()) + (a.textContent && a.tagName !== 'TEXTAREA' ? `:${a.textContent.trim().slice(0, 40)}` : '') : null; });
const prompt = async page => (await page.evaluate(() => document.querySelector('#target-description')?.textContent ?? '')).replace(/^Passage to copy: /, '');
const stageState = page => page.evaluate(() => document.querySelector('#stage')?.dataset.state);
async function waitFor(page, predicate, what, rounds = 150) {
  for (let i = 0; i < rounds; i++) { if (await predicate()) return true; await page.clock.runFor(40); await page.waitForTimeout(25); }
  throw new Error(`timed out waiting for ${what}`);
}
const waitSaved = page => waitFor(page, async () => /Saved in this browser|could not be saved|cannot be saved/.test(await text(page, '#save-state') ?? ''), 'save settled');

// Native key presses with scripted intervals under the paused clock.
async function typeBlock(page, { base = 110, pairs = { th: 300 }, until = 30000, sentences = null, stopAfterChars = null } = {}) {
  let elapsed = 0, started = false, done = 0, prev = '', typed = 0;
  for (;;) {
    const state = await stageState(page);
    if (started && state !== 'running') return { elapsed, done };
    const target = await prompt(page);
    const value = await page.inputValue('#typing-input');
    for (const ch of target.slice(value.length) + ' ') {
      const interval = pairs?.[prev + ch] ?? base;
      if (started) {
        if (elapsed + interval >= until) { await page.clock.runFor(until - elapsed + 200); return { elapsed: until, done }; }
        await page.clock.runFor(interval); elapsed += interval;
      }
      await page.keyboard.type(ch); started = true; prev = ch; typed++;
      if (stopAfterChars && typed >= stopAfterChars) return { elapsed, done };
    }
    done++;
    if (sentences && done >= sentences) return { elapsed, done };
  }
}

async function layout(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const clipped = [...document.querySelectorAll('#slot button, #slot a, #result-actions .key, #carried button')].filter(el => {
      const r = el.getBoundingClientRect(); return r.width > 0 && (r.right > window.innerWidth + 0.5 || r.left < -0.5);
    }).map(el => el.textContent.trim());
    const slotEl = document.querySelector('#slot');
    const slotClip = slotEl ? [...slotEl.querySelectorAll('button, a')].filter(el => { const r = el.getBoundingClientRect(), s = slotEl.getBoundingClientRect(); return r.height > 0 && (r.bottom > s.bottom + 1 || r.top < s.top - 1); }).map(el => el.textContent.trim()) : [];
    const body = document.body.innerText;
    return { overflow: doc.scrollWidth > doc.clientWidth + 0.5, scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, clipped, slotClip,
      bad: (body.match(/\bundefined\b|\bNaN\b|\[object /g) ?? []) };
  });
}
const shots = [];
async function capture(page, name, sizes = [[1440, 900], [390, 844], [320, 640]], extra = {}) {
  const original = page.viewportSize();
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(60);
    const l = await layout(page);
    const file = `${width}-${name}.png`;
    await page.screenshot({ path: path.join(SCREENS, file) });
    shots.push({ file, state: name, width, height, ...extra, ...l });
    check(`layout/${name}@${width}: no horizontal overflow, clipped key or undefined copy`, extra.kind ?? 'real', !l.overflow && !l.clipped.length && !l.slotClip.length && !l.bad.length, l);
  }
  await page.setViewportSize(original);
  await page.waitForTimeout(40);
}
async function records(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('typeforge');
    request.onsuccess = () => { const db = request.result; const tx = db.transaction(['currentResults', 'results'], 'readonly');
      const a = tx.objectStore('currentResults').getAll(), b = tx.objectStore('results').getAll();
      tx.oncomplete = () => { db.close(); resolve([...a.result, ...b.result].map(r => ({ id: r.id, mode: r.mode, finite: 'schemaId' in r, schemaId: r.schemaId, completedAt: r.completedAt,
        eligible: r.eligibleForProgress, durationMs: r.settings?.durationMs, qwerty: r.settings?.qwerty, termination: r.termination, plan: r.plan?.pair,
        promptIds: (r.sentences ?? []).map(s => s.promptId), manual: r.manualDrill?.pair ?? null, practiceFocus: r.practiceFocus?.pair ?? null }))); };
      tx.onerror = () => reject(tx.error); };
    request.onerror = () => reject(request.error);
  }));
}
const bank = id => corpus.plans.th.ids.includes(id) ? 'th-plan' : corpus.practice[id] ? 'practice' : corpus.assessment[id] ? 'assessment' : 'unknown';

// ============================================================================================
async function prodPhase() {
  // ---- WP1 first visit: three fresh contexts, one per representative viewport ----
  for (const [width, height] of [[1440, 900], [390, 844], [320, 640]]) {
    const w = await world(`first-${width}`, { viewport: { width, height } });
    const p = await open(w, '/');
    await settle(p);
    await verifyIsolation(w, p);
    const state = await p.evaluate(() => ({ url: location.pathname + location.search, focus: document.activeElement?.id, qwerty: document.querySelector('#qwerty')?.checked,
      kind: document.querySelector('#practice-kind')?.value, duration: document.querySelector('#duration')?.value,
      locked: document.querySelector('#suggested-item')?.getAttribute('aria-disabled'), describedby: document.querySelector('#suggested-item')?.getAttribute('aria-describedby'),
      status: document.querySelector('#suggested-status')?.textContent, slot: document.querySelector('#slot')?.innerText, h1: [...document.querySelectorAll('h1')].map(h => h.textContent) }));
    check(`A1/${width}: / is practice itself, General 30 s, qwerty off, textarea focused, no landing`, 'real', state.url === '/' && state.focus === 'typing-input' && state.qwerty === false && state.kind === 'general' && String(state.duration) === '30' && norm(await label(p)) === 'General practice · 30 s' && state.h1.join() === 'Practice', state);
    check(`A3/${width}: Suggested locked but reachable (aria-disabled, described by an sr-only count)`, 'real', state.locked === 'true' && state.describedby === 'suggested-status' && state.status === 'Not yet available: 0 of 10 baseline tests.', state);
    check(`A1/${width}: 0 of 10 adds nothing visible to the ready slot`, 'real', norm(state.slot) === '', state);
    await capture(p, '01-first-visit', [[width, height]]);
    if (width === 1440) {
      // First key, Backspace and caret are native.
      await p.keyboard.type('x');
      const afterX = await p.evaluate(() => ({ value: document.querySelector('#typing-input').value, state: document.querySelector('#stage').dataset.state, wrong: document.querySelectorAll('#prompt .wrong').length, caret: [...document.querySelectorAll('#prompt span')].findIndex(s => s.classList.contains('cursor')) }));
      await p.keyboard.press('Backspace');
      const afterBack = await p.evaluate(() => ({ value: document.querySelector('#typing-input').value, caret: [...document.querySelectorAll('#prompt span')].findIndex(s => s.classList.contains('cursor')) }));
      check('WP1: first key starts the run once; Backspace removes it; caret follows', 'real', afterX.value === 'x' && afterX.state === 'running' && afterX.caret === 1 && afterBack.value === '' && afterBack.caret === 0, { afterX, afterBack });
    }
    await w.context.close();
  }

  // ---- WP1/WP5 keyboard, controls and why? on a fresh 1440 context ----
  {
    const w = await world('keyboard');
    const p = await open(w, '/');
    await settle(p);
    await verifyIsolation(w, p);
    const order = [];
    for (let i = 0; i < 12; i++) { await p.keyboard.press('Tab'); order.push(await active(p)); }
    observe('tab-order-from-textarea', { order });
    // Visible focus on a rail key reached by keyboard.
    await p.locator('#practice-kind ui-segmented-control-item[value="general"]').focus();
    const ring = await p.evaluate(() => { const s = getComputedStyle(document.activeElement); return { outline: `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}`, shadow: s.boxShadow }; });
    check('WP5: keyboard focus on a rail key has a visible indicator', 'real', !/none 0px/.test(ring.outline) || ring.shadow !== 'none', ring);
    // Locked Suggested by arrow keys and by Space: value kept, slot explains with one action.
    await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight');
    await settle(p, 3);
    const viaArrow = { value: await p.evaluate(() => document.querySelector('#practice-kind').value), focus: await active(p), slot: await slot(p) };
    await p.keyboard.press('Space'); await settle(p, 3);
    const viaSpace = { value: await p.evaluate(() => document.querySelector('#practice-kind').value), slot: await slot(p), actions: await p.evaluate(() => [...document.querySelectorAll('#slot-action a, #slot-action button')].map(a => [a.textContent, a.getAttribute('href')])) };
    check('A3: locked Suggested by keyboard keeps the current kind and explains in the slot with one action', 'real',
      viaSpace.value !== 'recommended' && /Suggested needs 10 baseline tests · 0 done\./.test(viaSpace.slot) && viaSpace.actions.length === 1 && /take test 1/.test(viaSpace.actions[0][0]), { viaArrow, viaSpace });
    check('A3: the press message fits the 75-character budget', 'real', viaSpace.slot.replace(/take test 1 →/, '').trim().length <= 75, { length: viaSpace.slot.length });
    await capture(p, '02-locked-press', [[1440, 900], [320, 640]]);
    // why? by keyboard.
    await p.locator('#why button').focus(); await p.keyboard.press('Enter'); await settle(p, 4);
    const whyText = norm(await text(p, '.why-panel'));
    check('A12: why? states 0 of 10, what counts, about five minutes of typing and the saved-tests source', 'real',
      /0 of 10/.test(whyText) && /about five minutes of typing/.test(whyText) && /mistakes included/.test(whyText) && /Counted from the tests saved in this browser/.test(whyText) && /physical QWERTY/.test(whyText), { whyText });
    await capture(p, '03-why-0of10', [[1440, 900], [390, 844], [320, 640]]);
    await p.keyboard.press('Escape');
    // Duration and manual practice change by pointer.
    await p.locator('#duration ui-segmented-control-item[value="60"]').click(); await settle(p, 4);
    const sixty = { label: await label(p), remaining: await text(p, '#remaining'), focus: await active(p) };
    await p.locator('#practice-kind ui-segmented-control-item[value="manual"]').click(); await settle(p, 6);
    const manual = { label: await label(p), pairVisible: await p.evaluate(() => !document.querySelector('#manual-pair').hidden) };
    check('WP1: duration and manual pair changes are ordinary and honest', 'real', sixty.label === 'General practice · 60 s' && sixty.remaining === '60' && /^Pair practice · \w\w · 60 s$/.test(manual.label) && manual.pairVisible, { sixty, manual });
    // Reduced motion and forced colours on the ready stage.
    await p.emulateMedia({ forcedColors: 'active' });
    await p.locator('#practice-kind ui-segmented-control-item[value="general"]').click(); await settle(p, 4);
    await p.locator('#typing-input').focus();
    await capture(p, '04-forced-colours-ready', [[1440, 900], [320, 640]], { kind: 'emulated' });
    await p.emulateMedia({ forcedColors: 'none' });
    await w.context.close();
  }
  {
    const w = await world('reduced-motion', { reducedMotion: 'reduce' });
    const p = await open(w, '/');
    await settle(p);
    const motion = await p.evaluate(() => { const c = document.querySelector('#prompt .cursor'); const s = c ? getComputedStyle(c) : null; const t = getComputedStyle(document.querySelector('.stage-cover') ?? document.body);
      return { cursorAnimation: s ? `${s.animationName} ${s.animationDuration}` : null, cursorAfter: c ? getComputedStyle(c, '::after').animationName : null, coverTransition: t.transitionDuration }; });
    observe('reduced-motion-ready', motion);
    await w.context.close();
  }

  // ---- Bounded loading observation (real clock, no throttling; not a latency guarantee) ----
  {
    const w = await world('loading', { clock: false });
    const page = await w.context.newPage();
    const requests = [];
    page.on('response', async r => { const t = r.request().resourceType(); if (['script', 'stylesheet', 'document'].includes(t)) { let size = 0; try { size = (await r.body()).length; } catch { /* */ } requests.push({ url: r.url().replace(BASE, ''), type: t, size }); } });
    page.on('pageerror', error => pageErrors.push({ world: 'loading', message: error.message }));
    const t0 = Date.now();
    await page.goto(`${BASE}/`);
    await page.waitForFunction(() => document.activeElement?.id === 'typing-input');
    const focusMs = Date.now() - t0;
    await page.waitForFunction(() => /baseline tests/.test(document.querySelector('#suggested-status')?.textContent ?? ''));
    const statusMs = Date.now() - t0;
    await page.waitForTimeout(300);
    observe('loading', { focusMs, statusMs, requests, totalScriptBytes: requests.filter(r => r.type === 'script').reduce((n, r) => n + r.size, 0) });
    await w.context.close();
  }

  // ---- WP2 baseline journey: ten real 30 s assessments, one context, native keys ----
  const w = await world('baseline');
  const p = await open(w, '/practice.html?duration=30');
  await settle(p);
  await verifyIsolation(w, p);
  const ready1 = { label: await label(p), slot: await slot(p), focus: await active(p), qwerty: await p.evaluate(() => document.querySelector('#qwerty').checked) };
  check('A5: qwerty off → "Assessment" label and the QWERTY declaration key; nothing inferred', 'real', ready1.label === 'Assessment · 30 s' && /Baseline tests need QWERTY\./.test(ready1.slot) && /my keyboard is qwerty/.test(ready1.slot) && ready1.qwerty === false && ready1.focus === 'typing-input', ready1);
  await capture(p, '05-assessment-declare', [[1440, 900], [390, 844], [320, 640]]);
  await p.locator('#slot-action button').click(); await settle(p, 12);
  const ready1b = { label: await label(p), focus: await active(p), qwerty: await p.evaluate(() => document.querySelector('#qwerty').checked), slot: await slot(p) };
  check('A5: the explicit declaration press gives "Baseline test 1 of 10 · 30 s" and focus returns to the text', 'real', ready1b.label === 'Baseline test 1 of 10 · 30 s' && ready1b.qwerty && ready1b.focus === 'typing-input', ready1b);
  const perTest = [];
  const resultText = async () => norm(await text(p, '#completion'));
  for (let n = 1; n <= 10; n++) {
    const before = await label(p);
    if (n === 4) {
      // Interrupted run: focus leaves the text mid-run (A7).
      await typeBlock(p, { stopAfterChars: 30 });
      await p.locator('#restart').focus();
      await p.clock.runFor(31000); await settle(p, 6);
      const flagged = { result: await resultText(), focus: await active(p) };
      check('A7: interrupted test 4 → not counted, nothing taken away, "try test 4 again" focused', 'real', /Not counted: focus left the text during the run\. Still 3 of 10; nothing is taken away\./.test(flagged.result) && /^again:try test 4 again/.test(flagged.focus ?? ''), flagged);
      await capture(p, '07-result-not-counted', [[1440, 900], [320, 640]]);
      await p.keyboard.press('Enter'); await settle(p, 12);
      check('A7: try again restarts test 4 with focus in the text', 'real', (await label(p)) === 'Baseline test 4 of 10 · 30 s' && (await active(p)) === 'typing-input', { label: await label(p) });
    }
    if (n === 10) await p.evaluate(() => { // real-fault: every readwrite transaction throws, until cleared
      const original = IDBDatabase.prototype.transaction;
      window.__fault = true;
      IDBDatabase.prototype.transaction = function (stores, mode, ...rest) { if (window.__fault && mode === 'readwrite') throw new DOMException('review fault', 'UnknownError'); return original.call(this, stores, mode, ...rest); };
    });
    const labelBefore = await label(p);
    await typeBlock(p);
    await waitSaved(p);
    // How long the result's count lags the confirmed save (contract: counts change only after a durable save).
    const lag = [];
    for (let i = 0; i < 40; i++) { const c = /(\d+) of 10 tests/.exec(norm(await text(p, '#baseline-result')))?.[1]; lag.push(c ?? '-'); if (c && Number(c) >= n) break; await p.clock.runFor(40); await p.waitForTimeout(25); }
    await settle(p, 6);
    const r = { n, labelBefore, lag: lag.join(','), result: await resultText(), focus: await active(p), save: norm(await text(p, '#save-state')) };
    perTest.push(r);
    if (n === 1) {
      check('A6/A8: test 1 completes in place, counted after save, "next test" focused', 'real', /^Baseline test 1 of 10 · 30 s · complete/.test(r.result) && /1 of 10 tests/.test(r.result) && r.save === 'Saved in this browser.' && /^again:next test/.test(r.focus ?? ''), r);
      await capture(p, '06-result-test1', [[1440, 900], [390, 844], [320, 640]]);
      // Enter immediately (0 ms of clock) while any follow-up status is still settling.
      await p.keyboard.press('Enter');
      const immediate = { label: await label(p), focus: await active(p) };
      await settle(p, 12);
      const fresh = { label: await label(p) };
      check('A19/REG-5a: Enter at once after test 1 → test 2; no stale or duplicate ordinal', 'real', ['Baseline test · 30 s', 'Baseline test 2 of 10 · 30 s'].includes(immediate.label) && fresh.label === 'Baseline test 2 of 10 · 30 s' && immediate.focus === 'typing-input', { immediate, fresh });
      continue;
    }
    if (n === 5) {
      // Real reload mid-baseline: the count is re-read from storage.
      await p.reload(); await settle(p, 14);
      check('WP2: reload after five saved tests → "Baseline test 6 of 10"', 'real', (await label(p)) === 'Baseline test 6 of 10 · 30 s', { label: await label(p) });
      continue;
    }
    if (n === 9) {
      check('A8: test 9 saved → 9 of 10, next test', 'real', /9 of 10 tests/.test(r.result) && /^again:next test/.test(r.focus ?? ''), r);
      await capture(p, '08-result-test9', [[1440, 900], [320, 640]]);
    }
    if (n === 10) {
      check('A6/REG-6b: failed tenth save → "Not saved yet, so it doesn’t count.", retry saving focused, no completion or unlock', 'real-fault',
        /Not saved yet, so it doesn’t count\./.test(r.result) && /^retry-primary:retry saving/.test(r.focus ?? '') && !/Baseline complete/.test(r.result) && /9 of 10/.test(r.result), r);
      await capture(p, '09-result-tenth-failed', [[1440, 900], [390, 844], [320, 640]], { kind: 'real-fault' });
      // ET-1 leaving guard while the tenth is unsaved.
      await p.locator('.site-nav a[href="./progress.html"]').click(); await settle(p, 3);
      const held = { url: new URL(p.url()).pathname, slot: await slot(p), focus: await active(p) };
      check('ET-1: leaving with the unsaved tenth is held once; export takes focus', 'real-fault', held.url === '/practice.html' && /export$/.test(held.focus ?? '') && /Leaving this page loses it/.test(held.slot), held);
      await p.evaluate(() => { window.__fault = false; });
      await p.locator('#retry-primary').focus(); await p.keyboard.press('Enter');
      await waitSaved(p); await settle(p, 20);
      const after = { result: await resultText(), focus: await active(p) };
      const completes = (after.result.match(/Baseline complete\./g) ?? []).length;
      perTest.push({ n: '10-retry', ...after });
      check('A9/REG-6b: retry saves the tenth once → exactly one "Baseline complete." and the median summary', 'real', completes === 1 && /Last 10 tests · median/.test(after.result) && /Updates as you take more 30-second tests\. Practice doesn’t change it\./.test(after.result), { after, completes });
      await capture(p, '10-result-baseline-complete', [[1440, 900], [390, 844], [320, 640]]);
      observe('tenth-outcome', after);
      continue;
    }
    await p.keyboard.press('Enter'); await settle(p, 12);
  }
  observe('baseline-per-test', { perTest });

  const final = perTest.at(-1);
  const ready = /Suggested has a focus: (\w\w)/.exec(final.result)?.[1] ?? null;
  observe('baseline-focus', { pair: ready });
  if (!ready) {
    check('A10: a complete baseline without a focus says so and leads with practise general', 'real', /^practice-next:practise general/.test(final.focus ?? ''), final);
  } else {
    check('A9: complete-ready → "try suggested · th ↵" is the focused primary; explanation is a rule of thumb, not a diagnosis', 'real',
      new RegExp(`^practice-next:try suggested · ${ready}`).test(final.focus ?? '') && /not a diagnosis/.test(final.result) && /took longer than your other key pairs: \d+ ms against \d+ ms/.test(final.result), final);
  }

  // ---- WP3 recommendation → practice ----
  await p.keyboard.press('Enter');
  await p.waitForURL(/index\.html/); await settle(p, 20);
  const sReady = { url: p.url(), label: await label(p), kind: await p.evaluate(() => document.querySelector('#practice-kind').value), focus: await active(p), ids: await p.evaluate(() => document.querySelector('#stage').dataset.promptIds.split(' ')), prompt: await prompt(p) };
  check('A9: Enter lands on / with Suggested checked, "Suggested practice · th · 30 s", focus in the text', 'real', sReady.label === `Suggested practice · ${ready} · 30 s` && sReady.kind === 'recommended' && sReady.focus === 'typing-input', sReady);
  check('WP3: the ready Suggested block shows the admitted certified plan (ids and displayed sentence)', 'real', ready === 'th' && JSON.stringify(sReady.ids) === JSON.stringify(corpus.plans.th.ids) && sReady.prompt === corpus.plans.th.texts[0], { ids: sReady.ids, prompt: sReady.prompt });
  await capture(p, '11-suggested-ready', [[1440, 900], [390, 844], [320, 640]]);
  await p.locator('#why button').click(); await settle(p, 4);
  const sWhy = norm(await text(p, '.why-panel'));
  check('A12/copy: why? explains th with ms, observations, words, runs; the plan line is truthful; rule-of-thumb limit; no mixing promise', 'real',
    /In your recent runs, th took longer than your other key pairs: \d+ ms against \d+ ms, across \d+ clean th transitions in \d+ different words and \d+ runs\./.test(sWhy)
    && /Every sentence in this block contains th\. It is one fixed set of sentences, so it can end before the timer\./.test(sWhy) && /not a diagnosis or a proven training method/.test(sWhy) && !/mixed in/i.test(sWhy), { sWhy });
  await capture(p, '12-suggested-why', [[1440, 900], [390, 844], [320, 640]]);
  await p.keyboard.press('Escape');
  await p.locator('#typing-input').focus();
  // Finite plan to its end: every displayed sentence contains th; end marker on the last; immediate end.
  const shown = [];
  for (let i = 0; i < 12; i++) {
    shown.push(await prompt(p));
    if (i === 11) observe('end-marker', { next: await text(p, '#next-prompt') });
    await typeBlock(p, { base: 35, pairs: null, sentences: 1 });
  }
  await settle(p, 6); await waitSaved(p);
  const end = { result: await resultText(), focus: await active(p), state: await stageState(p) };
  check('WP3: all 12 displayed sentences contain th and are the certified plan in order', 'real', JSON.stringify(shown) === JSON.stringify(corpus.plans.th.texts), { shown });
  check('REG-9/D2e: plan end → "all 12 sentences done at T s of 30", figures over T s, the observation, suggested again focused, no baseline copy, never "30 s · complete"', 'real',
    /^Suggested practice · th · all 12 sentences done at \d+(\.\d)? s of 30/.test(end.result) && /over the \d+(\.\d)? s typed/.test(end.result) && /That’s every sentence in this th block, so it ended before the timer\./.test(end.result)
    && /^again:suggested again/.test(end.focus ?? '') && !/Baseline|30 s · complete/.test(end.result), end);
  const elapsed = Number(/done at (\d+(?:\.\d)?) s/.exec(end.result)?.[1]);
  observe('plan-end-elapsed', { shownSeconds: elapsed, scriptedSecondsApprox: (corpus.plans.th.characters - 1) * 0.035 });
  await capture(p, '13-plan-end', [[1440, 900], [390, 844], [320, 640]]);
  // Suggested again → timer first (ordinary practice result).
  await p.keyboard.press('Enter'); await settle(p, 20);
  const again = { label: await label(p), ids: await p.evaluate(() => document.querySelector('#stage').dataset.promptIds.split(' ')) };
  await typeBlock(p, { base: 200, pairs: null }); await waitSaved(p); await settle(p, 4);
  const timerFirst = { againLabel: again.label, result: await resultText(), focus: await active(p) };
  check('finite rule 9: timer first → the ordinary practice result for the frozen Suggested block', 'real', again.label === 'Suggested practice · th · 30 s' && /^Suggested practice · th · 30 s · complete/.test(timerFirst.result) && /^again:suggested again/.test(timerFirst.focus ?? ''), timerFirst);
  // Flagged finite end: focus leaves mid-plan, then the plan is finished.
  await p.keyboard.press('Enter'); await settle(p, 20);
  await typeBlock(p, { base: 35, pairs: null, sentences: 2 });
  await p.locator('#restart').focus(); await p.locator('#typing-input').focus();
  await typeBlock(p, { base: 35, pairs: null, sentences: 10 });
  await settle(p, 6); await waitSaved(p);
  const flaggedEnd = { result: await resultText() };
  check('D2f/rule 11: flagged plan end leads with the flag, no figures, still states the early end', 'real',
    /^Suggested practice · th · all 12 sentences done at/.test(flaggedEnd.result) && /Flagged: this run was interrupted/.test(flaggedEnd.result) && !/wpm/i.test(flaggedEnd.result.split('suggested again')[0]) && !/That’s every sentence/.test(flaggedEnd.result), flaggedEnd);
  await capture(p, '14-plan-end-flagged', [[1440, 900], [320, 640]]);
  // Settings mismatch: 60 s with Suggested requested.
  await p.locator('#to-general').isVisible().catch(() => false);
  await p.locator('#duration ui-segmented-control-item[value="60"]').click(); await settle(p, 20);
  const sixty = { label: await label(p), slot: await slot(p), kind: await p.evaluate(() => document.querySelector('#practice-kind').value), why: '' };
  await p.locator('#why button').click(); await settle(p, 3); sixty.why = norm(await text(p, '.why-panel')); await p.keyboard.press('Escape');
  check('A23/D2a: Suggested at 60 s → honest "General practice · 60 s", slot hint with [use 30 s], why? names the rule, no focus evidence', 'real',
    sixty.label === 'General practice · 60 s' && /Suggested runs at 30 s only; this block is general\./.test(sixty.slot) && /use 30 s/.test(sixty.slot) && /Suggested blocks are 30 seconds with the qwerty key on/.test(sixty.why) && !/ms against/.test(sixty.why), sixty);
  await capture(p, '15-suggested-60s', [[1440, 900], [390, 844], [320, 640]]);
  await p.locator('#slot-action button').click(); await settle(p, 24);
  const back = { label: await label(p), focus: await active(p) };
  check('A23: the person’s own [use 30 s] press re-admits Suggested th', 'real', back.label === 'Suggested practice · th · 30 s', back);

  // ---- WP2 Progress, summary, history and records ----
  const recs = await records(p);
  const assessments = recs.filter(r => r.mode === 'assessment');
  const finites = recs.filter(r => r.finite);
  observe('records', { total: recs.length, assessments: assessments.length, finite: finites.length, timedPractice: recs.filter(r => !r.finite && r.mode === 'practice').map(r => ({ id: r.id, promptBanks: [...new Set(r.promptIds.map(bank))], practiceFocus: r.practiceFocus, manual: r.manual })) });
  check('WP2: storage holds 11 assessments (one flagged) and the finite sources as themselves', 'real', assessments.length === 11 && assessments.filter(r => !r.eligible).length === 1 && finites.length === 2 && finites.every(r => r.termination === 'plan-exhausted' && r.plan === 'th'), { assessments: assessments.length, finites });
  const g = await open(w, '/progress.html'); await settle(g, 20);
  const prog = norm(await text(g, '.baseline-section'));
  const table = norm(await text(g, '#history-rows'));
  check('A18/A20: Progress shows one count 10 of 10, Last 10 tests · median with dates and the update note, one provenance line, no take-test key', 'real',
    (prog.match(/10 of 10/g) ?? []).length === 1 && /Last 10 tests · median/.test(prog) && /Updates as you take more 30-second tests/.test(prog) && /From 30-second assessments saved in this browser with the qwerty key on\. Practice blocks don’t count\./.test(prog) && !/take test/.test(prog), { prog });
  check('WP2: history lists finite blocks as themselves', 'real', (table.match(/Suggested practice · th/g) ?? []).length === 2 && /Ended early · practice only/.test(table) && /Flagged/.test(table), { table: table.slice(0, 600) });
  await capture(g, '16-progress-complete', [[1440, 900], [390, 844], [320, 640]]);
  // Timer-first record on the results page: what does it call itself?
  const timerRecord = recs.filter(r => !r.finite && r.mode === 'practice').find(r => r.promptIds.some(id => bank(id) === 'th-plan'));
  if (timerRecord) {
    const rp = await open(w, `/results.html?id=${encodeURIComponent(timerRecord.id)}`); await settle(rp, 10);
    const tag = norm(await text(rp, '.tag'));
    observe('timer-first-results-page', { tag, promptBanks: [...new Set(timerRecord.promptIds.map(bank))] });
    await rp.screenshot({ path: path.join(SCREENS, '1440-17-results-timer-first.png') });
    await rp.close();
  }

  // ---- WP4 known F defect, settle path: deletion of a counted test while a ready Suggested tab is open ----
  const a = p; // '/' Suggested ready (th) after [use 30 s]
  const aBefore = { label: await label(a), ids: (await a.evaluate(() => document.querySelector('#stage').dataset.promptIds)).split(' '), prompt: await prompt(a) };
  const victim = assessments.filter(r => r.eligible).sort((x, y) => x.completedAt.localeCompare(y.completedAt))[0];
  const rp = await open(w, `/results.html?id=${encodeURIComponent(victim.id)}`); await settle(rp, 10);
  await rp.locator('#delete-result').click();
  await rp.waitForURL(/progress\.html/); await settle(rp, 24);
  const progAfter = norm(await text(rp, '.baseline-section'));
  check('A8/REG-2e: deleting a counted test through the results page → Progress 9 of 10, no median, take test 10', 'real', /9 of 10/.test(progAfter) && !/Last 10 tests · median/.test(progAfter) && /take test 10/.test(progAfter), { progAfter });
  await capture(rp, '18-progress-after-delete', [[1440, 900], [320, 640]]);
  await a.bringToFront(); await settle(a, 30);
  const aAfter = { label: await label(a), slot: await slot(a), kind: await a.evaluate(() => document.querySelector('#practice-kind').value), ids: (await a.evaluate(() => document.querySelector('#stage').dataset.promptIds)).split(' '), prompt: await prompt(a), status: await a.evaluate(() => document.querySelector('#suggested-status').textContent) };
  const displayedBank = corpus.plans.th.texts.includes(aAfter.prompt) ? 'th-plan' : Object.values(corpus.practice).includes(aAfter.prompt) ? 'practice' : 'unknown';
  const metadataFirst = corpus.practice[aAfter.ids[0]] ?? null;
  check('WP4: after the deletion the open ready tab steps back to an honest General label with a reason', 'real', aAfter.label === 'General practice · 30 s' && aAfter.kind === 'general' && /Not yet available: 9 of 10/.test(aAfter.status), aAfter);
  check('KNOWN-F settle fallback: the General block’s displayed sentence comes from the General selection (expected)', 'real-known-defect',
    displayedBank === 'practice' && aAfter.prompt === metadataFirst, { displayedBank, displayed: aAfter.prompt, metadataFirstId: aAfter.ids[0], metadataFirstText: metadataFirst, before: aBefore.prompt });
  await capture(a, '19-settle-fallback-after-delete', [[1440, 900], [320, 640]], { kind: 'real-known-defect' });
  // Finish this General block on the timer and inspect what was saved.
  await a.locator('#typing-input').focus();
  const typedPrompts = [];
  for (let i = 0; i < 3; i++) { typedPrompts.push(await prompt(a)); await typeBlock(a, { base: 110, pairs: null, sentences: 1 }); }
  await a.clock.runFor(31000); await settle(a, 6); await waitSaved(a);
  const settleResult = norm(await text(a, '#completion'));
  const settleRecords = (await records(a)).filter(r => !r.finite && r.mode === 'practice');
  const newest = settleRecords.sort((x, y) => y.completedAt.localeCompare(x.completedAt))[0];
  check('KNOWN-F settle fallback: the saved "General practice" record uses General prompts (expected)', 'real-known-defect',
    newest && newest.promptIds.every(id => bank(id) === 'practice'), { result: settleResult.slice(0, 80), savedPromptIds: newest?.promptIds, banks: newest && [...new Set(newest.promptIds.map(bank))], typedPrompts });

  // ---- Re-complete the baseline (test 10 again), then the first-key path via a reset in another tab ----
  const t = await open(w, '/practice.html?duration=30&qwerty=1'); await settle(t, 14);
  check('A8: after deletion the next assessment is "Baseline test 10 of 10"', 'real', (await label(t)) === 'Baseline test 10 of 10 · 30 s', { label: await label(t) });
  await typeBlock(t); await waitSaved(t); await settle(t, 20);
  const again10 = norm(await text(t, '#completion'));
  check('WP2: re-completing after deletion → Baseline complete once and the focus is admitted again', 'real', (again10.match(/Baseline complete\./g) ?? []).length === 1 && /Suggested has a focus: th/.test(again10), { again10: again10.slice(0, 400) });
  await t.keyboard.press('Enter'); await t.waitForURL(/index\.html/); await settle(t, 20);
  const fkBefore = { label: await label(t), prompt: await prompt(t) };
  // Reset in another tab of the same browser (C's resetEpoch through the Progress UI).
  const r2 = await open(w, '/progress.html'); await settle(r2, 20);
  await r2.locator('#reset').click(); await settle(r2, 2);
  const confirmFocus = await active(r2);
  await capture(r2, '20-progress-reset-confirm', [[1440, 900], [320, 640]]);
  // The clock is shared by the context: advancing it here would let the Suggested tab's queued re-check run first
  // (that is the settle path, covered above). The reset is plain IDB work, so wait on real time only.
  const preReset = { label: await label(t), state: await stageState(t) };
  await r2.locator('#start-over').click();
  let resetSettled = true;
  try { await r2.waitForFunction(() => (document.querySelector('#baseline-status')?.textContent ?? '').length > 0, null, { timeout: 15000 }); }
  catch { resetSettled = false; await settle(r2, 24); }
  observe('first-key-setup', { preReset, resetSettledOnRealTime: resetSettled, tLabelAfterReset: await label(t) });
  const resetDone = { status: norm(await text(r2, '#baseline-status')), focus: await active(r2), body: norm(await text(r2, '#baseline-body')) };
  check('K10/REG-2f: reset confirm focuses the safe choice; start over announces 0 of 10 after a proved re-read, focus to the heading, no median', 'real',
    /^keep:keep current baseline/.test(confirmFocus ?? '') && /^New baseline started: 0 of 10\. Earlier results are still in your history\.$/.test(resetDone.status) && /^baseline-heading/.test(resetDone.focus ?? '') && !/median/.test(resetDone.body), { confirmFocus, resetDone });
  await capture(r2, '21-progress-reset-done', [[1440, 900], [320, 640]]);
  // Back to the open Suggested tab: the first native key lands before the queued re-check runs (paused clock).
  await t.bringToFront();
  await t.locator('#typing-input').focus();
  const pre = { label: await label(t), prompt: await prompt(t) };
  await t.keyboard.type(pre.prompt[0]);
  const fk = { label: await label(t), slot: await slot(t), value: await t.inputValue('#typing-input'), state: await stageState(t), prompt: await prompt(t),
    ids: (await t.evaluate(() => document.querySelector('#stage').dataset.promptIds)).split(' '), focus: await active(t) };
  check('WP4/P1a: a first key after a known invalidation never starts the stale Suggested plan label; key accepted once; focus kept', 'real',
    fk.label === 'General practice · 30 s' && fk.value === pre.prompt[0] && fk.state === 'running' && fk.focus === 'typing-input' && /Suggested was re-checking your saved tests, so this block is general\./.test(fk.slot), { pre, fk: { ...fk, ids: undefined } });
  const fkBank = corpus.plans.th.texts.includes(fk.prompt) ? 'th-plan' : Object.values(corpus.practice).includes(fk.prompt) ? 'practice' : 'unknown';
  check('KNOWN-F first-key fallback: the General block’s running sentence comes from the General selection (expected)', 'real-known-defect',
    fkBank === 'practice' && fk.prompt === corpus.practice[fk.ids[0]], { fkBank, running: fk.prompt, metadataFirst: corpus.practice[fk.ids[0]] });
  await capture(t, '22-first-key-fallback', [[1440, 900], [320, 640]], { kind: 'real-known-defect' });
  // Complete and inspect the saved record.
  const fkTyped = await typeBlock(t, { base: 110, pairs: null });
  await waitSaved(t); await settle(t, 6);
  const fkRecords = (await records(t)).filter(r => !r.finite && r.mode === 'practice').sort((x, y) => y.completedAt.localeCompare(x.completedAt));
  check('KNOWN-F first-key fallback: the saved "General practice" record uses General prompts (expected)', 'real-known-defect',
    fkRecords[0].promptIds.every(id => bank(id) === 'practice'), { result: norm(await text(t, '#completion')).slice(0, 80), saved: fkRecords[0].promptIds, banks: [...new Set(fkRecords[0].promptIds.map(bank))], fkTyped });
  // Fresh reload after reset: no previous pair named, current state read.
  await t.goto(`${BASE}/?practice=recommended`); await settle(t, 20);
  const reload = { label: await label(t), slot: await slot(t), status: await t.evaluate(() => document.querySelector('#suggested-status').textContent) };
  check('A11/delta r2.1: reload after reset names no previous pair; Suggested request falls back to General with the no-focus line; 0 of 10', 'real',
    reload.label === 'General practice · 30 s' && !/\bth\b/.test(reload.slot) && /Not yet available: 0 of 10/.test(reload.status), reload);
  await capture(t, '23-reload-after-reset', [[1440, 900], [320, 640]]);
}

// ============================================================================================
// Dev phase: page-error stacks for the intermittent IDBTransaction abort seen in the SDK replay.
async function devPhase() {
  const w = await world('abort-race', { clock: false });
  const p = await open(w, '/');
  await p.waitForFunction(() => /baseline tests/.test(document.querySelector('#suggested-status')?.textContent ?? ''));
  await verifyIsolation(w, p);
  // Natural trigger: window focus is a C invalidation; the app aborts any in-flight preparation and queues another.
  for (let i = 0; i < 400; i++) {
    await p.evaluate(() => window.dispatchEvent(new Event('focus')));
    await p.waitForTimeout(i % 7);
  }
  await p.waitForTimeout(500);
  const relevant = pageErrors.filter(e => /abort|transaction/i.test(e.message ?? e.console ?? ''));
  observe('abort-race', { attempts: 400, errors: relevant.length, first: relevant.slice(0, 3) });
}

// Native 320x640 (no resizing): is the focused retry primary of a failed baseline save actually in view (A6)?
async function native320Phase() {
  const w = await world('native-320', { viewport: { width: 320, height: 640 } });
  const p = await open(w, '/practice.html?duration=30&qwerty=1');
  await settle(p, 14);
  await verifyIsolation(w, p);
  check('native320: ready label is Baseline test 1 of 10', 'real', (await label(p)) === 'Baseline test 1 of 10 · 30 s', { label: await label(p) });
  await p.evaluate(() => { const original = IDBDatabase.prototype.transaction; window.__fault = true;
    IDBDatabase.prototype.transaction = function (stores, mode, ...rest) { if (window.__fault && mode === 'readwrite') throw new DOMException('review fault', 'UnknownError'); return original.call(this, stores, mode, ...rest); }; });
  await typeBlock(p); await waitSaved(p); await settle(p, 8);
  const view = await p.evaluate(() => { const a = document.activeElement; const r = a.getBoundingClientRect();
    return { id: a.id, text: a.textContent.trim(), top: Math.round(r.top), bottom: Math.round(r.bottom), innerHeight, scrollY: Math.round(scrollY), inView: r.top >= 0 && r.bottom <= innerHeight }; });
  check('A6 native 320x640: failed save → retry saving is the focused primary and is in view', 'real-fault', view.id === 'retry-primary' && view.inView, view);
  await p.screenshot({ path: path.join(SCREENS, '320-native-failed-save.png') });
  const l = await layout(p);
  check('native320: no overflow or clipped keys on the failed result', 'real-fault', !l.overflow && !l.clipped.length && !l.bad.length, l);
}

// First-key fallback, isolated: the first native key lands while the stale admission's re-check is still queued.
// The page clock is never advanced between the invalidation and the key. Saved prompt ids are compared with the
// General selection the stage actually displayed (practice ids can also appear in a certified plan).
async function firstKeyPhase() {
  const w = await world('first-key');
  const p = await open(w, '/practice.html?duration=30&qwerty=1');
  await settle(p, 14);
  await verifyIsolation(w, p);
  for (let n = 1; n <= 10; n++) { await typeBlock(p); await waitSaved(p); await settle(p, n === 10 ? 24 : 8); await p.keyboard.press('Enter'); await settle(p, n === 10 ? 1 : 12); }
  await p.waitForURL(/index\.html/); await settle(p, 20);
  check('firstkey: ten typed tests admit Suggested th', 'real', (await label(p)) === 'Suggested practice · th · 30 s', { label: await label(p) });
  const other = await open(w, '/progress.html'); await settle(other, 16);
  async function variant(name, invalidate) {
    await p.goto(`${BASE}/?practice=recommended&duration=30&qwerty=1`); await settle(p, 24);
    const ready = { label: await label(p), prompt: await prompt(p) };
    // Observer only: counts the same cross-document signals C listens to; it changes nothing.
    await p.evaluate(() => { window.__reviewInvalidations = 0; const bump = () => { window.__reviewInvalidations++; };
      new BroadcastChannel('typeforge-source-invalidation-v3').onmessage = bump;
      window.addEventListener('storage', e => { if (e.key === 'typeforge-source-invalidation-v3') bump(); }); });
    const how = await invalidate();
    await p.locator('#typing-input').focus();
    const signals = await p.evaluate(() => window.__reviewInvalidations);
    const before = { label: await label(p), state: await stageState(p), prompt: await prompt(p), signals };
    await p.keyboard.type(before.prompt[0]);
    const after = { label: await label(p), slot: await slot(p), value: await p.inputValue('#typing-input'), state: await stageState(p), prompt: await prompt(p), focus: await active(p),
      ids: (await p.evaluate(() => document.querySelector('#stage').dataset.promptIds)).split(' ') };
    const isolated = before.label === 'Suggested practice · th · 30 s' && before.state === 'idle' && before.signals > 0;
    check(`firstkey/${name}: setup isolates the first-key path (still the admitted th block, idle, before the key)`, 'harness', isolated, { ready, how, before });
    const sameKey = after.value === before.prompt[0];
    check(`firstkey/${name}: the key starts an honest General block once, focus kept, re-check copy shown`, 'real',
      after.label === 'General practice · 30 s' && after.value.length === 1 && after.state === 'running' && after.focus === 'typing-input' && /Suggested was re-checking your saved tests, so this block is general\. It checks again for the next block\./.test(after.slot), { after: { ...after, ids: after.ids.slice(0, 3) }, sameKey });
    check(`firstkey/${name}: the running sentence is the first displayed General selection, not the th plan`, 'real',
      after.prompt === corpus.practice[after.ids[0]] && after.prompt !== corpus.plans.th.texts[0], { running: after.prompt, metadataFirst: corpus.practice[after.ids[0]], planFirst: corpus.plans.th.texts[0] });
    observe(`firstkey-${name}-first-character`, { typed: before.prompt[0], previousPlanFirst: corpus.plans.th.texts[0][0], newSentenceFirst: after.prompt[0], value: after.value, acceptedAsCorrect: after.value === after.prompt[0] });
    await capture(p, `24-first-key-${name}`, [[1440, 900], [320, 640]]);
    await typeBlock(p, { base: 110, pairs: null, until: 29500 }); await waitSaved(p); await settle(p, 6);
    const saved = (await records(p)).filter(r => !r.finite && r.mode === 'practice').sort((x, y) => y.completedAt.localeCompare(x.completedAt))[0];
    check(`firstkey/${name}: the saved "General practice" record carries exactly the displayed General sequence`, 'real',
      saved.promptIds.length > 0 && JSON.stringify(saved.promptIds) === JSON.stringify(after.ids.slice(0, saved.promptIds.length)) && saved.promptIds[0] !== corpus.plans.th.ids[0],
      { saved: saved.promptIds, displayed: after.ids.slice(0, saved.promptIds.length), result: norm(await text(p, '#completion')).slice(0, 60) });
  }
  // Headless bringToFront fires no window focus (attempt 2 showed the admission correctly stayed current), so the
  // invalidation is delivered by real cross-document mechanisms: the other tab writes C's invalidation key (a real
  // `storage` event in this tab, no stored data changed), or commits a real reset through C.
  await variant('storage-event', async () => {
    await other.evaluate(() => localStorage.setItem('typeforge-source-invalidation-v3', String(Math.random())));
    await other.waitForTimeout(300);
    return 'other tab wrote C invalidation key: real storage event, no data change';
  });
  await variant('reset', async () => {
    await other.goto(`${BASE}/progress.html`); await other.waitForTimeout(400);
    for (let i = 0; i < 60 && !/10 of 10/.test(norm(await text(other, '#baseline-body'))); i++) await other.waitForTimeout(100);
    await other.locator('#reset').click(); await other.locator('#start-over').click();
    // Wait on real time for C's commit (its re-read may need page timers; the commit and broadcast do not).
    let invalidated = false;
    for (let i = 0; i < 60 && !invalidated; i++) { invalidated = await p.evaluate(() => window.__reviewInvalidations > 0); if (!invalidated) await other.waitForTimeout(100); }
    return { invalidationObservedInThisTab: invalidated, status: norm(await text(other, '#baseline-status')) };
  });
}

let failure = null;
try { if (PHASE === 'prod') await prodPhase(); else if (PHASE === 'native320') await native320Phase(); else if (PHASE === 'firstkey') await firstKeyPhase(); else await devPhase(); }
catch (error) { failure = String(error?.stack ?? error); console.error(failure); }
finally {
  for (const w of worlds) { try { await w.context.close(); } catch { /* closed */ } }
  await browser.close();
  server.kill();
  await new Promise(r => server.exitCode !== null ? r() : server.once('exit', r));
  receipt.cleanup = { serverExitCode: server.exitCode, serverSignal: server.signalCode, portFree: await free(), contextsClosed: worlds.length, databases };
  receipt.finished = new Date().toISOString();
  const knownExpected = checks.filter(c => c.kind === 'real-known-defect');
  const output = { phase: PHASE, failure, summary: { checks: checks.length, passed: checks.filter(c => c.ok).length, failed: checks.filter(c => !c.ok).map(c => c.id),
    knownDefectChecks: knownExpected.map(c => ({ id: c.id, ok: c.ok })) }, checks, observations, pageErrors, shots };
  writeFileSync(path.join(OUT, `review-${PHASE}.json`), JSON.stringify(output, null, 1));
  writeFileSync(path.join(OUT, `review-${PHASE}-helper-receipt.json`), JSON.stringify(receipt, null, 1));
  console.log(JSON.stringify(output.summary, null, 1));
  console.log('pageErrors', pageErrors.length);
}
