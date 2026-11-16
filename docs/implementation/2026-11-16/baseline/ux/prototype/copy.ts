// Every user-facing baseline sentence lives here so the copy deck in contract.md and the
// prototype cannot drift. Reason codes are P1's ordered list (msg_ab8d91690daa).
export type Reason =
  | 'scan-incomplete' | 'policy-invalid' | 'storage-unavailable' | 'context-unavailable'
  | 'baseline-incomplete' | 'stale-evidence' | 'too-few-observations-for-any-pair'
  | 'insufficient-context-diversity' | 'unstable-evidence' | 'no-effect' | 'corpus-coverage' | 'exposure-unsupported';

// P1 e484754 states plus the UI-only 'checking' (read not yet returned). 'pending' = scan-incomplete.
export type BaselineState = 'checking' | 'not-started' | 'in-progress' | 'pending' | 'complete-ready' | 'complete-insufficient' | 'unavailable';

export interface Focus { pair: string; pairGeometricMs: number; referenceGeometricMs: number; observations: number; sourceRuns: number; wordContexts: number }

export interface BaselineStatus {
  policyId: string;
  target: number;
  counted: number;
  /** P1 baselineProofComplete: the count is exact (or a re-read witness proves the capped 10). */
  exact: boolean;
  /** P1 evidenceScanComplete: the recent-evidence scan behind a focus finished. */
  evidenceScanComplete: boolean;
  pending: number;
  state: BaselineState;
  reason?: Reason;
  focus?: Focus;
  /** null when not exactly examined (P1): the UI then says nothing about other settings. */
  otherContextCount: number | null;
  change?: { kind: 'changed' | 'stepped-back'; from: string };
}

export const unavailableReasons: readonly Reason[] = ['policy-invalid', 'storage-unavailable'];

// One plain sentence per reason. None of them says "failed", "level" or "weak".
export const reasonText: Record<Reason, string> = {
  'scan-incomplete': 'Not every saved result could be read just now, so this count may be low.',
  'policy-invalid': 'Suggested is unavailable in this version of TypeForge.',
  'storage-unavailable': 'Suggested needs results saved in this browser, and saving isn’t available here (a private window can do this).',
  'context-unavailable': 'Baseline tests time key pairs on a declared physical QWERTY keyboard, at 30 seconds.',
  'baseline-incomplete': 'Suggested can look for a focus after 10 baseline tests.',
  'stale-evidence': 'Your baseline is complete, but its timing is more than 30 days old. A fresh 30-second assessment or two lets Suggested look again.',
  'too-few-observations-for-any-pair': 'No key pair has come up often enough in finished sentences yet to compare fairly.',
  'insufficient-context-diversity': 'The slower pairs so far came from too few different words to be sure.',
  'unstable-evidence': 'One pair looked slower, but not consistently across your earlier and later runs.',
  'no-effect': 'No key pair stands out clearly from the rest.',
  'corpus-coverage': 'The pair that stood out appears in too few practice sentences to build a focused block.',
  'exposure-unsupported': 'There aren’t enough practice sentences with that pair to give it real practice in one block.',
};

export const generalFits = 'General practice fits best for now, and pair practice lets you pick a pair yourself. Suggested re-checks after each saved 30-second run.';

export const ms = (value: number) => `${Math.round(value)} ms`;
export const countText = (s: BaselineStatus) => `${s.exact ? '' : 'at least '}${Math.min(s.counted, s.target)} of ${s.target}`;
export const nextTestNumber = (s: BaselineStatus) => Math.min(s.counted + s.pending + 1, s.target);

export function focusExplanation(focus: Focus) {
  return `In your recent runs, ${focus.pair} took longer than your other key pairs: ${ms(focus.pairGeometricMs)} against ${ms(focus.referenceGeometricMs)}, across ${focus.observations} clean ${focus.pair} transitions in ${focus.wordContexts} different words and ${focus.sourceRuns} runs.`;
}
// Long form (why? panel) and short form (in-place result) of the same limit.
export const ruleOfThumb = 'A rule of thumb from your own timings, not a diagnosis or a proven training method. It re-checks before every block and may change focus or step back to general.';
export const ruleOfThumbShort = 'A rule of thumb from your own timings, not a diagnosis.';

// What a press on the locked Suggested key says in the slot. Short by contract: it must fit the
// fixed slot at 320 px with its action key (about 75 characters); the full reason lives in why?.
export function lockedPress(s: BaselineStatus): { text: string; action?: string } {
  if (s.state === 'checking') return { text: 'Checking saved tests…' };
  if (s.state === 'unavailable') return { text: s.reason === 'storage-unavailable' ? 'Suggested needs results saved in this browser; saving is off here.' : 'Suggested is unavailable in this version. General works as usual.' };
  if (s.reason === 'scan-incomplete') {
    return s.exact && s.counted >= s.target
      ? { text: 'Baseline done; recent timing couldn’t all be read.', action: 'check again' }
      : { text: `${countText(s)} found; some results couldn’t be read.`.replace(/^a/, 'A'), action: 'check again' };
  }
  if (s.state === 'complete-insufficient') {
    return s.reason === 'stale-evidence'
      ? { text: 'Baseline done; its timing is over 30 days old.', action: 'take an assessment →' }
      : { text: 'Baseline done; no key pair stands out yet. Using general. More in why?' };
  }
  return { text: `Suggested needs ${s.target} baseline tests · ${s.exact ? '' : 'at least '}${s.counted} done.`, action: `take test ${nextTestNumber(s)} →` };
}
