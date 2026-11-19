import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = file => JSON.parse(readFileSync(new URL(file, import.meta.url)));
const replay=read('replay-results.json'), secondary=read('secondary-results.json');
assert.equal(replay.assertions,63);assert.equal(secondary.assertions,36);
for(const suite of [replay,secondary]) {
  assert.equal(suite.failedAssertions,0);
  for(const run of suite.results) {
    assert.equal(run.harnessError,undefined);
    assert.deepEqual(run.failures,[]);
    assert.deepEqual(run.pageErrors ?? run.externalPageErrors,[]);
    assert.deepEqual(run.unhandledRejections ?? run.rejections ?? run.notifications.unhandledRejections,[]);
    if(run.notifications)assert.deepEqual(run.notifications.peerUnhandledRejections,[]);
    if(run.errors)assert.deepEqual(run.errors,[]);
    assert.equal(run.cleanup.removed,true);assert.deepEqual(run.cleanup.remaining,[]);
    assert.match(run.database,/^typeforge-c-independent-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
  }
}
const old=read('../results.json');assert.equal(old.assertions,63);assert.equal(old.failedAssertions,3);
console.log('PASS: original63/63 replay plus36/36 new independent assertions;13 UUID databases explicitly removed; original3 failures retained');
