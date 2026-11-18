import { MAX_RESULT_BYTES } from './engine.ts';
import { canonicalJson } from './coach-plan.ts';
import { openDatabase, STORE, CURRENT_STORE, MEMBERSHIP_STORE, METADATA_STORE,
  SOURCE_STORES, visitMergedKeys, historyJsonBytes, validateResult, validateResultShape } from './storage.ts';
import type { Admission, Authority, Capture, EpochReset, Ledger, Membership, Metadata, MergedCursor,
  PendingSource, Persistence, PreparedStatus, ProjectionInput, RangeProof, SavedSource, SourceRead,
  SourceRef, Stop, VerifiedProof, Work } from './coach-types.ts';

const COMPACT_BYTES = 4096;
const MAX_REVISION = Number.MAX_SAFE_INTEGER;
// Deferred imports let the independent bounded primitives run before the other
// implementation lanes are integrated. No alternate validators or stubs exist.
const policy = () => import('./coach-policy.ts');
const plans = () => import('./coach-plan.ts');
const finite = () => import('./finite-practice-result.ts');

export const canonicalJSON = canonicalJson;

export async function sourceHash(value: SavedSource): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalJSON(value)));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function captureValid(value: Capture): boolean {
  return Object.keys(value).sort().join() === ['capturedAt', 'contextId', 'databaseId', 'epochId', 'purpose'].sort().join()
    && [value.databaseId, value.contextId, value.epochId].every(id => typeof id === 'string' && id.length > 0 && id.length <= 128)
    && typeof value.capturedAt === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value.capturedAt)
    && Number.isFinite(Date.parse(value.capturedAt)) && new Date(value.capturedAt).toISOString() === value.capturedAt
    && (value.purpose === 'ordinary' || value.purpose === 'protected-probe');
}
function authority(metadata: Metadata): Authority | null {
  return metadata.sourceRevision < MAX_REVISION ? { databaseId: metadata.databaseId,
    contextId: metadata.defaultContextId, epochId: metadata.activeEpochId, revision: metadata.sourceRevision } : null;
}
function bounded(value: unknown, ceiling = MAX_RESULT_BYTES): void {
  const measured = historyJsonBytes(value, ceiling);
  if (measured.error || measured.oversized) throw new Error(measured.error ?? 'Local record exceeds its bounded prefix limit.');
}
async function metadataValue(value: unknown, alreadyBounded = false): Promise<Metadata | null> {
  if (!alreadyBounded) { try { bounded(value, COMPACT_BYTES); } catch { return null; } }
  // A missing runtime dependency is not malformed stored authority. Fail the
  // operation rather than commit a non-fenced write under still-valid metadata.
  const { validateMetadata } = await policy();
  try { return validateMetadata(value); }
  catch { return null; }
}
class SourceValidatorUnavailable extends Error {}
async function validateSource(value: unknown, alreadyBounded = false): Promise<SavedSource> {
  if (!alreadyBounded) bounded(value);
  if (value && typeof value === 'object' && 'schemaId' in value) {
    const identity = (value as {plan?: unknown}).plan;
    let planRuntime: Awaited<ReturnType<typeof plans>>, finiteRuntime: Awaited<ReturnType<typeof finite>>;
    try { [planRuntime, finiteRuntime] = await Promise.all([plans(), finite()]); }
    catch (error) { throw new SourceValidatorUnavailable('Finite source validation is unavailable; retain the original source for retry.', { cause: error }); }
    const plan = await planRuntime.resolveStoredFinitePlan(identity as never);
    if (!plan) throw new Error('Unsupported saved finite plan identity.');
    return finiteRuntime.validateFinitePracticeResult(value, plan);
  }
  if (alreadyBounded) validateResultShape(value); // Accepted P3 path: no second serialization after measured prefix.
  else validateResult(value); // Preserve the unchanged public timed validator at save/recovery boundaries.
  return value;
}

let invalidation = 0;
const listeners = new Set<() => void>();
let channel: BroadcastChannel | null = null;
let listening = false;
export function invalidatePreparations(): void {
  invalidation++;
  for (const listener of listeners) { try { listener(); } catch { /* A UI subscriber cannot undo a durable commit or block invalidation. */ } }
}
function listen(): void {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  if (typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel('typeforge-source-invalidation-v3');
    channel.onmessage = () => invalidatePreparations();
  }
  window.addEventListener('storage', event => { if (event.key === 'typeforge-source-invalidation-v3') invalidatePreparations(); });
  window.addEventListener('focus', invalidatePreparations);
  window.addEventListener('pageshow', invalidatePreparations);
}
export function subscribeStorageInvalidation(listener: () => void): () => void {
  listen(); listeners.add(listener); return () => { listeners.delete(listener); };
}
function committed(): void {
  listen(); invalidatePreparations(); channel?.postMessage({ invalidated: true });
  try { globalThis.localStorage?.setItem('typeforge-source-invalidation-v3', crypto.randomUUID()); } catch { /* Broadcast/focus still invalidate. */ }
}

/** All application source mutations use this overlapping transaction scope. */
async function readState(id?: string): Promise<{ legacy: unknown; current: unknown; member: unknown; metadata: unknown }> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = database.transaction(SOURCE_STORES, 'readonly');
      const metadata = tx.objectStore(METADATA_STORE).get('authority');
      const legacy = id === undefined ? null : tx.objectStore(STORE).get(id);
      const current = id === undefined ? null : tx.objectStore(CURRENT_STORE).get(id);
      const member = id === undefined ? null : tx.objectStore(MEMBERSHIP_STORE).get(id);
      tx.oncomplete = () => resolve({ legacy: legacy?.result, current: current?.result, member: member?.result, metadata: metadata.result });
      tx.onabort = () => reject(tx.error ?? new Error('Local source read aborted.'));
    });
  } finally { database.close(); }
}

export async function captureContext(signal?: AbortSignal): Promise<Capture | null> {
  try {
    if (signal?.aborted) return null;
    const database = await openDatabase(signal);
    let raw: unknown;
    try {
      raw = await new Promise((resolve, reject) => {
        const tx = database.transaction(METADATA_STORE, 'readonly');
        const request = tx.objectStore(METADATA_STORE).get('authority');
        tx.oncomplete = () => resolve(request.result);
        tx.onabort = () => reject(tx.error);
      });
    } finally { database.close(); }
    const metadata = await metadataValue(raw);
    if (!metadata || !authority(metadata) || signal?.aborted) return null;
    return freeze({ databaseId: metadata.databaseId, contextId: metadata.defaultContextId,
      epochId: metadata.activeEpochId, capturedAt: new Date().toISOString(), purpose: 'ordinary' });
  } catch { return null; }
}

export async function saveSource(source: SavedSource, capture: Capture | null): Promise<Persistence> {
  let copy: SavedSource;
  let hash: string;
  const failed = (retryable: boolean): Persistence => ({ state: 'failed', pendingIds: [source?.id],
    sourceId: source?.id, capture, sourceSaved: false, membershipReady: false, retryable });
  try {
    capture = capture === null ? null : freeze(structuredClone(capture));
    copy = await validateSource(structuredClone(source));
    if (capture && !captureValid(capture)) return failed(false);
    hash = await sourceHash(copy);
  } catch (error) { return failed(error instanceof SourceValidatorUnavailable); }
  try {
    const prior = await readState(copy.id);
    if (prior.legacy !== undefined && prior.current !== undefined) return failed(false);
    const existing = prior.legacy ?? prior.current;
    if (existing !== undefined && await sourceHash(await validateSource(existing)) !== hash) return failed(false);
    const metadata = await metadataValue(prior.metadata);
    const usable = metadata && authority(metadata);
    const member: Membership | null = capture && usable && capture.databaseId === metadata!.databaseId
      && capture.contextId === metadata!.defaultContextId ? {
        ...capture, schemaId: 'typeforge-coach-membership-v2', sourceKind: 'schemaId' in copy ? 'finite-practice-v1' : 'timed-v1',
        resultId: copy.id, resultSha256: hash,
      } : null;
    // Snapshot strings contain only validated/bounded data. Hashing has finished
    // before the live write transaction; compare re-read content synchronously.
    const oldSource = existing === undefined ? null : canonicalJSON(existing);
    const oldMetadata = (() => { try { bounded(prior.metadata, COMPACT_BYTES); return canonicalJSON(prior.metadata); } catch { return null; } })();
    const oldMember = (() => { try { bounded(prior.member, COMPACT_BYTES); return canonicalJSON(prior.member); } catch { return null; } })();
    const database = await openDatabase();
    let changed = false;
    let membershipReady = false;
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = database.transaction(SOURCE_STORES, 'readwrite');
        const a = tx.objectStore(STORE).get(copy.id);
        const b = tx.objectStore(CURRENT_STORE).get(copy.id);
        const m = tx.objectStore(MEMBERSHIP_STORE).get(copy.id);
        const meta = tx.objectStore(METADATA_STORE).get('authority');
        meta.onsuccess = () => {
          try {
            if (a.result !== undefined && b.result !== undefined) throw new Error('Cross-partition source collision.');
            const actual = a.result ?? b.result;
            if ((actual === undefined) !== (existing === undefined)) throw new Error('Source changed during save.');
            if (actual !== undefined) { bounded(actual); if (canonicalJSON(actual) !== oldSource) throw new Error('Source changed during reconciliation.'); }
            const actualMetadata = (() => { try { bounded(meta.result, COMPACT_BYTES); return canonicalJSON(meta.result); } catch { return null; } })();
            if (actualMetadata !== oldMetadata) throw new Error('Authority changed during save/recovery.');
            if (actual !== undefined) {
              if (a.result === undefined && member && oldMember !== null) {
                try { bounded(m.result, COMPACT_BYTES);
                  membershipReady = canonicalJSON(m.result) === oldMember && oldMember === canonicalJSON(member);
                } catch { /* A concurrent missing/corrupt member stays unready, never repaired. */ }
              }
              return; // Identical retries never restore missing/different membership.
            }
            // Orphan membership cannot be reattached silently to a new source.
            tx.objectStore(CURRENT_STORE).add(copy);
            if (member && m.result === undefined) { tx.objectStore(MEMBERSHIP_STORE).add(member); membershipReady = true; }
            if (metadata) tx.objectStore(METADATA_STORE).put({ ...metadata,
              sourceRevision: Math.min(MAX_REVISION, metadata.sourceRevision + 1) }, 'authority');
            changed = true;
          } catch (error) { tx.abort(); reject(error); }
        };
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error ?? new Error('Atomic source save aborted.'));
      });
    } finally { database.close(); }
    if (changed) committed();
    return { state: 'saved', pendingIds: [], sourceId: copy.id, sourceHash: hash, sourceSaved: true, membershipReady };
  } catch { return failed(true); }
}

export async function getSavedSource(id: string): Promise<SavedSource | undefined> {
  const state = await readState(id);
  if (state.legacy !== undefined && state.current !== undefined) throw new Error('Cross-partition source collision.');
  const raw = state.legacy ?? state.current;
  return raw === undefined ? undefined : validateSource(raw);
}

/** Explicit user export, separate from any automatic preparation allowance. */
export async function exportSavedSources(): Promise<{ schemaId: 'typeforge-saved-sources-export-v1'; sources: SavedSource[] }> {
  const database = await openDatabase();
  let raw: unknown[];
  try {
    raw = await new Promise((resolve, reject) => {
      const tx = database.transaction([STORE, CURRENT_STORE], 'readonly');
      const a = tx.objectStore(STORE).getAll(), b = tx.objectStore(CURRENT_STORE).getAll();
      tx.oncomplete = () => resolve([...a.result, ...b.result]); tx.onabort = () => reject(tx.error);
    });
  } finally { database.close(); }
  const sources = new Map<string, SavedSource>(), collisions = new Set<string>();
  const ids = new Set<string>();
  for (const value of raw) {
    const id = value && typeof value === 'object' && 'id' in value ? value.id : undefined;
    if (typeof id === 'string') { if (ids.has(id)) collisions.add(id); ids.add(id); }
  }
  for (const value of raw) {
    try {
      const source = await validateSource(value);
      if (!collisions.has(source.id)) sources.set(source.id, source);
    } catch { /* Valid-readable-only export; corrupt sources stay stored. */ }
  }
  return { schemaId: 'typeforge-saved-sources-export-v1', sources: [...sources.values()] };
}

export async function deleteSource(id: string): Promise<void> {
  const validate = (await policy()).validateMetadata;
  const database = await openDatabase();
  let changed = false;
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction(SOURCE_STORES, 'readwrite');
      const a = tx.objectStore(STORE).getKey(id);
      const b = tx.objectStore(CURRENT_STORE).getKey(id);
      const m = tx.objectStore(MEMBERSHIP_STORE).getKey(id);
      const meta = tx.objectStore(METADATA_STORE).get('authority');
      meta.onsuccess = () => {
        changed = a.result !== undefined || b.result !== undefined || m.result !== undefined;
        if (!changed) return;
        tx.objectStore(STORE).delete(id); tx.objectStore(CURRENT_STORE).delete(id); tx.objectStore(MEMBERSHIP_STORE).delete(id);
        let metadata: Metadata | null = null;
        try { bounded(meta.result, COMPACT_BYTES); metadata = validate(meta.result); }
        catch { /* Ordinary source deletion remains available without authority. */ }
        if (metadata) {
          try { tx.objectStore(METADATA_STORE).put({ ...metadata, sourceRevision: Math.min(MAX_REVISION, metadata.sourceRevision + 1) }, 'authority'); }
          catch (error) { tx.abort(); reject(error); }
        }
      };
      tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error ?? new Error('Atomic source delete aborted.'));
    });
  } finally { database.close(); }
  if (changed) committed();
}

export async function resetEpoch(expectedDatabaseId: string): Promise<EpochReset> {
  let database: IDBDatabase | undefined;
  try {
    const validate = (await policy()).validateMetadata;
    const nextEpoch = crypto.randomUUID();
    database = await openDatabase();
    const result = await new Promise<EpochReset>((resolve, reject) => {
      const tx = database!.transaction(SOURCE_STORES, 'readwrite');
      const request = tx.objectStore(METADATA_STORE).get('authority');
      let output: EpochReset = { committed: false, authority: null, reason: 'context-unavailable' };
      request.onsuccess = () => {
        try {
          bounded(request.result, COMPACT_BYTES); const metadata = validate(request.result);
          if (metadata.databaseId !== expectedDatabaseId || !authority(metadata)) return;
          const next = { ...metadata, activeEpochId: nextEpoch, sourceRevision: metadata.sourceRevision + 1 };
          tx.objectStore(METADATA_STORE).put(next, 'authority');
          const usable = authority(next);
          output = usable ? { committed: true, authority: usable, reason: null }
            : { committed: true, authority: null, reason: 'authority-exhausted' };
        } catch { /* Malformed/missing metadata is never bootstrapped. */ }
      };
      tx.oncomplete = () => resolve(output); tx.onabort = () => reject(tx.error);
    });
    if (result.committed) committed();
    return result;
  } catch { return { committed: false, authority: null, reason: 'storage-unavailable' }; }
  finally { database?.close(); }
}

interface LedgerState {
  rows: number; bytes: number; processingMs: number; pending: number[]; sourceAttempts: number;
  rowLimit: number; byteLimit: number; metadata?: Metadata;
}
const ledgerStates = new WeakMap<Ledger, LedgerState>();
export function createPreparationLedger(limits: { rowLimit?: number; byteLimit?: number } = {}): Ledger {
  const rowLimit = limits.rowLimit ?? 500, byteLimit = limits.byteLimit ?? 16 * MAX_RESULT_BYTES;
  if (!Number.isInteger(rowLimit) || rowLimit < 1 || rowLimit > 500 || !Number.isInteger(byteLimit)
    || byteLimit < COMPACT_BYTES || byteLimit > 16 * MAX_RESULT_BYTES) throw new RangeError('Invalid preparation allowance.');
  const work: Work = { examinedRows: 0, examinedBytes: 0, slices: 0, keyRequests: 0, countRequests: 0,
    maxOperationMs: 0, oversizedSerializedBytes: 0, oversizedByteLowerBound: 0,
    unindexableLegacy: null, unindexableCurrent: null };
  let terminal: Stop | null = null;
  const state: LedgerState = { rows: 0, bytes: 0, processingMs: 0, pending: [], sourceAttempts: 0, rowLimit, byteLimit };
  const ledger: Ledger = {
    lookupId: crypto.randomUUID(), work, get terminal() { return terminal; },
    reserve(kind, maximumBytes) {
      if (terminal) return false;
      if (!Number.isInteger(maximumBytes) || maximumBytes < 0 || maximumBytes > MAX_RESULT_BYTES) throw new RangeError('Invalid point reservation.');
      const pending = state.pending.reduce((sum, bytes) => sum + bytes, 0);
      if (work.examinedRows >= rowLimit) { terminal = 'row-budget'; return false; }
      if (work.examinedBytes + pending + maximumBytes > byteLimit) { terminal = 'byte-budget'; return false; }
      if (state.rows >= 25 || state.bytes + pending + maximumBytes > 4 * MAX_RESULT_BYTES) return false;
      state.pending.push(maximumBytes); state.rows++; work.examinedRows++;
      if (kind === 'source') state.sourceAttempts++;
      return true;
    },
    settle(actualPrefixBytes, stop) {
      const reserved = state.pending[0];
      if (reserved === undefined || !Number.isInteger(actualPrefixBytes) || actualPrefixBytes < 0 || actualPrefixBytes > reserved) throw new Error('Invalid point settlement.');
      state.pending.shift();
      work.examinedBytes += actualPrefixBytes; state.bytes += actualPrefixBytes;
      terminal ??= stop;
    },
  };
  ledgerStates.set(ledger, state); return ledger;
}
function startSlice(ledger: Ledger): void {
  const state = ledgerStates.get(ledger);
  if (state) { if (state.pending.length) throw new Error('Unsettled point request.'); state.rows = 0; state.bytes = 0; state.processingMs = 0; }
  ledger.work.slices++;
}
function room(ledger: Ledger, rows: number, bytes: number, finalChecks = 0): Stop | 'slice' | null {
  if (ledger.terminal) return ledger.terminal;
  const state = ledgerStates.get(ledger);
  if (!state) throw new Error('Use createPreparationLedger for this lookup.');
  if (ledger.work.examinedRows + rows + finalChecks > state.rowLimit) return 'row-budget';
  if (ledger.work.examinedBytes + bytes + finalChecks * COMPACT_BYTES > state.byteLimit) return 'byte-budget';
  if (state.rows + rows > 25 || state.bytes + bytes > 4 * MAX_RESULT_BYTES || state.processingMs >= 8) return 'slice';
  return null;
}
function point(tx: IDBTransaction, store: string, key: IDBValidKey, ledger: Ledger,
  kind: 'source' | 'membership' | 'metadata', ready: (value: unknown) => void): void {
  const ceiling = kind === 'source' ? MAX_RESULT_BYTES : COMPACT_BYTES;
  if (!ledger.reserve(kind, ceiling)) throw new Error('Point allowance unavailable.');
  const requestedAt = performance.now();
  let request: IDBRequest;
  try { request = tx.objectStore(store).get(key); }
  catch (error) { ledger.settle(0, 'failure'); throw error; }
  request.onerror = () => { ledger.work.maxOperationMs = Math.max(ledger.work.maxOperationMs, performance.now() - requestedAt); ledger.settle(0, 'failure'); };
  request.onsuccess = () => {
    const started = performance.now();
    const value = request.result;
    const measured = value === undefined ? { bytes: 0, oversized: false, error: null } : historyJsonBytes(value, ceiling);
    if (measured.oversized) { ledger.work.oversizedSerializedBytes = null; ledger.work.oversizedByteLowerBound += ceiling + 1; }
    ledger.settle(measured.bytes, measured.error || measured.oversized ? 'record-limit' : null);
    const duration = performance.now() - started;
    ledger.work.maxOperationMs = Math.max(ledger.work.maxOperationMs, performance.now() - requestedAt);
    ledgerStates.get(ledger)!.processingMs += duration;
    if (!ledger.terminal) ready(value);
  };
}

type Page = { sources: readonly SourceRead[]; cursor: MergedCursor; complete: boolean;
  stop: Stop | 'exhausted' | 'slice'; work: Work };

async function metadataPoint(ledger: Ledger, signal?: AbortSignal): Promise<Metadata | null> {
  if (ledger.terminal || signal?.aborted) return null;
  if (room(ledger, 1, COMPACT_BYTES) === 'slice') startSlice(ledger);
  const database = await openDatabase(signal);
  let raw: unknown;
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction(SOURCE_STORES, 'readonly');
      point(tx, METADATA_STORE, 'authority', ledger, 'metadata', value => { raw = value; });
      tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error ?? new Error('Authority read aborted.'));
    });
  } finally { database.close(); }
  return ledger.terminal ? null : metadataValue(raw, true);
}

async function sourcePage(input: { cursor: MergedCursor | null; ledger: Ledger; authority?: Authority;
  signal?: AbortSignal; reserveFinal?: number }): Promise<Page> {
  const { ledger, signal } = input;
  const sources: SourceRead[] = [];
  const state = ledgerStates.get(ledger);
  if (!state) throw new Error('Use createPreparationLedger for this lookup.');
  let cursor: MergedCursor = input.cursor ? structuredClone(input.cursor) : {
    schemaId: 'typeforge-source-cursor-v3', databaseId: '',
    legacy: { before: null, exhausted: false }, current: { before: null, exhausted: false },
  };
  let stop: Page['stop'] = signal?.aborted ? 'aborted' : ledger.terminal ?? 'slice';
  const output = (): Page => ({ sources, cursor, complete: stop === 'exhausted', stop, work: ledger.work });
  if (signal?.aborted || ledger.terminal) return output();
  startSlice(ledger);
  let database: IDBDatabase | undefined;
  try {
    if (!state.metadata) state.metadata = await metadataPoint(ledger, signal) ?? undefined;
    if (ledger.terminal) { stop = ledger.terminal; return output(); }
    if (!state.metadata && input.authority) { stop = 'proof-unavailable'; return output(); }
    const metadata = state.metadata;
    const expected = metadata ? authority(metadata) : null;
    if (input.authority && (!expected || canonicalJSON(input.authority) !== canonicalJSON(expected))) { stop = 'authority-changed'; return output(); }
    const databaseId = metadata?.databaseId ?? 'authority-unavailable'; // Recovery cursor only, never policy authority.
    if (cursor.schemaId !== 'typeforge-source-cursor-v3' || cursor.databaseId && cursor.databaseId !== databaseId) {
      stop = 'authority-changed'; return output();
    }
    cursor.databaseId = databaseId;
    database = await openDatabase(signal);
    const raw: Array<{ value: unknown; member: unknown; partition: 'legacy' | 'current'; other: unknown }> = [];
    await new Promise<void>((resolve, reject) => {
      const tx = database!.transaction(SOURCE_STORES, 'readonly');
      const abort = () => tx.abort(); signal?.addEventListener('abort', abort, { once: true });
      const cleanup = () => signal?.removeEventListener('abort', abort);
      tx.oncomplete = () => { cleanup(); resolve(); };
      tx.onabort = () => { cleanup(); reject(tx.error ?? new Error('Source slice aborted.')); };
      if (ledger.work.countRequests === 0) {
        for (const partition of ['legacy', 'current'] as const) {
          const store = tx.objectStore(partition === 'legacy' ? STORE : CURRENT_STORE);
          ledger.work.countRequests++;
          const allStarted = performance.now(), all = store.count();
          all.onsuccess = () => { ledger.work.maxOperationMs = Math.max(ledger.work.maxOperationMs, performance.now() - allStarted); };
          ledger.work.countRequests++;
          const indexStarted = performance.now(), indexed = store.index('completedAt-id').count();
          indexed.onsuccess = () => { ledger.work.maxOperationMs = Math.max(ledger.work.maxOperationMs, performance.now() - indexStarted);
            ledger.work[partition === 'legacy' ? 'unindexableLegacy' : 'unindexableCurrent'] = all.result - indexed.result; };
        }
      }
      visitMergedKeys(tx, cursor, (entry, partition, next) => {
        if (ledger.terminal) { stop = ledger.terminal; return; }
        // Reserve source, possible cross-partition collision payload and membership
        // together, leaving both final proof and admission requests in this ledger.
        const lack = room(ledger, 3, 2 * MAX_RESULT_BYTES + COMPACT_BYTES, input.reserveFinal ?? 0);
        if (lack) { stop = lack; return; }
        const store = partition === 'legacy' ? STORE : CURRENT_STORE;
        try {
          cursor[partition].before = structuredClone(entry.key);
          point(tx, store, entry.primaryKey, ledger, 'source', value => {
            point(tx, partition === 'legacy' ? CURRENT_STORE : STORE, entry.primaryKey, ledger, 'source', other => {
              point(tx, MEMBERSHIP_STORE, entry.primaryKey, ledger, 'membership', member => {
                raw.push({ value, other, member, partition }); next();
              });
            });
          });
        } catch (error) { tx.abort(); reject(error); }
      }, () => { stop = 'exhausted'; }, () => {
        if (ledger.terminal) { stop = ledger.terminal; return false; }
        if (ledger.work.keyRequests >= Math.min(1004, 2 * state.sourceAttempts + 4)) { stop = 'row-budget'; return false; }
        ledger.work.keyRequests++; return true;
      }, duration => { ledger.work.maxOperationMs = Math.max(ledger.work.maxOperationMs, duration); });
    });
    // Source/config hashes, finite plan resolution and policy validation never
    // keep an IDB transaction alive across an arbitrary async operation.
    let processingMs = 0;
    for (const item of raw) {
      if (processingMs >= 8) { await new Promise<void>(resolve => setTimeout(resolve, 0)); processingMs = 0; }
      const started = performance.now();
      if (item.other !== undefined) { stop = 'proof-unavailable'; sources.length = 0; break; }
      try {
        const source = freeze(await validateSource(item.value, true));
        const ref: SourceRef = freeze({ partition: item.partition, kind: 'schemaId' in source ? 'finite-practice-v1' : 'timed-v1',
          id: source.id, sha256: await sourceHash(source), completedAt: source.completedAt });
        let membership: Membership | null = null;
        if (item.member !== undefined && item.partition === 'current') {
          const member = item.member as Membership;
          const captured = { databaseId: member.databaseId, contextId: member.contextId,
            epochId: member.epochId, capturedAt: member.capturedAt, purpose: member.purpose };
          try { membership = freeze((await policy()).validateMembership(item.member, ref, captured)); }
          catch { /* Missing or invalid membership excludes current evidence, never reclassifies it. */ }
        }
        sources.push(freeze({ ref, source, membership }));
      } catch { /* Bounded invalid source remains stored and is not policy evidence. */ }
      finally { const duration = performance.now() - started; processingMs += duration;
        ledger.work.maxOperationMs = Math.max(ledger.work.maxOperationMs, duration); }
    }
    stop = signal?.aborted ? 'aborted' : ledger.terminal ?? stop;
  } catch { stop = signal?.aborted ? 'aborted' : ledger.terminal ?? 'failure'; }
  finally { database?.close(); }
  return output();
}

export async function listSavedSourcesPage(input: { cursor: MergedCursor | null; ledger: Ledger; signal?: AbortSignal }): Promise<Page> {
  return sourcePage(input);
}
export async function readPolicySlice(input: { cursor: MergedCursor | null; ledger: Ledger;
  authority: Authority; signal?: AbortSignal }): Promise<Page> {
  return sourcePage({ ...input, reserveFinal: 2 });
}

interface PreparedEntry {
  candidate: import('./coach-types.ts').PracticeSnapshot | null; proof: VerifiedProof;
  ledger: Ledger; invalidation: number; signal?: AbortSignal;
}
const prepared = new WeakMap<PreparedStatus, PreparedEntry>();

function unavailable(input: { persistence: Persistence; pendingSources: readonly PendingSource[] }, ledger: Ledger,
  reason: 'storage-unavailable' | 'context-unavailable' | 'policy-invalid' | 'scan-incomplete', enabled = false): PreparedStatus {
  return {
    automaticCoaching: enabled ? 'enabled' : 'unavailable', baselineProofComplete: false,
    summarySelectionProofComplete: false, evidenceScanComplete: null, pendingSave: 0,
    pendingSources: input.pendingSources, persistence: input.persistence, otherContextCount: null, work: { ...ledger.work },
    participation: reason === 'scan-incomplete' ? { state: 'pending', reason, counted: 0, ordinal: null, proof: null }
      : { state: 'unavailable', reason, counted: null, ordinal: null, proof: null },
    summary: reason === 'scan-incomplete' ? { state: 'pending', reason, value: null } : { state: 'unavailable', reason, value: null },
    coach: { state: 'unavailable', evidenceScanComplete: null, reason, snapshot: null },
  };
}

export async function preparePractice(input: { config: unknown; generation: number; now: string;
  persistence: Persistence; pendingSources: readonly PendingSource[]; signal?: AbortSignal }): Promise<PreparedStatus> {
  input = { ...input }; // Capture primitive request identity before the first await.
  listen();
  const ledger = createPreparationLedger(), localVersion = invalidation;
  startSlice(ledger);
  let config: unknown, configId: string;
  try {
    bounded(input.config);
    const module = await plans();
    config = freeze(structuredClone(module.validateCoachConfig(input.config)));
    configId = module.hashCanonical(config);
    if (!Number.isSafeInteger(input.generation) || input.generation < 0 || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(input.now)
      || !Number.isFinite(Date.parse(input.now)) || new Date(input.now).toISOString() !== input.now) throw new Error('Invalid preparation identity.');
  } catch { return unavailable(input, ledger, 'policy-invalid'); }
  let metadata: Metadata | null;
  try { metadata = await metadataPoint(ledger, input.signal); }
  catch { return unavailable(input, ledger, 'storage-unavailable', true); }
  if (!metadata || !authority(metadata)) return unavailable(input, ledger, ledger.terminal ? 'scan-incomplete' : 'context-unavailable', true);
  metadata = freeze(structuredClone(metadata));
  ledgerStates.get(ledger)!.metadata = metadata;
  const capturedAuthority = freeze(authority(metadata)!);
  const { qualifiesPolicySource } = await policy();
  const sources: SourceRead[] = [];
  let cursor: MergedCursor | null = null, done = false, stopped: Stop = 'proof-unavailable';
  let participationRange: RangeProof<'participation'> = { complete: false, stop: 'proof-unavailable' };
  let summaryRange: RangeProof<'summary'> = { complete: false, stop: 'proof-unavailable' };
  let coachRange: RangeProof<'coach'> | null = null;
  const participationIds: string[] = [], summaryIds: string[] = [], coachIds: string[] = [];
  let assessmentCount = 0, recentCount = 0;
  const cutoff = new Date(Date.parse(input.now) - 2592000000).toISOString();
  while (!done) {
    if (localVersion !== invalidation || input.signal?.aborted) { stopped = input.signal?.aborted ? 'aborted' : 'authority-changed'; break; }
    const page = await readPolicySlice({ cursor, ledger, authority: capturedAuthority, signal: input.signal });
    cursor = page.cursor;
    for (const read of page.sources) {
      sources.push(read);
      if (!participationRange.complete) participationIds.push(read.ref.id);
      if (!summaryRange.complete) summaryIds.push(read.ref.id);
      if (!coachRange?.complete) coachIds.push(read.ref.id);
      // D's shared classifier is provisional here; only the final transaction
      // and post-proof projection can establish publishable components.
      const eligible = qualifiesPolicySource(read, { metadata, now: input.now });
      if (eligible && read.source.mode === 'assessment') {
        assessmentCount++;
        if (assessmentCount === 10) {
          participationRange = { complete: true, stop: 'ten-witnesses', orderedSourceIds: [...participationIds], authority: capturedAuthority };
          summaryRange = { complete: true, stop: 'tenth-assessment', orderedSourceIds: [...summaryIds], authority: capturedAuthority };
        }
      }
      if (!coachRange?.complete) {
        if (read.source.completedAt < cutoff) coachRange = { complete: true, stop: 'older-than-cutoff', orderedSourceIds: [...coachIds], authority: capturedAuthority };
        else if (eligible && ++recentCount === 20) coachRange = { complete: true, stop: 'twentieth-run', orderedSourceIds: [...coachIds], authority: capturedAuthority };
      }
    }
    if (page.complete) {
      if (!participationRange.complete) participationRange = { complete: true, stop: 'exhausted', orderedSourceIds: [...participationIds], authority: capturedAuthority };
      if (!summaryRange.complete) summaryRange = { complete: true, stop: 'exhausted', orderedSourceIds: [...summaryIds], authority: capturedAuthority };
      coachRange ??= { complete: true, stop: 'exhausted', orderedSourceIds: [...coachIds], authority: capturedAuthority };
      done = true;
    } else if (page.stop !== 'slice') { stopped = page.stop === 'exhausted' ? 'proof-unavailable' : page.stop; break; }
    if (participationRange.complete && summaryRange.complete && coachRange?.complete) done = true;
    if (!done) await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
  if (!participationRange.complete) participationRange = { complete: false, stop: stopped };
  if (!summaryRange.complete) summaryRange = { complete: false, stop: stopped };
  if (assessmentCount < 10) coachRange = null;
  else if (!coachRange?.complete) coachRange = { complete: false, stop: stopped };
  let finalProof: VerifiedProof | null = null;
  let proofContextUnavailable = false;
  try {
    if (!ledger.terminal && localVersion === invalidation && !input.signal?.aborted) {
      const finalMetadata = await metadataPoint(ledger, input.signal);
      proofContextUnavailable = !ledger.terminal && (!finalMetadata || !authority(finalMetadata)
        || finalMetadata.databaseId !== metadata.databaseId || finalMetadata.defaultContextId !== metadata.defaultContextId
        || finalMetadata.activeEpochId !== metadata.activeEpochId);
      // metadataPoint resolves only on completion of a readonly transaction
      // overlapping every shipped source writer, after hashing has finished.
      if (finalMetadata && authority(finalMetadata) && canonicalJSON(finalMetadata) === canonicalJSON(metadata)
        && localVersion === invalidation && !input.signal?.aborted) {
        finalProof = freeze({ authority: capturedAuthority, admittedAt: new Date().toISOString(), configId,
          method: 'all-writer-revision', selection: { metadata, now: input.now,
            sourceBindings: sources.map(({ ref, membership }) => ({ ref, membership })),
            participationRange, summaryRange, coachRange } });
      }
    }
  } catch { /* Failed actual proof produces no proved output. No fresh-cap retry. */ }
  if (proofContextUnavailable) return unavailable(input, ledger, 'context-unavailable', true);
  const projectionInput: ProjectionInput = { now: input.now, metadata, authority: capturedAuthority,
    sources: freeze(sources), finalProof, participationRange, summaryRange, coachRange,
    config, configId, generation: input.generation, persistence: input.persistence,
    pendingSources: input.pendingSources, work: ledger.work };
  const module = await policy(), projectedAt = performance.now();
  const projection = module.derivePolicy(projectionInput);
  ledger.work.maxOperationMs = Math.max(ledger.work.maxOperationMs, performance.now() - projectedAt);
  if (finalProof && localVersion === invalidation && !input.signal?.aborted) {
    prepared.set(projection.status, { candidate: projection.candidate, proof: finalProof, ledger,
      invalidation: localVersion, signal: input.signal });
  } else if (localVersion !== invalidation || input.signal?.aborted) return unavailable(input, ledger, 'scan-incomplete', true);
  return projection.status;
}

/** Call immediately before first insertion; current() is read after the async
 * barrier, so navigation/start/config changes during that read cannot admit. */
export async function admitPreparedPractice(status: PreparedStatus, current: () => {
  generation: number; configId: string; runState: 'idle' | 'running' | 'disposed';
}): Promise<Admission> {
  const entry = prepared.get(status);
  if (!entry || !entry.candidate) return { admitted: false, reason: 'scan-incomplete' };
  if (entry.invalidation !== invalidation || entry.signal?.aborted) return { admitted: false, reason: 'authority-changed' };
  try {
    const metadata = await metadataPoint(entry.ledger, entry.signal);
    const fresh = current();
    if (!metadata || !authority(metadata) || entry.signal?.aborted || entry.invalidation !== invalidation
      || canonicalJSON(metadata) !== canonicalJSON(entry.proof.selection.metadata)) return { admitted: false, reason: 'authority-changed' };
    const module = await policy();
    // Read current once more after module loading; no async gap follows this.
    const latest = current();
    if (entry.signal?.aborted || entry.invalidation !== invalidation || fresh.configId !== latest.configId) return { admitted: false, reason: 'authority-changed' };
    return module.admitPractice({ candidate: entry.candidate, proof: entry.proof,
      currentAuthority: authority(metadata)!, currentConfigId: latest.configId,
      currentGeneration: latest.generation, runState: latest.runState });
  } catch { return { admitted: false, reason: 'scan-incomplete' }; }
}
