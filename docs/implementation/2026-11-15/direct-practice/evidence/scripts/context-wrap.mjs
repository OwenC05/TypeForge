// L-1 verification: whole-word wrapping of the non-editable context lines -> ../context-wrap.json
// Same 25 seeds and seeding function as the lead's prototype check (lead-review/scripts/ctx-wrap.mjs,
// f827733 on OwenC05/typeforge-design-prototypes), at 1440, 390 and 320, in two modes on the same build:
//   shipped  : the production CSS (context lines: word-break normal, overflow-wrap break-word)
//   old-rule : the same page with the pre-L-1 context rule re-applied by a test-only style
//              (word-break: break-all; overflow-wrap: anywhere), to show the measurement detects splits
// Real time (no Playwright clock), real keys into the native textarea. Per seed: ready state (next line),
// then the first passage typed with one wrong glyph and committed with Space (previous line, .missed).
import { launch, BASE, VIEWPORTS, shot, writeJson, chromeVersion, buildIdentity, finish } from './lib.mjs';

const OLD_RULE = '.passage-context { word-break: break-all !important; overflow-wrap: anywhere !important; }';
const SEEDS = Array.from({ length: 25 }, (_, i) => i + 1);
const report = { generatedAt: new Date().toISOString(), base: BASE, build: await buildIdentity(), chrome: null, method: 'Lead seeding (Math.random LCG, seed*7919); per-glyph Range rects; a word is split when its glyphs sit on more than one row.', viewports: {}, checks: [] };
const check = (name, pass, detail) => { report.checks.push({ name, pass: Boolean(pass), ...(detail === undefined ? {} : { detail }) }); };

const measure = page => page.evaluate(() => {
  const glyphTops = el => {
    const tops = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      for (let i = 0; i < node.textContent.length; i++) {
        const range = document.createRange(); range.setStart(node, i); range.setEnd(node, i + 1);
        tops.push(Math.round(range.getBoundingClientRect().top));
      }
    }
    return tops;
  };
  const splitWords = el => {
    const text = el.textContent ?? ''; const tops = glyphTops(el); const words = []; let i = 0;
    for (const word of text.split(' ')) { if (new Set(tops.slice(i, i + word.length)).size > 1) words.push(word); i += word.length + 1; }
    return { text, rows: new Set(tops).size, split: words, overflowX: el.scrollWidth > el.clientWidth + 1 };
  };
  const style = getComputedStyle(document.querySelector('#next-prompt'));
  const cursor = document.querySelector('#prompt .cursor');
  return {
    next: splitWords(document.querySelector('#next-prompt')),
    previous: splitWords(document.querySelector('#previous-prompt')),
    inputTop: +document.querySelector('#typing-input').getBoundingClientRect().top.toFixed(2),
    caretTop: cursor ? +cursor.getBoundingClientRect().top.toFixed(2) : null,
    surfaceTop: +document.querySelector('#typing-viewport').getBoundingClientRect().top.toFixed(2),
    docOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    contextStyle: { wordBreak: style.wordBreak, overflowWrap: style.overflowWrap, whiteSpace: style.whiteSpace, fontFamily: style.fontFamily, fontSize: style.fontSize, lineHeight: style.lineHeight, letterSpacing: style.letterSpacing, fontKerning: style.fontKerning, ligatures: style.fontVariantLigatures, tabSize: style.tabSize },
    editorStyle: (() => { const s = getComputedStyle(document.querySelector('#typing-input')); const p = getComputedStyle(document.querySelector('#prompt')); return { input: [s.wordBreak, s.overflowWrap, s.whiteSpace], prompt: [p.wordBreak, p.overflowWrap, p.whiteSpace] }; })(),
  };
});
const missed = page => page.evaluate(() => [...document.querySelectorAll('#previous-prompt .missed')].map(span => { const s = getComputedStyle(span); return { text: span.textContent, line: s.textDecorationLine, style: s.textDecorationStyle, color: s.textDecorationColor }; }));

for (const [width, viewport] of Object.entries(VIEWPORTS)) {
  const modes = {};
  for (const mode of ['shipped', 'old-rule']) {
    const run = await launch(`ctx-${width}-${mode}`, viewport);
    report.chrome ??= await chromeVersion(run.context, run.page);
    const rows = [];
    for (const seed of SEEDS) {
      const page = await run.context.newPage();
      await page.addInitScript(s => { let x = s; Math.random = () => ((x = (x * 16807) % 2147483647) / 2147483647); }, seed * 7919);
      if (mode === 'old-rule') await page.addInitScript(rule => { const style = document.createElement('style'); style.textContent = rule; new MutationObserver((_, observer) => { if (document.head) { document.head.append(style); observer.disconnect(); } }).observe(document, { childList: true, subtree: true }); }, OLD_RULE);
      await page.goto(`${BASE}/`); await page.locator('#typing-input').waitFor(); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(250);
      const ready = await measure(page);
      if (seed === 3 && width !== '1440') await shot(page, `ctxwrap-${width}-${mode}-ready.png`);
      // Type the first passage with one wrong glyph in the middle of a word, then commit with Space.
      const prompt = (await page.locator('#target-description').textContent()).replace('Passage to copy: ', '');
      let at = Math.floor(prompt.length / 2); while (prompt[at] === ' ') at++;
      const typed = prompt.slice(0, at) + (prompt[at] === 'x' ? 'z' : 'x') + prompt.slice(at + 1);
      await page.keyboard.type(typed, { delay: 2 });
      await page.keyboard.press('Space');
      await page.waitForFunction(p => document.querySelector('#previous-prompt')?.textContent === p && document.querySelector('#typing-input').value === '', prompt, { timeout: 5000 });
      await page.waitForTimeout(150);
      const committed = await measure(page);
      const marks = await missed(page);
      if (seed === 3) await shot(page, `ctxwrap-${width}-${mode}-committed.png`);
      rows.push({ seed, ready: { nextSplit: ready.next.split, nextRows: ready.next.rows, nextOverflowX: ready.next.overflowX, inputTop: ready.inputTop, caretTop: ready.caretTop, docOverflowX: ready.docOverflowX },
        committed: { errorAt: at, previousSplit: committed.previous.split, previousRows: committed.previous.rows, previousOverflowX: committed.previous.overflowX, nextSplit: committed.next.split, caretTop: committed.caretTop, inputTop: committed.inputTop, docOverflowX: committed.docOverflowX, missed: marks },
        contextStyle: ready.contextStyle, editorStyle: ready.editorStyle });
      await page.close();
    }
    modes[mode] = { rows, errors: run.errors };
    await run.context.close();
  }
  const sum = (mode, pick) => modes[mode].rows.reduce((n, row) => n + pick(row).length, 0);
  const seedsWith = (mode, pick) => modes[mode].rows.filter(row => pick(row).length).length;
  const summary = {};
  for (const mode of ['shipped', 'old-rule']) summary[mode] = {
    seeds: modes[mode].rows.length,
    readyNextLine: { seedsWithSplit: seedsWith(mode, r => r.ready.nextSplit), wordsSplit: sum(mode, r => r.ready.nextSplit) },
    committedPreviousLine: { seedsWithSplit: seedsWith(mode, r => r.committed.previousSplit), wordsSplit: sum(mode, r => r.committed.previousSplit) },
    committedNextLine: { seedsWithSplit: seedsWith(mode, r => r.committed.nextSplit), wordsSplit: sum(mode, r => r.committed.nextSplit) },
    readyInputTops: [...new Set(modes[mode].rows.map(r => r.ready.inputTop))], readyCaretTops: [...new Set(modes[mode].rows.map(r => r.ready.caretTop))],
    pageErrors: modes[mode].errors.length,
  };
  const shipped = modes.shipped.rows; const old = modes['old-rule'].rows;
  const sameReady = shipped.every((row, i) => row.ready.inputTop === old[i].ready.inputTop && row.ready.caretTop === old[i].ready.caretTop);
  const commitMoves = shipped.flatMap((row, i) => row.committed.caretTop === old[i].committed.caretTop ? [] : [{ seed: row.seed, shipped: row.committed.caretTop, oldRule: old[i].committed.caretTop, previousRows: [row.committed.previousRows, old[i].committed.previousRows] }]);
  summary.commitCaretTopDiffers = commitMoves;
  summary.contextMetrics = { shipped: shipped[0].contextStyle, oldRule: old[0].contextStyle };
  summary.editor = { shipped: shipped[0].editorStyle, oldRule: old[0].editorStyle };
  report.viewports[width] = { viewport, summary, modes };

  check(`${width}: shipped ready next line splits no word (25 seeds)`, summary.shipped.readyNextLine.wordsSplit === 0, summary.shipped.readyNextLine);
  check(`${width}: shipped committed previous line splits no word`, summary.shipped.committedPreviousLine.wordsSplit === 0, summary.shipped.committedPreviousLine);
  check(`${width}: shipped committed next line splits no word`, summary.shipped.committedNextLine.wordsSplit === 0, summary.shipped.committedNextLine);
  check(`${width}: active line at ready identical to the old rule for every seed`, sameReady, { shipped: summary.shipped.readyInputTops, oldRule: summary['old-rule'].readyInputTops });
  check(`${width}: caret after commit identical to the old rule for every seed`, commitMoves.length === 0, commitMoves);
  check(`${width}: no horizontal overflow (page or context lines), both states`, shipped.every(r => !r.ready.docOverflowX && !r.committed.docOverflowX && !r.ready.nextOverflowX && !r.committed.previousOverflowX && !r.committed.docOverflowX));
  check(`${width}: committed .missed marks render (wavy vermilion underline) for every seed`, shipped.every(r => r.committed.missed.length >= 1 && r.committed.missed.every(m => m.line === 'underline' && m.style === 'wavy' && m.color === 'rgb(194, 65, 12)')), shipped.map(r => r.committed.missed.map(m => m.text).join('|')));
  check(`${width}: context lines keep the mono metrics (family, size, line height, spacing, kerning, ligatures, tab size)`, ['fontFamily', 'fontSize', 'lineHeight', 'letterSpacing', 'fontKerning', 'ligatures', 'tabSize', 'whiteSpace'].every(key => shipped[0].contextStyle[key] === old[0].contextStyle[key]));
  check(`${width}: context lines wrap whole words (word-break normal, overflow-wrap break-word)`, shipped.every(r => r.contextStyle.wordBreak === 'normal' && r.contextStyle.overflowWrap === 'break-word'));
  check(`${width}: active editor keeps break-all / anywhere / pre-wrap (input and mirror)`, shipped.every(r => [r.editorStyle.input, r.editorStyle.prompt].every(s => s.join() === 'break-all,anywhere,pre-wrap')));
  check(`${width}: 0 page errors`, summary.shipped.pageErrors + summary['old-rule'].pageErrors === 0);
  console.log(JSON.stringify({ width, shipped: summary.shipped.readyNextLine, oldRule: summary['old-rule'].readyNextLine, committedPrevious: [summary.shipped.committedPreviousLine, summary['old-rule'].committedPreviousLine], commitMoves: commitMoves.length }));
}

const failed = report.checks.filter(c => !c.pass);
report.summary = { checks: report.checks.length, passed: report.checks.length - failed.length, failed: failed.length, pageErrors: Object.values(report.viewports).reduce((n, v) => n + v.summary.shipped.pageErrors + v.summary['old-rule'].pageErrors, 0) };
writeJson('context-wrap.json', report);
for (const c of failed) console.log('FAIL', c.name, JSON.stringify(c.detail ?? '').slice(0, 400));
console.log(JSON.stringify(report.summary));
finish(report.summary);
