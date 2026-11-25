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
import { validateFinitePracticeResult, type SavedSource } from './finite-practice-result.ts';

const DATABASE = 'typeforge';
export const STORE = 'results';
export const CURRENT_STORE = 'currentResults';
export const MEMBERSHIP_STORE = 'coachMembership';
export const METADATA_STORE = 'coachMetadata';
export const ORDER_INDEX = 'completedAt-id';
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

export function validateResultShape(value: unknown): asserts value is SessionResult {
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
    const raw = record(result.practiceFocus, 'practiceFocus');
    const focus = record(raw, 'practiceFocus', raw.source === 'model' ? ['pair', 'source'] : ['pair', 'evidenceCount', 'source', 'baselineVersion', 'score']);
    check(result.mode === 'practice' && typeof focus.pair === 'string' && /^[a-z]{2}$/.test(focus.pair), 'practiceFocus');
    if (focus.source !== 'model') {
      check(count(focus.evidenceCount, 'practiceFocus.evidenceCount', MAX_SENTENCES * MAX_PROMPT_LENGTH) >= 8, 'practiceFocus.evidenceCount');
      check(focus.source === 'baseline', 'practiceFocus.source');
      string(focus.baselineVersion, 'practiceFocus.baselineVersion', 80);
      check(number(focus.score, 'practiceFocus.score', Number.MAX_VALUE) > 0, 'practiceFocus.score');
    }
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
}

/** Reject unsupported or corrupt records before they reach a view or profile. */
export function validateResult(value: unknown): asserts value is SessionResult {
  validateResultShape(value);
  // Every property above is a bounded JSON value; extra fields are rejected.
  check(new TextEncoder().encode(JSON.stringify(value)).length <= MAX_RESULT_BYTES, 'record exceeds 1 MiB');
}

export function openDatabase(signal?: AbortSignal): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(signal.reason); return; }
    if (!globalThis.indexedDB) {
      reject(new Error('Local storage is unavailable in this browser.'));
      return;
    }
    const request = indexedDB.open(DATABASE, 3);
    let blocked = false;
    const cleanup = () => signal?.removeEventListener('abort', abort);
    const abort = () => { blocked = true; cleanup(); reject(signal?.reason); };
    signal?.addEventListener('abort', abort, { once: true });
    request.onupgradeneeded = () => {
      try {
        if (blocked || signal?.aborted) { request.transaction!.abort(); return; }
        const store = request.result.objectStoreNames.contains(STORE)
          ? request.transaction!.objectStore(STORE)
          : request.result.createObjectStore(STORE, { keyPath: 'id' });
        if (!store.indexNames.contains(ORDER_INDEX)) store.createIndex(ORDER_INDEX, ['completedAt', 'id']);
        const current = request.result.createObjectStore(CURRENT_STORE, { keyPath: 'id' });
        current.createIndex(ORDER_INDEX, ['completedAt', 'id']);
        request.result.createObjectStore(MEMBERSHIP_STORE, { keyPath: 'resultId' });
        request.result.createObjectStore(METADATA_STORE);
      } catch (error) {
        blocked = true; cleanup();
        try { request.transaction?.abort(); } catch { /* Already aborted/inactive. */ }
        reject(error);
      }
    };
    request.onerror = () => { cleanup(); reject(request.error ?? new Error('Could not open local results.')); };
    request.onblocked = () => {
      blocked = true;
      cleanup();
      reject(new Error('Close other TypeForge tabs, then retry saving or loading results.'));
    };
    request.onsuccess = () => {
      cleanup();
      const database = request.result;
      database.onversionchange = () => database.close();
      if (blocked) database.close();
      else resolve(database);
    };
  });
}

export type Persistence = { state: 'saved'; sourceId: string } | { state: 'failed'; sourceId: string; retryable: boolean };

const changes = 'typeforge-source-invalidation-v3';
const listeners = new Set<() => void>();
let channel: BroadcastChannel | null = null;
function notify() {
  for (const listener of listeners) {
    try { listener(); } catch { /* A view cannot undo a committed save. */ }
  }
}
export function subscribeStorageInvalidation(listener: () => void) {
  if (!listeners.size) {
    try { channel = new BroadcastChannel(changes); channel.onmessage = notify; } catch { /* Storage and focus still work. */ }
    window.addEventListener('storage', storageChanged);
    window.addEventListener('focus', notify);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size) return;
    channel?.close(); channel = null;
    window.removeEventListener('storage', storageChanged);
    window.removeEventListener('focus', notify);
  };
}
function storageChanged(event: StorageEvent) { if (event.key === changes) notify(); }
function committed() {
  try { globalThis.localStorage?.setItem(changes, crypto.randomUUID()); } catch { /* Another tab also checks on focus. */ }
  try { channel?.postMessage(null); } catch { /* Storage events still work. */ }
  notify();
}

function validateSource(value: unknown): SavedSource {
  if (value && typeof value === 'object' && 'schemaId' in value) return validateFinitePracticeResult(value);
  validateResult(value);
  return value;
}

// Only used on a same-ID retry. Object key order has no meaning in saved JSON.
function sortedJson(value: unknown): string {
  return JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
}

export async function saveSource(source: SessionResult): Promise<Persistence> {
  const id = source.id;
  let copy: SessionResult;
  try { copy = structuredClone(source); validateResult(copy); }
  catch { return { state: 'failed', sourceId: id, retryable: false }; }
  let db: IDBDatabase | undefined;
  try {
    db = await openDatabase();
    let inserted = false, conflict = false;
    await new Promise<void>((resolve, reject) => {
      const tx = db!.transaction([STORE, CURRENT_STORE], 'readwrite');
      const legacy = tx.objectStore(STORE).get(id), current = tx.objectStore(CURRENT_STORE).get(id);
      current.onsuccess = () => {
        try {
          const saved = legacy.result ?? current.result;
          if (saved === undefined) { tx.objectStore(CURRENT_STORE).add(copy); inserted = true; }
          else {
            const measured = historyJsonBytes(saved);
            conflict = (legacy.result !== undefined && current.result !== undefined) || measured.oversized || !!measured.error ||
              sortedJson(saved) !== sortedJson(copy);
          }
        } catch (error) { tx.abort(); reject(error); }
      };
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error('Local save aborted.'));
    });
    if (conflict) return { state: 'failed', sourceId: id, retryable: false };
    if (inserted) committed();
    return { state: 'saved', sourceId: id };
  } catch { return { state: 'failed', sourceId: id, retryable: true }; }
  finally { db?.close(); }
}

export async function saveResult(result: SessionResult): Promise<void> {
  validateResult(result);
  if ((await saveSource(result)).state !== 'saved') throw new Error('Local result was not saved; retain it for retry or export.');
}

export async function getSavedSource(id: string): Promise<SavedSource | undefined> {
  const db = await openDatabase();
  try {
    const values = await new Promise<unknown[]>((resolve, reject) => {
      const tx = db.transaction([STORE, CURRENT_STORE], 'readonly');
      const legacy = tx.objectStore(STORE).get(id), current = tx.objectStore(CURRENT_STORE).get(id);
      tx.oncomplete = () => resolve([legacy.result, current.result].filter(value => value !== undefined));
      tx.onabort = () => reject(tx.error);
    });
    if (values.length > 1) throw new Error('Cross-partition source collision.');
    return values.length ? validateSource(values[0]) : undefined;
  } finally { db.close(); }
}
export async function getResult(id: string): Promise<SessionResult | undefined> {
  const result = await getSavedSource(id);
  return result && !('schemaId' in result) ? result : undefined;
}

let storageDiagnostics: string[] = [];
/** Latest list operation warnings; corrupt records remain stored for recovery. */
export function getStorageDiagnostics(): readonly string[] { return [...storageDiagnostics]; }

export async function listSavedSources(): Promise<SavedSource[]> {
  const database = await openDatabase();
  const values = await new Promise<unknown[]>((resolve, reject) => {
    const tx = database.transaction([STORE, CURRENT_STORE], 'readonly');
    const legacy = tx.objectStore(STORE).getAll(), current = tx.objectStore(CURRENT_STORE).getAll();
    tx.oncomplete = () => { database.close(); resolve([...legacy.result, ...current.result]); };
    tx.onabort = () => { database.close(); reject(tx.error); };
  });
  storageDiagnostics = [];
  const results: SavedSource[] = [];
  const ids = new Set<string>(), collisions = new Set<string>();
  for (const value of values) {
    const id = value && typeof value === 'object' && 'id' in value ? value.id : undefined;
    if (typeof id === 'string') { if (ids.has(id)) collisions.add(id); ids.add(id); }
  }
  for (const value of values) {
    try { const result = validateSource(value); if (collisions.has(result.id)) throw new Error('Cross-partition source collision.'); results.push(result); }
    catch (error) { storageDiagnostics.push(error instanceof Error ? error.message : 'Unsupported local result.'); }
  }
  return results.sort((a, b) => b.completedAt.localeCompare(a.completedAt) || b.id.localeCompare(a.id));
}

export async function listResults(): Promise<SessionResult[]> {
  return (await listSavedSources()).filter((source): source is SessionResult => !('schemaId' in source));
}

export async function listResultsPage(before: {completedAt: string; id: string} | null = null, limit = 100,
  keepSentence?: (sentence: unknown) => boolean): Promise<SessionResult[]> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new RangeError('History page limit must be between 1 and 100.');
  const database = await openDatabase();
  storageDiagnostics = [];
  return new Promise((resolve, reject) => {
    const results: SessionResult[] = [];
    let invalidCount = 0;
    let firstInvalidReason = '';
    const transaction = database.transaction([STORE, CURRENT_STORE], 'readonly');
    // Records lacking indexable dates/IDs cannot appear in an index cursor.
    // Count them explicitly so corruption is not hidden by the index itself.
    if (!before) {
      for (const name of [STORE, CURRENT_STORE]) {
        const store = transaction.objectStore(name), index = store.index(ORDER_INDEX);
        const allCount = store.count(), indexedCount = index.count();
        indexedCount.onsuccess = () => {
          const omitted = allCount.result - indexedCount.result;
          if (omitted > 0) storageDiagnostics.push(`${omitted} local record(s) have unindexable history fields and remain stored for recovery.`);
        };
      }
    }
    visitMergedKeys(transaction, before ? [before.completedAt, before.id] : null, (entry, partition, next) => {
      const pending = transaction.objectStore(partition === 'legacy' ? STORE : CURRENT_STORE).get(entry.primaryKey);
      const counterpart = transaction.objectStore(partition === 'legacy' ? CURRENT_STORE : STORE).getKey(entry.primaryKey);
      counterpart.onsuccess = () => {
        let value: unknown = pending.result;
        if (value && typeof value === 'object' && 'schemaId' in value) { next(); return; }
        try {
          if (counterpart.result !== undefined) throw new Error('Cross-partition source collision.');
          // Older timing formats may co-exist within a saved session. Project just this read.
          if (keepSentence && value && typeof value === 'object' && 'sentences' in value && Array.isArray(value.sentences) &&
              value.sentences.length <= MAX_SENTENCES && !value.sentences.every(keepSentence)) {
            const size = historyJsonBytes(value);
            if (!size.error && !size.oversized) value = { ...value, sentences: value.sentences.filter(keepSentence) };
          }
          validateResult(value);
          results.push(value);
        } catch (error) {
          invalidCount++;
          firstInvalidReason ||= error instanceof Error ? error.message : 'Unsupported local result.';
        }
        if (results.length < limit) next();
      };
    });
    transaction.oncomplete = () => {
      database.close();
      if (invalidCount) storageDiagnostics.push(`${invalidCount} unsupported/corrupt local record(s) were skipped and remain stored. ${firstInvalidReason}`);
      resolve(results);
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error('Could not read local history page.'));
    };
  });
}

/** Two native key-only cursors; values are fetched only for the selected key.
 * The caller owns budgets and calls next only after processing that source.
 */
function visitMergedKeys(tx: IDBTransaction, before: IDBValidKey | null,
  visit: (entry: IDBCursor, partition: 'legacy' | 'current', next: () => void) => void,
  exhausted: () => void = () => {}): void {
  const entries: { legacy?: IDBCursor | null; current?: IDBCursor | null } = {};
  function choose() {
    if (entries.legacy === undefined || entries.current === undefined) return;
    if (!entries.legacy && !entries.current) { exhausted(); return; }
    const partition = !entries.current || entries.legacy && indexedDB.cmp(entries.legacy.key, entries.current.key) >= 0 ? 'legacy' : 'current';
    const entry = entries[partition]!;
    visit(entry, partition, () => {
      delete entries[partition];
      entry.continue();
    });
  }
  for (const partition of ['legacy', 'current'] as const) {
    const store = tx.objectStore(partition === 'legacy' ? STORE : CURRENT_STORE);
    const request = store.index(ORDER_INDEX).openKeyCursor(before === null ? null : IDBKeyRange.upperBound(before, true), 'prev');
    request.onsuccess = () => { entries[partition] = request.result; choose(); };
  }
}

export async function deleteResult(id: string): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE, CURRENT_STORE, MEMBERSHIP_STORE], 'readwrite');
      for (const name of [STORE, CURRENT_STORE, MEMBERSHIP_STORE]) tx.objectStore(name).delete(id);
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
    });
    committed();
  } finally { db.close(); }
}

export const HISTORY_SLICE_ROWS = 25;
export const HISTORY_SLICE_BYTES = 4 * MAX_RESULT_BYTES;
export const HISTORY_SCAN_ROWS = 500;
export const HISTORY_SCAN_BYTES = 16 * MAX_RESULT_BYTES;
const HISTORY_WORK_MS = 8;

export interface HistoryOptions {
  /** Opaque index key, including indexable corrupt keys; resume unchanged. */
  before?: IDBValidKey | null;
  rowLimit?: number;
  byteLimit?: number;
  signal?: AbortSignal;
  /** Pure, synchronous cohort filter; excluded rows still consume budgets. */
  compatible?: (result: SessionResult) => boolean;
}

export interface HistoryRead {
  results: SessionResult[];
  cursor: IDBValidKey | null;
  /** Indexed traversal exhausted; exclusions remain explicit below. */
  complete: boolean;
  reason: 'exhausted' | 'row-budget' | 'byte-budget' | 'record-limit' | 'yield' | 'aborted' | 'failed';
  examinedRows: number;
  /** JSON UTF-8 bytes traversed; a record-limit can leave a bounded prefix only. */
  examinedBytes: number;
  diagnostics: {
    invalidRows: number;
    incompatibleRows: number;
    unindexableRows: number | null;
    oversizedRows: number;
    /** Exact oversized size is unknown because traversal stops before allocating it. */
    oversizedSerializedBytes: number | null;
    oversizedByteLowerBound: number;
    unserializableRows: number;
    firstInvalidReason: string | null;
    error: string | null;
  };
  costs: { maxOperationMs: number; maxOperationOvershootMs: number; slices: number; yields: number };
}

function historyLimits(options: HistoryOptions, rows: number, bytes: number): [number, number] {
  const rowLimit = options.rowLimit ?? rows;
  const byteLimit = options.byteLimit ?? bytes;
  if (!Number.isInteger(rowLimit) || rowLimit < 1 || rowLimit > rows) {
    throw new RangeError(`History row limit must be between 1 and ${rows}.`);
  }
  if (!Number.isInteger(byteLimit) || byteLimit < MAX_RESULT_BYTES || byteLimit > bytes) {
    throw new RangeError(`History byte limit must be between ${MAX_RESULT_BYTES} and ${bytes}.`);
  }
  return [rowLimit, byteLimit];
}

function emptyHistory(before: IDBValidKey | null = null): HistoryRead {
  return {
    results: [], cursor: before, complete: false, reason: 'failed', examinedRows: 0, examinedBytes: 0,
    diagnostics: {
      invalidRows: 0, incompatibleRows: 0, unindexableRows: null, oversizedRows: 0,
      oversizedSerializedBytes: 0, oversizedByteLowerBound: 0, unserializableRows: 0, firstInvalidReason: null, error: null,
    },
    costs: { maxOperationMs: 0, maxOperationOvershootMs: 0, slices: 0, yields: 0 },
  };
}

/** Measure a JSON prefix without allocating a whole string/UTF-8 buffer. Only
 * plain JSON trees are needed: other IDB clone types cannot pass result shape
 * validation. Depth 32 exceeds the valid schema; cycles/deeper trees stop too.
 */
export function historyJsonBytes(value: unknown, ceiling = MAX_RESULT_BYTES): { bytes: number; oversized: boolean; error: string | null } {
  let bytes = 0;
  let oversized = false;
  const ancestors = new Set<object>();
  const add = (amount: number) => {
    if (amount > ceiling - bytes) { bytes = ceiling; oversized = true; return false; }
    bytes += amount;
    return true;
  };
  const quoted = (text: string): boolean => {
    if (!add(1)) return false;
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      let width: number;
      if (code === 34 || code === 92 || code === 8 || code === 9 || code === 10 || code === 12 || code === 13) width = 2;
      else if (code < 32) width = 6;
      else if (code < 128) width = 1;
      else if (code < 2048) width = 2;
      else if (code >= 0xd800 && code <= 0xdbff && text.charCodeAt(i + 1) >= 0xdc00 && text.charCodeAt(i + 1) <= 0xdfff) { width = 4; i++; }
      else if (code >= 0xd800 && code <= 0xdfff) width = 6; // JSON escapes lone surrogates.
      else width = 3;
      if (!add(width)) return false;
    }
    return add(1);
  };
  const visit = (item: unknown, depth: number): boolean => {
    if (item === null) return add(4);
    if (typeof item === 'string') return quoted(item);
    if (typeof item === 'boolean') return add(item ? 4 : 5);
    if (typeof item === 'number') return add(Number.isFinite(item) ? String(item).length : 4);
    if (typeof item !== 'object') throw new Error('Local record contains a non-JSON value.');
    if (depth > 32 || ancestors.has(item)) throw new Error('Local record is cyclic or exceeds JSON depth 32.');
    if (!Array.isArray(item) && Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null) {
      throw new Error('Local record contains a non-JSON object.');
    }
    ancestors.add(item);
    try {
      if (!add(1)) return false;
      if (Array.isArray(item)) {
        for (let i = 0; i < item.length; i++) {
          if (i && !add(1)) return false;
          // Native JSON represents sparse/undefined array slots as null.
          if (!visit(item[i] === undefined ? null : item[i], depth + 1)) return false;
        }
      } else {
        let first = true;
        // Avoid creating a second unbounded array of corrupt property names.
        for (const key in item) {
          if (!Object.hasOwn(item, key)) continue;
          if (!first && !add(1)) return false;
          first = false;
          if (!quoted(key) || !add(1) || !visit((item as Record<string, unknown>)[key], depth + 1)) return false;
        }
      }
      return add(1);
    } finally { ancestors.delete(item); }
  };
  try { visit(value, 0); return { bytes, oversized, error: null }; }
  catch (error) { return { bytes, oversized: false, error: error instanceof Error ? error.message : String(error) }; }
}

/** Additive bounded optional-data reader; legacy assessment/export APIs retain their meaning. */
export async function readHistorySlice(options: HistoryOptions = {}): Promise<HistoryRead> {
  const [rowLimit, byteLimit] = historyLimits(options, HISTORY_SLICE_ROWS, HISTORY_SLICE_BYTES);
  const output = emptyHistory(options.before);
  const { diagnostics, costs } = output;
  let database: IDBDatabase | undefined;
  try {
    database = await openDatabase(options.signal);
    if (options.signal?.aborted) throw options.signal.reason;
    await new Promise<void>((resolve, reject) => {
      const transaction = database!.transaction([STORE, CURRENT_STORE], 'readonly');
      let failed = false;
      let recordLimited = false;
      const abort = () => transaction.abort();
      const cleanup = () => options.signal?.removeEventListener('abort', abort);
      transaction.oncomplete = () => { cleanup(); resolve(); };
      transaction.onabort = () => { cleanup(); reject(transaction.error ?? new Error('Local history read aborted.')); };
      const fail = (error: unknown) => { failed = true; cleanup(); transaction.abort(); reject(error); };
      options.signal?.addEventListener('abort', abort, { once: true });
      let unindexable = 0, counted = 0;
      for (const name of [STORE, CURRENT_STORE]) {
        const store = transaction.objectStore(name), index = store.index(ORDER_INDEX);
        const allCount = store.count(), indexedCount = index.count();
        indexedCount.onsuccess = () => { unindexable += allCount.result - indexedCount.result;
          if (++counted === 2) diagnostics.unindexableRows = unindexable; };
      }
      // Key-only lookahead establishes exhaustion without examining another value.
      let workMs = 0;
      costs.slices = 1;
      visitMergedKeys(transaction, options.before ?? null, (entry, partition, next) => {
        if (output.examinedRows >= rowLimit) { output.reason = 'row-budget'; return; }
        // Reserve one maximum-size record BEFORE materializing it. This may underfill
        // by <1 MiB, but never skips a valid row or rereads a deferred value.
        if (byteLimit - output.examinedBytes < MAX_RESULT_BYTES) { output.reason = 'byte-budget'; return; }
        if (workMs >= HISTORY_WORK_MS) { output.reason = 'yield'; return; }
        const valueRequest = transaction.objectStore(partition === 'legacy' ? STORE : CURRENT_STORE).get(entry.primaryKey);
        const counterpart = transaction.objectStore(partition === 'legacy' ? CURRENT_STORE : STORE).getKey(entry.primaryKey);
        counterpart.onsuccess = () => {
          const started = performance.now();
          try {
            const value: unknown = valueRequest.result;
            output.examinedRows++;
            output.cursor = entry.key;
            const measured = historyJsonBytes(value);
            output.examinedBytes += measured.bytes;
            if (measured.error || measured.oversized) {
              diagnostics.invalidRows++;
              if (measured.oversized) {
                diagnostics.oversizedRows++;
                diagnostics.oversizedSerializedBytes = null;
                diagnostics.oversizedByteLowerBound += MAX_RESULT_BYTES + 1;
              } else diagnostics.unserializableRows++;
              diagnostics.firstInvalidReason ??= measured.error ?? 'Local record exceeds 1 MiB; exact size was not serialized and the record remains stored.';
              output.reason = 'record-limit';
              recordLimited = true; // Never repeat a native oversized/unsupported materialization automatically.
              return;
            }
            // Finite sources are a separate envelope, never timed validation input.
            if (value && typeof value === 'object' && 'schemaId' in value) return;
            try { validateResultShape(value); }
            catch (error) {
              diagnostics.invalidRows++;
              diagnostics.firstInvalidReason ??= error instanceof Error ? error.message : String(error);
              return;
            }
            if (counterpart.result !== undefined) {
              diagnostics.invalidRows++; diagnostics.firstInvalidReason ??= 'Cross-partition source collision.'; return;
            }
            if (options.compatible && !options.compatible(value)) diagnostics.incompatibleRows++;
            else output.results.push(value);
          } catch (error) { fail(error); return; }
          finally {
            const elapsed = performance.now() - started;
            workMs += elapsed;
            costs.maxOperationMs = Math.max(costs.maxOperationMs, elapsed);
            costs.maxOperationOvershootMs = Math.max(0, costs.maxOperationMs - HISTORY_WORK_MS);
            // Abort may be requested from a compatibility predicate.
            if (!failed && !recordLimited && !options.signal?.aborted) {
              try { next(); } catch (error) { fail(error); }
            }
          }
        };
      }, () => { output.complete = true; output.reason = 'exhausted'; });
    });
  } catch (error) {
    output.complete = false;
    output.reason = options.signal?.aborted ? 'aborted' : 'failed';
    diagnostics.error = error instanceof Error ? error.message : String(error);
  } finally { database?.close(); }
  return output;
}

/** At most one bounded automatic lookup; explicit continuation starts another lookup. */
export async function scanHistory(options: HistoryOptions = {}): Promise<HistoryRead> {
  const [rowLimit, byteLimit] = historyLimits(options, HISTORY_SCAN_ROWS, HISTORY_SCAN_BYTES);
  const output = emptyHistory(options.before);
  while (true) {
    const slice = await readHistorySlice({
      ...options, before: output.cursor,
      rowLimit: Math.min(HISTORY_SLICE_ROWS, rowLimit - output.examinedRows),
      byteLimit: Math.min(HISTORY_SLICE_BYTES, byteLimit - output.examinedBytes),
    });
    output.results.push(...slice.results);
    output.cursor = slice.cursor;
    output.complete = slice.complete;
    output.reason = slice.reason;
    output.examinedRows += slice.examinedRows;
    output.examinedBytes += slice.examinedBytes;
    for (const field of ['invalidRows', 'incompatibleRows', 'oversizedRows', 'oversizedByteLowerBound', 'unserializableRows'] as const) {
      output.diagnostics[field] += slice.diagnostics[field];
    }
    output.diagnostics.oversizedSerializedBytes = output.diagnostics.oversizedSerializedBytes === null || slice.diagnostics.oversizedSerializedBytes === null
      ? null : output.diagnostics.oversizedSerializedBytes + slice.diagnostics.oversizedSerializedBytes;
    if (slice.diagnostics.unindexableRows !== null) output.diagnostics.unindexableRows = slice.diagnostics.unindexableRows;
    output.diagnostics.firstInvalidReason ??= slice.diagnostics.firstInvalidReason;
    output.diagnostics.error = slice.diagnostics.error;
    output.costs.slices += slice.costs.slices;
    output.costs.maxOperationMs = Math.max(output.costs.maxOperationMs, slice.costs.maxOperationMs);
    output.costs.maxOperationOvershootMs = Math.max(output.costs.maxOperationOvershootMs, slice.costs.maxOperationOvershootMs);
    if (slice.complete || slice.reason === 'record-limit' || slice.reason === 'aborted' || slice.reason === 'failed') return output;
    if (output.examinedRows >= rowLimit) { output.reason = 'row-budget'; return output; }
    if (byteLimit - output.examinedBytes < MAX_RESULT_BYTES) { output.reason = 'byte-budget'; return output; }
    output.costs.yields++;
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
}
