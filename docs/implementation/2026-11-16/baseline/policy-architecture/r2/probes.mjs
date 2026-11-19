// Bounded r2 contract acceptance probes. No production code or real database is changed.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const P1 = 'c6a8a806ec98c6015e3e8819698ff5b19a97ad98';
const ROOT = '0c25a8b1f1f72c613c411864ffcfb02b9e3db236';
const P3 = '3e3142587e3650ab36db27b6025e8490cb104d9d';
const dir = dirname(fileURLToPath(import.meta.url));
const policyDir = 'docs/implementation/2026-11-16/baseline/policy/';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', windowsHide: true });
const frozen = (path, revision = P1) => git('show', `${revision}:${path}`);
const canonical = x => x === null || typeof x !== 'object' ? JSON.stringify(x)
  : Array.isArray(x) ? `[${x.map(canonical)}]`
    : `{${Object.keys(x).sort().map(k => `${JSON.stringify(k)}:${canonical(x[k])}`).join(',')}}`;
const hash = x => createHash('sha256').update(canonical(x)).digest('hex');
const checks = [];
const check = (name, actual, expected) => {
  assert.deepEqual(actual, expected, name);
  checks.push({ name, actual, expected, result: 'passed' });
};

// Replay frozen AUTHOR checks in a bounded scratch tree under this owned directory.
// Those counts remain author assertions, not additional independent findings.
const scratch = mkdtempSync(join(dir, '.author-replay-'));
let author;
try {
  const policyFiles = ['r2-check.mjs', 'revision-check.mjs', 'check-contract.mjs',
    'coach-config.example.json', 'coach-config.schema.json', 'coach-sidecar.schema.json',
    'sidecar-examples.json', 'contract-boundaries.json', 'finite-catalogue.example.json',
    'metadata-membership.schema.json'];
  for (const name of policyFiles) {
    const path = join(scratch, policyDir, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, frozen(policyDir + name));
  }
  for (const name of ['engine.ts', 'storage.ts', 'model.ts', 'profile.ts', 'corpus.ts']) {
    const path = `typing-app/client/src/${name}`;
    mkdirSync(dirname(join(scratch, path)), { recursive: true });
    writeFileSync(join(scratch, path), frozen(path, ROOT));
  }
  for (const name of ['r2-check.mjs', 'check-contract.mjs']) {
    execFileSync(process.execPath, [join(scratch, policyDir, name)], {
      cwd: scratch, encoding: 'utf8', windowsHide: true,
    });
  }
  const read = name => JSON.parse(readFileSync(join(scratch, policyDir, name), 'utf8'));
  const r2 = read('r2-check.json'), revision = read('revision-check.json'), smoke = read('contract-check.json');
  assert.equal(r2.checks, 98);
  assert.equal(revision.checks, 108);
  assert.equal(smoke.checks, 148);
  author = { r2Checks: r2.checks, relationalChecks: revision.checks, scalarSmokeChecks: smoke.checks,
    meaning: 'Frozen author checks replayed on exact root source; not independent cases or browser acceptance' };

  const interfaces = frozen(policyDir + 'interfaces-r2.ts');
  const lifecycle = frozen(policyDir + 'lifecycle-r2.md');
  const interfaceBody = name => interfaces.match(new RegExp(`export interface ${name} \\{([\\s\\S]*?)\\}`))[1];
  const config = read('coach-config.example.json');
  check('enabled config canonical identity', hash(config), 'de43c1c2266364e8c859ac3abc61126590fbec2d10be9b7e0e14616770411995');
  check('catalogue is unchanged', config.exposure.catalogueId, '17de69ffe905a28e8e00ad65d1494a003b080bcd2a894a81fea5c28351594a25');
  const acceptedReader = frozen('typing-app/client/src/storage.ts', P3);
  check('accepted reader record-limit contract is present without re-auditing it',
    acceptedReader.includes("slice.reason === 'record-limit'"), true);

  // S1: same declared pure input, distinct valid legacy-origin decisions.
  const source = r2.detail.clock.find(x => x.lag === 1).result;
  const metadata = { schemaId: 'typeforge-coach-metadata-v3', databaseId: 'db', defaultContextId: 'context',
    activeEpochId: 'epoch', legacyEpochId: 'epoch', legacyCutoffCompletedAt: '2026-11-16T12:00:00.000Z', sourceRevision: 7 };
  const authority = m => ({ databaseId: m.databaseId, contextId: m.defaultContextId,
    epochId: m.activeEpochId, revision: m.sourceRevision });
  const sourceRead = { ref: { partition: 'legacy', kind: 'timed-v1', id: source.id,
    sha256: hash(source), completedAt: source.completedAt }, source, membership: null };
  const pureView = m => ({ authority: authority(m), sources: [sourceRead] });
  const legacyAllowed = m => m.activeEpochId === m.legacyEpochId && source.completedAt <= m.legacyCutoffCompletedAt;
  const resetWorld = { ...metadata, legacyEpochId: 'prior-epoch' };
  const cutoffWorld = { ...metadata, legacyCutoffCompletedAt: '2026-11-16T10:00:00.000Z' };
  check('same declared source and Authority cannot distinguish reset world', pureView(metadata), pureView(resetWorld));
  check('legacy admission differs after reset despite same declared view', [legacyAllowed(metadata), legacyAllowed(resetWorld)], [true, false]);
  check('same declared source and Authority cannot distinguish cutoff world', pureView(metadata), pureView(cutoffWorld));
  check('legacy cutoff admission also differs under identical declared view', [legacyAllowed(metadata), legacyAllowed(cutoffWorld)], [true, false]);
  check('ProjectionInput supplies neither Metadata nor an origin attestation',
    /metadata\s*:|originAttestation\s*:/.test(interfaceBody('ProjectionInput')), false);

  // S2: the pure input contains range authority, not an actual final storage proof.
  check('ProjectionInput has no final VerifiedProof input', interfaceBody('ProjectionInput').includes('VerifiedProof'), false);
  check('candidate output already demands proof-bearing PracticeSnapshot',
    interfaceBody('PreparedProjection').includes('candidate: PracticeSnapshot | null'), true);
  check('PracticeSnapshot requires final VerifiedProof', interfaceBody('PracticeSnapshot').includes('proof: VerifiedProof'), true);
  check('authoritative lifecycle still assigns final proof to storage after computation',
    lifecycle.includes('after computation, one final readonly transaction'), true);
  const rangeOnlyInput = { authority: authority(metadata), configId: hash(config), sourceHashes: [hash(source)] };
  check('same range/scalar input exists both before and after final storage proof',
    canonical({ input: rangeOnlyInput }), canonical({ input: rangeOnlyInput }));
  check('source/range equality alone does not decide actual proof completion',
    [null, { method: 'all-writer-revision', authority: authority(metadata) }].map(Boolean), [false, true]);

  // S3: execute the author's actual unchanged-revision relation at integer exhaustion.
  const authorSource = frozen(policyDir + 'r2-check.mjs');
  const start = authorSource.indexOf('const requiredWriters =');
  const end = authorSource.indexOf('const fenced =', start);
  const relation = new Function(`${authorSource.slice(start, end)}\nreturn { requiredWriters, revisionProof };`)();
  const fenced = new Set(relation.requiredWriters);
  const maximum = { ...metadata, sourceRevision: Number.MAX_SAFE_INTEGER };
  check('metadata machine shape permits MAX_SAFE_INTEGER',
    read('metadata-membership.schema.json').$defs.metadata.properties.sourceRevision.maximum, maximum.sourceRevision);
  check('author revision relation accepts unchanged maximum revision', relation.revisionProof(maximum, maximum, fenced), true);
  const beforeIds = [source.id], afterIds = [source.id, 'new-current-source'];
  check('ordinary source mutation can change range while saturated scalar stays equal',
    [canonical(beforeIds) !== canonical(afterIds), relation.revisionProof(maximum, maximum, fenced)], [true, true]);
  // Proposed amendment: reserve max as non-admitting terminal sentinel using existing field.
  const admitting = m => Number.isSafeInteger(m.sourceRevision) && m.sourceRevision >= 0
    && m.sourceRevision < Number.MAX_SAFE_INTEGER;
  const proofWithSentinel = (a, b) => admitting(a) && admitting(b) && relation.revisionProof(a, b, fenced);
  const increment = m => ({ ...m, sourceRevision: Math.min(Number.MAX_SAFE_INTEGER, m.sourceRevision + 1) });
  const penultimate = { ...metadata, sourceRevision: Number.MAX_SAFE_INTEGER - 1 };
  check('proposed sentinel admits MAX-1 with unchanged coherent revision', proofWithSentinel(penultimate, penultimate), true);
  check('transition MAX-1 to MAX rejects old preparation', proofWithSentinel(penultimate, increment(penultimate)), false);
  check('saturated revision never admits after ordinary write', proofWithSentinel(maximum, increment(maximum)), false);
  check('saturated revision never admits after ordinary delete', proofWithSentinel(maximum, maximum), false);
  check('reload observes terminal sentinel without ephemeral state', admitting(JSON.parse(JSON.stringify(maximum))), false);
  check('cross-tab final admission rejects sentinel even if scalar unchanged', proofWithSentinel(maximum, maximum), false);
  check('ordinary persistence may remain possible without resetting revision', increment(maximum).sourceRevision, Number.MAX_SAFE_INTEGER);

  const report = { kind: 'A2-independent-r2-contract-probes', verdict: 'REVISE',
    inputs: { P1, ROOT, P3 }, node: process.version, independentChecks: checks.length,
    authorReplay: author, checks,
    limitations: ['No production derivePolicy or migration exists; input counterexamples test the frozen seam, not an implementation',
      'Revision examples are protocol relations, not real IndexedDB races',
      'Sentinel is a proposed contract amendment, not silently accepted behavior',
      'Author checks remain author checks; no repeated byte, corpus, numeric or certificate audit',
      'No UI/design, browser, source change or new dependency'] };
  // Keep counterexamples compact: hash large repeated inputs, retaining real source identity.
  for (const item of report.checks) {
    if (item.name.startsWith('same declared source')) {
      item.actual = { projectionHash: hash(item.actual), sourceId: source.id, sourceHash: hash(source) };
      item.expected = item.actual;
    }
  }
  writeFileSync(join(dir, 'probe-results.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ independentChecks: checks.length, authorReplay: author, verdict: report.verdict }, null, 2));
} finally {
  // Only this script's freshly created, resolved child directory can be removed.
  const target = realpathSync(scratch), owner = realpathSync(dir), child = relative(owner, target);
  assert.ok(child && !isAbsolute(child) && !child.startsWith('..') && dirname(target) === owner
    && child.startsWith('.author-replay-'));
  rmSync(resolve(target), { recursive: true, force: false });
}
