import { assessmentPrompts, practicePrompts } from './corpus.ts';
import { validateResult } from './storage.ts';
import { CONFIG_ID, COACH_CONFIG, canonicalJson, hashCanonical, deepFreeze,
  pairOccurrences, resolveCertifiedPlan, validateCoachConfig, validateCertifiedPlan } from './coach-plan.ts';
import type { SentenceSummary } from './engine.ts';
import type { Admission, AdmissionInput, Authority, Capture, Coach, Contrast, Focus, Membership,
  Metadata, Participation, PracticeSnapshot, PreparedProjection, ProjectionInput, RangeEnd,
  RangeProof, Reason, SourceRead, SourceRef, Summary, VerifiedProof } from './coach-types.ts';

const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const sourceOrder = (a: SourceRef, b: SourceRef) => compare(a.completedAt, b.completedAt) || compare(a.id, b.id);
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const HASH = /^[0-9a-f]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STOPS = ['row-budget','byte-budget','record-limit','aborted','failure','authority-changed','proof-unavailable'];
function requireValue(ok: unknown, field: string): asserts ok {
  if (!ok) throw new Error(`Invalid coach ${field}`);
}
function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  requireValue(value !== null && typeof value === 'object' && !Array.isArray(value), 'object');
  requireValue(Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null, 'object');
  const names = Object.keys(value);
  requireValue(names.length === keys.length && names.every(k => keys.includes(k)), 'fields');
  return value as Record<string, unknown>;
}
const opaque = (v: unknown) => typeof v === 'string' && v.length > 0 && v.length <= 128;
export const validUTC = (v: unknown): v is string => typeof v === 'string' &&
  /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d:[0-5]\d\.\d{3}Z$/.test(v) &&
  Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v;

export function validateMetadata(value: unknown): Metadata {
  const m = object(value, ['schemaId','databaseId','defaultContextId','activeEpochId','legacyEpochId','legacyCutoffCompletedAt','sourceRevision']);
  requireValue(m.schemaId === 'typeforge-coach-metadata-v3' && opaque(m.databaseId) && opaque(m.defaultContextId) &&
    opaque(m.activeEpochId) && opaque(m.legacyEpochId) && validUTC(m.legacyCutoffCompletedAt) &&
    Number.isSafeInteger(m.sourceRevision) && (m.sourceRevision as number) >= 0, 'metadata');
  // MAX is structurally readable; semantic authority below rejects the terminal sentinel.
  return value as Metadata;
}
function validateCapture(value: unknown): asserts value is Capture {
  const c = object(value, ['databaseId','contextId','epochId','capturedAt','purpose']);
  requireValue(opaque(c.databaseId) && opaque(c.contextId) && opaque(c.epochId) && validUTC(c.capturedAt) &&
    (c.purpose === 'ordinary' || c.purpose === 'protected-probe'), 'capture');
}
function captureOf(m: Membership): Capture {
  return { databaseId: m.databaseId, contextId: m.contextId, epochId: m.epochId, capturedAt: m.capturedAt, purpose: m.purpose };
}
function validateRef(value: unknown): asserts value is SourceRef {
  const r = object(value, ['partition','kind','id','sha256','completedAt']);
  requireValue((r.partition === 'legacy' || r.partition === 'current') &&
    (r.kind === 'timed-v1' || r.kind === 'finite-practice-v1') && typeof r.id === 'string' && UUID.test(r.id) &&
    typeof r.sha256 === 'string' && HASH.test(r.sha256) && validUTC(r.completedAt), 'source reference');
}
export function validateMembership(value: unknown, source: SourceRef, capture: Capture): Membership {
  validateRef(source); validateCapture(capture);
  const m = object(value, ['schemaId','databaseId','contextId','epochId','capturedAt','purpose','sourceKind','resultId','resultSha256']);
  requireValue(m.schemaId === 'typeforge-coach-membership-v2' && source.partition === 'current' &&
    m.sourceKind === source.kind && m.resultId === source.id && m.resultSha256 === source.sha256 &&
    same({ databaseId: m.databaseId, contextId: m.contextId, epochId: m.epochId,
      capturedAt: m.capturedAt, purpose: m.purpose }, capture), 'membership binding');
  return value as Membership;
}
function validAuthority(value: unknown): value is Authority {
  try {
    const a = object(value, ['databaseId','contextId','epochId','revision']);
    return opaque(a.databaseId) && opaque(a.contextId) && opaque(a.epochId) &&
      Number.isSafeInteger(a.revision) && (a.revision as number) >= 0 && (a.revision as number) < Number.MAX_SAFE_INTEGER;
  } catch { return false; }
}
function metadataAuthority(m: Metadata): Authority {
  return { databaseId: m.databaseId, contextId: m.defaultContextId, epochId: m.activeEpochId, revision: m.sourceRevision };
}
function rangeShape<K extends keyof RangeEnd>(range: RangeProof<K>, kind: K, authority: Authority): void {
  if (range.complete === false) {
    object(range, ['complete','stop']); requireValue(STOPS.includes(range.stop), 'incomplete range'); return;
  }
  object(range, ['complete','stop','orderedSourceIds','authority']);
  const ends = { participation: ['exhausted','ten-witnesses'], summary: ['exhausted','tenth-assessment'],
    coach: ['exhausted','twentieth-run','older-than-cutoff'] };
  requireValue(range.complete === true && ends[kind].includes(range.stop) && Array.isArray(range.orderedSourceIds) &&
    range.orderedSourceIds.every(id => typeof id === 'string' && UUID.test(id)) &&
    new Set(range.orderedSourceIds).size === range.orderedSourceIds.length && validAuthority(range.authority) &&
    same(range.authority, authority), 'range authority');
}

/** C alone creates this object after real storage completion. These checks bind its inputs,
 * not its provenance: a matching shape or scalar cannot establish a transaction. */
function checkProof(input: ProjectionInput, proof: VerifiedProof): void {
  object(proof, ['authority','admittedAt','configId','method','selection']);
  requireValue(validAuthority(proof.authority) && same(proof.authority, input.authority) &&
    proof.configId === CONFIG_ID && validUTC(proof.admittedAt) &&
    ['all-writer-revision','coherent-range-and-sources'].includes(proof.method), 'final proof');
  rangeShape(input.participationRange, 'participation', input.authority);
  rangeShape(input.summaryRange, 'summary', input.authority);
  if (input.coachRange !== null) rangeShape(input.coachRange, 'coach', input.authority);
  const selection = { metadata: input.metadata, now: input.now,
    sourceBindings: input.sources.map(({ ref, membership }) => ({ ref, membership })),
    participationRange: input.participationRange, summaryRange: input.summaryRange, coachRange: input.coachRange };
  requireValue(same(proof.selection, selection), 'proof selection');
}

function sourceSet(input: ProjectionInput): SourceRead[] {
  const ids = new Map<string, SourceRead>();
  for (const read of input.sources) {
    object(read, ['ref','source','membership']); validateRef(read.ref);
    const r = read.source;
    requireValue(r && r.id === read.ref.id && r.completedAt === read.ref.completedAt &&
      ('schemaId' in r ? read.ref.kind === 'finite-practice-v1' && r.schemaId === 'typeforge-finite-practice-result-v1'
        : read.ref.kind === 'timed-v1') && hashCanonical(r) === read.ref.sha256, 'source binding');
    if (read.ref.partition === 'legacy') requireValue(read.ref.kind === 'timed-v1' && read.membership === null, 'legacy origin');
    else if (read.membership !== null) validateMembership(read.membership, read.ref, captureOf(read.membership));
    const previous = ids.get(read.ref.id);
    requireValue(!previous || same(previous, read), 'source ID conflict');
    ids.set(read.ref.id, read);
  }
  return [...ids.values()].sort((a,b) => sourceOrder(b.ref, a.ref));
}

/** Provisional classification for bounded scanning, not persistence or current authority.
 * C must acquire/validate sources, references, metadata and membership on its bounded path;
 * final projection still checks the entire bound selection after C's actual final proof.
 * This predicate cannot authorize a count, median, candidate or practice admission. */
export function qualifiesPolicySource(
  read: SourceRead,
  input: Pick<ProjectionInput, 'metadata' | 'now'>,
  assessmentsOnly = false,
): boolean {
  if (read.ref.kind !== 'timed-v1') return false;
  const r = read.source;
  try { validateResult(r); } catch { return false; }
  if (r.completedAt > input.now || r.schemaVersion !== 1 || r.metricVersion !== 1 ||
    !r.eligibleForProgress || r.qualityFlags.length || r.metrics.elapsedMs !== COACH_CONFIG.context.durationMs ||
    r.metrics.attemptedCharacters < COACH_CONFIG.baseline.minimumAttempts || r.settings.inputMode !== 'flow-v1' ||
    r.settings.durationMs !== 30000 || r.settings.language !== 'en' || r.settings.qwerty !== true ||
    r.settings.corpusVersion !== '1' || (assessmentsOnly && r.mode !== 'assessment')) return false;
  const m = input.metadata;
  if (read.ref.partition === 'legacy') return m.activeEpochId === m.legacyEpochId && read.ref.completedAt <= m.legacyCutoffCompletedAt;
  const member = read.membership;
  return member !== null && member.databaseId === m.databaseId && member.contextId === m.defaultContextId &&
    member.epochId === m.activeEpochId && member.purpose === 'ordinary';
}

function rangeRows<K extends keyof RangeEnd>(range: RangeProof<K>, rows: SourceRead[], kind: K): SourceRead[] | null {
  if (!range.complete) return null;
  const byId = new Map(rows.map(r => [r.ref.id, r]));
  const selected = range.orderedSourceIds.map(id => byId.get(id));
  requireValue(selected.every(Boolean), 'range source existence');
  const result = selected as SourceRead[];
  requireValue(result.every((r,i) => i === 0 || sourceOrder(result[i-1].ref, r.ref) > 0), 'range order');
  // Ten coherent witnesses can prove the cap without proving newest ordering.
  if (!(kind === 'participation' && range.stop === 'ten-witnesses')) {
    requireValue(result.every((r,i) => rows[i]?.ref.id === r.ref.id), 'range newest prefix');
    if (range.stop === 'exhausted') requireValue(result.length === rows.length, 'exhausted range');
  }
  return result;
}

function pendingCount(input: ProjectionInput, saved: readonly SourceRead[]): number {
  const ids = new Set<string>(), durable = new Set(saved.map(r => r.ref.id));
  for (const pending of input.pendingSources) {
    if (pending.retryable !== true || pending.durablySaved !== false ||
      (pending.state !== 'pending' && pending.state !== 'failed') || !pending.capture) continue;
    try {
      validateCapture(pending.capture); validateResult(pending.source);
      const c = pending.capture, m = input.metadata, r = pending.source;
      if (r.mode !== 'assessment' || durable.has(r.id) || c.purpose !== 'ordinary' ||
        c.databaseId !== m.databaseId || c.contextId !== m.defaultContextId || c.epochId !== m.activeEpochId) continue;
      const ref: SourceRef = { partition: 'current', kind: 'timed-v1', id: r.id,
        completedAt: r.completedAt, sha256: hashCanonical(r) };
      const membership: Membership = { ...c, schemaId: 'typeforge-coach-membership-v2', sourceKind: 'timed-v1', resultId: r.id, resultSha256: ref.sha256 };
      if (qualifiesPolicySource({ ref, source: r, membership }, input, true)) ids.add(r.id);
    } catch { /* Invalid/uncaptured sources are recoverable, never a projected baseline test. */ }
  }
  return ids.size;
}

interface Retained { read: SourceRead; sentence: SentenceSummary; ordinal: number }
function compensated(xs: readonly number[]): number {
  let sum = 0, correction = 0;
  for (const x of xs) { const y = x - correction, next = sum + y; correction = (next - sum) - y; sum = next; }
  return sum;
}
function safeCount(xs: readonly number[]): number {
  const count = xs.reduce((a,b) => a+b, 0);
  requireValue(xs.every(x => Number.isSafeInteger(x) && x >= 0) && Number.isSafeInteger(count), 'aggregate count');
  return count;
}
const bankFor = (r: SourceRead) => r.source.mode === 'assessment' ? assessmentPrompts : practicePrompts;
function admissibleSentence(read: SourceRead, s: SentenceSummary): boolean {
  const prompt = bankFor(read).find(p => p.id === s.promptId);
  if (!prompt || prompt.text !== s.promptText || !s.eligible || !s.submitted || !s.diagnosticsAvailable ||
    s.response !== prompt.text || s.qualityFlags.length) return false;
  const keys = new Map<string, number>();
  for (const char of prompt.text) keys.set(char, (keys.get(char) ?? 0) + 1);
  if (Object.keys(s.keys).length !== keys.size || [...keys].some(([key,n]) => {
    const k = s.keys[key]; return !k || k.attempts !== n || k.correct !== n || k.firstAttempts !== n || k.firstErrors !== 0;
  })) return false;
  const all = pairOccurrences(prompt.text), minLog = Math.log(Number.MIN_VALUE), maxLog = Math.log(5000);
  for (const [pair, p] of Object.entries(s.pairs)) {
    if (!Number.isSafeInteger(p.count) || p.count < 1 || p.count > all.filter(o => o.pair === pair).length) return false;
    const tolerance = 64 * Number.EPSILON * p.count * Math.max(Math.abs(minLog), Math.abs(maxLog));
    if (!Number.isFinite(p.logSum) || p.logSum < p.count * minLog - tolerance || p.logSum > p.count * maxLog + tolerance) return false;
  }
  const observations = safeCount(Object.values(s.pairs).map(p => p.count));
  return observations <= all.length && observations <= prompt.text.length - 1;
}
function retained(window: readonly SourceRead[]): Retained[] {
  const latest = new Map<string, Retained>(), badRuns = new Set<string>();
  // Chronological insertion makes the greatest ordinal win before semantic exclusion.
  for (const read of [...window].reverse()) {
    const sentences = read.source.sentences;
    const keyAttempts = safeCount(sentences.flatMap(s => Object.values(s.keys).map(k => k.attempts)));
    const keyCorrect = safeCount(sentences.flatMap(s => Object.values(s.keys).map(k => k.correct)));
    const admittedObservations = safeCount(sentences.filter(s => admissibleSentence(read,s))
      .flatMap(s => Object.values(s.pairs).map(p => p.count)));
    if (keyAttempts > read.source.metrics.attemptedCharacters || keyCorrect > read.source.metrics.correctAttempts ||
      admittedObservations > read.source.metrics.attemptedCharacters || admittedObservations > read.source.metrics.correctAttempts)
      badRuns.add(read.ref.id);
    // No elapsed-time envelope: keydown intervals and first-input timer have distinct origins.
    sentences.forEach((sentence, ordinal) => {
      if (sentence.eligible && sentence.submitted) latest.set(bankFor(read).find(p => p.id === sentence.promptId)?.text ?? sentence.promptText,
        { read, sentence, ordinal });
    });
  }
  return [...latest.values()].filter(r => !badRuns.has(r.read.ref.id) && admissibleSentence(r.read,r.sentence))
    .sort((a,b) => sourceOrder(a.read.ref,b.read.ref) || compare(a.sentence.promptId,b.sentence.promptId) || a.ordinal-b.ordinal);
}
interface Statistics extends Contrast { promptContexts: number; wordContexts: number; delta: number }
function statistics(rows: readonly Retained[], pair: string): Statistics {
  const targetCounts: number[] = [], referenceCounts: number[] = [], targetLogs: number[] = [], referenceLogs: number[] = [];
  const runs = new Set<string>(), prompts = new Set<string>(), words = new Set<string>();
  for (const r of rows) {
    for (const [p,x] of Object.entries(r.sentence.pairs).sort(([a],[b]) => compare(a,b))) {
      if (p === pair) {
        targetCounts.push(x.count); targetLogs.push(x.logSum); runs.add(r.read.ref.id); prompts.add(r.sentence.promptText);
        pairOccurrences(r.sentence.promptText,pair).forEach(o => words.add(o.word));
      } else { referenceCounts.push(x.count); referenceLogs.push(x.logSum); }
    }
  }
  const targetCount = safeCount(targetCounts), referenceCount = safeCount(referenceCounts);
  const targetLogSum = compensated(targetLogs), referenceLogSum = compensated(referenceLogs);
  const delta = targetCount && referenceCount ? targetLogSum / targetCount - referenceLogSum / referenceCount : NaN;
  return { targetCount, referenceCount, targetLogSum, referenceLogSum, sourceRuns: runs.size,
    promptContexts: prompts.size, wordContexts: words.size, delta };
}
const contrast = (s: Statistics): Contrast => ({ targetCount: s.targetCount, referenceCount: s.referenceCount,
  targetLogSum: s.targetLogSum, referenceLogSum: s.referenceLogSum, sourceRuns: s.sourceRuns });
function chooseFocus(window: SourceRead[]): { focus: Focus; plan: NonNullable<ReturnType<typeof resolveCertifiedPlan>> } | Reason {
  if (!window.length) return 'stale-evidence';
  const rows = retained(window);
  const pairs = [...new Set(rows.flatMap(r => Object.keys(r.sentence.pairs)))].sort(compare);
  const c = COACH_CONFIG, eps = c.effect.numericNoEffectLogTolerance;
  const reasons: Reason[] = ['too-few-observations-for-any-pair','insufficient-context-diversity','unstable-evidence',
    'no-effect','unstable-evidence','corpus-coverage','exposure-unsupported'];
  let furthest = 0;
  const passing: { focus: Focus; plan: NonNullable<ReturnType<typeof resolveCertifiedPlan>>; delta: number }[] = [];
  for (const pair of pairs) {
    const accepted = rows.filter(r => {
      const total = pairOccurrences(r.sentence.promptText,pair).length;
      return (!total || r.sentence.pairs[pair]?.count === total) && Object.keys(r.sentence.pairs).length > 0;
    });
    const full = statistics(accepted,pair);
    if (full.targetCount < c.support.targetIntervals || full.referenceCount < c.support.referenceIntervals || full.sourceRuns < c.support.targetRuns) continue;
    furthest = Math.max(furthest,1);
    if (full.promptContexts < c.support.targetPrompts || full.wordContexts < c.support.targetWords) continue;
    furthest = Math.max(furthest,2);
    const contributing = [...new Set(accepted.map(r => r.read.ref.id))].sort((a,b) =>
      sourceOrder(accepted.find(r => r.read.ref.id === a)!.read.ref, accepted.find(r => r.read.ref.id === b)!.read.ref));
    const older = new Set(contributing.slice(0,Math.floor(contributing.length/2)));
    const halves = [statistics(accepted.filter(r => older.has(r.read.ref.id)),pair),
      statistics(accepted.filter(r => !older.has(r.read.ref.id)),pair)] as const;
    const composes = (key: 'targetLogSum' | 'referenceLogSum') => {
      const terms = accepted.reduce((n,r) => n + Object.keys(r.sentence.pairs).length,0);
      const bound = 64 * Number.EPSILON * terms * Math.max(1,Math.abs(full[key]),Math.abs(halves[0][key])+Math.abs(halves[1][key]));
      return Number.isFinite(full[key]) && Number.isFinite(halves[0][key]) && Number.isFinite(halves[1][key]) &&
        Math.abs(full[key]-(halves[0][key]+halves[1][key])) <= bound;
    };
    if (halves[0].targetCount+halves[1].targetCount !== full.targetCount ||
      halves[0].referenceCount+halves[1].referenceCount !== full.referenceCount ||
      !composes('targetLogSum') || !composes('referenceLogSum')) continue;
    if (halves.some(h => h.targetCount < c.stability.targetIntervalsPerHalf || h.referenceCount < c.stability.referenceIntervalsPerHalf ||
      h.sourceRuns < c.stability.targetRunsPerHalf)) continue;
    furthest = Math.max(furthest,3);
    if (!Number.isFinite(full.delta) || Math.abs(full.delta) <= eps || full.delta + eps < Math.log(c.effect.minimumRatio)) continue;
    furthest = Math.max(furthest,4);
    if (halves.some(h => !Number.isFinite(h.delta) || h.delta + eps < Math.log(c.stability.minimumRatioPerHalf))) continue;
    furthest = Math.max(furthest,5);
    const bank = practicePrompts.filter(p => pairOccurrences(p.text,pair).length);
    if (bank.length < c.exposure.minimumBankPassages ||
      new Set(bank.flatMap(p => pairOccurrences(p.text,pair).map(o => o.word))).size < c.exposure.minimumWords) continue;
    furthest = Math.max(furthest,6);
    const plan = resolveCertifiedPlan(pair);
    if (!plan) continue;
    const focus: Focus = { ...contrast(full), pair, promptContexts: full.promptContexts, wordContexts: full.wordContexts,
      halves: [contrast(halves[0]),contrast(halves[1])], certificateId: plan.certificateId };
    passing.push({ focus, plan, delta: full.delta });
  }
  passing.sort((a,b) => b.delta-a.delta || compare(a.focus.pair,b.focus.pair));
  return passing[0] ?? reasons[furthest];
}

const issuedSnapshots = new WeakSet<PracticeSnapshot>();
function projection(input: ProjectionInput, participation: Participation, summary: Summary, coach: Coach,
  pendingSave: number, baselineProofComplete = false, summarySelectionProofComplete = false): PreparedProjection {
  deepFreeze(participation); deepFreeze(summary); deepFreeze(coach);
  return { status: { automaticCoaching: 'enabled', baselineProofComplete, summarySelectionProofComplete,
    evidenceScanComplete: coach.evidenceScanComplete, pendingSave, pendingSources: input.pendingSources,
    participation, summary, coach, persistence: input.persistence, otherContextCount: null, work: input.work },
    candidate: coach.state === 'complete-ready' ? coach.snapshot : null };
}
function unavailable(input: ProjectionInput, reason: Reason): PreparedProjection {
  const result = projection(input, { state: 'unavailable', reason, counted: null, ordinal: null, proof: null },
    { state: 'unavailable', reason, value: null }, { state: 'unavailable', reason,
      evidenceScanComplete: input.coachRange === null ? null : false, snapshot: null }, 0);
  if (reason === 'policy-invalid') result.status.automaticCoaching = 'unavailable';
  return result;
}

export function derivePolicy(input: ProjectionInput): PreparedProjection {
  try { validateCoachConfig(input.config); requireValue(input.configId === CONFIG_ID, 'config ID'); }
  catch { return unavailable(input,'policy-invalid'); }
  try {
    validateMetadata(input.metadata);
    requireValue(validAuthority(input.authority) && same(input.authority,metadataAuthority(input.metadata)) && validUTC(input.now) &&
      Number.isSafeInteger(input.generation) && input.generation >= 0, 'context');
  } catch { return unavailable(input,'context-unavailable'); }
  let rows: SourceRead[], pendingSave: number;
  try { rows = sourceSet(input); pendingSave = pendingCount(input,rows); }
  catch { return unavailable(input,'source-integrity'); }
  const proof = input.finalProof;
  if (proof === null) return projection(input,
    { state: 'pending', reason: 'scan-incomplete', counted: 0, ordinal: null, proof: null },
    { state: 'pending', reason: 'scan-incomplete', value: null }, input.coachRange === null
      ? { state: 'not-requested', reason: 'coaching-deferred', evidenceScanComplete: null, snapshot: null }
      : { state: 'pending', reason: 'scan-incomplete', evidenceScanComplete: false, snapshot: null }, pendingSave);
  if (proof.configId !== CONFIG_ID) return unavailable(input,'policy-invalid');
  try { checkProof(input,proof); }
  catch { return unavailable(input,'source-integrity'); }
  try {
    const participationRows = rangeRows(input.participationRange,rows,'participation');
    const summaryRows = rangeRows(input.summaryRange,rows,'summary');
    const coachRows = input.coachRange === null ? null : rangeRows(input.coachRange,rows,'coach');
    const assessments = (participationRows ?? rows).filter(r => qualifiesPolicySource(r,input,true)).slice(0,c.baseline.tests);
    const baselineComplete = assessments.length === c.baseline.tests || input.participationRange.complete;
    requireValue(!input.participationRange.complete || input.participationRange.stop !== 'ten-witnesses' || assessments.length === 10, 'ten witnesses');
    const count = assessments.length;
    const participation: Participation = count === 10 ? { state: 'complete', reason: 'supported', counted: 10,
      ordinal: null, witnesses: assessments.map(r => r.ref), proof } : baselineComplete
      ? { state: count === 0 ? 'not-started' : 'in-progress', reason: 'baseline-incomplete', counted: count,
          ordinal: count + pendingSave < 10 ? count + pendingSave + 1 : null, witnesses: assessments.map(r => r.ref), proof }
      : { state: 'pending', reason: 'scan-incomplete', counted: count, ordinal: null, proof: null };
    const newest = summaryRows?.filter(r => qualifiesPolicySource(r,input,true)).slice(0,10);
    requireValue(!input.summaryRange.complete || input.summaryRange.stop !== 'tenth-assessment' || newest?.length === 10, 'summary boundary');
    const median = (xs: number[]) => { xs.sort((a,b) => a-b); return (xs[4]+xs[5])/2; };
    let summary: Summary = { state: 'pending', reason: 'scan-incomplete', value: null };
    if (newest) {
      summary = { state: 'not-complete', reason: 'baseline-incomplete', value: null };
      if (newest.length === 10) {
        const accuracies = newest.map(r => r.source.metrics.accuracy).filter((a): a is number => a !== null && Number.isFinite(a) && a >= 0 && a <= 100);
        summary = { state: 'available', selection: 'newest-ten-qualifying-assessments-v1', proof, value: {
          medianWpm: median(newest.map(r => r.source.metrics.wpm)), medianAccuracy: accuracies.length === 10 ? median(accuracies) : null,
          validAccuracySources: accuracies.length, sources: newest.map(r => r.ref),
          timeRange: { from: newest[9].ref.completedAt, to: newest[0].ref.completedAt } } };
      }
    }
    let coach: Coach;
    if (participation.state !== 'complete') coach = baselineComplete
      ? { state: 'not-ready', reason: 'baseline-incomplete', evidenceScanComplete: null, snapshot: null }
      : input.coachRange === null ? { state: 'not-requested', reason: 'coaching-deferred', evidenceScanComplete: null, snapshot: null }
        : { state: 'pending', reason: 'scan-incomplete', evidenceScanComplete: false, snapshot: null };
    else if (input.coachRange === null) coach = { state: 'not-requested', reason: 'coaching-deferred', evidenceScanComplete: null, snapshot: null };
    else if (!coachRows) coach = { state: 'pending', reason: 'scan-incomplete', evidenceScanComplete: false, snapshot: null };
    else {
      const cutoff = Date.parse(input.now)-c.window.ageMs;
      const window = coachRows.filter(r => qualifiesPolicySource(r,input) && Date.parse(r.ref.completedAt) >= cutoff).slice(0,20);
      requireValue(input.coachRange.stop !== 'twentieth-run' || window.length === 20, 'coach boundary');
      requireValue(input.coachRange.stop !== 'older-than-cutoff' || coachRows.some(r => Date.parse(r.ref.completedAt) < cutoff), 'coach cutoff');
      const decision = chooseFocus(window);
      if (typeof decision === 'string') coach = { state: 'complete-insufficient', reason: decision,
        evidenceScanComplete: true, snapshot: null, sources: window.map(r => r.ref), proof };
      else {
        const snapshot: PracticeSnapshot = { schemaId: 'typeforge-practice-snapshot-v2', policyId: 'clean-pair-contrast-v1-r2-enabled',
          configId: CONFIG_ID, now: input.now, generation: input.generation,
          capture: { databaseId: input.authority.databaseId, contextId: input.authority.contextId,
            epochId: input.authority.epochId, capturedAt: input.now, purpose: 'ordinary' }, proof,
          witnesses: assessments.map(r => ({ ...r.ref })), sources: window.map(r => ({ ...r.ref })),
          focus: decision.focus, plan: decision.plan, actualExposure: null };
        deepFreeze(snapshot); issuedSnapshots.add(snapshot);
        coach = { state: 'complete-ready', reason: 'supported', evidenceScanComplete: true, snapshot };
      }
    }
    // Counted participation and newest summary are independent; neither borrows the other's range.
    return projection(input,participation,summary,coach,pendingSave,baselineComplete,summaryRows !== null);
  } catch { return unavailable(input,'source-integrity'); }
}
const c = COACH_CONFIG;

export function admitPractice(input: AdmissionInput): Admission {
  if (input.runState !== 'idle') return { admitted: false, reason: 'started' };
  const candidate = input.candidate;
  // Only the immutable snapshot returned by this selector is an admission candidate.
  // This continuity guard cannot authenticate C's transaction; C owns that proof.
  if (!issuedSnapshots.has(candidate)) return { admitted: false, reason: 'scan-incomplete' };
  if (input.currentConfigId !== CONFIG_ID || candidate.configId !== CONFIG_ID) return { admitted: false, reason: 'policy-invalid' };
  if (!validAuthority(input.currentAuthority) || !same(input.currentAuthority,candidate.proof.authority) ||
    input.currentGeneration !== candidate.generation) return { admitted: false, reason: 'authority-changed' };
  if (input.proof !== candidate.proof) return { admitted: false, reason: 'scan-incomplete' };
  try {
    validateCoachConfig(COACH_CONFIG); validateCertifiedPlan(candidate.plan);
    requireValue(candidate.focus.certificateId === candidate.plan.certificateId && candidate.focus.pair === candidate.plan.pair &&
      validUTC(input.proof.admittedAt) && same(metadataAuthority(validateMetadata(input.proof.selection.metadata)),input.currentAuthority), 'admission');
    return { admitted: true, snapshot: candidate };
  } catch { return { admitted: false, reason: 'policy-invalid' }; }
}
