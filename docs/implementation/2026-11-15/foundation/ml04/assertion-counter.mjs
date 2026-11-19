// Optional evidence instrumentation; default npm test remains unmodified.
// All current tests invoke methods on node:assert/strict (no bare callable assert).
import assert from 'node:assert/strict';
let attempted = 0, passed = 0, failed = 0;
for (const key of Object.keys(assert)) {
  if (typeof assert[key] !== 'function' || key === 'AssertionError' || key === 'strict') continue;
  const original = assert[key];
  assert[key] = function (...args) {
    attempted++;
    try {
      const result = Reflect.apply(original, this, args);
      if (result && typeof result.then === 'function') return result.then(
        value => { passed++; return value; }, error => { failed++; throw error; });
      passed++; return result;
    }
    catch (error) { failed++; throw error; }
  };
}
process.on('exit', () => console.log('ML04_ASSERTIONS ' + JSON.stringify({file:process.argv[1],attempted,passed,failed})));
