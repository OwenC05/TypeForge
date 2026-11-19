// Named regressions for the eight findings of the independent actual-Claude review (05a6767 /
// root import 8337569) plus root's finite-plan end (msg_22b78999d17a). Written before the fixes and
// run first against the frozen prototype (dd37652) to reproduce the defects, then against the
// revision. Real key presses into the native textarea; fast=1 runs the 30 s clock 10x faster.
// Usage: BASE=http://127.0.0.1:5312 OUT=<file.json> PLAYWRIGHT_MODULE=<path> node regressions.mjs
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE)).href);
const BASE = process.env.BASE ?? 'http://127.0.0.1:5312';
const OUT = process.env.OUT;
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const checks = [];
const check = (id, width, pass, observed) => { checks.push({ id, width, pass: Boolean(pass), observed }); console.log(pass ? 'PASS' : 'FAIL', width, id, JSON.stringify(observed).slice(0, 400)); };
const b64 = obj => encodeURIComponent(Buffer.from(JSON.stringify(obj)).toString('base64'));
const BAD = /undefined|null|NaN|\[object/;

async function open(width, height, query, extra = {}) {
  const context = await browser.newContext({ viewport: { width, height }, ...extra });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`${BASE}/index.html?${query}`);
  // A page that never becomes ready is recorded as an error, not a crashed run.
  await page.waitForSelector('body[data-ready="1"]', { timeout: 6000 }).catch(() => errors.push('never ready (boot failed)'));
  await page.waitForTimeout(250);
  return { context, page, errors };
}
const q = (page, sel, prop = 'textContent') => page.evaluate(([s, p]) => { const el = document.querySelector(s); return el ? (p === 'innerText' ? el.innerText : el[p]) : null; }, [sel, prop]);
const active = page => page.evaluate(() => { const a = document.activeElement; return a?.id || `${a?.tagName.toLowerCase()}:${(a?.textContent ?? '').trim().slice(0, 30)}`; });
const allText = page => page.evaluate(() => document.querySelector('#app')?.innerText ?? '');
const whyText = page => page.evaluate(() => document.querySelector('#why-panel')?.textContent ?? '');
async function finishRun(page, text = 'the w') {
  await page.keyboard.type(text, { delay: 35 });
  await page.waitForFunction(() => document.querySelector('#stage')?.dataset.state === 'completed', null, { timeout: 9000 });
}

// Fixture statuses passed as s= so the same regression addresses both the frozen and revised builds.
const base = { policyId: 'fixture', target: 10, exact: true, evidenceScanComplete: true, pending: 0, otherContextCount: null, automaticCoaching: 'enabled', summary: null };
const deferred = { ...base, counted: 10, evidenceScanComplete: null, automaticCoaching: 'disabled', state: 'complete-insufficient', reason: 'coaching-deferred',
  summary: { state: 'available', selectionProofComplete: true, medianWpm: 39, medianAccuracy: 95.8, validAccuracySources: 10, from: '2026-11-09', to: '2026-11-18' } };
const deferredIn = { ...base, counted: 4, evidenceScanComplete: null, automaticCoaching: 'disabled', state: 'in-progress', reason: 'baseline-incomplete' };
const allReasons = [
  ['unavailable', 'policy-invalid'], ['unavailable', 'storage-unavailable'], ['unavailable', 'context-unavailable'], ['unavailable', 'source-integrity'],
  ['pending', 'scan-incomplete'], ['in-progress', 'baseline-incomplete'], ['complete-insufficient', 'coaching-deferred'], ['complete-insufficient', 'stale-evidence'],
  ['complete-insufficient', 'too-few-observations-for-any-pair'], ['complete-insufficient', 'insufficient-context-diversity'], ['complete-insufficient', 'unstable-evidence'],
  ['complete-insufficient', 'no-effect'], ['complete-insufficient', 'corpus-coverage'], ['complete-insufficient', 'exposure-unsupported'], ['unavailable', 'some-future-reason'],
];

const widths = (process.env.WIDTHS ?? '1440x900,390x844,320x640').split(',').map(v => v.split('x').map(Number));
for (const [width, height] of widths) {
  // REG-1 coaching-deferred: no undefined, no gate claim, no advertised unlock (finding 1).
  for (const view of ['press', 'why']) {
    const { context, page, errors } = await open(width, height, `page=practice&s=${b64(deferred)}&view=${view}`);
    const text = `${await q(page, '#exercise-warning')} ${view === 'why' ? await whyText(page) : ''} ${await q(page, '#suggested-status')}`;
    check(`REG-1 coaching-deferred ${view}: honest, no undefined, no gate claim`, width,
      !BAD.test(text) && /isn.t switched on/.test(text) && !/stands out|re-checks|no focus/i.test(text) && !errors.length, { text: text.trim().slice(0, 300), errors });
    await context.close();
  }
  { const { context, page, errors } = await open(width, height, `page=practice&s=${b64(deferredIn)}&view=press`);
    const text = `${await q(page, '#exercise-warning')} ${await q(page, '#suggested-status')}`;
    check('REG-1b disabled config before ten: no unlock advertised', width, !/needs 10|after 10|look for a focus/i.test(text) && !BAD.test(text) && !errors.length, { text, errors });
    await context.close(); }
  if (width === 390) {
    const seen = [];
    for (const [state, reason] of allReasons) {
      const status = { ...base, counted: state.startsWith('complete') ? 10 : state === 'unavailable' ? 0 : 4, exact: state !== 'pending', state, reason, evidenceScanComplete: state === 'pending' ? false : true, focus: undefined };
      for (const view of ['press', 'why']) {
        const { context, page, errors } = await open(width, height, `page=practice&s=${b64(status)}&view=${view}`);
        const text = `${await q(page, '#exercise-warning')} ${await whyText(page)} ${await q(page, '#suggested-status')}`;
        seen.push({ state, reason, view, ok: !BAD.test(text) && !errors.length, text: text.trim().slice(0, 160), errors });
        await context.close();
      }
    }
    check('REG-1c every reason x press/why renders a sentence (exhaustive, unknown reason safe)', width, seen.every(s => s.ok), seen.filter(s => !s.ok));
  }

  // REG-2 rolling summary: label, hierarchy, Progress home, states (finding 2).
  { const { context, page, errors } = await open(width, height, 'page=assessment&fx=s9&view=result&outcome=saved&final=insufficient');
    await page.waitForTimeout(200);
    const block = await q(page, '#baseline-result', 'innerText') ?? '';
    check('REG-2a final result labels summary "Last 10 tests · median"', width, /Last 10 tests · median/i.test(block) && !/Your baseline:/.test(block) && !errors.length, { block: block.slice(0, 300), errors });
    await context.close(); }
  { const { context, page, errors } = await open(width, height, 'page=progress&fx=s10insuff');
    const text = await allText(page);
    check('REG-2b Progress keeps the summary with date range and update note', width, /Last 10 tests · median/i.test(text) && /Updates as you take more 30-second tests/.test(text) && /Nov/.test(text) && !errors.length, { text: text.slice(0, 500), errors });
    await context.close(); }
  for (const [fx, must, mustNot, id] of [
    ['s10summaryPending', /Last 10 tests[^\n]*(being read|check again)/i, /\d+(\.\d)? ?wpm|95\.8/i, 'REG-2c milestone proved, newest-ten selection unproved: no median shown'],
    ['s10nullAcc', /accuracy isn.t available for all (ten|10)/i, /95\.8|accuracy\s*\n?\s*\d/i, 'REG-2d null accuracy: WPM only plus note'],
    ['s9deleted', /9 of 10/, /median|Last 10 tests/i, 'REG-2e below ten after deletion: no cached median'],
    ['sReset', /0 of 10/, /median|Last 10 tests/i, 'REG-2f after reset: no median'],
  ]) {
    const { context, page, errors } = await open(width, height, `page=progress&fx=${fx}`);
    const text = await allText(page);
    check(id, width, must.test(text) && !mustNot.test(text) && !BAD.test(text) && !errors.length, { text: text.slice(0, 500), errors });
    await context.close();
  }

  // REG-3 explicit QWERTY declaration action (finding 3).
  { const { context, page, errors } = await open(width, height, 'page=assessment&fx=s0&qwerty=0');
    const button = page.locator('#exercise-warning button', { hasText: 'my keyboard is qwerty' });
    const present = await button.count() === 1;
    const switchBefore = await page.evaluate(() => document.querySelector('#qwerty')?.hasAttribute('data-checked') || document.querySelector('#qwerty')?.getAttribute('aria-checked') === 'true');
    let after = null;
    if (present) {
      const box = await button.boundingBox();
      await button.click(); await page.waitForTimeout(150);
      after = { label: await q(page, '#block-identity'), focus: await active(page), switchOn: await page.evaluate(() => document.querySelector('#qwerty')?.hasAttribute('data-checked') || document.querySelector('#qwerty')?.getAttribute('aria-checked') === 'true'), visible: box && box.y + box.height <= height };
      await page.keyboard.press('t'); after.stage = await page.evaluate(() => document.querySelector('#stage').dataset.state);
    }
    check('REG-3a assessment hint offers explicit qwerty declaration; first key still starts', width, present && !switchBefore && after?.switchOn && /Baseline test 1 of 10/.test(after?.label ?? '') && after?.focus === 'typing-input' && after?.stage === 'running' && after?.visible && !errors.length, { present, switchBefore, after, errors });
    await context.close(); }
  { const { context, page, errors } = await open(width, height, 'page=assessment&fx=s0&qwerty=0&fast=1');
    await finishRun(page); await page.waitForTimeout(500);
    const has = await page.locator('#baseline-result button', { hasText: 'my keyboard is qwerty' }).count();
    check('REG-3b not-counted (qwerty off) result offers the same declaration key', width, has === 1 && !errors.length, { has, block: await q(page, '#baseline-result', 'innerText'), errors });
    await context.close(); }
  { const { context, page, errors } = await open(width, height, 'page=practice&fx=s0&qwerty=0');
    const focus = await active(page); const declare = await page.locator('text=my keyboard is qwerty').count(); const qOn = await page.evaluate(() => document.querySelector('#qwerty')?.hasAttribute('data-checked'));
    check('REG-3c first visit unchanged: no declaration prompt, qwerty off, textarea focused', width, focus === 'typing-input' && declare === 0 && !qOn && !errors.length, { focus, declare, qOn, errors });
    await context.close(); }

  // REG-4 no exact ordinal from a lower bound (finding 4).
  { const { context, page, errors } = await open(width, height, 'page=assessment&fx=s7scan');
    const label = await q(page, '#block-identity'); const hint = await q(page, '#exercise-warning');
    check('REG-4a incomplete proof: no ordinal in label or hint', width, label === 'Baseline test · 30 s' && /at least 7 of 10/i.test(hint ?? '') && !/test \d+ of/i.test(`${label} ${hint}`) && !errors.length, { label, hint, errors });
    await context.close(); }
  { const { context, page, errors } = await open(width, height, 'page=practice&fx=s7scan&view=why');
    const text = `${await whyText(page)} ${await q(page, '#exercise-warning')}`;
    check('REG-4b incomplete proof: why?/actions carry no ordinal', width, !/test \d+/i.test(text) && /at least 7 of 10/i.test(text) && !errors.length, { text: text.slice(0, 300), errors });
    await context.close(); }

  // REG-5 Enter before/during/after the pending save (finding 5).
  for (const [delay, outcome, id] of [[0, 'saved', 'REG-5a Enter at 0 ms, save then succeeds'], [200, 'saved', 'REG-5b Enter at 200 ms (during save), succeeds'], [800, 'saved', 'REG-5c Enter at 800 ms (after save)'], [0, 'savefail', 'REG-5d Enter at 0 ms, save then fails']]) {
    const { context, page, errors } = await open(width, height, `page=assessment&fx=s4&fast=1&save=400&outcome=${outcome}`);
    await finishRun(page);
    await page.waitForTimeout(delay); await page.keyboard.press('Enter'); await page.waitForTimeout(80);
    const early = { label: await q(page, '#block-identity'), focus: await active(page) };
    await page.waitForTimeout(900);
    const late = { label: await q(page, '#block-identity'), focus: await active(page), slot: await q(page, '#exercise-warning'), why: (await whyText(page)).slice(0, 160), stage: await page.evaluate(() => document.querySelector('#stage').dataset.state) };
    const ok = early.label === 'Baseline test 6 of 10 · 30 s' && late.label === early.label && late.focus === 'typing-input' && late.stage === 'idle' && !errors.length
      && (outcome === 'saved' ? /5 of 10/.test(late.why) : /isn.t saved|not saved/i.test(late.slot ?? '') && /retry saving/.test(late.slot ?? ''));
    check(id, width, ok, { early, late, errors });
    await context.close();
  }
  { // Delayed failure while the next test is running: the active run is untouched.
    const { context, page, errors } = await open(width, height, 'page=assessment&fx=s4&fast=1&save=1200&outcome=savefail');
    await finishRun(page); await page.keyboard.press('Enter'); await page.waitForTimeout(60);
    await page.keyboard.type('the', { delay: 30 });
    const during0 = { label: await q(page, '#block-identity'), value: await page.inputValue('#typing-input') };
    await page.waitForTimeout(1300);
    const during = { label: await q(page, '#block-identity'), focus: await active(page), stage: await page.evaluate(() => document.querySelector('#stage').dataset.state), slot: await q(page, '#exercise-warning'), value: await page.inputValue('#typing-input') };
    await page.waitForFunction(() => document.querySelector('#stage')?.dataset.state === 'completed', null, { timeout: 9000 }); await page.waitForTimeout(600);
    const result = { label: await q(page, '.result-label'), block: await q(page, '#completion', 'innerText') };
    check('REG-5e delayed failure during an active run: run, label, focus untouched; recovery offered after', width,
      during.stage === 'running' && during.label === during0.label && during.focus === 'typing-input' && !(during.slot ?? '').trim() && during.value.startsWith('the')
      && /Baseline test 6 of 10/.test(result.label ?? '') && /test 5 isn.t saved/i.test(result.block ?? '') && /retry saving/.test(result.block ?? '') && !errors.length, { during0, during, result: { ...result, block: result.block?.slice(0, 400) }, errors });
    await context.close(); }
  { // Retry from the ready slot after a failure recovers the count without leaving the typing surface.
    const { context, page, errors } = await open(width, height, 'page=assessment&fx=s4&fast=1&save=300&outcome=savefail');
    await finishRun(page); await page.keyboard.press('Enter'); await page.waitForTimeout(600);
    const retry = page.locator('#exercise-warning button', { hasText: 'retry saving' });
    const had = await retry.count();
    if (had) { await retry.click(); await page.waitForTimeout(700); }
    const after = { label: await q(page, '#block-identity'), focus: await active(page), slot: await q(page, '#exercise-warning'), why: (await whyText(page)).slice(0, 120) };
    check('REG-5f retry saving from the ready slot succeeds; count 5, label stays 6, focus back to text', width, had === 1 && after.label === 'Baseline test 6 of 10 · 30 s' && /5 of 10/.test(after.why) && after.focus === 'typing-input' && !errors.length, { had, after, errors });
    await context.close(); }
  { // Interrupted test -> try again: no late-save page error, same ordinal.
    const { context, page, errors } = await open(width, height, 'page=assessment&fx=s4&fast=1');
    await page.keyboard.type('the', { delay: 30 });
    await page.evaluate(() => document.querySelector('#typing-input').blur());
    await page.waitForFunction(() => document.querySelector('#stage')?.dataset.state === 'completed', null, { timeout: 9000 });
    await page.waitForTimeout(100); await page.keyboard.press('Enter'); await page.waitForTimeout(800);
    const after = { label: await q(page, '#block-identity'), focus: await active(page) };
    check('REG-5g interrupted -> try test 5 again: no page error, label 5', width, after.label === 'Baseline test 5 of 10 · 30 s' && after.focus === 'typing-input' && !errors.length, { after, errors });
    await context.close(); }

  // REG-6 failed save on the result: retry saving is the focused, visible primary (finding 6).
  for (const [query, id] of [['page=assessment&fx=s4&view=result&outcome=savefail', 'REG-6a test 5 save failed'], ['page=assessment&fx=s9&view=result&outcome=savefail&final=ready', 'REG-6b test 10 save failed']]) {
    const { context, page, errors } = await open(width, height, query);
    const o = await page.evaluate(() => { const a = document.activeElement; const r = a?.getBoundingClientRect(); const block = document.querySelector('#baseline-result'); const br = block?.getBoundingClientRect();
      return { focusId: a?.id, focusText: a?.textContent?.trim(), inView: r ? r.top >= 0 && r.bottom <= innerHeight : false, scrollY, blockText: block?.innerText, blockTop: br?.top, deadLinks: document.querySelectorAll('#completion a[href="#"]').length, secondary: document.querySelector('#secondary')?.textContent?.trim() }; });
    check(id, width, /^retry saving/.test(o.focusText ?? '') && o.inView && /Not saved yet, so it doesn.t count/.test(o.blockText ?? '') && o.deadLinks === 0 && Boolean(o.secondary) && !errors.length, { ...o, blockText: o.blockText?.slice(0, 200), errors });
    await context.close();
  }

  // REG-7 no hairline tally (finding 7).
  { const { context, page, errors } = await open(width, height, 'page=practice&fx=s4');
    const n = await page.locator('.tally').count();
    check('REG-7 tally removed; locked key still described', width, n === 0 && /4 of 10/.test(await q(page, '#suggested-status') ?? '') && !errors.length, { tally: n, errors });
    await context.close(); }

  // REG-8 Progress copy: no other-context counter, one count line, next action, "of typing" (finding 8).
  { const { context, page, errors } = await open(width, height, 'page=progress&fx=s4');
    const text = await allText(page);
    const counts = (text.match(/4 of 10/g) ?? []).length;
    const action = await page.locator('.baseline-section a.key', { hasText: 'take test 5' }).count();
    check('REG-8a Progress: no other-context sentence, count once, take test 5 action', width, !/another duration|keyboard setting isn.t part/i.test(text) && counts === 1 && action === 1 && !errors.length, { counts, action, text: text.slice(0, 400), errors });
    await context.close(); }
  { const { context, page, errors } = await open(width, height, 'page=practice&fx=s4&view=why');
    const text = await whyText(page);
    check('REG-8b why?: "about five minutes of typing"', width, /about five minutes of typing/.test(text) && !/in all/.test(text) && !errors.length, { text: text.slice(0, 260), errors });
    await context.close(); }
  { const { context, page, errors } = await open(width, height, 'page=progress&fx=s7scan');
    const action = await page.locator('.baseline-section a.key').first().textContent().catch(() => null);
    check('REG-8c Progress action has no ordinal when proof is incomplete', width, action && !/\d/.test(action) && !errors.length, { action, errors });
    await context.close(); }

  // REG-9 finite Suggested plan ends truthfully: no wrap, not a full-duration result (root msg_22b78999d17a).
  { const { context, page, errors } = await open(width, height, 'page=practice&fx=s10ready&kind=recommended&plan=finite&dur=30&fast=1');
    const plan = await page.evaluate(() => window.__plan ?? null);
    let typed = 0;
    for (const sentence of plan ?? []) { await page.keyboard.type(`${sentence} `, { delay: 4 }); typed++; }
    await page.waitForTimeout(400);
    const o = { plan: plan?.length ?? 0, stage: await page.evaluate(() => document.querySelector('#stage').dataset.state), label: await q(page, '.result-label'), prompt: await q(page, '#prompt', 'innerText'), block: (await q(page, '#completion', 'innerText'))?.slice(0, 300) };
    check('REG-9 finite plan (30 s pilot, delta r2.1): ends at last sentence, never wraps, never "30 s · complete"', width, o.plan > 0 && o.stage === 'completed' && /all \d+ sentences/i.test(o.label ?? '') && !/30 s · complete/.test(o.label ?? '') && !/Baseline/.test(o.block ?? '') && !errors.length, { ...o, typed, errors });
    await context.close(); }
}

await browser.close();
const summary = { base: BASE, ranAt: new Date().toISOString(), total: checks.length, passed: checks.filter(c => c.pass).length, failed: checks.filter(c => !c.pass).map(c => `${c.width} ${c.id}`) };
console.log(JSON.stringify(summary, null, 1));
if (OUT) fs.writeFileSync(OUT, JSON.stringify({ summary, checks }, null, 1));
