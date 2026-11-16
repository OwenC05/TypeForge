import type { BaselineStatus, Focus } from './copy.ts';

// SIMULATED FIXTURES. Every number below is invented for layout and wording review.
// None is a user observation, a measured effect or evidence that practice helps.
const th: Focus = { pair: 'th', pairGeometricMs: 212, referenceGeometricMs: 168, observations: 46, sourceRuns: 10, wordContexts: 7 };
const er: Focus = { pair: 'er', pairGeometricMs: 205, referenceGeometricMs: 171, observations: 38, sourceRuns: 12, wordContexts: 5 };
const base = { policyId: 'fixture-policy-v1', target: 10, exact: true, evidenceScanComplete: true, pending: 0, otherContextCount: 0 };

export const statuses: Record<string, BaselineStatus> = {
  s0: { ...base, counted: 0, state: 'not-started', reason: 'baseline-incomplete' },
  s4: { ...base, counted: 4, state: 'in-progress', reason: 'baseline-incomplete', otherContextCount: 1 },
  s9: { ...base, counted: 9, state: 'in-progress', reason: 'baseline-incomplete' },
  s9deleted: { ...base, counted: 9, state: 'in-progress', reason: 'baseline-incomplete' },
  s7scan: { ...base, counted: 7, exact: false, evidenceScanComplete: false, state: 'pending', reason: 'scan-incomplete', otherContextCount: null },
  s10ready: { ...base, counted: 10, state: 'complete-ready', focus: th },
  s10insuff: { ...base, counted: 10, state: 'complete-insufficient', reason: 'no-effect' },
  s10sparse: { ...base, counted: 10, state: 'complete-insufficient', reason: 'too-few-observations-for-any-pair' },
  s10stale: { ...base, counted: 10, state: 'complete-insufficient', reason: 'stale-evidence' },
  s10scan: { ...base, counted: 10, evidenceScanComplete: false, state: 'pending', reason: 'scan-incomplete' },
  s10changed: { ...base, counted: 10, state: 'complete-ready', focus: er, change: { kind: 'changed', from: 'th' } },
  s10stepped: { ...base, counted: 10, state: 'complete-insufficient', reason: 'unstable-evidence', change: { kind: 'stepped-back', from: 'th' } },
  sUnavail: { ...base, counted: 0, state: 'unavailable', reason: 'storage-unavailable' },
  sChecking: { ...base, counted: 0, exact: false, evidenceScanComplete: false, state: 'checking' },
  sReset: { ...base, counted: 0, state: 'not-started', reason: 'baseline-incomplete', otherContextCount: 0 },
};

export interface StateEntry { id: string; title: string; query: string; note: string }

// The reviewable state matrix. Each entry is captured at 1440, 390 and 320.
export const states: StateEntry[] = [
  { id: '01-practice-first-visit', title: 'First visit to /', query: 'page=practice&fx=s0&qwerty=0', note: 'Identical to the accepted first visit: focused, General 30 s. Suggested stays dashed but is now keyboard-reachable.' },
  { id: '02-practice-locked-press', title: 'Locked Suggested pressed (0 of 10)', query: 'page=practice&fx=s0&qwerty=0&view=press', note: 'The change is cancelled; the slot explains and offers test 1. Focus stays on the key.' },
  { id: '03-practice-why-in-progress', title: 'why? while baseline is 4 of 10', query: 'page=practice&fx=s4&view=why', note: 'Progress, what counts, what does not, and where the count comes from.' },
  { id: '04-assessment-test-1-ready', title: 'Baseline test 1 ready', query: 'page=assessment&fx=s0', note: 'Assessment page, qwerty on, 30 s: the label names the test. First key starts it.' },
  { id: '05-assessment-keyboard-undeclared', title: 'Assessment with qwerty off', query: 'page=assessment&fx=s0&qwerty=0', note: 'Still a normal assessment; the slot says it will not count and how to make it count. Nothing locks.' },
  { id: '06-assessment-other-duration', title: 'Assessment at 60 s', query: 'page=assessment&fx=s4&dur=60', note: 'Different duration: plain assessment, honest hint.' },
  { id: '07-result-intermediate', title: 'Test 5 of 10 complete', query: 'page=assessment&fx=s4&view=result&outcome=saved', note: 'Counted after the save. next test is primary; practise and stopping are fine.' },
  { id: '08-result-flagged', title: 'Test interrupted (focus lost)', query: 'page=assessment&fx=s4&view=result&outcome=flagged', note: 'Not counted, nothing taken away.' },
  { id: '09-result-save-failed', title: 'Test complete, save failed', query: 'page=assessment&fx=s4&view=result&outcome=savefail', note: 'Pending segment; counts once saved. Retry/export from the accepted failure row.' },
  { id: '10-assessment-resumed', title: 'Return visit: test 5 ready', query: 'page=assessment&fx=s4', note: 'Resumes from saved tests. No welcome-back screen.' },
  { id: '11-result-final-ready', title: 'Test 10: Suggested has a focus', query: 'page=assessment&fx=s9&view=result&outcome=saved&final=ready', note: 'Baseline complete and a supported focus: try suggested is primary.' },
  { id: '12-result-final-insufficient', title: 'Test 10: no focus stands out', query: 'page=assessment&fx=s9&view=result&outcome=saved&final=insufficient', note: 'Baseline complete, evidence insufficient: General is primary, not a failure.' },
  { id: '13-practice-unlocked', title: '/ after a supported focus', query: 'page=practice&fx=s10ready', note: 'Suggested becomes an ordinary key; the remembered General stays selected.' },
  { id: '14-practice-suggested-why', title: 'Suggested · th, why?', query: 'page=practice&fx=s10ready&kind=recommended&view=why', note: 'Why this pair, what the block does, and the limits of the rule.' },
  { id: '15-practice-insufficient-why', title: 'Complete, insufficient: why?', query: 'page=practice&fx=s10insuff&view=why', note: 'Baseline complete; no supported focus; General with a reason.' },
  { id: '16-practice-stale-press', title: 'Complete, evidence older than 30 days', query: 'page=practice&fx=s10stale&view=press', note: 'The milestone stays; timing is stale; one fresh assessment lets it look again.' },
  { id: '17-practice-scan-incomplete', title: 'Complete, recent timing not fully read', query: 'page=practice&fx=s10scan&view=press', note: 'A read problem, not a diagnosis. check again.' },
  { id: '18-practice-focus-changed', title: 'Suggested changed th → er', query: 'page=practice&fx=s10changed&kind=recommended', note: 'Announced once at the next ready state; never "mastered".' },
  { id: '19-practice-stepped-back', title: 'Suggested stepped back to General', query: 'page=practice&fx=s10stepped&kind=recommended', note: 'The remembered Suggested falls back to General with a reason.' },
  { id: '20-practice-after-deletion-why', title: '9 of 10 after a deleted test', query: 'page=practice&fx=s9deleted&view=why', note: 'The count is derived from saved tests; the panel always says so, so a deletion needs no extra memory.' },
  { id: '21-progress-baseline', title: 'Progress page baseline section', query: 'page=progress&fx=s4', note: 'Where reset lives.' },
  { id: '22-progress-reset-confirm', title: 'Start a new baseline: confirm', query: 'page=progress&fx=s4&view=confirm', note: 'Inline confirmation, safe choice focused.' },
  { id: '23-progress-reset-done', title: 'New baseline started', query: 'page=progress&fx=sReset&view=done', note: 'Non-destructive: results stay in history.' },
  { id: '24-practice-storage-unavailable', title: 'Storage unavailable', query: 'page=practice&fx=sUnavail&view=press', note: 'No count is shown; General works.' },
  { id: '25-practice-checking', title: 'Saved tests still loading', query: 'page=practice&fx=sChecking&view=press', note: 'No tally until the read finishes; no flicker to 0.' },
  { id: '27-result-final-sparse', title: 'Test 10: too few finished sentences', query: 'page=assessment&fx=s9&view=result&outcome=saved&final=sparse', note: 'The likely outcome for slow or error-prone typists: the milestone is theirs; no target is invented.' },
  { id: '26-assessment-partial-scan', title: 'At least 7 of 10 (partial read)', query: 'page=assessment&fx=s7scan', note: 'Never presents an inexact count as exact.' },
];
