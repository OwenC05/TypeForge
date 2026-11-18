import type { BaselineStatus, Focus, Summary } from './copy.ts';

// SIMULATED FIXTURES. Every number below is invented for layout and wording review.
// None is a user observation, a measured effect or evidence that practice helps.
const th: Focus = { pair: 'th', pairGeometricMs: 212, referenceGeometricMs: 168, observations: 46, sourceRuns: 10, wordContexts: 7 };
const er: Focus = { pair: 'er', pairGeometricMs: 205, referenceGeometricMs: 171, observations: 38, sourceRuns: 12, wordContexts: 5 };
const summary: Summary = { state: 'available', selectionProofComplete: true, medianWpm: 39, medianAccuracy: 95.8, validAccuracySources: 10, from: '2026-11-09', to: '2026-11-18' };
const base = { policyId: 'fixture-policy', target: 10, exact: true, evidenceScanComplete: true, pending: 0, automaticCoaching: 'enabled' as const, summary: null };
const done = { ...base, counted: 10, summary };

export const statuses: Record<string, BaselineStatus> = {
  s0: { ...base, counted: 0, state: 'not-started', reason: 'baseline-incomplete' },
  s4: { ...base, counted: 4, state: 'in-progress', reason: 'baseline-incomplete' },
  s9: { ...base, counted: 9, state: 'in-progress', reason: 'baseline-incomplete' },
  s9deleted: { ...base, counted: 9, state: 'in-progress', reason: 'baseline-incomplete' },
  s7scan: { ...base, counted: 7, exact: false, evidenceScanComplete: false, state: 'pending', reason: 'scan-incomplete' },
  s10ready: { ...done, state: 'complete-ready', focus: th },
  s10insuff: { ...done, state: 'complete-insufficient', reason: 'no-effect' },
  s10sparse: { ...done, state: 'complete-insufficient', reason: 'too-few-observations-for-any-pair', summary: { ...summary, medianWpm: 14.2, medianAccuracy: 81.5 } },
  s10stale: { ...done, state: 'complete-insufficient', reason: 'stale-evidence' },
  s10scan: { ...done, evidenceScanComplete: false, state: 'pending', reason: 'scan-incomplete' },
  s10changed: { ...done, state: 'complete-ready', focus: er, change: { kind: 'changed', from: 'th' } },
  s10stepped: { ...done, state: 'complete-insufficient', reason: 'unstable-evidence', change: { kind: 'stepped-back', from: 'th' } },
  // Ten witnesses prove the capped milestone; the newest-ten ordering proof is not complete yet.
  s10summaryPending: { ...done, state: 'complete-insufficient', reason: 'no-effect', summary: { ...summary, state: 'pending', selectionProofComplete: false, medianWpm: null, medianAccuracy: null } },
  // One of the newest ten has no accuracy: WPM only (P1: never a nine-test accuracy median).
  s10nullAcc: { ...done, state: 'complete-insufficient', reason: 'no-effect', summary: { ...summary, medianAccuracy: null, validAccuracySources: 9 } },
  // Defensive: automatic coaching disabled by config. No unlock is advertised, no gate claimed.
  sOff4: { ...base, counted: 4, evidenceScanComplete: null, automaticCoaching: 'disabled', state: 'in-progress', reason: 'baseline-incomplete' },
  sOff10: { ...done, evidenceScanComplete: null, automaticCoaching: 'disabled', state: 'complete-insufficient', reason: 'coaching-deferred' },
  sUnavail: { ...base, counted: 0, state: 'unavailable', reason: 'storage-unavailable' },
  sPolicyInvalid: { ...base, counted: 0, state: 'unavailable', reason: 'policy-invalid' },
  sChecking: { ...base, counted: 0, exact: false, evidenceScanComplete: false, state: 'checking' },
  sReset: { ...base, counted: 0, state: 'not-started', reason: 'baseline-incomplete' },
};

// Finite certified-plan stand-in for the he/in/le/th templates (480–502 characters each). Shortened
// here so the end is reachable in a scripted run; the real plan text and length come from P1.
export const finitePlan = ['the thin moth', 'then the other three', 'they think that this is the path'];

export interface StateEntry { id: string; title: string; query: string; note: string; full?: boolean }

// The reviewable state matrix. Each entry is captured at 1440, 390 and 320.
export const states: StateEntry[] = [
  { id: '01-practice-first-visit', title: 'First visit to /', query: 'page=practice&fx=s0&qwerty=0', note: 'Identical to the accepted first visit: focused, General 30 s. Suggested stays dashed, keyboard-reachable, no tally.' },
  { id: '02-practice-locked-press', title: 'Locked Suggested pressed (0 of 10)', query: 'page=practice&fx=s0&qwerty=0&view=press', note: 'The change is cancelled; the slot explains and offers test 1. Focus stays on the key.' },
  { id: '03-practice-why-in-progress', title: 'why? while baseline is 4 of 10', query: 'page=practice&fx=s4&view=why', note: 'Progress, what counts, about five minutes of typing, where the count comes from.' },
  { id: '04-assessment-test-1-ready', title: 'Baseline test 1 ready', query: 'page=assessment&fx=s0', note: 'Assessment page, qwerty on, 30 s: the label names the test. First key starts it.' },
  { id: '05-assessment-keyboard-undeclared', title: 'Assessment with qwerty off', query: 'page=assessment&fx=s0&qwerty=0', note: 'One explicit key declares the keyboard; typing straight away is still a normal assessment.' },
  { id: '06-assessment-other-duration', title: 'Assessment at 60 s', query: 'page=assessment&fx=s4&dur=60', note: 'Different duration: plain assessment, honest hint.' },
  { id: '07-result-intermediate', title: 'Test 5 of 10 complete', query: 'page=assessment&fx=s4&view=result&outcome=saved', note: 'Counted after the save. next test is primary.' },
  { id: '08-result-flagged', title: 'Test interrupted (focus lost)', query: 'page=assessment&fx=s4&view=result&outcome=flagged', note: 'Not counted, nothing taken away.' },
  { id: '09-result-save-failed', title: 'Test complete, save failed', query: 'page=assessment&fx=s4&view=result&outcome=savefail', note: 'retry saving is the focused primary; next test is secondary.' },
  { id: '10-assessment-resumed', title: 'Return visit: test 5 ready', query: 'page=assessment&fx=s4', note: 'Resumes from saved tests. No welcome-back screen.' },
  { id: '11-result-final-ready', title: 'Test 10: Suggested has a focus', query: 'page=assessment&fx=s9&view=result&outcome=saved&final=ready', note: 'Baseline complete, Last 10 tests · median, then the focus: try suggested is primary.', full: true },
  { id: '12-result-final-insufficient', title: 'Test 10: no focus stands out', query: 'page=assessment&fx=s9&view=result&outcome=saved&final=insufficient', note: 'Summary, one reason, General primary.', full: true },
  { id: '13-practice-unlocked', title: '/ after a supported focus', query: 'page=practice&fx=s10ready', note: 'Suggested becomes an ordinary key; the remembered General stays selected.' },
  { id: '14-practice-suggested-why', title: 'Suggested · th, why?', query: 'page=practice&fx=s10ready&kind=recommended&view=why', note: 'Why this pair, what the block does, and the limits of the rule.' },
  { id: '15-practice-insufficient-why', title: 'Complete, insufficient: why?', query: 'page=practice&fx=s10insuff&view=why', note: 'Baseline complete; no supported focus; General with a reason.' },
  { id: '16-practice-stale-press', title: 'Complete, evidence older than 30 days', query: 'page=practice&fx=s10stale&view=press', note: 'The milestone stays; timing is stale.' },
  { id: '17-practice-scan-incomplete', title: 'Complete, recent timing not fully read', query: 'page=practice&fx=s10scan&view=press', note: 'A read problem, not a diagnosis. check again.' },
  { id: '18-practice-focus-changed', title: 'Suggested changed th → er', query: 'page=practice&fx=s10changed&kind=recommended', note: 'Announced once at the next ready state.' },
  { id: '19-practice-stepped-back', title: 'Suggested stepped back to General', query: 'page=practice&fx=s10stepped&kind=recommended', note: 'The remembered Suggested falls back to General with a reason.' },
  { id: '20-practice-after-deletion-why', title: '9 of 10 after a deleted test', query: 'page=practice&fx=s9deleted&view=why', note: 'Count re-derived from saved tests; no summary below ten.' },
  { id: '21-progress-baseline', title: 'Progress: 4 of 10', query: 'page=progress&fx=s4', note: 'One count, provenance, take test 5, reset.' },
  { id: '22-progress-reset-confirm', title: 'Start a new baseline: confirm', query: 'page=progress&fx=s4&view=confirm', note: 'Inline confirmation, safe choice focused.' },
  { id: '23-progress-reset-done', title: 'New baseline started', query: 'page=progress&fx=sReset&view=done', note: 'Non-destructive: results stay in history. No summary.' },
  { id: '24-practice-storage-unavailable', title: 'Storage unavailable', query: 'page=practice&fx=sUnavail&view=press', note: 'No count is shown; General works.' },
  { id: '25-practice-checking', title: 'Saved tests still loading', query: 'page=practice&fx=sChecking&view=press', note: 'No number until the read finishes.' },
  { id: '26-assessment-partial-scan', title: 'At least 7 of 10 (partial read)', query: 'page=assessment&fx=s7scan', note: 'No ordinal from a lower bound.' },
  { id: '27-result-final-sparse', title: 'Test 10: too few finished sentences', query: 'page=assessment&fx=s9&view=result&outcome=saved&final=sparse', note: 'The likely outcome for slow or error-prone typists: a truthful summary, no target invented.', full: true },
  // r2 additions
  { id: '28-progress-summary', title: 'Progress: Last 10 tests · median', query: 'page=progress&fx=s10insuff', note: 'Persistent home of the rolling summary, with date range and update note.' },
  { id: '29-progress-summary-pending', title: 'Progress: ten proved, newest ten still being read', query: 'page=progress&fx=s10summaryPending', note: 'Milestone proof and summary-selection proof are separate; no number is shown.' },
  { id: '30-progress-summary-null-accuracy', title: 'Progress: accuracy missing for one of ten', query: 'page=progress&fx=s10nullAcc', note: 'WPM only, with a plain note.' },
  { id: '31-practice-deferred-press', title: 'Coaching off by config: press at 4', query: 'page=practice&fx=sOff4&view=press', note: 'Defensive fixture: no unlock advertised.' },
  { id: '32-practice-deferred-why', title: 'Coaching off by config: why? at 10', query: 'page=practice&fx=sOff10&view=why', note: 'coaching-deferred copy; summary only; no gate claim.' },
  { id: '33-result-final-deferred', title: 'Test 10 with coaching off by config', query: 'page=assessment&fx=s9&view=result&outcome=saved&final=deferred', note: 'Defensive: completion is the summary; nothing claims an analysis ran.', full: true },
  { id: '34-result-not-counted-qwerty', title: 'Not counted: qwerty off', query: 'page=assessment&fx=s0&qwerty=0&view=result&outcome=saved', note: 'Same declaration key on the not-counted line.' },
  { id: '35-assessment-recovery-ready', title: 'Test 6 ready while test 5 is unsaved', query: 'page=assessment&fx=s4&pendingFailed=1', note: 'Recovery in the slot; focus stays in the text.' },
  { id: '36-result-final-save-failed', title: 'Test 10, save failed', query: 'page=assessment&fx=s9&view=result&outcome=savefail&final=ready', note: 'retry saving primary; no dead details key.' },
  { id: '37-practice-plan-end', title: 'Suggested · th: plan finished early', query: 'page=practice&fx=s10ready&kind=recommended&plan=finite&dur=30&view=planend', note: 'PROPOSAL: no wrap; ends at the last certified sentence; actual time shown.' },
  // delta r2.1 (root 64a53b4)
  { id: '39-practice-stepped-back-reload', title: 'Stepped back, after reload (no prior snapshot)', query: 'page=practice&fx=s10stepped&kind=recommended&reload=1', note: 'SIMULATED reload: no previous pair is named; the current fallback reason only.' },
  { id: '40-practice-changed-reload', title: 'Focus changed, after reload (no prior snapshot)', query: 'page=practice&fx=s10changed&kind=recommended&reload=1', note: 'SIMULATED reload: Suggested · er is simply ready; no change announcement.' },
  { id: '41-practice-suggested-60s', title: 'Suggested chosen at 60 s', query: 'page=practice&fx=s10ready&kind=recommended&dur=60', note: 'Pilot is 30 s only: this block is general; 60 s is kept; [use 30 s] is offered.' },
  { id: '42-practice-suggested-qwerty-off', title: 'Suggested chosen with qwerty off', query: 'page=practice&fx=s10ready&kind=recommended&qwerty=0', note: 'Pilot needs declared QWERTY: general block; declaration key offered.' },
  { id: '38-practice-policy-invalid', title: 'Invalid configuration', query: 'page=practice&fx=sPolicyInvalid&view=why', note: 'No number; General and pair as usual.' },
];
