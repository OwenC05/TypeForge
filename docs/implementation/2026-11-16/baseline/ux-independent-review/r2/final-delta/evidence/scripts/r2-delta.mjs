// Independent r2 delta checks (actual-Claude reviewer), against the frozen author prototype 3ad71b6
// composed with root style 1b10cbea… and built by ../../runner/vite.r2.config.mjs on 127.0.0.1:5318.
// Expectations are the reviewer's own (from 05a6767 acceptance criteria and the r2 brief), not the
// author's regression oracle. A failing check is evidence, not a script error. Output: ../delta.json
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const base = 'http://127.0.0.1:5318/index.html?';
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const out = [];
const check = (slice, id, expect, observed, pass, extra = {}) => out.push({ slice, id, expect, pass: !!pass, observed, ...extra });
const enc = st => 's=' + Buffer.from(JSON.stringify(st)).toString('base64');
const status = (o = {}) => ({ policyId: 'review', target: 10, counted: 10, exact: true, evidenceScanComplete: true, pending: 0, automaticCoaching: 'enabled', summary: null, state: 'complete-insufficient', ...o });
const summary = { state: 'available', selectionProofComplete: true, medianWpm: 39, medianAccuracy: 95.8, validAccuracySources: 10, from: '2026-11-09', to: '2026-11-18' };

async function open(query, [w, h] = [1440, 900], forced = false) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, forcedColors: forced ? 'active' : 'none', reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(base + query);
  await page.waitForSelector('body[data-ready="1"]');
  await page.waitForTimeout(150);
  return { ctx, page, errors };
}
const text = (page, sel) => page.evaluate(s => document.querySelector(s)?.innerText ?? null, sel);
const st = page => page.evaluate(() => {
  const q = s => document.querySelector(s); const a = document.activeElement;
  const pv = q('ui-progress.baseline-progress');
  return {
    focus: a?.id || a?.textContent?.trim().slice(0, 40) || a?.tagName.toLowerCase(),
    label: q('#block-identity')?.textContent ?? null, slot: q('#exercise-warning')?.textContent ?? null,
    stage: q('#stage')?.dataset.state ?? null, primary: q('#primary')?.textContent ?? null, secondary: q('#secondary')?.textContent ?? null,
    progress: pv ? (pv.getAttribute('aria-valuetext') ?? pv.querySelector('[role=progressbar]')?.getAttribute('aria-valuetext')) : null,
    qwerty: q('#qwerty')?.hasAttribute('data-checked') ?? null,
  };
});
const finishRun = async (page, typed = 'the') => {
  await page.keyboard.type(typed, { delay: 25 });
  await page.waitForSelector('#completion:not([hidden])', { timeout: 15000 });
};
const bad = s => /undefined|NaN|\bnull\b/.test(s ?? '');

// ---------------- Slice 1/2: reason handling matrix ----------------
const allReasons = ['policy-invalid', 'storage-unavailable', 'context-unavailable', 'source-integrity', 'scan-incomplete', 'baseline-incomplete',
  'coaching-deferred', 'stale-evidence', 'too-few-observations-for-any-pair', 'insufficient-context-diversity', 'unstable-evidence',
  'no-effect', 'corpus-coverage', 'exposure-unsupported', 'bogus-future-reason', null];
const gate = ['stale-evidence', 'too-few-observations-for-any-pair', 'insufficient-context-diversity', 'unstable-evidence', 'no-effect', 'corpus-coverage', 'exposure-unsupported'];
const unavailable = ['policy-invalid', 'storage-unavailable', 'context-unavailable', 'source-integrity'];
const gateSentences = ['come up often enough', 'too few different words', 'not consistently', 'stands out clearly', 'too few practice sentences', 'real practice in one block', 'more than 30 days old'];
const configs = [
  { name: 'enabled+scanned', automaticCoaching: 'enabled', evidenceScanComplete: true },
  { name: 'enabled+scan-false', automaticCoaching: 'enabled', evidenceScanComplete: false },
  { name: 'disabled+scan-null', automaticCoaching: 'disabled', evidenceScanComplete: null },
];
for (const cfg of configs) for (const reason of allReasons) {
  const stt = unavailable.includes(reason) ? 'unavailable' : reason === 'scan-incomplete' ? 'pending' : reason === 'baseline-incomplete' ? 'in-progress' : 'complete-insufficient';
  const s = status({ automaticCoaching: cfg.automaticCoaching, evidenceScanComplete: cfg.evidenceScanComplete, state: stt, reason, counted: stt === 'in-progress' ? 4 : stt === 'unavailable' ? 0 : 10, summary: stt === 'complete-insufficient' ? summary : null });
  const { ctx, page, errors } = await open(`page=practice&${enc(s)}&view=press`);
  await page.waitForTimeout(120);
  const press = await text(page, '#exercise-warning');
  const sr = await text(page, '#suggested-status');
  await page.click('#why button');
  await page.waitForTimeout(120);
  const why = await text(page, '#why-panel');
  await ctx.close();
  const p2 = await open(`page=progress&${enc(s)}`);
  const prog = await text(p2.page, '.baseline-section');
  await p2.ctx.close();
  const all = [press, sr, why, prog].join(' | ');
  const gateRan = cfg.automaticCoaching === 'enabled' && cfg.evidenceScanComplete === true;
  const problems = [];
  if (bad(all)) problems.push('undefined/NaN/null text');
  if (errors.length || p2.errors.length) problems.push('page error');
  if (!gateRan && gateSentences.some(g => all.includes(g))) problems.push('gate sentence without a gate that ran');
  if (!gateRan && /re-checks after each saved/.test(all)) problems.push('re-check promise without a gate');
  if (cfg.automaticCoaching === 'disabled' && /Suggested can look for a focus|Suggested needs 10/.test(all)) problems.push('unlock advertised while coaching disabled');
  if (stt === 'unavailable' && /\d+ of 10/.test(all)) problems.push('number shown while unavailable');
  // P1 always gives complete-insufficient/in-progress/pending a reason; null there is off-contract, so the defensive
  // "unavailable" fallback is acceptable and only noted. complete-ready (no reason in P1) is checked separately below.
  const note = reason === null ? 'off-contract null reason: defensive fallback observed' : undefined;
  check('S1 reasons', `R ${cfg.name} ${stt}/${reason}`, 'honest, exhaustive copy for the presented reason', { press, sr, why: why?.split('\n\nEnglish')[0], progress: prog?.slice(0, 300), problems, note }, problems.length === 0);
}

// complete-ready: P1 gives complete-ready a focus and no reason (spec "Output and reason precedence").
// P1 r2 (root 0c25a8b interfaces-r2.ts) gives coach complete-ready the reason 'supported'.
for (const reason of [null, undefined, 'supported']) for (const kind of ['general', 'recommended']) {
  const s = status({ state: 'complete-ready', focus: { pair: 'th', pairGeometricMs: 212, referenceGeometricMs: 168, observations: 46, sourceRuns: 10, wordContexts: 7 }, summary });
  if (reason !== undefined) s.reason = reason;
  const { ctx, page, errors } = await open(`page=practice&${enc(s)}&kind=${kind}&view=why`);
  const why = (await text(page, '#why-panel'))?.split('\n\nEnglish')[0];
  const label = (await st(page)).label;
  check('S1 reasons', `R complete-ready reason=${reason} kind=${kind}`, 'why? explains the th focus; never "unavailable" while Suggested is available', { label, why, errors }, /\bth\b/.test(why ?? '') && !/unavailable/i.test(why ?? ''));
  await ctx.close();
}
// P1 r2 automaticCoaching gains 'unavailable' (config could not be validated).
for (const counted of [4, 10]) {
  const s = status({ automaticCoaching: 'unavailable', evidenceScanComplete: null, counted, state: counted < 10 ? 'in-progress' : 'complete-insufficient', reason: counted < 10 ? 'baseline-incomplete' : 'policy-invalid', summary: counted < 10 ? null : summary });
  const { ctx, page, errors } = await open(`page=practice&${enc(s)}&view=press`);
  const press = await text(page, '#exercise-warning');
  await page.click('#why button'); await page.waitForTimeout(120);
  const why = (await text(page, '#why-panel'))?.split('\n\nEnglish')[0];
  check('S1 reasons', `R automaticCoaching=unavailable at ${counted}`, 'informational: how the r2 third value renders (UI type has only enabled|disabled)', { press, why, errors }, null, { pending: true });
  await ctx.close();
}
for (const fx of ['s10ready', 's10changed']) {
  const { ctx, page } = await open(`page=practice&fx=${fx}&kind=recommended&view=why`);
  const why = (await text(page, '#why-panel'))?.split('\n\nEnglish')[0];
  check('S1 reasons', `R author fixture ${fx} Suggested why?`, 'why? explains the focus pair', { label: (await st(page)).label, why }, !/unavailable/i.test(why ?? ''));
  await ctx.close();
}

// ---------------- Slice 2: save timing and recovery ----------------
for (const [name, wait] of [['Enter at 0 ms', 0], ['Enter during save (600 of 1500 ms)', 600], ['Enter after save (1800 ms)', 1800]]) {
  const { ctx, page, errors } = await open('page=assessment&fx=s4&fast=1&save=1500');
  await finishRun(page);
  const atResult = await st(page);
  if (wait) await page.waitForTimeout(wait);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  const ready = await st(page);
  await page.waitForTimeout(1900);
  await page.click('#why button'); await page.waitForTimeout(100);
  const settled = await st(page);
  const ok = ready.label === 'Baseline test 6 of 10 · 30 s' && /^5 of 10/.test(settled.progress ?? '') && !errors.length;
  check('S2 save timing', `T ${name}`, 'next ready label is test 6; count reaches 5 after the save; focus stays in text; 0 errors', { atResult, ready, settled, errors }, ok && ready.focus === 'typing-input');
  await ctx.close();
}
{ // failure, continue, recover from slot
  const { ctx, page, errors } = await open('page=assessment&fx=s4&fast=1&outcome=savefail&save=200&retry=ok');
  await finishRun(page); await page.waitForTimeout(400);
  const failed = await st(page);
  const failedText = await text(page, '#baseline-result');
  await page.click('#secondary'); await page.waitForTimeout(150);
  const ready = await st(page);
  await page.click('#exercise-warning button'); await page.waitForTimeout(500);
  const after = await st(page);
  await page.click('#why button'); await page.waitForTimeout(100);
  const why = await st(page);
  check('S2 save timing', 'T failed save → next test → retry from slot', 'retry focused on failure; ready slot offers recovery, label 6; retry restores focus to text; count 5', { failed, failedText, ready, after, whyProgress: why.progress, errors },
    failed.focus === 'primary' && /retry saving/.test(failed.primary) && /Test 5 isn’t saved/.test(ready.slot) && ready.label === 'Baseline test 6 of 10 · 30 s' && after.focus === 'typing-input' && /^5 of 10/.test(why.progress ?? '') && !errors.length);
  await ctx.close();
}
{ // late failure during an active run
  const { ctx, page, errors } = await open('page=assessment&fx=s4&fast=1&outcome=savefail&save=1500');
  await finishRun(page);
  await page.keyboard.press('Enter'); await page.waitForTimeout(80);
  await page.keyboard.type('the', { delay: 25 });
  const running = await st(page);
  await page.waitForTimeout(1600); // failure of test 5 lands while test 6 runs
  const during = await st(page);
  await page.waitForSelector('#completion:not([hidden])', { timeout: 15000 }); await page.waitForTimeout(1700);
  const result6 = await st(page);
  const block6 = await text(page, '#baseline-result');
  check('S2 save timing', 'T late failure during an active run', 'label, slot and focus frozen during run; after the run test 5 is offered for retry', { running, during, result6, block6, errors },
    running.label === during.label && during.focus === 'typing-input' && during.slot === running.slot && /Test 5 isn’t saved/.test(block6 ?? '') && !errors.length);
  await ctx.close();
}
{ // late success arriving while the next run is active
  const { ctx, page, errors } = await open('page=assessment&fx=s4&fast=1&save=1500');
  await finishRun(page);
  await page.keyboard.press('Enter'); await page.waitForTimeout(80);
  await page.keyboard.type('the', { delay: 25 });
  const running = await st(page);
  await page.waitForTimeout(1600);
  const during = await st(page);
  await page.waitForSelector('#completion:not([hidden])', { timeout: 15000 }); await page.waitForTimeout(1700);
  const result6 = await st(page);
  check('S2 save timing', 'T late success during an active run', 'run frozen; result of test 6 eventually shows 6 of 10', { running, during, result6, errors },
    running.label === during.label && during.focus === 'typing-input' && /^6 of 10/.test(result6.progress ?? '') && !errors.length);
  await ctx.close();
}
{ // interrupted then try again
  const { ctx, page, errors } = await open('page=assessment&fx=s4&fast=1');
  await page.keyboard.type('th', { delay: 25 });
  await page.evaluate(() => document.querySelector('#typing-input').blur());
  await page.waitForSelector('#completion:not([hidden])', { timeout: 15000 }); await page.waitForTimeout(300);
  const res = await st(page);
  const block = await text(page, '#baseline-result');
  await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  const again = await st(page);
  check('S2 save timing', 'T interrupted → try again', 'not counted, nothing taken away; try test 5 again; 0 errors', { res, block, again, errors },
    /try test 5 again/.test(res.primary ?? '') && again.label === 'Baseline test 5 of 10 · 30 s' && again.focus === 'typing-input' && !errors.length);
  await ctx.close();
}
{ // final test fails, then retry succeeds
  const { ctx, page, errors } = await open('page=assessment&fx=s9&view=result&outcome=savefail&final=ready&retry=ok', [320, 640]);
  await page.waitForTimeout(300);
  const failed = await st(page);
  const links = await page.evaluate(() => [...document.querySelectorAll('#completion a')].map(a => a.getAttribute('href')));
  await page.keyboard.press('Enter'); await page.waitForTimeout(600);
  const after = await st(page);
  const block = await text(page, '#baseline-result');
  check('S2 save timing', 'T final test failed → Enter retries → completes', 'retry focused, no dead "#" link; Enter retries; completion shows summary and try suggested focused', { failed, links, after, block, errors },
    failed.focus === 'primary' && /retry saving/.test(failed.primary) && !links.includes('#') && /try suggested/.test(after.primary ?? '') && after.focus === 'primary' && /Last 10 tests · median/i.test(block ?? '') && !errors.length);
  await ctx.close();
}

// ---------------- Slice 1/2: summary semantics ----------------
const sumCases = [
  ['figures', status({ summary }), /Last 10 tests · median[\s\S]*39\.0[\s\S]*95\.8%/i, true],
  ['WPM only', status({ summary: { ...summary, medianAccuracy: null, validAccuracySources: 9 } }), /only speed is shown/, true],
  ['eleventh pending', status({ pending: 1, summary }), /Updating after your latest test is saved/, true],
  ['milestone proved, selection unproved', status({ summary: { ...summary, selectionProofComplete: false } }), /still being read/, true],
  ['summary pending', status({ summary: { ...summary, state: 'pending', medianWpm: null, medianAccuracy: null } }), /still being read/, true],
  ['below ten with stale summary object', status({ counted: 9, state: 'in-progress', reason: 'baseline-incomplete', summary }), /median|39\.0/i, false],
  ['unavailable with summary object', status({ state: 'unavailable', reason: 'source-integrity', summary }), /median|39\.0/i, false],
  ['not-complete', status({ summary: { ...summary, state: 'not-complete' } }), /median|39\.0/i, false],
  ['checking', status({ state: 'checking', counted: 0, exact: false, summary }), /median|39\.0/i, false],
];
for (const [name, s, re, shouldMatch] of sumCases) {
  const { ctx, page, errors } = await open(`page=progress&${enc(s)}`);
  const t = await text(page, '.baseline-section');
  const m = re.test(t ?? '');
  const extra = name.includes('unproved') || name === 'summary pending' ? !/39\.0|95\.8/.test(t ?? '') : true;
  check('S2 summary', `M Progress: ${name}`, shouldMatch ? `shows ${re}` : 'no median and no cached figure', { text: t, errors }, (m === shouldMatch) && extra && !bad(t));
  await ctx.close();
}
{ // reset removes the median
  const { ctx, page, errors } = await open('page=progress&fx=s10insuff');
  const before = await text(page, '.baseline-section');
  await page.click('#reset'); await page.click('#start-over'); await page.waitForTimeout(150);
  const after = await text(page, '.baseline-section');
  const focus = await page.evaluate(() => document.activeElement?.id);
  check('S2 summary', 'M reset after ten removes the median', 'no figure after start over; heading focused; status announced', { before: before.slice(0, 200), after, focus, errors }, /39\.0/.test(before) && !/median|39\.0/i.test(after) && focus === 'baseline-heading');
  await ctx.close();
}
{ // final result hierarchy: summary directly under Baseline complete
  for (const fin of ['ready', 'insufficient', 'sparse', 'deferred']) {
    const { ctx, page, errors } = await open(`page=assessment&fx=s9&view=result&outcome=saved&final=${fin}`);
    await page.waitForTimeout(250);
    const t = await text(page, '#baseline-result');
    const lc = (t ?? '').toLowerCase();
    const order = lc.indexOf('baseline complete.') >= 0 && lc.indexOf('baseline complete.') < lc.indexOf('last 10 tests · median');
    const sizes = await page.evaluate(() => ({ hero: parseFloat(getComputedStyle(document.querySelector('.result-figures dd')).fontSize), summary: parseFloat(getComputedStyle(document.querySelector('.summary-figures dd')).fontSize) }));
    const deferredOk = fin !== 'deferred' || (!/re-checks|stands out|Suggested has/.test(t) && /isn’t switched on/.test(t));
    check('S1 completion', `C final=${fin}`, 'Baseline complete → Last 10 tests · median → focus or one reason; summary smaller than hero; deferred makes no gate claim', { text: t, sizes, primary: (await st(page)).primary, errors }, order && sizes.summary < sizes.hero && deferredOk && !bad(t));
    await ctx.close();
  }
}

// ---------------- Slice 1: QWERTY declaration, lower bound, Progress ----------------
for (const vp of [[1440, 900], [320, 640]]) {
  const { ctx, page, errors } = await open('page=assessment&fx=s0&qwerty=0', vp);
  const before = await st(page);
  const keyRect = await page.evaluate(() => { const r = document.querySelector('#exercise-warning button')?.getBoundingClientRect(); return r ? { top: Math.round(r.top), bottom: Math.round(r.bottom), inView: r.bottom <= innerHeight && r.top >= 0 } : null; });
  await page.keyboard.press('Tab');
  const tabbed = await st(page);
  await page.keyboard.press('Enter'); await page.waitForTimeout(150);
  const after = await st(page);
  check('S1 qwerty', `Q declare from hint ${vp[0]}`, 'first visit unchanged (focused text); one Tab reaches the declaration; Enter switches qwerty on, label test 1, focus back in text', { before, keyRect, tabbed, after, errors },
    before.focus === 'typing-input' && before.label === 'Assessment · 30 s' && keyRect?.inView && /my keyboard is qwerty/.test(tabbed.focus) && after.qwerty && after.label === 'Baseline test 1 of 10 · 30 s' && after.focus === 'typing-input');
  await ctx.close();
}
{
  const { ctx, page, errors } = await open('page=assessment&fx=s0&qwerty=0&fast=1');
  await finishRun(page); await page.waitForTimeout(300);
  const res = await st(page); const block = await text(page, '#baseline-result');
  await page.click('#declare'); await page.waitForTimeout(150);
  const after = await st(page); const block2 = await text(page, '#baseline-result');
  await page.keyboard.press('Enter'); await page.waitForTimeout(150);
  const next = await st(page);
  check('S1 qwerty', 'Q not-counted result → declare → take test 1', 'not counted explained; declaration on the result; then take test 1 focused; next label test 1', { res, block, after, block2, next, errors },
    /qwerty off/.test(block) && /take test 1/.test(after.primary ?? '') && after.focus === 'primary' && next.label === 'Baseline test 1 of 10 · 30 s');
  await ctx.close();
}
{
  const { ctx, page, errors } = await open('page=assessment&fx=s7scan&fast=1');
  const ready = await st(page);
  await finishRun(page); await page.waitForTimeout(700);
  const res = await page.evaluate(() => document.querySelector('.result-label')?.textContent);
  const after = await st(page);
  await page.keyboard.press('Enter'); await page.waitForTimeout(150);
  const next = await st(page);
  const p = await open(`page=progress&fx=s7scan`); const prog = await text(p.page, '.baseline-section'); await p.ctx.close();
  const noOrd = s => !/test \d+ of|test \d+ (again|→)|take test \d/.test(s ?? '');
  check('S1 lower bound', 'L at least 7: ready → result → next → Progress', 'never an ordinal from a lower bound', { ready, res, after, next, prog, errors },
    noOrd(ready.label + ready.slot) && noOrd(res) && noOrd(after.primary) && noOrd(next.label) && noOrd(prog) && /at least/.test(prog));
  await ctx.close();
}
{
  const { ctx, page } = await open('page=progress&fx=s4');
  const prog = await text(page, '.baseline-section');
  const counts = (prog.match(/\d+ of 10/g) ?? []).length;
  const w = await open('page=practice&fx=s4&view=why');
  const why = await text(w.page, '#why-panel'); const tally = await w.page.evaluate(() => document.querySelectorAll('.tally').length);
  await w.ctx.close();
  check('S1 progress', 'P Progress at 4 of 10', 'one count, provenance, take test 5, no other-context sentence; why? says five minutes of typing; no tally', { prog, counts, why: why.split('\n\nEnglish')[0], tally },
    counts === 1 && /take test 5/.test(prog) && !/other (keyboard|context)|another context/i.test(prog) && /five minutes of typing/.test(why) && tally === 0);
  await ctx.close();
}

// ---------------- Slice 4: finite visible end (fixture stand-in) ----------------
const plan = ['the thin moth', 'then the other three', 'they think that this is the path'];
{
  const { ctx, page, errors } = await open('page=practice&fx=s10ready&kind=recommended&plan=finite&dur=30&fast=1');
  const ready = await st(page);
  await page.keyboard.type(plan[0] + ' ', { delay: 15 });
  await page.keyboard.type(plan[1] + ' ', { delay: 15 });
  const lastContext = await text(page, '#next-prompt');
  await page.keyboard.type(plan[2] + ' ', { delay: 15 });
  await page.waitForTimeout(50);
  const res = await page.evaluate(() => ({ stage: document.querySelector('#stage').dataset.state, remaining: document.querySelector('#remaining').textContent, label: document.querySelector('.result-label')?.textContent, figures: !!document.querySelector('#completion .result-figures'), obs: document.querySelector('.result-observation')?.textContent, all: document.querySelector('#completion').innerText, focus: document.activeElement?.id }));
  const acts = await st(page);
  check('S4 finite end', 'E plan exhausted before the timer', 'no wrap; ends at the last sentence; actual elapsed label; no figures; no baseline copy; suggested again focused, general secondary', { ready, lastContext, res, acts, errors },
    lastContext === '— end of this block —' && res.stage === 'completed' && Number(res.remaining) > 0 && /all 3 sentences done at \d+ s of 30/.test(res.label) && !/30 s · complete/.test(res.label) && !res.figures && !/baseline|Baseline/.test(res.all) && /suggested again/.test(acts.primary) && acts.focus === 'primary' && acts.secondary === 'general');
  await page.keyboard.press('Enter'); await page.waitForSelector('body[data-ready="1"]'); await page.waitForTimeout(150);
  const again = await st(page);
  check('S4 finite end', 'E Enter on suggested again', 'lands on Suggested · th ready with focus in text', { again }, /Suggested practice · th/.test(again.label) && again.focus === 'typing-input');
  await ctx.close();
}
{
  const { ctx, page, errors } = await open('page=practice&fx=s10ready&kind=recommended&plan=finite&dur=30&fast=1');
  await page.keyboard.type('the th', { delay: 25 });
  await page.waitForSelector('#completion:not([hidden])', { timeout: 15000 });
  const label = await page.evaluate(() => document.querySelector('.result-label')?.textContent);
  const figures = await page.evaluate(() => !!document.querySelector('#completion .result-figures'));
  check('S4 finite end', 'E timer first', 'ordinary practice result, no new state', { label, figures, errors }, /Suggested practice · th · 30 s · complete/.test(label) && figures);
  await ctx.close();
}
{
  const { ctx, page, errors } = await open('page=practice&fx=s10ready&kind=recommended&plan=finite&dur=30&fast=1');
  await page.keyboard.type(plan[0] + ' ', { delay: 15 });
  await page.evaluate(() => document.querySelector('#typing-input').blur());
  await page.waitForTimeout(80);
  await page.focus('#typing-input');
  await page.keyboard.type(plan[1] + ' ' + plan[2] + ' ', { delay: 10 });
  await page.waitForTimeout(80);
  const res = await page.evaluate(() => ({ label: document.querySelector('.result-label')?.textContent, flag: document.querySelector('.result-flag')?.textContent ?? null }));
  check('S4 finite end', 'E focus lost, then plan finished (rule 10)', 'interruption keeps flagged semantics on the result', { res, errors }, !!res.flag);
  await ctx.close();
}
{
  const { ctx, page } = await open('page=practice&fx=s10ready&kind=recommended&plan=finite&dur=60');
  const r = await st(page);
  check('S4 finite end', 'E Suggested at 60 s (root delta: pilot is exact 30 s)', 'PENDING author delta 64a53b4: truthful unsupported-duration handling', { label: r.label, slot: r.slot }, null, { pending: true });
  await ctx.close();
}

await browser.close();
writeFileSync(resolve(import.meta.dirname, '../delta.json'), JSON.stringify(out, null, 1));
const fails = out.filter(r => r.pass === false && !r.pending);
console.log(`${out.length} checks; ${out.filter(r => r.pass).length} pass; ${fails.length} fail; ${out.filter(r => r.pending).length} pending`);
for (const f of fails) console.log('FAIL', f.slice, '|', f.id);
