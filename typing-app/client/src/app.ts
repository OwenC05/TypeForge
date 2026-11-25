import './style.css';
import '@ui-sdk/web/segmented-control';
import '@ui-sdk/web/switch';
import '@ui-sdk/web/collapsible';
import type { UiChangeEvent, UiCollapsibleElement, UiSegmentedControlElement, UiSelectElement, UiSwitchElement } from '@ui-sdk/web';
import { CORPUS_VERSION, selectPrompts } from './corpus.ts';
import { assessmentPrompts, manualPairs, selectAssessmentPrompts, selectPairPrompts } from './corpus-v2.ts';
import { TypingEngine, type SessionResult, type SentenceSummary, SUPPORTED_DURATIONS, type DurationMs } from './engine.ts';
import { getResult, getSavedSource, listSavedSources, deleteResult, listResultsPage, getStorageDiagnostics,
  saveSource, subscribeStorageInvalidation, type Persistence } from './storage.ts';
import { isFiniteSource, type SavedSource, type FinitePracticeResult } from './finite-practice-result.ts';
import { FIT_MIN_SENTENCES, readCoach, type CoachReadout } from './coach.ts';
import { loadPreferences, savePreferences, withRemembered } from './preferences.ts';
import { UnsavedResults, unsavedLine, newSaveRecord, applyOutcome, type SaveRecord } from './unsaved.ts';

import { parseModelArtifact, predictSentence, type ModelArtifact } from './model.ts';
import { selectHistory, buildHistory, appendHistory, resolveRetest, compatible, compatibleSettings } from './profile.ts';

// Optional bundled evidence: a missing artifact must not disable ordinary typing.
const generated = import.meta.glob(['./generated/model.json', './generated/benchmark.json'], { eager: true, import: 'default' });
let artifact: ModelArtifact | null = null;
try { artifact = parseModelArtifact(generated['./generated/model.json']); } catch { /* honest no-model state */ }
const settings = (qwerty: boolean, durationMs: DurationMs = 60000): SessionResult['settings'] => ({durationMs, inputMode: 'flow-v1', language: 'en', qwerty, corpusVersion: CORPUS_VERSION});
function typingHelp(prompt: string, value: string): string {
  const instructions = 'Space advances words; Backspace corrects the current passage. Enter does not advance. Completed passages cannot be edited.';
  for (let index = 0; index < value.length; index++) {
    if (value[index] === prompt[index]) continue;
    const correction = index >= prompt.length ? 'remove the extra character' : `expected ${prompt[index] === ' ' ? 'a space' : JSON.stringify(prompt[index])}`;
    return `${instructions} Correction at character ${index + 1}: ${correction}.`;
  }
  return instructions;
}
function parseDuration(value: string | null, inherited: DurationMs = 60000): {durationMs: DurationMs; reason: string} {
  if (value === null) return {durationMs: inherited, reason: ''};
  const supported = SUPPORTED_DURATIONS.find(duration => String(duration / 1000) === value);
  return supported ? {durationMs: supported, reason: ''} : {durationMs: 60000, reason: 'Unsupported duration. Using 60 seconds.'};
}
function parseQwerty(value: string | null, inherited = false): {qwerty: boolean; reason: string} {
  if (value === null) return {qwerty: inherited, reason: ''};
  if (value === '1' || value === '0') return {qwerty: value === '1', reason: ''};
  return {qwerty: false, reason: 'Unsupported keyboard declaration. Using an undeclared keyboard.'};
}
type PracticeKind = 'general' | 'recommended' | 'manual';
function parsePracticeChoice(kind: string | null, pair: string | null, pairs: readonly string[]): {kind: PracticeKind; pair?: string; reason: string} {
  if (kind === 'manual') {
    if (pair && pairs.includes(pair)) return {kind, pair, reason: ''};
    return {kind: 'general', reason: 'Unsupported manual pair. Using General practice; choose a pair from the supported list.'};
  }
  if (kind === 'recommended') return {kind, reason: ''};
  return {kind: 'general', reason: kind && kind !== 'general' ? 'Unsupported practice choice. Using General practice.' : ''};
}
async function calibration(actualSettings: SessionResult['settings']) {
  let sentences: SentenceSummary[] = [];
  let cursor: {completedAt: string; id: string} | null = null;
  const diagnostics: string[] = [];
  if (!actualSettings.qwerty) return {sentences, diagnostics};
  for (;;) {
    let batch: SessionResult[];
    try { batch = await listResultsPage(cursor); }
    catch { diagnostics.push('Browser history is unavailable. This run can still be exported if saving fails.'); break; }
    for (const notice of getStorageDiagnostics()) if (!diagnostics.includes(notice)) diagnostics.push(notice);
    // Pages arrive newest first; each selection is chronological. Keep only ten summaries,
    // never previously scanned sessions or a growing history-wide sort.
    sentences = [...selectHistory(batch, actualSettings), ...sentences].slice(-10);
    if (sentences.length >= 10 || batch.length < 100) break;
    const last = batch.at(-1)!; cursor = {completedAt: last.completedAt, id: last.id};
  }
  return {sentences, diagnostics};
}
function storageNoticeText(messages: readonly string[]) {
  return `Some saved evidence could not be read (${messages.length} notice${messages.length === 1 ? '' : 's'}). Invalid records are skipped, not deleted. ${messages.includes('Browser history is unavailable. This run can still be exported if saving fails.') ? 'Browser history is unavailable. You can still type and export this run if saving fails.' : 'Valid history is retained; export it before clearing browser data.'}`;
}
// The practice stage routes this notice into its reserved slot so it never pushes the stage down.
let stageNotice: ((message: string) => void) | null = null;
function storageNotice(messages: readonly string[]) {
  if (!messages.length) return;
  if (stageNotice) { stageNotice(storageNoticeText(messages)); return; }
  const notice = document.createElement('p'); notice.className = 'notice';
  notice.textContent = storageNoticeText(messages);
  $('#main').prepend(notice);
}

const app = document.querySelector<HTMLDivElement>('#app')!;
const page = document.body.dataset.page;
const params = new URLSearchParams(location.search);
const format = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 1 });
const accuracy = (value: number | null) => value === null ? '—' : `${format(value)}%`;
const date = (value: string) => new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;

function shell(content: string, layout: {stage?: boolean} = {}) {
  const here = page === 'home' || (page === 'practice' && params.get('mode') === 'practice') ? 'practice' : page === 'practice' ? 'assessment' : page;
  const links = [['practice', './index.html'], ['assessment', './practice.html'], ['progress', './progress.html'], ['lab', './lab.html']]
    .map(([name, href]) => `<a href="${href}" ${here === name ? 'aria-current="page"' : ''}>${name}</a>`).join('');
  app.innerHTML = `<header class="topbar">
    <a class="brand" href="./index.html"><span class="brand-mark" aria-hidden="true">t_</span><span class="brand-name">typeforge</span></a>
    <nav class="site-nav" aria-label="Main navigation">${links}</nav>
    <ui-collapsible class="nav-menu" id="nav-menu">
      <ui-collapsible-trigger><button type="button" class="key key-small">menu</button></ui-collapsible-trigger>
      <ui-collapsible-panel class="nav-menu-panel" keep-mounted hidden><nav aria-label="Main navigation">${links}</nav></ui-collapsible-panel>
    </ui-collapsible>
  </header><main id="main" class="${layout.stage ? 'main-stage' : 'main-page'}">${content}</main>
  <footer class="site-footer"><p>Results stay in this browser.</p></footer>`;
}

function showError(message: string) {
  shell(`<section class="page-intro"><p class="micro">Something needs attention</p><h1>We could not load this page.</h1><p id="error" class="lead"></p><a class="key key-primary" href="./index.html">Back to practice</a></section>`);
  $('#error').textContent = message;
}

// `/` is practice itself: no hero, welcome or setup step on first or later visits.
async function home() {
  const requested = new URLSearchParams(location.search);
  requested.set('mode', 'practice');
  await practice(requested, {home: true});
}

// Focus the user moves while the stage is being prepared must never be taken back.
let preparationFocusMoved = false;
document.addEventListener('focusin', () => { preparationFocusMoved = true; });

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

const esc = (text: string) => text.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const ended = (state: string) => state === 'completed' || state === 'aborted' || state === 'stopped';

const speedWpm = (speed: number) => Math.round(12000 / Math.exp(speed));
const gapPercent = (gap: number) => Math.round(100 * Math.expm1(gap)) || 'less than 1';
const speedNote = 'The model learned from typing at about 32 to 150 WPM. At this speed it extrapolates. The fit check decides whether those expectations hold.';

type StageOptions = { home?: boolean };

async function practice(requested: URLSearchParams = new URLSearchParams(location.search), options: StageOptions = {}) {
  const mode = requested.get('mode') === 'practice' ? 'practice' : 'assessment';
  // Remembered values only fill settings the URL leaves absent; layout never feeds prompt choice.
  const params = withRemembered(requested, mode, loadPreferences());
  let excluded: string[] = [];
  let sourceAssessmentId: string | undefined;
  let origin: SessionResult | null = null;
  let lineageMessage = '';
  const originId = params.get('retest') ?? params.get('from');
  if (originId) {
    try { origin = await getResult(originId) ?? null; }
    catch { origin = null; } // Unreadable evidence cannot establish a fresh comparison.
  }
  const parsedQwerty = parseQwerty(params.get('qwerty'), origin?.settings.qwerty);
  const declaredQwerty = parsedQwerty.qwerty;
  const parsedDuration = parseDuration(params.get('duration'), origin?.settings.durationMs);
  let durationMs = parsedDuration.durationMs;
  if (params.has('retest')) {
    const resolved = resolveRetest(origin, settings(declaredQwerty, durationMs), assessmentPrompts);
    if (resolved.kind === 'retest') { excluded = resolved.excludedPromptIds; sourceAssessmentId = resolved.sourceAssessmentId; }
    else lineageMessage = `New assessment: ${resolved.reason}`;
  } else if (mode === 'practice' && origin?.mode === 'assessment' && origin.eligibleForProgress && compatible(origin, settings(declaredQwerty, durationMs))) sourceAssessmentId = origin.id;
  // Optional saved evidence loads after the stage is ready; General practice never waits for it.
  let history: SentenceSummary[] = [];
  let historyKey = `${declaredQwerty}|${durationMs}`;
  let practiceChoice = parsePracticeChoice(params.get('practice'), params.get('pair'), manualPairs);
  let coach: CoachReadout | null = null;
  let suggestedPair: string | null = null;
  const wantsSuggested = () => mode === 'practice' && practiceChoice.kind === 'recommended';
  const choosePrompts = () => {
    if (suggestedPair) return selectPairPrompts(suggestedPair);
    if (mode === 'assessment') return selectAssessmentPrompts(excluded);
    if (practiceChoice.kind === 'manual') return selectPairPrompts(practiceChoice.pair!);
    return selectPrompts('practice');
  };
  let prompts = choosePrompts();
  const initialPair = practiceChoice.pair ?? 'th';
  shell(`<h1 class="sr-only">${mode === 'practice' ? 'Practice' : 'Assessment'}</h1>
  <div class="column">
  <section class="rail" id="rail" aria-label="${mode === 'practice' ? 'Practice' : 'Assessment'} settings">
    <div class="rail-group">
      <ui-segmented-control id="duration" class="keys" aria-label="Duration in seconds" default-value="${durationMs / 1000}">
        ${SUPPORTED_DURATIONS.map(value => `<ui-segmented-control-item value="${value / 1000}">${value / 1000}</ui-segmented-control-item>`).join('')}
      </ui-segmented-control><span class="unit" aria-hidden="true">s</span>
    </div>
    ${mode === 'practice' ? `<span class="rail-rule" aria-hidden="true"></span>
    <div class="rail-group">
      <ui-segmented-control id="practice-kind" class="keys" aria-label="Practice" default-value="${practiceChoice.kind}">
        <ui-segmented-control-item value="general">general</ui-segmented-control-item>
        <ui-segmented-control-item value="manual">pair</ui-segmented-control-item>
        <ui-segmented-control-item value="recommended" id="suggested-item">suggested</ui-segmented-control-item>
      </ui-segmented-control>
      <ui-select id="manual-pair" class="pair-select" default-value="${initialPair}" ${practiceChoice.kind === 'manual' ? '' : 'hidden'}>
        <ui-select-label class="sr-only">Pair</ui-select-label>
        <ui-select-trigger><button type="button" class="key"><ui-select-value>${initialPair}</ui-select-value><span class="caret-glyph" aria-hidden="true">▾</span></button></ui-select-trigger>
        <ui-select-content class="pair-list"></ui-select-content>
      </ui-select>
    </div>` : ''}
    <span class="rail-rule" aria-hidden="true"></span>
    <ui-switch id="qwerty" class="key key-toggle" aria-label="Physical QWERTY keyboard" ${declaredQwerty ? 'default-checked' : ''}><span aria-hidden="true">qwerty</span><ui-switch-thumb></ui-switch-thumb></ui-switch>
  </section>
  <p id="settings-status" class="sr-only"></p>
  <p id="today-summary" class="micro today"></p>
  <section class="stage" id="stage" aria-label="Typing exercise" data-state="idle" data-focus="out" data-mode="${mode}">
    <div class="run-line">
      <span class="countdown" id="remaining" role="timer" aria-label="Seconds left">${durationMs / 1000}</span>
      <p class="micro block-label" id="block-identity"></p>
      <ui-collapsible class="why" id="why">
        <ui-collapsible-trigger><button type="button" class="text-button">why?</button></ui-collapsible-trigger>
        <ui-collapsible-panel class="why-panel" keep-mounted hidden>
          <p id="focus-state"></p><div id="coach-why"></div>
          <p id="exercise-intro">English · lowercase · ${sourceAssessmentId && mode === 'assessment' ? 'fresh assessment passages' : 'short sentences'}</p><p id="prediction-state"></p>
          <p>The timer keeps running if you leave the text. Interrupted runs stay in history, outside headline progress.</p>
        </ui-collapsible-panel>
      </ui-collapsible>
    </div>
    <label class="sr-only" for="typing-input">Type the passage</label>
    <p id="target-description" class="sr-only"></p>
    <p id="typing-help" class="sr-only">Space advances words; Backspace corrects the current passage. Enter does not advance. Completed passages cannot be edited.</p>
    <div class="surface-wrap">
      <div class="stage-cover"><button class="key key-primary" id="continue-typing" type="button">start typing ↵</button></div>
      <div class="typing-surface" id="typing-viewport">
        <p id="previous-prompt" class="passage-context" aria-hidden="true"></p>
        <div class="active-passage"><div class="prompt" id="prompt" aria-hidden="true"></div>
          <textarea class="typing-input" id="typing-input" rows="1" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="target-description typing-help"></textarea>
        </div><p id="next-prompt" class="passage-context" aria-hidden="true"></p>
      </div>
    </div>
    <div class="slot-row">
      <div class="slot" id="slot" role="status" aria-live="polite"><div class="carried" id="carried" hidden></div><p id="exercise-warning" class="slot-text"></p></div>
      <button class="key" id="restart" type="button">restart</button>
    </div>
    <p class="foot-hints"><kbd>space</kbd> next<span class="wide-only"> passage</span> · <kbd>backspace</kbd> fix<span class="wide-only"> · <kbd>tab</kbd> <kbd>enter</kbd> restart</span></p>
    <p id="exercise-state" class="sr-only" role="status">Ready when you are.</p>
    <div id="completion" class="completion" hidden></div>
  </section>
  </div>`, {stage: true});
  const makeEngine = (qwerty: boolean) => new TypingEngine({
    id: crypto.randomUUID(), prompts, mode, durationMs, inputMode: 'flow-v1', corpusVersion: CORPUS_VERSION, qwerty,
    ...(mode === 'practice' && practiceChoice.kind === 'manual' ? { manualDrill: { pair: practiceChoice.pair!, source: 'manual' as const } } : {}),
    ...(suggestedPair ? { practiceFocus: { source: 'model' as const, pair: suggestedPair } } : {}),
    ...(sourceAssessmentId ? { sourceAssessmentId } : {}),
  });
  let engine = makeEngine(declaredQwerty);
  let prepAbort: AbortController | null = null;
  let coachFresh = false;
  let coachMessage = '';
  let fallbackForBlock = false;
  let frozen: { label: string } | null = null;

  // Predictions freeze once per sentence. Late evidence re-runs prepare() for labels; it refines
  // predictions from the next sentence and never re-freezes one already shown.
  const prepared = new WeakMap<TypingEngine, {sentenceIndex: number; preparation: ReturnType<typeof predictSentence> | null}>();
  function prepare(now = performance.now()) {
    const snapshot = engine.snapshot(now);
    const earlier = prepared.get(engine);
    const preparation = earlier?.sentenceIndex === snapshot.sentenceIndex ? earlier.preparation
      : qwerty.checked ? predictSentence(snapshot.prompt.text, buildHistory(history), artifact) : null;
    if (earlier?.sentenceIndex !== snapshot.sentenceIndex) {
      if (preparation?.predictions) engine.setSentencePredictions(snapshot.sentenceIndex, preparation.predictions);
      prepared.set(engine, {sentenceIndex: snapshot.sentenceIndex, preparation});
    }
    $('#prediction-state').textContent = !qwerty.checked ? 'Timing predictions require a declared physical QWERTY keyboard.' : preparation?.status === 'candidate-and-baseline' ? 'Experimental model + historical baseline · predictions frozen before each sentence.' : `${preparation?.status === 'baseline-only' ? 'Historical baseline only' : 'Predictions unavailable'}: ${preparation?.reason ?? 'No supported observations yet.'}`;
    $('#focus-state').textContent = [lineageMessage, practiceChoice.reason, mode === 'practice' && practiceChoice.kind === 'manual' ? `You chose the pair ${practiceChoice.pair}. Every sentence in this block contains it.` : mode === 'assessment' ? 'Keep typing; a space after the last word brings the next passage.' : ''].filter(Boolean).join(' ');
    // Observed facts only: the current choice, never an invented target.
    const label = `${frozen?.label ?? blockIdentity()} · ${durationMs / 1000} s`;
    const displayLabel = label.replaceAll(' · ', ' · ');
    if ($('#block-identity').textContent !== displayLabel) $('#block-identity').textContent = displayLabel;
    if ($('#remaining').textContent !== String(Math.ceil(snapshot.remainingMs / 1000))) $('#remaining').textContent = String(Math.ceil(snapshot.remainingMs / 1000));
    stage.dataset.bankVersion = mode === 'assessment' || practiceChoice.kind === 'manual' || suggestedPair ? '2' : '1';
    stage.dataset.longPair = String((practiceChoice.kind === 'manual' || !!suggestedPair) && prompts.some(prompt => prompt.text.length > 49));
    stage.dataset.promptIds = prompts.map(prompt => prompt.id).join(' ');
  }
  const input = $<HTMLTextAreaElement>('#typing-input');
  const qwerty = $<UiSwitchElement>('#qwerty');
  const duration = $<UiSegmentedControlElement>('#duration');
  const practiceKind = mode === 'practice' ? $<UiSegmentedControlElement>('#practice-kind') : null;
  const manualPair = mode === 'practice' ? $<UiSelectElement>('#manual-pair') : null;
  const stage = $('#stage');
  const why = $<UiCollapsibleElement>('#why');
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
  let previousPromptText = '';
  let previousResponse = '';
  let committedKey = '';
  let undoUsed = false;
  let repeatRequested = false;

  function blockIdentity() {
    if (mode === 'assessment') return sourceAssessmentId ? 'Fresh retest' : 'Assessment';
    if (practiceChoice.kind === 'manual') return `Pair practice · ${practiceChoice.pair}`;
    return suggestedPair ? `Suggested practice · ${suggestedPair}` : 'General practice';
  }
  function freezeRun() {
    prepAbort?.abort();
    return frozen = { label: blockIdentity() };
  }

  // ET-1: completed sources whose save is not confirmed stay recoverable on this page (src/unsaved.ts).
  // Same-page continuation adopts the current record; leaving the page holds once while any remain.
  let currentSave: SaveRecord | null = null;
  let leavingTo: string | null = null;
  let leaveConfirmed = false;
  const unsaved = new UnsavedResults({ save: saveSource, onChange: () => renderUnsaved() });
  function carryUnsaved() { const record = currentSave; currentSave = null; unsaved.adopt(record); }
  // One line in the reserved slot, above any other message (highest priority), fixed slot height.
  function renderUnsaved() {
    if (disposed) return;
    const line = $('#carried');
    const atRisk = unsaved.atRisk(currentSave);
    if (leavingTo && !atRisk.length) leavingTo = null; // everything saved while held: nothing to lose
    const list = leavingTo ? atRisk : unsaved.listed;
    const text = unsavedLine(list, unsaved.retrying, Boolean(leavingTo));
    const canRetry = !leavingTo && !unsaved.retrying && list.some(entry => entry.state === 'failed');
    const renderKey = `${leavingTo ?? ''}|${text}|${canRetry}`;
    // Static during a run (never focusable, never steals focus) unless the person asked to leave.
    line.inert = engine.state === 'running' && !leavingTo;
    line.toggleAttribute('data-leaving', Boolean(leavingTo));
    if (line.dataset.key === renderKey) return;
    line.dataset.key = renderKey;
    const hadFocus = line.contains(document.activeElement);
    line.hidden = !text;
    if (!text) {
      line.replaceChildren();
      if (hadFocus) returnFocus();
      return;
    }
    line.innerHTML = `<span class="carried-text"></span>${leavingTo ? '' : `<button type="button" class="key key-small" data-act="retry"${canRetry ? '' : ' disabled'}>retry save</button>`}`
      + `<button type="button" class="key key-small" data-act="export">export</button>`
      + `<button type="button" class="key key-small" data-act="${leavingTo ? 'leave' : 'discard'}">${leavingTo ? 'leave without saving' : 'discard'}</button>`;
    line.querySelector('.carried-text')!.textContent = text;
    if (hadFocus) line.querySelector<HTMLButtonElement>(leavingTo ? '[data-act="export"]' : '[data-act="retry"]:not(:disabled), [data-act="export"]')?.focus();
  }
  $('#carried').addEventListener('click', event => {
    const act = (event.target as Element | null)?.closest<HTMLButtonElement>('button[data-act]')?.dataset.act;
    if (!act || disposed) return;
    if (act === 'retry') void unsaved.retry();
    else if (act === 'export') {
      const list = leavingTo ? unsaved.atRisk(currentSave) : [...unsaved.listed];
      download(list.map(entry => entry.source), `typeforge-unsaved-${list.length}-results.json`);
      for (const entry of list) entry.exported = true;
      $('#carried').dataset.key = '';
      renderUnsaved();
    } else if (act === 'discard') unsaved.discard();
    else if (act === 'leave' && leavingTo) { const destination = leavingTo; leavingTo = null; leaveConfirmed = true; location.assign(destination); }
  });
  // Leaving the page loses the in-memory list, so while any result is unsaved the first in-app
  // navigation is held: the slot line explains, Export takes focus, and leaving is a second choice.
  document.addEventListener('click', event => {
    if (disposed || leaveConfirmed || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (!link || (link.target && link.target !== '_self') || link.hasAttribute('download')) return;
    const destination = new URL(link.href, location.href);
    if (destination.origin !== location.origin || (destination.pathname === location.pathname && destination.search === location.search && destination.hash)) return;
    if (!unsaved.atRisk(currentSave).length) return;
    event.preventDefault();
    if (currentSave) currentSave.onSettled ??= () => renderUnsaved();
    leavingTo = destination.href;
    renderUnsaved();
    $<HTMLButtonElement>('#carried [data-act="export"]').focus();
  }, true);
  // Returning to the passage cancels a held departure; the line becomes static again during a run.
  input.addEventListener('focus', () => { if (leavingTo) { leavingTo = null; renderUnsaved(); } });
  function returnFocus() {
    if (document.activeElement && document.activeElement !== document.body) return;
    if (finished) document.querySelector<HTMLElement>('#result-actions .key-primary')?.focus();
    else if (!input.disabled) input.focus();
  }

  // Reserved feedback slot. Levels: 1 transient hint, 2 integrity/Undo notice, 3 safety stop.
  // Its height is fixed, so showing, replacing or clearing a message never moves the stage.
  function warning(message: string, level = 1) {
    const text = $('#exercise-warning');
    if (level < slotLevel && text.textContent) return;
    slotLevel = level;
    hintMark = '';
    text.hidden = false;
    text.className = `slot-text ${level === 1 ? 'is-hint' : 'is-notice'}`;
    // Unchanged text is never rewritten, so the polite region announces each message once.
    if (text.textContent !== message) text.textContent = message;
  }
  let slotLevel = 0;
  let hintMark = '';
  function clearSlot() {
    slotLevel = 0;
    hintMark = '';
    $('#exercise-warning').textContent = '';
  }
  function setRunState(state: string) {
    stage.dataset.state = state;
    document.body.dataset.run = stage.dataset.state;
    const running = state === 'running';
    // Why? is visibly unavailable while typing: not focusable, never an inert-looking active link.
    why.toggleAttribute('disabled', running);
    why.inert = running;
    if (running && why.open) why.api.close();
    $('#continue-typing').textContent = running ? 'continue typing ↵' : 'start typing ↵';
    $('#carried').inert = running && !leavingTo;
  }
  // Focus moves to the native input only from neutral focus or the control that asked for it.
  function mayFocusInput() {
    const active = document.activeElement;
    return !active || active === document.body || active === stage || active === input || ['restart', 'again', 'continue-typing'].includes(active.id);
  }
  function paint(now = performance.now()) {
    const snapshot = engine.tick(now);
    const remaining = String(Math.ceil(snapshot.remainingMs / 1000));
    if ($('#remaining').textContent !== remaining) $('#remaining').textContent = remaining;
    const start = input.selectionStart ?? snapshot.value.length;
    const end = input.selectionEnd ?? start;
    const caret = input.selectionDirection === 'backward' ? start : end;
    const promptKey = `${snapshot.sentenceIndex}:${snapshot.value}:${start}:${end}:${caret}`;
    if (lastPromptKey !== promptKey) {
      const prompt = $('#prompt');
      prompt.replaceChildren();
      $('#target-description').textContent = `Passage to copy: ${snapshot.prompt.text}`;
      $('#typing-help').textContent = typingHelp(snapshot.prompt.text, snapshot.value);
      if (committedKey !== `${previousPromptText}\u0000${previousResponse}`) {
        renderCommitted($('#previous-prompt'), previousPromptText, previousResponse);
        committedKey = `${previousPromptText}\u0000${previousResponse}`;
      }
      $('#next-prompt').textContent = engine.nextPrompt.text;
      // Mirror the actual response, not target offsets: extra letters and native
      // selections must wrap at exactly the same positions as the textarea.
      const displayed = snapshot.value + snapshot.prompt.text.slice(snapshot.value.length);
      let mismatch: HTMLElement | null = null;
      let expected = '';
      for (let index = 0; index <= displayed.length; index++) {
        const span = document.createElement('span');
        span.textContent = displayed[index] ?? '​';
        const wrong = index < snapshot.value.length && snapshot.value[index] !== snapshot.prompt.text[index];
        span.className = [index < snapshot.value.length ? (wrong ? 'wrong' : 'correct') : '',
          index >= start && index < end ? 'selected' : '', index === caret ? 'cursor' : ''].filter(Boolean).join(' ');
        if (wrong && !mismatch) {
          // Lowest positional mismatch only; no edit-distance alignment is inferred.
          mismatch = span;
          expected = index >= snapshot.prompt.text.length ? 'extra' : snapshot.prompt.text[index] === ' ' ? '␣' : snapshot.prompt.text[index]!;
          span.classList.add('first-mismatch');
          span.dataset.expected = expected;
        }
        prompt.append(span);
      }
      lastPromptKey = promptKey;
      // A transient hint clears at the next accepted insertion or passage commit, not on caret moves.
      const mark = `${snapshot.sentenceIndex}:${snapshot.value.length}`;
      if (slotLevel === 1) {
        if (!hintMark) hintMark = mark;
        else {
          const [markSentence, markLength] = hintMark.split(':').map(Number);
          if (snapshot.sentenceIndex !== markSentence || snapshot.value.length > markLength!) clearSlot();
        }
      }
      const marker = prompt.querySelector<HTMLElement>('.cursor');
      const viewport = $('#typing-viewport');
      if (marker) {
        // One read batch inside the existing forced layout: caret, viewport and mismatch
        // rectangles are read before any write, so the cue adds no extra layout pass.
        const markerRect = marker.getBoundingClientRect();
        const viewRect = viewport.getBoundingClientRect();
        const mismatchRect = mismatch?.getBoundingClientRect();
        const scrolled = viewport.scrollTop;
        const viewHeight = viewport.clientHeight;
        const top = markerRect.top - viewRect.top + scrolled;
        const nextScroll = Math.max(0, top - viewHeight / 2);
        viewport.scrollTop = nextScroll;
        if (mismatch && mismatchRect && mismatch !== marker) {
          const mismatchTop = mismatchRect.top - viewRect.top + scrolled;
          const sameLine = Math.abs(mismatchRect.top - markerRect.top) < markerRect.height / 2;
          const visible = mismatchTop >= nextScroll && mismatchTop + mismatchRect.height <= nextScroll + viewHeight;
          if (!sameLine || !visible) {
            marker.dataset.pointer = `↶ earlier error · expected ${expected}`;
            marker.classList.add(markerRect.left - viewRect.left > viewRect.width / 2 ? 'pointer-left' : 'pointer-right');
          }
        }
      }
      input.scrollTop = 0;
    }
    if (snapshot.state !== lastState) {
      $('#exercise-state').textContent = snapshot.state === 'running' ? 'Timer running. Keep typing; Space advances the passage.' : snapshot.state === 'completed' ? 'Time is up. Your result is ready.' : 'Ready when you are.';
      lastState = snapshot.state;
      setRunState(snapshot.state);
    }
    if (snapshot.state !== 'stopped' && snapshot.qualityFlags.length) warning(integrityCopy(snapshot.qualityFlags, undoUsed), 2);
    if (snapshot.state === 'completed' && !finished) void finish();
    if (snapshot.state === 'stopped' && !finished) {
      finished = true;
      clearInterval(timer);
      before = null; key = null;
      input.value = snapshot.value;
      input.readOnly = true;
      const diagnostic = engine.stoppedSnapshot();
      $('#exercise-state').textContent = 'Session safety limit reached. Export the partial diagnostic or restart.';
      warning(`Stopped safely: ${diagnostic?.stopReason}. This partial run is not a completed result and will not be saved to progress.`, 3);
      const completion = $('#completion');
      completion.hidden = false;
      completion.innerHTML = '<button id="export-stopped" class="key">export partial diagnostic</button>';
      $('#export-stopped').onclick = () => download(diagnostic, `typeforge-stopped-${diagnostic?.id}.json`);
    }
    return snapshot;
  }

  function installPair(pair: string | null) {
    if (pair === suggestedPair) return;
    suggestedPair = pair;
    prompts = choosePrompts();
    engine = makeEngine(qwerty.checked);
    lastPromptKey = ''; previousPromptText = ''; previousResponse = '';
    prepare(); paint(); startTimer(); loadEvidence();
  }
  function showCoach() {
    if (!wantsSuggested()) { $('#coach-why').replaceChildren(); return; }
    const focus = coach?.focus;
    let reason = coachMessage;
    if (!qwerty.checked) reason = 'Suggested needs a physical QWERTY keyboard. This block is general.';
    else if (!reason && coach) {
      if (coach.fit.stopped) reason = 'The model’s expectations don’t fit your recent typing.';
      else if (focus) reason = `Your <strong>${focus.pair}</strong> is about ${gapPercent(focus.gap)}% slower than expected at your speed, from ${focus.count} timings.`;
      else reason = coach.hasEvidence ? 'Your saved timings don’t show a clear pair yet.' : 'No saved timings yet, so this block is general.';
    }
    $('#coach-why').innerHTML = `<p>${reason}</p>${qwerty.checked && coach?.outside ? `<p>${speedNote}</p>` : ''}<p><a href="./lab.html">See your timings in the Lab</a></p>`;
    if (!finished && engine.state === 'idle' && slotLevel <= 1) {
      warning('', 1);
      $('#exercise-warning').innerHTML = reason;
    }
  }
  async function refreshSuggestion(waitForSelection = false) {
    prepAbort?.abort();
    if (!wantsSuggested() || !qwerty.checked || fallbackForBlock || finished || restarting || engine.state !== 'idle') {
      showCoach();
      return;
    }
    const controller = new AbortController();
    prepAbort = controller;
    coachFresh = false;
    coachMessage = 'Checking your saved timings…';
    if (waitForSelection) input.disabled = true;
    showCoach();
    let next: CoachReadout | null = null;
    try { next = await readCoach(controller.signal); } catch { /* A failed read leaves General available. */ }
    if (controller.signal.aborted || disposed || finished || engine.state !== 'idle') return;
    coach = next;
    coachFresh = true;
    coachMessage = next ? '' : 'Saved timings are unavailable, so this block is general.';
    installPair(next?.focus?.pair ?? null);
    const restoreFocus = input.disabled && mayFocusInput();
    input.disabled = false;
    if (restoreFocus) input.focus();
    showCoach();
  }

  function startTimer() {
    clearInterval(timer);
    const activeEngine = engine;
    timer = setInterval(() => { if (!disposed && !restarting && engine === activeEngine) paint(); }, 100);
  }
  const unsubscribe = subscribeStorageInvalidation(() => {
    if (disposed || !wantsSuggested() || engine.state !== 'idle' || restarting || finished || fallbackForBlock) return;
    void refreshSuggestion();
  });

  // Completed results keep their own save and recovery state.

  function afterResultRendered() {
    const again = document.getElementById('again');
    if (again) again.onclick = () => { repeatRequested = true; void $('#restart').onclick?.(new PointerEvent('click')); };
    // The primary action takes focus only from neutral focus (the disabled input hands focus to body).
    if (mayFocusInput()) document.querySelector<HTMLElement>('#result-actions .key-primary')?.focus();
  }
  function actionKeys(primary: { id: string; label: string; href?: string }, secondary: { id: string; label: string; href?: string } | null, note = '') {
    const key = (action: { id: string; label: string; href?: string }, className: string, enter: boolean) => action.href
      ? `<a class="${className}" id="${action.id}" href="${action.href}">${esc(action.label)}${enter ? ' ↵' : ''}</a>`
      : `<button class="${className}" id="${action.id}" type="button">${esc(action.label)}${enter ? ' ↵' : ''}</button>`;
    return `${key(primary, 'key key-primary', true)}${secondary ? key(secondary, 'key', false) : ''}${note ? `<span class="action-note">${esc(note)}</span>` : ''}`;
  }
  function paintResultActions(source: SessionResult) {
    const query = `duration=${durationMs / 1000}&qwerty=${qwerty.checked ? '1' : '0'}`;
    if (mode === 'assessment') {
      const retest = resolveRetest(source, source.settings, assessmentPrompts);
      const fresh = retest.kind === 'retest';
      $('#result-actions').innerHTML = actionKeys({ id: 'practice-next', label: 'practise', href: `./index.html?mode=practice&${query}${source.eligibleForProgress ? `&from=${source.id}` : ''}` },
        { id: 'retest-next', label: fresh ? 'fresh retest' : 'new assessment', href: `./practice.html?${fresh ? `retest=${source.id}&` : ''}${query}` });
    } else {
      $('#result-actions').innerHTML = actionKeys({ id: 'again', label: 'again' }, null, 'same settings, new sentences');
    }
  }

  // Today's bounded activity line: optional, never blocks the result or the next block.
  function refreshToday(saved?: SessionResult) {
    void todayActivity().then(activity => {
      if (disposed) return;
      if (saved && !activity.complete) countActivity(activity, saved);
      // Shown above the result only (DESIGN.md); its space is reserved there, so filling it moves nothing.
      $('#today-summary').textContent = `${todayText(activity)} · ${Intl.DateTimeFormat().resolvedOptions().timeZone || 'local time'}`;
    }, () => { /* Unreadable history hides the line; typing is unaffected. */ });
  }

  async function finish() {
    finished = true;
    clearInterval(timer);
    before = null;
    key = null;
    input.value = engine.snapshot(performance.now()).value;
    input.disabled = true;
    $<HTMLButtonElement>('#restart').disabled = true;
    const source = engine.result(new Date().toISOString());
    if (!source) return;
    const identity = frozen ?? freezeRun();
    // The result replaces the passage in place and stays readable even if IndexedDB is unavailable.
    const completion = $('#completion');
    completion.hidden = false;
    completion.innerHTML = resultPanel(source, identity);
    const generation = restartGeneration;
    const record = newSaveRecord(source);
    currentSave = record;
    let saving = false;
    let permanentlyRejected = false;
    const attemptSave = async () => {
      if (saving || permanentlyRejected || disposed || generation !== restartGeneration) return;
      saving = true;
      record.saving = true;
      record.state = 'pending';
      $<HTMLButtonElement>('#retry-save').disabled = true;
      let outcome: Persistence | null = null;
      try { outcome = await saveSource(source); } catch { outcome = null; }
      // Classify on the record before the stale-generation guard, so a carried entry is right at once.
      applyOutcome(record, outcome);
      const settled = record.state as SaveRecord['state']; // set by applyOutcome, not by this scope
      saving = false;
      record.saving = false;
      record.onSettled?.();
      if (disposed || generation !== restartGeneration) return;
      if (settled === 'saved') {
        $('#save-state').className = 'micro save-state';
        $('#save-state').textContent = 'Saved in this browser.';
        $('#retry-save').hidden = true;
        $('#full-result').hidden = false;
        refreshToday(source);
      } else {
        permanentlyRejected = settled === 'rejected';
        $('#save-state').className = 'micro save-state is-failed'; // presentation only: the notice treatment
        $('#save-state').textContent = permanentlyRejected
          ? 'This result cannot be saved because it failed validation. Export it before leaving; retrying cannot repair this result.'
          : 'This result could not be saved. Export it before leaving, or retry when browser storage is available.';
        $('#retry-save').hidden = permanentlyRejected;
        $<HTMLButtonElement>('#retry-save').disabled = permanentlyRejected;
      }
    };
    paintResultActions(source);
    afterResultRendered();
    // Only while this block's result is still on screen (Again, a setting or disposal replace it).
    $('#retry-save').onclick = () => void attemptSave().then(() => {
      if (disposed || generation !== restartGeneration) return;
      if (($('#retry-save') as HTMLElement | null)?.hidden) afterResultRendered();
    });
    $('#export-current').onclick = () => { record.exported = true; download(source, `typeforge-${source.id}.json`); };
    await attemptSave();
  }

  input.addEventListener('keydown', (event) => {
    if (restarting || disposed) { event.preventDefault(); return; }
    const now = performance.now();
    const snapshot = paint(now);
    if (ended(snapshot.state)) {
      // Keep native navigation, selection and copying available. beforeinput and
      // acceptInput guard mutations, and a stopped textarea is read-only.
      before = null; key = null;
      return;
    }
    if (event.key === 'Enter' && !event.isComposing) {
      event.preventDefault();
      before = null;
      key = null;
      warning('Enter does not advance. Use Space after the last word; Backspace corrects this passage.');
      paint(now);
    } else {
      key = event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey
        ? { key: event.key, time: now, repeat: event.repeat, start: input.selectionStart ?? 0, end: input.selectionEnd ?? 0 } : null;
    }
  });
  input.addEventListener('beforeinput', (event) => {
    if (restarting || disposed) { event.preventDefault(); return; }
    const snapshot = paint();
    if (ended(snapshot.state)) { event.preventDefault(); return; }
    if (event.inputType === 'insertLineBreak' || event.inputType === 'insertParagraph') { event.preventDefault(); before = null; key = null; return; }
    if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') undoUsed = true;
    before = { value: snapshot.value, start: input.selectionStart ?? 0, end: input.selectionEnd ?? 0, type: event.inputType, data: event.data };
  });
  const acceptInput = (event: Event) => {
    if (restarting || disposed) { input.value = ''; return; }
    const inputEvent = event as InputEvent;
    const now = performance.now();
    const snapshot = engine.tick(now);
    if (ended(snapshot.state)) {
      input.value = snapshot.value;
      paint(now);
      return;
    }
    if (snapshot.state === 'idle' && suggestedPair && !coachFresh) {
      // The key belonged to the old passage. Start General only on its own first key.
      prepAbort?.abort();
      fallbackForBlock = true;
      coach = null;
      coachMessage = 'Saved timings changed, so this block is general.';
      before = null; key = null; input.value = '';
      installPair(null);
      showCoach();
      return;
    }
    const previous = before ?? { value: snapshot.value, start: key?.start ?? 0, end: key?.end ?? 0, type: key ? 'insertText' : '', data: key?.key ?? null };
    const edit = reconstructEdit(previous, input.value);
    const matchedKey = key && edit.text === key.key && edit.text.length === 1;
    const starting = snapshot.state === 'idle';
    engine.edit({ ...edit, tracked: edit.tracked && (!edit.text || Boolean(matchedKey)), pressTime: matchedKey ? key!.time : undefined, repeat: matchedKey ? key!.repeat : false, composing: composing || inputEvent.isComposing }, now);
    // The run's identity freezes at its first accepted insertion.
    if (starting && engine.state !== 'idle' && !frozen) freezeRun();
    const accepted = engine.snapshot(now);
    const acceptedValue = accepted.value;
    if (accepted.sentenceIndex !== snapshot.sentenceIndex) {
      const submitted = engine.submittedSummaries.at(-1);
      previousPromptText = submitted?.promptText ?? snapshot.prompt.text;
      previousResponse = submitted?.response ?? snapshot.value;
      if (mode === 'assessment' && submitted?.eligible) history = appendHistory(history, submitted);
      prepare(now);
    }
    if (input.value !== acceptedValue) input.value = acceptedValue;
    before = null;
    key = null;
    paint(now);
  };
  input.addEventListener('input', acceptInput);
  input.addEventListener('keyup', () => { key = null; paint(); });
  input.addEventListener('select', () => { if (!disposed && !restarting) paint(); });
  input.addEventListener('click', () => { if (!disposed && !restarting) paint(); });
  input.addEventListener('compositionstart', () => { composing = true; });
  input.addEventListener('compositionend', () => {
    // Some browsers expose the committed value only at compositionend. Reconcile
    // once as a composing edit, never as a passage delimiter or timing evidence.
    if (!disposed && !restarting && input.value !== engine.snapshot(performance.now()).value) acceptInput(new Event('input'));
    composing = false; key = null; before = null;
  });
  for (const type of ['paste', 'drop']) input.addEventListener(type, (event) => { event.preventDefault(); warning('Please type the sentence. Pasted or dropped text does not count.'); });
  const interrupt = () => { if (!finished && !restarting && !disposed) { engine.interrupt(performance.now()); key = null; before = null; paint(); } };
  input.addEventListener('blur', interrupt);
  window.addEventListener('blur', interrupt);
  document.addEventListener('visibilitychange', () => { if (document.hidden) interrupt(); });
  window.addEventListener('pagehide', () => { disposed = true; restartGeneration++; clearInterval(timer); prepAbort?.abort(); unsubscribe(); if (!finished) engine.abort(performance.now()); });
  window.addEventListener('pageshow', (event) => { if (event.persisted) location.reload(); });
  input.addEventListener('focus', () => { stage.dataset.focus = 'in'; });
  input.addEventListener('blur', () => { stage.dataset.focus = 'out'; });
  // Focus recovery is contextual: a real button, a click on blank stage space, and Enter only
  // from neutral focus. There is no global printable-key capture.
  $('#continue-typing').onclick = () => { if (!finished && !restarting && !input.disabled) input.focus(); };
  stage.addEventListener('click', (event) => {
    if ((event.target as HTMLElement).closest('button, a, input, textarea, ui-collapsible, .completion')) return;
    if (!finished && !restarting && !disposed && !input.disabled) input.focus();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    const active = document.activeElement;
    if (active && active !== document.body && active !== stage) return;
    if (disposed || restarting || finished || input.disabled) return;
    event.preventDefault();
    input.focus();
  });

  // Settings rail: SDK controls with one app-owned state. Values are validated here and a change
  // during a running block is refused (not disabled), so focus and layout never move.
  let settingsPending = false;
  const sourceName = (source: unknown) => source === 'agent' ? 'Agent' : source === 'keyboard' ? 'Keyboard' : source === 'programmatic' ? 'Programmatic' : 'Pointer';
  const settingsStatus = (message: string) => { $('#settings-status').textContent = message; };
  function guard(setting: string, valid: (value: unknown) => boolean) {
    return (event: Event) => {
      const {value, source} = (event as UiChangeEvent<unknown>).detail;
      const refused = disposed ? 'the page is closing.' : engine.state === 'running' && !restarting ? 'a block is running. Finish it or restart first.'
        : !valid(value) ? 'that value is not available.' : '';
      if (refused) {
        event.preventDefault();
        settingsStatus(`${sourceName(source)} change to ${setting} refused: ${refused}`);
        return;
      }
      settingsStatus(`${sourceName(source)} set ${setting} to ${String(value)}.`);
      queueMicrotask(changeSettings);
    };
  }
  // The pair list is the rarest control: its module loads on demand, never on first paint.
  let pairModule: Promise<void> | null = null;
  const pairReady = () => Boolean(customElements.get('ui-select'));
  const pairValue = () => manualPair ? (pairReady() ? String(manualPair.value ?? '') : manualPair.getAttribute('default-value') ?? '') : '';
  function loadPairs() {
    if (!manualPair) return Promise.resolve();
    return pairModule ??= (async () => {
      $('.pair-list').innerHTML = manualPairs.map(pair => `<ui-select-item value="${pair}">${pair}</ui-select-item>`).join('');
      await import('@ui-sdk/web/select');
      manualPair.addEventListener('valuechange', guard('pair', value => typeof value === 'string' && manualPairs.includes(value) && practiceKind?.value === 'manual'));
    })();
  }
  function showPair(visible: boolean, pair?: string) {
    if (!manualPair) return;
    manualPair.hidden = !visible;
    if (pair) {
      if (pairReady()) manualPair.value = pair; // Owner-to-view sync: emits no change event.
      else { manualPair.setAttribute('default-value', pair); manualPair.querySelector('ui-select-value')!.textContent = pair; }
    }
    if (visible) void loadPairs();
  }
  if (manualPair) {
    // A click that lands before the module upgrades the Select still opens the list.
    manualPair.addEventListener('click', () => {
      if (pairReady()) return;
      void loadPairs().then(() => { if (!disposed) manualPair.open = true; });
    });
    if (!manualPair.hidden) void loadPairs();
  }
  duration.addEventListener('valuechange', guard('duration', value => SUPPORTED_DURATIONS.some(supported => String(supported / 1000) === value)));
  qwerty.addEventListener('checkedchange', guard('qwerty', value => typeof value === 'boolean'));
  practiceKind?.addEventListener('valuechange', guard('practice', value => value === 'general' || value === 'manual' || value === 'recommended'));
  const changeSettings = () => {
    if (disposed || engine.state === 'running') return;
    if (restarting) { settingsPending = true; return; }
    durationMs = parseDuration(String(duration.value)).durationMs;
    if (sourceAssessmentId && origin && !compatibleSettings(origin.settings, settings(qwerty.checked, durationMs))) {
      sourceAssessmentId = undefined; excluded = []; lineageMessage = 'New assessment: duration or keyboard declaration differs from the origin.';
    }
    const url = new URL(location.href);
    url.searchParams.set('duration', String(durationMs / 1000));
    url.searchParams.set('qwerty', qwerty.checked ? '1' : '0');
    params.set('qwerty', qwerty.checked ? '1' : '0');
    params.set('duration', String(durationMs / 1000));
    const kind = (practiceKind?.value ?? 'general') as PracticeKind;
    if (practiceKind && manualPair) {
      params.set('practice', kind);
      url.searchParams.set('practice', kind);
      if (kind === 'manual') { const pair = pairValue(); params.set('pair', pair); url.searchParams.set('pair', pair); }
      else { params.delete('pair'); url.searchParams.delete('pair'); }
    }
    // A deliberate choice is remembered locally; `/` keeps its clean URL.
    savePreferences(mode, {durationSeconds: durationMs / 1000, qwerty: qwerty.checked, ...(practiceKind ? {kind} : {}), ...(kind === 'manual' && manualPair ? {pair: pairValue()} : {})});
    if (!options.home) window.history.replaceState(null, '', url);
    repeatRequested = finished;
    void $('#restart').onclick?.call(stage, new PointerEvent('click'));
  };
  $('#restart').onclick = async () => {
    if (restarting || disposed || (finished && !repeatRequested && paint().state !== 'stopped')) return;
    repeatRequested = false;
    carryUnsaved(); // Again or a result-state setting: continue now, keep any unsaved result listed
    restarting = true;
    const generation = ++restartGeneration;
    coachFresh = false;
    clearInterval(timer);
    engine.abort(performance.now());
    prepAbort?.abort(); prepAbort = null;
    input.disabled = true;
    $<HTMLButtonElement>('#restart').disabled = true;
    before = null; key = null; composing = false;
    frozen = null; coach = null; suggestedPair = null; coachMessage = ''; fallbackForBlock = false;
    if (originId) {
      let refreshedOrigin: SessionResult | null = null;
      try { refreshedOrigin = await getResult(originId) ?? null; }
      catch { /* Unreadable origin is unavailable evidence, not a replacement origin. */ }
      if (disposed || generation !== restartGeneration) return;
      origin = refreshedOrigin;
      if (params.has('retest')) {
        const resolved = resolveRetest(origin, settings(qwerty.checked, durationMs), assessmentPrompts);
        sourceAssessmentId = resolved.kind === 'retest' ? resolved.sourceAssessmentId : undefined;
        excluded = resolved.kind === 'retest' ? resolved.excludedPromptIds : [];
        lineageMessage = resolved.kind === 'retest' ? '' : `New assessment: ${resolved.reason}`;
        $('#exercise-intro').textContent = `English · lowercase · ${resolved.kind === 'retest' ? 'fresh assessment passages' : 'short sentences'}`;
      } else if (mode === 'practice') {
        sourceAssessmentId = origin?.mode === 'assessment' && origin.eligibleForProgress && compatible(origin, settings(qwerty.checked, durationMs)) ? origin.id : undefined;
        lineageMessage = sourceAssessmentId ? '' : 'Practice origin is unavailable or incompatible; a later assessment will start fresh.';
      }
    }
    practiceChoice = parsePracticeChoice(params.get('practice'), params.get('pair'), manualPairs);
    if (practiceKind && manualPair) {
      practiceKind.value = practiceChoice.kind;
      showPair(practiceChoice.kind === 'manual', practiceChoice.pair);
    }
    if (`${qwerty.checked}|${durationMs}` !== historyKey) { history = []; historyKey = `${qwerty.checked}|${durationMs}`; }
    prompts = choosePrompts();
    engine = makeEngine(qwerty.checked);
    input.value = '';
    previousPromptText = '';
    previousResponse = '';
    undoUsed = false;
    input.readOnly = false;
    finished = false;
    $('#completion').hidden = true;
    $('#completion').innerHTML = '';
    $('#today-summary').textContent = '';
    lastPromptKey = '';
    lastState = '';
    clearSlot();
    prepare();
    restarting = false;
    paint();
    input.disabled = false;
    $<HTMLButtonElement>('#restart').disabled = false;
    startTimer();
    if (mayFocusInput()) input.focus();
    void refreshSuggestion(true);
    loadEvidence();
    if (settingsPending) { settingsPending = false; queueMicrotask(changeSettings); }
  };
  // Saved timing history arrives after the stage is ready. It may refine predictions, never the
  // prompts or predictions the person has already seen; a failure leaves practice untouched.
  function loadEvidence() {
    if (!qwerty.checked) return;
    const evidenceGeneration = restartGeneration;
    const evidenceEngine = engine;
    void calibration(settings(qwerty.checked, durationMs)).then(loaded => {
      if (disposed || restarting || evidenceGeneration !== restartGeneration || engine !== evidenceEngine) return;
      storageNotice(loaded.diagnostics);
      const fresh = engine.state === 'idle' && !engine.snapshot(performance.now()).value && engine.submittedSummaries.length === 0;
      history = fresh ? loaded.sentences : loaded.sentences.reduce((merged, sentence) => appendHistory(merged, sentence), [] as SentenceSummary[]).concat(history).slice(-10);
      prepare();
    }).catch(() => {
      // Optional evidence only: General practice is unaffected; a quiet note in Why?, never a banner.
      if (disposed || restarting || evidenceGeneration !== restartGeneration || engine !== evidenceEngine) return;
      $('#prediction-state').textContent = 'Saved timing history could not be read; predictions are unavailable and practice is unaffected.';
    });
  }
  prepare();
  startTimer();
  paint();
  // Intentional entry: autofocus only if nobody moved focus while the stage was being prepared.
  if (!preparationFocusMoved && mayFocusInput()) input.focus();
  // General is ready immediately. Suggested waits for its initial choice.
  loadEvidence();
  void refreshSuggestion(true);
  const configurationWarning = [parsedDuration.reason, parsedQwerty.reason].filter(Boolean).join(' ');
  if (configurationWarning) warning(configurationWarning);
}

// Committed passages keep static positional error marks; they are rendered once per commit.
function renderCommitted(target: HTMLElement, promptText: string, response: string) {
  target.replaceChildren();
  let run = '';
  let runWrong = false;
  const flush = () => {
    if (!run) return;
    if (runWrong) { const mark = document.createElement('span'); mark.className = 'missed'; mark.textContent = run; target.append(mark); }
    else target.append(run);
    run = '';
  };
  for (let index = 0; index < promptText.length; index++) {
    const wrong = response[index] !== promptText[index];
    if (wrong !== runWrong) { flush(); runWrong = wrong; }
    run += promptText[index];
  }
  flush();
}

function integrityCopy(flags: readonly string[], undoUsed: boolean) {
  // Newest flag wins (engine flags keep insertion order). Copy states today's behaviour exactly.
  const newest = flags.at(-1);
  if (newest === 'invalid-input' && undoUsed) return 'Undo isn’t scored: this run will be saved without accuracy and excluded from progress. Restart to keep scoring.';
  if (newest === 'invalid-input') return 'Unsupported edit: this run will be saved without accuracy and excluded from progress. Restart to keep scoring.';
  return 'Focus left the typing field: this run is flagged and excluded from headline progress. The timer kept running.';
}

function observedTakeaway(result: SavedSource) {
  if (result.metrics.accuracy === null) return 'Accuracy is unavailable for this run: Undo or an unsupported edit was used.';
  const keys = new Map<string, {count: number; errors: number}>();
  for (const sentence of result.sentences) {
    for (const [key, counts] of Object.entries(sentence.diagnosticsAvailable ? sentence.keys : {})) {
      const sum = keys.get(key) ?? {count: 0, errors: 0};
      sum.count += counts.firstAttempts; sum.errors += counts.firstErrors; keys.set(key, sum);
    }
  }
  const worst = [...keys].filter(([, value]) => value.errors > 0).sort((a, b) => b[1].errors - a[1].errors || a[0].localeCompare(b[0]))[0];
  if (!worst) return keys.size ? 'No first-attempt key errors recorded.' : 'Key diagnostics are unavailable for this run.';
  const label = worst[0] === ' ' ? 'space' : `“${worst[0]}”`;
  return `Most first-attempt misses: ${label} (${worst[1].errors} of ${worst[1].count}). An observation, not a diagnosis.`;
}

const flaggedLine = 'Flagged: this run was interrupted or used unsupported input. It is saved with a label and excluded from headline progress.';
// The result replaces the passage in place: the frozen run label, figures, one observed takeaway and the actions.
function resultPanel(source: SessionResult, identity: { label: string }) {
  const seconds = source.settings.durationMs / 1000;
  const flagged = !source.eligibleForProgress;
  const label = `${identity.label} · ${seconds} s · complete`;
  const figures = `<dl class="result-figures"><div><dt>wpm</dt><dd>${format(source.metrics.wpm)}</dd></div><div><dt>accuracy</dt><dd>${accuracy(source.metrics.accuracy)}</dd></div></dl>`;
  const timedFlag = flagged ? `<p class="result-flag">${source.metrics.accuracy === null ? 'Excluded from progress: Undo or an unsupported edit was used, so accuracy is unavailable.' : flaggedLine}</p>` : '';
  const body = `${figures}<p class="result-observation">${observedTakeaway(source)}</p>${timedFlag}`;
  return `<h2 class="micro result-label">${esc(label)}</h2>
    ${body}
    <div class="result-actions" id="result-actions"></div>
    <div class="save-row"><p id="save-state" class="micro save-state" role="status">Saving to this browser…</p><button id="retry-save" class="key key-small" type="button" hidden>retry saving</button><button id="export-current" class="key key-small" type="button">export</button></div>
    <ui-collapsible class="result-details"><ui-collapsible-trigger><button type="button" class="text-button">details</button></ui-collapsible-trigger><ui-collapsible-panel keep-mounted hidden>${metricCards(source)}<p class="micro">Accuracy includes mistakes you corrected. Deleted characters are reported separately. ${source.sentences.filter(sentence => sentence.submitted).length} passages submitted.</p><a id="full-result" class="text-link" href="./results.html?id=${encodeURIComponent(source.id)}" hidden>full result, timing and export options →</a></ui-collapsible-panel></ui-collapsible>`;
}

type Activity = { practice: number; practiceMs: number; flagged: number; flaggedMs: number; assessments: number; complete: boolean };
// Bounded: today's line reads at most five newest-first pages and says when it stopped early.
async function todayActivity(): Promise<Activity> {
  const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
  const activity: Activity = {practice: 0, practiceMs: 0, flagged: 0, flaggedMs: 0, assessments: 0, complete: true};
  let cursor: {completedAt: string; id: string} | null = null;
  for (let page = 0; page < 5; page++) {
    const batch = await listResultsPage(cursor, 100);
    for (const result of batch) {
      if (new Date(result.completedAt) < midnight) return activity;
      countActivity(activity, result);
    }
    if (batch.length < 100) return activity;
    const last = batch.at(-1)!; cursor = {completedAt: last.completedAt, id: last.id};
  }
  activity.complete = false;
  return activity;
}
function countActivity(activity: Activity, result: SessionResult) {
  if (result.mode === 'assessment') { activity.assessments++; return; }
  if (result.eligibleForProgress) { activity.practice++; activity.practiceMs += result.metrics.elapsedMs; }
  else { activity.flagged++; activity.flaggedMs += result.metrics.elapsedMs; }
}
function sessionTime(ms: number) {
  const seconds = Math.round(ms / 1000);
  return seconds >= 60 ? `${Math.floor(seconds / 60)} min${seconds % 60 ? ` ${seconds % 60} s` : ''}` : `${seconds} s`;
}
function todayText(activity: Activity) {
  const parts = [activity.practice ? `${activity.practice} practice block${activity.practice === 1 ? '' : 's'} · ${sessionTime(activity.practiceMs)} recorded` : 'no practice blocks yet'];
  if (activity.flagged) parts.push(`${activity.flagged} flagged (${sessionTime(activity.flaggedMs)}, excluded)`);
  if (activity.assessments) parts.push(`${activity.assessments} assessment${activity.assessments === 1 ? '' : 's'}`);
  return `Today: ${parts.join(' · ')}${activity.complete ? '' : ' · partial (500 newest checked)'}`;
}
// Observed practice activity by local calendar day. Flagged blocks are a separately labelled
// subtotal; assessments are counted, never pooled with practice.
function renderActivity(history: readonly SessionResult[]) {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'this device’s time zone';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const weekStart = new Date(today); weekStart.setDate(weekStart.getDate() - 6);
  const day: Activity = {practice: 0, practiceMs: 0, flagged: 0, flaggedMs: 0, assessments: 0, complete: true};
  const week: Activity = {...day};
  const days = new Set<string>();
  for (const result of history) {
    const completed = new Date(result.completedAt);
    if (completed >= weekStart) { countActivity(week, result); if (result.mode === 'practice') days.add(completed.toDateString()); }
    if (completed >= today) countActivity(day, result);
  }
  $('#activity-scope').textContent = `Local calendar days in ${zone}. Recorded session time is the elapsed time of saved blocks, not active typing time. Flagged blocks are counted separately and never as assessment evidence.`;
  const cell = (label: string, value: string, note = '') => `<div><dt>${label}</dt><dd>${value}${note ? ` <small>${note}</small>` : ''}</dd></div>`;
  $('#activity-grid').innerHTML = cell('today', `${day.practice} block${day.practice === 1 ? '' : 's'}`, sessionTime(day.practiceMs))
    + cell('last 7 days', `${week.practice} block${week.practice === 1 ? '' : 's'}`, `${sessionTime(week.practiceMs)} · ${days.size} day${days.size === 1 ? '' : 's'}`)
    + cell('flagged, 7 days', `${week.flagged}`, `${sessionTime(week.flaggedMs)} excluded`)
    + cell('assessments, 7 days', `${week.assessments}`, 'trend below');
}

function metricCards(result: SavedSource) {
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
  container.innerHTML = `<svg class="chart" viewBox="0 0 500 170" role="img" aria-label="Speed chart; text summary follows"><path d="M10 20H490 M10 85H490 M10 150H490" stroke="#D5D0C4" fill="none"/><polyline points="${coordinates}" fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke"/>${points}</svg>`;
}

async function results() {
  const id = params.get('id');
  if (!id) {
    shell(`<section class="panel empty"><p class="eyebrow">A fresh start</p><h1>Your next result starts here.</h1><p class="lead">Take an assessment, or choose a saved result from your history.</p><div class="actions" style="justify-content:center"><a class="button" href="./practice.html">Start an assessment</a><a class="button secondary" href="./progress.html">View history</a></div></section>`);
    return;
  }
  const saved = await getSavedSource(id);
  if (!saved) throw new Error('This result is not saved in this browser. It may have been deleted or created on another device.');
  if (isFiniteSource(saved)) { finiteResultPage(saved); return; }
  const result = saved;
  const originId = result.mode === 'assessment' ? result.id : result.sourceAssessmentId;
  let origin: SessionResult | null = result.mode === 'assessment' ? result : null;
  if (result.mode === 'practice' && originId) {
    try { origin = await getResult(originId) ?? null; }
    catch { /* Optional origin cannot prevent exporting the valid current result. */ }
  }
  const retest = resolveRetest(origin ?? null, settings(result.settings.qwerty, result.settings.durationMs), assessmentPrompts);
  shell(`<div class="page-heading"><div><p class="eyebrow">${result.settings.durationMs / 1000} seconds, well spent</p><h1>A clearer picture of your typing.</h1><p class="small" id="result-date"></p></div><span class="tag">${result.mode === 'assessment' ? 'ASSESSMENT' : result.manualDrill ? `MANUAL PAIR ${result.manualDrill.pair}` : result.practiceFocus?.source === 'model' ? `SUGGESTED PAIR ${result.practiceFocus.pair}` : result.practiceFocus ? 'RECOMMENDED PRACTICE' : 'PRACTICE'}</span></div>
    ${result.eligibleForProgress ? '' : '<p class="notice">This run includes interrupted or unsupported input. It is saved here and excluded from headline progress.</p>'}
    ${metricCards(result)}
    <section class="panel coach"><p class="eyebrow">Your next session</p><h2 id="coach-title"></h2><p id="coach-explanation" class="small"></p><a class="button" id="next-action" href="./practice.html?mode=practice">Start practice</a></section>
    <p id="origin-comparison" class="small"></p>
    <section class="panel evidence"><h2>Predictions, checked against this run</h2><p class="small">The Ridge model and its historical baseline predict each sentence before you type it. This comparison uses their matching eligible timings.</p><ul id="prediction-comparison" class="list"></ul><p class="small">These are geometric mean intervals, not per-keystroke MAE or proof of learning. <a href="./lab.html">Inspect the held-out benchmark →</a></p></section>
    <div class="two-col"><section class="panel"><h2>Your pace</h2><p class="small">Cumulative speed through this ${result.settings.durationMs / 1000} second session.</p><div id="pace-chart"></div><div class="chart-labels"><span>0 seconds</span><span>${result.settings.durationMs / 1000} seconds</span></div><p id="pace-summary" class="small"></p></section>
    <section class="panel"><h2>What went into this result</h2><ul class="list" id="result-detail"></ul><p class="small">Accuracy includes mistakes you corrected. Deleted characters are reported separately.</p></section></div>
    <div class="two-col"><section class="panel"><h2>First attempts by key</h2><p class="small">Errors at the first entry to each position. Corrections do not add opportunities.</p><ul class="list" id="key-errors"></ul></section>
    <section class="panel"><h2>Observed pair timing</h2><p class="small">Typical intervals from fully correct, unedited sentences. These are observations, not predictions.</p><ul class="list" id="pair-times"></ul></section></div>
    <div class="actions"><a class="button secondary" id="retest" href="./practice.html">${result.mode === 'assessment' ? 'Retest with fresh passages' : 'Take an assessment'}</a><a class="button secondary" href="./practice.html?mode=practice&practice=${result.manualDrill ? `manual&pair=${encodeURIComponent(result.manualDrill.pair)}` : result.practiceFocus?.source === 'model' ? 'recommended' : 'general'}&duration=${result.settings.durationMs / 1000}&qwerty=${result.settings.qwerty ? '1' : '0'}${originId ? `&from=${encodeURIComponent(originId)}` : ''}">Keep practising</a><button class="button secondary" id="export-result">Export result</button><button class="button secondary danger" id="delete-result">Delete result</button></div>
    <p id="result-status" class="status" role="status"></p>
    <details><summary>How your scores are calculated</summary><p>WPM is the number of matching characters at their prompt positions, multiplied by 12000 and divided by the selected duration in milliseconds (${result.settings.durationMs} ms). It includes submitted sentences and your final partial response. ${result.settings.inputMode === 'flow-v1' ? 'Flow uses Space to advance; the terminal separator does not count.' : 'This legacy run used Enter to submit; it is not compared with flow runs.'} Accuracy is correct inserted characters divided by all inserted characters; corrections do not erase past mistakes. A timing sample requires a complete, correct first pass, with an interval no longer than five seconds.</p></details>`);
  $('#result-date').textContent = `${date(result.completedAt)} · ${result.settings.durationMs / 1000} seconds · ${result.settings.inputMode === 'flow-v1' ? 'Space flow' : 'Legacy Enter'} · Saved in this browser`;
  storageNotice(getStorageDiagnostics());
  const next = $<HTMLAnchorElement>('#next-action');
  if (result.mode === 'assessment') {
    // Suggested explains its own focus on the practice page from saved typing; this page never re-selects one.
    $('#coach-title').textContent = 'Keep practising.';
    $('#coach-explanation').textContent = 'General and pair practice work as usual. Suggested compares your saved letter-pair timings with expectations at your speed.';
    next.textContent = 'Start practice';
    next.href = `./index.html?mode=practice&from=${encodeURIComponent(result.id)}&duration=${result.settings.durationMs / 1000}&qwerty=${result.settings.qwerty ? '1' : '0'}`;
  } else {
    $('#coach-title').textContent = retest.kind === 'retest' ? 'See how you type on fresh passages.' : 'Set a new assessment baseline.';
    $('#coach-explanation').textContent = retest.kind === 'retest' ? 'Your original assessment is saved. Compare with it on fresh passages; practice scores stay separate.' : `Fresh comparison unavailable: ${retest.reason}`;
    next.textContent = retest.kind === 'retest' ? 'Take a fresh retest' : 'Take a new assessment';
    next.href = retest.kind === 'retest' ? `./practice.html?retest=${encodeURIComponent(retest.sourceAssessmentId)}&duration=${result.settings.durationMs / 1000}&qwerty=${result.settings.qwerty ? '1' : '0'}` : `./practice.html?duration=${result.settings.durationMs / 1000}&qwerty=${result.settings.qwerty ? '1' : '0'}`;
  }
  const retestLink = $<HTMLAnchorElement>('#retest');
  retestLink.textContent = retest.kind === 'retest' ? 'Retest with fresh passages' : 'New assessment';
  retestLink.href = retest.kind === 'retest' ? `./practice.html?retest=${encodeURIComponent(retest.sourceAssessmentId)}&duration=${result.settings.durationMs / 1000}&qwerty=${result.settings.qwerty ? '1' : '0'}` : `./practice.html?duration=${result.settings.durationMs / 1000}&qwerty=${result.settings.qwerty ? '1' : '0'}`;
  if (result.mode === 'assessment' && result.sourceAssessmentId) {
    let comparisonOrigin: SessionResult | null = null;
    try { comparisonOrigin = await getResult(result.sourceAssessmentId) ?? null; }
    catch { /* Corrupt or unreadable lineage is unavailable comparison evidence. */ }
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

// A saved early-ended Suggested block: readable and exportable as itself, never cast to a timed result.
function finiteResultPage(result: FinitePracticeResult) {
  const flagged = result.qualityFlags.length > 0;
  shell(`<div class="page-heading"><div><p class="eyebrow">Suggested practice</p><h1 id="finite-title"></h1><p class="small" id="result-date"></p></div><span class="tag">SUGGESTED PRACTICE</span></div>
    ${flagged ? `<p class="notice">${flaggedLine}</p>` : `${metricCards(result)}<p class="small" id="finite-figures"></p>`}
    <section class="panel"><h2>What this block was</h2><p class="small" id="finite-explanation"></p><ul class="list" id="result-detail"></ul></section>
    <div class="actions"><a class="button secondary" href="./index.html?mode=practice&practice=recommended&duration=30&qwerty=1">Suggested again</a><a class="button secondary" href="./index.html?mode=practice&practice=general">General practice</a><button class="button secondary" id="export-result">Export result</button><button class="button secondary danger" id="delete-result">Delete result</button></div>
    <p id="result-status" class="status" role="status"></p>`);
  $('#finite-title').textContent = `Suggested practice · ${result.plan.pair}`;
  $('#result-date').textContent = `${date(result.completedAt)} · Saved in this browser · ended early`;
  if (!flagged) $('#finite-figures').textContent = `Figures cover the ${format(result.metrics.elapsedMs / 1000)} seconds typed.`;
  $('#finite-explanation').textContent = 'This earlier version ended the block when you finished its fixed set of sentences.';
  addListRow($('#result-detail'), 'Pair', result.plan.pair, true);
  addListRow($('#result-detail'), 'Sentences', `${result.sentences.filter(sentence => sentence.submitted).length} of ${result.plan.sentenceCount} submitted`);
  addListRow($('#result-detail'), 'Time typed', `${format(result.metrics.elapsedMs / 1000)} s of 30`);
  storageNotice(getStorageDiagnostics());
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
  if (result.manualDrill) addListRow(detail, 'Manual pair', `${result.manualDrill.pair} · chosen manually, not an evidence-backed recommendation`);
  const focus = result.practiceFocus;
  if (focus) addListRow(detail, 'Practice focus', focus.source === 'model' ? `${focus.pair} · Suggested practice` :
    `${focus.pair} · ${focus.evidenceCount} observations · baseline ${focus.baselineVersion}`);
  addListRow(detail, 'Inserted characters', String(result.metrics.attemptedCharacters));
  addListRow(detail, 'Correct attempts', String(result.metrics.correctAttempts));
  addListRow(detail, 'Submitted sentences', String(result.sentences.filter((sentence) => sentence.submitted).length));
  addListRow(detail, 'Timing-eligible sentences', String(result.sentences.filter((sentence) => sentence.eligible).length));
  drawChart(result.chartSamples.map((sample) => ({ x: sample.elapsedMs / 1000, y: sample.wpm })), $('#pace-chart'), result.settings.durationMs / 1000);
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
  const rows = await listSavedSources();
  const history = rows.filter((source): source is SessionResult => !isFiniteSource(source));
  shell(`<div class="page-heading"><div><p class="eyebrow">Small steps, saved</p><h1>Your practice, over time.</h1><p class="small">History is saved in this browser. Export it to keep a separate copy.</p></div><div class="actions"><a class="button" href="./index.html">Practise</a><a class="button secondary" href="./practice.html">New assessment</a></div></div>
    <section class="panel activity" aria-labelledby="activity-title"><h2 id="activity-title">Practice activity</h2><p id="activity-scope" class="small"></p><dl class="activity-grid" id="activity-grid"></dl></section>
    <div id="history-content"></div><p id="history-status" class="status" role="status"></p>`);
  renderActivity(history);
  storageNotice(getStorageDiagnostics());
  if (!rows.length) {
    $('#history-content').innerHTML = `<section class="panel empty"><h2>Everyone starts with one session.</h2><p class="lead">Your completed practice blocks and assessments will appear here.</p><a class="button" href="./index.html">Start practising</a></section>`;
    return;
  }
  const newest = history.find((result) => result.mode === 'assessment' && result.eligibleForProgress && result.settings.corpusVersion === CORPUS_VERSION);
  const valid = newest ? history.filter(result => result.mode === 'assessment' && result.eligibleForProgress && compatible(result, newest.settings)) : [];
  const recent = valid.slice(0, 5);
  $('#history-content').innerHTML = `<section class="panel"><h2>Your assessment trend</h2><p id="trend-summary" class="small"></p><div id="trend-chart"></div></section>
    <div class="page-heading" style="margin-top:32px"><h2>Saved sessions</h2><div class="actions"><button id="export-history" class="button secondary">Export history</button><button id="export-sources" class="button secondary">Export all saved sources</button></div></div>
    <div class="panel table-wrap" tabindex="0" aria-label="Saved sessions; scroll horizontally for more columns"><table><caption class="sr-only">Your locally saved typing sessions, newest first</caption><thead><tr><th scope="col">Session</th><th scope="col">Mode</th><th scope="col">Duration / interaction</th><th scope="col">WPM</th><th scope="col">Accuracy</th><th scope="col">Status</th></tr></thead><tbody id="history-rows"></tbody></table></div>`;
  $('#trend-summary').textContent = recent.length ? `${format(recent.reduce((sum, result) => sum + result.metrics.wpm, 0) / recent.length)} WPM average across your latest ${recent.length} eligible assessment${recent.length === 1 ? '' : 's'}. Best: ${format(Math.max(...valid.map((result) => result.metrics.wpm)))} WPM. Bucket: ${newest!.settings.durationMs / 1000}s · ${newest!.settings.inputMode === 'flow-v1' ? 'Space flow' : 'Legacy Enter'} · ${newest!.settings.qwerty ? 'QWERTY declared' : 'keyboard undeclared'} · ${newest!.settings.language} · ${newest!.settings.corpusVersion}. Only compatible settings are compared. Passage variation affects comparisons.` : 'Complete an uninterrupted assessment to start your trend. Practice sessions stay separate.';
  if (recent.length > 1) drawChart([...recent].reverse().map((result, index) => ({ x: index, y: result.metrics.wpm })), $('#trend-chart'), recent.length - 1);
  for (const result of rows) {
    const row = document.createElement('tr');
    const first = document.createElement('td');
    const link = document.createElement('a');
    link.href = `./results.html?id=${encodeURIComponent(result.id)}`;
    link.textContent = date(result.completedAt);
    first.append(link);
    row.append(first);
    const flagged = isFiniteSource(result) && result.qualityFlags.length > 0;
    const values = isFiniteSource(result)
      ? [`Suggested practice · ${result.plan.pair}`, `${format(result.metrics.elapsedMs / 1000)} s of 30 · all ${result.plan.sentenceCount} sentences`,
        flagged ? '—' : format(result.metrics.wpm), flagged ? '—' : accuracy(result.metrics.accuracy), flagged ? 'Flagged' : 'Ended early · practice only']
      : [result.mode === 'assessment' ? 'Assessment' : result.practiceFocus?.source === 'model' ? `Suggested practice · ${result.practiceFocus.pair}` : result.manualDrill ? `Pair practice · ${result.manualDrill.pair}` : 'Practice', `${result.settings.durationMs / 1000}s · ${result.settings.inputMode === 'flow-v1' ? 'Space flow' : 'Legacy Enter'}`, format(result.metrics.wpm), accuracy(result.metrics.accuracy), result.eligibleForProgress ? 'Complete' : 'Flagged'];
    for (const value of values) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    }
    $('#history-rows').append(row);
  }
  // Keep the timed export format for people who already use it.
  $('#export-history').onclick = () => download({ exportedAt: new Date().toISOString(), scope: 'this browser only', results: history }, 'typeforge-history.json');
  $('#export-sources').onclick = async () => {
    try { download({ schemaId: 'typeforge-saved-sources-export-v1', sources: await listSavedSources() }, 'typeforge-saved-sources.json'); }
    catch { $('#history-status').textContent = 'Saved sources could not be exported just now. Your history is unchanged; try again.'; }
  };
}

async function renderCoachReadout() {
  const target = $('#coach-readout');
  try {
    const { speed, outside, fit, gaps } = await readCoach();
    const speedText = speed === null ? 'No saved letter-pair timings yet.' :
      `<strong>${speedWpm(speed)} WPM</strong> · ${outside ? 'outside the training range. ' + speedNote : 'inside the training range of about 32 to 150 WPM.'}`;
    let fitText = fit.coverage === null ? 'No pair checks yet across 0 sentences' :
      `<strong>${Math.round(100 * fit.coverage)}%</strong> inside the model’s 80% ranges · ${fit.inside} of ${fit.checks} pair checks across ${fit.sentences} ${fit.sentences === 1 ? 'sentence' : 'sentences'}`;
    if (fit.sentences < FIT_MIN_SENTENCES) fitText += ` · the check starts at ${FIT_MIN_SENTENCES} sentences`;
    const gapsText = gaps.length ? gaps.map(g => `<strong>${g.pair}</strong> ${gapPercent(g.gap)}% slower`).join(' · ') + ' than expected at your speed.' :
      'No pair is slower than expected at your speed.';
    target.innerHTML = `<dl class="coach-readout"><div><dt>Letter-pair speed</dt><dd>${speedText}</dd></div>
      <div><dt>Recent fit</dt><dd>${fitText}.</dd></div><div><dt>Largest pair gaps</dt><dd>${gapsText}</dd></div></dl>`;
  } catch { target.textContent = 'Saved typings or the coach model could not be read.'; }
}

function lab() {
  shell(`<div class="page-heading"><div><p class="eyebrow">Under the surface</p><h1>Machine learning. Open to inspection.</h1><p class="lead">How TypeForge estimates letter-pair timings on physical QWERTY keyboards.</p></div><span class="tag">EXPERIMENTAL · LOCAL INFERENCE</span></div>
    <section class="panel" aria-labelledby="coach-heading"><h2 id="coach-heading">Your typing</h2>
      <p class="small">What Suggested reads from your saved assessments and General practice.</p>
      <div id="coach-readout" aria-live="polite">Reading saved timings…</div></section>
    <div id="lab-report"></div>
    <section class="panel evidence"><h2>A small, inspectable architecture</h2><ol class="architecture"><li>Public data → bounded acquisition, checksums and exclusion audit</li><li>Python → participant/text holdouts, chronological history and baseline comparison</li><li>Versioned JSON → linear model evaluated locally in TypeScript</li><li>Native typing → frozen predictions, later observations, local IndexedDB results</li></ol><p class="small">No inference service. No guest keystrokes uploaded. No accounts or cloud synchronization in this local release.</p></section>
    <div class="actions"><a class="button" href="./practice.html">Try an assessment</a><a class="button secondary" href="./index.html">Back to TypeForge</a></div>`);
  void renderCoachReadout();
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
  const selection = section('Validation chooses. Test data checks.', 'Baseline and regularization are selected only on validation participant-macro MAE. These results compare the Ridge sentence predictions with their historical baseline.');
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
  else await home();
} catch (error) {
  showError(error instanceof Error ? error.message : 'Browser storage is unavailable. Try again in a browser with local storage enabled.');
}
