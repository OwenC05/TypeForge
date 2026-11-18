// Independent bounded contract delta review; these are not production/IndexedDB tests.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const AUTHOR = 'f7ddfdde280ee6ae6fe26b4dd2011d01dd8085de';
const BEFORE = 'c6a8a806ec98c6015e3e8819698ff5b19a97ad98';
const ROOT = '3caadca1b045e470b9ae4773a61b9c544ebf66bc';
const dir = dirname(fileURLToPath(import.meta.url));
const policyDir = 'docs/implementation/2026-11-16/baseline/policy/';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', windowsHide: true });
const repoRoot = git('rev-parse', '--show-toplevel').trim();
const frozen = (name, revision = AUTHOR) => git('show', `${revision}:${policyDir}${name}`);
const canonical = x => x === null || typeof x !== 'object' ? JSON.stringify(x)
  : Array.isArray(x) ? `[${x.map(canonical)}]`
    : `{${Object.keys(x).sort().map(k => `${JSON.stringify(k)}:${canonical(x[k])}`).join(',')}}`;
const hash = x => createHash('sha256').update(canonical(x)).digest('hex');
const same = (a, b) => canonical(a) === canonical(b);
const checks = [];
function check(name, actual, expected) {
  assert.deepEqual(actual, expected, name);
  checks.push({ name, actual, expected });
}
function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
}
const scratch = mkdtempSync(join(dir, '.seam-replay-'));
try {
  const files = ['authority-seams-check.mjs', 'authority-types.test.ts', 'interfaces-r2.ts',
    'r2-check.json', 'r2-check.mjs', 'metadata-membership.schema.json', 'coach-config.example.json',
    'coach-config.schema.json', 'finite-catalogue.example.json', 'finite-adapter-r2.md', 'revision-check.mjs'];
  const work = join(scratch, policyDir);
  mkdirSync(work, { recursive: true });
  for (const name of files) writeFileSync(join(work, name), frozen(name));
  for (const args of [['--before'], []]) {
    execFileSync(process.execPath, [join(work, 'authority-seams-check.mjs'), ...args], {
      cwd: repoRoot, encoding: 'utf8', windowsHide: true,
    });
  }
  const before = JSON.parse(readFileSync(join(work, 'authority-seams-before.json')));
  const after = JSON.parse(readFileSync(join(work, 'authority-seams-after.json')));
  assert.equal(before.checks.length, 6); assert.equal(after.checks, 45);

  const schema = JSON.parse(frozen('metadata-membership.schema.json'));
  const source = JSON.parse(frozen('r2-check.json')).detail.clock.find(x => x.lag === 1).result;
  const max = Number.MAX_SAFE_INTEGER;
  const metadata = { schemaId: 'typeforge-coach-metadata-v3', databaseId: 'db', defaultContextId: 'context',
    activeEpochId: 'epoch', legacyEpochId: 'epoch', legacyCutoffCompletedAt: '2026-11-16T12:00:00.000Z', sourceRevision: 7 };
  const authority = m => ({ databaseId: m.databaseId, contextId: m.defaultContextId,
    epochId: m.activeEpochId, revision: m.sourceRevision });
  const admitting = a => Number.isSafeInteger(a.revision) && a.revision >= 0 && a.revision < max;
  const read = freeze({ ref: { partition: 'legacy', kind: 'timed-v1', id: source.id, sha256: hash(source),
    completedAt: source.completedAt }, source, membership: null });
  const origin = (m, s) => s.ref.partition === 'legacy' && m.activeEpochId === m.legacyEpochId
    && s.source.completedAt <= m.legacyCutoffCompletedAt;
  const worlds = [metadata, { ...metadata, legacyEpochId: 'prior' },
    { ...metadata, legacyCutoffCompletedAt: '2026-11-16T10:00:00.000Z' }];
  check('S1 old authority-only views remain indistinguishable', new Set(worlds.map(m => hash(authority(m)))).size, 1);
  check('S1 explicit metadata now distinguishes three origin worlds', new Set(worlds.map(hash)).size, 3);
  check('S1 physical legacy decisions retain initial/reset/cutoff semantics', worlds.map(m => origin(m, read)), [true, false, false]);
  check('S1 missing current membership never gains legacy origin', origin(metadata, { ...read, ref: { ...read.ref, partition: 'current' } }), false);

  // Explicit model of a C completion result, not an actual storage proof producer.
  const input = freeze({ metadata: structuredClone(metadata), authority: authority(metadata), now: '2026-11-16T12:00:00.000Z',
    configId: JSON.parse(frozen('r2-check.json')).configId, sources: [read],
    participationRange: { complete: true, stop: 'exhausted', orderedSourceIds: [source.id], authority: authority(metadata) },
    summaryRange: { complete: true, stop: 'exhausted', orderedSourceIds: [source.id], authority: authority(metadata) },
    coachRange: null });
  const selection = i => ({ metadata: i.metadata, now: i.now,
    sourceBindings: i.sources.map(s => ({ ref: s.ref, membership: s.membership })),
    participationRange: i.participationRange, summaryRange: i.summaryRange, coachRange: i.coachRange });
  const simulatedC = completed => completed ? freeze({ authority: input.authority, configId: input.configId,
    admittedAt: input.now, method: 'all-writer-revision', selection: selection(input) }) : null;
  const actualObjectInModel = simulatedC(true);
  const permitted = (i, p) => p === actualObjectInModel && admitting(i.authority) && admitting(p.authority)
    && same(authority(i.metadata), i.authority) && same(p.authority, i.authority)
    && p.configId === i.configId && same(p.selection, selection(i));
  const project = (i, p) => p && permitted(i, p) ? { proof: p, mayPublishProvedComponents: true }
    : { proof: null, mayPublishProvedComponents: false, candidate: null, median: null, pendingCount: 0 };
  check('S2 failed C operation gives no proved count median or candidate', project(input, simulatedC(false)),
    { proof: null, mayPublishProvedComponents: false, candidate: null, median: null, pendingCount: 0 });
  const projected = project(input, actualObjectInModel);
  check('S2 valid supplied proof passes unchanged into output', [projected.mayPublishProvedComponents, projected.proof === actualObjectInModel], [true, true]);
  check('S2 proof selection binds metadata membership references and ranges without copying source payload',
    [actualObjectInModel.selection.sourceBindings[0].ref === read.ref,
      'source' in actualObjectInModel.selection.sourceBindings[0]], [true, false]);
  check('S2 whole-source clone is frozen before proof rather than mutable behind a ref hash', Object.isFrozen(read.source.sentences), true);
  const substituted = structuredClone(input); substituted.metadata.legacyCutoffCompletedAt = worlds[2].legacyCutoffCompletedAt;
  check('S2 unchanged authority does not authorize substituted cutoff', project(substituted, actualObjectInModel).mayPublishProvedComponents, false);
  const membershipChanged = structuredClone(input); membershipChanged.sources[0].membership = { purpose: 'protected-probe' };
  check('S2 exact membership substitution invalidates selection', project(membershipChanged, actualObjectInModel).mayPublishProvedComponents, false);
  const rangeChanged = structuredClone(input); rangeChanged.summaryRange.orderedSourceIds = [];
  check('S2 range substitution invalidates selection', project(rangeChanged, actualObjectInModel).mayPublishProvedComponents, false);
  check('S2 scalar-identical replacement is not continuity of the modeled actual C object',
    project(input, structuredClone(actualObjectInModel)).mayPublishProvedComponents, false);
  const local = { generation: 1, configId: input.configId, authority: input.authority, state: 'idle' };
  const admit = c => projected.proof === actualObjectInModel && c.generation === 1 && c.state === 'idle'
    && c.configId === input.configId && same(c.authority, input.authority);
  check('S2 unchanged local context can admit after real-proof prerequisite', admit(local), true);
  check('S2 start generation config and database changes reject local admission', [
    { ...local, state: 'running' }, { ...local, generation: 2 }, { ...local, configId: 'other' },
    { ...local, authority: { ...local.authority, databaseId: 'recreated' } }].map(admit), [false, false, false, false]);
  check('S2 unproved deletion cannot preserve provisional ten as a current lower bound', project(input, null).pendingCount, 0);

  // Run the corrected author's exact scalar relation, then independently model atomic state outcomes.
  const relationSource = frozen('r2-check.mjs');
  const relation = new Function(`${relationSource.slice(relationSource.indexOf('const requiredWriters ='), relationSource.indexOf('const fenced ='))}\nreturn {revisionProof,requiredWriters};`)();
  const fences = new Set(relation.requiredWriters), atMax = { ...metadata, sourceRevision: max }, near = { ...metadata, sourceRevision: max - 1 };
  check('S3 schema still permits reading durable sentinel', schema.$defs.metadata.properties.sourceRevision.maximum, max);
  check('S3 corrected actual relation distinguishes usable MAX-1 from non-admitting MAX',
    [relation.revisionProof(near, near, fences), relation.revisionProof(atMax, atMax, fences)], [true, false]);
  const mutate = (db, action, succeeds = true) => {
    if (action === 'reset' && db.metadata.sourceRevision === max) return {
      db, outcome: { committed: false, authority: null, reason: 'context-unavailable' } };
    if (!succeeds) return { db, outcome: { committed: false, authority: null, reason: 'storage-unavailable' } };
    const next = structuredClone(db);
    if (action === 'save') next.ids.push('new');
    if (action === 'delete') next.ids.pop();
    if (action === 'reset') next.metadata.activeEpochId = 'new-epoch';
    next.metadata.sourceRevision = Math.min(max, next.metadata.sourceRevision + 1);
    return { db: next, outcome: next.metadata.sourceRevision === max
      ? { committed: true, authority: null, reason: 'authority-exhausted' }
      : { committed: true, authority: authority(next.metadata), reason: null } };
  };
  const initial = { metadata: near, ids: ['old'] }, failed = mutate(initial, 'reset', false), reached = mutate(initial, 'reset');
  check('S3 failed transaction preserves data epoch and usable revision', failed.db, initial);
  check('S3 reset reaching MAX commits but honestly returns no usable Authority',
    [reached.db.metadata.activeEpochId, reached.db.metadata.sourceRevision, reached.outcome],
    ['new-epoch', max, { committed: true, authority: null, reason: 'authority-exhausted' }]);
  check('S3 reset already at MAX leaves epoch unchanged and is unavailable', mutate(reached.db, 'reset').outcome,
    { committed: false, authority: null, reason: 'context-unavailable' });
  check('S3 ordinary save delete and recovery retain sentinel across reload and tabs', ['save', 'delete', 'save'].map(a => {
    const next = JSON.parse(JSON.stringify(mutate(reached.db, a).db));
    return [next.metadata.sourceRevision, admitting(authority(next.metadata))];
  }), [[max, false], [max, false], [max, false]]);

  // Compile exact declarations plus the author's three and our five negative cases.
  for (const name of ['engine.ts', 'model.ts', 'profile.ts', 'corpus.ts']) {
    const path = `typing-app/client/src/${name}`;
    mkdirSync(dirname(join(scratch, path)), { recursive: true });
    writeFileSync(join(scratch, path), git('show', `${ROOT}:${path}`));
  }
  writeFileSync(join(work, 'independent-types.test.ts'), readFileSync(join(dir, 'contract-types.test.ts')));
  const tsc = 'C:/Users/Owenc/orca/workspaces/TypeForge/typeforge-daily-practice/typing-app/client/node_modules/typescript/bin/tsc';
  assert.ok(existsSync(tsc), 'Existing compiler must be available; do not install dependencies');
  const compilerVersion = execFileSync(process.execPath, [tsc, '--version'], { encoding: 'utf8', windowsHide: true }).trim();
  execFileSync(process.execPath, [tsc, '--noEmit', '--strict', '--target', 'ES2022', '--module', 'ESNext',
    '--moduleResolution', 'bundler', '--allowImportingTsExtensions', '--lib', 'ES2022,DOM',
    join(work, 'interfaces-r2.ts'), join(work, 'authority-types.test.ts'), join(work, 'independent-types.test.ts')],
  { cwd: scratch, encoding: 'utf8', windowsHide: true });
  const unchanged = ['coach-config.example.json', 'coach-config.schema.json', 'finite-catalogue.example.json', 'finite-adapter-r2.md', 'revision-check.mjs'];
  assert.equal(git('diff', '--name-only', BEFORE, AUTHOR, '--', 'typing-app/client', ...unchanged.map(n => policyDir + n)).trim(), '');
  const report = { verdict: 'APPROVE', scope: 'S1-S3 corrected seams and architecture contract implementation admission only',
    inputs: { AUTHOR, BEFORE, ROOT }, independentChecks: checks.length, checks,
    authorReplay: { expectedBeforeReproductions: 6, correctedSeamChecks: 45, meaning: 'Replayed author checks, not independent cases' },
    compilation: { compilerVersion, existingCompiler: tsc, authorNegativeCases: 3, independentNegativeCases: 5, exitCode: 0 },
    unchangedPaths: ['typing-app/client', ...unchanged.map(n => policyDir + n)],
    limits: ['No production derivePolicy/admitPractice or storage proof producer executed',
      'C completion and transaction state examples are explicit in-memory models, not real IndexedDB or browser tests',
      'Proof object continuity is not transaction evidence; future C implementation must actually create the proof',
      'No repeated byte/corpus/numeric/finite/UI audit or production build'] };
  writeFileSync(join(dir, 'probe-results.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ verdict: report.verdict, independentChecks: checks.length, authorReplay: report.authorReplay,
    compilation: { compilerVersion, authorNegativeCases: 3, independentNegativeCases: 5, exitCode: 0 } }, null, 2));
} finally {
  const owner = realpathSync(dir), target = realpathSync(scratch), child = relative(owner, target);
  assert.ok(child && !isAbsolute(child) && !child.startsWith('..') && dirname(target) === owner && child.startsWith('.seam-replay-'));
  rmSync(target, { recursive: true, force: false });
}
