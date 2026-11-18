import '../../../../../../typing-app/client/src/style.css';
import './baseline.css';
import '@ui-sdk/web/segmented-control';
import '@ui-sdk/web/switch';
import '@ui-sdk/web/collapsible';
import '@ui-sdk/web/progress';
import type { UiCollapsibleElement } from '@ui-sdk/web';
import {
  type BaselineStatus, countText, nextTestNumber, takeTestLabel, reasonText, reasonSentence, shownReason, worksAsUsual, generalFits,
  baselinePurpose, focusExplanation, ruleOfThumb, ruleOfThumbShort, lockedPress, suggestedDescription, summaryView, summaryLabel,
  summaryUpdates, summaryReading, summaryUpdating, declareQwerty, qwertyHint, planEndLabel, planEndLine,
} from './copy.ts';
import { statuses, finitePlan } from './fixtures.ts';

// Prototype of the baseline flow on top of the accepted production markup and stylesheet.
// It owns no storage: state arrives in the URL (fx fixture or s= serialised status). Saves are
// simulated with a delay (save=ms, default 400) and can fail (outcome=savefail; retry=fail).
// r2: a completed result is a save record that outlives navigation, so a late save can update
// count surfaces but never the active run, its snapshot or its focus.
const params = new URLSearchParams(location.search);
const page = (params.get('page') ?? 'practice') as 'practice' | 'assessment' | 'progress';
const view = params.get('view') ?? 'ready';
const fast = params.get('fast') === '1';
const finalKind = params.get('final') ?? 'ready';
const finite = params.get('plan') === 'finite';
const saveDelay = Number(params.get('save') ?? (view === 'result' ? 0 : 400));
let status: BaselineStatus = params.has('s') ? { automaticCoaching: 'enabled', summary: null, ...JSON.parse(atob(params.get('s')!)) } : structuredClone(statuses[params.get('fx') ?? 's0'] ?? statuses.s0!);
if (finalKind === 'deferred') Object.assign(status, { automaticCoaching: 'disabled', evidenceScanComplete: null });
let qwerty = params.get('qwerty') !== '0';
let durationS = Number(params.get('dur') ?? 30);
let kind = params.get('kind') ?? 'general';
const app = document.querySelector<HTMLDivElement>('#app')!;
const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const esc = (text: string) => text.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

const generalPrompts = ['the weather turned cold before the storm', 'a row of yellow flowers lines the garden wall', 'please leave your muddy shoes beside the mat', 'they gathered their things and left together'];
const coachingOn = () => status.automaticCoaching === 'enabled';
const locked = () => status.state !== 'complete-ready' || !coachingOn() || !status.focus;
const suggestedRun = () => page === 'practice' && kind === 'recommended' && !locked();
const prompts = () => (suggestedRun() && finite ? finitePlan : generalPrompts);
(window as unknown as { __plan: string[] | null }).__plan = finite ? finitePlan : null;
const usable = () => status.state !== 'unavailable' && status.state !== 'checking';
const counting = () => page === 'assessment' && usable() && status.counted + status.pending < status.target;
const countsNow = () => counting() && qwerty && durationS === 30;
const href = (to: string, extra: Record<string, string> = {}) => `?${new URLSearchParams({ page: to, s: btoa(JSON.stringify({ ...status, pending: 0 })), qwerty: qwerty ? '1' : '0', ...(to === 'practice' ? { kind } : {}), ...extra })}`;

// ---- Save records: one per completed result, kept across next-test/retry navigation. ----
interface SaveRecord { id: number; baseline: boolean; testNumber: number | null; state: 'saving' | 'saved' | 'failed'; attempts: number }
const saves: SaveRecord[] = [];
let shownResult: SaveRecord | null = null;
let nextId = 1;
const failedBaseline = () => saves.filter(r => r.baseline && r.state === 'failed');
if (params.get('pendingFailed') === '1') { saves.push({ id: nextId++, baseline: true, testNumber: status.counted + 1, state: 'failed', attempts: 1 }); status.pending += 1; }

function settle(record: SaveRecord, ok: boolean) {
  record.state = ok ? 'saved' : 'failed';
  if (ok && record.baseline) {
    status.pending = Math.max(0, status.pending - 1);
    status.counted = Math.min(status.counted + 1, status.target);
    if (status.counted >= status.target) {
      const next = finalKind === 'ready' ? statuses.s10ready! : finalKind === 'sparse' ? statuses.s10sparse! : finalKind === 'deferred' ? statuses.sOff10! : statuses.s10insuff!;
      Object.assign(status, structuredClone(next), { pending: status.pending });
    } else if (status.exact) status.state = 'in-progress';
  }
  refreshAfterSave(record);
}
function attemptSave(record: SaveRecord, failFirst: boolean, delay: number) {
  record.state = 'saving'; record.attempts++;
  const fail = record.attempts === 1 ? failFirst : params.get('retry') === 'fail';
  window.setTimeout(() => settle(record, !fail), delay);
}
const retry = (record: SaveRecord) => { attemptSave(record, false, 300); refreshAfterSave(record); };

// A late save repaints only what is safe for the current surface; it never moves focus out of the text.
function refreshAfterSave(record: SaveRecord) {
  const stageState = document.querySelector<HTMLElement>('#stage')?.dataset.state;
  const focusWasOnResult = document.activeElement?.closest('#completion') || document.activeElement === document.body;
  if (document.querySelector('#why-panel')) paintWhy();
  if (stageState === 'completed' && shownResult) {
    paintResult();
    if (focusWasOnResult && !document.activeElement?.closest('#completion')) $('#primary').focus();
  } else if (stageState === 'idle') {
    const hadSlotFocus = document.activeElement?.closest('#slot');
    refreshReady();
    if (hadSlotFocus && record.state !== 'failed') $<HTMLTextAreaElement>('#typing-input').focus();
  }
  // running: the active run, its label, slot and focus are frozen; only the hidden why? text changed.
  if (page === 'progress') progressPage();
  formatProgress();
}

function shell(content: string, stage: boolean) {
  const links = [['practice', href('practice')], ['assessment', href('assessment')], ['progress', href('progress')], ['lab', '#']]
    .map(([name, link]) => `<a href="${link}" ${page === name ? 'aria-current="page"' : ''}>${name}</a>`).join('');
  app.innerHTML = `<header class="topbar">
    <a class="brand" href="${href('practice')}"><span class="brand-mark" aria-hidden="true">t_</span><span class="brand-name">typeforge</span></a>
    <nav class="site-nav" aria-label="Main navigation">${links}</nav>
    <ui-collapsible class="nav-menu" id="nav-menu">
      <ui-collapsible-trigger><button type="button" class="key key-small">menu</button></ui-collapsible-trigger>
      <ui-collapsible-panel class="nav-menu-panel" keep-mounted hidden><nav aria-label="Main navigation">${links}</nav></ui-collapsible-panel>
    </ui-collapsible>
  </header><main id="main" class="${stage ? 'main-stage' : 'main-page'}">${content}</main>
  <footer class="site-footer"><p>Results stay in this browser.</p></footer>
  <p class="fixture-label" aria-hidden="true">simulated fixture · ${esc(params.get('fx') ?? 'carried')}${fast ? ' · accelerated clock' : ''}</p>`;
}

// Semantic progress (ui-progress); the visible value is the exact sentence, never a percentage.
function progress(label = 'baseline') {
  const pending = status.pending > 0 && status.counted < status.target;
  return `<ui-progress class="baseline-progress" value="${Math.min(status.counted, status.target)}" max="${status.target}" ${pending ? 'data-pending' : ''} style="--counted:${status.counted}">
    <ui-progress-label>${label}</ui-progress-label><ui-progress-track><ui-progress-indicator></ui-progress-indicator></ui-progress-track><ui-progress-value></ui-progress-value></ui-progress>`;
}
function formatProgress() {
  document.querySelectorAll<HTMLElement & { format?: unknown }>('ui-progress.baseline-progress').forEach(el => {
    el.format = () => `${countText(status)} tests${status.pending && status.counted < status.target ? ` · ${status.pending} waiting to save` : ''}`;
  });
}

// "Last 10 tests · median": figures one step below the result hero, or a plain pending line, or nothing.
function summaryBlock(compact = false): string {
  const v = summaryView(status);
  if (v.kind === 'none') return '';
  if (v.kind === 'reading') return `<p class="note summary-reading">${summaryReading(status)}</p>`;
  const figures = `<dl class="summary-figures"><div><dt>wpm</dt><dd>${v.wpm}</dd></div>${v.accuracy ? `<div><dt>accuracy</dt><dd>${v.accuracy}</dd></div>` : ''}</dl>`;
  const notes = [v.note, v.updating ? summaryUpdating : null, `${v.range}. ${summaryUpdates}`].filter(Boolean).map(n => `<p class="note">${n}</p>`).join('');
  return `<div class="summary${compact ? ' summary-compact' : ''}"><p class="micro">${summaryLabel(status)}</p>${figures}${notes}<p class="figures-fixture">simulated fixture</p></div>`;
}

function whyBaseline(): string {
  if (status.state === 'checking') return `<div class="baseline-block"><p>Checking saved tests…</p></div>`;
  if (status.state === 'unavailable' || shownReason(status) === 'unknown') return `<div class="baseline-block"><p>${reasonSentence(status)}</p><p class="note">${worksAsUsual}</p></div>`;
  const source = 'Counted from the tests saved in this browser: deleting one, or starting a new baseline on the progress page, lowers the count.';
  const unsaved = failedBaseline().length ? `<p class="note">${unsavedSentence()}</p>` : '';
  if (status.counted < status.target || (!status.exact && status.state === 'pending')) {
    return `<div class="baseline-block">${progress()}
      <p>${baselinePurpose(status)}</p>
      <p>Every finished test counts, mistakes included. A run that stops early or loses focus just doesn’t count; nothing is taken away.</p>
      ${shownReason(status) === 'scan-incomplete' ? `<p class="note">${reasonText['scan-incomplete']}</p>` : ''}${unsaved}
      <p class="note">${source}</p>
      <a class="key key-small" href="${href('assessment')}">${takeTestLabel(status)}</a></div>`;
  }
  if (status.state === 'complete-ready' && coachingOn() && kind === 'recommended') {
    return `<div class="baseline-block"><p class="micro">suggested · ${status.focus!.pair}</p>
      <p>${focusExplanation(status.focus!)}</p>
      <p>These blocks lean on sentences containing ${status.focus!.pair}, with general sentences mixed in.${finite ? ' Each block is one fixed set of sentences, so it can end before the timer.' : ''}</p>
      <p class="note">${ruleOfThumb} Prefer an even mix? Choose general.</p></div>`;
  }
  if (status.state === 'complete-ready' && coachingOn()) {
    return `<div class="baseline-block">${progress()}<p>Suggested has a focus: ${status.focus!.pair}. Choose suggested to practise it.</p><p class="note">${focusExplanation(status.focus!)}</p></div>`;
  }
  const shown = shownReason(status);
  const after = shown === 'coaching-deferred' ? '' : shown === 'scan-incomplete' ? 'Using general until it can be read.' : shown === 'stale-evidence' ? 'Your 10 tests still count; only the timing needs refreshing.' : generalFits;
  return `<div class="baseline-block">${progress()}<p>Baseline complete. ${reasonSentence(status)}</p>
    ${after ? `<p class="note">${after}</p>` : ''}
    ${shown === 'stale-evidence' ? `<a class="key key-small" href="${href('assessment')}">take an assessment →</a>` : ''}</div>`;
}
function paintWhy() {
  $('#why-panel').innerHTML = `${whyBaseline()}<p>${page === 'assessment' ? 'English · lowercase · fresh assessment passages' : 'English · lowercase · short sentences'}</p><p>The timer keeps running if you leave the text. Interrupted runs stay in history, outside headline progress.</p>`;
  formatProgress();
}

function blockLabel() {
  if (page === 'assessment') {
    if (!countsNow()) return `Assessment · ${durationS} s`;
    const n = nextTestNumber(status);
    return n ? `Baseline test ${n} of ${status.target} · ${durationS} s` : `Baseline test · ${durationS} s`;
  }
  return suggestedRun() ? `Suggested practice · ${status.focus!.pair} · ${durationS} s` : `General practice · ${durationS} s`;
}

const unsavedSentence = () => {
  const failed = failedBaseline();
  return failed.length === 1 ? `${failed[0]!.testNumber ? `Test ${failed[0]!.testNumber}` : 'Your last test'} isn’t saved yet, so it doesn’t count.` : `${failed.length} tests aren’t saved yet, so they don’t count.`;
};

// Ready-state slot line (level 1 hint). Recovery first, then the counting hint.
function readyHint(): void {
  if (page === 'assessment' && failedBaseline().length) { hint(unsavedSentence(), { label: 'retry saving', onClick: () => failedBaseline().forEach(retry) }); return; }
  if (page === 'assessment' && counting()) {
    if (!qwerty) { hint(qwertyHint, { label: declareQwerty, onClick: declare }); return; }
    if (durationS !== 30) { hint('Not a baseline test: baseline tests are 30 seconds.'); return; }
    const n = nextTestNumber(status);
    hint(n ? `baseline test ${n} of ${status.target} — the clock starts with your first letter` : `At least ${status.counted} of ${status.target} found; this one counts too.`);
    return;
  }
  if (page === 'practice' && status.change?.kind === 'changed') { hint(`Suggested now leans on ${status.focus!.pair}. ${status.change.from} no longer stands out in your recent timing; that’s a re-check, not a verdict.`); return; }
  if (page === 'practice' && status.change?.kind === 'stepped-back') { hint(`Suggested stepped back to general: ${status.change.from} no longer stands out clearly in your recent timing. It re-checks before every block.`); return; }
  hint('');
}
// The declaration is the user's own press of the existing qwerty switch, never inferred or default-on.
function declare() {
  const sw = $('#qwerty');
  if (!sw.hasAttribute('data-checked')) sw.click();
  qwerty = true;
  if ($('#stage').dataset.state === 'completed') { paintResult(); $('#primary').focus(); return; }
  refreshReady();
  $<HTMLTextAreaElement>('#typing-input').focus();
}

let running = false, flagged = false, startedAt = 0, timer = 0, promptIndex = 0;
// Frozen at the first key: late saves cannot change what this run is.
let snapshot: { baseline: boolean; testNumber: number | null; label: string } | null = null;
function stage() {
  const isPractice = page === 'practice';
  if (isPractice && kind === 'recommended' && locked()) kind = 'general';
  shell(`<h1 class="sr-only">${isPractice ? 'Practice' : 'Assessment'}</h1>
  <div class="column">
  <section class="rail" id="rail" aria-label="${isPractice ? 'Practice' : 'Assessment'} settings">
    <div class="rail-group">
      <ui-segmented-control id="duration" class="keys" aria-label="Duration in seconds" default-value="${durationS}">
        ${[15, 30, 60, 120].map(v => `<ui-segmented-control-item value="${v}">${v}</ui-segmented-control-item>`).join('')}
      </ui-segmented-control><span class="unit" aria-hidden="true">s</span>
    </div>
    ${isPractice ? `<span class="rail-rule" aria-hidden="true"></span>
    <div class="rail-group">
      <ui-segmented-control id="practice-kind" class="keys" aria-label="Practice" default-value="${kind}">
        <ui-segmented-control-item value="general">general</ui-segmented-control-item>
        <ui-segmented-control-item value="manual">pair</ui-segmented-control-item>
        <ui-segmented-control-item value="recommended" id="suggested-item" ${locked() ? 'data-locked aria-disabled="true"' : ''} aria-describedby="suggested-status">suggested</ui-segmented-control-item>
      </ui-segmented-control>
      <span id="suggested-status" class="sr-only">${esc(suggestedDescription(status, locked()))}</span>
    </div>` : ''}
    <span class="rail-rule" aria-hidden="true"></span>
    <ui-switch id="qwerty" class="key key-toggle" aria-label="Physical QWERTY keyboard" ${qwerty ? 'default-checked' : ''}><span aria-hidden="true">qwerty</span><ui-switch-thumb></ui-switch-thumb></ui-switch>
  </section>
  <p id="today-summary" class="micro today">Today: 1 assessment · Europe/London (fixture)</p>
  <section class="stage" id="stage" aria-label="Typing exercise" data-state="idle" data-focus="out" data-mode="${isPractice ? 'practice' : 'assessment'}">
    <div class="run-line">
      <span class="countdown" id="remaining" role="timer" aria-label="Seconds left">${durationS}</span>
      <p class="micro block-label" id="block-identity">${esc(blockLabel())}</p>
      <ui-collapsible class="why" id="why">
        <ui-collapsible-trigger><button type="button" class="text-button">why?</button></ui-collapsible-trigger>
        <ui-collapsible-panel class="why-panel" id="why-panel" keep-mounted hidden></ui-collapsible-panel>
      </ui-collapsible>
    </div>
    <label class="sr-only" for="typing-input">Type the passage</label>
    <p id="typing-help" class="sr-only">Space advances words; Backspace corrects the current passage. Enter does not advance.</p>
    <div class="surface-wrap">
      <div class="stage-cover"><button class="key key-primary" id="continue-typing" type="button">start typing ↵</button></div>
      <div class="typing-surface" id="typing-viewport">
        <p id="previous-prompt" class="passage-context" aria-hidden="true"></p>
        <div class="active-passage"><div class="prompt" id="prompt" aria-hidden="true"></div>
          <textarea class="typing-input" id="typing-input" rows="1" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="typing-help"></textarea>
        </div><p id="next-prompt" class="passage-context" aria-hidden="true"></p>
      </div>
    </div>
    <div class="slot-row">
      <div class="slot" id="slot" role="status" aria-live="polite"><p id="exercise-warning" class="slot-text"></p></div>
      <button class="key" id="restart" type="button">restart</button>
    </div>
    <p class="foot-hints"><kbd>space</kbd> next<span class="wide-only"> passage</span> · <kbd>backspace</kbd> fix<span class="wide-only"> · <kbd>tab</kbd> <kbd>enter</kbd> restart</span></p>
    <div id="completion" class="completion" hidden></div>
  </section>
  </div>`, true);
  document.body.dataset.run = 'idle';
  shownResult = null; snapshot = null;
  wire();
}

function hint(text: string, action?: { label: string; href?: string; onClick?: () => void }) {
  const slot = $('#exercise-warning');
  slot.className = `slot-text ${text ? 'is-hint' : ''}`;
  slot.textContent = text;
  if (action) {
    const el = action.href ? Object.assign(document.createElement('a'), { href: action.href }) : Object.assign(document.createElement('button'), { type: 'button' });
    el.className = 'key key-small'; el.textContent = action.label;
    if (action.onClick) el.addEventListener('click', action.onClick);
    slot.append(el);
  }
}
const pressExplanation = () => {
  const said = lockedPress(status);
  const action = said.action ? { label: said.action, ...(said.action === 'check again' ? { onClick: () => hint('Checking saved tests…') } : { href: href('assessment') }) } : undefined;
  hint(said.text, action);
};

function paintPrompt() {
  const input = $<HTMLTextAreaElement>('#typing-input');
  const list = prompts();
  const text = list[promptIndex % list.length]!;
  const typed = input.value;
  $('#prompt').innerHTML = [...text].map((c, i) => `<span class="${i < typed.length ? (typed[i] === c ? 'correct' : 'wrong') : ''}${i === typed.length ? ' cursor' : ''}">${c === ' ' ? ' ' : esc(c)}</span>`).join('') + (typed.length >= text.length ? '<span class="cursor"> </span>' : '');
  $('#previous-prompt').textContent = promptIndex ? list[(promptIndex - 1) % list.length]! : '';
  // A finite plan never wraps: after its last sentence the context line says the block ends.
  const last = finite && suggestedRun() && promptIndex >= list.length - 1;
  $('#next-prompt').textContent = last ? '— end of this block —' : list[(promptIndex + 1) % list.length]!;
}

function wire() {
  const input = $<HTMLTextAreaElement>('#typing-input');
  const stageEl = $('#stage');
  const why = $<UiCollapsibleElement>('#why');
  paintWhy();
  paintPrompt();
  readyHint();
  input.addEventListener('focus', () => { stageEl.dataset.focus = 'in'; });
  input.addEventListener('blur', () => { stageEl.dataset.focus = 'out'; if (running) { flagged = true; hint('Focus left the text: this run is flagged and excluded from headline progress. The timer kept running.'); $('#exercise-warning').className = 'slot-text is-notice'; } });
  $('#continue-typing').addEventListener('click', () => input.focus());
  input.addEventListener('input', () => {
    if (!running) start();
    const list = prompts();
    const text = list[promptIndex % list.length]!;
    if (input.value === `${text} `) {
      if (finite && suggestedRun() && promptIndex >= list.length - 1) { finishPlan(); return; }
      promptIndex++; input.value = '';
    }
    paintPrompt();
  });
  $('#restart').addEventListener('click', () => { stop(); stage(); $<HTMLTextAreaElement>('#typing-input').focus(); });
  $('#duration').addEventListener('valuechange', (event) => { durationS = Number((event as CustomEvent).detail.value); refreshReady(); });
  $('#qwerty').addEventListener('checkedchange', (event) => { qwerty = Boolean((event as CustomEvent).detail.value ?? (event as CustomEvent).detail.checked); if (stageEl.dataset.state !== 'completed') refreshReady(); });
  document.querySelector('#practice-kind')?.addEventListener('valuechange', (event) => {
    const value = (event as CustomEvent).detail.value;
    if (value === 'recommended' && locked()) { event.preventDefault(); pressExplanation(); return; }
    kind = value; refreshReady(); paintPrompt();
  });
  const suggested = document.querySelector('#suggested-item');
  // A press on the already-focused locked key (no value change) still explains.
  suggested?.addEventListener('click', () => { if (locked()) pressExplanation(); });
  if (view === 'why') { why.api.open?.(); (why.querySelector('button') as HTMLButtonElement).focus(); }
  else if (view === 'press' && suggested) requestAnimationFrame(() => { (suggested as HTMLElement).focus(); pressExplanation(); });
  else input.focus();
}
function refreshReady() {
  if ($('#stage').dataset.state !== 'idle') return;
  $('#block-identity').textContent = blockLabel();
  $('#remaining').textContent = String(durationS);
  readyHint();
}

function start() {
  running = true; flagged = false; startedAt = performance.now();
  snapshot = { baseline: countsNow(), testNumber: nextTestNumber(status), label: blockLabel() };
  document.body.dataset.run = 'running';
  $('#stage').dataset.state = 'running';
  if (!$('#exercise-warning').classList.contains('is-notice')) hint('');
  const total = durationS * 1000 / (fast ? 10 : 1);
  timer = window.setInterval(() => {
    const left = Math.max(0, total - (performance.now() - startedAt));
    $('#remaining').textContent = String(Math.ceil(left * (fast ? 10 : 1) / 1000));
    if (!left) { stop(); complete(flagged ? 'flagged' : (params.get('outcome') ?? 'saved')); }
  }, 100);
}
function stop() { running = false; window.clearInterval(timer); }
function finishPlan() {
  const elapsed = Math.max(1, Math.round((performance.now() - startedAt) * (fast ? 10 : 1) / 1000));
  stop(); complete('planend', elapsed);
}

// In-place result. outcome: saved | flagged | savefail | planend. Counting happens only after a durable save.
let resultOutcome = 'saved', planSeconds = 0;
function complete(outcome: string, seconds = 0) {
  document.body.dataset.run = 'completed';
  $('#stage').dataset.state = 'completed';
  $<HTMLTextAreaElement>('#typing-input').disabled = true;
  if (!$('#exercise-warning').classList.contains('is-notice')) hint('');
  snapshot ??= { baseline: countsNow(), testNumber: nextTestNumber(status), label: blockLabel() };
  resultOutcome = outcome; planSeconds = seconds;
  const record: SaveRecord = { id: nextId++, baseline: snapshot.baseline && outcome !== 'flagged', testNumber: snapshot.testNumber, state: 'saving', attempts: 0 };
  saves.push(record); shownResult = record;
  if (record.baseline) status.pending += 1;
  const completion = $('#completion');
  completion.hidden = false;
  const label = outcome === 'planend' ? planEndLabel(status.focus!.pair, finitePlan.length, seconds, durationS)
    : page === 'assessment' ? `${record.baseline ? snapshot.label.replace(/ · \d+ s$/, '') : 'Assessment'} · ${durationS} s · complete`
    : `${snapshot.label.replace(/ · \d+ s$/, '')} · ${durationS} s · complete`;
  completion.innerHTML = `<h2 class="micro result-label">${esc(label)}</h2>
    ${outcome === 'planend' ? '<p class="figures-fixture">figures omitted: unavailable until P1 r2 validates metrics for a block that ends early (finite-plan-end.md rule 6)</p>'
      : '<dl class="result-figures"><div><dt>wpm</dt><dd>41.6</dd></div><div><dt>accuracy</dt><dd>96.2%</dd></div></dl><p class="figures-fixture">simulated fixture figures</p>'}
    ${outcome === 'planend' ? `<p class="result-observation">${planEndLine(status.focus!.pair)}</p>` : '<p class="result-observation">Most first-attempt misses: “e” (3 of 52). An observation, not a diagnosis.</p>'}
    ${outcome === 'flagged' ? '<p class="result-flag">Flagged: this run was interrupted or used unsupported input. It is saved with a label and excluded from headline progress.</p>' : ''}
    <div id="baseline-result"></div>
    <div class="result-actions" id="result-actions"></div>
    <div class="save-row"><p id="save-state" class="micro save-state" role="status">Saving to this browser…</p><button id="retry-save" class="key key-small" type="button" hidden>retry saving</button><button id="export-current" class="key key-small" type="button">export</button></div>
    <ui-collapsible class="result-details"><ui-collapsible-trigger><button type="button" class="text-button">details</button></ui-collapsible-trigger><ui-collapsible-panel keep-mounted hidden><p class="micro">Details unchanged from the accepted result (not prototyped).</p></ui-collapsible-panel></ui-collapsible>`;
  $('#retry-save').addEventListener('click', () => retry(record));
  paintResult();
  $('#primary').focus();
  attemptSave(record, outcome === 'savefail', saveDelay);
}

const nextTest = () => { stop(); promptIndex += 2; stage(); $<HTMLTextAreaElement>('#typing-input').focus(); };
function actions(primary: { label: string; href?: string; onClick?: () => void }, secondary: { label: string; href?: string; onClick?: () => void }, note = '') {
  const key = (a: typeof primary, cls: string, id: string, enter: boolean) => a.href ? `<a class="${cls}" id="${id}" href="${a.href}">${a.label}${enter ? ' ↵' : ''}</a>` : `<button class="${cls}" id="${id}" type="button">${a.label}${enter ? ' ↵' : ''}</button>`;
  $('#result-actions').innerHTML = `${key(primary, 'key key-primary', 'primary', true)}${key(secondary, 'key', 'secondary', false)}${note ? `<span class="action-note">${note}</span>` : ''}`;
  if (primary.onClick) $('#primary').addEventListener('click', primary.onClick);
  if (secondary.onClick) $('#secondary').addEventListener('click', secondary.onClick);
}

function paintResult() {
  const record = shownResult!;
  const outcome = resultOutcome;
  const block = $('#baseline-result');
  // Save row: the accepted retry/export row. For a baseline test, retry moves up to the primary.
  const state = $('#save-state');
  state.textContent = record.state === 'saved' ? 'Saved in this browser.' : record.state === 'failed' ? 'Not saved: this browser refused the write. Your result is kept on this page.' : 'Saving to this browser…';
  state.className = `micro save-state${record.state === 'failed' ? ' is-failed' : ''}`;
  $('#retry-save').hidden = record.state !== 'failed' || record.baseline;
  const earlier = failedBaseline().filter(r => r !== record);
  const name = (r: SaveRecord) => r.testNumber ? `Test ${r.testNumber}` : 'An earlier test';
  const earlierRow = earlier.length ? `<p class="note unsaved-earlier">${earlier.length === 1 ? `${name(earlier[0]!)} isn’t saved yet, so it doesn’t count.` : `${earlier.length} earlier tests aren’t saved yet, so they don’t count.`} <button class="key key-small" id="retry-earlier" type="button">retry saving</button></p>` : '';
  const wire = () => document.querySelector('#retry-earlier')?.addEventListener('click', () => earlier.forEach(retry));

  if (outcome === 'planend') {
    block.innerHTML = '';
    actions({ label: 'suggested again', href: href('practice', { kind: 'recommended', plan: 'finite' }) }, { label: 'general', href: href('practice', { kind: 'general' }) });
    return;
  }
  if (page !== 'assessment') { block.innerHTML = ''; actions({ label: 'next block', onClick: nextTest }, { label: 'assessment', href: href('assessment') }); return; }
  const n = nextTestNumber(status);
  if (!record.baseline && outcome !== 'flagged') {
    const why = !qwerty ? 'Not a baseline test (qwerty off). Baseline tests are 30 seconds on a physical QWERTY keyboard.' : durationS !== 30 ? `Not a baseline test (${durationS} s). Baseline tests are 30 seconds.` : 'Declared. Your next 30-second test counts.';
    block.innerHTML = usable() && status.counted < status.target
      ? `<div class="baseline-block">${earlierRow}<p class="note">${why} Still ${countText(status)}.</p>${!qwerty ? `<button class="key key-small" id="declare" type="button">${declareQwerty}</button>` : ''}</div>` : earlierRow ? `<div class="baseline-block">${earlierRow}</div>` : '';
    document.querySelector('#declare')?.addEventListener('click', declare);
    if (qwerty && durationS === 30 && counting()) actions({ label: takeTestLabel(status).replace(' →', ''), onClick: nextTest }, { label: 'practice next', href: href('practice') });
    else actions({ label: 'practice next', href: href('practice') }, { label: 'fresh retest', onClick: nextTest });
    wire(); return;
  }
  if (outcome === 'flagged') {
    block.innerHTML = snapshot?.baseline ? `<div class="baseline-block">${earlierRow}${progress()}<p>Not counted: focus left the text during the run. Still ${countText(status)}; nothing is taken away.</p></div>` : '';
    actions({ label: n ? `try test ${n} again` : 'try the test again', onClick: nextTest }, { label: 'practise', href: href('practice') });
    wire(); formatProgress(); return;
  }
  const final = record.testNumber !== null ? record.testNumber >= status.target : status.counted + status.pending >= status.target;
  if (record.state === 'failed') {
    block.innerHTML = `<div class="baseline-block">${earlierRow}${progress()}<p class="lead-line">Not saved yet, so it doesn’t count.</p><p class="note">Retrying is safe. If you go on, it keeps waiting here to be saved.</p></div>`;
    actions({ label: 'retry saving', onClick: () => retry(record) }, final ? { label: 'practise', href: href('practice') } : { label: 'next test', onClick: nextTest });
  } else if (record.state === 'saving') {
    block.innerHTML = `<div class="baseline-block">${earlierRow}${progress()}<p>${final ? `Saving test ${record.testNumber ?? status.target}…` : 'Saving…'}</p></div>`;
    if (final) actions({ label: 'practise', href: href('practice') }, { label: 'another assessment', href: href('assessment') });
    else actions({ label: 'next test', onClick: nextTest }, { label: 'practise', href: href('practice') }, 'or stop here; progress is kept');
  } else if (status.counted >= status.target && final) {
    const shown = shownReason(status);
    const lead = `<div class="baseline-block">${earlierRow}${progress()}<p class="lead-line">Baseline complete.</p>${summaryBlock()}`;
    if (status.state === 'complete-ready' && coachingOn() && status.focus) {
      block.innerHTML = `${lead}<p>Suggested has a focus: ${status.focus.pair}. ${focusExplanation(status.focus)}</p><p class="note">${ruleOfThumbShort}</p></div>`;
      kind = 'recommended';
      actions({ label: `try suggested · ${status.focus.pair}`, href: href('practice') }, { label: 'general', href: href('practice', { kind: 'general' }) });
    } else {
      const after = shown === 'coaching-deferred' ? '' : shown === 'scan-incomplete' ? 'Using general until it can be read.' : generalFits;
      block.innerHTML = `${lead}<p>${reasonSentence(status)}</p>${after ? `<p class="note">${after}</p>` : ''}</div>`;
      kind = 'general';
      actions({ label: 'practise general', href: href('practice') }, { label: 'another assessment', href: href('assessment') });
    }
  } else {
    block.innerHTML = `<div class="baseline-block">${earlierRow}${progress()}<p>Every finished test counts, mistakes included.</p><p class="note">Progress is kept in this browser. Stop any time and pick up later.</p></div>`;
    actions({ label: 'next test', onClick: nextTest }, { label: 'practise', href: href('practice') }, 'or stop here; progress is kept');
  }
  wire();
  formatProgress();
}

function progressPage() {
  const v = summaryView(status);
  const body = !usable() ? `<p class="small">${status.state === 'checking' ? 'Checking saved tests…' : `${reasonSentence(status)} ${worksAsUsual}`}</p>` : `
    ${progress('counted')}
    ${v.kind !== 'none' ? summaryBlock(true) : ''}
    <p class="small">From 30-second assessments saved in this browser with the qwerty key on. Practice blocks don’t count.</p>
    ${status.counted < status.target || !status.exact ? `<a class="key key-small" href="${href('assessment')}">${takeTestLabel(status)}</a>` : ''}`;
  shell(`<div class="page-heading"><div><p class="eyebrow">Progress</p><h1>What you have done so far.</h1></div></div>
  <section class="panel baseline-section" aria-labelledby="baseline-heading">
    <h2 id="baseline-heading" tabindex="-1">Baseline</h2>
    ${body}
    <p class="status" id="baseline-status" role="status"></p>
    <p class="small">Start a new baseline if someone else used this browser or you changed keyboards. Your saved results stay in your history; they just stop counting toward the baseline.</p>
    <div id="reset-area"><button class="key" id="reset" type="button">start a new baseline</button></div>
  </section>
  <section class="panel"><p class="small">Activity, assessment trend and the session list are unchanged (not prototyped).</p></section>`, false);
  formatProgress();
  const area = $('#reset-area');
  const confirm = () => {
    area.innerHTML = `<div class="reset-confirm" role="group" aria-labelledby="reset-question"><p id="reset-question">Start a new baseline at 0 of ${status.target}? Saved results stay in your history.</p>
      <div class="actions"><button class="key" id="keep" type="button">keep current baseline</button><button class="key" id="start-over" type="button">start over</button></div></div>`;
    $('#keep').addEventListener('click', () => { progressPage(); $('#reset').focus(); });
    $('#start-over').addEventListener('click', () => { status = { ...structuredClone(statuses.sReset!), automaticCoaching: status.automaticCoaching, evidenceScanComplete: status.evidenceScanComplete === null ? null : true }; progressPage(); done(); });
    $('#keep').focus();
  };
  const done = () => { $('#baseline-status').textContent = `New baseline started: 0 of ${status.target}. Earlier results are still in your history.`; $('#baseline-heading').focus(); };
  $('#reset').addEventListener('click', confirm);
  if (view === 'confirm') confirm();
  if (view === 'done') done();
}

async function boot() {
  await Promise.all(['ui-segmented-control', 'ui-switch', 'ui-collapsible', 'ui-progress'].map(n => customElements.whenDefined(n)));
  if (page === 'progress') progressPage();
  else {
    stage();
    if (view === 'result') { stop(); complete(params.get('outcome') ?? 'saved'); }
    if (view === 'planend') { stop(); promptIndex = finitePlan.length - 1; paintPrompt(); complete('planend', 24); }
  }
  document.body.dataset.ready = '1';
}
document.body.dataset.page = page === 'practice' ? 'home' : page;
void boot();
