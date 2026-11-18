import test from 'node:test';
import assert from 'node:assert/strict';
import type { Coach, Participation, PreparedStatus, Summary } from '../src/coach-types.ts';
import {
  baselineView, shownReason, reasonSentence, reasons, lockedPress, suggestedDescription, nextTestNumber, takeTestLabel, countText,
  counting, summaryView, afterReason, generalFits, changeHint, planEndLabel, planEndFigures, focusExplanation, suggestedContextHint,
  suggestedContextWhy, baselinePurpose, TARGET,
} from '../src/coach-ui.ts';

// Shapes only: the proof object is an opaque stand-in. These tests never mint or check a proof;
// they check how an already projected status is worded.
const proof = {} as never;
const work = {} as never;
function status(parts: { participation: Participation; summary?: Summary; coach?: Coach; pendingSave?: number;
  automaticCoaching?: PreparedStatus['automaticCoaching']; evidenceScanComplete?: boolean | null; exact?: boolean; summaryProof?: boolean }): PreparedStatus {
  return {
    automaticCoaching: parts.automaticCoaching ?? 'enabled', baselineProofComplete: parts.exact ?? parts.participation.proof !== null,
    summarySelectionProofComplete: parts.summaryProof ?? false, evidenceScanComplete: parts.evidenceScanComplete ?? null,
    pendingSave: parts.pendingSave ?? 0, pendingSources: [], participation: parts.participation,
    summary: parts.summary ?? { state: 'not-complete', reason: 'baseline-incomplete', value: null },
    coach: parts.coach ?? { state: 'not-ready', reason: 'baseline-incomplete', evidenceScanComplete: null, snapshot: null },
    persistence: { state: 'idle', pendingIds: [] }, otherContextCount: null, work,
  };
}
const inProgress = (counted: number, ordinal: number | null, pendingSave = 0) => status({ pendingSave, participation: {
  state: counted ? 'in-progress' : 'not-started', reason: 'baseline-incomplete', counted, ordinal, witnesses: [], proof } });
const focus = { pair: 'th', targetCount: 46, referenceCount: 900, targetLogSum: 46 * Math.log(212), referenceLogSum: 900 * Math.log(168),
  sourceRuns: 10, promptContexts: 9, wordContexts: 7, halves: [] as never, certificateId: 'c' };
const readyCoach: Coach = { state: 'complete-ready', reason: 'supported', evidenceScanComplete: true, snapshot: { focus } as never };
const complete: Participation = { state: 'complete', reason: 'supported', counted: 10, ordinal: null, witnesses: [], proof };
const insufficient = (reason: string, evidenceScanComplete = true, automaticCoaching: PreparedStatus['automaticCoaching'] = 'enabled') =>
  status({ participation: complete, automaticCoaching, evidenceScanComplete,
    coach: { state: 'complete-insufficient', reason: reason as never, evidenceScanComplete: true, snapshot: null, sources: [], proof } });
const available = (medianAccuracy: number | null): Summary => ({ state: 'available', selection: 'newest-ten-qualifying-assessments-v1', proof,
  value: { medianWpm: 41.25, medianAccuracy, validAccuracySources: medianAccuracy === null ? 9 : 10, sources: [],
    timeRange: { from: '2026-11-09T10:00:00.000Z', to: '2026-11-18T09:00:00.000Z' } } });
const BAD = /undefined|NaN|\[object|null/;

test('checking shows no number, no ordinal and does not promise a count', () => {
  const view = baselineView(null);
  assert.equal(view.state, 'checking');
  assert.equal(view.counted, null);
  assert.equal(nextTestNumber(view), null);
  assert.equal(takeTestLabel(view), 'take a baseline test →');
  assert.equal(lockedPress(view).text, 'Checking saved tests…');
  assert.equal(suggestedDescription(view, true), 'Checking saved tests.');
  assert.equal(summaryView(view).kind, 'none');
});

test('boundary counts 0, 1 and 9 use D’s exact ordinal only', () => {
  const zero = baselineView(inProgress(0, 1));
  assert.equal(zero.state, 'not-started');
  assert.equal(nextTestNumber(zero), 1);
  assert.deepEqual(lockedPress(zero), { text: 'Suggested needs 10 baseline tests · 0 done.', action: 'take-test', label: 'take test 1 →' });
  assert.equal(nextTestNumber(baselineView(inProgress(1, 2))), 2);
  const nine = baselineView(inProgress(9, 10));
  assert.equal(countText(nine), '9 of 10');
  assert.equal(takeTestLabel(nine), 'take test 10 →');
  assert.equal(suggestedDescription(nine, true), 'Not yet available: 9 of 10 baseline tests.');
});

test('nine durable plus one pending keeps count nine with no ordinal (never test eleven)', () => {
  const view = baselineView(inProgress(9, null, 1));
  assert.equal(view.counted, 9);
  assert.equal(view.pending, 1);
  assert.equal(nextTestNumber(view), null);
  assert.equal(takeTestLabel(view), 'take a baseline test →');
  assert.equal(counting(view), false);
  assert.equal(countText(view), '9 of 10');
});

test('a pending eligible save moves only the ordinal, never the saved count', () => {
  const view = baselineView(inProgress(4, 6, 1));
  assert.equal(view.counted, 4);
  assert.equal(nextTestNumber(view), 6);
  assert.equal(countText(view), '4 of 10');
});

test('a lower bound is never an exact count or ordinal', () => {
  const view = baselineView(status({ participation: { state: 'pending', reason: 'scan-incomplete', counted: 7, ordinal: null, proof: null } }));
  assert.equal(view.exact, false);
  assert.equal(countText(view), 'at least 7 of 10');
  assert.equal(nextTestNumber(view), null);
  assert.equal(counting(view), true);
  assert.deepEqual(lockedPress(view), { text: 'At least 7 of 10 found; some results couldn’t be read.', action: 'check-again', label: 'check again' });
  assert.equal(suggestedDescription(view, true), 'Not yet available: at least 7 of 10 baseline tests.');
  const zero = baselineView(status({ participation: { state: 'pending', reason: 'scan-incomplete', counted: 0, ordinal: null, proof: null } }));
  assert.equal(lockedPress(zero).text, 'Saved tests couldn’t all be read just now.');
});

test('unavailable participation shows no number for every non-gate reason', () => {
  for (const reason of ['policy-invalid', 'storage-unavailable', 'context-unavailable', 'source-integrity', 'some-future-reason'] as const) {
    const view = baselineView(status({ participation: { state: 'unavailable', reason: reason as never, counted: null, ordinal: null, proof: null } }));
    assert.equal(view.counted, null);
    assert.equal(nextTestNumber(view), null);
    assert.equal(counting(view), false);
    const said = `${lockedPress(view).text} ${suggestedDescription(view, true)}`;
    assert.doesNotMatch(said, /\d of 10|undefined|switched on/);
  }
  const storage = baselineView(status({ participation: { state: 'unavailable', reason: 'storage-unavailable', counted: null, ordinal: null, proof: null } }));
  assert.equal(lockedPress(storage).text, 'Suggested needs results saved in this browser; saving is off here.');
});

test('complete-ready explains the pair from the actual focus before any reason fallback', () => {
  const view = baselineView(status({ participation: complete, coach: readyCoach, evidenceScanComplete: true }));
  assert.equal(view.state, 'complete-ready');
  assert.equal(view.focus?.pair, 'th');
  assert.equal(focusExplanation(view.focus!), 'In your recent runs, th took longer than your other key pairs: 212 ms against 168 ms, across 46 clean th transitions in 7 different words and 10 runs.');
  assert.equal(suggestedDescription(view, false), 'Available: th.');
  assert.equal(suggestedDescription(view, false, false), 'Available: th (30 s, qwerty on).');
  assert.notEqual(shownReason(view), 'supported' as never);
});

test('every reason in every coaching state maps to its sentence without undefined', () => {
  const states: Array<[PreparedStatus['automaticCoaching'], boolean | null]> = [['enabled', true], ['enabled', false], ['disabled', null], ['unavailable', null], ['unavailable', false]];
  for (const reason of [...reasons, 'supported', 'some-future-reason']) {
    for (const [coaching, scanned] of states) {
      const view = baselineView(insufficient(reason, Boolean(scanned), coaching));
      view.evidenceScanComplete = scanned;
      const text = [reasonSentence(view), afterReason(view), lockedPress(view).text, suggestedDescription(view, true)].join(' ');
      assert.doesNotMatch(text, BAD, `${reason}/${coaching}/${scanned}`);
      if (coaching === 'unavailable') assert.doesNotMatch(text, /switched on/);
      const promise = /re-checks after each saved 30-second run/.test(text);
      const gate = ['stale-evidence', 'too-few-observations-for-any-pair', 'insufficient-context-diversity', 'unstable-evidence', 'no-effect', 'corpus-coverage', 'exposure-unsupported'].includes(reason);
      assert.equal(promise, gate && reason !== 'stale-evidence' && coaching === 'enabled' && scanned === true, `re-check promise ${reason}/${coaching}/${scanned}`);
    }
  }
});

test('gate reasons show only when a gate ran; deferred never promises a re-check', () => {
  assert.equal(reasonSentence(baselineView(insufficient('no-effect'))), 'No key pair stands out clearly from the rest.');
  assert.equal(afterReason(baselineView(insufficient('no-effect'))), generalFits);
  const unscanned = baselineView(insufficient('no-effect'));
  unscanned.evidenceScanComplete = false;
  assert.equal(shownReason(unscanned), 'scan-incomplete');
  const deferred = baselineView(status({ participation: complete, automaticCoaching: 'disabled',
    coach: { state: 'not-requested', reason: 'coaching-deferred', evidenceScanComplete: null, snapshot: null } }));
  assert.equal(afterReason(deferred), '');
  assert.equal(lockedPress(deferred).text, 'Suggested isn’t switched on in this version. General works as usual.');
  assert.match(baselinePurpose(deferred), /^10 short baseline tests/);
  const invalid = baselineView(status({ participation: complete, coach: { state: 'unavailable', reason: 'policy-invalid', evidenceScanComplete: null, snapshot: null } }));
  assert.equal(invalid.state, 'complete-insufficient');
  assert.equal(reasonSentence(invalid), 'Suggested is unavailable in this version of TypeForge.');
  assert.equal(afterReason(invalid), 'General and pair practice work as usual.');
  const stale = baselineView(insufficient('stale-evidence'));
  assert.equal(afterReason(stale), 'Your 10 tests still count; only the timing needs refreshing.');
  assert.deepEqual(lockedPress(stale), { text: 'Baseline done; its timing is over 30 days old.', action: 'assessment', label: 'take an assessment →' });
  const coachPending = baselineView(status({ participation: complete, coach: { state: 'pending', reason: 'scan-incomplete', evidenceScanComplete: false, snapshot: null } }));
  assert.equal(lockedPress(coachPending).text, 'Baseline done; recent timing couldn’t all be read.');
});

test('rolling summary: figures need the available value and its own selection proof', () => {
  const figures = summaryView(baselineView(status({ participation: complete, summary: available(95.4), summaryProof: true })));
  assert.equal(figures.kind, 'figures');
  if (figures.kind === 'figures') { assert.equal(figures.wpm, '41.3'); assert.equal(figures.accuracy, '95.4%'); assert.equal(figures.updating, false); assert.match(figures.range, /^\d{1,2} Nov – \d{1,2} Nov$/); }
  const speedOnly = summaryView(baselineView(status({ participation: complete, summary: available(null), summaryProof: true })));
  assert.ok(speedOnly.kind === 'figures' && speedOnly.accuracy === null && /only speed/.test(speedOnly.note!));
  assert.equal(summaryView(baselineView(status({ participation: complete, summary: available(95), summaryProof: false }))).kind, 'reading');
  assert.equal(summaryView(baselineView(status({ participation: complete, summary: { state: 'pending', reason: 'scan-incomplete', value: null } }))).kind, 'reading');
  assert.equal(summaryView(baselineView(inProgress(9, 10))).kind, 'none');
  const updating = summaryView(baselineView(status({ participation: complete, summary: available(95), summaryProof: true, pendingSave: 1 })));
  assert.ok(updating.kind === 'figures' && updating.updating);
  assert.equal(summaryView(baselineView(status({ participation: { state: 'unavailable', reason: 'context-unavailable', counted: null, ordinal: null, proof: null },
    summary: { state: 'unavailable', reason: 'context-unavailable', value: null } }))).kind, 'none');
});

test('a change is explained only against an in-memory prior pair', () => {
  const ready = baselineView(status({ participation: complete, coach: readyCoach, evidenceScanComplete: true }));
  assert.equal(changeHint(null, ready), '');
  assert.equal(changeHint('th', ready), '');
  assert.match(changeHint('er', ready), /^Suggested now leans on th\. er no longer stands out/);
  assert.match(changeHint('th', baselineView(insufficient('no-effect'))), /^Suggested stepped back to general: th/);
  assert.equal(changeHint('th', baselineView(insufficient('policy-invalid'))), '');
  assert.equal(changeHint('th', baselineView(status({ participation: { state: 'unavailable', reason: 'storage-unavailable', counted: null, ordinal: null, proof: null } }))), '');
});

test('pilot context and finite end copy use actual settings and actual elapsed time', () => {
  assert.deepEqual(suggestedContextHint(60, true), { text: 'Suggested runs at 30 s only; this block is general.', action: 'use-30', label: 'use 30 s' });
  assert.deepEqual(suggestedContextHint(30, false), { text: 'Suggested needs QWERTY; this is general.', action: 'declare', label: 'my keyboard is qwerty' });
  assert.equal(suggestedContextHint(30, true), null);
  assert.match(suggestedContextWhy('th', 60, true), /At 60 s this block is general practice/);
  const label = planEndLabel('th', 12, 24_399);
  assert.equal(label, 'Suggested practice · th · all 12 sentences done at 24.3 s of 30');
  assert.doesNotMatch(label, /complete|30 s ·/);
  assert.equal(planEndLabel('in', 12, 29_999).includes('29.9'), true);
  assert.equal(planEndFigures(8_050), 'over the 8 s typed');
  assert.equal(TARGET, 10);
});
