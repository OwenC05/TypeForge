import './style.css';
import { CORPUS_VERSION, selectPrompts } from './corpus.ts';
import { TypingEngine, MAX_RESPONSE_LENGTH, type SessionResult } from './engine.ts';
import { saveResult, getResult, listResults, deleteResult } from './storage.ts';

const app = document.querySelector<HTMLDivElement>('#app')!;
const page = document.body.dataset.page;
const params = new URLSearchParams(location.search);
const format = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 1 });
const accuracy = (value: number | null) => value === null ? '—' : `${format(value)}%`;
const date = (value: string) => new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;

function shell(content: string) {
  app.innerHTML = `<header class="site-header">
    <a class="brand" href="./index.html" aria-label="TypeForge home"><span class="brand-mark" aria-hidden="true">t_</span>TypeForge</a>
    <nav aria-label="Main navigation">
      <a href="./practice.html" ${page === 'practice' ? 'aria-current="page"' : ''}>Practice</a>
      <a href="./progress.html" ${page === 'progress' ? 'aria-current="page"' : ''}>Your progress</a>
      <span class="local-pill"><span class="dot"></span>LOCAL / GUEST</span>
    </nav>
  </header><main id="main">${content}</main>
  <footer class="site-footer"><span>TypeForge · A little practice, a better rhythm.</span><span>Results stay in this browser.</span></footer>`;
}

function showError(message: string) {
  shell(`<section class="panel empty"><p class="eyebrow">Something needs attention</p><h1>We could not load this page.</h1><p id="error" class="lead"></p><a class="button" href="./index.html">Back to home</a></section>`);
  $('#error').textContent = message;
}

function home() {
  shell(`<section class="hero">
    <div><p class="eyebrow">A minute for your muscle memory</p><h1>Find your focus.<br><span>Forge your rhythm.</span></h1>
      <p class="lead">A quiet space to practise typing. See your speed, understand your mistakes, and build a habit one minute at a time.</p>
      <div class="actions"><a class="button" href="./practice.html">Take an assessment <span aria-hidden="true">&nbsp;↗</span></a><a class="button secondary" href="./practice.html?mode=practice">Just practise</a></div>
      <p class="small">60 seconds · English · Physical keyboard</p>
    </div>
    <div class="hero-preview" aria-hidden="true"><div class="preview-top"><span>A LITTLE MORE FLOW</span><span>01:00</span></div>
      <p class="preview-text"><strong>make room for</strong><b> </b>a little practice every day</p>
      <span class="keycap">enter ↵</span><span class="small"> &nbsp; one sentence at a time</span>
    </div>
  </section>
  <section class="features" aria-label="How it works">
    <div><span class="feature-number">01 / SET A BASELINE</span><h2>Start where you are.</h2><p>Copy short, everyday sentences. The clock starts with your first character.</p></div>
    <div><span class="feature-number">02 / NOTICE THE DETAILS</span><h2>Make every attempt count.</h2><p>See your accuracy and corrections, including mistakes you went back to fix.</p></div>
    <div><span class="feature-number">03 / KEEP SHOWING UP</span><h2>Find your own pace.</h2><p>Your history stays on this device, ready for the next time you sit down.</p></div>
  </section>`);
}

type PendingEdit = { value: string; start: number; end: number; type: string; data: string | null };
type PhysicalKey = { key: string; time: number; repeat: boolean; start: number; end: number };

// Native selection ranges disambiguate repeated letters and replacing equal text.
function reconstructEdit(before: PendingEdit, value: string) {
  const { value: old, start, end, type, data } = before;
  if (type === 'insertText' && data !== null && old.slice(0, start) + data + old.slice(end) === value) {
    return { start, end, text: data, tracked: data.length === 1 };
  }
  if (type.startsWith('delete')) {
    let from = start;
    let to = end;
    if (start === end) {
      const count = old.length - value.length;
      if (type.endsWith('Backward')) from -= count;
      else if (type.endsWith('Forward')) to += count;
    }
    if (from >= 0 && to >= from && old.slice(0, from) + old.slice(to) === value) {
      return { start: from, end: to, text: '', tracked: true };
    }
  }
  let from = 0;
  while (from < old.length && from < value.length && old[from] === value[from]) from++;
  let tail = 0;
  while (tail < old.length - from && tail < value.length - from && old[old.length - 1 - tail] === value[value.length - 1 - tail]) tail++;
  return { start: from, end: old.length - tail, text: value.slice(from, value.length - tail), tracked: false };
}

async function practice() {
  const mode = params.get('mode') === 'practice' ? 'practice' : 'assessment';
  let excluded: string[] = [];
  if (params.has('retest')) {
    const previous = await getResult(params.get('retest')!);
    if (!previous || previous.mode !== 'assessment') throw new Error('The assessment for this retest is not available in this browser. Start a new assessment from home.');
    excluded = previous.sentences.map((sentence) => sentence.promptId);
  }
  const prompts = selectPrompts(mode, excluded);
  if (!prompts.length) throw new Error('No fresh passages remain for this retest. Start a new assessment from home.');
  shell(`<div class="page-heading"><div><p class="eyebrow">${mode === 'practice' ? 'Build a little momentum' : 'Find your starting point'}</p><h1>${mode === 'practice' ? 'Just you and the keys.' : 'Your one minute assessment.'}</h1><p class="small">English · lowercase · ${params.has('retest') ? 'fresh assessment passages' : 'short sentences'}</p></div><span class="tag">60 SECOND ${mode === 'practice' ? 'PRACTICE' : 'ASSESSMENT'}</span></div>
  <p class="small"><label><input type="checkbox" id="qwerty"> I use a physical QWERTY keyboard</label> · Enables observed pair timing.</p>
  <section class="panel" aria-label="Typing exercise">
    <div class="practice-toolbar"><div class="timer"><output id="remaining">60</output><small> seconds left</small></div><div class="live-metrics"><div><output id="live-wpm">0</output><span>WPM</span></div><div><output id="live-accuracy">—</output><span>ACCURACY</span></div></div></div>
    <progress id="time-progress" value="0" max="60" aria-label="Elapsed time"></progress>
    <p class="prompt" id="prompt" aria-label="Sentence to copy"></p>
    <label class="field-label" for="typing-input">Type the sentence here</label>
    <input class="typing-input" id="typing-input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="${MAX_RESPONSE_LENGTH}" aria-describedby="typing-help exercise-state" placeholder="Your first character starts the clock…">
    <div class="practice-bottom"><p id="typing-help" class="small"><span class="keycap">enter ↵</span> submit sentence · Backspace to correct</p><button class="button secondary" id="restart" type="button">Restart</button></div>
    <p id="exercise-state" class="status" role="status">Ready when you are.</p><p id="exercise-warning" class="notice" hidden></p>
  </section>
  <p class="small">The timer keeps running if you leave the field. Interrupted assessments stay in history, outside your headline progress.</p>
  <div id="completion" hidden></div>`);
  let engine = new TypingEngine({ id: crypto.randomUUID(), prompts, mode, corpusVersion: CORPUS_VERSION, qwerty: false });
  const input = $<HTMLInputElement>('#typing-input');
  const qwerty = $<HTMLInputElement>('#qwerty');
  let before: PendingEdit | null = null;
  let key: PhysicalKey | null = null;
  let composing = false;
  let finished = false;
  let timer: ReturnType<typeof setInterval>;
  let lastState = 'idle';
  let lastPromptKey = '';

  function warning(message: string) {
    $('#exercise-warning').hidden = false;
    $('#exercise-warning').textContent = message;
  }
  function paint(now = performance.now()) {
    const snapshot = engine.tick(now);
    qwerty.disabled = snapshot.state !== 'idle';
    $('#remaining').textContent = String(Math.ceil(snapshot.remainingMs / 1000));
    $('#live-wpm').textContent = format(snapshot.metrics.wpm);
    $('#live-accuracy').textContent = accuracy(snapshot.metrics.accuracy);
    $<HTMLProgressElement>('#time-progress').value = snapshot.elapsedMs / 1000;
    const promptKey = `${snapshot.sentenceIndex}:${snapshot.value}`;
    if (lastPromptKey !== promptKey) {
      const prompt = $('#prompt');
      prompt.replaceChildren();
      prompt.setAttribute('aria-label', `Sentence to copy: ${snapshot.prompt.text}`);
      [...snapshot.prompt.text].forEach((character, index) => {
        const span = document.createElement('span');
        span.textContent = character;
        span.className = index < snapshot.value.length ? (snapshot.value[index] === character ? 'correct' : 'wrong') : index === snapshot.value.length ? 'cursor' : '';
        span.setAttribute('aria-hidden', 'true');
        prompt.append(span);
      });
      lastPromptKey = promptKey;
    }
    if (snapshot.state !== lastState) {
      $('#exercise-state').textContent = snapshot.state === 'running' ? 'Timer running. Press Enter after each sentence.' : snapshot.state === 'completed' ? 'Time is up. Your result is ready.' : 'Ready when you are.';
      lastState = snapshot.state;
    }
    if (snapshot.qualityFlags.length) warning('This run includes an interruption or unsupported edit. It will be saved with a label and excluded from headline progress.');
    if (snapshot.state === 'completed' && !finished) void finish();
    return snapshot;
  }

  async function finish() {
    finished = true;
    clearInterval(timer);
    before = null;
    key = null;
    input.value = engine.snapshot(performance.now()).value;
    input.disabled = true;
    $<HTMLButtonElement>('#restart').disabled = true;
    const result = engine.result(new Date().toISOString());
    if (!result) return;
    // Keep the completed result on screen even if IndexedDB is unavailable.
    const completion = $('#completion');
    completion.hidden = false;
    completion.innerHTML = `<div class="page-heading" style="margin-top:32px"><div><p class="eyebrow">Minute complete</p><h2>Your result</h2></div></div>${metricCards(result)}<p id="save-state" class="status" role="status">Saving to this browser…</p><div class="actions"><button id="export-current" class="button secondary">Export result</button><button id="retry-save" class="button secondary" hidden>Retry saving</button><a class="button secondary" href="./practice.html">New assessment</a></div>`;
    $('#export-current').onclick = () => download(result, `typeforge-${result.id}.json`);
    const attemptSave = async () => {
      $<HTMLButtonElement>('#retry-save').disabled = true;
      try {
        await saveResult(result);
        location.assign(`./results.html?id=${encodeURIComponent(result.id)}`);
      } catch {
        $('#save-state').textContent = 'This result could not be saved. Export it before leaving, or retry when browser storage is available.';
        $('#retry-save').hidden = false;
        $<HTMLButtonElement>('#retry-save').disabled = false;
      }
    };
    $('#retry-save').onclick = () => void attemptSave();
    await attemptSave();
  }

  input.addEventListener('keydown', (event) => {
    const now = performance.now();
    const snapshot = paint(now);
    if (snapshot.state === 'completed' || snapshot.state === 'aborted') { event.preventDefault(); return; }
    if (event.key === 'Enter' && !event.isComposing) {
      event.preventDefault();
      before = null;
      key = null;
      if (engine.submit(now)) input.value = engine.snapshot(now).value;
      else if (snapshot.value) warning('The sentence limit for this run has been reached. Finish this minute, or restart.');
      paint(now);
    } else {
      key = event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey
        ? { key: event.key, time: now, repeat: event.repeat, start: input.selectionStart ?? 0, end: input.selectionEnd ?? 0 } : null;
    }
  });
  input.addEventListener('beforeinput', (event) => {
    const snapshot = paint();
    if (snapshot.state === 'completed' || snapshot.state === 'aborted') { event.preventDefault(); return; }
    before = { value: snapshot.value, start: input.selectionStart ?? 0, end: input.selectionEnd ?? 0, type: event.inputType, data: event.data };
  });
  input.addEventListener('input', (event) => {
    const inputEvent = event as InputEvent;
    const now = performance.now();
    const snapshot = engine.tick(now);
    if (snapshot.state === 'completed' || snapshot.state === 'aborted') {
      input.value = snapshot.value;
      paint(now);
      return;
    }
    const previous = before ?? { value: snapshot.value, start: key?.start ?? 0, end: key?.end ?? 0, type: key ? 'insertText' : '', data: key?.key ?? null };
    const edit = reconstructEdit(previous, input.value);
    const matchedKey = key && edit.text === key.key && edit.text.length === 1;
    engine.edit({ ...edit, tracked: edit.tracked && (!edit.text || Boolean(matchedKey)), pressTime: matchedKey ? key!.time : undefined, repeat: matchedKey ? key!.repeat : false, composing: composing || inputEvent.isComposing }, now);
    const acceptedValue = engine.snapshot(now).value;
    if (input.value !== acceptedValue) input.value = acceptedValue;
    before = null;
    key = null;
    paint(now);
  });
  input.addEventListener('keyup', () => { key = null; });
  input.addEventListener('compositionstart', () => { composing = true; });
  input.addEventListener('compositionend', () => { composing = false; key = null; });
  for (const type of ['paste', 'drop']) input.addEventListener(type, (event) => { event.preventDefault(); warning('Please type the sentence. Pasted or dropped text does not count.'); });
  const interrupt = () => { if (!finished) { engine.interrupt(performance.now()); key = null; before = null; paint(); } };
  input.addEventListener('blur', interrupt);
  window.addEventListener('blur', interrupt);
  document.addEventListener('visibilitychange', () => { if (document.hidden) interrupt(); });
  window.addEventListener('pagehide', () => { clearInterval(timer); if (!finished) engine.abort(performance.now()); });
  window.addEventListener('pageshow', (event) => { if (event.persisted) location.reload(); });
  qwerty.onchange = () => {
    if (engine.state === 'idle') engine = new TypingEngine({ id: crypto.randomUUID(), prompts, mode, corpusVersion: CORPUS_VERSION, qwerty: qwerty.checked });
  };
  $('#restart').onclick = () => {
    if (paint().state === 'completed') return;
    engine.abort(performance.now());
    engine = new TypingEngine({ id: crypto.randomUUID(), prompts: selectPrompts(mode, excluded), mode, corpusVersion: CORPUS_VERSION, qwerty: qwerty.checked });
    input.value = '';
    before = null;
    key = null;
    composing = false;
    lastPromptKey = '';
    $('#exercise-warning').hidden = true;
    paint();
    input.focus();
  };
  timer = setInterval(() => paint(), 100);
  paint();
}

function metricCards(result: SessionResult) {
  const metrics = result.metrics;
  return `<dl class="metrics"><div class="metric"><dt>Words per minute</dt><dd>${format(metrics.wpm)}</dd></div><div class="metric"><dt>Attempt accuracy</dt><dd>${accuracy(metrics.accuracy)}</dd></div><div class="metric"><dt>Correct characters</dt><dd>${metrics.correctCharacters}</dd></div><div class="metric"><dt>Characters deleted</dt><dd>${metrics.deletedCharacters}</dd></div></dl>`;
}

function download(value: unknown, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function drawChart(values: { x: number; y: number }[], container: HTMLElement, maximumX: number) {
  const maximumY = Math.max(20, ...values.map((sample) => sample.y));
  const coordinates = values.map((sample) => `${10 + sample.x / maximumX * 480},${150 - sample.y / maximumY * 130}`).join(' ');
  const points = values.map((sample) => `<circle cx="${10 + sample.x / maximumX * 480}" cy="${150 - sample.y / maximumY * 130}" r="2" fill="currentColor"/>`).join('');
  container.innerHTML = `<svg class="chart" viewBox="0 0 500 170" role="img" aria-label="Speed chart; text summary follows"><path d="M10 20H490 M10 85H490 M10 150H490" stroke="#263345" fill="none"/><polyline points="${coordinates}" fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke"/>${points}</svg>`;
}

async function results() {
  const id = params.get('id');
  if (!id) {
    shell(`<section class="panel empty"><p class="eyebrow">A fresh start</p><h1>Your next result starts here.</h1><p class="lead">Take an assessment, or choose a saved result from your history.</p><div class="actions" style="justify-content:center"><a class="button" href="./practice.html">Start an assessment</a><a class="button secondary" href="./progress.html">View history</a></div></section>`);
    return;
  }
  const result = await getResult(id);
  if (!result) throw new Error('This result is not saved in this browser. It may have been deleted or created on another device.');
  shell(`<div class="page-heading"><div><p class="eyebrow">One minute, well spent</p><h1>A clearer picture of your typing.</h1><p class="small" id="result-date"></p></div><span class="tag">${result.mode === 'assessment' ? 'ASSESSMENT' : 'GENERAL PRACTICE'}</span></div>
    ${result.eligibleForProgress ? '' : '<p class="notice">This run includes interrupted or unsupported input. It is saved here and excluded from headline progress.</p>'}
    ${metricCards(result)}
    <div class="two-col"><section class="panel"><h2>Your pace</h2><p class="small">Cumulative speed through this minute.</p><div id="pace-chart"></div><div class="chart-labels"><span>0 seconds</span><span>60 seconds</span></div><p id="pace-summary" class="small"></p></section>
    <section class="panel"><h2>What went into this result</h2><ul class="list" id="result-detail"></ul><p class="small">Accuracy includes mistakes you corrected. Deleted characters are reported separately.</p></section></div>
    <div class="two-col"><section class="panel"><h2>First attempts by key</h2><p class="small">Errors at the first entry to each position. Corrections do not add opportunities.</p><ul class="list" id="key-errors"></ul></section>
    <section class="panel"><h2>Observed pair timing</h2><p class="small">Typical intervals from fully correct, unedited sentences. These are observations, not predictions.</p><ul class="list" id="pair-times"></ul></section></div>
    <div class="actions"><a class="button" id="retest" href="./practice.html">${result.mode === 'assessment' ? 'Retest with fresh passages' : 'Take an assessment'}</a><a class="button secondary" href="./practice.html?mode=practice">Keep practising</a><button class="button secondary" id="export-result">Export result</button><button class="button secondary danger" id="delete-result">Delete result</button></div>
    <p id="result-status" class="status" role="status"></p>
    <details><summary>How your scores are calculated</summary><p>WPM is the number of matching characters at their prompt positions, divided by five and by one minute. It includes submitted sentences and your final partial response. Accuracy is correct inserted characters divided by all inserted characters; corrections do not erase past mistakes. A timing sample requires a complete, correct first pass, with an interval no longer than five seconds.</p></details>`);
  $('#result-date').textContent = `${date(result.completedAt)} · Saved in this browser`;
  if (result.mode === 'assessment') $<HTMLAnchorElement>('#retest').href = `./practice.html?retest=${encodeURIComponent(result.id)}`;
  renderResultDetails(result);
  $('#export-result').onclick = () => download(result, `typeforge-${result.id}.json`);
  $('#delete-result').onclick = async () => {
    if (!window.confirm('Delete this saved result from this browser? Export it first if you want a copy.')) return;
    try { await deleteResult(result.id); location.assign('./progress.html'); }
    catch { $('#result-status').textContent = 'Deletion failed. Your saved result has not been removed; try again.'; }
  };
}

function addListRow(list: HTMLElement, label: string, value: string, code = false) {
  const row = document.createElement('li');
  const key = document.createElement(code ? 'code' : 'span');
  key.textContent = label;
  const detail = document.createElement('span');
  detail.textContent = value;
  row.append(key, detail);
  list.append(row);
}

function renderResultDetails(result: SessionResult) {
  // These summaries use the exact saved engine output, never sample statistics.
  const detail = $('#result-detail');
  addListRow(detail, 'Inserted characters', String(result.metrics.attemptedCharacters));
  addListRow(detail, 'Correct attempts', String(result.metrics.correctAttempts));
  addListRow(detail, 'Submitted sentences', String(result.sentences.filter((sentence) => sentence.submitted).length));
  addListRow(detail, 'Timing-eligible sentences', String(result.sentences.filter((sentence) => sentence.eligible).length));
  drawChart(result.chartSamples.map((sample) => ({ x: sample.elapsedMs / 1000, y: sample.wpm })), $('#pace-chart'), 60);
  $('#pace-summary').textContent = `Finished at ${format(result.metrics.wpm)} WPM. ${result.chartSamples.length} recorded time point${result.chartSamples.length === 1 ? '' : 's'}; gaps are not estimated.`;
  const keys = new Map<string, { count: number; errors: number }>();
  const pairs = new Map<string, { count: number; logSum: number }>();
  for (const sentence of result.sentences) {
    for (const [key, counts] of Object.entries(sentence.diagnosticsAvailable ? sentence.keys : {})) {
      const sum = keys.get(key) ?? { count: 0, errors: 0 };
      sum.count += counts.firstAttempts;
      sum.errors += counts.firstErrors;
      keys.set(key, sum);
    }
    for (const [pair, counts] of Object.entries(sentence.pairs)) {
      const sum = pairs.get(pair) ?? { count: 0, logSum: 0 };
      sum.count += counts.count;
      sum.logSum += counts.logSum;
      pairs.set(pair, sum);
    }
  }
  [...keys].filter(([, value]) => value.errors > 0).sort((a, b) => b[1].errors - a[1].errors).slice(0, 6)
    .forEach(([key, value]) => addListRow($('#key-errors'), key === ' ' ? 'space' : key, `${value.errors} error${value.errors === 1 ? '' : 's'} / ${value.count} first attempts`, true));
  if (!$('#key-errors').children.length) addListRow($('#key-errors'), result.metrics.accuracy === null ? 'Key diagnostics are unavailable for this run' : 'No first-attempt key errors recorded', '');
  [...pairs].sort((a, b) => Math.exp(b[1].logSum / b[1].count) - Math.exp(a[1].logSum / a[1].count)).slice(0, 6)
    .forEach(([pair, value]) => addListRow($('#pair-times'), pair, `${format(Math.exp(value.logSum / value.count))} ms · ${value.count} observation${value.count === 1 ? '' : 's'}`, true));
  if (!$('#pair-times').children.length) addListRow($('#pair-times'), result.settings.qwerty ? 'No eligible timing observations yet' : 'QWERTY keyboard was not declared for this run', '');
}

async function progress() {
  const history = await listResults();
  shell(`<div class="page-heading"><div><p class="eyebrow">Small steps, saved</p><h1>Your practice, over time.</h1><p class="small">History is saved in this browser. Export it to keep a separate copy.</p></div><a class="button" href="./practice.html">New assessment ↗</a></div>
    <div id="history-content"></div><p id="history-status" class="status" role="status"></p>`);
  if (!history.length) {
    $('#history-content').innerHTML = `<section class="panel empty"><h2>Everyone starts with one minute.</h2><p class="lead">Your completed assessments and practice sessions will appear here.</p><a class="button" href="./practice.html">Take your first assessment</a></section>`;
    return;
  }
  const valid = history.filter((result) => result.mode === 'assessment' && result.eligibleForProgress && result.settings.corpusVersion === CORPUS_VERSION);
  const recent = valid.slice(0, 5);
  $('#history-content').innerHTML = `<section class="panel"><h2>Your assessment trend</h2><p id="trend-summary" class="small"></p><div id="trend-chart"></div></section>
    <div class="page-heading" style="margin-top:32px"><h2>Saved sessions</h2><button id="export-history" class="button secondary">Export history</button></div>
    <div class="panel table-wrap" tabindex="0" aria-label="Saved sessions; scroll horizontally for more columns"><table><caption class="sr-only">Your locally saved typing sessions, newest first</caption><thead><tr><th scope="col">Session</th><th scope="col">Mode</th><th scope="col">WPM</th><th scope="col">Accuracy</th><th scope="col">Status</th></tr></thead><tbody id="history-rows"></tbody></table></div>`;
  $('#trend-summary').textContent = recent.length ? `${format(recent.reduce((sum, result) => sum + result.metrics.wpm, 0) / recent.length)} WPM average across your latest ${recent.length} eligible assessment${recent.length === 1 ? '' : 's'}. Best: ${format(Math.max(...valid.map((result) => result.metrics.wpm)))} WPM. Passage variation affects comparisons.` : 'Complete an uninterrupted assessment to start your trend. Practice sessions stay separate.';
  if (recent.length > 1) drawChart([...recent].reverse().map((result, index) => ({ x: index, y: result.metrics.wpm })), $('#trend-chart'), recent.length - 1);
  for (const result of history) {
    const row = document.createElement('tr');
    const first = document.createElement('td');
    const link = document.createElement('a');
    link.href = `./results.html?id=${encodeURIComponent(result.id)}`;
    link.textContent = date(result.completedAt);
    first.append(link);
    row.append(first);
    for (const value of [result.mode === 'assessment' ? 'Assessment' : 'Practice', format(result.metrics.wpm), accuracy(result.metrics.accuracy), result.eligibleForProgress ? 'Complete' : 'Flagged']) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    }
    $('#history-rows').append(row);
  }
  $('#export-history').onclick = () => download({ exportedAt: new Date().toISOString(), scope: 'this browser only', results: history }, 'typeforge-history.json');
}

try {
  if (page === 'practice') await practice();
  else if (page === 'results') await results();
  else if (page === 'progress') await progress();
  else home();
} catch (error) {
  showError(error instanceof Error ? error.message : 'Browser storage is unavailable. Try again in a browser with local storage enabled.');
}
