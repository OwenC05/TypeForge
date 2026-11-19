// Independent architecture counterexamples, not a storage implementation or race test.
// Run from repo root: node docs/implementation/2026-11-16/baseline/policy-architecture/probes.mjs
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
import { TypingEngine } from '../../../../../typing-app/client/src/engine.ts';
import { validateResult } from '../../../../../typing-app/client/src/storage.ts';
import { practicePrompts } from '../../../../../typing-app/client/src/corpus.ts';

const P1 = '747d3e7bc22965eaf8ea2b22df0f0070f01be43c';
const P3 = '92803c80e4270dc5018b21b1e552c7feb7f97a2f';
const APP = 'b3fb14c17c89b8825223f230da08be265eaa16cf';
const policyDir = 'docs/implementation/2026-11-16/baseline/policy/';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', windowsHide: true });
const frozen = name => git('show', `${P1}:${policyDir}${name}`);
const canonical = x => x === null || typeof x !== 'object' ? JSON.stringify(x)
  : Array.isArray(x) ? `[${x.map(canonical).join(',')}]`
    : `{${Object.keys(x).sort().map(k => `${JSON.stringify(k)}:${canonical(x[k])}`).join(',')}}`;
const hash = x => createHash('sha256').update(canonical(x)).digest('hex');
const evidence = [];
function check(name, actual, expected) {
  assert.deepEqual(actual, expected, name);
  evidence.push({ name, actual, result: 'passed' });
}

// Ensure real engine probes exercise the stated production source, not P3 or r1 source changes.
for (const file of ['engine.ts', 'storage.ts', 'corpus.ts', 'profile.ts']) {
  const path = `typing-app/client/src/${file}`;
  const actual = readFileSync(new URL(`../../../../../${path}`, import.meta.url), 'utf8').replaceAll('\r\n', '\n');
  check(`current ${file} equals frozen app`, actual, git('show', `${APP}:${path}`).replaceAll('\r\n', '\n'));
  // Avoid embedding full application source in the receipt.
  evidence.at(-1).actual = 'normalized text equal';
}

// Execute the original frozen scalar/schema checker with reads from Git and writes captured in memory.
// This deliberately does not pretend to be a production JSON Schema validator.
const captured = {};
const sandbox = vm.createContext({ assert, createHash, URL, process: { argv: [] },
  readFileSync: url => frozen(new URL(url).pathname.split('/').at(-1)),
  writeFileSync: (url, contents) => { captured[new URL(url).pathname.split('/').at(-1)] = JSON.parse(contents); },
  console: { log() {} },
});
const checker = frozen('check-contract.mjs').replace(/^import .*;\r?\n/gm, '')
  .replaceAll('import.meta.url', "'file:///frozen/check-contract.mjs'");
vm.runInContext(checker, sandbox);
check('frozen scalar/schema smoke assertions execute', vm.runInContext('checks', sandbox), 148);
check('frozen checker rejects noncanonical UTC independently of broad schema format',
  vm.runInContext("schemaCheck(sidecarSchema, {...examples.membership, capturedAt:'2026-11-16T12:00:00Z'})", sandbox), false);
const sidecar = JSON.parse(frozen('coach-sidecar.schema.json'));
check('schema time pattern alone permits noncanonical UTC (semantic validator required)',
  new RegExp(sidecar.$defs.time.pattern).test('2026-11-16T12:00:00Z'), true);

const config = JSON.parse(frozen('coach-config.example.json'));
check('r1 exact config disables automatic coaching', config.releaseScope.automaticCoachingEnabled, false);
check('schema example config ID matches canonical complete config',
  JSON.parse(frozen('sidecar-examples.json')).generalDecision.configId, hash(config));

// Exercise P1's actual final-admission relation with an additional unseen newer row.
const revisionSource = frozen('revision-check.mjs');
const admitSource = revisionSource.slice(revisionSource.indexOf('function admit('),
  revisionSource.indexOf("check('same sources final admission relation'"));
const admit = new Function('hash', `${admitSource}\nreturn admit;`)(hash);
const rows = Array.from({ length: 10 }, (_, i) => ({ id: `r${String(i).padStart(2, '0')}`,
  completedAt: new Date(Date.UTC(2026, 10, 16, 10, i)).toISOString(), wpm: i }));
const inserted = { id: 'new', completedAt: '2026-11-16T11:00:00.000Z', wpm: 100 };
check('P1 relation accepts unseen newer insert if uninstrumented writer leaves revision unchanged',
  admit(rows, [...rows, inserted]), true);
check('P1 relation rejects changed revision (requires real writer fence)',
  admit(rows, [...rows, inserted], { currentRevision: 2 }), false);
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const order = (a, b) => compare(a.completedAt, b.completedAt) || compare(a.id, b.id);
const newest = (xs, count) => [...xs].sort(order).slice(-count).map(x => x.id);
check('unchanged old witnesses do not prove newest-ten selection', newest([...rows, inserted], 10).includes('r00'), false);
check('ten still-present witnesses do prove capped participation', Math.min(10, rows.length), 10);
check('ten witnesses do not prove exact lifetime total', [...rows, inserted].length, 11);

const cutoff = '2026-11-16T12:00:00.000Z';
const lateSaved = { completedAt: '2026-11-16T11:59:00.000Z', persistedAt: '2026-11-16T12:01:00.000Z' };
const cutoffFallback = row => row.completedAt <= cutoff;
check('completion cutoff admits a post-bootstrap delayed save without provenance', cutoffFallback(lateSaved), true);
const newWithLostMembership = { completedAt: '2026-11-16T11:58:00.000Z', persistedAt: '2026-11-16T12:02:00.000Z' };
check('clock rollback plus deleted membership also masquerades as legacy', cutoffFallback(newWithLostMembership), true);
const partitionLegacy = (store, row) => store === 'legacy' && cutoffFallback(row);
check('physical partition excludes delayed current write despite old completedAt', partitionLegacy('current', lateSaved), false);
check('physical partition preserves genuine legacy source eligibility', partitionLegacy('legacy', rows[0]), true);
check('reset compares captured epoch, not current epoch at completion', 'captured-epoch-1' === 'active-epoch-2', false);

// Abstract scan proof over already classified rows. No IndexedDB requests are simulated here.
function stopProof(xs, desired, limit, boundary = -Infinity) {
  let examined = 0, found = 0;
  for (const row of [...xs].sort((a, b) => b.time - a.time)) {
    if (examined === limit) return { examined, found, complete: false };
    examined++;
    if (row.time < boundary) return { examined, found, complete: true };
    if (row.qualifies && ++found === desired) return { examined, found, complete: true };
  }
  return { examined, found, complete: true };
}
const candidates = Array.from({ length: 21 }, (_, i) => ({ time: i + 1, qualifies: i !== 20 }));
check('newest20 proof includes preceding nonqualifying source', stopProof(candidates, 20, 21),
  { examined: 21, found: 20, complete: true });
check('twenty examined rows are insufficient when newest row is excluded', stopProof(candidates, 20, 20),
  { examined: 20, found: 19, complete: false });
check('strict older-than-window crossing proves shorter cohort complete',
  stopProof(candidates, 20, 21, 15), { examined: 8, found: 6, complete: true });
check('byte/row stops cannot be treated as cohort exhaustion', stopProof(candidates, 20, 5).complete, false);
check('equal timestamp ties use id ordering', newest([
  { id: 'b', completedAt: cutoff }, { id: 'a', completedAt: cutoff }], 2), ['a', 'b']);

// End-to-end accounting counterexamples: independent caps are not a shared cap.
check('500 source rows plus 500 membership reads exceed shared rows', 500 + 500 > config.limits.rowsPerAutomaticPreparation, true);
const MiB = 1024 * 1024;
check('10 near-ceiling witnesses twice exceed shared bytes before membership reads',
  2 * 10 * MiB > config.limits.bytesPerAutomaticPreparation, true);
check('30 disjoint sources plus memberships plus metadata exceed one 25-row slice',
  30 * 2 + 1 > config.limits.rowsPerSlice, true);
const ledger = { rows: 498, bytes: 15 * MiB };
const canReserve = (r, b) => ledger.rows + r <= 500 && ledger.bytes + b <= 16 * MiB;
check('shared ledger permits exact last 1MiB reservation', canReserve(1, MiB), true);
check('shared ledger denies row overshoot before issuing reads', canReserve(3, 1), false);
check('shared ledger denies byte overshoot before issuing reads', canReserve(1, MiB + 1), false);

// Actual engine reproduction: a finite certified template wraps without an adapter.
const catalogue = JSON.parse(frozen('finite-catalogue.example.json'));
const ids = catalogue.templates.find(t => t.pair === 'he').promptIds;
const plan = ids.map(id => practicePrompts.find(p => p.id === id));
assert.ok(plan.every(Boolean));
const engine = new TypingEngine({ id: '00000000-0000-4000-8000-000000000001',
  prompts: plan, inputMode: 'flow-v1', durationMs: 30000, qwerty: true,
  corpusVersion: '1', mode: 'practice' });
let time = 0;
for (const prompt of plan) {
  for (const char of prompt.text) {
    const start = engine.value.length;
    time++;
    assert.equal(engine.edit({ start, end: start, text: char, pressTime: time }, time), true);
  }
  const start = engine.value.length;
  time++;
  assert.equal(engine.edit({ start, end: start, text: ' ', pressTime: time }, time), true);
}
check('actual engine wraps to first he template passage at finite end', engine.prompt.id, plan[0].id);
check('finite end occurs before 30s for a valid fast synthetic input', time < 30000, true);
engine.tick(30001);
const result = engine.result('2026-11-16T12:00:00.000Z');
validateResult(result);
check('wrapped-plan result still passes existing v1 validator', result.metricVersion, 1);
const newMeaning = structuredClone(result);
newMeaning.practiceFocus = { pair: 'he', evidenceCount: 28, source: 'clean-pair-contrast-v1-r1',
  baselineVersion: 'policy-r1', score: 0.25 };
assert.throws(() => validateResult(newMeaning));
check('new coach provenance cannot be placed in old practiceFocus.source', true, true);
newMeaning.practiceFocus.source = 'baseline';
validateResult(newMeaning);
check('coercing coach into old baseline shape passes structure but loses truthful meaning', true, true);

const receipt = { verdict: 'counterexamples reproduced', reviewed: { P1, P3, APP }, checks: evidence.length,
  oldSmokeChecks: 148, evidence, limitations: [
    'No browser, IndexedDB migration, transaction, cross-tab or operating-system race execution',
    'No full P1 connected aggregate/sampler re-audit; that is C2 ownership',
    'Abstract row/budget examples are not production implementations or measured performance',
    'Frozen schema checker is an intentionally limited custom oracle, not a standards validator',
    'Real engine exhaustion is synthetic feasibility evidence, not human speed or learning benefit',
  ] };
writeFileSync(new URL('probe-results.json', import.meta.url), `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify({ checks: receipt.checks, oldSmokeChecks: receipt.oldSmokeChecks,
  verdict: receipt.verdict, finitePlanCharacters: plan.reduce((n, p) => n + p.text.length, 0), engineBoundaryTimeMs: time }, null, 2));
