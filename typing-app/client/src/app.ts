import './style.css';
import { CORPUS_VERSION, selectPrompts, practicePrompts, assessmentPrompts } from './corpus.ts';
import { TypingEngine, MAX_RESPONSE_LENGTH, type SessionResult, type SentenceSummary } from './engine.ts';
import { saveResult, getResult, listResults, deleteResult, listResultsPage, getStorageDiagnostics } from './storage.ts';

import { parseModelArtifact, predictSentence, type ModelArtifact } from './model.ts';
import { selectHistory, buildHistory, appendHistory, selectPracticeFocus, selectDrillPrompts, resolveRetest } from './profile.ts';

// Optional bundled evidence: a missing artifact must not disable ordinary typing.
const generated = import.meta.glob('./generated/*.json', { eager: true, import: 'default' });
let artifact: ModelArtifact | null = null;
try { artifact = parseModelArtifact(generated['./generated/model.json']); } catch { /* honest no-model state */ }
const settings = (qwerty: boolean): SessionResult['settings'] => ({durationMs: 60000, language: 'en', qwerty, corpusVersion: CORPUS_VERSION});
async function calibration(qwerty: boolean) {
  let sentences: SentenceSummary[] = [];
  let cursor: {completedAt: string; id: string} | null = null;
  const diagnostics: string[] = [];
  if (!qwerty) return {sentences, diagnostics};
  for (;;) {
    let batch: SessionResult[];
    try { batch = await listResultsPage(cursor); }
    catch { diagnostics.push('Browser history is unavailable. This run can still be exported if saving fails.'); break; }
    for (const notice of getStorageDiagnostics()) if (!diagnostics.includes(notice)) diagnostics.push(notice);
    // Pages arrive newest first; each selection is chronological. Keep only ten summaries,
    // never previously scanned sessions or a growing history-wide sort.
    sentences = [...selectHistory(batch, settings(true)), ...sentences].slice(-10);
    if (sentences.length >= 10 || batch.length < 100) break;
    const last = batch.at(-1)!; cursor = {completedAt: last.completedAt, id: last.id};
  }
  return {sentences, diagnostics};
}
function storageNotice(messages: readonly string[]) {
  if (!messages.length) return;
  const notice = document.createElement('p'); notice.className = 'notice';
  notice.textContent = `Some saved evidence could not be read (${messages.length} notice${messages.length === 1 ? '' : 's'}). Invalid records are skipped, not deleted. ${messages.includes('Browser history is unavailable. This run can still be exported if saving fails.') ? 'Browser history is unavailable. You can still type and export this run if saving fails.' : 'Valid history is retained; export it before clearing browser data.'}`;
  $('#main').prepend(notice);
}

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
      <a href="./lab.html" ${page === 'lab' ? 'aria-current="page"' : ''}>ML Lab</a>
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
      <p class="lead">A quiet space to practise typing. Measure your rhythm, find an evidence-backed practice focus, and explore the machine learning behind it.</p>
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
    <div><span class="feature-number">02 / NOTICE THE DETAILS</span><h2>Make every attempt count.</h2><p>Get an explainable practice focus from your observed timing. No supported focus yet? Start with general practice.</p></div>
    <div><span class="feature-number">03 / KEEP SHOWING UP</span><h2>Find your own pace.</h2><p>Retest with fresh passages. Your history stays on this device; the experimental model is open to inspection.</p></div>
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
  let sourceAssessmentId: string | undefined;
  let origin: SessionResult | null = null;
  let lineageMessage = '';
  const originId = params.get('retest') ?? params.get('from');
  if (originId) {
    try { origin = await getResult(originId) ?? null; }
    catch { origin = null; } // Unreadable evidence cannot establish a fresh comparison.
  }
  const declaredQwerty = origin?.settings.qwerty ?? false;
  if (params.has('retest')) {
    const resolved = resolveRetest(origin, settings(declaredQwerty), assessmentPrompts);
    if (resolved.kind === 'retest') { excluded = resolved.excludedPromptIds; sourceAssessmentId = resolved.sourceAssessmentId; }
    else lineageMessage = `New assessment: ${resolved.reason}`;
  } else if (mode === 'practice' && origin?.mode === 'assessment') sourceAssessmentId = origin.id;
  const loaded = await calibration(declaredQwerty);
  let history = loaded.sentences;
  let focus = mode === 'practice' && sourceAssessmentId ? selectPracticeFocus(buildHistory(history), practicePrompts, artifact) : null;
  const choosePrompts = () => mode === 'practice' && focus ? selectDrillPrompts(focus, practicePrompts) : selectPrompts(mode, excluded);
  let prompts = choosePrompts();
  shell(`<div class="page-heading"><div><p class="eyebrow">${mode === 'practice' ? 'Build a little momentum' : 'Find your starting point'}</p><h1>${mode === 'practice' ? 'Just you and the keys.' : 'Your one minute assessment.'}</h1><p id="exercise-intro" class="small">English · lowercase · ${sourceAssessmentId && mode === 'assessment' ? 'fresh assessment passages' : 'short sentences'}</p></div><span class="tag">60 SECOND ${mode === 'practice' ? 'PRACTICE' : 'ASSESSMENT'}</span></div>
  <p class="small"><label><input type="checkbox" id="qwerty" ${declaredQwerty ? 'checked' : ''}> I use a physical QWERTY keyboard</label> · Enables observed pair timing.</p>
  <section class="panel" aria-label="Typing exercise">
    <div class="practice-toolbar"><div class="timer"><output id="remaining">60</output><small> seconds left</small></div><div class="live-metrics"><div><output id="live-wpm">0</output><span>WPM</span></div><div><output id="live-accuracy">—</output><span>ACCURACY</span></div></div></div>
    <progress id="time-progress" value="0" max="60" aria-label="Elapsed time"></progress>
    <div class="typing-surface"><p class="prompt" id="prompt" aria-label="Sentence to copy"></p>
    <label class="field-label" for="typing-input">Type the sentence here</label>
    <input class="typing-input" id="typing-input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="${MAX_RESPONSE_LENGTH}" aria-describedby="typing-help exercise-state" placeholder="Your first character starts the clock…"></div>
    <div class="practice-bottom"><p id="typing-help" class="small"><span class="keycap">enter ↵</span> submit sentence · Backspace to correct</p><button class="button secondary" id="restart" type="button">Restart</button></div>
    <p id="prediction-state" class="small"></p><p id="focus-state" class="small"></p><p id="exercise-state" class="status" role="status">Ready when you are.</p><p id="exercise-warning" class="notice" hidden></p>
  </section>
  <p class="small">The timer keeps running if you leave the field. Interrupted assessments stay in history, outside your headline progress.</p>
  <div id="completion" hidden></div>`);
  storageNotice(loaded.diagnostics);
  const makeEngine = (qwerty: boolean) => new TypingEngine({ id: crypto.randomUUID(), prompts, mode, corpusVersion: CORPUS_VERSION, qwerty, ...(focus ? {practiceFocus: focus} : {}), ...(sourceAssessmentId ? {sourceAssessmentId} : {}) });
  let engine = makeEngine(declaredQwerty);
  function prepare(now = performance.now()) {
    const snapshot = engine.snapshot(now);
    const preparation = qwerty.checked ? predictSentence(snapshot.prompt.text, buildHistory(history), artifact) : null;
    if (preparation?.predictions) engine.setSentencePredictions(snapshot.sentenceIndex, preparation.predictions);
    $('#prediction-state').textContent = !qwerty.checked ? 'Timing predictions require a declared physical QWERTY keyboard.' : preparation?.status === 'candidate-and-baseline' ? 'Experimental model + historical baseline · predictions frozen before each sentence.' : `${preparation?.status === 'baseline-only' ? 'Historical baseline only' : 'Predictions unavailable'}: ${preparation?.reason ?? 'No supported observations yet.'}`;
    $('#focus-state').textContent = lineageMessage || (focus ? `Focus: ${focus.pair} · ${focus.evidenceCount} observations · baseline ${focus.baselineVersion}. Two focused sentences, then one general sentence.` : mode === 'practice' ? 'General practice · no supported targeted focus selected.' : 'Copy each sentence, then press Enter.');
  }
  const input = $<HTMLInputElement>('#typing-input');
  const qwerty = $<HTMLInputElement>('#qwerty');
  let before: PendingEdit | null = null;
  let key: PhysicalKey | null = null;
  let composing = false;
  let finished = false;
  let restarting = false;
  let disposed = false;
  let restartGeneration = 0;
  let timer: ReturnType<typeof setInterval>;
  let lastState = 'idle';
  let lastPromptKey = '';

  function warning(message: string) {
    $('#exercise-warning').hidden = false;
    $('#exercise-warning').textContent = message;
  }
  function paint(now = performance.now()) {
    const snapshot = engine.tick(now);
    qwerty.disabled = restarting || snapshot.state !== 'idle';
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
    if (restarting || disposed) { event.preventDefault(); return; }
    const now = performance.now();
    const snapshot = paint(now);
    if (snapshot.state === 'completed' || snapshot.state === 'aborted') { event.preventDefault(); return; }
    if (event.key === 'Enter' && !event.isComposing) {
      event.preventDefault();
      before = null;
      key = null;
      if (engine.submit(now)) {
        input.value = engine.snapshot(now).value;
        const submitted = engine.submittedSummaries.at(-1);
        if (mode === 'assessment' && submitted?.eligible) history = appendHistory(history, submitted);
        // One event uses one clock value, including preparation and the following paint.
        prepare(now);
      }
      else if (snapshot.value) warning('The sentence limit for this run has been reached. Finish this minute, or restart.');
      paint(now);
    } else {
      key = event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey
        ? { key: event.key, time: now, repeat: event.repeat, start: input.selectionStart ?? 0, end: input.selectionEnd ?? 0 } : null;
    }
  });
  input.addEventListener('beforeinput', (event) => {
    if (restarting || disposed) { event.preventDefault(); return; }
    const snapshot = paint();
    if (snapshot.state === 'completed' || snapshot.state === 'aborted') { event.preventDefault(); return; }
    before = { value: snapshot.value, start: input.selectionStart ?? 0, end: input.selectionEnd ?? 0, type: event.inputType, data: event.data };
  });
  input.addEventListener('input', (event) => {
    if (restarting || disposed) { input.value = ''; return; }
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
  const interrupt = () => { if (!finished && !restarting && !disposed) { engine.interrupt(performance.now()); key = null; before = null; paint(); } };
  input.addEventListener('blur', interrupt);
  window.addEventListener('blur', interrupt);
  document.addEventListener('visibilitychange', () => { if (document.hidden) interrupt(); });
  window.addEventListener('pagehide', () => { disposed = true; restartGeneration++; clearInterval(timer); if (!finished) engine.abort(performance.now()); });
  window.addEventListener('pageshow', (event) => { if (event.persisted) location.reload(); });
  qwerty.onchange = () => {
    if (engine.state !== 'idle' || restarting || disposed) return;
    if (mode === 'assessment' && sourceAssessmentId && origin?.settings.qwerty !== qwerty.checked) {
      sourceAssessmentId = undefined; excluded = []; lineageMessage = 'New assessment: keyboard declaration differs from the origin.';
    }
    $<HTMLButtonElement>('#restart').click();
  };
  $('#restart').onclick = async () => {
    if (restarting || disposed || paint().state === 'completed') return;
    restarting = true;
    const generation = ++restartGeneration;
    clearInterval(timer);
    engine.abort(performance.now());
    input.disabled = true;
    qwerty.disabled = true;
    $<HTMLButtonElement>('#restart').disabled = true;
    before = null; key = null; composing = false;
    $('#exercise-state').textContent = 'Refreshing saved evidence…';
    const loaded = await calibration(qwerty.checked);
    if (disposed || generation !== restartGeneration) return;
    if (params.has('retest')) {
      let refreshedOrigin: SessionResult | null = null;
      try { refreshedOrigin = await getResult(params.get('retest')!) ?? null; }
      catch { /* Unreadable origin is unavailable evidence, not a replacement origin. */ }
      if (disposed || generation !== restartGeneration) return;
      origin = refreshedOrigin;
      const resolved = resolveRetest(origin, settings(qwerty.checked), assessmentPrompts);
      sourceAssessmentId = resolved.kind === 'retest' ? resolved.sourceAssessmentId : undefined;
      excluded = resolved.kind === 'retest' ? resolved.excludedPromptIds : [];
      lineageMessage = resolved.kind === 'retest' ? '' : `New assessment: ${resolved.reason}`;
      $('#exercise-intro').textContent = `English · lowercase · ${resolved.kind === 'retest' ? 'fresh assessment passages' : 'short sentences'}`;
    }
    history = loaded.sentences;
    focus = mode === 'practice' && sourceAssessmentId ? selectPracticeFocus(buildHistory(history), practicePrompts, artifact) : null;
    prompts = choosePrompts();
    engine = makeEngine(qwerty.checked);
    input.value = '';
    lastPromptKey = '';
    lastState = '';
    $('#exercise-warning').hidden = true;
    storageNotice(loaded.diagnostics);
    prepare();
    restarting = false;
    paint();
    input.disabled = false;
    $<HTMLButtonElement>('#restart').disabled = false;
    const activeEngine = engine;
    timer = setInterval(() => { if (!disposed && !restarting && engine === activeEngine) paint(); }, 100);
    input.focus();
  };
  prepare();
  const initialEngine = engine;
  timer = setInterval(() => { if (!disposed && !restarting && engine === initialEngine) paint(); }, 100);
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
  const loaded = await calibration(result.settings.qwerty);
  const focus = selectPracticeFocus(buildHistory(loaded.sentences), practicePrompts, artifact);
  const originId = result.mode === 'assessment' ? result.id : result.sourceAssessmentId;
  const origin = originId ? await getResult(originId) : null;
  const retest = resolveRetest(origin ?? null, settings(result.settings.qwerty), assessmentPrompts);
  shell(`<div class="page-heading"><div><p class="eyebrow">One minute, well spent</p><h1>A clearer picture of your typing.</h1><p class="small" id="result-date"></p></div><span class="tag">${result.mode === 'assessment' ? 'ASSESSMENT' : result.practiceFocus ? 'FOCUSED PRACTICE' : 'GENERAL PRACTICE'}</span></div>
    ${result.eligibleForProgress ? '' : '<p class="notice">This run includes interrupted or unsupported input. It is saved here and excluded from headline progress.</p>'}
    ${metricCards(result)}
    <section class="panel coach"><p class="eyebrow">Your next minute</p><h2 id="coach-title"></h2><p id="coach-explanation" class="small"></p><a class="button" id="next-action" href="./practice.html?mode=practice">Start practice</a></section>
    <p id="origin-comparison" class="small"></p>
    <section class="panel evidence"><h2>Predictions, checked against this run</h2><p class="small">Frozen before each sentence; only matching eligible observations are compared. Experimental predictions do not select your practice focus.</p><ul id="prediction-comparison" class="list"></ul><p class="small">These are geometric mean intervals, not per-keystroke MAE or proof of learning. <a href="./lab.html">Inspect the held-out benchmark →</a></p></section>
    <div class="two-col"><section class="panel"><h2>Your pace</h2><p class="small">Cumulative speed through this minute.</p><div id="pace-chart"></div><div class="chart-labels"><span>0 seconds</span><span>60 seconds</span></div><p id="pace-summary" class="small"></p></section>
    <section class="panel"><h2>What went into this result</h2><ul class="list" id="result-detail"></ul><p class="small">Accuracy includes mistakes you corrected. Deleted characters are reported separately.</p></section></div>
    <div class="two-col"><section class="panel"><h2>First attempts by key</h2><p class="small">Errors at the first entry to each position. Corrections do not add opportunities.</p><ul class="list" id="key-errors"></ul></section>
    <section class="panel"><h2>Observed pair timing</h2><p class="small">Typical intervals from fully correct, unedited sentences. These are observations, not predictions.</p><ul class="list" id="pair-times"></ul></section></div>
    <div class="actions"><a class="button secondary" id="retest" href="./practice.html">${result.mode === 'assessment' ? 'Retest with fresh passages' : 'Take an assessment'}</a><a class="button secondary" href="./practice.html?mode=practice">Keep practising</a><button class="button secondary" id="export-result">Export result</button><button class="button secondary danger" id="delete-result">Delete result</button></div>
    <p id="result-status" class="status" role="status"></p>
    <details><summary>How your scores are calculated</summary><p>WPM is the number of matching characters at their prompt positions, divided by five and by one minute. It includes submitted sentences and your final partial response. Accuracy is correct inserted characters divided by all inserted characters; corrections do not erase past mistakes. A timing sample requires a complete, correct first pass, with an interval no longer than five seconds.</p></details>`);
  $('#result-date').textContent = `${date(result.completedAt)} · Saved in this browser`;
  storageNotice(loaded.diagnostics);
  const next = $<HTMLAnchorElement>('#next-action');
  if (result.mode === 'assessment') {
    $('#coach-title').textContent = focus ? `Practise “${focus.pair}” next.` : 'Build your rhythm with general practice.';
    $('#coach-explanation').textContent = focus ? `${focus.evidenceCount} observed intervals support this focus. Historical baseline ${focus.baselineVersion} ranks it above your typical timing; at least three practice sentences contain this pair. This is a practice hypothesis, not a diagnosis.` : 'No pair currently has enough evidence and a positive supported focus score. General practice is useful without inventing a weakness.';
    next.textContent = focus ? `Practise ${focus.pair}` : 'Start general practice';
    next.href = `./practice.html?mode=practice&from=${encodeURIComponent(result.id)}`;
  } else {
    $('#coach-title').textContent = retest.kind === 'retest' ? 'See how you type on fresh passages.' : 'Set a new assessment baseline.';
    $('#coach-explanation').textContent = retest.kind === 'retest' ? 'Your original assessment is saved. Compare with it on fresh passages; practice scores stay separate.' : `Fresh comparison unavailable: ${retest.reason}`;
    next.textContent = retest.kind === 'retest' ? 'Take a fresh retest' : 'Take a new assessment';
    next.href = retest.kind === 'retest' ? `./practice.html?retest=${encodeURIComponent(retest.sourceAssessmentId)}` : './practice.html';
  }
  const retestLink = $<HTMLAnchorElement>('#retest');
  retestLink.textContent = retest.kind === 'retest' ? 'Retest with fresh passages' : 'New assessment';
  retestLink.href = retest.kind === 'retest' ? `./practice.html?retest=${encodeURIComponent(retest.sourceAssessmentId)}` : './practice.html';
  if (result.mode === 'assessment' && result.sourceAssessmentId) {
    const comparisonOrigin = await getResult(result.sourceAssessmentId);
    const compatible = resolveRetest(comparisonOrigin ?? null, result.settings, assessmentPrompts);
    $('#origin-comparison').textContent = compatible.kind === 'retest' && result.eligibleForProgress && comparisonOrigin ? `Compared with your originating assessment (${date(comparisonOrigin.completedAt)}): ${format(result.metrics.wpm - comparisonOrigin.metrics.wpm)} WPM change; ${accuracy(result.metrics.accuracy)} vs ${accuracy(comparisonOrigin.metrics.accuracy)} accuracy. Passage variation matters; this does not establish a practice effect.` : 'Origin comparison unavailable: the original assessment is missing, incompatible or this retest is flagged.';
  }
  renderPredictionComparison(result);
  renderResultDetails(result);
  $('#export-result').onclick = () => download(result, `typeforge-${result.id}.json`);
  $('#delete-result').onclick = async () => {
    if (!window.confirm('Delete this saved result from this browser? Export it first if you want a copy.')) return;
    try { await deleteResult(result.id); location.assign('./progress.html'); }
    catch { $('#result-status').textContent = 'Deletion failed. Your saved result has not been removed; try again.'; }
  };
}

function renderPredictionComparison(result: SessionResult) {
  const groups = new Map<string, {label: string; count: number; observed: number; baseline: number; candidate: number | null}>();
  let unavailable = 0;
  for (const sentence of result.sentences) {
    const prediction = sentence.prediction;
    if (!prediction) { unavailable++; continue; }
    const identity = `${prediction.baseline.kind}/${prediction.baseline.version}/${prediction.candidate?.modelVersion ?? 'none'}`;
    const group = groups.get(identity) ?? {label: `${prediction.baseline.kind} ${prediction.baseline.version} · ${prediction.candidate ? `experimental ${prediction.candidate.modelVersion}` : 'candidate unavailable'}`, count: 0, observed: 0, baseline: 0, candidate: prediction.candidate ? 0 : null};
    for (const pair of Object.values(prediction.pairs)) {
      group.count += pair.count; group.observed += pair.observedLogSum; group.baseline += pair.baselinePredictedLogSum;
      if (group.candidate !== null) group.candidate += pair.candidatePredictedLogSum!;
    }
    groups.set(identity, group);
  }
  const interval = (sum: number, count: number) => {
    const milliseconds = Math.exp(sum / count);
    return Number.isFinite(sum) && Number.isFinite(count) && count > 0 && Number.isFinite(milliseconds) && milliseconds > 0
      ? `${milliseconds < 0.1 ? milliseconds.toExponential(2) : format(milliseconds)} ms` : 'unavailable (unrepresentable timing evidence)';
  };
  for (const group of groups.values()) addListRow($('#prediction-comparison'), group.label,
    `${group.count} matched observations · observed ${interval(group.observed, group.count)} · baseline ${interval(group.baseline, group.count)}${group.candidate === null ? '' : ` · candidate ${interval(group.candidate, group.count)}`}`);
  addListRow($('#prediction-comparison'), 'Sentences without saved comparisons', String(unavailable));
  if (!groups.size) addListRow($('#prediction-comparison'), 'Not recorded', 'No eligible frozen prediction observations. Legacy predictions are never reconstructed.');
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
  if (result.practiceFocus) {
    addListRow(detail, 'Practice focus', `${result.practiceFocus.pair} · ${result.practiceFocus.evidenceCount} observations · baseline ${result.practiceFocus.baselineVersion}`);
  }
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
    storageNotice(getStorageDiagnostics());
    $('#history-content').innerHTML = `<section class="panel empty"><h2>Everyone starts with one minute.</h2><p class="lead">Your completed assessments and practice sessions will appear here.</p><a class="button" href="./practice.html">Take your first assessment</a></section>`;
    return;
  }
  storageNotice(getStorageDiagnostics());
  const newest = history.find((result) => result.mode === 'assessment' && result.eligibleForProgress && result.settings.corpusVersion === CORPUS_VERSION);
  const valid = history.filter((result) => result.mode === 'assessment' && result.eligibleForProgress && result.metricVersion === 1 && result.settings.corpusVersion === CORPUS_VERSION && result.settings.language === 'en' && result.settings.durationMs === 60000 && result.settings.qwerty === newest?.settings.qwerty);
  const recent = valid.slice(0, 5);
  $('#history-content').innerHTML = `<section class="panel"><h2>Your assessment trend</h2><p id="trend-summary" class="small"></p><div id="trend-chart"></div></section>
    <div class="page-heading" style="margin-top:32px"><h2>Saved sessions</h2><button id="export-history" class="button secondary">Export history</button></div>
    <div class="panel table-wrap" tabindex="0" aria-label="Saved sessions; scroll horizontally for more columns"><table><caption class="sr-only">Your locally saved typing sessions, newest first</caption><thead><tr><th scope="col">Session</th><th scope="col">Mode</th><th scope="col">WPM</th><th scope="col">Accuracy</th><th scope="col">Status</th></tr></thead><tbody id="history-rows"></tbody></table></div>`;
  $('#trend-summary').textContent = recent.length ? `${format(recent.reduce((sum, result) => sum + result.metrics.wpm, 0) / recent.length)} WPM average across your latest ${recent.length} eligible assessment${recent.length === 1 ? '' : 's'}. Best: ${format(Math.max(...valid.map((result) => result.metrics.wpm)))} WPM. Only compatible settings are compared. Passage variation affects comparisons.` : 'Complete an uninterrupted assessment to start your trend. Practice sessions stay separate.';
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

function lab() {
  shell(`<div class="page-heading"><div><p class="eyebrow">Under the surface</p><h1>Machine learning. Open to inspection.</h1><p class="lead">Correct-copy letter-pair timing on English physical QWERTY keyboards. A real model, an honest baseline, and the evidence to tell them apart.</p></div><span class="tag">EXPERIMENTAL · LOCAL INFERENCE</span></div>
    <div id="lab-report"></div>
    <section class="panel evidence"><h2>A small, inspectable architecture</h2><ol class="architecture"><li>Public data → bounded acquisition, checksums and exclusion audit</li><li>Python → participant/text holdouts, chronological history and baseline comparison</li><li>Versioned JSON → linear model evaluated locally in TypeScript</li><li>Native typing → frozen predictions, later observations, local IndexedDB results</li></ol><p class="small">No inference service. No guest keystrokes uploaded. No accounts or cloud synchronization in this local release.</p></section>
    <div class="actions"><a class="button" href="./practice.html">Try an assessment</a><a class="button secondary" href="./index.html">Back to TypeForge</a></div>`);
  const report = generated['./generated/benchmark.json'] as Record<string, unknown> | undefined;
  const target = $('#lab-report');
  if (!artifact || !report || report.modelVersion !== artifact.modelVersion || report.reportVersion !== artifact.provenance.reportVersion) {
    target.innerHTML = '<p class="notice">Benchmark unavailable: a valid, matching model and report are not bundled. Ordinary typing still works; no substitute metrics are shown.</p>'; return;
  }
  // Read optional report fields defensively; every displayed value comes from this paired report.
  const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
  const number = (value: unknown) => finite(value) ? format(value) : 'Unavailable';
  const milliseconds = (value: unknown) => finite(value) ? `${format(value)} ms` : 'Unavailable';
  const words = (value: unknown) => typeof value === 'string' ? value : 'Unavailable';
  const interval = (value: unknown) => Array.isArray(value) && value.length === 2 && value.every(finite) && value[0] <= value[1] ? `[${format(value[0])}, ${format(value[1])}] ms` : 'Unavailable';
  function section(title: string, description?: string) {
    const panel = document.createElement('section'); panel.className = 'panel evidence';
    const heading = document.createElement('h2'); heading.textContent = title; panel.append(heading);
    if (description) { const p = document.createElement('p'); p.className = 'small'; p.textContent = description; panel.append(p); }
    target.append(panel); return panel;
  }
  function rows(panel: HTMLElement, values: [string, string][]) {
    const list = document.createElement('ul'); list.className = 'list';
    for (const [label, value] of values) addListRow(list, label, value);
    panel.append(list);
  }
  const evaluation = object(report.evaluation);
  const slices = object(evaluation.slices);
  const primary = object(slices.primary);
  const primaryAvailable = primary.status === 'available';
  const metric = (slice: Record<string, unknown>, name: string) => slice.status === 'available' ? object(object(slice.metrics)[name]).maeMs : undefined;
  const summary = section('Held-out timing prediction error', 'Primary test: held-out participants, nonreserved text, warm chronological history. Lower participant-macro mean absolute error (MAE) is better. This measures timing prediction, not typing improvement.');
  summary.classList.add('benchmark-summary');
  rows(summary, [
    ['Experimental Ridge', milliseconds(metric(primary, 'ridge'))],
    ['Selected historical baseline', milliseconds(metric(primary, 'selected-baseline'))],
    ['Ridge minus baseline', milliseconds(primaryAvailable ? primary.differenceMs : undefined)],
    ['Paired participant-bootstrap 95% interval', interval(primaryAvailable ? primary.differenceCi95Ms : undefined)],
    ['Primary evidence', primaryAvailable ? `${number(primary.participants)} participants · ${number(primary.observations)} observed transitions` : words(primary.reason)],
  ]);
  summary.querySelector('ul')!.id = 'benchmark-metrics';
  const source = object(report.source);
  const provenance = section('Real data. Explicit boundaries.', `${words(source.name)} · ${words(source.license)}`);
  const links = document.createElement('p'); links.className = 'actions';
  for (const [label, field] of [['Official source data', 'url'], ['Source project & terms', 'termsUrl']]) {
    const value = source[field];
    if (typeof value !== 'string') continue;
    try {
      const url = new URL(value); if (url.protocol !== 'https:') continue;
      const link = document.createElement('a'); link.href = url.href; link.textContent = label; link.className = 'text-link'; links.append(link);
    } catch { /* Invalid source URLs are not presented as clickable evidence. */ }
  }
  provenance.append(links);
  const audit = object(report.audit);
  rows(provenance, [
    ['Acquired participants', number(audit.acquiredParticipants)],
    ['Eligible participants', number(audit.eligibleParticipants)],
    ['Eligible trials / transitions', `${number(audit.eligibleTrials)} / ${number(audit.eligibleObservations)}`],
    ['Shipped model · experimental', artifact.modelVersion],
    ['Paired report', artifact.provenance.reportVersion],
  ]);
  const partitions = section('Who is held out?', 'Participants are separated before model fitting. Reserved prompt fingerprints are excluded from fitting, tuning and every calibration history. Eligible counts below are the nonreserved partition; reserved-text tests are reported separately.');
  const acquiredSplits = object(audit.acquisitionSplits);
  const eligibleSplits = object(audit.splits);
  rows(partitions, ['train', 'validation', 'test'].map(name => {
    const eligible = object(eligibleSplits[name]);
    return [name[0].toUpperCase() + name.slice(1), `${number(acquiredSplits[name])} acquired · ${number(eligible.participants)} eligible participants · ${number(eligible.observations)} transitions`];
  }));
  const exclusions = section('What was excluded?', 'Participant exclusions and trial exclusions use different denominators; they must not be added together. Eligibility is conservative and creates correct-copy selection bias.');
  const units = object(audit.exclusionUnits);
  rows(exclusions, Object.entries(object(audit.exclusions)).filter(([key]) => key !== 'eligible_trial').map(([key, count]) => [key.replaceAll('_', ' '), `${number(count)} ${words(units[key] ?? units.all_other_reasons)}`]));
  const secondary = section('Secondary checks, not a new headline', 'Observation slices are disjoint; a participant can appear in more than one slice. Warm means earlier eligible nonreserved history exists; cold means none. Reserved text never enters calibration history.');
  for (const [name, label] of [['nonreserved-cold', 'Nonreserved text · cold'], ['reserved-warm', 'Unseen reserved text · warm'], ['reserved-cold', 'Unseen reserved text · cold']]) {
    const slice = object(slices[name]);
    rows(secondary, [[label, slice.status === 'available' ? `Ridge ${milliseconds(metric(slice, 'ridge'))} vs baseline ${milliseconds(metric(slice, 'selected-baseline'))} MAE · ${number(slice.participants)} participants / ${number(slice.observations)} transitions · difference 95% interval ${interval(slice.differenceCi95Ms)}` : `Unavailable: ${words(slice.reason)}`]]);
  }
  const ranking = object(evaluation.ranking);
  rows(secondary, [['Pair ranking', ranking.status === 'available' && finite(ranking.meanSpearman) ? `Mean Spearman ${number(ranking.meanSpearman)} · ${number(ranking.participants)} participants` : `Unavailable: requires at least ${number(ranking.minPairObservations)} observations per pair and ${number(ranking.minPairs)} qualifying pairs. ${number(ranking.participants)} participants qualified; ${number(ranking.excludedParticipants)} excluded.`]]);
  const selection = section('Validation chooses. Test data checks.', 'Baseline and regularization are selected only on validation participant-macro MAE. The frozen baseline remains the coach even when the experimental candidate has lower public-data error.');
  const baseline = object(report.selectedBaseline);
  rows(selection, [['Historical baseline', `${words(baseline.kind)} · k=${number(baseline.k)}`], ['Baseline version', words(baseline.version)], ['Ridge regularization α', number(report.selectedAlpha)]]);
  const limits = section('What this does not establish');
  const bullets = document.createElement('ul'); bullets.className = 'lab-bullets';
  for (const limitation of Array.isArray(report.limitations) ? report.limitations : []) {
    if (typeof limitation !== 'string') continue;
    const li = document.createElement('li'); li.textContent = limitation; bullets.append(li);
  }
  limits.append(bullets);
  const reproduction = section('Reproduce the experiment', 'Install the pinned Python environment in ml/requirements.txt first; see ml/README.md for setup, licensing and acquisition bounds. Full training is manual, not part of CI.');
  const commands = document.createElement('pre'); commands.className = 'report-data'; commands.tabIndex = 0; commands.setAttribute('aria-label', 'Experiment reproduction commands');
  commands.textContent = Array.isArray(report.reproduction) ? report.reproduction.filter(value => typeof value === 'string').join('\n') : 'Reproduction commands unavailable.';
  reproduction.append(commands);
  const details = document.createElement('details'); details.className = 'panel evidence';
  const toggle = document.createElement('summary'); toggle.textContent = 'Full generated evidence: baselines, strata, split design, environment and hashes';
  const raw = document.createElement('pre'); raw.className = 'report-data'; raw.tabIndex = 0; raw.setAttribute('aria-label', 'Complete paired benchmark JSON'); raw.textContent = JSON.stringify(report, null, 2);
  details.append(toggle, raw); target.append(details);
}

try {
  if (page === 'practice') await practice();
  else if (page === 'results') await results();
  else if (page === 'progress') await progress();
  else if (page === 'lab') lab();
  else home();
} catch (error) {
  showError(error instanceof Error ? error.message : 'Browser storage is unavailable. Try again in a browser with local storage enabled.');
}
