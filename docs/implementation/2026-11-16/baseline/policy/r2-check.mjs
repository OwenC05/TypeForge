// Author delta probes. No production implementation, real DB races, or independent verdict.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { TypingEngine } from '../../../../../typing-app/client/src/engine.ts';
import { validateResult } from '../../../../../typing-app/client/src/storage.ts';
import { assessmentPrompts, practicePrompts } from '../../../../../typing-app/client/src/corpus.ts';
import { baseline, qualifying, sentenceIssue, runIssue, inspect, membersFor, hash,
  validTime, at, uniform, uniformMembers, catalogue, config, engineRun } from './revision-check.mjs';

const named = [], detail = {};
const check = (name, actual, expected) => { assert.deepEqual(actual, expected, name); named.push(name); };
const clone = x => structuredClone(x);
const read = name => JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
const occurrences = text => [...text.matchAll(/[a-z]+/g)].reduce((n, m) => n + m[0].length - 1, 0);
const endUTC = '2026-11-16T11:00:00.000Z';

// Reuse C2's published exact counterexample, not a repeated corpus search.
const prompt = assessmentPrompts.find(p => p.id === 'assessment-005');
const slowPairs = new Set(['pl', 'ea', 'as', 'et', 'em', 'mp']);
function lagged(firstLag) {
  const e = new TypingEngine({ id: '00000000-0000-4000-8000-000000999001',
    prompts: [prompt], durationMs: 30000, inputMode: 'flow-v1', qwerty: true, corpusVersion: '1' });
  const trace = []; let press = 0;
  for (let i = 0; i < prompt.text.length; i++) {
    if (i) press += slowPairs.has(prompt.text.slice(i - 1, i + 1)) ? 5000 : 0.001;
    const input = i === 0 ? firstLag : press;
    trace.push({ i, press, input }); e.edit({ start: i, end: i, text: prompt.text[i], pressTime: press }, input);
  }
  press += 0.001;
  e.edit({ start: prompt.text.length, end: prompt.text.length, text: ' ', pressTime: press }, press);
  e.tick(Math.max(press, firstLag + 30000));
  const r = e.result(endUTC); assert.ok(r); validateResult(r); return { r, trace };
}
detail.clock = [0, 0.01, 0.1, 1].map(lag => {
  const { r, trace } = lagged(lag);
  return { lag, trace, result: r, clean: r.sentences.filter(s => s.eligible).length,
    issue: runIssue(r), intervalLowerBound: r.sentences.flatMap(s => Object.values(s.pairs))
      .reduce((n, p) => n + p.count * Math.exp(p.logSum / p.count), 0) };
});
check('C2 independent first-keydown/input deadlines preserve completed sentences', detail.clock.map(x => x.clean), [0, 0, 1, 1]);
check('C2 genuine metric1 lagged sources all remain count-admissible', detail.clock.map(x => x.issue), [null, null, null, null]);
check('positive source lower-bound can exceed saved elapsed without rejection',
  [detail.clock[3].intervalLowerBound > 30000, detail.clock[3].result.metrics.elapsedMs,
    sentenceIssue(detail.clock[3].result, detail.clock[3].result.sentences[0])], [true, 30000, null]);

detail.endpoints = [4999.999, 5000, 5000.001, 0.25].map((interval, n) => {
  const e = new TypingEngine({ id: `00000000-0000-4000-8000-${String(999100 + n).padStart(12, '0')}`,
    prompts: [prompt], durationMs: 30000, inputMode: 'flow-v1', qwerty: true, corpusVersion: '1' });
  let time = 1;
  for (let i = 0; i < prompt.text.length; i++) {
    if (i) time += i === 1 ? interval : 0.25;
    e.edit({ start: i, end: i, text: prompt.text[i], pressTime: time }, time);
  }
  time += 0.25; e.edit({ start: prompt.text.length, end: prompt.text.length, text: ' ', pressTime: time }, time);
  e.tick(30001); const r = e.result(endUTC); validateResult(r);
  const count = Object.values(r.sentences[0].pairs).reduce((a, p) => a + p.count, 0);
  check(`producer interval ${interval} filter count`, count, occurrences(prompt.text) - Number(interval > 5000));
  check(`producer interval ${interval} all-pair/count admission`, [r.sentences[0].eligible, runIssue(r)], [true, null]);
  return { interval, count, sentence: r.sentences[0] };
});
check('enabled identity replaces r1 disabled scope with a new schema/policy',
  [config.schemaId, config.policyId, config.releaseScope.automaticCoachingEnabled, config.admission.aggregateElapsedRejection],
  ['typeforge-coach-config-schema-v3', 'clean-pair-contrast-v1-r2-enabled', true, false]);
check('connected enabled he path retains thresholds/certificate',
  [at.baseline.counted, at.profile.timing, config.support.targetIntervals, config.effect.minimumRatio], [10, true, 20, 1.25]);
check('connected enabled no-target uniform path remains a truthful fallback', inspect(uniform, uniformMembers, 'he').timing, false);
check('cached ten cannot authorize newest-ten median', baseline(at.sources, at.memberships, { exhausted: false }).summary, null);

// This is a small local shape-subset oracle, not a standards JSON Schema validator.
const authoritySchema = read('metadata-membership.schema.json');
function shape(s, value) {
  if (s.$ref) return shape(s.$ref.split('/').slice(1).reduce((x, key) => x[key], authoritySchema), value);
  if (s.oneOf) return s.oneOf.filter(part => shape(part, value)).length === 1;
  if (Object.hasOwn(s, 'const') && value !== s.const) return false;
  if (s.enum && !s.enum.includes(value)) return false;
  if (s.type === 'string' && (typeof value !== 'string' || (s.minLength && value.length < s.minLength)
    || (s.maxLength && value.length > s.maxLength) || (s.pattern && !new RegExp(s.pattern).test(value)))) return false;
  if (s.type === 'integer' && (!Number.isSafeInteger(value) || value < s.minimum || value > s.maximum)) return false;
  if (s.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    if (s.required.some(k => !Object.hasOwn(value, k)) || Object.keys(value).some(k => !Object.hasOwn(s.properties, k))) return false;
    return Object.entries(s.properties).every(([k, sub]) => shape(sub, value[k]));
  }
  return true;
}
const metadata = { schemaId: 'typeforge-coach-metadata-v3', databaseId: 'db-1', defaultContextId: 'default-1',
  activeEpochId: 'epoch-1', legacyEpochId: 'epoch-1', legacyCutoffCompletedAt: endUTC, sourceRevision: 7 };
const capture = { databaseId: 'db-1', contextId: 'default-1', epochId: 'epoch-1', capturedAt: endUTC, purpose: 'ordinary' };
const membership = { schemaId: 'typeforge-coach-membership-v2', ...capture, sourceKind: 'timed-v1',
  resultId: at.sources[0].id, resultSha256: hash(at.sources[0]) };
function membershipBound(m, source, cap) {
  return shape(authoritySchema, m) && validTime(m.capturedAt)
    && m.resultId === source.id && m.resultSha256 === hash(source)
    && m.sourceKind === ('schemaVersion' in source ? 'timed-v1' : 'finite-practice-v1')
    && ['databaseId', 'contextId', 'epochId', 'capturedAt', 'purpose'].every(k => m[k] === cap[k]);
}
function originAllowed(partition, r, m, md, cap) {
  if (!shape(authoritySchema, md) || !validTime(md.legacyCutoffCompletedAt)) return false;
  return partition === 'legacy' ? md.activeEpochId === md.legacyEpochId && r.completedAt <= md.legacyCutoffCompletedAt
    : !!m && membershipBound(m, r, cap) && m.databaseId === md.databaseId
      && m.contextId === md.defaultContextId && m.epochId === md.activeEpochId;
}
check('strict metadata and membership positive shapes', [shape(authoritySchema, metadata), shape(authoritySchema, membership)], [true, true]);
for (const [name, changed] of [
  ['extra', { ...metadata, extra: 1 }], ['unsafe revision', { ...metadata, sourceRevision: Number.MAX_SAFE_INTEGER + 1 }],
  ['missing database identity', { ...metadata, databaseId: '' }],
  ['noncanonical UTC', { ...metadata, legacyCutoffCompletedAt: '2026-11-16T11:00:00Z' }],
]) check(`metadata ${name} shape rejects`, shape(authoritySchema, changed), false);
const feb30 = { ...metadata, legacyCutoffCompletedAt: '2026-02-30T11:00:00.000Z' };
check('calendar impossibility requires semantic round trip beyond machine shape',
  [shape(authoritySchema, feb30), validTime(feb30.legacyCutoffCompletedAt)], [true, false]);
check('membership hash/capture binding accepts exact source', membershipBound(membership, at.sources[0], capture), true);
for (const [name, patch] of [['hash', { resultSha256: '0'.repeat(64) }], ['epoch', { epochId: 'epoch-2' }],
  ['database', { databaseId: 'db-recreated' }], ['kind', { sourceKind: 'finite-practice-v1' }],
  ['purpose', { purpose: 'protected-probe' }]]) {
  check(`membership semantic ${name} mismatch rejects`, membershipBound({ ...membership, ...patch }, at.sources[0], capture), false);
}
check('physical legacy original source may count in initial epoch', originAllowed('legacy', at.sources[0], null, metadata, capture), true);
check('delayed current save with old timestamp cannot acquire legacy', originAllowed('current', at.sources[0], null, metadata, capture), false);
check('current exact captured membership may count', originAllowed('current', at.sources[0], membership, metadata, capture), true);
check('membership loss never turns current source legacy', originAllowed('current', at.sources[0], null, metadata, capture), false);
check('reset excludes physical legacy and captured old current',
  ['legacy', 'current'].map(p => originAllowed(p, at.sources[0], membership, { ...metadata, activeEpochId: 'epoch-2' }, capture)), [false, false]);
check('missing metadata remains unavailable', originAllowed('legacy', at.sources[0], null, null, capture), false);

// Physical operation ledger countermodels: these execute charged requests in memory.
// They do not reimplement P3 or prove IndexedDB scheduling/materialization behavior.
class LedgerProbe {
  rows = 0; bytes = 0; terminal = null; operations = [];
  request(kind, actual, { reserve = 4096, stop = null, found = true } = {}) {
    if (this.terminal) return false;
    if (this.rows === 500 || this.bytes + reserve > 16 * 1024 * 1024) {
      this.terminal = this.rows === 500 ? 'row-budget' : 'byte-budget'; return false;
    }
    this.rows++; this.bytes += actual;
    this.operations.push({ kind, actual, found }); if (stop) this.terminal = stop; return true;
  }
}
const combined = new LedgerProbe(); combined.request('metadata', 300);
for (let i = 0; i < 10; i++) { combined.request('source', 1000, { reserve: 1048576 }); combined.request('membership', 400); }
combined.request('final-metadata', 300);
check('ten sources plus companions and barrier use one physical ledger', [combined.rows, combined.bytes], [22, 14600]);
combined.request('missing-membership', 0, { found: false });
check('missing point still charges an attempted row', combined.rows, 23);
const disjoint = new LedgerProbe();
for (let i = 0; i < 30; i++) { disjoint.request('source', 100); disjoint.request('membership', 100); }
check('disjoint ten witnesses and twenty coach sources cost sixty attempts', disjoint.rows, 60);
const boundary = new LedgerProbe(); for (let i = 0; i < 499; i++) boundary.request('missing-point', 0, { found: false });
check('final proof fits only reserved five-hundredth attempt', [boundary.rows, boundary.request('final-metadata', 300), boundary.rows], [499, true, 500]);
check('five-hundred-first physical attempt cannot mint another budget', [boundary.request('source', 1), boundary.terminal], [false, 'row-budget']);
const byte = new LedgerProbe(); for (let i = 0; i < 16; i++) byte.request('source', 1048576, { reserve: 1048576 });
check('exact sixteen MiB leaves no hidden final-barrier allowance', [byte.bytes, byte.request('final-metadata', 300), byte.terminal], [16777216, false, 'byte-budget']);
const terminal = new LedgerProbe(); terminal.request('legacy-source', 100); terminal.request('current-oversize', 1048576, { reserve: 1048576, stop: 'record-limit' });
check('record-limit is terminal through both-stream/own-loop continuation', [terminal.request('legacy-next', 100), terminal.request('final-metadata', 300), terminal.rows, terminal.bytes], [false, false, 2, 1048676]);

const requiredWriters = ['save', 'retry', 'finite-save', 'delete', 'reset', 'membership', 'upgrade-fence', 'import-recovery-fence'];
const authorityKey = m => [m.databaseId, m.defaultContextId, m.activeEpochId, m.sourceRevision].join('/');
function revisionProof(before, after, fenced) {
  const admitting = m => Number.isSafeInteger(m.sourceRevision) && m.sourceRevision >= 0
    && m.sourceRevision < Number.MAX_SAFE_INTEGER;
  return admitting(before) && admitting(after) && requiredWriters.every(w => fenced.has(w))
    && authorityKey(before) === authorityKey(after);
}
const fenced = new Set(requiredWriters);
check('revision relation requires exact durable lineage and complete writer contract', revisionProof(metadata, metadata, fenced), true);
for (const writer of requiredWriters) check(`missing ${writer} fence cannot certify unchanged local revision`, revisionProof(metadata, metadata, new Set(requiredWriters.filter(w => w !== writer))), false);
check('changed revision and recreated database reject barrier relation', [revisionProof(metadata, { ...metadata, sourceRevision: 8 }, fenced),
  revisionProof(metadata, { ...metadata, databaseId: 'db-2' }, fenced)], [false, false]);

// A finite forwarding guard around the UNCHANGED real producer, not the future adapter.
// It captures existing actual-time metrics while preventing additional forwarded actions.
function finiteTraversal(template, variant = 'clean') {
  const prompts = template.promptIds.map(id => practicePrompts.find(p => p.id === id));
  const e = new TypingEngine({ id: '00000000-0000-4000-8000-000000999201', mode: 'practice', prompts,
    durationMs: 30000, inputMode: 'flow-v1', qwerty: true, corpusVersion: '1' });
  let time = 0, terminal = false, snap = null, forwarded = 0;
  const send = (start, end, text) => {
    if (terminal) return false;
    const accepted = e.edit({ start, end, text, pressTime: time }, time); forwarded++; time++;
    if (e.submittedSummaries.length === prompts.length) { terminal = true; snap = e.snapshot(time - 1); }
    return accepted;
  };
  for (const [i, p] of prompts.entries()) {
    if (variant === 'interrupted' && i === 1) e.interrupt(time);
    if (variant === 'edited' && i === 0) { send(0, 0, 'x'); send(0, 1, ''); }
    for (const char of p.text + ' ') { const pos = e.value.length; send(pos, pos, char); }
  }
  const before = forwarded, overrunAccepted = send(0, 0, 'x');
  const result = { schemaId: 'typeforge-finite-practice-result-v1', id: '00000000-0000-4000-8000-000000999201',
    owner: 'guest', completedAt: endUTC, mode: 'practice', metricVersion: 1,
    termination: 'plan-exhausted', eligibleForProgress: false,
    settings: { durationMs: 30000, inputMode: 'flow-v1', language: 'en', qwerty: true, corpusVersion: '1' },
    metrics: snap.metrics, qualityFlags: snap.qualityFlags, sentences: e.submittedSummaries, chartSamples: [],
    plan: { configId: hash(config), catalogueId: config.exposure.catalogueId, planHash: template.planHash,
      pair: template.pair, sentenceCount: prompts.length } };
  return { result, elapsed: snap.elapsedMs, forwarded, before, overrunAccepted,
    legacyResult: e.result(endUTC), promptIds: e.submittedSummaries.map(s => s.promptId) };
}
detail.finite = catalogue.templates.map(t => {
  const r = finiteTraversal(t), m = r.result.metrics;
  check(`finite ${t.pair} exact source plan submitted`, r.promptIds, t.promptIds);
  check(`finite ${t.pair} guard never forwards uncertified next action`, [r.overrunAccepted, r.forwarded], [false, r.before]);
  check(`finite ${t.pair} existing actual-time formulas retained`,
    [m.wpm, m.accuracy, m.correctCharacters, m.elapsedMs > 0 && m.elapsedMs < 30000],
    [m.correctCharacters * 12000 / m.elapsedMs, m.correctAttempts / m.attemptedCharacters * 100, t.promptIds.reduce((n, id) => n + practicePrompts.find(p => p.id === id).text.length, 0), true]);
  check(`finite ${t.pair} unchanged producer does not fabricate timed result`, r.legacyResult, null);
  assert.throws(() => validateResult(r.result)); named.push(`finite ${t.pair} envelope rejected by timed-result validator`);
  const fakeTimed = { id: r.result.id, owner: 'guest', schemaVersion: 1, metricVersion: 1,
    completedAt: endUTC, mode: 'practice', settings: r.result.settings, qualityFlags: [], eligibleForProgress: true,
    metrics: m, sentences: r.result.sentences, chartSamples: [] };
  assert.throws(() => validateResult(fakeTimed), /metrics.elapsedMs/);
  named.push(`finite ${t.pair} actual metrics cannot pass timed elapsed-duration equality`);
  check(`finite ${t.pair} cannot enter completed-30s policy sources`, qualifying(r.result, membersFor([r.result])), false);
  return r;
});
const edited = finiteTraversal(catalogue.templates[0], 'edited');
check('finite editing preserves attempted/deleted counts and sentence ineligibility',
  [edited.result.metrics.deletedCharacters, edited.result.metrics.attemptedCharacters > detail.finite[0].result.metrics.attemptedCharacters,
    edited.result.sentences[0].eligible], [1, true, false]);
const interrupted = finiteTraversal(catalogue.templates[0], 'interrupted');
check('finite interrupted producer retains interruption flag and evidence exclusion',
  [interrupted.result.qualityFlags.includes('interrupted'), qualifying(interrupted.result, membersFor([interrupted.result]))], [true, false]);
detail.edited = edited.result; detail.interrupted = interrupted.result;
detail.deadline = [-0.001, 0, 0.001].map(offset => {
  const e = new TypingEngine({ id: '00000000-0000-4000-8000-000000999301', prompts: [prompt],
    durationMs: 30000, inputMode: 'flow-v1', qwerty: true, corpusVersion: '1' });
  for (let i = 0; i < prompt.text.length; i++) e.edit({ start: i, end: i, text: prompt.text[i], pressTime: i }, i);
  e.edit({ start: prompt.text.length, end: prompt.text.length, text: ' ', pressTime: 30000 + offset }, 30000 + offset);
  return { offset, submitted: e.submittedSummaries.length, state: e.state };
});
check('producer deadline wins at/after boundary and never invents a commit', detail.deadline.map(x => [x.submitted, x.state]),
  [[1, 'running'], [0, 'completed'], [0, 'completed']]);
const abort = new TypingEngine({ id: '00000000-0000-4000-8000-000000999401', prompts: [prompt],
  durationMs: 30000, inputMode: 'flow-v1', qwerty: true, corpusVersion: '1' });
abort.edit({ start: 0, end: 0, text: 'p', pressTime: 1 }, 1); abort.abort(2);
check('abort is not relabelled timed or plan completion', [abort.state, abort.result(endUTC)], ['aborted', null]);
const practice = Array.from({ length: 20 }, (_, i) => engineRun(practicePrompts, 200, i + 30, { mode: 'practice' }));
const ordinaryNext = [...at.sources, ...practice], earlyNext = [...at.sources, detail.finite[0].result];
check('ordinary timed practice remains next-window feedback and can retire target',
  [inspect(ordinaryNext, membersFor(ordinaryNext), 'he').windowIds, inspect(ordinaryNext, membersFor(ordinaryNext), 'he').timing], [practice.map(r => r.id), false]);
check('practice never replaces assessment median witnesses', baseline(ordinaryNext, membersFor(ordinaryNext)).ids, at.baseline.ids);
check('early finite end does not become coach or median feedback',
  [inspect(earlyNext, membersFor(earlyNext), 'he').windowIds, baseline(earlyNext, membersFor(earlyNext)).ids], [at.profile.windowIds, at.baseline.ids]);
const frozen = hash(at.profile); inspect(ordinaryNext, membersFor(ordinaryNext), 'he');
check('next-block evidence derivation never mutates prior admitted arithmetic snapshot', hash(at.profile), frozen);

// UI projections are derived independently; pending sources are never durable witnesses.
function pendingBaseline(records, savedIds = new Set()) {
  const ids = new Set();
  for (const p of records) {
    if (!p.retryable || !['pending', 'failed'].includes(p.state) || savedIds.has(p.source.id)
      || p.capture?.databaseId !== metadata.databaseId || p.capture?.contextId !== metadata.defaultContextId
      || p.capture?.epochId !== metadata.activeEpochId || p.capture?.purpose !== 'ordinary') continue;
    if (qualifying(p.source, membersFor([p.source]), 'epoch-1', true)) ids.add(p.source.id);
  }
  return ids.size;
}
const pendingTenth = { source: at.sources[9], capture, state: 'pending', retryable: true, durablySaved: false };
check('completed unsaved assessment is pending once, never a tenth durable witness',
  [pendingBaseline([pendingTenth]), baseline(at.sources.slice(0, 9), at.memberships).counted], [1, 9]);
check('failed retryable pending result survives navigation projection and deduplicates',
  pendingBaseline([pendingTenth, { ...pendingTenth, state: 'failed' }]), 1);
for (const [name, patch] of [['old epoch', { capture: { ...capture, epochId: 'epoch-2' } }],
  ['uncaptured', { capture: null }], ['unretryable', { retryable: false }], ['rejected', { state: 'rejected' }],
  ['practice', { source: practice[0] }], ['finite', { source: detail.finite[0].result }]]) {
  check(`pendingSave excludes ${name}`, pendingBaseline([{ ...pendingTenth, ...patch }]), 0);
}
check('settled durable source leaves pending projection', pendingBaseline([pendingTenth], new Set([pendingTenth.source.id])), 0);
const nextOrdinal = (count, pending, exact) => exact && count + pending < 10 ? count + pending + 1 : null;
check('pending failure advances only exact below-cap ordinal', [nextOrdinal(7, 1, true), nextOrdinal(7, 1, false), nextOrdinal(9, 1, true)], [9, null, null]);
check('pending collection lost on reload reuses uncounted ordinal', nextOrdinal(7, pendingBaseline([]), true), 8);
const split = baseline(at.sources, at.memberships, { exhausted: false });
check('milestone proof can be complete while newest summary proof remains incomplete', [split.complete, split.counted, split.summary], [true, 10, null]);

// Keep one complete clock witness; other deterministic sources bind by hash, not copied payload.
const receiptDetail = {
  clock: detail.clock.map(({ result, trace, ...x }) => ({ ...x, sourceHash: hash(result),
    ...(x.lag === 1 ? { result, trace } : { firstEvents: trace.slice(0, 2), lastEvent: trace.at(-1) }) })),
  endpoints: detail.endpoints.map(({ sentence, ...x }) => ({ ...x, eligible: sentence.eligible,
    sentenceHash: hash(sentence), retainedPairs: Object.keys(sentence.pairs).length })),
  deadline: detail.deadline,
  finite: detail.finite.map(x => ({ sourceHash: hash(x.result), schemaId: x.result.schemaId,
    plan: x.result.plan, metrics: x.result.metrics, flags: x.result.qualityFlags,
    promptIds: x.promptIds, sentenceHashes: x.result.sentences.map(hash),
    forwarded: x.forwarded, before: x.before, overrunAccepted: x.overrunAccepted, legacyResult: x.legacyResult })),
  edited: { sourceHash: hash(detail.edited), metrics: detail.edited.metrics,
    firstSentenceEligible: detail.edited.sentences[0].eligible },
  interrupted: { sourceHash: hash(detail.interrupted), metrics: detail.interrupted.metrics,
    qualityFlags: detail.interrupted.qualityFlags },
};
const report = { kind: 'P1-r2-author-delta-probes', node: process.version, checks: named.length,
  configId: hash(config), catalogueId: config.exposure.catalogueId,
  frozenInputs: { c2: '3c9342c', a2: '6418bcc', h3: '884dbec', storage: '3e31425', claudeFinite: '9033337', claudeR2: '3ad71b6' },
  detail: receiptDetail, ledger: { combined, disjointRows: disjoint.rows, boundary: { rows: boundary.rows, terminal: boundary.terminal },
    bytes: byte.bytes, terminalRecord: terminal }, named,
  limits: ['Author contract-only evidence; no self-approval', '108 revision and 148 legacy checks are separate/reused, not additional independent assertions',
    'No standards JSON Schema package; local subset oracle plus semantic bindings',
    'Ledger/provenance/revision relations execute in memory, not IndexedDB transactions or races',
    'Finite forwarding harness uses unchanged producer; production finite state/validator/persistence remain unimplemented',
    'No new corpus search, UI/AT/browser/performance or human-learning evidence'] };
writeFileSync(new URL('r2-check.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ r2Checks: named.length, configId: report.configId,
  clock: detail.clock.map(x => ({ lag: x.lag, clean: x.clean, issue: x.issue })),
  finite: detail.finite.map(x => ({ pair: x.result.plan.pair, elapsed: x.elapsed, sentences: x.promptIds.length,
    timedResult: x.legacyResult, wpm: x.result.metrics.wpm })) }, null, 2));
