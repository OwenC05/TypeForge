// ET-1 / LR-1 browser evidence on the production preview -> ../unsaved.json + screenshots/*-2x-*.png
// Storage failure is injected only inside isolated dp-impl-* profiles by patching IDBObjectStore.add
// (restored for the retry cases). Real keys and pointer events; Playwright clock paused and advanced.
import fs from 'node:fs';
import { launch, BASE, VIEWPORTS, target, active, shot, saved, geometry, seededRandom, writeJson } from './lib.mjs';

const report = { generatedAt: new Date().toISOString(), base: BASE, viewports: {}, flows: {}, notes: [] };
const results = [];
const check = (name, ok, details) => { results.push({ name, ok: Boolean(ok), ...(details === undefined ? {} : { details }) }); if (!ok) console.log('FAIL', name, JSON.stringify(details ?? null).slice(0, 400)); };

async function open(label, viewport, url) {
  const run = await launch(label, viewport);
  await run.page.addInitScript(seededRandom(20261115));
  await run.page.clock.install();
  await run.page.clock.pauseAt(new Date(Date.now() + 1000));
  await run.page.goto(BASE + url);
  await run.page.locator('#prompt span').first().waitFor();
  return run;
}
const failSaves = (page, on) => page.evaluate(on => {
  window.__add ??= IDBObjectStore.prototype.add;
  IDBObjectStore.prototype.add = on ? function () { throw new DOMException('Injected quota failure', 'QuotaExceededError'); } : window.__add;
}, on);
const line = page => page.evaluate(() => { const l = document.querySelector('#carried'); return { hidden: l.hidden, text: l.querySelector('.carried-text')?.textContent ?? '', inert: l.inert, buttons: [...l.querySelectorAll('button')].map(b => `${b.dataset.act}${b.disabled ? ':disabled' : ''}`) }; });
const state = page => page.evaluate(() => document.querySelector('#stage').dataset.state);
async function ready(page) { await page.waitForFunction(() => document.querySelector('#stage').dataset.state === 'idle' && !document.querySelector('#typing-input').disabled); }
async function completeBlock(page) {
  if (await page.locator('#continue-typing').isVisible()) await page.locator('#continue-typing').click();
  const text = await target(page);
  await page.keyboard.type(text.slice(0, 10), { delay: 5 });
  await page.clock.fastForward(16000);
  await page.waitForFunction(() => /could not be saved|Saved in this browser/.test(document.querySelector('#save-state')?.textContent ?? ''));
}
const slotFacts = page => page.evaluate(() => { const s = document.querySelector('#slot'); return { overflow: s.scrollHeight > s.clientHeight + 1, scrollHeight: s.scrollHeight, clientHeight: s.clientHeight }; });

for (const vp of [1440, 390, 320]) {
  const viewport = VIEWPORTS[vp];
  const facts = report.viewports[vp] = {};
  // Reference geometry: a clean ready block with an empty slot.
  const clean = await open(`unsaved-ref-${vp}`, viewport, '/?duration=15');
  facts.cleanReady = await geometry(clean.page);
  await clean.context.close();

  const { context, page, errors } = await open(`unsaved-${vp}`, viewport, '/?duration=15');
  await failSaves(page, true);
  await completeBlock(page);
  check(`${vp}: first block save fails in place`, (await page.locator('#retry-save').isVisible()) && await active(page) === 'button#again');
  await page.keyboard.press('Enter'); // focused Again: continue immediately
  await ready(page);
  let l = await line(page);
  check(`${vp}: Again continues immediately and carries 1 result`, l.text === '1 result not saved' && !l.hidden && l.buttons.join() === 'retry,export,discard', l);
  const withLine = await geometry(page);
  check(`${vp}: the carried line moves nothing (stage, surface, active line equal to a clean ready block)`,
    JSON.stringify([withLine.stage, withLine.surface, withLine.slot, withLine.activeLineTop]) === JSON.stringify([facts.cleanReady.stage, facts.cleanReady.surface, facts.cleanReady.slot, facts.cleanReady.activeLineTop]),
    { clean: [facts.cleanReady.stage, facts.cleanReady.slot, facts.cleanReady.activeLineTop], withLine: [withLine.stage, withLine.slot, withLine.activeLineTop] });
  check(`${vp}: focus stays in the passage after Again`, await active(page) === 'textarea#typing-input');
  facts.slotReady = await slotFacts(page);
  check(`${vp}: the ready line with its actions fits the reserved slot (no scroll)`, !facts.slotReady.overflow, facts.slotReady);
  await shot(page, `${vp}-20-unsaved-1-ready.png`);
  await completeBlock(page);
  await page.keyboard.press('Enter');
  await ready(page);
  l = await line(page);
  check(`${vp}: a second unsaved block is added, not overwritten`, l.text === '2 results not saved', l);
  await shot(page, `${vp}-21-unsaved-2-ready.png`);

  // Running: static line; a slot warning below it; no displacement.
  const text = await target(page);
  await page.keyboard.type(text.slice(0, 3), { delay: 5 });
  const runningBefore = await geometry(page);
  l = await line(page);
  check(`${vp}: during a run the line is inert and focus stays in the passage`, l.inert && await active(page) === 'textarea#typing-input', l);
  await page.keyboard.press('Enter'); // transient hint joins the slot under the carried line
  const runningAfter = await geometry(page);
  const slot = await slotFacts(page);
  check(`${vp}: carried line + slot hint: stage and active line do not move`,
    JSON.stringify([runningBefore.stage, runningBefore.surface, runningBefore.activeLineTop]) === JSON.stringify([runningAfter.stage, runningAfter.surface, runningAfter.activeLineTop]), { before: runningBefore.activeLineTop, after: runningAfter.activeLineTop, slot });
  facts.slotWithLineAndHint = { ...slot, hint: runningAfter.slotText };
  check(`${vp}: carried line + slot hint fit the reserved slot (no scroll)`, !slot.overflow, slot);
  await shot(page, `${vp}-22-unsaved-2-running-with-hint.png`);

  // LR-1: a held departure during a run is operable; returning to the passage cancels it.
  await page.locator('a.brand').click();
  await page.waitForFunction(() => document.querySelector('#carried [data-act="leave"]'));
  l = await line(page);
  check(`${vp}: in-app link during a run is held, not navigated`, new URL(page.url()).pathname === '/' && l.text === '2 results not saved. Leaving this page loses them.' && !l.inert && l.buttons.join() === 'export,leave', l);
  check(`${vp}: Export takes focus when held`, await page.evaluate(() => document.activeElement?.dataset?.act === 'export'));
  facts.slotWhileHeld = await slotFacts(page);
  const held = await geometry(page);
  check(`${vp}: the held line shows whole (the slot may grow downward only while held; no scroll)`, !facts.slotWhileHeld.overflow, facts.slotWhileHeld);
  check(`${vp}: holding moves nothing above the slot (stage top, surface, active line)`,
    JSON.stringify([held.stage.y, held.surface, held.activeLineTop, held.slot.y]) === JSON.stringify([runningAfter.stage.y, runningAfter.surface, runningAfter.activeLineTop, runningAfter.slot.y]),
    { before: [runningAfter.stage.y, runningAfter.activeLineTop, runningAfter.slot], held: [held.stage.y, held.activeLineTop, held.slot] });
  await shot(page, `${vp}-23-departure-held-running.png`);
  await page.locator('#continue-typing').click();
  l = await line(page);
  check(`${vp}: returning to the passage cancels the hold; line is static again`, l.inert && l.buttons.join() === 'retry,export,discard' && await active(page) === 'textarea#typing-input', l);
  await page.locator('a.brand').click();
  await page.waitForFunction(() => document.activeElement?.dataset?.act === 'export');
  const [download] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Enter')]);
  const exported = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
  check(`${vp}: Export downloads every unsaved result in one file`, Array.isArray(exported) && exported.length === 2 && new Set(exported.map(r => r.id)).size === 2, { file: download.suggestedFilename(), count: exported.length });
  l = await line(page);
  check(`${vp}: after export the hold stays and says the copies are kept`, /exported copies are yours to keep/.test(l.text), l);
  await Promise.all([page.waitForURL(url => true), page.locator('#carried [data-act="leave"]').click()]);
  await page.locator('#prompt span').first().waitFor();
  check(`${vp}: 'leave without saving' navigates; the in-memory list does not survive (documented)`, (await line(page)).hidden);
  facts.pageErrors = errors;
  await context.close();
}

// ---------- Retry (single-flight, oldest first), discard, empty-list navigation (1440) ----------
{
  const viewport = VIEWPORTS[1440];
  const { context, page, errors } = await open('unsaved-retry', viewport, '/?duration=15');
  await failSaves(page, true);
  for (let i = 0; i < 2; i++) { await completeBlock(page); await page.keyboard.press('Enter'); await ready(page); }
  const listed = (await line(page)).text;
  await failSaves(page, false);
  await page.locator('#carried [data-act="retry"]').dblclick();
  await page.waitForFunction(() => document.querySelector('#carried').hidden);
  const rows = await saved(page);
  check('retry saves both carried results exactly once, then the line clears', listed === '2 results not saved' && rows.length === 2 && new Set(rows.map(r => r.id)).size === 2, { listed, rows: rows.length });
  check('focus returns to the passage when the line clears', await active(page) === 'textarea#typing-input');
  await failSaves(page, true);
  await completeBlock(page); await page.keyboard.press('Enter'); await ready(page);
  await page.locator('#carried [data-act="discard"]').click();
  check('discard is explicit and removes the listed result', (await line(page)).hidden && (await saved(page)).length === 2);
  await page.locator('a.brand').click();
  await page.waitForLoadState();
  check('empty list: in-app navigation is immediate', true);
  report.flows.retry = { errors };
  await context.close();
}

// ---------- Assessment continuation: Practice next and fresh retest; settlement while held ----------
for (const link of ['#practice-next', '#retest-next']) {
  const viewport = VIEWPORTS[1440];
  const { context, page, errors } = await open(`unsaved-assess-${link.slice(1)}`, viewport, '/practice.html?duration=15');
  await failSaves(page, true);
  await completeBlock(page);
  await page.locator(link).click();
  await page.waitForFunction(() => document.querySelector('#carried [data-act="leave"]'));
  const held = await line(page);
  check(`assessment ${link}: held with the result-state slot line`, new URL(page.url()).pathname === '/practice.html' && held.text === '1 result not saved. Leaving this page loses it.' && await page.evaluate(() => document.activeElement?.dataset?.act === 'export'), held);
  await page.locator(link).click(); // an ordinary second click on the unchanged link is not a discard
  check(`assessment ${link}: a second click on the same link still holds`, new URL(page.url()).pathname === '/practice.html');
  if (link === '#practice-next') {
    await shot(page, '1440-24-departure-held-assessment.png');
    for (const vp of [390, 320]) { await page.setViewportSize(VIEWPORTS[vp]); await shot(page, `${vp}-24-departure-held-assessment.png`); }
    await page.setViewportSize(viewport);
    // The result's own save succeeds while held: nothing remains at risk, the hold clears, and the
    // next activation navigates immediately.
    await failSaves(page, false);
    await page.locator('#retry-save').click();
    await page.waitForFunction(() => document.querySelector('#carried').hidden);
    check('assessment: a save settling while held clears the hold', true);
    await Promise.all([page.waitForURL(url => url.pathname === '/practice.html' && url.searchParams.get('mode') === 'practice'), page.locator(link).click()]);
    check('assessment: Practice next then navigates immediately', true);
  } else {
    await Promise.all([page.waitForURL(url => url.searchParams.has('retest') || url.search !== ''), page.locator('#carried [data-act="leave"]').click()]);
    check('assessment fresh retest: leave without saving navigates', true);
  }
  report.flows[link] = { errors };
  await context.close();
}

report.results = results;
report.summary = { checks: results.length, failed: results.filter(r => !r.ok).length };
report.notes.push('The unsaved list is document-scoped and in memory only; tab close, reload and BFCache reload lose it (documented limitation, no beforeunload prompt).');
writeJson('unsaved.json', report);
console.log(JSON.stringify(report.summary));
