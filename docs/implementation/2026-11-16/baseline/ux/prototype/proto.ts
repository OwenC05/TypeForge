import '../../../../../../typing-app/client/src/style.css';
import './baseline.css';
import '@ui-sdk/web/segmented-control';
import '@ui-sdk/web/switch';
import '@ui-sdk/web/collapsible';
import '@ui-sdk/web/progress';
import type { UiCollapsibleElement } from '@ui-sdk/web';
import { type BaselineStatus, countText, nextTestNumber, reasonText, generalFits, focusExplanation, ruleOfThumb, ruleOfThumbShort, lockedPress } from './copy.ts';
import { statuses } from './fixtures.ts';

// Prototype of the baseline flow on top of the accepted production markup and stylesheet.
// It owns no storage: state arrives in the URL (fx fixture or s= serialised status).
const params = new URLSearchParams(location.search);
const page = (params.get('page') ?? 'practice') as 'practice' | 'assessment' | 'progress';
const view = params.get('view') ?? 'ready';
const fast = params.get('fast') === '1';
let status: BaselineStatus = params.has('s') ? JSON.parse(atob(params.get('s')!)) : structuredClone(statuses[params.get('fx') ?? 's0'] ?? statuses.s0!);
let qwerty = params.get('qwerty') !== '0';
let durationS = Number(params.get('dur') ?? 30);
let kind = params.get('kind') ?? 'general';
const app = document.querySelector<HTMLDivElement>('#app')!;
const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const esc = (text: string) => text.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

const prompts = ['the weather turned cold before the storm', 'a row of yellow flowers lines the garden wall', 'please leave your muddy shoes beside the mat', 'they gathered their things and left together'];

const locked = () => status.state !== 'complete-ready';
const counting = () => page === 'assessment' && status.counted < status.target && status.state !== 'unavailable' && status.state !== 'checking';
const countsNow = () => counting() && qwerty && durationS === 30;
const href = (to: string, extra: Record<string, string> = {}) => `?${new URLSearchParams({ page: to, s: btoa(JSON.stringify(status)), qwerty: qwerty ? '1' : '0', ...(to === 'practice' ? { kind } : {}), ...extra })}`;

function shell(content: string, stage: boolean) {
  const here = page;
  const links = [['practice', href('practice')], ['assessment', href('assessment')], ['progress', href('progress')], ['lab', '#']]
    .map(([name, link]) => `<a href="${link}" ${here === name ? 'aria-current="page"' : ''}>${name}</a>`).join('');
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
// No tally at 0: the first visit stays identical to the accepted UI.
const tally = () => status.state === 'checking' || status.state === 'unavailable' || status.counted === 0 || status.counted >= status.target ? ''
  : `<span class="tally" aria-hidden="true">${Array.from({ length: status.target }, (_, i) => `<i ${i < status.counted ? 'data-on' : i < status.counted + status.pending ? 'data-pending' : ''}></i>`).join('')}</span>`;
function suggestedDescription() {
  if (!locked()) return `Available: ${status.focus!.pair}.`;
  if (status.state === 'checking') return 'Checking saved tests.';
  if (status.state === 'unavailable') return reasonText[status.reason ?? 'policy-invalid'];
  if (status.counted < status.target) return `Not yet available: ${countText(status)} baseline tests.`;
  return `Baseline complete; no focus yet. ${reasonText[status.reason ?? 'no-effect']}`;
}

function whyBaseline(): string {
  if (status.state === 'checking') return `<div class="baseline-block"><p>Checking saved tests…</p></div>`;
  if (status.state === 'unavailable') return `<div class="baseline-block"><p>${reasonText[status.reason ?? 'policy-invalid']}</p><p class="note">General and pair practice work as usual.</p></div>`;
  const source = 'Counted from the tests saved in this browser: deleting one, or starting a new baseline on the progress page, lowers the count.';
  if (status.counted < status.target) {
    return `<div class="baseline-block">${progress()}
      <p>Suggested can look for a focus after ${status.target} baseline tests: 30-second assessments with the qwerty key on, about five minutes in all, at your own pace.</p>
      <p>Every finished test counts, mistakes included. A run that stops early or loses focus just doesn’t count; nothing is taken away.</p>
      ${status.reason === 'scan-incomplete' ? `<p class="note">${reasonText['scan-incomplete']}</p>` : ''}
      <p class="note">${source}</p>
      <a class="key key-small" href="${href('assessment')}">take test ${nextTestNumber(status)} →</a></div>`;
  }
  if (status.state === 'complete-ready' && kind === 'recommended') {
    return `<div class="baseline-block"><p class="micro">suggested · ${status.focus!.pair}</p>
      <p>${focusExplanation(status.focus!)}</p>
      <p>These blocks lean on sentences containing ${status.focus!.pair}, with general sentences mixed in.</p>
      <p class="note">${ruleOfThumb} Prefer an even mix? Choose general.</p></div>`;
  }
  if (status.state === 'complete-ready') {
    return `<div class="baseline-block">${progress()}<p>Suggested has a focus: ${status.focus!.pair}. Choose suggested to practise it.</p><p class="note">${focusExplanation(status.focus!)}</p></div>`;
  }
  const reason = status.reason ?? 'no-effect';
  return `<div class="baseline-block">${progress()}<p>Baseline complete. ${reasonText[reason]}</p>
    <p class="note">${reason === 'scan-incomplete' ? 'Using general until it can be read.' : reason === 'stale-evidence' ? 'Your 10 tests still count; only the timing needs refreshing.' : generalFits}</p>
    ${reason === 'stale-evidence' ? `<a class="key key-small" href="${href('assessment')}">take an assessment →</a>` : ''}</div>`;
}

function blockLabel() {
  if (page === 'assessment') return countsNow() ? `Baseline test ${nextTestNumber(status)} of ${status.target} · ${durationS} s` : `Assessment · ${durationS} s`;
  return kind === 'recommended' && !locked() ? `Suggested practice · ${status.focus!.pair} · ${durationS} s` : `General practice · ${durationS} s`;
}

// Ready-state slot line (level 1 hint). Empty means the accepted idle hint shows.
function readyHint(): string {
  if (page === 'assessment' && counting()) {
    if (!qwerty) return 'Not a baseline test: it needs the qwerty key on (a physical QWERTY keyboard).';
    if (durationS !== 30) return 'Not a baseline test: baseline tests are 30 seconds.';
    return `baseline test ${nextTestNumber(status)} of ${status.target} — the clock starts with your first letter`;
  }
  if (page === 'practice' && status.change?.kind === 'changed') return `Suggested now leans on ${status.focus!.pair}. ${status.change.from} no longer stands out in your recent timing; that’s a re-check, not a verdict.`;
  if (page === 'practice' && status.change?.kind === 'stepped-back') return `Suggested stepped back to general: ${status.change.from} no longer stands out clearly in your recent timing. It re-checks before every block.`;
  return '';
}

let running = false, flagged = false, startedAt = 0, timer = 0, promptIndex = 0;
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
        <ui-segmented-control-item value="recommended" id="suggested-item" ${locked() ? 'data-locked aria-disabled="true"' : ''} aria-describedby="suggested-status">suggested${locked() ? tally() : ''}</ui-segmented-control-item>
      </ui-segmented-control>
      <span id="suggested-status" class="sr-only">${esc(suggestedDescription())}</span>
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
  const text = prompts[promptIndex % prompts.length]!;
  const typed = input.value;
  $('#prompt').innerHTML = [...text].map((c, i) => `<span class="${i < typed.length ? (typed[i] === c ? 'correct' : 'wrong') : ''}${i === typed.length ? ' cursor' : ''}">${c === ' ' ? ' ' : esc(c)}</span>`).join('') + (typed.length >= text.length ? '<span class="cursor"> </span>' : '');
  $('#previous-prompt').textContent = promptIndex ? prompts[(promptIndex - 1) % prompts.length]! : '';
  $('#next-prompt').textContent = prompts[(promptIndex + 1) % prompts.length]!;
}

function wire() {
  const input = $<HTMLTextAreaElement>('#typing-input');
  const stageEl = $('#stage');
  const why = $<UiCollapsibleElement>('#why');
  $('#why-panel').innerHTML = `${whyBaseline()}<p>${page === 'assessment' ? 'English · lowercase · fresh assessment passages' : 'English · lowercase · short sentences'}</p><p>The timer keeps running if you leave the text. Interrupted runs stay in history, outside headline progress.</p>`;
  formatProgress();
  paintPrompt();
  hint(readyHint());
  input.addEventListener('focus', () => { stageEl.dataset.focus = 'in'; });
  input.addEventListener('blur', () => { stageEl.dataset.focus = 'out'; if (running) { flagged = true; hint('Focus left the text: this run is flagged and excluded from headline progress. The timer kept running.'); $('#exercise-warning').className = 'slot-text is-notice'; } });
  $('#continue-typing').addEventListener('click', () => input.focus());
  input.addEventListener('input', () => {
    if (!running) start();
    const text = prompts[promptIndex % prompts.length]!;
    if (input.value === `${text} `) { promptIndex++; input.value = ''; }
    paintPrompt();
  });
  $('#restart').addEventListener('click', () => { stop(); stage(); $<HTMLTextAreaElement>('#typing-input').focus(); });
  $('#duration').addEventListener('valuechange', (event) => { durationS = Number((event as CustomEvent).detail.value); refreshReady(); });
  $('#qwerty').addEventListener('checkedchange', (event) => { qwerty = Boolean((event as CustomEvent).detail.value ?? (event as CustomEvent).detail.checked); refreshReady(); });
  document.querySelector('#practice-kind')?.addEventListener('valuechange', (event) => {
    const value = (event as CustomEvent).detail.value;
    if (value === 'recommended' && locked()) { event.preventDefault(); pressExplanation(); return; }
    kind = value; refreshReady();
  });
  const suggested = document.querySelector('#suggested-item');
  // A press on the already-focused locked key (no value change) still explains.
  suggested?.addEventListener('click', () => { if (locked()) pressExplanation(); });
  if (view === 'why') { why.api.open?.(); (why.querySelector('button') as HTMLButtonElement).focus(); }
  else if (view === 'press' && suggested) requestAnimationFrame(() => { (suggested as HTMLElement).focus(); pressExplanation(); });
  else input.focus();
}
function refreshReady() {
  $('#block-identity').textContent = blockLabel();
  $('#remaining').textContent = String(durationS);
  hint(readyHint());
}

function start() {
  running = true; flagged = false; startedAt = performance.now();
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

// In-place result. outcome: saved | flagged | savefail. Counting happens only after a durable save.
function complete(outcome: string) {
  document.body.dataset.run = 'completed';
  const stageEl = $('#stage');
  stageEl.dataset.state = 'completed';
  const input = $<HTMLTextAreaElement>('#typing-input');
  input.disabled = true;
  if (!$('#exercise-warning').classList.contains('is-notice')) hint('');
  const isBaseline = countsNow();
  const testNumber = nextTestNumber(status);
  const willFinish = isBaseline && status.counted + 1 >= status.target;
  const final = params.get('final') ?? 'ready';
  if (isBaseline && outcome !== 'flagged') status.pending = 1;
  const label = page === 'assessment' ? (isBaseline && outcome !== 'flagged' ? `Baseline test ${testNumber} of ${status.target}` : 'Assessment') : blockLabel().replace(/ · \d+ s$/, '');
  const completion = $('#completion');
  completion.hidden = false;
  completion.innerHTML = `<h2 class="micro result-label">${esc(label)} · ${durationS} s · complete</h2>
    <dl class="result-figures"><div><dt>wpm</dt><dd>41.6</dd></div><div><dt>accuracy</dt><dd>96.2%</dd></div></dl>
    <p class="figures-fixture">simulated fixture figures</p>
    <p class="result-observation">Most first-attempt misses: “e” (3 of 52). An observation, not a diagnosis.</p>
    ${outcome === 'flagged' ? '<p class="result-flag">Flagged: this run was interrupted or used unsupported input. It is saved with a label and excluded from headline progress.</p>' : ''}
    <div id="baseline-result"></div>
    <div class="result-actions" id="result-actions"></div>
    <div class="save-row"><p id="save-state" class="micro save-state" role="status">Saving to this browser…</p><button id="retry-save" class="key key-small" type="button" hidden>retry saving</button><button id="export-current" class="key key-small" type="button">export</button></div>
    <ui-collapsible class="result-details"><ui-collapsible-trigger><button type="button" class="text-button">details</button></ui-collapsible-trigger><ui-collapsible-panel keep-mounted hidden><p class="micro">Details unchanged from the accepted result (not prototyped).</p></ui-collapsible-panel></ui-collapsible>`;

  const actions = (primary: string, primaryHref: string | null, secondary: string, secondaryHref: string, note = '') => {
    $('#result-actions').innerHTML = `${primaryHref ? `<a class="key key-primary" id="primary" href="${primaryHref}">${primary} ↵</a>` : `<button class="key key-primary" id="primary" type="button">${primary} ↵</button>`}<a class="key" id="secondary" href="${secondaryHref}">${secondary}</a>${note ? `<span class="action-note">${note}</span>` : ''}`;
  };
  const nextTest = () => { stop(); status.pending = 0; promptIndex += 2; stage(); };
  // PROPOSAL for root/P1: a descriptive baseline summary, so completion is worth something even with no focus.
  const summaryLine = '<p>Your baseline: 39 wpm and 95.8% accuracy, the median of your 10 tests. <span class="figures-fixture">simulated fixture</span></p>';
  const paintBaseline = () => {
    const block = $('#baseline-result');
    if (page !== 'assessment') { block.innerHTML = ''; return; }
    if (!isBaseline) {
      block.innerHTML = status.counted < status.target && status.state !== 'unavailable'
        ? `<div class="baseline-block"><p class="note">Not a baseline test${!qwerty ? ' (qwerty off)' : ` (${durationS} s)`}. Baseline tests are 30 seconds with the qwerty key on. ${countText(status)} so far.</p></div>` : '';
      actions('practice next', href('practice'), 'fresh retest', href('assessment'));
      return;
    }
    if (outcome === 'flagged') {
      block.innerHTML = `<div class="baseline-block">${progress()}<p>Not counted: focus left the text during the run. Still ${countText(status)}; nothing is taken away.</p></div>`;
      actions(`try test ${testNumber} again`, null, 'practise', href('practice'));
      $('#primary').addEventListener('click', nextTest);
    } else if (status.pending) {
      block.innerHTML = `<div class="baseline-block">${progress()}<p>${outcome === 'savefail' ? 'Counts once it’s saved.' : 'Saving…'}</p></div>`;
      if (willFinish) actions('practise', href('practice'), 'details', '#');
      else { actions('next test', null, 'practise', href('practice'), 'or stop here; progress is kept'); $('#primary').addEventListener('click', nextTest); }
    } else if (status.counted >= status.target && status.state === 'complete-ready') {
      block.innerHTML = `<div class="baseline-block">${progress()}<p class="lead-line">Baseline complete. Suggested has a focus: ${status.focus!.pair}.</p>${summaryLine}<p>${focusExplanation(status.focus!)}</p><p class="note">${ruleOfThumbShort}</p></div>`;
      kind = 'recommended';
      actions(`try suggested · ${status.focus!.pair}`, href('practice'), 'general', href('practice', { kind: 'general' }));
    } else if (status.counted >= status.target) {
      block.innerHTML = `<div class="baseline-block">${progress()}<p class="lead-line">Baseline complete.</p>${summaryLine}<p>${reasonText[status.reason ?? 'no-effect']}</p><p class="note">${generalFits}</p></div>`;
      kind = 'general';
      actions('practise general', href('practice'), 'another assessment', href('assessment'));
    } else {
      block.innerHTML = `<div class="baseline-block">${progress()}<p>Every finished test counts, mistakes included.</p><p class="note">Progress is kept in this browser. Stop any time and pick up later.</p></div>`;
      actions('next test', null, 'practise', href('practice'), 'or stop here; progress is kept');
      $('#primary').addEventListener('click', nextTest);
    }
    formatProgress();
  };
  const saved = () => {
    $('#save-state').textContent = 'Saved in this browser.';
    $('#save-state').className = 'micro save-state';
    $('#retry-save').hidden = true;
    if (isBaseline && status.pending) {
      status.pending = 0; status.counted = Math.min(status.counted + 1, status.target);
      if (status.counted >= status.target) Object.assign(status, structuredClone(final === 'ready' ? statuses.s10ready! : final === 'sparse' ? statuses.s10sparse! : statuses.s10insuff!));
      else status.state = 'in-progress';
    }
    paintBaseline();
    $('#primary').focus();
  };
  paintBaseline();
  $('#primary').focus();
  if (outcome === 'savefail') {
    const state = $('#save-state');
    state.textContent = 'Not saved: this browser refused the write. Your result is kept on this page.';
    state.className = 'micro save-state is-failed';
    $('#retry-save').hidden = false;
    $('#retry-save').addEventListener('click', saved);
    paintBaseline();
    $('#primary').focus();
  } else window.setTimeout(saved, params.get('view') === 'result' ? 0 : 400);
}

function progressPage() {
  shell(`<div class="page-heading"><div><p class="eyebrow">Progress</p><h1>What you have done so far.</h1></div></div>
  <section class="panel baseline-section" aria-labelledby="baseline-heading">
    <h2 id="baseline-heading" tabindex="-1">Baseline</h2>
    ${progress()}
    <p class="small">${countText(status)} baseline tests, counted from 30-second assessments saved in this browser with the qwerty key on. Practice blocks don’t count toward it.${status.otherContextCount ? ` ${status.otherContextCount} assessment at another duration or keyboard setting isn’t part of it.` : ''}</p>
    <p class="status" id="baseline-status" role="status"></p>
    <p class="small">Start a new baseline if someone else used this browser or you changed keyboards. Your saved results stay in your history; they just stop counting toward Suggested.</p>
    <div id="reset-area"><button class="key" id="reset" type="button">start a new baseline</button></div>
  </section>
  <section class="panel"><p class="small">Activity, assessment trend and the session list are unchanged (not prototyped).</p></section>`, false);
  formatProgress();
  const area = $('#reset-area');
  const confirm = () => {
    area.innerHTML = `<div class="reset-confirm" role="group" aria-labelledby="reset-question"><p id="reset-question">Start a new baseline at 0 of ${status.target}? Saved results stay in your history.</p>
      <div class="actions"><button class="key" id="keep" type="button">keep current baseline</button><button class="key" id="start-over" type="button">start over</button></div></div>`;
    $('#keep').addEventListener('click', () => { progressPage(); $('#reset').focus(); });
    $('#start-over').addEventListener('click', () => { status = structuredClone(statuses.sReset!); progressPage(); done(); });
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
  }
  document.body.dataset.ready = '1';
}
document.body.dataset.page = page === 'practice' ? 'home' : page;
void boot();
