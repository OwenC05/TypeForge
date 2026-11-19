// Geometry and native-editing matrix for the direct-practice stage -> ../geometry.json
// Adapted from prototype B's reviewed harness (OwenC05/tf-proto-b @ 5e763aa, harness/geometry.mjs).
// Real key and pointer events through the native textarea. "Native" positions come from the
// browser's own hit testing into the textarea (document.caretPositionFromPoint returns the textarea
// and a character offset in Chrome) and from real mouse clicks; the mirror is compared to them.
// Two wrapping modes run the same matrix:
//   shipped   : the production CSS (column-snapped, word-break: break-all)
//   word-safe : the same page with a test-only override (word-break: normal; overflow-wrap: anywhere)
// Word-safe is adopted only if every case and every sweep width agrees (direction §4.8).
import { launch, BASE, VIEWPORTS, target, geometry, saved, seededRandom, writeJson, promptIds, chromeVersion, buildIdentity } from './lib.mjs';

const SEED = 20261115;
const WORD_SAFE = '.typing-surface .prompt, .typing-surface .typing-input, .passage-context { word-break: normal !important; overflow-wrap: anywhere !important; }';
const report = { generatedAt: new Date().toISOString(), base: BASE, build: await buildIdentity(), seed: SEED, chrome: null, notes: [], modes: {}, promptIds: {}, savedSettings: {}, sweep: {} };

const mirrorState = page => page.evaluate(() => {
  const input = document.querySelector('#typing-input');
  const surface = document.querySelector('#typing-viewport').getBoundingClientRect();
  const spans = [...document.querySelectorAll('#prompt > span')];
  const caret = input.selectionDirection === 'backward' ? input.selectionStart : input.selectionEnd;
  const cursor = spans.findIndex(span => span.classList.contains('cursor'));
  const selected = spans.flatMap((span, index) => span.classList.contains('selected') ? [index] : []);
  const mismatches = []; let probed = 0;
  const lineTops = [];
  // Probe every typed glyph and the caret position (index == value.length).
  for (let index = 0; index <= input.value.length; index++) {
    const rect = spans[index].getBoundingClientRect();
    if (rect.top < surface.top || rect.bottom > surface.bottom) continue; // clipped by the stage scroller
    if (index < input.value.length && !lineTops.includes(Math.round(rect.top))) lineTops.push(Math.round(rect.top));
    const position = document.caretPositionFromPoint(rect.left + 1, rect.top + rect.height / 2);
    probed++;
    const offset = position?.offsetNode === input ? position.offset : position ? `node:${position.offsetNode.nodeName}` : null;
    if (offset !== index) mismatches.push([index, offset]);
  }
  return {
    value: input.value, selectionStart: input.selectionStart, selectionEnd: input.selectionEnd, direction: input.selectionDirection,
    mirrorCursor: cursor, mirrorSelection: selected.length ? [selected[0], selected.at(-1) + 1] : null,
    caretAgrees: cursor === caret,
    selectionAgrees: input.selectionStart === input.selectionEnd ? selected.length === 0 : (selected.length === input.selectionEnd - input.selectionStart && selected[0] === input.selectionStart),
    selectionLines: [...new Set(selected.map(index => Math.round(spans[index].getBoundingClientRect().top)))].length,
    typedVisualLines: lineTops.length, nativeProbed: probed, nativeMismatches: mismatches.slice(0, 8), nativeMismatchCount: mismatches.length,
  };
});
const wrapIndex = (page, from = 0) => page.evaluate(from => {
  const spans = [...document.querySelectorAll('#prompt > span')];
  const top = spans[from].getBoundingClientRect().top;
  return spans.findIndex((span, index) => index > from && span.getBoundingClientRect().top > top + 2);
}, from);
async function clickGlyph(page, index) {
  const box = await page.locator('#prompt > span').nth(index).boundingBox();
  await page.mouse.click(box.x + 1, box.y + box.height / 2); // left edge of the glyph -> caret before it
}
async function openStage(viewport, label, url, mode = 'shipped') {
  const run = await launch(label, viewport);
  await run.page.addInitScript(seededRandom(SEED));
  await run.page.clock.install();
  await run.page.clock.pauseAt(new Date(Date.now() + 1000));
  await run.page.goto(BASE + url);
  await run.page.locator('#prompt span').first().waitFor();
  if (mode === 'word-safe') await run.page.addStyleTag({ content: WORD_SAFE });
  await run.page.waitForFunction(() => document.activeElement?.id === 'typing-input', null, { polling: 100 });
  report.chrome ??= await chromeVersion(run.context, run.page);
  return run;
}

for (const vp of [1440, 390, 320]) {
  const viewport = VIEWPORTS[vp];
  // ---------- Prompt identity and saved settings across widths (production CSS) ----------
  const ids = {};
  for (const [name, url] of [['practice-home', '/'], ['practice-deep-link-120', '/practice.html?mode=practice&duration=120'], ['practice-manual-th', '/?practice=manual&pair=th&duration=120'], ['assessment', '/practice.html?duration=15&qwerty=1']]) {
    const run = await openStage(viewport, `ids-${vp}`, url);
    ids[name] = await promptIds(run.page);
    if (name === 'assessment') {
      const text = await target(run.page);
      await run.page.keyboard.type(text, { delay: 5 });
      await run.page.keyboard.press('Space');
      await run.page.clock.fastForward(16000);
      await run.page.waitForFunction(() => document.querySelector('#save-state')?.textContent?.startsWith('Saved'), null, { polling: 100 });
      const [row] = await saved(run.page);
      report.savedSettings[vp] = row.settings;
      await run.page.goto(`${BASE}/practice.html?retest=${row.id}&duration=15&qwerty=1`);
      await run.page.locator('#prompt span').first().waitFor();
      await run.page.waitForFunction(() => document.querySelector('#stage').dataset.promptIds);
      ids['assessment-retest'] = await promptIds(run.page);
      ids['assessment-retest-excluded'] = row.sentences.map(sentence => sentence.promptId).join(' ');
    }
    await run.context.close();
  }
  report.promptIds[vp] = ids;

  for (const mode of ['shipped', 'word-safe']) {
    const result = { viewport, cases: [], events: [], ready: null, running: null, cls: null };
    (report.modes[mode] ??= {})[vp] = result;
    const { context, page, errors } = await openStage(viewport, `geo-${mode}-${vp}`, '/practice.html?mode=practice&duration=120', mode);
    await page.evaluate(() => { window.__shifts = []; new PerformanceObserver(list => { for (const entry of list.getEntries()) window.__shifts.push({ value: entry.value, hadRecentInput: entry.hadRecentInput }); }).observe({ type: 'layout-shift', buffered: true }); });
    result.ready = await geometry(page);
    const passage = await target(page);
    const record = async (name, extra = {}) => { const state = await mirrorState(page); const entry = { case: name, ...extra, ...state }; result.cases.push(entry); return entry; };

    // 0. Typed prefix ending inside a word at the passage's own wrap (the word-safe risk case).
    const passageWrap = await wrapIndex(page);
    if (passageWrap > 0) {
      // Find a word that the untyped passage carries onto the next line, and stop typing inside it.
      const wordStart = passage.lastIndexOf(' ', passageWrap - 1) + 1;
      const inside = Math.min(passageWrap + 1, wordStart + 2);
      await page.keyboard.type(passage.slice(0, inside), { delay: 5 });
      await record('typed prefix ending inside the word at the passage wrap', { length: inside, passageWrapsAt: passageWrap, wordStart });
      await page.keyboard.press('Control+a'); await page.keyboard.press('Backspace');
    } else result.cases.push({ case: 'typed prefix ending inside the word at the passage wrap', skipped: 'passage fits one line at this width' });

    // 1. Extra characters at a line edge: type the passage, then extras until the response wraps.
    await page.keyboard.type(passage, { delay: 5 });
    let extras = 0;
    const extraWrap = async () => { const w = await wrapIndex(page, passage.length); const len = (await page.locator('#typing-input').inputValue()).length; return w !== -1 && w <= len - 3 ? w : -1; };
    while (await extraWrap() === -1) { await page.keyboard.type('z'); extras++; if (extras > 140) break; }
    const boundary = await extraWrap();
    await record('extra characters across a line edge', { extras, wrapAt: boundary, marker: await page.locator('.first-mismatch').getAttribute('data-expected') });
    result.running = await geometry(page);

    // 2. Pointer click-to-caret at the first glyph of the wrapped line and mid-line.
    await clickGlyph(page, boundary);
    const clickLineStart = await record('pointer click-to-caret at a wrapped line start', { clicked: boundary });
    clickLineStart.clickAgrees = clickLineStart.selectionStart === boundary;
    await clickGlyph(page, Math.floor(boundary / 2));
    const clickMid = await record('pointer click-to-caret mid-line', { clicked: Math.floor(boundary / 2) });
    clickMid.clickAgrees = clickMid.selectionStart === Math.floor(boundary / 2);

    // 3. Shift+Arrow selection across the line boundary.
    await clickGlyph(page, boundary - 1);
    await page.keyboard.press('Shift+ArrowRight');
    await page.keyboard.press('Shift+ArrowRight');
    const across = await record('Shift+ArrowRight selection across a line boundary', { expected: [boundary - 1, boundary + 1] });
    across.expectedAgrees = across.selectionStart === boundary - 1 && across.selectionEnd === boundary + 1 && across.selectionLines === 2;
    await page.keyboard.press('Shift+ArrowDown');
    await record('Shift+ArrowDown extends selection by native line geometry');

    // 4. Selection replacement across the boundary.
    await clickGlyph(page, boundary - 1);
    await page.keyboard.press('Shift+ArrowRight');
    await page.keyboard.press('Shift+ArrowRight');
    const beforeReplace = await page.locator('#typing-input').inputValue();
    await page.keyboard.type('q');
    const replaced = await record('selection replacement across a line boundary');
    replaced.valueAgrees = replaced.value === beforeReplace.slice(0, boundary - 1) + 'q' + beforeReplace.slice(boundary + 1);

    // 5. Backspace at the boundary, then Ctrl+Backspace at the end.
    await page.keyboard.press('Backspace');
    const back = await record('Backspace at a line boundary');
    back.valueAgrees = back.value === beforeReplace.slice(0, boundary - 1) + beforeReplace.slice(boundary + 1);
    await page.keyboard.press('End');
    const beforeWord = await page.locator('#typing-input').inputValue();
    await page.keyboard.press('Control+Backspace');
    const word = await record('Ctrl+Backspace (native word deletion)');
    word.valueShorter = word.value.length < beforeWord.length;

    // 6. Clear, then a typed prefix ending inside a word, continued across the wrap.
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Backspace');
    const wrapNow = await wrapIndex(page);
    const insideWord = wrapNow > 0 ? wrapNow - 1 : Math.min(passage.length - 1, passage.indexOf(' ', 6) - 1);
    await page.keyboard.type(passage.slice(0, insideWord + 1), { delay: 5 });
    await record('typed prefix ending at the last glyph before the wrap', { length: insideWord + 1, passageWrapsAt: wrapNow });
    await page.keyboard.type(passage.slice(insideWord + 1, insideWord + 4), { delay: 5 });
    await record('typed prefix continued across the passage wrap');

    // 7. Middle edit.
    const middle = Math.max(1, Math.floor((insideWord + 1) / 2));
    await clickGlyph(page, middle);
    await page.keyboard.type('x');
    const mid = await record('middle edit insertion', { at: middle });
    mid.caretAfterInsert = mid.selectionStart === middle + 1;
    await page.keyboard.press('Backspace');
    await record('middle edit removed with Backspace');

    // 7b. A wrong space inside a word (response word boundaries differ from the passage's).
    await page.keyboard.press('End');
    const typedSoFar = await page.locator('#typing-input').inputValue();
    await page.keyboard.type(' ');
    await record('wrong space inside a word', { at: typedSoFar.length });
    await page.keyboard.press('Backspace');

    // 8. Passage commit transition.
    await page.keyboard.press('End');
    const typed = await page.locator('#typing-input').inputValue();
    await page.keyboard.type(passage.slice(typed.length), { delay: 5 });
    await page.keyboard.press('Space');
    const commit = await record('passage commit transition');
    commit.committed = commit.value === '' && commit.selectionStart === 0 && commit.mirrorCursor === 0;
    commit.previousLine = await page.locator('#previous-prompt').innerText();

    // ---------- Displacement around feedback events ----------
    const measure = async (name, action) => {
      const before = await geometry(page);
      await action();
      await page.waitForTimeout(150);
      const after = await geometry(page);
      const delta = (a, b) => a && b ? { dx: +(b.x - a.x).toFixed(2), dy: +(b.y - a.y).toFixed(2), dw: +(b.w - a.w).toFixed(2), dh: +(b.h - a.h).toFixed(2) } : null;
      const stage = delta(before.stage, after.stage);
      const surface = delta(before.surface, after.surface);
      const entry = { event: name, scrollY: [before.scrollY, after.scrollY], surfaceScrollTop: [before.surfaceScrollTop, after.surfaceScrollTop], stageDelta: stage, surfaceDelta: surface, activeLineTop: [before.activeLineTop, after.activeLineTop], slotDelta: delta(before.slot, after.slot), slotText: after.slotText, slotOverflow: after.slotOverflow,
        zeroDisplacement: [stage, surface].every(d => d && Object.values(d).every(value => Math.abs(value) < 0.01)) && Math.abs(after.activeLineTop - before.activeLineTop) < 0.01 && before.scrollY === after.scrollY };
      result.events.push(entry); return entry;
    };
    const next = await target(page);
    await page.keyboard.type(next.slice(0, 4), { delay: 5 });
    await measure('first mismatch (wrong glyph typed)', () => page.keyboard.type(next[4] === 'x' ? 'z' : 'x'));
    await measure('mismatch corrected (Backspace + expected glyph)', async () => { await page.keyboard.press('Backspace'); await page.keyboard.type(next[4]); });
    await measure('transient hint (Enter no-op)', () => page.keyboard.press('Enter'));
    await measure('hint cleared by the next accepted insertion', () => page.keyboard.type(next[5]));
    await measure('integrity notice (focus lost)', () => page.mouse.click(Math.round(viewport.width / 2), 28));
    await measure('focus regained (continue typing)', () => page.locator('#continue-typing').click());
    await page.keyboard.type(next.slice(6, 9), { delay: 5 });
    await measure('Undo notice (native Ctrl+Z) after an integrity notice', () => page.keyboard.press('Control+z'));
    result.cls = await page.evaluate(() => ({ entries: window.__shifts.length, total: window.__shifts.reduce((sum, entry) => sum + entry.value, 0), excludingRecentInput: window.__shifts.filter(entry => !entry.hadRecentInput).reduce((sum, entry) => sum + entry.value, 0) }));
    result.pageErrors = errors;
    result.slotCapacity = await page.evaluate(() => {
      const slot = document.querySelector('#slot'); const text = document.querySelector('#exercise-warning'); const original = text.textContent; const className = text.className;
      const messages = ['Undo isn’t scored: this run will be saved without accuracy and excluded from progress. Restart to keep scoring.',
        'Unsupported edit: this run will be saved without accuracy and excluded from progress. Restart to keep scoring.',
        'Focus left the typing field: this run is flagged and excluded from headline progress. The timer kept running.',
        'Enter does not advance. Use Space after the last word; Backspace corrects this passage.',
        'Please type the sentence. Pasted or dropped text does not count.',
        'Stopped safely: result-limit. This partial run is not a completed result and will not be saved to progress.',
        // The real combined legacy-URL warning (app.ts parseDuration + parseQwerty reasons, joined by a space).
        'Unsupported duration. Using 60 seconds. Unsupported keyboard declaration. Using an undeclared keyboard.'];
      text.className = 'slot-text is-notice';
      const out = messages.map(message => { text.textContent = message; return { message: message.slice(0, 48) + '…', chars: message.length, fits: slot.scrollHeight <= slot.clientHeight + 1, needPx: slot.scrollHeight, havePx: slot.clientHeight }; });
      text.textContent = original; text.className = className; return out;
    });
    await context.close();
    console.log(JSON.stringify({ vp, mode, cases: result.cases.map(c => [c.case, c.caretAgrees, c.selectionAgrees, c.nativeMismatchCount]), events: result.events.map(e => [e.event, e.zeroDisplacement]) }));
  }
}

// ---------- Wrap agreement sweep: 320..1440 step 8 (141 widths), both modes ----------
for (const mode of ['shipped', 'word-safe']) {
  const { context, page } = await openStage({ width: 1440, height: 900 }, `sweep-${mode}`, '/practice.html?mode=practice&duration=120', mode);
  const text = await target(page);
  // A partial final word is the word-safe risk: type the passage minus its last 3 glyphs plus extras on a second run.
  const rows = [];
  for (const [label, typed] of [['passage typed to inside its last word', text.slice(0, -3)], ['passage + 70 extras', text + 'z'.repeat(70)]]) {
    await page.keyboard.press('Control+a'); await page.keyboard.press('Backspace');
    await page.keyboard.type(typed, { delay: 1 });
    for (let width = 320; width <= 1440; width += 8) {
      await page.setViewportSize({ width, height: 900 });
      const state = await mirrorState(page);
      rows.push({ response: label, width, typedVisualLines: state.typedVisualLines, nativeMismatchCount: state.nativeMismatchCount, caretAgrees: state.caretAgrees, firstMismatch: state.nativeMismatches[0] ?? null });
    }
  }
  report.sweep[mode] = { widthsChecked: rows.length / 2, responses: 2, widthsWithMismatch: rows.filter(row => row.nativeMismatchCount || !row.caretAgrees).map(row => `${row.response}@${row.width}`), rows };
  await context.close();
}

const ids = Object.values(report.promptIds).map(value => JSON.stringify(value));
const settings = Object.values(report.savedSettings).map(value => JSON.stringify(value));
const modeSummary = mode => {
  const widths = Object.values(report.modes[mode]);
  const cases = widths.flatMap(w => w.cases.filter(c => !c.skipped));
  return {
    casesChecked: cases.length,
    casesFailing: widths.flatMap(w => w.cases.filter(c => !c.skipped && !(c.caretAgrees && c.selectionAgrees && c.nativeMismatchCount === 0 && c.clickAgrees !== false && c.valueAgrees !== false && c.expectedAgrees !== false)).map(c => `${w.viewport.width}: ${c.case}`)),
    eventsZeroDisplacement: widths.every(w => w.events.every(e => e.zeroDisplacement)),
    slotMessagesFit: widths.every(w => w.slotCapacity.every(m => m.fits)),
    sweepMismatches: report.sweep[mode].widthsWithMismatch.length,
    pageErrors: widths.flatMap(w => w.pageErrors),
  };
};
report.summary = {
  promptIdsIdenticalAcrossWidths: ids.every(value => value === ids[0]),
  savedSettingsIdenticalAcrossWidths: settings.every(value => value === settings[0]),
  shipped: modeSummary('shipped'),
  wordSafe: modeSummary('word-safe'),
  activeLineTopPct: Object.fromEntries(Object.entries(report.modes.shipped).map(([vp, w]) => [vp, { ready: w.ready.activeLineTopPct, running: w.running.activeLineTopPct, passageFontPx: w.ready.passageFontPx }])),
};
report.notes.push('Prompt order uses a seeded Math.random installed before app scripts; identity across widths shows layout does not feed selection for the same seed.',
  'Playwright clock installed and paused; advanced with fastForward. Accelerated clock, not wall-clock evidence.',
  'Native positions: document.caretPositionFromPoint into the textarea plus real mouse clicks; glyphs clipped by the stage scroller are not probed.',
  'word-safe mode is a test-only style override on the production build; it is never shipped unless every case and sweep width agrees.');
writeJson('geometry.json', report);
console.log(JSON.stringify(report.summary, null, 2));
