// Replay the exact independent payload without writing to reviewer evidence.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const reviewerCommit = '560dc6bec407d52d6cc5a908292849b8b06772ed';
const git = (...args) => execFileSync('git', args, { windowsHide: true, encoding: 'utf8' });
const review = JSON.parse(git('show', `${reviewerCommit}:docs/implementation/2026-11-16/baseline/implementation/finite-review/results.json`));
const { validateFinitePracticeResult } = await import(pathToFileURL(resolve('typing-app/client/src/finite-practice-result.ts')));
const { resolveCertifiedPlan } = await import(pathToFileURL(resolve('typing-app/client/src/coach-plan.ts')));
const source = review.observations.emptyKeyEnvelope.source;
assert.equal(review.observations.emptyKeyEnvelope.accepted, true);
assert.deepEqual(source.sentences[0].keys, {});
assert.equal(source.metrics.correctAttempts, 463);
assert.throws(() => validateFinitePracticeResult(source, resolveCertifiedPlan('he')), /initial key/);
const result = { reviewerCommit, correctionCommit: git('rev-parse', 'HEAD').trim(),
  validatorBlob: git('rev-parse', 'HEAD:typing-app/client/src/finite-practice-result.ts').trim(),
  exactIndependentEmptyEnvelopeRejected: true, positiveBoundary: review.observations.validReverse,
  limits: ['Author correction replay only; independent reacceptance belongs to root/reviewer'] };
writeFileSync(new URL('initial-key-review-replay.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
