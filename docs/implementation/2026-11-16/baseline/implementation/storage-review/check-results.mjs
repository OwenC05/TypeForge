import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const result = JSON.parse(readFileSync(new URL('./results.json', import.meta.url)));
assert.equal(result.freshContexts, 10);
assert.equal(result.results.length, 10);
for (const run of result.results) {
  assert.equal(run.harnessError, undefined, run.which);
  assert.equal(run.cleanup.removed, true, run.which);
  assert.deepEqual(run.cleanup.remaining, [], run.which);
}
console.log(`${result.assertions - result.failedAssertions}/${result.assertions} assertions pass; ${result.failedAssertions} observed containment defects; 10 synthetic DBs removed`);
for (const run of result.results) for (const failure of run.failures) console.error(`${run.which}: ${failure}`);
process.exitCode = result.failedAssertions ? 1 : 0;
