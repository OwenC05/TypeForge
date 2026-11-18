// Bounded diagnostic: actual app factory/install slices with actual engine and corpus.
// No real DOM/browser behavior is asserted here; report the source-identity mismatch.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { createHash } from 'node:crypto';
import { TypingEngine } from '../../../../../../typing-app/client/src/engine.ts';
import { CORPUS_VERSION, practicePrompts } from '../../../../../../typing-app/client/src/corpus.ts';
import { selectDrillPrompts } from '../../../../../../typing-app/client/src/profile.ts';
import { resolveCertifiedPlan } from '../../../../../../typing-app/client/src/coach-plan.ts';

const raw = readFileSync(new URL('../../../../../../typing-app/client/src/app.ts', import.meta.url), 'utf8');
const source = raw.replace(/\r\n/g, '\n');
function slice(startMarker, endMarker) {
  const start = source.indexOf(startMarker), end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, `Nonempty ordered source: ${startMarker}`);
  return source.slice(start, end);
}
const factory = slice('  const makeEngine = ', '\n  let engine: Block');
const install = slice('  function installBlock(', '\n  function startTimer(');
assert.ok(source.includes('installBlock(makeEngine(qwerty.checked), null);'), 'Actual fallback evaluates factory before install');
const plan = resolveCertifiedPlan('th');
assert.ok(plan);
const general = selectDrillPrompts(null, practicePrompts);
const host = {
  TypingEngine, crypto, CORPUS_VERSION, prompts: plan.prompts.map(prompt => ({ ...prompt })),
  mode: 'practice', durationMs: 30000, practiceChoice: { kind: 'recommended' }, sourceAssessmentId: undefined,
  engine: null, admitted: { plan }, choosePrompts: () => general,
  previousPromptText: '', previousResponse: '', lastPromptKey: '', lastState: '',
  prepare: () => {}, paint: () => {}, startTimer: () => {},
};
runInNewContext(`${stripTypeScriptTypes(factory + '\n' + install)}; installBlock(makeEngine(true), null);`, host);
// Engine's own cloned prompts are inspected only for this diagnostic. No production dependency is added.
const engineIds = host.engine.prompts.map(prompt => prompt.id);
const viewIds = host.prompts.map(prompt => prompt.id);
assert.deepEqual(engineIds, plan.prompts.map(prompt => prompt.id), 'Reproduces old certified plan retained inside timed engine');
assert.deepEqual(viewIds, general.map(prompt => prompt.id), 'View metadata now names the newly selected General prompts');
assert.notDeepEqual(engineIds, viewIds, 'Reproduces actual engine/view prompt divergence');
console.log(JSON.stringify({
  scope: 'Exact app factory/install slices; actual TypingEngine, plan and General selector; browser recheck required',
  appSha256: createHash('sha256').update(raw).digest('hex'),
  admittedCleared: host.admitted === null,
  enginePromptIds: engineIds,
  viewPromptIds: viewIds,
  observedDefect: 'General fallback timed engine retains old Suggested prompt sequence while app metadata switches to General',
}, null, 2));
