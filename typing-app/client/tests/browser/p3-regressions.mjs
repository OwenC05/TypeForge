// From typing-app/client: npm run build, then set PLAYWRIGHT_MODULE and run this file with Node 24.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { after, before, test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { stripVTControlCharacters } from 'node:util';
import { assessmentPrompts } from '../../src/corpus.ts';
import { TypingEngine } from '../../src/engine.ts';

const base = 'http://127.0.0.1:5341';
const suggested = '/index.html?mode=practice&practice=recommended&duration=30&qwerty=1';
const screenshots = '.playwright-mcp/artifacts/p3/screens';
const now = Date.UTC(2026, 10, 24, 12);
let server, serverExit, browser;

before(async () => {
  assert.ok(process.env.PLAYWRIGHT_MODULE, 'Set PLAYWRIGHT_MODULE to playwright-core/index.mjs');
  const { chromium } = await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE)).href);
  mkdirSync(screenshots, { recursive: true });
  server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '5341', '--strictPort'],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'inherit'] });
  serverExit = once(server, 'exit');
  let ready = false;
  for await (const line of createInterface({ input: server.stdout })) {
    if (stripVTControlCharacters(line).includes(`${base}/`)) { ready = true; break; }
  }
  assert.ok(ready, 'our strict-port preview must start before opening the app');
  const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  browser = await chromium.launch({ executablePath: existsSync(chrome) ? chrome : undefined });
});
after(async () => {
  try { await browser?.close(); }
  finally {
    if (server && server.exitCode === null && server.signalCode === null) server.kill();
    await serverExit;
  }
});

// Ten engine-generated assessments in a pre-upgrade database. The production app migrates them and
// decides whether to admit Suggested. Rotating the passages gives both halves distinct word contexts.
function assessment(index) {
  const offset = index * 4;
  const prompts = [...assessmentPrompts.slice(offset), ...assessmentPrompts.slice(0, offset)];
  const engine = new TypingEngine({ id: crypto.randomUUID(), prompts, mode: 'assessment', durationMs: 30000,
    inputMode: 'flow-v1', qwerty: true, corpusVersion: '1' });
  let time = 0;
  while (time < 30000) {
    const position = engine.value.length;
    const text = engine.prompt.text;
    const char = text[position] ?? ' ';
    time += text.slice(position - 1, position + 1) === 'th' ? 330 : 110;
    engine.edit({ start: position, end: position, text: char, pressTime: time }, time);
  }
  engine.tick(31000);
  return engine.result(new Date(now - (10 - index) * 60000).toISOString());
}

async function openPractice(t, sources, url) {
  const context = await browser.newContext();
  const errors = [];
  t.after(async () => { await context.close(); assert.deepEqual(errors, [], 'browser errors'); });
  const name = `typeforge-ui-synthetic-${crypto.randomUUID()}`;
  await context.addInitScript(name => {
    const db = globalThis.indexedDB;
    Object.defineProperty(globalThis, 'indexedDB', { value: new Proxy(db, { get(target, property) {
      if (property === 'open') return (requested, version) => {
        if (requested !== 'typeforge') throw new Error(`Unexpected database ${requested}`);
        return version === undefined ? target.open(name) : target.open(name, version);
      };
      if (property === 'deleteDatabase') return () => { throw new Error('Synthetic fixture refuses deletion'); };
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    } }) });
  }, name);
  await context.clock.install({ time: new Date(now) });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  // Start on an empty document at the preview origin so app code only sees the seeded database.
  await page.route(`${base}/fixture`, route => route.fulfill({ contentType: 'text/html', body: '<title>Fixture</title>' }));
  await page.goto(`${base}/fixture`);
  await page.evaluate(async ({ name, sources }) => {
    await new Promise((resolve, reject) => {
      const open = indexedDB.open('typeforge', 2);
      open.onerror = () => reject(open.error);
      open.onupgradeneeded = () => {
        if (open.result.name !== name) { open.transaction.abort(); return; }
        const store = open.result.createObjectStore('results', { keyPath: 'id' });
        for (const source of sources) store.add(source);
      };
      open.onsuccess = () => { open.result.close(); resolve(); };
    });
  }, { name, sources });
  assert.deepEqual(await page.evaluate(async () => (await indexedDB.databases()).map(db => db.name)), [name]);
  await page.goto(base + url);
  return page;
}

const promptText = page => page.locator('#target-description').textContent().then(text => text.replace('Passage to copy: ', ''));
const focused = page => page.locator('#typing-input').evaluate(input => document.activeElement === input);
const state = page => page.locator('#stage').getAttribute('data-state');
const baseline = () => Array.from({ length: 10 }, (_, index) => assessment(index));

async function savedRecord(page) {
  await page.locator('#full-result:not([hidden])').waitFor({ state: 'attached' });
  const href = await page.locator('#full-result').getAttribute('href');
  const id = new URL(href, base).searchParams.get('id');
  return page.evaluate(id => new Promise((resolve, reject) => {
    const open = indexedDB.open('typeforge');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const get = db.transaction('currentResults').objectStore('currentResults').get(id);
      get.onsuccess = () => { db.close(); resolve(get.result); };
      get.onerror = () => { db.close(); reject(get.error); };
    };
  }), id);
}

test('a native key for the invalidated sentence never becomes a General first-attempt error', async t => {
  const page = await openPractice(t, baseline(), suggested);
  await page.getByText('Suggested practice · th · 30 s', { exact: true }).waitFor();
  await page.clock.pauseAt(await page.evaluate(() => new Date(Date.now() + 1000).toISOString()));
  const visible = await promptText(page);
  const oldIds = await page.locator('#stage').getAttribute('data-prompt-ids');
  assert.ok(await focused(page));
  await page.screenshot({ path: `${screenshots}/suggested-before-key.png` });
  await page.evaluate(() => {
    // Keep the General shuffle in bank order and invalidate between keydown and the matching input.
    Math.random = () => 0.99999;
    document.querySelector('#typing-input').addEventListener('beforeinput', () => {
      window.dispatchEvent(new Event('focus'));
    }, { capture: true, once: true });
  });
  await page.keyboard.press(visible[0]);
  const replacement = await promptText(page);
  assert.notEqual(visible[0], replacement[0], 'old and new first letters differ');
  assert.notEqual(await page.locator('#stage').getAttribute('data-prompt-ids'), oldIds);
  assert.match(await page.locator('#block-identity').textContent(), /^General practice/);
  assert.equal(await page.locator('#prompt .wrong').count(), 0, `the visible "${visible[0]}" must not be scored against "${replacement[0]}"`);
  assert.equal(await page.locator('#typing-input').inputValue(), '');
  assert.ok(await focused(page));
  await page.screenshot({ path: `${screenshots}/general-after-invalidation.png` });
  await page.clock.runFor(2000);
  assert.equal(await state(page), 'idle');
  assert.equal(await promptText(page), replacement, 'queued recheck keeps General for this block');
  await page.keyboard.press(replacement[0]);
  assert.equal(await state(page), 'running');
  await page.clock.fastForward(29900);
  assert.equal(await state(page), 'running', 'timer starts on the first accepted General letter');
  await page.clock.runFor(200);
  const result = await savedRecord(page);
  assert.equal(result.mode, 'practice');
  assert.equal(result.sentences[0].promptText, replacement);
  assert.equal(result.sentences[0].response, replacement[0]);
  assert.equal(result.metrics.attemptedCharacters, 1);
  assert.equal(result.metrics.accuracy, 100);
  assert.deepEqual(result.sentences[0].keys[replacement[0]], { attempts: 1, correct: 1, firstAttempts: 1, firstErrors: 0 });
});
