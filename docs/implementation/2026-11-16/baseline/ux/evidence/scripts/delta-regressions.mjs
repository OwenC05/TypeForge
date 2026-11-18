// Contract delta r2.1 (root 64a53b4): (1) the prior-pair explanation comes only from a previous
// in-memory admitted snapshot; after a reload or with no prior snapshot, the current fallback is
// shown truthfully; (2) the pilot is 30 s only, and duration/keyboard mismatch is explained honestly
// without clamping or blocking. Written before the fix and run first against frozen r2 (3ad71b6).
// SIMULATION: reload=1 drops the prototype's in-memory prior snapshot. It is not a storage proof.
// Usage: BASE=http://127.0.0.1:5312 OUT=<file.json> PLAYWRIGHT_MODULE=<path> node delta-regressions.mjs
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE)).href);
const BASE = process.env.BASE ?? 'http://127.0.0.1:5312';
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const checks = [];
const check = (id, width, pass, observed) => { checks.push({ id, width, pass: Boolean(pass), observed }); console.log(pass ? 'PASS' : 'FAIL', width, id, JSON.stringify(observed).slice(0, 300)); };

async function open(width, height, query) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`${BASE}/index.html?${query}`);
  await page.waitForSelector('body[data-ready="1"]', { timeout: 6000 }).catch(() => errors.push('never ready'));
  await page.waitForTimeout(250);
  return { context, page, errors };
}
const snap = page => page.evaluate(() => {
  const a = document.activeElement;
  return {
    focus: a?.id || a?.getAttribute('value') || a?.tagName.toLowerCase(),
    label: document.querySelector('#block-identity')?.textContent ?? null,
    slot: document.querySelector('#exercise-warning')?.textContent ?? '',
    why: document.querySelector('#why-panel')?.textContent ?? '',
    kind: document.querySelector('#practice-kind ui-segmented-control-item[data-checked]')?.getAttribute('value') ?? null,
    duration: document.querySelector('#duration ui-segmented-control-item[data-checked]')?.getAttribute('value') ?? null,
    next: document.querySelector('#next-prompt')?.textContent ?? '',
    clipped: (() => { const s = document.querySelector('#slot'); return s ? s.scrollHeight > s.clientHeight + 1 : null; })(),
  };
});

for (const [width, height] of (process.env.WIDTHS ?? '1440x900,390x844,320x640').split(',').map(v => v.split('x').map(Number))) {
  // D1 prior focus: in-memory snapshot only.
  { const { context, page, errors } = await open(width, height, 'page=practice&fx=s10stepped&kind=recommended&reload=1');
    const s = await snap(page);
    check('D1a reload, stepped back: no previous pair named; truthful fallback', width,
      !/\bth\b/.test(s.slot) && /no focus for now/i.test(s.slot) && s.label === 'General practice · 30 s' && s.focus === 'typing-input' && !s.clipped && !errors.length, { ...s, why: s.why.slice(0, 120), errors });
    await context.close(); }
  { const { context, page, errors } = await open(width, height, 'page=practice&fx=s10changed&kind=recommended&reload=1');
    const s = await snap(page);
    check('D1b reload, focus changed: current Suggested ready, no "leans on"/previous pair', width,
      s.label === 'Suggested practice · er · 30 s' && !/\bth\b|leans on/i.test(s.slot) && s.kind === 'recommended' && s.focus === 'typing-input' && !errors.length, { ...s, why: s.why.slice(0, 80), errors });
    await context.close(); }
  { const { context, page, errors } = await open(width, height, 'page=practice&fx=s10changed&kind=recommended');
    const s = await snap(page);
    check('D1c guard: in-memory prior snapshot still announces the change once', width, /Suggested now leans on er/.test(s.slot) && s.focus === 'typing-input' && !errors.length, { slot: s.slot, errors });
    await context.close(); }
  { const { context, page, errors } = await open(width, height, 'page=practice&fx=s10changed&kind=recommended');
    // Navigating to another page is a new document: the in-memory prior snapshot does not travel.
    await page.click(width > 760 ? '.site-nav a[href*="page=progress"]' : '#nav-menu button').catch(() => {});
    if (width <= 760) { await page.waitForTimeout(150); await page.click('.nav-menu-panel a[href*="page=progress"]'); }
    await page.waitForSelector('body[data-ready="1"]');
    await page.click(width > 760 ? '.site-nav a[href*="page=practice"]' : '#nav-menu button');
    if (width <= 760) { await page.waitForTimeout(150); await page.click('.nav-menu-panel a[href*="page=practice"]'); }
    await page.waitForSelector('body[data-ready="1"]'); await page.waitForTimeout(250);
    const s = await snap(page);
    check('D1d navigation away and back: no stale prior-pair announcement', width, !/leans on|\bth\b/.test(s.slot) && /Suggested practice · er/.test(s.label ?? '') && !errors.length, { slot: s.slot, label: s.label, errors });
    await context.close(); }

  // D2 pilot is exactly 30 s: honest mismatch, no clamping, nothing blocked.
  { const { context, page, errors } = await open(width, height, 'page=practice&fx=s10ready&kind=recommended&dur=60');
    const s = await snap(page);
    const ok = s.label === 'General practice · 60 s' && s.duration === '60' && s.kind === 'recommended' && /30 s only/.test(s.slot) && /use 30 s/.test(s.slot) && !/\d+ ms/.test(s.why) && s.focus === 'typing-input' && !s.clipped;
    let after = null;
    if (ok) {
      await page.locator('#exercise-warning button', { hasText: 'use 30 s' }).click(); await page.waitForTimeout(200);
      after = await snap(page);
    }
    check('D2a Suggested at 60 s: general block, setting kept, honest hint; [use 30 s] is the person\'s choice', width,
      ok && after?.label === 'Suggested practice · th · 30 s' && after?.duration === '30' && after?.focus === 'typing-input' && !errors.length, { s: { ...s, why: s.why.slice(0, 160) }, after: after && { label: after.label, duration: after.duration, focus: after.focus }, errors });
    await context.close(); }
  { const { context, page, errors } = await open(width, height, 'page=practice&fx=s10ready&kind=recommended&dur=60');
    await page.focus('#practice-kind ui-segmented-control-item[value="recommended"]');
    await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(150);
    const s = await snap(page);
    check('D2b General at 60 s stays ordinary: no hint, duration untouched', width, s.kind === 'general' && s.label === 'General practice · 60 s' && s.duration === '60' && !s.slot.trim() && !errors.length, { ...s, why: undefined, errors });
    await context.close(); }
  { const { context, page, errors } = await open(width, height, 'page=practice&fx=s10ready&kind=recommended&qwerty=0');
    const s = await snap(page);
    check('D2c Suggested with qwerty off: general block, declaration key offered', width, s.label === 'General practice · 30 s' && /my keyboard is qwerty/.test(s.slot) && !s.clipped && s.focus === 'typing-input' && !errors.length, { ...s, why: undefined, errors });
    await context.close(); }
  { const { context, page, errors } = await open(width, height, 'page=practice&fx=s10ready&kind=recommended&plan=finite&dur=60');
    const s = await snap(page);
    check('D2d finite plan is not used at 60 s (no end-of-block marker, general prompts)', width, s.label === 'General practice · 60 s' && !/end of this block/.test(s.next) && !errors.length, { label: s.label, next: s.next, errors });
    await context.close(); }
  { const { context, page, errors } = await open(width, height, 'page=practice&fx=s10ready&kind=recommended&plan=finite&dur=30&fast=1');
    const plan = await page.evaluate(() => window.__plan ?? []);
    for (const sentence of plan) await page.keyboard.type(`${sentence} `, { delay: 4 });
    await page.waitForTimeout(400);
    const o = await page.evaluate(() => ({ stage: document.querySelector('#stage').dataset.state, label: document.querySelector('.result-label')?.textContent, figures: Boolean(document.querySelector('#completion .result-figures')) }));
    check('D2e finite plan at 30 s ends early, label "of 30", metrics row still unavailable', width, o.stage === 'completed' && / of 30$/.test(o.label ?? '') && !o.figures && !errors.length, { ...o, errors });
    await context.close(); }
  // P1 r2 alignment (c6a8a80, msg_d76270ea1cda): a flagged run that reaches the plan end keeps the
  // interruption explanation first; no clean-completion observation; figures stay unavailable.
  { const { context, page, errors } = await open(width, height, 'page=practice&fx=s10ready&kind=recommended&plan=finite&dur=30&fast=1');
    const plan = await page.evaluate(() => window.__plan ?? []);
    await page.keyboard.type(`${plan[0]} `, { delay: 4 });
    await page.evaluate(() => document.querySelector('#typing-input').blur());
    await page.focus('#typing-input');
    for (const sentence of plan.slice(1)) await page.keyboard.type(`${sentence} `, { delay: 4 });
    await page.waitForTimeout(400);
    const o = await page.evaluate(() => ({ stage: document.querySelector('#stage').dataset.state, label: document.querySelector('.result-label')?.textContent, text: document.querySelector('#completion')?.innerText ?? '', figures: Boolean(document.querySelector('#completion .result-figures')) }));
    check('D2f flagged run reaching the finite end: flag explanation leads, no end observation, no figures', width,
      o.stage === 'completed' && /Flagged/.test(o.text) && !/every sentence in this/.test(o.text) && / of 30$/.test(o.label ?? '') && !o.figures && !errors.length, { ...o, text: o.text.slice(0, 200), errors });
    await context.close(); }
  // Independent r2 review N1 (b534512 / root d72d2ec, root 0527c88): complete-ready with reason null,
  // absent or P1 r2 'supported' must explain the focus, never "unavailable"; automaticCoaching
  // 'unavailable' is not "switched off"; no re-check promise after a non-gate reason.
  const enc = s => `s=${encodeURIComponent(Buffer.from(JSON.stringify(s)).toString('base64'))}`;
  const th = { pair: 'th', pairGeometricMs: 212, referenceGeometricMs: 168, observations: 46, sourceRuns: 10, wordContexts: 7 };
  const sum = { state: 'available', selectionProofComplete: true, medianWpm: 39, medianAccuracy: 95.8, validAccuracySources: 10, from: '2026-11-09', to: '2026-11-18' };
  const baseS = { policyId: 'fixture', target: 10, counted: 10, exact: true, evidenceScanComplete: true, pending: 0, automaticCoaching: 'enabled', summary: sum };
  for (const reason of [null, undefined, 'supported']) for (const kind of ['general', 'recommended']) {
    const s = { ...baseS, state: 'complete-ready', focus: th }; if (reason !== undefined) s.reason = reason;
    const { context, page, errors } = await open(width, height, `page=practice&${enc(s)}&kind=${kind}&view=why`);
    const o = await snap(page);
    check(`N1a complete-ready reason=${reason === undefined ? 'absent' : reason} kind=${kind}: why? explains th, never unavailable`, width,
      /\bth\b/.test(o.why) && /212 ms/.test(o.why) && !/unavailable/i.test(o.why) && !errors.length, { label: o.label, why: o.why.slice(0, 160), errors });
    await context.close();
  }
  for (const counted of [4, 10]) {
    const s = { ...baseS, automaticCoaching: 'unavailable', evidenceScanComplete: null, counted, state: counted < 10 ? 'in-progress' : 'complete-insufficient', reason: counted < 10 ? 'baseline-incomplete' : 'policy-invalid', summary: counted < 10 ? null : sum };
    const { context, page, errors } = await open(width, height, `page=practice&${enc(s)}&view=press`);
    const press = (await snap(page)).slot;
    await page.click('#why button'); await page.waitForTimeout(150);
    const why = (await snap(page)).why;
    check(`N1b automaticCoaching unavailable at ${counted}: unavailable, not switched off, no re-check`, width,
      /unavailable/i.test(`${press} ${why}`) && !/switched on|re-checks|look for a focus/i.test(`${press} ${why}`) && !errors.length, { press, why: why.slice(0, 160), errors });
    await context.close();
  }
  { const s = { ...baseS, state: 'complete-insufficient', reason: 'policy-invalid' };
    const { context, page, errors } = await open(width, height, `page=practice&${enc(s)}&view=why`);
    const o = await snap(page);
    check('N1c non-gate reason at ten (policy-invalid): no re-check promise', width, !/re-checks after each saved/.test(o.why) && !errors.length, { why: o.why.slice(0, 200), errors });
    await context.close(); }
  { const status = { policyId: 'fixture', target: 10, counted: 10, exact: true, evidenceScanComplete: null, pending: 0, automaticCoaching: 'unavailable', state: 'complete-insufficient', reason: 'coaching-deferred', summary: null };
    const { context, page, errors } = await open(width, height, `page=practice&s=${encodeURIComponent(Buffer.from(JSON.stringify(status)).toString('base64'))}&view=press`);
    const s = await snap(page);
    check('D1e automaticCoaching "unavailable" (P1 r2 projection) never reads as switched off', width, /unavailable/.test(s.slot) && !/switched on/.test(s.slot) && !errors.length, { slot: s.slot, errors });
    await context.close(); }
}
await browser.close();
const summary = { base: BASE, ranAt: new Date().toISOString(), total: checks.length, passed: checks.filter(c => c.pass).length, failed: checks.filter(c => !c.pass).map(c => `${c.width} ${c.id}`) };
console.log(JSON.stringify(summary, null, 1));
if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify({ summary, checks }, null, 1));
