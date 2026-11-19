// F-2 forced-colors typed-progress capture. Usage: node f2-capture.cjs <before|after|f2b-after>
// Needs playwright-core@1.65.1 installed outside the repo (PW_CORE env = that folder) and
// `vite preview --host 127.0.0.1 --port 5313 --strictPort` serving the build under test.
// The same keystroke script runs with forced colors on and off. It records screenshots,
// computed passage styles, every mirror span rect, and the textarea's native hit-test offset.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {chromium} = require(path.join(process.env.PW_CORE, 'node_modules', 'playwright-core'));
const BASE = 'http://127.0.0.1:5313';
const label = process.argv[2];
if (!['before', 'after', 'f2b-after'].includes(label)) throw new Error('label must be before|after|f2b-after');
const OUT = path.join(__dirname, 'f2-' + label);
fs.mkdirSync(OUT, {recursive: true});
const BROWSERS = [
  {name: 'chrome', executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe'},
  {name: 'msedge', executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'},
].filter(b => fs.existsSync(b.executablePath));
const VIEWPORTS = [{name: '1440', width: 1440, height: 900}, {name: '390', width: 390, height: 844}];
const SEED = 20261116;
const seeded = `(() => { let a = ${SEED} >>> 0; Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();`;
const FIXED = new Date('2026-11-16T12:00:00Z');
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const captures = [];

// Computed styles of the passage parts that F-2 touches (pseudo-elements included).
const styles = page => page.evaluate(() => {
  const pick = (e, pseudo) => { const c = getComputedStyle(e, pseudo); return {color: c.color, background: c.backgroundColor,
    decoration: `${c.textDecorationLine} ${c.textDecorationStyle} ${c.textDecorationColor}`, borderLeft: `${c.borderLeftWidth} ${c.borderLeftStyle} ${c.borderLeftColor}`,
    border: `${c.borderTopWidth} ${c.borderTopStyle} ${c.borderTopColor}`, font: `${c.fontWeight} ${c.fontSize}/${c.lineHeight} ${c.letterSpacing}`, forcedColorAdjust: c.forcedColorAdjust}; };
  const q = s => document.querySelector(s);
  const out = {};
  const untyped = [...document.querySelectorAll('#prompt > span')].find(s => !s.className);
  if (untyped) out.untyped = pick(untyped);
  if (q('#prompt .correct')) out.correct = pick(q('#prompt .correct'));
  if (q('#prompt .wrong')) out.wrong = pick(q('#prompt .wrong'));
  if (q('#prompt .selected')) out.selected = pick(q('#prompt .selected'));
  if (q('#prompt .first-mismatch')) out.mismatchTag = pick(q('#prompt .first-mismatch'), '::after');
  if (q('#prompt .cursor')) out.caret = pick(q('#prompt .cursor'), '::before');
  if (q('#prompt .cursor[data-pointer]')) out.pointer = {...pick(q('#prompt .cursor[data-pointer]'), '::after'), text: q('#prompt .cursor').dataset.pointer};
  out.context = pick(q('#previous-prompt'));
  out.nextContext = pick(q('#next-prompt'));
  if (q('#previous-prompt .missed')) out.missed = pick(q('#previous-prompt .missed'));
  out.textarea = pick(q('#typing-input'));
  out.textareaCaret = getComputedStyle(q('#typing-input')).caretColor;
  return out;
});
// Geometry: every mirror span rect plus the textarea's native hit-test offset at the mirror cursor.
const geometry = page => page.evaluate(() => {
  const input = document.querySelector('#typing-input');
  const spans = [...document.querySelectorAll('#prompt > span')];
  const cursor = document.querySelector('#prompt .cursor');
  const r = cursor?.getBoundingClientRect();
  const hit = r ? document.caretPositionFromPoint(r.left + 1, r.top + r.height / 2) : null;
  return {
    value: input.value, selection: [input.selectionStart, input.selectionEnd, input.selectionDirection],
    spans: spans.map(s => { const b = s.getBoundingClientRect(); return [s.textContent, +b.left.toFixed(3), +b.top.toFixed(3), +b.width.toFixed(3), +b.height.toFixed(3)]; }),
    cursorIndex: spans.indexOf(cursor),
    nativeOffsetAtCursor: hit?.offsetNode === input ? hit.offset : hit ? `node:${hit.offsetNode.nodeName}` : null,
    textareaRect: (b => [b.left, b.top, b.width, b.height])(input.getBoundingClientRect()),
    surfaceScrollTop: document.querySelector('#typing-viewport').scrollTop,
    stage: document.querySelector('#stage').dataset.state, focus: document.querySelector('#stage').dataset.focus,
    coverVisible: getComputedStyle(document.querySelector('#continue-typing').closest('.stage-cover') ?? document.querySelector('#continue-typing')).display !== 'none',
    previous: document.querySelector('#previous-prompt').textContent,
  };
});
async function idle(page) {
  await page.waitForFunction(() => document.querySelector('#stage')?.dataset.state === 'idle' && !document.querySelector('#typing-input').disabled);
  await page.locator('#prompt span').first().waitFor();
  await page.waitForFunction(() => document.activeElement?.id === 'typing-input');
}
const wrongFor = ch => (ch === 'z' ? 'x' : 'z');

async function scenario(browser, vp, forced) {
  const theme = forced ? 'forced' : 'normal';
  const context = await browser.newContext({viewport: {width: vp.width, height: vp.height}, forcedColors: forced ? 'active' : 'none', reducedMotion: 'reduce'});
  const page = await context.newPage();
  await page.addInitScript(seeded);
  await page.clock.install({time: FIXED});
  await page.clock.pauseAt(new Date(FIXED.getTime() + 1000));
  await page.goto(BASE + '/');
  await idle(page);
  const input = page.locator('#typing-input');
  const prompt = (await page.locator('#target-description').innerText()).replace('Passage to copy: ', '');
  const states = {};
  const record = async name => {
    const file = path.join(OUT, `${run.browser}-${vp.name}-${theme}-${name}.png`);
    await page.screenshot({path: file});
    captures.push({file: path.relative(__dirname, file).replace(/\\/g, '/'), sha256: sha(file)});
    states[name] = {shot: path.basename(file), geometry: await geometry(page), styles: await styles(page)};
  };
  const run = {browser: browser._name, viewport: vp.name, theme, prompt, states};
  // 1. typed prefix + untyped remainder; caret visible at its position.
  await input.pressSequentially(prompt.slice(0, 8));
  await record('typed');
  // 2. one mismatch with its expected-glyph tag.
  await input.press(wrongFor(prompt[8]));
  await record('mismatch');
  // 3. corrected glyph: Backspace the mismatch, type the right glyph, continue.
  await input.press('Backspace');
  await input.pressSequentially(prompt.slice(8, 12));
  await record('corrected');
  // 4. Shift+Arrow selection inside the active passage.
  for (let i = 0; i < 4; i++) await input.press('Shift+ArrowLeft');
  await record('selection');
  await input.press('End');
  // 5. Earlier mismatch, then keep typing; the caret-side pointer appears if it leaves the caret line.
  // The mismatch goes on a letter (a wrong glyph in place of a space is not a passage-committing state).
  let m = 12; while (prompt[m] === " ") m++;
  if (m > 12) await input.pressSequentially(prompt.slice(12, m));
  await input.press(wrongFor(prompt[m]));
  for (let i = m + 1; i < prompt.length; i++) {
    await input.press(prompt[i] === ' ' ? 'Space' : prompt[i]);
    if (await page.locator('#prompt .cursor[data-pointer]').count()) break;
  }
  run.pointerShown = (await page.locator('#prompt .cursor[data-pointer]').count()) > 0;
  await record('pointer');
  // 6. committed passage: finish the passage, Space advances it into the previous-context line.
  const typed = await input.inputValue();
  if (typed.length < prompt.length) await input.pressSequentially(prompt.slice(typed.length));
  await input.press('Space');
  await page.waitForFunction(() => document.querySelector('#previous-prompt').textContent.length > 0);
  await input.pressSequentially((await page.locator('#target-description').innerText()).replace('Passage to copy: ', '').slice(0, 3));
  await record('committed');
  // 7. focus lost: Tab leaves the textarea (to restart); the cover button appears.
  await input.press('Tab');
  await page.waitForFunction(() => document.querySelector('#stage').dataset.focus === 'out');
  await record('cover');
  await context.close();
  return run;
}

(async () => {
  const report = {label, base: BASE, generatedAt: new Date().toISOString(), seed: SEED, runs: []};
  for (const b of BROWSERS) {
    const browser = await chromium.launch({executablePath: b.executablePath, headless: true});
    browser._name = b.name;
    for (const vp of VIEWPORTS) for (const forced of [true, false]) {
      const run = await scenario(browser, vp, forced);
      run.version = browser.version();
      report.runs.push(run);
    }
    await browser.close();
  }
  report.captures = captures;
  fs.writeFileSync(path.join(OUT, 'evidence.json'), JSON.stringify(report, null, 2));
  console.log(`${label}: ${report.runs.length} runs, ${captures.length} captures; pointer shown: ${report.runs.map(r => `${r.browser}-${r.viewport}-${r.theme}=${r.pointerShown}`).join(' ')}`);
})().catch(e => { console.error(e); process.exit(1); });
