// Real-app baseline and Suggested flows (task F). Explicitly invoked; not part of `npm test`.
//
// COACH_PHASE=real     production build (`npm run build` first) served by this script's own hidden
//                      `vite preview` on strict loopback 5324; real key presses into the native textarea,
//                      real engine, real C storage, real D policy, real E finite adapter.
// COACH_PHASE=injected Vite dev server on 5324; the coach-storage module is rewritten in flight by the
//                      browser route (test-side only) so preparePractice returns an injected status.
//                      Those checks are labelled `injected` and never count as lifecycle proof.
//
// Every context is fresh. An init script redirects indexedDB.open('typeforge') to a UUID synthetic
// name before any app code runs, refuses any other name or deleteDatabase, and the run asserts that
// only synthetic databases exist. Key intervals are scripted under Playwright's paused clock.
// Usage (from typing-app/client):
//   PLAYWRIGHT_MODULE=<playwright-core/index.mjs> COACH_OUT=<evidence dir> COACH_PHASE=real node tests/browser/coach-app.mjs
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

assert.ok(process.env.PLAYWRIGHT_MODULE, 'Set PLAYWRIGHT_MODULE to playwright-core/index.mjs');
assert.ok(process.env.COACH_OUT, 'Set COACH_OUT to the evidence directory');
const { chromium } = await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE)).href);
const PORT = 5324; // the strict loopback port leased to this task; never another
const BASE = `http://127.0.0.1:${PORT}`;
const PHASE = process.env.COACH_PHASE ?? 'real';
const OUT = path.resolve(process.env.COACH_OUT);
const SHOTS = path.join(OUT, 'screens');
mkdirSync(SHOTS, { recursive: true });
const WIDTHS = [[1440, 900], [390, 844], [320, 640]];
const START = new Date('2026-11-18T09:00:00.000Z');
const BAD = /undefined|NaN|\[object|\bnull\b/;

const checks = [];
const check = (id, source, pass, observed) => {
  checks.push({ id, source, pass: Boolean(pass), observed });
  console.log(pass ? 'PASS' : 'FAIL', `[${source}]`, id, pass ? '' : JSON.stringify(observed).slice(0, 600));
};
const errors = [];
const receipts = { phase: PHASE, port: PORT, node: process.execPath, started: new Date().toISOString() };

// ---------- Owned helper: one hidden Vite server on the strict port ----------
const portOpen = () => new Promise(resolve => { const socket = net.connect(PORT, '127.0.0.1'); socket.once('connect', () => { socket.destroy(); resolve(true); }); socket.once('error', () => resolve(false)); });
assert.equal(await portOpen(), false, `port ${PORT} must be free before the run`);
const args = ['node_modules/vite/bin/vite.js', ...(['real', 'typing-flow'].includes(PHASE) ? ['preview'] : []), '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'];
const server = spawn(process.execPath, args, { cwd: process.cwd(), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
receipts.server = { pid: server.pid, executable: process.execPath, args, cwd: process.cwd(), windowsHide: true, shell: false };
let serverOutput = '', serverExited = false;
server.stdout.on('data', chunk => { serverOutput += chunk; });
server.stderr.on('data', chunk => { serverOutput += chunk; });
server.on('exit', code => { serverExited = true; receipts.server.exitCode = code; });
for (let attempt = 0; !serverOutput.replace(/\u001b\[[0-9;]*m/g, '').includes(`${BASE}/`); attempt++) {
  assert.ok(!serverExited && attempt < 200, `own strict-port server did not start: ${serverOutput}`);
  await new Promise(resolve => setTimeout(resolve, 100));
}
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
receipts.browser = { executable: 'C:/Program Files/Google/Chrome/Application/chrome.exe', version: browser.version(), headless: true, launchedBy: 'playwright-core launch (temporary profile)' };

// ---------- Fresh isolated contexts with a synthetic database ----------
function installSyntheticDatabase(name) {
  const native = globalThis.indexedDB;
  const opened = [];
  const proxy = new Proxy(native, { get(target, property) {
    if (property === 'open') return (requested, version) => {
      if (requested !== 'typeforge') throw new Error(`synthetic fixture refused database ${requested}`);
      opened.push(name);
      return version === undefined ? target.open(name) : target.open(name, version);
    };
    if (property === 'deleteDatabase') return () => { throw new Error('synthetic fixture refuses deleteDatabase'); };
    const value = Reflect.get(target, property, target);
    return typeof value === 'function' ? value.bind(target) : value;
  } });
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: proxy });
  Object.defineProperty(globalThis, '__synthetic', { value: { name, opened } });
}
const databases = new Set();
async function world(label, { width = 1440, height = 900, media = {} } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, acceptDownloads: true, ...media });
  const name = `typeforge-ui-synthetic-${randomUUID()}`;
  databases.add(name);
  await context.addInitScript(installSyntheticDatabase, name);
  await context.clock.install({ time: START });
  await context.clock.pauseAt(new Date(START.getTime() + 1000));
  async function open(url) {
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => errors.push({ world: label, url, message: error.message }));
    page.on('console', message => { if (message.type() === 'error') errors.push({ world: label, url, console: message.text() }); });
    await page.goto(BASE + url);
    await page.waitForSelector('#app > *');
    // Interception is verified before any check relies on storage: the page sees only the synthetic name.
    const synthetic = await page.evaluate(() => globalThis.__synthetic?.name);
    assert.equal(synthetic, name, 'synthetic database interception installed before app code');
    return page;
  }
  return { context, name, open, label };
}
async function verifyIsolation(w, page) {
  const names = await page.evaluate(async () => (await indexedDB.databases()).map(d => d.name));
  check(`isolation ${w.label}: only the UUID synthetic database exists`, 'real', names.every(n => n === w.name) && !names.includes('typeforge'), { names });
}

// ---------- Page helpers ----------
// Copy is compared with no-break spaces normalised to plain spaces.
const q = (page, selector, prop = 'textContent') => page.evaluate(([s, p]) => { const el = document.querySelector(s); const v = el ? el[p] : null; return typeof v === 'string' ? v.replace(/ /g, ' ') : v; }, [selector, prop]);
const active = page => page.evaluate(() => { const a = document.activeElement; return a?.id || `${a?.tagName?.toLowerCase()}:${(a?.textContent ?? '').trim().slice(0, 40)}`; });
const activeText = page => page.evaluate(() => (document.activeElement?.textContent ?? '').trim().replace(/ /g, ' '));
const state = page => page.evaluate(() => document.querySelector('#stage')?.dataset.state);
const appText = page => page.evaluate(() => (document.querySelector('#app')?.innerText ?? '').replace(/ /g, ' '));
const whyText = page => page.evaluate(() => (document.querySelector('.why-panel')?.textContent ?? '').replace(/ /g, ' '));
const label = page => q(page, '#block-identity');
const slot = page => page.evaluate(() => `${document.querySelector('#exercise-warning')?.textContent ?? ''} ${document.querySelector('#slot-action')?.textContent ?? ''} ${document.querySelector('#carried')?.hidden ? '' : document.querySelector('#carried')?.textContent ?? ''}`.trim());
async function settle(page, rounds = 8) { for (let i = 0; i < rounds; i++) { await page.clock.runFor(40); await page.waitForTimeout(20); } }
async function savedSources(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('typeforge');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('currentResults')) { db.close(); resolve([]); return; }
      const all = db.transaction('currentResults').objectStore('currentResults').getAll();
      all.onsuccess = () => { db.close(); resolve(all.result); };
      all.onerror = () => { db.close(); reject(all.error); };
    };
  }));
}
// Scripted intervals: every character `base` ms apart, the second letter of `slowPair` `slow` ms after the first.
async function typeBlock(page, { base = 110, slowPair = 'th', slow = 300, pairs = null, until = 30000, sentences: limit = null } = {}) {
  let elapsed = 0, previous = '', sentences = 0, started = false;
  while (elapsed < until) {
    const now = await page.evaluate(() => ({ s: document.querySelector('#stage').dataset.state, target: document.querySelector('#target-description').textContent.replace('Passage to copy: ', ''), value: document.querySelector('#typing-input').value }));
    if (now.s === 'completed' || now.s === 'stopped') break;
    const text = `${now.target} `;
    for (let i = now.value.length; i < text.length && elapsed < until; i++) {
      const ch = text[i];
      const interval = pairs ? pairs[previous + ch] ?? base : slowPair && previous + ch === slowPair ? slow : base;
      // Never press a key at or after the deadline: it would land on the focused result action instead.
      if (started && elapsed + interval >= until) { await page.clock.runFor(until - elapsed + 150); elapsed = until + 150; break; }
      if (started) { await page.clock.runFor(interval); elapsed += interval; }
      started = true;
      await page.keyboard.press(ch === ' ' ? 'Space' : ch);
      previous = ch;
    }
    sentences++;
    if (limit !== null && sentences >= limit) return { elapsed, sentences };
  }
  await settle(page, 12);
  return { elapsed, sentences };
}
async function waitSaved(page) {
  for (let i = 0; i < 60; i++) {
    const text = await q(page, '#save-state') ?? '';
    if (text.startsWith('Saved') || /could not be saved|cannot be saved/.test(text)) break;
    await settle(page, 2);
  }
  await settle(page, 6);
}
const failWrites = page => page.evaluate(() => { window.__add = IDBObjectStore.prototype.add; IDBObjectStore.prototype.add = function () { throw new DOMException('Injected quota failure', 'QuotaExceededError'); }; });
const restoreWrites = page => page.evaluate(() => { if (window.__add) { IDBObjectStore.prototype.add = window.__add; delete window.__add; } });
const openWhy = page => page.evaluate(() => { const why = document.querySelector('#why'); if (!why.open) why.api?.open?.() ?? (why.open = true); });
const closeWhy = page => page.evaluate(() => { const why = document.querySelector('#why'); if (why.open) why.api?.close?.() ?? (why.open = false); });

// Layout at three widths: no horizontal overflow, no undefined/NaN copy, plus a capture.
const shots = [];
async function capture(page, name, source, { media } = {}) {
  const original = page.viewportSize();
  for (const [width, height] of WIDTHS) {
    await page.setViewportSize({ width, height });
    if (media) await page.emulateMedia(media);
    await page.waitForTimeout(80);
    const layout = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - window.innerWidth, text: document.querySelector('#app')?.innerText ?? '',
      // A visible key inside the fixed-height slot must not be cut off by it.
      clipped: [...document.querySelectorAll('.slot .key-small')].filter(k => k.offsetParent !== null).filter(k => { const r = k.getBoundingClientRect(), box = k.closest('.slot').getBoundingClientRect(); return r.bottom > box.bottom + 1 || r.right > box.right + 1; }).map(k => k.textContent) }));
    const file = `${name}-${width}${media?.forcedColors === 'active' ? '-forced' : ''}${media?.reducedMotion === 'reduce' ? '-reduced' : ''}.png`;
    await page.screenshot({ path: path.join(SHOTS, file) });
    shots.push({ file, source, width });
    check(`layout ${name}${media ? ` ${JSON.stringify(media)}` : ''} @${width}: no horizontal overflow, no clipped slot key, no undefined/NaN`, source, layout.overflow <= 0 && !BAD.test(layout.text) && !layout.clipped.length, { overflow: layout.overflow, bad: layout.text.match(BAD)?.[0], clipped: layout.clipped });
  }
  if (media) await page.emulateMedia({ forcedColors: 'none', reducedMotion: 'no-preference' });
  await page.setViewportSize(original);
}
const progressValue = page => page.evaluate(() => document.querySelector('#baseline-result ui-progress')?.getAttribute('value'));

// =====================================================================================
async function realFlows() {
  // ---- K1 / REG-3c: first visit is a clean General 30 s with native focus ----
  const home = await world('home');
  const page = await home.open('/');
  await settle(page);
  const first = { label: await label(page), focus: await active(page), qwerty: await page.evaluate(() => document.querySelector('#qwerty').checked),
    kind: await page.evaluate(() => String(document.querySelector('#practice-kind').value)), locked: await page.evaluate(() => document.querySelector('#suggested-item').getAttribute('aria-disabled')),
    status: await q(page, '#suggested-status'), url: new URL(page.url()).search, slot: await slot(page) };
  check('K1/REG-3c first visit: General 30 s, qwerty off, textarea focused, Suggested locked after the check', 'real',
    first.label === 'General practice · 30 s' && first.focus === 'typing-input' && !first.qwerty && first.kind === 'general' && first.locked === 'true'
    && !/Checking/.test(first.status ?? '') && first.url === '' && !/qwerty/.test(first.slot), first);
  await capture(page, 'home-ready', 'real');
  await page.locator('#typing-input').focus();
  await page.keyboard.press('t');
  check('K1 first key starts the General block (checking never took focus)', 'real', await state(page) === 'running' && await page.inputValue('#typing-input') === 't', { state: await state(page) });
  await verifyIsolation(home, page);
  await home.context.close();

  // ---- K2: locked Suggested explains itself; General is kept ----
  const locked = await world('locked');
  const lp = await locked.open('/');
  await settle(lp);
  await lp.locator('#suggested-item').click({ force: true }); // a real pointer press on the aria-disabled item
  await settle(lp, 3);
  const pressed = { kind: await lp.evaluate(() => String(document.querySelector('#practice-kind').value)), slot: await slot(lp), action: await q(lp, '#slot-action a', 'href'), status: await q(lp, '#settings-status') };
  check('K2d/K2c pointer press on locked Suggested: General kept, slot explains with a take-test key', 'real',
    pressed.kind === 'general' && /10/.test(pressed.slot) && /practice\.html\?duration=30/.test(pressed.action ?? ''), pressed);
  await capture(lp, 'locked-press', 'real');
  await lp.locator('#practice-kind ui-segmented-control-item[value="general"]').focus();
  await lp.keyboard.press('ArrowRight'); await settle(lp, 3);
  await lp.keyboard.press('ArrowRight'); await settle(lp, 3);
  const arrowed = { kind: await lp.evaluate(() => String(document.querySelector('#practice-kind').value)), slot: await slot(lp), status: await q(lp, '#settings-status') };
  check('K2 locked Suggested reachable by arrow; the change is cancelled and explained', 'real', arrowed.kind !== 'recommended' && /10/.test(arrowed.slot) && /refused/.test(arrowed.status ?? ''), arrowed);
  // The arrows legitimately moved the choice to pair (manual) on the way; Space on the locked key must keep it.
  const beforeSpace = await lp.evaluate(() => String(document.querySelector('#practice-kind').value));
  await lp.locator('#suggested-item').focus(); await lp.keyboard.press('Space'); await settle(lp, 3);
  const afterSpace = { before: beforeSpace, after: await lp.evaluate(() => String(document.querySelector('#practice-kind').value)), slot: await slot(lp) };
  check('K2b Space on the locked key keeps the value and explains', 'real', afterSpace.after === afterSpace.before && afterSpace.after !== 'recommended' && /10/.test(afterSpace.slot), afterSpace);
  await lp.locator('#why ui-collapsible-trigger button').focus(); await lp.keyboard.press('Enter'); await settle(lp, 3);
  const whyOpen = { open: await lp.evaluate(() => !document.querySelector('.why-panel').hidden && document.querySelector('.why-panel').offsetParent !== null), text: await whyText(lp) };
  check('K3 why? opens with Enter and explains progress', 'real', whyOpen.open && /0 of 10/.test(whyOpen.text) && /about five minutes of typing/.test(whyOpen.text), { ...whyOpen, text: whyOpen.text.slice(0, 300) });
  await lp.goto(`${BASE}/index.html?mode=practice&practice=general&duration=60&qwerty=1`); await lp.waitForSelector('#typing-input'); await settle(lp, 12);
  const general60 = { label: await label(lp), slot: await slot(lp), duration: await lp.evaluate(() => String(document.querySelector('#duration').value)) };
  check('D2b General at 60 s stays ordinary: no hint, duration untouched', 'real', general60.label === 'General practice · 60 s' && general60.duration === '60' && !/Suggested|use 30/.test(general60.slot), general60);
  await lp.goto(`${BASE}/index.html?mode=practice&practice=recommended&duration=30&qwerty=0`); await lp.waitForSelector('#typing-input'); await settle(lp, 12);
  const qwertyOff = { label: await label(lp), slot: await slot(lp), marker: await q(lp, '#next-prompt') };
  check('D2c Suggested with qwerty off (locked here): an ordinary General block, no finite plan', 'real', qwertyOff.label === 'General practice · 30 s' && qwertyOff.marker !== '— end of this block —', qwertyOff);
  await capture(lp, 'suggested-qwerty-off', 'real');
  await locked.context.close();

  // ---- REG-3a/3b: explicit QWERTY declaration in an assessment ----
  const declare = await world('declare');
  const dp = await declare.open('/practice.html?duration=30&qwerty=0');
  await settle(dp);
  const button = dp.locator('#slot-action button', { hasText: 'my keyboard is qwerty' });
  const offered = await button.count();
  if (offered) { await button.click(); await settle(dp, 12); }
  const declared = { offered, label: await label(dp), focus: await active(dp), qwerty: await dp.evaluate(() => document.querySelector('#qwerty').checked) };
  await dp.keyboard.press('t');
  declared.state = await state(dp);
  check('REG-3a assessment hint offers explicit qwerty declaration; the first key still starts', 'real',
    offered === 1 && declared.qwerty && declared.label === 'Baseline test 1 of 10 · 30 s' && declared.focus === 'typing-input' && declared.state === 'running', declared);
  await declare.context.close();
  const notCounted = await world('not-counted');
  const np = await notCounted.open('/practice.html?duration=30&qwerty=0');
  await settle(np);
  await typeBlock(np, { until: 2000, sentences: 1 }); await np.clock.runFor(30000); await waitSaved(np);
  const nc = { block: await q(np, '#baseline-result', 'innerText'), declare: await np.locator('#baseline-result button', { hasText: 'my keyboard is qwerty' }).count(), label: await q(np, '.result-label') };
  check('REG-3b not-counted (qwerty off) result says so and offers the same declaration key', 'real', /Not a baseline test \(qwerty off\)/.test(nc.block ?? '') && nc.declare === 1 && /^Assessment · 30/.test(nc.label ?? ''), nc);
  await capture(np, 'result-not-counted', 'real');
  await np.locator('#result-actions .key-primary').focus(); await np.keyboard.press('x'); await settle(np, 3);
  check('K9 a letter on the result is not intercepted: the result stays, nothing restarts', 'real', await state(np) === 'completed' && Boolean(await q(np, '.result-label')), { state: await state(np) });
  await notCounted.context.close();

  // ---- The baseline: ten real 30 s assessments, th typed slower ----
  const main = await world('baseline');
  const bp = await main.open('/practice.html?duration=30&qwerty=1');
  await settle(bp);
  const ready1 = { label: await label(bp), slot: await slot(bp), focus: await active(bp) };
  check('baseline test 1 ready: label and hint from the prepared status', 'real', ready1.label === 'Baseline test 1 of 10 · 30 s' && /baseline test 1 of 10/.test(ready1.slot) && ready1.focus === 'typing-input', ready1);
  await capture(bp, 'baseline-1-ready', 'real');
  // Test 1: Enter after the save (REG-5c analogue).
  await typeBlock(bp); await waitSaved(bp);
  const result1 = { label: await q(bp, '.result-label'), block: await q(bp, '#baseline-result', 'innerText'), focus: await activeText(bp), save: await q(bp, '#save-state'), value: await progressValue(bp) };
  check('K4 test 1 completes in place, counted after save, next test focused', 'real',
    result1.label === 'Baseline test 1 of 10 · 30 s · complete' && result1.value === '1' && /Every finished test counts/.test(result1.block ?? '') && /^next test/.test(result1.focus) && result1.save?.startsWith('Saved'), result1);
  await capture(bp, 'result-1-saved', 'real');
  await bp.keyboard.press('Enter'); await settle(bp);
  check('K4b/REG-5c Enter continues to test 2 with native focus', 'real', await label(bp) === 'Baseline test 2 of 10 · 30 s' && await active(bp) === 'typing-input', { label: await label(bp), focus: await active(bp) });
  // Test 2: Enter at once, while its save may still be pending (REG-5a analogue).
  await typeBlock(bp);
  await bp.keyboard.press('Enter');
  const early = { label: await label(bp), focus: await active(bp) };
  await settle(bp, 12);
  const late2 = { label: await label(bp), focus: await active(bp), slot: await slot(bp), state: await state(bp) };
  check('REG-5a rapid Again during the save: no stale ordinal is frozen; test 3 once the status is fresh', 'real',
    /^Baseline test( 3 of 10)? · 30 s$/.test(early.label ?? '') && late2.label === 'Baseline test 3 of 10 · 30 s' && late2.focus === 'typing-input' && late2.state === 'idle' && !/isn.t saved/.test(late2.slot), { early, late2 });
  // Real reload mid-baseline keeps the count (durable, not in memory).
  await bp.reload(); await bp.waitForSelector('#typing-input'); await settle(bp);
  check('real reload: test 3 is still next (count read back from storage)', 'real', await label(bp) === 'Baseline test 3 of 10 · 30 s', { label: await label(bp) });
  await typeBlock(bp); await waitSaved(bp);
  await bp.keyboard.press('Enter'); await settle(bp);
  // Test 4 interrupted (REG-5g): not counted, try test 4 again.
  await bp.keyboard.press('t'); await bp.keyboard.press('h');
  await bp.evaluate(() => document.querySelector('#typing-input').blur());
  await bp.clock.runFor(30000); await waitSaved(bp);
  const interrupted = { block: await q(bp, '#baseline-result', 'innerText') };
  check('K5 interrupted test is not counted; the count is unchanged', 'real', /Not counted: focus left the text/.test(interrupted.block ?? '') && /Still 3 of 10/.test(interrupted.block ?? ''), interrupted);
  await bp.locator('#result-actions .key-primary').focus();
  await bp.keyboard.press('Enter'); await settle(bp);
  check('REG-5g interrupted -> try test 4 again: label 4, native focus', 'real', await label(bp) === 'Baseline test 4 of 10 · 30 s' && await active(bp) === 'typing-input', { label: await label(bp), focus: await active(bp) });
  await typeBlock(bp); await waitSaved(bp);
  await bp.keyboard.press('Enter'); await settle(bp);
  // Test 5: failed save, retry from the result (REG-6a, K6).
  await failWrites(bp);
  await typeBlock(bp); await waitSaved(bp);
  const failed5 = await bp.evaluate(() => { const a = document.activeElement; const r = a?.getBoundingClientRect(); return { focus: a?.textContent?.trim(), inView: r ? r.top >= 0 && r.bottom <= innerHeight : false, block: document.querySelector('#baseline-result')?.innerText, secondary: document.querySelector('#result-actions .key:not(.key-primary)')?.textContent?.trim(), save: document.querySelector('#save-state')?.textContent }; });
  check('REG-6a test 5 save failed: retry saving is the focused visible primary; not counted', 'real', /^retry saving/.test(failed5.focus ?? '') && failed5.inView && /Not saved yet, so it doesn.t count/.test(failed5.block ?? '') && Boolean(failed5.secondary) && /could not be saved/.test(failed5.save ?? ''), failed5);
  await capture(bp, 'result-5-save-failed', 'real');
  await restoreWrites(bp);
  await bp.keyboard.press('Enter'); await waitSaved(bp); await settle(bp, 10);
  const retried5 = { save: await q(bp, '#save-state'), value: await progressValue(bp), focus: await activeText(bp) };
  check('K6 Enter retries the save; the test then counts (5 of 10) and next test is focused', 'real', retried5.save?.startsWith('Saved') && retried5.value === '5' && /^next test/.test(retried5.focus), retried5);
  await bp.keyboard.press('Enter'); await settle(bp);
  // Test 6: failed save, continue with next test, retry from the ready slot (REG-5d/5f).
  await failWrites(bp);
  await typeBlock(bp); await waitSaved(bp);
  await bp.locator('#result-actions #again').click(); await settle(bp, 12);
  const carried = { label: await label(bp), slot: await slot(bp), focus: await active(bp) };
  check('REG-5d next test after a failed save: test 7 (the unsaved test still holds its place), recovery offered', 'real',
    carried.label === 'Baseline test 7 of 10 · 30 s' && /Test 6 isn.t saved yet, so it doesn.t count/.test(carried.slot) && /retry save/.test(carried.slot), carried);
  await capture(bp, 'ready-7-test-6-unsaved', 'real');
  await openWhy(bp); await settle(bp, 3);
  const whyProgress = await whyText(bp);
  check('REG-8b why? in progress: "about five minutes of typing", the unsaved test named', 'real', /6 isn.t saved/i.test(whyProgress) && /about five minutes of typing/.test(whyProgress), { why: whyProgress.slice(0, 500) });
  await capture(bp, 'why-in-progress', 'real');
  await closeWhy(bp);
  await restoreWrites(bp);
  await bp.locator('#carried [data-act="retry"]').click(); await settle(bp, 12);
  const recovered = { label: await label(bp), slot: await slot(bp), focus: await active(bp) };
  check('REG-5f retry saving from the ready slot succeeds; label stays 7, focus back to the text', 'real', recovered.label === 'Baseline test 7 of 10 · 30 s' && !/isn.t saved/.test(recovered.slot) && recovered.focus === 'typing-input', recovered);
  for (let test = 7; test <= 10; test++) {
    await bp.locator('#typing-input').focus();
    await typeBlock(bp); await waitSaved(bp);
    if (test < 10) { await bp.keyboard.press('Enter'); await settle(bp); }
  }
  await settle(bp, 12);
  const complete = { label: await q(bp, '.result-label'), block: await q(bp, '#baseline-result', 'innerText'), focus: await activeText(bp), primary: await q(bp, '#result-actions .key-primary', 'href') };
  check('REG-2a/K7 test 10: Baseline complete, "Last 10 tests · median", focus th explained, try suggested primary', 'real',
    complete.label === 'Baseline test 10 of 10 · 30 s · complete' && /Baseline complete\./.test(complete.block ?? '') && /Last 10 tests · median/i.test(complete.block ?? '')
    && /Suggested has a focus: th/.test(complete.block ?? '') && /try suggested · th/.test(complete.focus) && /practice=recommended/.test(complete.primary ?? ''), complete);
  const ring = await bp.evaluate(() => { const a = document.activeElement, st = getComputedStyle(a); return { visible: a.matches(':focus-visible'), outline: `${st.outlineStyle} ${st.outlineWidth}`, shadow: st.boxShadow }; });
  check('K9 the keyboard-reached primary shows a visible focus indicator', 'real', ring.visible && (ring.outline !== 'none 0px' || ring.shadow !== 'none'), ring);
  await capture(bp, 'result-10-baseline-complete', 'real');
  await capture(bp, 'result-10-baseline-complete', 'real', { media: { forcedColors: 'active' } });
  await bp.emulateMedia({ forcedColors: 'active' });
  const forcedRing = await bp.evaluate(() => { const st = getComputedStyle(document.activeElement); return `${st.outlineStyle} ${st.outlineWidth}`; });
  await bp.emulateMedia({ forcedColors: 'none' });
  check('forced colours: the focused primary keeps a real outline shape (not colour alone)', 'real', !/^none/.test(forcedRing) && forcedRing !== 'solid 0px', { forcedRing });
  const sources = await savedSources(bp);
  check('ten counted assessments and one interrupted are stored as current sources', 'real', sources.filter(s => s.mode === 'assessment').length === 11, { count: sources.length });
  await verifyIsolation(main, bp);

  // ---- Suggested: admitted certified plan, finite end, timer-first, settings mismatch ----
  await bp.keyboard.press('Enter'); await bp.waitForSelector('#typing-input'); await settle(bp, 12);
  const suggested = { label: await label(bp), kind: await bp.evaluate(() => String(document.querySelector('#practice-kind').value)), slot: await slot(bp), prompts: await bp.evaluate(() => document.querySelector('#stage').dataset.promptIds), focus: await active(bp) };
  check('K7 try suggested -> ready Suggested practice on the admitted th plan; no previous pair named', 'real',
    suggested.label === 'Suggested practice · th · 30 s' && suggested.kind === 'recommended' && !/leans on|stepped back/.test(suggested.slot) && suggested.focus === 'typing-input', suggested);
  await openWhy(bp); await settle(bp, 3);
  const why = await whyText(bp);
  check('why? on Suggested explains th from the admitted snapshot; no promise of general sentences mixed in', 'real', /suggested · th/.test(why) && /Every sentence in this block contains th/.test(why) && !/mixed in/.test(why), { why: why.slice(0, 500) });
  await capture(bp, 'suggested-ready-why', 'real');
  await closeWhy(bp);
  await bp.locator('#typing-input').focus();
  const plan = (suggested.prompts ?? '').split(' ').filter(Boolean).length;
  await typeBlock(bp, { base: 35, slow: 35, sentences: plan - 1 });
  const marker = await q(bp, '#next-prompt');
  await typeBlock(bp, { base: 35, slow: 35, sentences: 1 });
  await waitSaved(bp);
  const end = { marker, plan, label: await q(bp, '.result-label'), caption: await q(bp, '.figures-caption'), observation: await q(bp, '.result-observation'), focus: await activeText(bp), secondary: await q(bp, '#to-general'), block: await q(bp, '#completion', 'innerText') };
  check('REG-9/D2e finite plan ends at its last sentence: no wrap, "all N sentences done at T s of 30", never "30 s · complete"', 'real',
    end.marker === '— end of this block —' && new RegExp(`^Suggested practice · th · all ${plan} sentences done at \\d+(\\.\\d)? s of 30$`).test(end.label ?? '') && /^over the \d+(\.\d)? s typed$/.test(end.caption ?? '')
    && /That.s every sentence in this th block/.test(end.observation ?? '') && /^suggested again/.test(end.focus) && end.secondary === 'general' && !/Baseline|30 s · complete/.test(end.block ?? ''), end);
  await capture(bp, 'suggested-plan-end', 'real');
  const finite = (await savedSources(bp)).find(s => 'schemaId' in s);
  check('the finite record is saved as itself (not a timed result)', 'real', finite?.plan?.pair === 'th' && finite?.plan?.sentenceCount === plan, { schema: finite?.schemaId, plan: finite?.plan?.sentenceCount });
  // Suggested again repeats the same plan; then a timer-first run is an ordinary practice result.
  await bp.keyboard.press('Enter'); await settle(bp, 12);
  check('suggested again: the same plan, admitted afresh, no change note', 'real', await label(bp) === 'Suggested practice · th · 30 s' && !/leans on|stepped back/.test(await slot(bp)), { label: await label(bp), slot: await slot(bp) });
  await typeBlock(bp, { base: 220, slow: 220 }); await waitSaved(bp);
  check('timer first: an ordinary practice result labelled 30 s · complete', 'real', await q(bp, '.result-label') === 'Suggested practice · th · 30 s · complete', { label: await q(bp, '.result-label') });
  // A flagged finite end: focus leaves the text mid-plan, then the plan is finished. It leads with its flag, no figures.
  await bp.locator('#result-actions .key-primary').click(); await settle(bp, 12);
  await bp.locator('#typing-input').focus();
  await typeBlock(bp, { base: 35, slow: 35, sentences: 1 });
  await bp.evaluate(() => document.querySelector('#typing-input').blur()); await settle(bp, 3);
  await bp.locator('#typing-input').focus();
  await typeBlock(bp, { base: 35, slow: 35, sentences: plan - 1 }); await waitSaved(bp);
  const flaggedEnd = { flag: await q(bp, '.result-flag'), figures: await bp.locator('#completion .figures-caption').count(), label: await q(bp, '.result-label') };
  check('REG-9b flagged finite end: leads with the flag, shows no figures, still labelled by what happened', 'real',
    /^Flagged: this run was interrupted/.test(flaggedEnd.flag ?? '') && flaggedEnd.figures === 0 && /^Suggested practice · th · /.test(flaggedEnd.label ?? ''), flaggedEnd);
  await capture(bp, 'suggested-plan-end-flagged', 'real');
  await bp.locator('#to-general').click(); await settle(bp, 12);
  check('general from a Suggested result starts an ordinary General block', 'real', await label(bp) === 'General practice · 30 s' && await bp.evaluate(() => String(document.querySelector('#practice-kind').value)) === 'general', { label: await label(bp) });
  // D2a: Suggested at 60 s is General with an honest hint; [use 30 s] is the person's choice.
  await bp.goto(`${BASE}/index.html?mode=practice&practice=recommended&duration=60&qwerty=1`); await bp.waitForSelector('#typing-input'); await settle(bp, 12);
  const mismatch = { label: await label(bp), slot: await slot(bp), duration: await bp.evaluate(() => String(document.querySelector('#duration').value)), marker: await q(bp, '#next-prompt') };
  check('D2a/D2d Suggested at 60 s: General block, duration kept, honest hint with use 30 s; no finite plan', 'real',
    mismatch.label === 'General practice · 60 s' && mismatch.duration === '60' && /use 30 s/.test(mismatch.slot) && mismatch.marker !== '— end of this block —', mismatch);
  await capture(bp, 'suggested-at-60', 'real');
  await bp.locator('#slot-action button').click(); await settle(bp, 15);
  check('D2a pressing use 30 s is the person\'s own choice and admits Suggested', 'real', await label(bp) === 'Suggested practice · th · 30 s', { label: await label(bp) });

  // ---- Progress, export, reset; stale admission in the other tab ----
  const progressPage = await main.open('/progress.html');
  await settle(progressPage, 12);
  const progressText = await appText(progressPage);
  check('REG-2b/REG-8a Progress: 10 of 10 once, summary with dates and update note, finite rows listed', 'real',
    (progressText.match(/10 of 10/g) ?? []).length === 1 && /Last 10 tests · median/i.test(progressText) && /Updates as you take more 30-second tests/.test(progressText) && /Nov/.test(progressText) && /Suggested practice · th/.test(progressText), { text: progressText.slice(0, 900) });
  await capture(progressPage, 'progress-complete', 'real');
  const download = progressPage.waitForEvent('download');
  await progressPage.locator('#export-sources').click();
  const file = await (await download).path();
  const { readFileSync } = await import('node:fs');
  const exported = JSON.parse(readFileSync(file, 'utf8'));
  const exportedText = JSON.stringify(exported);
  check('export all saved sources: C\'s envelope carries the original finite and timed sources', 'real', exportedText.includes(finite.id) && exportedText.includes('"sentenceCount"'), { keys: Object.keys(exported) });
  await progressPage.locator('#reset').click();
  const confirmFocus = await active(progressPage);
  await capture(progressPage, 'progress-reset-confirm', 'real');
  await progressPage.locator('#start-over').click(); await settle(progressPage, 15);
  const reset = { status: await q(progressPage, '#baseline-status'), focus: await active(progressPage), text: await q(progressPage, '#baseline-body', 'innerText') };
  check('K10 reset confirm is safe-first; start over -> "New baseline started: 0 of 10" after a proved re-read', 'real',
    confirmFocus === 'keep' && /^New baseline started: 0 of 10\. Earlier results are still in your history\.$/.test(reset.status ?? '') && reset.focus === 'baseline-heading' && !/median/i.test(reset.text ?? ''), { confirmFocus, ...reset });
  await capture(progressPage, 'progress-after-reset', 'real');
  await settle(bp, 15);
  const fallback = { label: await label(bp), slot: await slot(bp), kind: await bp.evaluate(() => String(document.querySelector('#practice-kind').value)), focus: await active(bp) };
  check('stale admission: a reset elsewhere before the first key switches the ready block to honest General and says why', 'real',
    fallback.label === 'General practice · 30 s' && /Suggested (stepped back to general|has no focus for now, so this block is general)/.test(fallback.slot) && fallback.kind === 'general', fallback);
  await capture(bp, 'suggested-stepped-back', 'real');
  await bp.reload(); await bp.waitForSelector('#typing-input'); await settle(bp, 12);
  const reloaded = { label: await label(bp), slot: await slot(bp) };
  // `/` keeps its clean URL, so this home deep link (duration=60) is reapplied by the reload; the stored choice is not.
  check('D1a reload after stepping back: no previous pair named; truthful General', 'real', /^General practice · (30|60) s$/.test(reloaded.label ?? '') && !/\bth\b|leans on|stepped back/.test(reloaded.slot), reloaded);
  // Results page opens the finite record as itself.
  await bp.goto(`${BASE}/results.html?id=${encodeURIComponent(finite.id)}`); await settle(bp, 8);
  const finitePage = { title: await q(bp, '#finite-title'), text: (await appText(bp)).slice(0, 500) };
  check('results page reads the finite record from the source union, labelled by what happened', 'real', /^Suggested practice · th · all \d+ sentences done at/.test(finitePage.title ?? '') && /not part of progress or the baseline/.test(finitePage.text), finitePage);
  await capture(bp, 'results-finite', 'real');
  await verifyIsolation(main, bp);
  await main.context.close();

  // ---- Complete-insufficient and stale evidence on a second baseline typed evenly ----
  const stale = await world('stale');
  const sp = await stale.open('/practice.html?duration=30&qwerty=1');
  await settle(sp);
  for (let test = 1; test <= 10; test++) { await sp.locator('#typing-input').focus(); await typeBlock(sp, { slowPair: null }); await waitSaved(sp); if (test < 10) { await sp.keyboard.press('Enter'); await settle(sp); } }
  await settle(sp, 12);
  const insufficient = { block: await q(sp, '#baseline-result', 'innerText'), focus: await activeText(sp) };
  check('K8 complete-insufficient (even timing): Baseline complete, reason sentence, General primary', 'real',
    /Baseline complete\./.test(insufficient.block ?? '') && !/Suggested has a focus/.test(insufficient.block ?? '') && /practise general/.test(insufficient.focus), insufficient);
  await capture(sp, 'result-10-insufficient', 'real');
  await stale.context.clock.runFor(31 * 24 * 3600 * 1000);
  await sp.goto(`${BASE}/index.html?mode=practice&duration=30&qwerty=1`); await sp.waitForSelector('#typing-input'); await settle(sp, 12);
  await sp.locator('#suggested-item').click({ force: true }); await settle(sp, 3);
  await openWhy(sp); await settle(sp, 3);
  const staleText = { slot: await slot(sp), why: await whyText(sp) };
  check('stale evidence (31 days later): tests still count, only timing needs refreshing; take an assessment offered', 'real',
    /only the timing needs refreshing/.test(`${staleText.slot} ${staleText.why}`) && /assessment/.test(`${staleText.slot} ${staleText.why}`) && !/re-check/i.test(staleText.why), staleText);
  await capture(sp, 'stale-evidence-why', 'real');
  await capture(sp, 'stale-evidence-why', 'real', { media: { reducedMotion: 'reduce' } });
  await verifyIsolation(stale, sp);
  await stale.context.close();
}

// =====================================================================================
// INJECTED: the dev-served coach-storage module is rewritten in flight (test-side route only) so that
// preparePractice returns C's real status passed through a named patch. These states are hard to reach
// on demand (proof pending, unreadable context, 1 or 9 counted); they prove presentation, not lifecycle.
const PATCHES = {
  counted1: `s => ({ ...s, baselineProofComplete: true, participation: { ...s.participation, state: 'in-progress', reason: 'baseline-incomplete', counted: 1, ordinal: 2 } })`,
  counted9: `s => ({ ...s, baselineProofComplete: true, participation: { ...s.participation, state: 'in-progress', reason: 'baseline-incomplete', counted: 9, ordinal: 10 } })`,
  pending: `s => ({ ...s, pendingSave: 1, participation: { state: 'pending', reason: 'scan-incomplete', counted: 4, ordinal: null, proof: null }, summary: { state: 'pending', reason: 'scan-incomplete', value: null } })`,
  context: `s => ({ ...s, automaticCoaching: 'unavailable', participation: { state: 'unavailable', reason: 'context-unavailable', counted: null, ordinal: null, proof: null }, summary: { state: 'unavailable', reason: 'context-unavailable', value: null } })`,
  completePending: `s => ({ ...s, baselineProofComplete: true, participation: { ...s.participation, state: 'complete', reason: 'supported', counted: 10, ordinal: null }, summary: { state: 'pending', reason: 'scan-incomplete', value: null }, coach: { state: 'pending', evidenceScanComplete: false, reason: 'scan-incomplete', snapshot: null } })`,
};
async function injectedWorld(name, patch) {
  const w = await world(`injected-${name}`);
  let rewritten = 0;
  await w.context.route(/\/src\/coach-storage\.ts(\?.*)?$/, async route => {
    const response = await route.fetch();
    let body = await response.text();
    const marker = 'export async function preparePractice(';
    assert.ok(body.includes(marker), 'dev module exposes preparePractice for the injected fixture');
    body = body.replace(marker, 'async function __realPreparePractice(')
      + `\nexport async function preparePractice(input) { const status = await __realPreparePractice(input); return Object.freeze((${patch})(status)); }\n`;
    rewritten++;
    await route.fulfill({ response, body, headers: { ...response.headers(), 'content-type': 'text/javascript' } });
  });
  return { ...w, rewritten: () => rewritten };
}
async function injectedFlows() {
  for (const [name, patch] of Object.entries(PATCHES)) {
    const w = await injectedWorld(name, patch);
    const page = await w.open('/');
    await settle(page, 12);
    check(`fixture ${name}: the route rewrite was applied (labelled injected, not lifecycle proof)`, 'injected', w.rewritten() > 0, { rewritten: w.rewritten() });
    const home = { status: await q(page, '#suggested-status'), label: await label(page), focus: await active(page) };
    await page.locator('#suggested-item').click({ force: true }); await settle(page, 3);
    await openWhy(page); await settle(page, 3);
    home.slot = await slot(page); home.why = await whyText(page);
    await capture(page, `injected-${name}-home`, 'injected');
    await page.goto(`${BASE}/practice.html?duration=30&qwerty=1`); await page.waitForSelector('#typing-input'); await settle(page, 12);
    const ready = { label: await label(page), slot: await slot(page), focus: await active(page) };
    await capture(page, `injected-${name}-assessment`, 'injected');
    await page.goto(`${BASE}/progress.html`); await settle(page, 12);
    const progress = { text: (await appText(page)).slice(0, 900) };
    await capture(page, `injected-${name}-progress`, 'injected');
    const all = `${home.status} ${home.slot} ${home.why} ${ready.label} ${ready.slot} ${progress.text}`;
    const general = home.label === 'General practice · 30 s' && home.focus === 'typing-input';
    const expect = {
      counted1: /1 of 10/.test(home.status ?? '') && ready.label === 'Baseline test 2 of 10 · 30 s' && /1 of 10/.test(progress.text),
      counted9: /9 of 10/.test(home.status ?? '') && ready.label === 'Baseline test 10 of 10 · 30 s' && /9 of 10/.test(progress.text),
      pending: !/Baseline test \d+ of 10/.test(ready.label ?? '') && !/\b0 of 10/.test(all),
      context: /couldn.t be read|aren.t being counted|can.t be counted/i.test(all) && !/\b0 of 10/.test(all) && !/Baseline test \d+ of 10/.test(ready.label ?? ''),
      completePending: /Baseline complete|10 of 10/i.test(all) && !/Suggested has a focus/.test(all),
    }[name];
    check(`injected ${name}: home stays General and usable; status, why?, assessment label and Progress agree`, 'injected', general && expect, { home, ready, progress });
    await w.context.close();
  }
  // Real C path with a storage fault: indexedDB.open always errors. Unavailable is never "0 of 10".
  const broken = await world('storage-fault');
  await broken.context.addInitScript(() => {
    const proxied = globalThis.indexedDB;
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: new Proxy(proxied, { get(target, property) {
      if (property === 'open') return () => { throw new DOMException('Injected storage fault', 'UnknownError'); };
      const value = Reflect.get(target, property, target); return typeof value === 'function' ? value.bind(target) : value; } }) });
  });
  const bp = await broken.open('/');
  await settle(bp, 12);
  await bp.locator('#suggested-item').click({ force: true }); await settle(bp, 3);
  const fault = { status: await q(bp, '#suggested-status'), slot: await slot(bp), label: await label(bp) };
  await bp.locator('#typing-input').focus(); await bp.keyboard.press('t');
  fault.state = await state(bp);
  check('real C with a storage fault: unavailable (never 0 of 10), General keeps working', 'real-fault',
    !/\b0 of 10/.test(`${fault.status} ${fault.slot}`) && /isn.t available|can.t be counted|couldn.t be read|unavailable/i.test(`${fault.status} ${fault.slot}`) && fault.label === 'General practice · 30 s' && fault.state === 'running', fault);
  await capture(bp, 'storage-fault-home', 'real-fault');
  await broken.context.close();
}

// COACH_PHASE=typing-flow runs the committed MCP function (typing-flow.js) unchanged against this
// script's own preview server, as browser_run_code_unsafe would: it receives a page and makes its own contexts.
async function typingFlow() {
  const page = await (await browser.newContext()).newPage();
  const run = (0, eval)(readFileSync(new URL('./typing-flow.js', import.meta.url), 'utf8'));
  const report = await run(page);
  writeFileSync(path.join(OUT, 'typing-flow.json'), JSON.stringify(report, null, 1));
  for (const result of report.results) check(`typing-flow: ${result.name}`, 'real', result.status === 'PASS', result.details);
  check('typing-flow: no page errors', 'real', report.errors.length === 0, report.errors);
}

// =====================================================================================
// ADMISSION FOLLOW-UP (task_338af3c3e8c3). Dev server; the real C/D/E modules, unbundled. Saved sources come
// from real typing (COACH_PHASE=fixtures) and are seeded through C's own captureContext + saveSource, so
// counts, membership, proof and admission are C/D's actual results. Nothing injects a status or an admission.
const FIXTURES = path.join(OUT, 'fixtures');
const LATER = new Date(START.getTime() + 24 * 3600 * 1000); // seeded worlds start a day after the fixtures were typed
const SUGGESTED = '/index.html?mode=practice&practice=recommended&duration=30&qwerty=1';
async function seed(page, sources) {
  const states = await page.evaluate(async list => {
    const c = await import('/src/coach-storage.ts');
    const out = [];
    for (const source of list) { const capture = await c.captureContext(); const r = await c.saveSource(source, capture); out.push(`${r.state}${r.membershipReady ? '+member' : ''}`); }
    return out;
  }, sources);
  assert.ok(states.every(s => s === 'saved+member'), `seeded through C: ${states}`);
  return states;
}
// A real storage change made through C from inside the page (as another tab's reset would): it commits and
// notifies without advancing any page timer, so a queued re-preparation stays queued under the paused clock.
const resetThroughC = page => page.evaluate(async () => { const c = await import('/src/coach-storage.ts'); const capture = await c.captureContext(); return (await c.resetEpoch(capture.databaseId)).committed; });
const realWait = async (page, predicate, label, tries = 100) => { for (let i = 0; i < tries; i++) { if (await predicate()) return true; await page.waitForTimeout(30); } throw new Error(`timed out: ${label}`); };
const loadFixture = name => JSON.parse(readFileSync(path.join(FIXTURES, `${name}.json`), 'utf8'));
// Holds the dev-served finite runtime module until released (controlled delayed import).
async function holdFiniteRuntime(context) {
  const state = { requested: 0, release: null };
  const gate = new Promise(resolve => { state.release = resolve; });
  await context.route(/\/src\/finite-practice\.ts(\?.*)?$/, async route => { state.requested++; await gate; await route.continue(); });
  return state;
}
// Holds C's saveSource at its source hash (identified by its async stack), never a preparation's hashing.
const armSaveGate = page => page.evaluate(() => {
  const subtle = crypto.subtle;
  const original = window.__digest ??= subtle.digest.bind(subtle);
  let open; const gate = new Promise(resolve => { open = resolve; });
  window.__saveGate = { held: 0, release: open };
  Object.defineProperty(subtle, 'digest', { configurable: true, value: async (...args) => {
    if (window.__saveGate && /saveSource/.test(new Error().stack ?? '')) { window.__saveGate.held++; await gate; }
    return original(...args);
  } });
});
const releaseSaveGate = page => page.evaluate(() => { const g = window.__saveGate; window.__saveGate = null; g?.release(); });
const saveHeld = page => page.evaluate(() => window.__saveGate?.held ?? 0);
const ids = page => page.evaluate(() => document.querySelector('#stage').dataset.promptIds);
const typedCount = page => page.evaluate(() => document.querySelectorAll('#prompt .correct, #prompt .wrong').length);

async function buildFixtures() {
  const w = await world('fixtures');
  const p = await w.open('/practice.html?duration=30&qwerty=1');
  await settle(p);
  for (let test = 1; test <= 10; test++) {
    await p.locator('#typing-input').focus();
    await typeBlock(p, { pairs: { th: 330, in: 250 } }); await waitSaved(p);
    if (test < 10) { await p.keyboard.press('Enter'); await settle(p); }
  }
  await settle(p, 12);
  const a = (await savedSources(p)).filter(s => s.mode === 'assessment');
  check('fixture A: ten real assessments (th slow, in moderately slow) give Suggested focus th', 'real', a.length === 10 && /Suggested has a focus: th/.test(await q(p, '#baseline-result', 'innerText') ?? ''), { count: a.length });
  await p.goto(`${BASE}/index.html?mode=practice&practice=general&duration=30&qwerty=1`); await p.waitForSelector('#typing-input'); await settle(p, 12);
  for (let run = 1; run <= 10; run++) {
    await p.locator('#typing-input').focus();
    await typeBlock(p, { pairs: { in: 400 } }); await waitSaved(p);
    if (run < 10) { await p.locator('#result-actions .key-primary').click(); await settle(p, 12); }
  }
  const b = (await savedSources(p)).filter(s => s.mode === 'practice');
  await p.goto(BASE + SUGGESTED); await p.waitForSelector('#typing-input'); await settle(p, 15);
  const after = await label(p);
  check('fixture B: ten real General practice runs (in slow only) move the admitted focus to in', 'real', b.length === 10 && after === 'Suggested practice · in · 30 s', { count: b.length, label: after });
  mkdirSync(FIXTURES, { recursive: true });
  writeFileSync(path.join(FIXTURES, 'sources-a.json'), JSON.stringify(a));
  writeFileSync(path.join(FIXTURES, 'sources-b.json'), JSON.stringify(b));
  await verifyIsolation(w, p);
  await w.context.close();
}

async function seededWorld(name, sources, url) {
  const w = await world(name);
  await w.context.clock.setSystemTime(LATER);
  const p = await w.open('/index.html?mode=practice&practice=general&duration=30&qwerty=1');
  await settle(p, 4);
  await seed(p, sources);
  await p.goto(BASE + url); await p.waitForSelector('#typing-input'); await settle(p, 15);
  return { w, p };
}

async function raceFlows() {
  const a = loadFixture('sources-a');
  // ---- P1a: a known invalidation, preparation held (queued under the paused clock), then the first key ----
  for (const trigger of ['reset', 'focus']) {
    const { w, p } = await seededWorld(`race-first-key-${trigger}`, a, SUGGESTED);
    const ready = { label: await label(p), ids: await ids(p) };
    check(`P1a/${trigger}: the admitted Suggested th block is ready before the race`, 'real-seeded', ready.label === 'Suggested practice · th · 30 s', ready);
    if (trigger === 'reset') check('P1a/reset: the reset committed through C', 'real-seeded', await resetThroughC(p) === true, {});
    else await p.evaluate(() => window.dispatchEvent(new Event('focus'))); // C invalidates on focus; nothing changed
    await p.locator('#typing-input').focus();
    await p.keyboard.press('t');
    const first = { label: await label(p), state: await state(p), value: await p.inputValue('#typing-input'), typed: await typedCount(p), ids: await ids(p), focus: await active(p), slot: await slot(p) };
    check(`P1a/${trigger}: a known invalidation never lets the first key start the stale finite plan`, 'real-seeded',
      first.label === 'General practice · 30 s' && first.ids !== ready.ids && first.state === 'running', first);
    check(`P1a/${trigger}: the first key is accepted exactly once and focus stays in the text`, 'real-seeded', first.value === 't' && first.typed === 1 && first.focus === 'typing-input', first);
    await capture(p, `race-first-key-${trigger}`, 'real-seeded');
    await settle(p, 15);
    const after = { label: await label(p), state: await state(p), value: await p.inputValue('#typing-input'), ids: await ids(p) };
    check(`P1a/${trigger}: the re-preparation never replaces the running block`, 'real-seeded', after.label === first.label && after.ids === first.ids && after.state === 'running' && after.value === 't', after);
    await verifyIsolation(w, p);
    await w.context.close();
  }

  // ---- P1b settle: invalidation and a newer generation while the finite runtime import is pending ----
  for (const variant of ['idle', 'first-key']) {
    const w = await world(`race-settle-${variant}`);
    await w.context.clock.setSystemTime(LATER);
    const p = await w.open('/index.html?mode=practice&practice=general&duration=30&qwerty=1');
    await settle(p, 4);
    await seed(p, a);
    const held = await holdFiniteRuntime(w.context);
    await p.goto(BASE + SUGGESTED); await p.waitForSelector('#typing-input'); await settle(p, 4);
    // Nothing is queued yet, so advancing the page clock here only lets the load-time preparation reach admission.
    await realWait(p, async () => { await p.clock.runFor(40); return held.requested > 0; }, 'settle awaits the finite runtime');
    const before = { label: await label(p), ids: await ids(p) };
    if (variant === 'first-key') { await p.locator('#typing-input').focus(); await p.keyboard.press('t'); }
    check(`P1b settle/${variant}: the reset committed through C while the runtime import is held`, 'real-seeded', await resetThroughC(p) === true, before);
    await settle(p, 15); // the queued re-preparation runs: a newer generation, baseline reset, nothing admitted
    held.release(); await p.waitForTimeout(200); await settle(p, 8);
    const after = { label: await label(p), ids: await ids(p), state: await state(p), value: await p.inputValue('#typing-input'), typed: await typedCount(p), status: await q(p, '#suggested-status') };
    if (variant === 'idle') check('P1b settle/idle: the older snapshot never installs after invalidation and a newer generation', 'real-seeded',
      after.label === 'General practice · 30 s' && after.ids === before.ids && /0 of 10/.test(after.status ?? ''), { before, after });
    else check('P1b settle/first-key: a block started during the gap stays intact (General, one key, running)', 'real-seeded',
      after.label === 'General practice · 30 s' && after.ids === before.ids && after.state === 'running' && after.value === 't' && after.typed === 1, { before, after });
    await capture(p, `race-settle-${variant}`, 'real-seeded');
    await verifyIsolation(w, p);
    await w.context.close();
  }

  // ---- P1b restart: invalidation while restarting into Suggested, runtime import pending ----
  {
    const w = await world('race-restart');
    await w.context.clock.setSystemTime(LATER);
    const p = await w.open('/index.html?mode=practice&practice=general&duration=30&qwerty=1');
    await settle(p, 4);
    await seed(p, a);
    await p.goto(`${BASE}/index.html?mode=practice&practice=general&duration=30&qwerty=1`); await p.waitForSelector('#typing-input'); await settle(p, 15);
    const held = await holdFiniteRuntime(w.context);
    await p.locator('#suggested-item').click();
    await realWait(p, async () => { await p.clock.runFor(40); return held.requested > 0; }, 'restart loads the finite runtime');
    await p.keyboard.press('t'); // input is held during the restart: this key must not land anywhere
    const during = { value: await p.inputValue('#typing-input'), disabled: await p.evaluate(() => document.querySelector('#typing-input').disabled) };
    check('P1b restart: the reset committed through C while restarting', 'real-seeded', await resetThroughC(p) === true, during);
    held.release(); await p.waitForTimeout(200); await settle(p, 15);
    const after = { label: await label(p), slot: await slot(p), value: await p.inputValue('#typing-input'), focus: await active(p), status: await q(p, '#suggested-status') };
    check('P1b restart: the snapshot admitted before the reset never installs; honest General with its reason', 'real-seeded',
      after.label === 'General practice · 30 s' && /general/i.test(after.slot) && /0 of 10/.test(after.status ?? ''), { during, after });
    check('P1b restart: no key landed while input was held; the next key starts exactly once', 'real-seeded', during.value === '' && after.value === '', { during, after });
    await p.locator('#typing-input').focus(); await p.keyboard.press('t');
    check('P1b restart: first key after the restart starts the General block once', 'real-seeded', await state(p) === 'running' && await typedCount(p) === 1, { state: await state(p) });
    await capture(p, 'race-restart', 'real-seeded');
    await verifyIsolation(w, p);
    await w.context.close();
  }
}

async function liveFlows() {
  const a = loadFixture('sources-a'), b = loadFixture('sources-b');
  // ---- Delayed save: Enter at 0 ms and at 200 ms while the save is pending; failure settling mid-block ----
  {
    const { w, p } = await seededWorld('delayed-save', a.slice(0, 4), '/practice.html?duration=30&qwerty=1');
    check('delayed save: four seeded tests, test 5 ready', 'real-seeded', await label(p) === 'Baseline test 5 of 10 · 30 s', { label: await label(p) });
    for (const [test, delay] of [[5, 0], [6, 200]]) {
      await armSaveGate(p);
      await p.locator('#typing-input').focus();
      await typeBlock(p);
      await realWait(p, async () => await saveHeld(p) > 0, `test ${test} save held`);
      const result = { label: await q(p, '.result-label'), save: await q(p, '#save-state') };
      if (delay) await p.clock.runFor(delay);
      await p.keyboard.press('Enter');
      await p.waitForTimeout(300);
      const pending = { label: await label(p), focus: await active(p), slot: await slot(p), state: await state(p), held: await saveHeld(p) };
      check(`REG-5${delay ? 'b' : 'a'}: Enter at ${delay} ms while test ${test}'s save is pending -> test ${test + 1}, focus in the text, nothing at risk shown`, 'real-seeded',
        result.label === `Baseline test ${test} of 10 · 30 s · complete` && /^Baseline test( \d+ of 10)? · 30 s$/.test(pending.label ?? '') && pending.focus === 'typing-input' && pending.state === 'idle' && !/isn.t saved/.test(pending.slot) && pending.held === 1, { result, pending });
      await releaseSaveGate(p); await p.waitForTimeout(300); await settle(p, 12);
      const settled = { label: await label(p), slot: await slot(p), sources: (await savedSources(p)).length };
      check(`REG-5${delay ? 'b' : 'a'}: the save then succeeds once; test ${test + 1} is ready with its number`, 'real-seeded', settled.label === `Baseline test ${test + 1} of 10 · 30 s` && settled.sources === test && !/isn.t saved/.test(settled.slot), settled);
    }
    // REG-5e: test 7's save is held, test 8 starts, then the save fails while test 8 runs.
    await armSaveGate(p);
    await p.locator('#typing-input').focus();
    await typeBlock(p);
    await realWait(p, async () => await saveHeld(p) > 0, 'test 7 save held');
    await p.keyboard.press('Enter'); await p.waitForTimeout(300); await settle(p, 6);
    await p.locator('#typing-input').focus();
    await typeBlock(p, { until: 4000 });
    const running = { label: await label(p), value: await p.inputValue('#typing-input'), state: await state(p), ids: await ids(p) };
    await failWrites(p); await releaseSaveGate(p); await p.waitForTimeout(400);
    await p.clock.runFor(200); await p.waitForTimeout(100);
    const during = { label: await label(p), value: await p.inputValue('#typing-input'), state: await state(p), ids: await ids(p), focus: await active(p) };
    check('REG-5e: a save failure settling during the next active block leaves its run, label, text and focus untouched', 'real-seeded',
      running.label === 'Baseline test 8 of 10 · 30 s' && during.label === running.label && during.value === running.value && during.state === 'running' && during.ids === running.ids && during.focus === 'typing-input', { running, during });
    await restoreWrites(p);
    await typeBlock(p, { until: 26000 }); await waitSaved(p);
    const after = { block: await q(p, '#completion', 'innerText') };
    check('REG-5e: after the block, the unsaved test 7 is offered for recovery', 'real-seeded', /7 isn.t saved|Test 7/.test(after.block ?? '') && /retry/i.test(after.block ?? ''), after);
    await capture(p, 'delayed-save-failure-after-block', 'real-seeded');
    await verifyIsolation(w, p);
    await w.context.close();
  }

  // ---- REG-6b: the tenth save fails, then retry unlocks exactly once ----
  {
    const { w, p } = await seededWorld('tenth-save', a.slice(0, 9), '/practice.html?duration=30&qwerty=1');
    check('tenth save: nine seeded tests, test 10 ready', 'real-seeded', await label(p) === 'Baseline test 10 of 10 · 30 s', { label: await label(p) });
    await failWrites(p);
    await p.locator('#typing-input').focus();
    await typeBlock(p); await waitSaved(p);
    const failed = { block: await q(p, '#baseline-result', 'innerText'), focus: await activeText(p), value: await progressValue(p) };
    check('REG-6b: tenth save failed: not counted, retry saving is the primary, no completion or unlock claimed', 'real-seeded',
      /Not saved yet, so it doesn.t count/.test(failed.block ?? '') && /^retry saving/.test(failed.focus) && !/Baseline complete|Suggested has a focus/.test(failed.block ?? '') && failed.value === '9', failed);
    await capture(p, 'tenth-save-failed', 'real-seeded');
    await restoreWrites(p);
    await p.keyboard.press('Enter'); await waitSaved(p); await settle(p, 12);
    const unlocked = { block: await q(p, '#baseline-result', 'innerText'), focus: await activeText(p), retry: await p.locator('#result-actions', { hasText: 'retry saving' }).count(), sources: (await savedSources(p)).filter(s => s.mode === 'assessment').length };
    check('REG-6b: retry saves once; Baseline complete and the th focus unlock exactly once', 'real-seeded',
      (unlocked.block?.match(/Baseline complete/g) ?? []).length === 1 && /Suggested has a focus: th/.test(unlocked.block ?? '') && /try suggested · th/.test(unlocked.focus) && unlocked.retry === 0 && unlocked.sources === 10, unlocked);
    await capture(p, 'tenth-save-retried', 'real-seeded');
    const progress = await w.open('/progress.html'); await settle(progress, 12);
    check('REG-6b: Progress counts 10 of 10 once', 'real-seeded', ((await appText(progress)).match(/10 of 10/g) ?? []).length === 1, {});
    await verifyIsolation(w, p);
    await w.context.close();
  }

  // ---- Focus change between two admitted pairs; a running plan stays frozen ----
  {
    const { w, p } = await seededWorld('focus-change', a, SUGGESTED);
    const ready = { label: await label(p), ids: await ids(p) };
    await p.locator('#typing-input').focus();
    await typeBlock(p, { base: 35, slow: 35, sentences: 1 });
    await seed(p, b); // a durable storage change during the running th block (ten in-slow practice runs)
    await settle(p, 6);
    const running = { label: await label(p), ids: await ids(p), state: await state(p) };
    check('focus change: new evidence during a running th block never changes its label or plan', 'real-seeded',
      ready.label === 'Suggested practice · th · 30 s' && running.label === ready.label && running.ids === ready.ids && running.state === 'running', { ready, running });
    await typeBlock(p, { base: 35, slow: 35 }); await waitSaved(p);
    const end = { label: await q(p, '.result-label') };
    await p.keyboard.press('Enter'); await settle(p, 15);
    const changed = { label: await label(p), slot: await slot(p), ids: await ids(p) };
    check('D1c focus change: the next Suggested block runs the newly admitted in plan and says once that it moved from th', 'real-seeded',
      /^Suggested practice · th · /.test(end.label ?? '') && changed.label === 'Suggested practice · in · 30 s' && /\bth\b/.test(changed.slot) && /\bin\b/.test(changed.slot) && changed.ids !== ready.ids, { end, changed });
    await capture(p, 'focus-change-announced', 'real-seeded');
    await p.locator('#typing-input').focus();
    await typeBlock(p, { base: 220, slow: 220 }); await waitSaved(p);
    await p.keyboard.press('Enter'); await settle(p, 15);
    const again = { label: await label(p), slot: await slot(p) };
    check('D1c: the change is announced once; the next in block names no previous pair', 'real-seeded', again.label === 'Suggested practice · in · 30 s' && !/\bth\b/.test(again.slot), again);
    await p.reload(); await p.waitForSelector('#typing-input'); await settle(p, 15);
    const reloaded = { label: await label(p), slot: await slot(p) };
    check('D1b reload after the focus changed: the current in Suggested is ready, no previous pair named', 'real-seeded', reloaded.label === 'Suggested practice · in · 30 s' && !/\bth\b|leans on/.test(reloaded.slot), reloaded);
    await verifyIsolation(w, p);
    await w.context.close();
  }

  // ---- Deleting a counted result through the existing results-page control ----
  {
    const { w, p } = await seededWorld('delete-counted', a, SUGGESTED);
    check('deletion: ten seeded tests, Suggested th ready', 'real-seeded', await label(p) === 'Suggested practice · th · 30 s', { label: await label(p) });
    const results = await w.open(`/results.html?id=${encodeURIComponent(a[9].id)}`);
    await settle(results, 8);
    results.once('dialog', dialog => dialog.accept());
    await results.locator('#delete-result').click();
    await results.waitForURL(/progress\.html/); await settle(results, 15);
    const progress = await appText(results);
    check('deletion: the existing Delete control removes a counted test; Progress shows 9 of 10 and no median', 'real-seeded', /9 of 10/.test(progress) && !/Last 10 tests · median/i.test(progress), { text: progress.slice(0, 500) });
    await capture(results, 'deleted-counted-progress', 'real-seeded');
    await settle(p, 15);
    const after = { label: await label(p), slot: await slot(p), status: await q(p, '#suggested-status') };
    check('deletion: the open ready Suggested block steps back to honest General via the real storage invalidation', 'real-seeded',
      after.label === 'General practice · 30 s' && /9 of 10/.test(after.status ?? '') && /general/i.test(after.slot), after);
    await capture(p, 'deleted-counted-practice', 'real-seeded');
    await verifyIsolation(w, p);
    await w.context.close();
  }
}

try {
  if (PHASE === 'real') await realFlows();
  else if (PHASE === 'typing-flow') await typingFlow();
  else if (PHASE === 'fixtures') await buildFixtures();
  else if (PHASE === 'race') await raceFlows();
  else if (PHASE === 'live') await liveFlows();
  else await injectedFlows();
} catch (error) {
  check(`execution (${PHASE})`, PHASE, false, { error: String(error?.stack ?? error).slice(0, 1500) });
} finally {
  await browser.close().catch(() => {});
  if (!serverExited) { const exited = new Promise(resolve => server.once('exit', resolve)); server.kill(); await exited; }
  receipts.cleanup = { serverExited: true, portClosed: !(await portOpen()), finished: new Date().toISOString() };
  receipts.databases = [...databases];
  check('helper cleanup: own server exited and port 5324 closed', PHASE, receipts.cleanup.portClosed, receipts.cleanup);
  check('no page errors or console errors', PHASE, errors.length === 0, errors.slice(0, 20));
  const summary = { phase: PHASE, base: BASE, browser: receipts.browser.version, total: checks.length, passed: checks.filter(c => c.pass).length, failed: checks.filter(c => !c.pass).map(c => c.id) };
  writeFileSync(path.join(OUT, `${PHASE}-flows.json`), JSON.stringify({ summary, checks, shots, errors, receipts }, null, 1));
  writeFileSync(path.join(OUT, `${PHASE}-helper-receipt.json`), JSON.stringify(receipts, null, 1));
  console.log(JSON.stringify(summary, null, 1));
  if (summary.failed.length) process.exitCode = 1;
}
