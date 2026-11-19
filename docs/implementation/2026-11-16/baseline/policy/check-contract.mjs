// Legacy independent-scalar/schema smoke oracle; NOT evidence of connected qualification,
// sidecar authority, storage races or application/model independence. See revision-check.mjs.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const read = name => JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
const config = read('coach-config.example.json');
const fixtures = read('contract-boundaries.json');
const canonical = value => value === null || typeof value !== 'object' ? JSON.stringify(value)
  : Array.isArray(value) ? `[${value.map(canonical).join(',')}]`
    : `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
const sha256 = value => createHash('sha256').update(canonical(value)).digest('hex');
const exactSchema = value => value !== null && typeof value === 'object' && !Array.isArray(value)
  ? { type: 'object', additionalProperties: false, required: Object.keys(value),
    properties: Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, exactSchema(entry)])) }
  : { const: value };
const expectedSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'urn:typeforge:coach-config-schema-v3',
  title: 'Exact enabled experimental TypeForge coaching configuration v1-r2',
  ...exactSchema(config),
};
if (process.argv.includes('--write-schema')) {
  writeFileSync(new URL('coach-config.schema.json', import.meta.url), `${JSON.stringify(expectedSchema, null, 2)}\n`);
}
assert.deepEqual(read('coach-config.schema.json'), expectedSchema, 'schema and reviewed example must agree');
let checks = 1;
const test = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks++; };
const validConfig = candidate => canonical(candidate) === canonical(config);
test(validConfig(config), true, 'exact config');
test(validConfig({ ...config, unknown: true }), false, 'unknown config field');
test(validConfig({ ...config, policyId: 'other' }), false, 'wrong policy');
test(validConfig({ ...config, effect: { ...config.effect, minimumRatio: 0 } }), false, 'invalid effect');
test(validConfig(null), false, 'missing coach config');
for (const ridge of ['valid', 'missing', 'malformed']) {
  test(validConfig(config), true, `${ridge} Ridge cannot invalidate coach`);
  test(validConfig(null), false, `${ridge} Ridge cannot create coach`);
}

// Small schema-subset oracle for these local documents, not a general JSON Schema package.
const sidecarSchema = read('coach-sidecar.schema.json');
const schemaCheck = (s, value) => {
  if (s.$ref) return schemaCheck(s.$ref.split('/').slice(1).reduce((part, key) => part[key], sidecarSchema), value);
  if (s.const !== undefined && canonical(value) !== canonical(s.const)) return false;
  if (s.enum && !s.enum.some(entry => canonical(entry) === canonical(value))) return false;
  if (s.oneOf && s.oneOf.filter(part => schemaCheck(part, value)).length !== 1) return false;
  if (s.anyOf && !s.anyOf.some(part => schemaCheck(part, value))) return false;
  if (s.allOf && !s.allOf.every(part => schemaCheck(part, value))) return false;
  if (s.if && !schemaCheck(schemaCheck(s.if, value) ? (s.then ?? {}) : (s.else ?? {}), value)) return false;
  if (s.type === 'null' && value !== null) return false;
  if (s.type === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) return false;
  if (s.type === 'integer' && !Number.isSafeInteger(value)) return false;
  if (typeof value === 'number' && ((s.minimum !== undefined && value < s.minimum) || (s.maximum !== undefined && value > s.maximum))) return false;
  if (s.type === 'string' && typeof value !== 'string') return false;
  if (typeof value === 'string') {
    if (s.minLength !== undefined && value.length < s.minLength) return false;
    if (s.maxLength !== undefined && value.length > s.maxLength) return false;
    if (s.pattern && !new RegExp(s.pattern).test(value)) return false;
    if (s.format === 'date-time' && (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) ||
      !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value)) return false;
  }
  if (s.type === 'array' && !Array.isArray(value)) return false;
  if (Array.isArray(value)) {
    if (s.minItems !== undefined && value.length < s.minItems) return false;
    if (s.maxItems !== undefined && value.length > s.maxItems) return false;
    if (s.uniqueItems && new Set(value.map(canonical)).size !== value.length) return false;
    if (s.items && !value.every(entry => schemaCheck(s.items, entry))) return false;
  }
  if (s.type === 'object' && (value === null || typeof value !== 'object' || Array.isArray(value))) return false;
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    if (s.required?.some(key => !Object.hasOwn(value, key))) return false;
    if (s.additionalProperties === false && Object.keys(value).some(key => !Object.hasOwn(s.properties ?? {}, key))) return false;
    if (s.properties && !Object.entries(s.properties).every(([key, part]) => !Object.hasOwn(value, key) || schemaCheck(part, value[key]))) return false;
  }
  return true;
};
const examples = read('sidecar-examples.json');
for (const [name, example] of Object.entries(examples)) test(schemaCheck(sidecarSchema, example), true, name);
test(examples.generalDecision.configId, sha256(config), 'sidecar config identity');
for (const [name, changed] of [
  ['unknown field', { ...examples.membership, unknown: true }],
  ['missing membership field', Object.fromEntries(Object.entries(examples.membership).filter(([key]) => key !== 'epochId'))],
  ['bad hash', { ...examples.membership, resultSha256: 'bad' }],
  ['bad timestamp', { ...examples.membership, capturedAt: 'not-a-dateZ' }],
  ['bad kind', { ...examples.membership, kind: 'schema-v1-result' }],
  ['bad purpose', { ...examples.membership, purpose: 'training-upload' }],
  ['duplicate source', { ...examples.generalDecision, sourceIds: ['same', 'same'] }],
  ['too many sources', { ...examples.generalDecision, sourceIds: Array.from({ length: 21 }, (_, i) => `s${i}`) }],
  ['negative revision', { ...examples.generalDecision, sourceRevision: -1 }],
  ['unsupported reason', { ...examples.generalDecision, reason: 'mastered' }],
  ['unsupported suggestion', { ...examples.generalDecision, outcome: 'suggested' }],
  ['bad pending reason', { ...examples.generalDecision, outcome: 'pending' }],
  ['bad unavailable reason', { ...examples.generalDecision, outcome: 'unavailable' }],
]) test(schemaCheck(sidecarSchema, changed), false, name);
const half = { targetCount: 10, referenceCount: 40, targetLogSum: 10 * Math.log(250), referenceLogSum: 40 * Math.log(200), sourceRuns: 2 };
const suggested = { ...examples.generalDecision, outcome: 'suggested', reason: 'supported', focus: {
  pair: 'th', targetCount: 20, referenceCount: 80, sourceRuns: 4, promptContexts: 4, wordContexts: 3,
  targetLogSum: 20 * Math.log(250), referenceLogSum: 80 * Math.log(200), halves: [half, half], certificateId: 'b'.repeat(64),
} };
test(schemaCheck(sidecarSchema, suggested), true, 'synthetic structurally supported shape');
test(schemaCheck(sidecarSchema, { ...suggested, focus: { ...suggested.focus, targetCount: -1 } }), false, 'negative support');
test(schemaCheck(sidecarSchema, { ...suggested, focus: { ...suggested.focus, pair: 'TH' } }), false, 'unsupported pair shape');
test(schemaCheck(sidecarSchema, { ...suggested, focus: { ...suggested.focus, halves: [half] } }), false, 'one half');
test(schemaCheck(sidecarSchema, { ...suggested, focus: { ...suggested.focus, unknown: true } }), false, 'unknown nested provenance');

for (const f of fixtures.count) test(Math.min(config.baseline.tests, f.uniqueQualifying), f.expected, f.name);
for (const f of fixtures.participation) {
  const r = { valid: true, member: true, saved: true, completed: true, eligible: true,
    attempts: 1, elapsedMs: 30000, durationMs: 30000, flags: [], mode: 'assessment',
    qwerty: true, metricVersion: 1, inputMode: 'flow-v1', completedOffsetMs: 0, ...f };
  const pass = r.valid && r.member && r.saved && r.completed && r.eligible &&
    r.attempts >= config.baseline.minimumAttempts && r.elapsedMs === 30000 &&
    r.durationMs === 30000 && !r.flags.length && r.mode === 'assessment' && r.qwerty &&
    r.metricVersion === 1 && r.inputMode === 'flow-v1' && r.completedOffsetMs <= 0;
  test(pass, f.expected, f.name);
}
// Independent threshold perturbations, not claimed to be realizable human histories.
const gate = overrides => {
  const x = { target: 20, reference: 80, runs: 4, prompts: 4, words: 3,
    halfTarget: 8, halfReference: 20, halfRuns: 2, ratio: 1.25,
    halfRatio: 1.1, bankPrompts: 4, certificate: true, ...overrides };
  if (x.target < 20 || x.reference < 80 || x.runs < 4) return 'too-few-observations-for-any-pair';
  if (x.prompts < 4 || x.words < 3) return 'insufficient-context-diversity';
  if (x.halfTarget < 8 || x.halfReference < 20 || x.halfRuns < 2) return 'unstable-evidence';
  if (Math.abs(Math.log(x.ratio)) <= 1e-10 || Math.log(x.ratio) + 1e-10 < Math.log(1.25)) return 'no-effect';
  if (Math.log(x.halfRatio) + 1e-10 < Math.log(1.1)) return 'unstable-evidence';
  if (x.bankPrompts < 4) return 'corpus-coverage';
  return x.certificate ? 'suggested' : 'exposure-unsupported';
};
for (const f of fixtures.gates) test(gate(f), f.expected, f.name);
for (const f of fixtures.window) {
  const ordered = Array.from({ length: f.available }, (_, i) => i).slice(-config.window.runs);
  test(ordered.length, f.expected, f.name);
  if (f.available > 20) test(ordered.includes(0), false, 'oldest excess source excluded');
}
for (const f of fixtures.age) test(f.ageMs >= 0 && f.ageMs <= config.window.ageMs, f.expected, f.name);
for (const f of fixtures.lifecycle) {
  const x = { sameGeneration: true, sameRevision: true, sameContext: true,
    sameEpoch: true, sameConfig: true, started: false, ...f };
  test(x.sameGeneration && x.sameRevision && x.sameContext && x.sameEpoch && x.sameConfig && !x.started,
    f.expected, f.name);
}
for (const f of fixtures.proof) {
  test(`${f.exhausted || f.found >= 10 ? 'exact' : 'lower-bound'}-${Math.min(f.found, 10)}`, f.expected, f.name);
}
const exposure = f => {
  const x = { known: true, ratio: 1.25, words: 3, passages: 4, ...f };
  if (!x.known) return 'unknown';
  if (x.characters < 20) return 'too-short-to-evaluate';
  // Short partials report density separately, without claiming context completion.
  if (x.characters < 240) return 'partial-context';
  return x.ratio < 1.25 || x.words < 3 || (x.characters >= 480 && x.passages < 4)
    ? 'below-contract' : 'met';
};
for (const f of fixtures.exposure) test(exposure(f), f.expected, f.name);

// IDs are deduplicated; deletion/reset changes the derived milestone, never a sticky boolean.
const countIds = ids => Math.min(10, new Set(ids).size);
test(countIds(Array.from({ length: 11 }, () => 'same')), 1, 'duplicate ID cannot unlock');
const ids = Array.from({ length: 10 }, (_, i) => `source-${i}`);
test(countIds(ids), 10, 'ten-source witness');
test(countIds(ids.slice(1)), 9, 'delete witness');
test(countIds([]), 0, 'reset new epoch');
// Bank reference sensitivity: a 30%/20% contrast is not stable enough in the newer half.
test(gate({ ratio: 1.3, halfRatio: 1.09 }), 'unstable-evidence', 'large pooled effect, weak half');
test(gate({ ratio: 1.2, halfRatio: 1.15 }), 'no-effect', 'consistent but below meaningful effect');
const exactBoundaryDelta = 20 * Math.log(250) / 20 - 80 * Math.log(200) / 80;
test(gate({ ratio: Math.exp(exactBoundaryDelta) }), 'suggested', '250ms versus200ms aggregation boundary');
test(gate({ ratio: Math.exp(Math.log(1.25) - 1e-8) }), 'no-effect', 'meaningfully below ratio boundary');

// Uniform 200ms histories preserve numerical abstention across three accumulation orders.
const uniformDeltas = [];
for (const values of [Array(200).fill(Math.log(200)), Array(200).fill(Math.log(200)).reverse(),
  Array.from({ length: 200 }, () => Math.log(200)).sort(() => 0)]) {
  const target = values.slice(0, 20).reduce((a, b) => a + b, 0) / 20;
  const reference = values.slice(20).reduce((a, b) => a + b, 0) / 180;
  const delta = target - reference;
  uniformDeltas.push(delta);
  test(Math.abs(delta) <= 1e-10, true, 'uniform numeric abstention');
  test(gate({ ratio: Math.exp(delta), halfRatio: Math.exp(delta) }), 'no-effect', 'uniform gate');
}
// Nonuniform accumulation permutation checks use the same multiset for target/reference.
const same = Array.from({ length: 100 }, (_, i) => Math.log(100 + i));
for (const referenceOrder of [same, [...same].reverse(), [...same.slice(50), ...same.slice(0, 50)]]) {
  const delta = same.reduce((a, b) => a + b, 0) / 100 - referenceOrder.reduce((a, b) => a + b, 0) / 100;
  test(gate({ ratio: Math.exp(delta) }), 'no-effect', 'same-multiset order abstention');
}

// A finite prefix counterexample: full-prefix average can pass while an earlier position fails.
const illustrativeTargetEnds = [2, 50, 60, 70, 80];
const prefixPasses = n => illustrativeTargetEnds.filter(end => end <= n).length / n >= 1.25 * 0.03;
test(prefixPasses(80), true, 'aggregate prefix passes');
test(Array.from({ length: 61 }, (_, i) => i + 20).every(prefixPasses), false, 'all-prefix check rejects gap');

const sensitivity = [];
for (const support of [12, 20, 30]) for (const ratio of [1.15, 1.25, 1.35]) {
  sensitivity.push({ proposedSupport: support, proposedEffectRatio: ratio,
    syntheticAt20Intervals25Percent: 20 >= support && 1.25 >= ratio });
}
const receipt = {
  kind: 'legacy-independent-threshold-and-schema-smoke', checkedAt: new Date().toISOString(),
  node: process.version, checks, configId: sha256(config), schemaId: config.schemaId,
  policyId: config.policyId, uniformDeltas, sensitivity,
  limits: ['Not a production selector', 'Scalar thresholds do not prove connected qualification or sidecar authority',
    'Ridge states are labels here, not an application model-loading test', 'Threshold oracles do not prove storage/browser lifecycle',
    'No participant data, human yield, statistical confidence or learning benefit'],
};
writeFileSync(new URL('contract-check.json', import.meta.url), `${JSON.stringify(receipt, null, 2)}\n`);
console.log(`${checks} contract checks passed; config sha256:${receipt.configId}`);
