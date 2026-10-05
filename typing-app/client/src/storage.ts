import {
  DURATION_MS,
  SUPPORTED_DURATIONS,
  type DurationMs,
  MAX_ATTEMPTS,
  MAX_PROMPT_LENGTH,
  MAX_RESPONSE_LENGTH,
  MAX_SENTENCES,
  MAX_RESULT_BYTES,
  type SessionResult,
} from './engine.ts';

const DATABASE = 'typeforge';
const STORE = 'results';
const ORDER_INDEX = 'completedAt-id';
const MAX_CHARACTERS = MAX_SENTENCES * MAX_PROMPT_LENGTH;
const RUN_FLAGS = ['interrupted', 'invalid-input'];
const SENTENCE_FLAGS = [
  'incorrect', 'edited', 'repeat', 'missing-timing', 'malformed-timing',
  'interrupted', 'invalid-input', 'unsupported-layout', 'unfinished',
];

export class ResultValidationError extends Error {
  constructor(field: string) {
    super(`Invalid saved result: ${field}.`);
    this.name = 'ResultValidationError';
  }
}

function check(condition: unknown, field: string): asserts condition {
  if (!condition) throw new ResultValidationError(field);
}

function record(value: unknown, field: string, fields?: string[]): Record<string, unknown> {
  check(value !== null && typeof value === 'object' && !Array.isArray(value), field);
  check(Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null, field);
  if (fields) {
    const keys = Object.keys(value);
    check(keys.length === fields.length && keys.every((key) => fields.includes(key)), field);
  }
  return value as Record<string, unknown>;
}

function number(value: unknown, field: string, max: number, min = 0): number {
  check(typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max, field);
  return value;
}

function count(value: unknown, field: string, max = MAX_ATTEMPTS): number {
  const result = number(value, field, max);
  check(Number.isInteger(result), field);
  return result;
}

function string(value: unknown, field: string, max: number, min = 1): string {
  check(typeof value === 'string' && value.length >= min && value.length <= max, field);
  return value;
}

function flags(value: unknown, field: string, allowed: string[]): void {
  check(Array.isArray(value) && value.length <= allowed.length, field);
  check(value.every((flag) => typeof flag === 'string' && allowed.includes(flag)), field);
  check(new Set(value).size === value.length, field);
}

function accuracy(value: unknown, field: string): void {
  if (value !== null) number(value, field, 100);
}

function resultId(value: unknown): void {
  check(typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value), 'id');
}

/** Reject unsupported or corrupt records before they reach a view or profile. */
export function validateResult(value: unknown): asserts value is SessionResult {
  const root = record(value, 'record');
  const result = record(value, 'record', [
    'id', 'owner', 'schemaVersion', 'metricVersion', 'completedAt', 'mode',
    'settings', 'qualityFlags', 'eligibleForProgress', 'metrics', 'sentences', 'chartSamples',
    ...['practiceFocus', 'manualDrill', 'sourceAssessmentId'].filter(key => Object.hasOwn(root, key)),
  ]);
  resultId(result.id);
  if (Object.hasOwn(result, 'sourceAssessmentId')) {
    resultId(result.sourceAssessmentId);
    check((result.sourceAssessmentId as string).toLowerCase() !== (result.id as string).toLowerCase(), 'sourceAssessmentId self-reference');
  }
  if (Object.hasOwn(result, 'practiceFocus')) {
    const focus = record(result.practiceFocus, 'practiceFocus', ['pair', 'evidenceCount', 'source', 'baselineVersion', 'score']);
    check(result.mode === 'practice' && typeof focus.pair === 'string' && /^[a-z]{2}$/.test(focus.pair), 'practiceFocus');
    check(count(focus.evidenceCount, 'practiceFocus.evidenceCount', MAX_SENTENCES * MAX_PROMPT_LENGTH) >= 8, 'practiceFocus.evidenceCount');
    check(focus.source === 'baseline', 'practiceFocus.source');
    string(focus.baselineVersion, 'practiceFocus.baselineVersion', 80);
    check(number(focus.score, 'practiceFocus.score', Number.MAX_VALUE) > 0, 'practiceFocus.score');
  }
  if (Object.hasOwn(result, 'manualDrill')) {
    const manual = record(result.manualDrill, 'manualDrill', ['pair', 'source']);
    check(result.mode === 'practice' && !Object.hasOwn(result, 'practiceFocus') &&
      typeof manual.pair === 'string' && /^[a-z]{2}$/.test(manual.pair) && manual.source === 'manual', 'manualDrill');
  }
  check(result.owner === 'guest', 'owner');
  check(result.schemaVersion === 1 && result.metricVersion === 1, 'version');
  const completedAt = string(result.completedAt, 'completedAt', 24);
  check(Number.isFinite(Date.parse(completedAt)) && new Date(completedAt).toISOString() === completedAt, 'completedAt');
  check(result.mode === 'assessment' || result.mode === 'practice', 'mode');
  check(typeof result.eligibleForProgress === 'boolean', 'eligibleForProgress');
  flags(result.qualityFlags, 'qualityFlags', RUN_FLAGS);
  check(result.eligibleForProgress === ((result.qualityFlags as unknown[]).length === 0), 'eligibleForProgress');

  const rawSettings = record(result.settings, 'settings');
  const hasInputMode = Object.hasOwn(rawSettings, 'inputMode');
  const settings = record(rawSettings, 'settings', ['durationMs', 'language', 'qwerty', 'corpusVersion', ...(hasInputMode ? ['inputMode'] : [])]);
  check((hasInputMode ? settings.inputMode === 'flow-v1' && SUPPORTED_DURATIONS.includes(settings.durationMs as DurationMs)
    : settings.durationMs === DURATION_MS) && settings.language === 'en', 'settings');
  const durationMs = settings.durationMs as DurationMs;
  check(typeof settings.qwerty === 'boolean', 'settings.qwerty');
  string(settings.corpusVersion, 'settings.corpusVersion', 80);

  const metrics = record(result.metrics, 'metrics', [
    'elapsedMs', 'correctCharacters', 'attemptedCharacters', 'correctAttempts', 'accuracy', 'deletedCharacters', 'wpm',
  ]);
  check(metrics.elapsedMs === durationMs, 'metrics.elapsedMs');
  count(metrics.correctCharacters, 'metrics.correctCharacters', MAX_CHARACTERS);
  const attempted = count(metrics.attemptedCharacters, 'metrics.attemptedCharacters');
  const correct = count(metrics.correctAttempts, 'metrics.correctAttempts', attempted);
  accuracy(metrics.accuracy, 'metrics.accuracy');
  check(metrics.accuracy === null || (attempted > 0 && metrics.accuracy === correct / attempted * 100), 'metrics.accuracy');
  count(metrics.deletedCharacters, 'metrics.deletedCharacters');
  number(metrics.wpm, 'metrics.wpm', MAX_CHARACTERS * 12000 / durationMs);
  check(metrics.wpm === (metrics.correctCharacters as number) * 12000 / durationMs, 'metrics.wpm');

  check(Array.isArray(result.sentences) && result.sentences.length <= MAX_SENTENCES, 'sentences');
  for (const [index, value] of result.sentences.entries()) {
    const path = `sentences[${index}]`;
    const rawSentence = record(value, path);
    const sentence = record(value, path, [
      'promptId', 'promptText', 'response', 'submitted', 'eligible', 'diagnosticsAvailable', 'qualityFlags', 'keys', 'pairs',
      ...(Object.hasOwn(rawSentence, 'prediction') ? ['prediction'] : []),
    ]);
    string(sentence.promptId, `${path}.promptId`, 128);
    check(/^[a-z ]+$/.test(string(sentence.promptText, `${path}.promptText`, MAX_PROMPT_LENGTH)), `${path}.promptText`);
    string(sentence.response, `${path}.response`, MAX_RESPONSE_LENGTH, 0);
    check(typeof sentence.submitted === 'boolean' && typeof sentence.eligible === 'boolean'
      && typeof sentence.diagnosticsAvailable === 'boolean', path);
    flags(sentence.qualityFlags, `${path}.qualityFlags`, SENTENCE_FLAGS);
    check(!sentence.eligible || (sentence.submitted && sentence.diagnosticsAvailable
      && sentence.response === sentence.promptText && (sentence.qualityFlags as unknown[]).length === 0), `${path}.eligible`);

    const keys = record(sentence.keys, `${path}.keys`);
    check(Object.keys(keys).length <= 27, `${path}.keys`);
    for (const [key, value] of Object.entries(keys)) {
      check(/^[a-z ]$/.test(key), `${path}.keys`);
      const stats = record(value, `${path}.keys.${key}`, ['attempts', 'correct', 'firstAttempts', 'firstErrors']);
      const attempts = count(stats.attempts, `${path}.keys.${key}.attempts`);
      count(stats.correct, `${path}.keys.${key}.correct`, attempts);
      const first = count(stats.firstAttempts, `${path}.keys.${key}.firstAttempts`, attempts);
      count(stats.firstErrors, `${path}.keys.${key}.firstErrors`, first);
    }
    const pairs = record(sentence.pairs, `${path}.pairs`);
    check(sentence.eligible || Object.keys(pairs).length === 0, `${path}.pairs`);
    check(Object.keys(pairs).length <= MAX_PROMPT_LENGTH - 1, `${path}.pairs`);
    for (const [pair, value] of Object.entries(pairs)) {
      check(/^[a-z]{2}$/.test(pair), `${path}.pairs`);
      const stats = record(value, `${path}.pairs.${pair}`, ['count', 'logSum']);
      const observations = count(stats.count, `${path}.pairs.${pair}.count`, MAX_PROMPT_LENGTH - 1);
      check(observations > 0, `${path}.pairs.${pair}.count`);
      // Sub-millisecond intervals have negative logs; do not discard them.
      number(stats.logSum, `${path}.pairs.${pair}.logSum`, observations * Math.log(5000) + 1e-9, -Number.MAX_SAFE_INTEGER);
    }
    if (Object.hasOwn(sentence, 'prediction')) {
      const raw = record(sentence.prediction, `${path}.prediction`);
      const hasCandidate = Object.hasOwn(raw, 'candidate');
      const prediction = record(raw, `${path}.prediction`, ['featureVersion', 'baseline', 'pairs', ...(hasCandidate ? ['candidate'] : [])]);
      check(sentence.eligible && settings.qwerty && prediction.featureVersion === 1, `${path}.prediction eligibility`);
      const baseline = record(prediction.baseline, 'prediction.baseline', ['kind', 'version']);
      check(['population', 'user', 'smoothed-pair'].includes(baseline.kind as string), 'prediction.baseline.kind');
      string(baseline.version, 'prediction.baseline.version', 80);
      if (hasCandidate) {
        const candidate = record(prediction.candidate, 'prediction.candidate', ['modelVersion', 'status']);
        string(candidate.modelVersion, 'prediction.candidate.modelVersion', 80);
        check(candidate.status === 'experimental', 'prediction.candidate.status');
      }
      const predicted = record(prediction.pairs, 'prediction.pairs');
      check(Object.keys(predicted).length > 0 && Object.keys(predicted).length === Object.keys(pairs).length, 'prediction.pairs completeness');
      for (const [pair, value] of Object.entries(predicted)) {
        check(Object.hasOwn(pairs, pair), 'prediction.pair');
        const observed = pairs[pair] as {count: number; logSum: number};
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

  check(Array.isArray(result.chartSamples) && result.chartSamples.length > 0
    && result.chartSamples.length <= durationMs / 1000, 'chartSamples');
  let previousTime = 0;
  for (const [index, value] of result.chartSamples.entries()) {
    const path = `chartSamples[${index}]`;
    const sample = record(value, path, ['elapsedMs', 'wpm', 'accuracy']);
    const elapsed = number(sample.elapsedMs, `${path}.elapsedMs`, durationMs, 1000);
    check(elapsed > previousTime, `${path}.elapsedMs`);
    previousTime = elapsed;
    number(sample.wpm, `${path}.wpm`, MAX_CHARACTERS / 5 / (elapsed / 60000));
    accuracy(sample.accuracy, `${path}.accuracy`);
  }
  check(previousTime === durationMs, 'chartSamples final time');

  // Every property above is a bounded JSON value; extra fields are rejected.
  check(new TextEncoder().encode(JSON.stringify(value)).length <= MAX_RESULT_BYTES, 'record exceeds 1 MiB');
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error('Local storage is unavailable in this browser.'));
      return;
    }
    const request = indexedDB.open(DATABASE, 2);
    let blocked = false;
    request.onupgradeneeded = () => {
      const store = request.result.objectStoreNames.contains(STORE)
        ? request.transaction!.objectStore(STORE)
        : request.result.createObjectStore(STORE, { keyPath: 'id' });
      if (!store.indexNames.contains(ORDER_INDEX)) store.createIndex(ORDER_INDEX, ['completedAt', 'id']);
    };
    request.onerror = () => reject(request.error ?? new Error('Could not open local results.'));
    request.onblocked = () => {
      blocked = true;
      reject(new Error('Close other TypeForge tabs, then retry saving or loading results.'));
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      if (blocked) database.close();
      else resolve(database);
    };
  });
}

async function request<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    let transaction: IDBTransaction | undefined;
    try {
      transaction = database.transaction(STORE, mode);
      const pending = operation(transaction.objectStore(STORE));
      transaction.oncomplete = () => {
        database.close();
        resolve(pending.result);
      };
      transaction.onabort = () => {
        database.close();
        reject(transaction?.error ?? pending.error ?? new Error('Local results transaction was aborted.'));
      };
    } catch (error) {
      transaction?.abort();
      database.close();
      reject(error);
    }
  });
}

export async function saveResult(result: SessionResult): Promise<void> {
  validateResult(result);
  await request('readwrite', (store) => store.add(result));
}

export async function getResult(id: string): Promise<SessionResult | undefined> {
  const result: unknown = await request('readonly', (store) => store.get(id));
  if (result === undefined) return undefined;
  validateResult(result);
  return result;
}

let storageDiagnostics: string[] = [];
/** Latest list operation warnings; corrupt records remain stored for recovery. */
export function getStorageDiagnostics(): readonly string[] { return [...storageDiagnostics]; }

export async function listResults(): Promise<SessionResult[]> {
  const values: unknown[] = await request('readonly', (store) => store.getAll());
  storageDiagnostics = [];
  const results: SessionResult[] = [];
  for (const value of values) {
    try { validateResult(value); results.push(value); }
    catch (error) { storageDiagnostics.push(error instanceof Error ? error.message : 'Unsupported local result.'); }
  }
  return results.sort((a, b) => b.completedAt.localeCompare(a.completedAt) || b.id.localeCompare(a.id));
}

export async function listResultsPage(before: {completedAt: string; id: string} | null = null, limit = 100): Promise<SessionResult[]> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new RangeError('History page limit must be between 1 and 100.');
  const database = await openDatabase();
  storageDiagnostics = [];
  return new Promise((resolve, reject) => {
    const results: SessionResult[] = [];
    let invalidCount = 0;
    let firstInvalidReason = '';
    const transaction = database.transaction(STORE, 'readonly');
    const range = before ? IDBKeyRange.upperBound([before.completedAt, before.id], true) : null;
    const store = transaction.objectStore(STORE);
    const index = store.index(ORDER_INDEX);
    // Records lacking indexable dates/IDs cannot appear in an index cursor.
    // Count them explicitly so corruption is not hidden by the index itself.
    if (!before) {
      const allCount = store.count();
      const indexedCount = index.count();
      indexedCount.onsuccess = () => {
        const omitted = allCount.result - indexedCount.result;
        if (omitted > 0) storageDiagnostics.push(`${omitted} local record(s) have unindexable history fields and remain stored for recovery.`);
      };
    }
    const cursor = index.openCursor(range, 'prev');
    cursor.onsuccess = () => {
      const entry = cursor.result;
      if (!entry) return;
      try { const value: unknown = entry.value; validateResult(value); results.push(value); }
      catch (error) {
        invalidCount++;
        firstInvalidReason ||= error instanceof Error ? error.message : 'Unsupported local result.';
      }
      if (results.length < limit) entry.continue();
    };
    transaction.oncomplete = () => {
      database.close();
      if (invalidCount) storageDiagnostics.push(`${invalidCount} unsupported/corrupt local record(s) were skipped and remain stored. ${firstInvalidReason}`);
      resolve(results);
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? cursor.error ?? new Error('Could not read local history page.'));
    };
  });
}

export async function deleteResult(id: string): Promise<void> {
  await request('readwrite', (store) => store.delete(id));
}
