// Evidence-only preload: preserve assertion behavior and count actual invocations.
import assert from 'node:assert/strict';
const counts = {};
for (const name of ['ok', 'equal', 'deepEqual', 'match', 'throws', 'rejects', 'fail']) {
  const original = assert[name];
  assert[name] = function (...args) {
    const caller = new Error().stack.split('\n').find(line => line.includes('app.test.ts:'));
    const location = caller?.match(/app\.test\.ts:(\d+):/)?.[1];
    if (location) counts[`${location}:${name}`] = (counts[`${location}:${name}`] ?? 0) + 1;
    return Reflect.apply(original, this, args);
  };
}
process.on('exit', () => console.log('E1_ASSERT_CALLS ' + JSON.stringify(counts)));
