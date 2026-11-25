// Production coach and native typing flows on an isolated IndexedDB and accelerated browser clock.
//   PLAYWRIGHT_MODULE=<playwright-core/index.mjs> COACH_OUT=<evidence dir> COACH_PHASE=real node tests/browser/coach-app.mjs
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { launchBrowser } from './browser-engine.mjs';

assert.ok(process.env.COACH_OUT, 'Set COACH_OUT to the evidence directory');
const PORT = Number(process.env.BROWSER_PORT ?? 5324);
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
  console.log(pass ? 'PASS' : 'FAIL', `[${source}]`, id, pass ? '' : JSON.stringify(observed ?? null).slice(0, 600));
};
const errors = [];
const receipts = { phase: PHASE, port: PORT, node: process.execPath, started: new Date().toISOString() };

// ---------- Owned helper: one hidden Vite server on the strict port ----------
const portOpen = () => new Promise(resolve => { const socket = net.connect(PORT, '127.0.0.1'); socket.once('connect', () => { socket.destroy(); resolve(true); }); socket.once('error', () => resolve(false)); });
assert.ok(['real', 'typing-flow'].includes(PHASE), 'Use COACH_PHASE=real or typing-flow');
assert.equal(await portOpen(), false, `port ${PORT} must be free before the run`);
const args = ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'];
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
let browser;

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
async function world(label) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
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
async function typeSentences(page, count, interval) {
  const input = page.locator('#typing-input');
  await input.focus();
  for (let i = 0; i < count; i++) {
    const text = (await page.locator('#target-description').textContent()).replace('Passage to copy: ', '');
    for (let at = 0; at <= text.length; at++) {
      const ch = text[at] ?? ' ';
      await page.clock.fastForward(interval(text.slice(at - 1, at + 1), i));
      await page.keyboard.press(ch === ' ' ? 'Space' : ch);
    }
    assert.equal(await input.inputValue(), '', 'Space submitted the passage');
  }
}
async function finishBlock(page, duration) {
  await page.clock.fastForward(duration + 150);
  await page.locator('#full-result:not([hidden])').waitFor({ state: 'attached' });
  const id = new URL(await page.locator('#full-result').getAttribute('href'), BASE).searchParams.get('id');
  return (await savedSources(page)).find(source => source.id === id);
}

// Layout at three widths: no horizontal overflow, no undefined/NaN copy, plus a capture.
const shots = [];
async function capture(page, name, source) {
  const original = page.viewportSize();
  for (const [width, height] of WIDTHS) {
    await page.setViewportSize({ width, height });
    if (name === 'lab' && width <= 390) await page.locator('#coach-heading').evaluate(el => el.scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(80);
    const layout = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - window.innerWidth, text: document.querySelector('#app')?.innerText ?? '',
      // Check both the explanation and any recovery keys against the slot bounds.
      clipped: [...document.querySelectorAll('.slot .key-small, #exercise-warning')].filter(k => k.offsetParent !== null).filter(k => { const r = k.getBoundingClientRect(), box = k.closest('.slot').getBoundingClientRect(); return r.bottom > box.bottom + 1 || r.right > box.right + 1; }).map(k => k.textContent) }));
    const file = `${name}-${width}.png`;
    await page.screenshot({ path: path.join(SHOTS, file) });
    shots.push({ file, source, width });
    check(`layout ${name} @${width}: no horizontal overflow, clipped coach text or invalid copy`, source, layout.overflow <= 0 && !BAD.test(layout.text) && !layout.clipped.length, { overflow: layout.overflow, bad: layout.text.match(BAD)?.[0], clipped: layout.clipped });
  }
  await page.setViewportSize(original);
}

async function realFlows() {
  const w = await world('coach');
  await w.context.addInitScript(() => { Math.random = () => 0.999999; });
  const page = await w.open('/index.html?practice=recommended&duration=15');
  const goto = async (kind, seconds, qwerty = 1) => {
    await page.goto(BASE + `/index.html?practice=${kind}&duration=${seconds}&qwerty=${qwerty}`);
    await page.locator('#typing-input').waitFor();
  };
  const warning = page.locator('#exercise-warning');
  const label = page.locator('#block-identity');
  await warning.filter({ hasText: 'QWERTY keyboard' }).waitFor();
  check('QWERTY required with the declaration control available', 'real', await page.locator('#qwerty').isVisible());
  await capture(page, 'qwerty-required', 'real');
  await page.locator('#qwerty').click();
  await warning.filter({ hasText: 'No saved timings yet' }).waitFor();
  check('empty Suggested starts an ordinary timed General block', 'real', /General practice/.test(await label.textContent()));
  await page.locator('#typing-input').focus();
  await capture(page, 'no-pair', 'real');

  // Native keyboard events at deterministic intervals. Slow th relative to each other pair at this speed.
  const table = JSON.parse(readFileSync(new URL('../../src/generated/coach-model.json', import.meta.url), 'utf8'));
  const speed = Math.log(12000 / 205);
  const interval = pair => {
    if (!/^[a-z]{2}$/.test(pair)) return 50;
    const p = (pair.charCodeAt(0) - 97) * 26 + pair.charCodeAt(1) - 97;
    const expected = table.a[p] + table.b[p] * (table.low - table.center) + speed - table.low;
    return Math.round(Math.exp(expected) * (pair === 'th' ? 2.8 : pair === 'he' || pair === 'or' ? 1.6 : 1));
  };
  await typeSentences(page, 4, interval);
  const general = await finishBlock(page, 15000);
  check('General fallback is saved unmarked and has genuine submitted evidence', 'real',
    general.mode === 'practice' && !general.practiceFocus && !general.manualDrill && !general.qualityFlags.length && general.sentences.filter(s => s.eligible).length === 4);
  await page.locator('#again').click();
  await label.filter({ hasText: /Suggested practice\s*·\s*th/ }).waitFor();
  check('Suggested issues th at the selected 15 seconds from General alone', 'real',
    (await label.textContent()).includes('15') && await warning.locator('strong').textContent() === 'th' && /timings/.test(await warning.textContent()));
  const suggestedIds = await page.locator('#stage').getAttribute('data-prompt-ids');
  await capture(page, 'pair', 'real');
  await page.locator('#why button').click();
  await page.locator('#coach-why').waitFor();
  check('Why explains the measured gap and extrapolated speed', 'real', /timings[\s\S]*32 to 150 WPM[\s\S]*fit check/i.test(await page.locator('#coach-why').textContent()));
  await capture(page, 'pair-why', 'real');
  await page.locator('#why button').click();
  await page.reload();
  await label.filter({ hasText: /Suggested practice\s*·\s*th/ }).waitFor();
  check('reload retains the selected duration, suggestion and saved reason', 'real', /15/.test(await label.textContent()) && /timings/.test(await warning.textContent()));

  const lab = await w.open('/lab.html');
  const readout = lab.locator('.coach-readout');
  await readout.waitFor();
  const before = await readout.innerText();
  check('Lab reports extrapolation, fit denominators and personal gaps', 'real', /outside the training range/.test(before) && /80% ranges/.test(before) && /Largest pair gaps/.test(before) && await readout.locator('dd').last().locator('strong').count() === 3);
  await capture(lab, 'lab', 'real');
  await lab.close();
  await typeSentences(page, 1, () => 80);
  const suggested = await finishBlock(page, 15000);
  check('actual Suggested result has model source and selected duration', 'real', suggested.practiceFocus?.source === 'model' && suggested.practiceFocus.pair === 'th' && !suggested.manualDrill && suggested.settings.durationMs === 15000 && suggested.sentences[0].eligible);
  await goto('manual&pair=th', 15);
  await label.filter({ hasText: /Pair practice/ }).waitFor();
  check('manual Pair and Suggested use exactly the same v2 dense bank', 'real', (await page.locator('#stage').getAttribute('data-prompt-ids')) === suggestedIds);
  await typeSentences(page, 1, () => 80);
  const manual = await finishBlock(page, 15000);
  check('manual result retains its own source', 'real', manual.manualDrill?.source === 'manual' && !manual.practiceFocus && manual.sentences[0].eligible);
  await page.goto(BASE + '/lab.html');
  await page.locator('.coach-readout').waitFor();
  check('neither drill changes any evidence shown by the Lab', 'real', await page.locator('.coach-readout').innerText() === before);
  await goto('general', 120);
  await typeSentences(page, 16, (_pair, i) => i % 2 ? 225 : 12);
  await finishBlock(page, 120000);
  await goto('recommended', 60);
  await warning.filter({ hasText: 'don’t fit your recent typing' }).waitFor();
  check('poor fit returns to General even with an earlier issued pair', 'real', /General practice/.test(await label.textContent()) && /60/.test(await label.textContent()));
  await capture(page, 'fit-failed', 'real');
  await page.reload();
  await warning.filter({ hasText: 'don’t fit' }).waitFor();
  check('reload reproduces the fit fallback', 'real', /General practice/.test(await label.textContent()));
  await verifyIsolation(w, page);
  await w.context.close();
}

// COACH_PHASE=typing-flow runs the committed MCP function (typing-flow.js) unchanged against this
// script's own preview server, as browser_run_code_unsafe would: it receives a page and makes its own contexts.
async function typingFlow() {
  const page = await (await browser.newContext()).newPage();
  const run = (0, eval)(readFileSync(new URL('./typing-flow.js', import.meta.url), 'utf8'));
  const report = await run(page, BASE);
  writeFileSync(path.join(OUT, 'typing-flow.json'), JSON.stringify(report, null, 1));
  for (const result of report.results) check(`typing-flow: ${result.name}`, 'real', result.status === 'PASS', result.details);
  check('typing-flow: no page errors', 'real', report.errors.length === 0, report.errors);
}

try {
  const launched = await launchBrowser();
  browser = launched.browser;
  receipts.browser = { engine: launched.engine, executable: launched.executable, version: browser.version(), headless: true, launchedBy: 'playwright-core launch (temporary profile)' };
  if (PHASE === 'real') await realFlows();
  else if (PHASE === 'typing-flow') await typingFlow();
} catch (error) {
  check(`execution (${PHASE})`, PHASE, false, { error: String(error?.stack ?? error).slice(0, 1500) });
} finally {
  await browser?.close().catch(() => {});
  if (!serverExited) { const exited = new Promise(resolve => server.once('exit', resolve)); server.kill(); await exited; }
  receipts.cleanup = { serverExited: true, portClosed: !(await portOpen()), finished: new Date().toISOString() };
  receipts.databases = [...databases];
  check(`helper cleanup: own server exited and port ${PORT} closed`, PHASE, receipts.cleanup.portClosed, receipts.cleanup);
  check('no page errors or console errors', PHASE, errors.length === 0, errors.slice(0, 20));
  const summary = { phase: PHASE, base: BASE, browser: receipts.browser?.version, total: checks.length, passed: checks.filter(c => c.pass).length, failed: checks.filter(c => !c.pass).map(c => c.id) };
  writeFileSync(path.join(OUT, `${PHASE}-flows.json`), JSON.stringify({ summary, checks, shots, errors, receipts }, null, 1));
  writeFileSync(path.join(OUT, `${PHASE}-helper-receipt.json`), JSON.stringify(receipts, null, 1));
  console.log(JSON.stringify(summary, null, 1));
  if (summary.failed.length) process.exitCode = 1;
}
