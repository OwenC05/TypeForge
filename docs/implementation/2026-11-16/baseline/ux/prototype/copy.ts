// Every user-facing baseline sentence lives here so the copy deck in contract.md and the
// prototype cannot drift. Revision r2 (after the independent review 05a6767): reason handling is
// exhaustive over P1 r1's union, coaching-deferred has its own copy, the rolling summary has its
// own states, and ordinals are never printed from a lower bound.

// P1 r1 (747d3e7) reasons, in its precedence order. The UI never derives one itself.
export const reasons = [
  'policy-invalid', 'storage-unavailable', 'context-unavailable', 'source-integrity', 'scan-incomplete', 'baseline-incomplete',
  'coaching-deferred', 'stale-evidence', 'too-few-observations-for-any-pair', 'insufficient-context-diversity', 'unstable-evidence',
  'no-effect', 'corpus-coverage', 'exposure-unsupported',
] as const;
export type Reason = typeof reasons[number];
/** Reasons that only exist because a coaching gate ran. They are shown only when one did. */
export const gateReasons: readonly Reason[] = ['stale-evidence', 'too-few-observations-for-any-pair', 'insufficient-context-diversity', 'unstable-evidence', 'no-effect', 'corpus-coverage', 'exposure-unsupported'];
export const unavailableReasons: readonly Reason[] = ['policy-invalid', 'storage-unavailable', 'context-unavailable', 'source-integrity'];

// P1 r1 states plus the UI-only 'checking' (the read has not returned). 'pending' = scan-incomplete.
export type BaselineState = 'checking' | 'not-started' | 'in-progress' | 'pending' | 'complete-ready' | 'complete-insufficient' | 'unavailable';

export interface Focus { pair: string; pairGeometricMs: number; referenceGeometricMs: number; observations: number; sourceRuns: number; wordContexts: number }

/** P1 r1 `summary` object (spec "Descriptive completion summary"), reduced to what the UI reads. */
export interface Summary {
  state: 'available' | 'pending' | 'unavailable' | 'not-complete';
  /** P1 summarySelectionProofComplete: the ten are provably the newest ten. Separate from `exact`. */
  selectionProofComplete: boolean;
  medianWpm: number | null;
  medianAccuracy: number | null;
  validAccuracySources: number;
  /** UTC dates (YYYY-MM-DD) of the oldest and newest of the ten. */
  from?: string; to?: string;
}

export interface BaselineStatus {
  policyId: string;
  target: number;
  counted: number;
  /** P1 baselineProofComplete: the capped participation count is exact (or ten witnesses prove 10). */
  exact: boolean;
  /** P1 evidenceScanComplete. null = coaching was not requested (disabled scope), not a failed scan. */
  evidenceScanComplete: boolean | null;
  /** P1 pendingSave, widened by the UI to "completed here, not durably saved yet" (saving or failed, retry still possible). */
  pending: number;
  state: BaselineState;
  reason?: Reason | string;
  focus?: Focus;
  /** From config releaseScope.automaticCoachingEnabled (named by A2 6418bcc). Interface request: expose it on the status. */
  /** P1 r2 projection: 'unavailable' for invalid/unknown config (never inferred from focus or count). */
  automaticCoaching: 'enabled' | 'disabled' | 'unavailable';
  summary: Summary | null;
  /** UI-only, never from storage (delta r2.1): the previous admitted new-coach snapshot held in memory
   *  in this document, compared with the current one. Absent after reload, navigation or when no prior
   *  snapshot exists; the legacy saved `practiceFocus` (old selector) is never used for it. */
  change?: { kind: 'changed' | 'stepped-back'; from: string };
}

const isReason = (value: unknown): value is Reason => (reasons as readonly string[]).includes(value as string);
const coachingOn = (s: BaselineStatus) => s.automaticCoaching === 'enabled';
/** A gate reason is only presented if coaching is on and the gate's evidence scan actually completed. */
export function shownReason(s: BaselineStatus): Reason | 'unknown' {
  if (!isReason(s.reason)) return 'unknown';
  if (gateReasons.includes(s.reason) && (!coachingOn(s) || s.evidenceScanComplete !== true)) return coachingOn(s) ? 'scan-incomplete' : 'coaching-deferred';
  return s.reason;
}

// One plain sentence per reason. None of them says "failed", "level" or "weak".
export const reasonText: Record<Reason | 'unknown', string> = {
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
export const reasonSentence = (s: BaselineStatus) => reasonText[shownReason(s)];
export const worksAsUsual = 'General and pair practice work as usual.';

// After a gate reason only (coaching on, scan complete). Never after coaching-deferred.
export const generalFits = 'General practice fits best for now, and pair practice lets you pick a pair yourself. Suggested re-checks after each saved 30-second run.';

export const ms = (value: number) => `${Math.round(value)} ms`;
export const countText = (s: BaselineStatus) => `${s.exact ? '' : 'at least '}${Math.min(s.counted, s.target)} of ${s.target}`;
/** The next test's ordinal, or null when it must not be printed (lower bound, capped, or unknown). */
export function nextTestNumber(s: BaselineStatus): number | null {
  if (!s.exact || s.state === 'checking' || s.state === 'unavailable') return null;
  const n = s.counted + s.pending + 1;
  return n <= s.target ? n : null;
}
export const takeTestLabel = (s: BaselineStatus) => { const n = nextTestNumber(s); return n ? `take test ${n} →` : 'take a baseline test →'; };

/** What the ten tests are for. Only names Suggested when the shipped config enables it. */
export function baselinePurpose(s: BaselineStatus) {
  const tests = '30-second assessments on a physical QWERTY keyboard (the qwerty key on), about five minutes of typing, at your own pace';
  return coachingOn(s)
    ? `Suggested can look for a focus after ${s.target} baseline tests: ${tests}.`
    : `${s.target} short baseline tests give a steady picture of your typing: ${tests}.`;
}

export function focusExplanation(focus: Focus) {
  return `In your recent runs, ${focus.pair} took longer than your other key pairs: ${ms(focus.pairGeometricMs)} against ${ms(focus.referenceGeometricMs)}, across ${focus.observations} clean ${focus.pair} transitions in ${focus.wordContexts} different words and ${focus.sourceRuns} runs.`;
}
export const ruleOfThumb = 'A rule of thumb from your own timings, not a diagnosis or a proven training method. It re-checks before every block and may change focus or step back to general.';
export const ruleOfThumbShort = 'A rule of thumb from your own timings, not a diagnosis.';

// Rolling newest-ten summary (review finding 2). Never a cached or partial median.
export const summaryLabel = (s: BaselineStatus) => `Last ${s.target} tests · median`;
export const summaryUpdates = 'Updates as you take more 30-second tests. Practice doesn’t change it.';
const day = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
export const summaryRange = (sum: Summary) => sum.from && sum.to ? `${day(sum.from)} – ${day(sum.to)}` : '';
export type SummaryView =
  | { kind: 'figures'; wpm: string; accuracy: string | null; note: string | null; range: string; updating: boolean }
  | { kind: 'reading' } | { kind: 'none' };
/** Summary only shows when ten are proved AND the newest-ten selection is proved; the two proofs stay separate. */
export function summaryView(s: BaselineStatus): SummaryView {
  const sum = s.summary;
  if (!sum || s.counted < s.target || sum.state === 'unavailable' || sum.state === 'not-complete') return { kind: 'none' };
  if (sum.state === 'pending' || !sum.selectionProofComplete || sum.medianWpm === null) return { kind: 'reading' };
  return {
    kind: 'figures', wpm: sum.medianWpm.toFixed(1), range: summaryRange(sum), updating: s.pending > 0,
    accuracy: sum.medianAccuracy === null ? null : `${sum.medianAccuracy.toFixed(1)}%`,
    note: sum.medianAccuracy === null ? `Accuracy isn’t available for all ${s.target}, so only speed is shown.` : null,
  };
}
export const summaryReading = (s: BaselineStatus) => `${summaryLabel(s)}: your latest tests are still being read.`;
export const summaryUpdating = 'Updating after your latest test is saved.';

// Explicit QWERTY declaration (finding 3): a user action, never inferred or default-on.
export const declareQwerty = 'my keyboard is qwerty';
export const qwertyHint = 'Baseline tests need QWERTY.';

// What a press on the locked Suggested key says in the slot. Short by contract: it must fit the
// fixed slot at 320 px with its action key (about 75 characters); the full reason lives in why?.
export function lockedPress(s: BaselineStatus): { text: string; action?: string } {
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
    return s.exact && s.counted >= s.target
      ? { text: 'Baseline done; recent timing couldn’t all be read.', action: 'check again' }
      : { text: `At least ${Math.min(s.counted, s.target)} of ${s.target} found; some results couldn’t be read.`, action: 'check again' };
  }
  if (s.state === 'complete-insufficient') {
    return shown === 'stale-evidence'
      ? { text: 'Baseline done; its timing is over 30 days old.', action: 'take an assessment →' }
      : { text: 'Baseline done; Suggested has no focus for now. More in why?' };
  }
  return { text: `Suggested needs ${s.target} baseline tests · ${s.exact ? '' : 'at least '}${s.counted} done.`, action: takeTestLabel(s) };
}

/** Screen-reader description of the Suggested key. */
export function suggestedDescription(s: BaselineStatus, locked: boolean) {
  if (!locked && s.focus) return `Available: ${s.focus.pair}.`;
  if (s.state === 'checking') return 'Checking saved tests.';
  if (s.state === 'unavailable' || shownReason(s) === 'unknown') return `${reasonSentence(s)} ${worksAsUsual}`;
  if (s.automaticCoaching === 'unavailable') return `${reasonText.unknown} ${worksAsUsual}`;
  if (!coachingOn(s)) return reasonText['coaching-deferred'];
  if (s.counted < s.target || !s.exact) return `Not yet available: ${countText(s)} baseline tests.`;
  return `Baseline complete; Suggested has no focus for now. ${reasonSentence(s)}`;
}

// Delta r2.1: remembered Suggested with no focus and no in-memory prior snapshot. Names no previous pair.
export const noFocusFallback = 'Suggested has no focus for now, so this block is general. More in why?';
// Delta r2.1: the pilot context is exactly 30 s with a declared QWERTY keyboard (P1). Other settings stay
// usable; a Suggested choice there runs as General and says so. Nothing is clamped or blocked.
export const pilotSeconds = 30;
export function suggestedContextHint(durationS: number, qwerty: boolean): { text: string; action: string } | null {
  if (durationS !== pilotSeconds) return { text: `Suggested runs at ${pilotSeconds} s only; this block is general.`, action: `use ${pilotSeconds} s` };
  if (!qwerty) return { text: 'Suggested needs QWERTY; this is general.', action: declareQwerty };
  return null;
}
export const suggestedContextWhy = (pair: string, durationS: number, qwerty: boolean) =>
  `Suggested blocks are ${pilotSeconds} seconds with the qwerty key on. ${durationS !== pilotSeconds ? `At ${durationS} s` : 'With qwerty off'} this block is general practice, and nothing about it changes your focus. Choose ${durationS !== pilotSeconds ? `${pilotSeconds} s` : 'qwerty'} to practise ${pair}.`;

// Finite Suggested plan end (root msg_22b78999d17a). PROPOSAL pending P1 r2's engine/timing contract.
export const planEndLabel = (pair: string, sentences: number, seconds: number, duration: number) => `Suggested practice · ${pair} · all ${sentences} sentences done at ${seconds} s of ${duration}`;
export const planEndLine = (pair: string) => `That’s every sentence in this ${pair} block, so it ended before the timer. The next suggested block uses the same small set of sentences.`;
