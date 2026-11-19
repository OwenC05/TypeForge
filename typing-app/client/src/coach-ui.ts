// Presentation only: maps the actual P1 r2 PreparedStatus to the accepted copy deck
// (ux/prototype/copy.ts, independent APPROVE 82006aa). Nothing here derives a statistic,
// a count, an ordinal or a proof; every number comes from the status as projected by D.
import type { Focus, PreparedStatus, Reason } from './coach-types.ts';

export const TARGET = 10;
export const PILOT_SECONDS = 30;

export const reasons = [
  'policy-invalid', 'storage-unavailable', 'context-unavailable', 'source-integrity', 'scan-incomplete', 'baseline-incomplete',
  'coaching-deferred', 'stale-evidence', 'too-few-observations-for-any-pair', 'insufficient-context-diversity', 'unstable-evidence',
  'no-effect', 'corpus-coverage', 'exposure-unsupported',
] as const;
type PresentedReason = typeof reasons[number];
/** Reasons that only exist because a coaching gate ran. They are shown only when one did. */
export const gateReasons: readonly string[] = ['stale-evidence', 'too-few-observations-for-any-pair', 'insufficient-context-diversity',
  'unstable-evidence', 'no-effect', 'corpus-coverage', 'exposure-unsupported'];

export type BaselineState = 'checking' | 'not-started' | 'in-progress' | 'pending' | 'complete-ready' | 'complete-insufficient' | 'unavailable';
export interface FocusView { pair: string; pairGeometricMs: number; referenceGeometricMs: number; observations: number; sourceRuns: number; wordContexts: number }
export interface SummaryState {
  state: 'available' | 'pending' | 'unavailable' | 'not-complete';
  selectionProofComplete: boolean;
  medianWpm: number | null; medianAccuracy: number | null; validAccuracySources: number;
  from: string | null; to: string | null;
}
/** UI view of one prepared status. `counted` is null whenever no count may be shown. */
export interface BaselineView {
  state: BaselineState;
  counted: number | null;
  exact: boolean;
  ordinal: number | null;
  pending: number;
  evidenceScanComplete: boolean | null;
  automaticCoaching: 'enabled' | 'disabled' | 'unavailable';
  reason: Reason | string | null;
  focus: FocusView | null;
  summary: SummaryState | null;
}

const checkingView: BaselineView = { state: 'checking', counted: null, exact: false, ordinal: null, pending: 0, evidenceScanComplete: null,
  automaticCoaching: 'enabled', reason: null, focus: null, summary: null };

/** The focus as the explanation presents it: geometric means of the clean intervals D already selected. */
export function focusView(f: Focus): FocusView {
  return { pair: f.pair, pairGeometricMs: Math.exp(f.targetLogSum / f.targetCount), referenceGeometricMs: Math.exp(f.referenceLogSum / f.referenceCount),
    observations: f.targetCount, sourceRuns: f.sourceRuns, wordContexts: f.wordContexts };
}

/** Each component is read from its own projection; nothing is borrowed from another. */
export function baselineView(status: PreparedStatus | null): BaselineView {
  if (!status) return checkingView;
  const p = status.participation;
  const base = { pending: status.pendingSave, evidenceScanComplete: status.evidenceScanComplete,
    automaticCoaching: status.automaticCoaching, summary: summaryState(status), focus: null as FocusView | null };
  if (p.state === 'unavailable') return { ...base, state: 'unavailable', counted: null, exact: false, ordinal: null, reason: p.reason };
  if (p.state === 'pending') return { ...base, state: 'pending', counted: p.counted, exact: false, ordinal: null, reason: 'scan-incomplete' };
  if (p.state === 'not-started' || p.state === 'in-progress') {
    return { ...base, state: p.state, counted: p.counted, exact: status.baselineProofComplete, ordinal: p.ordinal, reason: p.reason };
  }
  const complete = { ...base, counted: TARGET, exact: true, ordinal: null };
  const coach = status.coach;
  if (coach.state === 'complete-ready') return { ...complete, state: 'complete-ready', reason: coach.reason, focus: focusView(coach.snapshot.focus) };
  if (coach.state === 'pending') return { ...complete, state: 'pending', reason: 'scan-incomplete' };
  // Unavailable, not requested and insufficient all leave a complete milestone with a reason sentence.
  return { ...complete, state: 'complete-insufficient', reason: coach.reason };
}

function summaryState(status: PreparedStatus): SummaryState | null {
  const s = status.summary;
  if (s.state === 'available') return { state: 'available', selectionProofComplete: status.summarySelectionProofComplete,
    medianWpm: s.value.medianWpm, medianAccuracy: s.value.medianAccuracy, validAccuracySources: s.value.validAccuracySources,
    from: s.value.timeRange.from, to: s.value.timeRange.to };
  return { state: s.state, selectionProofComplete: status.summarySelectionProofComplete, medianWpm: null, medianAccuracy: null,
    validAccuracySources: 0, from: null, to: null };
}

const isReason = (value: unknown): value is PresentedReason => (reasons as readonly string[]).includes(value as string);
const coachingOn = (s: BaselineView) => s.automaticCoaching === 'enabled';
/** A gate reason is presented only if coaching is on and the gate's evidence scan completed. */
export function shownReason(s: BaselineView): PresentedReason | 'unknown' {
  if (!isReason(s.reason)) return 'unknown';
  if (s.automaticCoaching === 'unavailable' && (s.reason === 'coaching-deferred' || gateReasons.includes(s.reason))) return 'unknown';
  if (gateReasons.includes(s.reason) && (!coachingOn(s) || s.evidenceScanComplete !== true)) return coachingOn(s) ? 'scan-incomplete' : 'coaching-deferred';
  return s.reason;
}

export const reasonText: Record<PresentedReason | 'unknown', string> = {
  'policy-invalid': 'Suggested is unavailable in this version of TypeForge.',
  'storage-unavailable': 'Suggested needs results saved in this browser, and saving isn’t available here (a private window can do this).',
  'context-unavailable': 'The baseline record in this browser couldn’t be read, so tests aren’t being counted right now.',
  'source-integrity': 'Some saved results couldn’t be checked, so tests aren’t being counted right now.',
  'scan-incomplete': 'Not every saved result could be read just now, so this may be incomplete.',
  'baseline-incomplete': 'Suggested can look for a focus after 10 baseline tests.',
  'coaching-deferred': 'Suggested practice isn’t switched on in this version. General and pair practice work as usual.',
  'stale-evidence': 'Your baseline is complete, but its timing is more than 30 days old. A fresh 30-second assessment or two lets Suggested look again.',
  'too-few-observations-for-any-pair': 'No key pair has come up often enough in finished sentences yet to compare fairly.',
  'insufficient-context-diversity': 'The slower pairs so far came from too few different words to be sure.',
  'unstable-evidence': 'One pair looked slower, but not consistently across your earlier and later runs.',
  'no-effect': 'No key pair stands out clearly from the rest.',
  'corpus-coverage': 'The pair that stood out appears in too few practice sentences to build a focused block.',
  'exposure-unsupported': 'There aren’t enough practice sentences with that pair to give it real practice in one block.',
  unknown: 'Suggested is unavailable right now.',
};
export const reasonSentence = (s: BaselineView) => reasonText[shownReason(s)];
export const worksAsUsual = 'General and pair practice work as usual.';
export const staleAfter = 'Your 10 tests still count; only the timing needs refreshing.';
export const generalFits = 'General practice fits best for now, and pair practice lets you pick a pair yourself. Suggested re-checks after each saved 30-second run.';
/** What follows a complete-baseline reason: the re-check promise only after a gate that ran. */
export function afterReason(s: BaselineView): string {
  const shown = shownReason(s);
  if (shown === 'coaching-deferred') return '';
  if (shown === 'scan-incomplete') return 'Using general until it can be read.';
  if (shown === 'stale-evidence') return staleAfter;
  return gateReasons.includes(shown) ? generalFits : worksAsUsual;
}

export const usable = (s: BaselineView) => s.state !== 'unavailable' && s.state !== 'checking' && s.counted !== null;
export const countText = (s: BaselineView) => `${s.exact ? '' : 'at least '}${Math.min(s.counted ?? 0, TARGET)} of ${TARGET}`;
/** D's ordinal, printed only with an exact proof; never from a lower bound, at the cap, or while checking. */
export function nextTestNumber(s: BaselineView): number | null {
  if (!s.exact || !usable(s) || s.ordinal === null) return null;
  return s.ordinal <= TARGET ? s.ordinal : null;
}
export const takeTestLabel = (s: BaselineView) => { const n = nextTestNumber(s); return n ? `take test ${n} →` : 'take a baseline test →'; };
/** A new 30 s QWERTY assessment can still add to participation: below the cap, or a readable lower bound. */
export const counting = (s: BaselineView) => usable(s) && (s.counted ?? 0) < TARGET && !(s.exact && s.ordinal === null);

export function baselinePurpose(s: BaselineView) {
  const tests = '30-second assessments on a physical QWERTY keyboard (the qwerty key on), about five minutes of typing, at your own pace';
  return coachingOn(s)
    ? `Suggested can look for a focus after ${TARGET} baseline tests: ${tests}.`
    : `${TARGET} short baseline tests give a steady picture of your typing: ${tests}.`;
}
export const everyTestCounts = 'Every finished test counts, mistakes included. A run that stops early or loses focus just doesn’t count; nothing is taken away.';
export const countSource = 'Counted from the tests saved in this browser: deleting one, or starting a new baseline on the progress page, lowers the count.';

const ms = (value: number) => `${Math.round(value)} ms`;
export function focusExplanation(focus: FocusView) {
  return `In your recent runs, ${focus.pair} took longer than your other key pairs: ${ms(focus.pairGeometricMs)} against ${ms(focus.referenceGeometricMs)}, across ${focus.observations} clean ${focus.pair} transitions in ${focus.wordContexts} different words and ${focus.sourceRuns} runs.`;
}
// Copy correction (actual Claude, design owner): the certified plans contain only sentences with the pair
// (root msg_2119dbb98d07: he/in/le/th, 12 prompts each, none without the pair), so the prototype's
// "with general sentences mixed in" would promise a mixture the plan does not have.
export const suggestedPlanLine = (pair: string) => `Every sentence in this block contains ${pair}. It is one fixed set of sentences, so it can end before the timer.`;
export const ruleOfThumb = 'A rule of thumb from your own timings, not a diagnosis or a proven training method. It re-checks before every block and may change focus or step back to general.';
export const ruleOfThumbShort = 'A rule of thumb from your own timings, not a diagnosis.';

export const summaryLabel = `Last ${TARGET} tests · median`;
export const summaryUpdates = 'Updates as you take more 30-second tests. Practice doesn’t change it.';
export const summaryReading = `${summaryLabel}: your latest tests are still being read.`;
export const summaryUpdating = 'Updating after your latest test is saved.';
/** The newest-ten time range as local calendar days (the projection carries UTC instants). */
export const summaryRange = (from: string, to: string, locale?: string) => {
  const day = (iso: string) => new Date(iso).toLocaleDateString(locale ?? 'en-GB', { day: 'numeric', month: 'short' });
  return day(from) === day(to) ? day(to) : `${day(from)} – ${day(to)}`;
};
export type SummaryView =
  | { kind: 'figures'; wpm: string; accuracy: string | null; note: string | null; range: string; updating: boolean }
  | { kind: 'reading' } | { kind: 'none' };
/** Figures need the available summary and its own ordering proof; never a cached or partial median. */
export function summaryView(s: BaselineView): SummaryView {
  const sum = s.summary;
  if (!sum || !usable(s)) return { kind: 'none' };
  if (sum.state === 'available' && sum.selectionProofComplete && sum.medianWpm !== null && sum.from && sum.to) {
    return { kind: 'figures', wpm: sum.medianWpm.toFixed(1), range: summaryRange(sum.from, sum.to), updating: s.pending > 0,
      accuracy: sum.medianAccuracy === null ? null : `${sum.medianAccuracy.toFixed(1)}%`,
      note: sum.medianAccuracy === null ? `Accuracy isn’t available for all ${TARGET}, so only speed is shown.` : null };
  }
  const milestone = s.exact && s.counted === TARGET;
  if (milestone && (sum.state === 'pending' || sum.state === 'available')) return { kind: 'reading' };
  return { kind: 'none' };
}

export const declareQwerty = 'my keyboard is qwerty';
export const qwertyHint = 'Baseline tests need QWERTY.';

/** Slot copy for a press on the locked Suggested key: short enough for the 320 px slot with its action key. */
export function lockedPress(s: BaselineView): { text: string; action?: 'take-test' | 'check-again' | 'assessment'; label?: string } {
  const shown = shownReason(s);
  if (s.state === 'checking') return { text: 'Checking saved tests…' };
  if (s.state === 'unavailable' || shown === 'unknown') {
    if (shown === 'storage-unavailable') return { text: 'Suggested needs results saved in this browser; saving is off here.' };
    if (shown === 'context-unavailable' || shown === 'source-integrity') return { text: 'Saved tests can’t be counted right now. General works as usual.' };
    return { text: 'Suggested is unavailable here. General works as usual.' };
  }
  if (s.automaticCoaching === 'unavailable') return { text: 'Suggested is unavailable here. General works as usual.' };
  if (!coachingOn(s)) return { text: 'Suggested isn’t switched on in this version. General works as usual.' };
  if (shown === 'scan-incomplete') {
    if (s.exact && s.counted === TARGET) return { text: 'Baseline done; recent timing couldn’t all be read.', action: 'check-again', label: 'check again' };
    if (!s.counted) return { text: 'Saved tests couldn’t all be read just now.', action: 'check-again', label: 'check again' };
    return { text: `At least ${Math.min(s.counted, TARGET)} of ${TARGET} found; some results couldn’t be read.`, action: 'check-again', label: 'check again' };
  }
  if (s.state === 'complete-insufficient') {
    return shown === 'stale-evidence'
      ? { text: 'Baseline done; its timing is over 30 days old.', action: 'assessment', label: 'take an assessment →' }
      : { text: 'Baseline done; Suggested has no focus for now. More in why?' };
  }
  return { text: `Suggested needs ${TARGET} baseline tests · ${s.exact ? '' : 'at least '}${s.counted} done.`, action: 'take-test', label: takeTestLabel(s) };
}

/** Screen-reader description of the Suggested key (aria-describedby). */
export function suggestedDescription(s: BaselineView, locked: boolean, pilot = true) {
  if (!locked && s.focus) return `Available: ${s.focus.pair}${pilot ? '' : ` (${PILOT_SECONDS} s, qwerty on)`}.`;
  if (s.state === 'checking') return 'Checking saved tests.';
  if (s.state === 'unavailable' || shownReason(s) === 'unknown') return `${reasonSentence(s)} ${worksAsUsual}`;
  if (s.automaticCoaching === 'unavailable') return `${reasonText.unknown} ${worksAsUsual}`;
  if (!coachingOn(s)) return reasonText['coaching-deferred'];
  if ((s.counted ?? 0) < TARGET || !s.exact) return `Not yet available: ${countText(s)} baseline tests.`;
  return `Baseline complete; Suggested has no focus for now. ${reasonSentence(s)}`;
}

export const noFocusFallback = 'Suggested has no focus for now, so this block is general. More in why?';
/** Suggested was being re-checked (a storage change, or returning to the tab) when the first letter came: General ran. */
export const recheckFallback = 'Suggested was re-checking your saved tests, so this block is general. It checks again for the next block.';
export function suggestedContextHint(durationS: number, qwerty: boolean): { text: string; action: 'use-30' | 'declare'; label: string } | null {
  if (durationS !== PILOT_SECONDS) return { text: `Suggested runs at ${PILOT_SECONDS} s only; this block is general.`, action: 'use-30', label: `use ${PILOT_SECONDS} s` };
  if (!qwerty) return { text: 'Suggested needs QWERTY; this is general.', action: 'declare', label: declareQwerty };
  return null;
}
export const suggestedContextWhy = (pair: string, durationS: number, qwerty: boolean) =>
  `Suggested blocks are ${PILOT_SECONDS} seconds with the qwerty key on. ${durationS !== PILOT_SECONDS ? `At ${durationS} s` : 'With qwerty off'} this block is general practice, and nothing about it changes your focus. Choose ${durationS !== PILOT_SECONDS ? `${PILOT_SECONDS} s` : 'qwerty'} to practise ${pair}.`;

/** Change explanation, only against the previous admitted snapshot held in this document. */
export function changeHint(previousPair: string | null, s: BaselineView): string {
  if (!previousPair) return '';
  if (s.state === 'complete-ready' && s.focus && s.focus.pair !== previousPair) {
    return `Suggested now leans on ${s.focus.pair}. ${previousPair} no longer stands out in your recent timing; that’s a re-check, not a verdict.`;
  }
  if (s.state === 'complete-insufficient' && gateReasons.includes(shownReason(s))) {
    return `Suggested stepped back to general: ${previousPair} no longer stands out clearly in your recent timing. It re-checks before every block.`;
  }
  return '';
}

export const planEndMarker = '— end of this block —';
/** Seconds as typed, truncated to one decimal; never rounded up toward the scheduled duration. */
export const elapsedSeconds = (elapsedMs: number) => (Math.floor(elapsedMs / 100) / 10).toLocaleString('en', { maximumFractionDigits: 1 });
export const planEndLabel = (pair: string, sentences: number, elapsedMs: number) =>
  `Suggested practice · ${pair} · all ${sentences} sentences done at ${elapsedSeconds(elapsedMs)} s of ${PILOT_SECONDS}`;
export const planEndLine = (pair: string) => `That’s every sentence in this ${pair} block, so it ended before the timer. The next suggested block uses the same small set of sentences.`;
export const planEndFigures = (elapsedMs: number) => `over the ${elapsedSeconds(elapsedMs)} s typed`;
