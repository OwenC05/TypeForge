// From typing-app/client: npm run build, then set PLAYWRIGHT_MODULE and run this file with Node 24.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { after, before, test } from 'node:test';
import { stripVTControlCharacters } from 'node:util';
import { launchBrowser } from './browser-engine.mjs';
import { assessmentPrompts } from '../../src/corpus.ts';
import { TypingEngine } from '../../src/engine.ts';

const port = Number(process.env.BROWSER_PORT ?? 5341);
const base = `http://127.0.0.1:${port}`;
const suggested = '/index.html?mode=practice&practice=recommended&duration=30&qwerty=1';
const screenshots = path.join(process.env.COACH_OUT ?? '.playwright-mcp/artifacts/p3', 'screens');
const now = Date.UTC(2026, 10, 24, 12);
let server, serverExit, browser;

before(async () => {
  mkdirSync(screenshots, { recursive: true });
  server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'inherit'] });
  serverExit = once(server, 'exit');
  let ready = false;
  for await (const line of createInterface({ input: server.stdout })) {
    if (stripVTControlCharacters(line).includes(`${base}/`)) { ready = true; break; }
  }
  assert.ok(ready, 'our strict-port preview must start before opening the app');
  ({ browser } = await launchBrowser());
});
after(async () => {
  try { await browser?.close(); }
  finally {
    if (server && server.exitCode === null && server.signalCode === null) server.kill();
    await serverExit;
  }
});

// Saved assessments from an earlier database, with slow th timings across different passages.
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
const assessed = () => [assessment(0), assessment(1), assessment(2)];

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
  const page = await openPractice(t, assessed(), suggested);
  await page.locator('#block-identity').filter({ hasText: /Suggested practice\s*·\s*th\s*·\s*30\s+s/ }).waitFor();
  await page.clock.pauseAt(await page.evaluate(() => new Date(Date.now() + 1000).toISOString()));
  const visible = await promptText(page);
  const oldIds = await page.locator('#stage').getAttribute('data-prompt-ids');
  assert.ok(await focused(page));
  await page.screenshot({ path: `${screenshots}/suggested-before-key.png` });
  await page.evaluate(oldFirst => {
    // Choose a General first letter different from the visible pair passage.
    Math.random = () => oldFirst === 't' ? 0 : 0.99999;
    document.querySelector('#typing-input').addEventListener('beforeinput', () => {
      window.dispatchEvent(new Event('focus'));
    }, { capture: true, once: true });
  }, visible[0]);
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

test('Chromium sends no input for Backspace on empty or Delete at the end', {
  skip: (process.env.BROWSER_ENGINE ?? 'chromium') !== 'chromium',
}, async t => {
  const page = await openPractice(t, [], '/index.html?practice=general&duration=30&qwerty=1');
  const input = page.locator('#typing-input');
  await input.evaluate(el => {
    window.deletionEvents = [];
    for (const type of ['beforeinput', 'input']) el.addEventListener(type, e => {
      if (e.inputType.startsWith('delete')) window.deletionEvents.push([e.type, e.inputType]);
    });
  });
  await input.press('Backspace');
  const text = await promptText(page);
  await input.press(text[0]);
  await input.press('Delete');
  for (const key of text.slice(1) + ' ') {
    await page.clock.fastForward(60);
    await input.press(key === ' ' ? 'Space' : key);
  }
  await input.press((await promptText(page))[0]);
  await input.press('Backspace');
  await input.press((await promptText(page))[0]);
  assert.deepEqual(await page.evaluate(() => window.deletionEvents), [
    ['beforeinput', 'deleteContentBackward'], ['beforeinput', 'deleteContentForward'],
    ['beforeinput', 'deleteContentBackward'], ['input', 'deleteContentBackward'],
  ]);
  await page.clock.fastForward(30100);
  const source = await savedRecord(page);
  assert.equal(source.sentences[0].eligible, true);
  assert.ok(source.sentences[1].qualityFlags.includes('edited'));
});

const timedCases = [
  { name: 'General', url: '/index.html?practice=general&duration=30', stage: 'General practice', tag: 'PRACTICE' },
  { name: 'timer-ended Suggested', url: suggested, stage: /Suggested practice\s*·\s*th/, tag: 'SUGGESTED PAIR th' },
  { name: 'manual', url: '/index.html?practice=manual&pair=th&duration=30', stage: 'Pair practice · th', tag: 'MANUAL PAIR th' },
  { name: 'assessment', url: '/practice.html?duration=30&qwerty=0', stage: 'Assessment', tag: 'ASSESSMENT' },
];
for (const { name, url, stage, tag } of timedCases) {
  test(`${name} full result displays ${tag}`, async t => {
    const page = await openPractice(t, url === suggested ? assessed() : [], url);
    await page.locator('#block-identity').filter({ hasText: stage }).waitFor();
    const target = await promptText(page);
    await page.locator('#typing-input').press(target[0]);
    await page.clock.fastForward(30100);
    const result = await savedRecord(page);
    assert.equal(result.schemaVersion, 1);
    assert.equal(result.mode, name === 'assessment' ? 'assessment' : 'practice');
    assert.equal(result.metrics.elapsedMs, 30000);
    assert.equal(result.sentences[0].promptText, target);
    assert.deepEqual(result.practiceFocus, url === suggested ? { pair: 'th', source: 'model' } : undefined);
    assert.equal(Object.hasOwn(result, 'manualDrill'), name === 'manual');
    const href = await page.locator('#full-result').getAttribute('href');
    await page.goto(new URL(href, base).href);
    assert.equal(await page.locator('.page-heading .tag').textContent(), tag);
    if (url === suggested) await page.screenshot({ path: `${screenshots}/timer-ended-suggested-result.png` });
  });
}

test('an older result with explicit focus retains its recommended tag', async t => {
  const legacy = JSON.parse(readFileSync(new URL('../fixtures/legacy-v1.json', import.meta.url), 'utf8'));
  legacy.mode = 'practice';
  legacy.practiceFocus = { pair: 'th', evidenceCount: 8, source: 'baseline', baselineVersion: 'v1', score: 1 };
  const page = await openPractice(t, [legacy], `/results.html?id=${legacy.id}`);
  assert.equal(await page.locator('.page-heading .tag').textContent(), 'RECOMMENDED PRACTICE');
});

test('a retest of all 40 v1 passages keeps its origin and the next retest excludes typed v2 passages', async t => {
  const engine = new TypingEngine({ id: crypto.randomUUID(), prompts: assessmentPrompts, mode: 'assessment',
    durationMs: 120000, inputMode: 'flow-v1', qwerty: false, corpusVersion: '1' });
  let time = 0;
  for (const prompt of assessmentPrompts) {
    for (const char of prompt.text + ' ') {
      const position = engine.value.length;
      time += 40;
      engine.edit({ start: position, end: position, text: char, pressTime: time }, time);
    }
  }
  engine.tick(120040);
  const origin = engine.result(new Date(now - 120000).toISOString());
  assert.equal(new Set(origin.sentences.map(s => s.promptId)).size, 40);
  const page = await openPractice(t, [origin], `/results.html?id=${origin.id}`);
  await page.getByRole('link', { name: 'Retest with fresh passages' }).click();
  await page.locator('#typing-input').waitFor();
  assert.equal(new URL(page.url()).searchParams.get('retest'), origin.id);
  const listed = () => page.locator('#stage').getAttribute('data-prompt-ids').then(ids => ids.split(' '));
  const first = await listed();
  assert.equal(new Set(first).size, 600);
  assert.ok(first.every(id => /^tatoeba-\d+$/.test(id)));
  const input = page.locator('#typing-input');
  await input.pressSequentially(await promptText(page) + ' ');
  await input.press((await promptText(page))[0]);
  await page.clock.fastForward(120100);
  const saved = await savedRecord(page);
  assert.equal(saved.sourceAssessmentId, origin.id);
  assert.deepEqual(saved.sentences.map(s => [s.promptId, s.submitted]), [[first[0], true], [first[1], false]]);
  await page.locator('#retest-next').click();
  await page.locator('#typing-input').waitFor();
  assert.equal(new URL(page.url()).searchParams.get('retest'), saved.id);
  assert.deepEqual(new Set(await listed()), new Set(first.slice(2)));
});

test('existing assessment, General and finite history stay readable and exportable after upgrade', async t => {
  const assessment = JSON.parse(readFileSync(new URL('../fixtures/legacy-v1.json', import.meta.url), 'utf8'));
  const general = { ...assessment, id: crypto.randomUUID(), mode: 'practice', completedAt: '2026-10-01T12:00:00.000Z' };
  const finite = JSON.parse(readFileSync(new URL('../fixtures/legacy-finite.json', import.meta.url), 'utf8'));
  const page = await openPractice(t, [assessment, general], '/lab.html');
  await page.locator('.coach-readout').waitFor();
  const first = await page.locator('.coach-readout').innerText();
  assert.match(first, /of 2 pair checks across 1 sentence/);
  // The old adapter wrote finite results to currentResults. Keep both old coach stores intact as well.
  const schema = await page.evaluate(source => new Promise((resolve, reject) => {
    const open = indexedDB.open('typeforge');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(['currentResults', 'coachMetadata', 'coachMembership'], 'readwrite');
      tx.objectStore('currentResults').add(source);
      tx.objectStore('coachMetadata').put('existing', 'original');
      tx.objectStore('coachMembership').put({ resultId: source.id });
      tx.onabort = () => reject(tx.error);
      tx.oncomplete = () => { resolve([db.version, [...db.objectStoreNames]]); db.close(); };
    };
  }), finite);
  assert.deepEqual(schema, [3, ['coachMembership', 'coachMetadata', 'currentResults', 'results']]);
  await page.reload();
  await page.locator('.coach-readout').waitFor();
  assert.equal(await page.locator('.coach-readout').innerText(), first);
  await page.goto(base + suggested);
  await page.locator('#exercise-warning').filter({ hasText: 'saved timings don’t show a clear pair yet' }).waitFor();
  assert.match(await page.locator('#block-identity').textContent(), /^General practice/);
  await page.goto(base + '/progress.html');
  await page.locator('#history-rows tr').first().waitFor();
  assert.equal(await page.locator('#history-rows tr').count(), 3);
  const exported = async id => {
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator(id).click()]);
    return JSON.parse(readFileSync(await download.path(), 'utf8'));
  };
  assert.deepEqual((await exported('#export-sources')).sources, [finite, general, assessment]);
  assert.deepEqual((await exported('#export-history')).results, [general, assessment]);
  await page.locator(`#history-rows a[href$="${finite.id}"]`).click();
  assert.match(await page.locator('#finite-title').textContent(), /Suggested practice · th/);
  assert.deepEqual(await exported('#export-result'), finite);
  const retained = await page.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open('typeforge');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result, tx = db.transaction(['coachMetadata', 'coachMembership']);
      const marker = tx.objectStore('coachMetadata').get('original'), membership = tx.objectStore('coachMembership').count();
      tx.oncomplete = () => { db.close(); resolve([marker.result, membership.result]); };
    };
  }));
  assert.deepEqual(retained, ['existing', 1]);
});

test('the evidence read pages past drills and skips just the sentence with obsolete timings', async t => {
  const assessment = JSON.parse(readFileSync(new URL('../fixtures/legacy-v1.json', import.meta.url), 'utf8'));
  const original = assessment.sentences[0];
  const obsolete = { ...original, pairs: { at: { count: 1, sum: 100 } } };
  const mixed = { ...assessment, id: crypto.randomUUID(), mode: 'practice', sentences: [obsolete, original],
    completedAt: '2026-10-01T12:00:00.000Z' };
  const drills = Array.from({ length: 101 }, () => ({ ...assessment, id: crypto.randomUUID(), mode: 'practice',
    manualDrill: { pair: 'th', source: 'manual' }, completedAt: '2026-11-01T12:00:00.000Z' }));
  const page = await openPractice(t, [assessment, mixed, ...drills], '/lab.html');
  const readout = page.locator('.coach-readout');
  await readout.waitFor();
  assert.match(await readout.innerText(), /of 2 pair checks across 1 sentence/);
});

test('a focus change as the coach read finishes leaves the first key usable', async t => {
  const page = await openPractice(t, [], '/fixture');
  await page.addInitScript(() => {
    const count = IDBObjectStore.prototype.count;
    IDBObjectStore.prototype.count = function (...args) {
      const tx = this.transaction;
      if (this.name === 'results' && tx.mode === 'readonly' && tx.objectStoreNames.contains('currentResults')) {
        IDBObjectStore.prototype.count = count;
        // A completed transaction can no longer be aborted. Deliver the focus
        // invalidation before the app's completion handler detaches its listener.
        tx.addEventListener('complete', () => {
          window.dispatchEvent(new Event('focus'));
          window.focusDuringCoachRead = true;
        }, { capture: true, once: true });
      }
      return count.apply(this, args);
    };
  });
  await page.goto(base + suggested);
  await page.waitForFunction(() => window.focusDuringCoachRead);
  await page.locator('#exercise-warning').filter({ hasText: 'No saved timings' }).waitFor();
  const letter = (await promptText(page))[0];
  await page.locator('#typing-input').press(letter);
  assert.equal(await state(page), 'running');
  assert.equal(await page.locator('#typing-input').inputValue(), letter);
});
