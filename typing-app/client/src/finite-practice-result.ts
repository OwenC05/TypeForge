import { MAX_ATTEMPTS, MAX_PROMPT_LENGTH, MAX_RESPONSE_LENGTH, MAX_SENTENCES, MAX_RESULT_BYTES } from './engine.ts';
import type { CertifiedPlan, FinitePracticeResult } from './coach-types.ts';
import { CONFIG_ID, validateCertifiedPlan } from './coach-plan.ts';

const RUN_FLAGS = ['interrupted', 'invalid-input'];
const SENTENCE_FLAGS = [...RUN_FLAGS, 'incorrect', 'edited', 'repeat', 'missing-timing', 'malformed-timing'];

export class FinitePracticeValidationError extends Error {
  constructor(field: string) {
    super(`Invalid finite practice result: ${field}.`);
    this.name = 'FinitePracticeValidationError';
  }
}
function check(condition: unknown, field: string): asserts condition {
  if (!condition) throw new FinitePracticeValidationError(field);
}
function record(value: unknown, field: string, fields?: readonly string[]): Record<string, unknown> {
  check(value !== null && typeof value === 'object' && !Array.isArray(value), field);
  check(Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null, field);
  const keys = Reflect.ownKeys(value);
  check(keys.every(key => typeof key === 'string' && Object.getOwnPropertyDescriptor(value, key)?.enumerable &&
    Object.hasOwn(Object.getOwnPropertyDescriptor(value, key)!, 'value')), field);
  if (fields) check(keys.length === fields.length && keys.every(key => fields.includes(key as string)), field);
  return value as Record<string, unknown>;
}
function number(value: unknown, field: string, max = Number.MAX_VALUE, min = 0): number {
  check(typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max, field);
  return value;
}
function count(value: unknown, field: string, max = MAX_ATTEMPTS): number {
  const result = number(value, field, max);
  check(Number.isSafeInteger(result), field);
  return result;
}
function flags(value: unknown, field: string, allowed: readonly string[]): string[] {
  const values = array(value, field, allowed.length);
  check(values.every(flag => typeof flag === 'string' && allowed.includes(flag)) && new Set(values).size === values.length, field);
  return values as string[];
}
function accuracy(value: unknown, field: string): void {
  if (value !== null) number(value, field, 100);
}
function array(value: unknown, field: string, max: number): unknown[] {
  check(Array.isArray(value) && value.length <= max && Object.keys(value).length === value.length &&
    Reflect.ownKeys(value).length === value.length + 1, field);
  return value;
}

/** Separate early-source trust boundary; the strict timed validator remains unchanged. */
export function validateFinitePracticeResult(value: unknown, suppliedPlan: CertifiedPlan): FinitePracticeResult {
  const plan = validateCertifiedPlan(suppliedPlan);
  const root = record(value, 'record', ['schemaId', 'id', 'owner', 'completedAt', 'mode', 'metricVersion',
    'termination', 'eligibleForProgress', 'settings', 'metrics', 'qualityFlags', 'sentences', 'chartSamples', 'plan']);
  check(root.schemaId === 'typeforge-finite-practice-result-v1' && root.owner === 'guest' &&
    root.mode === 'practice' && root.metricVersion === 1 && root.termination === 'plan-exhausted' &&
    root.eligibleForProgress === false, 'envelope');
  check(typeof root.id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(root.id), 'id');
  check(typeof root.completedAt === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(root.completedAt) &&
    Number.isFinite(Date.parse(root.completedAt)) && new Date(root.completedAt).toISOString() === root.completedAt, 'completedAt');
  const identity = record(root.plan, 'plan', ['configId', 'catalogueId', 'planHash', 'pair', 'sentenceCount']);
  check(identity.configId === CONFIG_ID && identity.catalogueId === plan.catalogueId && identity.planHash === plan.planHash &&
    identity.pair === plan.pair && identity.sentenceCount === plan.prompts.length, 'plan identity');
  const settings = record(root.settings, 'settings', ['inputMode', 'durationMs', 'language', 'qwerty', 'corpusVersion']);
  check(settings.inputMode === 'flow-v1' && settings.durationMs === 30000 && settings.language === 'en' &&
    settings.qwerty === true && settings.corpusVersion === '1', 'settings');
  const runFlags = flags(root.qualityFlags, 'qualityFlags', RUN_FLAGS);
  const metrics = record(root.metrics, 'metrics', ['elapsedMs', 'correctCharacters', 'attemptedCharacters',
    'correctAttempts', 'accuracy', 'deletedCharacters', 'wpm']);
  const elapsed = number(metrics.elapsedMs, 'elapsedMs', 30000);
  check(elapsed > 0 && elapsed < 30000, 'elapsedMs');
  const retained = count(metrics.correctCharacters, 'correctCharacters', plan.characterCount);
  const attempted = count(metrics.attemptedCharacters, 'attemptedCharacters');
  const correct = count(metrics.correctAttempts, 'correctAttempts', attempted);
  const deleted = count(metrics.deletedCharacters, 'deletedCharacters');
  number(metrics.wpm, 'wpm');
  check(metrics.wpm === retained * 12000 / elapsed, 'wpm formula');
  const expectedAccuracy = !runFlags.includes('invalid-input') && attempted > 0 ? correct / attempted * 100 : null;
  check(metrics.accuracy === expectedAccuracy, 'accuracy formula/diagnostics');
  const sentences = array(root.sentences, 'sentences', MAX_SENTENCES);
  check(sentences.length === plan.prompts.length, 'sentence count');
  let responseCharacters = 0, correctCharacters = 0, keyAttempts = 0, keyCorrect = 0;
  const observedRunFlags = new Set<string>();
  for (const [index, value] of sentences.entries()) {
    const path = `sentences[${index}]`;
    const raw = record(value, path);
    const sentence = record(value, path, ['promptId', 'promptText', 'response', 'submitted', 'eligible',
      'diagnosticsAvailable', 'qualityFlags', 'keys', 'pairs', ...(Object.hasOwn(raw, 'prediction') ? ['prediction'] : [])]);
    const prompt = plan.prompts[index]!;
    check(sentence.promptId === prompt.id && sentence.promptText === prompt.text && prompt.text.length <= MAX_PROMPT_LENGTH, `${path}.prompt`);
    check(typeof sentence.response === 'string' && sentence.response.length > 0 && sentence.response.length <= MAX_RESPONSE_LENGTH &&
      !sentence.response.endsWith(' ') && sentence.response.split(' ').filter(Boolean).length >= prompt.text.split(' ').filter(Boolean).length,
    `${path}.response`);
    responseCharacters += sentence.response.length;
    correctCharacters += [...sentence.response].reduce((sum, character, i) => sum + Number(character === prompt.text[i]), 0);
    const sentenceFlags = flags(sentence.qualityFlags, `${path}.qualityFlags`, SENTENCE_FLAGS);
    RUN_FLAGS.filter(flag => sentenceFlags.includes(flag)).forEach(flag => observedRunFlags.add(flag));
    check(sentence.submitted === true && sentence.eligible === (sentenceFlags.length === 0) &&
      sentence.diagnosticsAvailable === !sentenceFlags.includes('invalid-input') &&
      (sentence.response === prompt.text || sentenceFlags.includes('incorrect')), `${path}.semantics`);
    const keys = record(sentence.keys, `${path}.keys`);
    check(Object.keys(keys).length <= 27, `${path}.keys`);
    for (const [key, value] of Object.entries(keys)) {
      check(/^[a-z ]$/.test(key) && prompt.text.includes(key), `${path}.key`);
      const stats = record(value, `${path}.key`, ['attempts', 'correct', 'firstAttempts', 'firstErrors']);
      const attempts = count(stats.attempts, `${path}.attempts`);
      const matched = count(stats.correct, `${path}.correct`, attempts);
      const first = count(stats.firstAttempts, `${path}.firstAttempts`, Math.min(attempts, [...prompt.text].filter(char => char === key).length));
      count(stats.firstErrors, `${path}.firstErrors`, first);
      check(attempts > 0 && first > 0 && first - (stats.firstErrors as number) <= matched &&
        (stats.firstErrors as number) <= attempts - matched, `${path}.key consistency`);
      keyAttempts += attempts; keyCorrect += matched;
    }
    check(Object.hasOwn(keys, prompt.text[0]), `${path}.initial key`);
    if (sentence.eligible) {
      const expectedKeys = [...new Set(prompt.text)];
      check(Object.keys(keys).length === expectedKeys.length, `${path}.clean keys`);
      for (const key of expectedKeys) {
        const stats = record(keys[key], `${path}.clean key`);
        const occurrences = [...prompt.text].filter(char => char === key).length;
        check(stats.attempts === occurrences && stats.correct === occurrences &&
          stats.firstAttempts === occurrences && stats.firstErrors === 0, `${path}.clean key counts`);
      }
    }
    const pairs = record(sentence.pairs, `${path}.pairs`);
    check(Object.keys(pairs).length <= MAX_PROMPT_LENGTH - 1 && (sentence.eligible || Object.keys(pairs).length === 0), `${path}.pairs`);
    for (const [pair, value] of Object.entries(pairs)) {
      check(/^[a-z]{2}$/.test(pair), `${path}.pair`);
      const occurrences = [...prompt.text].reduce((sum, _, i) => sum + Number(prompt.text.slice(i, i + 2) === pair), 0);
      const stats = record(value, `${path}.pair`, ['count', 'logSum']);
      const observations = count(stats.count, `${path}.pair.count`, occurrences);
      check(observations > 0, `${path}.pair.count`);
      number(stats.logSum, `${path}.pair.logSum`, observations * Math.log(5000) + 1e-9,
        observations * Math.log(Number.MIN_VALUE) - 1e-9);
    }
    if (Object.hasOwn(sentence, 'prediction')) {
      const rawPrediction = record(sentence.prediction, `${path}.prediction`);
      const hasCandidate = Object.hasOwn(rawPrediction, 'candidate');
      const prediction = record(rawPrediction, `${path}.prediction`, ['featureVersion', 'baseline', 'pairs', ...(hasCandidate ? ['candidate'] : [])]);
      check(sentence.eligible && prediction.featureVersion === 1, `${path}.prediction eligibility`);
      const version = (value: unknown) => typeof value === 'string' && value.length > 0 && value.length <= 80;
      const baseline = record(prediction.baseline, 'prediction.baseline', ['kind', 'version']);
      check(['population', 'user', 'smoothed-pair'].includes(baseline.kind as string) && version(baseline.version), 'prediction.baseline');
      if (hasCandidate) {
        const candidate = record(prediction.candidate, 'prediction.candidate', ['modelVersion', 'status']);
        check(version(candidate.modelVersion) && candidate.status === 'experimental', 'prediction.candidate');
      }
      const predicted = record(prediction.pairs, 'prediction.pairs');
      check(Object.keys(predicted).length > 0 && Object.keys(predicted).length === Object.keys(pairs).length, 'prediction.pairs completeness');
      for (const [pair, value] of Object.entries(predicted)) {
        check(Object.hasOwn(pairs, pair), 'prediction.pair');
        const observed = pairs[pair] as { count: number; logSum: number };
        const stats = record(value, 'prediction.pair', ['count', 'observedLogSum', 'baselinePredictedLogSum', ...(hasCandidate ? ['candidatePredictedLogSum'] : [])]);
        check(stats.count === observed.count && stats.observedLogSum === observed.logSum, 'prediction.matched observations');
        for (const field of ['baselinePredictedLogSum', ...(hasCandidate ? ['candidatePredictedLogSum'] : [])]) {
          const sum = number(stats[field], `prediction.${field}`, Number.MAX_VALUE, -Number.MAX_VALUE);
          const milliseconds = Math.exp(sum / observed.count);
          check(Number.isFinite(milliseconds) && milliseconds > 0, `prediction.${field} representability`);
        }
      }
    }
  }
  check(correctCharacters === retained && responseCharacters + deleted === attempted && keyAttempts <= attempted && keyCorrect === correct,
    'aggregate counts');
  check(runFlags.length === observedRunFlags.size && runFlags.every(flag => observedRunFlags.has(flag)), 'run/sentence flags');
  const chart = array(root.chartSamples, 'chartSamples', Math.ceil(elapsed / 1000));
  check(chart.length > 0, 'chartSamples');
  let previousTime = 0;
  let lostDiagnostics = false;
  for (const [index, value] of chart.entries()) {
    const sample = record(value, 'chart sample', ['elapsedMs', 'wpm', 'accuracy']);
    const time = number(sample.elapsedMs, 'chart time', elapsed);
    check(time > previousTime && (index === chart.length - 1 || time - previousTime >= 1000), 'chart order');
    number(sample.wpm, 'chart wpm'); accuracy(sample.accuracy, 'chart accuracy');
    check(sample.accuracy !== null || runFlags.includes('invalid-input'), 'chart diagnostics');
    check(!lostDiagnostics || sample.accuracy === null, 'chart diagnostics cannot recover');
    lostDiagnostics ||= sample.accuracy === null;
    // A prior observation cannot contain more retained characters than the bounded attempt domain.
    check((sample.wpm as number) <= MAX_ATTEMPTS * 12000 / time, 'chart wpm bound');
    previousTime = time;
  }
  const last = chart.at(-1) as Record<string, unknown>;
  check(last.elapsedMs === elapsed && last.wpm === metrics.wpm && last.accuracy === metrics.accuracy, 'chart final metrics');
  check(new TextEncoder().encode(JSON.stringify(value)).length <= MAX_RESULT_BYTES, 'record exceeds 1 MiB');
  return structuredClone(value) as FinitePracticeResult;
}
