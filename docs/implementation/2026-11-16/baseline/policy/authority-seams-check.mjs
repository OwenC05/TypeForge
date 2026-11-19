// S1-S3 author contract regressions only: no production selector or real DB races.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const dir = 'docs/implementation/2026-11-16/baseline/policy/';
const frozen = 'c6a8a806ec98c6015e3e8819698ff5b19a97ad98';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', windowsHide: true }).trim();
const text = n => readFileSync(new URL(n, import.meta.url), 'utf8');
const canonical = x => x === null || typeof x !== 'object' ? JSON.stringify(x)
  : Array.isArray(x) ? `[${x.map(canonical).join(',')}]`
    : `{${Object.keys(x).sort().map(k => `${JSON.stringify(k)}:${canonical(x[k])}`).join(',')}}`;
const hash = x => createHash('sha256').update(canonical(x)).digest('hex');
const same = (a, b) => canonical(a) === canonical(b);
const clone = x => structuredClone(x);
const checks = [];
const check = (name, actual, expected) => { assert.deepEqual(actual, expected, name); checks.push({ name, actual, expected }); };
const fields = (source, name) => source.match(new RegExp(`export interface ${name} \\{([\\s\\S]*?)\\}`))[1];
function revisionRelation(source) {
  const start = source.indexOf('const requiredWriters =');
  const end = source.indexOf('const fenced =', start);
  return new Function(`${source.slice(start, end)}\nreturn {requiredWriters,revisionProof};`)();
}
const source = JSON.parse(text('r2-check.json')).detail.clock.find(x => x.lag === 1).result;
const metadata = { schemaId: 'typeforge-coach-metadata-v3', databaseId: 'db', defaultContextId: 'context',
  activeEpochId: 'epoch', legacyEpochId: 'epoch', legacyCutoffCompletedAt: '2026-11-16T12:00:00.000Z', sourceRevision: 7 };
const authority = m => ({ databaseId: m.databaseId, contextId: m.defaultContextId, epochId: m.activeEpochId, revision: m.sourceRevision });
const sourceRead = { ref: { partition: 'legacy', kind: 'timed-v1', id: source.id, sha256: hash(source),
  completedAt: source.completedAt }, source, membership: null };
const worlds = [metadata, { ...metadata, legacyEpochId: 'old-epoch' },
  { ...metadata, legacyCutoffCompletedAt: '2026-11-16T10:00:00.000Z' }];
const origin = (m, row) => row.ref.partition === 'legacy'
  && m.activeEpochId === m.legacyEpochId && row.source.completedAt <= m.legacyCutoffCompletedAt;
const maximum = Number.MAX_SAFE_INTEGER;

if (process.argv.includes('--before')) {
  const oldTypes = git('show', `${frozen}:${dir}interfaces-r2.ts`);
  const oldRelation = revisionRelation(git('show', `${frozen}:${dir}r2-check.mjs`));
  const view = m => ({ authority: authority(m), sources: [sourceRead] });
  check('S1 frozen public view is identical across all three origin worlds', worlds.map(m => hash(view(m))), worlds.map(() => hash(view(metadata))));
  check('S1 required physical legacy decisions differ', worlds.map(m => origin(m, sourceRead)), [true, false, false]);
  check('S1 frozen ProjectionInput omits metadata', /metadata\s*:/.test(fields(oldTypes, 'ProjectionInput')), false);
  check('S2 frozen ProjectionInput omits final proof', /finalProof\s*:/.test(fields(oldTypes, 'ProjectionInput')), false);
  check('S2 frozen output already requires a proved candidate', fields(oldTypes, 'PreparedProjection').includes('candidate: PracticeSnapshot | null'), true);
  const saturated = { ...metadata, sourceRevision: maximum };
  check('S3 frozen actual author revision relation admits unchanged MAX',
    oldRelation.revisionProof(saturated, saturated, new Set(oldRelation.requiredWriters)), true);
  writeFileSync(new URL('authority-seams-before.json', import.meta.url), JSON.stringify({ kind: 'expected-frozen-seam-reproductions', frozen,
    checks, sourceId: source.id, sourceHash: hash(source), limits: ['Expected counterexamples, not unexplained test failures', 'No production derivePolicy or IndexedDB transaction executed'] }, null, 2) + '\n');
  console.log(JSON.stringify({ beforeReproductions: checks.length, frozen }));
} else {
  const types = text('interfaces-r2.ts');
  check('S1 explicit Metadata supplied to pure classification', /metadata:\s*Metadata\s*;/.test(fields(types, 'ProjectionInput')), true);
  check('S2 actual nullable final proof supplied before proved outputs', /finalProof:\s*VerifiedProof\s*\|\s*null\s*;/.test(fields(types, 'ProjectionInput')), true);
  const inputFor = m => ({ now: '2026-11-16T12:00:00.000Z', metadata: m, authority: authority(m),
    configId: JSON.parse(text('r2-check.json')).configId, sources: [sourceRead],
    participationRange: { complete: true, stop: 'exhausted', orderedSourceIds: [source.id], authority: authority(m) },
    summaryRange: { complete: true, stop: 'exhausted', orderedSourceIds: [source.id], authority: authority(m) }, coachRange: null, finalProof: null });
  check('S1 corrected public metadata distinguishes formerly identical inputs', new Set(worlds.map(m => hash(inputFor(m)))).size, 3);
  check('S1 same source now classifies true false false using explicit input', worlds.map(m => origin(inputFor(m).metadata, sourceRead)), [true, false, false]);
  check('S1 current membership loss cannot acquire physical legacy', origin(metadata, { ...sourceRead, ref: { ...sourceRead.ref, partition: 'current' } }), false);

  // Contract oracle uses compact direct source/membership/range bindings, not a new store.
  const selection = i => ({ metadata: i.metadata, now: i.now,
    sourceBindings: i.sources.map(s => ({ ref: s.ref, membership: s.membership })),
    participationRange: i.participationRange, summaryRange: i.summaryRange, coachRange: i.coachRange });
  const admitting = a => Number.isSafeInteger(a.revision) && a.revision >= 0 && a.revision < maximum;
  function matched(i) {
    const p = i.finalProof;
    return !!p && admitting(i.authority) && admitting(p.authority)
      && same(authority(i.metadata), i.authority) && same(p.authority, i.authority)
      && [i.participationRange, i.summaryRange, i.coachRange].every(r => !r?.complete || same(r.authority, i.authority))
      && p.configId === i.configId && ['all-writer-revision', 'coherent-range-and-sources'].includes(p.method)
      && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(p.admittedAt)
      && Number.isFinite(Date.parse(p.admittedAt)) && new Date(p.admittedAt).toISOString() === p.admittedAt
      && same(p.selection, selection(i));
  }
  // This oracle checks only whether proof-bearing output is permitted; it does not
  // assert that this one-source fixture supplies ten witnesses or a focus.
  const output = i => matched(i) ? { provedOutputPermitted: true, proof: i.finalProof }
    : { provedOutputPermitted: false, proof: null, candidate: null, median: null };
  const input = inputFor(metadata);
  const events = ['C charged metadata/source/membership reads', 'C validates clones and asynchronous source hashes'];
  check('S2 pre-proof arithmetic cannot publish proof candidate or median', output(input),
    { provedOutputPermitted: false, proof: null, candidate: null, median: null });
  // This is an in-memory stand-in for successful C completion, not a DB proof.
  const p = { method: 'all-writer-revision', authority: authority(metadata), configId: input.configId,
    admittedAt: input.now, selection: clone(selection(input)) };
  events.push('C obtains actual final proof under same ledger'); input.finalProof = p;
  events.push('D derives proof-bearing outputs from supplied actual proof');
  check('S2 matching supplied proof permits proof-bearing output', output(input).provedOutputPermitted, true);
  check('S2 D propagates exact supplied proof rather than minting one', output(input).proof === p, true);
  check('S2 null failed final transaction cannot become proved', output({ ...input, finalProof: null }).provedOutputPermitted, false);
  for (const [name, patch] of [['method', { method: 'local-counter' }], ['config', { configId: '0'.repeat(64) }],
    ['database', { authority: { ...p.authority, databaseId: 'recreated' } }],
    ['epoch', { authority: { ...p.authority, epochId: 'new-epoch' } }],
    ['revision', { authority: { ...p.authority, revision: 8 } }]]) {
    check(`S2 ${name} proof mismatch cannot publish`, output({ ...input, finalProof: { ...p, ...patch } }).provedOutputPermitted, false);
  }
  for (const [name, mutate] of [['source hash', s => { s.sourceBindings[0].ref.sha256 = '0'.repeat(64); }],
    ['membership', s => { s.sourceBindings[0].membership = { purpose: 'protected-probe' }; }],
    ['summary range', s => { s.summaryRange = { complete: true, stop: 'exhausted', orderedSourceIds: [], authority: p.authority }; }],
    ['legacy cutoff', s => { s.metadata.legacyCutoffCompletedAt = worlds[2].legacyCutoffCompletedAt; }]]) {
    const changed = clone(p); mutate(changed.selection);
    check(`S2 ${name} selection binding cannot be substituted`, output({ ...input, finalProof: changed }).provedOutputPermitted, false);
  }
  check('S1 metadata default-context disagreement rejects despite matching source and revision', matched({ ...input,
    metadata: { ...metadata, defaultContextId: 'another-context' } }), false);
  const wrongRange = clone(input); wrongRange.summaryRange.authority.revision = 8;
  wrongRange.finalProof.selection = selection(wrongRange);
  check('S2 complete range authority must agree even if selection was copied', matched(wrongRange), false);
  check('S2 malformed admittedAt cannot be invented by projection', matched({ ...input, finalProof: { ...p, admittedAt: '2026-02-30T12:00:00.000Z' } }), false);
  const admit = (candidateProof, actualProof, current) => candidateProof === actualProof && matched({ ...input, finalProof: actualProof })
    && same(current.authority, input.authority) && current.configId === input.configId && current.generation === 1 && current.state === 'idle';
  const current = { authority: input.authority, configId: input.configId, generation: 1, state: 'idle' };
  check('S2 same actual proof reaches final local admission', admit(output(input).proof, p, current), true);
  check('S2 scalar-identical substituted proof is not continuity of actual C proof', admit(p, clone(p), current), false);
  for (const [name, patch] of [['started', { state: 'running' }], ['generation', { generation: 2 }],
    ['config', { configId: '0'.repeat(64) }], ['epoch', { authority: { ...input.authority, epochId: 'new-epoch' } }],
    ['database', { authority: { ...input.authority, databaseId: 'recreated' } }]]) {
    check(`S2 local ${name} invalidates final admission`, admit(p, p, { ...current, ...patch }), false);
  }

  const relation = revisionRelation(text('r2-check.mjs')), fences = new Set(relation.requiredWriters);
  const penultimate = { ...metadata, sourceRevision: maximum - 1 }, saturated = { ...metadata, sourceRevision: maximum };
  check('S3 machine shape retains structurally readable sentinel', JSON.parse(text('metadata-membership.schema.json')).$defs.metadata.properties.sourceRevision.maximum, maximum);
  check('S3 actual revised author relation admits unchanged MAX-1', relation.revisionProof(penultimate, penultimate, fences), true);
  check('S3 actual revised author relation rejects unchanged MAX', relation.revisionProof(saturated, saturated, fences), false);
  check('S3 actual revised author relation rejects either side MAX',
    [relation.revisionProof(penultimate, saturated, fences), relation.revisionProof(saturated, penultimate, fences)], [false, false]);
  // Atomic-state transition oracle: not a real transaction/fault injection fixture.
  function mutation(db, action, committed = true) {
    const next = clone(db);
    if (action === 'reset' && next.metadata.sourceRevision === maximum) return { db: next, committed: false, available: false };
    if (action === 'save') next.ids.push('new-source');
    if (action === 'delete') next.ids = next.ids.slice(1);
    if (action === 'reset') next.metadata.activeEpochId = 'new-epoch';
    next.metadata.sourceRevision = next.metadata.sourceRevision === maximum ? maximum : next.metadata.sourceRevision + 1;
    return { db: committed ? next : clone(db), committed, available: committed && next.metadata.sourceRevision < maximum };
  }
  const db = { metadata: penultimate, ids: [source.id] };
  const transition = mutation(db, 'save');
  check('S3 mutation MAX-1 commits source and MAX together, disabling authority immediately',
    [transition.committed, transition.db.ids.length, transition.db.metadata.sourceRevision, transition.available], [true, 2, maximum, false]);
  check('S3 failed transaction preserves both source set and MAX-1', mutation(db, 'save', false).db, db);
  for (const action of ['save', 'delete']) {
    const next = mutation(transition.db, action);
    check(`S3 ordinary ${action} at MAX remains possible and non-admitting`,
      [next.committed, next.db.metadata.sourceRevision, next.available, relation.revisionProof(transition.db.metadata, next.db.metadata, fences)], [true, maximum, false, false]);
  }
  const reset = mutation(transition.db, 'reset');
  check('S3 reset at MAX cannot claim a new baseline epoch', [reset.committed, reset.available, reset.db.metadata.activeEpochId], [false, false, metadata.activeEpochId]);
  const resetTransition = mutation(db, 'reset');
  check('S3 reset MAX-1 may commit but returns exhausted without usable Authority',
    [resetTransition.committed, resetTransition.db.metadata.sourceRevision, resetTransition.available], [true, maximum, false]);
  const reload = JSON.parse(JSON.stringify(transition.db));
  check('S3 reload/cross-tab observes persistent sentinel, not an ephemeral flag',
    [admitting(authority(reload.metadata)), relation.revisionProof(reload.metadata, clone(reload.metadata), fences)], [false, false]);
  const maxInput = inputFor(saturated); maxInput.finalProof = { ...p, authority: authority(saturated), selection: selection(maxInput) };
  check('S3 even exact matching MAX metadata/config/selection/final proof cannot admit', matched(maxInput), false);
  for (const n of ['coach-config.example.json', 'coach-config.schema.json', 'finite-catalogue.example.json', 'finite-adapter-r2.md', 'revision-check.mjs']) {
    check(`accepted numeric/config/catalogue/finite artifact unchanged: ${n}`, hash(text(n).replace(/\r\n/g, '\n')),
      hash(git('show', `${frozen}:${dir}${n}`).replace(/\r\n/g, '\n') + '\n'));
  }
  const report = { kind: 'P1-S1-S3-author-contract-regressions', frozen, checks: checks.length, cases: checks, events,
    sourceId: source.id, sourceHash: hash(source),
    limits: ['Author semantic/seam oracles, not production derivePolicy/admitPractice',
      'Final proof creation in this harness is an explicit in-memory stand-in, not a real transaction',
      'Atomicity/reload/cross-tab relations are not real IndexedDB or browser tests',
      'A2 independent acceptance remains required; C2 accepted numeric slice not reopened'] };
  writeFileSync(new URL('authority-seams-after.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ seamChecks: checks.length, acceptedArtifactsUnchanged: 5 }));
}
