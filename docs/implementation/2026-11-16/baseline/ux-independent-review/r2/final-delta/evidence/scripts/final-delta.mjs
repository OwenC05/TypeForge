// Independent focused acceptance of delta r2.1 (author df765f27, root eeaec1d): D1, D2, N1, N2 and the
// three formerly pending cases, on the composed build (root style 1b10cbea…, Vite 8.3.3) served by
// ../../../runner/vite.r2.config.mjs on 127.0.0.1:5318. Expectations are the reviewer's own.
// reload=1 and in-document navigation are SIMULATIONS of losing the in-memory snapshot, not storage proof.
// Output: ../final-delta.json, ../captures.json, ../screenshots/
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const here = import.meta.dirname;
const shots = resolve(here, '../screenshots');
mkdirSync(shots, { recursive: true });
const base = 'http://127.0.0.1:5318/index.html?';
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const VPS = [[1440, 900], [390, 844], [320, 640]];
const out = [];
const check = (slice, id, vp, expect, observed, pass) => out.push({ slice, id, viewport: vp ? `${vp[0]}x${vp[1]}` : 'n/a', expect, pass: !!pass, observed });
const enc = st => 's=' + Buffer.from(JSON.stringify(st)).toString('base64');
const th = { pair: 'th', pairGeometricMs: 212, referenceGeometricMs: 168, observations: 46, sourceRuns: 10, wordContexts: 7 };
const summary = { state: 'available', selectionProofComplete: true, medianWpm: 39, medianAccuracy: 95.8, validAccuracySources: 10, from: '2026-11-09', to: '2026-11-18' };
const status = (o = {}) => ({ policyId: 'review', target: 10, counted: 10, exact: true, evidenceScanComplete: true, pending: 0, automaticCoaching: 'enabled', summary, state: 'complete-insufficient', ...o });

async function open(query, [w, h] = [1440, 900], forced = false) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, forcedColors: forced ? 'active' : 'none', reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(base + query);
  await page.waitForSelector('body[data-ready="1"]');
  await page.waitForTimeout(200);
  return { ctx, page, errors };
}
const st = page => page.evaluate(() => {
  const q = s => document.querySelector(s); const a = document.activeElement;
  const slot = q('#slot');
  return {
    focus: a?.id || a?.textContent?.trim().slice(0, 40) || a?.tagName.toLowerCase(),
    label: q('#block-identity')?.textContent ?? null, slot: q('#exercise-warning')?.textContent ?? null,
    kindChecked: q('#practice-kind ui-segmented-control-item[data-checked]')?.getAttribute('value') ?? null,
    durationChecked: q('#duration ui-segmented-control-item[data-checked]')?.getAttribute('value') ?? null,
    qwerty: q('#qwerty')?.hasAttribute('data-checked') ?? null,
    sr: q('#suggested-status')?.textContent ?? null,
    why: q('#why-panel')?.textContent.replace(/\s+/g, ' ').trim() ?? null,
    prompt: q('#prompt')?.textContent.replace(/\u00a0/g, ' ') ?? null,
    slotClipped: slot ? slot.scrollHeight > slot.clientHeight + 1 || slot.scrollWidth > slot.clientWidth + 1 : null,
    hOverflow: document.documentElement.scrollWidth > innerWidth,
    slotKeyInView: (() => { const b = q('#exercise-warning .key-small'); if (!b) return null; const r = b.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.right <= innerWidth; })(),
  };
});
const shot = async (page, vp, name) => { await page.screenshot({ path: resolve(shots, `${vp[0]}-${name}.png`) }); return `${vp[0]}-${name}.png`; };
const plan = ['the thin moth', 'then the other three', 'they think that this is the path'];

for (const vp of VPS) {
  // ---------------- D1: prior pair only from the in-memory snapshot ----------------
  {
    const { ctx, page, errors } = await open('page=practice&fx=s10stepped&kind=recommended', vp);
    const r = await st(page); const file = await shot(page, vp, 'D1a-stepped-in-memory');
    check('D1', 'D1a stepped back, prior snapshot in this document (fixture stand-in)', vp, 'names th once in the slot; block is General; focus in text', { ...r, errors, file },
      /stepped back to general: th/.test(r.slot) && r.label === 'General practice · 30 s' && r.focus === 'typing-input' && !errors.length);
    await ctx.close();
  }
  {
    const { ctx, page, errors } = await open('page=practice&fx=s10stepped&kind=recommended&reload=1', vp);
    const r = await st(page); const file = await shot(page, vp, 'D1b-stepped-reload');
    check('D1', 'D1b stepped back after SIMULATED reload (no prior snapshot)', vp, 'no previous pair anywhere; truthful no-focus fallback; General; focus in text', { ...r, errors, file },
      r.slot === 'Suggested has no focus for now, so this block is general. More in why?' && !/\bth\b/.test(`${r.slot} ${r.sr} ${r.why}`) && r.label === 'General practice · 30 s' && r.focus === 'typing-input' && !errors.length);
    await ctx.close();
  }
  {
    const { ctx, page, errors } = await open('page=practice&fx=s10changed&kind=recommended', vp);
    const r = await st(page);
    check('D1', 'D1c focus changed, prior snapshot in this document', vp, 'announces er and names th as a re-check; Suggested · er ready', { ...r, errors },
      /Suggested now leans on er\. th no longer stands out/.test(r.slot) && r.label === 'Suggested practice · er · 30 s' && !errors.length);
    await ctx.close();
  }
  {
    const { ctx, page, errors } = await open('page=practice&fx=s10changed&kind=recommended&reload=1', vp);
    const r = await st(page); const file = await shot(page, vp, 'D1d-changed-reload');
    check('D1', 'D1d focus changed after SIMULATED reload', vp, 'Suggested · er simply ready; th never named; no change announcement', { ...r, errors, file },
      r.label === 'Suggested practice · er · 30 s' && r.slot === '' && !/\bth\b/.test(`${r.slot} ${r.sr} ${r.why}`) && !errors.length);
    await ctx.close();
  }
  {
    const { ctx, page, errors } = await open('page=practice&fx=s10changed&kind=recommended', vp);
    const nav = async to => { await page.evaluate(t => { location.href = document.querySelector(`a[href*="page=${t}"]`).href; }, to); await page.waitForSelector('body[data-ready="1"]'); await page.waitForTimeout(150); };
    await nav('assessment'); await nav('practice');
    const r = await st(page);
    check('D1', 'D1e navigate away and back (SIMULATED document change)', vp, 'remembered Suggested kept; no prior pair named', { ...r, errors },
      r.kindChecked === 'recommended' && r.label === 'Suggested practice · er · 30 s' && r.slot === '' && !/\bth\b/.test(`${r.slot} ${r.sr} ${r.why}`) && !errors.length);
    await ctx.close();
  }
  {
    const { ctx, page, errors } = await open('page=practice&fx=s10ready', vp);
    const r = await st(page);
    check('D1', 'D1f unlock does not auto-select Suggested', vp, 'General remembered and checked; Suggested key ordinary', { ...r, errors },
      r.kindChecked === 'general' && r.label === 'General practice · 30 s' && !errors.length);
    await ctx.close();
  }

  // ---------------- D2: exactly 30 s with declared QWERTY ----------------
  {
    const { ctx, page, errors } = await open('page=practice&fx=s10ready&kind=recommended&dur=60', vp);
    const r = await st(page); const file = await shot(page, vp, 'D2a-suggested-60s');
    check('D2', 'D2a Suggested chosen at 60 s', vp, 'block is General and labelled so; 60 kept (no clamp); slot explains with [use 30 s] in view; why? shows no focus evidence; general prompts', { ...r, errors, file },
      r.label === 'General practice · 60 s' && r.durationChecked === '60' && /Suggested runs at 30 s only; this block is general\./.test(r.slot) && r.slotKeyInView && !/212 ms|rule of thumb/i.test(r.why) && /the weather/.test(r.prompt) && !r.slotClipped && !r.hOverflow && r.focus === 'typing-input' && !errors.length);
    await page.keyboard.press('Tab'); await page.waitForTimeout(80);
    const tabbed = await st(page);
    await page.keyboard.press('Enter'); await page.waitForTimeout(200);
    const after = await st(page);
    check('D2', 'D2b [use 30 s] by keyboard', vp, 'one Tab reaches it; Enter presses the existing 30 key; Suggested · th · 30 s; focus back in text', { tabbed: tabbed.focus, after, errors },
      /use 30 s/.test(tabbed.focus) && after.durationChecked === '30' && after.label === 'Suggested practice · th · 30 s' && after.slot === '' && after.focus === 'typing-input');
    await ctx.close();
  }
  {
    const { ctx, page, errors } = await open('page=practice&fx=s10ready&kind=recommended&qwerty=0', vp);
    const r = await st(page); const file = await shot(page, vp, 'D2c-suggested-qwerty-off');
    await page.click('#exercise-warning .key-small'); await page.waitForTimeout(200);
    const after = await st(page);
    check('D2', 'D2c Suggested with qwerty off → declare', vp, 'General labelled; explicit declaration key; after press Suggested · th · 30 s with qwerty on, focus in text', { before: r, after, errors, file },
      r.label === 'General practice · 30 s' && /Suggested needs QWERTY; this is general\./.test(r.slot) && r.slotKeyInView && !r.slotClipped && after.qwerty && after.label === 'Suggested practice · th · 30 s' && after.focus === 'typing-input' && !errors.length);
    await ctx.close();
  }
  {
    const { ctx, page, errors } = await open('page=practice&fx=s10ready&kind=recommended', vp);
    await page.click('#duration ui-segmented-control-item[value="120"]'); await page.waitForTimeout(150);
    const at120 = await st(page);
    await page.click('#duration ui-segmented-control-item[value="30"]'); await page.waitForTimeout(150);
    const back = await st(page);
    check('D2', 'D2d changing duration before the first key', vp, '120 → General with hint; back to 30 → Suggested again', { at120, back, errors },
      at120.label === 'General practice · 120 s' && /30 s only/.test(at120.slot) && back.label === 'Suggested practice · th · 30 s' && back.slot === '' && !errors.length);
    await ctx.close();
  }
  {
    const { ctx, page, errors } = await open('page=practice&fx=s10ready&kind=general&dur=60&fast=1', vp);
    const r = await st(page);
    await page.keyboard.type('the w', { delay: 20 });
    await page.waitForSelector('#completion:not([hidden])', { timeout: 15000 });
    const label = await page.evaluate(() => document.querySelector('.result-label')?.textContent);
    check('D2', 'D2e General at 60 s stays ordinary', vp, 'no hint, ordinary General run and result', { r, label, errors },
      r.label === 'General practice · 60 s' && r.slot === '' && label === 'General practice · 60 s · complete' && !errors.length);
    await ctx.close();
  }
  {
    const { ctx, page, errors } = await open('page=practice&fx=s10ready&kind=recommended&plan=finite&dur=60&fast=1', vp);
    await page.keyboard.type('the weather turned cold before the storm ', { delay: 8 });
    const next = await page.evaluate(() => document.querySelector('#next-prompt')?.textContent);
    await page.waitForSelector('#completion:not([hidden])', { timeout: 15000 });
    const label = await page.evaluate(() => document.querySelector('.result-label')?.textContent);
    check('D2', 'D2f finite plan never runs outside 30 s', vp, 'general prompts, no end marker, ordinary General result at 60 s', { next, label, errors },
      next !== '— end of this block —' && label === 'General practice · 60 s · complete' && !errors.length);
    await ctx.close();
  }

  // ---------------- N2: flagged finite end ----------------
  {
    const { ctx, page, errors } = await open('page=practice&fx=s10ready&kind=recommended&plan=finite&dur=30&fast=1', vp);
    await page.keyboard.type(plan[0] + ' ', { delay: 12 });
    await page.evaluate(() => document.querySelector('#typing-input').blur());
    await page.waitForTimeout(60);
    await page.focus('#typing-input');
    await page.keyboard.type(plan[1] + ' ' + plan[2] + ' ', { delay: 8 });
    await page.waitForTimeout(100);
    const r = await page.evaluate(() => ({ stage: document.querySelector('#stage').dataset.state, remaining: document.querySelector('#remaining').textContent, label: document.querySelector('.result-label')?.textContent, flag: document.querySelector('#completion .result-flag')?.textContent ?? null, observation: document.querySelector('#completion .result-observation')?.textContent ?? null, figures: !!document.querySelector('#completion .result-figures'), focus: document.activeElement?.id, primary: document.querySelector('#primary')?.textContent }));
    const file = await shot(page, vp, 'N2-flagged-plan-end');
    check('N2', 'N2a focus lost, then plan finished', vp, 'actual early-end label; flag sentence present; no clean end observation; no figures; suggested again focused', { ...r, errors, file },
      r.stage === 'completed' && Number(r.remaining) > 0 && /all 3 sentences done at \d+ s of 30/.test(r.label) && /Flagged/.test(r.flag ?? '') && !r.observation && !r.figures && r.focus === 'primary' && /suggested again/.test(r.primary) && !errors.length);
    await ctx.close();
  }
  {
    const { ctx, page, errors } = await open('page=practice&fx=s10ready&kind=recommended&plan=finite&dur=30&fast=1', vp);
    await page.keyboard.type(plan.join(' ') + ' ', { delay: 10 });
    await page.waitForTimeout(100);
    const r = await page.evaluate(() => ({ label: document.querySelector('.result-label')?.textContent, flag: document.querySelector('#completion .result-flag')?.textContent ?? null, observation: document.querySelector('#completion .result-observation')?.textContent ?? null, figures: !!document.querySelector('#completion .result-figures') }));
    const file = await shot(page, vp, 'N2-clean-plan-end');
    check('N2', 'N2b clean plan end unchanged', vp, 'early-end label, small-set observation, no flag, no figures', { ...r, errors, file },
      /all 3 sentences done at \d+ s of 30/.test(r.label) && /every sentence in this th block/.test(r.observation ?? '') && !r.flag && !r.figures && !errors.length);
    await ctx.close();
  }
}

// ---------------- N1: ready focus explanation and reason precedence (copy is width-independent) ----------------
for (const vp of VPS) for (const reason of [null, undefined, 'supported']) for (const kind of ['general', 'recommended']) {
  const s = status({ state: 'complete-ready', focus: th });
  if (reason !== undefined) s.reason = reason;
  const { ctx, page, errors } = await open(`page=practice&${enc(s)}&kind=${kind}&view=why`, vp);
  const r = await st(page);
  const file = reason === 'supported' ? await shot(page, vp, `N1-ready-why-${kind}`) : undefined;
  check('N1', `N1a complete-ready reason=${reason} kind=${kind}`, vp, 'why? explains the th focus; never "unavailable"', { label: r.label, why: r.why?.split('English ·')[0], errors, file },
    /212 ms against 168 ms/.test(r.why) && !/unavailable/i.test(r.why) && !errors.length);
  await ctx.close();
}
const gateSentences = ['come up often enough', 'too few different words', 'not consistently', 'stands out clearly', 'too few practice sentences', 'real practice in one block', 'more than 30 days old'];
const gate = ['stale-evidence', 'too-few-observations-for-any-pair', 'insufficient-context-diversity', 'unstable-evidence', 'no-effect', 'corpus-coverage', 'exposure-unsupported'];
const allReasons = ['policy-invalid', 'storage-unavailable', 'context-unavailable', 'source-integrity', 'scan-incomplete', 'baseline-incomplete', 'coaching-deferred', ...gate, 'supported', 'bogus-future-reason'];
const unavailable = ['policy-invalid', 'storage-unavailable', 'context-unavailable', 'source-integrity'];
for (const cfg of [{ a: 'enabled', e: true }, { a: 'enabled', e: false }, { a: 'disabled', e: null }, { a: 'unavailable', e: null }, { a: 'unavailable', e: false }]) for (const reason of allReasons) {
  const stt = unavailable.includes(reason) ? 'unavailable' : reason === 'scan-incomplete' ? 'pending' : reason === 'baseline-incomplete' ? 'in-progress' : 'complete-insufficient';
  const s = status({ automaticCoaching: cfg.a, evidenceScanComplete: cfg.e, state: stt, reason, counted: stt === 'in-progress' ? 4 : stt === 'unavailable' ? 0 : 10, summary: stt === 'complete-insufficient' ? summary : null });
  const { ctx, page, errors } = await open(`page=practice&${enc(s)}&view=press`);
  await page.waitForTimeout(100);
  const press = (await st(page)).slot;
  await page.click('#why button'); await page.waitForTimeout(100);
  const r = await st(page);
  await ctx.close();
  const all = `${press} | ${r.sr} | ${r.why}`;
  const gateRan = cfg.a === 'enabled' && cfg.e === true;
  const problems = [];
  if (/undefined|NaN/.test(all)) problems.push('undefined/NaN');
  if (errors.length) problems.push('page error');
  if (!gateRan && gateSentences.some(g => all.includes(g))) problems.push('gate sentence without a gate');
  if (/re-checks after each saved/.test(all) && !(gateRan && gate.includes(reason))) problems.push('re-check promise outside a gate reason');
  if (cfg.a !== 'enabled' && /Suggested can look for a focus|Suggested needs 10/.test(all)) problems.push('unlock advertised while coaching not enabled');
  if (cfg.a === 'unavailable' && /switched on/.test(all)) problems.push('"switched on" for an unavailable config');
  if (stt === 'unavailable' && /\d+ of 10/.test(all)) problems.push('number while unavailable');
  check('N1', `N1b ${cfg.a}/${cfg.e} ${stt}/${reason}`, null, 'honest copy; re-check promise only after a gate that ran', { press, sr: r.sr, why: r.why?.split('English ·')[0], problems }, problems.length === 0);
}
// Final results: re-check only after a gate reason; deferred none.
for (const fin of ['insufficient', 'sparse', 'deferred', 'ready']) {
  const { ctx, page, errors } = await open(`page=assessment&fx=s9&view=result&outcome=saved&final=${fin}`);
  const t = await page.evaluate(() => document.querySelector('#baseline-result')?.textContent.replace(/\s+/g, ' '));
  const recheck = /re-checks after each saved/.test(t);
  check('N1', `N1c final result ${fin}`, null, 're-check sentence only for gate reasons (insufficient, sparse)', { text: t, errors }, recheck === (fin === 'insufficient' || fin === 'sparse') && !errors.length);
  await ctx.close();
}

// ---------------- Former pending cases: concrete verdicts ----------------
for (const counted of [4, 10]) {
  const s = status({ automaticCoaching: 'unavailable', evidenceScanComplete: null, counted, state: counted < 10 ? 'in-progress' : 'complete-insufficient', reason: counted < 10 ? 'baseline-incomplete' : 'policy-invalid', summary: counted < 10 ? null : summary });
  for (const vp of VPS) {
    const { ctx, page, errors } = await open(`page=practice&${enc(s)}&view=press`, vp);
    await page.waitForTimeout(100);
    const press = (await st(page)).slot;
    await page.click('#why button'); await page.waitForTimeout(100);
    const r = await st(page); const file = await shot(page, vp, `PX-unavailable-${counted}-why`);
    const ok = /unavailable/i.test(press) && !/switched on|re-checks|Suggested can look|Suggested needs 10/.test(`${press} ${r.sr} ${r.why}`) && (counted < 10 ? /4 of 10/.test(r.why) : /work as usual/.test(r.why)) && !r.slotClipped && !errors.length;
    check('Former pending', `PX automaticCoaching=unavailable at ${counted}`, vp, 'says unavailable (not switched off); no unlock promise, no re-check; count kept honestly below ten', { press, sr: r.sr, why: r.why?.split('English ·')[0], errors, file }, ok);
    await ctx.close();
  }
}
for (const vp of VPS) {
  const { ctx, page, errors } = await open('page=practice&fx=s10ready&kind=recommended&plan=finite&dur=60', vp);
  const r = await st(page);
  check('Former pending', 'PX Suggested at 60 s (was pending on D2)', vp, 'General block at 60 s, honest hint, no clamp, no finite plan', { ...r, errors },
    r.label === 'General practice · 60 s' && r.durationChecked === '60' && /30 s only/.test(r.slot) && !errors.length);
  await ctx.close();
}

// ---------------- Affected captures incl. forced colours where the delta adds a state ----------------
const { states } = await import('file:///' + resolve(here, '../../../../../ux/prototype/fixtures.ts').replace(/\\/g, '/'));
const ids = ['14', '18', '19', '37', '39', '40', '41', '42'];
const caps = [];
for (const s of states.filter(s => ids.includes(s.id.slice(0, 2)))) for (const forced of [false, true]) {
  if (forced && !['41', '42', '39'].includes(s.id.slice(0, 2))) continue;
  for (const vp of VPS) {
    const { ctx, page, errors } = await open(s.query, vp, forced);
    await page.waitForTimeout(150);
    const r = await st(page);
    const undef = await page.evaluate(() => /undefined|NaN/.test(document.body.innerText));
    const file = await shot(page, vp, `${forced ? 'FC-' : ''}${s.id}`);
    caps.push({ id: s.id, forced, viewport: `${vp[0]}x${vp[1]}`, query: s.query, errors, undefinedText: undef, file, ...r });
    await ctx.close();
  }
}
await browser.close();
writeFileSync(resolve(here, '../final-delta.json'), JSON.stringify(out, null, 1));
writeFileSync(resolve(here, '../captures.json'), JSON.stringify(caps, null, 1));
const by = {}; for (const r of out) { by[r.slice] ??= { pass: 0, fail: 0 }; by[r.slice][r.pass ? 'pass' : 'fail']++; }
console.log(JSON.stringify(by));
for (const f of out.filter(r => !r.pass)) console.log('FAIL', f.slice, f.viewport, f.id, JSON.stringify(f.observed).slice(0, 300));
const bad = caps.filter(c => c.errors.length || c.hOverflow || c.slotClipped || c.undefinedText);
console.log(`${caps.length} captures; ${bad.length} with error/overflow/clipped/undefined`);
