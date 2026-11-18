// Diagnostic reproduction, not a product acceptance test. Executes exact app slices in a VM.
// No DOM, browser, real IndexedDB, or provider behavior is claimed by this bounded probe.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { createHash } from 'node:crypto';

const file = new URL('../../../../../../typing-app/client/src/app.ts', import.meta.url);
const raw = readFileSync(file, 'utf8');
const source = raw.replace(/\r\n/g, '\n');
function slice(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, `Nonempty ordered source boundaries: ${startMarker}`);
  return source.slice(start, end);
}
const invalidation = slice('  const unsubscribe = subscribeStorageInvalidation(', '\n\n  // ---- Presentation');
const input = slice('  const acceptInput = ', "\n  input.addEventListener('input', acceptInput);");
const freeze = slice('  function freezeRun()', '\n\n  // ET-1:');
const settle = slice('  async function settleReadyBlock(', '\n  function installBlock(');
function evaluate(code, context, result) {
  return runInNewContext(`${stripTypeScriptTypes(code)}\n${result}`, context);
}
function base() {
  const calls = [];
  const queued = [];
  const snapshot = { plan: { pair: 'th', planHash: 'old-certified-plan' } };
  const host = {
    calls, queued, disposed: false, restarting: false, coachFresh: true,
    prepAbort: { abort() { calls.push('abort-preparation'); } }, prepGeneration: 8,
    invalidationQueued: false, admitted: snapshot, frozen: null, readyCapture: { epochId: 'old-epoch' },
    subscribeStorageInvalidation(callback) { host.invalidate = callback; return () => {}; },
    setTimeout(callback) { queued.push(callback); },
    prepareCoach() { calls.push('prepareCoach'); },
    engine: { state: 'idle', pair: 'th', submittedSummaries: [],
      tick() { return this.snapshot(); },
      snapshot() { return { state: this.state, value: this.value ?? '', sentenceIndex: 0, prompt: { text: 'the' } }; },
      edit(edit) { calls.push('edit-old-finite'); this.state = 'running'; this.value = edit.text; },
    },
    coach: {}, coachUi: { nextTestNumber: () => null, changeHint: () => '', noFocusFallback: 'General' },
    countsNow: () => false, blockIdentity: () => 'Suggested practice · th', isFiniteBlock: () => true,
    input: { value: 't' }, before: { value: '', start: 0, end: 0, type: 'insertText', data: 't' },
    key: { key: 't', time: 1, repeat: false }, composing: false, performance: { now: () => 1 },
    ended: () => false, reconstructEdit: () => ({ text: 't', tracked: true, start: 0, end: 0 }),
    paint: () => {}, mode: 'practice', prepare: () => {},
    untouched: () => host.engine.state === 'idle', suggestedChosen: () => true, pilot: () => true,
    lastAdmittedPair: 'th', changeNote: '', fellBack: false, practiceKind: { value: 'recommended' },
  };
  return host;
}

const first = base();
const accept = evaluate(`${invalidation}\n${freeze}\n${input}`, first, 'acceptInput');
first.invalidate();
assert.equal(first.coachFresh, false, 'Known invalidation is visible before first insertion');
assert.equal(first.queued.length, 1, 'Replacement preparation has only been scheduled');
accept({ isComposing: false });
const firstKey = {
  invalidationKnown: !first.coachFresh,
  replacementPreparationRan: first.calls.includes('prepareCoach'),
  oldFiniteAcceptedFirstKey: first.calls.includes('edit-old-finite'),
  frozenPair: first.frozen?.pair,
  frozenLabel: first.frozen?.label,
  calls: first.calls,
};
assert.equal(firstKey.oldFiniteAcceptedFirstKey, true, 'Reproduces stale finite first-key admission');
assert.equal(firstKey.frozenPair, 'th');

const second = base();
second.admitted = null;
let releaseRuntime;
second.finiteRuntime = () => new Promise(resolve => { releaseRuntime = resolve; });
second.admittedBlock = (_runtime, snapshot) => ({ snapshot });
second.installBlock = (_block, snapshot) => { second.admitted = snapshot; second.calls.push('install-old-snapshot'); };
const settleReady = evaluate(`${invalidation}\n${settle}`, second, 'settleReadyBlock');
const oldSnapshot = { plan: { pair: 'th', planHash: 'admitted-before-invalidation' } };
const waiting = settleReady(oldSnapshot);
second.invalidate();
second.prepGeneration += 1;
releaseRuntime({});
await waiting;
const runtimeGap = {
  invalidationKnown: !second.coachFresh,
  newerGeneration: second.prepGeneration,
  staleSnapshotInstalled: second.admitted === oldSnapshot,
  calls: second.calls,
};
assert.equal(runtimeGap.staleSnapshotInstalled, true, 'Reproduces installation after invalidation during runtime import');

console.log(JSON.stringify({
  scope: 'Exact source slices with controlled VM dependencies; real-browser reproduction remains required',
  appSha256: createHash('sha256').update(raw).digest('hex'),
  observedDefects: { firstKey, runtimeGap },
}, null, 2));
