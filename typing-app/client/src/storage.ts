import {
  DURATION_MS,
  MAX_ATTEMPTS,
  MAX_PROMPT_LENGTH,
  MAX_RESPONSE_LENGTH,
  MAX_SENTENCES,
  type SessionResult,
} from './engine.ts';

const DATABASE = 'typeforge';
const STORE = 'results';
const MAX_RESULT_BYTES = 1024 * 1024;
const MAX_CHARACTERS = MAX_SENTENCES * MAX_PROMPT_LENGTH;
const RUN_FLAGS = ['interrupted', 'invalid-input'];
const SENTENCE_FLAGS = [
  'incorrect', 'edited', 'repeat', 'missing-timing', 'malformed-timing',
  'interrupted', 'invalid-input', 'unsupported-layout', 'unfinished',
];

function check(condition: unknown, field: string): asserts condition {
  if (!condition) throw new Error(`Invalid saved result: ${field}.`);
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
  const result = record(value, 'record', [
    'id', 'owner', 'schemaVersion', 'metricVersion', 'completedAt', 'mode',
    'settings', 'qualityFlags', 'eligibleForProgress', 'metrics', 'sentences', 'chartSamples',
  ]);
  resultId(result.id);
  check(result.owner === 'guest', 'owner');
  check(result.schemaVersion === 1 && result.metricVersion === 1, 'version');
  const completedAt = string(result.completedAt, 'completedAt', 24);
  check(Number.isFinite(Date.parse(completedAt)) && new Date(completedAt).toISOString() === completedAt, 'completedAt');
  check(result.mode === 'assessment' || result.mode === 'practice', 'mode');
  check(typeof result.eligibleForProgress === 'boolean', 'eligibleForProgress');
  flags(result.qualityFlags, 'qualityFlags', RUN_FLAGS);
  check(result.eligibleForProgress === ((result.qualityFlags as unknown[]).length === 0), 'eligibleForProgress');

  const settings = record(result.settings, 'settings', ['durationMs', 'language', 'qwerty', 'corpusVersion']);
  check(settings.durationMs === DURATION_MS && settings.language === 'en', 'settings');
  check(typeof settings.qwerty === 'boolean', 'settings.qwerty');
  string(settings.corpusVersion, 'settings.corpusVersion', 80);

  const metrics = record(result.metrics, 'metrics', [
    'elapsedMs', 'correctCharacters', 'attemptedCharacters', 'correctAttempts', 'accuracy', 'deletedCharacters', 'wpm',
  ]);
  check(metrics.elapsedMs === DURATION_MS, 'metrics.elapsedMs');
  count(metrics.correctCharacters, 'metrics.correctCharacters', MAX_CHARACTERS);
  const attempted = count(metrics.attemptedCharacters, 'metrics.attemptedCharacters');
  const correct = count(metrics.correctAttempts, 'metrics.correctAttempts', attempted);
  accuracy(metrics.accuracy, 'metrics.accuracy');
  check(metrics.accuracy === null || (attempted > 0 && metrics.accuracy === correct / attempted * 100), 'metrics.accuracy');
  count(metrics.deletedCharacters, 'metrics.deletedCharacters');
  number(metrics.wpm, 'metrics.wpm', MAX_CHARACTERS / 5);
  check(metrics.wpm === (metrics.correctCharacters as number) / 5, 'metrics.wpm');

  check(Array.isArray(result.sentences) && result.sentences.length <= MAX_SENTENCES, 'sentences');
  for (const [index, value] of result.sentences.entries()) {
    const path = `sentences[${index}]`;
    const sentence = record(value, path, [
      'promptId', 'promptText', 'response', 'submitted', 'eligible', 'diagnosticsAvailable', 'qualityFlags', 'keys', 'pairs',
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
  }

  check(Array.isArray(result.chartSamples) && result.chartSamples.length > 0
    && result.chartSamples.length <= DURATION_MS / 1000, 'chartSamples');
  let previousTime = 0;
  for (const [index, value] of result.chartSamples.entries()) {
    const path = `chartSamples[${index}]`;
    const sample = record(value, path, ['elapsedMs', 'wpm', 'accuracy']);
    const elapsed = number(sample.elapsedMs, `${path}.elapsedMs`, DURATION_MS, 1000);
    check(elapsed > previousTime, `${path}.elapsedMs`);
    previousTime = elapsed;
    number(sample.wpm, `${path}.wpm`, MAX_CHARACTERS / 5 / (elapsed / 60000));
    accuracy(sample.accuracy, `${path}.accuracy`);
  }
  check(previousTime === DURATION_MS, 'chartSamples final time');

  // Every property above is a bounded JSON value; extra fields are rejected.
  check(new TextEncoder().encode(JSON.stringify(value)).length <= MAX_RESULT_BYTES, 'record exceeds 1 MiB');
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error('Local storage is unavailable in this browser.'));
      return;
    }
    const request = indexedDB.open(DATABASE, 1);
    let blocked = false;
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'id' });
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

export async function listResults(): Promise<SessionResult[]> {
  // ponytail: read all local sessions; add cursor pagination if history becomes slow.
  const results: unknown[] = await request('readonly', (store) => store.getAll());
  for (const result of results) validateResult(result);
  return (results as SessionResult[]).sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt) || a.id.localeCompare(b.id));
}

export async function deleteResult(id: string): Promise<void> {
  await request('readwrite', (store) => store.delete(id));
}
